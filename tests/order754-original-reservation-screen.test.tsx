import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, sep } from "node:path";
import { resolveChromiumPath } from "./helpers/chromium-path";
import { fetchJsonBounded, terminateOwnedProcess } from "./helpers/owned-cdp-proof-lifecycle";
type Send = <T = unknown>(method: string, params?: Record<string, unknown>) => Promise<T>;
const repository = resolve(import.meta.dir, "..");
const P="00000000-0000-4000-8000-000000000001", P2="00000000-0000-4000-8000-000000000020", G="00000000-0000-4000-8000-000000000004";
const rows=[{reservationId:"00000000-0000-4000-8000-000000000005",confirmationNo:"Y-101",primaryGuestDisplayName:"Synthetic Alice",status:"due_in",operationalState:"due_in",stayFrom:"2026-10-02T14:00:00Z",stayTo:"2026-10-04T10:00:00Z",unitTypeLabel:"Villa",channelCode:"airbnb"},{reservationId:"00000000-0000-4000-8000-000000000006",confirmationNo:"Y-102",primaryGuestDisplayName:"Synthetic Bob",status:"cancelled",operationalState:"cancelled",stayFrom:"2026-10-06T14:00:00Z",stayTo:"2026-10-08T10:00:00Z",unitTypeLabel:"Suite",channelCode:"direct"}];
const group={groupId:G,kind:"linked",code:"GRP-1",name:"Synthetic wedding",status:"active",memberCount:1,roomsHeldByGroup:false};
test("order754 mounted original reservation shell: desktop/mobile, stages, shared table, persistent drafts/groups and guarded same-key recovery",async()=>{
 const executable=resolveChromiumPath();if(!executable)throw new Error("Owned Chromium required");
 const directory=await mkdtemp(resolve(tmpdir(),"yellow-order754-owned-")),profile=resolve(directory,"profile");
 const proof=process.env.YELLOW_ORDER754_PROOF_DIR?resolve(process.env.YELLOW_ORDER754_PROOF_DIR):resolve(directory,"proof");await mkdir(proof,{recursive:true});
 let server:ReturnType<typeof Bun.serve>|undefined,chrome:ReturnType<typeof Bun.spawn>|undefined,socket:WebSocket|undefined;
 const errors:string[]=[],reads:string[]=[],writes:string[]=[];let boardFail=false,groupFail=false,journeyFail=false;
 const commits:{key:string|null;body:string}[]=[];
 let holdOffers=false,releaseOffers:(()=>void)|undefined;
 let holdArrival=false,releaseArrival:(()=>void)|undefined,denySecondPage=false,releaseSecondPage:(()=>void)|undefined;
 const PARTY="00000000-0000-4000-8000-000000000009", UNIT="00000000-0000-4000-8000-000000000010", RATE="00000000-0000-4000-8000-000000000011";
 try{
 const entry=resolve(directory,"entry.tsx");
 await writeFile(entry,`import React from ${JSON.stringify(resolve(repository,"node_modules/react"))};
import {createRoot} from ${JSON.stringify(resolve(repository,"node_modules/react-dom/client"))};
import {QueryClient,QueryClientProvider} from ${JSON.stringify(resolve(repository,"node_modules/@tanstack/react-query/build/modern/index.js"))};
import {AuthenticationGate} from ${JSON.stringify(resolve(repository,"frontend/yellow/src/AuthenticationGate.tsx"))};
import ${JSON.stringify(resolve(repository,"frontend/yellow/src/styles.css"))};
import ${JSON.stringify(resolve(repository,"frontend/yellow/src/ui/reference-theme.css"))};
const {App}=await import(${JSON.stringify(resolve(repository,"frontend/yellow/src/App.tsx"))});
window.resBootId=crypto.randomUUID();
const client=new QueryClient({defaultOptions:{queries:{retry:false,refetchOnWindowFocus:false}}});window.order754QueryClient=client;
createRoot(document.getElementById('root')).render(React.createElement(QueryClientProvider,{client},React.createElement(AuthenticationGate,null,React.createElement(App))));`);
 const builder=resolve(directory,"build.ts");await writeFile(builder,`const result=await Bun.build({entrypoints:[${JSON.stringify(entry)}],outdir:${JSON.stringify(resolve(directory,"build"))},target:'browser',format:'esm',define:{'process.env.NODE_ENV':'"production"'}});if(!result.success){console.error(result.logs);process.exit(1)}`);
 const compiler=Bun.spawn([process.execPath,builder],{cwd:repository,stdout:"pipe",stderr:"pipe",windowsHide:true});
 const outputs=Promise.all([new Response(compiler.stdout).text(),new Response(compiler.stderr).text()]);
 const timer=setTimeout(()=>compiler.kill(),10000);let status:number;try{status=await compiler.exited}finally{clearTimeout(timer)}if(status!==0)throw new Error((await outputs).join("\n"));await outputs;
 server=Bun.serve({hostname:"127.0.0.1",port:0,async fetch(request){
 const url=new URL(request.url),path=url.pathname;
 if(!path.startsWith('/api/')){if(path.endsWith('.js')||path.endsWith('.css')){const file=resolve(directory,'build',path.slice(1));if(!file.startsWith(resolve(directory,'build')+sep)||!existsSync(file))return new Response('missing',{status:404});return new Response(Bun.file(file),{headers:{'content-type':path.endsWith('.css')?'text/css':'text/javascript'}})}return new Response('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/entry.css"><div id="root"></div><script type="module" src="/entry.js"></script></html>',{headers:{'content-type':'text/html'}})}
 if(path==='/api/v1/auth/browser/resume'){const payload=Buffer.from(JSON.stringify({sub:'00000000-0000-4000-8000-000000000003',tid:'00000000-0000-4000-8000-000000000002'})).toString('base64url');return Response.json({accessToken:`synthetic.${payload}.signature`,tokenType:'Bearer',expiresInSeconds:900,user:{id:'00000000-0000-4000-8000-000000000003',displayName:'Synthetic staff'}})}
 if(request.method!=="GET") {
   writes.push(request.method+" "+path);
   if(path.endsWith("/parties:search"))return Response.json({profiles:[{partyId:PARTY,displayName:"Synthetic Alice",kind:"person",roles:["guest"]}]});
   if(path.endsWith("/availability:search")){const body=await request.json() as {stay:{from:string;to:string}};if(holdOffers)await new Promise<void>(resolveOffer=>{releaseOffers=resolveOffer});return Response.json({options:[{option_ref:"synthetic-754",bookable:true,sellable_unit:{id:UNIT,name:"Synthetic Villa"},unit_type:{code:"VILLA"},rate_plan:{id:RATE,code:"BAR"},available_count:1,promise:false,commit_arbitration_required:true,stay:body.stay,total:{amount_minor:"10000",currency:"INR",kind:"stay"}}]});}
   if(path==="/api/v1/reservations:commit"){commits.push({key:request.headers.get("idempotency-key"),body:await request.text()});return Response.json({error:{code:"synthetic_transport",message:"Synthetic response unavailable"}},{status:503});}
   return Response.json({},{status:405});
 }reads.push(path+url.search);
 if(path==='/api/v1/me/properties')return Response.json({properties:[{id:P,name:'Synthetic property',timezone:'UTC'},{id:P2,name:'Synthetic second property',timezone:'UTC'}]});
 if(path.endsWith('/reservation-board')){
   const stage=url.searchParams.get('stage');
   if(stage==='arrival'&&holdArrival)await new Promise<void>(resolveArrival=>{releaseArrival=resolveArrival});
   if(stage==='departure'&&denySecondPage&&url.searchParams.has('after')){await new Promise<void>(resolvePage=>{releaseSecondPage=resolvePage});return Response.json({},{status:403});}
   if(stage?journeyFail:boardFail)return Response.json({},{status:503});
   const selected=stage==='post_departure'?[]:stage==='departure'?[rows[1]]:stage?[rows[0]]:rows;
   return Response.json({reservations:selected,nextCursor:stage==='departure'&&denySecondPage?'synthetic-second-page':null,...(stage?{businessDate:stage==='departure'?'2026-09-18':'2026-09-17'}:{})});
 }
 if(path.endsWith('/operational-blocks'))return Response.json({operationalBlocks:[]});
 if(path.endsWith('/reservation-calendar')){
   const from=url.searchParams.get('from')!,to=url.searchParams.get('to')!;
   // One real synthetic stay retains its identity across all requested months.
   // Monthly clip bounds may differ; canonical dates and instants may not.
   const stayFrom=rows[0]!.stayFrom,stayTo=rows[0]!.stayTo;
   const localFrom=stayFrom.slice(0,10),localTo=stayTo.slice(0,10);
   const clipFrom=localFrom<from?from:localFrom,clipTo=localTo>to?to:localTo;
   const room={sellableUnitId:UNIT,sellableUnitLabel:'Villa 101',unitTypeId:RATE,unitTypeCode:'VILLA',unitTypeLabel:'Villa',roomCondition:null,outOfService:null};
   return Response.json({propertyId:P,timezone:'UTC',fromDate:from,toDateExclusive:to,limit:1000,limited:false,roomLimit:500,roomsLimited:false,rooms:[room],segments:clipFrom<clipTo?[{...room,reservationId:rows[0]!.reservationId,confirmationNo:'Y-101',primaryGuestDisplayName:'Synthetic Alice',reservationStatus:'due_in',segmentId:G,segmentSeq:1,segmentStatus:'booked',stayFrom,stayTo,localFromDate:localFrom,localToDateExclusive:localTo,clipFromDate:clipFrom,clipToDateExclusive:clipTo,continuesBefore:localFrom<from,continuesAfter:localTo>to}]:[]});
 }
 if(path.endsWith('/groups')&&groupFail)return Response.json({},{status:503});
 if(path.endsWith('/groups'))return Response.json({groups:!url.searchParams.get('q')||group.name.includes(url.searchParams.get('q')!)?[group]:[],nextCursor:null});
 if(path.endsWith('/groups/'+G))return Response.json({group,members:[{reservationId:rows[0]!.reservationId,confirmationNo:'Y-101',guestName:'Synthetic Alice',status:'due_in'}],nextMemberCursor:null});
 if(path.endsWith('/group-blocks'))return Response.json({groups:[]});
 return Response.json({},{status:503});
 }});
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
      if (data.method === "Page.javascriptDialogOpening" && data.params.type === "beforeunload" && permitReload) {
        permitReload = false; void send("Page.handleJavaScriptDialog", { accept: true });
      }
      if (data.id) { const pending = callbacks.get(data.id); if (!pending) return; clearTimeout(pending.timer); callbacks.delete(data.id);
        if (data.error) pending.reject(new Error(data.error.message)); else pending.resolve(data.result); } };
    const send: Send = <T,>(method: string, params = {}) => new Promise<T>((resolveResult, reject) => {
      if (method === "Page.reload" || method === "Page.navigate") permitReload = true; // Explicit test approval of a warned reload.
      const id = ++counter, timer = setTimeout(() => { callbacks.delete(id); reject(new Error(`CDP deadline ${method}`)); }, 12000);
      callbacks.set(id, { resolve: value => resolveResult(value as T), reject, timer }); socket!.send(JSON.stringify({ id, method, params }));
    });
    const read = async <T,>(expression: string): Promise<T> => { const result = await send<{ result?: { value?: T }; exceptionDetails?: unknown }>("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(`Read expression failed: ${expression}; ${JSON.stringify(result.exceptionDetails)}`); return result.result?.value as T; };
    const until = async (expression: string, label: string) => { for (let i = 0; i < 400; i++) { if (await read<boolean>(expression)) return; await Bun.sleep(25); }
      throw new Error(`Timed out ${label}: ${await read<string>("document.body.innerText")}; errors ${JSON.stringify(errors)}`); };
    const click = async (text: string) => {
      const coordinates = await read<{ x: number; y: number }>(`(async()=>{const text=${JSON.stringify(text)},selector=['Individual','Groups','Calendar'].includes(text)?'.reservation-workspace-tabs button':text==='Close navigation'?'.operator-navigation-heading button':'button,label,summary',el=[...document.querySelectorAll(selector)].filter(n=>n.getClientRects().length).find(n=>n.getAttribute('aria-label')===text||n.textContent.trim()===text||(n.tagName==='BUTTON'&&n.textContent.trim().startsWith(text))||(n.tagName==='LABEL'&&n.textContent.includes(text)));if(!el)throw new Error('Missing control '+text);el.scrollIntoView({block:'center',behavior:'instant'});await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);const r=el.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,hit=document.elementFromPoint(x,y);if(hit!==el&&!el.contains(hit))throw new Error('Occluded control '+text+' by '+hit?.textContent);return{x,y}})()`);
      if (await read<boolean>("innerWidth<=980")) {
        await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...coordinates, radiusX: 1, radiusY: 1, force: 1, id: 1 }] });
        await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      } else {
        await send("Input.dispatchMouseEvent", { type: "mousePressed", ...coordinates, button: "left", clickCount: 1 });
        await send("Input.dispatchMouseEvent", { type: "mouseReleased", ...coordinates, button: "left", clickCount: 1 });
      }
      await Bun.sleep(30);
    };

 await send("Page.enable");await send("Runtime.enable");
 const setSelect=async(label:string,value:string)=>read(`(()=>{const el=[...document.querySelectorAll('label')].filter(n=>n.getClientRects().length).find(n=>n.textContent.startsWith(${JSON.stringify(label)}))?.querySelector('select');if(!el)throw new Error('Missing select '+${JSON.stringify(label)});el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 const input=async(selector:string,value:string)=>{await read(`document.querySelector(${JSON.stringify(selector)}).focus()`);await send('Input.dispatchKeyEvent',{type:'keyDown',key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2});if(value)await send('Input.insertText',{text:value});else await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Backspace',code:'Backspace',windowsVirtualKeyCode:8});};
 const screenshot=async(name:string)=>{const result=await send<{data:string}>('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(resolve(proof,name+'.png'),Buffer.from(result.data,'base64'));};
 const navigate=async(search='')=>{await send('Page.navigate',{url:`http://127.0.0.1:${server!.port}/p/${P}/reservations${search}`});await until("!!document.querySelector('.reservation-journey-shell')",'actual lazy reservation workspace');};
 const visibleRows="[...document.querySelectorAll('.movement-data-row')].filter(n=>n.getClientRects().length)";
 const clickSelector=async(selector:string)=>{
   const point=await read<{x:number;y:number}>(`(async()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)throw new Error('Missing selector');el.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);const r=el.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,hit=document.elementFromPoint(x,y);if(hit!==el&&!el.contains(hit))throw new Error('Occluded '+${JSON.stringify(selector)}+' by '+hit?.textContent);return{x,y}})()`);
   await send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});await Bun.sleep(30);
 };
 const selectCalendarUnit=async()=>{await until("!!document.querySelector('.host-calendar')",'native host calendar');if(await read<boolean>("!!document.querySelector('.host-calendar-room-card')")){await until(`!!document.querySelector('[data-host-row="unit:${UNIT}"]')`,'actual unit card');await clickSelector(`[data-host-row="unit:${UNIT}"]`);}await until("!!document.querySelector('.host-booking-bar')",'current Calendar native-shaped segments');};
 if(process.env.YELLOW_ORDER754_ROUTING_ONLY==='1'){
   await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
   for(const [view,selector] of [['list','.movement-workspace'],['groups','.reservation-group-search'],['crs','[aria-label="Staff CRS"]'],['calendar','.host-calendar-room-card']] as const){
     await navigate('?view='+view);await until(`!!document.querySelector(${JSON.stringify(selector)}) && document.querySelector(${JSON.stringify(selector)}).getClientRects().length>0`,'mounted destination '+view);
     expect(await read<string>('location.search')).toBe('?view='+view);
     expect(await read<boolean>("!!document.querySelector('.operator-header')")).toBe(true);
   }
   await selectCalendarUnit();const boot=await read<string>('window.resBootId');await clickSelector('.host-booking-bar');await until("!!document.querySelector('.host-open-reservation')",'Calendar selected recorded segment');
   // A test-owned veto exercises the actual App controller, without changing
   // reservation state or replacing the Calendar callback under test.
   await read("window.order754Veto=e=>e.preventDefault();window.addEventListener('beforeunload',window.order754Veto)");
   await click('Open reservation');expect(await read<string>('location.pathname')).toBe(`/p/${P}/reservations`);expect(await read<string>('window.resBootId')).toBe(boot);
   await read("window.removeEventListener('beforeunload',window.order754Veto)");await click('Open reservation');await until(`location.pathname==='/p/${P}/res/${rows[0]!.reservationId}'`,'guarded Calendar accepted reservation/property');expect(await read<string>('window.resBootId')).toBe(boot);
   await read('history.back()');await until("!!document.querySelector('.host-calendar')",'history returns current Calendar');expect(await read<string>('location.search')).toBe('?view=calendar');expect(writes).toEqual([]);expect(errors).toEqual([]);await screenshot('retained-calendar-routing');return;
 }
 for(const width of [1440,375]){
   await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width===375});await send('Emulation.setTouchEmulationEnabled',{enabled:width===375});await navigate();
   await until(visibleRows+'.length===1','server arrival rows');
   expect(await read<string>("document.querySelector('.reservation-journey-date').textContent")).toContain('2026-09-17');
   expect(await read<boolean>("!!document.querySelector('.operator-header')")).toBe(true);
   expect(await read<number>("document.querySelectorAll('.reservation-journey-ribbon button').length")).toBe(6);
   const boot=await read<string>('window.resBootId');
   await screenshot('arrival-'+width);
   for(const [label,stage,count] of [['Pre-arrival','pre_arrival',1],['In house','in_house',1],['Departure','departure',1],['Post departure','post_departure',0],['Arrival','arrival',1]] as const){
     await click(label);await until(`document.querySelector('.movement-workspace h1').textContent===${JSON.stringify(label)} && ${visibleRows}.length===${count}`,'exact server stage '+stage);
     expect(await read<string>('location.search')).toContain('stage='+stage);
     expect(reads.some(url=>url.includes('stage='+stage))).toBe(true);
     expect(await read<string>('window.resBootId')).toBe(boot);
     if(count===0){await until("document.body.innerText.includes('No reservations match this view')",'explicit empty server stage');expect(await read<boolean>("!!document.querySelector('.movement-workspace .error')")).toBe(false);await screenshot('empty-'+width);}
   }
   // An in-house stage deliberately returns a due_in record: the UI must render
   // the explicit server stage instead of approximating it by client status.
   await click('In house');await until(visibleRows+'.length===1','overlap');expect(await read<string>(visibleRows+'[0].textContent')).toContain('Y-101');
   await click('All reservations');await until(visibleRows+'.length===2','legacy all including cancelled');
   await input('input[aria-label="Search All reservations"]','Alice');await until(visibleRows+'.length===1','actual shared search');
   await click('Arrival');await until(visibleRows+'.length===1','independent arrival filter');await click('All reservations');await until(visibleRows+'.length===1','retained All filter');
   expect(await read<string>("document.querySelector('input[aria-label=\"Search All reservations\"]').value")).toBe('Alice');
   await click('Reset table controls');await until(visibleRows+'.length===2','reset table');
   await clickSelector('.movement-table-controls .voice-field-mic');await until("!!document.querySelector('.voice-field-panel')",'microphone disclosure');
   expect(await read<string>("document.querySelector('.voice-field-panel').textContent")).toContain('browser vendor');await click('Cancel');
   await clickSelector('.table-column-trigger');await until("!!document.querySelector('.table-column-menu')",'actual column dialog');await clickSelector('.table-column-menu .table-column-actions button:nth-child(2)');
   expect(await read<string>(visibleRows+'[0].textContent')).toContain('Synthetic Bob');
   expect(await read<string>("document.querySelector('[role=columnheader]').getAttribute('aria-sort')")).toBe('descending');
   await clickSelector('.copy-cell-button');await until("['copied','failed','unavailable'].includes(document.querySelector('.copy-cell-button').dataset.outcome)",'explicit clipboard result');
   expect(await read<string>('location.pathname')).toContain('/reservations');
   await clickSelector('.table-controls-actions button:nth-child(3)');await until("!!document.querySelector('.table-columns-editor')",'columns editor');
   const columnsBefore=await read<number>("document.querySelector('.movement-grid').getAttribute('aria-colcount')*1");
   await clickSelector('.table-columns-editor input:checked');expect(await read<number>("document.querySelector('.movement-grid').getAttribute('aria-colcount')*1")).toBe(columnsBefore-1);await click('Close table editor');await click('Reset table controls');
   await clickSelector('.table-controls-actions button:first-child');await until("!!document.querySelector('.table-stay-criteria')",'filter disclosure');await setSelect('Channel','direct');await until(visibleRows+'.length===1','native authorized rows filter');expect(await read<string>(visibleRows+'[0].textContent')).toContain('Y-102');await click('Close table editor');await click('Reset table controls');
   await screenshot('all-'+width);expect(await read<number>('document.documentElement.scrollWidth')).toBeLessThanOrEqual(width+1);
   const scroll=await read<{client:number;total:number}>("(()=>{const el=document.querySelector('.movement-grid-scroll');return{client:el.clientWidth,total:el.scrollWidth}})()");expect(scroll.total).toBeGreaterThan(scroll.client);
   await click('New reservation');await until("!!document.querySelector('.reservation-create-next')",'existing creation form');
   await input('.reservation-create-fields input[type=number]','4');await input('.reservation-create-fields input:not([type])','7, 9');await screenshot('draft-'+width);
   await click('Groups');await until("!!document.querySelector('.reservation-group-search')",'groups mounted');
   expect(await read<boolean>("document.querySelector('.reservation-create-next').parentElement.hidden && document.querySelector('.reservation-create-next').parentElement.inert")).toBe(true);
   expect(await read<boolean>("!document.activeElement.closest('[hidden],[inert]')")).toBe(true);
   await input('.reservation-group-search-controls input','wedding');await click('Search group reservations');await until("document.querySelector('.reservation-group-results').textContent.includes('Synthetic wedding')",'server group search');
   await screenshot('groups-'+width);await click('Calendar');await selectCalendarUnit();await screenshot('calendar-'+width);
   await click('Individual');await until("document.querySelector('.reservation-create-next').getClientRects().length>0",'draft restored');
   expect(await read<string>("document.querySelector('.reservation-create-fields input[type=number]').value")).toBe('4');expect(await read<string>("document.querySelector('.reservation-create-fields input:not([type])').value")).toBe('7, 9');
   await click('Departure');expect(await read<string>("document.querySelector('.reservation-create-fields input[type=number]').value")).toBe('4');
   await click('Groups');expect(await read<string>("document.querySelector('.reservation-group-search-controls input').value")).toBe('wedding');await click('Synthetic wedding');await until("!!document.querySelector('.group-reservation-workspace')",'group membership mounted');
   await until("document.querySelector('.group-detail').textContent.includes('Synthetic Alice')",'group membership actual read');
   await click('Individual');await click('Close');await until(visibleRows+'.length===1','close draft');
   await read('history.back()');await until("document.querySelector('.reservation-workspace-tabs button[aria-pressed=true]').textContent==='Groups'",'history groups');await read('history.forward()');await until("document.querySelector('.reservation-workspace-tabs button[aria-pressed=true]').textContent==='Individual'",'history Individual');expect(await read<string>('window.resBootId')).toBe(boot);
   expect(await read<number>('document.documentElement.scrollWidth')).toBeLessThanOrEqual(width+1);
 }
 await navigate('?view=groups&group='+G);await until("document.querySelector('.group-detail')?.textContent.includes('Synthetic Alice')",'direct group');
 await read(`sessionStorage.setItem('yellow-group-create:${P}',JSON.stringify({key:'00000000-0000-4000-8000-000000000012',name:'Pending synthetic group'}))`);await navigate('?view=groups&group='+G);await until("document.body.innerText.includes('Reconcile same group request')",'uncertain group recovery');
 await click('Individual');expect(await read<string>('location.search')).toContain('view=groups');await click('Calendar');expect(await read<string>('location.search')).toContain('view=groups');await click('New reservation');expect(await read<boolean>("!!document.querySelector('.reservation-create-next')")).toBe(false);await click('Group management and room blocks');expect(await read<boolean>("document.querySelector('.reservation-group-management').open")).toBe(true);
 await read(`sessionStorage.removeItem('yellow-group-create:${P}')`);await navigate('?stage=all');await until(visibleRows+'.length===2','all direct route');
 await clickSelector('.movement-data-row [role=cell]:first-child');await until(`location.pathname.endsWith('/res/'+${JSON.stringify(rows[0]!.reservationId)}) || location.pathname.endsWith('/res/'+${JSON.stringify(rows[1]!.reservationId)})`,'row session route');await read('history.back()');await until("!!document.querySelector('.reservation-journey-shell')",'return from detail');
 await until(visibleRows+'.length===2','restored board');await clickSelector('.movement-billing-action');await until("location.search.includes('workspace=finance')&&location.search.includes('reservation=')",'existing cashier route');await read('history.back()');await until("!!document.querySelector('.reservation-journey-shell')",'return cashier');
 await click('Calendar');await selectCalendarUnit();await clickSelector('.host-booking-bar');await until("!!document.querySelector('.host-calendar-selection')",'calendar segment disclosure');await click('Open reservation');await until(`location.pathname.endsWith('/res/${rows[0]!.reservationId}')`,'existing calendar property callback');await read('history.back()');await until("!!document.querySelector('.reservation-journey-shell')",'return calendar details');
 boardFail=true;await navigate('?stage=all');await until("!!document.querySelector('.movement-workspace .error')",'All failure');expect(await read<number>(visibleRows+'.length')).toBe(0);boardFail=false;
 journeyFail=true;await navigate('?stage=arrival');await until("document.querySelector('.reservation-journey-date').textContent==='Business date unavailable'",'stage/date failure');expect(await read<number>(visibleRows+'.length')).toBe(0);await screenshot('journey-unavailable');journeyFail=false;
 groupFail=true;await click('Groups');await until("!!document.querySelector('.reservation-group-search .error')",'group read failure');groupFail=false;
 // Hold an actual Arrival HTTP response, choose Departure, then release the
 // older result. Distinct rows/date make a late overwrite observable.
 holdArrival=true;await navigate('?stage=arrival');await until("document.querySelector('.movement-workspace').getAttribute('aria-busy')==='true'",'phase loading');expect(await read<number>(visibleRows+'.length')).toBe(0);await screenshot('phase-loading');await click('Departure');await until(visibleRows+'.length===1','Departure before late Arrival');expect(await read<string>(visibleRows+'[0].textContent')).toContain('Y-102');expect(await read<string>("document.querySelector('.reservation-journey-date').textContent")).toContain('2026-09-18');holdArrival=false;releaseArrival?.();await until(`window.order754QueryClient.getQueryState(['reservation-journey',${JSON.stringify(P)},'arrival'])?.status==='success'`,'held Arrival query actually settled');expect(await read<string>("document.querySelector('.movement-workspace h1').textContent")).toBe('Departure');expect(await read<string>(visibleRows+'[0].textContent')).toContain('Y-102');expect(await read<string>("document.querySelector('.reservation-journey-date').textContent")).toContain('2026-09-18');await screenshot('phase-race-retained-departure');
 // A first authorized page is insufficient when the second page is denied.
 denySecondPage=true;await navigate('?stage=departure');await until("document.querySelector('.movement-workspace').getAttribute('aria-busy')==='true'",'paged loading');for(let i=0;i<200&&!releaseSecondPage;i++)await Bun.sleep(10);if(!releaseSecondPage)throw new Error('Second-page request missing');expect(await read<number>(visibleRows+'.length')).toBe(0);releaseSecondPage();await until("!!document.querySelector('.movement-workspace .error')",'denied second page fails closed');expect(await read<number>(visibleRows+'.length')).toBe(0);expect(await read<string>("document.querySelector('.reservation-journey-date').textContent")).toBe('Business date unavailable');await screenshot('second-page-denied');denySecondPage=false;
 // Full native-shaped creation through existing handlers. Both responses stay
 // explicitly uncertain; this does not claim a native commit or successful stay.
 await navigate('?stage=arrival');await click('New reservation');await input('.reservation-create-fields input[type=number]','3');const firstBoot=await read<string>('window.resBootId');
 await send('Page.navigate',{url:`http://127.0.0.1:${server!.port}/p/${P2}/reservations?stage=departure`});await until("!!document.querySelector('.reservation-journey-shell')",'second property native route');await until(visibleRows+'.length===1','second property stage');expect(await read<string>('window.resBootId')).not.toBe(firstBoot);expect(await read<boolean>("!!document.querySelector('.reservation-create-next')")).toBe(false);expect(reads.some(url=>url.includes(`/properties/${P2}/reservation-board?stage=departure`))).toBe(true);
 await navigate('?stage=arrival');await click('Departure');await click('Arrival');await click('New reservation');await click('Continue to guest');await input('.reservation-create-search input','Alice');await click('Search');await until("!!document.querySelector('.reservation-create-results button')",'Party read');await clickSelector('.reservation-create-results button');holdOffers=true;await click('Find current offers');await until("document.body.innerText.includes('Checking live inventory')",'real working state');const workingUrl=await read<string>('location.href');await click('Groups');expect(await read<string>('location.href')).toBe(workingUrl);await click('Calendar');expect(await read<string>('location.href')).toBe(workingUrl);await read('history.back()');await Bun.sleep(50);expect(await read<string>('location.href')).toBe(workingUrl);expect(await read<boolean>("document.querySelector('.reservation-create-next').getClientRects().length>0")).toBe(true);holdOffers=false;releaseOffers?.();await until("!!document.querySelector('.reservation-create-results.offers button')",'server offer');await clickSelector('.reservation-create-results.offers button');await click('Review reservation');await clickSelector('.reservation-create-confirm input');await click('Confirm and create reservation');
 await until("document.body.innerText.includes('Reconcile same request')",'uncertain create');expect(commits.length).toBe(1);const retainedUrl=await read<string>('location.href');
 await click('Groups');expect(await read<string>('location.href')).toBe(retainedUrl);await click('Calendar');expect(await read<string>('location.href')).toBe(retainedUrl);await click('Departure');expect(await read<string>('location.href')).toBe(retainedUrl);await click('Close');expect(await read<boolean>("!!document.querySelector('.reservation-create-next')")).toBe(true);
 await click('Reconcile same request');await until("document.querySelector('.reservation-create-actions button:last-child').textContent==='Reconcile same request'",'same-key retry finished');expect(commits.length).toBe(2);expect(commits[0]!.key).toBeTruthy();expect(commits[1]).toEqual(commits[0]);await screenshot('create-uncertain');
 expect(writes.filter(url=>!url.endsWith('/parties:search')&&!url.endsWith('/availability:search')&&!url.endsWith('/reservations:commit'))).toEqual([]);expect(errors).toEqual([]);
 }finally{
 releaseOffers?.();
 releaseArrival?.();releaseSecondPage?.();
 try { if(chrome)await terminateOwnedProcess(chrome); } finally { socket?.close();server?.stop(true); }
 await writeFile(resolve(proof,'observations.json'),JSON.stringify({syntheticOnly:true,actualFullApp:true,reads,writes,commits,errors,browserPid:chrome?.pid,browserExitVerified:chrome ? chrome.exitCode!==null||chrome.signalCode!==null : true,browserExitCode:chrome?.exitCode,browserSignalCode:chrome?.signalCode},null,2));
 const absolute=resolve(directory);if(!absolute.startsWith(resolve(tmpdir())+sep)||!absolute.split(sep).at(-1)?.startsWith('yellow-order754-owned-'))throw new Error('Cleanup containment failed');await rm(absolute,{recursive:true,force:true,maxRetries:10,retryDelay:100});
 }
},120000);
