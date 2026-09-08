import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
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
<html lang="en" data-theme="apple" data-workspace-skin="precision"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="${stylesheet}"></head>
<body><header class="app-bar"><div class="brand"><span class="brand-mark">Y</span><strong>Yellow</strong></div></header>
<main><div class="workbench"><header class="workbench-head"><div><p class="eyebrow">Live property operations</p><h1>Reservations</h1></div></header>
<nav class="domain-bar"><label class="property-context">Current property<select><option>Riverton Test Hotel</option></select></label>
<p class="domain-nav-label">Workspace</p><div class="domain-nav"><button class="workspace-disclosure" id="toggle">More workspaces</button>
<div class="secondary-workspaces" id="menu" hidden><p class="domain-nav-group">Property control</p><button class="domain-tab">Operations</button><button class="domain-tab">Inventory setup</button><button class="domain-tab">Rates</button></div></div></nav>
<section id="content"><div class="section-heading"><div><p class="eyebrow">Front desk</p><h2>Reservation command</h2><p>Live operational truth.</p></div><button class="primary">New reservation</button></div>
<div class="metric-grid"><div class="metric"><strong>142</strong><span>Occupied</span></div><div class="metric"><strong>18</strong><span>Arrivals</span></div><div class="metric"><strong>12</strong><span>Departures</span></div></div></section></div></main><pre id="result"></pre>
<script>
const parameters=new URL(location.href).searchParams;const theme=parameters.get('theme')||'apple';const proofToken=parameters.get('proof')||'';document.documentElement.dataset.theme=theme;
requestAnimationFrame(()=>requestAnimationFrame(()=>{const content=document.querySelector('#content');const menu=document.querySelector('#menu');
const before=content.getBoundingClientRect();menu.hidden=false;const after=content.getBoundingClientRect();const menuRect=menu.getBoundingClientRect();
const heading=document.querySelector('.workbench-head').getBoundingClientRect();const rail=document.querySelector('.domain-bar').getBoundingClientRect();const workbenchStyle=getComputedStyle(document.querySelector('.workbench'));
const metrics=[...document.querySelectorAll('.metric')].map(node=>node.getBoundingClientRect());const command=getComputedStyle(document.querySelector('.section-heading'));
const proof={viewport:innerWidth,theme,disclosure:{fixed:getComputedStyle(menu).position==='fixed',reflowDelta:Math.abs(after.top-before.top),withinViewport:menuRect.left>=0&&menuRect.right<=innerWidth&&menuRect.top>=0&&menuRect.bottom<=innerHeight,horizontalOverflow:Math.max(0,document.documentElement.scrollWidth-innerWidth)},win95:{contentFollowsHeading:after.top<=heading.bottom+16,contentClearsRail:after.left>=rail.right-4,contentLeft:after.left,railRight:rail.right,display:workbenchStyle.display,columns:workbenchStyle.gridTemplateColumns,rootTheme:document.documentElement.dataset.theme},erp:{commandRow:command.display==='grid'&&command.gridTemplateColumns.split(' ').length>=2,leadMetricRatio:metrics.length>1?metrics[0].width/metrics[1].width:0}};
document.querySelector('#result').textContent=JSON.stringify(proof);document.body.dataset.proof=proofToken;}));
</script></body></html>`;

async function readDevToolsPort(file: string, readText = () => Bun.file(file).text()): Promise<string> {
  try {
    return (await readText()).split(/\r?\n/, 1)[0] ?? "";
  } catch (error) {
    // Chromium can create the file before Windows releases its write handle.
    // These two transient states reuse the existing bounded startup loop only.
    const code = error && typeof error === "object" ? Reflect.get(error, "code") : undefined;
    if (code === "EBUSY" || code === "ENOENT") return "";
    throw error;
  }
}

test("Order195: port-file startup retries only transient creation/locking errors", async () => {
  for (const code of ["EBUSY", "ENOENT"]) {
    const transient = Object.assign(new Error("transient port file"), { code });
    expect(await readDevToolsPort("unused", async () => { throw transient; })).toBe("");
    expect(await readDevToolsPort("unused", async () => "51234\n/browser")).toBe("51234");
  }
  const permanent = Object.assign(new Error("permission denied"), { code: "EACCES" });
  await expect(readDevToolsPort("unused", async () => { throw permanent; })).rejects.toBe(permanent);
});

const withBrowserSession = async <T>(
  htmlFile: string,
  profile: string,
  use: (measure: (width: number, theme: string) => Promise<GeometryProof>) => Promise<T>,
): Promise<T> => {
  if (!browserPath) throw new Error("Chrome or Chromium is required for Order195 geometry proof");
  await mkdir(profile, { recursive: true });
  const chrome = Bun.spawn([browserPath, "--headless=new", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage", "--no-first-run", "--no-default-browser-check", "--hide-scrollbars", "--allow-file-access-from-files", "--remote-debugging-address=127.0.0.1", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { stdout: "ignore", stderr: "pipe", windowsHide: true });
  let diagnostic = "";
  let sessionExpired = false;
  let socket: WebSocket | null = null;
  const pending = new Map<number, { resolve: (value: unknown) => void; reject: (reason: Error) => void }>();
  const sessionTimer = setTimeout(() => {
    sessionExpired = true;
    socket?.close();
    chrome.kill();
  }, 22_000);
  const stderrDone = (async () => {
    const reader = chrome.stderr.getReader(); const decoder = new TextDecoder();
    try {
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        diagnostic = (diagnostic + decoder.decode(value, { stream: true })).slice(-4000);
      }
      diagnostic = (diagnostic + decoder.decode()).slice(-4000);
    } finally { reader.releaseLock(); }
  })();
  try {
    const activePortFile = resolve(profile, "DevToolsActivePort");
    let port = "";
    for (let attempt = 0; attempt < 400; attempt += 1) {
      if (existsSync(activePortFile)) port = await readDevToolsPort(activePortFile);
      port ||= diagnostic.match(/DevTools listening on ws:\/\/(?:127\.0\.0\.1|localhost|\[::1\]):(\d+)\//)?.[1] ?? "";
      if (port || chrome.exitCode !== null) break;
      await Bun.sleep(25);
    }
    if (!port) {
      throw new Error(`Chromium did not expose a DevTools port (exit ${chrome.exitCode ?? "unknown"})${diagnostic ? `: ${diagnostic.trim().slice(-500)}` : ""}`);
    }
    const targetResponse = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent("about:blank")}`, {
      method: "PUT",
      signal: AbortSignal.timeout(3_000),
    });
    if (!targetResponse.ok) throw new Error(`Chromium target creation failed (${targetResponse.status})`);
    const target = await targetResponse.json() as { webSocketDebuggerUrl?: string };
    if (!target.webSocketDebuggerUrl) throw new Error("Chromium target has no debugger endpoint");
    socket = new WebSocket(target.webSocketDebuggerUrl);
    let commandId = 0;
    const opened = new Promise<void>((resolveOpen, rejectOpen) => {
      const timer = setTimeout(() => {
        rejectOpen(new Error("Chromium debugger socket open exceeded 3000ms"));
        socket?.close();
      }, 3_000);
      socket!.addEventListener("open", () => { clearTimeout(timer); resolveOpen(); }, { once: true });
      socket!.addEventListener("error", () => { clearTimeout(timer); rejectOpen(new Error("Chromium debugger socket failed")); }, { once: true });
      socket!.addEventListener("close", () => { clearTimeout(timer); rejectOpen(new Error("Chromium debugger socket closed before opening")); }, { once: true });
    });
    socket.addEventListener("message", (event) => {
      try {
        const decoded: unknown = JSON.parse(String(event.data));
        if (decoded === null || typeof decoded !== "object" || Array.isArray(decoded)) throw new Error("Debugger message is not an object");
        const id = Reflect.get(decoded, "id");
        if (id === undefined) return;
        if (typeof id !== "number" || !Number.isSafeInteger(id) || id < 1) throw new Error("Debugger message id is invalid");
        const request = pending.get(id);
        if (!request) return;
        const error = Reflect.get(decoded, "error");
        if (error !== undefined) {
          if (error === null || typeof error !== "object" || Array.isArray(error)) throw new Error("Debugger error is malformed");
          const message = Reflect.get(error, "message");
          if (message !== undefined && typeof message !== "string") throw new Error("Debugger error message is malformed");
          pending.delete(id);
          request.reject(new Error(message ?? "Chromium command failed"));
        } else {
          pending.delete(id);
          request.resolve(Reflect.get(decoded, "result"));
        }
      } catch (error) {
        const reason = error instanceof Error ? error : new Error("Chromium returned malformed debugger JSON");
        for (const request of pending.values()) request.reject(reason);
        pending.clear();
        socket?.close();
      }
    });
    socket.addEventListener("close", () => {
      const reason = new Error(sessionExpired ? "Chromium geometry session exceeded 22000ms" : "Chromium debugger socket closed");
      for (const request of pending.values()) request.reject(reason);
      pending.clear();
    });
    await opened;
    const send = <R>(method: string, params: Record<string, unknown> = {}) => new Promise<R>((resolveCommand, rejectCommand) => {
      const activeSocket = socket;
      if (activeSocket?.readyState !== WebSocket.OPEN) {
        rejectCommand(new Error("Chromium debugger socket is not open"));
        return;
      }
      const id = ++commandId;
      const timer = setTimeout(() => {
        pending.delete(id);
        rejectCommand(new Error(`Chromium ${method} exceeded 3000ms`));
      }, 3_000);
      pending.set(id, {
        resolve: (value) => { clearTimeout(timer); resolveCommand(value as R); },
        reject: (reason) => { clearTimeout(timer); rejectCommand(reason); },
      });
      try {
        activeSocket.send(JSON.stringify({ id, method, params }));
      } catch (error) {
        clearTimeout(timer);
        pending.delete(id);
        rejectCommand(error instanceof Error ? error : new Error("Chromium debugger send failed"));
      }
    });
    await send("Page.enable");
    await send("Runtime.enable");
    let navigationId = 0;
    const measure = async (width: number, theme: string): Promise<GeometryProof> => {
      navigationId += 1;
      const proofToken = `order195-${navigationId}-${theme}-${width}`;
      await send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
      const navigation = await send<{ frameId?: string; loaderId?: string; errorText?: string }>("Page.navigate", {
        url: `${pathToFileURL(htmlFile).href}?${new URLSearchParams({ theme, proof: proofToken })}`,
      });
      if (!navigation.frameId || !navigation.loaderId || navigation.errorText) {
        throw new Error(`Chromium rejected geometry navigation: ${navigation.errorText ?? "missing frame/loader identity"}`);
      }
      const proofDeadline = performance.now() + 4_000;
      while (performance.now() < proofDeadline) {
        const evaluation = await send<{ result?: { value?: string | null } }>("Runtime.evaluate", {
          expression: `document.body?.dataset.proof === ${JSON.stringify(proofToken)} ? document.querySelector('#result')?.textContent : null`,
          returnByValue: true,
        });
        const proof = evaluation.result?.value ?? null;
        if (proof) return JSON.parse(proof) as GeometryProof;
        await Bun.sleep(25);
      }
      throw new Error(`Chromium produced no geometry result at ${width}px`);
    };
    const result = await use(measure);
    if (sessionExpired) throw new Error("Chromium geometry session exceeded 22000ms");
    return result;
  } finally {
    clearTimeout(sessionTimer);
    const closing = new Error("Chromium geometry session is closing");
    for (const request of pending.values()) request.reject(closing);
    pending.clear();
    socket?.close();
    if (chrome.exitCode === null) chrome.kill();
    const exited = await Promise.race([chrome.exited.then(() => true), Bun.sleep(2_000).then(() => false)]);
    if (!exited) {
      chrome.kill(9);
      const killed = await Promise.race([chrome.exited.then(() => true), Bun.sleep(2_000).then(() => false)]);
      if (!killed) throw new Error("Owned Chromium root was not reaped");
    }
    await Promise.race([
      stderrDone,
      Bun.sleep(2_000).then(() => { throw new Error("Owned Chromium stderr did not drain"); }),
    ]);
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

test("Order195: Chromium measures disclosure, Win95 and ERP geometry at contract widths", async () => {
  const folder = await mkdtemp(resolve(tmpdir(), "yellow-order195-"));
  try {
    const fixture = resolve(folder, "geometry.html");
    await Bun.write(fixture, geometryFixture(pathToFileURL(cssFile).href));
    await withBrowserSession(fixture, resolve(folder, "profile"), async (measure) => {
      for (const width of [375, 768, 1020, 1021, 1440]) {
        const apple = await measure(width, "apple");
        expect(apple.viewport).toBe(width);
        expect(apple.disclosure.fixed).toBe(true);
        expect(apple.disclosure.reflowDelta).toBeLessThanOrEqual(1);
        expect(apple.disclosure.withinViewport).toBe(true);
        expect(apple.disclosure.horizontalOverflow).toBeLessThanOrEqual(1);
      }
      const win95 = await measure(1440, "win95");
      expect(win95.win95.contentFollowsHeading).toBe(true);
      if (!win95.win95.contentClearsRail) throw new Error(`Win95 content overlaps rail: ${JSON.stringify(win95.win95)}`);
      const erp = await measure(1440, "erp");
      expect(erp.erp.commandRow).toBe(true);
      expect(erp.erp.leadMetricRatio).toBeGreaterThan(1.7);
    });
  } finally {
    await rm(folder, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}, 30_000);
