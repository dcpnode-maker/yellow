import {
  InventoryConflictError,
  ReservationOccupancyService,
} from "../inventory";
import {
  createAuditEnvelope,
  recordFact,
  type AuditEnvelope,
  type EventBus,
  type JsonValue,
  type PostgresIdempotency,
  type Tx,
} from "../../kernel";
import {
  parseStoredCancellationPolicyEvidence,
  type FrozenCancellationPolicyEvidence,
} from "./policy-evidence";
import {
  findReservationTransition,
  RESERVATION_STATUSES,
  type ReservationStatus,
} from "./state-machine";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const IDEMPOTENCY_KEY = /^[\x21-\x7e]{8,200}$/;
const CONFIRMATION_NO = /^[\x21-\x7e]{1,120}$/;
const OPTIONAL_CODE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const MUTABLE_FIELDS = Object.freeze([
  "notes",
  "eta",
  "etd",
  "marketCode",
  "sourceCode",
  "originCode",
] as const);
const MODIFIABLE_STATUSES = new Set<ReservationStatus>(["reserved", "due_in", "in_house", "due_out"]);
const HOUR_MS = 60 * 60 * 1_000;

type MutableField = (typeof MUTABLE_FIELDS)[number];
type MutableValue = string | null;
export type ReservationMutableFields = Readonly<Partial<Record<MutableField, MutableValue>>>;

export interface ModifyReservationInput {
  readonly reservationId: string;
  readonly expected: ReservationMutableFields;
  readonly changes: ReservationMutableFields;
  readonly idempotencyKey: string;
  readonly envelope: AuditEnvelope;
}

export interface CancelReservationInput {
  readonly reservationId: string;
  readonly reason: string;
  readonly approvalId?: string;
  readonly idempotencyKey: string;
  readonly envelope: AuditEnvelope;
}

export interface ReinstateReservationInput {
  readonly reservationId: string;
  readonly idempotencyKey: string;
  readonly envelope: AuditEnvelope;
}

export interface ReservationFieldDiff extends Readonly<Record<string, JsonValue>> {
  readonly before: MutableValue;
  readonly after: MutableValue;
}

export interface ModifyReservationResult {
  readonly reservationId: string;
  readonly status: ReservationStatus;
  readonly diff: Readonly<Record<string, ReservationFieldDiff>>;
  readonly replayed: boolean;
}

export interface CancellationPenalty extends Readonly<Record<string, JsonValue>> {
  readonly basis: "nights" | "percent";
  readonly value: number;
}

export interface CancellationPolicyDecision extends Readonly<Record<string, JsonValue>> {
  readonly evidence: "none" | "frozen_policy" | "legacy_unfrozen";
  readonly policy_id: string | null;
  readonly content_hash: string | null;
  readonly rule_before_hours: number | null;
  readonly penalty: CancellationPenalty | null;
}

export interface CancellationApprovalPayload extends Readonly<Record<string, JsonValue>> {
  readonly reservation_id: string;
  readonly reason: string;
  readonly waive_penalty: true;
  readonly policy_decision: CancellationPolicyDecision;
}

export interface CancelReservationResult {
  readonly reservationId: string;
  readonly previousStatus: "reserved" | "due_in";
  readonly status: "cancelled";
  readonly cancellationNo: string;
  readonly cancelledAt: string;
  readonly releasedClaimCount: number;
  readonly policyDecision: CancellationPolicyDecision;
  readonly approvalId: string | null;
  readonly penaltyJournalId: null;
  readonly replayed: boolean;
}

export interface ReinstateReservationResult {
  readonly reservationId: string;
  readonly previousStatus: "cancelled" | "no_show";
  readonly status: "reserved";
  readonly reclaimedClaimCount: number;
  readonly replayed: boolean;
}

export interface FindReservationLifecycleInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly confirmationNo: string;
}

export interface ReservationLifecycleLookupResult {
  readonly reservationId: string;
  readonly confirmationNo: string;
  readonly status: ReservationStatus;
  readonly fields: Readonly<Record<MutableField, MutableValue>>;
  readonly actions: Readonly<{
    canModify: boolean;
    canCancel: boolean;
    canReinstate: boolean;
  }>;
}

export interface ReservationLifecycleServiceOptions {
  readonly events: EventBus;
  readonly idempotency: PostgresIdempotency;
  readonly occupancy?: ReservationOccupancyService;
  readonly now?: () => Date;
}

