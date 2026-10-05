import { expect, test } from "bun:test";
import { cashierReceiptMatches, cashierSnapshotMatches, cashDrawerDenominations, createCashDrawerController, type CashDrawerSnapshot, type CashDrawerFetcher } from "../frontend/yellow/src/workspaces/cash-drawer-client";

const p = "71600000-0000-4000-8000-000000000001";
const drawerId = "71600000-0000-4000-8000-000000000002";
const sessionId = "71600000-0000-4000-8000-000000000003";
const openingCountId = "71600000-0000-4000-8000-000000000004";
const countId = "71600000-0000-4000-8000-000000000005";
const approvalId = "71600000-0000-4000-8000-000000000006";
const actorId = "71600000-0000-4000-8000-000000000007";
const stamp = "2026-09-25T10:00:00.000Z";
const reply = (status: number, body?: unknown, replayed?: boolean) => new Response(body === undefined ? null : JSON.stringify(body), {
  status, headers: replayed === undefined ? {} : { "idempotency-replayed": String(replayed) },
});
const count = { countId, attemptNo: 1, countedAt: stamp, countedBy: actorId };
function snapshot(open = false, counted = false, supervised = false): CashDrawerSnapshot {
  return { drawers: [{ drawerId, id: drawerId, propertyNode: p, code: "FRONT", name: "Front desk", currency: "USD",
    denominations: [{ denominationMinor: "100" }, { denominationMinor: "500" }], canOpen: !supervised, canCount: !supervised, canClose: true, supervised,
    session: open ? { sessionId, businessDate: "2026-09-25", openedAt: stamp, openedBy: actorId, openingCountId,
      latestCount: counted ? count : null, countHistory: supervised && counted ? [count] : [] } : null }] };
}
function setup(fetcher: CashDrawerFetcher, opts: { initial?: CashDrawerSnapshot; token?: () => Promise<string>; acquire?: (id: string) => boolean; load?: () => Promise<CashDrawerSnapshot> } = {}) {
  let current = opts.initial ?? snapshot();
  let readFailure = false;
  let reads = 0;
  const sent: { url: string; init?: RequestInit }[] = [];
  const leases: string[] = [];
  const controller = createCashDrawerController({ propertyId: p, getToken: opts.token ?? (async () => "token-716"),
    loadSnapshot: async () => { reads += 1; return opts.load ? opts.load() : readFailure ? Promise.reject(Error("offline")) : current; },
    acquireMutationLease: id => { leases.push(`acquire:${id}`); return opts.acquire?.(id) ?? true; },
    releaseMutationLease: id => { leases.push(`release:${id}`); },
    fetcher: async (url, init) => { sent.push({ url: String(url), init }); return fetcher(url, init); },
    keyFactory: () => "order716-operation-key", attemptFactory: () => "order716-attempt",
  });
  return { controller, sent, leases, getReads: () => reads, setSnapshot: (value: CashDrawerSnapshot) => { current = value; }, setReadFailure: (value: boolean) => { readFailure = value; } };
}
function selectAndReviewCount(target: ReturnType<typeof setup>) {
  target.controller.selectDrawer(drawerId);
  expect(target.controller.start("count")).toBe(true);
  target.controller.setQuantity("100", "2");
  target.controller.setQuantity("500", "3");
  expect(target.controller.review()).toBe(true);
}

test("GET shape is property-bound; denominations are only configured exact quantities", () => {
  expect(cashierSnapshotMatches(snapshot(), p)).toBe(true);
  expect(cashierSnapshotMatches(snapshot(), "71600000-0000-4000-8000-000000000099")).toBe(false);
  expect(cashierSnapshotMatches({ drawers: [{ ...snapshot().drawers[0], id: actorId }] }, p)).toBe(false);
  expect(cashierSnapshotMatches({ drawers: [{ ...snapshot(true, true, true).drawers[0], session: {
    ...snapshot(true, true, true).drawers[0]!.session, countHistory: [null],
  } }] }, p)).toBe(false);
  expect(cashDrawerDenominations(snapshot().drawers[0]!, { "100": "0", "500": "9223372036854775807" })?.length).toBe(2);
  expect(cashDrawerDenominations(snapshot().drawers[0]!, { "100": "1", "999": "1" })).toBeNull();
  expect(cashDrawerDenominations(snapshot().drawers[0]!, { "100": "1.5" })).toBeNull();
});

