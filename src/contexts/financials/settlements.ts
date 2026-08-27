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
const INTEGER = /^-?(?:0|[1-9][0-9]*)$/;

type FolioTransition = "settle" | "close";
export type FolioSettlementStatus = "open" | "settled" | "closed";

export interface FolioSettlementInput {
  readonly tenantId: string;
  readonly folioId: string;
  readonly idempotencyKey: string;
  readonly envelope: AuditEnvelope;
}

export interface FolioSettlementResult {
  readonly folioId: string;
  readonly accountId: string;
  readonly reservationId: string | null;
  readonly windowNo: number;
  readonly previousStatus: "open" | "settled";
  readonly status: "settled" | "closed";
  readonly balanceMinor: "0";
  readonly replayed: boolean;
}

export interface FolioSettlementServiceOptions {
  readonly database: Database;
  readonly events: EventBus;
  readonly idempotency: PostgresIdempotency;
}

interface NormalizedSettlement {
  readonly tenantId: string;
  readonly folioId: string;
  readonly idempotencyKey: string;
  readonly envelope: AuditEnvelope;
}

interface FolioSettlementRow {
  readonly folio_id: string;
  readonly account_id: string;
  readonly reservation_id: string | null;
  readonly window_no: number;
  readonly folio_status: string;
  readonly account_status: string;
  readonly account_role: string;
  readonly property_node: string | null;
  readonly currency: string;
  readonly balance_minor: string;
}

interface TransitionedRow {
  readonly folio_id: string;
  readonly account_id: string;
  readonly reservation_id: string | null;
  readonly window_no: number;
  readonly previous_status: string;
  readonly status: string;
  readonly balance_minor: string;
}

interface FolioSettlementBody extends Readonly<Record<string, JsonValue>> {
  readonly folioId: string;
  readonly accountId: string;
  readonly reservationId: string | null;
  readonly windowNo: number;
  readonly previousStatus: "open" | "settled";
  readonly status: "settled" | "closed";
  readonly balanceMinor: "0";
}

export class FolioSettlementValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FolioSettlementValidationError";
  }
}

export class FolioSettlementNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FolioSettlementNotFoundError";
  }
}

export class FolioSettlementConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FolioSettlementConflictError";
  }
}

function requirePlainRecord(name: string, value: unknown): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value) ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) ||
      Object.getOwnPropertySymbols(value).length > 0) {
    throw new FolioSettlementValidationError(`${name} must be a plain object`);
  }
}

function requireExactKeys(name: string, value: Record<string, unknown>, expected: readonly string[]): void {
  const actual = Object.getOwnPropertyNames(value).sort();
  const canonical = [...expected].sort();
  if (actual.length !== canonical.length || actual.some((key, index) => key !== canonical[index])) {
    throw new FolioSettlementValidationError(`${name} shape is invalid`);
  }
}

function requireUuid(name: string, value: unknown): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new FolioSettlementValidationError(`${name} must be a lowercase UUID`);
  }
  return value;
}

function normalize(input: FolioSettlementInput, transition: FolioTransition): NormalizedSettlement {
  requirePlainRecord("Settlement input", input);
  requireExactKeys("Settlement input", input, ["tenantId", "folioId", "idempotencyKey", "envelope"]);
  requirePlainRecord("envelope", input.envelope);
  requireExactKeys("envelope", input.envelope, [
    "actorId", "tenantId", "propertyNode", "requestId", "operation",
  ]);

  const tenantId = requireUuid("tenantId", input.tenantId);
  if (requireUuid("envelope.tenantId", input.envelope.tenantId) !== tenantId) {
    throw new FolioSettlementValidationError("tenantId must match the audit envelope tenant");
  }
  requireUuid("envelope.actorId", input.envelope.actorId);
  requireUuid("envelope.propertyNode", input.envelope.propertyNode);
  requireUuid("envelope.requestId", input.envelope.requestId);
  const expectedOperation = transition === "settle" ? "folio.settled" : "folio.closed";
  if (input.envelope.operation !== expectedOperation) {
    throw new FolioSettlementValidationError(`audit operation must be ${expectedOperation}`);
  }
  if (typeof input.idempotencyKey !== "string" || !IDEMPOTENCY_KEY.test(input.idempotencyKey)) {
    throw new FolioSettlementValidationError(
      "idempotencyKey must contain 8-200 visible ASCII characters",
    );
  }

  return Object.freeze({
    tenantId,
    folioId: requireUuid("folioId", input.folioId),
    idempotencyKey: input.idempotencyKey,
    envelope: input.envelope,
  });
}

