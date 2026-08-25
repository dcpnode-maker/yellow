import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { SQL, type ReservedSQL } from "bun";

const FILE_NAME_PATTERN = /^[0-9]{4}_[a-z0-9][a-z0-9_-]*\.sql$/;
const BASELINE_FILE = "0001_init.sql";
const BASELINE_SHA256 = "fe2a9fc949c6bacded3f8d3fc4d14fc596a83ebde9aeb043eb10845f07b30923";
const ADVISORY_LOCK_KEY = 6_441_674_055_002_974_567n;
const OWNER_CUTOVER_VERSION = 15;
const FINAL_OWNER_ROLE = "yellow_owner";
const DEFAULT_MIGRATIONS_DIRECTORY = resolve(import.meta.dir, "..", "migrations");

interface MigrationRecord {
  readonly version: number;
  readonly filename: string;
  readonly checksumSha256: string;
  readonly sqlText: string;
}

interface LedgerRow {
  readonly version: number | bigint | string;
  readonly filename: string;
  readonly checksum_sha256: string;
}

interface BackendPidRow {
  readonly backend_pid: number;
}

interface RollbackDiagnostics {
  readonly backendPid?: number;
  readonly connectionUsable: boolean;
}

export interface MigrationRunOptions {
  readonly databaseUrl: string;
  readonly migrationsDirectory?: string;
  readonly logger?: (line: string) => void;
}

export interface MigrationRunResult {
  readonly appliedFiles: readonly string[];
  readonly backendPid: number;
  readonly discoveredFiles: number;
  readonly transactionBackendPids: readonly number[];
}

export class MigrationError extends Error {
  readonly errno?: string;
  readonly backendPid?: number;
  readonly rollbackConnectionUsable?: boolean;

  constructor(
    message: string,
    options: {
      readonly errno?: string;
      readonly backendPid?: number;
      readonly rollbackConnectionUsable?: boolean;
    } = {},
  ) {
    super(message);
    this.name = "MigrationError";
    this.errno = options.errno;
    this.backendPid = options.backendPid;
    this.rollbackConnectionUsable = options.rollbackConnectionUsable;
  }
}

const rollbackDiagnostics = new WeakMap<object, RollbackDiagnostics>();

