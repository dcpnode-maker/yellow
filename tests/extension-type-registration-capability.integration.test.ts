import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import { createAuditEnvelope, ExtensionRegistry } from "../src/kernel";

const DEPLOY_URL = process.env.YELLOW_DEPLOY_DATABASE_URL ?? process.env.YELLOW_EXTENSION_REGISTRATION_URL;
const RUNTIME_URL = process.env.YELLOW_RUNTIME_DATABASE_URL;
const REGISTRAR_URL = process.env.YELLOW_EXTENSION_REGISTRAR_DATABASE_URL;
const REQUIRED = process.env.YELLOW_REQUIRE_EXTENSION_REGISTRATION === "1";
if (REQUIRED && (!DEPLOY_URL || !RUNTIME_URL || !REGISTRAR_URL)) {
  throw new Error("Order 156 requires deploy, runtime and registrar database URLs");
}

const TENANT = "00000000-0000-0000-0000-000000000001";
const OTHER_TENANT = "00000000-0000-0000-0000-000000000002";
const PROPERTY = "00000000-0000-0000-0000-000000000012";
const TENANT_SLUG = "order156-proof";
const TENANT_NAME = "Order 156 Proof Tenant";
const PROPERTY_PATH = "order156.proof";
const PROPERTY_NAME = "Order 156 Proof Property";
const ACTOR = "00000000-0000-0000-0000-000000000960";
const ACTOR_EMAIL = "order156-proof@yellow.test";
const ACTOR_DISPLAY_NAME = "Order 156 Proof Actor";
const TYPE = "order156-proof";
const ROLLBACK_TYPE = "order156-rollback";
const SHADOW_TYPE = "order156-shadow";
const SCHEMA = Object.freeze({ type: "object", properties: { value: { type: "string" } } });

function state(error: unknown): string | undefined {
  return error && typeof error === "object"
    ? ((error as { errno?: string; code?: string }).errno ?? (error as { code?: string }).code)
    : undefined;
}

async function expectState(expected: string, operation: () => Promise<unknown>): Promise<void> {
  try {
    await operation();
  } catch (error) {
    expect(state(error)).toBe(expected);
    return;
  }
  throw new Error(`Expected SQLSTATE ${expected}`);
}

const dbDescribe = DEPLOY_URL && RUNTIME_URL && REGISTRAR_URL ? describe.serial : describe.skip;
let deploy: SQL | undefined;
let runtime: SQL | undefined;
let registrar: SQL | undefined;
let registry: ExtensionRegistry | undefined;
let tenantCreated = false;
let propertyCreated = false;
let actorCreated = false;

