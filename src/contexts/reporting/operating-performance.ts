import type { Tx } from "../../kernel";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

type DailyRow = Readonly<{
  business_date: string;
  rooms_available: number;
  rooms_sold: number;
  room_revenue_minor: string;
}>;

type PropertyRow = Readonly<{
  name: string;
  timezone: string;
  currency: string;
  today: string;
  config: unknown;
}>;

export type PerformanceMetric = Readonly<{
  roomNights: number;
  roomsAvailable: number;
  occupancyBasisPoints: number;
  roomRevenueMinor: string;
  adrMinor: string;
  revparMinor: string;
}>;

export type PerformancePeriod = Readonly<{
  key: "mtd" | "qtd" | "ytd";
  label: "MTD" | "QTD" | "YTD";
  actual: PerformanceMetric;
  lastYear: PerformanceMetric;
  forecast: PerformanceMetric;
  budget: PerformanceMetric;
}>;

export type OperatingPerformance = Readonly<{
  property: Readonly<{ name: string; businessDate: string; currency: string }>;
  today: PerformanceMetric;
  todayComparison: Readonly<{ actual: PerformanceMetric; lastYear: PerformanceMetric; forecast: PerformanceMetric; budget: PerformanceMetric }>;
  periods: readonly PerformancePeriod[];
  otb: readonly Readonly<{ date: string; roomsAvailable: number; roomsSold: number; occupancyBasisPoints: number; roomRevenueMinor: string }>[];
  provenance: "scenario_reporting_projection";
}>;

type Plan = Readonly<{ budgetOccupancyBasisPoints: number; forecastOccupancyBasisPoints: number; budgetAdrMinor: bigint; forecastAdrMinor: bigint }>;

function date(value: string): Date { return new Date(`${value}T00:00:00.000Z`); }
function iso(value: Date): string { return value.toISOString().slice(0, 10); }
function addYears(value: string, years: number): string { const result = date(value); result.setUTCFullYear(result.getUTCFullYear() + years); return iso(result); }
function startOfMonth(value: string): string { return `${value.slice(0, 7)}-01`; }
function startOfYear(value: string): string { return `${value.slice(0, 4)}-01-01`; }
function startOfQuarter(value: string): string {
  const parsed = date(value); const month = Math.floor(parsed.getUTCMonth() / 3) * 3;
  return `${parsed.getUTCFullYear()}-${String(month + 1).padStart(2, "0")}-01`;
}
function clampBasisPoints(value: number): number { return Math.max(0, Math.min(10_000, Math.round(value))); }
function metric(available: number, sold: number, revenue: bigint): PerformanceMetric {
  const safeAvailable = Math.max(0, Math.trunc(available));
  const safeSold = Math.max(0, Math.min(safeAvailable, Math.trunc(sold)));
  return Object.freeze({
    roomNights: safeSold,
    roomsAvailable: safeAvailable,
    occupancyBasisPoints: safeAvailable === 0 ? 0 : clampBasisPoints(safeSold * 10_000 / safeAvailable),
    roomRevenueMinor: revenue.toString(),
    adrMinor: safeSold === 0 ? "0" : (revenue / BigInt(safeSold)).toString(),
    revparMinor: safeAvailable === 0 ? "0" : (revenue / BigInt(safeAvailable)).toString(),
  });
}
function aggregate(rows: readonly DailyRow[], from: string, to: string): PerformanceMetric {
  let available = 0; let sold = 0; let revenue = 0n;
  for (const row of rows) if (row.business_date >= from && row.business_date <= to) {
    available += row.rooms_available; sold += row.rooms_sold; revenue += BigInt(row.room_revenue_minor);
  }
  return metric(available, sold, revenue);
}
function planned(available: number, occupancyBasisPoints: number, adrMinor: bigint): PerformanceMetric {
  const sold = Math.round(available * occupancyBasisPoints / 10_000);
  return metric(available, sold, BigInt(sold) * adrMinor);
}
function planOf(config: unknown): Plan {
  const root = typeof config === "object" && config !== null && !Array.isArray(config) ? config as Record<string, unknown> : {};
  const raw = typeof root.operating_plan === "object" && root.operating_plan !== null && !Array.isArray(root.operating_plan)
    ? root.operating_plan as Record<string, unknown> : {};
  const integer = (key: string, fallback: number) => Number.isInteger(raw[key]) ? Number(raw[key]) : fallback;
  return Object.freeze({
    budgetOccupancyBasisPoints: clampBasisPoints(integer("budget_occupancy_basis_points", 7_400)),
    forecastOccupancyBasisPoints: clampBasisPoints(integer("forecast_occupancy_basis_points", 7_200)),
    budgetAdrMinor: BigInt(integer("budget_adr_minor", 25_000)),
    forecastAdrMinor: BigInt(integer("forecast_adr_minor", 24_000)),
  });
}

