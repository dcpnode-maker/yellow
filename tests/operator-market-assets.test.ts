import { expect, test } from "bun:test";

import { createApp } from "../src/app";
import { MARKET_MAP_FRAME_CONTENT_SECURITY_POLICY } from "../src/http/market-map";
import { type MarketHttpApi } from "../src/http/market";
import { type OperatorHttpApi, operatorAssets } from "../src/http/operator";
import { SECURITY_HEADERS } from "../src/http/security-headers";

const property = "00000000-0000-4000-8000-000000000472";
const marketSource = new URL("../src/http/operator/market.js", import.meta.url);
const marketMapSources = Object.freeze({
  "/assets/market-map/frame.html": new URL("../src/http/operator/market-map.html", import.meta.url),
  "/assets/market-map/frame.js": new URL("../src/http/operator/market-map.js", import.meta.url),
  "/assets/market-map/frame.css": new URL("../src/http/operator/market-map.css", import.meta.url),
  "/assets/market-map/leaflet.js": new URL("../src/http/operator/vendor/leaflet-1.9.4/leaflet.js", import.meta.url),
  "/assets/market-map/leaflet.css": new URL("../src/http/operator/vendor/leaflet-1.9.4/leaflet.css", import.meta.url),
});

function operatorShell() {
  return createApp({ operatorApi: {} as OperatorHttpApi });
}

function marketShell() {
  return createApp({ operatorApi: {} as OperatorHttpApi, marketApi: {} as MarketHttpApi });
}

function marketOnlyShell() {
  return createApp({ marketApi: {} as MarketHttpApi });
}

test("Q271 preserves immutable Leaflet publisher bytes through Git text filtering", async () => {
  const attributes = await Bun.file(new URL("../.gitattributes", import.meta.url)).text();
  const pins = [
    ["leaflet.css", 14806, "a7837102824184820dfa198d1ebcd109ff6d0ff9a2672a074b9a1b4d147d04c6"],
    ["LICENSE", 1395, "53e8dc25862014e4324741ca18fbe3611e11d42ef69f59f86ea8c5389647d4cb"],
  ] as const;
  for (const [name, size, hash] of pins) {
    const path = `src/http/operator/vendor/leaflet-1.9.4/${name}`;
    const bytes = new Uint8Array(await Bun.file(new URL(`../${path}`, import.meta.url)).arrayBuffer());
    expect(bytes.byteLength).toBe(size);
    expect(new Bun.CryptoHasher("sha256").update(bytes).digest("hex")).toBe(hash);
    expect(attributes.split(/\r?\n/)).toContain(`${path} -text`);
  }
});

function expectSecurityHeaders(response: Response): void {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    expect(response.headers.get(name)).toBe(value);
  }
}

function expectFrameHeaders(response: Response): void {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    if (name === "content-security-policy" || name === "x-frame-options") continue;
    expect(response.headers.get(name)).toBe(value);
  }
  expect(response.headers.get("content-security-policy")).toBe(MARKET_MAP_FRAME_CONTENT_SECURITY_POLICY);
  expect(response.headers.get("x-frame-options")).toBe("SAMEORIGIN");
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  expect(response.headers.get("cache-control")).toBe("no-cache");
}

test("Q266 serves the operator shell at the property market deep link without API authority", async () => {
  const app = operatorShell();
  const [response, expected] = await Promise.all([
    app.handle(new Request(`http://yellow.test/p/${property}/market`)),
    operatorAssets.html().text(),
  ]);

  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
  expect(response.headers.get("cache-control")).toBe("no-cache");
  expectSecurityHeaders(response);
  expect(await response.text()).toBe(expected);
});

test("Q266 serves only the named lazy market module with the static shell policy and exact source bytes", async () => {
  const app = operatorShell();
  const [response, expected] = await Promise.all([
    app.handle(new Request("http://yellow.test/assets/operator-market.js")),
    Bun.file(marketSource).text(),
  ]);

  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe("text/javascript; charset=utf-8");
  expect(response.headers.get("cache-control")).toBe("no-cache");
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  expect(response.headers.get("content-security-policy")).toBe(SECURITY_HEADERS["content-security-policy"]);
  expectSecurityHeaders(response);
  expect(await response.text()).toBe(expected);
});

test("Q268 serves each fixed map asset only when both operator and market composition are enabled", async () => {
  const app = marketShell();
  const expectedTypes: Record<keyof typeof marketMapSources, string> = {
    "/assets/market-map/frame.html": "text/html; charset=utf-8",
    "/assets/market-map/frame.js": "text/javascript; charset=utf-8",
    "/assets/market-map/frame.css": "text/css; charset=utf-8",
    "/assets/market-map/leaflet.js": "text/javascript; charset=utf-8",
    "/assets/market-map/leaflet.css": "text/css; charset=utf-8",
  };

  for (const [path, source] of Object.entries(marketMapSources) as Array<[keyof typeof marketMapSources, URL]>) {
    const [response, expected] = await Promise.all([
      app.handle(new Request(`http://yellow.test${path}`)),
      Bun.file(source).arrayBuffer(),
    ]);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(expectedTypes[path]);
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("cache-control")).toBe("no-cache");
    if (path === "/assets/market-map/frame.html") expectFrameHeaders(response);
    else expectSecurityHeaders(response);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array(expected));
  }
});

test("Q268 keeps global headers for disabled, query, wrong-method and error map paths", async () => {
  const operatorOnly = operatorShell();
  const marketOnly = marketOnlyShell();
  const enabled = marketShell();
  const requests = [
    operatorOnly.handle(new Request("http://yellow.test/assets/market-map/frame.html")),
    marketOnly.handle(new Request("http://yellow.test/assets/market-map/frame.html")),
    enabled.handle(new Request("http://yellow.test/assets/market-map/frame.html?unexpected=1")),
    enabled.handle(new Request("http://yellow.test/assets/market-map/frame.js?unexpected=1")),
    enabled.handle(new Request("http://yellow.test/assets/market-map/leaflet.css", { method: "POST" })),
    enabled.handle(new Request("http://yellow.test/assets/market-map/not-registered.js")),
  ];

  for (const response of await Promise.all(requests)) {
    expect(response.status).toBe(404);
    expectSecurityHeaders(response);
    expect(response.headers.get("content-security-policy")).toBe(SECURITY_HEADERS["content-security-policy"]);
    expect(response.headers.get("x-frame-options")).toBe("DENY");
  }
});
