import { describe, expect, test } from "bun:test";

import {
  IndiaGstAccommodationServiceProvisionDateConflictError,
  IndiaGstAccommodationServiceProvisionDateNotFoundError,
  IndiaGstAccommodationServiceProvisionDateService,
  IndiaGstAccommodationServiceProvisionDateValidationError,
  createPositiveTaxAttributionSnapshot,
  type CreatePositiveTaxAttributionSnapshotInput,
} from "../src/contexts/tax-fiscal";
import type { Tx } from "../src/kernel";

const id = (suffix: number): string =>
  `00000000-0000-0000-0000-${String(suffix).padStart(12, "0")}`;
const hash = (value: unknown): string =>
  new Bun.CryptoHasher("sha256").update(JSON.stringify(value)).digest("hex");

const TENANT = id(29001);
const TENANT_B = id(29002);
const PROPERTY = id(29003);
const PROPERTY_B = id(29004);
const RESERVATION = id(29005);
const LINEAGE = id(29006);
const HOLD_BINDING = id(29007);
const ATTRIBUTION = id(29008);
const SEGMENT = id(29009);
const SERVICE_ROOT = id(29010);
const EXTENSION = id(29011);
const SERVICE_DATE = "2043-06-17";
const QUOTE_HASH = "a".repeat(64);
const SERVICE_EVIDENCE = "b".repeat(64);
const LEGAL_RULE = "CGST_ACT_13_2_B_SERVICE_PROVISION_DATE_INPUT_ONLY";

type Mutable = Record<PropertyKey, unknown>;
interface ServiceProvisionRow {
  readonly tenant_id: string;
  readonly id: string;
  readonly property_node: string;
  readonly reservation_lineage_id: string;
  readonly hold_binding_id: string;
  readonly attribution_id: string;
  readonly reservation_id: string;
  readonly segment_id: string;
  readonly origin_quote_hash: string;
  readonly snapshot_hash: string;
  readonly currency: string;
  readonly service_provision_date: string;
  readonly service_provision_source: string;
  readonly service_provision_evidence_sha256: string;
  readonly legal_rule: string;
  readonly lineage_id: string;
  readonly lineage_property_node: string;
  readonly lineage_hold_binding_id: string;
  readonly lineage_attribution_id: string;
  readonly lineage_reservation_id: string;
  readonly lineage_segment_id: string;
  readonly lineage_origin_quote_hash: string;
  readonly lineage_snapshot_hash: string;
  readonly lineage_currency: string;
  readonly attribution_snapshot: unknown;
}

function snapshotInput(
  businessDate = "2039-01-01",
  overrides: Partial<CreatePositiveTaxAttributionSnapshotInput> = {},
): CreatePositiveTaxAttributionSnapshotInput {
  return {
    origin: { kind: "rate_quote", quoteHash: QUOTE_HASH },
    currency: "INR",
    line: {
      lineId: "room", revenueGroup: "room_revenue", amountMinor: 10_000n,
      nights: 1, personNights: 2,
      roomNights: [{ businessDate, amountMinor: 10_000n }],
    },
    assignments: [{
      businessDate,
      jurisdictionKey: "in.order290.gst.27",
      evidenceRef: `tax-assignment:${QUOTE_HASH}`,
    }],
    jurisdiction: {
      extensionId: EXTENSION,
      ownerTenantId: TENANT,
      key: "in.order290.gst.27",
      version: 7,
      contentHash: "c".repeat(64),
      evidenceRef: `tax-jurisdiction:${"d".repeat(64)}`,
    },
    evaluation: {
      schemaVersion: 1,
      jurisdictionKey: "in.order290.gst.27",
      country: "IN",
      priceDisplay: "tax_exclusive",
      rounding: "line",
      inputTotalMinor: 10_000n,
      baseTotalMinor: 10_000n,
      taxTotalMinor: 500n,
      grandTotalMinor: 10_500n,
      taxes: [{
        code: "GST_ROOM", name: "Aggregate GST evidence", taxMinor: 500n,
        components: [{
          lineId: "room", revenueGroup: "room_revenue", baseMinor: 10_000n,
          taxMinor: 500n, rateBasisPoints: 500,
        }],
      }],
    },
    ...overrides,
  };
}