function assertCanonicalRow(
  row: FolioSettlementRow,
  input: NormalizedSettlement,
  expectedStatus: "open" | "settled",
): void {
  if (row.folio_id !== input.folioId || !UUID.test(row.account_id) ||
      (row.reservation_id !== null && !UUID.test(row.reservation_id)) ||
      !Number.isSafeInteger(row.window_no) || row.window_no < 1 || row.window_no > 20 ||
      row.property_node !== input.envelope.propertyNode ||
      row.account_role !== "guest" || !/^[A-Z]{3}$/.test(row.currency)) {
    throw new FolioSettlementConflictError("Folio financial ownership is inconsistent");
  }
  if (row.account_status !== "open") {
    throw new FolioSettlementConflictError("Folio guest account is not open");
  }
  if (row.folio_status !== expectedStatus) {
    throw new FolioSettlementConflictError(`Folio is not ${expectedStatus}`);
  }
  if (!INTEGER.test(row.balance_minor)) {
    throw new FolioSettlementConflictError("Folio balance is not a canonical integer");
  }
  if (BigInt(row.balance_minor) !== 0n) {
    throw new FolioSettlementConflictError("Folio balance must be exactly zero");
  }
}

async function loadFolio(tx: Tx, input: NormalizedSettlement): Promise<FolioSettlementRow | undefined> {
  const rows = await tx<FolioSettlementRow[]>`
    SELECT
      folio.id AS folio_id,
      folio.account_id,
      folio.reservation_id,
      folio.window_no::int,
      folio.status AS folio_status,
      account.status AS account_status,
      account.role AS account_role,
      account.property_node,
      account.currency::text,
      COALESCE(balance.balance_minor, 0)::text AS balance_minor
    FROM folio
    JOIN account
      ON account.tenant_id = folio.tenant_id
     AND account.id = folio.account_id
    JOIN org_node AS property
      ON property.tenant_id = account.tenant_id
     AND property.id = account.property_node
     AND property.kind = 'property'
    LEFT JOIN folio_balance AS balance
      ON balance.tenant_id = folio.tenant_id
     AND balance.folio_id = folio.id
    WHERE folio.tenant_id = ${input.tenantId}::uuid
      AND folio.tenant_id = current_setting('app.tenant_id', true)::uuid
      AND folio.id = ${input.folioId}::uuid
  `;
  if (rows.length > 1) {
    throw new FolioSettlementConflictError("Folio financial ownership is ambiguous");
  }
  return rows[0];
}

export class FolioSettlementService {
  readonly #database: Database;
  readonly #events: EventBus;
  readonly #idempotency: PostgresIdempotency;

  constructor(options: FolioSettlementServiceOptions) {
    this.#database = options.database;
    this.#events = options.events;
    this.#idempotency = options.idempotency;
  }

  async settle(input: FolioSettlementInput): Promise<FolioSettlementResult> {
    return this.#transition("settle", input);
  }

  async close(input: FolioSettlementInput): Promise<FolioSettlementResult> {
    return this.#transition("close", input);
  }

