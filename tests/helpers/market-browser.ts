/** Owned, bounded Chromium harness shared by Order472 integration proofs. */
import { existsSync } from "node:fs";
import { lstat, mkdtemp, realpath, rm } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";

export const browser = [
  process.env.PROGRAMFILES && resolve(process.env.PROGRAMFILES, "Google/Chrome/Application/chrome.exe"),
  process.env.LOCALAPPDATA && resolve(process.env.LOCALAPPDATA, "Google/Chrome/Application/chrome.exe"),
  process.env.PROGRAMFILES && resolve(process.env.PROGRAMFILES, "Microsoft/Edge/Application/msedge.exe"),
  Bun.which("google-chrome"), Bun.which("chromium"), Bun.which("chromium-browser"),
].find((candidate): candidate is string => Boolean(candidate && existsSync(candidate)));
export type Send = <T>(method: string, params?: Record<string, unknown>) => Promise<T>;

export type CdpEvent = { method: string; params?: unknown };
export type OnCdpEvent = (handler: (message: CdpEvent) => void) => () => void;

export async function withBrowser(run: (send: Send, errors: string[], onEvent: OnCdpEvent) => Promise<void>): Promise<void> {
  if (!browser) throw new Error("Chromium is required for Q266 browser proof");
  const temp = await realpath(tmpdir());
  const profile = await mkdtemp(resolve(temp, "yellow-order472-market-browser-"));
  const child = Bun.spawn([browser, "--headless=new", "--disable-gpu", "--disable-dev-shm-usage",
    ...(process.platform === "linux" && process.getuid?.() === 0 ? ["--no-sandbox"] : []),
    "--no-first-run", "--no-default-browser-check", "--remote-debugging-address=127.0.0.1",
    "--remote-debugging-port=0", "--user-data-dir=" + profile, "about:blank"], { stdout: "ignore", stderr: "ignore" });
  let socket: WebSocket | undefined;
  const eventHandlers = new Set<(message: CdpEvent) => void>();
  const pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void; timer: Timer }>();
  try {
    const portFile = resolve(profile, "DevToolsActivePort");
    let port = "";
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline && child.exitCode === null) {
      try { if (existsSync(portFile)) port = (await Bun.file(portFile).text()).split(/\r?\n/, 1)[0] ?? ""; } catch { /* incomplete startup file */ }
      if (/^\d+$/.test(port)) break;
      await Bun.sleep(25);
    }
    if (!/^\d+$/.test(port)) throw new Error("Owned Chromium startup failed");
    const response = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT", signal: AbortSignal.timeout(5_000) });
    if (!response.ok) throw new Error("Owned Chromium target failed");
    const target = await response.json() as { webSocketDebuggerUrl?: string };
    if (!target.webSocketDebuggerUrl) throw new Error("Missing owned browser target");
    socket = new WebSocket(target.webSocketDebuggerUrl);
    const ws = socket;
    await new Promise<void>((accept, reject) => {
      const timer = setTimeout(() => reject(new Error("CDP opening deadline")), 5_000);
      ws.addEventListener("open", () => { clearTimeout(timer); accept(); }, { once: true });
      ws.addEventListener("error", () => { clearTimeout(timer); reject(new Error("CDP opening failed")); }, { once: true });
    });
    const errors: string[] = [];
    ws.addEventListener("message", event => {
      const message = JSON.parse(String(event.data)) as { id?: number; result?: unknown; error?: { message?: string }; method?: string; params?: unknown };
      if (message.method === "Runtime.exceptionThrown") errors.push(JSON.stringify(message.params));
      if (message.method) for (const handler of eventHandlers) {
        try { handler({ method: message.method, params: message.params }); }
        catch (error) { errors.push("Browser event handler failed: " + String(error)); }
      }
      if (!message.id) return;
      const command = pending.get(message.id);
      if (!command) return;
      pending.delete(message.id); clearTimeout(command.timer);
      if (message.error) command.reject(new Error(message.error.message ?? "CDP command failed")); else command.resolve(message.result);
    });
    let sequence = 0;
    const send: Send = <T>(method: string, params: Record<string, unknown> = {}) => new Promise<T>((accept, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error("CDP deadline: " + method)); }, 5_000);
      pending.set(id, { resolve: value => accept(value as T), reject, timer });
      ws.send(JSON.stringify({ id, method, params }));
    });
    await send("Runtime.enable"); await send("Page.enable");
    const onEvent: OnCdpEvent = handler => {
      eventHandlers.add(handler); return () => { eventHandlers.delete(handler); };
    };
    try { await run(send, errors, onEvent); }
    catch (error) { if (errors.length) throw new Error("Owned synthetic browser exceptions: " + JSON.stringify(errors), { cause: error }); throw error; }
  } finally {
    for (const command of pending.values()) { clearTimeout(command.timer); command.reject(new Error("Owned browser closed")); }
    eventHandlers.clear(); pending.clear(); socket?.close();
    if (child.exitCode === null) child.kill();
    await child.exited;
    const actual = await realpath(profile);
    if (actual !== profile || dirname(actual) !== temp || !basename(actual).startsWith("yellow-order472-market-browser-") || (await lstat(profile)).isSymbolicLink()) throw new Error("Unsafe test profile cleanup target");
    await rm(actual, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

export function browserControls(send: Send) {
  const value = async <T = boolean | number | string | null | undefined>(expression: string): Promise<T> => {
    const result = await send<{ result: { value: T }; exceptionDetails?: unknown }>("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const until = async (expression: string, label: string) => {
    const deadline = Date.now() + 4_000;
    while (Date.now() < deadline) { if (await value<boolean>(expression)) return; await Bun.sleep(20); }
    throw new Error(`Browser condition failed: ${label}; ${await value<string>('document.querySelector("[data-testid=market-status]")?.textContent || document.querySelector("#login-message")?.textContent || document.querySelector("#market-mount")?.textContent || "No status"')}`);
  };
  const click = (selector: string) => value(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const fill = (selector: string, content: string) => value(`{const field=document.querySelector(${JSON.stringify(selector)});field.value=${JSON.stringify(content)};field.dispatchEvent(new Event("input",{bubbles:true}));field.dispatchEvent(new Event("change",{bubbles:true}));}`);
  return { value, until, click, fill };
}
