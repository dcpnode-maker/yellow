import { types as utilTypes } from "node:util";

import type { Tx } from "../../kernel";
import {
  IndiaIrpAccommodationSourceConflictError,
  IndiaIrpAccommodationSourceNotFoundError,
  IndiaIrpAccommodationSourceService,
  IndiaIrpAccommodationSourceValidationError,
  type IndiaIrpAccommodationSourceInput,
  type IndiaIrpAccommodationSourceResult,
} from "./india-irp-accommodation-source";
import {
  composeIndiaIrpAccommodationValidationCompatibilityPreDocumentEvidenceAssembly,
  type IndiaIrpAccommodationValidationCompatibilityPreDocumentEvidenceAssembly,
} from "./india-irp-accommodation-validation-compatibility-pre-document-evidence-assembly";

const HASH = /^[0-9a-f]{64}$/;
const INPUT_KEYS = [
  "tenantId", "propertyNode", "reservationId", "folioId", "journalId",
  "recipientPartyId", "recipientRegistrationId", "classificationId",
  "supplyNatureAtTimeOfSupplyInput", "supplyNatureAtTimeOfSupplyResult",
] as const;
const RESULT_KEYS = [
  "state", "submissionReady", "permittedActions", "blockers",
  "preDocumentEvidence", "sourceEvidenceHash", "preDocumentEvidenceHash",
  "evidenceHash",
] as const;
const SOURCE_KEYS = [
  "state", "financialSource", "legalBuyerPartyId", "sellerRegistration",
  "recipientRegistration", "sellerDetails", "buyerDetails", "placeOfSupply",
  "classification", "supplyNatureAtTimeOfSupply", "componentFamily", "evidenceHash",
] as const;
const PRE_DOCUMENT_KEYS = [
  "state", "format", "submissionReady", "authenticatedProviderSandboxCertified",
  "explicitlyExcludedEvidence", "sections", "sectionsJson", "lineage",
  "sourceEvidenceHash", "evidenceHash",
] as const;
const SECTION_KEYS = ["Version", "TranDtls", "SellerDtls", "BuyerDtls", "ItemList", "ValDtls"] as const;
const LINEAGE_KEYS = [
  "sourceEvidenceHash", "preDocumentEvidenceAssemblyHash",
  "serviceQuantityUqcCompatibilityEvidenceHash", "itemCandidatesEvidenceHash",
] as const;
const PREDECESSOR_KEYS = ["section14", "levyComponentIdentity", "reservationLineage", "attributionSnapshot"] as const;
const BLOCKERS = [
  "FISCAL_DOCUMENT_ORIGIN_UNSELECTED",
  "LEGAL_DOCUMENT_NUMBER_FORMAT_UNCONFIGURED",
  "DOCUMENT_SERIES_UNBOUND",
] as const;
type RecordValue = Record<string, unknown>;

export type IndiaIrpAccommodationFiscalActionReadinessInput = IndiaIrpAccommodationSourceInput;

export interface IndiaIrpAccommodationFiscalActionReadinessResult {
  readonly state: "blocked_pending_fiscal_document_origin_policy";
  readonly submissionReady: false;
  readonly permittedActions: readonly [];
  readonly blockers: readonly [
    "FISCAL_DOCUMENT_ORIGIN_UNSELECTED",
    "LEGAL_DOCUMENT_NUMBER_FORMAT_UNCONFIGURED",
    "DOCUMENT_SERIES_UNBOUND",
  ];
  readonly preDocumentEvidence: Readonly<IndiaIrpAccommodationValidationCompatibilityPreDocumentEvidenceAssembly>;
  readonly sourceEvidenceHash: string;
  readonly preDocumentEvidenceHash: string;
  readonly evidenceHash: string;
}

export class IndiaIrpAccommodationFiscalActionReadinessValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaIrpAccommodationFiscalActionReadinessValidationError";
  }
}
export class IndiaIrpAccommodationFiscalActionReadinessNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaIrpAccommodationFiscalActionReadinessNotFoundError";
  }
}
export class IndiaIrpAccommodationFiscalActionReadinessConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaIrpAccommodationFiscalActionReadinessConflictError";
  }
}

