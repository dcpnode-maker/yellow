import { describe, expect, test } from "bun:test";

import {
  IndiaGstAccommodationHistoricalResolutionService,
  buildIndiaGstAccommodationSupplyNature,
  deriveIndiaGstAccommodationComponentFamily,
  deriveIndiaGstAccommodationLevyInputBundle,
} from "../src/contexts/tax-fiscal";

type Mutable = Record<PropertyKey, any>;
type Family = "igst" | "cgst_sgst" | "cgst_utgst";

const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const TENANT = id(30901), OTHER_TENANT = id(30902), PROPERTY = id(30903);
const RESERVATION = id(30904), FOLIO = id(30905), SUPPLIER = id(30906);
const RECIPIENT = id(30907), RECIPIENT_REG = id(30908), SERVICE = id(30909);
const SUPPLIER_STATUS = id(30910), RECIPIENT_STATUS = id(30911), CLASSIFICATION = id(30912);
const PREDECESSOR = "a806f516-fed6-5768-b310-94aa03286adb";
const SUCCESSOR = "0b21daf2-ea6e-5568-9c21-69e4d4424574";
const KEY = "in-gst-lodging";
const CUTOVER = "2025-09-21T18:30:00.000000Z";
const PRE_FROM = "2022-07-17T18:30:00.000000Z";

const predecessorContent = () => ({ country: "IN", price_display: "tax_exclusive", rounding: "document", taxes: [
  { code: "GST_ROOM", name: "GST on accommodation", mode: "slab_percent", slab_basis: "transaction_value", applies_to: ["room_revenue"], slabs: [
    { upto_minor: 750000, rate: 0.12, itc_eligible: true }, { upto_minor: null, rate: 0.18, itc_eligible: true },
  ] },
  { code: "GST_FNB", name: "GST on F&B (restaurant in hotel)", mode: "percent", rate: 0.05, applies_to: ["fnb_revenue"] },
] });
const successorContent = () => ({ country: "IN", price_display: "tax_exclusive", rounding: "document", taxes: [
  { code: "GST_ROOM", name: "GST on accommodation", mode: "slab_percent", slab_basis: "transaction_value", applies_to: ["room_revenue"], slabs: [
    { upto_minor: 750000, rate: 0.05, itc_eligible: false }, { upto_minor: null, rate: 0.18, itc_eligible: true },
  ] },
  { code: "GST_FNB", name: "GST on F&B (restaurant in hotel)", mode: "percent", rate: 0.05, applies_to: ["fnb_revenue"] },
] });
const extension = (extensionId: string, version: number, status: string, content: unknown) =>
  ({ id: extensionId, tenantId: null, type: "tax_jurisdiction", key: KEY, version, content, status });

function canonical(value: any): string {
  if (value === null || typeof value !== "object") return JSON.stringify(Object.is(value, -0) ? 0 : value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
}
const digestCanonical = (value: unknown) => new Bun.CryptoHasher("sha256").update(canonical(value)).digest("hex");
const digest = (value: unknown) => new Bun.CryptoHasher("sha256").update(JSON.stringify(value)).digest("hex");
function freeze<T>(value: T, seen = new Set<object>()): T {
  if (typeof value !== "object" || value === null || seen.has(value)) return value;
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) freeze((value as Mutable)[key], seen);
  return Object.freeze(value);
}

