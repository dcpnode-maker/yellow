import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, sep } from "node:path";
import { resolveChromiumPath } from "./helpers/chromium-path";
import { fixtureTask, ids, stamp } from "./housekeeping-task-client.test";
import type { HousekeepingAction } from "../frontend/yellow/src/housekeeping-floor-model";

type Send = <T = unknown>(method: string, params?: Record<string, unknown>) => Promise<T>;
type Write = { path: string; key: string; body: string; replay: boolean };
export type HkBrowser = { send: Send; read: <T>(expression: string) => Promise<T>; until: (expression: string, label: string) => Promise<void>;
  click: (text: string) => Promise<void>; navigate: (width?: number, action?: HousekeepingAction) => Promise<void>;
  select: () => Promise<void>; confirm: () => Promise<void>; mode: (value: string) => void; gate: () => void;
  writes: Write[]; reads: string[]; events: string[]; screenshot: (name: string) => Promise<void> };
const repository = resolve(import.meta.dir, "..");
const json = (value: unknown, status = 200, headers: Record<string, string> = {}) => Response.json(value, { status, headers });

export async function withHousekeepingBrowser(label: string, body: (browser: HkBrowser) => Promise<void>): Promise<void> {
  const executable = resolveChromiumPath(); if (!executable) throw new Error("Owned Chromium required; browser proof is never skipped");
  const directory = await mkdtemp(resolve(tmpdir(), "yellow-housekeeping-owned-")), profile = resolve(directory, "profile");
  const proof = process.env.YELLOW_HK_PROOF_DIR ? resolve(process.env.YELLOW_HK_PROOF_DIR) : resolve(directory, "proof");
  await mkdir(proof, { recursive: true });
  const original = process.env.YELLOW_HK_ORIGINAL === "1";
  let server: ReturnType<typeof Bun.serve> | undefined, chrome: ReturnType<typeof Bun.spawn> | undefined, socket: WebSocket | undefined;
  let mode = "normal", task = fixtureTask(), condition = "dirty", conditionStamp = stamp;
  const gateState: { release: (() => void) | null } = { release: null };
  const writes: Write[] = [], reads: string[] = [], events: string[] = [], errors: string[] = [];
  const outcomes = new Map<string, { path: string; body: string; value: Record<string, unknown> }>();
  try {
    const entry = resolve(directory, "entry.tsx");
    await writeFile(entry, `import React from ${JSON.stringify(resolve(repository, "node_modules/react"))};
import {createRoot} from ${JSON.stringify(resolve(repository, "node_modules/react-dom/client"))};
import ${JSON.stringify(resolve(repository, "frontend/yellow/src/styles.css"))};
import ${JSON.stringify(resolve(repository, "frontend/yellow/src/ui/reference-theme.css"))};
const listeners=new Set();let snapshot={status:'authenticated',principal:{actorId:'${ids.actor}',tenantId:'${ids.tenant}',displayName:'Synthetic staff'},properties:[{id:'${ids.property}',name:'Synthetic property',timezone:'UTC'}]};
const rawFetch=window.fetch.bind(window);window.fetch=async(...args)=>{const r=await rawFetch(...args);if(r.headers.get('x-synthetic-drop')==='true')throw new Error('Synthetic response lost after write');return r};
const auth={getSnapshot:()=>snapshot,session:async()=>{if(snapshot.status!=='authenticated')throw new Error('expired');return 'synthetic-memory-only'},subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn)},signIn:async()=>snapshot,bootstrap:async()=>snapshot,logout:async()=>{},grantedProperties:async()=>{const r=await fetch('/api/v1/me/properties',{headers:{authorization:'Bearer synthetic-memory-only'}});if(!r.ok)throw Object.assign(new Error('denied'),{status:r.status});return (await r.json()).properties}};
const root=createRoot(document.getElementById('root'));let property='${ids.property}',mounted=true;const busy=[],verified=[];
${original ? `const {HousekeepingWorkspace}=await import(${JSON.stringify(resolve(repository, "frontend/yellow/src/App.tsx"))});const {reactAuthSession}=await import(${JSON.stringify(resolve(repository, "frontend/yellow/src/auth-session.ts"))});await reactAuthSession.bootstrap('${ids.property}');const {QueryClient,QueryClientProvider}=await import(${JSON.stringify(resolve(repository, "node_modules/@tanstack/react-query/build/modern/index.js"))});const queryClient=new QueryClient({defaultOptions:{queries:{retry:false}}});` : `const {HousekeepingTaskWorkspace}=await import(${JSON.stringify(resolve(repository, "frontend/yellow/src/workspaces/HousekeepingTaskWorkspace.tsx"))});`}
const render=()=>root.render(React.createElement(React.StrictMode,null,React.createElement('div',{className:'yellow-next'+(new URLSearchParams(location.search).has('ai')?' yellow-ai-active':''),style:{padding:'16px'}},mounted?${original ? "React.createElement(QueryClientProvider,{client:queryClient},React.createElement(HousekeepingWorkspace,{timezone:'UTC',onLifecycleBusyChange:v=>busy.push(v)}))" : "React.createElement(HousekeepingTaskWorkspace,{propertyId:property,timezone:'UTC',auth,onLifecycleBusyChange:v=>busy.push(v),onNativeReceipt:r=>{verified.push(r);if(window.hkThrowCallback)throw new Error('Synthetic callback error')}})"}:React.createElement('p',null,'Caller unmounted'))));
const notify=()=>listeners.forEach(fn=>fn());window.hkFixture={busy,verified,expire(){snapshot={...snapshot,status:'expired'};notify()},restore(){snapshot={...snapshot,status:'authenticated',principal:{...snapshot.principal,actorId:'${ids.actor}'}};notify()},foreign(){snapshot={...snapshot,principal:{...snapshot.principal,actorId:'${ids.other}'}};notify()},property(){property='${ids.other}';render()},restoreProperty(){property='${ids.property}';render()},unmount(){mounted=false;render()}};
window.hkBootId=crypto.randomUUID();window.trustedClicks=[];window.clickTargets=[];document.addEventListener('click',e=>{window.trustedClicks.push(e.isTrusted);window.clickTargets.push(e.target.textContent)});render();`);
    // A distinct compiler process avoids sharing Bun's build cache with other mounted-fixture suites.
    const builderPath = resolve(directory, "build.ts");
    await writeFile(builderPath, `import {readFile} from 'node:fs/promises';
const build=await Bun.build({entrypoints:[${JSON.stringify(entry)}],outdir:${JSON.stringify(resolve(directory, "build"))},target:'browser',format:'esm',define:{'process.env.NODE_ENV':'"production"'},plugins:${original ? `[{name:'original-caller-export-only',setup(builder){builder.onLoad({filter:/[\\\\/]App\\.tsx$/},async args=>{const source=await readFile(args.path,'utf8'),marker='function HousekeepingWorkspace({';if(source.split(marker).length!==2)throw new Error('Exact original caller export substitution failed');return{contents:source.replace(marker,'export '+marker),loader:'tsx'}})}}]` : "[]"}});
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
        return new Response('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Owned synthetic housekeeping caller</title><link rel="stylesheet" href="/entry.css"><div id="root"></div><script type="module" src="/entry.js"></script></html>', { headers: { "content-type": "text/html" } });
      }
      if (path === "/api/v1/auth/browser/resume") {
        const payload = Buffer.from(JSON.stringify({ sub: ids.actor, tid: ids.tenant })).toString("base64url");
        return json({ accessToken: `synthetic.${payload}.signature`, tokenType: "Bearer", expiresInSeconds: 900, user: { id: ids.actor, displayName: "Synthetic staff" } });
      }
      if (!request.headers.get("authorization")?.startsWith("Bearer ")) return json({}, 401);
      events.push(`${request.method} ${path}`);
      if (request.method === "GET") {
        reads.push(path);
        if (path === "/api/v1/me/properties") return json({ properties: [{ id: ids.property, name: "Synthetic property", timezone: "UTC" }] });
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
      return json(value, 200, { "idempotency-replayed": "false", ...(lose ? { "x-synthetic-drop": "true" } : {}) });
    } });
    chrome = Bun.spawn([executable, "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
      "--remote-debugging-address=127.0.0.1", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { stdout: "ignore", stderr: "ignore", windowsHide: true });
    let port = "";
    for (let count = 0; count < 500 && !port; count++) { try { port = (await readFile(resolve(profile, "DevToolsActivePort"), "utf8")).split(/\r?\n/)[0]?.trim() ?? ""; }
      catch (cause) { if (!["EBUSY", "ENOENT"].includes(String((cause as { code?: unknown }).code))) throw cause; } await Bun.sleep(20); }
    if (!port) throw new Error("Owned browser debugging receipt missing");
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json() as { type: string; webSocketDebuggerUrl: string }[];
    const target = targets.find(t => t.type === "page"); if (!target) throw new Error("Owned page missing");
    socket = new WebSocket(target.webSocketDebuggerUrl); await new Promise<void>((resolveOpen, reject) => { socket!.onopen = () => resolveOpen(); socket!.onerror = () => reject(new Error("Owned socket failed")); });
    let counter = 0, permitReload = false;
    const callbacks = new Map<number, { resolve(value: unknown): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> }>();
    socket.onmessage = event => { const data = JSON.parse(String(event.data)); if (data.method === "Runtime.exceptionThrown") errors.push(JSON.stringify(data.params));
      if (data.method === "Page.javascriptDialogOpening" && data.params.type === "beforeunload" && permitReload) {
        permitReload = false; void send("Page.handleJavaScriptDialog", { accept: true });
      }
      if (data.id) { const pending = callbacks.get(data.id); if (!pending) return; clearTimeout(pending.timer); callbacks.delete(data.id);
        if (data.error) pending.reject(new Error(data.error.message)); else pending.resolve(data.result); } };
    const send: Send = <T>(method: string, params = {}) => new Promise<T>((resolveResult, reject) => {
      if (method === "Page.reload") permitReload = true; // Explicit test approval of a warned reload.
      const id = ++counter, timer = setTimeout(() => { callbacks.delete(id); reject(new Error(`CDP deadline ${method}`)); }, 12000);
      callbacks.set(id, { resolve: value => resolveResult(value as T), reject, timer }); socket!.send(JSON.stringify({ id, method, params }));
    });
    const read = async <T>(expression: string): Promise<T> => { const result = await send<{ result?: { value?: T }; exceptionDetails?: unknown }>("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(`Read expression failed: ${expression}; ${JSON.stringify(result.exceptionDetails)}`); return result.result?.value as T; };
    const until = async (expression: string, label: string) => { for (let i = 0; i < 400; i++) { if (await read<boolean>(expression)) return; await Bun.sleep(25); }
      throw new Error(`Timed out ${label}: ${await read<string>("document.body.innerText")}; errors ${JSON.stringify(errors)}`); };
    const click = async (text: string) => {
      const coordinates = await read<{ x: number; y: number }>(`(async()=>{const text=${JSON.stringify(text)},el=[...document.querySelectorAll('button,label,summary')].find(n=>n.textContent.trim()===text||(n.tagName==='BUTTON'&&n.textContent.trim().startsWith(text))||(n.tagName==='LABEL'&&n.textContent.includes(text)));if(!el)throw new Error('Missing control '+text);el.scrollIntoView({block:'center',behavior:'instant'});await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);const r=el.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,hit=document.elementFromPoint(x,y);if(hit!==el&&!el.contains(hit))throw new Error('Occluded control '+text+' by '+hit?.textContent);return{x,y}})()`);
      await send("Input.dispatchMouseEvent", { type: "mousePressed", ...coordinates, button: "left", clickCount: 1 });
      await send("Input.dispatchMouseEvent", { type: "mouseReleased", ...coordinates, button: "left", clickCount: 1 }); await Bun.sleep(30);
    };
    const navigate = async (width = 1440, action: HousekeepingAction = "start") => {
      if (await read<boolean>("!!window.hkFixture")) await until("window.hkFixture.busy.at(-1)!==true", "settled operation before new scenario");
      task = fixtureTask(action); condition = task.roomCondition; conditionStamp = task.roomUpdatedAt; outcomes.clear(); mode = "normal";
      await send("Emulation.setDeviceMetricsOverride", { width, height: 1100, deviceScaleFactor: 1, mobile: width < 600 });
      await send("Page.navigate", { url: `http://127.0.0.1:${server!.port}/p/${ids.property}/housekeeping` });
      await until("!!document.querySelector('.hk-floor-cube')", "actual floor mount");
      await read("sessionStorage.clear()"); // Test scenario reset only; never a product recovery action.
    };
    const select = async () => { await click("101"); await until("!!document.querySelector('.hk-floor-task-select')", "task selection visible");
      await click("Task 1"); await until("!!document.querySelector('.hk-floor-task-detail')", "selected task controls");
      await click(task.allowedActions[0] === "start" ? "Start cleaning" : task.allowedActions[0] === "complete" ? "Mark physically clean" : "Verify inspected");
      await until(original ? "!!document.querySelector('.housekeeping-action-proposal')" : "!!document.querySelector('.hk-task-confirm')", "confirmation"); };
    const confirm = async () => { await click(original ? "I confirm the physical housekeeping statement above." : "I confirm this staff declaration.");
      await click(original ? "Confirm housekeeping action" : "Confirm declaration"); };
    const screenshot = async (name: string) => { if (!/^[a-z0-9-]+$/.test(name)) throw new Error("Unsafe screenshot name");
      const result = await send<{ data: string }>("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
      await writeFile(resolve(proof, `${label}-${name}.png`), Buffer.from(result.data, "base64")); };
    await send("Page.enable"); await send("Runtime.enable");
    try { await body({ send, read, until, click, navigate, select, confirm, mode(value) { mode = value; }, gate() { gateState.release?.(); gateState.release = null; }, writes, reads, events, screenshot }); }
    catch (cause) {
      try { await screenshot("failure"); await writeFile(resolve(proof, `${label}-failure-dom.txt`), await read<string>("document.body.outerHTML+JSON.stringify(window.clickTargets)")); }
      catch (captureFailure) { errors.push(`Failure capture unavailable: ${String(captureFailure)}`); }
      throw cause;
    }
    expect(errors).toEqual([]);
  } finally {
    await writeFile(resolve(proof, `${label}-observations.json`), JSON.stringify({ ownedSynthetic: true, originalCaller: original,
      substitution: original ? "Only add export to original function HousekeepingWorkspace; unchanged body and real auth bootstrap" : "Actual new component mounted directly; no App substitution or production wiring", writes, reads, events, outcomes: [...outcomes.values()], errors, browserPid: chrome?.pid }, null, 2));
    gateState.release?.(); socket?.close(); if (chrome?.exitCode === null) chrome.kill(); await chrome?.exited.catch(() => undefined); server?.stop(true);
    const absolute = resolve(directory); if (!absolute.startsWith(resolve(tmpdir()) + sep) || !absolute.split(sep).at(-1)?.startsWith("yellow-housekeeping-owned-")) throw new Error("Cleanup containment failed");
    await rm(absolute, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
}

test("actual housekeeping floor: desktop/narrow/enlarged-text keyboard, neutral/AI tokens and progressive declarations", async () => {
  await withHousekeepingBrowser("visual", async browser => {
    for (const width of [375, 1440]) for (const atmosphere of [false, true]) {
      await browser.navigate(width); await browser.read(`document.querySelector('.yellow-next').classList.toggle('yellow-ai-active',${atmosphere});document.documentElement.style.fontSize='20px'`);
      await browser.select();
      expect(await browser.read<number>("Math.max(0,document.documentElement.scrollWidth-innerWidth)")).toBe(0);
      expect(await browser.read<number>("document.querySelectorAll('.hk-floor-workbench').length")).toBe(1);
      expect(await browser.read<boolean>("[...document.querySelectorAll('.hk-task-workspace button')].every(b=>b.getBoundingClientRect().height>=44)")).toBe(true);
      expect(await browser.read<boolean>("[...document.querySelectorAll('.hk-task-confirm details')].every(n=>!n.open)")).toBe(true);
      await browser.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
      await browser.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
      expect(await browser.read<boolean>("document.activeElement!==document.body")).toBe(true);
      expect(await browser.read<string>("document.body.innerText")).toContain("ETA unavailable");
      await browser.screenshot(`${width}-${atmosphere ? "ai" : "neutral"}-confirm`); await browser.confirm();
      await browser.until("!!document.querySelector('.hk-task-receipt')", "verified start receipt");
      expect(await browser.read<boolean>("window.trustedClicks.length>0&&window.trustedClicks.every(Boolean)")).toBe(true);
      expect(await browser.read<string>("document.body.innerText")).not.toContain("synthetic-memory-only");
    }
  });
}, 120000);
