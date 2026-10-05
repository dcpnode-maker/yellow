const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const MINOR = /^(?:0|-?[1-9][0-9]*)$/u;
const CURSOR = /^[A-Za-z0-9_-]{1,512}$/u;
const PAGE_SIZE = 100;
const MAX_PAGES = 1_000;
const MAX_RESPONSE_BYTES = 2_000_000;

export type CorrectionRow = Readonly<{
  lineId: string; journalId: string; kind: string; businessDate: string;
  description: string | null; quantity: string; amountMinor: string; runningBalanceMinor: string; txCode: string;
  transferGroup: Readonly<{ id: string; memberCount: number; eligible: boolean; reason: string | null; currentWindowId: string }>;
  postedAt: string;
  reversesJournalId: string | null;
  reversedByJournalId: string | null;
  correctionEligible: boolean;
  correctionReason: string | null;
}>;
export type CorrectionStatement = Readonly<{
  reservationId: string | null;
  folio: Readonly<{ id: string; reference: string | null; name: string | null; windowNo: number; status: string; currency: string }>;
  siblingWindows: readonly Readonly<{ id: string; reference: string | null; name: string | null; windowNo: number; status: string; balanceMinor: string }>[];
  balanceMinor: string; stayTotalMinor: string; generation: string;
  chargeOptions: readonly Readonly<{ code: string; name: string; usaliLine: string }>[];
  chargeAvailability: Readonly<{ allowed: boolean; reason: string | null }>;
  rows: readonly CorrectionRow[];
  lineCount: number;
  nextCursor: string | null;
}>;
export type CorrectionReceipt = Readonly<{
  journalId: string; folioId: string; reversesJournalId: string; businessDate: string;
  currency: string; amountMinor: string; replayed: boolean;
}>;
export type CorrectionFetch = (url: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
export type CorrectionState = Readonly<{
  status: "idle" | "loading" | "browsing" | "editing" | "review" | "posting" | "uncertain" | "done";
  page: CorrectionStatement | null;
  rows: readonly CorrectionRow[];
  nextCursor: string | null;
  selected: CorrectionRow | null;
  reason: string;
  message: string | null;
}>;
export type FolioCorrectionOptions = Readonly<{
  propertyId: string; reservationId: string; folioId: string;
  getToken: () => Promise<string>;
  acquireMutationLease: (owner: string) => boolean;
  releaseMutationLease: (owner: string) => void;
  onReconciled: (page: CorrectionStatement, receipt: CorrectionReceipt) => void;
  fetcher?: CorrectionFetch;
  keyFactory?: () => string;
}>;
export type FolioCorrectionController = Readonly<{
  getState(): CorrectionState;
  subscribe(listener: () => void): () => void;
  load(more?: boolean): Promise<void>;
  select(lineId: string): boolean;
  setReason(value: string): void;
  review(): boolean;
  edit(): void;
  cancel(): void;
  submit(): Promise<void>;
  activate(): void;
  dispose(): void;
}>;

const INITIAL: CorrectionState = Object.freeze({ status: "idle", page: null, rows: [], nextCursor: null,
  selected: null, reason: "", message: null });
type Attempt = { owner: string; key: string; body: string; original: CorrectionRow;
  currency: string; fingerprint: string; token: string; uncertain: boolean; receipt: CorrectionReceipt | null };
// Memory only. Retained requests survive component remounts, never browser storage or URLs.
type Session = { state: CorrectionState; attempt: Attempt | null; inFlight: boolean };
const retained = new Map<string, Session>();

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function text(value: unknown, maximum = 500): value is string { return typeof value === "string" && value.length <= maximum; }
function uuid(value: unknown): value is string { return typeof value === "string" && UUID.test(value); }
function nullableText(value: unknown, maximum = 500): boolean { return value === null || text(value, maximum); }
function integer(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= max;
}
function minor(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 20 || !MINOR.test(value)) return false;
  const amount = BigInt(value); return amount >= -(2n ** 63n) && amount <= 2n ** 63n - 1n;
}
function date(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/u.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}
class CorrectionEvidenceError extends Error {}
function invalid(): never { throw new CorrectionEvidenceError("The statement or correction evidence is invalid. Refresh the selected bill before continuing."); }

