import { expect, test } from "bun:test";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { resolveChromiumPath } from "./helpers/chromium-path";
import { fetchJsonBounded, terminateOwnedProcess } from "./helpers/owned-cdp-proof-lifecycle";

test("actual inventory relationship view mounts safely with native keyboard disclosure and narrow containment", async () => {
  const chrome = resolveChromiumPath();
  if (!chrome) throw new Error("Owned Chromium is required for mounted inventory presentation proof");
  const root = resolve(import.meta.dir, "..");
  const proof = await mkdtemp(resolve(root, ".inventory-relationships-proof-"));
  const entry = resolve(proof, "fixture.mjs");
  const modulePath = resolve(root, "src/http/operator/inventory-relationships-view.mjs");
  // The order admits no declaration adapter. The renderer is separately checked
  // with strict allowJs/checkJs; this fixture loads its runtime module by path.
  expect(typeof (await import(modulePath)).createInventoryRelationshipsView).toBe("function");
  const css = resolve(root, "src/http/operator/inventory-relationships-view.css");
  // Admission uses the exact immutable projector bytes at their repository-local path.
  const projector = resolve(root, "src/http/operator/inventory-relationships-model.mjs");
  await writeFile(entry, `
import { createInventoryRelationshipsView as render } from ${JSON.stringify(modulePath)};
import { buildInventoryRelationships as build } from ${JSON.stringify(projector)};
const checks=[], requests=[], writes=[], keys=[], layout=[];
const assert=(ok,message)=>{if(!ok)throw new Error(message);};
const tick=()=>new Promise(resolve=>setTimeout(resolve,10));
const wait=async predicate=>{for(let i=0;i<150;i++){if(predicate())return;await tick();}throw new Error('fixture observation timed out');};
window.fetch=(...args)=>{requests.push(args);throw new Error('Unexpected presentation fetch');};
XMLHttpRequest.prototype.send=function(...args){requests.push(args);throw new Error('Unexpected presentation XHR');};
Storage.prototype.setItem=function(...args){writes.push(args);throw new Error('Unexpected presentation storage');};
document.addEventListener('keydown',event=>keys.push({key:event.key,trusted:event.isTrusted}));
const uuid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const scope={propertyId:uuid(1),tenantId:uuid(2)};
const scoped=value=>({tenantId:scope.tenantId,propertyNode:scope.propertyId,...value});
const fixture=()=>({unitTypes:[scoped({id:uuid(3),code:'APT',name:'Apartment'}),scoped({id:uuid(4),code:'EMPTY',name:'No options'})],
 spaces:[scoped({id:uuid(5),code:'A1',floor:null}),scoped({id:uuid(6),code:'UNMAPPED',floor:'2'})],
 sellableUnits:[scoped({id:uuid(7),unitTypeId:uuid(3),unitTypeCode:'APT',name:'Whole apartment',status:'active',spaces:[{spaceId:uuid(5),code:'A1',claimMode:'exclusive'}]}),
 scoped({id:uuid(8),unitTypeId:uuid(3),unitTypeCode:'APT',name:'Bed option',status:'paused_external',spaces:[{spaceId:uuid(5),code:'A1',claimMode:'positional'}]}),
 scoped({id:uuid(9),unitTypeId:uuid(3),unitTypeCode:'APT',name:'No mapping option',status:'inactive',spaces:[]})]});
let view; const mount=model=>{view=render(document,model);document.getElementById('root').replaceChildren(view);};
const body=()=>view.textContent;
const visibleText=node=>node.nodeType===Node.TEXT_NODE?node.textContent:node.tagName==='DETAILS'&&!node.open?node.querySelector('summary').textContent:[...node.childNodes].map(visibleText).join(' ');
let keySequence=0;
const keyboard=async selector=>{const target=view.querySelector(selector);assert(target,'keyboard target missing');target.focus();const sequence=++keySequence;window.keyRequest={sequence,key:' '};await wait(()=>window.keyDone===sequence);await tick();};
(async()=>{
 const input=fixture(),before=JSON.stringify(input),model=build(input,scope),modelBefore=JSON.stringify(model);mount(model);
 assert(JSON.stringify(input)===before&&JSON.stringify(model)===modelBefore&&Object.isFrozen(model),'frozen model unchanged');
 const alternateDocument=document.implementation.createHTMLDocument('Alternate fixture document');const alternateView=render(alternateDocument,model);
 assert(view.ownerDocument===document&&alternateView.ownerDocument===alternateDocument&&[...alternateView.querySelectorAll('*')].every(node=>node.ownerDocument===alternateDocument),'explicit Document rather than global document');checks.push('actual renderer consumes unchanged frozen projector output and explicit document');
 assert(view.querySelectorAll('.inventory-relationships__type').length===2&&view.querySelectorAll('.inventory-relationships__unit').length===3,'one type/unit record each');
 assert(body().includes('Unit type APT · Apartment')&&body().includes('Whole apartment')&&body().includes('Physical space A1'),'readable relationship labels');checks.push('type sellable physical-space associations rendered without duplicate entities');
 assert(body().includes('2 returned physical spaces')&&body().includes('3 returned sellable units')&&body().includes('not total stock'),'returned counts');
 assert(body().includes('Availability is not evaluated')&&body().includes('Physical parent hierarchy is not recorded')&&!body().includes('availableCount'),'authority boundaries');checks.push('returned counts remain separate from availability and physical hierarchy');
 const shared=view.querySelectorAll('.inventory-relationships__claim');assert(shared.length===2&&[...shared].every(n=>n.textContent.includes(uuid(5))&&n.textContent.includes('Shared physical space reference')),'same exact space identity reused');
 assert(body().includes('not independent rooms')&&body().includes('do not add them together'),'shared explanation');checks.push('exclusive positional alternatives reference the same physical identity without stock summation');
 assert(body().includes('No sellable units returned for this unit type')&&body().includes('No claim mapping returned'),'empty type and zero claim');checks.push('empty type and claimless sellable remain explicit');
 assert(body().includes('Unrecognized recorded status: paused_external')&&body().includes('Recorded status: inactive')&&body().includes('Floor not recorded'),'unknown status and null floor');checks.push('recorded unknown inactive status and missing floor remain honest');
 assert(view.querySelectorAll('.inventory-relationships__space').length===1&&view.querySelector('.inventory-relationships__space').textContent.includes(uuid(6))&&body().includes('No claim in returned units'),'unmappedspace');checks.push('unclaimed space is preserved as exact returned identity');
 assert([...view.querySelectorAll('details')].every(n=>!n.open),'collapsed identity Details');assert(!visibleText(view).includes(uuid(5))&&!visibleText(view).includes(uuid(7)),'identities quiet');checks.push('technical identity references start inside collapsed Details');
 const supporting=view.querySelector('.inventory-relationships__supporting');
 assert(!supporting.open&&visibleText(view).includes('Configured relationships · availability not evaluated')&&!visibleText(view).includes('not independent rooms')&&!visibleText(view).includes('Physical parent hierarchy'),'supporting limitations collapsed but availability boundary visible');
 assert(visibleText(view).includes('Shared physical space reference')&&visibleText(view).includes('Unrecognized recorded status')&&visibleText(view).includes('No claim mapping returned'),'actual gaps and shared labels remain visible');checks.push('concise status stays visible with supporting limitations initially collapsed');
 window.layoutRequest='ordinary';await wait(()=>window.layoutDone==='ordinary');await tick();window.scrollTo(0,0);
 const ordinaryHeading=view.querySelector('.inventory-relationships__type h4').getBoundingClientRect();
 const ordinaryName=view.querySelector('.inventory-relationships__unit strong').getBoundingClientRect();
 assert(window.innerWidth===375&&ordinaryHeading.top>=0&&ordinaryHeading.bottom<=window.innerHeight/2&&ordinaryName.bottom<=window.innerHeight,'first ordinary type and sellable usable in initial375px viewport');
 assert(!supporting.open,'supporting remains collapsed at first ordinary narrow render');layout.push({width:innerWidth,height:innerHeight,firstTypeTop:ordinaryHeading.top,firstTypeBottom:ordinaryHeading.bottom,firstSellableBottom:ordinaryName.bottom});checks.push('ordinary375px initial viewport shows first type in upper half and first sellable');
 await keyboard('.inventory-relationships__supporting summary');assert(supporting.open&&supporting.textContent.includes('These are returned records, not total stock.')&&supporting.textContent.includes('not independent rooms; do not add them together as stock.')&&supporting.textContent.includes('Physical parent hierarchy is not recorded.'),'trusted keyboard reveals exact supporting limitations');
 assert(keys.some(k=>k.key===' '&&k.trusted)&&requests.length===0&&writes.length===0,'support expansion pure');checks.push('trusted supporting Details reveals exact limitations without effects');
 mount(model);assert(!view.querySelector('.inventory-relationships__supporting').open,'support disclosure resets on replacement');checks.push('supporting Details resets collapsed on component replacement');
 window.layoutRequest='desktop';await wait(()=>window.layoutDone==='desktop');await tick();
 await keyboard('.inventory-relationships__claim summary');assert(view.querySelector('.inventory-relationships__claim details').open,'native Space expands Details');
 assert(document.activeElement===view.querySelector('.inventory-relationships__claim summary')&&keys.some(k=>k.key===' '&&k.trusted),'trusted native activation retains summary focus');
 assert(getComputedStyle(document.activeElement).outlineStyle!=='none','visible keyboard outline');checks.push('trusted native Space opens Details and retains visible keyboard focus');
 assert(requests.length===0&&writes.length===0,'expansion has no requests or storage writes');assert(!view.querySelector('button,input,select,form,a,img,script,iframe'),'no command/navigation/media surface');checks.push('disclosure adds no requests writes or domain controls');
 mount(model);assert([...view.querySelectorAll('details')].every(n=>!n.open),'replacement resets Details');checks.push('replacing component resets native disclosure state');
 const hostile='<img src="https://invalid.example/attack" onerror="window.injected=true"><script>window.injected=true</script>'; const evil=fixture();
 evil.unitTypes[0].code=hostile;evil.unitTypes[0].name=hostile;evil.sellableUnits.forEach(u=>u.unitTypeCode=hostile);evil.spaces.forEach(space=>{space.code=hostile;space.floor=hostile;});evil.sellableUnits.slice(0,2).forEach(u=>{u.name=hostile;u.spaces[0].code=hostile;});evil.sellableUnits[1].status=hostile;
 mount(build(evil,scope));assert(body().includes(hostile)&&!view.querySelector('img,script,a,iframe')&&!window.injected,'hostile labels remain literal text');
 assert(requests.length===0&&writes.length===0,'hostile text inert');checks.push('hostile labels codes and status remain inert text without HTML URLs or writes');
 window.layoutRequest='narrow';await wait(()=>window.layoutDone==='narrow');await tick();
 assert(window.innerWidth===375,'actual375 CSS px viewport');
 assert(view.scrollWidth<=view.clientWidth+1&&document.documentElement.scrollWidth<=window.innerWidth+1,'narrow containment with long hostile labels');
 assert([...view.querySelectorAll('summary')].every(n=>n.getBoundingClientRect().height>=44),'44px native disclosure targets');checks.push('actual375px component contains long labels with44px disclosure targets');
 window.layoutRequest='zoom';await wait(()=>window.layoutDone==='zoom');await tick();
 assert(view.scrollWidth<=view.clientWidth+1&&document.documentElement.scrollWidth<=window.innerWidth+1,'200percent text zoom containment');checks.push('narrow component contains200percent text zoom');
 mount(build({unitTypes:[],spaces:[],sellableUnits:[]},scope));assert(body().includes('0 returned physical spaces')&&body().includes('No unit types in returned configuration')&&!view.querySelector('.inventory-relationships__unit'),'empty configuration nofabrication');checks.push('empty configuration renders explicit absence without invented room');
 const spacesOnly=fixture();spacesOnly.unitTypes=[];spacesOnly.sellableUnits=[];mount(build(spacesOnly,scope));assert(view.querySelectorAll('.inventory-relationships__space').length===2&&body().includes('No claim in returned units'),'spacesonly retained');checks.push('spaces without unit types remain unmapped references');
 assert(requests.length===0&&writes.length===0,'all component operations stayed pure');checks.push('entire mounted sequence performs zero transport or storage writes');
 const result=document.createElement('pre');result.id='proof';result.textContent=JSON.stringify({passed:true,checks,requests:requests.length,writes:writes.length,keys,layout});document.body.replaceChildren(result);
})().catch(error=>{const result=document.createElement('pre');result.id='proof';result.textContent=JSON.stringify({passed:false,error:String(error),checks,body:view?.textContent.slice(0,1400)});document.body.replaceChildren(result);});
`);
  const built = await Bun.build({ entrypoints: [entry], target: "browser", outdir: proof, naming: "[name].[ext]" });
  expect(built.success, built.logs.join("\n")).toBe(true);
  const server = Bun.serve({hostname:"127.0.0.1",port:0,fetch(request) {
    const name=new URL(request.url).pathname;
    if(name==='/fixture.js') return new Response(Bun.file(resolve(proof,'fixture.js')),{headers:{'content-type':'application/javascript'}});
    if(name==='/component.css') return new Response(Bun.file(css),{headers:{'content-type':'text/css'}});
    return new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/component.css"><style>:root{--ink:#202722;--muted:#56645c;--line:#cfd8d1;--paper:#f5f7f4;--card:#fff;--focus:#176b45;--card-radius:12px;--control-radius:8px;font:16px system-ui}body{margin:0;padding:12px;box-sizing:border-box}#root{min-width:0}</style><div id="root"></div><script src="/fixture.js"></script>',{headers:{'content-type':'text/html'}});
  }});
  let socket: WebSocket | undefined;
  let send: ((method:string,params?:Record<string,unknown>)=>Promise<any>) | undefined;
  const child=Bun.spawn([chrome,'--headless=new','--no-first-run','--no-default-browser-check','--disable-gpu','--disable-background-networking',`--user-data-dir=${resolve(proof,'profile')}`,'--remote-debugging-port=0','about:blank'],{cwd:root,stdin:'ignore',stdout:'ignore',stderr:'ignore'});
  let evidence: any;
  const diagnostics: unknown[]=[];
  const expires=Date.now()+20_000;
  try {
    let port: string | undefined;
    while(!port&&Date.now()<expires){try{port=(await readFile(resolve(proof,'profile/DevToolsActivePort'),'utf8')).split('\n')[0];}catch{await Bun.sleep(25);}}
    if(!port)throw new Error('Owned Chromium debugger did not become ready');
    const targets=await fetchJsonBounded<Array<{type:string;url:string;webSocketDebuggerUrl?:string}>>(`http://127.0.0.1:${port}/json/list`);
    const target=targets.find(target=>target.type==='page'&&target.url==='about:blank');
    if(!target?.webSocketDebuggerUrl)throw new Error('Owned blank page target unavailable');
    socket=new WebSocket(target.webSocketDebuggerUrl);
    await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('CDP open deadline')),5_000);socket!.onopen=()=>{clearTimeout(timer);resolve();};socket!.onerror=()=>{clearTimeout(timer);reject(new Error('CDP open failed'));};});
    let id=0;
    const pending=new Map<number,{resolve:(value:any)=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>}>();
    socket.onmessage=event=>{const response=JSON.parse(String(event.data));if(response.method==='Runtime.exceptionThrown')diagnostics.push(response.params);const request=pending.get(response.id);if(!request)return;pending.delete(response.id);clearTimeout(request.timer);response.error?request.reject(new Error(JSON.stringify(response.error))):request.resolve(response.result);};
    send=(method,params={})=>new Promise((resolve,reject)=>{const requestId=++id;const timer=setTimeout(()=>{pending.delete(requestId);reject(new Error('CDP command deadline '+method));},5_000);pending.set(requestId,{resolve,reject,timer});socket!.send(JSON.stringify({id:requestId,method,params}));});
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride',{width:1200,height:1000,deviceScaleFactor:1,mobile:false});
    await send('Page.navigate',{url:`http://127.0.0.1:${server.port}/`});
    await send('Page.bringToFront');await send('Emulation.setFocusEmulationEnabled',{enabled:true});
    let handled=0;const layouts=new Set<string>();
    while(Date.now()<expires){
      const state=await send('Runtime.evaluate',{expression:"JSON.stringify({proof:document.getElementById('proof')?.textContent,key:window.keyRequest,layout:window.layoutRequest})",returnByValue:true});
      const observation=JSON.parse(state.result.value);
      if(observation.proof){evidence=JSON.parse(observation.proof);break;}
      if(observation.key?.sequence>handled){const sequence=observation.key.sequence;
        if(sequence===2){const snapshot=await send('Page.captureScreenshot',{format:'png'});await writeFile(resolve(proof,'desktop-component.png'),Buffer.from(snapshot.data,'base64'));}
        await send('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space',windowsVirtualKeyCode:32,text:' '});
        await send('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32});
        await send('Runtime.evaluate',{expression:`window.keyDone=${sequence}`});handled=sequence;}
      if(observation.layout&&!layouts.has(observation.layout)){
        if(observation.layout==='ordinary')await send('Emulation.setDeviceMetricsOverride',{width:375,height:600,deviceScaleFactor:1,mobile:false});
        else if(observation.layout==='desktop')await send('Emulation.setDeviceMetricsOverride',{width:1200,height:1000,deviceScaleFactor:1,mobile:false});
        else if(observation.layout==='narrow')await send('Emulation.setDeviceMetricsOverride',{width:375,height:900,deviceScaleFactor:1,mobile:false});
        else await send('Runtime.evaluate',{expression:"document.documentElement.style.fontSize='32px'"});
        if(observation.layout==='ordinary'){const snapshot=await send('Page.captureScreenshot',{format:'png'});await writeFile(resolve(proof,'narrow-ordinary-component.png'),Buffer.from(snapshot.data,'base64'));}
        if(observation.layout==='narrow'){const snapshot=await send('Page.captureScreenshot',{format:'png'});await writeFile(resolve(proof,'narrow-hostile-labels-component.png'),Buffer.from(snapshot.data,'base64'));}
        await send('Runtime.evaluate',{expression:`window.layoutDone=${JSON.stringify(observation.layout)}`});layouts.add(observation.layout);}
      await Bun.sleep(20);
    }
    if(!evidence){diagnostics.push(await send('Runtime.evaluate',{expression:'document.documentElement.outerHTML',returnByValue:true}));await writeFile(resolve(proof,'failure.json'),JSON.stringify(diagnostics,null,2));throw new Error('Mounted browser proof exceeded20seconds: '+JSON.stringify(diagnostics).slice(-1800));}
    await writeFile(resolve(proof,'receipt.json'),JSON.stringify(evidence,null,2));
    expect(evidence.passed,JSON.stringify(evidence)).toBe(true);
    expect(evidence.checks).toHaveLength(21);
    expect(evidence.requests).toBe(0);expect(evidence.writes).toBe(0);
  } finally {await terminateOwnedProcess(child,send?()=>send!('Browser.close'):undefined);socket?.close();server.stop(true);}
},30_000);
