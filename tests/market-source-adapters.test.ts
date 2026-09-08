import { describe, expect, test } from "bun:test";

import {
  normalizeMarketSourceCapture,
  readSerpApiGoogleHotels,
  type MarketSourceFetch,
  type MarketSourceQuery,
  type MarketSourceReadFailureKind,
} from "../src/contexts/distribution/market-source-adapters";

const COLLECTED = "2026-09-08T12:00:00.000Z";
const SECRET = "serp-secret-never-return";

function query(overrides: Partial<MarketSourceQuery> = {}): MarketSourceQuery {
  return {
    destination: "Dubai",
    checkInDate: "2026-09-15",
    checkOutDate: "2026-09-16",
    adults: 2,
    rooms: 1,
    childrenAges: [],
    currency: "AED",
    pointOfSaleMarket: "AE",
    language: "en",
    ...overrides,
  };
}

function jsonResponse(value: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(value), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json", ...init.headers },
  });
}

function searchPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    search_metadata: {
      id: "synthetic-search",
      status: "Success",
      created_at: "2026-09-08T11:59:00.000Z",
      processed_at: "2026-09-08T11:59:02.000Z",
    },
    search_parameters: {
      engine: "google_hotels",
      q: "Dubai",
      check_in_date: "2026-09-15",
      check_out_date: "2026-09-16",
      adults: 2,
      children: 0,
      currency: "AED",
      gl: "ae",
      hl: "en",
    },
    properties: [{
      name: "Synthetic Creek Hotel",
      property_token: "detail-token-do-not-return",
      link: "https://hotel.example.test/property?session=url-secret#fragment",
      type: "hotel",
      gps_coordinates: { latitude: 25.2, longitude: 55.3 },
      rate_per_night: { lowest: "AED 251.25", extracted_lowest: 251.25 },
      prices: [{ source: "OTA One", rate_per_night: { lowest: "AED 251.25", extracted_lowest: 251.25 } }],
    }],
    ...overrides,
  };
}

