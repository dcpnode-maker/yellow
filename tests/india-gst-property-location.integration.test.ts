import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { SQL } from "bun";

import {
  IndiaGstPropertyLocationConflictError,
  IndiaGstPropertyLocationNotFoundError,
  IndiaGstPropertyLocationService,
  IndiaGstPropertyLocationValidationError,
} from "../src/contexts/tax-fiscal";
import { Database, type Tx } from "../src/kernel";

setDefaultTimeout(60_000);

const DEPLOY_URL = process.env.YELLOW_DEPLOY_DATABASE_URL;
const RUNTIME_URL = process.env.YELLOW_INDIA_GST_PROPERTY_LOCATION_URL ??
  process.env.YELLOW_RUNTIME_DATABASE_URL;
if (process.env.YELLOW_REQUIRE_INDIA_GST_PROPERTY_LOCATION === "1" &&
    (!DEPLOY_URL || !RUNTIME_URL)) {
  throw new Error(
    "Order 280 India property fiscal-location proof requires deploy and runtime database URLs",
  );
}
const databaseDescribe = DEPLOY_URL && RUNTIME_URL ? describe.serial : describe.skip;

const id = (suffix: number): string =>
  `00000000-0000-0000-0000-${String(suffix).padStart(12, "0")}`;

const TENANT_A = id(28001);
const TENANT_B = id(28002);
const PROPERTY_A = id(28011);
const PROPERTY_A_OTHER = id(28012);
const PROPERTY_B = id(28013);
const REGION_A = id(28014);
const EXTENSION_A = id(28021);
const PARTY_A = id(28031);
const PARTY_B = id(28032);
const SUPPLIER_REGISTRATION_A = id(28041);
const RECIPIENT_REGISTRATION_A = id(28042);
const HASH_A = "a".repeat(64);
const VALID_GSTIN_27 = "27AAPFU0939F1ZV";
const VALID_GSTIN_29 = "29AAPFU0939F1ZR";

interface LocationOptions {
  readonly tenantId?: string;
  readonly propertyNode?: string;
  readonly countryCode?: string;
  readonly stateCode?: string;
  readonly addressLine1?: string;
  readonly locality?: string;
  readonly pin?: string;
}

interface LocationRow {
  readonly tenant_id: string;
  readonly property_node: string;
  readonly country_code: string;
  readonly state_code: string;
  readonly address_line1: string;
  readonly locality: string;
  readonly pin: string;
}

type MutableRecord = Record<PropertyKey, unknown>;

let deploy: SQL | undefined;
let database: Database | undefined;

function input(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { tenantId: TENANT_A, propertyNode: PROPERTY_A, ...overrides };
}

function row(overrides: Partial<LocationRow> = {}): LocationRow {
  return {
    tenant_id: TENANT_A,
    property_node: PROPERTY_A,
    country_code: "IN",
    state_code: "27",
    address_line1: "1 Marine Drive",
    locality: "Mumbai",
    pin: "400001",
    ...overrides,
  };
}

function fakeTx(rows: readonly LocationRow[], statements?: string[]): Tx {
  return (async (strings: TemplateStringsArray) => {
    statements?.push(strings.join("?"));
    return rows;
  }) as unknown as Tx;
}

