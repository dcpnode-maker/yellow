import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { tmpdir } from "node:os";

const repository = resolve(import.meta.dir, "..");
const browser = [process.env.PROGRAMFILES && resolve(process.env.PROGRAMFILES, "Google/Chrome/Application/chrome.exe"),
  process.env["PROGRAMFILES(X86)"] && resolve(process.env["PROGRAMFILES(X86)"], "Microsoft/Edge/Application/msedge.exe"),
  Bun.which("chromium"), Bun.which("google-chrome")].find((path): path is string => Boolean(path && existsSync(path)));
const id = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
const route = `/p/${id(2)}/invoices`;

// An explicitly synthetic HTTP fixture exercises the real authenticated shell,
// not a replacement dashboard. It is never served by the founder review runtime.
const documentValue = { kind: "india_native_invoice_v1", documentId: id(10), propertyNode: id(2),
  reservationId: id(4), folioId: id(5), seriesId: id(7), documentNumber: "INV/STUDY/17",
  businessDate: "2044-09-06", issuedAt: "2044-09-06T10:00:00.000001Z", recipientRegistrationId: id(6),
  sourceEvidenceHash: "a".repeat(64), documentSha256: "b".repeat(64), previousHash: null,
  contentJson: JSON.stringify({ Version: "1.1", TranDtls: { TaxSch: "GST", SupTyp: "B2B" },
    DocDtls: { Typ: "INV", No: "INV/STUDY/17", Dt: "06/09/2044" },
    SellerDtls: { Gstin: "29AAPFU0939F1ZR", LglNm: "Fictional Yellow Hotel", Addr1: "1 Test Road", Loc: "Bengaluru", Pin: 560001, Stcd: "29" },
    BuyerDtls: { Gstin: "27AAPFU0939F1ZV", LglNm: "Fictional River Guest", Addr1: "1 Test Road", Loc: "Mumbai", Pin: 400001, Stcd: "27", Pos: "27" },
    ItemList: [{ SlNo: "1", IsServc: "Y", HsnCd: "996311", Qty: "1.000", Unit: "OTH", UnitPrice: "100.00", TotAmt: "100.00", AssAmt: "100.00", GstRt: "5.00", IgstAmt: "5.00", TotItemVal: "105.00" }],
    ValDtls: { AssVal: "100.00", IgstVal: "5.00", TotInvVal: "105.00" } }),
};

type CdpSend = <Result>(method: string, params?: Record<string, unknown>) => Promise<Result>;

function transientPortRead(error: unknown): boolean {
  return typeof error === "object" && error !== null &&
    ["EBUSY", "ENOENT"].includes(String((error as { code?: unknown }).code));
}