test("blind count posts frozen server denominations and confirms exact receipt by fresh count readback", async () => {
  const target = setup(async () => { target.setSnapshot(snapshot(true, true)); return reply(201, { countId, sessionId, attemptNo: 1, countedAt: stamp, replayed: false }, false); }, { initial: snapshot(true) });
  await target.controller.refresh();
  selectAndReviewCount(target);
  expect(target.controller.getState().reviewed?.body).toEqual({ denominations: [
    { denominationMinor: "100", quantity: "2" }, { denominationMinor: "500", quantity: "3" },
  ] });
  await target.controller.submit();
  expect(target.controller.getState().status).toBe("ready");
  expect(target.sent).toHaveLength(1);
  expect(target.sent[0]?.url).toEndWith(`/cashier-sessions/${sessionId}/counts`);
  expect(new Headers(target.sent[0]?.init?.headers).get("idempotency-key")).toBe("order716-operation-key");
  expect(target.leases).toEqual(["acquire:order716-attempt", "release:order716-attempt"]);
  expect(JSON.stringify(target.controller.getState().reviewed)).not.toContain("expectedMinor");
});

test("unknown POST then server 403 stays frozen; later replay uses identical key and body", async () => {
  let calls = 0;
  const target = setup(async () => {
    calls += 1;
    if (calls === 1) throw Error("lost response");
    if (calls === 2) return reply(403);
    target.setSnapshot(snapshot(true, true));
    return reply(200, { countId, sessionId, attemptNo: 1, countedAt: stamp, replayed: true }, true);
  }, { initial: snapshot(true) });
  await target.controller.refresh(); selectAndReviewCount(target);
  await target.controller.submit();
  expect(target.controller.getState().status).toBe("uncertain");
  target.controller.cancel();
  expect(target.controller.getState().status).toBe("uncertain");
  await target.controller.submit();
  expect(target.controller.getState().status).toBe("uncertain");
  await target.controller.submit();
  expect(target.controller.getState().status).toBe("ready");
  expect(target.sent).toHaveLength(3);
  expect(target.sent.map(row => new Headers(row.init?.headers).get("idempotency-key"))).toEqual(Array(3).fill("order716-operation-key"));
  expect(target.sent.map(row => row.init?.body)).toEqual(Array(3).fill(target.sent[0]?.init?.body));
});

test("valid receipt with failed readback keeps exact attempt, then confirms without another POST", async () => {
  const target = setup(async () => { target.setReadFailure(true); return reply(201, { countId, sessionId, attemptNo: 1, countedAt: stamp, replayed: false }); }, { initial: snapshot(true) });
  await target.controller.refresh(); selectAndReviewCount(target);
  await target.controller.submit();
  expect(target.sent).toHaveLength(1);
  expect(target.controller.getState().status).toBe("uncertain");
  target.setReadFailure(false); target.setSnapshot(snapshot(true, true));
  await target.controller.submit();
  expect(target.controller.getState().status).toBe("ready");
  expect(target.sent).toHaveLength(1);
  expect(cashierReceiptMatches({ countId, sessionId: actorId, attemptNo: 1, countedAt: stamp, replayed: false }, {
    action: "count", drawerId, sessionId, countId: null, approvalId: null, body: {}, route: "",
  })).toBe(false);
});

test("supervisor request and decision require exact count, supplied approval UUID and supervised grant", async () => {
  const target = setup(async () => reply(201, { approvalId, sessionId, countId, expectedMinor: "500", countedMinor: "400", overShortMinor: "-100", status: "pending", replayed: false }), { initial: snapshot(true, true, true) });
  await target.controller.refresh(); target.controller.selectDrawer(drawerId);
  expect(target.controller.start("approve")).toBe(true);
  expect(target.controller.review()).toBe(false);
  target.controller.setApprovalId(approvalId);
  expect(target.controller.review()).toBe(true);
  expect(target.controller.getState().reviewed?.route).toEndWith(`/approvals/${approvalId}/approve`);
  target.controller.cancel();
  expect(target.controller.start("supervised-request")).toBe(true);
  expect(target.controller.review()).toBe(true);
  await target.controller.submit();
  expect(target.controller.getState().status).toBe("ready");
  expect(target.controller.getState().evidence?.approvalId).toBe(approvalId);
  expect(target.sent[0]?.url).toEndWith(`/cashier-sessions/${sessionId}/supervised-approvals`);
});

