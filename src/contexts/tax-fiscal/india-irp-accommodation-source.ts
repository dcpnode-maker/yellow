import { types as utilTypes } from "node:util";

import type { Tx } from "../../kernel";
import {
  IndiaFinalComponentTaxFiscalSourceConflictError,
  IndiaFinalComponentTaxFiscalSourceNotFoundError,
  IndiaFinalComponentTaxFiscalSourceService,
  type IndiaFinalComponentTaxFiscalSourceResult,
} from "../financials";
import {
  deriveIndiaGstAccommodationComponentFamily,
  type IndiaGstAccommodationComponentFamilyResult,
} from "./india-gst-accommodation-component-family";
import {
  IndiaGstAccommodationClassificationService,
  type IndiaGstAccommodationClassificationResult,
} from "./india-gst-accommodation-classification";
import {
  IndiaGstAccommodationPlaceOfSupplyService,
  type IndiaGstAccommodationPlaceOfSupplyResult,
} from "./india-gst-accommodation-place-of-supply";
import {
  composeIndiaGstAccommodationSupplyNatureAtTimeOfSupply,
  type IndiaGstAccommodationSupplyNatureAtTimeOfSupplyInput,
  type IndiaGstAccommodationSupplyNatureAtTimeOfSupplyResult,
} from "./india-gst-accommodation-supply-nature-at-time-of-supply";
import {
  IndiaGstRecipientRegistrationService,
  type IndiaGstRecipientRegistrationResult,
} from "./india-gst-recipient-registration";
import {
  IndiaGstSupplierRegistrationService,
  type IndiaGstSupplierRegistrationResult,
} from "./india-gst-supplier-registration";
import {
  buildIndiaIrpBuyerDetails,
  type IndiaIrpBuyerDetailsResultV1,
} from "./india-irp-buyer-details";
import {
  buildIndiaIrpSellerDetails,
  type IndiaIrpSellerDetailsResultV1,
} from "./india-irp-seller-details";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const INPUT_KEYS = [
  "tenantId", "propertyNode", "reservationId", "folioId", "journalId",
  "recipientPartyId", "recipientRegistrationId", "classificationId",
  "supplyNatureAtTimeOfSupplyInput", "supplyNatureAtTimeOfSupplyResult",
] as const;

type Row = Readonly<Record<string, unknown>>;

export interface IndiaIrpAccommodationSourceInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly reservationId: string;
  readonly folioId: string;
  readonly journalId: string;
  readonly recipientPartyId: string;
  readonly recipientRegistrationId: string;
  readonly classificationId: string;
  readonly supplyNatureAtTimeOfSupplyInput: IndiaGstAccommodationSupplyNatureAtTimeOfSupplyInput;
  readonly supplyNatureAtTimeOfSupplyResult: IndiaGstAccommodationSupplyNatureAtTimeOfSupplyResult;
}

export interface IndiaIrpAccommodationSourceResult {
  readonly state: "eligible_irp_invoice_source";
  readonly financialSource: IndiaFinalComponentTaxFiscalSourceResult;
  readonly legalBuyerPartyId: string;
  readonly sellerRegistration: IndiaGstSupplierRegistrationResult;
  readonly recipientRegistration: IndiaGstRecipientRegistrationResult;
  readonly sellerDetails: IndiaIrpSellerDetailsResultV1;
  readonly buyerDetails: IndiaIrpBuyerDetailsResultV1;
  readonly placeOfSupply: IndiaGstAccommodationPlaceOfSupplyResult;
  readonly classification: IndiaGstAccommodationClassificationResult;
  readonly supplyNatureAtTimeOfSupply: IndiaGstAccommodationSupplyNatureAtTimeOfSupplyResult;
  readonly componentFamily: IndiaGstAccommodationComponentFamilyResult;
  readonly evidenceHash: string;
}

