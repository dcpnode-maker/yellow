import { expect, test } from "bun:test";

const app = await Bun.file("frontend/yellow/src/App.tsx").text();
const dashboard = await Bun.file("frontend/yellow/src/workspaces/TodayGlassDashboard.tsx").text();

test("Order 631 Today glass dashboard surfaces ADR and RevPAR from operating performance", () => {
  expect(app).toContain("adr={performanceQuery.data ? money(performanceQuery.data.today.adrMinor, performanceQuery.data.property.currency) : null}");
  expect(app).toContain("revpar={performanceQuery.data ? money(performanceQuery.data.today.revparMinor, performanceQuery.data.property.currency) : null}");
  expect(dashboard).toContain("adr: string | null;");
  expect(dashboard).toContain("revpar: string | null;");
  expect(dashboard).toContain('label: "ADR"');
  expect(dashboard).toContain('label: "RevPAR"');
  expect(dashboard).toContain("ADR {averageDailyRate} · RevPAR {revenuePerAvailableRoom}");
});
