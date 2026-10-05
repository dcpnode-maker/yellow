import { lstatSync, readFileSync, realpathSync, writeFileSync, existsSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import {
  composePropertyProfileEvidence,
  parsePublicPropertyCapture,
  sanitizePublicCaptureUrl,
  type PublicPropertyCaptureInput,
  type PropertyProfileObservation,
} from "../../src/contexts/distribution";

const MAX_INPUT_BYTES = 8 * 1024 * 1024;
const MAX_CAPTURES = 64;

export class PropertyProfileCaptureCliError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "PropertyProfileCaptureCliError";
  }
}

function fail(code: string): never { throw new PropertyProfileCaptureCliError(code); }

function plain(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function onlyKeys(value: Record<string, unknown>, allowed: readonly string[]): void {
  if (Object.keys(value).some(key => !allowed.includes(key))) fail("unknown_input_field");
}

function inputPath(path: string): string {
  const resolved = resolve(path);
  const stat = lstatSync(resolved);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_INPUT_BYTES) fail("invalid_input_file");
  return resolved;
}

function safeOutputPath(path: string, input: string): string {
  const resolved = resolve(path);
  if (resolved === input || existsSync(resolved) || !basename(resolved)) fail("invalid_output_path");
  const parent = realpathSync(dirname(resolved));
  if (parent !== resolve(dirname(resolved))) fail("output_parent_symlink");
  return resolved;
}

function cliPaths(args: readonly string[]): { input: string; output: string } {
  let input: string | null = null;
  let output: string | null = null;
  for (let index = 0; index < args.length; index += 1) {
    const key = args[index];
    const value = args[index + 1];
    if ((key !== "--input" && key !== "--output") || !value || value.startsWith("--")) fail("invalid_arguments");
    if (key === "--input") {
      if (input !== null) fail("duplicate_argument");
      input = value;
    } else {
      if (output !== null) fail("duplicate_argument");
      output = value;
    }
    index += 1;
  }
  if (input === null || output === null) fail("missing_argument");
  return { input: inputPath(input), output: safeOutputPath(output, inputPath(input)) };
}

function decodeInput(bytes: Uint8Array): unknown {
  let text: string;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { fail("invalid_input_utf8"); }
  try { return JSON.parse(text) as unknown; }
  catch { fail("invalid_input_json"); }
}

/** Processes already captured HTML only. No networking, credential lookup, or database access. */
export async function runPropertyProfileCaptureCli(args: readonly string[]): Promise<Readonly<{
  status: "complete" | "incomplete";
  captureCount: number;
  observationCount: number;
  profileCount: number;
  outputPath: string;
}>> {
  const paths = cliPaths(args);
  const inputBytes = readFileSync(paths.input);
  if (inputBytes.byteLength > MAX_INPUT_BYTES) fail("input_too_large");
  const parsed = decodeInput(inputBytes);
  if (!plain(parsed)) fail("invalid_input");
  onlyKeys(parsed, ["captures"]);
  if (!Array.isArray(parsed.captures) || parsed.captures.length < 1 || parsed.captures.length > MAX_CAPTURES) fail("invalid_captures");

  const observations: PropertyProfileObservation[] = [];
  const captureReceipts: Array<Readonly<{
    sourceUrl: string | null;
    finalUrl: string | null;
    httpStatus: number;
    capturedAt: string;
    contentSha256: string;
    utf8Bytes: number | null;
    observationCount: number;
    issues: readonly unknown[];
  }>> = [];
  for (const raw of parsed.captures) {
    if (!plain(raw)) fail("invalid_capture");
    onlyKeys(raw, ["sourceUrl", "finalUrl", "httpStatus", "status", "capturedAt", "body", "provider", "accountNamespace"]);
    const capture = raw as unknown as PublicPropertyCaptureInput;
    const result = await parsePublicPropertyCapture(capture);
    observations.push(...result.observations);
    captureReceipts.push(Object.freeze({
      sourceUrl: result.observations[0]?.source.sourceUrl ?? sanitizePublicCaptureUrl(raw.sourceUrl),
      finalUrl: result.observations[0]?.source.finalUrl ?? sanitizePublicCaptureUrl(raw.finalUrl),
      httpStatus: typeof raw.httpStatus === "number" ? raw.httpStatus : typeof raw.status === "number" ? raw.status : 0,
      capturedAt: typeof raw.capturedAt === "string" ? raw.capturedAt : "",
      contentSha256: result.contentSha256,
      utf8Bytes: result.utf8Bytes,
      observationCount: result.observations.length,
      issues: result.issues,
    }));
  }
  const composed = observations.length === 0
    ? { drafts: [], issues: [] } as const
    : composePropertyProfileEvidence({ observations });
  const issues = [...captureReceipts.flatMap(receipt => receipt.issues), ...composed.issues];
  const draft = Object.freeze({
    schemaVersion: "yellow.property-profile-capture-draft/v1",
    status: issues.length === 0 && composed.drafts.length > 0 ? "complete" : "incomplete",
    sourceAuthority: "public-capture-only",
    operationalWrites: false,
    captures: Object.freeze(captureReceipts),
    profiles: composed.drafts,
    issues: Object.freeze(issues),
  });
  writeFileSync(paths.output, JSON.stringify(draft, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  return Object.freeze({
    status: issues.length === 0 && composed.drafts.length > 0 ? "complete" : "incomplete",
    captureCount: captureReceipts.length,
    observationCount: observations.length,
    profileCount: composed.drafts.length,
    outputPath: paths.output,
  });
}

if (import.meta.main) {
  runPropertyProfileCaptureCli(process.argv.slice(2)).then(
    receipt => {
      process.stdout.write(JSON.stringify(receipt) + "\n");
    },
    error => {
      const code = error instanceof PropertyProfileCaptureCliError ? error.code : "capture_failed";
      process.stderr.write(code + "\n");
      process.exitCode = 1;
    },
  );
}
