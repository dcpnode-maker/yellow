import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const root = new URL("..", import.meta.url);
const moduleSource = readFileSync(new URL("../src/http/operator/operator-market-map.js", import.meta.url), "utf8");
const propertyA = "00000000-0000-4000-8000-000000000001";
const propertyB = "00000000-0000-4000-8000-000000000002";
const gersId = "00000000-0000-4000-8000-000000000099";

type Handler = (event: { preventDefault?: () => void; type?: string; detail?: unknown }) => unknown;
class Element {
  children: Element[] = [];
  listeners = new Map<string, Handler>();
  className = ""; textContent = ""; value = ""; hidden = false; disabled = false; href = ""; rel = ""; target = ""; download = "";
  attributes = new Map<string, string>(); dataset: Record<string, string> = {}; classList = { toggle() {} };
  constructor(readonly tag: string) {}
  append(...items: Element[]) { this.children.push(...items); }
  replaceChildren(...items: Element[]) { this.children = items; }
  addEventListener(type: string, handler: Handler) { this.listeners.set(type, handler); }
  setAttribute(name: string, value: string) { this.attributes.set(name, value); }
  getAttribute(name: string) { return this.attributes.get(name) ?? null; }
  click() { this.listeners.get("click")?.({}); }
}
function descendants(node: Element): Element[] { return node.children.flatMap(child => [child, ...descendants(child)]); }
function byText(node: Element, text: string) { return descendants(node).find(item => item.textContent === text)!; }
function nthText(node: Element, text: string, index: number) { return descendants(node).filter(item => item.textContent === text)[index]!; }
function place(id: string, name: string, latitude = 25, longitude = 55) {
  return { id, name, latitude, longitude, category: "hotel", status: "open", address: null, country: "AE", websites: [], brand: null, confidence: null, sources: [] };
}
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (reason?: unknown) => void; return { promise: new Promise<T>((ok, fail) => { resolve = ok; reject = fail; }), resolve, reject }; }

function fixture() {
  const nodes = new Map<string, Element>();
  for (const id of ["market-map-view", "market-map-canvas", "market-map-search-form", "market-map-query", "market-map-visible-search", "market-map-radius", "market-map-radius-search", "market-map-toggle-globe", "market-map-status", "market-map-release", "market-map-count", "market-map-place-list", "market-map-subject", "market-map-compset", "market-map-selection-status", "market-map-export", "property-select"]) nodes.set(`#${id}`, new Element("div"));
  const view = nodes.get("#market-map-view")!; view.hidden = false;
  const property = nodes.get("#property-select")!; property.value = propertyA;
  const radius = nodes.get("#market-map-radius")!; radius.value = "5";
  const requests: Array<{ path: string; options: { method?: string; body?: string }; response: ReturnType<typeof deferred<unknown>> }> = [];
  const windowListeners = new Map<string, Handler>();
  let downloads = 0;
  const window = {
    addEventListener(type: string, handler: Handler) { windowListeners.set(type, handler); },
    dispatchEvent(event: { type: string; detail?: unknown }) {
      if (event.type === "yellow:operator-request") {
        const detail = event.detail as { path: string; options: { method?: string; body?: string }; resolve: (value: unknown) => void; reject: (reason?: unknown) => void };
        const response = deferred<unknown>(); requests.push({ path: detail.path, options: detail.options, response }); response.promise.then(detail.resolve, detail.reject);
      } else windowListeners.get(event.type)?.(event);
      return true;
    },
    setTimeout(handler: () => void) { handler(); return 1; }, clearTimeout() {},
  };
  const document = {
    querySelector(selector: string) { return nodes.get(selector) ?? null; },
    createElement(tag: string) { return new Element(tag); },
    head: new Element("head"),
  };
  class CustomEvent { constructor(readonly type: string, readonly init: { detail: unknown }) {} get detail() { return this.init.detail; } }
  class MutationObserver { constructor(_callback: () => void) {} observe() {} }
  runInNewContext(moduleSource, {
    document, window, CustomEvent, MutationObserver, queueMicrotask() {}, URLSearchParams,
    URL: { createObjectURL() { downloads++; return "blob:test"; }, revokeObjectURL() {} }, Blob, Map, Set, Number, Math, Object, Array, String, RegExp, Error,
  });
  const fire = (node: Element, type: string) => node.listeners.get(type)!({ preventDefault() {} });
  const respond = async (index: number, value: unknown) => { requests[index]!.response.resolve(value); await Promise.resolve(); await Promise.resolve(); };
  return { nodes, requests, fire, respond, property, get downloads() { return downloads; }, signedOut: () => windowListeners.get("yellow:operator-signed-out")!({}) };
}

