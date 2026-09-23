import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import {
  AvailabilityProjectionService,
  AvailabilityService,
  InventoryNotFoundError,
  InventoryValidationError,
  type ProjectionRebuildResult,
} from "../src/contexts/inventory";
import { Database } from "../src/kernel";

const DATABASE_URL = process.env.YELLOW_AVAILABILITY_PROJECTION_URL;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_AVAILABILITY_PROJECTION === "1";

const TENANT_A = "00000000-0000-0000-0000-000000005810";
const TENANT_B = "00000000-0000-0000-0000-000000005811";
const PROPERTY_A = "00000000-0000-0000-0000-000000005820";
const PROPERTY_B = "00000000-0000-0000-0000-000000005821";
const UT_HOTEL = "00000000-0000-0000-0000-000000005830";
const UT_DORM = "00000000-0000-0000-0000-000000005831";
const UT_COMPOSITE = "00000000-0000-0000-0000-000000005832";
const UT_SHARED = "00000000-0000-0000-0000-000000005833";
const UT_B = "00000000-0000-0000-0000-000000005834";
const SPACE_HOTEL_1 = "00000000-0000-0000-0000-000000005840";
const SPACE_HOTEL_2 = "00000000-0000-0000-0000-000000005841";
const SPACE_DORM = "00000000-0000-0000-0000-000000005842";
const SPACE_COMPOSITE_1 = "00000000-0000-0000-0000-000000005843";
const SPACE_COMPOSITE_2 = "00000000-0000-0000-0000-000000005844";
const SPACE_SHARED = "00000000-0000-0000-0000-000000005845";
const SPACE_B = "00000000-0000-0000-0000-000000005846";
const SU_HOTEL_1 = "00000000-0000-0000-0000-000000005850";
const SU_HOTEL_2 = "00000000-0000-0000-0000-000000005851";
const SU_DORM = "00000000-0000-0000-0000-000000005852";
const SU_COMPOSITE = "00000000-0000-0000-0000-000000005853";
const SU_SHARED_1 = "00000000-0000-0000-0000-000000005854";
const SU_SHARED_2 = "00000000-0000-0000-0000-000000005855";
const SU_B = "00000000-0000-0000-0000-000000005856";
const SEGMENT_REF = "00000000-0000-0000-0000-000000005860";
const HOLD_REF = "00000000-0000-0000-0000-000000005861";
const OOO_REF = "00000000-0000-0000-0000-000000005862";
const OOS_REF = "00000000-0000-0000-0000-000000005863";
const DST_REF = "00000000-0000-0000-0000-000000005864";
const RESERVATION_REF = "00000000-0000-0000-0000-000000005865";
const PARTY_REF = "00000000-0000-0000-0000-000000005866";
const RATE_REF = "00000000-0000-0000-0000-000000005867";
const FROM_DATE = "2027-03-13";
const TO_DATE = "2027-03-16";

if (REQUIRE_DATABASE && !DATABASE_URL) {
  throw new Error("YELLOW_AVAILABILITY_PROJECTION_URL is required by Order 058");
}

const databaseDescribe = DATABASE_URL ? describe.serial : describe.skip;
let admin: SQL;
let database: Database;
const projection = new AvailabilityProjectionService();
const availability = new AvailabilityService();

interface ProjectionRow {
  readonly tenant_id: string;
  readonly property_node: string;
  readonly unit_type_id: string;
  readonly stay_date: string;
  readonly physical: number;
  readonly sold: number;
  readonly held: number;
  readonly blocked: number;
  readonly ooo: number;
  readonly available: number;
}

function rebuild(
  input: { propertyNode: string; fromDate: string; toDate: string } = {
    propertyNode: PROPERTY_A,
    fromDate: FROM_DATE,
    toDate: TO_DATE,
  },
  tenantId = TENANT_A,
): Promise<ProjectionRebuildResult> {
  return database.withTenantTransaction(tenantId, (tx) => projection.rebuild(tx, input));
}

