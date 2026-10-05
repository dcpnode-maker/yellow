import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { SQL } from "bun";

import {
  PositiveTaxSemanticRouteConflictError,
  PositiveTaxSemanticRouteNotFoundError,
  PositiveTaxSemanticRouteService,
  createPositiveTaxAttributionSnapshot,
  type CreatePositiveTaxAttributionSnapshotInput,
  type PositiveTaxFolioEligibilityResult,
} from "../src/contexts/tax-fiscal";
import { Database, type Tx } from "../src/kernel";

setDefaultTimeout(60_000);

const DEPLOY_URL = process.env.YELLOW_DEPLOY_DATABASE_URL;
const RUNTIME_URL = process.env.YELLOW_POSITIVE_TAX_SEMANTIC_ROUTE_URL ??
  process.env.YELLOW_RUNTIME_DATABASE_URL;
if (process.env.YELLOW_REQUIRE_POSITIVE_TAX_SEMANTIC_ROUTE === "1" && (!DEPLOY_URL || !RUNTIME_URL)) {
  throw new Error("Order 259 semantic-route proof requires deploy and runtime database URLs");
}
const databaseDescribe = DEPLOY_URL && RUNTIME_URL ? describe.serial : describe.skip;
const id = (suffix: number): string =>
  `00000000-0000-0000-0000-${String(suffix).padStart(12, "0")}`;

const TENANT_A = id(25901);
const TENANT_B = id(25902);
const PROPERTY_A = id(25911);
const PROPERTY_A_OTHER = id(25912);
const PROPERTY_B = id(25913);
const EXTENSION_A = id(25921);
const EXTENSION_B = id(25922);
const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const EXTENSION_TYPE = "order259_jurisdiction";

interface SnapshotOptions {
  readonly currency?: string;
  readonly country?: string;
  readonly rounding?: "line" | "document";
  readonly taxes?: readonly { readonly code: string; readonly name: string; readonly taxMinor: bigint }[];
  readonly extensionId?: string;
  readonly ownerTenantId?: string | null;
  readonly jurisdictionKey?: string;
  readonly jurisdictionVersion?: number;
  readonly jurisdictionContentHash?: string;
}

interface EligibilityFixture {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly reservationId: string;
  readonly result: PositiveTaxFolioEligibilityResult;
}

interface RouteFixture {
  readonly mappingId: string;
  readonly txCode: string;
  readonly creditAccountId: string;
  readonly semanticCode: string;
}

interface RouteOptions {
  readonly semanticKind: "revenue" | "tax";
  readonly semanticCode: string;
  readonly accountId?: string;
  readonly accountRole?: "revenue" | "tax_payable" | "guest";
  readonly accountStatus?: "open" | "frozen" | "closed";
  readonly accountProperty?: string;
  readonly accountCurrency?: string;
  readonly txGroup?: "revenue" | "tax" | "adjustment";
  readonly usaliLine?: string | null;
  readonly creditAccount?: boolean;
  readonly routeProperty?: string;
  readonly routeCurrency?: string;
  readonly extensionId?: string;
  readonly ownerTenantId?: string | null;
  readonly jurisdictionKey?: string;
  readonly jurisdictionVersion?: number;
  readonly jurisdictionContentHash?: string;
  readonly tenantId?: string;
}

let deploy: SQL | undefined;
let database: Database | undefined;
let sequence = 0;

