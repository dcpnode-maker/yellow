/**
 * Q215 approval-only capture harness.
 *
 * It serves only the isolated motion atelier, drives one owned Chromium through
 * CDP, and streams deterministic PNG frames to the already-installed FFmpeg.
 * It never imports the application, opens a database, or contacts a provider.
 */
import { existsSync } from "node:fs";
import { copyFile, lstat, mkdir, realpath, rm } from "node:fs/promises";
import { extname, isAbsolute, relative, resolve, sep } from "node:path";

const VIEWPORT = Object.freeze({ width: 1_000, height: 680, deviceScaleFactor: 1 });
const GIF_SIZE = Object.freeze({ width: 900, height: 612 });
const FRAME_RATE = 20;
const FRAME_COUNT = 140;
const DURATION_SECONDS = 7;
const GLOBAL_TIMEOUT_MS = 30 * 60_000;
const COMMAND_TIMEOUT_MS = 8_000;
const MAX_DEBUG_FRAMES = 10;
const MAX_PROCESS_DIAGNOSTIC_BYTES = 64 * 1_024;
const EXPECTED_IDS = Object.freeze(Array.from({ length: 10 }, (_, index) => String(index + 1).padStart(2, "0")));
const SLUGS: Readonly<Record<string, string>> = Object.freeze({
  "01": "architectural-hotel-twin",
  "02": "detailed-suite-configurator",
  "03": "exploded-floor-selection",
  "04": "resort-str-landscape",
  "05": "optical-identity-lens",
  "06": "candidate-decision-orbits",
  "07": "revenue-terrain",
  "08": "ceramic-journey-ribbon",
  "09": "sculptural-concierge-gateway",
  "10": "compact-mobile-spatial-room-selection",
});

type Arguments = Readonly<{
  only?: string;
  stills: boolean;
  software: boolean;
  debugFrames: ReadonlySet<number>;
  help: boolean;
}>;

type PendingCommand = {
  readonly resolve: (value: unknown) => void;
  readonly reject: (reason: Error) => void;
  readonly timer: ReturnType<typeof setTimeout>;
};

type MotionInspection = Readonly<{
  id: string;
  webgl: unknown;
  sceneObjects: number;
  triangles: number;
  [key: string]: unknown;
}>;

type DomInspection = Readonly<{
  width: number;
  height: number;
  overflow: boolean;
  fontLoaded: boolean;
  canvas: Readonly<{ x: number; y: number; width: number; height: number }> | null;
  visibleTextCount: number;
  clippedVisibleText: readonly string[];
  externalResources: readonly string[];
}>;

type ConceptReceipt = Readonly<{
  id: string;
  slug: string;
  inspection: MotionInspection;
  dom: DomInspection;
  firstSha256: string;
  middleSha256: string;
  finalSha256: string;
  uniqueFrameHashes: number;
  gif?: Readonly<{ path: string; sha256: string; frames: number; durationSeconds: number; width: number; height: number }>;
  debugFrames: readonly number[];
}>;

function usage(): string {
  return [
    "Usage: bun scripts/capture-motion-atelier.ts [--only=01] [--stills] [--software] [--frames[=0,35,70,105,139]]",
    "  default       capture all ten 7-second/20fps GIFs plus first/middle/final stills",
    "  --only=01     capture one exact concept id (01 through 10)",
    "  --stills      validate and retain only first/middle/final PNGs; do not start FFmpeg",
    "  --software    use the explicit SwiftShader fallback instead of hardware ANGLE/D3D11",
    "  --frames      additionally retain the bounded default debug sample",
    "  --frames=...  retain at most ten explicit GIF-frame indices from 0 through 139",
  ].join("\n");
}

