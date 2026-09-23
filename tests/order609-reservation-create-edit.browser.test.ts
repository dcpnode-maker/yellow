import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, resolve } from "node:path";

const repository = resolve(import.meta.dir, "..");
const browserPath = [
  process.env.PROGRAMFILES && resolve(process.env.PROGRAMFILES, "Google/Chrome/Application/chrome.exe"),
  process.env["PROGRAMFILES(X86)"] && resolve(process.env["PROGRAMFILES(X86)"], "Microsoft/Edge/Application/msedge.exe"),
  process.env.LOCALAPPDATA && resolve(process.env.LOCALAPPDATA, "Google/Chrome/Application/chrome.exe"),
].find((candidate): candidate is string => Boolean(candidate && existsSync(candidate)));

const propertyId = "6081b544-22a1-534f-a86d-bb1ae0519e14";
const partyId = "00000000-0000-4000-8000-000000000609";
const sellableUnitId = "00000000-0000-4000-8000-000000000610";
const ratePlanId = "00000000-0000-4000-8000-000000000611";
const reservationId = "00000000-0000-4000-8000-000000000612";
const route = `/p/${propertyId}/reservations`;
const readOnlyPostPaths = new Set([
  "/api/v1/auth/demo:enter",
  `/api/v1/properties/${propertyId}/parties:search`,
  `/api/v1/properties/${propertyId}/availability:search`,
]);
const mutationPaths = new Set(["/api/v1/reservations:commit"]);

type CdpResult<T> = { result?: { value?: T }; exceptionDetails?: { text?: string } };
type RequestRecord = Readonly<{ method: string; path: string }>;
type Geometry = Readonly<{
  viewport: number;
  documentOverflow: number;
  surfaceOverflow: number;
  panelOverflow: number;
  minButtonHeight: number;
  confirmationHeight: number;
  reviewColumns: number;
  actionColumns: number;
}>;
type BrowserProof = Readonly<{
  viewport: number;
  geometry: Geometry;
  commitDisabledBeforeConfirmation: boolean;
  commitEnabledAfterConfirmation: boolean;
  mutationCountBeforeConfirmation: number;
  mutationCountAfterConfirmation: number;
  successText: string;
}>;

const contentTypes: Readonly<Record<string, string>> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function json(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: { "cache-control": "no-store" } });
}

function transientPortRead(error: unknown): boolean {
  return typeof error === "object" && error !== null &&
    ["EBUSY", "ENOENT"].includes(String((error as { code?: unknown }).code));
}

