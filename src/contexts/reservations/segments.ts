import {
  InventoryConflictError,
  InventoryNotFoundError,
  ReservationOccupancyService,
  type ReservationSegmentOccupancyClaim,
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
  ReservationLifecycleConflictError,
  ReservationLifecycleNotFoundError,
  ReservationLifecycleValidationError,
} from "./lifecycle";
import { RESERVATION_STATUSES, type ReservationStatus } from "./state-machine";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const CONFIRMATION_NO = /^[\x21-\x7e]{1,120}$/;
const IDEMPOTENCY_KEY = /^[\x21-\x7e]{8,200}$/;
const OFFSET_INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{3}))?(Z|([+-])(\d{2}):(\d{2}))$/;
const MAX_STAY_MS = 366 * 24 * 60 * 60 * 1_000;
const MAX_SEGMENT_SEQUENCE = 32_767;

export interface ExpectedSegmentPeriod extends Readonly<Record<string, JsonValue>> {
  readonly from: string;
  readonly to: string;
}

export interface ChangeReservationDepartureInput {
  readonly reservationId: string;
  readonly segmentId: string;
  readonly expectedPeriod: ExpectedSegmentPeriod;
  readonly newDeparture: string;
  readonly idempotencyKey: string;
  readonly envelope: AuditEnvelope;
}

export interface MoveReservationRoomInput {
  readonly reservationId: string;
  readonly segmentId: string;
  readonly expectedSellableUnitId: string;
  readonly expectedPeriod: ExpectedSegmentPeriod;
  readonly destinationSellableUnitId: string;
  readonly idempotencyKey: string;
  readonly envelope: AuditEnvelope;
}

export interface ChangeReservationDepartureResult {
  readonly reservationId: string;
  readonly segmentId: string;
  readonly classification: "extended" | "shortened";
  readonly beforePeriod: ExpectedSegmentPeriod;
  readonly afterPeriod: ExpectedSegmentPeriod;
  readonly sellableUnitId: string;
  readonly unitTypeId: string;
  readonly releasedClaimCount: number;
  readonly reclaimedClaimCount: number;
  readonly financialJournalId: null;
  readonly replayed: boolean;
}

export interface MoveReservationRoomResult {
  readonly reservationId: string;
  readonly oldSegmentId: string;
  readonly newSegmentId: string;
  readonly oldSequence: number;
  readonly newSequence: number;
  readonly fromSellableUnitId: string;
  readonly toSellableUnitId: string;
  readonly fromSpaceId: string;
  readonly toSpaceId: string;
  readonly movedAt: string;
  readonly beforePeriod: ExpectedSegmentPeriod;
  readonly departedPeriod: ExpectedSegmentPeriod;
  readonly activePeriod: ExpectedSegmentPeriod;
  readonly financialJournalId: null;
  readonly replayed: boolean;
}

export interface ReservationSegmentServiceOptions {
  readonly events: EventBus;
  readonly idempotency: PostgresIdempotency;
  readonly occupancy?: ReservationOccupancyService;
  readonly now?: () => Date;
  readonly idFactory?: () => string;
}

export interface FindReservationSegmentsInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly confirmationNo: string;
}

export interface ReservationSegmentLookupItem {
  readonly segmentId: string;
  readonly sequence: number;
  readonly status: string;
  readonly unitTypeId: string;
  readonly sellableUnitId: string | null;
  readonly period: ExpectedSegmentPeriod;
  readonly actions: Readonly<{
    canChangeDeparture: boolean;
    canMoveRoom: boolean;
  }>;
}

export interface ReservationSegmentLookupResult {
  readonly reservationId: string;
  readonly confirmationNo: string;
  readonly status: ReservationStatus;
  readonly segments: readonly ReservationSegmentLookupItem[];
}

type ChangeDepartureBody = Omit<ChangeReservationDepartureResult, "replayed">
  & Readonly<Record<string, JsonValue>>;
type MoveRoomBody = Omit<MoveReservationRoomResult, "replayed">
  & Readonly<Record<string, JsonValue>>;

interface ReservationRow {
  readonly id: string;
  readonly status: string;
}

interface SegmentRow {
  readonly id: string;
  readonly seq: number;
  readonly unit_type_id: string;
  readonly sellable_unit_id: string | null;
  readonly from_at: Date;
  readonly to_at: Date;
  readonly adults: number;
  readonly children_json: string;
  readonly rate_plan_id: string;
  readonly price_override_json: string | null;
  readonly status: string;
}