type ModifyReservationBody = Omit<ModifyReservationResult, "replayed"> & Readonly<Record<string, JsonValue>>;
type CancelReservationBody = Omit<CancelReservationResult, "replayed"> & Readonly<Record<string, JsonValue>>;
type ReinstateReservationBody = Omit<ReinstateReservationResult, "replayed"> & Readonly<Record<string, JsonValue>>;

interface ReservationRow {
  readonly id: string;
  readonly status: string;
  readonly notes: string | null;
  readonly eta: string | null;
  readonly etd: string | null;
  readonly market_code: string | null;
  readonly source_code: string | null;
  readonly origin_code: string | null;
}

interface ReservationLookupRow extends ReservationRow {
  readonly confirmation_no: string;
}

interface SegmentRow {
  readonly id: string;
  readonly seq: number;
  readonly sellable_unit_id: string | null;
  readonly from_at: Date;
  readonly to_at: Date;
  readonly status: string;
}

interface ConfirmationFactRow {
  readonly id: string;
  readonly payload: Record<string, unknown>;
}

interface CancellationAssessment {
  readonly decision: CancellationPolicyDecision;
  readonly requiresApproval: boolean;
  readonly confirmationFactId: string;
  readonly evaluatedAt: string;
  readonly remainingMinutes: number;
}

interface ApprovalRow {
  readonly payload: Record<string, unknown>;
  readonly status: string;
  readonly requested_by: string;
  readonly decided_by: string | null;
}

interface CancellationFactRow {
  readonly payload: Record<string, unknown>;
}

export class ReservationLifecycleValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReservationLifecycleValidationError";
  }
}

export class ReservationLifecycleNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReservationLifecycleNotFoundError";
  }
}

export class ReservationLifecycleConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReservationLifecycleConflictError";
  }
}

export class ReservationApprovalRequiredError extends Error {
  readonly approvalPayload: CancellationApprovalPayload;

  constructor(message: string, approvalPayload: CancellationApprovalPayload) {
    super(message);
    this.name = "ReservationApprovalRequiredError";
    this.approvalPayload = approvalPayload;
  }
}

function requireUuid(name: string, value: unknown): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new ReservationLifecycleValidationError(`${name} must be a UUID`);
  }
  return value;
}

function requireOperation(envelope: AuditEnvelope, operation: string): void {
  if (envelope.operation !== operation) {
    throw new ReservationLifecycleValidationError(`audit operation must be ${operation}`);
  }
}

function requireIdempotencyKey(value: unknown): string {
  if (typeof value !== "string" || !IDEMPOTENCY_KEY.test(value)) {
    throw new ReservationLifecycleValidationError(
      "idempotencyKey must contain 8-200 printable non-space characters",
    );
  }
  return value;
}

function requireReason(value: unknown): string {
  if (typeof value !== "string" || value !== value.trim() || value.length < 1 || value.length > 500) {
    throw new ReservationLifecycleValidationError("reason must be trimmed and contain 1 to 500 characters");
  }
  return value;
}

function normalizeCode(value: unknown, subject: string): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || value !== value.trim() || !OPTIONAL_CODE.test(value)) {
    throw new ReservationLifecycleValidationError(`${subject} must be null or a trimmed stable identifier`);
  }
  return value;
}

function normalizeNotes(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || value !== value.trim() || value.length < 1 || value.length > 4_000) {
    throw new ReservationLifecycleValidationError("notes must be null or 1 to 4000 trimmed characters");
  }
  return value;
}

function normalizeTime(value: unknown, subject: string): string | null {
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new ReservationLifecycleValidationError(`${subject} must be null or an exact offset time`);
  }
  const match = /^(\d{2}):(\d{2}):(\d{2})(Z|[+-]\d{2}(?::?\d{2})?)$/.exec(value);
  if (!match) throw new ReservationLifecycleValidationError(`${subject} must be HH:MM:SS with an exact offset`);
  const [, hourText, minuteText, secondText, rawOffset] = match;
  if (hourText === undefined || minuteText === undefined || secondText === undefined || rawOffset === undefined) {
    throw new ReservationLifecycleValidationError(`${subject} must be HH:MM:SS with an exact offset`);
  }
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  if (hour > 23 || minute > 59 || second > 59) {
    throw new ReservationLifecycleValidationError(`${subject} contains an invalid clock time`);
  }
  let offset = "+00:00";
  if (rawOffset !== "Z") {
    const sign = rawOffset[0];
    const digits = rawOffset.slice(1).replace(":", "");
    const offsetHour = Number(digits.slice(0, 2));
    const offsetMinute = digits.length === 2 ? 0 : Number(digits.slice(2, 4));
    if (offsetHour > 14 || offsetMinute > 59 || (offsetHour === 14 && offsetMinute !== 0)) {
      throw new ReservationLifecycleValidationError(`${subject} contains an invalid UTC offset`);
    }
    offset = `${sign}${digits.slice(0, 2)}:${String(offsetMinute).padStart(2, "0")}`;
  }
  return `${hourText}:${minuteText}:${secondText}${offset}`;
}

