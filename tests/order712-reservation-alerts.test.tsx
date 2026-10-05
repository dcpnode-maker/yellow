import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "bun:test";
import type { ReservationDetail } from "../frontend/yellow/src/yellow-api";
import {
  createReservationAlertsClient, matchesReservationAlertReadback, normalizeReservationAlertDraft,
  admitReservationAlertCommand, prepareCreateAlertAttempt, prepareCreateAlertAttemptFromBody,
  prepareDeactivateAlertAttempt, reservationAlertOutcomeUncertain,
  runReservationAlertAttempt, ReservationAlertRequestError, validateReservationAlertReceipt,
  type ReservationAlertAttempt, type ReservationAlertReceipt,
} from "../frontend/yellow/src/reservation-alerts-client";
import { ReservationAlerts } from "../frontend/yellow/src/workspaces/ReservationAlerts";

const propertyId = "71200000-0000-4000-8000-000000000001";
const reservationId = "71200000-0000-4000-8000-000000000002";
const alertId = "71200000-0000-4000-8000-000000000003";
const confirmationNo = "SYN-712";
const key = "order712-alert-key-0001";
const body = Object.freeze({ code: "VIP", message: "Call on arrival\nUse side entrance.", showOn: "checkin" as const });
const createAttempt = prepareCreateAlertAttempt({ propertyId, reservationId, confirmationNo,
  draft: body, key })!;
const existingAlert = Object.freeze({ alertId, code: "VIP", message: "Call on arrival", showOn: "checkin", active: true });
const deactivateAttempt = prepareDeactivateAlertAttempt({ propertyId, reservationId, confirmationNo,
  alert: existingAlert, key })!;
const response = (status: number, value: unknown) => new Response(JSON.stringify(value), {
  status, headers: { "content-type": "application/json" },
});
const createdReceipt: ReservationAlertReceipt = Object.freeze({ id: alertId, code: body.code, message: body.message,
  showOn: body.showOn, active: true, changed: true, replayed: false });
const reservationDetail = (alerts: readonly unknown[]) => ({ reservation: {
  reservationId, confirmationNo, alerts,
} }) as ReservationDetail;
const receiptBody = (receipt: ReservationAlertReceipt) => ({
  alert: { id: receipt.id, code: receipt.code, message: receipt.message, showOn: receipt.showOn, active: receipt.active },
  changed: receipt.changed, replayed: receipt.replayed,
});
const props = (overrides: Partial<Parameters<typeof ReservationAlerts>[0]> = {}) => ({
  propertyId, reservationId, confirmationNo, alerts: [existingAlert], canManageAlerts: true,
  getToken: async () => "synthetic-token", otherMutationBusy: false,
  onLockChange: (_locked: boolean) => {}, onRefreshDetail: async () => reservationDetail([existingAlert]),
  ...overrides,
});

test("alert drafts are bounded and normalized without changing the exact command shape", () => {
  expect(normalizeReservationAlertDraft({ code: " VIP ", message: "  hello\r\nthere\t ", showOn: "always" })).toEqual({
    code: "VIP", message: "hello\r\nthere", showOn: "always",
  });
  expect(normalizeReservationAlertDraft({ code: " ", message: " x".repeat(501), showOn: "checkout" })).toBeNull();
  expect(normalizeReservationAlertDraft({ code: "x".repeat(65), message: "note", showOn: "always" })).toBeNull();
  expect(normalizeReservationAlertDraft({ code: "note\ncode", message: "note", showOn: "always" })).toBeNull();
  expect(normalizeReservationAlertDraft({ code: "note\u0085", message: "ok", showOn: "always" })).toBeNull();
  expect(normalizeReservationAlertDraft({ code: "", message: "note\u0085", showOn: "always" })).toBeNull();
  expect(normalizeReservationAlertDraft({ code: "", message: `x${"😀".repeat(1000)}`, showOn: "always" })).toBeNull();
  expect(normalizeReservationAlertDraft({ code: "😀".repeat(64), message: "😀".repeat(1000), showOn: "always" })).not.toBeNull();
  expect(normalizeReservationAlertDraft({ code: "😀".repeat(65), message: "note", showOn: "always" })).toBeNull();
  expect(normalizeReservationAlertDraft({ code: "", message: "😀".repeat(1001), showOn: "always" })).toBeNull();
  expect(prepareCreateAlertAttempt({ propertyId, reservationId, confirmationNo,
    draft: { code: "", message: "note", showOn: "always" }, key })).toMatchObject({
    operation: "create", body: { code: null, message: "note", showOn: "always" }, key,
  });
});

