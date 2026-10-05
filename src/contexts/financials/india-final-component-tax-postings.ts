import {
  recordFact,
  type AuditEnvelope,
  type EventBus,
  type JsonValue,
  type PostgresIdempotency,
  type Tx,
} from "../../kernel";
import {
  IndiaGstAccommodationFinalComponentTaxSemanticRouteConflictError,
  IndiaGstAccommodationFinalComponentTaxSemanticRouteNotFoundError,
  IndiaGstAccommodationFinalComponentTaxSemanticRouteService,
  PositiveTaxFolioEligibilityConflictError,
  PositiveTaxFolioEligibilityNotFoundError,
  PositiveTaxFolioEligibilityService,
  type IndiaGstAccommodationFinalComponentTaxSemanticRouteResult,
  type PositiveTaxFolioEligibilityResult,
} from "../tax-fiscal";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const KEY = /^[\x21-\x7e]{8,200}$/;
const OPERATION = "financials.india-final-component-tax.post";
export interface IndiaFinalComponentTaxPostingInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly reservationId: string;
  readonly idempotencyKey: string;
  readonly envelope: AuditEnvelope;
}
export interface IndiaFinalComponentTaxPostingReceipt {
  readonly state: "posted";
  readonly postingBindingId: string;
  readonly journalId: string;
  readonly taxId: string;
  readonly taxGeneration: number;
  readonly valuationId: string;
  readonly applicabilityId: string;
  readonly reservationId: string;
  readonly folioId: string;
  readonly businessDate: string;
  readonly currency: "INR";
  readonly grandTotalMinor: string;
  readonly lineCount: number;
  readonly created: boolean;
  readonly replayed: boolean;
}
export type IndiaFinalComponentTaxPostingResult =
  IndiaFinalComponentTaxPostingReceipt;
