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

export interface FindReservationDetailByIdInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly reservationId: string;
}

export interface FindReservationPickupTaskDetailInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly reservationId: string;
  readonly taskId: string;
}

export type ReservationPickupTaskStatus =
  | "open"
  | "assigned"
  | "in_progress"
  | "done"
  | "verified"
  | "cancelled";

export interface ReservationPickupTaskDetail {
  readonly taskId: string;
  readonly reservationId: string;
  readonly confirmationNo: string;
  readonly status: ReservationPickupTaskStatus;
  readonly dueAt: string;
  readonly priority: number;
  readonly createdAt: string;
  readonly completedAt: string | null;
  readonly assigneePartyId: string | null;
  readonly eligibleAction: "assign" | "start" | "complete" | null;
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
  readonly visible_property_id: string | null;
  readonly visible_primary_party_id: string | null;
  readonly visible_booker_party_id: string | null;
  readonly visible_group_id: string | null;
  readonly visible_guarantee_policy_id: string | null;
}

interface SegmentRow {
  readonly id: string;
  readonly seq: number;
  readonly unit_type_id: string;
  readonly sellable_unit_id: string | null;
  readonly from_at: string | null;
  readonly to_at: string | null;
  readonly adults: number;
  readonly children: JsonValue;
  readonly rate_plan_id: string;
  readonly price_override: JsonValue | null;
  readonly status: string;
  readonly period_nonempty: boolean;
  readonly period_lower_inclusive: boolean;
  readonly period_upper_inclusive: boolean;
  readonly period_lower_finite: boolean;
  readonly period_upper_finite: boolean;
  readonly visible_unit_type_id: string | null;
  readonly visible_sellable_unit_id: string | null;
  readonly visible_rate_plan_id: string | null;
}

interface GuestRow {
  readonly party_id: string;
  readonly display_name: string | null;
  readonly role: string;
  readonly share_pct: string | null;
  readonly visible_party_id: string | null;
}

interface FolioRow {
  readonly id: string;
  readonly account_id: string;
  readonly folio_no: string | null;
  readonly window_no: number;
  readonly name: string | null;
  readonly status: string;
  readonly visible_account_id: string | null;
  readonly account_property_node: string | null;
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
  readonly visible_pickup_task_id: string | null;
}

