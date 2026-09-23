import { types as utilTypes } from "node:util";
import type { Tx } from "../../kernel";
import {
  IndiaGstAccommodationQuotedRateApplicabilityService,
  type IndiaGstAccommodationQuotedRateApplicabilityInput,
  type IndiaGstAccommodationQuotedRateApplicabilityResult,
  type IndiaGstAccommodationNativeQuotedRateApplicabilityInput,
  type IndiaGstAccommodationNativeQuotedRateApplicabilityResult,
} from "./india-gst-accommodation-quoted-rate-applicability";
import { deriveIndiaGstAccommodationComponentRateSlabs } from "./india-gst-accommodation-levy-component-rate-schedule";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const HASH = /^[0-9a-f]{64}$/;
const INTEGER = /^(?:0|[1-9][0-9]*)$/;
const MAX = 9223372036854775807n;
const INPUT_KEYS = ["tenantId", "propertyNode", "reservationId", "folioId", "quotedRateApplicabilityInput"] as const;
const NATIVE_INPUT_KEYS = ["tenantId", "propertyNode", "reservationId", "folioId", "nativeQuotedRateApplicabilityInput"] as const;

type AnyRecord = Record<string, unknown>;
type ComponentIdentity = "igst" | "cgst" | "sgst" | "utgst";

export interface IndiaGstAccommodationFinalComponentTaxInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly reservationId: string;
  readonly folioId: string;
  readonly quotedRateApplicabilityInput: IndiaGstAccommodationQuotedRateApplicabilityInput;
}

export interface IndiaGstAccommodationNativeFinalComponentTaxInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly reservationId: string;
  readonly folioId: string;
  readonly nativeQuotedRateApplicabilityInput: IndiaGstAccommodationNativeQuotedRateApplicabilityInput;
}

interface PersistedValuation {
  readonly valuation_id: string;
  readonly generation: number;
  readonly transaction_value_minor: string;
  readonly evidence_hash: string;
  readonly order341_evidence_hash: string;
}

interface PersistedRoomNight {
  readonly ordinal: number;
  readonly business_date: string;
  readonly transaction_value_minor: string | null;
}

interface PersistedNativeValuation extends Omit<PersistedValuation, "order341_evidence_hash"> {
  readonly native_consideration_basis_hash: string;
  readonly timing_projection_evidence_hash: string;
}

export interface IndiaGstAccommodationFinalComponentTaxResult extends Readonly<Record<string, unknown>> {
  readonly valuationId: string;
  readonly generation: number;
  readonly roomNights: readonly Readonly<{
    readonly ordinal: string;
    readonly businessDate: string;
    readonly transactionValueMinor: string;
    readonly slab: Readonly<{
      readonly uptoMinor: number | null;
      readonly aggregateRateBasisPoints: number;
      readonly components: readonly Readonly<{
        readonly identity: ComponentIdentity;
        readonly rateBasisPoints: number;
        readonly taxMinor: string;
      }>[];
    }>;
    readonly taxMinor: string;
  }>[];
  readonly taxMinor: string;
  readonly grandTotalMinor: string;
  readonly predecessorHashes: Readonly<{
    readonly finalValuation: string;
    readonly quotedRateApplicability: string;
    readonly section14: string;
    readonly levyComponentIdentity: string;
    readonly reservationLineage: string;
    readonly attributionSnapshot: string;
  }>;
  readonly evidenceHash: string;
}

export interface IndiaGstAccommodationNativeFinalComponentTaxResult {
  readonly kind: "native_current_transaction";
  readonly nativeTimingId: string;
  readonly valuationId: string;
  readonly generation: number;
  readonly rateSelectionKind: IndiaGstAccommodationNativeQuotedRateApplicabilityResult["rateSelection"]["kind"];
  readonly roomNights: IndiaGstAccommodationFinalComponentTaxResult["roomNights"];
  readonly taxMinor: string;
  readonly grandTotalMinor: string;
  readonly predecessorHashes: Readonly<
    IndiaGstAccommodationNativeQuotedRateApplicabilityResult["predecessorHashes"] & {
      readonly finalValuation: string;
      readonly quotedRateApplicability: string;
      readonly nativeConsiderationBasis: string;
    }
  >;
  readonly evidenceHash: string;
}

