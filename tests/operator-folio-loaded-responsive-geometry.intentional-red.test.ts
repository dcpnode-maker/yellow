import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
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

type FolioGeometry = Readonly<{
  viewport: number;
  deviceScaleFactor: number;
  documentOverflow: number;
  workspaceOverflow: number;
  railOverflow: number;
  railLocallyScrollable: boolean;
}>;

const loadedFolioFixture = (stylesheet: string) => `<!doctype html>
<html lang="en" data-theme="apple" data-experience="expert"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="${stylesheet}"></head>
<body><main><div class="workbench"><section id="folios-view"><div class="section-heading"><div>
<p class="eyebrow">Guest ledger evidence</p><h2>Folios</h2></div></div>
<section class="folio-statement card" id="folio-workspace" aria-labelledby="folio-workspace-title" tabindex="-1">
<div class="folio-workspace-head"><button class="quiet" type="button">Back to folio lookup</button><div>
<p class="eyebrow">Immutable guest ledger</p><h3 id="folio-workspace-title">Folio FOL-DXB-2026-000123 · Priya Ramanathan</h3></div></div>
<div class="folio-summary folio-account-summary" aria-label="Stay folio totals">
<span>Stay total <strong>982500</strong></span><span>Active window <strong>982500</strong></span>
<span>Currency <strong>INR</strong></span><span>Windows <strong>3</strong></span></div>
<div class="folio-window-rail"><div class="folio-workspace-tabs" id="folio-window-tabs" role="tablist" aria-label="Folio windows">
<button class="quiet folio-window-tab" role="tab" aria-selected="true">Primary guest window</button>
<button class="quiet folio-window-tab" role="tab" aria-selected="false">Business incidentals</button>
<button class="quiet folio-window-tab" role="tab" aria-selected="false">Personal extras</button>
<button class="quiet folio-window-tab" role="tab" aria-selected="false">Company direct billing</button>
<button class="quiet folio-window-tab" role="tab" aria-selected="false">Corrections and allowances</button></div>
<button class="quiet" type="button">New folio window</button></div>
<div class="folio-workspace-tabs" id="folio-workspace-tabs" role="tablist" aria-label="Folio workspace">
<button class="quiet" role="tab" aria-selected="true">Statement</button><button class="quiet" role="tab" aria-selected="false">Add charge</button>
<button class="quiet" role="tab" aria-selected="false">Deposits</button><button class="quiet" role="tab" aria-selected="false">Separate charges</button>
<button class="quiet" role="tab" aria-selected="false">Direct billing</button></div>
<div id="folio-statement"><div class="folio-summary"><div><span>Reference</span><strong>FOL-DXB-2026-000123</strong></div>
<div><span>Window</span><strong>Primary guest window</strong></div><div><span>Status</span><strong>Open</strong></div></div>
<div class="folio-statement-cards"><article class="folio-posting-card"><strong>Room charge · Deluxe King</strong>
<dl><dt>Business date</dt><dd>2026-09-01</dd><dt>Amount</dt><dd>982500</dd></dl></article></div></div>
</section></section></div></main><div style="height:1000px" aria-hidden="true"></div><pre id="result"></pre><script>
requestAnimationFrame(()=>requestAnimationFrame(()=>{const workspace=document.querySelector('#folio-workspace');
const rail=document.querySelector('#folio-workspace-tabs');const proof={viewport:innerWidth,deviceScaleFactor:devicePixelRatio,
documentOverflow:Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth),
workspaceOverflow:Math.max(0,workspace.scrollWidth-workspace.clientWidth),railOverflow:Math.max(0,rail.scrollWidth-rail.clientWidth),
railLocallyScrollable:['auto','scroll'].includes(getComputedStyle(rail).overflowX)};
document.querySelector('#result').textContent=JSON.stringify(proof);document.body.dataset.proof='ready';}));
</script></body></html>`;

