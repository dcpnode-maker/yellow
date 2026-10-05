import {
  ApprovalService,
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
const INTEGER = /^(?:0|[1-9][0-9]*)$/;
const POSITIVE_INTEGER = /^[1-9][0-9]*$/;
const CURRENCY = /^[A-Z]{3}$/;
const BUSINESS_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DENOMINATIONS = 50;
const MAX_REASON_LENGTH = 500;
const INVISIBLE = /[\u0000-\u001f\u007f\u200b-\u200d\u202a-\u202e\u2060\u2066-\u2069\ufeff]/u;

export interface CashierDenominationQuantity extends Readonly<Record<string, unknown>> {
  readonly denominationMinor: string;
  readonly quantity: string;
}

export interface OpenCashierSessionInput extends Readonly<Record<string, unknown>> {
  readonly tenantId: string;
  readonly drawerId: string;
  readonly denominations: readonly CashierDenominationQuantity[];
  readonly idempotencyKey: string;
  readonly envelope: AuditEnvelope;
}

export interface AppendCashierCountInput extends Readonly<Record<string, unknown>> {
  readonly tenantId: string;
  readonly sessionId: string;
  readonly denominations: readonly CashierDenominationQuantity[];
  readonly idempotencyKey: string;
  readonly envelope: AuditEnvelope;
}

/** `supervised` is server-derived route authority, never a client command field. */
export interface CloseCashierSessionInput extends Readonly<Record<string, unknown>> {
  readonly tenantId: string;
  readonly sessionId: string;
  readonly countId: string;
  readonly reason?: string;
  readonly approvalId?: string;
  readonly supervised: boolean;
  readonly idempotencyKey: string;
  readonly envelope: AuditEnvelope;
}

/** `supervised` is server-derived read authority, never a query parameter from the browser. */
export interface CashierReadInput extends Readonly<Record<string, unknown>> {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly drawerId: string;
  readonly actorId: string;
  readonly supervised: boolean;
}

export interface CashierListInput extends Readonly<Record<string, unknown>> {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly actorId: string;
  readonly supervised: boolean;
}

export interface RequestCashierOverShortApprovalInput extends Readonly<Record<string, unknown>> {
  readonly tenantId: string;
  readonly sessionId: string;
  readonly countId: string;
  readonly supervised: boolean;
  readonly idempotencyKey: string;
  readonly envelope: AuditEnvelope;
}

export interface DecideCashierOverShortApprovalInput extends Readonly<Record<string, unknown>> {
  readonly tenantId: string;
  readonly sessionId: string;
  readonly approvalId: string;
  readonly idempotencyKey: string;
  readonly envelope: AuditEnvelope;
}

export interface OpenCashierSessionResult {
  readonly sessionId: string;
  readonly drawerId: string;
  readonly openingCountId: string;
  readonly businessDate: string;
  readonly currency: string;
  readonly openingFloatMinor: string;
  readonly expectedMinor: string;
  readonly openedAt: string;
  readonly replayed: boolean;
}

/** The count result intentionally excludes expected, counted and over/short amounts. */
export interface AppendCashierCountResult {
  readonly countId: string;
  readonly sessionId: string;
  readonly attemptNo: number;
  readonly countedAt: string;
  readonly replayed: boolean;
}

export interface CloseCashierSessionResult {
  readonly sessionId: string;
  readonly openingCountId: string;
  readonly closingCountId: string;
  readonly businessDate: string;
  readonly currency: string;
  readonly expectedMinor: string;
  readonly countedMinor: string;
  readonly overShortMinor: string;
  readonly closedAt: string;
  readonly closedBy: string;
  readonly supervised: boolean;
  readonly replayed: boolean;
}

export interface CashierCountAttempt {
  readonly countId: string;
  readonly attemptNo: number;
  readonly countedAt: string;
  readonly countedBy: string;
}

export interface CashierActiveSession {
  readonly sessionId: string;
  readonly businessDate: string;
  readonly openedAt: string;
  readonly openedBy: string;
  readonly openingCountId: string;
  readonly latestCount: CashierCountAttempt | null;
  /** Empty for an ordinary operator; supervisor read retains the immutable recount trail. */
  readonly countHistory: readonly CashierCountAttempt[];
}

export interface CashierReadResult {
  readonly drawerId: string;
  readonly propertyNode: string;
  readonly code: string;
  readonly name: string;
  readonly currency: string;
  readonly denominations: readonly { readonly denominationMinor: string }[];
  readonly session: CashierActiveSession | null;
}

export interface CashierOverShortApprovalResult {
  readonly approvalId: string;
  readonly sessionId: string;
  readonly countId: string;
  readonly expectedMinor: string;
  readonly countedMinor: string;
  readonly overShortMinor: string;
  readonly status: "pending" | "approved" | "rejected";
  readonly replayed: boolean;
}

export interface CashierServiceOptions {
  readonly database: Database;
  readonly events: EventBus;
  readonly idempotency: PostgresIdempotency;
  readonly approvals?: ApprovalService;
}

interface NormalizedDenomination {
  readonly denominationMinor: string;
  readonly quantity: string;
}

interface NormalizedOpen {
  readonly tenantId: string;
  readonly drawerId: string;
  readonly denominations: readonly NormalizedDenomination[];
  readonly idempotencyKey: string;
  readonly envelope: AuditEnvelope;
}

interface NormalizedCount {
  readonly tenantId: string;
  readonly sessionId: string;
  readonly denominations: readonly NormalizedDenomination[];
  readonly idempotencyKey: string;
  readonly envelope: AuditEnvelope;
}

interface NormalizedClose {
  readonly tenantId: string;
  readonly sessionId: string;
  readonly countId: string;
  readonly reason: string | null;
  readonly approvalId: string | null;
  readonly supervised: boolean;
  readonly idempotencyKey: string;
  readonly envelope: AuditEnvelope;
}

interface NormalizedRead {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly drawerId: string;
  readonly actorId: string;
  readonly supervised: boolean;
}

interface NormalizedApprovalRequest {
  readonly tenantId: string;
  readonly sessionId: string;
  readonly countId: string;
  readonly supervised: boolean;
  readonly idempotencyKey: string;
  readonly envelope: AuditEnvelope;
}

interface NormalizedApprovalDecision {
  readonly tenantId: string;
  readonly sessionId: string;
  readonly approvalId: string;
  readonly idempotencyKey: string;
  readonly envelope: AuditEnvelope;
}

interface ApprovalEvidenceRow {
  readonly session_id: string;
  readonly count_id: string;
  readonly opened_by: string;
  readonly counted_by: string;
  readonly expected_minor: string | number | bigint;
  readonly counted_minor: string | number | bigint;
}

interface DrawerRow {
  readonly id: string;
  readonly property_node: string;
  readonly code: string;
  readonly name: string;
  readonly currency: string;
  readonly session_id: string | null;
  readonly business_date: string | null;
  readonly opened_at: Date | null;
  readonly opened_by: string | null;
  readonly opening_count_id: string | null;
}

interface DenominationRow {
  readonly unit_minor: string | number | bigint;
}

interface ReadCountRow {
  readonly id: string;
  readonly attempt_no: number | bigint;
  readonly counted_at: Date;
  readonly counted_by: string;
}

interface OpenRow {
  readonly session_id: string;
  readonly count_id: string;
  readonly business_date: string;
  readonly currency: string;
  readonly expected_minor: string | number | bigint;
  readonly counted_minor: string | number | bigint;
  readonly opened_at: Date;
}

interface CountRow {
  readonly count_id: string;
  readonly session_id: string;
  readonly attempt_no: number | bigint;
  readonly counted_minor: string | number | bigint;
  readonly counted_at: Date;
}

interface CloseRow {
  readonly session_id: string;
  readonly opening_count_id: string;
  readonly closing_count_id: string;
  readonly business_date: string;
  readonly currency: string;
  readonly expected_minor: string | number | bigint;
  readonly counted_minor: string | number | bigint;
  readonly over_short_minor: string | number | bigint;
  readonly closed_at: Date;
  readonly closed_by: string;
  readonly supervised: boolean;
}

interface OpenBody extends Readonly<Record<string, JsonValue>> {
  readonly sessionId: string;
  readonly drawerId: string;
  readonly openingCountId: string;
  readonly businessDate: string;
  readonly currency: string;
  readonly openingFloatMinor: string;
  readonly expectedMinor: string;
  readonly openedAt: string;
}

interface CountBody extends Readonly<Record<string, JsonValue>> {
  readonly countId: string;
  readonly sessionId: string;
  readonly attemptNo: number;
  readonly countedAt: string;
}

interface CloseBody extends Readonly<Record<string, JsonValue>> {
  readonly sessionId: string;
  readonly openingCountId: string;
  readonly closingCountId: string;
  readonly businessDate: string;
  readonly currency: string;
  readonly expectedMinor: string;
  readonly countedMinor: string;
  readonly overShortMinor: string;
  readonly closedAt: string;
  readonly closedBy: string;
  readonly supervised: boolean;
}

interface ApprovalBody extends Readonly<Record<string, JsonValue>> {
  readonly approvalId: string;
  readonly sessionId: string;
  readonly countId: string;
  readonly expectedMinor: string;
  readonly countedMinor: string;
  readonly overShortMinor: string;
  readonly status: "pending" | "approved" | "rejected";
}

export class CashierValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CashierValidationError";
  }
}

