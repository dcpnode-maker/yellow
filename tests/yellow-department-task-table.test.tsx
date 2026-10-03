import { expect, test } from "bun:test";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { resolveChromiumPath } from "./helpers/chromium-path";
import { fetchJsonBounded, terminateOwnedProcess } from "./helpers/owned-cdp-proof-lifecycle";

test("actual department queue table filters, existing transition controls and CRM soft route", async () => {
  const chrome = resolveChromiumPath();
  if (!chrome) throw new Error("Installed Chromium is required for department task proof");
  const root = resolve(import.meta.dir, "..");
  const proof = await mkdtemp(resolve(root, ".department-task-proof-"));
  const entry = resolve(proof, "fixture.tsx");
  const app = await readFile(resolve(root, "frontend/yellow/src/App.tsx"), "utf8");
  const workflowStart = app.indexOf("  const workflow = (part: string) => {");
  const workflow = app.slice(workflowStart, app.indexOf("  const continueCrs", workflowStart));
  await writeFile(entry, `
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import OperationalHub from ${JSON.stringify(resolve(root, "frontend/yellow/src/workspaces/OperationalHub.tsx"))};
import {OperatorHeader} from ${JSON.stringify(resolve(root, "frontend/yellow/src/ui/OperatorHeader.tsx"))};
import {configureYellowApi} from ${JSON.stringify(resolve(root, "frontend/yellow/src/yellow-api.tsx"))};
import {reactAuthSession} from ${JSON.stringify(resolve(root, "frontend/yellow/src/auth-session.ts"))};
import {installWorkspaceNavigation,navigateYellow,readWorkspaceRoute} from ${JSON.stringify(resolve(root, "frontend/yellow/src/workspace-navigation.ts"))};
import {reservationViewForDestination,reservationViewHref} from ${JSON.stringify(resolve(root, "frontend/yellow/src/reservation-navigation.ts"))};
import ${JSON.stringify(resolve(root, "frontend/yellow/src/styles.css"))};
import ${JSON.stringify(resolve(root, "frontend/yellow/src/ui/reference-theme.css"))};
const propertyId='00000000-0000-4000-8000-000000000001', actor='00000000-0000-4000-8000-000000000002', tenant='00000000-0000-4000-8000-000000000003';
const reservationLifecycleBusyRef={current:false},voiceTransferRecoveryLockedRef={current:false},propertyModeNavigationLocked=false,internalMarketLabEnabled=false;
${workflow}
const base={requestId:'request-one',reservationId:'reservation-one',segmentId:'segment-one',spaceId:'room-one',serviceKind:'luggage_pickup',parentRequestId:null,targetRoleId:'role-one',targetRoleName:'Bell desk',proposalStatus:'confirmed',version:7,expiresAt:'2026-10-04T12:00:00Z',departureAt:'2026-10-04T10:00:00Z',dueAt:null,dueLocal:null,timezone:'UTC',taskId:'task-one',taskStatus:'assigned',assigneePartyId:'staff-one',outcome:null,completedAt:null,eligibleActions:['start']};
let rows=[base,{...base,requestId:'request-two',reservationId:'reservation-two',spaceId:'room-two',serviceKind:'minibar_check',targetRoleId:'role-two',targetRoleName:'Housekeeping',taskStatus:'open',assigneePartyId:null,eligibleActions:['assign']},{...base,requestId:'request-three',reservationId:'reservation-three',spaceId:'room-three',serviceKind:'room_inspection',targetRoleId:null,targetRoleName:null,taskStatus:'in_progress',assigneePartyId:'staff-three',eligibleActions:['complete']},{...base,requestId:'request-four',reservationId:'reservation-four',spaceId:'room-four',serviceKind:'escalation',targetRoleId:'role-two',targetRoleName:'Housekeeping',taskStatus:'done',assigneePartyId:null,eligibleActions:[]}];
const staff=[{partyId:'staff-one',name:'Returned Staff One'},{partyId:'staff-two',name:'Returned Staff Two'},{partyId:'staff-three',name:'Returned Staff Three'}];
let mode='held',release;const calls=[],checks=[];
window.fetch=async(input,init)=>{const url=String(input),method=init?.method||'GET';calls.push({url,method,body:init?.body,headers:init?.headers});const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}});
 if(url.includes('/auth/local:login'))return json({accessToken:'synthetic.'+btoa(JSON.stringify({sub:actor,tid:tenant}))+'.signature',tokenType:'Bearer',expiresInSeconds:900,user:{id:actor,displayName:'Synthetic staff'}});
 if(url.includes('/me/properties'))return json({properties:[{id:propertyId,name:'Synthetic property',timezone:'UTC'}]});
 if(url.endsWith('/operating-mode'))return json({},503);
 if(method==='POST'){return json({request:rows.find(row=>url.includes(row.requestId)),replayed:false})};
 if(url.includes('/reservations/'))return json({reservationId:url.split('/reservations/')[1].split('/')[0],reservationStatus:'confirmed',timezone:'UTC',evidence:null,roles:[],staff,requests:[]});
 if(url.endsWith('/departure-services')){if(mode==='held')return new Promise(resolve=>release=()=>resolve(json({requests:rows})));if(mode==='error')return json({},403);return json({requests:mode==='empty'?[]:mode==='cap'?Array.from({length:100},(_,index)=>({...base,requestId:'cap-'+index})):rows})};
 return json({},404);
};
const assert=(ok,message)=>{if(!ok)throw Error(message)};const tick=()=>new Promise(resolve=>setTimeout(resolve,15));const wait=async(predicate)=>{for(let index=0;index<350;index++){if(predicate())return;await tick()}throw Error('observation timed out '+document.body.textContent.slice(-600))};
const ids=()=>[...document.querySelectorAll('tbody tr')].map(node=>node.dataset.requestId);
const field=text=>[...document.querySelectorAll('.department-task-filters label')].find(node=>node.firstChild.textContent===text)?.querySelector('select,input');
const set=async(name,value)=>{const node=field(name);assert(node,'field '+name);Object.getOwnPropertyDescriptor(node instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(node,value);node.dispatchEvent(new Event(node instanceof HTMLSelectElement?'change':'input',{bubbles:true}));await tick()};
const clear=async()=>{document.querySelector('.department-task-filters button').click();await tick()};
let pointerSequence=0;const pointer=async(text)=>{const node=[...document.querySelectorAll('button,summary')].filter(node=>node.getClientRects().length).find(node=>node.getAttribute('aria-label')===text||node.textContent.trim()===text);assert(node,'pointer '+text);node.scrollIntoView({block:'center'});const r=node.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;assert(node.contains(document.elementFromPoint(x,y)),'pointer target obstructed '+text);const sequence=++pointerSequence;window.pointerRequest={sequence,x,y};await wait(()=>window.pointerDone===sequence);await tick()};
const query=new QueryClient({defaultOptions:{queries:{retry:false,refetchOnWindowFocus:false}}}),root=createRoot(document.getElementById('root'));let updateHref;
const empty={data:[],isLoading:false,isError:false};
function Page(){const [href,setHref]=useState(location.pathname+location.search);updateHref=setHref;const route=readWorkspaceRoute(href);return <QueryClientProvider client={query}><div className="yellow-next"><OperatorHeader workspace="operations" propertyId={propertyId} propertyName="Synthetic property" locked={false} onNavigate={workflow} onBilling={()=>{}}><strong>Yellow</strong></OperatorHeader><main><OperationalHub propertyName="Synthetic property" initialView={new URLSearchParams(route.search).get('view')==='tasks'?'tasks':'rooms'} arrivals={empty} departures={empty} rooms={empty} blocks={empty} onNavigate={workflow} onOpenReservation={()=>{}}/></main></div></QueryClientProvider>};
(async()=>{
 configureYellowApi(propertyId);await reactAuthSession.signIn({tenant:'synthetic',email:'synthetic@example.invalid',password:'synthetic'},propertyId);history.replaceState(null,'','/p/'+propertyId+'/operations?view=tasks');flushSync(()=>root.render(<Page/>));installWorkspaceNavigation({propertyId,canNavigate:()=>!reservationLifecycleBusyRef.current,onNavigate:href=>updateHref(href)});
 await wait(()=>document.body.textContent.includes('Loading departure service queue'));assert(!document.querySelector('table'),'loading hides task table');checks.push('actual query loading state');await wait(()=>!!release);mode='normal';release();await wait(()=>ids().length===4);assert(document.querySelector('[role=tab][aria-selected=true]').textContent.includes('Tasks'),'direct URL Tasks tab');checks.push('direct task URL and returned table');
 await set('Status','in_progress');assert(ids().join(',')==='request-three','status table filter');checks.push('status filter');await clear();
 await set('Service','minibar_check');assert(ids().join(',')==='request-two','service table filter');checks.push('service filter');await clear();
 await set('Role target','role:role-two');assert(ids().join(',')==='request-two,request-four','role table filter');checks.push('role filter');await clear();
 await set('Assignment','false');assert(ids().join(',')==='request-two,request-four','assignment table filter');checks.push('assignment filter');await clear();
 await set('Search loaded tasks','RETURNED STAFF THREE');assert(ids().join(',')==='request-three','actual returned staff search');checks.push('returned staff field search');await clear();
 await set('Status','open');await set('Service','minibar_check');await set('Role target','role:role-two');await set('Assignment','false');await set('Search loaded tasks','room-two');assert(ids().join(',')==='request-two','combined filters');checks.push('all filter conjunction');
 assert(!document.querySelector('details[open]'),'row details closed');document.querySelector('tbody summary').click();assert(document.querySelector('tbody details').open,'selected details open');assert(document.querySelector('tbody button').disabled,'assignment needs returned active staff');document.querySelector('tbody select').value='staff-two';document.querySelector('tbody select').dispatchEvent(new Event('change',{bubbles:true}));await tick();document.querySelector('tbody button').click();await wait(()=>calls.some(call=>call.method==='POST'&&call.url.includes('/departure-services/')));
 const assigned=calls.find(call=>call.method==='POST'&&call.url.includes('/departure-services/'));assert(assigned.url.endsWith('/request-two/assign')&&JSON.stringify(JSON.parse(assigned.body))===JSON.stringify({expectedVersion:7,staffPartyId:'staff-two',outcome:null}),'original assignment body');assert(assigned.headers['idempotency-key']==='yellow-departure-queue-assign-request-two','original key');checks.push('existing assignment guards body version and key');await clear();
 await set('Search loaded tasks','does not exist');assert(ids().length===0&&document.body.textContent.includes('No loaded requests match'),'match empty state');checks.push('filtered empty state');await clear();
 mode='empty';await query.invalidateQueries({queryKey:['operational-departure-service-queue']});await wait(()=>document.body.textContent.includes('No open departure service requests'));assert(!document.querySelector('table'),'empty returned queue');checks.push('returned empty state');
 mode='error';await query.invalidateQueries({queryKey:['operational-departure-service-queue']});await wait(()=>document.body.textContent.includes('Departure service queue unavailable'));assert(!document.querySelector('table'),'error hides retained table');checks.push('query error state');
 mode='cap';await query.invalidateQueries({queryKey:['operational-departure-service-queue']});await wait(()=>ids().length===100);assert(document.body.textContent.includes('more requests may exist'),'100 cap incomplete');checks.push('loaded cap notice');mode='normal';await query.invalidateQueries({queryKey:['operational-departure-service-queue']});await wait(()=>ids().length===4);
 workflow('operations');await wait(()=>document.querySelector('[role=tab][aria-selected=true]').textContent.includes('Rooms'));assert(!document.querySelector('table'),'room view preserved');await pointer('CRM');await pointer('Department tasks');await wait(()=>ids().length===4);assert(location.pathname+location.search==='/p/'+propertyId+'/operations?view=tasks','CRM soft route');checks.push('actual CRM pointer task route');
 history.back();await wait(()=>!location.search);await wait(()=>document.querySelector('[role=tab][aria-selected=true]').textContent.includes('Rooms'));history.forward();await wait(()=>location.search==='?view=tasks');await wait(()=>ids().length===4);checks.push('Back Forward Tasks view sync');
 reservationLifecycleBusyRef.current=true;workflow('operations');assert(location.search==='?view=tasks','existing workflow lock preserved');reservationLifecycleBusyRef.current=false;checks.push('workflow mutation guard');
 window.departmentProof={passed:true,checks,calls};
})().catch(error=>window.departmentProof={passed:false,error:String(error),checks,body:document.body.textContent.slice(-1600)});
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
    const expires = Date.now()+35_000;
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
      await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
      await send('Page.navigate',{url:`http://127.0.0.1:${server.port}/`});
      await send('Page.bringToFront');
      await send('Emulation.setFocusEmulationEnabled',{enabled:true});
      let handled=0;
      while(Date.now()<expires) {
        const state=await send('Runtime.evaluate',{expression:"JSON.stringify({proof:window.departmentProof&&JSON.stringify(window.departmentProof),pointer:window.pointerRequest})",returnByValue:true});
        const observation=JSON.parse(state.result.value);
        if(observation.proof){evidence=JSON.parse(observation.proof);break;}
        if(observation.pointer?.sequence>handled){const {x,y,sequence}=observation.pointer;
          await send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});
          await send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1});
          await send('Runtime.evaluate',{expression:'window.pointerDone='+sequence});handled=sequence;}
        await Bun.sleep(20);
      }
      if(!evidence) { diagnostics.push(await send('Runtime.evaluate',{expression:'document.documentElement.outerHTML',returnByValue:true}));await writeFile(resolve(proof,'failure.json'),JSON.stringify(diagnostics,null,2));throw new Error('Mounted browser proof exceeded 20-second deadline: '+JSON.stringify(diagnostics).slice(-3000)); }
      await writeFile(resolve(proof,"receipt.json"),JSON.stringify(evidence,null,2));
      for (const width of [1440,375]) {
        await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
        await Bun.sleep(80);
        const bounds = await send('Runtime.evaluate',{expression:'JSON.stringify({width:innerWidth,scroll:document.documentElement.scrollWidth,right:document.querySelector(".department-task-dashboard").getBoundingClientRect().right,buttons:[...document.querySelectorAll(".department-task-filters button")].every(node=>node.getBoundingClientRect().height>=44)})',returnByValue:true});
        const layout = JSON.parse(bounds.result.value);
        await writeFile(resolve(proof,`layout-${width}.json`),JSON.stringify(layout));
        expect(layout.scroll).toBeLessThanOrEqual(width);
        expect(layout.right).toBeLessThanOrEqual(width);
        expect(layout.buttons).toBe(true);
        const shot = await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
        await writeFile(resolve(proof,`department-${width}.png`),Buffer.from(shot.data,'base64'));
      }
    } finally { await terminateOwnedProcess(child,send?()=>send!('Browser.close'):undefined);socket?.close(); }
    expect(evidence.passed, JSON.stringify(evidence)).toBe(true);
    expect(evidence.checks).toHaveLength(16);
  } finally { server.stop(true); }
}, 45_000);
