import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import {
  HoldService,
  InventoryConflictError,
  ReservationOccupancyService,
} from "../src/contexts/inventory";
import {
  freezeCancellationPolicyEvidence,
  ReservationApprovalRequiredError,
  ReservationCommitService,
  ReservationLifecycleConflictError,
  ReservationLifecycleNotFoundError,
  ReservationLifecycleService,
  ReservationLifecycleValidationError,
} from "../src/contexts/reservations";
import {
  ApprovalService,
  createAuditEnvelope,
  Database,
  IdempotencyConflictError,
  PostgresEventBus,
  PostgresIdempotency,
  type EventBus,
  type OutboxEvent,
  type PublishEventInput,
  type Tx,
} from "../src/kernel";

const DATABASE_URL = process.env.YELLOW_RESERVATION_LIFECYCLE_URL;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_RESERVATION_LIFECYCLE === "1";

const TENANT_A = "00000000-0000-0000-0000-000000008501";
const TENANT_B = "00000000-0000-0000-0000-000000008502";
const PROPERTY_A = "00000000-0000-0000-0000-000000008511";
const PROPERTY_A2 = "00000000-0000-0000-0000-000000008512";
const PROPERTY_B = "00000000-0000-0000-0000-000000008513";
const ACTOR_A = "00000000-0000-0000-0000-000000008521";
const ACTOR_B = "00000000-0000-0000-0000-000000008522";
const ACTOR_FOREIGN = "00000000-0000-0000-0000-000000008523";
const PARTY_A = "00000000-0000-0000-0000-000000008531";
const POLICY_ZERO = "00000000-0000-0000-0000-000000008541";
const POLICY_PENALTY = "00000000-0000-0000-0000-000000008542";
const POLICY_DRIFT = "00000000-0000-0000-0000-000000008543";
const RATE_NONE = "00000000-0000-0000-0000-000000008551";
const RATE_ZERO = "00000000-0000-0000-0000-000000008552";
const RATE_PENALTY = "00000000-0000-0000-0000-000000008553";
const RATE_DRIFT = "00000000-0000-0000-0000-000000008554";
const UNIT_TYPE = "00000000-0000-0000-0000-000000008561";
const SPACE_EXCLUSIVE = "00000000-0000-0000-0000-000000008571";
const SPACE_COMPOSITE_A = "00000000-0000-0000-0000-000000008572";
const SPACE_COMPOSITE_B = "00000000-0000-0000-0000-000000008573";
const SPACE_POSITIONAL = "00000000-0000-0000-0000-000000008574";
const SELLABLE_EXCLUSIVE = "00000000-0000-0000-0000-000000008581";
const SELLABLE_COMPOSITE = "00000000-0000-0000-0000-000000008582";
const SELLABLE_POSITIONAL = "00000000-0000-0000-0000-000000008583";
const FIXED_NOW = new Date("2034-12-30T00:00:00.000Z");
const ZERO_CONTENT = Object.freeze({
  kind: "cancellation",
  rules: Object.freeze([
    Object.freeze({ before_hours: 24, penalty: Object.freeze({ basis: "nights", value: 0 }) }),
    Object.freeze({ before_hours: 0, penalty: Object.freeze({ basis: "nights", value: 1 }) }),
  ]),
});

if (REQUIRE_DATABASE && !DATABASE_URL) {
  throw new Error("YELLOW_RESERVATION_LIFECYCLE_URL is required by the Order 085 proof");
}

const databaseDescribe = DATABASE_URL ? describe.serial : describe.skip;
let admin: SQL | undefined;
let eventPool: SQL | undefined;
let database: Database | undefined;
let events: PostgresEventBus | undefined;
let occupancy: ReservationOccupancyService | undefined;
let commits: ReservationCommitService | undefined;
let lifecycle: ReservationLifecycleService | undefined;
let approvals: ApprovalService | undefined;

function stay(offset: number): Readonly<{ from: Date; to: Date }> {
  const from = new Date(Date.UTC(2035, 0, 10 + offset * 3, 15));
  return Object.freeze({ from, to: new Date(from.getTime() + 2 * 24 * 60 * 60 * 1_000) });
}

