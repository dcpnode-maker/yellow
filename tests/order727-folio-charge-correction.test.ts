import { expect, test } from "bun:test";
import {
  createFolioCorrectionController, normalizeCorrectionReason, parseCorrectionReceipt,
  parseCorrectionStatement, type CorrectionFetch,
} from "../frontend/yellow/src/workspaces/folio-charge-correction";

const id = (n: number) => `72700000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const propertyId = id(1), reservationId = id(2), folioId = id(3), originalId = id(4), correctionId = id(5);
const generation = "a".repeat(32);
const row = (n = 4, overrides: Record<string, unknown> = {}) => ({
  lineId: id(n + 100), journalId: id(n), kind: "charge", businessDate: "2026-09-25",
  postedAt: "2026-09-25T12:00:00.000000Z", reversesJournalId: null, reversedByJournalId: null,
  correctionEligible: true, correctionReason: null, txCode: "ROOM", description: "Room charge",
  quantity: "1.000", amountMinor: "12500", runningBalanceMinor: "12500",
  transferGroup: { id: id(n), memberCount: 1, eligible: true, reason: null, currentWindowId: folioId }, ...overrides,
});
const statement = (rows: unknown[] = [row()], overrides: Record<string, unknown> = {}) => ({
  reservationId, folio: { id: folioId, reference: "FOL-727", name: "Primary", windowNo: 1, status: "open", currency: "USD" },
  siblingWindows: [{ id: folioId, reference: "FOL-727", name: "Primary", windowNo: 1, status: "open", balanceMinor: "12500" }],
  balanceMinor: "12500", stayTotalMinor: "12500", generation, lineCount: rows.length, rows,
  chargeOptions: [{ code: "ROOM", name: "Room charge", usaliLine: "ROOM" }], chargeAvailability: { allowed: true, reason: null },
  nextCursor: null, ...overrides,
});
const receipt = (overrides: Record<string, unknown> = {}) => ({ journalId: correctionId, folioId,
  reversesJournalId: originalId, businessDate: "2026-09-25", currency: "USD", amountMinor: "-12500", replayed: false, ...overrides });
const corrected = () => statement([
  row(5, { kind: "adjustment", reversesJournalId: originalId, correctionEligible: false,
    correctionReason: "not_original_charge", amountMinor: "-12500", runningBalanceMinor: "0" }),
  row(4, { reversedByJournalId: correctionId, correctionEligible: false, correctionReason: "already_corrected" }),
], { generation: "b".repeat(32), balanceMinor: "0", stayTotalMinor: "0",
  siblingWindows: [{ id: folioId, reference: "FOL-727", name: "Primary", windowNo: 1, status: "open", balanceMinor: "0" }] });
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
let sequence = 0;
function setup(transport?: CorrectionFetch) {
  let saved = false, token = "synthetic-token", owner: string | null = null;
  const calls: Array<{ url: string; init?: RequestInit }> = [], events: string[] = [];
  const controller = createFolioCorrectionController({ propertyId, reservationId, folioId,
    getToken: async () => token, keyFactory: () => `correction-key-${++sequence}`,
    acquireMutationLease: key => { if (owner && owner !== key) return false; owner = key; events.push("acquire"); return true; },
    releaseMutationLease: key => { if (owner === key) { owner = null; events.push("release"); } },
    onReconciled: (_page, result) => events.push(`reconciled:${result.journalId}`),
    fetcher: async (url, init) => {
      calls.push({ url: String(url), init });
      if (transport) return transport(url, init);
      if (init?.method === "POST") { saved = true; return response(receipt(), 201); }
      return response(saved ? corrected() : statement());
    },
  });
  return { controller, calls, events, setToken: (value: string) => { token = value; }, owner: () => owner };
}
async function review(controller: ReturnType<typeof createFolioCorrectionController>) {
  await controller.load(); expect(controller.select(id(104))).toBe(true);
  controller.setReason("Duplicate room charge"); expect(controller.review()).toBe(true);
}

test("reason and receipt contracts keep exact minor money and server-owned authority", () => {
  expect(normalizeCorrectionReason("  Duplicate charge  ")).toBe("Duplicate charge");
  for (const value of ["", " ", "x".repeat(501), "x\ncharge", "x\u200bcharge"])
    expect(normalizeCorrectionReason(value)).toBeNull();
  const original = parseCorrectionStatement(statement(), { reservationId, folioId }).rows[0]!;
  expect(parseCorrectionReceipt(receipt(), { folioId, currency: "USD", original })).toEqual(receipt());
  for (const change of [{ amountMinor: -12500 }, { amountMinor: "-12501" }, { currency: "INR" },
    { folioId: id(80) }, { journalId: originalId }, { replayed: "false" }, { businessDate: "2026-02-31" },
    { postSealAuthorized: true }, { reversesJournalId: id(90) }])
    expect(() => parseCorrectionReceipt(receipt(change), { folioId, currency: "USD", original })).toThrow();
});

test("statement parser rejects malformed money, wrong context, duplicate rows and forged eligibility", () => {
  for (const value of [statement([row()], { reservationId: id(8) }), statement([row()], { lineCount: -1 }),
    statement([row(), row()]), statement([row(4, { amountMinor: "01" })]),
    statement([row(4, { correctionEligible: "true" })]), statement([row(4, { correctionEligible: true, reversedByJournalId: correctionId })]),
    statement([row()], { nextCursor: "bad cursor" }), statement([row()], { generation: "unbound" })])
    expect(() => parseCorrectionStatement(value, { reservationId, folioId })).toThrow();
});

test("review sends nothing; one explicit command reconciles both immutable journal references", async () => {
  const app = setup(); await review(app.controller);
  expect(app.calls.every(call => call.init?.method !== "POST")).toBe(true);
  expect(app.owner()).not.toBeNull();
  await app.controller.submit();
  const posts = app.calls.filter(call => call.init?.method === "POST");
  expect(posts).toHaveLength(1);
  expect(posts[0]!.url).toBe(`/api/v1/properties/${propertyId}/folios/${folioId}/adjustments`);
  expect(JSON.parse(String(posts[0]!.init!.body))).toEqual({ reversesJournalId: originalId, reason: "Duplicate room charge" });
  expect(app.controller.getState().status).toBe("done");
  expect(app.owner()).toBeNull(); expect(app.events.at(-1)).toBe(`reconciled:${correctionId}`);
  app.controller.dispose();
});

test("server eligibility, edit and cancel never write", async () => {
  const app = setup(async () => response(statement([row(4, { correctionEligible: false, correctionReason: "post_seal_not_authorized" })])));
  await app.controller.load(); expect(app.controller.select(id(104))).toBe(false);
  expect(app.owner()).toBeNull(); app.controller.dispose();
  const editable = setup(); await review(editable.controller); editable.controller.edit();
  expect(editable.controller.getState().status).toBe("editing");
  editable.controller.cancel(); expect(editable.owner()).toBeNull();
  expect(editable.calls.some(call => call.init?.method === "POST")).toBe(false); editable.controller.dispose();
});

test("older charge is reachable and reconcilable across exact statement pages", async () => {
  let saved = false;
  const app = setup(async (url, init) => {
    if (init?.method === "POST") { saved = true; return response(receipt(), 201); }
    const after = new URL(String(url), "http://test.local").searchParams.get("after");
    if (saved) {
      const complete = corrected();
      return response({ ...complete, rows: after ? complete.rows.slice(1) : complete.rows.slice(0, 1), nextCursor: after ? null : "older" });
    }
    return response(statement(after ? [row()] : [row(6)], { lineCount: 2, nextCursor: after ? null : "older" }));
  });
  await app.controller.load(); expect(app.controller.getState().rows.map(item => item.journalId)).toEqual([id(6)]);
  await app.controller.load(true); expect(app.controller.getState().rows.map(item => item.journalId)).toEqual([id(6), originalId]);
  expect(app.controller.select(id(104))).toBe(true); app.controller.setReason("Duplicate charge"); app.controller.review();
  await app.controller.submit(); expect(app.controller.getState().status).toBe("done");
  expect(app.calls.filter(call => call.url.includes("after=older"))).toHaveLength(3);
  expect(app.calls.filter(call => call.init?.method === "POST")).toHaveLength(1); app.controller.dispose();
});

test("generation drift, duplicated rows and omitted final rows discard unsafe page aggregates", async () => {
  for (const mode of ["generation", "duplicate", "omitted"]) {
    const app = setup(async url => {
      const after = new URL(String(url), "http://test.local").searchParams.get("after");
      return response(statement(after && mode !== "duplicate" ? [row(6)] : [row()], {
        lineCount: mode === "omitted" ? 3 : 2,
        generation: after && mode === "generation" ? "b".repeat(32) : generation,
        nextCursor: after ? null : "older",
      }));
    });
    await app.controller.load(); await app.controller.load(true);
    expect(app.controller.getState().page).toBeNull(); expect(app.controller.getState().rows).toEqual([]);
    expect(app.controller.getState().message).not.toBeNull(); expect(app.controller.select(id(104))).toBe(false);
    app.controller.dispose();
  }
});

test("repeating cursor fails closed without another request", async () => {
  const app = setup(async url => response(statement([row(String(url).includes("after=") ? 6 : 4)], { lineCount: 3, nextCursor: "same" })));
  await app.controller.load(); await app.controller.load(true); await app.controller.load(true);
  expect(app.calls).toHaveLength(2); expect(app.controller.getState().page).toBeNull(); app.controller.dispose();
});

test("preflight bill or session drift invalidates consent before POST", async () => {
  let drift = false;
  const app = setup(async () => response(statement([row()], { generation: drift ? "b".repeat(32) : generation })));
  await review(app.controller); drift = true; await app.controller.submit();
  expect(app.calls.filter(call => call.init?.method === "POST")).toHaveLength(0);
  expect(app.owner()).toBeNull(); expect(app.controller.getState().selected).toBeNull(); app.controller.dispose();
  const switched = setup(); await review(switched.controller); switched.setToken("different-actor");
  await switched.controller.submit(); expect(switched.calls.filter(call => call.init?.method === "POST")).toHaveLength(0);
  expect(switched.owner()).toBeNull(); switched.controller.dispose();
});

test("synchronous ownership prevents concurrent duplicate submissions and a competing action", async () => {
  let saved = false, unblock!: () => void;
  const waiting = new Promise<void>(resolve => { unblock = resolve; });
  let posted!: () => void; const boundary = new Promise<void>(resolve => { posted = resolve; });
  const app = setup(async (_url, init) => {
    if (init?.method === "POST") { saved = true; posted(); await waiting; return response(receipt(), 201); }
    return response(saved ? corrected() : statement());
  });
  await review(app.controller);
  const first = app.controller.submit(); await boundary;
  await app.controller.submit(); app.controller.cancel(); app.controller.edit();
  expect(app.controller.getState().status).toBe("posting");
  expect(app.calls.filter(call => call.init?.method === "POST")).toHaveLength(1);
  unblock(); await first; expect(app.controller.getState().status).toBe("done"); app.controller.dispose();
});

test("lost response and later refusal retain the exact request until same-key replay confirms it", async () => {
  let post = 0, saved = false;
  const app = setup(async (_url, init) => {
    if (init?.method === "POST") {
      post += 1; saved = true;
      if (post === 1) throw new Error("private transport content");
      if (post === 2) return response({}, 403);
      return response(receipt({ replayed: true }), 201);
    }
    return response(saved ? corrected() : statement());
  });
  await review(app.controller); await app.controller.submit();
  expect(app.controller.getState().status).toBe("uncertain"); expect(app.owner()).not.toBeNull();
  app.controller.cancel(); app.controller.setReason("different"); app.controller.edit();
  expect(app.controller.getState().reason).toBe("Duplicate room charge");
  await app.controller.submit(); expect(app.controller.getState().status).toBe("uncertain"); expect(app.owner()).not.toBeNull();
  await app.controller.submit(); expect(app.controller.getState().status).toBe("done");
  const posts = app.calls.filter(call => call.init?.method === "POST");
  expect(new Set(posts.map(call => new Headers(call.init!.headers).get("idempotency-key"))).size).toBe(1);
  expect(new Set(posts.map(call => call.init!.body)).size).toBe(1);
  expect(JSON.stringify(app.controller.getState())).not.toContain("private transport"); app.controller.dispose();
});

test("malformed or mismatched receipt remains uncertain and cannot claim success", async () => {
  for (const wrong of [{ amountMinor: "-12501" }, { folioId: id(77) }, { journalId: originalId }]) {
    let posts = 0, saved = false;
    const app = setup(async (_url, init) => {
      if (init?.method === "POST") { posts += 1; saved = true; return response(receipt(posts === 1 ? wrong : { replayed: true }), 201); }
      return response(saved ? corrected() : statement());
    });
    await review(app.controller); await app.controller.submit();
    expect(app.controller.getState().status).toBe("uncertain"); expect(app.events.some(event => event.startsWith("reconciled"))).toBe(false);
    await app.controller.submit(); expect(app.controller.getState().status).toBe("done"); app.controller.dispose();
  }
});

test("validated receipt survives failed readback; recovery reads without a second POST", async () => {
  let saved = false, readbackAvailable = false;
  const app = setup(async (_url, init) => {
    if (init?.method === "POST") { saved = true; return response(receipt(), 201); }
    if (saved && !readbackAvailable) return response({}, 503);
    return response(saved ? corrected() : statement());
  });
  await review(app.controller); await app.controller.submit(); expect(app.controller.getState().status).toBe("uncertain");
  readbackAvailable = true; await app.controller.submit(); expect(app.controller.getState().status).toBe("done");
  expect(app.calls.filter(call => call.init?.method === "POST")).toHaveLength(1); app.controller.dispose();
});

test("wrong reversal lineage in readback stays locked until exact evidence arrives", async () => {
  let saved = false, valid = false;
  const app = setup(async (_url, init) => {
    if (init?.method === "POST") { saved = true; return response(receipt(), 201); }
    if (!saved) return response(statement());
    const page = corrected(); if (!valid) page.rows[1] = row(4, { reversedByJournalId: id(99), correctionEligible: false, correctionReason: "already_corrected" });
    return response(page);
  });
  await review(app.controller); await app.controller.submit(); expect(app.controller.getState().status).toBe("uncertain");
  valid = true; await app.controller.submit(); expect(app.controller.getState().status).toBe("done"); app.controller.dispose();
});

test("an ordinary initial refusal unlocks without altering statement balances", async () => {
  const app = setup(async (_url, init) => init?.method === "POST" ? response({}, 409) : response(statement()));
  await review(app.controller); await app.controller.submit();
  expect(app.controller.getState().status).toBe("browsing"); expect(app.controller.getState().page).toBeNull();
  expect(app.owner()).toBeNull(); expect(app.events.some(event => event.startsWith("reconciled"))).toBe(false); app.controller.dispose();
});

test("remount rebinds the retained receipt to its new parent lease before read-only recovery", async () => {
  let saved = false;
  const original = setup(async (_url, init) => {
    if (init?.method === "POST") { saved = true; return response(receipt(), 201); }
    return saved ? response({}, 503) : response(statement());
  });
  await review(original.controller); await original.controller.submit();
  expect(original.controller.getState().status).toBe("uncertain"); original.controller.dispose();
  const remounted = setup(async () => response(corrected()));
  remounted.controller.activate(); expect(remounted.owner()).not.toBeNull();
  await remounted.controller.submit(); expect(remounted.controller.getState().status).toBe("done");
  expect(remounted.calls.filter(call => call.init?.method === "POST")).toHaveLength(0);
  expect(remounted.owner()).toBeNull(); remounted.controller.dispose();
});

test("late response after unmount cannot unlock or report success; same operation is recovered", async () => {
  let unblock!: () => void, reached!: () => void;
  const pending = new Promise<void>(resolve => { unblock = resolve; });
  const boundary = new Promise<void>(resolve => { reached = resolve; });
  const app = setup(async (_url, init) => {
    if (init?.method === "POST") { reached(); await pending; return response(receipt(), 201); }
    return response(statement());
  });
  await review(app.controller); const submitted = app.controller.submit(); await boundary;
  app.controller.dispose(); unblock(); await submitted;
  expect(app.events.some(event => event.startsWith("reconciled"))).toBe(false);
  const next = setup(async (_url, init) => init?.method === "POST" ? response(receipt({ replayed: true }), 201) : response(corrected()));
  next.controller.activate(); await next.controller.submit(); expect(next.controller.getState().status).toBe("done");
  const previousPost = app.calls.find(call => call.init?.method === "POST")!, retried = next.calls.find(call => call.init?.method === "POST")!;
  expect(new Headers(retried.init!.headers).get("idempotency-key")).toBe(new Headers(previousPost.init!.headers).get("idempotency-key"));
  expect(retried.init!.body).toBe(previousPost.init!.body); next.controller.dispose();
});

test("read exceptions are sanitized and effect reactivation preserves a safe draft", async () => {
  const failed = setup(async () => { throw new Error("private-transport-detail"); });
  await failed.controller.load(); expect(failed.controller.getState().message).not.toContain("private-transport-detail"); failed.controller.dispose();
  const app = setup(); await review(app.controller);
  app.controller.dispose(); app.controller.activate(); expect(app.controller.getState().status).toBe("review");
  await app.controller.submit(); expect(app.controller.getState().status).toBe("done"); app.controller.dispose();
});

test("timeout, throttling, server errors and replay-header disagreement preserve uncertainty", async () => {
  for (const status of [408, 425, 429, 503, 201]) {
    let posts = 0, saved = false;
    const app = setup(async (_url, init) => {
      if (init?.method === "POST") {
        saved = true; posts += 1;
        if (posts > 1) return response(receipt({ replayed: true }), 201);
        if (status === 201) return new Response(JSON.stringify(receipt()), { status, headers: { "idempotency-replayed": "true" } });
        return response({}, status);
      }
      return response(saved ? corrected() : statement());
    });
    await review(app.controller); await app.controller.submit(); expect(app.controller.getState().status).toBe("uncertain");
    expect(app.owner()).not.toBeNull(); await app.controller.submit(); expect(app.controller.getState().status).toBe("done"); app.controller.dispose();
  }
});

test("actor rotation during an unknown operation keeps it locked and sends no foreign replay", async () => {
  let saved = false;
  const app = setup(async (_url, init) => {
    if (init?.method === "POST") { if (!saved) { saved = true; throw new Error("response lost"); } return response(receipt({ replayed: true }), 201); }
    return response(saved ? corrected() : statement());
  });
  await review(app.controller); await app.controller.submit(); app.setToken("other-session");
  await app.controller.submit(); expect(app.controller.getState().status).toBe("uncertain");
  expect(app.calls.filter(call => call.init?.method === "POST")).toHaveLength(1);
  app.setToken("synthetic-token"); await app.controller.submit(); expect(app.controller.getState().status).toBe("done"); app.controller.dispose();
});
