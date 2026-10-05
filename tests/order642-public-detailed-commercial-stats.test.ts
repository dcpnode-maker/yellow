import { describe, expect, test } from "bun:test";

const detailedStats = await Bun.file("tools/provision-public-detailed-commercial-stats.ps1").text();
const taxonomy = await Bun.file("tools/provision-public-commercial-taxonomy.ps1").text();
const readiness = await Bun.file("tools/probe-colleague-demo-readiness.ts").text();

describe("Order 642 public detailed commercial stats", () => {
  test("fixture rewrites only current business-date stats from reservation facts and preserves totals", () => {
    expect(detailedStats).toContain("yellow_order642_previous_totals");
    expect(detailedStats).toContain("yellow_order642_detail_rows");
    expect(detailedStats).toContain("JOIN reservation");
    expect(detailedStats).toContain("JOIN reservation_segment");
    expect(detailedStats).toContain("upper(COALESCE(NULLIF(reservation.market_code");
    expect(detailedStats).toContain("detailed commercial stats do not preserve totals");
    expect(detailedStats).toContain("DELETE FROM stats_daily");
    expect(detailedStats).toContain("INSERT INTO stats_daily");
    expect(detailedStats).not.toMatch(/space_occupancy|record_occupancy|release_occupancy|posting_line|journal|CREATE TABLE public/iu);
  });

  test("taxonomy fixture contains real demo market segment and source mappings", () => {
    expect(taxonomy).toContain("'OTA_RETAIL'");
    expect(taxonomy).toContain("'BOOKING.COM'");
    expect(taxonomy).toContain("'AIRBNB'");
    expect(taxonomy).toContain("'WEBSITE'");
    expect(taxonomy).toContain("'MICE'");
    expect(taxonomy).toContain("'SOCIAL'");
  });

  test("readiness requires multiple contribution sources", () => {
    expect(readiness).toContain("commercial contribution hierarchy");
    expect(readiness).toContain("contributionSources.length >= 2");
  });
});
