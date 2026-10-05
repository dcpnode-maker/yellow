import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import {
  CheckInConflictError,
  CheckInNotFoundError,
  CheckInService,
  CheckInValidationError,
} from "../src/contexts/stay-operations";
import {
  createAuditEnvelope,
  Database,
  IdempotencyConflictError,
  PostgresEventBus,
  PostgresIdempotency,
  type EventBus,
} from "../src/kernel";

const DEPLOY_URL = process.env.YELLOW_DEPLOY_DATABASE_URL;
const RUNTIME_URL = process.env.YELLOW_STAY_CHECKIN_URL ?? process.env.YELLOW_RUNTIME_DATABASE_URL;
if (process.env.YELLOW_REQUIRE_STAY_CHECKIN === "1" && (!DEPLOY_URL || !RUNTIME_URL)) {
  throw new Error("YELLOW_DEPLOY_DATABASE_URL and YELLOW_STAY_CHECKIN_URL (or YELLOW_RUNTIME_DATABASE_URL) are required");
}
const databaseDescribe = DEPLOY_URL && RUNTIME_URL ? describe.serial : describe.skip;

const TENANT = "00000000-0000-0000-0000-000000020001";
const FOREIGN_TENANT = "00000000-0000-0000-0000-000000020002";
const PROPERTY = "00000000-0000-0000-0000-000000020011";
const GATED_PROPERTY = "00000000-0000-0000-0000-000000020012";
const FOREIGN_PROPERTY = "00000000-0000-0000-0000-000000020013";
const ACTOR = "00000000-0000-0000-0000-000000020021";
const OTHER_ACTOR = "00000000-0000-0000-0000-000000020022";
const FOREIGN_ACTOR = "00000000-0000-0000-0000-000000020023";
const PARTY = "00000000-0000-0000-0000-000000020031";
const GATED_PARTY = "00000000-0000-0000-0000-000000020032";
const MISSING_ID_PARTY = "00000000-0000-0000-0000-000000020033";
const FOREIGN_PARTY = "00000000-0000-0000-0000-000000020034";
const UNIT_TYPE = "00000000-0000-0000-0000-000000020041";
const GATED_UNIT_TYPE = "00000000-0000-0000-0000-000000020042";
const FOREIGN_UNIT_TYPE = "00000000-0000-0000-0000-000000020043";
const RATE_PLAN = "00000000-0000-0000-0000-000000020051";
const GATED_RATE_PLAN = "00000000-0000-0000-0000-000000020052";
const FOREIGN_RATE_PLAN = "00000000-0000-0000-0000-000000020053";
const CLEAN_SPACE = "00000000-0000-0000-0000-000000020061";
const DIRTY_SPACE = "00000000-0000-0000-0000-000000020062";
const GATED_SPACE = "00000000-0000-0000-0000-000000020063";
const MISSING_ID_SPACE = "00000000-0000-0000-0000-000000020064";
const FOREIGN_SPACE = "00000000-0000-0000-0000-000000020065";
const CLEAN_SELLABLE = "00000000-0000-0000-0000-000000020071";
const DIRTY_SELLABLE = "00000000-0000-0000-0000-000000020072";
const GATED_SELLABLE = "00000000-0000-0000-0000-000000020073";
const MISSING_ID_SELLABLE = "00000000-0000-0000-0000-000000020074";
const FOREIGN_SELLABLE = "00000000-0000-0000-0000-000000020075";
const CLEAN_RESERVATION = "00000000-0000-0000-0000-000000020081";
const DIRTY_RESERVATION = "00000000-0000-0000-0000-000000020082";
const GATED_RESERVATION = "00000000-0000-0000-0000-000000020083";
const MISSING_ID_RESERVATION = "00000000-0000-0000-0000-000000020084";
const NO_ASSIGNMENT_RESERVATION = "00000000-0000-0000-0000-000000020085";
const NO_FOLIO_RESERVATION = "00000000-0000-0000-0000-000000020086";
const WRONG_STATE_RESERVATION = "00000000-0000-0000-0000-000000020087";
const RACE_RESERVATION = "00000000-0000-0000-0000-000000020088";
const FOREIGN_RESERVATION = "00000000-0000-0000-0000-000000020089";
const ADAPTER_KEY = "order200-recorded-identity";