function fail(message: string): never {
  throw new IndiaIrpAccommodationFiscalActionReadinessValidationError(message);
}
function conflict(message: string): never {
  throw new IndiaIrpAccommodationFiscalActionReadinessConflictError(message);
}
function exactKeys(value: unknown, keys: readonly string[], subject: string): RecordValue {
  if (typeof value !== "object" || value === null || Array.isArray(value) || utilTypes.isProxy(value) ||
      Object.getPrototypeOf(value) !== Object.prototype || Object.getOwnPropertySymbols(value).length !== 0) {
    return fail(`${subject} must be an exact plain object`);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const actual = Object.keys(descriptors).sort();
  const wanted = [...keys].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index]) ||
      Object.values(descriptors).some((descriptor) => descriptor.get !== undefined || descriptor.set !== undefined ||
        descriptor.enumerable !== true || descriptor.configurable !== false ||
        !("value" in descriptor) || descriptor.writable !== false)) {
    return fail(`${subject} shape is invalid`);
  }
  return value as RecordValue;
}
function deepFrozen(value: unknown, seen = new Set<object>(), active = new Set<object>()): void {
  if (value === null || typeof value === "string" || typeof value === "boolean" ||
      (typeof value === "number" && Number.isFinite(value))) return;
  if (typeof value !== "object" || utilTypes.isProxy(value) || !Object.isFrozen(value) ||
      Object.getOwnPropertySymbols(value).length !== 0) return fail("input must be an exact deeply frozen graph");
  if (active.has(value)) return fail("input must be acyclic");
  if (seen.has(value)) return;
  seen.add(value);
  active.add(value);
  if (Array.isArray(value)) {
    const keys = Object.keys(value);
    if (keys.length !== value.length || keys.some((key, index) => key !== String(index))) return fail("input arrays must be dense");
  } else if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
    return fail("input must contain plain records");
  }
  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
    if (Array.isArray(value) && key === "length") continue;
    if (descriptor.get !== undefined || descriptor.set !== undefined || descriptor.enumerable !== true ||
        descriptor.configurable !== false || !("value" in descriptor) || descriptor.writable !== false) {
      return fail("input descriptors are invalid");
    }
    deepFrozen(descriptor.value, seen, active);
  }
  active.delete(value);
}
function validateInput(value: IndiaIrpAccommodationFiscalActionReadinessInput): IndiaIrpAccommodationFiscalActionReadinessInput {
  deepFrozen(value);
  exactKeys(value, INPUT_KEYS, "input");
  return value;
}
function digest(value: unknown): string {
  return new Bun.CryptoHasher("sha256").update(JSON.stringify(value)).digest("hex");
}
function hash(value: unknown, subject: string): string {
  return typeof value === "string" && HASH.test(value) ? value : conflict(`${subject} is invalid`);
}
function recomputeTenantHash(value: RecordValue, tenantId: string, field: string): string {
  const { [field]: _ignored, ...body } = value;
  return digest({ tenantId, ...body });
}
function recursivelyFreeze<T>(value: T, seen = new Set<object>()): T {
  if (value !== null && typeof value === "object" && !seen.has(value)) {
    seen.add(value);
    for (const child of Object.values(value as RecordValue)) recursivelyFreeze(child, seen);
    Object.freeze(value);
  }
  return value;
}

