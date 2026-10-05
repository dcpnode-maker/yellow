import { expect, test } from "bun:test";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { resolveChromiumPath } from "./helpers/chromium-path";
import { fetchJsonBounded, terminateOwnedProcess } from "./helpers/owned-cdp-proof-lifecycle";

// Actual board widget/auth/read client against an owned synthetic origin. No native database or live/provider forwarding.
test("actual group block caller preserves complete rows and fences pending, denied, property and session reads", async () => {
  const chrome = resolveChromiumPath(); if (!chrome) throw new Error("Owned Chromium required for group caller proof");
  const root = resolve(import.meta.dir, ".."), proof = await mkdtemp(resolve(root, ".group-caller-proof-"));
  const entry = resolve(proof, "fixture.tsx");
  const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  let mode = "ok", sessionNumber = 0;
  const held: Array<() => void> = [], requests: Array<{ path: string; method: string }> = [], unexpected: string[] = [];
  function workbench(property: string) {
    return { groups: [{ groupId: id(3), code: property === id(1) ? "FIRST-BLOCK" : "SECOND-BLOCK", name: "Synthetic group",
      status: "definite", statusDeductsInventory: true, accountPartyId: null, accountPartyName: null, cutoffDate: "2026-10-03",
      elastic: false, washSchedule: null, masterFolioId: null, masterFolioNo: null, masterFolioStatus: null,
      arrivalDate: "2026-10-01", departureDate: "2026-11-10", blockedRooms: 10, pickedUpRooms: 12, remainingRooms: 0, pickupPercent: 120, cutoffState: "due_today",
      allotment: Array.from({ length: 40 }, (_, index) => ({ unitTypeId: id(4), unitTypeCode: "KING", unitTypeName: "King room",
        stayDate: new Date(Date.UTC(2026, 9, index + 1)).toISOString().slice(0, 10), blocked: 1, pickedUp: 1, remaining: 0, rateOverride: null })),
      roomingList: Array.from({ length: 30 }, (_, index) => ({ reservationId: id(index === 29 ? 128 : index + 100),
        confirmationNo: `CONF-${index === 29 ? 28 : index}`, primaryGuestDisplayName: `Synthetic guest ${index === 29 ? 28 : index}`,
        status: "reserved", unitTypeCode: index === 29 ? "OTHER" : "KING", unitTypeName: index === 29 ? "Other room" : "King room",
        stayFrom: "2026-10-03T15:00:00.000000Z", stayTo: "2026-10-04T11:00:00.000000Z", pickedUpNights: 1 })) }] };
  }
  await writeFile(entry, `import React from 'react';import {createRoot} from 'react-dom/client';import {flushSync} from 'react-dom';
import {StaffGroupBlockWorkbench} from ${JSON.stringify(resolve(root, "frontend/yellow/src/workspaces/StaffGroupBlockWorkbench.tsx"))};
import {reactAuthSession} from ${JSON.stringify(resolve(root, "frontend/yellow/src/auth-session.ts"))};
import {installWorkspaceNavigation} from ${JSON.stringify(resolve(root, "frontend/yellow/src/workspace-navigation.ts"))};
import ${JSON.stringify(resolve(root, "frontend/yellow/src/styles.css"))};
import ${JSON.stringify(resolve(root, "frontend/yellow/src/ui/reference-theme.css"))};
` + String.raw`
const checks=[],errors=[],writes=[],geometries=[],destinations=[];window.addEventListener('error',e=>errors.push(e.message));
Storage.prototype.setItem=function(...args){writes.push(args);throw new Error('Unexpected browser persistence');};
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');let property=id(1),dispose;
const root=createRoot(document.getElementById('root'));const tick=()=>new Promise(resolve=>setTimeout(resolve,15));
const assert=(condition,label)=>{if(!condition)throw new Error(label);};const panel=()=>document.querySelector('.group-evidence');
const scope=()=>document.querySelector('.group-block-workbench');const state=()=>fetch('/fixture-status').then(r=>r.json());
const control=mode=>fetch('/fixture-control?mode='+mode).then(r=>r.json());
const wait=async check=>{for(let n=0;n<250;n++){if(await check())return;await tick();}throw new Error('Condition timeout: '+check+' '+document.body.textContent);};
const render=()=>{dispose?.();dispose=installWorkspaceNavigation({propertyId:property,canNavigate:()=>true,onNavigate:href=>destinations.push(href)});
 flushSync(()=>root.render(<StaffGroupBlockWorkbench propertyId={property}/>));};
const signIn=()=>reactAuthSession.signIn({tenant:'synthetic',email:'synthetic',password:'synthetic'});
const ready=label=>wait(()=>panel()?.textContent.includes(label)&&!scope().querySelector('button').disabled);
const refresh=async()=>{scope().querySelector('button').click();await tick();};
const geometry=label=>{const card=panel(),r=card.getBoundingClientRect();assert(document.documentElement.scrollWidth<=innerWidth+1&&card.scrollWidth<=card.clientWidth+1,'containment '+label);
 const rows=[...card.querySelectorAll('.group-evidence__metrics .group-evidence__row')].map(row=>{const a=row.querySelector('dt').getBoundingClientRect(),b=row.querySelector('dd').getBoundingClientRect();
 assert(a.width>0&&b.width>0&&b.right<=r.right+1,'complete metric '+label);return{label:row.querySelector('dt').textContent,labelWidth:a.width,valueWidth:b.width};});
 const tables=[...card.querySelectorAll('.group-evidence__details[open] table')].map(table=>{const rect=table.getBoundingClientRect();
 assert(rect.right<=r.right+1&&table.scrollWidth<=table.clientWidth+1,'complete rooming table '+label);return{caption:table.querySelector('caption').textContent,width:rect.width};});
 assert(tables.length===30,'all opened rooming rows measured '+label);assert(scope().querySelector('button').getBoundingClientRect().height>=44,'refresh touch target '+label);
 geometries.push({label,viewport:innerWidth,cardWidth:r.width,rows,tables});};
(async()=>{
 await signIn();render();await ready('FIRST-BLOCK');
 assert(panel().textContent.includes('120%')&&panel().textContent.includes('Remaining room nights'),'overpickup survives zero remaining');
 assert(panel().querySelectorAll('.group-evidence__table').length===70,'all40+30rows mounted');
 assert(panel().textContent.includes('Rooming details (30 rows)')&&!panel().textContent.includes('30 reservations'),'rows not unique reservations');
 const links=[...panel().querySelectorAll('a')];assert(links.length===30&&links[28].href===links[29].href,'split row shared exact reservation destination');
 checks.push('complete40allotment/30rooming rows and split reservation identity without truncation or false counts');
 const before=(await state()).requests.length;panel().querySelector('summary').focus();window.keyRequest=1;await wait(()=>window.keyDone===1);
 assert(panel().querySelector('details').open&&(await state()).requests.length===before,'trusted keyboard disclosure request-free');checks.push('trusted Space opens native Details without request');
 await refresh();await ready('FIRST-BLOCK');assert(!panel().querySelector('details').open,'identical accepted refresh resets');checks.push('identical native read remounts collapsed disclosures');
 const rooming=panel().querySelectorAll('details')[1];rooming.open=true;panel().querySelector('a').click();assert(destinations.at(-1)==='/p/'+property+'/res/'+id(100),'existing native reservation destination');
 assert((await state()).requests.length===before+1,'link uses existing soft navigation');checks.push('parent-owned reservation links preserve current property and existing navigation');
 geometry('desktop');window.layoutRequest='narrow';await wait(()=>window.layoutDone==='narrow');geometry('375px');
 window.layoutRequest='zoom';await wait(()=>window.layoutDone==='zoom');geometry('375px doubled text');checks.push('actual original theme desktop/375px/doubled text containment');
 for(const mode of ['403','401','404','500','malformed','bad-shape']){await control(mode);await refresh();await wait(()=>scope().querySelector('[role=alert]'));
 assert(!panel()&&!scope().textContent.includes('Synthetic guest'),'denied or malformed evidence cleared '+mode);await control('ok');await refresh();await ready('FIRST-BLOCK');}
 checks.push('all denied unavailable and malformed responses hide prior group and guest evidence');
 await control('revoked');const revokedBefore=(await state()).requests.length;await refresh();await wait(()=>scope().querySelector('[role=alert]'));
 assert(!panel()&&(await state()).requests.length===revokedBefore,'fresh grant denial before group transport');await control('ok');await refresh();await ready('FIRST-BLOCK');checks.push('fresh property grant check before endpoint read');
 await control('empty');await refresh();await wait(()=>scope().textContent.includes('No group blocks returned for FIRST'));
 assert(!panel()&&!scope().querySelector('[role=alert]'),'authorized empty distinct from unavailable');checks.push('successful empty evidence is distinct from failure');
 await control('hold');await refresh();await wait(async()=>(await state()).held===1);assert(!panel(),'pending read clears current claim');
 property=id(2);render();assert(!panel(),'property render fences prior state before effect');await control('ok');await ready('SECOND-BLOCK');
 await control('release');await tick();assert(!scope().textContent.includes('FIRST-BLOCK')&&!scope().querySelector('[role=alert]'),'late old property response excluded');checks.push('pending and late old-property reads cannot restore evidence');
 await control('hold');await refresh();await wait(async()=>(await state()).held===1);await control('ok');await signIn();await ready('SECOND-BLOCK');
 await control('release');await tick();assert(panel()&&!scope().querySelector('[role=alert]'),'same-principal new token rejects old response');checks.push('same-principal replacement token fences previous request');
 await control('hold');await refresh();await wait(async()=>(await state()).held===1);await reactAuthSession.logout();await wait(()=>!panel()&&scope().querySelector('button').disabled);
 await control('release');await tick();assert(!panel(),'logout preserves no prior evidence');await signIn();await ready('SECOND-BLOCK');checks.push('logout clears evidence and new sign-in recovers explicitly');
 const finalState=await state();assert(!writes.length&&!errors.length&&!finalState.unexpected.length&&finalState.requests.every(r=>r.method==='GET'),'no persistence mutation runtime error or unexpected transport');
 checks.push('read-only scoped endpoint requests with no browser persistence or runtime errors');
 dispose();flushSync(()=>root.unmount());await reactAuthSession.logout();const result=document.createElement('pre');result.id='proof';result.textContent=JSON.stringify({passed:true,checks,geometries,writes:writes.length,errors,requests:finalState.requests});document.body.replaceChildren(result);
})().catch(error=>{const result=document.createElement('pre');result.id='proof';result.textContent=JSON.stringify({passed:false,error:String(error),checks,geometries,body:document.body.textContent.slice(-2500),errors});document.body.replaceChildren(result);});
`);
  const built = await Bun.build({ entrypoints: [entry], target: "browser", outdir: proof, naming: "[name].[ext]" });
  await writeFile(resolve(proof, "bundle-build.log"), built.logs.join("\n") + `\nsuccess=${built.success}\n`);
  expect(built.success, built.logs.join("\n")).toBe(true);
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, async fetch(request) {
    const url = new URL(request.url), path = url.pathname;
    if (path === "/fixture-control") { const next = url.searchParams.get("mode") ?? "ok"; if (next === "release") { mode = "ok"; held.splice(0).forEach(release => release()); } else mode = next; return Response.json({ ok: true }); }
    if (path === "/fixture-status") return Response.json({ requests, held: held.length, unexpected });
    if (path === "/fixture.js" || path === "/fixture.css") return new Response(Bun.file(resolve(proof, path.slice(1))), { headers: { "content-type": path.endsWith("js") ? "application/javascript" : "text/css" } });
    if (path === "/api/v1/auth/local:login") { sessionNumber++; return Response.json({ accessToken: "fixture." + Buffer.from(JSON.stringify({ sub: id(10), tid: id(9), sequence: sessionNumber })).toString("base64url") + ".fixture", tokenType: "Bearer", expiresInSeconds: 900, user: { id: id(10), displayName: "Synthetic staff" } }); }
    if (path === "/api/v1/auth/browser/logout") return Response.json({ ok: true });
    if (path === "/api/v1/me/properties") return Response.json({ properties: [1, 2].filter(n => mode !== "revoked" || n === 2).map(n => ({ id: id(n), name: n === 1 ? "FIRST" : "SECOND", timezone: "UTC" })) });
    if (/^\/api\/v1\/properties\/[0-9a-f-]+\/group-blocks$/.test(path) && request.method === "GET") {
      requests.push({ path, method: request.method });
      if (!request.headers.get("authorization")?.startsWith("Bearer fixture.")) return Response.json({ error: "fixture-auth" }, { status: 401 });
      const currentMode = mode, value = workbench(path.split("/")[4]!);
      const response = ["401", "403", "404", "500"].includes(currentMode) ? Response.json({ error: "fixture" }, { status: Number(currentMode) }) :
        currentMode === "malformed" ? new Response("not-json") : currentMode === "bad-shape" ? Response.json({ groups: [{ ...value.groups[0], cutoffDate: "2026-02-30" }] }) :
        Response.json(currentMode === "empty" ? { groups: [] } : value);
      return currentMode === "hold" ? await new Promise<Response>(release => held.push(() => release(response))) : response;
    }
    if (/^\/p\/[0-9a-f-]+\/reservations$/.test(path)) return new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"><div id="root" class="yellow-next" style="box-sizing:border-box;max-width:1100px;padding:8px;margin:auto"></div><script src="/fixture.js"></script>', { headers: { "content-type": "text/html" } });
    if (path === "/favicon.ico") return new Response(null, { status: 204 });
    unexpected.push(path); return new Response("Unexpected fixture route", { status: 404 });
  } });
  let socket: WebSocket | undefined, send: ((method: string, params?: Record<string, unknown>) => Promise<any>) | undefined;
  const child = Bun.spawn([chrome, "--headless=new", "--no-first-run", "--no-default-browser-check", "--disable-gpu", "--disable-background-networking",
    `--user-data-dir=${resolve(proof, "profile")}`, "--remote-debugging-port=0", "about:blank"], { cwd: root, stdin: "ignore", stdout: "ignore", stderr: "ignore" });
  let evidence: any; const expires = Date.now() + 40_000;
  try {
    let port: string | undefined; while (!port && Date.now() < expires) { try { port = (await readFile(resolve(proof, "profile/DevToolsActivePort"), "utf8")).split("\n")[0]; } catch { await Bun.sleep(25); } }
    if (!port) throw new Error("Owned debugger did not become ready");
    const targets = await fetchJsonBounded<Array<{ type: string; webSocketDebuggerUrl: string }>>(`http://127.0.0.1:${port}/json/list`);
    socket = new WebSocket(targets.find(target => target.type === "page")!.webSocketDebuggerUrl);
    await new Promise<void>((done, reject) => { socket!.onopen = () => done(); socket!.onerror = () => reject(new Error("Owned debugger connection failed")); });
    let sequence = 0; const pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
    socket.onmessage = event => { const response = JSON.parse(String(event.data)); const call = pending.get(response.id); if (!call) return; pending.delete(response.id); clearTimeout(call.timer); response.error ? call.reject(new Error(JSON.stringify(response.error))) : call.resolve(response.result); };
    send = (method, params = {}) => new Promise((done, reject) => { const key = ++sequence, timer = setTimeout(() => { pending.delete(key); reject(new Error("CDP deadline " + method)); }, 5_000); pending.set(key, { resolve: done, reject, timer }); socket!.send(JSON.stringify({ id: key, method, params })); });
    await send("Runtime.enable"); await send("Emulation.setDeviceMetricsOverride", { width: 1200, height: 1000, deviceScaleFactor: 1, mobile: false });
    await send("Page.navigate", { url: `http://127.0.0.1:${server.port}/p/${id(1)}/reservations` }); await send("Page.bringToFront"); await send("Emulation.setFocusEmulationEnabled", { enabled: true });
    let keyboardDone = false; const layouts = new Set<string>();
    while (Date.now() < expires) {
      const result = await send("Runtime.evaluate", { expression: "JSON.stringify({proof:document.getElementById('proof')?.textContent,key:window.keyRequest,layout:window.layoutRequest})", returnByValue: true }); const observation = JSON.parse(result.result.value);
      if (observation.proof) { evidence = JSON.parse(observation.proof); break; }
      if (observation.key && !keyboardDone) { await send("Input.dispatchKeyEvent", { type: "keyDown", key: " ", code: "Space", windowsVirtualKeyCode: 32, text: " " }); await send("Input.dispatchKeyEvent", { type: "keyUp", key: " ", code: "Space", windowsVirtualKeyCode: 32 }); await send("Runtime.evaluate", { expression: "window.keyDone=1" }); keyboardDone = true; }
      if (observation.layout && !layouts.has(observation.layout)) {
        if (observation.layout === "narrow") await send("Emulation.setDeviceMetricsOverride", { width: 375, height: 700, deviceScaleFactor: 1, mobile: false });
        else await send("Runtime.evaluate", { expression: "document.documentElement.style.fontSize='32px'" });
        const snapshot = await send("Page.captureScreenshot", { format: "png" }); await writeFile(resolve(proof, `group-${observation.layout}.png`), Buffer.from(snapshot.data, "base64"));
        await send("Runtime.evaluate", { expression: `window.layoutDone=${JSON.stringify(observation.layout)}` }); layouts.add(observation.layout);
      }
      await Bun.sleep(20);
    }
    if (!evidence) { const diagnostics = await send("Runtime.evaluate", { expression: "document.documentElement.outerHTML", returnByValue: true }); await writeFile(resolve(proof, "failure.json"), JSON.stringify(diagnostics)); throw new Error("Group caller proof exceeded40seconds"); }
    await writeFile(resolve(proof, "receipt.json"), JSON.stringify(evidence, null, 2));
    expect(evidence.passed, JSON.stringify(evidence)).toBe(true); expect(evidence.checks).toHaveLength(12); expect(evidence.geometries).toHaveLength(3); expect(evidence.writes).toBe(0);
  } finally { await terminateOwnedProcess(child, send ? () => send!("Browser.close") : undefined); socket?.close(); server.stop(true); }
}, 60_000);