async function withOwnedCdp<Result>(profile: string, run: (send: CdpSend) => Promise<Result>): Promise<Result> {
  if (!browser) throw new Error("Chrome or Chromium is required for the actual workspace layout proof");
  const chrome = Bun.spawn([
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
      if (port || chrome.exitCode !== null) break;
      await Bun.sleep(25);
    }
    if (!port) throw new Error(`Chromium did not expose a DevTools port (exit ${chrome.exitCode ?? "unknown"})`);
    const targetResponse = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent("about:blank")}`, { method: "PUT" });
    if (!targetResponse.ok) throw new Error(`Chromium target creation failed (${targetResponse.status})`);
    const target = await targetResponse.json() as { webSocketDebuggerUrl?: string };
    if (!target.webSocketDebuggerUrl) throw new Error("Chromium target has no debugger endpoint");
    socket = new WebSocket(target.webSocketDebuggerUrl);
    let commandId = 0;
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
    const send: CdpSend = <CommandResult>(method: string, params: Record<string, unknown> = {}) => new Promise<CommandResult>((resolveCommand, rejectCommand) => {
      commandId += 1;
      const id = commandId;
      const timer = setTimeout(() => {
        pending.delete(id);
        rejectCommand(new Error(`Chromium command timed out: ${method}`));
      }, 5_000);
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
    if (chrome.exitCode === null) chrome.kill();
    await chrome.exited;
  }
}

function driver(skin: string): string {
  return `<pre id="layout-proof" hidden></pre><script type="module">
  const finish=value=>document.querySelector('#layout-proof').textContent=JSON.stringify(value);
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const until=async(predicate,label)=>{for(let i=0;i<200;i++){if(predicate())return;await sleep(20)}throw new Error('Timed out: '+label)};
  try {
    const form=document.querySelector('#login-form');
    await until(()=>!form.querySelector('button[type=submit]').disabled,'login ready');
    form.elements.tenant.value='synthetic';form.elements.email.value='synthetic@example.test';form.elements.password.value='fictional-only';form.requestSubmit();
    await until(()=>document.querySelector('.invoice-workbench__queue-item'),'real invoice queue');
    document.querySelector('.invoice-workbench__queue-item').click();
    await until(()=>document.querySelector('.invoice-workbench__detail')?.textContent.includes('INV/STUDY/17'),'real invoice detail');
    const audit=document.querySelector('.invoice-workbench__audit');
    if(!audit)throw new Error('Document verification disclosure is missing');
    const auditProof={closedInitially:!audit.open,tag:audit.tagName,
      label:audit.querySelector('summary')?.textContent,
      documentHash:audit.textContent.includes('b'.repeat(64)),sourceHash:audit.textContent.includes('a'.repeat(64)),
      reservation:audit.textContent.includes(${JSON.stringify(id(4))}),folio:audit.textContent.includes(${JSON.stringify(id(5))}),
      identityOutsideAudit:!audit.contains(document.querySelector('.invoice-workbench__detail-heading')),
      date:document.querySelector('.invoice-workbench__identity-date')?.getAttribute('datetime')};
    audit.querySelector('summary').click();
    const query=document.querySelector('.invoice-workbench__query');
    query.value='Unsubmitted guest filter';query.setSelectionRange(2,9);
    const focusedControl=innerWidth<=1020?document.querySelector('.invoice-workbench__print'):query;
    focusedControl.focus();
    const mount=document.querySelector('#invoices-mount'),detail=document.querySelector('.invoice-workbench__detail');
    const before={route:location.pathname,property:document.querySelector('#property-select').value,calls:performance.getEntriesByType('resource').length};
    const picker=document.querySelector('#workspace-skin-select');
    const samples=[];
    for(const layout of ['calm','precision','timeline',${JSON.stringify(skin)}]){
      picker.value=layout;picker.dispatchEvent(new Event('change',{bubbles:true}));await sleep(40);
      const nav=document.querySelector('.domain-bar').getBoundingClientRect();
      const heading=document.querySelector('.workbench-head').getBoundingClientRect();
      const content=document.querySelector('#invoices-view').getBoundingClientRect();
      const surface=getComputedStyle(document.documentElement);
      samples.push({layout,root:document.documentElement.dataset.workspaceSkin,
        sameMount:mount===document.querySelector('#invoices-mount'),sameDetail:detail===document.querySelector('.invoice-workbench__detail'),
        sameAudit:audit===document.querySelector('.invoice-workbench__audit'),auditOpen:audit.open,
        query:query.value,selection:[query.selectionStart,query.selectionEnd],focus:document.activeElement===focusedControl,
        searchVisible:query.getClientRects().length>0,
        route:location.pathname,property:document.querySelector('#property-select').value,
        nav:{x:nav.x,y:nav.y,width:nav.width,height:nav.height,bottom:nav.bottom},heading:{x:heading.x,y:heading.y},content:{x:content.x,y:content.y},
        overflow:document.documentElement.scrollWidth>innerWidth+1,
        columns:getComputedStyle(document.querySelector('.invoice-workbench__layout')).gridTemplateColumns,
        ink:surface.getPropertyValue('--ink').trim(),paper:surface.getPropertyValue('--paper').trim(),muted:surface.getPropertyValue('--muted').trim()});
    }
    const afterCalls=performance.getEntriesByType('resource').length;
    audit.querySelector('summary').click();
    const toggle=document.querySelector('#secondary-workspaces-toggle');toggle.click();await sleep(0);
    const menu=document.querySelector('#secondary-workspaces');const menuRect=menu.getBoundingClientRect();
    const menuProof={open:!menu.hidden,contained:menuRect.left>=0&&menuRect.right<=innerWidth+1,
      visibleControls:[...menu.querySelectorAll('button')].filter(button=>getComputedStyle(button).display!=='none').length};
    menu.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await sleep(0);
    menuProof.closed=menu.hidden;menuProof.focus=document.activeElement===toggle;
    finish({width:innerWidth,height:innerHeight,before,afterCalls,samples,menu:menuProof,audit:auditProof,
      reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,
      forcedColors:matchMedia('(forced-colors: active)').matches,
      legacy:!!document.querySelector('#experience-select,#theme-select'),
      choices:[...picker.options].map(option=>option.value)});
  }catch(error){finish({error:String(error?.stack||error)})}
  </script>`;
}

test("Order444 three layouts retain real invoice context, dirty controls and accessible contained navigation", async () => {
  if (!browser) throw new Error("Chrome or Chromium is required for the actual workspace layout proof");
  const html = await Bun.file(resolve(repository, "src/http/operator/index.html")).text();
  let requestedSkin = "calm";
  const server = Bun.serve({ port: 0, hostname: "127.0.0.1", async fetch(request) {
    const path = new URL(request.url).pathname;
    const assets: Record<string, string> = { "/assets/operator.js": "operator.js", "/assets/operator.css": "operator.css", "/assets/operator-invoices.js": "invoices.js" };
    if (assets[path]) return new Response(Bun.file(resolve(repository, "src/http/operator", assets[path])), { headers: { "content-type": path.endsWith(".css") ? "text/css" : "text/javascript" } });
    if (path === "/api/v1/auth/local:login") return Response.json({ accessToken: "synthetic-layout-token", user: { displayName: "Synthetic UI study operator" } });
    if (path.startsWith("/api/")) {
      if (request.headers.get("authorization") !== "Bearer synthetic-layout-token") return Response.json({ type: "unauthorized" }, { status: 401 });
      if (path === "/api/v1/me/properties") return Response.json({ properties: [{ id: id(2), name: "Fictional Yellow Hotel · UI study", timezone: "Asia/Kolkata" }] });
      if (path.endsWith("/invoices/search")) return Response.json({ invoices: { items: [{ documentId: id(10), documentNumber: "INV/STUDY/17", businessDate: "2044-09-06", issuedAt: documentValue.issuedAt, reservationId: id(4), folioId: id(5), recipientRegistrationId: id(6), buyerName: "Fictional River Guest", buyerGstin: "27AAPFU0939F1ZV", currency: "INR", taxableMinor: "10000", taxMinor: "500", totalMinor: "10500" }], matchingCount: "1", nextCursor: null } });
      if (path.endsWith(`/invoices/${id(10)}`)) return Response.json({ invoice: documentValue });
      if (path.endsWith("/receipt")) return Response.json({ type: "forbidden" }, { status: 403 });
      return Response.json({ type: "unexpected_fixture_request" }, { status: 404 });
    }
    if (path === route) return new Response(html.replace("</body>", `${driver(requestedSkin)}</body>`), { headers: { "content-type": "text/html" } });
    return new Response("not found", { status: 404 });
  } });
  const temporary = await mkdtemp(resolve(tmpdir(), "yellow-order444-layout-"));
  try {
    const captures = process.env.YELLOW_WORKSPACE_SCREENSHOTS;
    if (captures) await mkdir(captures, { recursive: true });
    const cases = [[1440,900,"calm"],[1440,900,"precision"],[1440,900,"timeline"],
      [1024,768,"calm"],[768,1024,"precision"],[390,844,"timeline"],[320,844,"calm"]] as const;
    const url = `http://127.0.0.1:${server.port}${route}`;
    await withOwnedCdp(resolve(temporary, "chrome"), async send => {
      await send("Page.enable");
      await send("Runtime.enable");
      await send("Emulation.setEmulatedMedia", { features: [
        { name: "prefers-reduced-motion", value: "reduce" },
        { name: "forced-colors", value: "none" },
      ] });
      for (const [width,height,skin] of cases) {
        requestedSkin = skin;
        await send("Emulation.setDeviceMetricsOverride", {
          width, height, deviceScaleFactor: 1, mobile: width < 768,
          screenWidth: width, screenHeight: height,
        });
        await send("Page.navigate", { url });
        let encoded = "";
        for (let attempt = 0; attempt < 300; attempt += 1) {
          const evaluation = await send<{ result?: { value?: string } }>("Runtime.evaluate", {
            expression: "document.querySelector('#layout-proof')?.textContent || ''",
            returnByValue: true,
          });
          encoded = evaluation.result?.value ?? "";
          if (encoded) break;
          await Bun.sleep(20);
        }
        if (!encoded) throw new Error(`No layout proof ${width}/${skin}`);
        const proof = JSON.parse(encoded);
        expect(proof.error).toBeUndefined();
        expect({ width: proof.width, height: proof.height }).toEqual({ width, height });
        expect(proof.reducedMotion).toBe(true);
        expect(proof.forcedColors).toBe(false);
        expect(proof.legacy).toBe(false);
        expect(proof.choices).toEqual(["calm","precision","timeline"]);
        expect(proof.afterCalls).toBe(proof.before.calls);
        expect(proof.audit).toEqual({closedInitially:true,tag:"DETAILS",label:"Document history & verification",
          documentHash:true,sourceHash:true,reservation:true,folio:true,identityOutsideAudit:true,date:"2044-09-06"});
        expect(proof.menu).toMatchObject({open:true,contained:true,closed:true,focus:true,visibleControls:7});
        for (const sample of proof.samples) {
          expect(sample).toMatchObject({root:sample.layout,sameMount:true,sameDetail:true,sameAudit:true,auditOpen:true,query:"Unsubmitted guest filter",selection:[2,9],focus:true,route:proof.before.route,property:id(2),overflow:false});
          if (width <= 1020) expect(sample.nav.height).toBeLessThanOrEqual(184);
          expect(sample.searchVisible).toBe(width>1020);
        }
        if (proof.width >= 1200) {
          const [calm,precision,timeline] = proof.samples;
          expect(calm.nav.width).toBeGreaterThan(precision.nav.width);
          expect(calm.nav.x).toBeLessThan(calm.content.x);
          expect(precision.nav.x).toBeLessThan(precision.content.x);
          expect(timeline.nav.width).toBeGreaterThan(calm.nav.width*3);
          expect(timeline.nav.bottom).toBeLessThanOrEqual(timeline.content.y);
          expect(new Set([calm.columns,precision.columns,timeline.columns]).size).toBe(3);
        }
        await send("Runtime.evaluate", {expression:"document.querySelector('.invoice-workbench__audit-summary').focus()"});
        for (const expectedOpen of [true, false]) {
          await send("Input.dispatchKeyEvent", {type:"keyDown",key:"Enter",code:"Enter",windowsVirtualKeyCode:13,text:"\r",unmodifiedText:"\r"});
          await send("Input.dispatchKeyEvent", {type:"keyUp",key:"Enter",code:"Enter",windowsVirtualKeyCode:13});
          const keyboard = await send<{result?:{value?:unknown}}>("Runtime.evaluate", {
            expression:"({open:document.querySelector('.invoice-workbench__audit').open,focus:document.activeElement===document.querySelector('.invoice-workbench__audit-summary'),calls:performance.getEntriesByType('resource').length})",returnByValue:true,
          });
          expect(keyboard.result?.value).toEqual({open:expectedOpen,focus:true,calls:proof.afterCalls});
        }
        if (captures) {
          const scroll = await send<{ result?: { value?: { x: number; y: number } } }>("Runtime.evaluate", {
            expression: "new Promise(resolve=>{scrollTo(0,0);requestAnimationFrame(()=>requestAnimationFrame(()=>resolve({x:scrollX,y:scrollY})))})",
            awaitPromise: true,
            returnByValue: true,
          });
          expect(scroll.result?.value).toEqual({ x: 0, y: 0 });
          const screenshot = await send<{ data?: string }>("Page.captureScreenshot", {
            format: "png", fromSurface: true, captureBeyondViewport: false,
          });
          if (!screenshot.data) throw new Error(`No viewport screenshot ${width}/${skin}`);
          await Bun.write(resolve(captures, `${width}-${height}-${skin}.png`), Buffer.from(screenshot.data, "base64"));
        }
      }

      requestedSkin = "timeline";
      await send("Emulation.setDeviceMetricsOverride", {
        width: 390, height: 844, deviceScaleFactor: 1, mobile: true,
        screenWidth: 390, screenHeight: 844,
      });
      await send("Emulation.setEmulatedMedia", { features: [
        { name: "prefers-reduced-motion", value: "reduce" },
        { name: "forced-colors", value: "active" },
      ] });
      await send("Page.navigate", { url });
      let forcedEncoded = "";
      for (let attempt = 0; attempt < 300; attempt += 1) {
        const evaluation = await send<{ result?: { value?: string } }>("Runtime.evaluate", {
          expression: "document.querySelector('#layout-proof')?.textContent || ''",
          returnByValue: true,
        });
        forcedEncoded = evaluation.result?.value ?? "";
        if (forcedEncoded) break;
        await Bun.sleep(20);
      }
      if (!forcedEncoded) throw new Error("No forced-colours layout proof 390/timeline");
      const forcedProof = JSON.parse(forcedEncoded);
      expect(forcedProof).toMatchObject({ width: 390, height: 844, reducedMotion: true, forcedColors: true, legacy: false });
      expect(forcedProof.afterCalls).toBe(forcedProof.before.calls);
      expect(forcedProof.samples.every((sample: { overflow: boolean; sameMount: boolean; sameDetail: boolean }) =>
        !sample.overflow && sample.sameMount && sample.sameDetail)).toBe(true);
      if (captures) {
        await send("Runtime.evaluate", {
          expression: "new Promise(resolve=>{scrollTo(0,0);requestAnimationFrame(()=>requestAnimationFrame(resolve))})",
          awaitPromise: true,
        });
        const screenshot = await send<{ data?: string }>("Page.captureScreenshot", {
          format: "png", fromSurface: true, captureBeyondViewport: false,
        });
        if (!screenshot.data) throw new Error("No forced-colours viewport screenshot 390/timeline");
        await Bun.write(resolve(captures, "390-844-timeline-forced-colors.png"), Buffer.from(screenshot.data, "base64"));
      }
    });
  } finally { server.stop(true); await rm(temporary,{recursive:true,force:true}); }
}, 120_000);