function sha256(bytes: Uint8Array): string {
  return new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function sqlState(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const errno = Reflect.get(error, "errno");
  return typeof errno === "string" && errno !== "" ? errno : undefined;
}

function replaceEvery(value: string, target: string, replacement: string): string {
  return target === "" ? value : value.split(target).join(replacement);
}

function redactDatabaseCredentials(value: string, databaseUrl: string): string {
  let redacted = replaceEvery(value, databaseUrl, "[REDACTED_DATABASE_URL]");

  try {
    const parsed = new URL(databaseUrl);
    const credentials = [
      parsed.username,
      parsed.password,
      decodeURIComponent(parsed.username),
      decodeURIComponent(parsed.password),
    ].filter((credential) => credential.length > 0);

    for (const credential of credentials) {
      redacted = replaceEvery(redacted, credential, "[REDACTED]");
    }
  } catch {
    // The SQL constructor will report malformed URLs; the generic URL pattern below still redacts credentials.
  }

  return redacted.replace(/(postgres(?:ql)?:\/\/)[^@\s]+@/gi, "$1[REDACTED]@");
}

function publicError(error: unknown, databaseUrl: string): MigrationError {
  const diagnostics = error && typeof error === "object" ? rollbackDiagnostics.get(error) : undefined;
  const errno = sqlState(error);
  const suffix = errno ? ` (SQLSTATE ${errno})` : "";

  return new MigrationError(`${redactDatabaseCredentials(errorMessage(error), databaseUrl)}${suffix}`, {
    errno,
    backendPid: diagnostics?.backendPid,
    rollbackConnectionUsable: diagnostics?.connectionUsable,
  });
}

async function discoverMigrations(directory: string): Promise<readonly MigrationRecord[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const records: MigrationRecord[] = [];

  for (const entry of entries) {
    if (entry.isSymbolicLink()) {
      throw new Error(`Migration directory contains a forbidden symlink: ${entry.name}`);
    }
    if (!entry.name.endsWith(".sql")) continue;
    if (!entry.isFile()) {
      throw new Error(`Migration path is not a regular file: ${entry.name}`);
    }
    if (!FILE_NAME_PATTERN.test(entry.name)) {
      throw new Error(`Malformed migration filename: ${entry.name}`);
    }

    const version = Number.parseInt(entry.name.slice(0, 4), 10);
    if (version === 0) throw new Error(`Migration version 0000 is forbidden: ${entry.name}`);

    const bytes = await readFile(resolve(directory, entry.name));
    if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
      throw new Error(`Migration contains a forbidden UTF-8 BOM: ${entry.name}`);
    }

    let sqlText: string;
    try {
      sqlText = decoder.decode(bytes);
    } catch {
      throw new Error(`Migration is not valid UTF-8: ${entry.name}`);
    }

    records.push(
      Object.freeze({
        version,
        filename: entry.name,
        checksumSha256: sha256(bytes),
        sqlText,
      }),
    );
  }

  records.sort((left, right) => left.version - right.version || left.filename.localeCompare(right.filename));

  for (let index = 1; index < records.length; index += 1) {
    if (records[index]?.version === records[index - 1]?.version) {
      throw new Error(
        `Duplicate migration version ${records[index]?.version}: ${records[index - 1]?.filename}, ${records[index]?.filename}`,
      );
    }
  }

  const baseline = records.find(({ version }) => version === 1);
  if (!baseline || baseline.filename !== BASELINE_FILE) {
    throw new Error(`Required baseline migration is missing or misnamed: ${BASELINE_FILE}`);
  }
  if (baseline.checksumSha256 !== BASELINE_SHA256) {
    throw new Error(
      `Baseline checksum mismatch for ${BASELINE_FILE}: expected ${BASELINE_SHA256}, received ${baseline.checksumSha256}`,
    );
  }

  return records;
}

async function backendPid(connection: ReservedSQL): Promise<number> {
  const rows = await connection<BackendPidRow[]>`SELECT pg_backend_pid() AS backend_pid`;
  const pid = rows[0]?.backend_pid;
  if (typeof pid !== "number") throw new Error("PostgreSQL did not return a numeric backend PID");
  return pid;
}

async function manualTransaction<T>(connection: ReservedSQL, operation: () => Promise<T>): Promise<T> {
  await connection.unsafe("BEGIN");

  try {
    const result = await operation();
    await connection.unsafe("COMMIT");
    return result;
  } catch (error) {
    let diagnostics: RollbackDiagnostics = { connectionUsable: false };

    try {
      await connection.unsafe("ROLLBACK");
      diagnostics = { backendPid: await backendPid(connection), connectionUsable: true };
    } catch {
      // Preserve and rethrow the transaction's original error, as required by the runner contract.
    }

    if (error && typeof error === "object") rollbackDiagnostics.set(error, diagnostics);
    throw error;
  }
}

async function appRoleExists(connection: ReservedSQL): Promise<boolean> {
  const rows = await connection<{ exists: boolean }[]>`
    SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_role') AS exists
  `;
  return rows[0]?.exists === true;
}

async function revokeLedgerPrivileges(connection: ReservedSQL, includePublic: boolean): Promise<void> {
  if (includePublic) {
    await connection.unsafe("REVOKE ALL PRIVILEGES ON TABLE public.schema_migration FROM PUBLIC");
  }
  if (await appRoleExists(connection)) {
    await connection.unsafe("REVOKE ALL PRIVILEGES ON TABLE public.schema_migration FROM app_role");
  }
}

