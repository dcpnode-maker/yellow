import {
  recordFact,
  type AuditEnvelope,
  type Database,
  type EventBus,
  type Tx,
} from "../../kernel";
import type {
  PaymentProvider,
  PaymentProviderOutcome,
  PaymentProviderPhase,
  PaymentProviderRequest,
} from "./payment-provider";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const KEY = /^[\x21-\x7e]{8,200}$/;
const POSITIVE = /^[1-9][0-9]*$/;
const HASH = /^[0-9a-f]{64}$/;
const SAFE_ID = /^[!-~]{8,200}$/;
const INT64_MAX = 9_223_372_036_854_775_807n;

type CommandPhase = PaymentProviderPhase;
type AttemptStatus = "pending" | "succeeded" | "failed";

export interface CreatePaymentOperationInput {
  readonly tenantId: string;
  readonly folioId: string;
  readonly instrumentId: string;
  readonly amountMinor: string;
  readonly idempotencyKey: string;
  readonly envelope: AuditEnvelope;
}

export interface PaymentTransitionInput {
  readonly tenantId: string;
  readonly operationId: string;
  readonly amountMinor: string;
  readonly idempotencyKey: string;
  readonly envelope: AuditEnvelope;
}

export interface VoidPaymentInput {
  readonly tenantId: string;
  readonly operationId: string;
  readonly idempotencyKey: string;
  readonly envelope: AuditEnvelope;
}

export interface ReconcilePaymentInput {
  readonly tenantId: string;
  readonly operationId: string;
  readonly eventId: string;
  readonly contentHash: string;
  readonly providerReference: string;
  readonly phase: CommandPhase;
  readonly outcome: "approved" | "declined";
  readonly amountMinor: string;
  readonly currency: string;
  readonly envelope: AuditEnvelope;
}

export interface PaymentCommandResult {
  readonly operationId: string;
  readonly paymentId: string;
  readonly phase: CommandPhase;
  readonly outcome: "approved" | "declined" | "indeterminate";
  readonly amountMinor: string;
  readonly currency: string;
  readonly journalId: string | null;
  readonly replayed: boolean;
}

export interface PaymentServiceOptions {
  readonly database: Database;
  readonly events: EventBus;
  readonly provider: PaymentProvider;
}

interface OperationRow {
  readonly id: string;
  readonly property_node: string;
  readonly folio_id: string;
  readonly guest_account_id: string;
  readonly instrument_id: string;
  readonly provider: string;
  readonly method: "card" | "upi";
  readonly currency: string;
  readonly tx_code: string;
  readonly clearing_account_id: string;
  readonly actor_id: string;
  readonly token: string;
}

interface AttemptRow {
  readonly id: string;
  readonly phase: CommandPhase;
  readonly amount_minor: string;
  readonly status: AttemptStatus;
  readonly result_code: string;
  readonly psp_ref: string | null;
  readonly journal_id: string | null;
  readonly attempt_no: number;
  readonly predecessor_payment_id: string | null;
  readonly request_hash: string;
}

interface ChainState {
  readonly authorized: bigint;
  readonly captured: bigint;
  readonly refunded: bigint;
  readonly voided: boolean;
  readonly indeterminate: boolean;
  readonly unresolved: boolean;
  readonly last: AttemptRow | undefined;
  readonly capture: AttemptRow | undefined;
}

interface Prepared {
  readonly tenantId: string;
  readonly operation: OperationRow;
  readonly phase: CommandPhase;
  readonly amountMinor: string;
  readonly pendingId: string;
  readonly pendingAttemptNo: number;
  readonly commandKeyHash: string;
  readonly requestHash: string;
  readonly envelope: AuditEnvelope;
  readonly providerRequest: PaymentProviderRequest;
}

interface ReceiptInput {
  readonly eventId: string;
  readonly contentHash: string;
  readonly providerReference: string;
  readonly outcome: "approved" | "declined";
}

interface ExistingResult {
  readonly result: PaymentCommandResult;
}

export class PaymentValidationError extends Error {
  constructor(message: string) { super(message); this.name = "PaymentValidationError"; }
}
export class PaymentNotFoundError extends Error {
  constructor(message: string) { super(message); this.name = "PaymentNotFoundError"; }
}
export class PaymentConflictError extends Error {
  constructor(message: string) { super(message); this.name = "PaymentConflictError"; }
}

function sha256(value: string): string {
  return new Bun.CryptoHasher("sha256").update(value).digest("hex");
}

function requireRecord(value: unknown, name: string): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value) ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) ||
      Object.getOwnPropertySymbols(value).length > 0) {
    throw new PaymentValidationError(`${name} must be a plain object`);
  }
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[], name: string): void {
  const set = new Set(allowed);
  const extra = Object.getOwnPropertyNames(value).filter((key) => !set.has(key)).sort();
  if (extra.length) throw new PaymentValidationError(`${name} contains unsupported fields: ${extra.join(", ")}`);
}

