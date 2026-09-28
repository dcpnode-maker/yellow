/** Independent Q268 proof: real shell/frame/Leaflet, synthetic API and intercepted tiles only. */
import { expect, test } from "bun:test";
import { createApp } from "../src/app";
import type { MarketHttpApi } from "../src/http/market";
import type { OperatorHttpApi } from "../src/http/operator";
import { browser, browserControls, withBrowser } from "./helpers/market-browser";

const propertyA = "00000000-0000-4000-8000-000000000472";
const propertyB = "00000000-0000-4000-8000-000000000473";
const frame = 'document.querySelector("[data-testid=market-map-frame]")';
const doc = frame + "?.contentDocument";
const win = frame + "?.contentWindow";
const pointPaths = doc + '?.querySelectorAll("[data-point-id]")';
function discovery(count: number, polar: boolean) {
  return { discovery: { snapshots: [{ logicalId: "riyadh", sha256: "a".repeat(64),
    capturedAt: "2026-09-13T08:03:04.630Z",
    region: { minimumLatitude: 24, maximumLatitude: 90, minimumLongitude: 46, maximumLongitude: 47 },
    completeness: { scope: "publisher-range-extract-all-places", status: "complete", sourceRows: count, returnedRecords: count, rejectedRows: 0 },
    records: Array.from({ length: count }, (_, n) => ({
      provenance: { source: "Overture", release: "2026-08-19.0", schema: "places/place", recordId: "source-" + n, attribution: "Synthetic source attribution" },
      name: n === 0 ? 'Hotel <img src=x onerror="globalThis.injected=true">' : "Hotel source " + n,
      coordinates: { latitude: polar && n === count - 1 ? 89 : 24.7071 + n * .00004, longitude: 46.6761 + n * .00004 },
      address: "Synthetic street " + n, operatingStatus: "unknown", websites: ["https://example.test/hotel-" + n], categories: ["hotel"],
    })),
  }] } };
}

