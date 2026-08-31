import { describe, expect, test } from "bun:test";

import {
  buildIndiaGstAccommodationSupplyNature,
  deriveIndiaGstAccommodationComponentFamily,
} from "../src/contexts/tax-fiscal";

type Mutable = Record<PropertyKey, any>;
type Relationship = "same_state_or_union_territory" | "different_state_or_union_territory";
type Status = "affirmatively_non_sez_regular" | "sez_unit" | "sez_developer";

const id = (suffix: number): string =>
  `00000000-0000-0000-0000-${String(suffix).padStart(12, "0")}`;
const digest = (value: string): string =>
  new Bun.CryptoHasher("sha256").update(value).digest("hex");

const TENANT = id(30801);
const OTHER_TENANT = id(30802);
const PROPERTY = id(30803);
const RESERVATION = id(30804);
const FOLIO = id(30805);
const SUPPLIER_REGISTRATION = id(30806);
const RECIPIENT_PARTY = id(30807);
const RECIPIENT_REGISTRATION = id(30808);
const SERVICE_LOCATION = id(30809);
const SUPPLIER_STATUS = id(30810);
const RECIPIENT_STATUS = id(30811);
const EXTENSION = id(30812);
const CLASSIFICATION = id(30813);
const SUPPLY_DATE = "2039-05-15";

function deepFreeze<T>(value: T, seen = new Set<object>()): T {
  if (typeof value !== "object" || value === null || seen.has(value)) return value;
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) deepFreeze((value as Mutable)[key], seen);
  return Object.freeze(value);
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function jurisdiction() {
  return deepFreeze({
    extensionId: EXTENSION,
    ownerTenantId: TENANT,
    key: "in.order308.gst.27",
    version: "7",
    contentHash: "a".repeat(64),
  });
}

function comparison(relationship: Relationship = "same_state_or_union_territory") {
  const pos = relationship === "same_state_or_union_territory" ? "27" : "29";
  const body = deepFreeze({
    propertyNode: PROPERTY,
    reservationId: RESERVATION,
    folioId: FOLIO,
    jurisdiction: jurisdiction(),
    supplier: deepFreeze({ registrationId: SUPPLIER_REGISTRATION, evidenceHash: "b".repeat(64), stateCode: "27" }),
    recipient: deepFreeze({ partyId: RECIPIENT_PARTY, registrationId: RECIPIENT_REGISTRATION, evidenceHash: "c".repeat(64) }),
    buyerAssociation: deepFreeze({ associationHash: "d".repeat(64), payloadHash: "e".repeat(64) }),
    classification: deepFreeze({ classificationId: CLASSIFICATION, evidenceHash: "f".repeat(64) }),
    placeOfSupply: deepFreeze({ candidateHash: "1".repeat(64), legalRule: "IGST_ACT_12_3_B", pos }),
    comparisonRule: "SUPPLIER_REGISTERED_STATE_VS_ACCOMMODATION_POS",
    stateRelationship: relationship,
  });
  return deepFreeze({
    ...body,
    candidateJson: JSON.stringify(body),
    candidateHash: digest(JSON.stringify({ tenantId: TENANT, candidate: body })),
  });
}

function serviceLocation() {
  const body = {
    supplierServiceLocationId: SERVICE_LOCATION,
    propertyNode: PROPERTY,
    jurisdiction: jurisdiction(),
    supplier: deepFreeze({ registrationId: SUPPLIER_REGISTRATION, evidenceHash: "b".repeat(64) }),
    serviceScope: "lodging_accommodation",
    registeredPlace: deepFreeze({ kind: "principal_place_of_business", stateCode: "27", addressLine: "1 Marine Drive", locality: "Mumbai", postalCode: "400001" }),
    locationBasis: "supply_made_from_registered_place_of_business",
    legalRule: "IGST_ACT_2_15_A",
  };
  return deepFreeze({ ...body, evidenceHash: digest(JSON.stringify({ tenantId: TENANT, ...body })) });
}

