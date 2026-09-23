import {
  InventoryConflictError,
  InventoryNotFoundError,
  ReservationOccupancyService,
} from "../inventory";
import { findReservationTransition } from "../reservations";
import {
  createAuditEnvelope,
  recordFact,
  type AuditEnvelope,
  type Database,
  type EventBus,
  type JsonValue,
  type PostgresIdempotency,
  type Tx,
} from "../../kernel";
import {
  loadCheckoutReadiness,
  type CheckoutReadinessBlocker,
} from "./checkout-readiness";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const IDEMPOTENCY_KEY = /^[\x21-\x7e]{8,200}$/;

export interface CheckoutInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly reservationId: string;
  readonly idempotencyKey: string;
  readonly envelope: AuditEnvelope;
}

export interface CheckoutPeriod extends Readonly<Record<string, JsonValue>> {
  readonly from: string;
  readonly to: string;
}

export interface CheckoutResult extends Readonly<Record<string, JsonValue>> {
  readonly reservationId: string;
  readonly previousReservationStatus: "in_house" | "due_out";
  readonly reservationStatus: "checked_out";
  readonly segmentId: string;
  readonly segmentStatus: "departed";
  readonly assignedSpaceId: string;
  readonly checkedOutAt: string;
  readonly previousSegmentPeriod: CheckoutPeriod;
  readonly segmentPeriod: CheckoutPeriod;
  readonly releasedClaimCount: number;
  readonly folioWindowCount: number;
  readonly replayed: boolean;
}

export interface CheckoutServiceOptions {
  readonly database: Database;
  readonly events: EventBus;
  readonly idempotency: PostgresIdempotency;
  readonly occupancy?: ReservationOccupancyService;
}

interface ReservationRow {
  readonly id: string;
  readonly status: string;
  readonly primary_party: string;
  readonly currency: string;
}

interface SegmentRow {
  readonly id: string;
  readonly status: string;
  readonly period_start: Date;
  readonly period_end: Date;
}

interface FolioFamilyRow {
  readonly folio_id: string;
  readonly account_id: string;
  readonly account_role: string;
  readonly account_party_id: string | null;
  readonly account_property_node: string;
  readonly account_currency: string;
}

interface CheckoutBody extends Readonly<Record<string, JsonValue>> {
  readonly reservationId: string;
  readonly previousReservationStatus: "in_house" | "due_out";
  readonly reservationStatus: "checked_out";
  readonly segmentId: string;
  readonly segmentStatus: "departed";
  readonly assignedSpaceId: string;
  readonly checkedOutAt: string;
  readonly previousSegmentPeriod: CheckoutPeriod;
  readonly segmentPeriod: CheckoutPeriod;
  readonly releasedClaimCount: number;
  readonly folioWindowCount: number;
}

export class CheckoutValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CheckoutValidationError";
  }
}

export class CheckoutNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CheckoutNotFoundError";
  }
}

export class CheckoutConflictError extends Error {
  readonly blockers: readonly CheckoutReadinessBlocker[];

  constructor(message: string, blockers: readonly CheckoutReadinessBlocker[] = Object.freeze([])) {
    super(message);
    this.name = "CheckoutConflictError";
    this.blockers = Object.freeze([...blockers]);
  }
}

function plainObject(value: unknown, subject: string): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value) ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) ||
      Object.getOwnPropertySymbols(value).length !== 0) {
    throw new CheckoutValidationError(`${subject} must be a plain object`);
  }
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[], subject: string): void {
  const actual = Object.getOwnPropertyNames(value).sort();
  const canonical = [...expected].sort();
  if (actual.length !== canonical.length || actual.some((key, index) => key !== canonical[index])) {
    throw new CheckoutValidationError(`${subject} shape is invalid`);
  }
}

function uuid(value: unknown, subject: string): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new CheckoutValidationError(`${subject} must be a lowercase UUID`);
  }
  return value;
}

function normalize(input: CheckoutInput): Readonly<CheckoutInput> {
  plainObject(input, "checkout input");
  exactKeys(
    input,
    ["tenantId", "propertyNode", "reservationId", "idempotencyKey", "envelope"],
    "checkout input",
  );
  const tenantId = uuid(input.tenantId, "tenantId");
  const propertyNode = uuid(input.propertyNode, "propertyNode");
  const reservationId = uuid(input.reservationId, "reservationId");
  if (typeof input.idempotencyKey !== "string" || !IDEMPOTENCY_KEY.test(input.idempotencyKey)) {
    throw new CheckoutValidationError("idempotencyKey must contain 8 to 200 visible ASCII characters");
  }
  plainObject(input.envelope, "envelope");
  exactKeys(
    input.envelope,
    ["actorId", "tenantId", "propertyNode", "requestId", "operation"],
    "envelope",
  );
  if (uuid(input.envelope.tenantId, "envelope.tenantId") !== tenantId ||
      uuid(input.envelope.propertyNode, "envelope.propertyNode") !== propertyNode ||
      input.envelope.operation !== "reservation.checked_out") {
    throw new CheckoutValidationError("audit envelope is not bound to reservation.checked_out");
  }
  return Object.freeze({
    tenantId,
    propertyNode,
    reservationId,
    idempotencyKey: input.idempotencyKey,
    envelope: Object.freeze({
      actorId: uuid(input.envelope.actorId, "envelope.actorId"),
      tenantId,
      propertyNode,
      requestId: uuid(input.envelope.requestId, "envelope.requestId"),
      operation: "reservation.checked_out",
    }),
  });
}

