import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, sep } from "node:path";
import { resolveChromiumPath } from "./helpers/chromium-path";
import { fetchJsonBounded, terminateOwnedProcess } from "./helpers/owned-cdp-proof-lifecycle";
import type { HousekeepingTaskRow } from "../frontend/yellow/src/housekeeping-floor-model";
const ids = { property: "00000000-0000-4000-8000-000000000001", tenant: "00000000-0000-4000-8000-000000000002",
  actor: "00000000-0000-4000-8000-000000000003", task: "00000000-0000-4000-8000-000000000004",
  space: "00000000-0000-4000-8000-000000000005", other: "00000000-0000-4000-8000-000000000006" };
const stamp = "2026-10-03T08:00:00.000Z";
function fixtureTask(action: HousekeepingAction = "start"): HousekeepingTaskRow {
  return { taskId: ids.task, spaceId: ids.space, spaceCode: "101", floor: "1", roomCondition: action === "verify" ? "clean" : "dirty",
    roomUpdatedAt: stamp, taskStatus: action === "start" ? "assigned" : action === "complete" ? "in_progress" : "done", priority: 1,
    assigned: true, dueAt: null, completedAt: action === "verify" ? stamp : null, allowedActions: [action] };
}
import type { HousekeepingAction } from "../frontend/yellow/src/housekeeping-floor-model";

type Send = <T = unknown>(method: string, params?: Record<string, unknown>) => Promise<T>;
type Write = { path: string; key: string; body: string; replay: boolean };
export type HkAppBrowser = { send: Send; read: <T>(expression: string) => Promise<T>; until: (expression: string, label: string) => Promise<void>;
  click: (text: string) => Promise<void>; navigate: (width?: number, action?: HousekeepingAction) => Promise<void>;
  select: () => Promise<void>; confirm: () => Promise<void>; mode: (value: string) => void; gate: () => void;
  writes: Write[]; reads: string[]; events: string[]; screenshot: (name: string) => Promise<void> };
const repository = resolve(import.meta.dir, "..");
const json = (value: unknown, status = 200, headers: Record<string, string> = {}) => Response.json(value, { status, headers });

