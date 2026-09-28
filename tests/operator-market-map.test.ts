import { expect, test } from "bun:test";
// @ts-expect-error Browser module is intentionally import-safe without a DOM and has no Node declaration surface.
import { MARKET_MAP_LIMITS, createMarketMapChannel, mountMarketMapFrame, partitionMarketMapPoints, tryParseMarketMapData } from "../src/http/operator/market-map.js";

const nonce = "00000000-0000-4000-8000-000000000268";
const point = (id = "record-1") => ({ id, name: "فندق · Hotel", latitude: 24.708, longitude: 46.677, role: "candidate" });
const data = (revision = 1, points = [point()]) => ({ type: "yellow-market-map-data", version: 1, nonce, revision, points });
const origin = "https://yellow.test";

test("Q268 import is DOM-free and accepted evidence is a bounded immutable copy", () => {
 const input = data(), parsed = tryParseMarketMapData(input);
 expect(parsed).toEqual(input);
 expect(Object.isFrozen(parsed)).toBeTrue();
 expect(Object.isFrozen(parsed.points)).toBeTrue();
 expect(Object.isFrozen(parsed.points[0])).toBeTrue();
 input.points[0]!.name = "Changed";
 input.points.push(point("new"));
 expect(parsed.points).toHaveLength(1);
 expect(parsed.points[0].name).toBe("فندق · Hotel");
 expect(tryParseMarketMapData(data(1, []))?.points).toHaveLength(0);
 const full = Array.from({ length: 500 }, (_, index) => point(`record-${index}`));
 expect(tryParseMarketMapData(data(1, full))?.points).toHaveLength(500);
 expect(tryParseMarketMapData(data(1, [...full, point("extra")]))).toBeNull();
 expect(MARKET_MAP_LIMITS.points).toBe(500);
});

test("Q268 protocol rejects malformed envelopes without retaining unapproved fields", () => {
 for (const input of [null, [], {}, { ...data(), version: 2 }, { ...data(), type: "other" },
  { ...data(), nonce: nonce.toUpperCase().replace("268", "ABC") }, { ...data(), nonce: "nonce" },
  { ...data(), tenantId: nonce }, { ...data(), points: {} }, { ...data(), points: undefined },
  ...[0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, "1"].map(revision => ({ ...data(), revision })),
 ]) expect(tryParseMarketMapData(input)).toBeNull();
 const hostile = Object.defineProperty({}, "type", { enumerable: true, get() { throw new Error("do not leak"); } });
 expect(tryParseMarketMapData(hostile)).toBeNull();
});

test("Q268 validates every point and duplicate identity before accepting the dataset", () => {
 for (const invalid of [null, [], { ...point(), extra: true }, { ...point(), role: "confirmed" },
  ...["", " ", "a".repeat(81), "bad\n", "bad\u007f", "\ud800"].map(id => ({ ...point(), id })),
  ...["", " ", "a".repeat(501), "bad\t", "\udfff"].map(name => ({ ...point(), name })),
  ...[-90.01, 90.01, NaN, Infinity, "25"].map(latitude => ({ ...point(), latitude })),
  ...[-180.01, 180.01, NaN, Infinity, "45"].map(longitude => ({ ...point(), longitude })),
 ]) expect(tryParseMarketMapData({ ...data(), points: [point(), invalid] })).toBeNull();
 expect(tryParseMarketMapData(data(1, [point(), point()]))).toBeNull();
 for (const role of ["candidate", "own", "comparator"]) expect(tryParseMarketMapData(data(1, [{ ...point(), role }]))).not.toBeNull();
 expect(tryParseMarketMapData(data(1, [{ ...point(), name: "😀".repeat(500), latitude: -90, longitude: -180 }]))).not.toBeNull();
 expect(tryParseMarketMapData(data(1, [{ ...point(), latitude: 90, longitude: 180 }]))).not.toBeNull();
});

