import { expect, test } from "bun:test";
import { ReservationBoardService, ReservationBoardValidationError, ReservationBoardConflictError, type ReservationBoardInput } from "../src/contexts/reservations";
import type { Tx } from "../src/kernel";
const TENANT = "00000000-0000-0000-0000-000000075401";
const PROPERTY = "00000000-0000-0000-0000-000000075402";
const PARTY = "00000000-0000-0000-0000-000000075403";
const ID = "00000000-0000-0000-0000-000000075404";
const service = new ReservationBoardService();
function row() { return {
  id: ID, confirmation_no: "Y754", status: "reserved", operational_state: "reserved", primary_party: PARTY,
  visible_primary_party_id: PARTY, display_name: "Synthetic", stay_from: "2026-10-04T12:00:00.000000Z",
  stay_to: "2026-10-05T12:00:00.000000Z", created_at: "2026-10-01T12:00:00.123456Z",
  unit_type_label: "Room", sellable_unit_label: null, rate_plan_label: "BAR", adults: 1, children: 0,
  channel_code: "direct", market_code: null, source_code: null, currency: "INR",
  arrival_direction: null, arrival_mode: null, arrival_carrier: null, arrival_service_no: null,
  arrival_scheduled_at: null, arrival_pickup_requested: null, arrival_pickup_task_id: null, visible_arrival_pickup_task_id: null,
  departure_direction: null, departure_mode: null, departure_carrier: null, departure_service_no: null, departure_scheduled_at: null,
}; }
function fixture(day: string | null = "2026-10-04", result = [row(), row()]) {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  const tx = (async (sql: TemplateStringsArray, ...values: unknown[]) => {
    calls.push({ sql: sql.join("?"), values });
    return sql.join("").includes("MAX(day.business_date)") ? [{ business_date: day }] : result;
  }) as unknown as Tx;
  return { tx, calls };
}
const input = (extra: Partial<ReservationBoardInput> = {}): ReservationBoardInput => ({ tenantId: TENANT, propertyNode: PROPERTY, ...extra });

test("stage, combination and cursor shape validation precede SQL", async () => {
  const f = fixture();
  for (const value of [{ stage: "all" }, { stage: "arrival", status: "due_in" }, { stage: null }, { stage: "arrival", after: "bad" }]) {
    await expect(service.list(f.tx, input(value as never))).rejects.toBeInstanceOf(ReservationBoardValidationError);
  }
  expect(f.calls).toHaveLength(0);
});

test("stages use persisted property day and parameterized predicates before LIMIT", async () => {
  for (const stage of ["pre_arrival", "arrival", "in_house", "departure", "post_departure"] as const) {
    const f = fixture();
    const page = await service.list(f.tx, input({ stage, limit: 1 }));
    expect(page.businessDate).toBe("2026-10-04");
    expect(page.reservations).toHaveLength(1);
    expect(f.calls).toHaveLength(2);
    expect(f.calls[0]!.sql).toContain("day.sealed_at IS NULL");
    expect(f.calls[0]!.sql).toContain("property.tenant_id = current_setting('app.tenant_id', true)::uuid");
    expect(f.calls[0]!.values).toContain(TENANT);
    expect(f.calls[0]!.values).toContain(PROPERTY);
    const sql = f.calls[1]!.sql;
    expect(f.calls[1]!.values).toContain(stage);
    expect(f.calls[1]!.values).toContain("2026-10-04");
    expect(sql.indexOf("stage_stay")).toBeLessThan(sql.indexOf("LIMIT"));
    expect(sql).toContain("segment.status <> 'cancelled'");
    expect(sql).toContain("checkin_fact.business_date = property_context.business_date");
    expect(sql).toContain("successor.supersedes = checkin_fact.id");
    expect(sql).toContain("successor.supersedes = checkout_fact.id");
    expect(sql).not.toContain("OFFSET");
    expect(sql).not.toMatch(/\b(INSERT|UPDATE|DELETE)\b/);
  }
});

test("missing or malformed persisted days fail before reservation reads", async () => {
  for (const day of [null, "2026-02-30", "0000-01-01", "invalid"]) {
    const f = fixture(day);
    await expect(service.list(f.tx, input({ stage: "arrival" }))).rejects.toBeInstanceOf(ReservationBoardConflictError);
    expect(f.calls).toHaveLength(1);
  }
});

test("stage cursor binds day, stage, tenant, property and filters; legacy remains separate", async () => {
  const filter = { stage: "arrival" as const, limit: 1, partyId: PARTY, from: new Date("2026-10-01Z"), to: new Date("2026-10-10Z") };
  const first = await service.list(fixture().tx, input(filter));
  expect(first.nextCursor!.length).toBeLessThanOrEqual(512);
  const after = first.nextCursor!;
  expect((await service.list(fixture().tx, input({ ...filter, after }))).businessDate).toBe("2026-10-04");
  for (const change of [{ stage: "departure" }, { tenantId: PROPERTY }, { propertyNode: TENANT }, { partyId: undefined }, { from: new Date("2026-10-02Z") }]) {
    await expect(service.list(fixture().tx, input({ ...filter, after, ...change } as never))).rejects.toBeInstanceOf(ReservationBoardValidationError);
  }
  await expect(service.list(fixture("2026-10-05").tx, input({ ...filter, after }))).rejects.toBeInstanceOf(ReservationBoardValidationError);
  await expect(service.list(fixture().tx, input({ after }))).rejects.toBeInstanceOf(ReservationBoardValidationError);
  const legacyFixture = fixture();
  const legacy = await service.list(legacyFixture.tx, input({ limit: 1 }));
  expect(legacyFixture.calls).toHaveLength(1);
  expect(legacy.businessDate).toBeUndefined();
  expect(JSON.parse(atob(legacy.nextCursor!.replaceAll("-", "+").replaceAll("_", "/"))).v).toBe(1);
  await expect(service.list(fixture().tx, input({ stage: "arrival", after: legacy.nextCursor! }))).rejects.toBeInstanceOf(ReservationBoardValidationError);
});
