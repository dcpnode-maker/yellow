import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, resolve } from "node:path";

import { runOwnedProofProcess } from "./helpers/owned-proof-process";

const repository = resolve(import.meta.dir, "..");
const browser = [
  process.env.PROGRAMFILES && resolve(process.env.PROGRAMFILES, "Google/Chrome/Application/chrome.exe"),
  process.env["PROGRAMFILES(X86)"] && resolve(process.env["PROGRAMFILES(X86)"], "Google/Chrome/Application/chrome.exe"),
  process.env.LOCALAPPDATA && resolve(process.env.LOCALAPPDATA, "Google/Chrome/Application/chrome.exe"),
  process.env.PROGRAMFILES && resolve(process.env.PROGRAMFILES, "Microsoft/Edge/Application/msedge.exe"),
  Bun.which("google-chrome"), Bun.which("chromium"), Bun.which("chromium-browser"),
].find((candidate): candidate is string => Boolean(candidate && existsSync(candidate)));

const uuid = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
const addCalendarDays = (value: string, offset: number) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
};

async function withCdp<T>(url: string, profile: string, run: (send: <R>(method: string, params?: Record<string, unknown>) => Promise<R>) => Promise<T>): Promise<T> {
  if (!browser) throw new Error("Chrome or Edge is required for the Order469 browser proof");
  const chrome = Bun.spawn([browser, "--headless=new", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage", "--no-first-run", "--no-default-browser-check",
    "--remote-debugging-address=127.0.0.1", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { stdout: "ignore", stderr: "ignore" });
  try {
    const portFile = resolve(profile, "DevToolsActivePort"); let port = "";
    for (let attempt = 0; attempt < 800; attempt += 1) {
      try { if (existsSync(portFile)) port = (await Bun.file(portFile).text()).split(/\r?\n/, 1)[0] ?? ""; } catch { /* profile handoff may briefly race */ }
      if (port || chrome.exitCode !== null) break;
      await Bun.sleep(25);
    }
    if (!port) throw new Error(`Chromium did not expose a DevTools port (exit ${chrome.exitCode ?? "unknown"})`);
    const response = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: "PUT" });
    if (!response.ok) throw new Error(`Chromium target creation failed (${response.status})`);
    const target = await response.json() as { webSocketDebuggerUrl?: string };
    if (!target.webSocketDebuggerUrl) throw new Error("Chromium target has no debugger endpoint");
    const socket = new WebSocket(target.webSocketDebuggerUrl); let nextId = 0;
    const pending = new Map<number, { resolve: (value: unknown) => void; reject: (reason: Error) => void }>();
    await new Promise<void>((resolveOpen, rejectOpen) => {
      socket.addEventListener("open", () => resolveOpen(), { once: true });
      socket.addEventListener("error", () => rejectOpen(new Error("Chromium debugger socket failed")), { once: true });
      socket.addEventListener("message", event => {
        const message = JSON.parse(String(event.data)) as { id?: number; result?: unknown; error?: { message?: string } };
        if (!message.id) return; const command = pending.get(message.id); if (!command) return; pending.delete(message.id);
        if (message.error) command.reject(new Error(message.error.message ?? "Chromium command failed")); else command.resolve(message.result);
      });
    });
    const send = <R>(method: string, params: Record<string, unknown> = {}) => new Promise<R>((resolveCommand, rejectCommand) => {
      nextId += 1; pending.set(nextId, { resolve: value => resolveCommand(value as R), reject: rejectCommand });
      socket.send(JSON.stringify({ id: nextId, method, params }));
    });
    try { return await run(send); } finally { socket.close(); }
  } finally {
    if (chrome.exitCode === null) chrome.kill();
    await chrome.exited;
  }
}

