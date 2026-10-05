import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import {
  AvailabilityService,
  InventoryValidationError,
  type AvailabilityOption,
  type SearchAvailabilityInput,
} from "../src/contexts/inventory";
import { Database } from "../src/kernel";

const DATABASE_URL = process.env.YELLOW_RESTRICTION_EVALUATION_URL;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_RESTRICTION_EVALUATION === "1";
const TENANT_A = "00000000-0000-0000-0000-000000003710";
const TENANT_B = "00000000-0000-0000-0000-000000003711";
const PROPERTY_A = "00000000-0000-0000-0000-000000003720";
const PROPERTY_B = "00000000-0000-0000-0000-000000003721";
const UNIT_TYPE_A = "00000000-0000-0000-0000-000000003730";
const UNIT_TYPE_B = "00000000-0000-0000-0000-000000003731";
const SPACE_A = "00000000-0000-0000-0000-000000003740";
const SPACE_B = "00000000-0000-0000-0000-000000003741";
const SELLABLE_A = "00000000-0000-0000-0000-000000003750";
const SELLABLE_B = "00000000-0000-0000-0000-000000003751";
const RATE_PLAN_A = "00000000-0000-0000-0000-000000003760";
const RATE_PLAN_OTHER = "00000000-0000-0000-0000-000000003761";
const PROPERTY_TIMEZONE = "Pacific/Kiritimati";

if (REQUIRE_DATABASE && !DATABASE_URL) {
  throw new Error("YELLOW_RESTRICTION_EVALUATION_URL is required by the Order 036 proof");
}

type RestrictionKind = "closed" | "cta" | "ctd" | "min_los" | "max_los" | "min_adv" | "max_adv";

interface Calendar {
  readonly fromAt: Date;
  readonly toAt: Date;
  readonly bookingDate: string;
  readonly arrivalDate: string;
  readonly arrivalNext: string;
  readonly departureDate: string;
  readonly departureNext: string;
}

interface RestrictionDraft {
  readonly kind: RestrictionKind;
  readonly value?: number;
  readonly unitTypeId?: string;
  readonly ratePlanId?: string;
  readonly channelCode?: string;
  readonly start?: string;
  readonly end?: string;
}

const databaseDescribe = DATABASE_URL ? describe.serial : describe.skip;
const availability = new AvailabilityService();
let admin: SQL;
let database: Database;
let calendar: Calendar;
let unrestricted: readonly AvailabilityOption[] = [];

function physical(options: readonly AvailabilityOption[]) {
  return options.map(({ bookable: _bookable, restrictionsApplied: _restrictions, ...option }) => option);
}

function option(options: readonly AvailabilityOption[], sellableUnitId: string) {
  const found = options.find((candidate) => candidate.sellableUnitId === sellableUnitId);
  if (!found) throw new Error(`Missing fixture option ${sellableUnitId}`);
  return found;
}

async function search(
  dimensions: Pick<SearchAvailabilityInput, "ratePlanId" | "channelCode"> = {},
  tenantId = TENANT_A,
  propertyNode = PROPERTY_A,
) {
  return database.withTenantTransaction(tenantId, (tx) => availability.search(tx, {
    propertyNode,
    from: calendar.fromAt,
    to: calendar.toAt,
    ...dimensions,
  }));
}

async function createRestriction(draft: RestrictionDraft): Promise<string> {
  const rows = await admin<Array<{ id: string }>>`
    INSERT INTO restriction (
      tenant_id, scope_node, unit_type_id, rate_plan_id, channel_code,
      kind, value, stay_dates, source
    ) VALUES (
      ${TENANT_A}::uuid, ${PROPERTY_A}::uuid,
      ${draft.unitTypeId ?? null}::uuid, ${draft.ratePlanId ?? null}::uuid,
      ${draft.channelCode ?? null}, ${draft.kind}, ${draft.value ?? null},
      daterange(${draft.start ?? calendar.arrivalDate}::date,
                ${draft.end ?? calendar.arrivalNext}::date, '[)'),
      'manual'
    )
    RETURNING id
  `;
  const row = rows[0];
  if (!row) throw new Error("Restriction fixture insert returned no id");
  return row.id;
}

