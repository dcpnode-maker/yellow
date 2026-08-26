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
const INVISIBLE_REASON = /[\u200b-\u200d\u202a-\u202e\u2060\u2066-\u2069\ufeff]/u;
const MAX_REASON_LENGTH = 500;

export interface ReverseChargeInput {
  readonly tenantId: string;
  readonly folioId: string;
  readonly reversesJournalId: string;
  readonly reason: string;
  readonly postSealAuthorized: boolean;
  readonly idempotencyKey: string;
  readonly envelope: AuditEnvelope;
}

export interface ReverseChargeResult {
  readonly journalId: string;
  readonly folioId: string;
  readonly reversesJournalId: string;
  readonly businessDate: string;
  readonly currency: string;
  readonly amountMinor: string;
  readonly replayed: boolean;
}

export interface ChargeCorrectionServiceOptions {
  readonly events: EventBus;
  readonly idempotency: PostgresIdempotency;
}

interface NormalizedCorrection {
  readonly tenantId: string;
  readonly folioId: string;
  readonly reversesJournalId: string;
  readonly reason: string;
  readonly postSealAuthorized: boolean;
  readonly idempotencyKey: string;
  readonly envelope: AuditEnvelope;
}

interface FolioContextRow {
  readonly folio_id: string;
  readonly folio_status: string;
  readonly account_id: string;
  readonly account_status: string;
  readonly account_role: string;
  readonly property_node: string;
  readonly currency: string;
  readonly business_date: string;
  readonly sealed_at: Date | null;
}

interface OriginalJournalRow {
  readonly id: string;
  readonly kind: string;
  readonly property_node: string;
  readonly currency: string;
  readonly reverses: string | null;
  readonly source_interface: string | null;
  readonly source_governed: boolean;
  readonly business_date: string;
}

interface OriginalLineRow {
  readonly seq: number;
  readonly account_id: string;
  readonly folio_id: string | null;
  readonly tx_code: string;
  readonly description: string | null;
  readonly amount_minor: string;
  readonly quantity: string;
  readonly tax_detail: unknown;
  readonly business_date: string;
  readonly currency: string;
  readonly account_role: string;
  readonly account_property_node: string | null;
  readonly account_currency: string;
}

interface CorrectionBody extends Readonly<Record<string, JsonValue>> {
  readonly journalId: string;
  readonly folioId: string;
  readonly reversesJournalId: string;
  readonly businessDate: string;
  readonly currency: string;
  readonly amountMinor: string;
}

export class ChargeCorrectionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChargeCorrectionValidationError";
  }
}

export class ChargeCorrectionNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChargeCorrectionNotFoundError";
  }
}

export class ChargeCorrectionConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChargeCorrectionConflictError";
  }
}

export class ChargeCorrectionAuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChargeCorrectionAuthorizationError";
  }
}

