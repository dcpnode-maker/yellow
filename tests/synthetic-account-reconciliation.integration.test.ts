import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import { Database } from "../src/kernel";

const DEPLOY = process.env.YELLOW_DEPLOY_DATABASE_URL;
const RUNTIME = process.env.YELLOW_RUNTIME_DATABASE_URL;
const REQUIRED = process.env.YELLOW_REQUIRE_SYNTHETIC_ACCOUNT_RECONCILIATION === "1";
if (REQUIRED && (!DEPLOY || !RUNTIME)) throw new Error("deployment and runtime URLs are required");

const describeDatabase = DEPLOY && RUNTIME ? describe.serial : describe.skip;
const tenant = "6d9b7ce2-2d14-5576-b8c3-80f06501a603";
const property = "4518a22f-b455-54c6-a50a-4584383749b9";
const actor = "9f90d3e9-94f9-54de-95ec-35bd00b99b15";
const party = "55ee1818-f8e8-570e-9fe5-6bc7f88db2df";
const reservation = "fe25d718-95b5-51d9-9443-0098cd4d10dc";
const account = "b70473b6-48a9-5167-a734-3f510e27a18f";
const folio = "b1b5c625-6093-5345-8d23-a307fbb70456";
const secondFolio = "b1b5c625-6093-5345-8d23-a307fbb70455";
const canonical = "Aarav Mehta Guest Ledger";
const drifted = "Legacy Review Ledger";
const clearing = "b70473b6-48a9-5167-a734-3f510e27a18e";
const instrument = "b70473b6-48a9-5167-a734-3f510e27a18d";
const operation = "b70473b6-48a9-5167-a734-3f510e27a18c";
const operationRace = "b70473b6-48a9-5167-a734-3f510e27a18a";
const journal = "b70473b6-48a9-5167-a734-3f510e27a18b";
const code = "O471PAY";
const postingDate = "2098-01-01";

let admin: SQL | undefined;
let runtime: Database | undefined;

async function invoke(expected = drifted, overrides: Partial<Record<string, string | null>> = {}) {
  return runtime!.withTenantTransaction(tenant, (tx) => tx`
    SELECT * FROM public.reconcile_synthetic_clean_arrival_account(
      ${overrides.tenant ?? tenant}::uuid, ${overrides.property ?? property}::uuid,
      ${overrides.party ?? party}::uuid, ${overrides.reservation ?? reservation}::uuid,
      ${overrides.account ?? account}::uuid, ${overrides.folio ?? folio}::uuid,
      ${overrides.actor ?? actor}::uuid, ${overrides.request ?? crypto.randomUUID()}::uuid,
      ${expected}, ${overrides.name ?? canonical}
    )
  `);
}

async function targetState() {
  return admin!<Array<{ name: string; immutable: string; facts: number; events: number }>>`
    SELECT a.name,
      md5((to_jsonb(a)-'name')::text || (SELECT md5(to_jsonb(f)::text) FROM folio f WHERE f.id=${folio}::uuid)) AS immutable,
      (SELECT count(*)::int FROM fact_log WHERE tenant_id=${tenant}::uuid AND entity_id=${account}::uuid AND fact_type='account.reconciled') AS facts,
      (SELECT count(*)::int FROM outbox WHERE tenant_id=${tenant}::uuid AND aggregate_id=${account}::uuid AND event_type='account.reconciled') AS events
    FROM account a WHERE a.id=${account}::uuid
  `;
}

/** Content-blind tenant preservation proof.  The permitted account name and the
 * one explicitly expected reconciliation pair are deliberately excluded. */
