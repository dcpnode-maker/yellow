import { expect, test } from "bun:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { mkdtemp, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { HousekeepingTaskDashboard } from "../frontend/yellow/src/workspaces/HousekeepingTaskDashboard";
import { HousekeepingTaskWorkspace } from "../frontend/yellow/src/workspaces/HousekeepingTaskWorkspace";
import type { AuthSessionAccess, AuthSnapshot } from "../frontend/yellow/src/auth-session";
import type { RecoveryStorage } from "../frontend/yellow/src/workspaces/native-housekeeping-task-client";
import type { HousekeepingCondition, HousekeepingTask } from "../frontend/yellow/src/yellow-api";
import { resolveChromiumPath } from "./helpers/chromium-path";
import { fetchJsonBounded, terminateOwnedProcess } from "./helpers/owned-cdp-proof-lifecycle";

const task: HousekeepingTask = { taskId: "task-one", spaceId: "room-one", spaceCode: "101", floor: "1", roomCondition: "dirty", roomUpdatedAt: "2026-10-04T00:00:00Z", taskStatus: "assigned", priority: 0, assigned: true, dueAt: null, completedAt: null, allowedActions: ["start"] };
const rooms: readonly HousekeepingCondition[] = [{ spaceId: task.spaceId, code: task.spaceCode, floor: "1", condition: "dirty", updatedAt: task.roomUpdatedAt }];
const actionLabel = (action: string) => `Prepare ${action}`;

test("loaded counts, semantic task columns, safe strings and empty truth render from returned evidence", () => {
  const html = renderToString(createElement(HousekeepingTaskDashboard, { rooms, tasks: [{ ...task, spaceCode: '<img src=x onerror="alert(1)">' }], disabled: false, actionLabel, onPrepare() {} })).replaceAll("<!-- -->", "");
  expect(html).toContain("rooms · loaded");
  expect(html).toContain("dirty · loaded");
  expect(html).toContain("1 of 1 loaded tasks");
  expect(html).toContain("<table>");
  expect(html).toContain('scope="row"');
  expect(html).toContain("&lt;img");
  expect(html).not.toContain("<img");
  expect(html).toContain("Assignment");
  const empty = renderToString(createElement(HousekeepingTaskDashboard, { rooms: [], tasks: [], disabled: false, actionLabel, onPrepare() {} })).replaceAll("<!-- -->", "");
  expect(empty).toContain("0 of 0 loaded tasks");
  expect(empty).toContain("No current tasks are listed.");
  expect(empty).not.toContain("Prepare start");
});

const propertyId = "00000000-0000-4000-8000-000000000001";
const principal = { actorId: "00000000-0000-4000-8000-000000000002", tenantId: "00000000-0000-4000-8000-000000000003", displayName: "Synthetic operator" };
const granted = [{ id: propertyId, name: "Synthetic property", timezone: "UTC" }];

function makeAuth(snapshot: AuthSnapshot) {
  let reads = 0, sideEffects = 0;
  const auth: AuthSessionAccess = {
    session: async () => { sideEffects++; throw new Error("unexpected session token read"); },
    signIn: async () => { sideEffects++; throw new Error("unexpected sign in"); },
    bootstrap: async () => { sideEffects++; throw new Error("unexpected bootstrap"); },
    logout: async () => { sideEffects++; throw new Error("unexpected logout"); },
    grantedProperties: async () => { sideEffects++; throw new Error("unexpected grants request"); },
    getSnapshot: () => { reads++; return snapshot; },
    subscribe: () => () => {},
  };
  return { auth, reads: () => reads, sideEffects: () => sideEffects };
}

function makeRecovery(raw: string | null = null) {
  let writes = 0, reads = 0;
  const recovery: RecoveryStorage = {
    getItem: () => { reads++; return raw; },
    setItem: () => { writes++; throw new Error("unexpected recovery write"); },
    removeItem: () => { writes++; throw new Error("unexpected recovery removal"); },
  };
  return { recovery, reads: () => reads, writes: () => writes };
}

const renderOwner = (snapshot: AuthSnapshot, recoveryRaw: string | null = null) => {
  const session = makeAuth(snapshot), storage = makeRecovery(recoveryRaw);
  let transportCalls = 0, callbacks = 0;
  const html = renderToString(createElement(HousekeepingTaskWorkspace, {
    propertyId, timezone: "UTC", auth: session.auth, recoveryStorage: storage.recovery,
    transport: async () => { transportCalls++; throw new Error("unexpected network request"); },
    onLifecycleBusyChange: () => { callbacks++; }, onNativeReceipt: () => { callbacks++; },
  })).replaceAll("<!-- -->", "");
  return { html, authReads: session.reads(), authSideEffects: session.sideEffects(), storageReads: storage.reads(), storageWrites: storage.writes(), transportCalls, callbacks };
};

