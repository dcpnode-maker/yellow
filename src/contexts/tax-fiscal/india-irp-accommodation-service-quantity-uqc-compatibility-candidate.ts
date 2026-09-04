import {
  composeIndiaIrpAccommodationRoomNightItemCandidates,
  type IndiaIrpAccommodationRoomNightItemCandidateInput,
  type IndiaIrpAccommodationRoomNightItemCommon,
  type IndiaIrpAccommodationRoomNightItemIrpFields,
  type IndiaIrpAccommodationRoomNightItemLineage,
} from "./india-irp-accommodation-room-night-item-candidate";

const SHA256 = /^[0-9a-f]{64}$/;

type ComponentFamily = "igst" | "cgst_sgst" | "cgst_utgst";

export type IndiaIrpAccommodationServiceQuantityUqcCompatibilityCandidateInput =
  IndiaIrpAccommodationRoomNightItemCandidateInput;

export type IndiaIrpAccommodationServiceQuantityUqcCompatibilityIrpFields =
  IndiaIrpAccommodationRoomNightItemCommon & {
    readonly Qty: "1.000";
    readonly Unit: "OTH";
  } & ({ readonly IgstAmt: string } | { readonly CgstAmt: string; readonly SgstAmt: string }) & {
    readonly TotItemVal: string;
  };

export interface IndiaIrpAccommodationServiceQuantityUqcCompatibilityItem {
  readonly irp: IndiaIrpAccommodationServiceQuantityUqcCompatibilityIrpFields;
  readonly lineage: IndiaIrpAccommodationRoomNightItemLineage;
}

export interface IndiaIrpAccommodationServiceQuantityUqcCompatibilityLineage {
  readonly itemCandidateEvidenceHash: string;
  readonly sourceEvidenceHash: string;
  readonly itemCount: number;
  readonly componentFamily: ComponentFamily;
}

export interface IndiaIrpAccommodationServiceQuantityUqcCompatibilityCandidate {
  readonly state: "eligible_irp_accommodation_service_quantity_uqc_compatibility_candidate";
  readonly supplyTypeCode: "B2B";
  readonly currency: "INR";
  readonly items: readonly IndiaIrpAccommodationServiceQuantityUqcCompatibilityItem[];
  readonly lineage: IndiaIrpAccommodationServiceQuantityUqcCompatibilityLineage;
  readonly sourceEvidenceHash: string;
  readonly evidenceHash: string;
}

export class IndiaIrpAccommodationServiceQuantityUqcCompatibilityCandidateValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaIrpAccommodationServiceQuantityUqcCompatibilityCandidateValidationError";
  }
}

function fail(message: string): never {
  throw new IndiaIrpAccommodationServiceQuantityUqcCompatibilityCandidateValidationError(message);
}

function digest(value: unknown): string {
  return new Bun.CryptoHasher("sha256").update(JSON.stringify(value)).digest("hex");
}

function recursivelyFreeze<T>(value: T, seen = new Set<object>()): T {
  if (value !== null && typeof value === "object" && !seen.has(value)) {
    seen.add(value);
    for (const child of Object.values(value as Record<string, unknown>)) recursivelyFreeze(child, seen);
    Object.freeze(value);
  }
  return value;
}

function exactKeys(value: object, expected: readonly string[], subject: string): void {
  const keys = Object.keys(value);
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    return fail(`${subject} shape is invalid`);
  }
}