function snapshot(businessDate = "2039-01-01") {
  return createPositiveTaxAttributionSnapshot(snapshotInput(businessDate));
}

function input(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: TENANT,
    propertyNode: PROPERTY,
    reservationId: RESERVATION,
    serviceProvisionSnapshotId: SERVICE_ROOT,
    serviceProvisionDate: SERVICE_DATE,
    ...overrides,
  };
}

function row(
  overrides: Partial<ServiceProvisionRow> = {},
  attributionSnapshot = snapshot(),
): ServiceProvisionRow {
  return {
    tenant_id: TENANT,
    id: SERVICE_ROOT,
    property_node: PROPERTY,
    reservation_lineage_id: LINEAGE,
    hold_binding_id: HOLD_BINDING,
    attribution_id: ATTRIBUTION,
    reservation_id: RESERVATION,
    segment_id: SEGMENT,
    origin_quote_hash: attributionSnapshot.origin.quoteHash,
    snapshot_hash: attributionSnapshot.snapshotHash,
    currency: attributionSnapshot.currency,
    service_provision_date: SERVICE_DATE,
    service_provision_source: "governed_service_provision_record",
    service_provision_evidence_sha256: SERVICE_EVIDENCE,
    legal_rule: LEGAL_RULE,
    lineage_id: LINEAGE,
    lineage_property_node: PROPERTY,
    lineage_hold_binding_id: HOLD_BINDING,
    lineage_attribution_id: ATTRIBUTION,
    lineage_reservation_id: RESERVATION,
    lineage_segment_id: SEGMENT,
    lineage_origin_quote_hash: attributionSnapshot.origin.quoteHash,
    lineage_snapshot_hash: attributionSnapshot.snapshotHash,
    lineage_currency: attributionSnapshot.currency,
    attribution_snapshot: attributionSnapshot,
    ...overrides,
  };
}

function fakeTx(rows: readonly ServiceProvisionRow[], statements: string[] = []): Tx {
  return (async (strings: TemplateStringsArray) => {
    statements.push(strings.join("?"));
    return rows;
  }) as unknown as Tx;
}

function expectedBody(source = row()) {
  return {
    serviceProvisionSnapshotId: SERVICE_ROOT,
    propertyNode: PROPERTY,
    reservationLineage: {
      lineageId: LINEAGE,
      holdBindingId: HOLD_BINDING,
      attributionId: ATTRIBUTION,
      reservationId: RESERVATION,
      segmentId: SEGMENT,
      originQuoteHash: source.origin_quote_hash,
      snapshotHash: source.snapshot_hash,
      currency: "INR",
    },
    attribution: {
      originKind: "rate_quote" as const,
      lineId: "room" as const,
      revenueGroup: "room_revenue" as const,
    },
    serviceProvisionDate: SERVICE_DATE,
    serviceProvisionSource: "governed_service_provision_record" as const,
    serviceProvisionEvidenceSha256: SERVICE_EVIDENCE,
    legalRule: LEGAL_RULE as typeof LEGAL_RULE,
  };
}

