import { describe, expect, test } from "bun:test";

import {
  buildIndiaIrpBuyerDetails,
  buildIndiaIrpSellerDetails,
  composeIndiaIrpAccommodationNumericItemSources,
  type IndiaIrpAccommodationNumericItemSourceInput,
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
  const financialBody = {
    state: "eligible_current_posted_source",
    postingBindingId: "30000000-0000-4000-8000-000000000003",
    journalId: "40000000-0000-4000-8000-000000000004",
    taxId: "50000000-0000-4000-8000-000000000005",
    taxGeneration: 0,
    taxEvidenceHash: "b".repeat(64),
    valuationId: "60000000-0000-4000-8000-000000000006",
    valuationGeneration: 0,
    finalValuationEvidenceHash: "c".repeat(64),
    applicabilityId: "70000000-0000-4000-8000-000000000007",
    applicabilityEvidenceHash: "d".repeat(64),
    reservationId: "80000000-0000-4000-8000-000000000008",
    folioId: "90000000-0000-4000-8000-000000000009",
    guestAccountId: "a0000000-0000-4000-8000-00000000000a",
    propertyNode: "b0000000-0000-4000-8000-00000000000b",
    businessDate: "2044-01-01",
    currency: "INR",
    transactionValueMinor,
    taxMinor,
    grandTotalMinor: (BigInt(transactionValueMinor) + BigInt(taxMinor)).toString(),
    componentFamily: family,
    predecessorHashes: {
      section14: "e".repeat(64),
      levyComponentIdentity: "f".repeat(64),
      reservationLineage: "1".repeat(64),
      attributionSnapshot: "2".repeat(64),
    },
    roomNights,
    components,
    journalLines: [
      {
        id: "02000000-0000-4000-8000-000000000020",
        seq: 1,
        accountId: "03000000-0000-4000-8000-000000000030",
        accountRole: "guest",
        folioId: "90000000-0000-4000-8000-000000000009",
        txCode: "ROOM",
        description: "Accommodation",
        amountMinor: (BigInt(transactionValueMinor) + BigInt(taxMinor)).toString(),
        quantity: "1",
        businessDate: "2044-01-01",
        currency: "INR",
        taxDetail: {
          schemaVersion: "india_accommodation_component_tax_v1",
          tax: {}, valuation: {}, applicability: {}, posting: {}, totals: {},
          componentFamily: family, jurisdiction: {}, revenueRoute: {}, components: [],
        },
      },
      {
        id: "04000000-0000-4000-8000-000000000040",
        seq: 2,
        accountId: "05000000-0000-4000-8000-000000000050",
        accountRole: "revenue",
        folioId: null,
        txCode: "ROOM",
        description: "Accommodation revenue",
        amountMinor: `-${transactionValueMinor}`,
        quantity: "1",
        businessDate: "2044-01-01",
        currency: "INR",
        taxDetail: null,
      },
    ],
  } as const;
  const financialSource = {
    ...financialBody,
    sourceEvidenceHash: digest({ tenantId, ...financialBody }),
  };
  const classification = {
    classificationId: "c0000000-0000-4000-8000-00000000000c",
    propertyNode: financialBody.propertyNode,
    jurisdiction: {
      extensionId: "d0000000-0000-4000-8000-00000000000d",
      ownerTenantId: null,
      key: "in-gst-lodging",
      version: "1",
      contentHash: "3".repeat(64),
    },
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
    legalRule: "IGST_ACT_12_3_ACCOMMODATION_PROPERTY_LOCATION",
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
    result: {},
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
