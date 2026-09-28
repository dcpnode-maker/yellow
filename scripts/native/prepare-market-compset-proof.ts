/**
 * Order472's one-shot, root-operated PostgreSQL proof preparation.
 *
 * This module is deliberately inert on import.  It accepts no ambient database
 * fallback and never prints a URL, database error, credential, or role password.
 * `Prepare` is the only operation that creates the exact retained proof target;
 * it never drops, truncates, or cleans up that target.
 */
import { lstat, readFile, readdir, statfs } from "node:fs/promises";
import { resolve } from "node:path";
import { SQL } from "bun";

export const ORDER472_PROOF_DATABASE = "yellow_order472_compset_20260913";
export const ORDER472_PROOF_TEMPLATE = "yellow_order434_production";
export const ORDER472_PROOF_HOST = "127.0.0.1";
export const ORDER472_PROOF_PORT = 55503;
export const ORDER472_PROOF_OPT_IN = "YELLOW_REQUIRE_MARKET_COMPSET_INTEGRATION";

const DEPLOY_URL = "YELLOW_ORDER472_MARKET_COMPSET_DEPLOY_DATABASE_URL";
const RUNTIME_URL = "YELLOW_ORDER472_MARKET_COMPSET_RUNTIME_DATABASE_URL";
const REGISTRAR_URL = "YELLOW_ORDER472_MARKET_COMPSET_REGISTRAR_DATABASE_URL";
const ACTION = "YELLOW_ORDER472_MARKET_COMPSET_ACTION";
const EXPECTED_DATABASE_ROLES = Object.freeze({
  [DEPLOY_URL]: "yellow_deploy",
  [RUNTIME_URL]: "yellow_runtime",
  [REGISTRAR_URL]: "yellow_extension_registrar",
});
const MIGRATIONS_DIRECTORY = resolve(import.meta.dir, "..", "..", "migrations");
const CLUSTER_VOLUME = "D:\\";
const MAX_TEMPLATE_BYTES = 512 * 1024 * 1024;
const MINIMUM_FREE_BYTES = 2 * 1024 * 1024 * 1024;
const CLONE_RESERVE_BYTES = 512 * 1024 * 1024;
const EXPECTED_SERVER_VERSION = "160015";
const EXPECTED_DATA_DIRECTORY = "D:/Yellow/temp/order434-production-cluster-20260906";
const EXPECTED_TABLE_COUNT = 127;
const EXPECTED_TEMPLATE_MIGRATIONS = 77;
const FORWARD_FIRST = 78;
const FORWARD_LAST = 92;
const SQL_CONNECT_TIMEOUT_SECONDS = 5;
const SQL_STATEMENT_TIMEOUT_MILLISECONDS = 20_000;
const SQL_LOCK_TIMEOUT_MILLISECONDS = 5_000;
const MIGRATION_CHILD_TIMEOUT_MILLISECONDS = 120_000;

const NATIVE_BINARIES = Object.freeze([
  Object.freeze({
    path: "E:\\yellow\\toolchains\\postgresql-16.15\\pgsql\\bin\\postgres.exe",
    sha256: "324ac242d623edcf82822f0c59c5dc2f8e74049d9dbb7ebc738bdaf5824e2ae6",
  }),
  Object.freeze({
    path: "E:\\yellow\\toolchains\\postgresql-16.15\\pgsql\\bin\\psql.exe",
    sha256: "e7acd0437ac9a15e4821c39dac3e51939a0d16e09ea0d9bb106ad2c8645626ac",
  }),
] as const);

export type MarketCompsetProofAction = "Review" | "Prepare";

export interface MarketCompsetProofEnvironment {
  readonly deployDatabaseUrl: string;
  readonly runtimeDatabaseUrl: string;
  readonly registrarDatabaseUrl: string;
}

export interface MarketCompsetProofReceipt {
  readonly action: MarketCompsetProofAction;
  readonly database: typeof ORDER472_PROOF_DATABASE;
  readonly template: typeof ORDER472_PROOF_TEMPLATE;
  readonly host: typeof ORDER472_PROOF_HOST;
  readonly port: typeof ORDER472_PROOF_PORT;
  readonly serverVersion: string;
  readonly templateBytes: number;
  readonly freeBytes: number;
  readonly templateMigrationCount: number;
  readonly templateTableCount: number;
  /** All local migration filenames/checksums observed before clone, never SQL text. */
  readonly localMigrationCatalogueSha256: string;
  readonly suffixChecksumSha256: string;
  readonly roleMembershipFingerprint: string;
  readonly outsideCatalogFingerprint: string;
  readonly nativeBinaries: readonly NativeBinaryReceipt[];
  readonly targetCreated: boolean;
  readonly appliedSuffix: readonly string[];
}

