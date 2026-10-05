import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import {
  AvailabilityService,
  InventoryValidationError,
  type AvailabilityOption,
} from "../src/contexts/inventory";
import { Database } from "../src/kernel";

const DATABASE_URL = process.env.YELLOW_OPERATIONAL_BLOCK_AVAILABILITY_URL;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_OPERATIONAL_BLOCK_AVAILABILITY === "1";

const TENANT_A = "00000000-0000-0000-0000-000000004010";
const TENANT_B = "00000000-0000-0000-0000-000000004011";
const PROPERTY_A = "00000000-0000-0000-0000-000000004020";
const PROPERTY_B = "00000000-0000-0000-0000-000000004021";
const UNIT_TYPE_SINGLE = "00000000-0000-0000-0000-000000004030";
const UNIT_TYPE_COMPOSITE = "00000000-0000-0000-0000-000000004031";
const SPACE_SINGLE = "00000000-0000-0000-0000-000000004040";
const SPACE_COMPOSITE_A = "00000000-0000-0000-0000-000000004041";
const SPACE_COMPOSITE_B = "00000000-0000-0000-0000-000000004042";
const SPACE_UNMAPPED = "00000000-0000-0000-0000-000000004043";
const SPACE_FOREIGN = "00000000-0000-0000-0000-000000004044";
const SELLABLE_SINGLE = "00000000-0000-0000-0000-000000004050";
const SELLABLE_COMPOSITE = "00000000-0000-0000-0000-000000004051";
const BLOCK_A = "00000000-0000-0000-0000-000000004060";
const BLOCK_B = "00000000-0000-0000-0000-000000004061";
const BLOCK_C = "00000000-0000-0000-0000-000000004062";
const BLOCK_D = "00000000-0000-0000-0000-000000004063";
const BLOCK_E = "00000000-0000-0000-0000-000000004064";
const BLOCK_F = "00000000-0000-0000-0000-000000004065";

const PERIOD = {
  from: new Date("2027-08-10T12:00:00.000Z"),
  to: new Date("2027-08-12T12:00:00.000Z"),
};
const PERIOD_SQL = "[2027-08-10 12:00:00+00,2027-08-12 12:00:00+00)";

if (REQUIRE_DATABASE && !DATABASE_URL) {
  throw new Error("YELLOW_OPERATIONAL_BLOCK_AVAILABILITY_URL is required by the Order 040 proof");
}

const databaseDescribe = DATABASE_URL ? describe.serial : describe.skip;
const availability = new AvailabilityService();
let admin: SQL;
let database: Database;

function exactOption(options: readonly AvailabilityOption[], id: string): AvailabilityOption {
  const found = options.find(({ sellableUnitId }) => sellableUnitId === id);
  if (!found) throw new Error(`Missing availability option ${id}`);
  return found;
}

async function search(tenantId = TENANT_A, propertyNode = PROPERTY_A) {
  return database.withTenantTransaction(tenantId, (tx) => availability.search(tx, {
    propertyNode,
    ...PERIOD,
  }));
}

async function setPolicy(value: "blocked" | "allowed") {
  await admin`
    UPDATE org_node
    SET config = jsonb_set(
      config,
      '{inventory}',
      COALESCE(config -> 'inventory', '{}'::jsonb) || jsonb_build_object('oos_sellability', ${value}::text),
      true
    )
    WHERE id = ${PROPERTY_A}::uuid
  `;
}

async function insertBlock(
  id: string,
  spaceId: string,
  kind: "ooo" | "oos",
  reason: string,
  tenantId = TENANT_A,
  period = PERIOD_SQL,
) {
  await admin`
    INSERT INTO ooo_oos (id, tenant_id, space_id, kind, period, reason)
    VALUES (${id}::uuid, ${tenantId}::uuid, ${spaceId}::uuid, ${kind}, ${period}::tstzrange, ${reason})
  `;
}

async function clearBehavior() {
  await admin`DELETE FROM space_occupancy WHERE slot_ref IN (${BLOCK_A}::uuid, ${BLOCK_B}::uuid, ${BLOCK_C}::uuid, ${BLOCK_D}::uuid, ${BLOCK_E}::uuid, ${BLOCK_F}::uuid)`;
  await admin`DELETE FROM ooo_oos WHERE id IN (${BLOCK_A}::uuid, ${BLOCK_B}::uuid, ${BLOCK_C}::uuid, ${BLOCK_D}::uuid, ${BLOCK_E}::uuid, ${BLOCK_F}::uuid)`;
  await admin`DELETE FROM restriction WHERE scope_node = ${PROPERTY_A}::uuid`;
  await admin`UPDATE org_node SET config = '{}'::jsonb WHERE id = ${PROPERTY_A}::uuid`;
}

