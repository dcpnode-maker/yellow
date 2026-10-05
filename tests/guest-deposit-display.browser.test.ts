import { expect, test } from "bun:test";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { createApp } from "../src/app";
import { HostedDepositProviderHttpApi } from "../src/http/provider";
import type { HostedDepositService } from "../src/contexts/financials";
import { resolveChromiumPath } from "./helpers/chromium-path";
import { fetchJsonBounded, terminateOwnedProcess } from "./helpers/owned-cdp-proof-lifecycle";

const root = resolve(import.meta.dir, "..");
const proof = resolve(root, "../proof/guest-browser");
let layouts: any[] = [];

test("registered guest HTML/JS/module preserves status, controls, races and exact display without effects", async () => {
  await mkdir(proof, { recursive: true });
  const chrome = resolveChromiumPath();
  if (!chrome) throw new Error("Owned Chromium required for actual guest display proof");
  const token = "synthetic-opaque-display-fixture";
  const status = { propertyName: "Synthetic property", folioReference: "SYNTHETIC-ONLY",
    amountMinor: "1000", currency: "INR", expiresAt: "2030-01-01T00:00:00Z", state: "ready",
    capturedMinor: "0", appliedMinor: "0", remainingMinor: "0", generation: 1 };
  let statusReads = 0, returnReads = 0, effects = 0, unexpected = 0;
  let hold = false;
  const held: Array<{ release: () => void }> = [];
  const read = async (isReturn: boolean) => {
    if (isReturn) returnReads++; else statusReads++;
    const snapshot = { ...status };
    if (hold) await new Promise<void>(release => held.push({ release }));
    return snapshot;
  };
  const service = new Proxy({ status: () => read(false), statusByCorrelation: () => read(true) }, {
    get(target, name) {
      if (name === "status" || name === "statusByCorrelation") return target[name];
      return () => { effects++; throw new Error("Guest display financial effect forbidden"); };
    },
  }) as unknown as HostedDepositService;
  const app = createApp({ hostedDepositSurface: "guest", hostedDepositRoutes: new HostedDepositProviderHttpApi({
    hostedDeposits: service, callbackSecret: "synthetic-only-display-secret-at-least-thirty-two",
    sendCallback: async () => { effects++; throw new Error("Provider transport forbidden"); },
  }) });
  const requests: Array<{ path: string; method: string; status: number }> = [];
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, async fetch(request) {
    const path = new URL(request.url).pathname;
    if (request.method !== "GET" || /continue|callback|provider|capture|apply/.test(path)) {
      effects++; return new Response("Forbidden synthetic effect", { status: 405 });
    }
    if (path === "/favicon.ico") return new Response(null, { status: 204 });
    if (!path.startsWith("/pay/") && !path.startsWith("/pay-return/") && !path.startsWith("/assets/") &&
        !path.startsWith("/api/public/hosted-deposits/") && !path.startsWith("/api/public/hosted-deposit-returns/")) unexpected++;
    const response = await app.handle(request);
    requests.push({ path, method: request.method, status: response.status });
    return response;
  } });
  const origin = `http://127.0.0.1:${server.port}`;
  const profile = resolve(proof, "profile-" + Date.now());
  let socket: WebSocket | undefined;
  let send: ((method: string, params?: Record<string, unknown>) => Promise<any>) | undefined;
  const child = Bun.spawn([chrome, "--headless=new", "--no-first-run", "--no-default-browser-check", "--disable-gpu",
    "--disable-background-networking", `--user-data-dir=${profile}`, "--remote-debugging-port=0", "about:blank"],
    { cwd: root, stdin: "ignore", stdout: "ignore", stderr: "ignore" });
  const checks: string[] = [];
  try {
    const deadline = Date.now() + 20_000;
    let port: string | undefined;
    while (!port && Date.now() < deadline) {
      try { port = (await readFile(resolve(profile, "DevToolsActivePort"), "utf8")).split("\n")[0]; }
      catch { await Bun.sleep(25); }
    }
    if (!port) throw new Error("Owned guest debugger not ready");
    const targets = await fetchJsonBounded<Array<{ type: string; url: string; webSocketDebuggerUrl?: string }>>(`http://127.0.0.1:${port}/json/list`);
    const target = targets.find(item => item.type === "page" && item.url === "about:blank");
    if (!target?.webSocketDebuggerUrl) throw new Error("Owned blank guest target not found");
    socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("CDP guest open deadline")), 5_000);
      socket!.onopen = () => { clearTimeout(timer); resolve(); };
      socket!.onerror = () => { clearTimeout(timer); reject(new Error("CDP guest open failed")); };
    });
    let sequence = 0;
    const pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
    socket.onmessage = event => {
      const response = JSON.parse(String(event.data)), item = pending.get(response.id);
      if (!item) return;
      pending.delete(response.id); clearTimeout(item.timer);
      response.error ? item.reject(new Error(JSON.stringify(response.error))) : item.resolve(response.result);
    };
    send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++sequence, timer = setTimeout(() => { pending.delete(id); reject(new Error("Guest CDP deadline " + method)); }, 5_000);
      pending.set(id, { resolve, reject, timer }); socket!.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = async (expression: string) => {
      const reply = await send!("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (reply.exceptionDetails) throw new Error(JSON.stringify(reply.exceptionDetails));
      return reply.result.value;
    };
    const observe = () => evaluate(`(()=>{const f=document.getElementById('continue'),b=f?.querySelector('button');return {url:location.href,
      busy:document.querySelector('.card')?.getAttribute('aria-busy'),amount:document.getElementById('amount')?.textContent,
      property:document.getElementById('property')?.textContent,message:document.getElementById('message')?.textContent,
      hidden:f?.hidden,method:f?.method,action:f?.getAttribute('action'),disabled:b?.disabled,fetches:window.displayFetches,
      errors:window.displayErrors,storage:window.displayStorage,images:document.querySelectorAll('img').length}})()`);
    const wait = async (predicate: () => Promise<boolean>) => {
      for (let n = 0; n < 250; n++) { if (await predicate()) return; await Bun.sleep(20); }
      throw new Error("Guest observation deadline: " + JSON.stringify(await observe()));
    };
    await send("Runtime.enable"); await send("Page.enable");
    await send("Emulation.setDeviceMetricsOverride", { width: 1200, height: 900, deviceScaleFactor: 1, mobile: false });
    await send("Page.addScriptToEvaluateOnNewDocument", { source: `window.displayFetches=[];window.displayErrors=[];window.displayStorage=[];
      addEventListener('error',e=>window.displayErrors.push(e.message));const actualFetch=window.fetch;
      window.fetch=function(url,options){window.displayFetches.push({url:String(url),options});return actualFetch.call(this,url,options);};
      for(const method of ['setItem','removeItem','clear'])Storage.prototype[method]=function(...args){window.displayStorage.push({method,args});throw new Error('Unexpected persistence');};` });
    const navigate = async (isReturn = false) => {
      const before = statusReads + returnReads;
      const route = (isReturn ? "/pay-return/" : "/pay/") + token;
      await send!("Page.navigate", { url: origin + route });
      await wait(async () => { const page = await observe(); return page.url === origin + route && page.busy === "false" && page.fetches?.length === 1; });
      const page = await observe();
      expect(statusReads + returnReads).toBe(before + 1);
      expect(page.fetches).toEqual([{ url: (isReturn ? "/api/public/hosted-deposit-returns/" : "/api/public/hosted-deposits/") + token,
        options: { credentials: "omit", cache: "no-store", headers: { accept: "application/json" }, redirect: "error" } }]);
      expect(page.method).toBe("post"); expect(page.action).toBe(isReturn ? "" : "/pay/" + token + "/continue");
      expect(page.hidden).toBe(isReturn); expect(page.errors).toEqual([]); expect(page.storage).toEqual([]);
      return page;
    };
    for (const state of ["ready", "processing", "captured", "declined", "expired", "revoked"]) {
      status.state = state;
      for (const isReturn of [false, true]) {
        const page = await navigate(isReturn);
        expect(page.amount).toBe("₹10.00");
        expect(page.disabled).toBe(state !== "ready" && state !== "processing");
        expect(page.message).toBe(state === "captured" ? "Deposit received." : ["ready", "processing"].includes(state) ? "Details verified by Yellow." : `This link is ${state}.`);
      }
    }
    checks.push("all six states on both registered pages; exact INR magnitude; unchanged Continue admission and hidden return form");
    for (const [amountMinor, currency, expected] of [["0", "INR", "₹0.00"], ["1", "INR", "₹0.01"], ["1001", "INR", "₹10.01"],
      ["1000", "JPY", "¥1,000"], ["1000", "KWD", "KWD 1.000"], ["1", "KWD", "KWD 0.001"],
      ["9223372036854775807", "INR", "₹92,233,720,368,547,758.07"], ["9223372036854775807", "KWD", "KWD 9,223,372,036,854,775.807"],
      ["9223372036854775807", "JPY", "¥9,223,372,036,854,775,807"]]) {
      Object.assign(status, { amountMinor, currency, state: "ready" });
      expect((await navigate()).amount).toBe(expected);
    }
    checks.push("independent literal zero/subunit/JPY/KWD/int64 magnitudes in actual browser");
    for (const [amountMinor, currency, expected] of [["1000", "XYZ", "1000 XYZ minor units · currency precision unavailable"],
      ["1000", "XXX", "1000 XXX minor units · currency precision unavailable"], ["1000", "<img src=x onerror=bad()>", "1000 minor units · currency unavailable"],
      ["01", "INR", "Amount unavailable"], ["-1", "INR", "Amount unavailable"]]) {
      Object.assign(status, { amountMinor, currency, state: "processing", propertyName: "<img src=x onerror=bad()>" });
      const page = await navigate();
      expect(page.amount).toBe(expected); expect(page.disabled).toBe(false); expect(page.images).toBe(0);
      expect(page.property).toBe(status.propertyName); expect(page.message).toBe("Details verified by Yellow.");
    }
    checks.push("guard fallback preserves status/control admission and inert textContent");
    Object.assign(status, { amountMinor: "1000", currency: "INR", state: "ready", propertyName: "Synthetic property" });
    await navigate();
    const count = statusReads;
    hold = true; status.amountMinor = "1001";
    await evaluate("document.getElementById('refresh').click()");
    await wait(async () => held.length === 1);
    expect((await observe()).busy).toBe("true"); expect((await observe()).disabled).toBe(true);
    hold = false; status.amountMinor = "1002";
    await evaluate("document.getElementById('refresh').click()");
    await wait(async () => (await observe()).amount === "₹10.02" && (await observe()).busy === "false");
    held.shift()!.release();
    await wait(async () => requests.filter(item => item.path === "/api/public/hosted-deposits/" + token).length === statusReads);
    await Bun.sleep(30);
    expect((await observe()).amount).toBe("₹10.02"); expect(statusReads).toBe(count + 2);
    expect((await observe()).fetches).toHaveLength(3);
    checks.push("refresh performs one fetch; newer reply wins; late stale reply cannot overwrite display");
    Object.assign(status, { amountMinor: "1234567890123456789012345678901234567890", currency: "INR" });
    await send("Emulation.setDeviceMetricsOverride", { width: 375, height: 1000, deviceScaleFactor: 1, mobile: false });
    await navigate();
    layouts = [];
    for (const label of ["375px", "375px doubled text"]) {
      if (label.includes("doubled")) await evaluate("document.documentElement.style.fontSize='32px'");
      layouts.push(await evaluate(`(()=>{const a=document.getElementById('amount'),r=a.getBoundingClientRect();return {label:${JSON.stringify(label)},
        viewport:innerWidth,pageWidth:document.documentElement.scrollWidth,amount:a.textContent,amountWidth:r.width,
        amountScrollWidth:a.scrollWidth,amountClientWidth:a.clientWidth,left:r.left,right:r.right,fontSize:getComputedStyle(a).fontSize}})()`));
      const image = await send("Page.captureScreenshot", { format: "png" });
      await writeFile(resolve(proof, label.includes("doubled") ? "guest-375-text-zoom.png" : "guest-375.png"), Buffer.from(image.data, "base64"));
    }
    expect(layouts.every(item => item.amount === "₹12,345,678,901,234,567,890,123,456,789,012,345,678.90")).toBe(true);
    expect(effects).toBe(0); expect(unexpected).toBe(0);
    expect(requests.filter(item => item.path === "/assets/money-exact-minor.mjs").length).toBeGreaterThan(0);
    expect(requests.every(item => item.status === 200)).toBe(true);
    await writeFile(resolve(proof, "receipt.json"), JSON.stringify({ behaviorPassed: true, checks, layouts, requests,
      statusReads, returnReads, effects, unexpected, nativeCalls: 0, providerCalls: 0 }, null, 2));
  } catch (error) {
    await writeFile(resolve(proof, "failure.json"), JSON.stringify({ error: String(error), checks, layouts, requests, statusReads, returnReads, effects, unexpected }, null, 2));
    throw error;
  } finally {
    for (const item of held) item.release();
    await terminateOwnedProcess(child, send ? () => send!("Browser.close") : undefined);
    socket?.close(); server.stop(true);
    if (dirname(profile) !== proof) throw new Error("Owned guest profile cleanup boundary mismatch");
    await rm(profile, { recursive: true, force: true });
    await writeFile(resolve(proof, "cleanup.json"), JSON.stringify({ browserExited: child.exitCode !== null || child.signalCode !== null,
      serverStopped: true, profileRemoved: true, effects, nativeCalls: 0, providerCalls: 0 }));
  }
}, 45_000);

test("huge guest amount remains contained and readable at 375px and doubled text", () => {
  expect(layouts).toHaveLength(2);
  for (const item of layouts) {
    expect(item.pageWidth, JSON.stringify(item)).toBeLessThanOrEqual(item.viewport + 1);
    expect(item.amountScrollWidth, JSON.stringify(item)).toBeLessThanOrEqual(item.amountClientWidth + 1);
    expect(item.left).toBeGreaterThanOrEqual(0);
    expect(item.right).toBeLessThanOrEqual(item.viewport + 1);
  }
});
