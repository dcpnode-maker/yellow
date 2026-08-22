import { HoldConflictError, HoldService } from "../inventory";
import {
  createAuditEnvelope,
  recordFact,
  type AuditEnvelope,
  type EventBus,
  type JsonValue,
  type PostgresIdempotency,
  type Tx,
} from "../../kernel";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const CHANNEL = /^[a-z][a-z0-9._-]{0,63}$/;
const IDEMPOTENCY_KEY = /^[\x21-\x7e]{8,200}$/;

export interface CommitHeldReservationInput {
  readonly holdId: string;
  readonly primaryPartyId: string;
  readonly ratePlanId: string;
  readonly adults: number;
  readonly childAges: readonly number[];
  readonly channelCode: string;
  readonly idempotencyKey: string;
  readonly envelope: AuditEnvelope;
}

export interface HeldReservationCommit {
  readonly reservationId: string;
  readonly confirmationNo: string;
  readonly segmentId: string;
  readonly holdId: string;
  readonly status: "reserved";
  readonly propertyNode: string;
  readonly primaryPartyId: string;
  readonly sellableUnitId: string;
  readonly unitTypeId: string;
  readonly ratePlanId: string;
  readonly from: string;
  readonly to: string;
  readonly adults: number;
  readonly childAges: readonly number[];
  readonly channelCode: string;
  readonly currency: string;
  readonly guaranteePolicyId: string | null;
  readonly claimCount: number;
}

export interface CommitHeldReservationResult extends HeldReservationCommit {
  readonly replayed: boolean;
}

export interface ReservationCommitServiceOptions {
  readonly holds: HoldService;
  readonly events: EventBus;
  readonly idempotency: PostgresIdempotency;
  readonly idFactory?: () => string;
}

interface RatePlanRow {
  readonly id: string;
  readonly currency: string;
  readonly guarantee_policy: string | null;
  readonly market_code: string | null;
  readonly source_code: string | null;
}

export class ReservationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReservationValidationError";
  }
}

export class ReservationNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReservationNotFoundError";
  }
}

export class ReservationConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReservationConflictError";
  }
}

function requireUuid(name: string, value: unknown): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new ReservationValidationError(`${name} must be a UUID`);
  }
  return value;
}

function normalizeInput(input: CommitHeldReservationInput): Readonly<{
  holdId: string;
  primaryPartyId: string;
  ratePlanId: string;
  adults: number;
  childAges: readonly number[];
  channelCode: string;
  idempotencyKey: string;
}> {
  if (input.envelope.operation !== "reservation.confirmed") {
    throw new ReservationValidationError("audit operation must be reservation.confirmed");
  }
  if (!Number.isSafeInteger(input.adults) || input.adults < 1 || input.adults > 99) {
    throw new ReservationValidationError("adults must be an integer from 1 to 99");
  }
  if (!Array.isArray(input.childAges) || input.childAges.length > 30 ||
      input.childAges.some((age) => !Number.isSafeInteger(age) || age < 0 || age > 17)) {
    throw new ReservationValidationError("childAges must contain at most 30 integer ages from 0 to 17");
  }
  if (typeof input.channelCode !== "string" || !CHANNEL.test(input.channelCode)) {
    throw new ReservationValidationError("channelCode must be a canonical lowercase code");
  }
  if (typeof input.idempotencyKey !== "string" || !IDEMPOTENCY_KEY.test(input.idempotencyKey)) {
    throw new ReservationValidationError("idempotencyKey must contain 8-200 printable non-space characters");
  }
  return Object.freeze({
    holdId: requireUuid("holdId", input.holdId),
    primaryPartyId: requireUuid("primaryPartyId", input.primaryPartyId),
    ratePlanId: requireUuid("ratePlanId", input.ratePlanId),
    adults: input.adults,
    childAges: Object.freeze([...input.childAges]),
    channelCode: input.channelCode,
    idempotencyKey: input.idempotencyKey,
  });
}

function confirmationNumber(reservationId: string): string {
  return `Y-${reservationId.replaceAll("-", "").toUpperCase()}`;
}

