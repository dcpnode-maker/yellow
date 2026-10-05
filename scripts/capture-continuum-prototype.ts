/** Approval-only visual fixture. Serves four exact local assets, never the application or a database. */
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const repository = resolve(import.meta.dir, '..');
const prototype = resolve(repository, 'docs/design/prototypes/continuum');
const output = resolve(repository, '.yellow/evidence/continuum-prototype/luminous');
await mkdir(output, { recursive: true });
const browser = [
  process.env.PROGRAMFILES && resolve(process.env.PROGRAMFILES, 'Google/Chrome/Application/chrome.exe'),
  process.env['PROGRAMFILES(X86)'] && resolve(process.env['PROGRAMFILES(X86)'], 'Microsoft/Edge/Application/msedge.exe'),
  Bun.which('chromium'),
].find((path): path is string => Boolean(path && existsSync(path)));
if (!browser) throw new Error('An installed Chromium browser is required; no browser is downloaded.');

const files: Record<string, [string, string]> = {
  '/': [resolve(prototype, 'index.html'), 'text/html; charset=utf-8'],
  '/continuum.css': [resolve(prototype, 'continuum.css'), 'text/css'],
  '/continuum.js': [resolve(prototype, 'continuum.js'), 'text/javascript'],
  '/prototype/urbanist.woff2': [resolve(repository, 'src/http/operator/vendor/urbanist-v1.330/Urbanist[ital,wght].woff2'), 'font/woff2'],
};
const requests: string[] = [];
const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch(request) {
  const path = new URL(request.url).pathname;
  requests.push(path);
  if (request.method !== 'GET' || !files[path]) return new Response('Prototype asset not found', { status: 404 });
  return new Response(Bun.file(files[path][0]), { headers: {
    'content-type': files[path][1], 'cache-control': 'no-store',
    'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  } });
} });
const profile = resolve(output, 'capture-profile-'+Date.now());
const chrome = Bun.spawn([browser, '--headless=new', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0', '--disable-background-networking',
  `--user-data-dir=${profile}`, 'about:blank'], { stdout: 'ignore', stderr: 'ignore' });
let socket: WebSocket | undefined;
let nextId = 0;
const pending = new Map<number, { resolve: (value: any) => void; reject: (reason: Error) => void; timer: ReturnType<typeof setTimeout> }>();
const errors: unknown[] = [];
const audit: unknown[] = [];
const film: { data:string; at:number }[] = [];
let recording = false;
async function send(method: string, params: Record<string, unknown> = {}): Promise<any> {
  return new Promise((resolveCommand, reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('CDP timeout: '+method)); }, 8000);
    pending.set(id, { resolve: resolveCommand, reject, timer });
    socket!.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression: string): Promise<any> {
  const value = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (value.exceptionDetails) throw new Error(JSON.stringify(value.exceptionDetails));
  return value.result?.value;
}
async function screenshot(name: string) {
  const value = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await Bun.write(resolve(output, name), Buffer.from(value.data, 'base64'));
  console.log('Captured '+name);
}
async function resize(width: number, height: number) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 });
}
async function click(selector: string) {
  const hit = await evaluate(`(() => {
    const node=document.querySelector(${JSON.stringify(selector)});
    if(!node)throw new Error('Missing prototype control');
    node.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});
    const r=node.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;
    const at=document.elementFromPoint(x,y);
    return {x,y,usable:r.width>0&&r.height>0&&(node===at||node.contains(at))};
  })()`);
  if (!hit.usable) throw new Error('Prototype control is not hit-testable: '+selector);
  await send('Input.dispatchMouseEvent', { type:'mouseMoved',x:hit.x,y:hit.y });
  await send('Input.dispatchMouseEvent', { type:'mousePressed',x:hit.x,y:hit.y,button:'left',clickCount:1 });
  await send('Input.dispatchMouseEvent', { type:'mouseReleased',x:hit.x,y:hit.y,button:'left',clickCount:1 });
}
async function inspect(name: string) {
  const value = await evaluate(`({ name: ${JSON.stringify(name)}, width: innerWidth, height: innerHeight,
    overflow: document.documentElement.scrollWidth > innerWidth + 1,
    state: window.continuumPrototype.state,
    fontLoaded: document.fonts.check('16px Urbanist'),
    headingOverlap: (()=>{ const s=window.continuumPrototype.state.scene;
      const a=document.querySelector('#hero-copy').getBoundingClientRect();
      const b=document.querySelector(s==='guest'?'.guest-form':s==='rooms'?'.roomfield-header':'.scene-arrival .guest-queue')?.getBoundingClientRect();
      return (s==='guest'||s==='rooms')&&Boolean(b&&a.height&&a.bottom>b.top-4); })(),
    croppedRooms: (()=>{ if(innerWidth<721||window.continuumPrototype.state.scene!=='rooms')return[];
      const p=document.querySelector('.stage-shell').getBoundingClientRect();
      return [...document.querySelectorAll('[data-room]')].filter(n=>{const r=n.getBoundingClientRect();return r.left<p.left||r.right>p.right||r.bottom>p.bottom}).map(n=>n.dataset.room); })(),
    primary: (() => { const r=document.querySelector('#next-step').getBoundingClientRect(); return {text:document.querySelector('#next-step').textContent,x:r.x,y:r.y,width:r.width,height:r.height, visible:r.bottom<=innerHeight&&r.right<=innerWidth}; })(),
    externalResources: performance.getEntriesByType('resource').filter(e=>new URL(e.name).origin !== location.origin).map(e=>e.name)
  })`);
  audit.push(value);
  if (value.overflow || value.externalResources.length || !value.fontLoaded || !value.primary.visible || value.headingOverlap || value.croppedRooms.length) throw new Error('Prototype containment/resource/control check failed: '+JSON.stringify(value));
}
async function fill(selector: string, value: string) {
  await click(selector);
  await send('Input.dispatchKeyEvent', { type:'keyDown',key:'a',code:'KeyA',modifiers:2 });
  await send('Input.dispatchKeyEvent', { type:'keyUp',key:'a',code:'KeyA',modifiers:2 });
  await send('Input.insertText', { text:value });
}

