import {
  recordFact,
  type AuditEnvelope,
  type EventBus,
  type JsonValue,
  type PostgresIdempotency,
  type Tx,
} from "../../kernel";
import {
  PositiveTaxFolioEligibilityConflictError,
  PositiveTaxSemanticRouteConflictError,
  PositiveTaxSemanticRouteService,
  type PositiveTaxSemanticPolicyBlockedResult,
  type PositiveTaxSemanticResolvedResult,
} from "../tax-fiscal";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const IDEMPOTENCY_KEY = /^[\x21-\x7e]{8,200}$/;
const SOURCE_INTERFACE = "financials.positive-tax.post";
const IDEMPOTENCY_OPERATION = "financials.positive-tax.post";
const QUANTITY = "1.000";

export interface PositiveTaxPostingInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly reservationId: string;
  readonly idempotencyKey: string;
  readonly envelope: AuditEnvelope;
}

export interface PositiveTaxPostingPolicyBlockedResult
  extends PositiveTaxSemanticPolicyBlockedResult {}

export interface PositiveTaxPostingReceipt {
  readonly state: "posted";
  readonly postingBindingId: string;
  readonly journalId: string;
  readonly lineageId: string;
  readonly holdBindingId: string;
  readonly attributionId: string;
  readonly reservationId: string;
  readonly segmentId: string;
  readonly folioId: string;
  readonly businessDate: string;
  readonly currency: string;
  readonly quoteHash: string;
  readonly snapshotHash: string;
  readonly grandTotalMinor: string;
  readonly lineCount: number;
  readonly created: boolean;
  readonly replayed: boolean;
}

export type PositiveTaxPostingResult =
  | PositiveTaxPostingPolicyBlockedResult
  | PositiveTaxPostingReceipt;

export interface PositiveTaxPostingServiceOptions {
  readonly events: EventBus;
  readonly idempotency: PostgresIdempotency;
}

interface NormalizedInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly reservationId: string;
  readonly idempotencyKey: string;
  readonly envelope: AuditEnvelope;
}

interface BusinessDayRow {
  readonly business_date: string;
  readonly sealed_at: Date | null;
}

interface JournalRow {
  readonly id: string;
}

interface ExistingBindingRow {
  readonly posting_binding_id: string;
  readonly journal_id: string;
  readonly lineage_id: string;
  readonly hold_binding_id: string;
  readonly attribution_id: string;
  readonly reservation_id: string;
  readonly segment_id: string;
  readonly folio_id: string;
  readonly business_date: string;
  readonly currency: string;
  readonly origin_quote_hash: string;
  readonly snapshot_hash: string;
  readonly line_count: number;
  readonly grand_total_minor: string;
}

interface BindingRow {
  readonly posting_binding_id: string;
  readonly lineage_id: string;
  readonly attribution_id: string;
  readonly reservation_id: string;
  readonly segment_id: string;
  readonly folio_id: string;
  readonly journal_id: string;
  readonly origin_quote_hash: string;
  readonly snapshot_hash: string;
  readonly currency: string;
  readonly business_date: string;
  readonly created: boolean;
}

interface PositiveTaxPostingBody extends Readonly<Record<string, JsonValue>> {
  readonly state: "posted";
  readonly postingBindingId: string;
  readonly journalId: string;
  readonly lineageId: string;
  readonly holdBindingId: string;
  readonly attributionId: string;
  readonly reservationId: string;
  readonly segmentId: string;
  readonly folioId: string;
  readonly businessDate: string;
  readonly currency: string;
  readonly quoteHash: string;
  readonly snapshotHash: string;
  readonly grandTotalMinor: string;
  readonly lineCount: number;
  readonly created: boolean;
}

export class PositiveTaxPostingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PositiveTaxPostingValidationError";
  }
}

export class PositiveTaxPostingNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PositiveTaxPostingNotFoundError";
  }
}

export class PositiveTaxPostingConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PositiveTaxPostingConflictError";
  }
}

