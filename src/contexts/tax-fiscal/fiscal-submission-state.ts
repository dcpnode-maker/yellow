import type { FiscalSubmissionMode } from "./fiscal-provider";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const PROVIDER_KEY = /^[a-z0-9](?:[a-z0-9._:-]{0,126}[a-z0-9])?$/;
const REFERENCE = /^[^\u0000-\u001f\u007f]{1,256}$/u;

interface Binding {
  readonly tenantId: string;
  readonly mode: FiscalSubmissionMode;
  readonly providerKey: string;
  readonly attemptId: string;
  readonly documentId: string;
  readonly payloadSha256: string;
}

export type FiscalSubmissionStatus = "pending" | "submitted" | "cleared" | "accepted" | "rejected" | "error";

export type FiscalSubmissionState = Readonly<
  | (Binding & { status: "pending"; disposition: "send" })
  | (Binding & { status: "submitted"; disposition: "lookup";
      reconciliationReason: "transport_started" | "timeout" | "duplicate" | "provider_pending" })
  | (Binding & { status: "cleared" | "accepted" | "rejected"; disposition: "none";
      authorityRef: string; responseSha256: string;
      resolutionSource: "transport_result" | "lookup_result" })
  | (Binding & { status: "error"; disposition: "retry";
      reconciliationReason: "known_not_sent";
      resolutionSource: "transport_result" | "lookup_result" })
>;

export interface FiscalSubmissionInitialInput extends Binding {}

interface EventBinding {
  readonly tenantId: string;
  readonly providerKey: string;
  readonly attemptId: string;
  readonly documentId: string;
  readonly payloadSha256: string;
}

export type FiscalSubmissionEvent = Readonly<
  | (EventBinding & { type: "transport_started" })
  | (EventBinding & { type: "retry_started"; newAttemptId: string })
  | (EventBinding & { type: "transport_result";
      outcome: "pending" | "timeout" | "duplicate" | "known_not_sent" })
  | (EventBinding & { type: "lookup_result"; outcome: "pending" | "known_not_sent" })
  | (EventBinding & { type: "transport_result" | "lookup_result";
      outcome: "cleared" | "accepted" | "rejected";
      authorityRef: string; responseSha256: string })
>;

export type FiscalSubmissionErrorCode =
  | "invalid_input"
  | "binding_mismatch"
  | "transition_not_allowed"
  | "result_conflict"
  | "terminal_immutable";

export interface FiscalSubmissionError {
  readonly code: FiscalSubmissionErrorCode;
  readonly message: string;
}

export type FiscalSubmissionResult = Readonly<
  | { ok: true; value: FiscalSubmissionState; replayed: boolean }
  | { ok: false; error: FiscalSubmissionError }
>;

function frozen<T extends object>(value: T): Readonly<T> {
  return Object.freeze(value);
}

function fail(code: FiscalSubmissionErrorCode, message: string): FiscalSubmissionResult {
  return frozen({ ok: false, error: frozen({ code, message }) });
}

function success(value: FiscalSubmissionState, replayed = false): FiscalSubmissionResult {
  return frozen({ ok: true, value: copyState(value), replayed });
}

function record(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.some(key => typeof key === "symbol")) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    for (const key of keys) {
      const descriptor = descriptors[String(key)];
      if (!descriptor || descriptor.get !== undefined || descriptor.set !== undefined
        || !("value" in descriptor) || descriptor.enumerable !== true) return null;
    }
    return Object.fromEntries(keys.map(key => [String(key), descriptors[String(key)]!.value]));
  } catch {
    return null;
  }
}

