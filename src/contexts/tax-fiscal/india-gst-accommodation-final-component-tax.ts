import { types as utilTypes } from "node:util";
import type { Tx } from "../../kernel";
import {
  IndiaGstAccommodationQuotedRateApplicabilityService,
  type IndiaGstAccommodationQuotedRateApplicabilityInput,
  type IndiaGstAccommodationQuotedRateApplicabilityResult,
} from "./india-gst-accommodation-quoted-rate-applicability";
import { deriveIndiaGstAccommodationComponentRateSlabs } from "./india-gst-accommodation-levy-component-rate-schedule";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const HASH = /^[0-9a-f]{64}$/;
const INTEGER = /^(?:0|[1-9][0-9]*)$/;
const MAX = 9223372036854775807n;
const INPUT_KEYS = ["tenantId", "propertyNode", "reservationId", "folioId", "finalValuation", "roomNights", "quotedRateApplicabilityInput", "quotedRateApplicabilityResult"] as const;
const VALUATION_KEYS = ["valuationId", "generation", "disposition", "transactionValueMinor", "evidenceHash", "replayed"] as const;
const NIGHT_KEYS = ["ordinal", "businessDate", "transactionValueMinor"] as const;

type AnyRecord = Record<string, unknown>;
type ComponentIdentity = "igst" | "cgst" | "sgst" | "utgst";

export interface IndiaGstAccommodationFinalComponentTaxValuation {
  readonly valuationId: string;
  readonly generation: number;
  readonly disposition: "ordinary_final";
  readonly transactionValueMinor: string;
  readonly evidenceHash: string;
  readonly replayed: true;
}

export interface IndiaGstAccommodationFinalComponentTaxRoomNight {
  readonly ordinal: string;
  readonly businessDate: string;
  readonly transactionValueMinor: string;
}

export interface IndiaGstAccommodationFinalComponentTaxInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly reservationId: string;
  readonly folioId: string;
  readonly finalValuation: IndiaGstAccommodationFinalComponentTaxValuation;
  readonly roomNights: readonly IndiaGstAccommodationFinalComponentTaxRoomNight[];
  readonly quotedRateApplicabilityInput: IndiaGstAccommodationQuotedRateApplicabilityInput;
  readonly quotedRateApplicabilityResult: IndiaGstAccommodationQuotedRateApplicabilityResult;
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
function same(a: unknown, b: unknown): boolean { return JSON.stringify(a) === JSON.stringify(b); }

function halfUp(numerator: bigint, denominator: bigint, subject: string): bigint {
  const quotient = numerator / denominator, remainder = numerator % denominator;
  const result = quotient + (remainder * 2n >= denominator ? 1n : 0n);
  if (result > MAX) return fail(`${subject} exceeds signed int64`);
  return result;
}

function validateRoomNights(input: IndiaGstAccommodationFinalComponentTaxInput, replay: IndiaGstAccommodationQuotedRateApplicabilityResult): readonly bigint[] {
  if (input.roomNights.length === 0 || input.roomNights.length !== replay.components.length || input.roomNights.length > 366) return fail("final room-night evidence is incomplete");
  const values: bigint[] = [];
  for (const [index, raw] of input.roomNights.entries()) {
    const night = exact(raw, NIGHT_KEYS, "final room-night");
    if (night.ordinal !== replay.components[index]?.ordinal || night.businessDate !== replay.components[index]?.businessDate) return fail("final room-night ordering or lineage does not match fresh Order341 evidence");
    const value = integer(night.transactionValueMinor, "final room-night value"); if (value <= 0n) return fail("final room-night values must be positive");
    values.push(value);
  }
  return Object.freeze(values);
}

