import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
  languagePreferenceFromText,
  speechOutputIntent,
} from "../frontend/yellow/src/voice";

const app = readFileSync(new URL("../frontend/yellow/src/App.tsx", import.meta.url), "utf8");

describe("Order 594 explicit one-shot speech output consent", () => {
  test("admits only an exact latest-response or one-answer instruction", () => {
    expect(speechOutputIntent("read that aloud")).toEqual({ kind: "latest" });
    expect(speechOutputIntent("Speak the last answer out loud")).toEqual({ kind: "latest" });
    expect(speechOutputIntent("speak the answer")).toEqual({ kind: "latest" });
    expect(speechOutputIntent("answer aloud: show today's departures")).toEqual({
      kind: "answer",
      query: "show today's departures",
    });
    expect(speechOutputIntent("show today's departures, reply out loud")).toEqual({
      kind: "answer",
      query: "show today's departures",
    });
    expect(speechOutputIntent("stop speaking")).toEqual({ kind: "stop" });
  });

  test("microphone, wake, language and operational confirmation text grant no speech", () => {
    for (const value of [
      "Yellow",
      "Overwatch",
      "yes",
      "confirm",
      "go ahead",
      "please speak Marathi",
      "switch to Hindi",
      "please speak Kannada",
      "switch to Telugu",
      "continue in English India",
      "request luggage pickup in 15 minutes",
    ]) expect(speechOutputIntent(value)).toBeNull();
    expect(languagePreferenceFromText("please speak Marathi")).toBe("Marathi");
  });

  test("source consumes a one-turn permit and offers a deliberate per-response control", () => {
    expect(app).toContain("const speechOutputPermit = useRef<number | null>(null);");
    expect(app).toContain("speechOutputPermit.current = null;");
    expect(app).toContain('const speechIntent = speechOutputIntent(displayedMessage);');
    expect(app).toContain('if (speechIntent?.kind === "answer") speechOutputPermit.current = operationGeneration;');
    expect(app).toContain('aria-label="Speak this Yellow response"');
    expect(app).toContain("onClick={() => say(turn.text, true)}");
    expect(app).toContain("Speech is optional local presentation.");
    expect(app).toContain("A broken optional browser voice must never interrupt text or PMS work.");
    expect(app).toContain("cancelSpeech();");
    expect(app).not.toMatch(/speechEnabled|setSpeechEnabled/);
  });
});

const browserPath = [
  process.env.PROGRAMFILES && resolve(process.env.PROGRAMFILES, "Google/Chrome/Application/chrome.exe"),
  process.env["PROGRAMFILES(X86)"] && resolve(process.env["PROGRAMFILES(X86)"], "Microsoft/Edge/Application/msedge.exe"),
  process.env.LOCALAPPDATA && resolve(process.env.LOCALAPPDATA, "Google/Chrome/Application/chrome.exe"),
].find((candidate): candidate is string => Boolean(candidate && existsSync(candidate)));

type CdpResult<T> = { result?: { value?: T } };