function approval(status: Status, side: "supplier" | "recipient") {
  if (status === "affirmatively_non_sez_regular") return null;
  return deepFreeze({
    form: status === "sez_unit" ? "sez_rules_form_g" : "sez_rules_form_b",
    reference: `LOA/${side}/2039`,
    validity: deepFreeze({ fromInclusive: "2039-01-01", toExclusive: "2040-01-01" }),
    status: "in_force",
    evidenceSha256: side === "supplier" ? "2".repeat(64) : "3".repeat(64),
  });
}

function statusRoot(kind: "supplier" | "recipient", status: Status) {
  const supplier = kind === "supplier";
  const body = supplier
    ? {
      supplierSezStatusId: SUPPLIER_STATUS,
      propertyNode: PROPERTY,
      supplierServiceLocation: deepFreeze({ id: SERVICE_LOCATION, evidenceHash: serviceLocation().evidenceHash }),
      supplier: deepFreeze({ registrationId: SUPPLIER_REGISTRATION, evidenceHash: "b".repeat(64) }),
      statusAsOf: SUPPLY_DATE,
      gstRegistration: deepFreeze({ status: "active", taxpayerType: status === "affirmatively_non_sez_regular" ? "regular" : status, source: "gst_common_portal", evidenceSha256: "5".repeat(64) }),
      sezStatus: status,
      approval: approval(status, "supplier"),
      legalRule: "IGST_ACT_7_5_B_AND_8_2_SUPPLIER_STATUS",
    }
    : {
      recipientSezStatusId: RECIPIENT_STATUS,
      recipient: deepFreeze({ partyId: RECIPIENT_PARTY, registrationId: RECIPIENT_REGISTRATION, evidenceHash: "c".repeat(64) }),
      statusAsOf: SUPPLY_DATE,
      gstRegistration: deepFreeze({ status: "active", taxpayerType: status === "affirmatively_non_sez_regular" ? "regular" : status, source: "gst_common_portal", evidenceSha256: "4".repeat(64) }),
      sezStatus: status,
      approval: approval(status, "recipient"),
      legalRule: "IGST_ACT_7_5_B_AND_8_2_RECIPIENT_STATUS",
    };
  return deepFreeze({ ...body, evidenceHash: digest(JSON.stringify({ tenantId: TENANT, ...body })) });
}

function upstream(
  relationship: Relationship = "same_state_or_union_territory",
  supplierSez: Status = "affirmatively_non_sez_regular",
  recipientSez: Status = "affirmatively_non_sez_regular",
): Mutable {
  return buildIndiaGstAccommodationSupplyNature({
    tenantId: TENANT,
    supplyDate: SUPPLY_DATE,
    registeredStateComparison: comparison(relationship),
    supplierServiceLocation: serviceLocation(),
    recipientSezStatus: statusRoot("recipient", recipientSez),
    supplierSezStatus: statusRoot("supplier", supplierSez),
  } as never) as Mutable;
}

function input(supplyNature: unknown = upstream(), tenantId = TENANT): Mutable {
  return { tenantId, supplyNature };
}

function rehashCandidate(value: Mutable): void {
  const { candidateJson: _candidateJson, candidateHash: _candidateHash, ...candidate } = value;
  value.candidateJson = JSON.stringify(candidate);
  value.candidateHash = digest(JSON.stringify({ tenantId: TENANT, candidate }));
}

function expectError(value: unknown): void {
  expect(() => deriveIndiaGstAccommodationComponentFamily(value as never)).toThrow();
}

function derive(value: unknown): Mutable {
  return deriveIndiaGstAccommodationComponentFamily(value as never) as Mutable;
}

