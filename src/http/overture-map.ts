/** Public map bytes only. Never accepts an upstream URL, credentials or hotel data. */
export const OVERTURE_RELEASE = "2026-09-23.0";
export const OVERTURE_SOURCES = {
  places: { bytes: 18_392_360_113, etag: '"f5662b4fba7d9e30b44e9a6721b52b2d-69"' },
  divisions: { bytes: 19_929_576_927, etag: '"38f1239639fdb952d5eed3aea789e14b-75"' },
} as const;
const ORIGIN = "https://overturemaps-extras-us-west-2.s3.us-west-2.amazonaws.com";
const MAX_RANGE = 8 * 1024 * 1024;
const CACHE_AGE = 300_000;
type Fetcher = (url: string, options: RequestInit) => Promise<Response>;
type CachedRange = { body: Uint8Array<ArrayBuffer>; etag: string; range: string; at: number };

export function createOvertureMapReader(options: {
  fetcher?: Fetcher; now?: () => number; cacheBytes?: number; concurrency?: number; queueLimit?: number;
} = {}) {
  const fetcher: Fetcher = options.fetcher ?? fetch;
  const now = options.now ?? Date.now;
  const cacheLimit = Math.min(options.cacheBytes ?? 16 * 1024 * 1024, 16 * 1024 * 1024);
  const concurrency = Math.min(options.concurrency ?? 4, 4);
  const queueLimit = Math.min(options.queueLimit ?? 32, 32);
  const waiting: Array<() => void> = [];
  const cache = new Map<string, CachedRange>();
  let cachedBytes = 0;
  let inFlight = 0;
  const failure = (status: number, text: string) => new Response(text, { status, headers: { "cache-control": "no-store", ...(status === 503 ? { "retry-after": "2" } : {}) } });
  const reply = (value: CachedRange) => new Response(value.body, { status: 206, headers: {
    "content-type": "application/octet-stream", "content-range": value.range,
    "content-length": String(value.body.byteLength), etag: value.etag,
    "accept-ranges": "bytes", "cache-control": "public, max-age=300, no-transform",
  } });
  const evict = (key: string, value: CachedRange) => { cache.delete(key); cachedBytes -= value.body.byteLength; };

  return async (request: Request, release: string, filename: string): Promise<Response> => {
    const started = performance.now();
    if (release !== OVERTURE_RELEASE || (filename !== "places.pmtiles" && filename !== "divisions.pmtiles")) return failure(404, "Map release not admitted");
    const theme = filename === "places.pmtiles" ? "places" : "divisions";
    const source = OVERTURE_SOURCES[theme];
    const match = /^bytes=(\d{1,15})-(\d{1,15})$/.exec(request.headers.get("range") ?? "");
    if (!match) return failure(416, "A single bounded byte range is required");
    const start = Number(match[1]); const requestedEnd = Number(match[2]);
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(requestedEnd) || requestedEnd < start || requestedEnd - start + 1 > MAX_RANGE || start >= source.bytes) return failure(416, "Map byte range exceeds the limit");
    const end = Math.min(requestedEnd, source.bytes - 1);
    const length = end - start + 1;
    const range = `bytes ${start}-${end}/${source.bytes}`;
    const key = `${theme}:${start}:${end}`;
    for (const [oldKey, value] of cache) if (now() - value.at >= CACHE_AGE) evict(oldKey, value);
    const hit = cache.get(key);
    if (hit) { cache.delete(key); cache.set(key, hit); return reply(hit); }
    if (inFlight >= concurrency) {
      if (waiting.length >= queueLimit || request.signal.aborted) return failure(503, "Map is busy; retry shortly");
      const acquired = await new Promise<boolean>((resolve) => {
        let settled = false;
        const finish = (granted: boolean) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          request.signal.removeEventListener("abort", cancelled);
          const index = waiting.indexOf(ready);
          if (index !== -1) waiting.splice(index, 1);
          if (granted) inFlight++;
          resolve(granted);
        };
        const ready = () => finish(true);
        const cancelled = () => finish(false);
        const timer = setTimeout(cancelled, 30_000);
        request.signal.addEventListener("abort", cancelled, { once: true });
        waiting.push(ready);
        if (request.signal.aborted) cancelled();
      });
      if (!acquired) return failure(503, "Map is busy; retry shortly");
    } else inFlight++;
    const controller = new AbortController();
    const abort = () => controller.abort();
    request.signal.addEventListener("abort", abort, { once: true });
    if (request.signal.aborted) abort();
    const timeout = setTimeout(abort, Math.max(1, 30_000 - (performance.now() - started)));
    let upstream: Response | undefined;
    try {
      const queuedHit = cache.get(key);
      if (queuedHit && now() - queuedHit.at < CACHE_AGE) return reply(queuedHit);
      upstream = await fetcher(`${ORIGIN}/tiles/${OVERTURE_RELEASE}/${filename}`, {
        headers: { range: `bytes=${start}-${end}`, "accept-encoding": "identity" },
        credentials: "omit", redirect: "error", signal: controller.signal,
      });
      const contentLength = upstream.headers.get("content-length");
      if (upstream.status !== 206 || upstream.headers.get("content-range") !== range || upstream.headers.get("etag") !== source.etag || (contentLength !== null && Number(contentLength) !== length) || !upstream.body) {
        await upstream.body?.cancel();
        return failure(502, "Publisher map version or range could not be verified");
      }
      const reader = upstream.body.getReader();
      const body = new Uint8Array(length);
      let offset = 0;
      try {
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          if (offset + part.value.byteLength > length) { await reader.cancel(); return failure(502, "Publisher map range exceeded its bounds"); }
          body.set(part.value, offset); offset += part.value.byteLength;
        }
      } finally { reader.releaseLock(); }
      if (offset !== length) return failure(502, "Publisher map range was incomplete");
      const value: CachedRange = { body, etag: source.etag, range, at: now() };
      if (length <= cacheLimit) {
        while (cachedBytes + length > cacheLimit) {
          const oldest = cache.entries().next().value;
          if (!oldest) break;
          evict(oldest[0], oldest[1]);
        }
        const previous = cache.get(key);
        if (previous) evict(key, previous);
        cache.set(key, value); cachedBytes += length;
      }
      return reply(value);
    } catch {
      controller.abort();
      return failure(502, "Publisher map is unavailable; retry this area");
    } finally {
      clearTimeout(timeout);
      request.signal.removeEventListener("abort", abort);
      inFlight--;
      waiting.shift()?.();
    }
  };
}