async function search(f: ReturnType<typeof fixture>, value: string, response: unknown) {
  const query = f.nodes.get("#market-map-query")!; query.value = value;
  f.fire(f.nodes.get("#market-map-search-form")!, "submit");
  await f.respond(f.requests.length - 1, response);
}

test("market map module retains selected records across successive searches", async () => {
  const f = fixture();
  const subject = place("subject", "Own hotel"); const competitor = place("competitor", "Comparable hotel");
  await search(f, "marina", { places: [subject, competitor], release: "2026-08-19.0", schemaVersion: "v1" });
  f.fire(byText(f.nodes.get("#market-map-place-list")!, "Mark own"), "click");
  f.fire(nthText(f.nodes.get("#market-map-place-list")!, "Add comp", 1), "click");
  expect(descendants(f.nodes.get("#market-map-compset")!).some(item => item.textContent === "Comparable hotel")).toBe(true);
  await search(f, "airport", { places: [place("nearby", "Nearby hotel")], release: "2026-08-19.0", schemaVersion: "v1" });
  expect(f.nodes.get("#market-map-subject")!.textContent).toContain("Own hotel");
  expect(f.nodes.get("#market-map-compset")!.textContent).toBe("");
  expect(descendants(f.nodes.get("#market-map-compset")!).some(item => item.textContent === "Comparable hotel")).toBe(true);
  expect(f.nodes.get("#market-map-export")!.disabled).toBe(false);
});

test("property change clears retained selection", async () => {
  const f = fixture();
  await search(f, "marina", { places: [place("subject", "Own"), place("competitor", "Comp")], release: "r", schemaVersion: "v1" });
  f.fire(byText(f.nodes.get("#market-map-place-list")!, "Mark own"), "click");
  f.fire(nthText(f.nodes.get("#market-map-place-list")!, "Add comp", 1), "click");
  f.property.value = propertyB; f.fire(f.property, "change");
  expect(f.nodes.get("#market-map-subject")!.textContent).toBe("No subject selected.");
  expect(f.nodes.get("#market-map-export")!.disabled).toBe(true);
});

test("late search and export responses cannot render or download after context changes", async () => {
  const f = fixture();
  const query = f.nodes.get("#market-map-query")!; query.value = "marina"; f.fire(f.nodes.get("#market-map-search-form")!, "submit");
  f.property.value = propertyB; f.fire(f.property, "change"); await f.respond(0, { places: [place("late", "Late hotel")], release: "r", schemaVersion: "v1" });
  expect(descendants(f.nodes.get("#market-map-place-list")!).some(item => item.textContent === "Late hotel")).toBe(false);
  f.property.value = propertyA; f.fire(f.property, "change");
  await search(f, "marina", { places: [place("subject", "Own"), place("competitor", "Comp")], release: "r", schemaVersion: "v1" });
  f.fire(byText(f.nodes.get("#market-map-place-list")!, "Mark own"), "click"); f.fire(nthText(f.nodes.get("#market-map-place-list")!, "Add comp", 1), "click");
  f.fire(f.nodes.get("#market-map-export")!, "click"); const exportIndex = f.requests.length - 1;
  f.property.value = propertyB; f.fire(f.property, "change"); await f.respond(exportIndex, { status: "requires-provider-mapping" });
  expect(f.downloads).toBe(0);
});

test("GERS-prefixed and UUID inputs use the id search contract", async () => {
  const f = fixture();
  await search(f, `gers: ${gersId}`, { places: [], release: "r", schemaVersion: "v1" });
  expect(f.requests[0]!.path).toContain(`mode=id&id=${gersId}`);
  await search(f, gersId, { places: [], release: "r", schemaVersion: "v1" });
  expect(f.requests[1]!.path).toContain(`mode=id&id=${gersId}`);
});

test("market map browser surface has a usable list fallback and phone layout", async () => {
  const [html, css] = await Promise.all([
    Bun.file(new URL("src/http/operator/index.html", root)).text(),
    Bun.file(new URL("src/http/operator/operator-market-map.css", root)).text(),
  ]);
  expect(html).toContain("Select your property and comparable candidates for mapping review.");
  expect(css).toContain("@media (max-width:640px)");
  expect(css).toContain("@media (forced-colors:active)");
});
