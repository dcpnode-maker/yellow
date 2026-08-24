import type { JsonValue, Tx } from "../../kernel";
import { RESERVATION_STATUSES, type ReservationStatus } from "./state-machine";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const CONFIRMATION_NO = /^[\x21-\x7e]{1,120}$/;
const MICROSECOND_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;
const BUSINESS_DATE = /^\d{4}-\d{2}-\d{2}$/;
const CURRENCY = /^[A-Z]{3}$/;

export interface FindReservationDetailInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly confirmationNo: string;
}

export interface ReservationDetailSegment {
  readonly segmentId: string;
  readonly sequence: number;
  readonly unitTypeId: string;
  readonly sellableUnitId: string | null;
  readonly from: string;
  readonly to: string;
  readonly adults: number;
  readonly childAges: readonly number[];
  readonly ratePlanId: string;
  readonly priceOverride: JsonValue | null;
  readonly status: "booked" | "in_house" | "departed" | "cancelled";
}

export interface ReservationDetailGuest {
  readonly partyId: string;
  readonly displayName: string;
  readonly role: "primary" | "accompanying" | "sharer";
  readonly sharePct: string | null;
}

export interface ReservationDetailFolio {
  readonly folioId: string;
  readonly accountId: string;
  readonly folioNo: string | null;
  readonly windowNo: number;
  readonly name: string | null;
  readonly status: "open" | "settled" | "closed";
}

export interface ReservationDetailAlert {
  readonly alertId: string;
  readonly code: string | null;
  readonly message: string;
  readonly showOn: "checkin" | "checkout" | "always";
  readonly active: boolean;
}

export interface ReservationDetailTravel {
  readonly travelId: string;
  readonly direction: "arrival" | "departure";
  readonly mode: "flight" | "train" | "bus" | "car" | "ferry" | "other" | null;
  readonly carrier: string | null;
  readonly serviceNo: string | null;
  readonly scheduledAt: string | null;
  readonly pickupRequested: boolean;
  readonly pickupTaskId: string | null;
  readonly notes: string | null;
}

export interface ReservationDetailFact {
  readonly factId: string;
  readonly entityType: "reservation" | "reservation_segment";
  readonly entityId: string;
  readonly factType: string;
  readonly validFrom: string;
  readonly validTo: string | null;
  readonly recordedAt: string;
  readonly businessDate: string;
  readonly actorId: string | null;
  readonly payload: JsonValue;
  readonly supersedes: string | null;
  readonly requestCorrelationId: string | null;
}

export interface ReservationDetailResult {
  readonly reservationId: string;
  readonly confirmationNo: string;
  readonly status: ReservationStatus;
  readonly primaryPartyId: string;
  readonly bookerPartyId: string | null;
  readonly groupId: string | null;
  readonly channelCode: string;
  readonly marketCode: string | null;
  readonly sourceCode: string | null;
  readonly originCode: string | null;
  readonly currency: string;
  readonly guaranteePolicyId: string | null;
  readonly eta: string | null;
  readonly etd: string | null;
  readonly notes: string | null;
  readonly createdAt: string;
  readonly cancelledAt: string | null;
  readonly cancelReason: string | null;
  readonly cancellationNo: string | null;
  readonly segments: readonly ReservationDetailSegment[];
  readonly guests: readonly ReservationDetailGuest[];
  readonly folios: readonly ReservationDetailFolio[];
  readonly alerts: readonly ReservationDetailAlert[];
  readonly travel: readonly ReservationDetailTravel[];
  readonly history: readonly ReservationDetailFact[];
}

interface ReservationRow {
  readonly id: string;
  readonly confirmation_no: string;
  readonly status: string;
  readonly primary_party: string;
  readonly booker_party: string | null;
  readonly group_id: string | null;
  readonly channel_code: string;
  readonly market_code: string | null;
  readonly source_code: string | null;
  readonly origin_code: string | null;
  readonly currency: string;
  readonly guarantee_policy: string | null;
  readonly eta: string | null;
  readonly etd: string | null;
  readonly notes: string | null;
  readonly created_at: string;
  readonly cancelled_at: string | null;
  readonly cancel_reason: string | null;
  readonly cancellation_no: string | null;
}