const boundaryService = new CheckInService({
  database: {
    withTenantTransaction: async () => { throw new Error("domain input reached database"); },
  } as unknown as Database,
  events: undefined as unknown as EventBus,
  idempotency: undefined as unknown as PostgresIdempotency,
});

function audit(
  reservationId: string,
  actorId = ACTOR,
  tenantId = TENANT,
  propertyNode = PROPERTY,
  requestId = crypto.randomUUID(),
) {
  void reservationId;
  return createAuditEnvelope({
    actorId, tenantId, propertyNode, requestId, operation: "reservation.checked_in",
  });
}

describe("Order 200 CheckInService input boundary", () => {
  test("accepts only exact server-owned authority and property-bound envelopes", async () => {
    await expect(boundaryService.getReadiness({
      tenantId: TENANT, propertyNode: PROPERTY, reservationId: CLEAN_RESERVATION,
      dirtyRoomOverrideAuthorized: false, ready: true,
    } as never)).rejects.toBeInstanceOf(CheckInValidationError);
    await expect(boundaryService.checkIn({
      tenantId: TENANT, propertyNode: PROPERTY, reservationId: CLEAN_RESERVATION,
      dirtyRoomOverrideAuthorized: "yes", idempotencyKey: "checkin-boundary-1",
      envelope: audit(CLEAN_RESERVATION),
    } as never)).rejects.toBeInstanceOf(CheckInValidationError);
    await expect(boundaryService.checkIn({
      tenantId: TENANT, propertyNode: PROPERTY, reservationId: CLEAN_RESERVATION,
      dirtyRoomOverrideAuthorized: false, idempotencyKey: "checkin-boundary-2",
      envelope: audit(CLEAN_RESERVATION, ACTOR, TENANT, GATED_PROPERTY),
    })).rejects.toBeInstanceOf(CheckInValidationError);
    await expect(boundaryService.checkIn({
      tenantId: TENANT, propertyNode: PROPERTY, reservationId: CLEAN_RESERVATION,
      dirtyRoomOverrideAuthorized: true, dirtyRoomOverrideReason: "unsafe\u200breason",
      idempotencyKey: "checkin-boundary-3", envelope: audit(CLEAN_RESERVATION),
    })).rejects.toBeInstanceOf(CheckInValidationError);
  });

  test("valid exact readiness reaches only the tenant database boundary", async () => {
    await expect(boundaryService.getReadiness({
      tenantId: TENANT, propertyNode: PROPERTY, reservationId: CLEAN_RESERVATION,
      dirtyRoomOverrideAuthorized: false,
    })).rejects.toThrow("domain input reached database");
  });
});

let deploy: SQL | undefined;
let runtime: SQL | undefined;
let eventPool: SQL | undefined;
let database: Database | undefined;
let checkIns: CheckInService | undefined;

const reservations = Object.freeze([
  { id: CLEAN_RESERVATION, property: PROPERTY, party: PARTY, status: "due_in", sellable: CLEAN_SELLABLE, rate: RATE_PLAN, segment: "00000000-0000-0000-0000-000000020101", folio: true },
  { id: DIRTY_RESERVATION, property: PROPERTY, party: PARTY, status: "due_in", sellable: DIRTY_SELLABLE, rate: RATE_PLAN, segment: "00000000-0000-0000-0000-000000020102", folio: true },
  { id: GATED_RESERVATION, property: GATED_PROPERTY, party: GATED_PARTY, status: "due_in", sellable: GATED_SELLABLE, rate: GATED_RATE_PLAN, segment: "00000000-0000-0000-0000-000000020103", folio: true },
  { id: MISSING_ID_RESERVATION, property: GATED_PROPERTY, party: MISSING_ID_PARTY, status: "due_in", sellable: MISSING_ID_SELLABLE, rate: GATED_RATE_PLAN, segment: "00000000-0000-0000-0000-000000020104", folio: true },
  { id: NO_ASSIGNMENT_RESERVATION, property: PROPERTY, party: PARTY, status: "due_in", sellable: null, rate: RATE_PLAN, segment: "00000000-0000-0000-0000-000000020105", folio: true },
  { id: NO_FOLIO_RESERVATION, property: PROPERTY, party: PARTY, status: "due_in", sellable: CLEAN_SELLABLE, rate: RATE_PLAN, segment: "00000000-0000-0000-0000-000000020106", folio: false },
  { id: WRONG_STATE_RESERVATION, property: PROPERTY, party: PARTY, status: "reserved", sellable: CLEAN_SELLABLE, rate: RATE_PLAN, segment: "00000000-0000-0000-0000-000000020107", folio: true },
  { id: RACE_RESERVATION, property: PROPERTY, party: PARTY, status: "due_in", sellable: CLEAN_SELLABLE, rate: RATE_PLAN, segment: "00000000-0000-0000-0000-000000020108", folio: true },
  { id: FOREIGN_RESERVATION, property: FOREIGN_PROPERTY, party: FOREIGN_PARTY, status: "due_in", sellable: FOREIGN_SELLABLE, rate: FOREIGN_RATE_PLAN, segment: "00000000-0000-0000-0000-000000020109", folio: true },
]);