function page(): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/assets/operator.css"></head>
<body><main id="root" class="invoice-workbench"></main><pre id="proof"></pre><script type="module">
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const propertyA=id(2),propertyB=id(3),original=id(110),hostile='C/<img src=x onerror="globalThis.registerInjected=true">';
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const day=(value,offset)=>{const date=new Date(value+'T00:00:00.000Z');date.setUTCDate(date.getUTCDate()+offset);return date.toISOString().slice(0,10)};
const creditOne=day(today,-1),creditTwo=day(today,-2),creditThree=day(today,-3),creditSlow=day(today,-4);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const until=async(predicate,label,timeout=2800)=>{const end=performance.now()+timeout;while(performance.now()<end){if(predicate())return;await sleep(8)}throw new Error('timed out waiting for '+label)};
const row=(n,date,property=propertyA)=>({documentId:id(n),originalDocumentId:id(n+100),docNo:'C/2044/'+n,originalDocNo:'I/2044/'+n,businessDate:date,propertyNode:property,currency:'INR',totalMinor:'11800',sha256:n.toString(16).padStart(2,'0').repeat(32)});
const invoice=(documentId,property)=>({kind:'india_native_invoice_v1',documentId,propertyNode:property,reservationId:id(4),folioId:id(5),seriesId:id(6),documentNumber:'I/2044/121',businessDate:'2044-09-07',issuedAt:'2044-09-07T10:00:00.000001Z',recipientRegistrationId:id(7),sourceEvidenceHash:'a'.repeat(64),documentSha256:'b'.repeat(64),previousHash:null,contentJson:'{}'});
const calls=[],navigations=[];let scenario='success',workbench;
const request=async(path,options={})=>{const method=options.method||'GET';calls.push({scenario,path,method,body:options.body??null});
  if(path.endsWith('/invoices/search'))return {invoices:{items:[],matchingCount:'0',nextCursor:null}};
  if(path.endsWith('/receipt'))return {delivery:{kind:'not_requested',documentId:path.split('/').at(-2)}};
  const invoiceMatch=path.match(/\\/invoices\\/([0-9a-f-]{36})$/);if(invoiceMatch)return {invoice:invoice(invoiceMatch[1],new URL('http://yellow.test'+path).pathname.includes(propertyB)?propertyB:propertyA)};
  if(!path.includes('/credit-notes?'))throw new Error('unexpected request '+method+' '+path);
  const url=new URL('http://yellow.test'+path),property=url.pathname.split('/')[4],after=url.searchParams.get('after'),docNo=url.searchParams.get('docNo');
  if(scenario==='slow'){await sleep(220);return {items:[row(66,creditSlow,property)],nextCursor:null}};
  if(scenario==='permission')throw Object.assign(new Error('forbidden'),{status:403});
  if(scenario==='invalid-filter')throw Object.assign(new Error('bad request'),{status:400});
  if(scenario==='missing')throw Object.assign(new Error('missing'),{status:404});
  if(scenario==='offline')throw Object.assign(new Error('offline'),{status:503});
  if(scenario==='malformed')return {items:[{...row(67,creditSlow,property),extra:true}],nextCursor:null};
  if(scenario==='hostile')return {items:[{...row(68,creditSlow,property),docNo:hostile}],nextCursor:null};
  if(scenario==='empty')return {items:[],nextCursor:null};
  if(scenario==='overlap')return after?{items:[row(71,creditOne,property)],nextCursor:'cursor-overlap'}:{items:[row(71,creditOne,property)],nextCursor:'cursor-overlap'};
  if(docNo)return {items:[row(26,creditThree,property)],nextCursor:null};
  if(after==='cursor-one')return {items:[row(19,creditThree,property)],nextCursor:null};
  return {items:[row(21,creditOne,property),row(20,creditTwo,property)],nextCursor:'cursor-one'};
};
const {createInvoiceWorkbench}=await import('/assets/operator-invoices.js');const root=document.querySelector('#root');
const intent=()=>root.querySelector('.invoice-workbench__credit-register-intent');const form=()=>root.querySelector('.invoice-workbench__credit-register-search');const number=()=>root.querySelector('.invoice-workbench__credit-register-number');const dates=()=>[...root.querySelectorAll('.invoice-workbench__credit-register-date')];const rows=()=>[...root.querySelectorAll('.invoice-workbench__credit-register-row')];const more=()=>root.querySelector('.invoice-workbench__credit-register-more');const status=()=>root.querySelector('.invoice-workbench__credit-register-status');
const listCalls=tag=>calls.filter(call=>call.scenario===tag&&call.path.includes('/credit-notes?'));
const mount=async(next='success',property=propertyA)=>{workbench?.dispose();root.hidden=false;scenario=next;workbench=createInvoiceWorkbench({root,request,propertyNode:property,timezone:'Asia/Kolkata',navigate:documentId=>{navigations.push(documentId);return documentId===null?workbench.show(null):workbench.show(documentId)}});await workbench.show(null)};
const open=async()=>{intent().click();await until(()=>status()?.textContent!=='Loading credit notes…','credit register')};
const waitStatus=async(text)=>await until(()=>status()?.textContent.includes(text),text);
const visible=value=>Boolean(value&&value.isConnected&&!value.hidden&&getComputedStyle(value).display!=='none'&&value.getClientRects().length);
const proof={viewport:innerWidth};
try { await mount();proof.initial={button:intent()?.textContent,registerCalls:listCalls('success').length,invoiceView:root.dataset.invoiceView};
  await open();root.dispatchEvent(new KeyboardEvent('keydown',{key:'/',bubbles:true,cancelable:true}));const first=listCalls('success')[0],firstUrl=new URL('http://yellow.test'+first.path);proof.deliberate={method:first.method,body:first.body,issuedFrom:firstUrl.searchParams.get('issuedFrom'),issuedBefore:firstUrl.searchParams.get('issuedBefore'),limit:firstUrl.searchParams.get('limit'),docNo:firstUrl.searchParams.has('docNo'),keys:[...firstUrl.searchParams.keys()].sort(),timezoneToday:today,rows:rows().length,labels:rows()[0]?.textContent,more:!more().hidden,keyboard:document.activeElement===number()&&visible(number())};
  more().click();await until(()=>rows().length===3,'second credit page');const pageCalls=listCalls('success'),pageUrl=new URL('http://yellow.test'+pageCalls[1].path);proof.paging={calls:pageCalls.length,after:pageUrl.searchParams.get('after'),keys:[...pageUrl.searchParams.keys()].sort(),body:pageCalls[1].body,rows:rows().map(value=>value.querySelector('.invoice-workbench__credit-register-number')?.textContent),moreHidden:more().hidden};
  const staleReview=root.querySelector('.invoice-workbench__credit-register-review'),[from,before]=dates();number().value='C/2044/26';from.value=day(today,-30);before.value=day(today,1);for(const field of [number(),from,before])field.dispatchEvent(new Event('input',{bubbles:true}));const navigationBeforeDraft=navigations.length;staleReview.click();await sleep(20);const beforeSubmit=listCalls('success').length;proof.draft={rows:rows().length,status:status().textContent,calls:listCalls('success').length-beforeSubmit,navigation:navigations.length-navigationBeforeDraft};form().dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await until(()=>rows().length===1,'filtered credit page');const filtered=listCalls('success').at(-1),filteredUrl=new URL('http://yellow.test'+filtered.path);proof.filter={docNo:filteredUrl.searchParams.get('docNo'),from:filteredUrl.searchParams.get('issuedFrom'),before:filteredUrl.searchParams.get('issuedBefore'),after:filteredUrl.searchParams.get('after'),keys:[...filteredUrl.searchParams.keys()].sort(),rows:rows().map(value=>value.textContent)};
  number().value='not valid?';number().dispatchEvent(new Event('input',{bubbles:true}));const callsBeforeInvalid=listCalls('success').length;form().dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));proof.invalid={calls:listCalls('success').length-callsBeforeInvalid,status:status().textContent};
  await mount('empty');await open();proof.empty={rows:rows().length,status:status().textContent};
  const errors={};for(const kind of ['permission','invalid-filter','missing','offline','malformed','hostile']){await mount(kind);await open();errors[kind]={rows:rows().length,status:status().textContent,img:root.querySelectorAll('img').length,injected:globalThis.registerInjected===true}}proof.errors=errors;
  await mount('success');await open();const review=root.querySelector('.invoice-workbench__credit-register-review');review.click();await until(()=>root.dataset.invoiceView==='detail','original invoice detail');const navigationBeforeRetained=navigations.length;review.click();await sleep(20);proof.review={navigation:navigations.at(-1),retainedNavigation:navigations.length-navigationBeforeRetained,view:root.dataset.invoiceView,creditHidden:root.querySelector('.invoice-workbench__credit-register')?.hidden,detailVisible:visible(root.querySelector('.invoice-workbench__detail-heading'))&&visible(root.querySelector('.invoice-workbench__layout')),creditDocument:calls.filter(call=>/\\/credit-notes\\/[^?]+\\/(document|delivery)$/.test(call.path)).length,frames:root.querySelectorAll('.invoice-workbench__print-frame').length};
  await mount('slow');intent().click();await sleep(12);number().value='C/2044/66';number().dispatchEvent(new Event('input',{bubbles:true}));await sleep(260);proof.draftStale={rows:rows().length,status:status().textContent,late:root.textContent.includes('C/2044/66')};
  await mount('slow');intent().click();await sleep(12);root.querySelector('.invoice-workbench__credit-register-back').click();await sleep(260);proof.modeStale={view:root.dataset.invoiceView,creditHidden:root.querySelector('.invoice-workbench__credit-register')?.hidden,late:root.textContent.includes('C/2044/66')};
  await mount('slow');const suspendedIntent=intent();suspendedIntent.click();await sleep(12);workbench.suspend();const callsBeforeSuspendedIntent=listCalls('slow').length;suspendedIntent.click();await sleep(260);proof.suspend={hidden:root.hidden,state:root.dataset.invoiceState,late:root.textContent.includes('C/2044/66'),calls:listCalls('slow').length-callsBeforeSuspendedIntent};
  await mount('slow');const disposedIntent=intent();disposedIntent.click();await sleep(12);workbench.dispose();const callsBeforeDisposedIntent=listCalls('slow').length;disposedIntent.click();await sleep(260);proof.dispose={hidden:root.hidden,state:root.dataset.invoiceState,children:root.children.length,late:root.textContent.includes('C/2044/66'),calls:listCalls('slow').length-callsBeforeDisposedIntent};
  await mount('slow');const detachedForm=form();intent().click();await sleep(12);root.remove();const callsBeforeDetachedSubmit=listCalls('slow').length;detachedForm.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await sleep(30);proof.detached={connected:root.isConnected,calls:listCalls('slow').length-callsBeforeDetachedSubmit};document.body.append(root);workbench.dispose();await sleep(260);
  await mount('slow');intent().click();await sleep(12);await mount('success',propertyB);await open();await sleep(260);proof.property={rows:rows().length,property:root.querySelector('.invoice-workbench__credit-register-row')?.textContent.includes('C/2044/21'),old:root.textContent.includes('C/2044/66')};
  await mount('overlap');await open();more().click();await until(()=>status()?.textContent!=='Loading credit notes…','overlap page');proof.overlap={rows:rows().length,status:status().textContent,more:more().hidden};
  proof.boundary={methods:calls.filter(call=>call.path.includes('/credit-notes')).map(call=>call.method),bodies:calls.filter(call=>call.path.includes('/credit-notes')).map(call=>call.body),fullReads:calls.filter(call=>/\\/credit-notes\\/[^?]+\\/(document|delivery)$/.test(call.path)).length,prints:root.querySelectorAll('iframe').length,providers:calls.filter(call=>call.path.includes('provider')||call.path.includes('fiscal-submissions')).length,localStorage:localStorage.length,sessionStorage:sessionStorage.length,overflow:Math.max(document.documentElement.scrollWidth,root.scrollWidth)-innerWidth};
} catch(error) { proof.driverError=String(error?.stack||error) }
document.querySelector('#proof').textContent=JSON.stringify(proof);
</script></body></html>`;
}

test("Order469 credit-note register is deliberate, bounded and lifecycle-safe in Chromium", async () => {
  if (!browser) throw new Error("Chrome or Edge is required for the Order469 browser proof");
  const server = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === "/") return new Response(page(), { headers: { "content-type": "text/html; charset=utf-8" } });
    const assets: Record<string, string> = {
      "/assets/operator-invoices.js": "src/http/operator/invoices.js",
      "/assets/operator.css": "src/http/operator/operator.css",
      "/assets/operator-invoice-print.js": "src/http/operator/invoice-print.js",
      "/assets/vendor/qrcodegen-v1.8.0-es6.js": "src/http/operator/vendor/qrcodegen-v1.8.0-es6.js",
    };
    const asset = assets[path];
    return asset ? new Response(Bun.file(resolve(repository, asset)), { headers: { "content-type": asset.endsWith(".css") ? "text/css; charset=utf-8" : "text/javascript; charset=utf-8" } }) : new Response("not found", { status: 404 });
  } });
  const directory = await mkdtemp(resolve(tmpdir(), "yellow-order469-credit-register-"));
  try {
    for (const width of [1280]) {
      const result = await runOwnedProofProcess([browser, "--headless=new", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage", "--no-first-run", "--no-default-browser-check", `--user-data-dir=${resolve(directory, `profile-${width}`)}`, `--window-size=${width},900`, "--virtual-time-budget=9000", "--dump-dom", `http://127.0.0.1:${server.port}/`], { timeoutMs: 26_000 });
      expect(result.exitCode, result.stderr.slice(-1_000)).toBe(0);
      const encoded = result.stdout.match(/<pre id="proof">([^<]+)<\/pre>/)?.[1];
      if (!encoded) throw new Error(`Order469 browser proof did not complete: ${result.stderr.slice(-1_000)} ${result.stdout.slice(-1_000)}`);
      const proof = JSON.parse(encoded.replaceAll("&quot;", '"').replaceAll("&amp;", "&"));
      expect(proof.driverError).toBeUndefined();
      expect(proof.initial).toEqual({ button: "Credit notes", registerCalls: 0, invoiceView: "queue" });
      expect(proof.deliberate).toMatchObject({ method: "GET", body: null, limit: "25", docNo: false, keys: ["issuedBefore", "issuedFrom", "limit"], rows: 2, more: true, keyboard: true });
      expect(proof.deliberate.issuedFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(proof.deliberate.issuedBefore).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(proof.deliberate.issuedFrom).toBe(addCalendarDays(proof.deliberate.timezoneToday, -30));
      expect(proof.deliberate.issuedBefore).toBe(addCalendarDays(proof.deliberate.timezoneToday, 1));
      expect((Date.parse(`${proof.deliberate.issuedBefore}T00:00:00.000Z`) - Date.parse(`${proof.deliberate.issuedFrom}T00:00:00.000Z`)) / 86_400_000).toBe(31);
      expect(proof.deliberate.labels).toContain("C/2044/21");
      expect(proof.deliberate.labels).toContain("Original I/2044/21");
      expect(proof.paging).toEqual({ calls: 2, after: "cursor-one", keys: ["after", "issuedBefore", "issuedFrom", "limit"], body: null, rows: ["C/2044/21", "C/2044/20", "C/2044/19"], moreHidden: true });
      expect(proof.draft).toEqual({ rows: 0, status: "Draft filters changed; search again.", calls: 0, navigation: 0 });
      expect(proof.filter).toMatchObject({ docNo: "C/2044/26", after: null, keys: ["docNo", "issuedBefore", "issuedFrom", "limit"] });
      expect(proof.filter.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(proof.filter.before).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(proof.filter.rows).toHaveLength(1);
      expect(proof.filter.rows[0]).toContain("C/2044/26");
      expect(proof.invalid).toEqual({ calls: 0, status: "Choose valid credit number and date filters." });
      expect(proof.empty).toEqual({ rows: 0, status: "No issued credit notes match these filters." });
      expect(proof.errors.permission).toMatchObject({ rows: 0, img: 0, injected: false });
      expect(proof.errors.permission.status.toLowerCase()).toContain("permission");
      expect(proof.errors["invalid-filter"].status.toLowerCase()).toContain("invalid");
      expect(proof.errors.missing.status.toLowerCase()).toContain("unavailable");
      expect(proof.errors.offline.status.toLowerCase()).toContain("offline");
      for (const kind of ["malformed", "hostile"]) { expect(proof.errors[kind]).toMatchObject({ rows: 0, img: 0, injected: false }); expect(proof.errors[kind].status.toLowerCase()).toContain("invalid"); }
      expect(proof.review).toEqual({ navigation: uuid(121), retainedNavigation: 0, view: "detail", creditHidden: true, detailVisible: true, creditDocument: 0, frames: 0 });
      expect(proof.draftStale).toEqual({ rows: 0, status: "Draft filters changed; search again.", late: false });
      expect(proof.modeStale).toEqual({ view: "queue", creditHidden: true, late: false });
      expect(proof.suspend).toEqual({ hidden: true, state: "suspended", late: false, calls: 0 });
      expect(proof.dispose).toEqual({ hidden: true, state: "disposed", children: 0, late: false, calls: 0 });
      expect(proof.detached).toEqual({ connected: false, calls: 0 });
      expect(proof.property).toEqual({ rows: 2, property: true, old: false });
      expect(proof.overlap.rows).toBe(0);
      expect(proof.overlap.status.toLowerCase()).toContain("invalid");
      expect(proof.boundary.methods.every((method: string) => method === "GET")).toBe(true);
      expect(proof.boundary.bodies.every((body: unknown) => body === null)).toBe(true);
      expect(proof.boundary).toMatchObject({ fullReads: 0, prints: 0, providers: 0, localStorage: 0, sessionStorage: 0 });
    }
    const mobile = await withCdp(`http://127.0.0.1:${server.port}/`, resolve(directory, "profile-390-cdp"), async send => {
      await send("Page.enable"); await send("Runtime.enable");
      await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 900, deviceScaleFactor: 1, mobile: true, screenWidth: 390, screenHeight: 900 });
      await send("Page.navigate", { url: `http://127.0.0.1:${server.port}/` });
      for (let attempt = 0; attempt < 700; attempt += 1) {
        const result = await send<{ result?: { value?: string } }>("Runtime.evaluate", { expression: "document.querySelector('#proof')?.textContent || ''", returnByValue: true });
        if (result.result?.value?.startsWith("{")) return JSON.parse(result.result.value) as { driverError?: string; viewport: number; deliberate: { rows: number; keyboard: boolean }; paging: { rows: string[] }; filter: { docNo: string }; review: { detailVisible: boolean }; draftStale: { late: boolean }; suspend: { calls: number }; dispose: { calls: number }; detached: { calls: number }; property: { rows: number; old: boolean }; boundary: { overflow: number; fullReads: number; prints: number } };
        await Bun.sleep(20);
      }
      throw new Error("Order469 mobile proof did not finish");
    });
    expect(mobile.driverError).toBeUndefined();
    expect(mobile.viewport).toBe(390);
    expect(mobile.boundary.overflow).toBeLessThanOrEqual(0);
    expect(mobile.deliberate).toMatchObject({ rows: 2, keyboard: true });
    expect(mobile.paging.rows).toEqual(["C/2044/21", "C/2044/20", "C/2044/19"]);
    expect(mobile.filter.docNo).toBe("C/2044/26");
    expect(mobile.review.detailVisible).toBe(true);
    expect(mobile.draftStale.late).toBe(false);
    expect(mobile.suspend.calls).toBe(0);
    expect(mobile.dispose.calls).toBe(0);
    expect(mobile.detached.calls).toBe(0);
    expect(mobile.property).toMatchObject({ rows: 2, old: false });
    expect(mobile.boundary).toMatchObject({ fullReads: 0, prints: 0 });
  } finally {
    server.stop(true);
    const owned = resolve(directory);
    if (dirname(owned) !== resolve(tmpdir()) || !basename(owned).startsWith("yellow-order469-credit-register-")) throw new Error("Order469 profile containment changed");
    await rm(owned, { recursive: true, force: true });
  }
}, 60_000);
