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
const ROW_KEYS = [
  "tenant_id", "lineage_id", "property_node", "hold_binding_id", "hold_id", "attribution_id", "reservation_id", "segment_id", "sellable_unit_id", "folio_id",
  "origin_quote_hash", "snapshot_hash", "currency", "snapshot",
  "binding_row_id", "binding_hold_id", "hold_row_id", "binding_sellable_unit_id", "hold_sellable_unit_id", "segment_sellable_unit_id",
  "lineage_period", "binding_period", "hold_period", "segment_period",
  "binding_attribution_id", "attribution_row_id", "binding_origin_quote_hash", "binding_snapshot_hash", "binding_currency",
] as const;

type RecordValue = Record<string, unknown>;
type Family = "igst" | "cgst_sgst" | "cgst_utgst";
type ComponentIdentity = "igst" | "cgst" | "sgst" | "utgst";

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
async function persisted(tx: Tx, input: IndiaGstAccommodationQuotedRateApplicabilityInput): Promise<PersistedLineageRow> {
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

export class IndiaGstAccommodationQuotedRateApplicabilityService {
  readonly #section14 = new IndiaGstSection14RateSelectionService();

  async resolve(tx: Tx, raw: IndiaGstAccommodationQuotedRateApplicabilityInput): Promise<IndiaGstAccommodationQuotedRateApplicabilityResult> {
    if (typeof tx !== "function") validation("tenant transaction is unavailable");
    const input = normalize(raw);
    const tenantId = uuid(input.tenantId, "tenantId"), propertyNode = uuid(input.propertyNode, "propertyNode"), reservationId = uuid(input.reservationId, "reservationId"), folioId = uuid(input.folioId, "folioId"), lineageId = uuid(input.reservationLineageId, "reservationLineageId"), attributionId = uuid(input.attributionId, "attributionId");
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
      const row = exact(await persisted(tx, input), ROW_KEYS, "persisted quoted-tax reservation lineage") as unknown as PersistedLineageRow;
      const serviceLineage = input.section14Input.serviceProvisionResult.reservationLineage;
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
      if (components.length === 0 || total.toString() !== snapshot.revenueLine.inputAmountMinor || snapshot.evaluation.grandTotalMinor !== input.section14Input.paymentReceiptResult.amountMinor || input.section14Input.paymentReceiptResult.currency !== "INR" || input.section14Input.invoiceIssueResult.amountMinor !== snapshot.evaluation.grandTotalMinor || input.section14Input.invoiceIssueResult.currency !== "INR") conflict("quoted room-night components do not reconcile to the full attribution");
      const section = Object.freeze({ case: section14.case, timeOfSupplyDate: section14.timeOfSupplyDate, selectedVersionSide: section14.selectedVersionSide, selectedVersion: section14.selectedVersion });
      const lineage = Object.freeze({ lineageId, holdBindingId: storedHoldBindingId, reservationId, segmentId: uuid(row.segment_id, "stored segment"), folioId, attributionId, originQuoteHash, snapshotHash, currency: "INR" as const });
      const provenLineage = Object.freeze({ ...lineage, holdId: storedHoldId, sellableUnitId: storedSellableUnitId, period: storedPeriod });
      const predecessorHashes = Object.freeze({ section14: section14.evidenceHash, levyComponentIdentity: componentIdentity.evidenceHash, reservationLineage: digest({ tenantId, ...provenLineage }), attributionSnapshot: snapshot.snapshotHash });
      const body = Object.freeze({ section14: section, reservationLineage: lineage, components: Object.freeze(components), predecessorHashes });
      return Object.freeze({ ...body, evidenceHash: digest({ tenantId, propertyNode, reservationId, folioId, ...body }) });
    } catch (error) {
      if (error instanceof IndiaGstAccommodationQuotedRateApplicabilityValidationError || error instanceof IndiaGstAccommodationQuotedRateApplicabilityConflictError || error instanceof IndiaGstAccommodationQuotedRateApplicabilityNotFoundError) throw error;
      return conflict("complete quoted rate-applicability ancestry is invalid");
    }
  }
}
