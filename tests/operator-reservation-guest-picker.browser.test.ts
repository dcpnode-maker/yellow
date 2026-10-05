import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const repository = resolve(import.meta.dir, "..");
const browser = [
  process.env.PROGRAMFILES && resolve(process.env.PROGRAMFILES, "Google/Chrome/Application/chrome.exe"),
  process.env["PROGRAMFILES(X86)"] && resolve(process.env["PROGRAMFILES(X86)"], "Google/Chrome/Application/chrome.exe"),
  process.env.LOCALAPPDATA && resolve(process.env.LOCALAPPDATA, "Google/Chrome/Application/chrome.exe"),
  process.env.PROGRAMFILES && resolve(process.env.PROGRAMFILES, "Microsoft/Edge/Application/msedge.exe"),
  Bun.which("google-chrome"), Bun.which("chromium"), Bun.which("chromium-browser"),
].find((candidate): candidate is string => Boolean(candidate && existsSync(candidate)));

const uuid = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
const PROPERTY = uuid(2);
const RESERVATION = uuid(4);
const PRIMARY = uuid(10);
const OLD_GUEST = uuid(11);
const SELECTED_GUEST = uuid(12);
const CREATED_GUEST = uuid(13);
const route = `/p/${PROPERTY}/res/${RESERVATION}`;

type CdpSend = <Result>(method: string, params?: Record<string, unknown>) => Promise<Result>;

function transientPortRead(error: unknown): boolean {
  return typeof error === "object" && error !== null &&
    ["EBUSY", "ENOENT"].includes(String((error as { code?: unknown }).code));
}

