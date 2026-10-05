import { expect, test } from "bun:test";

const app = await Bun.file("frontend/yellow/src/App.tsx").text();
const dashboard = await Bun.file("frontend/yellow/src/workspaces/TodayGlassDashboard.tsx").text();
const client = await Bun.file("frontend/yellow/src/today-business-mix.ts").text();
const service = await Bun.file("src/contexts/reporting/commercial-contribution.ts").text();

test("Order 637 Today business mix renders MSG to MS hierarchy without guessing", () => {
  expect(app).not.toContain("const BUSINESS_HIERARCHY = Object.freeze");
  expect(service).toContain("resolveCommercialAttribution(taxonomy");
  expect(client).toContain('"stats_daily_commercial_taxonomy"');
  expect(client).toContain("group.marketSegmentGroup");
  expect(client).toContain("segment.marketSegment");
  expect(client).toContain("source.channelCode");
});

test("Order 637 Today business mix copy names hotel hierarchy explicitly", () => {
  expect(client).toContain("marketSegmentGroup: string");
  expect(client).toContain("marketSegment: string");
  expect(dashboard).toContain("Business mix by market segment group, market segment and source");
  expect(dashboard).toContain("item.marketSegmentGroup");
  expect(dashboard).toContain("item.marketSegment");
  expect(dashboard).toContain("item.source");
  expect(dashboard).toContain("item.channel");
});