export class OperatingPerformanceService {
  async load(tx: Tx, input: Readonly<{ tenantId: string; propertyNode: string }>): Promise<OperatingPerformance> {
    if (!UUID.test(input.tenantId) || !UUID.test(input.propertyNode)) throw new TypeError("tenantId and propertyNode must be UUIDs");
    const properties = await tx<PropertyRow[]>`
      SELECT name, timezone, currency::text AS currency,
             (transaction_timestamp() AT TIME ZONE timezone)::date::text AS today, config
      FROM org_node
      WHERE tenant_id=${input.tenantId}::uuid AND tenant_id=current_setting('app.tenant_id', true)::uuid
        AND id=${input.propertyNode}::uuid AND kind='property'`;
    const property = properties[0];
    if (!property || properties.length !== 1) throw new Error("Property performance scope was not found");
    const year = Number(property.today.slice(0, 4));
    const rows = await tx<DailyRow[]>`
      SELECT business_date::text,
             sum(rooms_available)::int AS rooms_available,
             sum(rooms_sold)::int AS rooms_sold,
             sum(room_revenue_minor)::text AS room_revenue_minor
      FROM stats_daily
      WHERE tenant_id=${input.tenantId}::uuid AND tenant_id=current_setting('app.tenant_id', true)::uuid
        AND property_node=${input.propertyNode}::uuid
        AND business_date BETWEEN ${`${year - 1}-01-01`}::date AND (${property.today}::date + 90)
      GROUP BY business_date ORDER BY business_date`;
    const plan = planOf(property.config);
    const periodInputs = [
      ["mtd", "MTD", startOfMonth(property.today)],
      ["qtd", "QTD", startOfQuarter(property.today)],
      ["ytd", "YTD", startOfYear(property.today)],
    ] as const;
    const periods = periodInputs.map(([key, label, from]) => {
      const actual = aggregate(rows, from, property.today);
      const lastYear = aggregate(rows, addYears(from, -1), addYears(property.today, -1));
      return Object.freeze({ key, label, actual, lastYear,
        forecast: planned(actual.roomsAvailable, plan.forecastOccupancyBasisPoints, plan.forecastAdrMinor),
        budget: planned(actual.roomsAvailable, plan.budgetOccupancyBasisPoints, plan.budgetAdrMinor),
      });
    });
    const today = aggregate(rows, property.today, property.today);
    const todayComparison = Object.freeze({ actual: today,
      lastYear: aggregate(rows, addYears(property.today, -1), addYears(property.today, -1)),
      forecast: planned(today.roomsAvailable, plan.forecastOccupancyBasisPoints, plan.forecastAdrMinor),
      budget: planned(today.roomsAvailable, plan.budgetOccupancyBasisPoints, plan.budgetAdrMinor),
    });
    const otb = rows.filter((row) => row.business_date > property.today).slice(0, 56).map((row) => Object.freeze({
      date: row.business_date,
      roomsAvailable: row.rooms_available,
      roomsSold: row.rooms_sold,
      occupancyBasisPoints: row.rooms_available === 0 ? 0 : clampBasisPoints(row.rooms_sold * 10_000 / row.rooms_available),
      roomRevenueMinor: row.room_revenue_minor,
    }));
    return Object.freeze({ property: Object.freeze({ name: property.name, businessDate: property.today, currency: property.currency }),
      today, todayComparison, periods: Object.freeze(periods), otb: Object.freeze(otb), provenance: "scenario_reporting_projection" });
  }
}