test("Order609 real reservation create route is confirmation-gated and contained at 240/375/1440", async () => {
  if (!browserPath) throw new Error("Chrome or Edge is required for Order609 browser proof");
  const bunPath = Bun.which("bun");
  if (!bunPath) throw new Error("Bun is required to build the actual Order609 React app");

  const temporary = await mkdtemp(resolve(tmpdir(), "yellow-order609-real-app-"));
  const buildDirectory = resolve(temporary, "build");
  const profile = resolve(temporary, "chrome-profile");
  const requestRecords: RequestRecord[] = [];
  let mutationCount = 0;
  let currentStay = { from: "", to: "" };
  let availabilityRace = false;
  let availabilityRaceRequest = 0;
  let firstAvailabilityPending = false;
  let secondAvailabilityPending = false;
  let releaseFirstAvailability: (() => void) | undefined;
  let releaseSecondAvailability: (() => void) | undefined;
  let server: ReturnType<typeof Bun.serve> | undefined;
  let chrome: ReturnType<typeof Bun.spawn> | undefined;
  let socket: WebSocket | undefined;

  const offerPayload = () => ({ options: [{
    option_ref: "order609-current-offer",
    bookable: true,
    sellable_unit: { id: sellableUnitId, name: "Deluxe King" },
    unit_type: { code: "DLX" },
    rate_plan: { id: ratePlanId, code: "BAR" },
    available_count: 2,
    promise: false,
    commit_arbitration_required: true,
    stay: currentStay,
    total: { amount_minor: "420000", currency: "INR", kind: "stay_total" },
  }] });

  try {
    const build = Bun.spawn([
      bunPath, "x", "vite", "build",
      "--config", resolve(repository, "frontend/yellow/vite.config.ts"),
      "--outDir", buildDirectory,
      "--emptyOutDir",
    ], { cwd: repository, stdout: "pipe", stderr: "pipe", windowsHide: true });
    const [buildExit, buildStdout, buildStderr] = await Promise.all([
      build.exited,
      new Response(build.stdout).text(),
      new Response(build.stderr).text(),
    ]);
    if (buildExit !== 0) throw new Error(`Actual React build failed (${buildExit}):\n${buildStdout}\n${buildStderr}`);
    if (!existsSync(resolve(buildDirectory, "index.html"))) throw new Error("Actual React build did not produce index.html");

    server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      async fetch(request) {
        const url = new URL(request.url);
        requestRecords.push({ method: request.method, path: url.pathname });
        if (request.method === "POST" && mutationPaths.has(url.pathname)) {
          mutationCount += 1;
          return json({ reservation: { reservationId, confirmationNo: "YEL-609", status: "reserved" } });
        }
        if (url.pathname === "/api/v1/auth/demo:enter" && request.method === "POST")
          return json({ accessToken: "synthetic-order609-browser-token" });
        if (url.pathname === "/api/v1/me/properties" && request.method === "GET")
          return json({ properties: [{ id: propertyId, name: "Locanda London", timezone: "UTC" }] });
        if (url.pathname === `/api/v1/properties/${propertyId}/reservation-board` && request.method === "GET")
          return json({ reservations: [], nextCursor: null });
        if (url.pathname === `/api/v1/properties/${propertyId}/parties:search` && request.method === "POST")
          return json({ profiles: [{ partyId, displayName: "Asha Rao", legalName: "Asha Rao", kind: "person", status: "active", roles: ["guest"], contacts: [] }] });
        if (url.pathname === `/api/v1/properties/${propertyId}/availability:search` && request.method === "POST") {
          const body = await request.json() as { stay?: { from?: string; to?: string } };
          currentStay = { from: body.stay?.from ?? "", to: body.stay?.to ?? "" };
          if (availabilityRace) {
            availabilityRaceRequest += 1;
            if (availabilityRaceRequest === 1) {
              firstAvailabilityPending = true;
              await new Promise<void>((resolveGate) => { releaseFirstAvailability = resolveGate; });
              return json({ title: "Deliberately stale rejected offer search" }, 503);
            }
            if (availabilityRaceRequest === 2) {
              secondAvailabilityPending = true;
              await new Promise<void>((resolveGate) => { releaseSecondAvailability = resolveGate; });
            }
          }
          return json(offerPayload());
        }
        if (url.pathname === `/api/v1/properties/${propertyId}/reservations/${reservationId}` && request.method === "GET")
          return json({ reservation: {
            reservationId,
            primaryPartyId: partyId,
            confirmationNo: "YEL-609",
            status: "reserved",
            channelCode: "direct",
            segments: [{ sellableUnitId, ratePlanId, from: currentStay.from, to: currentStay.to, adults: 1, childAges: [] }],
          } });
        if (url.pathname.startsWith("/api/")) return json({ title: "Unexpected synthetic browser request" }, 404);

        const relative = url.pathname.startsWith("/yellow-next/")
          ? url.pathname.slice("/yellow-next/".length)
          : "index.html";
        const filePath = resolve(buildDirectory, relative);
        if (!filePath.startsWith(buildDirectory) || !existsSync(filePath)) return new Response("Not found", { status: 404 });
        return new Response(Bun.file(filePath), {
          headers: { "content-type": contentTypes[extname(filePath)] ?? "application/octet-stream" },
        });
      },
    });

    chrome = Bun.spawn([
      browserPath, "--headless=new", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage",
      "--no-first-run", "--no-default-browser-check", "--remote-debugging-address=127.0.0.1",
      "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank",
    ], { stdout: "ignore", stderr: "ignore", windowsHide: true });

    const portFile = resolve(profile, "DevToolsActivePort");
    let debuggerPort = "";
    for (let attempt = 0; attempt < 800; attempt += 1) {
      try {
        if (existsSync(portFile)) debuggerPort = (await readFile(portFile, "utf8")).split(/\r?\n/u)[0]?.trim() ?? "";
      } catch (error) {
        if (!transientPortRead(error)) throw error;
      }
      if (debuggerPort || chrome.exitCode !== null) break;
      await Bun.sleep(25);
    }
    if (!debuggerPort) throw new Error(`Browser did not expose DevTools (exit ${chrome.exitCode ?? "unknown"})`);
    const targetResponse = await fetch(`http://127.0.0.1:${debuggerPort}/json/new?${encodeURIComponent("about:blank")}`, { method: "PUT" });
    if (!targetResponse.ok) throw new Error(`Browser target creation failed (${targetResponse.status})`);
    const target = await targetResponse.json() as { webSocketDebuggerUrl?: string };
    if (!target.webSocketDebuggerUrl) throw new Error("Browser target has no debugger endpoint");

    socket = new WebSocket(target.webSocketDebuggerUrl);
    let nextId = 0;
    const pending = new Map<number, { resolve(value: unknown): void; reject(reason: Error): void }>();
    const runtimeErrors: string[] = [];
    await new Promise<void>((resolveOpen, rejectOpen) => {
      const timer = setTimeout(() => rejectOpen(new Error("Browser debugger socket did not open")), 5_000);
      socket!.addEventListener("open", () => { clearTimeout(timer); resolveOpen(); }, { once: true });
      socket!.addEventListener("error", () => { clearTimeout(timer); rejectOpen(new Error("Browser debugger socket failed")); }, { once: true });
    });
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as {
        id?: number; result?: unknown; error?: { message?: string }; method?: string;
        params?: { exceptionDetails?: { text?: string; exception?: { description?: string } } };
      };
      if (message.method === "Runtime.exceptionThrown")
        runtimeErrors.push(message.params?.exceptionDetails?.exception?.description ?? message.params?.exceptionDetails?.text ?? "Runtime exception");
      if (!message.id) return;
      const command = pending.get(message.id);
      if (!command) return;
      pending.delete(message.id);
      if (message.error) command.reject(new Error(message.error.message ?? "Browser command failed"));
      else command.resolve(message.result);
    });
    const send = <T>(method: string, params: Record<string, unknown> = {}) => new Promise<T>((resolveCommand, rejectCommand) => {
      nextId += 1;
      pending.set(nextId, { resolve: (value) => resolveCommand(value as T), reject: rejectCommand });
      socket!.send(JSON.stringify({ id: nextId, method, params }));
    });
    const evaluate = async <T>(expression: string): Promise<T | undefined> => {
      const result = await send<CdpResult<T>>("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
      if (result.exceptionDetails) throw new Error(`Browser evaluation failed: ${result.exceptionDetails.text ?? "unknown exception"}`);
      return result.result?.value;
    };
    const until = async (expression: string, label: string) => {
      for (let attempt = 0; attempt < 400; attempt += 1) {
        if (await evaluate<boolean>(expression)) return;
        await Bun.sleep(25);
      }
      throw new Error(`Timed out waiting for ${label}`);
    };
    const untilLocal = async (predicate: () => boolean, label: string) => {
      for (let attempt = 0; attempt < 400; attempt += 1) {
        if (predicate()) return;
        await Bun.sleep(25);
      }
      throw new Error(`Timed out waiting for ${label}`);
    };
    const setInput = (selector: string, value: string) => evaluate(`(()=>{const input=document.querySelector(${JSON.stringify(selector)});if(!(input instanceof HTMLInputElement))throw new Error('Missing input');const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true}));})()`);

    await send("Page.enable");
    await send("Runtime.enable");
    const proofs: BrowserProof[] = [];
    for (const width of [240, 375, 1440]) {
      availabilityRace = width === 375;
      availabilityRaceRequest = 0;
      firstAvailabilityPending = false;
      secondAvailabilityPending = false;
      releaseFirstAvailability = undefined;
      releaseSecondAvailability = undefined;
      await send("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: width < 600 });
      await send("Page.navigate", { url: `http://127.0.0.1:${server.port}${route}` });
      await until("document.readyState==='complete'&&!!document.querySelector('.reservation-board-next')", `${width}px reservation board`);
      await evaluate(`document.querySelector('.reservation-board-actions button').click()`);
      await until("!!document.querySelector('.reservation-create-next')", `${width}px real create workspace`);
      await evaluate(`document.querySelector('.reservation-create-panel button').click()`);
      await until("!!document.querySelector('.reservation-create-search input')", `${width}px guest step`);
      await setInput(".reservation-create-search input", "Asha Rao");
      await evaluate(`document.querySelector('.reservation-create-search').requestSubmit()`);
      await until("document.querySelectorAll('.reservation-create-results button').length===1", `${width}px canonical Party result`);
      await evaluate(`document.querySelector('.reservation-create-results button').click()`);
      await evaluate(`[...document.querySelectorAll('.reservation-create-actions button')].find(button=>button.textContent.includes('Find current offers')).click()`);

      if (availabilityRace) {
        await untilLocal(() => firstAvailabilityPending, "first delayed availability request");
        await evaluate(`(()=>{const guest=document.querySelector('.reservation-create-results button'),key=Object.keys(guest).find(name=>name.startsWith('__reactProps$'));if(!key||typeof guest[key].onClick!=='function')throw new Error('Missing actual guest reset handler');guest[key].onClick()})()`);
        await Bun.sleep(50);
        (releaseFirstAvailability as (() => void) | undefined)?.();
        await Bun.sleep(100);
        const staleProof = await evaluate<Readonly<{ error: boolean; busy: boolean; message: string }>>(`(()=>{const find=[...document.querySelectorAll('.reservation-create-actions button')].find(button=>button.textContent.includes('Find current offers'));return{error:!!document.querySelector('.reservation-create-next .error'),busy:find.disabled,message:document.querySelector('.reservation-create-message')?.textContent??''}})()`);
        expect(staleProof).toEqual({ error: false, busy: true, message: "Checking live inventory, restrictions and published rates…" });
        await evaluate(`(()=>{const find=[...document.querySelectorAll('.reservation-create-actions button')].find(button=>button.textContent.includes('Find current offers')),key=Object.keys(find).find(name=>name.startsWith('__reactProps$'));if(!key||typeof find[key].onClick!=='function')throw new Error('Missing actual offer search handler');find[key].onClick()})()`);
        await untilLocal(() => secondAvailabilityPending, "newer availability request");
        (releaseSecondAvailability as (() => void) | undefined)?.();
      }

      await until("!!document.querySelector('.reservation-create-results.offers button')", `${width}px current offer`);
      await evaluate(`document.querySelector('.reservation-create-results.offers button').click()`);
      await evaluate(`[...document.querySelectorAll('.reservation-create-actions button')].find(button=>button.textContent.includes('Review reservation')).click()`);
      await until("!!document.querySelector('.reservation-create-confirm input')", `${width}px review step`);

      const mutationCountBeforeConfirmation = mutationCount;
      const postPatchBeforeConfirmation = requestRecords.filter(({ method }) => method === "POST" || method === "PATCH");
      const unexpectedPostPatch = postPatchBeforeConfirmation.filter(({ path }) => !readOnlyPostPaths.has(path) && !mutationPaths.has(path));
      expect(unexpectedPostPatch, JSON.stringify(requestRecords)).toEqual([]);
      expect(mutationCountBeforeConfirmation).toBe(proofs.length);

      const preConfirmation = await evaluate<Readonly<{ disabled: boolean; geometry: Geometry }>>(`(()=>{const surface=document.querySelector('.reservation-create-next'),panel=document.querySelector('.reservation-create-panel'),commit=[...panel.querySelectorAll('button')].find(button=>button.textContent.includes('Confirm and create reservation')),surfaceRect=surface.getBoundingClientRect(),panelRect=panel.getBoundingClientRect(),buttons=[...surface.querySelectorAll('button')].filter(button=>button.getClientRects().length),confirmation=surface.querySelector('.reservation-create-confirm'),columns=element=>getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length;commit.click();return{disabled:commit.disabled,geometry:{viewport:innerWidth,documentOverflow:Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth),surfaceOverflow:Math.max(0,-surfaceRect.left,surfaceRect.right-innerWidth),panelOverflow:Math.max(0,surfaceRect.left-panelRect.left,panelRect.right-surfaceRect.right),minButtonHeight:Math.min(...buttons.map(button=>button.getBoundingClientRect().height)),confirmationHeight:confirmation.getBoundingClientRect().height,reviewColumns:columns(surface.querySelector('.reservation-create-review')),actionColumns:getComputedStyle(surface.querySelector('.reservation-create-actions')).flexDirection==='column-reverse'?1:2}}})()`);
      if (!preConfirmation) throw new Error(`Missing ${width}px pre-confirmation proof`);
      expect(mutationCount).toBe(mutationCountBeforeConfirmation);

      await evaluate(`document.querySelector('.reservation-create-confirm input').click()`);
      await until("![...document.querySelectorAll('.reservation-create-actions button')].find(button=>button.textContent.includes('Confirm and create reservation')).disabled", `${width}px explicit confirmation`);
      const commitEnabledAfterConfirmation = await evaluate<boolean>(`![...document.querySelectorAll('.reservation-create-actions button')].find(button=>button.textContent.includes('Confirm and create reservation')).disabled`);
      expect(mutationCount).toBe(mutationCountBeforeConfirmation);
      await evaluate(`[...document.querySelectorAll('.reservation-create-actions button')].find(button=>button.textContent.includes('Confirm and create reservation')).click()`);
      await until("!!document.querySelector('.reservation-create-success')", `${width}px authoritative success`);
      const successText = await evaluate<string>(`document.querySelector('.reservation-create-success').textContent`);
      proofs.push({
        viewport: width,
        geometry: preConfirmation.geometry,
        commitDisabledBeforeConfirmation: preConfirmation.disabled,
        commitEnabledAfterConfirmation: commitEnabledAfterConfirmation === true,
        mutationCountBeforeConfirmation,
        mutationCountAfterConfirmation: mutationCount,
        successText: successText ?? "",
      });
    }

    expect(proofs.map(({ viewport }) => viewport)).toEqual([240, 375, 1440]);
    expect(proofs.every(({ geometry }) => geometry.viewport > 0 && geometry.documentOverflow === 0 && geometry.surfaceOverflow === 0 && geometry.panelOverflow === 0), JSON.stringify(proofs)).toBe(true);
    expect(proofs.every(({ geometry }) => geometry.minButtonHeight >= 44 && geometry.confirmationHeight >= 44), JSON.stringify(proofs)).toBe(true);
    expect(proofs.filter(({ viewport }) => viewport <= 375).every(({ geometry }) => geometry.reviewColumns === 1 && geometry.actionColumns === 1), JSON.stringify(proofs)).toBe(true);
    expect(proofs.find(({ viewport }) => viewport === 1440)?.geometry).toMatchObject({ reviewColumns: 2, actionColumns: 2 });
    expect(proofs.every(({ commitDisabledBeforeConfirmation, commitEnabledAfterConfirmation }) => commitDisabledBeforeConfirmation && commitEnabledAfterConfirmation)).toBe(true);
    expect(proofs.map(({ mutationCountBeforeConfirmation, mutationCountAfterConfirmation }) => mutationCountAfterConfirmation - mutationCountBeforeConfirmation)).toEqual([1, 1, 1]);
    expect(proofs.every(({ successText }) => successText.includes("Reservation created") && successText.includes("reserved"))).toBe(true);
    expect(runtimeErrors).toEqual([]);
    expect(requestRecords.filter(({ method, path }) => (method === "POST" || method === "PATCH") && mutationPaths.has(path))).toHaveLength(3);
    expect(requestRecords.some(({ method }) => method === "PATCH")).toBe(false);
  } finally {
    releaseFirstAvailability?.();
    releaseSecondAvailability?.();
    socket?.close();
    if (chrome?.exitCode === null) chrome.kill();
    await chrome?.exited.catch(() => undefined);
    server?.stop(true);
    await rm(temporary, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
}, 120_000);
