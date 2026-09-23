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
  IndiaGstAccommodationPlaceOfSupplyService,
  IndiaGstAccommodationRegisteredStateComparisonError,
  IndiaGstSupplierRegistrationService,
  buildIndiaGstAccommodationRegisteredStateComparison,
  createPositiveTaxAttributionSnapshot,
} from "../src/contexts/tax-fiscal";
import { Database } from "../src/kernel";

setDefaultTimeout(60_000);

const DEPLOY_URL = process.env.YELLOW_DEPLOY_DATABASE_URL;
const RUNTIME_URL =
  process.env.YELLOW_ORDER283_DATABASE_URL ??
  process.env.YELLOW_RUNTIME_DATABASE_URL;
if (
  process.env.YELLOW_REQUIRE_ORDER283_DATABASE === "1" &&
  (!DEPLOY_URL || !RUNTIME_URL)
) {
  throw new Error(
    "Order 283 PostgreSQL composition requires deploy and runtime URLs",
  );
}
const databaseDescribe =
  DEPLOY_URL && RUNTIME_URL ? describe.serial : describe.skip;

const id = (suffix: number): string =>
  `00000000-0000-0000-0000-${String(suffix).padStart(12, "0")}`;

const TENANT = id(28301);
const PROPERTY = id(28302);
const RESERVATION = id(28303);
const FOLIO = id(28304);
const ACCOUNT = id(28305);
const PARTY = id(28306);
const REGISTRATION = id(28307);
const SUPPLIER_REGISTRATION = id(28308);
const CLASSIFICATION = id(28309);
const EXTENSION = id(28310);
const ACTOR = id(28311);
const GUEST = id(28312);
const UNIT_TYPE = id(28313);
const SELLABLE = id(28314);
const RATE_PLAN = id(28315);
const SEGMENT = id(28316);
const HOLD = id(28317);
const ATTRIBUTION = id(28318);
const HOLD_BINDING = id(28319);
const LINEAGE = id(28320);
const HASH = "a".repeat(64);

const GST_STATE_CODES = [
  "01",
  "02",
  "03",
  "04",
  "05",
  "06",
  "07",
  "08",
  "09",
  "10",
  "11",
  "12",
  "13",
  "14",
  "15",
  "16",
  "17",
  "18",
  "19",
  "20",
  "21",
  "22",
  "23",
  "24",
  "26",
  "27",
  "29",
  "30",
  "31",
  "32",
  "33",
  "34",
  "35",
  "36",
  "37",
  "38",
] as const;
const GST_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

type MutableRecord = Record<PropertyKey, unknown>;

function deepFreeze<T>(value: T, seen = new Set<object>()): T {
  if (typeof value !== "object" || value === null || seen.has(value))
    return value;
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    deepFreeze((value as MutableRecord)[key], seen);
  }
  return Object.freeze(value);
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function sha256(value: string): string {
  return new Bun.CryptoHasher("sha256").update(value).digest("hex");
}

function gstinChecksum(body: string): string {
  let factor = 2;
  let sum = 0;
  for (let index = body.length - 1; index >= 0; index -= 1) {
    const character = body[index]!;
    const codePoint = GST_ALPHABET.indexOf(character);
    const addend = factor * codePoint;
    factor = factor === 2 ? 1 : 2;
    sum += Math.floor(addend / 36) + (addend % 36);
  }
  return GST_ALPHABET[(36 - (sum % 36)) % 36]!;
}

function gstinFor(stateCode: string): string {
  const body = `${stateCode}ABCDE1234F1Z`;
  return `${body}${gstinChecksum(body)}`;
}

function jurisdiction(overrides: Record<string, unknown> = {}) {
  return deepFreeze({
    extensionId: EXTENSION,
    ownerTenantId: TENANT,
    key: "in.order283.gst.27",
    version: "7",
    contentHash: HASH,
    ...overrides,
  });
}

function supplier(
  stateCode: unknown = "27",
  overrides: Record<string, unknown> = {},
): Readonly<Record<string, unknown>> {
  const canonicalState = typeof stateCode === "string" ? stateCode : "27";
  const values = {
    registrationId: SUPPLIER_REGISTRATION,
    propertyNode: PROPERTY,
    scheme: "in-gstin",
    currency: "INR",
    jurisdiction: jurisdiction(),
    gstin: gstinFor(canonicalState),
    stateCode,
    legalName: "Order 283 Hotel Private Limited",
    tradeName: "Order 283 Hotel",
    addressLine: "1 Marine Drive",
    locality: "Mumbai",
    postalCode: "400001",
    ...overrides,
  };
  const evidenceHash =
    typeof overrides.evidenceHash === "string"
      ? overrides.evidenceHash
      : sha256(
          JSON.stringify({
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
          }),
        );
  return deepFreeze({ ...values, evidenceHash });
}

