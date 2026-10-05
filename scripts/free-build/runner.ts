import { Database } from "bun:sqlite";
import {
  existsSync,
  statSync,
  readFileSync,
  lstatSync,
  realpathSync,
} from "node:fs";
import {
  resolve,
  normalize,
  isAbsolute,
  dirname,
} from "node:path";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";

export const AG_EXE = "C:/Users/astha/AppData/Local/agy/bin/agy.exe";
export const BUN_EXE = "C:/Users/astha/.bun/bin/bun.exe";
export const GOOSE_EXE = "E:/yellow/goose/v1.51.0/dist-windows/resources/bin/goose.exe";
export const AG_LAUNCH_CWD = "D:/Yellow/temp/antigravity-quota-check-20260925";

export type RunnerStatus =
  | "queued"
  | "running"
  | "needs_attention"
  | "needs_review"
  | "tests_passed";

export interface TaskManifest {
  version: 1;
  id: string;
  workspace: string;
  orderPath: string;
  prompt: string;
  writePaths: string[];
  checkPaths: string[];
  timeoutSeconds: number;
  engine: "antigravity";
}

export interface TaskRecord {
  id: string;
  manifest_hash: string;
  manifest_json: string;
  status: RunnerStatus;
  conversation_id: string | null;
  pid: number | null;
  model_input_tokens: number | null;
  model_output_tokens: number | null;
  check_exit_code: number | null;
  check_duration_ms: number | null;
  changed_paths_json: string | null;
  check_hashes_json: string | null;
  output_hashes_json: string | null;
  created_at: string;
  updated_at: string;
  error_message: string | null;
}

export interface ExecutionResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut?: boolean;
  overflow?: boolean;
  spawnedPid?: number;
}

export type SubprocessExecutor = (
  cmd: string[],
  options: {
    cwd?: string;
    timeoutMs?: number;
    maxBufferBytes?: number;
    onSpawn?: (pid: number) => void;
  }
) => Promise<ExecutionResult>;

export const defaultExecutor: SubprocessExecutor = (cmd, options) => {
  return new Promise((resolvePromise) => {
    const maxBuffer = options.maxBufferBytes ?? 4 * 1024 * 1024;
    const timeoutMs = options.timeoutMs ?? 120_000;
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let overflow = false;
    let stdoutLen = 0;
    let stderrLen = 0;

    const child = spawn(cmd[0]!, cmd.slice(1), {
      cwd: options.cwd,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    if (child.pid && options.onSpawn) {
      try {
        options.onSpawn(child.pid);
      } catch (err) {
        try {
          child.kill();
        } catch {
          // ignore
        }
        resolvePromise({
          exitCode: -1,
          stdout: "",
          stderr: "",
          timedOut: false,
          overflow: false,
          spawnedPid: child.pid,
        });
        return;
      }
    }

    const timer = setTimeout(() => {
      timedOut = true;
      try {
        child.kill();
      } catch {
        // ignore
      }
    }, timeoutMs);

    child.stdout?.on("data", (chunk: Buffer) => {
      if (stdoutLen + chunk.length > maxBuffer) {
        overflow = true;
        try {
          child.kill();
        } catch {
          // ignore
        }
      } else {
        stdout += chunk.toString("utf8");
        stdoutLen += chunk.length;
      }
    });

    child.stderr?.on("data", (chunk: Buffer) => {
      if (stderrLen + chunk.length > maxBuffer) {
        overflow = true;
        try {
          child.kill();
        } catch {
          // ignore
        }
      } else {
        stderr += chunk.toString("utf8");
        stderrLen += chunk.length;
      }
    });

    child.on("error", () => {
      clearTimeout(timer);
      resolvePromise({
        exitCode: -1,
        stdout,
        stderr: "",
        timedOut,
        overflow,
        spawnedPid: child.pid,
      });
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      resolvePromise({
        exitCode: code,
        stdout,
        stderr: "",
        timedOut,
        overflow,
        spawnedPid: child.pid,
      });
    });
  });
};

export function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e: any) {
    return e.code === "EPERM";
  }
}

