import { recordFact, type AuditEnvelope, type Database, type EventBus, type Tx } from "../../kernel";
import { PaymentConflictError, PaymentNotFoundError, PaymentService, PaymentValidationError,
  type PaymentCommandResult } from "./payments";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const POSITIVE = /^[1-9][0-9]*$/;
const KEY = /^[\x21-\x7e]{8,200}$/;
const HASH = /^[0-9a-f]{64}$/;
const INT64_MAX = 9_223_372_036_854_775_807n;

export interface CreateHostedDepositInput {
  readonly tenantId: string;
  readonly folioId: string;
  readonly instrumentId: string;
  readonly amountMinor: string;
  readonly idempotencyKey: string;
  readonly envelope: AuditEnvelope;
}

export interface ApplyDepositInput {
  readonly tenantId: string;
  readonly hostedRequestId: string;
  readonly amountMinor: string;
  readonly idempotencyKey: string;
  readonly envelope: AuditEnvelope;
}

export interface HostedDepositLink {
  readonly requestId: string;
  readonly operationId: string;
  readonly bearer?: string;
  readonly expiresAt: string;
  readonly amountMinor: string;
  readonly currency: string;
  readonly generation: number;
  readonly replayed: boolean;
}

export interface HostedDepositStatus {
  readonly requestId: string;
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly propertyName: string;
  readonly folioId: string;
  readonly folioReference: string;
  readonly operationId: string;
  readonly amountMinor: string;
  readonly currency: string;
  readonly generation: number;
  readonly expiresAt: string;
  readonly state: "ready" | "processing" | "captured" | "declined" | "expired" | "revoked";
  readonly capturedMinor: string;
  readonly appliedMinor: string;
  readonly remainingMinor: string;
}

export interface DepositApplicationResult {
  readonly applicationId: string;
  readonly journalId: string;
  readonly hostedRequestId: string;
  readonly amountMinor: string;
  readonly currency: string;
  readonly replayed: boolean;
}

export class HostedDepositValidationError extends Error {
  constructor(message: string) { super(message); this.name = "HostedDepositValidationError"; }
}
export class HostedDepositNotFoundError extends Error {
  constructor(message: string) { super(message); this.name = "HostedDepositNotFoundError"; }
}
export class HostedDepositConflictError extends Error {
  constructor(message: string) { super(message); this.name = "HostedDepositConflictError"; }
}

function paymentBoundary(error:unknown):never {
  if (error instanceof PaymentValidationError) throw new HostedDepositValidationError(error.message);
  if (error instanceof PaymentNotFoundError) throw new HostedDepositNotFoundError(error.message);
  if (error instanceof PaymentConflictError) throw new HostedDepositConflictError(error.message);
  throw error;
}

interface RequestRow {
  readonly id: string; readonly tenant_id: string; readonly property_node: string;
  readonly property_name: string; readonly folio_id: string; readonly folio_reference: string;
  readonly operation_id: string; readonly amount_minor: string; readonly currency: string;
  readonly generation: number; readonly expires_at: Date; readonly revoked_at: Date | null;
  readonly purpose: string; readonly deposit_account_id: string; readonly guest_account_id: string;
}

function sha256(value: string): string {
  return new Bun.CryptoHasher("sha256").update(value).digest("hex");
}

function randomBearer(tenantId: string): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `${tenantId}.${Buffer.from(bytes).toString("base64url")}`;
}

function tenantFromBearer(value: unknown): string {
  if (typeof value !== "string" || value.length > 128) throw new HostedDepositNotFoundError("Hosted request was not found");
  const separator = value.indexOf(".");
  const tenantId = value.slice(0, separator);
  const random = value.slice(separator + 1);
  if (!UUID.test(tenantId) || !/^[A-Za-z0-9_-]{43}$/.test(random)) {
    throw new HostedDepositNotFoundError("Hosted request was not found");
  }
  return tenantId;
}

function uuid(value: unknown, name: string): string {
  if (typeof value !== "string" || !UUID.test(value)) throw new HostedDepositValidationError(`${name} must be a UUID`);
  return value;
}

