import { SQL, type ReservedSQL } from "bun";
import process from "node:process";
import {
  REVIEW_APPROVER_ROLE_NAME,
  REVIEW_BUSINESS_DAY_SEAL_EDGE_PERMISSION,
  REVIEW_BUSINESS_DAY_SEAL_PERMISSION,
  REVIEW_CASHIER_SUPERVISE_PERMISSION,
  REVIEW_DIRTY_ROOM_OVERRIDE_PERMISSION,
  REVIEW_DISCREPANCY_CARRY_APPROVE_PERMISSION,
  REVIEW_DISCREPANCY_CARRY_PERMISSION,
  REVIEW_FISCAL_PERMISSIONS,
  REVIEW_HOUSEKEEPING_INSPECT_PERMISSION,
  REVIEW_PERMISSIONS,
  REVIEW_POST_SEAL_PERMISSION,
  REVIEW_RECEIVABLE_APPROVE_PERMISSION,
  REVIEW_TRUST_NEGATIVE_APPROVE_PERMISSION,
} from "../scripts/seed-review";

const LOCK = "yellow.public.showcase.rate-approver.v1";
const TENANT = "6d9b7ce2-2d14-5576-b8c3-80f06501a603";
const APPROVER = "754f2c73-04b8-5c48-8013-e361e1183dad";
const APPROVER_EMAIL = "approver@yellow.local";
const ROLE = "773e6b99-da16-579b-8c09-890d3f77dfc7";
const ROLE_NAME = REVIEW_APPROVER_ROLE_NAME;
const OPERATOR = "9f90d3e9-94f9-54de-95ec-35bd00b99b15";
const OPERATOR_ROLE = "05802175-9b05-5a8d-8596-bccfbe36e99f";
const PROPERTIES = Object.freeze([
  { id: "6081b544-22a1-534f-a86d-bb1ae0519e14", name: "Locanda Homes · Jareed Riyadh" },
  { id: "01e4e102-c54f-5205-9542-d84d103084f8", name: "The Harrington London" },
] as const);
const EXISTING_SCOPES = Object.freeze([
  "4518a22f-b455-54c6-a50a-4584383749b9",
  "53d37060-da1e-5144-b5a2-fc24b4182ede",
] as const);

const APPROVER_PERMISSIONS = Object.freeze([
  ...REVIEW_PERMISSIONS.filter(({ code }) =>
    code !== REVIEW_DISCREPANCY_CARRY_PERMISSION.code &&
    code !== REVIEW_BUSINESS_DAY_SEAL_PERMISSION.code &&
    code !== REVIEW_BUSINESS_DAY_SEAL_EDGE_PERMISSION.code &&
    !REVIEW_FISCAL_PERMISSIONS.some((permission) => permission.code === code)
  ).map(({ code }) => code),
  REVIEW_POST_SEAL_PERMISSION.code,
  REVIEW_CASHIER_SUPERVISE_PERMISSION.code,
  REVIEW_RECEIVABLE_APPROVE_PERMISSION.code,
  REVIEW_TRUST_NEGATIVE_APPROVE_PERMISSION.code,
  REVIEW_DIRTY_ROOM_OVERRIDE_PERMISSION.code,
  REVIEW_HOUSEKEEPING_INSPECT_PERMISSION.code,
  REVIEW_DISCREPANCY_CARRY_APPROVE_PERMISSION.code,
].sort());

function loopbackDatabaseUrl(value: string): string {
  const url = new URL(value);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) ||
      !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
      !url.username || !url.password) throw new Error("A credentialed loopback PostgreSQL deployment URL is required");
  return url.toString();
}