function plainRecord(name: string, value: unknown): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new PositiveTaxPostingValidationError(`${name} must be an object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new PositiveTaxPostingValidationError(`${name} must be a plain object`);
  }
  if (Object.getOwnPropertySymbols(value).length > 0) {
    throw new PositiveTaxPostingValidationError(`${name} must not contain symbol fields`);
  }
}

function exactKeys(name: string, value: Record<string, unknown>, allowed: readonly string[]): void {
  const accepted = new Set(allowed);
  const unsupported = Object.getOwnPropertyNames(value)
    .filter((key) => !accepted.has(key))
    .sort();
  if (unsupported.length > 0) {
    throw new PositiveTaxPostingValidationError(
      `${name} contains unsupported fields: ${unsupported.join(", ")}`,
    );
  }
}

function uuid(name: string, value: unknown): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new PositiveTaxPostingValidationError(`${name} must be a UUID`);
  }
  return value;
}

function normalize(input: PositiveTaxPostingInput): NormalizedInput {
  plainRecord("Positive-tax posting input", input);
  exactKeys("Positive-tax posting input", input, [
    "tenantId", "propertyNode", "reservationId", "idempotencyKey", "envelope",
  ]);
  plainRecord("envelope", input.envelope);
  exactKeys("envelope", input.envelope, [
    "actorId", "tenantId", "propertyNode", "requestId", "operation",
  ]);
  const tenantId = uuid("tenantId", input.tenantId);
  const propertyNode = uuid("propertyNode", input.propertyNode);
  const reservationId = uuid("reservationId", input.reservationId);
  if (uuid("envelope.tenantId", input.envelope.tenantId) !== tenantId ||
      uuid("envelope.propertyNode", input.envelope.propertyNode) !== propertyNode) {
    throw new PositiveTaxPostingValidationError(
      "Posting identity must match the audit envelope tenant and property",
    );
  }
  uuid("envelope.actorId", input.envelope.actorId);
  uuid("envelope.requestId", input.envelope.requestId);
  if (input.envelope.operation !== "journal.posted") {
    throw new PositiveTaxPostingValidationError("audit operation must be journal.posted");
  }
  if (typeof input.idempotencyKey !== "string" || !IDEMPOTENCY_KEY.test(input.idempotencyKey)) {
    throw new PositiveTaxPostingValidationError(
      "idempotencyKey must contain 8-200 visible ASCII characters",
    );
  }
  return Object.freeze({
    tenantId,
    propertyNode,
    reservationId,
    idempotencyKey: input.idempotencyKey,
    envelope: Object.freeze({ ...input.envelope }),
  });
}

function resolvedIdentity(value: PositiveTaxSemanticResolvedResult): string {
  return JSON.stringify({
    eligibility: {
      lineageId: value.eligibility.lineageId,
      bindingId: value.eligibility.bindingId,
      attributionId: value.eligibility.attributionId,
      reservationId: value.eligibility.reservationId,
      segmentId: value.eligibility.segmentId,
      folioId: value.eligibility.folioId,
      guestAccountId: value.eligibility.guestAccountId,
      propertyNode: value.eligibility.propertyNode,
      quoteHash: value.eligibility.quoteHash,
      snapshotHash: value.eligibility.snapshotHash,
      currency: value.eligibility.currency,
    },
    plan: value.plan,
    jurisdiction: value.jurisdiction,
    revenueRoute: value.revenueRoute,
    taxRoutes: value.taxRoutes,
  });
}

function taxDetail(route: PositiveTaxSemanticResolvedResult, journalId: string): Readonly<Record<string, JsonValue>> {
  const eligibility = route.eligibility;
  const plan = route.plan;
  const taxMinor = plan.taxLineage.reduce((sum, tax) => sum + BigInt(tax.taxMinor), 0n);
  const guest = plan.lines.find((line) => line.role === "guest_receivable");
  const revenue = plan.lines.find((line) => line.role === "room_revenue");
  if (!guest || !revenue) throw new PositiveTaxPostingConflictError("Posting plan is incomplete");
  return Object.freeze({
    schemaVersion: 1,
    lineage: Object.freeze({
      lineageId: eligibility.lineageId,
      holdBindingId: eligibility.bindingId,
      attributionId: eligibility.attributionId,
      reservationId: eligibility.reservationId,
      segmentId: eligibility.segmentId,
      folioId: eligibility.folioId,
      journalId,
    }),
    quote: Object.freeze({
      originQuoteHash: eligibility.quoteHash,
      snapshotHash: eligibility.snapshotHash,
      currency: eligibility.currency,
    }),
    jurisdiction: Object.freeze({
      extensionId: route.jurisdiction.extensionId,
      ownerTenantId: route.jurisdiction.ownerTenantId,
      key: route.jurisdiction.key,
      version: route.jurisdiction.version,
      contentHash: route.jurisdiction.contentHash,
    }),
    routes: Object.freeze({
      revenue: Object.freeze({
        mappingId: route.revenueRoute.mappingId,
        semanticCode: route.revenueRoute.semanticCode,
        txCode: route.revenueRoute.txCode,
        creditAccountId: route.revenueRoute.creditAccountId,
      }),
      taxes: route.taxRoutes.map((tax) => Object.freeze({
        taxIndex: tax.taxIndex,
        taxCode: tax.taxCode,
        mappingId: tax.mappingId,
        txCode: tax.txCode,
        creditAccountId: tax.creditAccountId,
      })),
    }),
    totals: Object.freeze({
      baseMinor: (-BigInt(revenue.amountMinor)).toString(),
      taxMinor: taxMinor.toString(),
      grandMinor: guest.amountMinor,
    }),
    taxes: plan.taxLineage.map((tax) => Object.freeze({
      index: tax.index,
      code: tax.code,
      name: tax.name,
      taxMinor: tax.taxMinor,
    })),
  });
}

function journalPayload(
  journalId: string,
  route: PositiveTaxSemanticResolvedResult,
): Readonly<Record<string, JsonValue>> {
  const lines: JsonValue[] = [];
  for (const line of route.plan.lines) {
    if (line.role === "guest_receivable") {
      lines.push(Object.freeze({
        account: route.eligibility.guestAccountId,
        folio: route.eligibility.folioId,
        tx_code: route.revenueRoute.txCode,
        amount_minor: line.amountMinor,
      }));
    } else if (line.role === "room_revenue") {
      lines.push(Object.freeze({
        account: route.revenueRoute.creditAccountId,
        tx_code: route.revenueRoute.txCode,
        amount_minor: line.amountMinor,
      }));
    } else {
      const taxRoute = route.taxRoutes.find(({ taxIndex }) => taxIndex === line.taxIndex);
      if (!taxRoute) throw new PositiveTaxPostingConflictError("Tax route order is incomplete");
      lines.push(Object.freeze({
        account: taxRoute.creditAccountId,
        tx_code: taxRoute.txCode,
        amount_minor: line.amountMinor,
      }));
    }
  }
  return Object.freeze({
    journal_id: journalId,
    kind: "charge",
    lineage_id: route.eligibility.lineageId,
    reservation_id: route.eligibility.reservationId,
    folio_id: route.eligibility.folioId,
    lines: Object.freeze(lines),
  });
}

function bindingPayload(
  bindingId: string,
  journalId: string,
  route: PositiveTaxSemanticResolvedResult,
): Readonly<Record<string, JsonValue>> {
  return Object.freeze({
    posting_binding_id: bindingId,
    journal_id: journalId,
    lineage_id: route.eligibility.lineageId,
    attribution_id: route.eligibility.attributionId,
    reservation_id: route.eligibility.reservationId,
    segment_id: route.eligibility.segmentId,
    folio_id: route.eligibility.folioId,
    origin_quote_hash: route.eligibility.quoteHash,
    snapshot_hash: route.eligibility.snapshotHash,
    currency: route.eligibility.currency,
  });
}

function bodyFromExisting(row: ExistingBindingRow): PositiveTaxPostingBody {
  return Object.freeze({
    state: "posted",
    postingBindingId: row.posting_binding_id,
    journalId: row.journal_id,
    lineageId: row.lineage_id,
    holdBindingId: row.hold_binding_id,
    attributionId: row.attribution_id,
    reservationId: row.reservation_id,
    segmentId: row.segment_id,
    folioId: row.folio_id,
    businessDate: row.business_date,
    currency: row.currency,
    quoteHash: row.origin_quote_hash,
    snapshotHash: row.snapshot_hash,
    grandTotalMinor: row.grand_total_minor,
    lineCount: row.line_count,
    created: false,
  });
}

function receipt(body: PositiveTaxPostingBody, replayed: boolean): PositiveTaxPostingReceipt {
  return Object.freeze({
    state: "posted",
    postingBindingId: body.postingBindingId,
    journalId: body.journalId,
    lineageId: body.lineageId,
    holdBindingId: body.holdBindingId,
    attributionId: body.attributionId,
    reservationId: body.reservationId,
    segmentId: body.segmentId,
    folioId: body.folioId,
    businessDate: body.businessDate,
    currency: body.currency,
    quoteHash: body.quoteHash,
    snapshotHash: body.snapshotHash,
    grandTotalMinor: body.grandTotalMinor,
    lineCount: body.lineCount,
    created: body.created,
    replayed,
  });
}

export class PositiveTaxPostingService {
  readonly #events: EventBus;
  readonly #idempotency: PostgresIdempotency;
  readonly #routes = new PositiveTaxSemanticRouteService();

  constructor(options: PositiveTaxPostingServiceOptions) {
    this.#events = options.events;
    this.#idempotency = options.idempotency;
  }

  async post(tx: Tx, input: PositiveTaxPostingInput): Promise<PositiveTaxPostingResult> {
    if (typeof tx !== "function") {
      throw new PositiveTaxPostingValidationError("tenant transaction is unavailable");
    }
    const normalized = normalize(input);
    const identityInput = Object.freeze({
      tenantId: normalized.tenantId,
      propertyNode: normalized.propertyNode,
      reservationId: normalized.reservationId,
    });
    let preflight: PositiveTaxSemanticPolicyBlockedResult | PositiveTaxSemanticResolvedResult;
    try {
      preflight = await this.#routes.discover(tx, identityInput);
    } catch (error) {
      if (error instanceof PositiveTaxFolioEligibilityConflictError ||
          error instanceof PositiveTaxSemanticRouteConflictError) {
        throw new PositiveTaxPostingConflictError(
          "Positive-tax posting authority changed or is temporarily unavailable",
        );
      }
      throw error;
    }
    if (preflight.state === "policy_blocked") return preflight;

    try {
      const outcome = await this.#idempotency.execute<PositiveTaxPostingBody>(tx, {
        tenantId: normalized.tenantId,
        operation: IDEMPOTENCY_OPERATION,
        key: normalized.idempotencyKey,
        request: {
          actorId: normalized.envelope.actorId,
          propertyNode: normalized.propertyNode,
          reservationId: normalized.reservationId,
        },
      }, async (commandTx) => {
        const discovered = await this.#routes.discover(commandTx, identityInput);
        if (discovered.state !== "resolved") {
          throw new PositiveTaxPostingConflictError(
            "Positive-tax policy changed before posting",
          );
        }
        const accountIds = [...new Set([
          discovered.eligibility.guestAccountId,
          discovered.revenueRoute.creditAccountId,
          ...discovered.taxRoutes.map(({ creditAccountId }) => creditAccountId),
        ])].sort();
        if (accountIds.length < 2 || accountIds.length > 66) {
          throw new PositiveTaxPostingConflictError("Positive-tax account set is invalid");
        }
        await commandTx`
          SELECT public.lock_positive_tax_posting_rows(
            ${normalized.tenantId}::uuid,
            ARRAY(
              SELECT value::uuid
                FROM jsonb_array_elements_text(${JSON.stringify(accountIds)}::jsonb)
                     WITH ORDINALITY AS requested(value, ordinal)
               ORDER BY value::uuid
            )::uuid[],
            ${discovered.eligibility.folioId}::uuid
          )
        `;

        const locked = await this.#routes.resolve(commandTx, identityInput);
        if (locked.state !== "resolved" ||
            resolvedIdentity(discovered) !== resolvedIdentity(locked)) {
          throw new PositiveTaxPostingConflictError(
            "Positive-tax eligibility or routing changed during lock acquisition",
          );
        }

        const existing = (await commandTx<ExistingBindingRow[]>`
          SELECT binding.id::text AS posting_binding_id,
                 binding.journal_id::text,
                 binding.lineage_id::text,
                 lineage.binding_id::text AS hold_binding_id,
                 binding.attribution_id::text,
                 binding.reservation_id::text,
                 binding.segment_id::text,
                 binding.folio_id::text,
                 binding.business_date::text,
                 binding.currency::text,
                 binding.origin_quote_hash,
                 binding.snapshot_hash,
                 count(line.id)::int AS line_count,
                 max(CASE WHEN line.seq=1 THEN line.amount_minor END)::text AS grand_total_minor
            FROM tax_attribution_journal_binding AS binding
            JOIN tax_attribution_reservation_binding AS lineage
              ON lineage.tenant_id=binding.tenant_id AND lineage.id=binding.lineage_id
            JOIN posting_line AS line
              ON line.tenant_id=binding.tenant_id AND line.journal_id=binding.journal_id
           WHERE binding.tenant_id=${normalized.tenantId}::uuid
             AND binding.tenant_id=current_setting('app.tenant_id',true)::uuid
             AND binding.lineage_id=${locked.eligibility.lineageId}::uuid
           GROUP BY binding.id,binding.journal_id,binding.lineage_id,lineage.binding_id,
                    binding.attribution_id,binding.reservation_id,binding.segment_id,
                    binding.folio_id,binding.business_date,binding.currency,
                    binding.origin_quote_hash,binding.snapshot_hash
        `)[0];
        if (existing) {
          if (existing.folio_id !== locked.eligibility.folioId ||
              existing.reservation_id !== locked.eligibility.reservationId ||
              existing.attribution_id !== locked.eligibility.attributionId ||
              existing.origin_quote_hash !== locked.eligibility.quoteHash ||
              existing.snapshot_hash !== locked.eligibility.snapshotHash ||
              existing.currency !== locked.eligibility.currency ||
              existing.grand_total_minor !== locked.plan.lines[0]?.amountMinor) {
            throw new PositiveTaxPostingConflictError(
              "Existing positive-tax posting binding is inconsistent",
            );
          }
          return { status: 200, body: bodyFromExisting(existing) };
        }

        const dayBefore = (await commandTx<BusinessDayRow[]>`
          SELECT (transaction_timestamp() AT TIME ZONE property.timezone)::date::text AS business_date,
                 business_day_row.sealed_at
            FROM org_node AS property
            LEFT JOIN business_day AS business_day_row
              ON business_day_row.tenant_id=property.tenant_id
             AND business_day_row.property_node=property.id
             AND business_day_row.business_date=(transaction_timestamp() AT TIME ZONE property.timezone)::date
           WHERE property.tenant_id=${normalized.tenantId}::uuid
             AND property.tenant_id=current_setting('app.tenant_id',true)::uuid
             AND property.id=${normalized.propertyNode}::uuid
             AND property.kind='property'
        `)[0];
        if (!dayBefore || dayBefore.sealed_at !== null) {
          throw new PositiveTaxPostingConflictError("Property business day is missing or sealed");
        }
        await commandTx`
          SELECT public.lock_financial_business_days(
            ${normalized.tenantId}::uuid,
            ${normalized.propertyNode}::uuid,
            ARRAY[${dayBefore.business_date}::date]::date[]
          )
        `;
        const dayAfter = (await commandTx<BusinessDayRow[]>`
          SELECT business_date::text, sealed_at
            FROM business_day
           WHERE tenant_id=${normalized.tenantId}::uuid
             AND tenant_id=current_setting('app.tenant_id',true)::uuid
             AND property_node=${normalized.propertyNode}::uuid
             AND business_date=${dayBefore.business_date}::date
        `)[0];
        if (!dayAfter || dayAfter.business_date !== dayBefore.business_date ||
            dayAfter.sealed_at !== null) {
          throw new PositiveTaxPostingConflictError("Property business day changed or is sealed");
        }
        const finalRoute = await this.#routes.discover(commandTx, identityInput);
        if (finalRoute.state !== "resolved" ||
            resolvedIdentity(locked) !== resolvedIdentity(finalRoute)) {
          throw new PositiveTaxPostingConflictError(
            "Positive-tax routing changed before journal creation",
          );
        }

        const source = JSON.stringify({
          interface: SOURCE_INTERFACE,
          lineage_id: finalRoute.eligibility.lineageId,
        });
        const journal = (await commandTx<JournalRow[]>`
          INSERT INTO journal(
            tenant_id,property_node,business_date,kind,description,currency,source,created_by
          ) VALUES(
            ${normalized.tenantId}::uuid,${normalized.propertyNode}::uuid,
            ${dayAfter.business_date}::date,'charge','Quoted stay with tax',
            ${finalRoute.eligibility.currency}::char(3),${source}::text::jsonb,
            ${normalized.envelope.actorId}::uuid
          ) RETURNING id
        `)[0];
        if (!journal) throw new Error("PostgreSQL did not return the positive-tax journal");

        for (const [offset, line] of finalRoute.plan.lines.entries()) {
          // The owner capability inserts seq=1 with the exact tax_detail only after it
          // validates this complete insert-only credit set. The app never writes a
          // tax_detail value and posting_line remains strictly append-only.
          if (line.role === "guest_receivable") continue;
          let accountId: string;
          const folioId: string | null = null;
          let txCode: string;
          let description: string;
          if (line.role === "room_revenue") {
            accountId = finalRoute.revenueRoute.creditAccountId;
            txCode = finalRoute.revenueRoute.txCode;
            description = "Room revenue";
          } else {
            const route = finalRoute.taxRoutes.find(({ taxIndex }) => taxIndex === line.taxIndex);
            if (!route) throw new PositiveTaxPostingConflictError("Tax route order is incomplete");
            accountId = route.creditAccountId;
            txCode = route.txCode;
            description = line.taxName;
          }
          await commandTx`
            INSERT INTO posting_line(
              tenant_id,journal_id,seq,account_id,folio_id,tx_code,description,
              amount_minor,quantity,business_date,currency
            ) VALUES(
              ${normalized.tenantId}::uuid,${journal.id}::uuid,${offset + 1}::smallint,
              ${accountId}::uuid,${folioId}::uuid,${txCode},${description},
              ${BigInt(line.amountMinor)},${QUANTITY}::numeric(10,3),
              ${dayAfter.business_date}::date,${finalRoute.eligibility.currency}::char(3)
            )
          `;
        }

        const detail = taxDetail(finalRoute, journal.id);
        const taxMappingIds = finalRoute.taxRoutes.map(({ mappingId }) => mappingId);
        const binding = (await commandTx<BindingRow[]>`
          SELECT result.posting_binding_id::text,
                 result.lineage_id::text,
                 result.attribution_id::text,
                 result.reservation_id::text,
                 result.segment_id::text,
                 result.folio_id::text,
                 result.journal_id::text,
                 result.origin_quote_hash,
                 result.snapshot_hash,
                 result.currency::text,
                 result.business_date::text,
                 result.created
            FROM public.record_positive_tax_journal_binding(
            ${normalized.tenantId}::uuid,
            ${normalized.propertyNode}::uuid,
            ${normalized.envelope.actorId}::uuid,
            ${finalRoute.eligibility.lineageId}::uuid,
            ${finalRoute.eligibility.folioId}::uuid,
            ${journal.id}::uuid,
            ${finalRoute.revenueRoute.mappingId}::uuid,
            ARRAY(
              SELECT value::uuid
                FROM jsonb_array_elements_text(${JSON.stringify(taxMappingIds)}::jsonb)
                     WITH ORDINALITY AS requested(value, ordinal)
               ORDER BY ordinal
            )::uuid[],
            ${JSON.stringify(detail)}::text::jsonb
          ) AS result
        `)[0];
        if (!binding || !binding.created || binding.journal_id !== journal.id ||
            binding.lineage_id !== finalRoute.eligibility.lineageId ||
            binding.folio_id !== finalRoute.eligibility.folioId ||
            binding.business_date !== dayAfter.business_date) {
          throw new PositiveTaxPostingConflictError(
            "Positive-tax journal binding was not created coherently",
          );
        }

        const postedPayload = journalPayload(journal.id, finalRoute);
        const journalFact = await recordFact(commandTx, {
          entityType: "journal",
          entityId: journal.id,
          envelope: normalized.envelope,
          payload: postedPayload,
        });
        if (journalFact.businessDate !== dayAfter.business_date) {
          throw new Error("Audit and positive-tax journal business dates diverged");
        }
        await this.#events.publish(commandTx, {
          tenantId: normalized.tenantId,
          propertyNode: normalized.propertyNode,
          businessDate: dayAfter.business_date,
          aggregateType: "journal",
          aggregateId: journal.id,
          eventType: "journal.posted",
          actorId: normalized.envelope.actorId,
          correlationId: normalized.envelope.requestId,
          payload: postedPayload,
        });

        const attributionEnvelope: AuditEnvelope = Object.freeze({
          ...normalized.envelope,
          operation: "tax.attribution_posted",
        });
        const postedAttributionPayload = bindingPayload(binding.posting_binding_id, journal.id, finalRoute);
        const bindingFact = await recordFact(commandTx, {
          entityType: "tax_attribution_journal_binding",
          entityId: binding.posting_binding_id,
          envelope: attributionEnvelope,
          payload: postedAttributionPayload,
        });
        if (bindingFact.businessDate !== dayAfter.business_date) {
          throw new Error("Audit and positive-tax binding business dates diverged");
        }
        await this.#events.publish(commandTx, {
          tenantId: normalized.tenantId,
          propertyNode: normalized.propertyNode,
          businessDate: dayAfter.business_date,
          aggregateType: "tax_attribution_journal_binding",
          aggregateId: binding.posting_binding_id,
          eventType: "tax.attribution_posted",
          actorId: normalized.envelope.actorId,
          correlationId: normalized.envelope.requestId,
          payload: postedAttributionPayload,
        });

        const guestLine = finalRoute.plan.lines[0];
        if (!guestLine || guestLine.role !== "guest_receivable") {
          throw new PositiveTaxPostingConflictError("Positive-tax guest line is unavailable");
        }
        return {
          status: 201,
          body: Object.freeze({
            state: "posted",
            postingBindingId: binding.posting_binding_id,
            journalId: journal.id,
            lineageId: finalRoute.eligibility.lineageId,
            holdBindingId: finalRoute.eligibility.bindingId,
            attributionId: finalRoute.eligibility.attributionId,
            reservationId: finalRoute.eligibility.reservationId,
            segmentId: finalRoute.eligibility.segmentId,
            folioId: finalRoute.eligibility.folioId,
            businessDate: dayAfter.business_date,
            currency: finalRoute.eligibility.currency,
            quoteHash: finalRoute.eligibility.quoteHash,
            snapshotHash: finalRoute.eligibility.snapshotHash,
            grandTotalMinor: guestLine.amountMinor,
            lineCount: finalRoute.plan.lines.length,
            created: true,
          }),
        };
      });
      return receipt(outcome.body, outcome.replayed);
    } catch (error) {
      const state = (error as { errno?: string; code?: string }).errno ??
        (error as { errno?: string; code?: string }).code;
      if (error instanceof PositiveTaxFolioEligibilityConflictError ||
          error instanceof PositiveTaxSemanticRouteConflictError ||
          state === "55P03" || state === "55000" || state === "P0011" || state === "23505") {
        throw new PositiveTaxPostingConflictError(
          "Positive-tax posting authority changed or is temporarily unavailable",
        );
      }
      throw error;
    }
  }
}
