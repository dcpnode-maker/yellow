import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";
import { GroupReservationConflictError, GroupReservationNotFoundError, GroupReservationService } from "../src/contexts/reservations";
import { createAuditEnvelope, Database, IdempotencyConflictError, PostgresEventBus, PostgresIdempotency } from "../src/kernel";

const deployUrl = process.env.YELLOW_ORDER687_DEPLOY_URL;
const runtimeUrl = process.env.YELLOW_ORDER687_RUNTIME_URL;
const required = process.env.YELLOW_REQUIRE_ORDER687_DB === "1";
if (required && (!deployUrl || !runtimeUrl)) throw new Error("Order687 isolated database URLs are required");
const dbDescribe = deployUrl && runtimeUrl ? describe.serial : describe.skip;
const tenant = crypto.randomUUID(), foreignTenant = crypto.randomUUID();
const property = crypto.randomUUID(), otherProperty = crypto.randomUUID(), foreignProperty = crypto.randomUUID();
const party = crypto.randomUUID(), reservation = crypto.randomUUID(), secondReservation = crypto.randomUUID();
const otherReservation = crypto.randomUUID(), foreignReservation = crypto.randomUUID(), checkedIn = crypto.randomUUID();
const hostileReservation = crypto.randomUUID();
const actor = crypto.randomUUID(), run = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
let admin: SQL, database: Database, service: GroupReservationService;
function envelope(propertyNode = property, tenantId = tenant, operation = "group.created") {
  return createAuditEnvelope({ actorId: actor, tenantId, propertyNode, requestId: crypto.randomUUID(), operation });
}
async function create(name: string, key: string, propertyNode = property, tenantId = tenant) {
  const connection = Database.connect(runtimeUrl!, { maxConnections: 1, prepare: false });
  try { return await connection.withTenantTransaction(tenantId, tx => service.create(tx,
    { name, idempotencyKey: key, envelope: envelope(propertyNode, tenantId) })); }
  finally { await connection.close(); }
}
async function attach(groupId: string, reservationId: string, key: string, propertyNode = property, tenantId = tenant) {
  const connection = Database.connect(runtimeUrl!, { maxConnections: 1, prepare: false });
  try { return await connection.withTenantTransaction(tenantId, tx => service.attach(tx, { groupId, reservationId,
    expectedGroupId: null, idempotencyKey: key,
    envelope: envelope(propertyNode, tenantId, "reservation.group_linked") })); }
  finally { await connection.close(); }
}
async function runRuntime<T>(tenantId: string, operation: Parameters<Database["withTenantTransaction"]>[1]): Promise<T> {
  const connection = Database.connect(runtimeUrl!, { maxConnections: 1, prepare: false });
  try { return await connection.withTenantTransaction(tenantId, operation) as T; }
  finally { await connection.close(); }
}