interface PickupTaskDetailRow {
  readonly reservation_id: string;
  readonly confirmation_no: string;
  readonly arrival_travel_id: string | null;
  readonly pickup_task_id: string | null;
  readonly arrival_scheduled_at: string | null;
  readonly task_id: string | null;
  readonly task_property_node: string | null;
  readonly task_kind: string | null;
  readonly task_status: string | null;
  readonly task_subject_type: string | null;
  readonly task_subject_id: string | null;
  readonly task_department: string | null;
  readonly task_due_at: string | null;
  readonly task_priority: number | null;
  readonly task_payload: JsonValue | null;
  readonly task_created_at: string | null;
  readonly task_completed_at: string | null;
  readonly task_assignee_party: string | null;
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
  readonly visible_supersedes_id: string | null;
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

function requirePlainInput(input: unknown, allowedFields: readonly string[]): asserts input is Record<string, unknown> {
  if (typeof input !== "object" || input === null || Array.isArray(input) ||
      (Object.getPrototypeOf(input) !== Object.prototype && Object.getPrototypeOf(input) !== null) ||
      Object.getOwnPropertySymbols(input).length > 0) {
    throw new ReservationDetailValidationError("Reservation detail input must be a plain object");
  }
  const allowed = new Set(allowedFields);
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

function requireStoredRequiredInstant(name: string, value: string | null): string {
  const instant = requireStoredInstant(name, value);
  if (instant === null) {
    throw new ReservationDetailConflictError(`Stored ${name} is missing`);
  }
  return instant;
}

function requireCoherentReference(name: string, stored: string | null, visible: string | null): void {
  if (stored !== visible) {
    throw new ReservationDetailConflictError(`Stored ${name} reference is incoherent`);
  }
}

function requireCanonicalSegmentPeriod(segment: SegmentRow): void {
  if (!segment.period_nonempty || !segment.period_lower_finite || !segment.period_upper_finite ||
      !segment.period_lower_inclusive || segment.period_upper_inclusive) {
    throw new ReservationDetailConflictError("Stored segment period must be a finite, non-empty [) range");
  }
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

function pickupTaskStatus(value: string | null): ReservationPickupTaskStatus {
  if (value === "open" || value === "assigned" || value === "in_progress" || value === "done" ||
      value === "verified" || value === "cancelled") return value;
  throw new ReservationDetailConflictError("Stored arrival pickup task status is invalid");
}

function pickupTaskEligibleAction(
  status: ReservationPickupTaskStatus,
  assigneePartyId: string | null,
): ReservationPickupTaskDetail["eligibleAction"] {
  if (status === "open" && assigneePartyId === null) return "assign";
  if (status === "assigned" && assigneePartyId !== null) return "start";
  if (status === "in_progress" && assigneePartyId !== null) return "complete";
  return null;
}

function isArrivalPickupPayload(value: JsonValue | null): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const payload = value as { readonly [key: string]: JsonValue };
  return Object.keys(payload).length === 1 && payload.requestType === "arrival_pickup";
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
    requirePlainInput(input, ["tenantId", "propertyNode", "confirmationNo"]);
    const tenantId = requireUuid("tenantId", input.tenantId);
    const propertyNode = requireUuid("propertyNode", input.propertyNode);
    if (typeof input.confirmationNo !== "string" || !CONFIRMATION_NO.test(input.confirmationNo)) {
      throw new ReservationDetailValidationError("confirmationNo must contain 1-120 visible characters");
    }

    return this.find(tx, tenantId, propertyNode, null, input.confirmationNo);
  }

  async findById(tx: Tx, input: FindReservationDetailByIdInput): Promise<ReservationDetailResult> {
    requirePlainInput(input, ["tenantId", "propertyNode", "reservationId"]);
    const tenantId = requireUuid("tenantId", input.tenantId);
    const propertyNode = requireUuid("propertyNode", input.propertyNode);
    const reservationId = requireUuid("reservationId", input.reservationId);
    return this.find(tx, tenantId, propertyNode, reservationId, null);
  }

  async pickupTaskDetail(
    tx: Tx,
    input: FindReservationPickupTaskDetailInput,
  ): Promise<ReservationPickupTaskDetail> {
    requirePlainInput(input, ["tenantId", "propertyNode", "reservationId", "taskId"]);
    const tenantId = requireUuid("tenantId", input.tenantId);
    const propertyNode = requireUuid("propertyNode", input.propertyNode);
    const reservationId = requireUuid("reservationId", input.reservationId);
    const taskId = requireUuid("taskId", input.taskId);

    const rows = await tx<PickupTaskDetailRow[]>`
      SELECT reservation.id AS reservation_id, reservation.confirmation_no,
             arrival.id AS arrival_travel_id, arrival.pickup_task_id,
             CASE WHEN arrival.scheduled_at IS NULL THEN NULL ELSE
               to_char(arrival.scheduled_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
             END AS arrival_scheduled_at,
             pickup_task.id AS task_id, pickup_task.property_node AS task_property_node,
             pickup_task.kind AS task_kind, pickup_task.status AS task_status,
             pickup_task.subject_type AS task_subject_type, pickup_task.subject_id AS task_subject_id,
             pickup_task.department AS task_department,
             CASE WHEN pickup_task.due_at IS NULL THEN NULL ELSE
               to_char(pickup_task.due_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
             END AS task_due_at,
             pickup_task.priority AS task_priority, pickup_task.payload AS task_payload,
             pickup_task.assignee_party AS task_assignee_party,
             CASE WHEN pickup_task.created_at IS NULL THEN NULL ELSE
               to_char(pickup_task.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
             END AS task_created_at,
             CASE WHEN pickup_task.completed_at IS NULL THEN NULL ELSE
               to_char(pickup_task.completed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
             END AS task_completed_at
      FROM reservation
      JOIN org_node AS property
        ON property.tenant_id = reservation.tenant_id
       AND property.id = reservation.property_node
       AND property.kind = 'property'
      LEFT JOIN travel_detail AS arrival
        ON arrival.tenant_id = reservation.tenant_id
       AND arrival.reservation_id = reservation.id
       AND arrival.direction = 'arrival'
      LEFT JOIN task AS pickup_task
        ON pickup_task.tenant_id = reservation.tenant_id
       AND pickup_task.id = arrival.pickup_task_id
      WHERE reservation.tenant_id = ${tenantId}::uuid
        AND reservation.tenant_id = current_setting('app.tenant_id', true)::uuid
        AND reservation.property_node = ${propertyNode}::uuid
        AND reservation.id = ${reservationId}::uuid
    `;
    const row = rows[0];
    if (!row || row.arrival_travel_id === null || row.pickup_task_id !== taskId) {
      throw new ReservationDetailNotFoundError("Arrival pickup task was not found for the reservation");
    }
    if (rows.length !== 1 || row.task_id === null || row.task_id !== taskId ||
        row.task_property_node !== propertyNode || row.task_kind !== "guest_request" ||
        row.task_subject_type !== "reservation" || row.task_subject_id !== reservationId ||
        row.task_department !== "transport" || row.task_priority !== 3 ||
        !isArrivalPickupPayload(row.task_payload)) {
      throw new ReservationDetailConflictError("Stored arrival pickup task link is incoherent");
    }
    const arrivalScheduledAt = requireStoredRequiredInstant(
      "arrival pickup schedule",
      row.arrival_scheduled_at,
    );
    const dueAt = requireStoredRequiredInstant("arrival pickup task due time", row.task_due_at);
    if (dueAt !== arrivalScheduledAt) {
      throw new ReservationDetailConflictError("Stored arrival pickup task due time is incoherent");
    }
    if (!CONFIRMATION_NO.test(row.confirmation_no)) {
      throw new ReservationDetailConflictError("Stored reservation confirmation number is invalid");
    }

    const status = pickupTaskStatus(row.task_status);
    const assigneePartyId = requireStoredUuid(
      "arrival pickup task assignee Party id",
      row.task_assignee_party,
    );
    return Object.freeze({
      taskId: requireStoredUuid("arrival pickup task id", row.task_id)!,
      reservationId: requireStoredUuid("reservation id", row.reservation_id)!,
      confirmationNo: row.confirmation_no,
      status,
      dueAt,
      priority: row.task_priority,
      createdAt: requireStoredRequiredInstant("arrival pickup task creation time", row.task_created_at),
      completedAt: requireStoredInstant("arrival pickup task completion time", row.task_completed_at),
      assigneePartyId,
      eligibleAction: pickupTaskEligibleAction(status, assigneePartyId),
    });
  }

  private async find(
    tx: Tx,
    tenantId: string,
    propertyNode: string,
    reservationId: string | null,
    confirmationNo: string | null,
  ): Promise<ReservationDetailResult> {
    const reservations = await tx<ReservationRow[]>`
      SELECT reservation.id, reservation.confirmation_no, reservation.status,
             reservation.primary_party, reservation.booker_party, reservation.group_id,
             reservation.channel_code, reservation.market_code, reservation.source_code,
             reservation.origin_code, reservation.currency, reservation.guarantee_policy,
             reservation.eta::text AS eta, reservation.etd::text AS etd, reservation.notes,
             to_char(reservation.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS created_at,
             CASE WHEN reservation.cancelled_at IS NULL THEN NULL ELSE
               to_char(reservation.cancelled_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') END AS cancelled_at,
             reservation.cancel_reason, reservation.cancellation_no,
             property.id AS visible_property_id,
             primary_party.id AS visible_primary_party_id,
             booker_party.id AS visible_booker_party_id,
             reservation_group.id AS visible_group_id,
             guarantee_policy.id AS visible_guarantee_policy_id
      FROM reservation
      LEFT JOIN org_node AS property
        ON property.tenant_id = reservation.tenant_id
       AND property.id = reservation.property_node
       AND property.kind = 'property'
      LEFT JOIN party AS primary_party
        ON primary_party.tenant_id = reservation.tenant_id
       AND primary_party.id = reservation.primary_party
      LEFT JOIN party AS booker_party
        ON booker_party.tenant_id = reservation.tenant_id
       AND booker_party.id = reservation.booker_party
      LEFT JOIN reservation_group
        ON reservation_group.tenant_id = reservation.tenant_id
       AND reservation_group.id = reservation.group_id
       AND reservation_group.property_node = reservation.property_node
      LEFT JOIN policy AS guarantee_policy
        ON guarantee_policy.tenant_id = reservation.tenant_id
       AND guarantee_policy.id = reservation.guarantee_policy
       AND guarantee_policy.kind = 'guarantee'
      WHERE reservation.tenant_id = ${tenantId}::uuid
        AND reservation.tenant_id = current_setting('app.tenant_id', true)::uuid
        AND reservation.property_node = ${propertyNode}::uuid
        AND ((${reservationId}::uuid IS NOT NULL AND reservation.id = ${reservationId}::uuid)
          OR (${confirmationNo}::text IS NOT NULL AND reservation.confirmation_no = ${confirmationNo}::text))
    `;
    const reservation = reservations[0];
    if (!reservation) throw new ReservationDetailNotFoundError("Reservation was not found in the property");

    const segments = await tx<SegmentRow[]>`
      SELECT segment.id, segment.seq, segment.unit_type_id, segment.sellable_unit_id,
             to_char(lower(segment.period) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS from_at,
             to_char(upper(segment.period) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS to_at,
             segment.adults, segment.children, segment.rate_plan_id, segment.price_override, segment.status,
             NOT isempty(segment.period) AS period_nonempty,
             lower_inc(segment.period) AS period_lower_inclusive,
             upper_inc(segment.period) AS period_upper_inclusive,
             NOT lower_inf(segment.period) AS period_lower_finite,
             NOT upper_inf(segment.period) AS period_upper_finite,
             unit_type.id AS visible_unit_type_id,
             sellable_unit.id AS visible_sellable_unit_id,
             rate_plan.id AS visible_rate_plan_id
      FROM reservation_segment AS segment
      LEFT JOIN unit_type
        ON unit_type.tenant_id = segment.tenant_id
       AND unit_type.id = segment.unit_type_id
       AND unit_type.property_node = ${propertyNode}::uuid
      LEFT JOIN sellable_unit
        ON sellable_unit.tenant_id = segment.tenant_id
       AND sellable_unit.id = segment.sellable_unit_id
       AND sellable_unit.unit_type_id = segment.unit_type_id
      LEFT JOIN rate_plan
        ON rate_plan.tenant_id = segment.tenant_id
       AND rate_plan.id = segment.rate_plan_id
       AND rate_plan.property_node = ${propertyNode}::uuid
      WHERE segment.tenant_id = ${tenantId}::uuid
        AND segment.reservation_id = ${reservation.id}::uuid
      ORDER BY segment.seq, segment.id
    `;
    const guests = await tx<GuestRow[]>`
      SELECT guest.party_id, party.display_name, guest.role, guest.share_pct::text,
             party.id AS visible_party_id
      FROM reservation_guest AS guest
      LEFT JOIN party
        ON party.tenant_id = guest.tenant_id
       AND party.id = guest.party_id
      WHERE guest.tenant_id = ${tenantId}::uuid
        AND guest.reservation_id = ${reservation.id}::uuid
      ORDER BY CASE guest.role WHEN 'primary' THEN 0 WHEN 'accompanying' THEN 1 ELSE 2 END,
               guest.party_id
    `;
    const folios = await tx<FolioRow[]>`
      SELECT folio.id, folio.account_id, folio.folio_no, folio.window_no, folio.name, folio.status,
             account.id AS visible_account_id, account.property_node AS account_property_node
      FROM folio
      LEFT JOIN account
        ON account.tenant_id = folio.tenant_id
       AND account.id = folio.account_id
      WHERE folio.tenant_id = ${tenantId}::uuid
        AND folio.reservation_id = ${reservation.id}::uuid
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
      SELECT travel.id, travel.direction, travel.mode, travel.carrier, travel.service_no,
             CASE WHEN travel.scheduled_at IS NULL THEN NULL ELSE
               to_char(travel.scheduled_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') END AS scheduled_at,
             travel.pickup_requested, travel.pickup_task_id, travel.notes,
             pickup_task.id AS visible_pickup_task_id
      FROM travel_detail AS travel
      LEFT JOIN task AS pickup_task
        ON pickup_task.tenant_id = travel.tenant_id
       AND pickup_task.id = travel.pickup_task_id
       AND pickup_task.property_node = ${propertyNode}::uuid
      WHERE travel.tenant_id = ${tenantId}::uuid
        AND travel.reservation_id = ${reservation.id}::uuid
      ORDER BY CASE travel.direction WHEN 'arrival' THEN 0 ELSE 1 END, travel.id
    `;
    const history = await tx<FactRow[]>`
      SELECT fact.id, fact.entity_type, fact.entity_id, fact.fact_type,
             to_char(fact.valid_from AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS valid_from,
             CASE WHEN fact.valid_to IS NULL THEN NULL ELSE
               to_char(fact.valid_to AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') END AS valid_to,
             to_char(fact.recorded_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS recorded_at,
             fact.business_date::text, fact.actor_id,
             fact.payload, fact.supersedes, predecessor.id AS visible_supersedes_id
      FROM fact_log AS fact
      LEFT JOIN fact_log AS predecessor
        ON predecessor.tenant_id = fact.tenant_id
       AND predecessor.id = fact.supersedes
       AND predecessor.entity_type = fact.entity_type
       AND predecessor.entity_id = fact.entity_id
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

    requireCoherentReference("reservation property", propertyNode, reservation.visible_property_id);
    requireCoherentReference("reservation primary Party", reservation.primary_party,
      reservation.visible_primary_party_id);
    requireCoherentReference("reservation booker Party", reservation.booker_party,
      reservation.visible_booker_party_id);
    requireCoherentReference("reservation group", reservation.group_id, reservation.visible_group_id);
    requireCoherentReference("reservation guarantee policy", reservation.guarantee_policy,
      reservation.visible_guarantee_policy_id);

    for (const segment of segments) {
      requireCanonicalSegmentPeriod(segment);
      requireCoherentReference("segment unit type", segment.unit_type_id, segment.visible_unit_type_id);
      requireCoherentReference("segment sellable unit", segment.sellable_unit_id,
        segment.visible_sellable_unit_id);
      requireCoherentReference("segment rate plan", segment.rate_plan_id, segment.visible_rate_plan_id);
    }
    for (const guest of guests) {
      requireCoherentReference("reservation guest Party", guest.party_id, guest.visible_party_id);
      if (guest.display_name === null) {
        throw new ReservationDetailConflictError("Stored reservation guest Party is missing");
      }
    }
    const primaryGuests = guests.filter((guest) => guest.role === "primary" &&
      guest.party_id === reservation.primary_party);
    if (primaryGuests.length !== 1 || guests.some((guest) =>
      guest.role === "primary" && guest.party_id !== reservation.primary_party)) {
      throw new ReservationDetailConflictError("Stored reservation primary guest membership is incoherent");
    }
    for (const folio of folios) {
      requireCoherentReference("folio account", folio.account_id, folio.visible_account_id);
      if (folio.account_property_node !== propertyNode) {
        throw new ReservationDetailConflictError("Stored folio account property is incoherent");
      }
    }
    for (const item of travel) {
      requireCoherentReference("travel pickup task", item.pickup_task_id, item.visible_pickup_task_id);
    }
    for (const fact of history) {
      requireCoherentReference("fact predecessor", fact.supersedes, fact.visible_supersedes_id);
    }

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
        from: requireStoredRequiredInstant("segment start", segment.from_at),
        to: requireStoredRequiredInstant("segment end", segment.to_at),
        adults: segment.adults,
        childAges: childAges(segment.children),
        ratePlanId: requireStoredUuid("segment rate plan id", segment.rate_plan_id)!,
        priceOverride: segment.price_override === null ? null : freezeJson(segment.price_override),
        status: segmentStatus(segment.status),
      }))),
      guests: Object.freeze(guests.map((guest) => Object.freeze({
        partyId: requireStoredUuid("guest Party id", guest.party_id)!,
        displayName: guest.display_name!,
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
