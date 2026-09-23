import type { Database, Tx } from "../../kernel";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const INTEGER = /^-?(?:0|[1-9][0-9]*)$/;
const CURRENCY = /^[A-Z]{3}$/;

const RESERVATION_STATUSES = Object.freeze([
  "quote", "reserved", "waitlist", "due_in", "in_house", "due_out",
  "checked_out", "cancelled", "no_show",
] as const);

export const CHECKOUT_READINESS_BLOCKERS = Object.freeze([
  "reservation_not_departure_state",
  "current_segment_missing_or_ambiguous",
  "physical_room_missing_or_ambiguous",
  "occupancy_missing_or_ambiguous",
  "folio_window_missing",
  "folio_window_unsettled",
  "folio_window_nonzero",
] as const);

export type CheckoutReadinessBlocker = (typeof CHECKOUT_READINESS_BLOCKERS)[number];
type CheckoutReservationStatus = (typeof RESERVATION_STATUSES)[number];
type CheckoutFolioStatus = "open" | "settled" | "closed";

export interface CheckoutReadinessInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly reservationId: string;
}

interface CheckoutReadinessSegment {
  readonly segmentId: string;
  readonly sellableUnitId: string;
  readonly periodStart: string;
  readonly periodEnd: string;
}

interface CheckoutReadinessRoom {
  readonly spaceId: string;
  readonly spaceCode: string;
}

interface CheckoutReadinessOccupancy {
  readonly occupancyId: string;
  readonly periodStart: string;
  readonly periodEnd: string;
}

interface CheckoutReadinessFolio {
  readonly folioId: string;
  readonly folioNo: string | null;
  readonly windowNo: number;
  readonly name: string | null;
  readonly status: CheckoutFolioStatus;
  readonly currency: string;
  readonly balanceMinor: string;
}

export interface CheckoutReadiness {
  readonly reservationId: string;
  readonly reservationStatus: CheckoutReservationStatus;
  readonly ready: boolean;
  readonly blockers: readonly CheckoutReadinessBlocker[];
  readonly segment: CheckoutReadinessSegment | null;
  readonly room: CheckoutReadinessRoom | null;
  readonly occupancy: CheckoutReadinessOccupancy | null;
  readonly folios: readonly CheckoutReadinessFolio[];
}

interface CheckoutReadinessServiceOptions {
  readonly database: Database;
}

interface SnapshotRow {
  readonly reservation_id: string;
  readonly reservation_status: string;
  readonly segment_count: number;
  readonly segment_id: string | null;
  readonly sellable_unit_id: string | null;
  readonly segment_period_start: Date | null;
  readonly segment_period_end: Date | null;
  readonly room_count: number;
  readonly space_id: string | null;
  readonly space_code: string | null;
  readonly occupancy_count: number;
  readonly occupancy_id: string | null;
  readonly occupancy_period_start: Date | null;
  readonly occupancy_period_end: Date | null;
  readonly folio_id: string | null;
  readonly folio_no: string | null;
  readonly window_no: number | null;
  readonly folio_name: string | null;
  readonly folio_status: string | null;
  readonly currency: string | null;
  readonly balance_minor: string | null;
}

export class CheckoutReadinessValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CheckoutReadinessValidationError";
  }
}

export class CheckoutReadinessNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CheckoutReadinessNotFoundError";
  }
}

function requirePlainObject(value: unknown): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value) ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) ||
      Object.getOwnPropertySymbols(value).length !== 0) {
    throw new CheckoutReadinessValidationError("checkout readiness input must be a plain object");
  }
}

function requireUuid(value: unknown, subject: string): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new CheckoutReadinessValidationError(`${subject} must be a lowercase UUID`);
  }
  return value;
}

export function normalizeCheckoutReadinessInput(
  input: CheckoutReadinessInput,
): Readonly<CheckoutReadinessInput> {
  requirePlainObject(input);
  const keys = Object.getOwnPropertyNames(input).sort();
  const expected = ["propertyNode", "reservationId", "tenantId"];
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    throw new CheckoutReadinessValidationError("checkout readiness input shape is invalid");
  }
  return Object.freeze({
    tenantId: requireUuid(input.tenantId, "tenantId"),
    propertyNode: requireUuid(input.propertyNode, "propertyNode"),
    reservationId: requireUuid(input.reservationId, "reservationId"),
  });
}

function reservationStatus(value: string): CheckoutReservationStatus {
  if ((RESERVATION_STATUSES as readonly string[]).includes(value)) {
    return value as CheckoutReservationStatus;
  }
  throw new Error("PostgreSQL returned an unsupported reservation status");
}

function folioStatus(value: string): CheckoutFolioStatus {
  if (value === "open" || value === "settled" || value === "closed") return value;
  throw new Error("PostgreSQL returned an unsupported folio status");
}

function iso(value: Date | null, subject: string): string {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new Error(`PostgreSQL returned an invalid ${subject}`);
  }
  return value.toISOString();
}

