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
  IndiaGstSupplierSezStatusConflictError,
  IndiaGstSupplierSezStatusNotFoundError,
  IndiaGstSupplierSezStatusService,
  IndiaGstSupplierSezStatusValidationError,
} from "../src/contexts/tax-fiscal";
import { Database, type Tx } from "../src/kernel";

setDefaultTimeout(60_000);

const DEPLOY_URL = process.env.YELLOW_DEPLOY_DATABASE_URL;
const RUNTIME_URL = process.env.YELLOW_ORDER286_DATABASE_URL ??
  process.env.YELLOW_RUNTIME_DATABASE_URL;
if (process.env.YELLOW_REQUIRE_ORDER286_DATABASE === "1" &&
    (!DEPLOY_URL || !RUNTIME_URL)) {
  throw new Error(
    "Order 286 supplier SEZ-status proof requires deploy and runtime URLs",
  );
}
const databaseDescribe = DEPLOY_URL && RUNTIME_URL ? describe.serial : describe.skip;

const id = (suffix: number): string =>
  `00000000-0000-0000-0000-${String(suffix).padStart(12, "0")}`;
const sha256 = (value: string): string =>
  new Bun.CryptoHasher("sha256").update(value).digest("hex");

const TENANT_A = id(28601);
const TENANT_B = id(28602);
const PROPERTY_A = id(28611);
const PROPERTY_A_OTHER = id(28612);
const PROPERTY_B = id(28613);
const RESERVATION_A = id(28621);
const RESERVATION_OTHER = id(28622);
const EXTENSION_A = id(28631);
const EXTENSION_B = id(28632);
const REGISTRATION_A = id(28641);
const REGISTRATION_A_OTHER = id(28642);
const REGISTRATION_B = id(28643);
const LOCATION_PRINCIPAL = id(28651);
const LOCATION_ADDITIONAL = id(28652);
const LOCATION_B = id(28653);
const STATUS_REGULAR = id(28661);
const STATUS_UNIT = id(28662);
const STATUS_DEVELOPER_B = id(28663);
const STATUS_DEVELOPER_C = id(28664);
const STATUS_B = id(28665);
const STATUS_AS_OF = "2039-05-15";
const VALIDITY_FROM = "2039-01-01";
const VALIDITY_TO = "2040-01-01";
const GST_STATUS_HASH = "a".repeat(64);
const APPROVAL_HASH = "b".repeat(64);
const CONTENT_HASH_A = "c".repeat(64);
const CONTENT_HASH_B = "d".repeat(64);
const LEGAL_RULE = "IGST_ACT_7_5_B_AND_8_2_SUPPLIER_STATUS";
const LOCATION_RULE = "IGST_ACT_2_15_A";
const KEY_A = "in.order286.gst.27";
const KEY_B = "in.order286.gst.29";

type MutableRecord = Record<PropertyKey, unknown>;
type PlaceKind =
  | "principal_place_of_business"
  | "additional_place_of_business";

interface StatusRow {
  readonly tenant_id: string;
  readonly id: string;
  readonly supplier_registration_id: string;
  readonly supplier_registration_evidence_hash: string;
  readonly status_as_of: string;
  readonly gst_registration_status: string;
  readonly gst_taxpayer_type: string;
  readonly gst_status_source: string;
  readonly gst_status_evidence_sha256: string;
  readonly approval_form: string | null;
  readonly approval_reference: string | null;
  readonly approval_validity: string | null;
  readonly approval_status: string | null;
  readonly approval_evidence_sha256: string | null;
  readonly legal_rule: string;
}

interface StatusOptions {
  readonly tenantId?: string;
  readonly id?: string;
  readonly registrationId?: string;
  readonly supplierEvidenceHash?: string;
  readonly statusAsOf?: string;
  readonly registrationStatus?: string;
  readonly taxpayerType?: string;
  readonly source?: string;
  readonly statusEvidenceSha256?: string;
  readonly approvalForm?: string | null;
  readonly approvalReference?: string | null;
  readonly approvalValidity?: string | null;
  readonly approvalStatus?: string | null;
  readonly approvalEvidenceSha256?: string | null;
  readonly legalRule?: string;
}

function deepFreeze<T>(value: T, seen = new Set<object>()): T {
  if (typeof value !== "object" || value === null || seen.has(value)) return value;
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    deepFreeze((value as MutableRecord)[key], seen);
  }
  return Object.freeze(value);
}

function expectDeepFrozen(value: unknown, seen = new Set<object>()): void {
  if (typeof value !== "object" || value === null || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBeTrue();
  for (const key of Reflect.ownKeys(value)) {
    expectDeepFrozen((value as MutableRecord)[key], seen);
  }
}

function input(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    tenantId: TENANT_A,
    propertyNode: PROPERTY_A,
    reservationId: RESERVATION_A,
    supplierServiceLocationId: LOCATION_PRINCIPAL,
    supplierSezStatusId: STATUS_REGULAR,
    ...overrides,
  };
}

function jurisdiction(
  tenantId = TENANT_A,
  overrides: Record<string, unknown> = {},
) {
  return deepFreeze({
    extensionId: tenantId === TENANT_B ? EXTENSION_B : EXTENSION_A,
    ownerTenantId: tenantId,
    key: tenantId === TENANT_B ? KEY_B : KEY_A,
    version: tenantId === TENANT_B ? "3" : "7",
    contentHash: tenantId === TENANT_B ? CONTENT_HASH_B : CONTENT_HASH_A,
    ...overrides,
  });
}

