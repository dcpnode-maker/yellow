import { describe, expect, test } from "bun:test";

import {
  IndiaSezUnitLoaRenewalConflictError,
  IndiaSezUnitLoaRenewalNotFoundError,
  IndiaSezUnitLoaRenewalService,
  IndiaSezUnitLoaRenewalValidationError,
} from "../src/contexts/tax-fiscal";
import type { Tx } from "../src/kernel";

const id = (suffix: number): string =>
  `00000000-0000-0000-0000-${String(suffix).padStart(12, "0")}`;
const sha256 = (value: unknown): string =>
  new Bun.CryptoHasher("sha256").update(JSON.stringify(value)).digest("hex");

const TENANT = id(28801);
const PROPERTY = id(28802);
const RESERVATION = id(28803);
const REGISTRATION = id(28804);
const LOCATION = id(28805);
const STATUS = id(28806);
const RENEWAL = id(28807);
const EXTENSION = id(28808);
const ORIGINAL_FROM = "2038-01-01";
const ORIGINAL_TO = "2043-01-01";
const RENEWAL_STATUS_DATE = "2043-01-01";
const ORIGINAL_REFERENCE = "LOA/G/288/2038";
const ORIGINAL_HASH = "a".repeat(64);
const F2_HASH = "b".repeat(64);
const STATUS_HASH = "c".repeat(64);
const LEGAL_RULE = "SEZ_RULES_19_6_AND_19_6A_3_FORM_F2_CONTINUITY";

type Mutable = Record<PropertyKey, unknown>;
interface RenewalRow {
  readonly tenant_id: string;
  readonly id: string;
  readonly supplier_sez_status_id: string;
  readonly original_loa_reference: string;
  readonly original_loa_issue_date: string;
  readonly original_loa_evidence_sha256: string;
  readonly form_f2_file_number: string;
  readonly form_f2_issue_date: string;
  readonly renewal_validity: string;
  readonly renewal_status_as_of: string;
  readonly renewal_status: string;
  readonly renewal_status_source: string;
  readonly renewal_status_evidence_sha256: string;
  readonly form_f2_evidence_sha256: string;
  readonly legal_rule: string;
}

function deepFreeze<T>(value: T, seen = new Set<object>()): T {
  if (typeof value !== "object" || value === null || seen.has(value)) return value;
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) deepFreeze((value as Mutable)[key], seen);
  return Object.freeze(value);
}

function jurisdiction() {
  return deepFreeze({
    extensionId: EXTENSION,
    ownerTenantId: TENANT,
    key: "in.order288.gst.27",
    version: "7",
    contentHash: "d".repeat(64),
  });
}

function serviceLocation() {
  const body = {
    supplierServiceLocationId: LOCATION,
    propertyNode: PROPERTY,
    jurisdiction: jurisdiction(),
    supplier: deepFreeze({ registrationId: REGISTRATION, evidenceHash: "e".repeat(64) }),
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
  };
  return deepFreeze({ ...body, evidenceHash: sha256({ tenantId: TENANT, ...body }) });
}

function supplierStatus(overrides: Record<string, unknown> = {}) {
  const location = serviceLocation();
  const body = {
    supplierSezStatusId: STATUS,
    propertyNode: PROPERTY,
    supplierServiceLocation: deepFreeze({ id: LOCATION, evidenceHash: location.evidenceHash }),
    supplier: deepFreeze({ registrationId: REGISTRATION, evidenceHash: "e".repeat(64) }),
    statusAsOf: "2039-05-15",
    gstRegistration: deepFreeze({
      status: "active",
      taxpayerType: "sez_unit",
      source: "gst_common_portal",
      evidenceSha256: "f".repeat(64),
    }),
    sezStatus: "sez_unit",
    approval: deepFreeze({
      form: "sez_rules_form_g",
      reference: ORIGINAL_REFERENCE,
      validity: deepFreeze({ fromInclusive: ORIGINAL_FROM, toExclusive: ORIGINAL_TO }),
      status: "in_force",
      evidenceSha256: ORIGINAL_HASH,
    }),
    legalRule: "IGST_ACT_7_5_B_AND_8_2_SUPPLIER_STATUS",
    ...overrides,
  };
  return deepFreeze({ ...body, evidenceHash: sha256({ tenantId: TENANT, ...body }) });
}

