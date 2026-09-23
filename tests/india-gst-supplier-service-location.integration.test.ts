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
  IndiaGstSupplierServiceLocationConflictError,
  IndiaGstSupplierServiceLocationNotFoundError,
  IndiaGstSupplierServiceLocationService,
  IndiaGstSupplierServiceLocationValidationError,
  createPositiveTaxAttributionSnapshot,
} from "../src/contexts/tax-fiscal";
import { Database, type Tx } from "../src/kernel";

setDefaultTimeout(60_000);

const DEPLOY_URL = process.env.YELLOW_DEPLOY_DATABASE_URL;
const RUNTIME_URL =
  process.env.YELLOW_ORDER284_DATABASE_URL ??
  process.env.YELLOW_RUNTIME_DATABASE_URL;
if (
  process.env.YELLOW_REQUIRE_ORDER284_DATABASE === "1" &&
  (!DEPLOY_URL || !RUNTIME_URL)
) {
  throw new Error(
    "Order 284 supplier-service-location proof requires deploy and runtime URLs",
  );
}
const databaseDescribe =
  DEPLOY_URL && RUNTIME_URL ? describe.serial : describe.skip;

const id = (suffix: number): string =>
  `00000000-0000-0000-0000-${String(suffix).padStart(12, "0")}`;

const TENANT_A = id(28401);
const TENANT_B = id(28402);
const PROPERTY_A = id(28411);
const PROPERTY_A_OTHER = id(28412);
const PROPERTY_B = id(28413);
const RESERVATION_A = id(28421);
const RESERVATION_OTHER = id(28422);
const ACCOUNT_A = id(28423);
const FOLIO_A = id(28424);
const EXTENSION_A = id(28431);
const EXTENSION_B = id(28432);
const REGISTRATION_A = id(28441);
const REGISTRATION_A_STALE = id(28442);
const REGISTRATION_B = id(28443);
const LOCATION_A = id(28451);
const LOCATION_A_ADDITIONAL = id(28452);
const LOCATION_B = id(28453);
const ACTOR_A = id(28461);
const GUEST_A = id(28462);
const UNIT_TYPE_A = id(28463);
const SELLABLE_A = id(28464);
const RATE_PLAN_A = id(28465);
const SEGMENT_A = id(28466);
const HOLD_A = id(28467);
const ATTRIBUTION_A = id(28468);
const HOLD_BINDING_A = id(28469);
const LINEAGE_A = id(28470);
const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const KEY_A = "in.order284.gst.27";
const KEY_B = "in.order284.gst.29";

type MutableRecord = Record<PropertyKey, unknown>;

interface AssignmentRow {
  readonly tenant_id: string;
  readonly id: string;
  readonly supplier_registration_id: string;
  readonly supplier_evidence_hash: string;
  readonly service_scope: string;
  readonly registered_place_kind: string;
  readonly location_basis: string;
  readonly legal_rule: string;
}

interface AssignmentOptions {
  readonly tenantId?: string;
  readonly id?: string;
  readonly registrationId?: string;
  readonly supplierEvidenceHash?: string;
  readonly serviceScope?: string;
  readonly registeredPlaceKind?: string;
  readonly locationBasis?: string;
  readonly legalRule?: string;
}

function sha256(value: string): string {
  return new Bun.CryptoHasher("sha256").update(value).digest("hex");
}

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

function expectDeepFrozen(value: unknown, seen = new Set<object>()): void {
  if (typeof value !== "object" || value === null || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBeTrue();
  for (const key of Reflect.ownKeys(value)) {
    expectDeepFrozen((value as MutableRecord)[key], seen);
  }
}

function input(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    tenantId: TENANT_A,
    propertyNode: PROPERTY_A,
    reservationId: RESERVATION_A,
    supplierServiceLocationId: LOCATION_A,
    ...overrides,
  };
}

function jurisdiction(overrides: Record<string, unknown> = {}) {
  return deepFreeze({
    extensionId: EXTENSION_A,
    ownerTenantId: TENANT_A,
    key: KEY_A,
    version: "7",
    contentHash: HASH_A,
    ...overrides,
  });
}