export function computeSha256(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

export function computeFileSha256(filePath: string): string | null {
  try {
    if (!existsSync(filePath)) return null;
    const buf = readFileSync(filePath);
    return computeSha256(buf);
  } catch {
    return null;
  }
}

const RESERVED_DEVICE_NAMES = new Set([
  "con",
  "prn",
  "aux",
  "nul",
  "com1",
  "com2",
  "com3",
  "com4",
  "com5",
  "com6",
  "com7",
  "com8",
  "com9",
  "lpt1",
  "lpt2",
  "lpt3",
  "lpt4",
  "lpt5",
  "lpt6",
  "lpt7",
  "lpt8",
  "lpt9",
]);

export function validateSafeRelativePath(relPath: string): string {
  if (typeof relPath !== "string") {
    throw new Error("Path must be a string");
  }
  if (relPath.includes("\0")) {
    throw new Error("Null byte in path");
  }
  if (relPath.includes(":")) {
    throw new Error("Alternate data stream or drive colon forbidden in path");
  }
  if (relPath.trim() === "" || relPath === "." || relPath === "./") {
    throw new Error("Empty or dot relative path forbidden");
  }
  if (isAbsolute(relPath) || /^[a-zA-Z]:/.test(relPath)) {
    throw new Error(`Path must be workspace-relative: ${relPath}`);
  }

  // Segment check before and after normalize to catch raw '..'
  const rawSegments = relPath.replace(/\\/g, "/").split("/");
  for (const seg of rawSegments) {
    if (seg === "..") {
      throw new Error(`Directory traversal segment '..' in path: ${relPath}`);
    }
  }

  const norm = normalize(relPath).replace(/\\/g, "/");
  if (norm.startsWith("../") || norm === ".." || norm.startsWith("/")) {
    throw new Error(`Directory traversal in path: ${relPath}`);
  }

  const parts = norm.split("/");
  for (const part of parts) {
    if (part === "" || part === ".") {
      throw new Error(`Invalid empty or dot segment in path: ${relPath}`);
    }
    if (part.endsWith(" ") || part.endsWith(".")) {
      throw new Error(`Trailing dot or space forbidden in path segment: ${part}`);
    }
    const low = part.toLowerCase();
    const baseWithoutExt = low.split(".")[0];
    if (RESERVED_DEVICE_NAMES.has(low) || (baseWithoutExt && RESERVED_DEVICE_NAMES.has(baseWithoutExt))) {
      throw new Error(`Reserved Windows device name forbidden: ${part}`);
    }
    if (
      low === ".git" ||
      low === "node_modules" ||
      low.startsWith(".env") ||
      low === "secrets" ||
      low.includes("secret") ||
      low.endsWith(".key") ||
      low.includes("attachment")
    ) {
      throw new Error(`Forbidden path segment '${part}' in ${relPath}`);
    }
  }

  return norm;
}

export function assertNoSymlinkEscape(workspace: string, relPath: string): void {
  const norm = validateSafeRelativePath(relPath);
  const segments = norm.split("/");
  let current = resolve(workspace);
  for (const seg of segments) {
    current = resolve(current, seg);
    if (existsSync(current)) {
      const lst = lstatSync(current);
      if (lst.isSymbolicLink()) {
        throw new Error(`Symlink escape detected at ${current}`);
      }
    }
  }
}

export function assertNoWorkspaceReparseEscape(workspace: string): string {
  const real = realpathSync(workspace);
  const normReal = resolve(real).replace(/\\/g, "/").toLowerCase();
  const normWs = resolve(workspace).replace(/\\/g, "/").toLowerCase();
  if (normReal !== normWs) {
    throw new Error(`Workspace path is a symlink, junction or reparse point: ${workspace} -> ${real}`);
  }
  return real;
}

export function validateManifest(raw: any): TaskManifest {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Manifest must be a JSON object");
  }
  const allowedKeys = new Set([
    "version",
    "id",
    "workspace",
    "orderPath",
    "prompt",
    "writePaths",
    "checkPaths",
    "timeoutSeconds",
    "engine",
  ]);
  for (const k of Object.keys(raw)) {
    if (!allowedKeys.has(k)) {
      throw new Error(`Unknown key in manifest: ${k}`);
    }
  }

  if (raw.version !== 1) {
    throw new Error(`Invalid manifest version: expected 1, got ${raw.version}`);
  }

  const { id, workspace, orderPath, prompt, writePaths, checkPaths, timeoutSeconds, engine } = raw;

  if (typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(id)) {
    throw new Error("Invalid id: must be safe ASCII alphanumeric, hyphen, underscore (<=64 chars)");
  }
  if (typeof workspace !== "string" || !isAbsolute(workspace) || !existsSync(workspace)) {
    throw new Error("Invalid workspace: must be an existing absolute directory");
  }
  if (!statSync(workspace).isDirectory()) {
    throw new Error("Workspace must be a directory");
  }
  assertNoWorkspaceReparseEscape(workspace);

  if (typeof orderPath !== "string" || !isAbsolute(orderPath) || !existsSync(orderPath)) {
    throw new Error("Invalid orderPath: must be an existing absolute file");
  }
  const orderStat = lstatSync(orderPath);
  if (orderStat.isSymbolicLink() || !orderStat.isFile()) {
    throw new Error("orderPath must be a regular non-symlink file");
  }

  if (typeof prompt !== "string" || prompt.trim().length === 0 || prompt.length > 6000) {
    throw new Error("Invalid prompt: must be non-whitespace 1..6000 chars");
  }
  if (
    typeof timeoutSeconds !== "number" ||
    !Number.isInteger(timeoutSeconds) ||
    !Number.isFinite(timeoutSeconds) ||
    timeoutSeconds < 30 ||
    timeoutSeconds > 600
  ) {
    throw new Error("Invalid timeoutSeconds: must be an integer between 30 and 600");
  }
  if (engine !== "antigravity") {
    throw new Error("Invalid engine: only 'antigravity' is supported in this slice");
  }

  if (!Array.isArray(writePaths) || writePaths.length < 1 || writePaths.length > 30) {
    throw new Error("writePaths must contain 1..30 paths");
  }
  if (!Array.isArray(checkPaths) || checkPaths.length > 10) {
    throw new Error("checkPaths must contain 0..10 paths");
  }

  const normWritePaths: string[] = [];
  const writeLowerSet = new Set<string>();
  for (const p of writePaths) {
    const norm = validateSafeRelativePath(p);
    assertNoSymlinkEscape(workspace, norm);
    const low = norm.toLowerCase();
    if (writeLowerSet.has(low)) {
      throw new Error(`Duplicate writePath detected (case-insensitive): ${p}`);
    }
    writeLowerSet.add(low);
    normWritePaths.push(norm);
  }

  const normCheckPaths: string[] = [];
  const checkLowerSet = new Set<string>();
  for (const p of checkPaths) {
    const norm = validateSafeRelativePath(p);
    assertNoSymlinkEscape(workspace, norm);
    const absPath = resolve(workspace, norm);
    if (!existsSync(absPath) || !statSync(absPath).isFile()) {
      throw new Error(`checkPath must be an existing file: ${p}`);
    }
    const low = norm.toLowerCase();
    if (
      !low.endsWith(".test.ts") &&
      !low.endsWith(".test.js") &&
      !low.endsWith(".test.tsx") &&
      !low.endsWith(".test.jsx") &&
      !low.endsWith(".spec.ts") &&
      !low.endsWith(".spec.js")
    ) {
      throw new Error(`checkPath must be a test file (*.test.ts, *.test.js, etc.): ${p}`);
    }
    if (checkLowerSet.has(low)) {
      throw new Error(`Duplicate checkPath detected (case-insensitive): ${p}`);
    }
    if (writeLowerSet.has(low)) {
      throw new Error(`checkPath overlaps with writePath: ${p}`);
    }
    checkLowerSet.add(low);
    normCheckPaths.push(norm);
  }

  return {
    version: 1,
    id,
    workspace: resolve(workspace).replace(/\\/g, "/"),
    orderPath: resolve(orderPath).replace(/\\/g, "/"),
    prompt,
    writePaths: normWritePaths,
    checkPaths: normCheckPaths,
    timeoutSeconds,
    engine,
  };
}