function addBlocker(
  blockers: CheckoutReadinessBlocker[],
  blocker: CheckoutReadinessBlocker,
): void {
  if (!blockers.includes(blocker)) blockers.push(blocker);
}

function canonicalFolio(row: SnapshotRow): CheckoutReadinessFolio | null {
  if (row.folio_id === null) return null;
  if (!UUID.test(row.folio_id) || !Number.isSafeInteger(row.window_no) || row.window_no === null ||
      row.window_no < 1 || row.window_no > 20 || row.folio_status === null ||
      row.currency === null || !CURRENCY.test(row.currency) || row.balance_minor === null ||
      !INTEGER.test(row.balance_minor)) {
    throw new Error("PostgreSQL returned a non-canonical reservation folio window");
  }
  return Object.freeze({
    folioId: row.folio_id,
    folioNo: row.folio_no,
    windowNo: row.window_no,
    name: row.folio_name,
    status: folioStatus(row.folio_status),
    currency: row.currency,
    balanceMinor: row.balance_minor,
  });
}

function snapshot(rows: readonly SnapshotRow[]): CheckoutReadiness {
  const first = rows[0];
  if (!first) throw new CheckoutReadinessNotFoundError("Reservation was not found in the active property");
  if (!UUID.test(first.reservation_id) || rows.some((row) =>
    row.reservation_id !== first.reservation_id ||
    row.reservation_status !== first.reservation_status ||
    row.segment_count !== first.segment_count || row.segment_id !== first.segment_id ||
    row.sellable_unit_id !== first.sellable_unit_id || row.room_count !== first.room_count ||
    row.space_id !== first.space_id || row.space_code !== first.space_code ||
    row.occupancy_count !== first.occupancy_count || row.occupancy_id !== first.occupancy_id
  )) {
    throw new Error("PostgreSQL returned an inconsistent checkout readiness snapshot");
  }

  const status = reservationStatus(first.reservation_status);
  const segment = first.segment_count === 1 && first.segment_id !== null &&
      first.sellable_unit_id !== null
    ? Object.freeze({
        segmentId: first.segment_id,
        sellableUnitId: first.sellable_unit_id,
        periodStart: iso(first.segment_period_start, "segment period start"),
        periodEnd: iso(first.segment_period_end, "segment period end"),
      })
    : null;
  const room = first.room_count === 1 && first.space_id !== null && first.space_code !== null
    ? Object.freeze({ spaceId: first.space_id, spaceCode: first.space_code })
    : null;
  const occupancy = first.occupancy_count === 1 && first.occupancy_id !== null
    ? Object.freeze({
        occupancyId: first.occupancy_id,
        periodStart: iso(first.occupancy_period_start, "occupancy period start"),
        periodEnd: iso(first.occupancy_period_end, "occupancy period end"),
      })
    : null;
  const folios = Object.freeze(rows.map(canonicalFolio).filter(
    (folio): folio is CheckoutReadinessFolio => folio !== null,
  ));

  const blockers: CheckoutReadinessBlocker[] = [];
  if (status !== "in_house" && status !== "due_out") {
    addBlocker(blockers, "reservation_not_departure_state");
  }
  if (first.segment_count !== 1) addBlocker(blockers, "current_segment_missing_or_ambiguous");
  if (first.room_count !== 1) addBlocker(blockers, "physical_room_missing_or_ambiguous");
  if (first.occupancy_count !== 1) addBlocker(blockers, "occupancy_missing_or_ambiguous");
  if (folios.length === 0) addBlocker(blockers, "folio_window_missing");
  if (folios.some((folio) => folio.status !== "settled" && folio.status !== "closed")) {
    addBlocker(blockers, "folio_window_unsettled");
  }
  if (folios.some((folio) => BigInt(folio.balanceMinor) !== 0n)) {
    addBlocker(blockers, "folio_window_nonzero");
  }

  return Object.freeze({
    reservationId: first.reservation_id,
    reservationStatus: status,
    ready: blockers.length === 0,
    blockers: Object.freeze(blockers),
    segment,
    room,
    occupancy,
    folios,
  });
}

export class CheckoutReadinessService {
  readonly #database: Database;

  constructor(options: CheckoutReadinessServiceOptions) {
    this.#database = options.database;
  }

  async read(input: CheckoutReadinessInput): Promise<CheckoutReadiness> {
    const normalized = normalizeCheckoutReadinessInput(input);
    try {
      return await this.#database.withTenantTransaction(
        normalized.tenantId,
        (tx) => loadCheckoutReadiness(tx, normalized),
      );
    } catch (error) {
      const state = (error as { errno?: unknown; code?: unknown }).errno ??
        (error as { errno?: unknown; code?: unknown }).code;
      if (state === "42501") {
        throw new CheckoutReadinessNotFoundError("Reservation was not found in the active property");
      }
      throw error;
    }
  }
}

