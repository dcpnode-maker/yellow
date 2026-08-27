import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dir, "..");
const cssFile = resolve(root, "src/http/operator/operator.css");
const scriptFile = resolve(root, "src/http/operator/operator.js");

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

type GeometryProof = {
  viewport: number;
  theme: string;
  disclosure: { fixed: boolean; reflowDelta: number; withinViewport: boolean; horizontalOverflow: number };
  win95: { contentFollowsHeading: boolean; contentClearsRail: boolean; contentLeft: number; railRight: number; display: string; columns: string; rootTheme: string };
  erp: { commandRow: boolean; leadMetricRatio: number };
};

const geometryFixture = (stylesheet: string) => `<!doctype html>
<html lang="en" data-theme="apple" data-experience="expert"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="${stylesheet}"></head>
<body><header class="app-bar"><div class="brand"><span class="brand-mark">Y</span><strong>Yellow</strong></div></header>
<main><div class="workbench"><header class="workbench-head"><div><p class="eyebrow">Live property operations</p><h1>Reservations</h1></div></header>
<nav class="domain-bar"><label class="property-context">Current property<select><option>Riverton Test Hotel</option></select></label>
<p class="domain-nav-label">Workspace</p><div class="domain-nav"><button class="workspace-disclosure" id="toggle">More workspaces</button>
<div class="secondary-workspaces" id="menu" hidden><p class="domain-nav-group">Property control</p><button class="domain-tab">Operations</button><button class="domain-tab">Inventory setup</button><button class="domain-tab">Rates</button></div></div></nav>
<section id="content"><div class="section-heading"><div><p class="eyebrow">Front desk</p><h2>Reservation command</h2><p>Live operational truth.</p></div><button class="primary">New reservation</button></div>
<div class="metric-grid"><div class="metric"><strong>142</strong><span>Occupied</span></div><div class="metric"><strong>18</strong><span>Arrivals</span></div><div class="metric"><strong>12</strong><span>Departures</span></div></div></section></div></main><pre id="result"></pre>
<script>
const theme=new URL(location.href).searchParams.get('theme')||'apple';document.documentElement.dataset.theme=theme;
requestAnimationFrame(()=>requestAnimationFrame(()=>{const content=document.querySelector('#content');const menu=document.querySelector('#menu');
const before=content.getBoundingClientRect();menu.hidden=false;const after=content.getBoundingClientRect();const menuRect=menu.getBoundingClientRect();
const heading=document.querySelector('.workbench-head').getBoundingClientRect();const rail=document.querySelector('.domain-bar').getBoundingClientRect();const workbenchStyle=getComputedStyle(document.querySelector('.workbench'));
const metrics=[...document.querySelectorAll('.metric')].map(node=>node.getBoundingClientRect());const command=getComputedStyle(document.querySelector('.section-heading'));
const proof={viewport:innerWidth,theme,disclosure:{fixed:getComputedStyle(menu).position==='fixed',reflowDelta:Math.abs(after.top-before.top),withinViewport:menuRect.left>=0&&menuRect.right<=innerWidth&&menuRect.top>=0&&menuRect.bottom<=innerHeight,horizontalOverflow:Math.max(0,document.documentElement.scrollWidth-innerWidth)},win95:{contentFollowsHeading:after.top<=heading.bottom+16,contentClearsRail:after.left>=rail.right-4,contentLeft:after.left,railRight:rail.right,display:workbenchStyle.display,columns:workbenchStyle.gridTemplateColumns,rootTheme:document.documentElement.dataset.theme},erp:{commandRow:command.display==='grid'&&command.gridTemplateColumns.split(' ').length>=2,leadMetricRatio:metrics.length>1?metrics[0].width/metrics[1].width:0}};
document.querySelector('#result').textContent=JSON.stringify(proof);document.body.dataset.proof='ready';}));
</script></body></html>`;

const measureInBrowser = async (htmlFile: string, profile: string, width: number, theme: string): Promise<GeometryProof> => {
  if (!browserPath) throw new Error("Chrome or Chromium is required for Order195 geometry proof");
  const url = `${pathToFileURL(htmlFile).href}?theme=${theme}`;
  const chrome = Bun.spawn([browserPath, "--headless=new", "--disable-gpu", "--no-sandbox", "--hide-scrollbars", "--allow-file-access-from-files", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { stdout: "ignore", stderr: "ignore" });
  try {
    const activePortFile = resolve(profile, "DevToolsActivePort");
    let port = "";
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (existsSync(activePortFile)) {
        port = (await Bun.file(activePortFile).text()).split(/\r?\n/, 1)[0] ?? "";
        if (port) break;
      }
      await Bun.sleep(25);
    }
    if (!port) throw new Error("Chromium did not expose a DevTools port");
    const targetResponse = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: "PUT" });
    if (!targetResponse.ok) throw new Error(`Chromium target creation failed (${targetResponse.status})`);
    const target = await targetResponse.json() as { webSocketDebuggerUrl?: string };
    if (!target.webSocketDebuggerUrl) throw new Error("Chromium target has no debugger endpoint");
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    let commandId = 0;
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
      commandId += 1;
      pending.set(commandId, { resolve: (value) => resolveCommand(value as T), reject: rejectCommand });
      socket.send(JSON.stringify({ id: commandId, method, params }));
    });
    await send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
    await send("Page.enable");
    await send("Runtime.enable");
    await send("Page.navigate", { url });
    let proof: string | null = null;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const evaluation = await send<{ result?: { value?: string | null } }>("Runtime.evaluate", { expression: "document.body?.dataset.proof === 'ready' ? document.querySelector('#result')?.textContent : null", returnByValue: true });
      proof = evaluation.result?.value ?? null;
      if (proof) break;
      await Bun.sleep(25);
    }
    socket.close();
    if (!proof) throw new Error(`Chromium produced no geometry result at ${width}px`);
    return JSON.parse(proof) as GeometryProof;
  } finally {
    chrome.kill();
    await chrome.exited;
  }
};