  async #transition(
    transition: FolioTransition,
    input: FolioSettlementInput,
  ): Promise<FolioSettlementResult> {
    const normalized = normalize(input, transition);
    const previousStatus = transition === "settle" ? "open" as const : "settled" as const;
    const nextStatus = transition === "settle" ? "settled" as const : "closed" as const;
    const eventType = transition === "settle" ? "folio.settled" as const : "folio.closed" as const;
    const operation = transition === "settle"
      ? "financials.folio.settle"
      : "financials.folio.close";

    try {
      const outcome = await this.#database.withTenantTransaction(normalized.tenantId, async (tx) =>
        this.#idempotency.execute<FolioSettlementBody>(tx, {
          tenantId: normalized.tenantId,
          operation,
          key: normalized.idempotencyKey,
          request: {
            actorId: normalized.envelope.actorId,
            propertyNode: normalized.envelope.propertyNode,
            folioId: normalized.folioId,
            transition,
          },
        }, async (commandTx) => {
          const discovered = await loadFolio(commandTx, normalized);
          if (!discovered || discovered.property_node !== normalized.envelope.propertyNode) {
            throw new FolioSettlementNotFoundError("Folio was not found in the audit property");
          }
          assertCanonicalRow(discovered, normalized, previousStatus);

          await commandTx`
            SELECT public.lock_financial_rows(
              ${normalized.tenantId}::uuid,
              ARRAY[${discovered.account_id}::uuid]::uuid[],
              ${normalized.folioId}::uuid
            )
          `;

          const locked = await loadFolio(commandTx, normalized);
          if (!locked || locked.account_id !== discovered.account_id ||
              locked.property_node !== normalized.envelope.propertyNode) {
            throw new FolioSettlementNotFoundError("Folio was not found after lock acquisition");
          }
          assertCanonicalRow(locked, normalized, previousStatus);

          const updated = await commandTx<TransitionedRow[]>`
            SELECT
              folio_id,
              account_id,
              reservation_id,
              window_no::int,
              previous_status,
              status,
              balance_minor::text
            FROM public.transition_folio_status(
              ${normalized.tenantId}::uuid,
              ${normalized.envelope.propertyNode}::uuid,
              ${normalized.folioId}::uuid,
              ${transition}
            )
          `;
          const transitioned = updated[0];
          if (updated.length !== 1 || !transitioned ||
              transitioned.folio_id !== normalized.folioId ||
              transitioned.account_id !== locked.account_id ||
              transitioned.reservation_id !== locked.reservation_id ||
              transitioned.window_no !== locked.window_no ||
              transitioned.previous_status !== previousStatus ||
              transitioned.status !== nextStatus || transitioned.balance_minor !== "0") {
            throw new FolioSettlementConflictError("Folio state changed before transition");
          }

          const payload = Object.freeze({
            folio_id: normalized.folioId,
            account_id: locked.account_id,
            reservation_id: locked.reservation_id,
            window_no: locked.window_no,
            previous_status: previousStatus,
            status: nextStatus,
          });
          const fact = await recordFact(commandTx, {
            entityType: "folio",
            entityId: normalized.folioId,
            envelope: normalized.envelope,
            payload,
          });
          await this.#events.publish(commandTx, {
            tenantId: normalized.tenantId,
            propertyNode: locked.property_node,
            businessDate: fact.businessDate,
            aggregateType: "folio",
            aggregateId: normalized.folioId,
            eventType,
            actorId: normalized.envelope.actorId,
            correlationId: normalized.envelope.requestId,
            payload,
          });

          return {
            status: 200,
            body: Object.freeze({
              folioId: normalized.folioId,
              accountId: locked.account_id,
              reservationId: locked.reservation_id,
              windowNo: locked.window_no,
              previousStatus,
              status: nextStatus,
              balanceMinor: "0" as const,
            }),
          };
        })
      );
      return Object.freeze({ ...outcome.body, replayed: outcome.replayed });
    } catch (error) {
      const state = (error as { errno?: string; code?: string }).errno ??
        (error as { errno?: string; code?: string }).code;
      if (state === "55000") {
        throw new FolioSettlementConflictError("Folio financial rows are unavailable");
      }
      throw error;
    }
  }
}
