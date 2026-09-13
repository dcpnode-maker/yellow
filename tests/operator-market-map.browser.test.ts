import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { inflateSync } from "node:zlib";
import { runInNewContext } from "node:vm";
import { startMarketMapBrowserFixture } from "../scripts/research/verify-market-map-browser";

const root = new URL("..", import.meta.url);
const moduleSource = readFileSync(new URL("../src/http/operator/operator-market-map.js", import.meta.url), "utf8");
const propertyA = "00000000-0000-4000-8000-000000000001";
const propertyB = "00000000-0000-4000-8000-000000000002";
const gersId = "00000000-0000-4000-8000-000000000099";
const browser = [process.env.PROGRAMFILES && resolve(process.env.PROGRAMFILES, "Google/Chrome/Application/chrome.exe"),
  process.env["PROGRAMFILES(X86)"] && resolve(process.env["PROGRAMFILES(X86)"], "Microsoft/Edge/Application/msedge.exe"),
  Bun.which("chromium"), Bun.which("chromium-browser"), Bun.which("google-chrome")].find((path): path is string => Boolean(path && existsSync(path)));
const requireBrowserProof = process.env.YELLOW_REQUIRE_MARKET_MAP_BROWSER === "1";

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

type CdpSend = <Result>(method: string, params?: Record<string, unknown>) => Promise<Result>;
type Screenshot = { png: Uint8Array; sha256: string; pixels: { width: number; height: number; colours: number } };

function browserUnavailable(error: unknown): boolean {
  return typeof error === "object" && error !== null && ["EBUSY", "ENOENT"].includes(String((error as { code?: unknown }).code));
}

