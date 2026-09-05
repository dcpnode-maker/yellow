import { describe, expect, test } from "bun:test";
import {
  createFiscalSubmissionState,
  reduceFiscalSubmission,
  type FiscalSubmissionState,
} from "../src/contexts/tax-fiscal/fiscal-submission-state";

const DOCUMENT = "00000000-0000-4000-8000-000000000440";
const ATTEMPT = "00000000-0000-4000-8000-000000000441";
const RETRY = "00000000-0000-4000-8000-000000000442";
const TENANT = "00000000-0000-4000-8000-000000000444";
const PAYLOAD = "a".repeat(64);
const RESPONSE = "b".repeat(64);

function initial(mode: "clearance" | "reporting" | "peppol" | "exchange" = "reporting") {
  const result = createFiscalSubmissionState({
    tenantId: TENANT, mode, providerKey: "in-irp", attemptId: ATTEMPT,
    documentId: DOCUMENT, payloadSha256: PAYLOAD,
  });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

function event<T extends Record<string, unknown>>(type: string, fields: T = {} as T) {
  return Object.freeze({ type, tenantId: TENANT, providerKey: "in-irp",
    attemptId: ATTEMPT, documentId: DOCUMENT,
    payloadSha256: PAYLOAD, ...fields });
}

function transition(state: FiscalSubmissionState, input: ReturnType<typeof event>) {
  return reduceFiscalSubmission(state, input);
}

function value(result: ReturnType<typeof transition>): FiscalSubmissionState {
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

describe("Order440 pure fiscal submission lifecycle", () => {
  test("creates one immutable pending identity without mutating input", () => {
    const input = { tenantId: TENANT, mode: "reporting" as const, providerKey: "in-irp", attemptId: ATTEMPT,
      documentId: DOCUMENT, payloadSha256: PAYLOAD };
    const result = createFiscalSubmissionState(input);
    expect(result).toEqual({ ok: true, replayed: false, value: {
      ...input, status: "pending", disposition: "send",
    }});
    expect(Object.isFrozen(result)).toBeTrue();
    expect(result.ok && Object.isFrozen(result.value)).toBeTrue();
    expect(Object.isFrozen(input)).toBeFalse();
  });

  test("validates exact bounded initial input", () => {
    for (const candidate of [
      null, {}, { tenantId: TENANT, mode: "none", providerKey: "in-irp", attemptId: ATTEMPT, documentId: DOCUMENT, payloadSha256: PAYLOAD },
      { tenantId: TENANT, mode: "reporting", providerKey: "", attemptId: ATTEMPT, documentId: DOCUMENT, payloadSha256: PAYLOAD },
      { tenantId: TENANT, mode: "reporting", providerKey: "in-irp", attemptId: "bad", documentId: DOCUMENT, payloadSha256: PAYLOAD },
      { tenantId: TENANT, mode: "reporting", providerKey: "in-irp", attemptId: ATTEMPT, documentId: DOCUMENT, payloadSha256: "A".repeat(64) },
      { tenantId: TENANT, mode: "reporting", providerKey: "in-irp", attemptId: ATTEMPT, documentId: DOCUMENT, payloadSha256: PAYLOAD, secret: "x" },
    ]) expect(createFiscalSubmissionState(candidate)).toMatchObject({ ok: false, error: { code: "invalid_input" } });
  });

  test("exhausts the persisted status vocabulary with mode-correct terminal results", () => {
    const statuses = new Set<string>();
    for (const mode of ["clearance", "reporting", "peppol", "exchange"] as const) {
      const pending = initial(mode); statuses.add(pending.status);
      const submitted = transition(pending, event("transport_started"));
      expect(submitted).toMatchObject({ ok: true, value: { status: "submitted", disposition: "lookup" } });
      if (!submitted.ok) continue;
      statuses.add(submitted.value.status);
      const resolved = transition(submitted.value, event("transport_result", {
        outcome: mode === "clearance" ? "cleared" : "accepted",
        authorityRef: `${mode}-authority`, responseSha256: RESPONSE,
      }));
      expect(resolved).toMatchObject({ ok: true, value: {
        status: mode === "clearance" ? "cleared" : "accepted", disposition: "none",
      }});
      if (resolved.ok) statuses.add(resolved.value.status);
    }
    const rejected = transition(value(transition(initial(), event("transport_started"))),
      event("transport_result", { outcome: "rejected", authorityRef: "rejection-440", responseSha256: RESPONSE }));
    const errored = transition(value(transition(initial(), event("transport_started"))),
      event("transport_result", { outcome: "known_not_sent" }));
    if (rejected.ok) statuses.add(rejected.value.status);
    if (errored.ok) statuses.add(errored.value.status);
    expect([...statuses].sort()).toEqual(["accepted", "cleared", "error", "pending", "rejected", "submitted"]);
    const clearanceStarted = value(transition(initial("clearance"), event("transport_started")));
    expect(transition(clearanceStarted, event("transport_result", {
      outcome: "rejected", authorityRef: "clearance-rejected", responseSha256: RESPONSE,
    }))).toMatchObject({ ok: true, value: { status: "rejected" } });
  });

  test("timeouts and duplicates require lookup and never permit blind resend", () => {
    for (const outcome of ["timeout", "duplicate"] as const) {
      const started = transition(initial(), event("transport_started"));
      if (!started.ok) throw new Error(started.error.message);
      const uncertain = transition(started.value, event("transport_result", { outcome }));
      expect(uncertain).toMatchObject({ ok: true, value: {
        status: "submitted", disposition: "lookup", reconciliationReason: outcome,
      }});
      if (!uncertain.ok) continue;
      expect(transition(uncertain.value, event("retry_started", { newAttemptId: RETRY })))
        .toMatchObject({ ok: false, error: { code: "transition_not_allowed" } });
      const pending = transition(uncertain.value, event("lookup_result", { outcome: "pending" }));
      expect(pending).toMatchObject({ ok: true, value: { status: "submitted", disposition: "lookup" } });
    }
  });

  test("only known-not-sent enables a new bounded attempt", () => {
    const started = transition(initial(), event("transport_started"));
    if (!started.ok) throw new Error(started.error.message);
    const notSent = transition(started.value, event("transport_result", { outcome: "known_not_sent" }));
    expect(notSent).toMatchObject({ ok: true, value: { status: "error", disposition: "retry" } });
    if (!notSent.ok) return;
    const retry = reduceFiscalSubmission(notSent.value, event("retry_started", { newAttemptId: RETRY }));
    expect(retry).toEqual({ ok: true, replayed: false, value: {
      tenantId: TENANT, mode: "reporting", providerKey: "in-irp", attemptId: RETRY, documentId: DOCUMENT,
      payloadSha256: PAYLOAD, status: "pending", disposition: "send",
    }});
  });

  test("lookup resolves verified duplicate or uncertain delivery without resending", () => {
    const started = transition(initial(), event("transport_started"));
    if (!started.ok) throw new Error(started.error.message);
    const uncertain = transition(started.value, event("transport_result", { outcome: "duplicate" }));
    if (!uncertain.ok) throw new Error(uncertain.error.message);
    const accepted = transition(uncertain.value, event("lookup_result", {
      outcome: "accepted", authorityRef: "irp-440", responseSha256: RESPONSE,
    }));
    expect(accepted).toMatchObject({ ok: true, value: {
      status: "accepted", authorityRef: "irp-440", responseSha256: RESPONSE,
    }});
  });

  test("terminal states are immutable, exact replay is stable, and conflicts fail closed", () => {
    const started = transition(initial(), event("transport_started"));
    if (!started.ok) throw new Error(started.error.message);
    const resultEvent = event("transport_result", {
      outcome: "accepted", authorityRef: "irp-440", responseSha256: RESPONSE,
    });
    const accepted = transition(started.value, resultEvent);
    if (!accepted.ok) throw new Error(accepted.error.message);
    expect(transition(accepted.value, resultEvent)).toEqual({ ...accepted, replayed: true });
    expect(transition(accepted.value, event("lookup_result", {
      outcome: "rejected", authorityRef: "different", responseSha256: RESPONSE,
    }))).toMatchObject({ ok: false, error: { code: "terminal_immutable" } });
  });

  test("rejects stale attempts, documents, payloads, malformed events, and mode-conflicting results", () => {
    const state = initial();
    for (const changed of [
      { attemptId: RETRY },
      { documentId: "00000000-0000-4000-8000-000000000443" },
      { payloadSha256: "c".repeat(64) },
      { tenantId: "00000000-0000-4000-8000-000000000445" },
      { providerKey: "other-provider" },
    ]) expect(transition(state, event("transport_started", changed)))
      .toMatchObject({ ok: false, error: { code: "binding_mismatch" } });
    expect(transition(state, event("unknown"))).toMatchObject({ ok: false, error: { code: "invalid_input" } });
    const started = transition(state, event("transport_started"));
    if (!started.ok) return;
    expect(transition(started.value, event("transport_result", {
      outcome: "cleared", authorityRef: "wrong-mode", responseSha256: RESPONSE,
    }))).toMatchObject({ ok: false, error: { code: "result_conflict" } });
  });

  test("rejects every event family outside its admitted state", () => {
    const result = (outcome: "accepted" | "rejected" = "accepted") => event("transport_result", {
      outcome, authorityRef: `result-${outcome}`, responseSha256: RESPONSE,
    });
    const pending = initial();
    for (const invalid of [result(), event("lookup_result", { outcome: "pending" }),
      event("retry_started", { newAttemptId: RETRY })]) {
      expect(transition(pending, invalid)).toMatchObject({ ok: false, error: { code: "transition_not_allowed" } });
    }
    const submitted = value(transition(pending, event("transport_started")));
    expect(transition(submitted, event("retry_started", { newAttemptId: RETRY })))
      .toMatchObject({ ok: false, error: { code: "transition_not_allowed" } });
    const errored = value(transition(submitted, event("transport_result", { outcome: "known_not_sent" })));
    for (const invalid of [event("transport_started"), event("lookup_result", { outcome: "pending" }), result()]) {
      expect(transition(errored, invalid)).toMatchObject({ ok: false, error: { code: "transition_not_allowed" } });
    }
    const terminal = value(transition(submitted, result("rejected")));
    for (const invalid of [event("transport_started"), event("lookup_result", { outcome: "pending" }),
      event("retry_started", { newAttemptId: RETRY }), result()]) {
      expect(transition(terminal, invalid)).toMatchObject({ ok: false, error: { code: "terminal_immutable" } });
    }
  });

  test("freezes a copied replay result when state was hydrated as mutable", () => {
    const submitted = value(transition(initial(), event("transport_started")));
    const hydrated = { ...submitted };
    expect(Object.isFrozen(hydrated)).toBeFalse();
    const replay = reduceFiscalSubmission(hydrated, event("transport_started"));
    expect(replay.ok).toBeTrue();
    expect(replay.ok && Object.isFrozen(replay.value)).toBeTrue();
    expect(Object.isFrozen(hydrated)).toBeFalse();
    expect(replay.ok && replay.value).not.toBe(hydrated);
  });

  test("normalizes provider pending transport to lookup without blind resend", () => {
    const submitted = value(transition(initial(), event("transport_started")));
    expect(transition(submitted, event("transport_result", { outcome: "pending" })))
      .toMatchObject({ ok: true, value: { status: "submitted", disposition: "lookup",
        reconciliationReason: "provider_pending" } });
  });

  test("rejects impossible hydrated mode/status combinations", () => {
    const reporting = value(transition(value(transition(initial(), event("transport_started"))),
      event("transport_result", { outcome: "accepted", authorityRef: "accepted-440", responseSha256: RESPONSE })));
    expect(reduceFiscalSubmission({ ...reporting, status: "cleared" }, event("transport_result", {
      outcome: "cleared", authorityRef: "accepted-440", responseSha256: RESPONSE,
    }))).toMatchObject({ ok: false, error: { code: "invalid_input" } });
    const clearance = value(transition(value(transition(initial("clearance"), event("transport_started"))),
      event("transport_result", { outcome: "cleared", authorityRef: "cleared-440", responseSha256: RESPONSE })));
    expect(reduceFiscalSubmission({ ...clearance, status: "accepted" }, event("transport_result", {
      outcome: "accepted", authorityRef: "cleared-440", responseSha256: RESPONSE,
    }))).toMatchObject({ ok: false, error: { code: "invalid_input" } });
  });

  test("rejects accessors and symbols without executing getters", () => {
    let reads = 0;
    const accessor = { tenantId: TENANT, mode: "reporting", providerKey: "in-irp", attemptId: ATTEMPT,
      documentId: DOCUMENT, payloadSha256: PAYLOAD } as Record<PropertyKey, unknown>;
    Object.defineProperty(accessor, "payloadSha256", { enumerable: true, get() { reads += 1; return PAYLOAD; } });
    expect(createFiscalSubmissionState(accessor)).toMatchObject({ ok: false, error: { code: "invalid_input" } });
    expect(reads).toBe(0);
    const symbol = { tenantId: TENANT, mode: "reporting", providerKey: "in-irp", attemptId: ATTEMPT,
      documentId: DOCUMENT, payloadSha256: PAYLOAD, [Symbol("secret")]: true };
    expect(createFiscalSubmissionState(symbol)).toMatchObject({ ok: false, error: { code: "invalid_input" } });
    const hydrated = { ...initial() } as Record<PropertyKey, unknown>;
    Object.defineProperty(hydrated, "status", { enumerable: true, get() { reads += 1; return "pending"; } });
    expect(reduceFiscalSubmission(hydrated, event("transport_started")))
      .toMatchObject({ ok: false, error: { code: "invalid_input" } });
    expect(reads).toBe(0);
    const hostile = new Proxy({}, { ownKeys() { throw new Error("must stay contained"); } });
    expect(createFiscalSubmissionState(hostile)).toMatchObject({ ok: false, error: { code: "invalid_input" } });
  });

  test("reduces only descriptor snapshots and never reads validated proxies again", () => {
    let stateReads = 0;
    let eventReads = 0;
    const state = new Proxy({ ...initial() }, {
      get() { stateReads += 1; throw new Error("post-validation state access"); },
    });
    const input = new Proxy({ ...event("transport_started") }, {
      get() { eventReads += 1; throw new Error("post-validation event access"); },
    });
    expect(reduceFiscalSubmission(state, input)).toMatchObject({
      ok: true, value: { status: "submitted", disposition: "lookup" },
    });
    expect({ stateReads, eventReads }).toEqual({ stateReads: 0, eventReads: 0 });
  });
});