export class CashierNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CashierNotFoundError";
  }
}

export class CashierConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CashierConflictError";
  }
}

export class CashierAuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CashierAuthorizationError";
  }
}

function requirePlainRecord(name: string, value: unknown): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value) ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) ||
      Object.getOwnPropertySymbols(value).length > 0) {
    throw new CashierValidationError(`${name} must be a plain object`);
  }
}

function requireAllowedKeys(name: string, value: Record<string, unknown>, allowed: readonly string[]): void {
  const permitted = new Set(allowed);
  const unsupported = Object.getOwnPropertyNames(value).filter((key) => !permitted.has(key)).sort();
  if (unsupported.length > 0) {
    throw new CashierValidationError(`${name} contains unsupported fields: ${unsupported.join(", ")}`);
  }
}

function requireUuid(name: string, value: unknown): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new CashierValidationError(`${name} must be a lowercase UUID`);
  }
  return value;
}

function requireEnvelope(value: unknown, tenantId: string, operation: string): AuditEnvelope {
  requirePlainRecord("envelope", value);
  requireAllowedKeys("envelope", value, ["actorId", "tenantId", "propertyNode", "requestId", "operation"]);
  if (requireUuid("envelope.tenantId", value.tenantId) !== tenantId) {
    throw new CashierValidationError("tenantId must match the audit envelope tenant");
  }
  requireUuid("envelope.actorId", value.actorId);
  requireUuid("envelope.propertyNode", value.propertyNode);
  requireUuid("envelope.requestId", value.requestId);
  if (value.operation !== operation) {
    throw new CashierValidationError(`audit operation must be ${operation}`);
  }
  return Object.freeze({
    actorId: value.actorId as string,
    tenantId: value.tenantId as string,
    propertyNode: value.propertyNode as string,
    requestId: value.requestId as string,
    operation: value.operation as string,
  });
}

function requireIdempotencyKey(value: unknown): string {
  if (typeof value !== "string" || !IDEMPOTENCY_KEY.test(value)) {
    throw new CashierValidationError("idempotencyKey must contain 8-200 visible ASCII characters");
  }
  return value;
}