function normalizeMutableValue(field: MutableField, value: unknown): MutableValue {
  switch (field) {
    case "notes": return normalizeNotes(value);
    case "eta": return normalizeTime(value, "eta");
    case "etd": return normalizeTime(value, "etd");
    case "marketCode": return normalizeCode(value, "marketCode");
    case "sourceCode": return normalizeCode(value, "sourceCode");
    case "originCode": return normalizeCode(value, "originCode");
  }
}

function normalizeMutation(
  expectedInput: ReservationMutableFields,
  changesInput: ReservationMutableFields,
): Readonly<{
  keys: readonly MutableField[];
  expected: Readonly<Partial<Record<MutableField, MutableValue>>>;
  changes: Readonly<Partial<Record<MutableField, MutableValue>>>;
}> {
  if (typeof expectedInput !== "object" || expectedInput === null || Array.isArray(expectedInput) ||
      typeof changesInput !== "object" || changesInput === null || Array.isArray(changesInput)) {
    throw new ReservationLifecycleValidationError("expected and changes must be objects");
  }
  const allowed = new Set<string>(MUTABLE_FIELDS);
  const expectedKeys = Object.keys(expectedInput).sort();
  const changeKeys = Object.keys(changesInput).sort();
  if (expectedKeys.length === 0 || expectedKeys.some((key) => !allowed.has(key)) ||
      changeKeys.length !== expectedKeys.length ||
      expectedKeys.some((key, index) => key !== changeKeys[index])) {
    throw new ReservationLifecycleValidationError(
      "expected and changes must name the same non-empty supported field set",
    );
  }
  const keys = Object.freeze(expectedKeys as MutableField[]);
  const expected: Partial<Record<MutableField, MutableValue>> = {};
  const changes: Partial<Record<MutableField, MutableValue>> = {};
  for (const key of keys) {
    const before = normalizeMutableValue(key, expectedInput[key]);
    const after = normalizeMutableValue(key, changesInput[key]);
    if (before === after) throw new ReservationLifecycleValidationError(`${key} change must not be a no-op`);
    expected[key] = before;
    changes[key] = after;
  }
  return Object.freeze({ keys, expected: Object.freeze(expected), changes: Object.freeze(changes) });
}

function asStatus(value: string): ReservationStatus {
  if (!RESERVATION_STATUSES.includes(value as ReservationStatus)) {
    throw new Error(`Database returned unsupported reservation status ${value}`);
  }
  return value as ReservationStatus;
}

function reservationValue(row: ReservationRow, field: MutableField): MutableValue {
  switch (field) {
    case "notes": return row.notes;
    case "eta": return normalizeTime(row.eta, "stored eta");
    case "etd": return normalizeTime(row.etd, "stored etd");
    case "marketCode": return row.market_code;
    case "sourceCode": return row.source_code;
    case "originCode": return row.origin_code;
  }
}

function requireNow(value: Date): Date {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new ReservationLifecycleValidationError("lifecycle clock returned an invalid instant");
  }
  return new Date(value);
}

function cancellationNumber(reservationId: string): string {
  return `C-${reservationId.replaceAll("-", "").toUpperCase()}`;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Approval payload contains a non-finite number");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value !== "object") throw new Error("Approval payload is not JSON");
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
}

function freezePolicyDecision(decision: CancellationPolicyDecision): CancellationPolicyDecision {
  return Object.freeze({
    ...decision,
    penalty: decision.penalty === null ? null : Object.freeze({ ...decision.penalty }),
  });
}

