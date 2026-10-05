type JsonValue = null | boolean | number | string | JsonValue[] | { readonly [key: string]: JsonValue };

interface ChromeTarget {
  readonly webSocketDebuggerUrl?: string;
}

interface CdpResponse {
  readonly id?: number;
  readonly result?: unknown;
  readonly error?: unknown;
}

interface BrowserProof {
  readonly viewport: string;
  readonly title: string;
  readonly statusText: string;
  readonly hasJourney: boolean;
  readonly hasCashier: boolean;
  readonly hasOverwatch: boolean;
  readonly clientWidth: number;
  readonly scrollWidth: number;
  readonly horizontalOverflow: boolean;
}

const CHROME_CANDIDATES = [
  String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`,
  String.raw`C:\Program Files (x86)\Google\Chrome\Application\chrome.exe`,
  String.raw`C:\Program Files\Microsoft\Edge\Application\msedge.exe`,
  String.raw`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`,
] as const;

const viewports = [
  { name: "mobile-375x812", width: 375, height: 812 },
  { name: "desktop-1440x900", width: 1440, height: 900 },
] as const;

const serverPort = 43187;
const chromePort = 43188;
const baseUrl = `http://127.0.0.1:${serverPort}`;

async function main(): Promise<void> {
  const chromePath = await firstExistingPath(CHROME_CANDIDATES);
  if (chromePath === null) {
    throw new Error("Chrome or Edge executable not found; cannot run browser smoke proof.");
  }

  const server = Bun.spawn(["bun", "src/server.ts"], {
    env: { ...Bun.env, PORT: String(serverPort) },
    stdout: "pipe",
    stderr: "pipe",
  });

  try {
    await waitForHttp(`${baseUrl}/health`, 10_000);
    const proofs: BrowserProof[] = [];
    for (const viewport of viewports) {
      proofs.push(await runChromeProof(chromePath, viewport.name, viewport.width, viewport.height));
    }
    for (const proof of proofs) {
      if (proof.statusText !== "not_ready") throw new Error(`${proof.viewport}: expected not_ready status text`);
      if (!proof.hasJourney) throw new Error(`${proof.viewport}: missing operating journey content`);
      if (!proof.hasCashier) throw new Error(`${proof.viewport}: missing cashier content`);
      if (!proof.hasOverwatch) throw new Error(`${proof.viewport}: missing Overwatch content`);
      if (proof.horizontalOverflow) {
        throw new Error(`${proof.viewport}: horizontal overflow ${proof.scrollWidth} > ${proof.clientWidth}`);
      }
    }
    console.log(JSON.stringify({ ok: true, proofs }, null, 2));
  } finally {
    server.kill();
    await server.exited.catch(() => undefined);
  }
}

async function runChromeProof(chrome: string, viewport: string, width: number, height: number): Promise<BrowserProof> {
  const profile = await Bun.$`powershell -NoProfile -Command "[System.IO.Path]::GetTempPath()"`.text();
  const userDataDir = `${profile.trim()}yellow-chrome-${process.pid}-${viewport}`;
  const chromeProcess = Bun.spawn([
    chrome,
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    `--user-data-dir=${userDataDir}`,
    `--remote-debugging-port=${chromePort}`,
    `--window-size=${width},${height}`,
    "about:blank",
  ], { stdout: "pipe", stderr: "pipe" });
  try {
    await waitForHttp(`http://127.0.0.1:${chromePort}/json/version`, 10_000);
    const targetResponse = await fetch(`http://127.0.0.1:${chromePort}/json/new?${encodeURIComponent(baseUrl)}`, {
      method: "PUT",
    });
    const targetText = await targetResponse.text();
    if (!targetResponse.ok) throw new Error(`${viewport}: Chrome target creation failed ${targetResponse.status}: ${targetText}`);
    const target = JSON.parse(targetText) as ChromeTarget;
    if (target.webSocketDebuggerUrl === undefined) throw new Error(`${viewport}: missing CDP websocket URL`);
    using socket = new CdpSocket(target.webSocketDebuggerUrl);
    await socket.open();
    await socket.send("Page.enable");
    await socket.send("Runtime.enable");
    await socket.send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: viewport.startsWith("mobile") ? 3 : 1,
      mobile: viewport.startsWith("mobile"),
    });
    await socket.send("Page.navigate", { url: baseUrl });
    await wait(700);
    const evaluation = await socket.send("Runtime.evaluate", {
      expression: `(() => {
        const text = document.body.innerText;
        return {
          title: document.title,
          statusText: text.includes('Demo status: not_ready') ? 'not_ready' : 'unknown',
          hasJourney: text.includes('Operating journey'),
          hasCashier: text.includes('Cashier and folio'),
          hasOverwatch: text.includes('Yellow Overwatch'),
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
          horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
        };
      })()`,
      returnByValue: true,
    }) as { readonly result?: { readonly result?: { readonly value?: BrowserProof } } };
    const proof = evaluation.result?.result?.value;
    if (proof === undefined) throw new Error(`${viewport}: failed to evaluate page proof`);
    return { ...proof, viewport };
  } finally {
    chromeProcess.kill();
    await chromeProcess.exited.catch(() => undefined);
    await Bun.$`powershell -NoProfile -Command "Remove-Item -LiteralPath '${userDataDir}' -Recurse -Force -ErrorAction SilentlyContinue"`.quiet();
  }
}

class CdpSocket implements Disposable {
  readonly #url: string;
  #socket: WebSocket | null = null;
  #nextId = 1;
  #pending = new Map<number, { resolve: (value: CdpResponse) => void; reject: (reason: unknown) => void }>();

  constructor(url: string) {
    this.#url = url;
  }

  async open(): Promise<void> {
    const socket = new WebSocket(this.#url);
    this.#socket = socket;
    socket.addEventListener("message", (event) => {
      const data = JSON.parse(String(event.data)) as CdpResponse;
      if (data.id !== undefined) {
        const pending = this.#pending.get(data.id);
        if (pending !== undefined) {
          this.#pending.delete(data.id);
          pending.resolve(data);
        }
      }
    });
    await new Promise<void>((resolve, reject) => {
      socket.addEventListener("open", () => resolve(), { once: true });
      socket.addEventListener("error", () => reject(new Error("CDP websocket failed to open")), { once: true });
    });
  }

  async send(method: string, params: JsonValue = {}): Promise<CdpResponse> {
    const socket = this.#socket;
    if (socket === null) throw new Error("CDP socket is not open");
    const id = this.#nextId++;
    const response = new Promise<CdpResponse>((resolve, reject) => {
      this.#pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (this.#pending.delete(id)) reject(new Error(`CDP command timed out: ${method}`));
      }, 10_000);
    });
    socket.send(JSON.stringify({ id, method, params }));
    const result = await response;
    if (result.error !== undefined) throw new Error(`CDP command failed ${method}: ${JSON.stringify(result.error)}`);
    return result;
  }

  [Symbol.dispose](): void {
    this.#socket?.close();
    this.#socket = null;
  }
}

async function firstExistingPath(paths: readonly string[]): Promise<string | null> {
  for (const path of paths) {
    if (await Bun.file(path).exists()) return path;
  }
  return null;
}

async function waitForHttp(url: string, timeoutMs: number): Promise<void> {
  const startedAt = Date.now();
  let lastError: unknown;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = new Error(`${url} returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await wait(100);
  }
  throw new Error(`Timed out waiting for ${url}: ${String(lastError)}`);
}

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

await main();