function requireNonNegativeInteger(name: string, value: unknown): string {
  if (typeof value !== "string" || !INTEGER.test(value)) {
    throw new CashierValidationError(`${name} must be a canonical non-negative bigint string`);
  }
  try {
    const parsed = BigInt(value);
    if (parsed < 0n || parsed > 9_223_372_036_854_775_807n) throw new Error("outside signed bigint");
  } catch {
    throw new CashierValidationError(`${name} must fit a signed bigint`);
  }
  return value;
}

function requirePositiveInteger(name: string, value: unknown): string {
  if (typeof value !== "string" || !POSITIVE_INTEGER.test(value)) {
    throw new CashierValidationError(`${name} must be a canonical positive bigint string`);
  }
  try {
    if (BigInt(value) > 9_223_372_036_854_775_807n) throw new Error("outside signed bigint");
  } catch {
    throw new CashierValidationError(`${name} must fit a signed bigint`);
  }
  return value;
}

function normalizeDenominations(value: unknown): readonly NormalizedDenomination[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_DENOMINATIONS) {
    throw new CashierValidationError(`denominations must contain 1-${MAX_DENOMINATIONS} governed entries`);
  }
  const seen = new Set<string>();
  const normalized = value.map((line, index) => {
    requirePlainRecord(`denominations[${index}]`, line);
    requireAllowedKeys(`denominations[${index}]`, line, ["denominationMinor", "quantity"]);
    const denominationMinor = requirePositiveInteger(`denominations[${index}].denominationMinor`, line.denominationMinor);
    if (seen.has(denominationMinor)) {
      throw new CashierValidationError("denominations must not contain duplicate denominationMinor values");
    }
    seen.add(denominationMinor);
    return Object.freeze({
      denominationMinor,
      quantity: requireNonNegativeInteger(`denominations[${index}].quantity`, line.quantity),
    });
  });
  return Object.freeze(normalized.sort((left, right) =>
    BigInt(left.denominationMinor) < BigInt(right.denominationMinor) ? -1 : 1,
  ));
}

function normalizeOpen(input: OpenCashierSessionInput): NormalizedOpen {
  requirePlainRecord("Cashier open input", input);
  requireAllowedKeys("Cashier open input", input, [
    "tenantId", "drawerId", "denominations", "idempotencyKey", "envelope",
  ]);
  const tenantId = requireUuid("tenantId", input.tenantId);
  return Object.freeze({
    tenantId,
    drawerId: requireUuid("drawerId", input.drawerId),
    denominations: normalizeDenominations(input.denominations),
    idempotencyKey: requireIdempotencyKey(input.idempotencyKey),
    envelope: requireEnvelope(input.envelope, tenantId, "cashier.opened"),
  });
}

function normalizeCount(input: AppendCashierCountInput): NormalizedCount {
  requirePlainRecord("Cashier count input", input);
  requireAllowedKeys("Cashier count input", input, [
    "tenantId", "sessionId", "denominations", "idempotencyKey", "envelope",
  ]);
  const tenantId = requireUuid("tenantId", input.tenantId);
  return Object.freeze({
    tenantId,
    sessionId: requireUuid("sessionId", input.sessionId),
    denominations: normalizeDenominations(input.denominations),
    idempotencyKey: requireIdempotencyKey(input.idempotencyKey),
    envelope: requireEnvelope(input.envelope, tenantId, "cashier.counted"),
  });
}

function normalizeClose(input: CloseCashierSessionInput): NormalizedClose {
  requirePlainRecord("Cashier close input", input);
  requireAllowedKeys("Cashier close input", input, [
    "tenantId", "sessionId", "countId", "reason", "approvalId", "supervised", "idempotencyKey", "envelope",
  ]);
  const tenantId = requireUuid("tenantId", input.tenantId);
  if (typeof input.supervised !== "boolean") {
    throw new CashierValidationError("supervised must be a server-derived boolean authority");
  }
  let reason: string | null = null;
  if (input.reason !== undefined) {
    if (typeof input.reason !== "string") throw new CashierValidationError("reason must be text");
    reason = input.reason.trim();
    if (reason.length < 1 || reason.length > MAX_REASON_LENGTH || INVISIBLE.test(reason)) {
      throw new CashierValidationError(`reason must contain 1-${MAX_REASON_LENGTH} visible characters`);
    }
  }
  const approvalId = input.approvalId === undefined ? null : requireUuid("approvalId", input.approvalId);
  if ((reason === null) !== (approvalId === null) && !input.supervised) {
    throw new CashierValidationError("ordinary discrepancy close requires both approvalId and reason");
  }
  return Object.freeze({
    tenantId,
    sessionId: requireUuid("sessionId", input.sessionId),
    countId: requireUuid("countId", input.countId),
    reason,
    approvalId,
    supervised: input.supervised,
    idempotencyKey: requireIdempotencyKey(input.idempotencyKey),
    envelope: requireEnvelope(input.envelope, tenantId, "cashier.closed"),
  });
}

function normalizeRead(input: CashierReadInput): NormalizedRead {
  requirePlainRecord("Cashier read input", input);
  requireAllowedKeys("Cashier read input", input, [
    "tenantId", "propertyNode", "drawerId", "actorId", "supervised",
  ]);
  if (typeof input.supervised !== "boolean") {
    throw new CashierValidationError("supervised must be a server-derived boolean authority");
  }
  return Object.freeze({
    tenantId: requireUuid("tenantId", input.tenantId),
    propertyNode: requireUuid("propertyNode", input.propertyNode),
    drawerId: requireUuid("drawerId", input.drawerId),
    actorId: requireUuid("actorId", input.actorId),
    supervised: input.supervised,
  });
}

function normalizeList(input: CashierListInput): Omit<NormalizedRead, "drawerId"> {
  requirePlainRecord("Cashier list input", input);
  requireAllowedKeys("Cashier list input", input, ["tenantId", "propertyNode", "actorId", "supervised"]);
  if (typeof input.supervised !== "boolean") {
    throw new CashierValidationError("supervised must be a server-derived boolean authority");
  }
  return Object.freeze({
    tenantId: requireUuid("tenantId", input.tenantId),
    propertyNode: requireUuid("propertyNode", input.propertyNode),
    actorId: requireUuid("actorId", input.actorId),
    supervised: input.supervised,
  });
}

