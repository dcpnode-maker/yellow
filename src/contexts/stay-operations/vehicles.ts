import {
  IdempotencyConflictError,
  recordFact,
  type AuditEnvelope,
  type Database,
  type EventBus,
  type JsonValue,
  type PostgresIdempotency,
} from "../../kernel";

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

const PARKING_IDEMPOTENCY_KEY = /^[\x21-\x7e]{8,200}$/;
const MAX_PARKING_SPACES = 100;

export interface VehicleParkingReadInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly vehicleId: string;
}

export interface VehicleParkingAssignmentInput extends VehicleParkingReadInput {
  readonly parkingSpaceId: string;
  readonly idempotencyKey: string;
  readonly envelope: AuditEnvelope;
}

export interface VehicleParkingSpace extends Readonly<Record<string, JsonValue>> {
  readonly parkingSpaceId: string;
  readonly code: string;
  readonly floor: string | null;
}

export interface VehicleParkingSnapshot extends Readonly<Record<string, JsonValue>> {
  readonly vehicleId: string;
  readonly assignment: VehicleParkingSpace | null;
  readonly candidates: readonly VehicleParkingSpace[];
}

export interface VehicleParkingAssignment extends VehicleParkingSpace {
  readonly vehicleId: string;
  readonly registration: string;
  readonly from: string;
  readonly to: string;
}

export interface VehicleParkingAssignmentResult extends Readonly<Record<string, JsonValue>> {
  readonly assignment: VehicleParkingAssignment;
  readonly created: boolean;
  readonly replayed: boolean;
}

export interface VehicleParkingAssignmentServiceOptions {
  readonly database: Database;
  readonly events: EventBus;
  readonly idempotency: PostgresIdempotency;
}

interface ParkingHeaderRow {
  readonly vehicle_id: string;
  readonly parking_space_id: string | null;
  readonly segment_id: string | null;
  readonly current_segment_count: number;
  readonly segment_to: Date | string | null;
  readonly assigned_code: string | null;
  readonly assigned_floor: string | null;
  readonly assigned_occupancy_count: number;
}

interface ParkingSpaceRow {
  readonly parking_space_id: string;
  readonly parking_code: string;
  readonly parking_floor: string | null;
}

interface ParkingCapabilityRow extends ParkingSpaceRow {
  readonly vehicle_id: string;
  readonly vehicle_registration: string;
  readonly reservation_segment_id: string;
  readonly occupancy_id: string;
  readonly occupancy_from: Date | string;
  readonly occupancy_to: Date | string;
  readonly occupancy_period: string;
  readonly occupancy_claim: string;
  readonly created: boolean;
}

export class VehicleParkingValidationError extends Error {
  constructor(message: string) { super(message); this.name = "VehicleParkingValidationError"; }
}

export class VehicleParkingNotFoundError extends Error {
  constructor(message: string) { super(message); this.name = "VehicleParkingNotFoundError"; }
}

export class VehicleParkingConflictError extends Error {
  constructor(message: string) { super(message); this.name = "VehicleParkingConflictError"; }
}

function parkingPlain(value: unknown, subject: string): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value) ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) ||
      Object.getOwnPropertySymbols(value).length !== 0) {
    throw new VehicleParkingValidationError(`${subject} must be a plain object`);
  }
}

function parkingExact(value: Record<string, unknown>, keys: readonly string[], subject: string): void {
  const actual = Object.keys(value);
  if (actual.length !== keys.length || keys.some((key) => !Object.hasOwn(value, key))) {
    throw new VehicleParkingValidationError(`${subject} shape is invalid`);
  }
}

function parkingUuid(value: unknown, subject: string): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new VehicleParkingValidationError(`${subject} must be a lowercase UUID`);
  }
  return value;
}

function parkingText(value: unknown, subject: string, maximum = 512): string {
  if (typeof value !== "string" || value.length < 1 || value.length > maximum || /[\x00-\x1f\x7f]/u.test(value)) {
    throw new Error(`Database returned invalid ${subject}`);
  }
  return value;
}

function parkingInstant(value: unknown, subject: string): string {
  if (!(value instanceof Date) && typeof value !== "string") throw new Error(`Database returned invalid ${subject}`);
  const parsed = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new Error(`Database returned invalid ${subject}`);
  return parsed.toISOString();
}