test("review freezes normalized payload and command admission synchronously rejects a second action", () => {
  const reviewed = normalizeReservationAlertDraft({ code: " VIP ", message: " note ", showOn: "checkout" })!;
  const laterDraft = { code: "OTHER", message: "edited after review", showOn: "always" as const };
  const attempt = prepareCreateAlertAttemptFromBody({ propertyId, reservationId, confirmationNo, body: reviewed, key });
  expect(Object.isFrozen(reviewed)).toBe(true);
  expect(attempt?.body).toEqual({ code: "VIP", message: "note", showOn: "checkout" });
  expect(laterDraft.message).not.toBe(attempt?.body.message);
  const gate = { current: false };
  expect(admitReservationAlertCommand(gate, true)).toBe(true);
  expect(gate.current).toBe(true);
  expect(admitReservationAlertCommand(gate, true)).toBe(false);
  gate.current = false;
  expect(admitReservationAlertCommand(gate, false)).toBe(false);
  expect(gate.current).toBe(false);
});

test("create client sends the canonical exact POST, auth and frozen idempotency key", async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const client = createReservationAlertsClient(async () => "synthetic-token", async (url, init) => {
    calls.push({ url: String(url), init: init! });
    return response(200, receiptBody(createdReceipt));
  });
  const result = await client.execute(createAttempt);
  expect(result).toEqual(createdReceipt);
  expect(calls).toHaveLength(1);
  expect(calls[0]?.url).toBe(`/api/v1/properties/${propertyId}/reservations/${reservationId}/alerts`);
  expect(calls[0]?.init.method).toBe("POST");
  expect((calls[0]?.init.headers as Record<string, string>)?.authorization).toBe("Bearer synthetic-token");
  expect((calls[0]?.init.headers as Record<string, string>)?.["idempotency-key"]).toBe(key);
  expect(JSON.parse(String(calls[0]?.init.body))).toEqual(body);
});

test("invalid receipt never counts as a created alert", () => {
  for (const invalid of [
    { ...receiptBody(createdReceipt), extra: true },
    { ...receiptBody(createdReceipt), changed: false },
    { ...receiptBody(createdReceipt), alert: { ...receiptBody(createdReceipt).alert, active: false } },
    { ...receiptBody(createdReceipt), alert: { ...receiptBody(createdReceipt).alert, message: "different note" } },
    { ...receiptBody(createdReceipt), alert: { ...receiptBody(createdReceipt).alert, id: "not-a-uuid" } },
  ]) expect(() => validateReservationAlertReceipt(invalid, createAttempt)).toThrow(ReservationAlertRequestError);
});

test("deactivate uses exact alert URL and empty body; canonical no-op/replay receipt is accepted", async () => {
  const noOp: ReservationAlertReceipt = Object.freeze({ id: alertId, code: existingAlert.code,
    message: existingAlert.message, showOn: "checkin", active: false, changed: false, replayed: true });
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const client = createReservationAlertsClient(async () => "synthetic-token", async (url, init) => {
    calls.push({ url: String(url), init: init! }); return response(200, receiptBody(noOp));
  });
  expect(await client.execute(deactivateAttempt)).toEqual(noOp);
  expect(calls[0]?.url).toBe(`/api/v1/properties/${propertyId}/reservations/${reservationId}/alerts/${alertId}/deactivate`);
  expect(JSON.parse(String(calls[0]?.init.body))).toEqual({});
});

test("a token failure or stale identity after token acquisition sends no POST", async () => {
  let calls = 0;
  const rejected = createReservationAlertsClient(async () => { throw new Error("private token error"); }, async () => {
    calls += 1; return response(200, receiptBody(createdReceipt));
  });
  await expect(rejected.execute(createAttempt)).rejects.toMatchObject({ uncertain: false, status: 401 });
  let release!: (token: string) => void;
  let current = true;
  const waiting = createReservationAlertsClient(() => new Promise((resolve) => { release = resolve; }), async () => {
    calls += 1; return response(200, receiptBody(createdReceipt));
  });
  const pending = waiting.execute(createAttempt, () => current);
  current = false; release("fresh-token");
  await expect(pending).rejects.toMatchObject({ uncertain: false });
  expect(calls).toBe(0);
});

test("timeout, throttling, network and server errors are uncertain; ordinary refusal is definite", async () => {
  for (const status of [408, 425, 429, 500, 503]) {
    const client = createReservationAlertsClient(async () => "token", async () => response(status, {}));
    await expect(client.execute(createAttempt)).rejects.toMatchObject({ uncertain: true, status });
  }
  const refused = createReservationAlertsClient(async () => "token", async () => response(403, {}));
  await expect(refused.execute(createAttempt)).rejects.toMatchObject({ uncertain: false, status: 403 });
  const disconnected = createReservationAlertsClient(async () => "token", async () => { throw new Error("secret network detail"); });
  await expect(disconnected.execute(createAttempt)).rejects.toMatchObject({ uncertain: true });
});

