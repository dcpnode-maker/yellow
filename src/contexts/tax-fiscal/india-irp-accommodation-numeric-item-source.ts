import { types as utilTypes } from "node:util";

import type {
  IndiaFinalComponentTaxFiscalSourceComponent,
  IndiaFinalComponentTaxFiscalSourceResult,
  IndiaFinalComponentTaxFiscalSourceRoomNight,
} from "../financials";
import type { IndiaGstAccommodationClassificationResult } from "./india-gst-accommodation-classification";
import type { IndiaIrpAccommodationSourceResult } from "./india-irp-accommodation-source";
import { buildIndiaIrpBuyerDetails } from "./india-irp-buyer-details";
import { buildIndiaIrpSellerDetails } from "./india-irp-seller-details";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const MONEY = /^(?:0|[1-9][0-9]*)$/;
const DATE = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;
const MAX_INT64 = 9_223_372_036_854_775_807n;
const ACCOMMODATION_SAC = new Set(["996311", "996312", "996313", "996321", "996322", "996329"]);
const UTGST_STATE_CODES = new Set(["04", "26", "31", "35", "38"]);

const INPUT_KEYS = ["tenantId", "source"] as const;
const SOURCE_KEYS = [
  "state", "financialSource", "legalBuyerPartyId", "sellerRegistration",
  "recipientRegistration", "sellerDetails", "buyerDetails", "placeOfSupply",
  "classification", "supplyNatureAtTimeOfSupply", "componentFamily", "evidenceHash",
] as const;
const FINANCIAL_KEYS = [
  "state", "postingBindingId", "journalId", "taxId", "taxGeneration", "taxEvidenceHash",
  "valuationId", "valuationGeneration", "finalValuationEvidenceHash", "applicabilityId",
  "applicabilityEvidenceHash", "reservationId", "folioId", "guestAccountId", "propertyNode",
  "businessDate", "currency", "transactionValueMinor", "taxMinor", "grandTotalMinor",
  "componentFamily", "predecessorHashes", "roomNights", "components", "journalLines",
  "sourceEvidenceHash",
] as const;
const NIGHT_KEYS = [
  "ordinal", "businessDate", "transactionValueMinor", "slabUptoMinor",
  "aggregateRateBasisPoints", "itcEligible", "taxMinor",
] as const;
const COMPONENT_KEYS = [
  "roomNightOrdinal", "componentOrdinal", "componentIdentity", "rateBasisPoints",
  "taxAmountMinor",
] as const;
const JURISDICTION_KEYS = ["extensionId", "ownerTenantId", "key", "version", "contentHash"] as const;
const SUPPLIER_KEYS = ["registrationId", "propertyNode", "scheme", "currency", "jurisdiction", "gstin", "stateCode", "legalName", "tradeName", "addressLine", "locality", "postalCode", "evidenceHash"] as const;
const RECIPIENT_KEYS = ["registrationId", "partyId", "scheme", "gstin", "stateCode", "legalName", "tradeName", "addressLine1", "locality", "pin", "evidenceHash"] as const;
const CLASSIFICATION_KEYS = ["classificationId", "propertyNode", "jurisdiction", "lineId", "revenueGroup", "classificationSystem", "classificationCode", "isServiceCode", "evidenceHash"] as const;
const PLACE_KEYS = ["propertyNode", "reservationId", "folioId", "jurisdiction", "supplier", "recipient", "buyerAssociation", "classification", "propertyLocation", "legalRule", "pos", "candidateJson", "candidateHash"] as const;
const COMPONENT_FAMILY_KEYS = ["propertyNode", "reservationId", "folioId", "supplyDate", "jurisdiction", "supplierRegistrationId", "placeOfSupplyStateCode", "supplyNature", "determinationBasis", "sezDirection", "componentFamily", "legalSources", "predecessorCandidateHash", "evidenceHash"] as const;
const SUPPLY_TIME_KEYS = ["propertyNode", "reservationId", "folioId", "supplyDate", "supplyNature", "determinationBasis", "sezDirection", "legalRule", "supplierRegistrationId", "supplierGstRegistrationStatusId", "supplierServiceLocationId", "supplierRegistrationStatusEvidenceHash", "recipientPartyId", "recipientRegistrationId", "recipientSezStatusId", "recipientRegistrationStatusEvidenceHash", "timeOfSupplyDate", "supplierTimeOfSupplyEvidenceHash", "recipientTimeOfSupplyEvidenceHash", "result", "evidenceHash"] as const;
const PREDECESSOR_KEYS = ["section14", "levyComponentIdentity", "reservationLineage", "attributionSnapshot"] as const;
const JOURNAL_LINE_KEYS = ["id", "seq", "accountId", "accountRole", "folioId", "txCode", "description", "amountMinor", "quantity", "businessDate", "currency", "taxDetail"] as const;