function evaluatePolicy(
  evidence: FrozenCancellationPolicyEvidence,
  remainingMs: number,
): CancellationPolicyDecision {
  const rule = evidence.content.rules.find((candidate) => remainingMs >= candidate.before_hours * HOUR_MS)
    ?? evidence.content.rules[evidence.content.rules.length - 1];
  if (!rule) throw new Error("Validated cancellation policy contained no rule");
  return freezePolicyDecision({
    evidence: "frozen_policy",
    policy_id: evidence.policyId,
    content_hash: evidence.contentHash,
    rule_before_hours: rule.before_hours,
    penalty: Object.freeze({ ...rule.penalty }),
  });
}

function approvalPayload(
  reservationId: string,
  reason: string,
  decision: CancellationPolicyDecision,
): CancellationApprovalPayload {
  return Object.freeze({
    reservation_id: reservationId,
    reason,
    waive_penalty: true as const,
    policy_decision: decision,
  });
}

async function loadReservation(tx: Tx, envelope: AuditEnvelope, reservationId: string): Promise<ReservationRow> {
  const rows = await tx<ReservationRow[]>`
    SELECT id, status, notes, eta::text AS eta, etd::text AS etd,
           market_code, source_code, origin_code
    FROM reservation
    WHERE id = ${reservationId}::uuid
      AND tenant_id = ${envelope.tenantId}::uuid
      AND tenant_id = current_setting('app.tenant_id', true)::uuid
      AND property_node = ${envelope.propertyNode}::uuid
    FOR UPDATE
  `;
  const row = rows[0];
  if (!row) throw new ReservationLifecycleNotFoundError("Reservation was not found in the active property");
  return row;
}

async function loadSegments(tx: Tx, tenantId: string, reservationId: string): Promise<readonly SegmentRow[]> {
  return tx<SegmentRow[]>`
    SELECT id, seq, sellable_unit_id, lower(period) AS from_at, upper(period) AS to_at, status
    FROM reservation_segment
    WHERE tenant_id = ${tenantId}::uuid
      AND tenant_id = current_setting('app.tenant_id', true)::uuid
      AND reservation_id = ${reservationId}::uuid
    ORDER BY seq, id
    FOR UPDATE
  `;
}

async function assessCancellation(
  tx: Tx,
  envelope: AuditEnvelope,
  reservationId: string,
  stayStart: Date,
  now: Date,
): Promise<CancellationAssessment> {
  const rows = await tx<ConfirmationFactRow[]>`
    SELECT id, payload
    FROM fact_log
    WHERE tenant_id = ${envelope.tenantId}::uuid
      AND tenant_id = current_setting('app.tenant_id', true)::uuid
      AND entity_type = 'reservation'
      AND entity_id = ${reservationId}::uuid
      AND fact_type = 'reservation.confirmed'
    ORDER BY recorded_at DESC, id DESC
    LIMIT 1
  `;
  const confirmation = rows[0];
  if (!confirmation) {
    throw new ReservationLifecycleConflictError("Reservation has no immutable confirmation evidence");
  }
  const remainingMinutes = Math.floor((stayStart.getTime() - now.getTime()) / 60_000);
  const evaluatedAt = now.toISOString();
  if (!Object.prototype.hasOwnProperty.call(confirmation.payload, "cancellation_policy")) {
    return Object.freeze({
      decision: freezePolicyDecision({
        evidence: "legacy_unfrozen",
        policy_id: null,
        content_hash: null,
        rule_before_hours: null,
        penalty: null,
      }),
      requiresApproval: true,
      confirmationFactId: confirmation.id,
      evaluatedAt,
      remainingMinutes,
    });
  }
  if (confirmation.payload.cancellation_policy === null) {
    return Object.freeze({
      decision: freezePolicyDecision({
        evidence: "none",
        policy_id: null,
        content_hash: null,
        rule_before_hours: null,
        penalty: null,
      }),
      requiresApproval: false,
      confirmationFactId: confirmation.id,
      evaluatedAt,
      remainingMinutes,
    });
  }
  const evidence = parseStoredCancellationPolicyEvidence(confirmation.payload.cancellation_policy);
  const decision = evaluatePolicy(evidence, stayStart.getTime() - now.getTime());
  return Object.freeze({
    decision,
    requiresApproval: decision.penalty !== null && decision.penalty.value !== 0,
    confirmationFactId: confirmation.id,
    evaluatedAt,
    remainingMinutes,
  });
}