export function initDb(dbPath: string): Database {
  const normDb = resolve(dbPath);
  const parent = dirname(normDb);
  if (!existsSync(parent)) {
    throw new Error(`Database parent directory does not exist: ${parent}`);
  }
  const db = new Database(normDb);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec(`
    CREATE TABLE IF NOT EXISTS runner_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS runner_tasks (
      id TEXT PRIMARY KEY,
      manifest_hash TEXT NOT NULL,
      manifest_json TEXT NOT NULL,
      status TEXT NOT NULL,
      conversation_id TEXT,
      pid INTEGER,
      model_input_tokens INTEGER,
      model_output_tokens INTEGER,
      check_exit_code INTEGER,
      check_duration_ms INTEGER,
      changed_paths_json TEXT,
      check_hashes_json TEXT,
      output_hashes_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      error_message TEXT
    );
  `);
  return db;
}

export function checkExecutionUncertainLatch(db: Database): void {
  const row = db.query("SELECT value FROM runner_meta WHERE key = 'execution_uncertain'").get() as any;
  if (row && row.value === "1") {
    throw new Error("Execution uncertain latch active: database locked against new runs/verifications. Manual operator reconciliation required.");
  }
}

export function setExecutionUncertainLatch(db: Database): void {
  db.query("INSERT OR REPLACE INTO runner_meta (key, value) VALUES ('execution_uncertain', '1')").run();
}

export function buildAntigravityPrompt(manifest: TaskManifest): string {
  return [
    `TASK SPECIFICATION AND CONSTRAINTS FOR ORDER ${manifest.id}:`,
    `Workspace Directory: ${manifest.workspace}`,
    `Order Spec Reference: ${manifest.orderPath}`,
    `Allowed Write Paths (EXACTLY THESE FILES ONLY):`,
    ...manifest.writePaths.map((p) => `  - ${p}`),
    manifest.checkPaths.length > 0 ? `Read-only Verification Paths (DO NOT MODIFY):` : `No check paths specified.`,
    ...manifest.checkPaths.map((p) => `  - ${p}`),
    ``,
    `STRICT OPERATIONAL RULES:`,
    `1. You must ONLY edit or create the specified writePaths. Modifying any other file is strictly forbidden.`,
    `2. Never execute bash/powershell commands, scripts, or git commands.`,
    `3. Never modify credentials, auth tokens, external providers, permissions, or system configs.`,
    `4. Never trigger builds, package installations, or deployments.`,
    `5. Read and implement the following task instruction directly using file tools only:`,
    ``,
    manifest.prompt,
  ].join("\n");
}

export function buildAntigravityArgv(manifest: TaskManifest): string[] {
  const fullPrompt = buildAntigravityPrompt(manifest);
  return [
    AG_EXE,
    "--sandbox",
    "--mode",
    "accept-edits",
    "--model",
    "gemini-3.8-flash-low",
    "--effort",
    "low",
    "--print-timeout",
    `${manifest.timeoutSeconds}s`,
    "--output-format",
    "json",
    `--print=${fullPrompt}`,
  ];
}

export function buildGoosePlannerArgv(modelName: string, promptText: string): string[] {
  if (
    typeof modelName !== "string" ||
    modelName.toLowerCase().includes("cloud") ||
    modelName.startsWith("-") ||
    modelName.includes("://") ||
    !/^[a-zA-Z0-9._-]+(:[a-zA-Z0-9._-]+)?$/.test(modelName)
  ) {
    throw new Error(`Rejected unsafe/cloud/invalid goose model name: ${modelName}`);
  }
  return [
    GOOSE_EXE,
    "run",
    "--no-profile",
    "--with-builtin",
    "developer",
    "--provider",
    "ollama",
    "--model",
    modelName,
    "--max-turns",
    "8",
    "--max-tool-repetitions",
    "3",
    "--output-format",
    "json",
    "--text",
    promptText,
  ];
}

export interface GitSnapshotResult {
  fileCount: number;
  totalBytes: number;
  files: Map<string, string>;
}

export async function snapshotGitFiles(
  workspace: string,
  executor: SubprocessExecutor = defaultExecutor
): Promise<GitSnapshotResult | null> {
  const gitDir = resolve(workspace, ".git");
  if (!existsSync(gitDir)) return null;

  const res = await executor(
    ["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard"],
    { cwd: workspace, timeoutMs: 15000, maxBufferBytes: 4 * 1024 * 1024 }
  );
  if (res.timedOut || res.overflow || res.exitCode !== 0 || res.exitCode === null) {
    throw new Error("Git status inspection failed");
  }

  const entries = res.stdout.split("\0").filter(Boolean);
  if (entries.length > 5000) {
    throw new Error(`Git workspace exceeded bounded file limit (${entries.length} > 5000)`);
  }

  let totalBytes = 0;
  const maxBytes = 50 * 1024 * 1024;
  const map = new Map<string, string>();

  for (const rel of entries) {
    const norm = rel.replace(/\\/g, "/");
    const full = resolve(workspace, norm);
    if (!existsSync(full)) {
      map.set(norm, "MISSING");
      continue;
    }
    let st;
    try {
      st = statSync(full);
    } catch {
      throw new Error(`Failed to stat git file: ${norm}`);
    }
    totalBytes += st.size;
    if (totalBytes > maxBytes) {
      throw new Error(`Git workspace exceeded bounded byte limit (${totalBytes} > 50MB)`);
    }
    const hash = computeFileSha256(full);
    if (hash === null) {
      throw new Error(`Failed to read git file: ${norm}`);
    }
    map.set(norm, hash);
  }

  return { fileCount: entries.length, totalBytes, files: map };
}

