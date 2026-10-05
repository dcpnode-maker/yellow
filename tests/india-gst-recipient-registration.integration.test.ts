import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { SQL } from "bun";

import {
  IndiaGstRecipientRegistrationConflictError,
  IndiaGstRecipientRegistrationNotFoundError,
  IndiaGstRecipientRegistrationService,
  IndiaGstRecipientRegistrationValidationError,
} from "../src/contexts/tax-fiscal";
import { Database, type Tx } from "../src/kernel";

setDefaultTimeout(60_000);

const DEPLOY_URL = process.env.YELLOW_DEPLOY_DATABASE_URL;
const RUNTIME_URL = process.env.YELLOW_INDIA_GST_RECIPIENT_REGISTRATION_URL ??
  process.env.YELLOW_RUNTIME_DATABASE_URL;
if (process.env.YELLOW_REQUIRE_INDIA_GST_RECIPIENT_REGISTRATION === "1" &&
    (!DEPLOY_URL || !RUNTIME_URL)) {
  throw new Error(
    "Order 276 GST recipient-registration proof requires deploy and runtime database URLs",
  );
}
const databaseDescribe = DEPLOY_URL && RUNTIME_URL ? describe.serial : describe.skip;

const id = (suffix: number): string =>
  `00000000-0000-0000-0000-${String(suffix).padStart(12, "0")}`;

const TENANT_A = id(27601);
const TENANT_B = id(27602);
const PARTY_A = id(27611);
const PARTY_A_OTHER = id(27612);
const PARTY_MERGED = id(27613);
const PARTY_ANONYMISED = id(27614);
const PARTY_B = id(27615);
const REGISTRATION_A = id(27621);
const REGISTRATION_A_OTHER = id(27622);
const REGISTRATION_B = id(27623);
const ROLE_A = "company";
const VALID_GSTIN_A = "27AAPFU0939F1ZV";
const VALID_GSTIN_B = "29ABCDE1234F1Z5";

interface RegistrationOptions {
  readonly tenantId?: string;
  readonly id?: string;
  readonly partyId?: string;
  readonly scheme?: string;
  readonly registrationNumber?: string;
  readonly regionCode?: string;
  readonly legalName?: string;
  readonly tradeName?: string | null;
  readonly addressLine1?: string;
  readonly locality?: string;
  readonly pin?: string;
}

interface RecipientRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly party_id: string;
  readonly scheme: string;
  readonly registration_number: string;
  readonly region_code: string;
  readonly legal_name: string;
  readonly trade_name: string | null;
  readonly address_line1: string;
  readonly locality: string;
  readonly pin: string;
}

let deploy: SQL | undefined;
let database: Database | undefined;

function input(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    tenantId: TENANT_A,
    recipientPartyId: PARTY_A,
    registrationId: REGISTRATION_A,
    ...overrides,
  };
}

function row(overrides: Partial<RecipientRow> = {}): RecipientRow {
  return {
    id: REGISTRATION_A,
    tenant_id: TENANT_A,
    party_id: PARTY_A,
    scheme: "in-gstin",
    registration_number: VALID_GSTIN_A,
    region_code: "27",
    legal_name: "Order 276 Guest Private Limited",
    trade_name: "Order 276 Guest",
    address_line1: "1 Marine Drive",
    locality: "Mumbai",
    pin: "400001",
    ...overrides,
  };
}

