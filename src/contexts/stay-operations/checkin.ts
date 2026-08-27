import {
  recordFact,
  type AuditEnvelope,
  type Database,
  type EventBus,
  type JsonValue,
  type PostgresIdempotency,
  type Tx,
} from "../../kernel";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const IDEMPOTENCY_KEY = /^[\x21-\x7e]{8,200}$/;
const REASON_BYTES = 500;
const UNSAFE_TEXT = /[\x00-\x1f\x7f\u200b-\u200d\u202a-\u202e\u2060\u2066-\u2069\ufeff]/u;

export const CHECK_IN_BLOCKERS = Object.freeze([
  "reservation_not_due_in",
  "active_segment_missing",
  "room_assignment_missing",
  "room_mapping_invalid",
  "room_condition_missing",
  "room_not_ready",
  "dirty_room_override_unauthorized",
  "primary_folio_not_open",
  "statutory_adapter_unavailable",
  "identity_document_missing",
] as const);

export type CheckInBlocker = (typeof CHECK_IN_BLOCKERS)[number];
export type CheckInRoomCondition = "clean" | "dirty" | "pickup" | "inspected";

export interface CheckInReadinessInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly reservationId: string;
  /** Must be derived from the authenticated property grant by the server adapter. */
  readonly dirtyRoomOverrideAuthorized: boolean;
}

export interface CheckInInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly reservationId: string;
  readonly dirtyRoomOverrideAuthorized: boolean;
  readonly dirtyRoomOverrideReason?: string;
  readonly idempotencyKey: string;
  readonly envelope: AuditEnvelope;
}

export interface CheckInIdentityGate extends Readonly<Record<string, JsonValue>> {
  readonly required: boolean;
  readonly satisfied: boolean;
  readonly adapterKey: string | null;
}

export interface CheckInReadiness {
  readonly reservationId: string;
  readonly status: string;
  readonly segmentId: string | null;
  readonly assignedSpaceId: string | null;
  readonly primaryFolioId: string | null;
  readonly roomCondition: CheckInRoomCondition | null;
  readonly identityGate: CheckInIdentityGate;
  readonly dirtyRoomOverrideRequired: boolean;
  readonly dirtyRoomOverrideAuthorized: boolean;
  readonly blockers: readonly CheckInBlocker[];
  readonly canCheckIn: boolean;
}

export interface CheckInResult extends Readonly<Record<string, JsonValue>> {
  readonly reservationId: string;
  readonly reservationStatus: "in_house";
  readonly segmentId: string;
  readonly segmentStatus: "in_house";
  readonly assignedSpaceId: string;
  readonly primaryFolioId: string;
  readonly roomCondition: CheckInRoomCondition;
  readonly dirtyRoomOverrideUsed: boolean;
  readonly identityGate: CheckInIdentityGate;
  readonly replayed: boolean;
}

export interface CheckInServiceOptions {
  readonly database: Database;
  readonly events: EventBus;
  readonly idempotency: PostgresIdempotency;
}

interface ReservationRow {
  readonly id: string;
  readonly status: string;
  readonly primary_party: string;
  readonly property_node: string;
  readonly statutory_adapter_key: string | null;
}

interface SegmentRow {
  readonly id: string;
  readonly sellable_unit_id: string | null;
  readonly status: string;
}

interface SpaceRow {
  readonly space_id: string;
  readonly condition: string | null;
}

interface FolioRow {
  readonly id: string;
}

interface AdapterRow {
  readonly key: string;
  readonly required_identity_fields: unknown;
}

interface IdentityCountRow {
  readonly party_count: number;
  readonly documented_party_count: number;
}

interface ReadinessState {
  readonly result: CheckInReadiness;
  readonly primaryPartyId: string;
}

export class CheckInValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CheckInValidationError";
  }
}

export class CheckInNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CheckInNotFoundError";
  }
}