try {
  let port = '';
  for (let i=0; i<400; i++) {
    try { port = (await Bun.file(resolve(profile, 'DevToolsActivePort')).text()).split(/\r?\n/)[0] ?? ''; }
    catch (error) { if (!['ENOENT','EBUSY'].includes(String((error as { code?: string }).code))) throw error; }
    if (port) break;
    if (chrome.exitCode !== null) throw new Error('Owned browser exited before capture.');
    await Bun.sleep(25);
  }
  if (!port) throw new Error('Owned browser did not start within 10 seconds.');
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json() as { webSocketDebuggerUrl: string };
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise<void>((ready, reject) => { socket!.addEventListener('open', () => ready(), { once: true }); socket!.addEventListener('error', () => reject(new Error('CDP socket failed')), { once: true }); });
  socket.addEventListener('message', event => {
    const value = JSON.parse(String(event.data));
    if (value.method === 'Runtime.exceptionThrown') errors.push(value.params);
    if (value.method === 'Page.screencastFrame') {
      if (recording && film.length < 600) film.push({ data:value.params.data, at:performance.now() });
      // Acknowledge immediately; synchronous PNG requests would throttle the actual animation.
      socket!.send(JSON.stringify({ id:++nextId, method:'Page.screencastFrameAck', params:{ sessionId:value.params.sessionId } }));
    }
    if (!value.id) return;
    const command = pending.get(value.id); if (!command) return;
    pending.delete(value.id); clearTimeout(command.timer);
    if (value.error) command.reject(new Error(JSON.stringify(value.error))); else command.resolve(value.result);
  });
  await send('Page.enable'); await send('Runtime.enable');
  await resize(1440, 900);
  await send('Page.navigate', { url: `http://127.0.0.1:${server.port}/` });
  for (let i=0; i<100; i++) {
    if (await evaluate('Boolean(window.continuumPrototype)')) break;
    if (i===99) throw new Error('Prototype did not initialize: '+JSON.stringify(errors));
    await Bun.sleep(30);
  }
  await evaluate('document.fonts.ready.then(()=>true)');
  await Bun.sleep(500);
  for (const scene of ['arrival','guest','rooms','review','handoff']) {
    await click(`[data-step="${scene}"]`); await Bun.sleep(500);
    await inspect('desktop-'+scene); await screenshot('desktop-'+scene+'.png');
  }
  await click('[data-step="guest"]');
  await fill('#guest-email','priya@example.invalid');
  await fill('#guest-phone','+91 00000 00000');
  await click('#save-guest-draft');
  await click('[data-step="rooms"]'); await click('#back-step');
  if ((await evaluate('document.querySelector("#guest-email").value'))!=='priya@example.invalid') throw new Error('Guest draft lost across scene navigation.');
  await click('#demo-id-capture'); await Bun.sleep(200);
  await screenshot('desktop-id-review.png');
  await click('#confirm-id');
  if (!(await evaluate('document.querySelector("#id-review").open')) || (await evaluate('window.continuumPrototype.state.sampleIdentityReviewed'))) throw new Error('Sample ID bypassed staff confirmation.');
  await click('#id-review-confirm'); await click('#confirm-id'); await click('#save-guest-draft');
  const draftProof=await evaluate('window.continuumPrototype.state');
  if (!draftProof.sampleIdentityReviewed || draftProof.guestDraft.nationality!=='India') throw new Error('Reviewed synthetic fields not copied to editable draft.');
  audit.push({ sampleGuestEditing:draftProof, noCameraOrNetwork:true });
  await click('[data-step="rooms"]'); await click('#run-checks'); await Bun.sleep(900);
  await screenshot('desktop-processing.png');
  await Bun.sleep(2000);
  if ((await evaluate('window.continuumPrototype.state.checksRunning')) || !(await evaluate('document.querySelector("#check-list").textContent.includes("8 sample rooms checked")'))) throw new Error('Sample processing sequence did not finish.');
  await inspect('desktop-checks-complete'); await screenshot('desktop-checks-complete.png');
  await click('#run-checks'); await Bun.sleep(120); await click('#run-checks');
  await Bun.sleep(700);
  if (await evaluate('window.continuumPrototype.state.checksRunning')) throw new Error('Check replay did not stop.');
  audit.push({ sampleChecks:true, interrupted:true, exhaustiveClaim:false });
  // Back/forward and an unavailable alternative must retain meaningful state.
  await click('[data-step="rooms"]'); await click('[data-room="607"]');
  if (!(await evaluate('document.querySelector("#next-step").disabled'))) throw new Error('Unready sample room incorrectly advances.');
  await click('[data-room="610"]'); await click('#next-step'); await click('#back-step');
  if ((await evaluate('window.continuumPrototype.state.selectedRoom')) !== '610') throw new Error('Room selection was lost on back.');
  await click('[data-room="608"]');
  for (const [width,height,device] of [[1024, 768, 'tablet'], [390,844,'phone']] as const) {
    await resize(width,height);
    for (const scene of ['arrival','guest','rooms','review']) {
      await click(`[data-step="${scene}"]`); await Bun.sleep(450);
      await evaluate('window.scrollTo(0,0)'); await inspect(device+'-'+scene); await screenshot(device+'-'+scene+'.png');
    }
  }
  await click('[data-step="guest"]'); await click('#demo-id-capture'); await Bun.sleep(180);
  await screenshot('phone-id-review.png'); await click('#close-id');
  // Capture a real focused button and reduced-motion version, not just source assertions.
  await send('Emulation.setEmulatedMedia', { features: [{ name:'prefers-reduced-motion', value:'reduce' }] });
  await click('[data-step="rooms"]'); await evaluate('document.querySelector("#next-step").focus()');
  await Bun.sleep(180); await inspect('phone-reduced-motion'); await screenshot('phone-reduced-motion.png');
  await send('Emulation.setEmulatedMedia', { features: [{ name:'prefers-reduced-motion', value:'no-preference' }] });
  if (!Bun.argv.includes('--stills')) {
    await resize(1280,800);
    const frames = resolve(output, 'screencast'); await mkdir(frames, { recursive: true });
    await click('[data-step="arrival"]'); await Bun.sleep(500);
    const changes: [number,string][] = [[1400,'[data-step="guest"]'],[3200,'#demo-id-capture'],
      [5300,'#id-review-confirm'],[5600,'#confirm-id'],[5900,'#save-guest-draft'],[6900,'[data-step="rooms"]'],
      [7600,'#run-checks'],[11000,'[data-room="610"]'],[12700,'#next-step'],[15100,'#next-step']];
    const started = performance.now();
    recording = true;
    await send('Page.startScreencast', { format:'jpeg',quality:85,maxWidth:1280,maxHeight:800,everyNthFrame:1 });
    for (const [at, selector] of changes) {
      if (performance.now()<started+at) await Bun.sleep(started+at-performance.now());
      await click(selector);
      audit.push({ animationAction:selector, atMs:Math.round(performance.now()-started), state:await evaluate('window.continuumPrototype.state') });
    }
    if (performance.now()<started+17700) await Bun.sleep(started+17700-performance.now());
    await send('Page.stopScreencast'); recording = false;
    const elapsed = Math.round(performance.now()-started);
    if (film.length<15 || film.length>=600) throw new Error('Unexpected screencast frame count: '+film.length);
    const manifest: string[] = [];
    for (let index=0; index<film.length; index++) {
      const name=String(index).padStart(4,'0')+'.jpeg';
      await Bun.write(resolve(frames,name),Buffer.from(film[index]!.data,'base64'));
      const duration=Math.max(.01,((film[index+1]?.at ?? started+elapsed)-film[index]!.at)/1000);
      manifest.push(`file '${name}'`, `duration ${duration.toFixed(6)}`);
    }
    manifest.push(`file '${String(film.length-1).padStart(4,'0')}.jpeg'`);
    await Bun.write(resolve(frames,'timing.txt'),manifest.join('\n')+'\n');
    audit.push({ animation: { frames:film.length, method:'Chrome screencast; real arrival timestamps',
      elapsedMs:elapsed, expectedMs:17700, presentationFps:20, timeCompressed:false } });
    const ffmpeg = Bun.which('ffmpeg');
    if (!ffmpeg) throw new Error('FFmpeg was not found; no encoder will be installed.');
    const encoder = Bun.spawn([ffmpeg,'-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',resolve(frames,'timing.txt'),
      '-filter_complex','[0:v]fps=20,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3',
      '-loop','0',resolve(output,'continuum-journey.gif')], { stdout:'ignore',stderr:'pipe' });
    const encoderError = await new Response(encoder.stderr).text();
    if (await encoder.exited) throw new Error('FFmpeg failed: '+encoderError);
    console.log('Captured continuum-journey.gif');
  }
  if (errors.length) throw new Error('Browser runtime errors: '+JSON.stringify(errors));
  await Bun.write(resolve(output, 'capture-proof.json'), JSON.stringify({ capturedAt:new Date().toISOString(), fictional:true,
    liveAppTouched:false, browserPid:chrome.pid, profile, requests:[...new Set(requests)], audit, errors }, null, 2)+'\n');
  console.log(JSON.stringify({ output, checks:audit.length, errors:errors.length, profile }));
} finally {
  // Close this owned browser only. Profile removal is a separate, exact-target PowerShell cleanup.
  if (socket?.readyState===WebSocket.OPEN) { try { await send('Browser.close'); } catch {} }
  socket?.close();
  for (const command of pending.values()) { clearTimeout(command.timer); command.reject(new Error('Capture closed')); }
  pending.clear();
  if (chrome.exitCode===null) chrome.kill();
  await chrome.exited;
  await server.stop(true);
}