export interface IndiaFinalComponentTaxPostingServiceOptions {
  readonly events: EventBus;
  readonly idempotency: PostgresIdempotency;
}
export class IndiaFinalComponentTaxPostingValidationError extends Error {
  constructor(m: string) {
    super(m);
    this.name = "IndiaFinalComponentTaxPostingValidationError";
  }
}
export class IndiaFinalComponentTaxPostingNotFoundError extends Error {
  constructor(m: string) {
    super(m);
    this.name = "IndiaFinalComponentTaxPostingNotFoundError";
  }
}
export class IndiaFinalComponentTaxPostingConflictError extends Error {
  constructor(m: string) {
    super(m);
    this.name = "IndiaFinalComponentTaxPostingConflictError";
  }
}
type Row = Readonly<Record<string, unknown>>;
interface Body extends Readonly<Record<string, JsonValue>> {
  readonly state: "posted";
  readonly postingBindingId: string;
  readonly journalId: string;
  readonly taxId: string;
  readonly taxGeneration: number;
  readonly valuationId: string;
  readonly applicabilityId: string;
  readonly reservationId: string;
  readonly folioId: string;
  readonly businessDate: string;
  readonly currency: "INR";
  readonly grandTotalMinor: string;
  readonly lineCount: number;
  readonly created: boolean;
}
function exact(v: unknown, keys: readonly string[], s: string): Row {
  if (
    typeof v !== "object" ||
    v === null ||
    Array.isArray(v) ||
    Object.getPrototypeOf(v) !== Object.prototype ||
    Object.getOwnPropertySymbols(v).length
  )
    throw new IndiaFinalComponentTaxPostingValidationError(
      s + " must be an exact plain object",
    );
  const d = Object.getOwnPropertyDescriptors(v),
    a = Object.keys(d).sort(),
    e = [...keys].sort();
  if (
    a.length !== e.length ||
    a.some((k, i) => k !== e[i]) ||
    Object.values(d).some(
      (x) => x.get || x.set || !x.enumerable || !("value" in x),
    )
  )
    throw new IndiaFinalComponentTaxPostingValidationError(
      s + " shape is invalid",
    );
  return v as Row;
}
function id(v: unknown, s: string) {
  if (typeof v !== "string" || !UUID.test(v))
    throw new IndiaFinalComponentTaxPostingValidationError(
      s + " must be a lowercase UUID",
    );
  return v;
}
function normalize(raw: IndiaFinalComponentTaxPostingInput) {
  const i = exact(
      raw,
      [
        "tenantId",
        "propertyNode",
        "reservationId",
        "idempotencyKey",
        "envelope",
      ],
      "posting input",
    ),
    e = exact(
      i.envelope,
      ["actorId", "tenantId", "propertyNode", "requestId", "operation"],
      "audit envelope",
    );
  const tenantId = id(i.tenantId, "tenantId"),
    propertyNode = id(i.propertyNode, "propertyNode"),
    reservationId = id(i.reservationId, "reservationId");
  if (
    id(e.tenantId, "envelope.tenantId") !== tenantId ||
    id(e.propertyNode, "envelope.propertyNode") !== propertyNode
  )
    throw new IndiaFinalComponentTaxPostingValidationError(
      "audit scope mismatch",
    );
  id(e.actorId, "envelope.actorId");
  id(e.requestId, "envelope.requestId");
  if (e.operation !== "journal.posted")
    throw new IndiaFinalComponentTaxPostingValidationError(
      "audit operation must be journal.posted",
    );
  if (typeof i.idempotencyKey !== "string" || !KEY.test(i.idempotencyKey))
    throw new IndiaFinalComponentTaxPostingValidationError(
      "invalid idempotencyKey",
    );
  return Object.freeze({
    tenantId,
    propertyNode,
    reservationId,
    idempotencyKey: i.idempotencyKey,
    envelope: Object.freeze({ ...e }) as unknown as AuditEnvelope,
  });
}
function signature(
  f: PositiveTaxFolioEligibilityResult,
  r: IndiaGstAccommodationFinalComponentTaxSemanticRouteResult,
) {
  return JSON.stringify({
    folioId: f.folioId,
    guestAccountId: f.guestAccountId,
    propertyNode: f.propertyNode,
    currency: f.currency,
    r,
  });
}
function taxDetail(
  r: IndiaGstAccommodationFinalComponentTaxSemanticRouteResult,
  p: string,
  res: string,
  f: string,
  j: string,
): Readonly<Record<string, JsonValue>> {
  return Object.freeze({
    schemaVersion: "india_accommodation_component_tax_v1",
    tax: Object.freeze({
      taxId: r.taxId,
      taxGeneration: r.taxGeneration,
      evidenceHash: r.evidenceHash,
    }),
    valuation: Object.freeze({
      valuationId: r.valuationId,
      valuationGeneration: r.valuationGeneration,
      evidenceHash: r.finalValuationEvidenceHash,
    }),
    applicability: Object.freeze({
      applicabilityId: r.applicabilityId,
      evidenceHash: r.applicabilityEvidenceHash,
    }),
    posting: Object.freeze({
      propertyNode: p,
      reservationId: res,
      folioId: f,
      journalId: j,
      currency: r.currency,
    }),
    totals: Object.freeze({
      transactionValueMinor: r.transactionValueMinor,
      taxMinor: r.taxMinor,
      grandTotalMinor: r.grandTotalMinor,
    }),
    componentFamily: r.componentFamily,
    jurisdiction: Object.freeze({ ...r.jurisdiction }),
    revenueRoute: Object.freeze({ ...r.revenueRoute }),
    components: Object.freeze(
      r.components.map((component) =>
        Object.freeze({
          componentIdentity: component.componentIdentity,
          semanticCode: component.semanticCode,
          amountMinor: component.amountMinor,
          route:
            component.route === null
              ? null
              : Object.freeze({ ...component.route }),
        }),
      ),
    ),
  });
}
function makeBody(
  x: Row,
  grand: string,
  count: number,
  created: boolean,
): Body {
  if (x.currency !== "INR")
    throw new IndiaFinalComponentTaxPostingConflictError(
      "invalid stored currency",
    );
  return Object.freeze({
    state: "posted",
    postingBindingId: String(x.posting_binding_id),
    journalId: String(x.journal_id),
    taxId: String(x.tax_id),
    taxGeneration: Number(x.tax_generation),
    valuationId: String(x.valuation_id),
    applicabilityId: String(x.applicability_id),
    reservationId: String(x.reservation_id),
    folioId: String(x.folio_id),
    businessDate: String(x.business_date),
    currency: "INR",
    grandTotalMinor: grand,
    lineCount: count,
    created,
  });
}