export class IndiaGstAccommodationFinalComponentTaxValidationError extends Error {
  constructor(message: string) { super(message); this.name = "IndiaGstAccommodationFinalComponentTaxValidationError"; }
}

function fail(message: string): never { throw new IndiaGstAccommodationFinalComponentTaxValidationError(message); }

function exact(value: unknown, keys: readonly string[], subject: string): AnyRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value) || utilTypes.isProxy(value)
      || Object.getPrototypeOf(value) !== Object.prototype || Object.getOwnPropertySymbols(value).length !== 0) {
    return fail(`${subject} must be an exact plain object`);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const actual = Object.keys(descriptors).sort(), expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])
      || Object.values(descriptors).some((d) => d.enumerable !== true || d.get !== undefined || d.set !== undefined || !('value' in d))) {
    return fail(`${subject} shape is invalid`);
  }
  return value as AnyRecord;
}

function frozen(value: unknown, seen = new Set<object>()): void {
  if (value === null || typeof value === "string" || typeof value === "boolean"
      || (typeof value === "number" && Number.isFinite(value))) return;
  if (typeof value !== "object" || seen.has(value) || utilTypes.isProxy(value)
      || !Object.isFrozen(value) || Object.getOwnPropertySymbols(value).length !== 0) {
    fail("final component-tax input must be a deeply frozen, symbol-free graph");
  }
  seen.add(value);
  if (Object.getPrototypeOf(value) !== Object.prototype && !Array.isArray(value)) fail("final component-tax input contains a non-plain object");
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Array.isArray(value) && (Object.keys(value).some((key, index) => key !== String(index)) || Object.keys(value).length !== value.length)) fail("final component-tax arrays must be dense");
  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (key === "length" && Array.isArray(value)) continue;
    if (descriptor.enumerable !== true || descriptor.get !== undefined || descriptor.set !== undefined || !('value' in descriptor) || descriptor.writable !== false) fail("final component-tax evidence descriptors are invalid");
    frozen(descriptor.value, seen);
  }
}

function uuid(value: unknown, subject: string): string { if (typeof value !== "string" || !UUID.test(value)) return fail(`${subject} must be a lowercase UUID`); return value; }
function hash(value: unknown, subject: string): string { if (typeof value !== "string" || !HASH.test(value)) return fail(`${subject} must be lowercase SHA-256`); return value; }
function integer(value: unknown, subject: string): bigint {
  if (typeof value !== "string" || !INTEGER.test(value)) return fail(`${subject} must be a canonical non-negative integer`);
  const parsed = BigInt(value); if (parsed > MAX) return fail(`${subject} exceeds signed int64`); return parsed;
}
function add(a: bigint, b: bigint, subject: string): bigint { const result = a + b; if (result > MAX) return fail(`${subject} exceeds signed int64`); return result; }
function digest(value: unknown): string { return new Bun.CryptoHasher("sha256").update(JSON.stringify(value)).digest("hex"); }

function halfUp(numerator: bigint, denominator: bigint, subject: string): bigint {
  const quotient = numerator / denominator, remainder = numerator % denominator;
  const result = quotient + (remainder * 2n >= denominator ? 1n : 0n);
  if (result > MAX) return fail(`${subject} exceeds signed int64`);
  return result;
}

function validateRoomNights(rows: readonly PersistedRoomNight[], replay: Pick<IndiaGstAccommodationQuotedRateApplicabilityResult, "components">): readonly bigint[] {
  if (rows.length === 0 || rows.length !== replay.components.length || rows.length > 366) return fail("final room-night evidence is incomplete");
  const values: bigint[] = [];
  for (const [index, night] of rows.entries()) {
    if (night.ordinal !== index || String(night.ordinal) !== replay.components[index]?.ordinal || night.business_date !== replay.components[index]?.businessDate) return fail("final room-night ordering or lineage does not match fresh Order341 evidence");
    const value = integer(night.transaction_value_minor, "final room-night value"); if (value <= 0n) return fail("final room-night values must be positive");
    values.push(value);
  }
  return Object.freeze(values);
}

