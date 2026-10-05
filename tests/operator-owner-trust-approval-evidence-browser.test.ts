import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fetchJsonBounded, terminateOwnedProcess } from "./helpers/owned-cdp-proof-lifecycle";

const root = resolve(import.meta.dir, "..");
const chrome = [
  process.env.PROGRAMFILES && resolve(process.env.PROGRAMFILES, "Google/Chrome/Application/chrome.exe"),
  process.env["PROGRAMFILES(X86)"] && resolve(process.env["PROGRAMFILES(X86)"], "Microsoft/Edge/Application/msedge.exe"),
  Bun.which("google-chrome"), Bun.which("chromium"),
].find((path): path is string => Boolean(path && existsSync(path)));

test("owned Chromium mounts all 100 native approval snapshots in six legacy themes with trusted Details keys", async () => {
  if (!chrome) throw new Error("Installed Chromium is required; missing browser is not pixel acceptance");
  const artifactRoot = process.env.YELLOW_OWNER_APPROVAL_PROOF_DIR ?? resolve(root, "../proof/browser");
  await mkdir(artifactRoot, { recursive: true });
  const proof = await mkdtemp(join(artifactRoot, "owned-"));
  const markup = await Bun.file(resolve(root, "src/http/operator/index.html")).text();
  const trustMarkup = markup.match(/<section id="trust-view"[\s\S]*?<section id="status-view"/)?.[0].replace(/<section id="status-view"$/, "");
  if (!trustMarkup) throw new Error("The pinned legacy trust view is missing");
  const html = `<!doctype html><html data-theme="apple"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>OWNER-APPROVAL-03 synthetic native-approval fixture</title><link rel="stylesheet" href="/legacy.css"><link rel="stylesheet" href="/evidence.css"></head><body><main class="fixture">${trustMarkup}</main><style>.fixture{max-width:1100px;margin:16px auto;padding:0 12px}.owner-proof-double{font-size:200%}</style><script type="module">
import {renderOwnerTrustApprovalEvidence as render} from '/evidence.mjs';
const effects=[],keys=[],errors=[];
window.fetch=(...args)=>{effects.push('fetch');throw Error('Unexpected fetch')};
XMLHttpRequest.prototype.send=function(){effects.push('XHR');throw Error('Unexpected XHR')};
for(const name of ['setItem','removeItem','clear'])Storage.prototype[name]=function(){effects.push('storage');throw Error('Unexpected storage')};
for(const name of ['pushState','replaceState'])history[name]=function(){effects.push('history');throw Error('Unexpected history')};
document.addEventListener('keydown',event=>keys.push({key:event.key,trusted:event.isTrusted}));
window.addEventListener('error',event=>errors.push(String(event.message)));
const rows=Object.freeze(Array.from({length:100},(_,i)=>Object.freeze({approvalId:'00000000-0000-4000-8000-'+String(i+1).padStart(12,'0'),accountReference:'00000000-0000-4000-8000-000000001001',ownerLabel:i===1?'<img src=x onerror=window.hostile=1>':'Same owner '+('長いOwnerName'.repeat(i===2?18:1)),accountLabel:'Owner ledger '+(i%3),currency:['USD','JPY','KWD'][i%3],amountMinor:['100','9223372036854775807','12345'][i%3],availableBalanceMinor:['-100','0','100000'][i%3],projectedBalanceMinor:['-1000','-9223372036854775807','87655'][i%3],reason:i===0?'<scr'+'ipt>window.hostile=1</scr'+'ipt> Native repair reason '+('長い理由'.repeat(40)):'Native reason '+i,requesterLabel:i===0?'Native maker '+('長いRequester'.repeat(8)):'Native maker '+i,status:['pending','approved','rejected','expired'][i%4],requestedAt:'2026-10-02T23:30:00.000Z',decidedAt:i%4===0?null:'2026-10-03T00:15:30.123Z',canDecide:i%2===0,canPost:i%3===0})));
const formatted=Object.freeze({[rows[0].approvalId]:Object.freeze({before:'USD -1.00',expense:'USD 1.00',projected:'USD -10.00'}),[rows[1].approvalId]:Object.freeze({expense:'JPY 9223372036854775807'}),[rows[2].approvalId]:Object.freeze({expense:'KWD 12.345'})});
const base=Object.freeze({state:'ready',propertyNode:'00000000-0000-4000-8000-000000000111',propertyLabel:'Original Yellow · synthetic approval requests',readIdentity:'read-1-'+('r'.repeat(180)),page:Object.freeze({approvals:rows,nextCursor:'100'}),formattedAmounts:formatted});
const initial=JSON.stringify(base);const mount=document.createElement('div');mount.id='owner-approval-mount';document.querySelector('#trust-view').hidden=false;document.querySelector('.trust-heading').after(mount);
let detached=true;
function show(change={}){const card=render(document,{...base,...change});detached=detached&&!document.body.contains(card);mount.replaceChildren(card);return card;}
const card=()=>mount.firstElementChild;
function inspect(){const node=card(),rect=node.getBoundingClientRect(),summaries=[...node.querySelectorAll('summary')],articles=[...node.querySelectorAll('article')];return {state:node.dataset.evidenceState,rows:articles.length,order:articles.map(item=>item.dataset.approvalId),text:node.textContent,closed:[...node.querySelectorAll('details')].every(item=>!item.open),targets:summaries.map(item=>item.getBoundingClientRect().height),pageOverflow:document.documentElement.scrollWidth>innerWidth+1,cardOverflow:node.scrollWidth>node.clientWidth+1,wrapped:articles.every(item=>item.getBoundingClientRect().right<=innerWidth+1&&[...item.querySelectorAll('dd')].every(value=>!value.getBoundingClientRect().width||value.scrollWidth<=value.clientWidth+1)),width:rect.width,summaryFocused:document.activeElement?.tagName==='SUMMARY',detailsOpen:node.querySelector('details')?.open,readIdentity:node.dataset.readIdentity,effects:[...effects],keys:[...keys],errors:[...errors],detached,unchanged:JSON.stringify(base)===initial,inert:!node.querySelector('a,button,form,input,script,img'),hostile:window.hostile===1};}
show();window.approvalHarness={inspect,show,bad:(kind)=>show({page:kind==='duplicate'?{approvals:[rows[0],rows[0]],nextCursor:null}:{nextCursor:null}}),accessor:()=>{let calls=0;const array=[rows[0]];Object.defineProperty(array,'0',{get(){calls++;throw Error('getter')}});show({page:{approvals:array,nextCursor:null}});return {calls,state:inspect().state}},observe:()=>({effects:[...effects],keys:[...keys],errors:[...errors],unchanged:JSON.stringify(base)===initial}),focus:()=>{const summary=card().querySelector('summary');summary.focus();return summary.getBoundingClientRect().height},theme:(theme)=>{document.documentElement.dataset.theme=theme},double:(double)=>{mount.classList.toggle('owner-proof-double',double)},openFirst:()=>card().querySelector('details').open,late:()=>new Promise((resolve,reject)=>{const link=document.createElement('link');link.rel='stylesheet';link.href='/legacy.css?late';link.onload=resolve;link.onerror=reject;document.head.append(link)}),unmount:()=>mount.replaceChildren()};
</script></body></html>`;
  await writeFile(join(proof, "fixture.html"), html);
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch(request) {
    const path = new URL(request.url).pathname;
    const files: Record<string, string> = {
      "/": join(proof, "fixture.html"),
      "/legacy.css": resolve(root, "src/http/operator/operator.css"),
      "/evidence.css": resolve(root, "src/http/operator/owner-trust-approval-evidence.css"),
      "/evidence.mjs": resolve(root, "src/http/operator/owner-trust-approval-evidence.mjs"),
      "/static/fonts/urbanist-v1.330.woff2": resolve(root, "src/http/operator/vendor/urbanist-v1.330/Urbanist[ital,wght].woff2"),
    };
    const file = files[path];
    return file ? new Response(Bun.file(file)) : new Response("Not found", { status: 404 });
  } });
  const url = `http://127.0.0.1:${server.port}/`;
  const profile = join(proof, "profile");
  const child = Bun.spawn([chrome, "--headless=new", "--no-first-run", "--no-default-browser-check", "--disable-gpu",
    "--disable-background-networking", `--user-data-dir=${profile}`, "--remote-debugging-port=0", "about:blank"],
  { cwd: root, stdin: "ignore", stdout: "ignore", stderr: "ignore" });
  let socket: WebSocket | undefined;
  let send: ((method: string, params?: Record<string, unknown>) => Promise<any>) | undefined;
  const consoleErrors: string[] = [];
  const layouts: unknown[] = [];
  const pending = new Map<number, { resolve(value: any): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> }>();
  let nextId = 0;
  const wait = async (predicate: () => Promise<boolean>, label: string) => {
    const deadline = performance.now() + 5000;
    while (performance.now() < deadline) { if (await predicate()) return; await Bun.sleep(30); }
    throw new Error(`Owned proof observation timeout: ${label}`);
  };
  try {
    await wait(async () => Bun.file(join(profile, "DevToolsActivePort")).exists(), "debugger startup");
    const port = (await readFile(join(profile, "DevToolsActivePort"), "utf8")).split(/\r?\n/)[0]!;
    const targets = await fetchJsonBounded<{ webSocketDebuggerUrl: string; type: string }[]>(`http://127.0.0.1:${port}/json/list`);
    const target = targets.find(item => item.type === "page");
    if (!target) throw new Error("Owned Chromium did not expose its synthetic page");
    socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Owned CDP open deadline")), 5000);
      socket!.onopen = () => { clearTimeout(timer); resolve(); };
      socket!.onerror = () => { clearTimeout(timer); reject(new Error("Owned CDP open failed")); };
    });
    socket.onmessage = event => {
      const message = JSON.parse(String(event.data));
      if (message.method === "Runtime.exceptionThrown") consoleErrors.push(JSON.stringify(message.params));
      if (message.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(message.params?.type)) consoleErrors.push(JSON.stringify(message.params));
      const current = pending.get(message.id);
      if (!current) return;
      clearTimeout(current.timer); pending.delete(message.id);
      if (message.error) current.reject(new Error(JSON.stringify(message.error))); else current.resolve(message.result);
    };
    send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++nextId;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Owned CDP deadline: ${method}`)); }, 5000);
      pending.set(id, { resolve, reject, timer });
      socket!.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = async <T>(expression: string): Promise<T> => {
      const result = await send!("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
      return result.result.value as T;
    };
    await send("Runtime.enable");
    await send("Page.enable");
    await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await send("Page.navigate", { url });
    await send("Page.bringToFront");
    await send("Emulation.setFocusEmulationEnabled", { enabled: true });
    await wait(() => evaluate<boolean>("Boolean(window.approvalHarness)"), "fixture mount");
    expect(await evaluate<string>("document.title")).toBe("OWNER-APPROVAL-03 synthetic native-approval fixture");
    expect(await evaluate<string>("location.href")).toBe(url);
    for (const theme of ["apple", "android", "win95", "glass", "neo", "erp"]) {
      for (const layout of [{ name: "desktop", width: 1280, double: false }, { name: "narrow", width: 375, double: false }, { name: "doubled", width: 375, double: true }]) {
        await send("Emulation.setDeviceMetricsOverride", { width: layout.width, height: 1000, deviceScaleFactor: 1, mobile: false });
        await evaluate(`approvalHarness.theme(${JSON.stringify(theme)});approvalHarness.double(${layout.double});approvalHarness.show({readIdentity:${JSON.stringify(`${theme}-${layout.name}`)}});window.scrollTo(0,0)`);
        await Bun.sleep(30);
        const before = await evaluate<any>("approvalHarness.inspect()");
        expect(before).toMatchObject({ state: "ready", rows: 100, pageOverflow: false, cardOverflow: false, wrapped: true, closed: true, inert: true, hostile: false, detached: true, unchanged: true });
        expect(before.effects).toEqual([]);
        expect(before.targets.every((height: number) => height >= 44)).toBe(true);
        expect(before.order).toEqual(Array.from({ length: 100 }, (_, i) => `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`));
        expect(before.text).toContain("More rows are available");
        expect(before.text).toContain("Balances are request snapshots");
        expect(before.text).toContain("Native maker");
        expect(before.text).toContain("2026-10-02T23:30:00.000Z");
        expect(before.text).not.toMatch(/approved funds|posted journal|bank payment|settled/i);
        if (theme === "apple") {
          const shot = await send("Page.captureScreenshot", { format: "png" });
          await writeFile(join(proof, `${layout.name}.png`), Buffer.from(shot.data, "base64"));
        }
        await evaluate("approvalHarness.focus()");
        await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, text: "\r" });
        await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
        await wait(() => evaluate<boolean>("approvalHarness.openFirst()"), "trusted Enter opens native Details");
        const opened = await evaluate<any>("approvalHarness.inspect()");
        expect(opened).toMatchObject({ detailsOpen: true, summaryFocused: true, pageOverflow: false, cardOverflow: false, wrapped: true });
        expect(opened.keys.every((key: { trusted: boolean }) => key.trusted)).toBe(true);
        if (theme === "apple") {
          const shot = await send("Page.captureScreenshot", { format: "png" });
          await writeFile(join(proof, `${layout.name}-details.png`), Buffer.from(shot.data, "base64"));
        }
        await send("Input.dispatchKeyEvent", { type: "keyDown", key: " ", code: "Space", windowsVirtualKeyCode: 32, text: " " });
        await send("Input.dispatchKeyEvent", { type: "keyUp", key: " ", code: "Space", windowsVirtualKeyCode: 32 });
        await wait(() => evaluate<boolean>("!approvalHarness.openFirst()"), "trusted Space closes native Details");
        await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
        await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
        expect(await evaluate<boolean>("document.activeElement===document.querySelector('#owner-approval-mount').querySelectorAll('summary')[1]")).toBe(true);
        await evaluate("approvalHarness.show()");
        expect(await evaluate<boolean>("approvalHarness.inspect().closed")).toBe(true);
        layouts.push({ theme, ...layout, targets: before.targets, width: before.width, nativeKeyboard: true, allRows: 100, overflow: false });
      }
    }
    await evaluate("approvalHarness.late()");
    await evaluate("document.querySelectorAll('#owner-approval-mount details').forEach(detail=>{detail.open=true});window.scrollTo(0,0)");
    const late = await evaluate<any>("approvalHarness.inspect()");
    expect(late).toMatchObject({ pageOverflow: false, cardOverflow: false, wrapped: true });
    expect(late.targets.every((height: number) => height >= 44)).toBe(true);
    await evaluate("document.querySelector('#owner-approval-mount summary').scrollIntoView({block:'start'})");
    const lateShot = await send("Page.captureScreenshot", { format: "png" });
    await writeFile(join(proof, "late-theme-details.png"), Buffer.from(lateShot.data, "base64"));
    expect(late.text).toContain("<script>window.hostile=1</script> Native repair reason");
    const browserVersion = await send("Browser.getVersion");
    for (const state of ["loading", "unavailable"]) {
      await evaluate(`approvalHarness.show({state:${JSON.stringify(state)}})`);
      const cleared = await evaluate<any>("approvalHarness.inspect()");
      expect(cleared.rows).toBe(0);
      expect(cleared.text).not.toMatch(/Same owner|Owner ledger|922337|00000000|read-1/);
    }
    await evaluate("approvalHarness.show({page:{approvals:[],nextCursor:null}})");
    expect((await evaluate<any>("approvalHarness.inspect()")).text).toContain("No approval requests were returned");
    await evaluate("approvalHarness.show({page:{approvals:[{currency:'USD'}],nextCursor:null}})");
    expect((await evaluate<any>("approvalHarness.inspect()")).state).toBe("unavailable");
    for (const kind of ['duplicate','missing']) {
      await evaluate(`approvalHarness.bad(${JSON.stringify(kind)})`);
      const bad = await evaluate<any>("approvalHarness.inspect()");
      expect(bad.state).toBe("unavailable"); expect(bad.rows).toBe(0);
      expect(bad.text).not.toContain("Native maker");
    }
    expect(await evaluate<any>("approvalHarness.accessor()")).toEqual({calls:0,state:'unavailable'});
    await evaluate("approvalHarness.show();approvalHarness.unmount()");
    const effects = await evaluate<any>("approvalHarness.observe()");
    // The fixture's independent observers remain available after the detached card is removed.
    expect(await evaluate<boolean>("document.querySelector('#owner-approval-mount').children.length===0")).toBe(true);
    expect(effects).toMatchObject({ effects: [], errors: [], unchanged: true });
    expect(effects.keys.length).toBeGreaterThanOrEqual(54);
    expect(effects.keys.every((key: { trusted: boolean }) => key.trusted)).toBe(true);
    expect(consoleErrors).toEqual([]);
    await writeFile(join(proof, "MOUNTED-PROOF.json"), JSON.stringify({ passed: true, url, layouts, lateTheme: true, allDetailsLateTheme: true, trustedKeyboard: true, rows: 100, consoleErrors, afterUnmount: effects, browser: chrome, browserVersion, mountedNativeCaller: false }, null, 2) + "\n");
    console.log(`OWNER-APPROVAL-03 browser proof: ${layouts.length} layouts, 100 request snapshots, trusted Enter/Space/Tab, ${proof}`);
  } catch (error) {
    const observation = send ? await send("Runtime.evaluate", { expression: "JSON.stringify(window.approvalHarness?.inspect())", returnByValue: true }).catch(failure => String(failure)) : null;
    await writeFile(join(proof, "FAILURE.json"), JSON.stringify({ error: String(error), layouts, consoleErrors, observation }, null, 2) + "\n");
    throw error;
  } finally {
    await terminateOwnedProcess(child, send ? () => send!("Browser.close") : undefined);
    socket?.close();
    for (const item of pending.values()) { clearTimeout(item.timer); item.reject(new Error("Owned proof closed")); }
    pending.clear(); server.stop(true);
  }
}, 90000);
