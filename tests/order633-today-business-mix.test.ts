import { expect, test } from "bun:test";

const app = await Bun.file("frontend/yellow/src/App.tsx").text();
const dashboard = await Bun.file("frontend/yellow/src/workspaces/TodayGlassDashboard.tsx").text();
const css = await Bun.file("frontend/yellow/src/styles.css").text();

test("Order 633 Today dashboard renders market/source/channel business mix", () => {
  expect(app).toContain('queryKey: ["today-business-mix", propertyId, businessMixPeriod]');
  expect(app).toContain("loadBusinessMix(propertyId, businessMixPeriod, signal)");
  expect(app).toContain("businessMix={businessMix}");
  expect(dashboard).toContain("BusinessMixSnapshot");
  expect(dashboard).toContain("Business mix by market segment group, market segment and source");
  expect(dashboard).toContain("No recorded source performance for this period.");
  expect(dashboard).toContain("BUSINESS_MIX_PERIODS.map");
});

test("Order 633 business mix remains mobile-contained glass UI", () => {
  expect(css).toContain(".today-business-mix");
  expect(css).toContain(".today-mix-scroll");
  expect(css).toContain(".today-mix-periods");
  expect(css).toContain("@media (max-width: 560px)");
  expect(css).toContain("overflow-x: auto");
  expect(css).toContain("@media (prefers-reduced-transparency: reduce)");
});