async function validateTrackingTable(
  connection: ReservedSQL,
  expectedOwner: "current" | "current-or-final" | "final" = "current",
): Promise<void> {
  const tableRows = await connection<
    { relkind: string; owner_name: string; current_name: string; relrowsecurity: boolean; relforcerowsecurity: boolean }[]
  >`
    SELECT c.relkind,
           pg_get_userbyid(c.relowner) AS owner_name,
           current_user AS current_name,
           c.relrowsecurity,
           c.relforcerowsecurity
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = 'schema_migration'
  `;
  const table = tableRows[0];
  const ownerIsValid = table !== undefined && (
    (expectedOwner !== "final" && table.owner_name === table.current_name)
    || (expectedOwner !== "current" && table.owner_name === FINAL_OWNER_ROLE)
  );
  if (
    tableRows.length !== 1 ||
    !table ||
    table.relkind !== "r" ||
    !ownerIsValid ||
    table.relrowsecurity ||
    table.relforcerowsecurity
  ) {
    throw new Error("public.schema_migration has an invalid owner, relation kind, or RLS configuration");
  }

  const columns = await connection<
    { attnum: number; attname: string; data_type: string; attnotnull: boolean; default_expr: string | null }[]
  >`
    SELECT a.attnum,
           a.attname,
           format_type(a.atttypid, a.atttypmod) AS data_type,
           a.attnotnull,
           pg_get_expr(d.adbin, d.adrelid) AS default_expr
      FROM pg_attribute a
      LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
     WHERE a.attrelid = 'public.schema_migration'::regclass
       AND a.attnum > 0
       AND NOT a.attisdropped
     ORDER BY a.attnum
  `;
  const actualColumns = columns.map(({ attnum, attname, data_type, attnotnull, default_expr }) => ({
    attnum,
    attname,
    data_type,
    attnotnull,
    default_expr: default_expr ?? null,
  }));
  const expectedColumns = [
    { attnum: 1, attname: "version", data_type: "bigint", attnotnull: true, default_expr: null },
    { attnum: 2, attname: "filename", data_type: "text", attnotnull: true, default_expr: null },
    {
      attnum: 3,
      attname: "checksum_sha256",
      data_type: "character(64)",
      attnotnull: true,
      default_expr: null,
    },
    {
      attnum: 4,
      attname: "applied_at",
      data_type: "timestamp with time zone",
      attnotnull: true,
      default_expr: "clock_timestamp()",
    },
  ];
  if (JSON.stringify(actualColumns) !== JSON.stringify(expectedColumns)) {
    throw new Error("public.schema_migration column contract does not match the required definition");
  }

  const constraints = await connection<{ contype: string; conkey: string; definition: string }[]>`
    SELECT contype,
           conkey::text AS conkey,
           pg_get_constraintdef(oid, true) AS definition
      FROM pg_constraint
     WHERE conrelid = 'public.schema_migration'::regclass
     ORDER BY contype, conkey::text, pg_get_constraintdef(oid, true)
  `;
  const actualConstraints = constraints.map(({ contype, conkey, definition }) => ({
    contype,
    conkey,
    definition,
  }));
  const expectedConstraints = [
    { contype: "c", conkey: "{1}", definition: "CHECK (version >= 1 AND version <= 9999)" },
    {
      contype: "c",
      conkey: "{3}",
      definition: "CHECK (checksum_sha256 ~ '^[0-9a-f]{64}$'::text)",
    },
    { contype: "p", conkey: "{1}", definition: "PRIMARY KEY (version)" },
    { contype: "u", conkey: "{2}", definition: "UNIQUE (filename)" },
  ];
  if (JSON.stringify(actualConstraints) !== JSON.stringify(expectedConstraints)) {
    throw new Error("public.schema_migration constraint contract does not match the required definition");
  }
}