function validateSource(source: IndiaIrpAccommodationSourceResult, input: IndiaIrpAccommodationSourceInput): void {
  const root = exactKeys(source, SOURCE_KEYS, "Order413 source");
  if (root.state !== "eligible_irp_invoice_source") return conflict("Order413 source state is inconsistent");
  hash(root.evidenceHash, "Order413 source evidence hash");
  if (root.evidenceHash !== recomputeTenantHash(root, input.tenantId, "evidenceHash")) return conflict("Order413 source evidence hash is inconsistent");
  if (root.legalBuyerPartyId !== input.recipientPartyId) return conflict("Order413 legal buyer lineage is inconsistent");
  const financial = root.financialSource as RecordValue;
  if (typeof financial !== "object" || financial === null || Array.isArray(financial)) return conflict("Order413 financial source is malformed");
  hash(financial.sourceEvidenceHash, "Order413 fiscal source evidence hash");
  if (financial.sourceEvidenceHash !== recomputeTenantHash(financial, input.tenantId, "sourceEvidenceHash")) return conflict("Order413 fiscal source evidence hash is inconsistent");
  for (const [field, expected] of [["propertyNode", input.propertyNode], ["reservationId", input.reservationId], ["folioId", input.folioId], ["journalId", input.journalId]] as const) {
    if (financial[field] !== expected) return conflict("Order413 fiscal source ancestry is inconsistent");
  }
  if (financial.currency !== "INR" || financial.state !== "eligible_current_posted_source" ||
      !Array.isArray(financial.roomNights) || financial.roomNights.length < 1 || financial.roomNights.length > 366 ||
      !Array.isArray(financial.components) || !Array.isArray(financial.journalLines)) return conflict("Order413 fiscal source state is inconsistent");
  if (financial.componentFamily !== (root.componentFamily as RecordValue)?.componentFamily) return conflict("Order413 component-family lineage is inconsistent");
  const predecessors = exactKeys(financial.predecessorHashes, PREDECESSOR_KEYS, "Order413 predecessor lineage");
  for (const predecessor of Object.values(predecessors)) hash(predecessor, "Order413 predecessor evidence hash");
  const componentFamily = root.componentFamily as RecordValue;
  if (componentFamily.propertyNode !== input.propertyNode || componentFamily.reservationId !== input.reservationId || componentFamily.folioId !== input.folioId ||
      componentFamily.supplierRegistrationId !== (root.sellerRegistration as RecordValue)?.registrationId) return conflict("Order413 component-family ancestry is inconsistent");
  const supply = root.supplyNatureAtTimeOfSupply as RecordValue;
  if (supply.propertyNode !== input.propertyNode || supply.reservationId !== input.reservationId || supply.folioId !== input.folioId ||
      supply.recipientPartyId !== input.recipientPartyId || supply.recipientRegistrationId !== input.recipientRegistrationId ||
      supply.supplierRegistrationId !== (root.sellerRegistration as RecordValue)?.registrationId) return conflict("Order413 supply-nature lineage is inconsistent");
  if (supply.evidenceHash !== input.supplyNatureAtTimeOfSupplyResult.evidenceHash) return conflict("Order413 replay evidence is inconsistent");
  const seller = root.sellerRegistration as RecordValue, recipient = root.recipientRegistration as RecordValue;
  if (seller.registrationId !== componentFamily.supplierRegistrationId || recipient.registrationId !== input.recipientRegistrationId) return conflict("Order413 registration lineage is inconsistent");
  hash(seller.evidenceHash, "Order413 seller evidence hash"); hash(recipient.evidenceHash, "Order413 recipient evidence hash");
  hash((componentFamily.evidenceHash), "Order413 component-family evidence hash");
  hash((root.classification as RecordValue)?.evidenceHash, "Order413 classification evidence hash");
  hash((root.placeOfSupply as RecordValue)?.candidateHash, "Order413 place-of-supply evidence hash");
}

function validatePreDocument(
  preDocument: IndiaIrpAccommodationValidationCompatibilityPreDocumentEvidenceAssembly,
  source: IndiaIrpAccommodationSourceResult,
  tenantId: string,
): void {
  const root = exactKeys(preDocument, PRE_DOCUMENT_KEYS, "Order426 evidence");
  if (root.state !== "incomplete_non_submit_ready_irp_accommodation_validation_compatibility_pre_document_evidence" ||
      root.format !== "irp_json_1_1" || root.submissionReady !== false || root.authenticatedProviderSandboxCertified !== false) {
    return conflict("Order426 evidence state is inconsistent");
  }
  if (JSON.stringify(root.explicitlyExcludedEvidence) !== JSON.stringify(["DocDtls"])) return conflict("Order426 excluded evidence is inconsistent");
  const sections = exactKeys(root.sections, SECTION_KEYS, "Order426 sections");
  if (sections.Version !== "1.1" || !Array.isArray(sections.ItemList) || sections.ItemList.length !== source.financialSource.roomNights.length ||
      "DocDtls" in sections || sections.ItemList.some((item) => typeof item !== "object" || item === null || "DocDtls" in (item as RecordValue))) {
    return conflict("Order426 section evidence is inconsistent");
  }
  if (root.sectionsJson !== JSON.stringify(root.sections)) return conflict("Order426 sections serialization is inconsistent");
  const lineage = exactKeys(root.lineage, LINEAGE_KEYS, "Order426 lineage");
  hash(root.evidenceHash, "Order426 evidence hash");
  if (root.evidenceHash !== recomputeTenantHash(root, tenantId, "evidenceHash")) return conflict("Order426 evidence hash is inconsistent");
  if (root.sourceEvidenceHash !== source.evidenceHash || lineage.sourceEvidenceHash !== source.evidenceHash) return conflict("Order426 source lineage is inconsistent");
  const itemCandidatesEvidenceHash = hash(lineage.itemCandidatesEvidenceHash, "Order426 itemCandidatesEvidenceHash");
  hash(lineage.preDocumentEvidenceAssemblyHash, "Order426 preDocumentEvidenceAssemblyHash");
  hash(lineage.serviceQuantityUqcCompatibilityEvidenceHash, "Order426 serviceQuantityUqcCompatibilityEvidenceHash");
  if (itemCandidatesEvidenceHash.length !== 64) return conflict("Order426 item lineage is inconsistent");
  const transaction = sections.TranDtls as RecordValue;
  if (transaction.TaxSch !== "GST" || transaction.SupTyp !== "B2B") return conflict("Order426 B2B evidence is inconsistent");
  if (sections.ItemList.some((item) => (item as RecordValue).Qty !== "1.000" || (item as RecordValue).Unit !== "OTH")) return conflict("Order426 quantity evidence is inconsistent");
}