export class CheckInConflictError extends Error {
  readonly blockers: readonly CheckInBlocker[];

  constructor(message: string, blockers: readonly CheckInBlocker[] = Object.freeze([])) {
    super(message);
    this.name = "CheckInConflictError";
    this.blockers = Object.freeze([...blockers]);
  }
}

function plainObject(value: unknown, subject: string): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value) ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) ||
      Object.getOwnPropertySymbols(value).length !== 0) {
    throw new CheckInValidationError(`${subject} must be a plain object`);
  }
}

function exactKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[],
  subject: string,
): void {
  const actual = Object.keys(value);
  if (required.some((key) => !Object.hasOwn(value, key)) ||
      actual.some((key) => !required.includes(key) && !optional.includes(key))) {
    throw new CheckInValidationError(`${subject} shape is invalid`);
  }
}

function uuid(value: unknown, subject: string): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new CheckInValidationError(`${subject} must be a lowercase UUID`);
  }
  return value;
}

function permission(value: unknown): boolean {
  if (typeof value !== "boolean") {
    throw new CheckInValidationError("dirtyRoomOverrideAuthorized must be a server-owned boolean");
  }
  return value;
}

function reason(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value !== value.trim() || value.length === 0 ||
      new TextEncoder().encode(value).length > REASON_BYTES || UNSAFE_TEXT.test(value)) {
    throw new CheckInValidationError("dirtyRoomOverrideReason must be 1 to 500 safe trimmed UTF-8 bytes");
  }
  return value;
}

function readinessInput(input: CheckInReadinessInput): CheckInReadinessInput {
  plainObject(input, "check-in readiness input");
  exactKeys(
    input,
    ["tenantId", "propertyNode", "reservationId", "dirtyRoomOverrideAuthorized"],
    [],
    "check-in readiness input",
  );
  return Object.freeze({
    tenantId: uuid(input.tenantId, "tenantId"),
    propertyNode: uuid(input.propertyNode, "propertyNode"),
    reservationId: uuid(input.reservationId, "reservationId"),
    dirtyRoomOverrideAuthorized: permission(input.dirtyRoomOverrideAuthorized),
  });
}

function commandInput(input: CheckInInput): Readonly<{
  tenantId: string;
  propertyNode: string;
  reservationId: string;
  dirtyRoomOverrideAuthorized: boolean;
  dirtyRoomOverrideReason: string | undefined;
  idempotencyKey: string;
  envelope: AuditEnvelope;
}> {
  plainObject(input, "check-in input");
  exactKeys(
    input,
    ["tenantId", "propertyNode", "reservationId", "dirtyRoomOverrideAuthorized", "idempotencyKey", "envelope"],
    ["dirtyRoomOverrideReason"],
    "check-in input",
  );
  const tenantId = uuid(input.tenantId, "tenantId");
  if (typeof input.idempotencyKey !== "string" || !IDEMPOTENCY_KEY.test(input.idempotencyKey)) {
    throw new CheckInValidationError("idempotencyKey must contain 8 to 200 visible ASCII characters");
  }
  plainObject(input.envelope, "envelope");
  exactKeys(
    input.envelope,
    ["actorId", "tenantId", "propertyNode", "requestId", "operation"],
    [],
    "envelope",
  );
  const propertyNode = uuid(input.propertyNode, "propertyNode");
  if (uuid(input.envelope.tenantId, "envelope.tenantId") !== tenantId ||
      uuid(input.envelope.propertyNode, "envelope.propertyNode") !== propertyNode ||
      input.envelope.operation !== "reservation.checked_in") {
    throw new CheckInValidationError("audit envelope is not bound to reservation.checked_in");
  }
  const envelope = Object.freeze({
    actorId: uuid(input.envelope.actorId, "envelope.actorId"),
    tenantId,
    propertyNode,
    requestId: uuid(input.envelope.requestId, "envelope.requestId"),
    operation: "reservation.checked_in",
  });
  return Object.freeze({
    tenantId,
    propertyNode,
    reservationId: uuid(input.reservationId, "reservationId"),
    dirtyRoomOverrideAuthorized: permission(input.dirtyRoomOverrideAuthorized),
    dirtyRoomOverrideReason: reason(input.dirtyRoomOverrideReason),
    idempotencyKey: input.idempotencyKey,
    envelope,
  });
}

