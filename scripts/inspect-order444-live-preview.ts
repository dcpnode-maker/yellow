// Order444 manual, exact-source live browser proof. No business commands.
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { strict as assert } from "node:assert";

const repository = resolve(import.meta.dir, "..");
const temporaryBase = "D:\\Yellow\\temp";
const expectedRevision = "a10851786f17f2fdea0cf970320ee8c46a45b670";
const origin = "http://127.0.0.1:3000";
const browser = [process.env.PROGRAMFILES && resolve(process.env.PROGRAMFILES, "Google/Chrome/Application/chrome.exe"),
  process.env["PROGRAMFILES(X86)"] && resolve(process.env["PROGRAMFILES(X86)"], "Microsoft/Edge/Application/msedge.exe")]
  .find((path): path is string => Boolean(path && existsSync(path)));

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

const ready = await (await fetch(origin + "/ready")).json() as {
  status?: string; target?: string; build?: { revision?: string; expectedMigrationFrontier?: number };
};
assert.equal(ready.status, "ready");
assert.equal(ready.target, "yellow_runtime_database");
assert.equal(ready.build?.revision, expectedRevision);
assert.equal(ready.build?.expectedMigrationFrontier, 85);
const manifest = await Bun.file("D:\\Yellow\\runtime\\order444-" + expectedRevision +
  "-control\\fiscal-review-manifest.json").json() as { propertyNode?: string; issuedDocumentId?: string };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
assert.ok(typeof manifest.propertyNode === "string" && uuid.test(manifest.propertyNode));
assert.ok(typeof manifest.issuedDocumentId === "string" && uuid.test(manifest.issuedDocumentId));
const route = "/p/" + manifest.propertyNode + "/invoices/" + manifest.issuedDocumentId;
const outputRoot = resolve(repository, ".yellow/evidence/order444-live-preview");
await mkdir(outputRoot, { recursive: true });
const profile = await mkdtemp(resolve(temporaryBase, "order444-live-browser-"));
const proof: Record<string, unknown> = { revision: expectedRevision, migrationFrontier: 85,
  realDatabase: true, syntheticDataOnly: true, businessCommands: 0, screenshots: [] };
