import type { IndiaIrpAccommodationSourceResult } from "./india-irp-accommodation-source";
import {
  composeIndiaIrpAccommodationNumericItemSources,
  type IndiaIrpAccommodationNumericItemSourceInput,
} from "./india-irp-accommodation-numeric-item-source";

export type IndiaIrpOrdinaryRegisteredB2bSupplyTypeInput =
  IndiaIrpAccommodationNumericItemSourceInput;

export interface IndiaIrpOrdinaryRegisteredB2bSupplyTypeResult {
  readonly state: "eligible_irp_ordinary_registered_b2b_supply_type";
  readonly supplyTypeCode: "B2B";
  readonly sourceEvidenceHash: string;
  readonly evidenceHash: string;
}

export class IndiaIrpOrdinaryRegisteredB2bSupplyTypeValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaIrpOrdinaryRegisteredB2bSupplyTypeValidationError";
  }
}

function fail(message: string): never {
  throw new IndiaIrpOrdinaryRegisteredB2bSupplyTypeValidationError(message);
}

function digest(value: unknown): string {
  return new Bun.CryptoHasher("sha256").update(JSON.stringify(value)).digest("hex");
}

function validateOrdinaryRegisteredB2b(source: IndiaIrpAccommodationSourceResult): void {
  const atTime = source.supplyNatureAtTimeOfSupply;
  const family = source.componentFamily;
  if (source.recipientRegistration.scheme !== "in-gstin" ||
      source.recipientRegistration.partyId !== source.legalBuyerPartyId ||
      source.buyerDetails.lineage.partyId !== source.legalBuyerPartyId ||
      source.buyerDetails.lineage.registrationId !== source.recipientRegistration.registrationId ||
      source.buyerDetails.lineage.evidenceHash !== source.recipientRegistration.evidenceHash ||
      source.buyerDetails.payload.BuyerDtls.Gstin !== source.recipientRegistration.gstin ||
      source.sellerRegistration.scheme !== "in-gstin" || source.sellerRegistration.currency !== "INR" ||
      source.financialSource.currency !== "INR" || source.classification.classificationSystem !== "SAC" ||
      source.classification.isServiceCode !== "Y" || source.placeOfSupply.legalRule !== "IGST_ACT_12_3_B" ||
      atTime.result !== "supply_nature_and_registrations_bound_at_time_of_supply" ||
      atTime.determinationBasis !== "ordinary_registered_state_comparison" ||
      atTime.sezDirection !== "none" || family.determinationBasis !== atTime.determinationBasis ||
      family.sezDirection !== atTime.sezDirection || family.supplyNature !== atTime.supplyNature ||
      family.legalSources.supplyNature !== atTime.legalRule) {
    return fail("source is not an ordinary registered Indian B2B accommodation supply");
  }

  switch (atTime.supplyNature) {
    case "intra_state":
      if (atTime.legalRule !== "IGST_ACT_8_2" ||
          (family.componentFamily !== "cgst_sgst" && family.componentFamily !== "cgst_utgst") ||
          (family.componentFamily === "cgst_sgst" &&
            family.legalSources.componentFamily !== "CGST_ACT_9_1_AND_SGST_ACT") ||
          (family.componentFamily === "cgst_utgst" &&
            family.legalSources.componentFamily !== "CGST_ACT_9_1_AND_UTGST_ACT_7_1")) {
        return fail("ordinary intra-State B2B supply evidence is inconsistent");
      }
      return;
    case "inter_state":
      if (atTime.legalRule !== "IGST_ACT_7_3" || family.componentFamily !== "igst" ||
          family.legalSources.componentFamily !== "IGST_ACT_5_1") {
        return fail("ordinary inter-State B2B supply evidence is inconsistent");
      }
      return;
  }
}

export function composeIndiaIrpOrdinaryRegisteredB2bSupplyType(
  input: IndiaIrpOrdinaryRegisteredB2bSupplyTypeInput,
): IndiaIrpOrdinaryRegisteredB2bSupplyTypeResult {
  try {
    composeIndiaIrpAccommodationNumericItemSources(input);
    validateOrdinaryRegisteredB2b(input.source);
    const body = {
      state: "eligible_irp_ordinary_registered_b2b_supply_type" as const,
      supplyTypeCode: "B2B" as const,
      sourceEvidenceHash: input.source.evidenceHash,
    };
    return Object.freeze({ ...body, evidenceHash: digest({ tenantId: input.tenantId, ...body }) });
  } catch (error) {
    if (error instanceof IndiaIrpOrdinaryRegisteredB2bSupplyTypeValidationError) throw error;
    throw new IndiaIrpOrdinaryRegisteredB2bSupplyTypeValidationError(
      "ordinary registered B2B source evidence is malformed",
    );
  }
}
