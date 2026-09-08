import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

export const PRICELABS_IMPORT_LIMITS = Object.freeze({
  maximumFiles: 500,
  maximumBytes: 100 * 1024 * 1024,
});

// Native Windows output remains pending an ACL-bound writer that can be tested on NTFS.
// POSIX mode bits are the only private-output mechanism proven by this implementation.
export const PRICELABS_NATIVE_WINDOWS_WRITER_STATUS = "pending_acl_bound_implementation" as const;

export class PriceLabsImportError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "PriceLabsImportError";
  }
}

type SourceFields = Record<string, string>;

export type PriceLabsStaging = {
  schemaVersion: "yellow.external-research-staging/v1";
  operational: false;
  source: {
    provider: "PriceLabs";
    researchDate: string;
    market: string;
    currency: string;
    sourceRefreshLabel: string;
    sourceRefreshTimezone: null;
    sourceUpdatedAt: null;
  };
  completeness: {
    sourceNativeArchiveComplete: false;
    gaps: string[];
    limitations: readonly [
      "listing_records_are_not_proven_physical_units",
      "forward_availability_is_not_realised_bookings",
      "source_amounts_are_not_yellow_gross_or_net",
    ];
  };
  mapping: {
    required: true;
    automaticGeographyMatch: false;
    sourceMarket: string;
    hostCities: unknown;
  };
  provenance: {
    manifestSha256: string;
    archiveHashSha256: string;
    archiveIndex: Array<{ path: string; bytes: number; sha256: string }>;
  };
  fieldDictionary: Array<Record<string, unknown>>;
  hostListingRecords: Array<{
    sourcePms: string;
    sourceListingId: string;
    yellowPropertyId: null;
    mappingStatus: "required";
    sourceFields: SourceFields;
  }>;
  marketListings: Array<{
    platform: string;
    sourceListingId: string;
    yellowPropertyId: null;
    mappingStatus: "required";
    memberships: Array<{ marketKey: string; sourceFields: SourceFields }>;
  }>;
  marketViews: Array<{
    key: string;
    name: string;
    platform: string;
    membershipCount: number;
    listingFieldNames: string[];
    sourceTables: Array<{ name: string; fieldNames: string[]; rows: SourceFields[] }>;
  }>;
  dailySeries: Array<{
    marketKey: string;
    kind: string;
    sourceDateField: string;
    fieldNames: string[];
    rows: Array<{
      sourceDate: string;
      sourceDateOnly: string;
      period: "historical" | "as_of" | "future";
      sourceFields: SourceFields;
    }>;
  }>;
};

export type PriceLabsImportReceipt = {
  schemaVersion: "yellow.external-research-import-receipt/v1";
  operationalWrites: false;
  archiveVerified: true;
  archiveHashSha256: string;
  verifiedFileCount: number;
  verifiedBytes: number;
  counts: {
    hostListingRecords: number;
    marketListingIdentities: number;
    marketMemberships: number;
    dailySeries: number;
    dailyRows: number;
  };
  sourceNativeArchiveComplete: false;
  mappingRequired: true;
  outputs: readonly ["staging.json", "preview.html", "receipt.json"];
};

type ParsedCsv = { header: string[]; rows: string[][] };
type ManifestFile = { path: string; bytes: number; sha256: string };
type Dataset = {
  name: string;
  key: string;
  platform: string;
  membership_rows: number;
  listing_fields: number;
  listing_id_unique_within_view: boolean;
  chart_regions: number;
  chart_point_labels: number;
  daily_timelines: Array<{ kind: string; rows: number; columns: string[] }>;
};
type Manifest = {
  archive_version: string;
  research_date: string;
  source_market: string;
  source_currency: string;
  market_refresh_label: string;
  market_refresh_timezone: null;
  entire_pricelabs_account_export_complete: false;
  datasets: Dataset[];
  gaps: string[];
  host_inventory: Record<string, unknown> & {
    listing_records: number;
    cities: unknown;
    sample_listing_monthly_rows: number;
    sample_recent_booking_rows: number;
  };
  totals: Record<string, unknown> & {
    market_membership_rows: number;
    unique_platform_listing_ids: number;
    daily_timeline_tables: number;
    daily_timeline_rows: number;
    chart_regions: number;
    chart_point_labels: number;
  };
  files: ManifestFile[];
};

function fail(code: string): never {
  throw new PriceLabsImportError(code);
}

export function assertPriceLabsPrivateOutputSupported(platform = process.platform): void {
  if (platform === "win32") fail("unsupported_windows_acl");
}

function object(value: unknown, code: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) fail(code);
  return value as Record<string, unknown>;
}