export class IndiaIrpAccommodationFiscalActionReadinessService {
  async resolve(
    tx: Tx,
    rawInput: IndiaIrpAccommodationFiscalActionReadinessInput,
  ): Promise<IndiaIrpAccommodationFiscalActionReadinessResult> {
    if (typeof tx !== "function") return fail("tenant transaction is unavailable");
    const input = validateInput(rawInput);
    let source: IndiaIrpAccommodationSourceResult;
    try {
      source = await new IndiaIrpAccommodationSourceService().resolve(tx, input);
    } catch (error) {
      if (error instanceof IndiaIrpAccommodationSourceValidationError) {
        throw new IndiaIrpAccommodationFiscalActionReadinessValidationError(error.message);
      }
      if (error instanceof IndiaIrpAccommodationSourceNotFoundError) {
        throw new IndiaIrpAccommodationFiscalActionReadinessNotFoundError(error.message);
      }
      if (error instanceof IndiaIrpAccommodationSourceConflictError) {
        throw new IndiaIrpAccommodationFiscalActionReadinessConflictError(error.message);
      }
      throw error;
    }
    try {
      validateSource(source, input);
    } catch (error) {
      if (error instanceof IndiaIrpAccommodationFiscalActionReadinessValidationError) {
        throw new IndiaIrpAccommodationFiscalActionReadinessConflictError(error.message);
      }
      throw error;
    }
    let preDocumentEvidence: IndiaIrpAccommodationValidationCompatibilityPreDocumentEvidenceAssembly;
    try {
      preDocumentEvidence = composeIndiaIrpAccommodationValidationCompatibilityPreDocumentEvidenceAssembly(
        Object.freeze({ tenantId: input.tenantId, source }),
      );
    } catch (error) {
      if (error instanceof Error && error.name === "IndiaIrpAccommodationValidationCompatibilityPreDocumentEvidenceAssemblyValidationError") {
        return conflict("Order426 evidence assembly is inconsistent");
      }
      throw error;
    }
    try {
      validatePreDocument(preDocumentEvidence, source, input.tenantId);
    } catch (error) {
      if (error instanceof IndiaIrpAccommodationFiscalActionReadinessValidationError) {
        throw new IndiaIrpAccommodationFiscalActionReadinessConflictError(error.message);
      }
      throw error;
    }
    if (JSON.stringify(preDocumentEvidence).includes(input.tenantId)) return conflict("Order426 evidence discloses tenant identity");
    const body = {
      state: "blocked_pending_fiscal_document_origin_policy" as const,
      submissionReady: false as const,
      permittedActions: [] as const,
      blockers: BLOCKERS,
      preDocumentEvidence,
      sourceEvidenceHash: source.evidenceHash,
      preDocumentEvidenceHash: preDocumentEvidence.evidenceHash,
    };
    return recursivelyFreeze({ ...body, evidenceHash: digest({ tenantId: input.tenantId, ...body }) });
  }
}