interface SegmentRow {
  readonly id: string;
  readonly seq: number;
  readonly unit_type_id: string;
  readonly sellable_unit_id: string | null;
  readonly from_at: string;
  readonly to_at: string;
  readonly adults: number;
  readonly children: JsonValue;
  readonly rate_plan_id: string;
  readonly price_override: JsonValue | null;
  readonly status: string;
}

interface GuestRow {
  readonly party_id: string;
  readonly display_name: string;
  readonly role: string;
  readonly share_pct: string | null;
}

interface FolioRow {
  readonly id: string;
  readonly account_id: string;
  readonly folio_no: string | null;
  readonly window_no: number;
  readonly name: string | null;
  readonly status: string;
}

interface AlertRow {
  readonly id: string;
  readonly code: string | null;
  readonly message: string;
  readonly show_on: string;
  readonly active: boolean;
}

interface TravelRow {
  readonly id: string;
  readonly direction: string;
  readonly mode: string | null;
  readonly carrier: string | null;
  readonly service_no: string | null;
  readonly scheduled_at: string | null;
  readonly pickup_requested: boolean;
  readonly pickup_task_id: string | null;
  readonly notes: string | null;
}

interface FactRow {
  readonly id: string;
  readonly entity_type: string;
  readonly entity_id: string;
  readonly fact_type: string;
  readonly valid_from: string;
  readonly valid_to: string | null;
  readonly recorded_at: string;
  readonly business_date: string;
  readonly actor_id: string | null;
  readonly payload: JsonValue;
  readonly supersedes: string | null;
}

export class ReservationDetailValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReservationDetailValidationError";
  }
}

export class ReservationDetailNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReservationDetailNotFoundError";
  }
}

export class ReservationDetailConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReservationDetailConflictError";
  }
}

function requireUuid(name: string, value: unknown): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new ReservationDetailValidationError(`${name} must be a UUID`);
  }
  return value;
}

function requirePlainInput(input: unknown): asserts input is Record<string, unknown> {
  if (typeof input !== "object" || input === null || Array.isArray(input) ||
      (Object.getPrototypeOf(input) !== Object.prototype && Object.getPrototypeOf(input) !== null) ||
      Object.getOwnPropertySymbols(input).length > 0) {
    throw new ReservationDetailValidationError("Reservation detail input must be a plain object");
  }
  const allowed = new Set(["tenantId", "propertyNode", "confirmationNo"]);
  const unsupported = Object.getOwnPropertyNames(input).filter((key) => !allowed.has(key)).sort();
  if (unsupported.length > 0) {
    throw new ReservationDetailValidationError(
      `Reservation detail input contains unsupported fields: ${unsupported.join(", ")}`,
    );
  }
}

function requireStoredUuid(name: string, value: string | null): string | null {
  if (value !== null && !UUID.test(value)) {
    throw new ReservationDetailConflictError(`Stored ${name} is invalid`);
  }
  return value;
}

function requireStoredInstant(name: string, value: string | null): string | null {
  if (value !== null && !MICROSECOND_UTC.test(value)) {
    throw new ReservationDetailConflictError(`Stored ${name} is invalid`);
  }
  return value;
}

function freezeJson(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return Object.freeze(value.map((item) => freezeJson(item)));
  }
  if (typeof value === "object" && value !== null) {
    const frozen: Record<string, JsonValue> = {};
    for (const [key, item] of Object.entries(value)) frozen[key] = freezeJson(item);
    return Object.freeze(frozen);
  }
  return value;
}

