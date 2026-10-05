import { expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createStaffGroupBlockEvidenceCard, type StaffGroupBlockEvidence } from '../frontend/yellow/src/workspaces/StaffGroupBlockEvidenceCard.mjs';
import { resolveChromiumPath } from './helpers/chromium-path';
import { fetchJsonBounded, terminateOwnedProcess } from './helpers/owned-cdp-proof-lifecycle';
const sample: StaffGroupBlockEvidence = {
 groupId:'11111111-1111-4111-8111-111111111111',code:'G-001',name:'Synthetic conference',status:'definite',
 statusDeductsInventory:true,accountPartyId:null,accountPartyName:null,cutoffDate:'2026-10-05',elastic:false,
 washSchedule:{opaque:'UNINTERPRETED_WASH'},masterFolioId:'22222222-2222-4222-8222-222222222222',masterFolioNo:'MF-001',masterFolioStatus:'open',
 arrivalDate:'2026-10-02',departureDate:'2026-10-05',blockedRooms:72,pickedUpRooms:21,remainingRooms:51,pickupPercent:29,cutoffState:'future',
 allotment:[{unitTypeId:'33333333-3333-4333-8333-333333333333',unitTypeCode:'DLX',unitTypeName:'Deluxe',stayDate:'2026-10-02',blocked:24,pickedUp:7,remaining:17,rateOverride:{opaque:'UNINTERPRETED_RATE'}}],
 roomingList:[{reservationId:'44444444-4444-4444-8444-444444444444',confirmationNo:'R-001',primaryGuestDisplayName:'Synthetic guest',status:'due_in',unitTypeCode:'DLX',unitTypeName:'Deluxe',stayFrom:'2026-10-02T15:00:00.000000Z',stayTo:'2026-10-05T11:00:00.000000Z',pickedUpNights:3}],
};
test('unavailable and absent evidence suppress retained records and parent links',()=>{
 const Card=createStaffGroupBlockEvidenceCard(createElement);
 const links={ [sample.roomingList[0]!.reservationId]:createElement('a',{href:'/parent-only'},'PRIVATE LINK') };
 const html=renderToString(createElement(Card,{group:sample,contextLabel:'<img src=x onerror=bad()>',evidenceState:'unavailable',reservationLinks:links,masterFolioLink:createElement('a',{href:'/folio-parent'},'PRIVATE FOLIO')}));
 expect(html).toContain('Evidence unavailable');expect(html).toContain('&lt;img');expect(html).not.toContain('<img');
 for(const secret of ['Synthetic guest','MF-001','G-001','PRIVATE LINK','PRIVATE FOLIO','<details','<table'])expect(html).not.toContain(secret);
 const absent=renderToString(createElement(Card,{group:null,contextLabel:'Property',evidenceState:'current',reservationLinks:links}));
 expect(absent).toContain('No group block evidence returned.');expect(absent).not.toContain('PRIVATE LINK');
});
test('mounted block evidence under original Yellow theme has complete detail and no effects',async()=>{
 const chrome=resolveChromiumPath();if(!chrome)throw new Error('Owned Chromium required');
 const root=resolve(import.meta.dir,'..'),proof=await mkdtemp(resolve(root,'.group-block-evidence-proof-')),entry=resolve(proof,'fixture.tsx');
 await writeFile(entry,'const base='+JSON.stringify(sample)+';\n'+ `
import React from 'react';import {createRoot} from 'react-dom/client';import {flushSync} from 'react-dom';
import '../frontend/yellow/src/styles.css';
import {StaffGroupBlockEvidenceCard as Card} from '../frontend/yellow/src/workspaces/StaffGroupBlockEvidenceCard.tsx';
const checks=[],requests=[],writes=[],keys=[],layout=[];let callbackCalls=0;
const assert=(ok,label)=>{if(!ok)throw new Error(label);};
const tick=()=>new Promise(resolve=>setTimeout(resolve,10));
const wait=async predicate=>{for(let n=0;n<300;n++){if(predicate())return;await tick();}throw new Error('observation deadline');};
window.fetch=(...args)=>{requests.push(args);throw new Error('Unexpected fetch');};
XMLHttpRequest.prototype.send=function(...args){requests.push(args);throw new Error('Unexpected XHR');};
for(const method of ['setItem','removeItem','clear'])Storage.prototype[method]=function(...args){writes.push(args);throw new Error('Unexpected storage');};
document.addEventListener('keydown',event=>keys.push({key:event.key,trusted:event.isTrusted}));
const freeze=value=>{if(value&&typeof value==='object'){Object.freeze(value);Object.values(value).forEach(freeze);}return value;};freeze(base);
const initial=JSON.stringify(base);
const links=Object.freeze({[base.roomingList[0].reservationId]:<a href="/parent-supplied/encoded%20stay?scope=P#native" aria-label="Parent reservation destination" onClick={()=>callbackCalls++}>Parent reservation link</a>});
const master=<a href="/parent-supplied/master?window=2" aria-label="Parent folio destination" onClick={()=>callbackCalls++}>Parent folio link</a>;
let props={group:base,contextLabel:'Synthetic property · Existing block',evidenceState:'current',reservationLinks:links,masterFolioLink:master};
const root=createRoot(document.getElementById('root'));
const render=change=>{props={...props,...change};flushSync(()=>root.render(<Card {...props}/>));};
const card=()=>document.querySelector('.group-evidence'),text=()=>card()?.textContent||'';
const details=()=>[...card().querySelectorAll('details')];
const metric=label=>[...card().querySelectorAll('.group-evidence__row')].find(row=>row.querySelector('dt').textContent===label)?.querySelector('dd').textContent;
let seq=0;
const keyboard=async(key=' ',code='Space')=>{const sequence=++seq;window.keyRequest={sequence,key,code};await wait(()=>window.keyDone===sequence);await tick();};
const open=async index=>{const node=details()[index];node.querySelector('summary').focus();await keyboard();assert(node.open,'native Space opens disclosure');};
const changeLayout=async label=>{window.layoutRequest=label;await wait(()=>window.layoutDone===label);await tick();};
const geometry=label=>{
 const c=card().getBoundingClientRect(),list=card().querySelector('dl').getBoundingClientRect(),rows=[...card().querySelectorAll('.group-evidence__row')].map(row=>({width:row.getBoundingClientRect().width,value:row.querySelector('dd').getBoundingClientRect().width})),cells=[...card().querySelectorAll('details[open] td')].map(node=>({width:node.getBoundingClientRect().width,scroll:node.scrollWidth,client:node.clientWidth}));
 assert(document.documentElement.scrollWidth<=innerWidth+1,'page overflow '+label);assert(c.width>240&&list.width>=c.width-2,'summary list full width '+label);
 assert(rows.every(row=>row.width>=list.width-2&&row.value>80),'readable metric rows '+label);
 if(c.width<600){assert(rows.every(row=>row.value>=list.width-2),'narrow metric values full width '+label);assert(cells.every(cell=>cell.width>=c.width-2),'narrow table cells full width '+label);}
 assert(cells.every(cell=>cell.scroll<=cell.client+1),'table cell overflow '+label);
 layout.push({label,viewport:innerWidth,cardWidth:c.width,listWidth:list.width,rows,cells,rootFont:getComputedStyle(document.documentElement).fontSize});
};
(async()=>{
 render({});assert(details().length===3&&details().every(node=>!node.open),'initial collapsed');checks.push('three native disclosures initially collapsed');
 assert(metric('Blocked room nights')==='72'&&metric('Picked-up room nights')==='21'&&metric('Remaining room nights')==='51'&&metric('Returned pickup')==='29%','exact room-night aggregates');
 assert(base.roomingList.length===1&&metric('Picked-up room nights')!=='1','room nights distinct');checks.push('room-night totals differ from reservation count and retain returned ratio');
 assert(card().querySelector('[aria-label="Parent folio destination"]').getAttribute('href')==='/parent-supplied/master?window=2','folio literal');checks.push('parent master-folio declarative destination preserved');
 await open(0);await open(1);await open(2);
 assert(card().querySelectorAll('table').length===2&&card().querySelectorAll('th:not([scope="row"])').length===0,'semantic row labels');
 const stay=card().querySelectorAll('table')[1];assert(stay.textContent.includes(base.roomingList[0].stayFrom)&&stay.textContent.includes(base.roomingList[0].stayTo),'timestamps unchanged');
 assert(card().querySelector('[aria-label="Parent reservation destination"]').getAttribute('href')==='/parent-supplied/encoded%20stay?scope=P#native','reservation literal');checks.push('native Space opens complete semantic tables with exact instants and supplied reservation link');
 const summary=details()[2].querySelector('summary');assert(getComputedStyle(summary).outlineStyle!=='none'&&summary.getBoundingClientRect().height>=44,'visible summary focus and target');checks.push('native keyboard summary exposes visible focus and44px target');
 assert(!text().includes('UNINTERPRETED_WASH')&&!text().includes('UNINTERPRETED_RATE')&&text().includes('Present · contents not interpreted'),'opaque unparsed');checks.push('opaque schedule and rate override presence remain uninterpreted');
 await keyboard();assert(!details()[2].open,'Space closes references');
 details()[0].querySelector('summary').focus();await keyboard();assert(!details()[0].open,'Space closes first');
 await keyboard('Tab','Tab');assert(document.activeElement===details()[1].querySelector('summary'),'Tab next summary');checks.push('trusted Space toggles and native Tab follows summary order');
 render({contextLabel:'Other property context'});assert(details().every(node=>!node.open),'context reset');checks.push('context change resets disclosures');
 await open(0);render({evidenceState:'stale'});assert(details().every(node=>!node.open)&&text().includes('historical')&&text().includes('Previously read block status'),'freshness reset');checks.push('stale is historical and freshness change resets disclosures');
 await open(0);render({group:{...base,status:'tentative',statusDeductsInventory:false}});assert(details().every(node=>!node.open)&&text().includes('does not deduct inventory'),'record reset');checks.push('changed record resets and preserves non-deducting status');
 render({group:base,evidenceState:'current',reservationLinks:undefined,masterFolioLink:undefined});await open(1);assert(card().querySelectorAll('a').length===0&&text().includes(base.roomingList[0].reservationId)&&metric('Master folio')==='MF-001','reference text');checks.push('missing parent links leave references as text with zero constructed routes');
 const inherited=Object.create({[base.roomingList[0].reservationId]:<a href="/inherited">BAD INHERITED</a>});render({reservationLinks:inherited});assert(!text().includes('BAD INHERITED')&&!card().querySelector('a'),'no inherited slot');checks.push('inherited link entries cannot impersonate supplied own destinations');
 const split=freeze({...base,roomingList:[
  {...base.roomingList[0],unitTypeCode:'DLX',unitTypeName:'Deluxe',stayFrom:'2026-10-02T15:00:00.000000Z',stayTo:'2026-10-03T11:00:00.000000Z',pickedUpNights:1},
  {...base.roomingList[0],unitTypeCode:'STD',unitTypeName:'Standard',stayFrom:'2026-10-03T15:00:00.000000Z',stayTo:'2026-10-05T11:00:00.000000Z',pickedUpNights:2},
 ]});
 const splitBefore=JSON.stringify(split);render({group:split,reservationLinks:links});await open(1);
 const splitDetails=details()[1],splitTables=[...splitDetails.querySelectorAll('table')],splitLinks=[...splitDetails.querySelectorAll('a')];
 assert(splitDetails.querySelector('summary').textContent==='Rooming details (2 rows)','split rooming count must describe rows');
 assert(splitTables.length===2&&splitTables[0].querySelector('caption').textContent==='Rooming row 1 · Synthetic guest'&&splitTables[1].querySelector('caption').textContent==='Rooming row 2 · Synthetic guest','split row captions preserve supplied order');
 assert(splitTables[0].textContent.includes('DLX · Deluxe')&&splitTables[1].textContent.includes('STD · Standard')&&splitTables[0].textContent.includes('2026-10-03T11:00:00.000000Z')&&splitTables[1].textContent.includes('2026-10-03T15:00:00.000000Z'),'both split room types periods and pickup facts preserved');
 assert(splitLinks.length===2&&splitLinks.every(node=>node.getAttribute('href')==='/parent-supplied/encoded%20stay?scope=P#native'),'same parent destination identity on both supplied rows');
 assert(!splitDetails.textContent.includes('2 reservations')&&!splitDetails.textContent.includes('Reservation 2')&&JSON.stringify(split)===splitBefore&&callbackCalls===0,'no false unique count deduplication mutation or link invocation');
 checks.push('same reservation split across two room types retains two rooming rows and one supplied destination identity without unique reservation count');

 for(const cutoffState of ['future','due_today','past_due','not_set']){render({group:{...base,cutoffState}});assert(metric('Cutoff')==='2026-10-05 · '+cutoffState,'cutoff exact');}checks.push('four cutoff classifications retained without release inference');
 const overpickup=freeze({...base,blockedRooms:10,pickedUpRooms:12,remainingRooms:0,pickupPercent:120});render({group:overpickup});assert(metric('Blocked room nights')==='10'&&metric('Picked-up room nights')==='12'&&metric('Remaining room nights')==='0'&&metric('Returned pickup')==='120%','overpickup not capped');checks.push('returned pickup above100 percent and zero remaining preserve overpickup evidence');
 const zero=freeze({...base,name:null,status:'cancelled',statusDeductsInventory:false,accountPartyId:null,accountPartyName:null,masterFolioId:null,masterFolioNo:null,masterFolioStatus:null,arrivalDate:null,departureDate:null,cutoffDate:null,cutoffState:'not_set',elastic:false,washSchedule:null,blockedRooms:0,pickedUpRooms:0,remainingRooms:0,pickupPercent:0,allotment:[],roomingList:[]});
 render({group:zero,reservationLinks:links,masterFolioLink:master});assert(metric('Blocked room nights')==='0'&&metric('Picked-up room nights')==='0'&&metric('Returned pickup')==='0%'&&text().includes('Name not returned')&&text().includes('cancelled'),'zero distinct');
 assert(metric('Account')==='Account name not returned'&&metric('Master folio')==='Folio number not returned'&&text().includes('Arrival date not returned')&&text().includes('Cutoff date not returned')&&!card().querySelector('a'),'null facts');
 await open(0);await open(1);assert(text().includes('No allotment rows returned.')&&text().includes('No rooming rows returned.'),'empty rows');checks.push('zero cancelled non-deducting block retains null and empty states distinct from absent record');
 const mixed=freeze({...base,roomingList:[{...base.roomingList[0],status:'cancelled',unitTypeCode:null,unitTypeName:null,pickedUpNights:0}],allotment:[{...base.allotment[0],rateOverride:null}],washSchedule:null});render({group:mixed});await open(0);await open(1);
 assert(text().includes('cancelled')&&text().includes('Code not returned · Name not returned')&&!text().includes('Present · contents not interpreted'),'null row facts');checks.push('cancelled null room type and absent opaque values imply no eligibility');
 const hostile=freeze({...base,code:'<img src=x onerror=window.hostile=1>',name:'<script>window.hostile=1</script>',accountPartyName:'<svg onload=window.hostile=1>',roomingList:[{...base.roomingList[0],primaryGuestDisplayName:'<b>HOSTILE</b>'}]});render({group:hostile,contextLabel:'<iframe src=bad>'});await open(1);
 assert(text().includes(hostile.code)&&text().includes('<b>HOSTILE</b>')&&!card().querySelector('img,svg,script,iframe,b')&&!window.hostile,'escaped');checks.push('hostile group guest account context remain inert text');
 const large=freeze({...base,allotment:Array.from({length:40},(_,i)=>({...base.allotment[0],unitTypeCode:'TYPE-'+i,unitTypeName:'Room type '+i,stayDate:'2026-10-'+String(2+i%3).padStart(2,'0')})),roomingList:Array.from({length:30},(_,i)=>({...base.roomingList[0],reservationId:'50000000-0000-4000-8000-'+String(i).padStart(12,'0'),confirmationNo:'CONF-'+i,primaryGuestDisplayName:'Guest '+i,stayFrom:'2026-10-02T15:00:00.000000Z',stayTo:'2026-10-05T11:00:00.000000Z'}))});
 const largeBefore=JSON.stringify(large);render({group:large,contextLabel:'Large synthetic block',reservationLinks:{'50000000-0000-4000-8000-000000000029':<a href="/parent-final-row">Last supplied destination</a>},masterFolioLink:master});await open(0);await open(1);
 assert(details()[0].querySelectorAll('table').length===40&&details()[1].querySelectorAll('table').length===30,'all rows');
 assert([...details()[0].querySelectorAll('caption')].every((node,i)=>node.textContent==='Allotment '+(i+1)+' · TYPE-'+i+' · Room type '+i),'allotment order');
 assert([...details()[1].querySelectorAll('caption')].every((node,i)=>node.textContent==='Rooming row '+(i+1)+' · Guest '+i),'rooming order');
 assert(card().querySelector('a[href="/parent-final-row"]')&&text().includes('2026-10-02')&&text().includes('2026-10-02T15:00:00.000000Z')&&text().includes('2026-10-05T11:00:00.000000Z'),'last row');checks.push('all 40 allotments and 30 rooming rows retain order exact values and last supplied destination');
 await changeLayout('desktop');geometry('desktop');checks.push('original-theme desktop geometry readable');
 await changeLayout('container');geometry('container');checks.push('original-theme narrow card within desktop viewport full width');
 await changeLayout('narrow');geometry('narrow');checks.push('original-theme375px complete detail has no page overflow');
 await changeLayout('zoom');geometry('zoom');checks.push('original-theme375px doubled text full-width wrapped values');
 const late=document.createElement('link');late.rel='stylesheet';late.href='/theme.css';document.head.append(late);await new Promise((resolve,reject)=>{late.onload=resolve;late.onerror=reject;});await changeLayout('late-theme');geometry('late-theme');checks.push('late original theme cannot squeeze metrics or table values');
 for(const group of [base,zero,hostile]){render({group,evidenceState:'unavailable',reservationLinks:links,masterFolioLink:master});assert(!card().querySelector('dl,details,table,a')&&!text().includes(group.code)&&!text().includes('Synthetic guest'),'unavailable');}checks.push('unavailable suppresses all retained records guest details and links');
 for(const group of [null,undefined]){render({group,evidenceState:'current',reservationLinks:links,masterFolioLink:master});assert(text().includes('No group block evidence returned.')&&!card().querySelector('dl,details,table,a'),'absent');}checks.push('null and undefined hide facts and links without fabricated zero block');
 render({group:base,evidenceState:'current',contextLabel:'Final record',reservationLinks:links,masterFolioLink:master});assert(details().every(node=>!node.open),'return reset');checks.push('return from absent to current starts collapsed');
 assert(JSON.stringify(base)===initial&&JSON.stringify(large)===largeBefore&&callbackCalls===0&&requests.length===0&&writes.length===0,'no mutation/effects');flushSync(()=>root.unmount());
 assert(requests.length===0&&writes.length===0&&callbackCalls===0,'unmount effects');checks.push('frozen inputs renders keyboard rerenders unmount yield zero requests storage callbacks');
 assert(keys.length>=10&&keys.every(event=>event.trusted),'trusted input');checks.push('disclosure keyboard uses trusted browser input');
 const result=document.createElement('pre');result.id='proof';result.textContent=JSON.stringify({passed:true,checks,requests:requests.length,writes:writes.length,callbackCalls,keys,layout,allotmentRows:40,roomingRows:30});document.body.replaceChildren(result);
})().catch(error=>{const result=document.createElement('pre');result.id='proof';result.textContent=JSON.stringify({passed:false,error:String(error),checks,body:text().slice(0,2000)});document.body.replaceChildren(result);});
`);
 const built=await Bun.build({entrypoints:[entry],target:'browser',outdir:proof,naming:'[name].[ext]'});
 await writeFile(resolve(proof,'bundle-build.log'),built.logs.join('\n')+'\nsuccess='+built.success+'\n');expect(built.success,built.logs.join('\n')).toBe(true);
 const server=Bun.serve({hostname:'127.0.0.1',port:0,fetch(request){const name=new URL(request.url).pathname;
 if(name==='/fixture.js')return new Response(Bun.file(resolve(proof,'fixture.js')),{headers:{'content-type':'application/javascript'}});
 if(name==='/fixture.css')return new Response(Bun.file(resolve(proof,'fixture.css')),{headers:{'content-type':'text/css'}});
 if(name==='/theme.css')return new Response(Bun.file(resolve(root,'frontend/yellow/src/styles.css')),{headers:{'content-type':'text/css'}});
 return new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"><div class="yellow-next"><article class="detail-card" id="root"></article></div><script src="/fixture.js"></script>',{headers:{'content-type':'text/html'}});
 }});
  let socket:WebSocket|undefined;let send:((method:string,params?:Record<string,unknown>)=>Promise<any>)|undefined;
  const child=Bun.spawn([chrome,'--headless=new','--no-first-run','--no-default-browser-check','--disable-gpu','--disable-background-networking',`--user-data-dir=${resolve(proof,'profile')}`,'--remote-debugging-port=0','about:blank'],{cwd:root,stdin:'ignore',stdout:'ignore',stderr:'ignore'});
  let evidence:any;const diagnostics:unknown[]=[];const expires=Date.now()+30_000;
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
      if(observation.key?.sequence>handled){const sequence=observation.key.sequence;await send('Input.dispatchKeyEvent',{type:'keyDown',key:observation.key.key,code:observation.key.code,windowsVirtualKeyCode:observation.key.code==='Tab'?9:32,text:observation.key.code==='Tab'?undefined:' '});await send('Input.dispatchKeyEvent',{type:'keyUp',key:observation.key.key,code:observation.key.code,windowsVirtualKeyCode:observation.key.code==='Tab'?9:32});await send('Runtime.evaluate',{expression:`window.keyDone=${sequence}`});handled=sequence;}
      if(observation.layout&&!layouts.has(observation.layout)){
        if(observation.layout==='container')await send('Runtime.evaluate',{expression:'document.getElementById("root").style.width="340px"'});
        if(observation.layout==='narrow'){await send('Runtime.evaluate',{expression:'document.getElementById("root").style.width=""'});await send('Emulation.setDeviceMetricsOverride',{width:375,height:900,deviceScaleFactor:1,mobile:false});}
        if(observation.layout==='zoom')await send('Runtime.evaluate',{expression:'document.documentElement.style.fontSize="32px"'});
        await send('Runtime.evaluate',{expression:'window.scrollTo(0,0)'});
        const snapshot=await send('Page.captureScreenshot',{format:'png'});await writeFile(resolve(proof,observation.layout+'.png'),Buffer.from(snapshot.data,'base64'));
        await send('Runtime.evaluate',{expression:'document.querySelector(".group-evidence__table").scrollIntoView()'});
        const detailSnapshot=await send('Page.captureScreenshot',{format:'png'});await writeFile(resolve(proof,observation.layout+'-details.png'),Buffer.from(detailSnapshot.data,'base64'));
        await send('Runtime.evaluate',{expression:'window.scrollTo(0,0)'});
        await send('Runtime.evaluate',{expression:`window.layoutDone=${JSON.stringify(observation.layout)}`});layouts.add(observation.layout);
      }
      await Bun.sleep(20);
    }
    if(!evidence){diagnostics.push(await send('Runtime.evaluate',{expression:'document.documentElement.outerHTML',returnByValue:true}));await writeFile(resolve(proof,'failure.json'),JSON.stringify(diagnostics,null,2));throw new Error('Group block proof exceeded30seconds');}
    await writeFile(resolve(proof,'receipt.json'),JSON.stringify(evidence,null,2));expect(evidence.passed,JSON.stringify(evidence)).toBe(true);expect(evidence.checks).toHaveLength(29);expect(evidence.requests).toBe(0);expect(evidence.writes).toBe(0);expect(evidence.callbackCalls).toBe(0);
  }finally{await terminateOwnedProcess(child,send?()=>send!('Browser.close'):undefined);socket?.close();server.stop(true);}

},40_000);