function string(value: unknown, code: string, allowEmpty = false): string {
  if (typeof value !== "string" || (!allowEmpty && value.length === 0)) fail(code);
  return value;
}

function integer(value: unknown, code: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) fail(code);
  return value as number;
}

function array(value: unknown, code: string): unknown[] {
  if (!Array.isArray(value)) fail(code);
  return value;
}

function sha256(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function isWithin(parent: string, candidate: string): boolean {
  const path = relative(parent, candidate);
  return path === "" || (!path.startsWith(`..${sep}`) && path !== ".." && !isAbsolute(path));
}

function safeRelativePath(value: unknown): string {
  const path = string(value, "invalid_manifest_path");
  if (path.includes("\\") || path.includes("\0") || path.startsWith("/") || /^[A-Za-z]:/.test(path)) {
    fail("unsafe_manifest_path");
  }
  const parts = path.split("/");
  if (parts.some((part) => part === "" || part === "." || part === "..")) fail("unsafe_manifest_path");
  return path;
}

function decodeUtf8(bytes: Uint8Array, code: string): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    fail(code);
  }
}

/** Strict RFC-4180-style CSV decoding. Values are retained as source strings. */
export function parsePriceLabsCsv(source: string): ParsedCsv {
  let input = source;
  if (input.startsWith("\uFEFF")) input = input.slice(1);
  if (input.length === 0 || input.includes("\0")) fail("invalid_csv");

  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let index = 0;
  let quoted = false;
  let afterQuote = false;
  let fieldStarted = false;

  const finishField = (): void => {
    record.push(field);
    field = "";
    quoted = false;
    afterQuote = false;
    fieldStarted = false;
  };
  const finishRecord = (): void => {
    finishField();
    records.push(record);
    record = [];
  };

  while (index < input.length) {
    const character = input[index]!;
    if (quoted) {
      if (character === '"') {
        if (input[index + 1] === '"') {
          field += '"';
          index += 2;
          continue;
        }
        quoted = false;
        afterQuote = true;
        index += 1;
        continue;
      }
      field += character;
      index += 1;
      continue;
    }
    if (afterQuote) {
      if (character === ",") {
        finishField();
        index += 1;
        continue;
      }
      if (character === "\n" || (character === "\r" && input[index + 1] === "\n")) {
        finishRecord();
        index += character === "\r" ? 2 : 1;
        continue;
      }
      fail("invalid_csv_quote");
    }
    if (!fieldStarted && character === '"') {
      quoted = true;
      fieldStarted = true;
      index += 1;
      continue;
    }
    if (character === "\r" && input[index + 1] === "\n") {
      finishRecord();
      index += 2;
      continue;
    }
    if (character === '"' || character === "\r") fail("invalid_csv_quote");
    if (character === ",") {
      finishField();
      index += 1;
      continue;
    }
    if (character === "\n") {
      finishRecord();
      index += 1;
      continue;
    }
    fieldStarted = true;
    field += character;
    index += 1;
  }
  if (quoted) fail("invalid_csv_quote");
  if (record.length > 0 || fieldStarted || afterQuote || field.length > 0) finishRecord();
  if (records.length === 0) fail("invalid_csv");
  const header = records[0]!;
  if (header.length === 0 || header.some((name) => name.length === 0)) fail("invalid_csv_header");
  if (new Set(header).size !== header.length) fail("duplicate_csv_header");
  const rows = records.slice(1);
  if (rows.some((row) => row.length !== header.length)) fail("invalid_csv_width");
  return { header, rows };
}

function sourceFields(header: string[], row: string[]): SourceFields {
  const fields = Object.create(null) as SourceFields;
  for (let index = 0; index < header.length; index += 1) fields[header[index]!] = row[index]!;
  return fields;
}

function validDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function dateOnly(sourceDate: string): string {
  if (!/^\d{4}-\d{2}-\d{2}(?: 00:00:00)?$/.test(sourceDate)) fail("invalid_source_date");
  const value = sourceDate.slice(0, 10);
  if (!validDateOnly(value)) fail("invalid_source_date");
  return value;
}

function requireStringList(value: unknown, code: string): string[] {
  const result = array(value, code).map((item) => string(item, code));
  if (new Set(result).size !== result.length) fail(code);
  return result;
}

