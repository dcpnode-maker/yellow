import { expect, test } from "bun:test";
import type { AuthSnapshot } from "../frontend/yellow/src/auth-session";
import { createHostCalendarReader, HOST_CALENDAR_READ_BOUNDS, type HostCalendarSelection } from "../frontend/yellow/src/host-calendar-read-foundation";
const id = (n: number) => `00000000-0000-0000-0000-${n.toString(16).padStart(12, "0")}`;
const tenant = id(1), property = id(2), type = id(3), unit = id(4), space = id(5), plan = id(7);
const SECRET = "synthetic-protected-session-token";
function pick(price = true): HostCalendarSelection { return { propertyId: property, timezone: "Asia/Kolkata", unitTypeId: type, sellableUnitId: unit,
  price: price ? { ratePlanId: plan, occupancy: 2, channelCode: "direct", stayDate: "2024-03-10" } : null }; }
function inventory(): any { return {
  unitTypes: [{ id: type, tenantId: tenant, propertyNode: property, code: "STD", name: "Standard", profileKey: "hotel", baseOccupancy: 2, maxOccupancy: 4, attrs: {}, sortOrder: 0 }],
  spaces: [{ id: space, tenantId: tenant, propertyNode: property, code: "101", profileKey: "hotel", capacity: 1, maxOccupancy: 4, floor: null, areaSqm: null, genderPolicy: null, attrs: {}, status: "active" }],
  sellableUnits: [{ id: unit, tenantId: tenant, propertyNode: property, unitTypeId: type, unitTypeCode: "STD", name: "Room 101", status: "active", spaces: [{ spaceId: space, code: "101", claimMode: "exclusive" }] }] };
}
function price(): any { return { ratePrice: { id: id(8), tenantId: tenant, propertyNode: property, ratePlanId: plan, unitTypeId: type,
  stayStart: "2024-03-01", stayEnd: "2024-04-01", dowMask: 127, currency: "INR", recordedAt: "2024-02-29T20:00:00.000Z", supersededBy: null,
  pricing: { occupancy: { "2": "12000" }, extraAdultMinor: null, extraChildren: [] } } }; }