describe("provider-specific market source normalization", () => {
  test("Booking capture preserves exact money and keeps sparse fields non-authoritative", () => {
    const result = normalizeMarketSourceCapture({
      source: "booking-mcp", query: query(), collectedAt: COLLECTED,
      payload: { accommodations: [{
        id: 2_279_194,
        name: "Example",
        price: { book: 245.67, currency: "AED" },
        rating: { stars: 5, review_score: 8.5, number_of_reviews: 5_462 },
        location: { city_name: "Dubai", country_code: "ae", coordinates: { latitude: 25, longitude: 55 } },
        url: "https://www.booking.com/hotel/ae/example.html?aid=synthetic-token#availability",
        facilities: ["Pool"],
      }] },
    });

    expect(result.issues).toEqual([]);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({
      source: "booking-mcp",
      aggregator: "Booking.com",
      advertiser: "Booking.com",
      externalPropertyId: "2279194",
      propertyName: "Example",
      propertyUrl: "https://www.booking.com/hotel/ae/example.html",
      price: { raw: "245.67", amountMinor: "24567", currency: "AED", basis: "reported-book-price" },
      roomName: null,
      mealPlan: null,
      cancellationText: null,
      refundability: null,
      taxesAndFeesText: null,
      taxesIncluded: null,
      feesIncluded: null,
      queriedAt: null,
      connectorProcessedAt: null,
      collectedAt: COLLECTED,
      sourceUpdatedAt: null,
      comparisonAuthority: "search-candidate-only",
      automaticPricingEligible: false,
    });
    expect(JSON.stringify(result)).not.toContain("synthetic-token");
  });

  test("trivago retains non-breaking-space display money and rejects different stay dates", () => {
    const good = {
      accommodation_id: "opaque",
      accommodation_name: "Example",
      currency: "AED",
      price_per_night: "AED\u00a0233",
      price_per_stay: "AED\u00a0233",
      arrival: "2026-09-15",
      departure: "2026-09-16",
      advertisers: "Booking.com",
      accommodation_url: "https://www.trivago.ae/en-GB/lm/example?search=secret",
      hotel_rating: 3,
      latitude: 25,
      longitude: 55,
      top_amenities: "WiFi",
    };
    const result = normalizeMarketSourceCapture({
      source: "trivago-mcp", query: query(), collectedAt: COLLECTED,
      payload: { accommodations: [good, { ...good, accommodation_id: "wrong", departure: "2026-09-17" }] },
    });

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.price).toEqual({
      raw: "AED\u00a0233", amountMinor: "23300", currency: "AED", basis: "entire-stay",
    });
    expect(result.candidates[0]?.advertiser).toBe("Booking.com");
    expect(result.issues).toContainEqual({
      code: "query-mismatch", path: "payload.accommodations[1]", candidateIndex: 1,
    });
  });

  test("held Google UI evidence remains useful without inventing collection time or price basis", () => {
    const result = normalizeMarketSourceCapture({
      source: "google-visible", query: query(), collectedAt: null,
      payload: {
        captureContext: { checkInDate: "2026-09-15", checkOutDate: "2026-09-16", adults: 2,
          rooms: 1, childrenAges: [], destination: "Dubai", currency: "AED",
          pointOfSaleMarket: "AE", language: "en" },
        properties: [{ id: "hyatt-regency-dubai", name: "Hyatt Regency Dubai", offers: [{
          advertiser: "Synthetic OTA", price: { raw: "AED 399", currency: "AED", basis: "unknown" },
          roomName: null, mealPlan: null, cancellationText: null, taxesAndFeesText: null,
        }] }],
      },
    });

    expect(result.collectedAt).toBeNull();
    expect(result.issues).toContainEqual({
      code: "unknown-collection-time", path: "collectedAt", candidateIndex: null,
    });
    expect(result.candidates[0]).toMatchObject({
      source: "google-visible", aggregator: "Google Hotels", advertiser: "Synthetic OTA",
      price: { raw: "AED 399", amountMinor: "39900", basis: "unknown" },
      collectedAt: null, queriedAt: null, sourceUpdatedAt: null,
      taxesIncluded: null, feesIncluded: null, automaticPricingEligible: false,
    });
  });

  test("fractional money uses currency scale without guessing ambiguous three-digit separators", () => {
    const amount = (currency: string, book: number | string): string | null => normalizeMarketSourceCapture({
      source: "booking-mcp", query: query({ currency }), collectedAt: COLLECTED,
      payload: { accommodations: [{ id: "one", name: "One", price: { book, currency } }] },
    }).candidates[0]?.price.amountMinor ?? null;

    expect(amount("AED", 109.2)).toBe("10920");
    expect(amount("AED", "109.20")).toBe("10920");
    expect(amount("JPY", 109.2)).toBeNull();
    expect(amount("KWD", 109.2)).toBe("109200");
    expect(amount("KWD", "1.234")).toBeNull();
    expect(amount("AED", "1.234")).toBeNull();
    expect(amount("AED", "AED 1 AED 2")).toBeNull();
    expect(amount("AED", ".50")).toBeNull();
  });

  test("Google UI evidence requires a complete exact capture context", () => {
    const property = { properties: [{ name: "Held Hotel", offers: [{
      advertiser: "OTA", price: { raw: "AED 399", currency: "AED", basis: "unknown" },
    }] }] };
    for (const captureContext of [undefined, { checkInDate: "2026-09-15" }, {
      ...query(), destination: "Wrong destination",
    }]) {
      const result = normalizeMarketSourceCapture({
        source: "google-visible", query: query(), collectedAt: null,
        payload: { ...property, ...(captureContext === undefined ? {} : { captureContext }) },
      });
      expect(result.candidates).toEqual([]);
      expect(result.issues).toContainEqual({
        code: "query-mismatch", path: "payload.captureContext", candidateIndex: null,
      });
    }
  });

  test("untrusted cyclic and oversized capture payloads fail closed", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    const invalid = normalizeMarketSourceCapture({
      source: "booking-mcp", query: query(), collectedAt: COLLECTED, payload: cyclic,
    });
    expect(invalid.candidates).toEqual([]);
    expect(invalid.issues).toEqual([{ code: "invalid-payload", path: "payload", candidateIndex: null }]);

    const oversized = normalizeMarketSourceCapture({
      source: "booking-mcp", query: query(), collectedAt: COLLECTED,
      payload: { accommodations: [], padding: "x".repeat(2_097_152) },
    });
    expect(oversized.candidates).toEqual([]);
    expect(oversized.issues).toEqual([{ code: "payload-too-large", path: "payload", candidateIndex: null }]);
  });

  test("rejects an unsupported runtime source instead of returning a clean empty result", () => {
    expect(() => normalizeMarketSourceCapture({
      source: "unsupported" as never, query: query(), collectedAt: COLLECTED, payload: {},
    })).toThrow("source is invalid");
  });
});

