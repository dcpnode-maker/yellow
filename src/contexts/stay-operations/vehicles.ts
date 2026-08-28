import type { Database } from "../../kernel";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const CURSOR = /^[A-Za-z0-9_-]{1,2048}$/;
const MICROSECOND_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;

export interface VehicleRegisterInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly registration?: string;
  readonly cursor?: string;
  readonly limit?: number;
}

export interface VehicleRegisterDetailInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly vehicleId: string;
}

export interface VehicleRegisterRow {
  readonly vehicleId: string;
  readonly registration: string;
  readonly make: string | null;
  readonly model: string | null;
  readonly colour: string | null;
  readonly driverName: string | null;
  readonly reservationId: string | null;
  readonly partyId: string | null;
  readonly enteredAt: string | null;
  readonly exitedAt: string | null;
}

export interface VehicleRegisterPage {
  readonly vehicles: readonly VehicleRegisterRow[];
  readonly nextCursor: string | null;
}

export interface VehicleRegisterServiceOptions {
  readonly database: Database;
}

interface VehicleCursor {
  readonly v: 1;
  readonly registration: string;
  readonly id: string;
}

interface VehicleSqlRow {
  readonly id: string;
  readonly reg_no: string;
  readonly make: string | null;
  readonly model: string | null;
  readonly colour: string | null;
  readonly driver_name: string | null;
  readonly reservation_id: string | null;
  readonly visible_reservation_id: string | null;
  readonly party_id: string | null;
  readonly visible_party_id: string | null;
  readonly entered_at: string | null;
  readonly exited_at: string | null;
}

export class VehicleRegisterValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VehicleRegisterValidationError";
  }
}

export class VehicleRegisterConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VehicleRegisterConflictError";
  }
}

export class VehicleRegisterNotFoundError extends Error {
  constructor() {
    super("Vehicle was not found");
    this.name = "VehicleRegisterNotFoundError";
  }
}

function encodeBase64Url(value: string): string {
  return btoa(value).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function decodeBase64Url(value: string): string {
  const standard = value.replaceAll("-", "+").replaceAll("_", "/");
  return atob(standard + "=".repeat((4 - standard.length % 4) % 4));
}

function encodeCursor(cursor: VehicleCursor): string {
  return encodeBase64Url(JSON.stringify(cursor));
}

function decodeCursor(value: unknown): VehicleCursor | null {
  if (value === undefined) return null;
  if (typeof value !== "string" || !CURSOR.test(value)) {
    throw new VehicleRegisterValidationError("cursor is invalid");
  }
  try {
    const parsed: unknown = JSON.parse(decodeBase64Url(value));
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed) ||
        Object.getPrototypeOf(parsed) !== Object.prototype ||
        Object.getOwnPropertySymbols(parsed).length !== 0 ||
        Object.getOwnPropertyNames(parsed).length !== 3) {
      throw new Error("shape");
    }
    const source = parsed as Record<string, unknown>;
    if (source.v !== 1 || typeof source.registration !== "string" ||
        source.registration.length > 512 || typeof source.id !== "string" || !UUID.test(source.id)) {
      throw new Error("fields");
    }
    const cursor = Object.freeze({
      v: 1 as const,
      registration: source.registration,
      id: source.id,
    });
    if (encodeCursor(cursor) !== value) throw new Error("non-canonical");
    return cursor;
  } catch {
    throw new VehicleRegisterValidationError("cursor is invalid");
  }
}

function validate(input: VehicleRegisterInput) {
  if (typeof input !== "object" || input === null || Array.isArray(input) ||
      (Object.getPrototypeOf(input) !== Object.prototype && Object.getPrototypeOf(input) !== null) ||
      Object.getOwnPropertySymbols(input).length !== 0) {
    throw new VehicleRegisterValidationError("vehicle register input must be a plain object");
  }
  const allowed = new Set(["tenantId", "propertyNode", "registration", "cursor", "limit"]);
  if (Object.getOwnPropertyNames(input).some((key) => !allowed.has(key)) ||
      !UUID.test(input.tenantId) || !UUID.test(input.propertyNode)) {
    throw new VehicleRegisterValidationError("vehicle register input is invalid");
  }
  if (input.registration !== undefined &&
      (typeof input.registration !== "string" || input.registration.length > 512)) {
    throw new VehicleRegisterValidationError("registration is invalid");
  }
  if (input.limit !== undefined &&
      (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 100)) {
    throw new VehicleRegisterValidationError("limit must be between 1 and 100");
  }
  const cursor = decodeCursor(input.cursor);
  if (cursor !== null && input.registration !== undefined &&
      cursor.registration !== input.registration) {
    throw new VehicleRegisterValidationError("cursor does not belong to this registration lookup");
  }
  return Object.freeze({
    tenantId: input.tenantId,
    propertyNode: input.propertyNode,
    registration: input.registration ?? null,
    cursor,
    limit: input.limit ?? 50,
  });
}

