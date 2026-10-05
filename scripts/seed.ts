import { SQL, type ReservedSQL } from "bun";
import { uuidV5 } from "./lib/uuid-v5";

export const URL_NAMESPACE_UUID = "6ba7b811-9dad-11d1-80b4-00c04fd430c8";
export const TENANT_NAME = "https://yellow.local/seed/tenant/yellow-demo";
export const PROPERTY_NAME = "org-node/yellow_demo.property";

export const SEED_TENANT = Object.freeze({
  id: "6d9b7ce2-2d14-5576-b8c3-80f06501a603",
  slug: "yellow-demo",
  name: "Yellow Demo",
  tier: "shared",
  residency: "me-central",
  status: "active",
});

export const SEED_PROPERTY = Object.freeze({
  id: "4518a22f-b455-54c6-a50a-4584383749b9",
  tenantId: SEED_TENANT.id,
  path: "yellow_demo.property",
  kind: "property",
  name: "Yellow Demo Property",
  timezone: "UTC",
  currency: "USD",
  config: {},
});

interface TenantRow {
  id: string;
  slug: string;
  name: string;
  tier: string;
  residency: string;
  status: string;
  created_at: Date | string;
}

interface PropertyRow {
  id: string;
  tenant_id: string;
  path: string;
  kind: string;
  name: string;
  timezone: string | null;
  currency: string | null;
  config: unknown;
}

interface IdentityRow {
  current_user: string;
  tenant_context: string | null;
  backend_pid: number;
}

interface RollbackEvidence {
  readonly backendPid?: number;
  readonly connectionUsable: boolean;
  readonly roleReset: boolean;
  readonly tenantContextCleared: boolean;
}

export interface SeedOptions {
  readonly databaseUrl: string;
  readonly logger?: (line: string) => void;
  /** Integration-test fault injection. Runs after tenant handling, before property handling. */
  readonly beforeProperty?: (connection: ReservedSQL) => Promise<void>;
}

export interface SeedResult {
  readonly tenant: "inserted" | "already exact";
  readonly property: "inserted" | "already exact";
  readonly deploymentRole: string;
  readonly writeRole: "app_role";
  readonly backendPid: number;
  readonly roleReset: true;
  readonly tenantContextCleared: true;
  readonly reuseProbeCleared: true;
}

export class SeedError extends Error {
  readonly errno?: string;
  readonly backendPid?: number;
  readonly rollbackConnectionUsable?: boolean;
  readonly roleReset?: boolean;
  readonly tenantContextCleared?: boolean;

  constructor(message: string, options: {
    errno?: string;
    backendPid?: number;
    rollbackConnectionUsable?: boolean;
    roleReset?: boolean;
    tenantContextCleared?: boolean;
  } = {}) {
    super(message);
    this.name = "SeedError";
    Object.assign(this, options);
  }
}

const rollbackEvidence = new WeakMap<object, RollbackEvidence>();