test("token rotation before POST prevents mutation; ordinary operator cannot take supervisor action", async () => {
  let n = 0;
  const target = setup(async () => { throw Error("must not POST"); }, { initial: snapshot(true, true), token: async () => ++n === 1 ? "first" : "second" });
  await target.controller.refresh(); target.controller.selectDrawer(drawerId);
  expect(target.controller.start("approve")).toBe(false);
  expect(target.controller.start("close")).toBe(true);
  expect(target.controller.review()).toBe(true);
  await target.controller.submit();
  expect(target.sent).toHaveLength(0);
  expect(target.controller.getState().status).toBe("rejected");
});

test("open and close use canonical routes and require exact active-session readback", async () => {
  const opened = setup(async () => { opened.setSnapshot(snapshot(true)); return reply(201, {
    sessionId, drawerId, openingCountId, businessDate: "2026-09-25", currency: "USD", openingFloatMinor: "0",
    expectedMinor: "0", openedAt: stamp, replayed: false,
  }, false); });
  await opened.controller.refresh(); opened.controller.selectDrawer(drawerId);
  expect(opened.controller.start("open")).toBe(true);
  expect(opened.controller.review()).toBe(true);
  await opened.controller.submit();
  expect(opened.controller.getState().status).toBe("ready");
  expect(opened.sent[0]?.url).toEndWith(`/properties/${p}/cashier-sessions`);
  expect(JSON.parse(String(opened.sent[0]?.init?.body))).toEqual({ drawerId, denominations: [
    { denominationMinor: "100", quantity: "0" }, { denominationMinor: "500", quantity: "0" },
  ] });

  const closed = setup(async () => { closed.setSnapshot(snapshot(false)); return reply(201, {
    sessionId, openingCountId, closingCountId: countId, businessDate: "2026-09-25", currency: "USD",
    expectedMinor: "100", countedMinor: "100", overShortMinor: "0", closedAt: stamp,
    closedBy: actorId, supervised: false, replayed: false,
  }, false); }, { initial: snapshot(true, true) });
  await closed.controller.refresh(); closed.controller.selectDrawer(drawerId);
  expect(closed.controller.start("close")).toBe(true);
  expect(closed.controller.review()).toBe(true);
  await closed.controller.submit();
  expect(closed.controller.getState().status).toBe("ready");
  expect(closed.sent[0]?.url).toEndWith(`/cashier-sessions/${sessionId}/close`);
  expect(JSON.parse(String(closed.sent[0]?.init?.body))).toEqual({ countId });
});

test("unmounted uncertain command reacquires own lease and replays same key after remount", async () => {
  const first = setup(async () => { throw Error("lost response"); }, { initial: snapshot(true) });
  await first.controller.refresh(); selectAndReviewCount(first);
  await first.controller.submit();
  expect(first.controller.getState().status).toBe("uncertain");
  first.controller.dispose();
  let available = false;
  const second = setup(async () => { second.setSnapshot(snapshot(true, true)); return reply(200, {
    countId, sessionId, attemptNo: 1, countedAt: stamp, replayed: true,
  }, true); }, { initial: snapshot(true), acquire: () => available });
  second.controller.activate();
  expect(second.controller.getState().status).toBe("uncertain");
  await second.controller.submit();
  expect(second.sent).toHaveLength(0);
  available = true;
  await second.controller.submit();
  expect(second.controller.getState().status).toBe("ready");
  expect(new Headers(second.sent[0]?.init?.headers).get("idempotency-key")).toBe("order716-operation-key");
  expect(second.sent[0]?.init?.body).toEqual(first.sent[0]?.init?.body);
});

test("refresh cannot silently retarget an editing draft to another session", async () => {
  const target = setup(async () => { throw Error("must not POST"); }, { initial: snapshot(true) });
  await target.controller.refresh(); target.controller.selectDrawer(drawerId);
  expect(target.controller.start("count")).toBe(true);
  const replacement = { ...snapshot(true), drawers: [{ ...snapshot(true).drawers[0]!, session: {
    ...snapshot(true).drawers[0]!.session!, sessionId: actorId,
  } }] };
  target.setSnapshot(replacement);
  await target.controller.refresh();
  expect(target.controller.review()).toBe(false);
  expect(target.controller.getState().message).toContain("Drawer session or latest count changed");
  expect(target.sent).toHaveLength(0);
  target.controller.cancel();
});

test("overlapping reads keep only the latest drawer snapshot", async () => {
  const resolve: ((value: CashDrawerSnapshot) => void)[] = [];
  const target = setup(async () => { throw Error("must not POST"); }, {
    load: () => new Promise<CashDrawerSnapshot>(accept => { resolve.push(accept); }),
  });
  const first = target.controller.refresh();
  const second = target.controller.refresh();
  resolve[1]!(snapshot(true));
  await second;
  resolve[0]!(snapshot(false));
  await first;
  expect(target.controller.getState().readError).toBeNull();
  expect(target.controller.getState().snapshot?.drawers[0]?.session?.sessionId).toBe(sessionId);
});