interface NativeBinaryReceipt {
  readonly path: string;
  readonly sha256: string;
}

interface VerifiedPreflight {
  readonly receipt: Omit<MarketCompsetProofReceipt, "action" | "targetCreated" | "appliedSuffix">;
}

interface DatabaseIdentityRow {
  readonly database_name: string;
  readonly session_role: string;
  readonly effective_role: string;
  readonly server_address: string | null;
  readonly server_port: number;
  readonly server_version: string;
  readonly data_directory: string;
}

interface TemplateRow {
  readonly owner: string;
  readonly bytes: number | string;
  readonly sessions: number | string;
  readonly tenants: number | string;
  readonly tables: number | string;
  readonly migrations: number | string;
}

interface LedgerRow {
  readonly version: number | string;
  readonly filename: string;
  readonly checksum_sha256: string;
}

interface FingerprintRow {
  readonly roles: unknown;
  readonly memberships: unknown;
  readonly databases: unknown;
}

class ProofFailure extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "ProofFailure";
  }
}

function fail(code: string): never {
  throw new ProofFailure(code);
}

async function safeProofOperation<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof ProofFailure) throw error;
    // Database drivers may embed a connection URL in an error. Public callers and
    // the CLI receive only this static outcome instead of driver diagnostics.
    fail("market_compset_proof_failed");
  }
}

function sha256(value: Uint8Array | string): string {
  return new Bun.CryptoHasher("sha256").update(value).digest("hex");
}

function asCount(value: number | string, code: string): number {
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(numberValue) || numberValue < 0) fail(code);
  return numberValue;
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
}

function strictTargetUrl(value: string | undefined, expectedRole: string, variable: string): string {
  if (typeof value !== "string" || value.length === 0) fail(`missing_${variable.toLowerCase()}`);
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    fail(`invalid_${variable.toLowerCase()}`);
  }

  let username = "";
  try {
    username = decodeURIComponent(parsed.username);
  } catch {
    fail(`invalid_${variable.toLowerCase()}`);
  }
  if (
    (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:")
    || parsed.hostname !== ORDER472_PROOF_HOST
    || parsed.port !== String(ORDER472_PROOF_PORT)
    || username !== expectedRole
    || parsed.pathname !== `/${ORDER472_PROOF_DATABASE}`
    || parsed.search !== ""
    || parsed.hash !== ""
    || parsed.password.length === 0
  ) {
    fail(`invalid_${variable.toLowerCase()}`);
  }
  return value;
}

/** Parses only explicit, exact-target Order472 authority; there is no fallback. */
export function readMarketCompsetProofEnvironment(environment: NodeJS.ProcessEnv = process.env): MarketCompsetProofEnvironment {
  if (environment[ORDER472_PROOF_OPT_IN] !== "1") fail("market_compset_proof_not_opted_in");
  return Object.freeze({
    deployDatabaseUrl: strictTargetUrl(environment[DEPLOY_URL], EXPECTED_DATABASE_ROLES[DEPLOY_URL], DEPLOY_URL),
    runtimeDatabaseUrl: strictTargetUrl(environment[RUNTIME_URL], EXPECTED_DATABASE_ROLES[RUNTIME_URL], RUNTIME_URL),
    registrarDatabaseUrl: strictTargetUrl(environment[REGISTRAR_URL], EXPECTED_DATABASE_ROLES[REGISTRAR_URL], REGISTRAR_URL),
  });
}

function validateProofEnvironment(environment: MarketCompsetProofEnvironment): MarketCompsetProofEnvironment {
  return Object.freeze({
    deployDatabaseUrl: strictTargetUrl(environment.deployDatabaseUrl, EXPECTED_DATABASE_ROLES[DEPLOY_URL], DEPLOY_URL),
    runtimeDatabaseUrl: strictTargetUrl(environment.runtimeDatabaseUrl, EXPECTED_DATABASE_ROLES[RUNTIME_URL], RUNTIME_URL),
    registrarDatabaseUrl: strictTargetUrl(environment.registrarDatabaseUrl, EXPECTED_DATABASE_ROLES[REGISTRAR_URL], REGISTRAR_URL),
  });
}

