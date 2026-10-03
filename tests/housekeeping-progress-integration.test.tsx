import { expect, test } from "bun:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { mkdtemp, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { HousekeepingFloorWorkbench } from "../frontend/yellow/src/workspaces/HousekeepingFloorWorkbench";
import { resolveChromiumPath } from "./helpers/chromium-path";
import { runOwnedProofProcess } from "./helpers/owned-proof-process";

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
const realDate=Date; let current='2026-10-03T10:00:00.000Z';
window.Date=class extends realDate { constructor(...args){ super(...(args.length?args:[current])); } static now(){return new realDate(current).getTime();} };
const timers=new Map(); const realInterval=window.setInterval.bind(window), realClear=window.clearInterval.bind(window);
window.setInterval=(callback,ms,...args)=>{const id=realInterval(callback,ms,...args);timers.set(id,{callback,ms});return id;};
window.clearInterval=id=>{timers.delete(id);realClear(id);};
const SPACE='00000000-0000-4000-8000-000000000001', TASK='00000000-0000-4000-8000-000000000002';
const room=code=>({spaceId:SPACE,code,floor:'1',condition:'dirty',updatedAt:'2026-10-03T09:00:00.000001Z'});
const task=code=>({taskId:TASK,spaceId:SPACE,spaceCode:code,floor:'1',roomCondition:'dirty',roomUpdatedAt:room(code).updatedAt,taskStatus:'assigned',priority:1,assigned:true,dueAt:'2026-10-03T10:01:00.000000Z',completedAt:null,allowedActions:['start']});
let mode='ok', detailChanged=false, delayed=[];
window.fetch=async(input,init)=>{
 const url=String(input);calls.push({url,method:init?.method||'GET'});
 const code=url.includes('/synthetic-b/')?'202':'101';
 if(mode==='revoked')return new Response('{}',{status:403});
 if(mode==='failed')return new Response('{}',{status:500});
 if(mode==='held' && url.includes('/conditions')) return new Promise(resolve=>delayed.push(()=>resolve(new Response(JSON.stringify({rooms:[room(code)],nextCursor:null})))));
 if(url.includes('/conditions'))return new Response(JSON.stringify({rooms:[room(code)],nextCursor:mode==='partial'?'opaque-next':null}));
 if(url.includes('/tasks/'))return new Response(JSON.stringify({task:detailChanged?{...task(code),taskStatus:'in_progress',allowedActions:['complete']}:task(code)}));
 const tasks=mode==='partial'?Array.from({length:200},(_,i)=>({...task(code),taskId:'00000000-0000-4000-8000-'+String(i+10).padStart(12,'0')})):[task(code)];
 return new Response(JSON.stringify({tasks}));
};
const tokenA=async()=> 'fixture-token-a', tokenB=async()=> 'fixture-token-b';
const root=createRoot(document.getElementById('root'));
let props={propertyId:'synthetic-a',timezone:'Asia/Kolkata',getToken:tokenA,onPrepare:(task,action)=>prepares.push({task,action}),disabled:false};
const render=extra=>{props={...props,...extra};flushSync(()=>root.render(<HousekeepingFloorWorkbench {...props}/>));};
(async()=>{
 render({});await wait(()=>panel()?.textContent.includes('Assigned'));
 assert(panel().textContent.includes('ETA unavailable'),'ETA must be unavailable');
 assert(panel().textContent.includes('3:31 PM'),'granted timezone deadline');
 assert(!panel().querySelector('button'),'read panel must not mint actions');checks.push('loaded categorical evidence and property timezone');
 document.querySelector('.hk-floor-cube').click();await tick();
 click('Task '+TASK+' · assigned · priority 1');await tick();click('Start cleaning');await wait(()=>prepares.length===1);
 assert(calls.some(c=>c.url.includes('/tasks/'+TASK)),'fresh detail read required');
 assert(prepares[0].task.taskId===TASK && prepares[0].action==='start','canonical intent forwarded');
 assert(calls.every(c=>c.method==='GET'),'no writes from presentation');checks.push('selected room task rereads detail and delegates existing intent');
 const retained=prepares[0];render({disabled:true});assert([...document.querySelectorAll('button')].filter(b=>b.textContent==='Start cleaning').every(b=>b.disabled),'flight fence');
 assert(prepares.length===1 && prepares[0]===retained,'presentation preserves parent-held intent');checks.push('busy parent intent retained without repeat dispatch');render({disabled:false});
 detailChanged=true;click('Start cleaning');await wait(()=>body().includes('Task or room evidence changed'));
 assert(prepares.length===1,'changed evidence must not prepare');checks.push('changed detail blocks old action');detailChanged=false;
 mode='failed';click('Refresh');await wait(()=>body().includes('Previously loaded evidence'));
 assert(panel().textContent.includes('Snapshot is stale'),'stale panel');assert(!panel().textContent.includes('Assigned'),'stale categorical claim withheld');checks.push('failed refresh retains visibly unknown stale evidence');
 mode='ok';click('Refresh');await wait(()=>panel()?.textContent.includes('Assigned'));
 const clock=[...timers.values()].find(t=>t.ms===15000);assert(clock,'bounded clock registered');current='2026-10-03T10:02:00.000Z';clock.callback();await wait(()=>panel()?.textContent.includes('overdue'));checks.push('explicit live clock updates deadline');
 mode='held';click('Refresh');await wait(()=>delayed.length===1);
 render({propertyId:'synthetic-b'});assert(!body().includes('Room 101')&&!panel(),'old property hidden in render');
 await wait(()=>delayed.length===2);mode='ok';delayed.splice(0).forEach(resolve=>resolve());await wait(()=>panel()?.textContent.includes('Room 202'));
 assert(!body().includes('Room 101'),'late old client cannot restore data');checks.push('property switch and late prior response isolated');
 mode='held';render({getToken:tokenB});assert(!panel(),'new token provider hides prior snapshot');await wait(()=>delayed.length===1);mode='ok';delayed.splice(0).forEach(resolve=>resolve());await wait(()=>!!panel());checks.push('client replacement clears displayed evidence');
 mode='partial';click('Refresh');await wait(()=>panel()?.textContent.includes('200 loaded tasks'));
 assert(panel().textContent.includes('More condition pages remain')&&panel().textContent.includes('200-task limit'),'partial evidence labels');checks.push('condition pagination and task cap remain explicit');
 render({timezone:''});assert(body().includes('progress is unavailable'),'missing granted timezone must not default UTC');checks.push('missing timezone fails closed');render({timezone:'Asia/Kolkata'});
 mode='revoked';click('Refresh');await wait(()=>body().includes('(403)'));
 assert(!panel()&&!body().includes('Room 202'),'revoked snapshot hidden');checks.push('403 revocation clears all panel evidence');
 flushSync(()=>root.unmount());assert(![...timers.values()].some(t=>t.ms===15000),'clock teardown');checks.push('unmount clears interval');
 const result=document.createElement('pre');result.id='proof';result.textContent=JSON.stringify({passed:true,checks});document.body.replaceChildren(result);
})().catch(error=>{const failureBody=body();root.unmount();const result=document.createElement('pre');result.id='proof';result.textContent=JSON.stringify({passed:false,error:String(error),checks,body:failureBody.slice(0,1200)});document.body.replaceChildren(result);});
`);
  const built = await Bun.build({ entrypoints: [entry], target: "browser", outdir: proof, naming: "[name].[ext]", minify: false });
  expect(built.success, built.logs.join("\n")).toBe(true);
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch(request) {
    const name = new URL(request.url).pathname;
    return name === "/fixture.js" ? new Response(Bun.file(resolve(proof,"fixture.js")), {headers:{"content-type":"application/javascript"}})
      : new Response('<!doctype html><meta charset="utf-8"><div id="root"></div><script src="/fixture.js"></script>', {headers:{"content-type":"text/html"}});
  }});
  try {
    const result = await runOwnedProofProcess([chrome,"--headless=new","--no-first-run","--no-default-browser-check",
      "--disable-gpu","--disable-background-networking",`--user-data-dir=${resolve(proof,"profile")}`,
      "--virtual-time-budget=25000","--dump-dom",`http://127.0.0.1:${server.port}/`], {timeoutMs:20_000,maxOutputBytes:262144,cwd:root});
    await writeFile(resolve(proof,"browser-output.txt"),result.stdout + "\n" + result.stderr);
    expect(result.exitCode).toBe(0);
    const raw = result.stdout.match(/<pre id="proof">([^]*?)<\/pre>/u)?.[1];
    expect(raw, result.stdout.slice(-2500)).toBeDefined();
    const evidence = JSON.parse(raw!.replaceAll("&quot;",'"').replaceAll("&amp;","&").replaceAll("&lt;","<").replaceAll("&gt;",">"));
    expect(evidence.passed, JSON.stringify(evidence)).toBe(true);
    expect(evidence.checks).toHaveLength(12);
    await writeFile(resolve(proof,"receipt.json"),JSON.stringify(evidence,null,2));
  } finally { server.stop(true); }
}, 30_000);
