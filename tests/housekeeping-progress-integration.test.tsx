import { expect, test } from "bun:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { HousekeepingFloorWorkbench } from "../frontend/yellow/src/workspaces/HousekeepingFloorWorkbench";
import { resolveChromiumPath } from "./helpers/chromium-path";
import { fetchJsonBounded, terminateOwnedProcess } from "./helpers/owned-cdp-proof-lifecycle";

test("the real floor workbench exposes no unverified progress during initial rendering", () => {
  const html = renderToString(createElement(HousekeepingFloorWorkbench, {
    propertyId: "synthetic-a", timezone: "Asia/Kolkata", getToken: async () => "fixture-token", onPrepare() {},
  }));
  expect(html).toContain("Loading room conditions");
  expect(html).toContain("have not been verified");
  expect(html).not.toContain("hk-progress-panel");
});

test("mounted progress follows actual client fences, detail actions, partial reads and clock teardown", async () => {
  const chrome = resolveChromiumPath();
  if (!chrome) throw new Error("An installed Chromium browser is required for integrated housekeeping proof");
  const root = resolve(import.meta.dir, "..");
  // Retain generated fixture/profile under the isolated candidate for audit; no production files or DB.
  const proof = await mkdtemp(resolve(root, ".hk-progress-proof-"));
  const entry = resolve(proof, "fixture.tsx");
  const workbench = resolve(root, "frontend/yellow/src/workspaces/HousekeepingFloorWorkbench.tsx");
  await writeFile(entry, `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { HousekeepingFloorWorkbench } from ${JSON.stringify(workbench)};
const checks = [], calls = [], prepares = [];
const fail = message => { throw new Error(message); };
const assert = (ok, message) => { if (!ok) fail(message); };
const tick = () => new Promise(resolve => setTimeout(resolve, 10));
const wait = async predicate => { for (let i=0;i<150;i++) { if(predicate()) return; await tick(); } fail('fixture observation timed out'); };
const body = () => document.body.textContent;
const panel = () => document.querySelector('.hk-progress-panel');
const click = text => { const node=[...document.querySelectorAll('button')].find(n=>n.textContent.trim()===text); assert(node && !node.disabled,'missing enabled '+text); node.click(); };
let keySequence=0;
const keyboard=async(selector,key)=>{const node=document.querySelector(selector);assert(node,'keyboard target '+selector);node.focus();const sequence=++keySequence;window.keyRequest={sequence,key};await wait(()=>window.keyDone===sequence);await tick();};
const selectRoom=async()=>{document.querySelector('.hk-floor-cube').click();await wait(()=>!!panel());};
const selectTask=async()=>{document.querySelector('.hk-floor-task-select').click();await tick();};
const realDate=Date; let current='2026-10-03T10:00:00.000Z';
window.Date=class extends realDate { constructor(...args){ super(...(args.length?args:[current])); } static now(){return new realDate(current).getTime();} };
const timers=new Map(); const realInterval=window.setInterval.bind(window), realClear=window.clearInterval.bind(window);
window.setInterval=(callback,ms,...args)=>{const id=realInterval(callback,ms,...args);timers.set(id,{callback,ms});return id;};
window.clearInterval=id=>{timers.delete(id);realClear(id);};
const SPACE='00000000-0000-4000-8000-000000000001', TASK='00000000-0000-4000-8000-000000000002';
const SPACE2='00000000-0000-4000-8000-000000000003', TASK2='00000000-0000-4000-8000-000000000004', ORPHAN='00000000-0000-4000-8000-000000000005';
const TASK3='00000000-0000-4000-8000-000000000007';
const room=code=>({spaceId:SPACE,code,floor:'1',condition:'dirty',updatedAt:'2026-10-03T09:00:00.000001Z'});
const task=code=>({taskId:TASK,spaceId:SPACE,spaceCode:code,floor:'1',roomCondition:'dirty',roomUpdatedAt:room(code).updatedAt,taskStatus:'assigned',priority:1,assigned:true,dueAt:'2026-10-03T10:01:00.000000Z',completedAt:null,allowedActions:['start']});
const rooms=code=>[room(code),{...room('201'),spaceId:SPACE2,floor:'2'}];
const baseTasks=code=>[task(code),{...task('201'),taskId:TASK2,spaceId:SPACE2,floor:'2'},{...task('999'),taskId:ORPHAN,spaceId:'00000000-0000-4000-8000-000000000006'}];
let mode='ok', detailChanged=false, delayed=[];
window.fetch=async(input,init)=>{
 const url=String(input);calls.push({url,method:init?.method||'GET'});
 const code=url.includes('/synthetic-b/')?'202':'101';
 if(mode==='revoked'||mode==='unauthorized'||mode==='propertyDenied'||(mode==='detailDenied'&&url.includes('/tasks/')))return new Response('{}',{status:mode==='revoked'?403:mode==='unauthorized'?401:404});
 if(mode==='failed')return new Response('{}',{status:500});
 if(mode==='held' && url.includes('/conditions')) return new Promise(resolve=>delayed.push(()=>resolve(new Response(JSON.stringify({rooms:rooms(code),nextCursor:null})))));
 if(url.includes('/conditions'))return new Response(JSON.stringify({rooms:mode==='disappeared'?rooms(code).slice(1):rooms(code),nextCursor:mode==='partial'?'opaque-next':null}));
 if(url.includes('/tasks/'))return new Response(JSON.stringify({task:detailChanged?{...task(code),taskStatus:'in_progress',allowedActions:['complete']}:url.endsWith('/'+TASK3)?{...task(code),taskId:TASK3}:task(code)}));
 const tasks=mode==='partial'?[task(code),...Array.from({length:199},(_,i)=>({...baseTasks(code)[1],taskId:'00000000-0000-4000-8000-'+String(i+10).padStart(12,'0')}))]:mode==='multiple'?[...baseTasks(code),{...task(code),taskId:TASK3}]:baseTasks(code);
 return new Response(JSON.stringify({tasks}));
};
const tokenA=async()=> 'fixture-token-a', tokenB=async()=> 'fixture-token-b';
const root=createRoot(document.getElementById('root'));
let props={propertyId:'synthetic-a',timezone:'Asia/Kolkata',getToken:tokenA,onPrepare:(task,action)=>prepares.push({task,action}),disabled:false};
const render=extra=>{props={...props,...extra};flushSync(()=>root.render(<HousekeepingFloorWorkbench {...props}/>));};
(async()=>{
 render({});await wait(()=>body().includes('3 current tasks loaded'));
 assert(!panel(),'loaded conditions must not reveal progress');checks.push('loaded two-floor snapshot has no initial progress dump');
 await keyboard('.hk-floor-cube','Enter');await wait(()=>!!panel());
 assert(panel().textContent.includes('Assigned'),'selected room progress');
 assert(panel().querySelectorAll('.hk-progress-task').length===1,'one row per selected task');
 assert(!panel().textContent.includes(TASK2)&&!panel().textContent.includes(ORPHAN),'foreign and orphan tasks excluded');
 assert(document.querySelectorAll('.hk-floor-drawer h3').length===1 && !panel().querySelector('h4'),'single room heading');
 assert([...panel().querySelectorAll('details')].every(n=>!n.open),'technical details initially collapsed');checks.push('keyboard room selection reveals only selected task and single heading');
 assert(panel().textContent.includes('ETA unavailable'),'ETA must be unavailable');
 assert(panel().textContent.includes('3:31 PM'),'granted timezone deadline');
 assert(!panel().querySelector('.hk-floor-task-detail'),'actions need existing canonical selection');checks.push('loaded categorical evidence and property timezone');
 const beforeDetails=calls.length;await keyboard('.hk-progress-task summary',' ');
 assert(panel().querySelector('.hk-progress-task details').open,'native Details keyboard opens');
 assert(calls.length===beforeDetails&&prepares.length===0,'Details does not fetch or write');checks.push('trusted Space expands native Details without requests');
 await keyboard('.hk-floor-back','Enter');await wait(()=>!panel());
 assert(document.activeElement?.classList.contains('hk-floor-cube'),'Back restores room cube focus');
 await keyboard('.hk-floor-cube','Enter');assert([...panel().querySelectorAll('details')].every(n=>!n.open),'reopen resets Details');checks.push('trusted Back removes progress and restores focus with collapsed reopen');
 await keyboard('.hk-floor-nav button:nth-child(2)','Enter');assert(!panel(),'floor switch removes progress');assert(document.activeElement?.closest('.hk-floor-nav'),'floor focus retained');await selectRoom();
 assert(panel().textContent.includes(TASK2)&&!panel().textContent.includes(TASK),'second room replaces selected task');
 click('1'+'1 loaded');await tick();await selectRoom();checks.push('two-floor navigation replaces selected room progress');
 await selectTask();click('Start cleaning');await wait(()=>prepares.length===1);
 assert(calls.some(c=>c.url.includes('/tasks/'+TASK)),'fresh detail read required');
 assert(prepares[0].task.taskId===TASK && prepares[0].action==='start','canonical intent forwarded');
 assert(JSON.stringify(prepares[0].task)===JSON.stringify(task('101')),'all canonical task fields forwarded unchanged');
 assert(calls.every(c=>c.method==='GET'),'no writes from presentation');checks.push('selected room task rereads detail and delegates existing intent');
 const retained=prepares[0];render({disabled:true});assert([...document.querySelectorAll('button')].filter(b=>b.textContent==='Start cleaning').every(b=>b.disabled),'flight fence');
 assert(prepares.length===1 && prepares[0]===retained,'presentation preserves parent-held intent');checks.push('busy parent intent retained without repeat dispatch');render({disabled:false});
 detailChanged=true;click('Start cleaning');await wait(()=>body().includes('Task or room evidence changed'));
 assert(prepares.length===1,'changed evidence must not prepare');
 assert(!panel().querySelector('.hk-floor-task-select').textContent.includes('Assigned'),'old authoritative listed stage removed');
 assert(panel().querySelectorAll('.hk-progress-task').length===1&&panel().textContent.includes('in_progress'),'single fresh conflicting detail row');
 assert(body().includes('Mark physically clean'),'fresh server allowlist preserved');checks.push('changed detail replaces old stage and blocks old action');detailChanged=false;
 mode='failed';click('Refresh');await wait(()=>body().includes('Previously loaded evidence'));
 assert(panel().textContent.includes('Snapshot is stale'),'stale panel');assert(!panel().textContent.includes('Assigned'),'stale categorical claim withheld');checks.push('failed refresh retains visibly unknown stale evidence');
 mode='ok';click('Refresh');await wait(()=>panel()?.textContent.includes('Assigned'));
 const clock=[...timers.values()].find(t=>t.ms===15000);assert(clock,'bounded clock registered');current='2026-10-03T10:02:00.000Z';clock.callback();await wait(()=>panel()?.textContent.includes('overdue'));checks.push('explicit live clock updates deadline');
 mode='held';click('Refresh');await wait(()=>delayed.length===1);
 assert(panel().textContent.includes('Snapshot is stale')&&!panel().querySelector('.hk-floor-task-select').textContent.includes('Assigned'),'pending refresh withholds authority');checks.push('pending refresh keeps selected context visibly unknown');
 render({propertyId:'synthetic-b'});assert(!body().includes('Room 101')&&!panel(),'old property hidden in render');
 await wait(()=>delayed.length===2);mode='ok';delayed.splice(0).forEach(resolve=>resolve());await wait(()=>body().includes('3 current tasks loaded'));await selectRoom();
 assert(document.querySelector('.hk-floor-drawer h3').textContent==='Room 202','new property room');
 assert(!body().includes('Room 101'),'late old client cannot restore data');checks.push('property switch and late prior response isolated');
 mode='held';render({getToken:tokenB});assert(!panel(),'new token provider hides prior snapshot');await wait(()=>delayed.length===1);mode='ok';delayed.splice(0).forEach(resolve=>resolve());await wait(()=>body().includes('3 current tasks loaded'));await selectRoom();checks.push('client replacement clears displayed evidence');
 mode='partial';click('Refresh');await wait(()=>body().includes('200 current tasks loaded'));
 assert(panel().querySelectorAll('.hk-progress-task').length===1,'selected one from full 200 tasks');
 assert(panel().textContent.includes('More condition pages remain')&&panel().textContent.includes('200-task limit'),'global partial evidence labels survive filtering');checks.push('condition pagination and global task cap survive selecting one task');
 render({timezone:''});assert(body().includes('Property timezone is unavailable')&&!panel().textContent.includes('3:31 PM'),'missing granted timezone must not default UTC');
 assert(panel().querySelector('.hk-floor-task-select'),'timezone failure retains canonical selection');checks.push('missing timezone remains visibly unavailable');render({timezone:'Asia/Kolkata'});
 mode='multiple';click('Refresh');await wait(()=>body().includes('4 current tasks loaded'));
 assert(panel().querySelectorAll('.hk-progress-task').length===2&&panel().querySelectorAll('ul').length===1,'multiple tasks have one row each in one list');
 const selections=panel().querySelectorAll('.hk-floor-task-select');selections[1].click();await tick();click('Start cleaning');await wait(()=>prepares.length===2);
 assert(prepares[1].action==='start'&&JSON.stringify(prepares[1].task)===JSON.stringify({...task('202'),taskId:TASK3}),'second readable task selects exact canonical identity');checks.push('multiple task rows preserve exact canonical identity and unchanged prepare fields');
 mode='disappeared';click('Refresh');await wait(()=>body().includes('1 rooms with recorded condition loaded'));
 assert(!panel()&&!document.querySelector('.hk-floor-drawer'),'removed room removes drawer');checks.push('room disappearance clears selected progress');
 mode='ok';click('Refresh');await wait(()=>body().includes('2 rooms with recorded condition loaded'));click('1'+'1 loaded');await tick();await selectRoom();
 mode='unauthorized';click('Refresh');await wait(()=>body().includes('(401)'));assert(!panel()&&!document.querySelector('.hk-floor-drawer'),'401 clears evidence');checks.push('401 revocation clears selected progress');
 mode='ok';click('Refresh');await wait(()=>body().includes('2 rooms with recorded condition loaded'));await selectRoom();
 mode='revoked';click('Refresh');await wait(()=>body().includes('(403)'));
 assert(!panel()&&!body().includes('Room 202'),'revoked snapshot hidden');checks.push('403 revocation clears all panel evidence');
 mode='ok';click('Refresh');await wait(()=>body().includes('2 rooms with recorded condition loaded'));await selectRoom();
 await keyboard('.hk-progress-task summary',' ');assert(panel().querySelector('.hk-progress-task details').open,'404 setup retains expanded room details');
 mode='propertyDenied';click('Refresh');await wait(()=>body().includes('(404)'));
 assert(!panel()&&!document.querySelector('.hk-floor-drawer')&&!body().includes('Room 202')&&!document.querySelector('.hk-floor-cube'),'404 refresh clears all room and task evidence');checks.push('404 property denial clears selected drawer and expanded details');
 mode='ok';click('Refresh');await wait(()=>body().includes('2 rooms with recorded condition loaded'));await selectRoom();await selectTask();
 const beforeDeniedPrepare=prepares.length;mode='detailDenied';click('Start cleaning');await wait(()=>body().includes('(404)'));
 assert(!panel()&&!document.querySelector('.hk-floor-drawer')&&!body().includes('Room 202')&&prepares.length===beforeDeniedPrepare,'404 detail clears evidence without preparing an action');checks.push('404 task-detail denial clears evidence without dispatch');
 flushSync(()=>root.unmount());assert(![...timers.values()].some(t=>t.ms===15000),'clock teardown');checks.push('unmount clears interval');
 const result=document.createElement('pre');result.id='proof';result.textContent=JSON.stringify({passed:true,checks});document.body.replaceChildren(result);
})().catch(error=>{const failureBody=body();root.unmount();const result=document.createElement('pre');result.id='proof';result.textContent=JSON.stringify({passed:false,error:String(error),checks,body:failureBody.slice(0,1200)});document.body.replaceChildren(result);});
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
        const state=await send('Runtime.evaluate',{expression:"JSON.stringify({proof:document.getElementById('proof')?.textContent,key:window.keyRequest})",returnByValue:true});
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
    } finally { await terminateOwnedProcess(child,send?()=>send!('Browser.close'):undefined);socket?.close(); }
    expect(evidence.passed, JSON.stringify(evidence)).toBe(true);
    expect(evidence.checks).toHaveLength(23);
  } finally { server.stop(true); }
}, 30_000);