function parseArguments(values: readonly string[]): Arguments {
  let only: string | undefined;
  let stills = false;
  let software = false;
  let help = false;
  let debugFrames = new Set<number>();
  for (const value of values) {
    if (value === "--help" || value === "-h") {
      help = true;
    } else if (value === "--stills") {
      stills = true;
    } else if (value === "--software") {
      software = true;
    } else if (value === "--frames") {
      debugFrames = new Set([0, 35, 70, 105, 139]);
    } else if (value.startsWith("--frames=")) {
      const source = value.slice("--frames=".length);
      if (!/^(?:0|[1-9][0-9]*)(?:,(?:0|[1-9][0-9]*))*$/.test(source)) {
        throw new Error("--frames must be a comma-separated list of canonical frame indices");
      }
      const parsed = source.split(",").map(Number);
      if (parsed.length > MAX_DEBUG_FRAMES || new Set(parsed).size !== parsed.length ||
          parsed.some((frame) => frame < 0 || frame >= FRAME_COUNT)) {
        throw new Error(`--frames accepts at most ${MAX_DEBUG_FRAMES} unique indices from 0 through ${FRAME_COUNT - 1}`);
      }
      debugFrames = new Set(parsed);
    } else if (value.startsWith("--only=")) {
      if (only !== undefined) throw new Error("--only may be supplied once");
      only = value.slice("--only=".length);
      if (!EXPECTED_IDS.includes(only)) throw new Error("--only must be an exact concept id from 01 through 10");
    } else {
      throw new Error(`Unsupported capture argument: ${value}`);
    }
  }
  return Object.freeze({ ...(only === undefined ? {} : { only }), stills, software,
    debugFrames: Object.freeze(debugFrames), help });
}

const arguments_ = parseArguments(Bun.argv.slice(2));
if (arguments_.help) {
  console.log(usage());
  process.exit(0);
}
if (process.platform !== "win32") {
  throw new Error("Q215 native capture requires Windows and the admitted D: temporary root");
}

const repository = resolve(import.meta.dir, "..");
const prototypeRoot = resolve(repository, "docs/design/prototypes/motion-atelier");
const indexHtml = resolve(prototypeRoot, "index.html");
const font = resolve(repository, "src/http/operator/vendor/urbanist-v1.330/Urbanist[ital,wght].woff2");
const outputRoot = resolve(repository, ".yellow/evidence/motion-atelier");
const temporaryRoot = resolve("D:/Yellow/temp/motion-atelier");
if (!existsSync(indexHtml)) throw new Error("The root-owned motion atelier is not ready for capture");
if (!existsSync(font)) throw new Error("The pinned local Urbanist font is unavailable");

const browser = [
  process.env.PROGRAMFILES && resolve(process.env.PROGRAMFILES, "Google/Chrome/Application/chrome.exe"),
  process.env["PROGRAMFILES(X86)"] && resolve(process.env["PROGRAMFILES(X86)"], "Microsoft/Edge/Application/msedge.exe"),
  Bun.which("chromium"),
].find((path): path is string => Boolean(path && existsSync(path)));
if (!browser) throw new Error("An installed Chromium browser is required; no browser is downloaded");
const ffmpeg = arguments_.stills ? undefined : Bun.which("ffmpeg");
if (!arguments_.stills && !ffmpeg) throw new Error("FFmpeg was not found; no encoder will be installed");

await mkdir(outputRoot, { recursive: true });
await mkdir(temporaryRoot, { recursive: true });
const profile = resolve(temporaryRoot, `capture-profile-${process.pid}-${crypto.randomUUID()}`);
const resolvedTemporaryRoot = `${await realpath(temporaryRoot)}${sep}`;
if (!profile.startsWith(resolvedTemporaryRoot) || !profile.split(sep).at(-1)?.startsWith("capture-profile-")) {
  throw new Error("Owned capture profile escaped the admitted temporary root");
}

const prototypeRealRoot = await realpath(prototypeRoot);
const fontRealPath = await realpath(font);
const contentTypes: Readonly<Record<string, string>> = Object.freeze({
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
});
const servedRequests = new Set<string>();
const deniedRequests = new Set<string>();

async function atelierAsset(pathname: string): Promise<Readonly<{ path: string; type: string }> | undefined> {
  if (pathname === "/prototype/urbanist.woff2") return Object.freeze({ path: fontRealPath, type: "font/woff2" });
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return undefined;
  }
  if (decoded === "/") decoded = "/index.html";
  if (!decoded.startsWith("/") || decoded.includes("\\") || decoded.includes("\0")) return undefined;
  const segments = decoded.slice(1).split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) return undefined;
  const extension = extname(segments.at(-1) ?? "").toLowerCase();
  const type = contentTypes[extension];
  if (!type) return undefined;
  const requested = resolve(prototypeRoot, ...segments);
  const lexical = relative(prototypeRoot, requested);
  if (lexical.startsWith("..") || isAbsolute(lexical)) return undefined;
  try {
    const metadata = await lstat(requested);
    if (!metadata.isFile() || metadata.isSymbolicLink()) return undefined;
    const canonical = await realpath(requested);
    const contained = canonical === prototypeRealRoot || canonical.startsWith(`${prototypeRealRoot}${sep}`);
    return contained ? Object.freeze({ path: canonical, type }) : undefined;
  } catch {
    return undefined;
  }
}

