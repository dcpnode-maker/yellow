import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PROJECT_BUILD_SNAPSHOT } from "../src/project-status";

const root = fileURLToPath(new URL("..", import.meta.url));

function runState(environment?: NodeJS.ProcessEnv) {
  const command = process.platform === "win32"
    ? ["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", join(root, "state.ps1")]
    : ["bash", join(root, "state.sh")];
  return Bun.spawnSync(command, { cwd: root, env: environment ?? process.env });
}

function parseStatus(status: string): Readonly<Record<string, string>> {
  return Object.freeze(
    Object.fromEntries(
      [...status.matchAll(/^<!-- ([a-z-]+): (.*) -->$/gm)].map((match) => [match[1]!, match[2]!] as const),
    ),
  );
}

describe("canonical project status", () => {
  test("records the accepted native closure and current durable-submission work", () => {
    expect(PROJECT_BUILD_SNAPSHOT.recordedAt).toBe("2026-09-06");
    expect(PROJECT_BUILD_SNAPSHOT.roadmap).toMatchObject({
      phaseCount: 18,
      latestBuiltOrder: 439,
      currentOrder: 440,
      activePhase: 7,
    });
    expect(PROJECT_BUILD_SNAPSHOT.review.independentlyReviewedThroughOrder).toBeGreaterThanOrEqual(91);

    const byOrder = new Map(PROJECT_BUILD_SNAPSHOT.recordedWork.map((work) => [work.order, work]));
    expect(byOrder.get(434)).toMatchObject({
      state: "independently_approved",
      summary: expect.stringContaining("native"),
    });
    expect(byOrder.get(440)).toMatchObject({
      state: "proof_in_progress",
      summary: expect.stringContaining("durable fiscal submission"),
    });

    expect(PROJECT_BUILD_SNAPSHOT.phases).toHaveLength(18);
    expect(PROJECT_BUILD_SNAPSHOT.phases.map(({ number, state }) => [number, state])).toEqual([
      [0, "reviewed"], [1, "reviewed"], [2, "reviewed"], [3, "reviewed"],
      [4, "built_unverified"], [5, "reviewed"], [6, "reviewed"], [7, "active"],
      [8, "planned"], [9, "planned"], [10, "planned"], [11, "planned"],
      [12, "planned"], [13, "planned"], [14, "planned"], [15, "planned"],
      [16, "planned"], [17, "planned"],
    ]);
  });

  test("drives the Unix report from valid metadata and real current orders", async () => {
    const status = await Bun.file(`${root}/docs/PROJECT-STATUS.md`).text();
    const fields = parseStatus(status);
    const phase = fields["current-phase"];
    const task = fields["current-task"];
    const lifecycle = fields["current-lifecycle"];
    if (phase === undefined || task === undefined || lifecycle === undefined) {
      throw new Error("required project-status metadata is missing");
    }
    const currentFiles = fields["current-order-files"]?.split(";") ?? [];

    expect(fields["status-schema"]).toBe("yellow-project-status/v1");
    expect(phase).toMatch(/^\d+$/);
    expect(task.trim().length).toBeGreaterThan(0);
    expect(lifecycle.trim().length).toBeGreaterThan(0);
    expect(currentFiles.length).toBeGreaterThan(0);
    expect(new Set(currentFiles).size).toBe(currentFiles.length);
    for (const file of currentFiles) {
      expect(file.trim()).toBe(file);
      expect(await Bun.file(`${root}/${file}`).exists()).toBe(true);
    }

    const report = runState();
    expect(report.exitCode).toBe(0);
    const output = new TextDecoder("utf-8").decode(report.stdout);
    expect(output).toContain(`Current task: ${task}`);
    expect(output).toContain(`Lifecycle: ${lifecycle}`);
    expect(output).toContain(`Phase: ${phase} · ${lifecycle}`);
    for (const file of currentFiles) expect(output).toContain(`  ${file}`);
    expect(output).not.toContain("Open orders:");
    expect(output).not.toContain("Open questions:");
  });

  test("fails closed when required metadata is invalid", async () => {
    const directory = await mkdtemp(join(tmpdir(), "yellow-project-status-"));
    const invalidStatus = join(directory, "invalid.md");
    try {
      await Bun.write(
        invalidStatus,
        [
          "<!-- status-schema: yellow-project-status/v1 -->",
          "<!-- current-phase: invalid -->",
          "<!-- current-task: invalid fixture -->",
          "<!-- current-order-files: handoff/orders/438-codex-consolidated-release.md -->",
        ].join("\n"),
      );
      const report = runState({ ...process.env, YELLOW_PROJECT_STATUS_FILE: invalidStatus });
      expect(report.exitCode).not.toBe(0);
      const errorOutput = `${new TextDecoder("utf-8").decode(report.stderr)}${new TextDecoder("utf-8").decode(report.stdout)}`;
      if (process.platform === "win32") expect(errorOutput).toMatch(/YELLOW\s+state report failed/);
      else expect(errorOutput).toContain("invalid docs/PROJECT-STATUS.md metadata");
      expect(report.stdout.toString()).not.toContain("Referee:");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  test("keeps PowerShell on the same canonical fields and fail-closed schema", async () => {
    const script = await Bun.file(`${root}/state.ps1`).text();
    expect(script).toContain("Read-StatusField 'status-schema'");
    expect(script).toContain("Read-StatusField 'current-phase'");
    expect(script).toContain("Read-StatusField 'current-order-files'");
    expect(script).toContain("yellow-project-status/v1");
    expect(script).not.toContain("Write-Host 'Open orders:'");
    expect(script).not.toContain("Write-Host 'Open questions:'");
  });
});