describe("SerpApi Google Hotels bounded reader", () => {
  test("uses only fixed HTTPS search/detail requests and returns normalized advertiser provenance", async () => {
    const urls: URL[] = [];
    const fetcher: MarketSourceFetch = async (input, init) => {
      const url = new URL(String(input));
      urls.push(url);
      expect(init?.method).toBe("GET");
      expect(init?.redirect).toBe("error");
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      if (url.searchParams.has("property_token")) {
        return jsonResponse({
          search_metadata: { status: "Success", created_at: "2026-09-08T11:59:03.000Z",
            processed_at: "2026-09-08T11:59:04.000Z" },
          search_parameters: { ...searchPayload().search_parameters as object,
            property_token: url.searchParams.get("property_token") },
          name: "Synthetic Creek Hotel",
          featured_prices: [{ source: "OTA Detail", link: "https://ota.test/book?auth=url-token", rooms: [{
            name: "King Room",
            num_guests: 2,
            total_rate: { lowest: "AED 502.50", extracted_lowest: 502.5 },
            rates: [{ free_cancellation: true, breakfast_included: true, inclusions: ["1 king bed"],
              total_rate: { lowest: "AED 502.50", extracted_lowest: 502.5 } }],
          }] }],
        });
      }
      return jsonResponse(searchPayload());
    };

    const result = await readSerpApiGoogleHotels(query(), {
      apiKey: SECRET, fetch: fetcher, propertyDetailLimit: 1, noCache: true,
      now: () => Date.parse(COLLECTED),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(urls).toHaveLength(2);
    for (const url of urls) {
      expect(url.origin + url.pathname).toBe("https://serpapi.com/search");
      expect(url.searchParams.get("engine")).toBe("google_hotels");
      expect(url.searchParams.get("gl")).toBe("ae");
      expect(url.searchParams.get("hl")).toBe("en");
      expect(url.searchParams.get("currency")).toBe("AED");
      expect(url.searchParams.get("api_key")).toBe(SECRET);
      expect(url.searchParams.get("no_cache")).toBe("true");
      expect(url.searchParams.has("rooms")).toBe(false);
    }
    expect(result.value.candidates).toHaveLength(2);
    expect(result.value.candidates.map((item) => item.advertiser)).toEqual(["OTA One", "OTA Detail"]);
    expect(result.value.candidates[1]).toMatchObject({
      aggregator: "Google Hotels", advertiser: "OTA Detail", roomName: "King Room",
      mealPlan: "breakfast included", refundability: true,
      rateInclusions: ["1 king bed"], taxesAndFeesText: null,
      price: { raw: "AED 502.50", amountMinor: "50250", basis: "entire-stay" },
      queriedAt: "2026-09-08T11:59:03.000Z",
      connectorProcessedAt: "2026-09-08T11:59:04.000Z",
      sourceUpdatedAt: null,
      comparisonAuthority: "search-candidate-only",
      automaticPricingEligible: false,
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(SECRET);
    expect(serialized).not.toContain("detail-token-do-not-return");
    expect(serialized).not.toContain("url-token");
    expect(result.value.candidates[0]?.propertyUrl).toBe("https://hotel.example.test/property");
  });

  test("rejects multi-room input and missing credentials before any request", async () => {
    let calls = 0;
    const fetcher: MarketSourceFetch = async () => { calls += 1; return jsonResponse(searchPayload()); };
    expect(await readSerpApiGoogleHotels(query(), { apiKey: "", fetch: fetcher })).toEqual({
      ok: false, error: { kind: "missing-credential", retryable: false, status: null },
    });
    expect(await readSerpApiGoogleHotels(query({ rooms: 2 }), { apiKey: SECRET, fetch: fetcher })).toEqual({
      ok: false, error: { kind: "invalid-query", retryable: false, status: null },
    });
    expect(calls).toBe(0);
  });

  test("rejects response/query mismatch rather than producing comparable candidates", async () => {
    const result = await readSerpApiGoogleHotels(query(), {
      apiKey: SECRET,
      fetch: async () => jsonResponse(searchPayload({
        search_parameters: { ...searchPayload().search_parameters as object, currency: "USD" },
      })),
    });
    expect(result).toEqual({ ok: false, error: { kind: "invalid-response", retryable: false, status: null } });
    expect(JSON.stringify(result)).not.toContain(SECRET);
  });

  test("binds every detail response to the exact property token selected from search", async () => {
    for (const returnedToken of [undefined, "WRONG"]) {
      let calls = 0;
      const result = await readSerpApiGoogleHotels(query(), {
        apiKey: SECRET, propertyDetailLimit: 1,
        fetch: async (_input, _init) => {
          calls += 1;
          if (calls === 1) return jsonResponse(searchPayload());
          return jsonResponse({
            search_metadata: { status: "Success" },
            search_parameters: { ...searchPayload().search_parameters as object,
              ...(returnedToken === undefined ? {} : { property_token: returnedToken }) },
            name: "Unrelated Detail",
            featured_prices: [{ source: "Wrong OTA", rate_per_night: { lowest: "AED 999" } }],
          });
        },
      });
      expect(result).toEqual({ ok: false, error: { kind: "invalid-response", retryable: false, status: null } });
      expect(calls).toBe(2);
      expect(JSON.stringify(result)).not.toContain("detail-token-do-not-return");
    }
  });

  test("bounds status, content type, declared and streamed body sizes", async () => {
    const cases: Array<{ response: Response; kind: MarketSourceReadFailureKind; status?: number | null }> = [
      { response: new Response("blocked", { status: 403 }), kind: "http-status", status: 403 },
      { response: new Response("{}", { status: 200, headers: { "content-type": "text/plain" } }), kind: "invalid-content-type" },
      { response: new Response("{}", { status: 200, headers: { "content-type": "application/json", "content-length": "5000" } }), kind: "response-too-large" },
      { response: new Response(`{"padding":"${"x".repeat(2_000)}"}`, { status: 200,
        headers: { "content-type": "application/json" } }), kind: "response-too-large" },
    ];
    for (const item of cases) {
      const result = await readSerpApiGoogleHotels(query(), {
        apiKey: SECRET, maxResponseBytes: 1_024, fetch: async () => item.response,
      });
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("expected failure");
      expect(result.error.kind).toBe(item.kind);
      expect(result.error.status).toBe(item.status ?? null);
      expect(JSON.stringify(result)).not.toContain(SECRET);
    }
  });

  test("never reports success for a transport-accepted payload above the normalization cap", async () => {
    const result = await readSerpApiGoogleHotels(query(), {
      apiKey: SECRET,
      maxResponseBytes: 4_000_000,
      fetch: async () => jsonResponse(searchPayload({ padding: "x".repeat(2_100_000) })),
    });
    expect(result).toEqual({ ok: false, error: { kind: "response-too-large", retryable: false, status: null } });
  });

  test("aborts a stalled read at the configured deadline without leaking errors", async () => {
    const result = await readSerpApiGoogleHotels(query(), {
      apiKey: SECRET,
      timeoutMs: 100,
      fetch: (_input, init) => new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error(`aborted ${SECRET}`)), { once: true });
      }),
    });
    expect(result).toEqual({ ok: false, error: { kind: "timeout", retryable: true, status: null } });
    expect(JSON.stringify(result)).not.toContain(SECRET);
  });
});