beforeAll(async () => {
  if (!DATABASE_URL) return;
  admin = new SQL(DATABASE_URL, { max: 4 });
  database = Database.connect(DATABASE_URL, { maxConnections: 8 });

  await admin`DELETE FROM space_occupancy WHERE slot_ref IN (${BLOCK_A}::uuid, ${BLOCK_B}::uuid, ${BLOCK_C}::uuid, ${BLOCK_D}::uuid, ${BLOCK_E}::uuid, ${BLOCK_F}::uuid)`;
  await admin`DELETE FROM ooo_oos WHERE id IN (${BLOCK_A}::uuid, ${BLOCK_B}::uuid, ${BLOCK_C}::uuid, ${BLOCK_D}::uuid, ${BLOCK_E}::uuid, ${BLOCK_F}::uuid)`;
  await admin`DELETE FROM restriction WHERE scope_node = ${PROPERTY_A}::uuid`;
  await admin`DELETE FROM sellable_unit_space WHERE sellable_unit_id IN (${SELLABLE_SINGLE}::uuid, ${SELLABLE_COMPOSITE}::uuid)`;
  await admin`DELETE FROM sellable_unit WHERE id IN (${SELLABLE_SINGLE}::uuid, ${SELLABLE_COMPOSITE}::uuid)`;
  await admin`DELETE FROM space WHERE id IN (${SPACE_SINGLE}::uuid, ${SPACE_COMPOSITE_A}::uuid, ${SPACE_COMPOSITE_B}::uuid, ${SPACE_UNMAPPED}::uuid, ${SPACE_FOREIGN}::uuid)`;
  await admin`DELETE FROM unit_type WHERE id IN (${UNIT_TYPE_SINGLE}::uuid, ${UNIT_TYPE_COMPOSITE}::uuid)`;
  await admin`DELETE FROM org_node WHERE id IN (${PROPERTY_A}::uuid, ${PROPERTY_B}::uuid)`;
  await admin`DELETE FROM tenant WHERE id IN (${TENANT_A}::uuid, ${TENANT_B}::uuid)`;

  await admin`
    INSERT INTO tenant (id, slug, name, tier, status)
    VALUES
      (${TENANT_A}::uuid, 'order040-a', 'Order 040 A', 'shared', 'active'),
      (${TENANT_B}::uuid, 'order040-b', 'Order 040 B', 'shared', 'active')
  `;
  await admin`
    INSERT INTO org_node (id, tenant_id, path, kind, name, timezone, currency, config)
    VALUES
      (${PROPERTY_A}::uuid, ${TENANT_A}::uuid, 'order040_a', 'property', 'Order 040 A', 'UTC', 'USD', '{}'::jsonb),
      (${PROPERTY_B}::uuid, ${TENANT_B}::uuid, 'order040_b', 'property', 'Order 040 B', 'UTC', 'USD', '{}'::jsonb)
  `;
  await admin`
    INSERT INTO unit_type (id, tenant_id, property_node, code, name, profile_key, max_occupancy, sort_order)
    VALUES
      (${UNIT_TYPE_SINGLE}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O40-S', 'Order 040 Single', 'hotel', 2, 400),
      (${UNIT_TYPE_COMPOSITE}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O40-C', 'Order 040 Composite', 'hotel', 2, 401)
  `;
  await admin`
    INSERT INTO space (id, tenant_id, property_node, code, profile_key, capacity)
    VALUES
      (${SPACE_SINGLE}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O40-S', 'hotel', 1),
      (${SPACE_COMPOSITE_A}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O40-CA', 'hotel', 1),
      (${SPACE_COMPOSITE_B}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O40-CB', 'hotel', 1),
      (${SPACE_UNMAPPED}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O40-U', 'hotel', 1),
      (${SPACE_FOREIGN}::uuid, ${TENANT_B}::uuid, ${PROPERTY_B}::uuid, 'O40-F', 'hotel', 1)
  `;
  await admin`
    INSERT INTO sellable_unit (id, tenant_id, unit_type_id, name)
    VALUES
      (${SELLABLE_SINGLE}::uuid, ${TENANT_A}::uuid, ${UNIT_TYPE_SINGLE}::uuid, 'Order 040 Single'),
      (${SELLABLE_COMPOSITE}::uuid, ${TENANT_A}::uuid, ${UNIT_TYPE_COMPOSITE}::uuid, 'Order 040 Composite')
  `;
  await admin`
    INSERT INTO sellable_unit_space (tenant_id, sellable_unit_id, space_id, claim_mode)
    VALUES
      (${TENANT_A}::uuid, ${SELLABLE_SINGLE}::uuid, ${SPACE_SINGLE}::uuid, 'exclusive'),
      (${TENANT_A}::uuid, ${SELLABLE_COMPOSITE}::uuid, ${SPACE_COMPOSITE_A}::uuid, 'exclusive'),
      (${TENANT_A}::uuid, ${SELLABLE_COMPOSITE}::uuid, ${SPACE_COMPOSITE_B}::uuid, 'exclusive')
  `;
});