async function withChromium<Result>(profile: string, run: (send: CdpSend, runtimeErrors: string[]) => Promise<Result>): Promise<Result> {
  if (!browser) throw new Error("Chrome or Chromium is required when YELLOW_REQUIRE_MARKET_MAP_BROWSER=1");
  const chrome = Bun.spawn([browser, "--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--no-first-run", "--no-default-browser-check",
    "--use-angle=swiftshader", "--remote-debugging-address=127.0.0.1", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"],
  { stdout: "ignore", stderr: "ignore" });
  let socket: WebSocket | null = null;
  try {
    const portFile = resolve(profile, "DevToolsActivePort");
    let port = "";
    for (let attempt = 0; attempt < 240; attempt += 1) {
      try { if (existsSync(portFile)) port = (await Bun.file(portFile).text()).split(/\r?\n/, 1)[0] ?? ""; }
      catch (error) { if (!browserUnavailable(error)) throw error; }
      if (port || chrome.exitCode !== null) break;
      await Bun.sleep(25);
    }
    if (!port) throw new Error(`Chromium did not expose a DevTools port (exit ${chrome.exitCode ?? "unknown"})`);
    const created = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent("about:blank")}`, { method: "PUT" });
    if (!created.ok) throw new Error(`Chromium target creation failed (${created.status})`);
    const target = await created.json() as { webSocketDebuggerUrl?: string };
    if (!target.webSocketDebuggerUrl) throw new Error("Chromium target has no debugger endpoint");
    socket = new WebSocket(target.webSocketDebuggerUrl);
    const runtimeErrors: string[] = [];
    const pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
    let commandId = 0;
    await new Promise<void>((resolveOpen, rejectOpen) => {
      const timer = setTimeout(() => rejectOpen(new Error("Chromium debugger socket did not open")), 5_000);
      socket?.addEventListener("open", () => { clearTimeout(timer); resolveOpen(); }, { once: true });
      socket?.addEventListener("error", () => { clearTimeout(timer); rejectOpen(new Error("Chromium debugger socket failed")); }, { once: true });
    });
    socket.addEventListener("message", event => {
      const message = JSON.parse(String(event.data)) as { id?: number; result?: unknown; error?: { message?: string }; method?: string;
        params?: { type?: string; args?: Array<{ value?: unknown; description?: string }>; exceptionDetails?: { text?: string; exception?: { description?: string } } } };
      if (message.method === "Runtime.exceptionThrown") runtimeErrors.push(message.params?.exceptionDetails?.exception?.description ?? message.params?.exceptionDetails?.text ?? "Runtime exception");
      if (message.method === "Runtime.consoleAPICalled" && ["error", "assert"].includes(message.params?.type ?? "")) runtimeErrors.push((message.params?.args ?? []).map(argument => String(argument.value ?? argument.description ?? "")).join(" "));
      if (!message.id) return;
      const command = pending.get(message.id); if (!command) return;
      pending.delete(message.id); clearTimeout(command.timer);
      if (message.error) command.reject(new Error(message.error.message ?? "Chromium command failed")); else command.resolve(message.result);
    });
    const send: CdpSend = <CommandResult>(method: string, params: Record<string, unknown> = {}) => new Promise<CommandResult>((resolveCommand, rejectCommand) => {
      const id = ++commandId;
      const timer = setTimeout(() => { pending.delete(id); rejectCommand(new Error(`Chromium command timed out: ${method}`)); }, 8_000);
      pending.set(id, { resolve: value => resolveCommand(value as CommandResult), reject: rejectCommand, timer });
      socket?.send(JSON.stringify({ id, method, params }));
    });
    try { return await run(send, runtimeErrors); }
    finally { for (const command of pending.values()) { clearTimeout(command.timer); command.reject(new Error("Chromium debugger closed with a command pending")); } }
  } finally {
    socket?.close();
    if (chrome.exitCode === null) chrome.kill();
    await chrome.exited;
  }
}

async function waitFor(send: CdpSend, expression: string, label: string): Promise<unknown> {
  for (let attempt = 0; attempt < 300; attempt += 1) {
    const result = await send<{ result?: { value?: unknown } }>("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (result.result?.value) return result.result.value;
    await Bun.sleep(25);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

function pngPixels(png: Uint8Array): { width: number; height: number; colours: number } {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  if (String.fromCharCode(...png.slice(1, 4)) !== "PNG") throw new Error("Chromium did not return a PNG screenshot");
  let offset = 8; let width = 0; let height = 0; let channels = 0; const compressed: Uint8Array[] = [];
  while (offset + 12 <= png.length) {
    const length = view.getUint32(offset); const name = String.fromCharCode(...png.slice(offset + 4, offset + 8));
    const body = png.slice(offset + 8, offset + 8 + length); offset += length + 12;
    if (name === "IHDR") { width = new DataView(body.buffer, body.byteOffset, body.byteLength).getUint32(0); height = new DataView(body.buffer, body.byteOffset, body.byteLength).getUint32(4); const depth = body[8] ?? -1; const kind = body[9] ?? -1; if (body.length < 13 || depth !== 8 || ![2, 6].includes(kind) || body[12] !== 0) throw new Error("Unsupported Chromium screenshot PNG layout"); channels = kind === 6 ? 4 : 3; }
    if (name === "IDAT") compressed.push(body);
    if (name === "IEND") break;
  }
  if (!width || !height || !channels) throw new Error("Chromium screenshot PNG has no raster header");
  const total = compressed.reduce((size, item) => size + item.length, 0); const packed = new Uint8Array(total); let cursor = 0;
  for (const item of compressed) { packed.set(item, cursor); cursor += item.length; }
  const raw = inflateSync(packed); const stride = width * channels; const previous = new Uint8Array(stride); const row = new Uint8Array(stride); const colours = new Set<string>(); let input = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[input++]!;
    if (filter > 4) throw new Error(`Unsupported PNG filter ${filter}`);
    for (let x = 0; x < stride; x += 1) {
      const source = raw[input++]!; const left = x >= channels ? row[x - channels]! : 0; const above = previous[x]!; const upperLeft = x >= channels ? previous[x - channels]! : 0;
      row[x] = filter === 0 ? source : filter === 1 ? (source + left) & 255 : filter === 2 ? (source + above) & 255 : filter === 3 ? (source + Math.floor((left + above) / 2)) & 255 : (() => { const base = left + above - upperLeft; const pa = Math.abs(base - left); const pb = Math.abs(base - above); const pc = Math.abs(base - upperLeft); return (source + (pa <= pb && pa <= pc ? left : pb <= pc ? above : upperLeft)) & 255; })();
    }
    for (let x = 0; x < stride; x += channels * 8) colours.add(Array.from(row.slice(x, x + channels)).join(","));
    previous.set(row);
  }
  return { width, height, colours: colours.size };
}

async function captureMap(send: CdpSend, name: string, directory: string | undefined): Promise<Screenshot> {
  const rect = await send<{ result?: { value?: { x: number; y: number; width: number; height: number } } }>("Runtime.evaluate", {
    expression: "(()=>{const r=document.querySelector('#market-map-canvas .maplibregl-canvas')?.getBoundingClientRect();return r&&{x:r.x,y:r.y,width:r.width,height:r.height}})()", returnByValue: true,
  });
  const clip = rect.result?.value;
  if (!clip || clip.width < 100 || clip.height < 100) throw new Error(`No rendered MapLibre canvas for ${name}`);
  const result = await send<{ data?: string }>("Page.captureScreenshot", { format: "png", fromSurface: true, clip: { ...clip, scale: 1 } });
  if (!result.data) throw new Error(`No map screenshot for ${name}`);
  const png = Buffer.from(result.data, "base64"); const evidence = { png, sha256: createHash("sha256").update(png).digest("hex"), pixels: pngPixels(png) };
  if (directory) await Bun.write(resolve(directory, name), png);
  return evidence;
}

async function stableMap(send: CdpSend, name: string, directory: string | undefined, expectedHash?: string): Promise<Screenshot> {
  let previous: Screenshot | undefined;
  const deadline = performance.now() + 3_000;
  while (performance.now() < deadline) {
    const current = await captureMap(send, name, undefined);
    if (previous?.sha256 === current.sha256 && (!expectedHash || current.sha256 === expectedHash)) {
      if (directory) await Bun.write(resolve(directory, name), current.png);
      return current;
    }
    previous = current;
    await Bun.sleep(25);
  }
  throw new Error(`Map raster did not stabilize within 3 seconds for ${name}${expectedHash ? " at the expected projection hash" : ""}`);
}

async function emitMapPreview(send: CdpSend, name: string): Promise<void> {
  if (!/^[a-z0-9-]+\.png$/.test(name)) throw new Error(`Unsafe market-map preview name: ${name}`);
  const rect = await send<{ result?: { value?: { x: number; y: number; width: number; height: number } } }>("Runtime.evaluate", {
    expression: "(()=>{const r=document.querySelector('#market-map-canvas .maplibregl-canvas')?.getBoundingClientRect();return r&&{x:r.x,y:r.y,width:r.width,height:r.height}})()", returnByValue: true,
  });
  const clip = rect.result?.value; if (!clip) throw new Error(`No map canvas for preview ${name}`);
  for (const scale of [0.5, 0.25]) {
    const result = await send<{ data?: string }>("Page.captureScreenshot", { format: "png", fromSurface: true, clip: { ...clip, scale } });
    if (!result.data) continue;
    const png = Buffer.from(result.data, "base64");
    if (png.byteLength <= 150 * 1024) { console.log(`YELLOW_MAP_PREVIEW name=${name} data=${png.toString("base64")}`); return; }
  }
  throw new Error(`Market-map preview ${name} exceeded the 150KiB cap`);
}

async function emitViewportPreview(send: CdpSend, name: string): Promise<void> {
  const size = await send<{ result?: { value?: { width: number; height: number } } }>("Runtime.evaluate", { expression: "({width:innerWidth,height:innerHeight})", returnByValue: true });
  const viewport = size.result?.value; if (!viewport || !/^[a-z0-9-]+\.png$/.test(name)) return;
  for (const scale of [0.25, 0.125]) {
    const result = await send<{ data?: string }>("Page.captureScreenshot", { format: "png", fromSurface: true, clip: { x: 0, y: 0, width: viewport.width, height: viewport.height, scale } });
    if (!result.data) continue;
    const png = Buffer.from(result.data, "base64");
    if (png.byteLength <= 150 * 1024) { console.log(`YELLOW_MAP_PREVIEW name=${name} data=${png.toString("base64")}`); return; }
  }
}

async function press(send: CdpSend, selector: string): Promise<void> {
  const focused = await send<{ result?: { value?: boolean } }>("Runtime.evaluate", { expression: `(()=>{const node=document.querySelector(${JSON.stringify(selector)});if(!node)return false;node.focus();return document.activeElement===node})()`, returnByValue: true });
  if (!focused.result?.value) throw new Error(`Cannot focus ${selector} for keyboard proof`);
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: " ", code: "Space", windowsVirtualKeyCode: 32, text: " ", unmodifiedText: " " });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: " ", code: "Space", windowsVirtualKeyCode: 32 });
}

const marketMapBrowserTest = requireBrowserProof ? test : test.skip;
marketMapBrowserTest("required Chromium market map proof renders lazy flat and globe views with safe fallback", async () => {
  const captures = process.env.YELLOW_MARKET_MAP_PROOF_DIR;
  const proof: Record<string, unknown> = { status: "started", required: true };
  if (captures) await mkdir(captures, { recursive: true });
  const writeProof = async () => { if (captures) await Bun.write(resolve(captures, "market-map-proof.json"), JSON.stringify(proof, null, 2)); };
  const reportProof = () => console.log(`YELLOW_MAP_PROOF ${JSON.stringify(proof)}`);
  await writeProof();
  if (!browser) {
    proof.status = "failed"; proof.failure = { stage: "locate-chromium", message: "Chrome or Chromium is required when YELLOW_REQUIRE_MARKET_MAP_BROWSER=1" };
    await writeProof();
    reportProof();
    throw new Error("Chrome or Chromium is required when YELLOW_REQUIRE_MARKET_MAP_BROWSER=1");
  }
  const fixture = startMarketMapBrowserFixture(); const failedFixture = startMarketMapBrowserFixture({ failMap: true });
  const temporary = await mkdtemp(resolve(tmpdir(), "yellow-market-map-browser-"));
  let previewCount = 0;
  const preview = async (send: CdpSend, name: string) => { if (previewCount < 3) { await emitMapPreview(send, name); previewCount += 1; } };
  try {
    await withChromium(resolve(temporary, "profile"), async (send, runtimeErrors) => {
      let stage = "enable-browser";
      try {
      await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
      Object.assign(proof, { fixture: fixture.server.url, propertyA: fixture.propertyA, propertyB: fixture.propertyB });
      stage = "desktop-lazy-load";
      await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false, screenWidth: 1280, screenHeight: 900 });
      await send("Page.navigate", { url: fixture.server.url });
      await waitFor(send, "document.readyState === 'complete' && document.querySelector('#market-map-view')?.hidden === true", "hidden map workspace");
      const lazy = await send<{ result?: { value?: { engine: boolean; land: boolean } } }>("Runtime.evaluate", { expression: "(()=>{const names=performance.getEntriesByType('resource').map(entry=>entry.name);return{engine:names.some(name=>name.includes('maplibre-gl.mjs')),land:names.some(name=>name.includes('ne_110m_land.geojson'))}})()", returnByValue: true });
      expect(lazy.result?.value).toEqual({ engine: false, land: false });
      const webgl = await send<{ result?: { value?: boolean } }>("Runtime.evaluate", { expression: "(()=>{const canvas=document.createElement('canvas');const context=canvas.getContext('webgl2');const supported=Boolean(context);context?.getExtension('WEBGL_lose_context')?.loseContext();return supported})()", returnByValue: true });
      proof.webgl2 = webgl.result?.value;
      expect(webgl.result?.value).toBe(true);
      await send("Runtime.evaluate", { expression: "document.querySelector('#open-map').click()" });
      await waitFor(send, "Boolean(document.querySelector('#market-map-canvas .maplibregl-canvas')) && document.querySelector('#market-map-toggle-globe')?.hidden === false", "loaded MapLibre engine");
      stage = "world-projection-pixels";
      const worldFlat = await stableMap(send, "market-map-world-flat.png", captures);
      await preview(send, "market-map-world-flat.png");
      const noMarkers = await send<{ result?: { value?: number } }>("Runtime.evaluate", { expression: "document.querySelectorAll('.market-map-marker').length", returnByValue: true });
      expect(noMarkers.result?.value).toBe(0); expect(worldFlat.pixels.colours).toBeGreaterThan(5);
      await press(send, "#market-map-toggle-globe");
      await waitFor(send, "document.querySelector('#market-map-toggle-globe')?.getAttribute('aria-pressed') === 'true'", "world globe projection");
      const worldGlobe = await stableMap(send, "market-map-world-globe.png", captures);
      await preview(send, "market-map-world-globe.png");
      const globeMarkers = await send<{ result?: { value?: number } }>("Runtime.evaluate", { expression: "document.querySelectorAll('.market-map-marker').length", returnByValue: true });
      expect(globeMarkers.result?.value).toBe(0); expect(worldGlobe.pixels.colours).toBeGreaterThan(5); expect(worldGlobe.sha256).not.toBe(worldFlat.sha256);
      await press(send, "#market-map-toggle-globe");
      await waitFor(send, "document.querySelector('#market-map-toggle-globe')?.getAttribute('aria-pressed') === 'false'", "restored flat projection");
      const worldFlatRestored = await stableMap(send, "market-map-world-flat-restored.png", captures, worldFlat.sha256);
      expect(worldFlatRestored.pixels.colours).toBeGreaterThan(5); expect(worldFlatRestored.sha256).toBe(worldFlat.sha256);
      stage = "desktop-catalog-and-selection";
      const beforeImmediateSubmit = fixture.requests.filter(request => request.path.includes("/market-map/places")).length;
      await send("Runtime.evaluate", { expression: "(()=>{const input=document.querySelector('#market-map-query');input.value='hotel';input.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#market-map-search-form').requestSubmit()})()" });
      await waitFor(send, "document.querySelectorAll('#market-map-place-list .market-map-place').length === 3", "catalog list");
      await Bun.sleep(500);
      expect(fixture.requests.filter(request => request.path.includes("/market-map/places")).length).toBe(beforeImmediateSubmit + 1);
      const desktop = await send<{ result?: { value?: { canvas: { width: number; height: number; right: number }; list: { x: number; width: number; y: number }; stage: { width: number; right: number } } } }>("Runtime.evaluate", { expression: "(()=>{const rect=node=>{const r=node.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}};return{canvas:rect(document.querySelector('#market-map-canvas')),list:rect(document.querySelector('#market-map-place-list')),stage:rect(document.querySelector('.market-map-stage'))}})()", returnByValue: true });
      expect(desktop.result?.value?.canvas.width).toBeGreaterThan(500); expect(desktop.result?.value?.stage.right).toBeLessThan(desktop.result?.value?.list.x ?? Number.POSITIVE_INFINITY);
      await press(send, "#market-map-place-list button[aria-pressed='false']");
      await press(send, "#market-map-place-list button:not([disabled]) + button:not([disabled])");
      await waitFor(send, "document.querySelector('#market-map-export')?.disabled === false", "keyboard research selection");
      const selected = await send<{ result?: { value?: { subject: string; comps: number; exportEnabled: boolean } } }>("Runtime.evaluate", { expression: "({subject:document.querySelector('#market-map-subject').textContent,comps:document.querySelectorAll('#market-map-compset .market-map-chip').length,exportEnabled:!document.querySelector('#market-map-export').disabled})", returnByValue: true });
      expect(selected.result?.value).toMatchObject({ subject: "Synthetic Marina Hotel is marked as your property.", comps: 1, exportEnabled: true });
      const dubai = await captureMap(send, "market-map-desktop-dubai-selection.png", captures);
      expect(dubai.pixels.colours).toBeGreaterThan(5);
      await press(send, "#market-map-export");
      await waitFor(send, "document.querySelector('#market-map-selection-status')?.textContent.includes('downloaded')", "research export");
      await send("Runtime.evaluate", { expression: `(()=>{const property=document.querySelector('#property-select');property.value=${JSON.stringify(fixture.propertyB)};property.dispatchEvent(new Event('change',{bubbles:true}))})()` });
      const reset = await send<{ result?: { value?: { subject: string; exportDisabled: boolean; comps: number } } }>("Runtime.evaluate", { expression: "({subject:document.querySelector('#market-map-subject').textContent,exportDisabled:document.querySelector('#market-map-export').disabled,comps:document.querySelectorAll('#market-map-compset .market-map-chip').length})", returnByValue: true });
      expect(reset.result?.value).toEqual({ subject: "No subject selected.", exportDisabled: true, comps: 0 });
      stage = "phone-geometry-and-pixels";
      await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true, screenWidth: 390, screenHeight: 844 });
      await send("Page.navigate", { url: fixture.server.url });
      await waitFor(send, "document.readyState === 'complete' && document.querySelector('#market-map-view')?.hidden === true", "phone hidden workspace");
      await send("Runtime.evaluate", { expression: "document.querySelector('#open-map').click()" });
      await waitFor(send, "Boolean(document.querySelector('#market-map-canvas .maplibregl-canvas')) && document.querySelector('#market-map-toggle-globe')?.hidden === false", "phone MapLibre engine");
      await send("Runtime.evaluate", { expression: "(()=>{const input=document.querySelector('#market-map-query');input.value='hotel';document.querySelector('#market-map-search-form').requestSubmit()})()" });
      await waitFor(send, "document.querySelectorAll('#market-map-place-list .market-map-place').length === 3", "phone catalog list");
      const phone = await send<{ result?: { value?: { canvas: { width: number; right: number; bottom: number }; list: { y: number } } } }>("Runtime.evaluate", { expression: "(()=>{const rect=node=>{const r=node.getBoundingClientRect();return{width:r.width,right:r.right,bottom:r.bottom,y:r.y}};return{canvas:rect(document.querySelector('#market-map-canvas')),list:rect(document.querySelector('#market-map-place-list'))}})()", returnByValue: true });
      expect(phone.result?.value?.canvas.width).toBeGreaterThan(300); expect(phone.result?.value?.canvas.right).toBeLessThanOrEqual(391); expect(phone.result?.value?.list.y).toBeGreaterThan(phone.result?.value?.canvas.bottom ?? 0);
      const phoneFlat = await stableMap(send, "market-map-phone-flat.png", captures); expect(phoneFlat.pixels.colours).toBeGreaterThan(5);
      await preview(send, "market-map-phone-flat.png");
      const origins = await send<{ result?: { value?: string[] } }>("Runtime.evaluate", { expression: "Array.from(new Set(performance.getEntriesByType('resource').map(entry=>new URL(entry.name).origin))).sort()", returnByValue: true });
      expect(origins.result?.value).toEqual([new URL(fixture.server.url).origin]);
      expect(runtimeErrors).toEqual([]);
      stage = "missing-engine-list-fallback";
      await send("Page.navigate", { url: failedFixture.server.url });
      await waitFor(send, "document.readyState === 'complete' && document.querySelector('#market-map-view')?.hidden === true", "fallback hidden workspace");
      await send("Runtime.evaluate", { expression: "document.querySelector('#open-map').click()" });
      await waitFor(send, "document.querySelector('#market-map-canvas')?.textContent.includes('Map rendering is unavailable')", "missing engine fallback");
      const fallback = await send<{ result?: { value?: { status: string; canvas: string } } }>("Runtime.evaluate", { expression: "({status:document.querySelector('#market-map-status').textContent,canvas:document.querySelector('#market-map-canvas').textContent})", returnByValue: true });
      expect(fallback.result?.value).toMatchObject({ status: "Map runtime unavailable; the catalog list and research selection remain available." });
      expect(fallback.result?.value?.canvas).toContain("Map rendering is unavailable in this browser");
      const engineRequests = failedFixture.requests.filter(request => request.path.endsWith("/maplibre-gl.mjs")).length;
      await send("Runtime.evaluate", { expression: "(()=>{const input=document.querySelector('#market-map-query');input.value='hotel';document.querySelector('#market-map-search-form').requestSubmit()})()" });
      await waitFor(send, "document.querySelectorAll('#market-map-place-list .market-map-place').length === 3", "fallback catalog list");
      await press(send, "#market-map-place-list button[aria-pressed='false']");
      await press(send, "#market-map-place-list button:not([disabled]) + button:not([disabled])");
      await waitFor(send, "document.querySelector('#market-map-export')?.disabled === false", "fallback keyboard selection");
      await press(send, "#market-map-export");
      await waitFor(send, "document.querySelector('#market-map-selection-status')?.textContent.includes('downloaded')", "fallback research export");
      await press(send, "#proof-sign-out");
      const signedOut = await send<{ result?: { value?: { subject: string; exportDisabled: boolean; list: number } } }>("Runtime.evaluate", { expression: "({subject:document.querySelector('#market-map-subject').textContent,exportDisabled:document.querySelector('#market-map-export').disabled,list:document.querySelectorAll('#market-map-place-list .market-map-place').length})", returnByValue: true });
      expect(signedOut.result?.value).toEqual({ subject: "No subject selected.", exportDisabled: true, list: 0 });
      expect(failedFixture.requests.filter(request => request.path.endsWith("/maplibre-gl.mjs")).length).toBe(engineRequests);
      expect(fixture.requests.every(request => request.status < 400)).toBe(true);
      expect(fixture.requests.some(request => request.path.includes("/market-map/places") && request.status === 200)).toBe(true);
      expect(fixture.requests.some(request => request.path.includes("/market-map/selection") && request.status === 200)).toBe(true);
      expect(failedFixture.requests.some(request => request.path.endsWith("/maplibre-gl.mjs") && request.status === 503)).toBe(true);
      expect(failedFixture.requests.some(request => request.path.includes("/market-map/places") && request.status === 200)).toBe(true);
      expect(failedFixture.requests.some(request => request.path.includes("/market-map/selection") && request.status === 200)).toBe(true);
      Object.assign(proof, { status: "passed", lazy: lazy.result?.value, desktop: desktop.result?.value, world: { flat: { sha256: worldFlat.sha256, ...worldFlat.pixels }, globe: { sha256: worldGlobe.sha256, ...worldGlobe.pixels }, restoredFlat: { sha256: worldFlatRestored.sha256, ...worldFlatRestored.pixels } }, dubai: { sha256: dubai.sha256, ...dubai.pixels }, phone: { geometry: phone.result?.value, flat: { sha256: phoneFlat.sha256, ...phoneFlat.pixels } }, requests: fixture.requests, fallbackRequests: failedFixture.requests });
      await writeProof();
      reportProof();
      } catch (error) {
        proof.status = "failed"; proof.failure = { stage, message: error instanceof Error ? error.message : String(error) };
        try {
          const dom = await send<{ result?: { value?: { status: string | null; canvas: string | null; children: string[]; resources: string[] } } }>("Runtime.evaluate", {
            expression: "(()=>{const canvas=document.querySelector('#market-map-canvas');return{status:document.querySelector('#market-map-status')?.textContent||null,canvas:canvas?.textContent||null,children:Array.from(canvas?.children||[]).map(node=>node.tagName),resources:performance.getEntriesByType('resource').map(entry=>{const url=new URL(entry.name);return url.pathname+url.search}).slice(-60)}})()",
            returnByValue: true,
          });
          proof.diagnostics = { runtimeErrors: runtimeErrors.slice(-20), fixtureRequests: fixture.requests.slice(-100), failedFixtureRequests: failedFixture.requests.slice(-100), dom: dom.result?.value ?? null };
        } catch (diagnosticError) {
          proof.diagnostics = { runtimeErrors: runtimeErrors.slice(-20), fixtureRequests: fixture.requests.slice(-100), failedFixtureRequests: failedFixture.requests.slice(-100), collectionError: diagnosticError instanceof Error ? diagnosticError.message : String(diagnosticError) };
        }
        if (captures) {
          try {
            const diagnostic = await send<{ data?: string }>("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
            if (diagnostic.data) await Bun.write(resolve(captures, "market-map-failure.png"), Buffer.from(diagnostic.data, "base64"));
            if (previewCount < 3) { await emitViewportPreview(send, "market-map-failure.png"); previewCount += 1; }
          } catch { /* Preserve the original proof failure when Chromium cannot capture a diagnostic. */ }
        }
        await writeProof();
        reportProof();
        throw error;
      }
    });
  } finally {
    fixture.server.stop(true); failedFixture.server.stop(true);
    await rm(temporary, { recursive: true, force: true });
  }
}, 55_000);
