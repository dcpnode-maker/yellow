import { PostgresIdempotency, type Tx, type JsonValue } from "../../kernel";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const KEY = /^[\x21-\x7e]{8,200}$/;
export const DEPARTURE_SERVICE_KINDS = ["luggage_pickup", "minibar_check", "room_inspection", "escalation"] as const;
export const DEPARTURE_SERVICE_ACTIONS = ["confirm", "withdraw", "assign", "start", "complete"] as const;
export type DepartureServiceKind = typeof DEPARTURE_SERVICE_KINDS[number];
export type DepartureServiceAction = typeof DEPARTURE_SERVICE_ACTIONS[number];
export type DepartureServiceOutcome = "clear" | "finding_reported" | "unable_to_complete";
export interface DepartureServiceProposal {
  readonly serviceKind: DepartureServiceKind;
  readonly targetRoleId: string;
  readonly schedule: { readonly mode: "immediate" | "delay" | "custom"; readonly minutes: number | null;
    readonly localAt: string | null; readonly utcOffsetMinutes: number | null };
  readonly expected: { readonly segmentId: string; readonly spaceId: string; readonly departureAt: string };
  readonly parentRequestId: string | null;
}
export interface DepartureServiceActionBody {
  readonly expectedVersion: number;
  readonly staffPartyId: string | null;
  readonly outcome: DepartureServiceOutcome | null;
}
export interface DepartureServiceIdentity {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly actorId: string;
}
export interface DepartureServiceRequest extends Readonly<Record<string, JsonValue>> {
  readonly requestId: string; readonly reservationId: string; readonly segmentId: string; readonly spaceId: string;
  readonly serviceKind: DepartureServiceKind; readonly parentRequestId: string | null;
  readonly targetRoleId: string; readonly targetRoleName: string;
  readonly proposalStatus: "pending" | "confirmed" | "withdrawn";
  readonly version: number; readonly expiresAt: string; readonly departureAt: string;
  readonly dueAt: string; readonly dueLocal: string; readonly timezone: string;
  readonly taskId: string | null; readonly taskStatus: "open" | "assigned" | "in_progress" | "done" | null;
  readonly assigneePartyId: string | null; readonly outcome: DepartureServiceOutcome | null;
  readonly completedAt: string | null; readonly eligibleActions: readonly string[];
}
export class DepartureServiceError extends Error {
  constructor(readonly kind: "invalid" | "forbidden" | "not_found" | "conflict", message: string) {
    super(message); this.name = "DepartureServiceError";
  }
}
function invalid(): never { throw new DepartureServiceError("invalid", "Departure service input is invalid"); }
function object(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) ||
    Object.getOwnPropertySymbols(value).length || Object.getOwnPropertyNames(value).length !== keys.length ||
    keys.some((k) => !Object.hasOwn(value, k))) return invalid();
  return value as Record<string, unknown>;
}
function uuid(value: unknown): string { if (typeof value !== "string" || !UUID.test(value)) return invalid(); return value; }
export function normalizeDepartureServiceProposal(value: unknown): DepartureServiceProposal {
  const body = object(value, ["serviceKind", "targetRoleId", "schedule", "expected", "parentRequestId"]);
  if (!DEPARTURE_SERVICE_KINDS.includes(body.serviceKind as DepartureServiceKind)) return invalid();
  const serviceKind = body.serviceKind as DepartureServiceKind;
  const parentRequestId = body.parentRequestId === null ? null : uuid(body.parentRequestId);
  if ((serviceKind === "escalation") !== (parentRequestId !== null)) return invalid();
  const expected = object(body.expected, ["segmentId", "spaceId", "departureAt"]);
  if (typeof expected.departureAt !== "string" ||
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?Z$/.test(expected.departureAt) ||
    !Number.isFinite(Date.parse(expected.departureAt))) return invalid();
  const schedule = object(body.schedule, ["mode", "minutes", "localAt", "utcOffsetMinutes"]);
  if (schedule.mode === "immediate") {
    if (schedule.minutes !== null || schedule.localAt !== null || schedule.utcOffsetMinutes !== null) return invalid();
  } else if (schedule.mode === "delay") {
    if (![10, 15, 30, 45].includes(schedule.minutes as number) || schedule.localAt !== null || schedule.utcOffsetMinutes !== null) return invalid();
  } else if (schedule.mode === "custom") {
    if (schedule.minutes !== null || typeof schedule.localAt !== "string" ||
      !/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d)?$/.test(schedule.localAt) ||
      !Number.isInteger(schedule.utcOffsetMinutes) || Math.abs(schedule.utcOffsetMinutes as number) > 840) return invalid();
  } else return invalid();
  return Object.freeze({ serviceKind, targetRoleId: uuid(body.targetRoleId), parentRequestId,
    schedule: Object.freeze({ ...schedule }) as DepartureServiceProposal["schedule"],
    expected: Object.freeze({ segmentId: uuid(expected.segmentId), spaceId: uuid(expected.spaceId), departureAt: expected.departureAt }) });
}
export function normalizeDepartureServiceAction(action: string, value: unknown): DepartureServiceActionBody {
  if (!DEPARTURE_SERVICE_ACTIONS.includes(action as DepartureServiceAction)) return invalid();
  const body = object(value, ["expectedVersion", "staffPartyId", "outcome"]);
  if (!Number.isSafeInteger(body.expectedVersion) || (body.expectedVersion as number) < 1 ||
      (body.expectedVersion as number) >= 2147483647) return invalid();
  const staffPartyId = body.staffPartyId === null ? null : uuid(body.staffPartyId);
  if ((action === "assign") !== (staffPartyId !== null)) return invalid();
  if (body.outcome !== null && (action !== "complete" ||
      !["clear", "finding_reported", "unable_to_complete"].includes(body.outcome as string))) return invalid();
  return Object.freeze({ expectedVersion: body.expectedVersion as number, staffPartyId,
    outcome: body.outcome as DepartureServiceOutcome | null });
}
function translate(error: unknown): never {
  const code = (error as { errno?: unknown; code?: unknown }).errno ?? (error as { code?: unknown }).code;
  if (code === "42501") throw new DepartureServiceError("forbidden", "Departure service access is not granted");
  if (code === "P0002") throw new DepartureServiceError("not_found", "Departure service target is unavailable");
  if (["40001", "23505", "55000"].includes(String(code))) throw new DepartureServiceError("conflict", "Departure service changed; refresh and confirm current details");
  if (["22023", "22P02", "22007", "22008", "23514", "22003"].includes(String(code))) return invalid();
  throw error;
}