interface SegmentLookupRow extends SegmentRow {
  readonly reservation_id: string;
  readonly confirmation_no: string;
  readonly reservation_status: string;
}

function requireUuid(name: string, value: unknown): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new ReservationLifecycleValidationError(`${name} must be a UUID`);
  }
  return value;
}

function requireReservationStatus(value: string): ReservationStatus {
  if (!RESERVATION_STATUSES.includes(value as ReservationStatus)) {
    throw new Error(`Database returned unsupported reservation status ${value}`);
  }
  return value as ReservationStatus;
}

function requireOperation(envelope: AuditEnvelope, operation: string): void {
  if (envelope.operation !== operation) {
    throw new ReservationLifecycleValidationError(`audit operation must be ${operation}`);
  }
}

function requireIdempotencyKey(value: unknown): string {
  if (typeof value !== "string" || !IDEMPOTENCY_KEY.test(value)) {
    throw new ReservationLifecycleValidationError(
      "idempotencyKey must contain 8-200 printable non-space characters",
    );
  }
  return value;
}

function requireOffsetInstant(name: string, value: unknown): Date {
  if (typeof value !== "string") {
    throw new ReservationLifecycleValidationError(`${name} must be an exact offset-aware instant`);
  }
  const match = OFFSET_INSTANT.exec(value);
  if (!match) {
    throw new ReservationLifecycleValidationError(`${name} must be an exact offset-aware instant`);
  }
  const [, yearText, monthText, dayText, hourText, minuteText, secondText,
    millisecondText = "000", , sign, offsetHourText = "00", offsetMinuteText = "00"] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const millisecond = Number(millisecondText);
  const offsetHour = Number(offsetHourText);
  const offsetMinute = Number(offsetMinuteText);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 ||
      minute > 59 || second > 59 || offsetHour > 14 || offsetMinute > 59 ||
      (offsetHour === 14 && offsetMinute !== 0)) {
    throw new ReservationLifecycleValidationError(`${name} must be a valid instant`);
  }
  const instant = new Date(value);
  if (!Number.isFinite(instant.getTime())) {
    throw new ReservationLifecycleValidationError(`${name} must be a valid instant`);
  }
  const signedOffsetMinutes = sign === "-"
    ? -(offsetHour * 60 + offsetMinute)
    : offsetHour * 60 + offsetMinute;
  const local = new Date(instant.getTime() + signedOffsetMinutes * 60_000);
  if (local.getUTCFullYear() !== year || local.getUTCMonth() + 1 !== month ||
      local.getUTCDate() !== day || local.getUTCHours() !== hour ||
      local.getUTCMinutes() !== minute || local.getUTCSeconds() !== second ||
      local.getUTCMilliseconds() !== millisecond) {
    throw new ReservationLifecycleValidationError(`${name} must be a valid calendar instant`);
  }
  return instant;
}

function normalizePeriod(value: ExpectedSegmentPeriod): Readonly<{
  from: Date;
  to: Date;
  json: ExpectedSegmentPeriod;
}> {
  if (typeof value !== "object" || value === null || Array.isArray(value) ||
      Object.keys(value).sort().join(",") !== "from,to") {
    throw new ReservationLifecycleValidationError("expectedPeriod must contain exactly from and to");
  }
  const from = requireOffsetInstant("expectedPeriod.from", value.from);
  const to = requireOffsetInstant("expectedPeriod.to", value.to);
  if (from >= to || to.getTime() - from.getTime() > MAX_STAY_MS) {
    throw new ReservationLifecycleValidationError(
      "expectedPeriod must be a positive period of at most 366 days",
    );
  }
  return Object.freeze({
    from,
    to,
    json: freezePeriod(from, to),
  });
}

function requireNow(value: Date): Date {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new ReservationLifecycleValidationError("segment clock returned an invalid instant");
  }
  return new Date(value);
}

function freezePeriod(from: Date, to: Date): ExpectedSegmentPeriod {
  return Object.freeze({ from: from.toISOString(), to: to.toISOString() });
}

function sameInstant(left: Date, right: Date): boolean {
  return left.getTime() === right.getTime();
}

