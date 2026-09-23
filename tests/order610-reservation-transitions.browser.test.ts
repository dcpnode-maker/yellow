import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, resolve } from "node:path";

const repository = resolve(import.meta.dir, "..");
const browserPath = [
  process.env.PROGRAMFILES && resolve(process.env.PROGRAMFILES, "Google/Chrome/Application/chrome.exe"),
  process.env["PROGRAMFILES(X86)"] && resolve(process.env["PROGRAMFILES(X86)"], "Microsoft/Edge/Application/msedge.exe"),
  process.env.LOCALAPPDATA && resolve(process.env.LOCALAPPDATA, "Google/Chrome/Application/chrome.exe"),
].find((candidate): candidate is string => Boolean(candidate && existsSync(candidate)));

type CdpResult<T> = { result?: { value?: T }; exceptionDetails?: { text?: string; exception?: { description?: string } } };
type Geometry = Readonly<{
  width: number;
  contained: boolean;
  actionCards: number;
  evidenceColumns: number;
  noShowDisabled: boolean;
  cancelPostsBeforeConfirmation: number;
  cancelPostsAfterConfirmation: number;
  reinstatePostsAfterConfirmation: number;
  noShowPosts: number;
  screenshotBytes: number;
}>;

const contentTypes: Readonly<Record<string, string>> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function transientPortRead(error: unknown): boolean {
  return typeof error === "object" && error !== null &&
    ["EBUSY", "ENOENT"].includes(String((error as { code?: unknown }).code));
}