// One component-first integer calculation for both origins. The callers bind
// distinct provenance; sharing arithmetic must not relabel native rows as legacy.
function calculateRoomNightTax(
  quotedNights: IndiaGstAccommodationQuotedRateApplicabilityResult["components"],
  values: readonly bigint[],
  slabs: ReturnType<typeof deriveIndiaGstAccommodationComponentRateSlabs>,
): IndiaGstAccommodationFinalComponentTaxResult["roomNights"] {
  return Object.freeze(quotedNights.map((component, index) => {
    const value = values[index]!;
    const slab = slabs.find((candidate) => candidate.uptoMinor === null || value <= BigInt(candidate.uptoMinor));
    if (!slab) return fail("final value has no applicable approved GST slab");
    const components = Object.freeze(slab.components.map((rate) => Object.freeze({ identity: rate.identity, rateBasisPoints: rate.rateBasisPoints, taxMinor: halfUp(value * BigInt(rate.rateBasisPoints), 10_000n, "component tax").toString() })));
    const tax = components.reduce((sum, rate) => add(sum, BigInt(rate.taxMinor), "room-night tax"), 0n);
    return Object.freeze({ ordinal: component.ordinal, businessDate: component.businessDate, transactionValueMinor: value.toString(), slab: Object.freeze({ uptoMinor: slab.uptoMinor, aggregateRateBasisPoints: slab.aggregateRateBasisPoints, components }), taxMinor: tax.toString() });
  }));
}

function calculate(input: IndiaGstAccommodationFinalComponentTaxInput, replay: IndiaGstAccommodationQuotedRateApplicabilityResult, valuation: PersistedValuation, persistedNights: readonly PersistedRoomNight[]): IndiaGstAccommodationFinalComponentTaxResult {
  const tenant = uuid(input.tenantId, "tenantId"), property = uuid(input.propertyNode, "propertyNode"), reservation = uuid(input.reservationId, "reservationId"), folio = uuid(input.folioId, "folioId");
  const valuationId = uuid(valuation.valuation_id, "valuationId");
  if (!Number.isSafeInteger(valuation.generation) || valuation.generation < 0) return fail("valuation generation is invalid");
  const generation = valuation.generation;
  const valuationValue = integer(valuation.transaction_value_minor, "valuation transaction value");
  if (valuationValue <= 0n) return fail("valuation transaction value must be positive");
  const valuationHash = hash(valuation.evidence_hash, "valuation evidence hash");
  if (replay.reservationLineage.reservationId !== reservation || replay.reservationLineage.folioId !== folio || replay.reservationLineage.currency !== "INR") return fail("Order341 lineage does not match final valuation scope");
  if (input.quotedRateApplicabilityInput.tenantId !== tenant || input.quotedRateApplicabilityInput.propertyNode !== property || input.quotedRateApplicabilityInput.reservationId !== reservation || input.quotedRateApplicabilityInput.folioId !== folio) return fail("Order341 input scope does not match final valuation scope");
  if (hash(valuation.order341_evidence_hash, "persisted Order341 evidence hash") !== replay.evidenceHash) return fail("persisted valuation does not match fresh Order341 evidence");
  const values = validateRoomNights(persistedNights, replay);
  const total = values.reduce((sum, value) => add(sum, value, "final valuation total"), 0n);
  if (total !== valuationValue) return fail("room-night values do not reconcile to final valuation");
  const selectedVersion = replay.section14.selectedVersionSide === "predecessor" ? input.quotedRateApplicabilityInput.section14Input.rateVersionPair.predecessor : input.quotedRateApplicabilityInput.section14Input.rateVersionPair.successor;
  const slabs = deriveIndiaGstAccommodationComponentRateSlabs(input.quotedRateApplicabilityInput.componentIdentityResult.componentIdentities, selectedVersion.gstRoomSlabs);
  const roomNights = calculateRoomNightTax(replay.components, values, slabs);
  const tax = roomNights.reduce((sum, night) => add(sum, BigInt(night.taxMinor), "valuation tax"), 0n);
  const grand = add(total, tax, "grand total");
  const predecessorHashes = Object.freeze({ finalValuation: valuationHash, quotedRateApplicability: replay.evidenceHash, ...replay.predecessorHashes });
  const body = Object.freeze({ valuationId, generation, roomNights, taxMinor: tax.toString(), grandTotalMinor: grand.toString(), predecessorHashes });
  return Object.freeze({ ...body, evidenceHash: digest({ tenant, property, reservation, folio, ...body }) }) as IndiaGstAccommodationFinalComponentTaxResult;
}

