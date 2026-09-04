import {
  buildIndiaIrpBuyerDetails,
  buildIndiaIrpSellerDetails,
} from "../../src/contexts/tax-fiscal";
import type { IndiaIrpAccommodationSourceResult } from "../../src/contexts/tax-fiscal";

const TENANT = "10000000-0000-4000-8000-000000000001";
const H = "a".repeat(64);

type Family = "igst" | "cgst_sgst" | "cgst_utgst";
type MutableRecord = Record<string, any>;

function digest(value: unknown): string {
  return new Bun.CryptoHasher("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}

function deepFreeze<T>(value: T, seen = new Set<object>()): T {
  if (value !== null && typeof value === "object" && !seen.has(value)) {
    seen.add(value);
    for (const child of Object.values(value as MutableRecord)) deepFreeze(child, seen);
    Object.freeze(value);
  }
  return value;
}

function identities(family: Family): readonly ("igst" | "cgst" | "sgst" | "utgst")[] {
  return family === "igst"
    ? ["igst"]
    : family === "cgst_sgst"
      ? ["cgst", "sgst"]
      : ["cgst", "utgst"];
}

export interface FixtureOptions {
  readonly family?: Family;
  readonly aggregateRateBasisPoints?: number;
  readonly nights?: number;
  readonly transactionValues?: readonly string[];
  readonly componentTaxes?: readonly (readonly string[])[];
}

export function makeOrder419Source(options: FixtureOptions = {}, tenantId = TENANT): IndiaIrpAccommodationSourceResult {
  const family = options.family ?? "igst";
  const ids = identities(family);
  const nights = options.nights ?? 1;
  const rate = options.aggregateRateBasisPoints ?? 500;
  const values = options.transactionValues ?? Array.from({ length: nights }, (_, index) => String(10_000 + index));
  const taxRows = options.componentTaxes ?? Array.from(
    { length: nights },
    (_, index) => ids.map(() => String(index === 0 ? 250 : 0)),
  );
  const roomNights = values.map((value, ordinal) => ({
    ordinal: String(ordinal),
    businessDate: new Date(Date.UTC(2044, 0, ordinal + 1)).toISOString().slice(0, 10),
    transactionValueMinor: value,
    slabUptoMinor: rate === 500 ? "750000" : null,
    aggregateRateBasisPoints: rate,
    itcEligible: rate === 1800,
    taxMinor: taxRows[ordinal]!.reduce((sum, amount) => sum + BigInt(amount), 0n).toString(),
  }));
  const components = roomNights.flatMap((_, roomNightOrdinal) =>
    ids.map((componentIdentity, componentOrdinal) => ({
      roomNightOrdinal,
      componentOrdinal,
      componentIdentity,
      rateBasisPoints: rate / ids.length,
      taxAmountMinor: taxRows[roomNightOrdinal]![componentOrdinal]!,
    })),
  );
  const transactionValueMinor = values.reduce((sum, value) => sum + BigInt(value), 0n).toString();
  const taxMinor = components.reduce((sum, component) => sum + BigInt(component.taxAmountMinor), 0n).toString();
  const grandTotalMinor = (BigInt(transactionValueMinor) + BigInt(taxMinor)).toString();
  const propertyNode = "b0000000-0000-4000-8000-00000000000b";
  const reservationId = "80000000-0000-4000-8000-000000000008";
  const folioId = "90000000-0000-4000-8000-000000000009";
  const journalId = "40000000-0000-4000-8000-000000000004";
  const guestAccountId = "a0000000-0000-4000-8000-00000000000a";
  const revenueAccountId = "05000000-0000-4000-8000-000000000050";
  const jurisdiction = {
    extensionId: "d0000000-0000-4000-8000-00000000000d",
    ownerTenantId: null,
    key: "in-gst-lodging",
    version: "1",
    contentHash: "3".repeat(64),
  } as const;
  const componentTotals = ids.map((identity) => ({
    identity,
    amount: components
      .filter((component) => component.componentIdentity === identity)
      .reduce((sum, component) => sum + BigInt(component.taxAmountMinor), 0n),
  }));
  const detailComponents = componentTotals.map(({ identity, amount }, index) => ({
    componentIdentity: identity,
    semanticCode: identity.toUpperCase(),
    amountMinor: amount.toString(),
    route: amount === 0n ? null : {
      mappingId: `1${index}000000-0000-4000-8000-00000000001${index}`,
      semanticCode: identity.toUpperCase(),
      txCode: identity.toUpperCase(),
      creditAccountId: `2${index}000000-0000-4000-8000-00000000002${index}`,
    },
  }));
  const taxDetail = {
    schemaVersion: "india_accommodation_component_tax_v1",
    tax: { taxId: "50000000-0000-4000-8000-000000000005", taxGeneration: 0, evidenceHash: "b".repeat(64) },
    valuation: { valuationId: "60000000-0000-4000-8000-000000000006", valuationGeneration: 0, evidenceHash: "c".repeat(64) },
    applicability: { applicabilityId: "70000000-0000-4000-8000-000000000007", evidenceHash: "d".repeat(64) },
    posting: { propertyNode, reservationId, folioId, journalId, currency: "INR" },
    totals: { transactionValueMinor, taxMinor, grandTotalMinor },
    componentFamily: family,
    jurisdiction,
    revenueRoute: {
      mappingId: "09000000-0000-4000-8000-000000000090",
      semanticCode: "room_revenue",
      txCode: "ROOM",
      creditAccountId: revenueAccountId,
    },
    components: detailComponents,
  };
  const journalLines = [
    {
      id: "02000000-0000-4000-8000-000000000020", seq: 1,
      accountId: guestAccountId, accountRole: "guest", folioId, txCode: "ROOM",
      description: "India accommodation component tax", amountMinor: grandTotalMinor, quantity: "1.000",
      businessDate: "2044-01-01", currency: "INR", taxDetail,
    },
    {
      id: "04000000-0000-4000-8000-000000000040", seq: 2,
      accountId: revenueAccountId, accountRole: "revenue", folioId: null, txCode: "ROOM",
      description: "Room revenue", amountMinor: `-${transactionValueMinor}`, quantity: "1.000",
      businessDate: "2044-01-01", currency: "INR", taxDetail: null,
    },
    ...detailComponents.filter((component) => component.route !== null).map((component, index) => ({
      id: `3${index}000000-0000-4000-8000-00000000003${index}`,
      seq: index + 3,
      accountId: component.route!.creditAccountId,
      accountRole: "tax_payable",
      folioId: null,
      txCode: component.route!.txCode,
      description: component.componentIdentity.toUpperCase(),
      amountMinor: `-${component.amountMinor}`,
      quantity: "1.000",
      businessDate: "2044-01-01",
      currency: "INR",
      taxDetail: null,
    })),
  ];
  const financialBody = {
    state: "eligible_current_posted_source",
    postingBindingId: "30000000-0000-4000-8000-000000000003",
    journalId,
    taxId: "50000000-0000-4000-8000-000000000005",
    taxGeneration: 0,
    taxEvidenceHash: "b".repeat(64),
    valuationId: "60000000-0000-4000-8000-000000000006",
    valuationGeneration: 0,
    finalValuationEvidenceHash: "c".repeat(64),
    applicabilityId: "70000000-0000-4000-8000-000000000007",
    applicabilityEvidenceHash: "d".repeat(64),
    reservationId,
    folioId,
    guestAccountId,
    propertyNode,
    businessDate: "2044-01-01",
    currency: "INR",
    transactionValueMinor,
    taxMinor,
    grandTotalMinor,
    componentFamily: family,
    predecessorHashes: {
      section14: "e".repeat(64),
      levyComponentIdentity: "f".repeat(64),
      reservationLineage: "1".repeat(64),
      attributionSnapshot: "2".repeat(64),
    },
    roomNights,
    components,
    journalLines,
  } as const;
  const financialSource = {
    ...financialBody,
    sourceEvidenceHash: digest({ tenantId, ...financialBody }),
  };
  const classification = {
    classificationId: "c0000000-0000-4000-8000-00000000000c",
    propertyNode: financialBody.propertyNode,
    jurisdiction,
    lineId: "room",
    revenueGroup: "room_revenue",
    classificationSystem: "SAC",
    classificationCode: "996311",
    isServiceCode: "Y",
    evidenceHash: "",
  };
  classification.evidenceHash = digest({ tenantId, ...Object.fromEntries(
    Object.entries(classification).filter(([key]) => key !== "evidenceHash"),
  ) });
  const componentFamilyBody = {
    propertyNode: financialBody.propertyNode,
    reservationId: financialBody.reservationId,
    folioId: financialBody.folioId,
    supplyDate: "2044-01-01",
    jurisdiction: {
      extensionId: classification.jurisdiction.extensionId,
      key: classification.jurisdiction.key,
      version: classification.jurisdiction.version,
      contentHash: classification.jurisdiction.contentHash,
    },
    supplierRegistrationId: "e0000000-0000-4000-8000-00000000000e",
    placeOfSupplyStateCode: family === "igst" ? "29" : family === "cgst_utgst" ? "04" : "27",
    supplyNature: family === "igst" ? "inter_state" : "intra_state",
    determinationBasis: "ordinary_registered_state_comparison",
    sezDirection: "none",
    componentFamily: family,
    legalSources: {
      supplyNature: family === "igst" ? "IGST_ACT_7_3" : "IGST_ACT_8_2",
      componentFamily: family === "igst" ? "IGST_ACT_5_1" : family === "cgst_sgst" ? "CGST_ACT_9_1_AND_SGST_ACT" : "CGST_ACT_9_1_AND_UTGST_ACT_7_1",
    },
    predecessorCandidateHash: "5".repeat(64),
  } as const;
  const componentFamily = {
    ...componentFamilyBody,
    evidenceHash: digest({ tenantId, ...componentFamilyBody }),
  };
  const sellerJurisdiction = classification.jurisdiction;
  const sellerBody = {
    registrationId: componentFamily.supplierRegistrationId,
    propertyNode: financialBody.propertyNode,
    scheme: "in-gstin",
    currency: "INR",
    jurisdiction: sellerJurisdiction,
    gstin: "29AAPFU0939F1ZR",
    stateCode: "29",
    legalName: "Order 414 Hotel Private Limited",
    tradeName: "Order 414 Hotel",
    addressLine: "1 Hotel Road",
    locality: "Bengaluru",
    postalCode: "560001",
  } as const;
  const sellerRegistration = deepFreeze({
    ...sellerBody,
    evidenceHash: digest({
      registrationId: sellerBody.registrationId,
      tenantId,
      propertyNode: sellerBody.propertyNode,
      scheme: sellerBody.scheme,
      currency: sellerBody.currency,
      jurisdiction: sellerBody.jurisdiction,
      gstin: sellerBody.gstin,
      stateCode: sellerBody.stateCode,
      legalName: sellerBody.legalName,
      tradeName: sellerBody.tradeName,
      addressLine: sellerBody.addressLine,
      locality: sellerBody.locality,
      postalCode: sellerBody.postalCode,
    }),
  });
  const recipientBody = {
    registrationId: "01000000-0000-4000-8000-000000000010",
    partyId: "f0000000-0000-4000-8000-00000000000f",
    scheme: "in-gstin",
    gstin: "27AAPFU0939F1ZV",
    stateCode: "27",
    legalName: "Order 414 Buyer Private Limited",
    tradeName: "Order 414 Buyer",
    addressLine1: "1 Buyer Road",
    locality: "Mumbai",
    pin: "400001",
  } as const;
  const recipientRegistration = deepFreeze({
    ...recipientBody,
    evidenceHash: digest({
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
    }),
  });
  const placeCandidate = {
    propertyNode: financialBody.propertyNode,
    reservationId: financialBody.reservationId,
    folioId: financialBody.folioId,
    jurisdiction: sellerJurisdiction,
    supplier: { registrationId: sellerRegistration.registrationId, evidenceHash: sellerRegistration.evidenceHash },
    recipient: { partyId: recipientRegistration.partyId, registrationId: recipientRegistration.registrationId, evidenceHash: recipientRegistration.evidenceHash },
    buyerAssociation: { associationHash: H, payloadHash: H },
    classification: { classificationId: classification.classificationId, evidenceHash: classification.evidenceHash },
    propertyLocation: { propertyNode: financialBody.propertyNode, evidenceHash: H },
    legalRule: "IGST_ACT_12_3_B",
    pos: componentFamily.placeOfSupplyStateCode,
  };
  const placeOfSupply = {
    ...placeCandidate,
    candidateJson: JSON.stringify(placeCandidate),
    candidateHash: digest({ tenantId, candidate: placeCandidate }),
  };
  const supplyTimeBody = {
    propertyNode: financialBody.propertyNode,
    reservationId: financialBody.reservationId,
    folioId: financialBody.folioId,
    supplyDate: componentFamily.supplyDate,
    supplyNature: componentFamily.supplyNature,
    determinationBasis: componentFamily.determinationBasis,
    sezDirection: componentFamily.sezDirection,
    legalRule: componentFamily.legalSources.supplyNature,
    supplierRegistrationId: sellerRegistration.registrationId,
    supplierGstRegistrationStatusId: "06000000-0000-4000-8000-000000000060",
    supplierServiceLocationId: "07000000-0000-4000-8000-000000000070",
    supplierRegistrationStatusEvidenceHash: H,
    recipientPartyId: recipientRegistration.partyId,
    recipientRegistrationId: recipientRegistration.registrationId,
    recipientSezStatusId: "08000000-0000-4000-8000-000000000080",
    recipientRegistrationStatusEvidenceHash: H,
    timeOfSupplyDate: componentFamily.supplyDate,
    supplierTimeOfSupplyEvidenceHash: H,
    recipientTimeOfSupplyEvidenceHash: H,
    result: "supply_nature_and_registrations_bound_at_time_of_supply",
  } as const;
  const supplyNatureAtTimeOfSupply = {
    ...supplyTimeBody,
    evidenceHash: digest({ tenantId, ...supplyTimeBody }),
  };
  const body = {
    state: "eligible_irp_invoice_source",
    financialSource,
    legalBuyerPartyId: "f0000000-0000-4000-8000-00000000000f",
    sellerRegistration,
    recipientRegistration,
    sellerDetails: buildIndiaIrpSellerDetails(sellerRegistration),
    buyerDetails: buildIndiaIrpBuyerDetails(recipientRegistration),
    placeOfSupply,
    classification,
    supplyNatureAtTimeOfSupply,
    componentFamily,
  };
  return deepFreeze({
    ...body,
    evidenceHash: digest({ tenantId, ...body }),
  }) as unknown as IndiaIrpAccommodationSourceResult;
}


export function makeOrder419Input(
  options: FixtureOptions = {},
  tenantId = TENANT,
): { readonly tenantId: string; readonly source: IndiaIrpAccommodationSourceResult } {
  return deepFreeze({ tenantId, source: makeOrder419Source(options, tenantId) });
}

export function cloneOrder419<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function rehashOrder419Source(
  source: IndiaIrpAccommodationSourceResult,
  tenantId = TENANT,
): IndiaIrpAccommodationSourceResult {
  const mutable = source as unknown as MutableRecord;
  const { evidenceHash: _discarded, ...body } = mutable;
  return deepFreeze({ ...body, evidenceHash: digest({ tenantId, ...body }) }) as IndiaIrpAccommodationSourceResult;
}

export function makeOrder419UnsupportedExportInput(): {
  readonly tenantId: string;
  readonly source: IndiaIrpAccommodationSourceResult;
} {
  const source = cloneOrder419(makeOrder419Source()) as unknown as MutableRecord;
  source.supplyNatureAtTimeOfSupply.supplyNature = "export";
  source.componentFamily.supplyNature = "export";
  for (const key of ["supplyNatureAtTimeOfSupply", "componentFamily"] as const) {
    const { evidenceHash: _discarded, ...body } = source[key];
    source[key] = { ...body, evidenceHash: digest({ tenantId: TENANT, ...body }) };
  }
  return deepFreeze({ tenantId: TENANT, source: rehashOrder419Source(
    deepFreeze(source) as IndiaIrpAccommodationSourceResult,
  ) });
}

export { TENANT };
