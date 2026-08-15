import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import { OrgHierarchy } from "../src/contexts/identity";
import { Database } from "../src/kernel";

const DATABASE_URL = process.env.YELLOW_ORG_HIERARCHY_URL;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_ORG_HIERARCHY === "1";
const TENANT_A = "00000000-0000-0000-0000-000000000001";
const TENANT_B = "00000000-0000-0000-0000-000000000002";
const CHAIN_ID = "00000000-0000-0000-0000-000000002600";
const BRAND_A_ID = "00000000-0000-0000-0000-000000002601";
const PROPERTY_A_ID = "00000000-0000-0000-0000-000000002602";
const PROPERTY_B_ID = "00000000-0000-0000-0000-000000002603";
const BRAND_B_ID = "00000000-0000-0000-0000-000000002604";
const REGION_ID = "00000000-0000-0000-0000-000000002605";
const DEEP_PROPERTY_ID = "00000000-0000-0000-0000-000000002606";
const NOISE_ID = "00000000-0000-0000-0000-000000002607";
const ORPHAN_ID = "00000000-0000-0000-0000-000000002608";

if (REQUIRE_DATABASE && !DATABASE_URL) {
  throw new Error("YELLOW_ORG_HIERARCHY_URL is required by the Order 026 proof");
}

const databaseDescribe = DATABASE_URL ? describe.serial : describe.skip;
let admin: SQL | undefined;
let database: Database | undefined;
const hierarchy = new OrgHierarchy();

beforeAll(async () => {
  if (!DATABASE_URL) return;
  admin = new SQL(DATABASE_URL, { max: 3 });
  database = Database.connect(DATABASE_URL, { maxConnections: 6 });
  await admin`DELETE FROM org_node WHERE tenant_id = ${TENANT_A}::uuid AND (path <@ 'order026'::ltree OR path <@ 'order026_noise'::ltree)`;
  await admin`
    INSERT INTO org_node (id, tenant_id, path, kind, name, timezone, currency)
    VALUES
      (${CHAIN_ID}::uuid, ${TENANT_A}::uuid, 'order026', 'group', 'Order 026 Chain', NULL, NULL),
      (${BRAND_A_ID}::uuid, ${TENANT_A}::uuid, 'order026.brand_a', 'brand', 'Brand A', NULL, NULL),
      (${PROPERTY_A_ID}::uuid, ${TENANT_A}::uuid, 'order026.brand_a.property_a', 'property', 'Property A', 'UTC', 'USD'),
      (${PROPERTY_B_ID}::uuid, ${TENANT_A}::uuid, 'order026.brand_a.property_b', 'property', 'Property B', 'UTC', 'USD'),
      (${BRAND_B_ID}::uuid, ${TENANT_A}::uuid, 'order026.brand_b', 'brand', 'Brand B', NULL, NULL),
      (${REGION_ID}::uuid, ${TENANT_A}::uuid, 'order026.brand_b.region_x', 'region', 'Region X', NULL, NULL),
      (${DEEP_PROPERTY_ID}::uuid, ${TENANT_A}::uuid, 'order026.brand_b.region_x.property_deep', 'property', 'Deep Property', 'UTC', 'USD'),
      (${NOISE_ID}::uuid, ${TENANT_A}::uuid, 'order026_noise', 'group', 'Planner Noise', NULL, NULL)
  `;
  await admin`
    INSERT INTO org_node (tenant_id, path, kind, name, timezone, currency)
    SELECT
      ${TENANT_A}::uuid,
      text2ltree('order026_noise.n' || lpad(value::text, 6, '0')),
      'property',
      'Noise ' || value,
      'UTC',
      'USD'
    FROM generate_series(1, 1500) AS value
  `;
  await admin.unsafe("ANALYZE org_node");
}, 30_000);

afterAll(async () => {
  if (admin) {
    await admin`DELETE FROM org_node WHERE tenant_id = ${TENANT_A}::uuid AND (path <@ 'order026'::ltree OR path <@ 'order026_noise'::ltree)`;
    await admin.close();
  }
  await database?.close();
}, 30_000);