export class IndiaGstAccommodationFinalComponentTaxService {
  /** Read-only composition inside the dedicated native issue Tx; no tax posting. */
  async calculateNative(
    tx: Tx, raw: IndiaGstAccommodationNativeFinalComponentTaxInput,
  ): Promise<IndiaGstAccommodationNativeFinalComponentTaxResult> {
    frozen(raw);
    exact(raw, NATIVE_INPUT_KEYS, "native final component-tax input");
    const tenant = uuid(raw.tenantId, "tenantId"), property = uuid(raw.propertyNode, "propertyNode"),
      reservation = uuid(raw.reservationId, "reservationId"), folio = uuid(raw.folioId, "folioId");
    const input = raw.nativeQuotedRateApplicabilityInput;
    if (typeof input !== "object" || input === null) return fail("native applicability input is required");
    if (input.tenantId !== tenant || input.propertyNode !== property
        || input.reservationId !== reservation || input.folioId !== folio) {
      return fail("native applicability input scope does not match final valuation scope");
    }
    const replay = await new IndiaGstAccommodationQuotedRateApplicabilityService().resolveNative(tx, input);
    const timing = input.nativeInvoiceSourceInput.nativeTiming;
    const nativeTimingId = uuid(timing.nativeTimingId, "native timing id");
    const rows = await tx<PersistedNativeValuation[]>`
      SELECT v.id::text AS valuation_id,v.generation,v.transaction_value_minor::text,
        v.evidence_hash,v.native_consideration_basis_hash,t.evidence_hash AS timing_projection_evidence_hash
      FROM india_gst_native_invoice_timing t
      JOIN india_gst_accommodation_final_valuation v ON v.tenant_id=t.tenant_id AND v.id=t.valuation_id
        AND v.generation=t.valuation_generation AND v.evidence_hash=t.valuation_evidence_hash
        AND v.native_consideration_basis_hash=t.native_consideration_basis_hash
        AND v.property_node=t.property_node AND v.reservation_id=t.reservation_id
        AND v.folio_id=t.folio_id AND v.buyer_party_id=t.buyer_party_id
        AND v.native_service_provision_snapshot_id=t.service_provision_snapshot_id
        AND v.native_lineage_id=t.reservation_lineage_id
      WHERE t.tenant_id=${tenant}::uuid
        AND t.tenant_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
        AND t.id=${nativeTimingId}::uuid AND t.property_node=${property}::uuid
        AND t.reservation_id=${reservation}::uuid AND t.folio_id=${folio}::uuid
        AND t.reservation_lineage_id=${input.reservationLineageId}::uuid
        AND t.prospective_document_id=${timing.prospectiveDocumentId}::uuid
        AND t.issuing_transaction_id=pg_current_xact_id()
        AND t.transaction_timestamp=transaction_timestamp()
        AND t.invoice_issue_date=(transaction_timestamp() AT TIME ZONE t.property_timezone)::date
        AND v.basis_kind='native_consideration' AND v.order341_evidence_hash IS NULL
        AND v.disposition='ordinary_final' AND v.currency='INR' AND v.transaction_value_minor>0
        AND NOT EXISTS(SELECT 1 FROM india_gst_accommodation_final_valuation next
          WHERE next.tenant_id=v.tenant_id AND next.supersedes_valuation_id=v.id)
    `;
    if (rows.length !== 1) return fail("one current native valuation bound to this issuing transaction is required");
    const valuation = rows[0]!;
    const valuationId = uuid(valuation.valuation_id, "native valuation id");
    if (!Number.isSafeInteger(valuation.generation) || valuation.generation < 0) return fail("native valuation generation is invalid");
    if (hash(valuation.timing_projection_evidence_hash, "persisted native timing hash") !== timing.evidenceHash) {
      return fail("native timing projection differs from persisted timing evidence");
    }
    const valuationHash = hash(valuation.evidence_hash, "native valuation evidence hash");
    const basisHash = hash(valuation.native_consideration_basis_hash, "native consideration basis hash");
    const persistedNights = await tx<PersistedRoomNight[]>`
      SELECT ordinal,business_date::text,transaction_value_minor::text
      FROM india_gst_accommodation_valuation_room_night
      WHERE tenant_id=${tenant}::uuid AND valuation_id=${valuationId}::uuid
        AND basis_kind='native_consideration'
      ORDER BY ordinal
    `;
    const values = validateRoomNights(persistedNights, replay);
    const total = values.reduce((sum, value) => add(sum, value, "native valuation total"), 0n);
    if (total <= 0n || total !== integer(valuation.transaction_value_minor, "native transaction value")) {
      return fail("native room-night values do not reconcile to recorded consideration");
    }
    const slabs = deriveIndiaGstAccommodationComponentRateSlabs(
      input.componentIdentityResult.componentIdentities, replay.rateSelection.selectedVersion.gstRoomSlabs,
    );
    const roomNights = calculateRoomNightTax(replay.components, values, slabs);
    const tax = roomNights.reduce((sum, night) => add(sum, BigInt(night.taxMinor), "native valuation tax"), 0n);
    const grand = add(total, tax, "native grand total");
    if (input.nativeInvoiceSourceInput.paymentReceipt.currency !== "INR"
        || input.nativeInvoiceSourceInput.paymentReceipt.amountMinor !== grand.toString()) {
      return fail("native payment evidence does not cover the exact final grand total");
    }
    const predecessorHashes = Object.freeze({ finalValuation: valuationHash,
      quotedRateApplicability: replay.evidenceHash,nativeConsiderationBasis: basisHash,...replay.predecessorHashes });
    const body = Object.freeze({ kind: "native_current_transaction" as const,nativeTimingId,valuationId,
      generation: valuation.generation,rateSelectionKind: replay.rateSelection.kind,roomNights,
      taxMinor: tax.toString(),grandTotalMinor: grand.toString(),predecessorHashes });
    return Object.freeze({ ...body,evidenceHash: digest({ tenant,property,reservation,folio,...body }) });
  }

