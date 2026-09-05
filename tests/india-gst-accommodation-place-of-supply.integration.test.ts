import {
  afterAll,
  beforeAll,
  describe,
  expect,
  setDefaultTimeout,
  test,
} from "bun:test";
import { SQL } from "bun";

import {
  IndiaGstAccommodationPlaceOfSupplyConflictError,
  IndiaGstAccommodationPlaceOfSupplyService,
  IndiaGstAccommodationPlaceOfSupplyValidationError,
  createPositiveTaxAttributionSnapshot,
} from "../src/contexts/tax-fiscal";
import { Database, type Tx } from "../src/kernel";

setDefaultTimeout(60_000);

const DEPLOY_URL = process.env.YELLOW_DEPLOY_DATABASE_URL;
const RUNTIME_URL = process.env.YELLOW_ORDER282_DATABASE_URL ??
  process.env.YELLOW_RUNTIME_DATABASE_URL;
if (process.env.YELLOW_REQUIRE_ORDER282_DATABASE === "1" &&
    (!DEPLOY_URL || !RUNTIME_URL)) {
  throw new Error("Order 282 PostgreSQL composition requires deploy and runtime URLs");
}
const databaseDescribe = DEPLOY_URL && RUNTIME_URL ? describe.serial : describe.skip;

const id = (suffix: number): string =>
  `00000000-0000-0000-0000-${String(suffix).padStart(12, "0")}`;

const TENANT = id(28201);
const PROPERTY = id(28202);
const RESERVATION = id(28203);
const FOLIO = id(28204);
const ACCOUNT = id(28205);
const PARTY = id(28206);
const REGISTRATION = id(28207);
const SUPPLIER_REGISTRATION = id(28208);
const CLASSIFICATION = id(28209);
const EXTENSION = id(28210);
const ACTOR = id(28211);
const GUEST = id(28212);
const UNIT_TYPE = id(28213);
const SELLABLE = id(28214);
const RATE_PLAN = id(28215);
const SEGMENT = id(28216);
const HOLD = id(28217);
const ATTRIBUTION = id(28218);
const HOLD_BINDING = id(28219);
const LINEAGE = id(28220);
const HASH = "a".repeat(64);

const GST_STATE_CODES = [
  "01", "02", "03", "04", "05", "06", "07", "08", "09", "10",
  "11", "12", "13", "14", "15", "16", "17", "18", "19", "20",
  "21", "22", "23", "24", "26", "27", "29", "30", "31", "32",
  "33", "34", "35", "36", "37", "38",
] as const;

type MutableRecord = Record<PropertyKey, unknown>;

function deepFreeze<T>(value: T, seen = new Set<object>()): T {
  if (typeof value !== "object" || value === null || seen.has(value)) return value;
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    deepFreeze((value as MutableRecord)[key], seen);
  }
  return Object.freeze(value);
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function hash(value: string): string {
  return new Bun.CryptoHasher("sha256").update(value).digest("hex");
}

function input(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    tenantId: TENANT,
    propertyNode: PROPERTY,
    reservationId: RESERVATION,
    folioId: FOLIO,
    recipientPartyId: PARTY,
    recipientRegistrationId: REGISTRATION,
    classificationId: CLASSIFICATION,
    ...overrides,
  };
}

function supplier(overrides: Record<string, unknown> = {}): Readonly<Record<string, unknown>> {
  const values = {
    registrationId: SUPPLIER_REGISTRATION,
    propertyNode: PROPERTY,
    scheme: "in-gstin",
    currency: "INR",
    jurisdiction: {
      extensionId: EXTENSION,
      ownerTenantId: TENANT,
      key: "in.order282.gst.27",
      version: "7",
      contentHash: HASH,
    },
    gstin: "27AAPFU0939F1ZV",
    stateCode: "27",
    legalName: "Order 282 Hotel Private Limited",
    tradeName: "Order 282 Hotel",
    addressLine: "1 Marine Drive",
    locality: "Mumbai",
    postalCode: "400001",
    ...overrides,
  };
  const evidenceHash = typeof overrides.evidenceHash === "string"
    ? overrides.evidenceHash
    : hash(JSON.stringify({
      registrationId: values.registrationId,
      tenantId: TENANT,
      propertyNode: values.propertyNode,
      scheme: values.scheme,
      currency: values.currency,
      jurisdiction: values.jurisdiction,
      gstin: values.gstin,
      stateCode: values.stateCode,
      legalName: values.legalName,
      tradeName: values.tradeName,
      addressLine: values.addressLine,
      locality: values.locality,
      postalCode: values.postalCode,
    }));
  return deepFreeze({ ...values, evidenceHash });
}