databaseDescribe("Order 026 ltree organization hierarchy", () => {
  test("P1: properties, brands, ancestors and siblings are correct", async () => {
    await database!.withTenantTransaction(TENANT_A, async (tx) => {
      const properties = await hierarchy.propertiesUnder(tx, "order026.brand_a");
      const brands = await hierarchy.brandsUnder(tx, "order026");
      const ancestors = await hierarchy.ancestors(tx, "order026.brand_a.property_a");
      const siblings = await hierarchy.siblings(tx, "order026.brand_a.property_a");
      expect(properties.map(({ path }) => path)).toEqual([
        "order026.brand_a.property_a",
        "order026.brand_a.property_b",
      ]);
      expect(brands.map(({ path }) => path)).toEqual(["order026.brand_a", "order026.brand_b"]);
      expect(ancestors.map(({ path }) => path)).toEqual([
        "order026",
        "order026.brand_a",
        "order026.brand_a.property_a",
      ]);
      expect(siblings.map(({ path }) => path)).toEqual(["order026.brand_a.property_b"]);
    });
  });

  test("P2: selective descendant query uses the composite GiST index", async () => {
    const connection = await admin!.reserve();
    let plan = "";
    try {
      await connection.unsafe("BEGIN");
      await connection.unsafe("SET LOCAL enable_seqscan = off");
      await connection.unsafe("SET LOCAL enable_indexscan = off");
      const rows = await connection.unsafe<Array<Record<string, string>>>(`
        EXPLAIN (COSTS OFF)
        SELECT id
        FROM org_node
        WHERE tenant_id = $1::uuid
          AND path <@ $2::ltree
          AND kind = 'property'
      `, [TENANT_A, "order026_noise.n000001"]);
      plan = rows.map((row) => Object.values(row)[0]).join("\n");
      await connection.unsafe("ROLLBACK");
    } finally {
      connection.release();
    }
    expect(plan).toContain("org_node_path_gist");
    expect(plan).toMatch(/Index Scan|Bitmap Index Scan/);
    expect(plan).toMatch(/Index Cond:.*<@/);
    expect(plan).not.toContain("Seq Scan");
  });

  test("P3: tenant B gets no tenant-A node for a crafted tenant-A path", async () => {
    const observed = await database!.withTenantTransaction(TENANT_B, async (tx) => ({
      properties: await hierarchy.propertiesUnder(tx, "order026"),
      ancestors: await hierarchy.ancestors(tx, "order026.brand_a.property_a"),
      siblings: await hierarchy.siblings(tx, "order026.brand_a.property_a"),
    }));
    expect(observed).toEqual({ properties: [], ancestors: [], siblings: [] });
  });

  test("P4: a four-level chain is returned without a depth assumption", async () => {
    await database!.withTenantTransaction(TENANT_A, async (tx) => {
      const properties = await hierarchy.propertiesUnder(tx, "order026.brand_b");
      const ancestors = await hierarchy.ancestors(tx, "order026.brand_b.region_x.property_deep");
      expect(properties.map(({ path, depth }) => ({ path, depth }))).toEqual([{
        path: "order026.brand_b.region_x.property_deep",
        depth: 4,
      }]);
      expect(ancestors.map(({ depth }) => depth)).toEqual([1, 2, 3, 4]);
    });
  });

  test("P5: own-label mismatch and missing same-tenant prefixes are rejected", async () => {
    await database!.withTenantTransaction(TENANT_A, async (tx) => {
      await hierarchy.assertWellFormed(tx, DEEP_PROPERTY_ID, "property_deep");
      await expect(hierarchy.assertWellFormed(tx, DEEP_PROPERTY_ID, "another_label"))
        .rejects.toThrow("must end with its own label another_label");
    });
    await admin!`
      INSERT INTO org_node (id, tenant_id, path, kind, name, timezone, currency)
      VALUES (${ORPHAN_ID}::uuid, ${TENANT_A}::uuid, 'order026.missing.orphan', 'property', 'Orphan', 'UTC', 'USD')
    `;
    await expect(database!.withTenantTransaction(TENANT_A, (tx) =>
      hierarchy.assertWellFormed(tx, ORPHAN_ID, "orphan")
    )).rejects.toThrow("missing same-tenant prefixes: order026.missing");
  });
});
