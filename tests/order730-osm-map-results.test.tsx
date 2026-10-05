import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import type { Map as MapLibreMap } from "maplibre-gl";
import { attachMarketListingLayers, decodeImportedMarketJson, decodeMarketListingJson, MARKET_POINT_LAYER, type ImportedMarketData } from "../frontend/yellow/src/market-listing-import";
import { decodeOsmMarketJson, type OsmMarketData } from "../frontend/yellow/src/osm-market-import";
import { ImportedMarketSummary, OsmMarketResults, StreetMapWorkspace } from "../frontend/yellow/src/workspaces/StreetMapWorkspace";

function sample(): OsmMarketData {
  const rows = Array.from({ length: 21 }, (_, index) => {
    const id = String(index + 1); const kind = index === 0 ? "way" : "node";
    return { source_type: kind, source_id: id, source_url: `https://www.openstreetmap.org/${kind}/${id}`,
      source_status: "mapped_accommodation_unverified", tourism_kind: index === 0 ? "apartment" : "hotel",
      name: index === 0 ? '<img src=x onerror="alert(1)">' : `Place ${id}`, latitude: 25.1, longitude: 55.2,
      coordinate_kind: index === 0 ? "osm_bounding_box_center" : "osm_node_point", fetched_at: "2026-09-25T15:41:53+00:00",
      active_inventory: "unknown", ota_identity: "unknown", exact_entrance: "unknown", prices: "unknown", calendar: "unknown" };
  });
  return decodeOsmMarketJson(JSON.stringify({ accommodations: rows, metadata: {
    schema: "yellow.osm-accommodation-sample.v1", source_endpoint: "https://overpass-api.de/api/interpreter",
    fetched_at: "2026-09-25T15:41:53+00:00", source_timestamp: "2026-09-25T15:40:58Z", response_sha256: "a".repeat(64), response_bytes: 20000,
    filtered_extract_sha256: "b".repeat(64), bounding_box_south_west_north_east: [24.8, 54.85, 25.45, 55.65],
    coverage: "Bounded Dubai metro POI sample; not a complete market or administrative boundary.",
    returned_elements: 21, retained: 21, excluded: 0, exclusion_counts: {}, attribution: "OpenStreetMap contributors", license: "ODbL-1.0",
    license_url: "https://opendatacommons.org/licenses/odbl/1-0/", copyright_url: "https://www.openstreetmap.org/copyright",
  } }));
}
const priceLabsText = () => JSON.stringify({ schemaVersion: "yellow.pricelabs-dashboard-listings/v1", operational: false,
  source: { provider: "PriceLabs", market: "Abu Dhabi, UAE", dashboardId: "187188", currency: "AED",
    sourceRefreshed: "25 September 2026 02:12 AM", sourceRefreshTimezone: null, observedAt: "2026-09-25T12:34:56Z",
    contextBasis: "operator-supplied-dashboard-context-not-encoded-in-csv" }, rows: [],
  limitations: ["listing_coordinates_are_approximate", "listing_price_is_next_year_average_not_october_quote",
    "future_percentiles_are_regional_advertised_nightly_rates_excluding_fees", "no_listing_availability_or_confirmed_transaction_price", "no_dubai_or_global_coverage"] });