function expectDeepFrozen(value: unknown, seen = new Set<object>()): void {
  if (typeof value !== "object" || value === null || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBeTrue();
  for (const key of Reflect.ownKeys(value)) {
    expectDeepFrozen((value as Record<PropertyKey, unknown>)[key], seen);
  }
}

function expectedEvidenceHash(result: {
  readonly propertyNode: string;
  readonly countryCode: string;
  readonly stateCode: string;
  readonly addressLine1: string;
  readonly locality: string;
  readonly pin: string;
}): string {
  return new Bun.CryptoHasher("sha256").update(JSON.stringify({
    tenantId: TENANT_A,
    propertyNode: result.propertyNode,
    countryCode: result.countryCode,
    stateCode: result.stateCode,
    addressLine1: result.addressLine1,
    locality: result.locality,
    pin: result.pin,
  })).digest("hex");
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

async function seedLocation(options: LocationOptions = {}): Promise<void> {
  await deploy!`INSERT INTO public.property_fiscal_location(
      tenant_id,property_node,country_code,state_code,address_line1,locality,pin
    ) VALUES (
      ${options.tenantId ?? TENANT_A}::uuid,
      ${options.propertyNode ?? PROPERTY_A}::uuid,
      ${options.countryCode ?? "IN"},${options.stateCode ?? "27"},
      ${options.addressLine1 ?? "1 Marine Drive"},
      ${options.locality ?? "Mumbai"},${options.pin ?? "400001"}
    )`;
}

async function clearLocations(): Promise<void> {
  await deploy!`DELETE FROM public.property_fiscal_location
    WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
}

async function resolveLocation(
  target = input(),
  transactionTenant = (target.tenantId as string | undefined) ?? TENANT_A,
) {
  const service = new IndiaGstPropertyLocationService();
  return database!.withTenantTransaction(transactionTenant, (tx) =>
    service.resolve(tx, target as never));
}

async function effects(): Promise<Record<string, number | string>> {
  const rows = await deploy!<Array<Record<string, number | string>>>`SELECT
    (SELECT count(*)::int FROM property_fiscal_location
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) locations,
    (SELECT COALESCE(md5(string_agg(subject::text,'|' ORDER BY property_node)),md5(''))
       FROM property_fiscal_location subject
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) location_digest,
    (SELECT COALESCE(md5(string_agg(subject::text,'|' ORDER BY id)),md5(''))
       FROM org_node subject
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) org_digest,
    (SELECT COALESCE(md5(string_agg(subject::text,'|' ORDER BY id)),md5(''))
       FROM property_fiscal_registration subject
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) supplier_digest,
    (SELECT COALESCE(md5(string_agg(subject::text,'|' ORDER BY id)),md5(''))
       FROM party_fiscal_registration subject
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) recipient_digest,
    (SELECT count(*)::int FROM tax_attribution_snapshot
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) attribution_snapshots,
    (SELECT count(*)::int FROM tax_attribution_hold_binding
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) hold_bindings,
    (SELECT count(*)::int FROM tax_attribution_reservation_binding
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) reservation_bindings,
    (SELECT count(*)::int FROM tax_attribution_journal_binding
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) journal_bindings,
    (SELECT count(*)::int FROM fact_log
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) facts,
    (SELECT count(*)::int FROM outbox
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) events,
    (SELECT count(*)::int FROM document
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) documents,
    (SELECT count(*)::int FROM journal
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) journals,
    (SELECT count(*)::int FROM posting_line
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) postings,
    (SELECT count(*)::int FROM fiscal_submission
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) submissions`;
  return rows[0]!;
}

async function cleanup(): Promise<void> {
  if (!deploy) return;
  await clearLocations();
  await deploy`DELETE FROM property_fiscal_registration
    WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM party_fiscal_registration
    WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM extension WHERE id=${EXTENSION_A}::uuid`;
  await deploy`DELETE FROM party
    WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM org_node
    WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM tenant WHERE id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
}

test("Order 280 P0: exact migration and bounded-context resolver exist", async () => {
  expect(typeof IndiaGstPropertyLocationService).toBe("function");
  const sql = await Bun.file(
    new URL("../migrations/0049_property_fiscal_location.sql", import.meta.url),
  ).text();
  expect(sql).toContain("CREATE TABLE public.property_fiscal_location");
  expect(sql).toContain("FOREIGN KEY (tenant_id, property_node)");
  expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
  expect(sql).toContain("FORCE ROW LEVEL SECURITY");
  expect(sql).toContain(
    "GRANT SELECT ON TABLE public.property_fiscal_location TO app_role",
  );
});

test("Order 280 P0: exact input produces exact frozen deterministic SELECT-only evidence", async () => {
  const statements: string[] = [];
  const service = new IndiaGstPropertyLocationService();
  const first = await service.resolve(fakeTx([row()], statements), input() as never);
  const second = await service.resolve(fakeTx([row()]), input() as never);

  expect(first).toEqual(second);
  expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  expect(first).toEqual({
    propertyNode: PROPERTY_A,
    countryCode: "IN",
    stateCode: "27",
    addressLine1: "1 Marine Drive",
    locality: "Mumbai",
    pin: "400001",
    evidenceHash: first.evidenceHash,
  });
  expect(Object.keys(first)).toEqual([
    "propertyNode", "countryCode", "stateCode", "addressLine1", "locality",
    "pin", "evidenceHash",
  ]);
  expect(first.evidenceHash).toBe(expectedEvidenceHash(first));
  expect(first).not.toHaveProperty("tenantId");
  expectDeepFrozen(first);
  expect(statements).toHaveLength(1);
  expect(statements[0]).toContain("public.property_fiscal_location");
  expect(statements[0]).toContain("public.org_node");
  expect(statements[0]).toContain("current_setting('app.tenant_id', true)");
  expect(statements[0]).toMatch(/property\.kind\s*=\s*'property'/i);
  expect(statements[0]).not.toMatch(
    /property_fiscal_registration|party_fiscal_registration|profile_key|public\.space|unit_type|tx_code|GST_ROOM/i,
  );
  expect(statements[0]).not.toMatch(/property\.(?:name|config|path)/i);
  expect(statements[0]).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|FOR\s+UPDATE|FOR\s+SHARE|pg_advisory)\b/i);
});

