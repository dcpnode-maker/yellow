import { types as utilTypes } from "node:util";

import type { IndiaFinalComponentTaxNativeFiscalSourceResult } from "../financials";
import {
  deriveIndiaGstAccommodationComponentFamily,
  type IndiaGstAccommodationComponentFamilyResult,
} from "./india-gst-accommodation-component-family";
import type { IndiaGstAccommodationClassificationResult } from "./india-gst-accommodation-classification";
import type { IndiaGstAccommodationPlaceOfSupplyResult } from "./india-gst-accommodation-place-of-supply";
import {
  composeIndiaGstAccommodationNativeSupplyNatureAtTimeOfSupply,
  type IndiaGstAccommodationNativeSupplyNatureAtTimeOfSupplyInput,
  type IndiaGstAccommodationNativeSupplyNatureAtTimeOfSupplyResult,
} from "./india-gst-accommodation-supply-nature-at-time-of-supply";
import type { IndiaGstRecipientRegistrationResult } from "./india-gst-recipient-registration";
import type { IndiaGstSupplierRegistrationResult } from "./india-gst-supplier-registration";
import {
  buildIndiaIrpBuyerDetails,
  type IndiaIrpBuyerDetailsResultV1,
} from "./india-irp-buyer-details";
import {
  buildIndiaIrpSellerDetails,
  type IndiaIrpSellerDetailsResultV1,
} from "./india-irp-seller-details";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const INPUT_KEYS = [
  "tenantId", "financialSource", "legalBuyerPartyId", "sellerRegistration",
  "recipientRegistration", "placeOfSupply", "classification",
  "supplyNatureAtTimeOfSupplyInput", "supplyNatureAtTimeOfSupplyResult",
] as const;
const FINANCIAL_SOURCE_KEYS = [
  "state", "sourceKind", "postingBindingId", "accountingEvidenceHash",
  "nativeTimingId", "nativeTimingEvidenceHash", "journalId", "taxId",
  "taxGeneration", "taxEvidenceHash", "valuationId", "valuationGeneration",
  "finalValuationEvidenceHash", "applicabilityId", "applicabilityEvidenceHash",
  "reservationId", "folioId", "guestAccountId", "buyerPartyId", "propertyNode", "businessDate",
  "currency", "transactionValueMinor", "taxMinor", "grandTotalMinor",
  "componentFamily", "rateSelectionKind", "predecessorHashes", "nativeSourceBasisHash",
  "nativeConsiderationBasisHash", "considerationAccountIds", "considerationRootIds",
  "considerationSources", "roomNights", "components", "journalLines",
  "sourceEvidenceHash",
] as const;

type RecordValue = Readonly<Record<string, unknown>>;

export interface IndiaNativeFiscalSourceInput {
  readonly tenantId: string;
  readonly financialSource: IndiaFinalComponentTaxNativeFiscalSourceResult;
  readonly legalBuyerPartyId: string;
  readonly sellerRegistration: IndiaGstSupplierRegistrationResult;
  readonly recipientRegistration: IndiaGstRecipientRegistrationResult;
  readonly placeOfSupply: IndiaGstAccommodationPlaceOfSupplyResult;
  readonly classification: IndiaGstAccommodationClassificationResult;
  readonly supplyNatureAtTimeOfSupplyInput: IndiaGstAccommodationNativeSupplyNatureAtTimeOfSupplyInput;
  readonly supplyNatureAtTimeOfSupplyResult: IndiaGstAccommodationNativeSupplyNatureAtTimeOfSupplyResult;
}

export interface IndiaNativeFiscalSourceResult {
  readonly state: "eligible_irp_invoice_source";
  readonly sourceKind: "native_current_transaction_graph";
  readonly sourceVersion: 2;
  readonly financialSource: IndiaFinalComponentTaxNativeFiscalSourceResult;
  readonly legalBuyerPartyId: string;
  readonly sellerRegistration: IndiaGstSupplierRegistrationResult;
  readonly recipientRegistration: IndiaGstRecipientRegistrationResult;
  readonly sellerDetails: IndiaIrpSellerDetailsResultV1;
  readonly buyerDetails: IndiaIrpBuyerDetailsResultV1;
  readonly placeOfSupply: IndiaGstAccommodationPlaceOfSupplyResult;
  readonly classification: IndiaGstAccommodationClassificationResult;
  readonly supplyNatureAtTimeOfSupply: IndiaGstAccommodationNativeSupplyNatureAtTimeOfSupplyResult;
  readonly componentFamily: IndiaGstAccommodationComponentFamilyResult;
  readonly evidenceHash: string;
}

export class IndiaNativeFiscalSourceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaNativeFiscalSourceValidationError";
  }
}

export class IndiaNativeFiscalSourceConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaNativeFiscalSourceConflictError";
  }
}

function validation(message: string): never {
  throw new IndiaNativeFiscalSourceValidationError(message);
}