function rehashSupplierStatus(root: Mutable): void {
  const { evidenceHash: _hash, ...body } = root;
  root.evidenceHash = sha256({ tenantId: TENANT, ...body });
}

function input(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: TENANT,
    propertyNode: PROPERTY,
    reservationId: RESERVATION,
    supplierServiceLocationId: LOCATION,
    supplierSezStatusId: STATUS,
    supplierLoaRenewalId: RENEWAL,
    statusAsOf: RENEWAL_STATUS_DATE,
    ...overrides,
  };
}

function row(overrides: Partial<RenewalRow> = {}): RenewalRow {
  return {
    tenant_id: TENANT,
    id: RENEWAL,
    supplier_sez_status_id: STATUS,
    original_loa_reference: ORIGINAL_REFERENCE,
    original_loa_issue_date: ORIGINAL_FROM,
    original_loa_evidence_sha256: ORIGINAL_HASH,
    form_f2_file_number: "F2/DC/288/2042",
    form_f2_issue_date: "2042-12-15",
    renewal_validity: `[${ORIGINAL_TO},2048-01-01)`,
    renewal_status_as_of: RENEWAL_STATUS_DATE,
    renewal_status: "in_force",
    renewal_status_source: "development_commissioner_record",
    renewal_status_evidence_sha256: STATUS_HASH,
    form_f2_evidence_sha256: F2_HASH,
    legal_rule: LEGAL_RULE,
    ...overrides,
  };
}

function fakeTx(rows: readonly RenewalRow[], statements: string[] = []): Tx {
  return (async (strings: TemplateStringsArray) => {
    statements.push(strings.join("?"));
    return rows;
  }) as unknown as Tx;
}

function harness(
  root: unknown = supplierStatus(),
  rows: readonly RenewalRow[] = [row()],
  statements: string[] = [],
) {
  const calls: unknown[] = [];
  const service = new IndiaSezUnitLoaRenewalService({
    async resolve(_tx: Tx, selected: unknown) {
      calls.push(selected);
      return root as never;
    },
  });
  return { service, tx: fakeTx(rows, statements), calls, statements };
}

function expectedBody(source: RenewalRow = row()) {
  const location = serviceLocation();
  return {
    supplierLoaRenewalId: source.id,
    supplierSezStatusId: source.supplier_sez_status_id,
    propertyNode: PROPERTY,
    supplierServiceLocation: { id: LOCATION, evidenceHash: location.evidenceHash },
    supplier: { registrationId: REGISTRATION, evidenceHash: "e".repeat(64) },
    statusAsOf: source.renewal_status_as_of,
    originalLoa: {
      form: "sez_rules_form_g",
      reference: source.original_loa_reference,
      issueDate: source.original_loa_issue_date,
      validity: { fromInclusive: ORIGINAL_FROM, toExclusive: ORIGINAL_TO },
      status: "in_force",
      evidenceSha256: source.original_loa_evidence_sha256,
    },
    renewal: {
      form: "sez_rules_form_f2",
      fileNumber: source.form_f2_file_number,
      issueDate: source.form_f2_issue_date,
      validity: {
        fromInclusive: source.renewal_validity.slice(1, 11),
        toExclusive: source.renewal_validity.slice(12, 22),
      },
      statusAsOf: source.renewal_status_as_of,
      status: "in_force",
      source: "development_commissioner_record",
      statusEvidenceSha256: source.renewal_status_evidence_sha256,
      evidenceSha256: source.form_f2_evidence_sha256,
    },
    continuity: {
      from: "sez_rules_form_g",
      to: "sez_rules_form_f2",
      exactlyContiguous: true,
    },
    legalRule: LEGAL_RULE,
  };
}