async function rows(propertyNode = PROPERTY_A): Promise<ProjectionRow[]> {
  return admin<ProjectionRow[]>`
    SELECT tenant_id, property_node, unit_type_id, stay_date::text,
           physical, sold, held, blocked, ooo, available
    FROM availability_projection
    WHERE property_node = ${propertyNode}::uuid
      AND stay_date >= ${FROM_DATE}::date
      AND stay_date < ${TO_DATE}::date
    ORDER BY stay_date, unit_type_id
  `;
}

function findRow(all: readonly ProjectionRow[], unitTypeId: string, stayDate: string): ProjectionRow {
  const row = all.find((candidate) => candidate.unit_type_id === unitTypeId && candidate.stay_date === stayDate);
  if (!row) throw new Error(`Missing projection row ${unitTypeId} ${stayDate}`);
  return row;
}

async function record(
  slotRef: string,
  slotKind: "segment" | "hold" | "ooo",
  spaceId: string,
  from: string,
  to: string,
  exclusive: boolean,
): Promise<void> {
  if (slotKind === "hold") {
    await admin`
      INSERT INTO hold (
        id, tenant_id, property_node, sellable_unit_id, period,
        kind, holder, expires_at, status
      )
      SELECT ${slotRef}::uuid, ${TENANT_A}::uuid, unit_type.property_node,
             mapping.sellable_unit_id,
             tstzrange(${from}::timestamptz, ${to}::timestamptz, '[)'),
             'cart', '{}'::jsonb, '2030-01-01T00:00:00Z'::timestamptz, 'active'
        FROM sellable_unit_space AS mapping
        JOIN sellable_unit
          ON sellable_unit.id = mapping.sellable_unit_id
         AND sellable_unit.tenant_id = mapping.tenant_id
        JOIN unit_type
          ON unit_type.id = sellable_unit.unit_type_id
         AND unit_type.tenant_id = sellable_unit.tenant_id
       WHERE mapping.tenant_id = ${TENANT_A}::uuid
         AND mapping.space_id = ${spaceId}::uuid
         AND mapping.claim_mode = ${exclusive ? "exclusive" : "positional"}
       ORDER BY mapping.sellable_unit_id
       LIMIT 1
    `;
  }
  await database.withTenantTransaction(TENANT_A, async (tx) => {
    const result = await tx<Array<{ id: string }>>`
      SELECT record_occupancy(
        ${TENANT_A}::uuid,
        ${spaceId}::uuid,
        tstzrange(${from}::timestamptz, ${to}::timestamptz, '[)'),
        ${slotRef}::uuid,
        ${slotKind},
        ${exclusive}
      ) AS id
    `;
    expect(result[0]?.id).toMatch(/^[0-9a-f-]{36}$/);
  });
}

async function release(...slotRefs: string[]): Promise<void> {
  for (const slotRef of slotRefs) {
    await database.withTenantTransaction(TENANT_A, async (tx) => {
      await tx`SELECT release_occupancy(${TENANT_A}::uuid, ${slotRef}::uuid)`;
    });
  }
}

async function setOosPolicy(value: "blocked" | "allowed"): Promise<void> {
  await admin`
    UPDATE org_node
    SET config = jsonb_set(
      config,
      '{inventory}',
      COALESCE(config -> 'inventory', '{}'::jsonb) || jsonb_build_object('oos_sellability', ${value}::text),
      true
    )
    WHERE id = ${PROPERTY_A}::uuid AND tenant_id = ${TENANT_A}::uuid
  `;
}

async function cleanDynamicState(): Promise<void> {
  await admin`DELETE FROM space_occupancy WHERE slot_ref IN (
    ${SEGMENT_REF}::uuid, ${HOLD_REF}::uuid, ${OOO_REF}::uuid, ${DST_REF}::uuid
  )`;
  await admin`DELETE FROM hold WHERE id IN (${HOLD_REF}::uuid, ${DST_REF}::uuid)`;
  await admin`DELETE FROM ooo_oos WHERE id IN (${OOO_REF}::uuid, ${OOS_REF}::uuid)`;
  await setOosPolicy("blocked");
}

