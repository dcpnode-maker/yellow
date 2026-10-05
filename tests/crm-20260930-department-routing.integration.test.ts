import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { SQL } from "bun";
import { createApp } from "../src/app";
import { BearerTenantResolver, Hs256TokenSigner, LocalLoginService } from "../src/contexts/identity";
import { DepartureServiceCoordinationService, type DepartureServiceKind, type DepartureServiceRequest } from "../src/contexts/stay-operations";
import { Database } from "../src/kernel";
import { OperatorHttpApi } from "../src/http/operator";

setDefaultTimeout(180_000);
// The dedicated routing runner supplies these only after its target and runtime guards.
const deployUrl = process.env.YELLOW_CRM_DISPATCH_DEPLOY_URL;
const runtimeUrl = process.env.YELLOW_CRM_DISPATCH_RUNTIME_URL;
const required = process.env.YELLOW_REQUIRE_CRM_DISPATCH_QUEUE === "1";
if (required && (!deployUrl || !runtimeUrl)) throw new Error("Dedicated CRM department-routing proof URLs are required");
function target(raw: string) {
  const url = new URL(raw);
  return { host: url.hostname.toLowerCase(), port: url.port || "5432", database: decodeURIComponent(url.pathname.slice(1)) };
}
if (deployUrl && runtimeUrl) {
  const deploy = target(deployUrl), runtime = target(runtimeUrl);
  if (deploy.host !== runtime.host || deploy.port !== runtime.port || deploy.database !== runtime.database ||
      !/^(yellow_crs.*|.*proof)$/.test(deploy.database))
    throw new Error("CRM department-routing proof targets are not the same guarded disposable database");
}
const suite = deployUrl && runtimeUrl ? describe.serial : describe.skip;
const tenant = crypto.randomUUID(), property = crypto.randomUUID(), peerProperty = crypto.randomUUID();
const actor = crypto.randomUUID(), staff = crypto.randomUUID(), roleA = crypto.randomUUID(), roleB = crypto.randomUUID();
const foreignTenant = crypto.randomUUID(), foreignProperty = crypto.randomUUID(), foreignActor = crypto.randomUUID(), foreignRole = crypto.randomUUID();
const unitType = crypto.randomUUID(), rate = crypto.randomUUID();
const identity = { tenantId: tenant, propertyNode: property, actorId: actor };
let admin: SQL, runtimeSql: SQL, db: Database, tokens: Hs256TokenSigner, app: ReturnType<typeof createApp>;
const service = new DepartureServiceCoordinationService();
const actionBody = (version: number, staffPartyId: string | null = null, outcome: string | null = null) => ({ expectedVersion: version, staffPartyId, outcome });

async function stay() {
  const reservationId = crypto.randomUUID(), segmentId = crypto.randomUUID(), spaceId = crypto.randomUUID(), unit = crypto.randomUUID();
  const start = new Date(Date.now() - 86_400_000).toISOString(), end = new Date(Date.now() + 86_400_000).toISOString();
  await admin`INSERT INTO reservation(id,tenant_id,property_node,confirmation_no,status,primary_party,currency)
    VALUES(${reservationId}::uuid,${tenant}::uuid,${property}::uuid,${reservationId},'in_house',${staff}::uuid,'USD')`;
  await admin`INSERT INTO space(id,tenant_id,property_node,code,profile_key,capacity,status)
    VALUES(${spaceId}::uuid,${tenant}::uuid,${property}::uuid,${spaceId},'crm-routing-room',2,'active')`;
  await admin`INSERT INTO sellable_unit(id,tenant_id,unit_type_id,name,status)
    VALUES(${unit}::uuid,${tenant}::uuid,${unitType}::uuid,${unit},'active')`;
  await admin`INSERT INTO sellable_unit_space(tenant_id,sellable_unit_id,space_id,claim_mode)
    VALUES(${tenant}::uuid,${unit}::uuid,${spaceId}::uuid,'exclusive')`;
  await admin`INSERT INTO reservation_segment(id,tenant_id,reservation_id,seq,unit_type_id,sellable_unit_id,period,rate_plan_id,status)
    VALUES(${segmentId}::uuid,${tenant}::uuid,${reservationId}::uuid,1,${unitType}::uuid,${unit}::uuid,
      tstzrange(${start}::timestamptz,${end}::timestamptz,'[)'),${rate}::uuid,'in_house')`;
  await db.withTenantTransaction(tenant, tx => tx`SELECT public.record_occupancy(${tenant}::uuid,${spaceId}::uuid,
    tstzrange(${start}::timestamptz,${end}::timestamptz,'[)'),${segmentId}::uuid,'segment',true)`);
  return { reservationId, expected: { segmentId, spaceId, departureAt: end } };
}

