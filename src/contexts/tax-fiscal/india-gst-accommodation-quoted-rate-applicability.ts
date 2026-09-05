import { types as utilTypes } from "node:util";

import type { Tx } from "../../kernel";
import { parsePositiveTaxAttributionSnapshot } from "./attribution";
import {
  deriveIndiaGstAccommodationComponentRateSlabs,
} from "./india-gst-accommodation-levy-component-rate-schedule";
import {
  deriveIndiaGstAccommodationLevyComponentIdentity,
  type IndiaGstAccommodationLevyComponentIdentityInput,
  type IndiaGstAccommodationLevyComponentIdentityResult,
} from "./india-gst-accommodation-levy-component-identity";
import {
  deriveIndiaGstAccommodationRateChangeDate,
} from "./india-gst-accommodation-rate-change-date";
import {
  deriveIndiaGstAccommodationNativeInvoiceSource,
  type IndiaGstAccommodationNativeInvoiceSourceInput,
  type IndiaGstAccommodationNativeInvoiceSourceResult,
} from "./india-gst-accommodation-invoice-source";
import { IndiaGstAccommodationPaymentReceiptDateService } from "./india-gst-accommodation-payment-receipt-date";
import type { IndiaGstAccommodationRateVersionEvidence } from "./india-gst-accommodation-rate-version-pair";
import { IndiaGstAccommodationServiceProvisionDateService } from "./india-gst-accommodation-service-provision-date";
import {
  IndiaGstSection14RateSelectionService,
  type IndiaGstSection14RateSelectionInput,
  type IndiaGstSection14RateSelectionResult,
} from "./india-gst-section14-rate-selection";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const HASH = /^[0-9a-f]{64}$/;
const PERIOD_BOUND = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}(?::?\d{2})?)$/;
const INPUT_KEYS = [
  "tenantId", "propertyNode", "reservationId", "folioId", "reservationLineageId", "attributionId",
  "section14Input", "section14Result", "componentIdentityInput", "componentIdentityResult",
] as const;
const NATIVE_INPUT_KEYS = [
  "tenantId", "propertyNode", "reservationId", "folioId", "reservationLineageId", "attributionId",
  "nativeInvoiceSourceInput", "componentIdentityInput", "componentIdentityResult",
] as const;
const ROW_KEYS = [
  "tenant_id", "lineage_id", "property_node", "hold_binding_id", "hold_id", "attribution_id", "reservation_id", "segment_id", "sellable_unit_id", "folio_id",
  "origin_quote_hash", "snapshot_hash", "currency", "snapshot",
  "binding_row_id", "binding_hold_id", "hold_row_id", "binding_sellable_unit_id", "hold_sellable_unit_id", "segment_sellable_unit_id",
  "lineage_period", "binding_period", "hold_period", "segment_period",
  "binding_attribution_id", "attribution_row_id", "binding_origin_quote_hash", "binding_snapshot_hash", "binding_currency",
] as const;
const NATIVE_ROOT_ROW_KEYS = [
  "tenant_id", "property_node", "reservation_id", "lineage_id", "attribution_id",
  "service_id", "payment_id", "ordinary_id", "service_date", "books_date", "bank_date",
  "receipt_date", "amount_minor", "currency", "service_external_hash", "payment_external_hash",
  "ordinary_external_hash", "ordinary_regime", "ordinary_source", "ordinary_legal_basis",
  "ordinary_service_hash", "service_hash", "payment_hash", "ordinary_hash", "timing_id",
  "timing_folio_id", "prospective_document_id", "timing_service_id", "timing_service_hash",
  "timing_payment_id", "timing_payment_hash", "timing_ordinary_id", "timing_ordinary_hash",
  "timing_invoice_date", "timing_hash", "issuing_transaction_id", "transaction_timestamp",
  "property_timezone",
] as const;

type RecordValue = Record<string, unknown>;
type Family = "igst" | "cgst_sgst" | "cgst_utgst";
type ComponentIdentity = "igst" | "cgst" | "sgst" | "utgst";
type ScopeInput = Readonly<{
  tenantId: string; propertyNode: string; reservationId: string; folioId: string;
  reservationLineageId: string; attributionId: string;
}>;
type ValidatedScope = Readonly<{
  tenantId: string; propertyNode: string; reservationId: string; folioId: string;
  lineageId: string; attributionId: string;
}>;

interface PersistedLineageRow {
  readonly tenant_id: string;
  readonly lineage_id: string;
  readonly property_node: string;
  readonly hold_binding_id: string;
  readonly hold_id: string;
  readonly attribution_id: string;
  readonly reservation_id: string;
  readonly segment_id: string;
  readonly sellable_unit_id: string;
  readonly folio_id: string;
  readonly origin_quote_hash: string;
  readonly snapshot_hash: string;
  readonly currency: string;
  readonly snapshot: unknown;
  readonly binding_row_id: string;
  readonly binding_hold_id: string;
  readonly hold_row_id: string;
  readonly binding_sellable_unit_id: string;
  readonly hold_sellable_unit_id: string;
  readonly segment_sellable_unit_id: string;
  readonly lineage_period: string;
  readonly binding_period: string;
  readonly hold_period: string;
  readonly segment_period: string;
  readonly binding_attribution_id: string;
  readonly attribution_row_id: string;
  readonly binding_origin_quote_hash: string;
  readonly binding_snapshot_hash: string;
  readonly binding_currency: string;
}
interface PersistedNativeRootRow {
  readonly tenant_id: string; readonly property_node: string; readonly reservation_id: string;
  readonly lineage_id: string; readonly attribution_id: string; readonly service_id: string;
  readonly payment_id: string; readonly ordinary_id: string; readonly service_date: string;
  readonly books_date: string; readonly bank_date: string; readonly receipt_date: string;
  readonly amount_minor: string; readonly currency: string; readonly service_external_hash: string;
  readonly payment_external_hash: string; readonly ordinary_external_hash: string;
  readonly ordinary_regime: string; readonly ordinary_source: string;
  readonly ordinary_legal_basis: string; readonly ordinary_service_hash: string;
  readonly service_hash: string; readonly payment_hash: string; readonly ordinary_hash: string;
  readonly timing_id: string; readonly timing_folio_id: string; readonly prospective_document_id: string;
  readonly timing_service_id: string; readonly timing_service_hash: string;
  readonly timing_payment_id: string; readonly timing_payment_hash: string;
  readonly timing_ordinary_id: string; readonly timing_ordinary_hash: string;
  readonly timing_invoice_date: string; readonly timing_hash: string;
  readonly issuing_transaction_id: string; readonly transaction_timestamp: string;
  readonly property_timezone: string;
}