/** All adapters use the existing tenant transaction; no nested transaction or detached work. */
export class DepartureServiceCoordinationService {
  constructor(readonly idempotency = new PostgresIdempotency()) {}

  async #authority(tx: Tx, identity: DepartureServiceIdentity, permission: string): Promise<void> {
    uuid(identity.tenantId); uuid(identity.propertyNode); uuid(identity.actorId);
    await tx`SELECT public.assert_departure_service_authority(
      ${identity.tenantId}::uuid,${identity.propertyNode}::uuid,${identity.actorId}::uuid,${permission})`;
  }
  async #permissions(tx: Tx, identity: DepartureServiceIdentity): Promise<Set<string>> {
    const rows = await tx<{ code: string }[]>`
      SELECT DISTINCT permission.permission_code AS code FROM public.app_user actor
      JOIN public.user_role membership ON membership.tenant_id=actor.tenant_id AND membership.user_id=actor.id
      JOIN public.role duty ON duty.tenant_id=actor.tenant_id AND duty.id=membership.role_id
      JOIN public.role_permission permission ON permission.role_id=duty.id
      JOIN public.org_node scope ON scope.tenant_id=actor.tenant_id AND scope.id=membership.scope_node
      JOIN public.org_node property ON property.tenant_id=actor.tenant_id AND property.id=${identity.propertyNode}::uuid AND scope.path @> property.path
      WHERE actor.tenant_id=${identity.tenantId}::uuid AND actor.id=${identity.actorId}::uuid AND actor.status='active'
    `;
    return new Set(rows.map((row) => row.code));
  }
  async #requests(tx: Tx, identity: DepartureServiceIdentity, reservationId: string | null, requestId: string | null = null) {
    const permissions = await this.#permissions(tx, identity);
    const rows = await tx<{ data: DepartureServiceRequest; expired: boolean; active_stay: boolean }[]>`
      SELECT jsonb_build_object(
        'requestId',r.id,'reservationId',r.reservation_id,'segmentId',r.segment_id,'spaceId',r.space_id,
        'serviceKind',r.service_kind,'parentRequestId',r.parent_request_id,'targetRoleId',r.target_role_id,
        'targetRoleName',role.name,'proposalStatus',r.proposal_status,'version',r.version,
        'expiresAt',to_char(r.expires_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
        'departureAt',to_char(r.departure_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
        'dueAt',to_char(r.due_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
        'dueLocal',to_char(r.due_at AT TIME ZONE property.timezone,'YYYY-MM-DD"T"HH24:MI:SS'),
        'timezone',property.timezone,'taskId',r.task_id,'taskStatus',task.status,
        'assigneePartyId',task.assignee_party,'outcome',r.outcome,
        'completedAt',to_char(task.completed_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
        'eligibleActions','[]'::jsonb) AS data,
        r.expires_at<=clock_timestamp() AS expired, reservation.status IN ('in_house','due_out') AS active_stay
      FROM public.departure_service_request r
      JOIN public.org_node property ON property.tenant_id=r.tenant_id AND property.id=r.property_node
      JOIN public.reservation reservation ON reservation.tenant_id=r.tenant_id AND reservation.id=r.reservation_id AND reservation.property_node=r.property_node
      JOIN public.role role ON role.tenant_id=r.tenant_id AND role.id=r.target_role_id
      LEFT JOIN public.task task ON task.tenant_id=r.tenant_id AND task.property_node=r.property_node AND task.id=r.task_id
      WHERE r.tenant_id=${identity.tenantId}::uuid AND r.property_node=${identity.propertyNode}::uuid
        AND (${reservationId}::uuid IS NULL OR r.reservation_id=${reservationId}::uuid)
        AND (${requestId}::uuid IS NULL OR r.id=${requestId}::uuid)
        AND (${reservationId}::uuid IS NOT NULL OR r.proposal_status='confirmed')
      ORDER BY r.due_at,r.id LIMIT 100
    `;
    return rows.map(({ data, expired, active_stay }) => {
      const eligible: string[] = [];
      const allows = (scope: string) => permissions.has(`stay-operations.departure-services:${scope}`);
      if (data.proposalStatus === "pending") {
        if (allows("request")) eligible.push("withdraw");
        if (!expired && active_stay && allows("confirm")) eligible.push("confirm");
      } else if (data.proposalStatus === "confirmed") {
        if (data.taskStatus === "open" && allows("dispatch")) eligible.push("assign");
        if (data.taskStatus === "assigned" && allows("work")) eligible.push("start");
        if (data.taskStatus === "in_progress" && allows("work")) eligible.push("complete");
        if (data.serviceKind !== "escalation" && active_stay && allows("escalate")) eligible.push("escalate");
      }
      return Object.freeze({ ...data, eligibleActions: Object.freeze(eligible) });
    });
  }
  async list(tx: Tx, identity: DepartureServiceIdentity, reservationId: string | null) {
    try {
      if (reservationId !== null) uuid(reservationId);
      await this.#authority(tx, identity, "read");
      const requests = await this.#requests(tx, identity, reservationId);
      const roles = await tx<{ roleId: string; name: string }[]>`
        SELECT DISTINCT duty.id AS "roleId",duty.name FROM public.role duty
        JOIN public.role_permission permission ON permission.role_id=duty.id AND permission.permission_code='stay-operations.departure-services:read'
        JOIN public.user_role membership ON membership.tenant_id=duty.tenant_id AND membership.role_id=duty.id AND membership.scope_node=${identity.propertyNode}::uuid
        JOIN public.app_user colleague ON colleague.tenant_id=duty.tenant_id AND colleague.id=membership.user_id AND colleague.status='active'
        WHERE duty.tenant_id=${identity.tenantId}::uuid AND duty.name IN
          ('Front Desk Cashier','Housekeeping Desk','Housekeeping Team Lead','Assistant Manager','Duty Manager')
        ORDER BY duty.name,duty.id
      `;
      const staff = await tx<{ partyId: string; name: string }[]>`
        SELECT p.id AS "partyId",p.display_name AS name FROM public.party p
        JOIN public.party_role role ON role.tenant_id=p.tenant_id AND role.party_id=p.id AND role.role='staff'
        WHERE p.tenant_id=${identity.tenantId}::uuid AND p.status='active' ORDER BY p.display_name,p.id LIMIT 100
      `;
      if (reservationId === null) return { requests, roles, staff };
      const rows = await tx<{ status: string; timezone: string; evidence: JsonValue }[]>`
        SELECT reservation.status,property.timezone,public.read_departure_service_evidence(
          ${identity.tenantId}::uuid,${identity.propertyNode}::uuid,${reservationId}::uuid,${identity.actorId}::uuid) AS evidence
        FROM public.reservation reservation JOIN public.org_node property
          ON property.tenant_id=reservation.tenant_id AND property.id=reservation.property_node
        WHERE reservation.tenant_id=${identity.tenantId}::uuid AND reservation.property_node=${identity.propertyNode}::uuid AND reservation.id=${reservationId}::uuid
      `;
      if (!rows[0]) throw new DepartureServiceError("not_found", "Reservation is unavailable");
      return { reservationId, reservationStatus: rows[0].status, timezone: rows[0].timezone, evidence: rows[0].evidence, roles, staff, requests };
    } catch (error) { return translate(error); }
  }
  async command(tx: Tx, identity: DepartureServiceIdentity, reservationId: string, requestId: string | null,
    action: "propose" | DepartureServiceAction, body: unknown, idempotencyKey: string, correlationId: string) {
    uuid(reservationId); uuid(correlationId);
    if (typeof idempotencyKey !== "string" || !KEY.test(idempotencyKey)) return invalid();
    if ((action === "propose") !== (requestId === null)) return invalid();
    if (requestId !== null) uuid(requestId);
    const input = action === "propose" ? normalizeDepartureServiceProposal(body) : normalizeDepartureServiceAction(action, body);
    const permission = action === "propose" ? ((input as DepartureServiceProposal).serviceKind === "escalation" ? "escalate" : "request")
      : action === "confirm" ? "confirm" : action === "withdraw" ? "request" : action === "assign" ? "dispatch" : "work";
    try {
      await this.#authority(tx, identity, permission);
      const result = await this.idempotency.execute(tx, {
        tenantId: identity.tenantId, operation: `departure-service.${action}`, key: idempotencyKey,
        request: { ...identity, reservationId, requestId, action, input },
      }, async (commandTx) => {
        const rows = await commandTx<{ id: string }[]>`SELECT public.command_departure_service(
          ${identity.tenantId}::uuid,${identity.propertyNode}::uuid,${reservationId}::uuid,${requestId}::uuid,
          ${identity.actorId}::uuid,${correlationId}::uuid,${action},${JSON.stringify(input)}::jsonb) AS id`;
        if (rows.length !== 1 || !rows[0]) throw new Error("Departure service command omitted evidence");
        const request = (await this.#requests(commandTx, identity, reservationId, uuid(rows[0].id)))[0];
        if (!request) throw new Error("Departure service request disappeared");
        return { status: action === "propose" ? 201 : 200, body: { request } };
      });
      await this.#authority(tx, identity, permission);
      return Object.freeze({ ...result.body, replayed: result.replayed });
    } catch (error) { return translate(error); }
  }
}