function projectIrp(
  irp: IndiaIrpAccommodationRoomNightItemIrpFields,
  family: ComponentFamily,
): IndiaIrpAccommodationServiceQuantityUqcCompatibilityIrpFields {
  if (irp.UnitPrice !== irp.TotAmt) return fail("inherited UnitPrice and TotAmt must be identical");
  if (family === "igst") {
    exactKeys(irp, ["SlNo", "IsServc", "HsnCd", "UnitPrice", "TotAmt", "AssAmt", "GstRt", "IgstAmt", "TotItemVal"], "inherited IGST item");
    if (!("IgstAmt" in irp)) return fail("inherited IGST item is inconsistent");
    return {
      SlNo: irp.SlNo, IsServc: irp.IsServc, HsnCd: irp.HsnCd, Qty: "1.000", Unit: "OTH",
      UnitPrice: irp.UnitPrice, TotAmt: irp.TotAmt, AssAmt: irp.AssAmt, GstRt: irp.GstRt,
      IgstAmt: irp.IgstAmt, TotItemVal: irp.TotItemVal,
    };
  }
  exactKeys(irp, ["SlNo", "IsServc", "HsnCd", "UnitPrice", "TotAmt", "AssAmt", "GstRt", "CgstAmt", "SgstAmt", "TotItemVal"], "inherited split-tax item");
  if (!("CgstAmt" in irp) || !("SgstAmt" in irp)) return fail("inherited split-tax item is inconsistent");
  return {
    SlNo: irp.SlNo, IsServc: irp.IsServc, HsnCd: irp.HsnCd, Qty: "1.000", Unit: "OTH",
    UnitPrice: irp.UnitPrice, TotAmt: irp.TotAmt, AssAmt: irp.AssAmt, GstRt: irp.GstRt,
    CgstAmt: irp.CgstAmt, SgstAmt: irp.SgstAmt, TotItemVal: irp.TotItemVal,
  };
}

function composeValidated(
  input: IndiaIrpAccommodationServiceQuantityUqcCompatibilityCandidateInput,
): IndiaIrpAccommodationServiceQuantityUqcCompatibilityCandidate {
  const inherited = composeIndiaIrpAccommodationRoomNightItemCandidates(input);
  if (inherited.supplyTypeCode !== "B2B" || inherited.currency !== "INR" ||
      inherited.sourceEvidenceHash !== input.source.evidenceHash ||
      !SHA256.test(inherited.sourceEvidenceHash) || !SHA256.test(inherited.evidenceHash) ||
      inherited.items.length === 0) {
    return fail("inherited item-candidate evidence is inconsistent");
  }
  const componentFamily = inherited.items[0]!.lineage.componentFamily;
  if (componentFamily !== "igst" && componentFamily !== "cgst_sgst" && componentFamily !== "cgst_utgst") {
    return fail("inherited component family is invalid");
  }
  const items = inherited.items.map((item, index) => {
    exactKeys(item, ["irp", "lineage"], "inherited item");
    if (item.lineage.roomNightOrdinal !== String(index) ||
        item.lineage.sourceEvidenceHash !== inherited.sourceEvidenceHash ||
        item.lineage.componentFamily !== componentFamily) {
      return fail("inherited item order, lineage or component family is inconsistent");
    }
    return { irp: projectIrp(item.irp, componentFamily), lineage: item.lineage };
  });
  const lineage = {
    itemCandidateEvidenceHash: inherited.evidenceHash,
    sourceEvidenceHash: inherited.sourceEvidenceHash,
    itemCount: inherited.items.length,
    componentFamily,
  };
  const body = {
    state: "eligible_irp_accommodation_service_quantity_uqc_compatibility_candidate" as const,
    supplyTypeCode: "B2B" as const,
    currency: "INR" as const,
    items,
    lineage,
    sourceEvidenceHash: inherited.sourceEvidenceHash,
  };
  return recursivelyFreeze({ ...body, evidenceHash: digest({ tenantId: input.tenantId, ...body }) });
}

export function composeIndiaIrpAccommodationServiceQuantityUqcCompatibilityCandidate(
  input: IndiaIrpAccommodationServiceQuantityUqcCompatibilityCandidateInput,
): IndiaIrpAccommodationServiceQuantityUqcCompatibilityCandidate {
  try {
    return composeValidated(input);
  } catch (error) {
    if (error instanceof IndiaIrpAccommodationServiceQuantityUqcCompatibilityCandidateValidationError) throw error;
    if (error instanceof Error) {
      throw new IndiaIrpAccommodationServiceQuantityUqcCompatibilityCandidateValidationError(
        "service quantity/UQC compatibility candidate evidence is malformed",
      );
    }
    throw error;
  }
}
