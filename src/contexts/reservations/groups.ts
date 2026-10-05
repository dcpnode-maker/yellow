import { recordFact, type AuditEnvelope, type EventBus, type JsonValue, type PostgresIdempotency, type Tx } from "../../kernel";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const KEY = /^[\x21-\x7e]{8,200}$/;
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/u;

export class GroupReservationValidationError extends Error { constructor(message: string) { super(message); this.name = "GroupReservationValidationError"; } }
export class GroupReservationNotFoundError extends Error { constructor(message: string) { super(message); this.name = "GroupReservationNotFoundError"; } }
export class GroupReservationConflictError extends Error { constructor(message: string) { super(message); this.name = "GroupReservationConflictError"; } }

export interface GroupReservationHeader extends Readonly<Record<string, JsonValue>> {
  readonly groupId: string;
  readonly kind: "linked" | "block" | "share";
  readonly code: string;
  readonly name: string;
  readonly status: string;
  readonly memberCount: number;
  readonly roomsHeldByGroup: false | null;
}
export interface GroupReservationMember extends Readonly<Record<string, JsonValue>> {
  readonly reservationId: string;
  readonly confirmationNo: string;
  readonly guestName: string;
  readonly status: string;
}
export interface GroupReservationPage {
  readonly groups: readonly GroupReservationHeader[];
  readonly nextCursor: string | null;
}
export interface GroupReservationDetail {
  readonly group: GroupReservationHeader;
  readonly members: readonly GroupReservationMember[];
  readonly nextMemberCursor: string | null;
}
export interface GroupReservationCandidate extends GroupReservationMember {
  readonly currentGroupId: string | null;
}
export interface GroupReservationServiceOptions {
  readonly events: EventBus;
  readonly idempotency: PostgresIdempotency;
  readonly idFactory?: () => string;
}
interface GroupRow {
  readonly id: string; readonly kind: string; readonly code: string; readonly name: string | null;
  readonly status: string; readonly member_count: number;
}
interface MemberRow {
  readonly id: string; readonly confirmation_no: string; readonly guest_name: string; readonly status: string;
}
interface AttachRow { readonly id: string; readonly status: string; readonly group_id: string | null; }
function uuid(value: string, label: string): string {
  if (!UUID.test(value)) throw new GroupReservationValidationError(`${label} must be a UUID`);
  return value;
}
function envelope(value: AuditEnvelope, operation: string): void {
  uuid(value.tenantId, "tenantId"); uuid(value.propertyNode, "propertyNode");
  uuid(value.actorId, "actorId"); uuid(value.requestId, "requestId");
  if (value.operation !== operation) throw new GroupReservationValidationError("audit operation is invalid");
}
function key(value: string): string {
  if (!KEY.test(value)) throw new GroupReservationValidationError("idempotency key is invalid");
  return value;
}
export function groupName(value: unknown): string {
  if (typeof value !== "string") throw new GroupReservationValidationError("Group name is required");
  const name = value.trim();
  if (name.length < 1 || Array.from(name).length > 120 || CONTROL.test(name)) {
    throw new GroupReservationValidationError("Group name must contain 1-120 safe characters");
  }
  return name;
}
function header(row: GroupRow): GroupReservationHeader {
  if (!UUID.test(row.id) || !["linked", "block", "share"].includes(row.kind) ||
      typeof row.code !== "string" || row.code.length < 1 ||
      typeof row.status !== "string" || row.status.length < 1 ||
      !Number.isInteger(row.member_count) || row.member_count < 0) {
    throw new GroupReservationConflictError("Stored group is invalid");
  }
  return Object.freeze({ groupId: row.id, kind: row.kind as GroupReservationHeader["kind"],
    code: row.code, name: row.name ?? row.code, status: row.status,
    memberCount: row.member_count, roomsHeldByGroup: row.kind === "linked" ? false : null });
}
function member(row: MemberRow): GroupReservationMember {
  if (!UUID.test(row.id) || !row.confirmation_no || !row.guest_name || !row.status) {
    throw new GroupReservationConflictError("Stored group member is invalid");
  }
  return Object.freeze({ reservationId: row.id, confirmationNo: row.confirmation_no,
    guestName: row.guest_name, status: row.status });
}
function limit(value: number, max: number): number {
  if (!Number.isInteger(value) || value < 1 || value > max) throw new GroupReservationValidationError(`limit must be 1-${max}`);
  return value;
}
function cursor(value: string | null): string | null {
  return value === null ? null : uuid(value, "cursor");
}
function databaseError(error: unknown): never {
  const state = (error as { code?: string; errno?: string }).code ?? (error as { errno?: string }).errno;
  if (state === "42501") throw new GroupReservationNotFoundError("Group or reservation is not available");
  if (state === "23505" || state === "40001" || state === "40P01") throw new GroupReservationConflictError("Group state changed; refresh before retrying");
  throw error;
}

