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
test("order757 actual App mounted host calendar: 320/375/1440, reference states, native fences, portfolio and guarded routing",async()=>{
  const executable=resolveChromiumPath();if(!executable)throw new Error("Owned Chromium required");
  const proof=resolve(process.env.YELLOW_ORDER757_PROOF_DIR??resolve(repository,"../proof/mounted757"));await mkdir(proof,{recursive:true});
  const directory=await mkdtemp(resolve(proof,"owned-")),profile=resolve(directory,"profile");
  let server:ReturnType<typeof Bun.serve>|undefined,chrome:ReturnType<typeof Bun.spawn>|undefined,socket:WebSocket|undefined;
  const errors:string[]=[],reads:{property:string;from:string;to:string;scenario:string}[]=[],calendarWrites:string[]=[],authFixtureWrites:string[]=[],screenshots:string[]=[];
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
window.order57Auth=reactAuthSession;window.order57Boot=crypto.randomUUID();
const client=new QueryClient({defaultOptions:{queries:{retry:false,refetchOnWindowFocus:false}}});window.order57Client=client;
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
    socket.onmessage=event=>{const result=JSON.parse(String(event.data));if(result.method==="Runtime.exceptionThrown")errors.push(JSON.stringify(result.params));if(result.id){const p=pending.get(result.id);if(!p)return;clearTimeout(p.timer);pending.delete(result.id);if(result.error)p.reject(new Error(result.error.message));else p.resolve(result.result);}};
    const send:Send=<V,>(method:string,params={})=>new Promise<V>((resolveResult,reject)=>{const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(new Error(`CDP deadline ${method}`));},12_000);pending.set(id,{resolve:value=>resolveResult(value as V),reject,timer});socket!.send(JSON.stringify({id,method,params}));});
    const read=async<V,>(expression:string):Promise<V>=>{const result=await send<{result?:{value?:V};exceptionDetails?:unknown}>("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(`Read failed ${expression}: ${JSON.stringify(result.exceptionDetails)}`);return result.result?.value as V;};
    const until=async(expression:string,label:string)=>{for(let count=0;count<300;count++){if(await read<boolean>(expression))return;await Bun.sleep(25);}throw new Error(`Timed out ${label}: ${await read<string>("document.body.innerText")}`);};
    const click=async(selector:string)=>{
      const point=await read<{x:number;y:number}>(`(async()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)throw new Error('Missing '+${JSON.stringify(selector)});el.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});await new Promise(requestAnimationFrame);const target=el.matches('.host-calendar-day')?el.querySelector('.host-day-number'):el,r=target.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,hit=document.elementFromPoint(x,y);if(hit!==el&&!el.contains(hit))throw new Error('Occluded '+${JSON.stringify(selector)}+' by '+hit?.className);return{x,y}})()`);
      await send("Input.dispatchMouseEvent",{type:"mousePressed",...point,button:"left",clickCount:1});await send("Input.dispatchMouseEvent",{type:"mouseReleased",...point,button:"left",clickCount:1});await Bun.sleep(30);
    };
    const press=async(key:string,code=key,modifiers=0)=>{await send("Input.dispatchKeyEvent",{type:"keyDown",key,code,modifiers});await send("Input.dispatchKeyEvent",{type:"keyUp",key,code,modifiers});};
    const shot=async(name:string)=>{const result=await send<{data:string}>("Page.captureScreenshot",{format:"png",captureBeyondViewport:false});await writeFile(resolve(proof,name+".png"),Buffer.from(result.data,"base64"));screenshots.push(name+".png");};
    const navigate=async(property=P)=>{await send("Page.navigate",{url:`http://127.0.0.1:${server!.port}/p/${property}/reservations?view=calendar`});await until("!!document.querySelector('.host-calendar-room-card')","actual App unit picker");};
    const unit=async(id=U)=>{await click(`[data-host-row="unit:${id}"]`);await until("document.querySelectorAll('.host-calendar-month .host-month-grid').length===3","three bounded native months");};
    const view=async(name:"list"|"month"|"year")=>{await click(".host-view-menu summary");await click(`.host-view-options button:nth-child(${name==="list"?1:name==="month"?2:3})`);};
    const closeSheet=()=>click(".host-calendar-selection header button");
    const fresh=async()=>{await click(".host-calendar-destinations button:last-child");await until("!!document.querySelector('.host-calendar-room-card')","fresh authorized cards");};
    const noOverflow=async()=>expect(await read<boolean>("document.documentElement.scrollWidth<=innerWidth+1 && document.body.scrollWidth<=innerWidth+1")).toBe(true);
    await send("Page.enable");await send("Runtime.enable");
    for(const width of [1440,375,320]) {
      await send("Emulation.setDeviceMetricsOverride",{width,height:width===1440?1000:760,deviceScaleFactor:1,mobile:width!==1440});await navigate();
      expect(await read<number>("document.querySelectorAll('.host-calendar-room-card').length")).toBe(4);
      expect(await read<boolean>("!!document.querySelector('.host-unassigned-group')")).toBe(true);
      expect(await read<string>("document.querySelector('.host-type-group summary').textContent")).toContain("2 units");
      expect(await read<boolean>("!document.querySelector('.host-month-grid')")).toBe(true);await noOverflow();await shot(`picker2709-${width}`);
      await unit();await noOverflow();expect(await read<string>("document.querySelector('.host-calendar-weekdays').innerText")).toContain("Sun");
      expect(await read<number>("document.querySelectorAll('.host-calendar-month').length")).toBe(3);
      expect(await read<number>("document.querySelectorAll('.host-calendar-month:first-of-type h3').length")).toBe(1);
      expect(await read<boolean>("!!document.querySelector('.host-booking-bar[style*=\"span 3\"]')")).toBe(true);
      await read("document.querySelector('.host-calendar-heading').scrollIntoView({block:'start'})");await shot(`month2710-${width}`);
      await click(".host-view-menu summary");expect(await read<boolean>("document.querySelector('.host-view-menu').open")).toBe(true);await shot(`menu2711-${width}`);
      await click(".host-calendar-title h2");expect(await read<boolean>("!document.querySelector('.host-view-menu').open")).toBe(true);await click(".host-view-menu summary");
      await press("ArrowDown");expect(await read<string>("document.activeElement.textContent")).toBe("List");await press("ArrowUp");expect(await read<string>("document.activeElement.textContent")).toBe("Year");await press("Escape");expect(await read<boolean>("document.activeElement.matches('.host-view-menu summary')")).toBe(true);
      await view("list");await until("!!document.querySelector('.host-calendar-list-day')","daily List");expect(await read<string>("document.querySelector('.host-list-price').textContent")).toBe("—");await shot(`list2715-${width}`);
      await view("year");await until("document.querySelectorAll('.host-year-month').length===12","dot Year");
      expect(await read<number>("document.querySelectorAll('.host-calendar-year-group').length")).toBe(2);expect(await read<string>("document.querySelectorAll('.host-calendar-year-group h3')[1].textContent")).toBe("2027");
      await shot(`year2714-${width}`);await noOverflow();
      await click(".host-year-month");await until("!!document.querySelector('.host-month-grid')","Year to Month");
      await click('[data-calendar-date="2026-10-04"]');await until("!!document.querySelector('.host-calendar-selection')","dark date sheet");
      expect(await read<boolean>("document.querySelector('.host-calendar-surface').inert")).toBe(true);expect(await read<boolean>("!!document.activeElement.closest('.host-calendar-selection')")).toBe(true);
      const bounds=await read<{top:number;bottom:number;width:number}>("(()=>{const r=document.querySelector('.host-calendar-selection').getBoundingClientRect();return{top:r.top,bottom:r.bottom,width:r.width}})()");expect(bounds.top).toBeGreaterThanOrEqual(0);expect(bounds.bottom).toBeLessThan((width===1440?1000:760)+1);expect(bounds.width).toBeLessThanOrEqual(width);
      expect(await read<boolean>("(()=>{const b=document.querySelector('.yellow-launch');return !b.getClientRects().length||document.querySelector('.host-calendar-selection').getBoundingClientRect().bottom+8<=b.getBoundingClientRect().top})()")).toBe(true);
      expect(await read<boolean>("(()=>{const d=document.querySelector('.operator-quick-dock');return !d?.getClientRects().length||document.querySelector('.host-calendar-selection').getBoundingClientRect().bottom+8<=d.getBoundingClientRect().top})()")).toBe(true);
      await shot(`selection2716-${width}`);await click(".host-selection-chip button");await until("!document.querySelector('.host-calendar-selection')","choose range endpoint");
      await view("list");expect(await read<boolean>("!!document.querySelector('.host-calendar-list-day.is-selected[data-calendar-date=\"2026-10-04\"]')")).toBe(true);await view("month");expect(await read<boolean>("document.querySelector('.host-calendar-day[data-calendar-date=\"2026-10-04\"]').getAttribute('aria-pressed')==='true'")).toBe(true);
      await click('[data-calendar-date="2026-10-08"]');expect(await read<string>("document.querySelector('.host-calendar-selection h3').textContent")).toContain("4 Oct");
      expect(await read<number>("document.querySelectorAll('.host-calendar-day[aria-pressed=true]').length")).toBe(5);
      await press("Tab","Tab",1);expect(await read<boolean>("!!document.activeElement.closest('.host-calendar-selection')")).toBe(true);await press("Escape");
      expect(await read<boolean>("document.activeElement.dataset.calendarDate==='2026-10-08'")).toBe(true);expect(await read<boolean>("!document.querySelector('.host-calendar-surface').inert")).toBe(true);
      await click('[aria-label="Calendar settings"]');await shot(`custom2717-${width}`);await click(".host-settings-stack details:nth-child(2) summary");expect(await read<string>("document.querySelector('.host-settings-stack').innerText")).toContain("not provided");await shot(`cancellation2718-${width}`);await closeSheet();
      await click(".host-calendar-today");await until("!!document.querySelector('[data-calendar-date=\"2026-10-04\"][aria-current=date]')","Today marker");
      expect(await read<boolean>("(()=>{const a=document.querySelector('.host-calendar-today').getBoundingClientRect(),b=document.querySelector('.yellow-launch').getBoundingClientRect();return a.right<=b.left||a.left>=b.right||a.bottom<=b.top||a.top>=b.bottom})()")).toBe(true);
      expect(await read<boolean>("(()=>{const r=document.querySelector('[data-calendar-date=\"2026-10-04\"]').getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight})()")).toBe(true);
      await read("document.querySelector('.host-calendar-month').scrollIntoView({block:'start'})");await shot(`spans2719-${width}`);
      await read("document.querySelectorAll('.host-calendar-month')[1].scrollIntoView({block:'start'})");await shot(`spans2720-${width}`);
      await read("document.querySelectorAll('.host-calendar-month')[2].scrollIntoView({block:'start'})");await shot(`long2722-${width}`);
      await read("document.querySelector('.host-calendar-month').scrollIntoView({block:'start'})");await shot(`current2727-${width}`);
      expect(await read<string>("document.querySelector('.host-calendar').innerText")).not.toContain("Blocked by you");expect(await read<string>("document.querySelector('.host-calendar').innerText")).not.toContain("Smart Pricing");expect(await read<boolean>("!document.querySelector('.host-calendar img')")).toBe(true);
      await click('[aria-label="Back to calendars"]');await until("!!document.querySelector('.host-calendar-room-card')","Back to truthful picker");
      await unit(U2);expect(await read<boolean>("!!document.querySelector('.host-booking-bar.tone-completed')")).toBe(true);await click('[aria-label="Back to calendars"]');
      await click(`[data-host-row="unassigned:${T}"]`);await until("!!document.querySelector('.host-booking-bar')","unassigned type stays");expect(await read<string>("document.querySelector('.host-calendar-title').innerText")).toContain("Assignment pending");
      observations[`viewport${width}`]={overflow:false,unitCards:4,continuousMonths:3,yearDividers:2,localRange:true,focusReturned:true};
    }
    expect(maxActiveReads).toBeLessThanOrEqual(2);expect(reads.every(row=>(Date.parse(row.to)-Date.parse(row.from))/86400000<=31)).toBe(true);
    await send("Emulation.setDeviceMetricsOverride",{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await navigate();
    await click(".host-calendar-destinations button:nth-child(2)");await until("!!document.querySelector('.hosting-property-timeline')","retained native Timeline");
    await click(".hosting-portfolio-controls summary");await click(".hosting-portfolio-controls label input");await until("document.querySelectorAll('.hosting-portfolio-controls input').length===3","portfolio grants");await click(".hosting-portfolio-controls div label:last-of-type input");await until("document.querySelectorAll('.hosting-property-timeline').length===2","two timezone-owned properties");
    expect(await read<string>("document.querySelectorAll('.hosting-property-timeline')[1].innerText")).toContain("America/New_York");expect(await read<boolean>("document.querySelector('.hosting-timeline-scroll').scrollWidth>document.querySelector('.hosting-timeline-scroll').clientWidth")).toBe(true);await shot("portfolio1440");
    await click(".host-calendar-destinations button:first-child");await until("!!document.querySelector('.host-calendar-room-card')","return to Host");await unit();await click(".host-booking-bar");await until("!!document.querySelector('.host-open-reservation')","native stay action");
    const boot=await read<string>("window.order57Boot");await click(".host-open-reservation");await until(`location.pathname==='/p/${P}/res/${R}'`,"guarded onOpen reservation/property");expect(await read<string>("window.order57Boot")).toBe(boot);
    await read("history.back()");await until("!!document.querySelector('.host-calendar-room-card')","native Back route");expect(await read<string>("location.search")).toBe("?view=calendar");
    single=true;await fresh();expect(await read<number>("document.querySelectorAll('.host-calendar-room-card').length")).toBe(1);expect(await read<boolean>("!document.querySelector('.host-month-grid')")).toBe(true);single=false;await fresh();
    for(const bad of ["limited","duplicate-room","duplicate-segment","wrong-property","denied"]) {scenario=bad;await click(".host-calendar-destinations button:last-child");await until("document.body.innerText.includes('Calendars are unavailable or incomplete')","fail-closed "+bad);expect(await read<boolean>("!document.querySelector('.host-booking-bar')&&!document.querySelector('.host-open-reservation')")).toBe(true);scenario="normal";await fresh();}
    failMonth="2026-11";await click(`[data-host-row="unit:${U}"]`);await until("document.querySelectorAll('.host-calendar-notice[role=alert]').length>0","denied neighboring month");expect(await read<boolean>("!!document.querySelector('.host-booking-bar')")).toBe(true);expect(await read<number>("document.querySelectorAll('.host-calendar-month .host-month-grid').length")).toBe(2);await shot("partial-neighbor");failMonth="";await fresh();
    scenario="conflict";await click(`[data-host-row="unit:${U}"]`);await until("document.body.innerText.includes('records disagree across months')","conflicting invariant identity rejected");expect(await read<boolean>("!document.querySelector('.host-open-reservation')")).toBe(true);scenario="normal";await fresh();
    const waitHeldBody=async()=>{for(let count=0;count<100&&!releaseBody;count++)await Bun.sleep(20);expect(releaseBody).toBeDefined();};
    // These are actual UI changes while a neighboring month body is incomplete.
    holdNextBody=true;await click(`[data-host-row="unit:${U}"]`);await waitHeldBody();await click('[aria-label="Back to calendars"]');await unit(U2);releaseHeldBody();
    expect(await read<string>("document.querySelector('.host-calendar-title h2').textContent")).toBe("Unit 102");expect(await read<string>("document.querySelector('.host-calendar').innerText")).not.toContain("STALE HELD BODY");
    await fresh();await unit();holdNextBody=true;await click('[aria-label="Previous month"]');await waitHeldBody();await click('[aria-label="Next month"]');releaseHeldBody();await until("document.querySelectorAll('.host-calendar-month .host-month-grid').length===3","new date window after held old body");
    expect(await read<string>("document.querySelector('.host-calendar-month h3').textContent")).toBe("October 2026");expect(await read<boolean>("!document.querySelector('.host-calendar-month[aria-label=\"September 2026\"]')")).toBe(true);
    await fresh();holdNextBody=true;await click(`[data-host-row="unit:${U}"]`);await waitHeldBody();await navigate(P2);releaseHeldBody();expect(await read<string>("document.querySelector('.host-calendar-title').innerText")).toContain("Synthetic second property");
    await navigate();observations.pendingBodyUiChanges={unit:true,date:true,property:true,staleBodyNeverDisplayed:true};
    // Invoke the actual mounted query's captured controller closure with a
    // test-owned un-aborted signal. This makes post-body auth fencing observable
    // independently of React Query cancellation and an AbortController.
    const probe=async()=>{holdNextBody=true;await read("(()=>{const q=window.order57Client.getQueryCache().getAll().find(q=>q.queryKey[0]==='host-calendar57');if(!q)throw new Error('Mounted query missing');window.order57FenceResult='pending';q.options.queryFn({queryKey:q.queryKey,signal:new AbortController().signal,meta:q.meta}).then(()=>window.order57FenceResult='accepted',()=>window.order57FenceResult='rejected');})()");await waitHeldBody();};
    const finishProbe=async()=>{releaseHeldBody();await until("window.order57FenceResult==='rejected'","post-complete-body fence");expect(await read<string>("document.body.innerText")).not.toContain("STALE HELD BODY");};
    await unit();await click('[data-calendar-date="2026-10-04"]');await until("!!document.querySelector('.host-calendar-selection')","open sheet before session renewal");
    await probe();await read("window.order57Auth.signIn({tenant:'synthetic',email:'synthetic@example.invalid',password:'synthetic'})");await until("!!document.querySelector('.host-calendar-room-card')","renewed session cards");expect(await read<boolean>("!document.querySelector('.host-calendar-selection')")).toBe(true);await finishProbe();
    await probe();grantRemoved=true;await click(".host-calendar-destinations button:last-child");await until("document.body.innerText.includes('access to this property is not granted')","revoked current grant");await finishProbe();expect(await read<boolean>("!document.querySelector('.host-booking-bar')")).toBe(true);grantRemoved=false;await fresh();
    await unit();await click('[data-calendar-date="2026-10-04"]');await until("!!document.querySelector('.host-calendar-selection')","open sheet before logout");
    await probe();await read("window.order57Auth.logout()");await until("!document.querySelector('.host-calendar-selection')","logout closes selection");await finishProbe();expect(await read<boolean>("!document.querySelector('.host-booking-bar')||document.querySelector('.auth-workspace')?.inert")).toBe(true);
    await read("window.order57Auth.signIn({tenant:'synthetic',email:'synthetic@example.invalid',password:'synthetic'})");await until("!!document.querySelector('.host-calendar-room-card')","reauthorized cards");
    observations.postBodyAuthFence={heldBodies,rejectedOnRenewal:true,rejectedOnGrantRemoval:true,rejectedOnLogout:true,testOwnedSignalNeverAborted:true};
    expect(calendarWrites).toEqual([]);expect(errors).toEqual([]);expect(reads.every(row=>row.property===P||row.property===P2)).toBe(true);
  } finally {
    releaseHeldBody();
    try{if(chrome)await terminateOwnedProcess(chrome);}finally{socket?.close();server?.stop(true);}
    await writeFile(resolve(proof,"observations.json"),JSON.stringify({...observations,reads,calendarWrites,authFixtureWrites,screenshots,maxActiveReads,errors,browserPid:chrome?.pid,browserExitVerified:chrome?chrome.exitCode!==null||chrome.signalCode!==null:true,browserExitCode:chrome?.exitCode,browserSignalCode:chrome?.signalCode},null,2));
    const absolute=resolve(directory);if(!absolute.startsWith(proof+sep)||!absolute.split(sep).at(-1)?.startsWith("owned-"))throw new Error("Cleanup containment failed");await rm(absolute,{recursive:true,force:true,maxRetries:10,retryDelay:100});
  }
},180_000);