async function lockReservation(
  tx: Tx,
  input: Readonly<CheckoutInput>,
): Promise<Readonly<{ reservation: ReservationRow; segments: readonly SegmentRow[] }>> {
  const reservation = (await tx<ReservationRow[]>`
    SELECT id, status, primary_party, currency::text
    FROM reservation
    WHERE tenant_id = ${input.tenantId}::uuid
      AND tenant_id = current_setting('app.tenant_id', true)::uuid
      AND property_node = ${input.propertyNode}::uuid
      AND id = ${input.reservationId}::uuid
    FOR UPDATE
  `)[0];
  if (!reservation) {
    throw new CheckoutNotFoundError("Reservation was not found in the active property");
  }
  const segments = await tx<SegmentRow[]>`
    SELECT id, status, lower(period) AS period_start, upper(period) AS period_end
    FROM reservation_segment
    WHERE tenant_id = ${input.tenantId}::uuid
      AND tenant_id = current_setting('app.tenant_id', true)::uuid
      AND reservation_id = ${input.reservationId}::uuid
    ORDER BY seq, id
    FOR UPDATE
  `;
  return Object.freeze({ reservation, segments: Object.freeze([...segments]) });
}

async function loadFolioFamily(tx: Tx, input: Readonly<CheckoutInput>): Promise<readonly FolioFamilyRow[]> {
  return tx<FolioFamilyRow[]>`
    SELECT folio.id AS folio_id, folio.account_id,
           account.role AS account_role, account.party_id AS account_party_id,
           account.property_node AS account_property_node,
           account.currency::text AS account_currency
    FROM folio
    JOIN account
      ON account.tenant_id = folio.tenant_id
     AND account.id = folio.account_id
    WHERE folio.tenant_id = ${input.tenantId}::uuid
      AND folio.tenant_id = current_setting('app.tenant_id', true)::uuid
      AND folio.reservation_id = ${input.reservationId}::uuid
    ORDER BY folio.id
  `;
}

function canonicalFamily(
  rows: readonly FolioFamilyRow[],
  reservation: ReservationRow,
  propertyNode: string,
): string | null {
  const first = rows[0];
  if (!first) return null;
  if (rows.some((row) => row.account_id !== first.account_id || row.account_role !== "guest" ||
      row.account_party_id !== reservation.primary_party ||
      row.account_property_node !== propertyNode || row.account_currency !== reservation.currency)) {
    throw new CheckoutConflictError("Reservation folio family is not canonical");
  }
  return first.account_id;
}

function sameFamily(left: readonly FolioFamilyRow[], right: readonly FolioFamilyRow[]): boolean {
  return left.length === right.length && left.every((row, index) => {
    const other = right[index];
    return other !== undefined && row.folio_id === other.folio_id && row.account_id === other.account_id &&
      row.account_role === other.account_role && row.account_party_id === other.account_party_id &&
      row.account_property_node === other.account_property_node &&
      row.account_currency === other.account_currency;
  });
}

async function lockFinancialFamily(
  tx: Tx,
  input: Readonly<CheckoutInput>,
  reservation: ReservationRow,
): Promise<void> {
  const discovered = await loadFolioFamily(tx, input);
  const accountId = canonicalFamily(discovered, reservation, input.propertyNode);
  if (accountId === null) return;
  await tx`
    SELECT public.lock_financial_rows(
      ${input.tenantId}::uuid,
      ARRAY[${accountId}::uuid]::uuid[],
      NULL::uuid
    )
  `;
  const stable = await loadFolioFamily(tx, input);
  if (!sameFamily(discovered, stable) || canonicalFamily(stable, reservation, input.propertyNode) !== accountId) {
    throw new CheckoutConflictError("Reservation folio family changed concurrently");
  }
  for (const row of stable) {
    await tx`
      SELECT public.lock_financial_rows(
        ${input.tenantId}::uuid,
        ARRAY[${accountId}::uuid]::uuid[],
        ${row.folio_id}::uuid
      )
    `;
  }
  const locked = await loadFolioFamily(tx, input);
  if (!sameFamily(stable, locked)) {
    throw new CheckoutConflictError("Reservation folio family changed concurrently");
  }
}

