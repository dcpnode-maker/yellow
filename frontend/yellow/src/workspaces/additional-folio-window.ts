import type { FolioStatement, ReservationDetail } from "../yellow-api";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const CURRENCY = /^[A-Z]{3}$/u;

export type AdditionalFolioBody = Readonly<{ sourceFolioId: string; name: string }>;
export type AdditionalFolioReceipt = Readonly<{
  folioId: string;
  reservationId: string;
  folioNo: string;
  windowNo: number;
  name: string;
  status: "open";
  currency: string;
  changed: boolean;
  replayed: boolean;
}>;
export type AdditionalFolioState = Readonly<{
  status: "closed" | "editing" | "review" | "posting" | "uncertain" | "ready" | "rejected";
  name: string;
  reviewedBody: AdditionalFolioBody | null;
  message: string | null;
}>;
export type AdditionalFolioFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type AdditionalFolioWindowController = Readonly<{
  getState(): AdditionalFolioState;
  subscribe(listener: () => void): () => void;
  open(): boolean;
  setName(value: string): void;
  review(): boolean;
  edit(): void;
  cancel(): void;
  submit(): Promise<void>;
  activate(): void;
  dispose(): void;
}>;

export type AdditionalFolioWindowOptions = Readonly<{
  propertyId: string;
  reservationId: string;
  sourceFolioId: string;
  sourceFolioReference: string | null;
  getToken: () => Promise<string>;
  loadReservation: (reservationId: string) => Promise<ReservationDetail>;
  loadFolioStatement: (reference: string) => Promise<FolioStatement>;
  acquireMutationLease: (attemptId: string) => boolean;
  releaseMutationLease: (attemptId: string) => void;
  onCreated: (reservation: ReservationDetail, statement: FolioStatement, folioId: string) => void;
  fetcher?: AdditionalFolioFetch;
  keyFactory?: () => string;
  attemptFactory?: () => string;
}>;

type Attempt = {
  readonly id: string;
  key: string;
  body: AdditionalFolioBody;
  uncertain: boolean;
  receipt: AdditionalFolioReceipt | null;
};

type RetainedSession = { state: AdditionalFolioState; attempt: Attempt | null; leaseHeld: boolean };
const retainedSessions = new Map<string, RetainedSession>();

const CLOSED: AdditionalFolioState = Object.freeze({ status: "closed", name: "", reviewedBody: null, message: null });

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).sort().join("|") === [...keys].sort().join("|");
}

export function normalizeAdditionalFolioName(value: string): string | null {
  const name = value.trim();
  if (!name || name.length > 80 || Array.from(name).length > 80 || /[\u0000-\u001f\u007f\u200b-\u200d\u202a-\u202e\u2060\u2066-\u2069\ufeff]/u.test(name)) return null;
  return name;
}

export function validateAdditionalFolioReceipt(value: unknown, expected: AdditionalFolioBody, reservationId: string): AdditionalFolioReceipt | null {
  if (!isRecord(value) || !exactKeys(value, ["folioId", "reservationId", "folioNo", "windowNo", "name", "status", "currency", "changed", "replayed"])) return null;
  if (typeof value.folioId !== "string" || !UUID.test(value.folioId) || value.reservationId !== reservationId ||
      value.folioId === expected.sourceFolioId || typeof value.folioNo !== "string" || !value.folioNo.trim() || value.folioNo.length > 80 ||
      !Number.isSafeInteger(value.windowNo) || (value.windowNo as number) < 2 || (value.windowNo as number) > 20 ||
      value.name !== expected.name || value.status !== "open" || typeof value.currency !== "string" || !CURRENCY.test(value.currency) ||
      value.changed !== true || typeof value.replayed !== "boolean") return null;
  return value as unknown as AdditionalFolioReceipt;
}

function matchingReservation(detail: ReservationDetail, receipt: AdditionalFolioReceipt, sourceFolioId: string): boolean {
  if (detail.reservation.reservationId !== receipt.reservationId) return false;
  const source = detail.reservation.folios.find(folio => folio.folioId === sourceFolioId);
  const opened = detail.reservation.folios.find(folio => folio.folioId === receipt.folioId);
  return Boolean(source && opened && source.accountId === opened.accountId && opened.folioNo === receipt.folioNo &&
    opened.name === receipt.name && opened.windowNo === receipt.windowNo && opened.status === "open");
}