function reservationStatus(value: string): ReservationStatus {
  const found = RESERVATION_STATUSES.find((status) => status === value);
  if (!found) throw new ReservationDetailConflictError("Stored reservation status is invalid");
  return found;
}

function segmentStatus(value: string): ReservationDetailSegment["status"] {
  if (value === "booked" || value === "in_house" || value === "departed" || value === "cancelled") return value;
  throw new ReservationDetailConflictError("Stored reservation segment status is invalid");
}

function guestRole(value: string): ReservationDetailGuest["role"] {
  if (value === "primary" || value === "accompanying" || value === "sharer") return value;
  throw new ReservationDetailConflictError("Stored reservation guest role is invalid");
}

function folioStatus(value: string): ReservationDetailFolio["status"] {
  if (value === "open" || value === "settled" || value === "closed") return value;
  throw new ReservationDetailConflictError("Stored folio status is invalid");
}

function alertShowOn(value: string): ReservationDetailAlert["showOn"] {
  if (value === "checkin" || value === "checkout" || value === "always") return value;
  throw new ReservationDetailConflictError("Stored alert display rule is invalid");
}

function travelDirection(value: string): ReservationDetailTravel["direction"] {
  if (value === "arrival" || value === "departure") return value;
  throw new ReservationDetailConflictError("Stored travel direction is invalid");
}

function travelMode(value: string | null): ReservationDetailTravel["mode"] {
  if (value === null || value === "flight" || value === "train" || value === "bus" ||
      value === "car" || value === "ferry" || value === "other") return value;
  throw new ReservationDetailConflictError("Stored travel mode is invalid");
}

function childAges(value: JsonValue): readonly number[] {
  if (!Array.isArray(value)) throw new ReservationDetailConflictError("Stored segment children are invalid");
  return Object.freeze(value.map((child) => {
    if (typeof child !== "object" || child === null || Array.isArray(child) ||
        !("age" in child) || typeof child.age !== "number" || !Number.isInteger(child.age) ||
        child.age < 0 || child.age > 17) {
      throw new ReservationDetailConflictError("Stored segment child age is invalid");
    }
    return child.age;
  }));
}

function requestCorrelation(payload: JsonValue): string | null {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return null;
  const value = (payload as { readonly [key: string]: JsonValue }).request_id;
  return typeof value === "string" ? value : null;
}

