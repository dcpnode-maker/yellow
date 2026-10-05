import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  OwnedProofProcessDeadlineError,
  runOwnedProofProcess,
} from "./helpers/owned-proof-process";

function command(source: string): readonly string[] {
  return [process.execPath, "-e", source];
}

function processExists(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if ((error as { code?: string }).code === "ESRCH") return false;
    throw error;
  }
}

async function stopExactProcess(pid: number): Promise<void> {
  if (processExists(pid)) process.kill(pid, "SIGKILL");
  const deadline = Date.now() + 2_000;
  while (processExists(pid) && Date.now() < deadline) await Bun.sleep(10);
  expect(processExists(pid)).toBe(false);
}

async function recordedProcessId(path: string): Promise<number> {
  const pid = Number(await readFile(path, "utf8"));
  if (!Number.isSafeInteger(pid) || pid < 1) throw new Error("owned proof process recorded an invalid PID");
  return pid;
}

describe("owned proof process", () => {
  test("collects a successful child's bounded stdout and stderr", async () => {
    const result = await runOwnedProofProcess(command(
      `process.stdout.write("success-output"); process.stderr.write("success-diagnostic");`,
    ), { timeoutMs: 2_000 });

    expect(result).toEqual({
      exitCode: 0,
      stdout: "success-output",
      stderr: "success-diagnostic",
    });
  });

  test("returns a nonzero exit without hiding its bounded diagnostics", async () => {
    const result = await runOwnedProofProcess(command(
      `process.stdout.write("before-exit"); process.stderr.write("rejected-proof"); process.exit(7);`,
    ), { timeoutMs: 2_000 });

    expect(result).toEqual({
      exitCode: 7,
      stdout: "before-exit",
      stderr: "rejected-proof",
    });
  });

  test("drains excessive output while retaining only its bounded tail", async () => {
    const result = await runOwnedProofProcess(command(
      `process.stdout.write("x".repeat(65536) + "STDOUT-TAIL"); process.stderr.write("y".repeat(65536) + "STDERR-TAIL");`,
    ), { timeoutMs: 2_000, maxOutputBytes: 1_024 });

    expect(result.exitCode).toBe(0);
    expect(new TextEncoder().encode(result.stdout).byteLength).toBeLessThanOrEqual(1_024);
    expect(new TextEncoder().encode(result.stderr).byteLength).toBeLessThanOrEqual(1_024);
    expect(result.stdout.endsWith("STDOUT-TAIL")).toBe(true);
    expect(result.stderr.endsWith("STDERR-TAIL")).toBe(true);
  });

  test("keeps a multi-byte retained tail within the configured byte bound", async () => {
    const result = await runOwnedProofProcess(command(
      `process.stdout.write("é".repeat(32768) + "終端"); process.stderr.write("🙂".repeat(16384) + "完了");`,
    ), { timeoutMs: 2_000, maxOutputBytes: 1_024 });

    expect(new TextEncoder().encode(result.stdout).byteLength).toBeLessThanOrEqual(1_024);
    expect(new TextEncoder().encode(result.stderr).byteLength).toBeLessThanOrEqual(1_024);
    expect(result.stdout.endsWith("終端")).toBe(true);
    expect(result.stderr.endsWith("完了")).toBe(true);
  });

  test("rejects invalid command, deadline and output bounds before spawning", async () => {
    await expect(runOwnedProofProcess([], { timeoutMs: 1 })).rejects.toThrow(
      "owned proof process command must contain non-empty arguments",
    );
    await expect(runOwnedProofProcess(command("void 0"), { timeoutMs: 0 })).rejects.toThrow(
      "timeoutMs must be an integer between 1 and 120000",
    );
    await expect(runOwnedProofProcess(command("void 0"), { timeoutMs: 1, maxOutputBytes: 0 })).rejects.toThrow(
      "maxOutputBytes must be an integer between 1 and 4194304",
    );
  });

  test("kills and reaps an owned child that exceeds its lifecycle deadline", async () => {
    const directory = await mkdtemp(join(tmpdir(), "yellow-owned-proof-process-"));
    const pidFile = join(directory, "pid.txt");
    const startedAt = performance.now();
    try {
      const proof = runOwnedProofProcess(command(
        `const commandPrivate = "command-private-sentinel"; await Bun.write(process.env.YELLOW_OWNED_PROOF_PID_FILE, String(process.pid)); process.stdout.write("bounded-timeout-output"); process.stderr.write("bounded-timeout-diagnostic"); setInterval(() => commandPrivate, 1000);`,
      ), {
        env: { ...process.env, YELLOW_OWNED_PROOF_PID_FILE: pidFile,
          YELLOW_OWNED_PROOF_PRIVATE: "environment-private-sentinel" },
        timeoutMs: 1_000,
      });

      let failure: unknown;
      try { await proof; } catch (error) { failure = error; }
      expect(failure).toBeInstanceOf(OwnedProofProcessDeadlineError);
      expect(failure).toMatchObject({
        message: "owned proof process exceeded its lifecycle deadline",
        stdout: "bounded-timeout-output",
        stderr: "bounded-timeout-diagnostic",
      });
      expect(String(failure)).not.toContain("command-private-sentinel");
      expect(String(failure)).not.toContain("environment-private-sentinel");
      expect(performance.now() - startedAt).toBeLessThan(1_500);
      const pid = await recordedProcessId(pidFile);
      expect(processExists(pid)).toBe(false);
    } finally {
      try {
        const pid = await recordedProcessId(pidFile);
        if (processExists(pid)) await stopExactProcess(pid);
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    }
  });

  test("cancels inherited pipe readers after the parent exits before its grandchild", async () => {
    const directory = await mkdtemp(join(tmpdir(), "yellow-owned-proof-process-descendant-"));
    const pidFile = join(directory, "descendant-pid.txt");
    const descendantSource = `process.stdout.write("descendant-open"); process.stderr.write("descendant-diagnostic"); setInterval(() => undefined, 1000);`;
    const parentSource = `const {spawn}=await import("node:child_process"); const child=spawn(process.execPath,["-e",${JSON.stringify(descendantSource)}],{detached:true,stdio:["ignore",1,2],windowsHide:true}); child.unref(); await Bun.write(process.env.YELLOW_OWNED_PROOF_DESCENDANT_PID,String(child.pid));`;
    const startedAt = performance.now();
    try {
      let failure: unknown;
      try {
        await runOwnedProofProcess(command(parentSource), {
          env: { ...process.env, YELLOW_OWNED_PROOF_DESCENDANT_PID: pidFile },
          timeoutMs: 1_000,
        });
      } catch (error) { failure = error; }
      expect(failure).toBeInstanceOf(OwnedProofProcessDeadlineError);
      expect(failure).toMatchObject({
        stdout: expect.stringContaining("descendant-open"),
        stderr: expect.stringContaining("descendant-diagnostic"),
      });
      expect(performance.now() - startedAt).toBeLessThan(1_500);
      const descendantPid = await recordedProcessId(pidFile);
      expect(processExists(descendantPid)).toBe(true);
    } finally {
      // Re-read independently of the assertion path: even an earlier failure
      // cannot strand this deliberately detached, exact-PID fixture process.
      try {
        await stopExactProcess(await recordedProcessId(pidFile));
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    }
  });
});
