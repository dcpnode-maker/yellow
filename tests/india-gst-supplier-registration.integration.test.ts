import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { SQL } from "bun";

import {
  IndiaGstSupplierRegistrationConflictError,
  IndiaGstSupplierRegistrationNotFoundError,
  IndiaGstSupplierRegistrationService,
  createPositiveTaxAttributionSnapshot,
  type CreatePositiveTaxAttributionSnapshotInput,
  type PositiveTaxFolioEligibilityResult,
} from "../src/contexts/tax-fiscal";
import { Database, type Tx } from "../src/kernel";

setDefaultTimeout(60_000);

const DEPLOY_URL = process.env.YELLOW_DEPLOY_DATABASE_URL;
const RUNTIME_URL = process.env.YELLOW_INDIA_GST_SUPPLIER_REGISTRATION_URL ??
  process.env.YELLOW_RUNTIME_DATABASE_URL;
if (process.env.YELLOW_REQUIRE_INDIA_GST_SUPPLIER_REGISTRATION === "1" &&
    (!DEPLOY_URL || !RUNTIME_URL)) {
  throw new Error("Order 272 GST supplier-registration proof requires deploy and runtime database URLs");
}
const databaseDescribe = DEPLOY_URL && RUNTIME_URL ? describe.serial : describe.skip;
const id = (suffix: number): string =>
  `00000000-0000-0000-0000-${String(suffix).padStart(12, "0")}`;

const TENANT_A = id(27201);
const TENANT_B = id(27202);
const PROPERTY_A = id(27211);
const PROPERTY_A_OTHER = id(27212);
const PROPERTY_B = id(27213);
const EXTENSION_A = id(27221);
const EXTENSION_B = id(27222);
const REGISTRATION_A = id(27231);
const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const KEY_A = "in.order272.gst.27";
const KEY_B = "in.order272.gst.29";
const VALID_GSTIN = "27AAPFU0939F1ZV";

interface EligibilityOptions {
  readonly tenantId?: string;
  readonly propertyNode?: string;
  readonly country?: string;
  readonly currency?: string;
  readonly extensionId?: string;
  readonly ownerTenantId?: string | null;
  readonly jurisdictionKey?: string;
  readonly jurisdictionVersion?: number;
  readonly jurisdictionContentHash?: string;
}

interface RegistrationOptions {
  readonly tenantId?: string;
  readonly id?: string;
  readonly propertyNode?: string;
  readonly scheme?: string;
  readonly currency?: string;
  readonly extensionId?: string;
  readonly ownerTenantId?: string | null;
  readonly jurisdictionKey?: string;
  readonly jurisdictionVersion?: number;
  readonly jurisdictionContentHash?: string;
  readonly registrationNumber?: string;
  readonly regionCode?: string;
  readonly legalName?: string;
  readonly tradeName?: string | null;
  readonly addressLine?: string;
  readonly locality?: string;
  readonly postalCode?: string;
}

let deploy: SQL | undefined;
let database: Database | undefined;
let sequence = 0;

function snapshotInput(n: number, options: EligibilityOptions): CreatePositiveTaxAttributionSnapshotInput {
  const tenantId = options.tenantId ?? TENANT_A;
  const quoteHash = n.toString(16).padStart(64, "c").slice(-64);
  const jurisdictionKey = options.jurisdictionKey ?? KEY_A;
  return {
    origin: { kind: "rate_quote", quoteHash },
    currency: options.currency ?? "INR",
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
      jurisdictionKey,
      evidenceRef: `tax-assignment:${quoteHash}`,
    }],
    jurisdiction: {
      extensionId: options.extensionId ?? EXTENSION_A,
      ownerTenantId: options.ownerTenantId === undefined ? tenantId : options.ownerTenantId,
      key: jurisdictionKey,
      version: options.jurisdictionVersion ?? 7,
      contentHash: options.jurisdictionContentHash ?? HASH_A,
      evidenceRef: `tax-jurisdiction:${"d".repeat(64)}`,
    },
    evaluation: {
      schemaVersion: 1,
      jurisdictionKey,
      country: options.country ?? "IN",
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
  };
}