interface PlaceOfSupplyOptions {
  readonly pos?: unknown;
  readonly supplier?: Readonly<Record<string, unknown>>;
  readonly recipientEvidenceHash?: string;
  readonly jurisdiction?: Readonly<Record<string, unknown>>;
  readonly bodyOverrides?: Record<string, unknown>;
  readonly candidateJson?: string;
  readonly candidateHash?: string;
}

function placeOfSupply(
  options: PlaceOfSupplyOptions = {},
): Readonly<Record<string, unknown>> {
  const supplierRoot = options.supplier ?? supplier();
  const pos = options.pos ?? "27";
  const selectedJurisdiction = options.jurisdiction ?? jurisdiction();
  const recipientEvidenceHash =
    options.recipientEvidenceHash ?? sha256("recipient:29");
  const body = {
    propertyNode: PROPERTY,
    reservationId: RESERVATION,
    folioId: FOLIO,
    jurisdiction: selectedJurisdiction,
    supplier: {
      registrationId: supplierRoot.registrationId,
      evidenceHash: supplierRoot.evidenceHash,
    },
    recipient: {
      partyId: PARTY,
      registrationId: REGISTRATION,
      evidenceHash: recipientEvidenceHash,
    },
    buyerAssociation: {
      associationHash: sha256(`association:${recipientEvidenceHash}`),
      payloadHash: sha256(`payload:${recipientEvidenceHash}`),
    },
    classification: {
      classificationId: CLASSIFICATION,
      evidenceHash: sha256("classification:room:996311"),
    },
    propertyLocation: {
      propertyNode: PROPERTY,
      evidenceHash: sha256(`property-location:${String(pos)}`),
    },
    legalRule: "IGST_ACT_12_3_B",
    pos,
    ...options.bodyOverrides,
  };
  const frozenBody = deepFreeze(body);
  const candidateJson = options.candidateJson ?? JSON.stringify(frozenBody);
  const candidateHash =
    options.candidateHash ??
    sha256(JSON.stringify({ tenantId: TENANT, candidate: frozenBody }));
  return deepFreeze({ ...frozenBody, candidateJson, candidateHash });
}

function input(
  supplierRoot: unknown = supplier(),
  posRoot: unknown = placeOfSupply({
    supplier: supplierRoot as Readonly<Record<string, unknown>>,
  }),
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    tenantId: TENANT,
    supplier: supplierRoot,
    placeOfSupply: posRoot,
    ...overrides,
  };
}

