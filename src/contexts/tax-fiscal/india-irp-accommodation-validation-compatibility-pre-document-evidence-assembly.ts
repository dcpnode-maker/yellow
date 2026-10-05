import {
  composeIndiaIrpAccommodationPreDocumentEvidenceAssembly,
  type IndiaIrpAccommodationPreDocumentEvidenceAssemblyInput,
  type IndiaIrpAccommodationPreDocumentEvidenceSections,
} from "./india-irp-accommodation-pre-document-evidence-assembly";
import {
  composeIndiaIrpAccommodationServiceQuantityUqcCompatibilityCandidate,
  type IndiaIrpAccommodationServiceQuantityUqcCompatibilityIrpFields,
} from "./india-irp-accommodation-service-quantity-uqc-compatibility-candidate";

export type IndiaIrpAccommodationValidationCompatibilityPreDocumentEvidenceAssemblyInput =
  IndiaIrpAccommodationPreDocumentEvidenceAssemblyInput;

export interface IndiaIrpAccommodationValidationCompatibilityPreDocumentEvidenceSections
  extends Omit<IndiaIrpAccommodationPreDocumentEvidenceSections, "ItemList"> {
  readonly ItemList: readonly Readonly<IndiaIrpAccommodationServiceQuantityUqcCompatibilityIrpFields>[];
}

export interface IndiaIrpAccommodationValidationCompatibilityPreDocumentEvidenceLineage {
  readonly sourceEvidenceHash: string;
  readonly preDocumentEvidenceAssemblyHash: string;
  readonly serviceQuantityUqcCompatibilityEvidenceHash: string;
  readonly itemCandidatesEvidenceHash: string;
}

export interface IndiaIrpAccommodationValidationCompatibilityPreDocumentEvidenceAssembly {
  readonly state: "incomplete_non_submit_ready_irp_accommodation_validation_compatibility_pre_document_evidence";
  readonly format: "irp_json_1_1";
  readonly submissionReady: false;
  readonly authenticatedProviderSandboxCertified: false;
  readonly explicitlyExcludedEvidence: readonly ["DocDtls"];
  readonly sections: Readonly<IndiaIrpAccommodationValidationCompatibilityPreDocumentEvidenceSections>;
  readonly sectionsJson: string;
  readonly lineage: Readonly<IndiaIrpAccommodationValidationCompatibilityPreDocumentEvidenceLineage>;
  readonly sourceEvidenceHash: string;
  readonly evidenceHash: string;
}

export class IndiaIrpAccommodationValidationCompatibilityPreDocumentEvidenceAssemblyValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaIrpAccommodationValidationCompatibilityPreDocumentEvidenceAssemblyValidationError";
  }
}