export class GroupReservationService {
  readonly #events: EventBus;
  readonly #idempotency: PostgresIdempotency;
  readonly #idFactory: () => string;
  constructor(options: GroupReservationServiceOptions) {
    this.#events = options.events; this.#idempotency = options.idempotency;
    this.#idFactory = options.idFactory ?? (() => crypto.randomUUID());
  }

  async list(tx: Tx, input: { tenantId: string; propertyNode: string; limit: number; cursor: string | null; query?: string | null }): Promise<GroupReservationPage> {
    uuid(input.tenantId, "tenantId"); uuid(input.propertyNode, "propertyNode");
    const take = limit(input.limit, 100), after = cursor(input.cursor);
    const query = input.query == null ? null : input.query.trim();
    if (query !== null && (Array.from(query).length < 2 || Array.from(query).length > 100 ||
        CONTROL.test(input.query!) || CONTROL.test(query)))
      throw new GroupReservationValidationError("Group search query is invalid");
    const rows = await tx<GroupRow[]>`
      SELECT g.id, g.kind, g.code, g.name, g.status,
             (SELECT count(*)::int FROM reservation r WHERE r.tenant_id = g.tenant_id
                AND r.property_node = g.property_node AND r.group_id = g.id) AS member_count
      FROM reservation_group g
      JOIN org_node p ON p.id = g.property_node AND p.tenant_id = g.tenant_id AND p.kind = 'property'
      WHERE g.tenant_id = ${input.tenantId}::uuid
        AND g.tenant_id = current_setting('app.tenant_id', true)::uuid
        AND g.property_node = ${input.propertyNode}::uuid
        AND (${query}::text IS NULL OR strpos(lower(g.name), lower(${query}::text)) > 0
          OR strpos(lower(g.code), lower(${query}::text)) > 0)
        AND (${after}::uuid IS NULL OR g.id > ${after}::uuid)
      ORDER BY g.id LIMIT ${take + 1}
    `;
    return Object.freeze({ groups: Object.freeze(rows.slice(0, take).map(header)),
      nextCursor: rows.length > take ? rows[take - 1]!.id : null });
  }

  async detail(tx: Tx, input: { tenantId: string; propertyNode: string; groupId: string; memberLimit: number; memberCursor: string | null }): Promise<GroupReservationDetail> {
    uuid(input.tenantId, "tenantId"); uuid(input.propertyNode, "propertyNode"); uuid(input.groupId, "groupId");
    const take = limit(input.memberLimit, 100), after = cursor(input.memberCursor);
    const groups = await tx<GroupRow[]>`
      SELECT g.id, g.kind, g.code, g.name, g.status,
             (SELECT count(*)::int FROM reservation r WHERE r.tenant_id = g.tenant_id
                AND r.property_node = g.property_node AND r.group_id = g.id) AS member_count
      FROM reservation_group g
      JOIN org_node p ON p.id = g.property_node AND p.tenant_id = g.tenant_id AND p.kind = 'property'
      WHERE g.id = ${input.groupId}::uuid AND g.tenant_id = ${input.tenantId}::uuid
        AND g.tenant_id = current_setting('app.tenant_id', true)::uuid
        AND g.property_node = ${input.propertyNode}::uuid
    `;
    if (groups.length !== 1) throw new GroupReservationNotFoundError("Group was not found in the active property");
    const rows = await tx<MemberRow[]>`
      SELECT r.id, r.confirmation_no, coalesce(p.display_name, r.confirmation_no) AS guest_name, r.status
      FROM reservation r
      LEFT JOIN party p ON p.id = r.primary_party AND p.tenant_id = r.tenant_id
      WHERE r.tenant_id = ${input.tenantId}::uuid
        AND r.tenant_id = current_setting('app.tenant_id', true)::uuid
        AND r.property_node = ${input.propertyNode}::uuid AND r.group_id = ${input.groupId}::uuid
        AND (${after}::uuid IS NULL OR r.id > ${after}::uuid)
      ORDER BY r.id LIMIT ${take + 1}
    `;
    return Object.freeze({ group: header(groups[0]!), members: Object.freeze(rows.slice(0, take).map(member)),
      nextMemberCursor: rows.length > take ? rows[take - 1]!.id : null });
  }

