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

test("owned Chromium mounts exact native expense previews in the original six themes with trusted Details keys", async () => {
  if (!chrome) throw new Error("Installed Chromium is required; missing browser is not pixel acceptance");
  const artifactRoot = process.env.YELLOW_OWNER_PREVIEW_PROOF_DIR ?? resolve(root, "../proof/browser");
  await mkdir(artifactRoot, { recursive: true });
  const proof = await mkdtemp(join(artifactRoot, "owned-"));
  const markup = await Bun.file(resolve(root, "src/http/operator/index.html")).text();
  const trustMarkup = markup.match(/<section id="trust-view"[\s\S]*?<section id="status-view"/)?.[0].replace(/<section id="status-view"$/, "");
  if (!trustMarkup) throw new Error("The pinned legacy trust view is missing");
  const html = `<!doctype html><html data-theme="apple"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>OWNER-PREVIEW-02 synthetic native-preview fixture</title><link rel="stylesheet" href="/legacy.css"><link rel="stylesheet" href="/evidence.css"></head><body><main class="fixture">${trustMarkup}</main><style>.fixture{max-width:1100px;margin:16px auto;padding:0 12px}.owner-proof-double{font-size:200%}</style><script type="module">
import {renderOwnerTrustExpensePreviewEvidence as render} from '/evidence.mjs';
const effects=[],keys=[],errors=[];
window.fetch=(...args)=>{effects.push('fetch');throw Error('Unexpected fetch')};
XMLHttpRequest.prototype.send=function(){effects.push('XHR');throw Error('Unexpected XHR')};
for(const name of ['setItem','removeItem','clear'])Storage.prototype[name]=function(){effects.push('storage');throw Error('Unexpected storage')};
for(const name of ['pushState','replaceState'])history[name]=function(){effects.push('history');throw Error('Unexpected history')};
document.addEventListener('keydown',event=>keys.push({key:event.key,trusted:event.isTrusted}));
window.addEventListener('error',event=>errors.push(String(event.message)));
const preview=Object.freeze({accountReference:'00000000-0000-4000-8000-'+'1'.repeat(180),ownerLabel:'<img src=x onerror=window.hostile=1> '+('長いOwnerName'.repeat(10)),accountLabel:'Owner ledger',currency:'KWD',amountMinor:'9223372036854775807',availableBalanceMinor:'-2500',projectedBalanceMinor:'-9223372036854778307',approvalRequired:true});
const draft=Object.freeze({accountReference:preview.accountReference,amountMinor:preview.amountMinor,reason:'<scr'+'ipt>window.hostile=1</scr'+'ipt> Proposed entrance repair '+('長い理由'.repeat(60))});
const base=Object.freeze({state:'ready',propertyNode:'property-'+('p'.repeat(180)),propertyLabel:'Original Yellow · synthetic expense preview',readIdentity:'read-1-'+('r'.repeat(180)),draftIdentity:'draft-1-'+('d'.repeat(180)),preview,draft,formattedAmounts:Object.freeze({before:'KWD -2.500',expense:'KWD 9223372036854775.807',projected:'KWD -9223372036854778.307'})});
const initial=JSON.stringify(base);const mount=document.createElement('div');mount.id='owner-preview-mount';document.querySelector('#trust-view').hidden=false;document.querySelector('.trust-heading').after(mount);
let detached=true;
function show(change={}){const card=render(document,{...base,...change});detached=detached&&!document.body.contains(card);mount.replaceChildren(card);return card;}
const card=()=>mount.firstElementChild;
function inspect(){const node=card(),rect=node.getBoundingClientRect(),summaries=[...node.querySelectorAll('summary')];return {state:node.dataset.evidenceState,text:node.textContent,closed:[...node.querySelectorAll('details')].every(item=>!item.open),details:node.querySelectorAll('details').length,targets:summaries.map(item=>item.getBoundingClientRect().height),pageOverflow:document.documentElement.scrollWidth>innerWidth+1,cardOverflow:node.scrollWidth>node.clientWidth+1,wrapped:[...node.querySelectorAll('dd')].every(value=>!value.getBoundingClientRect().width||value.scrollWidth<=value.clientWidth+1),width:rect.width,summaryFocused:document.activeElement?.tagName==='SUMMARY',detailsOpen:node.querySelector('details')?.open,readIdentity:node.dataset.readIdentity,effects:[...effects],keys:[...keys],errors:[...errors],detached,unchanged:JSON.stringify(base)===initial,inert:!node.querySelector('a,button,form,input,script,img'),hostile:window.hostile===1};}
show();window.previewHarness={inspect,show,showDraft:(field)=>show({draft:{...draft,[field]:field==='amountMinor'?'1':'other'}}),observe:()=>({effects:[...effects],keys:[...keys],errors:[...errors],unchanged:JSON.stringify(base)===initial}),focus:()=>{const summary=card().querySelector('summary');summary.focus();return summary.getBoundingClientRect().height},theme:(theme)=>{document.documentElement.dataset.theme=theme},double:(double)=>{mount.classList.toggle('owner-proof-double',double)},openFirst:()=>card().querySelector('details').open,late:()=>new Promise((resolve,reject)=>{const link=document.createElement('link');link.rel='stylesheet';link.href='/legacy.css?late';link.onload=resolve;link.onerror=reject;document.head.append(link)}),unmount:()=>mount.replaceChildren()};
</script></body></html>`;
  await writeFile(join(proof, "fixture.html"), html);
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch(request) {
    const path = new URL(request.url).pathname;
    const files: Record<string, string> = {
      "/": join(proof, "fixture.html"),
      "/legacy.css": resolve(root, "src/http/operator/operator.css"),
      "/evidence.css": resolve(root, "src/http/operator/owner-trust-expense-preview-evidence.css"),
      "/evidence.mjs": resolve(root, "src/http/operator/owner-trust-expense-preview-evidence.mjs"),
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
    await wait(() => evaluate<boolean>("Boolean(window.previewHarness)"), "fixture mount");
    expect(await evaluate<string>("document.title")).toBe("OWNER-PREVIEW-02 synthetic native-preview fixture");
    expect(await evaluate<string>("location.href")).toBe(url);
    for (const theme of ["apple", "android", "win95", "glass", "neo", "erp"]) {
      for (const layout of [{ name: "desktop", width: 1280, double: false }, { name: "narrow", width: 375, double: false }, { name: "doubled", width: 375, double: true }]) {
        await send("Emulation.setDeviceMetricsOverride", { width: layout.width, height: 1000, deviceScaleFactor: 1, mobile: false });
        await evaluate(`previewHarness.theme(${JSON.stringify(theme)});previewHarness.double(${layout.double});previewHarness.show({readIdentity:${JSON.stringify(`${theme}-${layout.name}`)}});window.scrollTo(0,0)`);
        await Bun.sleep(30);
        const before = await evaluate<any>("previewHarness.inspect()");
        expect(before).toMatchObject({ state: "ready", details: 2, pageOverflow: false, cardOverflow: false, wrapped: true, closed: true, inert: true, hostile: false, detached: true, unchanged: true });
        expect(before.effects).toEqual([]);
        expect(before.targets.every((height: number) => height >= 44)).toBe(true);
        expect(before.text).toContain("KWD -9223372036854778.307");
        expect(before.text).toContain("Approval required");
        expect(before.text).toContain("Caller-proposed reason");
        expect(before.text).not.toMatch(/ready to post|approved funds|payment success/i);
        expect(before.text).toContain("Exact expense minor units");
        if (theme === "apple") {
          const shot = await send("Page.captureScreenshot", { format: "png" });
          await writeFile(join(proof, `${layout.name}.png`), Buffer.from(shot.data, "base64"));
        }
        await evaluate("previewHarness.focus()");
        await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, text: "\r" });
        await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
        await wait(() => evaluate<boolean>("previewHarness.openFirst()"), "trusted Enter opens native Details");
        const opened = await evaluate<any>("previewHarness.inspect()");
        expect(opened).toMatchObject({ detailsOpen: true, summaryFocused: true, pageOverflow: false, cardOverflow: false, wrapped: true });
        expect(opened.keys.every((key: { trusted: boolean }) => key.trusted)).toBe(true);
        if (theme === "apple") {
          const shot = await send("Page.captureScreenshot", { format: "png" });
          await writeFile(join(proof, `${layout.name}-details.png`), Buffer.from(shot.data, "base64"));
        }
        await send("Input.dispatchKeyEvent", { type: "keyDown", key: " ", code: "Space", windowsVirtualKeyCode: 32, text: " " });
        await send("Input.dispatchKeyEvent", { type: "keyUp", key: " ", code: "Space", windowsVirtualKeyCode: 32 });
        await wait(() => evaluate<boolean>("!previewHarness.openFirst()"), "trusted Space closes native Details");
        await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
        await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
        expect(await evaluate<boolean>("document.activeElement===document.querySelector('#owner-preview-mount').querySelectorAll('summary')[1]")).toBe(true);
        await evaluate("previewHarness.show()");
        expect(await evaluate<boolean>("previewHarness.inspect().closed")).toBe(true);
        layouts.push({ theme, ...layout, targets: before.targets, width: before.width, nativeKeyboard: true, nativePreview: true, overflow: false });
      }
    }
    await evaluate("previewHarness.late()");
    await evaluate("document.querySelectorAll('#owner-preview-mount details').forEach(detail=>{detail.open=true});window.scrollTo(0,0)");
    const late = await evaluate<any>("previewHarness.inspect()");
    expect(late).toMatchObject({ pageOverflow: false, cardOverflow: false, wrapped: true });
    expect(late.targets.every((height: number) => height >= 44)).toBe(true);
    await evaluate("document.querySelector('#owner-preview-mount summary').scrollIntoView({block:'start'})");
    const lateShot = await send("Page.captureScreenshot", { format: "png" });
    await writeFile(join(proof, "late-theme-details.png"), Buffer.from(lateShot.data, "base64"));
    expect(late.text).toContain("<script>window.hostile=1</script> Proposed entrance repair");
    await evaluate("document.querySelectorAll('#owner-preview-mount summary')[1].scrollIntoView({block:'start'})");
    const draftShot = await send("Page.captureScreenshot", { format: "png" });
    await writeFile(join(proof, "proposed-draft-details.png"), Buffer.from(draftShot.data, "base64"));
    const browserVersion = await send("Browser.getVersion");
    for (const state of ["loading", "unavailable"]) {
      await evaluate(`previewHarness.show({state:${JSON.stringify(state)}})`);
      const cleared = await evaluate<any>("previewHarness.inspect()");
      expect(cleared.details).toBe(0);
      expect(cleared.text).not.toMatch(/Owner ledger|922337|00000000|read-1|draft-1|Proposed entrance/);
    }
    for (const field of ["accountReference", "amountMinor"]) {
      await evaluate(`previewHarness.showDraft(${JSON.stringify(field)})`);
      const mismatch = await evaluate<any>("previewHarness.inspect()");
      expect(mismatch.state).toBe("unavailable");
      expect(mismatch.text).not.toContain("Owner ledger");
    }
    await evaluate("previewHarness.show({preview:{currency:'KWD'}})");
    expect((await evaluate<any>("previewHarness.inspect()")).state).toBe("unavailable");
    const accessor = await evaluate<any>("(()=>{let calls=0;const value={};Object.defineProperty(value,'accountReference',{get(){calls++;throw Error('getter')}});previewHarness.show({preview:value});return {calls,state:previewHarness.inspect().state}})()");
    expect(accessor).toEqual({ calls: 0, state: "unavailable" });
    await evaluate("previewHarness.show();previewHarness.unmount()");
    const effects = await evaluate<any>("previewHarness.observe()");
    // The fixture's independent observers remain available after the detached card is removed.
    expect(await evaluate<boolean>("document.querySelector('#owner-preview-mount').children.length===0")).toBe(true);
    expect(effects).toMatchObject({ effects: [], errors: [], unchanged: true });
    expect(effects.keys.length).toBeGreaterThanOrEqual(54);
    expect(effects.keys.every((key: { trusted: boolean }) => key.trusted)).toBe(true);
    expect(consoleErrors).toEqual([]);
    await writeFile(join(proof, "MOUNTED-PROOF.json"), JSON.stringify({ passed: true, url, layouts, lateTheme: true, allDetailsLateTheme: true, trustedKeyboard: true, nativePreview: true, consoleErrors, afterUnmount: effects, browser: chrome, browserVersion, mountedNativeCaller: false }, null, 2) + "\n");
    console.log(`OWNER-PREVIEW-02 browser proof: ${layouts.length} layouts, exact native preview, trusted Enter/Space/Tab, ${proof}`);
  } catch (error) {
    const observation = send ? await send("Runtime.evaluate", { expression: "JSON.stringify(window.previewHarness?.inspect())", returnByValue: true }).catch(failure => String(failure)) : null;
    await writeFile(join(proof, "FAILURE.json"), JSON.stringify({ error: String(error), layouts, consoleErrors, observation }, null, 2) + "\n");
    throw error;
  } finally {
    await terminateOwnedProcess(child, send ? () => send!("Browser.close") : undefined);
    socket?.close();
    for (const item of pending.values()) { clearTimeout(item.timer); item.reject(new Error("Owned proof closed")); }
    pending.clear(); server.stop(true);
  }
}, 90000);
