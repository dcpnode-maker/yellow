import { expect, test } from "bun:test";

const app = await Bun.file("frontend/yellow/src/App.tsx").text();
const dashboard = await Bun.file("frontend/yellow/src/workspaces/TodayGlassDashboard.tsx").text();
const css = await Bun.file("frontend/yellow/src/styles.css").text();

test("Order 633 Today dashboard renders market/source/channel business mix", () => {
  expect(app).toContain("const businessMix = useMemo");
  expect(app).toContain("stay.marketCode");
  expect(app).toContain("stay.sourceCode");
  expect(app).toContain("stay.channelCode");
  expect(app).toContain("businessMix={businessMix}");
  expect(dashboard).toContain("type BusinessMixSignal");
  expect(dashboard).toContain("Business mix by market segment group, market segment and source");
  expect(dashboard).toContain("MSG → MS · source · channel");
  expect(dashboard).toContain("No coded movement rows yet.");
});

test("Order 633 business mix remains mobile-contained glass UI", () => {
  expect(css).toContain(".today-business-mix");
  expect(css).toContain(".today-business-mix ul");
  expect(css).toContain("grid-template-columns: repeat(3, minmax(0,1fr));");
  expect(css).toContain("@media (max-width: 560px)");
  expect(css).toContain("overflow-x: auto");
  expect(css).toContain("@media (prefers-reduced-transparency: reduce)");
});
