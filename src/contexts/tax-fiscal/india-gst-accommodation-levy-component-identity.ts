import { types as utilTypes } from "node:util";

import {
  deriveIndiaGstAccommodationLevyInputBundle,
  type IndiaGstAccommodationLevyInputBundleResult,
} from "./india-gst-accommodation-levy-input-bundle";
import type { IndiaGstAccommodationComponentFamilyResult } from "./india-gst-accommodation-component-family";
import type { IndiaGstAccommodationHistoricalResolutionResult } from "./india-gst-accommodation-historical-resolution";
import type { IndiaGstAccommodationSupplyNatureResult } from "./india-gst-accommodation-supply-nature";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const INPUT_KEYS = ["tenantId", "historicalResolution", "supplyNature", "componentFamily", "levyInputBundle"] as const;

type RecordValue = Record<string, unknown>;
type ComponentFamily = IndiaGstAccommodationLevyInputBundleResult["componentFamily"];
type ComponentIdentityTuple = readonly ["igst"] | readonly ["cgst", "sgst"] | readonly ["cgst", "utgst"];

export interface IndiaGstAccommodationLevyComponentIdentityInput {
  readonly tenantId: string;
  readonly historicalResolution: IndiaGstAccommodationHistoricalResolutionResult;
  readonly supplyNature: IndiaGstAccommodationSupplyNatureResult;
  readonly componentFamily: IndiaGstAccommodationComponentFamilyResult;
  readonly levyInputBundle: IndiaGstAccommodationLevyInputBundleResult;
}

export interface IndiaGstAccommodationLevyComponentIdentityResult {
  readonly propertyNode: string;
  readonly reservationId: string;
  readonly folioId: string;
  readonly supplyDate: string;
  readonly selectedVersion: IndiaGstAccommodationLevyInputBundleResult["selectedVersion"];
  readonly gstRoomSlabs: IndiaGstAccommodationLevyInputBundleResult["gstRoomSlabs"];
  readonly componentFamily: ComponentFamily;
  readonly componentIdentities: ComponentIdentityTuple;
  readonly readiness: "sole_component_aggregate_schedule" | "numeric_component_split_authority_required";
  readonly legalSources: IndiaGstAccommodationLevyInputBundleResult["legalSources"];
  readonly predecessorHashes: Readonly<
    IndiaGstAccommodationLevyInputBundleResult["predecessorHashes"] & { readonly levyInputBundle: string }
  >;
  readonly evidenceHash: string;
}

export class IndiaGstAccommodationLevyComponentIdentityValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaGstAccommodationLevyComponentIdentityValidationError";
  }
}

function fail(message: string): never {
  throw new IndiaGstAccommodationLevyComponentIdentityValidationError(message);
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
  if (typeof value !== "object") fail("levy-input bundle must contain canonical JSON values only");
  if (seen.has(value)) fail("levy-input bundle must not contain repeated or cyclic references");
  if (utilTypes.isProxy(value) || !Object.isFrozen(value) || Object.getOwnPropertySymbols(value).length !== 0) {
    fail("levy-input bundle must be deeply frozen and symbol-free");
  }
  seen.add(value);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Array.isArray(value)) {
    const keys = Object.keys(value);
    if (keys.length !== value.length || keys.some((key, index) => key !== String(index))) {
      fail("levy-input bundle arrays must be exact and dense");
    }
  } else if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
    fail("levy-input bundle must contain plain objects only");
  }
  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (key === "length" && Array.isArray(value)) continue;
    if (descriptor.get !== undefined || descriptor.set !== undefined || descriptor.enumerable !== true
        || descriptor.configurable !== false || !("value" in descriptor) || descriptor.writable !== false) {
      fail(`levy-input bundle field ${key} is invalid`);
    }
    frozenGraph(descriptor.value, seen);
  }
}

function digest(value: unknown): string {
  return new Bun.CryptoHasher("sha256").update(JSON.stringify(value)).digest("hex");
}

function identities(family: ComponentFamily): ComponentIdentityTuple {
  switch (family) {
    case "igst": return Object.freeze(["igst"] as const);
    case "cgst_sgst": return Object.freeze(["cgst", "sgst"] as const);
    case "cgst_utgst": return Object.freeze(["cgst", "utgst"] as const);
  }
}

export function deriveIndiaGstAccommodationLevyComponentIdentity(
  raw: IndiaGstAccommodationLevyComponentIdentityInput,
): IndiaGstAccommodationLevyComponentIdentityResult {
  const input = exact(raw, INPUT_KEYS, "levy-component identity input");
  const tenantId = typeof input.tenantId === "string" && UUID.test(input.tenantId)
    ? input.tenantId
    : fail("tenantId must be a canonical UUID");
  const supplied = input.levyInputBundle as IndiaGstAccommodationLevyInputBundleResult;
  frozenGraph(supplied);

  let rederived: IndiaGstAccommodationLevyInputBundleResult;
  try {
    rederived = deriveIndiaGstAccommodationLevyInputBundle({
      tenantId,
      historicalResolution: input.historicalResolution as IndiaGstAccommodationHistoricalResolutionResult,
      supplyNature: input.supplyNature as IndiaGstAccommodationSupplyNatureResult,
      componentFamily: input.componentFamily as IndiaGstAccommodationComponentFamilyResult,
    });
  } catch {
    return fail("complete levy-input ancestry is invalid");
  }
  if (JSON.stringify(supplied) !== JSON.stringify(rederived)) {
    fail("supplied levy-input bundle does not byte-match its complete ancestry");
  }

  const componentIdentities = identities(rederived.componentFamily);
  const readiness = rederived.componentFamily === "igst"
    ? "sole_component_aggregate_schedule" as const
    : "numeric_component_split_authority_required" as const;
  const predecessorHashes = Object.freeze({
    ...rederived.predecessorHashes,
    levyInputBundle: rederived.evidenceHash,
  });
  const body = Object.freeze({
    propertyNode: rederived.propertyNode,
    reservationId: rederived.reservationId,
    folioId: rederived.folioId,
    supplyDate: rederived.supplyDate,
    selectedVersion: rederived.selectedVersion,
    gstRoomSlabs: rederived.gstRoomSlabs,
    componentFamily: rederived.componentFamily,
    componentIdentities,
    readiness,
    legalSources: rederived.legalSources,
    predecessorHashes,
  });
  return Object.freeze({ ...body, evidenceHash: digest({ tenantId, ...body }) });
}
