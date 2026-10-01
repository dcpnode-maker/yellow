import { afterAll, expect, test } from "bun:test";

const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
Object.defineProperty(globalThis, "window", {
  configurable: true,
  enumerable: originalWindowDescriptor?.enumerable ?? true,
  writable: true,
  value: { location: { pathname: "/p/property-a/reservations", search: "" } },
});
afterAll(() => {
  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, "window", originalWindowDescriptor);
  } else {
    delete (globalThis as { window?: unknown }).window;
  }
});

const originalFetchDescriptor = Object.getOwnPropertyDescriptor(globalThis, "fetch");
Object.defineProperty(globalThis, "fetch", { configurable: true, writable: true, value: globalThis.fetch });
// Synthetic client fixture only: execute the real API with a private factory session.
// This redirects one auth import in memory; production modules and default auth state are untouched.
const fixtureApiUrl = new URL("../frontend/yellow/src/yellow-api.tsx", import.meta.url);
const fixtureAuthUrl = new URL("../frontend/yellow/src/auth-session.ts", import.meta.url).href;
const fixtureAuthModule = "data:text/javascript;base64," + Buffer.from(
  `import { createAuthSession } from ${JSON.stringify(fixtureAuthUrl)}; export const reactAuthSession = createAuthSession(); // order610-normal-auth-fixture`,
).toString("base64");
const { reactAuthSession: fixtureAuth } = await import(fixtureAuthModule);
const fixtureApiOriginal = await Bun.file(fixtureApiUrl).text();
const authImport = 'import { reactAuthSession } from "./auth-session";';
if (fixtureApiOriginal.split(authImport).length !== 2) throw new Error("Auth fixture import contract changed");
const fixtureApiSource = fixtureApiOriginal.replace(authImport, `import { reactAuthSession } from ${JSON.stringify(fixtureAuthModule)};`)
  .replace(/from "(\.\/[^"\n]+)"/g, (_match, relative: string) =>
    `from ${JSON.stringify(new URL(relative + ".ts", fixtureApiUrl).href)}`);
const fixtureApiModule = "data:text/javascript;base64," + Buffer.from(
  new Bun.Transpiler({ loader: "tsx" }).transformSync(fixtureApiSource),
).toString("base64");
const fixtureActor = "b2836978-73fe-58f9-b808-8b58cceac1c4";
const fixtureTenant = "6d9b7ce2-2d14-5576-b8c3-80f06501a603";
const fixtureToken = "synthetic." + btoa(JSON.stringify({ sub: fixtureActor, tid: fixtureTenant })) + ".fixture";
const fixtureLoginResponse = () => Response.json({ accessToken: fixtureToken, tokenType: "Bearer", expiresInSeconds: 900,
  user: { id: fixtureActor, displayName: "Synthetic client fixture" } });
const fixtureCredentials = { tenant: "fixture", email: "fixture@example.invalid", password: "test-only" };
const api = await import(fixtureApiModule);
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
  fixtureAuth.dispose();
  if (originalFetchDescriptor) Object.defineProperty(globalThis, "fetch", originalFetchDescriptor);
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
    if (url === "/api/v1/auth/local:login") {
      authenticated = true;
      return fixtureLoginResponse();
    }
    if (url === "/api/v1/me/properties") return Response.json({ properties: [{ id: propertyId, name: "Fixture property", timezone: "UTC" }] });
    expect(authenticated).toBe(true);
    expect(url).toBe(`/api/v1/properties/${propertyId}/reservations/${reservationId}/cancel`);
    return Response.json(cancellationEnvelope, { headers: { "idempotency-replayed": "false" } });
  }) as typeof fetch;
  await fixtureAuth.signIn(fixtureCredentials);
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
