import { expect, test } from "bun:test";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { resolveChromiumPath } from "./helpers/chromium-path";
import { fetchJsonBounded, terminateOwnedProcess } from "./helpers/owned-cdp-proof-lifecycle";

// Cashier segment of the arrival/advance/return acceptance order. Mount the
// executable workspace and read client, not a duplicate card or commented App.
// All money/HTTP effects below are synthetic; native conservation, permissions,
// and the whole reservation-route/readiness return journey remain separate.
test("actual advance workbench preserves formatted evidence, context and same-key recovery", async () => {
  const chrome = resolveChromiumPath();
  if (!chrome) throw new Error("Owned Chromium required for advance caller acceptance");
  const root = resolve(import.meta.dir, "..");
  const proof = await mkdtemp(resolve(root, ".advance-caller-proof-"));
  const source = await readFile(resolve(root, "frontend/yellow/src/workspaces/FinanceWorkspace.tsx"), "utf8");
  const formatterStart = source.indexOf("function moneyExactMinor(");
  const formatterEnd = source.indexOf("function CashierGroupIcon", formatterStart);
  if (formatterStart < 0 || formatterEnd < 0) throw new Error("Existing currency formatter required");
  const formatter = source.slice(formatterStart, formatterEnd);
  const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const property = uuid(1);
  const reservation = (other = false) => ({
    reservationId: uuid(other ? 21 : 3), primaryPartyId: uuid(9), confirmationNo: other ? "SECOND" : "FIRST",
    status: "due_in", currency: "INR", bookerPartyId: null, groupId: null, channelCode: null,
    marketCode: null, sourceCode: null, originCode: null, guaranteePolicyId: null, eta: null, etd: null,
    notes: null, createdAt: "2026-10-03T00:00:00Z", cancelledAt: null, cancelReason: null, cancellationNo: null,
    segments: [], alerts: [], travel: [], history: [],
    guests: [{ partyId: uuid(9), displayName: "Synthetic guest", role: "primary", sharePct: "100" }],
    folios: [{ folioId: uuid(other ? 20 : 4), accountId: uuid(other ? 22 : 5), folioNo: other ? "B" : "A", name: null, status: "open", windowNo: 1 }],
  });
  const statement = (other = false) => ({
    reservationId: uuid(other ? 21 : 3), folio: { id: uuid(other ? 20 : 4), reference: other ? "B" : "A", name: null, windowNo: 1, status: "open", currency: "INR" },
    siblingWindows: [], balanceMinor: "600", stayTotalMinor: "600", generation: "synthetic", rows: [] as Array<{
      lineId: string; journalId: string; kind: string; businessDate: string; description: string | null;
      quantity: string; amountMinor: string; runningBalanceMinor: string; txCode: string;
      transferGroup: { id: string; memberCount: number; eligible: boolean; reason: string | null; currentWindowId: string };
    }>,
    chargeOptions: [], chargeAvailability: { allowed: false, reason: "Synthetic read fixture" },
  });
  type Deposit = Record<string, string | number>;
  const states = ["ready", "processing", "captured", "declined", "expired", "revoked"];
  const deposits = (other = false): Deposit[] => states.map((state, n) => ({
    requestId: uuid((other ? 130 : 30) + n), tenantId: uuid(11), propertyNode: property,
    propertyName: "Synthetic property", folioId: uuid(other ? 20 : 4), folioReference: other ? "B" : "A",
    operationId: uuid((other ? 160 : 60) + n), amountMinor: "1000", currency: "INR", generation: 1,
    expiresAt: "2030-01-01T00:00:00Z", state, capturedMinor: state === "captured" ? "1000" : "0",
    appliedMinor: state === "captured" ? "200" : "0", remainingMinor: state === "captured" ? "800" : "0",
  }));
  const instruments = [{ instrumentId: uuid(6), kind: "card_network_token", brand: "Synthetic card", last4: "1234", expiry: "2030-12", psp: "synthetic" }];
  let mode = "ok", records = deposits(), currentStatement = statement(), sessionNumber = 0;
  const posts: { kind: string; key: string | null; body: unknown; path: string }[] = [];
  let createEffects = 0, applyEffects = 0;
  const reads: string[] = [];
  const entry = resolve(proof, "fixture.tsx");
  await writeFile(entry, `
import React from 'react';import {createRoot} from 'react-dom/client';import {flushSync} from 'react-dom';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {AdvanceDepositWorkbench} from ${JSON.stringify(resolve(root, "frontend/yellow/src/workspaces/FinanceWorkspace.tsx"))};
import {reactAuthSession} from ${JSON.stringify(resolve(root, "frontend/yellow/src/auth-session.ts"))};
import {configureYellowApi} from ${JSON.stringify(resolve(root, "frontend/yellow/src/yellow-api.tsx"))};
import ${JSON.stringify(resolve(root, "frontend/yellow/src/styles.css"))};
import ${JSON.stringify(resolve(root, "frontend/yellow/src/ui/reference-theme.css"))};
${formatter}
const reservations=${JSON.stringify([reservation(), reservation(true)])},statements=${JSON.stringify([statement(), statement(true)])};
` + String.raw`
const checks=[],geometries=[],errors=[],writes=[];
window.addEventListener('error',event=>errors.push(event.message));
Storage.prototype.setItem=function(...args){writes.push(args);throw new Error('Unexpected persistence');};
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const assert=(ok,message)=>{if(!ok)throw new Error(message);};
const tick=()=>new Promise(resolve=>setTimeout(resolve,20));
const wait=async predicate=>{for(let n=0;n<200;n++){if(await predicate())return;await tick();}throw new Error('Advance observation timed out: '+document.body.textContent.slice(-1800));};
const control=async mode=>await fetch('/fixture-control?mode='+mode),state=async()=>await(await fetch('/fixture-status')).json();
const qc=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0},mutations:{retry:false}}});
const root=createRoot(document.getElementById('root'));let selected=0,lease=false,reconciled=null;
const render=()=>flushSync(()=>root.render(<QueryClientProvider client={qc}><div className="detail-card"><AdvanceDepositWorkbench key={selected} reservation={reservations[selected]} statement={reconciled??statements[selected]} acquireMutationLease={()=>{if(lease)return false;lease=true;return true;}} releaseMutationLease={()=>lease=false} onStatementReconciled={value=>{reconciled=value;render();}}/></div></QueryClientProvider>));
const scope=()=>document.querySelector('[aria-label="Advance deposits"]');
const cards=()=>[...scope().querySelectorAll('.advance-evidence')];
const card=n=>cards().find(node=>node.textContent.includes('Request reference: '+id(n)));
const button=label=>[...scope().querySelectorAll('button')].find(node=>node.textContent===label);
const click=async label=>{assert(button(label)&&!button(label).disabled,'enabled '+label);button(label).click();await tick();};
const edit=async(node,value)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(node,value);node.dispatchEvent(new Event('input',{bubbles:true}));await tick();};
const refresh=async()=>{await qc.invalidateQueries({queryKey:['cashier-hosted-deposits',id(1),id(selected?20:4)]});await tick();};
let sequence=0;const keyboard=async node=>{node.focus();window.keyRequest={sequence:++sequence};await wait(()=>window.keyDone===sequence);};
const geometry=label=>{for(const node of cards()){const list=node.querySelector('dl'),width=list.getBoundingClientRect().width,rows=[...list.children].map(row=>{const r=row.getBoundingClientRect(),dt=row.querySelector('dt').getBoundingClientRect(),dd=row.querySelector('dd'),v=dd.getBoundingClientRect();return{width:r.width,top:r.top,bottom:r.bottom,labelBottom:dt.bottom,valueTop:v.top,valueWidth:v.width,overflow:dd.scrollWidth>dd.clientWidth+1};});assert(rows.length===4&&rows.every((row,n)=>Math.abs(row.width-width)<=1&&!row.overflow&&(!n||row.top>=rows[n-1].bottom-1)),'full readable metric rows '+label);if(innerWidth<600)assert(rows.every(row=>row.valueWidth>=row.width-2&&row.valueTop>=row.labelBottom-1),'stacked mobile values '+label);geometries.push({label,state:node.querySelector('[role=status]').textContent,width,rows});}assert(document.documentElement.scrollWidth<=innerWidth+1,'page containment '+label);};
(async()=>{
 configureYellowApi(id(1));await reactAuthSession.signIn({tenant:'fixture',email:'fixture@example.test',password:'synthetic'},id(1));render();
 await wait(()=>cards().length===6);assert(cards().every(node=>node.dataset.evidenceState==='current'&&node.textContent.includes('FIRST')),'current matching stay context');
 for(let n=0;n<6;n++){const node=card(30+n),captured=n===2;assert(node,'matching request '+n);const values=[...node.querySelectorAll('dd')].map(value=>value.textContent);assert(JSON.stringify(values)===JSON.stringify(['1000',captured?'1000':'0',captured?'200':'0',captured?'800':'0'].map(value=>moneyExactMinor(value,'INR'))),'exact existing formatter for request '+n);assert(node.textContent.includes('Returned request state: '+['Ready','Processing','Captured','Declined','Expired','Revoked'][n]),'returned state '+n);assert(node.querySelector('details')&&!node.querySelector('details').open,'raw evidence collapsed '+n);}
 checks.push('six actual cards preserve exact matching DTO, existing formatter and returned states');
 assert(scope().querySelectorAll('.advance-evidence__action button').length===1&&card(32).querySelector('button').textContent==='Prepare deposit application','one original matched apply action');checks.push('original application button belongs only to captured matching request');
 const before=(await state()).reads;await keyboard(card(32).querySelector('summary'));assert(card(32).querySelector('details').open&&(await state()).reads===before,'trusted disclosure without request');
 await refresh();assert(!card(32).querySelector('details').open,'identical read resets disclosure');checks.push('keyboard disclosure and identical read reset');geometry('desktop');
 window.layoutRequest='narrow';await wait(()=>window.layoutDone==='narrow');geometry('375px');
 window.layoutRequest='zoom';await wait(()=>window.layoutDone==='zoom');geometry('375px doubled text');checks.push('actual six-card original theme desktop mobile and doubled-text containment');
 await control('503');await refresh();await wait(()=>cards().every(node=>node.dataset.evidenceState==='stale'));assert(card(32).querySelector('button').disabled&&scope().querySelector('fieldset').disabled,'failed refresh retains historical evidence with original ordinary controls disabled');checks.push('failed refresh marks historical values and disables existing controls');
 await control('wrong-folio');await refresh();assert(cards().every(node=>node.dataset.evidenceState==='stale')&&!scope().textContent.includes('FOREIGN'),'foreign DTO cannot replace same-folio history');checks.push('actual client rejects wrong-folio response');
 await control('ok');await refresh();await wait(()=>cards().every(node=>node.dataset.evidenceState==='current'));
 await click('Prepare deposit application');assert(scope().querySelector('.deposit-proposal').textContent.includes(moneyExactMinor('600','INR')),'original capped amount');
 scope().querySelector('.receivable-confirm input').click();await tick();await control('apply-loss');await click('Apply confirmed deposit');await wait(()=>scope().dataset.lifecycleRecovery==='true');assert(lease&&scope().querySelector('fieldset').disabled,'uncertain apply retains lease and form lock');
 await click('Retry retained same-key request');await wait(()=>!scope().dataset.lifecycleRecovery);assert(!lease&&reconciled?.balanceMinor==='0','application reconciles exact statement before unlock');
 let observed=await state();assert(observed.applyPosts===2&&observed.applySameKeyBody&&observed.applyEffects===1,'same apply key/body one synthetic effect');assert(card(32).textContent.includes('Remaining evidence: 200 INR minor units'),'post-application evidence refreshed');checks.push('lost application response retains exact key/body and reconciles once before unlock');
 const radio=scope().querySelector('input[type=radio]');radio.click();await tick();await edit(scope().querySelector('input[inputmode=numeric]'),'1000');await click('Review deposit request');scope().querySelector('.receivable-confirm input').click();await tick();await control('create-loss');await click('Create confirmed secure request');await wait(()=>scope().dataset.lifecycleRecovery==='true');assert(lease&&scope().querySelector('fieldset').disabled,'uncertain creation retains lease and form lock');
 await click('Retry retained same-key request');await wait(()=>!scope().dataset.lifecycleRecovery);observed=await state();assert(!lease&&observed.createPosts===2&&observed.createSameKeyBody&&observed.createEffects===1&&!scope().querySelector('.deposit-one-time'),'replayed request has no recoverable bearer and one effect');checks.push('lost creation response retains exact key/body and suppresses replayed bearer');
 selected=1;reconciled=null;await control('503');render();await wait(()=>scope().querySelector('.error'));assert(cards().length===0&&!scope().textContent.includes('FIRST')&&!scope().textContent.includes('No advance deposits.'),'new folio unavailable is not old data or zero');checks.push('new folio unavailable suppresses prior stay and zero claim');
 await control('ok');await refresh();await wait(()=>cards().length===6);assert(cards().every(node=>node.textContent.includes('SECOND')&&!node.textContent.includes('Folio reference: A')),'exact second stay/folio context');checks.push('second folio reads only its own matching records');
 const final=await state();assert(final.unexpected===0&&writes.length===0&&errors.length===0&&!lease,'no unexpected transport, persistence, runtime errors or retained lease');checks.push('effect and cleanup boundaries');
 flushSync(()=>root.unmount());qc.clear();await reactAuthSession.logout();
 const result=document.createElement('pre');result.id='proof';result.textContent=JSON.stringify({passed:true,checks,geometries,writes:writes.length,errors,synthetic:final});document.body.replaceChildren(result);
})().catch(error=>{const result=document.createElement('pre');result.id='proof';result.textContent=JSON.stringify({passed:false,error:String(error),checks,geometries,body:document.body.textContent.slice(-2400),errors});document.body.replaceChildren(result);});
`);
  const built = await Bun.build({ entrypoints: [entry], target: "browser", outdir: proof, naming: "[name].[ext]" });
  await writeFile(resolve(proof, "build.log"), built.logs.join("\n"));
  expect(built.success, built.logs.join("\n")).toBe(true);
  let unexpected = 0;
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, async fetch(request) {
    const url = new URL(request.url), path = url.pathname;
    if (path === "/fixture-control") { mode = url.searchParams.get("mode") ?? "ok"; return Response.json({ ok: true }); }
    if (path === "/fixture-status") {
      const same = (kind: string) => { const list = posts.filter(post => post.kind === kind); return list.length === 2 && list[0]!.key === list[1]!.key && JSON.stringify(list[0]!.body) === JSON.stringify(list[1]!.body) && list[0]!.path === list[1]!.path; };
      return Response.json({ reads: reads.length, unexpected, applyPosts: posts.filter(post => post.kind === "apply").length, createPosts: posts.filter(post => post.kind === "create").length, applyEffects, createEffects, applySameKeyBody: same("apply"), createSameKeyBody: same("create") });
    }
    if (path === "/fixture.js" || path === "/fixture.css") return new Response(Bun.file(resolve(proof, path.slice(1))), { headers: { "content-type": path.endsWith("js") ? "application/javascript" : "text/css" } });
    if (path === "/api/v1/auth/local:login") { sessionNumber++; return Response.json({ accessToken: "fixture." + Buffer.from(JSON.stringify({ sub: uuid(10), tid: uuid(11), sequence: sessionNumber })).toString("base64url") + ".fixture", tokenType: "Bearer", expiresInSeconds: 900, user: { id: uuid(10), displayName: "Synthetic staff" } }); }
    if (path === "/api/v1/me/properties") return Response.json({ properties: [{ id: property, name: "Synthetic property", timezone: "UTC" }] });
    if (path === "/api/v1/auth/browser/logout") return Response.json({ ok: true });
    if (path.startsWith(`/api/v1/properties/${property}/`)) {
      if (!request.headers.get("authorization")?.startsWith("Bearer fixture.")) return Response.json({ error: "synthetic-auth" }, { status: 401 });
      if (request.method === "GET") {
        reads.push(path);
        if (path.endsWith("/hosted-deposits")) {
          const other = path.includes(uuid(20));
          if (mode === "503") return Response.json({ error: "synthetic-unavailable" }, { status: 503 });
          return Response.json({ propertyNode: property, folioId: mode === "wrong-folio" ? uuid(90) : uuid(other ? 20 : 4), deposits: mode === "wrong-folio" ? [{ folioReference: "FOREIGN" }] : other ? deposits(true) : records, instruments });
        }
        if (path.includes("/reservations/")) return Response.json({ reservation: reservation(path.endsWith(uuid(21))), actions: { canModify: false, canCancel: false, canReinstate: false, canOpenPrimaryFolio: false, canManageAlerts: false } });
        if (path.endsWith("/statement")) return Response.json(path.includes(uuid(20)) ? statement(true) : currentStatement);
        if (path.includes("/hosted-deposits/")) { const record = records.find(item => item.requestId === path.split("/").at(-1)); if (record) return Response.json(record); }
      } else if (request.method === "POST") {
        const body = await request.json() as { amountMinor?: string; instrumentId?: string };
        const kind = path.endsWith("/applications") ? "apply" : "create";
        posts.push({ kind, key: request.headers.get("idempotency-key"), body, path });
        const count = posts.filter(post => post.kind === kind).length;
        if (kind === "apply" && path.endsWith(`/${uuid(32)}/applications`)) {
          if (count === 1) { applyEffects++; records = records.map(item => item.requestId === uuid(32) ? { ...item, appliedMinor: "800", remainingMinor: "200" } : item); currentStatement = { ...currentStatement, balanceMinor: "0", stayTotalMinor: "0", rows: [{ lineId: uuid(82), journalId: uuid(80), amountMinor: "-600", kind: "payment", businessDate: "2026-10-03", description: "Synthetic deposit application", quantity: "1", runningBalanceMinor: "0", txCode: "SYNTHETIC", transferGroup: { id: uuid(83), memberCount: 1, eligible: false, reason: "Payment", currentWindowId: uuid(4) } }] }; }
          if (mode === "apply-loss" && count === 1) return Response.json({ detail: "Synthetic lost reply after commit" }, { status: 503 });
          return Response.json({ applicationId: uuid(81), journalId: uuid(80), hostedRequestId: uuid(32), amountMinor: body.amountMinor, currency: "INR", replayed: true });
        }
        if (kind === "create" && path.endsWith(`/folios/${uuid(4)}/hosted-deposits`)) {
          if (count === 1) { createEffects++; records.push({ ...deposits()[0]!, requestId: uuid(50), operationId: uuid(70) }); }
          if (mode === "create-loss" && count === 1) return Response.json({ detail: "Synthetic lost reply after commit" }, { status: 503 });
          return Response.json({ requestId: uuid(50), operationId: uuid(70), amountMinor: body.amountMinor, currency: "INR", generation: 1, expiresAt: "2030-01-01T00:00:00Z", replayed: true });
        }
      }
      unexpected++; return Response.json({ error: "Unexpected synthetic request" }, { status: 404 });
    }
    if (path.startsWith(`/p/${property}/today`)) return new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"><div id="root" class="yellow-next" style="padding:12px;min-width:0"></div><script src="/fixture.js"></script>', { headers: { "content-type": "text/html" } });
    if (path !== "/favicon.ico") unexpected++;
    return new Response("Not found", { status: 404 });
  } });
  let socket: WebSocket | undefined;
  let send: ((method: string, params?: Record<string, unknown>) => Promise<any>) | undefined;
  const child = Bun.spawn([chrome, "--headless=new", "--no-first-run", "--no-default-browser-check", "--disable-gpu", "--disable-background-networking", `--user-data-dir=${resolve(proof, "profile")}`, "--remote-debugging-port=0", "about:blank"], { cwd: root, stdin: "ignore", stdout: "ignore", stderr: "ignore" });
  try {
    const expires = Date.now() + 30_000;
    let port: string | undefined;
    while (!port && Date.now() < expires) { try { port = (await readFile(resolve(proof, "profile/DevToolsActivePort"), "utf8")).split("\n")[0]; } catch { await Bun.sleep(25); } }
    if (!port) throw new Error("Owned debugger not ready");
    const targets = await fetchJsonBounded<Array<{ type: string; url: string; webSocketDebuggerUrl?: string }>>(`http://127.0.0.1:${port}/json/list`);
    const target = targets.find(item => item.type === "page" && item.url === "about:blank");
    if (!target?.webSocketDebuggerUrl) throw new Error("Owned blank target not found");
    socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise<void>((resolve, reject) => { const timer = setTimeout(() => reject(new Error("CDP open deadline")), 5_000); socket!.onopen = () => { clearTimeout(timer); resolve(); }; socket!.onerror = () => { clearTimeout(timer); reject(new Error("CDP open failed")); }; });
    let id = 0;
    const pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
    socket.onmessage = event => { const response = JSON.parse(String(event.data)); const request = pending.get(response.id); if (!request) return; pending.delete(response.id); clearTimeout(request.timer); response.error ? request.reject(new Error(JSON.stringify(response.error))) : request.resolve(response.result); };
    send = (method, params = {}) => new Promise((resolve, reject) => { const requestId = ++id; const timer = setTimeout(() => { pending.delete(requestId); reject(new Error("CDP deadline " + method)); }, 5_000); pending.set(requestId, { resolve, reject, timer }); socket!.send(JSON.stringify({ id: requestId, method, params })); });
    await send("Runtime.enable"); await send("Emulation.setDeviceMetricsOverride", { width: 1200, height: 1000, deviceScaleFactor: 1, mobile: false });
    await send("Page.navigate", { url: `http://127.0.0.1:${server.port}/p/${property}/today?workspace=finance&reservation=${uuid(3)}` }); await send("Page.bringToFront"); await send("Emulation.setFocusEmulationEnabled", { enabled: true });
    let handled = 0, evidence: any;
    const layouts = new Set<string>();
    while (Date.now() < expires) {
      const snapshot = await send("Runtime.evaluate", { expression: "JSON.stringify({proof:document.getElementById('proof')?.textContent,key:window.keyRequest,layout:window.layoutRequest})", returnByValue: true });
      const observation = JSON.parse(snapshot.result.value);
      if (observation.proof) { evidence = JSON.parse(observation.proof); break; }
      if (observation.key?.sequence > handled) { const screenshot = await send("Page.captureScreenshot", { format: "png" }); await writeFile(resolve(proof, "cashier-desktop.png"), Buffer.from(screenshot.data, "base64")); await send("Input.dispatchKeyEvent", { type: "keyDown", key: " ", code: "Space", windowsVirtualKeyCode: 32, text: " " }); await send("Input.dispatchKeyEvent", { type: "keyUp", key: " ", code: "Space", windowsVirtualKeyCode: 32 }); handled = observation.key.sequence; await send("Runtime.evaluate", { expression: `window.keyDone=${handled}` }); }
      if (observation.layout && !layouts.has(observation.layout)) { if (observation.layout === "narrow") await send("Emulation.setDeviceMetricsOverride", { width: 375, height: 900, deviceScaleFactor: 1, mobile: false }); else await send("Runtime.evaluate", { expression: "document.documentElement.style.fontSize='32px'" }); layouts.add(observation.layout); const image = await send("Page.captureScreenshot", { format: "png" }); await writeFile(resolve(proof, "cashier-" + observation.layout + ".png"), Buffer.from(image.data, "base64")); await send("Runtime.evaluate", { expression: `window.layoutDone=${JSON.stringify(observation.layout)}` }); }
      await Bun.sleep(20);
    }
    if (!evidence) throw new Error("Advance caller proof exceeded deadline");
    await writeFile(resolve(proof, "receipt.json"), JSON.stringify(evidence, null, 2));
    expect(evidence.passed, JSON.stringify(evidence)).toBe(true);
    expect(evidence.checks).toHaveLength(11);
    expect(evidence.geometries).toHaveLength(18);
    expect(evidence.writes).toBe(0);
  } finally { await terminateOwnedProcess(child, send ? () => send!("Browser.close") : undefined); socket?.close(); server.stop(true); }
}, 40_000);
