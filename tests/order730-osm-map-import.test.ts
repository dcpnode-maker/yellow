import { describe, expect, test } from "bun:test";
import { decodeOsmMarketJson, filterOsmMarketRows, OsmMarketImportError } from "../frontend/yellow/src/osm-market-import";
import { createImportedMarketFileSession, decodeImportedMarketJson, marketListingGeoJson, paginateMarketListings } from "../frontend/yellow/src/market-listing-import";

const fetched = "2026-09-25T15:41:53.727533+00:00";
const row = (overrides: Record<string, unknown> = {}) => ({ source_type: "node", source_id: "315482350",
  source_url: "https://www.openstreetmap.org/node/315482350", source_status: "mapped_accommodation_unverified",
  tourism_kind: "hotel", name: "Synthetic Dubai hotel", latitude: 25.2660218, longitude: 55.3256435,
  coordinate_kind: "osm_node_point", fetched_at: fetched,
  active_inventory: "unknown", ota_identity: "unknown", exact_entrance: "unknown", prices: "unknown", calendar: "unknown", ...overrides });
const payload = (rows: unknown[] = [row()], metadata: Record<string, unknown> = {}) => ({ metadata: {
  schema: "yellow.osm-accommodation-sample.v1", source_endpoint: "https://overpass-api.de/api/interpreter",
  fetched_at: fetched, source_timestamp: "2026-09-25T15:40:58Z", response_sha256: "a".repeat(64),
  response_bytes: 541873, filtered_extract_sha256: "b".repeat(64), bounding_box_south_west_north_east: [24.8, 54.85, 25.45, 55.65],
  coverage: "Bounded Dubai metro POI sample; not a complete market or administrative boundary.",
  returned_elements: rows.length, retained: rows.length, excluded: 0, exclusion_counts: {},
  attribution: "OpenStreetMap contributors", license: "ODbL-1.0", license_url: "https://opendatacommons.org/licenses/odbl/1-0/",
  copyright_url: "https://www.openstreetmap.org/copyright", ...metadata }, accommodations: rows });
const text = (rows?: unknown[], metadata?: Record<string, unknown>) => JSON.stringify(payload(rows, metadata));
const decode = (rows?: unknown[], metadata?: Record<string, unknown>) => decodeOsmMarketJson(text(rows, metadata));
const code = (action: () => unknown) => { try { action(); } catch (error) { return (error as OsmMarketImportError).code; } return "no_error"; };