function readManifest(bytes: Uint8Array): Manifest {
  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeUtf8(bytes, "invalid_manifest_encoding"));
  } catch (error) {
    if (error instanceof PriceLabsImportError) throw error;
    fail("invalid_manifest_json");
  }
  const root = object(parsed, "invalid_manifest");
  if (root.archive_version !== "1.0") fail("unsupported_manifest_version");
  const researchDate = string(root.research_date, "invalid_research_date");
  if (!validDateOnly(researchDate)) fail("invalid_research_date");
  if (root.market_refresh_timezone !== null) fail("source_refresh_timezone_must_be_unknown");
  if (root.entire_pricelabs_account_export_complete !== false) fail("invalid_archive_completeness");

  const files = array(root.files, "invalid_manifest_files").map((item): ManifestFile => {
    const entry = object(item, "invalid_manifest_file");
    const digest = string(entry.sha256, "invalid_manifest_hash");
    if (!/^[a-f0-9]{64}$/.test(digest)) fail("invalid_manifest_hash");
    return { path: safeRelativePath(entry.path), bytes: integer(entry.bytes, "invalid_manifest_bytes"), sha256: digest };
  });
  if (files.length === 0 || files.length > PRICELABS_IMPORT_LIMITS.maximumFiles) fail("file_limit_exceeded");
  if (new Set(files.map((entry) => entry.path)).size !== files.length) fail("duplicate_manifest_path");
  if (files.some((entry) => entry.path === "manifest.json")) fail("manifest_cannot_hash_itself");

  const datasets = array(root.datasets, "invalid_datasets").map((item): Dataset => {
    const dataset = object(item, "invalid_dataset");
    const timelines = array(dataset.daily_timelines, "invalid_daily_timelines").map((timeline): Dataset["daily_timelines"][number] => {
      const value = object(timeline, "invalid_daily_timeline");
      return {
        kind: string(value.kind, "invalid_daily_kind"),
        rows: integer(value.rows, "invalid_daily_rows"),
        columns: requireStringList(value.columns, "invalid_daily_columns"),
      };
    });
    return {
      name: string(dataset.name, "invalid_dataset_name"),
      key: string(dataset.key, "invalid_dataset_key"),
      platform: string(dataset.platform, "invalid_dataset_platform"),
      membership_rows: integer(dataset.membership_rows, "invalid_membership_rows"),
      listing_fields: integer(dataset.listing_fields, "invalid_listing_fields"),
      listing_id_unique_within_view: dataset.listing_id_unique_within_view === true,
      chart_regions: integer(dataset.chart_regions, "invalid_chart_regions"),
      chart_point_labels: integer(dataset.chart_point_labels, "invalid_chart_point_labels"),
      daily_timelines: timelines,
    };
  });
  if (datasets.length === 0 || new Set(datasets.map((item) => item.key)).size !== datasets.length) fail("invalid_datasets");

  const host = object(root.host_inventory, "invalid_host_inventory");
  const totals = object(root.totals, "invalid_totals");
  const gaps = requireStringList(root.gaps, "missing_archive_gaps");
  if (gaps.length === 0) fail("missing_archive_gaps");
  return {
    archive_version: "1.0",
    research_date: researchDate,
    source_market: string(root.source_market, "invalid_source_market"),
    source_currency: string(root.source_currency, "invalid_source_currency"),
    market_refresh_label: string(root.market_refresh_label, "invalid_refresh_label"),
    market_refresh_timezone: null,
    entire_pricelabs_account_export_complete: false,
    datasets,
    gaps,
    host_inventory: {
      ...host,
      listing_records: integer(host.listing_records, "invalid_host_count"),
      cities: host.cities,
      sample_listing_monthly_rows: integer(host.sample_listing_monthly_rows, "invalid_host_monthly_count"),
      sample_recent_booking_rows: integer(host.sample_recent_booking_rows, "invalid_host_booking_count"),
    },
    totals: {
      ...totals,
      market_membership_rows: integer(totals.market_membership_rows, "invalid_market_memberships"),
      unique_platform_listing_ids: integer(totals.unique_platform_listing_ids, "invalid_market_identities"),
      daily_timeline_tables: integer(totals.daily_timeline_tables, "invalid_daily_table_count"),
      daily_timeline_rows: integer(totals.daily_timeline_rows, "invalid_daily_row_count"),
      chart_regions: integer(totals.chart_regions, "invalid_chart_region_total"),
      chart_point_labels: integer(totals.chart_point_labels, "invalid_chart_label_total"),
    },
    files,
  };
}

function walkArchive(root: string): { files: string[]; bytes: number } {
  const files: string[] = [];
  let bytes = 0;
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolute = join(directory, entry.name);
      const stat = lstatSync(absolute);
      if (stat.isSymbolicLink()) fail("archive_symlink_forbidden");
      if (stat.isDirectory()) {
        visit(absolute);
      } else if (stat.isFile()) {
        const canonical = realpathSync(absolute);
        if (!isWithin(root, canonical)) fail("archive_path_escape");
        files.push(relative(root, absolute).split(sep).join("/"));
        bytes += stat.size;
        if (files.length > PRICELABS_IMPORT_LIMITS.maximumFiles) fail("file_limit_exceeded");
        if (bytes > PRICELABS_IMPORT_LIMITS.maximumBytes) fail("byte_limit_exceeded");
      } else {
        fail("unsupported_archive_entry");
      }
    }
  };
  visit(root);
  return { files: files.sort(), bytes };
}

