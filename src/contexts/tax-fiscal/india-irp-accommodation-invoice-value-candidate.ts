import { types as utilTypes } from "node:util";

import {
  composeIndiaIrpAccommodationRoomNightItemCandidates,
  type IndiaIrpAccommodationRoomNightItemCandidateInput,
  type IndiaIrpAccommodationRoomNightItemCandidatesResult,
} from "./india-irp-accommodation-room-night-item-candidate";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MONEY = /^(?:0|[1-9][0-9]*)\.[0-9]{2}$/;
const MAX_INT64 = 9_223_372_036_854_775_807n;

const INPUT_KEYS = ["tenantId", "source"] as const;

type ComponentFamily = "igst" | "cgst_sgst" | "cgst_utgst";

export interface IndiaIrpAccommodationInvoiceValueCandidateInput
  extends IndiaIrpAccommodationRoomNightItemCandidateInput {}

export interface IndiaIrpAccommodationInvoiceValueCandidateLineage {
  readonly itemCandidateEvidenceHash: string;
  readonly sourceEvidenceHash: string;
  readonly itemCount: number;
  readonly componentFamily: ComponentFamily;
}

export type IndiaIrpAccommodationInvoiceValueIrpFields =
  { readonly AssVal: string } &
  ({ readonly IgstVal: string } | { readonly CgstVal: string; readonly SgstVal: string }) &
  { readonly TotInvVal: string };

export interface IndiaIrpAccommodationInvoiceValueCandidate {
  readonly state: "eligible_irp_accommodation_invoice_value_candidate";
  readonly supplyTypeCode: "B2B";
  readonly currency: "INR";
  readonly valDtls: IndiaIrpAccommodationInvoiceValueIrpFields;
  readonly lineage: IndiaIrpAccommodationInvoiceValueCandidateLineage;
  readonly sourceEvidenceHash: string;
  readonly evidenceHash: string;
}

export class IndiaIrpAccommodationInvoiceValueCandidateValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaIrpAccommodationInvoiceValueCandidateValidationError";
  }
}

function fail(message: string): never {
  throw new IndiaIrpAccommodationInvoiceValueCandidateValidationError(message);
}

function digest(value: unknown): string {
  return new Bun.CryptoHasher("sha256").update(JSON.stringify(value)).digest("hex");
}

function exactFrozenGraph(value: unknown, seen = new Set<object>(), active = new Set<object>()): void {
  if (value === null || typeof value === "string" || typeof value === "boolean" ||
      (typeof value === "number" && Number.isFinite(value))) return;
  if (typeof value !== "object" || utilTypes.isProxy(value) || !Object.isFrozen(value) ||
      Object.getOwnPropertySymbols(value).length !== 0) {
    return fail("invoice-value candidate input must be an exact deeply frozen graph");
  }
  if (active.has(value)) return fail("invoice-value candidate input must be acyclic");
  if (seen.has(value)) return;
  seen.add(value); active.add(value);
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype) {
    return fail("invoice-value candidate input must contain plain records");
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Object.keys(value);
  if (Array.isArray(value) && (keys.length !== value.length ||
      keys.some((key, index) => key !== String(index)))) return fail("invoice-value arrays must be dense");
  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (Array.isArray(value) && key === "length") continue;
    if (descriptor.get !== undefined || descriptor.set !== undefined || descriptor.enumerable !== true ||
        descriptor.configurable !== false || !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.writable !== false) return fail("invoice-value input descriptors are invalid");
    exactFrozenGraph(descriptor.value, seen, active);
  }
  active.delete(value);
}