function administrativeUrl(deployDatabaseUrl: string): string {
  const url = new URL(deployDatabaseUrl);
  url.pathname = "/postgres";
  return url.toString();
}

async function hashRegularFile(path: string): Promise<string> {
  const information = await lstat(path).catch(() => fail("native_binary_missing"));
  if (!information.isFile() || information.isSymbolicLink()) fail("native_binary_not_regular");
  return sha256(await readFile(path));
}

async function verifyNativeBinaries(): Promise<readonly NativeBinaryReceipt[]> {
  const verified: NativeBinaryReceipt[] = [];
  for (const binary of NATIVE_BINARIES) {
    const digest = await hashRegularFile(binary.path);
    if (digest !== binary.sha256) fail("native_binary_checksum_mismatch");
    verified.push(Object.freeze({ path: binary.path, sha256: digest }));
  }
  return Object.freeze(verified);
}

async function openBoundedSql(databaseUrl: string): Promise<SQL> {
  const connection = new SQL(databaseUrl, {
    max: 1,
    connectionTimeout: SQL_CONNECT_TIMEOUT_SECONDS,
    idleTimeout: SQL_CONNECT_TIMEOUT_SECONDS,
    maxLifetime: 30,
  });
  try {
    await connection.unsafe(`SET statement_timeout = '${SQL_STATEMENT_TIMEOUT_MILLISECONDS}ms'`);
    await connection.unsafe(`SET lock_timeout = '${SQL_LOCK_TIMEOUT_MILLISECONDS}ms'`);
    return connection;
  } catch {
    await connection.close().catch(() => undefined);
    fail("database_connection_or_timeout_configuration_failed");
  }
}

interface LocalMigration {
  readonly version: number;
  readonly filename: string;
  readonly checksum: string;
  readonly sql: string;
}

async function readLocalMigrations(): Promise<readonly LocalMigration[]> {
  const names = await readdir(MIGRATIONS_DIRECTORY);
  const migrations: LocalMigration[] = [];
  for (const filename of names) {
    const matched = /^(\d{4})_[a-z0-9][a-z0-9_-]*\.sql$/.exec(filename);
    if (!matched) continue;
    const version = Number(matched[1]);
    const path = resolve(MIGRATIONS_DIRECTORY, filename);
    const information = await lstat(path).catch(() => fail("migration_file_missing"));
    if (!information.isFile() || information.isSymbolicLink()) fail("migration_file_not_regular");
    const bytes = await readFile(path);
    let sql: string;
    try {
      sql = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
    } catch {
      fail("migration_file_not_utf8");
    }
    if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) fail("migration_file_bom");
    migrations.push(Object.freeze({ version, filename, checksum: sha256(bytes), sql }));
  }
  migrations.sort((left, right) => left.version - right.version || left.filename.localeCompare(right.filename));
  if (migrations.some((migration, index) => index > 0 && migration.version === migrations[index - 1]?.version)) {
    fail("duplicate_local_migration_version");
  }
  return Object.freeze(migrations);
}

function validateLocalMigrationCatalogue(migrations: readonly LocalMigration[]): void {
  if (migrations.length !== FORWARD_LAST) fail("local_migration_catalogue_not_exact_1_to_92");
  for (let version = 1; version <= FORWARD_LAST; version += 1) {
    if (migrations[version - 1]?.version !== version) fail("local_migration_catalogue_not_exact_1_to_92");
  }
}

function migrationCatalogueChecksum(migrations: readonly LocalMigration[]): string {
  return sha256(migrations.map(migration => `${migration.filename}:${migration.checksum}\n`).join(""));
}

