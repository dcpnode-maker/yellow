import { describe, expect, test } from "bun:test";

import {
  readCrsSearchJson,
  searchStaffCrsOffers,
  StaffCrsSearchError,
} from "../src/http/crs-search";
import type { JsonValue } from "../src/kernel";
import type {
  ReservationOfferSearchInput,
  ReservationOfferSearchResult,
} from "../src/contexts/reservations";

const PROPERTY_A = "00000000-0000-4000-8000-00000000000a";
const PROPERTY_B = "00000000-0000-4000-8000-00000000000b";
const PROPERTY_C = "00000000-0000-4000-8000-00000000000c";
const PROPERTY_D = "00000000-0000-4000-8000-00000000000d";
const PROPERTY_FOREIGN = "00000000-0000-4000-8000-0000000000ff";
const FROM = "2026-10-10T15:00:00+04:00";
const TO = "2026-10-12T11:00:00+04:00";
const MAX_REQUEST_BYTES = 64 * 1024;
const MAX_RESPONSE_BYTES = 1024 * 1024;

type SearchDeps = Parameters<typeof searchStaffCrsOffers>[1];
type ParsedSearch = Omit<ReservationOfferSearchInput, "propertyNode">;

function searchBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    stay: { from: FROM, to: TO },
    party: { adults: 2, children: [{ age: 7 }] },
    channel: "direct",
    unit_types: ["DLX"],
    rate_plans: ["FLEX"],
    attributes: { gender_policy: "any" },
    currency: "USD",
    selected_promotion_codes: ["AUTUMN"],
    commercial: { market_code: "LEISURE", source_code: "WEB" },
    ...overrides,
  };
}

function entry(propertyId: string, search: unknown = searchBody()): Record<string, unknown> {
  return { property_id: propertyId, search };
}

function requestBody(entries: readonly unknown[], extras: Record<string, unknown> = {}): unknown {
  return { searches: entries, ...extras };
}

function parsedSearch(overrides: Partial<ParsedSearch> = {}): ParsedSearch {
  return {
    stayStart: new Date("2026-10-10T11:00:00.000Z"),
    stayEnd: new Date("2026-10-12T07:00:00.000Z"),
    guests: { adults: 2, childAges: [7] },
    unitTypeCodes: ["DLX"],
    ratePlanCodes: ["FLEX"],
    attributes: { genderPolicy: "any" },
    channelCode: "direct",
    currency: "USD",
    selectedPromotionCodes: ["AUTUMN"],
    commercial: { marketCode: "LEISURE", sourceCode: "WEB" },
    ...overrides,
  };
}

function properties(ids: readonly string[]) {
  return ids.map((id, index) => ({
    id,
    name: `Property ${index + 1}`,
    timezone: ["Asia/Dubai", "Europe/London", "America/New_York", "Pacific/Auckland"][index] ?? "UTC",
  }));
}

function dependencies(overrides: Partial<SearchDeps> = {}): SearchDeps {
  return {
    hasAvailabilityScope: true,
    parseCanonicalSearch: () => parsedSearch(),
    listGrantedProperties: async () => properties([PROPERTY_A, PROPERTY_B, PROPERTY_C, PROPERTY_D]),
    searchOffers: async () => emptyOfferResult(),
    serializeOffers: (result) => result as unknown as JsonValue,
    ...overrides,
  };
}

function emptyOfferResult(): ReservationOfferSearchResult {
  return {
    options: [],
    issues: [],
    summary: {
      inventoryOptions: 0,
      candidatePairs: 0,
      evaluatedPairs: 0,
      bookable: 0,
      blocked: 0,
      unpriced: 0,
      conflicted: 0,
      publicationUnavailable: 0,
      pricingEvidenceUnavailable: 0,
      workLimit: 1_000,
    },
  };
}

function expectSearchError(
  action: () => Promise<unknown>,
  expected: { status: number; code: string },
): Promise<void> {
  return (async () => { await expect(action()).rejects.toMatchObject(expected); })();
}

function requestWithStream(
  bytes: Uint8Array,
  headers: HeadersInit,
  onCancel?: () => void,
  close = true,
): Request {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      if (close) controller.close();
    },
    cancel() {
      onCancel?.();
    },
  });
  return new Request("http://yellow.test/api/v1/crs/availability:search", {
    method: "POST",
    headers,
    body: stream,
    duplex: "half",
  } as RequestInit);
}

function requestWithPendingBody(headers: HeadersInit, onCancel: () => void): Request {
  const stream = new ReadableStream<Uint8Array>({ cancel: onCancel });
  return new Request("http://yellow.test/api/v1/crs/availability:search", {
    method: "POST",
    headers,
    body: stream,
    duplex: "half",
  } as RequestInit);
}

