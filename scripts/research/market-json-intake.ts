import { lstatSync, readFileSync } from "node:fs";
import {
  MARKET_SOURCE_ADAPTER_LIMITS,
  MARKET_SOURCE_IDS,
  normalizeMarketSourceCapture,
  type MarketSourceNormalizationInput,
} from "../../src/contexts/distribution";

const MAX_INPUT_BYTES = 4 * 1024 * 1024;
const ENVELOPE_SCHEMA = "yellow.market-json-intake/v1";
const QUERY_FIELDS = [
  "destination", "checkInDate", "checkOutDate", "adults", "rooms", "childrenAges",
  "currency", "pointOfSaleMarket", "language",
] as const;

export class MarketJsonIntakeError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "MarketJsonIntakeError";
  }
}

function fail(code: string): never { throw new MarketJsonIntakeError(code); }

function record(value: unknown, code: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)
      || Object.getPrototypeOf(value) !== Object.prototype) fail(code);
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[], code: string): void {
  if (Object.keys(value).length !== allowed.length || Object.keys(value).some((key) => !allowed.includes(key))) {
    fail(code);
  }
}

function parseBytes(bytes: Uint8Array): unknown {
  if (bytes.byteLength > MAX_INPUT_BYTES) fail("input_too_large");
  let text: string;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { fail("invalid_input_encoding"); }
  try { return JSON.parse(text) as unknown; }
  catch { fail("invalid_input_json"); }
}

/** Normalize a single explicit envelope; provider-specific schema stays in distribution. */
export function normalizeMarketJsonIntake(input: unknown) {
  const envelope = record(input, "invalid_envelope");
  exactKeys(envelope, ["schemaVersion", "source", "query", "collectedAt", "payload"], "invalid_envelope_fields");
  if (envelope.schemaVersion !== ENVELOPE_SCHEMA) fail("unsupported_schema_version");
  if (typeof envelope.source !== "string" || !(MARKET_SOURCE_IDS as readonly string[]).includes(envelope.source)) {
    fail("unknown_source");
  }
  const query = record(envelope.query, "invalid_query");
  exactKeys(query, QUERY_FIELDS, "invalid_query_fields");
  const capture: MarketSourceNormalizationInput = {
    source: envelope.source as MarketSourceNormalizationInput["source"],
    query: query as unknown as MarketSourceNormalizationInput["query"],
    collectedAt: envelope.collectedAt as string | null,
    payload: envelope.payload,
  };
  let normalized: ReturnType<typeof normalizeMarketSourceCapture>;
  try { normalized = normalizeMarketSourceCapture(capture); }
  catch { fail("invalid_capture_metadata"); }
  const resultStatus = normalized.issues.length === 0
    ? "complete"
    : normalized.candidates.length > 0 ? "partial" : "blocked";
  return Object.freeze({
    schemaVersion: "yellow.market-source-normalized/v1",
    status: resultStatus,
    operationalWrites: false,
    automaticPricingEligible: false,
    ...normalized,
  });
}

export function normalizeMarketJsonIntakeBytes(bytes: Uint8Array) {
  return normalizeMarketJsonIntake(parseBytes(bytes));
}

function inputPathArgument(argv: readonly string[]): string | null {
  if (argv.length === 0) return null;
  if (argv.length !== 2 || argv[0] !== "--input" || !argv[1]) fail("invalid_cli_arguments");
  return argv[1];
}

function readLocalFile(path: string): Uint8Array {
  let metadata: ReturnType<typeof lstatSync>;
  try { metadata = lstatSync(path); }
  catch { fail("input_file_unavailable"); }
  if (!metadata.isFile() || metadata.isSymbolicLink()) fail("input_file_not_regular");
  if (metadata.size > MAX_INPUT_BYTES) fail("input_too_large");
  let bytes: Buffer;
  try { bytes = readFileSync(path); }
  catch { fail("input_file_unavailable"); }
  if (bytes.byteLength > MAX_INPUT_BYTES) fail("input_too_large");
  return bytes;
}

async function readStandardInput(): Promise<Uint8Array> {
  const chunks: Buffer[] = [];
  let bytesRead = 0;
  for await (const chunk of process.stdin) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytesRead += bytes.byteLength;
    if (bytesRead > MAX_INPUT_BYTES) fail("input_too_large");
    chunks.push(bytes);
  }
  return Buffer.concat(chunks, bytesRead);
}

/** CLI handler is exported so byte input/error behavior can be tested without shell-specific pipes. */
export async function executeMarketJsonIntake(options: {
  readonly argv: readonly string[];
  readonly stdin?: Uint8Array;
}): Promise<string> {
  const path = inputPathArgument(options.argv);
  const bytes = path === null
    ? options.stdin ?? await readStandardInput()
    : readLocalFile(path);
  const normalized = normalizeMarketJsonIntakeBytes(bytes);
  return `${JSON.stringify(normalized)}\n`;
}

export const MARKET_JSON_INTAKE_LIMITS = Object.freeze({
  maxInputBytes: MAX_INPUT_BYTES,
  maxCapturePayloadBytes: MARKET_SOURCE_ADAPTER_LIMITS.maxCaptureBytes,
  maxCandidates: MARKET_SOURCE_ADAPTER_LIMITS.maxCandidates,
});

if (import.meta.main) {
  try {
    const output = await executeMarketJsonIntake({ argv: process.argv.slice(2) });
    process.stdout.write(output);
  } catch (error) {
    process.stderr.write(`Market JSON intake failed: ${error instanceof MarketJsonIntakeError ? error.code : "intake_failed"}.\n`);
    process.exitCode = 1;
  }
}