beforeAll(async () => {
  if (!DATABASE_URL) return;
  admin = new SQL(DATABASE_URL, { max: 8 });
  database = Database.connect(DATABASE_URL, { maxConnections: 12 });

  await admin`DROP TRIGGER IF EXISTS order058_fail_projection_insert ON availability_projection`;
  await admin`DROP FUNCTION IF EXISTS public.order058_fail_projection_insert()`;
  await admin`DELETE FROM space_occupancy WHERE slot_ref IN (
    ${SEGMENT_REF}::uuid, ${HOLD_REF}::uuid, ${OOO_REF}::uuid, ${DST_REF}::uuid
  )`;
  await admin`DELETE FROM ooo_oos WHERE id IN (${OOO_REF}::uuid, ${OOS_REF}::uuid)`;
  await admin`DELETE FROM availability_projection WHERE property_node IN (${PROPERTY_A}::uuid, ${PROPERTY_B}::uuid)`;
  await admin`DELETE FROM sellable_unit_space WHERE sellable_unit_id IN (
    ${SU_HOTEL_1}::uuid, ${SU_HOTEL_2}::uuid, ${SU_DORM}::uuid, ${SU_COMPOSITE}::uuid,
    ${SU_SHARED_1}::uuid, ${SU_SHARED_2}::uuid, ${SU_B}::uuid
  )`;
  await admin`DELETE FROM sellable_unit WHERE id IN (
    ${SU_HOTEL_1}::uuid, ${SU_HOTEL_2}::uuid, ${SU_DORM}::uuid, ${SU_COMPOSITE}::uuid,
    ${SU_SHARED_1}::uuid, ${SU_SHARED_2}::uuid, ${SU_B}::uuid
  )`;
  await admin`DELETE FROM space WHERE id IN (
    ${SPACE_HOTEL_1}::uuid, ${SPACE_HOTEL_2}::uuid, ${SPACE_DORM}::uuid,
    ${SPACE_COMPOSITE_1}::uuid, ${SPACE_COMPOSITE_2}::uuid, ${SPACE_SHARED}::uuid, ${SPACE_B}::uuid
  )`;
  await admin`DELETE FROM unit_type WHERE id IN (
    ${UT_HOTEL}::uuid, ${UT_DORM}::uuid, ${UT_COMPOSITE}::uuid, ${UT_SHARED}::uuid, ${UT_B}::uuid
  )`;
  await admin`DELETE FROM org_node WHERE id IN (${PROPERTY_A}::uuid, ${PROPERTY_B}::uuid)`;
  await admin`DELETE FROM tenant WHERE id IN (${TENANT_A}::uuid, ${TENANT_B}::uuid)`;

  await admin`
    INSERT INTO tenant (id, slug, name, tier, status)
    VALUES
      (${TENANT_A}::uuid, 'order058-a', 'Order 058 A', 'shared', 'active'),
      (${TENANT_B}::uuid, 'order058-b', 'Order 058 B', 'shared', 'active')
  `;
  await admin`
    INSERT INTO org_node (id, tenant_id, path, kind, name, timezone, currency, config)
    VALUES
      (${PROPERTY_A}::uuid, ${TENANT_A}::uuid, 'order058_a', 'property', 'Order 058 New York',
       'America/New_York', 'USD', '{"inventory":{"oos_sellability":"blocked"}}'::jsonb),
      (${PROPERTY_B}::uuid, ${TENANT_B}::uuid, 'order058_b', 'property', 'Order 058 B',
       'UTC', 'USD', '{}'::jsonb)
  `;
  await admin`
    INSERT INTO unit_type (id, tenant_id, property_node, code, name, profile_key, max_occupancy, sort_order)
    VALUES
      (${UT_HOTEL}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O58-H', 'Hotel rooms', 'hotel', 2, 580),
      (${UT_DORM}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O58-D', 'Dorm beds', 'hostel', 3, 581),
      (${UT_COMPOSITE}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O58-C', 'Composite', 'hotel', 4, 582),
      (${UT_SHARED}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O58-S', 'Shared alternatives', 'hotel', 2, 583),
      (${UT_B}::uuid, ${TENANT_B}::uuid, ${PROPERTY_B}::uuid, 'O58-B', 'Tenant B', 'hotel', 2, 584)
  `;
  await admin`
    INSERT INTO space (id, tenant_id, property_node, code, profile_key, capacity)
    VALUES
      (${SPACE_HOTEL_1}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O58-H1', 'hotel', 1),
      (${SPACE_HOTEL_2}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O58-H2', 'hotel', 1),
      (${SPACE_DORM}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O58-D1', 'hostel', 3),
      (${SPACE_COMPOSITE_1}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O58-C1', 'hotel', 1),
      (${SPACE_COMPOSITE_2}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O58-C2', 'hotel', 1),
      (${SPACE_SHARED}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O58-S1', 'hotel', 1),
      (${SPACE_B}::uuid, ${TENANT_B}::uuid, ${PROPERTY_B}::uuid, 'O58-B1', 'hotel', 1)
  `;
  await admin`
    INSERT INTO sellable_unit (id, tenant_id, unit_type_id, name)
    VALUES
      (${SU_HOTEL_1}::uuid, ${TENANT_A}::uuid, ${UT_HOTEL}::uuid, 'Order 058 Hotel 1'),
      (${SU_HOTEL_2}::uuid, ${TENANT_A}::uuid, ${UT_HOTEL}::uuid, 'Order 058 Hotel 2'),
      (${SU_DORM}::uuid, ${TENANT_A}::uuid, ${UT_DORM}::uuid, 'Order 058 Dorm'),
      (${SU_COMPOSITE}::uuid, ${TENANT_A}::uuid, ${UT_COMPOSITE}::uuid, 'Order 058 Composite'),
      (${SU_SHARED_1}::uuid, ${TENANT_A}::uuid, ${UT_SHARED}::uuid, 'Order 058 Shared 1'),
      (${SU_SHARED_2}::uuid, ${TENANT_A}::uuid, ${UT_SHARED}::uuid, 'Order 058 Shared 2'),
      (${SU_B}::uuid, ${TENANT_B}::uuid, ${UT_B}::uuid, 'Order 058 B')
  `;
  await admin`
    INSERT INTO sellable_unit_space (tenant_id, sellable_unit_id, space_id, claim_mode)
    VALUES
      (${TENANT_A}::uuid, ${SU_HOTEL_1}::uuid, ${SPACE_HOTEL_1}::uuid, 'exclusive'),
      (${TENANT_A}::uuid, ${SU_HOTEL_2}::uuid, ${SPACE_HOTEL_2}::uuid, 'exclusive'),
      (${TENANT_A}::uuid, ${SU_DORM}::uuid, ${SPACE_DORM}::uuid, 'positional'),
      (${TENANT_A}::uuid, ${SU_COMPOSITE}::uuid, ${SPACE_COMPOSITE_1}::uuid, 'exclusive'),
      (${TENANT_A}::uuid, ${SU_COMPOSITE}::uuid, ${SPACE_COMPOSITE_2}::uuid, 'exclusive'),
      (${TENANT_A}::uuid, ${SU_SHARED_1}::uuid, ${SPACE_SHARED}::uuid, 'exclusive'),
      (${TENANT_A}::uuid, ${SU_SHARED_2}::uuid, ${SPACE_SHARED}::uuid, 'exclusive'),
      (${TENANT_B}::uuid, ${SU_B}::uuid, ${SPACE_B}::uuid, 'exclusive')
  `;
  await admin`
    INSERT INTO party (id, tenant_id, kind, display_name)
    VALUES (${PARTY_REF}::uuid, ${TENANT_A}::uuid, 'person', 'Order 058 typed parent')
  `;
  await admin`
    INSERT INTO rate_plan (id, tenant_id, property_node, code, name, currency)
    VALUES (${RATE_REF}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid,
            'O58-PARENT', 'Order 058 typed parent', 'USD')
  `;
  await admin`
    INSERT INTO reservation (
      id, tenant_id, property_node, confirmation_no, primary_party, currency
    ) VALUES (
      ${RESERVATION_REF}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid,
      'O58-PARENT', ${PARTY_REF}::uuid, 'USD'
    )
  `;
  await admin`
    INSERT INTO reservation_segment (
      id, tenant_id, reservation_id, seq, unit_type_id, sellable_unit_id,
      period, rate_plan_id, status
    ) VALUES (
      ${SEGMENT_REF}::uuid, ${TENANT_A}::uuid, ${RESERVATION_REF}::uuid, 1,
      ${UT_HOTEL}::uuid, ${SU_HOTEL_1}::uuid,
      tstzrange('2027-03-13T05:00:00Z', '2027-03-14T05:00:00Z', '[)'),
      ${RATE_REF}::uuid, 'booked'
    )
  `;
});

