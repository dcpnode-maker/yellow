import { expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { RATE_MODEL_CATALOGUE } from '../src/contexts/rates/models';
import { createStaffRmsEvidencePanel } from '../frontend/yellow/src/workspaces/StaffRmsEvidencePanel.mjs';
import { resolveChromiumPath } from './helpers/chromium-path';
import { fetchJsonBounded, terminateOwnedProcess } from './helpers/owned-cdp-proof-lifecycle';

test('RMS pure factory withholds unavailable values and escapes caller context', () => {
  const Panel=createStaffRmsEvidencePanel(createElement);
  const quote={state:'quoted',reason:null,currency:'XYZ',quoteHash:'private-reference',taxAssignmentState:null,components:{roomAmountMinor:'9007199254740993'}};
  const html=renderToString(createElement(Panel,{view:'quote',contextLabel:'<script>hostile</script>',evidenceState:'unavailable',quote}));
  expect(html).toContain('Evidence unavailable');expect(html).not.toContain('9007199254740993');expect(html).not.toContain('private-reference');
  expect(html).toContain('&lt;script&gt;hostile&lt;/script&gt;');expect(html).not.toContain('<script>');
  const empty=renderToString(createElement(Panel,{view:'economics',contextLabel:'Selected property',evidenceState:'current'}));
  expect(empty).toContain('No recorded economics evidence returned');expect(empty).not.toContain('0 minor units');
});

test('mounted RMS evidence preserves actual validated DTO semantics without effects',async()=>{
  const chrome=resolveChromiumPath();if(!chrome)throw new Error('Owned Chromium required for RMS mounted proof');
  const root=resolve(import.meta.dir,'..'),proof=await mkdtemp(resolve(root,'.rms-evidence-proof-'));
  const entry=resolve(proof,'fixture.tsx');
  await writeFile(entry,`
import React from 'react';import {createRoot} from 'react-dom/client';import {flushSync} from 'react-dom';
import {StaffRmsEvidencePanel as Panel} from ${JSON.stringify(resolve(root,'frontend/yellow/src/workspaces/StaffRmsEvidencePanel.tsx'))};
import {parseStaffRateBuilder,parseStaffRateQuote,parseStaffEconomics} from ${JSON.stringify(resolve(root,'frontend/yellow/src/workspaces/staff-rms-client.ts'))};
// Serialize the actual host catalogue. Its backend module imports Bun SQL and
// cannot be a browser module; the browser still invokes the real DTO parser.
const RATE_MODEL_CATALOGUE=${JSON.stringify(RATE_MODEL_CATALOGUE)};
const checks=[],requests=[],writes=[],keys=[],layout=[];
const assert=(ok,message)=>{if(!ok)throw new Error(message);};const tick=()=>new Promise(resolve=>setTimeout(resolve,10));
const wait=async predicate=>{for(let i=0;i<150;i++){if(predicate())return;await tick();}throw new Error('fixture observation timed out');};
window.fetch=(...args)=>{requests.push(args);throw new Error('Unexpected presentation fetch');};
XMLHttpRequest.prototype.send=function(...args){requests.push(args);throw new Error('Unexpected presentation XHR');};
Storage.prototype.setItem=function(...args){writes.push(args);throw new Error('Unexpected presentation storage');};
document.addEventListener('keydown',event=>keys.push({key:event.key,trusted:event.isTrusted}));
const P='6081b544-22a1-534f-a86d-bb1ae0519e14',R='22222222-2222-4222-8222-222222222222',U='11111111-1111-4111-8111-111111111111';
const draft={arrivalDate:'2026-10-03',departureDate:'2026-10-06',adults:2,childAges:[12],channelCode:'direct'};
const builderRaw={catalogue:RATE_MODEL_CATALOGUE,modelDrafts:[],targetDrafts:[],releases:[{id:U,propertyNode:P,ratePlanId:R,authoringCommand:{never:'expose'}}]};
const builder=parseStaffRateBuilder(builderRaw,P,R);
const makeQuote=(changes={},evidence={})=>parseStaffRateQuote({quote:{propertyNode:P,ratePlanId:R,sellableUnitId:U,propertyTimeZone:'Asia/Kolkata',stayStartDate:draft.arrivalDate,stayEndDate:draft.departureDate,quoteHash:'synthetic-quote-hash',taxAssignmentState:'none',...evidence,result:{state:'quoted',reason:null,currency:'INR',guests:{adults:2,childAges:[12]},distributionEvidence:{channelCode:'direct'},roomAmountMinor:'9223372036854775807',includedAllocationMinor:'0',packageExtraMinor:'31',promotionDiscountMinor:'-9007199254740993123',preTaxSubtotalMinor:'777',...changes}}},P,R,U,'Asia/Kolkata',draft);
const quote=makeQuote();
const economicRaw={provenance:'stats_daily_commercial_taxonomy',property:{name:'Synthetic property',businessDate:'2026-10-03',currency:'INR'},total:{roomNights:0,roomsAvailable:0,occupancyBasisPoints:0,roomRevenueMinor:'0',adrMinor:'9223372036854775807',revparMinor:'-9223372036854775808'}};
const economics=parseStaffEconomics(economicRaw,'Synthetic property');
let props={view:'models',contextLabel:'Synthetic property · BAR',evidenceState:'current',builder,quote,economics};
const reactRoot=createRoot(document.getElementById('root'));
const render=change=>{props={...props,...change};flushSync(()=>reactRoot.render(<Panel {...props}/>));};
const panel=()=>document.querySelector('.rms-evidence'),body=()=>panel()?.textContent||'';
const value=label=>[...panel().querySelectorAll('.rms-evidence__row')].find(row=>row.querySelector('dt').textContent===label)?.querySelector('dd').textContent;
const visibleText=node=>node.nodeType===Node.TEXT_NODE?node.textContent:node.tagName==='DETAILS'&&!node.open?node.querySelector('summary').textContent:[...node.childNodes].map(visibleText).join(' ');
let keySequence=0;const keyboard=async selector=>{const target=panel().querySelector(selector);assert(target,'keyboard target missing');target.focus();const sequence=++keySequence;window.keyRequest={sequence,key:' '};await wait(()=>window.keyDone===sequence);await tick();};
(async()=>{
 const before=JSON.stringify({builder,quote,economics});render({});await tick();
 assert(panel().querySelectorAll('.rms-evidence__model').length===RATE_MODEL_CATALOGUE.length,'actual catalogue count');
 RATE_MODEL_CATALOGUE.forEach(model=>assert(body().includes(model.label)&&body().includes(model.description)&&body().includes('Version '+model.version),'returned catalogue labels description version'));
 assert(body().includes('0 model drafts · 0 target drafts · 1 releases returned')&&!body().includes('authoringCommand'),'counts only, no authoring commands');checks.push('actual validated model catalogue labels versions counts and descriptions');
 assert(!body().includes('Room amount')&&!body().includes('Property-local business date'),'selected model view excludes quote and economics');
 assert(!panel().querySelector('button,input,select,nav,form,a'),'no second navigation or domain controls');checks.push('caller selected view has one result without extra controls or model quote linkage');
 assert([...panel().querySelectorAll('details')].every(n=>!n.open)&&!visibleText(panel()).includes('Model reference:'),'references quiet');checks.push('supporting references begin collapsed');
 await keyboard('.rms-evidence__model summary');
 assert(panel().querySelector('.rms-evidence__model details').open&&body().includes('Returned capabilities:'),'native model capabilities');
 assert(keys.some(key=>key.trusted)&&getComputedStyle(document.activeElement).outlineStyle!=='none','trusted keyboard focus visible');checks.push('trusted native Details expands capabilities with visible focus');
 render({contextLabel:'Synthetic property · Another plan'});assert([...panel().querySelectorAll('details')].every(n=>!n.open),'context replacement resets');checks.push('context change resets native disclosure');
 render({view:'quote'});assert(body().includes('Returned quote: Quoted')&&body().includes('Reason not returned.'),'quoted nullreason retainsstate');
 assert(!panel().querySelector('.rms-evidence__model')&&!body().includes('Room nights'),'no inferred catalogue version relationship');checks.push('quoted nullable reason stays successful and isolated from models');
 for(const [state,reason] of [['blocked','closed'],['unpriced','no-release'],['conflict','ambiguous']]){render({quote:makeQuote({state,reason})});assert(body().includes('Returned quote: '+state[0].toUpperCase()+state.slice(1))&&visibleText(panel()).includes(reason),'state and reason visible '+state);}
 checks.push('blocked unpriced conflict reasons stay prominent without changed semantics');
 render({quote});
 const exact=[['Room amount','9223372036854775807'],['Included allocation','0'],['Package extra','31'],['Promotion discount','-9007199254740993123'],['Pre-tax subtotal','777']];
 exact.forEach(([label,amount])=>assert(value(label)===amount+' INR minor units','exact component '+label));
 assert(panel().querySelectorAll('.rms-evidence__row').length===5&&!body().includes('roomAmountMinor'),'all five human labels, no duplicate subtotal calculation');checks.push('five components preserve huge signed zero and independent subtotal strings');
 render({quote:makeQuote({roomAmountMinor:null,packageExtraMinor:null,preTaxSubtotalMinor:null},{quoteHash:null,taxAssignmentState:null})});
 assert(value('Room amount')==='Not returned'&&value('Included allocation')==='0 INR minor units'&&body().includes('Quote reference: Not returned')&&body().includes('Tax assignment: Not returned'),'zero vsnull');checks.push('missing money hash tax remain distinct from zero');
 render({quote:makeQuote({currency:'XYZ',roomAmountMinor:'9007199254740993'})});assert(value('Room amount')==='9007199254740993 XYZ minor units'&&body().includes('currency precision not supplied'),'unknown precision no guessed decimals');checks.push('unrecognized currency remains exact minor units without assumed precision');
 render({quote});await keyboard('.rms-evidence__supporting summary');assert(panel().querySelector('details').open&&body().includes('synthetic-quote-hash')&&body().includes('no sum, discount or tax calculation'),'quote evidence only');
 render({quote:makeQuote({roomAmountMinor:'1'})});assert(!panel().querySelector('details').open,'fresh evidence value replacement resets');checks.push('hash tax disclosure is evidence only and new values reset it');
 for(const view of ['models','quote','economics']){render({view,evidenceState:'stale',builder,quote,economics});assert(visibleText(panel()).includes('Stale evidence')&&!body().includes('Returned quote: Quoted'),'stale never current '+view);if(view==='quote')assert(body().includes('Previously read quote: Quoted'),'historical quote state');}
 checks.push('all selected stale views are explicitly historical');
 for(const view of ['models','quote','economics']){render({view,evidenceState:'unavailable',unavailableReason:'Scoped read unavailable',builder,quote,economics});assert(body().includes('Evidence unavailable')&&!body().includes('777')&&!body().includes('synthetic-quote-hash')&&!panel().querySelector('dl,.rms-evidence__model'),'unavailable clears supplied values '+view);}
 checks.push('unavailable state cannot expose retained evidence');
 for(const view of ['models','quote','economics']){render({view,evidenceState:'current',builder:null,quote:null,economics:null});assert(body().includes('No ')&&!panel().querySelector('dl'),'absent evidence notzero '+view);}
 checks.push('all absent selected DTOs stay explicit instead of zero');
 const empty=parseStaffRateBuilder({catalogue:[],modelDrafts:[],targetDrafts:[],releases:[]},P,R);render({view:'models',builder:empty});assert(body().includes('No models in the returned catalogue')&&body().includes('No release evidence returned'),'empty catalogue');checks.push('empty catalogue and no release evidence remain visible');
 render({view:'economics',economics});assert(body().includes('Property-local business date 2026-10-03')&&value('Room nights')==='0'&&value('Rooms available')==='0'&&value('Recorded occupancy')==='0 basis points','recorded economics zero');
 assert(value('Room revenue')==='0 INR minor units'&&value('ADR')==='9223372036854775807 INR minor units'&&value('RevPAR')==='-9223372036854775808 INR minor units','economics huge signed strings');checks.push('recorded economics preserves property date zero counts basis points and signed money');
 assert(!visibleText(panel()).toLowerCase().includes('forecast')&&!body().includes('Net profit:')&&!body().includes('commission amount'),'no invented calculations');checks.push('economics has no forecast profit commission ratio or tax metric');
 const hostile='<img src="https://invalid.example/evil" onerror="window.injected=true"><script>window.injected=true</script>';
 const evilBuilder=parseStaffRateBuilder({...builderRaw,catalogue:[{key:hostile,label:hostile,description:hostile,version:1,capabilities:[hostile]}]},P,R);
 render({view:'models',contextLabel:hostile,builder:evilBuilder});assert(body().includes(hostile)&&!panel().querySelector('img,script,a,iframe')&&!window.injected,'hostile modeltext');
 render({view:'quote',quote:makeQuote({reason:hostile},{quoteHash:hostile,taxAssignmentState:hostile})});assert(body().includes(hostile)&&!panel().querySelector('img,script'),'hostile reason evidence');
 checks.push('hostile model context reason tax hash remain inert text');
 window.layoutRequest='narrow';await wait(()=>window.layoutDone==='narrow');await tick();
 assert(innerWidth===375&&panel().scrollWidth<=panel().clientWidth+1&&document.documentElement.scrollWidth<=innerWidth+1,'375px hostile containment');
 assert([...panel().querySelectorAll('summary')].every(n=>n.getBoundingClientRect().height>=44),'44px targets');checks.push('375px hostile evidence wraps with44px native targets');
 render({view:'quote',contextLabel:'Synthetic property · BAR · Room101',quote});window.layoutRequest='ordinary';await wait(()=>window.layoutDone==='ordinary');await tick();
 const summary=panel().querySelector('.rms-evidence__quote-state').getBoundingClientRect();assert(summary.top>=0&&summary.bottom<innerHeight/2,'state before half narrowviewport');
 layout.push({width:innerWidth,height:innerHeight,quoteStateTop:summary.top,quoteStateBottom:summary.bottom});checks.push('ordinary quote state appears early in375px viewport');
 for(const [view,name] of [['models','models-narrow'],['economics','economics-narrow']]){render({view,builder,economics});window.layoutRequest=name;await wait(()=>window.layoutDone===name);await tick();assert(panel().scrollWidth<=panel().clientWidth+1&&document.documentElement.scrollWidth<=innerWidth+1,'all ordinary views narrow '+view);}
 checks.push('ordinary model and economics views also fit375px');
 window.layoutRequest='zoom';await wait(()=>window.layoutDone==='zoom');await tick();for(const view of ['models','quote','economics']){render({view,builder,quote,economics});assert(panel().scrollWidth<=panel().clientWidth+1&&document.documentElement.scrollWidth<=innerWidth+1,'200textzoomcontainment '+view);}
 checks.push('375px doubled text preserves containment');
 assert(JSON.stringify({builder,quote,economics})===before,'validated inputs unchanged');checks.push('render sequence preserves validated inputs without mutation');
 assert(requests.length===0&&writes.length===0,'no effects');flushSync(()=>reactRoot.unmount());checks.push('all renders expansions transitions and unmount perform zero requests or storage');
 const result=document.createElement('pre');result.id='proof';result.textContent=JSON.stringify({passed:true,checks,requests:requests.length,writes:writes.length,keys,layout});document.body.replaceChildren(result);
})().catch(error=>{const failureBody=body();flushSync(()=>reactRoot.unmount());const result=document.createElement('pre');result.id='proof';result.textContent=JSON.stringify({passed:false,error:String(error),checks,body:failureBody.slice(0,1500)});document.body.replaceChildren(result);});
`);
  const built=await Bun.build({entrypoints:[entry],target:'browser',outdir:proof,naming:'[name].[ext]'});
  await writeFile(resolve(proof,'bundle-build.log'),built.logs.join('\n')+`\nsuccess=${built.success}\n`);
  expect(built.success,built.logs.join('\n')).toBe(true);
  const server=Bun.serve({hostname:'127.0.0.1',port:0,fetch(request){const name=new URL(request.url).pathname;
    if(name==='/fixture.js')return new Response(Bun.file(resolve(proof,'fixture.js')),{headers:{'content-type':'application/javascript'}});
    if(name==='/fixture.css')return new Response(Bun.file(resolve(proof,'fixture.css')),{headers:{'content-type':'text/css'}});
    return new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"><style>:root{--ink:#202722;--muted:#56645c;--line:#cfd8d1;--surface-subtle:#f5f7f4;--card:#fff;--focus:#176b45;font:16px system-ui}body{margin:0;padding:12px;box-sizing:border-box}</style><div id="root"></div><script src="/fixture.js"></script>',{headers:{'content-type':'text/html'}});
  }});
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
    await writeFile(resolve(proof,'receipt.json'),JSON.stringify(evidence,null,2));expect(evidence.passed,JSON.stringify(evidence)).toBe(true);expect(evidence.checks).toHaveLength(24);expect(evidence.requests).toBe(0);expect(evidence.writes).toBe(0);
  }finally{await terminateOwnedProcess(child,send?()=>send!('Browser.close'):undefined);socket?.close();server.stop(true);}
},30_000);