async function historical(day: "2025-09-21" | "2025-09-22" = "2025-09-22") {
  const predecessorDay = day === "2025-09-21";
  const state = {
    property: { tenant_id: TENANT, property_timezone: "Asia/Kolkata", business_day_from_instant: predecessorDay ? "2025-09-20T18:30:00.000000Z" : CUTOVER, business_day_to_instant: predecessorDay ? CUTOVER : "2025-09-22T18:30:00.000000Z" },
    assignments: [{ jurisdiction_key: KEY, effective_from: "2020-01-01", effective_to: null }],
    visible: [extension(PREDECESSOR, 1, "retired", predecessorContent()), extension(SUCCESSOR, 2, "active", successorContent())],
    periods: {
      [PREDECESSOR]: { extensionId: PREDECESSOR, ownerTenantId: null, effectiveFromInstant: PRE_FROM, effectiveToInstant: CUTOVER },
      [SUCCESSOR]: { extensionId: SUCCESSOR, ownerTenantId: null, effectiveFromInstant: CUTOVER, effectiveToInstant: null },
    } as Mutable,
  };
  const tx = (async (strings: TemplateStringsArray) => {
    const sql = strings.join("?");
    if (/FROM\s+(?:public\.)?org_node/i.test(sql)) return /property_timezone/i.test(sql) ? [state.property] : [{ tenant_id: TENANT }];
    if (/FROM\s+(?:public\.)?tax_assignment/i.test(sql)) return state.assignments;
    throw new Error(`unexpected SQL: ${sql}`);
  }) as never;
  const registry = {
    async listVisible(tenantId: string) { expect(tenantId).toBe(TENANT); return state.visible; },
    async readVisibleEffectivePeriod(tenantId: string, extensionId: string) { expect(tenantId).toBe(TENANT); return state.periods[extensionId]; },
  };
  return new IndiaGstAccommodationHistoricalResolutionService(registry).resolve(tx, { propertyNode: PROPERTY, businessDate: day });
}

function status(kind: "supplier" | "recipient", date: string, serviceHash = "6".repeat(64)) {
  const supplier = kind === "supplier";
  const body = supplier ? {
    supplierSezStatusId: SUPPLIER_STATUS, propertyNode: PROPERTY,
    supplierServiceLocation: freeze({ id: SERVICE, evidenceHash: serviceHash }),
    supplier: freeze({ registrationId: SUPPLIER, evidenceHash: "b".repeat(64) }), statusAsOf: date,
    gstRegistration: freeze({ status: "active", taxpayerType: "regular", source: "gst_common_portal", evidenceSha256: "5".repeat(64) }),
    sezStatus: "affirmatively_non_sez_regular", approval: null, legalRule: "IGST_ACT_7_5_B_AND_8_2_SUPPLIER_STATUS",
  } : {
    recipientSezStatusId: RECIPIENT_STATUS,
    recipient: freeze({ partyId: RECIPIENT, registrationId: RECIPIENT_REG, evidenceHash: "c".repeat(64) }), statusAsOf: date,
    gstRegistration: freeze({ status: "active", taxpayerType: "regular", source: "gst_common_portal", evidenceSha256: "4".repeat(64) }),
    sezStatus: "affirmatively_non_sez_regular", approval: null, legalRule: "IGST_ACT_7_5_B_AND_8_2_RECIPIENT_STATUS",
  };
  return freeze({ ...body, evidenceHash: digest({ tenantId: TENANT, ...body }) });
}
function nature(history: Mutable, family: Family): Mutable {
  const selected = history.selectedExtension;
  const state = family === "cgst_utgst" ? "04" : "27";
  const pos = family === "igst" ? "29" : state;
  const jurisdiction = () => freeze({ extensionId: selected.extensionId, ownerTenantId: TENANT, key: selected.key, version: String(selected.version), contentHash: selected.contentHash });
  const comparisonBody = freeze({ propertyNode: PROPERTY, reservationId: RESERVATION, folioId: FOLIO, jurisdiction: jurisdiction(),
    supplier: freeze({ registrationId: SUPPLIER, evidenceHash: "b".repeat(64), stateCode: state }),
    recipient: freeze({ partyId: RECIPIENT, registrationId: RECIPIENT_REG, evidenceHash: "c".repeat(64) }),
    buyerAssociation: freeze({ associationHash: "d".repeat(64), payloadHash: "e".repeat(64) }),
    classification: freeze({ classificationId: CLASSIFICATION, evidenceHash: "f".repeat(64) }),
    placeOfSupply: freeze({ candidateHash: "1".repeat(64), legalRule: "IGST_ACT_12_3_B", pos }),
    comparisonRule: "SUPPLIER_REGISTERED_STATE_VS_ACCOMMODATION_POS",
    stateRelationship: family === "igst" ? "different_state_or_union_territory" : "same_state_or_union_territory" });
  const comparison = freeze({ ...comparisonBody, candidateJson: JSON.stringify(comparisonBody), candidateHash: digest({ tenantId: TENANT, candidate: comparisonBody }) });
  const serviceBody = { supplierServiceLocationId: SERVICE, propertyNode: PROPERTY, jurisdiction: jurisdiction(),
    supplier: freeze({ registrationId: SUPPLIER, evidenceHash: "b".repeat(64) }), serviceScope: "lodging_accommodation",
    registeredPlace: freeze({ kind: "principal_place_of_business", stateCode: state, addressLine: "1 Marine Drive", locality: "Mumbai", postalCode: "400001" }),
    locationBasis: "supply_made_from_registered_place_of_business", legalRule: "IGST_ACT_2_15_A" };
  const serviceLocation = freeze({ ...serviceBody, evidenceHash: digest({ tenantId: TENANT, ...serviceBody }) });
  return buildIndiaGstAccommodationSupplyNature({ tenantId: TENANT, supplyDate: history.businessDay.businessDate,
    registeredStateComparison: comparison, supplierServiceLocation: serviceLocation,
    recipientSezStatus: status("recipient", history.businessDay.businessDate), supplierSezStatus: status("supplier", history.businessDay.businessDate, serviceLocation.evidenceHash) } as never) as Mutable;
}
function component(history: Mutable, family: Family, supplyNature = nature(history, family)): Mutable {
  return deriveIndiaGstAccommodationComponentFamily({ tenantId: TENANT, supplyNature } as never) as Mutable;
}
function bundleInput(history: unknown, supplyNature: unknown, family: unknown, tenantId = TENANT) {
  return { tenantId, historicalResolution: history, supplyNature, componentFamily: family };
}
const input = (history: Mutable, family: Mutable, tenantId = TENANT, supplyNature = nature(history, family.componentFamily as Family)) =>
  bundleInput(history, supplyNature, family, tenantId);