function calculate(input: IndiaGstAccommodationFinalComponentTaxInput, replay: IndiaGstAccommodationQuotedRateApplicabilityResult): IndiaGstAccommodationFinalComponentTaxResult {
  const tenant = uuid(input.tenantId, "tenantId"), property = uuid(input.propertyNode, "propertyNode"), reservation = uuid(input.reservationId, "reservationId"), folio = uuid(input.folioId, "folioId");
  const valuation = exact(input.finalValuation, VALUATION_KEYS, "final valuation");
  const valuationId = uuid(valuation.valuationId, "valuationId");
  if (!Number.isSafeInteger(valuation.generation) || (valuation.generation as number) < 0) return fail("valuation generation is invalid");
  const generation = valuation.generation as number;
  if (valuation.disposition !== "ordinary_final" || valuation.replayed !== true) return fail("only replayed ordinary-final valuation evidence is calculable");
  const valuationValue = integer(valuation.transactionValueMinor, "valuation transaction value");
  if (valuationValue <= 0n) return fail("valuation transaction value must be positive");
  const valuationHash = hash(valuation.evidenceHash, "valuation evidence hash");
  if (replay.reservationLineage.reservationId !== reservation || replay.reservationLineage.folioId !== folio || replay.reservationLineage.currency !== "INR") return fail("Order341 lineage does not match final valuation scope");
  if (input.quotedRateApplicabilityInput.tenantId !== tenant || input.quotedRateApplicabilityInput.propertyNode !== property || input.quotedRateApplicabilityInput.reservationId !== reservation || input.quotedRateApplicabilityInput.folioId !== folio) return fail("Order341 input scope does not match final valuation scope");
  if (!same(replay, input.quotedRateApplicabilityResult)) return fail("supplied Order341 result does not byte-match fresh replay");
  const values = validateRoomNights(input, replay);
  const total = values.reduce((sum, value) => add(sum, value, "final valuation total"), 0n);
  if (total !== valuationValue) return fail("room-night values do not reconcile to final valuation");
  const selectedVersion = replay.section14.selectedVersionSide === "predecessor" ? input.quotedRateApplicabilityInput.section14Input.rateVersionPair.predecessor : input.quotedRateApplicabilityInput.section14Input.rateVersionPair.successor;
  const slabs = deriveIndiaGstAccommodationComponentRateSlabs(input.quotedRateApplicabilityInput.componentIdentityResult.componentIdentities, selectedVersion.gstRoomSlabs);
  const roomNights = Object.freeze(replay.components.map((component, index) => {
    const value = values[index]!;
    const slab = slabs.find((candidate) => candidate.uptoMinor === null || value <= BigInt(candidate.uptoMinor));
    if (!slab) return fail("final value has no applicable approved GST slab");
    const components = Object.freeze(slab.components.map((rate) => Object.freeze({ identity: rate.identity, rateBasisPoints: rate.rateBasisPoints, taxMinor: halfUp(value * BigInt(rate.rateBasisPoints), 10_000n, "component tax").toString() })));
    const tax = components.reduce((sum, rate) => add(sum, BigInt(rate.taxMinor), "room-night tax"), 0n);
    return Object.freeze({ ordinal: component.ordinal, businessDate: component.businessDate, transactionValueMinor: value.toString(), slab: Object.freeze({ uptoMinor: slab.uptoMinor, aggregateRateBasisPoints: slab.aggregateRateBasisPoints, components }), taxMinor: tax.toString() });
  }));
  const tax = roomNights.reduce((sum, night) => add(sum, BigInt(night.taxMinor), "valuation tax"), 0n);
  const grand = add(total, tax, "grand total");
  const predecessorHashes = Object.freeze({ finalValuation: valuationHash, quotedRateApplicability: replay.evidenceHash, ...replay.predecessorHashes });
  const body = Object.freeze({ valuationId, generation, roomNights, taxMinor: tax.toString(), grandTotalMinor: grand.toString(), predecessorHashes });
  return Object.freeze({ ...body, evidenceHash: digest({ tenant, property, reservation, folio, ...body }) }) as IndiaGstAccommodationFinalComponentTaxResult;
}

export class IndiaGstAccommodationFinalComponentTaxService {
  async calculate(tx: Tx, raw: IndiaGstAccommodationFinalComponentTaxInput): Promise<IndiaGstAccommodationFinalComponentTaxResult> {
    frozen(raw);
    exact(raw, INPUT_KEYS, "final component-tax input");
    const replay = await new IndiaGstAccommodationQuotedRateApplicabilityService().resolve(tx, raw.quotedRateApplicabilityInput);
    return calculate(raw, replay);
  }
}

/** Pure calculation hook for a previously fresh-replayed Order341 result. */
export function calculateIndiaGstAccommodationFinalComponentTax(raw: IndiaGstAccommodationFinalComponentTaxInput, replay: IndiaGstAccommodationQuotedRateApplicabilityResult): IndiaGstAccommodationFinalComponentTaxResult {
  frozen(raw); exact(raw, INPUT_KEYS, "final component-tax input"); frozen(replay);
  return calculate(raw, replay);
}