function expectDeepFrozen(value: unknown, seen = new Set<object>()): void {
  if (typeof value !== "object" || value === null || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBeTrue();
  for (const key of Reflect.ownKeys(value)) expectDeepFrozen((value as Mutable)[key], seen);
}

test("Order 288 P0: exact migration and resolver surface exist", async () => {
  expect(typeof IndiaSezUnitLoaRenewalService).toBe("function");
  const sql = await Bun.file(new URL(
    "../migrations/0054_india_sez_unit_loa_renewal.sql",
    import.meta.url,
  )).text();
  expect(sql).toContain("CREATE TABLE public.india_sez_unit_loa_renewal");
  expect(sql).toContain("FOREIGN KEY (tenant_id, supplier_sez_status_id)");
  expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
  expect(sql).toContain("FORCE ROW LEVEL SECURITY");
  expect(sql).toContain("GRANT SELECT ON TABLE public.india_sez_unit_loa_renewal TO app_role");
});

test("Order 288 P1: direct-contiguous five-year and shorter first Form-F2 renewals are exact", async () => {
  for (const renewal of [
    row(),
    row({ renewal_validity: `[${ORIGINAL_TO},2045-07-01)` }),
  ]) {
    const target = harness(supplierStatus(), [renewal]);
    const selected = input();
    const before = JSON.stringify({ selected, renewal });
    const first = await target.service.resolve(target.tx, selected as never);
    const replay = await target.service.resolve(target.tx, selected as never);
    const body = expectedBody(renewal);
    expect(first).toEqual({
      ...body,
      evidenceHash: sha256({ tenantId: TENANT, ...body }),
    } as typeof first);
    expect(Object.keys(first)).toEqual([
      "supplierLoaRenewalId", "supplierSezStatusId", "propertyNode",
      "supplierServiceLocation", "supplier", "statusAsOf", "originalLoa",
      "renewal", "continuity", "legalRule", "evidenceHash",
    ]);
    expect(first).toEqual(replay);
    expect(first).not.toHaveProperty("tenantId");
    expectDeepFrozen(first);
    expect(JSON.stringify({ selected, renewal })).toBe(before);
  }
});

test("Order 288 P2: lower boundary succeeds while upper, gap, overlap and future issue fail closed", async () => {
  const lower = harness();
  expect((await lower.service.resolve(lower.tx, input() as never)).statusAsOf)
    .toBe(RENEWAL_STATUS_DATE);
  for (const defect of [
    row({ renewal_status_as_of: "2048-01-01" }),
    row({ renewal_validity: "[2043-01-02,2048-01-01)" }),
    row({ renewal_validity: "[2042-12-31,2048-01-01)" }),
    row({ form_f2_issue_date: "2043-01-02" }),
  ]) {
    const target = harness(supplierStatus(), [defect]);
    await expect(target.service.resolve(target.tx, input() as never)).rejects
      .toBeInstanceOf(IndiaSezUnitLoaRenewalConflictError);
  }
});

test("Order 288 P3: exact seven-field accessor/proxy/symbol-free input precedes dependency and SQL", async () => {
  const exact = input();
  const hostile: unknown[] = [null, [], new Proxy({ ...exact }, {}),
    Object.assign(Object.create({ inherited: true }), exact), { ...exact, extra: true }];
  for (const key of Object.keys(exact)) {
    const missing = { ...exact } as Mutable;
    delete missing[key];
    hostile.push(missing);
  }
  for (const key of ["tenantId", "propertyNode", "reservationId",
    "supplierServiceLocationId", "supplierSezStatusId", "supplierLoaRenewalId"]) {
    hostile.push({ ...exact, [key]: "not-a-uuid" });
  }
  for (const date of ["", "2043-1-01", "2043-02-29", "2100-02-29",
    "2043-01-01Z", "0000-01-01"]) hostile.push({ ...exact, statusAsOf: date });
  const accessor = { ...exact } as Mutable;
  Object.defineProperty(accessor, "statusAsOf", { enumerable: true, get: () => RENEWAL_STATUS_DATE });
  hostile.push(accessor);
  const symbolic = { ...exact } as Mutable;
  symbolic[Symbol("hidden")] = true;
  hostile.push(symbolic);
  for (const candidate of hostile) {
    const target = harness();
    await expect(target.service.resolve(target.tx, candidate as never)).rejects
      .toBeInstanceOf(IndiaSezUnitLoaRenewalValidationError);
    expect(target.calls).toHaveLength(0);
    expect(target.statements).toHaveLength(0);
  }
});

test("Order 288 P4: complete frozen Order286 Form-G unit root is independently rehashed", async () => {
  const pristine = supplierStatus();
  const hostile: unknown[] = [null, [], structuredClone(pristine),
    new Proxy(structuredClone(pristine), {}), deepFreeze({ ...pristine, extra: true })];
  for (const key of Object.keys(pristine)) {
    const missing = structuredClone(pristine) as Mutable;
    delete missing[key];
    hostile.push(deepFreeze(missing));
  }
  const accessor = structuredClone(pristine) as Mutable;
  Object.defineProperty(accessor, "evidenceHash", { enumerable: true, get: () => pristine.evidenceHash });
  hostile.push(Object.freeze(accessor));
  const symbolic = structuredClone(pristine) as Mutable;
  symbolic[Symbol("hidden")] = true;
  hostile.push(deepFreeze(symbolic));
  for (const root of hostile) {
    const target = harness(root);
    await expect(target.service.resolve(target.tx, input() as never)).rejects
      .toBeInstanceOf(IndiaSezUnitLoaRenewalConflictError);
    expect(target.statements).toHaveLength(0);
  }

  for (const defect of [
    { sezStatus: "affirmatively_non_sez_regular" },
    { sezStatus: "sez_developer" },
    { legalRule: "IGST_ACT_7_5_B" },
    { evidenceHash: "9".repeat(64) },
    { propertyNode: id(28891) },
    { supplierServiceLocation: deepFreeze({ id: id(28892), evidenceHash: "9".repeat(64) }) },
    { supplier: deepFreeze({ registrationId: id(28893), evidenceHash: "e".repeat(64) }) },
    { approval: deepFreeze({ ...pristine.approval as object, form: "sez_rules_form_b" }) },
  ]) {
    const target = harness(deepFreeze({ ...pristine, ...defect }));
    await expect(target.service.resolve(target.tx, input() as never)).rejects
      .toBeInstanceOf(IndiaSezUnitLoaRenewalConflictError);
  }

  const coherentButForbidden: Mutable[] = [];
  const regular = structuredClone(pristine) as Mutable;
  regular.sezStatus = "affirmatively_non_sez_regular";
  (regular.gstRegistration as Mutable).taxpayerType = "regular";
  regular.approval = null;
  rehashSupplierStatus(regular);
  coherentButForbidden.push(regular);
  const developer = structuredClone(pristine) as Mutable;
  developer.sezStatus = "sez_developer";
  (developer.gstRegistration as Mutable).taxpayerType = "sez_developer";
  (developer.approval as Mutable).form = "sez_rules_form_b";
  rehashSupplierStatus(developer);
  coherentButForbidden.push(developer);
  const nonFormG = structuredClone(pristine) as Mutable;
  (nonFormG.approval as Mutable).form = "sez_rules_form_b";
  rehashSupplierStatus(nonFormG);
  coherentButForbidden.push(nonFormG);
  for (const root of coherentButForbidden) {
    const target = harness(deepFreeze(root));
    await expect(target.service.resolve(target.tx, input() as never)).rejects
      .toBeInstanceOf(IndiaSezUnitLoaRenewalConflictError);
  }
});

test("Order 288 P5: exact equality SELECT rejects missing, duplicate, stale and hostile rows", async () => {
  await expect(harness(supplierStatus(), []).service.resolve(fakeTx([]), input() as never))
    .rejects.toBeInstanceOf(IndiaSezUnitLoaRenewalNotFoundError);
  const duplicate = harness(supplierStatus(), [row(), row()]);
  await expect(duplicate.service.resolve(duplicate.tx, input() as never)).rejects
    .toBeInstanceOf(IndiaSezUnitLoaRenewalConflictError);

  const pristine = row();
  const hostile: unknown[] = [{ ...pristine, extra: true }, new Proxy({ ...pristine }, {})];
  for (const key of Object.keys(pristine)) {
    const missing = { ...pristine } as Mutable;
    delete missing[key];
    hostile.push(missing);
  }
  const accessor = { ...pristine } as Mutable;
  Object.defineProperty(accessor, "form_f2_file_number", {
    enumerable: true,
    get: () => pristine.form_f2_file_number,
  });
  hostile.push(accessor);
  const symbolic = { ...pristine } as Mutable;
  symbolic[Symbol("hidden")] = true;
  hostile.push(symbolic);
  for (const candidate of hostile) {
    const target = harness(supplierStatus(), [candidate as RenewalRow]);
    await expect(target.service.resolve(target.tx, input() as never)).rejects
      .toBeInstanceOf(IndiaSezUnitLoaRenewalConflictError);
  }
  const defects: readonly Partial<RenewalRow>[] = [
    { tenant_id: id(28881) }, { id: id(28882) }, { supplier_sez_status_id: id(28883) },
    { original_loa_reference: " LOA/G/288/2038" },
    { original_loa_reference: "LOA/G/288\n2038" },
    { original_loa_issue_date: "2038-02-30" },
    { original_loa_issue_date: "2042-12-16" },
    { original_loa_evidence_sha256: "A".repeat(64) },
    { form_f2_file_number: " F2/DC/288/2042" },
    { form_f2_issue_date: "2042-02-30" },
    { renewal_validity: "(2043-01-01,2048-01-01]" },
    { renewal_validity: "[2043-01-01,)" },
    { renewal_status_as_of: "2043-01-02" },
    { renewal_status: "cancelled" },
    { renewal_status_source: "property_profile" },
    { renewal_status_evidence_sha256: "A".repeat(64) },
    { form_f2_evidence_sha256: "A".repeat(64) },
    { legal_rule: "SEZ_RULES_19_6A_1_FORM_F1" },
  ];
  for (const defect of defects) {
    const target = harness(supplierStatus(), [row(defect)]);
    await expect(target.service.resolve(target.tx, input() as never)).rejects
      .toBeInstanceOf(IndiaSezUnitLoaRenewalConflictError);
  }
});

test("Order 288 P6: dependency and row selection bind every explicit identity with no latest inference", async () => {
  const statements: string[] = [];
  const target = harness(supplierStatus(), [row()], statements);
  await target.service.resolve(target.tx, input() as never);
  expect(target.calls).toEqual([{
    tenantId: TENANT,
    propertyNode: PROPERTY,
    reservationId: RESERVATION,
    supplierServiceLocationId: LOCATION,
    supplierSezStatusId: STATUS,
  }]);
  expect(statements).toHaveLength(1);
  const sql = statements[0]!;
  expect(sql).toContain("public.india_sez_unit_loa_renewal");
  expect(sql).toContain("current_setting('app.tenant_id', true)");
  for (const predicate of ["renewal.tenant_id", "renewal.id",
    "renewal.supplier_sez_status_id", "renewal.renewal_status_as_of"])
    expect(sql).toContain(predicate);
  expect(sql).not.toMatch(/ORDER BY|LIMIT|latest|current_date|now\s*\(/i);
  expect(sql).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|LOCK|FOR\s+UPDATE|FOR\s+SHARE)\b/i);
});

