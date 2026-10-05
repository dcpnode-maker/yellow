/** A presentation controller over the existing cashier custody commands. It never
 * computes cash totals or decides whether a discrepancy is acceptable. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const INTEGER = /^(?:0|[1-9][0-9]*)$/u;
const POSITIVE = /^[1-9][0-9]*$/u;
const MONEY = /^-?(?:0|[1-9][0-9]*)$/u;
const CURRENCY = /^[A-Z]{3}$/u;
const DAY = /^\d{4}-\d{2}-\d{2}$/u;
const CONTROL = /[\u0000-\u001f\u007f\u200b-\u200d\u202a-\u202e\u2060\u2066-\u2069\ufeff]/u;
const MAX_INT64 = 9_223_372_036_854_775_807n;

export type CashDrawerCount = Readonly<{ countId: string; attemptNo: number; countedAt: string; countedBy: string }>;
export type CashDrawer = Readonly<{
  drawerId: string; id?: string; propertyNode: string; code: string; name: string; currency: string;
  denominations: readonly Readonly<{ denominationMinor: string }>[];
  canOpen: boolean; canCount: boolean; canClose: boolean; supervised: boolean;
  session: Readonly<{
    sessionId: string; businessDate: string; openedAt: string; openedBy: string; openingCountId: string;
    latestCount: CashDrawerCount | null; countHistory: readonly CashDrawerCount[];
  }> | null;
}>;
export type CashDrawerSnapshot = Readonly<{ drawers: readonly CashDrawer[] }>;
export type CashAction = "open" | "count" | "request-approval" | "supervised-request" | "approve" | "reject" | "close" | "supervised-close";
export type CashDrawerStatus = "idle" | "editing" | "review" | "posting" | "uncertain" | "ready" | "rejected";
export type CashDrawerState = Readonly<{
  status: CashDrawerStatus; snapshot: CashDrawerSnapshot | null; loading: boolean; readError: string | null;
  selectedDrawerId: string | null; action: CashAction | null; quantities: Readonly<Record<string, string>>;
  reason: string; approvalId: string; reviewed: CashReviewedCommand | null; message: string | null;
  evidence: Readonly<Record<string, unknown>> | null;
}>;
export type CashDrawerFetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
export type CashDrawerOptions = Readonly<{
  propertyId: string; getToken: () => Promise<string>; loadSnapshot: () => Promise<CashDrawerSnapshot>;
  acquireMutationLease: (attemptId: string) => boolean; releaseMutationLease: (attemptId: string) => void;
  onSnapshot?: (fresh: CashDrawerSnapshot) => void; fetcher?: CashDrawerFetcher;
  keyFactory?: () => string; attemptFactory?: () => string;
}>;
export type CashDrawerController = Readonly<{
  getState(): CashDrawerState; subscribe(listener: () => void): () => void; refresh(): Promise<void>;
  selectDrawer(id: string): void; start(action: CashAction): boolean; setQuantity(unit: string, quantity: string): void;
  setReason(value: string): void; setApprovalId(value: string): void; review(): boolean; edit(): void;
  cancel(): void; acknowledge(): void; submit(): Promise<void>; activate(): void; dispose(): void;
}>;
export type CashReviewedCommand = Readonly<{
  action: CashAction; drawerId: string; sessionId: string | null; countId: string | null;
  approvalId: string | null; body: Readonly<Record<string, unknown>>; route: string;
}>;
// Bearer is memory-only and never exposed in state, caches, logs or artifacts.
type Attempt = { id: string; key: string; command: CashReviewedCommand; uncertain: boolean; receipt: Record<string, unknown> | null; bearer: string | null };
type Retained = { state: CashDrawerState; attempt: Attempt | null };
const retained = new Map<string, Retained>();

function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }
function exact(value: Record<string, unknown>, fields: readonly string[]): boolean { return Object.keys(value).sort().join("|") === [...fields].sort().join("|"); }
function integer(value: string, positive = false): boolean { return (positive ? POSITIVE : INTEGER).test(value) && BigInt(value) <= MAX_INT64; }
function countValid(value: unknown): value is CashDrawerCount {
  return record(value) && typeof value.countId === "string" && UUID.test(value.countId) &&
    Number.isSafeInteger(value.attemptNo) && (value.attemptNo as number) > 0 &&
    typeof value.countedBy === "string" && UUID.test(value.countedBy) &&
    typeof value.countedAt === "string" && !Number.isNaN(Date.parse(value.countedAt));
}

export function cashierSnapshotMatches(value: unknown, propertyId: string): value is CashDrawerSnapshot {
  if (!record(value) || !Array.isArray(value.drawers)) return false;
  const ids = new Set<string>();
  return value.drawers.every((item: unknown) => {
    if (!record(item) || typeof item.drawerId !== "string" || !UUID.test(item.drawerId) || ids.has(item.drawerId) ||
        (item.id !== undefined && item.id !== item.drawerId) ||
        item.propertyNode !== propertyId || typeof item.code !== "string" || !item.code || typeof item.name !== "string" || !item.name ||
        typeof item.currency !== "string" || !CURRENCY.test(item.currency) ||
        typeof item.canOpen !== "boolean" || typeof item.canCount !== "boolean" || typeof item.canClose !== "boolean" || typeof item.supervised !== "boolean" ||
        !Array.isArray(item.denominations) || item.denominations.length < 1 || item.denominations.length > 50) return false;
    ids.add(item.drawerId);
    const units = new Set<string>();
    if (!item.denominations.every((line: unknown) => record(line) && typeof line.denominationMinor === "string" && integer(line.denominationMinor, true) && !units.has(line.denominationMinor) && Boolean(units.add(line.denominationMinor)))) return false;
    if (item.session === null) return true;
    if (!record(item.session) || typeof item.session.sessionId !== "string" || !UUID.test(item.session.sessionId) ||
        typeof item.session.businessDate !== "string" || !DAY.test(item.session.businessDate) ||
        typeof item.session.openedAt !== "string" || Number.isNaN(Date.parse(item.session.openedAt)) ||
        typeof item.session.openedBy !== "string" || !UUID.test(item.session.openedBy) ||
        typeof item.session.openingCountId !== "string" || !UUID.test(item.session.openingCountId) ||
        !Array.isArray(item.session.countHistory) ||
        !item.session.countHistory.every((entry: unknown) => countValid(entry))) return false;
    return item.session.latestCount === null || countValid(item.session.latestCount);
  });
}

export function cashDrawerDenominations(drawer: CashDrawer, quantities: Readonly<Record<string, string>>): readonly Readonly<{ denominationMinor: string; quantity: string }>[] | null {
  if (!drawer.denominations.length || Object.keys(quantities).some(unit => !drawer.denominations.some(row => row.denominationMinor === unit))) return null;
  const result = drawer.denominations.map(row => ({ denominationMinor: row.denominationMinor, quantity: quantities[row.denominationMinor] ?? "0" }));
  return result.every(row => integer(row.denominationMinor, true) && integer(row.quantity)) ? Object.freeze(result.map(row => Object.freeze(row))) : null;
}

export function cashDrawerRoute(propertyId: string, command: Pick<CashReviewedCommand, "action" | "sessionId" | "approvalId">): string {
  const base = `/api/v1/properties/${encodeURIComponent(propertyId)}/cashier-sessions`;
  if (command.action === "open") return base;
  const session = `${base}/${encodeURIComponent(command.sessionId ?? "")}`;
  switch (command.action) {
    case "count": return `${session}/counts`;
    case "request-approval": return `${session}/approvals`;
    case "supervised-request": return `${session}/supervised-approvals`;
    case "approve": case "reject": return `${session}/approvals/${encodeURIComponent(command.approvalId ?? "")}/${command.action}`;
    case "close": return `${session}/close`;
    case "supervised-close": return `${session}/supervised-close`;
  }
}

function reviewed(action: CashAction, drawer: CashDrawer, quantities: Readonly<Record<string, string>>, reasonInput: string, approvalInput: string, propertyId: string): CashReviewedCommand | null {
  const sessionId = drawer.session?.sessionId ?? null;
  const countId = drawer.session?.latestCount?.countId ?? null;
  if (action === "open" ? !drawer.canOpen || sessionId !== null : !sessionId) return null;
  if (action === "count" && !drawer.canCount) return null;
  if ((action === "request-approval" || action === "close") && (!drawer.canCount || !countId)) return null;
  if ((action === "supervised-request" || action === "supervised-close" || action === "approve" || action === "reject") && (!drawer.supervised || !countId)) return null;
  if ((action === "close" || action === "supervised-close") && !drawer.canClose) return null;
  const reason = reasonInput.trim();
  const approvalId = approvalInput.trim();
  if (reason && (reason.length > 500 || CONTROL.test(reason))) return null;
  if (approvalId && !UUID.test(approvalId)) return null;
  if ((action === "approve" || action === "reject") && !approvalId) return null;
  if (action === "close" && Boolean(reason) !== Boolean(approvalId)) return null;
  const denominations = action === "open" || action === "count" ? cashDrawerDenominations(drawer, quantities) : null;
  if ((action === "open" || action === "count") && !denominations) return null;
  const body: Record<string, unknown> = action === "open" ? { drawerId: drawer.drawerId, denominations } : action === "count" ? { denominations } :
    action === "request-approval" || action === "supervised-request" ? { countId } :
    action === "approve" || action === "reject" ? {} :
    { countId, ...(reason ? { reason } : {}), ...(approvalId ? { approvalId } : {}) };
  const command = { action, drawerId: drawer.drawerId, sessionId, countId, approvalId: approvalId || null, body: Object.freeze(body), route: "" };
  return Object.freeze({ ...command, route: cashDrawerRoute(propertyId, command) });
}

export function cashierReceiptMatches(value: unknown, command: CashReviewedCommand): value is Record<string, unknown> {
  if (!record(value) || typeof value.replayed !== "boolean") return false;
  const sameSession = value.sessionId === command.sessionId;
  const sameCount = value.countId === command.countId;
  if (command.action === "open") return exact(value, ["sessionId","drawerId","openingCountId","businessDate","currency","openingFloatMinor","expectedMinor","openedAt","replayed"]) &&
    typeof value.sessionId === "string" && UUID.test(value.sessionId) && value.drawerId === command.drawerId && typeof value.openingCountId === "string" && UUID.test(value.openingCountId) &&
    typeof value.businessDate === "string" && DAY.test(value.businessDate) && typeof value.currency === "string" && CURRENCY.test(value.currency) &&
    typeof value.openingFloatMinor === "string" && INTEGER.test(value.openingFloatMinor) && typeof value.expectedMinor === "string" && INTEGER.test(value.expectedMinor) &&
    typeof value.openedAt === "string" && !Number.isNaN(Date.parse(value.openedAt));
  if (command.action === "count") return exact(value, ["countId","sessionId","attemptNo","countedAt","replayed"]) && sameSession &&
    typeof value.countId === "string" && UUID.test(value.countId) && Number.isSafeInteger(value.attemptNo) && (value.attemptNo as number) > 0 &&
    typeof value.countedAt === "string" && !Number.isNaN(Date.parse(value.countedAt));
  if (command.action === "request-approval" || command.action === "supervised-request" || command.action === "approve" || command.action === "reject") {
    const status = command.action === "approve" ? "approved" : command.action === "reject" ? "rejected" : "pending";
    return exact(value, ["approvalId","sessionId","countId","expectedMinor","countedMinor","overShortMinor","status","replayed"]) &&
      sameSession && sameCount && value.status === status && typeof value.approvalId === "string" && UUID.test(value.approvalId) &&
      (command.action === "approve" || command.action === "reject" ? value.approvalId === command.approvalId : true) &&
      [value.expectedMinor, value.countedMinor].every(x => typeof x === "string" && INTEGER.test(x)) &&
      typeof value.overShortMinor === "string" && MONEY.test(value.overShortMinor);
  }
  return exact(value, ["sessionId","openingCountId","closingCountId","businessDate","currency","expectedMinor","countedMinor","overShortMinor","closedAt","closedBy","supervised","replayed"]) &&
    sameSession && value.closingCountId === command.countId && typeof value.openingCountId === "string" && UUID.test(value.openingCountId) &&
    typeof value.businessDate === "string" && DAY.test(value.businessDate) && typeof value.currency === "string" && CURRENCY.test(value.currency) &&
    [value.expectedMinor, value.countedMinor].every(x => typeof x === "string" && INTEGER.test(x)) &&
    typeof value.overShortMinor === "string" && MONEY.test(value.overShortMinor) &&
    typeof value.closedAt === "string" && !Number.isNaN(Date.parse(value.closedAt)) && typeof value.closedBy === "string" && UUID.test(value.closedBy) &&
    value.supervised === (command.action === "supervised-close");
}

export function cashierReadbackMatches(snapshot: CashDrawerSnapshot, command: CashReviewedCommand, receipt: Record<string, unknown>): boolean {
  const drawer = snapshot.drawers.find(item => item.drawerId === command.drawerId);
  if (!drawer) return false;
  if (command.action === "open") return drawer.session?.sessionId === receipt.sessionId && drawer.session?.openingCountId === receipt.openingCountId &&
    drawer.session?.businessDate === receipt.businessDate && drawer.currency === receipt.currency;
  if (command.action === "close" || command.action === "supervised-close") return drawer.session?.sessionId !== command.sessionId;
  if (drawer.session?.sessionId !== command.sessionId) return false;
  if (command.action === "count") return drawer.session.latestCount?.countId === receipt.countId &&
    drawer.session.latestCount?.attemptNo === receipt.attemptNo && drawer.session.latestCount?.countedAt === receipt.countedAt;
  // GET has no approval state; the canonical receipt is the decision evidence.
  return drawer.session.latestCount?.countId === command.countId;
}

function canStartAction(drawer: CashDrawer, action: CashAction): boolean {
  const active = drawer.session !== null;
  const counted = drawer.session?.latestCount !== null && drawer.session?.latestCount !== undefined;
  if (action === "open") return !active && drawer.canOpen;
  if (action === "count") return active && drawer.canCount;
  if (action === "request-approval") return active && counted && drawer.canCount;
  if (action === "close") return active && counted && drawer.canCount && drawer.canClose;
  if (action === "supervised-close") return active && counted && drawer.supervised && drawer.canClose;
  return active && counted && drawer.supervised;
}

const initial = (): CashDrawerState => Object.freeze({ status: "idle", snapshot: null, loading: true, readError: null,
  selectedDrawerId: null, action: null, quantities: {}, reason: "", approvalId: "", reviewed: null, message: null, evidence: null });

export function createCashDrawerController(options: CashDrawerOptions): CashDrawerController {
  const fetcher = options.fetcher ?? fetch;
  const keyFactory = options.keyFactory ?? (() => `yellow-cash-${crypto.randomUUID()}`);
  const attemptFactory = options.attemptFactory ?? (() => `cash-${crypto.randomUUID()}`);
  const saved = retained.get(options.propertyId) ?? { state: initial(), attempt: null };
  let state = saved.state;
  let attempt = saved.attempt;
  let live = true;
  let generation = 0;
  let readRevision = 0;
  let running = false;
  let leaseHeld = false;
  const listeners = new Set<() => void>();
  const current = (g: number) => live && g === generation;
  const publish = (next: CashDrawerState) => {
    if (!live) return;
    state = Object.freeze(next); saved.state = state; saved.attempt = attempt;
    if (attempt) retained.set(options.propertyId, saved); else retained.delete(options.propertyId);
    listeners.forEach(listener => listener());
  };
  const ensureLease = () => {
    if (leaseHeld) return true;
    if (!attempt) return false;
    try { leaseHeld = options.acquireMutationLease(attempt.id); } catch { leaseHeld = false; }
    return leaseHeld;
  };
  const release = () => { if (attempt && leaseHeld) { leaseHeld = false; options.releaseMutationLease(attempt.id); } };
  const tokenCurrent = async (token: string) => { try { return (await options.getToken()) === token; } catch { return false; } };
  const load = async (g: number, revision: number) => {
    const result = await options.loadSnapshot();
    if (!current(g) || revision !== readRevision) throw new Error("stale drawer read");
    if (!cashierSnapshotMatches(result, options.propertyId)) throw new Error("Cash drawer data does not match this property.");
    publish({ ...state, snapshot: result, loading: false, readError: null });
    try { options.onSnapshot?.(result); } catch { /* Cache notification cannot change command evidence. */ }
    return result;
  };
  const readBack = async (command: CashReviewedCommand, receipt: Record<string, unknown>, token: string, g: number) => {
    if (!current(g) || !await tokenCurrent(token)) return false;
    const snapshot = await load(g, ++readRevision);
    return current(g) && await tokenCurrent(token) && cashierReadbackMatches(snapshot, command, receipt);
  };
  const run = async (retry: boolean) => {
    if (!attempt || running || !ensureLease()) { if (attempt && !leaseHeld) publish({ ...state, message: "Another financial action holds the lock. Reconcile this exact request when it is available." }); return; }
    running = true;
    const g = generation, a = attempt;
    publish({ ...state, status: "posting", message: retry ? "Reconciling the retained cashier request…" : "Checking current drawer evidence…" });
    let crossed = false;
    let identityMismatch = false;
    try {
      const token = await options.getToken();
      if (a.bearer !== null && token !== a.bearer) { identityMismatch = true; throw new Error("original cashier session required"); }
      if (!token.trim() || !current(g)) throw new Error("identity");
      if (a.receipt) {
        if (!await readBack(a.command, a.receipt, token, g)) {
          identityMismatch = !await tokenCurrent(token);
          throw new Error("readback");
        }
      } else {
        if (!retry) {
          const fresh = await load(g, ++readRevision);
          if (!current(g) || !preflightMatches(fresh, a.command)) throw new Error("preflight");
        }
        if (!current(g) || !await tokenCurrent(token)) {
          identityMismatch = a.bearer !== null;
          throw new Error("identity");
        }
        // Bind the original credential at the first mutation boundary, after
        // preflight and immediately before the exact POST. A retry cannot borrow
        // another operator's token for this frozen idempotency key.
        if (a.bearer === null) a.bearer = token;
        crossed = true;
        const response = await fetcher(a.command.route, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}`, "idempotency-key": a.key }, body: JSON.stringify(a.command.body) });
        if (!current(g)) return;
        if (!await tokenCurrent(token)) { identityMismatch = true; throw new Error("identity"); }
        const decision = a.command.action === "approve" || a.command.action === "reject";
        if (!(decision ? response.status === 200 : response.status === 200 || response.status === 201)) {
          if (a.uncertain || response.status === 408 || response.status === 429 || response.status >= 500 || response.ok) throw new Error("uncertain");
          release(); attempt = null;
          publish({ ...state, status: "rejected", reviewed: null, message: "The server rejected this cashier action. Refresh the drawer and review a new request; no confirmed change was recorded." });
          return;
        }
        const body: unknown = await response.json();
        if (!cashierReceiptMatches(body, a.command)) throw new Error("uncertain");
        if (!decision && response.status !== (body.replayed ? 200 : 201)) throw new Error("uncertain");
        const replayHeader = response.headers.get("idempotency-replayed");
        if (replayHeader !== null && replayHeader !== String(body.replayed)) throw new Error("uncertain");
        a.receipt = body;
        a.uncertain = true;
        if (!await readBack(a.command, body, token, g)) {
          identityMismatch = !await tokenCurrent(token);
          throw new Error("readback");
        }
      }
      if (!current(g)) return;
      const evidence = a.receipt;
      release(); attempt = null;
      publish({ ...state, status: "ready", reviewed: null, message: "The cashier action is confirmed against current drawer evidence.", evidence });
    } catch {
      if (!current(g)) return;
      if (identityMismatch && a.bearer !== null) {
        a.uncertain = true;
        publish({ ...state, status: "uncertain", message: "This exact cashier request belongs to the original operator session. Return to that session to reconcile it; the request, key and financial lock remain retained." });
        return;
      }
      if (!crossed && !a.uncertain) {
        release(); attempt = null;
        publish({ ...state, status: "rejected", reviewed: null, message: "The current drawer, permission or identity could not be confirmed. No cashier command was sent." });
      } else {
        a.uncertain = true;
        publish({ ...state, status: "uncertain", message: "Outcome unconfirmed. The exact action, body and operation key are retained; reconcile only this request." });
      }
    } finally { running = false; }
  };

  return Object.freeze({
    getState: () => state,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    async refresh() {
      if (!live) return;
      const g = generation, revision = ++readRevision;
      publish({ ...state, loading: state.snapshot === null, readError: null });
      try { await load(g, revision); } catch { if (current(g) && revision === readRevision) publish({ ...state, loading: false, readError: "Current cash drawer data is unavailable. Retry before starting an action." }); }
    },
    selectDrawer(id) { if (state.status !== "idle" && state.status !== "ready" && state.status !== "rejected") return; if (!state.snapshot?.drawers.some(d => d.drawerId === id)) return; publish({ ...state, selectedDrawerId: id, evidence: null, message: null, status: "idle" }); },
    start(action) {
      if (!live || state.status !== "idle" || state.readError || !state.snapshot) return false;
      const drawer = state.snapshot.drawers.find(d => d.drawerId === state.selectedDrawerId);
      if (!drawer || !canStartAction(drawer, action)) return false;
      const id = attemptFactory();
      let acquired = false;
      try { acquired = options.acquireMutationLease(id); } catch { /* Financial lock failure is deny. */ }
      if (!acquired) { publish({ ...state, message: "Another financial action is active." }); return false; }
      leaseHeld = true;
      const quantities = Object.fromEntries(drawer.denominations.map(row => [row.denominationMinor, "0"]));
      // Draft lease starts before a command exists, preventing navigation loss.
      attempt = { id, key: "", command: { action, drawerId: drawer.drawerId, sessionId: drawer.session?.sessionId ?? null,
        countId: drawer.session?.latestCount?.countId ?? null, approvalId: null, body: {}, route: "" }, uncertain: false, receipt: null, bearer: null };
      publish({ ...state, status: "editing", action, quantities, reason: "", approvalId: "", reviewed: null, evidence: null, message: null });
      return true;
    },
    setQuantity(unit, quantity) { if (state.status === "editing" && Object.hasOwn(state.quantities, unit)) publish({ ...state, quantities: { ...state.quantities, [unit]: quantity }, message: null }); },
    setReason(value) { if (state.status === "editing") publish({ ...state, reason: value, message: null }); },
    setApprovalId(value) { if (state.status === "editing") publish({ ...state, approvalId: value, message: null }); },
    review() {
      if (state.status !== "editing" || !attempt || !state.snapshot || state.readError) return false;
      const drawer = state.snapshot.drawers.find(d => d.drawerId === attempt!.command.drawerId);
      if (!drawer || (drawer.session?.sessionId ?? null) !== attempt.command.sessionId ||
          (drawer.session?.latestCount?.countId ?? null) !== attempt.command.countId) {
        publish({ ...state, message: "Drawer session or latest count changed. Cancel this draft and refresh before starting a new action." });
        return false;
      }
      const command = drawer && state.action ? reviewed(state.action, drawer, state.quantities, state.reason, state.approvalId, options.propertyId) : null;
      if (!command) { publish({ ...state, message: "Review configured denominations, current count, reason and approval ID for this action." }); return false; }
      attempt.command = command; attempt.key = keyFactory();
      publish({ ...state, status: "review", reviewed: command, message: null });
      return true;
    },
    edit() { if (state.status !== "review" || !attempt) return; attempt.key = ""; publish({ ...state, status: "editing", reviewed: null, message: null }); },
    cancel() { if (running || state.status === "uncertain" || state.status === "posting") return; release(); attempt = null; publish({ ...state, status: "idle", action: null, reviewed: null, message: null }); },
    acknowledge() { if (state.status !== "ready" && state.status !== "rejected") return; publish({ ...state, status: "idle", action: null, reviewed: null, message: null, evidence: null }); },
    submit() { if (state.status === "review" && attempt?.key) return run(false); if (state.status === "uncertain" && attempt?.uncertain) return run(true); return Promise.resolve(); },
    activate() { if (!live) { live = true; generation += 1; running = false; state = saved.state; attempt = saved.attempt; leaseHeld = false; if (state.status === "posting" && attempt) state = Object.freeze({ ...state, status: "uncertain", message: "View changed during the cashier request. Reconcile the retained request." }); listeners.forEach(l => l()); } if (attempt && !ensureLease()) publish({ ...state, message: "This saved cashier action is waiting for the financial lock." }); },
    dispose() { if (!live) return; live = false; generation += 1; listeners.clear(); if (attempt && (running || state.status === "posting")) { attempt.uncertain = true; state = Object.freeze({ ...state, status: "uncertain", message: "View changed during the cashier request. Reconcile the retained request." }); } if (attempt) { saved.state = state; saved.attempt = attempt; retained.set(options.propertyId, saved); } leaseHeld = false; },
  });
}

function preflightMatches(snapshot: CashDrawerSnapshot, command: CashReviewedCommand): boolean {
  const drawer = snapshot.drawers.find(item => item.drawerId === command.drawerId);
  if (!drawer) return false;
  if (command.action === "open") return drawer.canOpen && drawer.session === null;
  if (drawer.session?.sessionId !== command.sessionId) return false;
  if (command.action === "count") return drawer.canCount;
  if (drawer.session.latestCount?.countId !== command.countId) return false;
  if (command.action === "request-approval") return drawer.canCount;
  if (command.action === "close") return drawer.canCount && drawer.canClose;
  return drawer.supervised && (command.action !== "supervised-close" || drawer.canClose);
}