function money(value: unknown): bigint {
  if (typeof value !== "string" || !POSITIVE.test(value)) {
    throw new HostedDepositValidationError("amountMinor must be a canonical positive int64 string");
  }
  const amount = BigInt(value);
  if (amount > INT64_MAX) throw new HostedDepositValidationError("amountMinor exceeds int64");
  return amount;
}

function idem(value: unknown): string {
  if (typeof value !== "string" || !KEY.test(value)) throw new HostedDepositValidationError("idempotencyKey is invalid");
  return value;
}

function audit(value: AuditEnvelope, tenantId: string, operation: string): AuditEnvelope {
  if (!value || value.tenantId !== tenantId || value.operation !== operation ||
      !UUID.test(value.actorId) || !UUID.test(value.propertyNode) || !UUID.test(value.requestId)) {
    throw new HostedDepositValidationError("audit envelope is invalid");
  }
  return value;
}

async function loadRequest(tx: Tx, tenantId: string, requestId: string): Promise<RequestRow> {
  const row = (await tx<RequestRow[]>`
    SELECT request.id,request.tenant_id,request.property_node,property.name property_name,
           request.folio_id,folio.folio_no folio_reference,request.operation_id,
           request.amount_minor::text,request.currency::text,request.generation,
           request.expires_at,request.revoked_at,operation.purpose,
           operation.deposit_account_id,operation.guest_account_id
      FROM hosted_payment_request request
      JOIN payment_operation operation ON operation.tenant_id=request.tenant_id AND operation.id=request.operation_id
      JOIN org_node property ON property.tenant_id=request.tenant_id AND property.id=request.property_node
      JOIN folio ON folio.tenant_id=request.tenant_id AND folio.id=request.folio_id
     WHERE request.tenant_id=${tenantId}::uuid AND request.id=${requestId}::uuid`)[0];
  if (!row || row.purpose !== "deposit") throw new HostedDepositNotFoundError("Hosted request was not found");
  return row;
}

async function materializeStatus(tx: Tx, row: RequestRow): Promise<HostedDepositStatus> {
  const totals = (await tx<Array<{ capture: string; failed: number; pending: number; applied: string }>>`
    SELECT COALESCE(sum(payment.amount_minor) FILTER (WHERE payment.phase='capture' AND payment.status='succeeded'),0)::text capture,
           count(*) FILTER (WHERE payment.phase='capture' AND payment.status='failed')::int failed,
           count(*) FILTER (WHERE payment.phase='capture' AND payment.status='pending')::int pending,
           COALESCE((SELECT sum(amount_minor) FROM deposit_application application
             WHERE application.tenant_id=${row.tenant_id}::uuid AND application.hosted_request_id=${row.id}::uuid),0)::text applied
      FROM payment WHERE tenant_id=${row.tenant_id}::uuid AND operation_id=${row.operation_id}::uuid`)[0]!;
  const captured = BigInt(totals.capture); const applied = BigInt(totals.applied);
  const now = Date.now();
  const state = captured > 0n ? "captured" : totals.failed > 0 ? "declined" : row.revoked_at ? "revoked" :
    row.expires_at.getTime() <= now ? "expired" : totals.pending > 0 ? "processing" : "ready";
  return Object.freeze({ requestId: row.id, tenantId: row.tenant_id, propertyNode: row.property_node,
    propertyName: row.property_name, folioId: row.folio_id, folioReference: row.folio_reference,
    operationId: row.operation_id, amountMinor: row.amount_minor, currency: row.currency,
    generation: row.generation, expiresAt: row.expires_at.toISOString(), state,
    capturedMinor: captured.toString(), appliedMinor: applied.toString(), remainingMinor: (captured - applied).toString() });
}

export class HostedDepositService {
  readonly #database: Database;
  readonly #payments: PaymentService;
  readonly #events: EventBus;