function fail(message: string): never {
  throw new IndiaIrpAccommodationValidationCompatibilityPreDocumentEvidenceAssemblyValidationError(message);
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

function recomputeEvidenceHash(tenantId: string, child: { readonly evidenceHash: string }): string {
  const { evidenceHash: _evidenceHash, ...body } = child;
  return digest({ tenantId, ...body });
}

function stripCompatibilityFields(
  item: Readonly<IndiaIrpAccommodationServiceQuantityUqcCompatibilityIrpFields>,
): Record<string, unknown> {
  const { Qty: _qty, Unit: _unit, ...inherited } = item;
  return inherited;
}

export function composeIndiaIrpAccommodationValidationCompatibilityPreDocumentEvidenceAssembly(
  input: IndiaIrpAccommodationValidationCompatibilityPreDocumentEvidenceAssemblyInput,
): IndiaIrpAccommodationValidationCompatibilityPreDocumentEvidenceAssembly {
  try {
    const preDocument = composeIndiaIrpAccommodationPreDocumentEvidenceAssembly(input);
    const compatibility = composeIndiaIrpAccommodationServiceQuantityUqcCompatibilityCandidate(input);
    const sourceEvidenceHash = input.source.evidenceHash;

    if (preDocument.evidenceHash !== recomputeEvidenceHash(input.tenantId, preDocument) ||
        compatibility.evidenceHash !== recomputeEvidenceHash(input.tenantId, compatibility)) {
      return fail("child evidence hash is inconsistent");
    }
    if (preDocument.sourceEvidenceHash !== sourceEvidenceHash ||
        preDocument.lineage.sourceEvidenceHash !== sourceEvidenceHash ||
        compatibility.sourceEvidenceHash !== sourceEvidenceHash ||
        compatibility.lineage.sourceEvidenceHash !== sourceEvidenceHash) {
      return fail("child source evidence is inconsistent");
    }
    if (preDocument.format !== "irp_json_1_1" || preDocument.submissionReady !== false ||
        compatibility.state !== "eligible_irp_accommodation_service_quantity_uqc_compatibility_candidate") {
      return fail("child state evidence is inconsistent");
    }
    if (compatibility.supplyTypeCode !== "B2B" || compatibility.currency !== "INR" ||
        preDocument.sections.TranDtls.TaxSch !== "GST" ||
        preDocument.sections.TranDtls.SupTyp !== compatibility.supplyTypeCode) {
      return fail("child B2B or currency evidence is inconsistent");
    }
    if (compatibility.items.length === 0 ||
        compatibility.items.length !== preDocument.sections.ItemList.length ||
        compatibility.lineage.itemCount !== compatibility.items.length) {
      return fail("child item count evidence is inconsistent");
    }
    if (preDocument.lineage.itemCandidatesEvidenceHash !== compatibility.lineage.itemCandidateEvidenceHash) {
      return fail("inherited item-candidate evidence is inconsistent");
    }
    const strippedItems = compatibility.items.map((item, index) => {
      if (item.lineage.roomNightOrdinal !== String(index) ||
          item.lineage.componentFamily !== compatibility.lineage.componentFamily ||
          compatibility.lineage.componentFamily !== input.source.financialSource.componentFamily ||
          compatibility.lineage.componentFamily !== input.source.componentFamily.componentFamily ||
          item.lineage.sourceEvidenceHash !== sourceEvidenceHash ||
          item.irp.Qty !== "1.000" || item.irp.Unit !== "OTH") {
        return fail("compatibility item order, family or source evidence is inconsistent");
      }
      return stripCompatibilityFields(item.irp);
    });
    if (JSON.stringify(strippedItems) !== JSON.stringify(preDocument.sections.ItemList)) {
      return fail("compatibility enrichment does not preserve pre-document items");
    }

    const sections = {
      Version: preDocument.sections.Version,
      TranDtls: preDocument.sections.TranDtls,
      SellerDtls: preDocument.sections.SellerDtls,
      BuyerDtls: preDocument.sections.BuyerDtls,
      ItemList: compatibility.items.map((item) => item.irp),
      ValDtls: preDocument.sections.ValDtls,
    };
    const sectionsJson = JSON.stringify(sections);
    const lineage = {
      sourceEvidenceHash,
      preDocumentEvidenceAssemblyHash: preDocument.evidenceHash,
      serviceQuantityUqcCompatibilityEvidenceHash: compatibility.evidenceHash,
      itemCandidatesEvidenceHash: compatibility.lineage.itemCandidateEvidenceHash,
    };
    const body = {
      state: "incomplete_non_submit_ready_irp_accommodation_validation_compatibility_pre_document_evidence" as const,
      format: "irp_json_1_1" as const,
      submissionReady: false as const,
      authenticatedProviderSandboxCertified: false as const,
      explicitlyExcludedEvidence: ["DocDtls"] as const,
      sections,
      sectionsJson,
      lineage,
      sourceEvidenceHash,
    };
    return recursivelyFreeze({ ...body, evidenceHash: digest({ tenantId: input.tenantId, ...body }) });
  } catch (error) {
    if (error instanceof IndiaIrpAccommodationValidationCompatibilityPreDocumentEvidenceAssemblyValidationError) {
      throw error;
    }
    if (error instanceof Error) {
      throw new IndiaIrpAccommodationValidationCompatibilityPreDocumentEvidenceAssemblyValidationError(
        "validation-compatibility pre-document evidence assembly is malformed",
      );
    }
    throw error;
  }
}
