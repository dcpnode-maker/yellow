import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { SQL } from "bun";

import {
  IndiaGstAccommodationClassificationConflictError,
  IndiaGstAccommodationClassificationNotFoundError,
  IndiaGstAccommodationClassificationService,
  IndiaGstAccommodationClassificationValidationError,
  createPositiveTaxAttributionSnapshot,
  type CreatePositiveTaxAttributionSnapshotInput,
  type PositiveTaxFolioEligibilityResult,
} from "../src/contexts/tax-fiscal";
import { Database, type Tx } from "../src/kernel";

setDefaultTimeout(60_000);

const DEPLOY_URL = process.env.YELLOW_DEPLOY_DATABASE_URL;
const RUNTIME_URL = process.env.YELLOW_INDIA_GST_ACCOMMODATION_CLASSIFICATION_URL ??
  process.env.YELLOW_RUNTIME_DATABASE_URL;
if (process.env.YELLOW_REQUIRE_INDIA_GST_ACCOMMODATION_CLASSIFICATION === "1" &&
    (!DEPLOY_URL || !RUNTIME_URL)) {
  throw new Error(
    "Order 281 India GST accommodation-classification proof requires deploy and runtime database URLs",
  );
}
const databaseDescribe = DEPLOY_URL && RUNTIME_URL ? describe.serial : describe.skip;

const id = (suffix: number): string =>
  `00000000-0000-0000-0000-${String(suffix).padStart(12, "0")}`;

const TENANT_A = id(28101);
const TENANT_B = id(28102);
const PROPERTY_A = id(28111);
const PROPERTY_A_OTHER = id(28112);
const PROPERTY_B = id(28113);
const EXTENSION_A = id(28121);
const EXTENSION_B = id(28122);
const CLASSIFICATION_A = id(28131);
const CLASSIFICATION_B = id(28132);
const RESERVATION_A = id(28141);
const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const KEY_A = "in.order281.gst.27";
const KEY_B = "in.order281.gst.29";
const ALLOWED_SACS = [
  "996311", "996312", "996313", "996321", "996322", "996329",
] as const;

interface EligibilityOptions {
  readonly tenantId?: string;
  readonly propertyNode?: string;
  readonly reservationId?: string;
  readonly country?: string;
  readonly currency?: string;
  readonly extensionId?: string;
  readonly ownerTenantId?: string | null;
  readonly jurisdictionKey?: string;
  readonly jurisdictionVersion?: number;
  readonly jurisdictionContentHash?: string;
  readonly lineId?: string;
  readonly revenueGroup?: string;
}

interface ClassificationOptions {
  readonly tenantId?: string;
  readonly id?: string;
  readonly propertyNode?: string;
  readonly extensionId?: string;
  readonly ownerTenantId?: string | null;
  readonly jurisdictionKey?: string;
  readonly jurisdictionVersion?: number;
  readonly jurisdictionContentHash?: string;
  readonly countryCode?: string;
  readonly lineId?: string;
  readonly revenueGroup?: string;
  readonly classificationSystem?: string;
  readonly classificationCode?: string;
  readonly isServiceCode?: string;
}

interface ClassificationRow {
  readonly tenant_id: string;
  readonly id: string;
  readonly property_node: string;
  readonly jurisdiction_extension_id: string;
  readonly jurisdiction_owner_tenant_id: string | null;
  readonly jurisdiction_key: string;
  readonly jurisdiction_version: string | number;
  readonly jurisdiction_content_hash: string;
  readonly country_code: string;
  readonly line_id: string;
  readonly revenue_group: string;
  readonly classification_system: string;
  readonly classification_code: string;
  readonly is_service_code: string;
}

type MutableRecord = Record<PropertyKey, unknown>;

let deploy: SQL | undefined;
let database: Database | undefined;
let sequence = 0;