const classCount = (html: string, token: string) => [...html.matchAll(/class="([^"]+)"/g)].filter(match => match[1]!.split(/\s+/).includes(token)).length;
const filterCount = (html: string) => (html.match(/<select\b/g) ?? []).length + (html.match(/<input[^>]*type="search"/g) ?? []).length;
const expectNoOperationalSurface = (html: string) => {
  expect(classCount(html, "hk-task-dashboard")).toBe(0);
  expect(classCount(html, "hk-floor-workbench")).toBe(0);
  expect(classCount(html, "hk-floor-cube")).toBe(0);
  expect(classCount(html, "hk-task-confirm")).toBe(0);
  expect(classCount(html, "hk-task-receipt")).toBe(0);
  expect(classCount(html, "hk-floor-drawer")).toBe(0);
  expect(html).not.toContain("<tbody>");
};

const dashboardHtml = (options: Partial<{
  rooms: readonly HousekeepingCondition[];
  tasks: readonly HousekeepingTask[];
  disabled: boolean;
  showSummary: boolean;
  evidenceState: "current" | "loading" | "stale" | "unavailable";
}> = {}) => renderToString(createElement(HousekeepingTaskDashboard, {
  rooms: [], tasks: [], disabled: false, showSummary: false, actionLabel, onPrepare() {}, ...options,
})).replaceAll("<!-- -->", "");

test("actual housekeeping owner SSR shows authorized initial loading and fails closed for locked states", () => {
  const authenticated: AuthSnapshot = { status: "authenticated", principal, properties: granted };
  const loading = renderOwner(authenticated);
  expect(loading.html).toContain("Loading room conditions");
  expect(loading.html).toContain("Loading current task evidence");
  expect(loading.html).toContain("Room condition coverage and current tasks have not been verified.");
  expect(classCount(loading.html, "hk-task-workspace")).toBe(1);
  expect(classCount(loading.html, "hk-floor-workbench")).toBe(1);
  expect(classCount(loading.html, "hk-task-dashboard")).toBe(1);
  expect(filterCount(loading.html)).toBe(6);
  expect(loading.html).not.toContain("0 of 0 loaded tasks");
  expect(loading.html).not.toContain("No current tasks are listed.");
  expect(loading.html).not.toContain("<tbody>");
  expect(classCount(loading.html, "hk-floor-cube")).toBe(0);
  expect(classCount(loading.html, "hk-task-confirm")).toBe(0);
  expect(classCount(loading.html, "hk-task-receipt")).toBe(0);
  expect(loading.html).not.toMatch(/class="housekeeping-task-action"/);
  expect(loading.authReads).toBeGreaterThan(0);
  expect(loading.authSideEffects).toBe(0);
  expect(loading.storageReads).toBe(1);
  expect(loading.storageWrites).toBe(0);
  expect(loading.transportCalls).toBe(0);
  expect(loading.callbacks).toBe(0);

  const snapshots: readonly AuthSnapshot[] = [
    { status: "anonymous", principal: null, properties: [] },
    { status: "expired", principal, properties: granted },
    { status: "authenticated", principal, properties: [{ id: "00000000-0000-4000-8000-000000000009", name: "Other property", timezone: "UTC" }] },
  ];
  for (const snapshot of snapshots) {
    const result = renderOwner(snapshot);
    expect(result.html).toContain("Housekeeping access locked");
    expectNoOperationalSurface(result.html);
    expect(result.authSideEffects).toBe(0);
    expect(result.storageWrites).toBe(0);
    expect(result.transportCalls).toBe(0);
    expect(result.callbacks).toBe(0);
  }
  const quarantined = renderOwner(authenticated, "{");
  expect(quarantined.html).toContain("Housekeeping access locked");
  expectNoOperationalSurface(quarantined.html);
  expect(quarantined.storageReads).toBe(1);
  expect(quarantined.storageWrites).toBe(0);
  expect(quarantined.transportCalls).toBe(0);
  expect(quarantined.callbacks).toBe(0);
});