function asCondition(value: string | null): CheckInRoomCondition | null {
  if (value === null) return null;
  if (value === "clean" || value === "dirty" || value === "pickup" || value === "inspected") {
    return value;
  }
  throw new Error(`Database returned unsupported room condition ${value}`);
}

function addBlocker(blockers: CheckInBlocker[], blocker: CheckInBlocker): void {
  if (!blockers.includes(blocker)) blockers.push(blocker);
}

function validRequiredIdentityFields(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0 && value.every((field) =>
    typeof field === "string" && /^[a-z][a-z0-9_]{0,63}$/.test(field)
  );
}

async function loadReadiness(
  tx: Tx,
  input: CheckInReadinessInput,
  lock: boolean,
): Promise<ReadinessState> {
  const reservationRows = lock
    ? await tx<ReservationRow[]>`
        SELECT reservation.id, reservation.status, reservation.primary_party, reservation.property_node,
               NULLIF(config #>> '{statutory_adapter_key}', '') AS statutory_adapter_key
        FROM reservation
        JOIN org_node AS property
          ON property.tenant_id = reservation.tenant_id
         AND property.id = reservation.property_node
         AND property.kind = 'property'
        WHERE reservation.tenant_id = ${input.tenantId}::uuid
          AND reservation.tenant_id = current_setting('app.tenant_id', true)::uuid
          AND reservation.property_node = ${input.propertyNode}::uuid
          AND reservation.id = ${input.reservationId}::uuid
        FOR UPDATE OF reservation
      `
    : await tx<ReservationRow[]>`
        SELECT reservation.id, reservation.status, reservation.primary_party, reservation.property_node,
               NULLIF(config #>> '{statutory_adapter_key}', '') AS statutory_adapter_key
        FROM reservation
        JOIN org_node AS property
          ON property.tenant_id = reservation.tenant_id
         AND property.id = reservation.property_node
         AND property.kind = 'property'
        WHERE reservation.tenant_id = ${input.tenantId}::uuid
          AND reservation.tenant_id = current_setting('app.tenant_id', true)::uuid
          AND reservation.property_node = ${input.propertyNode}::uuid
          AND reservation.id = ${input.reservationId}::uuid
      `;
  const reservation = reservationRows[0];
  if (!reservation) {
    throw new CheckInNotFoundError("Reservation was not found in the active property");
  }

  const segmentRows = lock
    ? await tx<SegmentRow[]>`
        SELECT id, sellable_unit_id, status
        FROM reservation_segment
        WHERE tenant_id = ${input.tenantId}::uuid
          AND tenant_id = current_setting('app.tenant_id', true)::uuid
          AND reservation_id = ${input.reservationId}::uuid
          AND status = 'booked'
          AND period @> transaction_timestamp()
        ORDER BY seq, id
        LIMIT 2
        FOR UPDATE
      `
    : await tx<SegmentRow[]>`
        SELECT id, sellable_unit_id, status
        FROM reservation_segment
        WHERE tenant_id = ${input.tenantId}::uuid
          AND tenant_id = current_setting('app.tenant_id', true)::uuid
          AND reservation_id = ${input.reservationId}::uuid
          AND status = 'booked'
          AND period @> transaction_timestamp()
        ORDER BY seq, id
        LIMIT 2
      `;
  const segment = segmentRows[0];

  let spaces: readonly SpaceRow[] = Object.freeze([]);
  if (segment?.sellable_unit_id) {
    spaces = await tx<SpaceRow[]>`
      SELECT mapping.space_id, condition.condition
      FROM sellable_unit_space AS mapping
      JOIN space
        ON space.tenant_id = mapping.tenant_id
       AND space.id = mapping.space_id
       AND space.property_node = ${input.propertyNode}::uuid
       AND space.status = 'active'
      LEFT JOIN unit_condition AS condition
        ON condition.tenant_id = mapping.tenant_id
       AND condition.space_id = mapping.space_id
      WHERE mapping.tenant_id = ${input.tenantId}::uuid
        AND mapping.tenant_id = current_setting('app.tenant_id', true)::uuid
        AND mapping.sellable_unit_id = ${segment.sellable_unit_id}::uuid
      ORDER BY mapping.space_id
      LIMIT 2
    `;
  }

  const folios = await tx<FolioRow[]>`
    SELECT folio.id
    FROM folio
    JOIN account
      ON account.tenant_id = folio.tenant_id
     AND account.id = folio.account_id
     AND account.property_node = ${input.propertyNode}::uuid
     AND account.role = 'guest'
     AND account.status = 'open'
    WHERE folio.tenant_id = ${input.tenantId}::uuid
      AND folio.tenant_id = current_setting('app.tenant_id', true)::uuid
      AND folio.reservation_id = ${input.reservationId}::uuid
      AND folio.window_no = 1
      AND folio.status = 'open'
    ORDER BY folio.id
    LIMIT 2
  `;

  let adapter: AdapterRow | undefined;
  if (reservation.statutory_adapter_key !== null) {
    const adapters = await tx<AdapterRow[]>`
      SELECT key, content -> 'required_identity_fields' AS required_identity_fields
      FROM extension
      WHERE tenant_id = ${input.tenantId}::uuid
        AND tenant_id = current_setting('app.tenant_id', true)::uuid
        AND type = 'statutory_adapter'
        AND key = ${reservation.statutory_adapter_key}
        AND status = 'active'
        AND effective @> transaction_timestamp()
      ORDER BY version DESC, id DESC
      LIMIT 2
    `;
    if (adapters.length === 1 && validRequiredIdentityFields(adapters[0]!.required_identity_fields)) {
      adapter = adapters[0];
    }
  }

  let identitySatisfied = true;
  if (adapter) {
    const count = (await tx<IdentityCountRow[]>`
      WITH required_party AS (
        SELECT ${reservation.primary_party}::uuid AS party_id
        UNION
        SELECT guest.party_id
        FROM reservation_guest AS guest
        WHERE guest.tenant_id = ${input.tenantId}::uuid
          AND guest.tenant_id = current_setting('app.tenant_id', true)::uuid
          AND guest.reservation_id = ${input.reservationId}::uuid
      )
      SELECT count(*)::int AS party_count,
             count(*) FILTER (WHERE EXISTS (
               SELECT 1
               FROM identity_document AS document
               WHERE document.tenant_id = ${input.tenantId}::uuid
                 AND document.tenant_id = current_setting('app.tenant_id', true)::uuid
                 AND document.party_id = required_party.party_id
             ))::int AS documented_party_count
      FROM required_party
    `)[0];
    identitySatisfied = count !== undefined && count.party_count > 0 &&
      count.documented_party_count === count.party_count;
  }

  const blockers: CheckInBlocker[] = [];
  if (reservation.status !== "due_in") addBlocker(blockers, "reservation_not_due_in");
  if (!segment || segmentRows.length !== 1 || segment.status !== "booked") {
    addBlocker(blockers, "active_segment_missing");
  }
  if (!segment?.sellable_unit_id) addBlocker(blockers, "room_assignment_missing");
  if (segment?.sellable_unit_id && spaces.length !== 1) addBlocker(blockers, "room_mapping_invalid");
  const space = spaces.length === 1 ? spaces[0]! : undefined;
  const roomCondition = asCondition(space?.condition ?? null);
  if (space && roomCondition === null) addBlocker(blockers, "room_condition_missing");
  const dirtyRoomOverrideRequired = roomCondition === "dirty" || roomCondition === "pickup";
  if (dirtyRoomOverrideRequired && !input.dirtyRoomOverrideAuthorized) {
    addBlocker(blockers, "dirty_room_override_unauthorized");
  } else if (roomCondition !== null && roomCondition !== "clean" && roomCondition !== "inspected" &&
      !dirtyRoomOverrideRequired) {
    addBlocker(blockers, "room_not_ready");
  }
  if (folios.length !== 1) addBlocker(blockers, "primary_folio_not_open");
  if (reservation.statutory_adapter_key !== null && !adapter) {
    addBlocker(blockers, "statutory_adapter_unavailable");
  } else if (adapter && !identitySatisfied) {
    addBlocker(blockers, "identity_document_missing");
  }

  const identityGate: CheckInIdentityGate = Object.freeze({
    required: adapter !== undefined,
    satisfied: adapter === undefined || identitySatisfied,
    adapterKey: adapter?.key ?? null,
  });
  const result: CheckInReadiness = Object.freeze({
    reservationId: reservation.id,
    status: reservation.status,
    segmentId: segmentRows.length === 1 ? segment!.id : null,
    assignedSpaceId: space?.space_id ?? null,
    primaryFolioId: folios.length === 1 ? folios[0]!.id : null,
    roomCondition,
    identityGate,
    dirtyRoomOverrideRequired,
    dirtyRoomOverrideAuthorized: input.dirtyRoomOverrideAuthorized,
    blockers: Object.freeze(blockers),
    canCheckIn: blockers.length === 0,
  });
  return Object.freeze({ result, primaryPartyId: reservation.primary_party });
}

