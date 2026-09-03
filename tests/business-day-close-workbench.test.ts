import { describe, expect, test } from "bun:test";
import {
  BusinessDayCloseWorkbenchService,
  BusinessDayCloseWorkbenchUnavailableError,
  BusinessDayCloseWorkbenchValidationError,
} from "../src/contexts/financials";

const TENANT = "00000000-0000-0000-0000-000000000101";
const PROPERTY = "00000000-0000-0000-0000-000000000201";
const ACTOR = "00000000-0000-0000-0000-000000000301";
const DISCREPANCY = "00000000-0000-0000-0000-000000000401";
const SPACE = "00000000-0000-0000-0000-000000000501";

function readiness(date = "2026-09-02") {
  return {
    tenant_id: TENANT, property_node: PROPERTY, business_date: date,
    captured_at: "2026-09-03T00:00:00.000Z", due_in: 0, due_out: 0,
    open_cashiers: 0, discrepancies: 1, financial_interface: 0, fiscal_interface: 0,
    statutory_interface: 0, channel_delivery: 0, unknown_due: 0, unknown_discrepancy: 0,
    unknown_outbox: 0, unknown_financial: 0, unknown_fiscal: 0, unknown_statutory: 0,
    unknown_channel: 0, oldest_unpublished: null, outbox_age_ms: null,
    outbox_over_threshold: null,
  };
}

function service(responses: unknown[][]) {
  let call = 0;
  const tx = (() => {
    call++;
    const days = (responses[0] ?? []) as Array<Record<string, unknown>>;
    if (days.length === 0 && responses[1] === undefined) return Promise.resolve([]);
    const readinessRow = ((responses[1] ?? [])[0] ?? {}) as Record<string, unknown>;
    const lineage = (responses[2] ?? []) as Array<Record<string, unknown>>;
    const candidates = lineage.filter((row) => row.reported_events === 1 && row.valid_reported_events === 1 && row.carry_links === 0)
      .map((row) => ({ discrepancyId: row.discrepancy_id, spaceId: row.space_id, spaceCode: row.space_code,
        reportedBusinessDate: row.reported_business_date }));
    const unsafe = lineage.filter((row) => row.valid_reported_events !== 0 &&
      (row.reported_events !== 1 || row.valid_reported_events !== 1 || Number(row.carry_links) > 1)).length;
    return Promise.resolve([{
      ...readinessRow,
      workbench_open_days: days.map((row) => ({ businessDate: row.business_date, openedAt: row.opened_at })),
      workbench_open_day_count: days.length,
      workbench_candidates: candidates,
      workbench_candidate_count: candidates.length,
      workbench_unsafe_candidate_count: unsafe,
    }]);
  }) as never;
  const database = {
    withTenantTransaction: async (tenantId: string, operation: (value: never) => Promise<unknown>) => {
      expect(tenantId).toBe(TENANT);
      const result = await operation(tx);
      expect(call).toBe(1);
      return result;
    },
  };
  return new BusinessDayCloseWorkbenchService({ database: database as never });
}

