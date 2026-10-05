/** Order456: one isolated installed Chromium, file-only fictional mockups. */
import { existsSync } from 'node:fs';
import { mkdir, readFile, realpath, rm } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dir, '../../../..');
const folder = import.meta.dir;
const output = resolve(root, '.yellow/evidence/light-explorations');
const temporary = 'D:/Yellow/temp/light-explorations';
const names = ['01-atelier','02-meridian','03-ledger','04-aura','05-dispatch','06-canvas','07-orbit','08-atlas','09-focus','10-index'];
const overview = Bun.argv[2] === 'overview';
const selected = overview ? ['index'] : Bun.argv[2] ? names.filter(name => name.startsWith(Bun.argv[2]!)) : names;
if (!selected.length || (Bun.argv[2] && selected.length !== 1)) throw new Error('Use one exact two-digit concept ID or no argument');
for (const name of selected) if (!existsSync(resolve(folder, name+'.html'))) throw new Error('Missing concept '+name);
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
if (!chrome) throw new Error('An installed Chromium browser is required; no download permitted');
await mkdir(output,{recursive:true});await mkdir(temporary,{recursive:true});
const tempReal = await realpath(temporary);
const profile = resolve(tempReal,'capture-'+crypto.randomUUID());
await mkdir(profile);
const ownedProfile = await realpath(profile);
if(!ownedProfile.startsWith(tempReal+sep)||!ownedProfile.split(sep).at(-1)?.startsWith('capture-')) throw new Error('Profile escaped exact temporary root');
const child = Bun.spawn([chrome,'--headless=new','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-extensions','--disable-sync','--disable-component-update','--disable-crash-reporter','--disable-breakpad','--remote-debugging-address=127.0.0.1','--remote-debugging-port=0','--user-data-dir='+ownedProfile,'about:blank'],{stdin:'ignore',stdout:'ignore',stderr:'ignore'});
let socket:WebSocket|undefined; let browserClosed=false; let nextId=0;
const pending = new Map<number,{resolve:(v:any)=>void,reject:(e:Error)=>void,timer:ReturnType<typeof setTimeout>}>();
let session:string|undefined;
const pageErrors:string[]=[]; const remoteRequests:string[]=[];
const allResults:any[]=[];
const deadline=Date.now()+150_000;
async function delay(ms:number){await Bun.sleep(ms);if(Date.now()>deadline)throw new Error('Capture deadline exceeded')}
async function send(method:string,params:Record<string,unknown>={},page=true):Promise<any>{
 if(!socket||socket.readyState!==WebSocket.OPEN) throw new Error('CDP is not connected');
 const id=++nextId;
 return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(new Error('CDP deadline '+method))},8000);pending.set(id,{resolve,reject,timer});socket!.send(JSON.stringify({id,method,params,...(page&&session?{sessionId:session}:{})}));});
}
async function evaluate(expression:string){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error('Page evaluation failed');return r.result.value}
try{
 const portFile=resolve(ownedProfile,'DevToolsActivePort');
 for(let i=0;i<120&&!existsSync(portFile);i++)await delay(100);
 if(!existsSync(portFile))throw new Error('Owned browser did not expose its debugger');
 const [port,path]= (await readFile(portFile,'utf8')).trim().split(/\r?\n/);
 if(!/^\d+$/.test(port??'')||!path?.startsWith('/devtools/browser/'))throw new Error('Malformed owned debugger address');
 socket=new WebSocket('ws://127.0.0.1:'+port+path);
 await new Promise<void>((resolve,reject)=>{const t=setTimeout(()=>reject(new Error('Debugger connection timeout')),8000);socket!.onopen=()=>{clearTimeout(t);resolve()};socket!.onerror=()=>{clearTimeout(t);reject(new Error('Debugger connection error'))}});
 socket.onmessage=(event)=>{const message=JSON.parse(String(event.data));if(message.id){const task=pending.get(message.id);if(!task)return;clearTimeout(task.timer);pending.delete(message.id);message.error?task.reject(new Error(JSON.stringify(message.error))):task.resolve(message.result)}else if(message.method==='Runtime.exceptionThrown'){pageErrors.push(JSON.stringify(message.params.exceptionDetails))}else if(message.method==='Network.requestWillBeSent'){const url=message.params.request.url;if(/^https?:/.test(url))remoteRequests.push(url)}};
 const target=await send('Target.createTarget',{url:'about:blank'},false);
 session=(await send('Target.attachToTarget',{targetId:target.targetId,flatten:true},false)).sessionId;
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Network.setBlockedURLs',{urls:['http://*','https://*']});
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:overview?1800:1000,deviceScaleFactor:1,mobile:false});
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'},{name:'prefers-color-scheme',value:'light'}]});
 for(const name of selected){
  pageErrors.length=0;remoteRequests.length=0;
  await send('Page.navigate',{url:pathToFileURL(resolve(folder,name+'.html')).href+(overview?'?overview=1':'')});
  for(let i=0;i<40;i++){await delay(80);if(await evaluate(overview?"document.readyState==='complete' && document.images.length===10 && [...document.images].every(i=>i.complete)":"document.readyState==='complete' && !!document.querySelector('[data-demo-action]')"))break}
  await evaluate('document.fonts.ready.then(()=>true)');await delay(150);
  const initial=await evaluate(`({title:document.title,state:window.demoState,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,width:innerWidth,height:innerHeight,images:[...document.images].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.src),actions:document.querySelectorAll('[data-demo-action]').length,reset:document.querySelectorAll('[data-demo-reset]').length})`);
  const first=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  await Bun.write(resolve(output,(overview?'overview':name)+'.png'),Buffer.from(first.data,'base64'));
  if(overview){
   const item={name:'overview',initial,errors:[...pageErrors],remoteRequests:[...remoteRequests],pngSha256:new Bun.CryptoHasher('sha256').update(Buffer.from(first.data,'base64')).digest('hex')};allResults.push(item);console.log(JSON.stringify(item));continue;
  }
  await evaluate("document.querySelector('[data-demo-action]').click()");await delay(350);
  const changed=await evaluate('window.demoState');
  const after=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  await Bun.write(resolve(output,name+'-interaction.png'),Buffer.from(after.data,'base64'));
  await evaluate("document.querySelector('[data-demo-reset]').click()");await delay(100);
  const reset=await evaluate('window.demoState');
  const item={name,initial,changed,reset,errors:[...pageErrors],remoteRequests:[...remoteRequests],pngSha256:new Bun.CryptoHasher('sha256').update(Buffer.from(first.data,'base64')).digest('hex')};allResults.push(item);
  console.log(JSON.stringify(item));
 }
 await Bun.write(resolve(output,'capture-'+Date.now()+'.json'),JSON.stringify({viewport:{width:1440,height:overview?1800:1000},fictionalOnly:true,results:allResults},null,2));
 await send('Browser.close',{},false);browserClosed=true;
}finally{
 if(!browserClosed&&socket?.readyState===WebSocket.OPEN){try{await send('Browser.close',{},false)}catch{}}
 socket?.close();for(const item of pending.values()){clearTimeout(item.timer);item.reject(new Error('Capture closed'))}pending.clear();
 const finished=await Promise.race([child.exited.then(()=>true),Bun.sleep(5000).then(()=>false)]);
 if(!finished){child.kill();await child.exited;}
 const checked=await realpath(ownedProfile);
 if(checked!==ownedProfile||!checked.startsWith(tempReal+sep)||!checked.split(sep).at(-1)?.startsWith('capture-'))throw new Error('Refusing profile cleanup outside owned target');
 await rm(checked,{recursive:true,force:true,maxRetries:2,retryDelay:100});
 console.log('Owned temporary browser profile removed; live app untouched.');
}
if(allResults.some(r=>r.errors.length||r.remoteRequests.length||r.initial.images.length||r.initial.scrollWidth>1440||(!overview&&(r.initial.state!=='initial'||r.changed!=='changed'||r.reset!=='initial'))))throw new Error('One or more prototype acceptance checks failed; screenshots and receipt preserved');
