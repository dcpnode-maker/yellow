const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
export const FOLIO_HISTORY_PAGE_SIZE = 100;
export const FOLIO_HISTORY_MAX_ROWS = 10_000;
export const folioHistoryAtLimit = (loaded: number, total: number): boolean =>
  loaded + Math.min(FOLIO_HISTORY_PAGE_SIZE, total - loaded) > FOLIO_HISTORY_MAX_ROWS;
export type FolioHistoryContext = Readonly<{ propertyId: string; folioId: string; reservationId: string | null }>;
export type FolioHistoryRow = Readonly<{
  lineId: string; journalId: string; kind: string; businessDate: string; postedAt: string;
  reversesJournalId: string | null; reversedByJournalId: string | null;
  correctionEligible: boolean; correctionReason: string | null;
  txCode: string; description: string | null; quantity: string; amountMinor: string; runningBalanceMinor: string;
  transferGroup: Readonly<{ id: string; memberCount: number; eligible: boolean; reason: string | null; currentWindowId: string }>;
}>;
export type FolioHistoryPage = Readonly<{
  reservationId: string | null;
  folio: Readonly<{ id: string; reference: string | null; name: string | null; windowNo: number;
    status: string; currency: string; createdAt: string }>;
  siblingWindows: readonly Readonly<{ id: string; windowNo: number; reference: string | null; name: string | null;
    status: string; balanceMinor: string }>[];
  balanceMinor: string; stayTotalMinor: string; generation: string;
  rows: readonly FolioHistoryRow[]; lineCount: number; nextCursor: string | null;
}>;
export type FolioHistoryState = Readonly<{
  status: "ready" | "loading" | "error" | "refresh-required";
  page: FolioHistoryPage | null;
  rows: readonly FolioHistoryRow[];
  nextCursor: string | null;
  message: string | null;
}>;
export type FolioHistoryOptions = Readonly<{
  context: FolioHistoryContext;
  firstPage: unknown;
  loadPage: (after: string, signal: AbortSignal) => Promise<unknown>;
  isBlocked?: () => boolean;
}>;

class HistoryEvidenceError extends Error {}
function invalid(): never { throw new HistoryEvidenceError("The statement history is inconsistent. Refresh the bill before loading more postings."); }
const record = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const uuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);
const text = (v: unknown, max = 500): v is string => typeof v === "string" && v.length <= max;
const nullableText = (v: unknown, max = 500): boolean => v === null || text(v, max);
const integer = (v: unknown, min: number, max: number): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= min && v <= max;
// Running/family balances are PostgreSQL numeric sums, not JavaScript numbers or single bigint entries.
const minor = (v: unknown): v is string => typeof v === "string" && /^(?:0|-?[1-9][0-9]{0,39})$/u.test(v);
const date = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/u.test(v) &&
  Number.isFinite(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
const timestamp = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/u.test(v) &&
  Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === `${v.slice(0, 23)}Z`;
const position = (row: FolioHistoryRow): string => `${row.businessDate}|${row.postedAt}|${row.journalId}`;

function cursor(value: unknown, context: FolioHistoryContext, last: FolioHistoryRow): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,512}$/u.test(value)) invalid();
  try {
    const decoded = atob(value.replaceAll("-", "+").replaceAll("_", "/"));
    if (btoa(decoded).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "") !== value) invalid();
    const item: unknown = JSON.parse(decoded);
    if (!record(item) || Object.keys(item).sort().join("|") !== "d|f|j|p|s|t|v" || item.v !== 1 ||
        item.p !== context.propertyId || item.f !== context.folioId || !integer(item.s, 1, 32_767) ||
        item.d !== last.businessDate || item.t !== last.postedAt || item.j !== last.journalId) invalid();
  } catch { invalid(); }
  return value;
}