async function clearRestrictions() {
  await admin`DELETE FROM restriction WHERE scope_node = ${PROPERTY_A}::uuid`;
}

beforeAll(async () => {
  if (!DATABASE_URL) return;
  admin = new SQL(DATABASE_URL, { max: 4 });
  database = Database.connect(DATABASE_URL, { maxConnections: 8 });

  await clearRestrictions();
  await admin`DELETE FROM rate_plan WHERE id IN (${RATE_PLAN_A}::uuid, ${RATE_PLAN_OTHER}::uuid)`;
  await admin`DELETE FROM sellable_unit_space WHERE sellable_unit_id IN (${SELLABLE_A}::uuid, ${SELLABLE_B}::uuid)`;
  await admin`DELETE FROM sellable_unit WHERE id IN (${SELLABLE_A}::uuid, ${SELLABLE_B}::uuid)`;
  await admin`DELETE FROM space WHERE id IN (${SPACE_A}::uuid, ${SPACE_B}::uuid)`;
  await admin`DELETE FROM unit_type WHERE id IN (${UNIT_TYPE_A}::uuid, ${UNIT_TYPE_B}::uuid)`;
  await admin`DELETE FROM org_node WHERE id IN (${PROPERTY_A}::uuid, ${PROPERTY_B}::uuid)`;
  await admin`DELETE FROM tenant WHERE id IN (${TENANT_A}::uuid, ${TENANT_B}::uuid)`;

  await admin`
    INSERT INTO tenant (id, slug, name, tier, status)
    VALUES
      (${TENANT_A}::uuid, 'order036-a', 'Order 036 A', 'shared', 'active'),
      (${TENANT_B}::uuid, 'order036-b', 'Order 036 B', 'shared', 'active')
  `;
  await admin`
    INSERT INTO org_node (id, tenant_id, path, kind, name, timezone, currency)
    VALUES
      (${PROPERTY_A}::uuid, ${TENANT_A}::uuid, 'order036_a', 'property', 'Order 036 A', ${PROPERTY_TIMEZONE}, 'USD'),
      (${PROPERTY_B}::uuid, ${TENANT_B}::uuid, 'order036_b', 'property', 'Order 036 B', 'UTC', 'USD')
  `;
  await admin`
    INSERT INTO unit_type (id, tenant_id, property_node, code, name, profile_key, max_occupancy, sort_order)
    VALUES
      (${UNIT_TYPE_A}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O36-A', 'Order 036 A', 'hotel', 2, 360),
      (${UNIT_TYPE_B}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O36-B', 'Order 036 B', 'hotel', 2, 361)
  `;
  await admin`
    INSERT INTO space (id, tenant_id, property_node, code, profile_key, capacity)
    VALUES
      (${SPACE_A}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O36-A', 'hotel', 1),
      (${SPACE_B}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O36-B', 'hotel', 1)
  `;
  await admin`
    INSERT INTO sellable_unit (id, tenant_id, unit_type_id, name)
    VALUES
      (${SELLABLE_A}::uuid, ${TENANT_A}::uuid, ${UNIT_TYPE_A}::uuid, 'Order 036 A'),
      (${SELLABLE_B}::uuid, ${TENANT_A}::uuid, ${UNIT_TYPE_B}::uuid, 'Order 036 B')
  `;
  await admin`
    INSERT INTO sellable_unit_space (tenant_id, sellable_unit_id, space_id, claim_mode)
    VALUES
      (${TENANT_A}::uuid, ${SELLABLE_A}::uuid, ${SPACE_A}::uuid, 'exclusive'),
      (${TENANT_A}::uuid, ${SELLABLE_B}::uuid, ${SPACE_B}::uuid, 'exclusive')
  `;
  await admin`
    INSERT INTO rate_plan (id, tenant_id, property_node, code, name, currency)
    VALUES
      (${RATE_PLAN_A}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O36-A', 'Order 036 A', 'USD'),
      (${RATE_PLAN_OTHER}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O36-B', 'Order 036 B', 'USD')
  `;

  const rows = await admin<Array<{
    from_at: Date;
    to_at: Date;
    booking_date: string;
    arrival_date: string;
    arrival_next: string;
    departure_date: string;
    departure_next: string;
  }>>`
    WITH local_clock AS (
      SELECT (transaction_timestamp() AT TIME ZONE ${PROPERTY_TIMEZONE})::date AS booking_date
    )
    SELECT
      ((booking_date + 10)::timestamp AT TIME ZONE ${PROPERTY_TIMEZONE}) AS from_at,
      ((booking_date + 13)::timestamp AT TIME ZONE ${PROPERTY_TIMEZONE}) AS to_at,
      booking_date::text AS booking_date,
      (booking_date + 10)::text AS arrival_date,
      (booking_date + 11)::text AS arrival_next,
      (booking_date + 13)::text AS departure_date,
      (booking_date + 14)::text AS departure_next
    FROM local_clock
  `;
  const dates = rows[0];
  if (!dates) throw new Error("Property-local calendar fixture returned no row");
  calendar = {
    fromAt: new Date(dates.from_at),
    toAt: new Date(dates.to_at),
    bookingDate: dates.booking_date,
    arrivalDate: dates.arrival_date,
    arrivalNext: dates.arrival_next,
    departureDate: dates.departure_date,
    departureNext: dates.departure_next,
  };
  unrestricted = await search();
});