function auth() {
  let snapshot: AuthSnapshot = Object.freeze({ status: "authenticated", principal: Object.freeze({ tenantId: tenant, actorId: id(20), displayName: "Synthetic" }),
    properties: Object.freeze([{ id: property, name: "P1", timezone: "Asia/Kolkata" }, { id: id(30), name: "P2", timezone: "UTC" }]) });
  let token = SECRET; const listeners = new Set<() => void>();
  return { getSnapshot: () => snapshot, session: async () => token,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    change: (update: Partial<AuthSnapshot>) => { snapshot = Object.freeze({ ...snapshot, ...update }); for (const listener of listeners) listener(); },
    token: (next: string) => { token = next; }, subscribers: () => listeners.size };
}
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
function heldBody(body: unknown, status = 200) {
  let controller!: ReadableStreamDefaultController<Uint8Array>; let cancelled = false;
  const response = new Response(new ReadableStream<Uint8Array>({ start(value) { controller = value; }, cancel() { cancelled = true; } }),
    { status, headers: { "content-type": "application/json" } });
  return { response, finish() { if (!cancelled) { controller.enqueue(new TextEncoder().encode(JSON.stringify(body))); controller.close(); } }, cancelled: () => cancelled };
}
async function until(predicate: () => boolean) { for (let i = 0; i < 100 && !predicate(); i++) await Bun.sleep(1); expect(predicate()).toBe(true); }
test("two exact sequential GETs retain type metadata and nonsecret context, with no unsupported query fields", async () => {
  const session = auth(), calls: Array<{ path: string; init: RequestInit }> = []; let running = 0, maximum = 0;
  const reader = createHostCalendarReader({ auth: session, transport: async (path, init) => {
    calls.push({ path, init }); maximum = Math.max(maximum, ++running); await Promise.resolve(); running--;
    return Response.json(path.endsWith("/inventory") ? inventory() : price());
  } });
  try {
    reader.select(pick()); const result = await reader.read(); expect(result.state).toBe("ready");
    expect(calls.map(c => c.path)).toEqual([`/api/v1/properties/${property}/inventory`,
      `/api/v1/properties/${property}/rate-prices/current?ratePlanId=${plan}&unitTypeId=${type}&stayDate=2024-03-10`]);
    expect(maximum).toBe(1); expect(calls).toHaveLength(HOST_CALENDAR_READ_BOUNDS.requests);
    for (const { init } of calls) {
      expect(init.method).toBe("GET"); expect(init.body).toBeUndefined(); expect(init.redirect).toBe("error"); expect(init.cache).toBe("no-store");
      expect(new Headers(init.headers).get("authorization")).toBe("Bearer " + SECRET);
    }
    if (result.state === "ready") {
      expect(result.cacheContext).not.toContain(SECRET); expect(result.cacheContext).toContain(tenant);
      expect(result.price.state).toBe("known"); expect(result.selection.price!.channelCode).toBe("direct");
      expect(Object.isFrozen(result)).toBe(true);
    }
  } finally { reader.dispose(); }
  expect(session.subscribers()).toBe(0);
});
test("inventory-only selection issues one GET and explicitly leaves price unknown", async () => {
  let calls = 0; const reader = createHostCalendarReader({ auth: auth(), transport: async () => { calls++; return Response.json(inventory()); } });
  try { reader.select(pick(false)); const result = await reader.read(); expect(calls).toBe(1);
    if (result.state !== "ready") throw new Error("expected ready inventory");
    expect(result.price).toEqual({ state: "unknown", reason: "not-requested", source: "rate-price" });
  } finally { reader.dispose(); }
});
test("ungranted, duplicate-grant, timezone-mismatched and unauthenticated selections make no requests", async () => {
  for (const mutate of [(a: ReturnType<typeof auth>) => a.change({ properties: [] }),
    (a: ReturnType<typeof auth>) => a.change({ properties: [a.getSnapshot().properties[0]!, a.getSnapshot().properties[0]!] }),
    (a: ReturnType<typeof auth>) => a.change({ properties: [{ id: property, name: "P", timezone: "UTC" }] }),
    (a: ReturnType<typeof auth>) => a.change({ status: "expired" })]) {
    const session = auth(); let calls = 0; const reader = createHostCalendarReader({ auth: session, transport: async () => { calls++; return Response.json(inventory()); } });
    try { reader.select(pick()); mutate(session); const result = await reader.read(); expect(result.state).toBe("unknown"); expect(calls).toBe(0); }
    finally { reader.dispose(); }
  }
});
for (const status of [401, 403, 404, 500]) test("HTTP " + status + " returns explicit unknown with no fallback or earlier partial inventory", async () => {
  const calls: string[] = []; const reader = createHostCalendarReader({ auth: auth(), transport: async path => {
    calls.push(path); return path.endsWith("/inventory") ? Response.json(inventory()) : Response.json({ detail: SECRET }, { status });
  } });
  try { reader.select(pick()); const result = await reader.read(); expect(result).toEqual({ state: "unknown", source: "rate-price", status,
    reason: status === 401 ? "unauthenticated" : status === 403 ? "denied" : status === 404 ? "incomplete" : "unavailable" });
    expect(calls).toHaveLength(2); expect(JSON.stringify(result)).not.toContain(SECRET); expect("inventory" in result).toBe(false);
  } finally { reader.dispose(); }
});
test("malformed/partial inventory stops before price and never publishes a partial body", async () => {
  for (const response of [Response.json({ unitTypes: [], spaces: [] }), Response.json({ ...inventory(), limited: true }),
    new Response('{"unitTypes":', { headers: { "content-type": "application/json" } }), new Response("{}", { headers: { "content-type": "text/html" } })]) {
    let calls = 0; const reader = createHostCalendarReader({ auth: auth(), transport: async () => { calls++; return response; } });
    try { reader.select(pick()); const result = await reader.read(); expect(result.state).toBe("unknown"); expect(calls).toBe(1); expect("inventory" in result).toBe(false); }
    finally { reader.dispose(); }
  }
});
test("response byte cap applies while streaming and does not rely on content-length", async () => {
  for (const length of [null, HOST_CALENDAR_READ_BOUNDS.inventoryBytes + 1]) {
    const headers = new Headers({ "content-type": "application/json" }); if (length !== null) headers.set("content-length", String(length));
    const reader = createHostCalendarReader({ auth: auth(), transport: async () => new Response("x".repeat(HOST_CALENDAR_READ_BOUNDS.inventoryBytes + 1), { headers }) });
    try { reader.select(pick()); expect(await reader.read()).toEqual({ state: "unknown", reason: "incomplete", source: "inventory", status: null }); }
    finally { reader.dispose(); }
  }
});
test("network errors are sanitized and never expose token or raw cause", async () => {
  const reader = createHostCalendarReader({ auth: auth(), transport: async () => { throw new Error(SECRET + " https://private.invalid"); } });
  try { reader.select(pick()); const result = await reader.read(); expect(result.state).toBe("unknown"); expect(JSON.stringify(result)).not.toContain(SECRET); expect(JSON.stringify(result)).not.toContain("private.invalid"); }
  finally { reader.dispose(); }
});
test("property A to B to A fences late responses even when the selected values return to A", async () => {
  const response = deferred<Response>(); let called = false;
  const reader = createHostCalendarReader({ auth: auth(), transport: async () => { called = true; return response.promise; } });
  try {
    reader.select(pick()); const pending = reader.read(); await until(() => called);
    reader.select({ ...pick(), propertyId: id(30), timezone: "UTC" }); reader.select(pick());
    response.resolve(Response.json(inventory())); expect(await pending).toEqual({ state: "unknown", reason: "stale", source: "context", status: null });
  } finally { reader.dispose(); }
});
for (const reason of ["logout", "grant-revoked", "session-replaced", "timezone-changed", "token-renewed"]) {
  test(reason + " during complete-body wait cannot publish earlier evidence", async () => {
    const session = auth(), body = heldBody(inventory()); let called = false;
    const reader = createHostCalendarReader({ auth: session, transport: async () => { called = true; return body.response; } });
    try {
      reader.select(pick()); const pending = reader.read(); await until(() => called); await Bun.sleep(1);
      if (reason === "logout") session.change({ status: "expired" });
      else if (reason === "grant-revoked") session.change({ properties: [] });
      else if (reason === "session-replaced") session.change({ principal: { ...session.getSnapshot().principal!, actorId: id(90) } });
      else if (reason === "timezone-changed") session.change({ properties: [{ id: property, name: "P", timezone: "UTC" }] });
      else session.token("renewed-synthetic-token");
      body.finish(); const result = await pending; expect(result).toEqual({ state: "unknown", reason: "stale", source: "context", status: null });
      expect("inventory" in result).toBe(false);
    } finally { reader.dispose(); }
  });
}
test("denial body completion is fenced before classifying the old HTTP403", async () => {
  const session = auth(), body = heldBody({ detail: SECRET }, 403); let called = false;
  const reader = createHostCalendarReader({ auth: session, transport: async () => { called = true; return body.response; } });
  try {
    reader.select(pick()); const pending = reader.read(); await until(() => called);
    session.change({ properties: [] }); body.finish(); expect(await pending).toEqual({ state: "unknown", reason: "stale", source: "context", status: null });
  } finally { reader.dispose(); }
});
test("cancellation before request and during body is bounded and forwarded", async () => {
  for (const before of [true, false]) {
    const caller = new AbortController(), body = heldBody(inventory()); let requestSignal: AbortSignal | null = null, called = false;
    const reader = createHostCalendarReader({ auth: auth(), transport: async (_path, init) => { called = true; requestSignal = init.signal!; return body.response; } });
    try {
      reader.select(pick()); if (before) caller.abort(); const pending = reader.read(caller.signal);
      if (!before) { await until(() => called); await Bun.sleep(1); caller.abort(); }
      expect(await pending).toEqual({ state: "unknown", reason: "cancelled", source: "context", status: null });
      if (before) expect(called).toBe(false); else { expect((requestSignal as AbortSignal | null)?.aborted).toBe(true); expect(body.cancelled()).toBe(true); }
    } finally { reader.dispose(); }
  }
});
test("single-flight concurrency refuses a second read without starting requests", async () => {
  const response = deferred<Response>(); let calls = 0;
  const reader = createHostCalendarReader({ auth: auth(), transport: async () => { calls++; return response.promise; } });
  try {
    reader.select(pick(false)); const first = reader.read(); await until(() => calls === 1);
    expect(await reader.read()).toEqual({ state: "unknown", reason: "busy", source: "context", status: null });
    expect(calls).toBe(1); response.resolve(Response.json(inventory())); expect((await first).state).toBe("ready");
  } finally { reader.dispose(); }
});
test("deadline also bounds an uncooperative transport and session provider", async () => {
  for (const stage of ["transport", "session"]) {
    const session = auth(), never = new Promise<never>(() => {});
    const reader = createHostCalendarReader({ auth: stage === "session" ? { ...session, session: () => never } : session,
      timeoutMs: 15, transport: async () => never });
    try { reader.select(pick()); expect(await reader.read()).toEqual({ state: "unknown", reason: "timeout", source: "context", status: null }); }
    finally { reader.dispose(); }
  }
});
test("invalid replacement and disposal fence pending work and remove subscriptions", async () => {
  const session = auth(), response = deferred<Response>(); let called = false;
  const reader = createHostCalendarReader({ auth: session, transport: async () => { called = true; return response.promise; } });
  reader.select(pick()); const pending = reader.read(); await until(() => called);
  expect(() => reader.select({ ...pick(), propertyId: "bad" })).toThrow();
  response.resolve(Response.json(inventory())); expect((await pending).state).toBe("unknown");
  reader.dispose(); reader.dispose(); expect(session.subscribers()).toBe(0); expect((await reader.read()).state).toBe("unknown");
});
test("empty HTTP403 is still denied after scope checks without body data", async () => {
  const reader = createHostCalendarReader({ auth: auth(), transport: async () => new Response(null, { status: 403 }) });
  try { reader.select(pick()); expect(await reader.read()).toEqual({ state: "unknown", reason: "denied", source: "inventory", status: 403 }); }
  finally { reader.dispose(); }
});
test("cache contexts cannot collide across reader instances or independently completed reads", async () => {
  const session = auth(), transport = async () => Response.json(inventory());
  const one = createHostCalendarReader({ auth: session, transport }), two = createHostCalendarReader({ auth: session, transport });
  try {
    one.select(pick(false)); two.select(pick(false));
    const a = await one.read(), b = await one.read(), c = await two.read();
    if (a.state !== "ready" || b.state !== "ready" || c.state !== "ready") throw new Error("expected ready");
    expect(new Set([a.cacheContext, b.cacheContext, c.cacheContext]).size).toBe(3);
    expect(a.cacheContext + b.cacheContext + c.cacheContext).not.toContain(SECRET);
  } finally { one.dispose(); two.dispose(); }
});
