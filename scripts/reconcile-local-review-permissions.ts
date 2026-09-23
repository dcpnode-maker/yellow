import { SQL, type ReservedSQL } from "bun";

const LOCK_NAME = "yellow.local.review.permissions.v1";
const TENANT = Object.freeze({ id: "6d9b7ce2-2d14-5576-b8c3-80f06501a603", slug: "yellow-demo" });
const REVIEW_USER_ID = "9f90d3e9-94f9-54de-95ec-35bd00b99b15";
const APPROVER_USER_ID = "754f2c73-04b8-5c48-8013-e361e1183dad";
const REVIEW_ROLE_ID = "05802175-9b05-5a8d-8596-bccfbe36e99f";
const APPROVER_ROLE_ID = "773e6b99-da16-579b-8c09-890d3f77dfc7";
const PROPERTIES = Object.freeze([
  { id: "4518a22f-b455-54c6-a50a-4584383749b9", name: "Yellow Demo Property" },
  { id: "53d37060-da1e-5144-b5a2-fc24b4182ede", name: "Yellow Identity Gate Review Property" },
] as const);
const REVIEW_EMAIL = "operator@yellow.local";
const APPROVER_EMAIL = "approver@yellow.local";
const REVIEW_ROLE = "Local Availability Reviewer";
const APPROVER_ROLE = "Local Post-Seal Financial Approver";

const PERMISSIONS = Object.freeze([
  { code: "financials.trust:post", description: "Post one governed owner trust expense accrual" },
  { code: "financials.trust:approve-negative", description: "Approve one exact negative owner trust expense" },
  { code: "financials.business-days:read", description: "Read governed property business-day close truth" },
  { code: "business_day.seal", description: "Seal business day" },
  { code: "financials.business-days:seal", description: "Seal governed property business days" },
  { code: "financials.business-day:carry-discrepancy", description: "Carry an unresolved discrepancy to the current open business day" },
  { code: "financials.business-day:approve-discrepancy-carry", description: "Approve a discrepancy carry" },
] as const);

const REVIEW_GRANTS = Object.freeze([
  "financials.trust:post",
  "financials.business-days:read",
  "business_day.seal",
  "financials.business-days:seal",
  "financials.business-day:carry-discrepancy",
] as const);

const APPROVER_GRANTS = Object.freeze([
  "financials.trust:post",
  "financials.trust:approve-negative",
  "financials.business-days:read",
  "financials.business-day:approve-discrepancy-carry",
] as const);

export interface LocalReviewPermissionReconciliationResult {
  readonly permissionsCreated: number;
  readonly grantsCreated: number;
  readonly unchanged: boolean;
}

function localDatabaseUrl(value: string): string {
  const parsed = new URL(value);
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new Error("Local review reconciliation requires a PostgreSQL URL");
  }
  if (!["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname)) {
    throw new Error("Local review reconciliation is restricted to a loopback PostgreSQL host");
  }
  if (!parsed.username || !parsed.password) {
    throw new Error("Local review reconciliation requires deployment credentials");
  }
  return parsed.toString();
}