function period(from: Date, to: Date): CheckoutPeriod {
  return Object.freeze({ from: from.toISOString(), to: to.toISOString() });
}

function translate(error: unknown): never {
  if (error instanceof CheckoutValidationError || error instanceof CheckoutNotFoundError ||
      error instanceof CheckoutConflictError) {
    throw error;
  }
  if (error instanceof InventoryConflictError || error instanceof InventoryNotFoundError) {
    throw new CheckoutConflictError("Reservation occupancy changed concurrently");
  }
  const state = (error as { errno?: unknown; code?: unknown }).errno ??
    (error as { errno?: unknown; code?: unknown }).code;
  if (state === "42501") {
    throw new CheckoutNotFoundError("Reservation was not found in the active property");
  }
  if (state === "23505" || state === "40001" || state === "40P01" || state === "55000" ||
      state === "P0002" || state === "P0003") {
    throw new CheckoutConflictError("Checkout state is unavailable or changed concurrently");
  }
  throw error;
}

export class CheckoutService {
  readonly #database: Database;
  readonly #events: EventBus;
  readonly #idempotency: PostgresIdempotency;
  readonly #occupancy: ReservationOccupancyService;

  constructor(options: CheckoutServiceOptions) {
    this.#database = options.database;
    this.#events = options.events;
    this.#idempotency = options.idempotency;
    this.#occupancy = options.occupancy ?? new ReservationOccupancyService(options.events);
  }

  async checkout(input: CheckoutInput): Promise<CheckoutResult> {
    const normalized = normalize(input);
    try {
      const outcome = await this.#database.withTenantTransaction(normalized.tenantId, (tx) =>
        this.#idempotency.execute<CheckoutBody>(tx, {
          tenantId: normalized.tenantId,
          operation: "stay.checkout.commit",
          key: normalized.idempotencyKey,
          request: {
            actorId: normalized.envelope.actorId,
            propertyNode: normalized.propertyNode,
            reservationId: normalized.reservationId,
            requestId: normalized.envelope.requestId,
            operation: normalized.envelope.operation,
          },
        }, async (commandTx) => {
          const actor = (await commandTx<Array<{ id: string }>>`
            SELECT id
            FROM app_user
            WHERE tenant_id = ${normalized.tenantId}::uuid
              AND tenant_id = current_setting('app.tenant_id', true)::uuid
              AND id = ${normalized.envelope.actorId}::uuid
              AND status = 'active'
          `)[0];
          if (!actor) {
            throw new CheckoutNotFoundError("Checkout actor was not found in the active tenant");
          }

          const locked = await lockReservation(commandTx, normalized);
          const storedStatus = locked.reservation.status;
          if (storedStatus !== "in_house" && storedStatus !== "due_out") {
            throw new CheckoutConflictError(
              "Reservation is not ready for checkout",
              Object.freeze(["reservation_not_departure_state"]),
            );
          }
          const previousStatus: "in_house" | "due_out" = storedStatus;
          const transition = findReservationTransition(previousStatus, "checked_out");
          if (!transition || transition.event !== "reservation.checked_out") {
            throw new CheckoutConflictError(
              "Reservation is not ready for checkout",
              Object.freeze(["reservation_not_departure_state"]),
            );
          }
          await lockFinancialFamily(commandTx, normalized, locked.reservation);
          const readiness = await loadCheckoutReadiness(commandTx, {
            tenantId: normalized.tenantId,
            propertyNode: normalized.propertyNode,
            reservationId: normalized.reservationId,
          });
          if (!readiness.ready) {
            throw new CheckoutConflictError("Reservation is not ready for checkout", readiness.blockers);
          }
          if (!readiness.segment || !readiness.room || !readiness.occupancy) {
            throw new CheckoutConflictError("Checkout readiness evidence is incomplete");
          }
          const currentSegments = locked.segments.filter((segment) => segment.status === "in_house");
          const segment = currentSegments[0];
          if (currentSegments.length !== 1 || !segment || segment.id !== readiness.segment.segmentId) {
            throw new CheckoutConflictError(
              "Reservation segment changed concurrently",
              Object.freeze(["current_segment_missing_or_ambiguous"]),
            );
          }

          const clock = (await commandTx<Array<{ now: Date }>>`
            SELECT transaction_timestamp() AS now
          `)[0]?.now;
          if (!(clock instanceof Date) || !Number.isFinite(clock.getTime())) {
            throw new Error("PostgreSQL returned an invalid checkout timestamp");
          }
          if (clock <= segment.period_start) {
            throw new CheckoutConflictError("Checkout cannot precede the segment start");
          }
          const departedAt = clock < segment.period_end ? clock : segment.period_end;
          const previousSegmentPeriod = period(segment.period_start, segment.period_end);
          const segmentPeriod = period(segment.period_start, departedAt);

          const released = await this.#occupancy.releaseForSegment(commandTx, {
            segmentId: segment.id,
            envelope: createAuditEnvelope({
              actorId: normalized.envelope.actorId,
              tenantId: normalized.tenantId,
              propertyNode: normalized.propertyNode,
              requestId: normalized.envelope.requestId,
              operation: "occupancy.released",
            }),
          });
          if (released.claimCount !== 1 || released.claims.length !== 1 ||
              released.claims[0]?.spaceId !== readiness.room.spaceId ||
              released.claims[0]?.exclusive !== true) {
            throw new CheckoutConflictError("Checkout occupancy was not the exact ready room claim");
          }