test("mounted Yellow stays silent until one explicit response and keeps Speak operable at 240/375/1440", async () => {
  if (!browserPath) throw new Error("Chrome or Edge is required for Order 594 browser proof");
  const root = resolve(import.meta.dir, "..");
  const buildRoot = await mkdtemp(resolve(tmpdir(), "yellow-order594-build-"));
  const build = Bun.spawn(["bun", "x", "vite", "build", "--config", "frontend/yellow/vite.config.ts", "--outDir", buildRoot, "--emptyOutDir"], {
    cwd: root,
    stdout: "pipe",
    stderr: "pipe",
    windowsHide: true,
  });
  const [buildExit, buildOut, buildError] = await Promise.all([
    build.exited,
    new Response(build.stdout).text(),
    new Response(build.stderr).text(),
  ]);
  if (buildExit !== 0) await rm(buildRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  expect(buildExit, `${buildOut}\n${buildError}`).toBe(0);

  const publicRoot = buildRoot;
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const pathname = new URL(request.url).pathname;
      const relative = pathname.startsWith("/yellow-next/assets/")
        ? pathname.slice("/yellow-next/".length)
        : "index.html";
      const file = Bun.file(resolve(publicRoot, relative));
      if (!(await file.exists())) return new Response("Not found", { status: 404 });
      const contentType = relative.endsWith(".js")
        ? "application/javascript"
        : relative.endsWith(".css")
          ? "text/css"
          : "text/html";
      return new Response(file, { headers: { "content-type": contentType } });
    },
  });
  const profile = await mkdtemp(resolve(tmpdir(), "yellow-order594-"));
  const chrome = Bun.spawn([
    browserPath,
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--no-first-run",
    "--no-default-browser-check",
    "--remote-debugging-address=127.0.0.1",
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    "about:blank",
  ], { stdout: "ignore", stderr: "pipe", windowsHide: true });
  let diagnostic = "";
  const stderrDone = (async () => {
    const reader = chrome.stderr.getReader();
    const decoder = new TextDecoder();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        diagnostic = (diagnostic + decoder.decode(value, { stream: true })).slice(-4_000);
      }
    } finally {
      reader.releaseLock();
    }
  })();
  let socket: WebSocket | undefined;
  try {
    const portFile = resolve(profile, "DevToolsActivePort");
    let port = "";
    for (let attempt = 0; attempt < 400; attempt += 1) {
      if (existsSync(portFile)) port = (await readFile(portFile, "utf8")).split(/\r?\n/u)[0]?.trim() ?? "";
      port ||= diagnostic.match(/DevTools listening on ws:\/\/(?:127\.0\.0\.1|localhost|\[::1\]):(\d+)\//u)?.[1] ?? "";
      if (port || chrome.exitCode !== null) break;
      await Bun.sleep(25);
    }
    if (!port) throw new Error(`Browser did not expose DevTools: ${diagnostic.slice(-800)}`);
    const appUrl = `http://127.0.0.1:${server.port}/yellow-next/p/6081b544-22a1-534f-a86d-bb1ae0519e14/today`;
    const targetResponse = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent("about:blank")}`, { method: "PUT" });
    const target = await targetResponse.json() as { webSocketDebuggerUrl?: string };
    if (!target.webSocketDebuggerUrl) throw new Error("Browser target has no debugger endpoint");
    socket = new WebSocket(target.webSocketDebuggerUrl);
    let nextId = 0;
    const pending = new Map<number, { resolve: (value: unknown) => void; reject: (reason: Error) => void }>();
    const opened = new Promise<void>((resolveOpen, rejectOpen) => {
      socket!.addEventListener("open", () => resolveOpen(), { once: true });
      socket!.addEventListener("error", () => rejectOpen(new Error("Browser debugger socket failed")), { once: true });
    });
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as { id?: number; result?: unknown; error?: { message?: string } };
      if (!message.id) return;
      const request = pending.get(message.id);
      if (!request) return;
      pending.delete(message.id);
      if (message.error) request.reject(new Error(message.error.message ?? "Browser command failed"));
      else request.resolve(message.result);
    });
    await opened;
    const send = <T>(method: string, params: Record<string, unknown> = {}) => new Promise<T>((resolveCommand, rejectCommand) => {
      nextId += 1;
      pending.set(nextId, { resolve: (value) => resolveCommand(value as T), reject: rejectCommand });
      socket!.send(JSON.stringify({ id: nextId, method, params }));
    });
    const evaluate = async <T>(expression: string): Promise<T | undefined> => {
      const result = await send<CdpResult<T>>("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
      return result.result?.value;
    };
    const waitFor = async (expression: string, label: string, timeoutMs = 8_000) => {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        if (await evaluate<boolean>(expression)) return;
        await Bun.sleep(50);
      }
      throw new Error(`Timed out waiting for ${label}`);
    };
    await send("Page.enable");
    await send("Runtime.enable");
    await send("Page.addScriptToEvaluateOnNewDocument", { source: `
      window.__yellowSpeechCalls = [];
      window.__yellowRuntimeErrors = [];
      addEventListener('error', event => window.__yellowRuntimeErrors.push(String(event.error?.message || event.message)));
      addEventListener('unhandledrejection', event => window.__yellowRuntimeErrors.push(String(event.reason)));
      class YellowUtterance { constructor(text) { this.text = text; this.lang = ''; this.rate = 1; this.voice = null; } }
      Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: YellowUtterance });
      Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
        cancel() {}, getVoices() { return []; },
        speak(utterance) { window.__yellowSpeechCalls.push({ text: utterance.text, lang: utterance.lang }); }
      }});
      Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {
        async getUserMedia() { return { getTracks() { return [{ stop() {} }]; } }; }
      }});
      class YellowRecognition {
        start() {
          setTimeout(() => {
            const result = { 0: { transcript: window.__yellowMicrophoneText || 'Show arrivals' }, length: 1, isFinal: true };
            this.onresult?.({ resultIndex: 0, results: [result] });
          }, 20);
        }
        stop() {}
      }
      Object.defineProperty(window, 'SpeechRecognition', { configurable: true, value: YellowRecognition });
      window.fetch = async input => {
        const pathname = new URL(typeof input === 'string' ? input : input.url, location.href).pathname;
        let status = 200;
        let body;
        if (pathname.endsWith('/auth/demo:enter')) body = { accessToken: 'order594-browser-proof' };
        else if (pathname.endsWith('/me/properties')) body = { properties: [{ id: '6081b544-22a1-534f-a86d-bb1ae0519e14', name: 'Proof Hotel', timezone: 'Asia/Kolkata' }] };
        else if (pathname.endsWith('/reservation-board')) body = { reservations: [], nextCursor: null };
        else if (pathname.endsWith('/jarvis:ask')) body = { answer: 'This is the completed guided test answer.' };
        else { status = 503; body = { error: 'not required by Order 594 proof' }; }
        return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
      };
    ` });
    await send("Emulation.setDeviceMetricsOverride", { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
    await send("Page.navigate", { url: appUrl });
    await waitFor("Boolean(document.querySelector('.yellow-launch'))", "Yellow launcher");
    await evaluate("document.querySelector('.yellow-launch').click()");
    await waitFor("Boolean(document.querySelector('[aria-label=\"Ask Yellow\"]'))", "Yellow prompt");
    expect(await evaluate<number>("window.__yellowSpeechCalls.length")).toBe(0);

    const submit = async (message: string, waitMs = 350) => {
      await evaluate(`(() => {
        const input = document.querySelector('[aria-label="Ask Yellow"]');
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        setter.call(input, ${JSON.stringify(message)});
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => {
          document.querySelector('[aria-label="Send request to Yellow"]').click(); resolve(true);
        })));
      })()`);
      await Bun.sleep(waitMs);
    };

    await submit("Yellow");
    await submit("please speak Marathi");
    await submit("confirm");
    await submit("Show arrivals");
    expect(await evaluate<number>("window.__yellowSpeechCalls.length")).toBe(0);

    await evaluate("window.__yellowMicrophoneText='Show arrivals'; document.querySelector('[aria-label=\"Speak to Yellow\"]').click()");
    await Bun.sleep(2_500);
    expect(await evaluate<number>("window.__yellowSpeechCalls.length")).toBe(0);

    await submit("answer aloud: what time is checkout", 700);
    await waitFor("window.__yellowSpeechCalls.length === 1", "one explicit spoken answer");
    await submit("Yellow");
    expect(await evaluate<number>("window.__yellowSpeechCalls.length")).toBe(1);

    const geometry: Array<{ width: number; buttonWidth: number; buttonHeight: number; left: number; right: number; surfaceOverflow: number }> = [];
    for (const width of [240, 375, 1440]) {
      await send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 600 });
      await Bun.sleep(100);
      const measured = await evaluate<Omit<(typeof geometry)[number], "width">>(`(() => {
        const buttons = [...document.querySelectorAll('[aria-label="Speak this Yellow response"]')];
        const button = buttons.at(-1); const rect = button.getBoundingClientRect();
        const surface = document.querySelector('.yellow-command-surface');
        return { buttonWidth: rect.width, buttonHeight: rect.height, left: rect.left, right: rect.right,
          surfaceOverflow: Math.max(0, surface.scrollWidth - surface.clientWidth) };
      })()`);
      if (!measured) throw new Error(`No Speak geometry returned at ${width}px`);
      geometry.push({ width, ...measured });
    }
    expect(geometry.every(({ width, buttonWidth, buttonHeight, left, right, surfaceOverflow }) =>
      buttonWidth >= 44 && buttonHeight >= 44 && left >= 0 && right <= width && surfaceOverflow === 0,
    )).toBe(true);

    await evaluate(`(() => { const buttons=[...document.querySelectorAll('[aria-label="Speak this Yellow response"]')]; buttons.at(-1).focus(); })()`);
    expect(await evaluate<string>("document.activeElement?.getAttribute('aria-label')")).toBe("Speak this Yellow response");
    await send("Input.dispatchKeyEvent", {
      type: "keyDown", key: "Enter", code: "Enter", text: "\r", unmodifiedText: "\r",
      windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13,
    });
    await send("Input.dispatchKeyEvent", {
      type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13,
    });
    await waitFor("window.__yellowSpeechCalls.length === 2", "keyboard-triggered Speak");

    const visibleText = await evaluate<string>("[...document.querySelectorAll('.yellow-turn.assistant p')].at(-1)?.textContent || ''");
    await evaluate("window.speechSynthesis.speak=()=>{throw new Error('voice unavailable')}; [...document.querySelectorAll('[aria-label=\"Speak this Yellow response\"]')].at(-1).click()");
    expect(await evaluate<string>("[...document.querySelectorAll('.yellow-turn.assistant p')].at(-1)?.textContent || ''")).toBe(visibleText);
    await evaluate("window.speechSynthesis.cancel=()=>{throw new Error('cancel unavailable')}");
    await submit("stop speaking");
    expect(await evaluate<string>("[...document.querySelectorAll('.yellow-turn.assistant p')].at(-1)?.textContent || ''")).toBe("Speech stopped. Yellow remains available in text.");
    expect(await evaluate<readonly string[]>("window.__yellowRuntimeErrors")).toEqual([]);
  } finally {
    socket?.close();
    chrome.kill();
    await chrome.exited;
    await stderrDone;
    server.stop(true);
    await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    await rm(buildRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
}, 60_000);