async function cleanup(): Promise<void> {
  if (!deploy) return;
  for (const table of [
    "api_idempotency", "outbox", "fact_log", "identity_document", "folio", "account",
    "reservation_guest", "reservation_segment", "reservation", "unit_condition",
    "sellable_unit_space", "sellable_unit", "space", "rate_plan", "unit_type", "extension",
    "app_user", "party_role", "party", "org_node",
  ]) {
    await deploy.unsafe(`DELETE FROM ${table} WHERE tenant_id IN ($1::uuid,$2::uuid)`, [TENANT, FOREIGN_TENANT]);
  }
  await deploy`DELETE FROM tenant WHERE id IN (${TENANT}::uuid,${FOREIGN_TENANT}::uuid)`;
}

function command(
  reservationId: string,
  propertyNode = PROPERTY,
  actorId = ACTOR,
  tenantId = TENANT,
  key = `checkin-${reservationId}-${crypto.randomUUID()}`,
  override = false,
  reason?: string,
) {
  return Object.freeze({
    tenantId, propertyNode, reservationId,
    dirtyRoomOverrideAuthorized: override,
    ...(reason === undefined ? {} : { dirtyRoomOverrideReason: reason }),
    idempotencyKey: key,
    envelope: audit(reservationId, actorId, tenantId, propertyNode),
  });
}

async function snapshot(reservationId: string) {
  return (await deploy!<Array<{
    reservation_status: string; segment_status: string; facts: number; events: number;
    journals: number; postings: number; occupancy: number;
  }>>`
    SELECT reservation.status AS reservation_status, segment.status AS segment_status,
      (SELECT count(*)::int FROM fact_log WHERE tenant_id=reservation.tenant_id
        AND entity_type='reservation' AND entity_id=reservation.id AND fact_type='reservation.checked_in') AS facts,
      (SELECT count(*)::int FROM outbox WHERE tenant_id=reservation.tenant_id
        AND aggregate_type='reservation' AND aggregate_id=reservation.id AND event_type='reservation.checked_in') AS events,
      (SELECT count(*)::int FROM journal WHERE tenant_id=reservation.tenant_id) AS journals,
      (SELECT count(*)::int FROM posting_line WHERE tenant_id=reservation.tenant_id) AS postings,
      (SELECT count(*)::int FROM space_occupancy WHERE tenant_id=reservation.tenant_id) AS occupancy
    FROM reservation
    JOIN reservation_segment AS segment
      ON segment.tenant_id=reservation.tenant_id AND segment.reservation_id=reservation.id
    WHERE reservation.id=${reservationId}::uuid
  `)[0]!;
}