test("Order610 built reservation lifecycle route is gated, canonical and contained at 240/375/1440", async () => {
  if (!browserPath) throw new Error("Chrome or Edge is required for Order610 browser proof");
  const bunPath = Bun.which("bun");
  if (!bunPath) throw new Error("Bun is required to build the actual Order610 React app");

  const temporary = await mkdtemp(resolve(tmpdir(), "yellow-order610-real-app-"));
  const buildDirectory = resolve(temporary, "build");
  const profile = resolve(temporary, "chrome-profile");
  let server: ReturnType<typeof Bun.serve> | undefined;
  let chrome: ReturnType<typeof Bun.spawn> | undefined;
  let socket: WebSocket | undefined;

  try {
    const build = Bun.spawn([
      bunPath, "x", "vite", "build",
      "--config", resolve(repository, "frontend/yellow/vite.config.ts"),
      "--outDir", buildDirectory,
      "--emptyOutDir",
    ], { cwd: repository, stdout: "pipe", stderr: "pipe", windowsHide: true });
    const [buildExit, buildStdout, buildStderr] = await Promise.all([
      build.exited,
      new Response(build.stdout).text(),
      new Response(build.stderr).text(),
    ]);
    expect(buildExit, `${buildStdout}\n${buildStderr}`).toBe(0);
    expect(existsSync(resolve(buildDirectory, "index.html"))).toBe(true);

    server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      async fetch(request) {
        const url = new URL(request.url);
        if (url.pathname.startsWith("/api/")) return new Response("Browser test API is injected before app load", { status: 418 });
        const sliced = url.pathname.startsWith("/yellow-next/")
          ? url.pathname.slice("/yellow-next/".length)
          : "";
        const relative = sliced.startsWith("assets/") ? sliced : "index.html";
        const filePath = resolve(buildDirectory, relative);
        if (!filePath.startsWith(buildDirectory) || !existsSync(filePath)) return new Response("Not found", { status: 404 });
        return new Response(Bun.file(filePath), {
          headers: { "content-type": contentTypes[extname(filePath)] ?? "application/octet-stream" },
        });
      },
    });

    chrome = Bun.spawn([
      browserPath,
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--no-first-run",
      "--no-default-browser-check",
      "--remote-debugging-address=127.0.0.1",
      "--remote-debugging-port=0",
      `--user-data-dir=${profile}`,
      "about:blank",
    ], { stdout: "ignore", stderr: "ignore", windowsHide: true });

    const portFile = resolve(profile, "DevToolsActivePort");
    let debuggerPort = "";
    for (let attempt = 0; attempt < 800; attempt += 1) {
      try {
        if (existsSync(portFile)) debuggerPort = (await readFile(portFile, "utf8")).split(/\r?\n/u)[0]?.trim() ?? "";
      } catch (error) {
        if (!transientPortRead(error)) throw error;
      }
      if (debuggerPort || chrome.exitCode !== null) break;
      await Bun.sleep(25);
    }
    if (!debuggerPort) throw new Error(`Browser did not expose DevTools (exit ${chrome.exitCode ?? "unknown"})`);
    const targetResponse = await fetch(`http://127.0.0.1:${debuggerPort}/json/new?${encodeURIComponent("about:blank")}`, { method: "PUT" });
    expect(targetResponse.ok).toBe(true);
    const target = await targetResponse.json() as { webSocketDebuggerUrl?: string };
    if (!target.webSocketDebuggerUrl) throw new Error("Browser target has no debugger endpoint");

    socket = new WebSocket(target.webSocketDebuggerUrl);
    let nextId = 0;
    const pending = new Map<number, { resolve(value: unknown): void; reject(reason: Error): void }>();
    await new Promise<void>((resolveOpen, rejectOpen) => {
      const timer = setTimeout(() => rejectOpen(new Error("Browser debugger socket did not open")), 5_000);
      socket!.addEventListener("open", () => { clearTimeout(timer); resolveOpen(); }, { once: true });
      socket!.addEventListener("error", () => { clearTimeout(timer); rejectOpen(new Error("Browser debugger socket failed")); }, { once: true });
    });
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as {
        id?: number;
        result?: unknown;
        error?: { message?: string };
      };
      if (!message.id) return;
      const command = pending.get(message.id);
      if (!command) return;
      pending.delete(message.id);
      if (message.error) command.reject(new Error(message.error.message ?? "Browser command failed"));
      else command.resolve(message.result);
    });
    const send = <T>(method: string, params: Record<string, unknown> = {}) => new Promise<T>((resolveCommand, rejectCommand) => {
      nextId += 1;
      pending.set(nextId, { resolve: (value) => resolveCommand(value as T), reject: rejectCommand });
      socket!.send(JSON.stringify({ id: nextId, method, params }));
    });
    const evaluate = async <T>(expression: string): Promise<T | undefined> => {
      const result = await send<CdpResult<T>>("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
      if (result.exceptionDetails) {
        throw new Error(`Browser evaluation failed: ${result.exceptionDetails.exception?.description ?? result.exceptionDetails.text ?? "unknown exception"}`);
      }
      return result.result?.value;
    };
    const waitFor = async (expression: string, label: string, timeoutMs = 10_000) => {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        if (await evaluate<boolean>(expression)) return;
        await Bun.sleep(50);
      }
      const state = await evaluate<unknown>("({text:document.body?.innerText?.slice(-2500),calls:window.__yellowApiCalls,errors:window.__yellowRuntimeErrors,warnings:window.__yellowConsoleWarnings})");
      throw new Error(`Timed out waiting for ${label}: ${JSON.stringify(state)}`);
    };
    const clickText = (text: string) => evaluate(`(()=>{const node=[...document.querySelectorAll('button,label')].find((item)=>item.textContent?.includes(${JSON.stringify(text)}));if(!node)throw new Error('Missing '+${JSON.stringify(text)});node.click();})()`);
    const setTextarea = (value: string) => evaluate(`(()=>{const input=document.querySelector('.reservation-lifecycle-confirmation textarea');if(!(input instanceof HTMLTextAreaElement))throw new Error('Missing reason textarea');const setter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set;setter.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true}));})()`);

    await send("Page.enable");
    await send("Runtime.enable");
    await send("Page.addScriptToEvaluateOnNewDocument", { source: `
      const pageUrl=new URL(location.href);
      window.__yellowRuntimeErrors=[]; window.__yellowConsoleWarnings=[]; window.__yellowApiCalls=[]; window.__yellowScenario=pageUrl.searchParams.has('drift')?'drift':pageUrl.searchParams.has('reinstate')?'reinstate':'cancel'; window.__yellowState=window.__yellowScenario==='reinstate'?'cancelled':'due_in'; window.__yellowDetailGets=0;
      addEventListener('error',event=>window.__yellowRuntimeErrors.push(String(event.error?.message||event.message)));
      addEventListener('unhandledrejection',event=>window.__yellowRuntimeErrors.push(String(event.reason)));
      const originalError=console.error.bind(console),originalWarn=console.warn.bind(console);
      console.error=(...args)=>{window.__yellowRuntimeErrors.push(args.map(String).join(' '));originalError(...args)};
      console.warn=(...args)=>{window.__yellowConsoleWarnings.push(args.map(String).join(' '));originalWarn(...args)};
      const property='6081b544-22a1-534f-a86d-bb1ae0519e14',reservation='61000000-0000-4000-8000-000000000001',party='61000000-0000-4000-8000-000000000002';
      const actionsFor=(state)=>state==='cancelled'?{canModify:false,canCancel:false,canReinstate:true,canOpenPrimaryFolio:false,canManageAlerts:true}:state==='no_show'?{canModify:false,canCancel:false,canReinstate:true,canOpenPrimaryFolio:false,canManageAlerts:true}:state==='due_in'?{canModify:true,canCancel:true,canReinstate:false,canOpenPrimaryFolio:true,canManageAlerts:true}:{canModify:true,canCancel:false,canReinstate:false,canOpenPrimaryFolio:false,canManageAlerts:true};
      const detailFor=(state)=>({actions:actionsFor(state),reservation:{reservationId:reservation,primaryPartyId:party,confirmationNo:'Y-610',status:state,bookerPartyId:null,groupId:null,channelCode:'DIRECT',marketCode:'LEISURE',sourceCode:'WEBSITE',originCode:null,currency:'INR',guaranteePolicyId:null,eta:null,etd:null,notes:null,createdAt:'2026-09-23T00:00:00.000Z',cancelledAt:state==='cancelled'?'2026-09-23T10:11:12.000Z':null,cancelReason:state==='cancelled'?'Guest changed plans':null,cancellationNo:state==='cancelled'?'CXL-610':null,guests:[{partyId:party,displayName:'Asha Mehta',role:'primary',sharePct:null}],segments:[{segmentId:'61000000-0000-4000-8000-000000000003',sequence:1,unitTypeId:'61000000-0000-4000-8000-000000000004',sellableUnitId:'61000000-0000-4000-8000-000000000005',from:'2026-09-23T06:30:00.000Z',to:'2026-09-24T06:30:00.000Z',adults:1,childAges:[],ratePlanId:'61000000-0000-4000-8000-000000000006',priceOverride:null,status:state==='cancelled'?'cancelled':'booked'}],folios:[],alerts:[],travel:[],history:[]}});
      window.__resetLifecycleScenario=(scenario)=>{window.__yellowScenario=scenario;window.__yellowState=scenario==='reinstate'?'cancelled':'due_in';window.__yellowDetailGets=0;window.__yellowApiCalls=[];window.__yellowRuntimeErrors=[];window.__yellowConsoleWarnings=[];};
      window.fetch=async(input,init={})=>{const url=new URL(typeof input==='string'?input:input.url,location.href),path=url.pathname,method=init.method||'GET';window.__yellowApiCalls.push({path,method,body:init.body||null,headers:Object.fromEntries(new Headers(init.headers||{}).entries())});let status=200,body,headers={'content-type':'application/json'};
        if(path.endsWith('/auth/demo:enter'))body={accessToken:'order610-browser-token'};
        else if(path.endsWith('/me/properties'))body={properties:[{id:property,name:'Locanda London',timezone:'Asia/Kolkata'}]};
        else if(path.endsWith('/reservation-board'))body={reservations:[{reservationId:reservation,confirmationNo:'Y-610',primaryGuestDisplayName:'Asha Mehta',status:window.__yellowState,operationalState:window.__yellowState,sellableUnitLabel:'101',unitTypeLabel:'DLX',ratePlanLabel:'BAR',channelCode:'DIRECT',adults:1,children:0}],nextCursor:null};
        else if(path.endsWith('/check-in/readiness'))body={canCheckIn:false,blockers:['not_required'],roomCondition:'inspected',primaryFolioId:null,identityGate:{satisfied:true}};
        else if(path.endsWith('/checkout-readiness'))body={ready:false,blockers:['not_required'],reservationStatus:window.__yellowState,room:null,folios:[]};
        else if(path.endsWith('/reservations/'+reservation)&&method==='GET'){window.__yellowDetailGets+=1;if(window.__yellowScenario==='drift'&&window.__yellowDetailGets>=2)window.__yellowState='in_house';body=detailFor(window.__yellowState);}
        else if(path.endsWith('/reservations/'+reservation+'/cancel')&&method==='POST'){window.__yellowState='cancelled';headers['idempotency-replayed']='false';body={reservation:{reservationId:reservation,previousStatus:'due_in',status:'cancelled',cancellationNo:'CXL-610',cancelledAt:'2026-09-23T10:11:12.000Z',releasedClaimCount:1,policyDecision:{evidence:'none',policy_id:null,content_hash:null,rule_before_hours:null,penalty:null},approvalId:null,penaltyJournalId:null}};}
        else if(path.endsWith('/reservations/'+reservation+'/reinstate')&&method==='POST'){window.__yellowState='reserved';headers['idempotency-replayed']='false';body={reservation:{reservationId:reservation,previousStatus:'cancelled',status:'reserved',reclaimedClaimCount:1}};}
        else{status=404;body={title:'Unexpected Order610 browser request',path,method};}
        return new Response(JSON.stringify(body),{status,headers});
      };
    ` });

    const appUrl = `http://127.0.0.1:${server.port}/p/6081b544-22a1-534f-a86d-bb1ae0519e14/res/61000000-0000-4000-8000-000000000001`;
    const proofs: Geometry[] = [];
    for (const width of [240, 375, 1440]) {
      await send("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: width < 600 });
      await send("Page.navigate", { url: appUrl });
      await waitFor("document.readyState==='complete'&&document.body.textContent.includes('Governed status actions')", `${width}px lifecycle card`);
      expect(await evaluate<string>("location.pathname")).toBe("/p/6081b544-22a1-534f-a86d-bb1ae0519e14/res/61000000-0000-4000-8000-000000000001");
      expect(await evaluate<string>("document.title")).toContain("Yellow");
      expect(await evaluate<boolean>("!document.querySelector('vite-error-overlay')&&!document.body.textContent.includes('Internal server error')")).toBe(true);
      expect(await evaluate<string>("document.body.innerText")).toContain("Asha Mehta");
      const noShowDisabled = await evaluate<boolean>(`[...document.querySelectorAll('.reservation-lifecycle-actions button')].some((button)=>button.textContent.includes('Mark no-show')&&button.disabled)`);
      expect(noShowDisabled).toBe(true);
      expect(await evaluate<string>("document.body.innerText")).toContain("day-roll");

      await clickText("Cancel reservation");
      await waitFor("document.body.textContent.includes('Cancellation reason')", `${width}px cancel proposal`);
      const beforeConfirmation = await evaluate<number>("window.__yellowApiCalls.filter(call=>call.method==='POST'&&call.path.endsWith('/cancel')).length");
      expect(beforeConfirmation).toBe(0);
      await setTextarea("Guest changed plans");
      await clickText("I confirm cancellation");
      await clickText("Confirm cancellation");
      await waitFor("document.body.textContent.includes('Reservation cancelled')", `${width}px cancellation success`);
      const cancelPosts = await evaluate<number>("window.__yellowApiCalls.filter(call=>call.method==='POST'&&call.path.endsWith('/cancel')).length");
      expect(cancelPosts).toBe(1);
      expect(await evaluate<unknown>("JSON.parse(window.__yellowApiCalls.find(call=>call.path.endsWith('/cancel')).body)")).toEqual({ reason: "Guest changed plans" });
      expect(await evaluate<boolean>("/^yellow-reservation-lifecycle-/.test(window.__yellowApiCalls.find(call=>call.path.endsWith('/cancel')).headers['idempotency-key'])")).toBe(true);

      await send("Page.navigate", { url: `${appUrl}?drift=${width}` });
      await waitFor("document.body.textContent.includes('Governed status actions')", `${width}px drift reload`);
      await clickText("Cancel reservation");
      await setTextarea("Guest changed plans");
      await clickText("I confirm cancellation");
      await clickText("Confirm cancellation");
      await waitFor("document.body.textContent.includes('changed after this proposal')", `${width}px drift blocked`);
      expect(await evaluate<number>("window.__yellowApiCalls.filter(call=>call.method==='POST'&&call.path.endsWith('/cancel')).length")).toBe(0);

      await send("Page.navigate", { url: `${appUrl}?reinstate=${width}` });
      await waitFor("document.body.textContent.includes('Reinstate reservation')", `${width}px reinstate reload`);
      await clickText("Reinstate reservation");
      await waitFor("document.body.textContent.includes('PostgreSQL will recheck')", `${width}px reinstate proposal`);
      await clickText("I confirm reinstatement");
      await clickText("Confirm reinstatement");
      await waitFor("document.body.textContent.includes('Reservation reinstated')", `${width}px reinstatement success`);
      const reinstatePosts = await evaluate<number>("window.__yellowApiCalls.filter(call=>call.method==='POST'&&call.path.endsWith('/reinstate')).length");
      expect(reinstatePosts).toBe(1);
      expect(await evaluate<boolean>("window.__yellowApiCalls.every(call=>!call.path.endsWith('/no-show'))")).toBe(true);

      const measured = await evaluate<Omit<Geometry, "width" | "screenshotBytes" | "cancelPostsBeforeConfirmation" | "cancelPostsAfterConfirmation" | "reinstatePostsAfterConfirmation" | "noShowPosts">>(`(()=>{const card=document.querySelector('.reservation-lifecycle-card'),evidence=document.querySelector('.reservation-lifecycle-evidence'),actions=document.querySelectorAll('.reservation-lifecycle-actions .lifecycle-action');const rect=card.getBoundingClientRect();return{contained:document.documentElement.scrollWidth<=innerWidth&&rect.left>=0&&rect.right<=innerWidth+1,actionCards:actions.length,evidenceColumns:evidence?getComputedStyle(evidence).gridTemplateColumns.split(' ').filter(Boolean).length:0,noShowDisabled:[...document.querySelectorAll('.reservation-lifecycle-actions button')].some((button)=>button.textContent.includes('Mark no-show')&&button.disabled)}})()`);
      if (!measured) throw new Error(`No lifecycle geometry returned at ${width}px`);
      const shot = await send<{ data: string }>("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
      proofs.push({
        width,
        ...measured,
        cancelPostsBeforeConfirmation: beforeConfirmation ?? -1,
        cancelPostsAfterConfirmation: cancelPosts ?? -1,
        reinstatePostsAfterConfirmation: reinstatePosts ?? -1,
        noShowPosts: await evaluate<number>("window.__yellowApiCalls.filter(call=>call.path.endsWith('/no-show')).length") ?? -1,
        screenshotBytes: Math.floor(shot.data.length * 0.75),
      });
    }

    expect(proofs.every((proof) =>
      proof.contained &&
      proof.actionCards === 3 &&
      proof.noShowDisabled &&
      proof.cancelPostsBeforeConfirmation === 0 &&
      proof.cancelPostsAfterConfirmation === 1 &&
      proof.reinstatePostsAfterConfirmation === 1 &&
      proof.noShowPosts === 0 &&
      proof.screenshotBytes > 5_000
    ), JSON.stringify(proofs)).toBe(true);
    expect(await evaluate<readonly string[]>("window.__yellowRuntimeErrors")).toEqual([]);
    expect(await evaluate<readonly string[]>("window.__yellowConsoleWarnings")).toEqual([]);
  } finally {
    socket?.close();
    chrome?.kill();
    if (chrome) await chrome.exited;
    server?.stop(true);
    await rm(temporary, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
}, 60_000);