beforeAll(async () => {
  if (!DEPLOY_URL || !RUNTIME_URL || !REGISTRAR_URL) return;
  deploy = new SQL(DEPLOY_URL, { max: 2 });
  runtime = new SQL(RUNTIME_URL, { max: 1, prepare: false });
  registrar = new SQL(REGISTRAR_URL, { max: 2, prepare: false });
  registry = new ExtensionRegistry(runtime, registrar);
  const insertedTenant = await deploy<Array<{ id: string }>>`
    INSERT INTO tenant(id, slug, name, tier, residency, status)
    VALUES (${TENANT}::uuid, ${TENANT_SLUG}, ${TENANT_NAME}, 'shared', 'me-central', 'active')
    ON CONFLICT (id) DO NOTHING
    RETURNING id::text AS id
  `;
  tenantCreated = insertedTenant.length === 1;
  const exactTenant = await deploy<Array<{ exact: boolean }>>`
    SELECT slug = ${TENANT_SLUG}
       AND name = ${TENANT_NAME}
       AND tier = 'shared'
       AND residency = 'me-central'
       AND status = 'active' AS exact
      FROM tenant
     WHERE id = ${TENANT}::uuid
  `;
  if (exactTenant.length !== 1 || exactTenant[0]?.exact !== true) {
    throw new Error("Order156 proof tenant has divergent pre-existing identity");
  }
  const insertedProperty = await deploy<Array<{ id: string }>>`
    INSERT INTO org_node(id, tenant_id, path, kind, name, timezone, currency, config)
    VALUES (
      ${PROPERTY}::uuid, ${TENANT}::uuid, ${PROPERTY_PATH}::ltree, 'property',
      ${PROPERTY_NAME}, 'UTC', 'USD', '{}'::jsonb
    )
    ON CONFLICT (id) DO NOTHING
    RETURNING id::text AS id
  `;
  propertyCreated = insertedProperty.length === 1;
  const exactProperty = await deploy<Array<{ exact: boolean }>>`
    SELECT tenant_id = ${TENANT}::uuid
       AND path = ${PROPERTY_PATH}::ltree
       AND kind = 'property'
       AND name = ${PROPERTY_NAME}
       AND timezone = 'UTC'
       AND currency = 'USD'
       AND config = '{}'::jsonb AS exact
      FROM org_node
     WHERE id = ${PROPERTY}::uuid
  `;
  if (exactProperty.length !== 1 || exactProperty[0]?.exact !== true) {
    throw new Error("Order156 proof property has divergent pre-existing identity");
  }
  const inserted = await deploy<Array<{ id: string }>>`
    INSERT INTO app_user(id, tenant_id, email, display_name, auth, status)
    VALUES (${ACTOR}::uuid, ${TENANT}::uuid, ${ACTOR_EMAIL}, ${ACTOR_DISPLAY_NAME}, '{}'::jsonb, 'active')
    ON CONFLICT (id) DO NOTHING
    RETURNING id::text AS id
  `;
  actorCreated = inserted.length === 1;
  const exact = await deploy<Array<{ exact: boolean }>>`
    SELECT tenant_id = ${TENANT}::uuid
       AND email = ${ACTOR_EMAIL}
       AND display_name = ${ACTOR_DISPLAY_NAME}
       AND auth = '{}'::jsonb
       AND status = 'active' AS exact
      FROM app_user
     WHERE id = ${ACTOR}::uuid
  `;
  if (exact.length !== 1 || exact[0]?.exact !== true) {
    throw new Error("Order156 proof actor has divergent pre-existing identity");
  }
});

afterAll(async () => {
  if (deploy) {
    await deploy`DELETE FROM fact_log WHERE payload->>'type' IN (${TYPE}, ${ROLLBACK_TYPE}, ${SHADOW_TYPE})`;
    await deploy`DELETE FROM extension_type WHERE type IN (${TYPE}, ${ROLLBACK_TYPE}, ${SHADOW_TYPE})`;
    if (actorCreated) await deploy`DELETE FROM app_user WHERE id = ${ACTOR}::uuid`;
    if (propertyCreated) await deploy`DELETE FROM org_node WHERE id = ${PROPERTY}::uuid`;
    if (tenantCreated) await deploy`DELETE FROM tenant WHERE id = ${TENANT}::uuid`;
  }
  await registrar?.close();
  await runtime?.close();
  await deploy?.close();
});