test("Order 288 P7: replay and every rejection preserve caller/root/row bytes", async () => {
  const selected = input();
  const root = supplierStatus();
  const stored = row();
  const before = JSON.stringify({ selected, root, stored });
  const target = harness(root, [stored]);
  await target.service.resolve(target.tx, selected as never);
  await target.service.resolve(target.tx, selected as never);
  const rejected = harness(root, [row({ renewal_status: "cancelled" })]);
  await expect(rejected.service.resolve(rejected.tx, selected as never)).rejects.toThrow();
  expect(JSON.stringify({ selected, root, stored })).toBe(before);
});

test("Order 288 P8: static containment excludes second-chain, Form-F1 and downstream authority", async () => {
  const source = await Bun.file(new URL(
    "../src/contexts/tax-fiscal/india-sez-unit-loa-renewal.ts",
    import.meta.url,
  )).text();
  expect(source).not.toMatch(/form.?f1|authorized.?operations|specified.?officer|BLUT/i);
  expect(source).not.toMatch(/zero.?rat|refund|SEZWP|SEZWOP|SupTyp|IgstOnIntra/i);
  expect(source).not.toMatch(/CGST|SGST|UTGST|tax.?rate|tax.?amount|ItemList|invoice/i);
  expect(source).not.toMatch(/fetch\s*\(|https?:|Elysia|app\.(?:get|post|put|delete)/i);
  expect(source).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|TRUNCATE|journal|posting|tax_detail|document|submission|outbox)\b/i);
  expect(source).not.toMatch(/second|later.?renewal|duration|five.?year.?minimum|Date\.now|new Date/i);
  expect(source).toContain(LEGAL_RULE);
});