async function requireApprovedWaiver(
  tx: Tx,
  envelope: AuditEnvelope,
  reservationId: string,
  approvalId: string | undefined,
  expectedPayload: CancellationApprovalPayload,
): Promise<string> {
  if (approvalId === undefined) {
    throw new ReservationApprovalRequiredError("Cancellation requires an approved two-operator waiver", expectedPayload);
  }
  const normalizedApprovalId = requireUuid("approvalId", approvalId);
  const rows = await tx<ApprovalRow[]>`
    SELECT payload, status, requested_by, decided_by
    FROM approval_request
    WHERE id = ${normalizedApprovalId}::uuid
      AND tenant_id = ${envelope.tenantId}::uuid
      AND tenant_id = current_setting('app.tenant_id', true)::uuid
      AND kind = 'reservation_cancellation_waiver'
      AND subject_type = 'reservation'
      AND subject_id = ${reservationId}::uuid
    FOR SHARE
  `;
  const approval = rows[0];
  const priorCancellations = await tx<CancellationFactRow[]>`
    SELECT payload
    FROM fact_log
    WHERE tenant_id = ${envelope.tenantId}::uuid
      AND tenant_id = current_setting('app.tenant_id', true)::uuid
      AND entity_type = 'reservation'
      AND entity_id = ${reservationId}::uuid
      AND fact_type = 'reservation.cancelled'
    ORDER BY recorded_at, id
  `;
  const wasUsed = priorCancellations.some(
    (fact) => fact.payload.approval_id === normalizedApprovalId,
  );
  const valid = approval !== undefined &&
    approval.status === "approved" &&
    approval.requested_by === envelope.actorId &&
    approval.decided_by !== null &&
    approval.decided_by !== approval.requested_by &&
    canonicalJson(approval.payload) === canonicalJson(expectedPayload) &&
    !wasUsed;
  if (!valid) {
    throw new ReservationApprovalRequiredError(
      "Cancellation approval is missing, stale, already used or not exactly bound",
      expectedPayload,
    );
  }
  return normalizedApprovalId;
}

export class ReservationLifecycleService {
  readonly #events: EventBus;
  readonly #idempotency: PostgresIdempotency;
  readonly #occupancy: ReservationOccupancyService;
  readonly #now: () => Date;

  constructor(options: ReservationLifecycleServiceOptions) {
    this.#events = options.events;
    this.#idempotency = options.idempotency;
    this.#occupancy = options.occupancy ?? new ReservationOccupancyService(options.events);
    this.#now = options.now ?? (() => new Date());
  }

  async findByConfirmation(
    tx: Tx,
    input: FindReservationLifecycleInput,
  ): Promise<ReservationLifecycleLookupResult> {
    const tenantId = requireUuid("tenantId", input.tenantId);
    const propertyNode = requireUuid("propertyNode", input.propertyNode);
    if (typeof input.confirmationNo !== "string" || !CONFIRMATION_NO.test(input.confirmationNo)) {
      throw new ReservationLifecycleValidationError("confirmationNo must contain 1-120 visible characters");
    }
    const rows = await tx<ReservationLookupRow[]>`
      SELECT id, confirmation_no, status, notes, eta::text AS eta, etd::text AS etd,
             market_code, source_code, origin_code
      FROM reservation
      WHERE tenant_id = ${tenantId}::uuid
        AND tenant_id = current_setting('app.tenant_id', true)::uuid
        AND property_node = ${propertyNode}::uuid
        AND confirmation_no = ${input.confirmationNo}
    `;
    const reservation = rows[0];
    if (!reservation) throw new ReservationLifecycleNotFoundError("Reservation was not found in the property");
    const status = asStatus(reservation.status);
    return Object.freeze({
      reservationId: reservation.id,
      confirmationNo: reservation.confirmation_no,
      status,
      fields: Object.freeze({
        notes: reservation.notes,
        eta: reservation.eta,
        etd: reservation.etd,
        marketCode: reservation.market_code,
        sourceCode: reservation.source_code,
        originCode: reservation.origin_code,
      }),
      actions: Object.freeze({
        canModify: MODIFIABLE_STATUSES.has(status),
        canCancel: status === "reserved" || status === "due_in",
        canReinstate: status === "cancelled" || status === "no_show",
      }),
    });
  }