async function protectedFingerprint(): Promise<Record<string, string>> {
  const rows = await admin!<Array<Record<string, string>>>`
    SELECT jsonb_build_object(
      'org_node', COALESCE((SELECT md5(string_agg(md5(to_jsonb(t)::text),'' ORDER BY t.id)) FROM org_node t WHERE t.tenant_id=${tenant}::uuid),''),
      'app_user', COALESCE((SELECT md5(string_agg(md5(to_jsonb(t)::text),'' ORDER BY t.id)) FROM app_user t WHERE t.tenant_id=${tenant}::uuid),''),
      'party', COALESCE((SELECT md5(string_agg(md5(to_jsonb(t)::text),'' ORDER BY t.id)) FROM party t WHERE t.tenant_id=${tenant}::uuid),''),
      'role', COALESCE((SELECT md5(string_agg(md5(to_jsonb(t)::text),'' ORDER BY t.party_id,t.role)) FROM party_role t WHERE t.tenant_id=${tenant}::uuid),''),
      'contact', COALESCE((SELECT md5(string_agg(md5(to_jsonb(t)::text),'' ORDER BY t.id)) FROM contact_point t WHERE t.tenant_id=${tenant}::uuid),''),
      'reservation', COALESCE((SELECT md5(string_agg(md5(to_jsonb(t)::text),'' ORDER BY t.id)) FROM reservation t WHERE t.tenant_id=${tenant}::uuid),''),
      'segment', COALESCE((SELECT md5(string_agg(md5(to_jsonb(t)::text),'' ORDER BY t.id)) FROM reservation_segment t WHERE t.tenant_id=${tenant}::uuid),''),
      'guest', COALESCE((SELECT md5(string_agg(md5(to_jsonb(t)::text),'' ORDER BY t.reservation_id,t.party_id)) FROM reservation_guest t WHERE t.tenant_id=${tenant}::uuid),''),
      'account', COALESCE((SELECT md5(string_agg(md5((CASE WHEN t.id=${account}::uuid THEN to_jsonb(t)-'name' ELSE to_jsonb(t) END)::text),'' ORDER BY t.id)) FROM account t WHERE t.tenant_id=${tenant}::uuid),''),
      'folio', COALESCE((SELECT md5(string_agg(md5(to_jsonb(t)::text),'' ORDER BY t.id)) FROM folio t WHERE t.tenant_id=${tenant}::uuid),''),
      'instrument', COALESCE((SELECT md5(string_agg(md5(to_jsonb(t)::text),'' ORDER BY t.id)) FROM payment_instrument t WHERE t.tenant_id=${tenant}::uuid),''),
      'business_day', COALESCE((SELECT md5(string_agg(md5(to_jsonb(t)::text),'' ORDER BY t.property_node,t.business_date)) FROM business_day t WHERE t.tenant_id=${tenant}::uuid),''),
      'occupancy', COALESCE((SELECT md5(string_agg(md5(to_jsonb(t)::text),'' ORDER BY t.id)) FROM space_occupancy t WHERE t.tenant_id=${tenant}::uuid),''),
      'journal', COALESCE((SELECT md5(string_agg(md5(to_jsonb(t)::text),'' ORDER BY t.id)) FROM journal t WHERE t.tenant_id=${tenant}::uuid),''),
      'posting', COALESCE((SELECT md5(string_agg(md5(to_jsonb(t)::text),'' ORDER BY t.id)) FROM posting_line t WHERE t.tenant_id=${tenant}::uuid),''),
      'payment_operation', COALESCE((SELECT md5(string_agg(md5(to_jsonb(t)::text),'' ORDER BY t.id)) FROM payment_operation t WHERE t.tenant_id=${tenant}::uuid),''),
      'payment', COALESCE((SELECT md5(string_agg(md5(to_jsonb(t)::text),'' ORDER BY t.id)) FROM payment t WHERE t.tenant_id=${tenant}::uuid),''),
      'document', COALESCE((SELECT md5(string_agg(md5(to_jsonb(t)::text),'' ORDER BY t.id)) FROM document t WHERE t.tenant_id=${tenant}::uuid),''),
      'identity', COALESCE((SELECT md5(string_agg(md5(to_jsonb(t)::text),'' ORDER BY t.id)) FROM identity_document t WHERE t.tenant_id=${tenant}::uuid),''),
      'facts', COALESCE((SELECT md5(string_agg(md5(to_jsonb(t)::text),'' ORDER BY t.id)) FROM fact_log t WHERE t.tenant_id=${tenant}::uuid AND NOT(t.entity_id=${account}::uuid AND t.fact_type='account.reconciled')),''),
      'outbox', COALESCE((SELECT md5(string_agg(md5(to_jsonb(t)::text),'' ORDER BY t.id)) FROM outbox t WHERE t.tenant_id=${tenant}::uuid AND NOT(t.aggregate_id=${account}::uuid AND t.event_type='account.reconciled')),'')
    ) AS fingerprint`;
  return rows[0]!.fingerprint as unknown as Record<string, string>;
}