function validateForwardSuffix(migrations: readonly LocalMigration[]): { readonly names: readonly string[]; readonly checksum: string } {
  const suffix = migrations.filter(migration => migration.version >= FORWARD_FIRST && migration.version <= FORWARD_LAST);
  if (suffix.length !== FORWARD_LAST - FORWARD_FIRST + 1) fail("forward_suffix_incomplete");
  for (let version = FORWARD_FIRST; version <= FORWARD_LAST; version += 1) {
    if (suffix[version - FORWARD_FIRST]?.version !== version) fail("forward_suffix_noncontiguous");
  }
  // Suffix migrations may grant object privileges, but may not create/change global
  // roles or their membership edges.  This deliberately rejects only role grammar.
  for (const migration of suffix) {
    if (/\b(?:CREATE|ALTER|DROP)\s+ROLE\b/i.test(migration.sql)
      || /\bGRANT\s+(?:yellow_deploy|yellow_owner|yellow_runtime|yellow_extension_registrar|app_role)\s+TO\b/i.test(migration.sql)
      || /\bREVOKE\s+(?:yellow_deploy|yellow_owner|yellow_runtime|yellow_extension_registrar|app_role)\s+FROM\b/i.test(migration.sql)) {
      fail("forward_suffix_changes_global_roles");
    }
  }
  return Object.freeze({
    names: Object.freeze(suffix.map(migration => migration.filename)),
    checksum: sha256(suffix.map(migration => `${migration.filename}:${migration.checksum}\n`).join("")),
  });
}

function validateTemplateLedger(rows: readonly LedgerRow[], migrations: readonly LocalMigration[]): void {
  if (rows.length !== EXPECTED_TEMPLATE_MIGRATIONS) fail("template_migration_count");
  const expected = migrations.filter(migration => migration.version >= 1 && migration.version <= EXPECTED_TEMPLATE_MIGRATIONS);
  if (expected.length !== EXPECTED_TEMPLATE_MIGRATIONS) fail("local_template_migration_set");
  for (let index = 0; index < EXPECTED_TEMPLATE_MIGRATIONS; index += 1) {
    const row = rows[index];
    const local = expected[index];
    if (!row || !local || asCount(row.version, "template_migration_version") !== local.version
      || row.filename !== local.filename || row.checksum_sha256 !== local.checksum) {
      fail("template_migration_checksum_mismatch");
    }
  }
}

async function verifyServerIdentity(connection: SQL): Promise<DatabaseIdentityRow> {
  const rows = await connection<DatabaseIdentityRow[]>`
    SELECT current_database() AS database_name,
           session_user AS session_role,
           current_user AS effective_role,
           host(inet_server_addr()) AS server_address,
           inet_server_port() AS server_port,
           current_setting('server_version_num') AS server_version,
           current_setting('data_directory') AS data_directory
  `;
  const row = rows[0];
  if (rows.length !== 1 || !row || row.database_name !== "postgres" || row.session_role !== "yellow_deploy"
    || row.effective_role !== "yellow_deploy" || row.server_address !== ORDER472_PROOF_HOST
    || row.server_port !== ORDER472_PROOF_PORT || row.server_version !== EXPECTED_SERVER_VERSION
    || row.data_directory.replaceAll("\\", "/") !== EXPECTED_DATA_DIRECTORY) {
    fail("cluster_identity_mismatch");
  }
  return row;
}

async function readTemplateState(connection: SQL, templateUrl: string): Promise<{ readonly template: TemplateRow; readonly ledger: readonly LedgerRow[] }> {
  // Check the clone preconditions from postgres before opening the template: a
  // connection to the template itself would otherwise make its session count one.
  const catalogue = await connection<TemplateRow[]>`
    SELECT pg_get_userbyid(d.datdba) AS owner,
           pg_database_size(d.datname) AS bytes,
           (SELECT count(*) FROM pg_stat_activity a WHERE a.datname = d.datname) AS sessions,
           0::bigint AS tenants,
           0::bigint AS tables,
           0::bigint AS migrations
      FROM pg_database d
     WHERE d.datname = ${ORDER472_PROOF_TEMPLATE}
  `;
  if (catalogue.length !== 1 || !catalogue[0] || asCount(catalogue[0].sessions, "template_session_count_invalid") !== 0) {
    fail("template_missing_or_active");
  }
  const templateConnection = await openBoundedSql(templateUrl);
  try {
    const details = await templateConnection<TemplateRow[]>`
      SELECT ''::text AS owner,
             0::bigint AS bytes,
             0::bigint AS sessions,
             (SELECT count(*) FROM tenant) AS tenants,
             (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')) AS tables,
             (SELECT count(*) FROM public.schema_migration) AS migrations
        FROM pg_database d WHERE d.datname = ${ORDER472_PROOF_TEMPLATE}
    `;
    const ledger = await templateConnection<LedgerRow[]>`
      SELECT version, filename, checksum_sha256 FROM public.schema_migration ORDER BY version
    `;
    if (details.length !== 1 || !details[0]) fail("template_missing");
    return Object.freeze({
      template: Object.freeze({
        ...details[0],
        owner: catalogue[0].owner,
        bytes: catalogue[0].bytes,
        sessions: catalogue[0].sessions,
      }),
      ledger: Object.freeze(ledger),
    });
  } finally {
    await templateConnection.close();
  }
}