function snapshotInput(n: number, options: SnapshotOptions = {}): CreatePositiveTaxAttributionSnapshotInput {
  const taxes = options.taxes ?? [{ code: "PST", name: "Provincial sales tax", taxMinor: 500n }];
  const taxTotal = taxes.reduce((total, tax) => total + tax.taxMinor, 0n);
  const businessDate = new Date(Date.UTC(2035, 0, (n % 27) + 1)).toISOString().slice(0, 10);
  const quoteHash = n.toString(16).padStart(64, "c").slice(-64);
  const jurisdictionKey = options.jurisdictionKey ?? `ca.order259.tax.${n}`;
  return {
    origin: { kind: "rate_quote", quoteHash },
    currency: options.currency ?? "CAD",
    line: {
      lineId: "room", revenueGroup: "room_revenue", amountMinor: 10_000n,
      nights: 1, personNights: 2,
      roomNights: [{ businessDate, amountMinor: 10_000n }],
    },
    assignments: [{
      businessDate, jurisdictionKey, evidenceRef: `tax-assignment:${quoteHash}`,
    }],
    jurisdiction: {
      extensionId: options.extensionId ?? EXTENSION_A,
      ownerTenantId: options.ownerTenantId === undefined ? TENANT_A : options.ownerTenantId,
      key: jurisdictionKey,
      version: options.jurisdictionVersion ?? 7,
      contentHash: options.jurisdictionContentHash ?? quoteHash,
      evidenceRef: `tax-jurisdiction:${"d".repeat(64)}`,
    },
    evaluation: {
      schemaVersion: 1,
      jurisdictionKey,
      country: options.country ?? "CA",
      priceDisplay: "tax_exclusive",
      rounding: options.rounding ?? "line",
      inputTotalMinor: 10_000n,
      baseTotalMinor: 10_000n,
      taxTotalMinor: taxTotal,
      grandTotalMinor: 10_000n + taxTotal,
      taxes: taxes.map((tax) => ({
        code: tax.code, name: tax.name, taxMinor: tax.taxMinor,
        components: tax.taxMinor === 0n ? [] : [{
          lineId: "room", revenueGroup: "room_revenue", baseMinor: 10_000n,
          taxMinor: options.rounding === "document" ? null : tax.taxMinor,
          rateBasisPoints: Number(tax.taxMinor),
        }],
      })),
    },
  };
}

function eligibility(options: SnapshotOptions = {}, tenantId = TENANT_A,
  propertyNode = PROPERTY_A): EligibilityFixture {
  const n = ++sequence;
  const snapshot = createPositiveTaxAttributionSnapshot(snapshotInput(n, options));
  return {
    tenantId,
    propertyNode,
    reservationId: crypto.randomUUID(),
    result: Object.freeze({
      lineageId: crypto.randomUUID(), bindingId: crypto.randomUUID(),
      attributionId: crypto.randomUUID(), reservationId: crypto.randomUUID(),
      segmentId: crypto.randomUUID(), folioId: crypto.randomUUID(),
      guestAccountId: crypto.randomUUID(), propertyNode,
      quoteHash: snapshot.origin.quoteHash, snapshotHash: snapshot.snapshotHash,
      currency: snapshot.currency, snapshot,
    }),
  };
}

function resolver(fixture: EligibilityFixture, calls?: { count: number }): PositiveTaxSemanticRouteService {
  return new PositiveTaxSemanticRouteService({
    async resolve(_tx: Tx, input: { tenantId: string; propertyNode: string; reservationId: string }) {
      calls && (calls.count += 1);
      expect(input).toEqual({
        tenantId: fixture.tenantId,
        propertyNode: fixture.propertyNode,
        reservationId: fixture.reservationId,
      });
      return fixture.result;
    },
  });
}

async function resolve(fixture: EligibilityFixture, service = resolver(fixture),
  transactionTenant = fixture.tenantId) {
  return database!.withTenantTransaction(transactionTenant, (tx) => service.resolve(tx, {
    tenantId: fixture.tenantId,
    propertyNode: fixture.propertyNode,
    reservationId: fixture.reservationId,
  }));
}