async function withOwnedCdp<Result>(profile: string, run: (send: CdpSend) => Promise<Result>): Promise<Result> {
  if (!browser) throw new Error("Chrome or Edge is required for the Order 445 whole-editor proof");
  const child = Bun.spawn([
    browser, "--headless=new", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage",
    "--no-first-run", "--no-default-browser-check", "--remote-debugging-address=127.0.0.1",
    "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank",
  ], { stdout: "ignore", stderr: "ignore" });
  let socket: WebSocket | null = null;
  try {
    const portFile = resolve(profile, "DevToolsActivePort");
    let port = "";
    for (let attempt = 0; attempt < 800; attempt += 1) {
      try {
        if (existsSync(portFile)) port = (await Bun.file(portFile).text()).split(/\r?\n/, 1)[0] ?? "";
      } catch (error) {
        if (!transientPortRead(error)) throw error;
      }
      if (port || child.exitCode !== null) break;
      await Bun.sleep(25);
    }
    if (!port) throw new Error(`Chromium did not expose a DevTools port (exit ${child.exitCode ?? "unknown"})`);
    const response = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent("about:blank")}`, { method: "PUT" });
    if (!response.ok) throw new Error(`Chromium target creation failed (${response.status})`);
    const target = await response.json() as { webSocketDebuggerUrl?: string };
    if (!target.webSocketDebuggerUrl) throw new Error("Chromium target has no debugger endpoint");
    socket = new WebSocket(target.webSocketDebuggerUrl);
    let nextId = 0;
    const pending = new Map<number, {
      resolve: (value: unknown) => void;
      reject: (reason: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }>();
    await new Promise<void>((resolveOpen, rejectOpen) => {
      const timer = setTimeout(() => rejectOpen(new Error("Chromium debugger socket did not open")), 5_000);
      socket?.addEventListener("open", () => { clearTimeout(timer); resolveOpen(); }, { once: true });
      socket?.addEventListener("error", () => { clearTimeout(timer); rejectOpen(new Error("Chromium debugger socket failed")); }, { once: true });
    });
    socket.addEventListener("message", event => {
      const message = JSON.parse(String(event.data)) as { id?: number; result?: unknown; error?: { message?: string } };
      if (!message.id) return;
      const command = pending.get(message.id);
      if (!command) return;
      pending.delete(message.id);
      clearTimeout(command.timer);
      if (message.error) command.reject(new Error(message.error.message ?? "Chromium command failed"));
      else command.resolve(message.result);
    });
    const send: CdpSend = <CommandResult>(method: string, params: Record<string, unknown> = {}) =>
      new Promise<CommandResult>((resolveCommand, rejectCommand) => {
        nextId += 1;
        const id = nextId;
        const timer = setTimeout(() => {
          pending.delete(id);
          rejectCommand(new Error(`Chromium command timed out: ${method}`));
        }, 7_500);
        pending.set(id, { resolve: value => resolveCommand(value as CommandResult), reject: rejectCommand, timer });
        socket?.send(JSON.stringify({ id, method, params }));
      });
    try {
      return await run(send);
    } finally {
      for (const command of pending.values()) {
        clearTimeout(command.timer);
        command.reject(new Error("Chromium debugger closed with a command pending"));
      }
      pending.clear();
    }
  } finally {
    socket?.close();
    if (child.exitCode === null) child.kill();
    await child.exited;
  }
}

function reservationDetail(guestId = OLD_GUEST, guestName = "Existing Guest") {
  const savedAllocation = guestId === SELECTED_GUEST;
  return {
    reservation: {
      reservationId: RESERVATION,
      confirmationNo: "Y-Q445-001",
      primaryPartyId: PRIMARY,
      status: "reserved",
      channelCode: "direct",
      currency: "INR",
      createdAt: "2045-09-07T08:00:00.000000Z",
      notes: null,
      guests: [
        { partyId: PRIMARY, displayName: "Primary Guest", role: "primary", sharePct: savedAllocation ? "62.75" : "60.00" },
        { partyId: guestId, displayName: guestName, role: "sharer", sharePct: savedAllocation ? "37.25" : "40.00" },
      ],
      segments: [{ segmentId: uuid(30), sequence: 1, from: "2045-09-07T10:00:00.000000Z", to: "2045-09-09T10:00:00.000000Z", adults: 2, status: "booked", sellableUnitId: uuid(31), unitTypeId: uuid(32) }],
      folios: [], alerts: [], travel: [], history: [],
    },
    actions: { canModify: false, canCancel: false, canReinstate: false, canOpenPrimaryFolio: false },
  };
}

function wholeEditorDriver(): string {
  return `<pre id="order445-proof" hidden></pre><script>
  (()=>{
    const output=document.querySelector('#order445-proof');
    const finish=value=>{output.textContent=JSON.stringify(value)};
    const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
    const until=async(check,label)=>{for(let i=0;i<400;i+=1){if(check())return;await sleep(20)}throw new Error('Timed out: '+label)};
    const state=async()=>await (await fetch('/__order445/state')).json();
    const set=(input,value)=>{input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}))};
    const enter=input=>!input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true,cancelable:true}));
    const row=(index=0)=>document.querySelectorAll('.reservation-guest-row')[index];
    (async()=>{try{
      await until(()=>!document.querySelector('#login-form button[type=submit]').disabled,'login ready');
      const login=document.querySelector('#login-form');
      login.elements.tenant.value='q445-synthetic';login.elements.email.value='operator@example.test';login.elements.password.value='fixture-only';
      login.requestSubmit();
      await until(()=>!document.querySelector('#reservation-detail-drawer').hidden&&!document.querySelector('#reservation-detail-content').hidden,'reservation detail');
      document.querySelector('.reservation-guest-allocation-action').click();
      await until(()=>!document.querySelector('#reservation-guest-form').hidden&&row()?.querySelector('.party-profile-picker-change'),'guest editor');
      const initial={route:location.pathname,primary:document.querySelector('#reservation-primary-party').value,
        rows:document.querySelectorAll('.reservation-guest-row').length,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches};

      let current=row();current.querySelector('.party-profile-picker-change').click();
      let search=current.querySelector('.party-profile-picker-search-input');set(search,'Asha');
      const enterPrevented=enter(search);
      await until(()=>current.querySelectorAll('.party-profile-picker-result-action').length===3,'search results');
      const firstResults=[...current.querySelectorAll('.party-profile-picker-result-action')];
      const excluded={primary:firstResults.find(button=>button.dataset.partyId==='${PRIMARY}')?.disabled===true,
        ownRowAllowed:firstResults.find(button=>button.dataset.partyId==='${OLD_GUEST}')?.disabled===false};
      firstResults.find(button=>button.dataset.partyId==='${SELECTED_GUEST}').click();
      await until(()=>current.querySelector('input[name=partyId]').value==='${SELECTED_GUEST}','explicit selected party');
      const selected={hiddenType:current.querySelector('input[name=partyId]').type,partyId:current.querySelector('input[name=partyId]').value,
        visibleText:current.querySelector('.party-profile-picker-selected').textContent};

      document.querySelector('#add-reservation-guest').click();
      await until(()=>document.querySelectorAll('.reservation-guest-row').length===2&&row(1).querySelector('.party-profile-picker-search-input'),'second picker');
      let second=row(1);let secondSearch=second.querySelector('.party-profile-picker-search-input');set(secondSearch,'Asha');enter(secondSearch);
      await until(()=>second.querySelectorAll('.party-profile-picker-result-action').length===3,'duplicate results');
      const duplicateButtons=[...second.querySelectorAll('.party-profile-picker-result-action')];
      const duplicateRejected=duplicateButtons.find(button=>button.dataset.partyId==='${SELECTED_GUEST}')?.disabled===true;
      second.querySelector('.party-profile-picker-cancel').click();
      second.querySelector('.party-profile-picker-create').open=true;
      set(second.querySelector('.party-profile-picker-create-display-name'),'Created Guest');
      second.querySelector('.party-profile-picker-create-action').click();
      await until(()=>second.querySelector('input[name=partyId]').value==='${CREATED_GUEST}','created party selected');
      second.querySelector('.party-profile-picker-change').click();
      second.querySelector('.party-profile-picker-cancel').click();
      const createCancelled=second.querySelector('input[name=partyId]').value===''&&document.activeElement===second.querySelector('.party-profile-picker-search-input');
      second.querySelector('.remove-row').click();
      await until(()=>document.querySelectorAll('.reservation-guest-row').length===1,'created draft removed');

      document.querySelector('#add-reservation-guest').click();
      await until(()=>document.querySelectorAll('.reservation-guest-row').length===2&&row(1).querySelector('.party-profile-picker-search-input'),'late row');
      const staleRow=row(1);const staleSearch=staleRow.querySelector('.party-profile-picker-search-input');set(staleSearch,'Late Guest');
      staleRow.querySelector('.party-profile-picker-search-action').click();
      await until(()=>staleRow.querySelector('.party-profile-picker-search-action').textContent.includes('Searching'),'late search began');
      staleRow.querySelector('.remove-row').click();
      await sleep(350);
      const removedStale={disconnected:!staleRow.isConnected,results:staleRow.querySelectorAll('.party-profile-picker-result').length};

      current=row();current.querySelector('select[name=role]').value='sharer';current.querySelector('select[name=role]').dispatchEvent(new Event('change',{bubbles:true}));
      set(current.querySelector('input[name=sharePct]'),'37.25');set(document.querySelector('#reservation-primary-share'),'62.75');
      await until(()=>document.querySelector('#reservation-share-total').textContent.includes('ready'),'exact decimal total');
      const beforeSave=await state();
      document.querySelector('#reservation-guest-form').requestSubmit();
      await until(async()=>Boolean((await state()).putCount===1),'explicit save PUT');
      await until(()=>document.querySelector('#reservation-guest-form .form-message').textContent.includes('saved'),'post-save refresh');
      const afterSave=await state();

      current=row();current.querySelector('.party-profile-picker-change').click();search=current.querySelector('.party-profile-picker-search-input');set(search,'Late Context');
      current.querySelector('.party-profile-picker-search-action').click();
      await until(()=>current.querySelector('.party-profile-picker-search-action').textContent.includes('Searching'),'context search began');
      document.querySelector('#reservation-detail-close').click();
      await sleep(350);
      const staleContext={drawerHidden:document.querySelector('#reservation-detail-drawer').hidden,
        hostChildren:current.querySelector('.party-profile-picker-host').childElementCount,putCount:(await state()).putCount};

      finish({initial,enterPrevented,excluded,selected,duplicateRejected,createCancelled,removedStale,beforeSave,afterSave,staleContext,
        total:'100.00',viewport:{width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth+1}});
    }catch(error){finish({driverError:String(error?.stack||error)})}})();
  })();
  </script>`;
}

test("Order445 real operator editor binds explicit Party selection to one deliberate allocation PUT", async () => {
  if (!browser) throw new Error("Chrome or Edge is required for the Order 445 whole-editor proof");
  const sourceHtml = await Bun.file(resolve(repository, "src/http/operator/index.html")).text();
  const requests: Array<{ path: string; method: string; authorization: string | null; idempotencyKey: string | null; body: unknown }> = [];
  let putBody: unknown = null;
  let saved = false;
  const profiles = [
    { partyId: PRIMARY, kind: "person", displayName: "Primary Guest", roles: ["guest"], contacts: [{ kind: "email", hint: "p•••@example.test" }] },
    { partyId: OLD_GUEST, kind: "person", displayName: "Existing Guest", roles: ["guest"], contacts: [] },
    { partyId: SELECTED_GUEST, kind: "person", displayName: "Asha Selected", roles: ["guest"], contacts: [{ kind: "email", hint: "a•••@example.test" }] },
  ];
  const server = Bun.serve({ port: 0, hostname: "127.0.0.1", async fetch(request) {
    const url = new URL(request.url), path = url.pathname, method = request.method;
    const assets: Record<string, { file: string; type: string }> = {
      "/assets/operator.js": { file: "src/http/operator/operator.js", type: "text/javascript; charset=utf-8" },
      "/assets/operator.css": { file: "src/http/operator/operator.css", type: "text/css; charset=utf-8" },
      "/assets/operator-party-profile-picker.js": { file: "src/http/operator/party-profile-picker.js", type: "text/javascript; charset=utf-8" },
      "/static/fonts/urbanist-v1.330.woff2": { file: "src/http/operator/vendor/urbanist-v1.330/Urbanist[ital,wght].woff2", type: "font/woff2" },
    };
    if (assets[path]) return new Response(Bun.file(resolve(repository, assets[path].file)), { headers: { "content-type": assets[path].type } });
    if (path === "/favicon.ico") return new Response(null, { status: 204 });
    if (path === "/__order445/state") return Response.json({ putCount: requests.filter(item => item.method === "PUT").length, putBody });
    if (path === "/api/v1/auth/local:login" && method === "POST") {
      return Response.json({ accessToken: "q445-whole-editor-token", user: { displayName: "Q445 Fixture Operator" } });
    }
    if (path.startsWith("/api/")) {
      const body = method === "GET" ? null : await request.json();
      requests.push({ path: `${path}${url.search}`, method, authorization: request.headers.get("authorization"),
        idempotencyKey: request.headers.get("idempotency-key"), body });
      if (request.headers.get("authorization") !== "Bearer q445-whole-editor-token") return Response.json({ detail: "unauthorized" }, { status: 401 });
      if (path === "/api/v1/me/properties") return Response.json({ properties: [{ id: PROPERTY, name: "Order445 Fictional Hotel", timezone: "Asia/Kolkata" }] });
      if (path === `/api/v1/properties/${PROPERTY}/reservations/${RESERVATION}`) return Response.json(reservationDetail(saved ? SELECTED_GUEST : OLD_GUEST, saved ? "Asha Selected" : "Existing Guest"));
      if (path === `/api/v1/properties/${PROPERTY}/reservation-board`) return Response.json({ reservations: [], nextCursor: null });
      if (path === `/api/v1/properties/${PROPERTY}/reservation-guests`) return Response.json({
        reservation: reservationDetail(saved ? SELECTED_GUEST : OLD_GUEST, saved ? "Asha Selected" : "Existing Guest").reservation,
      });
      if (path.endsWith("/checkout-readiness")) return Response.json({ detail: "not applicable" }, { status: 403 });
      if (path === `/api/v1/properties/${PROPERTY}/parties:search` && method === "POST") {
        if ((body as { query?: unknown }).query === "Late Guest" || (body as { query?: unknown }).query === "Late Context") await Bun.sleep(250);
        return Response.json({ profiles });
      }
      if (path === `/api/v1/properties/${PROPERTY}/parties` && method === "POST") return Response.json({
        party: { partyId: CREATED_GUEST, kind: "person", displayName: "Created Guest", roles: ["guest"], contacts: [] },
      });
      if (path === `/api/v1/properties/${PROPERTY}/reservations/${RESERVATION}/guests` && method === "PUT") {
        putBody = body; saved = true;
        return Response.json({ reservation: { changed: true } });
      }
      return Response.json({ detail: `unexpected ${method} ${path}` }, { status: 404 });
    }
    if (path === route) return new Response(sourceHtml.replace("</body>", `${wholeEditorDriver()}</body>`), { headers: { "content-type": "text/html; charset=utf-8" } });
    return new Response("not found", { status: 404 });
  } });
  const temporary = await mkdtemp(resolve(tmpdir(), "yellow-order445-editor-"));
  try {
    const proof = await withOwnedCdp(resolve(temporary, "chrome"), async send => {
      await send("Page.enable");
      await send("Runtime.enable");
      await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
      await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 940, deviceScaleFactor: 1, mobile: false, screenWidth: 1280, screenHeight: 940 });
      await send("Page.navigate", { url: `http://127.0.0.1:${server.port}${route}` });
      let encoded = "";
      for (let attempt = 0; attempt < 700; attempt += 1) {
        const evaluation = await send<{ result?: { value?: string } }>("Runtime.evaluate", {
          expression: "document.querySelector('#order445-proof')?.textContent || ''", returnByValue: true,
        });
        encoded = evaluation.result?.value ?? "";
        if (encoded) break;
        await Bun.sleep(20);
      }
      if (!encoded) throw new Error("Order445 whole-editor browser proof did not complete");
      const value = JSON.parse(encoded) as Record<string, unknown>;
      if (value.driverError) throw new Error(String(value.driverError));

      const openEditor = `new Promise(async resolve=>{
        history.pushState({yellowSurface:'reservation-detail'},'',${JSON.stringify(route)});
        dispatchEvent(new PopStateEvent('popstate'));
        for(let i=0;i<300&&!document.querySelector('.reservation-guest-allocation-action');i+=1)await new Promise(done=>setTimeout(done,20));
        document.querySelector('.reservation-guest-allocation-action')?.click();
        for(let i=0;i<300&&(document.querySelector('#reservation-guest-form')?.hidden||!document.querySelector('.party-profile-picker-change'));i+=1)await new Promise(done=>setTimeout(done,20));
        await new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done)));
        const panel=document.querySelector('.reservation-guest-allocation-panel'),form=document.querySelector('#reservation-guest-form'),picker=document.querySelector('.party-profile-picker');
        resolve({width:innerWidth,height:innerHeight,route:location.pathname,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,
          panelVisible:panel?.hidden===false,formVisible:form?.hidden===false,pickerVisible:Boolean(picker&&picker.getClientRects().length),
          focusInside:Boolean(form?.contains(document.activeElement)),overflow:document.documentElement.scrollWidth>innerWidth+1,
          pickerOverflow:Boolean(picker&&picker.scrollWidth>picker.clientWidth+1),buttonHeight:picker?.querySelector('button')?.getBoundingClientRect().height||0});
      })`;
      const desktop = await send<{ result?: { value?: Record<string, unknown> } }>("Runtime.evaluate", {
        expression: openEditor, awaitPromise: true, returnByValue: true,
      });
      const captures = process.env.YELLOW_ORDER445_SCREENSHOTS;
      if (captures) {
        await mkdir(captures, { recursive: true });
        await send("Runtime.evaluate", { expression: "document.querySelector('.reservation-guest-allocation-panel')?.scrollIntoView({block:'start'});new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))", awaitPromise: true });
        const shot = await send<{ data?: string }>("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
        if (!shot.data) throw new Error("Order445 desktop screenshot was not returned");
        await Bun.write(resolve(captures, "reservation-guest-picker-1280.png"), Buffer.from(shot.data, "base64"));
      }

      await send("Emulation.setDeviceMetricsOverride", { width: 375, height: 812, deviceScaleFactor: 1, mobile: true, screenWidth: 375, screenHeight: 812 });
      const mobile = await send<{ result?: { value?: Record<string, unknown> } }>("Runtime.evaluate", {
        expression: `new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>{const panel=document.querySelector('.reservation-guest-allocation-panel'),form=document.querySelector('#reservation-guest-form'),picker=document.querySelector('.party-profile-picker');resolve({width:innerWidth,height:innerHeight,route:location.pathname,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,panelVisible:panel?.hidden===false,formVisible:form?.hidden===false,pickerVisible:Boolean(picker&&picker.getClientRects().length),focusInside:Boolean(form?.contains(document.activeElement)),overflow:document.documentElement.scrollWidth>innerWidth+1,pickerOverflow:Boolean(picker&&picker.scrollWidth>picker.clientWidth+1),buttonHeight:picker?.querySelector('button')?.getBoundingClientRect().height||0})})))`,
        awaitPromise: true, returnByValue: true,
      });
      if (captures) {
        await send("Runtime.evaluate", { expression: "document.querySelector('.reservation-guest-allocation-panel')?.scrollIntoView({block:'start'});new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))", awaitPromise: true });
        const shot = await send<{ data?: string }>("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
        if (!shot.data) throw new Error("Order445 mobile screenshot was not returned");
        await Bun.write(resolve(captures, "reservation-guest-picker-375.png"), Buffer.from(shot.data, "base64"));
      }
      return { value, desktop: desktop.result?.value, mobile: mobile.result?.value };
    });

    expect(proof.value).toMatchObject({
      initial: { route, primary: PRIMARY, rows: 1, reducedMotion: true },
      enterPrevented: true,
      excluded: { primary: true, ownRowAllowed: true },
      selected: { hiddenType: "hidden", partyId: SELECTED_GUEST },
      duplicateRejected: true,
      createCancelled: true,
      removedStale: { disconnected: true, results: 0 },
      beforeSave: { putCount: 0, putBody: null },
      afterSave: { putCount: 1 },
      staleContext: { drawerHidden: true, hostChildren: 0, putCount: 1 },
      total: "100.00",
      viewport: { width: 1280, height: 940, overflow: false },
    });
    expect((proof.value.selected as { visibleText: string }).visibleText).toContain("Asha Selected");
    expect((proof.value.selected as { visibleText: string }).visibleText).not.toContain(SELECTED_GUEST);
    expect((proof.value.afterSave as { putBody: unknown }).putBody).toEqual({
      primarySharePct: "62.75",
      guests: [{ partyId: SELECTED_GUEST, role: "sharer", sharePct: "37.25" }],
    });
    expect(proof.desktop).toMatchObject({ width: 1280, height: 940, route, reducedMotion: true,
      panelVisible: true, formVisible: true, pickerVisible: true, focusInside: true, overflow: false, pickerOverflow: false });
    expect((proof.desktop?.buttonHeight as number)).toBeGreaterThanOrEqual(44);
    expect(proof.mobile).toMatchObject({ width: 375, height: 812, route, reducedMotion: true,
      panelVisible: true, formVisible: true, pickerVisible: true, focusInside: true, overflow: false, pickerOverflow: false });
    expect((proof.mobile?.buttonHeight as number)).toBeGreaterThanOrEqual(44);

    const writes = requests.filter(item => item.method !== "GET");
    const allocationWrites = requests.filter(item => item.method === "PUT");
    expect(allocationWrites).toHaveLength(1);
    const allocationWrite = allocationWrites[0];
    if (!allocationWrite) throw new Error("The explicit allocation save was not observed");
    expect(allocationWrite).toMatchObject({
      path: `/api/v1/properties/${PROPERTY}/reservations/${RESERVATION}/guests`,
      method: "PUT", authorization: "Bearer q445-whole-editor-token",
      body: { primarySharePct: "62.75", guests: [{ partyId: SELECTED_GUEST, role: "sharer", sharePct: "37.25" }] },
    });
    expect(allocationWrite.idempotencyKey).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(writes.filter(item => item.path.endsWith("/parties"))).toHaveLength(1);
    expect(writes.filter(item => item.path.endsWith("parties:search")).length).toBeGreaterThanOrEqual(4);
    expect(requests.filter(item => item.path.endsWith("parties:search")).every(item =>
      (item.body as { limit?: unknown }).limit === 20)).toBe(true);
    expect(requests.filter(item => item.path.startsWith("/api/")).every(item => item.authorization === "Bearer q445-whole-editor-token")).toBe(true);
  } finally {
    server.stop(true);
    await rm(temporary, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
}, 60_000);