type ComponentIdentity = IndiaFinalComponentTaxFiscalSourceComponent["componentIdentity"];
type ComponentFamily = IndiaFinalComponentTaxFiscalSourceResult["componentFamily"];

export interface IndiaIrpAccommodationNumericItemSourceInput {
  readonly tenantId: string;
  readonly source: IndiaIrpAccommodationSourceResult;
}

export interface IndiaIrpAccommodationNumericRoomNightSource
  extends IndiaFinalComponentTaxFiscalSourceRoomNight {
  readonly components: readonly IndiaFinalComponentTaxFiscalSourceComponent[];
}

export interface IndiaIrpAccommodationNumericItemSourcesResult {
  readonly state: "eligible_irp_accommodation_numeric_item_sources";
  readonly currency: "INR";
  readonly componentFamily: ComponentFamily;
  readonly classification: IndiaGstAccommodationClassificationResult;
  readonly roomNights: readonly IndiaIrpAccommodationNumericRoomNightSource[];
  readonly transactionValueMinor: string;
  readonly taxMinor: string;
  readonly grandTotalMinor: string;
  readonly sourceEvidenceHash: string;
  readonly evidenceHash: string;
}

export class IndiaIrpAccommodationNumericItemSourceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaIrpAccommodationNumericItemSourceValidationError";
  }
}

function fail(message: string): never {
  throw new IndiaIrpAccommodationNumericItemSourceValidationError(message);
}

function exactRecord(
  value: unknown,
  expectedKeys: readonly string[],
  subject: string,
): Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value) ||
      utilTypes.isProxy(value) || Object.getPrototypeOf(value) !== Object.prototype ||
      Object.getOwnPropertySymbols(value).length !== 0 || !Object.isFrozen(value)) {
    return fail(`${subject} must be an exact frozen plain object`);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Object.keys(descriptors);
  if (keys.length !== expectedKeys.length || keys.some((key, index) => key !== expectedKeys[index]) ||
      Object.values(descriptors).some((descriptor) => descriptor.get !== undefined ||
        descriptor.set !== undefined || descriptor.enumerable !== true ||
        descriptor.configurable !== false || !("value" in descriptor) || descriptor.writable !== false)) {
    return fail(`${subject} shape is invalid`);
  }
  return value as Readonly<Record<string, unknown>>;
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
    return fail("numeric item-source input must be an exact deeply frozen graph");
  }
  if (active.has(value)) return fail("numeric item-source input must be acyclic");
  if (seen.has(value)) return;
  seen.add(value);
  active.add(value);
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype) {
    return fail("numeric item-source input must contain plain records");
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Object.keys(value);
  if (Array.isArray(value) && (keys.length !== value.length ||
      keys.some((key, index) => key !== String(index)))) {
    return fail("numeric item-source arrays must be dense");
  }
  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (Array.isArray(value) && key === "length") continue;
    if (descriptor.get !== undefined || descriptor.set !== undefined ||
        descriptor.enumerable !== true || descriptor.configurable !== false ||
        !("value" in descriptor) || descriptor.writable !== false) {
      return fail("numeric item-source input descriptors are invalid");
    }
    exactFrozenGraph(descriptor.value, seen, active);
  }
  active.delete(value);
}

function canonicalUuid(value: unknown, subject: string): string {
  if (typeof value !== "string" || !UUID.test(value)) return fail(`${subject} must be a lowercase UUID`);
  return value;
}

function hash(value: unknown, subject: string): string {
  if (typeof value !== "string" || !SHA256.test(value)) return fail(`${subject} must be lowercase SHA-256`);
  return value;
}

function money(value: unknown, subject: string): bigint {
  if (typeof value !== "string" || !MONEY.test(value)) return fail(`${subject} must be canonical minor units`);
  const parsed = BigInt(value);
  if (parsed > MAX_INT64) return fail(`${subject} exceeds signed-int64 range`);
  return parsed;
}