function normalizeApprovalRequest(input: RequestCashierOverShortApprovalInput): NormalizedApprovalRequest {
  requirePlainRecord("Cashier approval request input", input);
  requireAllowedKeys("Cashier approval request input", input, [
    "tenantId", "sessionId", "countId", "supervised", "idempotencyKey", "envelope",
  ]);
  const tenantId = requireUuid("tenantId", input.tenantId);
  if (typeof input.supervised !== "boolean") throw new CashierValidationError("supervised must be server-derived boolean authority");
  return Object.freeze({
    tenantId,
    sessionId: requireUuid("sessionId", input.sessionId),
    countId: requireUuid("countId", input.countId),
    supervised: input.supervised,
    idempotencyKey: requireIdempotencyKey(input.idempotencyKey),
    envelope: requireEnvelope(input.envelope, tenantId, "approval.requested"),
  });
}

function normalizeApprovalDecision(input: DecideCashierOverShortApprovalInput): NormalizedApprovalDecision {
  requirePlainRecord("Cashier approval decision input", input);
  requireAllowedKeys("Cashier approval decision input", input, [
    "tenantId", "sessionId", "approvalId", "idempotencyKey", "envelope",
  ]);
  const tenantId = requireUuid("tenantId", input.tenantId);
  return Object.freeze({
    tenantId,
    sessionId: requireUuid("sessionId", input.sessionId),
    approvalId: requireUuid("approvalId", input.approvalId),
    idempotencyKey: requireIdempotencyKey(input.idempotencyKey),
    envelope: requireEnvelope(input.envelope, tenantId, "approval.decided"),
  });
}

function bigintString(name: string, value: string | number | bigint): string {
  const text = String(value);
  if (!/^-?(?:0|[1-9][0-9]*)$/.test(text)) throw new CashierConflictError(`${name} is not an exact bigint`);
  try {
    const parsed = BigInt(text);
    if (parsed < -9_223_372_036_854_775_808n || parsed > 9_223_372_036_854_775_807n) {
      throw new Error("range");
    }
  } catch {
    throw new CashierConflictError(`${name} is outside signed bigint range`);
  }
  return text;
}

function approvalAmounts(row: ApprovalEvidenceRow, actorId: string, supervised: boolean): {
  readonly expectedMinor: string;
  readonly countedMinor: string;
  readonly overShortMinor: string;
} {
  if (row.counted_by !== actorId || (supervised ? row.opened_by === actorId : row.opened_by !== actorId)) {
    throw new CashierAuthorizationError("Cashier discrepancy approval belongs to the attributable cashier");
  }
  const expectedMinor = bigintString("expected_minor", row.expected_minor);
  const countedMinor = bigintString("counted_minor", row.counted_minor);
  const overShortMinor = (BigInt(countedMinor) - BigInt(expectedMinor)).toString();
  if (overShortMinor === "0") {
    throw new CashierConflictError("A zero cashier close requires no approval");
  }
  return Object.freeze({ expectedMinor, countedMinor, overShortMinor });
}

function exactApprovalPayload(value: unknown, sessionId: string): {
  readonly countId: string;
  readonly expectedMinor: string;
  readonly countedMinor: string;
  readonly overShortMinor: string;
} {
  requirePlainRecord("Cashier approval payload", value);
  const keys = Object.getOwnPropertyNames(value).sort();
  const expectedKeys = ["countId", "countedMinor", "expectedMinor", "overShortMinor", "sessionId"];
  if (keys.length !== expectedKeys.length || keys.some((key, index) => key !== expectedKeys[index])) {
    throw new CashierConflictError("Cashier approval payload is not exact");
  }
  if (value.sessionId !== sessionId) throw new CashierConflictError("Cashier approval payload targets another session");
  const countId = requireUuid("approval.payload.countId", value.countId);
  const expectedMinor = bigintString("approval.payload.expectedMinor", requireIntegerString(value.expectedMinor));
  const countedMinor = bigintString("approval.payload.countedMinor", requireIntegerString(value.countedMinor));
  const overShortMinor = bigintString("approval.payload.overShortMinor", requireIntegerString(value.overShortMinor));
  if (BigInt(overShortMinor) !== BigInt(countedMinor) - BigInt(expectedMinor) || overShortMinor === "0") {
    throw new CashierConflictError("Cashier approval payload discrepancy is invalid");
  }
  return Object.freeze({ countId, expectedMinor, countedMinor, overShortMinor });
}

function requireIntegerString(value: unknown): string {
  if (typeof value !== "string" || !/^-?(?:0|[1-9][0-9]*)$/.test(value)) {
    throw new CashierConflictError("Cashier approval amount must be an exact integer string");
  }
  return value;
}

function iso(name: string, value: Date): string {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new CashierConflictError(`${name} is not a valid timestamp`);
  }
  return value.toISOString();
}

function translate(error: unknown): never {
  const state = (error as { errno?: string; code?: string }).errno ??
    (error as { errno?: string; code?: string }).code;
  if (state === "42501") throw new CashierAuthorizationError("Cashier capability authority was denied");
  if (state === "22023" || state === "22003") throw new CashierValidationError("Cashier capability input is invalid");
  if (state === "55000" || state === "23505") throw new CashierConflictError("Cashier session state changed or is unavailable");
  throw error;
}

export class CashierService {
  readonly #database: Database;
  readonly #events: EventBus;
  readonly #idempotency: PostgresIdempotency;
  readonly #approvals: ApprovalService | undefined;

  constructor(options: CashierServiceOptions) {
    this.#database = options.database;
    this.#events = options.events;
    this.#idempotency = options.idempotency;
    this.#approvals = options.approvals;
  }