function requirePlainRecord(name: string, value: unknown): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ChargeCorrectionValidationError(`${name} must be an object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new ChargeCorrectionValidationError(`${name} must be a plain object`);
  }
  if (Object.getOwnPropertySymbols(value).length > 0) {
    throw new ChargeCorrectionValidationError(`${name} must not contain symbol fields`);
  }
}

function requireExactKeys(name: string, value: Record<string, unknown>, allowed: readonly string[]): void {
  const allowedKeys = new Set(allowed);
  const unsupported = Object.getOwnPropertyNames(value).filter((key) => !allowedKeys.has(key)).sort();
  if (unsupported.length > 0) {
    throw new ChargeCorrectionValidationError(`${name} contains unsupported fields: ${unsupported.join(", ")}`);
  }
}

function requireUuid(name: string, value: unknown): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new ChargeCorrectionValidationError(`${name} must be a lowercase UUID`);
  }
  return value;
}

function normalize(input: ReverseChargeInput): NormalizedCorrection {
  requirePlainRecord("Correction input", input);
  requireExactKeys("Correction input", input, [
    "tenantId", "folioId", "reversesJournalId", "reason", "postSealAuthorized",
    "idempotencyKey", "envelope",
  ]);
  requirePlainRecord("envelope", input.envelope);
  requireExactKeys("envelope", input.envelope, [
    "actorId", "tenantId", "propertyNode", "requestId", "operation",
  ]);
  const tenantId = requireUuid("tenantId", input.tenantId);
  if (requireUuid("envelope.tenantId", input.envelope.tenantId) !== tenantId) {
    throw new ChargeCorrectionValidationError("tenantId must match the audit envelope tenant");
  }
  requireUuid("envelope.actorId", input.envelope.actorId);
  requireUuid("envelope.propertyNode", input.envelope.propertyNode);
  requireUuid("envelope.requestId", input.envelope.requestId);
  if (input.envelope.operation !== "journal.posted") {
    throw new ChargeCorrectionValidationError("audit operation must be journal.posted");
  }
  if (typeof input.reason !== "string" || input.reason.length < 1 || input.reason.length > MAX_REASON_LENGTH ||
      input.reason.trim() !== input.reason || /[\u0000-\u001f\u007f]/.test(input.reason) ||
      INVISIBLE_REASON.test(input.reason)) {
    throw new ChargeCorrectionValidationError("reason must be trimmed visible text of 1 to 500 characters");
  }
  if (typeof input.postSealAuthorized !== "boolean") {
    throw new ChargeCorrectionValidationError("postSealAuthorized must be server-derived boolean authority");
  }
  if (typeof input.idempotencyKey !== "string" || !IDEMPOTENCY_KEY.test(input.idempotencyKey)) {
    throw new ChargeCorrectionValidationError("idempotencyKey must contain 8-200 visible ASCII characters");
  }
  return Object.freeze({
    tenantId,
    folioId: requireUuid("folioId", input.folioId),
    reversesJournalId: requireUuid("reversesJournalId", input.reversesJournalId),
    reason: input.reason,
    postSealAuthorized: input.postSealAuthorized,
    idempotencyKey: input.idempotencyKey,
    envelope: input.envelope,
  });
}

function correctionPayload(
  journalId: string,
  input: NormalizedCorrection,
  lines: readonly OriginalLineRow[],
): Readonly<Record<string, JsonValue>> {
  return Object.freeze({
    journal_id: journalId,
    kind: "adjustment",
    reverses_journal_id: input.reversesJournalId,
    lines: Object.freeze(lines.map((line) => Object.freeze({
      account: line.account_id,
      ...(line.folio_id === null ? {} : { folio: line.folio_id }),
      tx_code: line.tx_code,
      amount_minor: (-BigInt(line.amount_minor)).toString(),
    }))),
  });
}

export class ChargeCorrectionService {
  readonly #events: EventBus;
  readonly #idempotency: PostgresIdempotency;

  constructor(options: ChargeCorrectionServiceOptions) {
    this.#events = options.events;
    this.#idempotency = options.idempotency;
  }

  async reverseCharge(tx: Tx, input: ReverseChargeInput): Promise<ReverseChargeResult> {
    const normalized = normalize(input);
    try {
      const outcome = await this.#idempotency.execute<CorrectionBody>(tx, {
        tenantId: normalized.tenantId,
        operation: "financials.charge.reverse",
        key: normalized.idempotencyKey,
        request: {
          actorId: normalized.envelope.actorId,
          propertyNode: normalized.envelope.propertyNode,
          folioId: normalized.folioId,
          reversesJournalId: normalized.reversesJournalId,
          reason: normalized.reason,
          postSealAuthorized: normalized.postSealAuthorized,
        },
      }, async (commandTx) => {
        const folio = (await commandTx<FolioContextRow[]>`
          SELECT folio.id AS folio_id, folio.status AS folio_status,
                 account.id AS account_id, account.status AS account_status,
                 account.role AS account_role, account.property_node,
                 account.currency::text,
                 (transaction_timestamp() AT TIME ZONE property.timezone)::date::text AS business_date,
                 day.sealed_at
            FROM folio
            JOIN account ON account.tenant_id = folio.tenant_id AND account.id = folio.account_id
            JOIN org_node AS property ON property.tenant_id = account.tenant_id
             AND property.id = account.property_node AND property.kind = 'property'
            LEFT JOIN business_day AS day ON day.tenant_id = folio.tenant_id
             AND day.property_node = property.id
             AND day.business_date = (transaction_timestamp() AT TIME ZONE property.timezone)::date
           WHERE folio.tenant_id = ${normalized.tenantId}::uuid
             AND folio.tenant_id = current_setting('app.tenant_id', true)::uuid
             AND folio.id = ${normalized.folioId}::uuid
        `)[0];
        if (!folio || folio.property_node !== normalized.envelope.propertyNode) {
          throw new ChargeCorrectionNotFoundError("Folio was not found in the audit property");
        }
        if (folio.folio_status !== "open" || folio.account_status !== "open" ||
            folio.account_role !== "guest") {
          throw new ChargeCorrectionConflictError("Folio financial ownership is not open");
        }

        const original = (await commandTx<OriginalJournalRow[]>`
          SELECT header.id, header.kind, header.property_node, header.currency::text,
                 header.reverses, header.source->>'interface' AS source_interface,
                 header.source = '{"interface":"financials.charge.post"}'::jsonb AS source_governed,
                 header.business_date::text
            FROM journal AS header
           WHERE header.tenant_id = ${normalized.tenantId}::uuid
             AND header.tenant_id = current_setting('app.tenant_id', true)::uuid
             AND header.id = ${normalized.reversesJournalId}::uuid
        `)[0];
        if (!original || original.property_node !== folio.property_node || original.currency !== folio.currency) {
          throw new ChargeCorrectionNotFoundError("Original charge was not found in the folio property");
        }

        const discoveredLines = await commandTx<OriginalLineRow[]>`
          SELECT line.seq::int, line.account_id, line.folio_id, line.tx_code,
                 line.description, line.amount_minor::text, line.quantity::text, line.tax_detail,
                 line.business_date::text, line.currency::text,
                 account.role AS account_role, account.property_node AS account_property_node,
                 account.currency::text AS account_currency
            FROM posting_line AS line
            JOIN account ON account.tenant_id = line.tenant_id AND account.id = line.account_id
           WHERE line.tenant_id = ${normalized.tenantId}::uuid
             AND line.tenant_id = current_setting('app.tenant_id', true)::uuid
             AND line.journal_id = ${normalized.reversesJournalId}::uuid
           ORDER BY line.seq
        `;
        const accountIds = [...new Set(discoveredLines.map((line) => line.account_id))].sort();
        if (accountIds.length !== 2 || !accountIds[0] || !accountIds[1] ||
            !accountIds.includes(folio.account_id)) {
          throw new ChargeCorrectionConflictError("Original charge posting set is inconsistent");
        }
        await commandTx`
          SELECT public.lock_financial_rows(
            ${normalized.tenantId}::uuid,
            ARRAY[${accountIds[0]}::uuid, ${accountIds[1]}::uuid]::uuid[],
            ${normalized.folioId}::uuid
          )
        `;
        const lockedFolio = (await commandTx<FolioContextRow[]>`
          SELECT folio.id AS folio_id, folio.status AS folio_status,
                 account.id AS account_id, account.status AS account_status,
                 account.role AS account_role, account.property_node,
                 account.currency::text,
                 (transaction_timestamp() AT TIME ZONE property.timezone)::date::text AS business_date,
                 day.sealed_at
            FROM folio
            JOIN account ON account.tenant_id = folio.tenant_id AND account.id = folio.account_id
            JOIN org_node AS property ON property.tenant_id = account.tenant_id
             AND property.id = account.property_node AND property.kind = 'property'
            LEFT JOIN business_day AS day ON day.tenant_id = folio.tenant_id
             AND day.property_node = property.id
             AND day.business_date = (transaction_timestamp() AT TIME ZONE property.timezone)::date
           WHERE folio.tenant_id = ${normalized.tenantId}::uuid
             AND folio.tenant_id = current_setting('app.tenant_id', true)::uuid
             AND folio.id = ${normalized.folioId}::uuid
        `)[0];
        if (!lockedFolio || lockedFolio.property_node !== normalized.envelope.propertyNode) {
          throw new ChargeCorrectionNotFoundError("Folio was not found in the audit property after lock acquisition");
        }
        if (lockedFolio.folio_status !== "open" || lockedFolio.account_status !== "open" ||
            lockedFolio.account_role !== "guest" || lockedFolio.account_id !== folio.account_id ||
            lockedFolio.property_node !== folio.property_node || lockedFolio.currency !== folio.currency ||
            !accountIds.includes(lockedFolio.account_id)) {
          throw new ChargeCorrectionConflictError("Locked folio financial ownership is inconsistent or frozen");
        }
        await commandTx`
          SELECT pg_catalog.pg_advisory_xact_lock(
            pg_catalog.hashtextextended(
              ${`${normalized.tenantId}:${normalized.reversesJournalId}`}, 0
            )
          )
        `;

        const lockedOriginal = (await commandTx<OriginalJournalRow[]>`
          SELECT header.id, header.kind, header.property_node, header.currency::text,
                 header.reverses, header.source->>'interface' AS source_interface,
                 header.source = '{"interface":"financials.charge.post"}'::jsonb AS source_governed,
                 header.business_date::text
            FROM journal AS header
           WHERE header.tenant_id = ${normalized.tenantId}::uuid
             AND header.tenant_id = current_setting('app.tenant_id', true)::uuid
             AND header.id = ${normalized.reversesJournalId}::uuid
        `)[0];
        if (!lockedOriginal || lockedOriginal.property_node !== lockedFolio.property_node ||
            lockedOriginal.currency !== lockedFolio.currency) {
          throw new ChargeCorrectionNotFoundError("Original charge was not found in the folio property");
        }
        if (lockedOriginal.kind !== "charge" || lockedOriginal.reverses !== null ||
            lockedOriginal.source_interface !== "financials.charge.post" || !lockedOriginal.source_governed) {
          throw new ChargeCorrectionConflictError("Journal is not an eligible governed charge");
        }
        const existing = await commandTx<Array<{ id: string }>>`
          SELECT id FROM journal
           WHERE tenant_id = ${normalized.tenantId}::uuid
             AND tenant_id = current_setting('app.tenant_id', true)::uuid
             AND reverses = ${normalized.reversesJournalId}::uuid
           ORDER BY id
        `;
        if (existing.length > 0) {
          throw new ChargeCorrectionConflictError("Charge already has a correction");
        }

        const lines = await commandTx<OriginalLineRow[]>`
          SELECT line.seq::int, line.account_id, line.folio_id, line.tx_code,
                 line.description, line.amount_minor::text, line.quantity::text, line.tax_detail,
                 line.business_date::text, line.currency::text,
                 account.role AS account_role, account.property_node AS account_property_node,
                 account.currency::text AS account_currency
            FROM posting_line AS line
            JOIN account ON account.tenant_id = line.tenant_id AND account.id = line.account_id
           WHERE line.tenant_id = ${normalized.tenantId}::uuid
             AND line.tenant_id = current_setting('app.tenant_id', true)::uuid
             AND line.journal_id = ${normalized.reversesJournalId}::uuid
           ORDER BY line.seq
        `;
        const guestLine = lines[0];
        const revenueLine = lines[1];
        const guestAmount = guestLine ? BigInt(guestLine.amount_minor) : 0n;
        const revenueAmount = revenueLine ? BigInt(revenueLine.amount_minor) : 0n;
        const canonicalPair = guestLine !== undefined && revenueLine !== undefined &&
          guestLine.seq === 1 && revenueLine.seq === 2 &&
          guestLine.account_id === lockedFolio.account_id && guestLine.folio_id === normalized.folioId &&
          guestLine.account_role === "guest" && guestLine.account_property_node === lockedFolio.property_node &&
          guestLine.account_currency === lockedFolio.currency && guestAmount > 0n &&
          revenueLine.account_id !== guestLine.account_id && revenueLine.folio_id === null &&
          revenueLine.account_role === "revenue" && revenueLine.account_property_node === lockedFolio.property_node &&
          revenueLine.account_currency === lockedFolio.currency && revenueAmount === -guestAmount &&
          guestLine.tx_code === revenueLine.tx_code && guestLine.quantity === revenueLine.quantity &&
          guestLine.description === revenueLine.description &&
          guestLine.business_date === lockedOriginal.business_date &&
          revenueLine.business_date === lockedOriginal.business_date &&
          guestLine.currency === lockedOriginal.currency && revenueLine.currency === lockedOriginal.currency;
        const lineAccounts = [...new Set(lines.map((line) => line.account_id))].sort();
        const balanced = lines.reduce((sum, line) => sum + BigInt(line.amount_minor), 0n) === 0n;
        if (lines.length !== 2 || !canonicalPair || lines.some((line) => line.tax_detail !== null) ||
            lineAccounts.length !== accountIds.length ||
            lineAccounts.some((account, index) => account !== accountIds[index]) || !balanced) {
          throw new ChargeCorrectionConflictError("Original charge posting set is incomplete or inconsistent");
        }

        const requiredDateValues = [...new Set([
          lockedOriginal.business_date,
          lockedFolio.business_date,
        ])].sort();
        if (requiredDateValues.length === 1) {
          await commandTx`
            SELECT public.lock_financial_business_days(
              ${normalized.tenantId}::uuid,
              ${lockedFolio.property_node}::uuid,
              ARRAY[${requiredDateValues[0]}::date]::date[]
            )
          `;
        } else {
          await commandTx`
            SELECT public.lock_financial_business_days(
              ${normalized.tenantId}::uuid,
              ${lockedFolio.property_node}::uuid,
              ARRAY[${requiredDateValues[0]}::date, ${requiredDateValues[1]}::date]::date[]
            )
          `;
        }
        const requiredDays = await commandTx<Array<{ business_date: string; sealed_at: Date | null }>>`
          SELECT business_date::text, sealed_at FROM business_day
           WHERE tenant_id = ${normalized.tenantId}::uuid
             AND tenant_id = current_setting('app.tenant_id', true)::uuid
             AND property_node = ${lockedFolio.property_node}::uuid
             AND business_date = ANY (
               ARRAY[${lockedOriginal.business_date}::date, ${lockedFolio.business_date}::date]::date[]
             )
           ORDER BY business_date
        `;
        const expectedDates = new Set(requiredDateValues);
        if (requiredDays.length !== requiredDateValues.length ||
            requiredDays.some((day) => !expectedDates.has(day.business_date))) {
          throw new ChargeCorrectionConflictError("Required property business day is missing");
        }
        if (requiredDays.some((day) => day.sealed_at !== null) && !normalized.postSealAuthorized) {
          throw new ChargeCorrectionAuthorizationError("Post-seal correction authority is required");
        }

        const correction = (await commandTx<Array<{ id: string }>>`
          SELECT public.create_charge_correction_header(
            ${normalized.tenantId}::uuid,
            ${normalized.reversesJournalId}::uuid,
            ${lockedFolio.property_node}::uuid,
            ${lockedFolio.currency}::char(3),
            ${normalized.reason},
            ${normalized.envelope.actorId}::uuid
          ) AS id
        `)[0];
        if (!correction) throw new Error("PostgreSQL did not return the correction journal");

        for (const line of lines) {
          await commandTx`
            INSERT INTO posting_line (
              tenant_id, journal_id, seq, account_id, folio_id, tx_code,
              description, amount_minor, quantity, business_date, currency
            ) VALUES (
              ${normalized.tenantId}::uuid, ${correction.id}::uuid, ${line.seq}::smallint,
              ${line.account_id}::uuid, ${line.folio_id}::uuid, ${line.tx_code},
              ${line.description}, ${-BigInt(line.amount_minor)}, ${line.quantity}::numeric(10,3),
              ${lockedFolio.business_date}::date, ${lockedFolio.currency}::char(3)
            )
          `;
        }

        const payload = correctionPayload(correction.id, normalized, lines);
        const fact = await recordFact(commandTx, {
          entityType: "journal",
          entityId: correction.id,
          envelope: normalized.envelope,
          payload,
        });
        if (fact.businessDate !== lockedFolio.business_date) {
          throw new Error("Audit and correction business dates diverged");
        }
        await this.#events.publish(commandTx, {
          tenantId: normalized.tenantId,
          propertyNode: lockedFolio.property_node,
          businessDate: lockedFolio.business_date,
          aggregateType: "journal",
          aggregateId: correction.id,
          eventType: "journal.posted",
          actorId: normalized.envelope.actorId,
          correlationId: normalized.envelope.requestId,
          payload,
        });

        return {
          status: 201,
          body: Object.freeze({
            journalId: correction.id,
            folioId: normalized.folioId,
            reversesJournalId: normalized.reversesJournalId,
            businessDate: lockedFolio.business_date,
            currency: lockedFolio.currency,
            amountMinor: (-guestAmount).toString(),
          }),
        };
      });
      return Object.freeze({ ...outcome.body, replayed: outcome.replayed });
    } catch (error) {
      const state = (error as { errno?: string; code?: string }).errno ??
        (error as { errno?: string; code?: string }).code;
      if (state === "23505") {
        throw new ChargeCorrectionConflictError("Charge already has a correction");
      }
      throw error;
    }
  }
}