function uuid(value: unknown, name: string): string {
  if (typeof value !== "string" || !UUID.test(value)) throw new PaymentValidationError(`${name} must be a UUID`);
  return value;
}

function money(value: unknown): { text: string; value: bigint } {
  if (typeof value !== "string" || !POSITIVE.test(value)) {
    throw new PaymentValidationError("amountMinor must be a canonical positive int64 decimal string");
  }
  const parsed = BigInt(value);
  if (parsed > INT64_MAX) throw new PaymentValidationError("amountMinor exceeds positive int64 range");
  return { text: value, value: parsed };
}

function envelope(value: AuditEnvelope, tenantId: string, expectedOperation: string): AuditEnvelope {
  requireRecord(value, "envelope");
  exactKeys(value, ["actorId", "tenantId", "propertyNode", "requestId", "operation"], "envelope");
  if (uuid(value.tenantId, "envelope.tenantId") !== tenantId) throw new PaymentValidationError("tenant authority mismatch");
  uuid(value.actorId, "envelope.actorId"); uuid(value.propertyNode, "envelope.propertyNode");
  uuid(value.requestId, "envelope.requestId");
  if (value.operation !== expectedOperation) throw new PaymentValidationError(`audit operation must be ${expectedOperation}`);
  return value;
}

function key(value: unknown): string {
  if (typeof value !== "string" || !KEY.test(value)) {
    throw new PaymentValidationError("idempotencyKey must contain 8-200 visible ASCII characters");
  }
  return value;
}

function chain(rows: readonly AttemptRow[]): ChainState {
  let authorized = 0n; let captured = 0n; let refunded = 0n;
  let voided = false; let indeterminate = false; let unresolved = false;
  let capture: AttemptRow | undefined;
  const resolved = new Set(rows.flatMap((row) => row.predecessor_payment_id ? [row.predecessor_payment_id] : []));
  for (const row of rows) {
    if (row.result_code === "indeterminate" && !resolved.has(row.id)) indeterminate = true;
    if (row.result_code === "prepared" && !resolved.has(row.id)) unresolved = true;
    if (row.status !== "succeeded") continue;
    const amount = BigInt(row.amount_minor);
    if (row.phase === "auth" || row.phase === "incremental_auth") authorized += amount;
    else if (row.phase === "capture") { captured += amount; capture = row; }
    else if (row.phase === "refund") refunded += amount;
    else if (row.phase === "void") voided = true;
  }
  return { authorized, captured, refunded, voided, indeterminate, unresolved, last: rows.at(-1), capture };
}

function lifecycleEvent(phase: CommandPhase, outcome: PaymentProviderOutcome["outcome"], reconciled: boolean): string {
  if (reconciled) return "payment.reconciled";
  if (outcome === "declined") return "payment.failed";
  if (outcome === "indeterminate") return "payment.indeterminate";
  return `payment.${phase === "auth" ? "authorized" : phase === "incremental_auth" ? "incrementally_authorized" :
    phase === "capture" ? "captured" : phase === "refund" ? "refunded" : "voided"}`;
}

function resultFrom(row: AttemptRow, operation: OperationRow, replayed: boolean): PaymentCommandResult {
  const outcome = row.status === "succeeded" ? "approved" : row.status === "failed" ? "declined" : "indeterminate";
  return Object.freeze({ operationId: operation.id, paymentId: row.id, phase: row.phase, outcome,
    amountMinor: row.amount_minor, currency: operation.currency, journalId: row.journal_id, replayed });
}

export class PaymentService {
  readonly #database: Database;
  readonly #events: EventBus;
  readonly #provider: PaymentProvider;

  constructor(options: PaymentServiceOptions) {
    this.#database = options.database; this.#events = options.events; this.#provider = options.provider;
  }

