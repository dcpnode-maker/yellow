import type { Tx } from "../../kernel";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MICROSECOND_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;

export interface GroupBlockWorkbenchInput {
  readonly tenantId: string;
  readonly propertyNode: string;
}

export interface GroupBlockAllotmentRow {
  readonly unitTypeId: string;
  readonly unitTypeCode: string;
  readonly unitTypeName: string;
  readonly stayDate: string;
  readonly blocked: number;
  readonly pickedUp: number;
  readonly remaining: number;
  readonly rateOverride: unknown | null;
}

export interface GroupBlockRoomingListRow {
  readonly reservationId: string;
  readonly confirmationNo: string;
  readonly primaryGuestDisplayName: string;
  readonly status: string;
  readonly unitTypeCode: string | null;
  readonly unitTypeName: string | null;
  readonly stayFrom: string;
  readonly stayTo: string;
  readonly pickedUpNights: number;
}

export interface GroupBlockSummary {
  readonly groupId: string;
  readonly code: string;
  readonly name: string | null;
  readonly status: string;
  readonly statusDeductsInventory: boolean;
  readonly accountPartyId: string | null;
  readonly accountPartyName: string | null;
  readonly cutoffDate: string | null;
  readonly elastic: boolean;
  readonly washSchedule: unknown | null;
  readonly masterFolioId: string | null;
  readonly masterFolioNo: string | null;
  readonly masterFolioStatus: string | null;
  readonly arrivalDate: string | null;
  readonly departureDate: string | null;
  readonly blockedRooms: number;
  readonly pickedUpRooms: number;
  readonly remainingRooms: number;
  readonly pickupPercent: number;
  readonly cutoffState: "future" | "due_today" | "past_due" | "not_set";
  readonly allotment: readonly GroupBlockAllotmentRow[];
  readonly roomingList: readonly GroupBlockRoomingListRow[];
}

export interface GroupBlockWorkbench {
  readonly groups: readonly GroupBlockSummary[];
}

interface SqlGroupRow {
  readonly group_id: string;
  readonly code: string;
  readonly name: string | null;
  readonly status: string;
  readonly status_deducts_inventory: boolean | null;
  readonly account_party_id: string | null;
  readonly account_party_name: string | null;
  readonly cutoff_date: string | null;
  readonly elastic: boolean;
  readonly wash_schedule: unknown | null;
  readonly master_folio_id: string | null;
  readonly master_folio_no: string | null;
  readonly master_folio_status: string | null;
  readonly arrival_date: string | null;
  readonly departure_date: string | null;
  readonly blocked_rooms: number;
  readonly picked_up_rooms: number;
  readonly remaining_rooms: number;
  readonly pickup_percent: number;
  readonly cutoff_state: string;
  readonly allotment: unknown;
  readonly rooming_list: unknown;
}

function validate(input: GroupBlockWorkbenchInput): GroupBlockWorkbenchInput {
  if (typeof input !== "object" || input === null || Array.isArray(input) ||
      (Object.getPrototypeOf(input) !== Object.prototype && Object.getPrototypeOf(input) !== null) ||
      Object.getOwnPropertySymbols(input).length > 0 ||
      !UUID.test(input.tenantId) || !UUID.test(input.propertyNode)) {
    throw new GroupBlockValidationError("Group block input is invalid");
  }
  return input;
}

function assertDate(value: string | null, name: string): string | null {
  if (value === null) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new GroupBlockConflictError(`Stored group block ${name} is invalid`);
  }
  return value;
}

function assertInstant(value: string | null): string | null {
  if (value === null) return null;
  if (!MICROSECOND_UTC.test(value)) {
    throw new GroupBlockConflictError("Stored group block instant is invalid");
  }
  return value;
}

function assertUuid(value: string | null, name: string): string | null {
  if (value === null) return null;
  if (!UUID.test(value)) throw new GroupBlockConflictError(`Stored group block ${name} is invalid`);
  return value;
}

function allotmentRows(value: unknown): readonly GroupBlockAllotmentRow[] {
  if (!Array.isArray(value)) throw new GroupBlockConflictError("Stored group block allotment is invalid");
  return Object.freeze(value.map((item) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      throw new GroupBlockConflictError("Stored group block allotment row is invalid");
    }
    const row = item as Record<string, unknown>;
    if (typeof row.unitTypeId !== "string" || !UUID.test(row.unitTypeId) ||
        typeof row.unitTypeCode !== "string" || row.unitTypeCode.length < 1 ||
        typeof row.unitTypeName !== "string" || row.unitTypeName.length < 1 ||
        typeof row.stayDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(row.stayDate) ||
        typeof row.blocked !== "number" || !Number.isInteger(row.blocked) || row.blocked < 0 ||
        typeof row.pickedUp !== "number" || !Number.isInteger(row.pickedUp) || row.pickedUp < 0 ||
        typeof row.remaining !== "number" || !Number.isInteger(row.remaining)) {
      throw new GroupBlockConflictError("Stored group block allotment row is invalid");
    }
    return Object.freeze({
      unitTypeId: row.unitTypeId,
      unitTypeCode: row.unitTypeCode,
      unitTypeName: row.unitTypeName,
      stayDate: row.stayDate,
      blocked: row.blocked,
      pickedUp: row.pickedUp,
      remaining: row.remaining,
      rateOverride: row.rateOverride ?? null,
    });
  }));
}