async function measure(htmlFile: string, profile: string, width: number): Promise<FolioGeometry> {
  if (!browserPath) throw new Error("Chrome or Chromium is required for Order328 geometry proof");
  const url = pathToFileURL(htmlFile).href;
  await mkdir(profile, { recursive: true });
  const chrome = Bun.spawn([browserPath, "--headless=new", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage", "--no-first-run", "--no-default-browser-check",
    "--allow-file-access-from-files", "--remote-debugging-address=127.0.0.1", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"],
  { stdout: "ignore", stderr: "pipe" });
  try {
    const portFile = resolve(profile, "DevToolsActivePort");
    let port = "";
    for (let attempt = 0; attempt < 400; attempt += 1) {
      if (existsSync(portFile)) port = (await Bun.file(portFile).text()).split(/\r?\n/, 1)[0] ?? "";
      if (port) break;
      await Bun.sleep(25);
    }
    if (!port) {
      chrome.kill();
      const diagnostic = (await new Response(chrome.stderr).text()).trim().slice(-500);
      throw new Error(`Chromium did not expose a DevTools port${diagnostic ? `: ${diagnostic}` : ""}`);
    }
    const response = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: "PUT" });
    if (!response.ok) throw new Error(`Chromium target creation failed (${response.status})`);
    const target = await response.json() as { webSocketDebuggerUrl?: string };
    if (!target.webSocketDebuggerUrl) throw new Error("Chromium target has no debugger endpoint");
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    let id = 0;
    const pending = new Map<number, { resolve: (value: unknown) => void; reject: (reason: Error) => void }>();
    const opened = new Promise<void>((resolveOpen, rejectOpen) => {
      socket.addEventListener("open", () => resolveOpen(), { once: true });
      socket.addEventListener("error", () => rejectOpen(new Error("Chromium debugger socket failed")), { once: true });
    });
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as { id?: number; result?: unknown; error?: { message?: string } };
      if (!message.id) return;
      const request = pending.get(message.id);
      if (!request) return;
      pending.delete(message.id);
      if (message.error) request.reject(new Error(message.error.message ?? "Chromium command failed"));
      else request.resolve(message.result);
    });
    await opened;
    const send = <T>(method: string, params: Record<string, unknown> = {}) => new Promise<T>((resolveCommand, rejectCommand) => {
      id += 1;
      pending.set(id, { resolve: (value) => resolveCommand(value as T), reject: rejectCommand });
      socket.send(JSON.stringify({ id, method, params }));
    });
    await send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 2, mobile: false });
    await send("Page.enable");
    await send("Runtime.enable");
    await send("Page.navigate", { url });
    let proof: string | null = null;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const result = await send<{ result?: { value?: string | null } }>("Runtime.evaluate", {
        expression: "document.body?.dataset.proof === 'ready' ? document.querySelector('#result')?.textContent : null", returnByValue: true,
      });
      proof = result.result?.value ?? null;
      if (proof) break;
      await Bun.sleep(25);
    }
    socket.close();
    if (!proof) throw new Error(`Chromium produced no loaded-Folio geometry at ${width}px`);
    return JSON.parse(proof) as FolioGeometry;
  } finally {
    chrome.kill();
    await chrome.exited;
    await Bun.sleep(250);
  }
}

test("Order328 intentional red: loaded Folio is document-contained at 375px and 640px / DSF2", async () => {
  const folder = await mkdtemp(resolve(tmpdir(), "yellow-order328-red-"));
  try {
    const fixture = resolve(folder, "loaded-folio.html");
    await Bun.write(fixture, loadedFolioFixture(pathToFileURL(cssFile).href));
    const proofs: FolioGeometry[] = [];
    for (const width of [375, 640]) proofs.push(await measure(fixture, resolve(folder, `chrome-${width}`), width));
    expect(proofs.map(({ viewport, deviceScaleFactor }) => ({ viewport, deviceScaleFactor }))).toEqual([
      { viewport: 375, deviceScaleFactor: 2 }, { viewport: 640, deviceScaleFactor: 2 },
    ]);
    expect(proofs.map(({ viewport, documentOverflow, workspaceOverflow }) => ({ viewport, documentOverflow, workspaceOverflow }))).toEqual([
      { viewport: 375, documentOverflow: 0, workspaceOverflow: 0 },
      { viewport: 640, documentOverflow: 0, workspaceOverflow: 0 },
    ]);
    expect(proofs.every(({ railOverflow, railLocallyScrollable }) => railOverflow === 0 || railLocallyScrollable)).toBe(true);
  } finally {
    await rm(folder, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
}, 30_000);
