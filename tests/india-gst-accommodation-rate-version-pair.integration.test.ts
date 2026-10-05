import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { SQL } from "bun";

import {
  IndiaGstAccommodationRateVersionPairService,
  TaxJurisdictionResolutionService,
} from "../src/contexts/tax-fiscal";
import { Database, ExtensionRegistry } from "../src/kernel";

setDefaultTimeout(60_000);

const DEPLOY_URL = process.env.YELLOW_ORDER304_DEPLOY_DATABASE_URL ??
  process.env.YELLOW_DEPLOY_DATABASE_URL;
const RUNTIME_URL = process.env.YELLOW_ORDER304_DATABASE_URL ??
  process.env.YELLOW_RUNTIME_DATABASE_URL;
if (process.env.YELLOW_REQUIRE_ORDER304_DATABASE === "1" && (!DEPLOY_URL || !RUNTIME_URL)) {
  throw new Error("Order 304 live proof requires deploy and runtime database URLs");
}
const live = DEPLOY_URL && RUNTIME_URL ? describe.serial : describe.skip;

const id = (suffix: number): string =>
  `00000000-0000-0000-0000-${String(suffix).padStart(12, "0")}`;

const TENANT_A = id(30401);
const TENANT_B = id(30402);
const PROPERTY_A = id(30411);
const PROPERTY_B = id(30412);
const PREDECESSOR_A = id(30421);
const SUCCESSOR_A = id(30422);
const FOREIGN_PREDECESSOR = id(30431);
const FOREIGN_SUCCESSOR = id(30432);
const KEY = "in-gst-lodging";
const CUTOVER = "2025-09-21T18:30:00.000000Z";
const PREDECESSOR_FROM = "2022-07-17T18:30:00.000000Z";
const SOURCE_2019 = "ee920c82c30ed88d9bb515d7d79b975cc2ed599c6dad411d04d8b7fcd5a86901";
const SOURCE_2022 = "c6d264f1906375e93466dd97b2c60bb9b21c0dec34b93900b15237b4a98b7716";
const SOURCE_2025 = "46c9447579017d8bf1fefd75b6e6a48856dab7b23e44c7e06babfdc99ae9d289";

const predecessorContent = {
  country: "IN", price_display: "tax_exclusive", rounding: "document",
  taxes: [{ code: "GST_ROOM", name: "GST on accommodation", mode: "slab_percent",
    slab_basis: "transaction_value", applies_to: ["room_revenue"],
    slabs: [{ upto_minor: 750000, rate: 0.12, itc_eligible: true },
      { upto_minor: null, rate: 0.18, itc_eligible: true }] },
    { code: "GST_FNB", name: "GST on F&B (restaurant in hotel)", mode: "percent",
      rate: 0.05, applies_to: ["fnb_revenue"] }],
};
const successorContent = {
  country: "IN", price_display: "tax_exclusive", rounding: "document",
  taxes: [{ code: "GST_ROOM", name: "GST on accommodation", mode: "slab_percent",
    slab_basis: "transaction_value", applies_to: ["room_revenue"],
    slabs: [{ upto_minor: 750000, rate: 0.05, itc_eligible: false },
      { upto_minor: null, rate: 0.18, itc_eligible: true }] },
    { code: "GST_FNB", name: "GST on F&B (restaurant in hotel)", mode: "percent",
      rate: 0.05, applies_to: ["fnb_revenue"] }],
};

let deploy: SQL | undefined;
let runtime: SQL | undefined;
let database: Database | undefined;
let resolver: TaxJurisdictionResolutionService | undefined;
let pairService: IndiaGstAccommodationRateVersionPairService | undefined;

const input = (propertyNode = PROPERTY_A, predecessorExtensionId = PREDECESSOR_A,
  successorExtensionId = SUCCESSOR_A) => ({
  propertyNode, predecessorExtensionId, successorExtensionId,
});