function eligibility(options: EligibilityOptions = {}): Readonly<{
  input: Readonly<{ tenantId: string; propertyNode: string; reservationId: string }>;
  result: PositiveTaxFolioEligibilityResult;
}> {
  const n = ++sequence;
  const tenantId = options.tenantId ?? TENANT_A;
  const propertyNode = options.propertyNode ?? PROPERTY_A;
  const reservationId = crypto.randomUUID();
  const snapshot = createPositiveTaxAttributionSnapshot(snapshotInput(n, options));
  return Object.freeze({
    input: Object.freeze({ tenantId, propertyNode, reservationId }),
    result: Object.freeze({
      lineageId: crypto.randomUUID(),
      bindingId: crypto.randomUUID(),
      attributionId: crypto.randomUUID(),
      reservationId,
      segmentId: crypto.randomUUID(),
      folioId: crypto.randomUUID(),
      guestAccountId: crypto.randomUUID(),
      propertyNode,
      quoteHash: snapshot.origin.quoteHash,
      snapshotHash: snapshot.snapshotHash,
      currency: snapshot.currency,
      snapshot,
    }),
  });
}

function service(fixture: ReturnType<typeof eligibility>, calls?: { discover: number; resolve: number }) {
  return new IndiaGstSupplierRegistrationService({
    async discover(_tx: Tx, input: typeof fixture.input) {
      calls && (calls.discover += 1);
      expect(input).toEqual(fixture.input);
      return fixture.result;
    },
    async resolve(_tx: Tx, input: typeof fixture.input) {
      calls && (calls.resolve += 1);
      expect(input).toEqual(fixture.input);
      return fixture.result;
    },
  });
}

async function resolveRegistration(
  fixture: ReturnType<typeof eligibility>,
  method: "discover" | "resolve" = "resolve",
  transactionTenant = fixture.input.tenantId,
) {
  const instance = service(fixture);
  return database!.withTenantTransaction(
    transactionTenant,
    (tx) => instance[method](tx, fixture.input),
  );
}

