import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { SQL } from "bun";
import { createApp } from "../src/app";
import { BearerTenantResolver, Hs256TokenSigner, LocalLoginService } from "../src/contexts/identity";
import { Database } from "../src/kernel";
import { DepartureServiceCoordinationService, type DepartureServiceRequest, type DepartureServiceKind } from "../src/contexts/stay-operations";
import { OperatorHttpApi } from "../src/http/operator";

setDefaultTimeout(180_000);
const deployUrl = process.env.YELLOW_CRM_DISPATCH_DEPLOY_URL;
const runtimeUrl = process.env.YELLOW_CRM_DISPATCH_RUNTIME_URL;
const required = process.env.YELLOW_REQUIRE_CRM_DISPATCH_QUEUE === "1";
if (required && (!deployUrl || !runtimeUrl)) throw new Error("Dedicated CRM dispatch proof URLs are required");
function target(raw: string) {
  const u = new URL(raw);
  return { host: u.hostname.toLowerCase(), port: u.port || (u.protocol === "postgres:" ? "5432" : "5432"), database: decodeURIComponent(u.pathname.slice(1)) };
}
if (deployUrl && runtimeUrl) {
  const a = target(deployUrl), b = target(runtimeUrl);
  if (a.host !== b.host || a.port !== b.port || a.database !== b.database ||
      !a.database.startsWith("yellow_crs") && !a.database.endsWith("proof"))
    throw new Error("CRM dispatch proof targets are not the same guarded disposable database");
}
const suite = deployUrl && runtimeUrl ? describe.serial : describe.skip;
const tenant = crypto.randomUUID(), property = crypto.randomUUID(), peerProperty = crypto.randomUUID();
const actor = crypto.randomUUID(), staff = crypto.randomUUID(), role = crypto.randomUUID();
const foreignTenant = crypto.randomUUID(), foreignProperty = crypto.randomUUID(), foreignActor = crypto.randomUUID();
const unitType = crypto.randomUUID(), rate = crypto.randomUUID();
const identity = { tenantId: tenant, propertyNode: property, actorId: actor };
let admin: SQL, loginPool: SQL, db: Database, tokens: Hs256TokenSigner, app: ReturnType<typeof createApp>;
const service = new DepartureServiceCoordinationService();
const act = (version: number, staffPartyId: string | null = null, outcome: string | null = null) => ({ expectedVersion: version, staffPartyId, outcome });
async function command(reservationId: string, requestId: string | null, action: "propose" | "confirm" | "assign" | "start" | "complete", body: unknown) {
  return db.withTenantTransaction(tenant, tx => service.command(tx, identity, reservationId, requestId, action, body,
    crypto.randomUUID(), crypto.randomUUID()));
}
async function stay() {
  const reservationId = crypto.randomUUID(), segmentId = crypto.randomUUID(), spaceId = crypto.randomUUID(), unit = crypto.randomUUID();
  const start = new Date(Date.now() - 86_400_000).toISOString(), end = new Date(Date.now() + 86_400_000).toISOString();
  await admin`INSERT INTO reservation(id,tenant_id,property_node,confirmation_no,status,primary_party,currency)
    VALUES(${reservationId}::uuid,${tenant}::uuid,${property}::uuid,${reservationId},'in_house',${staff}::uuid,'USD')`;
  await admin`INSERT INTO space(id,tenant_id,property_node,code,profile_key,capacity,status)
    VALUES(${spaceId}::uuid,${tenant}::uuid,${property}::uuid,${spaceId},'crm-proof-room',2,'active')`;
  await admin`INSERT INTO sellable_unit(id,tenant_id,unit_type_id,name,status) VALUES(${unit}::uuid,${tenant}::uuid,${unitType}::uuid,${unit},'active')`;
  await admin`INSERT INTO sellable_unit_space(tenant_id,sellable_unit_id,space_id,claim_mode) VALUES(${tenant}::uuid,${unit}::uuid,${spaceId}::uuid,'exclusive')`;
  await admin`INSERT INTO reservation_segment(id,tenant_id,reservation_id,seq,unit_type_id,sellable_unit_id,period,rate_plan_id,status)
    VALUES(${segmentId}::uuid,${tenant}::uuid,${reservationId}::uuid,1,${unitType}::uuid,${unit}::uuid,
      tstzrange(${start}::timestamptz,${end}::timestamptz,'[)'),${rate}::uuid,'in_house')`;
  await db.withTenantTransaction(tenant, tx => tx`SELECT public.record_occupancy(${tenant}::uuid,${spaceId}::uuid,
    tstzrange(${start}::timestamptz,${end}::timestamptz,'[)'),${segmentId}::uuid,'segment',true)`);
  return { reservationId, expected: { segmentId, spaceId, departureAt: end } };
}
async function propose(f: Awaited<ReturnType<typeof stay>>, kind: DepartureServiceKind, delayed = false) {
  return command(f.reservationId, null, "propose", { serviceKind: kind, targetRoleId: role,
    parentRequestId: null, schedule: delayed
      ? { mode: "delay", minutes: 45, localAt: null, utcOffsetMinutes: null }
      : { mode: "immediate", minutes: null, localAt: null, utcOffsetMinutes: null }, expected: f.expected });
}
async function progress(f: Awaited<ReturnType<typeof stay>>, kind: DepartureServiceKind, end: boolean, delayed = false) {
  const p = await propose(f, kind, delayed);
  let r = (await command(f.reservationId, p.request.requestId, "confirm", act(1))).request;
  if (!end) return r;
  r = (await command(f.reservationId, r.requestId, "assign", act(r.version, staff))).request;
  r = (await command(f.reservationId, r.requestId, "start", act(r.version))).request;
  return (await command(f.reservationId, r.requestId, "complete", act(r.version, null,
    kind === "luggage_pickup" ? null : "finding_reported"))).request;
}
async function request(path: string, method: "GET" | "POST", token: Promise<string> | string, body?: unknown, key = crypto.randomUUID()) {
  const headers = new Headers({ authorization: `Bearer ${await token}`, "x-correlation-id": crypto.randomUUID() });
  if (body !== undefined) headers.set("content-type", "application/json");
  if (method === "POST") headers.set("idempotency-key", key);
  return app.handle(new Request(`http://proof.test${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }));
}
async function fingerprint() {
  const tables = await admin<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`;
  const tableNames = tables.map(({ tablename }) => tablename);
  const requiredTables = ["posting_line", "folio", "journal", "api_idempotency"];
  if (tableNames.length === 0 || requiredTables.some(name => !tableNames.includes(name)))
    throw new Error("CRM proof database is missing required public fingerprint tables");
  const quoteIdentifier = (name: string) => `"${name.replaceAll('"', '""')}"`;
  const tableHashes: Record<string, string> = {};
  for (const name of tableNames) {
    const result = await admin.unsafe<{ value: string }[]>(
      `SELECT md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY to_jsonb(t)::text),'')) value FROM public.${quoteIdentifier(name)} t`);
    if (result.length !== 1 || typeof result[0]?.value !== "string")
      throw new Error("CRM proof could not fingerprint a public table");
    tableHashes[name] = result[0].value;
  }
  const sequences = await admin<{ sequencename: string }[]>`SELECT sequencename FROM pg_sequences WHERE schemaname='public' ORDER BY sequencename`;
  const sequenceStates: Record<string, { lastValue: string; isCalled: boolean }> = {};
  for (const { sequencename } of sequences) {
    const state = await admin.unsafe<{ last_value: string; is_called: boolean }[]>(
      `SELECT last_value::text,is_called FROM public.${quoteIdentifier(sequencename)}`);
    if (state.length !== 1 || typeof state[0]?.last_value !== "string" || typeof state[0]?.is_called !== "boolean")
      throw new Error("CRM proof could not fingerprint a public sequence");
    sequenceStates[sequencename] = { lastValue: state[0].last_value, isCalled: state[0].is_called };
  }
  return { tables: tableHashes, sequences: sequenceStates };
}

suite("CRM departure dispatch priority on real PostgreSQL", () => {
  beforeAll(async () => {
    admin = new SQL(deployUrl!, { prepare: false, max: 8 });
    db = Database.connect(runtimeUrl!, { prepare: false, maxConnections: 16 });
    loginPool = new SQL(runtimeUrl!, { prepare: false, max: 4 });
    const [adminIdentity] = await admin`SELECT current_database() AS name, (SELECT oid::text FROM pg_database WHERE datname=current_database()) AS oid,
      inet_server_addr()::text AS address, inet_server_port() AS port, pg_postmaster_start_time()::text AS started`;
    const [runtimeIdentity] = await loginPool`SELECT current_database() AS name, (SELECT oid::text FROM pg_database WHERE datname=current_database()) AS oid,
      inet_server_addr()::text AS address, inet_server_port() AS port, pg_postmaster_start_time()::text AS started,
      session_user::text AS session_user, current_user::text AS current_user,
      (SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname=session_user) AS elevated,
      pg_has_role(session_user,'app_role','member') AS app_member`;
    if (!/^(yellow_crs.*|.*proof)$/.test(adminIdentity.name) ||
        adminIdentity.name !== runtimeIdentity.name || adminIdentity.oid !== runtimeIdentity.oid ||
        adminIdentity.address !== runtimeIdentity.address || adminIdentity.port !== runtimeIdentity.port || adminIdentity.started !== runtimeIdentity.started)
      throw new Error("CRM dispatch proof pools do not identify the same guarded PostgreSQL target");
    if (runtimeIdentity.session_user !== "yellow_runtime" || runtimeIdentity.elevated !== false || runtimeIdentity.app_member !== true)
      throw new Error("CRM dispatch runtime identity is not the required restricted role");
    tokens = new Hs256TokenSigner("crm-dispatch-proof-signing-key-20260930-long-enough");
    app = createApp({ database: db, tenantResolver: new BearerTenantResolver(tokens),
      operatorApi: new OperatorHttpApi(new LocalLoginService(loginPool, tokens)) });
    await admin`INSERT INTO tenant(id,slug,name,tier,status) VALUES(${tenant}::uuid,${tenant},'CRM queue synthetic proof','shared','active')`;
    const ctx = await db.withTenantTransaction(tenant, async tx => (await tx`SELECT session_user::text AS session_user,current_user::text AS current_user,
      current_setting('app.tenant_id',true) AS tenant_context,pg_has_role(session_user,'app_role','member') AS app_member,
      (SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname=session_user) AS elevated`)[0]);
    if (ctx?.session_user !== "yellow_runtime" || ctx?.current_user !== "app_role" || ctx?.tenant_context !== tenant || ctx?.elevated !== false || ctx?.app_member !== true)
      throw new Error("CRM dispatch transaction identity/context check failed");
    await admin`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES
      (${property}::uuid,${tenant}::uuid,${'crm_'+tenant.replaceAll('-','')}::ltree,'property','CRM Queue Proof','Pacific/Auckland','USD'),
      (${peerProperty}::uuid,${tenant}::uuid,${'peer_'+tenant.replaceAll('-','')}::ltree,'property','CRM Peer Proof','Europe/Paris','EUR')`;
    await admin`INSERT INTO tenant(id,slug,name,tier,status) VALUES(${foreignTenant}::uuid,${foreignTenant},'CRM foreign synthetic proof','shared','active')`;
    await admin`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES
      (${foreignProperty}::uuid,${foreignTenant}::uuid,${'foreign_'+foreignTenant.replaceAll('-','')}::ltree,'property','CRM Foreign Proof','Europe/Paris','EUR')`;
    await admin`INSERT INTO app_user(id,tenant_id,email,display_name,status) VALUES(${foreignActor}::uuid,${foreignTenant}::uuid,${foreignActor+'@example.test'},'CRM foreign proof operator','active')`;
    await admin`INSERT INTO app_user(id,tenant_id,email,display_name,status) VALUES(${actor}::uuid,${tenant}::uuid,${actor+'@example.test'},'CRM proof operator','active')`;
    await admin`INSERT INTO role(id,tenant_id,name) VALUES(${role}::uuid,${tenant}::uuid,'Duty Manager')`;
    for (const p of ["read", "request", "confirm", "dispatch", "work", "escalate"])
      await admin`INSERT INTO role_permission(role_id,permission_code) VALUES(${role}::uuid,${'stay-operations.departure-services:' + p})`;
    await admin`INSERT INTO user_role(tenant_id,user_id,role_id,scope_node) VALUES(${tenant}::uuid,${actor}::uuid,${role}::uuid,${property}::uuid)`;
    await admin`INSERT INTO party(id,tenant_id,kind,display_name,status) VALUES(${staff}::uuid,${tenant}::uuid,'person','CRM proof staff','active')`;
    await admin`INSERT INTO party_role(tenant_id,party_id,role) VALUES(${tenant}::uuid,${staff}::uuid,'staff')`;
    await admin`INSERT INTO unit_type(id,tenant_id,property_node,code,name,profile_key) VALUES(${unitType}::uuid,${tenant}::uuid,${property}::uuid,'CRMQ','CRM queue','crm-proof-room')`;
    await admin`INSERT INTO rate_plan(id,tenant_id,property_node,code,name,currency,tax_inclusive) VALUES(${rate}::uuid,${tenant}::uuid,${property}::uuid,'CRMQ','CRM queue','USD',false)`;
  });
  afterAll(async () => { await db?.close(); await loginPool?.close({ timeout: 0 }); await admin?.close({ timeout: 0 }); });

  test("active work outranks 100 completed rows, ties are stable, history and receipts remain canonical and reads do not write", async () => {
    const token = await tokens.issue({ userId: actor, tenantId: tenant, scopes: ["stay-operations.departure-services:read"] });
    const completed: DepartureServiceRequest[] = [];
    const small = await stay();
    const smallDone = await progress(small, "room_inspection", true);
    const smallBefore = await fingerprint();
    const smallQueueResponse = await request(`/api/v1/properties/${property}/departure-services`, "GET", token);
    expect(smallQueueResponse.status).toBe(200);
    const smallQueue = await smallQueueResponse.json() as { requests: DepartureServiceRequest[] };
    expect(smallQueue.requests).toHaveLength(1);
    expect(smallQueue.requests[0]).toMatchObject({ requestId: smallDone.requestId, taskStatus: "done", outcome: "finding_reported" });
    expect(await fingerprint()).toEqual(smallBefore);
    completed.push(smallDone);
    for (let i = 1; i < 100; i++) {
      const old = await stay();
      completed.push(await progress(old, "luggage_pickup", true));
    }
    const open = await stay(), assigned = await stay(), working = await stay(), checkedOut = await stay();
    const done = await progress(open, "room_inspection", true);
    const pOpen = await propose(open, "minibar_check", true);
    const pAssigned = await propose(assigned, "room_inspection");
    const pWorking = await propose(working, "luggage_pickup");
    const pChecked = await propose(checkedOut, "luggage_pickup");
    const pExtra = await propose(open, "luggage_pickup");
    const batchItems: { f: Awaited<ReturnType<typeof stay>>; p: Awaited<ReturnType<typeof propose>> }[] = [
      { f: open, p: pOpen }, { f: assigned, p: pAssigned }, { f: working, p: pWorking },
      { f: checkedOut, p: pChecked }, { f: open, p: pExtra },
    ];
    const batchConfirmed = await db.withTenantTransaction(tenant, async tx => {
      const results = [];
      for (const { f, p } of batchItems) results.push(await service.command(tx, identity, f.reservationId,
        p.request.requestId, "confirm", act(1), crypto.randomUUID(), crypto.randomUUID()));
      return results;
    });
    const openReq = batchConfirmed[0]!.request;
    let assignedReq = batchConfirmed[1]!.request;
    const workReq0 = batchConfirmed[2]!.request;
    const checkedReq = batchConfirmed[3]!.request;
    const extraOpen = batchConfirmed[4]!.request;
    assignedReq = (await command(assigned.reservationId, assignedReq.requestId, "assign", act(assignedReq.version, staff))).request;
    const workReq = (await command(working.reservationId, workReq0.requestId, "assign", act(workReq0.version, staff))).request;
    const workingReq = (await command(working.reservationId, workReq.requestId, "start", act(workReq.version))).request;
    const oldDone = completed[0]!;
    await admin`UPDATE reservation SET status='checked_out' WHERE id=${checkedOut.reservationId}::uuid`;
    const replayFixture = await stay();
    const replayProposal = await command(replayFixture.reservationId, null, "propose", {
      serviceKind: "luggage_pickup", targetRoleId: role, parentRequestId: null,
      schedule: { mode: "immediate", minutes: null, localAt: null, utcOffsetMinutes: null }, expected: replayFixture.expected,
    });
    let replayRequest = (await command(replayFixture.reservationId, replayProposal.request.requestId, "confirm", act(1))).request;
    replayRequest = (await command(replayFixture.reservationId, replayRequest.requestId, "assign", act(replayRequest.version, staff))).request;
    replayRequest = (await command(replayFixture.reservationId, replayRequest.requestId, "start", act(replayRequest.version))).request;
    const completionKey = crypto.randomUUID(), completionBody = act(replayRequest.version);
    const completeOnce = await db.withTenantTransaction(tenant, tx => service.command(tx, identity, replayFixture.reservationId,
      replayRequest.requestId, "complete", completionBody, completionKey, crypto.randomUUID()));
    const completeReplay = await db.withTenantTransaction(tenant, tx => service.command(tx, identity, replayFixture.reservationId,
      replayRequest.requestId, "complete", completionBody, completionKey, crypto.randomUUID()));
    expect(completeOnce.replayed).toBe(false);
    expect(completeReplay.replayed).toBe(true);
    expect(completeReplay.request).toEqual(completeOnce.request);
    const before = await fingerprint();
    let response = await request(`/api/v1/properties/${property}/departure-services`, "GET", token);
    expect(response.status).toBe(200);
    const queue = await response.json() as { requests: DepartureServiceRequest[] };
    expect(queue.requests).toHaveLength(100);
    expect(new Set([assignedReq.dueAt, workingReq.dueAt, checkedReq.dueAt, extraOpen.dueAt]).size).toBe(1);
    expect(assignedReq.taskStatus).toBe("assigned");
    expect(workingReq.taskStatus).toBe("in_progress");
    expect(checkedReq.taskStatus).toBe("open");
    const expectedActive = [openReq, assignedReq, workingReq, checkedReq, extraOpen]
      .sort((a,b) => a.dueAt.localeCompare(b.dueAt) || a.requestId.localeCompare(b.requestId));
    expect(queue.requests.slice(0, 5).map(r => r.requestId)).toEqual(expectedActive.map(r => r.requestId));
    expect(queue.requests.slice(5).every(r => r.taskStatus === "done")).toBe(true);
    expect(queue.requests.some(r => r.requestId === oldDone.requestId)).toBe(true);
    response = await request(`/api/v1/properties/${property}/reservations/${open.reservationId}/departure-services`, "GET", token);
    expect(response.status).toBe(200);
    const history = await response.json() as { requests: DepartureServiceRequest[] };
    expect(history.requests.map(r => r.requestId)).toEqual([done, openReq, extraOpen]
      .sort((a,b) => a.dueAt.localeCompare(b.dueAt) || a.requestId.localeCompare(b.requestId)).map(r => r.requestId));
    expect(history.requests[0]?.taskStatus).toBe("done");
    expect(history.requests.slice(1).every(r => r.taskStatus === "open")).toBe(true);
    response = await request(`/api/v1/properties/${property}/departure-services`, "GET", token);
    expect(response.status).toBe(200);
    const repeat = await response.json() as { requests: DepartureServiceRequest[] };
    expect(repeat.requests.map(r => r.requestId)).toEqual(queue.requests.map(r => r.requestId));
    const afterRead = await fingerprint(); expect(afterRead).toEqual(before);
    const noScope = await tokens.issue({ userId: actor, tenantId: tenant, scopes: [] });
    expect((await request(`/api/v1/properties/${property}/departure-services`, "GET", noScope)).status).toBe(403);
    expect((await request(`/api/v1/properties/${crypto.randomUUID()}/departure-services`, "GET", token)).status).toBe(404);
    expect((await request(`/api/v1/properties/${peerProperty}/departure-services`, "GET", token)).status).toBe(404);
    expect((await request(`/api/v1/properties/not-a-uuid/departure-services`, "GET", token)).status).toBe(400);
    const foreignClaim = await tokens.issue({ userId: foreignActor, tenantId: foreignTenant, scopes: ["stay-operations.departure-services:read"] });
    expect((await request(`/api/v1/properties/${property}/departure-services`, "GET", foreignClaim)).status).toBe(404);
    expect((await request(`/api/v1/properties/${foreignProperty}/departure-services`, "GET", token)).status).toBe(404);
    const noToken = await app.handle(new Request(`http://proof.test/api/v1/properties/${property}/departure-services`));
    expect(noToken.status).toBe(401);
    await admin`DELETE FROM user_role WHERE tenant_id=${tenant}::uuid AND user_id=${actor}::uuid AND role_id=${role}::uuid AND scope_node=${property}::uuid`;
    expect((await request(`/api/v1/properties/${property}/departure-services`, "GET", token)).status).toBe(404);
    await admin`INSERT INTO user_role(tenant_id,user_id,role_id,scope_node) VALUES(${tenant}::uuid,${actor}::uuid,${role}::uuid,${property}::uuid)`;
    await admin`UPDATE app_user SET status='disabled' WHERE tenant_id=${tenant}::uuid AND id=${actor}::uuid`;
    expect((await request(`/api/v1/properties/${property}/departure-services`, "GET", token)).status).toBe(403);
    await admin`UPDATE app_user SET status='active' WHERE tenant_id=${tenant}::uuid AND id=${actor}::uuid`;
    const afterDenials = await fingerprint(); expect(afterDenials).toEqual(before);
  });
});