function occupancyEnvelope(envelope: AuditEnvelope, operation: "occupancy.recorded" | "occupancy.released") {
  return createAuditEnvelope({
    actorId: envelope.actorId,
    tenantId: envelope.tenantId,
    propertyNode: envelope.propertyNode,
    requestId: envelope.requestId,
    operation,
  });
}

async function loadReservationAndSegments(
  tx: Tx,
  envelope: AuditEnvelope,
  reservationId: string,
): Promise<Readonly<{ reservation: ReservationRow; segments: readonly SegmentRow[] }>> {
  const reservations = await tx<ReservationRow[]>`
    SELECT id, status
    FROM reservation
    WHERE id = ${reservationId}::uuid
      AND tenant_id = ${envelope.tenantId}::uuid
      AND tenant_id = current_setting('app.tenant_id', true)::uuid
      AND property_node = ${envelope.propertyNode}::uuid
    FOR UPDATE
  `;
  const reservation = reservations[0];
  if (!reservation) {
    throw new ReservationLifecycleNotFoundError("Reservation was not found in the active property");
  }
  const segments = await tx<SegmentRow[]>`
    SELECT id, seq, unit_type_id, sellable_unit_id,
           lower(period) AS from_at, upper(period) AS to_at,
           adults, children::text AS children_json, rate_plan_id,
           price_override::text AS price_override_json, status
    FROM reservation_segment
    WHERE tenant_id = ${envelope.tenantId}::uuid
      AND tenant_id = current_setting('app.tenant_id', true)::uuid
      AND reservation_id = ${reservationId}::uuid
    ORDER BY seq, id
    FOR UPDATE
  `;
  if (segments.length === 0) {
    throw new ReservationLifecycleConflictError("Reservation has no segments");
  }
  return Object.freeze({ reservation, segments });
}

function requireLatestSegment(
  segments: readonly SegmentRow[],
  segmentId: string,
): SegmentRow {
  const target = segments.find((segment) => segment.id === segmentId);
  if (!target) {
    throw new ReservationLifecycleNotFoundError("Reservation segment was not found");
  }
  const latest = segments[segments.length - 1];
  if (!latest || latest.id !== target.id || latest.seq !== target.seq) {
    throw new ReservationLifecycleConflictError("Only the latest reservation segment may be changed");
  }
  return target;
}

function requireExpectedPeriod(target: SegmentRow, expected: ReturnType<typeof normalizePeriod>): void {
  if (!sameInstant(target.from_at, expected.from) || !sameInstant(target.to_at, expected.to)) {
    throw new ReservationLifecycleConflictError("Reservation segment period changed concurrently");
  }
}

function requireDepartureState(reservationStatus: string, segmentStatus: string): void {
  const agrees = (segmentStatus === "booked" &&
      (reservationStatus === "reserved" || reservationStatus === "due_in")) ||
    (segmentStatus === "in_house" &&
      (reservationStatus === "in_house" || reservationStatus === "due_out"));
  if (!agrees) {
    throw new ReservationLifecycleConflictError(
      `Reservation status ${reservationStatus} and segment status ${segmentStatus} cannot change departure`,
    );
  }
}

function requireOneExclusiveClaim(
  claims: readonly ReservationSegmentOccupancyClaim[],
  subject: string,
): ReservationSegmentOccupancyClaim {
  const claim = claims[0];
  if (claims.length !== 1 || !claim || claim.exclusive !== true) {
    throw new ReservationLifecycleConflictError(`${subject} must resolve to one exclusive physical space`);
  }
  return claim;
}

function requireClaimsPeriod(
  claims: readonly ReservationSegmentOccupancyClaim[],
  expected: ExpectedSegmentPeriod,
  subject: string,
): void {
  const expectedFrom = new Date(expected.from).getTime();
  const expectedTo = new Date(expected.to).getTime();
  const exact = claims.length > 0 && claims.every((claim) => {
    const match = /^\["([^"]+)","([^"]+)"\)$/.exec(claim.period);
    if (!match) return false;
    const from = Date.parse(match[1]!);
    const to = Date.parse(match[2]!);
    return Number.isFinite(from) && Number.isFinite(to) && from === expectedFrom && to === expectedTo;
  });
  if (!exact) {
    throw new ReservationLifecycleConflictError(`${subject} occupancy period does not match the segment`);
  }
}