function roomingListRows(value: unknown): readonly GroupBlockRoomingListRow[] {
  if (!Array.isArray(value)) throw new GroupBlockConflictError("Stored group block rooming list is invalid");
  return Object.freeze(value.map((item) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      throw new GroupBlockConflictError("Stored group block rooming list row is invalid");
    }
    const row = item as Record<string, unknown>;
    if (typeof row.reservationId !== "string" || !UUID.test(row.reservationId) ||
        typeof row.confirmationNo !== "string" || row.confirmationNo.length < 1 ||
        typeof row.primaryGuestDisplayName !== "string" || row.primaryGuestDisplayName.length < 1 ||
        typeof row.status !== "string" || row.status.length < 1 ||
        (row.unitTypeCode !== null && typeof row.unitTypeCode !== "string") ||
        (row.unitTypeName !== null && typeof row.unitTypeName !== "string") ||
        typeof row.stayFrom !== "string" || !MICROSECOND_UTC.test(row.stayFrom) ||
        typeof row.stayTo !== "string" || !MICROSECOND_UTC.test(row.stayTo) ||
        typeof row.pickedUpNights !== "number" || !Number.isInteger(row.pickedUpNights) || row.pickedUpNights < 0) {
      throw new GroupBlockConflictError("Stored group block rooming list row is invalid");
    }
    return Object.freeze({
      reservationId: row.reservationId,
      confirmationNo: row.confirmationNo,
      primaryGuestDisplayName: row.primaryGuestDisplayName,
      status: row.status,
      unitTypeCode: row.unitTypeCode,
      unitTypeName: row.unitTypeName,
      stayFrom: row.stayFrom,
      stayTo: row.stayTo,
      pickedUpNights: row.pickedUpNights,
    });
  }));
}

function cutoffState(value: string): GroupBlockSummary["cutoffState"] {
  if (value === "future" || value === "due_today" || value === "past_due" || value === "not_set") return value;
  throw new GroupBlockConflictError("Stored group block cutoff state is invalid");
}

export class GroupBlockValidationError extends Error {
  constructor(message: string) { super(message); this.name = "GroupBlockValidationError"; }
}

export class GroupBlockConflictError extends Error {
  constructor(message: string) { super(message); this.name = "GroupBlockConflictError"; }
}