function deeplyFrozen(value: unknown, seen = new Set<object>()): void {
  if (typeof value !== "object" || value === null || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBeTrue();
  for (const key of Reflect.ownKeys(value)) deeplyFrozen((value as Mutable)[key], seen);
}

describe("Order 308: India GST accommodation component family", () => {
  test("derives IGST for inter-State supply and every SEZ direction", () => {
    expect(derive(input(upstream("different_state_or_union_territory"))).componentFamily).toBe("igst");
    for (const [supplier, recipient] of [
      ["sez_unit", "affirmatively_non_sez_regular"],
      ["affirmatively_non_sez_regular", "sez_developer"],
      ["sez_unit", "sez_developer"],
    ] as const) {
      const result = derive(input(upstream("same_state_or_union_territory", supplier, recipient)));
      expect(result.componentFamily).toBe("igst");
    }
  });

  test("derives CGST plus SGST for ordinary intra-State State-side codes, including 01, 07 and 34", () => {
    for (const stateCode of ["01", "07", "34"] as const) {
      const nature = clone(upstream());
      nature.supplier.stateCode = stateCode;
      nature.supplier.serviceLocation.stateCode = stateCode;
      nature.placeOfSupply.pos = stateCode;
      nature.registeredStateComparison.stateRelationship = "same_state_or_union_territory";
      rehashCandidate(nature);
      const result = derive(input(deepFreeze(nature)));
      expect(result.componentFamily).toBe("cgst_sgst");
    }
  });

  test("derives CGST plus UTGST for exactly codes 04, 26, 31, 35 and 38", () => {
    for (const stateCode of ["04", "26", "31", "35", "38"] as const) {
      const nature = clone(upstream());
      nature.supplier.stateCode = stateCode;
      nature.supplier.serviceLocation.stateCode = stateCode;
      nature.placeOfSupply.pos = stateCode;
      nature.registeredStateComparison.stateRelationship = "same_state_or_union_territory";
      rehashCandidate(nature);
      const result = derive(input(deepFreeze(nature)));
      expect(result.componentFamily).toBe("cgst_utgst");
    }
  });

  test("accepts exactly tenantId and supplyNature and rejects caller-selected component/rate/amount authority", () => {
    const valid = input();
    for (const candidate of [
      null,
      [],
      { ...valid, componentFamily: "igst" },
      { ...valid, component: "cgst_utgst" },
      { ...valid, rate: 0.18 },
      { ...valid, taxRate: 0.18 },
      { ...valid, amount: 100 },
      { ...valid, taxableValue: 100 },
      { ...valid, components: ["igst"] },
      { ...valid, route: "igst" },
      { tenantId: TENANT },
      { supplyNature: valid.supplyNature },
      { ...valid, [Symbol("hostile")]: true },
      new Proxy(valid, {}),
    ]) expectError(candidate);
    const accessor = { ...valid };
    Object.defineProperty(accessor, "tenantId", { enumerable: true, get: () => TENANT });
    expectError(accessor);
  });

  test("rejects tenant, candidate hash and every property/stay/jurisdiction/identity/state/nature/basis/direction/rule crossing", () => {
    const mutants: Array<(value: Mutable) => void> = [
      (value) => { value.tenantId = OTHER_TENANT; },
      (value) => { value.supplyNature.propertyNode = id(30890); },
      (value) => { value.supplyNature.reservationId = id(30891); },
      (value) => { value.supplyNature.folioId = id(30892); },
      (value) => { value.supplyNature.supplyDate = "2039-05-16"; },
      (value) => { value.supplyNature.jurisdiction.extensionId = id(30893); },
      (value) => { value.supplyNature.jurisdiction.version = "8"; },
      (value) => { value.supplyNature.jurisdiction.contentHash = "0".repeat(64); },
      (value) => { value.supplyNature.supplier.registrationId = id(30894); },
      (value) => { value.supplyNature.supplier.stateCode = "29"; },
      (value) => { value.supplyNature.supplier.serviceLocation.id = id(30895); },
      (value) => { value.supplyNature.recipient.partyId = id(30896); },
      (value) => { value.supplyNature.placeOfSupply.pos = "29"; },
      (value) => { value.supplyNature.placeOfSupply.legalRule = "CALLER_RULE"; },
      (value) => { value.supplyNature.registeredStateComparison.stateRelationship = "different_state_or_union_territory"; },
      (value) => { value.supplyNature.supplyNature = "inter_state"; },
      (value) => { value.supplyNature.determinationBasis = "sez_override"; },
      (value) => { value.supplyNature.sezDirection = "to_sez"; },
      (value) => { value.supplyNature.legalRule = "IGST_ACT_7_5_B"; },
      (value) => { value.supplyNature.candidateHash = "0".repeat(64); },
    ];
    for (const mutate of mutants) {
      const candidate = clone(input());
      mutate(candidate);
      expectError(candidate);
    }
  });

  test("rejects fully recomputed public-hash semantic crossings and incomplete/thawed upstream evidence", () => {
    for (const mutate of [
      (value: Mutable) => { value.placeOfSupply.pos = "29"; value.registeredStateComparison.stateRelationship = "different_state_or_union_territory"; },
      (value: Mutable) => { value.legalRule = "IGST_ACT_7_3"; },
    ]) {
      const nature = clone(upstream());
      mutate(nature);
      rehashCandidate(nature);
      expectError(input(deepFreeze(nature)));
    }
    const thawed = clone(upstream());
    expectError(input(thawed));
    const missing = clone(upstream());
    delete missing.candidateJson;
    expectError(input(deepFreeze(missing)));
  });

  test("rejects hostile proxies, accessors and symbols at top-level and every nested evidence boundary", () => {
    const topProxy = input(new Proxy(upstream(), {}));
    expectError(topProxy);
    for (const name of ["supplier", "recipient", "jurisdiction", "placeOfSupply"] as const) {
      const candidate = clone(upstream());
      candidate[name] = new Proxy(candidate[name], {});
      expectError(input(candidate));
    }
    const accessor = clone(upstream());
    Object.defineProperty(accessor.supplier, "stateCode", { enumerable: true, get: () => "27" });
    expectError(input(accessor));
    const symbolic = clone(upstream());
    symbolic.placeOfSupply[Symbol("hostile")] = true;
    expectError(input(symbolic));
    const proxyArray = clone(upstream());
    proxyArray.supplier.serviceLocation = new Proxy(proxyArray.supplier.serviceLocation, {});
    expectError(input(proxyArray));
  });

  test("returns recursively frozen, tenant-hidden, byte-stable evidence whose hash binds lineage", () => {
    const first = derive(input());
    const replay = derive(input());
    deeplyFrozen(first);
    expect(first).toEqual(replay);
    expect(JSON.stringify(first)).toBe(JSON.stringify(replay));
    expect(first.evidenceHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(first)).not.toContain(TENANT);
    expect(JSON.stringify(first)).not.toContain("tenantId");
    expect(first).not.toHaveProperty("taxRate");
    expect(first).not.toHaveProperty("taxAmount");
    expect(first).not.toHaveProperty("amount");
    const alternate = upstream("different_state_or_union_territory");
    const changed = derive(input(alternate));
    expect(changed.evidenceHash).not.toBe(first.evidenceHash);
    expect(changed.predecessorCandidateHash ?? changed.candidateHash).toBeTruthy();
  });

  test("contains no SQL, persistence, amount, document or downstream IRP authority", async () => {
    const source = await Bun.file(new URL(
      "../src/contexts/tax-fiscal/india-gst-accommodation-component-family.ts",
      import.meta.url,
    )).text();
    expect(source).not.toMatch(/\b(?:Tx|SQL|Database|postgres|SELECT\s+.+\s+FROM|INSERT\s+INTO|DELETE\s+FROM|UPDATE\s+\S+\s+SET|LOCK\s+TABLE)\b/i);
    expect(source).not.toMatch(/Date\.now|new Date|current_date|fetch\s*\(|ORDER BY|latest/i);
    expect(source).not.toMatch(/taxRate|taxAmount|taxableValue|document|journal|posting|fiscal_submission|IRP|SupTyp|ItemList/i);
  });
});