async function verifyRoleHasNoLedgerPrivileges(connection: ReservedSQL, role: string): Promise<void> {
  const rows = await connection<{ privilege: string }[]>`
    SELECT privilege
      FROM unnest(ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) AS privilege
     WHERE has_table_privilege(${role}, 'public.schema_migration', privilege)
  `;
  if (rows.length > 0) {
    throw new Error(`${role} retains privileges on public.schema_migration: ${rows.map(({ privilege }) => privilege).join(", ")}`);
  }
}

async function verifyPublicHasNoLedgerPrivileges(connection: ReservedSQL): Promise<void> {
  const rows = await connection<{ privilege_type: string }[]>`
    SELECT acl.privilege_type
      FROM pg_class c
      CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) AS acl
     WHERE c.oid = 'public.schema_migration'::regclass
       AND acl.grantee = 0
  `;
  if (rows.length > 0) {
    throw new Error(
      `PUBLIC retains privileges on public.schema_migration: ${rows.map(({ privilege_type }) => privilege_type).join(", ")}`,
    );
  }
}

async function bootstrapTrackingTable(connection: ReservedSQL): Promise<void> {
  await manualTransaction(connection, async () => {
    await connection.unsafe(`
      CREATE TABLE IF NOT EXISTS public.schema_migration (
        version bigint PRIMARY KEY CHECK (version BETWEEN 1 AND 9999),
        filename text NOT NULL UNIQUE,
        checksum_sha256 char(64) NOT NULL
          CHECK (checksum_sha256 ~ '^[0-9a-f]{64}$'),
        applied_at timestamptz NOT NULL DEFAULT clock_timestamp()
      )
    `);
    await validateTrackingTable(connection, "current-or-final");
    await revokeLedgerPrivileges(connection, true);
    await verifyPublicHasNoLedgerPrivileges(connection);
  });
}

function validateLedger(records: readonly MigrationRecord[], ledger: readonly LedgerRow[]): void {
  const localByVersion = new Map(records.map((record) => [record.version, record]));

  for (const row of ledger) {
    const version = Number(row.version);
    const local = localByVersion.get(version);
    if (!local) throw new Error(`Applied migration version ${version} is absent from the local directory`);
    if (local.filename !== row.filename) {
      throw new Error(
        `Applied migration filename mismatch for version ${version}: database=${row.filename}, local=${local.filename}`,
      );
    }
    if (local.checksumSha256 !== row.checksum_sha256) {
      throw new Error(`Applied migration checksum mismatch for version ${version}: ${local.filename}`);
    }
  }
}

async function readLedger(connection: ReservedSQL): Promise<readonly LedgerRow[]> {
  return await connection<LedgerRow[]>`
    SELECT version, filename, checksum_sha256
      FROM public.schema_migration
     ORDER BY version
  `;
}

async function applyMigration(
  connection: ReservedSQL,
  record: MigrationRecord,
  lockBackendPid: number,
): Promise<number> {
  return await manualTransaction(connection, async () => {
    const transactionPid = await backendPid(connection);
    if (transactionPid !== lockBackendPid) {
      throw new Error(
        `Migration connection affinity violated: lock backend ${lockBackendPid}, transaction backend ${transactionPid}`,
      );
    }

    if (record.version > OWNER_CUTOVER_VERSION) {
      await connection.unsafe(`SET LOCAL ROLE ${FINAL_OWNER_ROLE}`);
    }
    await connection.unsafe(record.sqlText);
    await revokeLedgerPrivileges(connection, false);
    await connection`
      INSERT INTO public.schema_migration (version, filename, checksum_sha256)
      VALUES (${record.version}, ${record.filename}, ${record.checksumSha256})
    `;
    return transactionPid;
  });
}