async function cleanup(): Promise<void> {
  if (!deploy) return;
  await deploy.unsafe(`
    DELETE FROM tax_assignment
     WHERE property_node = ANY(ARRAY['${PROPERTY_A}','${PROPERTY_B}']::uuid[]);
    DELETE FROM extension
     WHERE id IN ('${PREDECESSOR_A}','${SUCCESSOR_A}','${FOREIGN_PREDECESSOR}','${FOREIGN_SUCCESSOR}');
    DELETE FROM org_node
     WHERE id IN ('${PROPERTY_A}','${PROPERTY_B}');
    DELETE FROM tenant
     WHERE id IN ('${TENANT_A}','${TENANT_B}');
  `);
}

async function effects(): Promise<Record<string, string>> {
  const rows = await deploy!<Array<Record<string, string>>>`SELECT
    (SELECT count(*)::text FROM extension WHERE id IN (${PREDECESSOR_A}::uuid,${SUCCESSOR_A}::uuid,${FOREIGN_PREDECESSOR}::uuid,${FOREIGN_SUCCESSOR}::uuid)) extensions,
    (SELECT COALESCE(md5(string_agg(row_to_json(e)::text,'|' ORDER BY e.id)),md5('')) FROM extension e WHERE e.id IN (${PREDECESSOR_A}::uuid,${SUCCESSOR_A}::uuid,${FOREIGN_PREDECESSOR}::uuid,${FOREIGN_SUCCESSOR}::uuid)) extension_digest,
    (SELECT count(*)::text FROM fact_log WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) facts,
    (SELECT count(*)::text FROM outbox WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) outbox,
    (SELECT count(*)::text FROM journal WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) journals,
    (SELECT count(*)::text FROM posting_line WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) postings,
    (SELECT count(*)::text FROM document_series WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) document_series,
    (SELECT count(*)::text FROM document WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) documents,
    (SELECT count(*)::text FROM fiscal_submission WHERE tenant_id IN (${TENANT_A}::uuid,${TENANT_B}::uuid)) submissions`;
  return rows[0]!;
}

beforeAll(async () => {
  if (!DEPLOY_URL || !RUNTIME_URL) return;
  deploy = new SQL(DEPLOY_URL, { max: 2, prepare: false });
  runtime = new SQL(RUNTIME_URL, { max: 4, prepare: false });
  database = Database.connect(RUNTIME_URL, { maxConnections: 4, prepare: false });
  const registry = new ExtensionRegistry(runtime);
  resolver = new TaxJurisdictionResolutionService(registry);
  pairService = new IndiaGstAccommodationRateVersionPairService(registry);
  await cleanup();
  await deploy.unsafe(`
    INSERT INTO extension_type (type,json_schema)
      VALUES ('tax_jurisdiction','{}'::jsonb)
      ON CONFLICT (type) DO NOTHING;
    INSERT INTO tenant (id,slug,name,tier,residency,status) VALUES
      ('${TENANT_A}','order304-a','Order 304 A','shared','me-central','active'),
      ('${TENANT_B}','order304-b','Order 304 B','shared','me-central','active');
    INSERT INTO org_node (id,tenant_id,path,kind,name,timezone,currency) VALUES
      ('${PROPERTY_A}','${TENANT_A}','order304_a.property','property','Order 304 A','Asia/Kolkata','INR'),
      ('${PROPERTY_B}','${TENANT_B}','order304_b.property','property','Order 304 B','Asia/Kolkata','INR');
    INSERT INTO extension (id,tenant_id,type,key,version,effective,content,status) VALUES
      ('${PREDECESSOR_A}','${TENANT_A}','tax_jurisdiction','${KEY}',1,
       tstzrange('${PREDECESSOR_FROM}','${CUTOVER}','[)'),'${JSON.stringify(predecessorContent)}'::jsonb,'retired'),
      ('${SUCCESSOR_A}','${TENANT_A}','tax_jurisdiction','${KEY}',2,
       tstzrange('${CUTOVER}',NULL,'[)'),'${JSON.stringify(successorContent)}'::jsonb,'active'),
      ('${FOREIGN_PREDECESSOR}','${TENANT_B}','tax_jurisdiction','${KEY}',1,
       tstzrange('${PREDECESSOR_FROM}','${CUTOVER}','[)'),'${JSON.stringify(predecessorContent)}'::jsonb,'retired'),
      ('${FOREIGN_SUCCESSOR}','${TENANT_B}','tax_jurisdiction','${KEY}',2,
       tstzrange('${CUTOVER}',NULL,'[)'),'${JSON.stringify(successorContent)}'::jsonb,'active');
    INSERT INTO tax_assignment (tenant_id,property_node,jurisdiction_key,effective)
      VALUES ('${TENANT_A}','${PROPERTY_A}','${KEY}',daterange('2026-01-01',NULL,'[)'));
  `);
});