function sqlState(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const errno = Reflect.get(error, "errno");
  return typeof errno === "string" && errno !== "" ? errno : undefined;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function redact(value: string, databaseUrl: string): string {
  let result = value.split(databaseUrl).join("[REDACTED_DATABASE_URL]");
  try {
    const parsed = new URL(databaseUrl);
    for (const credential of [parsed.username, parsed.password, decodeURIComponent(parsed.username), decodeURIComponent(parsed.password)]) {
      if (credential) result = result.split(credential).join("[REDACTED]");
    }
  } catch {
    // The SQL client reports malformed URLs; the generic pattern still removes credentials.
  }
  return result.replace(/(postgres(?:ql)?:\/\/)[^@\s]+@/gi, "$1[REDACTED]@");
}

function publicError(error: unknown, databaseUrl: string): SeedError {
  const evidence = error && typeof error === "object" ? rollbackEvidence.get(error) : undefined;
  const errno = sqlState(error);
  return new SeedError(`${redact(errorMessage(error), databaseUrl)}${errno ? ` (SQLSTATE ${errno})` : ""}`, {
    errno,
    backendPid: evidence?.backendPid,
    rollbackConnectionUsable: evidence?.connectionUsable,
    roleReset: evidence?.roleReset,
    tenantContextCleared: evidence?.tenantContextCleared,
  });
}

function sameConfig(value: unknown): boolean {
  if (value === "{}") return true;
  return typeof value === "object" && value !== null && !Array.isArray(value) && Object.keys(value).length === 0;
}

function tenantIsExact(row: TenantRow): boolean {
  return row.id === SEED_TENANT.id && row.slug === SEED_TENANT.slug && row.name === SEED_TENANT.name &&
    row.tier === SEED_TENANT.tier && row.residency === SEED_TENANT.residency && row.status === SEED_TENANT.status;
}

function propertyIsExact(row: PropertyRow): boolean {
  return row.id === SEED_PROPERTY.id && row.tenant_id === SEED_PROPERTY.tenantId && row.path === SEED_PROPERTY.path &&
    row.kind === SEED_PROPERTY.kind && row.name === SEED_PROPERTY.name && row.timezone === SEED_PROPERTY.timezone &&
    row.currency === SEED_PROPERTY.currency && sameConfig(row.config);
}

async function identity(connection: ReservedSQL): Promise<IdentityRow> {
  const rows = await connection<IdentityRow[]>`
    SELECT current_user,
           NULLIF(current_setting('app.tenant_id', true), '') AS tenant_context,
           pg_backend_pid() AS backend_pid
  `;
  const row = rows[0];
  if (!row || typeof row.backend_pid !== "number") throw new Error("PostgreSQL identity probe failed");
  return row;
}

async function assertReset(connection: ReservedSQL, deploymentRole: string, backendPid: number): Promise<void> {
  const row = await identity(connection);
  if (row.backend_pid !== backendPid) throw new Error("Seed connection affinity was lost");
  if (row.current_user !== deploymentRole) throw new Error(`Seed role did not reset to deployment role ${deploymentRole}`);
  if (row.tenant_context !== null) throw new Error("Transaction-local tenant context survived transaction end");
}

async function deriveAndValidateIds(): Promise<void> {
  const tenantId = await uuidV5(URL_NAMESPACE_UUID, TENANT_NAME);
  const propertyId = await uuidV5(tenantId, PROPERTY_NAME);
  if (tenantId !== SEED_TENANT.id || propertyId !== SEED_PROPERTY.id) {
    throw new Error("Derived seed UUIDs do not match the canonical seed identities");
  }
}

async function handleTenant(connection: ReservedSQL): Promise<SeedResult["tenant"]> {
  let rows = await connection<TenantRow[]>`
    SELECT id, slug, name, tier, residency, status, created_at
      FROM public.tenant
     WHERE id = ${SEED_TENANT.id} OR slug = ${SEED_TENANT.slug}
     ORDER BY id
  `;
  if (rows.length === 0) {
    rows = await connection<TenantRow[]>`
      INSERT INTO public.tenant (id, slug, name, tier, residency, status)
      VALUES (${SEED_TENANT.id}, ${SEED_TENANT.slug}, ${SEED_TENANT.name}, ${SEED_TENANT.tier}, ${SEED_TENANT.residency}, ${SEED_TENANT.status})
      RETURNING id, slug, name, tier, residency, status, created_at
    `;
    if (rows.length !== 1 || !rows[0] || !tenantIsExact(rows[0])) throw new Error("Inserted tenant is not canonical");
    return "inserted";
  }
  if (rows.length !== 1 || !rows[0] || !tenantIsExact(rows[0])) throw new Error("Tenant seed collision does not exactly match canonical values");
  return "already exact";
}

async function handleProperty(connection: ReservedSQL): Promise<SeedResult["property"]> {
  let rows = await connection<PropertyRow[]>`
    SELECT id, tenant_id, path::text AS path, kind, name, timezone, currency, config
      FROM public.org_node
     WHERE id = ${SEED_PROPERTY.id}
        OR (tenant_id = ${SEED_PROPERTY.tenantId} AND path = ${SEED_PROPERTY.path}::ltree)
     ORDER BY id
  `;
  if (rows.length === 0) {
    rows = await connection<PropertyRow[]>`
      INSERT INTO public.org_node (id, tenant_id, path, kind, name, timezone, currency, config)
      VALUES (${SEED_PROPERTY.id}, ${SEED_PROPERTY.tenantId}, ${SEED_PROPERTY.path}::ltree, ${SEED_PROPERTY.kind}, ${SEED_PROPERTY.name}, ${SEED_PROPERTY.timezone}, ${SEED_PROPERTY.currency}, ${JSON.stringify(SEED_PROPERTY.config)}::jsonb)
      RETURNING id, tenant_id, path::text AS path, kind, name, timezone, currency, config
    `;
    if (rows.length !== 1 || !rows[0] || !propertyIsExact(rows[0])) throw new Error("Inserted property is not canonical");
    return "inserted";
  }
  if (rows.length !== 1 || !rows[0] || !propertyIsExact(rows[0])) throw new Error("Property seed collision does not exactly match canonical values");
  return "already exact";
}

export async function runSeed(options: SeedOptions): Promise<SeedResult> {
  const { databaseUrl, logger = console.log } = options;
  let pool: SQL | undefined;
  let connection: ReservedSQL | undefined;
  let failure: unknown;
  let result: SeedResult | undefined;

  try {
    await deriveAndValidateIds();
    pool = new SQL(databaseUrl);
    connection = await pool.reserve();
    const before = await identity(connection);
    const deploymentRole = before.current_user;
    const backendPid = before.backend_pid;

    await connection.unsafe("BEGIN");
    try {
      await connection.unsafe("SET LOCAL ROLE app_role");
      const role = await identity(connection);
      if (role.current_user !== "app_role" || role.backend_pid !== backendPid) {
        throw new Error("Seed transaction did not assume app_role on the reserved backend");
      }

      const tenant = await handleTenant(connection);
      const contextRows = await connection<{ tenant_context: string }[]>`
        SELECT set_config('app.tenant_id', ${SEED_TENANT.id}, true) AS tenant_context
      `;
      if (contextRows[0]?.tenant_context !== SEED_TENANT.id) throw new Error("Seed transaction did not establish exact tenant context");

      await options.beforeProperty?.(connection);
      const property = await handleProperty(connection);
      await handleTenant(connection);
      await handleProperty(connection);
      await connection.unsafe("COMMIT");

      await assertReset(connection, deploymentRole, backendPid);
      // A second transaction on the same reservation proves pool/backend reuse begins clean.
      await connection.unsafe("BEGIN");
      await assertReset(connection, deploymentRole, backendPid);
      await connection.unsafe("ROLLBACK");
      await assertReset(connection, deploymentRole, backendPid);

      logger(`seed tenant: ${tenant}`);
      logger(`seed property: ${property}`);
      logger(`seed summary: status=${tenant === "already exact" && property === "already exact" ? "no-op" : "applied"} backend_pid=${backendPid}`);
      result = { tenant, property, deploymentRole, writeRole: "app_role", backendPid, roleReset: true, tenantContextCleared: true, reuseProbeCleared: true };
    } catch (error) {
      let evidence: RollbackEvidence = { connectionUsable: false, roleReset: false, tenantContextCleared: false };
      try {
        await connection.unsafe("ROLLBACK");
        const after = await identity(connection);
        evidence = {
          backendPid: after.backend_pid,
          connectionUsable: after.backend_pid === backendPid,
          roleReset: after.current_user === deploymentRole,
          tenantContextCleared: after.tenant_context === null,
        };
      } catch {
        // Preserve the transaction's original error.
      }
      if (error && typeof error === "object") rollbackEvidence.set(error, evidence);
      throw error;
    }
  } catch (error) {
    failure = error;
  } finally {
    if (connection) {
      try { connection.release(); } catch (error) { if (failure === undefined) failure = error; }
    }
    if (pool) {
      try { await pool.close(); } catch (error) { if (failure === undefined) failure = error; }
    }
  }

  if (failure !== undefined) throw publicError(failure, databaseUrl);
  if (!result) throw new SeedError("Seed completed without a result");
  return result;
}

async function runCli(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is required");
    process.exitCode = 1;
    return;
  }
  try {
    await runSeed({ databaseUrl });
  } catch (error) {
    console.error(`seed failed: ${errorMessage(error)}`);
    process.exitCode = 1;
  }
}

if (import.meta.main) await runCli();