(browser ? test : test.skip)("Q268 real Leaflet stays opt-in, bounded, inspect-only, isolated and disposable", async () => {
  const shell = createApp({ operatorApi: {} as OperatorHttpApi, marketApi: {} as MarketHttpApi });
  let count = 3, polar = false, revoked = false, confirmationCalls = 0;
  const assets: string[] = [], responseHeaders = new Map<string, Headers>();
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, async fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === "/api/v1/auth/local:login") return Response.json({ accessToken: "synthetic-q268-token", user: { id: propertyA, displayName: "Synthetic operator" } });
    if (path.startsWith("/api/v1/")) {
      if (request.headers.get("authorization") !== "Bearer synthetic-q268-token") return Response.json({ detail: "Unauthorized fixture" }, { status: 401 });
      if (path === "/api/v1/me/properties") return Response.json({ properties: [
        { id: propertyA, name: "Synthetic A", timezone: "Asia/Riyadh" }, { id: propertyB, name: "Synthetic B", timezone: "Asia/Dubai" },
      ] });
      if (path === "/api/v1/me/market-properties") return Response.json({ marketProperties: { properties: [
        { id: propertyA, name: "Synthetic A", timezone: "Asia/Riyadh", currency: "SAR" },
        { id: propertyB, name: "Synthetic B", timezone: "Asia/Dubai", currency: "AED" },
      ], nextCursor: null } });
      if (path.endsWith("/market/discovery")) return revoked ? Response.json({ detail: "Revoked fixture" }, { status: 403 }) : Response.json(discovery(count, polar));
      if (path.endsWith("/market/compset")) return Response.json({ compset: null });
      if (path.endsWith("/market/compset/confirm")) { confirmationCalls++; return Response.json({ detail: "Unknown fixture" }, { status: 503 }); }
      return Response.json({ detail: "Unexpected fixture API" }, { status: 404 });
    }
    if (path.startsWith("/assets/market-map/")) assets.push(path);
    const response = await shell.handle(request);
    responseHeaders.set(path, response.headers);
    return response;
  } });
  try {
    await withBrowser(async (send, errors, onEvent) => {
      const { value, until, click, fill } = browserControls(send);
      const origin = "http://127.0.0.1:" + server.port;
      const tiles: Array<{ url: string; headers: Record<string, string> }> = [], unexpected: string[] = [], interceptionErrors: string[] = [];
      const pending = new Set<Promise<unknown>>();
      let failTiles = false;
      // Install interception before the first navigation. Never permit an external test request.
      const unsubscribe = onEvent(event => {
        if (event.method !== "Fetch.requestPaused") return;
        const p = event.params as { requestId: string; request: { url: string; headers: Record<string, string> } };
        const url = new URL(p.request.url);
        let task: Promise<unknown>;
        if (url.origin === origin) task = send("Fetch.continueRequest", { requestId: p.requestId });
        else if (url.origin === "https://tile.openstreetmap.org") {
          tiles.push({ url: url.href, headers: p.request.headers });
          task = failTiles ? send("Fetch.failRequest", { requestId: p.requestId, errorReason: "InternetDisconnected" })
            : send("Fetch.fulfillRequest", { requestId: p.requestId, responseCode: 200,
              responseHeaders: [{ name: "Content-Type", value: "image/png" }, { name: "Cache-Control", value: "public, max-age=3600" }],
              body: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a/YQAAAAASUVORK5CYII=" });
        } else {
          unexpected.push(url.href);
          task = send("Fetch.failRequest", { requestId: p.requestId, errorReason: "BlockedByClient" });
        }
        const owned = task.catch(error => { interceptionErrors.push(String(error)); });
        pending.add(owned); void owned.finally(() => pending.delete(owned));
      });
      try {
        await send("Fetch.enable", { patterns: [{ urlPattern: "*" }] });
        await send("Page.addScriptToEvaluateOnNewDocument", { source:
          'globalThis.__mapMessages=[]; addEventListener("message", e=>{if(e.data?.type?.startsWith("yellow-market-map-")) globalThis.__mapMessages.push(e.data);});' });
        await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
        await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
        await send("Page.navigate", { url: origin + "/p/" + propertyA + "/market" });
        await until('document.querySelector("#login-form button[type=submit]")?.disabled === false', "login loaded");
        await value('{const f=document.querySelector("#login-form");f.elements.tenant.value="synthetic";f.elements.email.value="operator@example.test";f.elements.password.value="synthetic";f.requestSubmit();}');
        const ready = () => until('document.querySelector(".market-workspace")?.dataset.marketState === "ready"', "market ready");
        const mapReady = (points: number) => until(pointPaths + "?.length === " + points, "real Leaflet markers");
        await ready();
        expect(assets).toHaveLength(0); expect(tiles).toHaveLength(0);
        expect(await value<boolean>(frame + " === null")).toBe(true);
        expect(await value<string>('document.querySelector("[data-testid=market-map-disclosure]").textContent')).toContain("IP address");
        await click("[data-testid=market-map-enable]"); await mapReady(3);
        await until(doc + '?.querySelector(".leaflet-tile-loaded") !== null', "intercepted image rendered");
        expect(new Set(assets)).toEqual(new Set(["frame.html", "frame.js", "frame.css", "leaflet.js", "leaflet.css"].map(x => "/assets/market-map/" + x)));
        expect(await value<string>(win + ".L.version")).toBe("1.9.4");
        expect(tiles.length).toBeGreaterThan(0);
        for (const tile of tiles) {
          expect(tile.url).toMatch(/^https:\/\/tile\.openstreetmap\.org\/\d+\/\d+\/\d+\.png$/u);
          expect(Object.keys(tile.headers).map(x => x.toLowerCase())).not.toContain("authorization");
          expect(tile.headers.Referer ?? tile.headers.referer).toBe(origin + "/");
        }
        expect(responseHeaders.get("/p/" + propertyA + "/market")?.get("content-security-policy")).not.toContain("openstreetmap");
        expect(responseHeaders.get("/assets/market-map/frame.html")?.get("content-security-policy")).toContain("img-src 'self' data: https://tile.openstreetmap.org");
        expect(responseHeaders.get("/assets/market-map/frame.html")?.get("x-frame-options")).toBe("SAMEORIGIN");
        expect(await value<boolean>(doc + '.querySelector("a[href*=copyright]") !== null')).toBe(true);
        expect(await value<boolean>(doc + '.querySelector("img[src=x]") === null && !globalThis.injected')).toBe(true);
        const data = await value<{ nonce: string; revision: number; points: Array<{ id: string; role: string }> }>(win + ".__mapMessages.findLast(m=>m.type==='yellow-market-map-data')");
        expect(data.points).toHaveLength(3);
        expect(JSON.stringify(data)).not.toContain(propertyA); expect(JSON.stringify(data)).not.toContain("source-0");
        expect(data.points.every(p => p.role === "candidate")).toBe(true);
        for (const mutation of [
          { origin: "https://wrong.example", source: "window", data: { ...data, revision: 2, points: [] } },
          { origin, source: win, data: { ...data, revision: 2, points: [] } },
          { origin, source: "window", data: { ...data, nonce: propertyB, revision: 2, points: [] } },
          { origin, source: "window", data: { ...data, points: [] } },
        ]) await value(win + '.dispatchEvent(new MessageEvent("message",{origin:' + JSON.stringify(mutation.origin)
          + ',source:' + mutation.source + ',data:' + JSON.stringify(mutation.data) + '}))');
        expect(await value<number>(pointPaths + '.length')).toBe(3);
        await value(doc + '.querySelector("[data-point-id]").dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true}))');
        await until('document.querySelector("[data-testid=market-record-inspector]").textContent.includes("source-0")', "keyboard marker inspection").catch(async error => {
          throw new Error("Map inspection diagnostic: " + JSON.stringify(await value(
            '({inspector:document.querySelector("[data-testid=market-record-inspector]").textContent,messages:globalThis.__mapMessages,labels:[...' + pointPaths + '].map(p=>p.getAttribute("aria-label"))})')), { cause: error });
        });
        expect(await value<boolean>('document.querySelector("#market-inspector-title") === document.activeElement')).toBe(true);
        expect(await value<boolean>('document.querySelector(".market-workspace__row input[name=market-own]").checked')).toBe(false);
        expect(confirmationCalls).toBe(0);
        expect(await value<string>('document.querySelector(".market-workspace__row").textContent')).not.toContain("Synthetic street 0");
        for (const attribute of ["address", "categories", "websites"]) await click("[data-testid=market-attribute-" + attribute + "]");
        expect(await value<string>('document.querySelector(".market-workspace__row").textContent')).toContain("Synthetic street 0");
        expect(await value<string>('document.querySelector(".market-workspace__row").textContent')).toContain("hotel");
        expect(await value<string>('document.querySelector(".market-workspace__row").textContent')).toContain("https://example.test/hotel-0");
        expect(await value<string>('document.querySelector("[data-testid=market-record-inspector] a").href')).toBe("https://example.test/hotel-0");
        const inspectorBefore = await value<string>('document.querySelector("[data-testid=market-record-inspector]").textContent');
        const forged = { type: "yellow-market-map-inspect", version: 1, nonce: data.nonce, revision: data.revision, id: data.points[1]!.id };
        for (const variant of [
          { origin: "https://wrong.example", source: win, data: forged },
          { origin, source: "window", data: forged },
          { origin, source: win, data: { ...forged, nonce: propertyB } },
          { origin, source: win, data: { ...forged, revision: 0 } },
          { origin, source: win, data: { ...forged, id: "unknown" } },
        ]) await value('window.dispatchEvent(new MessageEvent("message",{origin:' + JSON.stringify(variant.origin) + ",source:" + variant.source + ",data:" + JSON.stringify(variant.data) + "}))");
        expect(await value<string>('document.querySelector("[data-testid=market-record-inspector]").textContent')).toBe(inspectorBefore);
        // A real SVG click still inspects the next record, without selecting it.
        await value(pointPaths + '[1].dispatchEvent(new MouseEvent("click",{bubbles:true}))');
        await until('document.querySelector("[data-testid=market-record-inspector]").textContent.includes("source-1")', "click marker inspection");
        await value(doc + '.querySelector(".leaflet-control-zoom-in").click()');
        expect(await value<boolean>(doc + '.querySelector(".leaflet-container").classList.contains("leaflet-zoom-anim")')).toBe(false);
        await value(doc + '.querySelector(".leaflet-control-zoom-in").click()');
        const pan = async (times: number) => value('(()=>{const target=' + doc + '.querySelector(".leaflet-container");target.focus();for(let i=0;i<' + times
          + ';i++)target.dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowRight",keyCode:39,bubbles:true}));return ' + doc + '.querySelector("[data-point-id]").getBoundingClientRect().x;})()');
        const initialPan = await value<number>(doc + '.querySelector("[data-point-id]").getBoundingClientRect().x');
        const boundedPan = await pan(100);
        expect(boundedPan).not.toBe(initialPan);
        expect(await pan(100)).toBe(boundedPan);
        await value(doc + '.querySelector("[data-testid=market-map-fit]").click()');
        await click('.market-workspace__row input[name="market-own"]');
        await until(doc + '?.querySelectorAll(".market-point--own").length === 1', "selection updates role without map remount");
        expect(await value<number>(win + ".__mapMessages.findLast(m=>m.type==='yellow-market-map-data').revision")).toBeGreaterThan(data.revision);
        await fill("[data-testid=market-filter]", "does-not-exist"); await mapReady(0);
        expect(await value<string>(doc + '.querySelector("[data-testid=market-map-omitted]").textContent')).toContain("0 of 0");
        expect(await value<number>(doc + '.querySelectorAll(".leaflet-tile-pane img").length')).toBe(0);
        await fill("[data-testid=market-filter]", ""); await mapReady(3);
        await send("Emulation.setDeviceMetricsOverride", { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
        expect(await value<boolean>("document.documentElement.scrollWidth <= innerWidth + 1")).toBe(true);
        expect(await value<boolean>(doc + ".documentElement.scrollWidth <= " + win + ".innerWidth + 1")).toBe(true);
        // Frame ownership expires immediately at refresh, including its old inspect messages.
        await value("void (globalThis.__oldFrame=" + win + ")");
        await click("[data-testid=market-refresh]");
        expect(await value<boolean>(frame + " === null")).toBe(true); await ready();
        await value('window.dispatchEvent(new MessageEvent("message",{origin:location.origin,source:globalThis.__oldFrame,data:' + JSON.stringify(forged) + "}))");
        expect(await value<string>('document.querySelector("[data-testid=market-record-inspector]").textContent')).not.toContain("source-1");
        // Current source limit and projection omissions remain honest; no silent truncation.
        count = 500; polar = true; await click("[data-testid=market-refresh]"); await ready();
        await click("[data-testid=market-map-enable]"); await mapReady(499);
        expect(await value<string>(doc + '.querySelector("[data-testid=market-map-omitted]").textContent')).toContain("499 of 500");
        expect(await value<string>(doc + '.querySelector("[data-testid=market-map-omitted]").textContent')).toContain("1 omitted");
        expect(await value<string>('document.querySelector("[data-testid=market-coverage]").textContent')).toContain("500 accepted records");
        await click("[data-testid=market-map-disable]"); expect(await value<boolean>(frame + " === null")).toBe(true);
        failTiles = true;
        // Empty only this disposable browser's synthetic cache to exercise a new tile failure.
        await send("Network.clearBrowserCache");
        await click("[data-testid=market-map-enable]"); await mapReady(499);
        await until(doc + '?.querySelector("[data-testid=market-map-status]").textContent.includes("unavailable or offline")', "offline tiles fallback");
        expect(await value<number>('document.querySelectorAll(".market-workspace__row").length')).toBe(25);
        await click("[data-testid=market-record-inspect]");
        expect(await value<string>('document.querySelector("[data-testid=market-record-inspector]").textContent')).toContain("Synthetic street 0");
        await value(win + '.dispatchEvent(new Event("pagehide"))');
        expect(await value<number>(pointPaths + '.length')).toBe(0);
        expect(await value<string>(doc + '.querySelector("[data-testid=market-map-status]").textContent')).toContain("Map stopped");
        await fill("[data-testid=market-property-select]", propertyB); await ready();
        expect(await value<boolean>(frame + " === null")).toBe(true);
        await click("[data-testid=market-map-enable]"); await mapReady(499);
        revoked = true; await click("[data-testid=market-refresh]");
        await until('document.querySelectorAll(".market-workspace__row").length === 0', "permission loss clears map and data");
        expect(await value<boolean>(frame + " === null")).toBe(true);
        expect(confirmationCalls).toBe(0); expect(unexpected).toEqual([]); expect(errors).toEqual([]);
        revoked = false; await click("[data-testid=market-refresh]"); await ready();
        await click("[data-testid=market-map-enable]"); await mapReady(499);
        await click('.market-workspace__row input[name="market-own"]');
        await click('.market-workspace__row:nth-child(2) input[type="checkbox"]');
        await click(".market-workspace__explicit input"); await click("[data-testid=market-confirm]");
        await until('document.querySelector("[data-testid=market-status]").textContent.includes("unknown")', "unknown confirmation freezes map controls");
        expect(confirmationCalls).toBe(1);
        expect(await value<boolean>('document.querySelector("[data-testid=market-map-enable]").disabled && document.querySelector("[data-testid=market-map-disable]").disabled')).toBe(true);
        expect(await value<boolean>('[...document.querySelectorAll("[data-testid^=market-attribute-]")].every(n=>n.disabled)')).toBe(true);
        expect(await value<boolean>('document.querySelector("[data-testid=market-filter]").disabled')).toBe(true);
        await click("#sign-out");
        await until(frame + " === null", "sign-out destroys map");
        expect(await value<number>('document.querySelectorAll(".market-workspace__row").length')).toBe(0);
        expect(unexpected).toEqual([]); expect(errors).toEqual([]);
      } finally {
        await send("Page.navigate", { url: "about:blank" });
        await Promise.all([...pending]);
        await send("Fetch.disable"); unsubscribe();
      }
      expect(interceptionErrors).toEqual([]);
    });
  } finally { await server.stop(true); }
}, 30_000);