test("Order 280 P0: only the exact accessor/proxy/symbol-free two-UUID input reaches SQL", async () => {
  const service = new IndiaGstPropertyLocationService();
  const cases: unknown[] = [
    null,
    [],
    Object.assign(Object.create({}), input()),
    { tenantId: TENANT_A },
    input({ extra: true }),
    input({ tenantId: "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA" }),
    input({ propertyNode: "not-a-uuid" }),
    new Proxy(input(), {}),
  ];
  const accessor = input();
  Object.defineProperty(accessor, "propertyNode", {
    enumerable: true,
    get: () => PROPERTY_A,
  });
  cases.push(accessor);
  const symbolic = input();
  Object.defineProperty(symbolic, Symbol("hostile"), { value: true });
  cases.push(symbolic);

  for (const hostile of cases) {
    let calls = 0;
    const tx = (() => {
      calls += 1;
      return Promise.resolve([]);
    }) as unknown as Tx;
    await expect(service.resolve(tx, hostile as never)).rejects
      .toBeInstanceOf(IndiaGstPropertyLocationValidationError);
    expect(calls).toBe(0);
  }
  await expect(service.resolve(undefined as unknown as Tx, input() as never)).rejects
    .toBeInstanceOf(IndiaGstPropertyLocationValidationError);
});

test("Order 280 P0: missing, duplicate, malformed and hostile stored truth fail closed", async () => {
  const service = new IndiaGstPropertyLocationService();
  await expect(service.resolve(fakeTx([]), input() as never)).rejects
    .toBeInstanceOf(IndiaGstPropertyLocationNotFoundError);
  await expect(service.resolve(fakeTx([row(), row()]), input() as never)).rejects
    .toBeInstanceOf(IndiaGstPropertyLocationConflictError);

  const defects: readonly Partial<LocationRow>[] = [
    { tenant_id: TENANT_B },
    { property_node: PROPERTY_A_OTHER },
    { country_code: "in" },
    { state_code: "39" },
    { address_line1: " Leading" },
    { address_line1: "1 Marine Drive\n" },
    { locality: "Cafe\u0301" },
    { locality: "x".repeat(51) },
    { pin: "000001" },
    { pin: "40001" },
  ];
  for (const defect of defects) {
    await expect(service.resolve(fakeTx([row(defect)]), input() as never)).rejects
      .toBeInstanceOf(IndiaGstPropertyLocationConflictError);
  }

  const missing = { ...row() } as MutableRecord;
  delete missing.locality;
  const surplus = { ...row(), supplier_state: "29" } as MutableRecord;
  const accessor = { ...row() } as MutableRecord;
  Object.defineProperty(accessor, "pin", { enumerable: true, get: () => "400001" });
  const symbolic = { ...row() } as MutableRecord;
  symbolic[Symbol("hostile")] = true;
  const proxy = new Proxy({ ...row() }, {});
  for (const hostile of [missing, surplus, accessor, symbolic, proxy]) {
    await expect(service.resolve(
      fakeTx([hostile as unknown as LocationRow]),
      input() as never,
    )).rejects.toBeInstanceOf(IndiaGstPropertyLocationConflictError);
  }
});