async function rawAttempt(context: string | undefined, setAppRole: boolean): Promise<unknown> {
  const sql = new SQL(RUNTIME!, { max: 1 });
  const connection = await sql.reserve();
  try {
    await connection.unsafe("BEGIN");
    if (context !== undefined) await connection`SELECT set_config('app.tenant_id', ${context}, true)`;
    if (setAppRole) await connection.unsafe("SET LOCAL ROLE app_role");
    return await connection`
      SELECT * FROM public.reconcile_synthetic_clean_arrival_account(
        ${tenant}::uuid,${property}::uuid,${party}::uuid,${reservation}::uuid,${account}::uuid,
        ${folio}::uuid,${actor}::uuid,${crypto.randomUUID()}::uuid,${canonical},${canonical})`;
  } finally {
    try { await connection.unsafe("ROLLBACK"); } catch {}
    connection.release();
    await sql.close();
  }
}

async function clean() {
  if (!admin) return;
  await admin`DELETE FROM payment WHERE tenant_id=${tenant}::uuid`;
  await admin`DELETE FROM payment_operation WHERE tenant_id=${tenant}::uuid`;
  await admin`DELETE FROM posting_line WHERE tenant_id=${tenant}::uuid`;
  await admin`DELETE FROM journal WHERE tenant_id=${tenant}::uuid`;
  await admin`DELETE FROM business_day WHERE tenant_id=${tenant}::uuid`;
  await admin`DELETE FROM outbox WHERE tenant_id=${tenant}::uuid`;
  await admin`DELETE FROM fact_log WHERE tenant_id=${tenant}::uuid`;
  await admin`DELETE FROM folio WHERE id=${folio}::uuid`;
  await admin`DELETE FROM folio WHERE id=${secondFolio}::uuid`;
  await admin`DELETE FROM account WHERE id=${account}::uuid`;
  await admin`DELETE FROM payment_instrument WHERE tenant_id=${tenant}::uuid`;
  await admin`DELETE FROM account WHERE id=${clearing}::uuid`;
  await admin`DELETE FROM tx_code WHERE code=${code}`;
  await admin`DELETE FROM reservation WHERE id=${reservation}::uuid`;
  await admin`DELETE FROM party_role WHERE tenant_id=${tenant}::uuid AND party_id=${party}::uuid`;
  await admin`DELETE FROM party WHERE id=${party}::uuid`;
  await admin`DELETE FROM app_user WHERE id=${actor}::uuid`;
  await admin`DELETE FROM org_node WHERE id=${property}::uuid`;
  await admin`DELETE FROM tenant WHERE id=${tenant}::uuid`;
}