/** Project only read-model fields. No mutation evidence or query cache is modified here. */
export function parseFolioHistoryPage(value: unknown, context: FolioHistoryContext): FolioHistoryPage {
  if (!uuid(context.propertyId) || !uuid(context.folioId) || !(context.reservationId === null || uuid(context.reservationId)) ||
      !record(value) || value.reservationId !== context.reservationId || !record(value.folio) || value.folio.id !== context.folioId ||
      !nullableText(value.folio.reference, 80) || !nullableText(value.folio.name, 80) || !integer(value.folio.windowNo, 1, 20) ||
      !["open", "settled", "closed"].includes(String(value.folio.status)) || typeof value.folio.currency !== "string" ||
      !/^[A-Z]{3}$/u.test(value.folio.currency) || !timestamp(value.folio.createdAt) ||
      !minor(value.balanceMinor) || !minor(value.stayTotalMinor) ||
      typeof value.generation !== "string" || !/^[0-9a-f]{32}$/u.test(value.generation) || !integer(value.lineCount, 0, 2_147_483_647) ||
      !Array.isArray(value.rows) || value.rows.length > FOLIO_HISTORY_PAGE_SIZE || value.rows.length > value.lineCount ||
      !Array.isArray(value.siblingWindows) || value.siblingWindows.length < 1 || value.siblingWindows.length > 20) invalid();
  const folio = value.folio;
  const siblings = new Set<string>();
  const windowNumbers = new Set<number>();
  for (const sibling of value.siblingWindows) {
    if (!record(sibling) || !uuid(sibling.id) || siblings.has(sibling.id) || !integer(sibling.windowNo, 1, 20) ||
        windowNumbers.has(sibling.windowNo) || !nullableText(sibling.reference, 80) || !nullableText(sibling.name, 80) ||
        !["open", "settled", "closed"].includes(String(sibling.status)) || !minor(sibling.balanceMinor)) invalid();
    siblings.add(sibling.id); windowNumbers.add(sibling.windowNo);
    if (sibling.id === context.folioId && (sibling.windowNo !== folio.windowNo || sibling.reference !== folio.reference ||
        sibling.name !== folio.name || sibling.status !== folio.status || sibling.balanceMinor !== value.balanceMinor)) invalid();
  }
  if (!siblings.has(context.folioId)) invalid();
  const lineIds = new Set<string>();
  let previousPosition: string | null = null;
  for (const row of value.rows) {
    if (!record(row) || !uuid(row.lineId) || lineIds.has(row.lineId) || !uuid(row.journalId) || !text(row.kind, 64) ||
        !date(row.businessDate) || !timestamp(row.postedAt) || !text(row.txCode, 128) || !nullableText(row.description, 4_000) ||
        !(row.reversesJournalId === null || uuid(row.reversesJournalId)) ||
        !(row.reversedByJournalId === null || uuid(row.reversedByJournalId)) ||
        typeof row.correctionEligible !== "boolean" || !nullableText(row.correctionReason) ||
        typeof row.quantity !== "string" || !/^-?\d{1,15}(?:\.\d{1,6})?$/u.test(row.quantity) ||
        !minor(row.amountMinor) || !minor(row.runningBalanceMinor) || !record(row.transferGroup) ||
        !uuid(row.transferGroup.id) || !integer(row.transferGroup.memberCount, 1, 32_767) ||
        typeof row.transferGroup.eligible !== "boolean" || !nullableText(row.transferGroup.reason) ||
        !uuid(row.transferGroup.currentWindowId)) invalid();
    const currentPosition = position(row as unknown as FolioHistoryRow);
    // seq is not exposed by this API: equal date/time/journal tuples retain server order.
    if (previousPosition !== null && currentPosition > previousPosition) invalid();
    previousPosition = currentPosition; lineIds.add(row.lineId);
  }
  if (value.nextCursor !== null) {
    if (value.rows.length === 0 || value.rows.length >= value.lineCount) invalid();
    cursor(value.nextCursor, context, value.rows.at(-1) as FolioHistoryRow);
  }
  const page = structuredClone({ reservationId: value.reservationId, folio: {
    id: folio.id, reference: folio.reference, name: folio.name, windowNo: folio.windowNo, status: folio.status,
    currency: folio.currency, createdAt: folio.createdAt,
  }, siblingWindows: value.siblingWindows, balanceMinor: value.balanceMinor, stayTotalMinor: value.stayTotalMinor,
  generation: value.generation, lineCount: value.lineCount, nextCursor: value.nextCursor,
  rows: value.rows.map(row => ({ lineId: row.lineId, journalId: row.journalId, kind: row.kind,
    businessDate: row.businessDate, postedAt: row.postedAt, reversesJournalId: row.reversesJournalId,
    reversedByJournalId: row.reversedByJournalId, correctionEligible: row.correctionEligible,
    correctionReason: row.correctionReason, description: row.description, quantity: row.quantity,
    amountMinor: row.amountMinor, runningBalanceMinor: row.runningBalanceMinor, txCode: row.txCode, transferGroup: row.transferGroup })),
  }) as FolioHistoryPage;
  page.rows.forEach(row => { Object.freeze(row.transferGroup); Object.freeze(row); });
  page.siblingWindows.forEach(Object.freeze); Object.freeze(page.siblingWindows); Object.freeze(page.rows); Object.freeze(page.folio);
  return Object.freeze(page);
}

