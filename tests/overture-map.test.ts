import { describe, expect, test } from "bun:test";
import { boundedVisiblePlaces, matchesOvertureView, normalizeOverturePlace, overtureArchiveUrl, parseCoordinate, safeExternalUrl, VISIBLE_PLACE_LIMIT } from "../frontend/yellow/src/overture-map";

const feature = (id: string, properties: Record<string, unknown> = {}) => ({ type: "Feature", geometry: { type: "Point", coordinates: [55.27, 25.2] }, properties: { id, "@name": `Place ${id}`, ...properties } });

describe("Overture public tile presentation boundary", () => {
  test("uses only exact same-origin release endpoints", () => {
    expect(overtureArchiveUrl("https://yellow.example/", "places")).toBe("https://yellow.example/api/public/overture/2026-09-23.0/places.pmtiles");
    expect(overtureArchiveUrl("https://yellow.example/", "divisions")).toEndWith("/divisions.pmtiles");
    expect(() => overtureArchiveUrl("javascript:alert(1)", "places")).toThrow();
    expect(() => overtureArchiveUrl("https://yellow.example/foreign", "places")).toThrow();
  });

  test("bounds global coordinates including antimeridian and rejects invalid input", () => {
    expect(parseCoordinate("-180", "85.05")).toEqual([-180, 85.05]);
    expect(parseCoordinate(180, -85.05)).toEqual([180, -85.05]);
    expect(parseCoordinate("", "20")).toBeNull();
    expect(parseCoordinate(0, 90)).toBeNull();
    expect(parseCoordinate(Number.NaN, 10)).toBeNull();
  });

  test("normalizes stringified source fields and strips unsafe websites", () => {
    const place = normalizeOverturePlace(feature("gers-1", {
      "@name": "", names: '{"primary":"Harbour House"}', basic_category: "hotel", confidence: 0.8,
      addresses: '[{"locality":"Sydney","country":"AU"}]',
      websites: '["https://example.com/stay","javascript:alert(1)","https://user:pass@example.com"]',
      sources: '["source A","source B"]',
    }));
    expect(place).toMatchObject({ id: "gers-1", name: "Harbour House", category: "hotel", confidence: 0.8, address: "Sydney, AU" });
    expect(place?.websites).toEqual(["https://example.com/stay"]);
    expect(place?.sources).toEqual(["source A", "source B"]);
    expect(normalizeOverturePlace(feature("gers-2", { sources: '[{"dataset":"open-data","record_id":"123","update_time":"2026-09-20"}]' }))?.sources).toEqual(["open-data · 123 · 2026-09-20"]);
    expect(safeExternalUrl("data:text/html,boom")).toBeNull();
    expect(safeExternalUrl("https://user@example.com")).toBeNull();
  });

  test("rejects malformed feature identity/geometry and caps deduplicated visible results", () => {
    expect(normalizeOverturePlace({ properties: { id: "x" }, geometry: { type: "Point", coordinates: [200, 0] } })).toBeNull();
    expect(normalizeOverturePlace(feature(""))).toBeNull();
    const results = boundedVisiblePlaces([feature("0"), feature("0"), ...Array.from({ length: 300 }, (_, index) => feature(String(index + 1)))]);
    expect(results).toHaveLength(VISIBLE_PLACE_LIMIT);
    expect(results[0]?.id).toBe("0");
    expect(results.at(-1)?.id).toBe("199");
  });

  test("lodging view follows pinned Overture taxonomy hierarchy, not basic category alone", () => {
    const lodging = normalizeOverturePlace(feature("l", { basic_category: "lodging", taxonomy: '{"primary":"lodging","hierarchy":["lodging"]}' }))!;
    const hotel = normalizeOverturePlace(feature("h", { basic_category: "hotel", taxonomy: '{"primary":"hotel","hierarchy":["lodging","hotel"]}' }))!;
    const restaurant = normalizeOverturePlace(feature("r", { basic_category: "restaurant", taxonomy: '{"primary":"restaurant","hierarchy":["food_and_drink","restaurant"]}' }))!;
    const missing = normalizeOverturePlace(feature("m", { basic_category: "hotel" }))!;
    const malformed = normalizeOverturePlace(feature("bad", { basic_category: "hotel", taxonomy: '{"hierarchy":["lodging",42]}' }))!;
    expect(matchesOvertureView(lodging, "lodging")).toBe(true);
    expect(matchesOvertureView(hotel, "lodging")).toBe(true);
    expect(matchesOvertureView(restaurant, "lodging")).toBe(false);
    expect(matchesOvertureView(missing, "lodging")).toBe(false);
    expect(matchesOvertureView(malformed, "lodging")).toBe(false);
    expect(matchesOvertureView(hotel, "all")).toBe(true);
  });
});
