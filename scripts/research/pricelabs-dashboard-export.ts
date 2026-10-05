import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parsePriceLabsCsv } from "./pricelabs-import";

const LISTING_COLUMNS = [
  "ListingID", "listing_link", "lat", "lng", "Bedrooms", "Star Rating", "Reviews", "Price",
  "Active Nights", "Min Stay", "Dynamic Pricing", "new_listing", "listing_title", "id",
] as const;
const PRICE_COLUMNS = [
  "Dates", "25th Percentile", "50th Percentile", "75th Percentile", "90th Percentile",
  "Median Booked Price", "No. Of Bookings",
] as const;
const OUTPUT_FILES = [
  "listings.normalized.json", "october-2026-prices.json", "october-2026-prices.csv", "validation-report.json",
] as const;
const MAX_LISTING_BYTES = 5_000_000;
const MAX_PRICE_BYTES = 2_000_000;
const MAX_LISTING_ROWS = 10_000;
const MAX_PRICE_ROWS = 5_000;
const MAX_CELL_LENGTH = 4_096;
const DECIMAL = /^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/u;
const COORDINATE = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/u;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/u;
const UTC_INSTANT = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?Z$/u;
const OCTOBER_DATES = Array.from({ length: 31 }, (_, day) => `2026-10-${String(day + 1).padStart(2, "0")}`);

