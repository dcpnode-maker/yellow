import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { resolveChromiumPath } from "./helpers/chromium-path";
import { fetchJsonBounded, terminateOwnedProcess } from "./helpers/owned-cdp-proof-lifecycle";

const root=resolve(import.meta.dir,"..");
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const tenant=id(1),property=id(2),type=id(3),unit=id(4),space=id(5),plan=id(6),actor=id(7);
const calendar={propertyId:property,timezone:"UTC",fromDate:"2026-10-01",toDateExclusive:"2026-11-01",limit:1000,limited:false,roomLimit:500,roomsLimited:false,
  rooms:[{sellableUnitId:unit,sellableUnitLabel:"Unit 101",unitTypeId:type,unitTypeCode:"STD",unitTypeLabel:"Standard",roomCondition:null,outOfService:null}],segments:[]};
const inventory={unitTypes:[{id:type,tenantId:tenant,propertyNode:property,code:"STD",name:"Standard",profileKey:"hotel",baseOccupancy:2,maxOccupancy:4,attrs:{},sortOrder:0}],
  spaces:[{id:space,tenantId:tenant,propertyNode:property,code:"101",profileKey:"hotel",capacity:1,maxOccupancy:4,floor:null,areaSqm:null,genderPolicy:null,attrs:{},status:"active"}],
  sellableUnits:[{id:unit,tenantId:tenant,propertyNode:property,unitTypeId:type,unitTypeCode:"STD",name:"Unit 101",status:"active",spaces:[{spaceId:space,code:"101",claimMode:"exclusive"}]}]};
const price={ratePrice:{id:id(8),tenantId:tenant,propertyNode:property,ratePlanId:plan,unitTypeId:type,stayStart:"2026-10-01",stayEnd:"2026-11-01",dowMask:127,currency:"INR",recordedAt:"2026-10-01T00:00:00.000Z",supersededBy:null,pricing:{occupancy:{"2":"9007199254740991"},extraAdultMinor:null,extraChildren:[]}}};