const securityHeaders = Object.freeze({
  "cache-control": "no-store",
  // The root-owned page has one inline import map. unsafe-inline is confined to
  // this fictional, data-free ephemeral server and never changes the app CSP.
  "content-security-policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'none'; media-src 'none'; object-src 'none'; worker-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
});

const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method !== "GET") {
      deniedRequests.add(`${request.method} ${url.pathname}`);
      return new Response("Prototype asset not found", { status: 404, headers: securityHeaders });
    }
    if (url.pathname === "/favicon.ico") {
      servedRequests.add(url.pathname);
      return new Response(null, { status: 204, headers: securityHeaders });
    }
    const asset = await atelierAsset(url.pathname);
    if (!asset) {
      deniedRequests.add(url.pathname);
      return new Response("Prototype asset not found", { status: 404, headers: securityHeaders });
    }
    servedRequests.add(url.pathname);
    return new Response(Bun.file(asset.path), {
      headers: { ...securityHeaders, "content-type": asset.type },
    });
  },
});

const startedAt = performance.now();
const deadline = startedAt + GLOBAL_TIMEOUT_MS;
function remaining(name: string): number {
  const value = Math.floor(deadline - performance.now());
  if (value <= 0) throw new Error(`Capture deadline exhausted before ${name}`);
  return value;
}

const chrome = Bun.spawn([
  browser,
  "--headless=new",
  "--no-first-run",
  "--no-default-browser-check",
  "--remote-debugging-address=127.0.0.1",
  "--remote-debugging-port=0",
  "--disable-background-networking",
  "--disable-component-update",
  "--disable-default-apps",
  "--disable-extensions",
  "--disable-sync",
  "--disable-translate",
  "--metrics-recording-only",
  "--use-gl=angle",
  ...(arguments_.software
    ? ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"]
    : ["--use-angle=d3d11"]),
  `--user-data-dir=${profile}`,
  "about:blank",
], { stdin: "ignore", stdout: "ignore", stderr: "ignore" });

let socket: WebSocket | undefined;
let nextCommandId = 0;
const pending = new Map<number, PendingCommand>();
const browserErrors: Array<Record<string, unknown>> = [];
const receipts: ConceptReceipt[] = [];

function boundedText(value: unknown, maximum = 2_000): string {
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  const text = serialized ?? String(value);
  return text.length <= maximum ? text : `${text.slice(0, maximum)}…`;
}

async function send(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
  if (!socket || socket.readyState !== WebSocket.OPEN) throw new Error(`CDP is unavailable for ${method}`);
  const timeout = Math.min(COMMAND_TIMEOUT_MS, remaining(method));
  return new Promise((resolveCommand, reject) => {
    const id = ++nextCommandId;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`CDP timeout: ${method}`));
    }, timeout);
    pending.set(id, { resolve: resolveCommand, reject, timer });
    socket!.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression: string): Promise<unknown> {
  const response = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  }) as { result?: { value?: unknown }; exceptionDetails?: unknown };
  if (response.exceptionDetails) throw new Error(`Browser evaluation failed: ${boundedText(response.exceptionDetails)}`);
  return response.result?.value;
}

async function capturePng(): Promise<Uint8Array> {
  const response = await send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
    clip: { x: 0, y: 0, width: VIEWPORT.width, height: VIEWPORT.height, scale: 1 },
  }) as { data?: unknown };
  if (typeof response.data !== "string") throw new Error("Chromium returned no screenshot bytes");
  const bytes = new Uint8Array(Buffer.from(response.data, "base64"));
  const dimensions = pngDimensions(bytes);
  if (dimensions.width !== VIEWPORT.width || dimensions.height !== VIEWPORT.height) {
    throw new Error(`Unexpected screenshot dimensions ${dimensions.width}x${dimensions.height}`);
  }
  return bytes;
}