interface IdentityRow {
  readonly tenant_id: string;
  readonly user_id: string;
  readonly email: string;
  readonly user_status: string;
  readonly role_id: string;
  readonly role_name: string;
  readonly property_id: string;
  readonly property_name: string;
  readonly property_kind: string;
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(",")}}`;
  return JSON.stringify(value);
}

function requireExact(actual: unknown, expected: unknown, label: string): void {
  if (stable(actual) !== stable(expected)) throw new Error(`${label} is not the exact canonical local-review topology`);
}

function redact(error: unknown, databaseUrl: string): Error {
  const message = error instanceof Error ? error.message : String(error);
  return new Error(message.split(databaseUrl).join("[REDACTED_DATABASE_URL]"));
}

async function requireTopology(connection: ReservedSQL): Promise<{ reviewRoleId: string; approverRoleId: string }> {
  const migrations = await connection<Array<{ maximum: number | bigint | string; count: number | bigint | string }>>`
    SELECT max(version) AS maximum,count(*) AS count FROM schema_migration`;
  requireExact(migrations.map(row => ({ maximum: Number(row.maximum), count: Number(row.count) })),
    [{ maximum: 68, count: 68 }], "Migration ledger");

  const rows = await connection<IdentityRow[]>`
    SELECT t.id::text AS tenant_id,u.id::text AS user_id,u.email,u.status AS user_status,
      r.id::text AS role_id,r.name AS role_name,n.id::text AS property_id,n.name AS property_name,n.kind AS property_kind
    FROM tenant t
    JOIN app_user u ON u.tenant_id=t.id
    JOIN user_role ur ON ur.tenant_id=t.id AND ur.user_id=u.id
    JOIN role r ON r.tenant_id=t.id AND r.id=ur.role_id
    JOIN org_node n ON n.tenant_id=t.id AND n.id=ur.scope_node
    WHERE t.slug=${TENANT.slug} AND u.email IN (${REVIEW_EMAIL},${APPROVER_EMAIL})
    ORDER BY u.email,r.name,n.id FOR UPDATE OF u,r,ur,n`;
  const properties = [...PROPERTIES].sort((a, b) => a.id.localeCompare(b.id));
  const expected: IdentityRow[] = [];
  for (const property of properties) {
    expected.push({ tenant_id: TENANT.id,user_id: APPROVER_USER_ID,email: APPROVER_EMAIL,user_status: "active",
      role_id: REVIEW_ROLE_ID,role_name: REVIEW_ROLE,property_id: property.id,property_name: property.name,property_kind: "property" });
    expected.push({ tenant_id: TENANT.id,user_id: APPROVER_USER_ID,email: APPROVER_EMAIL,user_status: "active",
      role_id: APPROVER_ROLE_ID,role_name: APPROVER_ROLE,property_id: property.id,property_name: property.name,property_kind: "property" });
    expected.push({ tenant_id: TENANT.id,user_id: REVIEW_USER_ID,email: REVIEW_EMAIL,user_status: "active",
      role_id: REVIEW_ROLE_ID,role_name: REVIEW_ROLE,property_id: property.id,property_name: property.name,property_kind: "property" });
  }
  expected.sort((a, b) => a.email.localeCompare(b.email) || a.role_name.localeCompare(b.role_name) || a.property_id.localeCompare(b.property_id));
  requireExact(rows, expected, "Review identities and property grants");
  return { reviewRoleId: REVIEW_ROLE_ID, approverRoleId: APPROVER_ROLE_ID };
}

async function ensurePermission(connection: ReservedSQL, permission: typeof PERMISSIONS[number]): Promise<number> {
  const rows = await connection<Array<{ code: string; description: string }>>`
    SELECT code,description FROM permission WHERE code=${permission.code} FOR UPDATE`;
  if (rows.length === 0) {
    await connection`INSERT INTO permission(code,description) VALUES(${permission.code},${permission.description})`;
    return 1;
  }
  requireExact(rows, [permission], `Permission ${permission.code}`);
  return 0;
}

async function ensureGrant(connection: ReservedSQL, roleId: string, code: string): Promise<number> {
  const rows = await connection<Array<{ role_id: string; permission_code: string }>>`
    SELECT role_id::text,permission_code FROM role_permission WHERE role_id=${roleId}::uuid AND permission_code=${code} FOR UPDATE`;
  if (rows.length === 0) {
    await connection`INSERT INTO role_permission(role_id,permission_code) VALUES(${roleId}::uuid,${code})`;
    return 1;
  }
  requireExact(rows, [{ role_id: roleId, permission_code: code }], `Role grant ${code}`);
  return 0;
}

async function requireCheckerExclusions(connection: ReservedSQL, roleId: string): Promise<void> {
  const rows = await connection<Array<{ permission_code: string }>>`
    SELECT permission_code FROM role_permission WHERE role_id=${roleId}::uuid
      AND permission_code IN ('business_day.seal','financials.business-days:seal','financials.business-day:carry-discrepancy')`;
  requireExact(rows, [], "Specialized checker exclusions");
}

export async function reconcileLocalReviewPermissions(options: {
  readonly databaseUrl: string;
  readonly logger?: (line: string) => void;
}): Promise<LocalReviewPermissionReconciliationResult> {
  const databaseUrl = localDatabaseUrl(options.databaseUrl);
  const pool = new SQL(databaseUrl, { max: 1 });
  const connection = await pool.reserve();
  let began = false;
  try {
    await connection.unsafe("BEGIN");
    began = true;
    await connection`SELECT pg_advisory_xact_lock(hashtextextended(${LOCK_NAME},0))`;
    const { reviewRoleId, approverRoleId } = await requireTopology(connection);
    await requireCheckerExclusions(connection, approverRoleId);
    let permissionsCreated = 0;
    for (const permission of PERMISSIONS) permissionsCreated += await ensurePermission(connection, permission);
    let grantsCreated = 0;
    for (const code of REVIEW_GRANTS) grantsCreated += await ensureGrant(connection, reviewRoleId, code);
    for (const code of APPROVER_GRANTS) grantsCreated += await ensureGrant(connection, approverRoleId, code);
    await requireCheckerExclusions(connection, approverRoleId);
    await connection.unsafe("COMMIT");
    began = false;
    const result = { permissionsCreated, grantsCreated, unchanged: permissionsCreated === 0 && grantsCreated === 0 };
    (options.logger ?? console.log)(`local review permissions: permissions_created=${permissionsCreated} grants_created=${grantsCreated} unchanged=${result.unchanged}`);
    return result;
  } catch (error) {
    if (began) try { await connection.unsafe("ROLLBACK"); } catch { /* retain original error */ }
    throw redact(error, options.databaseUrl);
  } finally {
    connection.release();
    await pool.close();
  }
}

async function runCli(): Promise<void> {
  const databaseUrl = process.env.YELLOW_DEPLOY_DATABASE_URL;
  if (!databaseUrl) {
    console.error("YELLOW_DEPLOY_DATABASE_URL is required");
    process.exitCode = 1;
    return;
  }
  try { await reconcileLocalReviewPermissions({ databaseUrl }); }
  catch (error) {
    console.error(`local review permission reconciliation failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

if (import.meta.main) await runCli();