function translateDatabaseError(error: unknown): never {
  const state = (error as { errno?: unknown; code?: unknown }).errno ??
    (error as { code?: unknown }).code;
  if (state === "23505" || state === "40001" || state === "40P01") {
    throw new CheckInConflictError("Check-in state is unavailable or changed concurrently");
  }
  if (state === "42501") {
    throw new CheckInNotFoundError("Reservation was not found in the active property");
  }
  throw error;
}

export class CheckInService {
  readonly #database: Database;
  readonly #events: EventBus;
  readonly #idempotency: PostgresIdempotency;

  constructor(options: CheckInServiceOptions) {
    this.#database = options.database;
    this.#events = options.events;
    this.#idempotency = options.idempotency;
  }

  async getReadiness(input: CheckInReadinessInput): Promise<CheckInReadiness> {
    const normalized = readinessInput(input);
    try {
      return await this.#database.withTenantTransaction(normalized.tenantId, async (tx) =>
        (await loadReadiness(tx, normalized, false)).result
      );
    } catch (error) {
      return translateDatabaseError(error);
    }
  }

  async checkIn(input: CheckInInput): Promise<CheckInResult> {
    const normalized = commandInput(input);
    try {
      const outcome = await this.#database.withTenantTransaction(normalized.tenantId, (tx) =>
        this.#idempotency.execute<CheckInResult>(tx, {
          tenantId: normalized.tenantId,
          operation: "stay.checkin.commit",
          key: normalized.idempotencyKey,
          request: {
            actorId: normalized.envelope.actorId,
            propertyNode: normalized.envelope.propertyNode,
            reservationId: normalized.reservationId,
            dirtyRoomOverrideAuthorized: normalized.dirtyRoomOverrideAuthorized,
            dirtyRoomOverrideReason: normalized.dirtyRoomOverrideReason ?? null,
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
            throw new CheckInNotFoundError("Check-in actor was not found in the active tenant");
          }
          const state = await loadReadiness(commandTx, {
            tenantId: normalized.tenantId,
            propertyNode: normalized.envelope.propertyNode,
            reservationId: normalized.reservationId,
            dirtyRoomOverrideAuthorized: normalized.dirtyRoomOverrideAuthorized,
          }, true);
          const readiness = state.result;
          if (!readiness.canCheckIn) {
            throw new CheckInConflictError("Reservation is not ready for check-in", readiness.blockers);
          }
          if (!readiness.segmentId || !readiness.assignedSpaceId || !readiness.primaryFolioId ||
              !readiness.roomCondition) {
            throw new CheckInConflictError("Reservation readiness evidence is incomplete");
          }
          const dirtyRoomOverrideUsed = readiness.dirtyRoomOverrideRequired;
          if (dirtyRoomOverrideUsed && normalized.dirtyRoomOverrideReason === undefined) {
            throw new CheckInValidationError("dirty-room override requires a reason");
          }
          if (!dirtyRoomOverrideUsed && normalized.dirtyRoomOverrideReason !== undefined) {
            throw new CheckInValidationError("dirty-room override reason is not valid for a ready room");
          }

          const segmentRows = await commandTx<Array<{ id: string }>>`
            UPDATE reservation_segment
            SET status = 'in_house'
            WHERE tenant_id = ${normalized.tenantId}::uuid
              AND tenant_id = current_setting('app.tenant_id', true)::uuid
              AND reservation_id = ${normalized.reservationId}::uuid
              AND id = ${readiness.segmentId}::uuid
              AND status = 'booked'
            RETURNING id
          `;
          const reservationRows = await commandTx<Array<{ id: string }>>`
            UPDATE reservation
            SET status = 'in_house'
            WHERE tenant_id = ${normalized.tenantId}::uuid
              AND tenant_id = current_setting('app.tenant_id', true)::uuid
              AND property_node = ${normalized.envelope.propertyNode}::uuid
              AND id = ${normalized.reservationId}::uuid
              AND status = 'due_in'
            RETURNING id
          `;
          if (segmentRows.length !== 1 || reservationRows.length !== 1) {
            throw new CheckInConflictError("Reservation check-in state changed concurrently");
          }

          const payload = Object.freeze({
            segment_id: readiness.segmentId,
            space_id: readiness.assignedSpaceId,
            primary_folio_id: readiness.primaryFolioId,
            room_condition: readiness.roomCondition,
            dirty_room_override_used: dirtyRoomOverrideUsed,
            dirty_room_override_reason: dirtyRoomOverrideUsed ? normalized.dirtyRoomOverrideReason! : null,
            statutory_adapter_key: readiness.identityGate.adapterKey,
            identity_evidence_required: readiness.identityGate.required,
            identity_evidence_satisfied: readiness.identityGate.satisfied,
          });
          const fact = await recordFact(commandTx, {
            entityType: "reservation",
            entityId: normalized.reservationId,
            envelope: normalized.envelope,
            payload,
          });
          await this.#events.publish(commandTx, {
            tenantId: normalized.tenantId,
            propertyNode: normalized.envelope.propertyNode,
            businessDate: fact.businessDate,
            aggregateType: "reservation",
            aggregateId: normalized.reservationId,
            eventType: "reservation.checked_in",
            actorId: normalized.envelope.actorId,
            correlationId: normalized.envelope.requestId,
            payload,
          });

          return {
            status: 200,
            body: Object.freeze({
              reservationId: normalized.reservationId,
              reservationStatus: "in_house" as const,
              segmentId: readiness.segmentId,
              segmentStatus: "in_house" as const,
              assignedSpaceId: readiness.assignedSpaceId,
              primaryFolioId: readiness.primaryFolioId,
              roomCondition: readiness.roomCondition,
              dirtyRoomOverrideUsed,
              identityGate: readiness.identityGate,
              replayed: false,
            }),
          };
        })
      );
      return Object.freeze({ ...outcome.body, replayed: outcome.replayed });
    } catch (error) {
      return translateDatabaseError(error);
    }
  }
}
