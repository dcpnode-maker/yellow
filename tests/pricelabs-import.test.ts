import { afterEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import {
  chmodSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

import {
  PriceLabsImportError,
  assertPriceLabsPrivateOutputSupported,
  importPriceLabsArchive,
  parsePriceLabsCsv,
  preparePriceLabsArchive,
  renderPriceLabsPreview,
  type PriceLabsStaging,
} from "../scripts/research/pricelabs-import";
import { preparePriceLabsDatabaseBundle, loadPriceLabsStaging, verifiedPriceLabsPowerShell } from "../scripts/research/pricelabs-staging";
import type { ReservedSQL } from "bun";

const posixTest = process.platform === "win32" ? test.skip : test;

const temporaryRoots: string[] = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function temporaryRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "yellow-pricelabs-test-"));
  chmodSync(root, 0o700);
  temporaryRoots.push(root);
  return root;
}

function csv(rows: string[][], bom = false): string {
  const encoded = rows.map((row) => row.map((value) => {
    if (!/[",\r\n]/.test(value)) return value;
    return `"${value.replaceAll('"', '""')}"`;
  }).join(",")).join("\n");
  return `${bom ? "\uFEFF" : ""}${encoded}\n`;
}

type Fixture = {
  root: string;
  archive: string;
  output: string;
  manifest: Record<string, unknown> & { files: Array<{ path: string; bytes: number; sha256: string }> };
  files: Map<string, string>;
};

function createFixture(rootOverride?: string): Fixture {
  const root = rootOverride ?? temporaryRoot();
  const archive = join(root, "archive");
  const output = join(root, "staging");
  mkdirSync(archive);
  const hugeId = "900719925474099312345678901234567890";
  const dangerous = "</script><img src=x onerror=alert(1)>";
  const listingHeader = ["platform", "compset", "listing_url", "Listing ID", "Listing Name", "Price", "Revenue", "Nullable"];
  const files = new Map<string, string>([
    ["field_dictionary.json", JSON.stringify([
      { dataset: "market", source_field: "Price", storage: "source string", note: "NA, -NA, blank, and zero remain distinct" },
    ])],
    ["csv/host/listing_inventory.csv", csv([
      ["source_listing_id", "pms", "full_listing_name", "City", "Min Price", "Base Price"],
      [hugeId, "PMS-A", dangerous, "Dubai", "NA", "0"],
      [hugeId, "PMS-B", "Line one\nLine two", "Dubai", "-NA", ""],
    ], true)],
    ["csv/host/inspected_listing_monthly_metrics.csv", csv([["Month", "Revenue"], ["2026-08", "NA"]])],
    ["csv/host/inspected_listing_recent_bookings.csv", csv([["Booked Date", "Rental Revenue"], ["2026-08-01", "0"]])],
    ["csv/view_alpha/listings.csv", csv([
      listingHeader,
      ["Airbnb", "alpha", "https://synthetic.invalid/a", hugeId, dangerous, "0", "NA", ""],
      ["Airbnb", "alpha", "https://synthetic.invalid/b", "00000000000000000003", "Alpha", "-NA", "0", "NA"],
    ])],
    ["csv/view_beta/listings.csv", csv([
      listingHeader,
      ["Airbnb", "beta", "https://synthetic.invalid/a", hugeId, "Shared identity", "NA", "-NA", "0"],
      ["Vrbo", "beta", "https://synthetic.invalid/v", hugeId, "Different platform", "", "0", "-NA"],
    ])],
  ]);
  const timelineFiles = [
    ["occupancy", "daily_occupancy.csv", ["Stay Date", "Occupancy | y"]],
    ["price_percentile_bands", "daily_price_percentile_bands.csv", ["Stay Dates", "Price | low", "Price | high"]],
    ["length_of_stay", "daily_length_of_stay.csv", ["Stay Date", "1 Night"]],
  ] as const;
  for (const view of ["view_alpha", "view_beta"]) {
    files.set(`csv/${view}/summary_1.csv`, csv([["Category", "Value"], ["Synthetic", "NA"]]));
    files.set(`csv/${view}/chart_catalog.csv`, csv([["chart_index", "chart_name"], ["1", "Synthetic"]]));
    files.set(`csv/${view}/chart_point_labels.csv`, csv([["chart_index", "source_point_label"], ["1", "NA"]]));
    for (const [, filename, header] of timelineFiles) {
      files.set(`csv/${view}/${filename}`, csv([
        [...header],
        ["2026-09-07 00:00:00", ...header.slice(1).map(() => "NA")],
        ["2026-09-08 00:00:00", ...header.slice(1).map(() => "0")],
        ["2026-09-09 00:00:00", ...header.slice(1).map(() => "-NA")],
      ]));
    }
  }
  for (const [path, value] of files) {
    const destination = join(archive, ...path.split("/"));
    mkdirSync(join(destination, ".."), { recursive: true });
    writeFileSync(destination, value);
  }
  const timelines = timelineFiles.map(([kind, , columns]) => ({ kind, rows: 3, columns: [...columns] }));
  const manifest: Fixture["manifest"] = {
    archive_version: "1.0",
    research_date: "2026-09-08",
    purpose: "synthetic test evidence",
    method: "synthetic",
    source_market: "Abu Dhabi",
    source_currency: "AED",
    market_refresh_label: "source label without a timezone",
    market_refresh_timezone: null,
    entire_pricelabs_account_export_complete: false,
    datasets: [
      { name: "Alpha", key: "view_alpha", platform: "Airbnb", membership_rows: 2, listing_fields: 5, listing_id_unique_within_view: true, chart_regions: 1, chart_point_labels: 1, daily_timelines: timelines },
      { name: "Beta", key: "view_beta", platform: "mixed", membership_rows: 2, listing_fields: 5, listing_id_unique_within_view: true, chart_regions: 1, chart_point_labels: 1, daily_timelines: timelines },
    ],
    gaps: ["Synthetic archive is deliberately incomplete."],
    host_inventory: { listing_records: 2, physical_property_count: "unknown", cities: { Dubai: 2 }, sample_listing_monthly_rows: 1, sample_recent_booking_rows: 1 },
    totals: {
      market_membership_rows: 4,
      unique_platform_listing_ids: 3,
      daily_timeline_tables: 6,
      daily_timeline_rows: 18,
      chart_regions: 2,
      chart_point_labels: 2,
    },
    files: [],
  };
  rewriteManifest({ root, archive, output, manifest, files });
  return { root, archive, output, manifest, files };
}

function rewriteManifest(fixture: Fixture): void {
  fixture.manifest.files = [...fixture.files].map(([path, source]) => {
    const bytes = Buffer.from(source);
    return { path, bytes: bytes.byteLength, sha256: createHash("sha256").update(bytes).digest("hex") };
  });
  writeFileSync(join(fixture.archive, "manifest.json"), `${JSON.stringify(fixture.manifest, null, 2)}\n`);
}

function codeFrom(action: () => unknown): string {
  try {
    action();
  } catch (error) {
    if (error instanceof PriceLabsImportError) return error.code;
    throw error;
  }
  throw new Error("Expected import to fail");
}

function previewFixture(): PriceLabsStaging {
  const attack = "</script><img src=x onerror=alert(1)>";
  return {
    schemaVersion: "yellow.external-research-staging/v1",
    operational: false,
    source: {
      provider: "PriceLabs",
      researchDate: "2026-09-08",
      market: "Abu Dhabi",
      currency: "AED",
      sourceRefreshLabel: "raw refresh label",
      sourceRefreshTimezone: null,
      sourceUpdatedAt: null,
    },
    completeness: {
      sourceNativeArchiveComplete: false,
      gaps: ["Synthetic gap"],
      limitations: [
        "listing_records_are_not_proven_physical_units",
        "forward_availability_is_not_realised_bookings",
        "source_amounts_are_not_yellow_gross_or_net",
      ],
    },
    mapping: { required: true, automaticGeographyMatch: false, sourceMarket: "Abu Dhabi", hostCities: { Dubai: 1 } },
    provenance: { manifestSha256: "a".repeat(64), archiveHashSha256: "b".repeat(64), archiveIndex: [] },
    fieldDictionary: [{ dataset: "host", source_field: "name", storage: "source string", note: attack }],
    hostListingRecords: [{
      sourcePms: "PMS-A",
      sourceListingId: "0001",
      yellowPropertyId: null,
      mappingStatus: "required",
      sourceFields: { name: attack },
    }],
    marketListings: [{
      platform: "Airbnb",
      sourceListingId: "0002",
      yellowPropertyId: null,
      mappingStatus: "required",
      memberships: [{ marketKey: "synthetic", sourceFields: { "Listing ID": "0002" } }],
    }],
    marketViews: [{ key: "synthetic", name: "Synthetic", platform: "Airbnb", membershipCount: 1, listingFieldNames: ["Listing ID"], sourceTables: [] }],
    dailySeries: [{
      marketKey: "synthetic",
      kind: "occupancy",
      sourceDateField: "Stay Date",
      fieldNames: ["Stay Date", "Occupancy"],
      rows: [{
        sourceDate: "2026-09-08 00:00:00",
        sourceDateOnly: "2026-09-08",
        period: "as_of",
        sourceFields: { "Stay Date": "2026-09-08 00:00:00", Occupancy: "0" },
      }],
    }],
  };
}

describe("Order RMS-20260908 offline PriceLabs importer", () => {
  posixTest("creates a private, non-operational staging bundle preserving source strings and cross-view memberships", () => {
    const fixture = createFixture();
    const receipt = importPriceLabsArchive({ archive: fixture.archive, output: fixture.output });
    expect(receipt).toMatchObject({
      operationalWrites: false,
      archiveVerified: true,
      counts: { hostListingRecords: 2, marketListingIdentities: 3, marketMemberships: 4, dailySeries: 6, dailyRows: 18 },
      sourceNativeArchiveComplete: false,
      mappingRequired: true,
    });
    const staging = JSON.parse(readFileSync(join(fixture.output, "staging.json"), "utf8"));
    expect(staging.source).toMatchObject({ market: "Abu Dhabi", sourceRefreshTimezone: null, sourceUpdatedAt: null });
    expect(staging.mapping).toEqual({ required: true, automaticGeographyMatch: false, sourceMarket: "Abu Dhabi", hostCities: { Dubai: 2 } });
    expect(staging.hostListingRecords[0]).toMatchObject({
      sourceListingId: "900719925474099312345678901234567890",
      sourcePms: "PMS-A",
      yellowPropertyId: null,
      mappingStatus: "required",
      sourceFields: { "Min Price": "NA", "Base Price": "0" },
    });
    expect(staging.hostListingRecords[1].sourceFields).toMatchObject({ "Min Price": "-NA", "Base Price": "" });
    expect(staging.hostListingRecords[1]).toMatchObject({
      sourcePms: "PMS-B",
      sourceListingId: "900719925474099312345678901234567890",
    });
    const shared = staging.marketListings.find((item: { platform: string; sourceListingId: string }) =>
      item.platform === "Airbnb" && item.sourceListingId === "900719925474099312345678901234567890");
    expect(shared.memberships).toHaveLength(2);
    expect(shared.memberships[0].sourceFields).toMatchObject({ Price: "0", Revenue: "NA", Nullable: "" });
    expect(shared.memberships[1].sourceFields).toMatchObject({ Price: "NA", Revenue: "-NA", Nullable: "0" });
    expect(staging.dailySeries[0].rows.map((row: { sourceDate: string; sourceDateOnly: string; period: string }) =>
      [row.sourceDate, row.sourceDateOnly, row.period])).toEqual([
      ["2026-09-07 00:00:00", "2026-09-07", "historical"],
      ["2026-09-08 00:00:00", "2026-09-08", "as_of"],
      ["2026-09-09 00:00:00", "2026-09-09", "future"],
    ]);
    expect(staging.completeness.gaps).toEqual(["Synthetic archive is deliberately incomplete."]);
    expect(staging).not.toHaveProperty("gross");
    expect(staging).not.toHaveProperty("net");
    expect(staging.provenance.archiveIndex).toHaveLength(fixture.files.size);
    expect(statSync(fixture.output).mode & 0o777).toBe(0o700);
    for (const filename of ["staging.json", "preview.html", "receipt.json"]) {
      expect(statSync(join(fixture.output, filename)).mode & 0o777).toBe(0o600);
    }
  });

  test("builds a portable self-contained searchable preview and neutralizes source HTML", () => {
    const html = renderPriceLabsPreview(previewFixture());
    expect(html).toContain("Search host or market rows");
    expect(html).toContain("Daily occupancy");
    expect(html).toContain("Source field dictionary and provenance");
    expect(html).toContain("Source market:");
    expect(html).toContain("source refresh label:");
    expect(html).toContain("host/market matching required");
    expect(html).toContain("Previous");
    expect(html).toContain("Next");
    expect(html).toContain("PAGE_SIZE=200");
    expect(html).toContain("filtered.slice(start,end)");
    expect(html).not.toContain("</script><img src=x onerror=alert(1)>");
    expect(html).toContain("\\u003c/script>\\u003cimg src=x onerror=alert(1)>");
    expect(html).not.toContain("Publish");
    expect(html).not.toContain("<script src=");
    expect(html).not.toMatch(/\b(?:fetch|XMLHttpRequest)\s*\(/);
  });

  test("strict CSV preserves BOM-safe fields, quoted newlines, zeros and NA variants", () => {
    expect(parsePriceLabsCsv(csv([
      ["id", "amount", "note"],
      ["00000000000000000001", "0", "line one\nline two"],
      ["2", "NA", ""],
      ["3", "-NA", "a, b and \"c\""],
    ], true))).toEqual({
      header: ["id", "amount", "note"],
      rows: [
        ["00000000000000000001", "0", "line one\nline two"],
        ["2", "NA", ""],
        ["3", "-NA", "a, b and \"c\""],
      ],
    });
    expect(parsePriceLabsCsv("a,b\r\n1,2\r\n")).toEqual({ header: ["a", "b"], rows: [["1", "2"]] });
    expect(codeFrom(() => parsePriceLabsCsv("a,a\n1,2\n"))).toBe("duplicate_csv_header");
    expect(codeFrom(() => parsePriceLabsCsv("a,b\n1\n"))).toBe("invalid_csv_width");
    expect(codeFrom(() => parsePriceLabsCsv('a,b\n"unterminated,2\n'))).toBe("invalid_csv_quote");
  });

  test("rejects the native Windows writer until private NTFS ACL handling is implemented", () => {
    expect(codeFrom(() => assertPriceLabsPrivateOutputSupported("win32"))).toBe("unsupported_windows_acl");
    if (process.platform !== "win32") expect(assertPriceLabsPrivateOutputSupported()).toBeUndefined();
  });

  test("portable read-only preparation preserves every original byte, including additional evidence", () => {
    const fixture = createFixture();
    fixture.files.set("additional-note.txt", "Synthetic note: 00001, NA, -NA, 0");
    writeFileSync(join(fixture.archive, "additional-note.txt"), fixture.files.get("additional-note.txt")!);
    rewriteManifest(fixture);
    const prepared = preparePriceLabsArchive(fixture.archive);
    expect(prepared.receipt.counts).toEqual({
      hostListingRecords: 2, marketListingIdentities: 3, marketMemberships: 4,
      dailySeries: 6, dailyRows: 18,
    });
    expect(prepared.staging.mapping.required).toBe(true);
    expect(prepared.archiveFiles.length).toBe(fixture.files.size + 1);
    for (const file of prepared.archiveFiles) {
      expect(Buffer.from(file.bytes)).toEqual(readFileSync(join(fixture.archive, file.path)));
      expect(createHash("sha256").update(file.bytes).digest("hex")).toBe(file.sha256);
    }
    expect(prepared.archiveFiles.find(file => file.path === "manifest.json")!.manifestListed).toBe(false);
    expect(prepared.staging.hostListingRecords[0]!.sourceListingId).toBe("900719925474099312345678901234567890");
    expect(() => statSync(fixture.output)).toThrow();
  });

  test("portable preparation is deterministic and writes no staging directory", () => {
    const fixture = createFixture();
    expect(preparePriceLabsArchive(fixture.archive)).toEqual(preparePriceLabsArchive(fixture.archive));
    expect(() => statSync(fixture.output)).toThrow();
  });

  test("portable preparation rejects changed payload without writing output", () => {
    const fixture = createFixture();
    writeFileSync(join(fixture.archive, "field_dictionary.json"), "[]");
    expect(codeFrom(() => preparePriceLabsArchive(fixture.archive))).toBe("archive_size_mismatch");
    expect(() => statSync(fixture.output)).toThrow();
  });

  test("portable preparation rejects path traversal and duplicate manifest identities", () => {
    const fixture = createFixture();
    fixture.manifest.files[0]!.path = "../outside";
    writeFileSync(join(fixture.archive, "manifest.json"), JSON.stringify(fixture.manifest));
    expect(codeFrom(() => preparePriceLabsArchive(fixture.archive))).toBe("unsafe_manifest_path");
    rewriteManifest(fixture);
    fixture.manifest.files.push({...fixture.manifest.files[0]!});
    writeFileSync(join(fixture.archive, "manifest.json"), JSON.stringify(fixture.manifest));
    expect(codeFrom(() => preparePriceLabsArchive(fixture.archive))).toBe("duplicate_manifest_path");
  });

  test("portable preparation rejects unexpected and missing payloads", () => {
    const fixture = createFixture();
    writeFileSync(join(fixture.archive, "unlisted.txt"), "synthetic");
    expect(codeFrom(() => preparePriceLabsArchive(fixture.archive))).toBe("archive_inventory_mismatch");
    rmSync(join(fixture.archive, "unlisted.txt"));
    rmSync(join(fixture.archive, "field_dictionary.json"));
    expect(codeFrom(() => preparePriceLabsArchive(fixture.archive))).toBe("archive_inventory_mismatch");
  });

  test("portable preparation rejects unsupported manifest and false counts", () => {
    const fixture = createFixture();
    fixture.manifest.archive_version = "2.0";
    writeFileSync(join(fixture.archive, "manifest.json"), JSON.stringify(fixture.manifest));
    expect(codeFrom(() => preparePriceLabsArchive(fixture.archive))).toBe("unsupported_manifest_version");
    fixture.manifest.archive_version = "1.0";
    (fixture.manifest.totals as Record<string, unknown>).market_membership_rows = 5;
    writeFileSync(join(fixture.archive, "manifest.json"), JSON.stringify(fixture.manifest));
    expect(codeFrom(() => preparePriceLabsArchive(fixture.archive))).toBe("market_membership_count_mismatch");
  });

  test("database bundle binds deterministic source, every original file and prepared output hashes", () => {
    const fixture = createFixture();
    const bundle = preparePriceLabsDatabaseBundle(fixture.archive);
    expect(bundle.identity).toEqual(preparePriceLabsDatabaseBundle(fixture.archive).identity);
    expect(bundle.identity.stagingSha256).toBe(createHash("sha256").update(bundle.stagingJson).digest("hex"));
    expect(bundle.identity.receiptSha256).toBe(createHash("sha256").update(bundle.receiptJson).digest("hex"));
    expect(bundle.identity.previewSha256).toBe(createHash("sha256").update(bundle.preview).digest("hex"));
    expect(bundle.identity.importerSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(bundle.archiveFiles.length).toBe(bundle.receipt.verifiedFileCount + 1);
  });

  test("cannot replace the ACL validator with an arbitrary executable that would exit zero", () => {
    expect(codeFrom(() => verifiedPriceLabsPowerShell(process.execPath))).toBe("native_pwsh_not_verified");
    expect(codeFrom(() => verifiedPriceLabsPowerShell("relative.exe"))).toBe("native_pwsh_not_verified");
  });

  test("database loader rejects wrong database, actor and PUBLIC privilege before any transaction", async () => {
    const fixture = createFixture();
    for (const change of [
      { database_name: "operational_pms" }, { actor: "app_role" },
      { rolsuper: true }, { rolbypassrls: true }, { public_database_access: true },
    ]) {
      const queries: string[] = [];
      const connection = {
        unsafe: async (query: string) => {
          queries.push(query);
          return [{ database_name: "yellow_pricelabs_staging", actor: "yellow_pricelabs_loader",
            rolsuper: false, rolbypassrls: false, public_database_access: false, ...change }];
        },
      } as unknown as ReservedSQL;
      await expect(loadPriceLabsStaging(connection, fixture.archive)).rejects.toThrow("staging_database_not_isolated");
      expect(queries.length).toBe(1);
      expect(queries[0]).not.toContain("INSERT INTO");
    }
  });

  (process.platform === "win32" ? test : test.skip)(
    "actual Windows wrapper runs the canonical importer on a complete synthetic archive",
    () => {
      const nativePwsh = join(process.env.USERPROFILE!, ".cache", "codex-runtimes",
        "codex-primary-runtime", "dependencies", "native", "powershell", "pwsh.exe");
      const parent = "D:/Yellow/temp/order462-acl-tests";
      mkdirSync(parent, { recursive: true });
      const root = mkdtempSync(join(parent, "full-import-"));
      temporaryRoots.push(root);
      const fixture = createFixture(root);
      const protect = `
$ErrorActionPreference='Stop'
$sid=[Security.Principal.WindowsIdentity]::GetCurrent().User
$system=[Security.Principal.SecurityIdentifier]::new('S-1-5-18')
foreach($path in @($env:YELLOW_ORDER462_PARENT,$env:YELLOW_ORDER462_ROOT,$env:YELLOW_ORDER462_ARCHIVE)){
 $acl=[Security.AccessControl.DirectorySecurity]::new()
 $acl.SetAccessRuleProtection($true,$false)
 $acl.SetOwner($sid)
 foreach($principal in @($sid,$system)){
  $rule=[Security.AccessControl.FileSystemAccessRule]::new($principal,'FullControl','ContainerInherit,ObjectInherit','None','Allow')
  [void]$acl.AddAccessRule($rule)
 }
 [IO.FileSystemAclExtensions]::SetAccessControl([IO.DirectoryInfo]::new($path),$acl)
}
`;
      const protectedResult = Bun.spawnSync([nativePwsh, "-NoProfile", "-NonInteractive",
        "-EncodedCommand", Buffer.from(protect, "utf16le").toString("base64")], {
        env: { ...process.env, YELLOW_ORDER462_PARENT: parent,
          YELLOW_ORDER462_ROOT: root, YELLOW_ORDER462_ARCHIVE: fixture.archive },
        stdout: "pipe", stderr: "pipe", timeout: 15000,
      });
      expect(protectedResult.exitCode, protectedResult.stderr.toString()).toBe(0);
      const run = Bun.spawnSync([nativePwsh, "-NoProfile", "-NonInteractive", "-File",
        resolve("scripts/research/pricelabs-windows-intake.ps1"), "-Action", "Run",
        "-Archive", fixture.archive, "-Output", fixture.output,
        "-BunPath", process.execPath, "-LoaderPath", resolve("scripts/research/pricelabs-staging.ts")],
        { stdout: "pipe", stderr: "pipe", timeout: 45000 });
      expect(run.exitCode, run.stderr.toString()).toBe(0);
      expect(JSON.parse(run.stdout.toString()).status).toBe("completed");
      const result = JSON.parse(readFileSync(join(fixture.output, "staging.json"), "utf8"));
      expect(result.hostListingRecords.length).toBe(2);
      expect(result.marketListings.length).toBe(3);
      expect(result.dailySeries.flatMap((series: {rows: unknown[]}) => series.rows).length).toBe(18);
      expect(result.operational).toBe(false);
      const databaseBundle = JSON.parse(readFileSync(join(fixture.output, "database-bundle.json"), "utf8"));
      expect(databaseBundle.databaseLoaded).toBe(false);
      expect(databaseBundle.archiveFiles.length).toBe(fixture.files.size + 1);
      expect(databaseBundle.stagingSha256).toBe(createHash("sha256")
        .update(readFileSync(join(fixture.output, "staging.json"))).digest("hex"));
    }, 60000,
  );

  posixTest("rejects a source file changed after manifest hashing", () => {
    const fixture = createFixture();
    const original = fixture.files.get("csv/view_alpha/listings.csv")!;
    writeFileSync(join(fixture.archive, "csv/view_alpha/listings.csv"), `${original[0] === "p" ? "P" : "p"}${original.slice(1)}`);
    expect(codeFrom(() => importPriceLabsArchive({ archive: fixture.archive, output: fixture.output }))).toBe("archive_hash_mismatch");
  });

  posixTest("rejects traversal and duplicate manifest paths before reading them", () => {
    const traversal = createFixture();
    traversal.manifest.files[0]!.path = "../outside";
    writeFileSync(join(traversal.archive, "manifest.json"), JSON.stringify(traversal.manifest));
    expect(codeFrom(() => importPriceLabsArchive({ archive: traversal.archive, output: traversal.output }))).toBe("unsafe_manifest_path");

    const duplicate = createFixture();
    duplicate.manifest.files.push({ ...duplicate.manifest.files[0]! });
    writeFileSync(join(duplicate.archive, "manifest.json"), JSON.stringify(duplicate.manifest));
    expect(codeFrom(() => importPriceLabsArchive({ archive: duplicate.archive, output: duplicate.output }))).toBe("duplicate_manifest_path");
  });

  posixTest("rejects symlinks, missing files, and duplicate identities within one market view", () => {
    const linked = createFixture();
    symlinkSync(join(linked.archive, "field_dictionary.json"), join(linked.archive, "linked.json"));
    expect(codeFrom(() => importPriceLabsArchive({ archive: linked.archive, output: linked.output }))).toBe("archive_symlink_forbidden");

    const missing = createFixture();
    rmSync(join(missing.archive, "field_dictionary.json"));
    expect(codeFrom(() => importPriceLabsArchive({ archive: missing.archive, output: missing.output }))).toBe("archive_inventory_mismatch");

    const duplicateIdentity = createFixture();
    const value = csv([
      ["platform", "compset", "listing_url", "Listing ID", "Listing Name", "Price", "Revenue", "Nullable"],
      ["Airbnb", "alpha", "https://synthetic.invalid/one", "same", "one", "0", "NA", ""],
      ["Airbnb", "alpha", "https://synthetic.invalid/two", "same", "two", "0", "NA", ""],
    ]);
    duplicateIdentity.files.set("csv/view_alpha/listings.csv", value);
    writeFileSync(join(duplicateIdentity.archive, "csv/view_alpha/listings.csv"), value);
    rewriteManifest(duplicateIdentity);
    expect(codeFrom(() => importPriceLabsArchive({ archive: duplicateIdentity.archive, output: duplicateIdentity.output }))).toBe("duplicate_market_identity_in_view");
  });

  posixTest("rejects output overlap and refuses to overwrite an existing directory", () => {
    const overlap = createFixture();
    expect(codeFrom(() => importPriceLabsArchive({ archive: overlap.archive, output: join(overlap.archive, "nested-output") }))).toBe("archive_output_overlap");

    const existing = createFixture();
    mkdirSync(existing.output);
    writeFileSync(join(existing.output, "keep"), "untouched");
    expect(codeFrom(() => importPriceLabsArchive({ archive: existing.archive, output: existing.output }))).toBe("output_already_exists");
    expect(readFileSync(join(existing.output, "keep"), "utf8")).toBe("untouched");
  });

  posixTest("rejects unsupported manifest versions, invalid dates, and inconsistent counts", () => {
    const version = createFixture();
    version.manifest.archive_version = "2.0";
    writeFileSync(join(version.archive, "manifest.json"), JSON.stringify(version.manifest));
    expect(codeFrom(() => importPriceLabsArchive({ archive: version.archive, output: version.output }))).toBe("unsupported_manifest_version");

    const date = createFixture();
    date.manifest.research_date = "2026-02-30";
    writeFileSync(join(date.archive, "manifest.json"), JSON.stringify(date.manifest));
    expect(codeFrom(() => importPriceLabsArchive({ archive: date.archive, output: date.output }))).toBe("invalid_research_date");

    const count = createFixture();
    (count.manifest.totals as Record<string, unknown>).market_membership_rows = 5;
    writeFileSync(join(count.archive, "manifest.json"), JSON.stringify(count.manifest));
    expect(codeFrom(() => importPriceLabsArchive({ archive: count.archive, output: count.output }))).toBe("market_membership_count_mismatch");
  });
});