test("different operator cannot replay uncertain request or borrow its frozen key", async () => {
  let token = "operator-a-bearer";
  let calls = 0;
  const target = setup(async () => {
    calls += 1;
    if (calls === 1) throw Error("lost response");
    target.setSnapshot(snapshot(true, true));
    return reply(200, { countId, sessionId, attemptNo: 1, countedAt: stamp, replayed: true }, true);
  }, { initial: snapshot(true), token: async () => token });
  await target.controller.refresh(); selectAndReviewCount(target);
  await target.controller.submit();
  expect(target.controller.getState().status).toBe("uncertain");
  const readsBefore = target.getReads();
  token = "operator-b-bearer";
  await target.controller.submit();
  expect(target.controller.getState().status).toBe("uncertain");
  expect(target.controller.getState().message).toContain("original operator session");
  expect(target.controller.getState().message).not.toContain("operator-a-bearer");
  expect(JSON.stringify(target.controller.getState())).not.toContain("operator-a-bearer");
  expect(target.getReads()).toBe(readsBefore);
  expect(target.sent).toHaveLength(1);
  expect(target.leases).not.toContain("release:order716-attempt");
  token = "operator-a-bearer";
  await target.controller.submit();
  expect(target.controller.getState().status).toBe("ready");
  expect(target.sent).toHaveLength(2);
  expect(target.sent[1]?.init?.body).toBe(target.sent[0]?.init?.body);
  expect(new Headers(target.sent[1]?.init?.headers).get("idempotency-key")).toBe("order716-operation-key");
});

test("different operator cannot read back an accepted receipt; original session can confirm without repost", async () => {
  let token = "receipt-operator-a";
  const target = setup(async () => { target.setReadFailure(true); return reply(201, {
    countId, sessionId, attemptNo: 1, countedAt: stamp, replayed: false,
  }); }, { initial: snapshot(true), token: async () => token });
  await target.controller.refresh(); selectAndReviewCount(target);
  await target.controller.submit();
  expect(target.controller.getState().status).toBe("uncertain");
  const readsBefore = target.getReads();
  token = "receipt-operator-b";
  await target.controller.submit();
  expect(target.getReads()).toBe(readsBefore);
  expect(target.sent).toHaveLength(1);
  expect(target.controller.getState().message).toContain("original operator session");
  token = "receipt-operator-a";
  target.setReadFailure(false); target.setSnapshot(snapshot(true, true));
  await target.controller.submit();
  expect(target.controller.getState().status).toBe("ready");
  expect(target.sent).toHaveLength(1);
});

test("remount keeps original bearer binding with same request and denies changed operator", async () => {
  let token = "remount-operator-a";
  const first = setup(async () => { throw Error("lost response"); }, { initial: snapshot(true), token: async () => token });
  await first.controller.refresh(); selectAndReviewCount(first);
  await first.controller.submit();
  expect(first.controller.getState().status).toBe("uncertain");
  first.controller.dispose();
  token = "remount-operator-b";
  const second = setup(async () => { second.setSnapshot(snapshot(true, true)); return reply(200, {
    countId, sessionId, attemptNo: 1, countedAt: stamp, replayed: true,
  }, true); }, { initial: snapshot(true), token: async () => token });
  second.controller.activate();
  const readsBefore = second.getReads();
  await second.controller.submit();
  expect(second.controller.getState().status).toBe("uncertain");
  expect(second.controller.getState().message).toContain("original operator session");
  expect(second.getReads()).toBe(readsBefore);
  expect(second.sent).toHaveLength(0);
  token = "remount-operator-a";
  await second.controller.submit();
  expect(second.controller.getState().status).toBe("ready");
  expect(second.sent).toHaveLength(1);
  expect(second.sent[0]?.init?.body).toBe(first.sent[0]?.init?.body);
  expect(new Headers(second.sent[0]?.init?.headers).get("idempotency-key")).toBe("order716-operation-key");
});

test("successful HTTP without canonical replay-status pairing cannot clear attempt", async () => {
  const target = setup(async () => reply(200, { countId, sessionId, attemptNo: 1, countedAt: stamp, replayed: false }), { initial: snapshot(true) });
  await target.controller.refresh(); selectAndReviewCount(target);
  await target.controller.submit();
  expect(target.controller.getState().status).toBe("uncertain");
  expect(target.sent).toHaveLength(1);
});
