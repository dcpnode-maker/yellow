import {
  HoldConflictError,
  HoldService,
  InventoryConflictError,
  ReservationOccupancyService,
  type PreparedCartHoldForSegment,
  type PreparedReservationSegmentClaim,
} from "../inventory";
import {
  createAuditEnvelope,
  recordFact,
  type AuditEnvelope,
  type EventBus,
  type JsonValue,
  type PostgresIdempotency,
  type Tx,
} from "../../kernel";
import {
  freezeCancellationPolicyEvidence,
  toStoredCancellationPolicyEvidence,
} from "./policy-evidence";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const CURRENCY = /^[A-Z]{3}$/;
const CHANNEL = /^[a-z][a-z0-9._-]{0,63}$/;
const IDEMPOTENCY_KEY = /^[\x21-\x7e]{8,200}$/;
const MAX_STAY_MS = 366 * 24 * 60 * 60 * 1_000;
const TAX_RESERVATION_BOUND_EVENT = "tax.attribution_reservation_bound";
const TAX_RESERVATION_BINDING_ENTITY = "tax_attribution_reservation_binding";

interface CommitReservationCommonInput {
  readonly primaryPartyId: string;
  readonly ratePlanId: string;
  readonly adults: number;
  readonly childAges: readonly number[];
  readonly channelCode: string;
  readonly idempotencyKey: string;
  readonly envelope: AuditEnvelope;
}
export interface CommitHeldReservationInput extends CommitReservationCommonInput {
  readonly holdId: string;
}

export interface CommitDirectReservationInput extends CommitReservationCommonInput {
  readonly sellableUnitId: string;
  readonly from: Date;
  readonly to: Date;
}

interface ReservationCommitBase {
  readonly reservationId: string;
  readonly confirmationNo: string;
  readonly segmentId: string;
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

export interface HeldReservationCommit extends ReservationCommitBase {
  readonly source: "hold";
  readonly holdId: string;
}

export interface DirectReservationCommit extends ReservationCommitBase {
  readonly source: "direct";
}

export interface CommitHeldReservationResult extends HeldReservationCommit {
  readonly replayed: boolean;
}

export interface CommitDirectReservationResult extends DirectReservationCommit {
  readonly replayed: boolean;
}

export interface ReservationCommitServiceOptions {
  readonly holds: HoldService;
  readonly occupancy?: ReservationOccupancyService;
  readonly events: EventBus;
  readonly idempotency: PostgresIdempotency;
  readonly idFactory?: () => string;
}

interface RatePlanRow {
  readonly id: string;
  readonly currency: string;
  readonly cancellation_policy: string | null;
  readonly cancellation_content: Record<string, unknown> | null;
  readonly guarantee_policy: string | null;
  readonly market_code: string | null;
  readonly source_code: string | null;
}

interface NormalizedCommon {
  readonly primaryPartyId: string;
  readonly ratePlanId: string;
  readonly adults: number;
  readonly childAges: readonly number[];
  readonly channelCode: string;
  readonly idempotencyKey: string;
}

type NormalizedSource = Readonly<
  { kind: "hold"; holdId: string } |
  { kind: "direct"; sellableUnitId: string; from: Date; to: Date }
>;

interface AcquiredInventory {
  readonly source: "hold" | "direct";
  readonly holdId?: string;
  readonly sellableUnitId: string;
  readonly unitTypeId: string;
  readonly from: Date;
  readonly to: Date;
  readonly claimCount: number;
}

interface TaxReservationLineageRow {
  readonly lineage_id: string;
  readonly binding_id: string;
  readonly hold_id: string;
  readonly attribution_id: string;
  readonly reservation_id: string;
  readonly segment_id: string;
  readonly origin_quote_hash: string;
  readonly snapshot_hash: string;
  readonly currency: string;
  readonly linked_by: string;
  readonly linked_at: Date | string;
  readonly created: boolean;
}

type PreparedInventory = AcquiredInventory;

type CommitBody = HeldReservationCommit | DirectReservationCommit;
type CommitResult = CommitHeldReservationResult | CommitDirectReservationResult;

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

function normalizeCommon(input: CommitReservationCommonInput): NormalizedCommon {
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
    primaryPartyId: requireUuid("primaryPartyId", input.primaryPartyId),
    ratePlanId: requireUuid("ratePlanId", input.ratePlanId),
    adults: input.adults,
    childAges: Object.freeze([...input.childAges]),
    channelCode: input.channelCode,
    idempotencyKey: input.idempotencyKey,
  });
}

function normalizeDirectSource(input: CommitDirectReservationInput): NormalizedSource {
  const from = input.from;
  const to = input.to;
  if (!(from instanceof Date) || !(to instanceof Date) ||
      !Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) ||
      from >= to || to.getTime() - from.getTime() > MAX_STAY_MS) {
    throw new ReservationValidationError("direct stay must be a positive period of at most 366 days");
  }
  return Object.freeze({
    kind: "direct" as const,
    sellableUnitId: requireUuid("sellableUnitId", input.sellableUnitId),
    from: new Date(from),
    to: new Date(to),
  });
}

