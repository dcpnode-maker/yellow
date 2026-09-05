import {
  composeIndiaIrpAccommodationNumericItemSources,
  type IndiaIrpAccommodationNumericItemSourceInput,
} from "./india-irp-accommodation-numeric-item-source";
import type { IndiaIrpBuyerDetailsV1 } from "./india-irp-buyer-details";
import type { IndiaIrpSellerDetailsV1 } from "./india-irp-seller-details";

export interface IndiaIrpAccommodationPartyDetailsCandidateInput
  extends IndiaIrpAccommodationNumericItemSourceInput {}

export interface IndiaIrpAccommodationPartyDetailsBuyerV1
  extends IndiaIrpBuyerDetailsV1 {
  readonly Pos: string;
}

export interface IndiaIrpAccommodationPartyDetailsCandidateLineage {
  readonly sourceEvidenceHash: string;
  readonly sellerPayloadHash: string;
  readonly buyerPayloadHash: string;
  readonly placeOfSupplyCandidateHash: string;
}

export interface IndiaIrpAccommodationPartyDetailsCandidate {
  readonly state: "eligible_irp_accommodation_party_details_candidate";
  readonly format: "irp_json_1_1";
  readonly payload: Readonly<{
    SellerDtls: Readonly<IndiaIrpSellerDetailsV1>;
    BuyerDtls: Readonly<IndiaIrpAccommodationPartyDetailsBuyerV1>;
  }>;
  readonly payloadJson: string;
  readonly lineage: Readonly<IndiaIrpAccommodationPartyDetailsCandidateLineage>;
  readonly sourceEvidenceHash: string;
  readonly evidenceHash: string;
}

export class IndiaIrpAccommodationPartyDetailsCandidateValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaIrpAccommodationPartyDetailsCandidateValidationError";
  }
}

function digest(value: unknown): string {
  return new Bun.CryptoHasher("sha256").update(JSON.stringify(value)).digest("hex");
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

export function composeIndiaIrpAccommodationPartyDetailsCandidate(
  input: IndiaIrpAccommodationPartyDetailsCandidateInput,
): IndiaIrpAccommodationPartyDetailsCandidate {
  try {
    const validated = composeIndiaIrpAccommodationNumericItemSources(input);
    const source = input.source;
    if (validated.sourceEvidenceHash !== source.evidenceHash) {
      throw new IndiaIrpAccommodationPartyDetailsCandidateValidationError(
        "validated Order413 source hash is inconsistent",
      );
    }

    const seller = source.sellerDetails.payload.SellerDtls;
    const buyer = source.buyerDetails.payload.BuyerDtls;
    const buyerWithPos: IndiaIrpAccommodationPartyDetailsBuyerV1 = {
      ...buyer,
      Pos: source.placeOfSupply.pos,
    };
    const payload = {
      SellerDtls: seller,
      BuyerDtls: buyerWithPos,
    };
    const payloadJson = JSON.stringify(payload);
    const lineage = {
      sourceEvidenceHash: source.evidenceHash,
      sellerPayloadHash: source.sellerDetails.payloadHash,
      buyerPayloadHash: source.buyerDetails.payloadHash,
      placeOfSupplyCandidateHash: source.placeOfSupply.candidateHash,
    };
    const body = {
      state: "eligible_irp_accommodation_party_details_candidate" as const,
      format: "irp_json_1_1" as const,
      payload,
      payloadJson,
      lineage,
      sourceEvidenceHash: source.evidenceHash,
    };
    return recursivelyFreeze({
      ...body,
      evidenceHash: digest({ tenantId: input.tenantId, ...body }),
    });
  } catch (error) {
    if (error instanceof IndiaIrpAccommodationPartyDetailsCandidateValidationError) {
      throw error;
    }
    if (error instanceof Error) {
      throw new IndiaIrpAccommodationPartyDetailsCandidateValidationError(
        "party-details evidence is malformed",
      );
    }
    throw error;
  }
}