  async calculate(tx: Tx, raw: IndiaGstAccommodationFinalComponentTaxInput): Promise<IndiaGstAccommodationFinalComponentTaxResult> {
    frozen(raw);
    exact(raw, INPUT_KEYS, "final component-tax input");
    const replay = await new IndiaGstAccommodationQuotedRateApplicabilityService().resolve(tx, raw.quotedRateApplicabilityInput);
    const heads = await tx<PersistedValuation[]>`
      SELECT v.id::text AS valuation_id, v.generation, v.transaction_value_minor::text,
             v.evidence_hash, v.order341_evidence_hash
        FROM india_gst_accommodation_final_valuation v
       WHERE v.tenant_id = ${raw.tenantId}::uuid
         AND v.property_node = ${raw.propertyNode}::uuid
         AND v.reservation_id = ${raw.reservationId}::uuid
         AND v.folio_id = ${raw.folioId}::uuid
         AND v.disposition = 'ordinary_final'
         AND v.currency = 'INR'
         AND v.transaction_value_minor > 0
         AND NOT EXISTS (
           SELECT 1 FROM india_gst_accommodation_final_valuation successor
            WHERE successor.tenant_id = v.tenant_id
              AND successor.supersedes_valuation_id = v.id
         )
       ORDER BY v.generation DESC, v.id
       LIMIT 2
    `;
    if (heads.length !== 1) fail("exactly one current ordinary-final valuation is required");
    const valuation = heads[0]!;
    const roomNights = await tx<PersistedRoomNight[]>`
      SELECT ordinal, business_date::text, transaction_value_minor::text
        FROM india_gst_accommodation_valuation_room_night
       WHERE tenant_id = ${raw.tenantId}::uuid
         AND valuation_id = ${valuation.valuation_id}::uuid
       ORDER BY ordinal
    `;
    return calculate(raw, replay, valuation, roomNights);
  }
}