  async modify(tx: Tx, input: ModifyReservationInput): Promise<ModifyReservationResult> {
    requireOperation(input.envelope, "reservation.modified");
    const reservationId = requireUuid("reservationId", input.reservationId);
    const idempotencyKey = requireIdempotencyKey(input.idempotencyKey);
    const mutation = normalizeMutation(input.expected, input.changes);
    const outcome = await this.#idempotency.execute<ModifyReservationBody>(tx, {
      tenantId: input.envelope.tenantId,
      operation: "reservation.modify",
      key: idempotencyKey,
      request: {
        actorId: input.envelope.actorId,
        propertyNode: input.envelope.propertyNode,
        reservationId,
        expected: mutation.expected,
        changes: mutation.changes,
      },
    }, async (commandTx) => {
      const current = await loadReservation(commandTx, input.envelope, reservationId);
      const status = asStatus(current.status);
      if (!MODIFIABLE_STATUSES.has(status)) {
        throw new ReservationLifecycleConflictError(`Reservation status ${status} cannot be modified`);
      }
      const diff: Record<string, ReservationFieldDiff> = {};
      for (const key of mutation.keys) {
        const before = reservationValue(current, key);
        if (before !== mutation.expected[key]) {
          throw new ReservationLifecycleConflictError(`${key} changed concurrently`);
        }
        diff[key] = Object.freeze({ before, after: mutation.changes[key]! });
      }

      const hasNotes = mutation.keys.includes("notes");
      const hasEta = mutation.keys.includes("eta");
      const hasEtd = mutation.keys.includes("etd");
      const hasMarket = mutation.keys.includes("marketCode");
      const hasSource = mutation.keys.includes("sourceCode");
      const hasOrigin = mutation.keys.includes("originCode");
      const rows = await commandTx<ReservationRow[]>`
        UPDATE reservation
        SET notes = CASE WHEN ${hasNotes} THEN ${mutation.changes.notes ?? null} ELSE notes END,
            eta = CASE WHEN ${hasEta} THEN ${mutation.changes.eta ?? null}::timetz ELSE eta END,
            etd = CASE WHEN ${hasEtd} THEN ${mutation.changes.etd ?? null}::timetz ELSE etd END,
            market_code = CASE WHEN ${hasMarket} THEN ${mutation.changes.marketCode ?? null} ELSE market_code END,
            source_code = CASE WHEN ${hasSource} THEN ${mutation.changes.sourceCode ?? null} ELSE source_code END,
            origin_code = CASE WHEN ${hasOrigin} THEN ${mutation.changes.originCode ?? null} ELSE origin_code END
        WHERE id = ${reservationId}::uuid
          AND tenant_id = ${input.envelope.tenantId}::uuid
          AND status = ${status}
        RETURNING id, status, notes, eta::text AS eta, etd::text AS etd,
                  market_code, source_code, origin_code
      `;
      if (!rows[0]) throw new ReservationLifecycleConflictError("Reservation changed concurrently");
      const frozenDiff = Object.freeze(diff);
      const fact = await recordFact(commandTx, {
        entityType: "reservation",
        entityId: reservationId,
        envelope: input.envelope,
        payload: { status, diff: frozenDiff },
      });
      await this.#events.publish(commandTx, {
        tenantId: input.envelope.tenantId,
        propertyNode: input.envelope.propertyNode,
        businessDate: fact.businessDate,
        aggregateType: "reservation",
        aggregateId: reservationId,
        eventType: "reservation.modified",
        actorId: input.envelope.actorId,
        correlationId: input.envelope.requestId,
        payload: { reservation_id: reservationId, status, diff: frozenDiff },
      });
      const body: ModifyReservationBody = Object.freeze({
        reservationId,
        status,
        diff: frozenDiff,
      });
      return { status: 200, body };
    });
    return Object.freeze({ ...outcome.body, replayed: outcome.replayed });
  }

  async cancel(tx: Tx, input: CancelReservationInput): Promise<CancelReservationResult> {
    requireOperation(input.envelope, "reservation.cancelled");
    const reservationId = requireUuid("reservationId", input.reservationId);
    const reason = requireReason(input.reason);
    const approvalId = input.approvalId === undefined ? undefined : requireUuid("approvalId", input.approvalId);
    const idempotencyKey = requireIdempotencyKey(input.idempotencyKey);
    const outcome = await this.#idempotency.execute<CancelReservationBody>(tx, {
      tenantId: input.envelope.tenantId,
      operation: "reservation.cancel",
      key: idempotencyKey,
      request: {
        actorId: input.envelope.actorId,
        propertyNode: input.envelope.propertyNode,
        reservationId,
        reason,
        approvalId: approvalId ?? null,
      },
    }, async (commandTx) => {
      const reservation = await loadReservation(commandTx, input.envelope, reservationId);
      const previousStatus = asStatus(reservation.status);
      const transition = findReservationTransition(previousStatus, "cancelled");
      if (!transition || (previousStatus !== "reserved" && previousStatus !== "due_in")) {
        throw new ReservationLifecycleConflictError(`Reservation status ${previousStatus} cannot be cancelled`);
      }
      const segments = await loadSegments(commandTx, input.envelope.tenantId, reservationId);
      if (segments.length === 0 || segments.some((segment) => segment.status !== "booked")) {
        throw new ReservationLifecycleConflictError("Cancellation requires booked reservation segments");
      }
      const now = requireNow(this.#now());
      const stayStart = segments.reduce(
        (earliest, segment) => segment.from_at < earliest ? segment.from_at : earliest,
        segments[0]!.from_at,
      );
      const assessment = await assessCancellation(commandTx, input.envelope, reservationId, stayStart, now);
      const requiredPayload = approvalPayload(reservationId, reason, assessment.decision);
      const acceptedApprovalId = assessment.requiresApproval
        ? await requireApprovedWaiver(commandTx, input.envelope, reservationId, approvalId, requiredPayload)
        : null;

      let releasedClaimCount = 0;
      for (const segment of segments) {
        const released = await this.#occupancy.releaseForSegment(commandTx, {
          segmentId: segment.id,
          envelope: createAuditEnvelope({
            actorId: input.envelope.actorId,
            tenantId: input.envelope.tenantId,
            propertyNode: input.envelope.propertyNode,
            requestId: input.envelope.requestId,
            operation: "occupancy.released",
          }),
        });
        releasedClaimCount += released.claimCount;
      }
      const updatedSegments = await commandTx<Array<{ id: string }>>`
        UPDATE reservation_segment
        SET status = 'cancelled'
        WHERE tenant_id = ${input.envelope.tenantId}::uuid
          AND reservation_id = ${reservationId}::uuid
          AND status = 'booked'
        RETURNING id
      `;
      if (updatedSegments.length !== segments.length) {
        throw new ReservationLifecycleConflictError("Reservation segments changed concurrently");
      }
      const cancellationNo = cancellationNumber(reservationId);
      const cancelledAt = now.toISOString();
      const updated = await commandTx<Array<{ id: string }>>`
        UPDATE reservation
        SET status = 'cancelled', cancelled_at = ${cancelledAt}::timestamptz,
            cancel_reason = ${reason}, cancellation_no = ${cancellationNo}
        WHERE id = ${reservationId}::uuid
          AND tenant_id = ${input.envelope.tenantId}::uuid
          AND status = ${previousStatus}
        RETURNING id
      `;
      if (!updated[0]) throw new ReservationLifecycleConflictError("Reservation changed concurrently");
      const evidence = {
        previous_status: previousStatus,
        status: "cancelled",
        reason,
        cancellation_no: cancellationNo,
        cancelled_at: cancelledAt,
        released_claims: releasedClaimCount,
        confirmation_fact_id: assessment.confirmationFactId,
        policy_decision: assessment.decision,
        evaluated_at: assessment.evaluatedAt,
        remaining_minutes: assessment.remainingMinutes,
        approval_id: acceptedApprovalId,
        penalty_journal_id: null,
      } as const;
      const fact = await recordFact(commandTx, {
        entityType: "reservation",
        entityId: reservationId,
        envelope: input.envelope,
        payload: evidence,
      });
      await this.#events.publish(commandTx, {
        tenantId: input.envelope.tenantId,
        propertyNode: input.envelope.propertyNode,
        businessDate: fact.businessDate,
        aggregateType: "reservation",
        aggregateId: reservationId,
        eventType: transition.event,
        actorId: input.envelope.actorId,
        correlationId: input.envelope.requestId,
        payload: { reservation_id: reservationId, ...evidence },
      });
      const body: CancelReservationBody = Object.freeze({
        reservationId,
        previousStatus,
        status: "cancelled" as const,
        cancellationNo,
        cancelledAt,
        releasedClaimCount,
        policyDecision: assessment.decision,
        approvalId: acceptedApprovalId,
        penaltyJournalId: null,
      });
      return { status: 200, body };
    });
    return Object.freeze({ ...outcome.body, replayed: outcome.replayed });
  }

  async reinstate(tx: Tx, input: ReinstateReservationInput): Promise<ReinstateReservationResult> {
    requireOperation(input.envelope, "reservation.reinstated");
    const reservationId = requireUuid("reservationId", input.reservationId);
    const idempotencyKey = requireIdempotencyKey(input.idempotencyKey);
    const outcome = await this.#idempotency.execute<ReinstateReservationBody>(tx, {
      tenantId: input.envelope.tenantId,
      operation: "reservation.reinstate",
      key: idempotencyKey,
      request: {
        actorId: input.envelope.actorId,
        propertyNode: input.envelope.propertyNode,
        reservationId,
      },
    }, async (commandTx) => {
      const reservation = await loadReservation(commandTx, input.envelope, reservationId);
      const previousStatus = asStatus(reservation.status);
      const transition = findReservationTransition(previousStatus, "reserved");
      if (!transition || (previousStatus !== "cancelled" && previousStatus !== "no_show")) {
        throw new ReservationLifecycleConflictError(`Reservation status ${previousStatus} cannot be reinstated`);
      }
      const segments = await loadSegments(commandTx, input.envelope.tenantId, reservationId);
      if (segments.length === 0 || segments.some((segment) =>
        segment.status !== "cancelled" || segment.sellable_unit_id === null
      )) {
        throw new ReservationLifecycleConflictError(
          "Reinstatement requires cancelled segments with their original sellable units",
        );
      }
      let reclaimedClaimCount = 0;
      for (const segment of segments) {
        try {
          const claimed = await this.#occupancy.claimForSegment(commandTx, {
            sellableUnitId: segment.sellable_unit_id!,
            segmentId: segment.id,
            from: segment.from_at,
            to: segment.to_at,
            envelope: createAuditEnvelope({
              actorId: input.envelope.actorId,
              tenantId: input.envelope.tenantId,
              propertyNode: input.envelope.propertyNode,
              requestId: input.envelope.requestId,
              operation: "occupancy.recorded",
            }),
          });
          reclaimedClaimCount += claimed.claimCount;
        } catch (error) {
          if (error instanceof InventoryConflictError) {
            throw new ReservationLifecycleConflictError("Reservation inventory is no longer available");
          }
          throw error;
        }
      }
      const updatedSegments = await commandTx<Array<{ id: string }>>`
        UPDATE reservation_segment
        SET status = 'booked'
        WHERE tenant_id = ${input.envelope.tenantId}::uuid
          AND reservation_id = ${reservationId}::uuid
          AND status = 'cancelled'
        RETURNING id
      `;
      if (updatedSegments.length !== segments.length) {
        throw new ReservationLifecycleConflictError("Reservation segments changed concurrently");
      }
      const updated = await commandTx<Array<{ id: string }>>`
        UPDATE reservation
        SET status = 'reserved', cancelled_at = NULL, cancel_reason = NULL, cancellation_no = NULL
        WHERE id = ${reservationId}::uuid
          AND tenant_id = ${input.envelope.tenantId}::uuid
          AND status = ${previousStatus}
        RETURNING id
      `;
      if (!updated[0]) throw new ReservationLifecycleConflictError("Reservation changed concurrently");
      const fact = await recordFact(commandTx, {
        entityType: "reservation",
        entityId: reservationId,
        envelope: input.envelope,
        payload: {
          previous_status: previousStatus,
          status: "reserved",
          reclaimed_claims: reclaimedClaimCount,
        },
      });
      await this.#events.publish(commandTx, {
        tenantId: input.envelope.tenantId,
        propertyNode: input.envelope.propertyNode,
        businessDate: fact.businessDate,
        aggregateType: "reservation",
        aggregateId: reservationId,
        eventType: transition.event,
        actorId: input.envelope.actorId,
        correlationId: input.envelope.requestId,
        payload: {
          reservation_id: reservationId,
          previous_status: previousStatus,
          status: "reserved",
          reclaimed_claims: reclaimedClaimCount,
        },
      });
      const body: ReinstateReservationBody = Object.freeze({
        reservationId,
        previousStatus,
        status: "reserved" as const,
        reclaimedClaimCount,
      });
      return { status: 200, body };
    });
    return Object.freeze({ ...outcome.body, replayed: outcome.replayed });
  }
}