test("Q268 accepts only the actual parent and exact origin; first accepted nonce is fixed", () => {
 const parent = {}, channel = createMarketMapChannel(origin, parent);
 const event = (value: unknown = data(), source: object = parent, eventOrigin = origin) => ({ data: value, source, origin: eventOrigin });
 expect(channel.accept(event(data(), {}, origin))).toBeNull();
 expect(channel.accept(event(data(), parent, "null"))).toBeNull();
 expect(channel.accept(event(data(), parent, `${origin}.evil`))).toBeNull();
 expect(channel.accept(event({ ...data(), points: [point(), point()] }))).toBeNull();
 expect(channel.inspect("record-1", 1)).toBeNull();
 expect(channel.accept(event())?.revision).toBe(1);
 expect(channel.accept(event(data()))).toBeNull();
 expect(channel.accept(event(data(0)))).toBeNull();
 expect(channel.accept(event({ ...data(2), nonce: "00000000-0000-4000-8000-000000000269" }))).toBeNull();
 expect(channel.accept(event({ ...data(20), points: [point(), point()] }))).toBeNull();
 expect(channel.accept(event(data(2, [point("latest")])))?.revision).toBe(2);
 expect(channel.inspect("record-1", 1)).toBeNull();
 expect(channel.inspect("latest", 1)).toBeNull();
 expect(channel.inspect("latest", 2)).toEqual({ type: "yellow-market-map-inspect", version: 1, nonce, revision: 2, id: "latest" });
 expect(channel.inspect("unknown", 2)).toBeNull();
 channel.close(); channel.close();
 expect(channel.inspect("latest", 2)).toBeNull();
 expect(channel.accept(event(data(3)))).toBeNull();
});

test("Q268 projection omission is explicit and never removes records from the validated dataset", () => {
 const edge = MARKET_MAP_LIMITS.mercatorLatitude;
 const parsed = tryParseMarketMapData(data(1, [point(), { ...point("north-edge"), latitude: edge },
  { ...point("south-edge"), latitude: -edge }, { ...point("north"), latitude: edge + .00000001 },
  { ...point("south"), latitude: -90 }]));
 const result = partitionMarketMapPoints(parsed.points);
 expect(result.visible.map((item: { id: string }) => item.id)).toEqual(["record-1", "north-edge", "south-edge"]);
 expect(result.omitted).toBe(2);
 expect(parsed.points).toHaveLength(5);
 expect(Object.isFrozen(result.visible)).toBeTrue();
 const parent = {}, channel = createMarketMapChannel(origin, parent);
 channel.accept({ origin, source: parent, data: parsed });
 expect(channel.inspect("north", 1)).toBeNull();
 expect(channel.inspect("south", 1)).toBeNull();
 expect(channel.inspect("north-edge", 1)?.id).toBe("north-edge");
});

// This fixture executes our lifecycle only. Real Leaflet/CSP rendering is independently browser-proved.
function frameFixture() {
 type Listener = (event?: unknown) => void;
 class Hub {
  readonly listeners = new Map<string, Set<Listener>>();
  addEventListener(type: string, callback: Listener) { const entries = this.listeners.get(type) ?? new Set(); entries.add(callback); this.listeners.set(type, entries); }
  removeEventListener(type: string, callback: Listener) { this.listeners.get(type)?.delete(callback); }
  emit(type: string, event?: unknown) { for (const callback of this.listeners.get(type) ?? []) callback(event); }
 }
 class Node extends Hub {
  textContent = "";
  disabled = true;
  readonly dataset: Record<string, string> = {};
  readonly attributes = new Map<string, string>();
  setAttribute(name: string, value: string) { this.attributes.set(name, value); }
  removeAttribute(name: string) { this.attributes.delete(name); }
  replaceChildren() {}
 }
 const elements = new Map(["map-status", "map-omitted", "source-map", "fit-records"].map(id => [id, new Node()]));
 const doc = Object.assign(new Hub(), { hidden: false, getElementById: (id: string) => elements.get(id) });
 const messages: Array<{ value: Record<string, unknown>; origin: string }> = [];
 const parent = { postMessage(value: Record<string, unknown>, target: string) { messages.push({ value, origin: target }); } };
 const view = Object.assign(new Hub(), { parent, location: { origin } });
 const layers = new Set<object>();
 type Position = { x: number; y: number };
 const calls = { maps: 0, tileCreates: 0, tileAdds: 0, fits: 0, removals: 0, tileRemovals: 0, redraws: 0, viewReady: false,
  keyboard: null as boolean | null, pans: [] as Array<{ center: Position; animate: boolean }>, zooms: [] as Array<{ zoom: number; animate: boolean }> };
 let center: Position = { x: 0, y: 0 }, zoom = 17;
 const markers: Array<{ node: Node; click: () => void }> = [];
 let tileError: Listener | undefined;
 const map = {
  setMinZoom() {}, setMaxBounds() {}, getBoundsZoom: () => 18,
  fitBounds() { calls.fits += 1; calls.viewReady = true; },
  getCenter: () => center, getZoom: () => zoom,
  project(value: Position) { return { add(offset: readonly number[]) { return { x: value.x + offset[0]!, y: value.y + offset[1]! }; } }; },
  unproject: (value: Position) => value,
  panTo(value: Position, options: { animate: boolean }) { center = value; calls.pans.push({ center: value, animate: options.animate }); },
  setView(value: Position, level: number, options: { animate: boolean }) { center = value; zoom = level; calls.zooms.push({ zoom: level, animate: options.animate }); },
  hasLayer: (value: object) => layers.has(value),
  removeLayer(value: object) { layers.delete(value); calls.tileRemovals += 1; },
  remove() { calls.removals += 1; layers.clear(); },
 };
 const leaflet = {
  version: "1.9.4", map(_canvas: unknown, options: { keyboard: boolean }) { calls.maps += 1; calls.keyboard = options.keyboard; return map; },
  latLngBounds: (bounds: unknown) => bounds,
  control: { attribution: () => ({ addTo() {} }) },
  layerGroup() { const group = { addTo() { layers.add(group); return group; }, clearLayers() {} }; return group; },
  circleMarker() {
   const entry = { node: new Node(), click() {} }; markers.push(entry);
   const marker = { addTo() { return marker; }, on(_type: string, callback: () => void) { entry.click = callback; },
    getElement: () => calls.viewReady ? entry.node : undefined };
   return marker;
  },
  tileLayer(_url: string, options: Record<string, unknown>) {
   calls.tileCreates += 1;
   const tiles = { options, on(_type: string, callback: Listener) { tileError = callback; },
    addTo() { calls.tileAdds += 1; layers.add(tiles); }, redraw() { calls.redraws += 1; } };
   return tiles;
  },
 };
 const mounted = mountMarketMapFrame(view, doc, leaflet);
 const send = (value: unknown) => view.emit("message", { source: parent, origin, data: value });
 return { calls, markers, messages, elements, doc, view, parent, mounted, send, failTile: () => tileError?.() };
}