function buyer(
  overrides: Record<string, unknown> = {},
  recipientRegistration: Readonly<{ gstin: string; stateCode: string }> = {
    gstin: "29ABCDE1234F1ZW",
    stateCode: "29",
  },
): Readonly<Record<string, unknown>> {
  const payload = {
    BuyerDtls: {
      Gstin: recipientRegistration.gstin,
      LglNm: "Order 282 Buyer Private Limited",
      TrdNm: "Order 282 Buyer",
      Addr1: "1 Residency Road",
      Loc: "Bengaluru",
      Pin: 560001,
      Stcd: recipientRegistration.stateCode,
    },
  };
  const folio = {
    folioId: FOLIO,
    accountId: ACCOUNT,
    reservationId: RESERVATION,
    windowNo: 2,
    folioStatus: "open",
    accountRole: "company",
    accountStatus: "open",
    reservationStatus: "in_house",
    currency: "INR",
    propertyNode: PROPERTY,
  };
  const recipient = {
    partyId: PARTY,
    registrationId: REGISTRATION,
    evidenceHash: hash(JSON.stringify({
      registrationId: REGISTRATION,
      tenantId: TENANT,
      partyId: PARTY,
      scheme: "in-gstin",
      gstin: payload.BuyerDtls.Gstin,
      stateCode: payload.BuyerDtls.Stcd,
      legalName: payload.BuyerDtls.LglNm,
      tradeName: payload.BuyerDtls.TrdNm,
      addressLine1: payload.BuyerDtls.Addr1,
      locality: payload.BuyerDtls.Loc,
      pin: String(payload.BuyerDtls.Pin),
    })),
  };
  const buyerEvidence = {
    format: "irp_json_1_1",
    payload,
    payloadJson: JSON.stringify(payload),
    payloadHash: hash(JSON.stringify(payload)),
  };
  const values = {
    folio: {
      ...folio,
    },
    recipient: {
      ...recipient,
    },
    buyer: {
      ...buyerEvidence,
    },
    ...overrides,
  };
  const associationJson = typeof overrides.associationJson === "string"
    ? overrides.associationJson
    : JSON.stringify({ folio: values.folio, recipient: values.recipient, buyer: values.buyer });
  const associationHash = typeof overrides.associationHash === "string"
    ? overrides.associationHash
    : hash(associationJson);
  return deepFreeze({ ...values, associationJson, associationHash });
}

function location(overrides: Record<string, unknown> = {}): Readonly<Record<string, unknown>> {
  const values = {
    propertyNode: PROPERTY,
    countryCode: "IN",
    stateCode: "27",
    addressLine1: "1 Marine Drive",
    locality: "Mumbai",
    pin: "400001",
    ...overrides,
  };
  const evidenceHash = typeof overrides.evidenceHash === "string"
    ? overrides.evidenceHash
    : hash(JSON.stringify({ tenantId: TENANT, ...values }));
  return deepFreeze({ ...values, evidenceHash });
}

function classification(
  overrides: Record<string, unknown> = {},
): Readonly<Record<string, unknown>> {
  const values = {
    classificationId: CLASSIFICATION,
    propertyNode: PROPERTY,
    jurisdiction: {
      extensionId: EXTENSION,
      ownerTenantId: TENANT,
      key: "in.order282.gst.27",
      version: "7",
      contentHash: HASH,
    },
    lineId: "room",
    revenueGroup: "room_revenue",
    classificationSystem: "SAC",
    classificationCode: "996311",
    isServiceCode: "Y",
    ...overrides,
  };
  const evidenceHash = typeof overrides.evidenceHash === "string"
    ? overrides.evidenceHash
    : hash(JSON.stringify({ tenantId: TENANT, ...values }));
  return deepFreeze({ ...values, evidenceHash });
}

interface FixtureOptions {
  readonly supplier?: unknown;
  readonly buyer?: unknown;
  readonly location?: unknown;
  readonly classification?: unknown;
}

function harness(options: FixtureOptions = {}) {
  const calls: Array<{ resolver: string; input: unknown }> = [];
  const supplierResult = Object.prototype.hasOwnProperty.call(options, "supplier")
    ? options.supplier
    : supplier();
  const buyerResult = Object.prototype.hasOwnProperty.call(options, "buyer")
    ? options.buyer
    : buyer();
  const locationResult = Object.prototype.hasOwnProperty.call(options, "location")
    ? options.location
    : location();
  const classificationResult = Object.prototype.hasOwnProperty.call(options, "classification")
    ? options.classification
    : classification();
  const service = new IndiaGstAccommodationPlaceOfSupplyService(
    {
      async resolve(_tx: Tx, selected: unknown) {
        calls.push({ resolver: "supplier", input: selected });
        return supplierResult as never;
      },
    },
    {
      async resolve(_tx: Tx, selected: unknown) {
        calls.push({ resolver: "buyer", input: selected });
        return buyerResult as never;
      },
    },
    {
      async resolve(_tx: Tx, selected: unknown) {
        calls.push({ resolver: "location", input: selected });
        return locationResult as never;
      },
    },
    {
      async resolve(_tx: Tx, selected: unknown) {
        calls.push({ resolver: "classification", input: selected });
        return classificationResult as never;
      },
    },
  );
  let transactionCalls = 0;
  const tx = (async () => {
    transactionCalls += 1;
    throw new Error("place-of-supply compositor must not issue direct SQL");
  }) as unknown as Tx;
  return { service, tx, calls, transactionCalls: () => transactionCalls };
}