function canonicalOutputPath(output: string): string {
  const target = resolve(output);
  let ancestor = target;
  const missing: string[] = [];
  while (!existsSync(ancestor)) {
    const parent = dirname(ancestor);
    if (parent === ancestor) fail("invalid_output_parent");
    missing.unshift(basename(ancestor));
    ancestor = parent;
  }
  const stat = lstatSync(ancestor);
  if (stat.isSymbolicLink() || !stat.isDirectory()) fail("invalid_output_parent");
  return join(realpathSync(ancestor), ...missing);
}

function readVerifiedArchive(archivePath: string): {
  root: string;
  manifest: Manifest;
  manifestBytes: Uint8Array;
  contents: Map<string, Uint8Array>;
  totalBytes: number;
} {
  const requested = resolve(archivePath);
  const rootStat = lstatSync(requested);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) fail("invalid_archive_root");
  const root = realpathSync(requested);
  const walked = walkArchive(root);
  if (!walked.files.includes("manifest.json")) fail("missing_manifest");
  const manifestBytes = readFileSync(join(root, "manifest.json"));
  const manifest = readManifest(manifestBytes);
  const expected = [...manifest.files.map((entry) => entry.path), "manifest.json"].sort();
  if (expected.length !== walked.files.length || expected.some((path, index) => path !== walked.files[index])) {
    fail("archive_inventory_mismatch");
  }
  const contents = new Map<string, Uint8Array>();
  let listedBytes = 0;
  for (const entry of manifest.files) {
    const absolute = join(root, ...entry.path.split("/"));
    const stat = lstatSync(absolute);
    if (!stat.isFile() || stat.isSymbolicLink() || !isWithin(root, realpathSync(absolute))) fail("unsafe_archive_file");
    const bytes = readFileSync(absolute);
    listedBytes += bytes.byteLength;
    if (bytes.byteLength !== entry.bytes) fail("archive_size_mismatch");
    if (sha256(bytes) !== entry.sha256) fail("archive_hash_mismatch");
    contents.set(entry.path, bytes);
  }
  if (listedBytes > PRICELABS_IMPORT_LIMITS.maximumBytes) fail("byte_limit_exceeded");
  return { root, manifest, manifestBytes, contents, totalBytes: listedBytes };
}

function requiredCsv(contents: Map<string, Uint8Array>, path: string): ParsedCsv {
  const value = contents.get(path);
  if (value === undefined) fail("missing_required_csv");
  return parsePriceLabsCsv(decodeUtf8(value, "invalid_csv_encoding"));
}

function equalStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function readFieldDictionary(contents: Map<string, Uint8Array>): Array<Record<string, unknown>> {
  const bytes = contents.get("field_dictionary.json");
  if (bytes === undefined) fail("missing_field_dictionary");
  let value: unknown;
  try {
    value = JSON.parse(decodeUtf8(bytes, "invalid_field_dictionary_encoding"));
  } catch (error) {
    if (error instanceof PriceLabsImportError) throw error;
    fail("invalid_field_dictionary");
  }
  const seen = new Set<string>();
  return array(value, "invalid_field_dictionary").map((entry) => {
    const item = object(entry, "invalid_field_dictionary");
    const dataset = string(item.dataset, "invalid_field_dictionary");
    const sourceField = string(item.source_field, "invalid_field_dictionary");
    string(item.storage, "invalid_field_dictionary");
    string(item.note, "invalid_field_dictionary", true);
    const identity = `${dataset}\0${sourceField}`;
    if (seen.has(identity)) fail("duplicate_field_dictionary_entry");
    seen.add(identity);
    return item;
  });
}

function dailyFilename(kind: string): string {
  switch (kind) {
    case "occupancy": return "daily_occupancy.csv";
    case "price_percentile_bands": return "daily_price_percentile_bands.csv";
    case "length_of_stay": return "daily_length_of_stay.csv";
    default: fail("unsupported_daily_kind");
  }
}

