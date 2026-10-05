import { describe, expect, test } from "bun:test";

const app = await Bun.file("frontend/yellow/src/App.tsx").text();
const api = await Bun.file("frontend/yellow/src/yellow-api.tsx").text();
const dashboard = await Bun.file("frontend/yellow/src/workspaces/TodayGlassDashboard.tsx").text();

describe("Order 643 Today server-owned business mix", () => {
  test("frontend exposes the commercial contribution API contract", () => {
    for (const source of [app, api]) {
      expect(source).toContain("type CommercialContribution");
      expect(source).toContain("type CommercialContributionLeaf");
      expect(source).toContain("type CommercialContributionMetric");
      expect(source).toContain("async function loadCommercialContribution");
      expect(source).toContain("/commercial-contribution");
    }
    expect(api).toContain("loadCommercialContribution");
    expect(api).toContain("CommercialContribution, CommercialContributionLeaf, CommercialContributionMetric");
  });

  test("Today prefers server-owned contribution rows with movement-row fallback", () => {
    expect(app).toContain('queryKey: ["commercial-contribution", propertyId]');
    expect(app).toContain("queryFn: loadCommercialContribution");
    expect(app).toContain("const fallbackBusinessMix = useMemo");
    expect(app).toContain("commercialContributionQuery.data?.groups.flatMap");
    expect(app).toContain("marketSegmentGroup: group.marketSegmentGroup.label");
    expect(app).toContain("marketSegment: segment.marketSegment.label");
    expect(app).toContain("source: source.source.label");
    expect(app).toContain("channel: source.channelCode.label");
    expect(app).toContain("stays: source.metric.roomNights");
    expect(app).toContain("return fallbackBusinessMix");
  });

  test("Today card copy still renders the hotel hierarchy", () => {
    expect(dashboard).toContain("MSG → MS · source · channel");
    expect(dashboard).toContain("{item.marketSegment} · {item.source} · {item.channel}");
  });
});
