import type { ConnectionPool, Tx } from "../../kernel";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const PROVIDER_KEY = /^[a-z0-9](?:[a-z0-9._:-]{0,126}[a-z0-9])?$/;
const REFERENCE_CONTROL = /[\u0000-\u001f\u007f]/u;
const IDEMPOTENCY_KEY = /^[!-~]{8,200}$/;
const MAX_WIRE_BYTES = 1024 * 1024;

type RecordValue = Record<string, unknown>;

export type FiscalSubmissionPersistedStatus = "pending" | "submitted" | "accepted" | "rejected" | "error";
export type FiscalSubmissionDisposition = "send" | "lookup" | "retry" | "none";

export interface FiscalSubmissionReceipt {
  readonly submissionId: string;
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly documentId: string;
  readonly documentSha256: string;
  readonly wireSha256: string;
  readonly providerKey: string;
  readonly providerExtensionId: string;
  readonly providerExtensionVersion: number;
  readonly attemptId: string;
  readonly attemptNumber: number;
  readonly retryCount: number;
  readonly status: FiscalSubmissionPersistedStatus;
  readonly disposition: FiscalSubmissionDisposition;
  readonly transitionSeq: number;
  readonly replayed: boolean;
}

export type FiscalSubmissionClaim = Readonly<
  | { readonly claimed: false; readonly reason: "busy" | "terminal" | "retry_required" }
  | {
      readonly claimed: true;
      readonly action: "submit" | "lookup";
      readonly claimToken: string;
      readonly submissionId: string;
      readonly tenantId: string;
      readonly propertyNode: string;
      readonly documentId: string;
      readonly documentSha256: string;
      readonly wireSha256: string;
      readonly wireJson: string;
      readonly providerKey: string;
      readonly providerExtensionId: string;
      readonly providerExtensionVersion: number;
      readonly attemptId: string;
      readonly attemptNumber: number;
    }
>;

export type FiscalSubmissionNormalizedResult = Readonly<
  | {
      readonly type: "transport_result";
      readonly tenantId: string;
      readonly providerKey: string;
      readonly attemptId: string;
      readonly documentId: string;
      readonly payloadSha256: string;
      readonly outcome: "pending" | "timeout" | "duplicate" | "known_not_sent";
    }
  | {
      readonly type: "lookup_result";
      readonly tenantId: string;
      readonly providerKey: string;
      readonly attemptId: string;
      readonly documentId: string;
      readonly payloadSha256: string;
      readonly outcome: "pending" | "known_not_sent";
    }
  | {
      readonly type: "transport_result" | "lookup_result";
      readonly tenantId: string;
      readonly providerKey: string;
      readonly attemptId: string;
      readonly documentId: string;
      readonly payloadSha256: string;
      readonly outcome: "accepted" | "rejected";
      readonly authorityRef: string;
      readonly responseSha256: string;
    }
>;

export type FiscalSubmissionRepositoryErrorCode =
  | "invalid_input"
  | "invalid_receipt"
  | "database_error"
  | "pool_failed";

export interface FiscalSubmissionRepositoryError {
  readonly code: FiscalSubmissionRepositoryErrorCode;
  readonly message: string;
}

export type FiscalSubmissionRepositoryResult<T> = Readonly<
  | { readonly ok: true; readonly value: Readonly<T> }
  | { readonly ok: false; readonly error: Readonly<FiscalSubmissionRepositoryError> }
>;

export interface RequestIndiaFiscalSubmissionInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly documentId: string;
  readonly providerExtensionId: string;
  readonly actorId: string;
  readonly idempotencyKey: string;
  readonly requestId: string;
}

export interface RetryIndiaFiscalSubmissionInput {
  readonly tenantId: string;
  readonly submissionId: string;
  readonly actorId: string;
  readonly idempotencyKey: string;
  readonly requestId: string;
}

export interface ClaimIndiaFiscalSubmissionInput {
  readonly tenantId: string;
  readonly submissionId: string;
  readonly leaseSeconds: number;
}

export interface ReconcileIndiaFiscalSubmissionInput {
  readonly tenantId: string;
  readonly submissionId: string;
  readonly attemptId: string;
  readonly claimToken: string;
  readonly result: FiscalSubmissionNormalizedResult;
}