function supplier(overrides: Record<string, unknown> = {}) {
  const values = {
    registrationId: REGISTRATION_A,
    propertyNode: PROPERTY_A,
    scheme: "in-gstin",
    currency: "INR",
    jurisdiction: jurisdiction(),
    gstin: "27AAPFU0939F1ZV",
    stateCode: "27",
    legalName: "Order 284 Hospitality Private Limited",
    tradeName: "Order 284 Hotel",
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
            tenantId: TENANT_A,
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

function assignmentRow(overrides: Partial<AssignmentRow> = {}): AssignmentRow {
  const root = supplier();
  return {
    tenant_id: TENANT_A,
    id: LOCATION_A,
    supplier_registration_id: REGISTRATION_A,
    supplier_evidence_hash: root.evidenceHash,
    service_scope: "lodging_accommodation",
    registered_place_kind: "principal_place_of_business",
    location_basis: "supply_made_from_registered_place_of_business",
    legal_rule: "IGST_ACT_2_15_A",
    ...overrides,
  };
}

function fakeTx(rows: readonly AssignmentRow[], statements?: string[]): Tx {
  return (async (strings: TemplateStringsArray) => {
    statements?.push(strings.join("?"));
    return rows;
  }) as unknown as Tx;
}

function harness(
  supplierRoot: unknown = supplier(),
  rows: readonly AssignmentRow[] = [assignmentRow()],
  statements?: string[],
) {
  const calls: unknown[] = [];
  const service = new IndiaGstSupplierServiceLocationService({
    async resolve(_tx: Tx, selected: unknown) {
      calls.push(selected);
      return supplierRoot as never;
    },
  });
  return { service, tx: fakeTx(rows, statements), calls };
}

function expectedBody(
  kind:
    | "principal_place_of_business"
    | "additional_place_of_business" = "principal_place_of_business",
) {
  const root = supplier();
  return {
    supplierServiceLocationId: LOCATION_A,
    propertyNode: PROPERTY_A,
    jurisdiction: root.jurisdiction,
    supplier: {
      registrationId: REGISTRATION_A,
      evidenceHash: root.evidenceHash,
    },
    serviceScope: "lodging_accommodation" as const,
    registeredPlace: {
      kind,
      stateCode: "27",
      addressLine: "1 Marine Drive",
      locality: "Mumbai",
      postalCode: "400001",
    },
    locationBasis: "supply_made_from_registered_place_of_business" as const,
    legalRule: "IGST_ACT_2_15_A" as const,
  };
}

function expectedEvidenceHash(body: ReturnType<typeof expectedBody>): string {
  return sha256(JSON.stringify({ tenantId: TENANT_A, ...body }));
}

function sqlState(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const postgres = error as { errno?: unknown; code?: unknown };
  if (typeof postgres.errno === "string") return postgres.errno;
  return typeof postgres.code === "string" ? postgres.code : undefined;
}

async function expectSqlState(
  operation: Promise<unknown>,
  expected: string,
): Promise<void> {
  try {
    await operation;
    throw new Error(`expected PostgreSQL SQLSTATE ${expected}`);
  } catch (error) {
    expect(sqlState(error)).toBe(expected);
  }
}

test("Order 284 P0: exact migration and bounded-context resolver exist", async () => {
  expect(typeof IndiaGstSupplierServiceLocationService).toBe("function");
  const sql = await Bun.file(
    new URL(
      "../migrations/0051_india_gst_supplier_service_location.sql",
      import.meta.url,
    ),
  ).text();
  expect(sql).toContain(
    "CREATE TABLE public.india_gst_supplier_service_location",
  );
  expect(sql).toContain("FOREIGN KEY (tenant_id, supplier_registration_id)");
  expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
  expect(sql).toContain("FORCE ROW LEVEL SECURITY");
  expect(sql).toContain(
    "GRANT SELECT ON TABLE public.india_gst_supplier_service_location TO app_role",
  );
});

test("Order 284 P1: principal and additional registered places produce exact frozen tenant-bound evidence", async () => {
  for (const kind of [
    "principal_place_of_business",
    "additional_place_of_business",
  ] as const) {
    const selected = input();
    const selectedBefore = JSON.stringify(selected);
    const root = supplier();
    const rootBefore = JSON.stringify(root);
    const target = harness(root, [
      assignmentRow({ registered_place_kind: kind }),
    ]);
    const first = await target.service.resolve(target.tx, selected as never);
    const replay = await target.service.resolve(target.tx, selected as never);
    const body = expectedBody(kind);

    expect(first).toEqual(replay);
    expect(first).toEqual({
      ...body,
      evidenceHash: expectedEvidenceHash(body),
    });
    expect(Object.keys(first)).toEqual([
      "supplierServiceLocationId",
      "propertyNode",
      "jurisdiction",
      "supplier",
      "serviceScope",
      "registeredPlace",
      "locationBasis",
      "legalRule",
      "evidenceHash",
    ]);
    expect(Object.keys(first.registeredPlace)).toEqual([
      "kind",
      "stateCode",
      "addressLine",
      "locality",
      "postalCode",
    ]);
    expect(first.evidenceHash).toBe(expectedEvidenceHash(body));
    expect(first).not.toHaveProperty("tenantId");
    expect(first).not.toHaveProperty("gstin");
    expect(first).not.toHaveProperty("intraState");
    expect(first).not.toHaveProperty("interState");
    expect(first).not.toHaveProperty("SupTyp");
    expect(first).not.toHaveProperty("IgstOnIntra");
    expectDeepFrozen(first);
    expect(JSON.stringify(selected)).toBe(selectedBefore);
    expect(JSON.stringify(root)).toBe(rootBefore);
    expect(target.calls).toEqual([
      {
        tenantId: TENANT_A,
        propertyNode: PROPERTY_A,
        reservationId: RESERVATION_A,
      },
      {
        tenantId: TENANT_A,
        propertyNode: PROPERTY_A,
        reservationId: RESERVATION_A,
      },
    ]);
  }
});

test("Order 284 P2: resolver performs one exact SELECT and no heuristic or effect query", async () => {
  const statements: string[] = [];
  const target = harness(supplier(), [assignmentRow()], statements);
  await target.service.resolve(target.tx, input() as never);
  expect(statements).toHaveLength(1);
  expect(statements[0]).toContain("public.india_gst_supplier_service_location");
  expect(statements[0]).toContain("current_setting('app.tenant_id', true)");
  expect(statements[0]).toContain("supplier_registration_id");
  expect(statements[0]).toContain("supplier_evidence_hash");
  expect(statements[0]).not.toMatch(
    /property_fiscal_location|party_fiscal_registration|india_gst_item_classification|org_node|profile|config|SellerDtls|registered_state/i,
  );
  expect(statements[0]).not.toMatch(
    /\b(?:INSERT|UPDATE|DELETE|FOR\s+UPDATE|FOR\s+SHARE|pg_advisory)\b/i,
  );
});

test("Order 284 P3: exact accessor/proxy/symbol-free four-UUID input is mandatory before dependency or SQL", async () => {
  const exact = input();
  const hostile: unknown[] = [
    null,
    [],
    Object.assign(Object.create({ inherited: true }), exact),
    { ...exact, extra: true },
    { ...exact, tenantId: "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA" },
    { ...exact, propertyNode: "not-a-uuid" },
    { ...exact, reservationId: "not-a-uuid" },
    { ...exact, supplierServiceLocationId: "not-a-uuid" },
    new Proxy({ ...exact }, {}),
  ];
  for (const key of Object.keys(exact)) {
    const missing = { ...exact } as MutableRecord;
    delete missing[key];
    hostile.push(missing);
  }
  const accessor = { ...exact } as MutableRecord;
  Object.defineProperty(accessor, "supplierServiceLocationId", {
    enumerable: true,
    get: () => LOCATION_A,
  });
  hostile.push(accessor);
  const symbolic = { ...exact } as MutableRecord;
  symbolic[Symbol("hostile")] = true;
  hostile.push(symbolic);

  for (const candidate of hostile) {
    const target = harness();
    await expect(
      target.service.resolve(target.tx, candidate as never),
    ).rejects.toBeInstanceOf(IndiaGstSupplierServiceLocationValidationError);
    expect(target.calls).toHaveLength(0);
  }
  const target = harness();
  await expect(
    target.service.resolve(undefined as unknown as Tx, exact as never),
  ).rejects.toBeInstanceOf(IndiaGstSupplierServiceLocationValidationError);
  expect(target.calls).toHaveLength(0);
});

test("Order 284 P4: complete frozen Order272 supplier evidence is independently revalidated", async () => {
  const pristine = supplier();
  const hostile: unknown[] = [
    null,
    [],
    deepFreeze({ ...pristine, extra: true }),
    new Proxy(clone(pristine), {}),
    clone(pristine),
  ];
  for (const key of Object.keys(pristine)) {
    const missing = clone(pristine) as MutableRecord;
    delete missing[key];
    hostile.push(deepFreeze(missing));
  }
  const accessor = clone(pristine) as MutableRecord;
  Object.defineProperty(accessor, "evidenceHash", {
    enumerable: true,
    get: () => pristine.evidenceHash,
  });
  hostile.push(Object.freeze(accessor));
  const symbolic = clone(pristine) as MutableRecord;
  symbolic[Symbol("hostile")] = true;
  hostile.push(deepFreeze(symbolic));

  for (const root of hostile) {
    const before = JSON.stringify(root);
    const target = harness(root);
    await expect(
      target.service.resolve(target.tx, input() as never),
    ).rejects.toBeInstanceOf(IndiaGstSupplierServiceLocationConflictError);
    expect(JSON.stringify(root)).toBe(before);
  }
});

test("Order 284 P4: supplier lineage, hash, registered place bytes and India premises cannot be cross-mixed", async () => {
  const other = id(28499);
  const defects: readonly Record<string, unknown>[] = [
    { registrationId: other },
    { propertyNode: other },
    { scheme: "gstin" },
    { currency: "USD" },
    { jurisdiction: jurisdiction({ extensionId: other }) },
    { jurisdiction: jurisdiction({ ownerTenantId: other }) },
    { jurisdiction: jurisdiction({ key: KEY_B }) },
    { jurisdiction: jurisdiction({ version: "8" }) },
    { jurisdiction: jurisdiction({ contentHash: HASH_B }) },
    { gstin: "29ABCDE1234F1Z5" },
    { stateCode: "29" },
    { legalName: "Changed supplier" },
    { tradeName: "Changed hotel" },
    { addressLine: "2 Changed Road" },
    { locality: "Bengaluru" },
    { postalCode: "560001" },
    { evidenceHash: "f".repeat(64) },
  ];
  for (const defect of defects) {
    const target = harness(supplier(defect));
    await expect(
      target.service.resolve(target.tx, input() as never),
    ).rejects.toBeInstanceOf(IndiaGstSupplierServiceLocationConflictError);
  }
});

test("Order 284 P5: missing, duplicate and hostile stored assignment shapes fail closed", async () => {
  await expect(
    harness(supplier(), []).service.resolve(fakeTx([]), input() as never),
  ).rejects.toBeInstanceOf(IndiaGstSupplierServiceLocationNotFoundError);

  const duplicate = harness(supplier(), [assignmentRow(), assignmentRow()]);
  await expect(
    duplicate.service.resolve(duplicate.tx, input() as never),
  ).rejects.toBeInstanceOf(IndiaGstSupplierServiceLocationConflictError);

  const pristine = assignmentRow();
  const hostile: unknown[] = [];
  for (const key of Object.keys(pristine)) {
    const missing = { ...pristine } as MutableRecord;
    delete missing[key];
    hostile.push(missing);
  }
  hostile.push({ ...pristine, surplus: true });
  const accessor = { ...pristine } as MutableRecord;
  Object.defineProperty(accessor, "registered_place_kind", {
    enumerable: true,
    get: () => "principal_place_of_business",
  });
  hostile.push(accessor);
  const symbolic = { ...pristine } as MutableRecord;
  symbolic[Symbol("hostile")] = true;
  hostile.push(symbolic, new Proxy({ ...pristine }, {}));

  for (const row of hostile) {
    const target = harness(supplier(), [row as AssignmentRow]);
    await expect(
      target.service.resolve(target.tx, input() as never),
    ).rejects.toBeInstanceOf(IndiaGstSupplierServiceLocationConflictError);
  }
});

test("Order 284 P5: assignment identity, current supplier hash and fixed statutory constants fail closed", async () => {
  const defects: readonly Partial<AssignmentRow>[] = [
    { tenant_id: TENANT_B },
    { id: LOCATION_A_ADDITIONAL },
    { supplier_registration_id: REGISTRATION_A_STALE },
    { supplier_evidence_hash: HASH_B },
    { service_scope: "restaurant_service" },
    { registered_place_kind: "fixed_establishment" },
    { registered_place_kind: "usual_residence" },
    { location_basis: "gstin_state_prefix" },
    { legal_rule: "IGST_ACT_2_15_B" },
    { legal_rule: "IGST_ACT_2_15_C" },
    { legal_rule: "IGST_ACT_2_15_D" },
  ];
  for (const defect of defects) {
    const target = harness(supplier(), [assignmentRow(defect)]);
    await expect(
      target.service.resolve(target.tx, input() as never),
    ).rejects.toBeInstanceOf(IndiaGstSupplierServiceLocationConflictError);
  }
});

test("Order 284 P6: replay and every rejection preserve caller and supplier bytes", async () => {
  const selected = input();
  const root = supplier();
  const before = JSON.stringify({ selected, root });
  const target = harness(root);
  await target.service.resolve(target.tx, selected as never);
  await target.service.resolve(target.tx, selected as never);
  const rejected = harness(root, [
    assignmentRow({ supplier_evidence_hash: HASH_B }),
  ]);
  await expect(
    rejected.service.resolve(rejected.tx, selected as never),
  ).rejects.toBeInstanceOf(IndiaGstSupplierServiceLocationConflictError);
  expect(JSON.stringify({ selected, root })).toBe(before);
});

let deploy: SQL | undefined;
let database: Database | undefined;

async function seedAssignment(
  options: AssignmentOptions = {},
): Promise<string> {
  const locationId = options.id ?? crypto.randomUUID();
  const evidence = supplier();
  await deploy!`INSERT INTO india_gst_supplier_service_location(
      tenant_id,id,supplier_registration_id,supplier_evidence_hash,service_scope,
      registered_place_kind,location_basis,legal_rule
    ) VALUES (
      ${options.tenantId ?? TENANT_A}::uuid,${locationId}::uuid,
      ${options.registrationId ?? REGISTRATION_A}::uuid,
      ${options.supplierEvidenceHash ?? evidence.evidenceHash},
      ${options.serviceScope ?? "lodging_accommodation"},
      ${options.registeredPlaceKind ?? "principal_place_of_business"},
      ${options.locationBasis ?? "supply_made_from_registered_place_of_business"},
      ${options.legalRule ?? "IGST_ACT_2_15_A"}
    )`;
  return locationId;
}

async function clearAssignments(): Promise<void> {
  await deploy!`DELETE FROM india_gst_supplier_service_location
    WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
}

async function cleanupDatabaseFixture(): Promise<void> {
  if (!deploy) return;
  await clearAssignments();
  await deploy`DELETE FROM fiscal_submission WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM posting_line WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM journal WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM document WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM outbox WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM fact_log WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM india_gst_item_classification WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM property_fiscal_location WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM property_fiscal_registration WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM party_fiscal_registration WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM folio WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM account WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM tax_attribution_reservation_binding WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM reservation_guest WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM reservation_segment WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM reservation WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM tax_attribution_hold_binding WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM hold WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM tax_attribution_snapshot WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM sellable_unit WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM unit_type WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM rate_plan WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM party_role WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM party WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM app_user WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM extension WHERE id IN (${EXTENSION_A}::uuid,${EXTENSION_B}::uuid)`;
  await deploy`DELETE FROM org_node WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM tenant WHERE id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
}

async function seedDatabaseFixture(): Promise<void> {
  const quoteHash = "2".repeat(64);
  const period = "[2037-01-01 15:00:00+00,2037-01-02 15:00:00+00)";
  const snapshot = createPositiveTaxAttributionSnapshot({
    origin: { kind: "rate_quote", quoteHash },
    currency: "INR",
    line: {
      lineId: "room",
      revenueGroup: "room_revenue",
      amountMinor: 10_000n,
      nights: 1,
      personNights: 2,
      roomNights: [{ businessDate: "2037-01-01", amountMinor: 10_000n }],
    },
    assignments: [
      {
        businessDate: "2037-01-01",
        jurisdictionKey: KEY_A,
        evidenceRef: `tax-assignment:${quoteHash}`,
      },
    ],
    jurisdiction: {
      extensionId: EXTENSION_A,
      ownerTenantId: TENANT_A,
      key: KEY_A,
      version: 7,
      contentHash: HASH_A,
      evidenceRef: `tax-jurisdiction:${"3".repeat(64)}`,
    },
    evaluation: {
      schemaVersion: 1,
      jurisdictionKey: KEY_A,
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
    (${TENANT_A}::uuid,'order284-a','Order 284 A','shared','active'),
    (${TENANT_B}::uuid,'order284-b','Order 284 B','shared','active')`;
  await deploy!`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency,config) VALUES
    (${PROPERTY_A}::uuid,${TENANT_A}::uuid,'order284a.property'::ltree,'property',
     'Misleading Karnataka Fixed Establishment','Asia/Kolkata','INR',
     '{"supplier_location":"fixed_establishment","state":"29","sez":true}'::jsonb),
    (${PROPERTY_A_OTHER}::uuid,${TENANT_A}::uuid,'order284a.other'::ltree,'property',
     'Order 284 Other','Asia/Kolkata','INR','{}'::jsonb),
    (${PROPERTY_B}::uuid,${TENANT_B}::uuid,'order284b.property'::ltree,'property',
     'Order 284 Foreign','Asia/Kolkata','INR','{}'::jsonb)`;
  await deploy!`INSERT INTO app_user(id,tenant_id,email,display_name,status) VALUES
    (${ACTOR_A}::uuid,${TENANT_A}::uuid,'actor@order284.local','Order 284 Actor','active')`;
  await deploy!`INSERT INTO party(id,tenant_id,kind,display_name,status) VALUES
    (${GUEST_A}::uuid,${TENANT_A}::uuid,'person','Order 284 Guest','active')`;
  await deploy!`INSERT INTO party_role(tenant_id,party_id,role) VALUES
    (${TENANT_A}::uuid,${GUEST_A}::uuid,'guest')`;
  await deploy!`INSERT INTO unit_type(
      id,tenant_id,property_node,code,name,profile_key,max_occupancy
    ) VALUES (
      ${UNIT_TYPE_A}::uuid,${TENANT_A}::uuid,${PROPERTY_A}::uuid,'O284',
      'Order 284 Room','hotel',4
    )`;
  await deploy!`INSERT INTO sellable_unit(id,tenant_id,unit_type_id,name,status) VALUES
    (${SELLABLE_A}::uuid,${TENANT_A}::uuid,${UNIT_TYPE_A}::uuid,
     'Order 284 Sellable','active')`;
  await deploy!`INSERT INTO rate_plan(
      id,tenant_id,property_node,code,name,currency,tax_inclusive,status
    ) VALUES (
      ${RATE_PLAN_A}::uuid,${TENANT_A}::uuid,${PROPERTY_A}::uuid,'O284-IN',
      'Order 284 India','INR',false,'active'
    )`;
  await deploy!`INSERT INTO extension(
      id,tenant_id,type,key,version,effective,content,status
    ) VALUES
    (${EXTENSION_A}::uuid,${TENANT_A}::uuid,'tax_jurisdiction',${KEY_A},7,
     '[2030-01-01 00:00:00+00,)'::tstzrange,
     '{"country":"IN","price_display":"tax_exclusive","rounding":"line","taxes":[]}'::jsonb,
     'active'),
    (${EXTENSION_B}::uuid,${TENANT_B}::uuid,'tax_jurisdiction',${KEY_B},3,
     '[2030-01-01 00:00:00+00,)'::tstzrange,
     '{"country":"IN","price_display":"tax_exclusive","rounding":"line","taxes":[]}'::jsonb,
     'active')`;
  await deploy!`INSERT INTO reservation(
      id,tenant_id,property_node,confirmation_no,status,primary_party,booker_party,
      channel_code,currency
    ) VALUES (
      ${RESERVATION_A}::uuid,${TENANT_A}::uuid,${PROPERTY_A}::uuid,'O284-DB','in_house',
      ${GUEST_A}::uuid,${GUEST_A}::uuid,'direct','INR'
    )`;
  await deploy!`INSERT INTO account(
      id,tenant_id,property_node,role,party_id,name,currency,status
    ) VALUES (
      ${ACCOUNT_A}::uuid,${TENANT_A}::uuid,${PROPERTY_A}::uuid,'guest',
      ${GUEST_A}::uuid,'Order 284 Guest Account','INR','open'
    )`;
  await deploy!`INSERT INTO folio(
      id,tenant_id,account_id,reservation_id,folio_no,window_no,name,status
    ) VALUES (
      ${FOLIO_A}::uuid,${TENANT_A}::uuid,${ACCOUNT_A}::uuid,${RESERVATION_A}::uuid,
      'O284-DB-1',1,'Primary Folio','open'
    )`;
  await deploy!`INSERT INTO reservation_segment(
      id,tenant_id,reservation_id,seq,unit_type_id,sellable_unit_id,period,adults,
      children,rate_plan_id,status
    ) VALUES (
      ${SEGMENT_A}::uuid,${TENANT_A}::uuid,${RESERVATION_A}::uuid,1,
      ${UNIT_TYPE_A}::uuid,${SELLABLE_A}::uuid,${period}::tstzrange,2,'[]'::jsonb,
      ${RATE_PLAN_A}::uuid,'booked'
    )`;
  await deploy!`INSERT INTO hold(
      id,tenant_id,property_node,sellable_unit_id,period,kind,holder,expires_at,status
    ) VALUES (
      ${HOLD_A}::uuid,${TENANT_A}::uuid,${PROPERTY_A}::uuid,${SELLABLE_A}::uuid,
      ${period}::tstzrange,'cart','{}'::jsonb,'2037-01-02 15:00:00+00','consumed'
    )`;
  await deploy!`INSERT INTO tax_attribution_snapshot(
      tenant_id,id,property_node,actor_id,schema_version,origin_kind,origin_quote_hash,
      snapshot_hash,currency,snapshot
    ) VALUES (
      ${TENANT_A}::uuid,${ATTRIBUTION_A}::uuid,${PROPERTY_A}::uuid,${ACTOR_A}::uuid,1,
      'rate_quote',${quoteHash},${snapshot.snapshotHash},'INR',
      ${JSON.stringify(snapshot)}::jsonb
    )`;
  await deploy!`INSERT INTO tax_attribution_hold_binding(
      tenant_id,id,property_node,bound_by,hold_id,attribution_id,sellable_unit_id,
      period,origin_quote_hash,snapshot_hash,currency
    ) VALUES (
      ${TENANT_A}::uuid,${HOLD_BINDING_A}::uuid,${PROPERTY_A}::uuid,${ACTOR_A}::uuid,
      ${HOLD_A}::uuid,${ATTRIBUTION_A}::uuid,${SELLABLE_A}::uuid,${period}::tstzrange,
      ${quoteHash},${snapshot.snapshotHash},'INR'
    )`;
  await deploy!`INSERT INTO tax_attribution_reservation_binding(
      tenant_id,id,property_node,linked_by,binding_id,hold_id,attribution_id,
      reservation_id,segment_id,sellable_unit_id,period,origin_quote_hash,
      snapshot_hash,currency
    ) VALUES (
      ${TENANT_A}::uuid,${LINEAGE_A}::uuid,${PROPERTY_A}::uuid,${ACTOR_A}::uuid,
      ${HOLD_BINDING_A}::uuid,${HOLD_A}::uuid,${ATTRIBUTION_A}::uuid,
      ${RESERVATION_A}::uuid,${SEGMENT_A}::uuid,${SELLABLE_A}::uuid,
      ${period}::tstzrange,${quoteHash},${snapshot.snapshotHash},'INR'
    )`;
  await deploy!`INSERT INTO property_fiscal_registration(
      tenant_id,id,property_node,scheme,currency,jurisdiction_extension_id,
      jurisdiction_owner_tenant_id,jurisdiction_key,jurisdiction_version,
      jurisdiction_content_hash,registration_number,region_code,legal_name,
      trade_name,address_line,locality,postal_code
    ) VALUES
    (${TENANT_A}::uuid,${REGISTRATION_A}::uuid,${PROPERTY_A}::uuid,'in-gstin','INR',
     ${EXTENSION_A}::uuid,${TENANT_A}::uuid,${KEY_A},7,${HASH_A},
     '27AAPFU0939F1ZV','27','Order 284 Hospitality Private Limited','Order 284 Hotel',
     '1 Marine Drive','Mumbai','400001'),
    (${TENANT_A}::uuid,${REGISTRATION_A_STALE}::uuid,${PROPERTY_A}::uuid,'in-gstin','INR',
     ${EXTENSION_A}::uuid,${TENANT_A}::uuid,${KEY_A},8,${HASH_B},
     '29ABCDE1234F1Z5','29','Stale Supplier','Stale Hotel',
     '2 Residency Road','Bengaluru','560001'),
    (${TENANT_B}::uuid,${REGISTRATION_B}::uuid,${PROPERTY_B}::uuid,'in-gstin','INR',
     ${EXTENSION_B}::uuid,${TENANT_B}::uuid,${KEY_B},3,${HASH_B},
     '29ABCDE1234F1Z5','29','Foreign Supplier','Foreign Hotel',
     '3 Residency Road','Bengaluru','560001')`;
}

async function effects(): Promise<Record<string, number | string>> {
  const rows = await deploy!<Array<Record<string, number | string>>>`SELECT
    (SELECT count(*)::int FROM india_gst_supplier_service_location
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) assignments,
    (SELECT COALESCE(md5(string_agg(subject::text,'|' ORDER BY id)),md5(''))
      FROM india_gst_supplier_service_location subject
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) assignment_digest,
    (SELECT COALESCE(md5(string_agg(subject::text,'|' ORDER BY id)),md5(''))
      FROM property_fiscal_registration subject
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) supplier_digest,
    (SELECT COALESCE(md5(string_agg(subject::text,'|' ORDER BY property_node)),md5(''))
      FROM property_fiscal_location subject
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) location_digest,
    (SELECT COALESCE(md5(string_agg(subject::text,'|' ORDER BY id)),md5(''))
      FROM india_gst_item_classification subject
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) classification_digest,
    (SELECT count(*)::int FROM party_fiscal_registration
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) recipients,
    (SELECT count(*)::int FROM tax_attribution_snapshot
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) snapshots,
    (SELECT count(*)::int FROM tax_attribution_hold_binding
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) hold_bindings,
    (SELECT count(*)::int FROM tax_attribution_reservation_binding
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) reservation_bindings,
    (SELECT COALESCE(md5(string_agg(subject::text,'|' ORDER BY id)),md5(''))
      FROM account subject
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) account_digest,
    (SELECT COALESCE(md5(string_agg(subject::text,'|' ORDER BY id)),md5(''))
      FROM folio subject
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) folio_digest,
    (SELECT count(*)::int FROM fact_log
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) facts,
    (SELECT count(*)::int FROM outbox
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) events,
    (SELECT count(*)::int FROM api_idempotency
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) idempotency,
    (SELECT count(*)::int FROM journal
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) journals,
    (SELECT count(*)::int FROM posting_line
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) postings,
    (SELECT count(*)::int FROM document
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) documents,
    (SELECT count(*)::int FROM fiscal_submission
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) submissions`;
  return rows[0]!;
}

async function resolveDatabase(
  selected = input(),
  transactionTenant = TENANT_A,
) {
  const service = new IndiaGstSupplierServiceLocationService();
  return database!.withTenantTransaction(transactionTenant, (tx) =>
    service.resolve(tx, selected as never),
  );
}

databaseDescribe(
  "Order 284 exact PostgreSQL supplier service-location evidence",
  () => {
    beforeAll(async () => {
      deploy = new SQL(DEPLOY_URL!, { max: 16, prepare: false });
      database = Database.connect(RUNTIME_URL!, {
        maxConnections: 16,
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

    test("P7: schema has exact identity, composite supplier FK, forced RLS and SELECT-only runtime authority", async () => {
      const relation = await deploy!<
        Array<{
          relrowsecurity: boolean;
          relforcerowsecurity: boolean;
        }>
      >`SELECT relrowsecurity,relforcerowsecurity
      FROM pg_class
      WHERE oid='public.india_gst_supplier_service_location'::regclass`;
      expect(relation).toEqual([
        { relrowsecurity: true, relforcerowsecurity: true },
      ]);

      const constraints = await deploy!<
        Array<{
          name: string;
          type: string;
          definition: string;
        }>
      >`SELECT conname name,contype::text type,pg_get_constraintdef(oid) definition
      FROM pg_constraint
      WHERE conrelid='public.india_gst_supplier_service_location'::regclass`;
      expect(constraints.map(({ name }) => name).sort()).toEqual(
        [
          "india_gst_supplier_service_location_basis_ck",
          "india_gst_supplier_service_location_identity_uq",
          "india_gst_supplier_service_location_legal_rule_ck",
          "india_gst_supplier_service_location_pk",
          "india_gst_supplier_service_location_registered_place_ck",
          "india_gst_supplier_service_location_registration_fk",
          "india_gst_supplier_service_location_scope_ck",
          "india_gst_supplier_service_location_supplier_hash_ck",
        ].sort(),
      );
      expect(
        constraints.some(
          ({ type, definition }) =>
            type === "p" && /PRIMARY KEY \(tenant_id, id\)/i.test(definition),
        ),
      ).toBeTrue();
      expect(
        constraints.some(
          ({ type, definition }) =>
            type === "f" &&
            /FOREIGN KEY \(tenant_id, supplier_registration_id\) REFERENCES property_fiscal_registration\(tenant_id, id\)/i.test(
              definition,
            ),
        ),
      ).toBeTrue();
      expect(
        constraints.some(
          ({ type, definition }) =>
            type === "u" &&
            /tenant_id.+supplier_registration_id.+supplier_evidence_hash.+service_scope/i.test(
              definition,
            ),
        ),
      ).toBeTrue();

      const grants = await deploy!<
        Array<{
          can_select: boolean;
          can_insert: boolean;
          can_update: boolean;
          can_delete: boolean;
        }>
      >`SELECT
      has_table_privilege('app_role','public.india_gst_supplier_service_location','SELECT') can_select,
      has_table_privilege('app_role','public.india_gst_supplier_service_location','INSERT') can_insert,
      has_table_privilege('app_role','public.india_gst_supplier_service_location','UPDATE') can_update,
      has_table_privilege('app_role','public.india_gst_supplier_service_location','DELETE') can_delete`;
      expect(grants[0]).toEqual({
        can_select: true,
        can_insert: false,
        can_update: false,
        can_delete: false,
      });
    });

    test("P8: principal and additional assignments resolve exact current Order272 bytes with deterministic replay", async () => {
      for (const [locationId, kind] of [
        [LOCATION_A, "principal_place_of_business"],
        [LOCATION_A_ADDITIONAL, "additional_place_of_business"],
      ] as const) {
        await clearAssignments();
        await seedAssignment({ id: locationId, registeredPlaceKind: kind });
        const selected = input({ supplierServiceLocationId: locationId });
        const first = await resolveDatabase(selected);
        const replay = await resolveDatabase(selected);
        expect(first).toEqual(replay);
        expect(first.registeredPlace).toEqual({
          kind,
          stateCode: "27",
          addressLine: "1 Marine Drive",
          locality: "Mumbai",
          postalCode: "400001",
        });
        expect(first.propertyNode).toBe(PROPERTY_A);
        expect(first.supplier.registrationId).toBe(REGISTRATION_A);
        expect(first.evidenceHash).toBe(
          sha256(
            JSON.stringify({
              tenantId: TENANT_A,
              supplierServiceLocationId: first.supplierServiceLocationId,
              propertyNode: first.propertyNode,
              jurisdiction: first.jurisdiction,
              supplier: first.supplier,
              serviceScope: first.serviceScope,
              registeredPlace: first.registeredPlace,
              locationBasis: first.locationBasis,
              legalRule: first.legalRule,
            }),
          ),
        );
        expectDeepFrozen(first);
      }
    });

    test("P9: missing, stale, foreign, property and reservation lineage fail closed without fallback", async () => {
      await clearAssignments();
      await expect(resolveDatabase()).rejects.toBeInstanceOf(
        IndiaGstSupplierServiceLocationNotFoundError,
      );

      await seedAssignment({
        id: LOCATION_A,
        registrationId: REGISTRATION_A_STALE,
        supplierEvidenceHash: HASH_B,
      });
      await expect(resolveDatabase()).rejects.toBeInstanceOf(
        IndiaGstSupplierServiceLocationNotFoundError,
      );

      await clearAssignments();
      await seedAssignment({
        tenantId: TENANT_B,
        id: LOCATION_B,
        registrationId: REGISTRATION_B,
        supplierEvidenceHash: HASH_B,
      });
      await expect(
        resolveDatabase(input({ supplierServiceLocationId: LOCATION_B })),
      ).rejects.toBeInstanceOf(IndiaGstSupplierServiceLocationNotFoundError);
      await expect(
        resolveDatabase(input({ propertyNode: PROPERTY_A_OTHER })),
      ).rejects.toThrow();
      await expect(
        resolveDatabase(input({ reservationId: RESERVATION_OTHER })),
      ).rejects.toThrow();
      await expect(resolveDatabase(input(), TENANT_B)).rejects.toThrow();
    });

    test("P10: exact unique identity, supplier FK and statutory checks reject every defect", async () => {
      await clearAssignments();
      await seedAssignment();
      await expectSqlState(seedAssignment(), "23505");

      const rejected: readonly AssignmentOptions[] = [
        { id: id(28481), serviceScope: "restaurant_service" },
        { id: id(28482), registeredPlaceKind: "fixed_establishment" },
        { id: id(28483), registeredPlaceKind: "usual_residence" },
        { id: id(28484), locationBasis: "gstin_prefix" },
        { id: id(28485), legalRule: "IGST_ACT_2_15_B" },
        { id: id(28486), supplierEvidenceHash: "A".repeat(64) },
        { id: id(28487), supplierEvidenceHash: "x".repeat(64) },
      ];
      for (const defect of rejected) {
        await expectSqlState(seedAssignment(defect), "23514");
      }
      await expectSqlState(
        seedAssignment({ id: id(28488), registrationId: id(28498) }),
        "23503",
      );
    });

    test("P11: RLS reveals only own tenant and runtime INSERT/UPDATE/DELETE remain denied", async () => {
      await clearAssignments();
      const ownId = await seedAssignment({ id: LOCATION_A });
      const foreignId = await seedAssignment({
        tenantId: TENANT_B,
        id: LOCATION_B,
        registrationId: REGISTRATION_B,
        supplierEvidenceHash: HASH_B,
      });
      const visible = await database!.withTenantTransaction(
        TENANT_A,
        (tx) =>
          tx<Array<{ id: string }>>`
        SELECT id::text FROM india_gst_supplier_service_location ORDER BY id`,
      );
      expect(visible).toEqual([{ id: ownId }]);
      expect(visible.some(({ id }) => id === foreignId)).toBeFalse();

      await expectSqlState(
        database!.withTenantTransaction(
          TENANT_A,
          (tx) =>
            tx`INSERT INTO india_gst_supplier_service_location(
          tenant_id,id,supplier_registration_id,supplier_evidence_hash,
          service_scope,registered_place_kind,location_basis,legal_rule
        ) VALUES (
          ${TENANT_A}::uuid,${LOCATION_A_ADDITIONAL}::uuid,${REGISTRATION_A}::uuid,
          ${supplier().evidenceHash},'lodging_accommodation','additional_place_of_business',
          'supply_made_from_registered_place_of_business','IGST_ACT_2_15_A'
        )`,
        ),
        "42501",
      );
      await expectSqlState(
        database!.withTenantTransaction(
          TENANT_A,
          (tx) =>
            tx`UPDATE india_gst_supplier_service_location
          SET registered_place_kind='additional_place_of_business'
          WHERE tenant_id=${TENANT_A}::uuid AND id=${ownId}::uuid`,
        ),
        "42501",
      );
      await expectSqlState(
        database!.withTenantTransaction(
          TENANT_A,
          (tx) =>
            tx`DELETE FROM india_gst_supplier_service_location
          WHERE tenant_id=${TENANT_A}::uuid AND id=${ownId}::uuid`,
        ),
        "42501",
      );
    });

    test("P12: GSTIN, property location, org/config and state-comparison mutations never substitute for assignment", async () => {
      await clearAssignments();
      await seedAssignment({ id: LOCATION_A });
      const before = await resolveDatabase();
      await deploy!`UPDATE org_node SET
      name='29 Fixed Establishment SEZ',
      config='{"supplier_location":"usual_residence","state":"29","sez":true}'::jsonb
      WHERE tenant_id=${TENANT_A}::uuid AND id=${PROPERTY_A}::uuid`;
      await deploy!`INSERT INTO property_fiscal_location(
      tenant_id,property_node,country_code,state_code,address_line1,locality,pin
    ) VALUES (
      ${TENANT_A}::uuid,${PROPERTY_A}::uuid,'IN','29','2 Residency Road',
      'Bengaluru','560001'
    ) ON CONFLICT (tenant_id,property_node) DO UPDATE SET
      state_code=excluded.state_code,address_line1=excluded.address_line1,
      locality=excluded.locality,pin=excluded.pin`;
      const after = await resolveDatabase();
      expect(after).toEqual(before);
      expect(after.registeredPlace.stateCode).toBe("27");

      await deploy!`UPDATE property_fiscal_registration SET
        registration_number='29ABCDE1234F1ZW',region_code='29',
        address_line='2 Residency Road',locality='Bengaluru',postal_code='560001'
        WHERE tenant_id=${TENANT_A}::uuid AND id=${REGISTRATION_A}::uuid`;
      await expect(resolveDatabase()).rejects.toBeInstanceOf(
        IndiaGstSupplierServiceLocationNotFoundError,
      );
      await deploy!`UPDATE property_fiscal_registration SET
        registration_number='27AAPFU0939F1ZV',region_code='27',
        address_line='1 Marine Drive',locality='Mumbai',postal_code='400001'
        WHERE tenant_id=${TENANT_A}::uuid AND id=${REGISTRATION_A}::uuid`;
    });

    test("P13: happy, replay and hostile failures leave assignment, lineage and every effect byte/count unchanged", async () => {
      await clearAssignments();
      await seedAssignment({ id: LOCATION_A });
      const before = await effects();
      await resolveDatabase();
      await resolveDatabase();
      await expect(
        resolveDatabase(
          input({ supplierServiceLocationId: LOCATION_A_ADDITIONAL }),
        ),
      ).rejects.toThrow();
      await expect(
        resolveDatabase(input({ propertyNode: PROPERTY_A_OTHER })),
      ).rejects.toThrow();
      await expect(
        resolveDatabase(input({ reservationId: RESERVATION_OTHER })),
      ).rejects.toThrow();
      expect(await effects()).toEqual(before);
    });
  },
);

test("Order 284 P14: source has only registered-place section2(15)(a) read authority", async () => {
  const source = await Bun.file(
    new URL(
      "../src/contexts/tax-fiscal/india-gst-supplier-service-location.ts",
      import.meta.url,
    ),
  ).text();

  expect(source).toContain("IndiaGstSupplierRegistrationService");
  expect(source).toContain("IGST_ACT_2_15_A");
  expect(source).toContain("supply_made_from_registered_place_of_business");
  expect(source).not.toMatch(
    /\b(?:INSERT\s+INTO|UPDATE\s+[A-Za-z_]|DELETE\s+FROM)\b/i,
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
    /\b(?:property_fiscal_location|party_fiscal_registration|india_gst_item_classification)\b/i,
  );
  expect(source).not.toMatch(
    /\b(?:fixed_establishment|usual_residence|most_directly_concerned)\b/i,
  );
  expect(source).not.toMatch(
    /\b(?:IGST_ACT_2_15_B|IGST_ACT_2_15_C|IGST_ACT_2_15_D)\b/,
  );
  expect(source).not.toMatch(
    /\b(?:SEZ|authorized_operations|intraState|interState|CGST|SGST|UTGST)\b/,
  );
  expect(source).not.toMatch(
    /\b(?:SupTyp|IgstOnIntra|ItemList|GstRt|CgstAmt|SgstAmt|IgstAmt)\b/,
  );
});