const derive = (value: unknown) => deriveIndiaGstAccommodationLevyInputBundle(value as never) as Mutable;
const reject = (value: unknown) => expect(() => derive(value)).toThrow();
function deeplyFrozen(value: unknown, seen = new Set<object>()): void {
  if (typeof value !== "object" || value === null || seen.has(value)) return;
  seen.add(value); expect(Object.isFrozen(value)).toBeTrue();
  for (const key of Reflect.ownKeys(value)) deeplyFrozen((value as Mutable)[key], seen);
}
function rehashComponent(value: Mutable, tenantId = TENANT): void {
  const { evidenceHash: _old, ...body } = value;
  value.evidenceHash = digest({ tenantId, ...body });
}
function rehashNature(value: Mutable): void {
  const { candidateJson: _json, candidateHash: _hash, ...candidate } = value;
  value.candidateJson = JSON.stringify(candidate);
  value.candidateHash = digest({ tenantId: TENANT, candidate });
}
function rehashPair(value: Mutable): void {
  const { evidenceHash: _old, ...body } = value.rateVersionPair;
  value.rateVersionPair.evidenceHash = digestCanonical({ tenantId: TENANT, predecessorOwnerTenantId: null, successorOwnerTenantId: null, ...body });
}
function rehashHistory(value: Mutable): void {
  const { evidenceHash: _old, ...body } = value;
  value.evidenceHash = digestCanonical({ tenantId: TENANT, ...body });
}