describe("BusinessDayCloseWorkbenchService", () => {
  test("composes deterministic backlog, exact readiness and minimized carry candidates", async () => {
    const result = await service([
      [
        { tenant_id: TENANT, property_node: PROPERTY, business_date: "2026-09-01", opened_at: "2026-09-01T02:00:00Z" },
        { tenant_id: TENANT, property_node: PROPERTY, business_date: "2026-09-02", opened_at: "2026-09-02T02:00:00Z" },
        { tenant_id: TENANT, property_node: PROPERTY, business_date: "2026-09-03", opened_at: "2026-09-03T02:00:00Z" },
      ],
      [readiness()],
      [{ discrepancy_id: DISCREPANCY, space_id: SPACE, space_code: "204",
        reported_business_date: "2026-09-02", reported_events: 1, valid_reported_events: 1, carry_links: 0 }],
    ]).read({ tenantId: TENANT, propertyNode: PROPERTY, businessDate: "2026-09-02", actorId: ACTOR });
    expect(result.currentOpenBusinessDate).toBe("2026-09-03");
    expect(result.openDays.map((day) => [day.businessDate, day.isCurrent])).toEqual([
      ["2026-09-01", false], ["2026-09-02", false], ["2026-09-03", true],
    ]);
    expect(result.readiness.reasons).toEqual([{ code: "unresolved_discrepancy", source: "discrepancies", count: 1 }]);
    expect(result.carryCandidates).toEqual([{ discrepancyId: DISCREPANCY, spaceId: SPACE,
      spaceCode: "204", reportedBusinessDate: "2026-09-02" }]);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.openDays)).toBe(true);
    expect(Object.isFrozen(result.openDays[0])).toBe(true);
    expect(Object.isFrozen(result.carryCandidates[0])).toBe(true);
  });

  test("returns no carry candidates for the current open day without querying lineage", async () => {
    const result = await service([
      [{ tenant_id: TENANT, property_node: PROPERTY, business_date: "2026-09-03", opened_at: "2026-09-03T02:00:00Z" }],
      [readiness("2026-09-03")],
    ]).read({ tenantId: TENANT, propertyNode: PROPERTY, businessDate: "2026-09-03", actorId: ACTOR });
    expect(result.carryCandidates).toEqual([]);
  });

  test("fails the complete read closed for ambiguous selected-day ordinary lineage", async () => {
    for (const [reportedEvents, validEvents] of [[2, 1]]) {
      const read = service([
        [
          { tenant_id: TENANT, property_node: PROPERTY, business_date: "2026-09-02", opened_at: "2026-09-02T02:00:00Z" },
          { tenant_id: TENANT, property_node: PROPERTY, business_date: "2026-09-03", opened_at: "2026-09-03T02:00:00Z" },
        ],
        [readiness()],
        [{ discrepancy_id: DISCREPANCY, space_id: SPACE, space_code: "204",
          reported_business_date: "2026-09-02", reported_events: reportedEvents,
          valid_reported_events: validEvents, carry_links: 0 }],
      ]).read({ tenantId: TENANT, propertyNode: PROPERTY, businessDate: "2026-09-02", actorId: ACTOR });
      await expect(read).rejects.toBeInstanceOf(BusinessDayCloseWorkbenchUnavailableError);
    }
  });

  test("excludes already-carried discrepancies and rejects incoherent duplicate carry lineage", async () => {
    const base = [
      { tenant_id: TENANT, property_node: PROPERTY, business_date: "2026-09-02", opened_at: "2026-09-02T02:00:00Z" },
      { tenant_id: TENANT, property_node: PROPERTY, business_date: "2026-09-03", opened_at: "2026-09-03T02:00:00Z" },
    ];
    const excluded = await service([base, [readiness()], [{ discrepancy_id: DISCREPANCY, space_id: SPACE,
      space_code: "204", reported_business_date: "2026-09-02", reported_events: 1,
      valid_reported_events: 1, carry_links: 1 }]]).read(
      { tenantId: TENANT, propertyNode: PROPERTY, businessDate: "2026-09-02", actorId: ACTOR });
    expect(excluded.carryCandidates).toEqual([]);
    await expect(service([base, [readiness()], [{ discrepancy_id: DISCREPANCY, space_id: SPACE,
      space_code: "204", reported_business_date: "2026-09-02", reported_events: 1,
      valid_reported_events: 1, carry_links: 2 }]]).read(
      { tenantId: TENANT, propertyNode: PROPERTY, businessDate: "2026-09-02", actorId: ACTOR }))
      .rejects.toBeInstanceOf(BusinessDayCloseWorkbenchUnavailableError);
  });

  test("validates exact canonical input and makes unavailable targets indistinguishable", async () => {
    await expect(service([]).read({ tenantId: TENANT, propertyNode: PROPERTY,
      businessDate: "2026-02-30", actorId: ACTOR })).rejects.toBeInstanceOf(BusinessDayCloseWorkbenchValidationError);
    await expect(service([[]]).read({ tenantId: TENANT, propertyNode: PROPERTY,
      businessDate: "2026-09-02", actorId: ACTOR })).rejects.toBeInstanceOf(BusinessDayCloseWorkbenchUnavailableError);
  });

  test("fails closed at MAX+1 without returning a truncated workbench", async () => {
    const days = Array.from({ length: 367 }, (_, index) => ({ tenant_id: TENANT, property_node: PROPERTY,
      business_date: new Date(Date.UTC(2026, 0, 1 + index)).toISOString().slice(0, 10),
      opened_at: new Date(Date.UTC(2026, 0, 1 + index, 2)).toISOString() }));
    await expect(service([days, [readiness("2026-01-01")]]).read({ tenantId: TENANT,
      propertyNode: PROPERTY, businessDate: "2026-01-01", actorId: ACTOR }))
      .rejects.toBeInstanceOf(BusinessDayCloseWorkbenchUnavailableError);
    const candidates = Array.from({ length: 501 }, (_, index) => ({ discrepancy_id: DISCREPANCY,
      space_id: SPACE, space_code: String(index), reported_business_date: "2026-09-02",
      reported_events: 1, valid_reported_events: 1, carry_links: 0 }));
    await expect(service([[
      { tenant_id: TENANT, property_node: PROPERTY, business_date: "2026-09-02", opened_at: "2026-09-02T02:00:00Z" },
      { tenant_id: TENANT, property_node: PROPERTY, business_date: "2026-09-03", opened_at: "2026-09-03T02:00:00Z" },
    ], [readiness()], candidates]).read({ tenantId: TENANT, propertyNode: PROPERTY,
      businessDate: "2026-09-02", actorId: ACTOR })).rejects.toBeInstanceOf(BusinessDayCloseWorkbenchUnavailableError);
  });
});
