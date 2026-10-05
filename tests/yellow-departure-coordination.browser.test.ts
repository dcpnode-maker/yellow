import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const browserPath = [
  process.env.PROGRAMFILES && resolve(process.env.PROGRAMFILES, "Google/Chrome/Application/chrome.exe"),
  process.env["PROGRAMFILES(X86)"] && resolve(process.env["PROGRAMFILES(X86)"], "Microsoft/Edge/Application/msedge.exe"),
  process.env.LOCALAPPDATA && resolve(process.env.LOCALAPPDATA, "Google/Chrome/Application/chrome.exe"),
].find((candidate): candidate is string => Boolean(candidate && existsSync(candidate)));

type CdpResult<T> = { result?: { value?: T } };

test("mounted departure coordination is no-write-before-confirm and remains operable at 240/375/1440", async () => {
  if (!browserPath) throw new Error("Chrome or Edge is required for Order 593 browser proof");
  const root = resolve(import.meta.dir, "..");
  const buildRoot = await mkdtemp(resolve(tmpdir(), "yellow-order593-build-"));
  const build = Bun.spawn(["bun", "x", "vite", "build", "--config", "frontend/yellow/vite.config.ts", "--outDir", buildRoot, "--emptyOutDir"], {
    cwd: root,
    stdout: "pipe",
    stderr: "pipe",
    windowsHide: true,
  });
  const [buildExit, buildOut, buildError] = await Promise.all([
    build.exited,
    new Response(build.stdout).text(),
    new Response(build.stderr).text(),
  ]);
  if (buildExit !== 0) await rm(buildRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  expect(buildExit, `${buildOut}\n${buildError}`).toBe(0);

  const publicRoot = buildRoot;
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const pathname = new URL(request.url).pathname;
      const relative = pathname.startsWith("/yellow-next/assets/")
        ? pathname.slice("/yellow-next/".length)
        : "index.html";
      const file = Bun.file(resolve(publicRoot, relative));
      if (!(await file.exists())) return new Response("Not found", { status: 404 });
      const contentType = relative.endsWith(".js")
        ? "application/javascript"
        : relative.endsWith(".css")
          ? "text/css"
          : "text/html";
      return new Response(file, { headers: { "content-type": contentType } });
    },
  });
  const profile = await mkdtemp(resolve(tmpdir(), "yellow-order593-"));
  const chrome = Bun.spawn([
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
  ], { stdout: "ignore", stderr: "pipe", windowsHide: true });
  let diagnostic = "";
  const stderrDone = (async () => {
    const reader = chrome.stderr.getReader();
    const decoder = new TextDecoder();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        diagnostic = (diagnostic + decoder.decode(value, { stream: true })).slice(-4_000);
      }
    } finally {
      reader.releaseLock();
    }
  })();
  let socket: WebSocket | undefined;
  try {
    const portFile = resolve(profile, "DevToolsActivePort");
    let port = "";
    for (let attempt = 0; attempt < 400; attempt += 1) {
      if (existsSync(portFile)) port = (await readFile(portFile, "utf8")).split(/\r?\n/u)[0]?.trim() ?? "";
      port ||= diagnostic.match(/DevTools listening on ws:\/\/(?:127\.0\.0\.1|localhost|\[::1\]):(\d+)\//u)?.[1] ?? "";
      if (port || chrome.exitCode !== null) break;
      await Bun.sleep(25);
    }
    if (!port) throw new Error(`Browser did not expose DevTools: ${diagnostic.slice(-800)}`);
    const targetResponse = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent("about:blank")}`, { method: "PUT" });
    const target = await targetResponse.json() as { webSocketDebuggerUrl?: string };
    if (!target.webSocketDebuggerUrl) throw new Error("Browser target has no debugger endpoint");
    socket = new WebSocket(target.webSocketDebuggerUrl);
    let nextId = 0;
    const pending = new Map<number, { resolve: (value: unknown) => void; reject: (reason: Error) => void }>();
    const opened = new Promise<void>((resolveOpen, rejectOpen) => {
      socket!.addEventListener("open", () => resolveOpen(), { once: true });
      socket!.addEventListener("error", () => rejectOpen(new Error("Browser debugger socket failed")), { once: true });
    });
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as { id?: number; result?: unknown; error?: { message?: string } };
      if (!message.id) return;
      const request = pending.get(message.id);
      if (!request) return;
      pending.delete(message.id);
      if (message.error) request.reject(new Error(message.error.message ?? "Browser command failed"));
      else request.resolve(message.result);
    });
    await opened;
    const send = <T>(method: string, params: Record<string, unknown> = {}) => new Promise<T>((resolveCommand, rejectCommand) => {
      nextId += 1;
      pending.set(nextId, { resolve: (value) => resolveCommand(value as T), reject: rejectCommand });
      socket!.send(JSON.stringify({ id: nextId, method, params }));
    });
    const evaluate = async <T>(expression: string): Promise<T | undefined> => {
      const result = await send<CdpResult<T>>("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
      return result.result?.value;
    };
    const waitFor = async (expression: string, label: string, timeoutMs = 8_000) => {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        if (await evaluate<boolean>(expression)) return;
        await Bun.sleep(50);
      }
      const state = await evaluate<unknown>("({text:document.body?.innerText?.slice(-3000),errors:window.__yellowRuntimeErrors,calls:window.__yellowApiCalls})");
      throw new Error(`Timed out waiting for ${label}: ${JSON.stringify(state)}`);
    };
    await send("Page.enable");
    await send("Runtime.enable");
    await send("Page.addScriptToEvaluateOnNewDocument", { source: `
      window.__yellowRuntimeErrors=[]; window.__yellowConsoleWarnings=[]; window.__yellowApiCalls=[]; window.__yellowRequest=null;
      addEventListener('error',event=>window.__yellowRuntimeErrors.push(String(event.error?.message||event.message)));
      addEventListener('unhandledrejection',event=>window.__yellowRuntimeErrors.push(String(event.reason)));
      const originalError=console.error.bind(console),originalWarn=console.warn.bind(console);
      console.error=(...args)=>{window.__yellowRuntimeErrors.push(args.map(String).join(' '));originalError(...args)};
      console.warn=(...args)=>{window.__yellowConsoleWarnings.push(args.map(String).join(' '));originalWarn(...args)};
      const property='6081b544-22a1-534f-a86d-bb1ae0519e14',reservation='59300000-0000-4000-8000-000000000001';
      const role='59300000-0000-4000-8000-000000000002',staff='59300000-0000-4000-8000-000000000003';
      const row={reservationId:reservation,confirmationNo:'DEP-593',primaryGuestDisplayName:'Fictional Departure Guest',status:'due_out',operationalState:'due_out',sellableUnitLabel:'Room 118',unitTypeLabel:'Twin',ratePlanLabel:'Flexible',adults:1,children:0,channelCode:'DIRECT'};
      const detail={reservation:{reservationId:reservation,primaryPartyId:'59300000-0000-4000-8000-000000000004',confirmationNo:'DEP-593',status:'due_out',bookerPartyId:null,groupId:null,channelCode:'DIRECT',marketCode:'LEISURE',sourceCode:'WEBSITE',originCode:null,currency:'INR',guaranteePolicyId:null,eta:null,etd:'2044-09-22T12:00:00Z',notes:null,createdAt:'2044-09-20T10:00:00Z',cancelledAt:null,cancelReason:null,cancellationNo:null,guests:[{partyId:'59300000-0000-4000-8000-000000000004',displayName:'Fictional Departure Guest',role:'primary',sharePct:null}],segments:[{segmentId:'59300000-0000-4000-8000-000000000005',sequence:1,unitTypeId:'59300000-0000-4000-8000-000000000006',sellableUnitId:'59300000-0000-4000-8000-000000000007',from:'2044-09-20T06:30:00Z',to:'2044-09-22T06:30:00Z',adults:1,childAges:[],ratePlanId:'59300000-0000-4000-8000-000000000008',priceOverride:null,status:'in_house'}],folios:[],alerts:[],travel:[],history:[]}};
      const makeRequest=(patch={})=>Object.assign({requestId:'59300000-0000-4000-8000-000000000009',reservationId:reservation,segmentId:detail.reservation.segments[0].segmentId,spaceId:'59300000-0000-4000-8000-000000000007',serviceKind:'minibar_check',parentRequestId:null,targetRoleId:role,targetRoleName:'Housekeeping Desk',proposalStatus:'pending',version:1,expiresAt:'2044-09-22T10:15:00Z',departureAt:'2044-09-22T12:00:00Z',dueAt:'2044-09-22T10:00:00Z',dueLocal:'22 Sep 2044, 3:30 pm',timezone:'Asia/Kolkata',taskId:null,taskStatus:null,assigneePartyId:null,outcome:null,completedAt:null,eligibleActions:['confirm','withdraw']},patch);
      const overview=()=>({reservationId:reservation,reservationStatus:'due_out',timezone:'Asia/Kolkata',evidence:{segmentId:detail.reservation.segments[0].segmentId,spaceId:'59300000-0000-4000-8000-000000000007',departureAt:'2044-09-22T12:00:00Z'},roles:[{roleId:role,name:'Housekeeping Desk'}],staff:[{partyId:staff,name:'Avery Housekeeping'}],requests:window.__yellowRequest?[window.__yellowRequest]:[]});
      window.fetch=async(input,init={})=>{const url=new URL(typeof input==='string'?input:input.url,location.href),path=url.pathname,method=init.method||'GET';window.__yellowApiCalls.push({path,method,body:init.body||null});let status=200,body;
        if(path.endsWith('/auth/demo:enter'))body={accessToken:'order593-browser-proof'};
        else if(path.endsWith('/me/properties'))body={properties:[{id:property,name:'Fictional Yellow Hotel',timezone:'Asia/Kolkata'}]};
        else if(path.endsWith('/reservation-board'))body={reservations:url.searchParams.get('status')&&url.searchParams.get('status')!=='due_out'?[]:[row],nextCursor:null};
        else if(path.endsWith('/checkout-readiness'))body={ready:false,blockers:['folio_window_missing'],reservationStatus:'due_out',room:{spaceCode:'118'},folios:[]};
        else if(path.endsWith('/departure-services/proposals')&&method==='POST'){window.__yellowRequest=makeRequest();status=201;body={request:window.__yellowRequest,replayed:false};}
        else if(path.includes('/departure-services/')&&['confirm','assign','start','complete'].includes(path.split('/').at(-1))&&method==='POST'){const action=path.split('/').at(-1);const input=JSON.parse(init.body||'{}');window.__yellowRequest=action==='confirm'?makeRequest({proposalStatus:'confirmed',version:2,taskId:'59300000-0000-4000-8000-000000000010',taskStatus:'open',eligibleActions:['assign']}):action==='assign'?makeRequest({proposalStatus:'confirmed',version:3,taskId:'59300000-0000-4000-8000-000000000010',taskStatus:'assigned',assigneePartyId:staff,eligibleActions:['start']}):action==='start'?makeRequest({proposalStatus:'confirmed',version:4,taskId:'59300000-0000-4000-8000-000000000010',taskStatus:'in_progress',assigneePartyId:staff,eligibleActions:['complete']}):makeRequest({proposalStatus:'confirmed',version:5,taskId:'59300000-0000-4000-8000-000000000010',taskStatus:'done',assigneePartyId:staff,outcome:input.outcome,completedAt:'2044-09-22T10:05:00Z',eligibleActions:[]});body={request:window.__yellowRequest,replayed:false};}
        else if(path.endsWith('/departure-services'))body=overview();
        else if(path.endsWith('/reservations/'+reservation))body=detail;
        else{status=503;body={error:'not required by Order 593 proof',path};}
        return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
      };
    ` });
    await send("Emulation.setDeviceMetricsOverride", { width: 375, height: 900, deviceScaleFactor: 1, mobile: true });
    const appUrl = `http://127.0.0.1:${server.port}/yellow-next/p/6081b544-22a1-534f-a86d-bb1ae0519e14/today`;
    await send("Page.navigate", { url: appUrl });
    await waitFor("Boolean(document.querySelector('.yellow-launch'))", "Yellow launcher");
    expect(await evaluate<boolean>("Array.isArray(window.__yellowApiCalls)")).toBe(true);
    expect(await evaluate<string>("location.pathname")).toBe("/yellow-next/p/6081b544-22a1-534f-a86d-bb1ae0519e14/today");
    expect(await evaluate<string>("document.title")).toContain("Yellow");
    expect(await evaluate<boolean>("document.body.innerText.includes('Hotel Operations') && !document.querySelector('vite-error-overlay')")).toBe(true);
    await evaluate("document.querySelector('.yellow-launch').click()");
    await waitFor("Boolean(document.querySelector('[aria-label=\"Ask Yellow\"]'))", "Yellow prompt");
    const submit = async (message: string) => {
      await evaluate(`(()=>{const input=document.querySelector('[aria-label="Ask Yellow"]'),setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(input,${JSON.stringify(message)});input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>{document.querySelector('[aria-label="Send request to Yellow"]').click();resolve(true)})))})()`);
    };
    await submit("request minibar check for DEP-593 in 15 minutes");
    await waitFor("document.querySelector('#departure-inspection-title')?.textContent.includes('Request a bounded room check')", "voice-selected departure card");
    expect(await evaluate<string>("document.querySelector('.departure-service-choice button.selected')?.textContent")).toBe("Minibar check");
    expect(await evaluate<number>("window.__yellowApiCalls.filter(call=>call.method==='POST'&&call.path.includes('/departure-services')).length")).toBe(0);
    expect(await evaluate<string>("document.body.textContent")).toContain("Voice alone created no proposal or task");
    await evaluate(`(()=>{const select=document.querySelector('.departure-role-select select');select.value='59300000-0000-4000-8000-000000000002';select.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('.departure-coordination-card input[type=checkbox]').click()})()`);
    expect(await evaluate<number>("window.__yellowApiCalls.filter(call=>call.method==='POST'&&call.path.includes('/departure-services')).length")).toBe(0);
    await evaluate("document.querySelector('.departure-coordination-card button.primary').click()");
    await waitFor("document.querySelector('.departure-request-status')?.textContent.includes('Proposal pending')", "pending proposal");
    expect(await evaluate<number>("window.__yellowApiCalls.filter(call=>call.method==='POST'&&call.path.endsWith('/proposals')).length")).toBe(1);
    expect(await evaluate<number>("window.__yellowApiCalls.filter(call=>call.method==='POST'&&call.path.endsWith('/confirm')).length")).toBe(0);

    await submit("yes");
    await waitFor("window.__yellowApiCalls.some(call=>call.method==='POST'&&call.path.endsWith('/confirm'))", "voice confirmation POST");
    await waitFor("document.querySelector('.departure-request-status')?.textContent.includes('open')", "confirmed receipt");
    await evaluate(`(()=>{const tab=[...document.querySelectorAll('[role="tab"]')].find(node=>node.textContent.includes('Services'));tab.focus();tab.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));tab.click()})()`);
    await waitFor("Boolean(document.querySelector('[aria-label=\"Departure service queue\"]'))", "role-visible queue");
    await evaluate(`(()=>{const select=document.querySelector('[aria-label="Departure service queue"] select');select.value='59300000-0000-4000-8000-000000000003';select.dispatchEvent(new Event('change',{bubbles:true}))})()`);
    await waitFor("document.body.textContent.includes('Minibar check is now assigned')", "assigned receipt");
    await evaluate(`([...document.querySelectorAll('[aria-label="Departure service queue"] button')].find(node=>node.textContent.includes('Start work'))).click()`);
    await waitFor("document.body.textContent.includes('Minibar check is now in progress')", "in-progress receipt");
    await evaluate(`(()=>{const queue=document.querySelector('[aria-label="Departure service queue"]'),select=[...queue.querySelectorAll('select')].find(node=>[...node.options].some(option=>option.value==='clear'));select.value='clear';select.dispatchEvent(new Event('change',{bubbles:true}));[...queue.querySelectorAll('button')].find(node=>node.textContent.includes('Complete with bounded outcome')).click()})()`);
    await waitFor("document.body.textContent.includes('Minibar check is now Completed')", "completed retained history");

    const geometry: Array<{ width: number; contained: boolean; unknown: boolean; tabs: number; depthCards: number; inertDepthCards: number; screenshotBytes: number }> = [];
    for (const width of [240, 375, 1440]) {
      await send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 600 });
      await Bun.sleep(120);
      await evaluate(`([...document.querySelectorAll('[role="tab"]')].find(node=>node.textContent.includes('Room'))).click()`);
      await Bun.sleep(50);
      const unknown = await evaluate<boolean>(`['Damage inspection','Missing items','Minibar today','Not recorded'].every(text=>document.body.textContent.includes(text))`);
      await evaluate(`(()=>{const tab=[...document.querySelectorAll('[role="tab"]')].find(node=>node.textContent.includes('Services'));tab.click();tab.focus()})()`);
      await Bun.sleep(50);
      const measured = await evaluate<Omit<(typeof geometry)[number], "width" | "screenshotBytes" | "unknown">>(`(()=>{const journey=document.querySelector('.checkout-journey'),rect=journey.getBoundingClientRect(),cards=[...document.querySelectorAll('.checkout-depth-card')];return{contained:document.documentElement.scrollWidth<=innerWidth&&rect.left>=0&&rect.right<=innerWidth,tabs:document.querySelectorAll('[role="tablist"] [role="tab"]').length,depthCards:cards.length,inertDepthCards:cards.filter(card=>card.getAttribute('aria-hidden')==='true'&&getComputedStyle(card).pointerEvents==='none').length}})()`);
      if (!measured) throw new Error(`No departure geometry returned at ${width}px`);
      const shot = await send<{ data: string }>("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
      geometry.push({ width, ...measured, unknown: unknown === true, screenshotBytes: Math.floor(shot.data.length * 0.75) });
    }
    if (!geometry.every(item => item.contained && item.unknown && item.tabs === 5 && item.depthCards === 2 && item.inertDepthCards === 2 && item.screenshotBytes > 5_000)) {
      throw new Error(`Departure viewport proof failed: ${JSON.stringify(geometry)}`);
    }
    expect(await evaluate<string>("document.querySelector('[aria-label=\"Departure service queue\"]')?.textContent")).toContain("Outcome: clear");
    expect(await evaluate<string>("document.activeElement?.textContent")).toContain("Services");
    expect(await evaluate<readonly string[]>("window.__yellowRuntimeErrors")).toEqual([]);
    expect(await evaluate<readonly string[]>("window.__yellowConsoleWarnings")).toEqual([]);
  } finally {
    socket?.close();
    chrome.kill();
    await chrome.exited;
    await stderrDone;
    server.stop(true);
    await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    await rm(buildRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
}, 60_000);
