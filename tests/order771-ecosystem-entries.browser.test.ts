import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, sep } from "node:path";
import { resolveChromiumPath } from "./helpers/chromium-path";
import { fetchJsonBounded, terminateOwnedProcess } from "./helpers/owned-cdp-proof-lifecycle";

const repository = resolve(import.meta.dir, "..");
const output = resolve(import.meta.dir, "../..", "proof");
const ids = { property: "6081b544-22a1-534f-a86d-bb1ae0519e14", tenant: "22222222-2222-4222-8222-222222222222", actor: "33333333-3333-4333-8333-333333333333" };
const json = (value: unknown, status = 200) => Response.json(value, { status });

test("Order71 full App opens CRS and RMS cards through guarded workspace navigation at desktop and phone sizes", async () => {
  const executable = resolveChromiumPath(); if (!executable) throw new Error("Owned Chromium required for Order71 actual-App proof");
  await mkdir(output, { recursive: true });
  const directory = await mkdtemp(resolve(tmpdir(), "yellow-order771-ecosystem-owned-")), profile = resolve(directory, "profile"), proof = resolve(output, "browser");
  await mkdir(proof, { recursive: true });
  let server: ReturnType<typeof Bun.serve> | undefined, chrome: ReturnType<typeof Bun.spawn> | undefined, socket: WebSocket | undefined;
  let captureFailure: ((name: string) => Promise<void>) | undefined;
  let grantDenied = false, holdSearch = false, offerMode = false, rmsFixture = false, requestCount = 0, releaseSearch: (() => void) | undefined;
  const reads: string[] = [], unexpectedWrites: string[] = [], browserErrors: string[] = [];
  const fail = (message: string) => { unexpectedWrites.push(message); return json({ error: "Unexpected synthetic mutation" }, 405); };
  try {
    const entry = resolve(directory, "entry.tsx"), buildDir = resolve(directory, "build");
    await writeFile(entry, `import React from ${JSON.stringify(resolve(repository, "node_modules/react"))};
import {createRoot} from ${JSON.stringify(resolve(repository, "node_modules/react-dom/client"))};
import {QueryClient,QueryClientProvider} from ${JSON.stringify(resolve(repository, "node_modules/@tanstack/react-query/build/modern/index.js"))};
import {AuthenticationGate} from ${JSON.stringify(resolve(repository, "frontend/yellow/src/AuthenticationGate.tsx"))};
import {reactAuthSession} from ${JSON.stringify(resolve(repository, "frontend/yellow/src/auth-session.ts"))};
import ${JSON.stringify(resolve(repository, "frontend/yellow/src/styles.css"))};
import ${JSON.stringify(resolve(repository, "frontend/yellow/src/ui/reference-theme.css"))};
const query=new QueryClient({defaultOptions:{queries:{retry:false,refetchOnWindowFocus:false}}});
window.order71={logout:()=>reactAuthSession.logout(),snapshot:()=>reactAuthSession.getSnapshot()};
await reactAuthSession.signIn({tenant:'synthetic',email:'synthetic@example.invalid',password:'synthetic-only'},${JSON.stringify(ids.property)});
const {App}=await import(${JSON.stringify(resolve(repository, "frontend/yellow/src/App.tsx"))});
createRoot(document.getElementById('root')).render(React.createElement(QueryClientProvider,{client:query},React.createElement(AuthenticationGate,null,React.createElement(App))));`);
    const builderPath = resolve(directory, "build.ts");
    await writeFile(builderPath, `const result=await Bun.build({entrypoints:[${JSON.stringify(entry)}],outdir:${JSON.stringify(buildDir)},target:'browser',format:'esm',define:{'process.env.NODE_ENV':'"production"'}});if(!result.success){console.error(result.logs.join('\\n'));process.exit(1)}`);
    const compiler = Bun.spawn([process.execPath, builderPath], { cwd: repository, stdout: "pipe", stderr: "pipe", windowsHide: true });
    const compilerOutput = Promise.all([new Response(compiler.stdout).text(), new Response(compiler.stderr).text()]);
    const compilerTimer = setTimeout(() => { if (compiler.exitCode === null) compiler.kill(); }, 15000);
    let compilerExit: number; try { compilerExit = await compiler.exited; } finally { clearTimeout(compilerTimer); }
    const compilerLogs = await compilerOutput; if (compilerExit !== 0) throw new Error(`Owned actual-App bundle failed: ${compilerLogs.join("\n")}`);
    server = Bun.serve({ hostname: "127.0.0.1", port: 0, async fetch(request) {
      const url = new URL(request.url), path = url.pathname;
      if (path === "/fixture-control") {
        const mode = url.searchParams.get("mode"); grantDenied = mode === "deny"; holdSearch = mode === "hold"; offerMode = mode === "offer"; rmsFixture = mode === "rms";
        if (mode === "release") { releaseSearch?.(); releaseSearch = undefined; }
        return json({ mode, grantDenied, holdSearch, requestCount });
      }
      if (!path.startsWith("/api/")) {
        if (path.endsWith(".js") || path.endsWith(".css")) {
          const file = resolve(buildDir, path.slice(1));
          if (!file.startsWith(buildDir + sep) || !existsSync(file)) return new Response("missing", { status: 404 });
          return new Response(Bun.file(file), { headers: { "content-type": path.endsWith(".css") ? "text/css" : "text/javascript" } });
        }
        return new Response('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Order71 synthetic App</title><link rel="stylesheet" href="/entry.css"><div id="root"></div><script type="module" src="/entry.js"></script></html>', { headers: { "content-type": "text/html" } });
      }
      if (path === "/api/v1/auth/local:login") {
        const payload = Buffer.from(JSON.stringify({ sub: ids.actor, tid: ids.tenant })).toString("base64url");
        return json({ accessToken: `synthetic.${payload}.signed`, tokenType: "Bearer", expiresInSeconds: 900, user: { id: ids.actor, displayName: "Synthetic staff" } });
      }
      if (path === "/api/v1/auth/browser/logout") return new Response(null, { status: 204 });
      if (path === "/api/v1/me/properties") {
        reads.push(path); if (grantDenied) return json({}, 403);
        return json({ properties: [{ id: ids.property, name: "Synthetic property", timezone: "UTC" }] });
      }
      if (!request.headers.get("authorization")?.startsWith("Bearer ")) return json({}, 401);
      if (request.method !== "GET" && path !== "/api/v1/crs/availability:search" && !path.endsWith("/quotes:resolve")) return fail(`${request.method} ${path}`);
      if (path === "/api/v1/properties/" + ids.property + "/operating-mode") { reads.push(path); return json({}, 503); }
      if (path.endsWith("/rate-configuration")) { reads.push(path); return json({ policies: [], ratePlans: rmsFixture ? [{ id: "22222222-2222-4222-8222-222222222222", name: "Synthetic existing fixture", code: "BAR" }] : [] }); }
      if (path.endsWith("/inventory")) { reads.push(path); return json({ unitTypes: [], spaces: [], sellableUnits: rmsFixture ? [{ id: "11111111-1111-4111-8111-111111111111", name: "Synthetic room" }] : [] }); }
      if (path.endsWith("/quotes:resolve")) { reads.push(`${request.method} ${path}`); return json({ error: "No current quote is available for this existing fixture." }, 404); }
      if (path === "/api/v1/crs/availability:search" && request.method === "POST") {
        reads.push(path); requestCount++;
        if (holdSearch) await new Promise<void>(resolveGate => { releaseSearch = resolveGate; });
        const body = await request.json() as { searches?: { search?: { stay?: unknown } }[] };
        return json({ properties: [{ property_id: ids.property, property_name: "Synthetic property", time_zone: "UTC",
          result: offerMode ? { summary: { bookable: 1, blocked: 0, unpriced: 1, conflicted: 0 }, options: [{ option_ref: "synthetic-ref-0",
            bookable: true, promise: false, commit_arbitration_required: true, sellable_unit: { id: "11111111-1111-4111-8111-111111111111", name: "Synthetic room" },
            unit_type: { code: "KING" }, rate_plan: { id: "22222222-2222-4222-8222-222222222222", code: "BAR" }, available_count: 1,
            stay: (body.searches?.[0]?.search as { stay?: unknown } | undefined)?.stay,
            party: { adults: 1, child_ages: [] }, total: { amount_minor: "9007199254740993", currency: "SAR", kind: "published" } }] }
            : { summary: { bookable: 0, blocked: 0, unpriced: 0, conflicted: 0 }, options: [] } }] });
      }
      reads.push(`${request.method} ${path}`); return json({});
    } });
    chrome = Bun.spawn([executable, "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--remote-debugging-address=127.0.0.1", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { stdout: "ignore", stderr: "ignore", windowsHide: true });
    let devtoolsPort = ""; for (let i = 0; i < 500 && !devtoolsPort; i++) { try { devtoolsPort = (await readFile(resolve(profile, "DevToolsActivePort"), "utf8")).split(/\r?\n/)[0]?.trim() ?? ""; } catch { await Bun.sleep(20); } }
    if (!devtoolsPort) throw new Error("Owned Chrome did not publish its debugging receipt");
    const targets = await fetchJsonBounded<{ type: string; webSocketDebuggerUrl: string }[]>(`http://127.0.0.1:${devtoolsPort}/json/list`), target = targets.find(item => item.type === "page");
    if (!target) throw new Error("Owned Chrome page target missing"); socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise<void>((resolveOpen, reject) => { socket!.onopen = () => resolveOpen(); socket!.onerror = () => reject(new Error("Owned DevTools socket failed")); });
    let sequence = 0; const pending = new Map<number, { method: string; resolve(value: unknown): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> }>();
    socket.onmessage = event => { const data = JSON.parse(String(event.data)); if (data.method === "Runtime.exceptionThrown") browserErrors.push(JSON.stringify(data.params));
      if (data.method === "Runtime.consoleAPICalled" && data.params.type === "error") browserErrors.push(JSON.stringify(data.params));
      if (data.id) { const item = pending.get(data.id); if (!item) return; clearTimeout(item.timer); pending.delete(data.id); data.error ? item.reject(new Error(`${item.method}: ${data.error.message}`)) : item.resolve(data.result); } };
    const send = <T,>(method: string, params: Record<string, unknown> = {}) => new Promise<T>((resolveResult, reject) => {
      const id = ++sequence, timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP deadline ${method}`)); }, 12000);
      pending.set(id, { method, resolve: value => resolveResult(value as T), reject, timer }); socket!.send(JSON.stringify({ id, method, params })); });
    const read = async <T,>(expression: string): Promise<T> => { let result: { result?: { value?: T }; exceptionDetails?: unknown };
      try { result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); }
      catch (cause) { throw new Error(`Runtime.evaluate failed for ${expression}: ${String(cause)}`); }
      if (result.exceptionDetails) throw new Error(`Browser expression failed ${expression}: ${JSON.stringify(result.exceptionDetails)}`); return result.result?.value as T; };
    const until = async (expression: string, label: string) => { for (let i = 0; i < 500; i++) { if (await read<boolean>(expression)) return; await Bun.sleep(20); } throw new Error(`Timed out ${label}: ${await read<string>("document.body.innerText")}`); };
    const clickSelector = async (selector: string) => { const point = await read<{ x: number; y: number }>(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing '+${JSON.stringify(selector)});e.scrollIntoView({block:'center',behavior:'instant'});const r=e.getBoundingClientRect();const x=r.x+r.width/2,y=r.y+r.height/2;const h=document.elementFromPoint(x,y);if(h!==e&&!e.contains(h))throw Error('Occluded '+${JSON.stringify(selector)});return{x,y}})()`);
      await send("Input.dispatchMouseEvent", { type: "mousePressed", ...point, button: "left", clickCount: 1 }); await send("Input.dispatchMouseEvent", { type: "mouseReleased", ...point, button: "left", clickCount: 1 }); await Bun.sleep(50); };
    const clickText = async (text: string) => { const selector = `button`; const point = await read<{ x: number; y: number }>(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(selector)})].find(n=>n.getClientRects().length&&n.textContent.trim()===${JSON.stringify(text)});if(!e)throw Error('Missing button '+${JSON.stringify(text)});e.scrollIntoView({block:'center',behavior:'instant'});const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return{x,y}})()`);
      await send("Input.dispatchMouseEvent", { type: "mousePressed", ...point, button: "left", clickCount: 1 }); await send("Input.dispatchMouseEvent", { type: "mouseReleased", ...point, button: "left", clickCount: 1 }); await Bun.sleep(50); };
    const clickTab = async (text: string) => { const point = await read<{ x: number; y: number }>(`(()=>{const e=[...document.querySelectorAll('button[role="tab"]')].find(n=>n.textContent.includes(${JSON.stringify(text)}));if(!e)throw Error('Missing ribbon tab '+${JSON.stringify(text)});e.scrollIntoView({block:'center',behavior:'instant'});const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return{x,y}})()`);
      await send("Input.dispatchMouseEvent", { type: "mousePressed", ...point, button: "left", clickCount: 1 }); await send("Input.dispatchMouseEvent", { type: "mouseReleased", ...point, button: "left", clickCount: 1 }); await Bun.sleep(50); };
    const screenshot = async (name: string) => { const shot = await send<{ data: string }>("Page.captureScreenshot", { format: "png", captureBeyondViewport: false }); await writeFile(resolve(proof, `${name}.png`), Buffer.from(shot.data, "base64")); };
    captureFailure = screenshot;
    await send("Page.enable"); await send("Runtime.enable");
    await send("Page.navigate", { url: `http://127.0.0.1:${server.port}/p/${ids.property}/today?workspace=ecosystem` });
    await until(`!!document.querySelector('.ecosystem-hub')&&document.querySelectorAll('[data-capability-key="reservations.staff-crs"]').length===1`, "actual App ecosystem hub");
    expect(await read<string>("document.body.innerText.toLowerCase()")).toContain("synthetic property");
    expect(await read<number>("document.documentElement.scrollWidth-innerWidth")).toBeLessThanOrEqual(1);
    await screenshot("desktop-all-ecosystem");

    await read("document.querySelector('[data-capability-key=\"reservations.staff-crs\"] .card-link').focus()");
    expect(await read<boolean>("document.activeElement===document.querySelector('[data-capability-key=\"reservations.staff-crs\"] .card-link')")).toBe(true);
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: " ", code: "Space", windowsVirtualKeyCode: 32, text: " " });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: " ", code: "Space", windowsVirtualKeyCode: 32 });
    await until(`location.pathname==='/p/${ids.property}/reservations'&&location.search==='?view=crs'&&!!document.querySelector('[aria-label="Staff CRS"]')`, "CRS card parent route");
    expect(await read<string>("document.body.innerText.toLowerCase()")).toContain("synthetic property");
    await until(`!!document.querySelector('[aria-label="Staff CRS"] button')`, "CRS workspace controls"); await screenshot("desktop-staff-crs");

    await send("Page.navigate", { url: `http://127.0.0.1:${server.port}/p/${ids.property}/today?workspace=ecosystem` });
    await until("!!document.querySelector('.ecosystem-hub')", "return to ecosystem");
    await clickTab("Stay"); await until(`document.querySelector('.ecosystem-view-heading h2')?.textContent==='Stay'`, "Stay filter");
    expect(await read<number>(`document.querySelectorAll('[data-capability-key="reservations.staff-crs"] .card-link').length`)).toBe(1);
    await screenshot("desktop-stay-filter");

    await send("Page.navigate", { url: `http://127.0.0.1:${server.port}/p/${ids.property}/today?workspace=ecosystem` });
    await until("!!document.querySelector('.ecosystem-hub')", "fresh commercial Hub"); await clickTab("Commercial");
    await until(`document.querySelector('.ecosystem-view-heading h2')?.textContent==='Commercial'`, "Commercial filter");
    expect(await read<number>(`document.querySelectorAll('[data-capability-key="revenue.rms-evidence"] .card-link').length`)).toBe(1);
    await clickSelector('[data-capability-key="revenue.rms-evidence"] .card-link');
    await until(`location.pathname==='/p/${ids.property}/today'&&location.search==='?workspace=rates'&&document.body.innerText.includes('Rates & distribution')&&!!document.querySelector('[aria-label="Staff RMS"]')`, "RMS evidence card parent route");
    await until(`document.querySelector('[aria-label="Staff RMS"]')?.innerText.includes('No configured rate plan returned')`, "RMS empty configuration remains explicit");
    expect(await read<string>("document.querySelector('[aria-label=\"Staff RMS\"]').innerText")).toContain("Read-only server evidence");
    await screenshot("desktop-rms-evidence");
    await fetchJsonBounded(`http://127.0.0.1:${server.port}/fixture-control?mode=rms`);
    await send("Page.navigate", { url: `http://127.0.0.1:${server.port}/p/${ids.property}/today?workspace=ecosystem` }); await until("!!document.querySelector('.ecosystem-hub')", "RMS quote fixture Hub");
    await clickSelector('[data-capability-key="revenue.rms-evidence"] .card-link'); await until(`!!document.querySelector('[aria-label="Staff RMS"]')`, "RMS quote fixture route");
    await until(`!document.querySelector('[aria-label="Staff RMS"] button')?.disabled`, "configured fixture dates"); await clickTab("Quote resolver");
    await clickText("Resolve current quote"); await until(`!!document.querySelector('[aria-label="Staff RMS"] [role="alert"]')`, "unavailable quote error");
    expect(await read<string>(`document.querySelector('[aria-label="Staff RMS"] [role="alert"]').innerText`)).toContain("unavailable. No result has been inferred.");
    expect(reads.some(path => path.includes("/quotes:resolve"))).toBe(true);
    await screenshot("desktop-rms-unavailable-quote");
    expect(unexpectedWrites).toEqual([]);
    await fetchJsonBounded(`http://127.0.0.1:${server.port}/fixture-control?mode=normal`);

    await send("Page.navigate", { url: `http://127.0.0.1:${server.port}/p/${ids.property}/today?workspace=ecosystem` }); await until("!!document.querySelector('.ecosystem-hub')", "CRS offer fixture Hub");
    await fetchJsonBounded(`http://127.0.0.1:${server.port}/fixture-control?mode=offer`); await clickSelector('[data-capability-key="reservations.staff-crs"] .card-link');
    await until(`location.search==='?view=crs'&&!!document.querySelector('[aria-label="Staff CRS"]')`, "CRS offer fixture route"); await clickText("Search granted properties");
    await until(`[...document.querySelectorAll('[aria-label="Staff CRS"] button')].some(b=>b.textContent.includes('Continue with this offer'))`, "synthetic bookable fixture");
    await clickText("Continue with this offer"); await until(`location.pathname==='/p/${ids.property}/reservations'&&location.search.includes('create=crs&')&&location.search.includes('option_ref=synthetic-ref-0')`, "draft-only CRS continuation");
    expect(await read<boolean>(`!location.search.includes('amount=')&&!location.search.includes('token=')&&!location.search.includes('guest=')`)).toBe(true);
    expect(unexpectedWrites).toEqual([]); await fetchJsonBounded(`http://127.0.0.1:${server.port}/fixture-control?mode=normal`);
    expect(unexpectedWrites).toEqual([]);

    await send("Page.navigate", { url: `http://127.0.0.1:${server.port}/p/${ids.property}/today?workspace=ecosystem` });
    await until("!!document.querySelector('.ecosystem-hub')", "CRS denial setup Hub");
    await fetchJsonBounded(`http://127.0.0.1:${server.port}/fixture-control?mode=deny`);
    await clickSelector('[data-capability-key="reservations.staff-crs"] .card-link');
    await until(`location.search==='?view=crs'&&!!document.querySelector('[role="alert"]')`, "denied grant is presented without fallback");
    expect(await read<string>("document.querySelector('[role=\"alert\"]').innerText")).toContain("Property access");
    await fetchJsonBounded(`http://127.0.0.1:${server.port}/fixture-control?mode=normal`);
    expect(unexpectedWrites).toEqual([]);

    await send("Page.navigate", { url: `http://127.0.0.1:${server.port}/p/${ids.property}/today?workspace=ecosystem` });
    await until("!!document.querySelector('.ecosystem-hub')", "held search setup Hub"); await fetchJsonBounded(`http://127.0.0.1:${server.port}/fixture-control?mode=hold`);
    await clickSelector('[data-capability-key="reservations.staff-crs"] .card-link'); await until("location.search==='?view=crs'", "held CRS route");
    await clickText("Search granted properties"); await until("window.order71 && true", "search initiated");
    await until(`window.fetch && ${requestCount} >= 0`, "server available");
    for (let i = 0; i < 300 && requestCount < 1; i++) await Bun.sleep(20); expect(requestCount).toBeGreaterThan(0);
    const navigation = await send<{ currentIndex: number; entries: { id: number; url: string }[] }>("Page.getNavigationHistory");
    const previous = navigation.entries[navigation.currentIndex - 1]; expect(previous?.url).toContain("workspace=ecosystem");
    await send("Page.navigateToHistoryEntry", { entryId: previous!.id });
    await until("location.search.includes('workspace=ecosystem')&&!!document.querySelector('.ecosystem-hub')", "browser Back navigates away during read");
    await fetchJsonBounded(`http://127.0.0.1:${server.port}/fixture-control?mode=release`);
    await Bun.sleep(150); expect(await read<string>("location.search")).toContain("workspace=ecosystem");
    expect(await read<boolean>("!document.body.innerText.includes('No current bookable offer returned.')")).toBe(true);
    await screenshot("desktop-navigation-after-held-read");

    await fetchJsonBounded(`http://127.0.0.1:${server.port}/fixture-control?mode=hold`);
    await clickSelector('[data-capability-key="reservations.staff-crs"] .card-link'); await until("location.search==='?view=crs'", "second held CRS route");
    await clickText("Search granted properties");
    for (let i = 0; i < 300 && requestCount < 2; i++) await Bun.sleep(20); expect(requestCount).toBeGreaterThanOrEqual(2);
    await read("window.order71.logout()"); await until("window.order71.snapshot().status!=='authenticated'", "real session invalidation during held read");
    await fetchJsonBounded(`http://127.0.0.1:${server.port}/fixture-control?mode=release`); await Bun.sleep(120);
    expect(await read<boolean>("!document.body.innerText.includes('No current bookable offer returned.')")).toBe(true);

    await send("Emulation.setDeviceMetricsOverride", { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
    await send("Page.navigate", { url: `http://127.0.0.1:${server.port}/p/${ids.property}/today?workspace=ecosystem` });
    await until("!!document.querySelector('.ecosystem-hub')", "phone actual Hub"); await clickTab("Stay");
    await until(`document.querySelector('.ecosystem-view-heading h2')?.textContent==='Stay'`, "phone Stay filter");
    expect(await read<number>("document.documentElement.scrollWidth-innerWidth")).toBeLessThanOrEqual(1);
    const crsBounds = await read<{ left: number; right: number; width: number }>(`(()=>{const r=document.querySelector('[data-capability-key="reservations.staff-crs"] .card-link').getBoundingClientRect();return{left:r.left,right:r.right,width:r.width}})()`);
    expect(crsBounds.left).toBeGreaterThanOrEqual(-1); expect(crsBounds.right).toBeLessThanOrEqual(376); expect(crsBounds.width).toBeGreaterThan(0);
    await screenshot("phone-stay-filter");
    await clickSelector('[data-capability-key="reservations.staff-crs"] .card-link');
    await until(`location.search==='?view=crs'&&!!document.querySelector('[aria-label="Staff CRS"]')`, "phone CRS card route");
    await screenshot("phone-staff-crs");
    await send("Emulation.setDeviceMetricsOverride", { width: 320, height: 740, deviceScaleFactor: 1, mobile: true });
    await send("Page.navigate", { url: `http://127.0.0.1:${server.port}/p/${ids.property}/today?workspace=ecosystem` }); await until("!!document.querySelector('.ecosystem-hub')", "320px phone actual Hub");
    await clickTab("Stay"); await until(`document.querySelector('.ecosystem-view-heading h2')?.textContent==='Stay'`, "320px Stay filter");
    expect(await read<number>("document.documentElement.scrollWidth-innerWidth")).toBeLessThanOrEqual(1); await screenshot("phone320-stay-filter");
    expect(unexpectedWrites).toEqual([]);
    expect(browserErrors).toEqual([]);
  } catch (cause) {
    try { await captureFailure?.("failure"); } catch { /* Keep the original proof failure. */ }
    await writeFile(resolve(proof, "failure.json"), JSON.stringify({ error: String(cause), requestCount, reads, unexpectedWrites, browserErrors }, null, 2));
    throw cause;
  } finally {
    releaseSearch?.(); if (chrome) await terminateOwnedProcess(chrome); socket?.close(); server?.stop(true);
    const absolute = resolve(directory); if (!absolute.startsWith(resolve(tmpdir()) + sep) || !absolute.split(sep).at(-1)?.startsWith("yellow-order771-ecosystem-owned-")) throw new Error("Owned proof cleanup containment failed");
    await rm(absolute, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    await writeFile(resolve(proof, "observations.json"), JSON.stringify({ synthetic: true, reads, unexpectedWrites, browserErrors, chromiumPid: chrome?.pid, cleanup: { browserExited: !chrome || chrome.exitCode !== null || typeof chrome.signalCode === "string", serverStopped: true, profileRemoved: !existsSync(profile), ownedTempRemoved: !existsSync(absolute) } }, null, 2));
  }
}, 180000);
