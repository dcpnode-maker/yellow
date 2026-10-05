import { expect, test } from "bun:test";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { createApp } from "../src/app";
import type { OperatorHttpApi } from "../src/http/operator";
import { resolveChromiumPath } from "./helpers/chromium-path";
import { fetchJsonBounded, terminateOwnedProcess } from "./helpers/owned-cdp-proof-lifecycle";

const repository = resolve(import.meta.dir, "..");
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const assets: Record<string, [string,string]> = {
  "/assets/operator.js": ["operator.js","text/javascript"],
  "/assets/operator.css": ["operator.css","text/css"],
  "/assets/operator-interfaces.js": ["operator-interfaces.js","text/javascript"],
  "/assets/operator-interfaces.css": ["operator-interfaces.css","text/css"],
  "/assets/operator-layouts.js": ["operator-layouts.js","text/javascript"],
  "/assets/operator-inventory-relationships.js": ["inventory-relationships-view.mjs","text/javascript"],
  "/assets/operator-inventory-relationships-model.js": ["inventory-relationships-model.mjs","text/javascript"],
  "/assets/operator-inventory-relationships.css": ["inventory-relationships-view.css","text/css"],
};

test("actual application serves the scoped inventory modules with exact bytes and normal security headers", async () => {
  // No API call or database fixture: the operator stub admits static route registration only.
  const app = createApp({ operatorApi: {} as OperatorHttpApi });
  for (const [path,[file,mime]] of Object.entries(assets).filter(([path])=>path.includes("inventory-relationships"))) {
    const response = await app.handle(new Request("http://localhost"+path));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(mime+"; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe("no-cache");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    const actual = createHash("sha256").update(await response.text()).digest("hex");
    const expected = createHash("sha256").update(await Bun.file(resolve(repository,"src/http/operator",file)).text()).digest("hex");
    expect(actual).toBe(expected);
  }
});

test("real inventory page fences reads and imports, clears denied context and preserves its configuration controls", async () => {
  const chrome = resolveChromiumPath();
  if (!chrome) throw new Error("Owned Chromium is required for actual inventory page proof");
  const proof = await mkdtemp(resolve(repository,".inventory-page-proof-"));
  let mode = "module-failed", actor = 1, heldImport = false;
  const held: Array<() => void> = [], heldModules: Array<() => void> = [], heldProjections: Array<() => void> = [];
  const requests: Array<{path: string;method: string}> = [];
  const token = () => "fixture."+Buffer.from(JSON.stringify({tid:uuid(actor===1?9:19),sub:uuid(actor===1?10:20),scp:["inventory.configuration:read"]})).toString("base64url")+".fixture";
  const inventory = (property: string) => {
    const tag = property===uuid(1)?"FIRST":"SECOND";
    const scope = {propertyNode:property,tenantId:uuid(actor===1?9:19)};
    const label = actor===1?tag:"NEW_ACTOR_"+tag;
    return {unitTypes:[{...scope,id:uuid(3),code:"APT",name:label,profileKey:"hotel",baseOccupancy:2,maxOccupancy:2,attrs:{privateNote:"PRIVATE_FIXTURE_ATTRIBUTE"}}],
      spaces:[{...scope,id:uuid(4),code:label+"_ROOM",floor:null,status:"active",profileKey:"hotel",capacity:2}],
      sellableUnits:[{...scope,id:uuid(5),unitTypeId:uuid(3),unitTypeCode:"APT",name:label+"_WHOLE",status:"active",spaces:[{spaceId:uuid(4),code:label+"_ROOM",claimMode:"exclusive"}]}]};
  };
  const html = await Bun.file(resolve(repository,"src/http/operator/index.html")).text();
  const driver = `<script>
const checks=[], errors=[];window.addEventListener('error',event=>errors.push(String(event.message)));
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const tick=()=>new Promise(resolve=>setTimeout(resolve,10));
const assert=(ok,message)=>{if(!ok)throw new Error(message);};
const wait=async predicate=>{for(let i=0;i<200;i++){if(predicate())return;await tick();}throw new Error('observation timed out: '+document.querySelector('#inventory-status').textContent);};
const control=async value=>{await fetch('/fixture-control?mode='+value);};
const fixtureState=async()=>await(await fetch('/fixture-status')).json();
const mount=()=>document.querySelector('#inventory-relationships-mount');
const refresh=()=>document.querySelector('#refresh-inventory').click();
const ready=label=>wait(()=>mount().textContent.includes(label+'_WHOLE'));
const select=property=>{const node=document.querySelector('#property-select');node.value=property;node.dispatchEvent(new Event('change'));};
const signIn=async()=>{const form=document.querySelector('#login-form');await wait(()=>!form.querySelector('button[type=submit]').disabled);form.elements.tenant.value='fixture';form.elements.email.value='fixture@example.test';form.elements.password.value='fixture';form.requestSubmit();await wait(()=>document.querySelector('#login-view').hidden);};
let keySequence=0;
const keyboard=async selector=>{const target=document.querySelector(selector);target.focus();const sequence=++keySequence;window.keyRequest={sequence};await wait(()=>window.keyDone===sequence);await tick();};
(async()=>{
 await signIn();
 if(location.search.includes('import-race')){
  let state;for(let i=0;i<150;i++){state=await fixtureState();if(state.heldModules)break;await tick();}assert(state.heldModules===1,'initial module import held');
  select(id(2));assert(!mount().textContent.includes('FIRST'),'property clears mount while import pending');await control('release-modules');await ready('SECOND');
  assert(!mount().textContent.includes('FIRST')&&document.querySelector('#sellable-space').textContent.includes('SECOND_ROOM'),'late import mounts current property only');checks.push('property switch during module import excludes old data and selector options');
 }else{
  await wait(()=>mount().textContent.includes('unavailable'));assert(!mount().querySelector('.inventory-relationships')&&document.querySelector('#sellable-space').disabled,'module failure clears read options');checks.push('failed module is unavailable before mounting any records');
  await control('ok');refresh();await ready('FIRST');checks.push('explicit retry recovers failed module without cached data');
  assert(!document.querySelector('#unit-type-list')&&!document.querySelector('#space-list')&&!document.querySelector('#sellable-list'),'flat duplicate lists removed');
  assert(document.querySelector('#unit-type-count').textContent==='1'&&mount().querySelector('.inventory-relationships__counts').hidden,'existing metrics retained without duplicate visible counts');
  for(const form of ['unit-type-form','space-form','sellable-unit-form','bulk-room-form','projection-rebuild-form'])assert(document.getElementById(form),'existing form '+form);
  assert(document.querySelector('#sellable-unit-type').value===id(3)&&document.querySelector('#sellable-space').value===id(4)&&document.querySelector('#bulk-room-unit-type').value===id(3),'configuration selectors still populate exact identities');
  assert(!mount().textContent.includes('PRIVATE_FIXTURE_ATTRIBUTE'),'attrs not disclosed');checks.push('existing metrics forms and exact selector identities retained');
  const before=(await fixtureState()).requests;await keyboard('.inventory-relationships__supporting summary');
  assert(mount().querySelector('.inventory-relationships__supporting').open&&(await fixtureState()).requests===before,'native Details makes no requests');checks.push('trusted native Details has no transport or command effects');
  await control('hold');refresh();let state;for(let i=0;i<150;i++){state=await fixtureState();if(state.held)break;await tick();}assert(state.held===1,'old property response held');
  assert(!mount().textContent.includes('FIRST'),'pending refresh clears prior current claim');await control('ok');select(id(2));await ready('SECOND');await control('release');await tick();
  assert(!mount().textContent.includes('FIRST')&&document.querySelector('#sellable-space').textContent.includes('SECOND_ROOM'),'late prior response fenced');checks.push('response race and pending refresh cannot restore previous property data');
  await control('hold-projection');refresh();await ready('SECOND');let projectionState;for(let i=0;i<150;i++){projectionState=await fixtureState();if(projectionState.heldProjections)break;await tick();}assert(projectionState.heldProjections===1,'prior projection response held');
  await control('ok');select(id(1));await ready('FIRST');await wait(()=>document.querySelector('#projection-summary').textContent.includes('· 1 rows'));await control('release-projections');await tick();await tick();
  assert(document.querySelector('#projection-summary').textContent.includes('· 1 rows'),'late prior projection cannot restore another property summary');checks.push('projection context follows the same property and session fence');select(id(2));await ready('SECOND');
  for(const denial of ['401','403','404','500','malformed','wrong-scope','duplicate']){
   await control(denial);refresh();await wait(()=>mount().textContent.includes('unavailable'));
   assert(!mount().querySelector('.inventory-relationships')&&document.querySelector('#sellable-space').disabled&&document.querySelector('#sellable-space').options.length===0&&document.querySelector('#unit-type-count').textContent==='—','denial clears records options counts '+denial);
   const deniedForm=document.querySelector('#restriction-form'),deniedBefore=(await fixtureState()).requests;assert(document.querySelector('#restriction-unit-type').disabled&&deniedForm.querySelector('button[type=submit]').disabled,'denied restriction context has no implicit All scope '+denial);deniedForm.dispatchEvent(new Event('submit',{cancelable:true}));await tick();assert((await fixtureState()).requests===deniedBefore,'denied restriction handler creates no request '+denial);
   await control('ok');refresh();await ready('SECOND');assert(!mount().querySelector('details').open,'new snapshot resets disclosure');checks.push(denial+' clears evidence and explicit recovery resets disclosure');
  }
  await control('hold');refresh();let state2;for(let i=0;i<150;i++){state2=await fixtureState();if(state2.held)break;await tick();}
  document.querySelector('#sign-out').click();assert(!mount().textContent.includes('SECOND'),'signout clears evidence');await control('actor-two');await signIn();await ready('NEW_ACTOR_FIRST');await control('release');await tick();
  assert(!mount().textContent.includes('SECOND')&&document.querySelector('#sellable-space').textContent.includes('NEW_ACTOR_FIRST_ROOM'),'late earlier session cannot restore data');checks.push('session replacement fences prior responses and selector options');
  await control('empty');refresh();await wait(()=>mount().textContent.includes('No unit types in returned configuration'));
  assert(document.querySelector('#unit-type-count').textContent==='0'&&document.querySelector('#sellable-space').disabled,'empty snapshot has no invented row or first-row tenant');checks.push('empty configuration uses session metadata and returned zero counts');
  document.querySelector('.domain-tab[data-view=restrictions]').click();await wait(()=>document.querySelector('#restriction-status').textContent.includes('current'));
  const restrictionSelector=document.querySelector('#restriction-unit-type'),restrictionForm=document.querySelector('#restriction-form');
  assert(restrictionSelector.options.length===1&&!restrictionSelector.disabled&&new FormData(restrictionForm).get('unitTypeId')==='','valid empty configuration preserves explicit All room types field');checks.push('valid empty restriction snapshot restores explicit All room types selector');
  document.querySelector('.domain-tab[data-view=inventory]').click();
  await control('ok');refresh();await ready('NEW_ACTOR_FIRST');
  for(const entry of [['operations','SECOND'],['restrictions','FIRST'],['rates','SECOND']]){
   await control('hold');document.querySelector('.domain-tab[data-view='+entry[0]+']').click();let state3;for(let i=0;i<150;i++){state3=await fixtureState();if(state3.held)break;await tick();}
   if(entry[0]==='restrictions'){
    const before=(await fixtureState()).requests;assert(restrictionSelector.disabled&&restrictionForm.querySelector('button[type=submit]').disabled,'pending restriction read disables broadening selection and submit');restrictionForm.dispatchEvent(new Event('submit',{cancelable:true}));await tick();assert((await fixtureState()).requests===before,'pending restriction handler creates no request');
   }
   await control('ok');select(entry[1]==='FIRST'?id(1):id(2));await control('release');await tick();
   if(entry[0]==='restrictions'){
    await wait(()=>restrictionSelector.options.length===2);assert(!restrictionSelector.disabled,'successful restriction read restores room-type selector');restrictionSelector.value=id(3);assert(new FormData(restrictionForm).get('unitTypeId')===id(3),'selected restriction scope survives FormData');checks.push('restriction selector readiness preserves exact FormData scope and prevents pending writes');
   }
   document.querySelector('.domain-tab[data-view=inventory]').click();await ready('NEW_ACTOR_'+entry[1]);assert(!mount().textContent.includes(entry[1]==='FIRST'?'NEW_ACTOR_SECOND':'NEW_ACTOR_FIRST'),'other loader older context fenced');checks.push(entry[0]+' inventory admission follows current property and token');
  }
 }
 assert(!errors.length,'actual operator script has no runtime exception '+errors.join(';'));checks.push('actual legacy shell and scripts remain executable');
 const result=document.createElement('pre');result.id='proof';result.textContent=JSON.stringify({passed:true,checks});document.body.replaceChildren(result);
})().catch(error=>{const result=document.createElement('pre');result.id='proof';result.textContent=JSON.stringify({passed:false,error:String(error),checks,errors});document.body.replaceChildren(result);});
</script>`;
  const server = Bun.serve({hostname:"127.0.0.1",port:0,async fetch(request) {
    const url = new URL(request.url), path = url.pathname;
    if(path==="/fixture-control") {
      const next=url.searchParams.get("mode")!;
      if(next==="release"){held.splice(0).forEach(fn=>fn());}
      else if(next==="release-modules"){mode="ok";heldModules.splice(0).forEach(fn=>fn());}
      else if(next==="release-projections"){heldProjections.splice(0).forEach(fn=>fn());}
      else if(next==="actor-two"){actor=2;mode="ok";}
      else mode=next;
      return Response.json({ok:true});
    }
    if(path==="/fixture-status")return Response.json({held:held.length,heldModules:heldModules.length,heldProjections:heldProjections.length,requests:requests.length});
    if(assets[path]) {
      const [file,mime]=assets[path];
      const response=()=>new Response(Bun.file(resolve(repository,"src/http/operator",file)),{headers:{"content-type":mime,"cache-control":"no-cache"}});
      if(path==="/assets/operator-inventory-relationships.js"&&mode==="module-failed")return new Response("unavailable",{status:503});
      if(path==="/assets/operator-inventory-relationships.js"&&mode==="hold-import"&&!heldImport){heldImport=true;return new Promise<Response>(resolve=>heldModules.push(()=>resolve(response())));}
      return response();
    }
    if(path.startsWith("/static/"))return new Response(null,{status:404});
    if(path==="/api/v1/auth/local:login")return Response.json({accessToken:token(),user:{id:uuid(actor===1?10:20),displayName:"Fixture operator"}});
    if(path.startsWith("/api/")) {
      requests.push({path,method:request.method});
      if(request.headers.get("authorization")!=="Bearer "+token())return Response.json({detail:"Fixture session denied"},{status:401});
      if(path==="/api/v1/me/properties")return Response.json({properties:[{id:uuid(1),name:"First fixture",timezone:"Asia/Kolkata"},{id:uuid(2),name:"Second fixture",timezone:"Asia/Kolkata"}]});
      const property=path.split("/")[4]!;
      if(path.endsWith("/inventory")){
        const data=inventory(property);
        if(mode==="hold")return new Promise<Response>(resolve=>held.push(()=>resolve(Response.json(data))));
        if(["401","403","404","500"].includes(mode))return Response.json({detail:"Fixture denied "+mode},{status:Number(mode)});
        if(mode==="empty")return Response.json({unitTypes:[],spaces:[],sellableUnits:[]});
        if(mode==="malformed")return Response.json({unitTypes:[]});
        if(mode==="wrong-scope")data.spaces[0]!.propertyNode=uuid(99);
        if(mode==="duplicate")data.spaces.push({...data.spaces[0]!});
        return Response.json(data);
      }
      if(path.endsWith("/availability-projection")){
        const data={fromDate:"2026-10-03",toDate:"2026-11-03",rows:property===uuid(1)?1:2,unitTypes:1,updatedAt:"2026-10-03T00:00:00Z"};
        if(mode==="hold-projection")return new Promise<Response>(resolve=>heldProjections.push(()=>resolve(Response.json(data))));
        return Response.json(data);
      }
      if(path.endsWith("/operational-blocks"))return Response.json({operationalBlocks:[]});
      if(path.endsWith("/inventory-policy"))return Response.json({inventoryPolicy:{oosSellability:"blocked"}});
      if(path.endsWith("/restrictions"))return Response.json({restrictions:[]});
      if(path.endsWith("/rate-configuration"))return Response.json({policies:[],ratePlans:[]});
      return Response.json({detail:"Unsupported fixture route"},{status:404});
    }
    return new Response(html.replace("</body>",driver+"</body>"),{headers:{"content-type":"text/html"}});
  }});
  const child = Bun.spawn([chrome,"--headless=new","--disable-gpu","--no-first-run","--no-default-browser-check","--disable-background-networking",`--user-data-dir=${resolve(proof,"profile")}`,"--remote-debugging-port=0","about:blank"],{stdin:"ignore",stdout:"ignore",stderr:"ignore"});
  let socket: WebSocket|undefined, send: ((method:string,params?:Record<string,unknown>)=>Promise<any>)|undefined;
  const evidence: unknown[]=[];
  try {
    const expires=Date.now()+20_000;let port:string|undefined;
    while(!port&&Date.now()<expires){try{port=(await readFile(resolve(proof,"profile/DevToolsActivePort"),"utf8")).split("\n")[0];}catch{await Bun.sleep(25);}}
    if(!port)throw new Error("Owned browser did not become ready");
    const targets=await fetchJsonBounded<Array<{type:string;url:string;webSocketDebuggerUrl?:string}>>(`http://127.0.0.1:${port}/json/list`);
    const target=targets.find(t=>t.type==="page"&&t.url==="about:blank");if(!target?.webSocketDebuggerUrl)throw new Error("Owned target unavailable");
    socket=new WebSocket(target.webSocketDebuggerUrl);
    await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error("CDP open deadline")),5000);socket!.onopen=()=>{clearTimeout(timer);resolve();};socket!.onerror=()=>{clearTimeout(timer);reject(new Error("CDP open failed"));};});
    let sequence=0;const pending=new Map<number,{resolve:(value:any)=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>}>();
    socket.onmessage=event=>{const message=JSON.parse(String(event.data)),request=pending.get(message.id);if(!request)return;pending.delete(message.id);clearTimeout(request.timer);message.error?request.reject(new Error(JSON.stringify(message.error))):request.resolve(message.result);};
    send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(new Error("CDP deadline "+method));},5000);pending.set(id,{resolve,reject,timer});socket!.send(JSON.stringify({id,method,params}));});
    await send("Emulation.setDeviceMetricsOverride",{width:375,height:844,deviceScaleFactor:1,mobile:false});
    await send("Emulation.setFocusEmulationEnabled",{enabled:true});
    for(const scenario of ["normal","import-race"]){
      if(scenario==="import-race"){mode="hold-import";actor=1;heldImport=false;}
      await send("Page.navigate",{url:`http://127.0.0.1:${server.port}/p/${uuid(1)}/inventory?${scenario}`});
      let result:any,handled=0;
      while(Date.now()<expires){
        const state=await send("Runtime.evaluate",{expression:"JSON.stringify({proof:document.getElementById('proof')?.textContent,key:window.keyRequest})",returnByValue:true});
        const value=JSON.parse(state.result.value);
        if(value.proof){result=JSON.parse(value.proof);break;}
        if(value.key?.sequence>handled){await send("Input.dispatchKeyEvent",{type:"keyDown",key:" ",code:"Space",windowsVirtualKeyCode:32,text:" "});await send("Input.dispatchKeyEvent",{type:"keyUp",key:" ",code:"Space",windowsVirtualKeyCode:32});await send("Runtime.evaluate",{expression:`window.keyDone=${value.key.sequence}`});handled=value.key.sequence;}
        await Bun.sleep(20);
      }
      if(!result)throw new Error("Actual page proof exceeded owned20second budget");
      evidence.push(result);await writeFile(resolve(proof,"receipt.json"),JSON.stringify(evidence,null,2));
      expect(result.passed,JSON.stringify(result)).toBe(true);
    }
    expect(requests.filter(row=>row.method!=="GET")).toHaveLength(0);
  } finally {await terminateOwnedProcess(child,send?()=>send!("Browser.close"):undefined);socket?.close();server.stop(true);}
},30_000);