function mapInventoryError(error: unknown, message: string): never {
  if (error instanceof InventoryConflictError || error instanceof InventoryNotFoundError) {
    throw new ReservationLifecycleConflictError(message);
  }
  throw error;
}

export class ReservationSegmentService {
  readonly #events: EventBus;
  readonly #idempotency: PostgresIdempotency;
  readonly #occupancy: ReservationOccupancyService;
  readonly #now: () => Date;
  readonly #idFactory: () => string;

  constructor(options: ReservationSegmentServiceOptions) {
    this.#events = options.events;
    this.#idempotency = options.idempotency;
    this.#occupancy = options.occupancy ?? new ReservationOccupancyService(options.events);
    this.#now = options.now ?? (() => new Date());
    this.#idFactory = options.idFactory ?? (() => crypto.randomUUID());
  }

  async findByConfirmation(
    tx: Tx,
    input: FindReservationSegmentsInput,
  ): Promise<ReservationSegmentLookupResult> {
    const tenantId = requireUuid("tenantId", input.tenantId);
    const propertyNode = requireUuid("propertyNode", input.propertyNode);
    if (typeof input.confirmationNo !== "string" || !CONFIRMATION_NO.test(input.confirmationNo)) {
      throw new ReservationLifecycleValidationError(
        "confirmationNo must contain 1-120 visible characters",
      );
    }
    const rows = await tx<SegmentLookupRow[]>`
      SELECT reservation.id AS reservation_id,
             reservation.confirmation_no,
             reservation.status AS reservation_status,
             segment.id, segment.seq, segment.unit_type_id, segment.sellable_unit_id,
             lower(segment.period) AS from_at, upper(segment.period) AS to_at,
             segment.adults, segment.children::text AS children_json,
             segment.rate_plan_id, segment.price_override::text AS price_override_json,
             segment.status
      FROM reservation
      JOIN reservation_segment AS segment
        ON segment.tenant_id = reservation.tenant_id
       AND segment.reservation_id = reservation.id
      WHERE reservation.tenant_id = ${tenantId}::uuid
        AND reservation.tenant_id = current_setting('app.tenant_id', true)::uuid
        AND reservation.property_node = ${propertyNode}::uuid
        AND reservation.confirmation_no = ${input.confirmationNo}
      ORDER BY segment.seq, segment.id
    `;
    const first = rows[0];
    if (!first) {
      throw new ReservationLifecycleNotFoundError("Reservation was not found in the property");
    }
    const status = requireReservationStatus(first.reservation_status);
    const last = rows[rows.length - 1]!;
    return Object.freeze({
      reservationId: first.reservation_id,
      confirmationNo: first.confirmation_no,
      status,
      segments: Object.freeze(rows.map((segment) => {
        const latest = segment.id === last.id && segment.seq === last.seq;
        return Object.freeze({
          segmentId: segment.id,
          sequence: segment.seq,
          status: segment.status,
          unitTypeId: segment.unit_type_id,
          sellableUnitId: segment.sellable_unit_id,
          period: freezePeriod(segment.from_at, segment.to_at),
          actions: Object.freeze({
            canChangeDeparture: latest && (
              (segment.status === "booked" && (status === "reserved" || status === "due_in")) ||
              (segment.status === "in_house" && (status === "in_house" || status === "due_out"))
            ),
            canMoveRoom: latest && segment.status === "in_house" &&
              (status === "in_house" || status === "due_out") && segment.sellable_unit_id !== null,
          }),
        });
      })),
    });
  }