function expectedBody(
  supplierRoot: Readonly<Record<string, unknown>>,
  posRoot: Readonly<Record<string, unknown>>,
) {
  const supplierState = supplierRoot.stateCode as string;
  const pos = posRoot.pos as string;
  return {
    propertyNode: posRoot.propertyNode,
    reservationId: posRoot.reservationId,
    folioId: posRoot.folioId,
    jurisdiction: posRoot.jurisdiction,
    supplier: {
      registrationId: supplierRoot.registrationId,
      evidenceHash: supplierRoot.evidenceHash,
      stateCode: supplierState,
    },
    recipient: posRoot.recipient,
    buyerAssociation: posRoot.buyerAssociation,
    classification: posRoot.classification,
    placeOfSupply: {
      candidateHash: posRoot.candidateHash,
      legalRule: "IGST_ACT_12_3_B",
      pos,
    },
    comparisonRule: "SUPPLIER_REGISTERED_STATE_VS_ACCOMMODATION_POS",
    stateRelationship:
      supplierState === pos
        ? "same_state_or_union_territory"
        : "different_state_or_union_territory",
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

function expectComparisonError(candidate: unknown): void {
  expect(() =>
    buildIndiaGstAccommodationRegisteredStateComparison(candidate as never),
  ).toThrow(IndiaGstAccommodationRegisteredStateComparisonError);
}

test("Order 283 P0: exact bounded-context value function exists", () => {
  expect(typeof buildIndiaGstAccommodationRegisteredStateComparison).toBe(
    "function",
  );
});

test("Order 283 P1: same and different roots produce exact fixed frozen tenant-bound evidence", () => {
  for (const [supplierState, pos, relationship] of [
    ["27", "27", "same_state_or_union_territory"],
    ["27", "36", "different_state_or_union_territory"],
  ] as const) {
    const supplierRoot = supplier(supplierState);
    const posRoot = placeOfSupply({ pos, supplier: supplierRoot });
    const selected = input(supplierRoot, posRoot);
    const sourceBefore = JSON.stringify(selected);
    const first = buildIndiaGstAccommodationRegisteredStateComparison(
      selected as never,
    );
    const replay = buildIndiaGstAccommodationRegisteredStateComparison(
      selected as never,
    );
    const body = expectedBody(supplierRoot, posRoot);
    const candidateJson = JSON.stringify(body);

    expect(first).toEqual(replay);
    expect(first).toEqual({
      ...body,
      candidateJson,
      candidateHash: sha256(
        JSON.stringify({ tenantId: TENANT, candidate: body }),
      ),
    } as typeof first);
    expect(Object.keys(first)).toEqual([
      "propertyNode",
      "reservationId",
      "folioId",
      "jurisdiction",
      "supplier",
      "recipient",
      "buyerAssociation",
      "classification",
      "placeOfSupply",
      "comparisonRule",
      "stateRelationship",
      "candidateJson",
      "candidateHash",
    ]);
    expect(first.stateRelationship).toBe(relationship);
    expect(first.candidateJson).toBe(candidateJson);
    expect(JSON.parse(first.candidateJson)).not.toHaveProperty("tenantId");
    expect(first).not.toHaveProperty("tenantId");
    expect(first).not.toHaveProperty("intraState");
    expect(first).not.toHaveProperty("interState");
    expect(first).not.toHaveProperty("SupTyp");
    expect(first).not.toHaveProperty("IgstOnIntra");
    expect(first).not.toHaveProperty("ItemList");
    expectDeepFrozen(first);
    expect(JSON.stringify(selected)).toBe(sourceBefore);
  }
});

test("Order 283 P2: exhaustive current 36x36 matrix is exact and preserves leading zeroes", () => {
  let same = 0;
  let different = 0;
  for (const supplierState of GST_STATE_CODES) {
    for (const pos of GST_STATE_CODES) {
      const supplierRoot = supplier(supplierState);
      const posRoot = placeOfSupply({ pos, supplier: supplierRoot });
      const result = buildIndiaGstAccommodationRegisteredStateComparison(
        input(supplierRoot, posRoot) as never,
      );
      expect(result.supplier.stateCode).toBe(supplierState);
      expect(result.placeOfSupply.pos).toBe(pos);
      expect(result.stateRelationship).toBe(
        supplierState === pos
          ? "same_state_or_union_territory"
          : "different_state_or_union_territory",
      );
      if (result.stateRelationship === "same_state_or_union_territory")
        same += 1;
      else different += 1;
    }
  }
  expect(same).toBe(36);
  expect(different).toBe(1_260);
});

test("Order 283 P3: every recipient state lineage change is irrelevant to comparison", () => {
  const supplierRoot = supplier("27");
  for (const recipientState of GST_STATE_CODES) {
    const recipientEvidenceHash = sha256(`recipient-state:${recipientState}`);
    const samePos = placeOfSupply({
      pos: "27",
      supplier: supplierRoot,
      recipientEvidenceHash,
    });
    const differentPos = placeOfSupply({
      pos: "36",
      supplier: supplierRoot,
      recipientEvidenceHash,
    });
    expect(
      buildIndiaGstAccommodationRegisteredStateComparison(
        input(supplierRoot, samePos) as never,
      ).stateRelationship,
    ).toBe("same_state_or_union_territory");
    expect(
      buildIndiaGstAccommodationRegisteredStateComparison(
        input(supplierRoot, differentPos) as never,
      ).stateRelationship,
    ).toBe("different_state_or_union_territory");
  }
});

test("Order 283 P4: exact three-key input rejects hostile shapes before source access", () => {
  const exact = input();
  const hostile: unknown[] = [
    null,
    [],
    Object.assign(Object.create({ inherited: true }), exact),
    { ...exact, surplus: true },
    { ...exact, tenantId: "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA" },
    { ...exact, tenantId: "not-a-uuid" },
    new Proxy({ ...exact }, {}),
  ];
  for (const key of Object.keys(exact)) {
    const missing = { ...exact } as MutableRecord;
    delete missing[key];
    hostile.push(missing);
  }
  const accessor = { ...exact } as MutableRecord;
  Object.defineProperty(accessor, "supplier", {
    enumerable: true,
    get: () => supplier(),
  });
  hostile.push(accessor);
  const symbolic = { ...exact } as MutableRecord;
  symbolic[Symbol("hostile")] = true;
  hostile.push(symbolic);

  for (const candidate of hostile) expectComparisonError(candidate);
});

test("Order 283 P4: complete supplier and place-of-supply roots reject hostile exact shapes", () => {
  for (const [name, pristine] of [
    ["supplier", supplier()],
    ["placeOfSupply", placeOfSupply()],
  ] as const) {
    const variants: unknown[] = [
      null,
      [],
      Object.assign(Object.create({ inherited: true }), clone(pristine)),
      deepFreeze({ ...clone(pristine), surplus: true }),
      new Proxy(clone(pristine), {}),
      clone(pristine),
    ];
    for (const key of Object.keys(pristine)) {
      const missing = clone(pristine) as MutableRecord;
      delete missing[key];
      variants.push(deepFreeze(missing));
    }
    const accessor = clone(pristine) as MutableRecord;
    const firstKey = Object.keys(accessor)[0]!;
    const firstValue = accessor[firstKey];
    Object.defineProperty(accessor, firstKey, {
      enumerable: true,
      get: () => firstValue,
    });
    variants.push(deepFreeze(accessor));
    const symbolic = clone(pristine) as MutableRecord;
    symbolic[Symbol("hostile")] = true;
    variants.push(deepFreeze(symbolic));

    for (const variant of variants) {
      const selected =
        name === "supplier"
          ? input(variant, placeOfSupply())
          : input(supplier(), variant);
      const before = JSON.stringify(variant);
      expectComparisonError(selected);
      expect(JSON.stringify(variant)).toBe(before);
    }
  }
});

test("Order 283 P4: nested source shapes reject surplus, accessor, symbol, proxy and thaw", () => {
  const hostile: Array<Record<string, unknown>> = [];

  const supplierJurisdiction = clone(supplier().jurisdiction) as MutableRecord;
  supplierJurisdiction.surplus = true;
  hostile.push(
    input(
      supplier("27", { jurisdiction: deepFreeze(supplierJurisdiction) }),
      placeOfSupply(),
    ),
  );

  const posJurisdiction = clone(placeOfSupply().jurisdiction) as MutableRecord;
  Object.defineProperty(posJurisdiction, "key", {
    enumerable: true,
    get: () => "in.order283.gst.27",
  });
  hostile.push(
    input(
      supplier(),
      placeOfSupply({
        jurisdiction: Object.freeze(posJurisdiction) as Readonly<
          Record<string, unknown>
        >,
      }),
    ),
  );

  const recipient = clone(placeOfSupply().recipient) as MutableRecord;
  recipient[Symbol("hostile")] = true;
  hostile.push(
    input(
      supplier(),
      placeOfSupply({
        bodyOverrides: { recipient: deepFreeze(recipient) },
      }),
    ),
  );

  const buyerAssociation = new Proxy(
    clone(placeOfSupply().buyerAssociation as object),
    {},
  );
  hostile.push(
    input(supplier(), placeOfSupply({ bodyOverrides: { buyerAssociation } })),
  );

  const classification = clone(placeOfSupply().classification) as MutableRecord;
  classification.surplus = true;
  hostile.push(
    input(
      supplier(),
      placeOfSupply({
        bodyOverrides: { classification: deepFreeze(classification) },
      }),
    ),
  );

  const pristinePos = placeOfSupply();
  const thawedPropertyLocation = clone(pristinePos.propertyLocation);
  const thawedBody = {
    propertyNode: pristinePos.propertyNode,
    reservationId: pristinePos.reservationId,
    folioId: pristinePos.folioId,
    jurisdiction: pristinePos.jurisdiction,
    supplier: pristinePos.supplier,
    recipient: pristinePos.recipient,
    buyerAssociation: pristinePos.buyerAssociation,
    classification: pristinePos.classification,
    propertyLocation: thawedPropertyLocation,
    legalRule: pristinePos.legalRule,
    pos: pristinePos.pos,
  };
  hostile.push(
    input(
      supplier(),
      Object.freeze({
        ...thawedBody,
        candidateJson: JSON.stringify(thawedBody),
        candidateHash: sha256(
          JSON.stringify({ tenantId: TENANT, candidate: thawedBody }),
        ),
      }),
    ),
  );

  for (const candidate of hostile) expectComparisonError(candidate);
});

test("Order 283 P5/P6: source hashes, lineage, codes and candidate JSON fail closed", () => {
  const baseSupplier = supplier();
  const basePos = placeOfSupply({ supplier: baseSupplier });
  const other = id(28399);

  const hostile: Array<Record<string, unknown>> = [
    input(baseSupplier, basePos, { tenantId: other }),
    input(supplier("27", { evidenceHash: "x".repeat(64) }), basePos),
    input(supplier("27", { propertyNode: other }), basePos),
    input(supplier("27", { registrationId: other }), basePos),
    input(
      supplier("27", {
        jurisdiction: jurisdiction({ key: "in.order283.gst.29" }),
      }),
      basePos,
    ),
    input(
      baseSupplier,
      placeOfSupply({
        supplier: baseSupplier,
        candidateHash: "x".repeat(64),
      }),
    ),
    input(
      baseSupplier,
      placeOfSupply({
        supplier: baseSupplier,
        candidateJson: "{}",
      }),
    ),
    input(
      baseSupplier,
      placeOfSupply({
        supplier: baseSupplier,
        bodyOverrides: { propertyNode: other },
      }),
    ),
    input(
      baseSupplier,
      placeOfSupply({
        supplier: baseSupplier,
        bodyOverrides: {
          supplier: {
            registrationId: other,
            evidenceHash: baseSupplier.evidenceHash,
          },
        },
      }),
    ),
    input(
      baseSupplier,
      placeOfSupply({
        supplier: baseSupplier,
        bodyOverrides: {
          supplier: {
            registrationId: baseSupplier.registrationId,
            evidenceHash: "b".repeat(64),
          },
        },
      }),
    ),
    input(
      baseSupplier,
      placeOfSupply({
        supplier: baseSupplier,
        jurisdiction: jurisdiction({ version: "8" }),
      }),
    ),
    input(
      baseSupplier,
      placeOfSupply({
        supplier: baseSupplier,
        bodyOverrides: { legalRule: "SOME_OTHER_RULE" },
      }),
    ),
    input(
      baseSupplier,
      placeOfSupply({
        supplier: baseSupplier,
        bodyOverrides: { reservationId: "not-a-uuid" },
      }),
    ),
    input(
      baseSupplier,
      placeOfSupply({
        supplier: baseSupplier,
        bodyOverrides: { folioId: "not-a-uuid" },
      }),
    ),
    input(
      baseSupplier,
      placeOfSupply({
        supplier: baseSupplier,
        bodyOverrides: {
          recipient: {
            ...(basePos.recipient as object),
            partyId: "not-a-uuid",
          },
        },
      }),
    ),
    input(
      baseSupplier,
      placeOfSupply({
        supplier: baseSupplier,
        bodyOverrides: {
          recipient: {
            ...(basePos.recipient as object),
            registrationId: "not-a-uuid",
          },
        },
      }),
    ),
    input(
      baseSupplier,
      placeOfSupply({
        supplier: baseSupplier,
        bodyOverrides: {
          recipient: {
            ...(basePos.recipient as object),
            evidenceHash: "x".repeat(64),
          },
        },
      }),
    ),
    input(
      baseSupplier,
      placeOfSupply({
        supplier: baseSupplier,
        bodyOverrides: {
          buyerAssociation: {
            ...(basePos.buyerAssociation as object),
            associationHash: "x".repeat(64),
          },
        },
      }),
    ),
    input(
      baseSupplier,
      placeOfSupply({
        supplier: baseSupplier,
        bodyOverrides: {
          buyerAssociation: {
            ...(basePos.buyerAssociation as object),
            payloadHash: "x".repeat(64),
          },
        },
      }),
    ),
    input(
      baseSupplier,
      placeOfSupply({
        supplier: baseSupplier,
        bodyOverrides: {
          classification: {
            ...(basePos.classification as object),
            classificationId: "not-a-uuid",
          },
        },
      }),
    ),
    input(
      baseSupplier,
      placeOfSupply({
        supplier: baseSupplier,
        bodyOverrides: {
          classification: {
            ...(basePos.classification as object),
            evidenceHash: "x".repeat(64),
          },
        },
      }),
    ),
    input(
      baseSupplier,
      placeOfSupply({
        supplier: baseSupplier,
        bodyOverrides: {
          propertyLocation: {
            ...(basePos.propertyLocation as object),
            propertyNode: other,
          },
        },
      }),
    ),
    input(
      baseSupplier,
      placeOfSupply({
        supplier: baseSupplier,
        bodyOverrides: {
          propertyLocation: {
            ...(basePos.propertyLocation as object),
            evidenceHash: "x".repeat(64),
          },
        },
      }),
    ),
  ];

  for (const invalidState of [
    "00",
    "25",
    "28",
    "39",
    "27 ",
    " 27",
    "Maharashtra",
    "2",
    "027",
    27,
  ]) {
    hostile.push(input(supplier(invalidState), placeOfSupply()));
    hostile.push(
      input(
        baseSupplier,
        placeOfSupply({ pos: invalidState, supplier: baseSupplier }),
      ),
    );
  }

  const wrongChecksumSupplier = supplier("27", { gstin: "27ABCDE1234F1ZA" });
  hostile.push(input(wrongChecksumSupplier, placeOfSupply()));

  for (const candidate of hostile) expectComparisonError(candidate);
});

test("Order 283 P6: replay and every rejection preserve all caller bytes", () => {
  const supplierRoot = supplier("27");
  const posRoot = placeOfSupply({ pos: "36", supplier: supplierRoot });
  const selected = input(supplierRoot, posRoot);
  const before = JSON.stringify(selected);
  const first = buildIndiaGstAccommodationRegisteredStateComparison(
    selected as never,
  );
  const replay = buildIndiaGstAccommodationRegisteredStateComparison(
    selected as never,
  );
  expect(first).toEqual(replay);
  expect(JSON.stringify(selected)).toBe(before);

  const rejectedSupplier = supplier("27", { evidenceHash: "c".repeat(64) });
  const rejected = input(rejectedSupplier, placeOfSupply());
  const rejectedBefore = JSON.stringify(rejected);
  expectComparisonError(rejected);
  expect(JSON.stringify(rejected)).toBe(rejectedBefore);
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
  const period = "[2036-01-01 15:00:00+00,2036-01-02 15:00:00+00)";
  const snapshot = createPositiveTaxAttributionSnapshot({
    origin: { kind: "rate_quote", quoteHash },
    currency: "INR",
    line: {
      lineId: "room",
      revenueGroup: "room_revenue",
      amountMinor: 10_000n,
      nights: 1,
      personNights: 2,
      roomNights: [{ businessDate: "2036-01-01", amountMinor: 10_000n }],
    },
    assignments: [
      {
        businessDate: "2036-01-01",
        jurisdictionKey: "in.order283.gst.27",
        evidenceRef: `tax-assignment:${quoteHash}`,
      },
    ],
    jurisdiction: {
      extensionId: EXTENSION,
      ownerTenantId: TENANT,
      key: "in.order283.gst.27",
      version: 7,
      contentHash: HASH,
      evidenceRef: `tax-jurisdiction:${"3".repeat(64)}`,
    },
    evaluation: {
      schemaVersion: 1,
      jurisdictionKey: "in.order283.gst.27",
      country: "IN",
      priceDisplay: "tax_exclusive",
      rounding: "line",
      inputTotalMinor: 10_000n,
      baseTotalMinor: 10_000n,
      taxTotalMinor: 500n,
      grandTotalMinor: 10_500n,
      taxes: [
        {
          code: "GST_ROOM",
          name: "Aggregate GST evidence",
          taxMinor: 500n,
          components: [
            {
              lineId: "room",
              revenueGroup: "room_revenue",
              baseMinor: 10_000n,
              taxMinor: 500n,
              rateBasisPoints: 500,
            },
          ],
        },
      ],
    },
  });

  await deploy!`INSERT INTO tenant(id,slug,name,tier,status) VALUES
    (${TENANT}::uuid,'order283-db','Order 283 PostgreSQL','shared','active')`;
  await deploy!`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES
    (${PROPERTY}::uuid,${TENANT}::uuid,'order283db.property'::ltree,'property',
     'Order 283 Hotel','Asia/Kolkata','INR')`;
  await deploy!`INSERT INTO app_user(id,tenant_id,email,display_name,status) VALUES
    (${ACTOR}::uuid,${TENANT}::uuid,'actor@order283-db.local','Order 283 Actor','active')`;
  await deploy!`INSERT INTO party(id,tenant_id,kind,display_name,legal_name,status) VALUES
    (${GUEST}::uuid,${TENANT}::uuid,'person','Order 283 Guest',NULL,'active'),
    (${PARTY}::uuid,${TENANT}::uuid,'org','Order 283 Buyer',
     'Order 283 Buyer Private Limited','active')`;
  await deploy!`INSERT INTO party_role(tenant_id,party_id,role) VALUES
    (${TENANT}::uuid,${GUEST}::uuid,'guest'),
    (${TENANT}::uuid,${PARTY}::uuid,'company')`;
  await deploy!`INSERT INTO unit_type(
      id,tenant_id,property_node,code,name,profile_key,max_occupancy
    ) VALUES (
      ${UNIT_TYPE}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'O283',
      'Order 283 Room','hotel',4
    )`;
  await deploy!`INSERT INTO sellable_unit(id,tenant_id,unit_type_id,name,status) VALUES
    (${SELLABLE}::uuid,${TENANT}::uuid,${UNIT_TYPE}::uuid,'Order 283 Sellable','active')`;
  await deploy!`INSERT INTO rate_plan(
      id,tenant_id,property_node,code,name,currency,tax_inclusive,status
    ) VALUES (
      ${RATE_PLAN}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'O283-IN',
      'Order 283 India','INR',false,'active'
    )`;
  await deploy!`INSERT INTO extension(
      id,tenant_id,type,key,version,effective,content,status
    ) VALUES (
      ${EXTENSION}::uuid,${TENANT}::uuid,'tax_jurisdiction','in.order283.gst.27',7,
      '[2030-01-01 00:00:00+00,)'::tstzrange,
      '{"country":"IN","price_display":"tax_exclusive","rounding":"line","taxes":[]}'::jsonb,
      'active'
    )`;
  await deploy!`INSERT INTO reservation(
      id,tenant_id,property_node,confirmation_no,status,primary_party,booker_party,
      channel_code,currency
    ) VALUES (
      ${RESERVATION}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'O283-DB','in_house',
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
      ${period}::tstzrange,'cart','{}'::jsonb,'2036-01-02 15:00:00+00','consumed'
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
      'Order 283 Guest Account','INR','open'
    )`;
  await deploy!`INSERT INTO folio(
      id,tenant_id,account_id,reservation_id,folio_no,window_no,name,status
    ) VALUES (
      ${FOLIO}::uuid,${TENANT}::uuid,${ACCOUNT}::uuid,${RESERVATION}::uuid,
      'O283-DB-1',1,'Business Invoice','open'
    )`;
  await deploy!`INSERT INTO party_fiscal_registration(
      tenant_id,id,party_id,scheme,registration_number,region_code,legal_name,
      trade_name,address_line1,locality,pin
    ) VALUES (
      ${TENANT}::uuid,${REGISTRATION}::uuid,${PARTY}::uuid,'in-gstin',
      '29ABCDE1234F1ZW','29','Order 283 Buyer Private Limited','Order 283 Buyer',
      '1 Residency Road','Bengaluru','560001'
    )`;
  await deploy!`INSERT INTO property_fiscal_registration(
      tenant_id,id,property_node,scheme,currency,jurisdiction_extension_id,
      jurisdiction_owner_tenant_id,jurisdiction_key,jurisdiction_version,
      jurisdiction_content_hash,registration_number,region_code,legal_name,
      trade_name,address_line,locality,postal_code
    ) VALUES (
      ${TENANT}::uuid,${SUPPLIER_REGISTRATION}::uuid,${PROPERTY}::uuid,'in-gstin','INR',
      ${EXTENSION}::uuid,${TENANT}::uuid,'in.order283.gst.27',7,${HASH},
      '27AAPFU0939F1ZV','27','Order 283 Hotel Private Limited','Order 283 Hotel',
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
      ${TENANT}::uuid,'in.order283.gst.27',7,${HASH},'IN','room','room_revenue',
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

databaseDescribe("Order 283 PostgreSQL approved-source composition", () => {
  beforeAll(async () => {
    deploy = new SQL(DEPLOY_URL!, { max: 8, prepare: false });
    database = Database.connect(RUNTIME_URL!, {
      maxConnections: 8,
      prepare: false,
    });
    await cleanupDatabaseFixture();
    await seedDatabaseFixture();
  });

  afterAll(async () => {
    await cleanupDatabaseFixture();
    await database?.close();
    await deploy?.close({ timeout: 0 });
  });

  test("P8: actual Order272 and Order282 roots compose exact different-code evidence with zero writes", async () => {
    const supplierService = new IndiaGstSupplierRegistrationService();
    const posService = new IndiaGstAccommodationPlaceOfSupplyService();
    const before = await databaseCounts();
    const resolve = () =>
      database!.withTenantTransaction(TENANT, async (tx) => {
        const supplierRoot = await supplierService.resolve(tx, {
          tenantId: TENANT,
          propertyNode: PROPERTY,
          reservationId: RESERVATION,
        });
        const posRoot = await posService.resolve(tx, {
          tenantId: TENANT,
          propertyNode: PROPERTY,
          reservationId: RESERVATION,
          folioId: FOLIO,
          recipientPartyId: PARTY,
          recipientRegistrationId: REGISTRATION,
          classificationId: CLASSIFICATION,
        });
        return buildIndiaGstAccommodationRegisteredStateComparison({
          tenantId: TENANT,
          supplier: supplierRoot,
          placeOfSupply: posRoot,
        });
      });

    const first = await resolve();
    const replay = await resolve();
    expect(first).toEqual(replay);
    expect(first.supplier.stateCode).toBe("27");
    expect(first.placeOfSupply.pos).toBe("36");
    expect(first.stateRelationship).toBe("different_state_or_union_territory");
    expect(first.propertyNode).toBe(PROPERTY);
    expect(first.reservationId).toBe(RESERVATION);
    expect(first.folioId).toBe(FOLIO);
    expect(first.candidateHash).toBe(
      sha256(
        JSON.stringify({
          tenantId: TENANT,
          candidate: JSON.parse(first.candidateJson),
        }),
      ),
    );
    expectDeepFrozen(first);
    expect(await databaseCounts()).toEqual(before);
  });
});

test("Order 283 P7: source is pure comparison authority with static forbidden canaries", async () => {
  const source = await Bun.file(
    new URL(
      "../src/contexts/tax-fiscal/india-gst-accommodation-registered-state-comparison.ts",
      import.meta.url,
    ),
  ).text();

  expect(source).toContain("SUPPLIER_REGISTERED_STATE_VS_ACCOMMODATION_POS");
  expect(source).toContain("same_state_or_union_territory");
  expect(source).toContain("different_state_or_union_territory");
  expect(source).not.toContain('from "../../kernel"');
  expect(source).not.toMatch(/\b(?:Tx|SQL|Database)\b/);
  expect(source).not.toMatch(
    /\b(?:INSERT\s+INTO|UPDATE\s+[A-Za-z_]|DELETE\s+FROM|SELECT\s+)\b/i,
  );
  expect(source).not.toMatch(
    /\b(?:FOR\s+UPDATE|FOR\s+SHARE|pg_advisory|lock_financial_rows)\b/i,
  );
  expect(source).not.toMatch(
    /\b(?:recordFact|publish|emit|idempotency|document_series)\b/i,
  );
  expect(source).not.toMatch(
    /\b(?:journal|posting_line|fiscal_submission|outbox)\b/i,
  );
  expect(source).not.toMatch(
    /\b(?:intraState|interState|decomposition|CGST|SGST|UTGST)\b/,
  );
  expect(source).not.toMatch(
    /\b(?:SupTyp|IgstOnIntra|reverseCharge|B2C|URP|deemedExport)\b/,
  );
  expect(source).not.toMatch(
    /\b(?:ItemList|SlNo|Qty|Unit|UnitPrice|TotAmt|AssAmt|GstRt|CgstAmt|SgstAmt|IgstAmt)\b/,
  );
  expect(source).not.toMatch(/recipient(?:Evidence)?\.stateCode/);
  expect(source).not.toMatch(
    /(?:guest|account|org|profile|config|address)(?:Evidence)?\.stateCode/,
  );
  expect(source).not.toMatch(
    /new\s+IndiaGst(?:Supplier|AccommodationPlaceOfSupply)/,
  );
});