// This derives a non-secret URL for a second connection only from a previously
// validated deploy URL; it is never emitted in a receipt or failure.
function templateUrlFromDeploy(deployDatabaseUrl: string): string {
  const url = new URL(deployDatabaseUrl);
  url.pathname = `/${ORDER472_PROOF_TEMPLATE}`;
  return url.toString();
}

async function fingerprints(connection: SQL): Promise<{ readonly roles: string; readonly outsideCatalog: string }> {
  const rows = await connection<FingerprintRow[]>`
    SELECT
      (SELECT jsonb_agg(to_jsonb(role_row) ORDER BY role_row.rolname)
         FROM (SELECT rolname, rolcanlogin, rolconnlimit, rolsuper, rolcreatedb,
                      rolcreaterole, rolinherit, rolreplication, rolbypassrls,
                      rolvaliduntil
                 FROM pg_catalog.pg_roles ORDER BY rolname) role_row) AS roles,
      (SELECT jsonb_agg(to_jsonb(member_row) ORDER BY member_row.granted_role, member_row.member_role)
         FROM (SELECT granted.rolname AS granted_role, member.rolname AS member_role,
                      membership.admin_option, membership.inherit_option, membership.set_option
                 FROM pg_catalog.pg_auth_members membership
                 JOIN pg_catalog.pg_roles granted ON granted.oid = membership.roleid
                 JOIN pg_catalog.pg_roles member ON member.oid = membership.member
                ORDER BY granted.rolname, member.rolname) member_row) AS memberships,
      (SELECT jsonb_agg(to_jsonb(database_row) ORDER BY database_row.datname)
         FROM (SELECT d.datname, pg_get_userbyid(d.datdba) AS owner, d.datistemplate,
                      d.datallowconn, d.datconnlimit
                 FROM pg_database d WHERE d.datname <> ${ORDER472_PROOF_DATABASE}
                ORDER BY d.datname) database_row) AS databases
  `;
  const row = rows[0];
  if (rows.length !== 1 || !row) fail("catalogue_fingerprint_unavailable");
  return Object.freeze({
    roles: sha256(stableJson({ roles: row.roles, memberships: row.memberships })),
    outsideCatalog: sha256(stableJson(row.databases)),
  });
}

async function targetAbsent(connection: SQL): Promise<void> {
  const rows = await connection<Array<{ readonly present: boolean }>>`
    SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = ${ORDER472_PROOF_DATABASE}) AS present
  `;
  if (rows.length !== 1 || rows[0]?.present !== false) fail("proof_target_not_absent");
}