export function snapshotPaths(workspace: string, paths: string[]): Map<string, string | null> {
  const map = new Map<string, string | null>();
  for (const p of paths) {
    const abs = resolve(workspace, p);
    map.set(p, computeFileSha256(abs));
  }
  return map;
}

export function cmdHelp(): void {
  console.log(`Order745 Free Coding Runner (Antigravity Engine Reuse)

Usage:
  bun scripts/free-build/runner.ts help
  bun scripts/free-build/runner.ts status [--db <path>]
  bun scripts/free-build/runner.ts enqueue --manifest <path> --db <path>
  bun scripts/free-build/runner.ts plan --id <id> --db <path>
  bun scripts/free-build/runner.ts run --id <id> --db <path> --execute
  bun scripts/free-build/runner.ts verify --id <id> --db <path>
  bun scripts/free-build/runner.ts recover --id <id> --db <path>
`);
}

export function cmdStatus(dbPath?: string, dbInstance?: Database): void {
  if (!dbPath) {
    console.log("No --db path provided. Status: empty.");
    return;
  }
  const normDb = resolve(dbPath);
  if (!existsSync(normDb)) {
    console.log(`Database does not exist at ${normDb}. Status: empty.`);
    return;
  }
  const db = dbInstance ?? new Database(normDb, { readonly: true });
  try {
    const tableExists = db
      .query("SELECT name FROM sqlite_master WHERE type='table' AND name='runner_tasks';")
      .get();
    if (!tableExists) {
      console.log("Database initialized without runner_tasks table. Status: empty.");
      return;
    }
    const tasks = db
      .query("SELECT id, status, updated_at, check_exit_code, conversation_id FROM runner_tasks ORDER BY created_at DESC;")
      .all() as any[];
    if (tasks.length === 0) {
      console.log("No tasks in database.");
      return;
    }
    console.log(`Found ${tasks.length} task(s):`);
    for (const t of tasks) {
      console.log(`- ID: ${t.id} | Status: ${t.status} | Updated: ${t.updated_at} | Conversation: ${t.conversation_id ?? "none"}`);
    }
  } finally {
    if (!dbInstance) db.close();
  }
}

export function cmdEnqueue(manifestPath: string, dbPath: string, dbInstance?: Database): void {
  const normManPath = resolve(manifestPath);
  if (!existsSync(normManPath)) {
    throw new Error(`Manifest file does not exist: ${normManPath}`);
  }
  const content = readFileSync(normManPath, "utf8");
  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("Failed to parse manifest JSON");
  }

  const manifest = validateManifest(parsed);
  const manifestStr = JSON.stringify(manifest);
  const manifestHash = computeSha256(manifestStr);

  const initialCheckHashes: Record<string, string> = {};
  for (const cp of manifest.checkPaths) {
    const full = resolve(manifest.workspace, cp);
    const hash = computeFileSha256(full);
    if (!hash) {
      throw new Error(`Failed to hash checkPath during enqueue: ${cp}`);
    }
    initialCheckHashes[cp] = hash;
  }
  const initialCheckHashesJson = JSON.stringify(initialCheckHashes);

  const db = dbInstance ?? initDb(dbPath);
  try {
    const existing = db
      .query("SELECT id, manifest_hash, status FROM runner_tasks WHERE id = ?")
      .get(manifest.id) as any;

    if (existing) {
      if (existing.manifest_hash === manifestHash) {
        console.log(`Task ${manifest.id} already enqueued with identical manifest (status: ${existing.status}). Idempotent no-op.`);
        return;
      } else {
        throw new Error(`Conflict: Task ${manifest.id} already exists with a different manifest hash.`);
      }
    }

    const now = new Date().toISOString();
    db.query(
      `INSERT INTO runner_tasks (id, manifest_hash, manifest_json, status, check_hashes_json, created_at, updated_at)
       VALUES (?, ?, ?, 'queued', ?, ?, ?)`
    ).run(manifest.id, manifestHash, manifestStr, initialCheckHashesJson, now, now);

    console.log(`Enqueued task ${manifest.id} successfully.`);
  } finally {
    if (!dbInstance) db.close();
  }
}

export function cmdPlan(id: string, dbPath: string, dbInstance?: Database): void {
  const db = dbInstance ?? initDb(dbPath);
  try {
    const row = db.query("SELECT * FROM runner_tasks WHERE id = ?").get(id) as TaskRecord | null;
    if (!row) {
      throw new Error(`Task ${id} not found.`);
    }
    const manifest = validateManifest(JSON.parse(row.manifest_json));
    const fullPrompt = buildAntigravityPrompt(manifest);
    const argv = buildAntigravityArgv(manifest);

    console.log(`--- EXECUTION PLAN FOR TASK ${id} ---`);
    console.log(`Engine: ${manifest.engine}`);
    console.log(`Workspace: ${manifest.workspace}`);
    console.log(`Order Spec: ${manifest.orderPath}`);
    console.log(`Allowed Write Paths (${manifest.writePaths.length}):`);
    for (const w of manifest.writePaths) console.log(`  - ${w}`);
    console.log(`Check Paths (${manifest.checkPaths.length}):`);
    for (const c of manifest.checkPaths) console.log(`  - ${c}`);
    console.log(`Timeout: ${manifest.timeoutSeconds}s`);
    console.log(`Launch CWD: ${AG_LAUNCH_CWD}`);
    console.log(`Argv:`);
    for (let i = 0; i < argv.length - 1; i++) console.log(`  [${i}] ${argv[i]}`);
    console.log(`  [${argv.length - 1}] --print=<SANITIZED PROMPT ${fullPrompt.length} chars>`);
    console.log(`Current State: ${row.status}`);
  } finally {
    if (!dbInstance) db.close();
  }
}