test("Q268 lifecycle waits for accepted visible data; later datasets never automatically fit or inspect", () => {
 const frame = frameFixture();
 expect(frame.messages).toEqual([{ value: { type: "yellow-market-map-ready", version: 1 }, origin }]);
 expect(frame.calls.maps).toBe(0);
 expect(frame.calls.tileCreates).toBe(0);
 frame.send(data(1, [{ ...point(), latitude: 90 }]));
 expect(frame.calls.tileCreates).toBe(0);
 expect(frame.elements.get("map-omitted")?.textContent).toContain("1 omitted");
 frame.send(data(2));
 expect(frame.calls.maps).toBe(1);
 expect(frame.calls.tileAdds).toBe(1);
 expect(frame.calls.fits).toBe(1);
 expect(frame.markers[0]?.node.attributes.get("role")).toBe("button");
 expect(frame.markers[0]?.node.attributes.get("aria-label")).toContain("فندق · Hotel");
 expect(frame.messages).toHaveLength(1);
 frame.markers[0]?.click();
 expect(frame.messages.at(-1)?.value).toEqual({ type: "yellow-market-map-inspect", version: 1, nonce, revision: 2, id: "record-1" });
 frame.send(data(3, [{ ...point(), role: "comparator" }]));
 expect(frame.calls.fits).toBe(1);
 const previousMessages = frame.messages.length;
 frame.markers[0]?.click(); // Old same-ID marker must not be relabelled as the new revision.
 expect(frame.messages).toHaveLength(previousMessages);
 let prevented = false;
 frame.markers.at(-1)?.node.emit("keydown", { key: "Enter", preventDefault() { prevented = true; }, stopPropagation() {} });
 expect(prevented).toBeTrue();
 expect(frame.messages.at(-1)?.value.revision).toBe(3);
 frame.elements.get("fit-records")?.emit("click");
 expect(frame.calls.fits).toBe(2);
 frame.failTile();
 expect(frame.elements.get("map-status")?.textContent).toContain("unavailable or offline");
 expect(frame.calls.tileCreates).toBe(1);
 frame.send(data(4, []));
 expect(frame.calls.tileRemovals).toBe(1);
 expect(frame.elements.get("fit-records")?.disabled).toBeTrue();
 expect(frame.elements.get("map-status")?.textContent).toContain("No source points");
 frame.mounted.dispose();
});

