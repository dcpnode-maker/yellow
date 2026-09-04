import { composeIndiaIrpAccommodationInvoiceValueCandidate, type IndiaIrpAccommodationInvoiceValueCandidateInput, type IndiaIrpAccommodationInvoiceValueIrpFields } from "./india-irp-accommodation-invoice-value-candidate";
import { composeIndiaIrpAccommodationPartyDetailsCandidate, type IndiaIrpAccommodationPartyDetailsBuyerV1 } from "./india-irp-accommodation-party-details-candidate";
import { composeIndiaIrpAccommodationRoomNightItemCandidates, type IndiaIrpAccommodationRoomNightItemIrpFields } from "./india-irp-accommodation-room-night-item-candidate";
import { composeIndiaIrpOrdinaryB2bTransactionDetailsCandidate, type IndiaIrpOrdinaryB2bTransactionDetailsV1 } from "./india-irp-ordinary-b2b-transaction-details-candidate";
import type { IndiaIrpSellerDetailsV1 } from "./india-irp-seller-details";

export type IndiaIrpAccommodationPreDocumentEvidenceAssemblyInput = IndiaIrpAccommodationInvoiceValueCandidateInput;

export interface IndiaIrpAccommodationPreDocumentEvidenceSections {
  readonly Version: "1.1";
  readonly TranDtls: Readonly<IndiaIrpOrdinaryB2bTransactionDetailsV1>;
  readonly SellerDtls: Readonly<IndiaIrpSellerDetailsV1>;
  readonly BuyerDtls: Readonly<IndiaIrpAccommodationPartyDetailsBuyerV1>;
  readonly ItemList: readonly Readonly<IndiaIrpAccommodationRoomNightItemIrpFields>[];
  readonly ValDtls: Readonly<IndiaIrpAccommodationInvoiceValueIrpFields>;
}
export interface IndiaIrpAccommodationPreDocumentEvidenceLineage {
  readonly sourceEvidenceHash: string;
  readonly transactionDetailsEvidenceHash: string;
  readonly partyDetailsEvidenceHash: string;
  readonly itemCandidatesEvidenceHash: string;
  readonly invoiceValueEvidenceHash: string;
}
export interface IndiaIrpAccommodationPreDocumentEvidenceAssembly {
  readonly state: "incomplete_non_submit_ready_irp_accommodation_pre_document_evidence";
  readonly format: "irp_json_1_1";
  readonly submissionReady: false;
  readonly explicitlyExcludedEvidence: readonly ["DocDtls", "ItemList[].Qty", "ItemList[].Unit"];
  readonly sections: Readonly<IndiaIrpAccommodationPreDocumentEvidenceSections>;
  readonly sectionsJson: string;
  readonly lineage: Readonly<IndiaIrpAccommodationPreDocumentEvidenceLineage>;
  readonly sourceEvidenceHash: string;
  readonly evidenceHash: string;
}
export class IndiaIrpAccommodationPreDocumentEvidenceAssemblyValidationError extends Error {
  constructor(message: string) { super(message); this.name = "IndiaIrpAccommodationPreDocumentEvidenceAssemblyValidationError"; }
}
function fail(message: string): never { throw new IndiaIrpAccommodationPreDocumentEvidenceAssemblyValidationError(message); }
function digest(value: unknown): string { return new Bun.CryptoHasher("sha256").update(JSON.stringify(value)).digest("hex"); }
function recursivelyFreeze<T>(value: T, seen = new Set<object>()): T {
  if (value !== null && typeof value === "object" && !seen.has(value)) {
    seen.add(value);
    for (const child of Object.values(value as Record<string, unknown>)) recursivelyFreeze(child, seen);
    Object.freeze(value);
  }
  return value;
}
function validateCoherence(
  input: IndiaIrpAccommodationPreDocumentEvidenceAssemblyInput,
  transaction: ReturnType<typeof composeIndiaIrpOrdinaryB2bTransactionDetailsCandidate>,
  parties: ReturnType<typeof composeIndiaIrpAccommodationPartyDetailsCandidate>,
  items: ReturnType<typeof composeIndiaIrpAccommodationRoomNightItemCandidates>,
  values: ReturnType<typeof composeIndiaIrpAccommodationInvoiceValueCandidate>,
): void {
  const sourceEvidenceHash = input.source.evidenceHash;
  if (transaction.sourceEvidenceHash !== sourceEvidenceHash || parties.sourceEvidenceHash !== sourceEvidenceHash ||
      items.sourceEvidenceHash !== sourceEvidenceHash || values.sourceEvidenceHash !== sourceEvidenceHash) {
    return fail("child source evidence hashes are inconsistent");
  }
  if (transaction.format !== "irp_json_1_1" || parties.format !== "irp_json_1_1") return fail("formatted child evidence is inconsistent");
  if (items.items.length === 0 || values.lineage.itemCount !== items.items.length ||
      values.lineage.itemCandidateEvidenceHash !== items.evidenceHash) return fail("item and invoice-value evidence is inconsistent");
  const componentFamily = items.items[0]!.lineage.componentFamily;
  if (values.lineage.componentFamily !== componentFamily || items.items.some((item, index) =>
    item.lineage.roomNightOrdinal !== String(index) || item.lineage.componentFamily !== componentFamily ||
    item.lineage.sourceEvidenceHash !== sourceEvidenceHash)) return fail("item family, order or source lineage is inconsistent");
  if (transaction.payload.TranDtls.TaxSch !== "GST" ||
      transaction.payload.TranDtls.SupTyp !== items.supplyTypeCode ||
      items.supplyTypeCode !== values.supplyTypeCode || items.supplyTypeCode !== "B2B") return fail("ordinary B2B supply-type evidence is inconsistent");
  if (items.currency !== values.currency || items.currency !== "INR") return fail("currency evidence is inconsistent");
}
export function composeIndiaIrpAccommodationPreDocumentEvidenceAssembly(
  input: IndiaIrpAccommodationPreDocumentEvidenceAssemblyInput,
): IndiaIrpAccommodationPreDocumentEvidenceAssembly {
  try {
    const transaction = composeIndiaIrpOrdinaryB2bTransactionDetailsCandidate(input);
    const parties = composeIndiaIrpAccommodationPartyDetailsCandidate(input);
    const items = composeIndiaIrpAccommodationRoomNightItemCandidates(input);
    const values = composeIndiaIrpAccommodationInvoiceValueCandidate(input);
    validateCoherence(input, transaction, parties, items, values);
    const sections = { Version: "1.1" as const, TranDtls: transaction.payload.TranDtls,
      SellerDtls: parties.payload.SellerDtls, BuyerDtls: parties.payload.BuyerDtls,
      ItemList: items.items.map((item) => item.irp), ValDtls: values.valDtls };
    const sectionsJson = JSON.stringify(sections);
    const lineage = { sourceEvidenceHash: input.source.evidenceHash,
      transactionDetailsEvidenceHash: transaction.evidenceHash, partyDetailsEvidenceHash: parties.evidenceHash,
      itemCandidatesEvidenceHash: items.evidenceHash, invoiceValueEvidenceHash: values.evidenceHash };
    const body = { state: "incomplete_non_submit_ready_irp_accommodation_pre_document_evidence" as const,
      format: "irp_json_1_1" as const, submissionReady: false as const,
      explicitlyExcludedEvidence: ["DocDtls", "ItemList[].Qty", "ItemList[].Unit"] as const,
      sections, sectionsJson, lineage, sourceEvidenceHash: input.source.evidenceHash };
    return recursivelyFreeze({ ...body, evidenceHash: digest({ tenantId: input.tenantId, ...body }) });
  } catch (error) {
    if (error instanceof IndiaIrpAccommodationPreDocumentEvidenceAssemblyValidationError) throw error;
    if (error instanceof Error) throw new IndiaIrpAccommodationPreDocumentEvidenceAssemblyValidationError("pre-document evidence assembly is malformed");
    throw error;
  }
}