const REQUEST_KEYS = ["tenantId", "propertyNode", "documentId", "providerExtensionId", "actorId", "idempotencyKey", "requestId"] as const;
const RETRY_KEYS = ["tenantId", "submissionId", "actorId", "idempotencyKey", "requestId"] as const;
const CLAIM_INPUT_KEYS = ["tenantId", "submissionId", "leaseSeconds"] as const;
const RECONCILE_KEYS = ["tenantId", "submissionId", "attemptId", "claimToken", "result"] as const;
const RECEIPT_KEYS = ["submissionId", "tenantId", "propertyNode", "documentId", "documentSha256", "wireSha256", "providerKey", "providerExtensionId", "providerExtensionVersion", "attemptId", "attemptNumber", "retryCount", "status", "disposition", "transitionSeq", "replayed"] as const;
const CLAIM_KEYS = ["claimed", "action", "claimToken", "submissionId", "tenantId", "propertyNode", "documentId", "documentSha256", "wireSha256", "wireJson", "providerKey", "providerExtensionId", "providerExtensionVersion", "attemptId", "attemptNumber"] as const;
const EVENT_BASE_KEYS = ["type", "tenantId", "providerKey", "attemptId", "documentId", "payloadSha256", "outcome"] as const;

class InvalidReceipt extends Error {}

function frozen<T extends object>(value: T): Readonly<T> {
  return Object.freeze(value);
}

function success<T extends object>(value: T): FiscalSubmissionRepositoryResult<T> {
  return frozen({ ok: true as const, value: frozen(value) });
}

function failure<T>(code: FiscalSubmissionRepositoryErrorCode, message: string): FiscalSubmissionRepositoryResult<T> {
  return frozen({ ok: false as const, error: frozen({ code, message }) });
}

function record(value: unknown): RecordValue | null {
  if (typeof value !== "object" || value === null) return null;
  try {
    if (Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.some((key) => typeof key === "symbol")) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    for (const key of keys) {
      const descriptor = descriptors[String(key)];
      if (!descriptor || descriptor.get !== undefined || descriptor.set !== undefined
          || !("value" in descriptor) || descriptor.enumerable !== true) return null;
    }
    return Object.fromEntries(keys.map((key) => [String(key), descriptors[String(key)]!.value]));
  } catch {
    return null;
  }
}

function exact(row: RecordValue, keys: readonly string[]): boolean {
  const actual = Object.keys(row).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function uuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

function sha256(value: unknown): value is string {
  return typeof value === "string" && SHA256.test(value);
}

function positiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isWellFormedUtf16(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) return false;
  }
  return true;
}

function requestInput(value: unknown): RequestIndiaFiscalSubmissionInput | null {
  const row = record(value);
  if (!row || !exact(row, REQUEST_KEYS) || !uuid(row.tenantId) || !uuid(row.propertyNode)
      || !uuid(row.documentId) || !uuid(row.providerExtensionId) || !uuid(row.actorId)
      || typeof row.idempotencyKey !== "string" || !IDEMPOTENCY_KEY.test(row.idempotencyKey)
      || !uuid(row.requestId)) return null;
  return frozen({ tenantId: row.tenantId, propertyNode: row.propertyNode, documentId: row.documentId,
    providerExtensionId: row.providerExtensionId, actorId: row.actorId,
    idempotencyKey: row.idempotencyKey, requestId: row.requestId });
}

function retryInput(value: unknown): RetryIndiaFiscalSubmissionInput | null {
  const row = record(value);
  if (!row || !exact(row, RETRY_KEYS) || !uuid(row.tenantId) || !uuid(row.submissionId)
      || !uuid(row.actorId) || typeof row.idempotencyKey !== "string"
      || !IDEMPOTENCY_KEY.test(row.idempotencyKey) || !uuid(row.requestId)) return null;
  return frozen({ tenantId: row.tenantId, submissionId: row.submissionId, actorId: row.actorId,
    idempotencyKey: row.idempotencyKey, requestId: row.requestId });
}