afterAll(async () => {
  if (!DATABASE_URL) return;
  await admin`DROP TRIGGER IF EXISTS order058_fail_projection_insert ON availability_projection`;
  await admin`DROP FUNCTION IF EXISTS public.order058_fail_projection_insert()`;
  await cleanDynamicState();
  await admin`DELETE FROM reservation_segment WHERE id = ${SEGMENT_REF}::uuid`;
  await admin`DELETE FROM reservation WHERE id = ${RESERVATION_REF}::uuid`;
  await admin`DELETE FROM rate_plan WHERE id = ${RATE_REF}::uuid`;
  await admin`DELETE FROM party WHERE id = ${PARTY_REF}::uuid`;
  await admin`DELETE FROM availability_projection WHERE property_node IN (${PROPERTY_A}::uuid, ${PROPERTY_B}::uuid)`;
  await admin`DELETE FROM sellable_unit_space WHERE sellable_unit_id IN (
    ${SU_HOTEL_1}::uuid, ${SU_HOTEL_2}::uuid, ${SU_DORM}::uuid, ${SU_COMPOSITE}::uuid,
    ${SU_SHARED_1}::uuid, ${SU_SHARED_2}::uuid, ${SU_B}::uuid
  )`;
  await admin`DELETE FROM sellable_unit WHERE id IN (
    ${SU_HOTEL_1}::uuid, ${SU_HOTEL_2}::uuid, ${SU_DORM}::uuid, ${SU_COMPOSITE}::uuid,
    ${SU_SHARED_1}::uuid, ${SU_SHARED_2}::uuid, ${SU_B}::uuid
  )`;
  await admin`DELETE FROM space WHERE id IN (
    ${SPACE_HOTEL_1}::uuid, ${SPACE_HOTEL_2}::uuid, ${SPACE_DORM}::uuid,
    ${SPACE_COMPOSITE_1}::uuid, ${SPACE_COMPOSITE_2}::uuid, ${SPACE_SHARED}::uuid, ${SPACE_B}::uuid
  )`;
  await admin`DELETE FROM unit_type WHERE id IN (
    ${UT_HOTEL}::uuid, ${UT_DORM}::uuid, ${UT_COMPOSITE}::uuid, ${UT_SHARED}::uuid, ${UT_B}::uuid
  )`;
  await admin`DELETE FROM org_node WHERE id IN (${PROPERTY_A}::uuid, ${PROPERTY_B}::uuid)`;
  await admin`DELETE FROM tenant WHERE id IN (${TENANT_A}::uuid, ${TENANT_B}::uuid)`;
  await database.close();
  await admin.close();
}, 30_000);