function safeNonNegativeInteger(value: unknown, subject: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    return fail(`${subject} must be a non-negative safe integer`);
  }
  return value;
}

function calendarDate(value: unknown, subject: string): string {
  if (typeof value !== "string" || !DATE.test(value)) return fail(`${subject} is invalid`);
  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month ||
      date.getUTCDate() !== day) return fail(`${subject} is invalid`);
  return value;
}

function digest(value: unknown): string {
  return new Bun.CryptoHasher("sha256").update(JSON.stringify(value)).digest("hex");
}

function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function validateInnerStatutoryEvidence(
  tenantId: string,
  source: IndiaIrpAccommodationSourceResult,
): void {
  const seller = exactRecord(source.sellerRegistration, SUPPLIER_KEYS, "seller registration");
  const sellerJurisdiction = exactRecord(seller.jurisdiction, JURISDICTION_KEYS, "seller jurisdiction");
  const { evidenceHash: sellerEvidenceHash, ...sellerBody } = seller;
  if (hash(sellerEvidenceHash, "seller evidence hash") !== digest({
    registrationId: sellerBody.registrationId,
    tenantId,
    propertyNode: sellerBody.propertyNode,
    scheme: sellerBody.scheme,
    currency: sellerBody.currency,
    jurisdiction: sellerJurisdiction,
    gstin: sellerBody.gstin,
    stateCode: sellerBody.stateCode,
    legalName: sellerBody.legalName,
    tradeName: sellerBody.tradeName,
    addressLine: sellerBody.addressLine,
    locality: sellerBody.locality,
    postalCode: sellerBody.postalCode,
  })) return fail("seller evidence hash is inconsistent");

  const recipient = exactRecord(source.recipientRegistration, RECIPIENT_KEYS, "recipient registration");
  const { evidenceHash: recipientEvidenceHash, ...recipientBody } = recipient;
  if (hash(recipientEvidenceHash, "recipient evidence hash") !== digest({
    registrationId: recipientBody.registrationId,
    tenantId,
    partyId: recipientBody.partyId,
    scheme: recipientBody.scheme,
    gstin: recipientBody.gstin,
    stateCode: recipientBody.stateCode,
    legalName: recipientBody.legalName,
    tradeName: recipientBody.tradeName,
    addressLine1: recipientBody.addressLine1,
    locality: recipientBody.locality,
    pin: recipientBody.pin,
  })) return fail("recipient evidence hash is inconsistent");

  const rebuiltSeller = buildIndiaIrpSellerDetails(source.sellerRegistration);
  const rebuiltBuyer = buildIndiaIrpBuyerDetails(source.recipientRegistration);
  if (!same(rebuiltSeller, source.sellerDetails) || !same(rebuiltBuyer, source.buyerDetails)) {
    return fail("IRP party details do not byte-match their registration evidence");
  }

  const classification = exactRecord(source.classification, CLASSIFICATION_KEYS, "classification");
  const classificationJurisdiction = exactRecord(
    classification.jurisdiction,
    JURISDICTION_KEYS,
    "classification jurisdiction",
  );
  const { evidenceHash: classificationEvidenceHash, ...classificationBody } = classification;
  if (hash(classificationEvidenceHash, "classification evidence hash") !== digest({
    tenantId,
    classificationId: classificationBody.classificationId,
    propertyNode: classificationBody.propertyNode,
    jurisdiction: classificationJurisdiction,
    lineId: classificationBody.lineId,
    revenueGroup: classificationBody.revenueGroup,
    classificationSystem: classificationBody.classificationSystem,
    classificationCode: classificationBody.classificationCode,
    isServiceCode: classificationBody.isServiceCode,
  }) || !ACCOMMODATION_SAC.has(String(classificationBody.classificationCode))) {
    return fail("classification evidence hash is inconsistent");
  }

  const place = exactRecord(source.placeOfSupply, PLACE_KEYS, "place-of-supply evidence");
  exactRecord(place.jurisdiction, JURISDICTION_KEYS, "place-of-supply jurisdiction");
  exactRecord(place.supplier, ["registrationId", "evidenceHash"], "place-of-supply supplier");
  exactRecord(place.recipient, ["partyId", "registrationId", "evidenceHash"], "place-of-supply recipient");
  exactRecord(place.buyerAssociation, ["associationHash", "payloadHash"], "place-of-supply buyer association");
  exactRecord(place.classification, ["classificationId", "evidenceHash"], "place-of-supply classification");
  exactRecord(place.propertyLocation, ["propertyNode", "evidenceHash"], "place-of-supply property location");
  const candidate = Object.fromEntries(PLACE_KEYS.slice(0, -2).map((key) => [key, place[key]]));
  if (place.candidateJson !== JSON.stringify(candidate) ||
      hash(place.candidateHash, "place-of-supply candidate hash") !== digest({ tenantId, candidate })) {
    return fail("place-of-supply candidate evidence is inconsistent");
  }

  const supplyTime = exactRecord(source.supplyNatureAtTimeOfSupply, SUPPLY_TIME_KEYS, "supply-at-time evidence");
  const { evidenceHash: supplyTimeEvidenceHash, ...supplyTimeBody } = supplyTime;
  if (hash(supplyTimeEvidenceHash, "supply-at-time evidence hash") !==
      digest({ tenantId, ...supplyTimeBody })) return fail("supply-at-time evidence hash is inconsistent");

  const componentFamily = exactRecord(source.componentFamily, COMPONENT_FAMILY_KEYS, "component-family evidence");
  exactRecord(componentFamily.jurisdiction, ["extensionId", "key", "version", "contentHash"], "component-family jurisdiction");
  exactRecord(componentFamily.legalSources, ["supplyNature", "componentFamily"], "component-family legal sources");
  const { evidenceHash: componentEvidenceHash, ...componentBody } = componentFamily;
  if (hash(componentEvidenceHash, "component-family evidence hash") !==
      digest({ tenantId, ...componentBody })) return fail("component-family evidence hash is inconsistent");

  if (place.propertyNode !== source.financialSource.propertyNode ||
      place.reservationId !== source.financialSource.reservationId ||
      place.folioId !== source.financialSource.folioId ||
      (place.supplier as Readonly<Record<string, unknown>>).registrationId !== seller.registrationId ||
      (place.supplier as Readonly<Record<string, unknown>>).evidenceHash !== seller.evidenceHash ||
      (place.recipient as Readonly<Record<string, unknown>>).partyId !== recipient.partyId ||
      (place.recipient as Readonly<Record<string, unknown>>).registrationId !== recipient.registrationId ||
      (place.recipient as Readonly<Record<string, unknown>>).evidenceHash !== recipient.evidenceHash ||
      (place.classification as Readonly<Record<string, unknown>>).classificationId !== classification.classificationId ||
      (place.classification as Readonly<Record<string, unknown>>).evidenceHash !== classification.evidenceHash ||
      place.pos !== componentFamily.placeOfSupplyStateCode ||
      supplyTime.supplierRegistrationId !== seller.registrationId ||
      supplyTime.recipientPartyId !== recipient.partyId ||
      supplyTime.recipientRegistrationId !== recipient.registrationId ||
      supplyTime.supplyDate !== supplyTime.timeOfSupplyDate ||
      componentFamily.supplyNature !== supplyTime.supplyNature ||
      componentFamily.determinationBasis !== supplyTime.determinationBasis ||
      componentFamily.sezDirection !== supplyTime.sezDirection ||
      componentFamily.supplierRegistrationId !== seller.registrationId ||
      (componentFamily.componentFamily === "igst") !== (componentFamily.supplyNature === "inter_state") ||
      (componentFamily.componentFamily === "cgst_utgst") !==
        (componentFamily.supplyNature === "intra_state" && UTGST_STATE_CODES.has(String(place.pos)))) {
    return fail("nested statutory evidence does not describe one exact supply");
  }
}