export class IndiaIrpAccommodationSourceValidationError extends Error {
  constructor(message: string) { super(message); this.name = "IndiaIrpAccommodationSourceValidationError"; }
}
export class IndiaIrpAccommodationSourceNotFoundError extends Error {
  constructor(message: string) { super(message); this.name = "IndiaIrpAccommodationSourceNotFoundError"; }
}
export class IndiaIrpAccommodationSourceConflictError extends Error {
  constructor(message: string) { super(message); this.name = "IndiaIrpAccommodationSourceConflictError"; }
}

function validation(message: string): never { throw new IndiaIrpAccommodationSourceValidationError(message); }
function conflict(message: string): never { throw new IndiaIrpAccommodationSourceConflictError(message); }
function uuid(value: unknown, subject: string): string {
  return typeof value === "string" && UUID.test(value) ? value : validation(`${subject} must be a lowercase UUID`);
}
function storedUuid(value: unknown, subject: string): string {
  return typeof value === "string" && UUID.test(value) ? value : conflict(`${subject} is invalid`);
}
function exactFrozenGraph(value: unknown, seen = new Set<object>(), active = new Set<object>()): void {
  if (value === null || typeof value === "string" || typeof value === "boolean" ||
      (typeof value === "number" && Number.isFinite(value))) return;
  if (typeof value !== "object" || utilTypes.isProxy(value) ||
      !Object.isFrozen(value) || Object.getOwnPropertySymbols(value).length !== 0) {
    validation("IRP accommodation source input must be an exact deeply frozen graph");
  }
  if (active.has(value)) validation("IRP accommodation source input must be acyclic");
  if (seen.has(value)) return;
  seen.add(value);
  active.add(value);
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null) validation("IRP accommodation source input must contain plain records");
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Array.isArray(value) && (Object.keys(value).length !== value.length ||
      Object.keys(value).some((key, index) => key !== String(index)))) validation("IRP accommodation source arrays must be dense");
  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (Array.isArray(value) && key === "length") continue;
    if (descriptor.get !== undefined || descriptor.set !== undefined || descriptor.enumerable !== true ||
        descriptor.configurable !== false || !("value" in descriptor) || descriptor.writable !== false) {
      validation("IRP accommodation source input descriptors are invalid");
    }
    exactFrozenGraph(descriptor.value, seen, active);
  }
  active.delete(value);
}
function exactInput(value: IndiaIrpAccommodationSourceInput): IndiaIrpAccommodationSourceInput {
  exactFrozenGraph(value);
  if (typeof value !== "object" || value === null || Array.isArray(value)) return validation("input is invalid");
  const keys = Object.keys(value).sort(), expected = [...INPUT_KEYS].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) return validation("input shape is invalid");
  return value;
}
function same(left: unknown, right: unknown): boolean { return JSON.stringify(left) === JSON.stringify(right); }
function digest(value: unknown): string { return new Bun.CryptoHasher("sha256").update(JSON.stringify(value)).digest("hex"); }
function freeze<T>(value: T, seen = new Set<object>()): T {
  if (value !== null && typeof value === "object" && !seen.has(value)) {
    seen.add(value);
    for (const item of Object.values(value as Record<string, unknown>)) freeze(item, seen);
    Object.freeze(value);
  }
  return value;
}
function mapCompositionError(error: unknown): never {
  if (error instanceof IndiaIrpAccommodationSourceValidationError ||
      error instanceof IndiaIrpAccommodationSourceNotFoundError ||
      error instanceof IndiaIrpAccommodationSourceConflictError) throw error;
  const code = (error as { code?: string; errno?: string }).code ?? (error as { errno?: string }).errno;
  const name = error instanceof Error ? error.name : "";
  if (code === "42501" || name.endsWith("NotFoundError")) {
    throw new IndiaIrpAccommodationSourceNotFoundError("statutory source ancestry was not found");
  }
  if (name.startsWith("India") || code === "23503" || code === "23505" || code === "55000") {
    throw new IndiaIrpAccommodationSourceConflictError("statutory source ancestry is inconsistent");
  }
  throw error;
}