databaseDescribe("Order 058 truth-derived availability projection rebuild", () => {
  test("P1: empty projection rebuilds exact safe hotel and dorm nightly truth", async () => {
    await cleanDynamicState();
    await admin`DELETE FROM availability_projection WHERE property_node = ${PROPERTY_A}::uuid`;
    expect(await rebuild()).toEqual({
      propertyNode: PROPERTY_A,
      fromDate: FROM_DATE,
      toDate: TO_DATE,
      rows: 6,
      unitTypes: 2,
    });
    const projected = await rows();
    expect(projected).toHaveLength(6);
    for (const date of ["2027-03-13", "2027-03-14", "2027-03-15"]) {
      expect(findRow(projected, UT_HOTEL, date)).toMatchObject({
        physical: 2, sold: 0, held: 0, blocked: 0, ooo: 0, available: 2,
      });
      expect(findRow(projected, UT_DORM, date)).toMatchObject({
        physical: 3, sold: 0, held: 0, blocked: 0, ooo: 0, available: 3,
      });
    }

    const bounds = await admin<Array<{ stay_date: string; from_at: Date; to_at: Date }>>`
      SELECT day::date::text AS stay_date,
             day::timestamp AT TIME ZONE 'America/New_York' AS from_at,
             (day::date + 1)::timestamp AT TIME ZONE 'America/New_York' AS to_at
      FROM generate_series(${FROM_DATE}::date, ${TO_DATE}::date - 1, interval '1 day') AS day
      ORDER BY day
    `;
    expect(bounds.map(({ stay_date, from_at, to_at }) => [stay_date, (to_at.getTime() - from_at.getTime()) / 3_600_000])).toEqual([
      ["2027-03-13", 24], ["2027-03-14", 23], ["2027-03-15", 24],
    ]);
    for (const bound of bounds) {
      const truth = await database.withTenantTransaction(TENANT_A, (tx) => availability.search(tx, {
        propertyNode: PROPERTY_A, from: bound.from_at, to: bound.to_at,
      }));
      const hotel = truth.filter(({ unitTypeId }) => unitTypeId === UT_HOTEL)
        .reduce((sum, option) => sum + option.availableCount, 0);
      const dorm = truth.filter(({ unitTypeId }) => unitTypeId === UT_DORM)
        .reduce((sum, option) => sum + option.availableCount, 0);
      expect(findRow(projected, UT_HOTEL, bound.stay_date).available).toBe(hotel);
      expect(findRow(projected, UT_DORM, bound.stay_date).available).toBe(dorm);
    }
  });

  test("P2: canonical claims and OOS policy produce exact non-overlapping components", async () => {
    await cleanDynamicState();
    await record(SEGMENT_REF, "segment", SPACE_HOTEL_1, "2027-03-13T05:00:00Z", "2027-03-14T05:00:00Z", true);
    await record(HOLD_REF, "hold", SPACE_DORM, "2027-03-14T05:00:00Z", "2027-03-15T04:00:00Z", false);
    await admin`
      INSERT INTO ooo_oos (id, tenant_id, space_id, kind, period, reason)
      VALUES (${OOO_REF}::uuid, ${TENANT_A}::uuid, ${SPACE_HOTEL_2}::uuid, 'ooo',
              tstzrange('2027-03-15T04:00:00Z', '2027-03-16T04:00:00Z', '[)'), 'Order 058 OOO')
    `;
    await record(OOO_REF, "ooo", SPACE_HOTEL_2, "2027-03-15T04:00:00Z", "2027-03-16T04:00:00Z", true);
    await admin`
      INSERT INTO ooo_oos (id, tenant_id, space_id, kind, period, reason)
      VALUES (${OOS_REF}::uuid, ${TENANT_A}::uuid, ${SPACE_DORM}::uuid, 'oos',
              tstzrange('2027-03-15T04:00:00Z', '2027-03-16T04:00:00Z', '[)'), 'Order 058 OOS')
    `;

    await rebuild();
    const projected = await rows();
    expect(findRow(projected, UT_HOTEL, "2027-03-13")).toMatchObject({
      physical: 2, sold: 1, held: 0, blocked: 0, ooo: 0, available: 1,
    });
    expect(findRow(projected, UT_DORM, "2027-03-14")).toMatchObject({
      physical: 3, sold: 0, held: 1, blocked: 0, ooo: 0, available: 2,
    });
    expect(findRow(projected, UT_HOTEL, "2027-03-15")).toMatchObject({
      physical: 2, sold: 0, held: 0, blocked: 0, ooo: 1, available: 1,
    });
    expect(findRow(projected, UT_DORM, "2027-03-15")).toMatchObject({
      physical: 3, sold: 0, held: 0, blocked: 3, ooo: 0, available: 0,
    });

    await setOosPolicy("allowed");
    await rebuild();
    expect(findRow(await rows(), UT_DORM, "2027-03-15")).toMatchObject({ blocked: 0, available: 3 });

    await release(SEGMENT_REF, HOLD_REF, OOO_REF);
    await admin`DELETE FROM ooo_oos WHERE id IN (${OOO_REF}::uuid, ${OOS_REF}::uuid)`;
    await setOosPolicy("blocked");
    await rebuild();
    expect((await rows()).every(({ sold, held, blocked, ooo }) => sold === 0 && held === 0 && blocked === 0 && ooo === 0)).toBeTrue();
  });

  test("P3: unsafe composite and shared alternatives remove stale rows without partial projection", async () => {
    await cleanDynamicState();
    await admin`
      INSERT INTO availability_projection (
        tenant_id, property_node, unit_type_id, stay_date, physical, sold, held, blocked, ooo
      ) VALUES
        (${TENANT_A}::uuid, ${PROPERTY_A}::uuid, ${UT_COMPOSITE}::uuid, ${FROM_DATE}::date, 99, 0, 0, 0, 0),
        (${TENANT_A}::uuid, ${PROPERTY_A}::uuid, ${UT_SHARED}::uuid, ${FROM_DATE}::date, 99, 0, 0, 0, 0)
      ON CONFLICT (property_node, unit_type_id, stay_date) DO UPDATE SET physical = EXCLUDED.physical
    `;
    await rebuild();
    const projected = await rows();
    expect(projected.filter(({ unit_type_id }) => [UT_COMPOSITE, UT_SHARED].includes(unit_type_id))).toEqual([]);
    expect(new Set(projected.map(({ unit_type_id }) => unit_type_id))).toEqual(new Set([UT_HOTEL, UT_DORM]));
    expect(projected).toHaveLength(6);
  });

  test("P4: DST-local days and strict boundaries fail closed without replacing prior rows", async () => {
    await cleanDynamicState();
    await record(DST_REF, "hold", SPACE_DORM, "2027-03-15T03:30:00Z", "2027-03-15T03:45:00Z", false);
    await rebuild();
    const projected = await rows();
    expect(findRow(projected, UT_DORM, "2027-03-14").held).toBe(1);
    expect(findRow(projected, UT_DORM, "2027-03-15").held).toBe(0);
    await release(DST_REF);

    const before = await rows();
    const invalid = [
      { propertyNode: "not-a-uuid", fromDate: FROM_DATE, toDate: TO_DATE },
      { propertyNode: PROPERTY_A, fromDate: "2027-02-30", toDate: TO_DATE },
      { propertyNode: PROPERTY_A, fromDate: FROM_DATE, toDate: FROM_DATE },
      { propertyNode: PROPERTY_A, fromDate: TO_DATE, toDate: FROM_DATE },
      { propertyNode: PROPERTY_A, fromDate: "2027-01-01", toDate: "2028-02-07" },
    ];
    for (const input of invalid) {
      await expect(rebuild(input)).rejects.toBeInstanceOf(InventoryValidationError);
    }
    await expect(rebuild({ propertyNode: "00000000-0000-0000-0000-000000005899", fromDate: FROM_DATE, toDate: TO_DATE }))
      .rejects.toBeInstanceOf(InventoryNotFoundError);
    await expect(rebuild({ propertyNode: PROPERTY_B, fromDate: FROM_DATE, toDate: TO_DATE }))
      .rejects.toBeInstanceOf(InventoryNotFoundError);
    expect(await rows()).toEqual(before);
  });

  test("P5: migration grants only tenant-local projection replacement", async () => {
    await cleanDynamicState();
    await rebuild();
    await admin`
      INSERT INTO availability_projection (
        tenant_id, property_node, unit_type_id, stay_date, physical, sold, held, blocked, ooo
      ) VALUES (${TENANT_B}::uuid, ${PROPERTY_B}::uuid, ${UT_B}::uuid, ${FROM_DATE}::date, 1, 0, 0, 0, 0)
      ON CONFLICT (property_node, unit_type_id, stay_date) DO UPDATE SET physical = EXCLUDED.physical
    `;
    const evidence = await database.withTenantTransaction(TENANT_A, async (tx) => {
      const privileges = await tx<Array<{ projection_delete: boolean; occupancy_delete: boolean; space_delete: boolean }>>`
        SELECT
          has_table_privilege('app_role', 'availability_projection', 'DELETE') AS projection_delete,
          has_table_privilege('app_role', 'space_occupancy', 'DELETE') AS occupancy_delete,
          has_table_privilege('app_role', 'space', 'DELETE') AS space_delete
      `;
      const deleted = await tx<Array<{ unit_type_id: string }>>`
        DELETE FROM availability_projection
        WHERE property_node IN (${PROPERTY_A}::uuid, ${PROPERTY_B}::uuid)
          AND stay_date = ${FROM_DATE}::date
        RETURNING unit_type_id
      `;
      return { privileges: privileges[0], deleted: deleted.map(({ unit_type_id }) => unit_type_id).sort() };
    });
    expect(evidence).toEqual({
      privileges: { projection_delete: true, occupancy_delete: false, space_delete: false },
      deleted: [UT_DORM, UT_HOTEL].sort(),
    });
    expect(await rows(PROPERTY_B)).toHaveLength(1);
    const publicPrivilege = await admin<Array<{ public_access: number }>>`
      SELECT count(*)::int AS public_access
      FROM aclexplode(COALESCE(
        (SELECT relacl FROM pg_class WHERE oid = 'availability_projection'::regclass),
        acldefault('r', (SELECT relowner FROM pg_class WHERE oid = 'availability_projection'::regclass))
      ))
      WHERE grantee = 0
    `;
    expect(publicPrivilege).toEqual([{ public_access: 0 }]);
    await rebuild();
  });

  test("P6: failed replacement rolls back and concurrent rebuilds serialize to one result", async () => {
    await cleanDynamicState();
    await rebuild();
    const before = await rows();
    await admin.unsafe(`
      CREATE FUNCTION public.order058_fail_projection_insert()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.tenant_id = '${TENANT_A}'::uuid THEN
          RAISE EXCEPTION 'order058 injected projection insert failure';
        END IF;
        RETURN NEW;
      END
      $$
    `);
    await admin.unsafe(`
      CREATE TRIGGER order058_fail_projection_insert
      BEFORE INSERT ON availability_projection
      FOR EACH ROW EXECUTE FUNCTION public.order058_fail_projection_insert()
    `);
    try {
      await expect(rebuild()).rejects.toThrow("order058 injected projection insert failure");
      expect(await rows()).toEqual(before);
    } finally {
      await admin`DROP TRIGGER IF EXISTS order058_fail_projection_insert ON availability_projection`;
      await admin`DROP FUNCTION IF EXISTS public.order058_fail_projection_insert()`;
    }

    const results = await Promise.all([rebuild(), rebuild()]);
    expect(results).toEqual([
      { propertyNode: PROPERTY_A, fromDate: FROM_DATE, toDate: TO_DATE, rows: 6, unitTypes: 2 },
      { propertyNode: PROPERTY_A, fromDate: FROM_DATE, toDate: TO_DATE, rows: 6, unitTypes: 2 },
    ]);
    expect(await rows()).toEqual(before);
  });
});
