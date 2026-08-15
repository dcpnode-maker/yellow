import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const DATABASE_NAME_PATTERN = /^yellow_[a-z0-9_]+$/;
const RESTRICT = /^\\restrict ([A-Za-z0-9]+)$/;
const UNRESTRICT = /^\\unrestrict ([A-Za-z0-9]+)$/;
const SNAPSHOT = resolve(import.meta.dir, "..", "tests", "schema", "expected.sql");

export function normalizeSchemaDump(input: string, requireWrapperPair = false): string {
  const lines = input.replaceAll("\r\n", "\n").replaceAll("\r", "\n").split("\n");
  const restrict: Array<{ index: number; token: string }> = [];
  const unrestrict: Array<{ index: number; token: string }> = [];

  for (const [index, line] of lines.entries()) {
    const opening = line.match(RESTRICT);
    if (opening?.[1]) restrict.push({ index, token: opening[1] });
    const closing = line.match(UNRESTRICT);
    if (closing?.[1]) unrestrict.push({ index, token: closing[1] });
    if ((line.startsWith("\\restrict") && !opening) || (line.startsWith("\\unrestrict") && !closing)) {
      throw new Error(`Malformed pg_dump restrict wrapper at line ${index + 1}`);
    }
  }

  if (restrict.length === 0 && unrestrict.length === 0 && !requireWrapperPair) {
    return `${lines.join("\n").replace(/\n+$/, "")}\n`;
  }
  if (restrict.length !== 1 || unrestrict.length !== 1) {
    throw new Error(`Expected exactly one pg_dump restrict/unrestrict wrapper pair; found ${restrict.length}/${unrestrict.length}`);
  }
  if (restrict[0]!.token !== unrestrict[0]!.token) throw new Error("pg_dump restrict wrapper tokens do not match");
  if (restrict[0]!.index >= unrestrict[0]!.index) throw new Error("pg_dump restrict wrappers are out of order");

  const removed = lines.filter((_, index) => index !== restrict[0]!.index && index !== unrestrict[0]!.index);
  return `${removed.join("\n").replace(/\n+$/, "")}\n`;
}

export function schemaMismatch(actual: string, expected: string): string | null {
  if (actual === expected) return null;
  const actualLines = actual.split("\n");
  const expectedLines = expected.split("\n");
  const limit = Math.max(actualLines.length, expectedLines.length);
  for (let index = 0; index < limit; index += 1) {
    if (actualLines[index] !== expectedLines[index]) {
      return `Schema drift at line ${index + 1}\nexpected: ${expectedLines[index] ?? "<EOF>"}\nactual:   ${actualLines[index] ?? "<EOF>"}`;
    }
  }
  return "Schema drift detected";
}

async function captureDump(databaseName: string): Promise<string> {
  if (!DATABASE_NAME_PATTERN.test(databaseName)) {
    throw new Error(`Invalid YELLOW_SCHEMA_DATABASE: ${databaseName}`);
  }
  const child = Bun.spawn([
    "docker", "compose", "exec", "-T", "postgres",
    "pg_dump", "--username", "yellow", "--dbname", databaseName,
    "--schema-only", "--no-owner", "--no-comments",
  ], { stdout: "pipe", stderr: "pipe" });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  if (exitCode !== 0) throw new Error(`pg_dump failed (${exitCode}): ${stderr.trim()}`);
  return normalizeSchemaDump(stdout, true);
}

async function runCli(): Promise<void> {
  const mode = process.argv[2];
  if (mode !== "--print" && mode !== "--check") {
    throw new Error("Usage: bun scripts/schema-drift.ts --print|--check");
  }
  const databaseName = process.env.YELLOW_SCHEMA_DATABASE;
  if (!databaseName) throw new Error("YELLOW_SCHEMA_DATABASE is required");
  const actual = await captureDump(databaseName);
  if (mode === "--print") {
    process.stdout.write(actual);
    return;
  }
  const expected = await readFile(SNAPSHOT, "utf8");
  const mismatch = schemaMismatch(actual, expected);
  if (mismatch) throw new Error(mismatch);
  console.log(`Schema matches ${SNAPSHOT}`);
}

if (import.meta.main) {
  try {
    await runCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