export async function runMigrations(options: MigrationRunOptions): Promise<MigrationRunResult> {
  const { databaseUrl, logger = console.log } = options;
  const migrationsDirectory = resolve(options.migrationsDirectory ?? DEFAULT_MIGRATIONS_DIRECTORY);
  let pool: SQL | undefined;
  let connection: ReservedSQL | undefined;
  let lockAcquired = false;
  let failure: unknown;
  let result: MigrationRunResult | undefined;

  try {
    pool = new SQL(databaseUrl);
    connection = await pool.reserve();
    const lockRows = await connection.unsafe<BackendPidRow[]>(
      `SELECT pg_advisory_lock(${ADVISORY_LOCK_KEY}) AS locked, pg_backend_pid() AS backend_pid`,
    );
    const lockBackendPid = lockRows[0]?.backend_pid;
    if (typeof lockBackendPid !== "number") throw new Error("Failed to capture advisory-lock backend PID");
    lockAcquired = true;

    const records = await discoverMigrations(migrationsDirectory);
    await bootstrapTrackingTable(connection);

    const initialLedger = await readLedger(connection);
    validateLedger(records, initialLedger);
    const appliedVersions = new Set(initialLedger.map(({ version }) => Number(version)));
    const appliedFiles: string[] = [];
    const transactionBackendPids: number[] = [];

    for (const record of records) {
      if (appliedVersions.has(record.version)) continue;
      const transactionPid = await applyMigration(connection, record, lockBackendPid);
      transactionBackendPids.push(transactionPid);
      appliedFiles.push(record.filename);
      logger(`migration applied: ${record.filename}`);
    }

    const finalLedger = await readLedger(connection);
    validateLedger(records, finalLedger);
    const finalHasOwnerCutover = finalLedger.some(({ version }) => Number(version) >= OWNER_CUTOVER_VERSION);
    await validateTrackingTable(connection, finalHasOwnerCutover ? "final" : "current");
    await verifyPublicHasNoLedgerPrivileges(connection);
    if (await appRoleExists(connection)) {
      await verifyRoleHasNoLedgerPrivileges(connection, "app_role");
    }

    const status = appliedFiles.length === 0 ? "no-op" : "applied";
    const transactionPidSummary =
      transactionBackendPids.length === 0 ? "none" : transactionBackendPids.join(",");
    logger(
      `migration summary: applied=${appliedFiles.length} status=${status} backend_pid=${lockBackendPid} transaction_pids=${transactionPidSummary}`,
    );
    result = {
      appliedFiles: Object.freeze([...appliedFiles]),
      backendPid: lockBackendPid,
      discoveredFiles: records.length,
      transactionBackendPids: Object.freeze([...transactionBackendPids]),
    };
  } catch (error) {
    failure = error;
  } finally {
    if (connection && lockAcquired) {
      try {
        const rows = await connection<{ unlocked: boolean }[]>`
          SELECT pg_advisory_unlock(${ADVISORY_LOCK_KEY}) AS unlocked
        `;
        if (rows[0]?.unlocked !== true && failure === undefined) {
          failure = new Error("PostgreSQL advisory lock was not released by its owning connection");
        }
      } catch (error) {
        if (failure === undefined) failure = error;
      }
    }

    if (connection) {
      try {
        connection.release();
      } catch (error) {
        if (failure === undefined) failure = error;
      }
    }

    if (pool) {
      try {
        await pool.close();
      } catch (error) {
        if (failure === undefined) failure = error;
      }
    }
  }

  if (failure !== undefined) throw publicError(failure, databaseUrl);
  if (!result) throw new MigrationError("Migration runner completed without a result");
  return result;
}

async function runCli(): Promise<void> {
  const databaseUrl = process.env.YELLOW_DEPLOY_DATABASE_URL;
  if (!databaseUrl) {
    console.error("YELLOW_DEPLOY_DATABASE_URL is required");
    process.exitCode = 1;
    return;
  }

  try {
    await runMigrations({
      databaseUrl,
      migrationsDirectory: process.env.YELLOW_MIGRATIONS_DIR,
    });
  } catch (error) {
    console.error(`migration failed: ${errorMessage(error)}`);
    process.exitCode = 1;
  }
}

if (import.meta.main) {
  await runCli();
}