function conflict(message: string): never {
  throw new IndiaNativeFiscalSourceConflictError(message);
}

function uuid(value: unknown, subject: string): string {
  return typeof value === "string" && UUID.test(value)
    ? value
    : validation(`${subject} must be a lowercase UUID`);
}

function hash(value: unknown, subject: string): string {
  return typeof value === "string" && SHA256.test(value)
    ? value
    : conflict(`${subject} is invalid`);
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
    return validation("native fiscal source input must be an exact deeply frozen graph");
  }
  if (active.has(value)) return validation("native fiscal source input must be acyclic");
  if (seen.has(value)) return;
  seen.add(value);
  active.add(value);
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null) {
    return validation("native fiscal source input must contain plain records");
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Array.isArray(value) && (Object.keys(value).length !== value.length ||
      Object.keys(value).some((key, index) => key !== String(index)))) {
    return validation("native fiscal source arrays must be dense");
  }
  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (Array.isArray(value) && key === "length") continue;
    if (descriptor.get !== undefined || descriptor.set !== undefined ||
        descriptor.enumerable !== true || descriptor.configurable !== false ||
        !("value" in descriptor) || descriptor.writable !== false) {
      return validation("native fiscal source input descriptors are invalid");
    }
    exactFrozenGraph(descriptor.value, seen, active);
  }
  active.delete(value);
}

function exactInput(value: IndiaNativeFiscalSourceInput): IndiaNativeFiscalSourceInput {
  exactFrozenGraph(value);
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return validation("native fiscal source input is invalid");
  }
  const actual = Object.keys(value).sort();
  const expected = [...INPUT_KEYS].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    return validation("native fiscal source input shape is invalid");
  }
  return value;
}

function digest(value: unknown): string {
  return new Bun.CryptoHasher("sha256").update(JSON.stringify(value)).digest("hex");
}

function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function freeze<T>(value: T, seen = new Set<object>()): T {
  if (value !== null && typeof value === "object" && !seen.has(value)) {
    seen.add(value);
    for (const child of Object.values(value as Record<string, unknown>)) freeze(child, seen);
    Object.freeze(value);
  }
  return value;
}

function financialRecord(value: IndiaFinalComponentTaxNativeFiscalSourceResult): RecordValue {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return conflict("native financial source is malformed");
  }
  const actual = Object.keys(value).sort();
  const expected = [...FINANCIAL_SOURCE_KEYS].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    return conflict("native financial source shape is invalid");
  }
  return value as unknown as RecordValue;
}

/**
 * Pure Order413 assembly. The Financials reader and native Order295/296/297
 * composers authenticate their own roots; this boundary proves they all describe
 * the same current-transaction supply without relabelling an external source.
 */