test("Order195: disclosure is a viewport overlay at every responsive width", async () => {
  const [css, script] = await Promise.all([Bun.file(cssFile).text(), Bun.file(scriptFile).text()]);
  const responsiveStart = css.indexOf("@media (max-width: 1020px)");
  const responsive = css.slice(responsiveStart, css.indexOf("@media (max-width: 600px)", responsiveStart));
  expect(css).toMatch(/\.secondary-workspaces:not\(\[hidden\]\)\s*\{[^}]*position:\s*fixed/);
  expect(css).toMatch(/\.secondary-workspaces:not\(\[hidden\]\)\s*\{[^}]*top:\s*var\(--workspace-menu-top/);
  expect(responsive).not.toContain("display: contents");
  expect(script).toContain("positionSecondaryWorkspaces");
  expect(script).toContain("document.body.append(secondaryWorkspaces)");
  expect(script).toContain('event.key === "Escape"');
  expect(script).toContain('event.key !== "Tab"');
  expect(script).toContain("event.shiftKey");
  expect(script).toContain("closeSecondaryWorkspaces(true)");
  expect(script.match(/focus\(\{ preventScroll: true \}\)/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
  expect(css).toMatch(/@media \(max-width: 600px\)[\s\S]*\.search-bar \.search-button \{[^}]*grid-row:\s*1/);
});

test("Order195: Win95 uses explicit grid areas so the active window cannot auto-place below the sidebar", async () => {
  const css = await Bun.file(cssFile).text();
  expect(css).toMatch(/data-theme="win95"\] \.workbench \{[^}]*grid-template-areas:\s*"nav chrome" "nav head" "nav content"/);
  expect(css).toMatch(/data-theme="win95"\] \.win-window-chrome \{[^}]*grid-area:\s*chrome/);
  expect(css).toMatch(/data-theme="win95"\] \.workbench-head \{[^}]*grid-area:\s*head/);
  expect(css).toMatch(/data-theme="win95"\] \.workbench > section:not\(\.login-layout\) \{[^}]*grid-area:\s*content/);
});

test("Order195: Enterprise ERP owns a command row and asymmetric bento hierarchy", async () => {
  const css = await Bun.file(cssFile).text();
  expect(css).toMatch(/data-theme="erp"\] \.section-heading \{[^}]*grid-template-columns:\s*minmax\(0,1fr\) auto/);
  expect(css).toMatch(/data-theme="erp"\] :is\(\.status-summary-grid,\.metric-grid\) \{[^}]*grid-template-columns:\s*repeat\(12,minmax\(0,1fr\)\)/);
  expect(css).toMatch(/data-theme="erp"\] :is\(\.status-summary-grid,\.metric-grid\) > :first-child \{[^}]*grid-column:\s*span 6/);
});

test.skipIf(!browserPath)("Order195: Chromium measures disclosure, Win95 and ERP geometry at contract widths", async () => {
  const folder = await mkdtemp(resolve(tmpdir(), "yellow-order195-"));
  try {
    const fixture = resolve(folder, "geometry.html");
    await Bun.write(fixture, geometryFixture(pathToFileURL(cssFile).href));
    for (const width of [375, 768, 1020, 1021, 1440]) {
      const apple = await measureInBrowser(fixture, resolve(folder, `apple-${width}`), width, "apple");
      expect(apple.viewport).toBe(width);
      expect(apple.disclosure.fixed).toBe(true);
      expect(apple.disclosure.reflowDelta).toBeLessThanOrEqual(1);
      expect(apple.disclosure.withinViewport).toBe(true);
      expect(apple.disclosure.horizontalOverflow).toBeLessThanOrEqual(1);
    }
    const win95 = await measureInBrowser(fixture, resolve(folder, "win95-1440"), 1440, "win95");
    expect(win95.win95.contentFollowsHeading).toBe(true);
    if (!win95.win95.contentClearsRail) throw new Error(`Win95 content overlaps rail: ${JSON.stringify(win95.win95)}`);
    const erp = await measureInBrowser(fixture, resolve(folder, "erp-1440"), 1440, "erp");
    expect(erp.erp.commandRow).toBe(true);
    expect(erp.erp.leadMetricRatio).toBeGreaterThan(1.7);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
}, 30_000);