function exactInput(value: unknown): IndiaIrpAccommodationInvoiceValueCandidateInput {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return fail("input must be an exact record");
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Object.keys(descriptors);
  if (keys.length !== INPUT_KEYS.length || keys.some((key, index) => key !== INPUT_KEYS[index]) ||
      Object.getOwnPropertySymbols(value).length !== 0 || Object.values(descriptors).some((descriptor) =>
        descriptor.get !== undefined || descriptor.set !== undefined || descriptor.enumerable !== true ||
        descriptor.configurable !== false || descriptor.writable !== false ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value"))) return fail("input shape is invalid");
  const input = value as IndiaIrpAccommodationInvoiceValueCandidateInput;
  if (typeof input.tenantId !== "string" || !UUID.test(input.tenantId)) return fail("tenantId must be a lowercase UUID");
  return input;
}

function moneyToMinor(value: unknown, subject: string): bigint {
  if (typeof value !== "string" || !MONEY.test(value)) return fail(`${subject} must be canonical two-decimal INR`);
  const [whole, fraction] = value.split(".");
  const minor = BigInt(whole!) * 100n + BigInt(fraction!);
  if (minor > MAX_INT64) return fail(`${subject} exceeds signed-int64 range`);
  return minor;
}

function minorToMoney(value: bigint, subject: string): string {
  if (value < 0n || value > MAX_INT64) return fail(`${subject} exceeds signed-int64 range`);
  return `${(value / 100n).toString()}.${(value % 100n).toString().padStart(2, "0")}`;
}

function sum(values: readonly bigint[], subject: string): bigint {
  let result = 0n;
  for (const value of values) {
    result += value;
    if (result > MAX_INT64) return fail(`${subject} exceeds signed-int64 range`);
  }
  return result;
}

function derive(
  input: IndiaIrpAccommodationInvoiceValueCandidateInput,
  candidates: IndiaIrpAccommodationRoomNightItemCandidatesResult,
): IndiaIrpAccommodationInvoiceValueCandidate {
  if (candidates.items.length === 0) return fail("invoice-value candidate requires non-empty items");
  const family = candidates.items[0]!.lineage.componentFamily;
  if (candidates.items.some((item, index) => item.lineage.roomNightOrdinal !== String(index) ||
      item.lineage.componentFamily !== family)) return fail("invoice-value items must be dense and one family");
  const assessable = candidates.items.map((item) => moneyToMinor(item.irp.AssAmt, "AssVal item"));
  const totals = candidates.items.map((item) => moneyToMinor(item.irp.TotItemVal, "TotInvVal item"));
  const assVal = sum(assessable, "AssVal");
  const totInvVal = sum(totals, "TotInvVal");
  let valDtls: IndiaIrpAccommodationInvoiceValueIrpFields;
  if (family === "igst") {
    const igst = sum(candidates.items.map((item) => moneyToMinor(
      "IgstAmt" in item.irp ? item.irp.IgstAmt : undefined, "IgstVal item",
    )), "IgstVal");
    if (assVal + igst !== totInvVal) return fail("AssVal plus IgstVal must equal TotInvVal");
    valDtls = { AssVal: minorToMoney(assVal, "AssVal"), IgstVal: minorToMoney(igst, "IgstVal"), TotInvVal: minorToMoney(totInvVal, "TotInvVal") };
  } else {
    const cgst = sum(candidates.items.map((item) => moneyToMinor(
      "CgstAmt" in item.irp ? item.irp.CgstAmt : undefined, "CgstVal item",
    )), "CgstVal");
    const sgst = sum(candidates.items.map((item) => moneyToMinor(
      "SgstAmt" in item.irp ? item.irp.SgstAmt : undefined, "SgstVal item",
    )), "SgstVal");
    if (assVal + cgst + sgst !== totInvVal) return fail("AssVal plus applicable tax must equal TotInvVal");
    valDtls = { AssVal: minorToMoney(assVal, "AssVal"), CgstVal: minorToMoney(cgst, "CgstVal"), SgstVal: minorToMoney(sgst, "SgstVal"), TotInvVal: minorToMoney(totInvVal, "TotInvVal") };
  }
  const body = {
    state: "eligible_irp_accommodation_invoice_value_candidate" as const,
    supplyTypeCode: "B2B" as const,
    currency: "INR" as const,
    valDtls,
    lineage: {
      itemCandidateEvidenceHash: candidates.evidenceHash,
      sourceEvidenceHash: candidates.sourceEvidenceHash,
      itemCount: candidates.items.length,
      componentFamily: family,
    },
    sourceEvidenceHash: candidates.sourceEvidenceHash,
  };
  return recursivelyFreeze({ ...body, evidenceHash: digest({ tenantId: input.tenantId, ...body }) });
}

function recursivelyFreeze<T>(value: T, seen = new Set<object>()): T {
  if (value !== null && typeof value === "object" && !seen.has(value)) {
    seen.add(value);
    for (const child of Object.values(value as Record<string, unknown>)) recursivelyFreeze(child, seen);
    Object.freeze(value);
  }
  return value;
}

export function composeIndiaIrpAccommodationInvoiceValueCandidate(
  rawInput: IndiaIrpAccommodationInvoiceValueCandidateInput,
): IndiaIrpAccommodationInvoiceValueCandidate {
  try {
    exactFrozenGraph(rawInput);
    const input = exactInput(rawInput);
    const candidates = composeIndiaIrpAccommodationRoomNightItemCandidates(input);
    return derive(input, candidates);
  } catch (error) {
    if (error instanceof IndiaIrpAccommodationInvoiceValueCandidateValidationError) throw error;
    if (error instanceof Error) throw new IndiaIrpAccommodationInvoiceValueCandidateValidationError("invoice-value evidence is malformed");
    throw error;
  }
}