dbDescribe("Order 156 extension type registrar capability", () => {
  test("P1/P3: exact principal, function and mutation authority catalogue", async () => {
    const roles = await deploy!<Array<Record<string, unknown>>>`
      SELECT rolcanlogin AS login, rolconnlimit AS connection_limit,
             rolsuper AS superuser, rolcreatedb AS create_db, rolcreaterole AS create_role,
             rolinherit AS inherit, rolreplication AS replication, rolbypassrls AS bypass_rls
        FROM pg_roles WHERE rolname = 'yellow_extension_registrar'
    `;
    expect(roles).toEqual([{
      login: true, connection_limit: 4, superuser: false, create_db: false,
      create_role: false, inherit: false, replication: false, bypass_rls: false,
    }]);
    const containment = await deploy!<Array<Record<string, unknown>>>`
      SELECT
        (SELECT count(*)::int FROM pg_auth_members
          WHERE roleid = 'yellow_extension_registrar'::regrole
             OR member = 'yellow_extension_registrar'::regrole) AS memberships,
        (SELECT count(*)::int FROM pg_class WHERE relowner = 'yellow_extension_registrar'::regrole) AS relations,
        (SELECT count(*)::int FROM pg_proc WHERE proowner = 'yellow_extension_registrar'::regrole) AS functions,
        (SELECT count(*)::int FROM information_schema.role_table_grants
          WHERE grantee = 'yellow_extension_registrar') AS table_grants,
        (SELECT count(*)::int FROM information_schema.column_privileges
          WHERE grantee = 'yellow_extension_registrar' AND privilege_type IN ('INSERT','UPDATE','DELETE')) AS column_dml
    `;
    expect(containment).toEqual([{ memberships: 0, relations: 0, functions: 0, table_grants: 0, column_dml: 0 }]);
    const functions = await deploy!<Array<Record<string, unknown>>>`
      SELECT p.oid::regprocedure::text AS signature, owner.rolname AS owner,
             p.prosecdef AS security_definer, p.proconfig AS config,
             has_function_privilege('yellow_extension_registrar', p.oid, 'EXECUTE') AS registrar_execute,
             has_function_privilege('yellow_runtime', p.oid, 'EXECUTE') AS runtime_execute,
             has_function_privilege('app_role', p.oid, 'EXECUTE') AS app_execute,
             EXISTS (
               SELECT 1 FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) acl
                WHERE acl.grantee = 0 AND acl.privilege_type = 'EXECUTE'
             ) AS public_execute
        FROM pg_proc p JOIN pg_roles owner ON owner.oid = p.proowner
       WHERE p.oid = 'public.register_extension_type(uuid,text,jsonb,uuid,uuid,uuid)'::regprocedure
    `;
    expect(functions).toEqual([{
      signature: "register_extension_type(uuid,text,jsonb,uuid,uuid,uuid)", owner: "yellow_owner",
      security_definer: true, config: ["search_path=pg_catalog, public, pg_temp"],
      registrar_execute: true, runtime_execute: false, app_execute: false, public_execute: false,
    }]);
  });

  test("P1: direct runtime write and direct function execution are denied", async () => {
    for (const statement of [
      `INSERT INTO public.extension_type(type,json_schema) VALUES ('order156-hostile','{}'::jsonb)`,
      `SELECT public.register_extension_type('${TENANT}','order156-hostile','{}','${ACTOR}','${PROPERTY}',gen_random_uuid())`,
    ]) {
      let observed: string | undefined;
      try {
        await runtime!.begin(async (tx) => {
          await tx`SELECT set_config('app.tenant_id', ${TENANT}, true)`;
          await tx.unsafe("SET LOCAL ROLE app_role");
          await tx.unsafe(statement);
        });
      } catch (error) { observed = state(error); }
      expect(observed).toBe("42501");
    }
  });

  test("P1: wrong principal, tenant, property and bounded inputs fail without artifacts", async () => {
    await expectState("42501", async () => await deploy!`SELECT public.register_extension_type(
      ${TENANT}::uuid, 'order156-hostile', '{}'::jsonb, ${ACTOR}::uuid, ${PROPERTY}::uuid, gen_random_uuid()
    )`);
    await expectState("42501", async () => await registrar!`SELECT public.register_extension_type(
      ${OTHER_TENANT}::uuid, 'order156-hostile', '{}'::jsonb, ${ACTOR}::uuid, ${PROPERTY}::uuid, gen_random_uuid()
    )`);
    await expectState("22023", async () => await registrar!`SELECT public.register_extension_type(
      ${TENANT}::uuid, ${"x".repeat(65)}, '{}'::jsonb, ${ACTOR}::uuid, ${PROPERTY}::uuid, gen_random_uuid()
    )`);
  });

  test("P1: rollback and pg_temp shadows cannot create partial or redirected artifacts", async () => {
    const connection = await registrar!.reserve();
    try {
      await connection.unsafe("BEGIN");
      await connection.unsafe("CREATE TEMP TABLE extension_type(type text, json_schema jsonb)");
      await connection.unsafe("CREATE TEMP TABLE fact_log(payload jsonb)");
      const rows = await connection<Array<{ inserted: boolean }>>`
        SELECT public.register_extension_type(
          ${TENANT}::uuid, ${SHADOW_TYPE}, ${JSON.stringify(SCHEMA)}::text::jsonb,
          ${ACTOR}::uuid, ${PROPERTY}::uuid, ${crypto.randomUUID()}::uuid
        ) AS inserted
      `;
      expect(rows).toEqual([{ inserted: true }]);
      await connection.unsafe("ROLLBACK");
    } finally { connection.release(); }
    const counts = await deploy!<Array<{ types: number; facts: number }>>`
      SELECT (SELECT count(*)::int FROM extension_type WHERE type = ${SHADOW_TYPE}) AS types,
             (SELECT count(*)::int FROM fact_log WHERE payload->>'type' = ${SHADOW_TYPE}) AS facts
    `;
    expect(counts).toEqual([{ types: 0, facts: 0 }]);
  });

  test("P2: identical concurrency converges, divergence rejects and writes one exact fact", async () => {
    const input = {
      type: TYPE,
      jsonSchema: SCHEMA,
      envelope: createAuditEnvelope({
        tenantId: TENANT, actorId: ACTOR, propertyNode: PROPERTY,
        requestId: crypto.randomUUID(), operation: "extension_type.registered",
      }),
    };
    const results = await Promise.all([registry!.registerType(input), registry!.registerType({
      ...input, envelope: createAuditEnvelope({ ...input.envelope, requestId: crypto.randomUUID() }),
    })]);
    expect(results.sort()).toEqual(["already exact", "inserted"]);
    await expect(registry!.registerType({ ...input, jsonSchema: { type: "object", required: ["different"] } }))
      .rejects.toThrow(`extension type ${TYPE} already exists with divergent schema`);
    const facts = await deploy!<Array<Record<string, unknown>>>`
      SELECT tenant_id::text AS tenant_id, entity_type, fact_type, actor_id::text AS actor_id,
             entity_id::text AS entity_id, payload->>'type' AS type, payload->>'request_id' AS request_id
        FROM fact_log WHERE payload->>'type' = ${TYPE}
    `;
    expect(facts).toHaveLength(1);
    expect(facts[0]).toMatchObject({ tenant_id: TENANT, entity_type: "extension_type",
      entity_id: "95f9a7f1-9f5c-5b29-baf0-fe60de3837a2",
      fact_type: "extension_type.registered", actor_id: ACTOR, type: TYPE });
    expect(facts[0]?.request_id).toMatch(/^[0-9a-f-]{36}$/);
  });

  test("P1: dirty session state is scrubbed and the unprepared backend is reusable", async () => {
    const dirtyPool = new SQL(REGISTRAR_URL!, { max: 1, prepare: false });
    const dirtyRegistry = new ExtensionRegistry(runtime!, dirtyPool);
    try {
      const connection = await dirtyPool.reserve();
      await connection.unsafe(`SELECT set_config('app.tenant_id', '${OTHER_TENANT}', false); PREPARE order156_probe AS SELECT 1`);
      connection.release();
      expect(await dirtyRegistry.registerType({
        type: TYPE, jsonSchema: SCHEMA,
        envelope: createAuditEnvelope({ tenantId: TENANT, actorId: ACTOR, propertyNode: PROPERTY,
          requestId: crypto.randomUUID(), operation: "extension_type.registered" }),
      })).toBe("already exact");
      const reused = await dirtyPool.unsafe<Array<Record<string, unknown>>>(`
        SELECT session_user::text AS session_user, current_user::text AS current_user,
               NULLIF(current_setting('app.tenant_id', true), '') IS NULL AS tenant_clear,
               (SELECT count(*)::int FROM pg_prepared_statements) AS prepared_count
      `);
      expect(reused).toEqual([{ session_user: "yellow_extension_registrar",
        current_user: "yellow_extension_registrar", tenant_clear: true, prepared_count: 0 }]);
    } finally {
      await dirtyPool.close();
    }
  });
});