function validateFinancialEnvelope(source: IndiaIrpAccommodationSourceResult): void {
  const financial = source.financialSource;
  for (const [value, subject] of [
    [financial.postingBindingId, "posting binding id"], [financial.journalId, "journal id"],
    [financial.taxId, "tax id"], [financial.valuationId, "valuation id"],
    [financial.applicabilityId, "applicability id"], [financial.reservationId, "reservation id"],
    [financial.folioId, "folio id"], [financial.guestAccountId, "guest account id"],
    [financial.propertyNode, "property node"],
  ] as const) canonicalUuid(value, subject);
  for (const [value, subject] of [
    [financial.taxEvidenceHash, "tax evidence hash"],
    [financial.finalValuationEvidenceHash, "valuation evidence hash"],
    [financial.applicabilityEvidenceHash, "applicability evidence hash"],
  ] as const) hash(value, subject);
  safeNonNegativeInteger(financial.taxGeneration, "tax generation");
  safeNonNegativeInteger(financial.valuationGeneration, "valuation generation");
  calendarDate(financial.businessDate, "financial business date");
  const predecessors = exactRecord(financial.predecessorHashes, PREDECESSOR_KEYS, "financial predecessors");
  for (const [name, value] of Object.entries(predecessors)) hash(value, `${name} predecessor hash`);
  if (!Array.isArray(financial.journalLines) || financial.journalLines.length < 2) {
    return fail("financial journal-line evidence is incomplete");
  }
  for (const [index, rawLine] of financial.journalLines.entries()) {
    const line = exactRecord(rawLine, JOURNAL_LINE_KEYS, "financial journal line");
    canonicalUuid(line.id, "journal line id");
    canonicalUuid(line.accountId, "journal line account id");
    if (line.folioId !== null) canonicalUuid(line.folioId, "journal line folio id");
    if (line.seq !== index + 1 || typeof line.accountRole !== "string" ||
        typeof line.txCode !== "string" || typeof line.description !== "string" ||
        typeof line.quantity !== "string" || line.currency !== "INR") {
      return fail("financial journal-line evidence is malformed");
    }
    calendarDate(line.businessDate, "journal line business date");
    if (typeof line.amountMinor !== "string" || !/^-?(?:0|[1-9][0-9]*)$/.test(line.amountMinor) ||
        BigInt(line.amountMinor) < -MAX_INT64 || BigInt(line.amountMinor) > MAX_INT64) {
      return fail("journal line amount exceeds signed-int64 range");
    }
    if (index === 0) {
      exactRecord(line.taxDetail, ["schemaVersion", "tax", "valuation", "applicability", "posting", "totals", "componentFamily", "jurisdiction", "revenueRoute", "components"], "canonical tax detail");
    } else if (line.taxDetail !== null) return fail("only the journal root may contain tax detail");
  }

  const identities = expectedIdentities(financial.componentFamily);
  const totals = new Map<ComponentIdentity, bigint>();
  for (const component of financial.components) {
    totals.set(
      component.componentIdentity,
      (totals.get(component.componentIdentity) ?? 0n) + money(component.taxAmountMinor, "component tax"),
    );
  }
  const positive = identities.filter((identity) => (totals.get(identity) ?? 0n) > 0n);
  const lines = financial.journalLines;
  if (lines.length !== 2 + positive.length || lines[0]?.accountId !== financial.guestAccountId ||
      lines[0]?.accountRole !== "guest" || lines[0]?.folioId !== financial.folioId ||
      lines[0]?.description !== "India accommodation component tax" ||
      lines[0]?.amountMinor !== financial.grandTotalMinor || lines[0]?.quantity !== "1.000" ||
      lines[0]?.businessDate !== financial.businessDate ||
      lines.slice(1).some((line) => line.folioId !== null || line.taxDetail !== null ||
        line.quantity !== "1.000" || line.businessDate !== financial.businessDate) ||
      new Set(lines.map((line) => line.id)).size !== lines.length ||
      lines.reduce((sum, line) => sum + BigInt(line.amountMinor), 0n) !== 0n) {
    return fail("financial journal is not the exact balanced posting topology");
  }

  const detail = exactRecord(lines[0]!.taxDetail, ["schemaVersion", "tax", "valuation", "applicability", "posting", "totals", "componentFamily", "jurisdiction", "revenueRoute", "components"], "canonical tax detail");
  const tax = exactRecord(detail.tax, ["taxId", "taxGeneration", "evidenceHash"], "canonical tax identity");
  const valuation = exactRecord(detail.valuation, ["valuationId", "valuationGeneration", "evidenceHash"], "canonical valuation identity");
  const applicability = exactRecord(detail.applicability, ["applicabilityId", "evidenceHash"], "canonical applicability identity");
  const posting = exactRecord(detail.posting, ["propertyNode", "reservationId", "folioId", "journalId", "currency"], "canonical posting identity");
  const detailTotals = exactRecord(detail.totals, ["transactionValueMinor", "taxMinor", "grandTotalMinor"], "canonical posting totals");
  const jurisdiction = exactRecord(detail.jurisdiction, JURISDICTION_KEYS, "canonical posting jurisdiction");
  const revenueRoute = exactRecord(detail.revenueRoute, ["mappingId", "semanticCode", "txCode", "creditAccountId"], "canonical revenue route");
  if (!Array.isArray(detail.components)) return fail("canonical component route set is invalid");
  const detailComponents = detail.components as readonly unknown[];

  if (detail.schemaVersion !== "india_accommodation_component_tax_v1" ||
      tax.taxId !== financial.taxId || tax.taxGeneration !== financial.taxGeneration ||
      tax.evidenceHash !== financial.taxEvidenceHash || valuation.valuationId !== financial.valuationId ||
      valuation.valuationGeneration !== financial.valuationGeneration ||
      valuation.evidenceHash !== financial.finalValuationEvidenceHash ||
      applicability.applicabilityId !== financial.applicabilityId ||
      applicability.evidenceHash !== financial.applicabilityEvidenceHash ||
      posting.propertyNode !== financial.propertyNode || posting.reservationId !== financial.reservationId ||
      posting.folioId !== financial.folioId || posting.journalId !== financial.journalId || posting.currency !== "INR" ||
      detailTotals.transactionValueMinor !== financial.transactionValueMinor ||
      detailTotals.taxMinor !== financial.taxMinor || detailTotals.grandTotalMinor !== financial.grandTotalMinor ||
      detail.componentFamily !== financial.componentFamily ||
      jurisdiction.extensionId !== source.classification.jurisdiction.extensionId ||
      jurisdiction.ownerTenantId !== source.classification.jurisdiction.ownerTenantId ||
      jurisdiction.key !== source.classification.jurisdiction.key ||
      String(jurisdiction.version) !== source.classification.jurisdiction.version ||
      jurisdiction.contentHash !== source.classification.jurisdiction.contentHash ||
      revenueRoute.semanticCode !== "room_revenue" ||
      revenueRoute.creditAccountId !== lines[1]?.accountId || revenueRoute.txCode !== lines[1]?.txCode ||
      lines[0]?.txCode !== revenueRoute.txCode ||
      lines[1]?.description !== "Room revenue" || lines[1]?.amountMinor !== (-BigInt(financial.transactionValueMinor)).toString() ||
      lines[1]?.accountRole !== "revenue" || detailComponents.length !== identities.length) {
    return fail("canonical journal root evidence is inconsistent");
  }
  canonicalUuid(revenueRoute.mappingId, "revenue mapping id");
  canonicalUuid(revenueRoute.creditAccountId, "revenue credit account id");

  let lineIndex = 2;
  const mappingIds = new Set<string>([String(revenueRoute.mappingId)]);
  for (const [index, identity] of identities.entries()) {
    const component = exactRecord(
      detailComponents[index],
      ["componentIdentity", "semanticCode", "amountMinor", "route"],
      "canonical component route",
    );
    const amount = totals.get(identity) ?? 0n;
    const semanticCode = identity.toUpperCase();
    if (component.componentIdentity !== identity || component.semanticCode !== semanticCode ||
        component.amountMinor !== amount.toString()) return fail("canonical component detail is inconsistent");
    if (amount === 0n) {
      if (component.route !== null) return fail("zero component must not have a posting route");
      continue;
    }
    const route = exactRecord(component.route, ["mappingId", "semanticCode", "txCode", "creditAccountId"], "canonical component posting route");
    const line = lines[lineIndex];
    if (route.semanticCode !== semanticCode || route.creditAccountId !== line?.accountId ||
        route.txCode !== line?.txCode || line?.description !== semanticCode ||
        line?.amountMinor !== (-amount).toString() || line?.accountRole !== "tax_payable") {
      return fail("canonical component posting line is inconsistent");
    }
    const mappingId = canonicalUuid(route.mappingId, "component mapping id");
    canonicalUuid(route.creditAccountId, "component credit account id");
    if (mappingIds.has(mappingId)) return fail("canonical posting routes are duplicated");
    mappingIds.add(mappingId);
    lineIndex += 1;
  }
  if (lineIndex !== lines.length) return fail("canonical posting line set is incomplete");
}