async function seedRoute(fixture: EligibilityFixture, options: RouteOptions): Promise<RouteFixture> {
  const n = ++sequence;
  const tenantId = options.tenantId ?? fixture.tenantId;
  const mappingId = crypto.randomUUID();
  const accountId = options.accountId ?? crypto.randomUUID();
  const txCode = `O259_${n}`;
  const propertyNode = options.routeProperty ?? fixture.propertyNode;
  const currency = options.routeCurrency ?? fixture.result.currency;
  const expectedRole = options.semanticKind === "revenue" ? "revenue" : "tax_payable";
  await deploy!`INSERT INTO account(
      id,tenant_id,property_node,role,name,currency,status
    ) VALUES (
      ${accountId}::uuid,${tenantId}::uuid,${options.accountProperty ?? propertyNode}::uuid,
      ${options.accountRole ?? expectedRole},${`Order 259 ${n}`},
      ${options.accountCurrency ?? currency}::char(3),${options.accountStatus ?? "open"}
    ) ON CONFLICT (id) DO NOTHING`;
  await deploy!`INSERT INTO tx_code(code,name,grp,usali_line,default_dr,default_cr)
    VALUES (
      ${txCode},${`Order 259 ${options.semanticCode}`},
      ${options.txGroup ?? (options.semanticKind === "revenue" ? "revenue" : "tax")},
      ${options.usaliLine === undefined
        ? (options.semanticKind === "revenue" ? "Rooms" : null)
        : options.usaliLine},
      'guest',${expectedRole}
    )`;
  await deploy!`INSERT INTO tx_code_route(
      tenant_id,property_node,currency,tx_code,debit_account_id,credit_account_id
    ) VALUES (
      ${tenantId}::uuid,${propertyNode}::uuid,${currency}::char(3),${txCode},
      ${options.creditAccount === false ? accountId : null}::uuid,
      ${options.creditAccount === false ? null : accountId}::uuid
    )`;
  await deploy!`INSERT INTO tax_semantic_route(
      tenant_id,id,property_node,currency,jurisdiction_extension_id,
      jurisdiction_owner_tenant_id,jurisdiction_key,jurisdiction_version,
      jurisdiction_content_hash,semantic_kind,semantic_code,tx_code
    ) VALUES (
      ${tenantId}::uuid,${mappingId}::uuid,${propertyNode}::uuid,${currency}::char(3),
      ${options.extensionId ?? fixture.result.snapshot.jurisdiction.extensionId}::uuid,
      ${options.ownerTenantId === undefined
        ? fixture.result.snapshot.jurisdiction.ownerTenantId
        : options.ownerTenantId}::uuid,
      ${options.jurisdictionKey ?? fixture.result.snapshot.jurisdiction.key},
      ${options.jurisdictionVersion ?? fixture.result.snapshot.jurisdiction.version},
      ${options.jurisdictionContentHash ?? fixture.result.snapshot.jurisdiction.contentHash},
      ${options.semanticKind},${options.semanticCode},${txCode}
    )`;
  return { mappingId, txCode, creditAccountId: accountId, semanticCode: options.semanticCode };
}

async function seedResolved(fixture: EligibilityFixture, sharedTaxAccount = false) {
  const revenue = await seedRoute(fixture, { semanticKind: "revenue", semanticCode: "room_revenue" });
  let sharedAccount: string | undefined;
  const taxes: RouteFixture[] = [];
  for (const tax of fixture.result.snapshot.evaluation.taxes) {
    if (BigInt(tax.taxMinor) === 0n) continue;
    sharedAccount ??= sharedTaxAccount ? crypto.randomUUID() : undefined;
    taxes.push(await seedRoute(fixture, {
      semanticKind: "tax", semanticCode: tax.code, accountId: sharedAccount,
    }));
  }
  return { revenue, taxes };
}

