import { lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync, existsSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { createHash } from "node:crypto";
import {
  buildMarketSourcePlan,
  normalizeMarketSourceCapture,
  readSerpApiGoogleHotels,
  type MarketSourcePolicy,
  type MarketSourceQuery,
  type MarketSourceNormalizationResult,
} from "../../src/contexts/distribution";

const MAX_INPUT_BYTES = 16 * 1024 * 1024;
const MODES = ["plan", "ingest", "google-live"] as const;
type Mode = typeof MODES[number];
type Capture = Parameters<typeof normalizeMarketSourceCapture>[0];
type Plan = ReturnType<typeof buildMarketSourcePlan>;
type Request = Plan["batches"][number]["requests"][number];

export class MarketSourceBatchError extends Error {
  constructor(readonly code: string) { super(code); this.name = "MarketSourceBatchError"; }
}

function fail(code: string): never { throw new MarketSourceBatchError(code); }
function object(value: unknown, code: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail(code);
  return value as Record<string, unknown>;
}
function keys(value: Record<string, unknown>, allowed: readonly string[]): void {
  if (Object.keys(value).some(key => !allowed.includes(key))) fail("unknown_input_field");
}
function natural(value: unknown, maximum: number): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value > maximum) fail("invalid_budget");
  return value;
}
function queryFor(request: Request): MarketSourceQuery {
  return {
    destination: request.destination,
    checkInDate: request.arrivalDate,
    checkOutDate: request.checkoutDate,
    adults: request.guests.adults,
    rooms: request.guests.rooms,
    childrenAges: [...request.guests.childAges],
    currency: request.currency,
    pointOfSaleMarket: request.pointOfSaleMarket,
    language: request.language,
  };
}
function queryKey(query: MarketSourceQuery): string {
  return JSON.stringify([
    query.destination, query.checkInDate, query.checkOutDate, query.adults,
    query.rooms, [...query.childrenAges].sort((a, b) => a - b), query.currency,
    query.pointOfSaleMarket, query.language,
  ]);
}

export interface MarketSourceBatchReceipt {
  schemaVersion: "yellow.market-source-batch-receipt/v1";
  mode: Mode;
  status: "completed" | "partial" | "blocked";
  inputSha256: string;
  operationalWrites: false;
  automaticPricingEligible: false;
  coordinationScope: "single-process-bounded-invocation";
  lookaheadMonths: 3 | 4;
  propertyLocalDate: string;
  arrivalEndExclusive: string;
  plannedQueries: number;
  selectedQueries: number;
  normalizedCaptures: number;
  heldCaptures: number;
  duplicateCapturesSkipped: number;
  candidates: number;
  sourceIssues: number;
  actualProviderHttpRequests: number;
  maximumProviderHttpRequests: number;
  readFailures: Array<{ source: "google-hotels-serpapi"; kind: string }>;
  sourceCounts: Record<string, number>;
  outputs: readonly ["plan.json", "observations.json", "receipt.json"];
}

/** Offline ingest/plan and explicitly configured Google read. It creates private
 * research files only. No scheduler, authentication boundary or operational writer. */
