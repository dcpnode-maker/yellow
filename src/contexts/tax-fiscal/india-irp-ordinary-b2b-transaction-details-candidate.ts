import {
  composeIndiaIrpOrdinaryRegisteredB2bSupplyType,
  type IndiaIrpOrdinaryRegisteredB2bSupplyTypeInput,
} from "./india-irp-ordinary-registered-b2b-supply-type";

export type IndiaIrpOrdinaryB2bTransactionDetailsCandidateInput =
  IndiaIrpOrdinaryRegisteredB2bSupplyTypeInput;

export interface IndiaIrpOrdinaryB2bTransactionDetailsV1 {
  readonly TaxSch: "GST";
  readonly SupTyp: "B2B";
}

export interface IndiaIrpOrdinaryB2bTransactionDetailsCandidateLineage {
  readonly sourceEvidenceHash: string;
  readonly supplyTypeEvidenceHash: string;
}

export interface IndiaIrpOrdinaryB2bTransactionDetailsCandidate {
  readonly state: "eligible_irp_ordinary_b2b_transaction_details_candidate";
  readonly format: "irp_json_1_1";
  readonly payload: Readonly<{
    TranDtls: Readonly<IndiaIrpOrdinaryB2bTransactionDetailsV1>;
  }>;
  readonly payloadJson: string;
  readonly lineage: Readonly<IndiaIrpOrdinaryB2bTransactionDetailsCandidateLineage>;
  readonly sourceEvidenceHash: string;
  readonly evidenceHash: string;
}

export class IndiaIrpOrdinaryB2bTransactionDetailsCandidateValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaIrpOrdinaryB2bTransactionDetailsCandidateValidationError";
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

export function composeIndiaIrpOrdinaryB2bTransactionDetailsCandidate(
  input: IndiaIrpOrdinaryB2bTransactionDetailsCandidateInput,
): IndiaIrpOrdinaryB2bTransactionDetailsCandidate {
  try {
    const supply = composeIndiaIrpOrdinaryRegisteredB2bSupplyType(input);
    if (supply.sourceEvidenceHash !== input.source.evidenceHash) {
      throw new IndiaIrpOrdinaryB2bTransactionDetailsCandidateValidationError(
        "validated ordinary-B2B source hash is inconsistent",
      );
    }

    const payload = {
      TranDtls: {
        TaxSch: "GST" as const,
        SupTyp: supply.supplyTypeCode,
      },
    };
    const payloadJson = JSON.stringify(payload);
    const lineage = {
      sourceEvidenceHash: input.source.evidenceHash,
      supplyTypeEvidenceHash: supply.evidenceHash,
    };
    const body = {
      state: "eligible_irp_ordinary_b2b_transaction_details_candidate" as const,
      format: "irp_json_1_1" as const,
      payload,
      payloadJson,
      lineage,
      sourceEvidenceHash: input.source.evidenceHash,
    };
    return recursivelyFreeze({
      ...body,
      evidenceHash: digest({ tenantId: input.tenantId, ...body }),
    });
  } catch (error) {
    if (error instanceof IndiaIrpOrdinaryB2bTransactionDetailsCandidateValidationError) {
      throw error;
    }
    if (error instanceof Error) {
      throw new IndiaIrpOrdinaryB2bTransactionDetailsCandidateValidationError(
        "ordinary-B2B transaction-details evidence is malformed",
      );
    }
    throw error;
  }
}