export function normalizeCorrectionReason(value: string): string | null {
  const reason = value.trim();
  return reason.length > 0 && reason.length <= 500 &&
    !/[\u0000-\u001f\u007f\u200b-\u200d\u202a-\u202e\u2060\u2066-\u2069\ufeff]/u.test(reason) ? reason : null;
}

export function parseCorrectionStatement(value: unknown, expected: Readonly<{ reservationId: string; folioId: string }>): CorrectionStatement {
  if (!record(value) || value.reservationId !== expected.reservationId || !record(value.folio) ||
      value.folio.id !== expected.folioId || !uuid(value.folio.id) || !nullableText(value.folio.reference, 80) ||
      !nullableText(value.folio.name, 80) || !integer(value.folio.windowNo, 1, 20) ||
      !["open", "settled", "closed"].includes(String(value.folio.status)) ||
      typeof value.folio.currency !== "string" || !/^[A-Z]{3}$/u.test(value.folio.currency) ||
      !minor(value.balanceMinor) || !minor(value.stayTotalMinor) || typeof value.generation !== "string" ||
      !/^[0-9a-f]{32}$/u.test(value.generation) || !integer(value.lineCount, 0, PAGE_SIZE * MAX_PAGES) ||
      !Array.isArray(value.rows) || value.rows.length > PAGE_SIZE || value.rows.length > value.lineCount ||
      !(value.nextCursor === null || typeof value.nextCursor === "string" && CURSOR.test(value.nextCursor)) ||
      value.nextCursor !== null && value.rows.length === 0 || !Array.isArray(value.siblingWindows) ||
      !Array.isArray(value.chargeOptions) || !record(value.chargeAvailability) ||
      typeof value.chargeAvailability.allowed !== "boolean" || !nullableText(value.chargeAvailability.reason)) invalid();
  const folio = value.folio;
  const siblingIds = new Set<string>();
  for (const sibling of value.siblingWindows) {
    if (!record(sibling) || !uuid(sibling.id) || siblingIds.has(sibling.id) || !integer(sibling.windowNo, 1, 20) ||
        !nullableText(sibling.reference, 80) || !nullableText(sibling.name, 80) || !text(sibling.status, 32) || !minor(sibling.balanceMinor)) invalid();
    siblingIds.add(sibling.id);
    if (sibling.id === folio.id && (sibling.windowNo !== folio.windowNo || sibling.reference !== folio.reference ||
        sibling.name !== folio.name || sibling.status !== folio.status || sibling.balanceMinor !== value.balanceMinor)) invalid();
  }
  if (!siblingIds.has(expected.folioId) || siblingIds.size > 20 || value.chargeOptions.length > 100) invalid();
  for (const option of value.chargeOptions) {
    if (!record(option) || !text(option.code, 128) || !text(option.name) || !text(option.usaliLine, 128)) invalid();
  }
  const lineIds = new Set<string>();
  for (const row of value.rows) {
    if (!record(row) || !uuid(row.lineId) || lineIds.has(row.lineId) || !uuid(row.journalId) || !text(row.kind, 64) ||
        !date(row.businessDate) || typeof row.postedAt !== "string" ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/u.test(row.postedAt) || Number.isNaN(Date.parse(row.postedAt)) ||
        !(row.reversesJournalId === null || uuid(row.reversesJournalId)) ||
        !(row.reversedByJournalId === null || uuid(row.reversedByJournalId)) ||
        typeof row.correctionEligible !== "boolean" || !nullableText(row.correctionReason) ||
        !text(row.txCode, 128) || !nullableText(row.description, 4_000) || typeof row.quantity !== "string" ||
        !/^-?\d{1,15}(?:\.\d{1,6})?$/u.test(row.quantity) || !minor(row.amountMinor) || !minor(row.runningBalanceMinor) ||
        !record(row.transferGroup) || !uuid(row.transferGroup.id) || !integer(row.transferGroup.memberCount, 1, 32_767) ||
        typeof row.transferGroup.eligible !== "boolean" || !nullableText(row.transferGroup.reason) ||
        !uuid(row.transferGroup.currentWindowId)) invalid();
    if (row.correctionEligible && (row.kind !== "charge" || row.reversesJournalId !== null ||
        row.reversedByJournalId !== null || row.correctionReason !== null || BigInt(row.amountMinor) <= 0n || folio.status !== "open")) invalid();
    lineIds.add(row.lineId);
  }
  // JSON input is detached from the server; freezing prevents draft code changing reviewed evidence.
  const page = structuredClone(value) as unknown as CorrectionStatement;
  page.rows.forEach(row => { Object.freeze(row.transferGroup); Object.freeze(row); });
  Object.freeze(page.rows); Object.freeze(page.folio); Object.freeze(page.siblingWindows);
  return Object.freeze(page);
}

