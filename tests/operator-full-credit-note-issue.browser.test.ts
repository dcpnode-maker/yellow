import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";

const repository = resolve(import.meta.dir, "..");
const browser = [
  process.env.PROGRAMFILES && resolve(process.env.PROGRAMFILES, "Google/Chrome/Application/chrome.exe"),
  process.env.LOCALAPPDATA && resolve(process.env.LOCALAPPDATA, "Google/Chrome/Application/chrome.exe"),
  process.env.PROGRAMFILES && resolve(process.env.PROGRAMFILES, "Microsoft/Edge/Application/msedge.exe"),
  Bun.which("google-chrome"), Bun.which("chromium"), Bun.which("chromium-browser"),
].find((candidate): candidate is string => Boolean(candidate && existsSync(candidate)));

type Send = <T>(method: string, params?: Record<string, unknown>) => Promise<T>;

async function withBrowser(profile: string, run: (send: Send) => Promise<void>): Promise<void> {
  if (!browser) throw new Error("Chromium is required for Order470");
  const process = Bun.spawn([
    browser, "--headless=new", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage",
    "--no-first-run", "--no-default-browser-check", "--remote-debugging-address=127.0.0.1",
    "--remote-debugging-port=0", "--user-data-dir=" + profile, "about:blank",
  ], { stdout: "ignore", stderr: "ignore" });
  let socket: WebSocket | undefined;
  const pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void; timer: Timer }>();
  try {
    const portFile = resolve(profile, "DevToolsActivePort");
    let port = "";
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline && process.exitCode === null) {
      try { if (existsSync(portFile)) port = (await Bun.file(portFile).text()).split(/\r?\n/, 1)[0] ?? ""; } catch { /* startup file is incomplete */ }
      if (/^\d+$/.test(port)) break;
      await Bun.sleep(25);
    }
    if (!/^\d+$/.test(port)) throw new Error("Owned Chromium did not start");
    const response = await fetch("http://127.0.0.1:" + port + "/json/new?about:blank", {
      method: "PUT", signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) throw new Error("Owned Chromium target failed");
    const target = await response.json() as { webSocketDebuggerUrl?: string };
    if (!target.webSocketDebuggerUrl) throw new Error("Missing owned target");
    socket = new WebSocket(target.webSocketDebuggerUrl);
    const ws = socket;
    await new Promise<void>((resolveOpen, rejectOpen) => {
      const timer = setTimeout(() => rejectOpen(new Error("CDP opening deadline")), 5_000);
      ws.addEventListener("open", () => { clearTimeout(timer); resolveOpen(); }, { once: true });
      ws.addEventListener("error", () => { clearTimeout(timer); rejectOpen(new Error("CDP opening failed")); }, { once: true });
    });
    ws.addEventListener("message", event => {
      const message = JSON.parse(String(event.data)) as { id?: number; result?: unknown; error?: { message?: string } };
      if (!message.id) return;
      const command = pending.get(message.id);
      if (!command) return;
      pending.delete(message.id); clearTimeout(command.timer);
      if (message.error) command.reject(new Error(message.error.message ?? "CDP command failed"));
      else command.resolve(message.result);
    });
    let sequence = 0;
    const send: Send = <T>(method: string, params: Record<string, unknown> = {}) => new Promise<T>((resolveCommand, rejectCommand) => {
      const id = ++sequence;
      const timer = setTimeout(() => { pending.delete(id); rejectCommand(new Error("CDP deadline: " + method)); }, 5_000);
      pending.set(id, { resolve: value => resolveCommand(value as T), reject: rejectCommand, timer });
      ws.send(JSON.stringify({ id, method, params }));
    });
    await run(send);
  } finally {
    for (const command of pending.values()) { clearTimeout(command.timer); command.reject(new Error("Owned browser closed")); }
    pending.clear(); socket?.close();
    if (process.exitCode === null) process.kill();
    await process.exited;
  }
}