test("dashboard presentation distinguishes loading, unavailable, stale, current and verified empty evidence", () => {
  for (const state of ["loading", "unavailable"] as const) {
    const html = dashboardHtml({ evidenceState: state });
    expect(classCount(html, "hk-task-dashboard")).toBe(1);
    expect(filterCount(html)).toBe(6);
    expect(html).toContain(state === "loading" ? "Loading current task evidence" : "Current task evidence is unavailable.");
    expect(html).not.toContain("0 of 0 loaded tasks");
    expect(html).not.toContain("No current tasks are listed.");
    expect(html).not.toContain("<tbody>");
    expect(html).not.toMatch(/class="housekeeping-task-action"/);
    expect(classCount(html, "hk-dashboard-summary")).toBe(0);
  }

  const stale = dashboardHtml({ rooms, tasks: [task], evidenceState: "stale", disabled: false });
  expect(stale).toContain("Previously loaded evidence may be stale.");
  expect(stale).toContain('data-task-id="task-one"');
  expect(stale).toContain("1 of 1 loaded tasks");
  expect(stale).toMatch(/class="housekeeping-task-action"[^>]*disabled/);
  expect(stale).not.toContain("verified availability");

  const current = dashboardHtml({ rooms, tasks: [task], evidenceState: "current" });
  expect(current).toContain('data-task-id="task-one"');
  expect(current).toContain(">101</th>");
  expect(current).toContain("1 of 1 loaded tasks");
  expect((current.match(/class="housekeeping-task-action"/g) ?? []).length).toBe(1);
  expect(current).toMatch(/class="housekeeping-task-action"[^>]*>Prepare start<\/button>/);
  const currentDisabled = dashboardHtml({ rooms, tasks: [task], evidenceState: "current", disabled: true });
  expect(currentDisabled).toMatch(/class="housekeeping-task-action"[^>]*disabled/);

  const verifiedEmpty = dashboardHtml({ evidenceState: "current" });
  expect(verifiedEmpty).toContain("0 of 0 loaded tasks");
  expect(verifiedEmpty).toContain("No current tasks are listed.");
  expect(verifiedEmpty).not.toContain("Current task evidence is unavailable.");
});