function pngDimensions(bytes: Uint8Array): Readonly<{ width: number; height: number }> {
  if (bytes.length < 24 || bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47) {
    throw new Error("Chromium screenshot is not a PNG");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return Object.freeze({ width: view.getUint32(16), height: view.getUint32(20) });
}

function sha256(bytes: Uint8Array): string {
  return new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
}

async function renderAt(id: string, seconds: number): Promise<void> {
  const result = await evaluate(`Promise.resolve(window.motionAtelier.renderAt(${JSON.stringify(seconds)}))
    .then(() => ({ id: window.motionAtelier.inspect().id }))`);
  if (!result || typeof result !== "object" || (result as { id?: unknown }).id !== id) {
    throw new Error(`Motion atelier rendered the wrong concept for ${id}`);
  }
}

async function inspectConcept(id: string): Promise<Readonly<{ inspection: MotionInspection; dom: DomInspection }>> {
  const value = await evaluate(`(() => {
    const api = window.motionAtelier;
    const inspection = api.inspect();
    const canvasNode = document.querySelector('canvas');
    const canvasRect = canvasNode?.getBoundingClientRect();
    const candidates = [...document.querySelectorAll('h1,h2,h3,p,li,button,[role="status"]')]
      .filter((node) => {
        const style = getComputedStyle(node), rect = node.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0 &&
          rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.bottom > 0 &&
          rect.left < innerWidth && rect.top < innerHeight && (node.textContent || '').trim().length > 0;
      });
    const clipped = candidates.filter((node) => {
      const rect = node.getBoundingClientRect();
      return rect.left < -1 || rect.top < -1 || rect.right > innerWidth + 1 || rect.bottom > innerHeight + 1;
    }).map((node) => (node.textContent || '').trim().slice(0, 80));
    return { inspection, dom: {
      width: innerWidth, height: innerHeight,
      overflow: document.documentElement.scrollWidth > innerWidth + 1 || document.documentElement.scrollHeight > innerHeight + 1,
      fontLoaded: document.fonts.check('16px Urbanist'),
      canvas: canvasRect ? { x:canvasRect.x, y:canvasRect.y, width:canvasRect.width, height:canvasRect.height } : null,
      visibleTextCount: candidates.length,
      clippedVisibleText: clipped,
      externalResources: performance.getEntriesByType('resource')
        .filter((entry) => new URL(entry.name).origin !== location.origin).map((entry) => entry.name),
    }};
  })()`);
  if (!value || typeof value !== "object") throw new Error(`Motion atelier inspection is invalid for ${id}`);
  const pair = value as { inspection?: unknown; dom?: unknown };
  if (!pair.inspection || typeof pair.inspection !== "object" || !pair.dom || typeof pair.dom !== "object") {
    throw new Error(`Motion atelier inspection is incomplete for ${id}`);
  }
  const inspection = pair.inspection as MotionInspection;
  const dom = pair.dom as DomInspection;
  if (inspection.id !== id || !(inspection.webgl === true ||
      (typeof inspection.webgl === "string" && inspection.webgl.length > 0)) ||
      !Number.isSafeInteger(inspection.sceneObjects) || inspection.sceneObjects < 1 ||
      !Number.isSafeInteger(inspection.triangles) || inspection.triangles < 1) {
    throw new Error(`Motion atelier WebGL/geometry inspection failed for ${id}: ${boundedText(inspection)}`);
  }
  if (dom.width !== VIEWPORT.width || dom.height !== VIEWPORT.height || dom.overflow || !dom.fontLoaded ||
      !dom.canvas || dom.canvas.width < 1 || dom.canvas.height < 1 ||
      dom.canvas.x < -1 || dom.canvas.y < -1 || dom.canvas.x + dom.canvas.width > dom.width + 1 ||
      dom.canvas.y + dom.canvas.height > dom.height + 1 || dom.visibleTextCount < 3 ||
      dom.clippedVisibleText.length > 0 || dom.externalResources.length > 0) {
    throw new Error(`Motion atelier containment/resource inspection failed for ${id}: ${boundedText(dom)}`);
  }
  return Object.freeze({ inspection: Object.freeze({ ...inspection }), dom: Object.freeze({ ...dom,
    canvas: dom.canvas && Object.freeze({ ...dom.canvas }),
    clippedVisibleText: Object.freeze([...dom.clippedVisibleText]),
    externalResources: Object.freeze([...dom.externalResources]),
  }) });
}

async function readBoundedStream(stream: ReadableStream<Uint8Array>, maximum: number): Promise<string> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      const remainingBytes = maximum - total;
      if (remainingBytes > 0) {
        const kept = part.value.byteLength <= remainingBytes ? part.value : part.value.subarray(0, remainingBytes);
        chunks.push(kept);
        total += kept.byteLength;
      }
    }
  } finally {
    reader.releaseLock();
  }
  const joined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(joined);
}