function claimInput(value: unknown): ClaimIndiaFiscalSubmissionInput | null {
  const row = record(value);
  if (!row || !exact(row, CLAIM_INPUT_KEYS) || !uuid(row.tenantId) || !uuid(row.submissionId)
      || !Number.isSafeInteger(row.leaseSeconds) || (row.leaseSeconds as number) < 15
      || (row.leaseSeconds as number) > 300) return null;
  return frozen({ tenantId: row.tenantId, submissionId: row.submissionId,
    leaseSeconds: row.leaseSeconds as number });
}

function validDisposition(status: FiscalSubmissionPersistedStatus, disposition: FiscalSubmissionDisposition): boolean {
  switch (status) {
    case "pending": return disposition === "send";
    case "submitted": return disposition === "lookup";
    case "accepted":
    case "rejected": return disposition === "none";
    case "error": return disposition === "retry";
    default: return assertNever(status);
  }
}

export function snapshotFiscalSubmissionReceipt(value: unknown): FiscalSubmissionReceipt | null {
  const row = record(value);
  if (!row || !exact(row, RECEIPT_KEYS) || !uuid(row.submissionId) || !uuid(row.tenantId)
      || !uuid(row.propertyNode) || !uuid(row.documentId) || !sha256(row.documentSha256)
      || !sha256(row.wireSha256) || typeof row.providerKey !== "string" || !PROVIDER_KEY.test(row.providerKey)
      || !uuid(row.providerExtensionId) || !positiveInteger(row.providerExtensionVersion)
      || !uuid(row.attemptId) || !positiveInteger(row.attemptNumber)
      || typeof row.retryCount !== "number" || !Number.isSafeInteger(row.retryCount)
      || row.retryCount < 0 || row.retryCount > 3 || row.attemptNumber !== row.retryCount + 1
      || (row.status !== "pending" && row.status !== "submitted" && row.status !== "accepted"
        && row.status !== "rejected" && row.status !== "error")
      || (row.disposition !== "send" && row.disposition !== "lookup"
        && row.disposition !== "retry" && row.disposition !== "none")
      || !validDisposition(row.status, row.disposition) || !positiveInteger(row.transitionSeq)
      || typeof row.replayed !== "boolean") return null;
  return frozen({
    submissionId: row.submissionId, tenantId: row.tenantId, propertyNode: row.propertyNode,
    documentId: row.documentId, documentSha256: row.documentSha256, wireSha256: row.wireSha256,
    providerKey: row.providerKey, providerExtensionId: row.providerExtensionId,
    providerExtensionVersion: row.providerExtensionVersion, attemptId: row.attemptId,
    attemptNumber: row.attemptNumber, retryCount: row.retryCount, status: row.status,
    disposition: row.disposition, transitionSeq: row.transitionSeq, replayed: row.replayed,
  });
}

export function snapshotFiscalSubmissionClaim(value: unknown): FiscalSubmissionClaim | null {
  const row = record(value);
  if (!row || typeof row.claimed !== "boolean") return null;
  if (row.claimed === false) {
    if (!exact(row, ["claimed", "reason"]) || (row.reason !== "busy" && row.reason !== "terminal"
        && row.reason !== "retry_required")) return null;
    return frozen({ claimed: false, reason: row.reason });
  }
  if (!exact(row, CLAIM_KEYS) || (row.action !== "submit" && row.action !== "lookup")
      || !uuid(row.claimToken) || !uuid(row.submissionId) || !uuid(row.tenantId)
      || !uuid(row.propertyNode) || !uuid(row.documentId) || !sha256(row.documentSha256)
      || !sha256(row.wireSha256) || typeof row.wireJson !== "string"
      || row.wireJson.length > MAX_WIRE_BYTES || !isWellFormedUtf16(row.wireJson)
      || new TextEncoder().encode(row.wireJson).byteLength > MAX_WIRE_BYTES
      || typeof row.providerKey !== "string" || !PROVIDER_KEY.test(row.providerKey)
      || !uuid(row.providerExtensionId) || !positiveInteger(row.providerExtensionVersion)
      || !uuid(row.attemptId) || !positiveInteger(row.attemptNumber)) return null;
  try {
    const parsed: unknown = JSON.parse(row.wireJson);
    if (!record(parsed)) return null;
  } catch {
    return null;
  }
  const actualHash = new Bun.CryptoHasher("sha256").update(row.wireJson).digest("hex");
  if (actualHash !== row.wireSha256) return null;
  const action = row.action as "submit" | "lookup";
  return frozen({
    claimed: true, action, claimToken: row.claimToken,
    submissionId: row.submissionId, tenantId: row.tenantId, propertyNode: row.propertyNode,
    documentId: row.documentId, documentSha256: row.documentSha256, wireSha256: row.wireSha256,
    wireJson: row.wireJson, providerKey: row.providerKey,
    providerExtensionId: row.providerExtensionId,
    providerExtensionVersion: row.providerExtensionVersion,
    attemptId: row.attemptId, attemptNumber: row.attemptNumber,
  });
}

