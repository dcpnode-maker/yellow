import type { Tx } from "./db";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const OPERATION = /^[a-z][a-z0-9_.-]{0,127}$/;
const KEY = /^[\x21-\x7e]{8,200}$/;
const RETENTION_MS = 24 * 60 * 60 * 1_000;

export type JsonPrimitive = null | boolean | number | string;
export type JsonValue = JsonPrimitive | readonly JsonValue[] | { readonly [key: string]: JsonValue };

export interface IdempotencyInput {
  readonly tenantId: string;
  readonly operation: string;
  readonly key: string;
  readonly request: unknown;
}

export interface IdempotencyCommandResult<T extends JsonValue> {
  readonly status: number;
  readonly body: T;
}

export interface IdempotencyResult<T extends JsonValue> extends IdempotencyCommandResult<T> {
  readonly replayed: boolean;
}

export interface PostgresIdempotencyOptions {
  readonly now?: () => Date;
}

interface ReplayRow {
  readonly request_hash: string;
  readonly response_status: number | null;
  readonly response_body_json: string | null;
  readonly completed_at: Date | null;
}

export class IdempotencyValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IdempotencyValidationError";
  }
}

export class IdempotencyConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IdempotencyConflictError";
  }
}

function sha256(value: string): string {
  return new Bun.CryptoHasher("sha256").update(value).digest("hex");
}

function canonicalJson(value: unknown, ancestors = new Set<object>()): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new IdempotencyValidationError("JSON numbers must be finite");
    return JSON.stringify(value);
  }
  if (typeof value !== "object") {
    throw new IdempotencyValidationError("Value must contain only JSON data");
  }
  if (ancestors.has(value)) throw new IdempotencyValidationError("JSON data must not contain cycles");
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      const keys = Object.keys(value);
      if (keys.length !== value.length || keys.some((key, index) => key !== String(index))) {
        throw new IdempotencyValidationError("JSON arrays must not be sparse or carry named properties");
      }
      return `[${value.map((item) => canonicalJson(item, ancestors)).join(",")}]`;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new IdempotencyValidationError("JSON objects must be plain records");
    }
    if (Object.getOwnPropertySymbols(value).length > 0) {
      throw new IdempotencyValidationError("JSON objects must not contain symbol keys");
    }
    const record = value as Record<string, unknown>;
    return "{" + Object.keys(record).sort().map((key) =>
      JSON.stringify(key) + ":" + canonicalJson(record[key], ancestors)
    ).join(",") + "}";
  } finally {
    ancestors.delete(value);
  }
}

function validateInput(input: IdempotencyInput): { keyHash: string; requestHash: string } {
  if (!UUID.test(input.tenantId)) throw new IdempotencyValidationError("tenantId must be a UUID");
  if (!OPERATION.test(input.operation)) {
    throw new IdempotencyValidationError("operation must be a stable lowercase identifier");
  }
  if (!KEY.test(input.key)) {
    throw new IdempotencyValidationError("idempotency key must contain 8 to 200 visible ASCII characters");
  }
  return { keyHash: sha256(input.key), requestHash: sha256(canonicalJson(input.request)) };
}

function validateNow(now: Date): void {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw new IdempotencyValidationError("idempotency clock returned an invalid instant");
  }
}

function validateResult<T extends JsonValue>(result: IdempotencyCommandResult<T>): string {
  if (!Number.isInteger(result.status) || result.status < 200 || result.status > 299) {
    throw new IdempotencyValidationError("idempotent command status must be an integer from 200 to 299");
  }
  return canonicalJson(result.body);
}

export class PostgresIdempotency {
  readonly #now: () => Date;

  constructor(options: PostgresIdempotencyOptions = {}) {
    this.#now = options.now ?? (() => new Date());
  }

  async execute<T extends JsonValue>(
    tx: Tx,
    input: IdempotencyInput,
    command: (tx: Tx) => Promise<IdempotencyCommandResult<T>>,
  ): Promise<IdempotencyResult<T>> {
    const { keyHash, requestHash } = validateInput(input);
    const now = this.#now();
    validateNow(now);
    const expiresAt = new Date(now.getTime() + RETENTION_MS);
    const nowIso = now.toISOString();
    const expiresAtIso = expiresAt.toISOString();

    const claimed = await tx<Array<{ claimed: boolean }>>`
      INSERT INTO api_idempotency (
        tenant_id, operation, key_hash, request_hash, created_at, expires_at
      )
      VALUES (
        ${input.tenantId}::uuid, ${input.operation}, ${keyHash}, ${requestHash},
        ${nowIso}::timestamptz, ${expiresAtIso}::timestamptz
      )
      ON CONFLICT (tenant_id, operation, key_hash) DO UPDATE
      SET request_hash = EXCLUDED.request_hash,
          response_status = NULL,
          response_body = NULL,
          created_at = EXCLUDED.created_at,
          completed_at = NULL,
          expires_at = EXCLUDED.expires_at
      WHERE api_idempotency.expires_at <= EXCLUDED.created_at
      RETURNING true AS claimed
    `;

    if (!claimed[0]) {
      const existing = (await tx<ReplayRow[]>`
        SELECT request_hash, response_status, response_body::text AS response_body_json,
               completed_at
        FROM api_idempotency
        WHERE tenant_id = ${input.tenantId}::uuid
          AND operation = ${input.operation}
          AND key_hash = ${keyHash}
        FOR UPDATE
      `)[0];
      if (!existing) throw new Error("Idempotency claim disappeared during replay");
      if (existing.request_hash !== requestHash) {
        throw new IdempotencyConflictError("Idempotency key was already used with a different request");
      }
      if (existing.completed_at === null || existing.response_status === null || existing.response_body_json === null) {
        throw new Error("Idempotency claim is incomplete");
      }
      return {
        status: existing.response_status,
        body: JSON.parse(existing.response_body_json) as T,
        replayed: true,
      };
    }

    const result = await command(tx);
    const encodedBody = validateResult(result);
    const completed = await tx<Array<{ completed: boolean }>>`
      UPDATE api_idempotency
      SET response_status = ${result.status},
          response_body = ${encodedBody}::text::jsonb,
          completed_at = ${nowIso}::timestamptz
      WHERE tenant_id = ${input.tenantId}::uuid
        AND operation = ${input.operation}
        AND key_hash = ${keyHash}
        AND request_hash = ${requestHash}
        AND completed_at IS NULL
      RETURNING true AS completed
    `;
    if (completed[0]?.completed !== true) {
      throw new Error("Idempotency claim could not be completed");
    }
    return { ...result, replayed: false };
  }
}