/** Internal command reuse; callers must already be inside the tenant transaction. */
export async function loadCheckoutReadiness(
  tx: Tx,
  input: CheckoutReadinessInput,
): Promise<CheckoutReadiness> {
  const normalized = normalizeCheckoutReadinessInput(input);
  const rows = await tx<SnapshotRow[]>`
        WITH target_reservation AS MATERIALIZED (
          SELECT reservation.id, reservation.status
          FROM public.reservation
          JOIN public.org_node AS property
            ON property.tenant_id = reservation.tenant_id
           AND property.id = reservation.property_node
           AND property.kind = 'property'
          WHERE reservation.tenant_id = ${normalized.tenantId}::uuid
            AND reservation.tenant_id = current_setting('app.tenant_id', true)::uuid
            AND reservation.property_node = ${normalized.propertyNode}::uuid
            AND reservation.id = ${normalized.reservationId}::uuid
        ),
        current_segments AS MATERIALIZED (
          SELECT segment.id, segment.sellable_unit_id,
                 lower(segment.period) AS period_start, upper(segment.period) AS period_end,
                 segment.period
          FROM public.reservation_segment AS segment
          JOIN target_reservation AS reservation ON reservation.id = segment.reservation_id
          WHERE segment.tenant_id = ${normalized.tenantId}::uuid
            AND segment.tenant_id = current_setting('app.tenant_id', true)::uuid
            AND segment.status = 'in_house'
        ),
        one_segment AS MATERIALIZED (
          SELECT * FROM current_segments
          WHERE (SELECT count(*) FROM current_segments) = 1
        ),
        physical_rooms AS MATERIALIZED (
          SELECT space.id, space.code
          FROM one_segment AS segment
          JOIN public.sellable_unit AS sellable
            ON sellable.tenant_id = ${normalized.tenantId}::uuid
           AND sellable.id = segment.sellable_unit_id
           AND sellable.status = 'active'
          JOIN public.sellable_unit_space AS mapping
            ON mapping.tenant_id = sellable.tenant_id
           AND mapping.sellable_unit_id = sellable.id
          JOIN public.space
            ON space.tenant_id = mapping.tenant_id
           AND space.id = mapping.space_id
           AND space.property_node = ${normalized.propertyNode}::uuid
           AND space.status = 'active'
        ),
        one_room AS MATERIALIZED (
          SELECT * FROM physical_rooms
          WHERE (SELECT count(*) FROM physical_rooms) = 1
        ),
        matching_occupancies AS MATERIALIZED (
          SELECT occupancy.id, lower(occupancy.period) AS period_start,
                 upper(occupancy.period) AS period_end
          FROM one_segment AS segment
          CROSS JOIN one_room AS room
          JOIN public.space_occupancy AS occupancy
            ON occupancy.tenant_id = ${normalized.tenantId}::uuid
           AND occupancy.tenant_id = current_setting('app.tenant_id', true)::uuid
           AND occupancy.slot_kind = 'segment'
           AND occupancy.slot_ref = segment.id
           AND occupancy.space_id = room.id
           AND occupancy.exclusive = true
           AND occupancy.period = segment.period
        ),
        reservation_folios AS MATERIALIZED (
          SELECT folio.id, folio.folio_no, folio.window_no::int, folio.name,
                 folio.status, account.currency::text AS currency,
                 COALESCE(balance.balance_minor, 0)::text AS balance_minor
          FROM target_reservation AS reservation
          JOIN public.folio
            ON folio.tenant_id = ${normalized.tenantId}::uuid
           AND folio.tenant_id = current_setting('app.tenant_id', true)::uuid
           AND folio.reservation_id = reservation.id
          JOIN public.account
            ON account.tenant_id = folio.tenant_id
           AND account.id = folio.account_id
          LEFT JOIN public.folio_balance AS balance
            ON balance.tenant_id = folio.tenant_id
           AND balance.folio_id = folio.id
        )
        SELECT
          reservation.id AS reservation_id,
          reservation.status AS reservation_status,
          (SELECT count(*)::int FROM current_segments) AS segment_count,
          segment.id AS segment_id,
          segment.sellable_unit_id,
          segment.period_start AS segment_period_start,
          segment.period_end AS segment_period_end,
          (SELECT count(*)::int FROM physical_rooms) AS room_count,
          room.id AS space_id,
          room.code AS space_code,
          (SELECT count(*)::int FROM matching_occupancies) AS occupancy_count,
          occupancy.id AS occupancy_id,
          occupancy.period_start AS occupancy_period_start,
          occupancy.period_end AS occupancy_period_end,
          folio.id AS folio_id,
          folio.folio_no,
          folio.window_no,
          folio.name AS folio_name,
          folio.status AS folio_status,
          folio.currency,
          folio.balance_minor
        FROM target_reservation AS reservation
        LEFT JOIN one_segment AS segment ON true
        LEFT JOIN one_room AS room ON true
        LEFT JOIN matching_occupancies AS occupancy ON true
        LEFT JOIN reservation_folios AS folio ON true
        ORDER BY folio.window_no NULLS LAST, folio.id NULLS LAST
  `;
  return snapshot(rows);
}
