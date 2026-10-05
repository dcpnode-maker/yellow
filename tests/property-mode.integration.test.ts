import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";
import { PropertyModeService, PropertyModeAuthorizationError, PropertyModeConflictError,
  PropertyModeIncoherentError, type PropertyOperatingMode } from "../src/contexts/identity";
import { Database, PostgresIdempotency, IdempotencyConflictError, createAuditEnvelope } from "../src/kernel";

const DEPLOY = process.env.YELLOW_PROPERTY_MODE_DEPLOY_DATABASE_URL, RUNTIME = process.env.YELLOW_PROPERTY_MODE_RUNTIME_DATABASE_URL;
const REQUIRED = process.env.YELLOW_REQUIRE_PROPERTY_MODE_DATABASE === "1";
if (REQUIRED && (!DEPLOY || !RUNTIME)) throw new Error("Property mode proof requires paired database URLs");
const dbDescribe = REQUIRED ? describe.serial : describe.skip;
const id = (n: number) => `72000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const T = id(1), OTHER_T = id(2), PROPERTY = id(3), SIBLING = id(4), FOREIGN = id(5), REGION = id(6), OUTLET = id(7);
const ACTOR = id(10), READER = id(11), WRITER = id(12), OUTLET_ACTOR = id(13), ROLE = id(20), READ_ROLE = id(21), WRITE_ROLE = id(22);
const READ = "identity.property-mode:read", WRITE = "identity.property-mode:write", EVENT = "property.operating-mode.changed";
let deploy: SQL | undefined, database: Database | undefined;
const service = new PropertyModeService(new PostgresIdempotency());
const preserved = { private: "keep", inventory: { oos_sellability: "allowed" }, workspace: { density: "compact" } };
const actorInput = (actorId = ACTOR, propertyNode = PROPERTY) => ({ tenantId: T, actorId, propertyNode, tokenCanWrite: true });
const input = (key: string, expectedVersion: number, mode: PropertyOperatingMode, actorId = ACTOR, propertyNode = PROPERTY) => ({
  idempotencyKey: key, expectedVersion, mode, envelope: createAuditEnvelope({ tenantId: T, actorId, propertyNode,
    requestId: crypto.randomUUID(), operation: EVENT }),
});
const get = (actor = ACTOR, property = PROPERTY) => database!.withTenantTransaction(T, tx => service.get(tx, actorInput(actor, property)));
const set = (key: string, version: number, mode: PropertyOperatingMode, actor = ACTOR, property = PROPERTY) =>
  database!.withTenantTransaction(T, tx => service.set(tx, input(key, version, mode, actor, property)));

async function clean() {
  if (!deploy) return;
  await deploy.unsafe("DROP TRIGGER IF EXISTS property_mode720_fail_fact ON public.fact_log");
  await deploy.unsafe("DROP TRIGGER IF EXISTS property_mode720_fail_event ON public.outbox");
  await deploy.unsafe("DROP FUNCTION IF EXISTS public.property_mode720_fail()");
  for (const table of ["api_idempotency", "outbox", "fact_log", "user_role"]) await deploy.unsafe(`DELETE FROM ${table} WHERE tenant_id IN ($1::uuid,$2::uuid)`, [T, OTHER_T]);
  await deploy`DELETE FROM role_permission WHERE role_id IN (SELECT id FROM role WHERE tenant_id IN (${T}::uuid,${OTHER_T}::uuid))`;
  for (const table of ["role", "app_user", "org_node"]) await deploy.unsafe(`DELETE FROM ${table} WHERE tenant_id IN ($1::uuid,$2::uuid)`, [T, OTHER_T]);
  await deploy`DELETE FROM tenant WHERE id IN (${T}::uuid,${OTHER_T}::uuid)`;
}
async function evidence(): Promise<string> {
  const parts = [];
  for (const table of ["org_node", "fact_log", "outbox", "api_idempotency"]) parts.push(await deploy!.unsafe(
    `SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) rows FROM ${table} t WHERE tenant_id=$1::uuid`, [T]));
  return JSON.stringify(parts);
}
async function unrelated(): Promise<unknown> {
  const tables = await deploy!<{ table_name: string }[]>`SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name NOT IN ('org_node','fact_log','outbox','api_idempotency') ORDER BY table_name`;
  return deploy!.unsafe(tables.map(({ table_name }) => `SELECT '${table_name}' table_name,count(*)::text row_count,
    md5(COALESCE(string_agg(to_jsonb(t)::text,'' ORDER BY to_jsonb(t)::text),'')) digest FROM public."${table_name}" t`).join(" UNION ALL "));
}
async function waitForLock(tag: string): Promise<void> {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    const rows = await deploy!<{ waiting: boolean }[]>`SELECT EXISTS(SELECT 1 FROM pg_stat_activity
      WHERE datname=current_database() AND application_name=${tag} AND wait_event_type='Lock') waiting`;
    if (rows[0]?.waiting) return;
    await Bun.sleep(20);
  }
  throw new Error("Command never reached its real PostgreSQL lock wait");
}
async function deniedCapability(tenant: string, actor: string): Promise<void> {
  // Raw capability probes own their own client/transaction; domain proofs below
  // exercise the application's reusable Database pool independently.
  const probe = new SQL(RUNTIME!, { max: 1, prepare: false });
  try {
    await expect(probe.begin(async tx => {
      await tx.unsafe("SELECT set_config('app.tenant_id',$1,true)", [T]);
      await tx.unsafe("SET LOCAL ROLE app_role");
      return await tx.unsafe("SELECT public.set_property_operating_mode($1::uuid,$2::uuid,$3::uuid,$4::uuid,0,'hotel')", [tenant, PROPERTY, actor, id(99)]);
    }))
      .rejects.toMatchObject({ errno: "42501" });
  } finally { await probe.close(); }
}

beforeAll(async () => {
  if (!REQUIRED || !DEPLOY || !RUNTIME) return;
  deploy = new SQL(DEPLOY, { max: 8, prepare: false });
  database = Database.connect(RUNTIME, { maxConnections: 8, prepare: false });
  await clean();
  await deploy`INSERT INTO tenant(id,slug,name,tier,status) VALUES
    (${T}::uuid,'property-mode720','Mode fixture','shared','active'),(${OTHER_T}::uuid,'property-mode720-foreign','Foreign mode fixture','shared','active')`;
  await deploy`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency,config) VALUES
    (${REGION}::uuid,${T}::uuid,'mode720','region','Region',NULL,NULL,'{}'),
    (${PROPERTY}::uuid,${T}::uuid,'mode720.main','property','Mode property','Pacific/Kiritimati','USD',${JSON.stringify(preserved)}::jsonb),
    (${SIBLING}::uuid,${T}::uuid,'mode720_sibling','property','Sibling','UTC','USD','{}'),
    (${FOREIGN}::uuid,${OTHER_T}::uuid,'mode720.main','property','Foreign','UTC','USD','{}'),
    (${OUTLET}::uuid,${T}::uuid,'mode720.main.outlet','outlet','Outlet',NULL,NULL,'{}')`;
  for (const actor of [ACTOR, READER, WRITER, OUTLET_ACTOR]) await deploy`INSERT INTO app_user(id,tenant_id,email,display_name,status)
    VALUES(${actor}::uuid,${T}::uuid,${`${actor}@mode.test`},'Mode actor','active')`;
  for (const role of [ROLE, READ_ROLE, WRITE_ROLE]) await deploy`INSERT INTO role(id,tenant_id,name) VALUES(${role}::uuid,${T}::uuid,${role})`;
  await deploy`INSERT INTO role_permission(role_id,permission_code) VALUES
    (${ROLE}::uuid,${READ}),(${ROLE}::uuid,${WRITE}),(${READ_ROLE}::uuid,${READ}),(${WRITE_ROLE}::uuid,${WRITE})`;
  await deploy`INSERT INTO user_role(tenant_id,user_id,role_id,scope_node) VALUES
    (${T}::uuid,${ACTOR}::uuid,${ROLE}::uuid,${REGION}::uuid),
    (${T}::uuid,${READER}::uuid,${READ_ROLE}::uuid,${PROPERTY}::uuid),
    (${T}::uuid,${WRITER}::uuid,${WRITE_ROLE}::uuid,${PROPERTY}::uuid),
    (${T}::uuid,${OUTLET_ACTOR}::uuid,${ROLE}::uuid,${OUTLET}::uuid)`;
}, 60_000);
afterAll(async () => { if (!REQUIRED) return; await clean(); await database?.close(); await deploy?.close(); }, 60_000);

dbDescribe("property operating mode real PostgreSQL capability", () => {
  test("catalogue/capability grants are narrow and runtime boundary is genuine", async () => {
    const names = ["assert_property_mode_write_authority(uuid,uuid,uuid)", "set_property_operating_mode(uuid,uuid,uuid,uuid,integer,text)"];
    for (const signature of names) {
      const [row] = await deploy!<{ owner: string; definer: boolean; config: string[]; app: boolean; runtime: boolean; public_exec: boolean }[]>`
        SELECT pg_get_userbyid(p.proowner) owner,p.prosecdef definer,p.proconfig config,
          has_function_privilege('app_role',p.oid,'EXECUTE') app,has_function_privilege('yellow_runtime',p.oid,'EXECUTE') runtime,
          EXISTS(SELECT 1 FROM aclexplode(p.proacl) acl WHERE acl.grantee=0 AND acl.privilege_type='EXECUTE') public_exec
        FROM pg_proc p WHERE p.oid=${`public.${signature}`}::regprocedure`;
      expect(row).toMatchObject({ owner: "yellow_owner", definer: true, app: true, runtime: false, public_exec: false });
      expect(row?.config).toEqual([signature.startsWith("assert") ? "search_path=pg_catalog, public" : "search_path=pg_catalog, public, pg_temp"]);
    }
    const grants = await deploy!`SELECT role_id FROM role_permission WHERE permission_code IN (${READ},${WRITE}) AND role_id NOT IN (${ROLE}::uuid,${READ_ROLE}::uuid,${WRITE_ROLE}::uuid)`;
    expect(grants).toEqual([]);
    await deniedCapability(OTHER_T, ACTOR);
    for (const actor of [READER, OUTLET_ACTOR, id(999)]) await deniedCapability(T, actor);
    const ownerProbe = new SQL(DEPLOY!, { max: 1, prepare: false });
    try {
      await expect(ownerProbe.begin(async tx => await tx.unsafe("SELECT public.set_property_operating_mode($1::uuid,$2::uuid,$3::uuid,$4::uuid,0,'hotel')",
        [T, PROPERTY, ACTOR, id(99)]))).rejects.toMatchObject({ errno: "42501" });
    } finally { await ownerProbe.close(); }
  });

  test("independent read/write and hierarchy authority do not imply each other", async () => {
    expect(await get(READER)).toEqual({ propertyNode: PROPERTY, mode: null, version: 0, effectiveAt: null, effectiveBusinessDate: null, canWrite: false });
    expect((await database!.withTenantTransaction(T, tx => service.get(tx, { ...actorInput(), tokenCanWrite: false }))).canWrite).toBe(false);
    await expect(get(WRITER)).rejects.toBeInstanceOf(PropertyModeAuthorizationError);
    await expect(set("mode720-reader-denied", 0, "hotel", READER)).rejects.toBeInstanceOf(PropertyModeAuthorizationError);
    for (const actor of [OUTLET_ACTOR, id(999)]) {
      await expect(get(actor)).rejects.toBeInstanceOf(PropertyModeAuthorizationError);
      await expect(set(`mode720-denied-${actor}`, 0, "hotel", actor)).rejects.toBeInstanceOf(PropertyModeAuthorizationError);
    }
    await expect(get(ACTOR, SIBLING)).rejects.toBeInstanceOf(PropertyModeAuthorizationError);
    let foreignError: unknown;
    try { await get(ACTOR, FOREIGN); } catch (error) { foreignError = error; }
    expect(foreignError).toBeInstanceOf(PropertyModeAuthorizationError);
  });

  test("first save/reload preserves all unrelated state and derives property-local date", async () => {
    const untouched = await unrelated();
    const result = await set("mode720-first-save", 0, "hotel", WRITER);
    expect(result).toMatchObject({ changed: true, replayed: false, propertyMode: { propertyNode: PROPERTY, mode: "hotel", version: 1, canWrite: true } });
    expect((await get()).mode).toBe("hotel");
    const [row] = await deploy!<{ config: unknown; business_date: string; expected_date: string; payload: unknown; event: unknown }[]>`
      SELECT p.config,f.business_date::text,(f.valid_from AT TIME ZONE p.timezone)::date::text expected_date,f.payload,
        (SELECT payload FROM outbox WHERE tenant_id=${T}::uuid AND event_type=${EVENT} ORDER BY seq DESC LIMIT 1) event
      FROM org_node p JOIN fact_log f ON f.tenant_id=p.tenant_id AND f.entity_id=p.id AND f.fact_type=${EVENT} WHERE p.id=${PROPERTY}::uuid`;
    expect(row?.config).toEqual({ ...preserved, workspace: { density: "compact", operating_mode: "hotel" } });
    expect(result.propertyMode.effectiveBusinessDate).toBe(row?.expected_date ?? "missing");
    expect(row?.business_date).toBe(row?.expected_date ?? "missing");
    expect(row?.payload).toMatchObject({ version: 1, previous_mode: null, mode: "hotel" });
    expect(row?.event).toEqual({ version: 1, previous_mode: null, mode: "hotel" });
    expect(await unrelated()).toEqual(untouched);
  });

  test("runtime config DML cannot insert/change/remove/null mode but preserves unrelated config authority", async () => {
    const before = await evidence(), original = await get();
    const [property] = await deploy!<{ config: Record<string, unknown> }[]>`SELECT config FROM org_node WHERE id=${PROPERTY}::uuid`;
    const config = property!.config, workspace = config.workspace as Record<string, unknown>;
    for (const [target, replacement] of [
      [SIBLING, { workspace: { operating_mode: "hotel" } }],
      [PROPERTY, { ...config, workspace: { ...workspace, operating_mode: "str" } }],
      [PROPERTY, { ...config, workspace: { density: "compact" } }],
      [PROPERTY, { ...config, workspace: { ...workspace, operating_mode: null } }],
    ] as const) {
      await expect(database!.withTenantTransaction(T, async tx => {
        // Spoofable flags cannot substitute for the real invoker's role.
        await tx`SELECT set_config('app.property_mode_write','true',true)`;
        await tx`UPDATE org_node SET config=${JSON.stringify(replacement)}::jsonb WHERE id=${target}::uuid`;
      })).rejects.toMatchObject({ errno: "42501" });
      expect(await evidence()).toBe(before);
    }
    const unrelatedConfig = { ...config, workspace: { ...workspace, density: "spacious" } };
    try {
      await database!.withTenantTransaction(T, async tx => {
        await tx`UPDATE org_node SET config=${JSON.stringify(unrelatedConfig)}::jsonb WHERE id=${PROPERTY}::uuid`;
      });
      expect(await get()).toEqual(original);
      const [saved] = await deploy!<{ config: unknown }[]>`SELECT config FROM org_node WHERE id=${PROPERTY}::uuid`;
      expect(saved?.config).toEqual(unrelatedConfig);
    } finally { await deploy!`UPDATE org_node SET config=${JSON.stringify(config)}::jsonb WHERE id=${PROPERTY}::uuid`; }
    expect(await evidence()).toBe(before);
    // The following command tests still exercise governed changes after this guard.
  });

  test("same-mode no-op, stale version, exact original replay and divergent request key", async () => {
    const beforeFacts = await deploy!`SELECT id FROM fact_log WHERE tenant_id=${T}::uuid`;
    const beforeEvents = await deploy!`SELECT id FROM outbox WHERE tenant_id=${T}::uuid ORDER BY seq`;
    const noOp = await set("mode720-noop", 1, "hotel");
    expect(noOp).toMatchObject({ changed: false, propertyMode: { version: 1, mode: "hotel" } });
    expect(await deploy!`SELECT id FROM fact_log WHERE tenant_id=${T}::uuid`).toEqual(beforeFacts);
    expect(await deploy!`SELECT id FROM outbox WHERE tenant_id=${T}::uuid ORDER BY seq`).toEqual(beforeEvents);
    const changed = await set("mode720-second-save", 1, "both");
    expect(await set("mode720-second-save", 1, "both")).toEqual({ ...changed, replayed: true });
    await expect(set("mode720-second-save", 2, "str")).rejects.toBeInstanceOf(IdempotencyConflictError);
    await expect(set("mode720-stale", 1, "str")).rejects.toBeInstanceOf(PropertyModeConflictError);
    await set("mode720-third-save", 2, "str");
    expect(await set("mode720-second-save", 1, "both")).toEqual({ ...changed, replayed: true });
    expect((await get()).mode).toBe("str");
  });

  test("competing expected versions serialize to exactly one change without duplicate inventory", async () => {
    const current = await get();
    const untouched = await unrelated();
    const results = await Promise.allSettled([set("mode720-race-a", current.version, "hotel"), set("mode720-race-b", current.version, "both")]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    const errors = results.filter(r => r.status === "rejected");
    expect(errors).toHaveLength(1);
    expect((errors[0] as PromiseRejectedResult).reason).toBeInstanceOf(PropertyModeConflictError);
    expect((await get()).version).toBe(current.version + 1);
    expect(await unrelated()).toEqual(untouched);
  }, 30_000);

  test("late fact/outbox failures and caller rollback undo config, facts, events and receipt", async () => {
    await deploy!.unsafe(`CREATE FUNCTION public.property_mode720_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.tenant_id='${T}'::uuid THEN RAISE EXCEPTION USING ERRCODE='P0720',MESSAGE='injected mode late failure'; END IF; RETURN NEW; END $$`);
    try {
      for (const table of ["fact_log", "outbox"]) {
        const trigger = table === "fact_log" ? "property_mode720_fail_fact" : "property_mode720_fail_event";
        await deploy!.unsafe(`CREATE TRIGGER ${trigger} BEFORE INSERT ON public.${table} FOR EACH ROW EXECUTE FUNCTION public.property_mode720_fail()`);
        try {
          const before = await evidence(), current = await get();
          await expect(set(`mode720-late-${table}`, current.version, current.mode === "hotel" ? "str" : "hotel")).rejects.toMatchObject({ errno: "P0720" });
          expect(await evidence()).toBe(before);
        } finally { await deploy!.unsafe(`DROP TRIGGER ${trigger} ON public.${table}`); }
      }
    } finally { await deploy!.unsafe("DROP FUNCTION public.property_mode720_fail()"); }
    const before = await evidence(), current = await get();
    await expect(database!.withTenantTransaction(T, async tx => {
      await service.set(tx, input("mode720-caller-rollback", current.version, current.mode === "hotel" ? "str" : "hotel"));
      throw new Error("mode720 caller rollback");
    })).rejects.toThrow("mode720 caller rollback");
    expect(await evidence()).toBe(before);
  });

  test("malformed config/audit and config/history mismatch reject read and raw capability", async () => {
    const current = await get();
    const [property] = await deploy!<{ config: unknown }[]>`SELECT config FROM org_node WHERE id=${PROPERTY}::uuid`;
    for (const config of [{ ...preserved, workspace: [] }, { ...preserved, workspace: { operating_mode: "unknown" } },
      { ...preserved, workspace: { operating_mode: current.mode === "hotel" ? "str" : "hotel" } }]) {
      await deploy!`UPDATE org_node SET config=${JSON.stringify(config)}::jsonb WHERE id=${PROPERTY}::uuid`;
      try {
        await expect(get()).rejects.toBeInstanceOf(PropertyModeIncoherentError);
        await expect(database!.withTenantTransaction(T, tx => tx`SELECT public.set_property_operating_mode(${T}::uuid,${PROPERTY}::uuid,
          ${ACTOR}::uuid,${id(99)}::uuid,${current.version}::int,'both')`)).rejects.toMatchObject({ errno: "55000" });
      } finally { await deploy!`UPDATE org_node SET config=${JSON.stringify(property!.config)}::jsonb WHERE id=${PROPERTY}::uuid`; }
    }
    const [fact] = await deploy!<{ id: string; payload: unknown; supersedes: string | null }[]>`SELECT id,payload,supersedes FROM fact_log
      WHERE tenant_id=${T}::uuid AND fact_type=${EVENT} ORDER BY (payload->>'version')::int DESC LIMIT 1`;
    for (const payload of [{ version: "invalid" }, { ...(fact!.payload as object), version: 2147483648 },
      { ...(fact!.payload as object), previous_mode: "wrong" }]) {
      await deploy!`UPDATE fact_log SET payload=${JSON.stringify(payload)}::jsonb WHERE id=${fact!.id}::uuid`;
      try {
        await expect(get()).rejects.toBeInstanceOf(PropertyModeIncoherentError);
        await expect(database!.withTenantTransaction(T, tx => tx`SELECT public.set_property_operating_mode(${T}::uuid,${PROPERTY}::uuid,
          ${ACTOR}::uuid,${id(99)}::uuid,${current.version}::int,'both')`)).rejects.toMatchObject({ errno: "55000" });
      } finally { await deploy!`UPDATE fact_log SET payload=${JSON.stringify(fact!.payload)}::jsonb WHERE id=${fact!.id}::uuid`; }
    }
    expect((await get()).version).toBe(current.version);
  });

  test("revocation before replay and inactive tenant/actor deny without state effect", async () => {
    const current = await get(), selected = current.mode === "hotel" ? "str" : "hotel";
    await set("mode720-revoke-replay", current.version, selected);
    const before = await evidence();
    await deploy!`DELETE FROM role_permission WHERE role_id=${ROLE}::uuid AND permission_code=${WRITE}`;
    try { await expect(set("mode720-revoke-replay", current.version, selected)).rejects.toBeInstanceOf(PropertyModeAuthorizationError); }
    finally { await deploy!`INSERT INTO role_permission(role_id,permission_code) VALUES(${ROLE}::uuid,${WRITE})`; }
    for (const table of ["tenant", "app_user"]) {
      const target = table === "tenant" ? T : ACTOR;
      await deploy!.unsafe(`UPDATE ${table} SET status='inactive' WHERE id=$1::uuid`, [target]);
      try { await expect(get()).rejects.toBeInstanceOf(PropertyModeAuthorizationError); await expect(set("mode720-revoke-replay", current.version, selected)).rejects.toBeInstanceOf(PropertyModeAuthorizationError); }
      finally { await deploy!.unsafe(`UPDATE ${table} SET status='active' WHERE id=$1::uuid`, [target]); }
    }
    expect(await evidence()).toBe(before);
  });

  test("revocation commits during property lock wait and prevents a new command", async () => {
    const current = await get(), before = await evidence(), lock = await deploy!.reserve();
    let pending: Promise<unknown> | undefined;
    try {
      await lock.unsafe("BEGIN"); await lock`SELECT id FROM org_node WHERE id=${PROPERTY}::uuid FOR UPDATE`;
      pending = database!.withTenantTransaction(T, async tx => {
        await tx`SELECT set_config('application_name','mode720-property-wait',true)`;
        return service.set(tx, input("mode720-property-wait", current.version, current.mode === "hotel" ? "str" : "hotel"));
      });
      const outcome = pending.then(value => ({ value }), error => ({ error }));
      await waitForLock("mode720-property-wait");
      await deploy!`DELETE FROM role_permission WHERE role_id=${ROLE}::uuid AND permission_code=${WRITE}`;
      await lock.unsafe("ROLLBACK");
      expect((await outcome as { error?: unknown }).error).toBeInstanceOf(PropertyModeAuthorizationError);
      expect(await evidence()).toBe(before);
    } finally {
      await lock.unsafe("ROLLBACK"); lock.release();
      await deploy!`INSERT INTO role_permission(role_id,permission_code) VALUES(${ROLE}::uuid,${WRITE}) ON CONFLICT DO NOTHING`;
      await pending?.catch(() => {});
    }
  }, 30_000);

  test("revocation during completed receipt lock wait prevents exact replay", async () => {
    const current = await get(), mode = current.mode === "hotel" ? "str" : "hotel";
    await set("mode720-receipt-wait", current.version, mode);
    const before = await evidence(), lock = await deploy!.reserve();
    let pending: Promise<unknown> | undefined;
    try {
      await lock.unsafe("BEGIN"); await lock`SELECT key_hash FROM api_idempotency WHERE tenant_id=${T}::uuid AND operation='identity.property-mode.set' FOR UPDATE`;
      pending = database!.withTenantTransaction(T, async tx => {
        await tx`SELECT set_config('application_name','mode720-receipt-wait',true)`;
        return service.set(tx, input("mode720-receipt-wait", current.version, mode));
      });
      const outcome = pending.then(value => ({ value }), error => ({ error }));
      await waitForLock("mode720-receipt-wait");
      await deploy!`DELETE FROM role_permission WHERE role_id=${ROLE}::uuid AND permission_code=${WRITE}`;
      await lock.unsafe("ROLLBACK");
      expect((await outcome as { error?: unknown }).error).toBeInstanceOf(PropertyModeAuthorizationError);
      expect(await evidence()).toBe(before);
    } finally {
      await lock.unsafe("ROLLBACK"); lock.release();
      await deploy!`INSERT INTO role_permission(role_id,permission_code) VALUES(${ROLE}::uuid,${WRITE}) ON CONFLICT DO NOTHING`;
      await pending?.catch(() => {});
    }
  }, 30_000);
});