export class IndiaIrpAccommodationSourceService {
  async resolve(tx: Tx, rawInput: IndiaIrpAccommodationSourceInput): Promise<IndiaIrpAccommodationSourceResult> {
    if (typeof tx !== "function") return validation("tenant transaction is unavailable");
    const input = exactInput(rawInput);
    try { return await this.resolveValidated(tx, input); } catch (error) { return mapCompositionError(error); }
  }

  private async resolveValidated(tx: Tx, input: IndiaIrpAccommodationSourceInput): Promise<IndiaIrpAccommodationSourceResult> {
    const tenantId = uuid(input.tenantId, "tenantId");
    const propertyNode = uuid(input.propertyNode, "propertyNode");
    const reservationId = uuid(input.reservationId, "reservationId");
    const folioId = uuid(input.folioId, "folioId");
    const journalId = uuid(input.journalId, "journalId");
    const recipientPartyId = uuid(input.recipientPartyId, "recipientPartyId");
    const recipientRegistrationId = uuid(input.recipientRegistrationId, "recipientRegistrationId");
    const classificationId = uuid(input.classificationId, "classificationId");

    let financialSource: IndiaFinalComponentTaxFiscalSourceResult;
    try {
      financialSource = await new IndiaFinalComponentTaxFiscalSourceService().resolve(tx, {
        tenantId, propertyNode, reservationId, folioId, journalId,
      });
    } catch (error) {
      if (error instanceof IndiaFinalComponentTaxFiscalSourceNotFoundError) {
        throw new IndiaIrpAccommodationSourceNotFoundError("posted fiscal source was not found");
      }
      if (error instanceof IndiaFinalComponentTaxFiscalSourceConflictError &&
          error.message === "fiscal source is no longer current or has been reversed") {
        throw new IndiaIrpAccommodationSourceNotFoundError("posted fiscal source is no longer current");
      }
      throw error;
    }

    const buyerRows = await tx<Row[]>`
      SELECT buyer_party_id::text buyer_party_id
      FROM public.india_gst_accommodation_final_valuation
      WHERE tenant_id=${tenantId}::uuid
        AND tenant_id=current_setting('app.tenant_id',true)::uuid
        AND id=${financialSource.valuationId}::uuid
        AND property_node=${propertyNode}::uuid
        AND reservation_id=${reservationId}::uuid
        AND folio_id=${folioId}::uuid`;
    if (buyerRows.length === 0) throw new IndiaIrpAccommodationSourceNotFoundError("legal buyer was not found");
    if (buyerRows.length !== 1) return conflict("legal buyer is ambiguous");
    const legalBuyerPartyId = storedUuid(buyerRows[0]?.buyer_party_id, "stored legal buyer party id");
    if (legalBuyerPartyId !== recipientPartyId) return conflict("recipient is not the persisted legal buyer");

    const applicabilityRows = await tx<Row[]>`
      SELECT reservation_lineage_id::text,attribution_id::text,
        service_provision_snapshot_id::text,payment_receipt_snapshot_id::text,
        invoice_issue_snapshot_id::text,family_jurisdiction_extension_id::text,
        classification_id::text,supplier_service_location_id::text,
        supplier_sez_status_id::text,recipient_sez_status_id::text,
        recipient_party_id::text,final_valuation_id::text,
        service_provision_date::text,payment_receipt_date::text,
        invoice_issue_date::text,time_of_supply_date::text,component_family,
        reservation_lineage_evidence_hash,attribution_snapshot_evidence_hash
      FROM public.india_gst_accommodation_quoted_rate_applicability
      WHERE tenant_id=${tenantId}::uuid
        AND tenant_id=current_setting('app.tenant_id',true)::uuid
        AND id=${financialSource.applicabilityId}::uuid
        AND property_node=${propertyNode}::uuid
        AND reservation_id=${reservationId}::uuid
        AND folio_id=${folioId}::uuid`;
    if (applicabilityRows.length === 0) throw new IndiaIrpAccommodationSourceNotFoundError("applicability ancestry was not found");
    if (applicabilityRows.length !== 1) return conflict("applicability ancestry is ambiguous");
    const applicability = applicabilityRows[0]!;

    const sellerRegistration = await new IndiaGstSupplierRegistrationService().resolve(tx, Object.freeze({
      tenantId, propertyNode, reservationId,
    }));
    const recipientRegistration = await new IndiaGstRecipientRegistrationService().resolve(tx, Object.freeze({
      tenantId, recipientPartyId, registrationId: recipientRegistrationId,
    }));
    const classification = await new IndiaGstAccommodationClassificationService().resolve(tx, Object.freeze({
      tenantId, propertyNode, reservationId, classificationId,
    }));
    const placeOfSupply = await new IndiaGstAccommodationPlaceOfSupplyService().resolve(tx, Object.freeze({
      tenantId, propertyNode, reservationId, folioId, recipientPartyId,
      recipientRegistrationId, classificationId,
    }));
    const sellerDetails = buildIndiaIrpSellerDetails(sellerRegistration);
    const buyerDetails = buildIndiaIrpBuyerDetails(recipientRegistration);

    const replayedAtTime = composeIndiaGstAccommodationSupplyNatureAtTimeOfSupply(
      input.supplyNatureAtTimeOfSupplyInput,
    );
    if (!same(replayedAtTime, input.supplyNatureAtTimeOfSupplyResult)) {
      return conflict("Order297 evidence does not byte-match its complete replay");
    }
    const suppliedNature = input.supplyNatureAtTimeOfSupplyInput.supplyNature;
    const componentFamily = deriveIndiaGstAccommodationComponentFamily(Object.freeze({ tenantId, supplyNature: suppliedNature }));
    const fiscalJurisdiction = (financialSource.journalLines[0]?.taxDetail as Row | null)?.jurisdiction as Row | undefined;
    const supplierAtTime = input.supplyNatureAtTimeOfSupplyInput.supplierRegistrationAtTimeOfSupply;
    const recipientAtTime = input.supplyNatureAtTimeOfSupplyInput.recipientRegistrationAtTimeOfSupply;
    const supplierTime = supplierAtTime.timeOfSupply;
    const recipientTime = recipientAtTime.timeOfSupply;
    const recipientLineage = recipientTime.reservationLineage as Row;

    if (input.supplyNatureAtTimeOfSupplyInput.tenantId !== tenantId ||
        replayedAtTime.propertyNode !== propertyNode || replayedAtTime.reservationId !== reservationId ||
        replayedAtTime.folioId !== folioId || replayedAtTime.recipientPartyId !== recipientPartyId ||
        replayedAtTime.recipientRegistrationId !== recipientRegistrationId ||
        replayedAtTime.supplierRegistrationId !== sellerRegistration.registrationId ||
        placeOfSupply.supplier.registrationId !== sellerRegistration.registrationId ||
        placeOfSupply.supplier.evidenceHash !== sellerRegistration.evidenceHash ||
        placeOfSupply.recipient.partyId !== recipientPartyId ||
        placeOfSupply.recipient.registrationId !== recipientRegistrationId ||
        placeOfSupply.recipient.evidenceHash !== recipientRegistration.evidenceHash ||
        placeOfSupply.classification.classificationId !== classificationId ||
        placeOfSupply.classification.evidenceHash !== classification.evidenceHash ||
        suppliedNature.propertyNode !== propertyNode || suppliedNature.reservationId !== reservationId ||
        suppliedNature.folioId !== folioId || suppliedNature.placeOfSupply.candidateHash !== placeOfSupply.candidateHash ||
        suppliedNature.placeOfSupply.pos !== placeOfSupply.pos ||
        suppliedNature.classification.classificationId !== classificationId ||
        suppliedNature.classification.evidenceHash !== classification.evidenceHash ||
        suppliedNature.supplier.registrationId !== sellerRegistration.registrationId ||
        suppliedNature.supplier.evidenceHash !== sellerRegistration.evidenceHash ||
        suppliedNature.recipient.partyId !== recipientPartyId ||
        suppliedNature.recipient.registrationId !== recipientRegistrationId ||
        suppliedNature.recipient.evidenceHash !== recipientRegistration.evidenceHash ||
        componentFamily.propertyNode !== propertyNode || componentFamily.reservationId !== reservationId ||
        componentFamily.folioId !== folioId || componentFamily.supplyDate !== replayedAtTime.supplyDate ||
        componentFamily.supplierRegistrationId !== sellerRegistration.registrationId ||
        componentFamily.placeOfSupplyStateCode !== placeOfSupply.pos ||
        componentFamily.supplyNature !== replayedAtTime.supplyNature ||
        componentFamily.determinationBasis !== replayedAtTime.determinationBasis ||
        componentFamily.sezDirection !== replayedAtTime.sezDirection ||
        componentFamily.componentFamily !== financialSource.componentFamily ||
        applicability.reservation_lineage_id !== supplierTime.reservationLineage.lineageId ||
        applicability.attribution_id !== supplierTime.reservationLineage.attributionId ||
        applicability.service_provision_snapshot_id !== supplierTime.serviceProvisionSnapshotId ||
        applicability.payment_receipt_snapshot_id !== supplierTime.paymentReceiptSnapshotId ||
        applicability.invoice_issue_snapshot_id !== supplierTime.invoiceIssueSnapshotId ||
        applicability.service_provision_snapshot_id !== recipientTime.serviceProvisionSnapshotId ||
        applicability.payment_receipt_snapshot_id !== recipientTime.paymentReceiptSnapshotId ||
        applicability.invoice_issue_snapshot_id !== recipientTime.invoiceIssueSnapshotId ||
        applicability.family_jurisdiction_extension_id !== componentFamily.jurisdiction.extensionId ||
        applicability.classification_id !== classificationId ||
        applicability.supplier_service_location_id !== supplierAtTime.supplierServiceLocationId ||
        applicability.supplier_sez_status_id !== supplierAtTime.supplierGstRegistrationStatusId ||
        applicability.recipient_sez_status_id !== recipientAtTime.recipientSezStatusId ||
        applicability.recipient_party_id !== recipientPartyId ||
        applicability.final_valuation_id !== financialSource.valuationId ||
        applicability.service_provision_date !== supplierTime.serviceProvisionDate ||
        applicability.payment_receipt_date !== supplierTime.paymentReceiptDate ||
        applicability.invoice_issue_date !== supplierTime.invoiceIssueDate ||
        applicability.time_of_supply_date !== supplierTime.timeOfSupplyDate ||
        applicability.service_provision_date !== recipientTime.serviceProvisionDate ||
        applicability.payment_receipt_date !== recipientTime.paymentReceiptDate ||
        applicability.invoice_issue_date !== recipientTime.invoiceIssueDate ||
        applicability.time_of_supply_date !== recipientTime.timeOfSupplyDate ||
        applicability.component_family !== componentFamily.componentFamily ||
        applicability.reservation_lineage_evidence_hash !== financialSource.predecessorHashes.reservationLineage ||
        applicability.attribution_snapshot_evidence_hash !== financialSource.predecessorHashes.attributionSnapshot ||
        supplierTime.reservationLineage.lineageId !== recipientLineage.lineageId ||
        supplierTime.reservationLineage.holdBindingId !== recipientLineage.holdBindingId ||
        supplierTime.reservationLineage.attributionId !== recipientLineage.attributionId ||
        supplierTime.reservationLineage.segmentId !== recipientLineage.segmentId ||
        supplierTime.reservationLineage.reservationId !== recipientLineage.reservationId ||
        supplierTime.reservationLineage.originQuoteHash !== recipientLineage.originQuoteHash ||
        supplierTime.reservationLineage.snapshotHash !== recipientLineage.snapshotHash ||
        supplierTime.reservationLineage.currency !== recipientLineage.currency ||
        supplierTime.amountMinor !== recipientTime.amountMinor ||
        supplierTime.amountMinor !== financialSource.grandTotalMinor ||
        supplierTime.currency !== recipientTime.currency || supplierTime.currency !== financialSource.currency ||
        supplierTime.serviceProvisionSource !== recipientTime.serviceProvisionSource ||
        supplierTime.paymentReceiptSource !== recipientTime.paymentReceiptSource ||
        supplierTime.invoiceIssueSource !== recipientTime.invoiceIssueSource ||
        supplierTime.serviceProvisionEvidenceSha256 !== recipientTime.serviceProvisionEvidenceSha256 ||
        supplierTime.paymentReceiptEvidenceSha256 !== recipientTime.paymentReceiptEvidenceSha256 ||
        supplierTime.invoiceIssueEvidenceSha256 !== recipientTime.invoiceIssueEvidenceSha256 ||
        !same(componentFamily.jurisdiction, {
          extensionId: sellerRegistration.jurisdiction.extensionId,
          key: sellerRegistration.jurisdiction.key,
          version: sellerRegistration.jurisdiction.version,
          contentHash: sellerRegistration.jurisdiction.contentHash,
        }) || !same(classification.jurisdiction, sellerRegistration.jurisdiction) ||
        !same(placeOfSupply.jurisdiction, sellerRegistration.jurisdiction) ||
        typeof fiscalJurisdiction !== "object" || fiscalJurisdiction === null ||
        fiscalJurisdiction.extensionId !== sellerRegistration.jurisdiction.extensionId ||
        fiscalJurisdiction.ownerTenantId !== sellerRegistration.jurisdiction.ownerTenantId ||
        fiscalJurisdiction.key !== sellerRegistration.jurisdiction.key ||
        typeof fiscalJurisdiction.version !== "number" ||
        !Number.isSafeInteger(fiscalJurisdiction.version) || fiscalJurisdiction.version <= 0 ||
        String(fiscalJurisdiction.version) !== sellerRegistration.jurisdiction.version ||
        fiscalJurisdiction.contentHash !== sellerRegistration.jurisdiction.contentHash ||
        financialSource.propertyNode !== propertyNode || financialSource.reservationId !== reservationId ||
        financialSource.folioId !== folioId || financialSource.journalId !== journalId ||
        financialSource.currency !== "INR" ||
        classification.propertyNode !== propertyNode || classification.classificationSystem !== "SAC" ||
        classification.isServiceCode !== "Y" || sellerDetails.lineage.registrationId !== sellerRegistration.registrationId ||
        sellerDetails.lineage.evidenceHash !== sellerRegistration.evidenceHash ||
        buyerDetails.lineage.partyId !== recipientPartyId ||
        buyerDetails.lineage.registrationId !== recipientRegistrationId ||
        buyerDetails.lineage.evidenceHash !== recipientRegistration.evidenceHash) {
      return conflict("statutory and posted fiscal-source evidence do not describe one exact supply");
    }

    const body = {
      state: "eligible_irp_invoice_source" as const,
      financialSource,
      legalBuyerPartyId,
      sellerRegistration,
      recipientRegistration,
      sellerDetails,
      buyerDetails,
      placeOfSupply,
      classification,
      supplyNatureAtTimeOfSupply: replayedAtTime,
      componentFamily,
    };
    return freeze({ ...body, evidenceHash: digest({ tenantId, ...body }) });
  }
}