test("mounted task table combines returned filters, forwards exact intent and respects disabled/empty states", async () => {
  const chrome = resolveChromiumPath();
  if (!chrome) throw new Error("Installed Chromium is required for dashboard proof");
  const root = resolve(import.meta.dir, "..");
  const proof = await mkdtemp(resolve(root, ".hk-dashboard-proof-"));
  const entry = resolve(proof, "fixture.tsx");
  const dashboard = resolve(root, "frontend/yellow/src/workspaces/HousekeepingTaskDashboard.tsx");
  await writeFile(entry, `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {HousekeepingTaskDashboard} from ${JSON.stringify(dashboard)};
import ${JSON.stringify(resolve(root, "frontend/yellow/src/styles.css"))};
import ${JSON.stringify(resolve(root, "frontend/yellow/src/ui/reference-theme.css"))};
const base=${JSON.stringify(task)}, rooms=${JSON.stringify(rooms)};
const rows=[base,{...base,taskId:'task-two',spaceId:'room-two',spaceCode:'202',floor:'2',taskStatus:'in_progress',roomCondition:'pickup',priority:3,assigned:false,allowedActions:['complete']},{...base,taskId:'task-three',spaceId:'room-three',spaceCode:'303',floor:null,taskStatus:'done',roomCondition:'clean',priority:2,allowedActions:['verify']},{...base,taskId:'task-four',spaceId:'room-four',spaceCode:'404',floor:'missing',taskStatus:'verified',roomCondition:'inspected',priority:4,allowedActions:[]}];
const checks=[],prepares=[];const root=createRoot(document.getElementById('root'));
const assert=(ok,message)=>{if(!ok)throw Error(message)};
const tick=()=>new Promise(resolve=>setTimeout(resolve,15));
const render=(props={})=>flushSync(()=>root.render(<div className="yellow-next"><main className="reservation-workspace"><h1>Housekeeping</h1><HousekeepingTaskDashboard rooms={rooms} tasks={rows} disabled={false} actionLabel={action=>'Prepare '+action} onPrepare={(task,action)=>prepares.push({task,action})} {...props}/></main></div>));
const ids=()=>[...document.querySelectorAll('tbody tr')].map(node=>node.dataset.taskId);
const field=text=>[...document.querySelectorAll('label')].find(node=>node.firstChild.textContent===text)?.querySelector('select,input');
const set=async(name,value)=>{const node=field(name);assert(node,'field '+name);Object.getOwnPropertyDescriptor(node instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(node,value);node.dispatchEvent(new Event(node instanceof HTMLSelectElement?'change':'input',{bubbles:true}));await tick()};
const clear=async()=>{[...document.querySelectorAll('button')].find(node=>node.textContent==='Clear filters').click();await tick()};
(async()=>{
 render();assert(ids().join(',')==='task-one,task-two,task-three,task-four','all returned rows');assert(document.querySelectorAll('table').length===1,'one table');checks.push('initial rows and single semantic table');
 await set('Task status','in_progress');assert(ids().join(',')==='task-two','status filters actual tbody');checks.push('status filter');await clear();
 await set('Room condition','clean');assert(ids().join(',')==='task-three','condition filters actual tbody');checks.push('condition filter');await clear();
 await set('Floor','floor:2');assert(ids().join(',')==='task-two','floor filters actual tbody');checks.push('floor filter');await clear();
 await set('Floor','missing');assert(ids().join(',')==='task-three','null floor distinct');await set('Floor','floor:missing');assert(ids().join(',')==='task-four','actual string distinct');checks.push('null floor and literal collision isolated');await clear();
 await set('Assignment','false');assert(ids().join(',')==='task-two','unassigned filter');checks.push('assignment filter');await clear();
 await set('Priority','0');assert(ids().join(',')==='task-one','zero priority filters actual tbody');checks.push('actual priority including zero');await clear();
 await set('Search loaded tasks',' ROOM-TWO ');assert(ids().join(',')==='task-two','search returned space ID');checks.push('trimmed case insensitive field search');await clear();
 await set('Task status','in_progress');await set('Floor','floor:2');await set('Assignment','false');await set('Priority','3');await set('Search loaded tasks','202');assert(ids().join(',')==='task-two','combined filters');checks.push('combined filter conjunction');
 document.querySelector('tbody button').click();assert(prepares.length===1&&prepares[0].task===rows[1]&&prepares[0].action==='complete','exact object callback');checks.push('exact task identity and allowed action callback');
 render({disabled:true});assert(document.querySelector('tbody button').disabled,'busy disabled');document.querySelector('tbody button').click();assert(prepares.length===1,'disabled cannot prepare');checks.push('busy action fence');render();
 await set('Room condition','clean');assert(ids().length===0&&document.body.textContent.includes('No loaded tasks match'),'combined empty result');assert(!document.body.textContent.includes('No current tasks are listed.'),'match empty distinct');checks.push('filtered empty evidence');await clear();
 await set('Search loaded tasks','fake staff name');assert(ids().length===0,'no invented name search');checks.push('unsupported staff names absent');await clear();
 assert(document.querySelector('[data-task-id="task-four"]').textContent.includes('No action returned'),'no synthetic actions');checks.push('no action returned preserved');
 render({tasks:[]});assert(ids().length===0&&document.body.textContent.includes('No current tasks are listed.'),'empty returned list');checks.push('empty returned task state');render();await clear();
 window.dashboardProof={passed:true,checks};
})().catch(error=>window.dashboardProof={passed:false,error:String(error),checks,body:document.body.textContent.slice(0,1600)});
`);
  const built = await Bun.build({ entrypoints: [entry], target: "browser", outdir: proof, naming: "[name].[ext]", minify: false });
  expect(built.success, built.logs.join("\n")).toBe(true);
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch(request) {
    const name = new URL(request.url).pathname;
    return name === "/fixture.js" ? new Response(Bun.file(resolve(proof,"fixture.js")), {headers:{"content-type":"application/javascript"}})
      : name === "/fixture.css" ? new Response(Bun.file(resolve(proof,"fixture.css")),{headers:{"content-type":"text/css"}})
      : new Response('<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/fixture.css"><div id="root"></div><script src="/fixture.js"></script>', {headers:{"content-type":"text/html"}});
  }});
  try {
    const child = Bun.spawn([chrome,"--headless=new","--no-first-run","--no-default-browser-check",
      "--disable-gpu","--disable-background-networking",`--user-data-dir=${resolve(proof,"profile")}`,
      "--remote-debugging-port=0","about:blank"], {cwd:root,stdin:"ignore",stdout:"ignore",stderr:"ignore"});
    let socket: WebSocket | undefined;
    let send: ((method: string, params?: Record<string, unknown>) => Promise<any>) | undefined;
    let evidence: any;
    const diagnostics: unknown[] = [];
    const expires = Date.now()+20_000;
    try {
      let port: string | undefined;
      while (!port && Date.now()<expires) {
        try { port=(await readFile(resolve(proof,"profile/DevToolsActivePort"),"utf8")).split("\n")[0]; } catch { await Bun.sleep(25); }
      }
      if (!port) throw new Error("Owned Chromium debugger did not become ready");
      const targets = await fetchJsonBounded<Array<{type: string;url: string;webSocketDebuggerUrl?: string}>>(`http://127.0.0.1:${port}/json/list`);
      const target = targets.find(target=>target.type==='page'&&target.url==='about:blank');
      if (!target?.webSocketDebuggerUrl) throw new Error('Owned blank page target is unavailable');
      socket = new WebSocket(target.webSocketDebuggerUrl);
      await new Promise<void>((resolve, reject) => { const timer=setTimeout(()=>reject(new Error("CDP socket open deadline")),5_000); socket!.onopen=()=>{clearTimeout(timer);resolve();};socket!.onerror=()=>{clearTimeout(timer);reject(new Error("CDP socket open failed"));}; });
      let id=0;
      const pending=new Map<number,{resolve:(value:any)=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>}>();
      socket.onmessage=event=>{const response=JSON.parse(String(event.data));if(response.method==='Runtime.exceptionThrown')diagnostics.push(response.params);const request=pending.get(response.id);if(!request)return;pending.delete(response.id);clearTimeout(request.timer);response.error?request.reject(new Error(JSON.stringify(response.error))):request.resolve(response.result);};
      send=(method,params={})=>new Promise((resolve,reject)=>{const requestId=++id;const timer=setTimeout(()=>{pending.delete(requestId);reject(new Error('CDP command deadline '+method));},5_000);pending.set(requestId,{resolve,reject,timer});socket!.send(JSON.stringify({id:requestId,method,params}));});
      await send('Runtime.enable');
      await send('Page.navigate',{url:`http://127.0.0.1:${server.port}/`});
      await send('Page.bringToFront');
      await send('Emulation.setFocusEmulationEnabled',{enabled:true});
      let handled=0;
      while(Date.now()<expires) {
        const state=await send('Runtime.evaluate',{expression:"JSON.stringify({proof:window.dashboardProof&&JSON.stringify(window.dashboardProof),key:window.keyRequest})",returnByValue:true});
        const observation=JSON.parse(state.result.value);
        if(observation.proof){evidence=JSON.parse(observation.proof);break;}
        if(observation.key?.sequence>handled){const {key,sequence}=observation.key;const code=key==='Enter'?'Enter':'Space';const virtual=key==='Enter'?13:32;
          await send('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:virtual,text:key==='Enter'?'\r':' '});
          await send('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:virtual});
          await send('Runtime.evaluate',{expression:`window.keyDone=${sequence}`});handled=sequence;}
        await Bun.sleep(20);
      }
      if(!evidence) { diagnostics.push(await send('Runtime.evaluate',{expression:'document.documentElement.outerHTML',returnByValue:true}));await writeFile(resolve(proof,'failure.json'),JSON.stringify(diagnostics,null,2));throw new Error('Mounted browser proof exceeded 20-second deadline: '+JSON.stringify(diagnostics).slice(-3000)); }
      await writeFile(resolve(proof,"receipt.json"),JSON.stringify(evidence,null,2));
      for (const width of [1440,375]) {
        await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
        const shot = await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
        await writeFile(resolve(proof,`dashboard-${width}.png`),Buffer.from(shot.data,'base64'));
        const bounds = await send('Runtime.evaluate',{expression:'JSON.stringify({width:innerWidth,scroll:document.documentElement.scrollWidth,table:!!document.querySelector("table"),buttons:[...document.querySelectorAll(".hk-dashboard-filters button,.hk-dashboard-row-actions button")].every(node=>node.getBoundingClientRect().height>=44)})',returnByValue:true});
        const layout = JSON.parse(bounds.result.value);
        expect(layout.scroll).toBeLessThanOrEqual(width);
        expect(layout.table).toBe(true);
        expect(layout.buttons).toBe(true);
      }
    } finally { await terminateOwnedProcess(child,send?()=>send!('Browser.close'):undefined);socket?.close(); }
    expect(evidence.passed, JSON.stringify(evidence)).toBe(true);
    expect(evidence.checks).toHaveLength(15);
  } finally { server.stop(true); }
}, 30_000);
