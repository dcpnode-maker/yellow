import {
  recordFact,
  type AuditEnvelope,
  type EventBus,
  type JsonValue,
  type PostgresIdempotency,
  type Tx,
} from "../../kernel";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const IDEMPOTENCY_KEY = /^[\x21-\x7e]{8,200}$/;
const TX_CODE = /^[A-Z0-9][A-Z0-9._-]{0,31}$/;
const POSITIVE_INT64 = /^[1-9][0-9]*$/;
const QUANTITY = /^(?:0\.[0-9]{1,3}|[1-9][0-9]{0,6}(?:\.[0-9]{1,3})?)$/;
const INT64_MAX = 9_223_372_036_854_775_807n;
const DEFAULT_QUANTITY = "1.000";

export interface PostChargeInput {
  readonly tenantId: string;
  readonly folioId: string;
  readonly txCode: string;
  readonly amountMinor: string;
  readonly quantity?: string;
  readonly idempotencyKey: string;
  readonly envelope: AuditEnvelope;
}

export interface PostChargeResult {
  readonly journalId: string;
  readonly folioId: string;
  readonly businessDate: string;
  readonly currency: string;
  readonly txCode: string;
  readonly amountMinor: string;
  readonly quantity: string;
  readonly replayed: boolean;
}

export interface ChargeServiceOptions {
  readonly events: EventBus;
  readonly idempotency: PostgresIdempotency;
}

interface NormalizedCharge {
  readonly tenantId: string;
  readonly folioId: string;
  readonly txCode: string;
  readonly amountMinor: string;
  readonly amount: bigint;
  readonly quantity: string;
  readonly idempotencyKey: string;
  readonly envelope: AuditEnvelope;
}

interface FolioContextRow {
  readonly folio_id: string;
  readonly folio_status: string;
  readonly account_id: string;
  readonly account_status: string;
  readonly account_role: string;
  readonly property_node: string | null;
  readonly currency: string;
  readonly business_date: string;
}

interface TxCodeRow {
  readonly code: string;
  readonly name: string;
  readonly grp: string;
  readonly usali_line: string | null;
  readonly default_cr: string | null;
}

interface RouteRow {
  readonly credit_account_id: string | null;
}

interface RevenueAccountRow {
  readonly id: string;
  readonly property_node: string | null;
  readonly currency: string;
  readonly role: string;
  readonly status: string;
}

interface JournalRow {
  readonly id: string;
}

interface BusinessDayRow {
  readonly business_date: string;
  readonly sealed_at: Date | null;
}

interface PostChargeBody extends Readonly<Record<string, JsonValue>> {
  readonly journalId: string;
  readonly folioId: string;
  readonly businessDate: string;
  readonly currency: string;
  readonly txCode: string;
  readonly amountMinor: string;
  readonly quantity: string;
}

export class ChargeValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChargeValidationError";
  }
}

export class ChargeNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChargeNotFoundError";
  }
}

export class ChargeConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChargeConflictError";
  }
}

