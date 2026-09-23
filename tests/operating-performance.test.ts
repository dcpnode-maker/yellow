import { expect, test } from "bun:test";
import { OperatingPerformanceService } from "../src/contexts/reporting";
import type { Tx } from "../src/kernel";

const TENANT = "00000000-0000-0000-0000-000000000001";
const PROPERTY = "00000000-0000-0000-0000-000000000002";

test("operating performance keeps money exact and produces day, period and OTB comparisons", async () => {
  let call = 0;
  const tx = (async (strings: TemplateStringsArray) => {
    call += 1;
    const sql = strings.raw.join("");
    if (call === 1) {
      expect(sql).toContain("current_setting('app.tenant_id', true)");
      return [{ name: "Locanda", timezone: "Asia/Riyadh", currency: "SAR", today: "2026-09-20",
        config: { operating_plan: { budget_occupancy_basis_points: 7_500,
          forecast_occupancy_basis_points: 7_000, budget_adr_minor: 20_000, forecast_adr_minor: 21_000 } } }];
    }
    expect(sql).toContain("sum(room_revenue_minor)::text");
    return [
      { business_date: "2025-09-20", rooms_available: 20, rooms_sold: 10, room_revenue_minor: "90071992547409930" },
      { business_date: "2026-09-20", rooms_available: 20, rooms_sold: 14, room_revenue_minor: "280000" },
      { business_date: "2026-09-21", rooms_available: 20, rooms_sold: 14, room_revenue_minor: "294000" },
    ];
  }) as unknown as Tx;

  const result = await new OperatingPerformanceService().load(tx, { tenantId: TENANT, propertyNode: PROPERTY });
  expect(result.today).toEqual({ roomNights: 14, roomsAvailable: 20, occupancyBasisPoints: 7_000,
    roomRevenueMinor: "280000", adrMinor: "20000", revparMinor: "14000" });
  expect(result.todayComparison.lastYear.roomRevenueMinor).toBe("90071992547409930");
  expect(result.todayComparison.forecast.roomNights).toBe(14);
  expect(result.todayComparison.budget.roomNights).toBe(15);
  expect(result.periods.map((period) => period.label)).toEqual(["MTD", "QTD", "YTD"]);
  expect(result.periods[0]?.lastYear.roomRevenueMinor).toBe("90071992547409930");
  expect(result.periods[0]?.forecast.roomNights).toBe(14);
  expect(result.periods[0]?.budget.roomNights).toBe(15);
  expect(result.otb).toEqual([{ date: "2026-09-21", roomsAvailable: 20, roomsSold: 14,
    occupancyBasisPoints: 7_000, roomRevenueMinor: "294000" }]);
  expect(result.provenance).toBe("scenario_reporting_projection");
});

test("operating performance rejects malformed scope identifiers before SQL", async () => {
  let touched = false;
  const tx = (async () => { touched = true; return []; }) as unknown as Tx;
  await expect(new OperatingPerformanceService().load(tx, { tenantId: "not-a-uuid", propertyNode: PROPERTY }))
    .rejects.toThrow("must be UUIDs");
  expect(touched).toBe(false);
});
