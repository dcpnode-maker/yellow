import { describe, expect, test } from "bun:test";

import {
  MARKET_DISCOVERY_LIMITS,
  filterMarketDiscoveryRegion,
  normalizeMarketDiscoveryRecords,
  suggestMarketIdentity,
  tryFilterMarketDiscoveryRegion,
  tryNormalizeMarketDiscoveryRecords,
  trySuggestMarketIdentity,
} from "../src/contexts/distribution/market-discovery";

function record(overrides: Record<string, unknown> = {}) {
  return {
    source: "overture-places",
    release: "2026-08-19.0",
    schema: "v1.18.0",
    recordId: "place-001",
    name: "فندق النخلة 🏨",
    coordinates: { latitude: 25.2048, longitude: 55.2708 },
    address: "دبي، الإمارات العربية المتحدة",
    websites: ["https://hotel.example/stay"],
    categories: ["hotel", "lodging"],
    operatingStatus: "unknown",
    attribution: "© Overture Maps Foundation",
    ...overrides,
  };
}

describe("Order472 normalized market discovery contract", () => {
  test("retains bounded Unicode discovery provenance and explicit unknown operating state", () => {
    const input = record();
    const [normalized] = normalizeMarketDiscoveryRecords([input]);
    expect(normalized).toEqual({
      provenance: { source: "overture-places", release: "2026-08-19.0", schema: "v1.18.0",
        recordId: "place-001", attribution: "© Overture Maps Foundation" },
      name: "فندق النخلة 🏨",
      coordinates: { latitude: 25.2048, longitude: 55.2708 },
      address: "دبي، الإمارات العربية المتحدة",
      websites: ["https://hotel.example/stay"],
      categories: ["hotel", "lodging"],
      operatingStatus: "unknown",
    });
    expect(Object.isFrozen(normalized)).toBe(true);
    expect(Object.isFrozen(normalized?.provenance)).toBe(true);
    expect(Object.isFrozen(normalized?.coordinates)).toBe(true);
    expect(Object.isFrozen(normalized?.websites)).toBe(true);
    expect(Object.isFrozen(normalized?.categories)).toBe(true);
    input.name = "Changed after normalization";
    expect(normalized?.name).toBe("فندق النخلة 🏨");
    expect(JSON.stringify(normalized)).not.toMatch(/price|rate|occupancy|availability/i);
    expect(normalizeMarketDiscoveryRecords([record({ name: "  فندق محفوظ  " })])[0]?.name).toBe("  فندق محفوظ  ");
  });

  test("rejects malformed, oversized, unsafe, and invention-shaped normalized input", () => {
    expect(() => normalizeMarketDiscoveryRecords(Array.from({ length: MARKET_DISCOVERY_LIMITS.maximumRecords + 1 }, () => record())))
      .toThrow("at most");
    expect(() => normalizeMarketDiscoveryRecords([record({ name: "x".repeat(MARKET_DISCOVERY_LIMITS.maximumTextScalars + 1) })]))
      .toThrow("name");
    expect(() => normalizeMarketDiscoveryRecords([record({ coordinates: { latitude: 91, longitude: 0 } })]))
      .toThrow("latitude");
    for (const coordinates of [
      { latitude: Number.NaN, longitude: 0 }, { latitude: Number.POSITIVE_INFINITY, longitude: 0 },
      { latitude: 0, longitude: Number.NEGATIVE_INFINITY }, { latitude: 0, longitude: 180.00001 },
      { latitude: 0, longitude: -180.00001 },
    ]) expect(() => normalizeMarketDiscoveryRecords([record({ coordinates })])).toThrow();
    for (const website of ["http://hotel.example/", "https://user:password@hotel.example/", "https://hotel.example/?token=secret", "javascript:alert(1)"]) {
      expect(() => normalizeMarketDiscoveryRecords([record({ websites: [website] })])).toThrow("website");
    }
    expect(() => normalizeMarketDiscoveryRecords([record({ price: "0" })])).toThrow("unexpected");
    expect(() => normalizeMarketDiscoveryRecords([record({ name: "bad\u0000name" })])).toThrow("name");
    expect(() => normalizeMarketDiscoveryRecords([record({ name: "bad\ud800name" })])).toThrow("well-formed");
    for (const field of ["source", "release", "schema", "recordId", "name", "attribution"] as const) {
      expect(() => normalizeMarketDiscoveryRecords([record({ [field]: " \u00a0\u2003 " })])).toThrow(field);
    }
    let reads = 0;
    const accessor = record();
    Object.defineProperty(accessor, "source", { enumerable: true, get: () => { reads += 1; return "overture-places"; } });
    expect(() => normalizeMarketDiscoveryRecords([accessor])).toThrow("accessors");
    expect(reads).toBe(0);
    const sparse: string[] = [];
    sparse[1] = "https://hotel.example/other";
    expect(() => normalizeMarketDiscoveryRecords([record({ websites: sparse })])).toThrow("websites");
    const accessorWebsites = ["https://hotel.example/other"];
    Object.defineProperty(accessorWebsites, "0", { enumerable: true, get: () => "https://hotel.example/other" });
    expect(() => normalizeMarketDiscoveryRecords([record({ websites: accessorWebsites })])).toThrow("accessors");
    expect(() => filterMarketDiscoveryRegion(normalizeMarketDiscoveryRecords([record()]), {
      minimumLatitude: 1, maximumLatitude: 0, minimumLongitude: 0, maximumLongitude: 1,
    })).toThrow("inverted");
    expect(() => filterMarketDiscoveryRegion(normalizeMarketDiscoveryRecords([record()]), {
      minimumLatitude: 0, maximumLatitude: 1, minimumLongitude: 1, maximumLongitude: 0,
    })).toThrow("inverted");
  });

  test("refuses duplicate or conflicting external identity instead of silently merging records", () => {
    expect(() => normalizeMarketDiscoveryRecords([record(), record()])).toThrow("duplicate");
    expect(() => normalizeMarketDiscoveryRecords([record(), record({ name: "Conflicting source identity" })])).toThrow("duplicate");
    expect(() => normalizeMarketDiscoveryRecords([record({ websites: ["https://hotel.example/stay", "https://hotel.example/stay"] })]))
      .toThrow("duplicate website");
    expect(normalizeMarketDiscoveryRecords([record(), record({ source: "other-source" })])).toHaveLength(2);
  });

  test("filters inclusive regional edges and returns a stable bounded order", () => {
    const rows = normalizeMarketDiscoveryRecords([
      record({ recordId: "z", coordinates: { latitude: 0, longitude: 0 } }),
      record({ recordId: "a", coordinates: { latitude: -90, longitude: -180 } }),
      record({ recordId: "outside", coordinates: { latitude: 0.0001, longitude: 0 } }),
    ]);
    const region = filterMarketDiscoveryRegion(rows, {
      minimumLatitude: -90, maximumLatitude: 0, minimumLongitude: -180, maximumLongitude: 0,
    });
    expect(region.map((item) => item.provenance.recordId)).toEqual(["a", "z"]);
    expect(Object.isFrozen(region)).toBe(true);
    const point = filterMarketDiscoveryRegion(rows, {
      minimumLatitude: 0, maximumLatitude: 0, minimumLongitude: 0, maximumLongitude: 0,
    });
    expect(point.map((item) => item.provenance.recordId)).toEqual(["z"]);
  });

  test("suggests source/record or exact public URL candidates but never automatically confirms identity", () => {
    const records = normalizeMarketDiscoveryRecords([
      record({ recordId: "one", name: "Palm Hotel", websites: ["https://same.example/one"] }),
      record({ recordId: "two", name: "Palm Hotel", websites: ["https://same.example/two"] }),
    ]);
    const byRecord = suggestMarketIdentity(records, { source: "overture-places", recordId: "one", callerLabel: "untrusted managed label" });
    expect(byRecord).toEqual({ requiresConfirmation: true, ambiguous: false, suggestions: [{
      record: records[0]!, matchedBy: ["source-record-id"], requiresConfirmation: true,
    }] });
    const byUrl = suggestMarketIdentity(records, { source: "overture-places", publicUrl: "https://same.example/two" });
    expect(byUrl.suggestions.map((item) => item.record.provenance.recordId)).toEqual(["two"]);
    expect(byUrl.suggestions[0]?.matchedBy).toEqual(["canonical-public-url"]);
    const sameHostOnly = suggestMarketIdentity(records, { source: "overture-places", publicUrl: "https://same.example/other" });
    expect(sameHostOnly.suggestions).toEqual([]);
    const labelOnly = suggestMarketIdentity(records, { source: "overture-places", callerLabel: "Palm Hotel" });
    expect(labelOnly).toEqual({ requiresConfirmation: true, ambiguous: false, suggestions: [] });
  });

  test("keeps name/proximity evidence ambiguous and non-authoritative", () => {
    const records = normalizeMarketDiscoveryRecords([
      record({ recordId: "a", name: "Hotel A", coordinates: { latitude: 25, longitude: 55 } }),
      record({ recordId: "b", name: "Hotel A", coordinates: { latitude: 25.0005, longitude: 55.0005 } }),
    ]);
    const result = suggestMarketIdentity(records, {
      source: "overture-places", name: "hotel a", coordinates: { latitude: 25, longitude: 55 },
    });
    expect(result.requiresConfirmation).toBe(true);
    expect(result.ambiguous).toBe(true);
    expect(result.suggestions.map((item) => item.record.provenance.recordId)).toEqual(["a", "b"]);
    expect(result.suggestions.every((item) => item.requiresConfirmation)).toBe(true);
    expect(result.suggestions[0]?.matchedBy).toEqual(["normalized-name", "coordinate-proximity"]);
    expect(result.suggestions[1]?.matchedBy).toEqual(["normalized-name", "coordinate-proximity"]);
  });

  test("uses locale-independent case normalization even where Turkish locale casing differs", () => {
    expect("ISTANBUL".toLocaleLowerCase("tr")).toBe("ıstanbul");
    const records = normalizeMarketDiscoveryRecords([record({ name: "ISTANBUL", recordId: "locale" })]);
    const result = suggestMarketIdentity(records, { source: "overture-places", name: "istanbul" });
    expect(result.suggestions.map((item) => item.record.provenance.recordId)).toEqual(["locale"]);
    expect(result.suggestions[0]?.matchedBy).toEqual(["normalized-name"]);
  });

  test("provides a frozen typed Result boundary without exposing rejected input or thrown errors", () => {
    const normalized = tryNormalizeMarketDiscoveryRecords([record()]);
    expect(normalized.ok).toBe(true);
    if (!normalized.ok) throw new Error("expected normalized discovery success");
    expect(Object.isFrozen(normalized)).toBe(true);
    expect(normalized.value).toHaveLength(1);

    const regional = tryFilterMarketDiscoveryRegion(normalized.value, {
      minimumLatitude: 25, maximumLatitude: 26, minimumLongitude: 55, maximumLongitude: 56,
    });
    expect(regional.ok).toBe(true);
    if (!regional.ok) throw new Error("expected regional discovery success");
    expect(regional.value.map((item) => item.provenance.recordId)).toEqual(["place-001"]);

    const suggestions = trySuggestMarketIdentity(normalized.value, {
      source: "overture-places", recordId: "place-001",
    });
    expect(suggestions.ok).toBe(true);
    if (!suggestions.ok) throw new Error("expected identity suggestion success");
    expect(suggestions.value.requiresConfirmation).toBe(true);

    const secret = "sensitive-input-must-not-escape";
    const invalid = tryNormalizeMarketDiscoveryRecords([record({ price: secret })]);
    expect(invalid.ok).toBe(false);
    if (invalid.ok) throw new Error("expected invalid discovery result");
    expect(invalid).toEqual({ ok: false, error: {
      code: "invalid_market_discovery_input", message: "Market discovery input is invalid.",
    } });
    expect(Object.isFrozen(invalid)).toBe(true);
    expect(Object.isFrozen(invalid.error)).toBe(true);
    expect(Object.keys(invalid.error)).toEqual(["code", "message"]);
    expect("stack" in invalid.error).toBe(false);
    expect(JSON.stringify(invalid)).not.toContain(secret);
    expect(JSON.stringify(invalid)).not.toContain("DiscoveryValidationError");
  });

  test("converts hostile proxy and accessor failures to the same static Result error without invoking getters", () => {
    const expected = { ok: false as const, error: {
      code: "invalid_market_discovery_input", message: "Market discovery input is invalid.",
    } } as const;
    const revoked = Proxy.revocable([] as unknown[], {});
    revoked.revoke();
    expect(tryNormalizeMarketDiscoveryRecords(revoked.proxy)).toEqual(expected);

    const trapSecret = "proxy-trap-secret";
    const trapped = new Proxy([] as unknown[], {
      getOwnPropertyDescriptor: () => { throw new Error(trapSecret); },
    });
    const trappedResult = tryNormalizeMarketDiscoveryRecords(trapped);
    expect(trappedResult).toEqual(expected);
    expect(JSON.stringify(trappedResult)).not.toContain(trapSecret);

    let reads = 0;
    const accessor = record();
    Object.defineProperty(accessor, "source", {
      enumerable: true,
      get: () => { reads += 1; return "overture-places"; },
    });
    expect(tryNormalizeMarketDiscoveryRecords([accessor])).toEqual(expected);
    expect(reads).toBe(0);
  });
});