function validateDetail(input: VehicleRegisterDetailInput) {
  if (typeof input !== "object" || input === null || Array.isArray(input) ||
      (Object.getPrototypeOf(input) !== Object.prototype && Object.getPrototypeOf(input) !== null) ||
      Object.getOwnPropertySymbols(input).length !== 0) {
    throw new VehicleRegisterValidationError("vehicle detail input must be a plain object");
  }
  const allowed = new Set(["tenantId", "propertyNode", "vehicleId"]);
  if (Object.getOwnPropertyNames(input).length !== allowed.size ||
      Object.getOwnPropertyNames(input).some((key) => !allowed.has(key)) ||
      !UUID.test(input.tenantId) || !UUID.test(input.propertyNode) || !UUID.test(input.vehicleId)) {
    throw new VehicleRegisterValidationError("vehicle detail input is invalid");
  }
  return Object.freeze({
    tenantId: input.tenantId,
    propertyNode: input.propertyNode,
    vehicleId: input.vehicleId,
  });
}

function storedUuid(value: string, subject: string): string {
  if (!UUID.test(value)) throw new VehicleRegisterConflictError(`Stored vehicle ${subject} is invalid`);
  return value;
}

function storedInstant(value: string | null, subject: string): string | null {
  if (value === null) return null;
  const parsed = new Date(value);
  if (!MICROSECOND_UTC.test(value) || !Number.isFinite(parsed.getTime()) ||
      parsed.toISOString().slice(0, 23) !== value.slice(0, 23)) {
    throw new VehicleRegisterConflictError(`Stored vehicle ${subject} is invalid`);
  }
  return value;
}

function canonicalRow(row: VehicleSqlRow): VehicleRegisterRow {
  if ((row.reservation_id !== null && row.visible_reservation_id !== row.reservation_id) ||
      (row.party_id !== null && row.visible_party_id !== row.party_id)) {
    throw new VehicleRegisterConflictError("Vehicle register association is inconsistent");
  }
  if (typeof row.reg_no !== "string" || row.reg_no.length > 512) {
    throw new VehicleRegisterConflictError("Stored vehicle registration is invalid");
  }
  return Object.freeze({
    vehicleId: storedUuid(row.id, "id"),
    registration: row.reg_no,
    make: row.make,
    model: row.model,
    colour: row.colour,
    driverName: row.driver_name,
    reservationId: row.reservation_id,
    partyId: row.party_id,
    enteredAt: storedInstant(row.entered_at, "entry timestamp"),
    exitedAt: storedInstant(row.exited_at, "exit timestamp"),
  });
}

export class VehicleRegisterService {
  readonly #database: Database;

  constructor(options: VehicleRegisterServiceOptions) {
    this.#database = options.database;
  }