function snapshotInput(n: number, options: EligibilityOptions): CreatePositiveTaxAttributionSnapshotInput {
  const tenantId = options.tenantId ?? TENANT_A;
  const quoteHash = n.toString(16).padStart(64, "c").slice(-64);
  const jurisdictionKey = options.jurisdictionKey ?? KEY_A;
  const lineId = (options.lineId ?? "room") as "room";
  const revenueGroup = (options.revenueGroup ?? "room_revenue") as "room_revenue";
  return {
    origin: { kind: "rate_quote", quoteHash },
    currency: options.currency ?? "INR",
    line: {
      lineId,
      revenueGroup,
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
          lineId,
          revenueGroup,
          baseMinor: 10_000n,
          taxMinor: 500n,
          rateBasisPoints: 500,
        }],
      }],
    },
  };
}

function eligibility(options: EligibilityOptions = {}): Readonly<{
  input: Readonly<{
    tenantId: string;
    propertyNode: string;
    reservationId: string;
    classificationId: string;
  }>;
  result: PositiveTaxFolioEligibilityResult;
}> {
  const n = ++sequence;
  const tenantId = options.tenantId ?? TENANT_A;
  const propertyNode = options.propertyNode ?? PROPERTY_A;
  const reservationId = options.reservationId ?? RESERVATION_A;
  const snapshot = createPositiveTaxAttributionSnapshot(snapshotInput(n, options));
  return Object.freeze({
    input: Object.freeze({
      tenantId,
      propertyNode,
      reservationId,
      classificationId: CLASSIFICATION_A,
    }),
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

function classificationRow(
  overrides: Partial<ClassificationRow> = {},
): ClassificationRow {
  return {
    tenant_id: TENANT_A,
    id: CLASSIFICATION_A,
    property_node: PROPERTY_A,
    jurisdiction_extension_id: EXTENSION_A,
    jurisdiction_owner_tenant_id: TENANT_A,
    jurisdiction_key: KEY_A,
    jurisdiction_version: 7,
    jurisdiction_content_hash: HASH_A,
    country_code: "IN",
    line_id: "room",
    revenue_group: "room_revenue",
    classification_system: "SAC",
    classification_code: "996311",
    is_service_code: "Y",
    ...overrides,
  };
}

function service(
  fixture: ReturnType<typeof eligibility>,
  calls?: { resolve: number },
): IndiaGstAccommodationClassificationService {
  return new IndiaGstAccommodationClassificationService({
    async resolve(_tx: Tx, input: {
      tenantId: string;
      propertyNode: string;
      reservationId: string;
    }) {
      calls && (calls.resolve += 1);
      expect(input).toEqual({
        tenantId: fixture.input.tenantId,
        propertyNode: fixture.input.propertyNode,
        reservationId: fixture.input.reservationId,
      });
      return fixture.result;
    },
  });
}

function fakeTx(rows: readonly ClassificationRow[], statements?: string[]): Tx {
  return (async (strings: TemplateStringsArray) => {
    statements?.push(strings.join("?"));
    return rows;
  }) as unknown as Tx;
}

async function resolveClassification(
  fixture: ReturnType<typeof eligibility>,
  transactionTenant = fixture.input.tenantId,
) {
  const instance = service(fixture);
  return database!.withTenantTransaction(
    transactionTenant,
    (tx) => instance.resolve(tx, fixture.input),
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

function expectedEvidenceHash(result: {
  readonly classificationId: string;
  readonly propertyNode: string;
  readonly jurisdiction: {
    readonly extensionId: string;
    readonly ownerTenantId: string | null;
    readonly key: string;
    readonly version: string;
    readonly contentHash: string;
  };
  readonly lineId: string;
  readonly revenueGroup: string;
  readonly classificationSystem: string;
  readonly classificationCode: string;
  readonly isServiceCode: string;
}): string {
  return new Bun.CryptoHasher("sha256").update(JSON.stringify({
    tenantId: TENANT_A,
    classificationId: result.classificationId,
    propertyNode: result.propertyNode,
    jurisdiction: result.jurisdiction,
    lineId: result.lineId,
    revenueGroup: result.revenueGroup,
    classificationSystem: result.classificationSystem,
    classificationCode: result.classificationCode,
    isServiceCode: result.isServiceCode,
  })).digest("hex");
}

async function seedClassification(options: ClassificationOptions = {}): Promise<string> {
  const classificationId = options.id ?? crypto.randomUUID();
  await deploy!`INSERT INTO india_gst_item_classification(
      tenant_id,id,property_node,jurisdiction_extension_id,
      jurisdiction_owner_tenant_id,jurisdiction_key,jurisdiction_version,
      jurisdiction_content_hash,country_code,line_id,revenue_group,
      classification_system,classification_code,is_service_code
    ) VALUES (
      ${options.tenantId ?? TENANT_A}::uuid,${classificationId}::uuid,
      ${options.propertyNode ?? PROPERTY_A}::uuid,
      ${options.extensionId ?? EXTENSION_A}::uuid,
      ${options.ownerTenantId === undefined ? TENANT_A : options.ownerTenantId}::uuid,
      ${options.jurisdictionKey ?? KEY_A},${options.jurisdictionVersion ?? 7},
      ${options.jurisdictionContentHash ?? HASH_A},${options.countryCode ?? "IN"},
      ${options.lineId ?? "room"},${options.revenueGroup ?? "room_revenue"},
      ${options.classificationSystem ?? "SAC"},
      ${options.classificationCode ?? "996311"},${options.isServiceCode ?? "Y"}
    )`;
  return classificationId;
}

async function clearClassifications(): Promise<void> {
  await deploy!`DELETE FROM india_gst_item_classification
    WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
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

async function effects(): Promise<Record<string, number | string>> {
  const rows = await deploy!<Array<Record<string, number | string>>>`SELECT
    (SELECT count(*)::int FROM india_gst_item_classification
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) classifications,
    (SELECT COALESCE(md5(string_agg(subject::text,'|' ORDER BY id)),md5(''))
       FROM india_gst_item_classification subject
      WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) classification_digest,
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

async function cleanup(): Promise<void> {
  if (!deploy) return;
  await clearClassifications();
  await deploy`DELETE FROM extension WHERE id IN (${EXTENSION_A}::uuid,${EXTENSION_B}::uuid)`;
  await deploy`DELETE FROM org_node WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM tenant WHERE id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
}

test("Order 281 P0: exact migration and bounded-context resolver exist", async () => {
  expect(typeof IndiaGstAccommodationClassificationService).toBe("function");
  const sql = await Bun.file(
    new URL("../migrations/0050_india_gst_item_classification.sql", import.meta.url),
  ).text();
  expect(sql).toContain("CREATE TABLE public.india_gst_item_classification");
  expect(sql).toContain("FOREIGN KEY (tenant_id, property_node)");
  expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
  expect(sql).toContain("FORCE ROW LEVEL SECURITY");
  expect(sql).toContain(
    "GRANT SELECT ON TABLE public.india_gst_item_classification TO app_role",
  );
});

test("Order 281 P0: exact row resolves deterministic frozen SELECT-only SAC/Y evidence", async () => {
  const target = eligibility();
  const statements: string[] = [];
  const instance = service(target);
  const first = await instance.resolve(fakeTx([classificationRow()], statements), target.input);
  const second = await instance.resolve(fakeTx([classificationRow()]), target.input);

  expect(first).toEqual(second);
  expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  expect(first).toEqual({
    classificationId: CLASSIFICATION_A,
    propertyNode: PROPERTY_A,
    jurisdiction: {
      extensionId: EXTENSION_A,
      ownerTenantId: TENANT_A,
      key: KEY_A,
      version: "7",
      contentHash: HASH_A,
    },
    lineId: "room",
    revenueGroup: "room_revenue",
    classificationSystem: "SAC",
    classificationCode: "996311",
    isServiceCode: "Y",
    evidenceHash: first.evidenceHash,
  });
  expect(Object.keys(first)).toEqual([
    "classificationId", "propertyNode", "jurisdiction", "lineId", "revenueGroup",
    "classificationSystem", "classificationCode", "isServiceCode", "evidenceHash",
  ]);
  expect(first).not.toHaveProperty("tenantId");
  expect(first.evidenceHash).toBe(expectedEvidenceHash(first));
  expectDeepFrozen(first);
  expect(statements).toHaveLength(1);
  expect(statements[0]).toContain("public.india_gst_item_classification");
  expect(statements[0]).toContain("public.org_node");
  expect(statements[0]).toContain("current_setting('app.tenant_id', true)");
  expect(statements[0]).toMatch(/property\.kind\s*=\s*'property'/i);
  expect(statements[0]).not.toMatch(
    /property_fiscal_registration|party_fiscal_registration|profile_key|public\.space|unit_type|tx_code|GST_ROOM|usali|rate_plan|tax_semantic_route/i,
  );
  expect(statements[0]).not.toMatch(
    /property\.(?:name|config|path)|\b(?:INSERT|UPDATE|DELETE|FOR\s+UPDATE|FOR\s+SHARE|pg_advisory)\b/i,
  );
});

test("Order 281 P0: exact four-UUID plain input and exact stored row shape fail closed", async () => {
  const target = eligibility();
  const input = target.input;
  const instance = service(target);
  const hostileInputs: unknown[] = [
    null,
    [],
    Object.assign(Object.create({}), input),
    { tenantId: input.tenantId, propertyNode: input.propertyNode, reservationId: input.reservationId },
    { ...input, extra: true },
    { ...input, tenantId: "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA" },
    { ...input, propertyNode: "not-a-uuid" },
    { ...input, reservationId: "not-a-uuid" },
    { ...input, classificationId: "not-a-uuid" },
    new Proxy({ ...input }, {}),
  ];
  const accessor = { ...input } as MutableRecord;
  Object.defineProperty(accessor, "classificationId", {
    enumerable: true,
    get: () => CLASSIFICATION_A,
  });
  hostileInputs.push(accessor);
  const symbolic = { ...input } as MutableRecord;
  symbolic[Symbol("hostile")] = true;
  hostileInputs.push(symbolic);

  for (const hostile of hostileInputs) {
    let calls = 0;
    const tx = (() => {
      calls += 1;
      return Promise.resolve([]);
    }) as unknown as Tx;
    await expect(instance.resolve(tx, hostile as never)).rejects
      .toBeInstanceOf(IndiaGstAccommodationClassificationValidationError);
    expect(calls).toBe(0);
  }
  await expect(instance.resolve(undefined as unknown as Tx, input)).rejects
    .toBeInstanceOf(IndiaGstAccommodationClassificationValidationError);

  const missing = { ...classificationRow() } as MutableRecord;
  delete missing.classification_code;
  const surplus = { ...classificationRow(), hsn: "996311" } as MutableRecord;
  const rowAccessor = { ...classificationRow() } as MutableRecord;
  Object.defineProperty(rowAccessor, "classification_code", {
    enumerable: true,
    get: () => "996311",
  });
  const rowSymbolic = { ...classificationRow() } as MutableRecord;
  rowSymbolic[Symbol("hostile")] = true;
  const rowProxy = new Proxy({ ...classificationRow() }, {});
  for (const hostile of [missing, surplus, rowAccessor, rowSymbolic, rowProxy]) {
    await expect(instance.resolve(
      fakeTx([hostile as unknown as ClassificationRow]),
      input,
    )).rejects.toBeInstanceOf(IndiaGstAccommodationClassificationConflictError);
  }
});

test("Order 281 P0: missing, duplicate, malformed and incoherent rows fail closed", async () => {
  const target = eligibility();
  const instance = service(target);
  await expect(instance.resolve(fakeTx([]), target.input)).rejects
    .toBeInstanceOf(IndiaGstAccommodationClassificationNotFoundError);
  await expect(instance.resolve(
    fakeTx([classificationRow(), classificationRow()]),
    target.input,
  )).rejects.toBeInstanceOf(IndiaGstAccommodationClassificationConflictError);

  const defects: readonly Partial<ClassificationRow>[] = [
    { tenant_id: TENANT_B },
    { id: CLASSIFICATION_B },
    { property_node: PROPERTY_A_OTHER },
    { jurisdiction_extension_id: EXTENSION_B },
    { jurisdiction_owner_tenant_id: null },
    { jurisdiction_key: KEY_B },
    { jurisdiction_version: 8 },
    { jurisdiction_content_hash: HASH_B },
    { country_code: "in" },
    { line_id: "spa" },
    { revenue_group: "spa_revenue" },
    { classification_system: "HSN" },
    { classification_code: "123456" },
    { is_service_code: "N" },
  ];
  for (const defect of defects) {
    await expect(instance.resolve(fakeTx([classificationRow(defect)]), target.input))
      .rejects.toBeInstanceOf(IndiaGstAccommodationClassificationConflictError);
  }
});

databaseDescribe("Order 281 exact India GST accommodation-classification evidence", () => {
  beforeAll(async () => {
    deploy = new SQL(DEPLOY_URL!, { max: 16, prepare: false });
    database = Database.connect(RUNTIME_URL!, { maxConnections: 16, prepare: false });
    await cleanup();
    await deploy`INSERT INTO tenant(id,slug,name,tier,status) VALUES
      (${TENANT_A}::uuid,'order281-a','Order 281 A','shared','active'),
      (${TENANT_B}::uuid,'order281-b','Order 281 B','shared','active')`;
    await deploy`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency,config) VALUES
      (${PROPERTY_A}::uuid,${TENANT_A}::uuid,'order281a.property'::ltree,'property',
       'Misleading Room Revenue','Asia/Kolkata','INR',
       '{"classification":"999999","sac":"000000","rate_plan":"AP"}'::jsonb),
      (${PROPERTY_A_OTHER}::uuid,${TENANT_A}::uuid,'order281a.other'::ltree,'property',
       'Order 281 Other','Asia/Kolkata','INR','{}'::jsonb),
      (${PROPERTY_B}::uuid,${TENANT_B}::uuid,'order281b.property'::ltree,'property',
       'Order 281 Foreign','Asia/Kolkata','INR','{}'::jsonb)`;
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

  test("P1: schema has exact identity, forced RLS and app-role SELECT-only authority", async () => {
    const relation = await deploy!<Array<{
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
    }>>`SELECT relrowsecurity,relforcerowsecurity
      FROM pg_class WHERE oid='public.india_gst_item_classification'::regclass`;
    expect(relation).toEqual([{ relrowsecurity: true, relforcerowsecurity: true }]);

    const constraints = await deploy!<Array<{ type: string; definition: string }>>`
      SELECT contype::text type,pg_get_constraintdef(oid) definition
      FROM pg_constraint
      WHERE conrelid='public.india_gst_item_classification'::regclass`;
    expect(constraints.some(({ type, definition }) =>
      type === "p" && /PRIMARY KEY \(tenant_id, id\)/i.test(definition)
    )).toBeTrue();
    expect(constraints.some(({ type, definition }) =>
      type === "f" && /FOREIGN KEY \(tenant_id, property_node\) REFERENCES org_node\(tenant_id, id\)/i
        .test(definition)
    )).toBeTrue();
    expect(constraints.some(({ type, definition }) =>
      type === "u" && /tenant_id.+property_node.+jurisdiction_extension_id.+jurisdiction_owner_tenant_id.+jurisdiction_key.+jurisdiction_version.+jurisdiction_content_hash.+line_id/i
        .test(definition)
    )).toBeTrue();

    const grants = await deploy!<Array<{
      can_select: boolean;
      can_insert: boolean;
      can_update: boolean;
      can_delete: boolean;
    }>>`SELECT
      has_table_privilege('app_role','public.india_gst_item_classification','SELECT') can_select,
      has_table_privilege('app_role','public.india_gst_item_classification','INSERT') can_insert,
      has_table_privilege('app_role','public.india_gst_item_classification','UPDATE') can_update,
      has_table_privilege('app_role','public.india_gst_item_classification','DELETE') can_delete`;
    expect(grants[0]).toEqual({
      can_select: true,
      can_insert: false,
      can_update: false,
      can_delete: false,
    });
  });

  test("P2: every allowed accommodation SAC resolves exact replayable SAC/Y evidence", async () => {
    for (const classificationCode of ALLOWED_SACS) {
      await clearClassifications();
      await seedClassification({ id: CLASSIFICATION_A, classificationCode });
      const target = eligibility();
      const first = await resolveClassification(target);
      const second = await resolveClassification(target);
      expect(first).toEqual(second);
      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
      expect(first).toMatchObject({
        classificationId: CLASSIFICATION_A,
        propertyNode: PROPERTY_A,
        jurisdiction: {
          extensionId: EXTENSION_A,
          ownerTenantId: TENANT_A,
          key: KEY_A,
          version: "7",
          contentHash: HASH_A,
        },
        lineId: "room",
        revenueGroup: "room_revenue",
        classificationSystem: "SAC",
        classificationCode,
        isServiceCode: "Y",
      });
      expect(first.evidenceHash).toBe(expectedEvidenceHash(first));
      expectDeepFrozen(first);
    }
  });

  test("P3: complete frozen jurisdiction, property, classification and tenant must match", async () => {
    const mismatches: readonly ClassificationOptions[] = [
      { propertyNode: PROPERTY_A_OTHER },
      { extensionId: EXTENSION_B },
      { ownerTenantId: null },
      { jurisdictionKey: KEY_B },
      { jurisdictionVersion: 8 },
      { jurisdictionContentHash: HASH_B },
    ];
    for (const mismatch of mismatches) {
      await clearClassifications();
      await seedClassification(mismatch);
      await expect(resolveClassification(eligibility())).rejects
        .toBeInstanceOf(IndiaGstAccommodationClassificationNotFoundError);
    }

    await clearClassifications();
    await seedClassification({ id: CLASSIFICATION_B });
    await expect(resolveClassification(eligibility())).rejects
      .toBeInstanceOf(IndiaGstAccommodationClassificationNotFoundError);

    await clearClassifications();
    await seedClassification({
      tenantId: TENANT_B,
      propertyNode: PROPERTY_B,
      extensionId: EXTENSION_B,
      ownerTenantId: TENANT_B,
      jurisdictionKey: KEY_B,
      jurisdictionVersion: 3,
      jurisdictionContentHash: HASH_B,
      id: CLASSIFICATION_A,
    });
    await expect(resolveClassification(eligibility(), TENANT_A)).rejects
      .toBeInstanceOf(IndiaGstAccommodationClassificationNotFoundError);
  });

  test("P4: exact unique identity and statutory constants reject every defect", async () => {
    await clearClassifications();
    await seedClassification();
    await expectSqlState(seedClassification(), "23505");

    const rejected: readonly ClassificationOptions[] = [
      { jurisdictionVersion: 101, countryCode: "CA" },
      { jurisdictionVersion: 102, lineId: "spa" },
      { jurisdictionVersion: 103, revenueGroup: "spa_revenue" },
      { jurisdictionVersion: 104, classificationSystem: "HSN" },
      { jurisdictionVersion: 105, classificationCode: "123456" },
      { jurisdictionVersion: 106, classificationCode: "99631" },
      { jurisdictionVersion: 107, classificationCode: "996311 " },
      { jurisdictionVersion: 108, isServiceCode: "N" },
    ];
    for (const defect of rejected) {
      await expectSqlState(seedClassification(defect), "23514");
    }
  });

  test("P5: RLS reveals only own tenant and runtime writes remain denied", async () => {
    await clearClassifications();
    const ownId = await seedClassification();
    const foreignId = await seedClassification({
      tenantId: TENANT_B,
      propertyNode: PROPERTY_B,
      extensionId: EXTENSION_B,
      ownerTenantId: TENANT_B,
      jurisdictionKey: KEY_B,
      jurisdictionVersion: 3,
      jurisdictionContentHash: HASH_B,
    });
    const visible = await database!.withTenantTransaction(TENANT_A, (tx) =>
      tx<Array<{ id: string }>>`
        SELECT id::text FROM india_gst_item_classification ORDER BY id`
    );
    expect(visible).toEqual([{ id: ownId }]);
    expect(visible.some(({ id }) => id === foreignId)).toBeFalse();

    await expectSqlState(database!.withTenantTransaction(TENANT_A, (tx) =>
      tx`INSERT INTO india_gst_item_classification(
        tenant_id,property_node,jurisdiction_extension_id,jurisdiction_owner_tenant_id,
        jurisdiction_key,jurisdiction_version,jurisdiction_content_hash,country_code,
        line_id,revenue_group,classification_system,classification_code,is_service_code
      ) VALUES (
        ${TENANT_A}::uuid,${PROPERTY_A}::uuid,${EXTENSION_A}::uuid,${TENANT_A}::uuid,
        ${KEY_A},99,${HASH_A},'IN','room','room_revenue','SAC','996311','Y'
      )`
    ), "42501");
    await expectSqlState(database!.withTenantTransaction(TENANT_A, (tx) =>
      tx`UPDATE india_gst_item_classification SET classification_code='996312'
        WHERE tenant_id=${TENANT_A}::uuid AND id=${ownId}::uuid`
    ), "42501");
    await expectSqlState(database!.withTenantTransaction(TENANT_A, (tx) =>
      tx`DELETE FROM india_gst_item_classification
        WHERE tenant_id=${TENANT_A}::uuid AND id=${ownId}::uuid`
    ), "42501");
  });

  test("P6: commercial and mutable operational truth cannot select or change evidence", async () => {
    await clearClassifications();
    await seedClassification({ id: CLASSIFICATION_A });
    const target = eligibility();
    const before = await resolveClassification(target);

    await deploy!`UPDATE org_node SET
      path='order281a.changed'::ltree,name='996329 HSN goods',currency='CAD',
      config='{"classification":"996329","hsn":"996329","rate_plan":"MAP","tx_code":"GST_ROOM","usali":"rooms"}'::jsonb
      WHERE tenant_id=${TENANT_A}::uuid AND id=${PROPERTY_A}::uuid`;

    const after = await resolveClassification(target);
    expect(after).toEqual(before);
    expect(after.evidenceHash).toBe(before.evidenceHash);
  });

  test("P7: happy, replay and failed reads leave all fiscal/financial truth byte unchanged", async () => {
    await clearClassifications();
    await seedClassification({ id: CLASSIFICATION_A });
    const before = await effects();
    const target = eligibility();
    await resolveClassification(target);
    await resolveClassification(target);
    await expect(resolveClassification(eligibility({ propertyNode: PROPERTY_A_OTHER })))
      .rejects.toThrow();
    await expect(resolveClassification(eligibility({ jurisdictionContentHash: HASH_B })))
      .rejects.toThrow();
    await expect(resolveClassification(eligibility({ country: "CA" })))
      .rejects.toThrow();
    expect(await effects()).toEqual(before);
  });
});
