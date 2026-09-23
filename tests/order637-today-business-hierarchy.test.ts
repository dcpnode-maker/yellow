import { expect, test } from "bun:test";

const app = await Bun.file("frontend/yellow/src/App.tsx").text();
const dashboard = await Bun.file("frontend/yellow/src/workspaces/TodayGlassDashboard.tsx").text();

test("Order 637 Today business mix renders MSG to MS hierarchy without guessing", () => {
  expect(app).toContain("type BusinessMixRow");
  expect(app).toContain("const BUSINESS_HIERARCHY = Object.freeze");
  expect(app).toContain("function commercialCode");
  expect(app).toContain("function businessMarket");
  expect(app).toContain("function businessSource");
  expect(app).toContain("marketSegmentGroup: market.group");
  expect(app).toContain("marketSegment: market.segment");
  expect(app).toContain("source: source.label");
  expect(app).toContain("channel: source.channel");
  expect(app).toContain("Missing market segment");
  expect(app).toContain("Missing source");
  expect(app).toContain("left.marketSegmentGroup.localeCompare");
});

test("Order 637 Today business mix copy names hotel hierarchy explicitly", () => {
  expect(dashboard).toContain("marketSegmentGroup: string;");
  expect(dashboard).toContain("marketSegment: string;");
  expect(dashboard).toContain("Business mix by market segment group, market segment and source");
  expect(dashboard).toContain("MSG → MS · source · channel");
  expect(dashboard).toContain("{item.marketSegment} · {item.source} · {item.channel}");
});