  async candidate(tx: Tx, input: { tenantId: string; propertyNode: string; groupId: string; confirmationNo: string }): Promise<GroupReservationCandidate | null> {
    uuid(input.tenantId, "tenantId"); uuid(input.propertyNode, "propertyNode"); uuid(input.groupId, "groupId");
    if (typeof input.confirmationNo !== "string" || input.confirmationNo.length < 1 ||
        input.confirmationNo.length > 120 || CONTROL.test(input.confirmationNo)) {
      throw new GroupReservationValidationError("Confirmation number is invalid");
    }
    const groups = await tx<Array<{ id: string }>>`
      SELECT id FROM reservation_group WHERE id = ${input.groupId}::uuid
        AND tenant_id = ${input.tenantId}::uuid AND tenant_id = current_setting('app.tenant_id', true)::uuid
        AND property_node = ${input.propertyNode}::uuid AND kind = 'linked'
    `;
    if (groups.length !== 1) throw new GroupReservationNotFoundError("Linked group was not found in the active property");
    const rows = await tx<Array<MemberRow & { group_id: string | null; visible_group_id: string | null }>>`
      SELECT r.id, r.confirmation_no, coalesce(p.display_name, r.confirmation_no) AS guest_name,
             r.status, r.group_id, current_group.id AS visible_group_id
      FROM reservation r LEFT JOIN party p ON p.id = r.primary_party AND p.tenant_id = r.tenant_id
      LEFT JOIN reservation_group current_group ON current_group.id = r.group_id
        AND current_group.tenant_id = r.tenant_id AND current_group.property_node = r.property_node
      WHERE r.tenant_id = ${input.tenantId}::uuid
        AND r.tenant_id = current_setting('app.tenant_id', true)::uuid
        AND r.property_node = ${input.propertyNode}::uuid
        AND r.confirmation_no = ${input.confirmationNo}
        AND r.status IN ('reserved','due_in')
      ORDER BY r.id LIMIT 2
    `;
    if (rows.length > 1) throw new GroupReservationConflictError("Confirmation number is not unique in the property");
    const row = rows[0];
    if (!row) return null;
    if (row.group_id !== null && row.visible_group_id !== row.group_id) {
      throw new GroupReservationConflictError("Stored reservation group reference is not coherent");
    }
    const base = member(row);
    return Object.freeze({ ...base, currentGroupId: row.group_id });
  }