databaseDescribe("Order 280 exact read-only India property fiscal-location evidence", () => {
  beforeAll(async () => {
    deploy = new SQL(DEPLOY_URL!, { max: 16, prepare: false });
    database = Database.connect(RUNTIME_URL!, { maxConnections: 16, prepare: false });
    await cleanup();
    await deploy`INSERT INTO tenant(id,slug,name,tier,status) VALUES
      (${TENANT_A}::uuid,'order280-a','Order 280 A','shared','active'),
      (${TENANT_B}::uuid,'order280-b','Order 280 B','shared','active')`;
    await deploy`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency,config) VALUES
      (${PROPERTY_A}::uuid,${TENANT_A}::uuid,'order280a.property'::ltree,'property',
        'Misleading Maharashtra Property','Asia/Kolkata','INR',
        '{"country":"IN","state":"29","address":"Wrong","pin":"560001"}'::jsonb),
      (${PROPERTY_A_OTHER}::uuid,${TENANT_A}::uuid,'order280a.other'::ltree,'property',
        'Order 280 Other','Asia/Kolkata','INR','{}'::jsonb),
      (${REGION_A}::uuid,${TENANT_A}::uuid,'order280a.region'::ltree,'region',
        'Order 280 Region',NULL,NULL,'{"state":"27"}'::jsonb),
      (${PROPERTY_B}::uuid,${TENANT_B}::uuid,'order280b.property'::ltree,'property',
        'Order 280 Foreign','Asia/Kolkata','INR','{}'::jsonb)`;
    await deploy`INSERT INTO extension(id,tenant_id,type,key,version,effective,content,status) VALUES
      (${EXTENSION_A}::uuid,${TENANT_A}::uuid,'tax_jurisdiction','in.order280.gst',1,
       '[2030-01-01 00:00:00+00,)'::tstzrange,
       '{"country":"IN","price_display":"tax_exclusive","rounding":"line","taxes":[]}'::jsonb,
       'active')`;
    await deploy`INSERT INTO party(id,tenant_id,kind,display_name,legal_name,status) VALUES
      (${PARTY_A}::uuid,${TENANT_A}::uuid,'org','Order 280 Buyer','Mutable Buyer','active'),
      (${PARTY_B}::uuid,${TENANT_B}::uuid,'org','Order 280 Foreign','Mutable Foreign','active')`;
    await deploy`INSERT INTO property_fiscal_registration(
      tenant_id,id,property_node,scheme,currency,jurisdiction_extension_id,
      jurisdiction_owner_tenant_id,jurisdiction_key,jurisdiction_version,
      jurisdiction_content_hash,registration_number,region_code,legal_name,
      trade_name,address_line,locality,postal_code
    ) VALUES (
      ${TENANT_A}::uuid,${SUPPLIER_REGISTRATION_A}::uuid,${PROPERTY_A}::uuid,
      'in-gstin','INR',${EXTENSION_A}::uuid,${TENANT_A}::uuid,'in.order280.gst',1,
      ${HASH_A},${VALID_GSTIN_27},'27','Order 280 Supplier','Order 280 Hotel',
      'Supplier address','Mumbai','400001'
    )`;
    await deploy`INSERT INTO party_fiscal_registration(
      tenant_id,id,party_id,scheme,registration_number,region_code,legal_name,
      trade_name,address_line1,locality,pin
    ) VALUES (
      ${TENANT_A}::uuid,${RECIPIENT_REGISTRATION_A}::uuid,${PARTY_A}::uuid,
      'in-gstin',${VALID_GSTIN_27},'27','Order 280 Buyer','Order 280 Buyer',
      'Recipient address','Mumbai','400001'
    )`;
  });

  afterAll(async () => {
    await cleanup();
    await database?.close();
    await deploy?.close({ timeout: 0 });
  });

  test("P1: schema is forced-RLS, exact-property keyed and SELECT-only", async () => {
    const relation = await deploy!<Array<{
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
    }>>`SELECT relrowsecurity,relforcerowsecurity
      FROM pg_class WHERE oid='public.property_fiscal_location'::regclass`;
    expect(relation).toEqual([{ relrowsecurity: true, relforcerowsecurity: true }]);

    const keys = await deploy!<Array<{ type: string; definition: string }>>`
      SELECT contype::text type,pg_get_constraintdef(oid) definition
      FROM pg_constraint
      WHERE conrelid='public.property_fiscal_location'::regclass`;
    expect(keys.some(({ type, definition }) =>
      type === "p" && /PRIMARY KEY \(tenant_id, property_node\)/i.test(definition)
    )).toBeTrue();
    expect(keys.some(({ type, definition }) =>
      type === "f" && /FOREIGN KEY \(tenant_id, property_node\) REFERENCES org_node\(tenant_id, id\)/i.test(definition)
    )).toBeTrue();

    const grants = await deploy!<Array<{
      can_select: boolean;
      can_insert: boolean;
      can_update: boolean;
      can_delete: boolean;
    }>>`SELECT
      has_table_privilege('app_role','public.property_fiscal_location','SELECT') can_select,
      has_table_privilege('app_role','public.property_fiscal_location','INSERT') can_insert,
      has_table_privilege('app_role','public.property_fiscal_location','UPDATE') can_update,
      has_table_privilege('app_role','public.property_fiscal_location','DELETE') can_delete`;
    expect(grants[0]).toEqual({
      can_select: true,
      can_insert: false,
      can_update: false,
      can_delete: false,
    });
  });

  test("P2: exact location resolves byte-identical deeply frozen evidence", async () => {
    await clearLocations();
    await seedLocation();
    const first = await resolveLocation();
    const second = await resolveLocation();
    expect(first).toEqual(second);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first).toEqual({
      propertyNode: PROPERTY_A,
      countryCode: "IN",
      stateCode: "27",
      addressLine1: "1 Marine Drive",
      locality: "Mumbai",
      pin: "400001",
      evidenceHash: first.evidenceHash,
    });
    expect(first.evidenceHash).toBe(expectedEvidenceHash(first));
    expectDeepFrozen(first);
  });

  test("P3: exact tenant/property and property kind fail closed without fallback", async () => {
    await clearLocations();
    await expect(resolveLocation()).rejects
      .toBeInstanceOf(IndiaGstPropertyLocationNotFoundError);

    await seedLocation({ propertyNode: PROPERTY_A_OTHER, stateCode: "29",
      addressLine1: "1 Residency Road", locality: "Bengaluru", pin: "560001" });
    await expect(resolveLocation()).rejects
      .toBeInstanceOf(IndiaGstPropertyLocationNotFoundError);
    await expect(resolveLocation(input({ propertyNode: PROPERTY_A_OTHER }))).resolves
      .toMatchObject({ propertyNode: PROPERTY_A_OTHER, stateCode: "29" });

    await clearLocations();
    await seedLocation({ tenantId: TENANT_B, propertyNode: PROPERTY_B, stateCode: "29",
      addressLine1: "1 Residency Road", locality: "Bengaluru", pin: "560001" });
    await expect(resolveLocation(input({ tenantId: TENANT_B, propertyNode: PROPERTY_B }), TENANT_A))
      .rejects.toBeInstanceOf(IndiaGstPropertyLocationNotFoundError);
    await expect(resolveLocation(input({ propertyNode: PROPERTY_B }))).rejects
      .toBeInstanceOf(IndiaGstPropertyLocationNotFoundError);

    await clearLocations();
    await seedLocation({ propertyNode: REGION_A });
    await expect(resolveLocation(input({ propertyNode: REGION_A }))).rejects
      .toBeInstanceOf(IndiaGstPropertyLocationNotFoundError);
  });

  test("P4: RLS hides foreign rows and runtime INSERT/UPDATE/DELETE stay denied", async () => {
    await clearLocations();
    await seedLocation();
    await seedLocation({ tenantId: TENANT_B, propertyNode: PROPERTY_B, stateCode: "29",
      addressLine1: "1 Residency Road", locality: "Bengaluru", pin: "560001" });
    const visible = await database!.withTenantTransaction(TENANT_A, (tx) =>
      tx<Array<{ property_node: string }>>`
        SELECT property_node::text FROM property_fiscal_location ORDER BY property_node`
    );
    expect(visible).toEqual([{ property_node: PROPERTY_A }]);

    await expectSqlState(database!.withTenantTransaction(TENANT_A, (tx) =>
      tx`INSERT INTO property_fiscal_location(
        tenant_id,property_node,country_code,state_code,address_line1,locality,pin
      ) VALUES (
        ${TENANT_A}::uuid,${PROPERTY_A_OTHER}::uuid,'IN','27','Denied','Mumbai','400001'
      )`
    ), "42501");
    await expectSqlState(database!.withTenantTransaction(TENANT_A, (tx) =>
      tx`UPDATE property_fiscal_location SET locality='Denied'
        WHERE tenant_id=${TENANT_A}::uuid AND property_node=${PROPERTY_A}::uuid`
    ), "42501");
    await expectSqlState(database!.withTenantTransaction(TENANT_A, (tx) =>
      tx`DELETE FROM property_fiscal_location
        WHERE tenant_id=${TENANT_A}::uuid AND property_node=${PROPERTY_A}::uuid`
    ), "42501");
  });

  test("P5: exact constraints reject foreign, noncurrent and noncanonical evidence", async () => {
    await clearLocations();
    const rejected: readonly LocationOptions[] = [
      { countryCode: "CA" },
      { stateCode: "00" },
      { stateCode: "25" },
      { stateCode: "28" },
      { stateCode: "39" },
      { addressLine1: "" },
      { addressLine1: " leading" },
      { addressLine1: "x".repeat(101) },
      { locality: "" },
      { locality: "x".repeat(51) },
      { pin: "000001" },
      { pin: "40001" },
    ];
    for (const defect of rejected) {
      await expectSqlState(seedLocation(defect), "23514");
    }
    await expectSqlState(seedLocation({ propertyNode: PROPERTY_B }), "23503");

    await seedLocation({ locality: "Cafe\u0301" });
    await expect(resolveLocation()).rejects
      .toBeInstanceOf(IndiaGstPropertyLocationConflictError);
  });

  test("P6: supplier, recipient and mutable org truth never alter location evidence", async () => {
    await clearLocations();
    await seedLocation();
    const before = await resolveLocation();

    await deploy!`UPDATE org_node SET
      path='order280a.changed'::ltree,name='Changed display',
      config='{"country":"CA","state":"29","address":"Changed","pin":"560001"}'::jsonb,
      timezone='America/Toronto',currency='CAD'
      WHERE tenant_id=${TENANT_A}::uuid AND id=${PROPERTY_A}::uuid`;
    await deploy!`UPDATE property_fiscal_registration SET
      registration_number=${VALID_GSTIN_29},region_code='29',
      address_line='Changed supplier address',locality='Bengaluru',postal_code='560001'
      WHERE tenant_id=${TENANT_A}::uuid AND id=${SUPPLIER_REGISTRATION_A}::uuid`;
    await deploy!`UPDATE party_fiscal_registration SET
      registration_number='29ABCDE1234F1Z5',region_code='29',
      address_line1='Changed recipient address',locality='Bengaluru',pin='560001'
      WHERE tenant_id=${TENANT_A}::uuid AND id=${RECIPIENT_REGISTRATION_A}::uuid`;

    const after = await resolveLocation();
    expect(after).toEqual(before);
    expect(after.evidenceHash).toBe(before.evidenceHash);
  });

  test("P7: happy, replay and failed reads leave every source/effect byte and count unchanged", async () => {
    await clearLocations();
    await seedLocation();
    const before = await effects();
    await resolveLocation();
    await resolveLocation();
    await expect(resolveLocation(input({ propertyNode: PROPERTY_A_OTHER }))).rejects.toThrow();
    await expect(resolveLocation(input({ tenantId: TENANT_B }), TENANT_A)).rejects.toThrow();
    expect(await effects()).toEqual(before);
  });
});