export function parseCorrectionReceipt(value: unknown, expected: Readonly<{ folioId: string; currency: string; original: CorrectionRow }>): CorrectionReceipt {
  const keys = ["journalId", "folioId", "reversesJournalId", "businessDate", "currency", "amountMinor", "replayed"].sort().join("|");
  if (!record(value) || Object.keys(value).sort().join("|") !== keys || !uuid(value.journalId) ||
      value.journalId === expected.original.journalId || value.folioId !== expected.folioId ||
      value.reversesJournalId !== expected.original.journalId || !date(value.businessDate) || value.currency !== expected.currency ||
      !minor(value.amountMinor) || value.amountMinor !== (-BigInt(expected.original.amountMinor)).toString() ||
      typeof value.replayed !== "boolean") invalid();
  return Object.freeze(value as unknown as CorrectionReceipt);
}

export function correctionReasonLabel(reason: string | null): string {
  switch (reason) {
    case "adjustment_not_authorized": return "Your role cannot correct charges.";
    case "folio_not_open": return "The bill or its guest account is not open.";
    case "business_day_missing": return "Required business-day evidence is unavailable.";
    case "post_seal_not_authorized": return "A supervisor with sealed-day adjustment access is required.";
    case "not_original_charge": return "This posting is not an original charge supported by this action.";
    case "already_corrected": return "This charge has already been corrected.";
    case "inconsistent_posting_set": return "The original posting set requires review.";
    case "charge_routed_from_original_folio": return "Restore the complete charge to its original bill window before correcting it.";
    default: return "The server has not authorized correction of this posting.";
  }
}

function pageIdentity(page: CorrectionStatement): string {
  return JSON.stringify([page.reservationId, page.folio, page.generation, page.lineCount, page.balanceMinor, page.stayTotalMinor, page.siblingWindows]);
}
function appendPage(first: CorrectionStatement, previous: readonly CorrectionRow[], page: CorrectionStatement): readonly CorrectionRow[] {
  if (pageIdentity(first) !== pageIdentity(page)) throw new CorrectionEvidenceError("The bill changed while loading its history. Refresh charges and review again.");
  const ids = new Set(previous.map(row => row.lineId));
  if (page.rows.some(row => ids.has(row.lineId))) throw new CorrectionEvidenceError("The statement repeated a posting. Refresh charges before continuing.");
  const rows = Object.freeze([...previous, ...page.rows]);
  if (rows.length > first.lineCount || (page.nextCursor === null && rows.length !== first.lineCount))
    throw new CorrectionEvidenceError("The statement history is incomplete. Refresh charges before continuing.");
  return rows;
}

