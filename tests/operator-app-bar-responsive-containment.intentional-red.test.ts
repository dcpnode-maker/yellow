import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dir, "..");
const cssFile = resolve(root, "src/http/operator/operator.css");

const browserCandidates = [
  process.env.PROGRAMFILES && resolve(process.env.PROGRAMFILES, "Google/Chrome/Application/chrome.exe"),
  process.env["PROGRAMFILES(X86)"] && resolve(process.env["PROGRAMFILES(X86)"], "Google/Chrome/Application/chrome.exe"),
  process.env.LOCALAPPDATA && resolve(process.env.LOCALAPPDATA, "Google/Chrome/Application/chrome.exe"),
  process.env.PROGRAMFILES && resolve(process.env.PROGRAMFILES, "Microsoft/Edge/Application/msedge.exe"),
  Bun.which("google-chrome"),
  Bun.which("chromium"),
  Bun.which("chromium-browser"),
].filter((candidate): candidate is string => Boolean(candidate));
const browserPath = browserCandidates.find((candidate) => existsSync(candidate));

type Geometry = Readonly<{
  viewport: number;
  deviceScaleFactor: number;
  documentOverflow: number;
  bodyOverflow: number;
  headerOverflow: number;
  workspaceOverflow: number;
  nativeSelects: number;
  retainedLabels: string[];
  brand: string;
  session: string;
  verticalScrollbar: boolean;
  rails: Array<{ overflow: number; locallyScrollable: boolean; usable: boolean }>;
}>;

const fullShellFixture = (stylesheet: string) => `<!doctype html>
<html lang="en" data-theme="apple" data-experience="expert"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="${stylesheet}"></head>
<body><header class="app-bar">
<div class="brand" aria-label="Yellow Hospitality OS"><span class="brand-mark" aria-hidden="true">Y</span>
<span><strong>Yellow</strong><small>Hotel Operations</small></span></div>
<div class="app-actions">
<label class="experience-control"><span>Workspace detail</span><select id="experience-select" aria-label="Workspace detail">
<option value="simple">Simple</option><option value="advanced">Advanced</option><option value="expert" selected>Expert</option></select></label>
<label class="theme-control"><span>Appearance</span><select id="theme-select" aria-label="Appearance">
<option value="apple">Apple iOS</option><option value="android">Android · Material 3</option>
<option value="win95">Windows 95 / 98</option><option value="glass">Glassmorphism</option>
<option value="neo">Neomorphism</option><option value="erp">Enterprise ERP</option></select></label>
<div class="session-state" id="session-state">Local review · signed out</div></div></header>
<main><div class="workbench"><section id="folios-view"><div class="section-heading"><div>
<p class="eyebrow">Guest ledger evidence</p><h2>Folios</h2></div></div>
<section class="folio-statement card" id="folio-workspace" aria-labelledby="folio-workspace-title" tabindex="-1">
<div class="folio-workspace-head"><button class="quiet" type="button">Back to folio lookup</button><div>
<p class="eyebrow">Immutable guest ledger</p><h3 id="folio-workspace-title">Folio FOL-DXB-2026-000123 · Priya Ramanathan</h3></div></div>
<div class="folio-summary folio-account-summary" aria-label="Stay folio totals">
<span>Stay total <strong>982500</strong></span><span>Active window <strong>982500</strong></span>
<span>Currency <strong>INR</strong></span><span>Windows <strong>3</strong></span></div>
<div class="folio-window-rail" data-local-rail><div class="folio-workspace-tabs" id="folio-window-tabs" role="tablist" aria-label="Folio windows">
<button class="quiet folio-window-tab" role="tab" aria-selected="true">Primary guest window</button>
<button class="quiet folio-window-tab" role="tab" aria-selected="false">Business incidentals</button>
<button class="quiet folio-window-tab" role="tab" aria-selected="false">Personal extras</button>
<button class="quiet folio-window-tab" role="tab" aria-selected="false">Company direct billing</button>
<button class="quiet folio-window-tab" role="tab" aria-selected="false">Corrections and allowances</button></div>
<button class="quiet" type="button">New folio window</button></div>
<div class="folio-workspace-tabs" id="folio-workspace-tabs" data-local-rail role="tablist" aria-label="Folio workspace">
<button class="quiet" role="tab" aria-selected="true">Statement</button><button class="quiet" role="tab">Add charge</button>
<button class="quiet" role="tab">Deposits</button><button class="quiet" role="tab">Separate charges</button>
<button class="quiet" role="tab">Direct billing</button></div>
<div id="folio-statement"><div class="folio-summary"><div><span>Reference</span><strong>FOL-DXB-2026-000123</strong></div>
<div><span>Window</span><strong>Primary guest window</strong></div><div><span>Status</span><strong>Open</strong></div></div>
<div class="folio-statement-cards"><article class="folio-posting-card"><strong>Room charge · Deluxe King</strong>
<dl><dt>Business date</dt><dd>2026-09-01</dd><dt>Amount</dt><dd>982500</dd></dl></article></div></div>
</section></section></div></main><div style="height:1000px" aria-hidden="true"></div><pre id="result"></pre><script>
requestAnimationFrame(()=>requestAnimationFrame(()=>{const header=document.querySelector('.app-bar');
const workspace=document.querySelector('#folio-workspace');const root=document.documentElement;
const rails=[...document.querySelectorAll('[data-local-rail]')].map(rail=>{const overflow=Math.max(0,rail.scrollWidth-rail.clientWidth);
const locallyScrollable=['auto','scroll'].includes(getComputedStyle(rail).overflowX);const before=rail.scrollLeft;
if(overflow>0)rail.scrollLeft=Math.min(16,overflow);const usable=overflow===0||(locallyScrollable&&rail.scrollLeft>before);rail.scrollLeft=before;
return{overflow,locallyScrollable,usable};});
const proof={viewport:innerWidth,deviceScaleFactor:devicePixelRatio,
documentOverflow:Math.max(0,root.scrollWidth-root.clientWidth),bodyOverflow:Math.max(0,document.body.scrollWidth-document.body.clientWidth),
headerOverflow:Math.max(0,header.scrollWidth-header.clientWidth),workspaceOverflow:Math.max(0,workspace.scrollWidth-workspace.clientWidth),
nativeSelects:[...header.querySelectorAll('select')].filter(select=>getComputedStyle(select).appearance!=='none').length,
retainedLabels:[...header.querySelectorAll('label>span')].map(label=>label.textContent.trim()),
brand:header.querySelector('.brand').getAttribute('aria-label'),session:header.querySelector('#session-state').textContent.trim(),
verticalScrollbar:root.scrollHeight>root.clientHeight&&root.clientWidth<innerWidth,rails};
document.querySelector('#result').textContent=JSON.stringify(proof);document.body.dataset.proof='ready';}));
</script></body></html>`;

