import { describe, expect, test } from "bun:test";

import {
  buildIndiaIrpBuyerDetails,
  buildIndiaIrpSellerDetails,
  composeIndiaIrpAccommodationNumericItemSources,
  composeIndiaIrpOrdinaryRegisteredB2bSupplyType,
  type IndiaIrpAccommodationNumericItemSourceInput,
  type IndiaIrpOrdinaryRegisteredB2bSupplyTypeInput,
} from "../src/contexts/tax-fiscal";
import type { IndiaIrpAccommodationSourceResult } from "../src/contexts/tax-fiscal";

const TENANT = "10000000-0000-4000-8000-000000000001";
const OTHER_TENANT = "20000000-0000-4000-8000-000000000002";
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

interface FixtureOptions {
  readonly family?: Family;
  readonly aggregateRateBasisPoints?: number;
  readonly nights?: number;
  readonly transactionValues?: readonly string[];
  readonly componentTaxes?: readonly (readonly string[])[];
}

function makeSource(options: FixtureOptions = {}, tenantId = TENANT): IndiaIrpAccommodationSourceResult {
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

function input(source = makeSource(), tenantId = TENANT): IndiaIrpAccommodationNumericItemSourceInput {
  return deepFreeze({ tenantId, source });
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function rehashSource(source: IndiaIrpAccommodationSourceResult, tenantId = TENANT): IndiaIrpAccommodationSourceResult {
  const mutable = source as unknown as MutableRecord;
  const { evidenceHash: _discarded, ...body } = mutable;
  return deepFreeze({ ...body, evidenceHash: digest({ tenantId, ...body }) }) as IndiaIrpAccommodationSourceResult;
}

function rebuilt(mutator: (source: MutableRecord) => void, options: FixtureOptions = {}): IndiaIrpAccommodationNumericItemSourceInput {
  const source = clone(makeSource(options)) as unknown as MutableRecord;
  mutator(source);
  source.financialSource.sourceEvidenceHash = (() => {
    const { sourceEvidenceHash: _discarded, ...body } = source.financialSource;
    return digest({ tenantId: TENANT, ...body });
  })();
  return input(rehashSource(deepFreeze(source) as IndiaIrpAccommodationSourceResult));
}

function expectRejected(value: IndiaIrpAccommodationNumericItemSourceInput): void {
  expect(() => composeIndiaIrpAccommodationNumericItemSources(value)).toThrow();
}

describe("Order 414 India accommodation numeric item-source composition", () => {
  test("golden 5/12/18-percent across every family, multi-night and zero components preserve exact source fields", () => {
    const cases: readonly FixtureOptions[] = [
      { family: "igst", aggregateRateBasisPoints: 500, componentTaxes: [["500"]] },
      { family: "cgst_sgst", aggregateRateBasisPoints: 1200, componentTaxes: [["600", "600"], ["0", "0"]], nights: 2 },
      { family: "cgst_utgst", aggregateRateBasisPoints: 1800, componentTaxes: [["900", "900"]] },
    ];
    for (const fixture of cases) {
      const raw = input(makeSource(fixture));
      const before = JSON.stringify(raw);
      const first = composeIndiaIrpAccommodationNumericItemSources(raw);
      const second = composeIndiaIrpAccommodationNumericItemSources(raw);
      const source = raw.source.financialSource;
      expect(first.state).toBe("eligible_irp_accommodation_numeric_item_sources");
      expect(first.currency).toBe("INR");
      expect(first.componentFamily).toBe(source.componentFamily);
      expect(first.classification).toEqual(raw.source.classification);
      expect(first.roomNights).toHaveLength(source.roomNights.length);
      expect(first.roomNights.map((night) => ({
        ordinal: night.ordinal,
        businessDate: night.businessDate,
        transactionValueMinor: night.transactionValueMinor,
        slabUptoMinor: night.slabUptoMinor,
        aggregateRateBasisPoints: night.aggregateRateBasisPoints,
        itcEligible: night.itcEligible,
        taxMinor: night.taxMinor,
      }))).toEqual([...source.roomNights]);
      expect(first.roomNights.flatMap((night) => [...night.components])).toEqual([...source.components]);
      expect(first.transactionValueMinor).toBe(source.transactionValueMinor);
      expect(first.taxMinor).toBe(source.taxMinor);
      expect(first.grandTotalMinor).toBe(source.grandTotalMinor);
      expect(first.sourceEvidenceHash).toBe(raw.source.evidenceHash);
      expect(first).toEqual(second);
      expect(JSON.stringify(raw)).toBe(before);
      expect(JSON.stringify(first)).not.toContain(TENANT);
      expect(Object.isFrozen(first)).toBeTrue();
      expect(Object.isFrozen(first.classification)).toBeTrue();
      expect(Object.isFrozen(first.roomNights)).toBeTrue();
      expect(first.roomNights.every((night) => Object.isFrozen(night) && Object.isFrozen(night.components) && night.components.every(Object.isFrozen))).toBeTrue();
    }
  });

  test("tenant has cryptographic influence but is never returned", () => {
    const first = composeIndiaIrpAccommodationNumericItemSources(input());
    const otherSource = makeSource({}, OTHER_TENANT);
    const second = composeIndiaIrpAccommodationNumericItemSources(input(otherSource, OTHER_TENANT));
    expect(first.evidenceHash).not.toBe(second.evidenceHash);
    expect(JSON.stringify(second)).not.toContain(OTHER_TENANT);
  });

  test("missing, duplicate, surplus, reordered and wrong-family component topology fails closed", () => {
    const cases: ((source: MutableRecord) => void)[] = [
      (source) => { source.financialSource.components.pop(); },
      (source) => { source.financialSource.components.push(clone(source.financialSource.components[0])); },
      (source) => { source.financialSource.components.splice(1, 0, clone(source.financialSource.components[0])); },
      (source) => { source.financialSource.components.reverse(); },
      (source) => { source.financialSource.components[0].componentIdentity = "sgst"; },
      (source) => { source.financialSource.components[0].componentOrdinal = 1; },
      (source) => { source.financialSource.components[0].roomNightOrdinal = 1; },
    ];
    for (const mutate of cases) expectRejected(rebuilt(mutate, { family: "cgst_sgst" }));
  });

  test("ordinal gaps and wrong rate, night tax, root tax, value and grand-total reconciliation fail closed", () => {
    const cases: ((source: MutableRecord) => void)[] = [
      (source) => { source.financialSource.roomNights[1].ordinal = "2"; },
      (source) => { source.financialSource.roomNights.reverse(); },
      (source) => { source.financialSource.roomNights[0].aggregateRateBasisPoints = 501; },
      (source) => { source.financialSource.components[0].rateBasisPoints = 251; },
      (source) => { source.financialSource.roomNights[0].taxMinor = "501"; },
      (source) => { source.financialSource.taxMinor = "501"; },
      (source) => { source.financialSource.transactionValueMinor = "19999"; },
      (source) => { source.financialSource.grandTotalMinor = "20502"; },
      (source) => { source.financialSource.componentFamily = "cgst_utgst"; },
      (source) => { source.componentFamily.componentFamily = "cgst_utgst"; },
    ];
    for (const mutate of cases) expectRejected(rebuilt(mutate, { family: "cgst_sgst", nights: 2, componentTaxes: [["250", "250"], ["0", "0"]] }));
  });

  test("malformed, noncanonical, unsafe and signed-int64-overflow money/rates fail closed without raw errors", () => {
    const cases: ((source: MutableRecord) => void)[] = [
      (source) => { source.financialSource.roomNights[0].transactionValueMinor = "01"; },
      (source) => { source.financialSource.roomNights[0].transactionValueMinor = "+1"; },
      (source) => { source.financialSource.roomNights[0].transactionValueMinor = "1.0"; },
      (source) => { source.financialSource.roomNights[0].transactionValueMinor = "-1"; },
      (source) => { source.financialSource.roomNights[0].transactionValueMinor = "9223372036854775808"; },
      (source) => { source.financialSource.roomNights[0].taxMinor = "-1"; },
      (source) => { source.financialSource.components[0].taxAmountMinor = "9223372036854775808"; },
      (source) => { source.financialSource.roomNights[0].aggregateRateBasisPoints = Number.MAX_SAFE_INTEGER + 1; },
      (source) => { source.financialSource.components[0].rateBasisPoints = -1; },
      (source) => { source.financialSource.components[0].rateBasisPoints = 1.5; },
    ];
    for (const mutate of cases) {
      try {
        composeIndiaIrpAccommodationNumericItemSources(rebuilt(mutate));
        throw new Error("expected rejection");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error).not.toBeInstanceOf(TypeError);
        expect(error).not.toBeInstanceOf(RangeError);
        expect((error as Error).message).not.toContain("BigInt");
      }
    }
    expectRejected(rebuilt((source) => {
      source.financialSource.roomNights = [
        { ...source.financialSource.roomNights[0], ordinal: "0", transactionValueMinor: "9223372036854775807" },
        { ...source.financialSource.roomNights[0], ordinal: "1", businessDate: "2044-01-02", transactionValueMinor: "1" },
      ];
      source.financialSource.components = [
        { ...source.financialSource.components[0], roomNightOrdinal: 0, taxAmountMinor: "0" },
        { ...source.financialSource.components[0], roomNightOrdinal: 1, taxAmountMinor: "0" },
      ];
      source.financialSource.transactionValueMinor = "9223372036854775807";
      source.financialSource.taxMinor = "0";
      source.financialSource.grandTotalMinor = "9223372036854775807";
    }));
  });

  test("all Order413 identity/hash mutations and exact source shape drift fail closed", () => {
    const raw = clone(input()) as unknown as MutableRecord;
    raw.source.financialSource.journalId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
    expectRejected(deepFreeze(raw) as IndiaIrpAccommodationNumericItemSourceInput);

    const extra = clone(input()) as unknown as MutableRecord;
    extra.source.unexpected = true;
    extra.source = clone(rehashSource(deepFreeze(extra.source) as IndiaIrpAccommodationSourceResult));
    expectRejected(deepFreeze(extra) as IndiaIrpAccommodationNumericItemSourceInput);

    expectRejected(rebuilt((source) => { source.financialSource.unexpected = true; }));
    expectRejected(rebuilt((source) => { source.financialSource.roomNights[0].unexpected = true; }));
    expectRejected(rebuilt((source) => { source.financialSource.components[0].unexpected = true; }));

    const extraInput = clone(input()) as unknown as MutableRecord;
    extraInput.unexpected = true;
    expectRejected(deepFreeze(extraInput) as IndiaIrpAccommodationNumericItemSourceInput);

    const identityCases: ((source: MutableRecord) => void)[] = [
      (source) => { source.financialSource.propertyNode = "ffffffff-ffff-4fff-8fff-ffffffffffff"; },
      (source) => { source.financialSource.reservationId = "ffffffff-ffff-4fff-8fff-ffffffffffff"; },
      (source) => { source.financialSource.folioId = "ffffffff-ffff-4fff-8fff-ffffffffffff"; },
      (source) => { source.componentFamily.supplyDate = "2044-01-02"; },
      (source) => { source.legalBuyerPartyId = "ffffffff-ffff-4fff-8fff-ffffffffffff"; },
      (source) => { source.buyerDetails.lineage.registrationId = "ffffffff-ffff-4fff-8fff-ffffffffffff"; },
      (source) => { source.sellerDetails.lineage.registrationId = "ffffffff-ffff-4fff-8fff-ffffffffffff"; },
    ];
    for (const mutate of identityCases) expectRejected(rebuilt(mutate));

    const hashCases = ["evidenceHash", "financialSource.sourceEvidenceHash", "financialSource.taxEvidenceHash", "classification.evidenceHash"];
    for (const path of hashCases) {
      const candidate = clone(input()) as unknown as MutableRecord;
      const parts = path.split(".");
      let target = candidate.source;
      for (const part of parts.slice(0, -1)) target = target[part];
      target[parts.at(-1)!] = "0".repeat(64);
      expectRejected(deepFreeze(candidate) as IndiaIrpAccommodationNumericItemSourceInput);
    }
  });

  test("mutable, proxy, accessor, symbol, non-enumerable, sparse and cyclic graphs fail closed", () => {
    expectRejected({ tenantId: TENANT, source: makeSource() } as IndiaIrpAccommodationNumericItemSourceInput);
    expectRejected(deepFreeze({ tenantId: TENANT, source: new Proxy(makeSource(), {}) }) as IndiaIrpAccommodationNumericItemSourceInput);

    const accessor = { tenantId: TENANT } as MutableRecord;
    Object.defineProperty(accessor, "source", { enumerable: true, get: () => makeSource() });
    Object.freeze(accessor);
    expectRejected(accessor as IndiaIrpAccommodationNumericItemSourceInput);

    const symbol = clone(input()) as unknown as MutableRecord;
    Object.defineProperty(symbol, Symbol("hidden"), { value: true, enumerable: true });
    expectRejected(deepFreeze(symbol) as IndiaIrpAccommodationNumericItemSourceInput);

    const nonEnumerable = clone(input()) as unknown as MutableRecord;
    Object.defineProperty(nonEnumerable, "hidden", { value: true, enumerable: false });
    expectRejected(deepFreeze(nonEnumerable) as IndiaIrpAccommodationNumericItemSourceInput);

    const sparse = clone(input()) as unknown as MutableRecord;
    sparse.source.financialSource.roomNights.length = 2;
    expectRejected(deepFreeze(sparse) as IndiaIrpAccommodationNumericItemSourceInput);

    const cycle = clone(input()) as unknown as MutableRecord;
    cycle.source.loop = cycle.source;
    expect(() => composeIndiaIrpAccommodationNumericItemSources(deepFreeze(cycle) as IndiaIrpAccommodationNumericItemSourceInput)).toThrow();
  });

  test("one through 366 room nights are accepted and 367 fails closed", () => {
    expect(composeIndiaIrpAccommodationNumericItemSources(input(makeSource({ nights: 1 }))).roomNights).toHaveLength(1);
    const values = Array.from({ length: 366 }, () => "1");
    const zeroes = Array.from({ length: 366 }, () => ["0"] as const);
    expect(composeIndiaIrpAccommodationNumericItemSources(input(makeSource({ nights: 366, transactionValues: values, componentTaxes: zeroes }))).roomNights).toHaveLength(366);
    expectRejected(rebuilt((source) => {
      source.financialSource.roomNights = [];
      source.financialSource.components = [];
      source.financialSource.transactionValueMinor = "0";
      source.financialSource.taxMinor = "0";
      source.financialSource.grandTotalMinor = "0";
    }));
    expectRejected(rebuilt((source) => {
      const lastNight = clone(source.financialSource.roomNights.at(-1));
      lastNight.ordinal = "366";
      lastNight.businessDate = "2045-01-01";
      source.financialSource.roomNights.push(lastNight);
      const lastComponent = clone(source.financialSource.components.at(-1));
      lastComponent.roomNightOrdinal = 366;
      source.financialSource.components.push(lastComponent);
      source.financialSource.transactionValueMinor = "367";
      source.financialSource.grandTotalMinor = "367";
    }, { nights: 366, transactionValues: values, componentTaxes: zeroes }));
  });

  test("invalid calendar, slab, boolean, source state/currency and unsafe rate aggregation fail closed", () => {
    const cases: ((source: MutableRecord) => void)[] = [
      (source) => { source.financialSource.roomNights[0].businessDate = "2044-02-30"; },
      (source) => { source.financialSource.roomNights[0].slabUptoMinor = "-1"; },
      (source) => { source.financialSource.roomNights[0].slabUptoMinor = "01"; },
      (source) => { source.financialSource.roomNights[0].itcEligible = "false"; },
      (source) => { source.state = "other"; },
      (source) => { source.financialSource.state = "other"; },
      (source) => { source.financialSource.currency = "USD"; },
      (source) => { source.sellerRegistration.currency = "USD"; },
      (source) => {
        source.financialSource.roomNights[0].aggregateRateBasisPoints = Number.MAX_SAFE_INTEGER;
        source.financialSource.components[0].rateBasisPoints = Number.MAX_SAFE_INTEGER;
        source.financialSource.components[1].rateBasisPoints = Number.MAX_SAFE_INTEGER;
      },
    ];
    for (const mutate of cases) expectRejected(rebuilt(mutate, { family: "cgst_sgst" }));

    const invalidTenant = clone(input()) as unknown as MutableRecord;
    invalidTenant.tenantId = "A0000000-0000-4000-8000-000000000001";
    expectRejected(deepFreeze(invalidTenant) as IndiaIrpAccommodationNumericItemSourceInput);
  });

  test("correctly rehashed nested statutory, lineage and journal forgeries fail closed", () => {
    const forgeries: ((source: MutableRecord) => void)[] = [
      (source) => { source.sellerRegistration.extra = "forged"; },
      (source) => { source.classification.jurisdiction.extra = "forged"; },
      (source) => { source.classification.classificationCode = "999999"; },
      (source) => { source.classification.evidenceHash = "0".repeat(64); },
      (source) => { source.componentFamily.evidenceHash = "0".repeat(64); },
      (source) => { source.financialSource.predecessorHashes.extra = "0".repeat(64); },
      (source) => { source.financialSource.journalLines = [{ evil: true }]; },
      (source) => {
        source.legalBuyerPartyId = "not-a-uuid";
        source.recipientRegistration.partyId = "not-a-uuid";
        source.buyerDetails.lineage.partyId = "not-a-uuid";
      },
      (source) => { source.sellerRegistration.propertyNode = "ffffffff-ffff-4fff-8fff-ffffffffffff"; },
      (source) => { source.classification.tenantId = TENANT; },
    ];
    for (const forge of forgeries) expectRejected(rebuilt(forge));
  });

  test("every correctly rehashed journal scalar, balance and canonical tax-detail mutation fails closed", () => {
    const cases: readonly [string, (source: MutableRecord) => void][] = [
      ["root id duplicated", (source) => { source.financialSource.journalLines[0].id = source.financialSource.journalLines[1].id; }],
      ["root id malformed", (source) => { source.financialSource.journalLines[0].id = "not-a-uuid"; }],
      ["root seq", (source) => { source.financialSource.journalLines[0].seq = 2; }],
      ["root account", (source) => { source.financialSource.journalLines[0].accountId = "ffffffff-ffff-4fff-8fff-ffffffffffff"; }],
      ["root role", (source) => { source.financialSource.journalLines[0].accountRole = "revenue"; }],
      ["root folio", (source) => { source.financialSource.journalLines[0].folioId = null; }],
      ["root tx code", (source) => { source.financialSource.journalLines[0].txCode = "EVIL"; }],
      ["root description", (source) => { source.financialSource.journalLines[0].description = "Altered"; }],
      ["root amount and balance", (source) => { source.financialSource.journalLines[0].amountMinor = "10251"; }],
      ["root quantity", (source) => { source.financialSource.journalLines[0].quantity = "2"; }],
      ["root date", (source) => { source.financialSource.journalLines[0].businessDate = "2044-01-02"; }],
      ["root currency", (source) => { source.financialSource.journalLines[0].currency = "USD"; }],
      ["root tax detail absent", (source) => { source.financialSource.journalLines[0].taxDetail = null; }],
      ["credit id duplicated", (source) => { source.financialSource.journalLines[1].id = source.financialSource.journalLines[0].id; }],
      ["credit id malformed", (source) => { source.financialSource.journalLines[1].id = "not-a-uuid"; }],
      ["credit seq", (source) => { source.financialSource.journalLines[1].seq = 9; }],
      ["credit account", (source) => { source.financialSource.journalLines[1].accountId = "ffffffff-ffff-4fff-8fff-ffffffffffff"; }],
      ["credit role", (source) => { source.financialSource.journalLines[1].accountRole = "tax_payable"; }],
      ["credit folio", (source) => { source.financialSource.journalLines[1].folioId = source.financialSource.folioId; }],
      ["credit tx code", (source) => { source.financialSource.journalLines[1].txCode = "EVIL"; }],
      ["credit description", (source) => { source.financialSource.journalLines[1].description = "Altered"; }],
      ["credit amount and balance", (source) => { source.financialSource.journalLines[1].amountMinor = "-9999"; }],
      ["credit quantity", (source) => { source.financialSource.journalLines[1].quantity = "2"; }],
      ["credit date", (source) => { source.financialSource.journalLines[1].businessDate = "2044-01-02"; }],
      ["credit currency", (source) => { source.financialSource.journalLines[1].currency = "USD"; }],
      ["credit tax detail", (source) => { source.financialSource.journalLines[1].taxDetail = {}; }],
      ["tax-credit id duplicated", (source) => { source.financialSource.journalLines[2].id = source.financialSource.journalLines[0].id; }],
      ["tax-credit id malformed", (source) => { source.financialSource.journalLines[2].id = "not-a-uuid"; }],
      ["tax-credit seq", (source) => { source.financialSource.journalLines[2].seq = 9; }],
      ["tax-credit account", (source) => { source.financialSource.journalLines[2].accountId = "ffffffff-ffff-4fff-8fff-ffffffffffff"; }],
      ["tax-credit role", (source) => { source.financialSource.journalLines[2].accountRole = "revenue"; }],
      ["tax-credit folio", (source) => { source.financialSource.journalLines[2].folioId = source.financialSource.folioId; }],
      ["tax-credit tx code", (source) => { source.financialSource.journalLines[2].txCode = "EVIL"; }],
      ["tax-credit description", (source) => { source.financialSource.journalLines[2].description = "Altered"; }],
      ["tax-credit amount", (source) => { source.financialSource.journalLines[2].amountMinor = "-249"; }],
      ["tax-credit quantity", (source) => { source.financialSource.journalLines[2].quantity = "2"; }],
      ["tax-credit date", (source) => { source.financialSource.journalLines[2].businessDate = "2044-01-02"; }],
      ["tax-credit currency", (source) => { source.financialSource.journalLines[2].currency = "USD"; }],
      ["tax-credit tax detail", (source) => { source.financialSource.journalLines[2].taxDetail = {}; }],
      ["line reorder", (source) => { source.financialSource.journalLines.reverse(); }],
      ["tax schema", (source) => { source.financialSource.journalLines[0].taxDetail.schemaVersion = "evil"; }],
      ["tax id", (source) => { source.financialSource.journalLines[0].taxDetail.tax.taxId = "ffffffff-ffff-4fff-8fff-ffffffffffff"; }],
      ["tax generation", (source) => { source.financialSource.journalLines[0].taxDetail.tax.taxGeneration = 1; }],
      ["tax hash", (source) => { source.financialSource.journalLines[0].taxDetail.tax.evidenceHash = "0".repeat(64); }],
      ["valuation id", (source) => { source.financialSource.journalLines[0].taxDetail.valuation.valuationId = "ffffffff-ffff-4fff-8fff-ffffffffffff"; }],
      ["valuation generation", (source) => { source.financialSource.journalLines[0].taxDetail.valuation.valuationGeneration = 1; }],
      ["valuation hash", (source) => { source.financialSource.journalLines[0].taxDetail.valuation.evidenceHash = "0".repeat(64); }],
      ["applicability id", (source) => { source.financialSource.journalLines[0].taxDetail.applicability.applicabilityId = "ffffffff-ffff-4fff-8fff-ffffffffffff"; }],
      ["applicability hash", (source) => { source.financialSource.journalLines[0].taxDetail.applicability.evidenceHash = "0".repeat(64); }],
      ["posting property", (source) => { source.financialSource.journalLines[0].taxDetail.posting.propertyNode = "ffffffff-ffff-4fff-8fff-ffffffffffff"; }],
      ["posting reservation", (source) => { source.financialSource.journalLines[0].taxDetail.posting.reservationId = "ffffffff-ffff-4fff-8fff-ffffffffffff"; }],
      ["posting folio", (source) => { source.financialSource.journalLines[0].taxDetail.posting.folioId = "ffffffff-ffff-4fff-8fff-ffffffffffff"; }],
      ["posting journal", (source) => { source.financialSource.journalLines[0].taxDetail.posting.journalId = "ffffffff-ffff-4fff-8fff-ffffffffffff"; }],
      ["posting currency", (source) => { source.financialSource.journalLines[0].taxDetail.posting.currency = "USD"; }],
      ["totals transaction", (source) => { source.financialSource.journalLines[0].taxDetail.totals.transactionValueMinor = "9999"; }],
      ["totals tax", (source) => { source.financialSource.journalLines[0].taxDetail.totals.taxMinor = "999"; }],
      ["totals grand", (source) => { source.financialSource.journalLines[0].taxDetail.totals.grandTotalMinor = "9999"; }],
      ["detail family", (source) => { source.financialSource.journalLines[0].taxDetail.componentFamily = "cgst_sgst"; }],
      ["jurisdiction extension", (source) => { source.financialSource.journalLines[0].taxDetail.jurisdiction.extensionId = "ffffffff-ffff-4fff-8fff-ffffffffffff"; }],
      ["jurisdiction owner", (source) => { source.financialSource.journalLines[0].taxDetail.jurisdiction.ownerTenantId = TENANT; }],
      ["jurisdiction key", (source) => { source.financialSource.journalLines[0].taxDetail.jurisdiction.key = "evil"; }],
      ["jurisdiction version", (source) => { source.financialSource.journalLines[0].taxDetail.jurisdiction.version = "2"; }],
      ["jurisdiction hash", (source) => { source.financialSource.journalLines[0].taxDetail.jurisdiction.contentHash = "0".repeat(64); }],
      ["revenue mapping duplicated", (source) => { source.financialSource.journalLines[0].taxDetail.revenueRoute.mappingId = source.financialSource.journalLines[0].taxDetail.components[0].route.mappingId; }],
      ["revenue mapping malformed", (source) => { source.financialSource.journalLines[0].taxDetail.revenueRoute.mappingId = "not-a-uuid"; }],
      ["revenue semantic", (source) => { source.financialSource.journalLines[0].taxDetail.revenueRoute.semanticCode = "evil"; }],
      ["revenue tx code", (source) => { source.financialSource.journalLines[0].taxDetail.revenueRoute.txCode = "EVIL"; }],
      ["revenue account", (source) => { source.financialSource.journalLines[0].taxDetail.revenueRoute.creditAccountId = "ffffffff-ffff-4fff-8fff-ffffffffffff"; }],
      ["component identity", (source) => { source.financialSource.journalLines[0].taxDetail.components[0].componentIdentity = "sgst"; }],
      ["component semantic", (source) => { source.financialSource.journalLines[0].taxDetail.components[0].semanticCode = "SGST"; }],
      ["component amount", (source) => { source.financialSource.journalLines[0].taxDetail.components[0].amountMinor = "999"; }],
      ["component route absent", (source) => { source.financialSource.journalLines[0].taxDetail.components[0].route = null; }],
      ["component route mapping duplicated", (source) => { source.financialSource.journalLines[0].taxDetail.components[0].route.mappingId = source.financialSource.journalLines[0].taxDetail.revenueRoute.mappingId; }],
      ["component route mapping malformed", (source) => { source.financialSource.journalLines[0].taxDetail.components[0].route.mappingId = "not-a-uuid"; }],
      ["component route semantic", (source) => { source.financialSource.journalLines[0].taxDetail.components[0].route.semanticCode = "SGST"; }],
      ["component route tx", (source) => { source.financialSource.journalLines[0].taxDetail.components[0].route.txCode = "EVIL"; }],
      ["component route account", (source) => { source.financialSource.journalLines[0].taxDetail.components[0].route.creditAccountId = "ffffffff-ffff-4fff-8fff-ffffffffffff"; }],
    ];
    const accepted: string[] = [];
    for (const [name, mutate] of cases) {
      try { composeIndiaIrpAccommodationNumericItemSources(rebuilt(mutate)); }
      catch { continue; }
      accepted.push(name);
    }
    expect(accepted).toEqual([]);
  });

  test("coherent distinct canonical opaque line and mapping identifiers remain valid lineage", () => {
    const candidate = rebuilt((source) => {
      source.financialSource.journalLines[0].id = "a1000000-0000-4000-8000-000000000001";
      source.financialSource.journalLines[1].id = "a2000000-0000-4000-8000-000000000002";
      source.financialSource.journalLines[2].id = "a3000000-0000-4000-8000-000000000003";
      source.financialSource.journalLines[0].taxDetail.revenueRoute.mappingId = "a4000000-0000-4000-8000-000000000004";
      source.financialSource.journalLines[0].taxDetail.components[0].route.mappingId = "a5000000-0000-4000-8000-000000000005";
    });
    const result = composeIndiaIrpAccommodationNumericItemSources(candidate);
    expect(result.state).toBe("eligible_irp_accommodation_numeric_item_sources");
    expect(result.sourceEvidenceHash).toBe(candidate.source.evidenceHash);
  });

  test("tenant identifiers and tenant-named fields are absent recursively from accepted output", () => {
    const result = composeIndiaIrpAccommodationNumericItemSources(input());
    const visit = (value: unknown): void => {
      if (typeof value === "string") {
        expect(value).not.toBe(TENANT);
        return;
      }
      if (value === null || typeof value !== "object") return;
      for (const nested of Object.values(value)) visit(nested);
    };
    visit(result);
  });
});

function b2bInput(
  source = makeSource(),
  tenantId = TENANT,
): IndiaIrpOrdinaryRegisteredB2bSupplyTypeInput {
  return deepFreeze({ tenantId, source });
}

function expectB2bRejected(value: IndiaIrpOrdinaryRegisteredB2bSupplyTypeInput): void {
  expect(() => composeIndiaIrpOrdinaryRegisteredB2bSupplyType(value)).toThrow();
}

function rehashNestedAndSource(
  mutator: (source: MutableRecord) => void,
  nested: "componentFamily" | "supplyNatureAtTimeOfSupply" | null = null,
): IndiaIrpOrdinaryRegisteredB2bSupplyTypeInput {
  const source = clone(makeSource()) as unknown as MutableRecord;
  mutator(source);
  if (nested !== null) {
    const { evidenceHash: _old, ...body } = source[nested];
    source[nested] = { ...body, evidenceHash: digest({ tenantId: TENANT, ...body }) };
  }
  return b2bInput(rehashSource(deepFreeze(source) as IndiaIrpAccommodationSourceResult));
}

describe("Order 415 India IRP ordinary registered B2B supply-type composition", () => {
  test("golden ordinary registered intra-State SGST/UTGST and inter-State IGST return only exact B2B truth", () => {
    for (const family of ["cgst_sgst", "cgst_utgst", "igst"] as const) {
      const raw = b2bInput(makeSource({ family }));
      const before = JSON.stringify(raw);
      const first = composeIndiaIrpOrdinaryRegisteredB2bSupplyType(raw);
      const second = composeIndiaIrpOrdinaryRegisteredB2bSupplyType(raw);
      expect(Object.keys(first)).toEqual([
        "state", "supplyTypeCode", "sourceEvidenceHash", "evidenceHash",
      ]);
      expect(first).toEqual({
        state: "eligible_irp_ordinary_registered_b2b_supply_type",
        supplyTypeCode: "B2B",
        sourceEvidenceHash: raw.source.evidenceHash,
        evidenceHash: digest({
          tenantId: TENANT,
          state: "eligible_irp_ordinary_registered_b2b_supply_type",
          supplyTypeCode: "B2B",
          sourceEvidenceHash: raw.source.evidenceHash,
        }),
      });
      expect(first).toEqual(second);
      expect(JSON.stringify(raw)).toBe(before);
      expect(Object.isFrozen(first)).toBeTrue();
      expect(JSON.stringify(first)).not.toContain(TENANT);
    }
  });

  test("tenant changes only tenant-bound evidence and is recursively absent", () => {
    const first = composeIndiaIrpOrdinaryRegisteredB2bSupplyType(b2bInput());
    const other = composeIndiaIrpOrdinaryRegisteredB2bSupplyType(
      b2bInput(makeSource({}, OTHER_TENANT), OTHER_TENANT),
    );
    expect({ state: first.state, supplyTypeCode: first.supplyTypeCode }).toEqual({
      state: other.state,
      supplyTypeCode: other.supplyTypeCode,
    });
    expect(first.sourceEvidenceHash).not.toBe(other.sourceEvidenceHash);
    expect(first.evidenceHash).not.toBe(other.evidenceHash);
    expect(JSON.stringify(other)).not.toContain(OTHER_TENANT);
  });

  test("SEZ/export/deemed-export/unregistered-like and embedded caller supply-type authority fail closed", () => {
    const cases: readonly [((source: MutableRecord) => void), "componentFamily" | "supplyNatureAtTimeOfSupply" | null][] = [
      [(source) => { source.componentFamily.sezDirection = "to_sez"; }, "componentFamily"],
      [(source) => { source.componentFamily.determinationBasis = "sez_override"; }, "componentFamily"],
      [(source) => { source.componentFamily.legalSources.supplyNature = "IGST_ACT_7_5_B"; }, "componentFamily"],
      [(source) => { source.supplyNatureAtTimeOfSupply.sezDirection = "from_sez"; }, "supplyNatureAtTimeOfSupply"],
      [(source) => { source.supplyNatureAtTimeOfSupply.determinationBasis = "sez_override"; }, "supplyNatureAtTimeOfSupply"],
      [(source) => { source.supplyNatureAtTimeOfSupply.legalRule = "IGST_ACT_7_5_B"; }, "supplyNatureAtTimeOfSupply"],
      [(source) => { source.classification.classificationSystem = "HSN"; }, null],
      [(source) => { source.classification.isServiceCode = "N"; }, null],
      [(source) => { source.recipientRegistration.scheme = "unregistered"; }, null],
      [(source) => { source.legalBuyerPartyId = null; }, null],
      [(source) => { source.supplyTypeCode = "SEZWP"; }, null],
      [(source) => { source.SupTyp = "B2B"; }, null],
    ];
    for (const [mutate, nested] of cases) expectB2bRejected(rehashNestedAndSource(mutate, nested));
  });

  test("wrong ordinary nature, legal rule, component family, currency, classification and party lineage fail closed", () => {
    const cases: readonly [((source: MutableRecord) => void), "componentFamily" | "supplyNatureAtTimeOfSupply" | null][] = [
      [(source) => { source.supplyNatureAtTimeOfSupply.supplyNature = "intra_state"; }, "supplyNatureAtTimeOfSupply"],
      [(source) => { source.supplyNatureAtTimeOfSupply.legalRule = "IGST_ACT_8_2"; }, "supplyNatureAtTimeOfSupply"],
      [(source) => { source.componentFamily.componentFamily = "cgst_sgst"; }, "componentFamily"],
      [(source) => { source.componentFamily.legalSources.componentFamily = "CGST_ACT_9_1_AND_SGST_ACT"; }, "componentFamily"],
      [(source) => { source.financialSource.currency = "USD"; }, null],
      [(source) => { source.sellerRegistration.currency = "USD"; }, null],
      [(source) => { source.placeOfSupply.legalRule = "IGST_ACT_12_3_ACCOMMODATION_PROPERTY_LOCATION"; }, null],
      [(source) => { source.supplyNatureAtTimeOfSupply.result = {}; }, "supplyNatureAtTimeOfSupply"],
      [(source) => { source.recipientRegistration.partyId = "ffffffff-ffff-4fff-8fff-ffffffffffff"; }, null],
      [(source) => { source.buyerDetails.lineage.partyId = "ffffffff-ffff-4fff-8fff-ffffffffffff"; }, null],
      [(source) => { source.buyerDetails.payload.BuyerDtls.Gstin = "29AAPFU0939F1ZR"; }, null],
    ];
    for (const [mutate, nested] of cases) expectB2bRejected(rehashNestedAndSource(mutate, nested));
  });

  test("correctly rehashed unsupported export supply nature fails closed", () => {
    const source = clone(makeSource()) as unknown as MutableRecord;
    source.supplyNatureAtTimeOfSupply.supplyNature = "export";
    source.componentFamily.supplyNature = "export";
    for (const key of ["supplyNatureAtTimeOfSupply", "componentFamily"] as const) {
      const { evidenceHash: _old, ...body } = source[key];
      source[key] = { ...body, evidenceHash: digest({ tenantId: TENANT, ...body }) };
    }
    expectB2bRejected(b2bInput(
      rehashSource(deepFreeze(source) as IndiaIrpAccommodationSourceResult),
    ));
  });

  test("exact Order414 validation remains the admission gate for hostile graph and hash drift", () => {
    expectB2bRejected({ tenantId: TENANT, source: makeSource() });
    expectB2bRejected(deepFreeze({ tenantId: TENANT, source: new Proxy(makeSource(), {}) }));

    const surplus = clone(b2bInput()) as unknown as MutableRecord;
    surplus.source.extra = true;
    surplus.source = rehashSource(deepFreeze(surplus.source) as IndiaIrpAccommodationSourceResult);
    expectB2bRejected(deepFreeze(surplus) as IndiaIrpOrdinaryRegisteredB2bSupplyTypeInput);

    const stale = clone(b2bInput()) as unknown as MutableRecord;
    stale.source.evidenceHash = "0".repeat(64);
    expectB2bRejected(deepFreeze(stale) as IndiaIrpOrdinaryRegisteredB2bSupplyTypeInput);

    const sparse = clone(b2bInput()) as unknown as MutableRecord;
    sparse.source.financialSource.roomNights.length = 2;
    expectB2bRejected(deepFreeze(sparse) as IndiaIrpOrdinaryRegisteredB2bSupplyTypeInput);

    const accessor = { tenantId: TENANT } as MutableRecord;
    Object.defineProperty(accessor, "source", { enumerable: true, get: () => makeSource() });
    Object.freeze(accessor);
    expectB2bRejected(accessor as IndiaIrpOrdinaryRegisteredB2bSupplyTypeInput);

    const symbol = clone(b2bInput()) as unknown as MutableRecord;
    Object.defineProperty(symbol, Symbol("authority"), { value: "B2B", enumerable: true });
    expectB2bRejected(deepFreeze(symbol) as IndiaIrpOrdinaryRegisteredB2bSupplyTypeInput);
  });
});