const databaseDescribe = process.env.YELLOW_ORDER288_DATABASE_URL
  ? describe.serial
  : describe.skip;

databaseDescribe("Order 288 isolated PostgreSQL schema/RLS/ACL proof", () => {
  test("P9: catalogue is exact and app_role has SELECT but no mutation authority", async () => {
    const { SQL } = await import("bun");
    const deployUrl = process.env.YELLOW_DEPLOY_DATABASE_URL;
    const runtimeUrl = process.env.YELLOW_ORDER288_DATABASE_URL;
    if (!deployUrl || !runtimeUrl) throw new Error("isolated deploy/runtime URLs required");
      const deploy = new SQL(deployUrl, { max: 1 });
      const runtime = new SQL(runtimeUrl, { max: 1 });
    const tenantB = id(28882);
    const renewalB = id(28883);
    try {
      const columns = await deploy<Array<{ column_name: string }>>`
        SELECT column_name FROM information_schema.columns
         WHERE table_schema='public' AND table_name='india_sez_unit_loa_renewal'
         ORDER BY ordinal_position`;
      expect(columns.map((entry) => entry.column_name)).toEqual([
        "tenant_id", "id", "supplier_sez_status_id", "original_loa_reference",
        "original_loa_issue_date", "original_loa_evidence_sha256",
        "form_f2_file_number", "form_f2_issue_date", "renewal_validity",
        "renewal_status_as_of", "renewal_status", "renewal_status_source",
        "renewal_status_evidence_sha256", "form_f2_evidence_sha256", "legal_rule",
      ]);
      const acl = await deploy<Array<{ select_ok: boolean; insert_ok: boolean; update_ok: boolean; delete_ok: boolean; truncate_ok: boolean }>>`
        SELECT has_table_privilege('app_role','public.india_sez_unit_loa_renewal','SELECT') select_ok,
               has_table_privilege('app_role','public.india_sez_unit_loa_renewal','INSERT') insert_ok,
               has_table_privilege('app_role','public.india_sez_unit_loa_renewal','UPDATE') update_ok,
               has_table_privilege('app_role','public.india_sez_unit_loa_renewal','DELETE') delete_ok,
               has_table_privilege('app_role','public.india_sez_unit_loa_renewal','TRUNCATE') truncate_ok`;
      expect(acl[0]).toEqual({
        select_ok: true, insert_ok: false, update_ok: false, delete_ok: false,
        truncate_ok: false,
      });
      const rls = await deploy<Array<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>>`
        SELECT relrowsecurity,relforcerowsecurity FROM pg_class
         WHERE oid='public.india_sez_unit_loa_renewal'::regclass`;
      expect(rls[0]).toEqual({ relrowsecurity: true, relforcerowsecurity: true });
      await deploy`DELETE FROM public.india_sez_unit_loa_renewal
        WHERE id IN (${RENEWAL}::uuid,${renewalB}::uuid)`;
      await deploy`SET session_replication_role = replica`;
      try {
        await deploy`INSERT INTO public.india_sez_unit_loa_renewal(
            tenant_id,id,supplier_sez_status_id,original_loa_reference,
            original_loa_issue_date,original_loa_evidence_sha256,form_f2_file_number,
            form_f2_issue_date,renewal_validity,renewal_status_as_of,renewal_status,
            renewal_status_source,renewal_status_evidence_sha256,
            form_f2_evidence_sha256,legal_rule
          ) VALUES
          (${TENANT}::uuid,${RENEWAL}::uuid,${STATUS}::uuid,${ORIGINAL_REFERENCE},
           ${ORIGINAL_FROM}::date,${ORIGINAL_HASH},'F2/DC/288/A','2042-12-15'::date,
           '[2043-01-01,2048-01-01)'::daterange,'2043-01-01'::date,'in_force',
           'development_commissioner_record',${STATUS_HASH},${F2_HASH},${LEGAL_RULE}),
          (${tenantB}::uuid,${renewalB}::uuid,${id(28884)}::uuid,${ORIGINAL_REFERENCE},
           ${ORIGINAL_FROM}::date,${ORIGINAL_HASH},'F2/DC/288/B','2042-12-15'::date,
           '[2043-01-01,2048-01-01)'::daterange,'2043-01-01'::date,'in_force',
           'development_commissioner_record',${STATUS_HASH},${F2_HASH},${LEGAL_RULE})`;
      } finally {
        await deploy`SET session_replication_role = origin`;
      }
      const before = await deploy<Array<{ row_count: number; digest: string }>>`
        SELECT count(*)::int row_count,
               md5(coalesce(string_agg(row_to_json(renewal)::text, '|' ORDER BY renewal.id), '')) digest
          FROM public.india_sez_unit_loa_renewal renewal
         WHERE renewal.id IN (${RENEWAL}::uuid,${renewalB}::uuid)`;
      await runtime.begin(async (tx) => {
        await tx`SET LOCAL ROLE app_role`;
        await tx`SELECT set_config('app.tenant_id',${TENANT},true)`;
        const visible = await tx<Array<{ id: string }>>`
          SELECT id::text id FROM public.india_sez_unit_loa_renewal ORDER BY id`;
        expect(visible).toEqual([{ id: RENEWAL }]);
      });
      for (const mutate of [
        async (tx: InstanceType<typeof SQL>) => tx`
          INSERT INTO public.india_sez_unit_loa_renewal(
            tenant_id,id,supplier_sez_status_id,original_loa_reference,
            original_loa_issue_date,original_loa_evidence_sha256,form_f2_file_number,
            form_f2_issue_date,renewal_validity,renewal_status_as_of,renewal_status,
            renewal_status_source,renewal_status_evidence_sha256,
            form_f2_evidence_sha256,legal_rule
          ) VALUES (${TENANT}::uuid,${id(28885)}::uuid,${STATUS}::uuid,
            ${ORIGINAL_REFERENCE},${ORIGINAL_FROM}::date,${ORIGINAL_HASH},'F2/DC/288/C',
            '2042-12-15'::date,'[2043-01-01,2048-01-01)'::daterange,
            '2043-01-01'::date,'in_force','development_commissioner_record',
            ${STATUS_HASH},${F2_HASH},${LEGAL_RULE})`,
        async (tx: InstanceType<typeof SQL>) => tx`
          UPDATE public.india_sez_unit_loa_renewal
             SET form_f2_file_number='F2/DC/288/MUTATED'
           WHERE id=${RENEWAL}::uuid`,
        async (tx: InstanceType<typeof SQL>) => tx`
          DELETE FROM public.india_sez_unit_loa_renewal WHERE id=${RENEWAL}::uuid`,
        async (tx: InstanceType<typeof SQL>) => tx`
          TRUNCATE public.india_sez_unit_loa_renewal`,
      ]) {
        let sqlState: unknown;
        try {
          await runtime.begin(async (tx) => {
            await tx.unsafe("SET LOCAL ROLE app_role");
            await tx`SELECT set_config('app.tenant_id',${TENANT},true)`;
            await mutate(tx as InstanceType<typeof SQL>);
          });
        } catch (error) {
          sqlState = (error as { errno?: unknown }).errno;
        }
        expect(sqlState).toBe("42501");
      }
      const after = await deploy<Array<{ row_count: number; digest: string }>>`
        SELECT count(*)::int row_count,
               md5(coalesce(string_agg(row_to_json(renewal)::text, '|' ORDER BY renewal.id), '')) digest
          FROM public.india_sez_unit_loa_renewal renewal
         WHERE renewal.id IN (${RENEWAL}::uuid,${renewalB}::uuid)`;
      expect(after).toEqual(before);
    } finally {
      await deploy`DELETE FROM public.india_sez_unit_loa_renewal
        WHERE id IN (${RENEWAL}::uuid,${renewalB}::uuid)`;
      await Promise.all([deploy.close(), runtime.close()]);
    }
  }, 30_000);
});