export function snapshotFiscalSubmissionNormalizedResult(value: unknown): FiscalSubmissionNormalizedResult | null {
  const row = record(value);
  if (!row || !uuid(row.tenantId) || typeof row.providerKey !== "string" || !PROVIDER_KEY.test(row.providerKey)
      || !uuid(row.attemptId) || !uuid(row.documentId) || !sha256(row.payloadSha256)
      || (row.type !== "transport_result" && row.type !== "lookup_result")) return null;
  const base = { type: row.type, tenantId: row.tenantId, providerKey: row.providerKey,
    attemptId: row.attemptId, documentId: row.documentId, payloadSha256: row.payloadSha256 } as const;
  if (row.outcome === "accepted" || row.outcome === "rejected") {
    if (!exact(row, [...EVENT_BASE_KEYS, "authorityRef", "responseSha256"])
        || typeof row.authorityRef !== "string" || row.authorityRef.length < 1
        || row.authorityRef.length > 256 || REFERENCE_CONTROL.test(row.authorityRef)
        || !sha256(row.responseSha256)) return null;
    return frozen({ ...base, outcome: row.outcome, authorityRef: row.authorityRef,
      responseSha256: row.responseSha256 });
  }
  if (row.type === "transport_result"
      && (row.outcome === "pending" || row.outcome === "timeout" || row.outcome === "duplicate"
        || row.outcome === "known_not_sent") && exact(row, EVENT_BASE_KEYS)) {
    return frozen({ ...base, type: "transport_result", outcome: row.outcome });
  }
  if (row.type === "lookup_result" && (row.outcome === "pending" || row.outcome === "known_not_sent")
      && exact(row, EVENT_BASE_KEYS)) {
    return frozen({ ...base, type: "lookup_result", outcome: row.outcome });
  }
  return null;
}

function reconcileInput(value: unknown): ReconcileIndiaFiscalSubmissionInput | null {
  const row = record(value);
  if (!row || !exact(row, RECONCILE_KEYS) || !uuid(row.tenantId) || !uuid(row.submissionId)
      || !uuid(row.attemptId) || !uuid(row.claimToken)) return null;
  const result = snapshotFiscalSubmissionNormalizedResult(row.result);
  if (!result || result.tenantId !== row.tenantId || result.attemptId !== row.attemptId) return null;
  return frozen({ tenantId: row.tenantId, submissionId: row.submissionId,
    attemptId: row.attemptId, claimToken: row.claimToken, result });
}

function oneReceipt(rows: unknown): FiscalSubmissionReceipt {
  if (!Array.isArray(rows) || rows.length !== 1) throw new InvalidReceipt();
  const wrapper = record(rows[0]);
  if (!wrapper || !exact(wrapper, ["receipt"])) throw new InvalidReceipt();
  const receipt = snapshotFiscalSubmissionReceipt(wrapper.receipt);
  if (!receipt) throw new InvalidReceipt();
  return receipt;
}

function oneClaim(rows: unknown): FiscalSubmissionClaim {
  if (!Array.isArray(rows) || rows.length !== 1) throw new InvalidReceipt();
  const wrapper = record(rows[0]);
  if (!wrapper || !exact(wrapper, ["receipt"])) throw new InvalidReceipt();
  const claim = snapshotFiscalSubmissionClaim(wrapper.receipt);
  if (!claim) throw new InvalidReceipt();
  return claim;
}