  #approvalService(): ApprovalService {
    if (!this.#approvals) throw new CashierConflictError("Cashier approval capability is unavailable");
    return this.#approvals;
  }

  async #approvalEvidence(
    tx: Tx,
    tenantId: string,
    propertyNode: string,
    sessionId: string,
    countId: string,
  ): Promise<ApprovalEvidenceRow> {
    const rows = await tx<ApprovalEvidenceRow[]>`
      SELECT session.id AS session_id, count.id AS count_id, session.user_id AS opened_by,
             count.counted_by, session.expected_minor::text, count.total_minor::text AS counted_minor
      FROM cashier_session AS session
      JOIN cashier_count AS count
        ON count.tenant_id = session.tenant_id
       AND count.session_id = session.id
       AND count.id = ${countId}::uuid
       AND count.kind = 'closing'
      WHERE session.tenant_id = ${tenantId}::uuid
        AND session.tenant_id = current_setting('app.tenant_id', true)::uuid
        AND session.id = ${sessionId}::uuid
        AND session.property_node = ${propertyNode}::uuid
        AND session.closed_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM cashier_count AS newer
          WHERE newer.tenant_id = count.tenant_id
            AND newer.session_id = count.session_id
            AND newer.kind = 'closing'
            AND newer.attempt_no > count.attempt_no
        )
    `;
    const row = rows[0];
    if (rows.length !== 1 || !row || row.session_id !== sessionId || row.count_id !== countId ||
        !UUID.test(row.opened_by) || !UUID.test(row.counted_by)) {
      throw new CashierConflictError("Cashier discrepancy evidence is stale or unavailable");
    }
    return row;
  }

  async requestOverShortApproval(
    input: RequestCashierOverShortApprovalInput,
  ): Promise<CashierOverShortApprovalResult> {
    const normalized = normalizeApprovalRequest(input);
    const approvals = this.#approvalService();
    try {
      const outcome = await this.#database.withTenantTransaction(normalized.tenantId, (tx) =>
        this.#idempotency.execute<ApprovalBody>(tx, {
          tenantId: normalized.tenantId,
          operation: "financials.cashier.approval.request",
          key: normalized.idempotencyKey,
          request: {
            actorId: normalized.envelope.actorId, propertyNode: normalized.envelope.propertyNode,
            sessionId: normalized.sessionId, countId: normalized.countId, supervised: normalized.supervised,
          },
        }, async (commandTx) => {
          const evidence = await this.#approvalEvidence(
            commandTx, normalized.tenantId, normalized.envelope.propertyNode,
            normalized.sessionId, normalized.countId,
          );
          const amounts = approvalAmounts(evidence, normalized.envelope.actorId, normalized.supervised);
          const approval = await approvals.request(commandTx, {
            kind: "cashier_over_short",
            subjectType: "cashier_session",
            subjectId: normalized.sessionId,
            requestedBy: normalized.envelope.actorId,
            payload: {
              sessionId: normalized.sessionId,
              countId: normalized.countId,
              expectedMinor: amounts.expectedMinor,
              countedMinor: amounts.countedMinor,
              overShortMinor: amounts.overShortMinor,
            },
            envelope: normalized.envelope,
          });
          if (approval.status !== "pending" || approval.tenantId !== normalized.tenantId ||
              approval.subjectId !== normalized.sessionId || approval.requestedBy !== normalized.envelope.actorId) {
            throw new CashierConflictError("Cashier discrepancy approval was not created canonically");
          }
          return { status: 201, body: Object.freeze({
            approvalId: approval.id,
            sessionId: normalized.sessionId,
            countId: normalized.countId,
            ...amounts,
            status: "pending" as const,
          }) };
        }),
      );
      return Object.freeze({ ...outcome.body, replayed: outcome.replayed });
    } catch (error) {
      return translate(error);
    }
  }

  async approveOverShort(
    input: DecideCashierOverShortApprovalInput,
  ): Promise<CashierOverShortApprovalResult> {
    return this.#decideOverShort(input, "approved");
  }

  async rejectOverShort(
    input: DecideCashierOverShortApprovalInput,
  ): Promise<CashierOverShortApprovalResult> {
    return this.#decideOverShort(input, "rejected");
  }

  async #decideOverShort(
    input: DecideCashierOverShortApprovalInput,
    decision: "approved" | "rejected",
  ): Promise<CashierOverShortApprovalResult> {
    const normalized = normalizeApprovalDecision(input);
    const approvals = this.#approvalService();
    try {
      const outcome = await this.#database.withTenantTransaction(normalized.tenantId, (tx) =>
        this.#idempotency.execute<ApprovalBody>(tx, {
          tenantId: normalized.tenantId,
          operation: "financials.cashier.approval.decide",
          key: normalized.idempotencyKey,
          request: {
            actorId: normalized.envelope.actorId, propertyNode: normalized.envelope.propertyNode,
            sessionId: normalized.sessionId, approvalId: normalized.approvalId,
          },
        }, async (commandTx) => {
          const approvalsRows = await commandTx<Array<{
            id: string; kind: string; subject_type: string; subject_id: string; requested_by: string;
            status: string; payload: Record<string, unknown>;
          }>>`
            SELECT id, kind, subject_type, subject_id, requested_by, status, payload
            FROM approval_request
            WHERE tenant_id = ${normalized.tenantId}::uuid
              AND id = ${normalized.approvalId}::uuid
            FOR UPDATE
          `;
          const approvalRow = approvalsRows[0];
          if (approvalsRows.length !== 1 || !approvalRow || approvalRow.kind !== "cashier_over_short" ||
              approvalRow.subject_type !== "cashier_session" || approvalRow.subject_id !== normalized.sessionId ||
              approvalRow.status !== "pending" || approvalRow.requested_by === normalized.envelope.actorId) {
            throw new CashierConflictError("Cashier discrepancy approval is unavailable for this decision");
          }
          const payload = exactApprovalPayload(approvalRow.payload, normalized.sessionId);
          const evidence = await this.#approvalEvidence(
            commandTx, normalized.tenantId, normalized.envelope.propertyNode,
            normalized.sessionId, payload.countId,
          );
          const amounts = approvalAmounts(evidence, approvalRow.requested_by, evidence.opened_by !== approvalRow.requested_by);
          if (payload.expectedMinor !== amounts.expectedMinor || payload.countedMinor !== amounts.countedMinor ||
              payload.overShortMinor !== amounts.overShortMinor) {
            throw new CashierConflictError("Cashier discrepancy approval evidence is stale");
          }
          const decided = await approvals.decide(commandTx, {
            approvalId: normalized.approvalId,
            decision,
            decidedBy: normalized.envelope.actorId,
            envelope: normalized.envelope,
          });
          if (decided.status !== decision || decided.decidedBy !== normalized.envelope.actorId) {
            throw new CashierConflictError("Cashier discrepancy approval was not decided canonically");
          }
          return { status: 200, body: Object.freeze({
            approvalId: normalized.approvalId, sessionId: normalized.sessionId, countId: payload.countId,
            ...amounts, status: decision,
          }) };
        }),
      );
      return Object.freeze({ ...outcome.body, replayed: outcome.replayed });
    } catch (error) {
      return translate(error);
    }
  }

  /** Server-owned drawer discovery; callers never provide free-form drawer codes. */
  async list(input: CashierListInput): Promise<readonly CashierReadResult[]> {
    const normalized = normalizeList(input);
    try {
      const drawers = await this.#database.withTenantTransaction(normalized.tenantId, async (tx) => tx<Array<{ id: string }>>`
        SELECT id
        FROM cash_drawer
        WHERE tenant_id = ${normalized.tenantId}::uuid
          AND tenant_id = current_setting('app.tenant_id', true)::uuid
          AND property_node = ${normalized.propertyNode}::uuid
          AND active
        ORDER BY code, id
      `);
      if (drawers.some(({ id }) => !UUID.test(id))) {
        throw new CashierConflictError("Cashier drawer list is inconsistent");
      }
      return Object.freeze(await Promise.all(drawers.map(({ id }) => this.read({ ...normalized, drawerId: id }))));
    } catch (error) {
      return translate(error);
    }
  }

  /**
   * The ordinary view carries just the latest count submitted by this actor; no
   * expected/count totals are ever read before close. Supervisors receive the
   * immutable attempt trail, still without denomination quantities or totals.
   */
  async read(input: CashierReadInput): Promise<CashierReadResult> {
    const normalized = normalizeRead(input);
    try {
      return await this.#database.withTenantTransaction(normalized.tenantId, async (tx) => {
        const drawers = await tx<DrawerRow[]>`
          SELECT drawer.id, drawer.property_node, drawer.code, drawer.name, drawer.currency::text,
                 session.id AS session_id, session.business_date::text, session.opened_at,
                 session.user_id AS opened_by, session.opening_count_id
          FROM cash_drawer AS drawer
          LEFT JOIN cashier_session AS session
            ON session.tenant_id = drawer.tenant_id
           AND session.drawer_id = drawer.id
           AND session.closed_at IS NULL
          WHERE drawer.tenant_id = ${normalized.tenantId}::uuid
            AND drawer.tenant_id = current_setting('app.tenant_id', true)::uuid
            AND drawer.id = ${normalized.drawerId}::uuid
            AND drawer.property_node = ${normalized.propertyNode}::uuid
            AND drawer.active
          ORDER BY session.opened_at DESC NULLS LAST, session.id
        `;
        const drawer = drawers[0];
        if (drawers.length !== 1 || !drawer || drawer.id !== normalized.drawerId ||
            drawer.property_node !== normalized.propertyNode || !CURRENCY.test(drawer.currency)) {
          throw new CashierNotFoundError("Cashier drawer was not found in the property");
        }
        const denominations = await tx<DenominationRow[]>`
          SELECT unit_minor::text
          FROM cash_drawer_denomination
          WHERE tenant_id = ${normalized.tenantId}::uuid
            AND tenant_id = current_setting('app.tenant_id', true)::uuid
            AND drawer_id = ${normalized.drawerId}::uuid
            AND active
          ORDER BY unit_minor
        `;
        if (denominations.length < 1 || denominations.length > MAX_DENOMINATIONS) {
          throw new CashierConflictError("Cashier drawer denominations are unavailable");
        }
        const denominationResult = Object.freeze(denominations.map(({ unit_minor }) => Object.freeze({
          denominationMinor: requirePositiveInteger("drawer denomination", String(unit_minor)),
        })));
        if (drawer.session_id === null) {
          if (drawer.business_date !== null || drawer.opened_at !== null || drawer.opened_by !== null ||
              drawer.opening_count_id !== null) {
            throw new CashierConflictError("Cashier drawer has an inconsistent active session");
          }
          return Object.freeze({
            drawerId: drawer.id, propertyNode: drawer.property_node, code: drawer.code, name: drawer.name,
            currency: drawer.currency, denominations: denominationResult, session: null,
          });
        }
        if (!UUID.test(drawer.session_id) || !BUSINESS_DATE.test(drawer.business_date ?? "") ||
            drawer.opened_at === null || !UUID.test(drawer.opened_by ?? "") ||
            !UUID.test(drawer.opening_count_id ?? "")) {
          throw new CashierConflictError("Cashier active session is inconsistent");
        }
        const counts = await tx<ReadCountRow[]>`
          SELECT id, attempt_no::int, counted_at, counted_by
          FROM cashier_count
          WHERE tenant_id = ${normalized.tenantId}::uuid
            AND tenant_id = current_setting('app.tenant_id', true)::uuid
            AND session_id = ${drawer.session_id}::uuid
            AND kind = 'closing'
            AND (${normalized.supervised} OR counted_by = ${normalized.actorId}::uuid)
          ORDER BY attempt_no DESC, counted_at DESC, id DESC
        `;
        const attempts = counts.map((row) => {
          const attemptNo = Number(row.attempt_no);
          if (!UUID.test(row.id) || !UUID.test(row.counted_by) || !Number.isSafeInteger(attemptNo) || attemptNo < 1) {
            throw new CashierConflictError("Cashier count history is inconsistent");
          }
          return Object.freeze({ countId: row.id, attemptNo, countedAt: iso("counted_at", row.counted_at), countedBy: row.counted_by });
        });
        const latestCount = attempts[0] ?? null;
        return Object.freeze({
          drawerId: drawer.id,
          propertyNode: drawer.property_node,
          code: drawer.code,
          name: drawer.name,
          currency: drawer.currency,
          denominations: denominationResult,
          session: Object.freeze({
            sessionId: drawer.session_id,
            businessDate: drawer.business_date!,
            openedAt: iso("opened_at", drawer.opened_at!),
            openedBy: drawer.opened_by!,
            openingCountId: drawer.opening_count_id!,
            latestCount,
            countHistory: Object.freeze(normalized.supervised ? attempts : []),
          }),
        });
      });
    } catch (error) {
      return translate(error);
    }
  }

  async open(input: OpenCashierSessionInput): Promise<OpenCashierSessionResult> {
    const normalized = normalizeOpen(input);
    try {
      const outcome = await this.#database.withTenantTransaction(normalized.tenantId, (tx) =>
        this.#idempotency.execute<OpenBody>(tx, {
          tenantId: normalized.tenantId,
          operation: "financials.cashier.open",
          key: normalized.idempotencyKey,
          request: {
            actorId: normalized.envelope.actorId,
            propertyNode: normalized.envelope.propertyNode,
            drawerId: normalized.drawerId,
            denominations: normalized.denominations,
          },
        }, async (commandTx) => {
          const units = normalized.denominations.map(({ denominationMinor }) => denominationMinor);
          const quantities = normalized.denominations.map(({ quantity }) => quantity);
          const unitsArray = `{${units.join(",")}}`;
          const quantitiesArray = `{${quantities.join(",")}}`;
          const rows = await commandTx<OpenRow[]>`
            SELECT session_id, count_id, business_date::text, currency::text,
                   expected_minor::text, counted_minor::text, opened_at
            FROM public.open_cashier_session(
              ${normalized.tenantId}::uuid, ${normalized.envelope.propertyNode}::uuid,
              ${normalized.drawerId}::uuid, ${normalized.envelope.actorId}::uuid,
              ${unitsArray}::bigint[], ${quantitiesArray}::bigint[]
            )
          `;
          const row = rows[0];
          if (rows.length !== 1 || !row || !UUID.test(row.session_id) || !UUID.test(row.count_id) ||
              !BUSINESS_DATE.test(row.business_date) || !CURRENCY.test(row.currency)) {
            throw new CashierConflictError("Cashier opening capability returned an invalid row");
          }
          const expectedMinor = bigintString("expected_minor", row.expected_minor);
          const openingFloatMinor = bigintString("counted_minor", row.counted_minor);
          if (expectedMinor !== openingFloatMinor) {
            throw new CashierConflictError("Cashier opening expected amount must equal opening float");
          }
          const openedAt = iso("opened_at", row.opened_at);
          const payload = Object.freeze({
            session_id: row.session_id,
            drawer_id: normalized.drawerId,
            count_id: row.count_id,
            business_date: row.business_date,
            currency: row.currency,
          });
          const fact = await recordFact(commandTx, {
            entityType: "cashier_session",
            entityId: row.session_id,
            envelope: normalized.envelope,
            payload,
          });
          if (fact.businessDate !== row.business_date) {
            throw new CashierConflictError("Cashier opening business date diverged from audit fact");
          }
          await this.#events.publish(commandTx, {
            tenantId: normalized.tenantId,
            propertyNode: normalized.envelope.propertyNode,
            businessDate: fact.businessDate,
            aggregateType: "cashier_session",
            aggregateId: row.session_id,
            eventType: "cashier.opened",
            actorId: normalized.envelope.actorId,
            correlationId: normalized.envelope.requestId,
            payload,
          });
          return { status: 201, body: Object.freeze({
            sessionId: row.session_id,
            drawerId: normalized.drawerId,
            openingCountId: row.count_id,
            businessDate: row.business_date,
            currency: row.currency,
            openingFloatMinor,
            expectedMinor,
            openedAt,
          }) };
        }),
      );
      return Object.freeze({ ...outcome.body, replayed: outcome.replayed });
    } catch (error) {
      return translate(error);
    }
  }

  async appendCount(input: AppendCashierCountInput): Promise<AppendCashierCountResult> {
    const normalized = normalizeCount(input);
    try {
      const outcome = await this.#database.withTenantTransaction(normalized.tenantId, (tx) =>
        this.#idempotency.execute<CountBody>(tx, {
          tenantId: normalized.tenantId,
          operation: "financials.cashier.count",
          key: normalized.idempotencyKey,
          request: {
            actorId: normalized.envelope.actorId,
            propertyNode: normalized.envelope.propertyNode,
            sessionId: normalized.sessionId,
            denominations: normalized.denominations,
          },
        }, async (commandTx) => {
          const units = normalized.denominations.map(({ denominationMinor }) => denominationMinor);
          const quantities = normalized.denominations.map(({ quantity }) => quantity);
          const unitsArray = `{${units.join(",")}}`;
          const quantitiesArray = `{${quantities.join(",")}}`;
          const rows = await commandTx<CountRow[]>`
            SELECT count_id, session_id, attempt_no::int, counted_minor::text, counted_at
            FROM public.append_cashier_count(
              ${normalized.tenantId}::uuid, ${normalized.envelope.propertyNode}::uuid,
              ${normalized.sessionId}::uuid, ${normalized.envelope.actorId}::uuid,
              ${unitsArray}::bigint[], ${quantitiesArray}::bigint[]
            )
          `;
          const row = rows[0];
          const attemptNo = Number(row?.attempt_no);
          if (rows.length !== 1 || !row || !UUID.test(row.count_id) || row.session_id !== normalized.sessionId ||
              !Number.isSafeInteger(attemptNo) || attemptNo < 1 || bigintString("counted_minor", row.counted_minor) === "") {
            throw new CashierConflictError("Cashier count capability returned an invalid row");
          }
          const countedAt = iso("counted_at", row.counted_at);
          const fact = await recordFact(commandTx, {
            entityType: "cashier_session",
            entityId: normalized.sessionId,
            envelope: normalized.envelope,
            payload: { session_id: normalized.sessionId, count_id: row.count_id, attempt_no: attemptNo },
          });
          await this.#events.publish(commandTx, {
            tenantId: normalized.tenantId,
            propertyNode: normalized.envelope.propertyNode,
            businessDate: fact.businessDate,
            aggregateType: "cashier_session",
            aggregateId: normalized.sessionId,
            eventType: "cashier.counted",
            actorId: normalized.envelope.actorId,
            correlationId: normalized.envelope.requestId,
            payload: { session_id: normalized.sessionId, count_id: row.count_id, attempt_no: attemptNo },
          });
          return { status: 201, body: Object.freeze({
            countId: row.count_id, sessionId: normalized.sessionId, attemptNo, countedAt,
          }) };
        }),
      );
      return Object.freeze({ ...outcome.body, replayed: outcome.replayed });
    } catch (error) {
      return translate(error);
    }
  }

  async close(input: CloseCashierSessionInput): Promise<CloseCashierSessionResult> {
    const normalized = normalizeClose(input);
    try {
      const outcome = await this.#database.withTenantTransaction(normalized.tenantId, (tx) =>
        this.#idempotency.execute<CloseBody>(tx, {
          tenantId: normalized.tenantId,
          operation: "financials.cashier.close",
          key: normalized.idempotencyKey,
          request: {
            actorId: normalized.envelope.actorId,
            propertyNode: normalized.envelope.propertyNode,
            sessionId: normalized.sessionId,
            countId: normalized.countId,
            reason: normalized.reason,
            approvalId: normalized.approvalId,
            supervised: normalized.supervised,
          },
        }, async (commandTx) => {
          const rows = await commandTx<CloseRow[]>`
            SELECT session_id, opening_count_id, closing_count_id, business_date::text, currency::text,
                   expected_minor::text, counted_minor::text, over_short_minor::text,
                   closed_at, closed_by, supervised
            FROM public.close_cashier_session(
              ${normalized.tenantId}::uuid, ${normalized.envelope.propertyNode}::uuid,
              ${normalized.sessionId}::uuid, ${normalized.envelope.actorId}::uuid,
              ${normalized.countId}::uuid, ${normalized.approvalId}::uuid, ${normalized.reason},
              ${normalized.supervised}
            )
          `;
          const row = rows[0];
          if (rows.length !== 1 || !row || row.session_id !== normalized.sessionId ||
              !UUID.test(row.opening_count_id) || row.closing_count_id !== normalized.countId ||
              !BUSINESS_DATE.test(row.business_date) || !CURRENCY.test(row.currency) ||
              !UUID.test(row.closed_by) || row.closed_by !== normalized.envelope.actorId ||
              row.supervised !== normalized.supervised) {
            throw new CashierConflictError("Cashier close capability returned an invalid row");
          }
          const expectedMinor = bigintString("expected_minor", row.expected_minor);
          const countedMinor = bigintString("counted_minor", row.counted_minor);
          const overShortMinor = bigintString("over_short_minor", row.over_short_minor);
          if (BigInt(overShortMinor) !== BigInt(countedMinor) - BigInt(expectedMinor)) {
            throw new CashierConflictError("Cashier close discrepancy is not exact");
          }
          const closedAt = iso("closed_at", row.closed_at);
          const fact = await recordFact(commandTx, {
            entityType: "cashier_session",
            entityId: normalized.sessionId,
            envelope: normalized.envelope,
            payload: {
              session_id: normalized.sessionId,
              opening_count_id: row.opening_count_id,
              closing_count_id: row.closing_count_id,
              business_date: row.business_date,
              currency: row.currency,
              expected_minor: expectedMinor,
              counted_minor: countedMinor,
              over_short_minor: overShortMinor,
              supervised: row.supervised,
            },
          });
          if (fact.businessDate !== row.business_date) {
            throw new CashierConflictError("Cashier close business date diverged from audit fact");
          }
          await this.#events.publish(commandTx, {
            tenantId: normalized.tenantId,
            propertyNode: normalized.envelope.propertyNode,
            businessDate: fact.businessDate,
            aggregateType: "cashier_session",
            aggregateId: normalized.sessionId,
            eventType: "cashier.closed",
            actorId: normalized.envelope.actorId,
            correlationId: normalized.envelope.requestId,
            payload: {
              session_id: normalized.sessionId,
              closing_count_id: row.closing_count_id,
              currency: row.currency,
              over_short_minor: overShortMinor,
              supervised: row.supervised,
            },
          });
          return { status: 200, body: Object.freeze({
            sessionId: normalized.sessionId,
            openingCountId: row.opening_count_id,
            closingCountId: row.closing_count_id,
            businessDate: row.business_date,
            currency: row.currency,
            expectedMinor,
            countedMinor,
            overShortMinor,
            closedAt,
            closedBy: row.closed_by,
            supervised: row.supervised,
          }) };
        }),
      );
      return Object.freeze({ ...outcome.body, replayed: outcome.replayed });
    } catch (error) {
      return translate(error);
    }
  }
}