beforeEach(async () => {
  if (!DATABASE_URL) return;
  await clearRestrictions();
});

afterAll(async () => {
  if (!DATABASE_URL) return;
  await clearRestrictions();
  await admin`DELETE FROM rate_plan WHERE id IN (${RATE_PLAN_A}::uuid, ${RATE_PLAN_OTHER}::uuid)`;
  await admin`DELETE FROM sellable_unit_space WHERE sellable_unit_id IN (${SELLABLE_A}::uuid, ${SELLABLE_B}::uuid)`;
  await admin`DELETE FROM sellable_unit WHERE id IN (${SELLABLE_A}::uuid, ${SELLABLE_B}::uuid)`;
  await admin`DELETE FROM space WHERE id IN (${SPACE_A}::uuid, ${SPACE_B}::uuid)`;
  await admin`DELETE FROM unit_type WHERE id IN (${UNIT_TYPE_A}::uuid, ${UNIT_TYPE_B}::uuid)`;
  await admin`DELETE FROM org_node WHERE id IN (${PROPERTY_A}::uuid, ${PROPERTY_B}::uuid)`;
  await admin`DELETE FROM tenant WHERE id IN (${TENANT_A}::uuid, ${TENANT_B}::uuid)`;
  await admin.close();
  await database.close();
});