describe("Order730 source-specific accessible map results", () => {
  test("OSM results are escaped, paginated and show no fabricated commercial values", () => {
    const data = sample();
    const markup = renderToStaticMarkup(createElement(OsmMarketResults, {
      data, rows: data.rows, page: 1, selected: data.rows[0]!, onSelect: () => {}, onPage: () => {},
    }));
    expect(markup).toContain("OpenStreetMap accommodation results");
    expect(markup).toContain("Page 1 of 2");
    expect(markup).toContain("Apartment · Mapped area centre");
    expect(markup).toContain("Mapped area centre: 25.1, 55.2");
    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain("&lt;img src=x");
    expect(markup).not.toContain("<img src=x");
    expect(markup).toContain("Active inventory and OTA identity are unknown");
    expect(markup).toContain("Rates, calendar availability, bedrooms and reviews are not supplied");
    expect(markup).toContain("Not a verified entrance or rooftop location");
    expect(markup).toContain("not complete Dubai coverage");
    expect(markup).toContain("neighbouring municipalities");
    expect(markup).toContain("OpenStreetMap contributors");
    expect(markup).toContain("ODbL");
    expect(markup).toContain('href="https://www.openstreetmap.org/way/1"');
    expect(markup).toContain('rel="noopener noreferrer"');
    expect(markup).not.toMatch(/PriceLabs|AED|next-year average|October quote/u);
    const second = renderToStaticMarkup(createElement(OsmMarketResults, { data, rows: data.rows, page: 2, selected: null, onSelect: () => {}, onPage: () => {} }));
    expect(second).toContain("Page 2 of 2");
    expect(second).toContain("Place 21");
    expect(second).not.toContain("Place 20");
    const empty = renderToStaticMarkup(createElement(OsmMarketResults, { data, rows: [], page: 1, selected: null, onSelect: () => {}, onPage: () => {} }));
    expect(empty).toContain("No accommodation places match");
  });

  test("summary discriminates source and keeps previous PriceLabs metadata intact", () => {
    const osm: ImportedMarketData = { kind: "osm", data: sample() };
    const markup = renderToStaticMarkup(createElement(ImportedMarketSummary, { imported: osm }));
    expect(markup).toContain("Dubai metro sample · 21 accommodation places");
    expect(markup).toContain("21 mapped points");
    expect(markup).toContain("21 source records · 0 excluded");
    expect(markup).toContain("not independently authenticated");
    expect(markup).toContain("not an administrative boundary");
    expect(markup).not.toContain("PriceLabs dashboard");
    const priceLabs = decodeImportedMarketJson(priceLabsText());
    expect(priceLabs.kind).toBe("pricelabs");
    expect(priceLabs.data).toEqual(decodeMarketListingJson(priceLabsText()));
    const legacy = renderToStaticMarkup(createElement(ImportedMarketSummary, { imported: priceLabs }));
    expect(legacy).toContain("PriceLabs dashboard 187188 · AED");
    expect(legacy).toContain("Abu Dhabi, UAE");
    expect(legacy).toContain("timezone unknown");
    expect(legacy).not.toContain("Dubai metro sample");
  });

  test("workspace offers both honest source formats without upload or browser persistence", () => {
    const markup = renderToStaticMarkup(createElement(StreetMapWorkspace));
    expect(markup).toContain("Local market data");
    expect(markup).toContain("listings.normalized.json");
    expect(markup).toContain("osm_accommodations_normalized.json");
    expect(markup).toContain("One source at a time");
    expect(markup).toContain("not uploaded or saved by Yellow");
    expect(markup).toContain("tile requests can reveal the area you view");
    const source = readFileSync("frontend/yellow/src/workspaces/StreetMapWorkspace.tsx", "utf8");
    expect(source).toContain("Accommodation type");
    expect(source).toContain("Search name or OSM ID");
    expect(source).toContain("session.dispose()");
    expect(source).not.toMatch(/localStorage|sessionStorage|indexedDB|fetch\(|XMLHttpRequest|sendBeacon/u);
  });

  test("OSM points use same cluster lifecycle and composite-ID selection without provider row uploads", () => {
    const data = sample();
    const listeners = new Map<string, (event: unknown) => void>();
    const sources = new Map<string, unknown>();
    const layers = new Set<string>();
    let latest: unknown = null;
    const selections: string[] = [];
    const map = { addSource: (id: string) => sources.set(id, { setData: async (value: unknown) => { latest = value; } }),
      getSource: (id: string) => sources.get(id), removeSource: (id: string) => sources.delete(id),
      addLayer: (value: { id: string }) => layers.add(value.id), getLayer: (id: string) => layers.has(id), removeLayer: (id: string) => layers.delete(id),
      on: (event: string, layer: string, handler: (value: unknown) => void) => listeners.set(`${event}:${layer}`, handler),
      off: (event: string, layer: string) => listeners.delete(`${event}:${layer}`),
      queryRenderedFeatures: () => [{ properties: { listingId: data.rows[0]!.listingId } }],
      fitBounds: () => {},
    } as unknown as MapLibreMap;
    const mounted = attachMarketListingLayers(map, id => selections.push(id));
    mounted.update(data.rows, true);
    expect((latest as { features: unknown[] }).features).toHaveLength(21);
    expect(JSON.stringify(latest)).not.toContain("tourismKind");
    expect(JSON.stringify(latest)).not.toContain("prices");
    listeners.get(`click:${MARKET_POINT_LAYER}`)?.({ point: { x: 1, y: 1 } });
    expect(selections).toEqual(["osm/way/1"]);
    mounted.dispose();
    expect(sources.size).toBe(0);
    expect(layers.size).toBe(0);
    expect(listeners.size).toBe(0);
  });
});