function parkingSpace(row: ParkingSpaceRow): VehicleParkingSpace {
  return Object.freeze({
    parkingSpaceId: parkingUuid(row.parking_space_id, "parkingSpaceId"),
    code: parkingText(row.parking_code, "parking code", 120),
    floor: row.parking_floor === null ? null : parkingText(row.parking_floor, "parking floor", 120),
  });
}

function normalizeParkingRead(input: VehicleParkingReadInput): VehicleParkingReadInput {
  parkingPlain(input, "vehicle parking read input");
  parkingExact(input, ["tenantId", "propertyNode", "vehicleId"], "vehicle parking read input");
  return Object.freeze({
    tenantId: parkingUuid(input.tenantId, "tenantId"),
    propertyNode: parkingUuid(input.propertyNode, "propertyNode"),
    vehicleId: parkingUuid(input.vehicleId, "vehicleId"),
  });
}

function normalizeParkingAssignment(input: VehicleParkingAssignmentInput): VehicleParkingAssignmentInput {
  parkingPlain(input, "vehicle parking assignment input");
  parkingExact(input, [
    "tenantId", "propertyNode", "vehicleId", "parkingSpaceId", "idempotencyKey", "envelope",
  ], "vehicle parking assignment input");
  const target = normalizeParkingRead({
    tenantId: input.tenantId,
    propertyNode: input.propertyNode,
    vehicleId: input.vehicleId,
  });
  if (typeof input.idempotencyKey !== "string" || !PARKING_IDEMPOTENCY_KEY.test(input.idempotencyKey)) {
    throw new VehicleParkingValidationError("idempotencyKey must contain 8 to 200 visible ASCII characters");
  }
  parkingPlain(input.envelope, "envelope");
  parkingExact(input.envelope, ["actorId", "tenantId", "propertyNode", "requestId", "operation"], "envelope");
  if (parkingUuid(input.envelope.tenantId, "envelope.tenantId") !== target.tenantId ||
      parkingUuid(input.envelope.propertyNode, "envelope.propertyNode") !== target.propertyNode ||
      input.envelope.operation !== "occupancy.recorded") {
    throw new VehicleParkingValidationError("audit envelope is not bound to occupancy.recorded");
  }
  return Object.freeze({
    ...target,
    parkingSpaceId: parkingUuid(input.parkingSpaceId, "parkingSpaceId"),
    idempotencyKey: input.idempotencyKey,
    envelope: Object.freeze({
      actorId: parkingUuid(input.envelope.actorId, "envelope.actorId"),
      tenantId: target.tenantId,
      propertyNode: target.propertyNode,
      requestId: parkingUuid(input.envelope.requestId, "envelope.requestId"),
      operation: "occupancy.recorded",
    }),
  });
}

function translateParking(error: unknown): never {
  if (error instanceof IdempotencyConflictError) throw new VehicleParkingConflictError(error.message);
  const record = error as { errno?: unknown; code?: unknown; message?: unknown };
  const state = record.errno ?? record.code;
  const message = typeof record.message === "string" ? record.message : "";
  if (state === "23P01" || state === "23505" || state === "40001" || state === "40P01" ||
      message.includes("different parking assignment") || message.includes("changed concurrently")) {
    throw new VehicleParkingConflictError("Parking space is no longer assignable to this vehicle");
  }
  if (state === "42501" || state === "55000" || message.includes("unavailable") || message.includes("incoherent")) {
    throw new VehicleParkingNotFoundError("Vehicle or parking space was not found as an exact current assignment target");
  }
  if (state === "22023") throw new VehicleParkingValidationError("Vehicle parking assignment is invalid");
  throw error;
}

export class VehicleParkingAssignmentService {
  readonly #database: Database;
  readonly #events: EventBus;
  readonly #idempotency: PostgresIdempotency;

  constructor(options: VehicleParkingAssignmentServiceOptions) {
    this.#database = options.database;
    this.#events = options.events;
    this.#idempotency = options.idempotency;
  }