export async function cmdRun(
  id: string,
  dbPath: string,
  execute: boolean,
  options?: { dbInstance?: Database; executor?: SubprocessExecutor; now?: () => string }
): Promise<void> {
  if (!execute) {
    throw new Error("--execute flag is required to run the task.");
  }
  const db = options?.dbInstance ?? initDb(dbPath);
  const executor = options?.executor ?? defaultExecutor;
  const getNow = options?.now ?? (() => new Date().toISOString());

  checkExecutionUncertainLatch(db);

  let manifest: TaskManifest;
  let pinnedCheckHashes: Record<string, string> = {};

  try {
    db.exec("BEGIN IMMEDIATE;");
    const active = db.query("SELECT id FROM runner_tasks WHERE status = 'running'").get() as any;
    if (active) {
      throw new Error(`Another task is already running (${active.id}). Global single-running lock active.`);
    }

    const row = db.query("SELECT * FROM runner_tasks WHERE id = ?").get(id) as TaskRecord | null;
    if (!row) {
      throw new Error(`Task ${id} not found.`);
    }
    if (row.status !== "queued") {
      throw new Error(`Task ${id} cannot be run: current status is '${row.status}' (expected 'queued').`);
    }

    // Dynamic re-validation of manifest and paths (TOCTOU guard)
    manifest = validateManifest(JSON.parse(row.manifest_json));

    if (row.check_hashes_json) {
      try {
        pinnedCheckHashes = JSON.parse(row.check_hashes_json);
      } catch {
        pinnedCheckHashes = {};
      }
    }

    // Verify pinned check hashes BEFORE builder launch
    for (const cp of manifest.checkPaths) {
      const full = resolve(manifest.workspace, cp);
      const curHash = computeFileSha256(full);
      const pinned = pinnedCheckHashes[cp];
      if (!pinned || curHash !== pinned) {
        throw new Error("Check file tampered before build execution");
      }
    }

    const now = getNow();
    db.query("UPDATE runner_tasks SET status = 'running', updated_at = ? WHERE id = ?").run(now, id);
    db.exec("COMMIT;");
  } catch (e: any) {
    if ((db as any).inTransaction) {
      try {
        db.exec("ROLLBACK;");
      } catch {
        // ignore rollback errors
      }
    }
    if (e.message === "Check file tampered before build execution") {
      const now = getNow();
      db.query(
        "UPDATE runner_tasks SET status = 'needs_attention', error_message = ?, updated_at = ? WHERE id = ?"
      ).run("Check file tampered before build execution", now, id);
    }
    if (!options?.dbInstance) db.close();
    throw e;
  }

  // Pre-run snapshots
  const initialWrites = snapshotPaths(manifest.workspace, manifest.writePaths);
  let initialGit: GitSnapshotResult | null = null;
  try {
    initialGit = await snapshotGitFiles(manifest.workspace, executor);
  } catch {
    const now = getNow();
    db.query(
      "UPDATE runner_tasks SET status = 'needs_attention', pid = NULL, error_message = ?, updated_at = ? WHERE id = ?"
    ).run("Pre-run git check failed", now, id);
    if (!options?.dbInstance) db.close();
    throw new Error("Pre-run git check failed");
  }

  const argv = buildAntigravityArgv(manifest);
  let execRes: ExecutionResult;
  try {
    execRes = await executor(argv, {
      cwd: AG_LAUNCH_CWD,
      timeoutMs: manifest.timeoutSeconds * 1000,
      maxBufferBytes: 4 * 1024 * 1024,
      onSpawn: (childPid) => {
        try {
          db.query("UPDATE runner_tasks SET pid = ? WHERE id = ?").run(childPid, id);
        } catch {
          // ignore
        }
      },
    });
  } catch {
    execRes = {
      exitCode: -1,
      stdout: "",
      stderr: "",
      timedOut: false,
    };
  }

  const now = getNow();

  // Failure ordering: persist execution_uncertain latch immediately on timedOut, overflow, or signal/nullcode
  if (execRes.overflow || execRes.timedOut || execRes.exitCode === null) {
    setExecutionUncertainLatch(db);
  }

  // Revalidate manifest immediately after executor result before snapshotGitFiles or snapshotPaths
  try {
    validateManifest(manifest);
  } catch (postValErr: any) {
    db.query(
      "UPDATE runner_tasks SET status = 'needs_attention', pid = NULL, error_message = ?, updated_at = ? WHERE id = ?"
    ).run("Post-builder workspace/path revalidation failed", now, id);
    if (!options?.dbInstance) db.close();
    throw new Error("Post-builder workspace/path revalidation failed");
  }

  // Audit git diffs regardless of whether execution succeeded or failed
  let gitTampered = false;
  if (initialGit) {
    try {
      const postGit = await snapshotGitFiles(manifest.workspace, executor);
      if (!postGit) {
        gitTampered = true;
      } else {
        const allowedWriteSet = new Set(manifest.writePaths.map((p) => p.toLowerCase()));
        const allKeys = new Set([...initialGit.files.keys(), ...postGit.files.keys()]);
        for (const k of allKeys) {
          const initH = initialGit.files.get(k);
          const postH = postGit.files.get(k);
          if (initH !== postH && !allowedWriteSet.has(k.toLowerCase())) {
            gitTampered = true;
            break;
          }
        }
      }
    } catch {
      gitTampered = true;
    }
  }

  if (gitTampered) {
    db.query(
      "UPDATE runner_tasks SET status = 'needs_attention', pid = NULL, error_message = ?, updated_at = ? WHERE id = ?"
    ).run("Out-of-scope workspace modification detected during diff audit", now, id);
    if (!options?.dbInstance) db.close();
    throw new Error("Out-of-scope workspace modification detected during diff audit");
  }

  // Audit checkPaths were not modified
  for (const cp of manifest.checkPaths) {
    const full = resolve(manifest.workspace, cp);
    const postH = computeFileSha256(full);
    if (postH !== pinnedCheckHashes[cp]) {
      db.query(
        "UPDATE runner_tasks SET status = 'needs_attention', pid = NULL, error_message = ?, updated_at = ? WHERE id = ?"
      ).run("Check file tampered during build execution", now, id);
      if (!options?.dbInstance) db.close();
      throw new Error("Check file tampered during build execution");
    }
  }

  if (execRes.overflow || execRes.timedOut || execRes.exitCode === null) {
    const msg = execRes.overflow
      ? "Subprocess buffer limit exceeded (4MiB overflow)"
      : execRes.timedOut
      ? "Subprocess execution timed out"
      : "Subprocess exited via signal/nullcode";
    db.query(
      "UPDATE runner_tasks SET status = 'needs_attention', pid = NULL, error_message = ?, updated_at = ? WHERE id = ?"
    ).run(msg, now, id);
    if (!options?.dbInstance) db.close();
    throw new Error(msg);
  }

  if (execRes.exitCode !== 0) {
    const msg = `Subprocess exited with failure code (${execRes.exitCode})`;
    db.query(
      "UPDATE runner_tasks SET status = 'needs_attention', pid = NULL, error_message = ?, updated_at = ? WHERE id = ?"
    ).run(msg, now, id);
    if (!options?.dbInstance) db.close();
    throw new Error(msg);
  }

  // Validate Provider JSON Envelope
  let parsedOutput: any;
  try {
    const trimmed = execRes.stdout.trim();
    if (!trimmed) {
      throw new Error("Empty response");
    }
    parsedOutput = JSON.parse(trimmed);
  } catch {
    const msg = "Malformed or empty JSON envelope returned by provider";
    db.query(
      "UPDATE runner_tasks SET status = 'needs_attention', pid = NULL, error_message = ?, updated_at = ? WHERE id = ?"
    ).run(msg, now, id);
    if (!options?.dbInstance) db.close();
    throw new Error(msg);
  }

  if (
    !parsedOutput ||
    typeof parsedOutput !== "object" ||
    Array.isArray(parsedOutput) ||
    parsedOutput.status !== "SUCCESS" ||
    typeof parsedOutput.response !== "string" ||
    parsedOutput.response.trim().length === 0
  ) {
    const msg = "Provider envelope missing SUCCESS status or non-empty response";
    db.query(
      "UPDATE runner_tasks SET status = 'needs_attention', pid = NULL, error_message = ?, updated_at = ? WHERE id = ?"
    ).run(msg, now, id);
    if (!options?.dbInstance) db.close();
    throw new Error(msg);
  }

  if ("denied_actions" in parsedOutput) {
    if (!Array.isArray(parsedOutput.denied_actions) || parsedOutput.denied_actions.length > 0) {
      const msg = "Provider returned denied actions or malformed denied_actions";
      db.query(
        "UPDATE runner_tasks SET status = 'needs_attention', pid = NULL, error_message = ?, updated_at = ? WHERE id = ?"
      ).run(msg, now, id);
      if (!options?.dbInstance) db.close();
      throw new Error(msg);
    }
  }

  // Snapshot produced write paths and detect changes
  const changedPaths: string[] = [];
  const outputHashes: Record<string, string | null> = {};
  for (const [p, h] of initialWrites.entries()) {
    const postH = computeFileSha256(resolve(manifest.workspace, p));
    outputHashes[p] = postH;
    if (postH !== h) {
      changedPaths.push(p);
    }
  }

  if (changedPaths.length === 0) {
    const msg = "No permitted write files were created or modified by provider";
    db.query(
      "UPDATE runner_tasks SET status = 'needs_attention', pid = NULL, error_message = ?, updated_at = ? WHERE id = ?"
    ).run(msg, now, id);
    if (!options?.dbInstance) db.close();
    throw new Error(msg);
  }

  const convId = typeof parsedOutput.conversation_id === "string" ? parsedOutput.conversation_id : null;
  const inTokens = typeof parsedOutput.usage?.input_tokens === "number" ? parsedOutput.usage.input_tokens : null;
  const outTokens = typeof parsedOutput.usage?.output_tokens === "number" ? parsedOutput.usage.output_tokens : null;

  db.query(
    `UPDATE runner_tasks
     SET status = 'needs_review',
         pid = NULL,
         conversation_id = ?,
         model_input_tokens = ?,
         model_output_tokens = ?,
         changed_paths_json = ?,
         output_hashes_json = ?,
         error_message = NULL,
         updated_at = ?
     WHERE id = ?`
  ).run(convId, inTokens, outTokens, JSON.stringify(changedPaths), JSON.stringify(outputHashes), now, id);

  console.log(`Task ${id} completed build execution. Status: needs_review.`);
  if (!options?.dbInstance) db.close();
}