export interface IndiaGstAccommodationQuotedRateApplicabilityInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly reservationId: string;
  readonly folioId: string;
  readonly reservationLineageId: string;
  readonly attributionId: string;
  readonly section14Input: IndiaGstSection14RateSelectionInput;
  readonly section14Result: IndiaGstSection14RateSelectionResult;
  readonly componentIdentityInput: IndiaGstAccommodationLevyComponentIdentityInput;
  readonly componentIdentityResult: IndiaGstAccommodationLevyComponentIdentityResult;
}

export interface IndiaGstAccommodationQuotedRateApplicabilityResult {
  readonly section14: Readonly<{
    readonly case: IndiaGstSection14RateSelectionResult["case"];
    readonly timeOfSupplyDate: string;
    readonly selectedVersionSide: "predecessor" | "successor";
    readonly selectedVersion: IndiaGstSection14RateSelectionResult["selectedVersion"];
  }>;
  readonly reservationLineage: Readonly<{
    readonly lineageId: string;
    readonly holdBindingId: string;
    readonly reservationId: string;
    readonly segmentId: string;
    readonly folioId: string;
    readonly attributionId: string;
    readonly originQuoteHash: string;
    readonly snapshotHash: string;
    readonly currency: "INR";
  }>;
  readonly components: readonly Readonly<{
    readonly ordinal: string;
    readonly businessDate: string;
    readonly quotedAmountMinor: string;
    readonly slab: Readonly<{
      readonly uptoMinor: 750000 | null;
      readonly aggregateRate: number;
      readonly aggregateRateBasisPoints: number;
      readonly itcEligible: boolean;
      readonly components: readonly Readonly<{
        readonly identity: ComponentIdentity;
        readonly rate: number;
        readonly rateBasisPoints: number;
      }>[];
    }>;
  }>[];
  readonly predecessorHashes: Readonly<{
    readonly section14: string;
    readonly levyComponentIdentity: string;
    readonly reservationLineage: string;
    readonly attributionSnapshot: string;
  }>;
  readonly evidenceHash: string;
}

export interface IndiaGstAccommodationNativeQuotedRateApplicabilityInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly reservationId: string;
  readonly folioId: string;
  readonly reservationLineageId: string;
  readonly attributionId: string;
  readonly nativeInvoiceSourceInput: IndiaGstAccommodationNativeInvoiceSourceInput;
  readonly componentIdentityInput: IndiaGstAccommodationLevyComponentIdentityInput;
  readonly componentIdentityResult: IndiaGstAccommodationLevyComponentIdentityResult;
}

export type IndiaGstAccommodationNativeQuotedRateSelection =
  | Readonly<{
    readonly kind: "ordinary_section13_single_version";
    readonly timeOfSupplyDate: string;
    readonly selectedVersion: IndiaGstAccommodationRateVersionEvidence;
  }>
  | Readonly<{
    readonly kind: "genuine_section14_rate_change";
    readonly case: IndiaGstSection14RateSelectionResult["case"];
    readonly timeOfSupplyDate: string;
    readonly selectedVersionSide: "predecessor" | "successor";
    readonly selectedVersion: IndiaGstAccommodationRateVersionEvidence;
    readonly section14EvidenceHash: string;
  }>;

export interface IndiaGstAccommodationNativeQuotedRateApplicabilityResult {
  readonly kind: "native_current_transaction";
  readonly rateSelection: IndiaGstAccommodationNativeQuotedRateSelection;
  readonly nativeTiming: Readonly<{
    readonly nativeTimingId: string;
    readonly prospectiveDocumentId: string;
    readonly serviceProvisionSnapshotId: string;
    readonly paymentReceiptSnapshotId: string;
    readonly ordinaryRegimeEvidenceId: string;
    readonly invoiceIssueDate: string;
    readonly branch: IndiaGstAccommodationNativeInvoiceSourceResult["timing"]["branch"];
    readonly timeOfSupplyDate: string;
    readonly evidenceHash: string;
  }>;
  readonly reservationLineage: IndiaGstAccommodationQuotedRateApplicabilityResult["reservationLineage"];
  readonly components: IndiaGstAccommodationQuotedRateApplicabilityResult["components"];
  readonly predecessorHashes: Readonly<{
    readonly nativeInvoiceSource: string;
    readonly nativeTiming: string;
    readonly serviceProvisionRecording: string;
    readonly paymentReceiptRecording: string;
    readonly ordinaryRegimeRecording: string;
    readonly serviceProvisionProjection: string;
    readonly paymentReceiptProjection: string;
    readonly rateSource: string;
    readonly levyComponentIdentity: string;
    readonly reservationLineage: string;
    readonly attributionSnapshot: string;
  }>;
  readonly evidenceHash: string;
}

export class IndiaGstAccommodationQuotedRateApplicabilityValidationError extends Error {
  constructor(message: string) { super(message); this.name = "IndiaGstAccommodationQuotedRateApplicabilityValidationError"; }
}
export class IndiaGstAccommodationQuotedRateApplicabilityNotFoundError extends Error {
  constructor(message: string) { super(message); this.name = "IndiaGstAccommodationQuotedRateApplicabilityNotFoundError"; }
}
export class IndiaGstAccommodationQuotedRateApplicabilityConflictError extends Error {
  constructor(message: string) { super(message); this.name = "IndiaGstAccommodationQuotedRateApplicabilityConflictError"; }
}

