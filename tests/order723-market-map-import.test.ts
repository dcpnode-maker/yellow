import { describe, expect, test } from "bun:test";
import {
  createMarketListingFileSession, decodeMarketListingJson, filterMarketListings,
  marketListingGeoJson, paginateMarketListings, MarketListingImportError,
} from "../frontend/yellow/src/market-listing-import";

const source = {
  provider: "PriceLabs", market: "Abu Dhabi, UAE", dashboardId: "187188", currency: "AED",
  sourceRefreshed: "25 September 2026 02:12 AM", sourceRefreshTimezone: null,
  observedAt: "2026-09-25T12:34:56Z", contextBasis: "operator-supplied-dashboard-context-not-encoded-in-csv",
};
const limitations = [
  "listing_coordinates_are_approximate", "listing_price_is_next_year_average_not_october_quote",
  "future_percentiles_are_regional_advertised_nightly_rates_excluding_fees",
  "no_listing_availability_or_confirmed_transaction_price", "no_dubai_or_global_coverage",
];
const row = (overrides: Record<string, unknown> = {}) => ({
  listingId: "900719925474099312345", sourceRowId: "101", listingLink: "https://example.test/listing/101",
  latitude: "24.43128", longitude: "54.6207", coordinatePrecision: "source-approximate",
  bedrooms: "Studio", starRating: null, reviews: "0", priceNextYearAverage: "393.0",
  activeNights: "361.0", minimumStay: "3", dynamicPricing: "Moderate", newListing: false,
  title: '<img src=x onerror="alert(1)">', ...overrides,
});
const packageJson = (rows: unknown[] = [row()], overrides: Record<string, unknown> = {}) => JSON.stringify({
  schemaVersion: "yellow.pricelabs-dashboard-listings/v1", operational: false, source, limitations, rows, ...overrides,
});
const code = (action: () => unknown) => { try { action(); } catch (error) { return (error as MarketListingImportError).code; } return "no_error"; };

describe("Order723 strict private listing import", () => {
  test("retains long IDs and source price text, never treats hostile title as markup", () => {
    const data = decodeMarketListingJson(packageJson());
    expect(data.rows[0]?.listingId).toBe("900719925474099312345");
    expect(data.rows[0]?.title).toContain("<img");
    expect(data.rows[0]?.priceNextYearAverage).toBe("393.0");
    expect(data.mappedCount).toBe(1);
    expect(data.unmappedCount).toBe(0);
    expect(data.source.contextBasis).toContain("operator-supplied");
  });

  test("keeps null coordinates unmapped, exact source money and bedroom filter consistent", () => {
    const data = decodeMarketListingJson(packageJson([
      row(), row({ listingId: "2", sourceRowId: "102", title: "Room two", bedrooms: "2", latitude: null, longitude: null, priceNextYearAverage: null }),
      row({ listingId: "3", sourceRowId: "103", title: "Third", bedrooms: "2", latitude: "24.5", longitude: "54.7" }),
    ]));
    expect(data.mappedCount).toBe(2);
    expect(data.unmappedCount).toBe(1);
    expect(marketListingGeoJson(data.rows).features).toHaveLength(2);
    expect(filterMarketListings(data.rows, "room two", "2").map(item => item.listingId)).toEqual(["2"]);
    expect(filterMarketListings(data.rows, "not present", "all")).toEqual([]);
    expect(filterMarketListings(data.rows, "900719925474099312345", "Studio")).toHaveLength(1);
    expect(paginateMarketListings(data.rows, 1, 2).rows).toHaveLength(2);
    expect(paginateMarketListings(data.rows, 2, 2).rows.map(item => item.listingId)).toEqual(["3"]);
  });

  test("rejects wrong provenance, duplicate IDs, coordinates and unsafe links", () => {
    expect(code(() => decodeMarketListingJson(packageJson([], { operational: true })))).toBe("invalid_package");
    expect(code(() => decodeMarketListingJson(packageJson([], { source: { ...source, market: "Dubai" } })))).toBe("contradictory_source");
    expect(code(() => decodeMarketListingJson(packageJson([], { source: { ...source, dashboardId: "abc" } })))).toBe("invalid_source");
    expect(code(() => decodeMarketListingJson(packageJson([], { source: { ...source, currency: "aed" } })))).toBe("invalid_source");
    expect(code(() => decodeMarketListingJson(packageJson([row(), row({ sourceRowId: "102" })])))).toBe("duplicate_id");
    expect(code(() => decodeMarketListingJson(packageJson([row({ latitude: "85.1" })])))).toBe("invalid_coordinate");
    expect(code(() => decodeMarketListingJson(packageJson([row({ latitude: null })])))).toBe("invalid_coordinate");
    expect(code(() => decodeMarketListingJson(packageJson([row({ listingLink: "javascript:alert(1)" })])))).toBe("unsafe_link");
    expect(code(() => decodeMarketListingJson(packageJson([row({ listingLink: "https://name:secret@example.test/" })])))).toBe("unsafe_link");
    expect(code(() => decodeMarketListingJson(packageJson([row({ priceNextYearAverage: "NaN" })])))).toBe("invalid_number");
    expect(code(() => decodeMarketListingJson(packageJson([row({ title: "x".repeat(513) })])))).toBe("text_too_long");
    expect(code(() => decodeMarketListingJson("x".repeat(5_000_001)))).toBe("file_too_large");
  });

  test("accepts later file-supplied report/date/currency context without presenting it as independently verified", () => {
    const data = decodeMarketListingJson(packageJson([row()], { source: { ...source, market: "Riyadh, Saudi Arabia",
      dashboardId: "987654", currency: "SAR", sourceRefreshed: "10 October 2026 09:00 AM",
      observedAt: "2026-10-10T09:12:33.123Z" } }));
    expect(data.source.market).toBe("Riyadh, Saudi Arabia");
    expect(data.source.dashboardId).toBe("987654");
    expect(data.source.currency).toBe("SAR");
    expect(data.source.contextBasis).toContain("operator-supplied");
    expect(code(() => decodeMarketListingJson(packageJson([row()], { source: { ...source,
      observedAt: "2026-02-30T09:12:33Z" } })))).toBe("invalid_source");
  });

  test("async file completion cannot rehydrate after a later import, clear or disposal", async () => {
    const events: string[] = [];
    let resolveFirst: ((text: string) => void) | undefined;
    const first = { size: 100, text: () => new Promise<string>(resolve => { resolveFirst = resolve; }) };
    const next = { size: 100, text: async () => packageJson([row({ listingId: "next", sourceRowId: "102" })]) };
    const session = createMarketListingFileSession({
      onLoaded: data => events.push(`loaded:${data.rows[0]?.listingId}`),
      onError: message => events.push(`error:${message}`), onCleared: () => events.push("cleared"),
    });
    const pending = session.load(first);
    expect(await session.load(next)).toBe(true);
    resolveFirst?.(packageJson());
    expect(await pending).toBe(false);
    expect(events).toEqual(["cleared", "cleared", "loaded:next"]);
    const delayed = session.load({ size: 100, text: () => new Promise<string>(resolve => { resolveFirst = resolve; }) });
    session.clear(); resolveFirst?.(packageJson());
    expect(await delayed).toBe(false);
    const unmount = session.load({ size: 100, text: () => new Promise<string>(resolve => { resolveFirst = resolve; }) });
    session.dispose(); resolveFirst?.(packageJson());
    expect(await unmount).toBe(false);
    expect(events.filter(item => item.startsWith("loaded:"))).toEqual(["loaded:next"]);
  });
});
