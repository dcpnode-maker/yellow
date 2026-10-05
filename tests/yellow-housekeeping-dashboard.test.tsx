import { expect, test } from "bun:test";
import { createElement, useState } from "react";
import * as React from "react";
import { renderToString } from "react-dom/server";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { HousekeepingTaskDashboard } from "../frontend/yellow/src/workspaces/HousekeepingTaskDashboard";
import { HousekeepingFloorWorkbench } from "../frontend/yellow/src/workspaces/HousekeepingFloorWorkbench";
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

test("actual App Housekeeping query guards hide the dashboard until data is available", async () => {
  // Execute the exact actual caller body with query observations supplied at its hook seam.
  // This is caller rendering proof, not an authenticated transport or native command proof.
  const app = await readFile(resolve(import.meta.dir, "../frontend/yellow/src/App.tsx"), "utf8");
  const start = app.indexOf("function HousekeepingWorkspace({");
  const caller = app.slice(start, app.indexOf("\ntype DepartmentPerformanceMatrixProps", start));
  const javascript = new Bun.Transpiler({ loader: "tsx", tsconfig: { compilerOptions: { jsx: "react" } } }).transformSync(caller);
  const observations = [
    { isLoading: true, isError: false },
    { isLoading: false, isError: true, error: new Error("Permission denied") },
    { isLoading: false, isError: false, data: undefined },
    { isLoading: false, isError: false, data: { rooms, tasks: [task] } },
  ];
  const rendered = observations.map((query) => {
    const component = new Function("React", "useState", "useQuery", "useQueryClient", "propertyId", "loadHousekeeping", "session", "HousekeepingTaskDashboard", "HousekeepingFloorWorkbench", "housekeepingActionCopy", `${javascript};return HousekeepingWorkspace;`)(React, useState, () => query, () => ({}), "synthetic-property", () => undefined, async () => "synthetic", HousekeepingTaskDashboard, HousekeepingFloorWorkbench, (action: string) => ({ button: actionLabel(action) }));
    return renderToString(createElement(component, { timezone: "UTC", onLifecycleBusyChange() {} }));
  });
  expect(rendered[0]).toContain("Loading room conditions");
  expect(rendered[1]).toContain("Permission denied");
  expect(rendered[2]).toContain("Housekeeping details are unavailable");
  for (const html of rendered.slice(0, 3)) expect(html).not.toContain("hk-task-dashboard");
  expect(rendered[3]).toContain("hk-task-dashboard");
  expect(rendered[3]).toContain("Floor and room view");
  expect(rendered[3]).not.toContain('<details class="hk-dashboard-floor" open');
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
