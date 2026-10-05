import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import { createApp } from "../src/app";
import { BearerTenantResolver, Hs256TokenSigner, LocalLoginService } from "../src/contexts/identity";
import {
  AvailabilityService,
  HoldService,
  ReservationOccupancyService,
} from "../src/contexts/inventory";
import { ReservationCommitService } from "../src/contexts/reservations";
import { OperatorHttpApi } from "../src/http/operator";
import {
  createAuditEnvelope,
  Database,
  PostgresEventBus,
  PostgresIdempotency,
  type ConsumeBatchOptions,
  type ConsumeBatchResult,
  type EventBus,
  type EventHandler,
  type OutboxEvent,
  type PublishEventInput,
  type Tx,
} from "../src/kernel";

const DATABASE_URL = process.env.YELLOW_RESERVATION_COMMIT_HTTP_URL;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_RESERVATION_COMMIT_HTTP === "1";
const SECRET = "yellow-order-082-test-token-secret-exactly-long-enough";
const WRITE_SCOPE = "reservations.booking:write";

const TENANT_A = "00000000-0000-0000-0000-000000008201";
const TENANT_B = "00000000-0000-0000-0000-000000008202";
const PROPERTY_A = "00000000-0000-0000-0000-000000008211";
const PROPERTY_A2 = "00000000-0000-0000-0000-000000008212";
const PROPERTY_B = "00000000-0000-0000-0000-000000008213";
const ACTOR_A = "00000000-0000-0000-0000-000000008221";
const ACTOR_B = "00000000-0000-0000-0000-000000008222";
const ROLE_A = "00000000-0000-0000-0000-000000008223";
const PARTY_A = "00000000-0000-0000-0000-000000008231";
const PARTY_MERGED = "00000000-0000-0000-0000-000000008232";
const PARTY_B = "00000000-0000-0000-0000-000000008233";
const RATE_A = "00000000-0000-0000-0000-000000008241";
const RATE_INACTIVE = "00000000-0000-0000-0000-000000008242";
const RATE_A2 = "00000000-0000-0000-0000-000000008243";
const RATE_B = "00000000-0000-0000-0000-000000008244";
const UNIT_A = "00000000-0000-0000-0000-000000008251";
const UNIT_A2 = "00000000-0000-0000-0000-000000008252";
const UNIT_B = "00000000-0000-0000-0000-000000008253";
const SPACE_EXCLUSIVE = "00000000-0000-0000-0000-000000008261";
const SPACE_POSITIONAL = "00000000-0000-0000-0000-000000008262";
const SPACE_RETRY_TWICE = "00000000-0000-0000-0000-000000008263";
const SPACE_RETRY_ALWAYS = "00000000-0000-0000-0000-000000008264";
const SPACE_EXCLUSIVE_FAIL = "00000000-0000-0000-0000-000000008265";
const SPACE_COMPOSITE_A = "00000000-0000-0000-0000-000000008266";
const SPACE_COMPOSITE_B = "00000000-0000-0000-0000-000000008267";
const SPACE_A2 = "00000000-0000-0000-0000-000000008268";
const SPACE_B = "00000000-0000-0000-0000-000000008269";
const SELLABLE_EXCLUSIVE = "00000000-0000-0000-0000-000000008271";
const SELLABLE_POSITIONAL = "00000000-0000-0000-0000-000000008272";
const SELLABLE_RETRY_TWICE = "00000000-0000-0000-0000-000000008273";
const SELLABLE_RETRY_ALWAYS = "00000000-0000-0000-0000-000000008274";
const SELLABLE_EXCLUSIVE_FAIL = "00000000-0000-0000-0000-000000008275";
const SELLABLE_COMPOSITE = "00000000-0000-0000-0000-000000008276";
const SELLABLE_A2 = "00000000-0000-0000-0000-000000008277";
const SELLABLE_B = "00000000-0000-0000-0000-000000008278";

if (REQUIRE_DATABASE && !DATABASE_URL) {
  throw new Error("YELLOW_RESERVATION_COMMIT_HTTP_URL is required by the Order 082 proof");
}

const databaseDescribe = DATABASE_URL ? describe.serial : describe.skip;
let admin: SQL;
let loginPool: SQL;
let eventPool: SQL;
let database: Database;
let tokens: Hs256TokenSigner;
let events: PostgresEventBus;
let holds: HoldService;
let app: ReturnType<typeof createApp>;
let tokenA = "";
let tokenB = "";
let noScopeToken = "";