export class ReservationDetailService {
  async findByConfirmation(tx: Tx, input: FindReservationDetailInput): Promise<ReservationDetailResult> {
    requirePlainInput(input);
    const tenantId = requireUuid("tenantId", input.tenantId);
    const propertyNode = requireUuid("propertyNode", input.propertyNode);
    if (typeof input.confirmationNo !== "string" || !CONFIRMATION_NO.test(input.confirmationNo)) {
      throw new ReservationDetailValidationError("confirmationNo must contain 1-120 visible characters");
    }

    const reservations = await tx<ReservationRow[]>`
      SELECT id, confirmation_no, status, primary_party, booker_party, group_id,
             channel_code, market_code, source_code, origin_code, currency,
             guarantee_policy, eta::text AS eta, etd::text AS etd, notes,
             to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS created_at,
             CASE WHEN cancelled_at IS NULL THEN NULL ELSE
               to_char(cancelled_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') END AS cancelled_at,
             cancel_reason, cancellation_no
      FROM reservation
      WHERE tenant_id = ${tenantId}::uuid
        AND tenant_id = current_setting('app.tenant_id', true)::uuid
        AND property_node = ${propertyNode}::uuid
        AND confirmation_no = ${input.confirmationNo}
    `;
    const reservation = reservations[0];
    if (!reservation) throw new ReservationDetailNotFoundError("Reservation was not found in the property");

    const segments = await tx<SegmentRow[]>`
      SELECT id, seq, unit_type_id, sellable_unit_id,
             to_char(lower(period) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS from_at,
             to_char(upper(period) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS to_at,
             adults, children, rate_plan_id, price_override, status
      FROM reservation_segment
      WHERE tenant_id = ${tenantId}::uuid
        AND reservation_id = ${reservation.id}::uuid
      ORDER BY seq, id
    `;
    const guests = await tx<GuestRow[]>`
      SELECT guest.party_id, party.display_name, guest.role, guest.share_pct::text
      FROM reservation_guest AS guest
      JOIN party
        ON party.tenant_id = guest.tenant_id
       AND party.id = guest.party_id
      WHERE guest.tenant_id = ${tenantId}::uuid
        AND guest.reservation_id = ${reservation.id}::uuid
      ORDER BY CASE guest.role WHEN 'primary' THEN 0 WHEN 'accompanying' THEN 1 ELSE 2 END,
               guest.party_id
    `;
    const folios = await tx<FolioRow[]>`
      SELECT folio.id, folio.account_id, folio.folio_no, folio.window_no, folio.name, folio.status
      FROM folio
      JOIN account
        ON account.tenant_id = folio.tenant_id
       AND account.id = folio.account_id
      WHERE folio.tenant_id = ${tenantId}::uuid
        AND folio.reservation_id = ${reservation.id}::uuid
        AND (account.property_node IS NULL OR account.property_node = ${propertyNode}::uuid)
      ORDER BY folio.window_no, folio.id
    `;
    const alerts = await tx<AlertRow[]>`
      SELECT id, code, message, show_on, active
      FROM alert
      WHERE tenant_id = ${tenantId}::uuid
        AND subject_type = 'reservation'
        AND subject_id = ${reservation.id}::uuid
      ORDER BY active DESC, code NULLS LAST, id
    `;
    const travel = await tx<TravelRow[]>`
      SELECT id, direction, mode, carrier, service_no,
             CASE WHEN scheduled_at IS NULL THEN NULL ELSE
               to_char(scheduled_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') END AS scheduled_at,
             pickup_requested, pickup_task_id, notes
      FROM travel_detail
      WHERE tenant_id = ${tenantId}::uuid
        AND reservation_id = ${reservation.id}::uuid
      ORDER BY CASE direction WHEN 'arrival' THEN 0 ELSE 1 END, id
    `;
    const history = await tx<FactRow[]>`
      SELECT fact.id, fact.entity_type, fact.entity_id, fact.fact_type,
             to_char(fact.valid_from AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS valid_from,
             CASE WHEN fact.valid_to IS NULL THEN NULL ELSE
               to_char(fact.valid_to AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') END AS valid_to,
             to_char(fact.recorded_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS recorded_at,
             fact.business_date::text, fact.actor_id,
             fact.payload, fact.supersedes
      FROM fact_log AS fact
      WHERE fact.tenant_id = ${tenantId}::uuid
        AND (
          (fact.entity_type = 'reservation' AND fact.entity_id = ${reservation.id}::uuid)
          OR (
            fact.entity_type = 'reservation_segment'
            AND fact.entity_id IN (
              SELECT segment.id
              FROM reservation_segment AS segment
              WHERE segment.tenant_id = ${tenantId}::uuid
                AND segment.reservation_id = ${reservation.id}::uuid
            )
          )
        )
      ORDER BY fact.recorded_at, fact.id
    `;

    return Object.freeze({
      reservationId: requireStoredUuid("reservation id", reservation.id)!,
      confirmationNo: reservation.confirmation_no,
      status: reservationStatus(reservation.status),
      primaryPartyId: requireStoredUuid("primary Party id", reservation.primary_party)!,
      bookerPartyId: requireStoredUuid("booker Party id", reservation.booker_party),
      groupId: requireStoredUuid("reservation group id", reservation.group_id),
      channelCode: reservation.channel_code,
      marketCode: reservation.market_code,
      sourceCode: reservation.source_code,
      originCode: reservation.origin_code,
      currency: CURRENCY.test(reservation.currency) ? reservation.currency : (() => {
        throw new ReservationDetailConflictError("Stored reservation currency is invalid");
      })(),
      guaranteePolicyId: requireStoredUuid("guarantee policy id", reservation.guarantee_policy),
      eta: reservation.eta,
      etd: reservation.etd,
      notes: reservation.notes,
      createdAt: requireStoredInstant("reservation creation time", reservation.created_at)!,
      cancelledAt: requireStoredInstant("reservation cancellation time", reservation.cancelled_at),
      cancelReason: reservation.cancel_reason,
      cancellationNo: reservation.cancellation_no,
      segments: Object.freeze(segments.map((segment) => Object.freeze({
        segmentId: requireStoredUuid("segment id", segment.id)!,
        sequence: segment.seq,
        unitTypeId: requireStoredUuid("segment unit type id", segment.unit_type_id)!,
        sellableUnitId: requireStoredUuid("segment sellable unit id", segment.sellable_unit_id),
        from: requireStoredInstant("segment start", segment.from_at)!,
        to: requireStoredInstant("segment end", segment.to_at)!,
        adults: segment.adults,
        childAges: childAges(segment.children),
        ratePlanId: requireStoredUuid("segment rate plan id", segment.rate_plan_id)!,
        priceOverride: segment.price_override === null ? null : freezeJson(segment.price_override),
        status: segmentStatus(segment.status),
      }))),
      guests: Object.freeze(guests.map((guest) => Object.freeze({
        partyId: requireStoredUuid("guest Party id", guest.party_id)!,
        displayName: guest.display_name,
        role: guestRole(guest.role),
        sharePct: guest.share_pct,
      }))),
      folios: Object.freeze(folios.map((folio) => Object.freeze({
        folioId: requireStoredUuid("folio id", folio.id)!,
        accountId: requireStoredUuid("folio account id", folio.account_id)!,
        folioNo: folio.folio_no,
        windowNo: folio.window_no,
        name: folio.name,
        status: folioStatus(folio.status),
      }))),
      alerts: Object.freeze(alerts.map((alert) => Object.freeze({
        alertId: requireStoredUuid("alert id", alert.id)!,
        code: alert.code,
        message: alert.message,
        showOn: alertShowOn(alert.show_on),
        active: alert.active,
      }))),
      travel: Object.freeze(travel.map((item) => Object.freeze({
        travelId: requireStoredUuid("travel id", item.id)!,
        direction: travelDirection(item.direction),
        mode: travelMode(item.mode),
        carrier: item.carrier,
        serviceNo: item.service_no,
        scheduledAt: requireStoredInstant("travel schedule", item.scheduled_at),
        pickupRequested: item.pickup_requested,
        pickupTaskId: requireStoredUuid("pickup task id", item.pickup_task_id),
        notes: item.notes,
      }))),
      history: Object.freeze(history.map((fact) => {
        if (fact.entity_type !== "reservation" && fact.entity_type !== "reservation_segment") {
          throw new ReservationDetailConflictError("Stored reservation history entity is invalid");
        }
        return Object.freeze({
          factId: requireStoredUuid("fact id", fact.id)!,
          entityType: fact.entity_type,
          entityId: fact.entity_id,
          factType: fact.fact_type,
          validFrom: requireStoredInstant("fact valid-from time", fact.valid_from)!,
          validTo: requireStoredInstant("fact valid-to time", fact.valid_to),
          recordedAt: requireStoredInstant("fact recorded time", fact.recorded_at)!,
          businessDate: BUSINESS_DATE.test(fact.business_date) ? fact.business_date : (() => {
            throw new ReservationDetailConflictError("Stored fact business date is invalid");
          })(),
          actorId: requireStoredUuid("fact actor id", fact.actor_id),
          payload: freezeJson(fact.payload),
          supersedes: requireStoredUuid("superseded fact id", fact.supersedes),
          requestCorrelationId: requestCorrelation(fact.payload),
        });
      })),
    });
  }
}
