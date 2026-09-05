import { describe, expect, test } from "bun:test";

import {
  IndiaGstSupplierRegistrationStatusConflictError,
  IndiaGstSupplierRegistrationStatusNotFoundError,
  IndiaGstSupplierRegistrationStatusService,
  IndiaGstSupplierRegistrationStatusValidationError,
} from "../src/contexts/tax-fiscal";
import type { Tx } from "../src/kernel";

const id = (suffix: number): string =>
  `00000000-0000-0000-0000-${String(suffix).padStart(12, "0")}`;
const sha256 = (value: unknown): string =>
  new Bun.CryptoHasher("sha256").update(JSON.stringify(value)).digest("hex");

const TENANT = id(28901);
const PROPERTY = id(28902);
const RESERVATION = id(28903);
const REGISTRATION = id(28904);
const LOCATION = id(28905);
const STATUS = id(28906);
const EXTENSION = id(28907);
const STATUS_DATE = "2043-01-01";
const STATUS_EVIDENCE = "f".repeat(64);
const LEGAL_RULE = "CGST_ACT_25_29_30_AND_RULE_21A_REGISTRATION_STATUS";

type Mutable = Record<PropertyKey, unknown>;
type TaxpayerType = "regular" | "sez_unit" | "sez_developer";
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
  readonly legal_rule: string;
}

function deepFreeze<T>(value: T, seen = new Set<object>()): T {
  if (typeof value !== "object" || value === null || seen.has(value)) return value;
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) deepFreeze((value as Mutable)[key], seen);
  return Object.freeze(value);
}