beforeEach(async () => {
  if (!DATABASE_URL) return;
  await clearBehavior();
});

afterAll(async () => {
  if (!DATABASE_URL) return;
  await clearBehavior();
  await admin`DELETE FROM sellable_unit_space WHERE sellable_unit_id IN (${SELLABLE_SINGLE}::uuid, ${SELLABLE_COMPOSITE}::uuid)`;
  await admin`DELETE FROM sellable_unit WHERE id IN (${SELLABLE_SINGLE}::uuid, ${SELLABLE_COMPOSITE}::uuid)`;
  await admin`DELETE FROM space WHERE id IN (${SPACE_SINGLE}::uuid, ${SPACE_COMPOSITE_A}::uuid, ${SPACE_COMPOSITE_B}::uuid, ${SPACE_UNMAPPED}::uuid, ${SPACE_FOREIGN}::uuid)`;
  await admin`DELETE FROM unit_type WHERE id IN (${UNIT_TYPE_SINGLE}::uuid, ${UNIT_TYPE_COMPOSITE}::uuid)`;
  await admin`DELETE FROM org_node WHERE id IN (${PROPERTY_A}::uuid, ${PROPERTY_B}::uuid)`;
  await admin`DELETE FROM tenant WHERE id IN (${TENANT_A}::uuid, ${TENANT_B}::uuid)`;
  await admin.close();
  await database.close();
});

