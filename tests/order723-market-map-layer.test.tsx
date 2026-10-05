import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Map as MapLibreMap } from "maplibre-gl";
import {
  attachMarketListingLayers, decodeMarketListingJson, MARKET_CLUSTER_LAYER, MARKET_CLUSTER_COUNT_LAYER, MARKET_LISTING_SOURCE,
  MARKET_POINT_LAYER, marketListingGeoJson,
} from "../frontend/yellow/src/market-listing-import";
import { MarketListingResults, StreetMapWorkspace } from "../frontend/yellow/src/workspaces/StreetMapWorkspace";
const row = (overrides: Record<string, unknown> = {}) => ({ listingId: "900719925474099312345", sourceRowId: "101",
  listingLink: "https://example.test/listing/101", latitude: "24.43128", longitude: "54.6207",
  coordinatePrecision: "source-approximate", bedrooms: "Studio", starRating: null, reviews: "0",
  priceNextYearAverage: "393.0", activeNights: "361.0", minimumStay: "3", dynamicPricing: "Moderate",
  newListing: false, title: "Synthetic listing", ...overrides });
const packageJson = (rows: unknown[]) => JSON.stringify({ schemaVersion: "yellow.pricelabs-dashboard-listings/v1",
  operational: false, source: { provider: "PriceLabs", market: "Abu Dhabi, UAE", dashboardId: "187188", currency: "AED",
    sourceRefreshed: "25 September 2026 02:12 AM", sourceRefreshTimezone: null, observedAt: "2026-09-25T12:34:56Z",
    contextBasis: "operator-supplied-dashboard-context-not-encoded-in-csv" },
  limitations: ["listing_coordinates_are_approximate", "listing_price_is_next_year_average_not_october_quote",
    "future_percentiles_are_regional_advertised_nightly_rates_excluding_fees",
    "no_listing_availability_or_confirmed_transaction_price", "no_dubai_or_global_coverage"], rows });

function mapHarness() {
  const events: string[] = [];
  const sources = new Map<string, { setData(data: unknown): Promise<void>; getClusterExpansionZoom(id: number): Promise<number> }>();
  const layers = new Set<string>();
  const layerSpecs = new Map<string, { id: string; layout?: Record<string, unknown> }>();
  const listeners = new Map<string, (event: unknown) => void>();
  let latestData: unknown;
  let queried: unknown[] = [];
  let expansionResolve: ((zoom: number) => void) | undefined;
  const map = {
    addSource(id: string, options: unknown) {
      events.push(`source:add:${id}`); latestData = (options as { data: unknown }).data;
      sources.set(id, { setData: async data => { latestData = data; events.push("source:update"); },
        getClusterExpansionZoom: () => new Promise<number>(resolve => { expansionResolve = resolve; }) });
    },
    getSource: (id: string) => sources.get(id),
    removeSource(id: string) { events.push(`source:remove:${id}`); sources.delete(id); },
    addLayer(layer: { id: string; layout?: Record<string, unknown> }) { events.push(`layer:add:${layer.id}`); layers.add(layer.id); layerSpecs.set(layer.id, layer); },
    getLayer: (id: string) => layers.has(id) ? { id } : undefined,
    removeLayer(id: string) { events.push(`layer:remove:${id}`); layers.delete(id); layerSpecs.delete(id); },
    on(type: string, layer: string, listener: (event: unknown) => void) { listeners.set(`${type}:${layer}`, listener); events.push(`on:${layer}`); },
    off(type: string, layer: string) { listeners.delete(`${type}:${layer}`); events.push(`off:${layer}`); },
    queryRenderedFeatures: () => queried,
    flyTo: () => { events.push("fly"); },
    fitBounds: () => { events.push("fit"); },
    easeTo: () => { events.push("expand"); },
  } as unknown as MapLibreMap;
  return {
    map, events, sources, layers, layerSpecs, listeners,
    data: () => latestData as ReturnType<typeof marketListingGeoJson>,
    query: (features: unknown[]) => { queried = features; },
    click: (layer: string) => listeners.get(`click:${layer}`)?.({ point: { x: 1, y: 1 } }),
    resolveExpansion: (zoom: number) => expansionResolve?.(zoom),
  };
}