function confirmationNumber(reservationId: string): string {
  return `Y-${reservationId.replaceAll("-", "").toUpperCase()}`;
}

function freezeResult(body: CommitBody, replayed: boolean): CommitResult {
  return Object.freeze({ ...body, childAges: Object.freeze([...body.childAges]), replayed });
}

export class ReservationCommitService {
  readonly #holds: HoldService;
  readonly #occupancy: ReservationOccupancyService;
  readonly #events: EventBus;
  readonly #idempotency: PostgresIdempotency;
  readonly #idFactory: () => string;

  constructor(options: ReservationCommitServiceOptions) {
    this.#holds = options.holds;
    this.#occupancy = options.occupancy ?? new ReservationOccupancyService(options.events);
    this.#events = options.events;
    this.#idempotency = options.idempotency;
    this.#idFactory = options.idFactory ?? (() => crypto.randomUUID());
  }

  async commitHeld(tx: Tx, input: CommitHeldReservationInput): Promise<CommitHeldReservationResult> {
    const result = await this.#commit(tx, input, Object.freeze({
      kind: "hold" as const,
      holdId: requireUuid("holdId", input.holdId),
    }));
    if (result.source !== "hold") throw new Error("Held commit returned a direct result");
    return result;
  }

  async commitDirect(tx: Tx, input: CommitDirectReservationInput): Promise<CommitDirectReservationResult> {
    const result = await this.#commit(tx, input, normalizeDirectSource(input));
    if (result.source !== "direct") throw new Error("Direct commit returned a held result");
    return result;
  }

  async #commit(
    tx: Tx,
    input: CommitReservationCommonInput,
    source: NormalizedSource,
  ): Promise<CommitResult> {
    const normalized = normalizeCommon(input);
    const sourceRequest = source.kind === "hold"
      ? { kind: source.kind, holdId: source.holdId }
      : {
          kind: source.kind,
          sellableUnitId: source.sellableUnitId,
          from: source.from.toISOString(),
          to: source.to.toISOString(),
        };
    const outcome = await this.#idempotency.execute(tx, {
      tenantId: input.envelope.tenantId,
      operation: "reservation.commit",
      key: normalized.idempotencyKey,
      request: {
        actorId: input.envelope.actorId,
        propertyNode: input.envelope.propertyNode,
        source: sourceRequest,
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
        SELECT rp.id, rp.currency, rp.cancellation_policy,
               cancellation.content AS cancellation_content,
               rp.guarantee_policy, rp.market_code, rp.source_code
        FROM rate_plan AS rp
        LEFT JOIN policy AS cancellation
          ON cancellation.id = rp.cancellation_policy
         AND cancellation.tenant_id = rp.tenant_id
         AND cancellation.kind = 'cancellation'
        LEFT JOIN policy AS guarantee
          ON guarantee.id = rp.guarantee_policy
         AND guarantee.tenant_id = rp.tenant_id
         AND guarantee.kind = 'guarantee'
        WHERE rp.id = ${normalized.ratePlanId}::uuid
          AND rp.tenant_id = ${input.envelope.tenantId}::uuid
          AND rp.tenant_id = current_setting('app.tenant_id', true)::uuid
          AND rp.property_node = ${input.envelope.propertyNode}::uuid
          AND rp.status = 'active'
          AND (rp.cancellation_policy IS NULL OR cancellation.id IS NOT NULL)
          AND (rp.guarantee_policy IS NULL OR guarantee.id IS NOT NULL)
      `;
      const plan = plans[0];
      if (!plan) throw new ReservationNotFoundError("Active rate plan was not found in the active property");
      const cancellationPolicy = plan.cancellation_policy === null
        ? null
        : freezeCancellationPolicyEvidence(plan.cancellation_policy, plan.cancellation_content ?? {});

      const reservationId = requireUuid("generated reservation id", this.#idFactory());
      const segmentId = requireUuid("generated segment id", this.#idFactory());
      if (reservationId === segmentId) {
        throw new ReservationValidationError("generated reservation and segment ids must differ");
      }
      const prepared = await this.#prepare(commandTx, input.envelope, source);
      const from = prepared.from.toISOString();
      const to = prepared.to.toISOString();
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
          ${prepared.unitTypeId}::uuid, ${prepared.sellableUnitId}::uuid,
          tstzrange(${from}::timestamptz, ${to}::timestamptz, '[)'),
          ${normalized.adults}, ${children}::text::jsonb, ${plan.id}::uuid, 'booked'
        ) RETURNING id
      `;
      if (insertedSegment[0]?.id !== segmentId) {
        throw new Error("PostgreSQL did not return the created reservation segment");
      }
      const acquired = await this.#acquire(commandTx, input.envelope, source, segmentId);
      this.#assertAcquiredMatchesPreparation(prepared, acquired);
      if (acquired.source === "hold") {
        await this.#linkQuotedTaxReservationLineage(commandTx, input.envelope, {
          holdId: acquired.holdId!,
          reservationId,
          segmentId,
          currency: plan.currency,
        });
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
          source: acquired.source === "hold" ? "cart_hold" : "direct",
          ...(acquired.holdId === undefined ? {} : { hold_id: acquired.holdId }),
          segment_id: segmentId,
          primary_party_id: normalized.primaryPartyId,
          sellable_unit_id: acquired.sellableUnitId,
          unit_type_id: acquired.unitTypeId,
          rate_plan_id: plan.id,
          cancellation_policy: cancellationPolicy === null
            ? null
            : toStoredCancellationPolicyEvidence(cancellationPolicy),
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
          ...(acquired.holdId === undefined ? {} : { hold_id: acquired.holdId }),
          segments: [{
            segment_id: segmentId,
            unit_type: acquired.unitTypeId,
            period: { from, to },
            rate_plan: plan.id,
          }],
          channel: normalized.channelCode,
        },
      });

      const common = {
        reservationId,
        confirmationNo,
        segmentId,
        status: "reserved" as const,
        propertyNode: input.envelope.propertyNode,
        primaryPartyId: normalized.primaryPartyId,
        sellableUnitId: acquired.sellableUnitId,
        unitTypeId: acquired.unitTypeId,
        ratePlanId: plan.id,
        from,
        to,
        adults: normalized.adults,
        childAges: normalized.childAges,
        channelCode: normalized.channelCode,
        currency: plan.currency,
        guaranteePolicyId: plan.guarantee_policy,
        claimCount: acquired.claimCount,
      };
      const body: CommitBody & JsonValue = acquired.source === "hold"
        ? Object.freeze({ ...common, source: "hold" as const, holdId: acquired.holdId! })
        : Object.freeze({ ...common, source: "direct" as const });
      return { status: 201, body };
    });
    return freezeResult(outcome.body, outcome.replayed);
  }

  async #linkQuotedTaxReservationLineage(
    tx: Tx,
    envelope: AuditEnvelope,
    identities: Readonly<{
      holdId: string;
      reservationId: string;
      segmentId: string;
      currency: string;
    }>,
  ): Promise<void> {
    const rows = await tx<TaxReservationLineageRow[]>`
      SELECT lineage_id, binding_id, hold_id, attribution_id, reservation_id, segment_id,
             origin_quote_hash, snapshot_hash, currency::text, linked_by, linked_at, created
      FROM public.link_tax_attribution_reservation(
        ${envelope.tenantId}::uuid,
        ${envelope.propertyNode}::uuid,
        ${envelope.actorId}::uuid,
        ${identities.holdId}::uuid,
        ${identities.reservationId}::uuid,
        ${identities.segmentId}::uuid
      )
    `;
    if (rows.length === 0) return;
    const row = rows[0];
    if (rows.length !== 1 || !row ||
        !UUID.test(row.lineage_id) || !UUID.test(row.binding_id) ||
        !UUID.test(row.hold_id) || !UUID.test(row.attribution_id) ||
        !UUID.test(row.reservation_id) || !UUID.test(row.segment_id) ||
        !UUID.test(row.linked_by) || !SHA256.test(row.origin_quote_hash) ||
        !SHA256.test(row.snapshot_hash) || !CURRENCY.test(row.currency) ||
        typeof row.created !== "boolean") {
      throw new ReservationConflictError("Quoted-tax reservation lineage returned invalid evidence");
    }
    const linkedAt = row.linked_at instanceof Date
      ? new Date(row.linked_at.getTime())
      : new Date(row.linked_at);
    if (!Number.isFinite(linkedAt.getTime()) ||
        row.hold_id !== identities.holdId ||
        row.reservation_id !== identities.reservationId ||
        row.segment_id !== identities.segmentId ||
        row.currency !== identities.currency ||
        row.linked_by !== envelope.actorId) {
      throw new ReservationConflictError("Quoted-tax reservation lineage returned mismatched evidence");
    }
    if (!row.created) return;

    const payload = Object.freeze({
      lineage_id: row.lineage_id,
      binding_id: row.binding_id,
      hold_id: row.hold_id,
      attribution_id: row.attribution_id,
      reservation_id: row.reservation_id,
      segment_id: row.segment_id,
      origin_quote_hash: row.origin_quote_hash,
      snapshot_hash: row.snapshot_hash,
      currency: row.currency,
    });
    const lineageEnvelope = createAuditEnvelope({
      actorId: envelope.actorId,
      tenantId: envelope.tenantId,
      propertyNode: envelope.propertyNode,
      requestId: envelope.requestId,
      operation: TAX_RESERVATION_BOUND_EVENT,
    });
    const fact = await recordFact(tx, {
      entityType: TAX_RESERVATION_BINDING_ENTITY,
      entityId: row.lineage_id,
      envelope: lineageEnvelope,
      payload,
    });
    await this.#events.publish(tx, {
      tenantId: envelope.tenantId,
      propertyNode: envelope.propertyNode,
      businessDate: fact.businessDate,
      aggregateType: TAX_RESERVATION_BINDING_ENTITY,
      aggregateId: row.lineage_id,
      eventType: TAX_RESERVATION_BOUND_EVENT,
      actorId: envelope.actorId,
      correlationId: envelope.requestId,
      payload,
    });
  }

  async #prepare(
    tx: Tx,
    envelope: AuditEnvelope,
    source: NormalizedSource,
  ): Promise<PreparedInventory> {
    if (source.kind === "hold") {
      try {
        const prepared: PreparedCartHoldForSegment = await this.#holds.prepareForSegment(tx, {
          holdId: source.holdId,
          envelope: createAuditEnvelope({
            actorId: envelope.actorId,
            tenantId: envelope.tenantId,
            propertyNode: envelope.propertyNode,
            requestId: envelope.requestId,
            operation: "hold.consumed",
          }),
        });
        return Object.freeze({
          source: "hold" as const,
          holdId: prepared.holdId,
          sellableUnitId: prepared.sellableUnitId,
          unitTypeId: prepared.unitTypeId,
          from: new Date(prepared.from),
          to: new Date(prepared.to),
          claimCount: prepared.claimCount,
        });
      } catch (error) {
        if (error instanceof HoldConflictError) {
          throw new ReservationConflictError("Held inventory is no longer available");
        }
        throw error;
      }
    }

    const prepared: PreparedReservationSegmentClaim = await this.#occupancy.prepareClaimForSegment(tx, {
      sellableUnitId: source.sellableUnitId,
      from: source.from,
      to: source.to,
      envelope: createAuditEnvelope({
        actorId: envelope.actorId,
        tenantId: envelope.tenantId,
        propertyNode: envelope.propertyNode,
        requestId: envelope.requestId,
        operation: "occupancy.recorded",
      }),
    });
    return Object.freeze({ source: "direct" as const, ...prepared });
  }

  #assertAcquiredMatchesPreparation(
    prepared: PreparedInventory,
    acquired: AcquiredInventory,
  ): void {
    if (
      acquired.source !== prepared.source ||
      acquired.holdId !== prepared.holdId ||
      acquired.sellableUnitId !== prepared.sellableUnitId ||
      acquired.unitTypeId !== prepared.unitTypeId ||
      acquired.from.getTime() !== prepared.from.getTime() ||
      acquired.to.getTime() !== prepared.to.getTime() ||
      acquired.claimCount !== prepared.claimCount
    ) {
      throw new Error("Acquired inventory did not match the frozen reservation preparation");
    }
  }

  async #acquire(
    tx: Tx,
    envelope: AuditEnvelope,
    source: NormalizedSource,
    segmentId: string,
  ): Promise<AcquiredInventory> {
    if (source.kind === "hold") {
      try {
        const transfer = await this.#holds.consumeForSegment(tx, {
          holdId: source.holdId,
          segmentId,
          envelope: createAuditEnvelope({
            actorId: envelope.actorId,
            tenantId: envelope.tenantId,
            propertyNode: envelope.propertyNode,
            requestId: envelope.requestId,
            operation: "hold.consumed",
          }),
        });
        return Object.freeze({
          source: "hold" as const,
          holdId: source.holdId,
          sellableUnitId: transfer.hold.sellableUnitId,
          unitTypeId: transfer.unitTypeId,
          from: transfer.hold.from,
          to: transfer.hold.to,
          claimCount: transfer.claimCount,
        });
      } catch (error) {
        if (error instanceof HoldConflictError) {
          throw new ReservationConflictError("Held inventory is no longer available");
        }
        throw error;
      }
    }

    try {
      const claim = await this.#occupancy.claimForSegment(tx, {
        sellableUnitId: source.sellableUnitId,
        segmentId,
        from: source.from,
        to: source.to,
        envelope: createAuditEnvelope({
          actorId: envelope.actorId,
          tenantId: envelope.tenantId,
          propertyNode: envelope.propertyNode,
          requestId: envelope.requestId,
          operation: "occupancy.recorded",
        }),
      });
      return Object.freeze({ source: "direct" as const, ...claim });
    } catch (error) {
      if (error instanceof InventoryConflictError) {
        throw new ReservationConflictError("Direct inventory is no longer available");
      }
      throw error;
    }
  }
}