function envelope(
  operation: string,
  actorId = ACTOR_A,
  tenantId = TENANT_A,
  propertyNode = PROPERTY_A,
  requestId = crypto.randomUUID(),
) {
  return createAuditEnvelope({ operation, actorId, tenantId, propertyNode, requestId });
}

function lifecycleFor(bus: EventBus): ReservationLifecycleService {
  return new ReservationLifecycleService({
    events: bus,
    occupancy: new ReservationOccupancyService(bus),
    idempotency: new PostgresIdempotency(),
    now: () => new Date(FIXED_NOW),
  });
}

async function createReservation(
  offset: number,
  ratePlanId = RATE_NONE,
  sellableUnitId = SELLABLE_EXCLUSIVE,
) {
  const period = stay(offset);
  return database!.withTenantTransaction(TENANT_A, (tx) => commits!.commitDirect(tx, {
    sellableUnitId,
    ...period,
    primaryPartyId: PARTY_A,
    ratePlanId,
    adults: 2,
    childAges: [7],
    channelCode: "direct",
    idempotencyKey: `order085-commit-${offset}-${crypto.randomUUID()}`,
    envelope: envelope("reservation.confirmed"),
  }));
}

async function modify(
  service: ReservationLifecycleService,
  input: Parameters<ReservationLifecycleService["modify"]>[1],
) {
  return database!.withTenantTransaction(input.envelope.tenantId, (tx) => service.modify(tx, input));
}

async function cancel(
  service: ReservationLifecycleService,
  input: Parameters<ReservationLifecycleService["cancel"]>[1],
) {
  return database!.withTenantTransaction(input.envelope.tenantId, (tx) => service.cancel(tx, input));
}

async function reinstate(
  service: ReservationLifecycleService,
  input: Parameters<ReservationLifecycleService["reinstate"]>[1],
) {
  return database!.withTenantTransaction(input.envelope.tenantId, (tx) => service.reinstate(tx, input));
}

async function requestWaiver(
  reservationId: string,
  payload: ReservationApprovalRequiredError["approvalPayload"],
  actorId = ACTOR_A,
) {
  return database!.withTenantTransaction(TENANT_A, (tx) => approvals!.request(tx, {
    kind: "reservation_cancellation_waiver",
    subjectType: "reservation",
    subjectId: reservationId,
    requestedBy: actorId,
    payload,
    envelope: envelope("approval.requested", actorId),
  }));
}

async function approve(approvalId: string, actorId = ACTOR_B) {
  return database!.withTenantTransaction(TENANT_A, (tx) => approvals!.decide(tx, {
    approvalId,
    decision: "approved",
    decidedBy: actorId,
    envelope: envelope("approval.decided", actorId),
  }));
}

async function snapshot(reservationId: string): Promise<unknown> {
  const rows = await admin!<Array<Record<string, unknown>>>`
    SELECT status, notes, eta::text, etd::text, market_code, source_code, origin_code,
           cancelled_at::text, cancel_reason, cancellation_no
    FROM reservation WHERE id = ${reservationId}::uuid
  `;
  const segments = await admin!<Array<Record<string, unknown>>>`
    SELECT id, seq, status, sellable_unit_id, period::text
    FROM reservation_segment WHERE reservation_id = ${reservationId}::uuid ORDER BY seq, id
  `;
  const claims = await admin!<Array<Record<string, unknown>>>`
    SELECT slot_ref, space_id, period::text, claim::text, exclusive
    FROM space_occupancy
    WHERE slot_ref IN (SELECT id FROM reservation_segment WHERE reservation_id = ${reservationId}::uuid)
    ORDER BY slot_ref, space_id, id
  `;
  const totals = await admin!<Array<Record<string, unknown>>>`
    SELECT
      (SELECT count(*)::int FROM fact_log) AS facts,
      (SELECT count(*)::int FROM outbox) AS events,
      (SELECT count(*)::int FROM api_idempotency) AS keys
  `;
  return JSON.parse(JSON.stringify({ rows, segments, claims, totals }));
}