function page(): string {
  return String.raw`<!doctype html><html><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width">
<link rel="stylesheet" href="/assets/operator.css">
</head><body><main id="root" class="invoice-workbench"></main><pre id="proof" hidden></pre>
<script type="module">
const id = n => "00000000-0000-4000-8000-" + String(n).padStart(12, "0");
const propertyA = id(2), propertyB = id(3), originalA = id(10), originalB = id(11);
const reason = '  C1\u0085 कारण 🏨 <img src=x onerror="globalThis.injected=true">  ';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate, label) {
  const deadline = performance.now() + 2600;
  while (performance.now() < deadline) { if (predicate()) return; await sleep(8); }
  throw new Error("Timed out: " + label);
}
function invoice(documentId, propertyNode) {
  const number = documentId === originalA ? "INV/2044/17" : "INV/2044/18";
  const contentJson = JSON.stringify({
    Version: "1.1", TranDtls: { TaxSch: "GST", SupTyp: "B2B" },
    DocDtls: { Typ: "INV", No: number, Dt: "06/09/2044" },
    SellerDtls: { Gstin: "29AAPFU0939F1ZR", LglNm: "Synthetic seller", Addr1: "1 Road", Loc: "Bengaluru", Pin: 560001, Stcd: "29" },
    BuyerDtls: { Gstin: "29AAPFU0939F1ZR", LglNm: "Synthetic buyer", Addr1: "2 Road", Loc: "Bengaluru", Pin: 560001, Stcd: "29", Pos: "29" },
    ItemList: [{ SlNo: "1", IsServc: "Y", HsnCd: "996311", Qty: "1.000", Unit: "OTH", UnitPrice: "100.00", TotAmt: "100.00", AssAmt: "100.00", GstRt: "5.00", CgstAmt: "2.50", SgstAmt: "2.50", TotItemVal: "105.00" }],
    ValDtls: { AssVal: "100.00", CgstVal: "2.50", SgstVal: "2.50", TotInvVal: "105.00" },
  });
  return { kind: "india_native_invoice_v1", documentId, propertyNode, reservationId: id(4), folioId: id(5),
    seriesId: id(6), documentNumber: number, businessDate: "2044-09-06", issuedAt: "2044-09-06T10:00:00.000001Z",
    recipientRegistrationId: id(7), sourceEvidenceHash: "a".repeat(64), documentSha256: "b".repeat(64), previousHash: null, contentJson };
}
function receipt(original, submittedReason) {
  return { documentId: id(20), documentKind: "credit_note", originalDocumentId: original.documentId,
    originalDocNo: original.documentNumber, originalSha256: original.documentSha256, correctionJournalId: id(30),
    seriesId: id(31), docNo: "CRN/2044/1", propertyNode: original.propertyNode, reservationId: original.reservationId,
    folioId: original.folioId, supplierRegistrationId: id(8), recipientRegistrationId: original.recipientRegistrationId,
    financialYearStart: "2044-04-01", currency: "INR", status: "issued", businessDate: "2044-09-07",
    issuedAt: "2044-09-07T11:12:13.000Z", prevHash: null, sha256: "c".repeat(64), sourceEvidenceHash: "d".repeat(64),
    totalMinor: "10500", reason: submittedReason };
}
const { createInvoiceWorkbench } = await import("/assets/operator-invoices.js");
const root = document.querySelector("#root");
const calls = [];
let workbench, cycle = 0, outcomes = [], discoveredReason = reason, releases = [];
// Invoice search is also a POST, but it is not a financial command.
const posts = (value = cycle) => calls.filter(call => call.cycle === value && call.method === "POST"
  && /\/invoices\/[0-9a-f-]{36}\/credit-notes$/.test(call.path));
async function request(path, options = {}) {
  const method = options.method ?? "GET";
  const cycleId = cycle;
  const record = { cycle: cycleId, path, method, body: options.body ?? null, headers: options.headers ?? null };
  calls.push(record);
  const segments = path.split("/");
  const property = segments[4];
  if (path.endsWith("/invoices/search")) return { invoices: { items: [], matchingCount: "0", nextCursor: null } };
  if (path.endsWith("/receipt")) return { delivery: { kind: "not_requested", documentId: segments.at(-2) } };
  if (method === "GET" && path.endsWith("/credit-notes")) return receipt(invoice(segments.at(-2), property), discoveredReason);
  if (method === "GET" && path.endsWith("/delivery")) return { delivery: { kind: "not_requested", documentId: segments.at(-2) } };
  if (method === "GET" && /\/invoices\/[0-9a-f-]{36}$/.test(path)) return { invoice: invoice(segments.at(-1), property) };
  if (method !== "POST" || !/\/invoices\/[0-9a-f-]{36}\/credit-notes$/.test(path)) throw new Error("Unexpected route");
  const outcome = outcomes.shift() ?? "success";
  const original = invoice(segments.at(-2), property);
  if (outcome === "hold") await new Promise(resolve => releases.push(resolve));
  if (outcome === "network") throw new TypeError("Synthetic lost response");
  if (typeof outcome === "number") throw Object.assign(new Error("Synthetic status"), { status: outcome });
  const result = receipt(original, JSON.parse(options.body).reason);
  if (outcome === "wrong-reason") result.reason = "Another reason";
  if (outcome === "wrong-original") result.originalDocumentId = originalB;
  if (outcome === "malformed") result.extra = true;
  return result; // Deliberately raw body: no fabricated replay header.
}
const query = suffix => root.querySelector(".invoice-workbench__credit-issue-" + suffix);
async function mount(nextOutcomes = [], property = propertyA, original = originalA) {
  workbench?.dispose(); root.hidden = false; cycle++; outcomes = [...nextOutcomes];
  workbench = createInvoiceWorkbench({ root, request, propertyNode: property, timezone: "Asia/Kolkata", navigate: value => workbench.show(value) });
  await workbench.show(original);
}
function open() { query("intent").click(); if (!query("reason")) throw new Error("Missing issue confirmation"); }
function fill(value = reason) {
  query("reason").value = value;
  query("reason").dispatchEvent(new Event("input", { bubbles: true }));
  query("confirm").checked = true;
  query("confirm").dispatchEvent(new Event("change", { bubbles: true }));
}
const click = () => query("submit").click();
const message = () => query("message")?.textContent ?? "";
async function issued() { await until(() => message().includes("CRN/2044/1"), "verified receipt"); }
async function unknown() { await until(() => query("submit")?.textContent === "Retry same credit request" && !query("submit").disabled, "same-key retry"); }
function sameRequest(attempts) {
  return attempts.length > 1 && attempts.every(call => call.body === attempts[0].body
    && call.headers["Idempotency-Key"] === attempts[0].headers["Idempotency-Key"]);
}
const proof = { viewport: innerWidth };
try {
  await mount();
  proof.initial = { button: query("intent")?.textContent, posts: posts().length };
  open();
  proof.before = { disabled: query("submit").disabled, original: root.textContent.includes("INV/2044/17")
    && root.textContent.includes("2044-09-06") && root.textContent.includes("₹105.00"), posts: posts().length };
  query("confirm").click();
  proof.confirmOnly = posts().length;
  query("cancel").click();
  proof.cancel = { form: Boolean(query("reason")), posts: posts().length };
  open(); fill();
  query("reason").focus();
  proof.accessible = query("reason").labels.length === 1 && query("confirm").labels.length === 1
    && document.activeElement === query("reason") && getComputedStyle(query("submit")).display !== "none";
  proof.overflow = Math.max(document.documentElement.scrollWidth, root.scrollWidth) - innerWidth;
  click(); await issued();
  const sent = posts()[0];
  proof.success = { count: posts().length, exact: sent.body === JSON.stringify({ reason }), path: sent.path,
    type: sent.headers["Content-Type"], key: sent.headers["Idempotency-Key"],
    inject: Boolean(globalThis.injected) || Boolean(root.querySelector("img")), frames: root.querySelectorAll("iframe").length };
  const terminal = query("submit");
  terminal.hidden = false; terminal.disabled = false; terminal.dispatchEvent(new Event("click"));
  proof.terminal = posts().length;

  await mount(["network"]); open(); fill(); click(); await unknown();
  await workbench.show(originalB);
  await workbench.show(originalA); open();
  const originalReason = query("reason").value;
  query("reason").value = "Changed through script"; click(); await issued();
  proof.retry = { count: posts().length, same: sameRequest(posts()), locked: query("reason").readOnly, reasonPreserved: originalReason === reason };

  proof.errors = [];
  for (const outcome of [400, 403, 404, 409, 503, "wrong-reason", "wrong-original", "malformed"]) {
    await mount([outcome]); open(); fill(); click(); await unknown();
    const text = message();
    click(); await issued();
    proof.errors.push({ outcome, count: posts().length, same: sameRequest(posts()), text });
  }
  proof.uncertainDenials = [];
  for (const status of [400, 403, 404, 409]) {
    await mount(["network", status]); open(); fill(); click(); await unknown();
    click(); await unknown(); await workbench.show(originalA); open(); click(); await issued();
    proof.uncertainDenials.push({ status, count: posts().length, same: sameRequest(posts()) });
  }

  await mount(["network"]); open(); fill(); click(); await unknown();
  discoveredReason = "Different previously issued reason";
  root.querySelector(".invoice-workbench__credit-note-intent").click();
  await until(() => root.querySelector(".invoice-workbench__credit-note-summary"), "explicit discovery");
  proof.discovery = { count: posts().length, unknown: message().includes("unknown"), locked: query("reason").readOnly };
  discoveredReason = reason;

  proof.validation = [];
  for (const [value, valid] of [["", false], ["  ", false], ["x\n", false], ["x\u007f", false],
    ["\ud800", false], ["🏨".repeat(501), false], ["🏨".repeat(500), true], ["x".repeat(500), true], [reason, true]]) {
    await mount(); open(); fill(value);
    proof.validation.push({ valid, enabled: !query("submit").disabled });
    if (!valid) { query("submit").dispatchEvent(new Event("click")); if (posts().length) throw new Error("Invalid reason submitted"); }
  }

  proof.stale = [];
  for (const kind of ["hidden-submit", "detached-submit", "hidden-root", "suspend", "dispose", "original"]) {
    await mount(); open(); fill(); const stale = query("submit"); const staleCycle = cycle;
    if (kind === "hidden-submit") stale.hidden = true;
    if (kind === "detached-submit") stale.remove();
    if (kind === "hidden-root") root.hidden = true;
    if (kind === "suspend") workbench.suspend();
    if (kind === "dispose") workbench.dispose();
    if (kind === "original") await workbench.show(originalB);
    stale.dispatchEvent(new Event("click"));
    proof.stale.push({ kind, posts: posts(staleCycle).length });
    root.hidden = false;
  }

  await mount(["hold"]); open(); fill(); const duplicate = query("submit");
  click(); duplicate.dispatchEvent(new Event("click"));
  proof.inFlight = posts().length;
  query("intent").click(); // Reopening must never create another financial intent.
  releases.shift()(); await sleep(30); open(); click(); await issued();
  proof.reopen = { count: posts().length, same: sameRequest(posts()) };

  await mount(["hold"]); open(); fill(); click(); const oldCycle = cycle;
  await mount([], propertyB, originalB); releases.shift()(); await sleep(30);
  proof.late = { oldPosts: posts(oldCycle).length, newPosts: posts().length,
    current: root.textContent.includes("INV/2044/18"), oldPaint: root.textContent.includes("CRN/2044/1") };
  proof.boundary = { storage: [localStorage.length, sessionStorage.length], frames: root.querySelectorAll("iframe").length,
    providers: calls.filter(call => call.path.includes("fiscal") || call.path.includes("provider")).length,
    urlContainsReason: location.href.includes("reason") || location.href.includes("Idempotency") };
} catch (error) { proof.error = String(error?.stack ?? error); }
document.querySelector("#proof").textContent = JSON.stringify(proof);
</script></body></html>`;
}

