import { expect, test } from "bun:test";
import { createFolioHistoryController, folioHistoryAtLimit, parseFolioHistoryPage } from "../frontend/yellow/src/folio-history";

const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const propertyId = id(1), folioId = id(2), reservationId = id(3);
const context = { propertyId, folioId, reservationId };
const generation = "a".repeat(32);
const time = (n: number) => `2026-09-25T12:00:00.${String(n).padStart(6, "0")}Z`;
const row = (n: number) => ({
  lineId: id(100 + n), journalId: id(200 + n), kind: "charge", businessDate: "2026-09-25",
  postedAt: time(n), reversesJournalId: null, reversedByJournalId: null,
  correctionEligible: true, correctionReason: null, txCode: "ROOM", description: `Room ${n}`,
  quantity: "1.000", amountMinor: "9007199254740993", runningBalanceMinor: String(n),
  transferGroup: { id: id(300 + n), memberCount: 1, eligible: true, reason: null, currentWindowId: folioId },
});
const cursor = (last: ReturnType<typeof row>, overrides: Record<string, unknown> = {}) =>
  Buffer.from(JSON.stringify({ v: 1, p: propertyId, f: folioId, d: last.businessDate,
    t: last.postedAt, j: last.journalId, s: 1, ...overrides }), "utf8").toString("base64url");
const page = (rows: ReturnType<typeof row>[], total = rows.length, nextCursor: string | null = null) => ({
  reservationId, folio: { id: folioId, reference: "FOL-1", name: "Guest", windowNo: 1,
    status: "open", currency: "AED", createdAt: time(0) },
  siblingWindows: [{ id: folioId, reference: "FOL-1", name: "Guest", windowNo: 1,
    status: "open", balanceMinor: "9007199254740993" }],
  balanceMinor: "9007199254740993", stayTotalMinor: "9007199254740993", generation,
  lineCount: total, rows, nextCursor,
});

test("two manual pages preserve server order, exact money and correction fields", async () => {
  const first = page([row(4), row(3)], 4, cursor(row(3)));
  const requests: string[] = [];
  const history = createFolioHistoryController({ context, firstPage: first, loadPage: async after => {
    requests.push(after); return page([row(2), row(1)], 4);
  } });
  expect(history.getState().rows).toHaveLength(2);
  expect(history.getState().page?.lineCount).toBe(4);
  await history.loadMore();
  expect(requests).toEqual([first.nextCursor!]);
  expect(history.getState().status).toBe("ready");
  expect(history.getState().rows.map(item => item.lineId)).toEqual([row(4), row(3), row(2), row(1)].map(item => item.lineId));
  expect(history.getState().rows[0]?.amountMinor).toBe("9007199254740993");
  expect(history.getState().rows[0]?.correctionEligible).toBe(true);
  expect(history.getState().nextCursor).toBeNull();
  await history.loadMore(); expect(requests).toHaveLength(1);
  history.dispose();
});

test("hostile first-page shape and cursor context are rejected", () => {
  const valid = page([row(3)], 2, cursor(row(3)));
  const bad: unknown[] = [
    { ...valid, reservationId: id(9) },
    { ...valid, folio: { ...valid.folio, id: id(9) } },
    { ...valid, folio: { ...valid.folio, createdAt: "yesterday" } },
    { ...valid, siblingWindows: [{ ...valid.siblingWindows[0], balanceMinor: "4" }] },
    { ...valid, rows: [row(3), row(3)] },
    { ...valid, rows: [row(1), row(3)] },
    { ...valid, rows: [{ ...row(3), amountMinor: 9007199254740993 }] },
    { ...valid, rows: [{ ...row(3), correctionEligible: "yes" }] },
    { ...valid, nextCursor: cursor(row(3), { p: id(9) }) },
    { ...valid, nextCursor: cursor(row(3), { f: id(9) }) },
    { ...valid, nextCursor: cursor(row(3), { j: id(9) }) },
    { ...valid, nextCursor: cursor(row(3), { s: 0 }) },
    { ...valid, nextCursor: "not-a-cursor" },
  ];
  for (const candidate of bad) expect(() => parseFolioHistoryPage(candidate, context)).toThrow();
  expect(parseFolioHistoryPage(valid, context).nextCursor).toBe(valid.nextCursor);
});