  async changeDeparture(
    tx: Tx,
    input: ChangeReservationDepartureInput,
  ): Promise<ChangeReservationDepartureResult> {
    requireOperation(input.envelope, "reservation.modified");
    const reservationId = requireUuid("reservationId", input.reservationId);
    const segmentId = requireUuid("segmentId", input.segmentId);
    const expected = normalizePeriod(input.expectedPeriod);
    const newDeparture = requireOffsetInstant("newDeparture", input.newDeparture);
    const idempotencyKey = requireIdempotencyKey(input.idempotencyKey);
    if (newDeparture <= expected.from || newDeparture.getTime() - expected.from.getTime() > MAX_STAY_MS) {
      throw new ReservationLifecycleValidationError(
        "newDeparture must remain after arrival and within a 366-day stay",
      );
    }
    if (sameInstant(newDeparture, expected.to)) {
      throw new ReservationLifecycleValidationError("newDeparture must change the segment end");
    }
    const afterPeriod = freezePeriod(expected.from, newDeparture);
    const classification = newDeparture > expected.to ? "extended" as const : "shortened" as const;

    const outcome = await this.#idempotency.execute<ChangeDepartureBody>(tx, {
      tenantId: input.envelope.tenantId,
      operation: "reservation.segment.change_departure",
      key: idempotencyKey,
      request: {
        actorId: input.envelope.actorId,
        propertyNode: input.envelope.propertyNode,
        reservationId,
        segmentId,
        expectedPeriod: expected.json,
        newDeparture: newDeparture.toISOString(),
      },
    }, async (commandTx) => {
      const locked = await loadReservationAndSegments(commandTx, input.envelope, reservationId);
      const target = requireLatestSegment(locked.segments, segmentId);
      requireExpectedPeriod(target, expected);
      requireDepartureState(locked.reservation.status, target.status);
      if (target.sellable_unit_id === null) {
        throw new ReservationLifecycleConflictError("Departure change requires assigned sellable inventory");
      }
      const now = requireNow(this.#now());
      if (target.status === "in_house" && newDeparture <= now) {
        throw new ReservationLifecycleConflictError(
          "An in-house departure must remain after the server clock",
        );
      }

      let released;
      try {
        released = await this.#occupancy.releaseForSegment(commandTx, {
          segmentId,
          envelope: occupancyEnvelope(input.envelope, "occupancy.released"),
        });
      } catch (error) {
        mapInventoryError(error, "Reservation segment occupancy could not be released");
      }
      requireClaimsPeriod(released.claims, expected.json, "Released segment");
      const updated = await commandTx<Array<{ id: string }>>`
        UPDATE reservation_segment
        SET period = tstzrange(
          ${expected.from.toISOString()}::timestamptz,
          ${newDeparture.toISOString()}::timestamptz,
          '[)'
        )
        WHERE id = ${segmentId}::uuid
          AND tenant_id = ${input.envelope.tenantId}::uuid
          AND reservation_id = ${reservationId}::uuid
          AND seq = ${target.seq}
          AND status = ${target.status}
          AND sellable_unit_id = ${target.sellable_unit_id}::uuid
          AND unit_type_id = ${target.unit_type_id}::uuid
          AND period = tstzrange(
            ${expected.from.toISOString()}::timestamptz,
            ${expected.to.toISOString()}::timestamptz,
            '[)'
          )
        RETURNING id
      `;
      if (updated[0]?.id !== segmentId) {
        throw new ReservationLifecycleConflictError("Reservation segment changed concurrently");
      }
      let reclaimed;
      try {
        reclaimed = await this.#occupancy.claimForSegment(commandTx, {
          sellableUnitId: target.sellable_unit_id,
          segmentId,
          from: expected.from,
          to: newDeparture,
          envelope: occupancyEnvelope(input.envelope, "occupancy.recorded"),
        });
      } catch (error) {
        mapInventoryError(error, "Changed departure inventory is not available");
      }
      if (reclaimed.unitTypeId !== target.unit_type_id) {
        throw new ReservationLifecycleConflictError("Assigned sellable unit type changed concurrently");
      }
      requireClaimsPeriod(reclaimed.claims, afterPeriod, "Reclaimed segment");

      const evidence = Object.freeze({
        reservation_id: reservationId,
        segment_id: segmentId,
        classification,
        diff: Object.freeze({
          period: Object.freeze({ before: expected.json, after: afterPeriod }),
        }),
        sellable_unit_id: target.sellable_unit_id,
        unit_type_id: target.unit_type_id,
        released_claims: released.claimCount,
        reclaimed_claims: reclaimed.claimCount,
        financial_journal_id: null,
      });
      const fact = await recordFact(commandTx, {
        entityType: "reservation",
        entityId: reservationId,
        envelope: input.envelope,
        payload: evidence,
      });
      await this.#events.publish(commandTx, {
        tenantId: input.envelope.tenantId,
        propertyNode: input.envelope.propertyNode,
        businessDate: fact.businessDate,
        aggregateType: "reservation",
        aggregateId: reservationId,
        eventType: "reservation.modified",
        actorId: input.envelope.actorId,
        correlationId: input.envelope.requestId,
        payload: evidence,
      });
      const body: ChangeDepartureBody = Object.freeze({
        reservationId,
        segmentId,
        classification,
        beforePeriod: expected.json,
        afterPeriod,
        sellableUnitId: target.sellable_unit_id,
        unitTypeId: target.unit_type_id,
        releasedClaimCount: released.claimCount,
        reclaimedClaimCount: reclaimed.claimCount,
        financialJournalId: null,
      });
      return { status: 200, body };
    });
    return Object.freeze({ ...outcome.body, replayed: outcome.replayed });
  }

  async moveRoom(tx: Tx, input: MoveReservationRoomInput): Promise<MoveReservationRoomResult> {
    requireOperation(input.envelope, "segment.moved");
    const reservationId = requireUuid("reservationId", input.reservationId);
    const segmentId = requireUuid("segmentId", input.segmentId);
    const expectedSellableUnitId = requireUuid(
      "expectedSellableUnitId",
      input.expectedSellableUnitId,
    );
    const destinationSellableUnitId = requireUuid(
      "destinationSellableUnitId",
      input.destinationSellableUnitId,
    );
    if (destinationSellableUnitId === expectedSellableUnitId) {
      throw new ReservationLifecycleValidationError("Destination sellable unit must differ from source");
    }
    const expected = normalizePeriod(input.expectedPeriod);
    const idempotencyKey = requireIdempotencyKey(input.idempotencyKey);

    const outcome = await this.#idempotency.execute<MoveRoomBody>(tx, {
      tenantId: input.envelope.tenantId,
      operation: "reservation.segment.move_room",
      key: idempotencyKey,
      request: {
        actorId: input.envelope.actorId,
        propertyNode: input.envelope.propertyNode,
        reservationId,
        segmentId,
        expectedSellableUnitId,
        expectedPeriod: expected.json,
        destinationSellableUnitId,
      },
    }, async (commandTx) => {
      const locked = await loadReservationAndSegments(commandTx, input.envelope, reservationId);
      const target = requireLatestSegment(locked.segments, segmentId);
      requireExpectedPeriod(target, expected);
      if (target.sellable_unit_id !== expectedSellableUnitId) {
        throw new ReservationLifecycleConflictError("Reservation segment assignment changed concurrently");
      }
      if ((locked.reservation.status !== "in_house" && locked.reservation.status !== "due_out") ||
          target.status !== "in_house") {
        throw new ReservationLifecycleConflictError(
          "Room move requires the latest in-house segment on an in-house or due-out reservation",
        );
      }
      const movedAt = requireNow(this.#now());
      if (movedAt <= expected.from || movedAt >= expected.to) {
        throw new ReservationLifecycleConflictError(
          "Room move clock must fall strictly inside the active segment period",
        );
      }
      if (target.seq >= MAX_SEGMENT_SEQUENCE) {
        throw new ReservationLifecycleConflictError("Reservation segment sequence is exhausted");
      }
      const newSegmentId = requireUuid("generated segment id", this.#idFactory());
      if (newSegmentId === segmentId || locked.segments.some((segment) => segment.id === newSegmentId)) {
        throw new ReservationLifecycleValidationError("generated segment id must be unique");
      }
      const newSequence = target.seq + 1;

      let released;
      try {
        released = await this.#occupancy.releaseForSegment(commandTx, {
          segmentId,
          envelope: occupancyEnvelope(input.envelope, "occupancy.released"),
        });
      } catch (error) {
        mapInventoryError(error, "Source room occupancy could not be released");
      }
      const sourceClaim = requireOneExclusiveClaim(released.claims, "Source sellable unit");
      requireClaimsPeriod(released.claims, expected.json, "Source sellable unit");
      const activePeriod = freezePeriod(movedAt, expected.to);
      const inserted = await commandTx<Array<{ id: string }>>`
        INSERT INTO reservation_segment (
          id, tenant_id, reservation_id, seq, unit_type_id, sellable_unit_id,
          period, adults, children, rate_plan_id, price_override, status
        ) VALUES (
          ${newSegmentId}::uuid, ${input.envelope.tenantId}::uuid, ${reservationId}::uuid,
          ${newSequence}, ${target.unit_type_id}::uuid, ${destinationSellableUnitId}::uuid,
          tstzrange(${movedAt.toISOString()}::timestamptz, ${expected.to.toISOString()}::timestamptz, '[)'),
          ${target.adults}, ${target.children_json}::text::jsonb, ${target.rate_plan_id}::uuid,
          ${target.price_override_json}::text::jsonb, 'in_house'
        )
        RETURNING id
      `;
      if (inserted[0]?.id !== newSegmentId) {
        throw new Error("PostgreSQL did not return the new reservation segment");
      }
      let claimed;
      try {
        claimed = await this.#occupancy.claimForSegment(commandTx, {
          sellableUnitId: destinationSellableUnitId,
          segmentId: newSegmentId,
          from: movedAt,
          to: expected.to,
          envelope: occupancyEnvelope(input.envelope, "occupancy.recorded"),
        });
      } catch (error) {
        mapInventoryError(error, "Destination room inventory is not available");
      }
      const destinationClaim = requireOneExclusiveClaim(claimed.claims, "Destination sellable unit");
      requireClaimsPeriod(claimed.claims, activePeriod, "Destination sellable unit");
      if (claimed.unitTypeId !== target.unit_type_id) {
        throw new ReservationLifecycleConflictError("Room move destination must have the same unit type");
      }
      if (destinationClaim.spaceId === sourceClaim.spaceId) {
        throw new ReservationLifecycleConflictError("Room move destination must be a different physical space");
      }

      const departedPeriod = freezePeriod(expected.from, movedAt);
      const updated = await commandTx<Array<{ id: string }>>`
        UPDATE reservation_segment
        SET status = 'departed',
            period = tstzrange(
              ${expected.from.toISOString()}::timestamptz,
              ${movedAt.toISOString()}::timestamptz,
              '[)'
            )
        WHERE id = ${segmentId}::uuid
          AND tenant_id = ${input.envelope.tenantId}::uuid
          AND reservation_id = ${reservationId}::uuid
          AND seq = ${target.seq}
          AND status = 'in_house'
          AND unit_type_id = ${target.unit_type_id}::uuid
          AND sellable_unit_id = ${expectedSellableUnitId}::uuid
          AND period = tstzrange(
            ${expected.from.toISOString()}::timestamptz,
            ${expected.to.toISOString()}::timestamptz,
            '[)'
          )
        RETURNING id
      `;
      if (updated[0]?.id !== segmentId) {
        throw new ReservationLifecycleConflictError("Reservation segment changed concurrently");
      }

      const evidence = Object.freeze({
        reservation_id: reservationId,
        old_segment_id: segmentId,
        new_segment_id: newSegmentId,
        old_sequence: target.seq,
        new_sequence: newSequence,
        from_sellable_unit_id: expectedSellableUnitId,
        to_sellable_unit_id: destinationSellableUnitId,
        from_space: sourceClaim.spaceId,
        to_space: destinationClaim.spaceId,
        moved_at: movedAt.toISOString(),
        before_period: expected.json,
        departed_period: departedPeriod,
        active_period: activePeriod,
        financial_journal_id: null,
      });
      const fact = await recordFact(commandTx, {
        entityType: "reservation_segment",
        entityId: newSegmentId,
        envelope: input.envelope,
        payload: evidence,
      });
      await this.#events.publish(commandTx, {
        tenantId: input.envelope.tenantId,
        propertyNode: input.envelope.propertyNode,
        businessDate: fact.businessDate,
        aggregateType: "reservation",
        aggregateId: reservationId,
        eventType: "segment.moved",
        actorId: input.envelope.actorId,
        correlationId: input.envelope.requestId,
        payload: evidence,
      });
      const body: MoveRoomBody = Object.freeze({
        reservationId,
        oldSegmentId: segmentId,
        newSegmentId,
        oldSequence: target.seq,
        newSequence,
        fromSellableUnitId: expectedSellableUnitId,
        toSellableUnitId: destinationSellableUnitId,
        fromSpaceId: sourceClaim.spaceId,
        toSpaceId: destinationClaim.spaceId,
        movedAt: movedAt.toISOString(),
        beforePeriod: expected.json,
        departedPeriod,
        activePeriod,
        financialJournalId: null,
      });
      return { status: 200, body };
    });
    return Object.freeze({ ...outcome.body, replayed: outcome.replayed });
  }
}
