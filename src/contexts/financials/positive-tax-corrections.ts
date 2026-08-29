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
const IDEMPOTENCY_OPERATION = "financials.positive-tax.reverse";

export interface PositiveTaxCorrectionInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly reversesJournalId: string;
  readonly reason: string;
  readonly postSealAuthorized: boolean;
  readonly idempotencyKey: string;
  readonly envelope: AuditEnvelope;
}

export interface PositiveTaxCorrectionResult {
  readonly state: "reversed";
  readonly journalId: string;
  readonly reversesJournalId: string;
  readonly postingBindingId: string;
  readonly lineageId: string;
  readonly holdBindingId: string;
  readonly attributionId: string;
  readonly reservationId: string;
  readonly segmentId: string;
  readonly folioId: string;
  readonly businessDate: string;
  readonly currency: string;
  readonly grandTotalMinor: string;
  readonly lineCount: number;
  readonly created: boolean;
  readonly replayed: boolean;
}

export interface PositiveTaxCorrectionServiceOptions {
  readonly events: EventBus;
  readonly idempotency: PostgresIdempotency;
}

interface NormalizedInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly reversesJournalId: string;
  readonly reason: string;
  readonly postSealAuthorized: boolean;
  readonly idempotencyKey: string;
  readonly envelope: AuditEnvelope;
}

interface OriginalContextRow {
  readonly original_journal_id: string;
  readonly original_posting_binding_id: string;
  readonly lineage_id: string;
  readonly hold_binding_id: string;
  readonly attribution_id: string;
  readonly reservation_id: string;
  readonly segment_id: string;
  readonly folio_id: string;
  readonly guest_account_id: string;
  readonly property_node: string;
  readonly original_business_date: string;
  readonly current_business_date: string;
  readonly currency: string;
  readonly origin_quote_hash: string;
  readonly snapshot_hash: string;
  readonly source_governed: boolean;
  readonly attribution_eligible: boolean;
}

interface PostingLineRow {
  readonly seq: number;
  readonly account_id: string;
  readonly folio_id: string | null;
  readonly tx_code: string;
  readonly description: string | null;
  readonly amount_minor: string;
  readonly quantity: string;
  readonly tax_detail: unknown;
  readonly folio_transfer_root_line_id: string | null;
  readonly business_date: string;
  readonly currency: string;
  readonly account_role: string;
  readonly account_status: string;
  readonly account_property_node: string | null;
  readonly account_currency: string;
}

interface ExistingHeaderRow {
  readonly journal_id: string;
  readonly property_node: string;
  readonly business_date: string;
  readonly currency: string;
  readonly description: string | null;
  readonly created_by: string | null;
  readonly source_governed: boolean;
}

interface DayRow {
  readonly business_date: string;
  readonly sealed_at: Date | null;
}

interface HeaderRow {
  readonly journal_id: string;
  readonly business_date: string;
  readonly currency: string;
}

interface RootBindingRow {
  readonly posting_binding_id: string;
  readonly lineage_id: string;
  readonly hold_binding_id: string;
  readonly attribution_id: string;
  readonly reservation_id: string;
  readonly segment_id: string;
  readonly folio_id: string;
  readonly journal_id: string;
  readonly origin_quote_hash: string;
  readonly snapshot_hash: string;
  readonly business_date: string;
  readonly currency: string;
  readonly line_count: number;
}

interface CorrectionBody extends Readonly<Record<string, JsonValue>> {
  readonly state: "reversed";
  readonly journalId: string;
  readonly reversesJournalId: string;
  readonly postingBindingId: string;
  readonly lineageId: string;
  readonly holdBindingId: string;
  readonly attributionId: string;
  readonly reservationId: string;
  readonly segmentId: string;
  readonly folioId: string;
  readonly businessDate: string;
  readonly currency: string;
  readonly grandTotalMinor: string;
  readonly lineCount: number;
  readonly created: boolean;
}

interface OriginalEvidence {
  readonly context: OriginalContextRow;
  readonly lines: readonly PostingLineRow[];
  readonly accountIds: readonly string[];
}

export class PositiveTaxCorrectionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PositiveTaxCorrectionValidationError";
  }
}

export class PositiveTaxCorrectionNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PositiveTaxCorrectionNotFoundError";
  }
}

export class PositiveTaxCorrectionConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PositiveTaxCorrectionConflictError";
  }
}

export class PositiveTaxCorrectionAuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PositiveTaxCorrectionAuthorizationError";
  }
}

function plainRecord(
  name: string,
  value: unknown,
): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new PositiveTaxCorrectionValidationError(`${name} must be an object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new PositiveTaxCorrectionValidationError(`${name} must be a plain object`);
  }
  if (Object.getOwnPropertySymbols(value).length > 0) {
    throw new PositiveTaxCorrectionValidationError(`${name} must not contain symbol fields`);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Object.values(descriptors).some(({ get, set }) => get !== undefined || set !== undefined)) {
    throw new PositiveTaxCorrectionValidationError(`${name} must not contain accessor fields`);
  }
}

function exactKeys(
  name: string,
  value: Record<string, unknown>,
  allowed: readonly string[],
): void {
  const accepted = new Set(allowed);
  const unsupported = Object.getOwnPropertyNames(value)
    .filter((key) => !accepted.has(key))
    .sort();
  if (unsupported.length > 0) {
    throw new PositiveTaxCorrectionValidationError(
      `${name} contains unsupported fields: ${unsupported.join(", ")}`,
    );
  }
}

function uuid(name: string, value: unknown): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new PositiveTaxCorrectionValidationError(`${name} must be a lowercase UUID`);
  }
  return value;
}

function normalize(input: PositiveTaxCorrectionInput): NormalizedInput {
  plainRecord("Positive-tax correction input", input);
  exactKeys("Positive-tax correction input", input, [
    "tenantId", "propertyNode", "reversesJournalId", "reason",
    "postSealAuthorized", "idempotencyKey", "envelope",
  ]);
  plainRecord("envelope", input.envelope);
  exactKeys("envelope", input.envelope, [
    "actorId", "tenantId", "propertyNode", "requestId", "operation",
  ]);
  const tenantId = uuid("tenantId", input.tenantId);
  const propertyNode = uuid("propertyNode", input.propertyNode);
  if (uuid("envelope.tenantId", input.envelope.tenantId) !== tenantId ||
      uuid("envelope.propertyNode", input.envelope.propertyNode) !== propertyNode) {
    throw new PositiveTaxCorrectionValidationError(
      "Correction identity must match the audit envelope tenant and property",
    );
  }
  uuid("envelope.actorId", input.envelope.actorId);
  uuid("envelope.requestId", input.envelope.requestId);
  if (input.envelope.operation !== "journal.posted") {
    throw new PositiveTaxCorrectionValidationError("audit operation must be journal.posted");
  }
  if (typeof input.reason !== "string" || input.reason.length < 1 ||
      input.reason.length > MAX_REASON_LENGTH || input.reason.trim() !== input.reason ||
      /[\u0000-\u001f\u007f]/.test(input.reason) || INVISIBLE_REASON.test(input.reason)) {
    throw new PositiveTaxCorrectionValidationError(
      "reason must be trimmed visible text of 1 to 500 characters",
    );
  }
  if (typeof input.postSealAuthorized !== "boolean") {
    throw new PositiveTaxCorrectionValidationError(
      "postSealAuthorized must be server-derived boolean authority",
    );
  }
  if (typeof input.idempotencyKey !== "string" || !IDEMPOTENCY_KEY.test(input.idempotencyKey)) {
    throw new PositiveTaxCorrectionValidationError(
      "idempotencyKey must contain 8-200 visible ASCII characters",
    );
  }
  return Object.freeze({
    tenantId,
    propertyNode,
    reversesJournalId: uuid("reversesJournalId", input.reversesJournalId),
    reason: input.reason,
    postSealAuthorized: input.postSealAuthorized,
    idempotencyKey: input.idempotencyKey,
    envelope: Object.freeze({ ...input.envelope }),
  });
}

function record(value: unknown): Readonly<Record<string, unknown>> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  return value as Readonly<Record<string, unknown>>;
}

function stringField(
  value: Readonly<Record<string, unknown>> | undefined,
  key: string,
): string | undefined {
  const field = value?.[key];
  return typeof field === "string" ? field : undefined;
}

function canonicalOriginal(evidence: OriginalEvidence): string {
  return JSON.stringify({
    context: evidence.context,
    lines: evidence.lines.map((line) => ({
      ...line,
      tax_detail: line.tax_detail,
    })),
    accountIds: evidence.accountIds,
  });
}

function validateOriginal(
  context: OriginalContextRow,
  lines: readonly PostingLineRow[],
): OriginalEvidence {
  if (!context.source_governed || !context.attribution_eligible) {
    throw new PositiveTaxCorrectionConflictError(
      "Journal is not an eligible governed positive-tax posting",
    );
  }
  if (lines.length < 3 || lines.length > 66) {
    throw new PositiveTaxCorrectionConflictError(
      "Positive-tax posting set is incomplete or outside the bounded shape",
    );
  }
  let balance = 0n;
  for (const [index, line] of lines.entries()) {
    if (line.seq !== index + 1 || line.business_date !== context.original_business_date ||
        line.currency !== context.currency || line.account_status !== "open" ||
        line.account_property_node !== context.property_node ||
        line.account_currency !== context.currency || line.description === null ||
        line.folio_transfer_root_line_id !== null) {
      throw new PositiveTaxCorrectionConflictError(
        "Positive-tax posting lines are incomplete or inconsistent",
      );
    }
    balance += BigInt(line.amount_minor);
  }
  const root = lines[0];
  const revenue = lines[1];
  if (!root || !revenue || root.account_id !== context.guest_account_id ||
      root.folio_id !== context.folio_id || root.account_role !== "guest" ||
      BigInt(root.amount_minor) <= 0n || root.tax_detail === null ||
      revenue.folio_id !== null || revenue.account_role !== "revenue" ||
      BigInt(revenue.amount_minor) >= 0n || revenue.tax_detail !== null ||
      lines.slice(2).some((line) => line.folio_id !== null ||
        line.account_role !== "tax_payable" || BigInt(line.amount_minor) >= 0n ||
        line.tax_detail !== null) || balance !== 0n) {
    throw new PositiveTaxCorrectionConflictError(
      "Positive-tax posting topology is incomplete or unbalanced",
    );
  }

  const detail = record(root.tax_detail);
  const lineage = record(detail?.lineage);
  const quote = record(detail?.quote);
  const routes = record(detail?.routes);
  const revenueRoute = record(routes?.revenue);
  const taxRoutes = Array.isArray(routes?.taxes) ? routes.taxes : undefined;
  const totals = record(detail?.totals);
  const taxEvidence = Array.isArray(detail?.taxes) ? detail.taxes : undefined;
  const baseMinor = -BigInt(revenue.amount_minor);
  const taxMinor = lines.slice(2).reduce(
    (sum, line) => sum - BigInt(line.amount_minor),
    0n,
  );
  const grandMinor = BigInt(root.amount_minor);
  if (detail?.schemaVersion !== 1 ||
      stringField(lineage, "journalId") !== context.original_journal_id ||
      stringField(lineage, "lineageId") !== context.lineage_id ||
      stringField(lineage, "holdBindingId") !== context.hold_binding_id ||
      stringField(lineage, "attributionId") !== context.attribution_id ||
      stringField(lineage, "reservationId") !== context.reservation_id ||
      stringField(lineage, "segmentId") !== context.segment_id ||
      stringField(lineage, "folioId") !== context.folio_id ||
      stringField(quote, "originQuoteHash") !== context.origin_quote_hash ||
      stringField(quote, "snapshotHash") !== context.snapshot_hash ||
      stringField(quote, "currency") !== context.currency ||
      root.tx_code !== revenue.tx_code ||
      stringField(revenueRoute, "creditAccountId") !== revenue.account_id ||
      stringField(revenueRoute, "txCode") !== revenue.tx_code ||
      stringField(totals, "baseMinor") !== baseMinor.toString() ||
      stringField(totals, "taxMinor") !== taxMinor.toString() ||
      stringField(totals, "grandMinor") !== grandMinor.toString() ||
      grandMinor !== baseMinor + taxMinor || !taxEvidence ||
      !taxRoutes || taxRoutes.length !== lines.length - 2) {
    throw new PositiveTaxCorrectionConflictError(
      "Positive-tax root lineage or frozen route evidence is inconsistent",
    );
  }
  let previousTaxIndex = -1n;
  for (const [index, line] of lines.slice(2).entries()) {
    const route = record(taxRoutes[index]);
    const taxIndexText = stringField(route, "taxIndex");
    const taxIndex = taxIndexText !== undefined && /^[0-9]+$/.test(taxIndexText)
      ? BigInt(taxIndexText)
      : undefined;
    const tax = taxIndex !== undefined && taxIndex <= BigInt(Number.MAX_SAFE_INTEGER)
      ? record(taxEvidence[Number(taxIndex)])
      : undefined;
    if (taxIndex === undefined || taxIndex <= previousTaxIndex ||
        stringField(route, "creditAccountId") !== line.account_id ||
        stringField(route, "txCode") !== line.tx_code ||
        stringField(tax, "index") !== taxIndexText ||
        stringField(route, "taxCode") !== stringField(tax, "code") ||
        stringField(tax, "taxMinor") !== (-BigInt(line.amount_minor)).toString()) {
      throw new PositiveTaxCorrectionConflictError(
        "Positive-tax frozen tax route evidence is inconsistent",
      );
    }
    previousTaxIndex = taxIndex;
  }
  const accountIds = [...new Set(lines.map((line) => line.account_id))].sort();
  if (accountIds.length < 2 || accountIds.length > 66) {
    throw new PositiveTaxCorrectionConflictError("Positive-tax account set is invalid");
  }
  return Object.freeze({
    context: Object.freeze({ ...context }),
    lines: Object.freeze(lines.map((line) => Object.freeze({ ...line }))),
    accountIds: Object.freeze(accountIds),
  });
}

async function readOriginal(
  tx: Tx,
  input: NormalizedInput,
): Promise<OriginalEvidence> {
  const context = (await tx<OriginalContextRow[]>`
    SELECT original.id::text AS original_journal_id,
           binding.id::text AS original_posting_binding_id,
           binding.lineage_id::text,
           binding.hold_binding_id::text,
           binding.attribution_id::text,
           binding.reservation_id::text,
           binding.segment_id::text,
           binding.folio_id::text,
           binding.guest_account_id::text,
           original.property_node::text,
           original.business_date::text AS original_business_date,
           (transaction_timestamp() AT TIME ZONE property.timezone)::date::text
             AS current_business_date,
           original.currency::text,
           binding.origin_quote_hash,
           binding.snapshot_hash,
           original.source = jsonb_build_object(
             'interface','financials.positive-tax.post',
             'lineage_id',binding.lineage_id::text
           ) AND original.kind='charge' AND original.reverses IS NULL
             AS source_governed,
           snapshot.origin_kind='rate_quote'
             AND snapshot.snapshot #>> '{evaluation,rounding}'='line'
             AND snapshot.snapshot #>> '{evaluation,country}' IS DISTINCT FROM 'IN'
             AND snapshot.snapshot #>> '{evaluation,grandTotalMinor}' ~ '^[1-9][0-9]*$'
             AND snapshot.snapshot #>> '{evaluation,taxTotalMinor}' ~ '^[1-9][0-9]*$'
             AND NOT EXISTS (
               SELECT 1 FROM jsonb_array_elements(snapshot.snapshot #> '{evaluation,taxes}') tax(value)
                WHERE tax.value ->> 'code' ~ '^GST(?:_|$)'
             ) AS attribution_eligible
      FROM tax_attribution_journal_binding AS binding
      JOIN journal AS original
        ON original.tenant_id=binding.tenant_id AND original.id=binding.journal_id
      JOIN tax_attribution_reservation_binding AS lineage
        ON lineage.tenant_id=binding.tenant_id AND lineage.id=binding.lineage_id
       AND lineage.property_node=binding.property_node
       AND lineage.binding_id=binding.hold_binding_id
       AND lineage.attribution_id=binding.attribution_id
       AND lineage.reservation_id=binding.reservation_id
       AND lineage.segment_id=binding.segment_id
       AND lineage.origin_quote_hash=binding.origin_quote_hash
       AND lineage.snapshot_hash=binding.snapshot_hash
       AND lineage.currency=binding.currency
      JOIN tax_attribution_snapshot AS snapshot
        ON snapshot.tenant_id=binding.tenant_id AND snapshot.id=binding.attribution_id
       AND snapshot.property_node=binding.property_node
       AND snapshot.origin_quote_hash=binding.origin_quote_hash
       AND snapshot.snapshot_hash=binding.snapshot_hash
       AND snapshot.currency=binding.currency
      JOIN org_node AS property
        ON property.tenant_id=binding.tenant_id AND property.id=binding.property_node
       AND property.kind='property' AND property.currency=binding.currency
     WHERE binding.tenant_id=${input.tenantId}::uuid
       AND binding.tenant_id=current_setting('app.tenant_id',true)::uuid
       AND binding.property_node=${input.propertyNode}::uuid
       AND binding.journal_id=${input.reversesJournalId}::uuid
       AND original.business_date=binding.business_date
       AND original.currency=binding.currency
  `)[0];
  if (!context) {
    throw new PositiveTaxCorrectionNotFoundError(
      "Governed positive-tax journal was not found in the audit property",
    );
  }
  const lines = await tx<PostingLineRow[]>`
    SELECT line.seq::int,line.account_id::text,line.folio_id::text,line.tx_code,
           line.description,line.amount_minor::text,line.quantity::text,line.tax_detail,
           line.folio_transfer_root_line_id::text,line.business_date::text,
           line.currency::text,account.role AS account_role,
           account.status AS account_status,account.property_node::text AS account_property_node,
           account.currency::text AS account_currency
      FROM posting_line AS line
      JOIN account ON account.tenant_id=line.tenant_id AND account.id=line.account_id
     WHERE line.tenant_id=${input.tenantId}::uuid
       AND line.tenant_id=current_setting('app.tenant_id',true)::uuid
       AND line.journal_id=${input.reversesJournalId}::uuid
     ORDER BY line.seq
  `;
  return validateOriginal(context, lines);
}

function body(
  journalId: string,
  input: NormalizedInput,
  original: OriginalEvidence,
  businessDate: string,
  created: boolean,
): CorrectionBody {
  const { context } = original;
  return Object.freeze({
    state: "reversed",
    journalId,
    reversesJournalId: input.reversesJournalId,
    postingBindingId: context.original_posting_binding_id,
    lineageId: context.lineage_id,
    holdBindingId: context.hold_binding_id,
    attributionId: context.attribution_id,
    reservationId: context.reservation_id,
    segmentId: context.segment_id,
    folioId: context.folio_id,
    businessDate,
    currency: context.currency,
    grandTotalMinor: (-BigInt(original.lines[0]!.amount_minor)).toString(),
    lineCount: original.lines.length,
    created,
  });
}

function receipt(value: CorrectionBody, replayed: boolean): PositiveTaxCorrectionResult {
  return Object.freeze({ ...value, replayed });
}

function journalPayload(
  journalId: string,
  input: NormalizedInput,
  original: OriginalEvidence,
): Readonly<Record<string, JsonValue>> {
  return Object.freeze({
    journal_id: journalId,
    kind: "adjustment",
    reverses_journal_id: input.reversesJournalId,
    original_posting_binding_id: original.context.original_posting_binding_id,
    lineage_id: original.context.lineage_id,
    reservation_id: original.context.reservation_id,
    folio_id: original.context.folio_id,
    lines: Object.freeze(original.lines.map((line) => Object.freeze({
      seq: line.seq,
      account: line.account_id,
      ...(line.folio_id === null ? {} : { folio: line.folio_id }),
      tx_code: line.tx_code,
      amount_minor: (-BigInt(line.amount_minor)).toString(),
    }))),
  });
}

function attributionPayload(
  binding: RootBindingRow,
  input: NormalizedInput,
): Readonly<Record<string, JsonValue>> {
  return Object.freeze({
    effect: "full_reversal",
    original_posting_binding_id: binding.posting_binding_id,
    original_journal_id: input.reversesJournalId,
    reversal_journal_id: binding.journal_id,
    lineage_id: binding.lineage_id,
    hold_binding_id: binding.hold_binding_id,
    attribution_id: binding.attribution_id,
    reservation_id: binding.reservation_id,
    segment_id: binding.segment_id,
    folio_id: binding.folio_id,
    origin_quote_hash: binding.origin_quote_hash,
    snapshot_hash: binding.snapshot_hash,
    currency: binding.currency,
  });
}

function validateExisting(
  header: ExistingHeaderRow,
  lines: readonly PostingLineRow[],
  input: NormalizedInput,
  original: OriginalEvidence,
): void {
  if (!header.source_governed || header.property_node !== input.propertyNode ||
      header.currency !== original.context.currency ||
      header.created_by !== input.envelope.actorId || header.description !== input.reason ||
      lines.length !== original.lines.length) {
    throw new PositiveTaxCorrectionConflictError(
      "Positive-tax journal already has a divergent correction",
    );
  }
  for (const [index, originalLine] of original.lines.entries()) {
    const reversed = lines[index];
    if (!reversed || reversed.seq !== originalLine.seq ||
        reversed.account_id !== originalLine.account_id ||
        reversed.folio_id !== originalLine.folio_id ||
        reversed.tx_code !== originalLine.tx_code ||
        reversed.description !== originalLine.description ||
        BigInt(reversed.amount_minor) !== -BigInt(originalLine.amount_minor) ||
        reversed.quantity !== originalLine.quantity ||
        reversed.folio_transfer_root_line_id !== originalLine.folio_transfer_root_line_id ||
        reversed.business_date !== header.business_date ||
        reversed.currency !== originalLine.currency) {
      throw new PositiveTaxCorrectionConflictError(
        "Existing positive-tax correction does not exactly nullify the original",
      );
    }
    if (index > 0 && JSON.stringify(reversed.tax_detail) !== JSON.stringify(originalLine.tax_detail)) {
      throw new PositiveTaxCorrectionConflictError(
        "Existing positive-tax correction changed non-root tax evidence",
      );
    }
  }
  const rootDetail = record(lines[0]?.tax_detail);
  const rootLineage = record(rootDetail?.lineage);
  if (rootDetail?.schemaVersion !== 2 || rootDetail.effect !== "full_reversal" ||
      stringField(rootLineage, "originalPostingBindingId") !==
        original.context.original_posting_binding_id ||
      stringField(rootLineage, "originalJournalId") !== input.reversesJournalId ||
      stringField(rootLineage, "reversalJournalId") !== header.journal_id ||
      JSON.stringify(rootDetail.originalTaxDetail) !== JSON.stringify(original.lines[0]?.tax_detail)) {
    throw new PositiveTaxCorrectionConflictError(
      "Existing positive-tax correction root evidence is inconsistent",
    );
  }
}

async function findExisting(
  tx: Tx,
  input: NormalizedInput,
  original: OriginalEvidence,
): Promise<void> {
  const header = (await tx<ExistingHeaderRow[]>`
    SELECT correction.id::text AS journal_id,correction.property_node::text,
           correction.business_date::text,correction.currency::text,
           correction.description,correction.created_by::text,
           correction.kind='adjustment'
             AND correction.source=jsonb_build_object(
               'interface','financials.positive-tax.reverse',
               'original_journal_id',${input.reversesJournalId}::text,
               'lineage_id',${original.context.lineage_id}::text
             ) AS source_governed
      FROM journal AS correction
     WHERE correction.tenant_id=${input.tenantId}::uuid
       AND correction.tenant_id=current_setting('app.tenant_id',true)::uuid
       AND correction.reverses=${input.reversesJournalId}::uuid
     ORDER BY correction.id
  `)[0];
  if (!header) return;
  const lines = await tx<PostingLineRow[]>`
    SELECT line.seq::int,line.account_id::text,line.folio_id::text,line.tx_code,
           line.description,line.amount_minor::text,line.quantity::text,line.tax_detail,
           line.folio_transfer_root_line_id::text,line.business_date::text,
           line.currency::text,account.role AS account_role,
           account.status AS account_status,account.property_node::text AS account_property_node,
           account.currency::text AS account_currency
      FROM posting_line AS line
      JOIN account ON account.tenant_id=line.tenant_id AND account.id=line.account_id
     WHERE line.tenant_id=${input.tenantId}::uuid
       AND line.tenant_id=current_setting('app.tenant_id',true)::uuid
       AND line.journal_id=${header.journal_id}::uuid
     ORDER BY line.seq
  `;
  validateExisting(header, lines, input, original);
  throw new PositiveTaxCorrectionConflictError(
    "Positive-tax journal already has a governed correction",
  );
}

export class PositiveTaxCorrectionService {
  readonly #events: EventBus;
  readonly #idempotency: PostgresIdempotency;

  constructor(options: PositiveTaxCorrectionServiceOptions) {
    this.#events = options.events;
    this.#idempotency = options.idempotency;
  }

  async reverse(tx: Tx, input: PositiveTaxCorrectionInput): Promise<PositiveTaxCorrectionResult> {
    if (typeof tx !== "function") {
      throw new PositiveTaxCorrectionValidationError("tenant transaction is unavailable");
    }
    const normalized = normalize(input);
    try {
      const outcome = await this.#idempotency.execute<CorrectionBody>(tx, {
        tenantId: normalized.tenantId,
        operation: IDEMPOTENCY_OPERATION,
        key: normalized.idempotencyKey,
        request: {
          actorId: normalized.envelope.actorId,
          propertyNode: normalized.propertyNode,
          reversesJournalId: normalized.reversesJournalId,
          reason: normalized.reason,
          postSealAuthorized: normalized.postSealAuthorized,
        },
      }, async (commandTx) => {
        const discovered = await readOriginal(commandTx, normalized);
        await commandTx`
          SELECT public.lock_positive_tax_posting_rows(
            ${normalized.tenantId}::uuid,
            ARRAY(
              SELECT value::uuid
                FROM jsonb_array_elements_text(${JSON.stringify(discovered.accountIds)}::jsonb)
                     WITH ORDINALITY AS requested(value, ordinal)
               ORDER BY value::uuid
            )::uuid[],
            ${discovered.context.folio_id}::uuid
          )
        `;
        await commandTx`
          SELECT pg_catalog.pg_advisory_xact_lock(
            pg_catalog.hashtextextended(
              ${`${normalized.tenantId}:positive-tax-correction:${normalized.reversesJournalId}`},
              266
            )
          )
        `;

        const locked = await readOriginal(commandTx, normalized);
        if (canonicalOriginal(discovered) !== canonicalOriginal(locked)) {
          throw new PositiveTaxCorrectionConflictError(
            "Positive-tax posting truth changed during lock acquisition",
          );
        }
        await findExisting(commandTx, normalized, locked);

        const requiredDates = [...new Set([
          locked.context.original_business_date,
          locked.context.current_business_date,
        ])].sort();
        if (requiredDates.length === 1 && requiredDates[0]) {
          await commandTx`
            SELECT public.lock_financial_business_days(
              ${normalized.tenantId}::uuid,${normalized.propertyNode}::uuid,
              ARRAY[${requiredDates[0]}::date]::date[]
            )
          `;
        } else if (requiredDates.length === 2 && requiredDates[0] && requiredDates[1]) {
          await commandTx`
            SELECT public.lock_financial_business_days(
              ${normalized.tenantId}::uuid,${normalized.propertyNode}::uuid,
              ARRAY[${requiredDates[0]}::date,${requiredDates[1]}::date]::date[]
            )
          `;
        } else {
          throw new PositiveTaxCorrectionConflictError("Required financial dates are invalid");
        }
        const days = await commandTx<DayRow[]>`
          SELECT business_date::text,sealed_at
            FROM business_day
           WHERE tenant_id=${normalized.tenantId}::uuid
             AND tenant_id=current_setting('app.tenant_id',true)::uuid
             AND property_node=${normalized.propertyNode}::uuid
             AND business_date=ANY(
               ARRAY[
                 ${locked.context.original_business_date}::date,
                 ${locked.context.current_business_date}::date
               ]::date[]
             )
           ORDER BY business_date
        `;
        if (days.length !== requiredDates.length ||
            days.some((day, index) => day.business_date !== requiredDates[index])) {
          throw new PositiveTaxCorrectionConflictError(
            "Required property business day is missing",
          );
        }
        if (days.some((day) => day.sealed_at !== null) && !normalized.postSealAuthorized) {
          throw new PositiveTaxCorrectionAuthorizationError(
            "Post-seal positive-tax correction authority is required",
          );
        }
        const finalOriginal = await readOriginal(commandTx, normalized);
        if (canonicalOriginal(locked) !== canonicalOriginal(finalOriginal)) {
          throw new PositiveTaxCorrectionConflictError(
            "Positive-tax posting truth changed before correction",
          );
        }

        const header = (await commandTx<HeaderRow[]>`
          SELECT result.journal_id::text,result.business_date::text,result.currency::text
            FROM public.create_positive_tax_correction_header(
              ${normalized.tenantId}::uuid,
              ${normalized.reversesJournalId}::uuid,
              ${normalized.propertyNode}::uuid,
              ${normalized.reason},
              ${normalized.envelope.actorId}::uuid
            ) AS result
        `)[0];
        if (!header || header.business_date !== finalOriginal.context.current_business_date ||
            header.currency !== finalOriginal.context.currency) {
          throw new PositiveTaxCorrectionConflictError(
            "PostgreSQL did not create the correction header coherently",
          );
        }

        for (const line of finalOriginal.lines.slice(1)) {
          await commandTx`
            INSERT INTO posting_line(
              tenant_id,journal_id,seq,account_id,folio_id,tx_code,description,
              amount_minor,quantity,business_date,currency
            ) VALUES(
              ${normalized.tenantId}::uuid,${header.journal_id}::uuid,
              ${line.seq}::smallint,${line.account_id}::uuid,${line.folio_id}::uuid,
              ${line.tx_code},${line.description},${-BigInt(line.amount_minor)},
              ${line.quantity}::numeric(10,3),${header.business_date}::date,
              ${header.currency}::char(3)
            )
          `;
        }

        const binding = (await commandTx<RootBindingRow[]>`
          SELECT result.posting_binding_id::text,result.lineage_id::text,
                 result.hold_binding_id::text,result.attribution_id::text,
                 result.reservation_id::text,result.segment_id::text,
                 result.folio_id::text,result.journal_id::text,
                 result.origin_quote_hash,result.snapshot_hash,
                 result.business_date::text,result.currency::text,result.line_count::int
            FROM public.record_positive_tax_correction_root(
              ${normalized.tenantId}::uuid,
              ${normalized.reversesJournalId}::uuid,
              ${header.journal_id}::uuid,
              ${normalized.envelope.actorId}::uuid
            ) AS result
        `)[0];
        if (!binding || binding.journal_id !== header.journal_id ||
            binding.posting_binding_id !== finalOriginal.context.original_posting_binding_id ||
            binding.lineage_id !== finalOriginal.context.lineage_id ||
            binding.folio_id !== finalOriginal.context.folio_id ||
            binding.business_date !== header.business_date ||
            binding.currency !== header.currency ||
            binding.line_count !== finalOriginal.lines.length) {
          throw new PositiveTaxCorrectionConflictError(
            "PostgreSQL did not bind the exact full reversal coherently",
          );
        }

        const postedPayload = journalPayload(header.journal_id, normalized, finalOriginal);
        const journalFact = await recordFact(commandTx, {
          entityType: "journal",
          entityId: header.journal_id,
          envelope: normalized.envelope,
          payload: postedPayload,
        });
        if (journalFact.businessDate !== header.business_date) {
          throw new Error("Audit and positive-tax correction business dates diverged");
        }
        await this.#events.publish(commandTx, {
          tenantId: normalized.tenantId,
          propertyNode: normalized.propertyNode,
          businessDate: header.business_date,
          aggregateType: "journal",
          aggregateId: header.journal_id,
          eventType: "journal.posted",
          actorId: normalized.envelope.actorId,
          correlationId: normalized.envelope.requestId,
          payload: postedPayload,
        });

        const reversedPayload = attributionPayload(binding, normalized);
        await this.#events.publish(commandTx, {
          tenantId: normalized.tenantId,
          propertyNode: normalized.propertyNode,
          businessDate: header.business_date,
          aggregateType: "journal",
          aggregateId: header.journal_id,
          eventType: "tax.attribution_reversed",
          actorId: normalized.envelope.actorId,
          correlationId: normalized.envelope.requestId,
          payload: reversedPayload,
        });

        return {
          status: 201,
          body: body(header.journal_id, normalized, finalOriginal, header.business_date, true),
        };
      });
      return receipt(outcome.body, outcome.replayed);
    } catch (error) {
      const state = (error as { errno?: string; code?: string }).errno ??
        (error as { errno?: string; code?: string }).code;
      if (state === "23505" || state === "55000" || state === "55P03" || state === "P0011") {
        throw new PositiveTaxCorrectionConflictError(
          "Positive-tax correction authority changed or is temporarily unavailable",
        );
      }
      throw error;
    }
  }
}