function recursivelyFreeze<T>(value: T, seen = new Set<object>()): T {
  if (value !== null && typeof value === "object" && !seen.has(value)) {
    seen.add(value);
    for (const nested of Object.values(value as Record<string, unknown>)) recursivelyFreeze(nested, seen);
    Object.freeze(value);
  }
  return value;
}

function expectedIdentities(family: ComponentFamily): readonly ComponentIdentity[] {
  switch (family) {
    case "igst": return ["igst"];
    case "cgst_sgst": return ["cgst", "sgst"];
    case "cgst_utgst": return ["cgst", "utgst"];
  }
}

function validateSourceHash(tenantId: string, source: IndiaIrpAccommodationSourceResult): void {
  const { evidenceHash, ...body } = source;
  if (hash(evidenceHash, "Order413 evidence hash") !== digest({ tenantId, ...body })) {
    return fail("Order413 evidence does not byte-match its tenant-bound source");
  }
  const { sourceEvidenceHash, ...financialBody } = source.financialSource;
  if (hash(sourceEvidenceHash, "financial source evidence hash") !==
      digest({ tenantId, ...financialBody })) {
    return fail("financial source evidence does not byte-match its tenant-bound source");
  }
}

function composeValidated(
  rawInput: IndiaIrpAccommodationNumericItemSourceInput,
): IndiaIrpAccommodationNumericItemSourcesResult {
  exactFrozenGraph(rawInput);
  const input = exactRecord(rawInput, INPUT_KEYS, "numeric item-source input") as unknown as
    IndiaIrpAccommodationNumericItemSourceInput;
  const tenantId = canonicalUuid(input.tenantId, "tenantId");
  const source = exactRecord(input.source, SOURCE_KEYS, "Order413 source") as unknown as
    IndiaIrpAccommodationSourceResult;
  const financial = exactRecord(source.financialSource, FINANCIAL_KEYS, "financial source") as unknown as
    IndiaFinalComponentTaxFiscalSourceResult;

  if (source.state !== "eligible_irp_invoice_source" ||
      financial.state !== "eligible_current_posted_source" || financial.currency !== "INR" ||
      source.sellerRegistration.currency !== "INR") {
    return fail("source is not an eligible INR accommodation supply");
  }
  validateSourceHash(tenantId, source);
  validateInnerStatutoryEvidence(tenantId, source);
  validateFinancialEnvelope(source);

  const family = financial.componentFamily;
  if (family !== "igst" && family !== "cgst_sgst" && family !== "cgst_utgst") {
    return fail("component family is invalid");
  }
  const identities = expectedIdentities(family);
  const nights = financial.roomNights;
  const components = financial.components;
  if (!Array.isArray(nights) || nights.length < 1 || nights.length > 366 ||
      !Array.isArray(components) || components.length !== nights.length * identities.length) {
    return fail("room-night component topology is incomplete");
  }

  if (source.componentFamily.componentFamily !== family ||
      source.componentFamily.propertyNode !== financial.propertyNode ||
      source.componentFamily.reservationId !== financial.reservationId ||
      source.componentFamily.folioId !== financial.folioId ||
      source.componentFamily.supplyDate !== source.supplyNatureAtTimeOfSupply.supplyDate ||
      source.classification.propertyNode !== financial.propertyNode ||
      source.classification.classificationSystem !== "SAC" ||
      source.classification.isServiceCode !== "Y" ||
      source.supplyNatureAtTimeOfSupply.propertyNode !== financial.propertyNode ||
      source.supplyNatureAtTimeOfSupply.reservationId !== financial.reservationId ||
      source.supplyNatureAtTimeOfSupply.folioId !== financial.folioId ||
      source.legalBuyerPartyId !== source.recipientRegistration.partyId ||
      source.buyerDetails.lineage.partyId !== source.legalBuyerPartyId ||
      source.buyerDetails.lineage.registrationId !== source.recipientRegistration.registrationId ||
      source.buyerDetails.lineage.evidenceHash !== source.recipientRegistration.evidenceHash ||
      source.sellerDetails.lineage.registrationId !== source.sellerRegistration.registrationId ||
      source.sellerDetails.lineage.evidenceHash !== source.sellerRegistration.evidenceHash) {
    return fail("statutory source identities do not describe the numeric supply");
  }

  let transactionTotal = 0n;
  let taxTotal = 0n;
  const grouped: IndiaIrpAccommodationNumericRoomNightSource[] = [];
  for (let nightIndex = 0; nightIndex < nights.length; nightIndex += 1) {
    const night = exactRecord(nights[nightIndex], NIGHT_KEYS, "room-night source") as unknown as
      IndiaFinalComponentTaxFiscalSourceRoomNight;
    if (night.ordinal !== String(nightIndex) || typeof night.itcEligible !== "boolean") {
      return fail("room-night identity is malformed or non-contiguous");
    }
    calendarDate(night.businessDate, "room-night business date");
    const transactionValue = money(night.transactionValueMinor, "room-night transaction value");
    if (transactionValue === 0n) return fail("room-night transaction value must be positive");
    const nightTax = money(night.taxMinor, "room-night tax");
    if (night.slabUptoMinor !== null) money(night.slabUptoMinor, "room-night slab");
    const aggregateRate = safeNonNegativeInteger(
      night.aggregateRateBasisPoints,
      "room-night aggregate rate",
    );

    let componentTax = 0n;
    let componentRate = 0;
    const groupedComponents: IndiaFinalComponentTaxFiscalSourceComponent[] = [];
    for (let componentOrdinal = 0; componentOrdinal < identities.length; componentOrdinal += 1) {
      const flatIndex = nightIndex * identities.length + componentOrdinal;
      const component = exactRecord(
        components[flatIndex],
        COMPONENT_KEYS,
        "component source",
      ) as unknown as IndiaFinalComponentTaxFiscalSourceComponent;
      const rate = safeNonNegativeInteger(component.rateBasisPoints, "component rate");
      if (component.roomNightOrdinal !== nightIndex || component.componentOrdinal !== componentOrdinal ||
          component.componentIdentity !== identities[componentOrdinal]) {
        return fail("component source is missing, reordered, duplicated, surplus or wrong-family");
      }
      componentRate += rate;
      if (!Number.isSafeInteger(componentRate)) return fail("component rate reconciliation is unsafe");
      componentTax += money(component.taxAmountMinor, "component tax");
      if (componentTax > MAX_INT64) return fail("component tax reconciliation exceeds signed-int64 range");
      groupedComponents.push(component);
    }
    if (componentRate !== aggregateRate || componentTax !== nightTax) {
      return fail("room-night component rate or tax does not reconcile");
    }
    transactionTotal += transactionValue;
    taxTotal += nightTax;
    if (transactionTotal > MAX_INT64 || taxTotal > MAX_INT64) {
      return fail("root reconciliation exceeds signed-int64 range");
    }
    grouped.push({ ...night, components: groupedComponents });
  }

  const rootTransaction = money(financial.transactionValueMinor, "root transaction value");
  const rootTax = money(financial.taxMinor, "root tax");
  const rootGrand = money(financial.grandTotalMinor, "root grand total");
  if (rootTransaction === 0n || transactionTotal !== rootTransaction || taxTotal !== rootTax ||
      rootTransaction + rootTax > MAX_INT64 || rootTransaction + rootTax !== rootGrand) {
    return fail("room-night and root totals do not reconcile");
  }

  const body = {
    state: "eligible_irp_accommodation_numeric_item_sources" as const,
    currency: "INR" as const,
    componentFamily: family,
    classification: source.classification,
    roomNights: grouped,
    transactionValueMinor: financial.transactionValueMinor,
    taxMinor: financial.taxMinor,
    grandTotalMinor: financial.grandTotalMinor,
    sourceEvidenceHash: source.evidenceHash,
  };
  return recursivelyFreeze({ ...body, evidenceHash: digest({ tenantId, ...body }) });
}

export function composeIndiaIrpAccommodationNumericItemSources(
  input: IndiaIrpAccommodationNumericItemSourceInput,
): IndiaIrpAccommodationNumericItemSourcesResult {
  try {
    return composeValidated(input);
  } catch (error) {
    if (error instanceof IndiaIrpAccommodationNumericItemSourceValidationError) throw error;
    if (error instanceof Error) {
      throw new IndiaIrpAccommodationNumericItemSourceValidationError(
        "numeric item-source evidence is malformed",
      );
    }
    throw error;
  }
}