beforeAll(async () => {
  if (!DEPLOY || !RUNTIME) return;
  admin = new SQL(DEPLOY, { max: 8 });
  runtime = Database.connect(RUNTIME, { maxConnections: 8 });
  await clean();
  await admin`INSERT INTO tenant(id,slug,name,tier,status) VALUES(${tenant}::uuid,'account-reconcile','Account reconciliation','shared','active')`;
  await admin`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES(${property}::uuid,${tenant}::uuid,'account_reconcile','property','Account reconciliation','UTC','USD')`;
  await admin`INSERT INTO app_user(id,tenant_id,email,display_name,status) VALUES(${actor}::uuid,${tenant}::uuid,'account-reconcile@example.test','Synthetic Operator','active')`;
  await admin`INSERT INTO party(id,tenant_id,kind,display_name,status) VALUES(${party}::uuid,${tenant}::uuid,'person','Synthetic Clean Arrival','active')`;
  await admin`INSERT INTO party_role(tenant_id,party_id,role,detail) VALUES(${tenant}::uuid,${party}::uuid,'guest','{"source":"local-review","checkin_example":"clean"}'::jsonb)`;
  await admin`INSERT INTO reservation(id,tenant_id,property_node,confirmation_no,primary_party,channel_code,currency) VALUES(${reservation}::uuid,${tenant}::uuid,${property}::uuid,'ARR-CLEAN',${party}::uuid,'direct','USD')`;
  await admin`INSERT INTO account(id,tenant_id,property_node,role,party_id,name,currency,status) VALUES(${account}::uuid,${tenant}::uuid,${property}::uuid,'guest',${party}::uuid,${drifted},'USD','open')`;
  await admin`INSERT INTO folio(id,tenant_id,account_id,reservation_id,folio_no,window_no,name,status) VALUES(${folio}::uuid,${tenant}::uuid,${account}::uuid,${reservation}::uuid,'ARR-CLEAN-1',1,'Primary','open')`;
});

afterAll(async () => { await clean(); await runtime?.close(); await admin?.close(); });