function requirePlainRecord(name: string, value: unknown): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ChargeValidationError(`${name} must be an object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new ChargeValidationError(`${name} must be a plain object`);
  }
  if (Object.getOwnPropertySymbols(value).length > 0) {
    throw new ChargeValidationError(`${name} must not contain symbol fields`);
  }
}

function requireExactKeys(name: string, value: Record<string, unknown>, allowed: readonly string[]): void {
  const allowedKeys = new Set(allowed);
  const unsupported = Object.getOwnPropertyNames(value)
    .filter((key) => !allowedKeys.has(key))
    .sort();
  if (unsupported.length > 0) {
    throw new ChargeValidationError(`${name} contains unsupported fields: ${unsupported.join(", ")}`);
  }
}

function requireUuid(name: string, value: unknown): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new ChargeValidationError(`${name} must be a UUID`);
  }
  return value;
}

function normalizeQuantity(value: unknown): string {
  if (value === undefined) return DEFAULT_QUANTITY;
  if (typeof value !== "string" || !QUANTITY.test(value)) {
    throw new ChargeValidationError("quantity must be a canonical positive decimal string with at most three decimals");
  }
  const [whole = "0", fraction = ""] = value.split(".");
  if (BigInt(whole) === 0n && !/[1-9]/.test(fraction)) {
    throw new ChargeValidationError("quantity must be greater than zero");
  }
  return `${whole}.${fraction.padEnd(3, "0")}`;
}

function normalize(input: PostChargeInput): NormalizedCharge {
  requirePlainRecord("Charge input", input);
  requireExactKeys("Charge input", input, [
    "tenantId", "folioId", "txCode", "amountMinor", "quantity", "idempotencyKey", "envelope",
  ]);
  requirePlainRecord("envelope", input.envelope);
  requireExactKeys("envelope", input.envelope, [
    "actorId", "tenantId", "propertyNode", "requestId", "operation",
  ]);

  const tenantId = requireUuid("tenantId", input.tenantId);
  const envelopeTenant = requireUuid("envelope.tenantId", input.envelope.tenantId);
  if (tenantId !== envelopeTenant) {
    throw new ChargeValidationError("tenantId must match the audit envelope tenant");
  }
  requireUuid("envelope.actorId", input.envelope.actorId);
  requireUuid("envelope.propertyNode", input.envelope.propertyNode);
  requireUuid("envelope.requestId", input.envelope.requestId);
  if (input.envelope.operation !== "journal.posted") {
    throw new ChargeValidationError("audit operation must be journal.posted");
  }
  if (typeof input.txCode !== "string" || !TX_CODE.test(input.txCode)) {
    throw new ChargeValidationError("txCode must be a canonical uppercase transaction code");
  }
  if (typeof input.amountMinor !== "string" || !POSITIVE_INT64.test(input.amountMinor)) {
    throw new ChargeValidationError("amountMinor must be a canonical positive int64 decimal string");
  }
  const amount = BigInt(input.amountMinor);
  if (amount > INT64_MAX) {
    throw new ChargeValidationError("amountMinor exceeds positive int64 range");
  }
  if (typeof input.idempotencyKey !== "string" || !IDEMPOTENCY_KEY.test(input.idempotencyKey)) {
    throw new ChargeValidationError("idempotencyKey must contain 8-200 visible ASCII characters");
  }

  return Object.freeze({
    tenantId,
    folioId: requireUuid("folioId", input.folioId),
    txCode: input.txCode,
    amountMinor: input.amountMinor,
    amount,
    quantity: normalizeQuantity(input.quantity),
    idempotencyKey: input.idempotencyKey,
    envelope: input.envelope,
  });
}

function eventPayload(
  journalId: string,
  input: NormalizedCharge,
  guestAccountId: string,
  revenueAccountId: string,
): Readonly<Record<string, JsonValue>> {
  return Object.freeze({
    journal_id: journalId,
    kind: "charge",
    lines: Object.freeze([
      Object.freeze({
        account: guestAccountId,
        folio: input.folioId,
        tx_code: input.txCode,
        amount_minor: input.amountMinor,
      }),
      Object.freeze({
        account: revenueAccountId,
        tx_code: input.txCode,
        amount_minor: `-${input.amountMinor}`,
      }),
    ]),
  });
}

export class ChargeService {
  readonly #events: EventBus;
  readonly #idempotency: PostgresIdempotency;

  constructor(options: ChargeServiceOptions) {
    this.#events = options.events;
    this.#idempotency = options.idempotency;
  }

  async postCharge(tx: Tx, input: PostChargeInput): Promise<PostChargeResult> {
    const normalized = normalize(input);
    let outcome;
    try {
      outcome = await this.#idempotency.execute<PostChargeBody>(tx, {
      tenantId: normalized.tenantId,
      operation: "financials.charge.post",
      key: normalized.idempotencyKey,
      request: {
        actorId: normalized.envelope.actorId,
        propertyNode: normalized.envelope.propertyNode,
        folioId: normalized.folioId,
        txCode: normalized.txCode,
        amountMinor: normalized.amountMinor,
        quantity: normalized.quantity,
      },
    }, async (commandTx) => {
      const folios = await commandTx<FolioContextRow[]>`
        SELECT
          folio.id AS folio_id,
          folio.status AS folio_status,
          account.id AS account_id,
          account.status AS account_status,
          account.role AS account_role,
          account.property_node,
          account.currency::text,
          (transaction_timestamp() AT TIME ZONE property.timezone)::date::text AS business_date
        FROM folio
        JOIN account
          ON account.tenant_id = folio.tenant_id
         AND account.id = folio.account_id
        JOIN org_node AS property
          ON property.tenant_id = account.tenant_id
         AND property.id = account.property_node
         AND property.kind = 'property'
        WHERE folio.tenant_id = ${normalized.tenantId}::uuid
          AND folio.tenant_id = current_setting('app.tenant_id', true)::uuid
          AND folio.id = ${normalized.folioId}::uuid
        FOR UPDATE OF folio, account
        FOR SHARE OF property
      `;
      const folio = folios[0];
      if (!folio) {
        throw new ChargeNotFoundError("Folio was not found with canonical financial ownership");
      }
      if (folio.property_node !== normalized.envelope.propertyNode) {
        throw new ChargeNotFoundError("Folio was not found in the audit property");
      }
      if (folio.folio_status !== "open") {
        throw new ChargeConflictError("Folio is not open");
      }
      if (folio.account_status !== "open" || folio.account_role !== "guest") {
        throw new ChargeConflictError("Folio guest account is not open");
      }
      if (!UUID.test(folio.account_id) || !/^[A-Z]{3}$/.test(folio.currency)) {
        throw new ChargeConflictError("Folio financial ownership is inconsistent");
      }

      const days = await commandTx<BusinessDayRow[]>`
        SELECT business_date::text, sealed_at
        FROM business_day
        WHERE tenant_id = ${normalized.tenantId}::uuid
          AND tenant_id = current_setting('app.tenant_id', true)::uuid
          AND property_node = ${folio.property_node}::uuid
          AND business_date = ${folio.business_date}::date
      `;
      const day = days[0];
      if (!day || day.business_date !== folio.business_date) {
        throw new ChargeConflictError("Property business day is missing");
      }
      if (day.sealed_at !== null) {
        throw new ChargeConflictError("Property business day is sealed");
      }

      const codes = await commandTx<TxCodeRow[]>`
        SELECT code, name, grp, usali_line, default_cr
        FROM tx_code
        WHERE code = ${normalized.txCode}
      `;
      const code = codes[0];
      if (!code) throw new ChargeNotFoundError("Transaction code was not found");
      if (code.grp !== "revenue" || code.default_cr !== "revenue" ||
          code.usali_line === null || code.usali_line.trim().length === 0) {
        throw new ChargeConflictError("Transaction code is not attributable revenue");
      }

      const routes = await commandTx<RouteRow[]>`
        SELECT route.credit_account_id
        FROM tx_code_route AS route
        WHERE route.tenant_id = ${normalized.tenantId}::uuid
          AND route.tenant_id = current_setting('app.tenant_id', true)::uuid
          AND route.property_node = ${folio.property_node}::uuid
          AND route.currency = ${folio.currency}::char(3)
          AND route.tx_code = ${normalized.txCode}
      `;
      if (routes.length !== 1) {
        throw new ChargeConflictError("Transaction code must have exactly one property currency route");
      }
      const route = routes[0];
      if (!route || route.credit_account_id === null) {
        throw new ChargeConflictError("Transaction code revenue route is not configured");
      }
      const revenueAccounts = await commandTx<RevenueAccountRow[]>`
        SELECT id, property_node, currency::text, role, status
        FROM account
        WHERE tenant_id = ${normalized.tenantId}::uuid
          AND tenant_id = current_setting('app.tenant_id', true)::uuid
          AND id = ${route.credit_account_id}::uuid
        FOR SHARE
      `;
      const revenueAccount = revenueAccounts[0];
      if (!revenueAccount || revenueAccount.id !== route.credit_account_id ||
          revenueAccount.property_node !== folio.property_node || revenueAccount.currency !== folio.currency ||
          revenueAccount.role !== "revenue" || revenueAccount.status !== "open") {
        throw new ChargeConflictError("Transaction code revenue route is inconsistent or closed");
      }

      const debitAmount = normalized.amount;
      const creditAmount = -normalized.amount;
      if (debitAmount + creditAmount !== 0n) {
        throw new Error("Charge lines do not balance to zero");
      }
      const source = JSON.stringify({ interface: "financials.charge.post" });
      const journals = await commandTx<JournalRow[]>`
        INSERT INTO journal (
          tenant_id, property_node, business_date, kind, description,
          currency, source, created_by
        )
        VALUES (
          ${normalized.tenantId}::uuid, ${folio.property_node}::uuid,
          ${folio.business_date}::date, 'charge', ${code.name},
          ${folio.currency}::char(3), ${source}::text::jsonb,
          ${normalized.envelope.actorId}::uuid
        )
        RETURNING id
      `;
      const journal = journals[0];
      if (!journal) throw new Error("PostgreSQL did not return the posted journal");

      await commandTx`
        INSERT INTO posting_line (
          tenant_id, journal_id, seq, account_id, folio_id, tx_code,
          description, amount_minor, quantity, business_date, currency
        )
        VALUES
          (
            ${normalized.tenantId}::uuid, ${journal.id}::uuid, 1,
            ${folio.account_id}::uuid, ${normalized.folioId}::uuid, ${normalized.txCode},
            ${code.name}, ${debitAmount}, ${normalized.quantity}::numeric(10,3),
            ${folio.business_date}::date, ${folio.currency}::char(3)
          ),
          (
            ${normalized.tenantId}::uuid, ${journal.id}::uuid, 2,
            ${route.credit_account_id}::uuid, NULL, ${normalized.txCode},
            ${code.name}, ${creditAmount}, ${normalized.quantity}::numeric(10,3),
            ${folio.business_date}::date, ${folio.currency}::char(3)
          )
      `;

      const payload = eventPayload(
        journal.id,
        normalized,
        folio.account_id,
        route.credit_account_id,
      );
      const fact = await recordFact(commandTx, {
        entityType: "journal",
        entityId: journal.id,
        envelope: normalized.envelope,
        payload,
      });
      if (fact.businessDate !== folio.business_date) {
        throw new Error("Audit and journal business dates diverged");
      }
      await this.#events.publish(commandTx, {
        tenantId: normalized.tenantId,
        propertyNode: folio.property_node,
        businessDate: folio.business_date,
        aggregateType: "journal",
        aggregateId: journal.id,
        eventType: "journal.posted",
        actorId: normalized.envelope.actorId,
        correlationId: normalized.envelope.requestId,
        payload,
      });

      return {
        status: 201,
        body: Object.freeze({
          journalId: journal.id,
          folioId: normalized.folioId,
          businessDate: folio.business_date,
          currency: folio.currency,
          txCode: normalized.txCode,
          amountMinor: normalized.amountMinor,
          quantity: normalized.quantity,
        }),
      };
      });
    } catch (error) {
      const state = (error as { errno?: string; code?: string }).errno ??
        (error as { errno?: string; code?: string }).code;
      if (state === "P0011") {
        throw new ChargeConflictError("Property business day is missing or sealed");
      }
      throw error;
    }

    return Object.freeze({ ...outcome.body, replayed: outcome.replayed });
  }
}