export class FiscalSubmissionRepository {
  readonly #pool: ConnectionPool;
  #poolFailure: Error | undefined;

  constructor(runtimePool: ConnectionPool) {
    this.#pool = runtimePool;
  }

  async request(tx: Tx, inputValue: unknown): Promise<FiscalSubmissionRepositoryResult<FiscalSubmissionReceipt>> {
    const input = requestInput(inputValue);
    if (!input) return failure("invalid_input", "fiscal submission request is invalid");
    try {
      const receipt = oneReceipt(await tx<Array<{ receipt: unknown }>>`
        SELECT request_india_fiscal_submission(
          ${input.tenantId}::uuid, ${input.propertyNode}::uuid, ${input.documentId}::uuid,
          ${input.providerExtensionId}::uuid, ${input.actorId}::uuid,
          ${input.idempotencyKey}::text, ${input.requestId}::uuid
        ) AS receipt
      `);
      if (receipt.tenantId !== input.tenantId || receipt.propertyNode !== input.propertyNode
          || receipt.documentId !== input.documentId
          || receipt.providerExtensionId !== input.providerExtensionId) throw new InvalidReceipt();
      return success({ ...receipt });
    } catch (error) {
      return error instanceof InvalidReceipt
        ? failure("invalid_receipt", "PostgreSQL returned an invalid fiscal submission receipt")
        : failure("database_error", "Fiscal submission request could not be persisted");
    }
  }

  async retry(tx: Tx, inputValue: unknown): Promise<FiscalSubmissionRepositoryResult<FiscalSubmissionReceipt>> {
    const input = retryInput(inputValue);
    if (!input) return failure("invalid_input", "fiscal submission retry request is invalid");
    try {
      const receipt = oneReceipt(await tx<Array<{ receipt: unknown }>>`
        SELECT retry_india_fiscal_submission(
          ${input.tenantId}::uuid, ${input.submissionId}::uuid, ${input.actorId}::uuid,
          ${input.idempotencyKey}::text, ${input.requestId}::uuid
        ) AS receipt
      `);
      if (receipt.tenantId !== input.tenantId || receipt.submissionId !== input.submissionId) {
        throw new InvalidReceipt();
      }
      return success({ ...receipt });
    } catch (error) {
      return error instanceof InvalidReceipt
        ? failure("invalid_receipt", "PostgreSQL returned an invalid fiscal submission receipt")
        : failure("database_error", "Fiscal submission retry could not be persisted");
    }
  }