function matchingStatement(statement: FolioStatement, receipt: AdditionalFolioReceipt): boolean {
  const sibling = statement.siblingWindows.find(window => window.id === receipt.folioId);
  return statement.reservationId === receipt.reservationId && statement.folio.id === receipt.folioId &&
    statement.folio.reference === receipt.folioNo && statement.folio.name === receipt.name &&
    statement.folio.windowNo === receipt.windowNo && statement.folio.status === "open" &&
    statement.folio.currency === receipt.currency && Boolean(sibling && sibling.windowNo === receipt.windowNo &&
      sibling.reference === receipt.folioNo && sibling.name === receipt.name && sibling.status === "open");
}

function safeError(status: number): string {
  if (status === 401 || status === 403) return "You do not have permission to open this bill window.";
  if (status === 409) return "The server did not open the window. Refresh the bill-window list and check for a duplicate name or the 20-window limit, then cancel and review a different name.";
  if (status === 400 || status === 404 || status === 422) return "The request was rejected. Cancel this draft, refresh the selected bill window, then review the name and source again.";
  return "The bill-window request could not be confirmed. Reconcile the same request before continuing.";
}

export function createAdditionalFolioWindowController(options: AdditionalFolioWindowOptions): AdditionalFolioWindowController {
  const fetcher = options.fetcher ?? fetch;
  const makeKey = options.keyFactory ?? (() => `yellow-additional-folio-${crypto.randomUUID()}`);
  const makeAttemptId = options.attemptFactory ?? (() => `additional-folio-${crypto.randomUUID()}`);
  const contextKey = JSON.stringify([options.propertyId, options.reservationId, options.sourceFolioId]);
  const retained = retainedSessions.get(contextKey);
  const session: RetainedSession = retained ?? { state: CLOSED, attempt: null, leaseHeld: false };
  let state = session.state;
  let attempt = session.attempt;
  // Parent lease refs can be recreated when FinanceWorkspace remounts. A
  // retained UI attempt is not proof that the new parent still owns its lock.
  // Rebinding happens from activate()/submit(), never during React render.
  let leaseHeld = false;
  let running = false;
  let live = true;
  let generation = 0;
  const listeners = new Set<() => void>();
  const publish = (next: AdditionalFolioState) => {
    if (!live) return;
    state = Object.freeze(next);
    session.state = state;
    session.attempt = attempt;
    session.leaseHeld = leaseHeld;
    if (state.status === "closed" || state.status === "ready") retainedSessions.delete(contextKey);
    else retainedSessions.set(contextKey, session);
    listeners.forEach(listener => listener());
  };
  const release = () => {
    if (!leaseHeld || !attempt) return;
    leaseHeld = false;
    options.releaseMutationLease(attempt.id);
    session.leaseHeld = false;
  };
  const ensureLease = (): boolean => {
    if (leaseHeld) return true;
    if (!attempt) return false;
    try { leaseHeld = options.acquireMutationLease(attempt.id); } catch { leaseHeld = false; }
    session.leaseHeld = leaseHeld;
    return leaseHeld;
  };
  const tokenStillCurrent = async (token: string): Promise<boolean> => {
    try { return (await options.getToken()) === token; } catch { return false; }
  };
  const current = (capturedGeneration: number) => live && generation === capturedGeneration;

  type VerifiedReadback = Readonly<{ reservation: ReservationDetail; statement: FolioStatement }>;
  const readBack = async (receipt: AdditionalFolioReceipt, token: string, capturedGeneration: number): Promise<VerifiedReadback | null> => {
    const [reservation, statement, sourceStatement] = await Promise.all([
      options.loadReservation(options.reservationId),
      options.loadFolioStatement(receipt.folioNo),
      options.loadFolioStatement(options.sourceFolioReference ?? options.sourceFolioId),
    ]);
    if (!current(capturedGeneration) || !(await tokenStillCurrent(token))) return null;
    if (!matchingReservation(reservation, receipt, options.sourceFolioId) || !matchingStatement(statement, receipt) ||
        sourceStatement.reservationId !== options.reservationId || sourceStatement.folio.id !== options.sourceFolioId ||
      (options.sourceFolioReference !== null && sourceStatement.folio.reference !== options.sourceFolioReference) || sourceStatement.folio.currency !== receipt.currency) return null;
    return Object.freeze({ reservation, statement });
  };

  const run = async (retry: boolean) => {
    if (running || !attempt || !current(generation)) return;
    const capturedGeneration = generation;
    const currentAttempt = attempt;
    running = true;
    publish({ ...state, status: "posting", message: retry ? "Reconciling the retained bill-window request…" : "Checking the source bill window before opening another…" });
    let crossedMutationBoundary = false;
    let token = "";
    try {
      token = await options.getToken();
      if (!token.trim() || !current(capturedGeneration)) throw new Error("auth");
      if (currentAttempt.receipt) {
        const matched = await readBack(currentAttempt.receipt, token, capturedGeneration);
        if (!current(capturedGeneration)) return;
        if (!matched) throw new Error("readback");
        release();
        attempt = null;
        session.attempt = null;
        retainedSessions.delete(contextKey);
        publish({ ...state, status: "ready", reviewedBody: null, message: "The named bill window is open and matches the reservation and folio statement." });
        try { options.onCreated(matched.reservation, matched.statement, currentAttempt.receipt.folioId); } catch { /* Server readback remains authoritative. */ }
        return;
      }
      let sourceCurrency: string | null = null;
      if (!retry) {
        const [reservation, sourceStatement] = await Promise.all([
          options.loadReservation(options.reservationId),
          options.loadFolioStatement(options.sourceFolioReference ?? options.sourceFolioId),
        ]);
        if (!current(capturedGeneration)) return;
        const source = reservation.reservation.folios.find(item => item.folioId === options.sourceFolioId && item.status === "open");
        if (reservation.reservation.reservationId !== options.reservationId || !source || sourceStatement.reservationId !== options.reservationId ||
            sourceStatement.folio.id !== options.sourceFolioId || (options.sourceFolioReference !== null && sourceStatement.folio.reference !== options.sourceFolioReference) || sourceStatement.folio.status !== "open") {
          throw new Error("preflight");
        }
        const family = reservation.reservation.folios;
        if (family.length >= 20) throw new Error("window-limit");
        if (family.some(item => item.name?.trim().toLocaleLowerCase("en-US") === currentAttempt.body.name.toLocaleLowerCase("en-US"))) {
          throw new Error("duplicate-name");
        }
        sourceCurrency = sourceStatement.folio.currency;
      }
      if (!current(capturedGeneration)) return;
      if (!(await tokenStillCurrent(token))) throw new Error("auth");
      crossedMutationBoundary = true;
      const response = await fetcher(`/api/v1/properties/${encodeURIComponent(options.propertyId)}/reservations/${encodeURIComponent(options.reservationId)}/folios`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}`, "idempotency-key": currentAttempt.key },
        body: JSON.stringify(currentAttempt.body),
      });
      if (!current(capturedGeneration)) return;
      if (!(await tokenStillCurrent(token))) { currentAttempt.uncertain = true; throw new Error("uncertain"); }
      if (response.status !== 201) {
        if (currentAttempt.uncertain || response.status === 408 || response.status === 429 || response.status >= 500 || response.ok) {
          currentAttempt.uncertain = true;
          throw new Error("uncertain");
        }
        release();
        attempt = null;
        publish({ ...state, status: "rejected", reviewedBody: null, message: safeError(response.status) });
        return;
      }
      let receiptBody: unknown;
      try { receiptBody = await response.json(); } catch { currentAttempt.uncertain = true; throw new Error("uncertain"); }
      if (!current(capturedGeneration)) return;
      const receipt = validateAdditionalFolioReceipt(receiptBody, currentAttempt.body, options.reservationId);
      const replayHeader = response.headers.get("idempotency-replayed");
      if (!receipt || (replayHeader !== null && replayHeader !== String(receipt.replayed)) ||
          (sourceCurrency !== null && receipt.currency !== sourceCurrency)) { currentAttempt.uncertain = true; throw new Error("uncertain"); }
      currentAttempt.receipt = receipt;
      currentAttempt.uncertain = true;
      const matched = await readBack(receipt, token, capturedGeneration);
      if (!current(capturedGeneration)) return;
      if (!matched) throw new Error("readback");
      release();
      attempt = null;
      publish({ ...state, status: "ready", reviewedBody: null, message: "The named bill window is open and matches the reservation and folio statement." });
      try { options.onCreated(matched.reservation, matched.statement, receipt.folioId); } catch { /* Server readback remains authoritative. */ }
    } catch (error) {
      if (!current(capturedGeneration)) return;
      const definitiveBeforeMutation = !crossedMutationBoundary && !currentAttempt.uncertain;
      if (definitiveBeforeMutation) {
        release();
        attempt = null;
        const message = error instanceof Error && error.message === "preflight"
          ? "The source window changed or is unavailable. Refresh it and review again; nothing was sent."
          : error instanceof Error && error.message === "duplicate-name"
            ? "That name is already used by this reservation. Edit the draft, choose a different name, and review again; nothing was sent."
            : error instanceof Error && error.message === "window-limit"
              ? "This reservation already has 20 bill windows. No additional window can be opened; cancel to return to the current statement."
              : "Yellow could not refresh the source window or authorize the request. Nothing was sent.";
        publish({ ...state, status: "rejected", reviewedBody: null, message });
      } else {
        currentAttempt.uncertain = true;
        publish({ ...state, status: "uncertain", message: "The outcome is not confirmed. Yellow kept the exact name, source and operation key. Reconcile only this request." });
      }
    } finally {
      running = false;
    }
  };

  return Object.freeze({
    getState: () => state,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    open() {
      if (!live || state.status !== "closed") return false;
      const id = makeAttemptId();
      const lease = options.acquireMutationLease(id);
      if (!lease) {
        publish({ ...state, status: "rejected", message: "Another financial operation is active. Finish it before creating a bill window." });
        return false;
      }
      attempt = { id, key: "", body: Object.freeze({ sourceFolioId: options.sourceFolioId, name: "" }), uncertain: false, receipt: null };
      leaseHeld = true;
      session.attempt = attempt;
      session.leaseHeld = true;
      publish({ status: "editing", name: "", reviewedBody: null, message: null });
      return true;
    },
    setName(value) {
      if (state.status !== "editing") return;
      publish({ ...state, name: value, message: null });
    },
    review() {
      if (state.status !== "editing") return false;
      const name = normalizeAdditionalFolioName(state.name);
      if (!name || !attempt) {
        publish({ ...state, message: "Enter a name between 1 and 80 characters without control characters." });
        return false;
      }
      const body = Object.freeze({ sourceFolioId: options.sourceFolioId, name });
      attempt.key = makeKey();
      attempt.body = body;
      publish({ ...state, name, status: "review", reviewedBody: body, message: null });
      return true;
    },
    edit() {
      if (state.status !== "review") return;
      if (attempt) { attempt.key = ""; attempt.body = Object.freeze({ sourceFolioId: options.sourceFolioId, name: "" }); }
      publish({ ...state, status: "editing", reviewedBody: null, message: null });
    },
    cancel() {
      if (running || state.status === "uncertain" || state.status === "posting") return;
      release();
      attempt = null;
      session.attempt = null;
      session.leaseHeld = false;
      retainedSessions.delete(contextKey);
      publish(CLOSED);
    },
    submit() {
      if (running) return Promise.resolve();
      if (state.status === "review" && attempt && state.reviewedBody) {
        if (!ensureLease()) {
          publish({ ...state, message: "This saved request is waiting for the financial action lock. Try again when the other operation finishes." });
          return Promise.resolve();
        }
        attempt.body = state.reviewedBody;
        attempt.key ||= makeKey();
        return run(false);
      }
      if (state.status === "uncertain" && attempt?.uncertain) {
        if (!ensureLease()) {
          publish({ ...state, message: "This saved request is waiting for the financial action lock. Try reconciliation again when the other operation finishes." });
          return Promise.resolve();
        }
        return run(true);
      }
      return Promise.resolve();
    },
    activate() {
      if (!live) {
        live = true;
        generation += 1;
        running = false;
        state = session.state.status === "posting" && session.attempt
          ? Object.freeze({ ...session.state, status: "uncertain", message: "The view changed while the request was active. Reopen this exact reservation and reconcile the retained request." })
          : session.state;
        attempt = session.attempt;
        leaseHeld = false;
        listeners.forEach(listener => listener());
      }
      if (attempt && !ensureLease()) {
        publish({ ...state, message: "This saved request is waiting for the financial action lock. Try reconciliation again when the other operation finishes." });
      }
    },
    dispose() {
      if (!live) return;
      live = false;
      generation += 1;
      listeners.clear();
      if (attempt && (running || state.status === "posting")) {
        attempt.uncertain = true;
        state = Object.freeze({ ...state, status: "uncertain", message: "The view changed while the request was active. Reopen this exact reservation and reconcile the retained request." });
      }
      if (attempt && (state.status === "editing" || state.status === "review" || state.status === "uncertain" || state.status === "posting")) {
        session.state = state;
        session.attempt = attempt;
        session.leaseHeld = leaseHeld;
        retainedSessions.set(contextKey, session);
      }
      // The old parent ref may not survive remount. Do not release it here;
      // the next activation must claim its own lease for the exact same attempt.
      leaseHeld = false;
    },
  });
}
