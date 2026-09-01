import { types as utilTypes } from "node:util";

import {
  deriveIndiaGstAccommodationLevyComponentIdentity,
  type IndiaGstAccommodationLevyComponentIdentityResult,
} from "./india-gst-accommodation-levy-component-identity";
import type { IndiaGstAccommodationComponentFamilyResult } from "./india-gst-accommodation-component-family";
import type { IndiaGstAccommodationHistoricalResolutionResult } from "./india-gst-accommodation-historical-resolution";
import type { IndiaGstAccommodationLevyInputBundleResult } from "./india-gst-accommodation-levy-input-bundle";
import type { IndiaGstAccommodationSupplyNatureResult } from "./india-gst-accommodation-supply-nature";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const INPUT_KEYS = ["tenantId", "historicalResolution", "supplyNature", "componentFamily", "levyInputBundle", "componentIdentity"] as const;

type RecordValue = Record<string, unknown>;
type ComponentIdentity = "igst" | "cgst" | "sgst" | "utgst";

export interface IndiaGstAccommodationLevyComponentRateScheduleInput {
  readonly tenantId: string;
  readonly historicalResolution: IndiaGstAccommodationHistoricalResolutionResult;
  readonly supplyNature: IndiaGstAccommodationSupplyNatureResult;
  readonly componentFamily: IndiaGstAccommodationComponentFamilyResult;
  readonly levyInputBundle: IndiaGstAccommodationLevyInputBundleResult;
  readonly componentIdentity: IndiaGstAccommodationLevyComponentIdentityResult;
}

export interface IndiaGstAccommodationLevyComponentRateScheduleResult {
  readonly propertyNode: string;
  readonly reservationId: string;
  readonly folioId: string;
  readonly supplyDate: string;
  readonly selectedVersion: IndiaGstAccommodationLevyComponentIdentityResult["selectedVersion"];
  readonly componentFamily: IndiaGstAccommodationLevyComponentIdentityResult["componentFamily"];
  readonly componentIdentities: IndiaGstAccommodationLevyComponentIdentityResult["componentIdentities"];
  readonly componentRateSlabs: readonly Readonly<{
    readonly uptoMinor: 750000 | null;
    readonly aggregateRate: number;
    readonly aggregateRateBasisPoints: number;
    readonly itcEligible: boolean;
    readonly components: readonly Readonly<{
      readonly identity: ComponentIdentity;
      readonly rate: number;
      readonly rateBasisPoints: number;
    }>[];
  }>[];
  readonly legalSources: IndiaGstAccommodationLevyComponentIdentityResult["legalSources"];
  readonly predecessorHashes: Readonly<
    IndiaGstAccommodationLevyComponentIdentityResult["predecessorHashes"]
    & { readonly levyComponentIdentity: string }
  >;
  readonly evidenceHash: string;
}

export class IndiaGstAccommodationLevyComponentRateScheduleValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaGstAccommodationLevyComponentRateScheduleValidationError";
  }
}

function fail(message: string): never {
  throw new IndiaGstAccommodationLevyComponentRateScheduleValidationError(message);
}

function exact(value: unknown, expected: readonly string[], subject: string): RecordValue {
  if (typeof value !== "object" || value === null || Array.isArray(value) || utilTypes.isProxy(value)
      || Object.getOwnPropertySymbols(value).length !== 0
      || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    return fail(`${subject} must be an exact plain object`);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Object.keys(descriptors).sort();
  const wanted = [...expected].sort();
  if (keys.length !== wanted.length || keys.some((key, index) => key !== wanted[index])
      || Object.values(descriptors).some((descriptor) => descriptor.get !== undefined || descriptor.set !== undefined
        || descriptor.enumerable !== true || !("value" in descriptor))) {
    return fail(`${subject} shape is invalid`);
  }
  return value as RecordValue;
}

function frozenGraph(value: unknown, seen = new Set<object>()): void {
  if (value === null || typeof value === "string" || typeof value === "boolean"
      || (typeof value === "number" && Number.isFinite(value))) return;
  if (typeof value !== "object") fail("component identity must contain canonical JSON values only");
  if (seen.has(value)) fail("component identity must not contain repeated or cyclic references");
  if (utilTypes.isProxy(value) || !Object.isFrozen(value) || Object.getOwnPropertySymbols(value).length !== 0) {
    fail("component identity must be deeply frozen and symbol-free");
  }
  seen.add(value);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Array.isArray(value)) {
    const keys = Object.keys(value);
    if (keys.length !== value.length || keys.some((key, index) => key !== String(index))) {
      fail("component identity arrays must be exact and dense");
    }
  } else if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
    fail("component identity must contain plain objects only");
  }
  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (key === "length" && Array.isArray(value)) continue;
    if (descriptor.get !== undefined || descriptor.set !== undefined || descriptor.enumerable !== true
        || descriptor.configurable !== false || !("value" in descriptor) || descriptor.writable !== false) {
      fail(`component identity field ${key} is invalid`);
    }
    frozenGraph(descriptor.value, seen);
  }
}

