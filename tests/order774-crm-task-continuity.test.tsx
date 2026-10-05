import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { resolveChromiumPath } from "./helpers/chromium-path";
import { fetchJsonBounded, terminateOwnedProcess } from "./helpers/owned-cdp-proof-lifecycle";

test("selected department task follows only its matching loaded reservation", async () => {
  const chrome = resolveChromiumPath();
  if (!chrome) throw new Error("Installed Chromium is required for CRM task continuity proof");
  const root = resolve(import.meta.dir, "..");
  const proof = await mkdtemp(resolve(root, ".order774-crm-task-proof-"));
  const entry = resolve(proof, "fixture.tsx");
  let passed = false;
  await writeFile(entry, `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import OperationalHub from ${JSON.stringify(resolve(root, "frontend/yellow/src/workspaces/OperationalHub.tsx"))};
import {configureYellowApi} from ${JSON.stringify(resolve(root, "frontend/yellow/src/yellow-api.tsx"))};
import {reactAuthSession} from ${JSON.stringify(resolve(root, "frontend/yellow/src/auth-session.ts"))};
const propertyId='00000000-0000-4000-8000-000000000001', actor='00000000-0000-4000-8000-000000000002', tenant='00000000-0000-4000-8000-000000000003';
const matchedStay={reservationId:'reservation-one',confirmationNo:'CONF-ONE',primaryGuestDisplayName:'Returned Guest One',sellableUnitLabel:'Room 101'};
const empty={data:[],isLoading:false,isError:false};
const rows=[
 {requestId:'request-one',reservationId:'reservation-one',segmentId:'segment-one',spaceId:'room-one',serviceKind:'luggage_pickup',parentRequestId:null,targetRoleId:'role-one',targetRoleName:'Bell desk',proposalStatus:'confirmed',version:7,expiresAt:'2026-10-05T12:00:00Z',departureAt:'2026-10-05T10:00:00Z',dueAt:null,dueLocal:null,timezone:'UTC',taskId:'task-one',taskStatus:'assigned',assigneePartyId:'staff-one',outcome:null,completedAt:null,eligibleActions:['start']},
 {requestId:'request-two',reservationId:'reservation-outside-view',segmentId:'segment-two',spaceId:'room-two',serviceKind:'minibar_check',parentRequestId:null,targetRoleId:'role-two',targetRoleName:'Housekeeping',proposalStatus:'confirmed',version:3,expiresAt:'2026-10-05T12:00:00Z',departureAt:'2026-10-05T10:00:00Z',dueAt:null,dueLocal:null,timezone:'UTC',taskId:'task-two',taskStatus:'open',assigneePartyId:null,outcome:null,completedAt:null,eligibleActions:['assign']},
];
const staff=[{partyId:'staff-one',name:'Returned Staff One'}],openCalls=[],apiCalls=[],detailResponses=[];let visibleStays=[matchedStay];
window.fetch=async(input,init)=>{const url=String(input),method=init?.method||'GET';apiCalls.push({url,method});const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}});
 if(url.includes('/auth/local:login'))return json({accessToken:'synthetic.'+btoa(JSON.stringify({sub:actor,tid:tenant}))+'.signature',tokenType:'Bearer',expiresInSeconds:900,user:{id:actor,displayName:'Synthetic staff'}});
 if(url.includes('/me/properties'))return json({properties:[{id:propertyId,name:'Synthetic property',timezone:'UTC'}]});
 if(url.endsWith('/operating-mode'))return json({},503);
 if(url.includes('/reservations/')){const reservationId=url.split('/reservations/')[1].split('/')[0];detailResponses.push(reservationId);return json({reservationId,reservationStatus:'confirmed',timezone:'UTC',evidence:null,roles:[],staff,requests:rows.filter(row=>row.reservationId===reservationId)});}
 if(method==='POST')return json({request:rows.find(row=>url.includes(row.requestId)),replayed:false});
 if(url.endsWith('/departure-services'))return json({requests:rows});
 return json({},404);
};
const query=new QueryClient({defaultOptions:{queries:{retry:false,refetchOnWindowFocus:false}}});
const rootNode=createRoot(document.getElementById('root'));
configureYellowApi(propertyId);
const onOpenReservation=stay=>openCalls.push(stay);
const renderHub=()=>flushSync(()=>rootNode.render(React.createElement(QueryClientProvider,{client:query},React.createElement(OperationalHub,{
   propertyName:'Synthetic property',initialView:'tasks',arrivals:{...empty,data:visibleStays},departures:empty,rooms:empty,blocks:empty,
   onNavigate:()=>{},onOpenReservation
 }))));
(async()=>{
 await reactAuthSession.signIn({tenant:'synthetic',email:'synthetic@example.invalid',password:'synthetic'},propertyId);
 renderHub();
 const tick=()=>new Promise(resolve=>setTimeout(resolve,15));
 const wait=async(predicate)=>{for(let n=0;n<250;n++){if(predicate())return;await tick()}throw new Error('Timed out waiting for mounted task details: '+document.body.textContent.slice(-700))};
 await wait(()=>document.querySelectorAll('tbody tr').length===2);
 document.querySelector('[data-request-id="request-one"] summary').click();
 await wait(()=>!!document.querySelector('.department-task-open-reservation'));
 const selected=document.querySelector('.department-task-selected');
 if(!selected?.textContent.toLocaleLowerCase().includes('luggage pickup')||!selected.textContent.toLocaleLowerCase().includes('assigned')||!selected.textContent.includes('Returned Staff One')||!selected.textContent.includes('Due time unavailable')) throw new Error('Selected task details did not use the returned task/staff fields and preserve unknown due time');
 const openButton=selected.querySelector('.department-task-open-reservation');
 if(!openButton||openButton.textContent.trim()!=='Open linked reservation →') throw new Error('Matching task reservation action missing');
 openButton.click();
 if(openCalls.length!==1||openCalls[0]!==matchedStay) throw new Error('Reservation callback did not receive the exact loaded OperationalStay object');
 await wait(()=>detailResponses.length===2);
 const taskSummary=document.querySelector('[data-request-id="request-one"] summary');
 const beforeCloseCalls=apiCalls.length;
 selected.querySelector('.department-task-close-details').click();
 await wait(()=>!document.querySelector('.department-task-selected'));
 await wait(()=>document.activeElement===taskSummary);
 if(taskSummary.closest('details').open) throw new Error('Close task details left its row disclosure open');
 taskSummary.click();
 await wait(()=>!!document.querySelector('.department-task-open-reservation'));
 if(apiCalls.length!==beforeCloseCalls||openCalls.length!==1) throw new Error('Closing and reopening task details triggered a fetch or reservation navigation');
 document.querySelector('[data-request-id="request-two"] summary').click();
 await wait(()=>document.querySelector('.department-task-selected')?.textContent.toLocaleLowerCase().includes('minibar check')&&document.querySelector('.department-task-selected')?.textContent.includes('reservation-outside-view'));
 const unmatched=document.querySelector('.department-task-selected');
 if(unmatched.querySelector('.department-task-open-reservation')) throw new Error('Unmatched reservation received a fabricated navigation action');
 if(!unmatched.textContent.includes('not present in the currently loaded arrivals or departures')) throw new Error('Unmatched reservation explanation missing');
 if(unmatched.querySelector('a[href]')) throw new Error('Task details exposed an unsupported reservation URL');
 visibleStays=[];renderHub();
 await wait(()=>!!document.querySelector('.department-task-selected')&&!document.querySelector('.department-task-open-reservation'));
 if(!document.querySelector('.department-task-selected').textContent.includes('not present in the currently loaded arrivals or departures')) throw new Error('Empty loaded reservation view did not remain unavailable');
 window.crmTaskProof={passed:true,checks:['selected task uses returned DTO and unknown due stays unknown','matching reservation opens through the exact existing callback DTO','close collapses details and restores invoking focus','reopen does not fetch or navigate again','unmatched and empty reservation views expose no fabricated link'],openCalls:openCalls.length};
})().catch(error=>window.crmTaskProof={passed:false,error:String(error),body:document.body.textContent.slice(-1600)});
`);
  const built = await Bun.build({ entrypoints: [entry], target: "browser", outdir: proof, naming: "[name].[ext]", minify: false });
  expect(built.success, built.logs.join("\n")).toBe(true);
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch(request) {
    const name = new URL(request.url).pathname;
    return name === "/fixture.js" ? new Response(Bun.file(resolve(proof, "fixture.js")), { headers: { "content-type": "application/javascript" } })
      : name === "/fixture.css" ? new Response(Bun.file(resolve(proof, "fixture.css")), { headers: { "content-type": "text/css" } })
        : new Response('<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/fixture.css"><div id="root"></div><script src="/fixture.js"></script>', { headers: { "content-type": "text/html" } });
  } });
  let child: ReturnType<typeof Bun.spawn> | undefined;
  let socket: WebSocket | undefined;
  let send: ((method: string, params?: Record<string, unknown>) => Promise<any>) | undefined;
  try {
    child = Bun.spawn([chrome, "--headless=new", "--no-first-run", "--no-default-browser-check", "--disable-gpu", "--disable-background-networking", `--user-data-dir=${resolve(proof, "profile")}`, "--remote-debugging-port=0", "about:blank"], { cwd: root, stdin: "ignore", stdout: "ignore", stderr: "ignore" });
    let port: string | undefined;
    const expires = Date.now() + 25_000;
    while (!port && Date.now() < expires) {
      try { port = (await readFile(resolve(proof, "profile/DevToolsActivePort"), "utf8")).split("\n")[0]; } catch { await Bun.sleep(25); }
    }
    if (!port) throw new Error("Owned Chromium debugger did not become ready");
    const targets = await fetchJsonBounded<Array<{ type: string; url: string; webSocketDebuggerUrl?: string }>>(`http://127.0.0.1:${port}/json/list`);
    const target = targets.find((item) => item.type === "page" && item.url === "about:blank");
    if (!target?.webSocketDebuggerUrl) throw new Error("Owned Chromium page target is unavailable");
    socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise<void>((resolve, reject) => { const timer = setTimeout(() => reject(new Error("CDP socket open deadline")), 5_000); socket!.onopen = () => { clearTimeout(timer); resolve(); }; socket!.onerror = () => { clearTimeout(timer); reject(new Error("CDP socket open failed")); }; });
    let id = 0;
    const pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
    socket.onmessage = (event) => { const response = JSON.parse(String(event.data)); const item = pending.get(response.id); if (!item) return; pending.delete(response.id); clearTimeout(item.timer); response.error ? item.reject(new Error(JSON.stringify(response.error))) : item.resolve(response.result); };
    send = (method, params = {}) => new Promise((resolve, reject) => { const requestId = ++id; const timer = setTimeout(() => { pending.delete(requestId); reject(new Error("CDP command deadline " + method)); }, 5_000); pending.set(requestId, { resolve, reject, timer }); socket!.send(JSON.stringify({ id: requestId, method, params })); });
    await send("Runtime.enable");
    await send("Page.navigate", { url: `http://127.0.0.1:${server.port}/` });
    await send("Page.bringToFront");
    let result: { passed?: boolean; checks?: string[]; error?: string; body?: string } | undefined;
    while (Date.now() < expires) {
      const observed = await send("Runtime.evaluate", { expression: "window.crmTaskProof && JSON.stringify(window.crmTaskProof)", returnByValue: true });
      if (observed.result.value) { result = JSON.parse(observed.result.value); break; }
      await Bun.sleep(25);
    }
    if (!result) throw new Error("Mounted CRM task proof exceeded its deadline");
    expect(result.passed, JSON.stringify(result)).toBe(true);
    expect(result.checks).toHaveLength(5);
    passed = true;
  } finally {
    if (child) await terminateOwnedProcess(child, send ? () => send!("Browser.close") : undefined);
    socket?.close();
    server.stop(true);
    if (passed) await rm(proof, { recursive: true, force: true });
  }
}, 40_000);