function expectDeepFrozen(value: unknown, seen = new Set<object>()): void {
  if (typeof value !== "object" || value === null || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBeTrue();
  for (const key of Reflect.ownKeys(value)) {
    expectDeepFrozen((value as Mutable)[key], seen);
  }
}

test("Order 290 P0: exact migration and resolver surface exist", async () => {
  expect(typeof IndiaGstAccommodationServiceProvisionDateService).toBe("function");
  const sql = await Bun.file(new URL(
    "../migrations/0056_india_gst_accommodation_service_provision_date.sql",
    import.meta.url,
  )).text();
  expect(sql).toContain(
    "CREATE TABLE public.india_gst_accommodation_service_provision_snapshot",
  );
  expect(sql).toContain("property_node, hold_binding_id");
  expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
  expect(sql).toContain("FORCE ROW LEVEL SECURITY");
  expect(sql).toMatch(/GRANT\s+SELECT[\s\S]*service_provision_snapshot[\s\S]*TO\s+app_role/i);
  expect(sql).not.toMatch(/CREATE\s+INDEX[\s\S]*(?:room.?night|business.?date)/i);
});

test("Order 290 P1: explicit service date resolves canonical frozen evidence and exact replay", async () => {
  const stored = row();
  const selected = input();
  const before = JSON.stringify({ stored, selected });
  const service = new IndiaGstAccommodationServiceProvisionDateService();
  const first = await service.resolve(fakeTx([stored]), selected);
  const replay = await service.resolve(fakeTx([stored]), selected);
  const body = expectedBody(stored);
  expect(first).toEqual({
    ...body,
    evidenceHash: hash({ tenantId: TENANT, ...body }),
  });
  expect(first).toEqual(replay);
  expect(Object.keys(first)).toEqual([
    "serviceProvisionSnapshotId", "propertyNode", "reservationLineage", "attribution",
    "serviceProvisionDate", "serviceProvisionSource",
    "serviceProvisionEvidenceSha256", "legalRule", "evidenceHash",
  ]);
  expect(Object.keys(first.reservationLineage)).toEqual([
    "lineageId", "holdBindingId", "attributionId", "reservationId", "segmentId",
    "originQuoteHash", "snapshotHash", "currency",
  ]);
  expect(Object.keys(first.attribution)).toEqual([
    "originKind", "lineId", "revenueGroup",
  ]);
  expect(first).not.toHaveProperty("tenantId");
  expectDeepFrozen(first);
  expect(JSON.stringify({ stored, selected })).toBe(before);
});

test("Order 290 P2: exact five-key accessor/proxy/symbol-free input rejects ambiguity before SQL", async () => {
  const exact = input();
  const hostile: unknown[] = [
    null, [], new Proxy({ ...exact }, {}),
    Object.assign(Object.create({ inherited: true }), exact), { ...exact, extra: true },
  ];
  for (const key of Object.keys(exact)) {
    const missing = { ...exact } as Mutable;
    delete missing[key];
    hostile.push(missing);
  }
  for (const key of [
    "tenantId", "propertyNode", "reservationId", "serviceProvisionSnapshotId",
  ]) hostile.push({ ...exact, [key]: "not-a-uuid" });
  for (const date of [
    "", "2043-6-17", "2043-02-29", "2100-02-29", "2043-06-17Z", "0000-01-01",
  ]) hostile.push({ ...exact, serviceProvisionDate: date });
  const accessor = { ...exact } as Mutable;
  Object.defineProperty(accessor, "serviceProvisionDate", {
    enumerable: true, get: () => SERVICE_DATE,
  });
  hostile.push(accessor);
  const symbolic = { ...exact } as Mutable;
  symbolic[Symbol("hidden")] = true;
  hostile.push(symbolic);
  for (const candidate of hostile) {
    let calls = 0;
    const tx = (async () => { calls += 1; return []; }) as unknown as Tx;
    await expect(new IndiaGstAccommodationServiceProvisionDateService()
      .resolve(tx, candidate as never)).rejects
      .toBeInstanceOf(IndiaGstAccommodationServiceProvisionDateValidationError);
    expect(calls).toBe(0);
  }
  await expect(new IndiaGstAccommodationServiceProvisionDateService()
    .resolve(null as never, exact)).rejects
    .toBeInstanceOf(IndiaGstAccommodationServiceProvisionDateValidationError);
});

test("Order 290 P3: exact twenty-five-field joined row rejects shape and canonical lineage drift", async () => {
  const pristine = row();
  const hostile: unknown[] = [
    { ...pristine, extra: true }, new Proxy({ ...pristine }, {}),
  ];
  for (const key of Object.keys(pristine)) {
    const missing = { ...pristine } as Mutable;
    delete missing[key];
    hostile.push(missing);
  }
  const accessor = { ...pristine } as Mutable;
  Object.defineProperty(accessor, "service_provision_date", {
    enumerable: true, get: () => SERVICE_DATE,
  });
  hostile.push(accessor);
  const symbolic = { ...pristine } as Mutable;
  symbolic[Symbol("hidden")] = true;
  hostile.push(symbolic);
  for (const candidate of hostile) {
    await expect(new IndiaGstAccommodationServiceProvisionDateService()
      .resolve(fakeTx([candidate as ServiceProvisionRow]), input())).rejects
      .toBeInstanceOf(IndiaGstAccommodationServiceProvisionDateConflictError);
  }

  const defects: readonly Partial<ServiceProvisionRow>[] = [
    { tenant_id: TENANT_B }, { id: id(29091) }, { property_node: PROPERTY_B },
    { reservation_lineage_id: id(29092) }, { hold_binding_id: id(29093) },
    { attribution_id: id(29094) }, { reservation_id: id(29095) },
    { segment_id: id(29096) }, { origin_quote_hash: "9".repeat(64) },
    { snapshot_hash: "8".repeat(64) }, { currency: "CAD" },
    { service_provision_date: "2043-06-18" },
    { service_provision_source: "property_profile" },
    { service_provision_evidence_sha256: "B".repeat(64) },
    { legal_rule: "CGST_ACT_13" }, { lineage_id: id(29097) },
    { lineage_property_node: PROPERTY_B }, { lineage_hold_binding_id: id(29098) },
    { lineage_attribution_id: id(29099) }, { lineage_reservation_id: id(29100) },
    { lineage_segment_id: id(29101) },
    { lineage_origin_quote_hash: "7".repeat(64) },
    { lineage_snapshot_hash: "6".repeat(64) }, { lineage_currency: "USD" },
  ];
  for (const defect of defects) {
    await expect(new IndiaGstAccommodationServiceProvisionDateService()
      .resolve(fakeTx([row(defect)]), input())).rejects
      .toBeInstanceOf(IndiaGstAccommodationServiceProvisionDateConflictError);
  }
});

test("Order 290 P4: missing, duplicate and hostile canonical Order240 attribution fail closed", async () => {
  const service = new IndiaGstAccommodationServiceProvisionDateService();
  await expect(service.resolve(fakeTx([]), input())).rejects
    .toBeInstanceOf(IndiaGstAccommodationServiceProvisionDateNotFoundError);
  await expect(service.resolve(fakeTx([row(), row()]), input())).rejects
    .toBeInstanceOf(IndiaGstAccommodationServiceProvisionDateConflictError);

  const valid = snapshot();
  const malformed: unknown[] = [
    null, [], { ...valid, extra: true },
    { ...valid, snapshotHash: "9".repeat(64) },
    { ...valid, origin: { ...valid.origin, quoteHash: "8".repeat(64) } },
    { ...valid, currency: "CAD" },
    { ...valid, revenueLine: { ...valid.revenueLine, lineId: "spa" } },
    { ...valid, revenueLine: { ...valid.revenueLine, revenueGroup: "spa_revenue" } },
  ];
  for (const candidate of malformed) {
    await expect(service.resolve(
      fakeTx([row({ attribution_snapshot: candidate })]), input(),
    )).rejects.toBeInstanceOf(IndiaGstAccommodationServiceProvisionDateConflictError);
  }
});

test("Order 290 P5: equality-only SQL binds every root and reparses complete lineage without writes", async () => {
  const statements: string[] = [];
  await new IndiaGstAccommodationServiceProvisionDateService()
    .resolve(fakeTx([row()], statements), input());
  expect(statements).toHaveLength(1);
  const sql = statements[0]!;
  for (const table of [
    "public.india_gst_accommodation_service_provision_snapshot",
    "public.tax_attribution_reservation_binding",
    "public.tax_attribution_snapshot",
  ]) expect(sql).toContain(table);
  expect(sql).toContain("current_setting('app.tenant_id', true)");
  for (const predicate of [
    "service_date.tenant_id", "service_date.id", "service_date.property_node",
    "service_date.reservation_id", "service_date.service_provision_date",
    "service_date.reservation_lineage_id", "service_date.hold_binding_id",
    "service_date.attribution_id", "service_date.segment_id",
    "service_date.origin_quote_hash", "service_date.snapshot_hash",
    "service_date.currency",
  ]) expect(sql).toContain(predicate);
  expect(sql).not.toMatch(/ORDER BY|LIMIT|latest|nearest|current_date|now\s*\(/i);
  expect(sql).not.toMatch(
    /\b(?:INSERT\s+INTO|UPDATE\s+public\.|DELETE\s+FROM|TRUNCATE|LOCK|FOR\s+UPDATE|FOR\s+SHARE)\b/i,
  );
});

test("Order 290 P6: service date is independent of room-night, reservation and operational/posting dates", async () => {
  const service = new IndiaGstAccommodationServiceProvisionDateService();
  for (const roomNightDate of ["2032-01-01", "2043-06-16", "2043-06-18", "2099-12-31"]) {
    const attribution = snapshot(roomNightDate);
    const selected = row({}, attribution);
    const result = await service.resolve(fakeTx([selected]), input());
    expect(result.serviceProvisionDate).toBe(SERVICE_DATE);
    expect(result.reservationLineage.snapshotHash).toBe(attribution.snapshotHash);
  }
  const statements: string[] = [];
  await service.resolve(fakeTx([row()], statements), input());
  expect(statements[0]).not.toMatch(
    /india_accommodation_supply_nature|supply_date|room_nights|business_date|\.period|reservation_segment|arrival|departure|check.?in|occupancy|checkout|journal|posting/i,
  );
});

test("Order 290 P7: static containment excludes clocks, network and downstream statutory authority", async () => {
  const source = await Bun.file(new URL(
    "../src/contexts/tax-fiscal/india-gst-accommodation-service-provision-date.ts",
    import.meta.url,
  )).text();
  expect(source).not.toMatch(/latest|nearest|current_date|Date\.now|new Date/i);
  expect(source).not.toMatch(/fetch\s*\(|https?:|Elysia|app\.(?:get|post|put|delete)/i);
  expect(source).not.toMatch(/india.?gst.?supplier.?registration.?status|letter.?of.?approval|form.?f2/i);
  expect(source).not.toMatch(/time.?of.?supply|section.?14|authorized.?operations|specified.?officer/i);
  expect(source).not.toMatch(/zero.?rat|refund|BLUT|SupTyp|IgstOnIntra|invoice|payment|receipt|document|submission/i);
  expect(source).not.toMatch(
    /\b(?:INSERT\s+INTO|UPDATE\s+public\.|DELETE\s+FROM|TRUNCATE|journal|posting|outbox)\b/i,
  );
  expect(source).toContain(LEGAL_RULE);
});

const databaseDescribe = process.env.YELLOW_ORDER290_DATABASE_URL
  ? describe.serial
  : describe.skip;

databaseDescribe("Order 290 isolated PostgreSQL RLS/ACL and zero-write proof", () => {
  test("P8: exact fifteen-column catalogue is forced-RLS, SELECT-only and tenant isolated", async () => {
    const { SQL } = await import("bun");
    const deployUrl = process.env.YELLOW_DEPLOY_DATABASE_URL;
    const runtimeUrl = process.env.YELLOW_ORDER290_DATABASE_URL;
    if (!deployUrl || !runtimeUrl) throw new Error("isolated deploy/runtime URLs required");
    const deploy = new SQL(deployUrl, { max: 1 });
    const runtime = new SQL(runtimeUrl, { max: 1 });
    try {
      const columns = await deploy<Array<{ column_name: string }>>`
        SELECT column_name FROM information_schema.columns
         WHERE table_schema='public'
           AND table_name='india_gst_accommodation_service_provision_snapshot'
         ORDER BY ordinal_position`;
      expect(columns.map(({ column_name }) => column_name)).toEqual([
        "tenant_id", "id", "property_node", "reservation_lineage_id",
        "hold_binding_id", "attribution_id", "reservation_id", "segment_id",
        "origin_quote_hash", "snapshot_hash", "currency", "service_provision_date",
        "service_provision_source", "service_provision_evidence_sha256", "legal_rule",
      ]);
      const acl = await deploy<Array<Record<string, boolean>>>`
        SELECT
          has_table_privilege('app_role','public.india_gst_accommodation_service_provision_snapshot','SELECT') select_ok,
          has_table_privilege('app_role','public.india_gst_accommodation_service_provision_snapshot','INSERT') insert_ok,
          has_table_privilege('app_role','public.india_gst_accommodation_service_provision_snapshot','UPDATE') update_ok,
          has_table_privilege('app_role','public.india_gst_accommodation_service_provision_snapshot','DELETE') delete_ok,
          has_table_privilege('app_role','public.india_gst_accommodation_service_provision_snapshot','TRUNCATE') truncate_ok`;
      expect(acl[0]).toEqual({
        select_ok: true, insert_ok: false, update_ok: false,
        delete_ok: false, truncate_ok: false,
      });
      const rls = await deploy<Array<{
        relrowsecurity: boolean; relforcerowsecurity: boolean;
      }>>`SELECT relrowsecurity,relforcerowsecurity FROM pg_catalog.pg_class
         WHERE oid='public.india_gst_accommodation_service_provision_snapshot'::regclass`;
      expect(rls).toEqual([{ relrowsecurity: true, relforcerowsecurity: true }]);

      await runtime.begin(async (tx) => {
        await tx.unsafe("SET LOCAL ROLE app_role");
        await tx`SELECT set_config('app.tenant_id',${TENANT},true)`;
        expect(await tx<Array<{ count: number }>>`
          SELECT count(*)::int count
            FROM public.india_gst_accommodation_service_provision_snapshot`
        ).toEqual([{ count: 0 }]);
      });
      for (const mutate of ["INSERT", "UPDATE", "DELETE", "TRUNCATE"] as const) {
        let state: unknown;
        try {
          await runtime.begin(async (tx) => {
            await tx.unsafe("SET LOCAL ROLE app_role");
            await tx`SELECT set_config('app.tenant_id',${TENANT},true)`;
            if (mutate === "INSERT") await tx.unsafe(
              "INSERT INTO public.india_gst_accommodation_service_provision_snapshot DEFAULT VALUES",
            );
            if (mutate === "UPDATE") await tx.unsafe(
              "UPDATE public.india_gst_accommodation_service_provision_snapshot SET service_provision_date=service_provision_date WHERE false",
            );
            if (mutate === "DELETE") await tx.unsafe(
              "DELETE FROM public.india_gst_accommodation_service_provision_snapshot WHERE false",
            );
            if (mutate === "TRUNCATE") await tx.unsafe(
              "TRUNCATE public.india_gst_accommodation_service_provision_snapshot",
            );
          });
        } catch (error) {
          state = (error as { errno?: unknown }).errno;
        }
        expect(state).toBe("42501");
      }
    } finally {
      await Promise.all([deploy.close(), runtime.close()]);
    }
  }, 30_000);
});
