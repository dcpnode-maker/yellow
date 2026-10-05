import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { SQL } from "bun";
import {
  PropertyIdentityAuthorizationError,
  PropertyIdentityConflictError,
  PropertyIdentityProfileService,
  PropertyIdentityValidationError,
} from "../src/contexts/identity";
import {
  Database,
  IdempotencyConflictError,
  PostgresIdempotency,
  createAuditEnvelope,
} from "../src/kernel";

const DEPLOY_URL = process.env.YELLOW_ORDER581_DEPLOY_DATABASE_URL;
const RUNTIME_URL = process.env.YELLOW_ORDER581_RUNTIME_DATABASE_URL;
const required = process.env.YELLOW_REQUIRE_ORDER581_DATABASE === "1";
if (required && (!DEPLOY_URL || !RUNTIME_URL)) throw new Error("Order581 requires paired database URLs");
const dbDescribe = required ? describe.serial : describe.skip;
setDefaultTimeout(30_000);

const TENANT = "58100000-0000-4000-8000-000000000001";
const PROPERTY = "58100000-0000-4000-8000-000000000002";
const SIBLING = "58100000-0000-4000-8000-000000000003";
const ACTOR = "58100000-0000-4000-8000-000000000004";
const ROLE = "58100000-0000-4000-8000-000000000005";
const OTHER_TENANT = "58100000-0000-4000-8000-000000000011";
const OTHER_PROPERTY = "58100000-0000-4000-8000-000000000012";
const READ = "identity.property-profile:read";
const WRITE = "identity.property-profile:write";

let deploy: SQL | undefined;
let database: Database | undefined;
let service: PropertyIdentityProfileService | undefined;

function sqlState(error: unknown): string {
  return String((error as { errno?: string; code?: string }).errno ??
    (error as { code?: string }).code ?? "");
}

function input(key: string, expectedVersion: number, name: string, propertyNode = PROPERTY) {
  return Object.freeze({
    expectedVersion,
    name,
    idempotencyKey: key,
    envelope: createAuditEnvelope({
      actorId: ACTOR,
      tenantId: TENANT,
      propertyNode,
      requestId: crypto.randomUUID(),
      operation: "property.identity.changed",
    }),
  });
}

async function read(propertyNode = PROPERTY) {
  return database!.withTenantTransaction(TENANT, tx => service!.get(tx, {
    tenantId: TENANT, propertyNode, actorId: ACTOR,
  }));
}

async function rename(key: string, expectedVersion: number, name: string, propertyNode = PROPERTY) {
  return database!.withTenantTransaction(TENANT, tx =>
    service!.rename(tx, input(key, expectedVersion, name, propertyNode)));
}

async function evidence() {
  const [row] = await deploy!<{
    property: string; facts: string; events: string; receipts: string;
  }[]>`
    SELECT
      (SELECT jsonb_build_object('name',name,'timezone',timezone,'currency',currency,
        'path',path::text,'kind',kind,'config',config)::text FROM org_node WHERE id=${PROPERTY}::uuid) property,
      COALESCE((SELECT jsonb_agg(to_jsonb(f) ORDER BY f.recorded_at,f.id)::text FROM fact_log f
        WHERE f.tenant_id=${TENANT}::uuid AND f.entity_type='org_node'
          AND f.entity_id=${PROPERTY}::uuid AND f.fact_type='property.identity.changed'),'[]') facts,
      COALESCE((SELECT jsonb_agg(to_jsonb(o) ORDER BY o.seq)::text FROM outbox o
        WHERE o.tenant_id=${TENANT}::uuid AND o.aggregate_type='org_node'
          AND o.aggregate_id=${PROPERTY}::uuid AND o.event_type='property.identity.changed'),'[]') events,
      COALESCE((SELECT jsonb_agg(to_jsonb(i) ORDER BY i.key_hash)::text FROM api_idempotency i
        WHERE i.tenant_id=${TENANT}::uuid AND i.operation='identity.property-profile.rename'),'[]') receipts
  `;
  return row!;
}

