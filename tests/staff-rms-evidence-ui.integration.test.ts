import { expect, test } from "bun:test";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { RATE_MODEL_CATALOGUE } from "../src/contexts/rates/models";
import { resolveChromiumPath } from "./helpers/chromium-path";
import { fetchJsonBounded, terminateOwnedProcess } from "./helpers/owned-cdp-proof-lifecycle";

// Actual workspace, auth session and read client against an owned synthetic HTTP
// origin. This proves browser composition; it does not claim native API/DB UAT.
test("actual RMS workspace preserves controls, scoped reads and session/context fences", async () => {
  const chrome = resolveChromiumPath(); if (!chrome) throw new Error("Owned Chromium required for actual RMS caller proof");
  const root = resolve(import.meta.dir, ".."), proof = await mkdtemp(resolve(root, ".rms-caller-proof-"));
  const entry = resolve(proof, "fixture.tsx");
  const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  let mode = "ok", sessionNumber = 0;
  const held: Array<() => void> = [];
  const requests: Array<{ path: string; method: string; body: unknown }> = [];
  await writeFile(entry, `
import React from 'react';import {createRoot} from 'react-dom/client';import {flushSync} from 'react-dom';
import {StaffRmsWorkspace} from ${JSON.stringify(resolve(root, "frontend/yellow/src/workspaces/StaffRmsWorkspace.tsx"))};
import {reactAuthSession} from ${JSON.stringify(resolve(root, "frontend/yellow/src/auth-session.ts"))};
import ${JSON.stringify(resolve(root, "frontend/yellow/src/styles.css"))};
import ${JSON.stringify(resolve(root, "frontend/yellow/src/ui/reference-theme.css"))};
` + String.raw`
const checks=[],errors=[],writes=[],geometries=[];window.addEventListener('error',event=>errors.push(event.message));
Storage.prototype.setItem=function(...args){writes.push(args);throw new Error('Unexpected browser persistence');};
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const assert=(ok,message)=>{if(!ok)throw new Error(message);};const tick=()=>new Promise(resolve=>setTimeout(resolve,15));
const wait=async predicate=>{for(let i=0;i<180;i++){if(await predicate())return;await tick();}throw new Error('RMS observation timed out: '+document.body.textContent.slice(-1400));};
const control=async mode=>await fetch('/fixture-control?mode='+mode);
const state=async()=>await(await fetch('/fixture-status')).json();
const scope=()=>document.querySelector('article[aria-label="Staff RMS"]');const panel=()=>scope()?.querySelector('.rms-evidence');
const button=label=>[...scope().querySelectorAll('button')].find(button=>button.textContent===label);
const click=async label=>{assert(button(label)&&!button(label).disabled,'enabled control '+label);button(label).click();await tick();};
const field=label=>[...scope().querySelectorAll('label')].find(node=>node.firstChild.textContent===label)?.querySelector('input,select');
const edit=async(label,value)=>{const node=field(label);assert(node,'field '+label);const proto=node instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(node,value);node.dispatchEvent(new Event(node instanceof HTMLSelectElement?'change':'input',{bubbles:true}));await tick();};
let property=id(1),empty=false;const reactRoot=createRoot(document.getElementById('root'));
const render=()=>flushSync(()=>reactRoot.render(<StaffRmsWorkspace key={property} propertyId={property} snapshot={{ratePlans:empty?[]:[{id:id(3),name:'Flexible',code:'BAR'},{id:id(7),name:'Advance',code:'ADV'}],inventory:{sellableUnits:empty?[]:[{id:id(5),name:'Room101'},{id:id(6),name:'Room102'}]}}}/>));
const signIn=()=>reactAuthSession.signIn({tenant:'fixture',email:'fixture@example.test',password:'synthetic'},property);
const ready=()=>wait(()=>field('Arrival')?.value&&field('Departure')?.value);
const read=async(label,text)=>{await click(label);await wait(()=>panel()?.textContent.includes(text));assert(scope().querySelectorAll('.rms-evidence').length===1,'one selected evidence panel');};
const unavailable=()=>wait(()=>scope().querySelector('[role=alert]')&&!panel());
let sequence=0;const keyboard=async selector=>{document.querySelector(selector).focus();window.keyRequest={sequence:++sequence};await wait(()=>window.keyDone===sequence);};
const geometry=(view,size)=>{const list=panel().querySelector('.rms-evidence__metrics'),listRect=list.getBoundingClientRect();const rows=[...list.children].map(row=>{const r=row.getBoundingClientRect(),label=row.querySelector('dt').getBoundingClientRect(),value=row.querySelector('dd'),v=value.getBoundingClientRect();return {width:r.width,top:r.top,bottom:r.bottom,labelBottom:label.bottom,valueTop:v.top,valueWidth:v.width,valueOverflow:value.scrollWidth>value.clientWidth+1};});assert(rows.length===(view==='quote'?5:6),'complete selected metric list '+view);assert(rows.every((row,index)=>Math.abs(row.width-listRect.width)<=1&&(!index||row.top>=rows[index-1].bottom-1)&&!row.valueOverflow),'full-width nonoverlapping readable rows '+view+' '+size+' '+JSON.stringify({listWidth:listRect.width,rows}));if(innerWidth<600)assert(rows.every(row=>row.valueWidth>=row.width-2&&row.valueTop>=row.labelBottom-1),'stacked full-width mobile values '+view+' '+size);geometries.push({view,size,viewport:innerWidth,listWidth:listRect.width,rows});checks.push('actual '+view+' metric rows readable at '+size);};
(async()=>{
 await signIn();render();await reactAuthSession.grantedProperties();await tick();await tick();await read('Read model catalogue','Version 1');
 assert(panel().querySelectorAll('.rms-evidence__model').length===10,'actual catalogue model count');
 assert(panel().textContent.includes('Version 1')&&!scope().querySelector('.commercial-note'),'model versions without duplicate general note');checks.push('actual workspace selects catalogue and preserves returned model versions');
 const before=(await state()).requests.length;await keyboard('.rms-evidence__model summary');assert(panel().querySelector('details').open&&(await state()).requests.length===before,'native disclosure is request-free');
 await read('Read model catalogue','Version 1');assert(!panel().querySelector('details').open,'identical refresh remount resets disclosure');checks.push('trusted native disclosure is request-free and identical refresh resets it');
 await edit('Configured rate plan',id(7));assert(!panel(),'plan edit invalidates evidence');await read('Read model catalogue','Version 1');assert(panel().textContent.includes('ADV'),'new plan context');checks.push('configured plan change clears prior evidence and reads exact current plan');
 await click('Quote resolver');await ready();assert(!panel(),'view change clears model');await edit('Sellable unit',id(6));await edit('Arrival','2026-10-05');await edit('Departure','2026-10-08');await edit('Adults','2');await edit('Child ages','4, 12');await edit('Channel','mmt');
 await read('Resolve current quote','Returned quote: Quoted');assert(panel().textContent.includes('Room102')&&panel().textContent.includes('2026-10-05')&&panel().textContent.includes('Channel mmt'),'current quote context');
 for(const amount of ['9223372036854775807','-9007199254740993123','0 XYZ minor units','777 XYZ minor units'])assert(panel().textContent.includes(amount),'exact amount '+amount);
 geometry('quote','desktop');const request=(await state()).requests.findLast(item=>item.path.endsWith('quotes:resolve'));assert(request.method==='POST'&&request.body.sellableUnitId===id(6)&&request.body.stayStart==='2026-10-05T15:00:00.000Z'&&request.body.stayEnd==='2026-10-08T11:00:00.000Z'&&request.body.guests.adults===2&&JSON.stringify(request.body.guests.childAges)==='[4,12]'&&request.body.channelCode==='mmt'&&request.body.selectedPromotionCodes.length===0,'exact native client proposal');checks.push('actual quote controls preserve dates timezone guests channel and exact signed minor units');
 for(const mode of ['blocked','unpriced','conflict']){await control(mode);await read('Resolve current quote','Returned quote: '+mode[0].toUpperCase()+mode.slice(1));assert(panel().textContent.includes('fixture-'+mode),'reason '+mode);}checks.push('all unsuccessful quote states retain their explicit returned reasons');
 await control('ok');await edit('Child ages','bad');const invalidBefore=(await state()).requests.filter(item=>item.path.endsWith('quotes:resolve')).length;await click('Resolve current quote');await unavailable();assert((await state()).requests.filter(item=>item.path.endsWith('quotes:resolve')).length===invalidBefore,'invalid ages never transported');await edit('Child ages','4, 12');checks.push('invalid guest draft clears evidence without a quote request');
 for(const mode of ['403','500','malformed','wrong-scope']){await control(mode);await click('Resolve current quote');await unavailable();assert(!scope().textContent.includes('9223372036854775807'),'denied or invalid response retains no quote '+mode);await control('ok');await read('Resolve current quote','Returned quote: Quoted');}checks.push('server denial failure malformed and foreign-scope responses clear evidence and recover explicitly');
 await control('revoked');const revokedBefore=(await state()).requests.filter(item=>item.path.includes('/properties/')).length;await click('Resolve current quote');await unavailable();assert((await state()).requests.filter(item=>item.path.includes('/properties/')).length===revokedBefore,'fresh property denial precedes endpoint');await control('ok');checks.push('fresh property grants gate the actual read before an endpoint request');
 await control('hold');await click('Resolve current quote');await wait(async()=>(await state()).held===1);
 const heldState=await state();assert(heldState.held===1,'old quote held');assert(!panel(),'pending refresh clears current claim');await edit('Channel','direct');await control('release');await tick();await tick();assert(!panel()&&!scope().querySelector('[role=alert]'),'late response after edit cannot restore result or error');checks.push('draft edit aborts delayed quote and prevents stale result or error');
 await control('ok');await click('Recorded economics');await read('Read recorded economics','Property-local business date 2026-10-03');assert(panel().textContent.includes('FIRST')&&panel().textContent.includes('0 basis points')&&!field('Configured rate plan')&&!panel().textContent.includes('ADV'),'economics property-only');geometry('economics','desktop');checks.push('recorded economics is property-local and independent of quote and plan context');
 await control('hold');await click('Read recorded economics');await wait(async()=>(await state()).held===1);property=id(2);render();await control('ok');await read('Read model catalogue','Version 1');assert(panel().textContent.includes(id(2)),'property remount current');await control('release');await tick();assert(!scope().textContent.includes('FIRST'),'old economics excluded');checks.push('App-equivalent keyed property remount fences previous response');
 await control('hold');await click('Read model catalogue');await wait(async()=>(await state()).held===1);await reactAuthSession.logout();await wait(()=>!panel());await control('ok');await signIn();await tick();await read('Read model catalogue','Version 1');await control('release');await tick();assert(panel()&&!scope().textContent.includes('FIRST'),'new session excludes old evidence');checks.push('actual sign-out and same-principal new-token sign-in fence previous session');
 empty=true;render();await tick();await wait(()=>!panel());assert(scope().textContent.includes('No configured rate plan returned'),'empty snapshot no fabricated model selection');const removedBefore=(await state()).requests.length;await click('Read model catalogue');await unavailable();assert((await state()).requests.length===removedBefore,'removed plan never transported');await click('Recorded economics');await read('Read recorded economics','Property-local business date');checks.push('removed configured plan rejects before transport while property economics remains available');
 empty=false;render();await tick();await click('Quote resolver');await ready();await read('Resolve current quote','Returned quote: Quoted');
 window.layoutRequest='ordinary';await wait(()=>window.layoutDone==='ordinary');assert(innerWidth===375&&document.documentElement.scrollWidth<=innerWidth+1&&panel().scrollWidth<=panel().clientWidth+1,'actual 375px theme containment');geometry('quote','375px');checks.push('actual theme and workspace fit narrow mobile viewport');await click('Recorded economics');await read('Read recorded economics','Property-local business date');window.layoutRequest='economics-narrow';await wait(()=>window.layoutDone==='economics-narrow');geometry('economics','375px');await click('Quote resolver');await ready();await read('Resolve current quote','Returned quote: Quoted');
 window.layoutRequest='zoom';await wait(()=>window.layoutDone==='zoom');assert(document.documentElement.scrollWidth<=innerWidth+1&&panel().scrollWidth<=panel().clientWidth+1,'doubled text containment');geometry('quote','375px doubled text');checks.push('actual theme preserves evidence containment with doubled text');for(const [tab,readLabel,evidence] of [['Rate models','Read model catalogue','Version 1'],['Recorded economics','Read recorded economics','Property-local business date']]){await click(tab);await read(readLabel,evidence);assert(document.documentElement.scrollWidth<=innerWidth+1&&panel().scrollWidth<=panel().clientWidth+1,'other actual views doubled text '+tab);if(tab==='Recorded economics')geometry('economics','375px doubled text');}
 assert(!writes.length&&!errors.length,'no persistence or runtime errors '+errors.join(';'));const finalState=await state();assert(finalState.requests.filter(item=>item.path.includes('/properties/')).every(item=>item.method==='GET'||item.path.endsWith('/quotes:resolve')&&item.method==='POST'),'no authoring endpoints');checks.push('actual caller issues only scoped evidence reads and writes no browser credentials');
 flushSync(()=>reactRoot.unmount());await reactAuthSession.logout();
 const result=document.createElement('pre');result.id='proof';result.textContent=JSON.stringify({passed:true,checks,geometries,writes:writes.length,errors,requests:finalState.requests});document.body.replaceChildren(result);
})().catch(error=>{const body=document.body.textContent;const result=document.createElement('pre');result.id='proof';result.textContent=JSON.stringify({passed:false,error:String(error),checks,geometries,body:body.slice(-2000),errors});document.body.replaceChildren(result);});
`);
  const built = await Bun.build({ entrypoints: [entry], target: "browser", outdir: proof, naming: "[name].[ext]" });
  await writeFile(resolve(proof, "bundle-build.log"), built.logs.join("\n")+`\nsuccess=${built.success}\n`);
  expect(built.success, built.logs.join("\n")).toBe(true);
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, async fetch(request) {
    const url = new URL(request.url), path = url.pathname;
    if (path === "/fixture-control") { const next = url.searchParams.get("mode") ?? "ok"; if (next === "release") {mode="ok";held.splice(0).forEach(release=>release());} else mode=next; return Response.json({ok:true}); }
    if (path === "/fixture-status") return Response.json({requests,held:held.length});
    if (path === "/fixture.js" || path === "/fixture.css") return new Response(Bun.file(resolve(proof,path.slice(1))),{headers:{"content-type":path.endsWith("js")?"application/javascript":"text/css"}});
    if (path === "/api/v1/auth/local:login") { sessionNumber++; return Response.json({accessToken:"fixture."+Buffer.from(JSON.stringify({sub:uuid(10),tid:uuid(9),sequence:sessionNumber})).toString("base64url")+".fixture",tokenType:"Bearer",expiresInSeconds:900,user:{id:uuid(10),displayName:"Synthetic staff"}}); }
    if (path === "/api/v1/auth/browser/logout") return Response.json({ok:true});
    if (path === "/api/v1/me/properties") return Response.json({properties:[1,2].filter(n=>mode!=="revoked"||n===2).map(n=>({id:uuid(n),name:n===1?"FIRST":"SECOND",timezone:"UTC"}))});
    if (path.startsWith("/api/v1/properties/")) {
      const property=path.split("/")[4]!,plan=path.split("/")[6]!;
      const body=request.method==="POST"?await request.json() as Record<string,any>:null;
      requests.push({path,method:request.method,body});
      if(!request.headers.get("authorization")?.startsWith("Bearer fixture.")) return Response.json({error:"fixture-auth"},{status:401});
      const currentMode=mode;
      const scopeProperty=currentMode==="wrong-scope"?uuid(20):property;
      let value:unknown={catalogue:RATE_MODEL_CATALOGUE,modelDrafts:[],targetDrafts:[],releases:[]};
      if (currentMode==="wrong-scope") value={catalogue:RATE_MODEL_CATALOGUE,modelDrafts:[{id:uuid(8),propertyNode:scopeProperty,ratePlanId:plan}],targetDrafts:[],releases:[]};
      if (path.endsWith("quotes:resolve")&&body) value={quote:{propertyNode:scopeProperty,ratePlanId:plan,sellableUnitId:body.sellableUnitId,propertyTimeZone:"UTC",stayStartDate:String(body.stayStart).slice(0,10),stayEndDate:String(body.stayEnd).slice(0,10),quoteHash:"synthetic-quote",taxAssignmentState:null,result:{state:["blocked","unpriced","conflict"].includes(currentMode)?currentMode:"quoted",reason:["blocked","unpriced","conflict"].includes(currentMode)?"fixture-"+currentMode:null,currency:"XYZ",guests:body.guests,distributionEvidence:{channelCode:body.channelCode},roomAmountMinor:"9223372036854775807",includedAllocationMinor:"0",packageExtraMinor:null,promotionDiscountMinor:"-9007199254740993123",preTaxSubtotalMinor:"777"}}};
      if (path.endsWith("commercial-contribution")) value={provenance:"stats_daily_commercial_taxonomy",property:{name:property===uuid(1)?"FIRST":"SECOND",businessDate:"2026-10-03",currency:"XYZ"},total:{roomNights:0,roomsAvailable:0,occupancyBasisPoints:0,roomRevenueMinor:"0",adrMinor:"9223372036854775807",revparMinor:"-9223372036854775808"}};
      const response=currentMode==="403"||currentMode==="500"?Response.json({error:"fixture"},{status:Number(currentMode)}):currentMode==="malformed"?new Response("not-json"):Response.json(value);
      if(currentMode==="hold") return await new Promise<Response>(release=>held.push(()=>release(response)));
      return response;
    }
    if(path!=="/")return new Response("Not found",{status:404});
    return new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"><div id="root" class="yellow-next"></div><script src="/fixture.js"></script>',{headers:{"content-type":"text/html"}});
  }});
  // Owned bounded CDP lifecycle follows below; all proof/profile files retained.
  let socket:WebSocket|undefined;let send:((method:string,params?:Record<string,unknown>)=>Promise<any>)|undefined;
  const child=Bun.spawn([chrome,'--headless=new','--no-first-run','--no-default-browser-check','--disable-gpu','--disable-background-networking',`--user-data-dir=${resolve(proof,'profile')}`,'--remote-debugging-port=0','about:blank'],{cwd:root,stdin:'ignore',stdout:'ignore',stderr:'ignore'});
  let evidence:any;const diagnostics:unknown[]=[];const expires=Date.now()+20_000;
  try{
    let port:string|undefined;while(!port&&Date.now()<expires){try{port=(await readFile(resolve(proof,'profile/DevToolsActivePort'),'utf8')).split('\n')[0];}catch{await Bun.sleep(25);}}
    if(!port)throw new Error('Owned debugger did not become ready');
    const targets=await fetchJsonBounded<Array<{type:string;url:string;webSocketDebuggerUrl?:string}>>(`http://127.0.0.1:${port}/json/list`);
    const target=targets.find(target=>target.type==='page'&&target.url==='about:blank');if(!target?.webSocketDebuggerUrl)throw new Error('Owned blank target unavailable');
    socket=new WebSocket(target.webSocketDebuggerUrl);
    await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('CDP open deadline')),5_000);socket!.onopen=()=>{clearTimeout(timer);resolve();};socket!.onerror=()=>{clearTimeout(timer);reject(new Error('CDP open failed'));};});
    let id=0;const pending=new Map<number,{resolve:(value:any)=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>}>();
    socket.onmessage=event=>{const response=JSON.parse(String(event.data));if(response.method==='Runtime.exceptionThrown')diagnostics.push(response.params);const request=pending.get(response.id);if(!request)return;pending.delete(response.id);clearTimeout(request.timer);response.error?request.reject(new Error(JSON.stringify(response.error))):request.resolve(response.result);};
    send=(method,params={})=>new Promise((resolve,reject)=>{const requestId=++id;const timer=setTimeout(()=>{pending.delete(requestId);reject(new Error('CDP deadline '+method));},5_000);pending.set(requestId,{resolve,reject,timer});socket!.send(JSON.stringify({id:requestId,method,params}));});
    await send('Runtime.enable');await send('Emulation.setDeviceMetricsOverride',{width:1200,height:1000,deviceScaleFactor:1,mobile:false});
    await send('Page.navigate',{url:`http://127.0.0.1:${server.port}/`});await send('Page.bringToFront');await send('Emulation.setFocusEmulationEnabled',{enabled:true});
    let handled=0;const layouts=new Set<string>();
    while(Date.now()<expires){const state=await send('Runtime.evaluate',{expression:"JSON.stringify({proof:document.getElementById('proof')?.textContent,key:window.keyRequest,layout:window.layoutRequest})",returnByValue:true});const observation=JSON.parse(state.result.value);
      if(observation.proof){evidence=JSON.parse(observation.proof);break;}
      if(observation.key?.sequence>handled){const sequence=observation.key.sequence;
        if(sequence===1){const snapshot=await send('Page.captureScreenshot',{format:'png'});await writeFile(resolve(proof,'models-desktop.png'),Buffer.from(snapshot.data,'base64'));}
        await send('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space',windowsVirtualKeyCode:32,text:' '});await send('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32});await send('Runtime.evaluate',{expression:`window.keyDone=${sequence}`});handled=sequence;}
      if(observation.layout&&!layouts.has(observation.layout)){
        if(observation.layout!=='zoom')await send('Emulation.setDeviceMetricsOverride',{width:375,height:700,deviceScaleFactor:1,mobile:false});else await send('Runtime.evaluate',{expression:"document.documentElement.style.fontSize='32px'"});
        if(['ordinary','models-narrow','economics-narrow'].includes(observation.layout)){const snapshot=await send('Page.captureScreenshot',{format:'png'});const file=observation.layout==='ordinary'?'quote-narrow.png':observation.layout+'.png';await writeFile(resolve(proof,file),Buffer.from(snapshot.data,'base64'));}
        await send('Runtime.evaluate',{expression:`window.layoutDone=${JSON.stringify(observation.layout)}`});layouts.add(observation.layout);}
      await Bun.sleep(20);
    }
    if(!evidence){diagnostics.push(await send('Runtime.evaluate',{expression:'document.documentElement.outerHTML',returnByValue:true}));await writeFile(resolve(proof,'failure.json'),JSON.stringify(diagnostics,null,2));throw new Error('RMS proof exceeded20seconds: '+JSON.stringify(diagnostics).slice(-1800));}
    await writeFile(resolve(proof,'receipt.json'),JSON.stringify(evidence,null,2));expect(evidence.passed,JSON.stringify(evidence)).toBe(true);expect(evidence.checks).toHaveLength(22);expect(evidence.writes).toBe(0);
  }finally{await terminateOwnedProcess(child,send?()=>send!('Browser.close'):undefined);socket?.close();server.stop(true);}
},30_000);