test("mounted selected calendar rate requires explicit context and clears on denial and logout",async()=>{
  const executable=resolveChromiumPath();if(!executable)throw new Error("Owned Chromium required");
  const proof=resolve(root,"../proof/mounted775");await mkdir(proof,{recursive:true});const directory=await mkdtemp(resolve(proof,"owned-")),profile=resolve(directory,"profile");
  let server:ReturnType<typeof Bun.serve>|undefined,chrome:ReturnType<typeof Bun.spawn>|undefined,socket:WebSocket|undefined;
  let deny=false;const reads:string[]=[];const writes:string[]=[];const errors:string[]=[];const paths:string[]=[];
  try{
    const entry=resolve(directory,"entry.tsx");await writeFile(entry,`import React from ${JSON.stringify(resolve(root,"node_modules/react"))};import{createRoot}from ${JSON.stringify(resolve(root,"node_modules/react-dom/client"))};import{QueryClient,QueryClientProvider}from ${JSON.stringify(resolve(root,"node_modules/@tanstack/react-query/build/modern/index.js"))};import{HostReservationCalendar}from ${JSON.stringify(resolve(root,"frontend/yellow/src/workspaces/HostReservationCalendar.tsx"))};import{reactAuthSession}from ${JSON.stringify(resolve(root,"frontend/yellow/src/auth-session.ts"))};(window as any).auth=reactAuthSession;await reactAuthSession.signIn({tenant:'synthetic',email:'synthetic@example.test',password:'synthetic'},${JSON.stringify(property)});createRoot(document.getElementById('root')!).render(React.createElement(QueryClientProvider,{client:new QueryClient()},React.createElement(HostReservationCalendar,{propertyId:${JSON.stringify(property)},propertyLabel:'Synthetic property',timezone:'UTC',today:'2026-10-05',contextKey:'mounted775',loadCalendar:async()=>{const r=await fetch('/calendar');return r.json()},onOpenReservation(){}})));`);
    const build=await Bun.build({entrypoints:[entry],outdir:resolve(directory,"build"),target:"browser",format:"esm",define:{"process.env.NODE_ENV":"\"production\""}});if(!build.success)throw new Error(build.logs.map(String).join("\n"));
    server=Bun.serve({hostname:"127.0.0.1",port:0,fetch(request){const url=new URL(request.url),path=url.pathname;paths.push(path);
      if(path==="/")return new Response('<!doctype html><div id="root"></div><script type="module" src="/entry.js"></script>',{headers:{"content-type":"text/html"}});
      if(path==="/entry.js"||path==="/entry.css"){const file=resolve(directory,"build",path.slice(1));if(!file.startsWith(resolve(directory,"build")+sep)||!existsSync(file))return new Response("missing",{status:404});return new Response(Bun.file(file),{headers:{"content-type":path.endsWith("css")?"text/css":"text/javascript"}});}
      if(path==="/api/v1/auth/local:login")return Response.json({accessToken:`synthetic.${Buffer.from(JSON.stringify({sub:actor,tid:tenant})).toString("base64url")}.signature`,tokenType:"Bearer",expiresInSeconds:900,user:{id:actor,displayName:"Synthetic"}});
      if(path==="/api/v1/me/properties")return Response.json({properties:[{id:property,name:"Synthetic property",timezone:"UTC"}]});
      if(path==="/api/v1/auth/browser/logout")return Response.json({});
      if(request.method!=="GET")writes.push(request.method+" "+path);
      if(path==="/calendar")return Response.json(calendar);
      if(path.endsWith("/rate-configuration")){reads.push("plans");return Response.json({policies:[],ratePlans:[{id:plan,tenantId:tenant,propertyNode:property,code:"BAR",name:"Best available",currency:"INR",status:"active"}]});}
      if(path.endsWith("/inventory")){reads.push("inventory");return Response.json(inventory);}
      if(path.endsWith("/rate-prices/current")){reads.push("price:"+url.searchParams.toString());return deny?Response.json({},{status:403}):Response.json(price);}
      return Response.json({},{status:404});}});
    chrome=Bun.spawn([executable,"--headless=new","--disable-gpu","--no-first-run","--no-default-browser-check","--remote-debugging-address=127.0.0.1","--remote-debugging-port=0",`--user-data-dir=${profile}`,"about:blank"],{stdout:"ignore",stderr:"ignore",windowsHide:true});
    let port="";for(let i=0;i<500&&!port;i++){try{port=(await readFile(resolve(profile,"DevToolsActivePort"),"utf8")).split(/\r?\n/)[0]??"";}catch{}await Bun.sleep(20);}if(!port)throw new Error("Browser port missing");
    const targets=await fetchJsonBounded<{type:string;webSocketDebuggerUrl:string}[]>(`http://127.0.0.1:${port}/json/list`),target=targets.find(x=>x.type==="page");if(!target)throw new Error("Page missing");
    socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise<void>((done,fail)=>{socket!.onopen=()=>done();socket!.onerror=()=>fail(new Error("Socket failed"));});
    let sequence=0;const pending=new Map<number,(v:any)=>void>();socket.onmessage=event=>{const m=JSON.parse(String(event.data));if(m.method==="Runtime.exceptionThrown")errors.push(JSON.stringify(m.params));if(m.id&&pending.has(m.id)){pending.get(m.id)!(m.result);pending.delete(m.id);}};
    const send=<T,>(method:string,params:Record<string,unknown>={})=>new Promise<T>((done,fail)=>{const n=++sequence;pending.set(n,done);socket!.send(JSON.stringify({id:n,method,params}));setTimeout(()=>{if(pending.delete(n))fail(new Error("CDP timeout "+method));},10000);});
    const read=async<T,>(expression:string)=>{const v=await send<{result:{value:T};exceptionDetails?:unknown}>("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true});if(v.exceptionDetails)throw new Error(JSON.stringify(v.exceptionDetails));return v.result.value;};
    const until=async(expression:string)=>{for(let i=0;i<200;i++){if(await read<boolean>(expression))return;await Bun.sleep(25);}throw new Error("Condition not reached: "+expression+" / "+await read<string>("document.body.innerText")+" paths="+paths.join(",")+" errors="+errors.join(","));};
    await send("Page.enable");await send("Runtime.enable");await send("Page.navigate",{url:`http://127.0.0.1:${server.port}/`});
    await until("!!document.querySelector('[data-host-row]')");
    await read("document.querySelector('[data-host-row]').click()");await until("!!document.querySelector('[aria-label=\"Calendar settings\"]')");
    expect(await read<boolean>("document.body.innerText.includes('Blank dates do not confirm availability')")).toBe(true);
    await read("document.querySelector('[aria-label=\"Calendar settings\"]').click()");await until("!!document.querySelector('.host-settings-stack details:nth-child(3)')");
    await read("document.querySelector('.host-settings-stack details:nth-child(3) summary').click()");await until("document.querySelectorAll('.host-settings-stack select option').length===2");
    expect(await read<boolean>("document.body.innerText.includes('90,071,992,547,409.91')")).toBe(false);
    await read(`(()=>{const s=document.querySelector('.host-settings-stack select');s.value=${JSON.stringify(plan)};s.dispatchEvent(new Event('change',{bubbles:true}));const n=document.querySelector('.host-settings-stack input[type=number]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(n,'2');n.dispatchEvent(new Event('input',{bubbles:true}));n.dispatchEvent(new Event('change',{bubbles:true}));const c=document.querySelector('.host-settings-stack input[type=text]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(c,'DIRECT');c.dispatchEvent(new Event('input',{bubbles:true}));c.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    await until("!document.querySelector('.host-settings-stack details:nth-child(3) button').disabled");
    await read("document.querySelector('.host-settings-stack details:nth-child(3) button').click()");await until("document.body.innerText.includes('90,071,992,547,409.91')");
    expect(reads).toContain("inventory");expect(reads.some(x=>x.startsWith("price:ratePlanId="))).toBe(true);
    await read("(()=>{const n=document.querySelector('.host-settings-stack input[type=number]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(n,'3');n.dispatchEvent(new Event('input',{bubbles:true}));})()");
    await until("!document.body.innerText.includes('90,071,992,547,409.91')");
    await read("(()=>{const n=document.querySelector('.host-settings-stack input[type=number]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(n,'2');n.dispatchEvent(new Event('input',{bubbles:true}));})()");
    await read("document.querySelector('.host-settings-stack details:nth-child(3) button').click()");await until("document.body.innerText.includes('90,071,992,547,409.91')");
    deny=true;await read("document.querySelector('.host-settings-stack details:nth-child(3) button').click()");await until("!document.body.innerText.includes('90,071,992,547,409.91')");
    expect(await read<boolean>("document.body.innerText.includes('No applicable recorded tier')")).toBe(true);
    deny=false;await read("document.querySelector('.host-settings-stack details:nth-child(3) button').click()");await until("document.body.innerText.includes('90,071,992,547,409.91')");
    await read("(window).auth.logout()");await until("!document.body.innerText.includes('90,071,992,547,409.91')");
    expect(writes).toEqual([]);
  }finally{socket?.close();if(chrome)await terminateOwnedProcess(chrome);server?.stop(true);await rm(directory,{recursive:true,force:true});}
},30000);