  authorize(input: CreatePaymentOperationInput): Promise<PaymentCommandResult> {
    return this.#run("auth", input);
  }
  incrementalAuthorize(input: PaymentTransitionInput): Promise<PaymentCommandResult> {
    return this.#run("incremental_auth", input);
  }
  capture(input: PaymentTransitionInput): Promise<PaymentCommandResult> { return this.#run("capture", input); }
  refund(input: PaymentTransitionInput): Promise<PaymentCommandResult> { return this.#run("refund", input); }
  void(input: VoidPaymentInput): Promise<PaymentCommandResult> { return this.#run("void", input); }

  async #run(phase: CommandPhase, input: CreatePaymentOperationInput | PaymentTransitionInput | VoidPaymentInput): Promise<PaymentCommandResult> {
    const prepared = await this.#database.withTenantTransaction(input.tenantId,
      (tx) => this.#prepare(tx, phase, input));
    if ("result" in prepared) return prepared.result;
    const providerOutcome = await this.#provider.execute(prepared.providerRequest);
    return this.#database.withTenantTransaction(prepared.tenantId,
      (tx) => this.#apply(tx, prepared, providerOutcome, null));
  }

  async #prepare(tx: Tx, phase: CommandPhase,
    raw: CreatePaymentOperationInput | PaymentTransitionInput | VoidPaymentInput): Promise<Prepared | ExistingResult> {
    requireRecord(raw, "payment input");
    const isAuth = phase === "auth";
    const isVoid = phase === "void";
    exactKeys(raw, isAuth
      ? ["tenantId", "folioId", "instrumentId", "amountMinor", "idempotencyKey", "envelope"]
      : isVoid ? ["tenantId", "operationId", "idempotencyKey", "envelope"]
      : ["tenantId", "operationId", "amountMinor", "idempotencyKey", "envelope"], "payment input");
    const tenantId = uuid(raw.tenantId, "tenantId");
    const expectedEvent = `payment.${phase === "auth" ? "authorized" : phase === "incremental_auth" ? "incrementally_authorized" : phase === "capture" ? "captured" : phase === "refund" ? "refunded" : "voided"}`;
    const audit = envelope(raw.envelope, tenantId, expectedEvent);
    const idem = key(raw.idempotencyKey);
    const operationId = isAuth ? undefined : uuid((raw as PaymentTransitionInput).operationId, "operationId");
    const requestedMoney = isVoid ? undefined : money((raw as CreatePaymentOperationInput).amountMinor);
    const requestShape = isAuth
      ? { phase, folioId: uuid((raw as CreatePaymentOperationInput).folioId, "folioId"),
          instrumentId: uuid((raw as CreatePaymentOperationInput).instrumentId, "instrumentId"), amountMinor: requestedMoney!.text,
          actorId: audit.actorId, propertyNode: audit.propertyNode }
      : { phase, operationId, ...(requestedMoney ? { amountMinor: requestedMoney.text } : {}),
          actorId: audit.actorId, propertyNode: audit.propertyNode };
    const commandKeyHash = sha256(idem);
    const requestHash = sha256(JSON.stringify(requestShape));

    let operation: OperationRow;
    if (isAuth) {
      await tx`SELECT pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(${`${tenantId}:${commandKeyHash}`},0))`;
      const existingOperation = (await tx<OperationRow[]>`
        SELECT op.id,op.property_node,op.folio_id,op.guest_account_id,op.instrument_id,
               op.provider,op.method,op.currency::text,op.tx_code,op.clearing_account_id,
               op.actor_id,instrument.token
          FROM payment_operation op
          JOIN payment_instrument instrument ON instrument.tenant_id=op.tenant_id AND instrument.id=op.instrument_id
         WHERE op.tenant_id=${tenantId}::uuid AND op.key_hash=${commandKeyHash}`)[0];
      if (existingOperation) {
        const hashes = await tx<Array<{ request_hash: string }>>`SELECT request_hash FROM payment_operation
          WHERE tenant_id=${tenantId}::uuid AND id=${existingOperation.id}::uuid`;
        if (hashes[0]?.request_hash !== requestHash) throw new PaymentConflictError("Idempotency key was reused with a changed request");
        operation = existingOperation;
      } else {
        const context = (await tx<OperationRow[]>`
          SELECT gen_random_uuid()::text id, account.property_node,folio.id folio_id,account.id guest_account_id,
                 instrument.id instrument_id,instrument.psp provider,
                 CASE instrument.kind WHEN 'card_network_token' THEN 'card' ELSE 'upi' END method,
                 account.currency::text,
                 CASE instrument.kind WHEN 'card_network_token' THEN 'CARD_PAYMENT' ELSE 'UPI_PAYMENT' END tx_code,
                 route.debit_account_id clearing_account_id,${audit.actorId}::uuid actor_id,instrument.token
            FROM folio
            JOIN account ON account.tenant_id=folio.tenant_id AND account.id=folio.account_id
            JOIN org_node property ON property.tenant_id=account.tenant_id AND property.id=account.property_node AND property.kind='property'
            JOIN payment_instrument instrument ON instrument.tenant_id=folio.tenant_id AND instrument.id=${(raw as CreatePaymentOperationInput).instrumentId}::uuid
            JOIN tx_code code ON code.code=CASE instrument.kind WHEN 'card_network_token' THEN 'CARD_PAYMENT' ELSE 'UPI_PAYMENT' END
            JOIN tx_code_route route ON route.tenant_id=account.tenant_id AND route.property_node=account.property_node
              AND route.currency=account.currency AND route.tx_code=code.code
            JOIN account clearing ON clearing.tenant_id=route.tenant_id AND clearing.id=route.debit_account_id
            JOIN app_user actor ON actor.tenant_id=folio.tenant_id AND actor.id=${audit.actorId}::uuid AND actor.status='active'
           WHERE folio.tenant_id=${tenantId}::uuid AND folio.id=${(raw as CreatePaymentOperationInput).folioId}::uuid
             AND folio.status='open' AND account.status='open' AND account.role='guest'
             AND property.id=${audit.propertyNode}::uuid AND property.currency=account.currency
             AND instrument.status='active' AND instrument.token IS NOT NULL
             AND instrument.kind IN ('card_network_token','upi_vpa') AND instrument.psp ~ '^[a-z][a-z0-9._-]{0,63}$'
             AND code.grp='payment' AND code.default_dr=CASE instrument.kind WHEN 'card_network_token' THEN 'card_clearing' ELSE 'upi_clearing' END
             AND code.default_cr='guest' AND clearing.status='open'
             AND clearing.role=CASE instrument.kind WHEN 'card_network_token' THEN 'card_clearing' ELSE 'upi_clearing' END
             AND clearing.property_node=account.property_node AND clearing.currency=account.currency`)[0];
        if (!context || !context.token || !SAFE_ID.test(context.token) || /^[0-9]{12,19}$/.test(context.token)) {
          throw new PaymentNotFoundError("Active tokenized instrument and governed folio payment route were not found");
        }
        const inserted = await tx<OperationRow[]>`
          INSERT INTO payment_operation(tenant_id,id,property_node,folio_id,guest_account_id,instrument_id,
            provider,method,currency,tx_code,clearing_account_id,purpose,key_hash,request_hash,actor_id)
          VALUES(${tenantId}::uuid,${context.id}::uuid,${context.property_node}::uuid,${context.folio_id}::uuid,
            ${context.guest_account_id}::uuid,${context.instrument_id}::uuid,${context.provider},${context.method},
            ${context.currency}::char(3),${context.tx_code},${context.clearing_account_id}::uuid,'folio_payment',
            ${commandKeyHash},${requestHash},${audit.actorId}::uuid)
          RETURNING id,property_node,folio_id,guest_account_id,instrument_id,provider,method,currency::text,
                    tx_code,clearing_account_id,actor_id,${context.token}::text token`;
        operation = inserted[0]!;
      }
    } else {
      await tx`SELECT public.lock_payment_operation(${tenantId}::uuid,${operationId!}::uuid)`;
      const found = (await tx<OperationRow[]>`
        SELECT op.id,op.property_node,op.folio_id,op.guest_account_id,op.instrument_id,
               op.provider,op.method,op.currency::text,op.tx_code,op.clearing_account_id,
               op.actor_id,instrument.token
          FROM payment_operation op
          JOIN payment_instrument instrument ON instrument.tenant_id=op.tenant_id AND instrument.id=op.instrument_id
         WHERE op.tenant_id=${tenantId}::uuid AND op.id=${operationId!}::uuid
           AND op.property_node=${audit.propertyNode}::uuid AND instrument.status='active'`)[0];
      if (!found || !found.token) throw new PaymentNotFoundError("Payment operation was not found in the audit property");
      operation = found;
    }

    const prior = await tx<AttemptRow[]>`
      SELECT id,phase,amount_minor::text,status,result_code,psp_ref,journal_id,attempt_no,
             predecessor_payment_id,request_hash FROM payment
       WHERE tenant_id=${tenantId}::uuid AND operation_id=${operation.id}::uuid
       ORDER BY attempt_no,id`;
    const keyRow = await tx<AttemptRow[]>`SELECT id,phase,amount_minor::text,status,result_code,psp_ref,journal_id,
      attempt_no,predecessor_payment_id,request_hash FROM payment
      WHERE tenant_id=${tenantId}::uuid AND operation_id=${operation.id}::uuid AND command_key_hash=${commandKeyHash}`;
    if (keyRow[0]) {
      if (keyRow[0].request_hash !== requestHash || keyRow[0].phase !== phase) throw new PaymentConflictError("Idempotency key was reused with a changed request");
      const terminal = prior.find((row) => row.predecessor_payment_id === keyRow[0]!.id);
      if (terminal) return { result: resultFrom(terminal, operation, true) };
      if (keyRow[0].result_code !== "prepared") return { result: resultFrom(keyRow[0], operation, true) };
      const priorReference = [...prior].reverse().find((row) => row.psp_ref !== null)?.psp_ref;
      return { tenantId, operation, phase, amountMinor: keyRow[0].amount_minor,
        pendingId: keyRow[0].id, pendingAttemptNo: keyRow[0].attempt_no,
        commandKeyHash, requestHash, envelope: audit,
        providerRequest: Object.freeze({ commandId: `${phase}-${keyRow[0].id}`, phase,
          provider: operation.provider, method: operation.method, token: operation.token,
          amountMinor: keyRow[0].amount_minor, currency: operation.currency,
          ...(priorReference ? { priorProviderReference: priorReference } : {}) }) };
    }
    const state = chain(prior);
    if (state.indeterminate) throw new PaymentConflictError("Payment operation requires reconciliation");
    if (state.unresolved) throw new PaymentConflictError("Payment operation has an unresolved provider call");
    if (state.voided) throw new PaymentConflictError("Payment operation is voided");
    if (phase !== "auth" && state.authorized === 0n) throw new PaymentConflictError("Payment operation is not authorized");
    let amount = requestedMoney?.value ?? 0n;
    if (phase === "auth" && state.authorized > 0n) throw new PaymentConflictError("Payment operation is already authorized");
    if (phase === "incremental_auth" && state.captured > 0n) throw new PaymentConflictError("Captured payment cannot be incremented");
    if (phase === "capture") {
      if (state.captured > 0n) throw new PaymentConflictError("Payment operation already has its one capture");
      if (amount > state.authorized) throw new PaymentConflictError("Capture exceeds authorized value");
      await tx`SELECT public.lock_financial_rows(${tenantId}::uuid,
        ARRAY[${operation.guest_account_id}::uuid,${operation.clearing_account_id}::uuid]::uuid[],${operation.folio_id}::uuid)`;
      const balance = (await tx<Array<{ amount: string }>>`SELECT COALESCE(sum(amount_minor),0)::text amount FROM posting_line
        WHERE tenant_id=${tenantId}::uuid AND folio_id=${operation.folio_id}::uuid`)[0]!.amount;
      if (BigInt(balance) <= 0n || amount > BigInt(balance)) throw new PaymentConflictError("Capture exceeds current positive folio balance");
    }
    if (phase === "refund") {
      if (state.captured === 0n || amount > state.captured - state.refunded) throw new PaymentConflictError("Refund exceeds captured remainder");
    }
    if (phase === "void") {
      if (state.captured > 0n) throw new PaymentConflictError("Captured payment cannot be voided");
      amount = state.authorized;
    }
    if (amount <= 0n || amount > INT64_MAX) throw new PaymentConflictError("Payment amount is outside the operation limit");
    if (phase === "incremental_auth" && state.authorized + amount > INT64_MAX) throw new PaymentConflictError("Authorization exceeds int64 range");

    const attemptNo = (state.last?.attempt_no ?? 0) + 1;
    const pending = (await tx<Array<{ id: string }>>`
      INSERT INTO payment(tenant_id,instrument_id,psp,method,phase,amount_minor,currency,status,
        operation_id,predecessor_payment_id,attempt_no,result_code,command_key_hash,request_hash)
      VALUES(${tenantId}::uuid,${operation.instrument_id}::uuid,${operation.provider},${operation.method},${phase},
        ${amount},${operation.currency}::char(3),'pending',${operation.id}::uuid,${state.last?.id ?? null}::uuid,${attemptNo},'prepared',
        ${commandKeyHash},${requestHash}) RETURNING id`)[0]!;
    const commandId = `${phase}-${pending.id}`;
    return { tenantId, operation, phase, amountMinor: amount.toString(), pendingId: pending.id,
      pendingAttemptNo: attemptNo, commandKeyHash, requestHash, envelope: audit,
      providerRequest: Object.freeze({ commandId, phase, provider: operation.provider, method: operation.method,
        token: operation.token, amountMinor: amount.toString(), currency: operation.currency,
        ...(state.last?.psp_ref ? { priorProviderReference: state.last.psp_ref } : {}) }) };
  }

  async #apply(tx: Tx, prepared: Prepared, outcome: PaymentProviderOutcome,
    receipt: ReceiptInput | null): Promise<PaymentCommandResult> {
    await tx`SELECT public.lock_payment_operation(${prepared.tenantId}::uuid,${prepared.operation.id}::uuid)`;
    const rows = await tx<AttemptRow[]>`SELECT id,phase,amount_minor::text,status,result_code,psp_ref,journal_id,
      attempt_no,predecessor_payment_id,request_hash FROM payment WHERE tenant_id=${prepared.tenantId}::uuid
      AND operation_id=${prepared.operation.id}::uuid ORDER BY attempt_no,id`;
    const existing = rows.find((row) => row.predecessor_payment_id === prepared.pendingId);
    if (existing) return resultFrom(existing, prepared.operation, true);
    const pending = rows.find((row) => row.id === prepared.pendingId);
    const validPrepared = receipt === null
      ? pending?.result_code === "prepared" && pending.request_hash === prepared.requestHash
      : pending?.result_code === "indeterminate" && pending.status === "pending"
        && pending.phase === prepared.phase && pending.amount_minor === prepared.amountMinor;
    if (!pending || !validPrepared) {
      throw new PaymentConflictError("Prepared payment attempt is unavailable");
    }
    let receiptId: string | null = null;
    if (receipt) {
      const existingReceipt = (await tx<Array<{ id: string; content_hash: string }>>`
        SELECT id,content_hash FROM provider_event_receipt
         WHERE tenant_id=${prepared.tenantId}::uuid AND provider=${prepared.operation.provider}
           AND event_id=${receipt.eventId}`)[0];
      if (existingReceipt && existingReceipt.content_hash !== receipt.contentHash) {
        throw new PaymentConflictError("Provider event id has conflicting content");
      }
      if (existingReceipt) {
        const prior = (await tx<AttemptRow[]>`SELECT id,phase,amount_minor::text,status,result_code,psp_ref,journal_id,
          attempt_no,predecessor_payment_id,request_hash FROM payment
          WHERE tenant_id=${prepared.tenantId}::uuid AND receipt_id=${existingReceipt.id}::uuid`)[0];
        if (!prior) throw new PaymentConflictError("Provider receipt exists without an applied result");
        return resultFrom(prior, prepared.operation, true);
      }
      receiptId = (await tx<Array<{ id: string }>>`INSERT INTO provider_event_receipt(tenant_id,operation_id,provider,event_id,
        content_hash,provider_reference,phase,outcome,amount_minor,currency) VALUES(${prepared.tenantId}::uuid,
        ${prepared.operation.id}::uuid,${prepared.operation.provider},${receipt.eventId},${receipt.contentHash},
        ${receipt.providerReference},${prepared.phase},${receipt.outcome},${prepared.amountMinor}::bigint,
        ${prepared.operation.currency}::char(3)) RETURNING id`)[0]!.id;
    }
    const current = chain(rows.filter((row) => row.id !== prepared.pendingId));
    if (current.indeterminate || current.voided || (prepared.phase !== "auth" && current.authorized === 0n)) {
      throw new PaymentConflictError("Payment state changed before provider result application");
    }
    const status: AttemptStatus = outcome.outcome === "approved" ? "succeeded" : outcome.outcome === "declined" ? "failed" : "pending";
    const resultCode = outcome.outcome === "indeterminate" ? "indeterminate" : outcome.resultCode;
    let journalId: string | null = null;
    let businessDate: string;
    const dateRow = (await tx<Array<{ business_date: string; sealed_at: Date | null }>>`
      SELECT day.business_date::text,day.sealed_at FROM org_node property
      JOIN business_day day ON day.tenant_id=property.tenant_id AND day.property_node=property.id
       AND day.business_date=(transaction_timestamp() AT TIME ZONE property.timezone)::date
      WHERE property.tenant_id=${prepared.tenantId}::uuid AND property.id=${prepared.operation.property_node}::uuid`)[0];
    if (!dateRow || dateRow.sealed_at !== null) throw new PaymentConflictError("Current property business day is missing or sealed");
    businessDate = dateRow.business_date;
    if (status === "succeeded" && (prepared.phase === "capture" || prepared.phase === "refund")) {
      await tx`SELECT public.lock_financial_rows(${prepared.tenantId}::uuid,
        ARRAY[${prepared.operation.guest_account_id}::uuid,${prepared.operation.clearing_account_id}::uuid]::uuid[],
        ${prepared.operation.folio_id}::uuid)`;
      const latest = chain(await tx<AttemptRow[]>`SELECT id,phase,amount_minor::text,status,result_code,psp_ref,journal_id,
        attempt_no,predecessor_payment_id,request_hash FROM payment WHERE tenant_id=${prepared.tenantId}::uuid
        AND operation_id=${prepared.operation.id}::uuid AND id<>${prepared.pendingId}::uuid ORDER BY attempt_no,id`);
      const amount = BigInt(prepared.amountMinor);
      if (prepared.phase === "capture") {
        const balance = BigInt((await tx<Array<{ amount: string }>>`SELECT COALESCE(sum(amount_minor),0)::text amount
          FROM posting_line WHERE tenant_id=${prepared.tenantId}::uuid AND folio_id=${prepared.operation.folio_id}::uuid`)[0]!.amount);
        if (latest.captured > 0n || amount > latest.authorized || balance <= 0n || amount > balance) {
          throw new PaymentConflictError("Capture no longer satisfies locked payment and folio limits");
        }
      } else if (latest.captured === 0n || amount > latest.captured - latest.refunded) {
        throw new PaymentConflictError("Refund no longer satisfies captured remainder");
      }
      const header = (await tx<Array<{ id: string }>>`INSERT INTO journal(tenant_id,property_node,business_date,kind,
        description,currency,source,created_by) VALUES(${prepared.tenantId}::uuid,
        ${prepared.operation.property_node}::uuid,${businessDate}::date,${prepared.phase === "capture" ? "payment" : "refund"},
        ${prepared.phase === "capture" ? "Token payment capture" : "Token payment refund"},${prepared.operation.currency}::char(3),
        ${JSON.stringify({ interface: `financials.payment.${prepared.phase}` })}::text::jsonb,${prepared.envelope.actorId}::uuid)
        RETURNING id`)[0]!;
      journalId = header.id;
      const guestAmount = prepared.phase === "capture" ? -amount : amount;
      const clearingAmount = -guestAmount;
      await tx`INSERT INTO posting_line(tenant_id,journal_id,seq,account_id,folio_id,tx_code,description,amount_minor,
        quantity,business_date,currency) VALUES
        (${prepared.tenantId}::uuid,${journalId}::uuid,1,${prepared.operation.guest_account_id}::uuid,
          ${prepared.operation.folio_id}::uuid,${prepared.operation.tx_code},${prepared.phase},${guestAmount},1,
          ${businessDate}::date,${prepared.operation.currency}::char(3)),
        (${prepared.tenantId}::uuid,${journalId}::uuid,2,${prepared.operation.clearing_account_id}::uuid,
          NULL,${prepared.operation.tx_code},${prepared.phase},${clearingAmount},1,${businessDate}::date,
          ${prepared.operation.currency}::char(3))`;
    }

    const attemptNo = Math.max(...rows.map((row) => row.attempt_no), prepared.pendingAttemptNo) + 1;
    const resultHash = sha256(`${prepared.commandKeyHash}:${resultCode}:${outcome.providerReference}`);
    const inserted = (await tx<AttemptRow[]>`INSERT INTO payment(tenant_id,journal_id,instrument_id,psp,psp_ref,method,
      phase,amount_minor,currency,status,operation_id,predecessor_payment_id,receipt_id,attempt_no,result_code,
      command_key_hash,request_hash,capture_payment_id,capture_journal_id) VALUES(${prepared.tenantId}::uuid,${journalId}::uuid,
      ${prepared.operation.instrument_id}::uuid,${prepared.operation.provider},${outcome.providerReference},
      ${prepared.operation.method},${prepared.phase},${prepared.amountMinor}::bigint,${prepared.operation.currency}::char(3),
      ${status},${prepared.operation.id}::uuid,${prepared.pendingId}::uuid,${receiptId}::uuid,${attemptNo},${resultCode},
      ${resultHash},${prepared.requestHash},${prepared.phase === "refund" && status === "succeeded" ? current.capture?.id ?? null : null}::uuid,
      ${prepared.phase === "refund" && status === "succeeded" ? current.capture?.journal_id ?? null : null}::uuid)
      RETURNING id,phase,amount_minor::text,status,result_code,psp_ref,journal_id,
      attempt_no,predecessor_payment_id,request_hash`)[0]!;
    const payload = Object.freeze({ operation_id: prepared.operation.id, payment_id: inserted.id,
      phase: prepared.phase, outcome: outcome.outcome, amount_minor: prepared.amountMinor,
      currency: prepared.operation.currency, ...(journalId ? { journal_id: journalId } : {}) });
    const paymentEventType = lifecycleEvent(prepared.phase, outcome.outcome, receipt !== null);
    await recordFact(tx, { entityType: "payment", entityId: inserted.id,
      envelope: { ...prepared.envelope, operation: paymentEventType }, payload });
    await this.#events.publish(tx, { tenantId: prepared.tenantId, propertyNode: prepared.operation.property_node,
      businessDate, aggregateType: "payment_operation", aggregateId: prepared.operation.id,
      eventType: paymentEventType, actorId: prepared.envelope.actorId,
      correlationId: prepared.envelope.requestId, payload });
    if (journalId) {
      const journalPayload = Object.freeze({ journal_id: journalId, kind: prepared.phase === "capture" ? "payment" : "refund",
        payment_id: inserted.id, operation_id: prepared.operation.id,
        lines: Object.freeze([
          Object.freeze({ account: prepared.operation.guest_account_id, folio: prepared.operation.folio_id,
            tx_code: prepared.operation.tx_code, amount_minor: (prepared.phase === "capture" ?
              -BigInt(prepared.amountMinor) : BigInt(prepared.amountMinor)).toString() }),
          Object.freeze({ account: prepared.operation.clearing_account_id,
            tx_code: prepared.operation.tx_code, amount_minor: (prepared.phase === "capture" ?
              BigInt(prepared.amountMinor) : -BigInt(prepared.amountMinor)).toString() }),
        ]) });
      await recordFact(tx, { entityType: "journal", entityId: journalId,
        envelope: { ...prepared.envelope, operation: "journal.posted" }, payload: journalPayload });
      await this.#events.publish(tx, { tenantId: prepared.tenantId, propertyNode: prepared.operation.property_node,
        businessDate, aggregateType: "journal", aggregateId: journalId, eventType: "journal.posted",
        actorId: prepared.envelope.actorId, correlationId: prepared.envelope.requestId, payload: journalPayload });
    }
    return resultFrom(inserted, prepared.operation, false);
  }

  async reconcile(input: ReconcilePaymentInput): Promise<PaymentCommandResult> {
    requireRecord(input, "reconciliation input");
    exactKeys(input, ["tenantId","operationId","eventId","contentHash","providerReference","phase",
      "outcome","amountMinor","currency","envelope"], "reconciliation input");
    const tenantId = uuid(input.tenantId, "tenantId"); const operationId = uuid(input.operationId, "operationId");
    if (!SAFE_ID.test(input.eventId) || !SAFE_ID.test(input.providerReference) || !HASH.test(input.contentHash) ||
        !/^[A-Z]{3}$/.test(input.currency)) throw new PaymentValidationError("reconciliation receipt is invalid");
    const amount = money(input.amountMinor);
    const audit = envelope(input.envelope, tenantId, "payment.reconciled");
    const prepared = await this.#database.withTenantTransaction(tenantId, async (tx): Promise<Prepared | ExistingResult> => {
      await tx`SELECT public.lock_payment_operation(${tenantId}::uuid,${operationId}::uuid)`;
      const op = (await tx<OperationRow[]>`SELECT op.id,op.property_node,op.folio_id,op.guest_account_id,op.instrument_id,
        op.provider,op.method,op.currency::text,op.tx_code,op.clearing_account_id,op.actor_id,instrument.token
        FROM payment_operation op JOIN payment_instrument instrument ON instrument.tenant_id=op.tenant_id AND instrument.id=op.instrument_id
        WHERE op.tenant_id=${tenantId}::uuid AND op.id=${operationId}::uuid AND op.property_node=${audit.propertyNode}::uuid`)[0];
      if (!op || op.currency !== input.currency) throw new PaymentNotFoundError("Payment operation was not found for receipt");
      const existingReceipt = (await tx<Array<{ id: string; content_hash: string }>>`SELECT id,content_hash FROM provider_event_receipt
        WHERE tenant_id=${tenantId}::uuid AND provider=${op.provider} AND event_id=${input.eventId}`)[0];
      if (existingReceipt && existingReceipt.content_hash !== input.contentHash) throw new PaymentConflictError("Provider event id has conflicting content");
      if (existingReceipt) {
        const prior = (await tx<AttemptRow[]>`SELECT id,phase,amount_minor::text,status,result_code,psp_ref,journal_id,
          attempt_no,predecessor_payment_id,request_hash FROM payment WHERE tenant_id=${tenantId}::uuid AND receipt_id=${existingReceipt.id}::uuid`)[0];
        if (!prior) throw new PaymentConflictError("Provider receipt exists without an applied result");
        return { result: resultFrom(prior, op, true) };
      }
      const rows = await tx<AttemptRow[]>`SELECT id,phase,amount_minor::text,status,result_code,psp_ref,journal_id,
        attempt_no,predecessor_payment_id,request_hash FROM payment WHERE tenant_id=${tenantId}::uuid
        AND operation_id=${operationId}::uuid ORDER BY attempt_no,id`;
      const pending = [...rows].reverse().find((row) => row.phase === input.phase && row.status === "pending" && row.result_code === "indeterminate");
      if (!pending || pending.amount_minor !== amount.text) throw new PaymentConflictError("No matching indeterminate payment attempt exists");
      const commandKeyHash = sha256(`receipt:${op.provider}:${input.eventId}`); const requestHash = input.contentHash;
      return { tenantId, operation: op, phase: input.phase, amountMinor: amount.text, pendingId: pending.id,
        pendingAttemptNo: pending.attempt_no, commandKeyHash, requestHash, envelope: audit,
        providerRequest: { commandId: input.eventId, phase: input.phase, provider: op.provider,
          method: op.method, token: op.token, amountMinor: amount.text, currency: input.currency,
          priorProviderReference: input.providerReference } };
    });
    if ("result" in prepared) return prepared.result;
    return this.#database.withTenantTransaction(tenantId, (tx) => this.#apply(tx, prepared,
      { outcome: input.outcome, providerReference: input.providerReference,
        resultCode: input.outcome === "approved" ? "approved" : "declined" },
      { eventId: input.eventId, contentHash: input.contentHash,
        providerReference: input.providerReference, outcome: input.outcome }));
  }
}