export class PriceLabsDashboardExportError extends Error {
  constructor(readonly code: string) { super(code); this.name = "PriceLabsDashboardExportError"; }
}
function fail(code: string): never { throw new PriceLabsDashboardExportError(code); }
function hash(bytes: Uint8Array): string { return createHash("sha256").update(bytes).digest("hex"); }
function validDate(value: string): boolean {
  const match = DATE.exec(value);
  if (!match) return false;
  const year = Number(match[1]); const month = Number(match[2]); const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= daysInMonth[month - 1]!;
}
function exactHeader(actual: readonly string[], expected: readonly string[]): boolean {
  return actual.length === expected.length && expected.every((field, index) => actual[index] === field);
}
function sourceFile(path: string, maximum: number) {
  let stat: ReturnType<typeof lstatSync>;
  try { stat = lstatSync(path); } catch { return fail("input_unavailable"); }
  if (!stat.isFile() || stat.isSymbolicLink()) fail("input_not_regular");
  if (stat.size > maximum) fail("input_too_large");
  let bytes: Buffer;
  try { bytes = readFileSync(path); } catch { return fail("input_unavailable"); }
  if (bytes.byteLength > maximum) fail("input_too_large");
  let source: string;
  try { source = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { return fail("invalid_utf8"); }
  let parsed: ReturnType<typeof parsePriceLabsCsv>;
  try { parsed = parsePriceLabsCsv(source); } catch { return fail("invalid_csv"); }
  if (parsed.header.some((cell) => cell.length > MAX_CELL_LENGTH)
    || parsed.rows.some((row) => row.some((cell) => cell.length > MAX_CELL_LENGTH))) fail("cell_too_large");
  return { parsed, bytes: bytes.byteLength, sha256: hash(bytes) };
}
function nullableDecimal(value: string, code: string): string | null {
  if (value === "" || value === "NA" || value === "-NA") return null;
  if (!DECIMAL.test(value)) fail(code);
  return value;
}
function coordinate(value: string, limit: number): string | null {
  if (value === "" || value === "NA" || value === "-NA") return null;
  if (!COORDINATE.test(value) || !Number.isFinite(Number(value)) || Math.abs(Number(value)) > limit) fail("invalid_coordinate");
  return value;
}
function identity(value: string): string {
  if (value.length === 0 || value.length > 256 || /[\u0000-\u001f\u007f]/u.test(value)) fail("invalid_listing_id");
  return value;
}
function increment(counts: Record<string, number>, key: string, value: string | null): void {
  if (value === null) counts[key] = (counts[key] ?? 0) + 1;
}
function zero(counts: Record<string, number>, key: string, value: string | null): void {
  if (value !== null && /^0(?:\.0+)?$/u.test(value)) counts[key] = (counts[key] ?? 0) + 1;
}
function large(value: string | null, threshold: bigint): boolean {
  if (value === null) return false;
  const whole = value.split(".")[0] ?? "0";
  return BigInt(whole) > threshold;
}

export interface PriceLabsDashboardExportOptions {
  readonly listingsPath: string;
  readonly pricesPath: string;
  readonly observedAt: string;
  readonly sourceRefreshed: string;
}

/** Pure offline preparation. PriceLabs listing Price is a next-year average, not a dated quote. */
export function preparePriceLabsDashboardExport(options: PriceLabsDashboardExportOptions) {
  const observed = UTC_INSTANT.exec(options.observedAt);
  if (!observed || !validDate(observed[1]!) || Number(observed[2]) > 23
    || Number(observed[3]) > 59 || Number(observed[4]) > 59) fail("invalid_observed_at");
  if (options.sourceRefreshed !== "25 September 2026 02:12 AM") fail("invalid_source_refreshed");
  if (resolve(options.listingsPath) === resolve(options.pricesPath)) fail("same_input_file");
  const listingSource = sourceFile(options.listingsPath, MAX_LISTING_BYTES);
  const priceSource = sourceFile(options.pricesPath, MAX_PRICE_BYTES);
  if (!exactHeader(listingSource.parsed.header, LISTING_COLUMNS)) fail("invalid_listing_header");
  if (!exactHeader(priceSource.parsed.header, PRICE_COLUMNS)) fail("invalid_price_header");
  if (listingSource.parsed.rows.length > MAX_LISTING_ROWS || priceSource.parsed.rows.length > MAX_PRICE_ROWS) fail("row_limit_exceeded");
  const listingIds = new Set<string>(); const rowIds = new Set<string>();
  const listingCountFields = ["latitude", "longitude", "starRating", "reviews", "priceNextYearAverage", "activeNights", "minimumStay"];
  const listingNullCounts: Record<string, number> = Object.fromEntries(listingCountFields.map((key) => [key, 0]));
  const listingZeroCounts: Record<string, number> = Object.fromEntries(listingCountFields.map((key) => [key, 0]));
  const warnings: string[] = [];
  const listingRows = listingSource.parsed.rows.map((row, index) => {
    const listingId = identity(row[0]!); const sourceRowId = identity(row[13]!);
    if (listingIds.has(listingId) || rowIds.has(sourceRowId)) fail("duplicate_listing_id");
    listingIds.add(listingId); rowIds.add(sourceRowId);
    const latitude = coordinate(row[2]!, 90); const longitude = coordinate(row[3]!, 180);
    if ((latitude === null) !== (longitude === null)) fail("invalid_coordinate");
    const starRating = nullableDecimal(row[5]!, "invalid_listing_number");
    const reviews = nullableDecimal(row[6]!, "invalid_listing_number");
    const priceNextYearAverage = nullableDecimal(row[7]!, "invalid_listing_number");
    const activeNights = nullableDecimal(row[8]!, "invalid_listing_number");
    const minimumStay = nullableDecimal(row[9]!, "invalid_listing_number");
    if (!/^(?:0|1)$/u.test(row[11]!)) fail("invalid_listing_number");
    for (const [key, value] of Object.entries({ latitude, longitude, starRating, reviews, priceNextYearAverage, activeNights, minimumStay })) {
      increment(listingNullCounts, key, value); zero(listingZeroCounts, key, value);
    }
    if (large(priceNextYearAverage, 100_000n)) warnings.push(`listing_price_outlier_row_${index + 2}`);
    if (large(activeNights, 366n)) warnings.push(`active_nights_outlier_row_${index + 2}`);
    return {
      listingId, sourceRowId, listingLink: row[1]!, latitude, longitude,
      coordinatePrecision: "source-approximate" as const, bedrooms: row[4]!, starRating, reviews,
      priceNextYearAverage, activeNights, minimumStay, dynamicPricing: row[10]!,
      newListing: row[11] === "1", title: row[12]!,
    };
  });
  const dates = new Set<string>(); const octoberRows: Array<{
    date: string; percentile25: string | null; percentile50: string | null; percentile75: string | null;
    percentile90: string | null; medianBookedPrice: string | null; bookings: string | null;
  }> = [];
  const priceCountFields = ["percentile25", "percentile50", "percentile75", "percentile90", "medianBookedPrice", "bookings"];
  const priceNullCounts: Record<string, number> = Object.fromEntries(priceCountFields.map((key) => [key, 0]));
  const priceZeroCounts: Record<string, number> = Object.fromEntries(priceCountFields.map((key) => [key, 0]));
  for (const [index, row] of priceSource.parsed.rows.entries()) {
    const date = row[0]!;
    if (!validDate(date)) fail("invalid_price_date");
    if (dates.has(date)) fail("duplicate_price_date");
    dates.add(date);
    const values = {
      percentile25: nullableDecimal(row[1]!, "invalid_price_number"),
      percentile50: nullableDecimal(row[2]!, "invalid_price_number"),
      percentile75: nullableDecimal(row[3]!, "invalid_price_number"),
      percentile90: nullableDecimal(row[4]!, "invalid_price_number"),
      medianBookedPrice: nullableDecimal(row[5]!, "invalid_price_number"),
      bookings: nullableDecimal(row[6]!, "invalid_price_number"),
    };
    for (const [key, value] of Object.entries(values)) {
      increment(priceNullCounts, key, value); zero(priceZeroCounts, key, value);
    }
    if (Object.entries(values).some(([key, value]) => key !== "bookings" && large(value, 100_000n))) {
      warnings.push(`regional_price_outlier_row_${index + 2}`);
    }
    if (date >= "2026-10-01" && date <= "2026-10-31") octoberRows.push({ date, ...values });
  }
  octoberRows.sort((a, b) => a.date.localeCompare(b.date));
  const missingDates = OCTOBER_DATES.filter((date) => !dates.has(date));
  const source = {
    provider: "PriceLabs", market: "Abu Dhabi, UAE", dashboardId: "187188", currency: "AED",
    sourceRefreshed: options.sourceRefreshed, sourceRefreshTimezone: null, observedAt: options.observedAt,
    contextBasis: "operator-supplied-dashboard-context-not-encoded-in-csv",
  } as const;
  const limitations = [
    "listing_coordinates_are_approximate", "listing_price_is_next_year_average_not_october_quote",
    "future_percentiles_are_regional_advertised_nightly_rates_excluding_fees",
    "no_listing_availability_or_confirmed_transaction_price", "no_dubai_or_global_coverage",
  ] as const;
  const listings = { schemaVersion: "yellow.pricelabs-dashboard-listings/v1", operational: false, source, limitations, rows: listingRows };
  const october = { schemaVersion: "yellow.pricelabs-regional-october-prices/v1", operational: false, source, limitations, rows: octoberRows };
  const report = {
    schemaVersion: "yellow.pricelabs-dashboard-validation/v1", operationalWrites: false, source, limitations,
    listings: { sourceFileSha256: listingSource.sha256, sourceBytes: listingSource.bytes, sourceRows: listingRows.length,
      exactColumns: [...LISTING_COLUMNS], nullCounts: listingNullCounts, zeroCounts: listingZeroCounts },
    prices: { sourceFileSha256: priceSource.sha256, sourceBytes: priceSource.bytes, sourceRows: priceSource.parsed.rows.length,
      exactColumns: [...PRICE_COLUMNS], nullCounts: priceNullCounts, zeroCounts: priceZeroCounts },
    october: { sourceRows: octoberRows.length, missingDates, complete: missingDates.length === 0 }, warnings,
  };
  const csv = [PRICE_COLUMNS.join(","), ...octoberRows.map((row) => [
    row.date, row.percentile25, row.percentile50, row.percentile75, row.percentile90,
    row.medianBookedPrice ?? "", row.bookings,
  ].join(","))].join("\n") + "\n";
  return { listings, october, report, octoberCsv: csv };
}

export function packagePriceLabsDashboardExport(options: PriceLabsDashboardExportOptions & { readonly outputDir: string }) {
  const prepared = preparePriceLabsDashboardExport(options);
  const target = resolve(options.outputDir);
  if (existsSync(target)) fail("output_exists");
  if (target === resolve(options.listingsPath) || target === resolve(options.pricesPath)) fail("output_overlaps_input");
  let created = false;
  try {
    mkdirSync(target, { mode: 0o700 }); created = true;
    const outputs = [
      JSON.stringify(prepared.listings, null, 2) + "\n",
      JSON.stringify(prepared.october, null, 2) + "\n",
      prepared.octoberCsv,
      JSON.stringify(prepared.report, null, 2) + "\n",
    ];
    OUTPUT_FILES.forEach((name, index) => writeFileSync(resolve(target, name), outputs[index]!, { mode: 0o600, flag: "wx" }));
    return { outputFiles: [...OUTPUT_FILES], report: prepared.report };
  } catch (error) {
    if (created) rmSync(target, { recursive: true, force: true });
    throw error;
  }
}

function cliOptions(argv: readonly string[]) {
  const values = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]; const value = argv[i + 1];
    if (!key || !value || !["--listings", "--prices", "--output", "--observed-at", "--source-refreshed"].includes(key)
      || values.has(key)) fail("invalid_cli_arguments");
    values.set(key, value);
  }
  if (values.size !== 5) fail("invalid_cli_arguments");
  return {
    listingsPath: values.get("--listings")!, pricesPath: values.get("--prices")!, outputDir: values.get("--output")!,
    observedAt: values.get("--observed-at")!, sourceRefreshed: values.get("--source-refreshed")!,
  };
}

if (import.meta.main) {
  try {
    const result = packagePriceLabsDashboardExport(cliOptions(process.argv.slice(2)));
    process.stdout.write(JSON.stringify({ outputFiles: result.outputFiles, listingRows: result.report.listings.sourceRows,
      octoberRows: result.report.october.sourceRows, missingOctoberDates: result.report.october.missingDates.length }) + "\n");
  } catch (error) {
    process.stderr.write(`PriceLabs dashboard export failed: ${error instanceof PriceLabsDashboardExportError ? error.code : "package_failed"}.\n`);
    process.exitCode = 1;
  }
}