  async read(input: VehicleParkingReadInput): Promise<VehicleParkingSnapshot> {
    const target = normalizeParkingRead(input);
    try {
      return await this.#database.withTenantTransaction(target.tenantId, async (tx) => {
        const rows = await tx<ParkingHeaderRow[]>`
          SELECT vehicle.id AS vehicle_id,
                 vehicle.parking_space AS parking_space_id,
                 current_segment.id AS segment_id,
                 segment_count.count AS current_segment_count,
                 upper(current_segment.period) AS segment_to,
                 assigned.code AS assigned_code,
                 assigned.floor AS assigned_floor,
                 CASE WHEN vehicle.parking_space IS NULL THEN 0 ELSE (
                   SELECT count(*)::int
                   FROM public.space_occupancy AS occupancy
                   WHERE occupancy.tenant_id = vehicle.tenant_id
                     AND occupancy.space_id = vehicle.parking_space
                     AND occupancy.slot_ref = current_segment.id
                     AND occupancy.slot_kind = 'segment'
                     AND occupancy.exclusive
                     AND occupancy.period @> transaction_timestamp()
                 ) END AS assigned_occupancy_count
          FROM public.vehicle AS vehicle
          JOIN public.reservation AS reservation
            ON reservation.tenant_id = vehicle.tenant_id
           AND reservation.property_node = vehicle.property_node
           AND reservation.id = vehicle.reservation_id
           AND reservation.status IN ('in_house', 'due_out')
          CROSS JOIN LATERAL (
            SELECT count(*)::int AS count
            FROM public.reservation_segment AS candidate
            WHERE candidate.tenant_id = reservation.tenant_id
              AND candidate.reservation_id = reservation.id
              AND candidate.period @> transaction_timestamp()
              AND candidate.status = 'in_house'
          ) AS segment_count
          LEFT JOIN LATERAL (
            SELECT candidate.*
            FROM public.reservation_segment AS candidate
            WHERE candidate.tenant_id = reservation.tenant_id
              AND candidate.reservation_id = reservation.id
              AND candidate.period @> transaction_timestamp()
            ORDER BY candidate.seq DESC, candidate.id DESC
            LIMIT 1
          ) AS current_segment ON true
          LEFT JOIN public.space AS assigned
            ON assigned.tenant_id = vehicle.tenant_id
           AND assigned.property_node = vehicle.property_node
           AND assigned.id = vehicle.parking_space
           AND assigned.status = 'active'
           AND assigned.profile_key = 'parking'
           AND assigned.capacity = 1
          WHERE vehicle.tenant_id = ${target.tenantId}::uuid
            AND vehicle.tenant_id = current_setting('app.tenant_id', true)::uuid
            AND vehicle.property_node = ${target.propertyNode}::uuid
            AND vehicle.id = ${target.vehicleId}::uuid
            AND vehicle.entered_at IS NOT NULL
            AND vehicle.exited_at IS NULL
        `;
        const header = rows[0];
        if (!header || rows.length !== 1 || header.current_segment_count !== 1 ||
            !header.segment_id || !header.segment_to) {
          throw new VehicleParkingNotFoundError(
            "Vehicle was not found with one exact current in-house parking window",
          );
        }
        if (header.parking_space_id !== null) {
          if (!header.assigned_code || header.assigned_occupancy_count !== 1) {
            throw new VehicleParkingConflictError("Stored vehicle parking assignment is incoherent");
          }
          return Object.freeze({
            vehicleId: target.vehicleId,
            assignment: parkingSpace({
              parking_space_id: header.parking_space_id,
              parking_code: header.assigned_code,
              parking_floor: header.assigned_floor,
            }),
            candidates: Object.freeze([]),
          });
        }
        const candidates = await tx<ParkingSpaceRow[]>`
          SELECT parking.id AS parking_space_id,
                 parking.code AS parking_code,
                 parking.floor AS parking_floor
          FROM public.space AS parking
          WHERE parking.tenant_id = ${target.tenantId}::uuid
            AND parking.tenant_id = current_setting('app.tenant_id', true)::uuid
            AND parking.property_node = ${target.propertyNode}::uuid
            AND parking.status = 'active'
            AND parking.profile_key = 'parking'
            AND parking.capacity = 1
            AND NOT EXISTS (
              SELECT 1 FROM public.sellable_unit_space AS mapping
              WHERE mapping.tenant_id = parking.tenant_id
                AND mapping.space_id = parking.id
                AND mapping.claim_mode = 'positional'
            )
            AND NOT EXISTS (
              SELECT 1 FROM public.space_occupancy AS occupancy
              WHERE occupancy.tenant_id = parking.tenant_id
                AND occupancy.space_id = parking.id
                AND occupancy.period && tstzrange(
                  transaction_timestamp(), ${parkingInstant(header.segment_to, "segment end")}::timestamptz, '[)'
                )
            )
          ORDER BY parking.code COLLATE "C", parking.id
          LIMIT ${MAX_PARKING_SPACES + 1}
        `;
        if (candidates.length > MAX_PARKING_SPACES) {
          throw new VehicleParkingConflictError("Assignable parking spaces exceed the bounded surface");
        }
        return Object.freeze({
          vehicleId: target.vehicleId,
          assignment: null,
          candidates: Object.freeze(candidates.map(parkingSpace)),
        });
      });
    } catch (error) {
      if (error instanceof VehicleParkingNotFoundError || error instanceof VehicleParkingConflictError) throw error;
      return translateParking(error);
    }
  }

  async assign(input: VehicleParkingAssignmentInput): Promise<VehicleParkingAssignmentResult> {
    const target = normalizeParkingAssignment(input);
    try {
      const outcome = await this.#database.withTenantTransaction(target.tenantId, (tx) =>
        this.#idempotency.execute<VehicleParkingAssignmentResult>(tx, {
          tenantId: target.tenantId,
          operation: "stay-operations.vehicle.park",
          key: target.idempotencyKey,
          request: {
            actorId: target.envelope.actorId,
            propertyNode: target.propertyNode,
            vehicleId: target.vehicleId,
            parkingSpaceId: target.parkingSpaceId,
          },
        }, async (commandTx) => {
          const rows = await commandTx<ParkingCapabilityRow[]>`
            SELECT vehicle_id, vehicle_registration, parking_space_id, parking_code,
                   parking_floor, reservation_segment_id, occupancy_id,
                   occupancy_from, occupancy_to, occupancy_period, occupancy_claim, created
            FROM public.assign_vehicle_parking(
              ${target.tenantId}::uuid,
              ${target.propertyNode}::uuid,
              ${target.vehicleId}::uuid,
              ${target.parkingSpaceId}::uuid,
              ${target.envelope.actorId}::uuid
            )
          `;
          const row = rows[0];
          if (!row || rows.length !== 1 || row.vehicle_id !== target.vehicleId ||
              row.parking_space_id !== target.parkingSpaceId || row.occupancy_claim !== "[0,)" ||
              !UUID.test(row.reservation_segment_id) || !UUID.test(row.occupancy_id)) {
            throw new Error("Database returned invalid vehicle parking evidence");
          }
          const from = parkingInstant(row.occupancy_from, "parking claim start");
          const to = parkingInstant(row.occupancy_to, "parking claim end");
          if (new Date(from).getTime() >= new Date(to).getTime() ||
              typeof row.occupancy_period !== "string" || row.occupancy_period.length > 256) {
            throw new Error("Database returned invalid vehicle parking period");
          }
          const assignment = Object.freeze({
            vehicleId: target.vehicleId,
            registration: parkingText(row.vehicle_registration, "vehicle registration"),
            ...parkingSpace(row),
            from,
            to,
          });
          if (row.created) {
            const payload = Object.freeze({
              occupancy_id: row.occupancy_id,
              slot_ref: row.reservation_segment_id,
              slot_kind: "segment",
              vehicle_id: target.vehicleId,
              space_id: target.parkingSpaceId,
              period: row.occupancy_period,
              claim: row.occupancy_claim,
              exclusive: true,
            });
            const fact = await recordFact(commandTx, {
              entityType: "vehicle",
              entityId: target.vehicleId,
              envelope: target.envelope,
              payload,
            });
            await this.#events.publish(commandTx, {
              tenantId: target.tenantId,
              propertyNode: target.propertyNode,
              businessDate: fact.businessDate,
              aggregateType: "space_occupancy",
              aggregateId: row.occupancy_id,
              eventType: "occupancy.recorded",
              actorId: target.envelope.actorId,
              correlationId: target.envelope.requestId,
              payload,
            });
          }
          return {
            status: row.created ? 201 : 200,
            body: Object.freeze({ assignment, created: row.created, replayed: false }),
          };
        }),
      );
      return Object.freeze({ ...outcome.body, replayed: outcome.replayed });
    } catch (error) {
      if (error instanceof VehicleParkingNotFoundError || error instanceof VehicleParkingConflictError) throw error;
      return translateParking(error);
    }
  }
}