export async function cmdVerify(
  id: string,
  dbPath: string,
  options?: { dbInstance?: Database; executor?: SubprocessExecutor; now?: () => string }
): Promise<void> {
  const db = options?.dbInstance ?? initDb(dbPath);
  const executor = options?.executor ?? defaultExecutor;
  const getNow = options?.now ?? (() => new Date().toISOString());

  checkExecutionUncertainLatch(db);

  let manifest: TaskManifest;
  let pinnedCheckHashes: Record<string, string> = {};
  let pinnedOutputHashes: Record<string, string | null> = {};

  try {
    db.exec("BEGIN IMMEDIATE;");
    const active = db.query("SELECT id FROM runner_tasks WHERE status = 'running'").get() as any;
    if (active) {
      throw new Error(`Another task is already running (${active.id}). Global single-running lock active.`);
    }

    const row = db.query("SELECT * FROM runner_tasks WHERE id = ?").get(id) as TaskRecord | null;
    if (!row) {
      throw new Error(`Task ${id} not found.`);
    }
    if (row.status !== "needs_review") {
      throw new Error(`Task ${id} cannot be verified: current status is '${row.status}' (expected 'needs_review').`);
    }

    // Dynamic re-validation of manifest and paths
    manifest = validateManifest(JSON.parse(row.manifest_json));

    if (row.check_hashes_json) {
      try {
        pinnedCheckHashes = JSON.parse(row.check_hashes_json);
      } catch {
        pinnedCheckHashes = {};
      }
    }

    if (row.output_hashes_json) {
      try {
        pinnedOutputHashes = JSON.parse(row.output_hashes_json);
      } catch {
        pinnedOutputHashes = {};
      }
    }

    // Verify pinned check hashes BEFORE verifier launch
    for (const cp of manifest.checkPaths) {
      const full = resolve(manifest.workspace, cp);
      const curH = computeFileSha256(full);
      if (!pinnedCheckHashes[cp] || curH !== pinnedCheckHashes[cp]) {
        throw new Error("Check file tampered before verifier execution");
      }
    }

    // Verify output files have not changed between build and verify
    for (const wp of manifest.writePaths) {
      const full = resolve(manifest.workspace, wp);
      const curH = computeFileSha256(full);
      const pinned = pinnedOutputHashes[wp] ?? null;
      if (curH !== pinned) {
        throw new Error("Output file modified between build and verification");
      }
    }

    const now = getNow();
    db.query("UPDATE runner_tasks SET status = 'running', updated_at = ? WHERE id = ?").run(now, id);
    db.exec("COMMIT;");
  } catch (e: any) {
    if ((db as any).inTransaction) {
      try {
        db.exec("ROLLBACK;");
      } catch {
        // ignore rollback errors
      }
    }
    if (
      e.message === "Check file tampered before verifier execution" ||
      e.message === "Output file modified between build and verification"
    ) {
      const now = getNow();
      db.query(
        "UPDATE runner_tasks SET status = 'needs_attention', error_message = ?, updated_at = ? WHERE id = ?"
      ).run(e.message, now, id);
    }
    if (!options?.dbInstance) db.close();
    throw e;
  }

  if (manifest.checkPaths.length === 0) {
    const now = getNow();
    db.query("UPDATE runner_tasks SET status = 'needs_review', updated_at = ? WHERE id = ?").run(now, id);
    console.log(`Task ${id} has no checkPaths. Requires independent human verification. Remains needs_review.`);
    if (!options?.dbInstance) db.close();
    return;
  }

  // Pre-verifier git snapshot: fail-closed to needs_attention on any error
  let preGit: GitSnapshotResult | null = null;
  try {
    preGit = await snapshotGitFiles(manifest.workspace, executor);
  } catch {
    const now = getNow();
    db.query(
      "UPDATE runner_tasks SET status = 'needs_attention', pid = NULL, error_message = ?, updated_at = ? WHERE id = ?"
    ).run("Pre-verifier git inspection failed", now, id);
    if (!options?.dbInstance) db.close();
    throw new Error("Pre-verifier git inspection failed");
  }

  // Pass absolute paths to Bun test so filenames cannot be misinterpreted as flags
  const testCmd = [BUN_EXE, "test", ...manifest.checkPaths.map((cp) => resolve(manifest.workspace, cp))];
  const startTime = Date.now();
  let res: ExecutionResult;
  try {
    res = await executor(testCmd, {
      cwd: manifest.workspace,
      timeoutMs: 60_000,
      maxBufferBytes: 4 * 1024 * 1024,
      onSpawn: (childPid) => {
        try {
          db.query("UPDATE runner_tasks SET pid = ? WHERE id = ?").run(childPid, id);
        } catch {
          // ignore
        }
      },
    });
  } catch {
    res = {
      exitCode: -1,
      stdout: "",
      stderr: "",
      timedOut: false,
    };
  }

  const durationMs = Date.now() - startTime;
  const now = getNow();

  // Failure ordering: persist execution_uncertain latch immediately on timedOut, overflow, or signal/nullcode
  if (res.timedOut || res.overflow || res.exitCode === null) {
    setExecutionUncertainLatch(db);
  }

  // Revalidate manifest immediately after executor result before audits
  try {
    validateManifest(manifest);
  } catch (postValErr: any) {
    db.query(
      "UPDATE runner_tasks SET status = 'needs_attention', pid = NULL, error_message = ?, updated_at = ? WHERE id = ?"
    ).run("Post-verifier workspace/path revalidation failed", now, id);
    if (!options?.dbInstance) db.close();
    throw new Error("Post-verifier workspace/path revalidation failed");
  }

  // Audit checkPaths were not modified during verification
  for (const cp of manifest.checkPaths) {
    const full = resolve(manifest.workspace, cp);
    const postH = computeFileSha256(full);
    if (postH !== pinnedCheckHashes[cp]) {
      db.query(
        "UPDATE runner_tasks SET status = 'needs_attention', pid = NULL, error_message = ?, updated_at = ? WHERE id = ?"
      ).run("Check path modified during verification execution", now, id);
      if (!options?.dbInstance) db.close();
      throw new Error("Check path modified during verification execution");
    }
  }

  // Audit output files were not modified during verification
  for (const wp of manifest.writePaths) {
    const full = resolve(manifest.workspace, wp);
    const postH = computeFileSha256(full);
    if (postH !== (pinnedOutputHashes[wp] ?? null)) {
      db.query(
        "UPDATE runner_tasks SET status = 'needs_attention', pid = NULL, error_message = ?, updated_at = ? WHERE id = ?"
      ).run("Output file modified during verification execution", now, id);
      if (!options?.dbInstance) db.close();
      throw new Error("Output file modified during verification execution");
    }
  }

  // Audit git files untouched during verification
  if (preGit) {
    try {
      const postGit = await snapshotGitFiles(manifest.workspace, executor);
      if (!postGit) {
        throw new Error("Workspace git audit failed after verification: missing git metadata");
      }
      const allKeys = new Set([...preGit.files.keys(), ...postGit.files.keys()]);
      for (const k of allKeys) {
        if (preGit.files.get(k) !== postGit.files.get(k)) {
          throw new Error("Workspace files modified during verification execution");
        }
      }
    } catch (e: any) {
      db.query(
        "UPDATE runner_tasks SET status = 'needs_attention', pid = NULL, error_message = ?, updated_at = ? WHERE id = ?"
      ).run(e.message ?? "Workspace git audit failed after verification", now, id);
      if (!options?.dbInstance) db.close();
      throw e;
    }
  }

  if (res.timedOut || res.overflow || res.exitCode === null) {
    const msg = res.timedOut
      ? "Verification test timed out"
      : res.overflow
      ? "Verification test exceeded buffer limit"
      : "Verification test exited via signal/nullcode";
    db.query(
      `UPDATE runner_tasks
       SET status = 'needs_attention',
           pid = NULL,
           check_exit_code = ?,
           check_duration_ms = ?,
           error_message = ?,
           updated_at = ?
       WHERE id = ?`
    ).run(res.exitCode, durationMs, msg, now, id);
    if (!options?.dbInstance) db.close();
    throw new Error(msg);
  }

  if (res.exitCode !== 0) {
    const msg = `Verifier tests failed with exit code (${res.exitCode})`;
    db.query(
      `UPDATE runner_tasks
       SET status = 'needs_attention',
           pid = NULL,
           check_exit_code = ?,
           check_duration_ms = ?,
           error_message = ?,
           updated_at = ?
       WHERE id = ?`
    ).run(res.exitCode, durationMs, msg, now, id);
    if (!options?.dbInstance) db.close();
    throw new Error(msg);
  }

  db.query(
    `UPDATE runner_tasks
     SET status = 'tests_passed',
         pid = NULL,
         check_exit_code = 0,
         check_duration_ms = ?,
         error_message = NULL,
         updated_at = ?
     WHERE id = ?`
  ).run(durationMs, now, id);

  console.log(`Task ${id} passed verifier tests. Status: tests_passed (requires independent review).`);
  if (!options?.dbInstance) db.close();
}

