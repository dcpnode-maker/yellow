import { types as utilTypes } from "node:util";

import type {
  IndiaFinalComponentTaxFiscalSourceComponent,
  IndiaFinalComponentTaxFiscalSourceRoomNight,
} from "../financials";
import {
  composeIndiaIrpAccommodationNumericItemSources,
  type IndiaIrpAccommodationNumericItemSourceInput,
} from "./india-irp-accommodation-numeric-item-source";
import type { IndiaIrpAccommodationSourceResult } from "./india-irp-accommodation-source";
import { composeIndiaIrpOrdinaryRegisteredB2bSupplyType } from "./india-irp-ordinary-registered-b2b-supply-type";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const MONEY = /^(?:0|[1-9][0-9]*)$/;
const MAX_INT64 = 9_223_372_036_854_775_807n;
const SAC = /^\d{6}$/;

const INPUT_KEYS = ["tenantId", "source"] as const;

type ComponentFamily = "igst" | "cgst_sgst" | "cgst_utgst";
type ComponentIdentity = "igst" | "cgst" | "sgst" | "utgst";

export interface IndiaIrpAccommodationRoomNightItemCandidateInput
  extends IndiaIrpAccommodationNumericItemSourceInput {}

export interface IndiaIrpAccommodationRoomNightItemLineage {
  readonly roomNightOrdinal: string;
  readonly businessDate: string;
  readonly sourceEvidenceHash: string;
  readonly componentFamily: ComponentFamily;
  readonly components: readonly IndiaIrpAccommodationRoomNightItemComponentLineage[];
}

export interface IndiaIrpAccommodationRoomNightItemComponentLineage {
  readonly componentOrdinal: number;
  readonly componentIdentity: ComponentIdentity;
  readonly rateBasisPoints: number;
  readonly taxAmountMinor: string;
}

export interface IndiaIrpAccommodationRoomNightItemCommon {
  readonly SlNo: string;
  readonly IsServc: "Y";
  readonly HsnCd: string;
  readonly UnitPrice: string;
  readonly TotAmt: string;
  readonly AssAmt: string;
  readonly GstRt: string;
}

export type IndiaIrpAccommodationRoomNightItemIrpFields =
  IndiaIrpAccommodationRoomNightItemCommon &
  ({ readonly IgstAmt: string } | { readonly CgstAmt: string; readonly SgstAmt: string }) & {
    readonly TotItemVal: string;
  };

export interface IndiaIrpAccommodationRoomNightItemCandidate {
  readonly irp: IndiaIrpAccommodationRoomNightItemIrpFields;
  readonly lineage: IndiaIrpAccommodationRoomNightItemLineage;
}

export interface IndiaIrpAccommodationRoomNightItemCandidatesResult {
  readonly state: "eligible_irp_accommodation_room_night_item_candidates";
  readonly supplyTypeCode: "B2B";
  readonly currency: "INR";
  readonly items: readonly IndiaIrpAccommodationRoomNightItemCandidate[];
  readonly sourceEvidenceHash: string;
  readonly evidenceHash: string;
}

export class IndiaIrpAccommodationRoomNightItemCandidateValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaIrpAccommodationRoomNightItemCandidateValidationError";
  }
}

function fail(message: string): never {
  throw new IndiaIrpAccommodationRoomNightItemCandidateValidationError(message);
}

function digest(value: unknown): string {
  return new Bun.CryptoHasher("sha256").update(JSON.stringify(value)).digest("hex");
}