function headers(token: string, key?: string, correlationId = crypto.randomUUID()): Record<string, string> {
  return {
    "content-type": "application/json",
    authorization: `Bearer ${token}`,
    "x-correlation-id": correlationId,
    ...(key === undefined ? {} : { "idempotency-key": key }),
  };
}

function directBody(
  sellableUnitId: string,
  from: string,
  to: string,
  overrides: Readonly<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    propertyNode: PROPERTY_A,
    direct: { sellableUnitId, from, to },
    primaryPartyId: PARTY_A,
    ratePlanId: RATE_A,
    adults: 2,
    childAges: [6],
    channelCode: "direct",
    ...overrides,
  };
}

function stay(day: number): Readonly<{ from: string; to: string }> {
  return Object.freeze({
    from: new Date(Date.UTC(2048, 0, day, 15)).toISOString(),
    to: new Date(Date.UTC(2048, 0, day + 2, 11)).toISOString(),
  });
}

function request(
  body: unknown,
  key: string | undefined,
  token = tokenA,
  target = app,
  correlationId = crypto.randomUUID(),
): Promise<Response> {
  return target.handle(new Request("http://yellow.test/api/v1/reservations:commit", {
    method: "POST",
    headers: headers(token, key, correlationId),
    body: JSON.stringify(body),
  }));
}

function makeApp(bus: EventBus = events): ReturnType<typeof createApp> {
  const holdService = new HoldService(bus);
  const reservationService = new ReservationCommitService({
    holds: holdService,
    occupancy: new ReservationOccupancyService(bus),
    events: bus,
    idempotency: new PostgresIdempotency(),
  });
  const operator = new OperatorHttpApi(
    new LocalLoginService(loginPool, tokens),
    new AvailabilityService(),
    undefined,
    new PostgresIdempotency(),
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    holdService,
    undefined,
    undefined,
    undefined,
    reservationService,
  );
  return createApp({ database, tenantResolver: new BearerTenantResolver(tokens), operatorApi: operator });
}

class FailAtEventBus implements EventBus {
  calls = 0;
  constructor(readonly delegate: EventBus, readonly failAt: number) {}
  async publish(tx: Tx, event: PublishEventInput): Promise<OutboxEvent> {
    this.calls += 1;
    if (this.calls === this.failAt) throw new Error(`order082 injected publication failure ${this.failAt}`);
    return this.delegate.publish(tx, event);
  }
  consumeBatch(consumer: string, handler: EventHandler, options?: ConsumeBatchOptions): Promise<ConsumeBatchResult> {
    return this.delegate.consumeBatch(consumer, handler, options);
  }
}

async function artifactCounts(from: string, to: string) {
  const rows = await admin<Array<{
    reservations: number;
    segments: number;
    guests: number;
    occupancies: number;
    facts: number;
    events: number;
    claims: number;
    incomplete: number;
  }>>`
    SELECT
      (SELECT count(*)::int FROM reservation_segment
        WHERE period = tstzrange(${from}::timestamptz, ${to}::timestamptz, '[)')) AS segments,
      (SELECT count(*)::int FROM reservation WHERE id IN (
        SELECT reservation_id FROM reservation_segment
        WHERE period = tstzrange(${from}::timestamptz, ${to}::timestamptz, '[)'))) AS reservations,
      (SELECT count(*)::int FROM reservation_guest WHERE reservation_id IN (
        SELECT reservation_id FROM reservation_segment
        WHERE period = tstzrange(${from}::timestamptz, ${to}::timestamptz, '[)'))) AS guests,
      (SELECT count(*)::int FROM space_occupancy
        WHERE slot_kind='segment' AND period = tstzrange(${from}::timestamptz, ${to}::timestamptz, '[)')) AS occupancies,
      (SELECT count(*)::int FROM fact_log WHERE entity_id IN (
        SELECT reservation_id FROM reservation_segment
        WHERE period = tstzrange(${from}::timestamptz, ${to}::timestamptz, '[)')
        UNION SELECT id FROM reservation_segment
        WHERE period = tstzrange(${from}::timestamptz, ${to}::timestamptz, '[)'))) AS facts,
      (SELECT count(*)::int FROM outbox WHERE aggregate_id IN (
        SELECT reservation_id FROM reservation_segment
        WHERE period = tstzrange(${from}::timestamptz, ${to}::timestamptz, '[)')
        UNION SELECT id FROM space_occupancy
        WHERE slot_kind='segment' AND period = tstzrange(${from}::timestamptz, ${to}::timestamptz, '[)'))) AS events,
      (SELECT count(*)::int FROM api_idempotency WHERE operation='reservation.commit'
        AND response_body->>'from'=${from}) AS claims,
      (SELECT count(*)::int FROM api_idempotency WHERE operation='reservation.commit'
        AND completed_at IS NULL) AS incomplete
  `;
  if (!rows[0]) throw new Error("PostgreSQL returned no artifact count");
  return rows[0];
}