function requestWithChunks(chunks: readonly Uint8Array[]): Request {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
  return new Request("http://yellow.test/api/v1/crs/availability:search", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: stream,
    duplex: "half",
  } as RequestInit);
}

function utf8Bytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

describe("PMS CRS staff offer search helper", () => {
  test("requires scope before parsing, grants, or offers", async () => {
    const calls: string[] = [];
    const deps = dependencies({
      hasAvailabilityScope: false,
      parseCanonicalSearch: () => { calls.push("parse"); return parsedSearch(); },
      listGrantedProperties: async () => { calls.push("grants"); return properties([PROPERTY_A]); },
      searchOffers: async () => { calls.push("search"); return emptyOfferResult(); },
    });

    await expectSearchError(
      () => searchStaffCrsOffers(requestBody([entry(PROPERTY_A)]), deps),
      { status: 403, code: "auth/forbidden" },
    );
    expect(calls).toEqual([]);
  });

  test("accepts the exact envelope and one to four distinct UUID properties", async () => {
    for (const ids of [[PROPERTY_A], [PROPERTY_A, PROPERTY_B],
      [PROPERTY_A, PROPERTY_B, PROPERTY_C], [PROPERTY_A, PROPERTY_B, PROPERTY_C, PROPERTY_D]]) {
      const received: ReservationOfferSearchInput[] = [];
      const result = await searchStaffCrsOffers(
        requestBody(ids.map((id) => entry(id))),
        dependencies({ searchOffers: async (input) => { received.push(input); return emptyOfferResult(); } }),
      );
      expect(received.map(({ propertyNode }) => propertyNode)).toEqual(ids);
      expect((result as { properties: unknown[] }).properties).toHaveLength(ids.length);
    }
  });

  test("rejects unknown envelope keys, malformed entries, bad UUIDs, duplicates, and out-of-range counts before search", async () => {
    const invalidBodies = [
      requestBody([], { ignored: true }),
      requestBody([]),
      requestBody([entry(PROPERTY_A)], { extra: 1 }),
      requestBody([entry("not-a-uuid")]),
      requestBody([entry(PROPERTY_A), entry(PROPERTY_A)]),
      requestBody([entry(PROPERTY_A), entry(PROPERTY_B), entry(PROPERTY_C), entry(PROPERTY_D), entry(PROPERTY_FOREIGN)]),
      requestBody([{ property_id: PROPERTY_A, search: searchBody(), extra: true }]),
    ];

    for (const body of invalidBodies) {
      let searches = 0;
      await expectSearchError(
        () => searchStaffCrsOffers(body, dependencies({ searchOffers: async () => {
          searches += 1;
          return emptyOfferResult();
        } })),
        { status: 400, code: "request/invalid" },
      );
      expect(searches).toBe(0);
    }
  });

  test("uses the canonical parser and rejects bad canonical inputs before authorization or search", async () => {
    const parsedInputs: unknown[] = [];
    let grants = 0;
    let searches = 0;
    const malformedCanonical = searchBody({ legacy: true });
    await expectSearchError(
      () => searchStaffCrsOffers(requestBody([entry(PROPERTY_A, malformedCanonical)]),
        dependencies({
          parseCanonicalSearch: (value) => {
            parsedInputs.push(value);
            return value === malformedCanonical ? null : parsedSearch();
          },
          listGrantedProperties: async () => { grants += 1; return properties([PROPERTY_A]); },
          searchOffers: async () => { searches += 1; return emptyOfferResult(); },
        })),
      { status: 400, code: "request/invalid" },
    );
    expect(parsedInputs).toEqual([malformedCanonical]);
    expect(grants).toBe(0);
    expect(searches).toBe(0);
  });

  test("authorizes every selected property before starting any offer search", async () => {
    const calls: string[] = [];
    await expectSearchError(
      () => searchStaffCrsOffers(requestBody([entry(PROPERTY_A), entry(PROPERTY_FOREIGN)]), dependencies({
        listGrantedProperties: async () => { calls.push("grants"); return properties([PROPERTY_A]); },
        searchOffers: async ({ propertyNode }) => { calls.push(`search:${propertyNode}`); return emptyOfferResult(); },
      })),
      { status: 403, code: "auth/forbidden" },
    );
    expect(calls).toEqual(["grants"]);
  });

  test("uses one generic forbidden error for unknown, foreign, and ungranted properties", async () => {
    const errors: Array<{ status: number; code: string; detail: string }> = [];
    for (const propertiesForActor of [[], properties([PROPERTY_A])]) {
      for (const requested of [PROPERTY_FOREIGN, PROPERTY_B]) {
        let offerCalls = 0;
        try {
          await searchStaffCrsOffers(requestBody([entry(requested)]), dependencies({
            listGrantedProperties: async () => propertiesForActor,
            searchOffers: async () => { offerCalls += 1; return emptyOfferResult(); },
          }));
          throw new Error("expected a forbidden result");
        } catch (error) {
          expect(error).toBeInstanceOf(StaffCrsSearchError);
          const failure = error as StaffCrsSearchError;
          errors.push({ status: failure.status, code: failure.code, detail: failure.detail });
        }
        expect(offerCalls).toBe(0);
      }
    }
    expect(errors).toHaveLength(4);
    expect(errors.every(({ status, code }) => status === 403 && code === "auth/forbidden")).toBe(true);
    expect(new Set(errors.map(({ detail }) => detail)).size).toBe(1);
  });

  test("returns unavailable after current authorization when the offer capability is absent", async () => {
    const calls: string[] = [];
    await expectSearchError(
      () => searchStaffCrsOffers(requestBody([entry(PROPERTY_A)]), dependencies({
        listGrantedProperties: async () => { calls.push("grants"); return properties([PROPERTY_A]); },
        searchOffers: null,
      })),
      { status: 503, code: "service/unavailable" },
    );
    expect(calls).toEqual(["grants"]);
  });

  test("snapshots parsed searches and property ids before asynchronous grant loading", async () => {
    let releaseGrants!: (value: ReturnType<typeof properties>) => void;
    const grants = new Promise<ReturnType<typeof properties>>((resolve) => { releaseGrants = resolve; });
    const parsed = parsedSearch();
    const body = requestBody([entry(PROPERTY_A, searchBody())]);
    const actualInputs: ReservationOfferSearchInput[] = [];
    const pending = searchStaffCrsOffers(body, dependencies({
      parseCanonicalSearch: () => parsed,
      listGrantedProperties: () => grants,
      searchOffers: async (input) => { actualInputs.push(input); return emptyOfferResult(); },
    }));

    (body as { searches: Array<{ property_id: string; search: Record<string, unknown> }> })
      .searches[0]!.property_id = PROPERTY_B;
    (body as { searches: Array<{ property_id: string; search: Record<string, unknown> }> })
      .searches[0]!.search.stay = { from: "2030-01-01T00:00:00Z", to: "2030-01-02T00:00:00Z" };
    parsed.stayStart.setUTCFullYear(2035);
    (parsed.guests.childAges as number[])[0] = 16;
    (parsed.unitTypeCodes as string[])[0] = "MUTATED_TYPE";
    (parsed.ratePlanCodes as string[])[0] = "MUTATED_RATE";
    (parsed.selectedPromotionCodes as string[])[0] = "MUTATED";
    (parsed.commercial as { marketCode: string; sourceCode: string }).marketCode = "MUTATED";

    releaseGrants(properties([PROPERTY_A, PROPERTY_B]));
    await pending;
    expect(actualInputs).toHaveLength(1);
    expect(actualInputs[0]).toMatchObject({
      propertyNode: PROPERTY_A,
      stayStart: new Date("2026-10-10T11:00:00.000Z"),
      stayEnd: new Date("2026-10-12T07:00:00.000Z"),
      guests: { adults: 2, childAges: [7] },
      unitTypeCodes: ["DLX"],
      ratePlanCodes: ["FLEX"],
      selectedPromotionCodes: ["AUTUMN"],
      commercial: { marketCode: "LEISURE", sourceCode: "WEB" },
    });
  });

  test("searches properties serially in request order and returns each canonical result unchanged", async () => {
    const starts: string[] = [];
    const finishes: string[] = [];
    let active = 0;
    let maximumActive = 0;
    const canonical = {
      options: [{
        perNight: [{ date: "2026-10-10", amountMinor: 12_345n }],
        total: { amountMinor: 24_690n, currency: "USD", kind: "pre_tax" as const },
        policies: { cancellation: { policyId: "policy-1", evidenceRef: "policy:evidence" } },
        restrictionsApplied: [{ id: "restriction-1", kind: "min_los", value: 2, blocks: false }],
        operationalBlocksApplied: [],
        availableCount: 1,
        promise: false,
        commitArbitrationRequired: true,
        evidence: { quoteHash: "quote-hash", availabilityRef: "availability:ref", bookingInstant: "2026-10-01T00:00:00.000Z" },
      }],
      issues: [],
      summary: { inventoryOptions: 1, candidatePairs: 1, evaluatedPairs: 1, bookable: 1 },
    } as unknown as ReservationOfferSearchResult;
    const serialized = {
      options: [{ per_night: [{ date: "2026-10-10", amount_minor: "12345" }],
        total: { amount_minor: "24690", currency: "USD", kind: "pre_tax" },
        policies: { cancellation: { policy_id: "policy-1", evidence_ref: "policy:evidence" } },
        available_count: 1, promise: false, commit_arbitration_required: true,
        evidence: { quote_hash: "quote-hash", availability_ref: "availability:ref" } }],
      issues: [], summary: { candidate_pairs: 1 },
    } as unknown as JsonValue;
    const searchOffers = async ({ propertyNode }: ReservationOfferSearchInput) => {
      starts.push(propertyNode);
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await Promise.resolve();
      finishes.push(propertyNode);
      active -= 1;
      return canonical;
    };
    const serializedResults: ReservationOfferSearchResult[] = [];
    const result = await searchStaffCrsOffers(
      requestBody([entry(PROPERTY_B), entry(PROPERTY_A)]),
      dependencies({
        listGrantedProperties: async () => properties([PROPERTY_A, PROPERTY_B]),
        searchOffers,
        serializeOffers: (value) => { serializedResults.push(value); return serialized; },
      }),
    );

    expect(starts).toEqual([PROPERTY_B, PROPERTY_A]);
    expect(finishes).toEqual([PROPERTY_B, PROPERTY_A]);
    expect(maximumActive).toBe(1);
    expect(serializedResults).toEqual([canonical, canonical]);
    expect(result).toEqual({ properties: [
      { property_id: PROPERTY_B, property_name: "Property 2", time_zone: "Europe/London", result: serialized },
      { property_id: PROPERTY_A, property_name: "Property 1", time_zone: "Asia/Dubai", result: serialized },
    ] });
  });

  test("snapshots authorized property labels before offer services can mutate the grant rows", async () => {
    const mutableGrants = properties([PROPERTY_A]) as Array<{ id: string; name: string; timezone: string }>;
    const result = await searchStaffCrsOffers(requestBody([entry(PROPERTY_A)]), dependencies({
      listGrantedProperties: async () => mutableGrants,
      searchOffers: async () => {
        mutableGrants[0]!.id = PROPERTY_FOREIGN;
        mutableGrants[0]!.name = "Changed after authorization";
        mutableGrants[0]!.timezone = "Etc/Unknown";
        return emptyOfferResult();
      },
    }));
    expect((result as { properties: Array<Record<string, unknown>> }).properties[0]).toMatchObject({
      property_id: PROPERTY_A,
      property_name: "Property 1",
      time_zone: "Asia/Dubai",
    });
  });

  test("does not return a partial property batch when a later property search fails", async () => {
    let calls = 0;
    const failure = new Error("injected offer backend failure");
    await expect(searchStaffCrsOffers(requestBody([entry(PROPERTY_A), entry(PROPERTY_B)]), dependencies({
      searchOffers: async () => {
        calls += 1;
        if (calls === 2) throw failure;
        return emptyOfferResult();
      },
    }))).rejects.toBe(failure);
    expect(calls).toBe(2);
  });

  test("reads UTF-8 JSON by actual byte count when Content-Length lies or is absent", async () => {
    const exactPrefix = '{"padding":"';
    const exactSuffix = '"}';
    const exactLengthBody = `${exactPrefix}${"x".repeat(MAX_REQUEST_BYTES - exactPrefix.length - exactSuffix.length)}${exactSuffix}`;
    expect(utf8Bytes(exactLengthBody).byteLength).toBe(MAX_REQUEST_BYTES);
    expect(await readCrsSearchJson(requestWithStream(utf8Bytes(exactLengthBody), {
      "content-type": "application/json",
      "content-length": String(MAX_REQUEST_BYTES),
    }))).toEqual({ padding: "x".repeat(MAX_REQUEST_BYTES - exactPrefix.length - exactSuffix.length) });

    const accepted = JSON.stringify({ note: "💡".repeat(16_000) });
    expect(utf8Bytes(accepted).byteLength).toBeLessThanOrEqual(MAX_REQUEST_BYTES);
    const parsed = await readCrsSearchJson(requestWithStream(utf8Bytes(accepted), {
      "content-type": "application/json; charset=utf-8",
      "content-length": "1",
    }));
    expect(parsed).toEqual({ note: "💡".repeat(16_000) });

    const oversized = JSON.stringify({ note: "💡".repeat(16_384) });
    expect(utf8Bytes(oversized).byteLength).toBeGreaterThan(MAX_REQUEST_BYTES);
    for (const headers of [
      { "content-type": "application/json", "content-length": "1" },
      { "content-type": "application/json" },
    ] as HeadersInit[]) {
      await expectSearchError(
        () => readCrsSearchJson(requestWithStream(utf8Bytes(oversized), headers)),
        { status: 400, code: "request/too_large" },
      );
    }
  });

  test("cancels an overflowing body and rejects wrong content type, malformed JSON, and invalid UTF-8", async () => {
    let cancelled = false;
    const overflowing = new Uint8Array(MAX_REQUEST_BYTES + 1).fill(0x20);
    await expectSearchError(
      () => readCrsSearchJson(requestWithStream(overflowing, { "content-type": "application/json" }, () => {
        cancelled = true;
      }, false)),
      { status: 400, code: "request/too_large" },
    );
    expect(cancelled).toBe(true);

    for (const [bytes, headers] of [
      [utf8Bytes("{}"), { "content-type": "text/plain" }],
      [utf8Bytes("{"), { "content-type": "application/json" }],
      [new Uint8Array([0xff, 0xfe]), { "content-type": "application/json" }],
    ] as const) {
      await expectSearchError(
        () => readCrsSearchJson(requestWithStream(bytes, headers)),
        { status: 400, code: "request/invalid" },
      );
    }
  });

  test("cancels a stalled body when the bounded reader deadline expires", async () => {
    let cancelled = false;
    await expectSearchError(
      () => readCrsSearchJson(requestWithPendingBody({ "content-type": "application/json" }, () => {
        cancelled = true;
      }), { timeoutMs: 5 }),
      { status: 400, code: "request/invalid" },
    );
    expect(cancelled).toBe(true);
  });

  test("accepts an empty fragment before valid JSON", async () => {
    const result = await readCrsSearchJson(requestWithChunks([
      new Uint8Array(0),
      utf8Bytes("{}"),
    ]));
    expect(result).toEqual({});
  });

  test("rejects finite synchronous empty-chunk work that runs beyond the reader deadline", async () => {
    const chunks: Uint8Array[] = Array.from({ length: 100_000 }, () => new Uint8Array(0));
    chunks.push(utf8Bytes("{}"));
    await expectSearchError(
      () => readCrsSearchJson(requestWithChunks(chunks), { timeoutMs: 1 }),
      { status: 400, code: "request/invalid" },
    );
  });

  test("measures the serialized response in UTF-8 bytes and rejects oversize results without returning partial data", async () => {
    const fitting = { label: "🛏️".repeat(20_000) } as unknown as JsonValue;
    const ok = await searchStaffCrsOffers(requestBody([entry(PROPERTY_A)]), dependencies({
      serializeOffers: () => fitting,
    }));
    expect((ok as { properties: Array<{ result: JsonValue }> }).properties[0]?.result).toBe(fitting);
    expect(utf8Bytes(JSON.stringify(ok)).byteLength).toBeLessThan(MAX_RESPONSE_BYTES);

    const multibyteOverflow = { label: "🛏️".repeat(150_000) } as unknown as JsonValue;
    expect(JSON.stringify(multibyteOverflow).length).toBeLessThan(MAX_RESPONSE_BYTES);
    await expectSearchError(
      () => searchStaffCrsOffers(requestBody([entry(PROPERTY_A)]), dependencies({
        serializeOffers: () => multibyteOverflow,
      })),
      { status: 400, code: "request/response_too_large" },
    );

    const resultPrefix = `{"properties":[{"property_id":"${PROPERTY_A}","property_name":"Property 1","time_zone":"Asia/Dubai","result":{"label":"`;
    const resultSuffix = '"}}]}';
    const paddingLength = MAX_RESPONSE_BYTES - utf8Bytes(resultPrefix).byteLength - utf8Bytes(resultSuffix).byteLength;
    const exactResult = { label: "x".repeat(paddingLength) } as unknown as JsonValue;
    const exactResponse = await searchStaffCrsOffers(requestBody([entry(PROPERTY_A)]), dependencies({
      serializeOffers: () => exactResult,
    }));
    expect(utf8Bytes(JSON.stringify(exactResponse)).byteLength).toBe(MAX_RESPONSE_BYTES);

    let searches = 0;
    const oversized = { label: "x".repeat(paddingLength + 1) } as unknown as JsonValue;
    await expectSearchError(
      () => searchStaffCrsOffers(requestBody([entry(PROPERTY_A)]), dependencies({
        searchOffers: async () => { searches += 1; return emptyOfferResult(); },
        serializeOffers: () => oversized,
      })),
      { status: 400, code: "request/response_too_large" },
    );
    expect(searches).toBe(1);
  });
});