function exactFrozenGraph(
  value: unknown,
  seen = new Set<object>(),
  active = new Set<object>(),
): void {
  if (value === null || typeof value === "string" || typeof value === "boolean" ||
      (typeof value === "number" && Number.isFinite(value))) return;
  if (typeof value !== "object" || utilTypes.isProxy(value) || !Object.isFrozen(value) ||
      Object.getOwnPropertySymbols(value).length !== 0) {
    return fail("room-night item candidate input must be an exact deeply frozen graph");
  }
  if (active.has(value)) return fail("room-night item candidate input must be acyclic");
  if (seen.has(value)) return;
  seen.add(value);
  active.add(value);
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype) {
    return fail("room-night item candidate input must contain plain records");
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Object.keys(value);
  if (Array.isArray(value) && (keys.length !== value.length ||
      keys.some((key, index) => key !== String(index)))) {
    return fail("room-night item candidate arrays must be dense");
  }
  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (Array.isArray(value) && key === "length") continue;
    if (descriptor.get !== undefined || descriptor.set !== undefined ||
        descriptor.enumerable !== true || descriptor.configurable !== false ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") || descriptor.writable !== false) {
      return fail("room-night item candidate input descriptors are invalid");
    }
    exactFrozenGraph(descriptor.value, seen, active);
  }
  active.delete(value);
}

function exactInput(value: unknown): IndiaIrpAccommodationRoomNightItemCandidateInput {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return fail("input must be an exact record");
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Object.keys(descriptors);
  if (keys.length !== INPUT_KEYS.length || keys.some((key, index) => key !== INPUT_KEYS[index]) ||
      Object.getOwnPropertySymbols(value).length !== 0 ||
      Object.values(descriptors).some((descriptor) => descriptor.get !== undefined ||
        descriptor.set !== undefined || descriptor.enumerable !== true ||
        descriptor.configurable !== false || descriptor.writable !== false ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value"))) {
    return fail("input shape is invalid");
  }
  const input = value as IndiaIrpAccommodationRoomNightItemCandidateInput;
  if (typeof input.tenantId !== "string" || !UUID.test(input.tenantId)) {
    return fail("tenantId must be a lowercase UUID");
  }
  return input;
}

function minorToDecimal(value: unknown, subject: string): string {
  if (typeof value !== "string" || !MONEY.test(value)) return fail(`${subject} must be canonical minor units`);
  const minor = BigInt(value);
  if (minor > MAX_INT64) return fail(`${subject} exceeds signed-int64 range`);
  const whole = minor / 100n;
  const fraction = (minor % 100n).toString().padStart(2, "0");
  return `${whole.toString()}.${fraction}`;
}

function rateToPercent(value: unknown, subject: string): string {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    return fail(`${subject} must be a non-negative safe integer basis-point rate`);
  }
  const whole = Math.floor(value / 100);
  const fraction = String(value % 100).padStart(2, "0");
  return `${whole}.${fraction}`;
}

function expectedIdentities(family: ComponentFamily): readonly ComponentIdentity[] {
  switch (family) {
    case "igst": return ["igst"];
    case "cgst_sgst": return ["cgst", "sgst"];
    case "cgst_utgst": return ["cgst", "utgst"];
  }
}

function componentLineage(
  components: readonly IndiaFinalComponentTaxFiscalSourceComponent[],
  family: ComponentFamily,
): readonly IndiaIrpAccommodationRoomNightItemComponentLineage[] {
  const identities = expectedIdentities(family);
  if (components.length !== identities.length) return fail("component topology is invalid");
  return components.map((component, index) => {
    if (component.componentOrdinal !== index || component.componentIdentity !== identities[index]) {
      return fail("component lineage is not dense and ordered");
    }
    if (!Number.isSafeInteger(component.rateBasisPoints) || component.rateBasisPoints < 0) {
      return fail("component rate is invalid");
    }
    minorToDecimal(component.taxAmountMinor, "component tax amount");
    return {
      componentOrdinal: component.componentOrdinal,
      componentIdentity: component.componentIdentity,
      rateBasisPoints: component.rateBasisPoints,
      taxAmountMinor: component.taxAmountMinor,
    };
  });
}