async function measure(htmlFile: string, profile: string, width: number): Promise<Geometry> {
  if (!browserPath) throw new Error("Chrome or Chromium is required for Order330 geometry proof");
  const url = pathToFileURL(htmlFile).href;
  const chrome = Bun.spawn([browserPath, "--headless=new", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage", "--no-first-run", "--no-default-browser-check", "--allow-file-access-from-files",
    "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { stdout: "ignore", stderr: "ignore" });
  try {
    const portFile = resolve(profile, "DevToolsActivePort"); let port = "";
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (existsSync(portFile)) port = (await Bun.file(portFile).text()).split(/\r?\n/, 1)[0] ?? "";
      if (port) break; await Bun.sleep(25);
    }
    if (!port) throw new Error("Chromium did not expose a DevTools port");
    const response = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: "PUT" });
    if (!response.ok) throw new Error(`Chromium target creation failed (${response.status})`);
    const target = await response.json() as { webSocketDebuggerUrl?: string };
    if (!target.webSocketDebuggerUrl) throw new Error("Chromium target has no debugger endpoint");
    const socket = new WebSocket(target.webSocketDebuggerUrl); let id = 0;
    const pending = new Map<number, { resolve: (value: unknown) => void; reject: (reason: Error) => void }>();
    const opened = new Promise<void>((resolveOpen, rejectOpen) => {
      socket.addEventListener("open", () => resolveOpen(), { once: true });
      socket.addEventListener("error", () => rejectOpen(new Error("Chromium debugger socket failed")), { once: true });
    });
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as { id?: number; result?: unknown; error?: { message?: string } };
      if (!message.id) return; const request = pending.get(message.id); if (!request) return; pending.delete(message.id);
      if (message.error) request.reject(new Error(message.error.message ?? "Chromium command failed")); else request.resolve(message.result);
    });
    await opened;
    const send = <T>(method: string, params: Record<string, unknown> = {}) => new Promise<T>((resolveCommand, rejectCommand) => {
      id += 1; pending.set(id, { resolve: (value) => resolveCommand(value as T), reject: rejectCommand });
      socket.send(JSON.stringify({ id, method, params }));
    });
    await send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 2, mobile: false });
    await send("Page.enable"); await send("Runtime.enable"); await send("Page.navigate", { url });
    let proof: string | null = null;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const result = await send<{ result?: { value?: string | null } }>("Runtime.evaluate", {
        expression: "document.body?.dataset.proof === 'ready' ? document.querySelector('#result')?.textContent : null", returnByValue: true,
      });
      proof = result.result?.value ?? null; if (proof) break; await Bun.sleep(25);
    }
    socket.close(); if (!proof) throw new Error(`Chromium produced no full-shell geometry at ${width}px`);
    return JSON.parse(proof) as Geometry;
  } finally { chrome.kill(); await chrome.exited; }
}

test("Order330 intentional red: full app bar and loaded Folio are contained at 375px and 640px / DSF2", async () => {
  const folder = await mkdtemp(resolve(tmpdir(), "yellow-order330-red-"));
  try {
    const fixture = resolve(folder, "full-shell-loaded-folio.html");
    await Bun.write(fixture, fullShellFixture(pathToFileURL(cssFile).href));
    const proofs = await Promise.all([375, 640].map((width) => measure(fixture, resolve(folder, `chrome-${width}`), width)));
    expect(proofs.map(({ viewport, deviceScaleFactor }) => ({ viewport, deviceScaleFactor }))).toEqual([
      { viewport: 375, deviceScaleFactor: 2 }, { viewport: 640, deviceScaleFactor: 2 },
    ]);
    expect(proofs.every(({ nativeSelects, retainedLabels, brand, session, verticalScrollbar }) =>
      nativeSelects === 2 && retainedLabels.join("|") === "Workspace detail|Appearance" &&
      brand === "Yellow Hospitality OS" && session === "Local review · signed out" && verticalScrollbar)).toBe(true);
    expect(proofs.every(({ rails }) => rails.length === 2 && rails.every(({ usable }) => usable))).toBe(true);
    expect(proofs.map(({ viewport, documentOverflow, bodyOverflow, headerOverflow, workspaceOverflow }) =>
      ({ viewport, documentOverflow, bodyOverflow, headerOverflow, workspaceOverflow }))).toEqual([
      { viewport: 375, documentOverflow: 0, bodyOverflow: 0, headerOverflow: 0, workspaceOverflow: 0 },
      { viewport: 640, documentOverflow: 0, bodyOverflow: 0, headerOverflow: 0, workspaceOverflow: 0 },
    ]);
  } finally { await rm(folder, { recursive: true, force: true }); }
}, 30_000);
