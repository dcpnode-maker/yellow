import { expect, test } from "bun:test";
import {
  acquireHousekeepingDiscrepancyFlight,
  createHousekeepingDiscrepancyClient,
  HousekeepingDiscrepancyRequestError,
  runHousekeepingDiscrepancyAttempt,
  validateHousekeepingDiscrepancyList,
  validateHousekeepingDiscrepancyReport,
  type HousekeepingDiscrepancyAttempt,
} from "../frontend/yellow/src/workspaces/housekeeping-discrepancy-client";

const property = "00000000-0000-0000-0000-000000007101";
const room = "00000000-0000-0000-0000-000000007102";
const actor = "00000000-0000-0000-0000-000000007103";
const discrepancy = Object.freeze({
  spaceId: room, spaceCode: "101", floor: "1", kind: "sleep" as const,
  reported: "occupied", systemState: "vacant", reportedBy: actor,
  reportedAt: "2026-09-25T08:00:00.000Z",
});
const attempt: HousekeepingDiscrepancyAttempt = Object.freeze({
  propertyId: property,
  draft: Object.freeze({ spaceId: room, observedPresence: "occupied", observedPersons: 2 }),
  key: "order710-exact-attempt-001",
});
const response = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json" },
});

test("validates the exact observation shape and count normalization", () => {
  expect(validateHousekeepingDiscrepancyReport({ spaceId: room, observedPresence: "vacant", observedPersons: null }))
    .toEqual({ spaceId: room, observedPresence: "vacant", observedPersons: null });
  expect(() => validateHousekeepingDiscrepancyReport({ spaceId: room, observedPresence: "vacant", observedPersons: 0 })).toThrow();
  expect(() => validateHousekeepingDiscrepancyReport({ spaceId: room, observedPresence: "occupied", observedPersons: 100 })).toThrow();
  expect(() => validateHousekeepingDiscrepancyReport({ spaceId: room, observedPresence: "occupied", observedPersons: null })).toThrow();
  expect(() => validateHousekeepingDiscrepancyReport({ spaceId: room, observedPresence: "vacant", observedPersons: null, reservationId: room })).toThrow();
});

test("validates minimized bounded read evidence and rejects malformed/overfull lists", () => {
  expect(validateHousekeepingDiscrepancyList({ discrepancies: [discrepancy] })).toEqual([discrepancy]);
  expect(() => validateHousekeepingDiscrepancyList({ discrepancies: [{ ...discrepancy, id: room }] })).toThrow();
  expect(() => validateHousekeepingDiscrepancyList({ discrepancies: Array.from({ length: 101 }, () => discrepancy) })).toThrow();
});

test("GET is read-only and POST carries the exact frozen observation and request key", async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const client = createHousekeepingDiscrepancyClient(async () => "test-token", async (url, init) => {
    calls.push({ url: String(url), init: init ?? {} });
    return init?.method === "POST" ? response(201, { discrepancy: null, created: false, replayed: false }) : response(200, { discrepancies: [] });
  });
  await client.list(property);
  await client.report(property, attempt.draft, attempt.key);
  expect(calls[0]?.init.method).toBe("GET");
  expect(calls[1]?.init.method).toBe("POST");
  expect((calls[1]?.init.headers as Record<string, string>)?.["idempotency-key"]).toBe(attempt.key);
  expect(JSON.parse(String(calls[1]?.init.body))).toEqual(attempt.draft);
  expect(calls.every((call) => call.url.endsWith(`/properties/${property}/housekeeping/discrepancies`))).toBe(true);
});

test("matching observation produces a no-op, refreshes current conditions and reports no creation", async () => {
  const client = createHousekeepingDiscrepancyClient(async () => "token", async (_url, init) =>
    init?.method === "POST" ? response(201, { discrepancy: null, created: false, replayed: false }) : response(200, { discrepancies: [] }));
  let refreshed = 0;
  const result = await runHousekeepingDiscrepancyAttempt({ client, attempt, isCurrent: () => true, onRefresh: async () => { refreshed += 1; } });
  expect(result.receipt).toEqual({ discrepancy: null, created: false, replayed: false });
  expect(result.rows).toEqual([]);
  expect(refreshed).toBe(1);
});

test("created and existing mismatch receipts must match the exact submitted room observation and readback", async () => {
  const createdAttempt: HousekeepingDiscrepancyAttempt = { ...attempt, draft: { ...attempt.draft, observedPersons: 2 } };
  const client = createHousekeepingDiscrepancyClient(async () => "token", async (_url, init) => init?.method === "POST"
    ? response(201, { discrepancy, created: true, replayed: false })
    : response(200, { discrepancies: [discrepancy] }));
  const result = await runHousekeepingDiscrepancyAttempt({ client, attempt: createdAttempt, isCurrent: () => true, onRefresh: async () => {} });
  expect(result.receipt.created).toBe(true);
  const wrongRoom = createHousekeepingDiscrepancyClient(async () => "token", async (_url, init) => init?.method === "POST"
    ? response(201, { discrepancy: { ...discrepancy, spaceId: actor }, created: true, replayed: false })
    : response(200, { discrepancies: [] }));
  await expect(runHousekeepingDiscrepancyAttempt({ client: wrongRoom, attempt, isCurrent: () => true, onRefresh: async () => {} }))
    .rejects.toMatchObject({ uncertain: true });
  const missingReadback = createHousekeepingDiscrepancyClient(async () => "token", async (_url, init) => init?.method === "POST"
    ? response(201, { discrepancy, created: false, replayed: false })
    : response(200, { discrepancies: [] }));
  await expect(runHousekeepingDiscrepancyAttempt({ client: missingReadback, attempt, isCurrent: () => true, onRefresh: async () => {} }))
    .rejects.toMatchObject({ uncertain: true });
});