describeDatabase("Order 471 synthetic account reconciliation", () => {
  test("fails closed for raw tenant contexts and the wrong current role", async () => {
    const before = await targetState();
    for (const context of [undefined, "", "not-a-uuid", "00000000-0000-0000-0000-000000000001"] as const) {
      await expect(rawAttempt(context, true)).rejects.toMatchObject({ errno: "42501" });
      expect(await targetState()).toEqual(before);
    }
    await expect(rawAttempt(tenant, false)).rejects.toMatchObject({ errno: "42501" });
    expect(await targetState()).toEqual(before);
  });

  test("is target-bound, CAS-safe, minimized and direct updates stay denied", async () => {
    const before = await targetState();
    const protectedBefore = await protectedFingerprint();
    await expect(runtime!.withTenantTransaction(tenant, (tx) => tx`UPDATE account SET name=${canonical} WHERE id=${account}::uuid`)).rejects.toMatchObject({ errno: "42501" });
    const request = crypto.randomUUID();
    await expect(invoke(drifted, { request })).resolves.toEqual([{ account_id: account, changed: true, changed_fields: ["name"] }]);
    const after = await targetState();
    expect(after[0]!.immutable).toBe(before[0]!.immutable);
    expect(await protectedFingerprint()).toEqual(protectedBefore);
    expect(after[0]!.facts - before[0]!.facts).toBe(1);
    expect(after[0]!.events - before[0]!.events).toBe(1);
    await expect(invoke(canonical)).resolves.toEqual([{ account_id: account, changed: false, changed_fields: [] }]);
    expect(await protectedFingerprint()).toEqual(protectedBefore);
    await expect(invoke(drifted)).rejects.toMatchObject({ errno: "40001" });
    for (const key of ["tenant", "property", "party", "reservation", "account", "folio", "actor"] as const) {
      await expect(invoke(canonical, { [key]: crypto.randomUUID() })).rejects.toMatchObject({ errno: "42501" });
    }
    const evidence = await admin!<Array<{ fact: Record<string, unknown>; event: Record<string, unknown>; correlation_id: string; actor_id: string; property_node: string }>>`
      SELECT f.payload fact,o.payload event,o.correlation_id,o.actor_id,o.property_node
      FROM fact_log f JOIN outbox o ON o.tenant_id=f.tenant_id AND o.aggregate_id=f.entity_id AND o.event_type='account.reconciled'
      WHERE f.tenant_id=${tenant}::uuid AND f.entity_id=${account}::uuid AND f.fact_type='account.reconciled'`;
    expect(evidence).toEqual([{ fact: { account_id: account, changed_fields: ["name"], request_id: request }, event: { account_id: account, changed_fields: ["name"] }, correlation_id: request, actor_id: actor, property_node: property }]);
    expect(JSON.stringify(evidence)).not.toContain(canonical);
  });

  test("rejects a closed folio and rolls all state back after outbox failure", async () => {
    await admin!`UPDATE account SET name=${drifted} WHERE id=${account}::uuid`;
    await admin!`UPDATE folio SET status='closed' WHERE id=${folio}::uuid`;
    await expect(invoke(drifted)).rejects.toMatchObject({ errno: "42501" });
    await admin!`UPDATE folio SET status='open' WHERE id=${folio}::uuid`;
    const before = await targetState();
    const protectedBefore = await protectedFingerprint();
    await admin!.unsafe(`CREATE FUNCTION public.order471_fail_outbox() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.event_type='account.reconciled' THEN RAISE EXCEPTION 'order471 injected'; END IF; RETURN NEW; END; $$`);
    await admin!.unsafe("CREATE TRIGGER order471_fail_outbox AFTER INSERT ON public.outbox FOR EACH ROW EXECUTE FUNCTION public.order471_fail_outbox()");
    try { await expect(invoke(drifted)).rejects.toThrow("order471 injected"); }
    finally { await admin!.unsafe("DROP TRIGGER order471_fail_outbox ON public.outbox"); await admin!.unsafe("DROP FUNCTION public.order471_fail_outbox()"); }
    expect(await targetState()).toEqual(before);
    expect(await protectedFingerprint()).toEqual(protectedBefore);
    await expect(invoke(drifted)).resolves.toEqual([{ account_id: account, changed: true, changed_fields: ["name"] }]);
  });

  test("waits on its locked account before revalidating", async () => {
    await admin!`UPDATE account SET name=${drifted} WHERE id=${account}::uuid`;
    const holder = await admin!.reserve();
    try {
      await holder.unsafe("BEGIN");
      await holder`SELECT id FROM account WHERE id=${account}::uuid FOR UPDATE`;
      const holderPid = (await holder<Array<{ pid: number }>>`SELECT pg_backend_pid() pid`)[0]!.pid;
      const contender = invoke(drifted);
      let blocked = false;
      for (let i = 0; i < 30; i += 1) {
        const rows = await admin!<Array<{ blocked: boolean }>>`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE ${holderPid}::int=ANY(pg_blocking_pids(pid))) blocked`;
        if (rows[0]?.blocked) { blocked = true; break; }
        await Bun.sleep(10);
      }
      expect(blocked).toBe(true);
      await holder`UPDATE account SET status='closed' WHERE id=${account}::uuid`;
      await holder.unsafe("COMMIT");
      await expect(contender).rejects.toMatchObject({ errno: "42501" });
      await admin!`UPDATE account SET status='open' WHERE id=${account}::uuid`;
    } finally { try { await holder.unsafe("ROLLBACK"); } catch {} holder.release(); }
  });

  test("rejects pre-existing payment activity and postings without collateral mutation", async () => {
    await admin!`UPDATE account SET name=${drifted} WHERE id=${account}::uuid`;
    await admin!`INSERT INTO account(id,tenant_id,property_node,role,name,currency,status) VALUES(${clearing}::uuid,${tenant}::uuid,${property}::uuid,'card_clearing','Synthetic clearing','USD','open')`;
    await admin!`INSERT INTO payment_instrument(id,tenant_id,party_id,kind,token,status) VALUES(${instrument}::uuid,${tenant}::uuid,${party}::uuid,'card_network_token','tok_synthetic_order471','active')`;
    await admin!`INSERT INTO tx_code(code,name,grp) VALUES(${code},'Synthetic proof payment','payment')`;
    const beforePayment = await targetState();
    await admin!`INSERT INTO folio(id,tenant_id,account_id,reservation_id,folio_no,window_no,name,status) VALUES(${secondFolio}::uuid,${tenant}::uuid,${account}::uuid,${reservation}::uuid,'ARR-CLEAN-2',2,'Secondary','open')`;
    await admin!`INSERT INTO payment_operation(tenant_id,id,property_node,folio_id,guest_account_id,instrument_id,provider,method,currency,tx_code,clearing_account_id,key_hash,request_hash,actor_id) VALUES(${tenant}::uuid,${operation}::uuid,${property}::uuid,${secondFolio}::uuid,${account}::uuid,${instrument}::uuid,'testpay','card','USD',${code},${clearing}::uuid,repeat('a',64),repeat('b',64),${actor}::uuid)`;
    await expect(invoke(drifted)).rejects.toMatchObject({ errno: "42501" });
    expect(await targetState()).toEqual(beforePayment);
    await admin!`DELETE FROM payment_operation WHERE id=${operation}::uuid`;
    await admin!`DELETE FROM folio WHERE id=${secondFolio}::uuid`;
    await admin!`DELETE FROM payment_instrument WHERE id=${instrument}::uuid`;
    await admin!`DELETE FROM account WHERE id=${clearing}::uuid`;
    await admin!`DELETE FROM tx_code WHERE code=${code}`;

    await admin!`INSERT INTO account(id,tenant_id,property_node,role,name,currency,status) VALUES(${clearing}::uuid,${tenant}::uuid,${property}::uuid,'card_clearing','Synthetic clearing','USD','open')`;
    await admin!`INSERT INTO tx_code(code,name,grp) VALUES(${code},'Synthetic proof posting','revenue')`;
    await admin!`INSERT INTO business_day(tenant_id,property_node,business_date) VALUES(${tenant}::uuid,${property}::uuid,${postingDate}::date)`;
    await admin!`INSERT INTO journal(id,tenant_id,property_node,business_date,kind,description,currency) VALUES(${journal}::uuid,${tenant}::uuid,${property}::uuid,${postingDate}::date,'adjustment','Synthetic proof','USD')`;
    await admin!`INSERT INTO posting_line(tenant_id,journal_id,seq,account_id,folio_id,tx_code,description,amount_minor,business_date) VALUES(${tenant}::uuid,${journal}::uuid,1,${account}::uuid,${folio}::uuid,${code},'Synthetic proof',100,${postingDate}::date),(${tenant}::uuid,${journal}::uuid,2,${clearing}::uuid,NULL,${code},'Synthetic proof',-100,${postingDate}::date)`;
    const beforePosting = await targetState();
    await expect(invoke(drifted)).rejects.toMatchObject({ errno: "42501" });
    expect(await targetState()).toEqual(beforePosting);
    await admin!`DELETE FROM posting_line WHERE journal_id=${journal}::uuid`;
    await admin!`DELETE FROM journal WHERE id=${journal}::uuid`;
    await admin!`DELETE FROM business_day WHERE tenant_id=${tenant}::uuid AND property_node=${property}::uuid AND business_date=${postingDate}::date`;
    await admin!`DELETE FROM account WHERE id=${clearing}::uuid`;
    await admin!`DELETE FROM tx_code WHERE code=${code}`;
  });

  test("rejects hostile relationship and account states without changing preserved state", async () => {
    const db = admin!;
    await db`UPDATE account SET name=${canonical} WHERE id=${account}::uuid`;
    const cases: Array<{ apply: () => Promise<unknown>; undo: () => Promise<unknown> }> = [
      { apply: () => db`UPDATE app_user SET status='inactive' WHERE id=${actor}::uuid`, undo: () => db`UPDATE app_user SET status='active' WHERE id=${actor}::uuid` },
      { apply: () => db`UPDATE party SET status='anonymised' WHERE id=${party}::uuid`, undo: () => db`UPDATE party SET status='active' WHERE id=${party}::uuid` },
      { apply: () => db`UPDATE party_role SET detail='{}'::jsonb WHERE tenant_id=${tenant}::uuid AND party_id=${party}::uuid AND role='guest'`, undo: () => db`UPDATE party_role SET detail='{"source":"local-review","checkin_example":"clean"}'::jsonb WHERE tenant_id=${tenant}::uuid AND party_id=${party}::uuid AND role='guest'` },
      { apply: () => db`UPDATE org_node SET timezone='Asia/Kolkata' WHERE id=${property}::uuid`, undo: () => db`UPDATE org_node SET timezone='UTC' WHERE id=${property}::uuid` },
      { apply: () => db`UPDATE account SET role='company' WHERE id=${account}::uuid`, undo: () => db`UPDATE account SET role='guest' WHERE id=${account}::uuid` },
      { apply: () => db`UPDATE account SET currency='INR' WHERE id=${account}::uuid`, undo: () => db`UPDATE account SET currency='USD' WHERE id=${account}::uuid` },
      { apply: () => db`UPDATE account SET credit_limit_minor=1 WHERE id=${account}::uuid`, undo: () => db`UPDATE account SET credit_limit_minor=NULL WHERE id=${account}::uuid` },
      { apply: () => db`UPDATE reservation SET confirmation_no='OTHER' WHERE id=${reservation}::uuid`, undo: () => db`UPDATE reservation SET confirmation_no='ARR-CLEAN' WHERE id=${reservation}::uuid` },
      { apply: () => db`UPDATE folio SET window_no=2 WHERE id=${folio}::uuid`, undo: () => db`UPDATE folio SET window_no=1 WHERE id=${folio}::uuid` },
    ];
    for (const current of cases) {
      await current.apply();
      const baseline = await protectedFingerprint();
      await expect(invoke(canonical)).rejects.toMatchObject({ errno: "42501" });
      expect(await protectedFingerprint()).toEqual(baseline);
      await current.undo();
    }
  });

  test("rejects activity-first and permits the serial correction-first payment order", async () => {
    const db = admin!;
    await db`UPDATE account SET name=${drifted} WHERE id=${account}::uuid`;
    await db`INSERT INTO account(id,tenant_id,property_node,role,name,currency,status) VALUES(${clearing}::uuid,${tenant}::uuid,${property}::uuid,'card_clearing','Synthetic clearing','USD','open')`;
    await db`INSERT INTO payment_instrument(id,tenant_id,party_id,kind,token,status) VALUES(${instrument}::uuid,${tenant}::uuid,${party}::uuid,'card_network_token','tok_synthetic_order471','active')`;
    await db`INSERT INTO tx_code(code,name,grp) VALUES(${code},'Synthetic proof race','payment')`;
    await db`INSERT INTO folio(id,tenant_id,account_id,reservation_id,folio_no,window_no,name,status) VALUES(${secondFolio}::uuid,${tenant}::uuid,${account}::uuid,${reservation}::uuid,'ARR-CLEAN-2',2,'Secondary','open')`;
    const holder = await db.reserve();
    try {
      await holder.unsafe("BEGIN");
      // The correction locks Party first. Holding that row lets activity commit
      // before the correction reaches account/folio without reversing its order.
      await holder`SELECT id FROM party WHERE id=${party}::uuid FOR UPDATE`;
      const holderPid = (await holder<Array<{ pid: number }>>`SELECT pg_backend_pid() pid`)[0]!.pid;
      const correction = invoke(drifted);
      let blocked = false;
      for (let i = 0; i < 30; i += 1) {
        const rows = await db<Array<{ blocked: boolean }>>`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE ${holderPid}::int=ANY(pg_blocking_pids(pid))) blocked`;
        if (rows[0]?.blocked) { blocked = true; break; }
        await Bun.sleep(10);
      }
      expect(blocked).toBe(true);
      await holder`INSERT INTO payment_operation(tenant_id,id,property_node,folio_id,guest_account_id,instrument_id,provider,method,currency,tx_code,clearing_account_id,key_hash,request_hash,actor_id) VALUES(${tenant}::uuid,${operation}::uuid,${property}::uuid,${secondFolio}::uuid,${account}::uuid,${instrument}::uuid,'testpay','card','USD',${code},${clearing}::uuid,repeat('c',64),repeat('d',64),${actor}::uuid)`;
      await holder.unsafe("COMMIT");
      await expect(correction).rejects.toMatchObject({ errno: "42501" });
      const state = await targetState();
      expect(state[0]!.name).toBe(drifted);
      await db`DELETE FROM payment_operation WHERE id=${operation}::uuid`;
    } finally { try { await holder.unsafe("ROLLBACK"); } catch {} holder.release(); }

    const correctionSql = new SQL(RUNTIME!, { max: 1 });
    const correction = await correctionSql.reserve();
    const activity = await db.reserve();
    try {
      await correction.unsafe("BEGIN");
      await correction`SELECT set_config('app.tenant_id', ${tenant}, true)`;
      await correction.unsafe("SET LOCAL ROLE app_role");
      const changed = await correction`SELECT * FROM public.reconcile_synthetic_clean_arrival_account(${tenant}::uuid,${property}::uuid,${party}::uuid,${reservation}::uuid,${account}::uuid,${folio}::uuid,${actor}::uuid,${crypto.randomUUID()}::uuid,${drifted},${canonical})`;
      expect(changed).toEqual([{ account_id: account, changed: true, changed_fields: ["name"] }]);
      const correctionPid = (await correction<Array<{ pid: number }>>`SELECT pg_backend_pid() pid`)[0]!.pid;
      await activity.unsafe("BEGIN");
      const insertActivity = (async () => activity`INSERT INTO payment_operation(tenant_id,id,property_node,folio_id,guest_account_id,instrument_id,provider,method,currency,tx_code,clearing_account_id,key_hash,request_hash,actor_id) VALUES(${tenant}::uuid,${operationRace}::uuid,${property}::uuid,${secondFolio}::uuid,${account}::uuid,${instrument}::uuid,'testpay','card','USD',${code},${clearing}::uuid,repeat('e',64),repeat('f',64),${actor}::uuid)`)();
      let activityBlocked = false;
      for (let i = 0; i < 30; i += 1) {
        const rows = await db<Array<{ blocked: boolean }>>`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE ${correctionPid}::int=ANY(pg_blocking_pids(pid))) blocked`;
        if (rows[0]?.blocked) { activityBlocked = true; break; }
        await Bun.sleep(10);
      }
      expect(activityBlocked).toBe(true);
      await correction.unsafe("COMMIT");
      await insertActivity;
      await activity.unsafe("COMMIT");
      expect((await targetState())[0]!.name).toBe(canonical);
      await db`DELETE FROM payment_operation WHERE id=${operationRace}::uuid`;
    } finally {
      try { await correction.unsafe("ROLLBACK"); } catch {}
      try { await activity.unsafe("ROLLBACK"); } catch {}
      correction.release(); activity.release(); await correctionSql.close();
    }
    await db`DELETE FROM folio WHERE id=${secondFolio}::uuid`;
    await db`DELETE FROM payment_instrument WHERE id=${instrument}::uuid`;
    await db`DELETE FROM account WHERE id=${clearing}::uuid`;
    await db`DELETE FROM tx_code WHERE code=${code}`;
  });
});