try {
  await withOwnedCdp(profile, async send => {
    async function evaluate<Result>(expression: string): Promise<Result> {
      const result = await send<{ result: { value?: Result }; exceptionDetails?: unknown }>(
        "Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
      if (result.exceptionDetails) throw new Error("Live browser expression failed; credentials were not logged");
      return result.result.value as Result;
    }
    async function until(expression: string, label: string): Promise<void> {
      for (let attempt = 0; attempt < 100; attempt += 1) {
        if (await evaluate<boolean>(expression)) return;
        await Bun.sleep(100);
      }
      throw new Error("Live browser timeout: " + label);
    }
    async function click(selector: string): Promise<void> {
      const point = await evaluate<{ x: number; y: number } | null>(
        "(async()=>{const e=document.querySelector(" + JSON.stringify(selector) +
        ");if(!e||e.disabled)return null;e.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});" +
        "await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);" +
        "const r=e.getBoundingClientRect();const x=r.x+r.width/2,y=r.y+r.height/2;" +
        "return r.width&&r.height&&e.contains(document.elementFromPoint(x,y))?{x,y}:null})()");
      assert.ok(point, "Visible enabled target: " + selector);
      await send("Input.dispatchMouseEvent", { type: "mousePressed", ...point, button: "left", clickCount: 1 });
      await send("Input.dispatchMouseEvent", { type: "mouseReleased", ...point, button: "left", clickCount: 1 });
    }
    await send("Page.enable");
    await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await send("Page.navigate", { url: origin + route });
    await until("Boolean(document.querySelector('#login-form button[type=submit]') && !document.querySelector('#login-form button[type=submit]').disabled)", "login initialized");
    const prefill = await evaluate<boolean[]>(
      "['tenant','email','password'].map(n=>Boolean(document.querySelector('#login-form').elements.namedItem(n).value))");
    assert.deepEqual(prefill, [true, true, true]);
    proof.prefilledFields = 3;
    await click("#login-form button[type=submit]");
    await until("Boolean(document.querySelector('#workbench-view') && !document.querySelector('#workbench-view').hidden)", "real signed-in workbench");
    await until("Boolean(document.querySelector('.invoice-workbench__detail-heading'))", "real invoice detail");
    await until("Boolean(document.querySelector('.invoice-workbench__audit'))", "issued invoice verification evidence");
    assert.equal(await evaluate<string>("location.pathname"), route);
    assert.equal(await evaluate<string>("document.querySelector('#property-select').value"), manifest.propertyNode);
    proof.loginButtonVerified = true;
    const rendered = await evaluate<{ heading: string; controls: number; details: boolean }>(
      "({heading:document.querySelector('.invoice-workbench__detail-heading').textContent.trim()," +
      "controls:document.querySelectorAll('.domain-nav button[data-view]').length," +
      "details:Boolean(document.querySelector('.invoice-workbench__audit'))})");
    assert.equal(rendered.controls, 15);
    assert.ok(rendered.heading && rendered.details);
    proof.invoiceRendered = rendered;
    for (const layout of ["calm", "precision", "timeline"]) {
      await evaluate("(()=>{const p=document.querySelector('#workspace-skin-select');p.value=" + JSON.stringify(layout) +
        ";p.dispatchEvent(new Event('change',{bubbles:true}));window.scrollTo(0,0);return true})()");
      await Bun.sleep(150);
      const geometry = await evaluate<{ width: number; overflow: boolean; layout: string }>(
        "({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth+1,layout:document.documentElement.dataset.workspaceSkin})");
      assert.equal(geometry.width, 1440); assert.equal(geometry.layout, layout); assert.equal(geometry.overflow, false);
      const screenshot = await send<{ data: string }>("Page.captureScreenshot", { format: "png" });
      const filename = "1440-900-" + layout + ".png";
      await Bun.write(resolve(outputRoot, filename), Buffer.from(screenshot.data, "base64"));
      (proof.screenshots as string[]).push(filename);
    }
    const reached: string[] = [];
    for (const view of ["today", "availability", "reservations", "folios", "invoices", "cashiers",
      "day-close", "trust", "operations", "housekeeping", "vehicles", "inventory", "restrictions", "rates", "status"]) {
      const secondary = ["operations", "housekeeping", "vehicles", "inventory", "restrictions", "rates", "status"].includes(view);
      if (secondary && await evaluate<boolean>("document.querySelector('#secondary-workspaces').hidden")) {
        await click("#secondary-workspaces-toggle");
      }
      await click("#nav-" + view);
      await until("Boolean(document.getElementById(" + JSON.stringify(view + "-view") + ") && !document.getElementById(" +
        JSON.stringify(view + "-view") + ").hidden)", "mounted " + view);
      reached.push(view);
    }
    proof.mountedDestinations = reached;
    proof.destinationLimit = "Mounted real navigation only; not complete transaction acceptance in every workspace";
    await click("#nav-invoices");
    await until("Boolean(document.querySelector('.invoice-workbench__queue-item'))", "invoice queue after return");
    await click(".invoice-workbench__queue-item");
    await until("Boolean(document.querySelector('.invoice-workbench__detail-heading'))", "invoice detail after return");
    await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
    await evaluate("window.scrollTo(0,0)");
    await Bun.sleep(150);
    assert.equal(await evaluate<boolean>("document.documentElement.scrollWidth>innerWidth+1"), false);
    const mobile = await send<{ data: string }>("Page.captureScreenshot", { format: "png" });
    await Bun.write(resolve(outputRoot, "390-844-timeline.png"), Buffer.from(mobile.data, "base64"));
    (proof.screenshots as string[]).push("390-844-timeline.png");
    await click("#sign-out");
    await until("Boolean(document.querySelector('#login-view') && !document.querySelector('#login-view').hidden)", "signed out");
    proof.signOutVerified = true;
    proof.verifiedUtc = new Date().toISOString();
  });
  await Bun.write(resolve(outputRoot, "proof.json"), JSON.stringify(proof, null, 2) + "\n");
  console.log(JSON.stringify(proof));
} finally {
  const child = relative(resolve(temporaryBase), resolve(profile));
  if (!child || isAbsolute(child) || child.startsWith("..") || !child.startsWith("order444-live-browser-")) {
    throw new Error("Refusing unverified temporary browser profile cleanup");
  }
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