          const transitionedSegment = await commandTx<Array<{ id: string }>>`
            UPDATE reservation_segment
            SET status = 'departed',
                period = tstzrange(
                  ${segment.period_start.toISOString()}::timestamptz,
                  ${departedAt.toISOString()}::timestamptz,
                  '[)'
                )
            WHERE tenant_id = ${normalized.tenantId}::uuid
              AND tenant_id = current_setting('app.tenant_id', true)::uuid
              AND reservation_id = ${normalized.reservationId}::uuid
              AND id = ${segment.id}::uuid
              AND status = 'in_house'
              AND period = tstzrange(
                ${segment.period_start.toISOString()}::timestamptz,
                ${segment.period_end.toISOString()}::timestamptz,
                '[)'
              )
            RETURNING id
          `;
          if (transitionedSegment[0]?.id !== segment.id || transitionedSegment.length !== 1) {
            throw new CheckoutConflictError("Reservation segment changed concurrently");
          }
          const transitionedReservation = await commandTx<Array<{ id: string }>>`
            UPDATE reservation
            SET status = 'checked_out'
            WHERE tenant_id = ${normalized.tenantId}::uuid
              AND tenant_id = current_setting('app.tenant_id', true)::uuid
              AND property_node = ${normalized.propertyNode}::uuid
              AND id = ${normalized.reservationId}::uuid
              AND status = ${previousStatus}
            RETURNING id
          `;
          if (transitionedReservation[0]?.id !== normalized.reservationId ||
              transitionedReservation.length !== 1) {
            throw new CheckoutConflictError("Reservation changed concurrently");
          }

          const folioWindows = Object.freeze(readiness.folios.map((folio) => Object.freeze({
            folio_id: folio.folioId,
            window_no: folio.windowNo,
            status: folio.status,
            balance_minor: folio.balanceMinor,
          })));
          const payload = Object.freeze({
            reservation_id: normalized.reservationId,
            previous_status: previousStatus,
            status: "checked_out",
            segment_id: segment.id,
            space_id: readiness.room.spaceId,
            checked_out_at: clock.toISOString(),
            previous_segment_period: previousSegmentPeriod,
            segment_period: segmentPeriod,
            released_claim_count: released.claimCount,
            folio_windows: folioWindows,
          });
          const fact = await recordFact(commandTx, {
            entityType: "reservation",
            entityId: normalized.reservationId,
            envelope: normalized.envelope,
            payload,
          });
          await this.#events.publish(commandTx, {
            tenantId: normalized.tenantId,
            propertyNode: normalized.propertyNode,
            businessDate: fact.businessDate,
            aggregateType: "reservation",
            aggregateId: normalized.reservationId,
            eventType: "reservation.checked_out",
            actorId: normalized.envelope.actorId,
            correlationId: normalized.envelope.requestId,
            payload,
          });

          const body: CheckoutBody = Object.freeze({
            reservationId: normalized.reservationId,
            previousReservationStatus: previousStatus,
            reservationStatus: "checked_out" as const,
            segmentId: segment.id,
            segmentStatus: "departed" as const,
            assignedSpaceId: readiness.room.spaceId,
            checkedOutAt: clock.toISOString(),
            previousSegmentPeriod,
            segmentPeriod,
            releasedClaimCount: released.claimCount,
            folioWindowCount: readiness.folios.length,
          });
          return { status: 200, body };
        })
      );
      return Object.freeze({
        ...outcome.body,
        previousSegmentPeriod: Object.freeze({ ...outcome.body.previousSegmentPeriod }),
        segmentPeriod: Object.freeze({ ...outcome.body.segmentPeriod }),
        replayed: outcome.replayed,
      });
    } catch (error) {
      return translate(error);
    }
  }
}
