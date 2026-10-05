import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { resolveChromiumPath } from "./helpers/chromium-path";
import { fetchJsonBounded, terminateOwnedProcess } from "./helpers/owned-cdp-proof-lifecycle";
type Send=<T=unknown>(method:string,params?:Record<string,unknown>)=>Promise<T>;
const repository=resolve(import.meta.dir,".."),P="00000000-0000-4000-8000-000000000001",P2="00000000-0000-4000-8000-000000000020";
const U="00000000-0000-4000-8000-000000000010",U2="00000000-0000-4000-8000-000000000011",U3="00000000-0000-4000-8000-000000000012",T="00000000-0000-4000-8000-000000000013",T2="00000000-0000-4000-8000-000000000014";
const R="00000000-0000-4000-8000-000000000005";
test("order762 actual App: account, pointer assistant and navigation available rectangle",async()=>{
  const executable=resolveChromiumPath();if(!executable)throw new Error("Owned Chromium required");
  const proof=resolve(process.env.YELLOW_ORDER762_PROOF_DIR??resolve(repository,"../proof/mounted762"));await mkdir(proof,{recursive:true});
  const directory=await mkdtemp(resolve(proof,"owned-")),profile=resolve(directory,"profile");
  let server:ReturnType<typeof Bun.serve>|undefined,chrome:ReturnType<typeof Bun.spawn>|undefined,socket:WebSocket|undefined;
  const errors:string[]=[],consoleErrors:string[]=[],reads:{property:string;from:string;to:string;scenario:string}[]=[],calendarWrites:string[]=[],authFixtureWrites:string[]=[],screenshots:string[]=[];
  const observations:Record<string,unknown>={syntheticOnly:true,actualFullApp:true,fixtureClock:"2026-10-04T12:00:00Z",physicalPhone:false};
  let scenario="normal",failMonth="",single=false,grantRemoved=false,holdNextBody=false,releaseBody:(()=>void)|undefined,heldBodies=0,activeReads=0,maxActiveReads=0;
  const releaseHeldBody=()=>{releaseBody?.();releaseBody=undefined;};
  function calendar(property:string,from:string,to:string,marker=false){
    const rooms=[{sellableUnitId:U,sellableUnitLabel:"Unit 101",unitTypeId:T,unitTypeCode:"KING",unitTypeLabel:"King",roomCondition:null,outOfService:null},
      {sellableUnitId:U2,sellableUnitLabel:"Unit 102",unitTypeId:T,unitTypeCode:"KING",unitTypeLabel:"King",roomCondition:"dirty",outOfService:null},
      {sellableUnitId:U3,sellableUnitLabel:"Villa 201",unitTypeId:T2,unitTypeCode:"VILLA",unitTypeLabel:"Villa",roomCondition:null,outOfService:null}];
    const raw=[{room:0,id:1,res:R,name:"Synthetic Alice",start:"2026-10-01",end:"2026-10-06",status:"due_in",segmentStatus:"booked"},
      {room:0,id:2,res:"00000000-0000-4000-8000-000000000006",name:"Synthetic Long Stay",start:"2026-10-20",end:"2027-01-10",status:"in_house",segmentStatus:"in_house"},
      {room:0,id:3,res:"00000000-0000-4000-8000-000000000007",name:"Synthetic Overlap",start:"2026-10-02",end:"2026-10-04",status:"reserved",segmentStatus:"booked"},
      {room:1,id:4,res:"00000000-0000-4000-8000-000000000008",name:"Synthetic Room Move",start:"2026-10-01",end:"2026-10-03",status:"in_house",segmentStatus:"departed"},
      {room:0,id:5,res:"00000000-0000-4000-8000-000000000008",name:"Synthetic Room Move",start:"2026-10-03",end:"2026-10-05",status:"in_house",segmentStatus:"in_house"},
      {room:-1,id:6,res:"00000000-0000-4000-8000-000000000009",name:"Synthetic Unassigned",start:"2026-10-02",end:"2026-10-05",status:"reserved",segmentStatus:"booked"},
      {room:0,id:7,res:"00000000-0000-4000-8000-000000000015",name:"Synthetic Day Use",start:"2026-10-09",end:"2026-10-09",status:"reserved",segmentStatus:"booked"}];
    const selectedRooms=single?rooms.slice(0,1):rooms;
    const segments=raw.filter(stay=>!single||stay.room===0).flatMap(stay=>{
      const effectiveEnd=stay.start===stay.end?new Date(Date.parse(stay.start+"T12:00:00Z")+86400000).toISOString().slice(0,10):stay.end;
      if(stay.start>=to||effectiveEnd<=from)return [];
      const room=stay.room<0?rooms[0]!:rooms[stay.room]!;
      return [{...room,sellableUnitId:stay.room<0?null:room.sellableUnitId,sellableUnitLabel:stay.room<0?null:room.sellableUnitLabel,
        reservationId:property===P2?stay.res.slice(0,-3)+String(Number(stay.res.slice(-3))+200).padStart(3,"0"):stay.res,confirmationNo:`SYN-${stay.id}`,primaryGuestDisplayName:marker?"STALE HELD BODY":scenario==="conflict"&&from.startsWith("2026-11")&&stay.id===2?"Conflicting guest identity":stay.name,
        reservationStatus:stay.status,segmentId:`00000000-0000-4000-8000-${String(100+stay.id).padStart(12,"0")}`,segmentSeq:stay.id,segmentStatus:stay.segmentStatus,
        stayFrom:stay.start+"T15:00:00Z",stayTo:stay.end+(stay.start===stay.end?"T18:00:00Z":"T11:00:00Z"),localFromDate:stay.start,localToDateExclusive:stay.end,
        clipFromDate:stay.start<from?from:stay.start,clipToDateExclusive:effectiveEnd>to?to:effectiveEnd,continuesBefore:stay.start<from,continuesAfter:effectiveEnd>to}];
    });
    return {propertyId:scenario==="wrong-property"?P2:property,timezone:property===P2?"America/New_York":"UTC",fromDate:from,toDateExclusive:to,limit:1000,limited:scenario==="limited",roomLimit:500,roomsLimited:false,
      rooms:scenario==="duplicate-room"?[...selectedRooms,selectedRooms[0]]:selectedRooms,segments:scenario==="duplicate-segment"?[...segments,segments[0]]:segments};
  }
  try {
    const entry=resolve(directory,"entry.tsx");
    await writeFile(entry,`import React from ${JSON.stringify(resolve(repository,"node_modules/react"))};
import {createRoot} from ${JSON.stringify(resolve(repository,"node_modules/react-dom/client"))};
import {QueryClient,QueryClientProvider} from ${JSON.stringify(resolve(repository,"node_modules/@tanstack/react-query/build/modern/index.js"))};
import {AuthenticationGate} from ${JSON.stringify(resolve(repository,"frontend/yellow/src/AuthenticationGate.tsx"))};
import {reactAuthSession} from ${JSON.stringify(resolve(repository,"frontend/yellow/src/auth-session.ts"))};
import ${JSON.stringify(resolve(repository,"frontend/yellow/src/styles.css"))};
import ${JSON.stringify(resolve(repository,"frontend/yellow/src/ui/reference-theme.css"))};
window.Date=new Proxy(Date,{construct(target,args,newTarget){return Reflect.construct(target,args.length?args:['2026-10-04T12:00:00Z'],newTarget)}});
const {App}=await import(${JSON.stringify(resolve(repository,"frontend/yellow/src/App.tsx"))});
window.order62Auth=reactAuthSession;window.order62Boot=crypto.randomUUID();
const client=new QueryClient({defaultOptions:{queries:{retry:false,refetchOnWindowFocus:false}}});window.order62Client=client;
createRoot(document.getElementById('root')).render(React.createElement(QueryClientProvider,{client},React.createElement(AuthenticationGate,null,React.createElement(App))));`);
    const builder=resolve(directory,"build.ts");await writeFile(builder,`const r=await Bun.build({entrypoints:[${JSON.stringify(entry)}],outdir:${JSON.stringify(resolve(directory,"build"))},target:'browser',format:'esm',define:{'process.env.NODE_ENV':'"production"'}});if(!r.success){console.error(r.logs);process.exit(1)}`);
    const compiler=Bun.spawn([process.execPath,builder],{cwd:repository,stdout:"pipe",stderr:"pipe",windowsHide:true});
    const compilation=Promise.all([new Response(compiler.stdout).text(),new Response(compiler.stderr).text()]);
    const compileDeadline=setTimeout(()=>compiler.kill(),10_000);let compiled:number;try{compiled=await compiler.exited;}finally{clearTimeout(compileDeadline);}const compilationText=await compilation;await writeFile(resolve(proof,"bundle.log"),compilationText.join("\n"));if(compiled!==0)throw new Error(compilationText.join("\n"));
    server=Bun.serve({hostname:"127.0.0.1",port:0,async fetch(request){
      const url=new URL(request.url),path=url.pathname;
      if(!path.startsWith("/api/")) {
        if(path.endsWith(".js")||path.endsWith(".css")){const file=resolve(directory,"build",path.slice(1));if(!file.startsWith(resolve(directory,"build")+sep)||!existsSync(file))return new Response("missing",{status:404});return new Response(Bun.file(file),{headers:{"content-type":path.endsWith(".css")?"text/css":"text/javascript"}});}
        return new Response('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/entry.css"><div id="root"></div><script type="module" src="/entry.js"></script></html>',{headers:{"content-type":"text/html; charset=utf-8"}});
      }
      if(path.startsWith("/api/v1/auth/")) {
        if(request.method!=="GET")authFixtureWrites.push(request.method+" "+path);
        if(path.endsWith("logout"))return Response.json({});
        const payload=Buffer.from(JSON.stringify({sub:"00000000-0000-4000-8000-000000000003",tid:"00000000-0000-4000-8000-000000000002"})).toString("base64url");
        return Response.json({accessToken:`synthetic.${payload}.signature`,tokenType:"Bearer",expiresInSeconds:900,user:{id:"00000000-0000-4000-8000-000000000003",displayName:"Synthetic staff"}});
      }
      if(request.method!=="GET"){calendarWrites.push(request.method+" "+path);return Response.json({},{status:405});}
      if(path==="/api/v1/me/properties")return Response.json({properties:[...(grantRemoved?[]:[{id:P,name:"Synthetic hotel",timezone:"UTC"}]),{id:P2,name:"Synthetic second property",timezone:"America/New_York"}]});
      if(path.endsWith("/reservation-calendar")) {
        const property=path.split("/")[4]!,from=url.searchParams.get("from")!,to=url.searchParams.get("to")!;
        reads.push({property,from,to,scenario});activeReads++;maxActiveReads=Math.max(maxActiveReads,activeReads);
        if(holdNextBody){holdNextBody=false;heldBodies++;const text=JSON.stringify(calendar(property,from,to,true)),part=Math.floor(text.length/2);let closed=false;
          return new Response(new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode(text.slice(0,part)));releaseBody=()=>{if(closed)return;closed=true;controller.enqueue(new TextEncoder().encode(text.slice(part)));controller.close();activeReads--;};},cancel(){if(!closed){closed=true;activeReads--;}}}),{headers:{"content-type":"application/json"}});
        }
        await Bun.sleep(40);activeReads--;
        if(scenario==="denied"||from.startsWith(failMonth)&&failMonth)return Response.json({},{status:403});
        return Response.json(calendar(property,from,to));
      }
      if(path.endsWith("/housekeeping/conditions"))return Response.json({rooms:[{spaceId:U,code:"101",floor:"1",condition:"dirty",updatedAt:"2026-10-04T12:00:00Z"}],nextCursor:null});
      if(path.endsWith("/housekeeping/tasks"))return Response.json({tasks:[]});
      if(path.endsWith("/reservation-board"))return Response.json({reservations:[],nextCursor:null});
      if(path.endsWith("/groups"))return Response.json({groups:[],nextCursor:null});
      if(path.endsWith("/group-blocks"))return Response.json({groups:[]});
      if(path.endsWith("/operational-blocks"))return Response.json({operationalBlocks:[]});
      return Response.json({},{status:503});
    }});
    chrome=Bun.spawn([executable,"--headless=new","--disable-gpu","--no-first-run","--no-default-browser-check","--remote-debugging-address=127.0.0.1","--remote-debugging-port=0",`--user-data-dir=${profile}`,"about:blank"],{stdout:"ignore",stderr:"ignore",windowsHide:true});
    let port="";for(let count=0;count<500&&!port;count++){try{port=(await readFile(resolve(profile,"DevToolsActivePort"),"utf8")).split(/\r?\n/)[0]?.trim()??"";}catch(cause){if(!["EBUSY","ENOENT"].includes(String((cause as {code?:unknown}).code)))throw cause;}await Bun.sleep(20);}if(!port)throw new Error("Owned browser debugging receipt missing");
    const targets=await fetchJsonBounded<{type:string;webSocketDebuggerUrl:string}[]>(`http://127.0.0.1:${port}/json/list`),target=targets.find(item=>item.type==="page");if(!target)throw new Error("Owned page missing");
    socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise<void>((resolveOpen,reject)=>{socket!.onopen=()=>resolveOpen();socket!.onerror=()=>reject(new Error("Owned socket failed"));});
    let sequence=0;const pending=new Map<number,{resolve(value:unknown):void;reject(error:Error):void;timer:ReturnType<typeof setTimeout>}>();
    socket.onmessage=event=>{const result=JSON.parse(String(event.data));if(result.method==="Runtime.exceptionThrown")errors.push(JSON.stringify(result.params));if(result.method==="Runtime.consoleAPICalled"&&result.params?.type==='error')consoleErrors.push(JSON.stringify(result.params.args));if(result.id){const p=pending.get(result.id);if(!p)return;clearTimeout(p.timer);pending.delete(result.id);if(result.error)p.reject(new Error(result.error.message));else p.resolve(result.result);}};
    const send:Send=<V,>(method:string,params={})=>new Promise<V>((resolveResult,reject)=>{const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(new Error(`CDP deadline ${method}`));},12_000);pending.set(id,{resolve:value=>resolveResult(value as V),reject,timer});socket!.send(JSON.stringify({id,method,params}));});
    const read=async<V,>(expression:string):Promise<V>=>{const result=await send<{result?:{value?:V};exceptionDetails?:unknown}>("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(`Read failed ${expression}: ${JSON.stringify(result.exceptionDetails)}`);return result.result?.value as V;};
    const until=async(expression:string,label:string)=>{for(let count=0;count<300;count++){if(await read<boolean>(expression))return;await Bun.sleep(25);}throw new Error(`Timed out ${label}: ${await read<string>("document.body.innerText")}`);};
    const click=async(selector:string)=>{
      const point=await read<{x:number;y:number}>(`(async()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)throw new Error('Missing '+${JSON.stringify(selector)});el.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});await new Promise(requestAnimationFrame);const target=el.matches('.host-calendar-day')?el.querySelector('.host-day-number'):el,r=target.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,hit=document.elementFromPoint(x,y);if(hit!==el&&!el.contains(hit))throw new Error('Occluded '+${JSON.stringify(selector)}+' by '+hit?.className);return{x,y}})()`);
      await send("Input.dispatchMouseEvent",{type:"mousePressed",...point,button:"left",clickCount:1});await send("Input.dispatchMouseEvent",{type:"mouseReleased",...point,button:"left",clickCount:1});await Bun.sleep(30);
    };
    const press=async(key:string,code=key,modifiers=0)=>{const windowsVirtualKeyCode=key==='Enter'?13:key==='Escape'?27:key==='Tab'?9:key===' '?32:undefined;await send("Input.dispatchKeyEvent",{type:"keyDown",key,code,modifiers,windowsVirtualKeyCode,text:key==='Enter'?'\r':undefined});await send("Input.dispatchKeyEvent",{type:"keyUp",key,code,modifiers,windowsVirtualKeyCode});};
    const shot=async(name:string)=>{const result=await send<{data:string}>("Page.captureScreenshot",{format:"png",captureBeyondViewport:false});await writeFile(resolve(proof,name+".png"),Buffer.from(result.data,"base64"));screenshots.push(name+".png");};

    const baseline=process.env.YELLOW_ORDER762_BASELINE==="1";
    const frames:Record<string,unknown>[]=[];observations.browserPlugin="Browser plugin not available";observations.harness="Existing repository owned CDP full-App browser harness";
    const navigate=async(width:number,height:number)=>{
      await send("Emulation.setDeviceMetricsOverride",{width,height,deviceScaleFactor:1,mobile:width<=980});
      await send("Page.navigate",{url:`http://127.0.0.1:${server!.port}/p/${P}/today?workspace=ecosystem`});
      await until("!!document.querySelector('.ecosystem-hub h1') && !!document.querySelector('.auth-session-control')","actual authenticated ecosystem");
      await Bun.sleep(220);
    };
    const box=async(selector:string)=>read<{left:number;right:number;top:number;bottom:number;width:number;height:number;hit:string;clickable:boolean}>(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)throw new Error('missing '+${JSON.stringify(selector)});const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height,hit:hit?.className??'',clickable:hit===el||el.contains(hit)}})()`);
    const openAssistant=async()=>{
      if(baseline){await read("document.querySelector('.yellow-launch').focus()");await press(" ","Space");}
      else await click('.yellow-launch');
      await until("!!document.querySelector('[aria-label=\"Ask Yellow\"]')","assistant input");
      await click('[aria-label="Ask Yellow"]');await send("Input.insertText",{text:"show housekeeping"});await click('[aria-label="Send request to Yellow"]');
      await until("!!document.querySelector('.yellow-inline-workspace .hk-floor-cube')","actual inline housekeeping floor");await Bun.sleep(220);if(!baseline){await read("document.querySelector('[aria-label=\"Ask Yellow\"]').scrollIntoView({block:'nearest',behavior:'instant'})");await Bun.sleep(30);}
    };
    const closeAssistant=async()=>{await click('[aria-label="Exit Yellow mode"]');await until("!document.querySelector('.yellow-command-surface')","assistant closed");await Bun.sleep(220);};
    await send("Page.enable");await send("Runtime.enable");
    const sizes=baseline?[[1440,1000]]:[[1440,1000],[981,700],[980,700],[761,700],[760,700],[375,760],[320,760],[1440,420]];
    for(const size of sizes){
      const width=size[0]!,height=size[1]!;await navigate(width,height);
      expect(await read<string>('location.pathname')).toBe(`/p/${P}/today`);
      expect(await read<string>("document.querySelector('.ecosystem-hub h1').innerText")).toContain('One operating model');
      const launcher=await box('.yellow-launch');await shot(`launcher-${width}-${height}`);
      await openAssistant();const panel=await box('.yellow-inline-workspace'),header=await box('.yellow-command-surface > header');
      const nav=await read<{right:number;visible:boolean}>("(()=>{const e=document.querySelector('.operator-navigation'),r=e.getBoundingClientRect();return{right:r.right,visible:getComputedStyle(e).visibility==='visible'&& !e.inert}})()");
      const frame={width,height,launcher,panel,header,nav};frames.push(frame);observations.layout=frames;await shot(`assistant-${width}-${height}`);
      if(baseline){expect(launcher.clickable).toBe(true);expect(panel.left).toBeGreaterThanOrEqual(nav.visible?nav.right:0);continue;}
      expect(launcher.clickable).toBe(true);expect(panel.left).toBeGreaterThanOrEqual(nav.visible?nav.right:0);expect(panel.right).toBeLessThanOrEqual(width);expect(header.top).toBeGreaterThanOrEqual(width<=980?64:68);
      expect(header.right).toBeLessThanOrEqual(width);expect((await box('[aria-label="Ask Yellow"]')).clickable).toBe(true);
      expect(await read<boolean>("document.documentElement.scrollWidth<=innerWidth+1")).toBe(true);
      await read("document.querySelector('.yellow-inline-workspace h1').scrollIntoView({block:'center',behavior:'instant'})");await Bun.sleep(30);
      const firstHeading=await box('.yellow-inline-workspace h1'),stickyHeader=await box('.yellow-command-surface > header');
      expect(firstHeading.top).toBeGreaterThanOrEqual(stickyHeader.bottom);expect(firstHeading.bottom).toBeLessThanOrEqual(height);expect(firstHeading.left).toBeGreaterThanOrEqual(nav.visible?nav.right:0);expect(firstHeading.clickable).toBe(true);
      await click('.yellow-inline-workspace .hk-dashboard-floor summary');await until("document.querySelector('.yellow-inline-workspace .hk-dashboard-floor').open","actual floor disclosure opened");
      await read("document.querySelector('.yellow-inline-workspace .hk-floor-cube').scrollIntoView({block:'center',behavior:'instant'})");await Bun.sleep(30);
      const floorTarget=await box('.yellow-inline-workspace .hk-floor-cube'),closeTarget=await box('[aria-label="Exit Yellow mode"]');observations.reachability={width,height,firstHeading,stickyHeader,floorTarget,closeTarget};await shot(`reachable-${width}-${height}`);expect(floorTarget.clickable).toBe(true);expect(closeTarget.clickable).toBe(true);
      await closeAssistant();
      await click('.auth-session-control summary');await until("document.querySelector('.auth-session-control').open","account disclosure");
      const account=await box('.auth-session-options');expect(account.left).toBeGreaterThanOrEqual(0);expect(account.right).toBeLessThanOrEqual(width);expect(account.top).toBeGreaterThanOrEqual(0);
      expect((await box('.auth-session-options button:first-of-type')).clickable).toBe(true);expect(await read<string>("document.querySelector('.auth-session-options').innerText")).toContain('Synthetic staff');
      await shot(`account-${width}-${height}`);await press('Escape');expect(await read<boolean>("!document.querySelector('.auth-session-control').open && document.activeElement.matches('.auth-session-control summary')")).toBe(true);
      if(width<=980){
        await click('.auth-session-control summary');await click('.operator-nav-toggle');await until("document.querySelector('.operator-navigation').getAttribute('aria-modal')==='true'","mobile modal navigation");
        expect(await read<boolean>("getComputedStyle(document.querySelector('.auth-session-control')).visibility==='hidden'&&!document.querySelector('.auth-session-control').open")).toBe(true);
        expect(await read<boolean>("!!document.activeElement.closest('.operator-navigation')")).toBe(true);await shot(`modal-nav-${width}`);await press('Escape');
        await until("document.querySelector('.operator-navigation').getAttribute('aria-modal')!=='true'","modal closed");expect(await read<boolean>("!document.querySelector('.auth-session-control').open")).toBe(true);
      }else{
        await click('.operator-nav-toggle');await Bun.sleep(220);await openAssistant();const collapsed=await box('.yellow-inline-workspace');expect(collapsed.left).toBeGreaterThanOrEqual(0);expect(collapsed.right).toBeLessThanOrEqual(width);expect((await box('[aria-label="Ask Yellow"]')).clickable).toBe(true);await shot(`collapsed-${width}-${height}`);await closeAssistant();
      }
    }
    if(!baseline){
      await navigate(375,760);await click('.auth-session-control summary');await read("document.querySelector('.ecosystem-preview-link').focus()");await press('Enter');
      await until("!!document.querySelector('.options-drawer')","real body-portal options drawer");
      expect(await read<boolean>("!document.querySelector('.auth-session-control').open&&getComputedStyle(document.querySelector('.auth-session-control')).visibility==='hidden'")).toBe(true);
      expect(await read<boolean>("!!document.activeElement.closest('.options-drawer')")).toBe(true);await shot('options-keyboard-modal');await press('Escape');await until("!document.querySelector('.options-drawer')","options drawer closed");
      expect(await read<boolean>("!document.querySelector('.auth-session-control').open&&document.activeElement.matches('.ecosystem-preview-link')")).toBe(true);
      await send("Page.navigate",{url:`http://127.0.0.1:${server!.port}/p/${P}/reservations?view=calendar`});
      await until("!!document.querySelector('.host-calendar-room-card')","actual calendar modal test");await click(`[data-host-row="unit:${U}"]`);
      await until("document.querySelectorAll('.host-calendar-month .host-month-grid').length===3","actual selected calendar");
      await click('.auth-session-control summary');expect(await read<boolean>("document.querySelector('.auth-session-control').open")).toBe(true);
      await read("document.querySelector('[data-calendar-date=\"2026-10-04\"]').focus()");expect(await read<boolean>("document.activeElement.matches('[data-calendar-date=\"2026-10-04\"]')")).toBe(true);await press('Enter');
      await until("!!document.querySelector('.host-calendar-selection')","keyboard mounts pre-attributed calendar dialog");
      expect(await read<boolean>("!document.querySelector('.auth-session-control').open&&getComputedStyle(document.querySelector('.auth-session-control')).visibility==='hidden'")).toBe(true);
      expect(await read<boolean>("!!document.activeElement.closest('.host-calendar-selection')")).toBe(true);await shot('calendar-keyboard-modal');await press('Escape');
      await until("!document.querySelector('.host-calendar-selection')","calendar modal closed");
      expect(await read<boolean>("!document.querySelector('.auth-session-control').open&&getComputedStyle(document.querySelector('.auth-session-control')).visibility==='visible'")).toBe(true);
      expect(await read<boolean>("!document.activeElement.matches('.auth-session-control summary')")).toBe(true);
      await click('.auth-session-control summary');await read("document.querySelector('.portfolio-trigger').focus()");await press('Enter');
      await until("!!document.querySelector('.portfolio-dialog')","real body-portal portfolio dialog");
      expect(await read<boolean>("!document.querySelector('.auth-session-control').open&&getComputedStyle(document.querySelector('.auth-session-control')).visibility==='hidden'")).toBe(true);
      expect(await read<boolean>("!!document.activeElement.closest('.portfolio-dialog')")).toBe(true);await shot('portfolio-keyboard-modal');await press('Escape');
      await until("!document.querySelector('.portfolio-dialog')","portfolio modal closed");
      expect(await read<boolean>("!document.querySelector('.auth-session-control').open&&document.activeElement.matches('.portfolio-trigger')")).toBe(true);
      await navigate(320,760);await openAssistant();
      await read("(()=>{const s=document.createElement('style');s.textContent='.auth-session-control summary,.auth-session-options span,.auth-session-options button,.yellow-command-surface p,.yellow-command-surface input,.yellow-command-surface button{font-size:24px!important}';document.head.appendChild(s)})()");
      expect((await box('[aria-label="Ask Yellow"]')).clickable).toBe(true);expect((await box('.yellow-inline-workspace')).right).toBeLessThanOrEqual(320);const enlargedHeader=await box('.yellow-command-surface > header');expect(enlargedHeader.left).toBeGreaterThanOrEqual(0);expect(enlargedHeader.right).toBeLessThanOrEqual(320);expect((await box('[aria-label="Exit Yellow mode"]')).clickable).toBe(true);await shot('doubled-text320');await closeAssistant();
      await click('.auth-session-control summary');const enlarged=await box('.auth-session-options');expect(enlarged.right).toBeLessThanOrEqual(320);expect(enlarged.top).toBeGreaterThanOrEqual(0);await shot('account-doubled320');
      await click('.auth-session-options button:first-of-type');await until("!!document.querySelector('.auth-screen[role=dialog]')","real renewal dialog");
      expect(await read<boolean>("document.querySelector('.auth-workspace').inert && !document.querySelector('.auth-session-control')")).toBe(true);
      for(const [id,text]of [['auth-tenant','synthetic'],['auth-email','synthetic@example.invalid'],['auth-password','synthetic']]){await click('#'+id);await send('Input.insertText',{text});}
      await click('.auth-card button[type=submit]');await until("!!document.querySelector('.auth-session-control')&&!document.querySelector('.auth-workspace').inert","renewed same workspace");
      await click('.auth-session-control summary');await click('.auth-session-options button:last-of-type');await until("!!document.querySelector('.auth-screen')&&!document.querySelector('.auth-session-control')","real sign out dialog");
      expect(await read<boolean>("document.querySelector('.auth-workspace').inert")).toBe(true);expect(authFixtureWrites.some(path=>path.endsWith('/logout'))).toBe(true);
    }
    expect(calendarWrites).toEqual([]);expect(errors).toEqual([]);expect(consoleErrors).toEqual([]);expect(await read<boolean>("!document.querySelector('vite-error-overlay')")).toBe(true);observations.pageIdentityVerified=true;observations.meaningfulContent=true;observations.ownedSyntheticOnly=true;
  } finally {
    releaseHeldBody();
    try{if(chrome)await terminateOwnedProcess(chrome);}finally{socket?.close();server?.stop(true);}
    await writeFile(resolve(proof,"observations.json"),JSON.stringify({...observations,reads,calendarWrites,authFixtureWrites,screenshots,maxActiveReads,errors,consoleErrors,browserPid:chrome?.pid,browserExitVerified:chrome?chrome.exitCode!==null||chrome.signalCode!==null:true,browserExitCode:chrome?.exitCode,browserSignalCode:chrome?.signalCode},null,2));
    const absolute=resolve(directory);if(!absolute.startsWith(proof+sep)||!absolute.split(sep).at(-1)?.startsWith("owned-"))throw new Error("Cleanup containment failed");await rm(absolute,{recursive:true,force:true,maxRetries:10,retryDelay:100});
  }
},180_000);