async function preflight(environment: MarketCompsetProofEnvironment): Promise<VerifiedPreflight> {
  const validated = validateProofEnvironment(environment);
  const [nativeBinaries, migrations] = await Promise.all([verifyNativeBinaries(), readLocalMigrations()]);
  validateLocalMigrationCatalogue(migrations);
  const suffix = validateForwardSuffix(migrations);
  const templateUrl = templateUrlFromDeploy(validated.deployDatabaseUrl);
  const administrative = await openBoundedSql(administrativeUrl(validated.deployDatabaseUrl));
  try {
    const identity = await verifyServerIdentity(administrative);
    await targetAbsent(administrative);
    const [templateState, clusterFingerprint, filesystem] = await Promise.all([
      readTemplateState(administrative, templateUrl),
      fingerprints(administrative),
      statfs(CLUSTER_VOLUME).catch(() => fail("cluster_volume_unavailable")),
    ]);
    validateTemplateLedger(templateState.ledger, migrations);
    const templateBytes = asCount(templateState.template.bytes, "template_size_invalid");
    const sessions = asCount(templateState.template.sessions, "template_session_count_invalid");
    const tenants = asCount(templateState.template.tenants, "template_tenant_count_invalid");
    const tables = asCount(templateState.template.tables, "template_table_count_invalid");
    const migrationCount = asCount(templateState.template.migrations, "template_migration_count_invalid");
    const freeBytes = Number(filesystem.bavail) * Number(filesystem.bsize);
    if (!Number.isSafeInteger(freeBytes) || templateState.template.owner !== "yellow_deploy" || sessions !== 0
      || tenants !== 0 || tables !== EXPECTED_TABLE_COUNT || migrationCount !== EXPECTED_TEMPLATE_MIGRATIONS
      || templateBytes > MAX_TEMPLATE_BYTES || freeBytes < Math.max(MINIMUM_FREE_BYTES, templateBytes * 2 + CLONE_RESERVE_BYTES)) {
      fail("template_or_disk_preflight_mismatch");
    }
    return Object.freeze({
      nativeBinaries,
      receipt: Object.freeze({
        database: ORDER472_PROOF_DATABASE,
        template: ORDER472_PROOF_TEMPLATE,
        host: ORDER472_PROOF_HOST,
        port: ORDER472_PROOF_PORT,
        serverVersion: identity.server_version,
        templateBytes,
        freeBytes,
        templateMigrationCount: migrationCount,
        templateTableCount: tables,
        localMigrationCatalogueSha256: migrationCatalogueChecksum(migrations),
        suffixChecksumSha256: suffix.checksum,
        roleMembershipFingerprint: clusterFingerprint.roles,
        outsideCatalogFingerprint: clusterFingerprint.outsideCatalog,
        nativeBinaries,
      }),
    });
  } finally {
    await administrative.close();
  }
}

/** Read-only preflight; it never creates a database or calls the migration runner. */
export async function reviewMarketCompsetProof(environment: MarketCompsetProofEnvironment): Promise<MarketCompsetProofReceipt> {
  return await safeProofOperation(async () => {
    const verified = await preflight(environment);
    return Object.freeze({ ...verified.receipt, action: "Review", targetCreated: false, appliedSuffix: Object.freeze([]) });
  });
}

async function createTarget(environment: MarketCompsetProofEnvironment): Promise<void> {
  const connection = await openBoundedSql(administrativeUrl(environment.deployDatabaseUrl));
  try {
    await targetAbsent(connection);
    const template = await connection<Array<{ readonly owner: string; readonly sessions: number | string }>>`
      SELECT pg_get_userbyid(d.datdba) AS owner,
             (SELECT count(*) FROM pg_stat_activity a WHERE a.datname = d.datname) AS sessions
        FROM pg_database d WHERE d.datname = ${ORDER472_PROOF_TEMPLATE}
    `;
    if (template.length !== 1 || template[0]?.owner !== "yellow_deploy"
      || asCount(template[0]?.sessions ?? -1, "template_session_count_invalid") !== 0) {
      fail("template_changed_before_clone");
    }
    // All identifiers here are fixed module constants, never environment input.
    await connection.unsafe(
      "CREATE DATABASE yellow_order472_compset_20260913 TEMPLATE yellow_order434_production OWNER yellow_deploy",
    );
  } finally {
    await connection.close();
  }
}

async function verifyPreparedTarget(environment: MarketCompsetProofEnvironment, expectedMigrations: readonly LocalMigration[]): Promise<void> {
  const target = await openBoundedSql(environment.deployDatabaseUrl);
  try {
    const identity = await target<DatabaseIdentityRow[]>`
      SELECT current_database() AS database_name, session_user AS session_role, current_user AS effective_role,
             host(inet_server_addr()) AS server_address, inet_server_port() AS server_port,
             current_setting('server_version_num') AS server_version,
             current_setting('data_directory') AS data_directory
    `;
    const first = identity[0];
    if (identity.length !== 1 || !first || first.database_name !== ORDER472_PROOF_DATABASE
      || first.session_role !== "yellow_deploy" || first.effective_role !== "yellow_deploy"
      || first.server_address !== ORDER472_PROOF_HOST || first.server_port !== ORDER472_PROOF_PORT
      || first.server_version !== EXPECTED_SERVER_VERSION
      || first.data_directory.replaceAll("\\", "/") !== EXPECTED_DATA_DIRECTORY) fail("prepared_target_identity_mismatch");
    const ledger = await target<LedgerRow[]>`SELECT version, filename, checksum_sha256 FROM public.schema_migration ORDER BY version`;
    if (ledger.length !== FORWARD_LAST) fail("prepared_target_suffix_mismatch");
    for (let index = 0; index < FORWARD_LAST; index += 1) {
      const actual = ledger[index];
      const expected = expectedMigrations[index];
      if (!actual || !expected || asCount(actual.version, "prepared_target_ledger_version") !== expected.version
        || actual.filename !== expected.filename || actual.checksum_sha256 !== expected.checksum) {
        fail("prepared_target_suffix_mismatch");
      }
    }
    if (ledger.slice(FORWARD_FIRST - 1).map(row => row.filename).join("\n") !== expectedMigrations.slice(FORWARD_FIRST - 1).map(row => row.filename).join("\n")) {
      fail("prepared_target_suffix_mismatch");
    }
  } finally {
    await target.close();
  }
}