function itemForNight(
  night: IndiaFinalComponentTaxFiscalSourceRoomNight & {
    readonly components: readonly IndiaFinalComponentTaxFiscalSourceComponent[];
  },
  classificationCode: string,
  family: ComponentFamily,
  sourceEvidenceHash: string,
): IndiaIrpAccommodationRoomNightItemCandidate {
  if (!/^\d+$/.test(night.ordinal)) return fail("room-night ordinal is malformed");
  const value = minorToDecimal(night.transactionValueMinor, "room-night transaction value");
  const tax = minorToDecimal(night.taxMinor, "room-night tax");
  const totalMinor = BigInt(night.transactionValueMinor) + BigInt(night.taxMinor);
  if (totalMinor > MAX_INT64) return fail("room-night total exceeds signed-int64 range");
  const total = minorToDecimal(totalMinor.toString(), "room-night total");
  const components = componentLineage(night.components, family);
  const taxFields = family === "igst"
    ? { IgstAmt: tax }
    : { CgstAmt: decimalForIdentity(components, "cgst"), SgstAmt: family === "cgst_utgst"
        ? decimalForIdentity(components, "utgst")
        : decimalForIdentity(components, "sgst") };
  return {
    irp: {
      SlNo: String(Number(night.ordinal) + 1),
      IsServc: "Y",
      HsnCd: classificationCode,
      UnitPrice: value,
      TotAmt: value,
      AssAmt: value,
      GstRt: rateToPercent(night.aggregateRateBasisPoints, "room-night aggregate rate"),
      ...taxFields,
      TotItemVal: total,
    },
    lineage: {
      roomNightOrdinal: night.ordinal,
      businessDate: night.businessDate,
      sourceEvidenceHash,
      componentFamily: family,
      components,
    },
  };
}

function decimalForIdentity(
  components: readonly IndiaIrpAccommodationRoomNightItemComponentLineage[],
  identity: ComponentIdentity,
): string {
  const component = components.find((candidate) => candidate.componentIdentity === identity);
  if (component === undefined) return fail(`missing ${identity} component`);
  return minorToDecimal(component.taxAmountMinor, `${identity} tax amount`);
}

function composeValidated(
  rawInput: IndiaIrpAccommodationRoomNightItemCandidateInput,
): IndiaIrpAccommodationRoomNightItemCandidatesResult {
  exactFrozenGraph(rawInput);
  const input = exactInput(rawInput);
  const numericInput = Object.freeze({
    tenantId: input.tenantId,
    source: input.source,
  }) satisfies IndiaIrpAccommodationNumericItemSourceInput;
  const numeric = composeIndiaIrpAccommodationNumericItemSources(numericInput);
  const b2b = composeIndiaIrpOrdinaryRegisteredB2bSupplyType(numericInput);
  if (b2b.sourceEvidenceHash !== numeric.sourceEvidenceHash ||
      numeric.currency !== "INR" || numeric.componentFamily === undefined ||
      !SAC.test(numeric.classification.classificationCode) ||
      numeric.classification.classificationSystem !== "SAC" ||
      numeric.classification.isServiceCode !== "Y") {
    return fail("numeric and ordinary B2B sources are inconsistent");
  }
  const items = numeric.roomNights.map((night) => itemForNight(
    night,
    numeric.classification.classificationCode,
    numeric.componentFamily,
    numeric.sourceEvidenceHash,
  ));
  const body = {
    state: "eligible_irp_accommodation_room_night_item_candidates" as const,
    supplyTypeCode: "B2B" as const,
    currency: "INR" as const,
    items,
    sourceEvidenceHash: numeric.sourceEvidenceHash,
  };
  return recursivelyFreeze({ ...body, evidenceHash: digest({ tenantId: input.tenantId, ...body }) });
}

function recursivelyFreeze<T>(value: T, seen = new Set<object>()): T {
  if (value !== null && typeof value === "object" && !seen.has(value)) {
    seen.add(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      recursivelyFreeze(child, seen);
    }
    Object.freeze(value);
  }
  return value;
}

export function composeIndiaIrpAccommodationRoomNightItemCandidates(
  input: IndiaIrpAccommodationRoomNightItemCandidateInput,
): IndiaIrpAccommodationRoomNightItemCandidatesResult {
  try {
    return composeValidated(input);
  } catch (error) {
    if (error instanceof IndiaIrpAccommodationRoomNightItemCandidateValidationError) throw error;
    if (error instanceof Error) {
      throw new IndiaIrpAccommodationRoomNightItemCandidateValidationError(
        "room-night item candidate evidence is malformed",
      );
    }
    throw error;
  }
}