export function cmdRecover(id: string, dbPath: string, dbInstance?: Database): void {
  const db = dbInstance ?? initDb(dbPath);
  try {
    const row = db.query("SELECT * FROM runner_tasks WHERE id = ?").get(id) as TaskRecord | null;
    if (!row) {
      throw new Error(`Task ${id} not found.`);
    }
    if (row.status !== "running") {
      console.log(`Task ${id} is not in 'running' state (status is '${row.status}'). Nothing to recover.`);
      return;
    }

    if (row.pid === null) {
      throw new Error(
        `Cannot recover task ${id}: worker PID is null/uncertain. Refusing recovery to prevent orphaning live tasks.`
      );
    }

    if (isPidAlive(row.pid)) {
      throw new Error(
        `Cannot recover task ${id}: worker process PID ${row.pid} is still alive. Refusing recovery of live child.`
      );
    }

    const now = new Date().toISOString();
    db.query(
      `UPDATE runner_tasks
       SET status = 'needs_attention',
           pid = NULL,
           error_message = 'Interrupted execution recovered to needs_attention; manual reconciliation required.',
           updated_at = ?
       WHERE id = ?`
    ).run(now, id);

    console.log(`Task ${id} recovered to 'needs_attention'. Interrupted task will not auto-replay.`);
  } finally {
    if (!dbInstance) db.close();
  }
}