beforeAll(async () => {
  if (!DEPLOY_URL || !RUNTIME_URL) return;
  deploy = new SQL(DEPLOY_URL, { max: 8, prepare: false });
  runtime = new SQL(RUNTIME_URL, { max: 8, prepare: false });
  eventPool = new SQL(RUNTIME_URL, { max: 8, prepare: false });
  database = Database.connect(RUNTIME_URL, { maxConnections: 40, prepare: false });
  checkIns = new CheckInService({
    database,
    events: new PostgresEventBus(eventPool),
    idempotency: new PostgresIdempotency(),
  });
  await cleanup();

  await deploy`INSERT INTO tenant(id,slug,name,tier,status) VALUES
    (${TENANT}::uuid,'order200','Order 200','shared','active'),
    (${FOREIGN_TENANT}::uuid,'order200-foreign','Order 200 Foreign','shared','active')`;
  await deploy`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency,config) VALUES
    (${PROPERTY}::uuid,${TENANT}::uuid,'order200','property','Order 200 Hotel','UTC','USD','{}'),
    (${GATED_PROPERTY}::uuid,${TENANT}::uuid,'order200_gated','property','Order 200 Gated','UTC','USD',
      ${JSON.stringify({ statutory_adapter_key: ADAPTER_KEY })}::text::jsonb),
    (${FOREIGN_PROPERTY}::uuid,${FOREIGN_TENANT}::uuid,'order200_foreign','property','Foreign Hotel','UTC','USD','{}')`;
  await deploy`INSERT INTO app_user(id,tenant_id,email,display_name,status) VALUES
    (${ACTOR}::uuid,${TENANT}::uuid,'operator@order200.test','Order 200 Operator','active'),
    (${OTHER_ACTOR}::uuid,${TENANT}::uuid,'other@order200.test','Order 200 Other','active'),
    (${FOREIGN_ACTOR}::uuid,${FOREIGN_TENANT}::uuid,'foreign@order200.test','Foreign Operator','active')`;
  await deploy`INSERT INTO party(id,tenant_id,kind,display_name,status) VALUES
    (${PARTY}::uuid,${TENANT}::uuid,'person','Order 200 Guest','active'),
    (${GATED_PARTY}::uuid,${TENANT}::uuid,'person','Recorded Guest','active'),
    (${MISSING_ID_PARTY}::uuid,${TENANT}::uuid,'person','Undocumented Guest','active'),
    (${FOREIGN_PARTY}::uuid,${FOREIGN_TENANT}::uuid,'person','Foreign Guest','active')`;
  await deploy`INSERT INTO party_role(tenant_id,party_id,role) VALUES
    (${TENANT}::uuid,${PARTY}::uuid,'guest'),
    (${TENANT}::uuid,${GATED_PARTY}::uuid,'guest'),
    (${TENANT}::uuid,${MISSING_ID_PARTY}::uuid,'guest'),
    (${FOREIGN_TENANT}::uuid,${FOREIGN_PARTY}::uuid,'guest')`;
  await deploy`INSERT INTO extension_type(type,json_schema) VALUES('statutory_adapter','{}')
    ON CONFLICT(type) DO NOTHING`;
  await deploy`INSERT INTO extension(tenant_id,type,key,version,effective,content,status) VALUES(
    ${TENANT}::uuid,'statutory_adapter',${ADAPTER_KEY},1,
    tstzrange('2020-01-01T00:00:00Z',NULL,'[)'),
    ${JSON.stringify({ country: "ZZ", adapter_key: "recorded", schedule: "on_checkin", required_identity_fields: ["identity_document"] })}::text::jsonb,
    'active')`;
  await deploy`INSERT INTO unit_type(id,tenant_id,property_node,code,name,profile_key) VALUES
    (${UNIT_TYPE}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'STD','Standard','hotel-room'),
    (${GATED_UNIT_TYPE}::uuid,${TENANT}::uuid,${GATED_PROPERTY}::uuid,'STD','Standard','hotel-room'),
    (${FOREIGN_UNIT_TYPE}::uuid,${FOREIGN_TENANT}::uuid,${FOREIGN_PROPERTY}::uuid,'STD','Standard','hotel-room')`;
  await deploy`INSERT INTO rate_plan(id,tenant_id,property_node,code,name,currency) VALUES
    (${RATE_PLAN}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'BAR','BAR','USD'),
    (${GATED_RATE_PLAN}::uuid,${TENANT}::uuid,${GATED_PROPERTY}::uuid,'BAR','BAR','USD'),
    (${FOREIGN_RATE_PLAN}::uuid,${FOREIGN_TENANT}::uuid,${FOREIGN_PROPERTY}::uuid,'BAR','BAR','USD')`;
  await deploy`INSERT INTO space(id,tenant_id,property_node,code,profile_key,status) VALUES
    (${CLEAN_SPACE}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'101','room','active'),
    (${DIRTY_SPACE}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'102','room','active'),
    (${GATED_SPACE}::uuid,${TENANT}::uuid,${GATED_PROPERTY}::uuid,'201','room','active'),
    (${MISSING_ID_SPACE}::uuid,${TENANT}::uuid,${GATED_PROPERTY}::uuid,'202','room','active'),
    (${FOREIGN_SPACE}::uuid,${FOREIGN_TENANT}::uuid,${FOREIGN_PROPERTY}::uuid,'301','room','active')`;
  await deploy`INSERT INTO sellable_unit(id,tenant_id,unit_type_id,name,status) VALUES
    (${CLEAN_SELLABLE}::uuid,${TENANT}::uuid,${UNIT_TYPE}::uuid,'101','active'),
    (${DIRTY_SELLABLE}::uuid,${TENANT}::uuid,${UNIT_TYPE}::uuid,'102','active'),
    (${GATED_SELLABLE}::uuid,${TENANT}::uuid,${GATED_UNIT_TYPE}::uuid,'201','active'),
    (${MISSING_ID_SELLABLE}::uuid,${TENANT}::uuid,${GATED_UNIT_TYPE}::uuid,'202','active'),
    (${FOREIGN_SELLABLE}::uuid,${FOREIGN_TENANT}::uuid,${FOREIGN_UNIT_TYPE}::uuid,'301','active')`;
  await deploy`INSERT INTO sellable_unit_space(tenant_id,sellable_unit_id,space_id,claim_mode) VALUES
    (${TENANT}::uuid,${CLEAN_SELLABLE}::uuid,${CLEAN_SPACE}::uuid,'exclusive'),
    (${TENANT}::uuid,${DIRTY_SELLABLE}::uuid,${DIRTY_SPACE}::uuid,'exclusive'),
    (${TENANT}::uuid,${GATED_SELLABLE}::uuid,${GATED_SPACE}::uuid,'exclusive'),
    (${TENANT}::uuid,${MISSING_ID_SELLABLE}::uuid,${MISSING_ID_SPACE}::uuid,'exclusive'),
    (${FOREIGN_TENANT}::uuid,${FOREIGN_SELLABLE}::uuid,${FOREIGN_SPACE}::uuid,'exclusive')`;
  await deploy`INSERT INTO unit_condition(tenant_id,space_id,condition,updated_by) VALUES
    (${TENANT}::uuid,${CLEAN_SPACE}::uuid,'inspected',${ACTOR}::uuid),
    (${TENANT}::uuid,${DIRTY_SPACE}::uuid,'dirty',${ACTOR}::uuid),
    (${TENANT}::uuid,${GATED_SPACE}::uuid,'clean',${ACTOR}::uuid),
    (${TENANT}::uuid,${MISSING_ID_SPACE}::uuid,'clean',${ACTOR}::uuid),
    (${FOREIGN_TENANT}::uuid,${FOREIGN_SPACE}::uuid,'clean',${FOREIGN_ACTOR}::uuid)`;
  await deploy`INSERT INTO identity_document(id,tenant_id,party_id,kind,number_enc,issuing_country,expiry) VALUES
    ('00000000-0000-0000-0000-000000020111'::uuid,${TENANT}::uuid,${GATED_PARTY}::uuid,
      'passport','ciphertext-never-returned','ZZ','2099-12-31')`;

  let index = 0;
  for (const row of reservations) {
    const tenant = row.property === FOREIGN_PROPERTY ? FOREIGN_TENANT : TENANT;
    await deploy`INSERT INTO reservation(id,tenant_id,property_node,confirmation_no,status,primary_party,channel_code,currency)
      VALUES(${row.id}::uuid,${tenant}::uuid,${row.property}::uuid,${`O200-${++index}`},${row.status},${row.party}::uuid,'direct','USD')`;
    const unitType = row.property === GATED_PROPERTY ? GATED_UNIT_TYPE : row.property === FOREIGN_PROPERTY ? FOREIGN_UNIT_TYPE : UNIT_TYPE;
    await deploy`INSERT INTO reservation_segment(id,tenant_id,reservation_id,seq,unit_type_id,sellable_unit_id,period,adults,children,rate_plan_id,status)
      VALUES(${row.segment}::uuid,${tenant}::uuid,${row.id}::uuid,1,${unitType}::uuid,${row.sellable}::uuid,
        tstzrange('2020-01-01T00:00:00Z','2100-01-01T00:00:00Z','[)'),1,'[]',${row.rate}::uuid,'booked')`;
    if (row.folio) {
      const accountId = `00000000-0000-0000-0000-${String(20120 + index).padStart(12, "0")}`;
      const folioId = `00000000-0000-0000-0000-${String(20140 + index).padStart(12, "0")}`;
      await deploy`INSERT INTO account(id,tenant_id,property_node,role,party_id,name,currency,status)
        VALUES(${accountId}::uuid,${tenant}::uuid,${row.property}::uuid,'guest',${row.party}::uuid,${`O200 guest ${index}`} ,'USD','open')`;
      await deploy`INSERT INTO folio(id,tenant_id,account_id,reservation_id,folio_no,window_no,name,status)
        VALUES(${folioId}::uuid,${tenant}::uuid,${accountId}::uuid,${row.id}::uuid,${`O200-F-${index}`},1,'Primary','open')`;
    }
  }
});