/**
 * Root-only mutating operation. It first completes the same preflight as Review,
 * creates the one exact target once, then invokes the canonical migration runner.
 * A failure deliberately leaves target evidence intact for root inspection.
 */
export async function prepareMarketCompsetProof(environment: MarketCompsetProofEnvironment): Promise<MarketCompsetProofReceipt> {
  return await safeProofOperation(async () => {
    const validated = validateProofEnvironment(environment);
    const verified = await preflight(validated);
    const migrations = await readLocalMigrations();
    validateLocalMigrationCatalogue(migrations);
    const suffix = validateForwardSuffix(migrations);
    // The source tree is shared while this operation is reviewed. Bind the second
    // local read before CREATE DATABASE, rather than allowing a changed migration
    // (including a historical 1–77 checksum) to ride the already-proved template.
    if (migrationCatalogueChecksum(migrations) !== verified.receipt.localMigrationCatalogueSha256) {
      fail("local_migration_catalogue_changed_after_preflight");
    }
    if (suffix.checksum !== verified.receipt.suffixChecksumSha256) {
      fail("forward_suffix_changed_after_preflight");
    }
    await createTarget(validated);
    await runCanonicalMigrationChild(validated.deployDatabaseUrl);
    await verifyPreparedTarget(validated, migrations);
    const after = await openBoundedSql(administrativeUrl(validated.deployDatabaseUrl));
    try {
      const fingerprint = await fingerprints(after);
      if (fingerprint.roles !== verified.receipt.roleMembershipFingerprint
        || fingerprint.outsideCatalog !== verified.receipt.outsideCatalogFingerprint) {
        fail("cluster_global_fingerprint_changed");
      }
    } finally {
      await after.close();
    }
    return Object.freeze({
      ...verified.receipt,
      action: "Prepare",
      targetCreated: true,
      appliedSuffix: Object.freeze([...suffix.names]),
    });
  });
}

async function runCanonicalMigrationChild(deployDatabaseUrl: string): Promise<void> {
  const child = Bun.spawn({
    cmd: [process.execPath, resolve(import.meta.dir, "..", "migrate.ts")],
    cwd: resolve(import.meta.dir, "..", ".."),
    env: {
      PATH: process.env.PATH ?? "",
      YELLOW_DEPLOY_DATABASE_URL: deployDatabaseUrl,
      YELLOW_MIGRATIONS_DIR: MIGRATIONS_DIRECTORY,
    },
    stdin: "ignore",
    stdout: "ignore",
    stderr: "ignore",
  });
  const timeout = setTimeout(() => child.kill(), MIGRATION_CHILD_TIMEOUT_MILLISECONDS);
  try {
    const exitCode = await child.exited;
    if (exitCode !== 0) fail("canonical_migration_runner_failed");
  } finally {
    clearTimeout(timeout);
  }
}

export async function runMarketCompsetProofCli(environment: NodeJS.ProcessEnv = process.env): Promise<void> {
  const action = environment[ACTION];
  if (action !== "Review" && action !== "Prepare") fail("market_compset_proof_action_required");
  const configuration = readMarketCompsetProofEnvironment(environment);
  const receipt = action === "Review"
    ? await reviewMarketCompsetProof(configuration)
    : await prepareMarketCompsetProof(configuration);
  // Compact safe receipt: no URL, secret, server error, or catalog contents.
  console.log(JSON.stringify(receipt));
}

if (import.meta.main) {
  try {
    await runMarketCompsetProofCli();
  } catch (error) {
    console.error(error instanceof ProofFailure ? error.code : "market_compset_proof_failed");
    process.exitCode = 1;
  }
}