async function command(reservationId: string, requestId: string | null,
  action: "propose" | "confirm" | "assign" | "start" | "complete", body: unknown,
  targetIdentity = identity, key = crypto.randomUUID()) {
  return db.withTenantTransaction(targetIdentity.tenantId, tx => service.command(tx, targetIdentity,
    reservationId, requestId, action, body, key, crypto.randomUUID()));
}

async function propose(fixture: Awaited<ReturnType<typeof stay>>, roleId: string, kind: DepartureServiceKind = "luggage_pickup") {
  return command(fixture.reservationId, null, "propose", { serviceKind: kind, targetRoleId: roleId, parentRequestId: null,
    schedule: { mode: "immediate", minutes: null, localAt: null, utcOffsetMinutes: null }, expected: fixture.expected });
}

async function confirmed(fixture: Awaited<ReturnType<typeof stay>>, roleId: string, kind: DepartureServiceKind = "luggage_pickup") {
  const proposal = await propose(fixture, roleId, kind);
  return (await command(fixture.reservationId, proposal.request.requestId, "confirm", actionBody(1))).request;
}

async function http(path: string, token: Promise<string> | string, method: "GET" | "POST" = "GET", body?: unknown) {
  const headers = new Headers({ authorization: `Bearer ${await token}`, "x-correlation-id": crypto.randomUUID() });
  if (body !== undefined) headers.set("content-type", "application/json");
  if (method === "POST") headers.set("idempotency-key", crypto.randomUUID());
  return app.handle(new Request(`http://proof.test${path}`, { method, headers,
    body: body === undefined ? undefined : JSON.stringify(body) }));
}