export class IndiaFinalComponentTaxPostingService {
  readonly #events: EventBus;
  readonly #idempotency: PostgresIdempotency;
  readonly #folios = new PositiveTaxFolioEligibilityService();
  readonly #routes =
    new IndiaGstAccommodationFinalComponentTaxSemanticRouteService();
  constructor(o: IndiaFinalComponentTaxPostingServiceOptions) {
    this.#events = o.events;
    this.#idempotency = o.idempotency;
  }
  async post(
    tx: Tx,
    raw: IndiaFinalComponentTaxPostingInput,
  ): Promise<IndiaFinalComponentTaxPostingResult> {
    if (typeof tx !== "function")
      throw new IndiaFinalComponentTaxPostingValidationError(
        "tenant transaction is unavailable",
      );
    const i = normalize(raw),
      sel = Object.freeze({
        tenantId: i.tenantId,
        propertyNode: i.propertyNode,
        reservationId: i.reservationId,
      });
    try {
      const pf = await this.#folios.discover(tx, sel),
        pr = await this.#routes.resolve(
          tx,
          Object.freeze({ ...sel, folioId: pf.folioId }),
        );
      if (pf.currency !== "INR")
        throw new IndiaFinalComponentTaxPostingConflictError(
          "folio currency must be INR",
        );
      const out = await this.#idempotency.execute<Body>(
        tx,
        {
          tenantId: i.tenantId,
          operation: OPERATION,
          key: i.idempotencyKey,
          request: {
            actorId: i.envelope.actorId,
            propertyNode: i.propertyNode,
            reservationId: i.reservationId,
          },
        },
        async (q) => {
          const f = await this.#folios.discover(q, sel),
            r = await this.#routes.resolve(
              q,
              Object.freeze({ ...sel, folioId: f.folioId }),
            );
          if (signature(pf, pr) !== signature(f, r))
            throw new IndiaFinalComponentTaxPostingConflictError(
              "authority changed before posting",
            );
          const accounts = [
            ...new Set([
              f.guestAccountId,
              r.revenueRoute.creditAccountId,
              ...r.components.flatMap((c) =>
                c.amountMinor === "0" || !c.route
                  ? []
                  : [c.route.creditAccountId],
              ),
            ]),
          ].sort();
          await q`SELECT public.lock_positive_tax_posting_rows(${i.tenantId}::uuid,ARRAY(SELECT value::uuid FROM jsonb_array_elements_text(${JSON.stringify(accounts)}::jsonb) WITH ORDINALITY requested(value,ordinal) ORDER BY value::uuid)::uuid[],${f.folioId}::uuid)`;
          const lf = await this.#folios.discover(q, sel),
            lr = await this.#routes.resolve(
              q,
              Object.freeze({ ...sel, folioId: lf.folioId }),
            );
          if (signature(f, r) !== signature(lf, lr))
            throw new IndiaFinalComponentTaxPostingConflictError(
              "authority changed during lock",
            );
          const existing = (
            await q<
              Row[]
            >`SELECT binding.id::text posting_binding_id,binding.journal_id::text,binding.tax_id::text,binding.tax_generation,binding.valuation_id::text,binding.applicability_id::text,binding.reservation_id::text,binding.folio_id::text,binding.business_date::text,binding.currency::text,count(line.id)::int line_count,max(CASE WHEN line.seq=1 THEN line.amount_minor END)::text grand_total_minor FROM india_gst_accommodation_final_component_tax_journal_binding binding JOIN posting_line line ON line.tenant_id=binding.tenant_id AND line.journal_id=binding.journal_id WHERE binding.tenant_id=${i.tenantId}::uuid AND binding.tenant_id=current_setting('app.tenant_id',true)::uuid AND binding.tax_id=${lr.taxId}::uuid GROUP BY binding.tenant_id,binding.id`
          )[0];
          const count =
            2 + lr.components.filter((c) => c.amountMinor !== "0").length;
          if (existing) {
            if (
              existing.tax_id !== lr.taxId ||
              Number(existing.tax_generation) !== lr.taxGeneration ||
              existing.valuation_id !== lr.valuationId ||
              existing.applicability_id !== lr.applicabilityId ||
              existing.reservation_id !== i.reservationId ||
              existing.folio_id !== lf.folioId ||
              existing.currency !== "INR" ||
              existing.grand_total_minor !== lr.grandTotalMinor ||
              Number(existing.line_count) !== count
            ) {
              throw new IndiaFinalComponentTaxPostingConflictError(
                "existing India posting binding is inconsistent",
              );
            }
            return {
              status: 200,
              body: makeBody(
                existing,
                String(existing.grand_total_minor),
                Number(existing.line_count),
                false,
              ),
            };
          }
          const d = (
            await q<
              Array<{ business_date: string; sealed_at: Date | null }>
            >`SELECT (transaction_timestamp() AT TIME ZONE property.timezone)::date::text business_date,day.sealed_at FROM org_node property LEFT JOIN business_day day ON day.tenant_id=property.tenant_id AND day.property_node=property.id AND day.business_date=(transaction_timestamp() AT TIME ZONE property.timezone)::date WHERE property.tenant_id=${i.tenantId}::uuid AND property.tenant_id=current_setting('app.tenant_id',true)::uuid AND property.id=${i.propertyNode}::uuid AND property.kind='property'`
          )[0];
          if (!d || d.sealed_at !== null)
            throw new IndiaFinalComponentTaxPostingConflictError(
              "business day missing or sealed",
            );
          await q`SELECT public.lock_financial_business_days(${i.tenantId}::uuid,${i.propertyNode}::uuid,ARRAY[${d.business_date}::date]::date[])`;
          const day = (
            await q<
              Array<{ business_date: string; sealed_at: Date | null }>
            >`SELECT business_date::text,sealed_at FROM business_day WHERE tenant_id=${i.tenantId}::uuid AND tenant_id=current_setting('app.tenant_id',true)::uuid AND property_node=${i.propertyNode}::uuid AND business_date=${d.business_date}::date`
          )[0];
          if (!day || day.sealed_at !== null)
            throw new IndiaFinalComponentTaxPostingConflictError(
              "business day changed or sealed",
            );
          const ff = await this.#folios.discover(q, sel),
            fr = await this.#routes.resolve(
              q,
              Object.freeze({ ...sel, folioId: ff.folioId }),
            );
          if (signature(lf, lr) !== signature(ff, fr))
            throw new IndiaFinalComponentTaxPostingConflictError(
              "authority changed before journal",
            );
          const journal = (
            await q<
              Array<{ id: string }>
            >`INSERT INTO journal(tenant_id,property_node,business_date,kind,description,currency,source,created_by) VALUES(${i.tenantId}::uuid,${i.propertyNode}::uuid,${day.business_date}::date,'charge','India accommodation component tax','INR',${JSON.stringify({ interface: OPERATION, tax_id: fr.taxId })}::text::jsonb,${i.envelope.actorId}::uuid) RETURNING id`
          )[0];
          if (!journal) throw new Error("journal insert failed");
          const credits = [
            {
              a: fr.revenueRoute.creditAccountId,
              c: fr.revenueRoute.txCode,
              n: "Room revenue",
              m: -BigInt(fr.transactionValueMinor),
            },
            ...fr.components
              .filter((c) => c.amountMinor !== "0")
              .map((c) => {
                if (!c.route)
                  throw new IndiaFinalComponentTaxPostingConflictError(
                    "component route missing",
                  );
                return {
                  a: c.route.creditAccountId,
                  c: c.route.txCode,
                  n: c.semanticCode,
                  m: -BigInt(c.amountMinor),
                };
              }),
          ];
          for (const [x, l] of credits.entries())
            await q`INSERT INTO posting_line(tenant_id,journal_id,seq,account_id,folio_id,tx_code,description,amount_minor,quantity,business_date,currency) VALUES(${i.tenantId}::uuid,${journal.id}::uuid,${x + 2}::smallint,${l.a}::uuid,${null}::uuid,${l.c},${l.n},${l.m},'1.000',${day.business_date}::date,'INR')`;
          const detail = taxDetail(
              fr,
              i.propertyNode,
              i.reservationId,
              ff.folioId,
              journal.id,
            ),
            maps = fr.components
              .filter((c) => c.amountMinor !== "0")
              .map((c) => c.route!.mappingId);
          const b = (
            await q<
              Row[]
            >`SELECT result.posting_binding_id::text,
                     result.tax_id::text,result.tax_generation,
                     result.valuation_id::text,result.applicability_id::text,
                     result.reservation_id::text,result.folio_id::text,
                     result.journal_id::text,result.currency::text,
                     result.business_date::text,result.created
                FROM public.record_india_final_component_tax_journal_binding(${i.tenantId}::uuid,${i.propertyNode}::uuid,${i.envelope.actorId}::uuid,${fr.taxId}::uuid,${ff.folioId}::uuid,${journal.id}::uuid,${fr.revenueRoute.mappingId}::uuid,ARRAY(SELECT value::uuid FROM jsonb_array_elements_text(${JSON.stringify(maps)}::jsonb) WITH ORDINALITY requested(value,ordinal) ORDER BY ordinal)::uuid[],${JSON.stringify(detail)}::text::jsonb) result`
          )[0];
          if (
            !b ||
            !b.created ||
            b.tax_id !== fr.taxId ||
            Number(b.tax_generation) !== fr.taxGeneration ||
            b.valuation_id !== fr.valuationId ||
            b.applicability_id !== fr.applicabilityId ||
            b.reservation_id !== i.reservationId ||
            b.folio_id !== ff.folioId ||
            b.journal_id !== journal.id ||
            b.currency !== "INR" ||
            b.business_date !== day.business_date
          )
            throw new IndiaFinalComponentTaxPostingConflictError(
              "binding not created",
            );
          const jp = Object.freeze({
            journal_id: journal.id,
            kind: "charge",
            tax_id: fr.taxId,
            reservation_id: i.reservationId,
            folio_id: ff.folioId,
            grand_total_minor: fr.grandTotalMinor,
          });
          const jf = await recordFact(q, {
            entityType: "journal",
            entityId: journal.id,
            envelope: i.envelope,
            payload: jp,
          });
          if (jf.businessDate !== day.business_date)
            throw new Error("journal audit date mismatch");
          await this.#events.publish(q, {
            tenantId: i.tenantId,
            propertyNode: i.propertyNode,
            businessDate: day.business_date,
            aggregateType: "journal",
            aggregateId: journal.id,
            eventType: "journal.posted",
            actorId: i.envelope.actorId,
            correlationId: i.envelope.requestId,
            payload: jp,
          });
          const ep = Object.freeze({
              posting_binding_id: String(b.posting_binding_id),
              journal_id: journal.id,
              tax_id: fr.taxId,
              tax_generation: fr.taxGeneration,
              valuation_id: fr.valuationId,
              applicability_id: fr.applicabilityId,
              reservation_id: i.reservationId,
              folio_id: ff.folioId,
              currency: "INR",
            }),
            ee = Object.freeze({
              ...i.envelope,
              operation: "india_gst.accommodation_final_component_tax_posted",
            });
          const ef = await recordFact(q, {
            entityType:
              "india_gst_accommodation_final_component_tax_journal_binding",
            entityId: String(b.posting_binding_id),
            envelope: ee,
            payload: ep,
          });
          if (ef.businessDate !== day.business_date)
            throw new Error("binding audit date mismatch");
          await this.#events.publish(q, {
            tenantId: i.tenantId,
            propertyNode: i.propertyNode,
            businessDate: day.business_date,
            aggregateType:
              "india_gst_accommodation_final_component_tax_journal_binding",
            aggregateId: String(b.posting_binding_id),
            eventType: "india_gst.accommodation_final_component_tax_posted",
            actorId: i.envelope.actorId,
            correlationId: i.envelope.requestId,
            payload: ep,
          });
          return {
            status: 201,
            body: makeBody(b, fr.grandTotalMinor, count, true),
          };
        },
      );
      return Object.freeze({ ...out.body, replayed: out.replayed });
    } catch (e) {
      throw this.#translate(e);
    }
  }
  #translate(e: unknown): Error {
    if (
      e instanceof IndiaFinalComponentTaxPostingValidationError ||
      e instanceof IndiaFinalComponentTaxPostingNotFoundError ||
      e instanceof IndiaFinalComponentTaxPostingConflictError
    )
      return e;
    if (
      e instanceof PositiveTaxFolioEligibilityNotFoundError ||
      e instanceof
        IndiaGstAccommodationFinalComponentTaxSemanticRouteNotFoundError
    )
      return new IndiaFinalComponentTaxPostingNotFoundError(e.message);
    if (
      e instanceof PositiveTaxFolioEligibilityConflictError ||
      e instanceof
        IndiaGstAccommodationFinalComponentTaxSemanticRouteConflictError
    )
      return new IndiaFinalComponentTaxPostingConflictError(e.message);
    const s =
      (e as { errno?: string; code?: string }).errno ??
      (e as { code?: string }).code;
    if (["23505", "40001", "40P01", "55000", "P0011"].includes(String(s)))
      return new IndiaFinalComponentTaxPostingConflictError(
        "posting conflicted with current authority",
      );
    return e as Error;
  }
}