  async get(input: VehicleRegisterDetailInput): Promise<VehicleRegisterRow> {
    const target = validateDetail(input);
    const rows = await this.#database.withTenantTransaction(target.tenantId, async (tx) =>
      tx<VehicleSqlRow[]>`
        WITH target_property AS MATERIALIZED (
          SELECT property.id
          FROM public.org_node AS property
          WHERE property.tenant_id = ${target.tenantId}::uuid
            AND property.tenant_id = current_setting('app.tenant_id', true)::uuid
            AND property.id = ${target.propertyNode}::uuid
            AND property.kind = 'property'
        ), target_vehicle AS MATERIALIZED (
          SELECT vehicle.*
          FROM public.vehicle
          JOIN target_property AS property ON property.id = vehicle.property_node
          WHERE vehicle.tenant_id = ${target.tenantId}::uuid
            AND vehicle.tenant_id = current_setting('app.tenant_id', true)::uuid
            AND vehicle.id = ${target.vehicleId}::uuid
        )
        SELECT vehicle.id, vehicle.reg_no, vehicle.make, vehicle.model, vehicle.colour,
               vehicle.driver_name, vehicle.reservation_id,
               reservation.id AS visible_reservation_id,
               vehicle.party_id, party.id AS visible_party_id,
               CASE WHEN vehicle.entered_at IS NULL THEN NULL ELSE
                 to_char(vehicle.entered_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
               END AS entered_at,
               CASE WHEN vehicle.exited_at IS NULL THEN NULL ELSE
                 to_char(vehicle.exited_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
               END AS exited_at
        FROM target_vehicle AS vehicle
        LEFT JOIN public.reservation
          ON reservation.tenant_id = ${target.tenantId}::uuid
         AND reservation.tenant_id = current_setting('app.tenant_id', true)::uuid
         AND reservation.property_node = ${target.propertyNode}::uuid
         AND reservation.id = vehicle.reservation_id
        LEFT JOIN public.party
          ON party.tenant_id = ${target.tenantId}::uuid
         AND party.tenant_id = current_setting('app.tenant_id', true)::uuid
         AND party.id = vehicle.party_id
      `,
    );
    if (rows.length === 0) throw new VehicleRegisterNotFoundError();
    if (rows.length !== 1) throw new VehicleRegisterConflictError("Vehicle detail is ambiguous");
    return canonicalRow(rows[0]!);
  }

  async list(input: VehicleRegisterInput): Promise<VehicleRegisterPage> {
    const page = validate(input);
    const rows = await this.#database.withTenantTransaction(page.tenantId, async (tx) =>
      tx<VehicleSqlRow[]>`
        WITH target_property AS MATERIALIZED (
          SELECT property.id
          FROM public.org_node AS property
          WHERE property.tenant_id = ${page.tenantId}::uuid
            AND property.tenant_id = current_setting('app.tenant_id', true)::uuid
            AND property.id = ${page.propertyNode}::uuid
            AND property.kind = 'property'
        ), page_vehicles AS MATERIALIZED (
          SELECT vehicle.*
          FROM public.vehicle
          JOIN target_property AS property ON property.id = vehicle.property_node
          WHERE vehicle.tenant_id = ${page.tenantId}::uuid
            AND vehicle.tenant_id = current_setting('app.tenant_id', true)::uuid
            AND (${page.registration}::text IS NULL OR vehicle.reg_no = ${page.registration}::text)
            AND (
              ${page.cursor?.registration ?? null}::text IS NULL OR
              vehicle.reg_no COLLATE "C" > ${page.cursor?.registration ?? null}::text COLLATE "C" OR
              (vehicle.reg_no = ${page.cursor?.registration ?? null}::text AND
               vehicle.id > ${page.cursor?.id ?? null}::uuid)
            )
          ORDER BY vehicle.reg_no COLLATE "C", vehicle.id
          LIMIT ${page.limit + 1}
        )
        SELECT vehicle.id, vehicle.reg_no, vehicle.make, vehicle.model, vehicle.colour,
               vehicle.driver_name, vehicle.reservation_id,
               reservation.id AS visible_reservation_id,
               vehicle.party_id, party.id AS visible_party_id,
               CASE WHEN vehicle.entered_at IS NULL THEN NULL ELSE
                 to_char(vehicle.entered_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
               END AS entered_at,
               CASE WHEN vehicle.exited_at IS NULL THEN NULL ELSE
                 to_char(vehicle.exited_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
               END AS exited_at
        FROM page_vehicles AS vehicle
        LEFT JOIN public.reservation
          ON reservation.tenant_id = ${page.tenantId}::uuid
         AND reservation.tenant_id = current_setting('app.tenant_id', true)::uuid
         AND reservation.property_node = ${page.propertyNode}::uuid
         AND reservation.id = vehicle.reservation_id
        LEFT JOIN public.party
          ON party.tenant_id = ${page.tenantId}::uuid
         AND party.tenant_id = current_setting('app.tenant_id', true)::uuid
         AND party.id = vehicle.party_id
        ORDER BY vehicle.reg_no COLLATE "C", vehicle.id
      `,
    );
    const hasMore = rows.length > page.limit;
    const vehicles = Object.freeze(rows.slice(0, page.limit).map(canonicalRow));
    const last = vehicles.at(-1);
    return Object.freeze({
      vehicles,
      nextCursor: hasMore && last
        ? encodeCursor({ v: 1, registration: last.registration, id: last.vehicleId })
        : null,
    });
  }
}