databaseDescribe("Order 040 operational-block availability evaluation", () => {
  test("P1: OOO evidence accompanies authoritative physical removal", async () => {
    await insertBlock(BLOCK_A, SPACE_SINGLE, "ooo", "Plumbing isolation");
    await admin`
      SELECT record_occupancy(
        ${TENANT_A}::uuid, ${SPACE_SINGLE}::uuid, ${PERIOD_SQL}::tstzrange,
        ${BLOCK_A}::uuid, 'ooo', true
      )
    `;

    const result = exactOption(await search(), SELLABLE_SINGLE);
    expect(result.availableCount).toBe(0);
    expect(result.bookable).toBeFalse();
    expect(result.operationalBlocksApplied).toEqual([{
      id: BLOCK_A,
      spaceId: SPACE_SINGLE,
      kind: "ooo",
      reason: "Plumbing isolation",
      blocks: true,
    }]);
  });

  test("P2: absent policy blocks OOS commercially without changing physical count", async () => {
    await insertBlock(BLOCK_A, SPACE_SINGLE, "oos", "Television replacement");
    const single = exactOption(await search(), SELLABLE_SINGLE);
    const composite = exactOption(await search(), SELLABLE_COMPOSITE);

    expect(single.availableCount).toBe(1);
    expect(single.bookable).toBeFalse();
    expect(single.operationalBlocksApplied).toEqual([{
      id: BLOCK_A,
      spaceId: SPACE_SINGLE,
      kind: "oos",
      reason: "Television replacement",
      blocks: true,
    }]);
    expect(composite.availableCount).toBe(1);
    expect(composite.bookable).toBeTrue();
    expect(composite.operationalBlocksApplied).toEqual([]);
  });

  test("P3: allowed OOS remains warning evidence while OOO remains blocking", async () => {
    await setPolicy("allowed");
    await insertBlock(BLOCK_A, SPACE_SINGLE, "oos", "Cosmetic repair");
    let result = exactOption(await search(), SELLABLE_SINGLE);
    expect(result.availableCount).toBe(1);
    expect(result.bookable).toBeTrue();
    expect(result.operationalBlocksApplied[0]?.blocks).toBeFalse();

    await insertBlock(BLOCK_B, SPACE_SINGLE, "ooo", "Water shutoff");
    await admin`
      SELECT record_occupancy(
        ${TENANT_A}::uuid, ${SPACE_SINGLE}::uuid, ${PERIOD_SQL}::tstzrange,
        ${BLOCK_B}::uuid, 'ooo', true
      )
    `;
    result = exactOption(await search(), SELLABLE_SINGLE);
    expect(result.availableCount).toBe(0);
    expect(result.bookable).toBeFalse();
    expect(result.operationalBlocksApplied).toEqual([
      { id: BLOCK_B, spaceId: SPACE_SINGLE, kind: "ooo", reason: "Water shutoff", blocks: true },
      { id: BLOCK_A, spaceId: SPACE_SINGLE, kind: "oos", reason: "Cosmetic repair", blocks: false },
    ]);
  });

  test("P4: restrictions and operational causes compose without clearing each other", async () => {
    await insertBlock(BLOCK_A, SPACE_SINGLE, "oos", "Minor maintenance");
    await admin`
      INSERT INTO restriction (tenant_id, scope_node, kind, stay_dates, source)
      VALUES (${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'closed', daterange('2027-08-10', '2027-08-13', '[)'), 'manual')
    `;
    let result = exactOption(await search(), SELLABLE_SINGLE);
    expect(result.restrictionsApplied).toHaveLength(1);
    expect(result.operationalBlocksApplied).toHaveLength(1);
    expect(result.bookable).toBeFalse();

    await admin`DELETE FROM restriction WHERE scope_node = ${PROPERTY_A}::uuid`;
    result = exactOption(await search(), SELLABLE_SINGLE);
    expect(result.restrictionsApplied).toEqual([]);
    expect(result.operationalBlocksApplied).toHaveLength(1);
    expect(result.bookable).toBeFalse();

    await setPolicy("allowed");
    result = exactOption(await search(), SELLABLE_SINGLE);
    expect(result.operationalBlocksApplied[0]?.blocks).toBeFalse();
    expect(result.bookable).toBeTrue();
  });

  test("P5: composite causes are deterministic and end independently", async () => {
    await insertBlock(BLOCK_C, SPACE_COMPOSITE_B, "oos", "Curtain repair");
    await insertBlock(BLOCK_B, SPACE_COMPOSITE_A, "oos", "Lamp repair");
    let result = exactOption(await search(), SELLABLE_COMPOSITE);
    expect(result.availableCount).toBe(1);
    expect(result.operationalBlocksApplied.map(({ id }) => id)).toEqual([BLOCK_B, BLOCK_C]);
    expect(result.bookable).toBeFalse();

    await admin`
      UPDATE ooo_oos
      SET period = tstzrange(${PERIOD.from.toISOString()}::timestamptz, ${PERIOD.from.toISOString()}::timestamptz, '[)')
      WHERE id = ${BLOCK_B}::uuid
    `;
    result = exactOption(await search(), SELLABLE_COMPOSITE);
    expect(result.operationalBlocksApplied.map(({ id }) => id)).toEqual([BLOCK_C]);
    expect(result.bookable).toBeFalse();
  });

  test("P6: tenant, mapping, time, stored-policy, and input boundaries fail closed", async () => {
    await insertBlock(BLOCK_A, SPACE_UNMAPPED, "oos", "Unmapped");
    await insertBlock(BLOCK_B, SPACE_FOREIGN, "oos", "Foreign tenant", TENANT_B);
    await insertBlock(BLOCK_C, SPACE_SINGLE, "oos", "Ended", TENANT_A,
      "[2026-01-01 00:00:00+00,2026-01-02 00:00:00+00)");
    await insertBlock(BLOCK_D, SPACE_SINGLE, "oos", "Non-overlap", TENANT_A,
      "[2027-09-01 00:00:00+00,2027-09-02 00:00:00+00)");
    await insertBlock(BLOCK_E, SPACE_SINGLE, "oos", "Empty", TENANT_A, "empty");

    for (const result of await search()) {
      expect(result.operationalBlocksApplied).toEqual([]);
      expect(result.bookable).toBeTrue();
    }
    expect(await search(TENANT_B, PROPERTY_A)).toEqual([]);
    expect(await search(TENANT_A, PROPERTY_B)).toEqual([]);

    await admin`
      UPDATE org_node
      SET config = '{"inventory":{"oos_sellability":"maybe"}}'::jsonb
      WHERE id = ${PROPERTY_A}::uuid
    `;
    await expect(search()).rejects.toThrow("invalid inventory.oos_sellability policy");
    await expect(database.withTenantTransaction(TENANT_A, (tx) => availability.search(tx, {
      propertyNode: PROPERTY_A,
      from: PERIOD.to,
      to: PERIOD.from,
    }))).rejects.toBeInstanceOf(InventoryValidationError);
  });
});