beforeAll(async () => {
  if (!DATABASE_URL) return;
  admin = new SQL(DATABASE_URL, { max: 24 });
  loginPool = new SQL(DATABASE_URL, { max: 4 });
  eventPool = new SQL(DATABASE_URL, { max: 48 });
  database = Database.connect(DATABASE_URL, { maxConnections: 72 });
  tokens = new Hs256TokenSigner(SECRET);
  events = new PostgresEventBus(eventPool);
  holds = new HoldService(events);

  await admin`
    INSERT INTO tenant (id, slug, name, tier, status) VALUES
      (${TENANT_A}::uuid, 'order082-a', 'Order 082 A', 'shared', 'active'),
      (${TENANT_B}::uuid, 'order082-b', 'Order 082 B', 'shared', 'active')
  `;
  await admin`
    INSERT INTO org_node (id, tenant_id, path, kind, name, timezone, currency) VALUES
      (${PROPERTY_A}::uuid, ${TENANT_A}::uuid, 'order082_a', 'property', 'Order 082 A', 'UTC', 'USD'),
      (${PROPERTY_A2}::uuid, ${TENANT_A}::uuid, 'order082_a2', 'property', 'Order 082 A2', 'UTC', 'USD'),
      (${PROPERTY_B}::uuid, ${TENANT_B}::uuid, 'order082_b', 'property', 'Order 082 B', 'UTC', 'EUR')
  `;
  await admin`
    INSERT INTO app_user (id, tenant_id, email, display_name, auth, status) VALUES
      (${ACTOR_A}::uuid, ${TENANT_A}::uuid, 'order082-a@yellow.test', 'Order 082 A', '{}'::jsonb, 'active'),
      (${ACTOR_B}::uuid, ${TENANT_B}::uuid, 'order082-b@yellow.test', 'Order 082 B', '{}'::jsonb, 'active')
  `;
  await admin`INSERT INTO permission (code, description) VALUES (${WRITE_SCOPE}, 'Commit reservations')`;
  await admin`
    INSERT INTO role (id, tenant_id, name) VALUES (${ROLE_A}::uuid, ${TENANT_A}::uuid, 'Order 082 Booker')
  `;
  await admin`
    INSERT INTO role_permission (role_id, permission_code) VALUES (${ROLE_A}::uuid, ${WRITE_SCOPE})
  `;
  await admin`
    INSERT INTO user_role (tenant_id, user_id, role_id, scope_node)
    VALUES (${TENANT_A}::uuid, ${ACTOR_A}::uuid, ${ROLE_A}::uuid, ${PROPERTY_A}::uuid)
  `;
  await admin`
    INSERT INTO party (id, tenant_id, kind, display_name, status, merged_into) VALUES
      (${PARTY_A}::uuid, ${TENANT_A}::uuid, 'person', 'Order 082 Primary', 'active', NULL),
      (${PARTY_MERGED}::uuid, ${TENANT_A}::uuid, 'person', 'Order 082 Merged', 'merged', ${PARTY_A}::uuid),
      (${PARTY_B}::uuid, ${TENANT_B}::uuid, 'person', 'Order 082 Foreign', 'active', NULL)
  `;
  await admin`
    INSERT INTO unit_type (id, tenant_id, property_node, code, name, profile_key) VALUES
      (${UNIT_A}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O82A', 'Order 082 A', 'hotel'),
      (${UNIT_A2}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A2}::uuid, 'O82A2', 'Order 082 A2', 'hotel'),
      (${UNIT_B}::uuid, ${TENANT_B}::uuid, ${PROPERTY_B}::uuid, 'O82B', 'Order 082 B', 'hotel')
  `;
  await admin`
    INSERT INTO space (id, tenant_id, property_node, code, profile_key, capacity) VALUES
      (${SPACE_EXCLUSIVE}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O82-EX', 'hotel', 1),
      (${SPACE_POSITIONAL}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O82-POS', 'hostel_dorm', 2),
      (${SPACE_RETRY_TWICE}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O82-RT', 'hostel_dorm', 3),
      (${SPACE_RETRY_ALWAYS}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O82-RA', 'hostel_dorm', 3),
      (${SPACE_EXCLUSIVE_FAIL}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O82-EF', 'hotel', 1),
      (${SPACE_COMPOSITE_A}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O82-CA', 'hotel', 1),
      (${SPACE_COMPOSITE_B}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O82-CB', 'hotel', 1),
      (${SPACE_A2}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A2}::uuid, 'O82-A2', 'hotel', 1),
      (${SPACE_B}::uuid, ${TENANT_B}::uuid, ${PROPERTY_B}::uuid, 'O82-B', 'hotel', 1)
  `;
  await admin`
    INSERT INTO sellable_unit (id, tenant_id, unit_type_id, name) VALUES
      (${SELLABLE_EXCLUSIVE}::uuid, ${TENANT_A}::uuid, ${UNIT_A}::uuid, 'Order 082 Exclusive'),
      (${SELLABLE_POSITIONAL}::uuid, ${TENANT_A}::uuid, ${UNIT_A}::uuid, 'Order 082 Positional'),
      (${SELLABLE_RETRY_TWICE}::uuid, ${TENANT_A}::uuid, ${UNIT_A}::uuid, 'Order 082 Retry Twice'),
      (${SELLABLE_RETRY_ALWAYS}::uuid, ${TENANT_A}::uuid, ${UNIT_A}::uuid, 'Order 082 Retry Always'),
      (${SELLABLE_EXCLUSIVE_FAIL}::uuid, ${TENANT_A}::uuid, ${UNIT_A}::uuid, 'Order 082 Exclusive Fail'),
      (${SELLABLE_COMPOSITE}::uuid, ${TENANT_A}::uuid, ${UNIT_A}::uuid, 'Order 082 Composite'),
      (${SELLABLE_A2}::uuid, ${TENANT_A}::uuid, ${UNIT_A2}::uuid, 'Order 082 A2'),
      (${SELLABLE_B}::uuid, ${TENANT_B}::uuid, ${UNIT_B}::uuid, 'Order 082 B')
  `;
  await admin`
    INSERT INTO sellable_unit_space (tenant_id, sellable_unit_id, space_id, claim_mode) VALUES
      (${TENANT_A}::uuid, ${SELLABLE_EXCLUSIVE}::uuid, ${SPACE_EXCLUSIVE}::uuid, 'exclusive'),
      (${TENANT_A}::uuid, ${SELLABLE_POSITIONAL}::uuid, ${SPACE_POSITIONAL}::uuid, 'positional'),
      (${TENANT_A}::uuid, ${SELLABLE_RETRY_TWICE}::uuid, ${SPACE_RETRY_TWICE}::uuid, 'positional'),
      (${TENANT_A}::uuid, ${SELLABLE_RETRY_ALWAYS}::uuid, ${SPACE_RETRY_ALWAYS}::uuid, 'positional'),
      (${TENANT_A}::uuid, ${SELLABLE_EXCLUSIVE_FAIL}::uuid, ${SPACE_EXCLUSIVE_FAIL}::uuid, 'exclusive'),
      (${TENANT_A}::uuid, ${SELLABLE_COMPOSITE}::uuid, ${SPACE_COMPOSITE_A}::uuid, 'exclusive'),
      (${TENANT_A}::uuid, ${SELLABLE_COMPOSITE}::uuid, ${SPACE_COMPOSITE_B}::uuid, 'exclusive'),
      (${TENANT_A}::uuid, ${SELLABLE_A2}::uuid, ${SPACE_A2}::uuid, 'exclusive'),
      (${TENANT_B}::uuid, ${SELLABLE_B}::uuid, ${SPACE_B}::uuid, 'exclusive')
  `;
  await admin`
    INSERT INTO rate_plan (id, tenant_id, property_node, code, name, currency, status) VALUES
      (${RATE_A}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O82A', 'Order 082 Active', 'USD', 'active'),
      (${RATE_INACTIVE}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O82I', 'Order 082 Inactive', 'USD', 'inactive'),
      (${RATE_A2}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A2}::uuid, 'O82A2', 'Order 082 A2', 'USD', 'active'),
      (${RATE_B}::uuid, ${TENANT_B}::uuid, ${PROPERTY_B}::uuid, 'O82B', 'Order 082 B', 'EUR', 'active')
  `;

  await admin.unsafe("CREATE SEQUENCE order082_retry_twice_seq");
  await admin.unsafe("CREATE SEQUENCE order082_retry_always_seq");
  await admin.unsafe("CREATE SEQUENCE order082_exclusive_fail_seq");
  await admin.unsafe(`
    CREATE FUNCTION order082_retry_probe() RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE n bigint;
    BEGIN
      IF NEW.space_id = '${SPACE_RETRY_TWICE}'::uuid THEN
        n := nextval('order082_retry_twice_seq');
        IF n <= 2 THEN RAISE EXCEPTION 'order082_retry_twice' USING ERRCODE='23P01'; END IF;
      ELSIF NEW.space_id = '${SPACE_RETRY_ALWAYS}'::uuid THEN
        PERFORM nextval('order082_retry_always_seq');
        RAISE EXCEPTION 'order082_retry_always' USING ERRCODE='23P01';
      ELSIF NEW.space_id = '${SPACE_EXCLUSIVE_FAIL}'::uuid THEN
        PERFORM nextval('order082_exclusive_fail_seq');
        RAISE EXCEPTION 'order082_exclusive_fail' USING ERRCODE='23P01';
      END IF;
      RETURN NEW;
    END $$
  `);
  await admin.unsafe(`
    CREATE TRIGGER order082_retry_probe BEFORE INSERT ON space_occupancy
    FOR EACH ROW EXECUTE FUNCTION order082_retry_probe()
  `);

  tokenA = await tokens.issue({ userId: ACTOR_A, tenantId: TENANT_A, scopes: [WRITE_SCOPE] });
  tokenB = await tokens.issue({ userId: ACTOR_B, tenantId: TENANT_B, scopes: [WRITE_SCOPE] });
  noScopeToken = await tokens.issue({ userId: ACTOR_A, tenantId: TENANT_A, scopes: [] });
  app = makeApp();
});