  async create(tx: Tx, input: { name: string; idempotencyKey: string; envelope: AuditEnvelope }): Promise<{ group: GroupReservationHeader; replayed: boolean }> {
    envelope(input.envelope, "group.created"); const name = groupName(input.name); key(input.idempotencyKey);
    try {
      const outcome = await this.#idempotency.execute(tx, {
        tenantId: input.envelope.tenantId, operation: "group.create", key: input.idempotencyKey,
        request: { actorId: input.envelope.actorId, propertyNode: input.envelope.propertyNode, name },
      }, async (commandTx) => {
        const id = uuid(this.#idFactory(), "generated group id");
        const code = `GRP-${id.replaceAll("-", "").toUpperCase()}`;
        const rows = await commandTx<GroupRow[]>`
          INSERT INTO reservation_group(tenant_id, property_node, id, kind, code, name, status)
          SELECT ${input.envelope.tenantId}::uuid, p.id, ${id}::uuid, 'linked', ${code}, ${name}, 'tentative'
          FROM org_node p
          WHERE p.id = ${input.envelope.propertyNode}::uuid AND p.tenant_id = ${input.envelope.tenantId}::uuid
            AND p.tenant_id = current_setting('app.tenant_id', true)::uuid AND p.kind = 'property'
          RETURNING id, kind, code, name, status, 0::int AS member_count
        `;
        if (rows.length !== 1) throw new GroupReservationNotFoundError("Property was not found");
        const group = header(rows[0]!);
        const fact = await recordFact(commandTx, { entityType: "reservation_group", entityId: id,
          envelope: input.envelope, payload: { kind: "linked", code, name } });
        await this.#events.publish(commandTx, { tenantId: input.envelope.tenantId,
          propertyNode: input.envelope.propertyNode, businessDate: fact.businessDate,
          aggregateType: "reservation_group", aggregateId: id, eventType: "group.created",
          actorId: input.envelope.actorId, correlationId: input.envelope.requestId,
          payload: { group_id: id, kind: "linked", code, name } });
        return { status: 201, body: { group } };
      });
      return Object.freeze({ group: outcome.body.group, replayed: outcome.replayed });
    } catch (error) { return databaseError(error); }
  }

  async attach(tx: Tx, input: { groupId: string; reservationId: string; expectedGroupId: null; idempotencyKey: string; envelope: AuditEnvelope }): Promise<{ groupId: string; reservationId: string; changed: boolean; replayed: boolean }> {
    envelope(input.envelope, "reservation.group_linked");
    uuid(input.groupId, "groupId"); uuid(input.reservationId, "reservationId"); key(input.idempotencyKey);
    if (input.expectedGroupId !== null) throw new GroupReservationValidationError("expectedGroupId must be null");
    try {
      const outcome = await this.#idempotency.execute(tx, {
        tenantId: input.envelope.tenantId, operation: "group.member.attach", key: input.idempotencyKey,
        request: { actorId: input.envelope.actorId, propertyNode: input.envelope.propertyNode,
          groupId: input.groupId, reservationId: input.reservationId, expectedGroupId: null },
      }, async (commandTx) => {
        const groups = await commandTx<Array<{ id: string }>>`
          SELECT id FROM reservation_group WHERE id = ${input.groupId}::uuid
            AND tenant_id = ${input.envelope.tenantId}::uuid
            AND tenant_id = current_setting('app.tenant_id', true)::uuid
            AND property_node = ${input.envelope.propertyNode}::uuid AND kind = 'linked'
        `;
        if (groups.length !== 1) throw new GroupReservationNotFoundError("Linked group was not found in the active property");
        const reservations = await commandTx<AttachRow[]>`
          SELECT id, status, group_id FROM reservation WHERE id = ${input.reservationId}::uuid
            AND tenant_id = ${input.envelope.tenantId}::uuid
            AND tenant_id = current_setting('app.tenant_id', true)::uuid
            AND property_node = ${input.envelope.propertyNode}::uuid FOR UPDATE
        `;
        const reservation = reservations[0];
        if (reservations.length !== 1 || !reservation) throw new GroupReservationNotFoundError("Reservation was not found in the active property");
        if (reservation.status !== "reserved" && reservation.status !== "due_in") {
          throw new GroupReservationConflictError("Only reserved or due-in reservations can join a group");
        }
        if (reservation.group_id !== null) throw new GroupReservationConflictError("Reservation is already associated with a group");
        const updated = await commandTx<Array<{ id: string }>>`
          UPDATE reservation SET group_id = ${input.groupId}::uuid
          WHERE id = ${input.reservationId}::uuid AND tenant_id = ${input.envelope.tenantId}::uuid
            AND tenant_id = current_setting('app.tenant_id', true)::uuid
            AND property_node = ${input.envelope.propertyNode}::uuid
            AND group_id IS NULL AND status IN ('reserved','due_in') RETURNING id
        `;
        if (updated.length !== 1) throw new GroupReservationConflictError("Reservation group changed concurrently");
        const fact = await recordFact(commandTx, { entityType: "reservation", entityId: input.reservationId,
          envelope: input.envelope, payload: { diff: { group_id: { before: null, after: input.groupId } } } });
        await this.#events.publish(commandTx, { tenantId: input.envelope.tenantId,
          propertyNode: input.envelope.propertyNode, businessDate: fact.businessDate,
          aggregateType: "reservation", aggregateId: input.reservationId, eventType: "reservation.group_linked",
          actorId: input.envelope.actorId, correlationId: input.envelope.requestId,
          payload: { group_id: input.groupId, reservation_id: input.reservationId } });
        return { status: 200, body: { groupId: input.groupId, reservationId: input.reservationId, changed: true } };
      });
      return Object.freeze({ ...outcome.body, replayed: outcome.replayed });
    } catch (error) { return databaseError(error); }
  }
}
