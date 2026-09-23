import { describe, expect, test } from "bun:test";

import {
  IndiaGstAccommodationSupplyNatureError,
  buildIndiaGstAccommodationSupplyNature,
} from "../src/contexts/tax-fiscal";

const id = (suffix: number): string =>
  `00000000-0000-0000-0000-${String(suffix).padStart(12, "0")}`;
const sha256 = (value: string): string =>
  new Bun.CryptoHasher("sha256").update(value).digest("hex");

const TENANT = id(28701);
const PROPERTY = id(28702);
const RESERVATION = id(28703);
const FOLIO = id(28704);
const SUPPLIER_REGISTRATION = id(28705);
const RECIPIENT_PARTY = id(28706);
const RECIPIENT_REGISTRATION = id(28707);
const SERVICE_LOCATION = id(28708);
const SUPPLIER_STATUS = id(28709);
const RECIPIENT_STATUS = id(28710);
const EXTENSION = id(28711);
const CLASSIFICATION = id(28712);
const SUPPLY_DATE = "2039-05-15";
const CONTENT_HASH = "a".repeat(64);

type Mutable = Record<PropertyKey, unknown>;
type Relationship =
  | "same_state_or_union_territory"
  | "different_state_or_union_territory";
type Status = "affirmatively_non_sez_regular" | "sez_unit" | "sez_developer";

function deepFreeze<T>(value: T, seen = new Set<object>()): T {
  if (typeof value !== "object" || value === null || seen.has(value)) return value;
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) deepFreeze((value as Mutable)[key], seen);
  return Object.freeze(value);
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function jurisdiction(overrides: Record<string, unknown> = {}) {
  return deepFreeze({
    extensionId: EXTENSION,
    ownerTenantId: TENANT,
    key: "in.order287.gst.27",
    version: "7",
    contentHash: CONTENT_HASH,
    ...overrides,
  });
}

function comparison(relationship: Relationship = "same_state_or_union_territory") {
  const pos = relationship === "same_state_or_union_territory" ? "27" : "29";
  const body = deepFreeze({
    propertyNode: PROPERTY,
    reservationId: RESERVATION,
    folioId: FOLIO,
    jurisdiction: jurisdiction(),
    supplier: deepFreeze({
      registrationId: SUPPLIER_REGISTRATION,
      evidenceHash: "b".repeat(64),
      stateCode: "27",
    }),
    recipient: deepFreeze({
      partyId: RECIPIENT_PARTY,
      registrationId: RECIPIENT_REGISTRATION,
      evidenceHash: "c".repeat(64),
    }),
    buyerAssociation: deepFreeze({
      associationHash: "d".repeat(64),
      payloadHash: "e".repeat(64),
    }),
    classification: deepFreeze({
      classificationId: CLASSIFICATION,
      evidenceHash: "f".repeat(64),
    }),
    placeOfSupply: deepFreeze({
      candidateHash: "1".repeat(64),
      legalRule: "IGST_ACT_12_3_B",
      pos,
    }),
    comparisonRule: "SUPPLIER_REGISTERED_STATE_VS_ACCOMMODATION_POS",
    stateRelationship: relationship,
  });
  const candidateJson = JSON.stringify(body);
  return deepFreeze({
    ...body,
    candidateJson,
    candidateHash: sha256(JSON.stringify({ tenantId: TENANT, candidate: body })),
  });
}