async function waitForExit(child: ReturnType<typeof Bun.spawn>, name: string, timeoutMs: number): Promise<number> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      child.exited,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${name} did not exit within its bounded deadline`)),
          Math.min(timeoutMs, remaining(name)));
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function gifMetadata(bytes: Uint8Array): Readonly<{ frames: number; durationSeconds: number; width: number; height: number }> {
  if (bytes.length < 13 || new TextDecoder().decode(bytes.subarray(0, 6)) !== "GIF89a") {
    throw new Error("FFmpeg output is not a GIF89a file");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint16(6, true);
  const height = view.getUint16(8, true);
  let offset = 13;
  const packed = bytes[10] ?? 0;
  if ((packed & 0x80) !== 0) offset += 3 * (2 ** ((packed & 0x07) + 1));
  let frames = 0;
  let durationHundredths = 0;
  let pendingDelay = 0;
  const skipBlocks = (): void => {
    while (offset < bytes.length) {
      const size = bytes[offset++] ?? 0;
      if (size === 0) return;
      offset += size;
      if (offset > bytes.length) throw new Error("GIF sub-block exceeds output bytes");
    }
    throw new Error("GIF sub-block is unterminated");
  };
  while (offset < bytes.length) {
    const marker = bytes[offset++];
    if (marker === 0x3b) break;
    if (marker === 0x21) {
      const label = bytes[offset++];
      if (label === 0xf9) {
        const blockSize = bytes[offset++];
        if (blockSize !== 4 || offset + 5 > bytes.length) throw new Error("GIF control extension is invalid");
        pendingDelay = (bytes[offset + 1] ?? 0) | ((bytes[offset + 2] ?? 0) << 8);
        offset += 4;
        if (bytes[offset++] !== 0) throw new Error("GIF control extension is unterminated");
      } else {
        skipBlocks();
      }
      continue;
    }
    if (marker !== 0x2c || offset + 9 > bytes.length) throw new Error("GIF contains an invalid block");
    const imagePacked = bytes[offset + 8] ?? 0;
    offset += 9;
    if ((imagePacked & 0x80) !== 0) offset += 3 * (2 ** ((imagePacked & 0x07) + 1));
    if (offset >= bytes.length) throw new Error("GIF image data is missing");
    offset += 1;
    skipBlocks();
    frames += 1;
    durationHundredths += pendingDelay;
    pendingDelay = 0;
  }
  return Object.freeze({ frames, durationSeconds: durationHundredths / 100, width, height });
}

async function encodeConcept(id: string, slug: string): Promise<Readonly<{
  first: Uint8Array;
  middle: Uint8Array;
  final: Uint8Array;
  uniqueHashes: number;
  gif: NonNullable<ConceptReceipt["gif"]>;
}>> {
  const finalPath = resolve(outputRoot, `${id}-${slug}.gif`);
  const temporaryPath = resolve(temporaryRoot, `${id}-${slug}-${process.pid}-${crypto.randomUUID()}.gif`);
  const encoder = Bun.spawn([
    ffmpeg!, "-hide_banner", "-loglevel", "error", "-y",
    "-f", "image2pipe", "-vcodec", "png", "-framerate", String(FRAME_RATE), "-i", "pipe:0",
    "-filter_complex",
    `[0:v]scale=${GIF_SIZE.width}:${GIF_SIZE.height}:flags=lanczos,split[a][b];[a]palettegen=max_colors=192:stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a`,
    "-loop", "0", temporaryPath,
  ], { stdin: "pipe", stdout: "ignore", stderr: "pipe" });
  const diagnostic = readBoundedStream(encoder.stderr, MAX_PROCESS_DIAGNOSTIC_BYTES);
  const hashes = new Set<string>();
  let first: Uint8Array | undefined;
  let middle: Uint8Array | undefined;
  try {
    for (let frame = 0; frame < FRAME_COUNT; frame += 1) {
      remaining(`frame ${frame} of concept ${id}`);
      if (frame % 35 === 0) console.log(`Encoding ${id}-${slug}: frame ${frame}/${FRAME_COUNT}`);
      await renderAt(id, frame / FRAME_RATE);
      const bytes = await capturePng();
      hashes.add(sha256(bytes));
      if (frame === 0) first = bytes;
      if (frame === FRAME_COUNT / 2) middle = bytes;
      if (arguments_.debugFrames.has(frame)) {
        await Bun.write(resolve(outputRoot, `${id}-${slug}-frame-${String(frame).padStart(3, "0")}.png`), bytes);
      }
      if (encoder.exitCode !== null) throw new Error(`FFmpeg exited while receiving concept ${id}`);
      encoder.stdin.write(bytes);
      await encoder.stdin.flush();
    }
    console.log(`Encoding ${id}-${slug}: frame ${FRAME_COUNT}/${FRAME_COUNT}`);
    encoder.stdin.end();
    const exitCode = await waitForExit(encoder, `FFmpeg concept ${id}`, 45_000);
    const stderr = await diagnostic;
    if (exitCode !== 0) throw new Error(`FFmpeg failed for concept ${id}: ${boundedText(stderr)}`);
    if (!first || !middle) throw new Error(`Concept ${id} did not produce its inspection frames`);
    await renderAt(id, DURATION_SECONDS);
    const final = await capturePng();
    const inspectionHashes = [sha256(first), sha256(middle), sha256(final)];
    if (new Set(inspectionHashes).size !== inspectionHashes.length || hashes.size < 3) {
      throw new Error(`Concept ${id} did not render distinct first, middle and final frames`);
    }
    const gifBytes = new Uint8Array(await Bun.file(temporaryPath).arrayBuffer());
    const metadata = gifMetadata(gifBytes);
    if (metadata.frames !== FRAME_COUNT || metadata.width !== GIF_SIZE.width || metadata.height !== GIF_SIZE.height ||
        Math.abs(metadata.durationSeconds - DURATION_SECONDS) > 0.01) {
      throw new Error(`Encoded GIF contract failed for ${id}: ${boundedText(metadata)}`);
    }
    const encodedSha256 = sha256(gifBytes);
    await copyFile(temporaryPath, finalPath);
    const publishedBytes = new Uint8Array(await Bun.file(finalPath).arrayBuffer());
    if (publishedBytes.byteLength !== gifBytes.byteLength || sha256(publishedBytes) !== encodedSha256) {
      await rm(finalPath, { force: true });
      throw new Error(`Published GIF byte verification failed for ${id}`);
    }
    return Object.freeze({ first, middle, final, uniqueHashes: hashes.size,
      gif: Object.freeze({ path: finalPath, sha256: encodedSha256, ...metadata }) });
  } catch (error) {
    try { encoder.stdin.end(); } catch {}
    if (encoder.exitCode === null) encoder.kill();
    try { await waitForExit(encoder, `failed FFmpeg concept ${id}`, 5_000); } catch {}
    await diagnostic.catch(() => "");
    throw error;
  } finally {
    await rm(temporaryPath, { force: true });
  }
}

async function captureStills(id: string): Promise<Readonly<{
  first: Uint8Array;
  middle: Uint8Array;
  final: Uint8Array;
  uniqueHashes: number;
}>> {
  const frames: Uint8Array[] = [];
  for (const seconds of [0, DURATION_SECONDS / 2, DURATION_SECONDS]) {
    await renderAt(id, seconds);
    frames.push(await capturePng());
  }
  const [first, middle, final] = frames;
  if (!first || !middle || !final) throw new Error(`Concept ${id} did not produce three stills`);
  const hashes = new Set(frames.map(sha256));
  if (hashes.size !== 3) throw new Error(`Concept ${id} stills are not pairwise distinct`);
  return Object.freeze({ first, middle, final, uniqueHashes: hashes.size });
}

async function selectConcept(id: string): Promise<void> {
  const selected = await evaluate(`Promise.resolve(window.motionAtelier.select(${JSON.stringify(id)}))
    .then(() => window.motionAtelier.inspect().id)`);
  if (selected !== id) throw new Error(`Motion atelier did not select concept ${id}`);
  await renderAt(id, 0);
  const first = await capturePng();
  await renderAt(id, 0);
  const repeated = await capturePng();
  if (sha256(first) !== sha256(repeated)) {
    throw new Error(`Concept ${id} is not deterministic at time zero`);
  }
}

async function captureConcept(id: string): Promise<void> {
  const slug = SLUGS[id];
  if (!slug) throw new Error(`No output slug is registered for concept ${id}`);
  await selectConcept(id);
  const before = await inspectConcept(id);
  const capture = arguments_.stills ? await captureStills(id) : await encodeConcept(id, slug);
  await Bun.write(resolve(outputRoot, `${id}-${slug}-first.png`), capture.first);
  await Bun.write(resolve(outputRoot, `${id}-${slug}-middle.png`), capture.middle);
  await Bun.write(resolve(outputRoot, `${id}-${slug}-final.png`), capture.final);
  const after = await inspectConcept(id);
  if (after.inspection.id !== before.inspection.id || after.inspection.sceneObjects !== before.inspection.sceneObjects ||
      after.inspection.triangles !== before.inspection.triangles) {
    throw new Error(`Concept ${id} changed its scene identity during deterministic capture`);
  }
  const gif = arguments_.stills
    ? undefined
    : (capture as Awaited<ReturnType<typeof encodeConcept>>).gif;
  receipts.push(Object.freeze({ id, slug, inspection: after.inspection, dom: after.dom,
    firstSha256: sha256(capture.first), middleSha256: sha256(capture.middle), finalSha256: sha256(capture.final),
    uniqueFrameHashes: capture.uniqueHashes,
    ...(gif ? { gif } : {}),
    debugFrames: Object.freeze([...arguments_.debugFrames].sort((left, right) => left - right)),
  }));
  console.log(`Captured ${id}-${slug}${arguments_.stills ? " stills" : ".gif"}`);
}

async function closeOwnedBrowser(): Promise<void> {
  if (socket?.readyState === WebSocket.OPEN) {
    try { await send("Browser.close"); } catch {}
  }
  socket?.close();
  for (const command of pending.values()) {
    clearTimeout(command.timer);
    command.reject(new Error("Capture closed"));
  }
  pending.clear();
  if (chrome.exitCode === null) chrome.kill();
  try { await waitForExit(chrome, "owned Chromium", 8_000); } catch {
    if (chrome.exitCode === null) chrome.kill(9);
    await Promise.race([chrome.exited, Bun.sleep(2_000)]);
  }
}

try {
  let debuggerPort = "";
  for (let attempt = 0; attempt < 400; attempt += 1) {
    try {
      debuggerPort = (await Bun.file(resolve(profile, "DevToolsActivePort")).text()).split(/\r?\n/)[0] ?? "";
    } catch (error) {
      const code = String((error as { code?: unknown }).code ?? "");
      if (code !== "ENOENT" && code !== "EBUSY") throw error;
    }
    if (/^[1-9][0-9]{0,4}$/.test(debuggerPort) && Number(debuggerPort) <= 65_535) break;
    debuggerPort = "";
    if (chrome.exitCode !== null) throw new Error("Owned Chromium exited before CDP became available");
    await Bun.sleep(25);
  }
  if (!debuggerPort) throw new Error("Owned Chromium did not expose CDP within 10 seconds");
  const targetResponse = await fetch(`http://127.0.0.1:${debuggerPort}/json/new?about:blank`, { method: "PUT" });
  if (!targetResponse.ok) throw new Error("Owned Chromium refused its local CDP target");
  const target = await targetResponse.json() as { webSocketDebuggerUrl?: unknown };
  if (typeof target.webSocketDebuggerUrl !== "string") throw new Error("Owned Chromium returned no CDP socket");
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise<void>((resolveOpen, reject) => {
    const timer = setTimeout(() => reject(new Error("CDP socket did not open within 8 seconds")),
      Math.min(COMMAND_TIMEOUT_MS, remaining("CDP open")));
    socket!.addEventListener("open", () => { clearTimeout(timer); resolveOpen(); }, { once: true });
    socket!.addEventListener("error", () => { clearTimeout(timer); reject(new Error("CDP socket failed")); }, { once: true });
  });
  socket.addEventListener("message", (event) => {
    let message: { id?: number; method?: string; result?: unknown; error?: unknown; params?: Record<string, unknown> };
    try {
      message = JSON.parse(String(event.data));
    } catch {
      browserErrors.push({ kind: "invalid_cdp_message" });
      return;
    }
    if (message.method === "Runtime.exceptionThrown") {
      const details = message.params?.exceptionDetails as { text?: unknown; url?: unknown; lineNumber?: unknown; exception?: { description?: unknown } } | undefined;
      browserErrors.push({ kind: "exception", text: boundedText(details?.text), url: boundedText(details?.url),
        lineNumber: details?.lineNumber ?? null, description: boundedText(details?.exception?.description) });
    } else if (message.method === "Runtime.consoleAPICalled" &&
        (message.params?.type === "error" || message.params?.type === "assert")) {
      browserErrors.push({ kind: "console", type: message.params.type });
    } else if (message.method === "Log.entryAdded") {
      const entry = message.params?.entry as { level?: unknown; text?: unknown; url?: unknown } | undefined;
      if (entry?.level === "error") browserErrors.push({ kind: "log", text: boundedText(entry.text), url: boundedText(entry.url) });
    }
    if (typeof message.id !== "number") return;
    const command = pending.get(message.id);
    if (!command) return;
    pending.delete(message.id);
    clearTimeout(command.timer);
    if (message.error) command.reject(new Error(`CDP command failed: ${boundedText(message.error)}`));
    else command.resolve(message.result);
  });

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Log.enable");
  await send("Emulation.setDeviceMetricsOverride", { ...VIEWPORT, mobile: false });
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "no-preference" }] });
  await send("Page.navigate", { url: `http://127.0.0.1:${server.port}/` });
  let ready = false;
  for (let attempt = 0; attempt < 250; attempt += 1) {
    ready = await evaluate("Boolean(window.motionAtelier?.ready === true)") === true;
    if (ready) break;
    if (browserErrors.length > 0) throw new Error(`Motion atelier failed during startup: ${boundedText(browserErrors)}`);
    await Bun.sleep(40);
  }
  if (!ready) throw new Error("Motion atelier did not become ready within 10 seconds");
  const fontLoaded = await evaluate("document.fonts.ready.then(() => document.fonts.check('16px Urbanist'))");
  if (fontLoaded !== true) throw new Error("Pinned Urbanist did not load before capture");
  const ids = await evaluate("window.motionAtelier.ids");
  if (!Array.isArray(ids) || ids.length !== EXPECTED_IDS.length ||
      ids.some((id, index) => id !== EXPECTED_IDS[index])) {
    throw new Error(`Motion atelier ids must be exactly ${EXPECTED_IDS.join(",")}`);
  }
  const selectedIds = arguments_.only ? [arguments_.only] : [...EXPECTED_IDS];
  for (const id of selectedIds) await captureConcept(id);
  if (browserErrors.length > 0) throw new Error(`Browser runtime errors: ${boundedText(browserErrors)}`);
  const proofName = arguments_.only
    ? `capture-proof-${arguments_.only}${arguments_.stills ? "-stills" : ""}.json`
    : `capture-proof${arguments_.stills ? "-stills" : ""}.json`;
  const proof = Object.freeze({
    schema: "yellow-motion-atelier-capture/v1",
    capturedAt: new Date().toISOString(),
    fictional: true,
    liveApplicationTouched: false,
    viewport: VIEWPORT,
    graphicsMode: arguments_.software ? "swiftshader" : "angle-d3d11",
    gif: Object.freeze({ width: GIF_SIZE.width, height: GIF_SIZE.height,
      frameRate: FRAME_RATE, frameCount: FRAME_COUNT, durationSeconds: DURATION_SECONDS }),
    selectedIds: Object.freeze(selectedIds),
    stillsOnly: arguments_.stills,
    servedRequests: Object.freeze([...servedRequests].sort()),
    deniedRequests: Object.freeze([...deniedRequests].sort()),
    concepts: Object.freeze(receipts),
    browserErrors: Object.freeze(browserErrors),
    elapsedMs: Math.round(performance.now() - startedAt),
  });
  await Bun.write(resolve(outputRoot, proofName), `${JSON.stringify(proof, null, 2)}\n`);
  console.log(JSON.stringify({ output: outputRoot, concepts: receipts.length, errors: browserErrors.length,
    proof: proofName, elapsedMs: proof.elapsedMs }));
} finally {
  await closeOwnedBrowser();
  await server.stop(true);
  const canonicalProfile = resolve(profile);
  if (!canonicalProfile.startsWith(resolvedTemporaryRoot) || !canonicalProfile.split(sep).at(-1)?.startsWith("capture-profile-")) {
    throw new Error("Refusing to remove an unowned capture profile");
  }
  await rm(canonicalProfile, { recursive: true, force: true });
}