function expectDeepFrozen(value: unknown, seen = new Set<object>()): void {
  if (typeof value !== "object" || value === null || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBeTrue();
  for (const key of Reflect.ownKeys(value)) expectDeepFrozen((value as Mutable)[key], seen);
}

function supplierRegistration() {
  const jurisdiction = deepFreeze({
    extensionId: EXTENSION,
    ownerTenantId: TENANT,
    key: "in.order289.gst.27",
    version: "7",
    contentHash: "d".repeat(64),
  });
  const body = {
    registrationId: REGISTRATION,
    tenantId: TENANT,
    propertyNode: PROPERTY,
    scheme: "in-gstin",
    currency: "INR",
    jurisdiction,
    gstin: "27AAPFU0939F1ZV",
    stateCode: "27",
    legalName: "Yellow Order 289 Hotel Private Limited",
    tradeName: "Yellow Order 289 Hotel",
    addressLine: "1 Marine Drive",
    locality: "Mumbai",
    postalCode: "400001",
  };
  return deepFreeze({ ...body, evidenceHash: sha256(body) });
}

function serviceLocation(overrides: Record<string, unknown> = {}) {
  const registration = supplierRegistration();
  const body = {
    supplierServiceLocationId: LOCATION,
    propertyNode: PROPERTY,
    jurisdiction: registration.jurisdiction,
    supplier: deepFreeze({
      registrationId: registration.registrationId,
      evidenceHash: registration.evidenceHash,
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
  return deepFreeze({ ...body, evidenceHash: sha256({ tenantId: TENANT, ...body }) });
}

function rehashLocation(root: Mutable): void {
  const { evidenceHash: _hash, ...body } = root;
  root.evidenceHash = sha256({ tenantId: TENANT, ...body });
}

function input(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: TENANT,
    propertyNode: PROPERTY,
    reservationId: RESERVATION,
    supplierServiceLocationId: LOCATION,
    supplierGstRegistrationStatusId: STATUS,
    statusAsOf: STATUS_DATE,
    ...overrides,
  };
}

function row(
  gstTaxpayerType: TaxpayerType = "regular",
  overrides: Partial<StatusRow> = {},
): StatusRow {
  const registration = supplierRegistration();
  return {
    tenant_id: TENANT,
    id: STATUS,
    supplier_registration_id: REGISTRATION,
    supplier_registration_evidence_hash: registration.evidenceHash,
    status_as_of: STATUS_DATE,
    gst_registration_status: "active",
    gst_taxpayer_type: gstTaxpayerType,
    gst_status_source: "gst_common_portal",
    gst_status_evidence_sha256: STATUS_EVIDENCE,
    legal_rule: LEGAL_RULE,
    ...overrides,
  };
}

function fakeTx(rows: readonly StatusRow[], statements: string[] = []): Tx {
  return (async (strings: TemplateStringsArray) => {
    statements.push(strings.join("?"));
    return rows;
  }) as unknown as Tx;
}

function harness(
  root: unknown = serviceLocation(),
  rows: readonly StatusRow[] = [row()],
  statements: string[] = [],
) {
  const calls: unknown[] = [];
  const service = new IndiaGstSupplierRegistrationStatusService({
    async resolve(_tx: Tx, selected: unknown) {
      calls.push(selected);
      return root as never;
    },
  });
  return { service, tx: fakeTx(rows, statements), calls, statements };
}

function expectedBody(source: StatusRow = row()) {
  const location = serviceLocation();
  const registration = supplierRegistration();
  return {
    supplierGstRegistrationStatusId: source.id,
    propertyNode: PROPERTY,
    supplierServiceLocation: { id: LOCATION, evidenceHash: location.evidenceHash },
    supplier: { registrationId: REGISTRATION, evidenceHash: registration.evidenceHash },
    statusAsOf: source.status_as_of,
    gstRegistration: {
      status: "active",
      taxpayerType: source.gst_taxpayer_type,
      source: "gst_common_portal",
      evidenceSha256: source.gst_status_evidence_sha256,
    },
    legalRule: LEGAL_RULE,
  };
}

test("Order 289 P0: exact migration and resolver surface exist", async () => {
  expect(typeof IndiaGstSupplierRegistrationStatusService).toBe("function");
  const sql = await Bun.file(new URL(
    "../migrations/0055_india_gst_supplier_registration_status.sql",
    import.meta.url,
  )).text();
  expect(sql).toContain(
    "CREATE TABLE public.india_gst_supplier_registration_status_snapshot",
  );
  expect(sql).toContain("FOREIGN KEY (tenant_id, supplier_registration_id)");
  expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
  expect(sql).toContain("FORCE ROW LEVEL SECURITY");
  expect(sql).toMatch(/GRANT\s+SELECT[\s\S]*india_gst_supplier_registration_status_snapshot[\s\S]*TO\s+app_role/i);
});

test("Order 289 P1: active regular, SEZ unit and SEZ developer exact-date snapshots are canonical", async () => {
  for (const type of ["regular", "sez_unit", "sez_developer"] as const) {
    const stored = row(type);
    const selected = input();
    const root = serviceLocation();
    const before = JSON.stringify({ selected, root, stored });
    const target = harness(root, [stored]);
    const first = await target.service.resolve(target.tx, selected as never);
    const replay = await target.service.resolve(target.tx, selected as never);
    const body = expectedBody(stored);
    expect(first).toEqual({
      ...body,
      evidenceHash: sha256({ tenantId: TENANT, ...body }),
    } as typeof first);
    expect(Object.keys(first)).toEqual([
      "supplierGstRegistrationStatusId", "propertyNode", "supplierServiceLocation",
      "supplier", "statusAsOf", "gstRegistration", "legalRule", "evidenceHash",
    ]);
    expect(Object.keys(first.supplierServiceLocation)).toEqual(["id", "evidenceHash"]);
    expect(Object.keys(first.supplier)).toEqual(["registrationId", "evidenceHash"]);
    expect(Object.keys(first.gstRegistration)).toEqual([
      "status", "taxpayerType", "source", "evidenceSha256",
    ]);
    expect(first).toEqual(replay);
    expect(first).not.toHaveProperty("tenantId");
    expectDeepFrozen(first);
    expect(JSON.stringify({ selected, root, stored })).toBe(before);
  }
});

test("Order 289 P2: exact six-key plain input rejects ambiguity before dependency or SQL", async () => {
  const exact = input();
  const hostile: unknown[] = [null, [], new Proxy({ ...exact }, {}),
    Object.assign(Object.create({ inherited: true }), exact), { ...exact, extra: true }];
  for (const key of Object.keys(exact)) {
    const missing = { ...exact } as Mutable;
    delete missing[key];
    hostile.push(missing);
  }
  for (const key of ["tenantId", "propertyNode", "reservationId",
    "supplierServiceLocationId", "supplierGstRegistrationStatusId"])
    hostile.push({ ...exact, [key]: "not-a-uuid" });
  for (const date of ["", "2043-1-01", "2043-02-29", "2100-02-29",
    "2043-01-01Z", "0000-01-01"])
    hostile.push({ ...exact, statusAsOf: date });
  const accessor = { ...exact } as Mutable;
  Object.defineProperty(accessor, "statusAsOf", {
    enumerable: true, get: () => STATUS_DATE,
  });
  hostile.push(accessor);
  const symbolic = { ...exact } as Mutable;
  symbolic[Symbol("hidden")] = true;
  hostile.push(symbolic);
  for (const candidate of hostile) {
    const target = harness();
    await expect(target.service.resolve(target.tx, candidate as never)).rejects
      .toBeInstanceOf(IndiaGstSupplierRegistrationStatusValidationError);
    expect(target.calls).toHaveLength(0);
    expect(target.statements).toHaveLength(0);
  }
  const target = harness();
  await expect(target.service.resolve(null as never, exact as never)).rejects
    .toBeInstanceOf(IndiaGstSupplierRegistrationStatusValidationError);
  expect(target.calls).toHaveLength(0);
});

test("Order 289 P3: complete frozen Order284 service-location and Order272 registration lineage is rehashed", async () => {
  const pristine = serviceLocation();
  const hostile: unknown[] = [null, [], structuredClone(pristine),
    new Proxy(structuredClone(pristine), {}), deepFreeze({ ...pristine, extra: true })];
  for (const key of Object.keys(pristine)) {
    const missing = structuredClone(pristine) as Mutable;
    delete missing[key];
    hostile.push(deepFreeze(missing));
  }
  const accessor = structuredClone(pristine) as Mutable;
  Object.defineProperty(accessor, "evidenceHash", {
    enumerable: true, get: () => pristine.evidenceHash,
  });
  hostile.push(Object.freeze(accessor));
  const symbolic = structuredClone(pristine) as Mutable;
  symbolic[Symbol("hidden")] = true;
  hostile.push(deepFreeze(symbolic));
  for (const root of hostile) {
    const target = harness(root);
    await expect(target.service.resolve(target.tx, input() as never)).rejects
      .toBeInstanceOf(IndiaGstSupplierRegistrationStatusConflictError);
    expect(target.statements).toHaveLength(0);
  }

  for (const defect of [
    { evidenceHash: "9".repeat(64) },
    { propertyNode: id(28981) },
    { supplierServiceLocationId: id(28982) },
    { serviceScope: "restaurant_service" },
    { locationBasis: "property_profile" },
    { legalRule: "IGST_ACT_8_2" },
    { supplier: deepFreeze({ registrationId: id(28983), evidenceHash: "e".repeat(64) }) },
    { registeredPlace: deepFreeze({
      kind: "warehouse", stateCode: "27", addressLine: "1 Marine Drive",
      locality: "Mumbai", postalCode: "400001",
    }) },
  ]) {
    const target = harness(deepFreeze({ ...pristine, ...defect }));
    await expect(target.service.resolve(target.tx, input() as never)).rejects
      .toBeInstanceOf(IndiaGstSupplierRegistrationStatusConflictError);
  }

  const changedRegistration = structuredClone(pristine) as Mutable;
  (changedRegistration.supplier as Mutable).evidenceHash = "9".repeat(64);
  rehashLocation(changedRegistration);
  const changedTarget = harness(deepFreeze(changedRegistration), [row()]);
  await expect(changedTarget.service.resolve(changedTarget.tx, input() as never)).rejects
    .toBeInstanceOf(IndiaGstSupplierRegistrationStatusConflictError);
});

test("Order 289 P4: exact equality SELECT rejects missing, duplicate, date and cross-lineage rows", async () => {
  const missing = harness(serviceLocation(), []);
  await expect(missing.service.resolve(missing.tx, input() as never)).rejects
    .toBeInstanceOf(IndiaGstSupplierRegistrationStatusNotFoundError);
  const duplicate = harness(serviceLocation(), [row(), row()]);
  await expect(duplicate.service.resolve(duplicate.tx, input() as never)).rejects
    .toBeInstanceOf(IndiaGstSupplierRegistrationStatusConflictError);

  const defects: readonly Partial<StatusRow>[] = [
    { tenant_id: id(28991) }, { id: id(28992) },
    { supplier_registration_id: id(28993) },
    { supplier_registration_evidence_hash: "9".repeat(64) },
    { status_as_of: "2042-12-31" }, { status_as_of: "2043-01-02" },
    { status_as_of: "2043-02-29" },
    { gst_registration_status: "inactive" },
    { gst_registration_status: "suspended" },
    { gst_registration_status: "cancelled" },
    { gst_registration_status: "unknown" },
    { gst_taxpayer_type: "composition" },
    { gst_status_source: "property_profile" },
    { gst_status_evidence_sha256: "F".repeat(64) },
    { legal_rule: "CGST_ACT_25" },
  ];
  for (const defect of defects) {
    const target = harness(serviceLocation(), [row("regular", defect)]);
    await expect(target.service.resolve(target.tx, input() as never)).rejects
      .toBeInstanceOf(IndiaGstSupplierRegistrationStatusConflictError);
  }
});

test("Order 289 P5: exact ten-field stored row rejects accessors, proxies, symbols and shape drift", async () => {
  const pristine = row();
  const hostile: unknown[] = [{ ...pristine, extra: true }, new Proxy({ ...pristine }, {})];
  for (const key of Object.keys(pristine)) {
    const missing = { ...pristine } as Mutable;
    delete missing[key];
    hostile.push(missing);
  }
  const accessor = { ...pristine } as Mutable;
  Object.defineProperty(accessor, "gst_registration_status", {
    enumerable: true, get: () => "active",
  });
  hostile.push(accessor);
  const symbolic = { ...pristine } as Mutable;
  symbolic[Symbol("hidden")] = true;
  hostile.push(symbolic);
  for (const candidate of hostile) {
    const target = harness(serviceLocation(), [candidate as StatusRow]);
    await expect(target.service.resolve(target.tx, input() as never)).rejects
      .toBeInstanceOf(IndiaGstSupplierRegistrationStatusConflictError);
  }
});

test("Order 289 P6: dependency and SQL bind every explicit identity without latest, clock or writes", async () => {
  const statements: string[] = [];
  const target = harness(serviceLocation(), [row()], statements);
  await target.service.resolve(target.tx, input() as never);
  expect(target.calls).toEqual([{
    tenantId: TENANT,
    propertyNode: PROPERTY,
    reservationId: RESERVATION,
    supplierServiceLocationId: LOCATION,
  }]);
  expect(statements).toHaveLength(1);
  const sql = statements[0]!;
  expect(sql).toContain("public.india_gst_supplier_registration_status_snapshot");
  expect(sql).toContain("current_setting('app.tenant_id', true)");
  for (const predicate of ["status_row.tenant_id", "status_row.id",
    "status_row.supplier_registration_id",
    "status_row.supplier_registration_evidence_hash", "status_row.status_as_of"])
    expect(sql).toContain(predicate);
  expect(sql).not.toMatch(/ORDER BY|LIMIT|latest|nearest|current_date|now\s*\(/i);
  expect(sql).not.toMatch(/\b(?:INSERT\s+INTO|UPDATE\s+public\.|DELETE\s+FROM|TRUNCATE|LOCK|FOR\s+UPDATE|FOR\s+SHARE)\b/i);
});

test("Order 289 P7: static containment excludes clocks, network and downstream statutory authority", async () => {
  const source = await Bun.file(new URL(
    "../src/contexts/tax-fiscal/india-gst-supplier-registration-status.ts",
    import.meta.url,
  )).text();
  expect(source).not.toMatch(/latest|nearest|current_date|Date\.now|new Date/i);
  expect(source).not.toMatch(/fetch\s*\(|https?:|Elysia|app\.(?:get|post|put|delete)/i);
  expect(source).not.toMatch(/form.?g|form.?f2|letter.?of.?approval|\bloa\b|renewal/i);
  expect(source).not.toMatch(/time.?of.?supply|supply.?nature|authorized.?operations|specified.?officer/i);
  expect(source).not.toMatch(/zero.?rat|refund|BLUT|SupTyp|IgstOnIntra|invoice|document|submission/i);
  expect(source).not.toMatch(/\b(?:INSERT\s+INTO|UPDATE\s+public\.|DELETE\s+FROM|TRUNCATE|journal|posting|outbox)\b/i);
  expect(source).toContain(LEGAL_RULE);
});

const databaseDescribe = process.env.YELLOW_ORDER289_DATABASE_URL
  ? describe.serial
  : describe.skip;

databaseDescribe("Order 289 isolated PostgreSQL RLS/ACL and zero-write proof", () => {
  test("P8: exact catalogue is forced-RLS, SELECT-only and tenant isolated", async () => {
    const { SQL } = await import("bun");
    const deployUrl = process.env.YELLOW_DEPLOY_DATABASE_URL;
    const runtimeUrl = process.env.YELLOW_ORDER289_DATABASE_URL;
    if (!deployUrl || !runtimeUrl) throw new Error("isolated deploy/runtime URLs required");
    const deploy = new SQL(deployUrl, { max: 1 });
    const runtime = new SQL(runtimeUrl, { max: 1 });
    const tenantB = id(28982);
    const statusB = id(28983);
    const registrationB = id(28984);
    const registrationHash = supplierRegistration().evidenceHash;
    try {
      const columns = await deploy<Array<{ column_name: string }>>`
        SELECT column_name FROM information_schema.columns
         WHERE table_schema='public'
           AND table_name='india_gst_supplier_registration_status_snapshot'
         ORDER BY ordinal_position`;
      expect(columns.map((entry) => entry.column_name)).toEqual([
        "tenant_id", "id", "supplier_registration_id",
        "supplier_registration_evidence_hash", "status_as_of",
        "gst_registration_status", "gst_taxpayer_type", "gst_status_source",
        "gst_status_evidence_sha256", "legal_rule",
      ]);
      const acl = await deploy<Array<Record<string, boolean>>>`
        SELECT has_table_privilege('app_role','public.india_gst_supplier_registration_status_snapshot','SELECT') select_ok,
               has_table_privilege('app_role','public.india_gst_supplier_registration_status_snapshot','INSERT') insert_ok,
               has_table_privilege('app_role','public.india_gst_supplier_registration_status_snapshot','UPDATE') update_ok,
               has_table_privilege('app_role','public.india_gst_supplier_registration_status_snapshot','DELETE') delete_ok,
               has_table_privilege('app_role','public.india_gst_supplier_registration_status_snapshot','TRUNCATE') truncate_ok`;
      expect(acl[0]).toEqual({
        select_ok: true, insert_ok: false, update_ok: false,
        delete_ok: false, truncate_ok: false,
      });
      const rls = await deploy<Array<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>>`
        SELECT relrowsecurity, relforcerowsecurity FROM pg_class
         WHERE oid='public.india_gst_supplier_registration_status_snapshot'::regclass`;
      expect(rls[0]).toEqual({ relrowsecurity: true, relforcerowsecurity: true });
      await deploy`SET session_replication_role = replica`;
      try {
        await deploy`INSERT INTO public.india_gst_supplier_registration_status_snapshot(
          tenant_id,id,supplier_registration_id,supplier_registration_evidence_hash,
          status_as_of,gst_registration_status,gst_taxpayer_type,gst_status_source,
          gst_status_evidence_sha256,legal_rule
        ) VALUES
          (${TENANT}::uuid,${STATUS}::uuid,${REGISTRATION}::uuid,${registrationHash},
           ${STATUS_DATE}::date,'active','regular','gst_common_portal',${STATUS_EVIDENCE},${LEGAL_RULE}),
          (${tenantB}::uuid,${statusB}::uuid,${registrationB}::uuid,${"9".repeat(64)},
           ${STATUS_DATE}::date,'active','sez_unit','gst_common_portal',${STATUS_EVIDENCE},${LEGAL_RULE})`;
      } finally {
        await deploy`SET session_replication_role = origin`;
      }
      const before = await deploy<Array<{ row_count: number; digest: string }>>`
        SELECT count(*)::int row_count,
               md5(coalesce(string_agg(row_to_json(status_row)::text,'|' ORDER BY id),'')) digest
          FROM public.india_gst_supplier_registration_status_snapshot status_row
         WHERE id IN (${STATUS}::uuid,${statusB}::uuid)`;
      await runtime.begin(async (tx) => {
        await tx`SET LOCAL ROLE app_role`;
        await tx`SELECT set_config('app.tenant_id',${TENANT},true)`;
        const visible = await tx<Array<{ id: string }>>`
          SELECT id::text id FROM public.india_gst_supplier_registration_status_snapshot`;
        expect(visible).toEqual([{ id: STATUS }]);
      });
      for (const mutate of ["INSERT", "UPDATE", "DELETE", "TRUNCATE"] as const) {
        let sqlState: unknown;
        try {
          await runtime.begin(async (tx) => {
            await tx.unsafe("SET LOCAL ROLE app_role");
            await tx`SELECT set_config('app.tenant_id',${TENANT},true)`;
            if (mutate === "INSERT") await tx.unsafe(`INSERT INTO public.india_gst_supplier_registration_status_snapshot SELECT * FROM public.india_gst_supplier_registration_status_snapshot WHERE false`);
            if (mutate === "UPDATE") await tx`UPDATE public.india_gst_supplier_registration_status_snapshot SET gst_taxpayer_type='sez_unit' WHERE id=${STATUS}::uuid`;
            if (mutate === "DELETE") await tx`DELETE FROM public.india_gst_supplier_registration_status_snapshot WHERE id=${STATUS}::uuid`;
            if (mutate === "TRUNCATE") await tx`TRUNCATE public.india_gst_supplier_registration_status_snapshot`;
          });
        } catch (error) {
          sqlState = (error as { errno?: unknown }).errno;
        }
        expect(sqlState).toBe("42501");
      }
      const after = await deploy<Array<{ row_count: number; digest: string }>>`
        SELECT count(*)::int row_count,
               md5(coalesce(string_agg(row_to_json(status_row)::text,'|' ORDER BY id),'')) digest
          FROM public.india_gst_supplier_registration_status_snapshot status_row
         WHERE id IN (${STATUS}::uuid,${statusB}::uuid)`;
      expect(after).toEqual(before);
    } finally {
      await deploy`DELETE FROM public.india_gst_supplier_registration_status_snapshot
        WHERE id IN (${STATUS}::uuid,${statusB}::uuid)`;
      await Promise.all([deploy.close(), runtime.close()]);
    }
  }, 30_000);
});