dbDescribe("Order687 isolated PostgreSQL linked groups", () => {
  beforeAll(async () => {
    for (const raw of [deployUrl!, runtimeUrl!]) {
      const url = new URL(raw);
      if (!/^postgres(?:ql)?:$/.test(url.protocol) || url.hostname !== "127.0.0.1" ||
          !/^\/(?:order687[^/]*|yellow_order689_proof)$/.test(url.pathname) || !url.password)
        throw new Error("Order687/689 URL must target an isolated loopback proof database");
    }
    admin = new SQL(deployUrl!, { max: 2, prepare: false });
    database = Database.connect(runtimeUrl!, { maxConnections: 2, prepare: false });
    service = new GroupReservationService({ events: new PostgresEventBus(admin), idempotency: new PostgresIdempotency() });
    await admin`INSERT INTO tenant(id,slug,name,tier,status) VALUES
      (${tenant}::uuid,${`order687-${run}`},'Order687','shared','active'),
      (${foreignTenant}::uuid,${`order687-foreign-${run}`},'Foreign','shared','active')`;
    await admin`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES
      (${property}::uuid,${tenant}::uuid,${`order687_a_${run}`},'property','Main','UTC','USD'),
      (${otherProperty}::uuid,${tenant}::uuid,${`order687_b_${run}`},'property','Other','UTC','USD'),
      (${foreignProperty}::uuid,${foreignTenant}::uuid,${`order687_c_${run}`},'property','Foreign','UTC','USD')`;
    await admin`INSERT INTO party(id,tenant_id,kind,display_name,status) VALUES
      (${party}::uuid,${tenant}::uuid,'person','Test Guest','active')`;
    await admin`INSERT INTO reservation(id,tenant_id,property_node,confirmation_no,status,primary_party,currency) VALUES
      (${reservation}::uuid,${tenant}::uuid,${property}::uuid,${`G-${run}-1`},'reserved',${party}::uuid,'USD'),
      (${secondReservation}::uuid,${tenant}::uuid,${property}::uuid,${`G-${run}-2`},'due_in',${party}::uuid,'USD'),
      (${checkedIn}::uuid,${tenant}::uuid,${property}::uuid,${`G-${run}-3`},'in_house',${party}::uuid,'USD'),
      (${hostileReservation}::uuid,${tenant}::uuid,${property}::uuid,${`G-${run}-6`},'reserved',${party}::uuid,'USD'),
      (${otherReservation}::uuid,${tenant}::uuid,${otherProperty}::uuid,${`G-${run}-4`},'reserved',${party}::uuid,'USD'),
      (${foreignReservation}::uuid,${foreignTenant}::uuid,${foreignProperty}::uuid,${`G-${run}-5`},'reserved',${party}::uuid,'USD')`;
  });
  afterAll(async () => { await database?.close(); await admin?.close(); });

  test("create is persisted, same-key replay exact, different body rejected, property isolated", async () => {
    const key = `order687-${run}-create`;
    const first = await create("Patel party", key);
    expect(first.group).toMatchObject({ kind: "linked", name: "Patel party", roomsHeldByGroup: false, memberCount: 0 });
    expect(first.replayed).toBe(false);
    const replay = await create("Patel party", key);
    expect(replay.replayed).toBe(true); expect(replay.group.groupId).toBe(first.group.groupId);
    await expect(create("Different party", key)).rejects.toThrow(IdempotencyConflictError);
    const page = await database.withTenantTransaction(tenant, tx => service.list(tx,
      { tenantId: tenant, propertyNode: property, limit: 1, cursor: null }));
    expect(page.groups.some(group => group.groupId === first.group.groupId)).toBe(true);
    const other = await database.withTenantTransaction(tenant, tx => service.list(tx,
      { tenantId: tenant, propertyNode: otherProperty, limit: 50, cursor: null }));
    expect(other.groups.some(group => group.groupId === first.group.groupId)).toBe(false);
    const foreign = await database.withTenantTransaction(foreignTenant, tx => service.list(tx,
      { tenantId: foreignTenant, propertyNode: property, limit: 50, cursor: null }));
    expect(foreign.groups).toEqual([]);
  });

  test("group name/code search filters before the 50-row page and stays tenant/property scoped", async () => {
    const prefix = crypto.randomUUID().slice(0, 8);
    const target = `${prefix}-ffff-4fff-8fff-ffffffffffff`;
    await admin`
      INSERT INTO reservation_group(tenant_id,property_node,id,kind,code,name,status)
      SELECT ${tenant}::uuid, ${property}::uuid,
        (${prefix}::text || '-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
        'linked', ${`ORD689-${run}-`} || n::text, 'Ordinary group ' || n::text, 'tentative'
      FROM generate_series(1,51) AS n
    `;
    await admin`INSERT INTO reservation_group(tenant_id,property_node,id,kind,code,name,status) VALUES
      (${tenant}::uuid,${property}::uuid,${target}::uuid,'linked',${`ORD689-NEEDLE-${run}`},'Needle 100%_ group','tentative'),
      (${tenant}::uuid,${otherProperty}::uuid,${crypto.randomUUID()}::uuid,'linked',${`ORD689-OTHER-${run}`},'Needle hidden property','tentative'),
      (${foreignTenant}::uuid,${foreignProperty}::uuid,${crypto.randomUUID()}::uuid,'linked',${`ORD689-FOREIGN-${run}`},'Needle hidden tenant','tentative')`;
    const unfiltered = await database.withTenantTransaction(tenant, tx => service.list(tx,
      { tenantId: tenant, propertyNode: property, limit: 50, cursor: null }));
    expect(unfiltered.groups).toHaveLength(50);
    expect(unfiltered.nextCursor).not.toBeNull();
    expect(unfiltered.groups.some(group => group.groupId === target)).toBe(false);
    const found = await database.withTenantTransaction(tenant, tx => service.list(tx,
      { tenantId: tenant, propertyNode: property, limit: 50, cursor: null, query: "needle" }));
    expect(found.groups.map(group => group.groupId)).toEqual([target]);
    const literal = await database.withTenantTransaction(tenant, tx => service.list(tx,
      { tenantId: tenant, propertyNode: property, limit: 50, cursor: null, query: "%_" }));
    expect(literal.groups.map(group => group.groupId)).toEqual([target]);
    const byCode = await database.withTenantTransaction(tenant, tx => service.list(tx,
      { tenantId: tenant, propertyNode: property, limit: 50, cursor: null, query: "ord689-needle" }));
    expect(byCode.groups.map(group => group.groupId)).toEqual([target]);
    const denied = await database.withTenantTransaction(foreignTenant, tx => service.list(tx,
      { tenantId: foreignTenant, propertyNode: property, limit: 50, cursor: null, query: "needle" }));
    expect(denied.groups).toEqual([]);
  });

  test("attach is atomic with fact/outbox, replay and status/property guards; inventory and finance untouched", async () => {
    const created = await create("Members", `order687-${run}-members`);
    const groupId = created.group.groupId;
    const before = await admin<Array<{ occupancy: number; journals: number }>>`
      SELECT (SELECT count(*)::int FROM space_occupancy WHERE tenant_id=${tenant}::uuid) AS occupancy,
             (SELECT count(*)::int FROM journal WHERE tenant_id=${tenant}::uuid) AS journals`;
    const linked = await attach(groupId, reservation, `order687-${run}-attach`);
    expect(linked).toMatchObject({ groupId, reservationId: reservation, changed: true, replayed: false });
    expect((await attach(groupId, reservation, `order687-${run}-attach`)).replayed).toBe(true);
    await expect(attach(groupId, checkedIn, `order687-${run}-inhouse`)).rejects.toThrow(GroupReservationConflictError);
    await expect(attach(groupId, otherReservation, `order687-${run}-other`)).rejects.toThrow(GroupReservationNotFoundError);
    await expect(attach(groupId, foreignReservation, `order687-${run}-foreign`)).rejects.toThrow(GroupReservationNotFoundError);
    await expect(attach(groupId, reservation, `order687-${run}-repeat`)).rejects.toThrow(GroupReservationConflictError);
    const details = await database.withTenantTransaction(tenant, tx => service.detail(tx,
      { tenantId: tenant, propertyNode: property, groupId, memberLimit: 50, memberCursor: null }));
    expect(details.group.memberCount).toBe(1);
    expect(details.members[0]).toMatchObject({ reservationId: reservation, guestName: "Test Guest" });
    const candidate = await database.withTenantTransaction(tenant, tx => service.candidate(tx,
      { tenantId: tenant, propertyNode: property, groupId, confirmationNo: `G-${run}-2` }));
    expect(candidate).toMatchObject({ reservationId: secondReservation, currentGroupId: null, status: "due_in" });
    const after = await admin<Array<{ occupancy: number; journals: number }>>`
      SELECT (SELECT count(*)::int FROM space_occupancy WHERE tenant_id=${tenant}::uuid) AS occupancy,
             (SELECT count(*)::int FROM journal WHERE tenant_id=${tenant}::uuid) AS journals`;
    expect(after).toEqual(before);
    const evidence = await admin<Array<{ facts: number; events: number }>>`
      SELECT (SELECT count(*)::int FROM fact_log WHERE tenant_id=${tenant}::uuid AND entity_id=${reservation}::uuid
        AND fact_type='reservation.group_linked') AS facts,
        (SELECT count(*)::int FROM outbox WHERE tenant_id=${tenant}::uuid AND aggregate_id=${reservation}::uuid
        AND event_type='reservation.group_linked') AS events`;
    expect(evidence[0]).toMatchObject({ facts: 1, events: 1 });
  });

  test("two concurrent links of one reservation admit exactly one group", async () => {
    const a = (await create("Conference A", `order687-${run}-concurrent-a`)).group.groupId;
    const b = (await create("Conference B", `order687-${run}-concurrent-b`)).group.groupId;
    const results = await Promise.allSettled([
      attach(a, secondReservation, `order687-${run}-concurrent-link-a`),
      attach(b, secondReservation, `order687-${run}-concurrent-link-b`),
    ]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(result => result.status === "rejected")).toHaveLength(1);
    const row = await admin<Array<{ group_id: string }>>`
      SELECT group_id FROM reservation WHERE id=${secondReservation}::uuid AND tenant_id=${tenant}::uuid`;
    expect([a, b].includes(row[0]?.group_id ?? "")).toBe(true);
    const evidence = await admin<Array<{ facts: number; events: number }>>`
      SELECT (SELECT count(*)::int FROM fact_log WHERE entity_id=${secondReservation}::uuid AND fact_type='reservation.group_linked') AS facts,
             (SELECT count(*)::int FROM outbox WHERE aggregate_id=${secondReservation}::uuid AND event_type='reservation.group_linked') AS events`;
    expect(evidence[0]).toMatchObject({ facts: 1, events: 1 });
  });

  test("event failure rolls back group header, fact and idempotency claim", async () => {
    const broken = new GroupReservationService({ idempotency: new PostgresIdempotency(),
      events: { async publish() { throw new Error("injected outbox failure"); } } as never });
    const name = `Rollback ${run}`;
    await expect(runRuntime(tenant, tx => broken.create(tx, { name,
      idempotencyKey: `order687-${run}-rollback`, envelope: envelope() }))).rejects.toThrow("injected outbox failure");
    const rows = await admin<Array<{ groups: number; facts: number; claims: number }>>`
      SELECT (SELECT count(*)::int FROM reservation_group WHERE tenant_id=${tenant}::uuid AND name=${name}) AS groups,
             (SELECT count(*)::int FROM fact_log WHERE tenant_id=${tenant}::uuid AND fact_type='group.created'
               AND payload->>'name'=${name}) AS facts,
             (SELECT count(*)::int FROM api_idempotency WHERE tenant_id=${tenant}::uuid
               AND operation='group.create' AND response_status IS NULL) AS claims`;
    expect(rows[0]).toMatchObject({ groups: 0, facts: 0, claims: 0 });
  });

  test("runtime ACL and tenant RLS deny forbidden direct writes", async () => {
    await expect(runRuntime(tenant, tx => tx`
      UPDATE reservation SET currency='EUR' WHERE id=${checkedIn}::uuid
    `)).rejects.toThrow();
    await expect(runRuntime(tenant, tx => tx`
      INSERT INTO reservation_group(tenant_id,property_node,kind,code,name,status)
      VALUES (${foreignTenant}::uuid,${foreignProperty}::uuid,'linked',${`G-${run}-foreign-direct`},'Foreign','tentative')
    `)).rejects.toThrow();
    const foreign = await admin<Array<{ count: number }>>`
      SELECT count(*)::int AS count FROM reservation_group WHERE tenant_id=${foreignTenant}::uuid
        AND code=${`G-${run}-foreign-direct`}`;
    expect(foreign[0]?.count).toBe(0);
  });

  test("candidate read fails closed on cross-property stored group reference", async () => {
    const main = (await create("Coherent main", `order687-${run}-coherent-main`)).group.groupId;
    const wrong = (await create("Wrong property", `order687-${run}-coherent-other`, otherProperty)).group.groupId;
    try {
      await admin`UPDATE reservation SET group_id=${wrong}::uuid WHERE id=${hostileReservation}::uuid`;
      await expect(runRuntime(tenant, tx => service.candidate(tx, {
        tenantId: tenant, propertyNode: property, groupId: main, confirmationNo: `G-${run}-6`,
      }))).rejects.toThrow(GroupReservationConflictError);
    } finally {
      await admin`UPDATE reservation SET group_id=NULL WHERE id=${hostileReservation}::uuid`;
    }
  });
});