export function assembleIndiaNativeFiscalSource(
  rawInput: IndiaNativeFiscalSourceInput,
): IndiaNativeFiscalSourceResult {
  const input = exactInput(rawInput);
  const tenantId = uuid(input.tenantId, "tenantId");
  const legalBuyerPartyId = uuid(input.legalBuyerPartyId, "legalBuyerPartyId");
  const financialSource = financialRecord(input.financialSource);
  hash(financialSource.sourceEvidenceHash, "native financial source evidence hash");
  const { sourceEvidenceHash: _sourceEvidenceHash, ...financialBody } = financialSource;
  if (financialSource.sourceEvidenceHash !== digest({ tenantId, ...financialBody })) {
    return conflict("native financial source does not byte-match its tenant-bound evidence");
  }
  if (financialSource.state !== "eligible_current_native_accounted_source" ||
      financialSource.sourceKind !== "native_component_tax_delta" ||
      financialSource.currency !== "INR") {
    return conflict("native financial source is not eligible current component-tax accounting");
  }

  let replay: IndiaGstAccommodationNativeSupplyNatureAtTimeOfSupplyResult;
  try {
    replay = composeIndiaGstAccommodationNativeSupplyNatureAtTimeOfSupply(
      input.supplyNatureAtTimeOfSupplyInput,
    );
  } catch (error) {
    if (error instanceof Error) return conflict(`native Order297 replay failed: ${error.message}`);
    throw error;
  }
  if (!same(replay, input.supplyNatureAtTimeOfSupplyResult)) {
    return conflict("native Order297 evidence does not byte-match its complete replay");
  }

  const sellerDetails = buildIndiaIrpSellerDetails(input.sellerRegistration);
  const buyerDetails = buildIndiaIrpBuyerDetails(input.recipientRegistration);
  const componentFamily = deriveIndiaGstAccommodationComponentFamily(Object.freeze({
    tenantId,
    supplyNature: input.supplyNatureAtTimeOfSupplyInput.supplyNature,
  }));
  const supplierAtTime = input.supplyNatureAtTimeOfSupplyInput.supplierRegistrationAtTimeOfSupply;
  const recipientAtTime = input.supplyNatureAtTimeOfSupplyInput.recipientRegistrationAtTimeOfSupply;
  const nativeTiming = supplierAtTime.timeOfSupply.nativeTiming;
  const place = input.placeOfSupply;
  const classification = input.classification;

  if (input.supplyNatureAtTimeOfSupplyInput.tenantId !== tenantId ||
      legalBuyerPartyId !== input.recipientRegistration.partyId ||
      replay.propertyNode !== financialSource.propertyNode ||
      replay.reservationId !== financialSource.reservationId ||
      replay.folioId !== financialSource.folioId ||
      replay.kind !== "native_current_transaction" ||
      replay.invoiceSourceEvidenceHash !== supplierAtTime.invoiceSourceEvidenceHash ||
      replay.invoiceSourceEvidenceHash !== recipientAtTime.invoiceSourceEvidenceHash ||
      replay.nativeTimingEvidenceHash !== nativeTiming.evidenceHash ||
      financialSource.nativeTimingId !== nativeTiming.nativeTimingId ||
      financialSource.nativeTimingEvidenceHash !== nativeTiming.predecessorHashes.nativeTiming ||
      financialSource.businessDate !== nativeTiming.invoiceIssueDate ||
      financialSource.grandTotalMinor !== nativeTiming.amountMinor ||
      financialSource.buyerPartyId !== legalBuyerPartyId ||
      financialSource.componentFamily !== componentFamily.componentFamily ||
      input.sellerRegistration.registrationId !== supplierAtTime.supplierRegistrationId ||
      input.sellerRegistration.evidenceHash !== supplierAtTime.supplier.evidenceHash ||
      input.recipientRegistration.partyId !== recipientAtTime.recipientPartyId ||
      input.recipientRegistration.registrationId !== recipientAtTime.recipientRegistrationId ||
      input.recipientRegistration.evidenceHash !== recipientAtTime.recipient.evidenceHash ||
      input.supplyNatureAtTimeOfSupplyInput.supplyNature.classification.classificationId !== classification.classificationId ||
      input.supplyNatureAtTimeOfSupplyInput.supplyNature.classification.evidenceHash !== classification.evidenceHash ||
      place.propertyNode !== financialSource.propertyNode ||
      place.reservationId !== financialSource.reservationId ||
      place.folioId !== financialSource.folioId ||
      place.supplier.registrationId !== input.sellerRegistration.registrationId ||
      place.supplier.evidenceHash !== input.sellerRegistration.evidenceHash ||
      place.recipient.partyId !== legalBuyerPartyId ||
      place.recipient.registrationId !== input.recipientRegistration.registrationId ||
      place.recipient.evidenceHash !== input.recipientRegistration.evidenceHash ||
      place.classification.classificationId !== classification.classificationId ||
      place.classification.evidenceHash !== classification.evidenceHash ||
      classification.propertyNode !== financialSource.propertyNode ||
      classification.classificationSystem !== "SAC" ||
      classification.isServiceCode !== "Y" ||
      componentFamily.propertyNode !== financialSource.propertyNode ||
      componentFamily.reservationId !== financialSource.reservationId ||
      componentFamily.folioId !== financialSource.folioId ||
      componentFamily.supplyDate !== replay.supplyDate ||
      componentFamily.supplierRegistrationId !== input.sellerRegistration.registrationId ||
      componentFamily.placeOfSupplyStateCode !== place.pos ||
      sellerDetails.lineage.registrationId !== input.sellerRegistration.registrationId ||
      sellerDetails.lineage.evidenceHash !== input.sellerRegistration.evidenceHash ||
      buyerDetails.lineage.partyId !== legalBuyerPartyId ||
      buyerDetails.lineage.registrationId !== input.recipientRegistration.registrationId ||
      buyerDetails.lineage.evidenceHash !== input.recipientRegistration.evidenceHash) {
    return conflict("native statutory and financial evidence do not describe one exact supply");
  }

  const body = {
    state: "eligible_irp_invoice_source" as const,
    sourceKind: "native_current_transaction_graph" as const,
    sourceVersion: 2 as const,
    financialSource: input.financialSource,
    legalBuyerPartyId,
    sellerRegistration: input.sellerRegistration,
    recipientRegistration: input.recipientRegistration,
    sellerDetails,
    buyerDetails,
    placeOfSupply: place,
    classification,
    supplyNatureAtTimeOfSupply: replay,
    componentFamily,
  };
  return freeze({ ...body, evidenceHash: digest({ tenantId, ...body }) });
}

export const composeIndiaNativeFiscalSource = assembleIndiaNativeFiscalSource;

export class IndiaNativeFiscalSourceAssembler {
  compose(input: IndiaNativeFiscalSourceInput): IndiaNativeFiscalSourceResult {
    return assembleIndiaNativeFiscalSource(input);
  }
}