export async function main(argv: string[]): Promise<void> {
  const command = argv[2] || "help";

  function getArg(flag: string): string | undefined {
    const idx = argv.indexOf(flag);
    if (idx !== -1 && idx + 1 < argv.length) {
      return argv[idx + 1];
    }
    return undefined;
  }

  try {
    switch (command) {
      case "help":
      case "--help":
      case "-h":
        cmdHelp();
        break;
      case "status":
        cmdStatus(getArg("--db"));
        break;
      case "enqueue": {
        const manifest = getArg("--manifest");
        const db = getArg("--db");
        if (!manifest || !db) {
          throw new Error("enqueue requires --manifest <path> and --db <path>");
        }
        cmdEnqueue(manifest, db);
        break;
      }
      case "plan": {
        const id = getArg("--id");
        const db = getArg("--db");
        if (!id || !db) {
          throw new Error("plan requires --id <id> and --db <path>");
        }
        cmdPlan(id, db);
        break;
      }
      case "run": {
        const id = getArg("--id");
        const db = getArg("--db");
        const execute = argv.includes("--execute");
        if (!id || !db) {
          throw new Error("run requires --id <id>, --db <path> and --execute");
        }
        await cmdRun(id, db, execute);
        break;
      }
      case "verify": {
        const id = getArg("--id");
        const db = getArg("--db");
        if (!id || !db) {
          throw new Error("verify requires --id <id> and --db <path>");
        }
        await cmdVerify(id, db);
        break;
      }
      case "recover": {
        const id = getArg("--id");
        const db = getArg("--db");
        if (!id || !db) {
          throw new Error("recover requires --id <id> and --db <path>");
        }
        cmdRecover(id, db);
        break;
      }
      default:
        cmdHelp();
        process.exit(1);
    }
  } catch (err: any) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

if (import.meta.main) {
  main(process.argv);
}