async function exactTopology(tx: ReservedSQL): Promise<readonly string[]> {
  await tx`SELECT set_config('app.tenant_id', ${TENANT}, true)`;
  const identity = await tx<Array<{ tenant_id: string; user_id: string; email: string; status: string; role_id: string; role_name: string }>>`
    SELECT tenant.id::text tenant_id,app_user.id::text user_id,app_user.email,app_user.status,
      role.id::text role_id,role.name role_name
    FROM tenant JOIN app_user ON app_user.tenant_id=tenant.id
    JOIN role ON role.tenant_id=tenant.id
    WHERE tenant.id=${TENANT}::uuid AND tenant.slug='yellow-demo'
      AND app_user.id=${APPROVER}::uuid AND app_user.email=${APPROVER_EMAIL}
      AND role.id=${ROLE}::uuid AND role.name=${ROLE_NAME}
    FOR SHARE OF tenant,app_user,role`;
  if (identity.length !== 1 || identity[0]!.status !== "active") throw new Error("Approver identity topology differs");
  const permissions = await tx<Array<{ permission_code: string }>>`
    SELECT permission_code FROM role_permission WHERE role_id=${ROLE}::uuid ORDER BY permission_code FOR SHARE`;
  if (JSON.stringify(permissions.map(({ permission_code }) => permission_code)) !== JSON.stringify(APPROVER_PERMISSIONS)) {
    throw new Error("Approver full permission topology differs");
  }
  const properties = await tx<Array<{ id: string; name: string }>>`
    SELECT id::text,name FROM org_node WHERE tenant_id=${TENANT}::uuid
      AND id IN (${PROPERTIES[0].id}::uuid,${PROPERTIES[1].id}::uuid)
      AND kind='property' AND config @> '{"scenario":"yellow-two-property-operating-v3"}'::jsonb
    ORDER BY id FOR SHARE`;
  const expected = [...PROPERTIES].sort((left, right) => left.id.localeCompare(right.id));
  if (JSON.stringify(properties) !== JSON.stringify(expected)) throw new Error("Showcase property topology differs");
  const operatorGrants = await tx<Array<{ scope_node: string }>>`
    SELECT scope_node::text FROM user_role WHERE tenant_id=${TENANT}::uuid AND user_id=${OPERATOR}::uuid
      AND role_id=${OPERATOR_ROLE}::uuid AND scope_node IN (${PROPERTIES[0].id}::uuid,${PROPERTIES[1].id}::uuid)
    ORDER BY scope_node FOR SHARE`;
  const propertyIds = expected.map(({ id }) => id);
  if (JSON.stringify(operatorGrants.map(({ scope_node }) => scope_node)) !== JSON.stringify(propertyIds)) {
    throw new Error("Requester property grants differ");
  }
  return Object.freeze(propertyIds);
}

async function reconcile(databaseUrl: string): Promise<Readonly<{ created: number; unchanged: boolean }>> {
  const pool = new SQL(loopbackDatabaseUrl(databaseUrl), { max: 1, prepare: false });
  const tx = await pool.reserve();
  let open = false;
  try {
    await tx.unsafe("BEGIN");
    open = true;
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${LOCK},0))`;
    const propertyIds = await exactTopology(tx);
    const existing = await tx<Array<{ role_id: string; scope_node: string }>>`
      SELECT role_id::text,scope_node::text FROM user_role WHERE tenant_id=${TENANT}::uuid AND user_id=${APPROVER}::uuid
      ORDER BY role_id,scope_node FOR UPDATE`;
    const existingExpected = [...EXISTING_SCOPES].sort().map((scope_node) => ({ role_id: ROLE, scope_node }));
    const finalExpected = [...EXISTING_SCOPES, ...propertyIds].sort().map((scope_node) => ({ role_id: ROLE, scope_node }));
    const isInitial = JSON.stringify(existing) === JSON.stringify(existingExpected);
    const isFinal = JSON.stringify(existing) === JSON.stringify(finalExpected);
    if (!isInitial && !isFinal) throw new Error("Approver complete grant topology differs");
    let created = 0;
    if (isInitial) {
      await tx`INSERT INTO user_role(tenant_id,user_id,role_id,scope_node) VALUES
        (${TENANT}::uuid,${APPROVER}::uuid,${ROLE}::uuid,${propertyIds[0]}::uuid),
        (${TENANT}::uuid,${APPROVER}::uuid,${ROLE}::uuid,${propertyIds[1]}::uuid)`;
      created = 2;
    }
    const after = await tx<Array<{ role_id: string; scope_node: string }>>`
      SELECT role_id::text,scope_node::text FROM user_role WHERE tenant_id=${TENANT}::uuid AND user_id=${APPROVER}::uuid
      ORDER BY role_id,scope_node`;
    if (JSON.stringify(after) !== JSON.stringify(finalExpected)) {
      throw new Error("Approver grant postcondition failed");
    }
    await tx.unsafe("COMMIT");
    open = false;
    return Object.freeze({ created, unchanged: created === 0 });
  } catch (error) {
    if (open) try { await tx.unsafe("ROLLBACK"); } catch { /* retain original */ }
    throw error;
  } finally {
    tx.release();
    await pool.close();
  }
}

if (import.meta.main) {
  if (!process.argv.includes("--apply")) throw new Error("Explicit --apply is required");
  const databaseUrl = process.env.YELLOW_DEPLOY_DATABASE_URL;
  if (!databaseUrl) throw new Error("YELLOW_DEPLOY_DATABASE_URL is required");
  const result = await reconcile(databaseUrl);
  console.log(JSON.stringify({ mode: "reconciled", ...result }));
}