function serviceLocation(overrides: Record<string, unknown> = {}) {
  const body = {
    supplierServiceLocationId: SERVICE_LOCATION,
    propertyNode: PROPERTY,
    jurisdiction: jurisdiction(),
    supplier: deepFreeze({
      registrationId: SUPPLIER_REGISTRATION,
      evidenceHash: "b".repeat(64),
    }),
    serviceScope: "lodging_accommodation",
    registeredPlace: deepFreeze({
      kind: "principal_place_of_business",
      stateCode: "27",
      addressLine: "1 Marine Drive",
      locality: "Mumbai",
      postalCode: "400001",
    }),
    locationBasis: "supply_made_from_registered_place_of_business",
    legalRule: "IGST_ACT_2_15_A",
    ...overrides,
  };
  return deepFreeze({
    ...body,
    evidenceHash: sha256(JSON.stringify({ tenantId: TENANT, ...body })),
  });
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

function recipientStatus(
  status: Status = "affirmatively_non_sez_regular",
  overrides: Record<string, unknown> = {},
) {
  const body = {
    recipientSezStatusId: RECIPIENT_STATUS,
    recipient: deepFreeze({
      partyId: RECIPIENT_PARTY,
      registrationId: RECIPIENT_REGISTRATION,
      evidenceHash: "c".repeat(64),
    }),
    statusAsOf: SUPPLY_DATE,
    gstRegistration: deepFreeze({
      status: "active",
      taxpayerType: status === "affirmatively_non_sez_regular" ? "regular" : status,
      source: "gst_common_portal",
      evidenceSha256: "4".repeat(64),
    }),
    sezStatus: status,
    approval: approval(status, "recipient"),
    legalRule: "IGST_ACT_7_5_B_AND_8_2_RECIPIENT_STATUS",
    ...overrides,
  };
  return deepFreeze({
    ...body,
    evidenceHash: sha256(JSON.stringify({ tenantId: TENANT, ...body })),
  });
}

function supplierStatus(
  status: Status = "affirmatively_non_sez_regular",
  overrides: Record<string, unknown> = {},
) {
  const location = serviceLocation();
  const body = {
    supplierSezStatusId: SUPPLIER_STATUS,
    propertyNode: PROPERTY,
    supplierServiceLocation: deepFreeze({
      id: SERVICE_LOCATION,
      evidenceHash: location.evidenceHash,
    }),
    supplier: deepFreeze({
      registrationId: SUPPLIER_REGISTRATION,
      evidenceHash: "b".repeat(64),
    }),
    statusAsOf: SUPPLY_DATE,
    gstRegistration: deepFreeze({
      status: "active",
      taxpayerType: status === "affirmatively_non_sez_regular" ? "regular" : status,
      source: "gst_common_portal",
      evidenceSha256: "5".repeat(64),
    }),
    sezStatus: status,
    approval: approval(status, "supplier"),
    legalRule: "IGST_ACT_7_5_B_AND_8_2_SUPPLIER_STATUS",
    ...overrides,
  };
  return deepFreeze({
    ...body,
    evidenceHash: sha256(JSON.stringify({ tenantId: TENANT, ...body })),
  });
}

function input(
  relationship: Relationship = "same_state_or_union_territory",
  supplierSez: Status = "affirmatively_non_sez_regular",
  recipientSez: Status = "affirmatively_non_sez_regular",
  overrides: Record<string, unknown> = {},
) {
  return {
    tenantId: TENANT,
    supplyDate: SUPPLY_DATE,
    registeredStateComparison: comparison(relationship),
    supplierServiceLocation: serviceLocation(),
    recipientSezStatus: recipientStatus(recipientSez),
    supplierSezStatus: supplierStatus(supplierSez),
    ...overrides,
  };
}

function expected(
  relationship: Relationship,
  supplierSez: Status,
  recipientSez: Status,
) {
  const registered = comparison(relationship);
  const location = serviceLocation();
  const supplierRoot = supplierStatus(supplierSez);
  const recipientRoot = recipientStatus(recipientSez);
  const supplierPositive = supplierSez !== "affirmatively_non_sez_regular";
  const recipientPositive = recipientSez !== "affirmatively_non_sez_regular";
  const sezDirection = supplierPositive && recipientPositive
    ? "to_and_by_sez"
    : recipientPositive
      ? "to_sez"
      : supplierPositive
        ? "by_sez"
        : "none";
  const sez = sezDirection !== "none";
  const ordinarySame = relationship === "same_state_or_union_territory";
  const candidate = {
    propertyNode: PROPERTY,
    reservationId: RESERVATION,
    folioId: FOLIO,
    supplyDate: SUPPLY_DATE,
    jurisdiction: registered.jurisdiction,
    supplier: {
      registrationId: registered.supplier.registrationId,
      evidenceHash: registered.supplier.evidenceHash,
      stateCode: registered.supplier.stateCode,
      serviceLocation: {
        id: location.supplierServiceLocationId,
        evidenceHash: location.evidenceHash,
        kind: location.registeredPlace.kind,
        stateCode: location.registeredPlace.stateCode,
      },
      status: {
        id: supplierRoot.supplierSezStatusId,
        evidenceHash: supplierRoot.evidenceHash,
        statusAsOf: supplierRoot.statusAsOf,
        taxpayerType: supplierRoot.gstRegistration.taxpayerType,
        sezStatus: supplierRoot.sezStatus,
      },
    },
    recipient: {
      partyId: registered.recipient.partyId,
      registrationId: registered.recipient.registrationId,
      evidenceHash: registered.recipient.evidenceHash,
      status: {
        id: recipientRoot.recipientSezStatusId,
        evidenceHash: recipientRoot.evidenceHash,
        statusAsOf: recipientRoot.statusAsOf,
        taxpayerType: recipientRoot.gstRegistration.taxpayerType,
        sezStatus: recipientRoot.sezStatus,
      },
    },
    buyerAssociation: registered.buyerAssociation,
    classification: registered.classification,
    placeOfSupply: registered.placeOfSupply,
    registeredStateComparison: {
      candidateHash: registered.candidateHash,
      comparisonRule: registered.comparisonRule,
      stateRelationship: relationship,
    },
    supplyNature: sez || !ordinarySame ? "inter_state" : "intra_state",
    determinationBasis: sez
      ? "sez_override"
      : "ordinary_registered_state_comparison",
    sezDirection,
    legalRule: sez
      ? "IGST_ACT_7_5_B"
      : ordinarySame
        ? "IGST_ACT_8_2"
        : "IGST_ACT_7_3",
  };
  const candidateJson = JSON.stringify(candidate);
  return {
    ...candidate,
    candidateJson,
    candidateHash: sha256(JSON.stringify({ tenantId: TENANT, candidate })),
  };
}

function expectError(value: unknown): void {
  expect(() => buildIndiaGstAccommodationSupplyNature(value as never))
    .toThrow(IndiaGstAccommodationSupplyNatureError);
}

function expectDeepFrozen(value: unknown, seen = new Set<object>()): void {
  if (typeof value !== "object" || value === null || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBeTrue();
  for (const key of Reflect.ownKeys(value)) expectDeepFrozen((value as Mutable)[key], seen);
}

function rehashComparison(value: Mutable): void {
  const { candidateJson: _json, candidateHash: _hash, ...candidate } = value;
  value.candidateJson = JSON.stringify(candidate);
  value.candidateHash = sha256(JSON.stringify({ tenantId: TENANT, candidate }));
}

function rehashEvidence(value: Mutable): void {
  const { evidenceHash: _hash, ...body } = value;
  value.evidenceHash = sha256(JSON.stringify({ tenantId: TENANT, ...body }));
}

test("Order 287 P0: the exact pure bounded-context composer exists", () => {
  expect(typeof buildIndiaGstAccommodationSupplyNature).toBe("function");
});

test("Order 287 P1: all 18 relationship × supplier × recipient combinations apply exact precedence", () => {
  const relationships: Relationship[] = [
    "same_state_or_union_territory",
    "different_state_or_union_territory",
  ];
  const statuses: Status[] = [
    "affirmatively_non_sez_regular",
    "sez_unit",
    "sez_developer",
  ];
  let combinations = 0;
  const directions = new Set<string>();
  const rules = new Set<string>();
  const natures = new Set<string>();
  for (const relationship of relationships) {
    for (const supplierSez of statuses) {
      for (const recipientSez of statuses) {
        const selected = input(relationship, supplierSez, recipientSez);
        const before = JSON.stringify(selected);
        const first = buildIndiaGstAccommodationSupplyNature(selected as never);
        const replay = buildIndiaGstAccommodationSupplyNature(selected as never);
        expect(first).toEqual(
          expected(relationship, supplierSez, recipientSez) as typeof first,
        );
        expect(first).toEqual(replay);
        expect(JSON.stringify(first)).toBe(JSON.stringify(replay));
        expect(JSON.stringify(selected)).toBe(before);
        expectDeepFrozen(first);
        directions.add(first.sezDirection);
        rules.add(first.legalRule);
        natures.add(first.supplyNature);
        combinations += 1;
      }
    }
  }
  expect(combinations).toBe(18);
  expect([...directions].sort()).toEqual([
    "by_sez", "none", "to_and_by_sez", "to_sez",
  ]);
  expect([...rules].sort()).toEqual([
    "IGST_ACT_7_3", "IGST_ACT_7_5_B", "IGST_ACT_8_2",
  ]);
  expect([...natures].sort()).toEqual(["inter_state", "intra_state"]);
});

test("Order 287 P2: candidate ordering, JSON, tenant-bound hash and omissions are byte exact", () => {
  const selected = input("same_state_or_union_territory", "sez_unit", "sez_developer");
  const result = buildIndiaGstAccommodationSupplyNature(selected as never);
  expect(Object.keys(result)).toEqual([
    "propertyNode", "reservationId", "folioId", "supplyDate", "jurisdiction",
    "supplier", "recipient", "buyerAssociation", "classification", "placeOfSupply",
    "registeredStateComparison", "supplyNature", "determinationBasis",
    "sezDirection", "legalRule", "candidateJson", "candidateHash",
  ]);
  expect(Object.keys(result.supplier)).toEqual([
    "registrationId", "evidenceHash", "stateCode", "serviceLocation", "status",
  ]);
  expect(Object.keys(result.recipient)).toEqual([
    "partyId", "registrationId", "evidenceHash", "status",
  ]);
  expect(result.candidateJson).toBe(JSON.stringify({
    ...result,
    candidateJson: undefined,
    candidateHash: undefined,
  }, (_key, value) => value));
  expect(result.candidateHash).toBe(sha256(JSON.stringify({
    tenantId: TENANT,
    candidate: JSON.parse(result.candidateJson),
  })));
  expect(result).not.toHaveProperty("tenantId");
  for (const forbidden of [
    "SupTyp", "IgstOnIntra", "ItemList", "taxRate", "taxAmount",
    "authorizedOperations", "zeroRated", "refund", "recipientState",
  ]) expect(result).not.toHaveProperty(forbidden);
});

test("Order 287 P3: explicit supply date rejects malformed, impossible, inferred and mismatched dates", () => {
  for (const bad of [
    "", "2039-5-15", "2039-05-15Z", "2039-05-15T00:00:00Z", " 2039-05-15",
    "2039-05-15 ", "0000-01-01", "2039-00-15", "2039-13-01", "2039-02-29",
    "2100-02-29", "2039-04-31", null, undefined,
  ]) expectError(input(undefined, undefined, undefined, { supplyDate: bad }));

  for (const [side, date] of [
    ["supplierSezStatus", "2039-05-14"],
    ["supplierSezStatus", "2039-05-16"],
    ["recipientSezStatus", "2039-05-14"],
    ["recipientSezStatus", "2039-05-16"],
  ] as const) {
    const selected = input();
    const root = clone(selected[side]) as Mutable;
    root.statusAsOf = date;
    rehashEvidence(root);
    selected[side] = deepFreeze(root) as never;
    expectError(selected);
  }

  const leap = input(undefined, undefined, undefined, { supplyDate: "2040-02-29" });
  for (const side of ["supplierSezStatus", "recipientSezStatus"] as const) {
    const root = clone(leap[side]) as Mutable;
    root.statusAsOf = "2040-02-29";
    rehashEvidence(root);
    leap[side] = deepFreeze(root) as never;
  }
  expect(buildIndiaGstAccommodationSupplyNature(leap as never).supplyDate)
    .toBe("2040-02-29");
});

test("Order 287 P4: every upstream root is complete, exact, deeply frozen and independently rehashed", () => {
  const rootNames = [
    "registeredStateComparison", "supplierServiceLocation",
    "recipientSezStatus", "supplierSezStatus",
  ] as const;
  for (const name of rootNames) {
    const missing = input();
    delete (missing as Mutable)[name];
    expectError(missing);

    const extra = input();
    const thawed = clone(extra[name]) as Mutable;
    thawed.unapproved = true;
    extra[name] = deepFreeze(thawed) as never;
    expectError(extra);

    const unfrozen = input();
    unfrozen[name] = clone(unfrozen[name]) as never;
    expectError(unfrozen);

    const brokenHash = input();
    const corrupted = clone(brokenHash[name]) as Mutable;
    if (name === "registeredStateComparison") corrupted.candidateHash = "9".repeat(64);
    else corrupted.evidenceHash = "9".repeat(64);
    brokenHash[name] = deepFreeze(corrupted) as never;
    expectError(brokenHash);
  }

  const brokenJson = input();
  const comparisonRoot = clone(brokenJson.registeredStateComparison) as Mutable;
  comparisonRoot.candidateJson = "{}";
  brokenJson.registeredStateComparison = deepFreeze(comparisonRoot) as never;
  expectError(brokenJson);
});

test("Order 287 P5: property, stay, jurisdiction, Pos, Party, registration, location and status lineage cannot cross-mix", () => {
  for (const [rootName, mutate] of [
    ["registeredStateComparison", (x: Mutable) => { x.reservationId = id(28792); }],
    ["registeredStateComparison", (x: Mutable) => { x.folioId = id(28793); }],
    ["registeredStateComparison", (x: Mutable) => { (x.classification as Mutable).classificationId = id(28794); }],
    ["registeredStateComparison", (x: Mutable) => { (x.buyerAssociation as Mutable).payloadHash = "0".repeat(64); }],
    ["recipientSezStatus", (x: Mutable) => { x.recipientSezStatusId = id(28797); }],
    ["supplierSezStatus", (x: Mutable) => { x.supplierSezStatusId = id(28799); }],
  ] as const) {
    const selected = input();
    const root = clone(selected[rootName]) as Mutable;
    mutate(root);
    selected[rootName] = deepFreeze(root) as never;
    expectError(selected);
  }

  const cases: Array<(selected: ReturnType<typeof input>) => void> = [
    (v) => { const x = clone(v.registeredStateComparison) as Mutable; x.propertyNode = id(28791); rehashComparison(x); v.registeredStateComparison = deepFreeze(x) as never; },
    (v) => { const x = clone(v.registeredStateComparison) as Mutable; (x.jurisdiction as Mutable).contentHash = "8".repeat(64); rehashComparison(x); v.registeredStateComparison = deepFreeze(x) as never; },
    (v) => { const x = clone(v.registeredStateComparison) as Mutable; (x.placeOfSupply as Mutable).pos = "29"; rehashComparison(x); v.registeredStateComparison = deepFreeze(x) as never; },
    (v) => { const x = clone(v.registeredStateComparison) as Mutable; (x.supplier as Mutable).stateCode = "29"; rehashComparison(x); v.registeredStateComparison = deepFreeze(x) as never; },
    (v) => { const x = clone(v.registeredStateComparison) as Mutable; (x.recipient as Mutable).partyId = id(28794); rehashComparison(x); v.registeredStateComparison = deepFreeze(x) as never; },
    (v) => { const x = clone(v.supplierServiceLocation) as Mutable; x.supplierServiceLocationId = id(28795); rehashEvidence(x); v.supplierServiceLocation = deepFreeze(x) as never; },
    (v) => { const x = clone(v.supplierServiceLocation) as Mutable; (x.supplier as Mutable).registrationId = id(28796); rehashEvidence(x); v.supplierServiceLocation = deepFreeze(x) as never; },
    (v) => { const x = clone(v.recipientSezStatus) as Mutable; (x.recipient as Mutable).registrationId = id(28798); rehashEvidence(x); v.recipientSezStatus = deepFreeze(x) as never; },
    (v) => { const x = clone(v.supplierSezStatus) as Mutable; (x.supplierServiceLocation as Mutable).id = id(28790); rehashEvidence(x); v.supplierSezStatus = deepFreeze(x) as never; },
    (v) => { const x = clone(v.supplierSezStatus) as Mutable; (x.supplier as Mutable).evidenceHash = "7".repeat(64); rehashEvidence(x); v.supplierSezStatus = deepFreeze(x) as never; },
    (v) => { const x = clone(v.recipientSezStatus) as Mutable; (x.recipient as Mutable).evidenceHash = "6".repeat(64); rehashEvidence(x); v.recipientSezStatus = deepFreeze(x) as never; },
  ];
  for (const corrupt of cases) {
    const selected = input();
    corrupt(selected);
    expectError(selected);
  }
});

test("Order 287 P6: nested status, approval, validity, source and legal-rule defects fail closed", () => {
  for (const side of ["supplierSezStatus", "recipientSezStatus"] as const) {
    for (const corrupt of [
      (x: Mutable) => { (x.gstRegistration as Mutable).status = "suspended"; },
      (x: Mutable) => { (x.gstRegistration as Mutable).source = "caller"; },
      (x: Mutable) => { (x.gstRegistration as Mutable).evidenceSha256 = "x".repeat(64); },
      (x: Mutable) => { x.legalRule = "CALLER_RULE"; },
    ]) {
      const selected = input();
      const root = clone(selected[side]) as Mutable;
      corrupt(root);
      rehashEvidence(root);
      selected[side] = deepFreeze(root) as never;
      expectError(selected);
    }
    for (const corrupt of [
      (x: Mutable) => { (x.approval as Mutable).status = "expired"; },
      (x: Mutable) => { ((x.approval as Mutable).validity as Mutable).fromInclusive = "2039-05-16"; },
      (x: Mutable) => { ((x.approval as Mutable).validity as Mutable).toExclusive = "2039-05-15"; },
      (x: Mutable) => { (x.approval as Mutable).form = "sez_rules_form_f2"; },
    ]) {
      const selected = side === "supplierSezStatus"
        ? input(undefined, "sez_unit", undefined)
        : input(undefined, undefined, "sez_unit");
      const root = clone(selected[side]) as Mutable;
      corrupt(root);
      rehashEvidence(root);
      selected[side] = deepFreeze(root) as never;
      expectError(selected);
    }
  }
});

test("Order 287 P7: accessors, proxies, symbols, arrays, prototypes and post-build mutation are rejected or inert", () => {
  const missing = input() as Mutable;
  delete missing.tenantId;
  expectError(missing);
  expectError(input(undefined, undefined, undefined, { extra: true }));
  expectError(input(undefined, undefined, undefined, { tenantId: id(28789) }));
  const accessor = input();
  Object.defineProperty(accessor, "supplyDate", { enumerable: true, get: () => SUPPLY_DATE });
  expectError(accessor);
  expectError(new Proxy(input(), {}));
  const symbol = input() as Mutable;
  symbol[Symbol("hidden")] = true;
  expectError(symbol);
  expectError([]);
  expectError(Object.assign(Object.create({ inherited: true }), input()));

  for (const name of [
    "registeredStateComparison", "supplierServiceLocation",
    "recipientSezStatus", "supplierSezStatus",
  ] as const) {
    const proxied = input();
    proxied[name] = new Proxy(proxied[name] as object, {}) as never;
    expectError(proxied);
    const accessorNested = input();
    const root = clone(accessorNested[name]) as Mutable;
    const firstKey = Object.keys(root)[0]!;
    const saved = root[firstKey];
    Object.defineProperty(root, firstKey, { enumerable: true, get: () => saved });
    accessorNested[name] = deepFreeze(root) as never;
    expectError(accessorNested);

    const symbolNested = input();
    const symbolRoot = clone(symbolNested[name]) as Mutable;
    symbolRoot[Symbol("hidden")] = true;
    symbolNested[name] = deepFreeze(symbolRoot) as never;
    expectError(symbolNested);
  }

  const result = buildIndiaGstAccommodationSupplyNature(input() as never);
  const before = JSON.stringify(result);
  try { (result as unknown as Mutable).supplyNature = "inter_state"; } catch { /* frozen */ }
  try { (result.supplier as unknown as Mutable).stateCode = "29"; } catch { /* frozen */ }
  expect(JSON.stringify(result)).toBe(before);
});

test("Order 287 P8: recipient registered state is never an input or decision participant", async () => {
  const same = buildIndiaGstAccommodationSupplyNature(input() as never);
  expect(same.supplyNature).toBe("intra_state");
  const invented = input();
  const comparisonWithState = clone(invented.registeredStateComparison) as Mutable;
  (comparisonWithState.recipient as Mutable).stateCode = "29";
  rehashComparison(comparisonWithState);
  invented.registeredStateComparison = deepFreeze(comparisonWithState) as never;
  expectError(invented);

  const source = await Bun.file(new URL(
    "../src/contexts/tax-fiscal/india-gst-accommodation-supply-nature.ts",
    import.meta.url,
  )).text();
  expect(source).not.toMatch(/recipientState|recipient_state|recipient\.stateCode/);
});

test("Order 287 P9: pure replay has zero database, financial, fiscal or event effects and no hidden clock", async () => {
  const protectedSources = [
    "india-gst-accommodation-registered-state-comparison.ts",
    "india-gst-supplier-service-location.ts",
    "india-gst-recipient-sez-status.ts",
    "india-gst-supplier-sez-status.ts",
  ].map((name) => new URL(`../src/contexts/tax-fiscal/${name}`, import.meta.url));
  const before = await Promise.all(protectedSources.map((url) => Bun.file(url).text()));
  const selected = input("different_state_or_union_territory", "sez_developer", "sez_unit");
  const selectedBytes = JSON.stringify(selected);
  for (let index = 0; index < 5; index += 1) {
    buildIndiaGstAccommodationSupplyNature(selected as never);
  }
  expect(JSON.stringify(selected)).toBe(selectedBytes);
  expect(await Promise.all(protectedSources.map((url) => Bun.file(url).text()))).toEqual(before);

  const source = await Bun.file(new URL(
    "../src/contexts/tax-fiscal/india-gst-accommodation-supply-nature.ts",
    import.meta.url,
  )).text();
  expect(source).not.toMatch(/\b(?:Tx|SQL|Database|postgres|SELECT|INSERT|DELETE|LOCK)\b/i);
  expect(source).not.toMatch(/Date\.now|new Date|current_date|server.?clock|latest|ORDER BY/i);
  expect(source).not.toMatch(/fact_log|outbox|idempotency|journal|posting_line|tax_detail|document|fiscal_submission/i);
});

test("Order 287 P10: static containment excludes levy, IRP payload, zero rating and network authority", async () => {
  const source = await Bun.file(new URL(
    "../src/contexts/tax-fiscal/india-gst-accommodation-supply-nature.ts",
    import.meta.url,
  )).text();
  expect(source).not.toMatch(/SupTyp|IgstOnIntra|SEZWP|SEZWOP|ItemList|ValDtls|SellerDtls|BuyerDtls/);
  expect(source).not.toMatch(/authorized.?operations|specified.?officer|zero.?rat|refund|payment.?mode/i);
  expect(source).not.toMatch(/CGST|SGST|UTGST|tax.?rate|tax.?amount|rounding|residual|reverse.?charge/i);
  expect(source).not.toMatch(/fetch\s*\(|https?:|Elysia|app\.(?:get|post|put|delete)|\b(?:write|save|insert|delete)\w*\s*\(/i);
  expect(source).toContain("IGST_ACT_7_5_B");
  expect(source).toContain("IGST_ACT_7_3");
  expect(source).toContain("IGST_ACT_8_2");
});