export function createFolioCorrectionController(options: FolioCorrectionOptions): FolioCorrectionController {
  if (![options.propertyId, options.reservationId, options.folioId].every(uuid)) throw new Error("Correction context is invalid.");
  const context = JSON.stringify([options.propertyId, options.reservationId, options.folioId]);
  const session = retained.get(context) ?? { state: INITIAL, attempt: null, inFlight: false };
  const listeners = new Set<() => void>();
  const fetcher = options.fetcher ?? fetch;
  const makeKey = options.keyFactory ?? (() => `yellow-charge-correction-${crypto.randomUUID()}`);
  let active = true, revision = 0, leaseHeld = false, browsingToken = "";
  let seenCursors = new Set<string>();
  const current = (captured: number) => active && captured === revision;
  const publish = (next: CorrectionState) => {
    session.state = Object.freeze(next);
    if (session.attempt) retained.set(context, session); else retained.delete(context);
    if (active) listeners.forEach(listener => listener());
  };
  const release = () => {
    if (session.attempt && leaseHeld) options.releaseMutationLease(session.attempt.owner);
    leaseHeld = false;
  };
  const ensureLease = () => {
    if (!session.attempt) return false;
    if (!leaseHeld) leaseHeld = options.acquireMutationLease(session.attempt.owner);
    return leaseHeld;
  };
  const tokenCurrent = async (token: string, captured: number) => current(captured) && token === await options.getToken() && current(captured);
  const getPage = async (token: string, captured: number, cursor: string | null = null): Promise<CorrectionStatement> => {
    if (!(await tokenCurrent(token, captured))) throw new CorrectionEvidenceError("Session changed. Sign in again before reviewing charges.");
    const query = new URLSearchParams({ limit: String(PAGE_SIZE) });
    if (cursor) query.set("after", cursor);
    const response = await fetcher(`/api/v1/properties/${options.propertyId}/folios/${options.folioId}/statement?${query}`, {
      headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new CorrectionEvidenceError("The current bill statement is unavailable. Retry the read.");
    const body = await response.text();
    if (body.length > MAX_RESPONSE_BYTES || !(await tokenCurrent(token, captured))) throw new CorrectionEvidenceError("The bill read cannot be used in this session.");
    return parseCorrectionStatement(JSON.parse(body), options);
  };
  const scan = async (token: string, captured: number, found: (rows: readonly CorrectionRow[]) => boolean) => {
    const first = await getPage(token, captured);
    let rows = appendPage(first, [], first), page = first;
    const cursors = new Set<string>();
    while (!found(rows) && page.nextCursor !== null) {
      if (cursors.size >= MAX_PAGES - 1 || cursors.has(page.nextCursor)) throw new CorrectionEvidenceError("The statement cursor cannot be safely continued.");
      cursors.add(page.nextCursor); page = await getPage(token, captured, page.nextCursor);
      rows = appendPage(first, rows, page);
    }
    return { first, rows };
  };
  const reconcile = async (attempt: Attempt, captured: number): Promise<CorrectionStatement> => {
    if (!attempt.receipt) throw new Error("Correction receipt is still unavailable.");
    const receipt = attempt.receipt;
    const result = await scan(attempt.token, captured, rows => rows.some(row => row.journalId === receipt.journalId) &&
      rows.some(row => row.lineId === attempt.original.lineId));
    const original = result.rows.find(row => row.lineId === attempt.original.lineId);
    const contra = result.rows.filter(row => row.journalId === receipt.journalId);
    if (!original || original.journalId !== attempt.original.journalId || original.amountMinor !== attempt.original.amountMinor ||
        original.businessDate !== attempt.original.businessDate || original.txCode !== attempt.original.txCode ||
        original.reversedByJournalId !== receipt.journalId || original.correctionEligible || contra.length !== 1 ||
        contra[0]!.kind !== "adjustment" || contra[0]!.reversesJournalId !== attempt.original.journalId ||
        contra[0]!.amountMinor !== receipt.amountMinor || contra[0]!.businessDate !== receipt.businessDate ||
        result.first.folio.currency !== receipt.currency) throw new Error("The refreshed statement has not confirmed the exact correction lineage.");
    return result.first;
  };

  const controller: FolioCorrectionController = {
    getState: () => session.state,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    async load(more = false) {
      if (!active || session.inFlight || session.attempt) return;
      const before = session.state, captured = revision;
      if (more && (!before.page || !before.nextCursor)) return;
      session.inFlight = true;
      publish({ ...before, status: "loading", message: null });
      try {
        const token = await options.getToken();
        if (!token.trim() || more && browsingToken !== token) throw new CorrectionEvidenceError("Session changed. Refresh charges before continuing.");
        const cursor = more ? before.nextCursor : null;
        if (cursor && (seenCursors.has(cursor) || seenCursors.size >= MAX_PAGES - 1)) throw new CorrectionEvidenceError("The statement cursor cannot be safely continued.");
        const page = await getPage(token, captured, cursor);
        if (!current(captured)) return;
        const first = more ? before.page! : page;
        const rows = appendPage(first, more ? before.rows : [], page);
        if (!more) seenCursors = new Set();
        if (cursor) seenCursors.add(cursor);
        browsingToken = token;
        publish({ ...INITIAL, status: "browsing", page: first, rows, nextCursor: page.nextCursor });
      } catch (error) {
        if (current(captured)) publish({ ...INITIAL, status: "browsing", message: error instanceof CorrectionEvidenceError ? error.message : "Charges could not be loaded. Refresh and try again." });
      } finally { session.inFlight = false; }
    },
    select(lineId) {
      const state = session.state;
      if (!active || session.inFlight || session.attempt || state.status !== "browsing" || !state.page) return false;
      const original = state.rows.find(row => row.lineId === lineId);
      if (!original?.correctionEligible) return false;
      const owner = `correction-owner-${crypto.randomUUID()}`;
      if (!options.acquireMutationLease(owner)) { publish({ ...state, message: "Finish the other billing action before reviewing a correction." }); return false; }
      leaseHeld = true;
      session.attempt = { owner, key: "", body: "", original, currency: state.page.folio.currency,
        fingerprint: pageIdentity(state.page), token: browsingToken, uncertain: false, receipt: null };
      publish({ ...state, status: "editing", selected: original, reason: "", message: null }); return true;
    },
    setReason(value) { if (session.state.status === "editing") publish({ ...session.state, reason: value, message: null }); },
    review() {
      const reason = normalizeCorrectionReason(session.state.reason), attempt = session.attempt;
      if (session.state.status !== "editing" || !attempt || !reason) return false;
      attempt.body = JSON.stringify({ reversesJournalId: attempt.original.journalId, reason }); attempt.key = makeKey();
      publish({ ...session.state, status: "review", reason, message: null }); return true;
    },
    edit() {
      if (session.state.status !== "review" || !session.attempt) return;
      session.attempt.key = ""; session.attempt.body = "";
      publish({ ...session.state, status: "editing", message: null });
    },
    cancel() {
      if (session.inFlight || session.state.status === "uncertain" || session.state.status === "posting") return;
      release(); session.attempt = null;
      publish({ ...INITIAL, status: "idle" });
    },
    async submit() {
      const attempt = session.attempt, captured = revision, state = session.state;
      if (!active || session.inFlight || !attempt || !["review", "uncertain"].includes(state.status)) return;
      if (!ensureLease()) { publish({ ...state, message: "Another billing action holds the lock. Reconcile this retained request when it finishes." }); return; }
      session.inFlight = true; let crossed = false;
      publish({ ...state, status: "posting", message: attempt.uncertain ? "Reconciling the retained correction…" : "Refreshing the exact charge before correction…" });
      try {
        if (!(await tokenCurrent(attempt.token, captured))) throw new CorrectionEvidenceError("Session changed. Return to the original authorized session to reconcile this request.");
        if (!attempt.uncertain) {
          const fresh = await scan(attempt.token, captured, rows => rows.some(row => row.lineId === attempt.original.lineId));
          const original = fresh.rows.find(row => row.lineId === attempt.original.lineId);
          if (pageIdentity(fresh.first) !== attempt.fingerprint || !original?.correctionEligible || JSON.stringify(original) !== JSON.stringify(attempt.original))
            throw new CorrectionEvidenceError("The charge or bill changed. Refresh charges and review the current evidence; nothing was sent.");
        }
        if (!attempt.receipt) {
          if (!(await tokenCurrent(attempt.token, captured))) throw new CorrectionEvidenceError("Session changed before the request could be sent.");
          crossed = true; attempt.uncertain = true;
          const response = await fetcher(`/api/v1/properties/${options.propertyId}/folios/${options.folioId}/adjustments`, {
            method: "POST", headers: { authorization: `Bearer ${attempt.token}`, "content-type": "application/json", "idempotency-key": attempt.key },
            body: attempt.body, signal: AbortSignal.timeout(15_000),
          });
          if (!current(captured)) return;
          if (!(await tokenCurrent(attempt.token, captured))) throw new Error("Session changed after the request was sent.");
          if (response.status !== 201) {
            if (state.status !== "uncertain" && [400, 401, 403, 404, 409, 422].includes(response.status)) {
              attempt.uncertain = false; crossed = false;
              throw new CorrectionEvidenceError(response.status === 403 || response.status === 401 ? "Your session cannot correct this charge. Nothing was recorded by this request." :
                "The server refused this correction. Refresh charges and review the current record.");
            }
            throw new Error("The correction response could not be confirmed.");
          }
          const body = await response.text();
          if (body.length > 16_384) invalid();
          const receipt = parseCorrectionReceipt(JSON.parse(body), { folioId: options.folioId, currency: attempt.currency, original: attempt.original });
          const replay = response.headers.get("idempotency-replayed");
          if (replay !== null && replay !== String(receipt.replayed)) invalid();
          attempt.receipt = receipt;
        }
        const page = await reconcile(attempt, captured);
        if (!(await tokenCurrent(attempt.token, captured))) throw new Error("The correction cannot yet be reconciled to this session.");
        const receipt = attempt.receipt!;
        release(); session.attempt = null;
        publish({ ...INITIAL, status: "done", page, rows: page.rows, nextCursor: page.nextCursor,
          message: "Charge corrected. The refreshed statement confirms the original charge and its new reversal." });
        try { options.onReconciled(page, receipt); } catch { /* Confirmed server evidence is not undone by a presentation callback. */ }
      } catch (error) {
        if (!current(captured)) return;
        if (attempt.uncertain || crossed) {
          attempt.uncertain = true;
          publish({ ...session.state, status: "uncertain", message: "The result is not yet confirmed. The charge, reason and operation key remain locked; reconcile this same request before continuing." });
        } else {
          release(); session.attempt = null;
          publish({ ...INITIAL, status: "browsing", message: error instanceof CorrectionEvidenceError ? error.message : "Correction could not start. Refresh charges and review again." });
        }
      } finally { session.inFlight = false; }
    },
    activate() {
      active = true;
      if (session.attempt) {
        ensureLease();
        if (session.state.status === "posting") publish({ ...session.state, status: "uncertain" });
      }
    },
    dispose() {
      active = false; revision += 1; listeners.clear();
      if (session.attempt) {
        if (session.inFlight) { session.attempt.uncertain = true; session.state = Object.freeze({ ...session.state, status: "uncertain" }); }
        retained.set(context, session);
      }
      // Never release an unresolved financial lease merely because its view unmounted.
      leaseHeld = false;
    },
  };
  return Object.freeze(controller);
}
