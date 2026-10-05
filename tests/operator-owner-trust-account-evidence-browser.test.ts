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

test("owned Chromium mounts complete native account pages in the real legacy theme with trusted Details keys", async () => {
  if (!chrome) throw new Error("Installed Chromium is required; missing browser is not pixel acceptance");
  const artifactRoot = process.env.YELLOW_OWNER_ACCOUNT_PROOF_DIR ?? resolve(root, "../proof/browser");
  await mkdir(artifactRoot, { recursive: true });
  const proof = await mkdtemp(join(artifactRoot, "owned-"));
  const markup = await Bun.file(resolve(root, "src/http/operator/index.html")).text();
  const trustMarkup = markup.match(/<section id="trust-view"[\s\S]*?<section id="status-view"/)?.[0].replace(/<section id="status-view"$/, "");
  if (!trustMarkup) throw new Error("The pinned legacy trust view is missing");
  const html = `<!doctype html><html data-theme="apple"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>OWNER-READ-01 synthetic native-page fixture</title><link rel="stylesheet" href="/legacy.css"><link rel="stylesheet" href="/evidence.css"></head><body><main class="fixture">${trustMarkup}</main><style>.fixture{max-width:1100px;margin:16px auto;padding:0 12px}.owner-proof-double{font-size:200%}</style><script type="module">
import {renderOwnerTrustAccountEvidence as render} from '/evidence.mjs';
const effects=[],keys=[],errors=[];
window.fetch=(...args)=>{effects.push('fetch');throw Error('Unexpected fetch')};
XMLHttpRequest.prototype.send=function(){effects.push('XHR');throw Error('Unexpected XHR')};
for(const name of ['setItem','removeItem','clear'])Storage.prototype[name]=function(){effects.push('storage');throw Error('Unexpected storage')};
for(const name of ['pushState','replaceState'])history[name]=function(){effects.push('history');throw Error('Unexpected history')};
document.addEventListener('keydown',event=>keys.push({key:event.key,trusted:event.isTrusted}));
window.addEventListener('error',event=>errors.push(String(event.message)));
const rows=Object.freeze(Array.from({length:100},(_,i)=>Object.freeze({accountReference:'00000000-0000-4000-8000-'+String(i+1).padStart(12,'0'),ownerLabel:i===1?'<img src=x onerror=window.hostile=1>':'Same owner '+('長いOwnerName'.repeat(i===2?18:1)),accountLabel:'Owner ledger '+(i%3),currency:['USD','JPY','KWD'][i%3],availableBalanceMinor:['-100','0','9223372036854775807'][i%3],canPost:i%2===0})));
const formatted=Object.freeze({[rows[0].accountReference]:'USD -1.00',[rows[1].accountReference]:'JPY 0',[rows[2].accountReference]:'KWD 9223372036854775.807'});
const base=Object.freeze({state:'ready',propertyNode:'00000000-0000-4000-8000-000000000111',propertyLabel:'Original Yellow · synthetic owner accounts',readIdentity:'read-1',page:Object.freeze({accounts:rows,nextCursor:'100'}),selectedAccountReference:rows[1].accountReference,formattedBalances:formatted});
const initial=JSON.stringify(base);const mount=document.createElement('div');mount.id='owner-card-mount';document.querySelector('#trust-view').hidden=false;document.querySelector('.trust-heading').after(mount);
let detached=true;
function show(change={}){const card=render(document,{...base,...change});detached=detached&&!document.body.contains(card);mount.replaceChildren(card);return card;}
const card=()=>mount.firstElementChild;
function inspect(){const node=card(),rect=node.getBoundingClientRect(),summaries=[...node.querySelectorAll('summary')],articles=[...node.querySelectorAll('article')];return {state:node.dataset.evidenceState,rows:articles.length,order:articles.map(item=>item.dataset.accountReference),text:node.textContent,closed:[...node.querySelectorAll('details')].every(item=>!item.open),targets:summaries.map(item=>item.getBoundingClientRect().height),pageOverflow:document.documentElement.scrollWidth>innerWidth+1,cardOverflow:node.scrollWidth>node.clientWidth+1,wrapped:articles.every(item=>item.getBoundingClientRect().right<=innerWidth+1&&[...item.querySelectorAll('dd')].every(value=>!value.getBoundingClientRect().width||value.scrollWidth<=value.clientWidth+1)),width:rect.width,summaryFocused:document.activeElement?.tagName==='SUMMARY',detailsOpen:node.querySelector('details')?.open,readIdentity:node.dataset.readIdentity,effects:[...effects],keys:[...keys],errors:[...errors],detached,unchanged:JSON.stringify(base)===initial,inert:!node.querySelector('a,button,form,input,script,img'),hostile:window.hostile===1};}
show();window.ownerHarness={inspect,show,observe:()=>({effects:[...effects],keys:[...keys],errors:[...errors],unchanged:JSON.stringify(base)===initial}),focus:()=>{const summary=card().querySelector('summary');summary.focus();return summary.getBoundingClientRect().height},theme:(theme)=>{document.documentElement.dataset.theme=theme},double:(double)=>{mount.classList.toggle('owner-proof-double',double)},openFirst:()=>card().querySelector('details').open,late:()=>new Promise((resolve,reject)=>{const link=document.createElement('link');link.rel='stylesheet';link.href='/legacy.css?late';link.onload=resolve;link.onerror=reject;document.head.append(link)}),unmount:()=>mount.replaceChildren()};
</script></body></html>`;
  await writeFile(join(proof, "fixture.html"), html);
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch(request) {
    const path = new URL(request.url).pathname;
    const files: Record<string, string> = {
      "/": join(proof, "fixture.html"),
      "/legacy.css": resolve(root, "src/http/operator/operator.css"),
      "/evidence.css": resolve(root, "src/http/operator/owner-trust-account-evidence.css"),
      "/evidence.mjs": resolve(root, "src/http/operator/owner-trust-account-evidence.mjs"),
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
    await wait(() => evaluate<boolean>("Boolean(window.ownerHarness)"), "fixture mount");
    expect(await evaluate<string>("document.title")).toBe("OWNER-READ-01 synthetic native-page fixture");
    expect(await evaluate<string>("location.href")).toBe(url);
    for (const theme of ["apple", "android", "win95", "glass", "neo", "erp"]) {
      for (const layout of [{ name: "desktop", width: 1280, double: false }, { name: "narrow", width: 375, double: false }, { name: "doubled", width: 375, double: true }]) {
        await send("Emulation.setDeviceMetricsOverride", { width: layout.width, height: 1000, deviceScaleFactor: 1, mobile: false });
        await evaluate(`ownerHarness.theme(${JSON.stringify(theme)});ownerHarness.double(${layout.double});ownerHarness.show({readIdentity:${JSON.stringify(`${theme}-${layout.name}`)}});window.scrollTo(0,0)`);
        await Bun.sleep(30);
        const before = await evaluate<any>("ownerHarness.inspect()");
        expect(before).toMatchObject({ state: "ready", rows: 100, pageOverflow: false, cardOverflow: false, wrapped: true, closed: true, inert: true, hostile: false, detached: true, unchanged: true });
        expect(before.effects).toEqual([]);
        expect(before.targets.every((height: number) => height >= 44)).toBe(true);
        expect(before.order).toEqual(Array.from({ length: 100 }, (_, i) => `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`));
        expect(before.text).toContain("More rows are available");
        if (theme === "apple") {
          const shot = await send("Page.captureScreenshot", { format: "png" });
          await writeFile(join(proof, `${layout.name}.png`), Buffer.from(shot.data, "base64"));
        }
        await evaluate("ownerHarness.focus()");
        await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, text: "\r" });
        await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
        await wait(() => evaluate<boolean>("ownerHarness.openFirst()"), "trusted Enter opens native Details");
        const opened = await evaluate<any>("ownerHarness.inspect()");
        expect(opened).toMatchObject({ detailsOpen: true, summaryFocused: true, pageOverflow: false, cardOverflow: false, wrapped: true });
        expect(opened.keys.every((key: { trusted: boolean }) => key.trusted)).toBe(true);
        if (theme === "apple") {
          const shot = await send("Page.captureScreenshot", { format: "png" });
          await writeFile(join(proof, `${layout.name}-details.png`), Buffer.from(shot.data, "base64"));
        }
        await send("Input.dispatchKeyEvent", { type: "keyDown", key: " ", code: "Space", windowsVirtualKeyCode: 32, text: " " });
        await send("Input.dispatchKeyEvent", { type: "keyUp", key: " ", code: "Space", windowsVirtualKeyCode: 32 });
        await wait(() => evaluate<boolean>("!ownerHarness.openFirst()"), "trusted Space closes native Details");
        await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
        await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
        expect(await evaluate<boolean>("document.activeElement===document.querySelector('#owner-card-mount').querySelectorAll('summary')[1]")).toBe(true);
        await evaluate("ownerHarness.show()");
        expect(await evaluate<boolean>("ownerHarness.inspect().closed")).toBe(true);
        layouts.push({ theme, ...layout, targets: before.targets, width: before.width, nativeKeyboard: true, allRows: 100, overflow: false });
      }
    }
    await evaluate("ownerHarness.late()");
    await evaluate("document.querySelectorAll('#owner-card-mount details').forEach(detail=>{detail.open=true});window.scrollTo(0,0)");
    const late = await evaluate<any>("ownerHarness.inspect()");
    expect(late).toMatchObject({ pageOverflow: false, cardOverflow: false, wrapped: true });
    expect(late.targets.every((height: number) => height >= 44)).toBe(true);
    await evaluate("document.querySelector('#owner-card-mount summary').scrollIntoView({block:'start'})");
    const lateShot = await send("Page.captureScreenshot", { format: "png" });
    await writeFile(join(proof, "late-theme-details.png"), Buffer.from(lateShot.data, "base64"));
    const browserVersion = await send("Browser.getVersion");
    for (const state of ["loading", "unavailable"]) {
      await evaluate(`ownerHarness.show({state:${JSON.stringify(state)}})`);
      const cleared = await evaluate<any>("ownerHarness.inspect()");
      expect(cleared.rows).toBe(0);
      expect(cleared.text).not.toMatch(/Same owner|Owner ledger|922337|00000000|read-1/);
    }
    await evaluate("ownerHarness.show({page:{accounts:[],nextCursor:null}})");
    expect((await evaluate<any>("ownerHarness.inspect()")).text).toContain("No account rows were returned");
    await evaluate("ownerHarness.show({page:{accounts:[{currency:'USD'}],nextCursor:null}})");
    expect((await evaluate<any>("ownerHarness.inspect()")).state).toBe("unavailable");
    await evaluate("ownerHarness.show();ownerHarness.unmount()");
    const effects = await evaluate<any>("ownerHarness.observe()");
    // The fixture's independent observers remain available after the detached card is removed.
    expect(await evaluate<boolean>("document.querySelector('#owner-card-mount').children.length===0")).toBe(true);
    expect(effects).toMatchObject({ effects: [], errors: [], unchanged: true });
    expect(effects.keys.length).toBeGreaterThanOrEqual(54);
    expect(effects.keys.every((key: { trusted: boolean }) => key.trusted)).toBe(true);
    expect(consoleErrors).toEqual([]);
    await writeFile(join(proof, "MOUNTED-PROOF.json"), JSON.stringify({ passed: true, url, layouts, lateTheme: true, allDetailsLateTheme: true, trustedKeyboard: true, rows: 100, consoleErrors, afterUnmount: effects, browser: chrome, browserVersion, mountedNativeCaller: false }, null, 2) + "\n");
    console.log(`OWNER-READ-01 browser proof: ${layouts.length} layouts, 100 supplied rows, trusted Enter/Space, ${proof}`);
  } catch (error) {
    const observation = send ? await send("Runtime.evaluate", { expression: "JSON.stringify(window.ownerHarness?.inspect())", returnByValue: true }).catch(failure => String(failure)) : null;
    await writeFile(join(proof, "FAILURE.json"), JSON.stringify({ error: String(error), layouts, consoleErrors, observation }, null, 2) + "\n");
    throw error;
  } finally {
    await terminateOwnedProcess(child, send ? () => send!("Browser.close") : undefined);
    socket?.close();
    for (const item of pending.values()) { clearTimeout(item.timer); item.reject(new Error("Owned proof closed")); }
    pending.clear(); server.stop(true);
  }
}, 90000);
