import { describe, expect, test } from "bun:test";
import { SQL, type ReservedSQL } from "bun";
import { createHash, randomBytes } from "node:crypto";
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import {
  assertPriceLabsStagingIsolation,
  loadPriceLabsStaging,
  preparePriceLabsDatabaseBundle,
} from "../scripts/research/pricelabs-staging";

const REQUIRE = process.env.YELLOW_PRICELABS_INTEGRATION === "1";
const ADMIN_URL = process.env.YELLOW_PRICELABS_TEST_ADMIN_URL;

if (REQUIRE && !ADMIN_URL) {
  throw new Error(
    "YELLOW_PRICELABS_TEST_ADMIN_URL is required by the Order 462 live proof",
  );
}

const liveDescribe = REQUIRE && ADMIN_URL ? describe.serial : describe.skip;
const sha256 = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const mark = (phase: string) => process.stdout.write(`[order462-integration] ${phase}\n`);
const PSQL_PATH = "E:\\yellow\\toolchains\\postgresql-16.15\\pgsql\\bin\\psql.exe";
const PSQL_SHA256 = "e7acd0437ac9a15e4821c39dac3e51939a0d16e09ea0d9bb106ad2c8645626ac";

function requireLocalPostgresUrl(value: string, expectedDatabase?: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("Order 462 database URL is invalid");
  }
  const database = decodeURIComponent(parsed.pathname.slice(1));
  if (!/^postgres(?:ql)?:$/.test(parsed.protocol) || parsed.hostname !== "127.0.0.1" ||
      parsed.port !== "55503" || !parsed.username || !parsed.password || parsed.hash ||
      !database || (expectedDatabase !== undefined && database !== expectedDatabase)) {
    throw new Error("Order 462 database URL is outside the admitted local PostgreSQL target");
  }
  return database;
}