function exact(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function binding(value: Record<string, unknown>): value is Record<string, unknown> & EventBinding {
  return typeof value.tenantId === "string" && UUID.test(value.tenantId)
    && typeof value.providerKey === "string" && PROVIDER_KEY.test(value.providerKey)
    && typeof value.attemptId === "string" && UUID.test(value.attemptId)
    && typeof value.documentId === "string" && UUID.test(value.documentId)
    && typeof value.payloadSha256 === "string" && SHA256.test(value.payloadSha256);
}

function validMode(value: unknown): value is FiscalSubmissionMode {
  return value === "clearance" || value === "reporting" || value === "peppol" || value === "exchange";
}

function validState(value: unknown): value is FiscalSubmissionState {
  const row = record(value);
  if (!row || !binding(row) || !validMode(row.mode)
    || typeof row.status !== "string" || typeof row.disposition !== "string") return false;
  const base = ["tenantId", "mode", "providerKey", "attemptId", "documentId", "payloadSha256", "status", "disposition"];
  switch (row.status) {
    case "pending": return row.disposition === "send" && exact(row, base);
    case "submitted": return row.disposition === "lookup"
      && (row.reconciliationReason === "transport_started" || row.reconciliationReason === "timeout"
        || row.reconciliationReason === "duplicate" || row.reconciliationReason === "provider_pending")
      && exact(row, [...base, "reconciliationReason"]);
    case "cleared":
    case "accepted":
    case "rejected": return (row.status === "rejected" || (row.status === "cleared") === (row.mode === "clearance"))
      && row.disposition === "none" && typeof row.authorityRef === "string"
      && REFERENCE.test(row.authorityRef) && typeof row.responseSha256 === "string"
      && SHA256.test(row.responseSha256)
      && (row.resolutionSource === "transport_result" || row.resolutionSource === "lookup_result")
      && exact(row, [...base, "authorityRef", "responseSha256", "resolutionSource"]);
    case "error": return row.disposition === "retry" && row.reconciliationReason === "known_not_sent"
      && (row.resolutionSource === "transport_result" || row.resolutionSource === "lookup_result")
      && exact(row, [...base, "reconciliationReason", "resolutionSource"]);
    default: return false;
  }
}

function validEvent(value: unknown): value is FiscalSubmissionEvent {
  const row = record(value);
  if (!row || !binding(row) || typeof row.type !== "string") return false;
  const base = ["type", "tenantId", "providerKey", "attemptId", "documentId", "payloadSha256"];
  switch (row.type) {
    case "transport_started": return exact(row, base);
    case "retry_started": return typeof row.newAttemptId === "string" && UUID.test(row.newAttemptId)
      && row.newAttemptId !== row.attemptId && exact(row, [...base, "newAttemptId"]);
    case "transport_result":
      if (row.outcome === "pending" || row.outcome === "timeout" || row.outcome === "duplicate" || row.outcome === "known_not_sent") {
        return exact(row, [...base, "outcome"]);
      }
      return terminalEvent(row, base);
    case "lookup_result":
      if (row.outcome === "pending" || row.outcome === "known_not_sent") {
        return exact(row, [...base, "outcome"]);
      }
      return terminalEvent(row, base);
    default: return false;
  }
}

function terminalEvent(value: Record<string, unknown>, base: readonly string[]): boolean {
  return (value.outcome === "cleared" || value.outcome === "accepted" || value.outcome === "rejected")
    && typeof value.authorityRef === "string" && REFERENCE.test(value.authorityRef)
    && typeof value.responseSha256 === "string" && SHA256.test(value.responseSha256)
    && exact(value, [...base, "outcome", "authorityRef", "responseSha256"]);
}

function sameBinding(state: FiscalSubmissionState, event: FiscalSubmissionEvent): boolean {
  return state.attemptId === event.attemptId && state.documentId === event.documentId
    && state.payloadSha256 === event.payloadSha256 && state.tenantId === event.tenantId
    && state.providerKey === event.providerKey;
}

type StatePatch =
  | { readonly status: "pending"; readonly disposition: "send" }
  | { readonly status: "submitted"; readonly disposition: "lookup";
      readonly reconciliationReason: "transport_started" | "timeout" | "duplicate" | "provider_pending" }
  | { readonly status: "cleared" | "accepted" | "rejected"; readonly disposition: "none";
      readonly authorityRef: string; readonly responseSha256: string;
      readonly resolutionSource: "transport_result" | "lookup_result" }
  | { readonly status: "error"; readonly disposition: "retry"; readonly reconciliationReason: "known_not_sent";
      readonly resolutionSource: "transport_result" | "lookup_result" };

function withState(state: FiscalSubmissionState, patch: StatePatch): FiscalSubmissionState {
  const base = { tenantId: state.tenantId, mode: state.mode, providerKey: state.providerKey,
    attemptId: state.attemptId, documentId: state.documentId, payloadSha256: state.payloadSha256 };
  switch (patch.status) {
    case "pending": return frozen({ ...base, status: patch.status, disposition: patch.disposition });
    case "submitted": return frozen({ ...base, status: patch.status, disposition: patch.disposition,
      reconciliationReason: patch.reconciliationReason });
    case "cleared":
    case "accepted":
    case "rejected": return frozen({ ...base, status: patch.status, disposition: patch.disposition,
      authorityRef: patch.authorityRef, responseSha256: patch.responseSha256,
      resolutionSource: patch.resolutionSource });
    case "error": return frozen({ ...base, status: patch.status, disposition: patch.disposition,
      reconciliationReason: patch.reconciliationReason, resolutionSource: patch.resolutionSource });
    default: return assertNever(patch);
  }
}

function copyState(state: FiscalSubmissionState): FiscalSubmissionState {
  switch (state.status) {
    case "pending": return withState(state, { status: state.status, disposition: state.disposition });
    case "submitted": return withState(state, { status: state.status, disposition: state.disposition,
      reconciliationReason: state.reconciliationReason });
    case "cleared":
    case "accepted":
    case "rejected": return withState(state, { status: state.status, disposition: state.disposition,
      authorityRef: state.authorityRef, responseSha256: state.responseSha256,
      resolutionSource: state.resolutionSource });
    case "error": return withState(state, { status: state.status, disposition: state.disposition,
      reconciliationReason: state.reconciliationReason, resolutionSource: state.resolutionSource });
    default: return assertNever(state);
  }
}

function stateSnapshot(value: unknown): FiscalSubmissionState | null {
  const row = record(value);
  if (!row || !validState(row)) return null;
  return copyState(row);
}

function eventSnapshot(value: unknown): FiscalSubmissionEvent | null {
  const row = record(value);
  if (!row || !validEvent(row)) return null;
  const base = { tenantId: row.tenantId, providerKey: row.providerKey,
    attemptId: row.attemptId, documentId: row.documentId, payloadSha256: row.payloadSha256 };
  switch (row.type) {
    case "transport_started": return frozen({ ...base, type: row.type });
    case "retry_started": return frozen({ ...base, type: row.type, newAttemptId: row.newAttemptId });
    case "transport_result":
      if (row.outcome === "cleared" || row.outcome === "accepted" || row.outcome === "rejected") {
        return frozen({ ...base, type: row.type, outcome: row.outcome,
          authorityRef: row.authorityRef, responseSha256: row.responseSha256 });
      }
      return frozen({ ...base, type: row.type, outcome: row.outcome });
    case "lookup_result":
      if (row.outcome === "cleared" || row.outcome === "accepted" || row.outcome === "rejected") {
        return frozen({ ...base, type: row.type, outcome: row.outcome,
          authorityRef: row.authorityRef, responseSha256: row.responseSha256 });
      }
      return frozen({ ...base, type: row.type, outcome: row.outcome });
    default: return assertNever(row);
  }
}

export function createFiscalSubmissionState(input: unknown): FiscalSubmissionResult {
  const row = record(input);
  if (!row || !exact(row, ["tenantId", "mode", "providerKey", "attemptId", "documentId", "payloadSha256"])
    || !validMode(row.mode) || !binding(row)) return fail("invalid_input", "fiscal submission input is invalid");
  return success(frozen({ tenantId: row.tenantId, mode: row.mode, providerKey: row.providerKey, attemptId: row.attemptId,
    documentId: row.documentId, payloadSha256: row.payloadSha256,
    status: "pending", disposition: "send" }));
}

export function reduceFiscalSubmission(stateValue: unknown, eventValue: unknown): FiscalSubmissionResult {
  const state = stateSnapshot(stateValue);
  const event = eventSnapshot(eventValue);
  if (!state || !event) {
    return fail("invalid_input", "fiscal submission state or event is invalid");
  }
  if (!sameBinding(state, event)) return fail("binding_mismatch", "fiscal submission binding does not match");

  switch (state.status) {
    case "pending":
      if (event.type !== "transport_started") {
        return fail("transition_not_allowed", "pending fiscal submission can only start transport");
      }
      return success(withState(state, { status: "submitted", disposition: "lookup",
        reconciliationReason: "transport_started" }));
    case "submitted": {
      if (event.type === "transport_started" && state.reconciliationReason === "transport_started") {
        return success(state, true);
      }
      if (event.type !== "transport_result" && event.type !== "lookup_result") {
        return fail("transition_not_allowed", "submitted fiscal submission requires reconciliation");
      }
      if (event.outcome === "timeout" || event.outcome === "duplicate" || event.outcome === "pending") {
        const reason = event.outcome === "pending" ? "provider_pending" : event.outcome;
        if (state.reconciliationReason === reason) return success(state, true);
        return success(withState(state, { status: "submitted", disposition: "lookup", reconciliationReason: reason }));
      }
      if (event.outcome === "known_not_sent") {
        return success(withState(state, { status: "error", disposition: "retry",
          reconciliationReason: "known_not_sent", resolutionSource: event.type }));
      }
      if ((event.outcome === "cleared" && state.mode !== "clearance")
        || (event.outcome === "accepted" && state.mode === "clearance")) {
        return fail("result_conflict", "provider result conflicts with fiscal submission mode");
      }
      const resolved = event as FiscalSubmissionEvent & {
        readonly authorityRef: string;
        readonly responseSha256: string;
      };
      return success(withState(state, { status: event.outcome, disposition: "none",
        authorityRef: resolved.authorityRef, responseSha256: resolved.responseSha256,
        resolutionSource: event.type }));
    }
    case "error":
      if ((event.type === "transport_result" || event.type === "lookup_result")
        && event.type === state.resolutionSource && event.outcome === "known_not_sent") {
        return success(state, true);
      }
      if (event.type !== "retry_started") {
        return fail("transition_not_allowed", "known-not-sent fiscal submission requires an explicit new attempt");
      }
      return success(frozen({ tenantId: state.tenantId, mode: state.mode, providerKey: state.providerKey,
        attemptId: event.newAttemptId, documentId: state.documentId, payloadSha256: state.payloadSha256,
        status: "pending", disposition: "send" }));
    case "cleared":
    case "accepted":
    case "rejected": {
      const resolved = event as FiscalSubmissionEvent & {
        readonly authorityRef?: string;
        readonly responseSha256?: string;
      };
      if ((event.type === "transport_result" || event.type === "lookup_result")
        && event.type === state.resolutionSource && event.outcome === state.status
        && resolved.authorityRef === state.authorityRef
        && resolved.responseSha256 === state.responseSha256) return success(state, true);
      return fail("terminal_immutable", "terminal fiscal submission is immutable");
    }
    default: return assertNever(state);
  }
}

function assertNever(value: never): never {
  throw new Error(`unreachable fiscal submission state: ${String(value)}`);
}