function identity(page: FolioHistoryPage): string {
  return JSON.stringify([page.reservationId, page.folio, page.generation, page.balanceMinor, page.stayTotalMinor, page.lineCount,
    [...page.siblingWindows].sort((a, b) => a.windowNo - b.windowNo).map(s => [s.id, s.windowNo, s.reference, s.name, s.status, s.balanceMinor])]);
}

export function createFolioHistoryController(options: FolioHistoryOptions) {
  const listeners = new Set<() => void>();
  let active = true, revision = 0;
  let pending: AbortController | null = null;
  let seenCursors = new Set<string>();
  let state: FolioHistoryState;
  const publish = (next: FolioHistoryState) => { state = Object.freeze(next); if (active) listeners.forEach(listener => listener()); };
  const reset = (firstPage: unknown) => {
    revision++; pending?.abort(); pending = null; seenCursors = new Set();
    try {
      const page = parseFolioHistoryPage(firstPage, options.context);
      if (page.nextCursor === null && page.rows.length !== page.lineCount) invalid();
      publish({ status: "ready", page, rows: page.rows, nextCursor: page.nextCursor, message: null });
    } catch {
      publish({ status: "refresh-required", page: null, rows: [], nextCursor: null,
        message: "Statement history could not be verified. Refresh the bill to try again." });
    }
  };
  reset(options.firstPage);
  return Object.freeze({
    getState: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    reset,
    activate() { active = true; },
    dispose() {
      active = false; revision++; pending?.abort(); pending = null;
      if (state.status === "loading") state = Object.freeze({ ...state, status: "ready" });
    },
    async loadMore(): Promise<void> {
      if (!active || options.isBlocked?.() || state.status === "loading" || state.status === "refresh-required" ||
          !state.page || !state.nextCursor || folioHistoryAtLimit(state.rows.length, state.page.lineCount)) return;
      const first = state.page, priorRows = state.rows, after = state.nextCursor, captured = revision;
      const controller = new AbortController(); pending = controller;
      const timer = setTimeout(() => controller.abort(), 15_000);
      publish({ ...state, status: "loading", message: null });
      const current = () => active && revision === captured;
      try {
        const raw = await options.loadPage(after, controller.signal);
        if (!current()) return;
        if (controller.signal.aborted) throw new Error("History request timed out");
        if (options.isBlocked?.()) { publish({ ...state, status: "ready" }); return; }
        const page = parseFolioHistoryPage(raw, options.context);
        if (identity(page) !== identity(first)) throw new HistoryEvidenceError("The bill changed while loading older postings. Refresh the bill to restart its history.");
        const ids = new Set(priorRows.map(row => row.lineId));
        const last = priorRows.at(-1), next = page.rows[0];
        if (page.rows.length === 0 || (page.nextCursor !== null && page.rows.length !== FOLIO_HISTORY_PAGE_SIZE) ||
            page.rows.some(row => ids.has(row.lineId)) ||
            (last && next && position(next) > position(last)) ||
            (page.nextCursor !== null && (page.nextCursor === after || seenCursors.has(page.nextCursor)))) invalid();
        const rows = Object.freeze([...priorRows, ...page.rows]);
        if (rows.length > first.lineCount || (page.nextCursor === null ? rows.length !== first.lineCount : rows.length >= first.lineCount)) invalid();
        seenCursors.add(after);
        publish({ status: "ready", page: first, rows, nextCursor: page.nextCursor, message: null });
      } catch (error) {
        if (!current()) return;
        publish({ ...state, status: error instanceof HistoryEvidenceError ? "refresh-required" : "error",
          message: error instanceof HistoryEvidenceError ? error.message : "Older postings could not be loaded. Existing rows are unchanged. Retry this page or refresh the bill." });
      } finally {
        clearTimeout(timer);
        if (current()) pending = null;
      }
    },
  });
}