function buildStaging(verified: ReturnType<typeof readVerifiedArchive>): PriceLabsStaging {
  const { manifest, manifestBytes, contents } = verified;

  // Validate every CSV in the verified inventory, including auxiliary source tables.
  const parsedCsv = new Map<string, ParsedCsv>();
  for (const entry of manifest.files) {
    if (!entry.path.endsWith(".csv")) continue;
    const bytes = contents.get(entry.path);
    if (bytes === undefined) fail("missing_verified_file");
    parsedCsv.set(entry.path, parsePriceLabsCsv(decodeUtf8(bytes, "invalid_csv_encoding")));
  }

  const hostCsv = requiredCsv(contents, "csv/host/listing_inventory.csv");
  if (hostCsv.rows.length !== manifest.host_inventory.listing_records) fail("host_count_mismatch");
  const hostIdIndex = hostCsv.header.indexOf("source_listing_id");
  const hostPmsIndex = hostCsv.header.indexOf("pms");
  if (hostIdIndex < 0 || hostPmsIndex < 0) fail("missing_host_listing_identity");
  const hostIds = new Set<string>();
  const hostListingRecords = hostCsv.rows.map((row) => {
    const sourceListingId = row[hostIdIndex]!;
    const sourcePms = row[hostPmsIndex]!;
    const identity = `${sourcePms}\0${sourceListingId}`;
    if (sourcePms.length === 0 || sourceListingId.length === 0 || hostIds.has(identity)) fail("duplicate_or_empty_host_listing_identity");
    hostIds.add(identity);
    return { sourcePms, sourceListingId, yellowPropertyId: null, mappingStatus: "required" as const, sourceFields: sourceFields(hostCsv.header, row) };
  });
  if (requiredCsv(contents, "csv/host/inspected_listing_monthly_metrics.csv").rows.length !== manifest.host_inventory.sample_listing_monthly_rows) {
    fail("host_monthly_count_mismatch");
  }
  if (requiredCsv(contents, "csv/host/inspected_listing_recent_bookings.csv").rows.length !== manifest.host_inventory.sample_recent_booking_rows) {
    fail("host_booking_count_mismatch");
  }

  const marketMap = new Map<string, PriceLabsStaging["marketListings"][number]>();
  const marketViews: PriceLabsStaging["marketViews"] = [];
  const dailySeries: PriceLabsStaging["dailySeries"] = [];
  let membershipCount = 0;
  let dailyRowCount = 0;
  let chartRegionCount = 0;
  let chartPointLabelCount = 0;

  for (const dataset of manifest.datasets) {
    if (!/^[a-z0-9_]+$/.test(dataset.key)) fail("invalid_dataset_key");
    const listingPath = `csv/${dataset.key}/listings.csv`;
    const listings = parsedCsv.get(listingPath);
    if (listings === undefined) fail("missing_listing_csv");
    if (listings.rows.length !== dataset.membership_rows || listings.header.length !== dataset.listing_fields + 3) {
      fail("listing_count_mismatch");
    }
    const platformIndex = listings.header.indexOf("platform");
    const compsetIndex = listings.header.indexOf("compset");
    const listingUrlIndex = listings.header.indexOf("listing_url");
    const idIndex = listings.header.indexOf("Listing ID");
    if (platformIndex < 0 || compsetIndex < 0 || listingUrlIndex < 0 || idIndex < 0) fail("missing_market_identity");
    const viewIds = new Set<string>();
    for (const row of listings.rows) {
      const platform = row[platformIndex]!;
      const sourceListingId = row[idIndex]!;
      if (platform.length === 0 || sourceListingId.length === 0) fail("missing_market_identity");
      const identity = `${platform}\0${sourceListingId}`;
      if (viewIds.has(identity)) fail("duplicate_market_identity_in_view");
      viewIds.add(identity);
      const membership = { marketKey: dataset.key, sourceFields: sourceFields(listings.header, row) };
      const existing = marketMap.get(identity);
      if (existing === undefined) {
        marketMap.set(identity, {
          platform,
          sourceListingId,
          yellowPropertyId: null,
          mappingStatus: "required",
          memberships: [membership],
        });
      } else {
        existing.memberships.push(membership);
      }
      membershipCount += 1;
    }

    const sourceTables: PriceLabsStaging["marketViews"][number]["sourceTables"] = [];
    for (const [name, filename, expectedRows] of [
      ["summary", "summary_1.csv", null],
      ["chart_catalog", "chart_catalog.csv", dataset.chart_regions],
      ["chart_point_labels", "chart_point_labels.csv", dataset.chart_point_labels],
    ] as const) {
      const table = parsedCsv.get(`csv/${dataset.key}/${filename}`);
      if (table === undefined) fail("missing_market_source_table");
      if (expectedRows !== null && table.rows.length !== expectedRows) fail("market_source_table_count_mismatch");
      sourceTables.push({ name, fieldNames: table.header, rows: table.rows.map((row) => sourceFields(table.header, row)) });
    }
    chartRegionCount += dataset.chart_regions;
    chartPointLabelCount += dataset.chart_point_labels;
    marketViews.push({
      key: dataset.key,
      name: dataset.name,
      platform: dataset.platform,
      membershipCount: listings.rows.length,
      listingFieldNames: listings.header,
      sourceTables,
    });

    const seenKinds = new Set<string>();
    for (const timeline of dataset.daily_timelines) {
      if (seenKinds.has(timeline.kind)) fail("duplicate_daily_kind");
      seenKinds.add(timeline.kind);
      const table = parsedCsv.get(`csv/${dataset.key}/${dailyFilename(timeline.kind)}`);
      if (table === undefined) fail("missing_daily_csv");
      if (table.rows.length !== timeline.rows || !equalStrings(table.header, timeline.columns)) fail("daily_shape_mismatch");
      const sourceDateField = table.header[0];
      if (sourceDateField === undefined) fail("missing_source_date");
      const sourceDates = new Set<string>();
      const rows = table.rows.map((row) => {
        const sourceDate = row[0]!;
        const sourceDateOnly = dateOnly(sourceDate);
        if (sourceDates.has(sourceDate)) fail("duplicate_source_date");
        sourceDates.add(sourceDate);
        const period = sourceDateOnly < manifest.research_date
          ? "historical" as const
          : sourceDateOnly === manifest.research_date ? "as_of" as const : "future" as const;
        return { sourceDate, sourceDateOnly, period, sourceFields: sourceFields(table.header, row) };
      });
      dailyRowCount += rows.length;
      dailySeries.push({ marketKey: dataset.key, kind: timeline.kind, sourceDateField, fieldNames: table.header, rows });
    }
  }

  if (membershipCount !== manifest.totals.market_membership_rows) fail("market_membership_count_mismatch");
  if (marketMap.size !== manifest.totals.unique_platform_listing_ids) fail("market_identity_count_mismatch");
  if (dailySeries.length !== manifest.totals.daily_timeline_tables) fail("daily_table_count_mismatch");
  if (dailyRowCount !== manifest.totals.daily_timeline_rows) fail("daily_row_count_mismatch");
  if (chartRegionCount !== manifest.totals.chart_regions) fail("chart_region_count_mismatch");
  if (chartPointLabelCount !== manifest.totals.chart_point_labels) fail("chart_point_label_count_mismatch");

  const archiveIndex = manifest.files.map((entry) => ({ ...entry })).sort((a, b) => a.path.localeCompare(b.path));
  const manifestSha256 = sha256(manifestBytes);
  const archiveHashSha256 = sha256([
    `manifest.json\0${manifestBytes.byteLength}\0${manifestSha256}`,
    ...archiveIndex.map((entry) => `${entry.path}\0${entry.bytes}\0${entry.sha256}`),
  ].join("\n"));
  return {
    schemaVersion: "yellow.external-research-staging/v1",
    operational: false,
    source: {
      provider: "PriceLabs",
      researchDate: manifest.research_date,
      market: manifest.source_market,
      currency: manifest.source_currency,
      sourceRefreshLabel: manifest.market_refresh_label,
      sourceRefreshTimezone: null,
      sourceUpdatedAt: null,
    },
    completeness: {
      sourceNativeArchiveComplete: false,
      gaps: manifest.gaps,
      limitations: [
        "listing_records_are_not_proven_physical_units",
        "forward_availability_is_not_realised_bookings",
        "source_amounts_are_not_yellow_gross_or_net",
      ],
    },
    mapping: {
      required: true,
      automaticGeographyMatch: false,
      sourceMarket: manifest.source_market,
      hostCities: manifest.host_inventory.cities,
    },
    provenance: { manifestSha256, archiveHashSha256, archiveIndex },
    fieldDictionary: readFieldDictionary(contents),
    hostListingRecords,
    marketListings: [...marketMap.values()],
    marketViews,
    dailySeries,
  };
}