function expectDeepFrozen(value: unknown, seen = new Set<object>()): void {
  if (typeof value !== "object" || value === null || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBeTrue();
  for (const key of Reflect.ownKeys(value)) {
    expectDeepFrozen((value as Record<PropertyKey, unknown>)[key], seen);
  }
}

function instrument(tx: Tx, semanticQueries: { count: number }): Tx {
  return new Proxy(tx, {
    apply(target, thisArg, args: unknown[]) {
      const strings = args[0];
      if (Array.isArray(strings) && strings.join(" ").includes("tax_semantic_route")) {
        semanticQueries.count += 1;
      }
      return Reflect.apply(target, thisArg, args);
    },
  }) as Tx;
}

async function effectCounts(): Promise<Record<string, number>> {
  const rows = await deploy!<Array<Record<string, number>>>`SELECT
    (SELECT count(*)::int FROM journal WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) journals,
    (SELECT count(*)::int FROM posting_line WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) postings,
    (SELECT count(*)::int FROM fact_log WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) facts,
    (SELECT count(*)::int FROM outbox WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) events,
    (SELECT count(*)::int FROM api_idempotency WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) idempotency,
    (SELECT count(*)::int FROM document WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) documents,
    (SELECT count(*)::int FROM fiscal_submission WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) submissions`;
  return rows[0]!;
}

async function cleanup(): Promise<void> {
  if (!deploy) return;
  await deploy`DELETE FROM tax_semantic_route WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM tx_code_route WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM account WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM extension WHERE id IN (${EXTENSION_A}::uuid,${EXTENSION_B}::uuid)`;
  await deploy`DELETE FROM tx_code WHERE code LIKE 'O259\_%' ESCAPE '\\'`;
  await deploy`DELETE FROM extension_type WHERE type=${EXTENSION_TYPE}`;
  await deploy`DELETE FROM org_node WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
  await deploy`DELETE FROM tenant WHERE id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)`;
}

test("Order 259 P0: the exact semantic-route export and migration surface exist", async () => {
  expect(typeof PositiveTaxSemanticRouteService).toBe("function");
  const sql = await Bun.file(new URL("../migrations/0043_positive_tax_semantic_route.sql", import.meta.url)).text();
  expect(sql).toContain("CREATE TABLE public.tax_semantic_route");
  expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
  expect(sql).toContain("GRANT SELECT ON TABLE public.tax_semantic_route TO app_role");
});

databaseDescribe("Order 259 exact configured positive-tax semantic routing", () => {
  beforeAll(async () => {
    deploy = new SQL(DEPLOY_URL!, { max: 24, prepare: false });
    database = Database.connect(RUNTIME_URL!, { maxConnections: 24, prepare: false });
    await cleanup();
    await deploy`INSERT INTO tenant(id,slug,name,tier,status) VALUES
      (${TENANT_A}::uuid,'order259-a','Order 259 A','shared','active'),
      (${TENANT_B}::uuid,'order259-b','Order 259 B','shared','active')`;
    await deploy`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES
      (${PROPERTY_A}::uuid,${TENANT_A}::uuid,'order259a.property'::ltree,'property','Order 259 A','UTC','CAD'),
      (${PROPERTY_A_OTHER}::uuid,${TENANT_A}::uuid,'order259a.other'::ltree,'property','Order 259 Other','UTC','CAD'),
      (${PROPERTY_B}::uuid,${TENANT_B}::uuid,'order259b.property'::ltree,'property','Order 259 B','UTC','CAD')`;
    await deploy`INSERT INTO extension_type(type,json_schema)
      VALUES (${EXTENSION_TYPE},'{"type":"object"}'::jsonb)`;
    await deploy`INSERT INTO extension(id,tenant_id,type,key,version,effective,content,status) VALUES
      (${EXTENSION_A}::uuid,${TENANT_A}::uuid,${EXTENSION_TYPE},'ca.order259.tax',7,
       '[2030-01-01 00:00:00+00,)'::tstzrange,'{}'::jsonb,'active'),
      (${EXTENSION_B}::uuid,${TENANT_B}::uuid,${EXTENSION_TYPE},'ca.order259.other',3,
       '[2030-01-01 00:00:00+00,)'::tstzrange,'{}'::jsonb,'active')`;
  });

  afterAll(async () => {
    await cleanup();
    await database?.close();
    await deploy?.close({ timeout: 0 });
  });

  test("P1: exact jurisdiction resolves the revenue route and nonzero tax route", async () => {
    const target = eligibility();
    const routes = await seedResolved(target);
    const result = await resolve(target);
    expect(result.state).toBe("resolved");
    if (result.state !== "resolved") throw new Error("expected resolved semantic routing");
    expect(result.eligibility).toEqual(target.result);
    expect(result.jurisdiction).toEqual({
      extensionId: EXTENSION_A, ownerTenantId: TENANT_A,
      key: target.result.snapshot.jurisdiction.key, version: "7",
      contentHash: target.result.snapshot.jurisdiction.contentHash,
    });
    expect(result.revenueRoute).toEqual({
      mappingId: routes.revenue.mappingId, semanticCode: "room_revenue",
      txCode: routes.revenue.txCode, creditAccountId: routes.revenue.creditAccountId,
    });
    expect(result.taxRoutes).toEqual([{
      taxIndex: "0", taxCode: "PST", mappingId: routes.taxes[0]!.mappingId,
      txCode: routes.taxes[0]!.txCode, creditAccountId: routes.taxes[0]!.creditAccountId,
    }]);
  });

  test("P2: zero tax needs no tax mapping; multiple taxes retain canonical order and may share an account", async () => {
    const zero = eligibility({ taxes: [{ code: "ZERO", name: "Zero tax", taxMinor: 0n }] });
    const zeroRoutes = await seedResolved(zero);
    const zeroResult = await resolve(zero);
    expect(zeroRoutes.taxes).toEqual([]);
    expect(zeroResult.state).toBe("resolved");
    if (zeroResult.state === "resolved") expect(zeroResult.taxRoutes).toEqual([]);

    const multiple = eligibility({ taxes: [
      { code: "PST", name: "Provincial tax", taxMinor: 700n },
      { code: "QST", name: "Quebec tax", taxMinor: 900n },
    ] });
    const routes = await seedResolved(multiple, true);
    const result = await resolve(multiple);
    expect(result.state).toBe("resolved");
    if (result.state !== "resolved") throw new Error("expected resolved semantic routing");
    expect(result.taxRoutes.map(({ taxIndex, taxCode, creditAccountId }) =>
      ({ taxIndex, taxCode, creditAccountId }))).toEqual([
      { taxIndex: "0", taxCode: "PST", creditAccountId: routes.taxes[0]!.creditAccountId },
      { taxIndex: "1", taxCode: "QST", creditAccountId: routes.taxes[1]!.creditAccountId },
    ]);
    expect(routes.taxes[0]!.creditAccountId).toBe(routes.taxes[1]!.creditAccountId);
  });

  test("P3: missing exact mappings never fall back to names, USALI, defaults or generic tax codes", async () => {
    for (const code of ["ROOM", "TAX", "GST", "VAT"]) {
      const n = ++sequence;
      const accountId = crypto.randomUUID();
      await deploy!`INSERT INTO account(id,tenant_id,property_node,role,name,currency,status)
        VALUES (${accountId}::uuid,${TENANT_A}::uuid,${PROPERTY_A}::uuid,
          ${code === "ROOM" ? "revenue" : "tax_payable"},${`Tempting ${code}`},'CAD','open')`;
      await deploy!`INSERT INTO tx_code(code,name,grp,usali_line,default_dr,default_cr)
        VALUES (${`O259_${code}_${n}`},${`${code} fallback`},
          ${code === "ROOM" ? "revenue" : "tax"},${code === "ROOM" ? "Rooms" : "Taxes"},
          'guest',${code === "ROOM" ? "revenue" : "tax_payable"})`;
      await deploy!`INSERT INTO tx_code_route(tenant_id,property_node,currency,tx_code,credit_account_id)
        VALUES (${TENANT_A}::uuid,${PROPERTY_A}::uuid,'CAD',${`O259_${code}_${n}`},${accountId}::uuid)`;
    }
    const target = eligibility();
    await expect(resolve(target)).rejects.toBeInstanceOf(PositiveTaxSemanticRouteNotFoundError);
    await seedRoute(target, { semanticKind: "revenue", semanticCode: "room_revenue" });
    await expect(resolve(target)).rejects.toBeInstanceOf(PositiveTaxSemanticRouteNotFoundError);
  });

  test("P4: mismatched group, USALI, account side/role/status/property/currency fail closed", async () => {
    const cases: readonly RouteOptions[] = [
      { semanticKind: "revenue", semanticCode: "room_revenue", txGroup: "adjustment" },
      { semanticKind: "revenue", semanticCode: "room_revenue", usaliLine: "" },
      { semanticKind: "revenue", semanticCode: "room_revenue", creditAccount: false },
      { semanticKind: "revenue", semanticCode: "room_revenue", accountRole: "guest" },
      { semanticKind: "revenue", semanticCode: "room_revenue", accountStatus: "frozen" },
    ];
    for (const bad of cases) {
      const target = eligibility({ taxes: [{ code: "ZERO", name: "Zero", taxMinor: 0n }] });
      await seedRoute(target, bad);
      await expect(resolve(target)).rejects.toBeInstanceOf(PositiveTaxSemanticRouteConflictError);
    }

    for (const bad of [
      { txGroup: "revenue" as const },
      { accountRole: "revenue" as const },
      { accountStatus: "closed" as const },
      { creditAccount: false },
    ]) {
      const target = eligibility();
      await seedRoute(target, { semanticKind: "revenue", semanticCode: "room_revenue" });
      await seedRoute(target, { semanticKind: "tax", semanticCode: "PST", ...bad });
      await expect(resolve(target)).rejects.toBeInstanceOf(PositiveTaxSemanticRouteConflictError);
    }

  }, 30_000);

  test("P5: property, currency, complete jurisdiction identity, tenant and RLS mismatches are unavailable", async () => {
    const mismatches: readonly Partial<RouteOptions>[] = [
      { routeProperty: PROPERTY_A_OTHER },
      { routeCurrency: "USD" },
      { extensionId: EXTENSION_B },
      { ownerTenantId: null },
      { jurisdictionKey: "ca.order259.other" },
      { jurisdictionVersion: 8 },
      { jurisdictionContentHash: HASH_B },
    ];
    for (const mismatch of mismatches) {
      const target = eligibility({ taxes: [{ code: "ZERO", name: "Zero", taxMinor: 0n }] });
      await seedRoute(target, {
        semanticKind: "revenue", semanticCode: "room_revenue", ...mismatch,
      });
      await expect(resolve(target)).rejects.toBeInstanceOf(PositiveTaxSemanticRouteNotFoundError);
    }

    const foreign = eligibility({ taxes: [{ code: "ZERO", name: "Zero", taxMinor: 0n }],
      extensionId: EXTENSION_B, ownerTenantId: TENANT_B, jurisdictionKey: "ca.order259.other",
      jurisdictionVersion: 3, jurisdictionContentHash: HASH_B }, TENANT_B, PROPERTY_B);
    await seedRoute(foreign, { semanticKind: "revenue", semanticCode: "room_revenue" });
    const visible = await database!.withTenantTransaction(TENANT_A, (tx) =>
      tx<Array<{ count: number }>>`SELECT count(*)::int count FROM tax_semantic_route
        WHERE tenant_id=${TENANT_B}::uuid`);
    expect(visible).toEqual([{ count: 0 }]);
    await expect(resolve(foreign, resolver(foreign), TENANT_A))
      .rejects.toBeInstanceOf(PositiveTaxSemanticRouteNotFoundError);
  }, 30_000);

  test("P6: policy blockers preserve exact order and perform zero semantic lookup", async () => {
    const target = eligibility({
      country: "IN", rounding: "document",
      taxes: [{ code: "IGST", name: "Integrated GST", taxMinor: 1_800n }],
    });
    const service = resolver(target);
    const semanticQueries = { count: 0 };
    const result = await database!.withTenantTransaction(TENANT_A, (tx) => service.resolve(
      instrument(tx, semanticQueries), {
        tenantId: target.tenantId, propertyNode: target.propertyNode,
        reservationId: target.reservationId,
      }));
    expect(result.state).toBe("policy_blocked");
    expect(result.plan.blockers).toEqual([
      "document_tax_allocation_required",
      "india_place_of_supply_decomposition_required",
    ]);
    expect(semanticQueries.count).toBe(0);
  });

  test("P7: repeat resolution is byte-equivalent, recursively frozen and effect-free", async () => {
    const target = eligibility();
    await seedResolved(target);
    const before = await effectCounts();
    const first = await resolve(target);
    const second = await resolve(target);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    expect(second).not.toBe(first);
    expectDeepFrozen(first);
    expectDeepFrozen(second);
    expect(await effectCounts()).toEqual(before);
  });

  test("P7: schema, constraints, indexes and ACL expose an RLS-protected read-only root", async () => {
    const columns = await deploy!<Array<{ column_name: string; is_nullable: string }>>`
      SELECT column_name,is_nullable FROM information_schema.columns
      WHERE table_schema='public' AND table_name='tax_semantic_route'
      ORDER BY ordinal_position`;
    expect(columns.map((row) => row.column_name)).toEqual([
      "tenant_id", "id", "property_node", "currency", "jurisdiction_extension_id",
      "jurisdiction_owner_tenant_id", "jurisdiction_key", "jurisdiction_version",
      "jurisdiction_content_hash", "semantic_kind", "semantic_code", "tx_code",
    ]);
    expect(columns.filter((row) => row.is_nullable === "YES").map((row) => row.column_name))
      .toEqual(["jurisdiction_owner_tenant_id"]);

    const schema = await deploy!<Array<{
      rls: boolean; constraints: string[]; indexes: string[];
      app_select: boolean; app_insert: boolean; app_update: boolean; app_delete: boolean;
    }>>`SELECT
      c.relrowsecurity rls,
      ARRAY(SELECT conname FROM pg_constraint WHERE conrelid='public.tax_semantic_route'::regclass
        ORDER BY conname) constraints,
      ARRAY(SELECT indexdef FROM pg_indexes WHERE schemaname='public'
        AND tablename='tax_semantic_route' ORDER BY indexname) indexes,
      has_table_privilege('app_role','public.tax_semantic_route','SELECT') app_select,
      has_table_privilege('app_role','public.tax_semantic_route','INSERT') app_insert,
      has_table_privilege('app_role','public.tax_semantic_route','UPDATE') app_update,
      has_table_privilege('app_role','public.tax_semantic_route','DELETE') app_delete
      FROM pg_class c WHERE c.oid='public.tax_semantic_route'::regclass`;
    expect(schema[0]!.rls).toBeTrue();
    expect(schema[0]!.constraints).toEqual([
      "tax_semantic_route_configured_route_fk", "tax_semantic_route_currency_ck",
      "tax_semantic_route_extension_fk", "tax_semantic_route_identity_uq",
      "tax_semantic_route_jurisdiction_hash_ck", "tax_semantic_route_jurisdiction_key_ck",
      "tax_semantic_route_jurisdiction_owner_ck", "tax_semantic_route_jurisdiction_version_ck",
      "tax_semantic_route_pk", "tax_semantic_route_property_fk",
      "tax_semantic_route_semantic_ck", "tax_semantic_route_tx_code_fk",
    ]);
    expect(schema[0]!.indexes.every((definition) =>
      definition.includes("(tenant_id,"))).toBeTrue();
    expect(schema[0]!.indexes.some((definition) =>
      definition.includes("UNIQUE") && definition.includes("NULLS NOT DISTINCT"))).toBeTrue();
    expect(schema[0]!.indexes.some((definition) =>
      definition.includes("property_node") && definition.includes("semantic_kind"))).toBeTrue();
    expect(schema[0]).toMatchObject({
      app_select: true, app_insert: false, app_update: false, app_delete: false,
    });

    await expect(database!.withTenantTransaction(TENANT_A, (tx) =>
      tx`INSERT INTO tax_semantic_route(
          tenant_id,id,property_node,currency,jurisdiction_extension_id,
          jurisdiction_owner_tenant_id,jurisdiction_key,jurisdiction_version,
          jurisdiction_content_hash,semantic_kind,semantic_code,tx_code
        ) VALUES (
          ${TENANT_A}::uuid,${crypto.randomUUID()}::uuid,${PROPERTY_A}::uuid,'CAD',
          ${EXTENSION_A}::uuid,${TENANT_A}::uuid,'ca.order259.tax',7,${HASH_A},
          'revenue','room_revenue','not-authorized'
        )`)).rejects.toMatchObject({ errno: "42501" });
  });
});