function expectDeepFrozen(value: unknown, seen = new Set<object>()): void {
  if (typeof value !== "object" || value === null || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBeTrue();
  for (const key of Reflect.ownKeys(value)) {
    expectDeepFrozen((value as Record<PropertyKey, unknown>)[key], seen);
  }
}

function expectedEvidenceHash(result: Awaited<ReturnType<typeof resolveRegistration>>): string {
  return new Bun.CryptoHasher("sha256").update(JSON.stringify({
    registrationId: result.registrationId,
    tenantId: TENANT_A,
    propertyNode: result.propertyNode,
    scheme: result.scheme,
    currency: result.currency,
    jurisdiction: result.jurisdiction,
    gstin: result.gstin,
    stateCode: result.stateCode,
    legalName: result.legalName,
    tradeName: result.tradeName,
    addressLine: result.addressLine,
    locality: result.locality,
    postalCode: result.postalCode,
  })).digest("hex");
}

async function seedRegistration(options: RegistrationOptions = {}): Promise<string> {
  const registrationId = options.id ?? crypto.randomUUID();
  await deploy!`INSERT INTO property_fiscal_registration(
      tenant_id,id,property_node,scheme,currency,jurisdiction_extension_id,
      jurisdiction_owner_tenant_id,jurisdiction_key,jurisdiction_version,
      jurisdiction_content_hash,registration_number,region_code,legal_name,
      trade_name,address_line,locality,postal_code
    ) VALUES (
      ${options.tenantId ?? TENANT_A}::uuid,${registrationId}::uuid,
      ${options.propertyNode ?? PROPERTY_A}::uuid,${options.scheme ?? "in-gstin"},
      ${options.currency ?? "INR"}::char(3),${options.extensionId ?? EXTENSION_A}::uuid,
      ${options.ownerTenantId === undefined ? TENANT_A : options.ownerTenantId}::uuid,
      ${options.jurisdictionKey ?? KEY_A},${options.jurisdictionVersion ?? 7},
      ${options.jurisdictionContentHash ?? HASH_A},${options.registrationNumber ?? VALID_GSTIN},
      ${options.regionCode ?? "27"},${options.legalName ?? "Order 272 Hospitality Private Limited"},
      ${options.tradeName === undefined ? "Order 272 Hotel" : options.tradeName},
      ${options.addressLine ?? "1 Marine Drive"},${options.locality ?? "Mumbai"},
      ${options.postalCode ?? "400001"}
    )`;
  return registrationId;
}

async function clearRegistrations(): Promise<void> {
  await deploy!`DELETE FROM property_fiscal_registration
    WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
}

async function effectCounts(): Promise<Record<string, number | string>> {
  const rows = await deploy!<Array<Record<string, number | string>>>`SELECT
    (SELECT count(*)::int FROM property_fiscal_registration
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) registrations,
    (SELECT COALESCE(md5(string_agg(registration::text, '|' ORDER BY id)), md5(''))
       FROM property_fiscal_registration AS registration
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) registration_digest,
    (SELECT count(*)::int FROM tax_attribution_snapshot
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) attribution_snapshots,
    (SELECT count(*)::int FROM tax_attribution_hold_binding
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) hold_bindings,
    (SELECT count(*)::int FROM tax_attribution_reservation_binding
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) reservation_bindings,
    (SELECT count(*)::int FROM tax_attribution_journal_binding
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) journal_bindings,
    (SELECT count(*)::int FROM tax_semantic_route
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) semantic_routes,
    (SELECT count(*)::int FROM posting_line
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)
        AND tax_detail IS NOT NULL) tax_details,
    (SELECT count(*)::int FROM journal
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) journals,
    (SELECT count(*)::int FROM posting_line
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) postings,
    (SELECT count(*)::int FROM document
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) documents,
    (SELECT count(*)::int FROM outbox
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) events,
    (SELECT count(*)::int FROM fiscal_submission
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) submissions,
    (SELECT count(*)::int FROM api_idempotency
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) idempotency`;
  return rows[0]!;
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

async function cleanup(): Promise<void> {
  if (!deploy) return;
  await clearRegistrations();
  await deploy`DELETE FROM extension WHERE id IN (${EXTENSION_A}::uuid,${EXTENSION_B}::uuid)`;
  await deploy`DELETE FROM org_node WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM tenant WHERE id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
}

test("Order 272 P0: exact India GST supplier-registration module and migration exist", async () => {
  expect(typeof IndiaGstSupplierRegistrationService).toBe("function");
  const sql = await Bun.file(
    new URL("../migrations/0047_property_fiscal_registration.sql", import.meta.url),
  ).text();
  expect(sql).toContain("CREATE TABLE public.property_fiscal_registration");
  expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
  expect(sql).toContain("GRANT SELECT ON TABLE public.property_fiscal_registration TO app_role");
});

test("Order 272 P0: missing evidence performs one exact registration read and no heuristic fallback", async () => {
  const target = eligibility();
  const statements: string[] = [];
  const tx = (async (strings: TemplateStringsArray) => {
    statements.push(strings.join("?"));
    return [];
  }) as unknown as Tx;
  await expect(service(target).resolve(tx, target.input)).rejects
    .toBeInstanceOf(IndiaGstSupplierRegistrationNotFoundError);
  expect(statements).toHaveLength(1);
  expect(statements[0]).toContain("public.property_fiscal_registration");
  expect(statements[0]).toContain("public.org_node");
  expect(statements[0]).toMatch(/property\.tenant_id\s*=\s*registration\.tenant_id/i);
  expect(statements[0]).toMatch(/property\.kind\s*=\s*'property'/i);
  expect(statements[0]).not.toMatch(/JOIN\s+(?:public\.)?extension|party|guest|display/i);
});