async function failedArtifacts(requestId: string): Promise<Readonly<{ facts: number; events: number }>> {
  const rows = await admin!<Array<{ facts: number; events: number }>>`
    SELECT
      (SELECT count(*)::int FROM fact_log
        WHERE payload @> ${JSON.stringify({ request_id: requestId })}::text::jsonb) AS facts,
      (SELECT count(*)::int FROM outbox WHERE correlation_id = ${requestId}::uuid) AS events
  `;
  return rows[0] ?? { facts: -1, events: -1 };
}

class FailAtEventBus implements EventBus {
  calls = 0;

  constructor(readonly delegate: EventBus, readonly failAt: number) {}

  publish(tx: Tx, event: PublishEventInput): Promise<OutboxEvent> {
    this.calls += 1;
    if (this.calls === this.failAt) throw new Error(`Order 085 injected publication failure ${this.failAt}`);
    return this.delegate.publish(tx, event);
  }

  consumeBatch(...args: Parameters<EventBus["consumeBatch"]>): ReturnType<EventBus["consumeBatch"]> {
    return this.delegate.consumeBatch(...args);
  }
}

beforeAll(async () => {
  if (!DATABASE_URL) return;
  admin = new SQL(DATABASE_URL, { max: 16 });
  eventPool = new SQL(DATABASE_URL, { max: 32 });
  database = Database.connect(DATABASE_URL, { maxConnections: 64 });
  events = new PostgresEventBus(eventPool);
  occupancy = new ReservationOccupancyService(events);
  commits = new ReservationCommitService({
    holds: new HoldService(events),
    occupancy,
    events,
    idempotency: new PostgresIdempotency(),
  });
  lifecycle = lifecycleFor(events);
  approvals = new ApprovalService(events);

  await admin`
    INSERT INTO tenant (id, slug, name, tier, status)
    VALUES
      (${TENANT_A}::uuid, 'order085-a', 'Order 085 A', 'shared', 'active'),
      (${TENANT_B}::uuid, 'order085-b', 'Order 085 B', 'shared', 'active')
  `;
  await admin`
    INSERT INTO org_node (id, tenant_id, path, kind, name, timezone, currency)
    VALUES
      (${PROPERTY_A}::uuid, ${TENANT_A}::uuid, 'order085_a', 'property', 'Order 085 A', 'UTC', 'USD'),
      (${PROPERTY_A2}::uuid, ${TENANT_A}::uuid, 'order085_a2', 'property', 'Order 085 A2', 'UTC', 'USD'),
      (${PROPERTY_B}::uuid, ${TENANT_B}::uuid, 'order085_b', 'property', 'Order 085 B', 'UTC', 'EUR')
  `;
  await admin`
    INSERT INTO app_user (id, tenant_id, email, display_name)
    VALUES
      (${ACTOR_A}::uuid, ${TENANT_A}::uuid, 'order085-a@yellow.test', 'Order 085 Requester'),
      (${ACTOR_B}::uuid, ${TENANT_A}::uuid, 'order085-b@yellow.test', 'Order 085 Approver'),
      (${ACTOR_FOREIGN}::uuid, ${TENANT_B}::uuid, 'order085-foreign@yellow.test', 'Order 085 Foreign')
  `;
  await admin`
    INSERT INTO party (id, tenant_id, kind, display_name, status)
    VALUES (${PARTY_A}::uuid, ${TENANT_A}::uuid, 'person', 'Order 085 Guest', 'active')
  `;
  await admin`
    INSERT INTO policy (id, tenant_id, kind, name, content)
    VALUES
      (${POLICY_ZERO}::uuid, ${TENANT_A}::uuid, 'cancellation', 'Order 085 Zero', ${JSON.stringify(ZERO_CONTENT)}::text::jsonb),
      (${POLICY_DRIFT}::uuid, ${TENANT_A}::uuid, 'cancellation', 'Order 085 Drift', ${JSON.stringify(ZERO_CONTENT)}::text::jsonb),
      (${POLICY_PENALTY}::uuid, ${TENANT_A}::uuid, 'cancellation', 'Order 085 Penalty',
       '{"kind":"cancellation","rules":[{"before_hours":48,"penalty":{"basis":"nights","value":1}}]}'::jsonb)
  `;
  await admin`
    INSERT INTO rate_plan (id, tenant_id, property_node, code, name, currency, cancellation_policy, status)
    VALUES
      (${RATE_NONE}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O85NONE', 'Order 085 None', 'USD', NULL, 'active'),
      (${RATE_ZERO}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O85ZERO', 'Order 085 Zero', 'USD', ${POLICY_ZERO}::uuid, 'active'),
      (${RATE_PENALTY}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O85PEN', 'Order 085 Penalty', 'USD', ${POLICY_PENALTY}::uuid, 'active'),
      (${RATE_DRIFT}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O85DRIFT', 'Order 085 Drift', 'USD', ${POLICY_DRIFT}::uuid, 'active')
  `;
  await admin`
    INSERT INTO unit_type (id, tenant_id, property_node, code, name, profile_key)
    VALUES (${UNIT_TYPE}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O85', 'Order 085 Type', 'hotel')
  `;
  await admin`
    INSERT INTO space (id, tenant_id, property_node, code, profile_key, capacity)
    VALUES
      (${SPACE_EXCLUSIVE}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O85-EX', 'hotel', 1),
      (${SPACE_COMPOSITE_A}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O85-CA', 'hotel', 1),
      (${SPACE_COMPOSITE_B}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O85-CB', 'hotel', 1),
      (${SPACE_POSITIONAL}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O85-PO', 'hotel', 2)
  `;
  await admin`
    INSERT INTO sellable_unit (id, tenant_id, unit_type_id, name)
    VALUES
      (${SELLABLE_EXCLUSIVE}::uuid, ${TENANT_A}::uuid, ${UNIT_TYPE}::uuid, 'Order 085 Exclusive'),
      (${SELLABLE_COMPOSITE}::uuid, ${TENANT_A}::uuid, ${UNIT_TYPE}::uuid, 'Order 085 Composite'),
      (${SELLABLE_POSITIONAL}::uuid, ${TENANT_A}::uuid, ${UNIT_TYPE}::uuid, 'Order 085 Positional')
  `;
  await admin`
    INSERT INTO sellable_unit_space (tenant_id, sellable_unit_id, space_id, claim_mode)
    VALUES
      (${TENANT_A}::uuid, ${SELLABLE_EXCLUSIVE}::uuid, ${SPACE_EXCLUSIVE}::uuid, 'exclusive'),
      (${TENANT_A}::uuid, ${SELLABLE_COMPOSITE}::uuid, ${SPACE_COMPOSITE_A}::uuid, 'exclusive'),
      (${TENANT_A}::uuid, ${SELLABLE_COMPOSITE}::uuid, ${SPACE_COMPOSITE_B}::uuid, 'exclusive'),
      (${TENANT_A}::uuid, ${SELLABLE_POSITIONAL}::uuid, ${SPACE_POSITIONAL}::uuid, 'positional')
  `;
});