  async claim(inputValue: unknown): Promise<FiscalSubmissionRepositoryResult<FiscalSubmissionClaim>> {
    const input = claimInput(inputValue);
    if (!input) return failure("invalid_input", "fiscal submission claim is invalid");
    return this.#runtimeTransaction(input.tenantId, async (connection) => {
      const claim = oneClaim(await connection<Array<{ receipt: unknown }>>`
        SELECT claim_india_fiscal_submission(
          ${input.tenantId}::uuid, ${input.submissionId}::uuid, ${input.leaseSeconds}::integer
        ) AS receipt
      `);
      if (claim.claimed && (claim.tenantId !== input.tenantId || claim.submissionId !== input.submissionId)) {
        throw new InvalidReceipt();
      }
      return claim;
    });
  }

  async reconcile(inputValue: unknown): Promise<FiscalSubmissionRepositoryResult<FiscalSubmissionReceipt>> {
    const input = reconcileInput(inputValue);
    if (!input) return failure("invalid_input", "fiscal submission reconciliation is invalid");
    return this.#runtimeTransaction(input.tenantId, async (connection) => {
      const receipt = oneReceipt(await connection<Array<{ receipt: unknown }>>`
        SELECT reconcile_india_fiscal_submission(
          ${input.tenantId}::uuid, ${input.submissionId}::uuid, ${input.attemptId}::uuid,
          ${input.claimToken}::uuid, ${JSON.stringify(input.result)}::text::jsonb
        ) AS receipt
      `);
      if (receipt.tenantId !== input.tenantId || receipt.submissionId !== input.submissionId
          || receipt.attemptId !== input.attemptId || receipt.documentId !== input.result.documentId
          || receipt.providerKey !== input.result.providerKey || receipt.wireSha256 !== input.result.payloadSha256) {
        throw new InvalidReceipt();
      }
      return receipt;
    });
  }

  async #assertRuntimeIdentity(connection: Tx, tenantId?: string): Promise<void> {
    const rows = await connection.unsafe<Array<{
      session_user: string;
      current_user: string;
      tenant_id: string | null;
      prepared_count: number;
    }>>(`
      SELECT session_user::text AS session_user,
             current_user::text AS current_user,
             NULLIF(current_setting('app.tenant_id', true), '') AS tenant_id,
             (SELECT count(*)::int FROM pg_prepared_statements) AS prepared_count
    `);
    const row = rows[0];
    if (rows.length !== 1 || row?.session_user !== "yellow_runtime" || row.current_user !== "yellow_runtime"
        || row.tenant_id !== (tenantId ?? null) || row.prepared_count !== 0) {
      throw new Error("runtime identity is not settled");
    }
  }

  async #discardAndAssertSettlement(connection: Tx): Promise<void> {
    await connection.unsafe("DISCARD ALL");
    await this.#assertRuntimeIdentity(connection);
  }

  #failClosePool(): void {
    if (this.#poolFailure) return;
    this.#poolFailure = new Error("Fiscal submission runtime pool is irreversibly failed");
    try {
      const closing = this.#pool.close?.({ timeout: 0 });
      void closing?.catch(() => undefined);
    } catch {
      // The repository is already fail-closed.
    }
  }

  async #runtimeTransaction<T extends object>(
    tenantId: string,
    operation: (connection: Tx) => Promise<T>,
  ): Promise<FiscalSubmissionRepositoryResult<T>> {
    if (this.#poolFailure) return failure("pool_failed", "Fiscal submission runtime pool is unavailable");
    let connection: Tx;
    try {
      connection = await this.#pool.reserve();
    } catch {
      return failure("database_error", "Fiscal submission runtime connection is unavailable");
    }

    let began = false;
    let settled = false;
    let reusable = false;
    let mustClosePool = false;
    let outcome: FiscalSubmissionRepositoryResult<T> = failure("database_error", "Fiscal submission database operation failed");
    try {
      await connection.unsafe("BEGIN");
      began = true;
      const context = await connection.unsafe<Array<{ tenant_id: string }>>(
        "SELECT set_config('app.tenant_id', $1, true) AS tenant_id",
        [tenantId],
      );
      if (context.length !== 1 || context[0]?.tenant_id !== tenantId) {
        throw new Error("tenant context was not established");
      }
      await this.#assertRuntimeIdentity(connection, tenantId);
      const value = await operation(connection);
      try {
        await connection.unsafe("COMMIT");
      } catch (error) {
        mustClosePool = true;
        throw error;
      }
      began = false;
      settled = true;
      await this.#assertRuntimeIdentity(connection);
      reusable = true;
      outcome = success({ ...value });
    } catch (error) {
      if (began) {
        try {
          await connection.unsafe("ROLLBACK");
          began = false;
          settled = true;
          if (!mustClosePool) {
            await this.#assertRuntimeIdentity(connection);
            reusable = true;
          }
        } catch {
          mustClosePool = true;
        }
      }
      outcome = error instanceof InvalidReceipt
        ? failure("invalid_receipt", "PostgreSQL returned an invalid fiscal submission receipt")
        : failure("database_error", "Fiscal submission database operation failed");
    } finally {
      if (!reusable && settled && !mustClosePool) {
        try {
          await this.#discardAndAssertSettlement(connection);
          reusable = true;
        } catch {
          mustClosePool = true;
        }
      }
      if (!reusable || mustClosePool) this.#failClosePool();
      if (reusable && !mustClosePool) {
        try {
          connection.release();
        } catch {
          reusable = false;
          mustClosePool = true;
          this.#failClosePool();
        }
      }
    }
    return (!reusable || mustClosePool)
      ? failure("pool_failed", "Fiscal submission runtime pool is unavailable")
      : outcome;
  }
}

function assertNever(value: never): never {
  throw new Error(`unreachable fiscal submission value: ${String(value)}`);
}
