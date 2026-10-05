import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, sep } from "node:path";
import { resolveChromiumPath } from "./helpers/chromium-path";
import { fetchJsonBounded, terminateOwnedProcess } from "./helpers/owned-cdp-proof-lifecycle";
type Send = <T = unknown>(method: string, params?: Record<string, unknown>) => Promise<T>;
const repository = resolve(import.meta.dir, "..");
const P="00000000-0000-4000-8000-000000000001", G="00000000-0000-4000-8000-000000000004";
const rows=[{reservationId:"00000000-0000-4000-8000-000000000005",confirmationNo:"Y-101",primaryGuestDisplayName:"Synthetic Alice",status:"due_in",operationalState:"due_in",stayFrom:"2026-10-02T14:00:00Z",stayTo:"2026-10-04T10:00:00Z",unitTypeLabel:"Villa",channelCode:"airbnb"},{reservationId:"00000000-0000-4000-8000-000000000006",confirmationNo:"Y-102",primaryGuestDisplayName:"Synthetic Bob",status:"cancelled",operationalState:"cancelled",stayFrom:"2026-10-06T14:00:00Z",stayTo:"2026-10-08T10:00:00Z",unitTypeLabel:"Suite",channelCode:"direct"}];
const group={groupId:G,kind:"linked",code:"GRP-1",name:"Synthetic wedding",status:"active",memberCount:1,roomsHeldByGroup:false};
test("mounted full App reservations: Individual, Groups, search, filters, Back, direct URLs and existing create at desktop/mobile",async()=>{
 const executable=resolveChromiumPath();if(!executable)throw new Error("Owned Chromium required");
 const directory=await mkdtemp(resolve(tmpdir(),"yellow-reservation-search-owned-")),profile=resolve(directory,"profile");
 const proof=process.env.YELLOW_RES_SEARCH_PROOF_DIR?resolve(process.env.YELLOW_RES_SEARCH_PROOF_DIR):resolve(directory,"proof");await mkdir(proof,{recursive:true});
 let server:ReturnType<typeof Bun.serve>|undefined,chrome:ReturnType<typeof Bun.spawn>|undefined,socket:WebSocket|undefined;
 const errors:string[]=[],reads:string[]=[],writes:string[]=[];let boardFail=false,groupFail=false;
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
createRoot(document.getElementById('root')).render(React.createElement(QueryClientProvider,{client:new QueryClient({defaultOptions:{queries:{retry:false,refetchOnWindowFocus:false}}})},React.createElement(AuthenticationGate,null,React.createElement(App))));`);
 const builder=resolve(directory,"build.ts");await writeFile(builder,`const result=await Bun.build({entrypoints:[${JSON.stringify(entry)}],outdir:${JSON.stringify(resolve(directory,"build"))},target:'browser',format:'esm',define:{'process.env.NODE_ENV':'"production"'}});if(!result.success){console.error(result.logs);process.exit(1)}`);
 const compiler=Bun.spawn([process.execPath,builder],{cwd:repository,stdout:"pipe",stderr:"pipe",windowsHide:true});
 const outputs=Promise.all([new Response(compiler.stdout).text(),new Response(compiler.stderr).text()]);
 const timer=setTimeout(()=>compiler.kill(),10000);let status:number;try{status=await compiler.exited}finally{clearTimeout(timer)}if(status!==0)throw new Error((await outputs).join("\n"));await outputs;
 server=Bun.serve({hostname:"127.0.0.1",port:0,async fetch(request){
 const url=new URL(request.url),path=url.pathname;
 if(!path.startsWith('/api/')){if(path.endsWith('.js')||path.endsWith('.css')){const file=resolve(directory,'build',path.slice(1));if(!file.startsWith(resolve(directory,'build')+sep)||!existsSync(file))return new Response('missing',{status:404});return new Response(Bun.file(file),{headers:{'content-type':path.endsWith('.css')?'text/css':'text/javascript'}})}return new Response('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/entry.css"><div id="root"></div><script type="module" src="/entry.js"></script></html>',{headers:{'content-type':'text/html'}})}
 if(path==='/api/v1/auth/browser/resume'){const payload=Buffer.from(JSON.stringify({sub:'00000000-0000-4000-8000-000000000003',tid:'00000000-0000-4000-8000-000000000002'})).toString('base64url');return Response.json({accessToken:`synthetic.${payload}.signature`,tokenType:'Bearer',expiresInSeconds:900,user:{id:'00000000-0000-4000-8000-000000000003',displayName:'Synthetic staff'}})}
 if(request.method!=='GET'){writes.push(request.method+' '+path);return Response.json({},{status:405})}reads.push(path+url.search);
 if(path==='/api/v1/me/properties')return Response.json({properties:[{id:P,name:'Synthetic property',timezone:'UTC'}]});
 if(path.endsWith('/reservation-board')&&boardFail)return Response.json({},{status:503});
 if(path.endsWith('/reservation-board'))return Response.json({reservations:rows,nextCursor:null});
 if(path.endsWith('/operational-blocks'))return Response.json({operationalBlocks:[]});
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
      const coordinates = await read<{ x: number; y: number }>(`(async()=>{const text=${JSON.stringify(text)},selector=text==='Close navigation'?'.operator-navigation-heading button':'button,label,summary',el=[...document.querySelectorAll(selector)].filter(n=>n.getClientRects().length).find(n=>n.getAttribute('aria-label')===text||n.textContent.trim()===text||(n.tagName==='BUTTON'&&n.textContent.trim().startsWith(text))||(n.tagName==='LABEL'&&n.textContent.includes(text)));if(!el)throw new Error('Missing control '+text);el.scrollIntoView({block:'center',behavior:'instant'});await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);const r=el.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,hit=document.elementFromPoint(x,y);if(hit!==el&&!el.contains(hit))throw new Error('Occluded control '+text+' by '+hit?.textContent);return{x,y}})()`);
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
 const setSelect=async(label:string,value:string)=>read(`(()=>{const el=[...document.querySelectorAll('label')].find(n=>n.textContent.startsWith(${JSON.stringify(label)}))?.querySelector('select');if(!el)throw new Error('Missing select');el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 const input=async(selector:string,value:string)=>{await read(`document.querySelector(${JSON.stringify(selector)}).focus()`);await send('Input.dispatchKeyEvent',{type:'keyDown',key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2});if(value)await send('Input.insertText',{text:value});else await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Backspace',code:'Backspace',windowsVirtualKeyCode:8});};
 const screenshot=async(name:string)=>{const result=await send<{data:string}>('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(resolve(proof,name+'.png'),Buffer.from(result.data,'base64'));};
 const navigate=async(search='')=>{await send('Page.navigate',{url:`http://127.0.0.1:${server!.port}/p/${P}/reservations${search}`});await until("!!document.querySelector('.reservation-search-actions')",'actual lazy board');};
 for(const width of [1440,375]){
 await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width===375});await navigate();
 await until("document.querySelectorAll('.movement-data-row').length===2",'returned individual rows');
 expect(await read<boolean>("!!document.querySelector('.operator-header')")).toBe(true);
 expect(await read<boolean>("!!document.querySelector('.group-reservation-workspace')||!!document.querySelector('.group-block-workbench')")).toBe(false);
 const boot=await read<string>('window.resBootId');
 await input('input[aria-label="Search reservations"]','Alice');await until("document.querySelectorAll('.movement-data-row').length===1",'real text search');
 expect(await read<string>("document.querySelector('.movement-data-row').textContent")).toContain('Y-101');
 await input('input[aria-label="Search reservations"]','');await until("document.querySelectorAll('.movement-data-row').length===2",'clear search');
 await setSelect('Source','direct');await until("document.querySelectorAll('.movement-data-row').length===1",'source filter');expect(await read<string>("document.querySelector('.movement-data-row').textContent")).toContain('Y-102');
 await setSelect('Source','');await setSelect('Reservation status','due_in');await until("document.querySelectorAll('.movement-data-row').length===1",'status filter');
 await setSelect('Reservation status','');
 await read("(()=>{const el=[...document.querySelectorAll('label')].find(n=>n.textContent.startsWith('Arrival from')).querySelector('input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'2026-10-05');el.dispatchEvent(new Event('input',{bubbles:true}));})()");
 await until("document.querySelectorAll('.movement-data-row').length===1",'date filter');expect(await read<string>("document.querySelector('.movement-data-row').textContent")).toContain('Y-102');
 await screenshot('individual-'+width);
 expect(await read<number>('document.documentElement.scrollWidth')).toBeLessThanOrEqual(width+1);
 const scroll=await read<{client:number;total:number}>("(()=>{const el=document.querySelector('.movement-grid-scroll');return{client:el.clientWidth,total:el.scrollWidth}})()");expect(scroll.total).toBeGreaterThan(scroll.client);
 await setSelect('Reservation type','groups');await until("!!document.querySelector('.reservation-group-results')",'group board');
 expect(await read<string>('location.search')).toBe('?view=groups');expect(await read<string>('window.resBootId')).toBe(boot);
 expect(await read<boolean>("!!document.querySelector('.movement-data-row')||!!document.querySelector('.group-reservation-workspace')")).toBe(false);
 await input('.reservation-group-search-controls input','absent');await click('Search group reservations');await until("document.body.innerText.includes('No matching groups')",'server group search no match');
 expect(reads.some(url=>url.includes('q=absent'))).toBe(true);
 await input('.reservation-group-search-controls input','wedding');await click('Search group reservations');await until("document.querySelector('.reservation-group-results').textContent.includes('Synthetic wedding')",'server group match');
 await screenshot('groups-'+width);expect(await read<number>('document.documentElement.scrollWidth')).toBeLessThanOrEqual(width+1);
 await click('Synthetic wedding');await until("!!document.querySelector('.group-reservation-workspace')",'selected group commands');await until("document.querySelector('.group-detail').textContent.includes('Synthetic Alice')",'real selected membership');
 expect(await read<string>('location.search')).toContain('group='+G);
 await read('history.back()');await until("!location.search.includes('group=')",'back from group');
 await read('history.back()');await until("!!document.querySelector('.movement-data-row')",'back to Individual');expect(await read<string>('window.resBootId')).toBe(boot);
 await click('Create new reservation');await until("!!document.querySelector('.reservation-create-next')",'existing create form');expect(await read<string>('document.body.innerText')).toContain('Stay details');await click('Close');await until("!!document.querySelector('.movement-data-row')",'return to board');
 }
 await navigate('?view=groups&group='+G);await until("!!document.querySelector('.group-reservation-workspace')",'direct groups URL');await until("document.querySelector('.group-detail').textContent.includes('Synthetic Alice')",'direct group membership');
 await read(`sessionStorage.setItem('yellow-group-create:${P}',JSON.stringify({key:'00000000-0000-4000-8000-000000000010',name:'Pending synthetic group'}))`);
 await navigate('?view=groups&group='+G);await until("document.body.innerText.includes('Reconcile same group request')",'retained uncertain group attempt');
 await click('Group management and room blocks');expect(await read<boolean>("document.querySelector('.reservation-group-management').open")).toBe(true);
 await click('Create new reservation');expect(await read<boolean>("!!document.querySelector('.reservation-create-next')")).toBe(false);expect(await read<boolean>("!!document.querySelector('.group-reservation-workspace')")).toBe(true);
 await setSelect('Reservation type','list');expect(await read<string>('location.search')).toContain('view=groups');
 await read(`sessionStorage.removeItem('yellow-group-create:${P}')`);
 await navigate('?view=list');await until("!!document.querySelector('.movement-data-row')",'direct Individual URL');expect(await read<boolean>("!!document.querySelector('.group-reservation-workspace')")).toBe(false);
 await navigate('?view=groups&group=bad');await until("document.body.innerText.includes('The group link is invalid.')",'explicit invalid group link');
 boardFail=true;await navigate();await until("document.body.innerText.includes('Reservations are unavailable.')",'board read failure');expect(await read<boolean>("!!document.querySelector('.reservation-search-actions')")).toBe(true);
 groupFail=true;await setSelect('Reservation type','groups');await until("!!document.querySelector('.reservation-group-search .error')",'group read failure');expect(await read<boolean>("!!document.querySelector('.reservation-group-results')")).toBe(false);
 expect(writes).toEqual([]);expect(errors).toEqual([]);
 }finally{
 await writeFile(resolve(proof,'observations.json'),JSON.stringify({syntheticOnly:true,actualFullApp:true,reads,writes,errors,browserPid:chrome?.pid},null,2));
 try { if(chrome)await terminateOwnedProcess(chrome); } finally { socket?.close();server?.stop(true); }
 const absolute=resolve(directory);if(!absolute.startsWith(resolve(tmpdir())+sep)||!absolute.split(sep).at(-1)?.startsWith('yellow-reservation-search-owned-'))throw new Error('Cleanup containment failed');await rm(absolute,{recursive:true,force:true,maxRetries:10,retryDelay:100});
 }
},120000);