describe("Order 309: India GST accommodation levy-input bundle", () => {
  test("binds predecessor and successor civil days to all three approved component families", async () => {
    for (const day of ["2025-09-21", "2025-09-22"] as const) for (const family of ["igst", "cgst_sgst", "cgst_utgst"] as const) {
      const history = await historical(day) as Mutable;
      const result = derive(input(history, component(history, family)));
      expect(result.componentFamily).toBe(family);
      expect(result.supplyDate).toBe(day);
      expect(result.selectedVersion.version).toBe(day === "2025-09-21" ? 1 : 2);
      expect(result.gstRoomSlabs).toEqual(history.selectedExtension.gstRoomSlabs);
    }
  });

  test("preserves exact aggregate threshold, rates, ITC, nil absence, statutory sources and predecessor hashes", async () => {
    for (const day of ["2025-09-21", "2025-09-22"] as const) {
      const history = await historical(day) as Mutable;
      const family = component(history, "igst");
      const result = derive(input(history, family));
      const text = JSON.stringify(result);
      expect(text).toContain("750000"); expect(text).toContain("0.18");
      expect(text).toContain(day === "2025-09-21" ? "0.12" : "0.05");
      expect(text).toContain(day === "2025-09-21" ? '"itcEligible":true' : '"itcEligible":false');
      expect(text).toContain('"uptoMinor":null');
      expect(text).toContain(history.evidenceHash); expect(text).toContain(family.evidenceHash);
      expect(result.legalSources.supplyNature).toBe(family.legalSources.supplyNature);
      expect(result.legalSources.componentFamily).toBe(family.legalSources.componentFamily);
      expect(result.predecessorHashes.historicalResolution).toBe(history.evidenceHash);
      expect(result.predecessorHashes.componentFamily).toBe(family.evidenceHash);
    }
  });

  test("accepts exactly the four-field input and rejects surplus rate, value, amount, split and calendar authority", async () => {
    const history = await historical() as Mutable, family = component(history, "cgst_sgst");
    const supply = nature(history, "cgst_sgst");
    for (const candidate of [null, [], { historicalResolution: history, supplyNature: supply, componentFamily: family }, { tenantId: TENANT, supplyNature: supply, componentFamily: family },
      { tenantId: TENANT, historicalResolution: history }, new Proxy(input(history, family), {}),
      { ...input(history, family), [Symbol("hostile")]: true },
      ...["rate", "taxRate", "taxableValue", "value", "amount", "taxAmount", "rounding", "residual", "components", "split", "section14", "calendar", "paymentDate", "invoiceDate"].map((key) => ({ ...input(history, family), [key]: 1 })),
    ]) reject(candidate);
    const accessor = input(history, family) as Mutable;
    Object.defineProperty(accessor, "tenantId", { enumerable: true, get: () => TENANT }); reject(accessor);
  });

  test("fails closed on tenant, property, date and selected jurisdiction identity crossings, including rehashed evidence", async () => {
    const history = await historical() as Mutable, baseNature = nature(history, "igst"), baseFamily = component(history, "igst", baseNature);
    reject(input(history, baseFamily, OTHER_TENANT));
    for (const mutate of [
      (value: Mutable) => { value.propertyNode = id(30990); },
      (value: Mutable) => { value.supplyDate = "2025-09-23"; },
      (value: Mutable) => { value.jurisdiction.extensionId = id(30991); },
      (value: Mutable) => { value.jurisdiction.key = "in-other"; },
      (value: Mutable) => { value.jurisdiction.version = "1"; },
      (value: Mutable) => { value.jurisdiction.contentHash = "0".repeat(64); },
      (value: Mutable) => {
        value.componentFamily = "cgst_sgst";
        value.supplyNature = "intra_state";
        value.legalSources.supplyNature = "IGST_ACT_8_2";
        value.legalSources.componentFamily = "CGST_ACT_9_1_AND_SGST_ACT";
      },
    ]) {
      const family = structuredClone(baseFamily); mutate(family); rehashComponent(family); reject(input(history, freeze(family), TENANT, baseNature));
    }
    const reordered = structuredClone(baseFamily);
    const { evidenceHash: _old, propertyNode, ...rest } = reordered;
    const reorderedBody = { ...rest, propertyNode };
    const reorderedFamily = freeze({
      ...reorderedBody,
      evidenceHash: digest({ tenantId: TENANT, ...reorderedBody }),
    });
    reject(input(history, reorderedFamily, TENANT, baseNature));
  });

  test("revalidates selected member, exact pair and both predecessor evidence hashes after full public rehash", async () => {
    const original = await historical() as Mutable, family = component(original, "igst");
    for (const mutate of [
      (history: Mutable) => { history.selectedExtension = history.rateVersionPair.predecessor; },
      (history: Mutable) => { history.selectedExtension.gstRoomSlabs[0].rate = 0.12; },
      (history: Mutable) => { history.rateVersionPair.successor.gstRoomSlabs[0].itcEligible = true; },
      (history: Mutable) => { history.rateVersionPair.statutoryLowerBandDelta.successorHasNilBand = true; },
      (history: Mutable) => { history.rateVersionPair.sourceHashes.notification15_2025 = "0".repeat(64); },
      (history: Mutable) => { history.rateVersionPair.evidenceHash = "1".repeat(64); },
      (history: Mutable) => { history.evidenceHash = "2".repeat(64); },
    ]) {
      const history = structuredClone(original); mutate(history);
      if (history.rateVersionPair.evidenceHash !== "1".repeat(64)) rehashPair(history);
      if (history.evidenceHash !== "2".repeat(64)) rehashHistory(history);
      reject(input(freeze(history), family));
    }
  });

  test("reaches D-850 taxpayer-type versus SEZ-status ancestry through supplied nature", async () => {
    const history = await historical() as Mutable, supply = nature(history, "igst"), family = component(history, "igst", supply);
    for (const side of ["supplier", "recipient"] as const) {
      const hostile = structuredClone(supply);
      hostile[side].status.taxpayerType = "regular";
      hostile[side].status.sezStatus = "sez_unit";
      rehashNature(hostile);
      reject(bundleInput(history, freeze(hostile), family));
    }
  });

  test("rejects thawed, proxy, accessor, symbol and surplus shapes at every nested boundary", async () => {
    const history = await historical() as Mutable, supply = nature(history, "cgst_utgst"), family = component(history, "cgst_utgst", supply);
    reject(input(structuredClone(history), family)); reject(input(history, structuredClone(family)));
    reject(bundleInput(history, structuredClone(supply), family));
    reject(bundleInput(history, new Proxy(supply, {}), family));
    for (const [root, path] of [[history, "selectedExtension"], [history, "rateVersionPair"], [history, "businessDay"], [family, "jurisdiction"], [family, "legalSources"]] as const) {
      const candidate = structuredClone(root); candidate[path] = new Proxy(candidate[path], {}); freeze(candidate);
      reject(root === history ? input(candidate, family) : input(history, candidate));
    }
    const symbolic = structuredClone(history); symbolic.selectedExtension[Symbol("hostile")] = true; freeze(symbolic); reject(input(symbolic, family));
    const accessor = structuredClone(family); Object.defineProperty(accessor.jurisdiction, "version", { enumerable: true, get: () => "2" }); freeze(accessor); reject(input(history, accessor));
    const surplus = structuredClone(history); surplus.selectedExtension.rate = 0.18; freeze(surplus); reject(input(surplus, family));
  });

  test("returns exact recursively frozen, tenant-hidden, byte-stable evidence", async () => {
    const history = await historical() as Mutable, family = component(history, "igst");
    const first = derive(input(history, family)), replay = derive(input(history, family));
    deeplyFrozen(first); expect(first).toEqual(replay); expect(JSON.stringify(first)).toBe(JSON.stringify(replay));
    expect(first.evidenceHash).toMatch(/^[0-9a-f]{64}$/);
    const text = JSON.stringify(first); expect(text).not.toContain(TENANT); expect(text).not.toContain("tenantId");
    expect(Object.keys(first).sort()).toEqual(["propertyNode", "reservationId", "folioId", "supplyDate", "selectedVersion", "gstRoomSlabs", "componentFamily", "legalSources", "predecessorHashes", "evidenceHash"].sort());
  });

  test("contains no persistence, money, splitting, rounding, calendar or downstream authority", async () => {
    const source = await Bun.file(new URL("../src/contexts/tax-fiscal/india-gst-accommodation-levy-input-bundle.ts", import.meta.url)).text();
    expect(source).not.toMatch(/\b(?:Tx|SQL|Database|postgres|SELECT\s+.+\s+FROM|INSERT\s+INTO|DELETE\s+FROM|UPDATE\s+\S+\s+SET|LOCK\s+TABLE)\b/i);
    expect(source).not.toMatch(/taxableValue|taxAmount|amountMinor|minorUnits|componentRate|splitRate|splitAmount|round\w*|residual/i);
    expect(source).not.toMatch(/Section\s*14|paymentReceipt|invoiceIssue|Date\.now|new Date|calendar|document|journal|posting|fiscal_submission|IRP|SupTyp|ItemList|fetch\s*\(/i);
  });
});
