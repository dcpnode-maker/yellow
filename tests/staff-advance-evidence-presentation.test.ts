import { expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createStaffAdvanceEvidenceCard } from '../frontend/yellow/src/workspaces/StaffAdvanceEvidenceCard.mjs';
import { resolveChromiumPath } from './helpers/chromium-path';
import { fetchJsonBounded, terminateOwnedProcess } from './helpers/owned-cdp-proof-lifecycle';

test('unavailable advance evidence hides retained values and declarative actions', () => {
  const Card=createStaffAdvanceEvidenceCard(createElement);
  const deposit={requestId:'request-secret',operationId:'operation-secret',propertyNode:'property',propertyName:'Property',folioId:'folio',folioReference:'F1',amountMinor:'9223372036854775807',currency:'XYZ',generation:1,expiresAt:'2001-01-01T00:00:00Z',state:'captured' as const,capturedMinor:'9223372036854775807',appliedMinor:'0',remainingMinor:'9223372036854775807'};
  const html=renderToString(createElement(Card,{deposit,contextLabel:'<img src=x onerror=bad()>',evidenceState:'unavailable',action:createElement('button',null,'Caller action')}));
  expect(html).toContain('Evidence unavailable');expect(html).not.toContain('9223372036854775807');expect(html).not.toContain('request-secret');expect(html).not.toContain('Caller action');expect(html).not.toContain('<img');
  expect(html).toContain('&lt;img');
  const formattedAmounts={requested:'PRIVATE DISPLAY R',captured:'PRIVATE DISPLAY C',applied:'PRIVATE DISPLAY A',remaining:'PRIVATE DISPLAY M'};
  const hidden=renderToString(createElement(Card,{deposit,formattedAmounts,contextLabel:'Selected request',evidenceState:'unavailable'}));
  expect(hidden).not.toContain('PRIVATE DISPLAY');
  const absent=renderToString(createElement(Card,{deposit:null,formattedAmounts,contextLabel:'Selected request',evidenceState:'current'}));
  expect(absent).toContain('No advance request evidence returned.');expect(absent).not.toContain('PRIVATE DISPLAY');
});