describe("Order723 client-only clustered layer lifecycle", () => {
  test("renders accessible paged plain-text results and detail independent of map availability", () => {
    const rows = Array.from({ length: 21 }, (_, index) => row({ listingId: String(index + 1), sourceRowId: String(index + 101),
      title: index === 0 ? '<img src=x onerror="alert(1)">' : `Listing ${index + 1}` }));
    const data = decodeMarketListingJson(packageJson(rows));
    const first = renderToStaticMarkup(createElement(MarketListingResults, {
      data, rows: data.rows, page: 1, selected: data.rows[0]!, onSelect: () => {}, onPage: () => {},
    }));
    expect(first).toContain("Imported listing results");
    expect(first).toContain("Page 1 of 2");
    expect(first).toContain('aria-pressed="true"');
    expect(first).toContain("&lt;img src=x");
    expect(first).not.toContain("<img src=x");
    expect(first).toContain("AED 393.0 next-year average");
    expect(first).not.toContain("October listing rate");
    expect(first).toContain("Source URL (text only)");
    expect(first).not.toContain('href="https://example.test/listing/101"');
    const second = renderToStaticMarkup(createElement(MarketListingResults, {
      data, rows: data.rows, page: 2, selected: null, onSelect: () => {}, onPage: () => {},
    }));
    expect(second).toContain("Page 2 of 2");
    expect(second).toContain("Listing 21");
    expect(second).not.toContain("Listing 20");
    const empty = renderToStaticMarkup(createElement(MarketListingResults, {
      data, rows: [], page: 1, selected: null, onSelect: () => {}, onPage: () => {},
    }));
    expect(empty).toContain("No listings match these filters");
    const workspace = renderToStaticMarkup(createElement(StreetMapWorkspace));
    expect(workspace).toContain("Import normalized PriceLabs listing JSON");
    expect(workspace).toContain("listing file and row fields are not uploaded");
    expect(workspace).toContain("tile requests can reveal the area you view");
  });
  test("mounts clustered source, updates filtered points, selects by id and fully removes on clear", () => {
    const harness = mapHarness(); const selected: string[] = [];
    const layer = attachMarketListingLayers(harness.map, id => selected.push(id));
    expect(harness.sources.has(MARKET_LISTING_SOURCE)).toBe(true);
    expect(harness.layers.has(MARKET_CLUSTER_LAYER)).toBe(true);
    expect(harness.layers.has(MARKET_POINT_LAYER)).toBe(true);
    expect(harness.layerSpecs.get(MARKET_CLUSTER_COUNT_LAYER)?.layout?.["text-font"]).toEqual(["Noto Sans Regular"]);
    const rows = decodeMarketListingJson(packageJson([
      row(), row({ listingId: "2", sourceRowId: "102", latitude: "24.5", longitude: "54.7" }),
      row({ listingId: "3", sourceRowId: "103", latitude: null, longitude: null }),
    ])).rows;
    layer.update(rows, true);
    expect(harness.data().features).toHaveLength(2);
    expect(harness.events).toContain("fit");
    layer.update([rows[0]!]);
    expect(harness.data().features).toHaveLength(1);
    harness.query([{ properties: { listingId: rows[0]!.listingId }, geometry: { type: "Point", coordinates: [54.6, 24.4] } }]);
    harness.click(MARKET_POINT_LAYER);
    expect(selected).toEqual([rows[0]!.listingId]);
    layer.dispose();
    expect(harness.sources.size).toBe(0);
    expect(harness.layers.size).toBe(0);
    expect(harness.listeners.size).toBe(0);
    harness.click(MARKET_POINT_LAYER);
    expect(selected).toHaveLength(1);
    const retried = attachMarketListingLayers(harness.map, id => selected.push(id));
    retried.update(rows, true);
    expect(harness.data().features).toHaveLength(2);
    retried.dispose();
  });

  test("cluster click expands only while mounted; tile failure leaves list data independent", async () => {
    const harness = mapHarness();
    const layer = attachMarketListingLayers(harness.map, () => {});
    harness.query([{ properties: { cluster_id: 7 }, geometry: { type: "Point", coordinates: [54.6, 24.4] } }]);
    harness.click(MARKET_CLUSTER_LAYER);
    harness.resolveExpansion(13);
    await Promise.resolve();
    expect(harness.events).toContain("expand");
    harness.click(MARKET_CLUSTER_LAYER);
    layer.dispose();
    harness.resolveExpansion(14);
    await Promise.resolve();
    expect(harness.events.filter(event => event === "expand")).toHaveLength(1);
  });
});