databaseDescribe("Order 272 exact India GST supplier-registration evidence", () => {
  beforeAll(async () => {
    deploy = new SQL(DEPLOY_URL!, { max: 16, prepare: false });
    database = Database.connect(RUNTIME_URL!, { maxConnections: 16, prepare: false });
    await cleanup();
    await deploy`INSERT INTO tenant(id,slug,name,tier,status) VALUES
      (${TENANT_A}::uuid,'order272-a','Order 272 A','shared','active'),
      (${TENANT_B}::uuid,'order272-b','Order 272 B','shared','active')`;
    await deploy`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES
      (${PROPERTY_A}::uuid,${TENANT_A}::uuid,'order272a.property'::ltree,
        'property','Order 272 India','Asia/Kolkata','INR'),
      (${PROPERTY_A_OTHER}::uuid,${TENANT_A}::uuid,'order272a.other'::ltree,
        'property','Order 272 Other','Asia/Kolkata','INR'),
      (${PROPERTY_B}::uuid,${TENANT_B}::uuid,'order272b.property'::ltree,
        'property','Order 272 Foreign','Asia/Kolkata','INR')`;
    await deploy`INSERT INTO extension(id,tenant_id,type,key,version,effective,content,status) VALUES
      (${EXTENSION_A}::uuid,${TENANT_A}::uuid,'tax_jurisdiction',${KEY_A},7,
       '[2030-01-01 00:00:00+00,)'::tstzrange,
       '{"country":"IN","price_display":"tax_exclusive","rounding":"line","taxes":[]}'::jsonb,
       'active'),
      (${EXTENSION_B}::uuid,${TENANT_B}::uuid,'tax_jurisdiction',${KEY_B},3,
       '[2030-01-01 00:00:00+00,)'::tstzrange,
       '{"country":"IN","price_display":"tax_exclusive","rounding":"line","taxes":[]}'::jsonb,
       'active')`;
  });

  afterAll(async () => {
    await cleanup();
    await database?.close();
    await deploy?.close({ timeout: 0 });
  });

  test("P1: exact IN/INR frozen identity resolves canonical deeply frozen supplier evidence", async () => {
    await clearRegistrations();
    await seedRegistration({ id: REGISTRATION_A });
    const target = eligibility();
    const calls = { discover: 0, resolve: 0 };
    const instance = service(target, calls);

    const discovered = await database!.withTenantTransaction(
      TENANT_A,
      (tx) => instance.discover(tx, target.input),
    );
    const resolved = await database!.withTenantTransaction(
      TENANT_A,
      (tx) => instance.resolve(tx, target.input),
    );

    expect(calls).toEqual({ discover: 1, resolve: 1 });
    expect(resolved).toEqual(discovered);
    expect(resolved).toEqual({
      registrationId: REGISTRATION_A,
      propertyNode: PROPERTY_A,
      scheme: "in-gstin",
      currency: "INR",
      jurisdiction: {
        extensionId: EXTENSION_A,
        ownerTenantId: TENANT_A,
        key: KEY_A,
        version: "7",
        contentHash: HASH_A,
      },
      gstin: VALID_GSTIN,
      stateCode: "27",
      legalName: "Order 272 Hospitality Private Limited",
      tradeName: "Order 272 Hotel",
      addressLine: "1 Marine Drive",
      locality: "Mumbai",
      postalCode: "400001",
      evidenceHash: resolved.evidenceHash,
    });
    expect(resolved.evidenceHash).toMatch(/^[0-9a-f]{64}$/);
    expect(resolved.evidenceHash).toBe(expectedEvidenceHash(resolved));
    expectDeepFrozen(resolved);
  });

  test("P2: replay is byte-identical and nullable trade/owner evidence remains explicit", async () => {
    await clearRegistrations();
    await seedRegistration({ ownerTenantId: null, tradeName: null });
    const target = eligibility({ ownerTenantId: null });
    const first = await resolveRegistration(target);
    const second = await resolveRegistration(target);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first).toEqual(second);
    expect(first.jurisdiction.ownerTenantId).toBeNull();
    expect(first.tradeName).toBeNull();
    expect(first.evidenceHash).toBe(second.evidenceHash);
  });

  test("P3: country and currency blockers fail before registration discovery", async () => {
    await clearRegistrations();
    await seedRegistration();
    const cases = [
      eligibility({ country: "CA" }),
      eligibility({ currency: "CAD" }),
    ];
    for (const target of cases) {
      await expect(resolveRegistration(target)).rejects
        .toBeInstanceOf(IndiaGstSupplierRegistrationConflictError);
    }
  });

  test("P4: property and complete frozen jurisdiction mismatches never fall back", async () => {
    const cases: readonly RegistrationOptions[] = [
      { propertyNode: PROPERTY_A_OTHER },
      { extensionId: EXTENSION_B },
      { ownerTenantId: null },
      { jurisdictionKey: KEY_B },
      { jurisdictionVersion: 8 },
      { jurisdictionContentHash: HASH_B },
    ];
    for (const mismatch of cases) {
      await clearRegistrations();
      await seedRegistration(mismatch);
      await expect(resolveRegistration(eligibility())).rejects
        .toBeInstanceOf(IndiaGstSupplierRegistrationNotFoundError);
    }

    await clearRegistrations();
    await seedRegistration({ ownerTenantId: TENANT_A });
    await expect(resolveRegistration(eligibility({ ownerTenantId: null }))).rejects
      .toBeInstanceOf(IndiaGstSupplierRegistrationNotFoundError);
  });

  test("P5: wrong tenant context and foreign property registration stay unavailable", async () => {
    await clearRegistrations();
    await seedRegistration();
    await expect(resolveRegistration(eligibility(), "resolve", TENANT_B)).rejects
      .toBeInstanceOf(IndiaGstSupplierRegistrationNotFoundError);

    await clearRegistrations();
    await seedRegistration({
      tenantId: TENANT_B,
      propertyNode: PROPERTY_B,
      extensionId: EXTENSION_B,
      ownerTenantId: TENANT_B,
      jurisdictionKey: KEY_B,
      jurisdictionVersion: 3,
      jurisdictionContentHash: HASH_B,
      registrationNumber: "29ABCDE1234F1Z5",
      regionCode: "29",
      postalCode: "560001",
    });
    const foreign = eligibility({
      tenantId: TENANT_B,
      propertyNode: PROPERTY_B,
      extensionId: EXTENSION_B,
      ownerTenantId: TENANT_B,
      jurisdictionKey: KEY_B,
      jurisdictionVersion: 3,
      jurisdictionContentHash: HASH_B,
    });
    await expect(resolveRegistration(foreign, "resolve", TENANT_A)).rejects
      .toBeInstanceOf(IndiaGstSupplierRegistrationNotFoundError);
  });

  test("P6: unique exact mapping and structural GSTIN/state/pincode/text constraints reject defects", async () => {
    await clearRegistrations();
    await seedRegistration();
    await expectSqlState(seedRegistration(), "23505");

    const rejected: readonly RegistrationOptions[] = [
      { jurisdictionVersion: 99, scheme: "gstin" },
      { jurisdictionVersion: 100, currency: "USD" },
      { jurisdictionVersion: 101, registrationNumber: "27INVALID" },
      { jurisdictionVersion: 102, regionCode: "28" },
      { jurisdictionVersion: 110, regionCode: "39", registrationNumber: "39AAPFU0939F1ZQ" },
      { jurisdictionVersion: 111, regionCode: "96", registrationNumber: "96AAPFU0939F1ZQ" },
      { jurisdictionVersion: 103, postalCode: "000001" },
      { jurisdictionVersion: 104, postalCode: "40001" },
      { jurisdictionVersion: 105, legalName: "" },
      { jurisdictionVersion: 106, legalName: " leading" },
      { jurisdictionVersion: 107, tradeName: "trailing " },
      { jurisdictionVersion: 108, addressLine: "x".repeat(301) },
      { jurisdictionVersion: 109, locality: " ".repeat(2) },
    ];
    for (const defect of rejected) {
      await expectSqlState(seedRegistration(defect), "23514");
    }
  });

  test("P7: structurally admissible checksum, state and hostile-text defects fail closed", async () => {
    await clearRegistrations();
    await seedRegistration({ registrationNumber: "27AAPFU0939F1ZA" });
    await expect(resolveRegistration(eligibility())).rejects
      .toBeInstanceOf(IndiaGstSupplierRegistrationConflictError);

    for (const hostile of [
      { legalName: "Order 272\u0007 Hotel" },
      { locality: "Cafe\u0301" },
    ]) {
      await clearRegistrations();
      await seedRegistration(hostile);
      await expect(resolveRegistration(eligibility())).rejects
        .toBeInstanceOf(IndiaGstSupplierRegistrationConflictError);
    }
  });

  test("P8: app-role can select only its tenant and cannot insert, update or delete", async () => {
    await clearRegistrations();
    const ownId = await seedRegistration();
    const foreignId = await seedRegistration({
      tenantId: TENANT_B,
      propertyNode: PROPERTY_B,
      extensionId: EXTENSION_B,
      ownerTenantId: TENANT_B,
      jurisdictionKey: KEY_B,
      jurisdictionVersion: 3,
      jurisdictionContentHash: HASH_B,
      registrationNumber: "29ABCDE1234F1Z5",
      regionCode: "29",
      postalCode: "560001",
    });

    const visible = await database!.withTenantTransaction(TENANT_A, (tx) =>
      tx<Array<{ id: string }>>`SELECT id::text FROM property_fiscal_registration ORDER BY id`
    );
    expect(visible).toEqual([{ id: ownId }]);
    expect(visible.some((row) => row.id === foreignId)).toBeFalse();

    await expectSqlState(database!.withTenantTransaction(TENANT_A, (tx) =>
      tx`INSERT INTO property_fiscal_registration(
        tenant_id,property_node,scheme,currency,jurisdiction_extension_id,
        jurisdiction_owner_tenant_id,jurisdiction_key,jurisdiction_version,
        jurisdiction_content_hash,registration_number,region_code,legal_name,
        address_line,locality,postal_code
      ) VALUES (
        ${TENANT_A}::uuid,${PROPERTY_A}::uuid,'in-gstin','INR',${EXTENSION_A}::uuid,
        ${TENANT_A}::uuid,${KEY_A},99,${HASH_A},${VALID_GSTIN},'27','Denied',
        'Denied','Mumbai','400001'
      )`
    ), "42501");
    await expectSqlState(database!.withTenantTransaction(TENANT_A, (tx) =>
      tx`UPDATE property_fiscal_registration SET legal_name='Denied'
        WHERE tenant_id=${TENANT_A}::uuid AND id=${ownId}::uuid`
    ), "42501");
    await expectSqlState(database!.withTenantTransaction(TENANT_A, (tx) =>
      tx`DELETE FROM property_fiscal_registration
        WHERE tenant_id=${TENANT_A}::uuid AND id=${ownId}::uuid`
    ), "42501");
  });

  test("P9: happy, replay and every failure are read-only across financial/fiscal effects", async () => {
    await clearRegistrations();
    await seedRegistration();
    const before = await effectCounts();
    await resolveRegistration(eligibility(), "discover");
    const target = eligibility();
    await resolveRegistration(target);
    await resolveRegistration(target);

    for (const mismatch of [
      eligibility({ country: "AE" }),
      eligibility({ currency: "USD" }),
      eligibility({ propertyNode: PROPERTY_A_OTHER }),
      eligibility({ jurisdictionContentHash: HASH_B }),
    ]) {
      await expect(resolveRegistration(mismatch)).rejects.toThrow();
    }
    expect(await effectCounts()).toEqual(before);
  });
});