afterAll(async () => {
  await cleanup();
  await database?.close();
  await runtime?.close();
  await deploy?.close();
});

live("Order 304 live PostgreSQL registry/effective-period proof", () => {
  test("exact pair is visible, adjacent, content-bound, frozen, and tenant-hidden", async () => {
    const before = await effects();
    const result = await database!.withTenantTransaction(TENANT_A, (tx) =>
      pairService!.resolve(tx, input()));
    const value = result as unknown as Record<string, unknown>;
    const predecessor = value.predecessor as Record<string, unknown>;
    const successor = value.successor as Record<string, unknown>;
    expect(predecessor).toMatchObject({
      extensionId: PREDECESSOR_A, key: KEY, version: 1,
      status: "retired", effectiveFromInstant: PREDECESSOR_FROM,
      effectiveToInstant: CUTOVER, content: predecessorContent,
    });
    expect(successor).toMatchObject({
      extensionId: SUCCESSOR_A, key: KEY, version: 2,
      status: "active", effectiveFromInstant: CUTOVER, effectiveToInstant: null,
      content: successorContent,
    });
    expect(value).toMatchObject({ cutoverInstant: CUTOVER,
      statutoryLowerBandDelta: { predecessorRate: 0.12, predecessorItcEligible: true,
        successorRate: 0.05, successorItcEligible: false, thresholdMinor: 750000,
        predecessorHasNilBand: false, successorHasNilBand: false } });
    expect(value).not.toHaveProperty("tenantId");
    expect(JSON.stringify(value)).toContain(SOURCE_2019);
    expect(JSON.stringify(value)).toContain(SOURCE_2022);
    expect(JSON.stringify(value)).toContain(SOURCE_2025);
    expect(predecessor.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(successor.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(value.evidenceHash).toMatch(/^[a-f0-9]{64}$/);
    expect(Object.isFrozen(value)).toBeTrue();
    expect(Object.isFrozen(predecessor)).toBeTrue();
    expect(Object.isFrozen(successor)).toBeTrue();
    expect(await effects()).toEqual(before);
  });

  test("foreign ids are concealed and the current resolver remains active-only", async () => {
    const visible = await runtime!.begin(async (tx) => {
      await tx`SELECT set_config('app.tenant_id', ${TENANT_A}, true)`;
      return tx<Array<{ id: string; status: string }>>`
        SELECT id::text, status FROM runtime_visible_extensions(${TENANT_A}::uuid)
         WHERE id IN (${PREDECESSOR_A}::uuid,${SUCCESSOR_A}::uuid,${FOREIGN_PREDECESSOR}::uuid,${FOREIGN_SUCCESSOR}::uuid)
         ORDER BY id`;
    });
    expect(visible).toEqual([
      { id: PREDECESSOR_A, status: "retired" }, { id: SUCCESSOR_A, status: "active" },
    ]);
    await expect(database!.withTenantTransaction(TENANT_A, (tx) =>
      pairService!.resolve(tx,
        input(PROPERTY_A, FOREIGN_PREDECESSOR, FOREIGN_SUCCESSOR)))).rejects.toThrow();
    const current = await database!.withTenantTransaction(TENANT_A, (tx) =>
      resolver!.resolve(tx, { propertyNode: PROPERTY_A, businessDate: "2026-01-01" }));
    expect(current.state).toBe("resolved");
    if (current.state === "resolved") {
      expect(current.jurisdiction.extensionId).toBe(SUCCESSOR_A);
      expect(current.jurisdiction.version).toBe(2);
    }
  });
});