export async function executeMarketSourceBatch(options: {
  input: string;
  output: string;
  mode: Mode;
  apiKey?: string;
  fetch?: typeof fetch;
  now?: () => string;
}): Promise<MarketSourceBatchReceipt> {
  if (!MODES.includes(options.mode)) fail("invalid_mode");
  if (process.platform === "win32") fail("unsupported_windows_acl");
  const inputPath = resolve(options.input);
  const stat = lstatSync(inputPath);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_INPUT_BYTES) fail("invalid_input_file");
  const bytes = readFileSync(inputPath);
  if (bytes.length > MAX_INPUT_BYTES) fail("input_too_large");
  let parsed: unknown;
  try { parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { fail("invalid_input_json"); }
  const input = object(parsed, "invalid_input");
  keys(input, ["schemaVersion", "policy", "run", "captures", "google"]);
  if (input.schemaVersion !== "yellow.market-source-batch/v1") fail("unsupported_input_version");
  const run = object(input.run, "invalid_run");
  keys(run, ["now", "maxBatchSize", "maxRequestsThisRun", "lastSuccessByKey"]);
  const now = options.mode === "google-live"
    ? (options.now?.() ?? new Date().toISOString()) : run.now;
  if (typeof now !== "string") fail("invalid_run_time");
  const configuredPolicy = object(input.policy, "invalid_policy") as unknown as MarketSourcePolicy;
  let policy = configuredPolicy;
  let plan: Plan;
  let fullPlan: Plan;
  try {
    // Validate the complete client selection before narrowing the explicitly
    // provider-specific live mode. Non-executable MCP jobs cannot consume its budget.
    buildMarketSourcePlan(configuredPolicy, { now, maxBatchSize: 100, maxRequestsThisRun: 0 });
    if (options.mode === "google-live") {
      if (!configuredPolicy.selectedSources.includes("google-hotels-serpapi")) fail("google_source_not_selected");
      policy = { ...configuredPolicy, selectedSources: ["google-hotels-serpapi"] };
    }
    plan = buildMarketSourcePlan(policy, {
      now, maxBatchSize: natural(run.maxBatchSize, 100),
      maxRequestsThisRun: natural(run.maxRequestsThisRun, 4_000),
      ...(run.lastSuccessByKey === undefined ? {} : { lastSuccessByKey: run.lastSuccessByKey as Readonly<Record<string, string>> }),
    });
    fullPlan = buildMarketSourcePlan(policy, { now, maxBatchSize: 100, maxRequestsThisRun: 4_000 });
  } catch (error) {
    if (error instanceof MarketSourceBatchError) throw error;
    fail("invalid_policy_or_run");
  }
  const outputPath = resolve(options.output);
  if (existsSync(outputPath)) fail("output_already_exists");
  const parent = realpathSync(dirname(outputPath));
  if (parent !== resolve(dirname(outputPath))) fail("output_parent_symlink");
  if (!basename(outputPath) || outputPath === inputPath) fail("invalid_output_path");
  const fullRequests = fullPlan.batches.flatMap(batch => batch.requests);
  const eligible = new Map(fullRequests.map(request => [JSON.stringify([request.source, queryKey(queryFor(request))]), request.key]));
  const captures = input.captures === undefined ? [] : input.captures;
  if (!Array.isArray(captures) || captures.length > 100) fail("invalid_captures");
  if (options.mode === "plan" && captures.length > 0) fail("plan_mode_has_captures");
  if (options.mode === "google-live" && captures.length > 0) fail("live_mode_has_captures");
  const normalized: MarketSourceNormalizationResult[] = [];
  const seen = new Set<string>();
  let duplicateCapturesSkipped = 0;
  for (const raw of captures) {
    const capture = object(raw, "invalid_capture");
    keys(capture, ["source", "query", "collectedAt", "payload"]);
    let result: MarketSourceNormalizationResult;
    try { result = normalizeMarketSourceCapture(capture as unknown as Capture); }
    catch { fail("invalid_capture"); }
    if (!eligible.has(JSON.stringify([result.source, queryKey(result.query)]))) fail("capture_outside_selected_context");
    if (result.collectedAt !== null && Date.parse(result.collectedAt) > Date.parse(plan.asOfUtc)) fail("capture_time_after_run");
    const dedupe = createHash("sha256").update(JSON.stringify(result)).digest("hex");
    if (seen.has(dedupe)) { duplicateCapturesSkipped += 1; continue; }
    seen.add(dedupe);
    normalized.push(result);
  }
  let actualProviderHttpRequests = 0;
  let maximumProviderHttpRequests = 0;
  const readFailures: MarketSourceBatchReceipt["readFailures"] = [];
  if (options.mode === "google-live") {
    const google = object(input.google, "missing_google_read_options");
    keys(google, ["propertyDetailLimit", "noCache"]);
    const detailLimit = natural(google.propertyDetailLimit, 4);
    if (typeof google.noCache !== "boolean") fail("invalid_google_read_options");
    if (!policy.selectedSources.includes("google-hotels-serpapi")) fail("google_source_not_selected");
    const requests = plan.batches.flatMap(batch => batch.requests).filter(request => request.source === "google-hotels-serpapi");
    maximumProviderHttpRequests = requests.length * (1 + detailLimit);
    const countedFetch = (async (url: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      actualProviderHttpRequests += 1;
      if (actualProviderHttpRequests > maximumProviderHttpRequests) fail("provider_request_budget_exceeded");
      return (options.fetch ?? fetch)(url, init);
    }) as typeof fetch;
    for (const request of requests) {
      const result = await readSerpApiGoogleHotels(queryFor(request), {
        apiKey: options.apiKey ?? "", fetch: countedFetch,
        propertyDetailLimit: detailLimit, noCache: google.noCache,
      });
      if (!result.ok) {
        readFailures.push({ source: "google-hotels-serpapi", kind: result.error.kind });
        break; // Every failure stops this invocation; no same-upstream retry loop.
      }
      normalized.push(result.value);
    }
  } else if (input.google !== undefined) {
    fail("google_options_require_live_mode");
  }
  const sourceCounts: Record<string, number> = {};
  for (const result of normalized) sourceCounts[result.source] = (sourceCounts[result.source] ?? 0) + result.candidates.length;
  const incomplete = normalized.filter(result => result.issues.some(issue => issue.code !== "unknown-collection-time"));
  const heldCaptures = incomplete.filter(result => result.candidates.length === 0).length;
  const candidateCount = normalized.reduce((sum, result) => sum + result.candidates.length, 0);
  const receipt: MarketSourceBatchReceipt = {
    schemaVersion: "yellow.market-source-batch-receipt/v1",
    mode: options.mode,
    status: readFailures.length === 0 && incomplete.length === 0 ? "completed" : candidateCount > 0 ? "partial" : "blocked",
    inputSha256: createHash("sha256").update(bytes).digest("hex"),
    operationalWrites: false, automaticPricingEligible: false,
    coordinationScope: "single-process-bounded-invocation",
    lookaheadMonths: policy.lookaheadMonths,
    propertyLocalDate: plan.propertyLocalDate,
    arrivalEndExclusive: plan.arrivalEndExclusive,
    plannedQueries: plan.requestedPotentialQueryCount,
    selectedQueries: plan.selectedRequestCount,
    normalizedCaptures: normalized.length,
    heldCaptures,
    duplicateCapturesSkipped,
    candidates: candidateCount,
    sourceIssues: normalized.reduce((sum, result) => sum + result.issues.length, 0),
    actualProviderHttpRequests, maximumProviderHttpRequests, readFailures, sourceCounts,
    outputs: ["plan.json", "observations.json", "receipt.json"],
  };
  mkdirSync(outputPath, { mode: 0o700 });
  // A partial filesystem failure leaves this uniquely created directory for review;
  // it never deletes/replaces an existing user's directory or retries implicitly.
  for (const [name, value] of [["plan.json", plan], ["observations.json", normalized], ["receipt.json", receipt]] as const) {
    writeFileSync(join(outputPath, name), `${JSON.stringify(value, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  }
  return receipt;
}

function argumentsFor(argv: readonly string[]): { input: string; output: string; mode: Mode } {
  const args = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index]; const value = argv[index + 1];
    if (!key || !value || !["--input", "--output", "--mode"].includes(key) || args.has(key)) fail("invalid_cli_arguments");
    args.set(key, value);
  }
  const input = args.get("--input"); const output = args.get("--output"); const mode = args.get("--mode");
  if (!input || !output || !mode || !(MODES as readonly string[]).includes(mode)) fail("invalid_cli_arguments");
  return { input, output, mode: mode as Mode };
}

if (import.meta.main) {
  try {
    const options = argumentsFor(process.argv.slice(2));
    const receipt = await executeMarketSourceBatch({ ...options, ...(options.mode === "google-live" ? { apiKey: process.env.YELLOW_SERPAPI_KEY ?? "" } : {}) });
    process.stdout.write(`${receipt.status}: ${receipt.normalizedCaptures} captures, ${receipt.candidates} candidates, ${receipt.actualProviderHttpRequests} provider HTTP requests.\n`);
    if (receipt.status !== "completed") process.exitCode = 2;
  } catch (error) {
    process.stderr.write(`Market source batch failed: ${error instanceof MarketSourceBatchError ? error.code : "batch_failed"}.\n`);
    process.exitCode = 1;
  }
}