function expectedBody(stateCode = "27") {
  const supplierRoot = supplier();
  const buyerRoot = buyer();
  const classificationRoot = classification();
  const locationRoot = location({ stateCode });
  return {
    propertyNode: PROPERTY,
    reservationId: RESERVATION,
    folioId: FOLIO,
    jurisdiction: {
      extensionId: EXTENSION,
      ownerTenantId: TENANT,
      key: "in.order282.gst.27",
      version: "7",
      contentHash: HASH,
    },
    supplier: {
      registrationId: SUPPLIER_REGISTRATION,
      evidenceHash: supplierRoot.evidenceHash as string,
    },
    recipient: {
      partyId: PARTY,
      registrationId: REGISTRATION,
      evidenceHash: (buyerRoot.recipient as Record<string, string>).evidenceHash!,
    },
    buyerAssociation: {
      associationHash: buyerRoot.associationHash as string,
      payloadHash: (buyerRoot.buyer as Record<string, string>).payloadHash!,
    },
    classification: {
      classificationId: CLASSIFICATION,
      evidenceHash: classificationRoot.evidenceHash as string,
    },
    propertyLocation: {
      propertyNode: PROPERTY,
      evidenceHash: locationRoot.evidenceHash as string,
    },
    legalRule: "IGST_ACT_12_3_B" as const,
    pos: stateCode,
  };
}