test("Q268 hidden/pagehide/dispose releases resources and ignores all delayed work", () => {
 for (const mode of ["hidden", "pagehide", "dispose"]) {
  const frame = frameFixture(); frame.send(data());
  if (mode === "hidden") { frame.doc.hidden = true; frame.doc.emit("visibilitychange"); }
  else if (mode === "pagehide") frame.view.emit("pagehide");
  else frame.mounted.dispose();
  frame.doc.hidden = false;
  const previous = frame.messages.length;
  frame.send(data(2)); frame.markers[0]?.click(); frame.failTile();
  frame.elements.get("fit-records")?.emit("click"); frame.mounted.dispose();
  expect(frame.calls.removals).toBe(1);
  expect(frame.calls.tileAdds).toBe(1);
  expect(frame.calls.fits).toBe(1);
  expect(frame.messages).toHaveLength(previous);
  expect(frame.view.listeners.get("message")?.size).toBe(0);
  expect(frame.view.listeners.get("pagehide")?.size).toBe(0);
  expect(frame.doc.listeners.get("visibilitychange")?.size).toBe(0);
  expect(frame.elements.get("source-map")?.listeners.get("keydown")?.size).toBe(0);
  expect(frame.elements.get("map-status")?.textContent).toContain("Map stopped");
 }
});

test("Q268 keyboard arrows and zoom use public non-animated movement and the handler is disposed", () => {
 const frame = frameFixture(), canvas = frame.elements.get("source-map")!;
 let prevented = 0;
 const key = (value: string, extra: Record<string, unknown> = {}) => canvas.emit("keydown", {
  key: value, target: canvas, preventDefault() { prevented += 1; }, stopPropagation() {}, ...extra,
 });
 key("ArrowRight"); expect(frame.calls.pans).toHaveLength(0);
 frame.send(data());
 expect(frame.calls.keyboard).toBeFalse(); // Built-in Leaflet keyboard pans animate even with zoomAnimation=false.
 expect(canvas.attributes.get("tabindex")).toBe("0");
 for (let index = 0; index < 100; index += 1) key("ArrowRight");
 expect(frame.calls.pans).toHaveLength(100);
 expect(frame.calls.pans[0]).toEqual({ center: { x: 80, y: 0 }, animate: false });
 expect(frame.calls.pans.every(pan => pan.animate === false)).toBeTrue();
 key("ArrowLeft", { shiftKey: true });
 key("ArrowDown"); key("ArrowUp", { shiftKey: true });
 expect(frame.calls.pans.at(-1)?.center).toEqual({ x: 7760, y: -160 });
 key("+"); key("-", { shiftKey: true }); key("="); key("_");
 expect(frame.calls.zooms).toEqual([{ zoom: 18, animate: false }, { zoom: 15, animate: false }, { zoom: 16, animate: false }, { zoom: 15, animate: false }]);
 const handled = prevented;
 for (const extra of [{ ctrlKey: true }, { altKey: true }, { metaKey: true }, { defaultPrevented: true }, { target: {} }]) key("ArrowRight", extra);
 key("Enter"); key("a");
 expect(prevented).toBe(handled);
 const movements = frame.calls.pans.length;
 frame.mounted.dispose();
 key("ArrowRight"); key("+");
 expect(frame.calls.pans).toHaveLength(movements);
 expect(frame.calls.zooms).toHaveLength(4);
 expect(canvas.listeners.get("keydown")?.size).toBe(0);
 expect(canvas.attributes.has("tabindex")).toBeFalse();
});

test("Q268 frame assets are local, table-honest and contain no autonomous external query path", async () => {
 const [html, js, css] = await Promise.all(["html", "js", "css"].map(extension => Bun.file(new URL(`../src/http/operator/market-map.${extension}`, import.meta.url)).text()));
 expect(html).toContain('src="/assets/market-map/leaflet.js" defer');
 expect(html).toContain('type="module" src="/assets/market-map/frame.js"');
 expect(html).toContain('href="/assets/market-map/leaflet.css"');
 expect(html).toContain('href="/assets/market-map/frame.css"');
 expect(html).not.toMatch(/<script[^>]*src="https?:|<style|\sstyle=|\son\w+=|preconnect|prefetch|preload/iu);
 expect(js).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML|fetch\(|XMLHttpRequest|WebSocket|setInterval|localStorage|sessionStorage|document\.cookie|\.locate\(/u);
 expect(js).toContain('https://tile.openstreetmap.org/{z}/{x}/{y}.png');
 expect(js).toContain('referrerPolicy: "strict-origin-when-cross-origin"');
 expect(js).toContain("keepBuffer: 0");
 expect(js).toContain("detectRetina: false");
 expect(js).toContain("if (doc.hidden) stop()");
 expect(js).toContain("map.remove()");
 expect(js).toContain("map.removeLayer(tiles)");
 expect(js).toContain("if (!firstFit)");
 expect(js).toContain('node.setAttribute("role", "button")');
 expect(js).toContain('event.key === "Enter" || event.key === " "');
 expect(js).toContain("all records remain in the complete evidence table");
 expect(css).toContain("prefers-reduced-motion");
 expect(css).toContain("min-height: 44px");
});
