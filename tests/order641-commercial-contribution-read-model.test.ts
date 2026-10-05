import { describe, expect, test } from "bun:test";

const service = await Bun.file("src/contexts/reporting/commercial-contribution.ts").text();
const reportingIndex = await Bun.file("src/contexts/reporting/index.ts").text();
const app = await Bun.file("src/app.ts").text();
const operator = await Bun.file("src/http/operator.ts").text();
const probe = await Bun.file("tools/probe-colleague-demo-readiness.ts").text();
const fixture = await Bun.file("tools/provision-public-commercial-taxonomy.ps1").text();

describe("Order 641 commercial contribution read model", () => {
  test("service rolls existing stats through the configured commercial taxonomy", () => {
    expect(service).toContain("FROM stats_daily");
    expect(service).toContain("CommercialTaxonomyService");
    expect(service).toContain("resolveCommercialAttribution");
    expect(service).toContain("marketSegmentGroup");
    expect(service).toContain("marketSegment");
    expect(service).toContain("roomRevenueMinor");
    expect(service).toContain("adrMinor");
    expect(service).toContain("revparMinor");
    expect(service).toContain("BigInt(row.roomRevenueMinor)");
    expect(service).toContain('provenance: "stats_daily_commercial_taxonomy"');
    expect(service).not.toMatch(/INSERT INTO|UPDATE public|DELETE FROM|record_occupancy|release_occupancy|posting_line|journal/iu);
  });

  test("HTTP surface exposes a read-only property commercial contribution endpoint", () => {
    expect(reportingIndex).toContain("CommercialContributionService");
    expect(operator).toContain("readonly #commercialContribution");
    expect(operator).toContain("async commercialContribution");
    expect(operator).toContain("RESERVATION_LIFECYCLE_READ_SCOPE");
    expect(app).toContain("/api/v1/properties/:property/commercial-contribution");
  });

  test("public colleague readiness proves the contribution hierarchy", () => {
    expect(probe).toContain("/commercial-contribution");
    expect(probe).toContain("commercial contribution hierarchy");
    expect(probe).toContain("stats_daily_commercial_taxonomy");
    expect(probe).toContain("hasMappedMsg");
    expect(probe).toContain("hasMappedMs");
    expect(probe).toContain("hasMappedSource");
  });

  test("public fixture registers a property-scoped active commercial taxonomy", () => {
    expect(fixture).toContain("extension_type(type, json_schema)");
    expect(fixture).toContain("'commercial_attribution'");
    expect(fixture).toContain("'property:' || property_scope.property_node::text");
    expect(fixture).toContain("'marketMappings'");
    expect(fixture).toContain("'roomClasses'");
    expect(fixture).not.toMatch(/space_occupancy|posting_line|journal|record_occupancy|release_occupancy/iu);
  });
});
