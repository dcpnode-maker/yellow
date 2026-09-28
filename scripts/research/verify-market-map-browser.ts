/** Static preflight, or --serve for a loopback-only, synthetic browser fixture.
 * This fixture exercises the actual map client/assets/API. Its permission lookup
 * and three hotel records are synthetic; database isolation has a separate CI proof.
 */
import { MarketMapHttpApi } from "../../src/http/market-map";
import { marketMapAssets } from "../../src/http/market-map-assets";
import { operatorAssets } from "../../src/http/operator";
import { SECURITY_HEADERS } from "../../src/http/security-headers";
import type { PlaceRecord } from "../../src/contexts/distribution";
import type { TenantRequestContext, Tx } from "../../src/kernel";
const files = [
  new URL("../../src/http/operator/operator-market-map.js", import.meta.url),
  new URL("../../src/http/operator/operator-market-map.css", import.meta.url),
  new URL("../../src/http/operator/index.html", import.meta.url),
];
const contents = await Promise.all(files.map((file) => Bun.file(file).text()));
const joined = contents.join("\n");
for (const forbidden of ["tile.openstreetmap", "api.mapbox", "googleapis.com", "unpkg.com", "cdn.jsdelivr"]) {
  if (joined.includes(forbidden)) throw new Error(`market-map client embeds forbidden third-party endpoint: ${forbidden}`);
}
for (const required of ["yellow:operator-request", "market-map-place-list", "Search visible area", "maplibre-gl-6.9.0"]) {
  if (!joined.includes(required)) throw new Error(`market-map client is missing required integration marker: ${required}`);
}
if (import.meta.main) console.log("Market map browser preflight passed: same-origin assets and accessible fallback are present.");

export function startMarketMapBrowserFixture(options: { port?: number; failMap?: boolean } = {}) {
  const propertyA = "00000000-0000-0000-0000-000000009903";
  const propertyB = "00000000-0000-0000-0000-000000009904";
  const tenantId = "00000000-0000-0000-0000-000000009901";
  const records: PlaceRecord[] = [
    ["one", "Synthetic Marina Hotel", 55.139, 25.079],
    ["two", "Synthetic Harbour Hotel", 55.142, 25.082],
    ["three", "Synthetic Garden Hotel", 55.147, 25.071],
  ].map(([id, name, longitude, latitude]) => ({ id: String(id), name: String(name), longitude: Number(longitude), latitude: Number(latitude),
    category: "hotel", status: "unknown", address: null, country: "AE", websites: ["https://example.com/"], brand: null,
    confidence: null, sources: [{ dataset: "SYNTHETIC BROWSER FIXTURE — not Overture observations", license: "CC0-1.0" }] }));
  const api = new MarketMapHttpApi({ search(input) {
    const places = records.filter((place) => input.mode === "keyword" ? place.name.toLowerCase().includes(input.q.toLowerCase())
      : input.mode === "id" ? place.id === input.id : input.mode === "bbox" ? place.longitude >= input.west && place.longitude <= input.east && place.latitude >= input.south && place.latitude <= input.north : true);
    return { places, truncated: false, ambiguous: false, release: "2026-08-19.0", schemaVersion: "1.18.0" };
  }, byIds(ids) { return ids.flatMap((id) => records.filter((place) => place.id === id)); } });
  const page = contents[2]!;
  const section = page.slice(page.indexOf('<section id="market-map-view"'), page.indexOf('<div class="win-status-bar"'));
  const headers = { ...SECURITY_HEADERS, "cache-control": "no-store" };
  const response = (body: string, type: string) => new Response(body, { headers: { ...headers, "content-type": type } });
  const receipt: { path: string; status: number }[] = [];
  const script = `
    const property = document.querySelector('#property-select');
    document.querySelector('#open-map').onclick = () => document.querySelector('#market-map-view').hidden = false;
    document.querySelector('#proof-sign-out').onclick = () => { property.value = ''; window.dispatchEvent(new Event('yellow:operator-signed-out')); };
    window.addEventListener('yellow:operator-request', async ({detail}) => {
      try {
        const result = await fetch(detail.path, {...detail.options, headers: {'content-type':'application/json'}});
        const body = await result.json();
        if (!result.ok) throw new Error(body.detail || body.title || 'Proof request failed');
        detail.resolve(body);
        document.querySelector('#proof-requests').textContent = String(Number(document.querySelector('#proof-requests').textContent) + 1);
      } catch(error) { detail.reject(error); }
    });
    if (new URLSearchParams(location.search).has('deep')) document.querySelector('#market-map-view').hidden = false;
  `;
  const server = Bun.serve({ hostname: "127.0.0.1", port: options.port ?? 0,
    async fetch(request) {
      const url = new URL(request.url); let result: Response;
      if (url.pathname === "/") result = response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Yellow Market Map — synthetic browser proof</title><link rel="stylesheet" href="/assets/operator.css"><link rel="stylesheet" href="/assets/operator-market-map.css"><script src="/proof.js" defer></script><script src="/assets/operator-market-map.js" defer></script></head><body><main><h1>Yellow market map — synthetic browser proof</h1><p>Three fabricated hotel records. This harness does not validate PostgreSQL, sign-in or production routing.</p><label for="property-select">Proof property</label><select id="property-select"><option value="${propertyA}">Property A</option><option value="${propertyB}">Property B</option><option value="">Signed out</option></select><button id="open-map">Open market map</button><button id="proof-sign-out">Simulate sign out</button><p>Successful catalog requests: <output id="proof-requests">0</output></p>${section}</main></body></html>`, "text/html; charset=utf-8");
      else if (url.pathname === "/proof.js") result = response(script, "text/javascript; charset=utf-8");
      else if (url.pathname === "/proof/receipt") result = Response.json(receipt);
      else if (url.pathname === "/favicon.ico") result = new Response(null, { status: 204 });
      else if (url.pathname === "/assets/operator.css") result = operatorAssets.css();
      else if (url.pathname === "/static/fonts/urbanist-v1.330.woff2") result = operatorAssets.urbanistFont();
      else if (url.pathname.startsWith("/assets/")) {
        const name = url.pathname.slice(8);
        result = options.failMap && name.endsWith("maplibre-gl.mjs") ? new Response("Synthetic missing map engine", { status: 503 }) : marketMapAssets.asset(name) ?? new Response("Not found", { status: 404 });
      } else {
        const match = /^\/api\/v1\/properties\/([^/]+)\/market-map\/(places|selection)$/.exec(url.pathname);
        if (!match || ![propertyA, propertyB].includes(match[1]!)) result = new Response("Not found", { status: 404 });
        else {
          const context: TenantRequestContext = { request, tenantId,
            identity: { tenantId, actorId: "00000000-0000-0000-0000-000000009902", scopes: ["rates.configuration:read"] },
            tx: (async () => [{ id: match[1] }]) as unknown as Tx };
          result = match[2] === "places" ? await api.places(context, match[1]!) : await api.selection(context, match[1]!, await request.json());
        }
      }
      for (const [key, value] of Object.entries(headers)) result.headers.set(key, value);
      if (url.pathname !== "/proof/receipt") { receipt.push({ path: url.pathname + url.search, status: result.status }); if (receipt.length > 100) receipt.shift(); }
      return result;
    },
  });
  return { server, requests: receipt, propertyA, propertyB };
}

if (import.meta.main && process.argv.includes("--serve")) {
  const failMap = process.argv.includes("--fail-map");
  const { server } = startMarketMapBrowserFixture({ port: failMap ? 4318 : 4317, failMap });
  console.log(`Synthetic browser proof listening at ${server.url}`);
}
