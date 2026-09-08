import { describe, expect, test } from "bun:test";

import {
  MARKET_BATCH_PLANNER_LIMITS,
  buildMarketSourcePlan,
  marketSourceRequestKey,
  type MarketSourcePolicy,
} from "../src/contexts/distribution/market-batches";

function policy(overrides: Partial<MarketSourcePolicy> = {}): MarketSourcePolicy {
  return {
    tenantId: "tenant-a",
    managedPropertyId: "property-a",
    permissionScope: "market-read",
    entitlement: "public-rates",
    propertyTimezone: "America/New_York",
    lookaheadMonths: 3,
    selectedSources: ["booking-mcp", "trivago-mcp"],
    competitorScope: ["hotel-z", "Hotel Two"],
    destination: "New York, NY",
    guests: { rooms: 1, adults: 2, childAges: [11, 4] },
    currency: "USD",
    pointOfSaleMarket: "US",
    language: "en-US",
    lengthsOfStayNights: [1, 3],
    ...overrides,
  };
}

const NOW = "2026-09-08T04:30:00.000Z";

describe("Order RMS-20260908B client-selected market batches", () => {
  test("source opt-in is explicit, deduplicated and never silently defaults", () => {
    const none = buildMarketSourcePlan(policy({ selectedSources: [] }), {
      now: NOW, maxBatchSize: 10, maxRequestsThisRun: 10,
    });
    expect(none).toMatchObject({ requestedPotentialQueryCount: 0, dueRequestCount: 0,
      selectedRequestCount: 0, deferredRequestCount: 0, nextDueAtUtc: null, batches: [] });

    const duplicates = buildMarketSourcePlan(policy({
      selectedSources: ["booking-mcp", "booking-mcp"],
      lengthsOfStayNights: [1, 1],
    }), { now: NOW, maxBatchSize: 500, maxRequestsThisRun: 500 });
    expect(duplicates.requestedPotentialQueryCount).toBe(91);
    expect(duplicates.batches.flatMap(({ requests }) => requests)
      .every(({ source }) => source === "booking-mcp")).toBe(true);
  });

  test("property-local date drives an exact half-open calendar window across DST", () => {
    // Still March 7 in New York even though UTC is already March 8; DST starts later that day.
    const result = buildMarketSourcePlan(policy({
      selectedSources: ["google-visible"], lengthsOfStayNights: [1],
    }), { now: "2026-03-08T04:30:00.000Z", maxBatchSize: 1_000, maxRequestsThisRun: 1_000 });
    const requests = result.batches.flatMap(({ requests }) => requests);
    expect(result.propertyLocalDate).toBe("2026-03-07");
    expect(result.arrivalEndExclusive).toBe("2026-06-07");
    expect(requests).toHaveLength(92);
    expect(requests[0]?.arrivalDate).toBe("2026-03-07");
    expect(requests[1]?.arrivalDate).toBe("2026-03-08");
    expect(requests.at(-1)?.arrivalDate).toBe("2026-06-06");

    const clamped = buildMarketSourcePlan(policy({
      propertyTimezone: "UTC", selectedSources: ["google-visible"], lengthsOfStayNights: [1],
    }), { now: "2024-11-30T23:00:00.000Z", maxBatchSize: 1_000, maxRequestsThisRun: 1_000 });
    expect(clamped.arrivalEndExclusive).toBe("2025-02-28");
    expect(clamped.requestedPotentialQueryCount).toBe(90);
    expect(clamped.batches.flatMap(({ requests }) => requests).at(-1)?.arrivalDate).toBe("2025-02-27");
  });

  test("leap-day four-month planning includes each arrival once and permits checkout beyond horizon", () => {
    const result = buildMarketSourcePlan(policy({
      propertyTimezone: "UTC", lookaheadMonths: 4, selectedSources: ["google-hotels-serpapi"],
      lengthsOfStayNights: [365],
    }), { now: "2024-01-31T12:00:00.000Z", maxBatchSize: 200, maxRequestsThisRun: 200 });
    const requests = result.batches.flatMap(({ requests }) => requests);
    expect(result.arrivalEndExclusive).toBe("2024-05-31");
    expect(result.requestedPotentialQueryCount).toBe(121);
    expect(requests.some(({ arrivalDate }) => arrivalDate === "2024-02-29")).toBe(true);
    expect(requests.at(-1)).toMatchObject({ arrivalDate: "2024-05-30", checkoutDate: "2025-05-30" });
  });

  test("one destination query retains the whole competitor scope instead of multiplying competitors", () => {
    const one = buildMarketSourcePlan(policy({
      selectedSources: ["booking-mcp"], lengthsOfStayNights: [1], competitorScope: ["a"],
    }), { now: NOW, maxBatchSize: 500, maxRequestsThisRun: 500 });
    const many = buildMarketSourcePlan(policy({
      selectedSources: ["booking-mcp"], lengthsOfStayNights: [1], competitorScope: ["c", "a", "b"],
    }), { now: NOW, maxBatchSize: 500, maxRequestsThisRun: 500 });
    expect(many.requestedPotentialQueryCount).toBe(one.requestedPotentialQueryCount);
    expect(many.batches[0]?.requests[0]?.competitorScope).toEqual(["a", "b", "c"]);
    expect(many.batches[0]?.requests[0]?.key).not.toBe(one.batches[0]?.requests[0]?.key);
  });

  test("POS and supported BCP47 language canonicalize to the adapter query contract", () => {
    const result = buildMarketSourcePlan(policy({
      selectedSources: ["google-hotels-serpapi"],
      lengthsOfStayNights: [1],
      pointOfSaleMarket: "ae",
      language: "EN-gb",
    }), { now: NOW, maxBatchSize: 1, maxRequestsThisRun: 1 });
    expect(result.batches[0]?.requests[0]).toMatchObject({
      pointOfSaleMarket: "AE",
      language: "en-GB",
    });
    const selector = {
      source: "google-hotels-serpapi" as const,
      arrivalDate: "2026-09-08",
      lengthOfStayNights: 1,
    };
    expect(marketSourceRequestKey(policy({
      selectedSources: ["google-hotels-serpapi"], lengthsOfStayNights: [1],
      pointOfSaleMarket: "ae", language: "EN-gb",
    }), selector)).toBe(marketSourceRequestKey(policy({
      selectedSources: ["google-hotels-serpapi"], lengthsOfStayNights: [1],
      pointOfSaleMarket: "AE", language: "en-GB",
    }), selector));
  });

  test("the history key bound admits the largest planner-generated scoped identity", () => {
    const maximumScopePolicy = policy({
      tenantId: `t${"a".repeat(127)}`,
      managedPropertyId: `p${"b".repeat(127)}`,
      permissionScope: `s${"c".repeat(127)}`,
      entitlement: `e${"d".repeat(127)}`,
      selectedSources: ["google-visible"],
      competitorScope: Array.from({ length: 200 }, (_, index) =>
        `${"\\".repeat(250)}${String(index).padStart(6, "0")}`),
      destination: "\\".repeat(256),
      guests: { rooms: 100, adults: 200, childAges: Array.from({ length: 100 }, () => 25) },
      lengthsOfStayNights: [365],
    });
    const selector = {
      source: "google-visible" as const,
      arrivalDate: "2026-09-08",
      lengthOfStayNights: 365,
    };
    const key = marketSourceRequestKey(maximumScopePolicy, selector);
    expect(key.length).toBeLessThanOrEqual(MARKET_BATCH_PLANNER_LIMITS.maximumLastSuccessKeyCharacters);
    expect(() => buildMarketSourcePlan(maximumScopePolicy, {
      now: NOW, lastSuccessByKey: { [key]: NOW }, maxBatchSize: 1, maxRequestsThisRun: 1,
    })).not.toThrow();
  });

  test("every required authority, scope, query, party and stay dimension isolates the canonical key", () => {
    const base = policy({ selectedSources: ["booking-mcp"], lengthsOfStayNights: [2] });
    const selector = { source: "booking-mcp" as const, arrivalDate: "2026-09-20", lengthOfStayNights: 2 };
    const variants: MarketSourcePolicy[] = [
      policy({ ...base, tenantId: "tenant-b" }),
      policy({ ...base, managedPropertyId: "property-b" }),
      policy({ ...base, permissionScope: "market-read-b" }),
      policy({ ...base, entitlement: "member-rate" }),
      policy({ ...base, competitorScope: ["different"] }),
      policy({ ...base, destination: "Boston, MA" }),
      policy({ ...base, guests: { ...base.guests, rooms: 2 } }),
      policy({ ...base, guests: { ...base.guests, adults: 3 } }),
      policy({ ...base, guests: { ...base.guests, childAges: [5] } }),
      policy({ ...base, currency: "EUR" }),
      policy({ ...base, pointOfSaleMarket: "GB" }),
      policy({ ...base, language: "fr-FR" }),
    ];
    const keys = new Set([marketSourceRequestKey(base, selector),
      ...variants.map((variant) => marketSourceRequestKey(variant, selector)),
      marketSourceRequestKey({ ...base, selectedSources: ["trivago-mcp"] },
        { ...selector, source: "trivago-mcp" }),
      marketSourceRequestKey({ ...base, lengthsOfStayNights: [3] },
        { ...selector, lengthOfStayNights: 3 }),
      marketSourceRequestKey(base, { ...selector, arrivalDate: "2026-09-21" }),
    ]);
    expect(keys.size).toBe(variants.length + 4);
    expect(marketSourceRequestKey(base, selector)).toBe(marketSourceRequestKey(policy({
      ...base, competitorScope: [...base.competitorScope].reverse(),
      guests: { ...base.guests, childAges: [...base.guests.childAges].reverse() },
    }), selector));
    expect(marketSourceRequestKey(policy({ ...base,
      guests: { ...base.guests, childAges: [4, 4, 11] },
    }), selector)).not.toBe(marketSourceRequestKey(base, selector));
  });

  test("cadence equality is due, exact-key success suppresses only that search, and freshness is not inferred", () => {
    const selectedPolicy = policy({ selectedSources: ["booking-mcp"], lengthsOfStayNights: [1] });
    const key = marketSourceRequestKey(selectedPolicy, {
      source: "booking-mcp", arrivalDate: "2026-09-08", lengthOfStayNights: 1,
    });
    const dueAtEquality = buildMarketSourcePlan(selectedPolicy, {
      now: NOW, lastSuccessByKey: { [key]: "2026-09-08T03:30:00.000Z" },
      maxBatchSize: 500, maxRequestsThisRun: 500,
    });
    expect(dueAtEquality.dueRequestCount).toBe(dueAtEquality.requestedPotentialQueryCount);

    const nonmatchingKey = buildMarketSourcePlan(selectedPolicy, {
      now: NOW, lastSuccessByKey: { [`${key}-different`]: NOW },
      maxBatchSize: 500, maxRequestsThisRun: 500,
    });
    expect(nonmatchingKey.dueRequestCount).toBe(nonmatchingKey.requestedPotentialQueryCount);

    const suppressed = buildMarketSourcePlan(selectedPolicy, {
      now: NOW, lastSuccessByKey: { [key]: "2026-09-08T03:30:00.001Z" },
      maxBatchSize: 500, maxRequestsThisRun: 500,
    });
    expect(suppressed.deferredDueToCadenceCount).toBe(1);
    expect(suppressed.dueRequestCount).toBe(suppressed.requestedPotentialQueryCount - 1);
    expect(suppressed.nextDueAtUtc).toBe("2026-09-08T04:30:00.001Z");
    expect(suppressed.batches.flatMap(({ requests }) => requests).some((request) => request.key === key)).toBe(false);

    const farPolicy = policy({ lookaheadMonths: 4, selectedSources: ["booking-mcp"],
      lengthsOfStayNights: [1] });
    const farKey = marketSourceRequestKey(farPolicy, {
      source: "booking-mcp", arrivalDate: "2026-12-08", lengthOfStayNights: 1,
    });
    const sixHourBoundary = buildMarketSourcePlan(farPolicy, {
      now: NOW, lastSuccessByKey: { [farKey]: "2026-09-07T22:30:00.000Z" },
      maxBatchSize: 500, maxRequestsThisRun: 500,
    });
    expect(sixHourBoundary.batches.flatMap(({ requests }) => requests)
      .find(({ key: requestKey }) => requestKey === farKey)?.cadence).toEqual({
        kind: "fixed", intervalMinutes: 360,
      });
  });

  test("urgency precedes source, budget and batches are exact, and due work remains deferred now", () => {
    const result = buildMarketSourcePlan(policy({ lengthsOfStayNights: [3, 1] }), {
      now: NOW, maxBatchSize: 3, maxRequestsThisRun: 5,
    });
    const selected = result.batches.flatMap(({ requests }) => requests);
    expect(result.batches.map(({ requests }) => requests.length)).toEqual([3, 2]);
    expect(selected.map(({ daysAhead }) => daysAhead)).toEqual([0, 0, 0, 0, 1]);
    expect(selected.slice(0, 4).map(({ source }) => source)).toEqual([
      "booking-mcp", "booking-mcp", "trivago-mcp", "trivago-mcp",
    ]);
    expect(result.selectedRequestCount).toBe(5);
    expect(result.deferredDueToBudgetCount).toBe(result.dueRequestCount - 5);
    expect(result.nextDueAtUtc).toBe(NOW);
  });

  test("invalid horizons, bounds, timestamps, timezones and oversized policies fail closed", () => {
    expect(() => buildMarketSourcePlan(policy({ lookaheadMonths: 2 as 3 }), {
      now: NOW, maxBatchSize: 1, maxRequestsThisRun: 1,
    })).toThrow("lookaheadMonths");
    expect(() => buildMarketSourcePlan(policy({ propertyTimezone: "Mars/Olympus" }), {
      now: NOW, maxBatchSize: 1, maxRequestsThisRun: 1,
    })).toThrow("propertyTimezone");
    expect(() => buildMarketSourcePlan(policy({ selectedSources: ["all-otas" as "booking-mcp"] }), {
      now: NOW, maxBatchSize: 1, maxRequestsThisRun: 1,
    })).toThrow("unsupported source");
    expect(() => buildMarketSourcePlan(policy({ pointOfSaleMarket: "UAE" }), {
      now: NOW, maxBatchSize: 1, maxRequestsThisRun: 1,
    })).toThrow("two-letter market code");
    expect(() => buildMarketSourcePlan(policy({ language: "EN_GB" }), {
      now: NOW, maxBatchSize: 1, maxRequestsThisRun: 1,
    })).toThrow("BCP47");
    expect(() => buildMarketSourcePlan(policy({ language: "zh-Hans" }), {
      now: NOW, maxBatchSize: 1, maxRequestsThisRun: 1,
    })).toThrow("supported BCP47");
    expect(() => buildMarketSourcePlan(policy(), {
      now: NOW, maxBatchSize: 0, maxRequestsThisRun: 1,
    })).toThrow("maxBatchSize");
    expect(() => buildMarketSourcePlan(policy(), {
      now: NOW, lastSuccessByKey: { anything: "yesterday" }, maxBatchSize: 1, maxRequestsThisRun: 1,
    })).toThrow("UTC ISO instant");
    expect(() => buildMarketSourcePlan(policy(), {
      now: NOW, lastSuccessByKey: { anything: "2026-09-08T04:30:00.001Z" },
      maxBatchSize: 1, maxRequestsThisRun: 1,
    })).toThrow("future");
    const oversizedHistory = Object.fromEntries(Array.from({ length: 4_001 }, (_, index) =>
      [`history-${index}`, NOW]));
    expect(() => buildMarketSourcePlan(policy(), {
      now: NOW, lastSuccessByKey: oversizedHistory, maxBatchSize: 1, maxRequestsThisRun: 1,
    })).toThrow("at most 4000 entries");
    expect(() => buildMarketSourcePlan(policy(), {
      now: NOW, lastSuccessByKey: { ["x".repeat(131_073)]: NOW },
      maxBatchSize: 1, maxRequestsThisRun: 1,
    })).toThrow("1 to 131072 characters");
    expect(() => buildMarketSourcePlan(policy({
      selectedSources: ["booking-mcp", "trivago-mcp", "google-hotels-serpapi", "google-visible"],
      lengthsOfStayNights: Array.from({ length: 20 }, (_, index) => index + 1),
    }), { now: NOW, maxBatchSize: 1, maxRequestsThisRun: 1 })).toThrow("maximum is 4000");
  });
});