export async function withHousekeepingAppBrowser(label: string, body: (browser: HkAppBrowser) => Promise<void>): Promise<void> {
  const executable = resolveChromiumPath(); if (!executable) throw new Error("Owned Chromium required; browser proof is never skipped");
  const directory = await mkdtemp(resolve(tmpdir(), "yellow-housekeeping-app-owned-")), profile = resolve(directory, "profile");
  const proof = process.env.YELLOW_HK_APP_PROOF_DIR ? resolve(process.env.YELLOW_HK_APP_PROOF_DIR) : resolve(directory, "proof");
  await mkdir(proof, { recursive: true });
  const baseline = process.env.YELLOW_HK_APP_BASELINE === "1";
  let server: ReturnType<typeof Bun.serve> | undefined, chrome: ReturnType<typeof Bun.spawn> | undefined, socket: WebSocket | undefined;
  let actor: string = ids.actor, serial = 0;
  let mode = "normal", task = fixtureTask(), condition = "dirty", conditionStamp = stamp;
  const gateState: { release: (() => void) | null } = { release: null };
  const writes: Write[] = [], reads: string[] = [], events: string[] = [], errors: string[] = [];
  const outcomes = new Map<string, { path: string; body: string; value: Record<string, unknown> }>();
  try {
    const entry = resolve(directory, "entry.tsx");
    await writeFile(entry, `import React from ${JSON.stringify(resolve(repository, "node_modules/react"))};
import {createRoot} from ${JSON.stringify(resolve(repository, "node_modules/react-dom/client"))};
import {QueryClient,QueryClientProvider} from ${JSON.stringify(resolve(repository, "node_modules/@tanstack/react-query/build/modern/index.js"))};
import {AuthenticationGate} from ${JSON.stringify(resolve(repository, "frontend/yellow/src/AuthenticationGate.tsx"))};
import {reactAuthSession} from ${JSON.stringify(resolve(repository, "frontend/yellow/src/auth-session.ts"))};
import ${JSON.stringify(resolve(repository, "frontend/yellow/src/styles.css"))};
import ${JSON.stringify(resolve(repository, "frontend/yellow/src/ui/reference-theme.css"))};
const rawFetch=window.fetch.bind(window);window.fetch=async(...args)=>{const r=await rawFetch(...args);if(r.headers.get('x-synthetic-drop')==='true')throw new Error('Synthetic response lost after write');if(r.headers.get('x-synthetic-held-body')==='true')window.hkBodyHeadersReceived=(window.hkBodyHeadersReceived||0)+1;return r};
const query=new QueryClient({defaultOptions:{queries:{retry:false,refetchOnWindowFocus:false}}}),invalidations=[],errors=[];
const invalidate=query.invalidateQueries.bind(query);query.invalidateQueries=(...args)=>{invalidations.push(args[0]);if(window.hkThrowInvalidation&&args[0]?.queryKey?.[0]==='overwatch-arrival-cleaning')throw new Error('Synthetic synchronous cache read failure');if(window.hkRejectInvalidation)return Promise.reject(new Error('Synthetic cache read failed'));return invalidate(...args)};
window.addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));window.addEventListener('error',e=>errors.push(e.message));
const {App}=await import(${JSON.stringify(resolve(repository, "frontend/yellow/src/App.tsx"))});
const signIn=()=>reactAuthSession.signIn({tenant:'synthetic',email:'synthetic@example.invalid',password:'synthetic-only'},location.pathname.split('/')[2]);
window.hkFixture={invalidations,errors,expire:()=>reactAuthSession.logout(),restore:signIn};
window.hkBootId=crypto.randomUUID();window.trustedClicks=[];window.clickTargets=[];document.addEventListener('click',e=>{window.trustedClicks.push(e.isTrusted);window.clickTargets.push(e.target.textContent)});
createRoot(document.getElementById('root')).render(React.createElement(React.StrictMode,null,React.createElement(QueryClientProvider,{client:query},React.createElement(AuthenticationGate,null,React.createElement(App)))));`);
    // A distinct compiler process avoids sharing Bun's build cache with other mounted-fixture suites.
    const builderPath = resolve(directory, "build.ts");
    await writeFile(builderPath, `import {readFile} from 'node:fs/promises';
const build=await Bun.build({entrypoints:[${JSON.stringify(entry)}],outdir:${JSON.stringify(resolve(directory, "build"))},target:'browser',format:'esm',define:{'process.env.NODE_ENV':'"production"'},plugins:[]});
if(!build.success){console.error(build.logs.join('\\n'));process.exit(1)};`);
    const compiler = Bun.spawn([process.execPath, builderPath], { cwd: repository, stdout: "pipe", stderr: "pipe", windowsHide: true });
    const output = Promise.all([new Response(compiler.stdout).text(), new Response(compiler.stderr).text()]);
    const buildTimer = setTimeout(() => { if (compiler.exitCode === null) compiler.kill(); }, 10000);
    let buildExit: number;
    try { buildExit = await compiler.exited; } finally { clearTimeout(buildTimer); }
    const logs = await output;
    if (buildExit !== 0) throw new Error(`Actual caller bundle failed: ${logs.join("\n")}`);
    server = Bun.serve({ hostname: "127.0.0.1", port: 0, async fetch(request) {
      const path = new URL(request.url).pathname;
      if (!path.startsWith("/api/")) {
        if (path.endsWith(".js") || path.endsWith(".css")) {
          const file = resolve(directory, "build", path.slice(1));
          if (!file.startsWith(resolve(directory, "build") + sep) || !existsSync(file)) return new Response("missing", { status: 404 });
          return new Response(Bun.file(file), { headers: { "content-type": path.endsWith(".css") ? "text/css" : "text/javascript" } });
        }
        return new Response('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Owned synthetic full Yellow App housekeeping</title><link rel="stylesheet" href="/entry.css"><div id="root"></div><script type="module" src="/entry.js"></script></html>', { headers: { "content-type": "text/html" } });
      }
      if (path === "/api/v1/auth/browser/logout") return new Response(null, { status: 204 });
      if (path === "/api/v1/auth/browser/resume" || path === "/api/v1/auth/local:login") {
        const payload = Buffer.from(JSON.stringify({ sub: actor, tid: ids.tenant })).toString("base64url");
        return json({ accessToken: `synthetic.${payload}.signature${++serial}`, tokenType: "Bearer", expiresInSeconds: 900, user: { id: actor, displayName: "Synthetic staff" } });
      }
      if (!request.headers.get("authorization")?.startsWith("Bearer ")) return json({}, 401);
      events.push(`${request.method} ${path}`);
      if (request.method === "GET") {
        reads.push(path);
        if (path === "/api/v1/me/properties") return mode === "revoked" ? json({},403) : json({ properties: [ids.property,ids.other].map(id=>({id,name:"Synthetic property",timezone:"UTC"})) });
        if (path.endsWith("/operating-mode")) return json({},503); // Disclosed unavailable mode read, never a fabricated grant.
        if (path.endsWith("/reservation-board")) return json({ reservations: [], nextCursor: null });
        if (path.endsWith("/operational-blocks")) return json({operationalBlocks:[]});
        if (["/rate-configuration", "/inventory", "/operating-performance", "/business-mix"].some(suffix=>path.endsWith(suffix))) return json({},503);
        if (mode === "read-loss") return json({}, 503);
        if (path.endsWith("/housekeeping/conditions")) return json({ rooms: [{ spaceId: ids.space, code: "101", floor: "1", condition, updatedAt: conditionStamp.replace(".000Z", ".000000Z") }], nextCursor: null });
        if (path.endsWith("/housekeeping/tasks")) return json({ tasks: task.taskStatus === "verified" ? [] : [task] });
        if (path.endsWith(`/housekeeping/tasks/${ids.task}`)) return json(task.taskStatus === "verified" ? {} : { task }, task.taskStatus === "verified" ? 404 : 200);
        errors.push(`Unexpected GET ${path}`); return json({}, 404);
      }
      if (request.method !== "POST" || path !== `/api/v1/properties/${ids.property}/housekeeping/tasks/${ids.task}/transition`) {
        errors.push(`Unexpected mutation ${request.method} ${path}`); return json({}, 405);
      }
      const key = request.headers.get("idempotency-key") ?? "", serialized = await request.text(), existing = outcomes.get(key);
      writes.push({ path, body: serialized, key, replay: !!existing });
      if (mode === "unauthenticated") return json({}, 401);
      if (mode === "failure") return json({}, 500);
      if (mode === "deny") return json({}, 403);
      if (mode === "missing") return json({}, 404);
      if (mode === "integrity") return json({ type: "https://yellow/errors/request/idempotency_conflict" }, 409);
      if (mode === "unavailable") return json({}, 503);
      if (existing) {
        if (existing.path !== path || existing.body !== serialized) return json({}, 409);
        return json({ ...existing.value, replayed: true }, 200, { "idempotency-replayed": "true", ...(mode === "lose-until-reconcile" ? { "x-synthetic-drop": "true" } : {}) });
      }
      if (mode === "gate") { mode = "normal"; await new Promise<void>(resolveGate => { gateState.release = resolveGate; }); }
      const input = JSON.parse(serialized);
      expect(Object.keys(input)).toEqual(["action", "expectedTaskStatus", "expectedRoomCondition", "expectedRoomUpdatedAt"]);
      expect(input.expectedTaskStatus).toBe(task.taskStatus); expect(input.expectedRoomCondition).toBe(condition); expect(input.expectedRoomUpdatedAt).toBe(task.roomUpdatedAt);
      const action = input.action as HousekeepingAction;
      condition = action === "start" ? condition : action === "complete" ? "clean" : "inspected";
      conditionStamp = action === "start" ? conditionStamp : "2026-10-03T08:01:00.000Z";
      task = { ...task, roomCondition: condition as typeof task.roomCondition, roomUpdatedAt: conditionStamp,
        taskStatus: action === "start" ? "in_progress" : action === "complete" ? "done" : "verified",
        completedAt: action === "start" ? null : action === "complete" ? conditionStamp : task.completedAt,
        allowedActions: action === "start" ? ["complete"] : action === "complete" ? ["verify"] : [] };
      const value = { taskId: ids.task, spaceId: ids.space, action, taskStatus: task.taskStatus, roomCondition: condition,
        roomUpdatedAt: conditionStamp, completedAt: task.completedAt, replayed: false, allowedActions: action === "start" ? ["complete"] : [] };
      outcomes.set(key, { path, body: serialized, value });
      const lose = mode === "lose" || mode === "lose-until-reconcile"; if (mode === "lose") mode = "normal";
      if (mode === "receipt-mismatch") return json({ ...value, spaceId: ids.other }, 200, { "idempotency-replayed": "false" });
      if (mode === "after-read-loss") mode = "read-loss";
      if (mode === "gate-body") {
        mode = "normal"; events.push("BODY_START");
        const serializedReceipt = JSON.stringify(value), encoder = new TextEncoder();
        const body = new ReadableStream<Uint8Array>({ start(controller) {
          controller.enqueue(encoder.encode("{"));
          gateState.release = () => { controller.enqueue(encoder.encode(serializedReceipt.slice(1))); controller.close(); events.push("BODY_COMPLETE"); };
        } });
        return new Response(body, { status: 200, headers: { "content-type": "application/json", "idempotency-replayed": "false", "x-synthetic-held-body": "true" } });
      }
      return json(value, 200, { "idempotency-replayed": "false", ...(lose ? { "x-synthetic-drop": "true" } : {}) });
    } });
    chrome = Bun.spawn([executable, "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
      "--remote-debugging-address=127.0.0.1", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { stdout: "ignore", stderr: "ignore", windowsHide: true });
    let port = "";
    for (let count = 0; count < 500 && !port; count++) { try { port = (await readFile(resolve(profile, "DevToolsActivePort"), "utf8")).split(/\r?\n/)[0]?.trim() ?? ""; }
      catch (cause) { if (!["EBUSY", "ENOENT"].includes(String((cause as { code?: unknown }).code))) throw cause; } await Bun.sleep(20); }
    if (!port) throw new Error("Owned browser debugging receipt missing");
    const targets = await fetchJsonBounded<{ type: string; webSocketDebuggerUrl: string }[]>(`http://127.0.0.1:${port}/json/list`);
    const target = targets.find(t => t.type === "page"); if (!target) throw new Error("Owned page missing");
    socket = new WebSocket(target.webSocketDebuggerUrl); await new Promise<void>((resolveOpen, reject) => { socket!.onopen = () => resolveOpen(); socket!.onerror = () => reject(new Error("Owned socket failed")); });
    let counter = 0, permitReload = false;
    const callbacks = new Map<number, { resolve(value: unknown): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> }>();
    socket.onmessage = event => { const data = JSON.parse(String(event.data)); if (data.method === "Runtime.exceptionThrown") errors.push(JSON.stringify(data.params));
      if (data.method === "Runtime.consoleAPICalled" && data.params.type === "error") errors.push(JSON.stringify(data.params));
      if (data.method === "Page.javascriptDialogOpening" && data.params.type === "beforeunload" && permitReload) {
        permitReload = false; void send("Page.handleJavaScriptDialog", { accept: true });
      }
      if (data.id) { const pending = callbacks.get(data.id); if (!pending) return; clearTimeout(pending.timer); callbacks.delete(data.id);
        if (data.error) pending.reject(new Error(data.error.message)); else pending.resolve(data.result); } };
    const send: Send = <T>(method: string, params = {}) => new Promise<T>((resolveResult, reject) => {
      if (method === "Page.reload" || method === "Page.navigate") permitReload = true; // Explicit test approval of a warned reload.
      const id = ++counter, timer = setTimeout(() => { callbacks.delete(id); reject(new Error(`CDP deadline ${method}`)); }, 12000);
      callbacks.set(id, { resolve: value => resolveResult(value as T), reject, timer }); socket!.send(JSON.stringify({ id, method, params }));
    });
    const read = async <T>(expression: string): Promise<T> => { const result = await send<{ result?: { value?: T }; exceptionDetails?: unknown }>("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(`Read expression failed: ${expression}; ${JSON.stringify(result.exceptionDetails)}`); return result.result?.value as T; };
    const until = async (expression: string, label: string) => { for (let i = 0; i < 400; i++) { if (await read<boolean>(expression)) return; await Bun.sleep(25); }
      throw new Error(`Timed out ${label}: ${await read<string>("document.body.innerText")}; errors ${JSON.stringify(errors)}`); };
    const click = async (text: string) => {
      // Auth renewal and floor refresh can reposition retained controls. Require
      // the real layout to settle before measuring a trusted pointer target.
      await read("(async()=>{let last='',stable=0;for(let frame=0;frame<120;frame++){await new Promise(requestAnimationFrame);const e=document.querySelector('.hk-task-confirm')??document.querySelector('main'),r=e?.getBoundingClientRect(),now=JSON.stringify(r?{x:r.x,y:r.y,width:r.width,height:r.height}:null);stable=now===last?stable+1:0;last=now;if(stable>=12)return true;}throw new Error('Control layout did not settle')})()");
      const coordinates = await read<{ x: number; y: number }>(`(async()=>{const text=${JSON.stringify(text)},el=[...document.querySelectorAll('button,label,summary')].filter(n=>n.getClientRects().length).find(n=>n.getAttribute('aria-label')===text||n.textContent.trim()===text||(n.tagName==='BUTTON'&&n.textContent.trim().startsWith(text))||(n.tagName==='LABEL'&&n.textContent.includes(text)));if(!el)throw new Error('Missing control '+text);el.scrollIntoView({block:'center',behavior:'instant'});await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);const r=el.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,hit=document.elementFromPoint(x,y);if(hit!==el&&!el.contains(hit))throw new Error('Occluded control '+text+' by '+hit?.textContent);return{x,y}})()`);
      await send("Input.dispatchMouseEvent", { type: "mousePressed", ...coordinates, button: "left", clickCount: 1 });
      await send("Input.dispatchMouseEvent", { type: "mouseReleased", ...coordinates, button: "left", clickCount: 1 }); await Bun.sleep(30);
    };
    const navigate = async (width = 1440, action: HousekeepingAction = "start") => {
      if (await read<boolean>("!!window.hkFixture")) await until("!document.querySelector('.yellow-next[aria-busy=true]')", "settled operation before new scenario");
      task = fixtureTask(action); condition = task.roomCondition; conditionStamp = task.roomUpdatedAt; outcomes.clear(); mode = "normal";
      await send("Emulation.setDeviceMetricsOverride", { width, height: 1100, deviceScaleFactor: 1, mobile: width < 600 });
      await send("Page.navigate", { url: `http://127.0.0.1:${server!.port}/p/${ids.property}/housekeeping` });
      await until("!!document.querySelector('.hk-floor-cube')", "actual App floor mount");
      expect(await read<boolean>("!!document.querySelector('.auth-workspace')&&!!document.querySelector('.operator-header')")).toBe(true);
      await read("sessionStorage.clear()"); // Test scenario reset only; never a product recovery action.
    };
    const select = async () => {
      // Current59 restored the floor beneath a real collapsed disclosure.
      // Open it with trusted input before exercising the unchanged legacy caller.
      if (baseline && await read<boolean>("!!document.querySelector('.hk-dashboard-floor:not([open])')")) await click("Floor and room view");
      await click("101"); await until("!!document.querySelector('.hk-floor-task-select')", "task selection visible");
      await click("Task 1"); await until("!!document.querySelector('.hk-floor-task-detail')", "selected task controls");
      await click(task.allowedActions[0] === "start" ? "Start cleaning" : task.allowedActions[0] === "complete" ? "Mark physically clean" : "Verify inspected");
      await until(baseline ? "!!document.querySelector('.housekeeping-action-proposal')" : "!!document.querySelector('.hk-task-confirm')", "confirmation"); };
    const confirm = async () => { await click(baseline ? "I confirm the physical housekeeping statement above." : "I confirm this staff declaration.");
      await click(baseline ? "Confirm housekeeping action" : "Confirm declaration"); };
    const screenshot = async (name: string) => { if (!/^[a-z0-9-]+$/.test(name)) throw new Error("Unsafe screenshot name");
      const result = await send<{ data: string }>("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
      await writeFile(resolve(proof, `${label}-${name}.png`), Buffer.from(result.data, "base64")); };
    await send("Page.enable"); await send("Runtime.enable");
    try { await body({ send, read, until, click, navigate, select, confirm, mode(value) { if(value==="foreign") {actor=ids.other;mode="normal";} else if(value==="original-actor") {actor=ids.actor;mode="normal";} else mode = value; }, gate() { gateState.release?.(); gateState.release = null; }, writes, reads, events, screenshot }); }
    catch (cause) {
      try { await screenshot("failure"); await writeFile(resolve(proof, `${label}-failure-dom.txt`), await read<string>("document.body.outerHTML+JSON.stringify(window.clickTargets)")); }
      catch (captureFailure) { errors.push(`Failure capture unavailable: ${String(captureFailure)}`); }
      throw cause;
    }
    expect(errors).toEqual([]);
    expect(await read<string[]>("window.hkFixture.errors")).toEqual([]);
  } finally {
    await writeFile(resolve(proof, `${label}-observations.json`), JSON.stringify({ ownedSynthetic: true, baselineCaller: baseline,
      substitution: "None: full actual App, actual AuthenticationGate and real auth-session source. Loopback synthetic native-shaped transport only; no database persistence proof", writes, reads, events, outcomes: [...outcomes.values()], errors, browserPid: chrome?.pid }, null, 2));
    gateState.release?.(); if(chrome) await terminateOwnedProcess(chrome); socket?.close(); server?.stop(true);
    const absolute = resolve(directory); if (!absolute.startsWith(resolve(tmpdir()) + sep) || !absolute.split(sep).at(-1)?.startsWith("yellow-housekeeping-app-owned-")) throw new Error("Cleanup containment failed");
    await rm(absolute, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    await writeFile(resolve(proof, `${label}-cleanup.json`), JSON.stringify({
      browserPid: chrome?.pid, browserExitCode: chrome?.exitCode, browserSignalCode: chrome?.signalCode,
      browserExitVerified: !chrome || chrome.exitCode !== null || typeof chrome.signalCode === "string",
      serverStopped: true, ownedTempRemoved: !existsSync(absolute), ownedProfileRemoved: !existsSync(profile),
    }, null, 2));
  }
}

const retained = "sessionStorage.getItem('yellow.housekeeping.sent.v1')";
const receipt = "!!document.querySelector('.hk-task-receipt')";
const settled = "!document.querySelector('.hk-task-confirm button[disabled]') || document.body.innerText.includes('response was interrupted')";
async function reconcile(browser: HkAppBrowser) {
  await browser.click("I confirm reconciliation of this retained command.");
  await browser.click("Reconcile same request");
}
async function reload(browser: HkAppBrowser) {
  const boot = await browser.read<string>("window.hkBootId");
  await browser.send("Page.reload");
  await browser.until(`window.hkBootId&&window.hkBootId!==${JSON.stringify(boot)}&&!!document.querySelector('.operator-header')`, "new authenticated App document");
}

test("full App: two lost verify responses retain exact request through history, reload, revoked and foreign grants", async () => {
  await withHousekeepingAppBrowser("recovery", async browser => {
    await browser.navigate(1440,"verify");
    // Use the real header to establish same-document history before sending.
    await browser.click("All workspaces");
    await browser.until("location.search.includes('workspace=ecosystem')", "real shell navigation");
    if(await browser.read<boolean>("document.querySelector('.operator-navigation button[aria-label=Housekeeping]').getAttribute('aria-expanded')==='false'")) await browser.click("Housekeeping");
    await browser.click("Cleaning & inspection");
    await browser.until("!!document.querySelector('.hk-floor-cube')", "return through actual shell");
    await browser.select(); browser.mode("lose-until-reconcile"); await browser.confirm();
    if(process.env.YELLOW_HK_APP_BASELINE === "1") {
      await browser.until("document.body.innerText.includes('task could not')||document.body.innerText.includes('404')||!document.querySelector('.housekeeping-action-proposal')", "old caller settles lost verification");
      expect(browser.writes).toHaveLength(2);
      expect(await browser.read<string | null>(retained),"Original full App must retain a sent command after both receipts are lost and detail GET returns 404").not.toBeNull();
      return;
    }
    await browser.until("document.body.innerText.includes('response was interrupted')", "first lost response");
    const saved = await browser.read<string>(retained); expect(saved).toBeTruthy();
    const first = {...browser.writes[0]!}; expect(browser.writes).toHaveLength(1);
    expect(await browser.read<unknown[]>("window.hkFixture.invalidations")).toEqual([]);
    await reconcile(browser); await browser.until("document.body.innerText.includes('response was interrupted')", "second lost response");
    expect(browser.writes).toHaveLength(2); expect(await browser.read<string | null>(retained)).toBe(saved);
    expect(browser.writes.every(write=>write.key===first.key&&write.body===first.body&&write.path===first.path)).toBe(true);
    const detail = `/api/v1/properties/${ids.property}/housekeeping/tasks/${ids.task}`;
    // Drawer selection and the unsent confirmation each read once; no sent retry rereads.
    expect(browser.reads.filter(path=>path===detail)).toHaveLength(2);
    expect(browser.events.slice(browser.events.indexOf(`POST ${first.path}`)+1).filter(event=>event===`GET ${detail}`)).toEqual([]);
    expect(await browser.read<number>(`fetch(${JSON.stringify(detail)},{headers:{authorization:'Bearer synthetic-test-observation'}}).then(r=>r.status)`)).toBe(404);
    const href=await browser.read<string>("location.href");
    const history=await browser.send<{currentIndex:number;entries:{id:number;url:string}[]}>("Page.getNavigationHistory");
    expect(history.currentIndex).toBeGreaterThan(0);
    await browser.send("Page.navigateToHistoryEntry",{entryId:history.entries[history.currentIndex-1]!.id});
    await browser.until(`location.href===${JSON.stringify(href)}`,"native browser Back restored by App lock");
    await browser.send("Input.dispatchKeyEvent",{type:"keyDown",key:"ArrowRight",code:"ArrowRight",windowsVirtualKeyCode:39,modifiers:1});
    await browser.send("Input.dispatchKeyEvent",{type:"keyUp",key:"ArrowRight",code:"ArrowRight",windowsVirtualKeyCode:39,modifiers:1});
    expect(await browser.read<string>("location.href")).toBe(href); expect(await browser.read<string | null>(retained)).toBe(saved);
    expect(await browser.read<boolean>("[...document.querySelectorAll('.operator-navigation button')].filter(b=>b.getAttribute('aria-label')==='Today').every(b=>b.disabled)")).toBe(true);
    await reload(browser); await browser.until("!!document.querySelector('.hk-task-confirm')","retained work after warned reload");
    expect(await browser.read<string | null>(retained)).toBe(saved); expect(await browser.read<boolean>("document.querySelector('.hk-task-confirm input').checked")).toBe(false);
    const beforeDenied=browser.writes.length; browser.mode("revoked"); await reconcile(browser);
    await browser.until("!!document.querySelector('.hk-task-locked')","fresh grant denial locks stale cached grant");
    expect(browser.writes).toHaveLength(beforeDenied); expect(await browser.read<string | null>(retained)).toBe(saved);
    browser.mode("normal"); await browser.read("window.hkFixture.restore()");
    await browser.until("!!document.querySelector('.hk-task-confirm')","same principal with current grant returns");
    browser.mode("foreign"); await reload(browser); await browser.until("!!document.querySelector('.hk-task-locked')","foreign principal quarantine");
    expect(await browser.read<string | null>(retained)).toBe(saved); expect(browser.writes).toHaveLength(beforeDenied);
    expect(await browser.read<string>("document.querySelector('.hk-task-workspace').innerText")).not.toContain("Room 101");
    browser.mode("original-actor"); await reload(browser); await browser.until("!!document.querySelector('.hk-task-confirm')","original account restored");
    const origin=await browser.read<string>("location.origin"), boot=await browser.read<string>("window.hkBootId");
    await browser.send("Page.navigate",{url:`${origin}/p/${ids.other}/housekeeping`});
    await browser.until(`window.hkBootId!==${JSON.stringify(boot)}&&!!document.querySelector('.hk-task-locked')`,"different granted property cannot adopt original command");
    expect(await browser.read<string | null>(retained)).toBe(saved); expect(browser.writes).toHaveLength(beforeDenied);
    await browser.send("Page.navigate",{url:`${origin}/p/${ids.property}/housekeeping`});
    await browser.until("!!document.querySelector('.hk-task-confirm')","exact property restores original command");
    await browser.until("!!document.querySelector('.hk-floor-cube')&&document.querySelector('.hk-floor-count').textContent.includes('condition list exhausted')", "restored floor finishes its layout before trusted reconciliation input");
    const beforeRetry=browser.events.length; await reconcile(browser); await browser.until(receipt,"native verified replay receipt");
    expect(browser.events.slice(beforeRetry).filter(e=>e.endsWith(detail))).toEqual([]);
    expect(browser.writes).toHaveLength(3); expect(browser.writes.at(-1)).toMatchObject({body:first.body,key:first.key,replay:true});
    expect(await browser.read<string | null>(retained)).toBeNull();
    expect(await browser.read<string>("document.querySelector('.hk-task-receipt').innerText")).toContain("verified · inspected · native replay");
    expect(await browser.read<string[][]>("window.hkFixture.invalidations.map(x=>x.queryKey)")).toEqual([["overwatch-arrival-cleaning",ids.property],["overwatch-check-in",ids.property]]);
    await browser.until("!document.querySelector('.yellow-next[aria-busy=true]')","verified result releases shell");
    await browser.screenshot("verified-replay");
  });
},120000);

test("full App: late session reply cannot settle intent; callback promise rejection cannot revoke a current native receipt",async()=>{
  await withHousekeepingAppBrowser("session",async browser=>{
    await browser.navigate(1440,"verify"); await browser.select(); browser.mode("gate"); await browser.confirm();
    for(let i=0;i<100&&browser.writes.length!==1;i++)await Bun.sleep(20); expect(browser.writes).toHaveLength(1);
    const saved=await browser.read<string>(retained); await browser.read("window.hkFixture.expire()");
    await browser.until("!!document.querySelector('.auth-workspace[inert]')","real auth gate locks expired session");
    expect(await browser.read<string | null>(retained)).toBe(saved); await browser.read("window.hkFixture.restore()"); browser.gate();
    await browser.until("!!document.querySelector('.hk-task-confirm')&&!document.querySelector('.auth-workspace[inert]')","real current session restores retained work");
    await Bun.sleep(80); expect(await browser.read<boolean>(receipt)).toBe(false); expect(await browser.read<string | null>(retained)).toBe(saved);
    expect(await browser.read<unknown[]>("window.hkFixture.invalidations")).toEqual([]);
    await browser.read("window.hkRejectInvalidation=true"); await reconcile(browser); await browser.until(receipt,"current native replay despite rejected read cache promises");
    expect(await browser.read<string | null>(retained)).toBeNull(); await Bun.sleep(30); expect(await browser.read<string[]>("window.hkFixture.errors")).toEqual([]);
    expect(await browser.read<string[][]>("window.hkFixture.invalidations.map(x=>x.queryKey)")).toEqual([["overwatch-arrival-cleaning",ids.property],["overwatch-check-in",ids.property]]);
    expect(browser.writes[1]).toMatchObject({key:browser.writes[0]!.key,body:browser.writes[0]!.body,replay:true});
    await browser.until("!document.querySelector('.yellow-next[aria-busy=true]')","current result unlocks");
  });
},70000);

test("full App: known receipt stays separate from failed floor read; selected drawer works at 375px with doubled text and keyboard",async()=>{
  await withHousekeepingAppBrowser("mobile",async browser=>{
    await browser.navigate(375,"start");
    expect(await browser.read<number>("document.documentElement.scrollWidth-innerWidth")).toBeLessThanOrEqual(1);
    await browser.select();
    await browser.read("[...document.querySelectorAll('.hk-task-workspace, .hk-task-workspace *')].map(e=>[e,parseFloat(getComputedStyle(e).fontSize)*2]).forEach(([e,size])=>e.style.fontSize=size+'px')");
    expect(await browser.read<number>("document.documentElement.scrollWidth-innerWidth")).toBeLessThanOrEqual(1);
    expect(await browser.read<boolean>("document.querySelector('.hk-floor-drawer').getBoundingClientRect().width>0")).toBe(true);
    expect(await browser.read<number>("document.querySelectorAll('.hk-floor-workbench').length")).toBe(1);
    await browser.send("Input.dispatchKeyEvent",{type:"keyDown",key:"Tab",code:"Tab",windowsVirtualKeyCode:9});
    await browser.send("Input.dispatchKeyEvent",{type:"keyUp",key:"Tab",code:"Tab",windowsVirtualKeyCode:9});
    expect(await browser.read<boolean>("document.activeElement!==document.body")).toBe(true);
    await browser.screenshot("doubled-text-confirm"); browser.mode("after-read-loss"); await browser.confirm();
    await browser.until("document.body.innerText.includes('current floor refresh failed')","read failure does not deny known native operation");
    expect(await browser.read<boolean>(receipt)).toBe(true); expect(await browser.read<string | null>(retained)).toBeNull(); expect(browser.writes).toHaveLength(1);
    browser.mode("normal"); await browser.click("Retry floor read"); await browser.until("document.body.innerText.includes('Current observed room condition: dirty')","read-only recovery");
    expect(browser.writes).toHaveLength(1); expect(await browser.read<boolean>("window.trustedClicks.every(Boolean)")).toBe(true);
    await browser.until("!document.querySelector('.yellow-next[aria-busy=true]')","floor read settled"); await browser.screenshot("native-receipt");
  });
},70000);

test("full App: actual assistant request mounts the same guarded housekeeping workspace",async()=>{
  await withHousekeepingAppBrowser("assistant",async browser=>{
    await browser.navigate(1440,"complete"); await browser.click("All workspaces");
    await browser.until("location.search.includes('workspace=ecosystem')","actual ecosystem shell");
    // Existing fixed auth controls overlap the launcher's center; preserve that
    // baseline defect and use its real keyboard path without moving either UI.
    await browser.read("document.querySelector('.yellow-launch').focus()");
    await browser.send("Input.dispatchKeyEvent",{type:"keyDown",key:" ",code:"Space",windowsVirtualKeyCode:32,text:" "});
    await browser.send("Input.dispatchKeyEvent",{type:"keyUp",key:" ",code:"Space",windowsVirtualKeyCode:32});
    await browser.until("!!document.querySelector('[aria-label=\"Ask Yellow\"]')","actual Yellow command input");
    await browser.read("document.querySelector('[aria-label=\"Ask Yellow\"]').focus()");
    await browser.send("Input.insertText",{text:"show housekeeping"}); await browser.click("Send request to Yellow");
    await browser.until("!!document.querySelector('.yellow-inline-workspace .hk-floor-cube')","actual inline App mount");
    await browser.click("Collapse navigation");
    expect(await browser.read<number>("document.querySelectorAll('.hk-task-workspace').length")).toBe(1);
    await browser.select(); expect(browser.writes).toHaveLength(0); await browser.screenshot("inline-confirm");
    await browser.confirm(); await browser.until(receipt,"inline native complete receipt");
    expect(browser.writes).toHaveLength(1); expect(JSON.parse(browser.writes[0]!.body).action).toBe("complete");
    expect(await browser.read<string>("document.querySelector('.hk-task-receipt').innerText")).toContain("done · clean");
    expect(await browser.read<string>("document.querySelector('.hk-task-receipt').innerText")).not.toContain("inspected");
    expect(await browser.read<string[][]>("window.hkFixture.invalidations.map(x=>x.queryKey)")).toEqual([["overwatch-arrival-cleaning",ids.property],["overwatch-check-in",ids.property]]);
    await browser.until("!document.querySelector('.yellow-next[aria-busy=true]')","inline lifecycle released");
    await browser.screenshot("inline-receipt");
  });
},70000);
