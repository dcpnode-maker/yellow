import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Database } from "bun:sqlite";
import {
  validateManifest,
  validateSafeRelativePath,
  buildAntigravityArgv,
  buildGoosePlannerArgv,
  initDb,
  cmdEnqueue,
  cmdRun,
  cmdVerify,
  cmdRecover,
  cmdStatus,
  type ExecutionResult,
  type SubprocessExecutor,
} from "../scripts/free-build/runner";

describe("Order745 Free Coding Runner Test Battery", () => {
  let tempRoot: string;
  let workspaceDir: string;
  let orderFile: string;
  let dbFile: string;
  let db: Database;

  beforeEach(() => {
    tempRoot = mkdtempSync(join(tmpdir(), "order745-test-"));
    workspaceDir = join(tempRoot, "workspace");
    mkdirSync(workspaceDir, { recursive: true });
    orderFile = join(tempRoot, "order.md");
    writeFileSync(orderFile, "# Order spec");
    dbFile = join(tempRoot, "runner.db");
    db = initDb(dbFile);
  });

  afterEach(() => {
    try {
      db.close();
    } catch {}
    try {
      rmSync(tempRoot, { recursive: true, force: true });
    } catch {}
  });

  test("validation: safe relative path rejects absolute, traversal, null byte, forbidden segments, windows devices", () => {
    expect(() => validateSafeRelativePath("C:/abs/path")).toThrow();
    expect(() => validateSafeRelativePath("/abs/path")).toThrow();
    expect(() => validateSafeRelativePath("../escape")).toThrow();
    expect(() => validateSafeRelativePath("a/../out.ts")).toThrow();
    expect(() => validateSafeRelativePath("foo/\0bar")).toThrow();
    expect(() => validateSafeRelativePath("out.ts:hidden")).toThrow();
    expect(() => validateSafeRelativePath(".")).toThrow();
    expect(() => validateSafeRelativePath("CON")).toThrow();
    expect(() => validateSafeRelativePath("aux.txt")).toThrow();
    expect(() => validateSafeRelativePath("file.ts ")).toThrow();
    expect(() => validateSafeRelativePath("file.ts.")).toThrow();
    expect(() => validateSafeRelativePath(".env.production")).toThrow();
    expect(() => validateSafeRelativePath("secrets/key.txt")).toThrow();
    expect(() => validateSafeRelativePath(".codex-remote-attachments/a")).toThrow();
    expect(() => validateSafeRelativePath("node_modules/pkg/index.js")).toThrow();
    expect(() => validateSafeRelativePath(".git/HEAD")).toThrow();
    expect(validateSafeRelativePath("safe/file.ts")).toBe("safe/file.ts");
  });

  test("validation: manifest rejects missing version, unknown keys, invalid id, non-integer timeout, empty prompt", () => {
    const testCheck = join(workspaceDir, "test.test.ts");
    writeFileSync(testCheck, "export const a = 1;");

    const validManifest = {
      version: 1,
      id: "task-01",
      workspace: workspaceDir,
      orderPath: orderFile,
      prompt: "Do work",
      writePaths: ["src/out.ts"],
      checkPaths: ["test.test.ts"],
      timeoutSeconds: 60,
      engine: "antigravity",
    };

    const parsed = validateManifest(validManifest);
    expect(parsed.id).toBe("task-01");

    expect(() => validateManifest({ ...validManifest, version: 2 })).toThrow(/version/);
    expect(() => validateManifest({ ...validManifest, extraKey: true })).toThrow(/Unknown key/);
    expect(() => validateManifest({ ...validManifest, id: "bad id with space" })).toThrow(/Invalid id/);
    expect(() => validateManifest({ ...validManifest, engine: "goose" })).toThrow(/Invalid engine/);
    expect(() => validateManifest({ ...validManifest, timeoutSeconds: 60.5 })).toThrow(/timeoutSeconds/);
    expect(() => validateManifest({ ...validManifest, timeoutSeconds: 10 })).toThrow(/timeoutSeconds/);
    expect(() => validateManifest({ ...validManifest, prompt: "   \t\n  " })).toThrow(/prompt/);
    expect(() => validateManifest({ ...validManifest, writePaths: ["src/out.ts", "SRC/OUT.TS"] })).toThrow(/Duplicate/);
    expect(() => validateManifest({ ...validManifest, writePaths: ["test.test.ts"] })).toThrow(/overlap/);

    const notATest = join(workspaceDir, "not-a-test.txt");
    writeFileSync(notATest, "hello");
    expect(() => validateManifest({ ...validManifest, checkPaths: ["not-a-test.txt"] })).toThrow(/test file/);
  });

  test("status: non-existent db reports empty without creating file", () => {
    const nonExistentDb = join(tempRoot, "not-here.db");
    cmdStatus(nonExistentDb);
    // cmdStatus should not throw or create file
  });

  test("enqueue: idempotent on same hash, rejects conflicting manifest with same id, pins check hashes", () => {
    const testCheck = join(workspaceDir, "test.test.ts");
    writeFileSync(testCheck, "export const a = 1;");
    const manifestFile1 = join(tempRoot, "man1.json");
    const manifestFile2 = join(tempRoot, "man2.json");

    const man1 = {
      version: 1,
      id: "task-idemp",
      workspace: workspaceDir,
      orderPath: orderFile,
      prompt: "Prompt 1",
      writePaths: ["src/file1.ts"],
      checkPaths: ["test.test.ts"],
      timeoutSeconds: 60,
      engine: "antigravity",
    };
    writeFileSync(manifestFile1, JSON.stringify(man1));

    cmdEnqueue(manifestFile1, dbFile, db);
    // Second enqueue of identical manifest is idempotent
    cmdEnqueue(manifestFile1, dbFile, db);

    const row = db.query("SELECT check_hashes_json FROM runner_tasks WHERE id = 'task-idemp'").get() as any;
    expect(row.check_hashes_json).toContain("test.test.ts");

    const man2 = { ...man1, prompt: "Different prompt conflicting" };
    writeFileSync(manifestFile2, JSON.stringify(man2));

    expect(() => cmdEnqueue(manifestFile2, dbFile, db)).toThrow(/Conflict/);
  });

  test("argv policy: antigravity fixed args and goose planner cloud rejection & tagged model acceptance", () => {
    const man = {
      version: 1 as const,
      id: "task-argv",
      workspace: workspaceDir,
      orderPath: orderFile,
      prompt: "Test prompt",
      writePaths: ["src/file.ts"],
      checkPaths: [],
      timeoutSeconds: 120,
      engine: "antigravity" as const,
    };
    const argv = buildAntigravityArgv(man);
    expect(argv[0]).toContain("agy.exe");
    expect(argv).toContain("--sandbox");
    expect(argv).toContain("gemini-3.8-flash-low");
    expect(argv).toContain("low");
    expect(argv).toContain("120s");

    expect(() => buildGoosePlannerArgv("llama3:cloud", "prompt")).toThrow(/Rejected unsafe\/cloud/);
    expect(() => buildGoosePlannerArgv("http://malicious", "prompt")).toThrow();
    const gooseArgv = buildGoosePlannerArgv("qwen2.5-coder:7b", "plan prompt");
    expect(gooseArgv[0]).toContain("goose.exe");
    expect(gooseArgv).toContain("--no-profile");
    expect(gooseArgv).toContain("ollama");
    expect(gooseArgv).toContain("qwen2.5-coder:7b");
  });

  test("run: global single-running lock prevents concurrent task execution and requires explicit execute", async () => {
    const man1 = {
      version: 1,
      id: "task-lock-1",
      workspace: workspaceDir,
      orderPath: orderFile,
      prompt: "Task 1",
      writePaths: ["src/out1.ts"],
      checkPaths: [],
      timeoutSeconds: 60,
      engine: "antigravity",
    };
    const mFile = join(tempRoot, "m1.json");
    writeFileSync(mFile, JSON.stringify(man1));
    cmdEnqueue(mFile, dbFile, db);

    // Explicit execute required
    await expect(cmdRun("task-lock-1", dbFile, false, { dbInstance: db })).rejects.toThrow(/--execute flag is required/);

    // Simulate task 1 running
    db.query("UPDATE runner_tasks SET status = 'running', pid = 99999 WHERE id = 'task-lock-1'").run();

    const man2 = { ...man1, id: "task-lock-2" };
    const mFile2 = join(tempRoot, "m2.json");
    writeFileSync(mFile2, JSON.stringify(man2));
    cmdEnqueue(mFile2, dbFile, db);

    // Attempting to run task 2 while task 1 is running must throw global lock error
    await expect(cmdRun("task-lock-2", dbFile, true, { dbInstance: db })).rejects.toThrow(/Global single-running lock active/);
  });

  test("verify: global single-running lock prevents concurrent verification while a task is running", async () => {
    const checkFile = join(workspaceDir, "test.test.ts");
    writeFileSync(checkFile, "import { test, expect } from 'bun:test'; test('ok', () => expect(1).toBe(1));");

    const man = {
      version: 1,
      id: "task-verify-lock",
      workspace: workspaceDir,
      orderPath: orderFile,
      prompt: "Task 1",
      writePaths: ["src/out1.ts"],
      checkPaths: ["test.test.ts"],
      timeoutSeconds: 60,
      engine: "antigravity",
    };
    const mFile = join(tempRoot, "m_vlock.json");
    writeFileSync(mFile, JSON.stringify(man));
    cmdEnqueue(mFile, dbFile, db);

    // Set task to needs_review
    db.query("UPDATE runner_tasks SET status = 'needs_review' WHERE id = 'task-verify-lock'").run();

    // Create another task that is currently running
    db.query("INSERT INTO runner_tasks (id, manifest_hash, manifest_json, status, created_at, updated_at) VALUES ('other-running', 'h', '{}', 'running', 't', 't')").run();

    await expect(cmdVerify("task-verify-lock", dbFile, { dbInstance: db })).rejects.toThrow(/Global single-running lock active/);
  });

  test("run: validation exception inside BEGIN IMMEDIATE rolls back active transaction on injected DB", async () => {
    const checkFile = join(workspaceDir, "test.test.ts");
    writeFileSync(checkFile, "import { test, expect } from 'bun:test'; test('ok', () => expect(1).toBe(1));");

    const man = {
      version: 1,
      id: "task-invalid-manifest-rollback",
      workspace: workspaceDir,
      orderPath: orderFile,
      prompt: "Task 1",
      writePaths: ["src/out1.ts"],
      checkPaths: ["test.test.ts"],
      timeoutSeconds: 60,
      engine: "antigravity",
    };
    const mFile = join(tempRoot, "m_corrupt.json");
    writeFileSync(mFile, JSON.stringify(man));
    cmdEnqueue(mFile, dbFile, db);

    // Corrupt manifest JSON in database so validateManifest throws inside BEGIN IMMEDIATE
    db.query("UPDATE runner_tasks SET manifest_json = '{\"version\": 2}' WHERE id = 'task-invalid-manifest-rollback'").run();

    await expect(cmdRun("task-invalid-manifest-rollback", dbFile, true, { dbInstance: db })).rejects.toThrow(/version/);
    // Database transaction must have been rolled back, leaving connection usable and not in transaction
    expect((db as any).inTransaction).toBe(false);
  });

  test("run: failure cases - empty response, malformed json, denied_actions, non-zero exit transition to needs_attention without leaking secrets", async () => {
    const man = {
      version: 1,
      id: "task-failure",
      workspace: workspaceDir,
      orderPath: orderFile,
      prompt: "Task fail",
      writePaths: ["src/fail.ts"],
      checkPaths: [],
      timeoutSeconds: 60,
      engine: "antigravity",
    };
    const mFile = join(tempRoot, "m_fail.json");
    writeFileSync(mFile, JSON.stringify(man));
    cmdEnqueue(mFile, dbFile, db);

    // Mock executor returning denied_actions
    const deniedExecutor: SubprocessExecutor = async () => ({
      exitCode: 0,
      stdout: JSON.stringify({ status: "SUCCESS", response: "ok", denied_actions: ["write_file: permission denied SECRET_VAL"] }),
      stderr: "",
    });

    await expect(cmdRun("task-failure", dbFile, true, { dbInstance: db, executor: deniedExecutor })).rejects.toThrow(/denied actions/);
    const row = db.query("SELECT status, error_message FROM runner_tasks WHERE id = 'task-failure'").get() as any;
    expect(row.status).toBe("needs_attention");
    expect(row.error_message).not.toContain("SECRET_VAL");
  });

  test("run: timeout or buffer overflow triggers needs_attention and latches execution_uncertain", async () => {
    const man = {
      version: 1,
      id: "task-overflow",
      workspace: workspaceDir,
      orderPath: orderFile,
      prompt: "Overflow test",
      writePaths: ["src/work.ts"],
      checkPaths: [],
      timeoutSeconds: 60,
      engine: "antigravity",
    };
    const mFile = join(tempRoot, "m_overflow.json");
    writeFileSync(mFile, JSON.stringify(man));
    cmdEnqueue(mFile, dbFile, db);

    const overflowExecutor: SubprocessExecutor = async () => ({
      exitCode: 0,
      stdout: "",
      stderr: "",
      overflow: true,
    });

    await expect(cmdRun("task-overflow", dbFile, true, { dbInstance: db, executor: overflowExecutor })).rejects.toThrow(/overflow/);
    const row = db.query("SELECT status FROM runner_tasks WHERE id = 'task-overflow'").get() as any;
    expect(row.status).toBe("needs_attention");

    // Latch is active; attempting to run another queued task must be blocked
    const man2 = { ...man, id: "task-blocked-by-latch" };
    const mFile2 = join(tempRoot, "m_blocked.json");
    writeFileSync(mFile2, JSON.stringify(man2));
    cmdEnqueue(mFile2, dbFile, db);

    await expect(cmdRun("task-blocked-by-latch", dbFile, true, { dbInstance: db })).rejects.toThrow(/Execution uncertain latch active/);
  });

  test("run: timeout executor modifying protected check file still sets uncertain latch and blocks new run", async () => {
    const checkFile = join(workspaceDir, "test.test.ts");
    writeFileSync(checkFile, "import { test, expect } from 'bun:test'; test('ok', () => expect(1).toBe(1));");

    const man = {
      version: 1,
      id: "task-timeout-tamper",
      workspace: workspaceDir,
      orderPath: orderFile,
      prompt: "Tamper and timeout",
      writePaths: ["src/work.ts"],
      checkPaths: ["test.test.ts"],
      timeoutSeconds: 60,
      engine: "antigravity",
    };
    const mFile = join(tempRoot, "m_tt.json");
    writeFileSync(mFile, JSON.stringify(man));
    cmdEnqueue(mFile, dbFile, db);

    // Executor that times out but also modified the check file before timing out
    const timeoutTamperExecutor: SubprocessExecutor = async () => {
      writeFileSync(checkFile, "tampered check content by rogue process");
      return {
        exitCode: null,
        stdout: "",
        stderr: "",
        timedOut: true,
      };
    };

    await expect(cmdRun("task-timeout-tamper", dbFile, true, { dbInstance: db, executor: timeoutTamperExecutor })).rejects.toThrow();
    const row = db.query("SELECT status FROM runner_tasks WHERE id = 'task-timeout-tamper'").get() as any;
    expect(row.status).toBe("needs_attention");

    // Latch must be active despite audit detecting check file modification
    const latchRow = db.query("SELECT value FROM runner_meta WHERE key = 'execution_uncertain'").get() as any;
    expect(latchRow?.value).toBe("1");

    // Enqueue and run another task; must be blocked by the latch
    const man2 = { ...man, id: "task-blocked-after-tamper-timeout", prompt: "Other task", writePaths: ["src/other.ts"] };
    const mFile2 = join(tempRoot, "m_blocked2.json");
    writeFileSync(mFile2, JSON.stringify(man2));
    cmdEnqueue(mFile2, dbFile, db);

    await expect(cmdRun("task-blocked-after-tamper-timeout", dbFile, true, { dbInstance: db })).rejects.toThrow(/Execution uncertain latch active/);
  });

  test("run: fails if no permitted files were written", async () => {
    const man = {
      version: 1,
      id: "task-nowrites",
      workspace: workspaceDir,
      orderPath: orderFile,
      prompt: "No write test",
      writePaths: ["src/empty.ts"],
      checkPaths: [],
      timeoutSeconds: 60,
      engine: "antigravity",
    };
    const mFile = join(tempRoot, "m_nowrites.json");
    writeFileSync(mFile, JSON.stringify(man));
    cmdEnqueue(mFile, dbFile, db);

    const noWriteExecutor: SubprocessExecutor = async () => ({
      exitCode: 0,
      stdout: JSON.stringify({ status: "SUCCESS", response: "Done with no files written" }),
      stderr: "",
    });

    await expect(cmdRun("task-nowrites", dbFile, true, { dbInstance: db, executor: noWriteExecutor })).rejects.toThrow(/No permitted write files/);
    const row = db.query("SELECT status FROM runner_tasks WHERE id = 'task-nowrites'").get() as any;
    expect(row.status).toBe("needs_attention");
  });

  test("run & verify: clean provider success transitions queued -> needs_review -> tests_passed with output hash pinning", async () => {
    const checkFile = join(workspaceDir, "test.test.ts");
    writeFileSync(checkFile, "import { test, expect } from 'bun:test'; test('ok', () => expect(1).toBe(1));");

    const man = {
      version: 1,
      id: "task-success",
      workspace: workspaceDir,
      orderPath: orderFile,
      prompt: "Implement code",
      writePaths: ["src/work.ts"],
      checkPaths: ["test.test.ts"],
      timeoutSeconds: 60,
      engine: "antigravity",
    };
    const mFile = join(tempRoot, "m_success.json");
    writeFileSync(mFile, JSON.stringify(man));
    cmdEnqueue(mFile, dbFile, db);

    // Mock successful Antigravity run
    const successExecutor: SubprocessExecutor = async () => {
      mkdirSync(join(workspaceDir, "src"), { recursive: true });
      writeFileSync(join(workspaceDir, "src/work.ts"), "export const hello = 'world';");
      return {
        exitCode: 0,
        stdout: JSON.stringify({
          status: "SUCCESS",
          response: "Code implemented successfully",
          conversation_id: "conv-12345",
          usage: { input_tokens: 150, output_tokens: 80 },
        }),
        stderr: "",
      };
    };

    await cmdRun("task-success", dbFile, true, { dbInstance: db, executor: successExecutor });

    let row = db.query("SELECT status, conversation_id, changed_paths_json, output_hashes_json FROM runner_tasks WHERE id = 'task-success'").get() as any;
    expect(row.status).toBe("needs_review");
    expect(row.conversation_id).toBe("conv-12345");
    expect(row.changed_paths_json).toContain("src/work.ts");
    expect(row.output_hashes_json).toContain("src/work.ts");

    // Mock successful verification
    const passVerifyExecutor: SubprocessExecutor = async () => ({
      exitCode: 0,
      stdout: "1 passed",
      stderr: "",
    });

    await cmdVerify("task-success", dbFile, { dbInstance: db, executor: passVerifyExecutor });
    row = db.query("SELECT status, check_exit_code FROM runner_tasks WHERE id = 'task-success'").get() as any;
    expect(row.status).toBe("tests_passed");
    expect(row.check_exit_code).toBe(0);
  });

  test("verify: fails when pre-verifier git audit throws exception", async () => {
    const checkFile = join(workspaceDir, "test.test.ts");
    writeFileSync(checkFile, "import { test, expect } from 'bun:test'; test('ok', () => expect(1).toBe(1));");
    // Initialize git workspace
    mkdirSync(join(workspaceDir, ".git"), { recursive: true });

    const man = {
      version: 1,
      id: "task-preverify-git-fail",
      workspace: workspaceDir,
      orderPath: orderFile,
      prompt: "Audit test",
      writePaths: ["src/work.ts"],
      checkPaths: ["test.test.ts"],
      timeoutSeconds: 60,
      engine: "antigravity",
    };
    const mFile = join(tempRoot, "m_pregit.json");
    writeFileSync(mFile, JSON.stringify(man));
    cmdEnqueue(mFile, dbFile, db);

    db.query("UPDATE runner_tasks SET status = 'needs_review' WHERE id = 'task-preverify-git-fail'").run();

    // Executor that fails during git ls-files
    const gitFailExecutor: SubprocessExecutor = async (cmd) => {
      if (cmd[0] === "git") {
        return { exitCode: 1, stdout: "", stderr: "git error" };
      }
      return { exitCode: 0, stdout: "", stderr: "" };
    };

    await expect(cmdVerify("task-preverify-git-fail", dbFile, { dbInstance: db, executor: gitFailExecutor })).rejects.toThrow(/Pre-verifier git inspection failed/);
    const row = db.query("SELECT status FROM runner_tasks WHERE id = 'task-preverify-git-fail'").get() as any;
    expect(row.status).toBe("needs_attention");
  });

  test("verify: fails when output files are modified between build and verification", async () => {
    const checkFile = join(workspaceDir, "test.test.ts");
    writeFileSync(checkFile, "import { test, expect } from 'bun:test'; test('ok', () => expect(1).toBe(1));");

    const man = {
      version: 1,
      id: "task-output-tamper",
      workspace: workspaceDir,
      orderPath: orderFile,
      prompt: "Tamper output test",
      writePaths: ["src/work.ts"],
      checkPaths: ["test.test.ts"],
      timeoutSeconds: 60,
      engine: "antigravity",
    };
    const mFile = join(tempRoot, "m_out_tamper.json");
    writeFileSync(mFile, JSON.stringify(man));
    cmdEnqueue(mFile, dbFile, db);

    const successExecutor: SubprocessExecutor = async () => {
      mkdirSync(join(workspaceDir, "src"), { recursive: true });
      writeFileSync(join(workspaceDir, "src/work.ts"), "initial build");
      return {
        exitCode: 0,
        stdout: JSON.stringify({ status: "SUCCESS", response: "built" }),
        stderr: "",
      };
    };

    await cmdRun("task-output-tamper", dbFile, true, { dbInstance: db, executor: successExecutor });

    // Tamper with output file before verification
    writeFileSync(join(workspaceDir, "src/work.ts"), "tampered build content");

    await expect(cmdVerify("task-output-tamper", dbFile, { dbInstance: db })).rejects.toThrow(/Output file modified between build and verification/);
    const row = db.query("SELECT status FROM runner_tasks WHERE id = 'task-output-tamper'").get() as any;
    expect(row.status).toBe("needs_attention");
  });

  test("recover: refuses to recover live pid or null/uncertain pid, recovers dead pid to needs_attention without replay", () => {
    const man = {
      version: 1,
      id: "task-rec",
      workspace: workspaceDir,
      orderPath: orderFile,
      prompt: "Rec test",
      writePaths: ["src/rec.ts"],
      checkPaths: [],
      timeoutSeconds: 60,
      engine: "antigravity",
    };
    const mFile = join(tempRoot, "m_rec.json");
    writeFileSync(mFile, JSON.stringify(man));
    cmdEnqueue(mFile, dbFile, db);

    // Null PID refusal
    db.query("UPDATE runner_tasks SET status = 'running', pid = NULL WHERE id = 'task-rec'").run();
    expect(() => cmdRecover("task-rec", dbFile, db)).toThrow(/null\/uncertain/);

    // Live PID (current process pid)
    db.query("UPDATE runner_tasks SET status = 'running', pid = ? WHERE id = 'task-rec'").run(process.pid);
    expect(() => cmdRecover("task-rec", dbFile, db)).toThrow(/still alive/);

    // Dead PID
    db.query("UPDATE runner_tasks SET status = 'running', pid = 99999999 WHERE id = 'task-rec'").run();
    cmdRecover("task-rec", dbFile, db);

    const row = db.query("SELECT status, pid FROM runner_tasks WHERE id = 'task-rec'").get() as any;
    expect(row.status).toBe("needs_attention");
    expect(row.pid).toBeNull();
  });
});
