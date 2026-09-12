import { describe, expect, test } from "bun:test";

const root = new URL("..", import.meta.url);
async function source(path: string) { return Bun.file(new URL(path, root)).text(); }

describe("RMS-PLACES-001 operator market map", () => {
  test("adds a real workspace route and research-only controls", async () => {
    const [html, operator] = await Promise.all([source("src/http/operator/index.html"), source("src/http/operator/operator.js")]);
    expect(html).toContain('data-view="market-map"');
    expect(html).toContain('id="market-map-view"');
    expect(html).toContain("Select your property and comparable candidates for mapping review.");
    expect(html).toContain('id="market-map-place-list"');
    expect(html).toContain('id="market-map-export"');
    expect(operator).toContain('"market-map"');
    expect(operator).toContain('marketMapView.hidden = activeView !== "market-map"');
    expect(operator).toContain('location.pathname.endsWith("/market-map") ? "market-map"');
  });

  test("uses the authenticated request closure and cancels stale property work", async () => {
    const [operator, market] = await Promise.all([source("src/http/operator/operator.js"), source("src/http/operator/operator-market-map.js")]);
    expect(operator).toContain('window.addEventListener("yellow:operator-request"');
    expect(market).toContain('new CustomEvent("yellow:operator-request"');
    expect(market).toContain('/market-map/places?${search}');
    expect(market).toContain('requestGeneration += 1');
    expect(market).toContain('contextGeneration += 1');
    expect(market).toContain('property !== currentProperty()');
    expect(market).toContain('yellow:operator-signed-out');
    expect(market).toContain('Market-map selections were cleared');
  });

  test("keeps searches bounded and exports an explicit research selection", async () => {
    const market = await source("src/http/operator/operator-market-map.js");
    expect(market).toContain('east - west > 5 || north - south > 5');
    expect(market).toContain('search.set("limit", "200")');
    expect(market).toContain('competitorIds.size < 50');
    expect(market).toContain('subjectId: selectedSubjectId, competitorIds: selectedCompetitorIds');
    expect(market).toContain('requires provider mapping review');
    expect(market).toContain('Inspect public attributes');
    expect(market).toContain('Sources:');
    expect(await source("src/http/operator/index.html")).toContain("mapping review");
    expect(market).toContain('import("/assets/vendor/maplibre-gl-6.9.0/maplibre-gl.mjs")');
    expect(market).toContain('selectionById');
    expect(market).toContain('context !== contextGeneration || property !== currentProperty()');
    expect(market).toContain('queueMicrotask(() => { if (active())');
    expect(market).toContain('value.match(/^gers');
    expect(market).toContain('haversineKm(radiusFilter.latitude');
    expect(market).toContain('fitToPlaces(places)');
  });

  test("allowlists only known same-origin market assets", async () => {
    const assets = await source("src/http/market-map-assets.ts");
    expect(assets).toContain('maplibre-gl-6.9.0/maplibre-gl.mjs');
    expect(assets).toContain('ne_110m_land.geojson');
    expect(assets).toContain('isMarketMapAssetName');
    expect(assets).not.toContain('request.url');
    const { marketMapAssets } = await import("../src/http/market-map-assets");
    expect(marketMapAssets.asset("../operator.js")).toBeUndefined();
    const runtime = marketMapAssets.asset("vendor/maplibre-gl-6.9.0/maplibre-gl.mjs");
    expect(runtime?.headers.get("content-type")).toContain("text/javascript");
    expect((await runtime?.text())?.startsWith("/**")).toBe(true);
  });

  test("actual application serves the map route and fixed assets without file traversal", async () => {
    const { createApp } = await import("../src/app");
    const { OperatorHttpApi } = await import("../src/http/operator");
    // Static routes do not invoke login methods; identity/database proof is separate.
    const app = createApp({ operatorApi: Object.create(OperatorHttpApi.prototype) as InstanceType<typeof OperatorHttpApi> });
    const page = await app.handle(new Request("http://yellow.test/p/00000000-0000-0000-0000-000000009903/market-map"));
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('id="market-map-view"');
    for (const name of ["operator-market-map.js", "operator-market-map.css", "vendor/maplibre-gl-6.9.0/maplibre-gl.mjs", "vendor/maplibre-gl-6.9.0/maplibre-gl-shared.mjs", "vendor/maplibre-gl-6.9.0/maplibre-gl-worker.mjs", "vendor/ne_110m_land.geojson"]) {
      const response = await app.handle(new Request(`http://yellow.test/assets/${name}`));
      expect(response.status).toBe(200);
      expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(100);
    }
    for (const name of ["vendor/../../package.json", "vendor/unlisted.js", "vendor/%2e%2e%2fpackage.json"]) {
      expect((await app.handle(new Request(`http://yellow.test/assets/${name}`))).status).toBe(404);
    }
  });
});