function csv(rows: readonly (readonly string[])[], bom = false): string {
  const encoded = rows.map(row => row.map(value => {
    if (!/[",\r\n]/.test(value)) return value;
    return `"${value.replaceAll('"', '""')}"`;
  }).join(",")).join("\n");
  return `${bom ? "\uFEFF" : ""}${encoded}\n`;
}

function createSyntheticArchive(): string {
  const admittedParent = "D:/Yellow/temp/order462-acl-tests";
  mkdirSync(admittedParent, { recursive: true });
  const root = mkdtempSync(join(admittedParent, "postgres-proof-"));
  const archive = join(root, "archive");
  mkdirSync(archive);

  const hugeId = "900719925474099312345678901234567890";
  const dangerous = "</script><img src=x onerror=alert(1)>";
  const proofNonce = randomBytes(16).toString("hex");
  const listingHeader = [
    "platform", "compset", "listing_url", "Listing ID", "Listing Name",
    "Price", "Revenue", "Nullable",
  ];
  const files = new Map<string, string>([
    ["field_dictionary.json", JSON.stringify([{
      dataset: "market", source_field: "Price", storage: "source string",
      note: "NA, -NA, blank, and zero remain distinct",
    }])],
    ["csv/host/listing_inventory.csv", csv([
      ["source_listing_id", "pms", "full_listing_name", "City", "Min Price", "Base Price"],
      [hugeId, "PMS-A", dangerous, "Dubai", "NA", "0"],
      [hugeId, "PMS-B", "Line one\nLine two", "Dubai", "-NA", ""],
    ], true)],
    ["csv/host/inspected_listing_monthly_metrics.csv", csv([
      ["Month", "Revenue"], ["2026-08", "NA"],
    ])],
    ["csv/host/inspected_listing_recent_bookings.csv", csv([
      ["Booked Date", "Rental Revenue"], ["2026-08-01", "0"],
    ])],
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
  const timelines = [
    ["occupancy", "daily_occupancy.csv", ["Stay Date", "Occupancy | y"]],
    ["price_percentile_bands", "daily_price_percentile_bands.csv", ["Stay Dates", "Price | low", "Price | high"]],
    ["length_of_stay", "daily_length_of_stay.csv", ["Stay Date", "1 Night"]],
  ] as const;
  for (const view of ["view_alpha", "view_beta"]) {
    files.set(`csv/${view}/summary_1.csv`, csv([["Category", "Value"], ["Synthetic", "NA"]]));
    files.set(`csv/${view}/chart_catalog.csv`, csv([["chart_index", "chart_name"], ["1", "Synthetic"]]));
    files.set(`csv/${view}/chart_point_labels.csv`, csv([["chart_index", "source_point_label"], ["1", "NA"]]));
    for (const [, filename, header] of timelines) {
      files.set(`csv/${view}/${filename}`, csv([
        [...header],
        ["2026-09-07 00:00:00", ...header.slice(1).map(() => "NA")],
        ["2026-09-08 00:00:00", ...header.slice(1).map(() => "0")],
        ["2026-09-09 00:00:00", ...header.slice(1).map(() => "-NA")],
      ]));
    }
  }
  for (const [path, contents] of files) {
    const destination = join(archive, ...path.split("/"));
    mkdirSync(join(destination, ".."), { recursive: true });
    writeFileSync(destination, contents);
  }
  const dailyTimelines = timelines.map(([kind, , columns]) => ({
    kind, rows: 3, columns: [...columns],
  }));
  const manifest = {
    archive_version: "1.0",
    research_date: "2026-09-08",
    purpose: `synthetic Order 462 PostgreSQL integration evidence ${proofNonce}`,
    method: "synthetic",
    source_market: "Abu Dhabi",
    source_currency: "AED",
    market_refresh_label: "source label without a timezone",
    market_refresh_timezone: null,
    entire_pricelabs_account_export_complete: false,
    datasets: [
      { name: "Alpha", key: "view_alpha", platform: "Airbnb", membership_rows: 2,
        listing_fields: 5, listing_id_unique_within_view: true, chart_regions: 1,
        chart_point_labels: 1, daily_timelines: dailyTimelines },
      { name: "Beta", key: "view_beta", platform: "mixed", membership_rows: 2,
        listing_fields: 5, listing_id_unique_within_view: true, chart_regions: 1,
        chart_point_labels: 1, daily_timelines: dailyTimelines },
    ],
    gaps: ["Synthetic archive is deliberately incomplete."],
    host_inventory: { listing_records: 2, physical_property_count: "unknown",
      cities: { Dubai: 2 }, sample_listing_monthly_rows: 1, sample_recent_booking_rows: 1 },
    totals: { market_membership_rows: 4, unique_platform_listing_ids: 3,
      daily_timeline_tables: 6, daily_timeline_rows: 18, chart_regions: 2,
      chart_point_labels: 2 },
    files: [...files].map(([path, contents]) => ({
      path, bytes: Buffer.byteLength(contents), sha256: sha256(contents),
    })),
  };
  writeFileSync(join(archive, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  return archive;
}

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

async function expectSqlState(action: () => Promise<unknown>, state: string): Promise<void> {
  let caught: unknown;
  try {
    await action();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeDefined();
  const shaped = caught as { errno?: unknown; sqlState?: unknown; code?: unknown };
  const actual = [shaped.errno, shaped.sqlState, shaped.code]
    .find(value => typeof value === "string" && /^[0-9A-Z]{5}$/.test(value));
  expect(actual).toBe(state);
}

async function asRole(pool: SQL, role: string): Promise<ReservedSQL> {
  const connection = await pool.reserve();
  await connection.unsafe("SET statement_timeout = '25s'; SET lock_timeout = '3s'").simple();
  await connection.unsafe(`SET ROLE ${quoteIdentifier(role)}`);
  const identity = await connection.unsafe("SELECT current_user AS current_user, session_user AS session_user");
  expect(identity[0]?.current_user).toBe(role);
  expect(identity[0]?.session_user).not.toBe(role);
  return connection;
}

function verifiedPsql(): string {
  let cursor = PSQL_PATH;
  for (;;) {
    const entry = lstatSync(cursor);
    if (entry.isSymbolicLink()) throw new Error("Order 462 psql reparse ancestry refused");
    const parent = dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  const executable = lstatSync(PSQL_PATH);
  if (!executable.isFile() || sha256(readFileSync(PSQL_PATH)) !== PSQL_SHA256) {
    throw new Error("Order 462 psql executable changed");
  }
  return PSQL_PATH;
}

class PsqlJsonSession {
  private readonly decoder = new TextDecoder();
  private readonly reader: ReadableStreamDefaultReader<Uint8Array>;
  private buffered = "";
  private outputBytes = 0;

  constructor(
    private readonly child: ReturnType<typeof Bun.spawn>,
    private readonly token: string,
  ) {
    this.reader = (child.stdout as ReadableStream<Uint8Array>).getReader();
  }

  async send(sql: string): Promise<void> {
    const stdin = this.child.stdin;
    if (!stdin || typeof stdin === "number") throw new Error("Order 462 psql stdin unavailable");
    stdin.write(sql);
    await stdin.flush();
  }

  private async line(): Promise<string> {
    for (;;) {
      const newline = this.buffered.indexOf("\n");
      if (newline >= 0) {
        const line = this.buffered.slice(0, newline).replace(/\r$/, "");
        this.buffered = this.buffered.slice(newline + 1);
        return line;
      }
      const next = await this.reader.read();
      if (next.done) throw new Error("Order 462 psql ended before proof completed");
      this.outputBytes += next.value.byteLength;
      if (this.outputBytes > 64 * 1024) {
        this.child.kill();
        throw new Error("Order 462 psql stdout exceeded bound");
      }
      this.buffered += this.decoder.decode(next.value, { stream: true });
    }
  }

  async waitFor(marker: string): Promise<string[]> {
    const rows: string[] = [];
    for (;;) {
      const line = (await this.line()).trim();
      if (line === marker) return rows;
      if (line) rows.push(line);
    }
  }

  async unsafe(query: string): Promise<unknown[]> {
    // The frozen guard contains one explanatory line-comment semicolon. Remove
    // line comments before enforcing the single read-only statement contract.
    const clean = query.replace(/--[^\r\n]*/g, " ").trim();
    if (!/^SELECT\b/i.test(clean) || clean.includes(";") || clean.includes("\\") ||
        Buffer.byteLength(clean) > 16 * 1024) {
      throw new Error("Order 462 psql adapter refused non-read-only guard SQL");
    }
    const ordinal = randomBytes(8).toString("hex");
    const begin = `Q_BEGIN_${this.token}_${ordinal}`;
    const end = `Q_END_${this.token}_${ordinal}`;
    await this.send(`\\echo ${begin}\nSELECT COALESCE(json_agg(row_to_json(q)), '[]'::json)::text FROM (${clean}) AS q;\n\\echo ${end}\n`);
    await this.waitFor(begin);
    const payload = await this.waitFor(end);
    if (payload.length !== 1 || Buffer.byteLength(payload[0]!) > 32 * 1024) {
      throw new Error("Order 462 psql guard result was not singular and bounded");
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(payload[0]!);
    } catch {
      throw new Error("Order 462 psql guard result was not JSON");
    }
    if (!Array.isArray(parsed)) throw new Error("Order 462 psql guard result was not rows");
    return parsed;
  }
}

async function proveBuiltinMembershipRejectedWithPsql(adminUrl: string): Promise<void> {
  requireLocalPostgresUrl(adminUrl, "postgres");
  const parsed = new URL(adminUrl);
  if (decodeURIComponent(parsed.username) !== "yellow_deploy") {
    throw new Error("Order 462 psql authority actor changed");
  }
  const token = randomBytes(12).toString("hex");
  const ready = `READY_${token}`;
  let stderrBytes = 0;
  let stderrExceeded = false;
  let timedOut = false;
  const child = Bun.spawn([
    verifiedPsql(), "-h", "127.0.0.1", "-p", "55503", "-U", "yellow_deploy",
    "-d", "yellow_pricelabs_staging", "-X", "-q", "-A", "-t", "-w",
    "-v", "ON_ERROR_STOP=1",
  ], {
    stdin: "pipe", stdout: "pipe", stderr: "pipe",
    env: {
      SystemRoot: process.env.SystemRoot ?? "C:\\Windows",
      WINDIR: process.env.WINDIR ?? "C:\\Windows",
      TEMP: process.env.TEMP ?? "D:\\Yellow\\temp",
      TMP: process.env.TMP ?? process.env.TEMP ?? "D:\\Yellow\\temp",
      PGPASSWORD: decodeURIComponent(parsed.password),
      PGAPPNAME: "yellow-order462-rollback-proof",
      PGCONNECT_TIMEOUT: "5",
      PGSSLMODE: "disable",
    },
  });
  const stderrPump = (async () => {
    const reader = (child.stderr as ReadableStream<Uint8Array>).getReader();
    for (;;) {
      const next = await reader.read();
      if (next.done) return;
      stderrBytes += next.value.byteLength;
      if (stderrBytes > 8 * 1024) {
        stderrExceeded = true;
        child.kill();
        return;
      }
    }
  })();
  const session = new PsqlJsonSession(child, token);
  const operation = (async () => {
    await session.send(`BEGIN;\nSET LOCAL statement_timeout='20s';\nSET LOCAL lock_timeout='3s';\nGRANT pg_read_all_data TO app_role;\nSET LOCAL ROLE yellow_pricelabs_loader;\n\\echo ${ready}\n`);
    await session.waitFor(ready);
    mark("psql_builtin_fault_injected");
    const injected = await session.unsafe(`
      SELECT pg_has_role('app_role','pg_read_all_data','MEMBER') AS allowed
    `) as Array<{ allowed: boolean }>;
    if (injected.length !== 1 || injected[0]?.allowed !== true) {
      throw new Error("Order 462 psql transaction did not expose injected membership");
    }
    mark("psql_builtin_fault_visible");
    let rejected = false;
    try {
      await assertPriceLabsStagingIsolation(session as unknown as ReservedSQL);
    } catch (error) {
      rejected = error instanceof Error && error.message === "staging_privileges_not_isolated";
      if (!rejected) throw new Error("Order 462 isolation guard failed outside expected predicate");
    }
    if (!rejected) throw new Error("Order 462 isolation guard accepted predefined-role membership");
    mark("psql_builtin_fault_rejected");
  })();
  operation.catch(() => undefined);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          timedOut = true;
          child.kill();
          reject(new Error("Order 462 psql rollback proof timed out"));
        }, 30_000);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
    try {
      await session.send("ROLLBACK;\n\\quit\n");
      const stdin = child.stdin;
      if (stdin && typeof stdin !== "number") stdin.end();
    } catch {
      child.kill();
    }
    const exited = await Promise.race([
      child.exited.then(() => true),
      new Promise<boolean>(resolve => setTimeout(() => resolve(false), 3_000)),
    ]);
    if (!exited) child.kill();
    await stderrPump.catch(() => undefined);
    if (timedOut) mark("psql_builtin_fault_timeout");
  }
  if (stderrExceeded) throw new Error("Order 462 psql stderr exceeded bound");
  if (child.exitCode !== 0) throw new Error("Order 462 psql rollback proof failed");
}

type HostFingerprint = { database: string; digest: string; tables: number; sequences: number };

async function fingerprintDatabase(
  connection: ReservedSQL,
  expectedDatabase: string,
  includeClusterCatalogue: boolean,
): Promise<HostFingerprint> {
  await connection.unsafe("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  try {
    const identity = await connection.unsafe(`
      SELECT current_database() AS database_name, inet_server_port() AS port,
        host(inet_server_addr()) AS address, current_setting('transaction_read_only') AS read_only
    `);
    const database = identity[0]?.database_name as string;
    expect(database).toBe(expectedDatabase);
    expect(identity[0]?.port).toBe(55503);
    expect(identity[0]?.address).toBe("127.0.0.1");
    expect(identity[0]?.read_only).toBe("on");

    const catalogue = await connection.unsafe(`
      SELECT n.nspname AS schema_name, c.relname AS relation_name, c.relkind,
        pg_get_userbyid(c.relowner) AS owner, coalesce(c.relacl::text,'') AS acl,
        c.relrowsecurity, c.relforcerowsecurity
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname !~ '^pg_toast'
      ORDER BY n.nspname,c.relname,c.relkind
    `);
    const tables = (catalogue as Array<{ schema_name: string; relation_name: string; relkind: string }>)
      .filter(row => row.relkind === "r" || row.relkind === "p");
    const data: unknown[] = [];
    for (const table of tables) {
      const qualified = `${quoteIdentifier(table.schema_name)}.${quoteIdentifier(table.relation_name)}`;
      const rows = await connection.unsafe(`
        SELECT count(*)::text AS row_count,
          coalesce(sum(hashtextextended(to_jsonb(t)::text,0)::numeric),0)::text AS hash_zero,
          coalesce(sum(hashtextextended(to_jsonb(t)::text,8675309)::numeric),0)::text AS hash_second,
          coalesce(min(hashtextextended(to_jsonb(t)::text,0)),0)::text AS hash_min,
          coalesce(max(hashtextextended(to_jsonb(t)::text,0)),0)::text AS hash_max
        FROM ${qualified} t
      `);
      data.push({ schema: table.schema_name, table: table.relation_name, ...rows[0] });
    }
    const sequences = await connection.unsafe(`
      SELECT schemaname, sequencename, coalesce(last_value::text,'') AS last_value,
        start_value::text, increment_by::text, cycle, cache_size::text
      FROM pg_sequences
      WHERE schemaname NOT IN ('pg_catalog','information_schema') AND schemaname !~ '^pg_toast'
      ORDER BY schemaname,sequencename
    `);
    const clusterCatalogue = includeClusterCatalogue ? await connection.unsafe(`
        SELECT row_to_json(d)::text AS row FROM pg_database d
        WHERE datname <> 'yellow_pricelabs_staging' ORDER BY datname
      `) : [];
    const roleCatalogue = includeClusterCatalogue ? await connection.unsafe(`
        SELECT row_to_json(r)::text AS row FROM pg_roles r ORDER BY rolname
      `) : [];
    const nonStagingWrites = includeClusterCatalogue ? await connection.unsafe(`
        SELECT datname, tup_inserted::text, tup_updated::text, tup_deleted::text,
          conflicts::text, deadlocks::text
        FROM pg_stat_database WHERE datname IS NOT NULL AND datname <> 'yellow_pricelabs_staging'
        ORDER BY datname
      `) : [];
    const digest = sha256(JSON.stringify({
      catalogue, data, sequences, clusterCatalogue, roleCatalogue, nonStagingWrites,
    }));
    await connection.unsafe("COMMIT");
    return { database, digest, tables: tables.length, sequences: sequences.length };
  } catch (error) {
    await connection.unsafe("ROLLBACK").catch(() => undefined);
    throw error;
  }
}

liveDescribe("Order 462 isolated PriceLabs PostgreSQL staging", () => {
  test("rejects rollback-scoped predefined capability membership through native psql", async () => {
    await proveBuiltinMembershipRejectedWithPsql(ADMIN_URL!);
    const stagingUrl = new URL(ADMIN_URL!);
    stagingUrl.pathname = "/yellow_pricelabs_staging";
    const verificationPool = new SQL(stagingUrl.toString(), {
      max: 1, prepare: false, connectionTimeout: 5, idleTimeout: 1,
    });
    try {
      const restored = await verificationPool.unsafe(`
        SELECT pg_has_role('app_role','pg_read_all_data','MEMBER') AS membership,
          has_database_privilege('app_role',current_database(),'CONNECT') AS app_connect
      `);
      expect(restored).toEqual([{ membership: false, app_connect: false }]);
      mark("psql_builtin_fault_restored");
    } finally {
      await verificationPool.close({ timeout: 0 }).catch(() => undefined);
    }
  }, 45_000);

  test("loads once, no-ops once, preserves evidence, contains roles and restores the deliberate fault", async () => {
    requireLocalPostgresUrl(ADMIN_URL!, "postgres");
    const stagingUrl = new URL(ADMIN_URL!);
    stagingUrl.pathname = "/yellow_pricelabs_staging";
    const pmsUrl = new URL(ADMIN_URL!);
    pmsUrl.pathname = "/yellow_order444_review_a10851786f17";

    const stagingPool = new SQL(stagingUrl.toString(), {
      max: 5, prepare: false, connectionTimeout: 5, idleTimeout: 10,
    });
    const hostPool = new SQL(ADMIN_URL!, {
      max: 1, prepare: false, connectionTimeout: 5, idleTimeout: 10,
    });
    const pmsPool = new SQL(pmsUrl.toString(), {
      max: 1, prepare: false, connectionTimeout: 5, idleTimeout: 10,
    });
    let admin: ReservedSQL | undefined;
    let loader: ReservedSQL | undefined;
    let owner: ReservedSQL | undefined;
    let reader: ReservedSQL | undefined;
    let host: ReservedSQL | undefined;
    let pms: ReservedSQL | undefined;
    let faultGranted = false;
    try {
      admin = await stagingPool.reserve();
      host = await hostPool.reserve();
      pms = await pmsPool.reserve();
      for (const connection of [admin, host, pms]) {
        await connection.unsafe("SET statement_timeout = '25s'; SET lock_timeout = '3s'").simple();
      }
      mark("connections_reserved");
      const stagingIdentity = await admin.unsafe(`
        SELECT current_database() AS database_name, inet_server_port() AS port,
          host(inet_server_addr()) AS address, current_user AS actor,
          r.rolsuper, r.rolcanlogin
        FROM pg_roles r WHERE r.rolname=current_user
      `);
      expect(stagingIdentity).toHaveLength(1);
      expect(stagingIdentity[0]).toMatchObject({ database_name: "yellow_pricelabs_staging",
        port: 55503, address: "127.0.0.1", rolsuper: true, rolcanlogin: true });

      const roles = await admin.unsafe(`
        SELECT rolname, rolsuper, rolbypassrls, rolcanlogin, rolcreatedb, rolcreaterole,
          rolreplication FROM pg_roles WHERE rolname IN
          ('yellow_pricelabs_stage_owner','yellow_pricelabs_loader','yellow_pricelabs_reader','app_role')
        ORDER BY rolname
      `);
      expect(roles.map((row: { rolname: string }) => row.rolname)).toEqual([
        "app_role", "yellow_pricelabs_loader", "yellow_pricelabs_reader",
        "yellow_pricelabs_stage_owner",
      ]);
      for (const role of roles.filter((row: { rolname: string }) => row.rolname.startsWith("yellow_pricelabs_"))) {
        expect(role).toMatchObject({ rolsuper: false, rolbypassrls: false, rolcanlogin: false,
          rolcreatedb: false, rolcreaterole: false, rolreplication: false });
      }
      const memberships = await admin.unsafe(`
        SELECT 1 FROM pg_auth_members m
        WHERE m.roleid IN (SELECT oid FROM pg_roles WHERE rolname LIKE 'yellow_pricelabs_%')
           OR m.member IN (SELECT oid FROM pg_roles WHERE rolname LIKE 'yellow_pricelabs_%')
      `);
      expect(memberships).toHaveLength(0);
      const topology = await admin.unsafe(`
        SELECT pg_get_userbyid(d.datdba) AS database_owner,
          pg_get_userbyid(n.nspowner) AS schema_owner,
          has_database_privilege('app_role',current_database(),'CONNECT') AS app_connect,
          has_schema_privilege('app_role','pricelabs_staging','USAGE') AS app_schema,
          has_table_privilege('app_role','pricelabs_staging.import_bundle','SELECT,INSERT,UPDATE,DELETE,TRUNCATE') AS app_bundle,
          has_table_privilege('app_role','pricelabs_staging.archive_file','SELECT,INSERT,UPDATE,DELETE,TRUNCATE') AS app_file
        FROM pg_database d CROSS JOIN pg_namespace n
        WHERE d.datname=current_database() AND n.nspname='pricelabs_staging'
      `);
      expect(topology).toEqual([{ database_owner: "yellow_pricelabs_stage_owner",
        schema_owner: "yellow_pricelabs_stage_owner", app_connect: false,
        app_schema: false, app_bundle: false, app_file: false }]);
      const initialCounts = (await admin.unsafe(`
        SELECT (SELECT count(*)::int FROM pricelabs_staging.import_bundle) AS bundles,
          (SELECT count(*)::int FROM pricelabs_staging.archive_file) AS files
      `))[0] as { bundles: number; files: number };

      const hostBefore = await fingerprintDatabase(host, "postgres", true);
      const pmsBefore = await fingerprintDatabase(pms, "yellow_order444_review_a10851786f17", false);
      mark("baseline_fingerprints_complete");
      const archive = createSyntheticArchive();
      const bundle = preparePriceLabsDatabaseBundle(archive);
      loader = await asRole(stagingPool, "yellow_pricelabs_loader");
      owner = await asRole(stagingPool, "yellow_pricelabs_stage_owner");
      reader = await asRole(stagingPool, "yellow_pricelabs_reader");

      const first = await loadPriceLabsStaging(loader, archive);
      mark("first_load_complete");
      expect(first).toMatchObject({ status: "imported", operationalWrites: false,
        files: bundle.archiveFiles.length, ...bundle.identity });
      const storedBeforeNoop = await admin.unsafe(`
        SELECT manifest_sha256, importer_sha256, archive_sha256, staging_sha256,
          receipt_sha256, preview_sha256, source_commit, research_date::text,
          file_count, file_bytes::text, staging_document, receipt_document,
          imported_at::text
        FROM pricelabs_staging.import_bundle
        WHERE manifest_sha256=$1 AND importer_sha256=$2
      `, [bundle.identity.manifestSha256, bundle.identity.importerSha256]);
      expect(storedBeforeNoop).toHaveLength(1);
      expect(storedBeforeNoop[0]).toMatchObject({
        manifest_sha256: bundle.identity.manifestSha256,
        importer_sha256: bundle.identity.importerSha256,
        archive_sha256: bundle.identity.archiveSha256,
        staging_sha256: bundle.identity.stagingSha256,
        receipt_sha256: bundle.identity.receiptSha256,
        preview_sha256: bundle.identity.previewSha256,
        source_commit: bundle.identity.sourceCommit,
        research_date: "2026-09-08", file_count: bundle.archiveFiles.length,
        staging_document: bundle.staging, receipt_document: bundle.receipt });
      expect(storedBeforeNoop[0]?.file_bytes).toBe(String(
        bundle.archiveFiles.reduce((sum, file) => sum + file.bytes.byteLength, 0),
      ));
      expect(storedBeforeNoop[0]?.staging_document.hostListingRecords[0]).toMatchObject({
        sourceListingId: "900719925474099312345678901234567890",
        sourceFields: { "Min Price": "NA", "Base Price": "0" },
      });
      expect(storedBeforeNoop[0]?.staging_document.hostListingRecords[1].sourceFields).toMatchObject({
        "Min Price": "-NA", "Base Price": "", full_listing_name: "Line one\nLine two",
      });
      expect(storedBeforeNoop[0]?.staging_document.marketListings[0].memberships[0].sourceFields)
        .toMatchObject({ Price: "0", Revenue: "NA", Nullable: "" });

      const storedFiles = await admin.unsafe(`
        SELECT path, manifest_listed, byte_length::text, sha256, content
        FROM pricelabs_staging.archive_file
        WHERE manifest_sha256=$1 AND importer_sha256=$2 ORDER BY path
      `, [bundle.identity.manifestSha256, bundle.identity.importerSha256]);
      expect(storedFiles).toHaveLength(bundle.archiveFiles.length);
      const expectedFiles = new Map(bundle.archiveFiles.map(file => [file.path, file]));
      for (const file of storedFiles) {
        const expected = expectedFiles.get(file.path);
        expect(expected).toBeDefined();
        expect(file.manifest_listed).toBe(expected!.manifestListed);
        expect(file.byte_length).toBe(String(expected!.bytes.byteLength));
        expect(file.sha256).toBe(expected!.sha256);
        expect(Buffer.from(file.content)).toEqual(readFileSync(join(archive, ...file.path.split("/"))));
        expect(sha256(file.content)).toBe(file.sha256);
      }

      const second = await loadPriceLabsStaging(loader, archive);
      expect(second).toEqual({ ...first, status: "unchanged" });
      const storedAfterNoop = await admin.unsafe(`
        SELECT manifest_sha256, importer_sha256, archive_sha256, staging_sha256,
          receipt_sha256, preview_sha256, source_commit, research_date::text,
          file_count, file_bytes::text, staging_document, receipt_document,
          imported_at::text
        FROM pricelabs_staging.import_bundle
        WHERE manifest_sha256=$1 AND importer_sha256=$2
      `, [bundle.identity.manifestSha256, bundle.identity.importerSha256]);
      expect(storedAfterNoop).toEqual(storedBeforeNoop);
      const finalCounts = (await admin.unsafe(`
        SELECT (SELECT count(*)::int FROM pricelabs_staging.import_bundle) AS bundles,
          (SELECT count(*)::int FROM pricelabs_staging.archive_file) AS files
      `))[0] as { bundles: number; files: number };
      expect(finalCounts).toEqual({ bundles: initialCounts.bundles + 1,
        files: initialCounts.files + bundle.archiveFiles.length });
      mark("noop_verified");

      const key = [bundle.identity.manifestSha256, bundle.identity.importerSha256];
      for (const statement of [
        `UPDATE pricelabs_staging.import_bundle SET research_date=research_date WHERE manifest_sha256=$1 AND importer_sha256=$2`,
        `DELETE FROM pricelabs_staging.import_bundle WHERE manifest_sha256=$1 AND importer_sha256=$2`,
        `UPDATE pricelabs_staging.archive_file SET path=path WHERE manifest_sha256=$1 AND importer_sha256=$2`,
        `DELETE FROM pricelabs_staging.archive_file WHERE manifest_sha256=$1 AND importer_sha256=$2`,
        "TRUNCATE pricelabs_staging.archive_file",
        "TRUNCATE pricelabs_staging.import_bundle, pricelabs_staging.archive_file",
      ]) {
        await expectSqlState(
          () => statement.includes("$1") ? owner!.unsafe(statement, key) : owner!.unsafe(statement),
          "42501",
        );
      }
      mark("immutability_verified");
      for (const table of ["import_bundle", "archive_file"]) {
        await expectSqlState(() => reader!.unsafe(
          `INSERT INTO pricelabs_staging.${table} SELECT * FROM pricelabs_staging.${table} WHERE false`,
        ), "42501");
      }
      mark("reader_denied");

      await admin.unsafe("SET ROLE app_role");
      try {
        await expectSqlState(
          () => admin!.unsafe("SELECT count(*) FROM pricelabs_staging.import_bundle"),
          "42501",
        );
      } finally {
        await admin.unsafe("RESET ROLE");
      }
      mark("app_role_denied");

      expect((await admin.unsafe(`SELECT has_database_privilege(
        'app_role',current_database(),'CONNECT') AS allowed`))[0]?.allowed).toBe(false);
      await admin.unsafe("GRANT CONNECT ON DATABASE yellow_pricelabs_staging TO app_role");
      faultGranted = true;
      expect((await admin.unsafe(`SELECT has_database_privilege(
        'app_role',current_database(),'CONNECT') AS allowed`))[0]?.allowed).toBe(true);
      try {
        await expect(loadPriceLabsStaging(loader, archive))
          .rejects.toThrow("staging_privileges_not_isolated");
      } finally {
        await admin.unsafe("REVOKE CONNECT ON DATABASE yellow_pricelabs_staging FROM app_role");
        faultGranted = false;
      }
      expect((await admin.unsafe(`SELECT has_database_privilege(
        'app_role',current_database(),'CONNECT') AS allowed`))[0]?.allowed).toBe(false);
      expect((await loadPriceLabsStaging(loader, archive)).status).toBe("unchanged");
      mark("connect_fault_restored");

      expect((await admin.unsafe(`
        SELECT pg_has_role('app_role','pg_read_all_data','MEMBER') AS allowed
      `))[0]?.allowed).toBe(false);
      mark("predefined_membership_denied");

      expect(await fingerprintDatabase(host, "postgres", true)).toEqual(hostBefore);
      expect(await fingerprintDatabase(pms, "yellow_order444_review_a10851786f17", false))
        .toEqual(pmsBefore);
      mark("final_fingerprints_complete");
    } finally {
      if (faultGranted && admin) {
        await admin.unsafe("REVOKE CONNECT ON DATABASE yellow_pricelabs_staging FROM app_role")
          .catch(() => undefined);
      }
      for (const connection of [reader, owner, loader, pms, host, admin]) {
        try { connection?.release(); } catch { /* best-effort session release */ }
      }
      mark("connections_released");
      await Promise.all([
        hostPool.close({ timeout: 0 }).catch(() => undefined),
        pmsPool.close({ timeout: 0 }).catch(() => undefined),
        stagingPool.close({ timeout: 0 }).catch(() => undefined),
      ]);
      mark("pools_closed");
    }
  }, 120_000);
});
