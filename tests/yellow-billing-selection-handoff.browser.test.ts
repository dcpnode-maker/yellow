import { expect, test } from "bun:test";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";

// Run with YELLOW_HANDOFF_PROOF_DIR set to a new external evidence directory.
// Drive the returned App URL with the approved CUA browser, using real pointer
// and keyboard input. /proof supplies synthetic response controls and records
// read-only DOM observations; it never clicks or focuses an App control.
const enabled = Boolean(process.env["YELLOW_HANDOFF_PROOF_DIR"]);
(enabled ? test : test.skip)("actual App mobile bill handoff, delayed reads and return regression proof", async () => {
  const root = resolve(import.meta.dir, "..");
  const out = resolve(process.env["YELLOW_HANDOFF_PROOF_DIR"]!);
  mkdirSync(out, { recursive: false });
  const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const property = id(1);
  const rows = Array.from({ length: 30 }, (_, n) => ({ reservationId: id(100 + n), confirmationNo: `SYN-${101 + n}`,
    primaryGuestDisplayName: `Synthetic Guest ${String(n + 1).padStart(2, "0")}`, status: "in_house", operationalState: "in_house",
    stayFrom: "2026-10-03T14:00:00Z", stayTo: "2026-10-05T10:00:00Z", unitTypeLabel: "Standard", sellableUnitLabel: String(101 + n),
    channelCode: "DIRECT", sourceCode: "WEB", marketCode: "RETAIL" }));
  const windows = (n: number) => [1, 2].map(no => ({ id: id(300 + n * 10 + no), windowNo: no,
    reference: `SYN-F-${n + 1}-${no}`, name: no === 1 ? "Guest bill" : "Company bill", status: "open", balanceMinor: no === 1 ? "125000" : "0" }));
  const statement = (n: number, no: number) => ({ reservationId: rows[n]!.reservationId,
    folio: { ...windows(n)[no - 1], currency: "INR" }, siblingWindows: windows(n), balanceMinor: no === 1 ? "125000" : "0",
    stayTotalMinor: "125000", generation: "synthetic-64", rows: [], chargeOptions: [], chargeAvailability: { allowed: false, reason: "Read-only synthetic proof" } });
  let mode = "normal", tokenNumber = 0;
  const waiting: Array<() => void> = [];
  const commands = new Map<string, Array<{ action: string; label: string }>>();
  const observations: any[] = [], requests: any[] = [];
  let finish!: () => void;
  const completed = new Promise<void>(done => { finish = done; });
  let lastProgress = Date.now();
  const started = lastProgress;
  let deadlineTimer: ReturnType<typeof setInterval> | undefined;
  const entry = join(out, "entry.tsx");
  const module = (path: string) => JSON.stringify(resolve(root, path));
  const ownerBridge = `
  // TEST-ONLY generated fixture. Invokes original actual App owners, never child-local fake lock.
  (globalThis as any).__cashierParentOwners = {
    allowed: canNavigateWorkspace,
    lock(name: string, busy: boolean) {
      if(name==='reservation') setReservationLifecycleFlight(busy);
      if(name==='voice') setVoiceBillWindowTransfer(busy ? {postingAttempted:true,reservationId:'fixture',confirmationNo:'SYN-101',guestName:'Synthetic Guest 01',folioReference:'SYN-F-1-1',chargeLabel:'Synthetic retained transfer',destinationLabel:'Company bill',destinationExistingName:null,draft:{},preview:{currency:'INR',amountMinor:'100',totalMinor:'100'},key:'synthetic-readonly-retained-voice-attempt',receipt:null} as any : null);
      if(name==='property') setPropertyModeNavigationLocked(busy);
    },
    inline() {setAssistant(true);setAssistantCard({workspace:'cashiers',eyebrow:'SYNTHETIC ACTUAL-APP FIXTURE',title:'Synthetic cashier owner fixture',detail:'Read-only parent presentation proof',rows:[]} as any);},
  };
`;
  const sourcePlugin = {name:'test-only-actual-owner-interleavings',setup(build:any){build.onLoad({filter:/(?:App\.tsx|FinanceWorkspace\.tsx|auth-session\.ts)$/},(args:any)=>{
    let contents=readFileSync(args.path,'utf8');const isApp=args.path.replaceAll('\\','/').endsWith('/App.tsx');
    if(isApp){const anchor='  useEffect(() => installWorkspaceNavigation({';if(contents.split(anchor).length!==2)throw Error('Owner fixture anchor ambiguous');contents=contents.replace(anchor,ownerBridge+anchor);}
    else if(args.path.endsWith('auth-session.ts')){contents=contents.replace('session: defaultSession.session,','session: () => (globalThis as any).__cashierSessionGate?.(defaultSession.session()) ?? defaultSession.session(),');}
    else {contents=contents.replace('      readyHandoff.current = stillCurrent;','      readyHandoff.current = stillCurrent;\n      (globalThis as any).__cashierInterleave?.("bill");').replace('    setReturnRequest(request => request + 1);','    (globalThis as any).__cashierInterleave?.("return");\n    setReturnRequest(request => request + 1);');}
    writeFileSync(join(out,isApp?'generated-App.tsx':args.path.endsWith('auth-session.ts')?'generated-auth-session.ts':'generated-FinanceWorkspace.tsx'),contents);
    return {contents,loader:'tsx'};
  });}};
  writeFileSync(entry, `import React from ${module("node_modules/react")};
import {createRoot} from ${module("node_modules/react-dom/client")};
import {QueryClient,QueryClientProvider} from ${module("node_modules/@tanstack/react-query/build/modern/index.js")};
import {AuthenticationGate} from ${module("frontend/yellow/src/AuthenticationGate.tsx")};
import {reactAuthSession} from ${module("frontend/yellow/src/auth-session.ts")};
import ${module("frontend/yellow/src/styles.css")};
import ${module("frontend/yellow/src/ui/reference-theme.css")};
const {App}=await import(${module("frontend/yellow/src/App.tsx")});
const clientId=new URL(location.href).searchParams.get('proof')||'main';
const qc=new QueryClient({defaultOptions:{queries:{retry:false,refetchOnWindowFocus:false}}});
let mount=createRoot(document.getElementById('root'));
mount.render(React.createElement(QueryClientProvider,{client:qc},React.createElement(AuthenticationGate,null,React.createElement(App))));
const ownerTrace=[],movements=[];const actualFocus=HTMLElement.prototype.focus,actualScroll=Element.prototype.scrollIntoView;HTMLElement.prototype.focus=function(...args){if(this.matches('.cashier-mobile-bill-heading,.cashier-stay-list button,.cashier-search-heading'))movements.push({kind:'focus',text:this.textContent});return actualFocus.apply(this,args);};Element.prototype.scrollIntoView=function(...args){if(this.matches('.cashier-mobile-bill-heading,.cashier-stay-list button,.cashier-search-heading'))movements.push({kind:'scroll',text:this.textContent});return actualScroll.apply(this,args);};let commitHook=null,holdTokens=false;const tokenWaiters=[];globalThis.__cashierSessionGate=async tokenPromise=>{const token=await tokenPromise;if(holdTokens)await new Promise(done=>tokenWaiters.push(done));return token;};globalThis.__cashierInterleave=stage=>{if(commitHook?.stage===stage){const hook=commitHook;commitHook=null;globalThis.__cashierParentOwners.lock(hook.owner,true);ownerTrace.push({kind:'commit',...hook});}};\nconst errors=[];addEventListener('error',e=>errors.push(e.message));addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
const rect=e=>{if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom};};
const visible=e=>!!e&&e.getBoundingClientRect().height>0&&getComputedStyle(e).visibility!=='hidden';
const exposed=e=>{if(!visible(e))return false;const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.y>=0&&r.bottom<=innerHeight&&!!hit&&(e===hit||e.contains(hit));};
const capture=label=>{const h=document.querySelector('.cashier-mobile-bill-heading'),r=rect(h),a=document.activeElement,
 s=document.querySelector('.billing-workspace'),search=document.querySelector('.cashier-unified-search input');
 const p=h?[...h.children].map(n=>{const r=n.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {text:n.textContent,rect:rect(n),unobscured:!!hit&&(n===hit||n.contains(hit))};}):[];
 const returnButton=document.querySelector('.cashier-mobile-bill-context button');
 return {label,clientId,movements:[...movements],parentGuardAllowed:globalThis.__cashierParentOwners?.allowed(),ownerTrace:[...ownerTrace],tokenWaiting:tokenWaiters.length,url:location.href,width:innerWidth,height:innerHeight,scrollY,view:s?.getAttribute('data-mobile-bill'),heading:h?.textContent,headingRect:r,headingVisible:visible(h),headingFocused:a===h,headingParts:p,focus:a?.textContent,focusTag:a?.tagName,returnExposed:exposed(returnButton),returnDisabled:returnButton?.disabled,resultButtonsDisabled:[...document.querySelectorAll('.cashier-stay-list button')].every(n=>n.disabled),shellBusy:!!document.querySelector('.yellow-next[aria-busy="true"]'),authStatus:reactAuthSession.getSnapshot().status,
 search:search?.value,scope:[...document.querySelectorAll('.cashier-search-scope button')].filter(n=>n.getAttribute('aria-pressed')==='true').map(n=>n.textContent),
 page:document.querySelector('.cashier-result-pagination span')?.textContent,searchVisible:visible(search),body:document.body.innerText,errors:[...errors],overflow:document.documentElement.scrollWidth>innerWidth+1};};
let polling=false;
setInterval(async()=>{if(polling)return;polling=true;try{const items=await(await fetch('/proof/commands?client='+encodeURIComponent(clientId))).json();for(const item of items){
 if(item.action==='owner'){const [owner,state]=item.label.split(':');globalThis.__cashierParentOwners.lock(owner,state==='on');ownerTrace.push({kind:'actual-owner',owner,state});}\n if(item.action==='inline')globalThis.__cashierParentOwners.inline();\n if(item.action==='commitBill'||item.action==='commitReturn')commitHook={stage:item.action==='commitBill'?'bill':'return',owner:item.label};\n if(item.action==='tokenHold')holdTokens=true;\n if(item.action==='tokenRelease'){holdTokens=false;tokenWaiters.splice(0).forEach(done=>done());}\n if(item.action==='remount'){mount.unmount();mount=createRoot(document.getElementById('root'));mount.render(React.createElement(QueryClientProvider,{client:qc},React.createElement(AuthenticationGate,null,React.createElement(App))));}\n if(item.action==='refetch')void qc.invalidateQueries();
 if(item.action==='reauth')await reactAuthSession.signIn({tenant:'fixture',email:'fixture@example.test',password:'synthetic'},${JSON.stringify(property)});
 if(item.action==='logout')await reactAuthSession.logout();
 if(item.action==='reauthRejected'){await reactAuthSession.logout();try{await reactAuthSession.signIn({tenant:'fixture',email:'fixture@example.test',password:'synthetic'},${JSON.stringify(property)});}catch(e){ownerTrace.push({kind:'auth-rejected',message:String(e)});}}
 if(item.action==='unmount')mount.unmount();
 if(item.action==='record')await fetch('/proof/observation',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(capture(item.label))});
 }}catch(e){errors.push(String(e));}finally{polling=false;}},100);
`);
  const build = await Bun.build({ entrypoints: [entry], outdir: join(out, "build"), target: "browser", format: "esm", sourcemap: "external", plugins:[sourcePlugin], define: { "process.env.NODE_ENV": '"production"' } });
  expect(build.success).toBe(true);
  // Explicit proof controls release held reads; the fixture must not silently
  // replace a deliberately late response with Bun's default idle timeout.
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, idleTimeout: 0, async fetch(request) {
    const url = new URL(request.url), path = url.pathname;
    const requestModeAtStart = mode, requestId = crypto.randomUUID();
    if (path.startsWith("/api/")) requests.push({ requestId, phase: "received", method: request.method, path: path + url.search, mode: requestModeAtStart, time: new Date().toISOString() });
    const response = (body: unknown, status = 200) => { requests.push({ requestId, phase: "responded", method: request.method, path: path + url.search, mode: requestModeAtStart, status, time: new Date().toISOString() }); return Response.json(body, { status }); };
    if (path === "/proof/status") return Response.json({mode,waiting:waiting.length,labels:observations.map(o=>o.label)});
    if (path === "/proof/observation") { lastProgress = Date.now(); observations.push(await request.json()); writeFileSync(join(out, "OBSERVATIONS.json"), JSON.stringify(observations, null, 2)); return new Response("recorded"); }
    if (path === "/proof/image" && request.method === "POST") {
      const form = await request.formData(), name = String(form.get("name")), data = String(form.get("data"));
      if (!["phone375", "phone320", "desktop1440", "preflight-lock"].includes(name) || data.length > 4_000_000) return new Response("Invalid artifact", { status: 400 });
      const bytes = Buffer.from(data, "base64");
      if (bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") return new Response("PNG required", { status: 400 });
      writeFileSync(join(out, name + ".png"), bytes, { flag: "wx" }); lastProgress = Date.now();
      return new Response("Saved " + name + ".png");
    }
    if (path === "/proof/image") return new Response('<!doctype html><html><meta charset="utf-8"><form method="post"><label>Name<input name="name"></label><label>Image base64<textarea name="data"></textarea></label><button>Save proof image</button></form></html>', { headers: { "content-type": "text/html; charset=utf-8" } });
    if (path === "/proof/commands") { const client = url.searchParams.get("client")!; const pending = commands.get(client) ?? []; commands.set(client, []); return Response.json(pending); }
    if (path === "/proof/action") {
      lastProgress = Date.now();
      const form = await request.formData(), action = String(form.get("action")), client = String(form.get("client")), label = String(form.get("label"));
      if (action === "mode") mode = label;
      else if (action === "release") { mode = "normal"; waiting.splice(0).forEach(done => done()); }
      else if (action === "finish") { setTimeout(finish, 250); return new Response("Proof closed; inspect terminal assertions and STOPPED.json."); }
      else commands.set(client, [...(commands.get(client) ?? []), { action, label }]);
      return Response.redirect(new URL("/proof", url).href, 303);
    }
    if (path === "/proof") return new Response(`<!doctype html><html><meta charset="utf-8"><title>Cashier proof controls</title><form action="/proof/action" method="post"><label>Client<input name="client" value="main"></label><label>Action<select name="action"><option>record</option><option>mode</option><option>release</option><option>refetch</option><option>reauth</option><option>logout</option><option>unmount</option><option>owner</option><option>inline</option><option>commitBill</option><option>commitReturn</option><option>tokenHold</option><option>tokenRelease</option><option>remount</option><option>reauthRejected</option><option>finish</option></select></label><label>Label or mode<input name="label"></label><button>Apply proof control</button></form><p id="status">Mode: ${mode}; Waiting: ${waiting.length}; Recorded: ${observations.map(o => o.label).join(", ")}</p><script>setInterval(async()=>{const s=await(await fetch("/proof/status")).json();document.querySelector("#status").textContent="Mode: "+s.mode+"; Waiting: "+s.waiting+"; Recorded: "+s.labels.join(", ");},100);</script></html>`, { headers: { "content-type": "text/html; charset=utf-8" } });
    if (path.startsWith("/api/")) {
      if (path === "/api/v1/auth/browser/resume" || path === "/api/v1/auth/local:login") {
        const actor = mode === "different-principal" ? id(4) : id(3);
        const payload = Buffer.from(JSON.stringify({ sub: actor, tid: id(2) })).toString("base64url");
        return response({ accessToken: `synthetic.${payload}.signature${++tokenNumber}`, tokenType: "Bearer", expiresInSeconds: mode === "short-session" ? 3 : 900, user: { id: actor, displayName: "Synthetic cashier" } });
      }
      if (path === "/api/v1/auth/browser/logout") return response({});
      if (request.method !== "GET") return response({ error: "Financial mutations prohibited in presentation proof" }, 405);
      if (path === "/api/v1/me/properties" && mode === "grant-loss") return response({properties:[{id:id(9),name:"Other synthetic property",timezone:"UTC"}]});
      if (path === "/api/v1/me/properties") return response({ properties: [{ id: property, name: "Synthetic cashier proof", timezone: "UTC" }, { id: id(9), name: "Other synthetic property", timezone: "UTC" }] });
      if (path.endsWith("/cashier-sessions")) return response({ drawers: [] });
      if (path.endsWith("/reservation-board")) return response({ reservations: rows, nextCursor: null });
      if (path.endsWith("/receivable-transfers/targets")) return response({ targets: [] });
      const n = rows.findIndex(row => path.endsWith("/reservations/" + row.reservationId));
      if (n >= 0) {
        const requestMode = mode;
        if (requestMode === "delay-detail" || requestMode === "deposit-preflight" || (requestMode === "delay-first" && n === 0)) await new Promise<void>(done => waiting.push(done));
        if (requestMode === "denied-detail") return response({ error: "Synthetic reservation permission denied" }, 403);
        const record = rows[requestMode === "mismatch-detail" ? (n + 1) % rows.length : n]!;
        return response({ reservation: { ...record, guests: [{ role: "primary", displayName: record.primaryGuestDisplayName }], folios: requestMode === "empty-detail" ? [] : windows(n).map(w => ({ folioId: w.id, accountId: id(requestMode === "deposit-preflight" ? 9999 : 800 + n), folioNo: w.reference, windowNo: w.windowNo, name: w.name, status: w.status })) }, actions: { canCancel: false, canManageAlerts: false, canModify: false, canOpenPrimaryFolio: false, canReinstate: false } });
      }
      for (let i = 0; i < rows.length; i++) for (const no of [1, 2]) {
        const w = windows(i)[no - 1]!;
        if (path.endsWith("/folios/" + w.id + "/statement")) {
          const requestMode = mode;
          if (requestMode === "delay-statement" || (requestMode === "delay-window1" && no === 1)) await new Promise<void>(done => waiting.push(done));
          if (requestMode === "denied-statement") return response({ error: "Synthetic statement permission denied" }, 403);
          if (requestMode === "error-statement") return response({ error: "Synthetic statement read failed" }, 503);
          const result = statement(i, no);
          if (requestMode === "mismatch-statement") result.reservationId = id(999);
          if (requestMode === "mismatch-window") result.folio.windowNo = 99;
          return response(result);
        }
        if (path.endsWith("/folios/" + w.id + "/hosted-deposits")) return response({ propertyNode: property, folioId: w.id, deposits: [], instruments: [{ instrumentId: id(950), kind: "card_network_token", brand: "Synthetic", last4: "0000", expiry: null, psp: null }] });
      }
      return response({ error: "Synthetic shell endpoint not supplied" }, 503);
    }
    if (path === "/entry.js" || path === "/entry.css") return new Response(Bun.file(join(out, "build", path.slice(1))));
    return new Response('<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Cashier64 actual App proof</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/entry.css"></head><body><div id="root"></div><script type="module" src="/entry.js"></script></body></html>', { headers: { "content-type": "text/html; charset=utf-8" } });
  } });
  const identity = { sourceProofSHA256: new Bun.CryptoHasher("sha256").update(readFileSync(import.meta.filename)).digest("hex"), executable:process.execPath, argv:process.argv, startedAt:new Date(started).toISOString(), testOnlyOwnerInvocations:true, generatedOwnerHooksOutsideProduct:true, pid: process.pid, port: server.port, url: `http://127.0.0.1:${server.port}/p/${property}/today?workspace=finance&proof=main`, controls: `http://127.0.0.1:${server.port}/proof`, actualApp: true, actualAuthenticationGate: true, syntheticTransport: true };
  writeFileSync(join(out, "SERVER.json"), JSON.stringify(identity, null, 2));
  console.log(JSON.stringify(identity));
  try {
    // Reject inside this try/finally; an outer runner timeout alone does not
    // settle the pending promise or guarantee owned-server cleanup.
    await Promise.race([completed, new Promise<never>((_, reject) => {
      deadlineTimer = setInterval(() => {
        const intentionalTimeout = process.env["YELLOW_HANDOFF_INTENTIONAL_TIMEOUT"] === "1";
        if (Date.now() - lastProgress > (intentionalTimeout ? 1_500 : 180_000) || Date.now() - started > 1_500_000) {
          writeFileSync(join(out, "TIMEOUT.json"), JSON.stringify({ started, lastProgress, failedAt: Date.now(), observations: observations.length }));
          reject(new Error("Browser proof exceeded 3 minutes without a proof action or its 25 minute total bound"));
        }
      }, 1_000);
    })]);
    const get = (label: string) => { const matches = observations.filter(o => o.label === label); expect(matches.length).toBe(1); return matches[0]!; };
    for (const label of ["phone375", "phone320", "keyboard", "second-guest", "retry-after-error"]) {
      const o = get(label); expect(o.view).toBe("true"); expect(o.headingFocused).toBe(true); expect(o.headingVisible).toBe(true);
      expect(o.width).toBe(label === "phone320" ? 320 : 375); expect(o.returnExposed).toBe(true);
      expect(o.headingParts.length).toBe(3); expect(o.headingParts.every((p: any) => p.unobscured && p.rect.y >= 0 && p.rect.bottom < o.height - 130)).toBe(true);
      expect(o.heading).toContain(label === "second-guest" ? "SYN-102" : "SYN-101"); expect(o.heading).toContain("Window 1"); expect(o.heading).toContain("₹1,250"); expect(o.overflow).toBe(false);
    }
    const desktop = get("desktop1440"); expect(desktop.width).toBe(1440); expect(desktop.view).toBe("false"); expect(desktop.searchVisible).toBe(true); expect(desktop.headingFocused).toBe(false);
    const returned = get("return-preserves"); expect(returned.view).toBe("false"); expect(returned.search).toBe("Synthetic"); expect(returned.scope).toEqual(["In house & due out"]); expect(returned.page).toContain("13-24 of 30"); expect(returned.focus).toContain("SYN-113");
    const window2 = get("window2"); expect(window2.heading).toContain("Window 2"); expect(window2.heading).toContain("₹0");
    for (const label of ["delay-pending", "return-pending", "late-after-return", "mismatch-detail", "mismatch-statement", "mismatch-window", "denied-detail", "denied-statement", "error-statement", "renewal-pending", "late-after-renewal", "resize-pending", "late-after-resize", "user-left-pending", "late-after-user-left", "empty-detail", "late-old-window"]) { expect(get(label).view).toBe("false"); expect(get(label).headingFocused).toBe(false); }
    expect(get("late-old-window").body).toContain("Window 2"); expect(get("late-old-window").body).toContain("₹0");
    const expired = get("late-after-expiry"); expect(expired.view).not.toBe("true"); expect(expired.authStatus).toBe("expired");
    // The real auth contract retains principal/work on logout and marks it
    // expired, so another principal cannot adopt an unfinished operation.
    const loggedOut = get("late-after-logout"); expect(loggedOut.view).not.toBe("true"); expect(loggedOut.authStatus).toBe("expired");
    expect(loggedOut.body).toContain("Continue your session");
    const locked = get("deposit-preflight-locked"); expect(locked.returnDisabled).toBe(true); expect(locked.resultButtonsDisabled).toBe(true); expect(locked.shellBusy).toBe(true); expect(locked.body).toContain("Reconciling server truth");
    expect(get("deposit-preflight-rejected").body).toContain("Nothing was sent"); expect(get("deposit-preflight-rejected").returnDisabled).toBe(false);
    const old = get("late-old-guest"); expect(old.heading).toContain("SYN-102");
    const before = get("before-background"), after = get("after-background"); expect(after.focus).toBe(before.focus); expect(after.scrollY).toBe(before.scrollY); expect(after.view).toBe(before.view);
    for(const client of ['main','inline'])for(const owner of ['reservation','voice','property']){
      for(const stage of ['detail','statement','token']){
        const pending=get('parent-'+client+'-'+owner+'-'+stage+'-pending');
        if(stage==='token')expect(pending.tokenWaiting).toBeGreaterThan(0);
        const blocked=get('parent-'+client+'-'+owner+'-'+stage+'-blocked');expect(blocked.movements).toEqual(pending.movements);expect(blocked.scrollY).toBe(pending.scrollY);expect(blocked.view).toBe('false');expect(blocked.headingFocused).toBe(false);expect(blocked.parentGuardAllowed).toBe(false);expect(blocked.ownerTrace.some((t:any)=>t.kind==='actual-owner'&&t.owner===owner&&t.state==='on')).toBe(true);
        const cancelled=get('parent-'+client+'-'+owner+'-'+stage+'-unlocked-refetch');expect(cancelled.view).toBe('false');expect(cancelled.headingFocused).toBe(false);
      }
      const committed=get('parent-'+client+'-'+owner+'-bill-commit-veto');expect(committed.view).toBe('false');expect(committed.headingFocused).toBe(false);
      const returned=get('parent-'+client+'-'+owner+'-return-commit-veto');expect(returned.view).toBe('true');expect(returned.headingFocused).toBe(false);
      const beforeReturn=get('parent-'+client+'-'+owner+'-return-request-veto');expect(beforeReturn.view).toBe('true');expect(beforeReturn.parentGuardAllowed).toBe(false);
    }
    for(const client of ['main','inline']){const fresh=get('parent-'+client+'-new-explicit');expect(fresh.view).toBe('true');expect(fresh.headingFocused).toBe(true);expect(fresh.parentGuardAllowed).toBe(true);}
    for(const label of ['late-after-different-principal','late-after-grant-loss','late-after-property','late-after-remount']) {const o=get(label);expect(o.view).not.toBe('true');expect(o.headingFocused).toBe(false);}
    expect(get('late-after-different-principal').ownerTrace.some((t:any)=>t.kind==='auth-rejected'&&t.message.includes('same account'))).toBe(true);
    expect(get('late-after-grant-loss').ownerTrace.some((t:any)=>t.kind==='auth-rejected'&&t.message.includes('no longer granted'))).toBe(true);
    for (const observation of observations) expect(observation.errors).toEqual([]);
    expect(requests.filter(r => r.method !== "GET" && !r.path.startsWith("/api/v1/auth/")).length).toBe(0);
  } finally {
    clearInterval(deadlineTimer);
    waiting.splice(0).forEach(done => done()); server.stop(true);
    writeFileSync(join(out, "REQUESTS.json"), JSON.stringify(requests, null, 2));
    writeFileSync(join(out, "STOPPED.json"), JSON.stringify({ ...identity, stopped: new Date().toISOString() }, null, 2));
  }
}, 1_620_000);