function digest(value: unknown): string {
  return new Bun.CryptoHasher("sha256").update(JSON.stringify(value)).digest("hex");
}

function basisPoints(rate: number): number {
  const value = rate * 10_000;
  if (!Number.isSafeInteger(value) || value < 0) fail("aggregate rate is not an exact basis-point value");
  return value;
}

function split(
  identities: IndiaGstAccommodationLevyComponentIdentityResult["componentIdentities"],
  aggregateRate: number,
): readonly Readonly<{ readonly identity: ComponentIdentity; readonly rate: number; readonly rateBasisPoints: number }>[] {
  const aggregateRateBasisPoints = basisPoints(aggregateRate);
  const divisor = identities.length;
  if (aggregateRateBasisPoints % divisor !== 0) fail("aggregate rate cannot be divided exactly across components");
  const rateBasisPoints = aggregateRateBasisPoints / divisor;
  const rate = rateBasisPoints / 10_000;
  return Object.freeze(identities.map((identity) => Object.freeze({ identity, rate, rateBasisPoints })));
}

export function deriveIndiaGstAccommodationLevyComponentRateSchedule(
  raw: IndiaGstAccommodationLevyComponentRateScheduleInput,
): IndiaGstAccommodationLevyComponentRateScheduleResult {
  const input = exact(raw, INPUT_KEYS, "levy component-rate input");
  const tenantId = typeof input.tenantId === "string" && UUID.test(input.tenantId)
    ? input.tenantId
    : fail("tenantId must be a canonical UUID");
  const supplied = input.componentIdentity as IndiaGstAccommodationLevyComponentIdentityResult;
  frozenGraph(supplied);

  let rederived: IndiaGstAccommodationLevyComponentIdentityResult;
  try {
    rederived = deriveIndiaGstAccommodationLevyComponentIdentity({
      tenantId,
      historicalResolution: input.historicalResolution as IndiaGstAccommodationHistoricalResolutionResult,
      supplyNature: input.supplyNature as IndiaGstAccommodationSupplyNatureResult,
      componentFamily: input.componentFamily as IndiaGstAccommodationComponentFamilyResult,
      levyInputBundle: input.levyInputBundle as IndiaGstAccommodationLevyInputBundleResult,
    });
  } catch {
    return fail("complete levy-component identity ancestry is invalid");
  }
  if (JSON.stringify(supplied) !== JSON.stringify(rederived)) {
    fail("supplied levy-component identity does not byte-match its complete ancestry");
  }

  const componentRateSlabs = Object.freeze(rederived.gstRoomSlabs.map((slab) => {
    const aggregateRateBasisPoints = basisPoints(slab.rate);
    return Object.freeze({
      uptoMinor: slab.uptoMinor,
      aggregateRate: slab.rate,
      aggregateRateBasisPoints,
      itcEligible: slab.itcEligible,
      components: split(rederived.componentIdentities, slab.rate),
    });
  }));
  const predecessorHashes = Object.freeze({
    ...rederived.predecessorHashes,
    levyComponentIdentity: rederived.evidenceHash,
  });
  const body = Object.freeze({
    propertyNode: rederived.propertyNode,
    reservationId: rederived.reservationId,
    folioId: rederived.folioId,
    supplyDate: rederived.supplyDate,
    selectedVersion: rederived.selectedVersion,
    componentFamily: rederived.componentFamily,
    componentIdentities: rederived.componentIdentities,
    componentRateSlabs,
    legalSources: rederived.legalSources,
    predecessorHashes,
  });
  return Object.freeze({ ...body, evidenceHash: digest({ tenantId, ...body }) });
}