test("drift and omitted rows fail closed without losing previously loaded rows", async () => {
  const first = page([row(4), row(3)], 4, cursor(row(3)));
  const bad = [
    { ...page([row(2), row(1)], 4), generation: "b".repeat(32) },
    { ...page([row(2), row(1)], 4), balanceMinor: "1" },
    { ...page([row(2), row(1)], 4), folio: { ...first.folio, currency: "USD" } },
    { ...page([row(2), row(1)], 4), siblingWindows: [{ ...first.siblingWindows[0], name: "Other" }] },
    page([row(3), row(1)], 4),
    page([row(4), row(1)], 4),
    page([row(2)], 4),
    page([row(2)], 4, cursor(row(2))),
    page([], 4),
    page([row(5), row(1)], 4),
    page([row(2), row(1)], 4, first.nextCursor),
  ];
  for (const candidate of bad) {
    const history = createFolioHistoryController({ context, firstPage: first, loadPage: async () => candidate });
    await history.loadMore();
    expect(history.getState().status).toBe("refresh-required");
    expect(history.getState().rows.map(item => item.lineId)).toEqual(first.rows.map(item => item.lineId));
    history.dispose();
  }
});

test("network error retries same cursor and never silently skips a page", async () => {
  const first = page([row(3)], 2, cursor(row(3)));
  const calls: string[] = [];
  const history = createFolioHistoryController({ context, firstPage: first, loadPage: async after => {
    calls.push(after);
    if (calls.length === 1) throw new Error("offline");
    return page([row(2)], 2);
  } });
  await history.loadMore();
  expect(history.getState().status).toBe("error");
  expect(history.getState().rows).toHaveLength(1);
  expect(history.getState().nextCursor).toBe(first.nextCursor);
  await history.loadMore();
  expect(calls).toEqual([first.nextCursor!, first.nextCursor!]);
  expect(history.getState().rows).toHaveLength(2);
  history.dispose();
});

test("refresh and dispose discard stale async completions", async () => {
  const first = page([row(3)], 2, cursor(row(3)));
  let finish: ((value: unknown) => void) | undefined;
  const history = createFolioHistoryController({ context, firstPage: first,
    loadPage: async () => new Promise(resolve => { finish = resolve; }) });
  const pending = history.loadMore();
  history.reset(page([row(5)], 1));
  finish?.(page([row(2)], 2)); await pending;
  expect(history.getState().rows.map(item => item.lineId)).toEqual([row(5).lineId]);
  expect(history.getState().nextCursor).toBeNull();
  history.dispose();
});

test("financial action lock prevents a history request", async () => {
  let blocked = true, requests = 0;
  const history = createFolioHistoryController({ context, firstPage: page([row(3)], 2, cursor(row(3))),
    isBlocked: () => blocked, loadPage: async () => { requests++; return page([row(2)], 2); } });
  await history.loadMore(); expect(requests).toBe(0);
  blocked = false; await history.loadMore(); expect(requests).toBe(1);
  history.dispose();
});

test("a final short page remains available below the explicit view cap", () => {
  expect(folioHistoryAtLimit(9_950, 9_999)).toBe(false);
  expect(folioHistoryAtLimit(9_950, 10_001)).toBe(true);
});

test("the real controller reaches 9,999 rows but stops before an over-cap next page", async () => {
  for (const total of [9_999, 10_001]) {
    const firstRows = Array.from({ length: 50 }, (_, index) => row(9_999 - index));
    const first = page(firstRows, total, cursor(firstRows.at(-1)!));
    let calls = 0;
    const history = createFolioHistoryController({ context, firstPage: first, loadPage: async () => {
      calls++;
      const start = 9_950 - (calls - 1) * 100 - 1;
      const length = calls === 100 ? 49 : 100;
      const rows = Array.from({ length }, (_, index) => row(start - index));
      return page(rows, total, calls === 100 ? null : cursor(rows.at(-1)!));
    } });
    for (let index = 0; index < 99; index++) await history.loadMore();
    expect(history.getState().rows).toHaveLength(9_950);
    expect(calls).toBe(99);
    await history.loadMore();
    if (total === 9_999) {
      expect(history.getState().rows).toHaveLength(9_999);
      expect(history.getState().nextCursor).toBeNull();
      expect(calls).toBe(100);
    } else {
      expect(history.getState().rows).toHaveLength(9_950);
      expect(history.getState().nextCursor).not.toBeNull();
      expect(calls).toBe(99);
    }
    history.dispose();
  }
});
