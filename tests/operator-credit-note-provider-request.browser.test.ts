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
  if (!browser) throw new Error("Chromium is required for Order471");
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
  return { documentId: id(original.documentId === originalA ? 20 : 21), documentKind: "credit_note", originalDocumentId: original.documentId,
    originalDocNo: original.documentNumber, originalSha256: original.documentSha256, correctionJournalId: id(30),
    seriesId: id(31), docNo: "CRN/2044/1", propertyNode: original.propertyNode, reservationId: original.reservationId,
    folioId: original.folioId, supplierRegistrationId: id(8), recipientRegistrationId: original.recipientRegistrationId,
    financialYearStart: "2044-04-01", currency: "INR", status: "issued", businessDate: "2044-09-07",
    issuedAt: "2044-09-07T11:12:13.000Z", prevHash: null, sha256: "c".repeat(64), sourceEvidenceHash: "d".repeat(64),
    totalMinor: "10500", reason: submittedReason };
}

const { createInvoiceWorkbench } = await import("/assets/operator-invoices.js");
const root = document.querySelector("#root");
const provider = { providerExtensionId: id(40), providerExtensionVersion: 3,
  providerKey: "sandbox-credit", label: "Synthetic <img src=x> sandbox", environment: "sandbox" };
const calls = [];
const proof = { viewport: innerWidth, checks: [], failures: [], scenarios: [] };
globalThis.order471Proof = proof;
const cls = name => ".invoice-workbench__credit-note-provider-" + name;
function check(name, value, detail) {
  proof.checks.push(name);
  if (!value) proof.failures.push({ name, detail: detail ?? null });
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function accepted(documentId = id(20)) {
  return { fiscalSubmission: { submissionId: id(50), documentId, attemptId: id(51), attemptNumber: 1,
    retryCount: 0, status: "pending", disposition: "send", transitionSeq: 1,
    provider: { key: provider.providerKey, extensionId: provider.providerExtensionId,
      extensionVersion: provider.providerExtensionVersion }, replayed: false } };
}
function delivery(documentId, propertyNode, variant = "not_requested") {
  if (["not_requested", "ambiguous"].includes(variant)) return { delivery: { kind: variant, documentId } };
  if (variant === "legacy") return { delivery: { kind: "legacy_unsupported", documentId, submissionId: id(50) } };
  const base = { submissionId: id(50), tenantId: id(1), propertyNode, documentId,
    documentSha256: "c".repeat(64), wireSha256: "e".repeat(64), providerKey: provider.providerKey,
    attemptId: id(51), attemptNumber: 1, transitionSeq: 1 };
  let row = { ...base, kind: "pending", status: "pending", disposition: "send" };
  if (variant === "rejected") row = { ...base, kind: "rejected", status: "rejected", disposition: "none",
    environment: "sandbox", responseSha256: "f".repeat(64), errorCodes: ["SYNTHETIC"] };
  if (variant === "registered") row = { ...base, kind: "accepted_signed_v1", status: "accepted", disposition: "none",
    environment: "sandbox", responseSha256: "f".repeat(64), irn: "4".repeat(64), ackNo: "90071992547409991",
    ackDt: "2044-09-07 12:34:56", signedInvoice: "e30.e30.YQ", signedQRCode: "e30.eyJxciI6MX0.YQ",
    signedInvoiceSha256: "5".repeat(64), signedQrSha256: "6".repeat(64), verification: {
      profileVersion: "yellow_native_india_1_1_v1", issuer: "SYNTHETIC-IRP", verificationUnixMs: 1800000000000,
      invoiceKeyId: "invoice-key", invoiceKeySpkiSha256: "7".repeat(64), invoiceBundleVersion: "bundle-v1",
      qrKeyId: "qr-key", qrKeySpkiSha256: "8".repeat(64), qrBundleVersion: "bundle-v1" } };
  return { delivery: { kind: "receipt", documentId, receipt: row } };
}
let keyboardSequence = 0;
async function keyboard(control, key) {
  control.focus();
  check("keyboard focus " + key, document.activeElement === control);
  const sequence = ++keyboardSequence;
  globalThis.order471Keyboard = { sequence, key };
  await until(() => globalThis.order471KeyboardDone === sequence, "native keyboard " + key);
  globalThis.order471Keyboard = null;
}
function fixture(config = {}, propertyNode = propertyA) {
  const local = [];
  let deliveries = 0;
  const request = async (path, options = {}) => {
    const call = { path, method: options.method ?? "GET", body: options.body, headers: options.headers };
    local.push(call); calls.push(call);
    const parts = path.split("/");
    if (parts[4] !== propertyNode) throw new Error("Synthetic request crossed property");
    if (path.endsWith("/invoices/search")) return { invoices: { items: [], matchingCount: "0", nextCursor: null } };
    if (path.endsWith("/receipt")) return delivery(parts.at(-2), propertyNode);
    if (path.endsWith("/delivery")) {
      deliveries += 1;
      return config.delivery ? config.delivery(parts.at(-2), deliveries) : delivery(parts.at(-2), propertyNode);
    }
    if (path.endsWith("/credit-notes")) return receipt(invoice(parts.at(-2), propertyNode), reason);
    if (path.endsWith("/fiscal-provider-options")) return config.options ? config.options() : { providers: [provider] };
    if (path.endsWith("/fiscal-submissions")) return config.submit ? config.submit(call) : accepted(JSON.parse(call.body).documentId);
    if (/\/invoices\/[0-9a-f-]{36}$/.test(path)) return { invoice: invoice(parts.at(-1), propertyNode) };
    throw new Error("Unexpected synthetic request: " + path);
  };
  const workbench = createInvoiceWorkbench({ root, request, propertyNode, timezone: "Asia/Kolkata", navigate: () => undefined });
  const posts = () => local.filter(call => call.method === "POST" && call.path.endsWith("/fiscal-submissions"));
  async function open(documentId = originalA) {
    await workbench.show(documentId);
    await reload();
  }
  async function reload() {
    root.querySelector(".invoice-workbench__credit-note-intent").click();
    await until(() => root.querySelector(".invoice-workbench__credit-note-actions"), "credit discovery");
  }
  async function choices() {
    root.querySelector(cls("intent")).click();
    await until(() => root.querySelector(cls("select")), "provider choices");
    return { select: root.querySelector(cls("select")), confirmation: root.querySelector(cls("confirmation")),
      submit: root.querySelector(cls("submit")) };
  }
  async function ready() {
    const controls = await choices();
    controls.select.value = provider.providerExtensionId;
    controls.select.dispatchEvent(new Event("change", { bubbles: true }));
    controls.confirmation.checked = true;
    controls.confirmation.dispatchEvent(new Event("change", { bubbles: true }));
    return controls;
  }
  return { workbench, local, posts, open, reload, choices, ready };
}
async function scenario(name, run) {
  proof.scenarios.push(name);
  let instance;
  try { await run((config, property) => { instance = fixture(config, property); return instance; }); }
  catch (error) { proof.failures.push({ name, error: String(error?.stack ?? error) }); }
  finally { instance?.workbench.dispose(); }
}
function requestIdentity(name, posts, count, property = propertyA) {
  check(name + " exact send count", posts.length === count, posts.length);
  for (const call of posts) {
    check(name + " credit route/body", call.path === "/api/v1/properties/" + property + "/fiscal-submissions"
      && call.method === "POST" && call.body === JSON.stringify({ documentId: id(20), providerExtensionId: id(40) }), call);
    check(name + " secure key and exact headers", Object.keys(call.headers).sort().join() === "Content-Type,Idempotency-Key"
      && call.headers["Content-Type"] === "application/json" && /^[\x21-\x7e]{8,200}$/.test(call.headers["Idempotency-Key"]));
  }
  check(name + " stable identity", new Set(posts.map(call => call.headers["Idempotency-Key"])).size === 1);
}
try {
  await scenario("explicit keyboard request and authorized refresh", async make => {
    const f = make({ delivery: (documentId, count) => delivery(documentId, propertyA,
      count === 1 ? "not_requested" : count === 2 ? "pending" : "registered") });
    await f.open();
    proof.initial = { label: root.querySelector(cls("intent"))?.textContent ?? null, submissions: f.posts().length };
    check("no eager providers", !f.local.some(call => call.path.endsWith("/fiscal-provider-options")));
    const controls = await f.choices();
    check("provider initially unselected", controls.select.value === "" && controls.confirmation.disabled && controls.submit.disabled);
    check("offered identity and escaped label", controls.select.options.length === 2
      && controls.select.options[1].textContent === provider.label + " · " + provider.providerKey + " · sandbox"
      && !root.querySelector("img") && !globalThis.injected);
    await keyboard(controls.select, "ArrowDown");
    await keyboard(controls.select, "Enter");
    check("explicit provider only enables confirmation", controls.select.value === provider.providerExtensionId
      && !controls.confirmation.disabled && !controls.confirmation.checked && controls.submit.disabled && f.posts().length === 0);
    check("affirmative environment label", controls.confirmation.parentElement.textContent.includes("sandbox environment"));
    await keyboard(controls.confirmation, " ");
    check("checking does not submit", controls.confirmation.checked && !controls.submit.disabled && f.posts().length === 0);
    await keyboard(controls.submit, "Enter");
    await until(() => root.dataset.invoiceState === "ready" && f.posts().length === 1, "request accepted");
    check("successful request leaves in-flight state", root.textContent.includes("Registration request accepted."), root.querySelector(cls("message"))?.textContent);
    requestIdentity("keyboard success", f.posts(), 1);
    check("acceptance is pending, not registration", root.textContent.includes("Registration pending")
      && !root.textContent.includes("IRP registered") && !root.textContent.includes("SANDBOX —"));
    check("one explicit post-success credit refresh", f.local.filter(call => call.path.endsWith("/credit-notes/" + id(20) + "/delivery")).length === 2);
    controls.submit.disabled = false; controls.submit.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    check("terminal detached submit cannot resend", f.posts().length === 1 && !root.querySelector(cls("submit")));
    await f.reload();
    check("signed sandbox status only after authorized read", root.textContent.includes("SANDBOX — not a production registration")
      && !root.querySelector(cls("intent")) && !root.querySelector(cls("submit")));
  });

  await scenario("unknown and denied outcomes retain one identity across navigation", async make => {
    const outcomes = ["network", 403, 404, 409, 422, "malformed", "wrong-document", "wrong-provider", "success"];
    let attempt = 0;
    const f = make({ submit: () => {
      const outcome = outcomes[attempt++];
      if (outcome === "network") throw new TypeError("Synthetic offline");
      if (typeof outcome === "number") throw { status: outcome };
      if (outcome === "malformed") return { fiscalSubmission: {} };
      const value = accepted(outcome === "wrong-document" ? originalA : id(20));
      if (outcome === "wrong-provider") value.fiscalSubmission.provider.extensionVersion += 1;
      return value;
    } });
    await f.open();
    const controls = await f.ready(); controls.submit.click();
    for (let index = 0; index < outcomes.length - 1; index += 1) {
      await until(() => root.dataset.invoiceState === "unknown", "unknown " + outcomes[index]);
      check("unknown outcome honest " + outcomes[index], root.textContent.includes("outcome is unknown")
        && !root.textContent.includes("Registration request accepted."));
      check("no read/poll after uncertain send " + outcomes[index], f.local.filter(call => call.path.endsWith("/delivery")).length === 1 + index * 2);
      const stale = root.querySelector(cls("submit"));
      await f.workbench.show(null); await f.open(originalB);
      stale.disabled = false; stale.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      check("old subject cannot send " + index, f.posts().length === index + 1);
      await f.open();
      const retry = root.querySelector(cls("submit"));
      check("retained retry only " + index, retry?.textContent === "Retry same credit-note registration"
        && !root.querySelector(cls("select")) && !root.querySelector(cls("intent")));
      retry.click();
    }
    await until(() => root.dataset.invoiceState === "ready" && f.posts().length === outcomes.length, "retained request success");
    check("successful retry leaves in-flight state", root.textContent.includes("Registration request accepted."), root.querySelector(cls("message"))?.textContent);
    requestIdentity("navigation retries", f.posts(), outcomes.length);
    check("provider never reselected after uncertain send", f.local.filter(call => call.path.endsWith("/fiscal-provider-options")).length === 1);
  });

  await scenario("same-view unknown retry remains actionable", async make => {
    let attempts = 0;
    const f = make({ submit: () => { if (++attempts === 1) throw new TypeError("Synthetic offline"); return accepted(); } });
    await f.open(); const controls = await f.ready(); controls.submit.click();
    await until(() => root.dataset.invoiceState === "unknown", "same-view unknown");
    const retry = root.querySelector(cls("submit"));
    check("same-view retry has deliberate label", retry?.textContent === "Retry same credit-note registration");
    retry.click(); await sleep(25);
    requestIdentity("same-view retry", f.posts(), 2);
  });

  for (const variant of ["denied", "wrong-credit", "wrong-property", "wrong-hash"]) {
    await scenario("accepted request with unreadable delivery " + variant, async make => {
      const f = make({ delivery: (documentId, count) => {
        if (count === 1) return delivery(documentId, propertyA);
        if (variant === "denied") throw { status: 403 };
        const value = delivery(documentId, propertyA, "registered");
        if (variant === "wrong-credit") value.delivery.receipt.documentId = originalA;
        if (variant === "wrong-property") value.delivery.receipt.propertyNode = propertyB;
        if (variant === "wrong-hash") value.delivery.receipt.documentSha256 = "b".repeat(64);
        return value;
      } });
      await f.open(); (await f.ready()).submit.click();
      await until(() => root.dataset.invoiceState === "ready" && f.posts().length === 1, "unreadable post-success delivery");
      check("accepted request distinguished from unreadable delivery " + variant,
        root.textContent.includes("Registration request accepted;"), root.querySelector(cls("message"))?.textContent);
      check("unreadable delivery honest " + variant, root.textContent.includes(variant === "denied"
        ? "unavailable for this role" : "invalid and cannot be displayed") && !root.textContent.includes("SANDBOX —"));
      check("accepted but unreadable is terminal " + variant, f.posts().length === 1
        && !root.querySelector(cls("submit")) && !root.querySelector(cls("intent")));
    });
  }

  for (const variant of ["pending", "registered", "rejected", "legacy", "ambiguous", "unavailable"]) {
    await scenario("existing delivery is not fresh capability " + variant, async make => {
      const f = make({ delivery: documentId => { if (variant === "unavailable") throw { status: 403 }; return delivery(documentId, propertyA, variant); } });
      await f.open();
      check("no fresh request " + variant, !root.querySelector(cls("intent")) && !root.querySelector(cls("submit"))
        && f.posts().length === 0 && !f.local.some(call => call.path.endsWith("/fiscal-provider-options")));
    });
  }

  await scenario("actual connected visible enabled controls only", async make => {
    const f = make(); await f.open();
    const intent = root.querySelector(cls("intent"));
    const slot = intent.parentElement;
    slot.hidden = true; intent.dispatchEvent(new MouseEvent("click", { bubbles: true })); slot.hidden = false;
    intent.disabled = true; intent.dispatchEvent(new MouseEvent("click", { bubbles: true })); intent.disabled = false;
    const substitute = intent.cloneNode(true); intent.replaceWith(substitute);
    intent.dispatchEvent(new MouseEvent("click", { bubbles: true })); substitute.replaceWith(intent);
    check("hidden disabled detached intent cannot load providers", !f.local.some(call => call.path.endsWith("/fiscal-provider-options")));
    const c = await f.ready();
    for (const control of [c.select, c.confirmation, c.submit, c.submit.parentElement, slot, root]) {
      control.hidden = true; c.submit.dispatchEvent(new MouseEvent("click", { bubbles: true })); control.hidden = false;
    }
    for (const control of [c.select, c.confirmation, c.submit]) {
      control.disabled = true; c.submit.dispatchEvent(new MouseEvent("click", { bubbles: true })); control.disabled = false;
      const replacement = control.cloneNode(true); control.replaceWith(replacement);
      c.submit.dispatchEvent(new MouseEvent("click", { bubbles: true })); replacement.replaceWith(control);
    }
    check("hidden disabled replaced effect controls cannot submit", f.posts().length === 0);
    f.workbench.suspend(); c.submit.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    check("suspended control cannot submit", f.posts().length === 0 && root.hidden);
    f.workbench.dispose(); c.submit.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    check("disposed control cannot submit", f.posts().length === 0 && root.childElementCount === 0);
  });

  await scenario("in-flight disclosure replacement does not strand retry", async make => {
    const pending = deferred(); const f = make({ submit: () => pending.promise });
    await f.open(); const c = await f.ready(); c.submit.click(); c.submit.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await f.reload();
    check("in-flight reopening cannot send twice", f.posts().length === 1 && !root.querySelector(cls("submit"))
      && root.textContent.includes("still in progress"));
    pending.reject(new TypeError("Synthetic lost response")); await sleep(25);
    check("settled reopened request offers same-identity retry", root.querySelector(cls("submit"))?.textContent === "Retry same credit-note registration",
      root.querySelector(cls("message"))?.textContent);
    await f.reload();
    check("explicit reload retains uncertainty", root.querySelector(cls("submit"))?.textContent === "Retry same credit-note registration");
  });

  for (const boundary of ["navigate", "suspend", "dispose"]) {
    await scenario("late provider options after " + boundary, async make => {
      const pending = deferred(); const f = make({ options: () => pending.promise });
      await f.open(); root.querySelector(cls("intent")).click();
      if (boundary === "navigate") await f.open(originalB);
      else f.workbench[boundary]();
      const before = root.innerHTML; pending.resolve({ providers: [provider] }); await sleep(25);
      check("late options cannot paint " + boundary, root.innerHTML === before && !root.querySelector(cls("select")) && f.posts().length === 0);
    });
    await scenario("late submission after " + boundary, async make => {
      const pending = deferred(); const f = make({ submit: () => pending.promise });
      await f.open(); const c = await f.ready(); c.submit.click();
      if (boundary === "navigate") await f.open(originalB);
      else f.workbench[boundary]();
      const before = root.innerHTML, reads = f.local.length;
      pending.resolve(accepted()); await sleep(25);
      check("late submission cannot paint or refresh " + boundary, root.innerHTML === before && f.local.length === reads && f.posts().length === 1);
      c.submit.disabled = false; c.submit.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      check("old settled submit cannot send " + boundary, f.local.length === reads && f.posts().length === 1);
      if (boundary !== "dispose") {
        await f.open();
        check("late completion retains uncertain identity " + boundary, root.querySelector(cls("submit"))?.textContent === "Retry same credit-note registration");
      }
    });
    await scenario("late credit delivery after " + boundary, async make => {
      const pending = deferred();
      const f = make({ delivery: (documentId, count) => count === 2 ? pending.promise : delivery(documentId, propertyA) });
      await f.open(); (await f.ready()).submit.click();
      await until(() => f.local.filter(call => call.path.endsWith("/delivery")).length === 2, "pending delivery refresh");
      if (boundary === "navigate") await f.open(originalB);
      else f.workbench[boundary]();
      const before = root.innerHTML; pending.resolve(delivery(id(20), propertyA, "registered")); await sleep(25);
      check("late delivery cannot paint " + boundary, root.innerHTML === before && !root.textContent.includes("SANDBOX —"));
    });
  }
  await scenario("disposed property cannot affect new property", async make => {
    const pending = deferred(); const first = make({ options: () => pending.promise });
    await first.open(); root.querySelector(cls("intent")).click(); first.workbench.dispose();
    const second = make({}, propertyB); await second.open(); const before = root.innerHTML;
    pending.resolve({ providers: [provider] }); await sleep(25);
    check("late prior-property response stays private", root.innerHTML === before && !root.querySelector(cls("select")));
    (await second.ready()).submit.click();
    await until(() => root.dataset.invoiceState === "ready" && second.posts().length === 1, "new property deliberate request");
    requestIdentity("new property", second.posts(), 1, propertyB);
    check("disposed controller retains no actionable request", first.posts().length === 0);
  });
  await scenario("dispose clears private uncertain intent", async make => {
    const first = make({ submit: () => { throw new TypeError("Synthetic lost response"); } });
    await first.open(); (await first.ready()).submit.click();
    await until(() => root.dataset.invoiceState === "unknown", "unknown before disposal");
    const originalKey = first.posts()[0].headers["Idempotency-Key"];
    first.workbench.dispose();
    const second = make(); await second.open();
    check("new controller has no retained private intent", Boolean(root.querySelector(cls("intent"))) && !root.querySelector(cls("submit")));
    (await second.ready()).submit.click();
    await until(() => root.dataset.invoiceState === "ready" && second.posts().length === 1, "new controller request");
    check("private intent ends at disposal not reload persistence", second.posts()[0].headers["Idempotency-Key"] !== originalKey);
  });
  check("no credit uses invoice receipt route", !calls.some(call => /\/invoices\/(?:00000000-0000-4000-8000-000000000020|00000000-0000-4000-8000-000000000021)\/receipt$/.test(call.path)));
  check("no financial issue refund print or provider action", calls.every(call => call.method === "GET"
    || (call.method === "POST" && (call.path.endsWith("/fiscal-submissions") || call.path.endsWith("/invoices/search")))));
  check("private state not persisted", localStorage.length === 0 && sessionStorage.length === 0
    && !location.href.includes(provider.providerExtensionId) && !globalThis.injected);
} catch (error) { proof.error = String(error?.stack ?? error); }
document.querySelector("#proof").textContent = JSON.stringify(proof);
</script></body></html>
`;
}

test("Order471 credit-note provider request is explicit and credit-scoped at desktop and 390px", async () => {
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
  const directory = await mkdtemp(resolve(tmpdir(), "yellow-order471-browser-"));
  try {
    await withBrowser(resolve(directory, "profile"), async send => {
      await send("Page.enable");
      const proofs = [];
      for (const width of [1280, 390]) {
        await send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width === 390 });
        await send("Page.navigate", { url: "http://127.0.0.1:" + server.port + "/?width=" + width });
        let encoded = "";
        let lastKeyboard = 0;
        const deadline = Date.now() + 15_000;
        while (Date.now() < deadline) {
          const result = await send<{ result?: { value?: { encoded: string; keyboard?: { sequence: number; key: string } } } }>("Runtime.evaluate", {
            expression: "({ encoded: document.querySelector('#proof')?.textContent || '', keyboard: globalThis.order471Keyboard })", returnByValue: true,
          });
          const value = result.result?.value;
          if (value?.encoded.startsWith("{")) { encoded = value.encoded; break; }
          const keyboard = value?.keyboard;
          if (keyboard && keyboard.sequence > lastKeyboard) {
            const keys: Record<string, { code: string; windowsVirtualKeyCode: number; text?: string }> = {
              ArrowDown: { code: "ArrowDown", windowsVirtualKeyCode: 40 },
              " ": { code: "Space", windowsVirtualKeyCode: 32, text: " " },
              Enter: { code: "Enter", windowsVirtualKeyCode: 13, text: "\r" },
            };
            const key = keys[keyboard.key];
            if (!key) throw new Error("Unexpected Order471 keyboard proof key");
            await send("Input.dispatchKeyEvent", { type: "keyDown", key: keyboard.key, ...key });
            await send("Input.dispatchKeyEvent", { type: "keyUp", key: keyboard.key, code: key.code,
              windowsVirtualKeyCode: key.windowsVirtualKeyCode });
            await send("Runtime.evaluate", { expression: "globalThis.order471KeyboardDone = " + keyboard.sequence });
            lastKeyboard = keyboard.sequence;
          }
          await Bun.sleep(20);
        }
        if (!encoded) {
          const diagnostic = await send<{ result?: { value?: unknown } }>("Runtime.evaluate", {
            expression: "({ progress: globalThis.order471Proof, state: document.querySelector('#root')?.dataset.invoiceState })", returnByValue: true,
          });
          throw new Error("Order471 proof did not finish at " + width + ": " + JSON.stringify(diagnostic.result?.value));
        }
        const proof = JSON.parse(encoded);
        proofs.push(proof);
      }
      console.info("Order471 actual Chromium", JSON.stringify(proofs.map(proof => ({ viewport: proof.viewport,
        scenarios: proof.scenarios.length, checks: proof.checks.length, failures: proof.failures.length }))));
      for (const proof of proofs) {
        expect(proof.error).toBeUndefined();
        expect([1280, 390]).toContain(proof.viewport);
        expect(proof.initial).toEqual({ label: "Register credit note with provider", submissions: 0 });
        expect(proof.checks.length).toBeGreaterThan(100);
        expect(proof.scenarios.length).toBe(26);
      }
      expect(proofs.map(proof => proof.viewport)).toEqual([1280, 390]);
      expect(proofs.flatMap(proof => proof.failures.map((failure: unknown) => ({ viewport: proof.viewport, failure })))).toEqual([]);
    });
  } finally {
    server.stop(true);
    const owned = resolve(directory);
    if (dirname(owned) !== resolve(tmpdir()) || !basename(owned).startsWith("yellow-order471-browser-")) {
      throw new Error("Owned profile path changed");
    }
    await rm(owned, { recursive: true, force: true });
  }
}, 60_000);