test("success requires the exact refreshed reservation and matching alert row", async () => {
  const client = createReservationAlertsClient(async () => "token", async () => response(200, receiptBody(createdReceipt)));
  const good = await runReservationAlertAttempt({ client, attempt: createAttempt, isCurrent: () => true,
    refreshDetail: async () => reservationDetail([{ alertId, code: body.code, message: body.message, showOn: body.showOn, active: true }]) });
  expect(good.receipt.id).toBe(alertId);
  expect(matchesReservationAlertReadback(reservationDetail([{ alertId, code: "OTHER", message: body.message, showOn: body.showOn, active: true }]), createAttempt, createdReceipt)).toBe(false);
  await expect(runReservationAlertAttempt({ client, attempt: createAttempt, isCurrent: () => true,
    refreshDetail: async () => reservationDetail([]) })).rejects.toMatchObject({ uncertain: true });
  await expect(runReservationAlertAttempt({ client, attempt: createAttempt, isCurrent: () => true,
    refreshDetail: async () => { throw new Error("raw readback detail"); } })).rejects.toMatchObject({ uncertain: true });
});

test("same frozen key reconciles after readback failure; a later refusal cannot clear sticky uncertainty", async () => {
  const keys: string[] = [];
  const client = createReservationAlertsClient(async () => "token", async (_url, init) => {
    keys.push((init?.headers as Record<string, string>)["idempotency-key"]!);
    return response(200, { ...receiptBody(createdReceipt), replayed: keys.length > 1 });
  });
  await expect(runReservationAlertAttempt({ client, attempt: createAttempt, isCurrent: () => true,
    refreshDetail: async () => { throw new Error("readback unavailable"); } })).rejects.toMatchObject({ uncertain: true });
  const reconciled = await runReservationAlertAttempt({ client, attempt: createAttempt, isCurrent: () => true,
    refreshDetail: async () => reservationDetail([{ alertId, code: body.code, message: body.message, showOn: body.showOn, active: true }]) });
  expect(reconciled.receipt.replayed).toBe(true);
  expect(keys).toEqual([key, key]);
  const refusal = new ReservationAlertRequestError("safe auth refusal", false, 403);
  expect(reservationAlertOutcomeUncertain(true, refusal)).toBe(true);
  expect(reservationAlertOutcomeUncertain(false, refusal)).toBe(false);
});

test("stale context after response suppresses readback success", async () => {
  let current = true; let reads = 0;
  const client = createReservationAlertsClient(async () => "token", async () => response(200, receiptBody(createdReceipt)));
  await expect(runReservationAlertAttempt({ client, attempt: createAttempt, isCurrent: () => current,
    refreshDetail: async () => { reads += 1; current = false; return reservationDetail([]); } })).rejects.toMatchObject({ uncertain: true });
  expect(reads).toBe(1);
});

test("React surface remains readable to view-only staff and requires explicit command review", () => {
  const readonly = renderToStaticMarkup(createElement(ReservationAlerts, props({ canManageAlerts: false })));
  expect(readonly).toContain("Call on arrival");
  expect(readonly).toContain("show on checkin");
  expect(readonly).not.toContain("Create alert");
  expect(readonly).not.toContain("Review deactivation");
  const writable = renderToStaticMarkup(createElement(ReservationAlerts, props()));
  expect(writable).toContain("Create alert");
  expect(writable).toContain("Review deactivation");
  expect(writable).not.toContain("Confirm and create alert");
});

test("component pins sticky retry, double-submit guard, frozen review and App recovery escape hatch", async () => {
  const source = await Bun.file("frontend/yellow/src/workspaces/ReservationAlerts.tsx").text();
  expect(source).toContain("if (inFlight.current || locked || props.otherMutationBusy || !props.canManageAlerts || !reviewing || !createConfirmed) return;");
  expect(source).toContain("if (inFlight.current || locked || props.otherMutationBusy || !props.canManageAlerts || !deactivateConfirmed || !alert.active) return;");
  expect(source).toContain("reservationAlertOutcomeUncertain(uncertain.current, cause)");
  expect(source).toContain("setReviewedBody(body); setReviewing(true); setCreateConfirmed(false); setError(null);");
  expect(source).toContain("body: reviewedBody, key");
  expect(source).toContain('data-lifecycle-recovery={locked ? "true" : undefined}');
  expect(source).toContain("disabled={locked || props.otherMutationBusy || reviewing}");
  expect(source).toContain("maxLength={2000}");
  expect(source).toContain("maxLength={128}");
  expect(source).toContain('status !== "uncertain" || inFlight.current || !attempt.current');
  expect(source).not.toContain("JSON.stringify(cause)");
});
