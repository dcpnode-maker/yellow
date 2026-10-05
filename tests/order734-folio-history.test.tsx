import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { FolioHistoryView } from "../frontend/yellow/src/ui/FolioHistory";
import { parseFolioHistoryPage, type FolioHistoryState } from "../frontend/yellow/src/folio-history";

const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const propertyId = id(1), folioId = id(2), reservationId = id(3);
const page = parseFolioHistoryPage({
  reservationId, folio: { id: folioId, reference: "F-1", name: "Guest", windowNo: 1,
    status: "open", currency: "AED", createdAt: "2026-09-25T12:00:00.000000Z" },
  siblingWindows: [{ id: folioId, reference: "F-1", name: "Guest", windowNo: 1,
    status: "open", balanceMinor: "9007199254740993" }],
  balanceMinor: "9007199254740993", stayTotalMinor: "9007199254740993", generation: "a".repeat(32),
  lineCount: 51, rows: [{ lineId: id(101), journalId: id(201), kind: "charge", businessDate: "2026-09-25",
    postedAt: "2026-09-25T12:00:00.000001Z", reversesJournalId: null, reversedByJournalId: null,
    correctionEligible: true, correctionReason: null, txCode: "ROOM", description: "Room <stay>", quantity: "1.000",
    amountMinor: "9007199254740993", runningBalanceMinor: "9007199254740993",
    transferGroup: { id: id(301), memberCount: 1, eligible: true, reason: null, currentWindowId: folioId } }],
  nextCursor: Buffer.from(JSON.stringify({ v: 1, p: propertyId, f: folioId, d: "2026-09-25",
    t: "2026-09-25T12:00:00.000001Z", j: id(201), s: 1 }), "utf8").toString("base64url"),
}, { propertyId, folioId, reservationId });

const state: FolioHistoryState = { status: "ready", page, rows: page.rows, nextCursor: page.nextCursor, message: null };
const render = (value: FolioHistoryState = state, disabled = false, postingClass = "all") => renderToStaticMarkup(
  <FolioHistoryView state={value} disabled={disabled} postingClass={postingClass}
    onLoadMore={() => {}} onRefresh={() => {}} />,
);

test("partial history labels loaded subset and preserves exact server money in shared table", () => {
  const html = render();
  expect(html).toContain("Loaded 1 of 51 postings");
  expect(html).toContain("apply only to the loaded postings");
  expect(html).toContain("Showing 1 of 1");
  expect(html).toContain("Load older postings");
  expect(html).toContain("Refresh bill history");
  expect(html).toContain("Room &lt;stay&gt;");
  expect(html).not.toContain("Room <stay>");
  expect(html).toContain("90,071,992,547,409.93");
  expect(html).not.toContain("All postings (1)");
});

test("complete, loading, retry, drift and lock states remain honest", () => {
  const complete = render({ ...state, page: { ...page, lineCount: 1, nextCursor: null }, nextCursor: null });
  expect(complete).toContain("Loaded 1 of 1 postings");
  expect(complete).toContain("complete loaded statement");
  expect(complete).not.toContain("Load older postings");
  const loading = render({ ...state, status: "loading" });
  expect(loading).toContain('aria-busy="true"');
  expect(loading).toContain("Loading older postings");
  expect(loading).toContain("disabled");
  const failed = render({ ...state, status: "error", message: "Older postings could not be loaded." });
  expect(failed).toContain("Retry older postings");
  expect(failed).toContain('role="alert"');
  const drift = render({ ...state, status: "refresh-required", message: "Refresh required." });
  expect(drift).toContain("Refresh is required before loading more history");
  expect(drift).not.toContain("Load older postings");
  const locked = render(state, true);
  expect(locked).toContain("paused while a financial action is in progress");
  expect(locked).toContain("disabled");
});

test("the rendered cap message agrees with the server remaining count", () => {
  const rows = Array.from({ length: 9_950 }, (_, index) => ({ ...page.rows[0]!,
    lineId: id(1_000 + index), kind: index === 0 ? "payment" : "charge" }));
  const withinCap = render({ ...state, page: { ...page, lineCount: 9_999 }, rows }, false, "payment");
  expect(withinCap).toContain("Loaded 9950 of 9999 postings");
  expect(withinCap).toContain("Load older postings");
  expect(withinCap).not.toContain("This view is limited to");
  const overCap = render({ ...state, page: { ...page, lineCount: 10_001 }, rows }, false, "payment");
  expect(overCap).toContain("Loaded 9950 of 10001 postings");
  expect(overCap).toContain("This view is limited to 10,000 loaded postings");
  expect(overCap).toContain("The statement is not complete");
});
