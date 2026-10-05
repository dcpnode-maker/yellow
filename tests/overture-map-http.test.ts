import { describe, expect, it } from "bun:test";
import { createOvertureMapReader, OVERTURE_SOURCES } from "../src/http/overture-map";

const request = (range?: string) => new Request("http://localhost/map", { headers: range ? { range, authorization: "Bearer must-not-forward", cookie: "private=yes" } : {} });
const upstream = (bytes: Uint8Array<ArrayBuffer>, start = 0, etag: string = OVERTURE_SOURCES.places.etag) => new Response(bytes, { status: 206, headers: {
  "content-range": `bytes ${start}-${start + bytes.length - 1}/${OVERTURE_SOURCES.places.bytes}`,
  "content-length": String(bytes.length), etag,
} });

describe("Overture fixed public range reader", () => {
  it("refuses missing, suffix, multi, oversized and unsafe ranges without network", async () => {
    let calls = 0;
    const read = createOvertureMapReader({ fetcher: async () => { calls++; throw Error("no call"); } });
    for (const range of [undefined, "bytes=-100", "bytes=0-", "bytes=0-1,4-6", "bytes=0-8388608", "bytes=9007199254740992-9007199254740993", "bytes=3-1"]) {
      expect((await read(request(range), "2026-09-23.0", "places.pmtiles")).status).toBe(416);
    }
    expect((await read(request("bytes=0-2"), "latest", "places.pmtiles")).status).toBe(404);
    expect((await read(request("bytes=0-2"), "2026-09-23.0", "https://evil.test")).status).toBe(404);
    expect(calls).toBe(0);
  });
  it("returns exact pinned bytes, forwards no credentials, reuses bounded memory", async () => {
    let calls = 0;
    const read = createOvertureMapReader({ fetcher: async (url, options) => {
      calls++;
      expect(String(url)).toBe("https://overturemaps-extras-us-west-2.s3.us-west-2.amazonaws.com/tiles/2026-09-23.0/places.pmtiles");
      expect(options?.credentials).toBe("omit");
      expect(options?.redirect).toBe("error");
      const headers = new Headers(options?.headers);
      expect(headers.get("range")).toBe("bytes=0-2");
      expect(headers.get("authorization")).toBeNull();
      expect(headers.get("cookie")).toBeNull();
      return upstream(new Uint8Array([80, 77, 84]));
    } });
    for (let i = 0; i < 2; i++) {
      const response = await read(request("bytes=0-2"), "2026-09-23.0", "places.pmtiles");
      expect(response.status).toBe(206);
      expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([80, 77, 84]);
      expect(response.headers.get("content-range")).toBe(`bytes 0-2/${OVERTURE_SOURCES.places.bytes}`);
    }
    expect(calls).toBe(1);
  });
  it("fails closed for unpinned, full-file, truncated and inconsistent upstream responses", async () => {
    for (const response of [new Response("bulk data"), upstream(new Uint8Array(3), 1), upstream(new Uint8Array(3), 0, '"changed"'), new Response(new Uint8Array(2), { status: 206, headers: { "content-range": `bytes 0-2/${OVERTURE_SOURCES.places.bytes}`, etag: OVERTURE_SOURCES.places.etag } })]) {
      const read = createOvertureMapReader({ fetcher: async () => response });
      expect((await read(request("bytes=0-2"), "2026-09-23.0", "places.pmtiles")).status).toBe(502);
    }
  });
  it("caps concurrent cold reads and recovers from failures", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const read = createOvertureMapReader({ concurrency: 1, queueLimit: 0, fetcher: async () => { await gate; return upstream(new Uint8Array(3)); } });
    const first = read(request("bytes=0-2"), "2026-09-23.0", "places.pmtiles");
    expect((await read(request("bytes=3-5"), "2026-09-23.0", "places.pmtiles")).status).toBe(503);
    release();
    expect((await first).status).toBe(206);
  });
  it("queues bounded ordinary tile bursts without increasing network concurrency", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let calls = 0;
    const read = createOvertureMapReader({ concurrency: 1, queueLimit: 1, fetcher: async () => { calls++; await gate; return upstream(new Uint8Array(3)); } });
    const first = read(request("bytes=0-2"), "2026-09-23.0", "places.pmtiles");
    const second = read(request("bytes=0-2"), "2026-09-23.0", "places.pmtiles");
    expect(calls).toBe(1);
    expect((await read(request("bytes=0-2"), "2026-09-23.0", "places.pmtiles")).status).toBe(503);
    release();
    expect((await first).status).toBe(206);
    expect((await second).status).toBe(206);
  });
  it("removes cancelled queued reads and never fetches their bytes", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let calls = 0;
    const read = createOvertureMapReader({ concurrency: 1, queueLimit: 1, fetcher: async () => { calls++; await gate; return upstream(new Uint8Array(3)); } });
    const first = read(request("bytes=0-2"), "2026-09-23.0", "places.pmtiles");
    const controller = new AbortController();
    const second = read(new Request("http://localhost/map", { headers: { range: "bytes=3-5" }, signal: controller.signal }), "2026-09-23.0", "places.pmtiles");
    controller.abort();
    expect((await second).status).toBe(503);
    release();
    expect((await first).status).toBe(206);
    expect(calls).toBe(1);
  });
  it("stops oversized streamed bodies without caching them", async () => {
    let calls = 0;
    const read = createOvertureMapReader({ fetcher: async () => {
      calls++;
      return new Response(new Uint8Array(4), { status: 206, headers: { "content-range": `bytes 0-2/${OVERTURE_SOURCES.places.bytes}`, etag: OVERTURE_SOURCES.places.etag } });
    } });
    expect((await read(request("bytes=0-2"), "2026-09-23.0", "places.pmtiles")).status).toBe(502);
    expect((await read(request("bytes=0-2"), "2026-09-23.0", "places.pmtiles")).status).toBe(502);
    expect(calls).toBe(2);
  });
  it("evicts data once its memory or age budget is exceeded", async () => {
    let calls = 0; let time = 0;
    const read = createOvertureMapReader({ cacheBytes: 3, now: () => time, fetcher: async (_url, options) => {
      calls++;
      return upstream(new Uint8Array(3), Number(new Headers(options?.headers).get("range")?.match(/\d+/)?.[0]));
    } });
    await read(request("bytes=0-2"), "2026-09-23.0", "places.pmtiles");
    await read(request("bytes=3-5"), "2026-09-23.0", "places.pmtiles");
    await read(request("bytes=0-2"), "2026-09-23.0", "places.pmtiles");
    expect(calls).toBe(3);
    time = 301_000;
    await read(request("bytes=0-2"), "2026-09-23.0", "places.pmtiles");
    expect(calls).toBe(4);
  });
});