async function unrelatedTableFingerprint() {
  const tables = await deploy!<{ table_name: string }[]>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema='public' AND table_type='BASE TABLE'
      AND table_name NOT IN ('org_node','fact_log','outbox','api_idempotency')
    ORDER BY table_name
  `;
  const statements = tables.map(({ table_name }) => {
    const quoted = `"${table_name.replaceAll('"', '""')}"`;
    return `SELECT '${table_name.replaceAll("'", "''")}' table_name,
      count(*)::text row_count,
      md5(COALESCE(string_agg(to_jsonb(t)::text, '' ORDER BY to_jsonb(t)::text), '')) digest
      FROM public.${quoted} t`;
  });
  return deploy!.unsafe<Array<{ table_name: string; row_count: string; digest: string }>>(
    statements.join(" UNION ALL "),
  );
}

async function deadlockCount(): Promise<number> {
  const [row] = await deploy!<{ deadlocks: string }[]>`
    SELECT deadlocks::text FROM pg_stat_database WHERE datname = current_database()
  `;
  if (!row || !/^[0-9]+$/.test(row.deadlocks)) throw new Error("PostgreSQL deadlock counter is unavailable");
  return Number(row.deadlocks);
}

async function clean() {
  if (!deploy) return;
  for (const tenant of [TENANT, OTHER_TENANT]) {
    for (const table of ["api_idempotency", "outbox", "fact_log"]) {
      await deploy.unsafe(`DELETE FROM ${table} WHERE tenant_id=$1::uuid`, [tenant]);
    }
    await deploy.unsafe("DELETE FROM user_role WHERE tenant_id=$1::uuid", [tenant]);
    await deploy.unsafe("DELETE FROM role_permission WHERE role_id IN (SELECT id FROM role WHERE tenant_id=$1::uuid)", [tenant]);
    await deploy.unsafe("DELETE FROM role WHERE tenant_id=$1::uuid", [tenant]);
    await deploy.unsafe("DELETE FROM app_user WHERE tenant_id=$1::uuid", [tenant]);
    await deploy.unsafe("DELETE FROM org_node WHERE tenant_id=$1::uuid", [tenant]);
    await deploy.unsafe("DELETE FROM tenant WHERE id=$1::uuid", [tenant]);
  }
}

beforeAll(async () => {
  if (!DEPLOY_URL || !RUNTIME_URL) return;
  deploy = new SQL(DEPLOY_URL, { max: 8, prepare: false });
  database = Database.connect(RUNTIME_URL, { maxConnections: 24, prepare: false });
  service = new PropertyIdentityProfileService(new PostgresIdempotency());
  await clean();
  await deploy`INSERT INTO tenant(id,slug,name,tier,status) VALUES
    (${TENANT}::uuid,'order581','Order581','shared','active'),
    (${OTHER_TENANT}::uuid,'order581-other','Order581 other','shared','active')`;
  await deploy`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency,config) VALUES
    (${PROPERTY}::uuid,${TENANT}::uuid,'order581.main','property','Order581 Main','Pacific/Kiritimati','INR',
      '{"inventory":{"oos_sellability":"allowed"},"untouched":{"large":9223372036854775807}}'),
    (${SIBLING}::uuid,${TENANT}::uuid,'order581.sibling','property','Order581 Sibling','UTC','USD','{"sibling":true}'),
    (${OTHER_PROPERTY}::uuid,${OTHER_TENANT}::uuid,'order581_other.main','property','Foreign property','UTC','EUR','{}')`;
  await deploy`INSERT INTO app_user(id,tenant_id,email,display_name,status)
    VALUES(${ACTOR}::uuid,${TENANT}::uuid,'actor@order581.test','Order581 actor','active')`;
  await deploy`INSERT INTO role(id,tenant_id,name) VALUES(${ROLE}::uuid,${TENANT}::uuid,'Property identity editor')`;
  await deploy`INSERT INTO role_permission(role_id,permission_code) VALUES
    (${ROLE}::uuid,${READ}),(${ROLE}::uuid,${WRITE})`;
  await deploy`INSERT INTO user_role(tenant_id,user_id,role_id,scope_node)
    VALUES(${TENANT}::uuid,${ACTOR}::uuid,${ROLE}::uuid,${PROPERTY}::uuid)`;
}, 60_000);