async function fingerprint() {
  const tables = await admin<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`;
  const tableNames = tables.map(({ tablename }) => tablename);
  const requiredTables = ["posting_line", "folio", "journal", "api_idempotency", "departure_service_request", "task"];
  if (tableNames.length === 0 || requiredTables.some(name => !tableNames.includes(name)))
    throw new Error("CRM routing proof database is missing required public fingerprint tables");
  const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;
  const tableHashes: Record<string, string> = {};
  for (const name of tableNames) {
    const rows = await admin.unsafe<{ value: string }[]>(
      `SELECT md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY to_jsonb(t)::text),'')) value FROM public.${quote(name)} t`);
    if (rows.length !== 1 || typeof rows[0]?.value !== "string") throw new Error("CRM routing proof could not fingerprint a public table");
    tableHashes[name] = rows[0].value;
  }
  const sequences = await admin<{ sequencename: string }[]>`SELECT sequencename FROM pg_sequences WHERE schemaname='public' ORDER BY sequencename`;
  const sequenceStates: Record<string, { lastValue: string; isCalled: boolean }> = {};
  for (const { sequencename } of sequences) {
    const rows = await admin.unsafe<{ last_value: string; is_called: boolean }[]>(`SELECT last_value::text,is_called FROM public.${quote(sequencename)}`);
    if (rows.length !== 1 || typeof rows[0]?.last_value !== "string" || typeof rows[0]?.is_called !== "boolean")
      throw new Error("CRM routing proof could not fingerprint a public sequence");
    sequenceStates[sequencename] = { lastValue: rows[0].last_value, isCalled: rows[0].is_called };
  }
  return { tables: tableHashes, sequences: sequenceStates };
}

suite("CRM department routing filter on real PostgreSQL and signed HTTP", () => {
  beforeAll(async () => {
    admin = new SQL(deployUrl!, { prepare: false, max: 8 });
    db = Database.connect(runtimeUrl!, { prepare: false, maxConnections: 32 });
    runtimeSql = new SQL(runtimeUrl!, { prepare: false, max: 4 });
    const [adminIdentity] = await admin`SELECT current_database() name,(SELECT oid::text FROM pg_database WHERE datname=current_database()) oid,
      inet_server_addr()::text address,inet_server_port() port,pg_postmaster_start_time()::text started`;
    const [runtimeIdentity] = await runtimeSql`SELECT current_database() name,(SELECT oid::text FROM pg_database WHERE datname=current_database()) oid,
      inet_server_addr()::text address,inet_server_port() port,pg_postmaster_start_time()::text started,
      session_user::text session_user,current_user::text current_user,
      (SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname=session_user) elevated,
      pg_has_role(session_user,'app_role','member') app_member`;
    if (!/^(yellow_crs.*|.*proof)$/.test(adminIdentity.name) || adminIdentity.name !== runtimeIdentity.name ||
        adminIdentity.oid !== runtimeIdentity.oid || adminIdentity.address !== runtimeIdentity.address ||
        adminIdentity.port !== runtimeIdentity.port || adminIdentity.started !== runtimeIdentity.started)
      throw new Error("CRM routing proof pools do not identify the same guarded PostgreSQL target");
    if (runtimeIdentity.session_user !== "yellow_runtime" || runtimeIdentity.elevated !== false || runtimeIdentity.app_member !== true)
      throw new Error("CRM routing runtime identity is not the required restricted role");
    tokens = new Hs256TokenSigner("crm-routing-proof-signing-key-20260930-long-enough");
    app = createApp({ database: db, tenantResolver: new BearerTenantResolver(tokens),
      operatorApi: new OperatorHttpApi(new LocalLoginService(runtimeSql, tokens)) });
    await admin`INSERT INTO tenant(id,slug,name,tier,status) VALUES
      (${tenant}::uuid,${tenant},'CRM routing synthetic proof','shared','active'),
      (${foreignTenant}::uuid,${foreignTenant},'CRM routing foreign synthetic proof','shared','active')`;
    const context = await db.withTenantTransaction(tenant, async tx => (await tx`SELECT session_user::text session_user,current_user::text current_user,
      current_setting('app.tenant_id',true) tenant_context,pg_has_role(session_user,'app_role','member') app_member,
      (SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname=session_user) elevated`)[0]);
    if (context?.session_user !== "yellow_runtime" || context?.current_user !== "app_role" || context?.tenant_context !== tenant ||
        context?.elevated !== false || context?.app_member !== true) throw new Error("CRM routing tenant context/runtime check failed");
    await admin`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES
      (${property}::uuid,${tenant}::uuid,${'crm_route_'+tenant.replaceAll('-','')}::ltree,'property','CRM Routing Property','UTC','USD'),
      (${peerProperty}::uuid,${tenant}::uuid,${'crm_peer_'+tenant.replaceAll('-','')}::ltree,'property','CRM Routing Peer','UTC','USD'),
      (${foreignProperty}::uuid,${foreignTenant}::uuid,${'crm_foreign_'+foreignTenant.replaceAll('-','')}::ltree,'property','CRM Routing Foreign','UTC','USD')`;
    await admin`INSERT INTO app_user(id,tenant_id,email,display_name,status) VALUES
      (${actor}::uuid,${tenant}::uuid,${actor+'@example.test'},'CRM routing operator','active'),
      (${foreignActor}::uuid,${foreignTenant}::uuid,${foreignActor+'@example.test'},'CRM foreign routing operator','active')`;
    await admin`INSERT INTO role(id,tenant_id,name) VALUES
      (${roleA}::uuid,${tenant}::uuid,'Housekeeping Desk'),(${roleB}::uuid,${tenant}::uuid,'Front Desk Cashier'),
      (${foreignRole}::uuid,${foreignTenant}::uuid,'Duty Manager')`;
    for (const roleId of [roleA, roleB]) for (const scope of ["read", "request", "confirm", "dispatch", "work", "escalate"])
      await admin`INSERT INTO role_permission(role_id,permission_code) VALUES(${roleId}::uuid,${'stay-operations.departure-services:' + scope})`;
    await admin`INSERT INTO role_permission(role_id,permission_code) VALUES(${foreignRole}::uuid,'stay-operations.departure-services:read')`;
    await admin`INSERT INTO user_role(tenant_id,user_id,role_id,scope_node) VALUES
      (${tenant}::uuid,${actor}::uuid,${roleA}::uuid,${property}::uuid),
      (${tenant}::uuid,${actor}::uuid,${roleB}::uuid,${property}::uuid),
      (${foreignTenant}::uuid,${foreignActor}::uuid,${foreignRole}::uuid,${foreignProperty}::uuid)`;
    await admin`INSERT INTO party(id,tenant_id,kind,display_name,status) VALUES(${staff}::uuid,${tenant}::uuid,'person','CRM routing staff','active')`;
    await admin`INSERT INTO party_role(tenant_id,party_id,role) VALUES(${tenant}::uuid,${staff}::uuid,'staff')`;
    await admin`INSERT INTO unit_type(id,tenant_id,property_node,code,name,profile_key)
      VALUES(${unitType}::uuid,${tenant}::uuid,${property}::uuid,'CRMR','CRM routing','crm-routing-room')`;
    await admin`INSERT INTO rate_plan(id,tenant_id,property_node,code,name,currency,tax_inclusive)
      VALUES(${rate}::uuid,${tenant}::uuid,${property}::uuid,'CRMR','CRM routing','USD',false)`;
  });
  afterAll(async () => { await db?.close(); await runtimeSql?.close({ timeout: 0 }); await admin?.close({ timeout: 0 }); });

  test("role selection filters before100, preserves history and receipts, and keeps property authority", async () => {
    const token = await tokens.issue({ userId: actor, tenantId: tenant, scopes: ["stay-operations.departure-services:read"] });
    const earlierA: DepartureServiceRequest[] = [];
    let assignedA: DepartureServiceRequest | undefined, workingA: DepartureServiceRequest | undefined;
    for (let index = 0; index < 100; index += 1) {
      const request = await confirmed(await stay(), roleA, index === 1 ? "room_inspection" : "luggage_pickup");
      earlierA.push(request);
      if (index === 1) assignedA = request;
      if (index === 2) workingA = request;
    }
    if (!assignedA || !workingA) throw new Error("Routing backlog fixture omitted canonical task states");
    assignedA = (await command(assignedA.reservationId, assignedA.requestId, "assign", actionBody(assignedA.version, staff))).request;
    workingA = (await command(workingA.reservationId, workingA.requestId, "assign", actionBody(workingA.version, staff))).request;
    workingA = (await command(workingA.reservationId, workingA.requestId, "start", actionBody(workingA.version))).request;
    expect(assignedA.taskStatus).toBe("assigned");
    expect(workingA.taskStatus).toBe("in_progress");

    const laterBFixture = await stay();
    const laterB = await confirmed(laterBFixture, roleB, "minibar_check");
    const completedBFixture = await stay();
    let completedB = await confirmed(completedBFixture, roleB, "room_inspection");
    completedB = (await command(completedB.reservationId, completedB.requestId, "assign", actionBody(completedB.version, staff))).request;
    completedB = (await command(completedB.reservationId, completedB.requestId, "start", actionBody(completedB.version))).request;
    const receiptKey = crypto.randomUUID(), receiptBody = actionBody(completedB.version, null, "clear");
    const once = await command(completedB.reservationId, completedB.requestId, "complete", receiptBody, identity, receiptKey);
    const replay = await command(completedB.reservationId, completedB.requestId, "complete", receiptBody, identity, receiptKey);
    expect(once.replayed).toBe(false);
    expect(replay.replayed).toBe(true);
    expect(replay.request).toEqual(once.request);
    expect(replay.request.outcome).toBe("clear");

    const beforeReads = await fingerprint();
    const unfilteredResponse = await http(`/api/v1/properties/${property}/departure-services`, token);
    expect(unfilteredResponse.status).toBe(200);
    const unfiltered = await unfilteredResponse.json() as { requests: DepartureServiceRequest[]; roles: { roleId: string }[]; staff: unknown[] };
    expect(unfiltered.requests).toHaveLength(100);
    expect(unfiltered.requests.every(request => request.targetRoleId === roleA)).toBe(true);
    expect(unfiltered.requests.some(request => request.requestId === laterB.requestId)).toBe(false);
    expect(unfiltered.requests.some(request => request.taskStatus === "assigned")).toBe(true);
    expect(unfiltered.requests.some(request => request.taskStatus === "in_progress")).toBe(true);

    const roleBResponse = await http(`/api/v1/properties/${property}/departure-services?target_role_id=${roleB}`, token);
    expect(roleBResponse.status).toBe(200);
    const filteredB = await roleBResponse.json() as typeof unfiltered;
    expect(filteredB.requests.map(request => request.requestId).sort()).toEqual([laterB.requestId, completedB.requestId].sort());
    expect(filteredB.requests.every(request => request.targetRoleId === roleB)).toBe(true);
    expect(filteredB.roles).toEqual(unfiltered.roles);
    expect(filteredB.staff).toEqual(unfiltered.staff);

    const roleAResponse = await http(`/api/v1/properties/${property}/departure-services?target_role_id=${roleA}`, token);
    expect(roleAResponse.status).toBe(200);
    const filteredA = await roleAResponse.json() as typeof unfiltered;
    expect(filteredA.requests).toHaveLength(100);
    expect(filteredA.requests.every(request => request.targetRoleId === roleA)).toBe(true);
    expect(filteredA.requests.map(request => request.requestId)).toEqual(unfiltered.requests.map(request => request.requestId));
    const repeat = await http(`/api/v1/properties/${property}/departure-services?target_role_id=${roleA}`, token);
    expect((await repeat.json() as typeof unfiltered).requests.map(request => request.requestId))
      .toEqual(filteredA.requests.map(request => request.requestId));

    const unknown = crypto.randomUUID();
    const unknownResponse = await http(`/api/v1/properties/${property}/departure-services?target_role_id=${unknown}`, token);
    const foreignRoleResponse = await http(`/api/v1/properties/${property}/departure-services?target_role_id=${foreignRole}`, token);
    expect(unknownResponse.status).toBe(200);
    expect(foreignRoleResponse.status).toBe(200);
    expect((await unknownResponse.json() as typeof unfiltered).requests).toEqual([]);
    expect((await foreignRoleResponse.json() as typeof unfiltered).requests).toEqual([]);

    const historyResponse = await http(`/api/v1/properties/${property}/reservations/${laterBFixture.reservationId}/departure-services`, token);
    expect(historyResponse.status).toBe(200);
    const history = await historyResponse.json() as { requests: DepartureServiceRequest[] };
    expect(history.requests.map(request => request.requestId)).toEqual([laterB.requestId]);
    expect(history.requests[0]).toMatchObject({ targetRoleId: roleB, taskStatus: "open" });

    const filteredHistory = await http(`/api/v1/properties/${property}/reservations/${laterBFixture.reservationId}/departure-services?target_role_id=${roleB}`, token);
    const filteredCommand = await http(`/api/v1/properties/${property}/departure-services/${laterB.requestId}/assign?target_role_id=${roleB}`,
      token, "POST", actionBody(laterB.version, staff));
    expect(filteredHistory.status).toBe(400);
    expect(filteredCommand.status).toBe(400);

    const noScope = await tokens.issue({ userId: actor, tenantId: tenant, scopes: [] });
    expect((await http(`/api/v1/properties/${property}/departure-services?target_role_id=${unknown}`, noScope)).status).toBe(403);
    expect((await http(`/api/v1/properties/${crypto.randomUUID()}/departure-services?target_role_id=${roleB}`, token)).status).toBe(404);
    expect((await http(`/api/v1/properties/${peerProperty}/departure-services?target_role_id=${roleB}`, token)).status).toBe(404);
    const foreignToken = await tokens.issue({ userId: foreignActor, tenantId: foreignTenant, scopes: ["stay-operations.departure-services:read"] });
    expect((await http(`/api/v1/properties/${property}/departure-services?target_role_id=${roleB}`, foreignToken)).status).toBe(404);
    expect((await http(`/api/v1/properties/${foreignProperty}/departure-services?target_role_id=${roleB}`, token)).status).toBe(404);
    expect((await app.handle(new Request(`http://proof.test/api/v1/properties/${property}/departure-services?target_role_id=${roleB}`))).status).toBe(401);

    await admin`DELETE FROM role_permission WHERE role_id IN (${roleA}::uuid,${roleB}::uuid)
      AND permission_code='stay-operations.departure-services:read'`;
    expect((await http(`/api/v1/properties/${property}/departure-services?target_role_id=${roleB}`, token)).status).toBe(404);
    await admin`INSERT INTO role_permission(role_id,permission_code) VALUES
      (${roleA}::uuid,'stay-operations.departure-services:read'),(${roleB}::uuid,'stay-operations.departure-services:read')`;
    await admin`UPDATE app_user SET status='disabled' WHERE tenant_id=${tenant}::uuid AND id=${actor}::uuid`;
    expect((await http(`/api/v1/properties/${property}/departure-services?target_role_id=${roleB}`, token)).status).toBe(403);
    await admin`UPDATE app_user SET status='active' WHERE tenant_id=${tenant}::uuid AND id=${actor}::uuid`;

    expect(await fingerprint()).toEqual(beforeReads);
  });
});