databaseDescribe("Order 036 property-local restriction evaluation", () => {
  test("P1: every restriction kind blocks only on its exact date condition without changing physical counts", async () => {
    expect(unrestricted).toHaveLength(2);
    expect(unrestricted.every(({ bookable, restrictionsApplied }) => bookable && restrictionsApplied.length === 0)).toBeTrue();
    const cases: readonly RestrictionDraft[] = [
      { kind: "closed", start: calendar.arrivalNext, end: calendar.departureDate },
      { kind: "cta" },
      { kind: "ctd", start: calendar.departureDate, end: calendar.departureNext },
      { kind: "min_los", value: 4 },
      { kind: "max_los", value: 2 },
      { kind: "min_adv", value: 11 },
      { kind: "max_adv", value: 9 },
    ];
    for (const draft of cases) {
      await clearRestrictions();
      const matchingId = await createRestriction(draft);
      const outsideId = await createRestriction({
        ...draft,
        start: calendar.departureNext,
        end: `${Number(calendar.departureNext.slice(0, 4)) + 1}-01-01`,
      });
      const evaluated = await search();
      expect(physical(evaluated)).toEqual(physical(unrestricted));
      expect(evaluated.every(({ bookable }) => !bookable)).toBeTrue();
      for (const result of evaluated) {
        expect(result.restrictionsApplied.map(({ id }) => id)).toEqual([matchingId]);
        expect(result.restrictionsApplied[0]?.blocks).toBeTrue();
        expect(result.restrictionsApplied.some(({ id }) => id === outsideId)).toBeFalse();
      }
    }
  });

  test("P2: unit, rate-plan, and channel dimensions activate only exact matches", async () => {
    const unit = await createRestriction({ kind: "cta", unitTypeId: UNIT_TYPE_A });
    const rate = await createRestriction({ kind: "cta", ratePlanId: RATE_PLAN_A });
    const channel = await createRestriction({ kind: "cta", channelCode: "DIRECT" });

    const absent = await search();
    expect(option(absent, SELLABLE_A).restrictionsApplied.map(({ id }) => id)).toEqual([unit]);
    expect(option(absent, SELLABLE_B).restrictionsApplied).toEqual([]);

    const exact = await search({ ratePlanId: RATE_PLAN_A, channelCode: "DIRECT" });
    expect(option(exact, SELLABLE_A).restrictionsApplied.map(({ id }) => id).sort()).toEqual([unit, rate, channel].sort());
    expect(option(exact, SELLABLE_B).restrictionsApplied.map(({ id }) => id).sort()).toEqual([rate, channel].sort());

    const other = await search({ ratePlanId: RATE_PLAN_OTHER, channelCode: "OTA" });
    expect(option(other, SELLABLE_A).restrictionsApplied.map(({ id }) => id)).toEqual([unit]);
    expect(option(other, SELLABLE_B).restrictionsApplied).toEqual([]);
  });

  test("P3: a non-blocking rule remains visible without making the option unbookable", async () => {
    const id = await createRestriction({ kind: "min_los", value: 2 });
    const evaluated = await search();
    for (const result of evaluated) {
      expect(result.bookable).toBeTrue();
      expect(result.restrictionsApplied).toEqual([{ id, kind: "min_los", value: 2, blocks: false }]);
    }
  });

  test("P4: arrival and booking boundaries are evaluated in the property timezone", async () => {
    expect(calendar.fromAt.toISOString().slice(0, 10)).not.toBe(calendar.arrivalDate);
    const cta = await createRestriction({ kind: "cta" });
    const advance = await createRestriction({ kind: "max_adv", value: 10 });
    const evaluated = await search();
    for (const result of evaluated) {
      expect(result.restrictionsApplied).toEqual(expect.arrayContaining([
        { id: cta, kind: "cta", value: null, blocks: true },
        { id: advance, kind: "max_adv", value: 10, blocks: false },
      ]));
      expect(result.bookable).toBeFalse();
    }
  });

  test("P5: tenant/property isolation and malformed optional dimensions fail closed", async () => {
    await createRestriction({ kind: "closed" });
    expect(await search({}, TENANT_B, PROPERTY_A)).toEqual([]);
    expect(await search({}, TENANT_A, PROPERTY_B)).toEqual([]);
    await expect(search({ ratePlanId: "not-a-uuid" })).rejects.toBeInstanceOf(InventoryValidationError);
    await expect(search({ channelCode: " DIRECT " })).rejects.toBeInstanceOf(InventoryValidationError);
    await expect(search({ channelCode: "bad/channel" })).rejects.toBeInstanceOf(InventoryValidationError);
  });
});
