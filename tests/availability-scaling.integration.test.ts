import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import { AvailabilityService } from "../src/contexts/inventory";
import { Database } from "../src/kernel";

const DATABASE_URL = process.env.YELLOW_AVAILABILITY_SCALING_URL;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_AVAILABILITY_SCALING === "1";
const TENANT = "00000000-0000-0000-0000-000000006100";
const PROPERTY = "00000000-0000-0000-0000-000000006101";
const UNIT_TYPE = "00000000-0000-0000-0000-000000006102";
const PERIOD = {
  from: new Date("2027-08-10T12:00:00.000Z"),
  to: new Date("2027-08-12T12:00:00.000Z"),
};

if (REQUIRE_DATABASE && !DATABASE_URL) {
  throw new Error("YELLOW_AVAILABILITY_SCALING_URL is required by the Order 061 proof");
}

const databaseDescribe = DATABASE_URL ? describe.serial : describe.skip;
const availability = new AvailabilityService();
let admin: SQL | undefined;
let database: Database | undefined;

interface WorkRow {
  readonly calls: number;
  readonly rows: number;
  readonly logical_work: number;
}

async function clearFixture(): Promise<void> {
  await admin!`DELETE FROM sellable_unit_space WHERE sellable_unit_id IN (
    SELECT id FROM sellable_unit WHERE tenant_id = ${TENANT}::uuid
  )`;
  await admin!`DELETE FROM sellable_unit WHERE tenant_id = ${TENANT}::uuid`;
  await admin!`DELETE FROM space WHERE tenant_id = ${TENANT}::uuid`;
  await admin!`DELETE FROM unit_type WHERE tenant_id = ${TENANT}::uuid`;
  await admin!`DELETE FROM org_node WHERE tenant_id = ${TENANT}::uuid`;
  await admin!`DELETE FROM tenant WHERE id = ${TENANT}::uuid`;
}

async function addSellables(first: number, last: number): Promise<void> {
  await admin!.unsafe(`
    INSERT INTO space (tenant_id, property_node, code, profile_key, capacity)
    SELECT $1::uuid, $2::uuid, 'O61-PERF-' || lpad(g::text, 4, '0'), 'hotel', 1
    FROM generate_series($3::int, $4::int) AS g
  `, [TENANT, PROPERTY, first, last]);
  await admin!.unsafe(`
    INSERT INTO sellable_unit (tenant_id, unit_type_id, name)
    SELECT $1::uuid, $2::uuid, 'Order 061 Perf ' || space.code
    FROM space
    WHERE tenant_id = $1::uuid
      AND code BETWEEN 'O61-PERF-' || lpad($3::text, 4, '0')
                   AND 'O61-PERF-' || lpad($4::text, 4, '0')
  `, [TENANT, UNIT_TYPE, first, last]);
  await admin!.unsafe(`
    INSERT INTO sellable_unit_space (tenant_id, sellable_unit_id, space_id, claim_mode)
    SELECT $1::uuid, sellable.id, space.id, 'exclusive'
    FROM sellable_unit AS sellable
    JOIN space ON sellable.name = 'Order 061 Perf ' || space.code
    WHERE sellable.tenant_id = $1::uuid
      AND space.tenant_id = $1::uuid
      AND space.code BETWEEN 'O61-PERF-' || lpad($2::text, 4, '0')
                         AND 'O61-PERF-' || lpad($3::text, 4, '0')
  `, [TENANT, first, last]);
}

async function measure(expectedOptions: number): Promise<WorkRow> {
  await admin!.unsafe("SELECT pg_stat_statements_reset()");
  const options = await database!.withTenantTransaction(TENANT, (tx) => availability.search(tx, {
    propertyNode: PROPERTY,
    ...PERIOD,
    partySize: 1,
  }));
  expect(options).toHaveLength(expectedOptions);
  expect(options.every(({ unitTypeId }) => unitTypeId === UNIT_TYPE)).toBe(true);

  const matches = await admin!.unsafe<WorkRow[]>(`
    SELECT
      calls::int AS calls,
      rows::int AS rows,
      (
        shared_blks_hit + shared_blks_read +
        local_blks_hit + local_blks_read +
        temp_blks_read + temp_blks_written
      )::int AS logical_work
    FROM pg_stat_statements
    WHERE userid = (SELECT oid FROM pg_roles WHERE rolname = 'app_role')
      AND dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
      AND query LIKE '%WITH property_context AS (%'
  `);
  expect(matches).toHaveLength(1);
  const measured = matches[0];
  if (!measured) throw new Error("availability work statement was not measured");
  expect(measured.calls).toBe(1);
  expect(measured.rows).toBe(expectedOptions);
  expect(Number.isFinite(measured.logical_work)).toBe(true);
  expect(measured.logical_work).toBeGreaterThanOrEqual(0);
  return measured;
}

beforeAll(async () => {
  if (!DATABASE_URL) return;
  admin = new SQL(DATABASE_URL, { max: 4 });
  database = Database.connect(DATABASE_URL, { maxConnections: 4 });
  await admin.unsafe("CREATE EXTENSION IF NOT EXISTS pg_stat_statements");
  await clearFixture();
  await admin`
    INSERT INTO tenant (id, slug, name, tier, status)
    VALUES (${TENANT}::uuid, 'order061', 'Order 061', 'shared', 'active')
  `;
  await admin`
    INSERT INTO org_node (id, tenant_id, path, kind, name, timezone, currency)
    VALUES (${PROPERTY}::uuid, ${TENANT}::uuid, 'order061', 'property', 'Order 061', 'UTC', 'USD')
  `;
  await admin`
    INSERT INTO unit_type (
      id, tenant_id, property_node, code, name, profile_key, max_occupancy, sort_order
    ) VALUES (
      ${UNIT_TYPE}::uuid, ${TENANT}::uuid, ${PROPERTY}::uuid,
      'O61-P', 'Order 061 Performance', 'hotel', 2, 610
    )
  `;
});

afterAll(async () => {
  if (!DATABASE_URL) return;
  await clearFixture();
  await database?.close();
  await admin?.close({ timeout: 5 });
});

databaseDescribe("Order 061 availability work-scaling proof", () => {
  test("P0/P4: Order 031 names the unchanged ceiling as a catastrophic-regression guard", async () => {
    const source = await Bun.file(new URL("availability.integration.test.ts", import.meta.url)).text();
    expect(source).toContain("P8: catastrophic-regression guard");
    expect(source).toContain("for (let run = 0; run < 20; run += 1)");
    expect(source).toContain("expect(maxMs).toBeLessThan(1_000)");
  });

  test("P1/P2: production availability logical work stays sub-quadratic from 250 to 500 spaces", async () => {
    await addSellables(1, 250);
    const at250 = await measure(250);
    await addSellables(251, 500);
    const at500 = await measure(500);
    const ratio = at500.logical_work / at250.logical_work;

    console.log(
      `Order 061 availability work: n250=${at250.logical_work} n500=${at500.logical_work} ` +
      `ratio=${ratio.toFixed(3)} rows250=${at250.rows} rows500=${at500.rows}`,
    );
    expect(ratio).toBeLessThan(3);
    expect(at500.logical_work).toBeLessThan(10_000);
  }, 30_000);
});