afterAll(async () => {
  await cleanup();
  await database?.close();
  await eventPool?.close({ timeout: 0 });
  await runtime?.close({ timeout: 0 });
  await deploy?.close({ timeout: 0 });
});

databaseDescribe("Order 200 governed arrival readiness and check-in", () => {
  test("P1: exact clean due-in atomically becomes in-house with one fact/outbox and exact replay", async () => {
    const readiness = await checkIns!.getReadiness({
      tenantId: TENANT, propertyNode: PROPERTY, reservationId: CLEAN_RESERVATION,
      dirtyRoomOverrideAuthorized: false,
    });
    expect(readiness).toMatchObject({
      status: "due_in", roomCondition: "inspected", blockers: [], canCheckIn: true,
      identityGate: { required: false, satisfied: true, adapterKey: null },
    });
    expect(JSON.stringify(readiness)).not.toContain("ciphertext-never-returned");
    const key = "order200-clean-replay";
    const first = await checkIns!.checkIn(command(CLEAN_RESERVATION, PROPERTY, ACTOR, TENANT, key));
    const replay = await checkIns!.checkIn(command(CLEAN_RESERVATION, PROPERTY, ACTOR, TENANT, key));
    expect(first).toMatchObject({ reservationStatus: "in_house", segmentStatus: "in_house", replayed: false });
    expect(replay).toEqual({ ...first, replayed: true });
    expect(await snapshot(CLEAN_RESERVATION)).toEqual({
      reservation_status: "in_house", segment_status: "in_house", facts: 1, events: 1,
      journals: 0, postings: 0, occupancy: 0,
    });
  });

  test("P2: wrong state, assignment and primary-folio blockers write nothing", async () => {
    const cases = [
      [WRONG_STATE_RESERVATION, "reservation_not_due_in"],
      [NO_ASSIGNMENT_RESERVATION, "room_assignment_missing"],
      [NO_FOLIO_RESERVATION, "primary_folio_not_open"],
    ] as const;
    for (const [reservationId, blocker] of cases) {
      const readiness = await checkIns!.getReadiness({
        tenantId: TENANT, propertyNode: PROPERTY, reservationId,
        dirtyRoomOverrideAuthorized: false,
      });
      expect(readiness.canCheckIn).toBe(false);
      expect(readiness.blockers).toContain(blocker);
      await expect(checkIns!.checkIn(command(reservationId))).rejects.toBeInstanceOf(CheckInConflictError);
      const after = await snapshot(reservationId);
      expect({ facts: after.facts, events: after.events, journals: after.journals, postings: after.postings })
        .toEqual({ facts: 0, events: 0, journals: 0, postings: 0 });
    }
  });

  test("P3: dirty override needs server-derived authority and an attributable reason", async () => {
    const denied = await checkIns!.getReadiness({
      tenantId: TENANT, propertyNode: PROPERTY, reservationId: DIRTY_RESERVATION,
      dirtyRoomOverrideAuthorized: false,
    });
    expect(denied.blockers).toContain("dirty_room_override_unauthorized");
    const authorized = await checkIns!.getReadiness({
      tenantId: TENANT, propertyNode: PROPERTY, reservationId: DIRTY_RESERVATION,
      dirtyRoomOverrideAuthorized: true,
    });
    expect(authorized).toMatchObject({ canCheckIn: true, dirtyRoomOverrideRequired: true, blockers: [] });
    await expect(checkIns!.checkIn(command(DIRTY_RESERVATION, PROPERTY, ACTOR, TENANT, "dirty-no-reason", true)))
      .rejects.toBeInstanceOf(CheckInValidationError);
    const result = await checkIns!.checkIn(command(
      DIRTY_RESERVATION, PROPERTY, ACTOR, TENANT, "dirty-with-reason", true,
      "Guest accepted inspected dirty-room exception",
    ));
    expect(result.dirtyRoomOverrideUsed).toBe(true);
    const evidence = (await deploy!<Array<{ payload: Record<string, unknown> }>>`
      SELECT payload FROM fact_log WHERE entity_id=${DIRTY_RESERVATION}::uuid
        AND fact_type='reservation.checked_in'
    `)[0]!.payload;
    expect(evidence.dirty_room_override_reason).toBe("Guest accepted inspected dirty-room exception");
  });

  test("P2/P4: configured recorded-document gate is fail closed and returns no PII", async () => {
    const missing = await checkIns!.getReadiness({
      tenantId: TENANT, propertyNode: GATED_PROPERTY, reservationId: MISSING_ID_RESERVATION,
      dirtyRoomOverrideAuthorized: false,
    });
    expect(missing).toMatchObject({
      canCheckIn: false,
      identityGate: { required: true, satisfied: false, adapterKey: ADAPTER_KEY },
    });
    expect(missing.blockers).toContain("identity_document_missing");
    const ready = await checkIns!.getReadiness({
      tenantId: TENANT, propertyNode: GATED_PROPERTY, reservationId: GATED_RESERVATION,
      dirtyRoomOverrideAuthorized: false,
    });
    expect(ready).toMatchObject({ canCheckIn: true, identityGate: { required: true, satisfied: true } });
    expect(JSON.stringify(ready)).not.toMatch(/ciphertext|passport|number_enc|display_name/i);
    expect((await checkIns!.checkIn(command(GATED_RESERVATION, GATED_PROPERTY))).identityGate.required).toBe(true);
  });

  test("P4: foreign tenant/property/actor and raw runtime authority fail closed", async () => {
    await expect(checkIns!.getReadiness({
      tenantId: TENANT, propertyNode: GATED_PROPERTY, reservationId: RACE_RESERVATION,
      dirtyRoomOverrideAuthorized: false,
    })).rejects.toBeInstanceOf(CheckInNotFoundError);
    await expect(checkIns!.checkIn(command(RACE_RESERVATION, PROPERTY, FOREIGN_ACTOR)))
      .rejects.toBeInstanceOf(CheckInNotFoundError);
    await expect(checkIns!.checkIn(command(FOREIGN_RESERVATION, FOREIGN_PROPERTY, ACTOR, FOREIGN_TENANT)))
      .rejects.toBeInstanceOf(CheckInNotFoundError);
    try {
      await runtime!`UPDATE reservation SET status='in_house' WHERE id=${RACE_RESERVATION}::uuid`;
      throw new Error("yellow_runtime raw reservation update unexpectedly succeeded");
    } catch (error) {
      expect((error as { errno?: string }).errno).toBe("42501");
    }
    expect((await snapshot(RACE_RESERVATION)).reservation_status).toBe("due_in");
  });

  test("P5: actor-bound replay and twenty distinct contenders converge to one exact effect", async () => {
    const keys = Array.from({ length: 20 }, (_, index) => `order200-race-${String(index).padStart(2, "0")}`);
    const attempts = await Promise.allSettled(keys.map((key) =>
      checkIns!.checkIn(command(RACE_RESERVATION, PROPERTY, ACTOR, TENANT, key))
    ));
    expect(attempts.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(attempts.filter(({ status }) => status === "rejected")).toHaveLength(19);
    const winnerIndex = attempts.findIndex(({ status }) => status === "fulfilled");
    const winningKey = keys[winnerIndex]!;
    await expect(checkIns!.checkIn(command(RACE_RESERVATION, PROPERTY, OTHER_ACTOR, TENANT, winningKey)))
      .rejects.toBeInstanceOf(IdempotencyConflictError);
    expect(await snapshot(RACE_RESERVATION)).toEqual({
      reservation_status: "in_house", segment_status: "in_house", facts: 1, events: 1,
      journals: 0, postings: 0, occupancy: 0,
    });
  });
});