export class GroupBlockService {
  async workbench(tx: Tx, input: GroupBlockWorkbenchInput): Promise<GroupBlockWorkbench> {
    const valid = validate(input);
    const rows = await tx<SqlGroupRow[]>`
      WITH property_context AS MATERIALIZED (
        SELECT property.id, property.timezone,
               (transaction_timestamp() AT TIME ZONE property.timezone)::date AS business_date
        FROM org_node AS property
        WHERE property.tenant_id = ${valid.tenantId}::uuid
          AND property.tenant_id = current_setting('app.tenant_id', true)::uuid
          AND property.id = ${valid.propertyNode}::uuid
          AND property.kind = 'property'
      ), groups AS MATERIALIZED (
        SELECT group_row.*
        FROM reservation_group AS group_row
        JOIN property_context ON property_context.id = group_row.property_node
        WHERE group_row.tenant_id = ${valid.tenantId}::uuid
          AND group_row.tenant_id = current_setting('app.tenant_id', true)::uuid
          AND group_row.kind = 'block'
      ), allotment AS MATERIALIZED (
        SELECT block_allotment.group_id,
               block_allotment.unit_type_id,
               unit_type.code AS unit_type_code,
               unit_type.name AS unit_type_name,
               block_allotment.stay_date,
               block_allotment.blocked,
               block_allotment.rate_override
        FROM block_allotment
        JOIN groups ON groups.id = block_allotment.group_id
        JOIN unit_type
          ON unit_type.tenant_id = block_allotment.tenant_id
         AND unit_type.id = block_allotment.unit_type_id
         AND unit_type.property_node = ${valid.propertyNode}::uuid
        WHERE block_allotment.tenant_id = ${valid.tenantId}::uuid
          AND block_allotment.tenant_id = current_setting('app.tenant_id', true)::uuid
      ), pickup AS MATERIALIZED (
        SELECT reservation.group_id,
               segment.unit_type_id,
               stay_night.stay_date::date AS stay_date,
               count(*)::int AS picked_up
        FROM reservation
        JOIN property_context ON property_context.id = reservation.property_node
        JOIN reservation_segment AS segment
          ON segment.tenant_id = reservation.tenant_id
         AND segment.reservation_id = reservation.id
         AND segment.status <> 'cancelled'
        CROSS JOIN LATERAL generate_series(
          (lower(segment.period) AT TIME ZONE property_context.timezone)::date,
          (upper(segment.period) AT TIME ZONE property_context.timezone)::date - 1,
          '1 day'::interval
        ) AS stay_night(stay_date)
        WHERE reservation.tenant_id = ${valid.tenantId}::uuid
          AND reservation.tenant_id = current_setting('app.tenant_id', true)::uuid
          AND reservation.property_node = ${valid.propertyNode}::uuid
          AND reservation.group_id IS NOT NULL
          AND reservation.status <> 'cancelled'
        GROUP BY reservation.group_id, segment.unit_type_id, stay_night.stay_date::date
      ), group_totals AS MATERIALIZED (
        SELECT groups.id AS group_id,
               min(allotment.stay_date) AS arrival_date,
               CASE WHEN max(allotment.stay_date) IS NULL THEN NULL ELSE max(allotment.stay_date) + 1 END AS departure_date,
               COALESCE(sum(allotment.blocked), 0)::int AS blocked_rooms,
               COALESCE(sum(COALESCE(pickup.picked_up, 0)), 0)::int AS picked_up_rooms
        FROM groups
        LEFT JOIN allotment ON allotment.group_id = groups.id
        LEFT JOIN pickup
          ON pickup.group_id = groups.id
         AND pickup.unit_type_id = allotment.unit_type_id
         AND pickup.stay_date = allotment.stay_date
        GROUP BY groups.id
      ), rooming_list AS MATERIALIZED (
        SELECT reservation.group_id,
               reservation.id AS reservation_id,
               reservation.confirmation_no,
               COALESCE(primary_party.display_name, reservation.confirmation_no) AS primary_guest_display_name,
               reservation.status,
               unit_type.code AS unit_type_code,
               unit_type.name AS unit_type_name,
               to_char(min(lower(segment.period)) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS stay_from,
               to_char(max(upper(segment.period)) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS stay_to,
               COALESCE(sum(CASE WHEN EXISTS (
                 SELECT 1
                 FROM allotment
                 WHERE allotment.group_id = reservation.group_id
                   AND allotment.unit_type_id = segment.unit_type_id
                   AND allotment.stay_date = stay_night.stay_date::date
               ) THEN 1 ELSE 0 END), 0)::int AS picked_up_nights
        FROM reservation
        JOIN property_context ON property_context.id = reservation.property_node
        JOIN groups ON groups.id = reservation.group_id
        JOIN party AS primary_party
          ON primary_party.tenant_id = reservation.tenant_id
         AND primary_party.id = reservation.primary_party
        JOIN reservation_segment AS segment
          ON segment.tenant_id = reservation.tenant_id
         AND segment.reservation_id = reservation.id
         AND segment.status <> 'cancelled'
        CROSS JOIN LATERAL generate_series(
          (lower(segment.period) AT TIME ZONE property_context.timezone)::date,
          (upper(segment.period) AT TIME ZONE property_context.timezone)::date - 1,
          '1 day'::interval
        ) AS stay_night(stay_date)
        LEFT JOIN unit_type
          ON unit_type.tenant_id = segment.tenant_id
         AND unit_type.id = segment.unit_type_id
        WHERE reservation.tenant_id = ${valid.tenantId}::uuid
          AND reservation.tenant_id = current_setting('app.tenant_id', true)::uuid
          AND reservation.property_node = ${valid.propertyNode}::uuid
          AND reservation.status <> 'cancelled'
        GROUP BY reservation.group_id, reservation.id, reservation.confirmation_no,
                 primary_party.display_name, reservation.status, unit_type.code, unit_type.name
      )
      SELECT groups.id AS group_id,
             groups.code,
             groups.name,
             groups.status,
             status_def.deducts AS status_deducts_inventory,
             account_party.id AS account_party_id,
             account_party.display_name AS account_party_name,
             groups.cutoff_date::text AS cutoff_date,
             groups.elastic,
             groups.wash_schedule,
             folio.id AS master_folio_id,
             folio.folio_no AS master_folio_no,
             folio.status AS master_folio_status,
             totals.arrival_date::text AS arrival_date,
             totals.departure_date::text AS departure_date,
             totals.blocked_rooms,
             totals.picked_up_rooms,
             greatest(totals.blocked_rooms - totals.picked_up_rooms, 0)::int AS remaining_rooms,
             CASE WHEN totals.blocked_rooms = 0 THEN 0
                  ELSE round((totals.picked_up_rooms::numeric / totals.blocked_rooms::numeric) * 100)::int END AS pickup_percent,
             CASE
               WHEN groups.cutoff_date IS NULL THEN 'not_set'
               WHEN groups.cutoff_date < property_context.business_date THEN 'past_due'
               WHEN groups.cutoff_date = property_context.business_date THEN 'due_today'
               ELSE 'future'
             END AS cutoff_state,
             COALESCE(jsonb_agg(jsonb_build_object(
               'unitTypeId', allotment.unit_type_id,
               'unitTypeCode', allotment.unit_type_code,
               'unitTypeName', allotment.unit_type_name,
               'stayDate', allotment.stay_date,
               'blocked', allotment.blocked,
               'pickedUp', COALESCE(pickup.picked_up, 0),
               'remaining', greatest(allotment.blocked - COALESCE(pickup.picked_up, 0), 0),
               'rateOverride', allotment.rate_override
             ) ORDER BY allotment.stay_date, allotment.unit_type_code) FILTER (WHERE allotment.group_id IS NOT NULL), '[]'::jsonb) AS allotment,
             COALESCE((
               SELECT jsonb_agg(jsonb_build_object(
                 'reservationId', rooming_list.reservation_id,
                 'confirmationNo', rooming_list.confirmation_no,
                 'primaryGuestDisplayName', rooming_list.primary_guest_display_name,
                 'status', rooming_list.status,
                 'unitTypeCode', rooming_list.unit_type_code,
                 'unitTypeName', rooming_list.unit_type_name,
                 'stayFrom', rooming_list.stay_from,
                 'stayTo', rooming_list.stay_to,
                 'pickedUpNights', rooming_list.picked_up_nights
               ) ORDER BY rooming_list.stay_from, rooming_list.confirmation_no)
               FROM rooming_list
               WHERE rooming_list.group_id = groups.id
             ), '[]'::jsonb) AS rooming_list
      FROM groups
      JOIN property_context ON property_context.id = groups.property_node
      LEFT JOIN block_status_def AS status_def
        ON status_def.tenant_id = groups.tenant_id
       AND status_def.code = groups.status
      LEFT JOIN party AS account_party
        ON account_party.tenant_id = groups.tenant_id
       AND account_party.id = groups.account_party
      LEFT JOIN folio
        ON folio.tenant_id = groups.tenant_id
       AND folio.id = groups.master_folio
      JOIN group_totals AS totals ON totals.group_id = groups.id
      LEFT JOIN allotment ON allotment.group_id = groups.id
      LEFT JOIN pickup
        ON pickup.group_id = groups.id
       AND pickup.unit_type_id = allotment.unit_type_id
       AND pickup.stay_date = allotment.stay_date
      GROUP BY groups.id, groups.code, groups.name, groups.status, status_def.deducts,
               account_party.id, account_party.display_name, groups.cutoff_date, groups.elastic,
               groups.wash_schedule, folio.id, folio.folio_no, folio.status,
               totals.arrival_date, totals.departure_date, totals.blocked_rooms, totals.picked_up_rooms,
               property_context.business_date
      ORDER BY COALESCE(totals.arrival_date, groups.cutoff_date, property_context.business_date),
               groups.code;
    `;
    return Object.freeze({ groups: Object.freeze(rows.map((row) => Object.freeze({
      groupId: assertUuid(row.group_id, "id")!,
      code: row.code,
      name: row.name,
      status: row.status,
      statusDeductsInventory: row.status_deducts_inventory ?? false,
      accountPartyId: assertUuid(row.account_party_id, "account party"),
      accountPartyName: row.account_party_name,
      cutoffDate: assertDate(row.cutoff_date, "cutoff"),
      elastic: row.elastic,
      washSchedule: row.wash_schedule,
      masterFolioId: assertUuid(row.master_folio_id, "master folio"),
      masterFolioNo: row.master_folio_no,
      masterFolioStatus: row.master_folio_status,
      arrivalDate: assertDate(row.arrival_date, "arrival date"),
      departureDate: assertDate(row.departure_date, "departure date"),
      blockedRooms: row.blocked_rooms,
      pickedUpRooms: row.picked_up_rooms,
      remainingRooms: row.remaining_rooms,
      pickupPercent: row.pickup_percent,
      cutoffState: cutoffState(row.cutoff_state),
      allotment: allotmentRows(row.allotment),
      roomingList: roomingListRows(row.rooming_list),
    }))) });
  }
}