test("Order470 cashier issue uses exact confirmation and same-key retries at desktop and 390px", async () => {
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === "/") return new Response(page(), { headers: { "content-type": "text/html; charset=utf-8" } });
    const paths: Record<string, string> = {
      "/assets/operator.css": "src/http/operator/operator.css",
      "/assets/operator-invoices.js": "src/http/operator/invoices.js",
      "/assets/operator-invoice-print.js": "src/http/operator/invoice-print.js",
      "/assets/vendor/qrcodegen-v1.8.0-es6.js": "src/http/operator/vendor/qrcodegen-v1.8.0-es6.js",
    };
    const file = paths[path];
    return file ? new Response(Bun.file(resolve(repository, file)), {
      headers: { "content-type": file.endsWith(".css") ? "text/css" : "text/javascript" },
    }) : new Response("Not found", { status: 404 });
  } });
  const directory = await mkdtemp(resolve(tmpdir(), "yellow-order470-browser-"));
  try {
    await withBrowser(resolve(directory, "profile"), async send => {
      await send("Page.enable");
      for (const width of [1280, 390]) {
        await send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width === 390 });
        await send("Page.navigate", { url: "http://127.0.0.1:" + server.port + "/?width=" + width });
        let encoded = "";
        const deadline = Date.now() + 15_000;
        while (Date.now() < deadline) {
          const result = await send<{ result?: { value?: string } }>("Runtime.evaluate", {
            expression: "document.querySelector('#proof')?.textContent || ''", returnByValue: true,
          });
          if (result.result?.value?.startsWith("{")) { encoded = result.result.value; break; }
          await Bun.sleep(20);
        }
        if (!encoded) throw new Error("Order470 proof did not finish at " + width);
        const proof = JSON.parse(encoded);
        expect(proof.error).toBeUndefined();
        expect(proof.viewport).toBe(width);
        expect(proof.initial).toEqual({ button: "Issue full credit note", posts: 0 });
        expect(proof.before).toEqual({ disabled: true, original: true, posts: 0 });
        expect(proof.confirmOnly).toBe(0);
        expect(proof.cancel).toEqual({ form: false, posts: 0 });
        expect(proof.accessible).toBe(true);
        expect(proof.overflow).toBeLessThanOrEqual(0);
        expect(proof.success).toMatchObject({ count: 1, exact: true, type: "application/json", inject: false, frames: 0 });
        expect(proof.success.path).toBe("/api/v1/properties/00000000-0000-4000-8000-000000000002/invoices/00000000-0000-4000-8000-000000000010/credit-notes");
        expect(proof.success.key).toMatch(/^[!-~]{8,200}$/);
        expect(proof.terminal).toBe(1);
        expect(proof.retry).toEqual({ count: 2, same: true, locked: true, reasonPreserved: true });
        expect(proof.errors).toHaveLength(8);
        for (const outcome of proof.errors) {
          expect(outcome).toMatchObject({ count: 2, same: true });
          expect(outcome.text).toMatch(/unknown|locked/i);
        }
        expect(proof.uncertainDenials).toHaveLength(4);
        for (const outcome of proof.uncertainDenials) expect(outcome).toMatchObject({ count: 3, same: true });
        expect(proof.discovery).toEqual({ count: 1, unknown: true, locked: true });
        expect(proof.validation).toHaveLength(9);
        for (const item of proof.validation) expect(item.enabled).toBe(item.valid);
        expect(proof.stale).toHaveLength(6);
        for (const item of proof.stale) expect(item.posts).toBe(0);
        expect(proof.inFlight).toBe(1);
        expect(proof.reopen).toEqual({ count: 2, same: true });
        expect(proof.late).toEqual({ oldPosts: 1, newPosts: 0, current: true, oldPaint: false });
        expect(proof.boundary).toEqual({ storage: [0, 0], frames: 0, providers: 0, urlContainsReason: false });
      }
    });
  } finally {
    server.stop(true);
    const owned = resolve(directory);
    if (dirname(owned) !== resolve(tmpdir()) || !basename(owned).startsWith("yellow-order470-browser-")) {
      throw new Error("Owned profile path changed");
    }
    await rm(owned, { recursive: true, force: true });
  }
}, 60_000);