function htmlEscape(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function embeddedJson(value: unknown): string {
  return JSON.stringify(value).replaceAll("<", "\\u003c").replaceAll("\u2028", "\\u2028").replaceAll("\u2029", "\\u2029");
}

export function renderPriceLabsPreview(staging: PriceLabsStaging): string {
  const options = staging.marketViews.map((view) => `<option value="${htmlEscape(view.key)}">${htmlEscape(view.name)}</option>`).join("");
  const data = embeddedJson(staging);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Yellow PriceLabs research staging</title><style>
:root{color-scheme:light;--ink:#18201d;--muted:#59645f;--paper:#f4f2e9;--card:#fffefa;--line:#cbc8ba;--accent:#6b4f00}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:14px/1.4 system-ui,sans-serif}header{padding:18px 24px;background:#242d29;color:white}h1{font-size:20px;margin:0 0 4px}.notice{margin:3px 0;color:#e8e4d6}.controls{display:grid;grid-template-columns:2fr 1fr 1fr;gap:12px;padding:14px 24px;background:var(--card);border-bottom:1px solid var(--line)}label{font-weight:650}input,select{display:block;width:100%;margin-top:4px;padding:8px;border:1px solid #8c928f;background:white;color:var(--ink)}main{padding:16px 24px}.meta,.pager{display:flex;align-items:center;gap:12px;flex-wrap:wrap;color:var(--muted);margin-bottom:12px}.pager{margin-top:12px}.pager button{padding:7px 12px;border:1px solid #8c928f;background:white;color:var(--ink);font-weight:650}.pager button:disabled{opacity:.45}.table-wrap{max-height:62vh;overflow:auto;border:1px solid var(--line);background:white}table{border-collapse:collapse;width:max-content;min-width:100%}th,td{padding:6px 8px;border-right:1px solid #ddd9cb;border-bottom:1px solid #ddd9cb;text-align:left;vertical-align:top;max-width:320px;overflow-wrap:anywhere}th{position:sticky;top:0;background:#ece8d8;z-index:1}.empty{padding:24px;color:var(--muted)}details{margin-top:14px;background:var(--card);border:1px solid var(--line);padding:10px}code{color:var(--accent)}@media(max-width:760px){.controls{grid-template-columns:1fr}main,.controls{padding-left:12px;padding-right:12px}}
</style></head><body><header><h1>PriceLabs research staging</h1><p class="notice" id="source-context"></p><p class="notice">Private external evidence · host/market matching required · no operational prices, inventory, or bookings</p></header>
<section class="controls"><label>Search host or market rows<input id="search" type="search" autocomplete="off" placeholder="Filter source strings"></label><label>Market view<select id="market"><option value="host">Host inventory</option>${options}</select></label><label>Table<select id="table"><option value="listings">Listings</option><option value="occupancy">Daily occupancy</option><option value="price_percentile_bands">Daily price bands</option><option value="length_of_stay">Daily length of stay</option></select></label></section>
<main><div class="meta" id="meta"></div><div class="table-wrap" id="result"></div><nav class="pager" aria-label="Table pages"><button id="previous" type="button">Previous</button><span id="page-status" aria-live="polite"></span><button id="next" type="button">Next</button></nav><details><summary>Source field dictionary and provenance</summary><div id="dictionary"></div></details></main>
<script>const DATA=${data};const $=id=>document.getElementById(id);const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const PAGE_SIZE=200;let page=0;function draw(){const market=$("market").value,kind=$("table").value,q=$("search").value.toLocaleLowerCase();let rows=[],fields=[];if(market==="host"){rows=DATA.hostListingRecords.map(x=>x.sourceFields);fields=rows[0]?Object.keys(rows[0]):[]}else if(kind==="listings"){const view=DATA.marketViews.find(x=>x.key===market);fields=view?.listingFieldNames||[];rows=DATA.marketListings.flatMap(x=>x.memberships.filter(m=>m.marketKey===market).map(m=>m.sourceFields))}else{const series=DATA.dailySeries.find(x=>x.marketKey===market&&x.kind===kind);fields=series?.fieldNames||[];rows=(series?.rows||[]).map(x=>({...x.sourceFields,"Yellow date class":x.period}));if(rows.length)fields=[...fields,"Yellow date class"]}const filtered=q?rows.filter(r=>Object.values(r).some(v=>String(v).toLocaleLowerCase().includes(q))):rows;const pages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));page=Math.min(page,pages-1);const start=filtered.length?page*PAGE_SIZE:0,end=Math.min(start+PAGE_SIZE,filtered.length),visible=filtered.slice(start,end);$("meta").innerHTML='<span>Displaying <strong>'+(filtered.length?start+1:0)+'–'+end+'</strong> of <strong>'+filtered.length+'</strong> matched / '+rows.length+' total</span><span>Source updated at: <strong>unknown</strong></span><span>Yellow property mapping: <strong>required</strong></span>';$("page-status").textContent='Page '+(page+1)+' of '+pages;$("previous").disabled=page===0;$("next").disabled=page>=pages-1;if(!visible.length){$("result").innerHTML='<div class="empty">No matching source rows.</div>';return}const head=fields.map(f=>'<th scope="col">'+esc(f)+'</th>').join("");const body=visible.map(r=>'<tr>'+fields.map(f=>'<td>'+esc(r[f])+'</td>').join("")+'</tr>').join("");$("result").innerHTML='<table><thead><tr>'+head+'</tr></thead><tbody>'+body+'</tbody></table>'}
function reset(){page=0;draw()}$("market").addEventListener("change",reset);$("table").addEventListener("change",reset);$("search").addEventListener("input",reset);$("previous").addEventListener("click",()=>{if(page>0){page-=1;draw()}});$("next").addEventListener("click",()=>{page+=1;draw()});$("source-context").innerHTML='Source market: <strong>'+esc(DATA.source.market)+'</strong> · source refresh label: <strong>'+esc(DATA.source.sourceRefreshLabel)+'</strong> · refresh timezone: <strong>unknown</strong>';const dictionaryRows=DATA.fieldDictionary.map(x=>'<tr><td>'+esc(x.dataset)+'</td><td>'+esc(x.source_field)+'</td><td>'+esc(x.storage)+'</td><td>'+esc(x.note)+'</td></tr>').join("");$("dictionary").innerHTML='<p>'+DATA.fieldDictionary.length+' source fields. Archive <code>'+esc(DATA.provenance.archiveHashSha256)+'</code>.</p><div class="table-wrap"><table><thead><tr><th>Dataset</th><th>Source field</th><th>Storage</th><th>Note</th></tr></thead><tbody>'+dictionaryRows+'</tbody></table></div>';draw();</script></body></html>`;
}

export function importPriceLabsArchive(options: { archive: string; output: string }): PriceLabsImportReceipt {
  if (typeof options.archive !== "string" || typeof options.output !== "string" || options.archive.length === 0 || options.output.length === 0) {
    fail("invalid_import_options");
  }
  assertPriceLabsPrivateOutputSupported();
  if (existsSync(resolve(options.output))) fail("output_already_exists");
  const verified = readVerifiedArchive(options.archive);
  const output = canonicalOutputPath(options.output);
  if (isWithin(verified.root, output) || isWithin(output, verified.root)) fail("archive_output_overlap");
  const staging = buildStaging(verified);
  const marketMemberships = staging.marketListings.reduce((sum, listing) => sum + listing.memberships.length, 0);
  const dailyRows = staging.dailySeries.reduce((sum, series) => sum + series.rows.length, 0);
  const receipt: PriceLabsImportReceipt = {
    schemaVersion: "yellow.external-research-import-receipt/v1",
    operationalWrites: false,
    archiveVerified: true,
    archiveHashSha256: staging.provenance.archiveHashSha256,
    verifiedFileCount: verified.manifest.files.length,
    verifiedBytes: verified.totalBytes,
    counts: {
      hostListingRecords: staging.hostListingRecords.length,
      marketListingIdentities: staging.marketListings.length,
      marketMemberships,
      dailySeries: staging.dailySeries.length,
      dailyRows,
    },
    sourceNativeArchiveComplete: false,
    mappingRequired: true,
    outputs: ["staging.json", "preview.html", "receipt.json"],
  };
  let created = false;
  try {
    mkdirSync(output, { mode: 0o700 });
    created = true;
    writeFileSync(join(output, "staging.json"), `${JSON.stringify(staging, null, 2)}\n`, { mode: 0o600, flag: "wx" });
    writeFileSync(join(output, "preview.html"), renderPriceLabsPreview(staging), { mode: 0o600, flag: "wx" });
    writeFileSync(join(output, "receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600, flag: "wx" });
    chmodSync(output, 0o700);
    return receipt;
  } catch (error) {
    if (created) rmSync(output, { recursive: true, force: true });
    throw error;
  }
}

function cliArguments(argv: string[]): { archive: string; output: string } {
  let archive: string | undefined;
  let output: string | undefined;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--archive" && archive === undefined) archive = argv[++index];
    else if (argument === "--output" && output === undefined) output = argv[++index];
    else fail("invalid_cli_arguments");
  }
  if (archive === undefined || output === undefined) fail("invalid_cli_arguments");
  return { archive, output };
}

if (import.meta.main) {
  try {
    const receipt = importPriceLabsArchive(cliArguments(process.argv.slice(2)));
    process.stdout.write(`Verified ${receipt.verifiedFileCount} files; staged ${receipt.counts.hostListingRecords} host records, ${receipt.counts.marketListingIdentities} market identities, ${receipt.counts.marketMemberships} memberships, and ${receipt.counts.dailyRows} daily rows.\n`);
  } catch (error) {
    const code = error instanceof PriceLabsImportError ? error.code : "import_failed";
    process.stderr.write(`PriceLabs import failed: ${code}.\n`);
    process.exitCode = 1;
  }
}