  constructor(options: { database: Database; payments: PaymentService; events: EventBus }) {
    this.#database = options.database; this.#payments = options.payments; this.#events = options.events;
  }

  async create(input: CreateHostedDepositInput): Promise<HostedDepositLink> {
    const tenantId = uuid(input.tenantId, "tenantId");
    const amount = money(input.amountMinor); const key = idem(input.idempotencyKey); const keyHash = sha256(key);
    const envelope = audit(input.envelope, tenantId, "deposit.requested");
    uuid(input.folioId, "folioId"); uuid(input.instrumentId, "instrumentId");
    const requestHash = sha256(JSON.stringify({ folioId: input.folioId, instrumentId: input.instrumentId,
      amountMinor: amount.toString(), actorId: envelope.actorId, propertyNode: envelope.propertyNode }));
    let authorization:PaymentCommandResult;
    try { authorization = await this.#payments.authorizeDeposit({ ...input,
      idempotencyKey: `hosted-auth:${sha256(key)}`, envelope: { ...envelope, operation: "payment.authorized" } }); }
    catch(error) { paymentBoundary(error); }
    if (authorization.outcome !== "approved") throw new HostedDepositConflictError("Deposit authorization was not approved");
    const bearer = randomBearer(tenantId); const bearerHash = sha256(bearer);
    const result = await this.#database.withTenantTransaction(tenantId, async (tx) => {
      await tx`SELECT pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(${`${tenantId}:${keyHash}`},0))`;
      const replay = (await tx<Array<{ id: string; operation_id: string; expires_at: Date; amount_minor: string;
        currency: string; generation: number; request_hash: string }>>`SELECT id,operation_id,expires_at,
        amount_minor::text,currency::text,generation,request_hash FROM hosted_payment_request
        WHERE tenant_id=${tenantId}::uuid AND key_hash=${keyHash}`)[0];
      if (replay) {
        if (replay.request_hash !== requestHash) throw new HostedDepositConflictError("Idempotency key was reused with changed input");
        return { requestId: replay.id, operationId: replay.operation_id, expiresAt: replay.expires_at.toISOString(),
          amountMinor: replay.amount_minor, currency: replay.currency, generation: replay.generation, replayed: true };
      }
      const context = (await tx<Array<{ operation_id: string; property_node: string; folio_id: string; deposit_account_id: string; amount_minor: string; currency: string }>>`
        SELECT operation.id operation_id,operation.property_node,operation.folio_id,
               operation.deposit_account_id,payment.amount_minor::text,operation.currency::text
          FROM payment_operation operation
          JOIN payment ON payment.tenant_id=operation.tenant_id AND payment.operation_id=operation.id
           AND payment.phase='auth' AND payment.status='succeeded'
         WHERE operation.tenant_id=${tenantId}::uuid AND operation.id=${authorization.operationId}::uuid
           AND operation.purpose='deposit' AND operation.folio_id=${input.folioId}::uuid
           AND operation.property_node=${envelope.propertyNode}::uuid
         ORDER BY payment.attempt_no DESC LIMIT 1`)[0];
      if (!context || context.amount_minor !== amount.toString()) throw new HostedDepositConflictError("Authorized deposit context changed");
      const generation = (await tx<Array<{ generation: number }>>`
        SELECT public.lock_and_revoke_hosted_payment_requests(${tenantId}::uuid,${input.folioId}::uuid,
          pg_catalog.transaction_timestamp()) generation`)[0]!.generation;
      const row = (await tx<Array<{ id: string; expires_at: Date }>>`
        INSERT INTO hosted_payment_request(tenant_id,property_node,folio_id,guest_account_id,operation_id,deposit_account_id,amount_minor,currency,
          bearer_hash,key_hash,request_hash,generation,created_by,expires_at)
        VALUES(${tenantId}::uuid,${context.property_node}::uuid,${context.folio_id}::uuid,
          (SELECT guest_account_id FROM payment_operation WHERE tenant_id=${tenantId}::uuid AND id=${context.operation_id}::uuid),
          ${context.operation_id}::uuid,${context.deposit_account_id}::uuid,${amount}::bigint,${context.currency}::char(3),${bearerHash},${keyHash},${requestHash},${generation},
          ${envelope.actorId}::uuid,pg_catalog.transaction_timestamp()+interval '24 hours')
        RETURNING id,expires_at`)[0]!;
      const businessDate = (await tx<Array<{ business_date: string }>>`SELECT
        (transaction_timestamp() AT TIME ZONE timezone)::date::text business_date FROM org_node
        WHERE tenant_id=${tenantId}::uuid AND id=${context.property_node}::uuid`)[0]!.business_date;
      const payload = Object.freeze({ request_id: row.id, operation_id: context.operation_id,
        folio_id: context.folio_id, amount_minor: amount.toString(), currency: context.currency,
        expires_at: row.expires_at.toISOString(), generation });
      await recordFact(tx, { entityType: "hosted_payment_request", entityId: row.id, envelope, payload });
      await this.#events.publish(tx, { tenantId, propertyNode: context.property_node, businessDate,
        aggregateType: "hosted_payment_request", aggregateId: row.id, eventType: "deposit.requested",
        actorId: envelope.actorId, correlationId: envelope.requestId, payload });
      return { requestId: row.id, operationId: context.operation_id, expiresAt: row.expires_at.toISOString(),
        amountMinor: amount.toString(), currency: context.currency, generation, replayed: false };
    });
    return Object.freeze(result.replayed ? result : { ...result, bearer });
  }

  async status(bearer: string): Promise<HostedDepositStatus> {
    const tenantId = tenantFromBearer(bearer); const hash = sha256(bearer);
    return this.#database.withTenantTransaction(tenantId, async (tx) => {
      const lookup = (await tx<Array<{ id: string }>>`SELECT id FROM hosted_payment_request
        WHERE tenant_id=${tenantId}::uuid AND bearer_hash=${hash}`)[0];
      if (!lookup) throw new HostedDepositNotFoundError("Hosted request was not found");
      const row = await loadRequest(tx, tenantId, lookup.id);
      return materializeStatus(tx, row);
    });
  }

  async statusForOperator(tenantIdValue: string, requestIdValue: string): Promise<HostedDepositStatus> {
    const tenantId = uuid(tenantIdValue, "tenantId"); const requestId = uuid(requestIdValue, "requestId");
    return this.#database.withTenantTransaction(tenantId, async (tx) =>
      materializeStatus(tx, await loadRequest(tx, tenantId, requestId)));
  }

  async statusByCorrelation(correlation: string): Promise<HostedDepositStatus> {
    const match = /^([0-9a-f-]{36})\.([0-9a-f-]{36})$/.exec(correlation);
    if (!match || !UUID.test(match[1]!) || !UUID.test(match[2]!)) throw new HostedDepositNotFoundError("Hosted request was not found");
    return this.#database.withTenantTransaction(match[1]!, async tx => materializeStatus(tx,
      await loadRequest(tx, match[1]!, match[2]!)));
  }

  async beginCapture(bearer: string): Promise<PaymentCommandResult> {
    const status = await this.status(bearer);
    return this.#beginCaptureForStatus(status);
  }

  async beginCaptureByCorrelation(correlation: string): Promise<PaymentCommandResult> {
    return this.#beginCaptureForStatus(await this.statusByCorrelation(correlation));
  }

  async #beginCaptureForStatus(status: HostedDepositStatus): Promise<PaymentCommandResult> {
    if (status.state !== "ready" && status.state !== "processing") throw new HostedDepositConflictError("Hosted request is not payable");
    try { return await this.#payments.capture({ tenantId: status.tenantId, operationId: status.operationId,
      amountMinor: status.amountMinor, idempotencyKey: `hosted-capture:${status.requestId}:${status.generation}`,
      envelope: { actorId: await this.operationActor(status.tenantId, status.operationId), tenantId: status.tenantId,
        propertyNode: status.propertyNode, requestId: crypto.randomUUID(), operation: "payment.captured" } }); }
    catch(error) { paymentBoundary(error); }
  }

  async operationActor(tenantId: string, operationId: string): Promise<string> {
    return this.#database.withTenantTransaction(tenantId, async (tx) => {
      const row = (await tx<Array<{ actor_id: string }>>`SELECT actor_id FROM payment_operation
        WHERE tenant_id=${tenantId}::uuid AND id=${operationId}::uuid`)[0];
      if (!row) throw new HostedDepositNotFoundError("Hosted request was not found");
      return row.actor_id;
    });
  }

  async apply(input: ApplyDepositInput): Promise<DepositApplicationResult> {
    const tenantId = uuid(input.tenantId, "tenantId"); const requestId = uuid(input.hostedRequestId, "hostedRequestId");
    const amount = money(input.amountMinor); const keyHash = sha256(idem(input.idempotencyKey));
    const envelope = audit(input.envelope, tenantId, "deposit.applied");
    const requestHash = sha256(JSON.stringify({ requestId, amount: amount.toString(), actorId: envelope.actorId,
      propertyNode: envelope.propertyNode }));
    try {
      return await this.#database.withTenantTransaction(tenantId, async (tx) => {
        await tx`SELECT pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(${`${tenantId}:${keyHash}`},0))`;
        const replay = (await tx<Array<{ id: string; journal_id: string; hosted_request_id: string; amount_minor: string; currency: string; request_hash: string }>>`
          SELECT id,journal_id,hosted_request_id,amount_minor::text,currency::text,request_hash FROM deposit_application
          WHERE tenant_id=${tenantId}::uuid AND key_hash=${keyHash}`)[0];
        if (replay) {
          if (replay.request_hash !== requestHash) throw new HostedDepositConflictError("Idempotency key was reused with changed input");
          return Object.freeze({ applicationId: replay.id, journalId: replay.journal_id,
            hostedRequestId: replay.hosted_request_id, amountMinor: replay.amount_minor,
            currency: replay.currency, replayed: true });
        }
        const request = await loadRequest(tx, tenantId, requestId);
        if (request.property_node !== envelope.propertyNode) throw new HostedDepositNotFoundError("Hosted request was not found in the audit property");
        await tx`SELECT public.lock_payment_operation(${tenantId}::uuid,${request.operation_id}::uuid)`;
        const capture = (await tx<Array<{ id: string; amount_minor: string }>>`SELECT id,amount_minor::text FROM payment
          WHERE tenant_id=${tenantId}::uuid AND operation_id=${request.operation_id}::uuid
            AND phase='capture' AND status='succeeded' ORDER BY attempt_no DESC LIMIT 1`)[0];
        if (!capture) throw new HostedDepositConflictError("Deposit capture is not available");
        await tx`SELECT public.lock_financial_rows(${tenantId}::uuid,
          ARRAY[${request.deposit_account_id}::uuid,${request.guest_account_id}::uuid]::uuid[],${request.folio_id}::uuid)`;
        const locked = (await tx<Array<{ balance: string; applied: string; business_date: string; sealed_at: Date | null }>>`
          SELECT COALESCE((SELECT sum(amount_minor) FROM posting_line WHERE tenant_id=${tenantId}::uuid
                   AND folio_id=${request.folio_id}::uuid),0)::text balance,
                 COALESCE((SELECT sum(amount_minor) FROM deposit_application WHERE tenant_id=${tenantId}::uuid
                   AND capture_payment_id=${capture.id}::uuid),0)::text applied,
                 day.business_date::text,day.sealed_at
            FROM org_node property JOIN business_day day ON day.tenant_id=property.tenant_id
             AND day.property_node=property.id
             AND day.business_date=(transaction_timestamp() AT TIME ZONE property.timezone)::date
           WHERE property.tenant_id=${tenantId}::uuid AND property.id=${request.property_node}::uuid`)[0];
        if (!locked || locked.sealed_at) throw new HostedDepositConflictError("Current business day is unavailable");
        const balance = BigInt(locked.balance); const remaining = BigInt(capture.amount_minor) - BigInt(locked.applied);
        if (balance <= 0n || amount > balance || amount > remaining) throw new HostedDepositConflictError("Application exceeds locked deposit or folio remainder");
        const journal = (await tx<Array<{ id: string }>>`INSERT INTO journal(tenant_id,property_node,business_date,kind,
          description,currency,source,created_by) VALUES(${tenantId}::uuid,${request.property_node}::uuid,
          ${locked.business_date}::date,'payment','Deposit application',${request.currency}::char(3),
          ${JSON.stringify({ interface: "financials.deposit.apply", hosted_request_id: request.id })}::text::jsonb,
          ${envelope.actorId}::uuid) RETURNING id`)[0]!;
        await tx`INSERT INTO posting_line(tenant_id,journal_id,seq,account_id,folio_id,tx_code,description,
          amount_minor,quantity,business_date,currency) VALUES
          (${tenantId}::uuid,${journal.id}::uuid,1,${request.deposit_account_id}::uuid,NULL,'DEP','deposit application',
            ${amount},1,${locked.business_date}::date,${request.currency}::char(3)),
          (${tenantId}::uuid,${journal.id}::uuid,2,${request.guest_account_id}::uuid,${request.folio_id}::uuid,'DEP',
            'deposit application',${-amount},1,${locked.business_date}::date,${request.currency}::char(3))`;
        const application = (await tx<Array<{ id: string }>>`INSERT INTO deposit_application(tenant_id,property_node,
          hosted_request_id,operation_id,capture_payment_id,folio_id,deposit_account_id,guest_account_id,
          amount_minor,currency,journal_id,key_hash,request_hash,created_by) VALUES(${tenantId}::uuid,
          ${request.property_node}::uuid,${request.id}::uuid,${request.operation_id}::uuid,${capture.id}::uuid,
          ${request.folio_id}::uuid,${request.deposit_account_id}::uuid,${request.guest_account_id}::uuid,
          ${amount},${request.currency}::char(3),${journal.id}::uuid,${keyHash},${requestHash},${envelope.actorId}::uuid)
          RETURNING id`)[0]!;
        const payload = Object.freeze({ application_id: application.id, hosted_request_id: request.id,
          operation_id: request.operation_id, capture_payment_id: capture.id, journal_id: journal.id,
          folio_id: request.folio_id, amount_minor: amount.toString(), currency: request.currency });
        await recordFact(tx, { entityType: "deposit_application", entityId: application.id, envelope, payload });
        await this.#events.publish(tx, { tenantId, propertyNode: request.property_node,
          businessDate: locked.business_date, aggregateType: "deposit_application", aggregateId: application.id,
          eventType: "deposit.applied", actorId: envelope.actorId, correlationId: envelope.requestId, payload });
        const journalPayload = Object.freeze({ journal_id: journal.id, kind: "payment", application_id: application.id,
          lines: Object.freeze([{ account: request.deposit_account_id, tx_code: "DEP", amount_minor: amount.toString() },
            { account: request.guest_account_id, folio: request.folio_id, tx_code: "DEP", amount_minor: (-amount).toString() }]) });
        await recordFact(tx, { entityType: "journal", entityId: journal.id,
          envelope: { ...envelope, operation: "journal.posted" }, payload: journalPayload });
        await this.#events.publish(tx, { tenantId, propertyNode: request.property_node,
          businessDate: locked.business_date, aggregateType: "journal", aggregateId: journal.id,
          eventType: "journal.posted", actorId: envelope.actorId, correlationId: envelope.requestId, payload: journalPayload });
        return Object.freeze({ applicationId: application.id, journalId: journal.id,
          hostedRequestId: request.id, amountMinor: amount.toString(), currency: request.currency, replayed: false });
      });
    } catch (error) { paymentBoundary(error); }
  }
}

export function assertHostedCallbackHash(value: string): string {
  if (!HASH.test(value)) throw new HostedDepositValidationError("callback content hash is invalid");
  return value;
}