test("403 and 409 are definite on first attempt while 5xx retains an uncertain same-key retry", async () => {
  for (const status of [403, 409]) {
    const client = createHousekeepingDiscrepancyClient(async () => "token", async () => response(status, {}));
    await expect(client.report(property, attempt.draft, attempt.key)).rejects.toMatchObject({ status, uncertain: false });
  }
  const keys: string[] = [];
  let posts = 0;
  const client = createHousekeepingDiscrepancyClient(async () => "token", async (_url, init) => {
    if (init?.method === "POST") {
      posts += 1;
      keys.push((init.headers as Record<string, string>)["idempotency-key"]!);
      return posts === 1 ? response(503, {}) : response(201, { discrepancy: null, created: false, replayed: true });
    }
    return response(200, { discrepancies: [] });
  });
  await expect(client.report(property, attempt.draft, attempt.key)).rejects.toMatchObject({ status: 503, uncertain: true });
  const replay = await client.report(property, attempt.draft, attempt.key);
  expect(replay.replayed).toBe(true);
  expect(keys).toEqual([attempt.key, attempt.key]);
});

test("auth failure before fetch is definite, but a prior unknown attempt remains a caller-owned frozen key", async () => {
  let fetches = 0;
  const client = createHousekeepingDiscrepancyClient(async () => { throw new Error("private credential detail"); }, async () => { fetches += 1; return response(200, {}); });
  await expect(client.report(property, attempt.draft, attempt.key)).rejects.toMatchObject({ status: 401, uncertain: false });
  expect(fetches).toBe(0);
  const error = await client.report(property, attempt.draft, attempt.key).catch((cause: unknown) => cause);
  expect((error as Error).message).not.toContain("private credential detail");
});

test("property change or unmount after POST prevents stale readback, and change before auth prevents POST", async () => {
  let current = true;
  let posts = 0;
  let reads = 0;
  const client = createHousekeepingDiscrepancyClient(async () => { current = false; return "token"; }, async (_url, init) => {
    if (init?.method === "POST") posts += 1; else reads += 1;
    return response(201, { discrepancy: null, created: false, replayed: false });
  });
  await expect(runHousekeepingDiscrepancyAttempt({ client, attempt, isCurrent: () => current, onRefresh: async () => {} }))
    .rejects.toMatchObject({ uncertain: false });
  expect(posts).toBe(0);
  current = true;
  const second = createHousekeepingDiscrepancyClient(async () => "token", async (_url, init) => {
    if (init?.method === "POST") { current = false; return response(201, { discrepancy: null, created: false, replayed: false }); }
    reads += 1;
    return response(200, { discrepancies: [] });
  });
  await expect(runHousekeepingDiscrepancyAttempt({ client: second, attempt, isCurrent: () => current, onRefresh: async () => {} }))
    .rejects.toMatchObject({ uncertain: true });
  expect(posts).toBe(0);
  expect(reads).toBe(0);
});

test("component guards confirmation and preserves the recovery surface while parent actions stay locked", async () => {
  const component = await Bun.file("frontend/yellow/src/workspaces/HousekeepingDiscrepancyWorkbench.tsx").text();
  expect(component).toContain("if (!retry && !confirmed)");
  expect(component).toContain("if (!retry && !listLoaded)");
  expect(component).toContain("Refresh the unresolved discrepancy list before reporting");
  expect(component).toContain("inFlight.current");
  expect(component).toContain("attempt.current = pending");
  expect(component).toContain("if (!retainParentLock) callbacks.current.onBusyChange?.(false)");
  expect(component).toContain("failure.uncertain || uncertain");
  expect(component).toContain('data-lifecycle-recovery={posting || uncertain ? "true" : undefined}');
  expect(component).toContain('onRefresh: () => callbacks.current.onRefresh()');
  expect(component).not.toContain("useEffect(() => {\n    void submit");
  const effect = component.slice(component.indexOf("useEffect(() =>"), component.indexOf("const read = async"));
  expect(effect).not.toContain(".report(");
});

test("duplicate submits cannot acquire a second in-flight report", () => {
  const lock = { current: false };
  expect(acquireHousekeepingDiscrepancyFlight(lock)).toBe(true);
  expect(acquireHousekeepingDiscrepancyFlight(lock)).toBe(false);
  lock.current = false;
  expect(acquireHousekeepingDiscrepancyFlight(lock)).toBe(true);
});