afterAll(async () => {
  if (!DATABASE_URL) return;
  await database.close();
  await eventPool.close();
  await loginPool.close();
  await admin.close();
}, 30_000);

databaseDescribe("Order 082 direct reservation commit HTTP", () => {
  test("P1: held/direct commit, exact replay and changed-key conflict share one endpoint", async () => {
    const heldStay = stay(1);
    const hold = await database.withTenantTransaction(TENANT_A, (tx) => holds.place(tx, {
      sellableUnitId: SELLABLE_COMPOSITE,
      from: new Date(heldStay.from),
      to: new Date(heldStay.to),
      ttlSeconds: 900,
      holder: { reference: "order082-held" },
      envelope: createAuditEnvelope({ actorId: ACTOR_A, tenantId: TENANT_A, propertyNode: PROPERTY_A,
        requestId: crypto.randomUUID(), operation: "hold.created" }),
    }));
    const heldBody = {
      propertyNode: PROPERTY_A,
      holdId: hold.id,
      primaryPartyId: PARTY_A,
      ratePlanId: RATE_A,
      adults: 2,
      childAges: [6],
      channelCode: "direct",
    };
    const held = await request(heldBody, "order082-held-commit");
    expect(held.status).toBe(201);
    expect(held.headers.get("idempotency-replayed")).toBe("false");
    const heldText = await held.text();
    expect(JSON.parse(heldText)).toEqual({ reservation: expect.objectContaining({ holdId: hold.id, status: "reserved" }) });
    const heldReplay = await request(heldBody, "order082-held-commit");
    expect(heldReplay.status).toBe(201);
    expect(heldReplay.headers.get("idempotency-replayed")).toBe("true");
    expect(await heldReplay.text()).toBe(heldText);

    const directStay = stay(5);
    const direct = directBody(SELLABLE_EXCLUSIVE, directStay.from, directStay.to);
    const created = await request(direct, "order082-direct-exact");
    expect(created.status).toBe(201);
    expect(created.headers.get("idempotency-replayed")).toBe("false");
    expect(created.headers.get("x-correlation-id")).toMatch(/^[0-9a-f-]{36}$/);
    const createdText = await created.text();
    expect(JSON.parse(createdText)).toEqual({ reservation: expect.objectContaining({
      sellableUnitId: SELLABLE_EXCLUSIVE,
      status: "reserved",
      from: directStay.from,
      to: directStay.to,
    }) });
    const replay = await request(direct, "order082-direct-exact");
    expect(replay.status).toBe(201);
    expect(replay.headers.get("idempotency-replayed")).toBe("true");
    expect(await replay.text()).toBe(createdText);

    const changed = await request({ ...direct, adults: 3 }, "order082-direct-exact");
    expect(changed.status).toBe(409);
    expect(await changed.json()).toEqual(expect.objectContaining({ type: "request/idempotency_conflict" }));
    const crossSource = await request(heldBody, "order082-direct-exact");
    expect(crossSource.status).toBe(409);

    expect((await request({ ...direct, surprise: true }, "order082-unknown")).status).toBe(400);
    expect((await request(direct, undefined)).status).toBe(400);
    expect(await artifactCounts(directStay.from, directStay.to)).toMatchObject({
      reservations: 1, segments: 1, guests: 1, occupancies: 1, claims: 1, incomplete: 0,
    });
  }, 30_000);

  test("P2: two last-unit HTTP commits produce exactly one durable winner", async () => {
    const raceStay = stay(20);
    const body = directBody(SELLABLE_EXCLUSIVE, raceStay.from, raceStay.to);
    const responses = await Promise.all([
      request(body, "order082-exclusive-race-a"),
      request(body, "order082-exclusive-race-b"),
    ]);
    expect(responses.map(({ status }) => status).sort()).toEqual([201, 409]);
    const loser = responses.find(({ status }) => status === 409);
    expect(await loser?.json()).toEqual(expect.objectContaining({ type: "conflict/occupancy" }));
    expect(await artifactCounts(raceStay.from, raceStay.to)).toMatchObject({
      reservations: 1, segments: 1, guests: 1, occupancies: 1, facts: 2, events: 2,
      claims: 1, incomplete: 0,
    });
  }, 30_000);

  test("P3: positional capacity and injected exclusion retries are exactly bounded", async () => {
    const capacityStay = stay(30);
    const capacityResponses = await Promise.all(Array.from({ length: 4 }, (_, index) =>
      request(directBody(SELLABLE_POSITIONAL, capacityStay.from, capacityStay.to), `order082-pos-${index}`)));
    expect(capacityResponses.filter(({ status }) => status === 201)).toHaveLength(2);
    expect(capacityResponses.filter(({ status }) => status === 409)).toHaveLength(2);
    const claims = await admin<Array<{ claim: string }>>`
      SELECT claim::text FROM space_occupancy WHERE space_id=${SPACE_POSITIONAL}::uuid
        AND period=tstzrange(${capacityStay.from}::timestamptz,${capacityStay.to}::timestamptz,'[)')
      ORDER BY claim
    `;
    expect(claims.map(({ claim }) => claim)).toEqual(["[0,1)", "[1,2)"]);

    const retryStay = stay(40);
    expect((await request(directBody(SELLABLE_RETRY_TWICE, retryStay.from, retryStay.to),
      "order082-retry-twice")).status).toBe(201);
    expect((await admin<Array<{ last_value: string }>>`SELECT last_value::text FROM order082_retry_twice_seq`)[0]?.last_value).toBe("3");

    const alwaysStay = stay(50);
    expect((await request(directBody(SELLABLE_RETRY_ALWAYS, alwaysStay.from, alwaysStay.to),
      "order082-retry-always")).status).toBe(409);
    expect((await admin<Array<{ last_value: string }>>`SELECT last_value::text FROM order082_retry_always_seq`)[0]?.last_value).toBe("3");
    expect(await artifactCounts(alwaysStay.from, alwaysStay.to)).toEqual({
      reservations: 0, segments: 0, guests: 0, occupancies: 0, facts: 0, events: 0, claims: 0, incomplete: 0,
    });

    const exclusiveStay = stay(60);
    expect((await request(directBody(SELLABLE_EXCLUSIVE_FAIL, exclusiveStay.from, exclusiveStay.to),
      "order082-exclusive-one-attempt")).status).toBe(409);
    expect((await admin<Array<{ last_value: string }>>`SELECT last_value::text FROM order082_exclusive_fail_seq`)[0]?.last_value).toBe("1");
  }, 30_000);

  test("P4: scope, property and server-owned references fail closed", async () => {
    const deniedStay = stay(70);
    const valid = directBody(SELLABLE_EXCLUSIVE, deniedStay.from, deniedStay.to);
    expect((await request(valid, "order082-no-scope", noScopeToken)).status).toBe(403);
    expect((await request(directBody(SELLABLE_A2, deniedStay.from, deniedStay.to, {
      propertyNode: PROPERTY_A2, ratePlanId: RATE_A2,
    }), "order082-no-property-grant")).status).toBe(403);
    expect((await request(valid, "order082-foreign-tenant", tokenB)).status).toBe(403);
    expect((await request(directBody("00000000-0000-0000-0000-000000008299", deniedStay.from, deniedStay.to),
      "order082-missing-sellable")).status).toBe(404);
    expect((await request(directBody(SELLABLE_EXCLUSIVE, deniedStay.from, deniedStay.to, {
      primaryPartyId: PARTY_MERGED,
    }), "order082-merged-party")).status).toBe(404);
    expect((await request(directBody(SELLABLE_EXCLUSIVE, deniedStay.from, deniedStay.to, {
      ratePlanId: RATE_INACTIVE,
    }), "order082-inactive-rate")).status).toBe(404);
    expect((await request(directBody(SELLABLE_B, deniedStay.from, deniedStay.to, {
      propertyNode: PROPERTY_B, primaryPartyId: PARTY_B, ratePlanId: RATE_B,
    }), "order082-foreign-property")).status).toBe(403);
    expect((await request({ ...valid, tenantId: TENANT_A }, "order082-body-tenant")).status).toBe(400);
    expect(await artifactCounts(deniedStay.from, deniedStay.to)).toEqual({
      reservations: 0, segments: 0, guests: 0, occupancies: 0, facts: 0, events: 0, claims: 0, incomplete: 0,
    });
  }, 30_000);

  test("P4: every new publication failure rolls back and same-key retry succeeds", async () => {
    for (let failAt = 1; failAt <= 3; failAt += 1) {
      const rollbackStay = stay(90 + (failAt * 3));
      const key = `order082-publisher-${failAt}`;
      const correlation = crypto.randomUUID();
      const failingBus = new FailAtEventBus(events, failAt);
      const failed = await request(directBody(SELLABLE_COMPOSITE, rollbackStay.from, rollbackStay.to),
        key, tokenA, makeApp(failingBus), correlation);
      expect(failed.status).toBe(503);
      expect(await failed.json()).toEqual(expect.objectContaining({
        type: "service/unavailable",
        detail: "Operator service is temporarily unavailable",
      }));
      expect(failingBus.calls).toBe(failAt);
      expect(await artifactCounts(rollbackStay.from, rollbackStay.to)).toEqual({
        reservations: 0, segments: 0, guests: 0, occupancies: 0, facts: 0, events: 0, claims: 0, incomplete: 0,
      });
      expect((await admin<Array<{ artifacts: number }>>`
        SELECT ((SELECT count(*) FROM fact_log WHERE payload @> ${JSON.stringify({ request_id: correlation })}::text::jsonb) +
          (SELECT count(*) FROM outbox WHERE correlation_id=${correlation}::uuid))::int AS artifacts
      `)[0]?.artifacts).toBe(0);
      expect((await request(directBody(SELLABLE_COMPOSITE, rollbackStay.from, rollbackStay.to), key)).status).toBe(201);
    }

    const reservationSource = await Bun.file(new URL("../src/contexts/reservations/commit.ts", import.meta.url)).text();
    const httpSource = await Bun.file(new URL("../src/http/operator.ts", import.meta.url)).text();
    expect(reservationSource).not.toMatch(/(?:INSERT|UPDATE|DELETE)\s+(?:INTO\s+|FROM\s+)?space_occupancy/i);
    expect(httpSource).not.toMatch(/record_occupancy|space_occupancy|sellable_unit_space/i);
  }, 30_000);
});