function supplierRegistration(
  tenantId = TENANT_A,
  overrides: Record<string, unknown> = {},
) {
  const propertyNode = tenantId === TENANT_B ? PROPERTY_B : PROPERTY_A;
  const values = {
    registrationId: tenantId === TENANT_B ? REGISTRATION_B : REGISTRATION_A,
    propertyNode,
    scheme: "in-gstin",
    currency: "INR",
    jurisdiction: jurisdiction(tenantId),
    gstin: tenantId === TENANT_B ? "29ABCDE1234F1Z5" : "27AAPFU0939F1ZV",
    stateCode: tenantId === TENANT_B ? "29" : "27",
    legalName: tenantId === TENANT_B
      ? "Order 286 Foreign Hospitality Private Limited"
      : "Order 286 Hospitality Private Limited",
    tradeName: tenantId === TENANT_B ? "Order 286 Foreign Hotel" : "Order 286 Hotel",
    addressLine: tenantId === TENANT_B ? "2 Residency Road" : "1 Marine Drive",
    locality: tenantId === TENANT_B ? "Bengaluru" : "Mumbai",
    postalCode: tenantId === TENANT_B ? "560001" : "400001",
    ...overrides,
  };
  const evidenceHash = typeof overrides.evidenceHash === "string"
    ? overrides.evidenceHash
    : sha256(JSON.stringify({
      registrationId: values.registrationId,
      tenantId,
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

function serviceLocation(
  kind: PlaceKind = "principal_place_of_business",
  tenantId = TENANT_A,
  overrides: Record<string, unknown> = {},
) {
  const supplier = supplierRegistration(tenantId);
  const propertyNode = tenantId === TENANT_B ? PROPERTY_B : PROPERTY_A;
  const values = {
    supplierServiceLocationId: tenantId === TENANT_B
      ? LOCATION_B
      : kind === "principal_place_of_business"
        ? LOCATION_PRINCIPAL
        : LOCATION_ADDITIONAL,
    propertyNode,
    jurisdiction: supplier.jurisdiction,
    supplier: deepFreeze({
      registrationId: supplier.registrationId,
      evidenceHash: supplier.evidenceHash,
    }),
    serviceScope: "lodging_accommodation",
    registeredPlace: deepFreeze({
      kind,
      stateCode: supplier.stateCode,
      addressLine: supplier.addressLine,
      locality: supplier.locality,
      postalCode: supplier.postalCode,
    }),
    locationBasis: "supply_made_from_registered_place_of_business",
    legalRule: LOCATION_RULE,
    ...overrides,
  };
  const evidenceHash = typeof overrides.evidenceHash === "string"
    ? overrides.evidenceHash
    : sha256(JSON.stringify({ tenantId, ...values }));
  return deepFreeze({ ...values, evidenceHash });
}

function statusRow(overrides: Partial<StatusRow> = {}): StatusRow {
  const supplier = supplierRegistration();
  return {
    tenant_id: TENANT_A,
    id: STATUS_REGULAR,
    supplier_registration_id: REGISTRATION_A,
    supplier_registration_evidence_hash: supplier.evidenceHash,
    status_as_of: STATUS_AS_OF,
    gst_registration_status: "active",
    gst_taxpayer_type: "regular",
    gst_status_source: "gst_common_portal",
    gst_status_evidence_sha256: GST_STATUS_HASH,
    approval_form: null,
    approval_reference: null,
    approval_validity: null,
    approval_status: null,
    approval_evidence_sha256: null,
    legal_rule: LEGAL_RULE,
    ...overrides,
  };
}

function approvalRow(
  type: "sez_unit" | "sez_developer",
  form: "sez_rules_form_g" | "sez_rules_form_b" | "sez_rules_form_c",
  statusId: string,
): StatusRow {
  return statusRow({
    id: statusId,
    gst_taxpayer_type: type,
    approval_form: form,
    approval_reference: `LOA/${statusId.slice(-2)}/2039`,
    approval_validity: `[${VALIDITY_FROM},${VALIDITY_TO})`,
    approval_status: "in_force",
    approval_evidence_sha256: APPROVAL_HASH,
  });
}

function fakeTx(rows: readonly StatusRow[], statements: string[] = []): Tx {
  return (async (strings: TemplateStringsArray) => {
    statements.push(strings.join("?"));
    return rows;
  }) as unknown as Tx;
}

function harness(
  locationRoot: unknown = serviceLocation(),
  rows: readonly StatusRow[] = [statusRow()],
  statements: string[] = [],
) {
  const calls: unknown[] = [];
  const service = new IndiaGstSupplierSezStatusService({
    async resolve(_tx: Tx, selected: unknown) {
      calls.push(selected);
      return locationRoot as never;
    },
  });
  return { service, tx: fakeTx(rows, statements), calls, statements };
}

function expectedBody(row: StatusRow, location = serviceLocation()) {
  const approval = row.approval_form === null ? null : {
    form: row.approval_form,
    reference: row.approval_reference,
    validity: {
      fromInclusive: VALIDITY_FROM,
      toExclusive: VALIDITY_TO,
    },
    status: "in_force",
    evidenceSha256: row.approval_evidence_sha256,
  };
  return {
    supplierSezStatusId: row.id,
    propertyNode: location.propertyNode,
    supplierServiceLocation: {
      id: location.supplierServiceLocationId,
      evidenceHash: location.evidenceHash,
    },
    supplier: {
      registrationId: location.supplier.registrationId,
      evidenceHash: location.supplier.evidenceHash,
    },
    statusAsOf: row.status_as_of,
    gstRegistration: {
      status: "active",
      taxpayerType: row.gst_taxpayer_type,
      source: "gst_common_portal",
      evidenceSha256: row.gst_status_evidence_sha256,
    },
    sezStatus: row.gst_taxpayer_type === "regular"
      ? "affirmatively_non_sez_regular"
      : row.gst_taxpayer_type,
    approval,
    legalRule: LEGAL_RULE,
  };
}

function sqlState(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const postgres = error as { errno?: unknown; code?: unknown };
  if (typeof postgres.errno === "string") return postgres.errno;
  return typeof postgres.code === "string" ? postgres.code : undefined;
}

async function expectSqlState(operation: Promise<unknown>, expected: string): Promise<void> {
  try {
    await operation;
    throw new Error(`expected PostgreSQL SQLSTATE ${expected}`);
  } catch (error) {
    expect(sqlState(error)).toBe(expected);
  }
}

test("Order 286 P0: exact migration and bounded-context resolver exist", async () => {
  expect(typeof IndiaGstSupplierSezStatusService).toBe("function");
  const sql = await Bun.file(new URL(
    "../migrations/0053_india_gst_supplier_sez_status.sql",
    import.meta.url,
  )).text();
  expect(sql).toContain("CREATE TABLE public.india_gst_supplier_sez_status");
  expect(sql).toContain("FOREIGN KEY (tenant_id, supplier_registration_id)");
  expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
  expect(sql).toContain("FORCE ROW LEVEL SECURITY");
  expect(sql).toContain(
    "GRANT SELECT ON TABLE public.india_gst_supplier_sez_status TO app_role",
  );
});

test("Order 286 P1: exact regular/G/B/C results compose principal and additional Order284 lineage", async () => {
  const cases = [
    [serviceLocation("principal_place_of_business"), statusRow()],
    [serviceLocation("additional_place_of_business"),
      approvalRow("sez_unit", "sez_rules_form_g", STATUS_UNIT)],
    [serviceLocation("principal_place_of_business"),
      approvalRow("sez_developer", "sez_rules_form_b", STATUS_DEVELOPER_B)],
    [serviceLocation("additional_place_of_business"),
      approvalRow("sez_developer", "sez_rules_form_c", STATUS_DEVELOPER_C)],
  ] as const;
  for (const [location, row] of cases) {
    const selected = input({
      supplierServiceLocationId: location.supplierServiceLocationId,
      supplierSezStatusId: row.id,
    });
    const target = harness(location, [row]);
    const first = await target.service.resolve(target.tx, selected as never);
    const replay = await target.service.resolve(target.tx, selected as never);
    const body = expectedBody(row, location);
    expect(first).toEqual(replay);
    expect(JSON.stringify(first)).toBe(JSON.stringify(replay));
    expect(first).toEqual({
      ...body,
      evidenceHash: sha256(JSON.stringify({ tenantId: TENANT_A, ...body })),
    } as typeof first);
    expect(Object.keys(first)).toEqual([
      "supplierSezStatusId", "propertyNode", "supplierServiceLocation",
      "supplier", "statusAsOf", "gstRegistration", "sezStatus", "approval",
      "legalRule", "evidenceHash",
    ]);
    expect(first).not.toHaveProperty("tenantId");
    expectDeepFrozen(first);
  }
});

test("Order 286 P2: dependency input and status SELECT use only exact current lineage", async () => {
  const statements: string[] = [];
  const target = harness(serviceLocation(), [statusRow()], statements);
  await target.service.resolve(target.tx, input() as never);
  expect(target.calls).toEqual([{
    tenantId: TENANT_A,
    propertyNode: PROPERTY_A,
    reservationId: RESERVATION_A,
    supplierServiceLocationId: LOCATION_PRINCIPAL,
  }]);
  expect(statements).toHaveLength(1);
  const sql = statements[0]!;
  expect(sql).toContain("public.india_gst_supplier_sez_status");
  expect(sql).toContain("current_setting('app.tenant_id', true)");
  expect(sql).toContain("supplier_registration_id");
  expect(sql).toContain("supplier_registration_evidence_hash");
  expect(sql).toContain("status_as_of");
  expect(sql).not.toMatch(
    /party_role|party_fiscal_registration|property_fiscal_location|registered_state|recipient_sez|SellerDtls|extension|tax_code|classification/i,
  );
  expect(sql).not.toMatch(
    /\b(?:INSERT|UPDATE|DELETE|FOR\s+UPDATE|FOR\s+SHARE|pg_advisory)\b/i,
  );
});

test("Order 286 P3: exact accessor/proxy/symbol-free five-UUID input is mandatory", async () => {
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
    { ...exact, supplierSezStatusId: "not-a-uuid" },
    new Proxy({ ...exact }, {}),
  ];
  for (const key of Object.keys(exact)) {
    const missing = { ...exact } as MutableRecord;
    delete missing[key];
    hostile.push(missing);
  }
  const accessor = { ...exact } as MutableRecord;
  Object.defineProperty(accessor, "supplierSezStatusId", {
    enumerable: true,
    get: () => STATUS_REGULAR,
  });
  hostile.push(accessor);
  const symbolic = { ...exact } as MutableRecord;
  symbolic[Symbol("hostile")] = true;
  hostile.push(symbolic);

  for (const candidate of hostile) {
    const target = harness();
    await expect(target.service.resolve(target.tx, candidate as never)).rejects
      .toBeInstanceOf(IndiaGstSupplierSezStatusValidationError);
    expect(target.calls).toHaveLength(0);
    expect(target.statements).toHaveLength(0);
  }
  const target = harness();
  await expect(target.service.resolve(undefined as unknown as Tx, exact as never)).rejects
    .toBeInstanceOf(IndiaGstSupplierSezStatusValidationError);
  expect(target.calls).toHaveLength(0);
});

test("Order 286 P4: complete frozen Order284 and underlying Order272 lineage are rehashed", async () => {
  const pristine = serviceLocation();
  const hostile: unknown[] = [
    null,
    [],
    deepFreeze({ ...pristine, extra: true }),
    structuredClone(pristine),
    new Proxy(structuredClone(pristine), {}),
  ];
  for (const key of Object.keys(pristine)) {
    const missing = structuredClone(pristine) as MutableRecord;
    delete missing[key];
    hostile.push(deepFreeze(missing));
  }
  const accessor = structuredClone(pristine) as MutableRecord;
  Object.defineProperty(accessor, "evidenceHash", {
    enumerable: true,
    get: () => pristine.evidenceHash,
  });
  hostile.push(Object.freeze(accessor));
  const symbolic = structuredClone(pristine) as MutableRecord;
  symbolic[Symbol("hostile")] = true;
  hostile.push(deepFreeze(symbolic));

  for (const root of hostile) {
    const target = harness(root);
    await expect(target.service.resolve(target.tx, input() as never)).rejects
      .toBeInstanceOf(IndiaGstSupplierSezStatusConflictError);
    expect(target.statements).toHaveLength(0);
  }

  const defects: readonly Record<string, unknown>[] = [
    { propertyNode: PROPERTY_A_OTHER },
    { serviceScope: "restaurant_service" },
    { locationBasis: "gstin_state_prefix" },
    { legalRule: "IGST_ACT_2_15_B" },
    { evidenceHash: "f".repeat(64) },
    { supplier: deepFreeze({ ...pristine.supplier, registrationId: REGISTRATION_A_OTHER }) },
    { supplier: deepFreeze({ ...pristine.supplier, evidenceHash: "f".repeat(64) }) },
    { registeredPlace: deepFreeze({ ...pristine.registeredPlace, kind: "fixed_establishment" }) },
    { registeredPlace: deepFreeze({ ...pristine.registeredPlace, stateCode: "29" }) },
    { registeredPlace: deepFreeze({ ...pristine.registeredPlace, addressLine: "2 Changed Road" }) },
    { jurisdiction: jurisdiction(TENANT_A, { contentHash: "f".repeat(64) }) },
  ];
  for (const defect of defects) {
    const target = harness(deepFreeze({ ...pristine, ...defect }));
    await expect(target.service.resolve(target.tx, input() as never)).rejects
      .toBeInstanceOf(IndiaGstSupplierSezStatusConflictError);
  }
});

test("Order 286 P5: missing, duplicate and every hostile conditional row fail closed", async () => {
  const missing = harness(serviceLocation(), []);
  await expect(missing.service.resolve(missing.tx, input() as never)).rejects
    .toBeInstanceOf(IndiaGstSupplierSezStatusNotFoundError);
  const duplicate = harness(serviceLocation(), [statusRow(), statusRow()]);
  await expect(duplicate.service.resolve(duplicate.tx, input() as never)).rejects
    .toBeInstanceOf(IndiaGstSupplierSezStatusConflictError);

  const pristine = statusRow();
  const hostile: unknown[] = [
    { ...pristine, extra: true },
    new Proxy({ ...pristine }, {}),
  ];
  for (const key of Object.keys(pristine)) {
    const missingKey = { ...pristine } as MutableRecord;
    delete missingKey[key];
    hostile.push(missingKey);
  }
  const accessor = { ...pristine } as MutableRecord;
  Object.defineProperty(accessor, "gst_taxpayer_type", {
    enumerable: true,
    get: () => "regular",
  });
  hostile.push(accessor);
  const symbolic = { ...pristine } as MutableRecord;
  symbolic[Symbol("hostile")] = true;
  hostile.push(symbolic);
  for (const candidate of hostile) {
    const target = harness(serviceLocation(), [candidate as StatusRow]);
    await expect(target.service.resolve(target.tx, input() as never)).rejects
      .toBeInstanceOf(IndiaGstSupplierSezStatusConflictError);
  }

  const defects: readonly Partial<StatusRow>[] = [
    { tenant_id: TENANT_B },
    { id: STATUS_UNIT },
    { supplier_registration_id: REGISTRATION_A_OTHER },
    { supplier_registration_evidence_hash: "f".repeat(64) },
    { status_as_of: "2039-5-15" },
    { status_as_of: "2039-02-30" },
    { gst_registration_status: "suspended" },
    { gst_registration_status: "cancelled" },
    { gst_taxpayer_type: "composition" },
    { gst_status_source: "property_profile" },
    { gst_status_evidence_sha256: "A".repeat(64) },
    { approval_form: "sez_rules_form_g" },
    { legal_rule: "IGST_ACT_7_5_B" },
  ];
  for (const defect of defects) {
    const target = harness(serviceLocation(), [statusRow(defect)]);
    await expect(target.service.resolve(target.tx, input() as never)).rejects
      .toBeInstanceOf(IndiaGstSupplierSezStatusConflictError);
  }

  for (const defect of [
    { approval_form: "sez_rules_form_b" },
    { approval_reference: " LOA/286/2039" },
    { approval_reference: "LOA/286\n2039" },
    { approval_validity: "(2039-01-01,2040-01-01]" },
    { approval_validity: "[2039-01-01,)" },
    { approval_validity: "[2039-06-01,2040-01-01)" },
    { approval_status: "expired" },
    { approval_evidence_sha256: "A".repeat(64) },
  ] as const) {
    const row = approvalRow("sez_unit", "sez_rules_form_g", STATUS_REGULAR);
    const target = harness(serviceLocation(), [{ ...row, ...defect }]);
    await expect(target.service.resolve(target.tx, input() as never)).rejects
      .toBeInstanceOf(IndiaGstSupplierSezStatusConflictError);
  }
});

test("Order 286 P6: replay and rejection preserve caller, Order284 and row bytes", async () => {
  const selected = input();
  const location = serviceLocation();
  const row = statusRow();
  const before = JSON.stringify({ selected, location, row });
  const target = harness(location, [row]);
  await target.service.resolve(target.tx, selected as never);
  await target.service.resolve(target.tx, selected as never);
  const rejected = harness(location, [statusRow({ gst_registration_status: "cancelled" })]);
  await expect(rejected.service.resolve(rejected.tx, selected as never)).rejects.toThrow();
  expect(JSON.stringify({ selected, location, row })).toBe(before);
});

let deploy: SQL | undefined;
let database: Database | undefined;

async function clearStatuses(): Promise<void> {
  await deploy!`DELETE FROM india_gst_supplier_sez_status
    WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
}

async function clearServiceLocations(): Promise<void> {
  await deploy!`DELETE FROM india_gst_supplier_service_location
    WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
}

async function seedStatus(options: StatusOptions = {}): Promise<string> {
  const statusId = options.id ?? crypto.randomUUID();
  const type = options.taxpayerType ?? "regular";
  const isRegular = type === "regular";
  const tenantId = options.tenantId ?? TENANT_A;
  const supplier = supplierRegistration(tenantId);
  await deploy!`INSERT INTO india_gst_supplier_sez_status(
      tenant_id,id,supplier_registration_id,supplier_registration_evidence_hash,
      status_as_of,gst_registration_status,gst_taxpayer_type,gst_status_source,
      gst_status_evidence_sha256,approval_form,approval_reference,
      approval_validity,approval_status,approval_evidence_sha256,legal_rule
    ) VALUES (
      ${tenantId}::uuid,${statusId}::uuid,
      ${options.registrationId ?? supplier.registrationId}::uuid,
      ${options.supplierEvidenceHash ?? supplier.evidenceHash},
      ${options.statusAsOf ?? STATUS_AS_OF}::date,
      ${options.registrationStatus ?? "active"},${type},
      ${options.source ?? "gst_common_portal"},
      ${options.statusEvidenceSha256 ?? GST_STATUS_HASH},
      ${options.approvalForm === undefined
        ? (isRegular ? null : type === "sez_unit" ? "sez_rules_form_g" : "sez_rules_form_b")
        : options.approvalForm},
      ${options.approvalReference === undefined
        ? (isRegular ? null : "LOA/286/2039")
        : options.approvalReference},
      ${options.approvalValidity === undefined
        ? (isRegular ? null : `[${VALIDITY_FROM},${VALIDITY_TO})`)
        : options.approvalValidity}::daterange,
      ${options.approvalStatus === undefined
        ? (isRegular ? null : "in_force")
        : options.approvalStatus},
      ${options.approvalEvidenceSha256 === undefined
        ? (isRegular ? null : APPROVAL_HASH)
        : options.approvalEvidenceSha256},
      ${options.legalRule ?? LEGAL_RULE}
    )`;
  return statusId;
}

async function seedServiceLocation(
  kind: PlaceKind,
  tenantId = TENANT_A,
): Promise<string> {
  const location = serviceLocation(kind, tenantId);
  await deploy!`INSERT INTO india_gst_supplier_service_location(
      tenant_id,id,supplier_registration_id,supplier_evidence_hash,service_scope,
      registered_place_kind,location_basis,legal_rule
    ) VALUES (
      ${tenantId}::uuid,${location.supplierServiceLocationId}::uuid,
      ${location.supplier.registrationId}::uuid,${location.supplier.evidenceHash},
      'lodging_accommodation',${kind},
      'supply_made_from_registered_place_of_business',${LOCATION_RULE}
    )`;
  return location.supplierServiceLocationId;
}

async function cleanupDatabaseFixture(): Promise<void> {
  if (!deploy) return;
  await clearStatuses();
  await clearServiceLocations();
  await deploy`DELETE FROM property_fiscal_registration
    WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM extension WHERE id IN (${EXTENSION_A}::uuid,${EXTENSION_B}::uuid)`;
  await deploy`DELETE FROM org_node
    WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM tenant WHERE id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
}

async function seedDatabaseFixture(): Promise<void> {
  await deploy!`INSERT INTO tenant(id,slug,name,tier,status) VALUES
    (${TENANT_A}::uuid,'order286-a','Order 286 A','shared','active'),
    (${TENANT_B}::uuid,'order286-b','Order 286 B','shared','active')`;
  await deploy!`INSERT INTO org_node(
      id,tenant_id,path,kind,name,timezone,currency,config
    ) VALUES
    (${PROPERTY_A}::uuid,${TENANT_A}::uuid,'order286a.property'::ltree,'property',
     'Misleading SEZ Developer','Asia/Kolkata','INR',
     '{"sez":true,"supplier_status":"cancelled","Pos":"29"}'::jsonb),
    (${PROPERTY_A_OTHER}::uuid,${TENANT_A}::uuid,'order286a.other'::ltree,'property',
     'Order 286 Other','Asia/Kolkata','INR','{}'::jsonb),
    (${PROPERTY_B}::uuid,${TENANT_B}::uuid,'order286b.property'::ltree,'property',
     'Order 286 Foreign','Asia/Kolkata','INR','{"sez":true}'::jsonb)`;
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
  await deploy!`INSERT INTO property_fiscal_registration(
      tenant_id,id,property_node,scheme,currency,jurisdiction_extension_id,
      jurisdiction_owner_tenant_id,jurisdiction_key,jurisdiction_version,
      jurisdiction_content_hash,registration_number,region_code,legal_name,
      trade_name,address_line,locality,postal_code
    ) VALUES
    (${TENANT_A}::uuid,${REGISTRATION_A}::uuid,${PROPERTY_A}::uuid,'in-gstin','INR',
     ${EXTENSION_A}::uuid,${TENANT_A}::uuid,${KEY_A},7,${CONTENT_HASH_A},
     '27AAPFU0939F1ZV','27','Order 286 Hospitality Private Limited','Order 286 Hotel',
     '1 Marine Drive','Mumbai','400001'),
    (${TENANT_A}::uuid,${REGISTRATION_A_OTHER}::uuid,${PROPERTY_A_OTHER}::uuid,'in-gstin','INR',
     ${EXTENSION_A}::uuid,${TENANT_A}::uuid,${KEY_A},8,${CONTENT_HASH_B},
     '29ABCDE1234F1Z5','29','Order 286 Other Hospitality','Order 286 Other',
     '2 Residency Road','Bengaluru','560001'),
    (${TENANT_B}::uuid,${REGISTRATION_B}::uuid,${PROPERTY_B}::uuid,'in-gstin','INR',
     ${EXTENSION_B}::uuid,${TENANT_B}::uuid,${KEY_B},3,${CONTENT_HASH_B},
     '29ABCDE1234F1Z5','29','Order 286 Foreign Hospitality','Order 286 Foreign',
     '3 Residency Road','Bengaluru','560001')`;
}

async function effects(): Promise<Record<string, number | string>> {
  const rows = await deploy!<Array<Record<string, number | string>>>`SELECT
    (SELECT COALESCE(md5(string_agg(subject::text,'|' ORDER BY id)),md5(''))
      FROM india_gst_supplier_sez_status subject
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) status_digest,
    (SELECT COALESCE(md5(string_agg(subject::text,'|' ORDER BY id)),md5(''))
      FROM india_gst_supplier_service_location subject
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) location_digest,
    (SELECT COALESCE(md5(string_agg(subject::text,'|' ORDER BY id)),md5(''))
      FROM property_fiscal_registration subject
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) supplier_digest,
    (SELECT count(*)::int FROM india_gst_recipient_sez_status
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) recipient_statuses,
    (SELECT count(*)::int FROM tax_attribution_snapshot
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) tax_details,
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
  location = serviceLocation(),
  transactionTenant = TENANT_A,
) {
  const service = new IndiaGstSupplierSezStatusService({
    async resolve(_tx: Tx, selected: unknown) {
      const dependencyInput = selected as Record<string, unknown>;
      if (dependencyInput.tenantId !== TENANT_A ||
          dependencyInput.propertyNode !== location.propertyNode ||
          dependencyInput.reservationId !== RESERVATION_A ||
          dependencyInput.supplierServiceLocationId !==
            location.supplierServiceLocationId) {
        throw new Error("injected exact Order284 evidence is unavailable");
      }
      return location as never;
    },
  });
  return database!.withTenantTransaction(transactionTenant, (tx) =>
    service.resolve(tx, selected as never),
  );
}

databaseDescribe("Order 286 exact PostgreSQL supplier SEZ-status evidence", () => {
  beforeAll(async () => {
    deploy = new SQL(DEPLOY_URL!, { max: 16, prepare: false });
    database = Database.connect(RUNTIME_URL!, { maxConnections: 16, prepare: false });
    await cleanupDatabaseFixture();
    await seedDatabaseFixture();
  });

  afterAll(async () => {
    await cleanupDatabaseFixture();
    await database?.close();
    await deploy?.close({ timeout: 0 });
  });

  test("P7: schema is exact53/105/95/95/5 with FK, identity, forced RLS and read-only ACL", async () => {
    const counts = await deploy!<Array<{
      migrations: number;
      tables: number;
      rls_tables: number;
      policies: number;
      forced_rls: number;
    }>>`SELECT
      (SELECT count(*)::int FROM schema_migration) migrations,
      (SELECT count(*)::int FROM pg_tables WHERE schemaname='public') tables,
      (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity) rls_tables,
      (SELECT count(*)::int FROM pg_policies WHERE schemaname='public') policies,
      (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public' AND c.relkind='r' AND c.relforcerowsecurity) forced_rls`;
    expect(counts[0]).toEqual({
      migrations: 53, tables: 105, rls_tables: 95, policies: 95, forced_rls: 5,
    });

    const relation = await deploy!<Array<{
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
    }>>`SELECT relrowsecurity,relforcerowsecurity FROM pg_class
      WHERE oid='public.india_gst_supplier_sez_status'::regclass`;
    expect(relation).toEqual([{ relrowsecurity: true, relforcerowsecurity: true }]);

    const constraints = await deploy!<Array<{
      name: string;
      type: string;
      definition: string;
    }>>`SELECT conname name,contype::text type,pg_get_constraintdef(oid) definition
      FROM pg_constraint
      WHERE conrelid='public.india_gst_supplier_sez_status'::regclass`;
    expect(constraints.map(({ name }) => name).sort()).toEqual([
      "india_gst_supplier_sez_status_approval_shape_ck",
      "india_gst_supplier_sez_status_identity_uq",
      "india_gst_supplier_sez_status_legal_rule_ck",
      "india_gst_supplier_sez_status_pk",
      "india_gst_supplier_sez_status_registration_fk",
      "india_gst_supplier_sez_status_registration_status_ck",
      "india_gst_supplier_sez_status_source_ck",
      "india_gst_supplier_sez_status_status_hash_ck",
      "india_gst_supplier_sez_status_supplier_hash_ck",
      "india_gst_supplier_sez_status_taxpayer_type_ck",
    ].sort());
    expect(constraints.some(({ type, definition }) =>
      type === "f" &&
      /FOREIGN KEY \(tenant_id, supplier_registration_id\) REFERENCES property_fiscal_registration\(tenant_id, id\)/i.test(definition)
    )).toBeTrue();
    expect(constraints.some(({ type, definition }) =>
      type === "u" &&
      /tenant_id.+supplier_registration_id.+supplier_registration_evidence_hash.+status_as_of/i.test(definition)
    )).toBeTrue();

    const grants = await deploy!<Array<{
      can_select: boolean;
      can_insert: boolean;
      can_update: boolean;
      can_delete: boolean;
      can_truncate: boolean;
    }>>`SELECT
      has_table_privilege('app_role','public.india_gst_supplier_sez_status','SELECT') can_select,
      has_table_privilege('app_role','public.india_gst_supplier_sez_status','INSERT') can_insert,
      has_table_privilege('app_role','public.india_gst_supplier_sez_status','UPDATE') can_update,
      has_table_privilege('app_role','public.india_gst_supplier_sez_status','DELETE') can_delete,
      has_table_privilege('app_role','public.india_gst_supplier_sez_status','TRUNCATE') can_truncate`;
    expect(grants[0]).toEqual({
      can_select: true, can_insert: false, can_update: false,
      can_delete: false, can_truncate: false,
    });
  });

  test("P8: regular/G/B/C resolve exactly through principal/additional Order284 evidence", async () => {
    for (const [statusId, type, form, kind, expectedStatus] of [
      [STATUS_REGULAR, "regular", null, "principal_place_of_business",
        "affirmatively_non_sez_regular"],
      [STATUS_UNIT, "sez_unit", "sez_rules_form_g", "additional_place_of_business",
        "sez_unit"],
      [STATUS_DEVELOPER_B, "sez_developer", "sez_rules_form_b",
        "principal_place_of_business", "sez_developer"],
      [STATUS_DEVELOPER_C, "sez_developer", "sez_rules_form_c",
        "additional_place_of_business", "sez_developer"],
    ] as const) {
      await clearStatuses();
      await clearServiceLocations();
      await seedServiceLocation(kind);
      await seedStatus({ id: statusId, taxpayerType: type, approvalForm: form });
      const location = serviceLocation(kind);
      const selected = input({
        supplierServiceLocationId: location.supplierServiceLocationId,
        supplierSezStatusId: statusId,
      });
      const first = await resolveDatabase(selected, location);
      const replay = await resolveDatabase(selected, location);
      expect(first).toEqual(replay);
      expect(JSON.stringify(first)).toBe(JSON.stringify(replay));
      expect(first.sezStatus).toBe(expectedStatus);
      expect(first.supplierServiceLocation).toEqual({
        id: location.supplierServiceLocationId,
        evidenceHash: location.evidenceHash,
      });
      expect(first.supplier).toEqual(location.supplier);
      expectDeepFrozen(first);
    }
  });

  test("P9: absence, stale Order272 hash and foreign property/location/status fail closed", async () => {
    await clearStatuses();
    await expect(resolveDatabase()).rejects
      .toBeInstanceOf(IndiaGstSupplierSezStatusNotFoundError);
    await seedStatus({ id: STATUS_REGULAR });
    await expect(resolveDatabase(input({ supplierSezStatusId: STATUS_UNIT }))).rejects
      .toBeInstanceOf(IndiaGstSupplierSezStatusNotFoundError);

    const staleSupplier = deepFreeze({
      ...serviceLocation(),
      supplier: deepFreeze({
        registrationId: REGISTRATION_A,
        evidenceHash: "f".repeat(64),
      }),
    });
    await expect(resolveDatabase(input(), staleSupplier)).rejects
      .toBeInstanceOf(IndiaGstSupplierSezStatusConflictError);
    await expect(resolveDatabase(input({ propertyNode: PROPERTY_A_OTHER }))).rejects
      .toThrow();
    await expect(resolveDatabase(input({ reservationId: RESERVATION_OTHER }))).rejects
      .toThrow();
    await expect(resolveDatabase(input(), serviceLocation(), TENANT_B)).rejects
      .toBeInstanceOf(IndiaGstSupplierSezStatusNotFoundError);

    await clearStatuses();
    await seedStatus({ tenantId: TENANT_B, id: STATUS_B });
    await expect(resolveDatabase(input({ supplierSezStatusId: STATUS_B }))).rejects
      .toBeInstanceOf(IndiaGstSupplierSezStatusNotFoundError);
  });

  test("P10: unique/FK and every official status, approval, date and hash check reject defects", async () => {
    await clearStatuses();
    await seedStatus({ id: STATUS_REGULAR });
    await expectSqlState(seedStatus({ id: STATUS_UNIT }), "23505");
    await clearStatuses();

    const rejected: readonly StatusOptions[] = [
      { id: id(28671), registrationStatus: "suspended" },
      { id: id(28672), registrationStatus: "cancelled" },
      { id: id(28673), taxpayerType: "composition" },
      { id: id(28674), source: "property_profile" },
      { id: id(28675), statusEvidenceSha256: "A".repeat(64) },
      { id: id(28676), statusEvidenceSha256: "x".repeat(64) },
      { id: id(28677), supplierEvidenceHash: "A".repeat(64) },
      { id: id(28678), supplierEvidenceHash: "x".repeat(64) },
      { id: id(28679), taxpayerType: "regular", approvalForm: "sez_rules_form_g" },
      { id: id(28680), taxpayerType: "sez_unit", approvalForm: "sez_rules_form_b" },
      { id: id(28681), taxpayerType: "sez_unit", approvalForm: "sez_rules_form_c" },
      { id: id(28682), taxpayerType: "sez_developer", approvalForm: "sez_rules_form_g" },
      { id: id(28683), taxpayerType: "sez_unit", approvalReference: "" },
      { id: id(28684), taxpayerType: "sez_unit", approvalReference: " leading" },
      { id: id(28685), taxpayerType: "sez_unit", approvalReference: "LOA/286\n2039" },
      { id: id(28697), taxpayerType: "sez_unit", approvalReference: "x".repeat(129) },
      { id: id(28686), taxpayerType: "sez_unit", approvalValidity: "empty" },
      { id: id(28687), taxpayerType: "sez_unit", approvalValidity: "[,2040-01-01)" },
      { id: id(28688), taxpayerType: "sez_unit", approvalValidity: "[2039-01-01,)" },
      { id: id(28689), taxpayerType: "sez_unit", statusAsOf: "2040-01-01" },
      { id: id(28690), taxpayerType: "sez_unit", statusAsOf: "2038-12-31" },
      { id: id(28691), taxpayerType: "sez_unit", approvalStatus: "expired" },
      { id: id(28692), taxpayerType: "sez_unit", approvalEvidenceSha256: "A".repeat(64) },
      { id: id(28693), taxpayerType: "sez_unit", approvalEvidenceSha256: "x".repeat(64) },
      { id: id(28694), taxpayerType: "sez_unit", approvalForm: "sez_rules_form_f2" },
      { id: id(28695), legalRule: "IGST_ACT_7_5_B" },
    ];
    for (const defect of rejected) {
      await expectSqlState(seedStatus(defect), "23514");
    }
    await expectSqlState(
      seedStatus({ id: id(28696), registrationId: id(28699) }),
      "23503",
    );

    await seedStatus({
      id: STATUS_UNIT,
      taxpayerType: "sez_unit",
      statusAsOf: VALIDITY_FROM,
    });
    const lower = await resolveDatabase(
      input({ supplierSezStatusId: STATUS_UNIT }),
    );
    expect(lower.statusAsOf).toBe(VALIDITY_FROM);
  });

  test("P11: forced RLS reveals only own tenant and app_role DML stays denied", async () => {
    await clearStatuses();
    const ownId = await seedStatus({ id: STATUS_REGULAR });
    const foreignId = await seedStatus({ tenantId: TENANT_B, id: STATUS_B });
    const visible = await database!.withTenantTransaction(TENANT_A, (tx) =>
      tx<Array<{ id: string }>>`
        SELECT id::text FROM india_gst_supplier_sez_status ORDER BY id`
    );
    expect(visible).toEqual([{ id: ownId }]);
    expect(visible.some(({ id }) => id === foreignId)).toBeFalse();

    await expectSqlState(database!.withTenantTransaction(TENANT_A, (tx) =>
      tx`INSERT INTO india_gst_supplier_sez_status(
        tenant_id,id,supplier_registration_id,supplier_registration_evidence_hash,
        status_as_of,gst_registration_status,gst_taxpayer_type,gst_status_source,
        gst_status_evidence_sha256,legal_rule
      ) VALUES (
        ${TENANT_A}::uuid,${STATUS_UNIT}::uuid,${REGISTRATION_A}::uuid,
        ${supplierRegistration().evidenceHash},${STATUS_AS_OF}::date,
        'active','regular','gst_common_portal',${GST_STATUS_HASH},${LEGAL_RULE}
      )`
    ), "42501");
    await expectSqlState(database!.withTenantTransaction(TENANT_A, (tx) =>
      tx`UPDATE india_gst_supplier_sez_status SET status_as_of='2039-05-16'
        WHERE tenant_id=${TENANT_A}::uuid AND id=${ownId}::uuid`
    ), "42501");
    await expectSqlState(database!.withTenantTransaction(TENANT_A, (tx) =>
      tx`DELETE FROM india_gst_supplier_sez_status
        WHERE tenant_id=${TENANT_A}::uuid AND id=${ownId}::uuid`
    ), "42501");
  });

  test("P12: property/config/location labels and missing evidence never substitute", async () => {
    await clearStatuses();
    await expect(resolveDatabase()).rejects
      .toBeInstanceOf(IndiaGstSupplierSezStatusNotFoundError);
    await seedStatus({ id: STATUS_REGULAR });
    const before = await resolveDatabase();
    await deploy!`UPDATE org_node SET name='Changed SEZ Unit',
      config='{"sez":false,"SupTyp":"SEZWP","Pos":"29","authorized_operations":true}'::jsonb
      WHERE tenant_id=${TENANT_A}::uuid AND id=${PROPERTY_A}::uuid`;
    await deploy!`UPDATE extension SET
      content='{"country":"IN","price_display":"tax_exclusive","rounding":"line","taxes":[],"sez":true}'::jsonb
      WHERE id=${EXTENSION_A}::uuid`;
    const after = await resolveDatabase();
    expect(after).toEqual(before);
    expect(after.sezStatus).toBe("affirmatively_non_sez_regular");
  });

  test("P13: happy, replay and hostile failures preserve Order272/284/285 and all effects", async () => {
    await clearStatuses();
    await clearServiceLocations();
    await seedServiceLocation("additional_place_of_business");
    await seedStatus({ id: STATUS_UNIT, taxpayerType: "sez_unit" });
    const location = serviceLocation("additional_place_of_business");
    const selected = input({
      supplierServiceLocationId: LOCATION_ADDITIONAL,
      supplierSezStatusId: STATUS_UNIT,
    });
    const before = await effects();
    await resolveDatabase(selected, location);
    await resolveDatabase(selected, location);
    await expect(resolveDatabase(input({ supplierSezStatusId: STATUS_REGULAR }))).rejects
      .toThrow();
    await expect(resolveDatabase(input({ propertyNode: PROPERTY_A_OTHER }))).rejects
      .toThrow();
    await expect(resolveDatabase(input({ reservationId: RESERVATION_OTHER }))).rejects
      .toThrow();
    expect(await effects()).toEqual(before);
  });
});

test("Order 286 P14: source remains SELECT-only supplier-status evidence", async () => {
  const source = await Bun.file(new URL(
    "../src/contexts/tax-fiscal/india-gst-supplier-sez-status.ts",
    import.meta.url,
  )).text();
  expect(source).toContain("IndiaGstSupplierServiceLocationService");
  expect(source).toContain(LEGAL_RULE);
  expect(source).toContain("gst_common_portal");
  expect(source).toContain("affirmatively_non_sez_regular");
  expect(source).not.toMatch(/\b(?:INSERT\s+INTO|UPDATE\s+[A-Za-z_]|DELETE\s+FROM)\b/i);
  expect(source).not.toMatch(/\b(?:FOR\s+UPDATE|FOR\s+SHARE|pg_advisory|lock_financial_rows)\b/i);
  expect(source).not.toMatch(/\b(?:recordFact|publish|emit|idempotency|document_series)\b/i);
  expect(source).not.toMatch(/\b(?:journal|posting_line|fiscal_submission|outbox)\b/i);
  expect(source).not.toMatch(/\b(?:party_fiscal_registration|property_fiscal_location|registered_state|recipient_sez_status|india_gst_item_classification)\b/i);
  expect(source).not.toMatch(/\b(?:form_f2|authorized_operations|zero_rating|refund|SEZWP|SEZWOP|IgstOnIntra|reverse_charge)\b/i);
  expect(source).not.toMatch(/\b(?:intraState|interState|supplyNature|CGST|SGST|UTGST|levy)\b/);
  expect(source).not.toMatch(/\b(?:SupTyp|ItemList|SlNo|Qty|UnitPrice|GstRt|CgstAmt|SgstAmt|IgstAmt)\b/);
  expect(source).not.toMatch(/\b(?:SellerDtls|party_role|profile|config|SAC|tax_code)\b/);
  expect(source).not.toMatch(/Date\.now|new\s+Date|CURRENT_DATE|CURRENT_TIMESTAMP|\bnow\s*\(/i);
});