afterAll(async () => {
  await clean();
  await database?.close();
  await deploy?.close();
}, 60_000);

dbDescribe("Order581 governed property identity profile", () => {
  test("capability ownership, ACL, search path and direct-DML denial are exact", async () => {
    const functions = await deploy!<{ signature: string; owner: string; security_definer: boolean; config: string[] }[]>`
      SELECT oid::regprocedure::text signature,pg_get_userbyid(proowner) owner,
        prosecdef security_definer,proconfig config FROM pg_proc
      WHERE oid='public.rename_property_identity(uuid,uuid,uuid,uuid,integer,text)'::regprocedure`;
    expect(functions).toEqual([{ signature: "rename_property_identity(uuid,uuid,uuid,uuid,integer,text)",
      owner: "yellow_owner", security_definer: true,
      config: ["search_path=pg_catalog, public, pg_temp"] }]);
    const acl = await deploy!<{ grantee: string; privilege: string }[]>`
      SELECT COALESCE(r.rolname,'PUBLIC') grantee,a.privilege_type privilege
      FROM pg_proc p CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a
      LEFT JOIN pg_roles r ON r.oid=a.grantee
      WHERE p.oid='public.rename_property_identity(uuid,uuid,uuid,uuid,integer,text)'::regprocedure
      ORDER BY grantee,privilege`;
    expect(acl).toEqual([
      { grantee: "app_role", privilege: "EXECUTE" },
      { grantee: "yellow_owner", privilege: "EXECUTE" },
    ]);
    let runtimeState = "";
    try {
      await database!.withTenantTransaction(TENANT, tx =>
        tx`UPDATE org_node SET name='Raw hostile' WHERE id=${PROPERTY}::uuid`);
    } catch (error) { runtimeState = sqlState(error); }
    expect(runtimeState).toBe("42501");
    let unnormalizedState = "";
    try {
      await database!.withTenantTransaction(TENANT, tx => tx`
        SELECT * FROM public.rename_property_identity(
          ${TENANT}::uuid,${PROPERTY}::uuid,${ACTOR}::uuid,${crypto.randomUUID()}::uuid,0,'ｅ'
        )`);
    } catch (error) { unnormalizedState = sqlState(error); }
    expect(unnormalizedState).toBe("22023");
    for (const name of ["\u00ad", "\u0600", "\u2061", "\u2062", "\u2063", "\u2064", "\ufe0f", "A\u2061B"]) {
      let invisibleState = "";
      try {
        await database!.withTenantTransaction(TENANT, tx => tx`
          SELECT * FROM public.rename_property_identity(
            ${TENANT}::uuid,${PROPERTY}::uuid,${ACTOR}::uuid,${crypto.randomUUID()}::uuid,0,${name}
          )`);
      } catch (error) { invisibleState = sqlState(error); }
      expect(invisibleState).toBe("22023");
    }
    let ownerState = "";
    try {
      await deploy!`SELECT * FROM rename_property_identity(${TENANT}::uuid,${PROPERTY}::uuid,
        ${ACTOR}::uuid,${crypto.randomUUID()}::uuid,0,'Owner bypass')`;
    } catch (error) { ownerState = sqlState(error); }
    expect(ownerState).toBe("42501");
  });

  test("reads version zero and commits one normalized, property-local audited rename", async () => {
    expect(await read()).toEqual({ id: PROPERTY, name: "Order581 Main", timezone: "Pacific/Kiritimati",
      currency: "INR", version: 0, effectiveAt: null, effectiveBusinessDate: null });
    const before = await evidence();
    const unrelatedBefore = await unrelatedTableFingerprint();
    const result = await rename("order581-normalized-name", 0, "  Yellow\u00a0   Hotel  ");
    expect(result).toMatchObject({ changed: true, replayed: false,
      property: { id: PROPERTY, name: "Yellow Hotel", timezone: "Pacific/Kiritimati", currency: "INR", version: 1 } });
    expect(result.property.effectiveAt).not.toBeNull();
    const [localDate] = await deploy!<{ value: string }[]>`
      SELECT (transaction_timestamp() AT TIME ZONE 'Pacific/Kiritimati')::date::text value`;
    expect(result.property.effectiveBusinessDate).toBe(localDate!.value);
    const after = await evidence();
    const beforeProperty = JSON.parse(before.property);
    const afterProperty = JSON.parse(after.property);
    expect({ ...afterProperty, name: beforeProperty.name }).toEqual(beforeProperty);
    expect(JSON.parse(after.facts)).toHaveLength(JSON.parse(before.facts).length + 1);
    expect(JSON.parse(after.events)).toHaveLength(JSON.parse(before.events).length + 1);
    const event = JSON.parse(after.events).at(-1);
    expect(event.payload).toEqual({ version: 1, changed_fields: ["name"] });
    expect(Object.keys(event.payload).sort()).toEqual(["changed_fields", "version"]);
    expect(await unrelatedTableFingerprint()).toEqual(unrelatedBefore);
  });

  test("no-op, exact replay, changed-key reuse, stale version and supersession are exact", async () => {
    const baseline = await evidence();
    const noOp = await rename("order581-current-noop", 1, "Yellow Hotel");
    expect(noOp).toMatchObject({ changed: false, replayed: false, property: { version: 1, name: "Yellow Hotel" } });
    const afterNoOp = await evidence();
    expect(JSON.parse(afterNoOp.facts)).toEqual(JSON.parse(baseline.facts));
    expect(JSON.parse(afterNoOp.events)).toEqual(JSON.parse(baseline.events));
    const first = await rename("order581-second-change", 1, "Yellow Hotel Bengaluru");
    const replay = await rename("order581-second-change", 1, "Yellow Hotel Bengaluru");
    expect(replay).toEqual({ ...first, replayed: true });
    await expect(rename("order581-second-change", 2, "Different reuse")).rejects.toBeInstanceOf(IdempotencyConflictError);
    await expect(rename("order581-stale-version", 1, "Stale rename")).rejects.toBeInstanceOf(PropertyIdentityConflictError);
    const facts = JSON.parse((await evidence()).facts);
    expect(facts).toHaveLength(2);
    expect(facts[1].supersedes).toBe(facts[0].id);
    expect(facts.map((fact: { payload: { version: number } }) => fact.payload.version)).toEqual([1, 2]);
  });

  test("scope, active actor, sibling, foreign tenant and malformed names fail closed", async () => {
    const baseline = await evidence();
    await expect(read(SIBLING)).rejects.toBeInstanceOf(PropertyIdentityAuthorizationError);
    await expect(rename("order581-sibling-denied", 0, "Sibling denied", SIBLING))
      .rejects.toBeInstanceOf(PropertyIdentityAuthorizationError);
    await expect(database!.withTenantTransaction(TENANT, tx => service!.get(tx, {
      tenantId: OTHER_TENANT, propertyNode: OTHER_PROPERTY, actorId: ACTOR,
    }))).rejects.toBeInstanceOf(PropertyIdentityAuthorizationError);
    for (const name of ["", "\u00ad", "\u0600", "\u2061", "\u2062", "\u2063", "\u2064", "\ufe0f",
      "bad\u00adname", "bad\u2061name", "bad\u2063name", "bad\u202ename", "bad\u0000name", "x".repeat(201)]) {
      await expect(rename(`order581-invalid-${crypto.randomUUID()}`, 2, name))
        .rejects.toBeInstanceOf(PropertyIdentityValidationError);
    }
    await deploy!`UPDATE app_user SET status='inactive' WHERE id=${ACTOR}::uuid`;
    try {
      await expect(rename("order581-inactive-replay", 2, "Inactive denied"))
        .rejects.toBeInstanceOf(PropertyIdentityAuthorizationError);
    } finally {
      await deploy!`UPDATE app_user SET status='active' WHERE id=${ACTOR}::uuid`;
    }
    expect(await evidence()).toEqual(baseline);
  });

  test("outbox failure and caller rollback leave name, evidence and receipt untouched", async () => {
    const baseline = await evidence();
    await deploy!.unsafe(`CREATE FUNCTION public.order581_fail_identity_event()
      RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF NEW.event_type='property.identity.changed' THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='injected'; END IF;
        RETURN NEW; END $$`);
    await deploy!.unsafe(`CREATE TRIGGER order581_fail_identity_event BEFORE INSERT ON public.outbox
      FOR EACH ROW EXECUTE FUNCTION public.order581_fail_identity_event()`);
    try {
      await expect(rename("order581-event-failure", 2, "Must roll back")).rejects.toMatchObject({ errno: "P0001" });
      expect(await evidence()).toEqual(baseline);
    } finally {
      await deploy!.unsafe("DROP TRIGGER IF EXISTS order581_fail_identity_event ON public.outbox");
      await deploy!.unsafe("DROP FUNCTION IF EXISTS public.order581_fail_identity_event()") ;
    }
    await expect(database!.withTenantTransaction(TENANT, async tx => {
      await service!.rename(tx, input("order581-caller-rollback", 2, "Caller rollback"));
      throw new Error("injected caller rollback");
    })).rejects.toThrow("injected caller rollback");
    expect(await evidence()).toEqual(baseline);
  });

  test("two concurrent stale contenders do not deadlock and serialize to one winner", async () => {
    const beforeDeadlocks = await deadlockCount();
    const current = await read();
    const settled = await Promise.allSettled([
      rename("order581-race-two-a", current.version, "Two-way winner A"),
      rename("order581-race-two-b", current.version, "Two-way winner B"),
    ]);
    const winners = settled.filter((item): item is PromiseFulfilledResult<Awaited<ReturnType<typeof rename>>> =>
      item.status === "fulfilled");
    const losers = settled.filter((item): item is PromiseRejectedResult => item.status === "rejected");
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);
    expect(losers[0]!.reason).toBeInstanceOf(PropertyIdentityConflictError);
    expect(await deadlockCount()).toBe(beforeDeadlocks);
  }, 60_000);

  test("sixteen concurrent stale contenders do not deadlock and serialize to one winner with immutable non-name fields", async () => {
    const before = await evidence();
    const beforeDeadlocks = await deadlockCount();
    const current = await read();
    const settled = await Promise.allSettled(Array.from({ length: 16 }, (_, index) =>
      rename(`order581-race-${String(index).padStart(2, "0")}`, current.version, `Race winner ${index}`)));
    const winners = settled.filter((item): item is PromiseFulfilledResult<Awaited<ReturnType<typeof rename>>> =>
      item.status === "fulfilled");
    const losers = settled.filter((item): item is PromiseRejectedResult => item.status === "rejected");
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(15);
    expect(losers.every(item => item.reason instanceof PropertyIdentityConflictError)).toBe(true);
    const after = await evidence();
    const b = JSON.parse(before.property); const a = JSON.parse(after.property);
    expect({ ...a, name: b.name }).toEqual(b);
    expect(JSON.parse(after.facts)).toHaveLength(JSON.parse(before.facts).length + 1);
    expect(JSON.parse(after.events)).toHaveLength(JSON.parse(before.events).length + 1);
    expect(JSON.parse(after.receipts)).toHaveLength(JSON.parse(before.receipts).length + 1);
    expect(await deadlockCount()).toBe(beforeDeadlocks);
  }, 60_000);

  test("visible international names pass the raw governed capability", async () => {
    let current = await read();
    for (const name of ["Hôtel São João", "東京宿", "فندق الرياض", "होटल पीला"]) {
      const requestId = crypto.randomUUID();
      const [row] = await database!.withTenantTransaction(TENANT, tx => tx<{
        property_name: string; name_version: number; changed: boolean;
      }[]>`
        SELECT property_name, name_version, changed
        FROM public.rename_property_identity(
          ${TENANT}::uuid,${PROPERTY}::uuid,${ACTOR}::uuid,${requestId}::uuid,
          ${current.version}::integer,${name}
        )
      `);
      expect(row).toEqual({ property_name: name, name_version: current.version + 1, changed: true });
      current = await read();
    }
  }, 60_000);
});