function validation(message: string): never { throw new IndiaGstAccommodationQuotedRateApplicabilityValidationError(message); }
function conflict(message: string): never { throw new IndiaGstAccommodationQuotedRateApplicabilityConflictError(message); }
function exact(value: unknown, expected: readonly string[], subject: string): RecordValue {
  if (typeof value !== "object" || value === null || Array.isArray(value) || utilTypes.isProxy(value)
      || Object.getOwnPropertySymbols(value).length !== 0
      || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    return validation(`${subject} must be an exact plain object`);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value), keys = Object.keys(descriptors).sort(), wanted = [...expected].sort();
  if (keys.length !== wanted.length || keys.some((key, index) => key !== wanted[index])
      || Object.values(descriptors).some((d) => d.get !== undefined || d.set !== undefined || d.enumerable !== true || !("value" in d))) {
    return validation(`${subject} shape is invalid`);
  }
  return value as RecordValue;
}
function frozen(value: unknown, seen = new Set<object>()): void {
  if (value === null || typeof value === "string" || typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value))) return;
  if (typeof value !== "object" || seen.has(value) || utilTypes.isProxy(value) || !Object.isFrozen(value) || Object.getOwnPropertySymbols(value).length !== 0) validation("input must be a deeply frozen non-repeating graph");
  seen.add(value);
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) validation("input must contain plain records only");
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Array.isArray(value) && (Object.keys(value).length !== value.length || Object.keys(value).some((key, index) => key !== String(index)))) validation("input arrays must be exact and dense");
  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (key === "length" && Array.isArray(value)) continue;
    if (descriptor.get !== undefined || descriptor.set !== undefined || descriptor.enumerable !== true || descriptor.configurable !== false || !("value" in descriptor) || descriptor.writable !== false) validation("input contains an unsafe field");
    frozen(descriptor.value, seen);
  }
}
function frozenNative(value: unknown, seen = new Set<object>()): void {
  if (value === null || typeof value === "string" || typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value))) return;
  if (typeof value === "object" && seen.has(value)) return;
  if (typeof value !== "object" || utilTypes.isProxy(value) || !Object.isFrozen(value) || Object.getOwnPropertySymbols(value).length !== 0) validation("native input must be a deeply frozen graph");
  seen.add(value);
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) validation("native input must contain plain records only");
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Array.isArray(value) && (Object.keys(value).length !== value.length || Object.keys(value).some((key, index) => key !== String(index)))) validation("native input arrays must be exact and dense");
  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (key === "length" && Array.isArray(value)) continue;
    if (descriptor.get !== undefined || descriptor.set !== undefined || descriptor.enumerable !== true || descriptor.configurable !== false || !("value" in descriptor) || descriptor.writable !== false) validation("native input contains an unsafe field");
    frozenNative(descriptor.value, seen);
  }
}
function uuid(value: unknown, subject: string): string { return typeof value === "string" && UUID.test(value) ? value : validation(`${subject} must be a canonical UUID`); }
function hash(value: unknown, subject: string): string { return typeof value === "string" && HASH.test(value) ? value : conflict(`${subject} must be a canonical SHA-256`); }
function period(value: unknown, subject: string): string {
  if (typeof value !== "string") conflict(`${subject} must be a canonical PostgreSQL period`);
  const match = /^\[(?:\"([^\"]+)\"|([^,\[\]\(\)]+)),(?:\"([^\"]+)\"|([^,\[\]\(\)]+))\)$/.exec(value);
  const lower = match?.[1] ?? match?.[2], upper = match?.[3] ?? match?.[4];
  if (!lower || !upper || !PERIOD_BOUND.test(lower) || !PERIOD_BOUND.test(upper)
      || !Number.isFinite(Date.parse(lower)) || !Number.isFinite(Date.parse(upper)) || Date.parse(lower) >= Date.parse(upper)) {
    conflict(`${subject} must be a canonical non-empty PostgreSQL period`);
  }
  return value;
}
function equal(supplied: unknown, fresh: unknown, subject: string): void { if (JSON.stringify(supplied) !== JSON.stringify(fresh)) conflict(`${subject} does not byte-match rederived truth`); }
function digest(value: unknown): string { return new Bun.CryptoHasher("sha256").update(JSON.stringify(value)).digest("hex"); }
function positiveMinor(value: unknown): string {
  if (typeof value !== "string" || !/^[1-9][0-9]*$/.test(value)) conflict("quoted room-night amount must be a positive canonical minor-unit value");
  try { if (BigInt(value) > 9_223_372_036_854_775_807n) conflict("quoted room-night amount exceeds the persisted money bound"); } catch { conflict("quoted room-night amount is invalid"); }
  return value;
}

function normalize(raw: unknown): IndiaGstAccommodationQuotedRateApplicabilityInput {
  frozen(raw);
  const input = exact(raw, INPUT_KEYS, "quoted rate-applicability input");
  return input as unknown as IndiaGstAccommodationQuotedRateApplicabilityInput;
}
function normalizeNative(raw: unknown): IndiaGstAccommodationNativeQuotedRateApplicabilityInput {
  frozenNative(raw);
  return exact(raw, NATIVE_INPUT_KEYS, "native quoted rate-applicability input") as unknown as IndiaGstAccommodationNativeQuotedRateApplicabilityInput;
}
function scope(input: ScopeInput): ValidatedScope {
  return Object.freeze({ tenantId: uuid(input.tenantId, "tenantId"), propertyNode: uuid(input.propertyNode, "propertyNode"), reservationId: uuid(input.reservationId, "reservationId"), folioId: uuid(input.folioId, "folioId"), lineageId: uuid(input.reservationLineageId, "reservationLineageId"), attributionId: uuid(input.attributionId, "attributionId") });
}
function expectedIdentities(family: Family): readonly ComponentIdentity[] {
  return family === "igst" ? ["igst"] : family === "cgst_sgst" ? ["cgst", "sgst"] : ["cgst", "utgst"];
}
function selectedSlab(
  family: Family,
  componentRateSlabs: ReturnType<typeof deriveIndiaGstAccommodationComponentRateSlabs>,
  amount: string,
) {
  const minor = BigInt(amount);
  if (componentRateSlabs.length !== 2 || componentRateSlabs[0]?.uptoMinor !== 750000
      || componentRateSlabs[1]?.uptoMinor !== null) conflict("GST_ROOM schedule is not the admitted two-band partition");
  const slab = minor <= 750000n ? componentRateSlabs[0] : componentRateSlabs[1];
  if (!slab || !Number.isSafeInteger(slab.aggregateRateBasisPoints) || slab.aggregateRateBasisPoints <= 0 || !Number.isFinite(slab.aggregateRate)) conflict("GST_ROOM slab is invalid");
  const identities = expectedIdentities(family);
  if (slab.components.length !== identities.length || slab.components.some((component, index) => component.identity !== identities[index] || !Number.isSafeInteger(component.rateBasisPoints) || component.rateBasisPoints <= 0 || !Number.isFinite(component.rate))) conflict("GST_ROOM component schedule is invalid");
  const sum = slab.components.reduce((total, component) => total + component.rateBasisPoints, 0);
  if (sum !== slab.aggregateRateBasisPoints) conflict("GST_ROOM component rates do not reconcile to their aggregate schedule");
  return Object.freeze({ uptoMinor: slab.uptoMinor, aggregateRate: slab.aggregateRate, aggregateRateBasisPoints: slab.aggregateRateBasisPoints, itcEligible: slab.itcEligible, components: Object.freeze(slab.components.map((component) => Object.freeze({ identity: component.identity, rate: component.rate, rateBasisPoints: component.rateBasisPoints }))) });
}
async function persisted(tx: Tx, input: ScopeInput): Promise<PersistedLineageRow> {
  const rows = await tx<PersistedLineageRow[]>`
    SELECT lineage.tenant_id::text AS tenant_id, lineage.id::text AS lineage_id,
           lineage.property_node::text AS property_node, lineage.binding_id::text AS hold_binding_id,
           lineage.hold_id::text AS hold_id, lineage.attribution_id::text AS attribution_id,
           lineage.reservation_id::text AS reservation_id, lineage.segment_id::text AS segment_id,
           lineage.sellable_unit_id::text AS sellable_unit_id,
           folio.id::text AS folio_id,
           lineage.origin_quote_hash, lineage.snapshot_hash, lineage.currency::text AS currency,
           attribution.snapshot AS snapshot,
           hold_binding.id::text AS binding_row_id, hold_binding.hold_id::text AS binding_hold_id,
           hold.id::text AS hold_row_id,
           hold_binding.sellable_unit_id::text AS binding_sellable_unit_id,
           hold.sellable_unit_id::text AS hold_sellable_unit_id,
           segment.sellable_unit_id::text AS segment_sellable_unit_id,
           lineage.period::text AS lineage_period, hold_binding.period::text AS binding_period,
           hold.period::text AS hold_period, segment.period::text AS segment_period,
           hold_binding.attribution_id::text AS binding_attribution_id,
           attribution.id::text AS attribution_row_id,
           hold_binding.origin_quote_hash AS binding_origin_quote_hash,
           hold_binding.snapshot_hash AS binding_snapshot_hash,
           hold_binding.currency::text AS binding_currency
      FROM public.tax_attribution_reservation_binding AS lineage
      JOIN public.tax_attribution_hold_binding AS hold_binding
        ON hold_binding.tenant_id = lineage.tenant_id AND hold_binding.id = lineage.binding_id
       AND hold_binding.property_node = lineage.property_node AND hold_binding.hold_id = lineage.hold_id
       AND hold_binding.attribution_id = lineage.attribution_id AND hold_binding.sellable_unit_id = lineage.sellable_unit_id
       AND hold_binding.period = lineage.period AND hold_binding.origin_quote_hash = lineage.origin_quote_hash
       AND hold_binding.snapshot_hash = lineage.snapshot_hash AND hold_binding.currency = lineage.currency
      JOIN public.hold AS hold
        ON hold.tenant_id = lineage.tenant_id AND hold.id = lineage.hold_id
       AND hold.property_node = lineage.property_node AND hold.sellable_unit_id = lineage.sellable_unit_id
       AND hold.period = lineage.period AND hold.status = 'consumed'
      JOIN public.reservation AS reservation
        ON reservation.tenant_id = lineage.tenant_id AND reservation.id = lineage.reservation_id
       AND reservation.property_node = lineage.property_node AND reservation.currency = lineage.currency
      JOIN public.reservation_segment AS segment
        ON segment.tenant_id = lineage.tenant_id AND segment.id = lineage.segment_id
       AND segment.reservation_id = lineage.reservation_id AND segment.sellable_unit_id = lineage.sellable_unit_id
       AND segment.period = lineage.period
      JOIN public.folio AS folio
        ON folio.tenant_id = lineage.tenant_id AND folio.id = ${input.folioId}::uuid
       AND folio.reservation_id = lineage.reservation_id AND folio.window_no = 1
      JOIN public.tax_attribution_snapshot AS attribution
        ON attribution.tenant_id = lineage.tenant_id AND attribution.id = lineage.attribution_id
       AND attribution.property_node = lineage.property_node AND attribution.origin_kind = 'rate_quote'
       AND attribution.origin_quote_hash = lineage.origin_quote_hash AND attribution.snapshot_hash = lineage.snapshot_hash
       AND attribution.currency = lineage.currency
     WHERE lineage.tenant_id = ${input.tenantId}::uuid
       AND lineage.tenant_id = current_setting('app.tenant_id', true)::uuid
       AND lineage.id = ${input.reservationLineageId}::uuid
       AND lineage.property_node = ${input.propertyNode}::uuid
       AND lineage.attribution_id = ${input.attributionId}::uuid
       AND lineage.reservation_id = ${input.reservationId}::uuid
  `;
  if (rows.length === 0) throw new IndiaGstAccommodationQuotedRateApplicabilityNotFoundError("quoted-tax reservation lineage is unavailable");
  if (rows.length !== 1 || !rows[0]) conflict("quoted-tax reservation lineage is ambiguous");
  return rows[0];
}

async function authenticatePersistedNativeRoots(
  tx: Tx,
  input: IndiaGstAccommodationNativeQuotedRateApplicabilityInput,
  nativeSource: IndiaGstAccommodationNativeInvoiceSourceResult,
): Promise<Readonly<{
  serviceProvisionRecording: string;
  paymentReceiptRecording: string;
  ordinaryRegimeRecording: string;
}>> {
  const roots = input.nativeInvoiceSourceInput;
  // Date-result hashes authenticate canonical projections. The timing FKs below
  // bind different, SQL-owned intake-recording hashes; neither layer substitutes
  // for the other.
  const freshServiceProvision = await new IndiaGstAccommodationServiceProvisionDateService().resolve(
    tx,
    Object.freeze({
      tenantId: input.tenantId,
      propertyNode: input.propertyNode,
      reservationId: input.reservationId,
      serviceProvisionSnapshotId: nativeSource.timing.serviceProvisionSnapshotId,
      serviceProvisionDate: nativeSource.timing.serviceProvisionDate,
    }),
  );
  equal(roots.serviceProvision, freshServiceProvision, "supplied service-provision date projection");
  const freshPaymentReceipt = await new IndiaGstAccommodationPaymentReceiptDateService().resolve(
    tx,
    Object.freeze({
      tenantId: input.tenantId,
      propertyNode: input.propertyNode,
      reservationId: input.reservationId,
      serviceProvisionSnapshotId: nativeSource.timing.serviceProvisionSnapshotId,
      paymentReceiptSnapshotId: nativeSource.timing.paymentReceiptSnapshotId,
      paymentReceiptDate: nativeSource.timing.paymentReceiptDate,
    }),
  );
  equal(roots.paymentReceipt, freshPaymentReceipt, "supplied payment-receipt date projection");
  const rows = await tx<PersistedNativeRootRow[]>`
    SELECT service.tenant_id::text AS tenant_id, service.property_node::text AS property_node,
           service.reservation_id::text AS reservation_id,
           service.reservation_lineage_id::text AS lineage_id,
           service.attribution_id::text AS attribution_id, service.id::text AS service_id,
           payment.id::text AS payment_id, ordinary.id::text AS ordinary_id,
           service.service_provision_date::text AS service_date,
           payment.supplier_books_entry_date::text AS books_date,
           payment.supplier_bank_credit_date::text AS bank_date,
           payment.payment_receipt_date::text AS receipt_date,
           payment.amount_minor::text AS amount_minor, payment.currency::text AS currency,
           service.service_provision_evidence_sha256 AS service_external_hash,
           payment.payment_receipt_evidence_sha256 AS payment_external_hash,
           ordinary.ordinary_regime_evidence_sha256 AS ordinary_external_hash,
           ordinary.regime AS ordinary_regime,
           ordinary.ordinary_regime_source AS ordinary_source,
           ordinary.legal_basis AS ordinary_legal_basis,
           ordinary.service_evidence_hash AS ordinary_service_hash,
           service.evidence_hash AS service_hash, payment.evidence_hash AS payment_hash,
           ordinary.evidence_hash AS ordinary_hash, timing.id::text AS timing_id,
           timing.folio_id::text AS timing_folio_id,
           timing.prospective_document_id::text AS prospective_document_id,
           timing.service_provision_snapshot_id::text AS timing_service_id,
           timing.service_provision_evidence_hash AS timing_service_hash,
           timing.payment_receipt_snapshot_id::text AS timing_payment_id,
           timing.payment_receipt_evidence_hash AS timing_payment_hash,
           timing.ordinary_regime_evidence_id::text AS timing_ordinary_id,
           timing.ordinary_regime_evidence_hash AS timing_ordinary_hash,
           timing.invoice_issue_date::text AS timing_invoice_date,
           timing.evidence_hash AS timing_hash,
           timing.issuing_transaction_id::text AS issuing_transaction_id,
           timing.transaction_timestamp::text AS transaction_timestamp,
           timing.property_timezone
      FROM public.india_gst_native_invoice_timing AS timing
      JOIN public.india_gst_accommodation_service_provision_snapshot AS service
        ON service.tenant_id=timing.tenant_id
       AND service.id=timing.service_provision_snapshot_id
       AND service.evidence_hash=timing.service_provision_evidence_hash
      JOIN public.india_gst_accommodation_payment_receipt_snapshot AS payment
        ON payment.tenant_id=timing.tenant_id
       AND payment.id=timing.payment_receipt_snapshot_id
       AND payment.service_provision_snapshot_id=service.id
       AND payment.evidence_hash=timing.payment_receipt_evidence_hash
      JOIN public.india_gst_accommodation_ordinary_regime_evidence AS ordinary
        ON ordinary.tenant_id=timing.tenant_id
       AND ordinary.id=timing.ordinary_regime_evidence_id
       AND ordinary.evidence_hash=timing.ordinary_regime_evidence_hash
       AND ordinary.service_provision_snapshot_id=service.id
       AND ordinary.property_node=service.property_node
       AND ordinary.reservation_id=service.reservation_id
       AND ordinary.reservation_lineage_id=service.reservation_lineage_id
       AND ordinary.attribution_id=service.attribution_id
     WHERE timing.tenant_id=${input.tenantId}::uuid
       AND timing.tenant_id=current_setting('app.tenant_id',true)::uuid
       AND timing.id=${nativeSource.timing.nativeTimingId}::uuid
       AND timing.folio_id=${input.folioId}::uuid
       AND timing.prospective_document_id=${nativeSource.timing.prospectiveDocumentId}::uuid
       AND service.id=${nativeSource.timing.serviceProvisionSnapshotId}::uuid
       AND payment.id=${nativeSource.timing.paymentReceiptSnapshotId}::uuid
       AND ordinary.id=${nativeSource.timing.ordinaryRegimeEvidenceId}::uuid
       AND service.property_node=${input.propertyNode}::uuid
       AND service.reservation_id=${input.reservationId}::uuid
       AND service.reservation_lineage_id=${input.reservationLineageId}::uuid
       AND service.attribution_id=${input.attributionId}::uuid
       AND timing.issuing_transaction_id=pg_current_xact_id()
       AND timing.transaction_timestamp=transaction_timestamp()
       AND timing.invoice_issue_date=(transaction_timestamp() AT TIME ZONE timing.property_timezone)::date
  `;
  if (rows.length === 0) throw new IndiaGstAccommodationQuotedRateApplicabilityNotFoundError("persisted native source roots are unavailable");
  if (rows.length !== 1 || !rows[0]) conflict("persisted native source roots are ambiguous");
  const row = exact(rows[0], NATIVE_ROOT_ROW_KEYS, "persisted native source roots") as unknown as PersistedNativeRootRow;
  if (uuid(row.tenant_id, "native root tenant") !== input.tenantId || uuid(row.property_node, "native root property") !== input.propertyNode || uuid(row.reservation_id, "native root reservation") !== input.reservationId || uuid(row.lineage_id, "native root lineage") !== input.reservationLineageId || uuid(row.attribution_id, "native root attribution") !== input.attributionId
      || uuid(row.service_id, "native service root") !== nativeSource.timing.serviceProvisionSnapshotId || uuid(row.payment_id, "native payment root") !== nativeSource.timing.paymentReceiptSnapshotId || uuid(row.ordinary_id, "native ordinary root") !== nativeSource.timing.ordinaryRegimeEvidenceId
      || row.service_date !== nativeSource.timing.serviceProvisionDate || row.books_date !== nativeSource.timing.supplierBooksEntryDate || row.bank_date !== nativeSource.timing.supplierBankCreditDate || row.receipt_date !== nativeSource.timing.paymentReceiptDate || row.amount_minor !== nativeSource.timing.amountMinor || row.currency !== "INR"
      || hash(row.service_external_hash, "persisted service external hash") !== freshServiceProvision.serviceProvisionEvidenceSha256 || hash(row.payment_external_hash, "persisted payment external hash") !== freshPaymentReceipt.paymentReceiptEvidenceSha256 || hash(row.ordinary_external_hash, "persisted ordinary external hash") !== roots.ordinaryRegime.ordinaryRegimeEvidenceSha256
      || row.ordinary_regime !== roots.ordinaryRegime.regime || row.ordinary_source !== roots.ordinaryRegime.ordinaryRegimeSource || row.ordinary_legal_basis !== roots.ordinaryRegime.legalBasis
      || hash(row.ordinary_service_hash, "persisted ordinary service recording hash") !== hash(row.service_hash, "persisted service recording hash") || hash(row.ordinary_hash, "persisted ordinary recording hash") !== roots.ordinaryRegime.evidenceHash
      || uuid(row.timing_id, "persisted native timing") !== nativeSource.timing.nativeTimingId || uuid(row.timing_folio_id, "persisted native timing folio") !== input.folioId || uuid(row.prospective_document_id, "persisted prospective document") !== nativeSource.timing.prospectiveDocumentId
      || uuid(row.timing_service_id, "persisted timing service") !== nativeSource.timing.serviceProvisionSnapshotId || hash(row.timing_service_hash, "persisted timing service recording hash") !== hash(row.service_hash, "persisted service recording hash")
      || uuid(row.timing_payment_id, "persisted timing payment") !== nativeSource.timing.paymentReceiptSnapshotId || hash(row.timing_payment_hash, "persisted timing payment recording hash") !== hash(row.payment_hash, "persisted payment recording hash")
      || uuid(row.timing_ordinary_id, "persisted timing ordinary regime") !== nativeSource.timing.ordinaryRegimeEvidenceId || hash(row.timing_ordinary_hash, "persisted timing ordinary recording hash") !== hash(row.ordinary_hash, "persisted ordinary recording hash")
      || row.timing_invoice_date !== nativeSource.timing.invoiceIssueDate || hash(row.timing_hash, "persisted timing projection hash") !== roots.nativeTiming.evidenceHash
      || typeof row.issuing_transaction_id !== "string" || !/^[1-9][0-9]*$/.test(row.issuing_transaction_id)
      || typeof row.transaction_timestamp !== "string" || row.transaction_timestamp.length === 0
      || typeof row.property_timezone !== "string" || row.property_timezone.length === 0 || row.property_timezone !== row.property_timezone.trim()) conflict("persisted native source roots conflict with freshly derived applicability");
  return Object.freeze({
    serviceProvisionRecording: hash(row.service_hash, "persisted service recording hash"),
    paymentReceiptRecording: hash(row.payment_hash, "persisted payment recording hash"),
    ordinaryRegimeRecording: hash(row.ordinary_hash, "persisted ordinary recording hash"),
  });
}

async function persistedQuoteComponents(
  tx: Tx,
  input: ScopeInput,
  componentRateSlabs: ReturnType<typeof deriveIndiaGstAccommodationComponentRateSlabs>,
  componentIdentity: IndiaGstAccommodationLevyComponentIdentityResult,
  serviceLineage: IndiaGstAccommodationNativeInvoiceSourceInput["serviceProvision"]["reservationLineage"],
  expectedAmountMinor: string,
) {
  const { tenantId, propertyNode, reservationId, folioId, lineageId, attributionId } = scope(input);
  const row = exact(await persisted(tx, input), ROW_KEYS, "persisted quoted-tax reservation lineage") as unknown as PersistedLineageRow;
  const storedHoldBindingId = uuid(row.hold_binding_id, "stored hold binding"), storedHoldId = uuid(row.hold_id, "stored hold"), storedSellableUnitId = uuid(row.sellable_unit_id, "stored sellable unit"), storedPeriod = period(row.lineage_period, "stored lineage period");
  if (uuid(row.tenant_id, "stored tenant") !== tenantId || uuid(row.lineage_id, "stored lineage") !== lineageId || uuid(row.property_node, "stored property") !== propertyNode || storedHoldBindingId !== serviceLineage.holdBindingId || uuid(row.attribution_id, "stored attribution") !== attributionId || uuid(row.reservation_id, "stored reservation") !== reservationId || uuid(row.segment_id, "stored segment") !== serviceLineage.segmentId || uuid(row.folio_id, "stored folio") !== folioId || row.currency !== "INR"
      || uuid(row.binding_row_id, "binding row") !== storedHoldBindingId || uuid(row.binding_hold_id, "binding hold") !== storedHoldId || uuid(row.hold_row_id, "hold row") !== storedHoldId
      || uuid(row.binding_sellable_unit_id, "binding sellable unit") !== storedSellableUnitId || uuid(row.hold_sellable_unit_id, "hold sellable unit") !== storedSellableUnitId || uuid(row.segment_sellable_unit_id, "segment sellable unit") !== storedSellableUnitId
      || storedPeriod !== row.binding_period || storedPeriod !== row.hold_period || storedPeriod !== row.segment_period
      || uuid(row.binding_attribution_id, "binding attribution") !== attributionId || uuid(row.attribution_row_id, "attribution row") !== attributionId
      || row.binding_origin_quote_hash !== row.origin_quote_hash || row.binding_snapshot_hash !== row.snapshot_hash || row.binding_currency !== row.currency) conflict("persisted quoted-tax lineage conflicts with independently projected provenance");
  const snapshotHash = hash(row.snapshot_hash, "stored snapshot hash"), originQuoteHash = hash(row.origin_quote_hash, "stored quote hash");
  const snapshot = parsePositiveTaxAttributionSnapshot(row.snapshot);
  if (snapshot.origin.kind !== "rate_quote" || snapshot.origin.quoteHash !== originQuoteHash || snapshot.snapshotHash !== snapshotHash || snapshot.currency !== "INR" || snapshot.revenueLine.lineId !== "room" || snapshot.revenueLine.revenueGroup !== "room_revenue" || serviceLineage.lineageId !== lineageId || serviceLineage.attributionId !== attributionId || serviceLineage.reservationId !== reservationId || serviceLineage.originQuoteHash !== originQuoteHash || serviceLineage.snapshotHash !== snapshotHash || serviceLineage.currency !== "INR") conflict("persisted canonical attribution conflicts with reservation lineage");
  let total = 0n;
  const ordinals = new Set<string>();
  const components = snapshot.revenueLine.roomNights.map((roomNight) => {
    if (ordinals.has(roomNight.index)) conflict("quoted room-night ordinal is duplicated");
    ordinals.add(roomNight.index);
    const quotedAmountMinor = positiveMinor(roomNight.amountMinor); total += BigInt(quotedAmountMinor);
    return Object.freeze({ ordinal: roomNight.index, businessDate: roomNight.businessDate, quotedAmountMinor, slab: selectedSlab(componentIdentity.componentFamily, componentRateSlabs, quotedAmountMinor) });
  });
  if (components.length === 0 || total.toString() !== snapshot.revenueLine.inputAmountMinor || snapshot.evaluation.grandTotalMinor !== expectedAmountMinor) conflict("quoted room-night components do not reconcile to the full attribution");
  const lineage = Object.freeze({ lineageId, holdBindingId: storedHoldBindingId, reservationId, segmentId: uuid(row.segment_id, "stored segment"), folioId, attributionId, originQuoteHash, snapshotHash, currency: "INR" as const });
  const provenLineage = Object.freeze({ ...lineage, holdId: storedHoldId, sellableUnitId: storedSellableUnitId, period: storedPeriod });
  return Object.freeze({ components: Object.freeze(components), lineage, reservationLineageHash: digest({ tenantId, ...provenLineage }), attributionSnapshotHash: snapshot.snapshotHash, snapshot });
}

export class IndiaGstAccommodationQuotedRateApplicabilityService {
  readonly #section14 = new IndiaGstSection14RateSelectionService();

  async resolve(tx: Tx, raw: IndiaGstAccommodationQuotedRateApplicabilityInput): Promise<IndiaGstAccommodationQuotedRateApplicabilityResult> {
    if (typeof tx !== "function") validation("tenant transaction is unavailable");
    const input = normalize(raw);
    const { tenantId, propertyNode, reservationId, folioId } = scope(input);
    try {
      const section14 = await this.#section14.resolve(tx, input.section14Input);
      equal(input.section14Result, section14, "supplied Section14 result");
      const rateChange = deriveIndiaGstAccommodationRateChangeDate({ tenantId, rateVersionPair: input.section14Input.rateVersionPair });
      equal(input.section14Input.rateChangeDateEvidence, rateChange, "supplied rate-change evidence");
      const componentIdentity = deriveIndiaGstAccommodationLevyComponentIdentity(input.componentIdentityInput);
      equal(input.componentIdentityResult, componentIdentity, "supplied levy-component identity");
      if (input.section14Input.tenantId !== tenantId || input.section14Input.propertyNode !== propertyNode || input.section14Input.reservationId !== reservationId || input.componentIdentityInput.tenantId !== tenantId || componentIdentity.propertyNode !== propertyNode || componentIdentity.reservationId !== reservationId || componentIdentity.folioId !== folioId || componentIdentity.supplyDate !== section14.serviceProvisionDate || JSON.stringify(input.componentIdentityInput.historicalResolution.rateVersionPair) !== JSON.stringify(input.section14Input.rateVersionPair)) conflict("complete predecessor identity conflicts with quoted applicability input");
      const selectedPairMember = section14.selectedVersionSide === "predecessor"
        ? input.section14Input.rateVersionPair.predecessor
        : input.section14Input.rateVersionPair.successor;
      if (selectedPairMember.key !== "in-gst-lodging" || input.section14Input.rateVersionPair.sourceHashes.notification15_2025 !== rateChange.notification15SourceHash || selectedPairMember.extensionId !== section14.selectedVersion.extensionId || selectedPairMember.version !== section14.selectedVersion.version || selectedPairMember.status !== section14.selectedVersion.status || selectedPairMember.contentHash !== section14.selectedVersion.contentHash || selectedPairMember.effectiveFromInstant !== section14.selectedVersion.effectiveFromInstant || selectedPairMember.effectiveToInstant !== section14.selectedVersion.effectiveToInstant) conflict("Section14-selected pair member conflicts with its result");
      const componentRateSlabs = deriveIndiaGstAccommodationComponentRateSlabs(componentIdentity.componentIdentities, selectedPairMember.gstRoomSlabs);
      const serviceLineage = input.section14Input.serviceProvisionResult.reservationLineage;
      const persistedResult = await persistedQuoteComponents(tx, input, componentRateSlabs, componentIdentity, serviceLineage, input.section14Input.paymentReceiptResult.amountMinor);
      const { components, lineage, snapshot } = persistedResult;
      if (snapshot.evaluation.grandTotalMinor !== input.section14Input.paymentReceiptResult.amountMinor || input.section14Input.paymentReceiptResult.currency !== "INR" || input.section14Input.invoiceIssueResult.amountMinor !== snapshot.evaluation.grandTotalMinor || input.section14Input.invoiceIssueResult.currency !== "INR") conflict("quoted room-night components do not reconcile to the full attribution");
      const section = Object.freeze({ case: section14.case, timeOfSupplyDate: section14.timeOfSupplyDate, selectedVersionSide: section14.selectedVersionSide, selectedVersion: section14.selectedVersion });
      const predecessorHashes = Object.freeze({ section14: section14.evidenceHash, levyComponentIdentity: componentIdentity.evidenceHash, reservationLineage: persistedResult.reservationLineageHash, attributionSnapshot: persistedResult.attributionSnapshotHash });
      const body = Object.freeze({ section14: section, reservationLineage: lineage, components, predecessorHashes });
      return Object.freeze({ ...body, evidenceHash: digest({ tenantId, propertyNode, reservationId, folioId, ...body }) });
    } catch (error) {
      if (error instanceof IndiaGstAccommodationQuotedRateApplicabilityValidationError || error instanceof IndiaGstAccommodationQuotedRateApplicabilityConflictError || error instanceof IndiaGstAccommodationQuotedRateApplicabilityNotFoundError) throw error;
      return conflict("complete quoted rate-applicability ancestry is invalid");
    }
  }

  async resolveNative(tx: Tx, raw: IndiaGstAccommodationNativeQuotedRateApplicabilityInput): Promise<IndiaGstAccommodationNativeQuotedRateApplicabilityResult> {
    if (typeof tx !== "function") validation("tenant transaction is unavailable");
    const input = normalizeNative(raw);
    const { tenantId, propertyNode, reservationId, folioId, lineageId, attributionId } = scope(input);
    try {
      const nativeSource = deriveIndiaGstAccommodationNativeInvoiceSource(input.nativeInvoiceSourceInput);
      const componentIdentity = deriveIndiaGstAccommodationLevyComponentIdentity(input.componentIdentityInput);
      equal(input.componentIdentityResult, componentIdentity, "supplied levy-component identity");
      const serviceLineage = input.nativeInvoiceSourceInput.serviceProvision.reservationLineage;
      if (input.nativeInvoiceSourceInput.tenantId !== tenantId || input.nativeInvoiceSourceInput.propertyNode !== propertyNode || input.nativeInvoiceSourceInput.reservationId !== reservationId
          || input.componentIdentityInput.tenantId !== tenantId || componentIdentity.propertyNode !== propertyNode || componentIdentity.reservationId !== reservationId || componentIdentity.folioId !== folioId
          || componentIdentity.supplyDate !== nativeSource.timing.serviceProvisionDate || serviceLineage.lineageId !== lineageId || serviceLineage.attributionId !== attributionId
          || JSON.stringify(input.componentIdentityInput.historicalResolution.rateVersionPair) !== JSON.stringify(input.nativeInvoiceSourceInput.rateVersionPair)) conflict("complete native predecessor identity conflicts with quoted applicability input");
      let selectedVersion: IndiaGstAccommodationRateVersionEvidence;
      let rateSelection: IndiaGstAccommodationNativeQuotedRateSelection;
      if (nativeSource.rateSource.kind === "ordinary_section13_single_version") {
        selectedVersion = nativeSource.rateSource.selectedVersion;
        rateSelection = Object.freeze({ kind: "ordinary_section13_single_version" as const, timeOfSupplyDate: nativeSource.timing.timeOfSupplyDate, selectedVersion });
      } else {
        const section14 = nativeSource.rateSource.section14;
        selectedVersion = section14.selectedVersionSide === "predecessor" ? input.nativeInvoiceSourceInput.rateVersionPair.predecessor : input.nativeInvoiceSourceInput.rateVersionPair.successor;
        if (selectedVersion.extensionId !== section14.selectedVersion.extensionId || selectedVersion.version !== section14.selectedVersion.version || selectedVersion.status !== section14.selectedVersion.status || selectedVersion.contentHash !== section14.selectedVersion.contentHash || selectedVersion.effectiveFromInstant !== section14.selectedVersion.effectiveFromInstant || selectedVersion.effectiveToInstant !== section14.selectedVersion.effectiveToInstant) conflict("native Section14-selected pair member conflicts with its result");
        rateSelection = Object.freeze({ kind: "genuine_section14_rate_change" as const, case: section14.case, timeOfSupplyDate: section14.timeOfSupplyDate, selectedVersionSide: section14.selectedVersionSide, selectedVersion, section14EvidenceHash: section14.evidenceHash });
      }
      if (selectedVersion.key !== "in-gst-lodging") conflict("native selected rate version is not the lodging schedule");
      const recordingRoots = await authenticatePersistedNativeRoots(tx, input, nativeSource);
      const componentRateSlabs = deriveIndiaGstAccommodationComponentRateSlabs(componentIdentity.componentIdentities, selectedVersion.gstRoomSlabs);
      const persistedResult = await persistedQuoteComponents(tx, input, componentRateSlabs, componentIdentity, serviceLineage, nativeSource.timing.amountMinor);
      const nativeTiming = Object.freeze({ nativeTimingId: nativeSource.timing.nativeTimingId, prospectiveDocumentId: nativeSource.timing.prospectiveDocumentId, serviceProvisionSnapshotId: nativeSource.timing.serviceProvisionSnapshotId, paymentReceiptSnapshotId: nativeSource.timing.paymentReceiptSnapshotId, ordinaryRegimeEvidenceId: nativeSource.timing.ordinaryRegimeEvidenceId, invoiceIssueDate: nativeSource.timing.invoiceIssueDate, branch: nativeSource.timing.branch, timeOfSupplyDate: nativeSource.timing.timeOfSupplyDate, evidenceHash: nativeSource.timing.evidenceHash });
      const predecessorHashes = Object.freeze({ nativeInvoiceSource: nativeSource.evidenceHash, nativeTiming: nativeSource.timing.evidenceHash, ...recordingRoots, serviceProvisionProjection: input.nativeInvoiceSourceInput.serviceProvision.evidenceHash, paymentReceiptProjection: input.nativeInvoiceSourceInput.paymentReceipt.evidenceHash, rateSource: nativeSource.rateSource.evidenceHash, levyComponentIdentity: componentIdentity.evidenceHash, reservationLineage: persistedResult.reservationLineageHash, attributionSnapshot: persistedResult.attributionSnapshotHash });
      const body = Object.freeze({ kind: "native_current_transaction" as const, rateSelection, nativeTiming, reservationLineage: persistedResult.lineage, components: persistedResult.components, predecessorHashes });
      return Object.freeze({ ...body, evidenceHash: digest({ tenantId, propertyNode, reservationId, folioId, ...body }) });
    } catch (error) {
      if (error instanceof IndiaGstAccommodationQuotedRateApplicabilityValidationError || error instanceof IndiaGstAccommodationQuotedRateApplicabilityConflictError || error instanceof IndiaGstAccommodationQuotedRateApplicabilityNotFoundError) throw error;
      return conflict("complete native quoted rate-applicability ancestry is invalid");
    }
  }
}