function fakeTx(rows: readonly RecipientRow[], statements?: string[]): Tx {
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
  readonly registrationId: string;
  readonly partyId: string;
  readonly scheme: string;
  readonly gstin: string;
  readonly stateCode: string;
  readonly legalName: string;
  readonly tradeName: string | null;
  readonly addressLine1: string;
  readonly locality: string;
  readonly pin: string;
}): string {
  return new Bun.CryptoHasher("sha256").update(JSON.stringify({
    registrationId: result.registrationId,
    tenantId: TENANT_A,
    partyId: result.partyId,
    scheme: result.scheme,
    gstin: result.gstin,
    stateCode: result.stateCode,
    legalName: result.legalName,
    tradeName: result.tradeName,
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

async function seedRegistration(options: RegistrationOptions = {}): Promise<string> {
  const registrationId = options.id ?? crypto.randomUUID();
  await deploy!`INSERT INTO public.party_fiscal_registration(
      tenant_id,id,party_id,scheme,registration_number,region_code,legal_name,
      trade_name,address_line1,locality,pin
    ) VALUES (
      ${options.tenantId ?? TENANT_A}::uuid,${registrationId}::uuid,
      ${options.partyId ?? PARTY_A}::uuid,${options.scheme ?? "in-gstin"},
      ${options.registrationNumber ?? VALID_GSTIN_A},${options.regionCode ?? "27"},
      ${options.legalName ?? "Order 276 Guest Private Limited"},
      ${options.tradeName === undefined ? "Order 276 Guest" : options.tradeName},
      ${options.addressLine1 ?? "1 Marine Drive"},${options.locality ?? "Mumbai"},
      ${options.pin ?? "400001"}
    )`;
  return registrationId;
}

async function clearRegistrations(): Promise<void> {
  await deploy!`DELETE FROM public.party_fiscal_registration
    WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
}

async function effectCounts(): Promise<Record<string, number | string>> {
  const rows = await deploy!<Array<Record<string, number | string>>>`SELECT
    (SELECT count(*)::int FROM party_fiscal_registration
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) registrations,
    (SELECT COALESCE(md5(string_agg(registration::text, '|' ORDER BY id)), md5(''))
       FROM party_fiscal_registration AS registration
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) registration_digest,
    (SELECT COALESCE(md5(string_agg(subject::text, '|' ORDER BY id)), md5(''))
       FROM party AS subject
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) party_digest,
    (SELECT count(*)::int FROM journal
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) journals,
    (SELECT count(*)::int FROM posting_line
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) postings,
    (SELECT count(*)::int FROM document
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) documents,
    (SELECT count(*)::int FROM fiscal_submission
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) submissions,
    (SELECT count(*)::int FROM outbox
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) events,
    (SELECT count(*)::int FROM api_idempotency
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) idempotency`;
  return rows[0]!;
}

async function resolveRegistration(
  target = input(),
  method: "discover" | "resolve" = "resolve",
  transactionTenant = TENANT_A,
) {
  const service = new IndiaGstRecipientRegistrationService();
  return database!.withTenantTransaction(
    transactionTenant,
    (tx) => service[method](tx, target as never),
  );
}

async function cleanup(): Promise<void> {
  if (!deploy) return;
  await clearRegistrations();
  await deploy`DELETE FROM address
    WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM party_role
    WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM party
    WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM tenant
    WHERE id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
}

test("Order 276 P0: exact migration and bounded-context resolver exist", async () => {
  expect(typeof IndiaGstRecipientRegistrationService).toBe("function");
  const sql = await Bun.file(
    new URL("../migrations/0048_party_fiscal_registration.sql", import.meta.url),
  ).text();
  expect(sql).toContain("CREATE TABLE public.party_fiscal_registration");
  expect(sql).toContain("FOREIGN KEY (tenant_id, party_id)");
  expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
  expect(sql).toContain(
    "GRANT SELECT ON TABLE public.party_fiscal_registration TO app_role",
  );
});

test("Order 276 P0: exact input, exact output, replay, freeze and SELECT-only SQL", async () => {
  const statements: string[] = [];
  const service = new IndiaGstRecipientRegistrationService();
  const exactInput = input();
  const first = await service.resolve(fakeTx([row()], statements), exactInput as never);
  const second = await service.resolve(fakeTx([row()]), exactInput as never);

  expect(first).toEqual(second);
  expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  expect(first).toEqual({
    registrationId: REGISTRATION_A,
    partyId: PARTY_A,
    scheme: "in-gstin",
    gstin: VALID_GSTIN_A,
    stateCode: "27",
    legalName: "Order 276 Guest Private Limited",
    tradeName: "Order 276 Guest",
    addressLine1: "1 Marine Drive",
    locality: "Mumbai",
    pin: "400001",
    evidenceHash: first.evidenceHash,
  });
  expect(Object.keys(first)).toEqual([
    "registrationId", "partyId", "scheme", "gstin", "stateCode", "legalName",
    "tradeName", "addressLine1", "locality", "pin", "evidenceHash",
  ]);
  expect(first.evidenceHash).toBe(expectedEvidenceHash(first));
  expectDeepFrozen(first);
  expect(statements).toHaveLength(1);
  expect(statements[0]).toContain("public.party_fiscal_registration");
  expect(statements[0]).toContain("public.party");
  expect(statements[0]).toMatch(/party\.status\s*=\s*'active'/i);
  expect(statements[0]).toMatch(/party\.merged_into\s+IS\s+NULL/i);
  expect(statements[0]).not.toMatch(/party\.(?:display_name|legal_name|attrs|vip_code)/i);
  expect(statements[0]).not.toMatch(/party_role|contact_point|public\.address|reservation|folio|account/i);
  expect(statements[0]).not.toMatch(/\b(?:INSERT|UPDATE|DELETE)\b/i);
});

test("Order 276 P0: only the exact plain canonical input reaches SQL", async () => {
  const service = new IndiaGstRecipientRegistrationService();
  const cases: unknown[] = [
    null,
    [],
    Object.assign(Object.create({}), input()),
    { tenantId: TENANT_A, recipientPartyId: PARTY_A },
    input({ extra: true }),
    input({ tenantId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa".toUpperCase() }),
    input({ recipientPartyId: "not-a-uuid" }),
    input({ registrationId: "00000000-0000-0000-0000-00000000000A" }),
  ];
  const accessor = input();
  Object.defineProperty(accessor, "registrationId", {
    enumerable: true,
    get: () => REGISTRATION_A,
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
      .toBeInstanceOf(IndiaGstRecipientRegistrationValidationError);
    expect(calls).toBe(0);
  }
});

test("Order 276 P0: malformed stored evidence fails closed without normalization", async () => {
  const service = new IndiaGstRecipientRegistrationService();
  const defects: readonly Partial<RecipientRow>[] = [
    { registration_number: "27AAPFU0939F1ZA" },
    { registration_number: VALID_GSTIN_B, region_code: "27" },
    { registration_number: "39AAPFU0939F1ZQ", region_code: "39" },
    { registration_number: "96AAPFU0939F1ZQ", region_code: "96" },
    { legal_name: " Leading" },
    { legal_name: "x".repeat(101) },
    { trade_name: "" },
    { trade_name: "x".repeat(101) },
    { address_line1: "x".repeat(101) },
    { locality: "x".repeat(51) },
    { locality: "Cafe\u0301" },
    { pin: "000001" },
    { pin: "40001" },
  ];
  for (const defect of defects) {
    await expect(service.resolve(fakeTx([row(defect)]), input() as never)).rejects
      .toBeInstanceOf(IndiaGstRecipientRegistrationConflictError);
  }

  const nullTrade = await service.resolve(
    fakeTx([row({ trade_name: null })]),
    input() as never,
  );
  expect(nullTrade.tradeName).toBeNull();
  expectDeepFrozen(nullTrade);
});

test("Order 276 P0: missing, duplicate and mismatched exact rows never fall back", async () => {
  const service = new IndiaGstRecipientRegistrationService();
  await expect(service.resolve(fakeTx([]), input() as never)).rejects
    .toBeInstanceOf(IndiaGstRecipientRegistrationNotFoundError);
  await expect(service.resolve(
    fakeTx([row(), row({ id: REGISTRATION_A_OTHER })]),
    input() as never,
  )).rejects.toBeInstanceOf(IndiaGstRecipientRegistrationConflictError);
  for (const mismatch of [
    { tenant_id: TENANT_B },
    { party_id: PARTY_A_OTHER },
    { id: REGISTRATION_A_OTHER },
    { scheme: "gstin" },
  ] as const) {
    await expect(service.resolve(fakeTx([row(mismatch)]), input() as never)).rejects
      .toBeInstanceOf(IndiaGstRecipientRegistrationConflictError);
  }
});

databaseDescribe("Order 276 exact India GST recipient-registration evidence", () => {
  beforeAll(async () => {
    deploy = new SQL(DEPLOY_URL!, { max: 16, prepare: false });
    database = Database.connect(RUNTIME_URL!, { maxConnections: 16, prepare: false });
    await cleanup();
    await deploy`INSERT INTO tenant(id,slug,name,tier,status) VALUES
      (${TENANT_A}::uuid,'order276-a','Order 276 A','shared','active'),
      (${TENANT_B}::uuid,'order276-b','Order 276 B','shared','active')`;
    await deploy`INSERT INTO party(
      id,tenant_id,kind,display_name,legal_name,attrs,vip_code,status,merged_into
    ) VALUES
      (${PARTY_A}::uuid,${TENANT_A}::uuid,'org','Mutable A','Mutable A Legal',
        '{"gstin":"FAKE","state":"99"}'::jsonb,'VIP','active',NULL),
      (${PARTY_A_OTHER}::uuid,${TENANT_A}::uuid,'org','Mutable Other','Other Legal',
        '{"gstin":"27AAPFU0939F1ZV"}'::jsonb,NULL,'active',NULL),
      (${PARTY_MERGED}::uuid,${TENANT_A}::uuid,'org','Merged','Merged Legal',
        '{}'::jsonb,NULL,'merged',${PARTY_A}::uuid),
      (${PARTY_ANONYMISED}::uuid,${TENANT_A}::uuid,'org','Anonymised','Anonymised',
        '{}'::jsonb,NULL,'anonymised',NULL),
      (${PARTY_B}::uuid,${TENANT_B}::uuid,'org','Foreign','Foreign Legal',
        '{}'::jsonb,NULL,'active',NULL)`;
    await deploy`INSERT INTO party_role(tenant_id,party_id,role,detail) VALUES
      (${TENANT_A}::uuid,${PARTY_A}::uuid,${ROLE_A},'{"gstin":"FAKE-ROLE"}'::jsonb)`;
    await deploy`INSERT INTO address(
      tenant_id,party_id,kind,lines,city,region,postal_code,country
    ) VALUES (
      ${TENANT_A}::uuid,${PARTY_A}::uuid,'registered',ARRAY['Mutable address'],
      'Mutable city','99','999999','IN'
    )`;
  });

  afterAll(async () => {
    await cleanup();
    await database?.close();
    await deploy?.close({ timeout: 0 });
  });

  test("P1: schema is exactly migration48/100 tables/90 policies with composite Party tenancy", async () => {
    const counts = await deploy!<Array<{
      migrations: number;
      tables: number;
      policies: number;
    }>>`SELECT
      (SELECT count(*)::int FROM schema_migration) migrations,
      (SELECT count(*)::int FROM pg_tables WHERE schemaname='public') tables,
      (SELECT count(*)::int FROM pg_policies WHERE schemaname='public') policies`;
    expect(counts[0]).toEqual({ migrations: 48, tables: 100, policies: 90 });

    const table = await deploy!<Array<{ relrowsecurity: boolean }>>`
      SELECT relrowsecurity
        FROM pg_class
       WHERE oid='public.party_fiscal_registration'::regclass`;
    expect(table).toEqual([{ relrowsecurity: true }]);

    const foreignKeys = await deploy!<Array<{ definition: string }>>`
      SELECT pg_get_constraintdef(oid) definition
        FROM pg_constraint
       WHERE conrelid='public.party_fiscal_registration'::regclass
         AND contype='f'`;
    expect(foreignKeys.some(({ definition }) =>
      /FOREIGN KEY \(tenant_id, party_id\) REFERENCES party\(tenant_id, id\)/i.test(definition)
    )).toBeTrue();

    const indexes = await deploy!<Array<{ indexdef: string }>>`
      SELECT indexdef FROM pg_indexes
       WHERE schemaname='public' AND tablename='party_fiscal_registration'`;
    expect(indexes.length).toBeGreaterThanOrEqual(2);
    expect(indexes.every(({ indexdef }) =>
      /ON public\.party_fiscal_registration USING btree \(tenant_id,/i.test(indexdef)
    )).toBeTrue();

    const grants = await deploy!<Array<{
      can_select: boolean;
      can_insert: boolean;
      can_update: boolean;
      can_delete: boolean;
    }>>`SELECT
      has_table_privilege('app_role','public.party_fiscal_registration','SELECT') can_select,
      has_table_privilege('app_role','public.party_fiscal_registration','INSERT') can_insert,
      has_table_privilege('app_role','public.party_fiscal_registration','UPDATE') can_update,
      has_table_privilege('app_role','public.party_fiscal_registration','DELETE') can_delete`;
    expect(grants[0]).toEqual({
      can_select: true,
      can_insert: false,
      can_update: false,
      can_delete: false,
    });
  });

  test("P2: exact active Party and registration UUID resolve immutable canonical evidence", async () => {
    await clearRegistrations();
    await seedRegistration({ id: REGISTRATION_A });
    const discovered = await resolveRegistration(input(), "discover");
    const resolved = await resolveRegistration(input(), "resolve");

    expect(resolved).toEqual(discovered);
    expect(resolved).toEqual({
      registrationId: REGISTRATION_A,
      partyId: PARTY_A,
      scheme: "in-gstin",
      gstin: VALID_GSTIN_A,
      stateCode: "27",
      legalName: "Order 276 Guest Private Limited",
      tradeName: "Order 276 Guest",
      addressLine1: "1 Marine Drive",
      locality: "Mumbai",
      pin: "400001",
      evidenceHash: resolved.evidenceHash,
    });
    expect(resolved.evidenceHash).toBe(expectedEvidenceHash(resolved));
    expectDeepFrozen(resolved);
  });

  test("P3: replay is byte-identical and null trade name remains explicit", async () => {
    await clearRegistrations();
    await seedRegistration({ id: REGISTRATION_A, tradeName: null });
    const first = await resolveRegistration();
    const second = await resolveRegistration();
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first).toEqual(second);
    expect(first.tradeName).toBeNull();
    expect(first.evidenceHash).toBe(second.evidenceHash);
  });

  test("P4: exact Party/registration/tenant selection and Party lifecycle fail closed", async () => {
    await clearRegistrations();
    await seedRegistration({ id: REGISTRATION_A, partyId: PARTY_A });
    await seedRegistration({
      id: REGISTRATION_A_OTHER,
      partyId: PARTY_A_OTHER,
      registrationNumber: VALID_GSTIN_B,
      regionCode: "29",
    });

    for (const unavailable of [
      input({ registrationId: REGISTRATION_A_OTHER }),
      input({ recipientPartyId: PARTY_A_OTHER }),
      input({ registrationId: crypto.randomUUID() }),
    ]) {
      await expect(resolveRegistration(unavailable)).rejects
        .toBeInstanceOf(IndiaGstRecipientRegistrationNotFoundError);
    }
    await expect(resolveRegistration(input(), "resolve", TENANT_B)).rejects
      .toBeInstanceOf(IndiaGstRecipientRegistrationNotFoundError);

    for (const inactive of [PARTY_MERGED, PARTY_ANONYMISED]) {
      await clearRegistrations();
      await seedRegistration({ id: REGISTRATION_A, partyId: inactive });
      await expect(resolveRegistration(input({ recipientPartyId: inactive }))).rejects
        .toBeInstanceOf(IndiaGstRecipientRegistrationNotFoundError);
    }
  });

  test("P5: mutable Party profile, address and role values never substitute", async () => {
    await clearRegistrations();
    await expect(resolveRegistration()).rejects
      .toBeInstanceOf(IndiaGstRecipientRegistrationNotFoundError);

    await seedRegistration({ id: REGISTRATION_A });
    const before = await resolveRegistration();
    await deploy!`UPDATE party SET
      display_name='Changed display',legal_name='Changed legal',
      attrs='{"gstin":"29ABCDE1234F1Z5","state":"29"}'::jsonb,vip_code=NULL
      WHERE tenant_id=${TENANT_A}::uuid AND id=${PARTY_A}::uuid`;
    await deploy!`UPDATE party_role SET detail='{"gstin":"29ABCDE1234F1Z5"}'::jsonb
      WHERE tenant_id=${TENANT_A}::uuid AND party_id=${PARTY_A}::uuid`;
    await deploy!`UPDATE address SET lines=ARRAY['Changed address'],city='Changed',
      region='29',postal_code='560001'
      WHERE tenant_id=${TENANT_A}::uuid AND party_id=${PARTY_A}::uuid`;
    const after = await resolveRegistration();
    expect(after).toEqual(before);
    expect(after.evidenceHash).toBe(before.evidenceHash);
  });

  test("P6: structural GSTIN/state/PIN/text constraints and service checksum fail closed", async () => {
    await clearRegistrations();
    const rejected: readonly RegistrationOptions[] = [
      { id: id(27631), scheme: "gstin" },
      { id: id(27632), registrationNumber: "27INVALID" },
      { id: id(27633), regionCode: "28" },
      { id: id(27634), registrationNumber: "39AAPFU0939F1ZQ", regionCode: "39" },
      { id: id(27635), registrationNumber: "96AAPFU0939F1ZQ", regionCode: "96" },
      { id: id(27636), pin: "000001" },
      { id: id(27637), pin: "40001" },
      { id: id(27638), legalName: "" },
      { id: id(27639), legalName: " leading" },
      { id: id(27640), legalName: "x".repeat(101) },
      { id: id(27641), tradeName: "x".repeat(101) },
      { id: id(27642), addressLine1: "x".repeat(101) },
      { id: id(27643), locality: "x".repeat(51) },
    ];
    for (const defect of rejected) {
      await expectSqlState(seedRegistration(defect), "23514");
    }

    await seedRegistration({
      id: REGISTRATION_A,
      registrationNumber: "27AAPFU0939F1ZA",
    });
    await expect(resolveRegistration()).rejects
      .toBeInstanceOf(IndiaGstRecipientRegistrationConflictError);
  });

  test("P7: app role sees only its tenant and cannot insert, update or delete", async () => {
    await clearRegistrations();
    const ownId = await seedRegistration({ id: REGISTRATION_A });
    const foreignId = await seedRegistration({
      tenantId: TENANT_B,
      id: REGISTRATION_B,
      partyId: PARTY_B,
      registrationNumber: VALID_GSTIN_B,
      regionCode: "29",
      legalName: "Order 276 Foreign Private Limited",
      tradeName: "Order 276 Foreign",
      addressLine1: "1 Residency Road",
      locality: "Bengaluru",
      pin: "560001",
    });

    const visible = await database!.withTenantTransaction(TENANT_A, (tx) =>
      tx<Array<{ id: string }>>`SELECT id::text FROM party_fiscal_registration ORDER BY id`
    );
    expect(visible).toEqual([{ id: ownId }]);
    expect(visible.some(({ id: visibleId }) => visibleId === foreignId)).toBeFalse();

    await expectSqlState(database!.withTenantTransaction(TENANT_A, (tx) =>
      tx`INSERT INTO party_fiscal_registration(
        tenant_id,party_id,scheme,registration_number,region_code,legal_name,
        address_line1,locality,pin
      ) VALUES (
        ${TENANT_A}::uuid,${PARTY_A}::uuid,'in-gstin',${VALID_GSTIN_A},'27',
        'Denied','Denied','Mumbai','400001'
      )`
    ), "42501");
    await expectSqlState(database!.withTenantTransaction(TENANT_A, (tx) =>
      tx`UPDATE party_fiscal_registration SET legal_name='Denied'
        WHERE tenant_id=${TENANT_A}::uuid AND id=${ownId}::uuid`
    ), "42501");
    await expectSqlState(database!.withTenantTransaction(TENANT_A, (tx) =>
      tx`DELETE FROM party_fiscal_registration
        WHERE tenant_id=${TENANT_A}::uuid AND id=${ownId}::uuid`
    ), "42501");
  });

  test("P8: happy, replay and every failure are zero-write across protected effects", async () => {
    await clearRegistrations();
    await seedRegistration({ id: REGISTRATION_A });
    const before = await effectCounts();
    await resolveRegistration(input(), "discover");
    await resolveRegistration();
    await resolveRegistration();
    for (const unavailable of [
      input({ registrationId: REGISTRATION_A_OTHER }),
      input({ recipientPartyId: PARTY_A_OTHER }),
    ]) {
      await expect(resolveRegistration(unavailable)).rejects.toThrow();
    }
    expect(await effectCounts()).toEqual(before);
  });
});