afterAll(async () => {
  await database?.close();
  await eventPool?.close();
  await admin?.close();
}, 30_000);

databaseDescribe("Order 085 reservation lifecycle commands", () => {
  test("P1: confirmation freezes policy and modify records one exact replayable diff", async () => {
    const drift = await createReservation(0, RATE_DRIFT);
    const expectedEvidence = freezeCancellationPolicyEvidence(POLICY_DRIFT, ZERO_CONTENT);
    const facts = await admin!<Array<{ payload: Record<string, unknown> }>>`
      SELECT payload FROM fact_log
      WHERE entity_type = 'reservation' AND entity_id = ${drift.reservationId}::uuid
        AND fact_type = 'reservation.confirmed'
    `;
    expect(facts[0]?.payload.cancellation_policy).toEqual({
      policy_id: POLICY_DRIFT,
      content: ZERO_CONTENT,
      content_hash: expectedEvidence.contentHash,
    });
    await admin!`
      UPDATE policy SET content = '{"kind":"cancellation","rules":[{"before_hours":0,"penalty":{"basis":"percent","value":100}}]}'::jsonb
      WHERE id = ${POLICY_DRIFT}::uuid
    `;
    const driftCancelled = await cancel(lifecycle!, {
      reservationId: drift.reservationId,
      reason: "Frozen policy remains authoritative",
      idempotencyKey: "order085-drift-cancel",
      envelope: envelope("reservation.cancelled"),
    });
    expect(driftCancelled.policyDecision).toMatchObject({
      evidence: "frozen_policy",
      content_hash: expectedEvidence.contentHash,
      rule_before_hours: 24,
      penalty: { basis: "nights", value: 0 },
    });

    const created = await createReservation(2);
    const input = {
      reservationId: created.reservationId,
      expected: { notes: null, eta: null, etd: null, marketCode: null, sourceCode: null, originCode: null },
      changes: {
        notes: "Airport pickup requested",
        eta: "18:30:00+05:30",
        etd: "10:00:00Z",
        marketCode: "LEISURE",
        sourceCode: "DIRECT",
        originCode: "AI_CONCIERGE",
      },
      idempotencyKey: "order085-modify-exact",
      envelope: envelope("reservation.modified"),
    } as const;
    const modified = await modify(lifecycle!, input);
    expect(modified).toMatchObject({
      reservationId: created.reservationId,
      status: "reserved",
      replayed: false,
      diff: {
        notes: { before: null, after: "Airport pickup requested" },
        eta: { before: null, after: "18:30:00+05:30" },
        etd: { before: null, after: "10:00:00+00:00" },
      },
    });
    expect(await modify(lifecycle!, { ...input, envelope: envelope("reservation.modified") }))
      .toEqual({ ...modified, replayed: true });
    await expect(modify(lifecycle!, {
      ...input,
      changes: { ...input.changes, notes: "Changed key reuse" },
      envelope: envelope("reservation.modified"),
    })).rejects.toBeInstanceOf(IdempotencyConflictError);
    await expect(modify(lifecycle!, {
      ...input,
      expected: { notes: null },
      changes: { notes: "Stale write" },
      idempotencyKey: "order085-modify-stale",
      envelope: envelope("reservation.modified"),
    })).rejects.toBeInstanceOf(ReservationLifecycleConflictError);
    await expect(modify(lifecycle!, {
      ...input,
      expected: { notes: "Airport pickup requested" },
      changes: { notes: "Airport pickup requested" },
      idempotencyKey: "order085-modify-noop",
      envelope: envelope("reservation.modified"),
    })).rejects.toBeInstanceOf(ReservationLifecycleValidationError);
  }, 30_000);

  test("P2: free cancellation releases exact claims and fails closed across boundaries", async () => {
    const created = await createReservation(5, RATE_ZERO, SELLABLE_COMPOSITE);
    await admin!`UPDATE reservation SET status = 'due_in' WHERE id = ${created.reservationId}::uuid`;
    const input = {
      reservationId: created.reservationId,
      reason: "Guest cancelled outside penalty window",
      idempotencyKey: "order085-free-cancel",
      envelope: envelope("reservation.cancelled"),
    } as const;
    const cancelled = await cancel(lifecycle!, input);
    expect(cancelled).toMatchObject({
      previousStatus: "due_in",
      status: "cancelled",
      releasedClaimCount: 2,
      approvalId: null,
      penaltyJournalId: null,
      replayed: false,
    });
    expect(cancelled.cancellationNo).toBe(`C-${created.reservationId.replaceAll("-", "").toUpperCase()}`);
    expect(await cancel(lifecycle!, { ...input, envelope: envelope("reservation.cancelled") }))
      .toEqual({ ...cancelled, replayed: true });
    const rows = await admin!<Array<{ reservation_status: string; segment_status: string; claims: number }>>`
      SELECT reservation.status AS reservation_status, segment.status AS segment_status,
             (SELECT count(*)::int FROM space_occupancy WHERE slot_ref = segment.id) AS claims
      FROM reservation JOIN reservation_segment AS segment ON segment.reservation_id = reservation.id
      WHERE reservation.id = ${created.reservationId}::uuid
    `;
    expect(rows).toEqual([{ reservation_status: "cancelled", segment_status: "cancelled", claims: 0 }]);
    await expect(cancel(lifecycle!, {
      ...input,
      idempotencyKey: "order085-terminal-cancel",
      envelope: envelope("reservation.cancelled"),
    })).rejects.toBeInstanceOf(ReservationLifecycleConflictError);
    await expect(cancel(lifecycle!, {
      ...input,
      reservationId: crypto.randomUUID(),
      idempotencyKey: "order085-missing-cancel",
      envelope: envelope("reservation.cancelled", ACTOR_A, TENANT_A, PROPERTY_A2),
    })).rejects.toBeInstanceOf(ReservationLifecycleNotFoundError);
    await expect(cancel(lifecycle!, {
      ...input,
      reason: " untrimmed ",
      idempotencyKey: "order085-hostile-cancel",
      envelope: envelope("reservation.cancelled"),
    })).rejects.toBeInstanceOf(ReservationLifecycleValidationError);
  }, 30_000);

  test("P3: non-zero and legacy policy require an exactly bound different-operator waiver", async () => {
    const created = await createReservation(8, RATE_PENALTY);
    const base = {
      reservationId: created.reservationId,
      reason: "Manager-approved commercial waiver",
      idempotencyKey: "order085-penalty-cancel",
      envelope: envelope("reservation.cancelled"),
    } as const;
    let required: ReservationApprovalRequiredError | undefined;
    try {
      await cancel(lifecycle!, base);
    } catch (error) {
      if (error instanceof ReservationApprovalRequiredError) required = error;
      else throw error;
    }
    expect(required?.approvalPayload).toMatchObject({
      reservation_id: created.reservationId,
      reason: base.reason,
      waive_penalty: true,
      policy_decision: { evidence: "frozen_policy", penalty: { basis: "nights", value: 1 } },
    });
    if (!required) throw new Error("Penalty cancellation did not request approval");
    const pending = await requestWaiver(created.reservationId, required.approvalPayload);
    await expect(cancel(lifecycle!, { ...base, approvalId: pending.id }))
      .rejects.toBeInstanceOf(ReservationApprovalRequiredError);
    await approve(pending.id);
    await expect(cancel(lifecycle!, {
      ...base,
      reason: "Different reason",
      approvalId: pending.id,
      idempotencyKey: "order085-wrong-reason",
      envelope: envelope("reservation.cancelled"),
    })).rejects.toBeInstanceOf(ReservationApprovalRequiredError);
    const cancelled = await cancel(lifecycle!, { ...base, approvalId: pending.id });
    expect(cancelled).toMatchObject({
      status: "cancelled",
      approvalId: pending.id,
      penaltyJournalId: null,
      policyDecision: { evidence: "frozen_policy", penalty: { value: 1 } },
    });

    await reinstate(lifecycle!, {
      reservationId: created.reservationId,
      idempotencyKey: "order085-reinstate-waiver-replay",
      envelope: envelope("reservation.reinstated"),
    });
    await expect(cancel(lifecycle!, {
      ...base,
      approvalId: pending.id,
      idempotencyKey: "order085-reuse-consumed-waiver",
      envelope: envelope("reservation.cancelled"),
    })).rejects.toBeInstanceOf(ReservationApprovalRequiredError);

    const legacy = await createReservation(11);
    await admin!`
      INSERT INTO fact_log (
        tenant_id, entity_type, entity_id, fact_type, valid_from, business_date, actor_id, payload
      ) VALUES (
        ${TENANT_A}::uuid, 'reservation', ${legacy.reservationId}::uuid, 'reservation.confirmed',
        transaction_timestamp() + interval '1 second', DATE '2034-12-30', ${ACTOR_A}::uuid,
        ${JSON.stringify({ request_id: crypto.randomUUID(), legacy: true })}::text::jsonb
      )
    `;
    const legacyInput = {
      reservationId: legacy.reservationId,
      reason: "Explicit legacy policy waiver",
      idempotencyKey: "order085-legacy-cancel",
      envelope: envelope("reservation.cancelled"),
    } as const;
    let legacyRequired: ReservationApprovalRequiredError | undefined;
    try {
      await cancel(lifecycle!, legacyInput);
    } catch (error) {
      if (error instanceof ReservationApprovalRequiredError) legacyRequired = error;
      else throw error;
    }
    expect(legacyRequired?.approvalPayload.policy_decision).toMatchObject({ evidence: "legacy_unfrozen" });
    if (!legacyRequired) throw new Error("Legacy cancellation did not request approval");
    const legacyApproval = await requestWaiver(legacy.reservationId, legacyRequired.approvalPayload);
    await approve(legacyApproval.id);
    expect((await cancel(lifecycle!, { ...legacyInput, approvalId: legacyApproval.id })).approvalId)
      .toBe(legacyApproval.id);
  }, 30_000);

  test("P4: reinstate re-arbitrates, rolls back on a competitor and has one concurrent winner", async () => {
    const original = await createReservation(14);
    await cancel(lifecycle!, {
      reservationId: original.reservationId,
      reason: "Temporary cancellation",
      idempotencyKey: "order085-reinstate-setup",
      envelope: envelope("reservation.cancelled"),
    });
    const competitor = await createReservation(14);
    const reinstateInput = {
      reservationId: original.reservationId,
      idempotencyKey: "order085-reinstate-blocked",
      envelope: envelope("reservation.reinstated"),
    } as const;
    const before = await snapshot(original.reservationId);
    await expect(reinstate(lifecycle!, reinstateInput)).rejects.toBeInstanceOf(ReservationLifecycleConflictError);
    expect(await snapshot(original.reservationId)).toEqual(before);
    expect(await failedArtifacts(reinstateInput.envelope.requestId)).toEqual({ facts: 0, events: 0 });

    await cancel(lifecycle!, {
      reservationId: competitor.reservationId,
      reason: "Release competitor for reinstatement proof",
      idempotencyKey: "order085-competitor-release",
      envelope: envelope("reservation.cancelled"),
    });
    const reinstated = await reinstate(lifecycle!, {
      ...reinstateInput,
      idempotencyKey: "order085-reinstate-success",
      envelope: envelope("reservation.reinstated"),
    });
    expect(reinstated).toMatchObject({ status: "reserved", reclaimedClaimCount: 1, replayed: false });
    await cancel(lifecycle!, {
      reservationId: original.reservationId,
      reason: "Prepare concurrent reinstatement",
      idempotencyKey: "order085-reinstate-recancel",
      envelope: envelope("reservation.cancelled"),
    });
    const attempts = ["order085-reinstate-race-a", "order085-reinstate-race-b"].map((idempotencyKey) => ({
      reservationId: original.reservationId,
      idempotencyKey,
      envelope: envelope("reservation.reinstated"),
    }));
    const results = await Promise.allSettled(attempts.map((attempt) => reinstate(lifecycle!, attempt)));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    const winnerIndex = results.findIndex((result) => result.status === "fulfilled");
    const winner = results[winnerIndex];
    if (winner?.status !== "fulfilled") throw new Error("Concurrent reinstatement produced no winner");
    expect(await reinstate(lifecycle!, { ...attempts[winnerIndex]!, envelope: envelope("reservation.reinstated") }))
      .toEqual({ ...winner.value, replayed: true });
    const claims = await admin!<Array<{ count: number }>>`
      SELECT count(*)::int AS count FROM space_occupancy
      WHERE slot_ref = ${original.segmentId}::uuid AND slot_kind = 'segment'
    `;
    expect(claims).toEqual([{ count: 1 }]);

    const positional = await createReservation(17, RATE_NONE, SELLABLE_POSITIONAL);
    await expect(database!.withTenantTransaction(TENANT_A, (tx) => occupancy!.claimForSegment(tx, {
      sellableUnitId: SELLABLE_POSITIONAL,
      segmentId: positional.segmentId,
      ...stay(18),
      envelope: envelope("occupancy.recorded"),
    }))).rejects.toBeInstanceOf(InventoryConflictError);
    const positionalClaims = await admin!<Array<{ count: number }>>`
      SELECT count(*)::int AS count FROM space_occupancy WHERE slot_ref = ${positional.segmentId}::uuid
    `;
    expect(positionalClaims).toEqual([{ count: 1 }]);

    const racingSegmentId = crypto.randomUUID();
    const racingClaim = () => database!.withTenantTransaction(TENANT_A, (tx) => occupancy!.claimForSegment(tx, {
      sellableUnitId: SELLABLE_POSITIONAL,
      segmentId: racingSegmentId,
      ...stay(19),
      envelope: envelope("occupancy.recorded"),
    }));
    const racingResults = await Promise.allSettled([racingClaim(), racingClaim()]);
    expect(racingResults.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(racingResults.filter((result) => result.status === "rejected")).toHaveLength(1);
    const racingClaims = await admin!<Array<{ count: number }>>`
      SELECT count(*)::int AS count FROM space_occupancy WHERE slot_ref = ${racingSegmentId}::uuid
    `;
    expect(racingClaims).toEqual([{ count: 1 }]);
  }, 30_000);

  test("P5: publication failures roll modify, cancel and reinstate back before same-key retry", async () => {
    const modifiedTarget = await createReservation(20);
    const modifyRequestId = crypto.randomUUID();
    const modifyInput = {
      reservationId: modifiedTarget.reservationId,
      expected: { notes: null },
      changes: { notes: "Atomic modification" },
      idempotencyKey: "order085-modify-publish",
      envelope: envelope("reservation.modified", ACTOR_A, TENANT_A, PROPERTY_A, modifyRequestId),
    } as const;
    const modifyBefore = await snapshot(modifiedTarget.reservationId);
    await expect(modify(lifecycleFor(new FailAtEventBus(events!, 1)), modifyInput))
      .rejects.toThrow("Order 085 injected publication failure 1");
    expect(await snapshot(modifiedTarget.reservationId)).toEqual(modifyBefore);
    expect(await failedArtifacts(modifyRequestId)).toEqual({ facts: 0, events: 0 });
    expect((await modify(lifecycle!, modifyInput)).replayed).toBe(false);

    for (const failAt of [1, 2, 3]) {
      const target = await createReservation(22 + failAt, RATE_NONE, SELLABLE_COMPOSITE);
      const requestId = crypto.randomUUID();
      const input = {
        reservationId: target.reservationId,
        reason: `Atomic cancellation ${failAt}`,
        idempotencyKey: `order085-cancel-publish-${failAt}`,
        envelope: envelope("reservation.cancelled", ACTOR_A, TENANT_A, PROPERTY_A, requestId),
      } as const;
      const before = await snapshot(target.reservationId);
      await expect(cancel(lifecycleFor(new FailAtEventBus(events!, failAt)), input))
        .rejects.toThrow(`Order 085 injected publication failure ${failAt}`);
      expect(await snapshot(target.reservationId)).toEqual(before);
      expect(await failedArtifacts(requestId)).toEqual({ facts: 0, events: 0 });
      expect((await cancel(lifecycle!, input)).replayed).toBe(false);
    }

    for (const failAt of [1, 2, 3]) {
      const target = await createReservation(27 + failAt, RATE_NONE, SELLABLE_COMPOSITE);
      await cancel(lifecycle!, {
        reservationId: target.reservationId,
        reason: `Prepare atomic reinstatement ${failAt}`,
        idempotencyKey: `order085-reinstate-prepare-${failAt}`,
        envelope: envelope("reservation.cancelled"),
      });
      const requestId = crypto.randomUUID();
      const input = {
        reservationId: target.reservationId,
        idempotencyKey: `order085-reinstate-publish-${failAt}`,
        envelope: envelope("reservation.reinstated", ACTOR_A, TENANT_A, PROPERTY_A, requestId),
      } as const;
      const before = await snapshot(target.reservationId);
      await expect(reinstate(lifecycleFor(new FailAtEventBus(events!, failAt)), input))
        .rejects.toThrow(`Order 085 injected publication failure ${failAt}`);
      expect(await snapshot(target.reservationId)).toEqual(before);
      expect(await failedArtifacts(requestId)).toEqual({ facts: 0, events: 0 });
      expect((await reinstate(lifecycle!, input)).replayed).toBe(false);
    }
  }, 60_000);
});