test('mounted advance card preserves actual validated evidence under Yellow theme without effects',async()=>{
  const chrome=resolveChromiumPath();if(!chrome)throw new Error('Owned Chromium required');
  const root=resolve(import.meta.dir,'..'),proof=await mkdtemp(resolve(root,'.advance-evidence-proof-'));
  const entry=resolve(proof,'fixture.tsx');
  const financeSource=await readFile(resolve(root,'frontend/yellow/src/workspaces/FinanceWorkspace.tsx'),'utf8');
  const formatterSource=financeSource.slice(financeSource.indexOf('function moneyExactMinor('),financeSource.indexOf('function CashierGroupIcon('));
  if(!formatterSource.startsWith('function moneyExactMinor('))throw new Error('Exact existing formatter unavailable');
  await writeFile(resolve(proof,'existing-moneyExactMinor.ts'),formatterSource);
  await writeFile(entry,`
import React from 'react';import {createRoot} from 'react-dom/client';import {flushSync} from 'react-dom';
import ${JSON.stringify(resolve(root,'frontend/yellow/src/styles.css'))};
import {StaffAdvanceEvidenceCard as Card} from ${JSON.stringify(resolve(root,'frontend/yellow/src/workspaces/StaffAdvanceEvidenceCard.tsx'))};
import {validDepositStatus} from ${JSON.stringify(resolve(root,'frontend/yellow/src/yellow-api.tsx'))};
// Exact existing helper bytes, extracted into this isolated proof only.
${formatterSource}
const NativeNumberFormat=Intl.NumberFormat;
const formatRecord=(deposit,locale='en-US')=>{
 // Supply the fixture locale as Intl's default without editing helper options.
 Intl.NumberFormat=function(locales,options){return new NativeNumberFormat(locales??locale,options);};
 try{return Object.freeze({requested:moneyExactMinor(deposit.amountMinor,deposit.currency),captured:moneyExactMinor(deposit.capturedMinor,deposit.currency),applied:moneyExactMinor(deposit.appliedMinor,deposit.currency),remaining:moneyExactMinor(deposit.remainingMinor,deposit.currency)});}finally{Intl.NumberFormat=NativeNumberFormat;}
};
const checks=[],requests=[],writes=[],keys=[],layout=[];let callbackCalls=0;
const assert=(ok,message)=>{if(!ok)throw new Error(message);};const tick=()=>new Promise(resolve=>setTimeout(resolve,10));
const wait=async predicate=>{for(let i=0;i<150;i++){if(predicate())return;await tick();}throw new Error('observation timeout');};
window.fetch=(...args)=>{requests.push(args);throw new Error('Unexpected card fetch');};
XMLHttpRequest.prototype.send=function(...args){requests.push(args);throw new Error('Unexpected card XHR');};
for(const method of ['setItem','removeItem','clear'])Storage.prototype[method]=function(...args){writes.push(args);throw new Error('Unexpected card storage');};
document.addEventListener('keydown',event=>keys.push({key:event.key,trusted:event.isTrusted}));
const P='6081b544-22a1-534f-a86d-bb1ae0519e14',F='11111111-1111-4111-8111-111111111111',D='22222222-2222-4222-8222-222222222222',O='33333333-3333-4333-8333-333333333333',T='44444444-4444-4444-8444-444444444444';
const raw=(changes={})=>({tenantId:T,requestId:D,operationId:O,propertyNode:P,propertyName:'Synthetic property',folioId:F,folioReference:'F-001',amountMinor:'9223372036854775807',currency:'XYZ',generation:3,expiresAt:'2001-01-01T00:00:00Z',state:'captured',capturedMinor:'9223372036854775807',appliedMinor:'9223372036854775800',remainingMinor:'7',...changes});
const validate=value=>{assert(validDepositStatus(value),'actual validator rejected fixture');return Object.freeze(value);};
const captured=validate(raw());
const states=['ready','processing','captured','declined','expired','revoked'];
const records=states.map(state=>validate(raw(state==='captured'?{state}:{state,capturedMinor:'0',appliedMinor:'0',remainingMinor:'0'})));
const unchanged=JSON.stringify(records);
const action=<button type="button" disabled aria-label="Caller-owned disabled action" onClick={()=>callbackCalls++}>Caller-owned action</button>;
let props={deposit:captured,contextLabel:'Synthetic property · RES-001 · Window1',evidenceState:'current',action:undefined};
const reactRoot=createRoot(document.getElementById('root'));
const render=change=>{props={...props,...change};flushSync(()=>reactRoot.render(<Card {...props}/>));};
const card=()=>document.querySelector('.advance-evidence'),text=()=>card()?.textContent||'';
const value=label=>[...card().querySelectorAll('.advance-evidence__row')].find(row=>row.querySelector('dt').textContent===label)?.querySelector('dd').textContent;
let sequence=0;const keyboard=async()=>{card().querySelector('summary').focus();const next=++sequence;window.keyRequest={sequence:next};await wait(()=>window.keyDone===next);await tick();};
const changeLayout=async name=>{window.layoutRequest=name;await wait(()=>window.layoutDone===name);await tick();};
const geometry=label=>{
 const list=card().querySelector('dl'),listBox=list.getBoundingClientRect(),rows=[...list.children];let lastBottom=-Infinity;
 assert(rows.length===4,'four independent rows');
 const boxes=rows.map(row=>{const box=row.getBoundingClientRect(),dt=row.querySelector('dt').getBoundingClientRect(),dd=row.querySelector('dd').getBoundingClientRect();
  assert(Math.abs(box.width-listBox.width)<=1,'full-width logical row '+label);
  assert(box.top>=lastBottom-1,'monotonic nonoverlapping rows '+label);lastBottom=box.bottom;
  assert(dd.left>=box.left-1&&dd.right<=box.right+1&&dd.top>=box.top-1&&dd.bottom<=box.bottom+1,'value field contained '+label);
  if(card().getBoundingClientRect().width<600){assert(Math.abs(dd.width-box.width)<=1,'full-width narrow-card value '+label);assert(dd.top>=dt.bottom-1,'stacked readable label/value '+label);}
  else assert(dd.left>=dt.right-1,'desktop separate label/value '+label);
  assert(row.scrollWidth<=row.clientWidth+1,'row text wraps '+label);return {rowWidth:box.width,valueWidth:dd.width,rowTop:box.top,rowBottom:box.bottom};});
 assert(card().scrollWidth<=card().clientWidth+1&&document.documentElement.scrollWidth<=innerWidth+1,'whole-list/card/page containment '+label);
 const result={label,viewport:innerWidth,listWidth:listBox.width,columns:getComputedStyle(list).gridTemplateColumns,rows:boxes};layout.push(result);
};
(async()=>{
 for(const deposit of records){render({deposit,action:undefined});assert(text().includes('Returned request state: '+deposit.state[0].toUpperCase()+deposit.state.slice(1)),'six returned request states');assert(!card().querySelector('button,input,a'),'no own controls');}
 checks.push('all six actual-validated request states without invented controls');
 render({deposit:records[0]});assert(text().includes('Returned request state: Ready')&&!text().includes('Returned request state: Expired'),'recorded past expiry does not infer state');checks.push('recorded expiry does not infer client-clock expiration or room readiness');
 render({deposit:captured});assert(value('Requested')==='9223372036854775807 XYZ minor units'&&value('Captured')==='9223372036854775807 XYZ minor units'&&value('Applied to folio')==='9223372036854775800 XYZ minor units'&&value('Remaining captured liability')==='7 XYZ minor units','separate exact values');assert(!text().includes('Partially applied'),'no invented state');checks.push('huge requested captured applied remaining remain separate exact strings');
 assert(text().includes('currency precision not supplied'),'unknown currency evidence');checks.push('unknown currency preserves minor units without guessed decimals');
 for(const bad of [raw({amountMinor:'-1'}),raw({amountMinor:'+1'}),raw({amountMinor:'01'}),raw({appliedMinor:'-0'}),raw({remainingMinor:'8'}),raw({state:'partially_applied'})])assert(!validDepositStatus(bad),'actual validator excludes noncanonical signed or inconsistent fixture');checks.push('actual validator rejects signed noncanonical inconsistent amounts and invented states');
 const zero=validate(raw({amountMinor:'0',capturedMinor:'0',appliedMinor:'0',remainingMinor:'0'}));render({deposit:zero});assert(value('Requested')==='0 XYZ minor units'&&value('Remaining captured liability')==='0 XYZ minor units','zero preserved');checks.push('validated zero amounts remain evidence');
 render({deposit:null});assert(text().includes('No advance request evidence returned.')&&!card().querySelector('dl,details'),'null evidence is not zero');render({deposit:undefined});assert(text().includes('No advance request evidence returned.'),'undefined evidence');checks.push('null and undefined records are explicit absence rather than zero');
 render({deposit:captured});assert(!card().querySelector('details').open&&!card().querySelector('button'),'details start collapsed');checks.push('technical references initially collapsed');
 await keyboard();assert(card().querySelector('details').open&&keys.some(key=>key.trusted)&&getComputedStyle(document.activeElement).outlineStyle!=='none','trusted native focus');assert(text().includes('Recorded expiry: 2001-01-01T00:00:00Z')&&text().includes('Generation: 3'),'exact metadata');checks.push('trusted native keyboard disclosure and visible focus show exact generation expiry');
 render({contextLabel:'Synthetic property · RES-002 · Window1'});assert(!card().querySelector('details').open,'context reset');checks.push('context changes reset native disclosure');
 await keyboard();render({deposit:validate(raw({generation:4}))});assert(!card().querySelector('details').open,'record reset');checks.push('changed record generation resets native disclosure');
 render({deposit:captured,action});assert(card().querySelector('button').disabled&&card().querySelector('button').getAttribute('aria-label')==='Caller-owned disabled action'&&callbackCalls===0,'slot unchanged');checks.push('declarative caller action preserves its disabled accessible state without invoking callback');
 for(const deposit of records){render({deposit,evidenceState:'stale',action});assert(text().includes('Stale evidence')&&text().includes('Previously read request state')&&!text().includes('Returned request state'),'historical state');assert(card().querySelector('button').disabled,'caller retains disabled authority');}
 checks.push('all six stale states are historical while caller action stays caller-owned');
 for(const deposit of records){render({deposit,evidenceState:'unavailable',unavailableReason:'Read denied',action});assert(text().includes('Read denied')&&!text().includes('9223372036854775807')&&!card().querySelector('dl,details,button'),'unavailable hides values and slot');}checks.push('all six unavailable states hide retained record references and action');
 const hostile=validate(raw({propertyName:'<img src=x onerror=window.hostile=1>',folioReference:'<script>window.hostile=2</script>'}));render({deposit:hostile,contextLabel:'<svg onload=window.hostile=3>Literal context',evidenceState:'current',action:undefined});assert(text().includes('<svg')&&text().includes('<img')&&text().includes('<script')&&!card().querySelector('img,script,svg')&&!window.hostile,'hostile inert');checks.push('validated hostile labels and caller context stay escaped text');
 render({deposit:captured,contextLabel:'Synthetic property · RES-001 · Window1'});await changeLayout('desktop');assert(card().getBoundingClientRect().width>800,'meaningful desktop content width');geometry('desktop');checks.push('actual Yellow desktop theme keeps full rows with internal label/value columns');
 const host=document.getElementById('root');host.style.maxWidth='360px';await tick();geometry('narrow-card-desktop');host.style.maxWidth='';await tick();checks.push('card width rather than desktop viewport selects readable stacked values');
 await changeLayout('narrow');for(const deposit of records){render({deposit});geometry('375-'+deposit.state);}checks.push('all six states keep full-width readable rows under actual375px theme');
 render({deposit:captured});await changeLayout('zoom');for(const deposit of records){render({deposit});geometry('375-200text-'+deposit.state);}checks.push('all six states keep stacked values and containment at375px doubled text');
 const theme=document.createElement('link');theme.rel='stylesheet';theme.href='/theme.css';document.head.appendChild(theme);await new Promise((resolve,reject)=>{theme.onload=resolve;theme.onerror=()=>reject(new Error('late theme load failed'));});await tick();render({deposit:captured});geometry('late-theme375-200text');checks.push('scoped metric specificity survives actual theme loaded after component CSS');
 render({deposit:hostile,contextLabel:'Hostile'.repeat(30)});geometry('hostile375-200text');assert(card().querySelector('summary').getBoundingClientRect().height>=44,'native target');checks.push('hostile text wraps with44px native disclosure target');
 flushSync(()=>reactRoot.render(<><Card deposit={captured} contextLabel="Request A" evidenceState="current"/><Card deposit={validate(raw({requestId:F,generation:8}))} contextLabel="Request B" evidenceState="current"/></>));assert(document.querySelectorAll('.advance-evidence').length===2&&document.querySelectorAll('dl').length===2,'one record per independent card');checks.push('multiple cards preserve separate request context and evidence');
 const matchFormatted=display=>{assert(value('Requested')===display.requested&&value('Captured')===display.captured&&value('Applied to folio')===display.applied&&value('Remaining captured liability')===display.remaining,'exact existing helper strings');};
 const currencies=['INR','JPY','KWD'],locales=['en-US','de-DE','ar-EG'];
 for(const currency of currencies)for(const locale of locales){const deposit=validate(raw({currency})),display=formatRecord(deposit,locale);render({deposit,formattedAmounts:display,contextLabel:'Selected request',evidenceState:'current',action:undefined});matchFormatted(display);const zeroRecord=validate(raw({currency,amountMinor:'0',capturedMinor:'0',appliedMinor:'0',remainingMinor:'0'}));const zeros=formatRecord(zeroRecord,locale);render({deposit:zeroRecord,formattedAmounts:zeros});matchFormatted(zeros);}
 checks.push('exact unchanged helper outputs preserve huge zero and differing INR JPY KWD precision in three locales');
 const formattedDeposit=validate(raw({currency:'INR'})),formatted=formatRecord(formattedDeposit,'de-DE');render({deposit:formattedDeposit,formattedAmounts:formatted});
 assert(text().includes('Currency: INR')&&!text().includes('currency precision not supplied')&&!card().querySelector('details').open,'formatted caption and collapsed raw evidence');
 assert(![...card().querySelectorAll('dd')].some(node=>node.textContent.includes('minor units')),'display rows are formatter output only');checks.push('formatted mode removes misleading precision note and keeps raw evidence collapsed');
 await keyboard();const rawEvidence=card().querySelector('.advance-evidence__raw').textContent;
 assert(rawEvidence.includes('Exact currency: INR')&&rawEvidence.includes('Requested evidence: 9223372036854775807 INR minor units')&&rawEvidence.includes('Captured evidence: 9223372036854775807 INR minor units')&&rawEvidence.includes('Applied evidence: 9223372036854775800 INR minor units')&&rawEvidence.includes('Remaining evidence: 7 INR minor units'),'exact collapsed evidence');checks.push('native formatted disclosure preserves exact currency and all four raw strings');
 const displayOnly={...formatted,requested:formatted.requested+' '};render({formattedAmounts:displayOnly});assert(!card().querySelector('details').open,'display-only reset');matchFormatted(displayOnly);checks.push('display-only string changes reset native disclosure');
 const literal={requested:'−\\u00a0₹\\u00a012\\u202f345,67',captured:'\\u200f٠٫٠٠\\u00a0د.ك.\\u200f',applied:'<script>window.formattedHostile=1</script>',remaining:''};render({formattedAmounts:literal});matchFormatted(literal);assert(!card().querySelector('script,svg,img')&&!window.formattedHostile,'formatted escaped');checks.push('declarative Unicode signs separators bidi spacing empty strings and hostile text are preserved inertly');
 render({formattedAmounts:{requested:'INCOMPLETE'}});assert(value('Requested')==='9223372036854775807 INR minor units'&&text().includes('currency precision not supplied'),'incomplete display not mixed');checks.push('incomplete runtime display falls back to complete raw mode without blank mixed rows');
 for(const evidenceState of ['unavailable','current']){render({deposit:evidenceState==='current'?null:formattedDeposit,formattedAmounts:literal,evidenceState,action});assert(!card().querySelector('dl,details,button')&&!text().includes('window.formattedHostile')&&!text().includes(literal.requested),'suppress formatting');}
 render({deposit:undefined,evidenceState:'current'});assert(text().includes('No advance request evidence returned.')&&!card().querySelector('dl'),'undefined suppress');checks.push('formatted unavailable null and undefined suppress all display raw references and action');
 const formattedRecords=records.map(record=>validate({...record,currency:'INR'}));
 for(const deposit of formattedRecords){const display=formatRecord(deposit,'ar-EG');render({deposit,formattedAmounts:display,evidenceState:'stale',action});matchFormatted(display);assert(text().includes('Previously read request state')&&text().includes('Stale evidence')&&card().querySelector('button').disabled,'formatted historical ownership');}checks.push('all six formatted stale states remain historical and retain caller-disabled action');
 render({deposit:formattedDeposit,formattedAmounts:formatted,evidenceState:'current',action:undefined});await changeLayout('formatted-desktop');geometry('formatted-desktop');checks.push('existing formatter display has full readable desktop rows under actual theme');
 await changeLayout('formatted-narrow');for(const deposit of formattedRecords){const display=formatRecord(deposit,'ar-EG');render({deposit,formattedAmounts:display});matchFormatted(display);geometry('formatted375-'+deposit.state);}checks.push('all six helper-formatted states preserve exact display and full-width375px geometry');
 render({deposit:formattedDeposit,formattedAmounts:formatted});await changeLayout('formatted-zoom');for(const deposit of formattedRecords){const display=formatRecord(deposit,'de-DE');render({deposit,formattedAmounts:display});matchFormatted(display);geometry('formatted375-200text-'+deposit.state);}checks.push('all six helper-formatted states preserve doubled-text full-row geometry after late theme');
 Intl.NumberFormat=function(){throw new Error('Card must not format money');};try{render({deposit:formattedDeposit,formattedAmounts:formatted,evidenceState:'current'});matchFormatted(formatted);}finally{Intl.NumberFormat=NativeNumberFormat;}checks.push('card never invokes Intl formatter or caller formatting callback');
 assert(JSON.stringify(records)===unchanged&&callbackCalls===0&&requests.length===0&&writes.length===0,'inputs/effects unchanged');flushSync(()=>reactRoot.unmount());checks.push('renders transitions native disclosures and unmount preserve inputs with zero requests storage or callbacks');
 const result=document.createElement('pre');result.id='proof';result.textContent=JSON.stringify({passed:true,checks,requests:requests.length,writes:writes.length,callbackCalls,keys,layout});document.body.replaceChildren(result);
})().catch(error=>{const failure=text();const result=document.createElement('pre');result.id='proof';result.textContent=JSON.stringify({passed:false,error:String(error),checks,body:failure.slice(0,2000)});document.body.replaceChildren(result);});
`);
  const built=await Bun.build({entrypoints:[entry],target:'browser',outdir:proof,naming:'[name].[ext]'});
  await writeFile(resolve(proof,'bundle-build.log'),built.logs.join('\n')+`\nsuccess=${built.success}\n`);expect(built.success,built.logs.join('\n')).toBe(true);
  const server=Bun.serve({hostname:'127.0.0.1',port:0,fetch(request){const name=new URL(request.url).pathname;
    if(name==='/fixture.js')return new Response(Bun.file(resolve(proof,'fixture.js')),{headers:{'content-type':'application/javascript'}});
    if(name==='/fixture.css')return new Response(Bun.file(resolve(proof,'fixture.css')),{headers:{'content-type':'text/css'}});
    if(name==='/theme.css')return new Response(Bun.file(resolve(root,'frontend/yellow/src/styles.css')),{headers:{'content-type':'text/css'}});
    return new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"><div class="yellow-next"><article class="detail-card" id="root"></article></div><script src="/fixture.js"></script>',{headers:{'content-type':'text/html'}});
  }});
  let socket:WebSocket|undefined;let send:((method:string,params?:Record<string,unknown>)=>Promise<any>)|undefined;
  const child=Bun.spawn([chrome,'--headless=new','--no-first-run','--no-default-browser-check','--disable-gpu','--disable-background-networking',`--user-data-dir=${resolve(proof,'profile')}`,'--remote-debugging-port=0','about:blank'],{cwd:root,stdin:'ignore',stdout:'ignore',stderr:'ignore'});
  let evidence:any;const diagnostics:unknown[]=[];const expires=Date.now()+20_000;
  try{
    let port:string|undefined;while(!port&&Date.now()<expires){try{port=(await readFile(resolve(proof,'profile/DevToolsActivePort'),'utf8')).split('\n')[0];}catch{await Bun.sleep(25);}}
    if(!port)throw new Error('Owned debugger not ready');
    const targets=await fetchJsonBounded<Array<{type:string;url:string;webSocketDebuggerUrl?:string}>>(`http://127.0.0.1:${port}/json/list`);const target=targets.find(target=>target.type==='page'&&target.url==='about:blank');if(!target?.webSocketDebuggerUrl)throw new Error('Owned target unavailable');
    socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('CDP open deadline')),5_000);socket!.onopen=()=>{clearTimeout(timer);resolve();};socket!.onerror=()=>{clearTimeout(timer);reject(new Error('CDP open failed'));};});
    let id=0;const pending=new Map<number,{resolve:(value:any)=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>}>();
    socket.onmessage=event=>{const response=JSON.parse(String(event.data));if(response.method==='Runtime.exceptionThrown')diagnostics.push(response.params);const request=pending.get(response.id);if(!request)return;pending.delete(response.id);clearTimeout(request.timer);response.error?request.reject(new Error(JSON.stringify(response.error))):request.resolve(response.result);};
    send=(method,params={})=>new Promise((resolve,reject)=>{const requestId=++id;const timer=setTimeout(()=>{pending.delete(requestId);reject(new Error('CDP deadline '+method));},5_000);pending.set(requestId,{resolve,reject,timer});socket!.send(JSON.stringify({id:requestId,method,params}));});
    await send('Runtime.enable');await send('Emulation.setDeviceMetricsOverride',{width:1200,height:900,deviceScaleFactor:1,mobile:false});await send('Page.navigate',{url:`http://127.0.0.1:${server.port}/`});await send('Page.bringToFront');await send('Emulation.setFocusEmulationEnabled',{enabled:true});
    let handled=0;const layouts=new Set<string>();
    while(Date.now()<expires){const state=await send('Runtime.evaluate',{expression:'JSON.stringify({proof:document.getElementById("proof")?.textContent,key:window.keyRequest,layout:window.layoutRequest})',returnByValue:true});const observation=JSON.parse(state.result.value);
      if(observation.proof){evidence=JSON.parse(observation.proof);break;}
      if(observation.key?.sequence>handled){const sequence=observation.key.sequence;await send('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space',windowsVirtualKeyCode:32,text:' '});await send('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32});await send('Runtime.evaluate',{expression:`window.keyDone=${sequence}`});handled=sequence;}
      if(observation.layout&&!layouts.has(observation.layout)){
        if(observation.layout==='formatted-desktop'){await send('Runtime.evaluate',{expression:'document.documentElement.style.fontSize="16px"'});await send('Emulation.setDeviceMetricsOverride',{width:1200,height:900,deviceScaleFactor:1,mobile:false});}
        if(observation.layout==='narrow'||observation.layout==='formatted-narrow')await send('Emulation.setDeviceMetricsOverride',{width:375,height:900,deviceScaleFactor:1,mobile:false});
        if(observation.layout==='zoom'||observation.layout==='formatted-zoom')await send('Runtime.evaluate',{expression:'document.documentElement.style.fontSize="32px"'});
        const snapshot=await send('Page.captureScreenshot',{format:'png'});await writeFile(resolve(proof,observation.layout+'.png'),Buffer.from(snapshot.data,'base64'));
        await send('Runtime.evaluate',{expression:`window.layoutDone=${JSON.stringify(observation.layout)}`});layouts.add(observation.layout);
      }
      await Bun.sleep(20);
    }
    if(!evidence){diagnostics.push(await send('Runtime.evaluate',{expression:'document.documentElement.outerHTML',returnByValue:true}));await writeFile(resolve(proof,'failure.json'),JSON.stringify(diagnostics,null,2));throw new Error('Advance proof exceeded20seconds');}
    await writeFile(resolve(proof,'receipt.json'),JSON.stringify(evidence,null,2));expect(evidence.passed,JSON.stringify(evidence)).toBe(true);expect(evidence.checks).toHaveLength(35);expect(evidence.requests).toBe(0);expect(evidence.writes).toBe(0);expect(evidence.callbackCalls).toBe(0);
  }finally{await terminateOwnedProcess(child,send?()=>send!('Browser.close'):undefined);socket?.close();server.stop(true);}
},30_000);
