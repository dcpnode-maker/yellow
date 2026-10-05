import { afterAll, expect, test } from "bun:test";

Object.assign(globalThis, {
  window: { location: { pathname: "/p/property-a/reservations", search: "" } },
});

const originalFetch = globalThis.fetch;
const apiModulePath = "../frontend/yellow/src/yellow-api.tsx";
const api = await import(apiModulePath);
const { reservationVoiceAction } = await import("../frontend/yellow/src/voice");

const propertyId = "6081b544-22a1-534f-a86d-bb1ae0519e14";
const reservationId = "5eaf4bf3-bcab-4b35-99a0-8d887649b67d";
const cancellationNo = `C-${reservationId.replaceAll("-", "").toUpperCase()}`;
const policyDecision = Object.freeze({
  evidence: "none" as const,
  policy_id: null,
  content_hash: null,
  rule_before_hours: null,
  penalty: null,
});
const cancellationEnvelope = Object.freeze({
  reservation: Object.freeze({
    reservationId,
    previousStatus: "due_in",
    status: "cancelled",
    cancellationNo,
    cancelledAt: "2026-09-23T10:11:12.000Z",
    releasedClaimCount: 1,
    policyDecision,
    approvalId: null,
    penaltyJournalId: null,
  }),
});
const reinstatementEnvelope = Object.freeze({
  reservation: Object.freeze({
    reservationId,
    previousStatus: "cancelled",
    status: "reserved",
    reclaimedClaimCount: 1,
  }),
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});

test("resolves named lifecycle speech only to the real reservation workspace", () => {
  const reservations = [{
    reservationId,
    confirmationNo: "Y-610",
    primaryGuestDisplayName: "Asha Mehta",
    status: "due_in",
  }] as const;
  expect(reservationVoiceAction("Cancel reservation for Asha Mehta", reservations)).toMatchObject({
    reservation: reservations[0], workbench: "lifecycle", lifecycleAction: "cancel",
  });
  expect(reservationVoiceAction("Reinstate reservation Y-610", reservations)).toMatchObject({
    reservation: reservations[0], workbench: "lifecycle", lifecycleAction: "reinstate",
  });
  expect(reservationVoiceAction("Mark reservation Y-610 as no-show", reservations)).toMatchObject({
    reservation: reservations[0], workbench: "lifecycle", lifecycleAction: "no_show",
  });
  expect(reservationVoiceAction("Cancel reservation", reservations)).toBeNull();
});

test("accepts only exact authoritative reservation action evidence", () => {
  const actions = {
    canModify: true,
    canCancel: true,
    canReinstate: false,
    canOpenPrimaryFolio: false,
    canManageAlerts: true,
  };
  expect(api.validateReservationActions(actions)).toEqual(actions);
  expect(() => api.validateReservationActions({ ...actions, canCancel: "yes" })).toThrow();
  expect(() => api.validateReservationActions({ ...actions, clientCanNoShow: true })).toThrow();
});

test("validates canonical cancel and reinstate envelopes and replay evidence", () => {
  expect(api.validateCancelReservationReceipt(cancellationEnvelope, reservationId, "false")).toEqual({
    ...cancellationEnvelope.reservation,
    replayed: false,
  });
  expect(api.validateReinstateReservationReceipt(reinstatementEnvelope, reservationId, "true")).toEqual({
    ...reinstatementEnvelope.reservation,
    replayed: true,
  });
  expect(api.idempotencyReplayEvidence("true")).toBe(true);
  expect(api.idempotencyReplayEvidence("false")).toBe(false);
  expect(() => api.idempotencyReplayEvidence(null)).toThrow();
});

test("fails closed on hostile or malformed lifecycle receipts", () => {
  expect(() => api.validateCancelReservationReceipt({
    reservation: { ...cancellationEnvelope.reservation, reservationId: "5eaf4bf3-bcab-4b35-99a0-8d887649b67e" },
  }, reservationId, "false")).toThrow();
  expect(() => api.validateCancelReservationReceipt({
    reservation: { ...cancellationEnvelope.reservation, status: "reserved" },
  }, reservationId, "false")).toThrow();
  expect(() => api.validateCancelReservationReceipt({
    reservation: { ...cancellationEnvelope.reservation, adminOverride: true },
  }, reservationId, "false")).toThrow();
  expect(() => api.validateReinstateReservationReceipt({ reservation: reinstatementEnvelope.reservation, replayed: true }, reservationId, "true")).toThrow();
  expect(() => api.validateReinstateReservationReceipt(reinstatementEnvelope, reservationId, "1")).toThrow();
});

test("returns verified receipts and classifies uncertain write outcomes", async () => {
  api.configureYellowApi(propertyId);
  let authenticated = false;
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    if (url === "/api/v1/auth/demo:enter") {
      authenticated = true;
      return Response.json({ accessToken: "demo-token" });
    }
    expect(authenticated).toBe(true);
    expect(url).toBe(`/api/v1/properties/${propertyId}/reservations/${reservationId}/cancel`);
    return Response.json(cancellationEnvelope, { headers: { "idempotency-replayed": "false" } });
  }) as typeof fetch;
  expect(await api.cancelReservationLifecycle(reservationId, "Guest changed plans", "cancel-key")).toEqual({
    ...cancellationEnvelope.reservation,
    replayed: false,
  });

  globalThis.fetch = (async () => Response.json(reinstatementEnvelope, {
    headers: { "idempotency-replayed": "true" },
  })) as unknown as typeof fetch;
  expect(await api.reinstateReservationLifecycle(reservationId, "reinstate-key")).toEqual({
    ...reinstatementEnvelope.reservation,
    replayed: true,
  });

  for (const scenario of [
    async () => { throw new TypeError("connection reset"); },
    async () => Response.json({ detail: "upstream failed" }, { status: 503 }),
    async () => Response.json({ reservation: { ...reinstatementEnvelope.reservation, status: "cancelled" } }, {
      headers: { "idempotency-replayed": "false" },
    }),
  ]) {
    globalThis.fetch = scenario as unknown as typeof fetch;
    try {
      await api.reinstateReservationLifecycle(reservationId, "same-reinstate-key");
      throw new Error("expected lifecycle request failure");
    } catch (error) {
      expect(error).toBeInstanceOf(api.ReservationLifecycleRequestError);
      expect((error as InstanceType<typeof api.ReservationLifecycleRequestError>).uncertain).toBe(true);
    }
  }

  globalThis.fetch = (async () => Response.json({ detail: "conflict" }, { status: 409 })) as unknown as typeof fetch;
  try {
    await api.reinstateReservationLifecycle(reservationId, "different-key");
    throw new Error("expected lifecycle request failure");
  } catch (error) {
    expect(error).toBeInstanceOf(api.ReservationLifecycleRequestError);
    const requestError = error as InstanceType<typeof api.ReservationLifecycleRequestError>;
    expect(requestError.uncertain).toBe(false);
    expect(requestError.status).toBe(409);
  }
});