function freezeResult(body: HeldReservationCommit, replayed: boolean): CommitHeldReservationResult {
  return Object.freeze({ ...body, childAges: Object.freeze([...body.childAges]), replayed });
}

export class ReservationCommitService {
  readonly #holds: HoldService;
  readonly #events: EventBus;
  readonly #idempotency: PostgresIdempotency;
  readonly #idFactory: () => string;

  constructor(options: ReservationCommitServiceOptions) {
    this.#holds = options.holds;
    this.#events = options.events;
    this.#idempotency = options.idempotency;
    this.#idFactory = options.idFactory ?? (() => crypto.randomUUID());
  }

  async commitHeld(tx: Tx, input: CommitHeldReservationInput): Promise<CommitHeldReservationResult> {
    const normalized = normalizeInput(input);
    const outcome = await this.#idempotency.execute(tx, {
      tenantId: input.envelope.tenantId,
      operation: "reservation.commit.held",
      key: normalized.idempotencyKey,
      request: {
        actorId: input.envelope.actorId,
        propertyNode: input.envelope.propertyNode,
        holdId: normalized.holdId,
        primaryPartyId: normalized.primaryPartyId,
        ratePlanId: normalized.ratePlanId,
        adults: normalized.adults,
        childAges: normalized.childAges,
        channelCode: normalized.channelCode,
      },
    }, async (commandTx) => {
      const parties = await commandTx<Array<{ id: string }>>`
        SELECT id FROM party
        WHERE id = ${normalized.primaryPartyId}::uuid
          AND tenant_id = ${input.envelope.tenantId}::uuid
          AND tenant_id = current_setting('app.tenant_id', true)::uuid
          AND status = 'active'
      `;
      if (!parties[0]) throw new ReservationNotFoundError("Active primary party was not found in the tenant");

      const plans = await commandTx<RatePlanRow[]>`
        SELECT rp.id, rp.currency, rp.guarantee_policy, rp.market_code, rp.source_code
        FROM rate_plan AS rp
        LEFT JOIN policy AS guarantee
          ON guarantee.id = rp.guarantee_policy
         AND guarantee.tenant_id = rp.tenant_id
         AND guarantee.kind = 'guarantee'
        WHERE rp.id = ${normalized.ratePlanId}::uuid
          AND rp.tenant_id = ${input.envelope.tenantId}::uuid
          AND rp.tenant_id = current_setting('app.tenant_id', true)::uuid
          AND rp.property_node = ${input.envelope.propertyNode}::uuid
          AND rp.status = 'active'
          AND (rp.guarantee_policy IS NULL OR guarantee.id IS NOT NULL)
      `;
      const plan = plans[0];
      if (!plan) throw new ReservationNotFoundError("Active rate plan was not found in the active property");

      const reservationId = requireUuid("generated reservation id", this.#idFactory());
      const segmentId = requireUuid("generated segment id", this.#idFactory());
      if (reservationId === segmentId) {
        throw new ReservationValidationError("generated reservation and segment ids must differ");
      }
      const holdEnvelope = createAuditEnvelope({
        actorId: input.envelope.actorId,
        tenantId: input.envelope.tenantId,
        propertyNode: input.envelope.propertyNode,
        requestId: input.envelope.requestId,
        operation: "hold.consumed",
      });
      let transfer;
      try {
        transfer = await this.#holds.consumeForSegment(commandTx, {
          holdId: normalized.holdId,
          segmentId,
          envelope: holdEnvelope,
        });
      } catch (error) {
        if (error instanceof HoldConflictError) {
          throw new ReservationConflictError("Held inventory is no longer available");
        }
        throw error;
      }

      const from = transfer.hold.from.toISOString();
      const to = transfer.hold.to.toISOString();
      const confirmationNo = confirmationNumber(reservationId);
      const insertedReservation = await commandTx<Array<{ id: string }>>`
        INSERT INTO reservation (
          id, tenant_id, property_node, confirmation_no, status, primary_party,
          channel_code, market_code, source_code, currency, guarantee_policy
        ) VALUES (
          ${reservationId}::uuid, ${input.envelope.tenantId}::uuid,
          ${input.envelope.propertyNode}::uuid, ${confirmationNo}, 'reserved',
          ${normalized.primaryPartyId}::uuid, ${normalized.channelCode}, ${plan.market_code},
          ${plan.source_code}, ${plan.currency}, ${plan.guarantee_policy}::uuid
        ) RETURNING id
      `;
      if (insertedReservation[0]?.id !== reservationId) {
        throw new Error("PostgreSQL did not return the created reservation");
      }
      const children = JSON.stringify(normalized.childAges.map((age) => ({ age })));
      const insertedSegment = await commandTx<Array<{ id: string }>>`
        INSERT INTO reservation_segment (
          id, tenant_id, reservation_id, seq, unit_type_id, sellable_unit_id,
          period, adults, children, rate_plan_id, status
        ) VALUES (
          ${segmentId}::uuid, ${input.envelope.tenantId}::uuid, ${reservationId}::uuid, 1,
          ${transfer.unitTypeId}::uuid, ${transfer.hold.sellableUnitId}::uuid,
          tstzrange(${from}::timestamptz, ${to}::timestamptz, '[)'),
          ${normalized.adults}, ${children}::text::jsonb, ${plan.id}::uuid, 'booked'
        ) RETURNING id
      `;
      if (insertedSegment[0]?.id !== segmentId) {
        throw new Error("PostgreSQL did not return the created reservation segment");
      }
      const primaryGuests = await commandTx<Array<{ reservation_id: string }>>`
        INSERT INTO reservation_guest (tenant_id, reservation_id, party_id, role, share_pct)
        VALUES (${input.envelope.tenantId}::uuid, ${reservationId}::uuid,
          ${normalized.primaryPartyId}::uuid, 'primary', NULL)
        RETURNING reservation_id
      `;
      if (primaryGuests[0]?.reservation_id !== reservationId) {
        throw new Error("PostgreSQL did not return the created primary reservation guest");
      }

      const fact = await recordFact(commandTx, {
        entityType: "reservation",
        entityId: reservationId,
        envelope: input.envelope,
        payload: {
          status: "reserved",
          source: "cart_hold",
          hold_id: normalized.holdId,
          segment_id: segmentId,
          primary_party_id: normalized.primaryPartyId,
          sellable_unit_id: transfer.hold.sellableUnitId,
          unit_type_id: transfer.unitTypeId,
          rate_plan_id: plan.id,
          period: { from, to },
          channel: normalized.channelCode,
        },
      });
      await this.#events.publish(commandTx, {
        tenantId: input.envelope.tenantId,
        propertyNode: input.envelope.propertyNode,
        businessDate: fact.businessDate,
        aggregateType: "reservation",
        aggregateId: reservationId,
        eventType: "reservation.confirmed",
        actorId: input.envelope.actorId,
        correlationId: input.envelope.requestId,
        payload: {
          reservation_id: reservationId,
          confirmation_no: confirmationNo,
          hold_id: normalized.holdId,
          segments: [{
            segment_id: segmentId,
            unit_type: transfer.unitTypeId,
            period: { from, to },
            rate_plan: plan.id,
          }],
          channel: normalized.channelCode,
        },
      });

      const body: HeldReservationCommit & JsonValue = Object.freeze({
        reservationId,
        confirmationNo,
        segmentId,
        holdId: normalized.holdId,
        status: "reserved",
        propertyNode: input.envelope.propertyNode,
        primaryPartyId: normalized.primaryPartyId,
        sellableUnitId: transfer.hold.sellableUnitId,
        unitTypeId: transfer.unitTypeId,
        ratePlanId: plan.id,
        from,
        to,
        adults: normalized.adults,
        childAges: normalized.childAges,
        channelCode: normalized.channelCode,
        currency: plan.currency,
        guaranteePolicyId: plan.guarantee_policy,
        claimCount: transfer.claimCount,
      });
      return { status: 201, body };
    });
    return freezeResult(outcome.body, outcome.replayed);
  }
}