describe("Order730 separate open-data map decoder", () => {
  test("preserves exact identity, coordinate semantics, provenance and hashes", () => {
    const data = decode();
    expect(data.rows[0]).toEqual({ listingId: "osm/node/315482350", sourceId: "315482350", sourceType: "node",
      listingLink: "https://www.openstreetmap.org/node/315482350", title: "Synthetic Dubai hotel",
      latitude: "25.2660218", longitude: "55.3256435", tourismKind: "hotel", coordinateKind: "osm_node_point" });
    expect(data.source.provider).toBe("OpenStreetMap");
    expect(data.source.observedAt).toBe(fetched);
    expect(data.source.license).toBe("ODbL-1.0");
    expect(data.source.responseSha256).toBe("a".repeat(64));
    expect(data.source.filteredExtractSha256).toBe("b".repeat(64));
    expect(data.mappedCount).toBe(1);
    expect(data.unmappedCount).toBe(0);
    expect(Object.keys(data.rows[0]!)).not.toContain("bedrooms");
    expect(Object.keys(data.rows[0]!)).not.toContain("priceNextYearAverage");
    expect(marketListingGeoJson(data.rows).features[0]?.properties.listingId).toBe("osm/node/315482350");
    expect(marketListingGeoJson(data.rows).features[0]?.geometry.coordinates).toEqual([55.3256435, 25.2660218]);
  });

  test("different OSM types do not collide; long string IDs never become numbers", () => {
    const id = "9007199254740993123";
    const data = decode([row({ source_id: id, source_url: `https://www.openstreetmap.org/node/${id}` }),
      row({ source_type: "way", source_id: id, source_url: `https://www.openstreetmap.org/way/${id}`, coordinate_kind: "osm_bounding_box_center", name: null }),
      row({ source_type: "relation", source_id: id, source_url: `https://www.openstreetmap.org/relation/${id}`, coordinate_kind: "osm_bounding_box_center" })]);
    expect(new Set(data.rows.map(item => item.listingId)).size).toBe(3);
    expect(data.rows[0]?.sourceId).toBe(id);
    expect(data.rows[1]?.title).toBe("");
    expect(code(() => decode([row(), row()]))).toBe("duplicate_id");
    for (const invalid of [315482350, true, "01", "-1", "0", "1.5", "1e3", "x", "1".repeat(21)]) {
      expect(code(() => decode([row({ source_id: invalid })]))).toBe("invalid_id");
    }
  });

  test("rejects metadata corruption, mixed package and attribution changes", () => {
    for (const overrides of [{ schema: "other" }, { source_endpoint: "https://example.test/" },
      { fetched_at: "2026-02-30T15:40:00Z" }, { source_timestamp: "2026-09-26T15:40:58Z" },
      { fetched_at: "2026-09-25T24:00:00Z" }, { source_timestamp: "yesterday" },
      { response_sha256: "bad" }, { filtered_extract_sha256: "x".repeat(64) }, { response_bytes: 8 * 1024 * 1024 + 1 },
      { response_bytes: 0 }, { response_bytes: "123" }, { coverage: "All verified active Dubai listings" }, { extra: true }]) {
      expect(code(() => decode(undefined, overrides))).toBe("invalid_metadata");
    }
    for (const overrides of [{ attribution: "Google" }, { license: "MIT" }, { license_url: "javascript:x" }, { copyright_url: "https://evil.test/" }]) {
      expect(code(() => decode(undefined, overrides))).toBe("invalid_attribution");
    }
    expect(code(() => decodeOsmMarketJson(JSON.stringify({ ...payload(), source: { provider: "PriceLabs" } })))).toBe("invalid_package");
    expect(code(() => decodeOsmMarketJson("[]"))).toBe("invalid_package");
    expect(code(() => decodeOsmMarketJson(text().replace('"prices":"unknown"', '"prices":"100","prices":"unknown"')))).toBe("invalid_json");
    expect(code(() => decodeOsmMarketJson(text().replace('"name":"Synthetic Dubai hotel"', '"na\\u006de":"first","name":"second"')))).toBe("invalid_json");
  });

  test("rejects sample bounds, invalid coordinates, category and centre claims", () => {
    expect(code(() => decode(undefined, { bounding_box_south_west_north_east: [-90, -180, 90, 180] }))).toBe("invalid_sample_bounds");
    expect(code(() => decode(undefined, { bounding_box_south_west_north_east: [24.8, 54.85, 25.45] }))).toBe("invalid_sample_bounds");
    for (const latitude of ["25.2", null, true, 24.79, 25.46, Number.NaN]) {
      expect(code(() => decode([row({ latitude })]))).toBe("invalid_coordinates");
    }
    for (const longitude of ["55.2", null, false, 54.84, 55.66, Number.POSITIVE_INFINITY]) {
      expect(code(() => decode([row({ longitude })]))).toBe("invalid_coordinates");
    }
    expect(decode([row({ latitude: 24.8, longitude: 54.85 })]).mappedCount).toBe(1);
    expect(code(() => decode([row({ coordinate_kind: "exact_entrance" })]))).toBe("invalid_coordinate_kind");
    expect(code(() => decode([row({ coordinate_kind: "osm_bounding_box_center" })]))).toBe("invalid_coordinate_kind");
    for (const tourism_kind of ["restaurant", "__proto__", "toString", "constructor", null, {}]) {
      expect(code(() => decode([row({ tourism_kind })]))).toBe("invalid_category");
    }
  });

  test("requires fixed source links and unknown commercial claims, bounds text", () => {
    for (const source_url of ["https://www.openstreetmap.org/node/999", "https://evil.test/", "javascript:alert(1)",
      "https://www.openstreetmap.org/node/315482350?track=secret", "https://user:pass@www.openstreetmap.org/node/315482350"]) {
      expect(code(() => decode([row({ source_url })]))).toBe("unsafe_source_link");
    }
    for (const overrides of [{ source_status: "verified_active" }, { prices: "AED100" }, { bedrooms: 1 },
      { active_inventory: "active" }, { ota_identity: "airbnb" }, { exact_entrance: true }, { calendar: [] }, { fetched_at: "other" }]) {
      expect(code(() => decode([row(overrides)]))).not.toBe("no_error");
    }
    expect(code(() => decode([row({ name: "x".repeat(513) })]))).toBe("invalid_name");
    expect(code(() => decode([row({ name: "bad\u0000name" })]))).toBe("invalid_name");
    expect(code(() => decode([row({ name: 12 })]))).toBe("invalid_name");
  });

  test("validates counts, exclusions, empty sample and byte/row limits", () => {
    for (const metadata of [{ retained: 2 }, { returned_elements: 2 }, { excluded: -1 }, { retained: "1" }]) {
      expect(code(() => decode(undefined, metadata))).toBe("invalid_counts");
    }
    expect(code(() => decode(undefined, { returned_elements: 2, excluded: 1, exclusion_counts: {} }))).toBe("invalid_exclusions");
    expect(code(() => decode(undefined, { returned_elements: 2, excluded: 1, exclusion_counts: { arbitrary: 1 } }))).toBe("invalid_exclusions");
    expect(code(() => decode(undefined, { exclusion_counts: { out_of_bounds: 0 } }))).toBe("invalid_exclusions");
    expect(decode(undefined, { returned_elements: 2, excluded: 1, exclusion_counts: { out_of_bounds: 1 } }).source.excludedCount).toBe(1);
    expect(decode([]).rows).toEqual([]);
    expect(code(() => decodeOsmMarketJson("x".repeat(5_000_001)))).toBe("file_too_large");
    expect(code(() => decode(Array.from({ length: 10_001 }, () => null)))).toBe("invalid_counts");
    expect(code(() => decodeOsmMarketJson(text([row({ name: "😀".repeat(1_300_000) })])))).toBe("file_too_large");
  });

  test("1233 synthetic rows filter and paginate without claiming OTA coverage", () => {
    const counts = { hotel: 927, apartment: 164, hostel: 75, guest_house: 55, motel: 12 };
    let index = 0;
    const entries = Object.entries(counts).flatMap(([category, total]) => Array.from({ length: total }, () => {
      const id = String(++index);
      return row({ source_id: id, source_url: `https://www.openstreetmap.org/node/${id}`, tourism_kind: category, name: `${category} property ${id}` });
    }));
    const data = decode(entries);
    expect(data.rows.length).toBe(1233);
    expect(marketListingGeoJson(data.rows).features).toHaveLength(1233);
    for (const [category, total] of Object.entries(counts)) expect(filterOsmMarketRows(data.rows, "", category)).toHaveLength(total);
    expect(filterOsmMarketRows(data.rows, "osm/node/1233", "motel").map(item => item.sourceId)).toEqual(["1233"]);
    expect(filterOsmMarketRows(data.rows, "MOTEL PROPERTY 1233", "all")).toHaveLength(1);
    expect(filterOsmMarketRows(data.rows, "not present", "all")).toHaveLength(0);
    expect(paginateMarketListings(data.rows, 62).rows).toHaveLength(13);
    expect(paginateMarketListings(data.rows, 100).page).toBe(62);
  });

  test("routing is source-discriminated and cannot pass mixed data to PriceLabs", () => {
    const imported = decodeImportedMarketJson(text());
    expect(imported.kind).toBe("osm");
    expect(imported.data.source.provider).toBe("OpenStreetMap");
    expect(() => decodeImportedMarketJson(JSON.stringify({ ...payload(), schemaVersion: "yellow.pricelabs-dashboard-listings/v1" }))).toThrow();
    expect(() => decodeImportedMarketJson('{"metadata":{"schema":"unknown"}}')).toThrow();
  });

  test("local file session clears previous data, suppresses late loads and permits error recovery", async () => {
    const events: string[] = [];
    let resolve: ((value: string) => void) | undefined;
    const session = createImportedMarketFileSession({ onLoaded: value => events.push(`loaded:${value.kind}:${value.data.rows.length}`),
      onError: () => events.push("error"), onCleared: () => events.push("cleared") });
    const file = { size: 1000, text: async () => text() };
    expect(await session.load(file)).toBeTrue();
    expect(await session.load({ size: 20, text: async () => "invalid" })).toBeFalse();
    expect(await session.load(file)).toBeTrue();
    const pending = session.load({ size: 1000, text: () => new Promise<string>(complete => { resolve = complete; }) });
    session.clear(); resolve?.(text());
    expect(await pending).toBeFalse();
    const unmount = session.load({ size: 1000, text: () => new Promise<string>(complete => { resolve = complete; }) });
    session.dispose(); resolve?.(text());
    expect(await unmount).toBeFalse();
    expect(await session.load(file)).toBeFalse();
    expect(events.filter(event => event.startsWith("loaded"))).toEqual(["loaded:osm:1", "loaded:osm:1"]);
    expect(events.filter(event => event === "error")).toHaveLength(1);
  });
});