function expectDeepFrozen(value: unknown, seen = new Set<object>()): void {
  if (typeof value !== "object" || value === null || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBeTrue();
  for (const key of Reflect.ownKeys(value)) {
    expectDeepFrozen((value as MutableRecord)[key], seen);
  }
}

test("Order 282 P0: exact bounded-context resolver exists", () => {
  expect(typeof IndiaGstAccommodationPlaceOfSupplyService).toBe("function");
});

test("Order 282 P1/P2: exact lineage resolves fixed-order frozen deterministic candidate", async () => {
  const target = harness();
  const selected = input();
  const before = JSON.stringify(selected);
  const first = await target.service.resolve(target.tx, selected as never);
  const second = await harness().service.resolve(target.tx, selected as never);
  const body = expectedBody();
  const candidateJson = JSON.stringify(body);

  expect(first).toEqual(second);
  expect(first).toEqual({
    ...body,
    candidateJson,
    candidateHash: hash(JSON.stringify({ tenantId: TENANT, candidate: body })),
  });
  expect(Object.keys(first)).toEqual([
    "propertyNode", "reservationId", "folioId", "jurisdiction", "supplier",
    "recipient", "buyerAssociation", "classification", "propertyLocation",
    "legalRule", "pos", "candidateJson", "candidateHash",
  ]);
  expect(first.candidateJson).toBe(candidateJson);
  expect(JSON.parse(first.candidateJson)).not.toHaveProperty("tenantId");
  expect(first.candidateHash).toBe(
    hash(JSON.stringify({ tenantId: TENANT, candidate: body })),
  );
  expect(first).not.toHaveProperty("tenantId");
  expect(first).not.toHaveProperty("supplierState");
  expect(first).not.toHaveProperty("recipientState");
  expect(first).not.toHaveProperty("intraState");
  expect(first).not.toHaveProperty("interState");
  expect(first).not.toHaveProperty("SupTyp");
  expect(first).not.toHaveProperty("ItemList");
  expectDeepFrozen(first);
  expect(JSON.stringify(selected)).toBe(before);
  expect(target.transactionCalls()).toBe(0);
  expect(target.calls).toEqual([
    {
      resolver: "supplier",
      input: { tenantId: TENANT, propertyNode: PROPERTY, reservationId: RESERVATION },
    },
    {
      resolver: "buyer",
      input: {
        tenantId: TENANT,
        propertyNode: PROPERTY,
        folioId: FOLIO,
        recipientPartyId: PARTY,
        registrationId: REGISTRATION,
      },
    },
    { resolver: "location", input: { tenantId: TENANT, propertyNode: PROPERTY } },
    {
      resolver: "classification",
      input: {
        tenantId: TENANT,
        propertyNode: PROPERTY,
        reservationId: RESERVATION,
        classificationId: CLASSIFICATION,
      },
    },
  ]);
});

test("Order 282 P3: exact seven-UUID plain input rejects hostile shapes before any resolver", async () => {
  const exact = input();
  const hostile: unknown[] = [
    null,
    [],
    Object.assign(Object.create({ inherited: true }), exact),
    { ...exact, extra: true },
    { ...exact, tenantId: "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA" },
    { ...exact, propertyNode: "not-a-uuid" },
    { ...exact, reservationId: "not-a-uuid" },
    { ...exact, folioId: "not-a-uuid" },
    { ...exact, recipientPartyId: "not-a-uuid" },
    { ...exact, recipientRegistrationId: "not-a-uuid" },
    { ...exact, classificationId: "not-a-uuid" },
    new Proxy({ ...exact }, {}),
  ];
  for (const key of Object.keys(exact)) {
    const missing = { ...exact } as MutableRecord;
    delete missing[key];
    hostile.push(missing);
  }
  const accessor = { ...exact } as MutableRecord;
  Object.defineProperty(accessor, "folioId", {
    enumerable: true,
    get: () => FOLIO,
  });
  hostile.push(accessor);
  const symbolic = { ...exact } as MutableRecord;
  symbolic[Symbol("hostile")] = true;
  hostile.push(symbolic);

  for (const candidate of hostile) {
    const target = harness();
    await expect(target.service.resolve(target.tx, candidate as never)).rejects
      .toBeInstanceOf(IndiaGstAccommodationPlaceOfSupplyValidationError);
    expect(target.calls).toHaveLength(0);
    expect(target.transactionCalls()).toBe(0);
  }
  const target = harness();
  await expect(target.service.resolve(undefined as unknown as Tx, exact as never)).rejects
    .toBeInstanceOf(IndiaGstAccommodationPlaceOfSupplyValidationError);
  expect(target.calls).toHaveLength(0);
});

test("Order 282 P4: every current property state is byte-exact pos and other states never substitute", async () => {
  for (const stateCode of GST_STATE_CODES) {
    const local = location({ stateCode });
    const target = harness({
      location: local,
      supplier: supplier(),
      buyer: buyer(),
    });
    const result = await target.service.resolve(target.tx, input() as never);
    expect(result.pos).toBe(stateCode);
    expect(result.candidateJson).toBe(JSON.stringify(expectedBody(stateCode)));
  }

  const shiftedParties = harness({
    supplier: supplier({ gstin: "29ABCDE1234F1ZW", stateCode: "29" }),
    buyer: buyer({}, { gstin: "27AAPFU0939F1ZV", stateCode: "27" }),
    location: location({ stateCode: "36" }),
  });
  const shiftedResult = await shiftedParties.service.resolve(
    shiftedParties.tx,
    input() as never,
  );
  expect(shiftedResult.pos).toBe("36");
  expect(JSON.parse(shiftedResult.candidateJson)).toMatchObject({ pos: "36" });
});

test("Order 282 P5: cross-mixed tenant/property/reservation/folio/Party/registration truth fails closed", async () => {
  const other = id(28999);
  const hostileFixtures: FixtureOptions[] = [
    { supplier: supplier({ propertyNode: other }) },
    { supplier: supplier({ currency: "USD" }) },
    { buyer: buyer({ folio: { ...(buyer().folio as object), folioId: other } }) },
    { buyer: buyer({ folio: { ...(buyer().folio as object), propertyNode: other } }) },
    { buyer: buyer({ folio: { ...(buyer().folio as object), reservationId: other } }) },
    { buyer: buyer({ folio: { ...(buyer().folio as object), currency: "USD" } }) },
    { buyer: buyer({ recipient: { ...(buyer().recipient as object), partyId: other } }) },
    { buyer: buyer({ recipient: { ...(buyer().recipient as object), registrationId: other } }) },
    { location: location({ propertyNode: other }) },
    { location: location({ countryCode: "CA" }) },
    { classification: classification({ classificationId: other }) },
    { classification: classification({ propertyNode: other }) },
    { classification: classification({ lineId: "spa" }) },
    { classification: classification({ revenueGroup: "spa_revenue" }) },
    { classification: classification({ classificationSystem: "HSN" }) },
    { classification: classification({ classificationCode: "100001" }) },
    { classification: classification({ isServiceCode: "N" }) },
  ];

  for (const fixture of hostileFixtures) {
    const target = harness(fixture);
    await expect(target.service.resolve(target.tx, input() as never)).rejects
      .toBeInstanceOf(IndiaGstAccommodationPlaceOfSupplyConflictError);
    expect(target.transactionCalls()).toBe(0);
  }
});

test("Order 282 P5: complete frozen jurisdiction and evidence hashes cannot be cross-mixed", async () => {
  const jurisdictionMutations = [
    { extensionId: id(28991) },
    { ownerTenantId: id(28992) },
    { key: "in.order282.gst.29" },
    { version: "8" },
    { contentHash: "9".repeat(64) },
  ];
  for (const mutation of jurisdictionMutations) {
    const target = harness({
      classification: classification({
        jurisdiction: { ...(classification().jurisdiction as object), ...mutation },
      }),
    });
    await expect(target.service.resolve(target.tx, input() as never)).rejects
      .toBeInstanceOf(IndiaGstAccommodationPlaceOfSupplyConflictError);
  }
  for (const fixture of [
    { supplier: supplier({ evidenceHash: "x".repeat(64) }) },
    { buyer: buyer({ associationHash: "x".repeat(64) }) },
    { buyer: buyer({ recipient: { ...(buyer().recipient as object), evidenceHash: "x".repeat(64) } }) },
    { buyer: buyer({ buyer: { ...(buyer().buyer as object), payloadHash: "x".repeat(64) } }) },
    { location: location({ evidenceHash: "x".repeat(64) }) },
    { classification: classification({ evidenceHash: "x".repeat(64) }) },
  ] satisfies FixtureOptions[]) {
    const target = harness(fixture);
    await expect(target.service.resolve(target.tx, input() as never)).rejects
      .toBeInstanceOf(IndiaGstAccommodationPlaceOfSupplyConflictError);
  }
});

test("Order 282 P3/P6: hostile dependency result shapes fail closed without caller mutation", async () => {
  const factories = {
    supplier,
    buyer,
    location,
    classification,
  } as const;
  for (const [name, factory] of Object.entries(factories)) {
    const pristine = factory();
    const variants: unknown[] = [
      null,
      [],
      deepFreeze({ ...pristine, surplus: true }),
      new Proxy(clone(pristine), {}),
    ];
    const missing = clone(pristine) as MutableRecord;
    delete missing[Object.keys(missing)[0]!];
    variants.push(deepFreeze(missing));
    const accessor = clone(pristine) as MutableRecord;
    const firstKey = Object.keys(accessor)[0]!;
    const original = accessor[firstKey];
    Object.defineProperty(accessor, firstKey, { enumerable: true, get: () => original });
    variants.push(Object.freeze(accessor));
    const symbolic = clone(pristine) as MutableRecord;
    symbolic[Symbol("hostile")] = true;
    variants.push(deepFreeze(symbolic));
    variants.push(clone(pristine)); // exact bytes but deliberately not recursively frozen

    for (const variant of variants) {
      const fixtures = { [name]: variant } as FixtureOptions;
      const before = JSON.stringify(variant);
      const target = harness(fixtures);
      await expect(target.service.resolve(target.tx, input() as never)).rejects
        .toBeInstanceOf(IndiaGstAccommodationPlaceOfSupplyConflictError);
      expect(JSON.stringify(variant)).toBe(before);
      expect(target.transactionCalls()).toBe(0);
    }
  }
});

test("Order 282 P3: nested frozen evidence shapes reject surplus, accessor, symbol and proxy", async () => {
  const hostile: FixtureOptions[] = [];

  const supplierJurisdiction = clone(supplier().jurisdiction) as MutableRecord;
  supplierJurisdiction.surplus = true;
  hostile.push({ supplier: supplier({ jurisdiction: deepFreeze(supplierJurisdiction) }) });

  const classificationJurisdiction = clone(classification().jurisdiction) as MutableRecord;
  Object.defineProperty(classificationJurisdiction, "key", {
    enumerable: true,
    get: () => "in.order282.gst.27",
  });
  hostile.push({
    classification: classification({ jurisdiction: Object.freeze(classificationJurisdiction) }),
  });

  const folio = clone(buyer().folio) as MutableRecord;
  folio[Symbol("hostile")] = true;
  hostile.push({ buyer: buyer({ folio: deepFreeze(folio) }) });

  hostile.push({
    buyer: buyer({
      recipient: new Proxy(clone(buyer().recipient as object), {}),
    }),
  });

  const payload = clone((buyer().buyer as MutableRecord).payload) as MutableRecord;
  payload.extra = true;
  hostile.push({
    buyer: buyer({
      buyer: deepFreeze({ ...(buyer().buyer as object), payload: deepFreeze(payload) }),
    }),
  });

  for (const fixture of hostile) {
    const target = harness(fixture);
    await expect(target.service.resolve(target.tx, input() as never)).rejects
      .toBeInstanceOf(IndiaGstAccommodationPlaceOfSupplyConflictError);
    expect(target.transactionCalls()).toBe(0);
  }
});

test("Order 282 P6/P7: replay and rejection make zero direct SQL or caller-byte changes", async () => {
  const selected = input();
  const roots = [supplier(), buyer(), location(), classification()];
  const before = JSON.stringify({ selected, roots });
  const target = harness({
    supplier: roots[0], buyer: roots[1], location: roots[2], classification: roots[3],
  });
  await target.service.resolve(target.tx, selected as never);
  await target.service.resolve(target.tx, selected as never);
  await expect(harness({ location: location({ countryCode: "US" }) }).service
    .resolve(target.tx, selected as never)).rejects.toThrow();
  expect(JSON.stringify({ selected, roots })).toBe(before);
  expect(target.transactionCalls()).toBe(0);
});

let deploy: SQL | undefined;
let database: Database | undefined;

async function cleanupDatabaseFixture(): Promise<void> {
  if (!deploy) return;
  await deploy`DELETE FROM fiscal_submission WHERE tenant_id=${TENANT}::uuid`;
  await deploy`DELETE FROM posting_line WHERE tenant_id=${TENANT}::uuid`;
  await deploy`DELETE FROM journal WHERE tenant_id=${TENANT}::uuid`;
  await deploy`DELETE FROM document WHERE tenant_id=${TENANT}::uuid`;
  await deploy`DELETE FROM outbox WHERE tenant_id=${TENANT}::uuid`;
  await deploy`DELETE FROM fact_log WHERE tenant_id=${TENANT}::uuid`;
  await deploy`DELETE FROM india_gst_item_classification WHERE tenant_id=${TENANT}::uuid`;
  await deploy`DELETE FROM property_fiscal_location WHERE tenant_id=${TENANT}::uuid`;
  await deploy`DELETE FROM property_fiscal_registration WHERE tenant_id=${TENANT}::uuid`;
  await deploy`DELETE FROM party_fiscal_registration WHERE tenant_id=${TENANT}::uuid`;
  await deploy`DELETE FROM folio WHERE tenant_id=${TENANT}::uuid`;
  await deploy`DELETE FROM account WHERE tenant_id=${TENANT}::uuid`;
  await deploy`DELETE FROM tax_attribution_reservation_binding WHERE tenant_id=${TENANT}::uuid`;
  await deploy`DELETE FROM reservation_guest WHERE tenant_id=${TENANT}::uuid`;
  await deploy`DELETE FROM reservation_segment WHERE tenant_id=${TENANT}::uuid`;
  await deploy`DELETE FROM reservation WHERE tenant_id=${TENANT}::uuid`;
  await deploy`DELETE FROM tax_attribution_hold_binding WHERE tenant_id=${TENANT}::uuid`;
  await deploy`DELETE FROM hold WHERE tenant_id=${TENANT}::uuid`;
  await deploy`DELETE FROM tax_attribution_snapshot WHERE tenant_id=${TENANT}::uuid`;
  await deploy`DELETE FROM sellable_unit WHERE tenant_id=${TENANT}::uuid`;
  await deploy`DELETE FROM unit_type WHERE tenant_id=${TENANT}::uuid`;
  await deploy`DELETE FROM rate_plan WHERE tenant_id=${TENANT}::uuid`;
  await deploy`DELETE FROM party_role WHERE tenant_id=${TENANT}::uuid`;
  await deploy`DELETE FROM party WHERE tenant_id=${TENANT}::uuid`;
  await deploy`DELETE FROM app_user WHERE tenant_id=${TENANT}::uuid`;
  await deploy`DELETE FROM extension WHERE id=${EXTENSION}::uuid`;
  await deploy`DELETE FROM org_node WHERE tenant_id=${TENANT}::uuid`;
  await deploy`DELETE FROM tenant WHERE id=${TENANT}::uuid`;
}

async function seedDatabaseFixture(): Promise<void> {
  const quoteHash = "2".repeat(64);
  const period = "[2035-01-01 15:00:00+00,2035-01-02 15:00:00+00)";
  const snapshot = createPositiveTaxAttributionSnapshot({
    origin: { kind: "rate_quote", quoteHash },
    currency: "INR",
    line: {
      lineId: "room",
      revenueGroup: "room_revenue",
      amountMinor: 10_000n,
      nights: 1,
      personNights: 2,
      roomNights: [{ businessDate: "2035-01-01", amountMinor: 10_000n }],
    },
    assignments: [{
      businessDate: "2035-01-01",
      jurisdictionKey: "in.order282.gst.27",
      evidenceRef: `tax-assignment:${quoteHash}`,
    }],
    jurisdiction: {
      extensionId: EXTENSION,
      ownerTenantId: TENANT,
      key: "in.order282.gst.27",
      version: 7,
      contentHash: HASH,
      evidenceRef: `tax-jurisdiction:${"3".repeat(64)}`,
    },
    evaluation: {
      schemaVersion: 1,
      jurisdictionKey: "in.order282.gst.27",
      country: "IN",
      priceDisplay: "tax_exclusive",
      rounding: "line",
      inputTotalMinor: 10_000n,
      baseTotalMinor: 10_000n,
      taxTotalMinor: 500n,
      grandTotalMinor: 10_500n,
      taxes: [{
        code: "GST_ROOM",
        name: "Aggregate GST evidence",
        taxMinor: 500n,
        components: [{
          lineId: "room",
          revenueGroup: "room_revenue",
          baseMinor: 10_000n,
          taxMinor: 500n,
          rateBasisPoints: 500,
        }],
      }],
    },
  });

  await deploy!`INSERT INTO tenant(id,slug,name,tier,status) VALUES
    (${TENANT}::uuid,'order282-db','Order 282 PostgreSQL','shared','active')`;
  await deploy!`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES
    (${PROPERTY}::uuid,${TENANT}::uuid,'order282db.property'::ltree,'property',
     'Order 282 Hotel','Asia/Kolkata','INR')`;
  await deploy!`INSERT INTO app_user(id,tenant_id,email,display_name,status) VALUES
    (${ACTOR}::uuid,${TENANT}::uuid,'actor@order282-db.local','Order 282 Actor','active')`;
  await deploy!`INSERT INTO party(id,tenant_id,kind,display_name,legal_name,status) VALUES
    (${GUEST}::uuid,${TENANT}::uuid,'person','Order 282 Guest',NULL,'active'),
    (${PARTY}::uuid,${TENANT}::uuid,'org','Order 282 Buyer',
     'Order 282 Buyer Private Limited','active')`;
  await deploy!`INSERT INTO party_role(tenant_id,party_id,role) VALUES
    (${TENANT}::uuid,${GUEST}::uuid,'guest'),
    (${TENANT}::uuid,${PARTY}::uuid,'company')`;
  await deploy!`INSERT INTO unit_type(
      id,tenant_id,property_node,code,name,profile_key,max_occupancy
    ) VALUES (
      ${UNIT_TYPE}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'O282',
      'Order 282 Room','hotel',4
    )`;
  await deploy!`INSERT INTO sellable_unit(id,tenant_id,unit_type_id,name,status) VALUES
    (${SELLABLE}::uuid,${TENANT}::uuid,${UNIT_TYPE}::uuid,'Order 282 Sellable','active')`;
  await deploy!`INSERT INTO rate_plan(
      id,tenant_id,property_node,code,name,currency,tax_inclusive,status
    ) VALUES (
      ${RATE_PLAN}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'O282-IN',
      'Order 282 India','INR',false,'active'
    )`;
  await deploy!`INSERT INTO extension(
      id,tenant_id,type,key,version,effective,content,status
    ) VALUES (
      ${EXTENSION}::uuid,${TENANT}::uuid,'tax_jurisdiction','in.order282.gst.27',7,
      '[2030-01-01 00:00:00+00,)'::tstzrange,
      '{"country":"IN","price_display":"tax_exclusive","rounding":"line","taxes":[]}'::jsonb,
      'active'
    )`;
  await deploy!`INSERT INTO reservation(
      id,tenant_id,property_node,confirmation_no,status,primary_party,booker_party,
      channel_code,currency
    ) VALUES (
      ${RESERVATION}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'O282-DB','in_house',
      ${GUEST}::uuid,${GUEST}::uuid,'direct','INR'
    )`;
  await deploy!`INSERT INTO reservation_segment(
      id,tenant_id,reservation_id,seq,unit_type_id,sellable_unit_id,period,adults,
      children,rate_plan_id,status
    ) VALUES (
      ${SEGMENT}::uuid,${TENANT}::uuid,${RESERVATION}::uuid,1,${UNIT_TYPE}::uuid,
      ${SELLABLE}::uuid,${period}::tstzrange,2,'[]'::jsonb,${RATE_PLAN}::uuid,'booked'
    )`;
  await deploy!`INSERT INTO hold(
      id,tenant_id,property_node,sellable_unit_id,period,kind,holder,expires_at,status
    ) VALUES (
      ${HOLD}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,${SELLABLE}::uuid,
      ${period}::tstzrange,'cart','{}'::jsonb,'2035-01-02 15:00:00+00','consumed'
    )`;
  await deploy!`INSERT INTO tax_attribution_snapshot(
      tenant_id,id,property_node,actor_id,schema_version,origin_kind,origin_quote_hash,
      snapshot_hash,currency,snapshot
    ) VALUES (
      ${TENANT}::uuid,${ATTRIBUTION}::uuid,${PROPERTY}::uuid,${ACTOR}::uuid,1,
      'rate_quote',${quoteHash},${snapshot.snapshotHash},'INR',
      ${JSON.stringify(snapshot)}::jsonb
    )`;
  await deploy!`INSERT INTO tax_attribution_hold_binding(
      tenant_id,id,property_node,bound_by,hold_id,attribution_id,sellable_unit_id,
      period,origin_quote_hash,snapshot_hash,currency
    ) VALUES (
      ${TENANT}::uuid,${HOLD_BINDING}::uuid,${PROPERTY}::uuid,${ACTOR}::uuid,
      ${HOLD}::uuid,${ATTRIBUTION}::uuid,${SELLABLE}::uuid,${period}::tstzrange,
      ${quoteHash},${snapshot.snapshotHash},'INR'
    )`;
  await deploy!`INSERT INTO tax_attribution_reservation_binding(
      tenant_id,id,property_node,linked_by,binding_id,hold_id,attribution_id,
      reservation_id,segment_id,sellable_unit_id,period,origin_quote_hash,
      snapshot_hash,currency
    ) VALUES (
      ${TENANT}::uuid,${LINEAGE}::uuid,${PROPERTY}::uuid,${ACTOR}::uuid,
      ${HOLD_BINDING}::uuid,${HOLD}::uuid,${ATTRIBUTION}::uuid,${RESERVATION}::uuid,
      ${SEGMENT}::uuid,${SELLABLE}::uuid,${period}::tstzrange,${quoteHash},
      ${snapshot.snapshotHash},'INR'
    )`;
  await deploy!`INSERT INTO account(
      id,tenant_id,property_node,role,party_id,name,currency,status
    ) VALUES (
      ${ACCOUNT}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'guest',${GUEST}::uuid,
      'Order 282 Guest Account','INR','open'
    )`;
  await deploy!`INSERT INTO folio(
      id,tenant_id,account_id,reservation_id,folio_no,window_no,name,status
    ) VALUES (
      ${FOLIO}::uuid,${TENANT}::uuid,${ACCOUNT}::uuid,${RESERVATION}::uuid,
      'O282-DB-1',1,'Business Invoice','open'
    )`;
  await deploy!`INSERT INTO party_fiscal_registration(
      tenant_id,id,party_id,scheme,registration_number,region_code,legal_name,
      trade_name,address_line1,locality,pin
    ) VALUES (
      ${TENANT}::uuid,${REGISTRATION}::uuid,${PARTY}::uuid,'in-gstin',
      '29ABCDE1234F1ZW','29','Order 282 Buyer Private Limited','Order 282 Buyer',
      '1 Residency Road','Bengaluru','560001'
    )`;
  await deploy!`INSERT INTO property_fiscal_registration(
      tenant_id,id,property_node,scheme,currency,jurisdiction_extension_id,
      jurisdiction_owner_tenant_id,jurisdiction_key,jurisdiction_version,
      jurisdiction_content_hash,registration_number,region_code,legal_name,
      trade_name,address_line,locality,postal_code
    ) VALUES (
      ${TENANT}::uuid,${SUPPLIER_REGISTRATION}::uuid,${PROPERTY}::uuid,'in-gstin','INR',
      ${EXTENSION}::uuid,${TENANT}::uuid,'in.order282.gst.27',7,${HASH},
      '27AAPFU0939F1ZV','27','Order 282 Hotel Private Limited','Order 282 Hotel',
      '1 Marine Drive','Mumbai','400001'
    )`;
  await deploy!`INSERT INTO property_fiscal_location(
      tenant_id,property_node,country_code,state_code,address_line1,locality,pin
    ) VALUES (
      ${TENANT}::uuid,${PROPERTY}::uuid,'IN','36','1 Marine Drive','Hyderabad','500001'
    )`;
  await deploy!`INSERT INTO india_gst_item_classification(
      tenant_id,id,property_node,jurisdiction_extension_id,
      jurisdiction_owner_tenant_id,jurisdiction_key,jurisdiction_version,
      jurisdiction_content_hash,country_code,line_id,revenue_group,
      classification_system,classification_code,is_service_code
    ) VALUES (
      ${TENANT}::uuid,${CLASSIFICATION}::uuid,${PROPERTY}::uuid,${EXTENSION}::uuid,
      ${TENANT}::uuid,'in.order282.gst.27',7,${HASH},'IN','room','room_revenue',
      'SAC','996311','Y'
    )`;
}

async function databaseCounts(): Promise<Record<string, number>> {
  const rows = await deploy!<Array<Record<string, number>>>`SELECT
    (SELECT count(*)::int FROM property_fiscal_registration WHERE tenant_id=${TENANT}::uuid) suppliers,
    (SELECT count(*)::int FROM party_fiscal_registration WHERE tenant_id=${TENANT}::uuid) recipients,
    (SELECT count(*)::int FROM property_fiscal_location WHERE tenant_id=${TENANT}::uuid) locations,
    (SELECT count(*)::int FROM india_gst_item_classification WHERE tenant_id=${TENANT}::uuid) classifications,
    (SELECT count(*)::int FROM tax_attribution_snapshot WHERE tenant_id=${TENANT}::uuid) snapshots,
    (SELECT count(*)::int FROM tax_attribution_hold_binding WHERE tenant_id=${TENANT}::uuid) hold_bindings,
    (SELECT count(*)::int FROM tax_attribution_reservation_binding WHERE tenant_id=${TENANT}::uuid) reservation_bindings,
    (SELECT count(*)::int FROM fact_log WHERE tenant_id=${TENANT}::uuid) facts,
    (SELECT count(*)::int FROM outbox WHERE tenant_id=${TENANT}::uuid) events,
    (SELECT count(*)::int FROM journal WHERE tenant_id=${TENANT}::uuid) journals,
    (SELECT count(*)::int FROM posting_line WHERE tenant_id=${TENANT}::uuid) postings,
    (SELECT count(*)::int FROM document WHERE tenant_id=${TENANT}::uuid) documents,
    (SELECT count(*)::int FROM fiscal_submission WHERE tenant_id=${TENANT}::uuid) submissions`;
  return rows[0]!;
}

databaseDescribe("Order 282 PostgreSQL default-service composition", () => {
  beforeAll(async () => {
    deploy = new SQL(DEPLOY_URL!, { max: 8, prepare: false });
    database = Database.connect(RUNTIME_URL!, { maxConnections: 8, prepare: false });
    await cleanupDatabaseFixture();
    await seedDatabaseFixture();
  });

  afterAll(async () => {
    await cleanupDatabaseFixture();
    await database?.close();
    await deploy?.close({ timeout: 0 });
  });

  test("P9: coherent approved roots compose property-only pos with replay and zero writes", async () => {
    const service = new IndiaGstAccommodationPlaceOfSupplyService();
    const selected = input();
    const before = await databaseCounts();
    const first = await database!.withTenantTransaction(TENANT, (tx) =>
      service.resolve(tx, selected as never));
    const replay = await database!.withTenantTransaction(TENANT, (tx) =>
      service.resolve(tx, selected as never));

    expect(first).toEqual(replay);
    expect(first.pos).toBe("36");
    expect(first.pos).not.toBe("27");
    expect(first.pos).not.toBe("29");
    expect(first.propertyNode).toBe(PROPERTY);
    expect(first.reservationId).toBe(RESERVATION);
    expect(first.folioId).toBe(FOLIO);
    expect(first.candidateHash).toBe(
      hash(JSON.stringify({ tenantId: TENANT, candidate: JSON.parse(first.candidateJson) })),
    );
    expectDeepFrozen(first);

    await expect(database!.withTenantTransaction(TENANT, (tx) =>
      service.resolve(tx, input({ classificationId: id(28299) }) as never)
    )).rejects.toThrow();
    expect(await databaseCounts()).toEqual(before);
  });
});

test("Order 282 P8: source is a pure compositor with no forbidden decision or effect authority", async () => {
  const source = await Bun.file(new URL(
    "../src/contexts/tax-fiscal/india-gst-accommodation-place-of-supply.ts",
    import.meta.url,
  )).text();

  expect(source).toContain("IndiaGstSupplierRegistrationService");
  expect(source).toContain("IndiaGstFolioBuyerCandidateService");
  expect(source).toContain("IndiaGstPropertyLocationService");
  expect(source).toContain("IndiaGstAccommodationClassificationService");
  expect(source).toContain("IGST_ACT_12_3_B");
  expect(source).not.toMatch(/\b(?:INSERT\s+INTO|UPDATE\s+[A-Za-z_]|DELETE\s+FROM)\b/i);
  expect(source).not.toMatch(/\b(?:FOR\s+UPDATE|FOR\s+SHARE|pg_advisory|lock_financial_rows)\b/i);
  expect(source).not.toMatch(/\b(?:recordFact|publish|emit|idempotency|document_series)\b/i);
  expect(source).not.toMatch(/\b(?:journal|posting_line|fiscal_submission|outbox)\b/i);
  expect(source).not.toMatch(/\b(?:CGST|SGST|IGST|intraState|interState|decomposition)\b/);
  expect(source).not.toMatch(/\b(?:SupTyp|ItemList|SlNo|Qty|Unit|UnitPrice|TotAmt|AssAmt|GstRt|CgstAmt|SgstAmt|IgstAmt)\b/);
  expect(source).not.toMatch(/\bpos\s*:\s*(?:supplier|recipient)(?:Evidence)?\.stateCode\b/i);
  expect(source).not.toMatch(/\bconst\s+pos\s*=\s*(?:supplier|recipient)(?:Evidence)?\.stateCode\b/i);
  expect(source).not.toMatch(/\b(?:profile_key|org_node|party_role|reservation_guest)\b/i);
  expect(source).not.toMatch(/account\.party_id|reservation\.(?:primary_party|booker_party)/i);
});
