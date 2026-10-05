import { expect, test } from "bun:test";

Object.assign(globalThis, {
  window: { location: { pathname: "/p/6081b544-22a1-534f-a86d-bb1ae0519e14/res/67600000-0000-4000-8000-000000000001", search: "" } },
});
const apiModulePath = "../frontend/yellow/src/yellow-api.tsx";
const api = await import(apiModulePath);
api.configureYellowApi("6081b544-22a1-534f-a86d-bb1ae0519e14");
const state = await import("../frontend/yellow/src/reservation-departure-change");

const reservationId = "67600000-0000-4000-8000-000000000001";
const segmentId = "67600000-0000-4000-8000-000000000002";
const confirmationNo = "Y-676";
const before = Object.freeze({ from: "2026-09-24T09:30:00.000Z", to: "2026-09-26T05:30:00.000Z" });
const lookup = Object.freeze({
  reservationId, confirmationNo, status: "in_house",
  segments: Object.freeze([Object.freeze({ segmentId, sequence: 1, status: "in_house", unitTypeId: "unit-type", sellableUnitId: "room", period: before, actions: Object.freeze({ canChangeDeparture: true, canMoveRoom: true }) })]),
});

test("property-local departure conversion rejects nonexistent and repeated clock times", () => {
  expect(state.propertyLocalMinute(before.to, "Asia/Kolkata")).toBe("2026-09-26T11:00");
  expect(state.departureInstantFromLocal("2026-09-27T11:00", "Asia/Kolkata")).toBe("2026-09-27T05:30:00.000Z");
  expect(() => state.departureInstantFromLocal("2025-03-09T02:30", "America/New_York")).toThrow("does not exist");
  expect(() => state.departureInstantFromLocal("2025-11-02T01:30", "America/New_York")).toThrow("occurs twice");
});

test("reconciliation compares validated instants across PostgreSQL microseconds and offsets", () => {
  expect(state.sameRecordedInstant("2026-09-25T11:00:00.000000Z", "2026-09-25T11:00:00.000Z")).toBe(true);
  expect(state.sameRecordedInstant("2026-09-25T16:30:00.000000+05:30", "2026-09-25T11:00:00.000Z")).toBe(true);
  expect(state.sameRecordedInstant("2026-09-25T11:00:00.000001Z", "2026-09-25T11:00:00.000Z")).toBe(false);
  expect(state.sameRecordedInstant("not-an-instant", "not-an-instant")).toBe(false);
  const attempt = state.prepareDepartureAttempt(lookup, reservationId, confirmationNo, "2026-09-27T11:00", "Asia/Kolkata", "key-676");
  expect(state.departureMatchesAttempt({ ...lookup, segments: [{ ...lookup.segments[0]!, period: { from: "2026-09-24T09:30:00.000000Z", to: "2026-09-27T11:00:00.000000+05:30" } }] }, attempt)).toBe(true);
  expect(state.departureMatchesAttempt({ ...lookup, segments: [{ ...lookup.segments[0]!, period: { from: "2026-09-24T09:30:00.000001Z", to: "2026-09-27T11:00:00.000000+05:30" } }] }, attempt)).toBe(false);
});

test("proposal freezes exact identity, period, destination and retry key; denies stale identity/action", () => {
  const attempt = state.prepareDepartureAttempt(lookup, reservationId, confirmationNo, "2026-09-27T11:00", "Asia/Kolkata", "key-676");
  expect(attempt).toEqual({ reservationId, confirmationNo, segmentId, expectedPeriod: before, newDeparture: "2026-09-27T05:30:00.000Z", key: "key-676" });
  expect(Object.isFrozen(attempt)).toBe(true);
  expect(Object.isFrozen(attempt.expectedPeriod)).toBe(true);
  expect(state.departureMatchesAttempt({ ...lookup, segments: [{ ...lookup.segments[0]!, period: { ...before, to: attempt.newDeparture } }] }, attempt)).toBe(true);
  expect(state.departureMatchesAttempt(lookup, attempt)).toBe(false);
  expect(() => state.prepareDepartureAttempt(lookup, "other-reservation", confirmationNo, "2026-09-27T11:00", "Asia/Kolkata", "key")).toThrow("no longer matches");
  expect(() => state.prepareDepartureAttempt({ ...lookup, segments: [{ ...lookup.segments[0]!, actions: { canChangeDeparture: false, canMoveRoom: true } }] }, reservationId, confirmationNo, "2026-09-27T11:00", "Asia/Kolkata", "key")).toThrow("not available");
  expect(() => state.prepareDepartureAttempt(lookup, reservationId, confirmationNo, "2026-09-26T11:00", "Asia/Kolkata", "key")).toThrow("different");
  expect(() => state.prepareDepartureAttempt({ ...lookup, segments: [{ ...lookup.segments[0]!, period: { ...before, to: "2026-09-26T05:30:00.000000Z" } }] }, reservationId, confirmationNo, "2026-09-26T11:00", "Asia/Kolkata", "key")).toThrow("different");
});

test("typed transport uses exact property reservation segment, compare period and same retry key", async () => {
  const original = globalThis.fetch;
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  Object.assign(globalThis, { fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    if (url === "/api/v1/auth/demo:enter") return Response.json({ accessToken: "test-token" });
    if (url.includes("reservation-segments?")) return Response.json({ reservation: lookup });
    if (url.endsWith("/departure")) return Response.json({ segment: { reservationId, segmentId, beforePeriod: before, afterPeriod: { ...before, to: "2026-09-27T05:30:00.000Z" }, financialJournalId: null } });
    return Response.json({ title: "unexpected" }, { status: 404 });
  } });
  try {
    expect(await api.loadReservationSegments(confirmationNo)).toEqual(lookup);
    await api.changeReservationDeparture(reservationId, segmentId, { expectedPeriod: before, newDeparture: "2026-09-27T05:30:00.000Z" }, "same-key");
    const read = calls.find((call) => call.url.includes("reservation-segments?"))!;
    expect(read.url).toContain("confirmationNo=Y-676");
    expect(read.init?.cache).toBe("no-store");
    const write = calls.find((call) => call.url.endsWith("/departure"))!;
    expect(write.url).toBe(`/api/v1/properties/6081b544-22a1-534f-a86d-bb1ae0519e14/reservations/${reservationId}/segments/${segmentId}/departure`);
    expect(write.init?.method).toBe("PATCH");
    expect((write.init?.headers as Record<string, string>)["idempotency-key"]).toBe("same-key");
    expect(JSON.parse(String(write.init?.body))).toEqual({ expectedPeriod: before, newDeparture: "2026-09-27T05:30:00.000Z" });
  } finally { globalThis.fetch = original; }
});

test("transport distinguishes definite denial from unknown result and rejects hostile receipt", async () => {
  const original = globalThis.fetch;
  const payload = { expectedPeriod: before, newDeparture: "2026-09-27T05:30:00.000Z" };
  let mode: "denied" | "network" | "server" | "receipt" = "denied";
  Object.assign(globalThis, { fetch: async (input: RequestInfo | URL) => {
    if (String(input) === "/api/v1/auth/demo:enter") return Response.json({ accessToken: "test-token" });
    if (mode === "network") throw new Error("connection reset");
    if (mode === "server") return Response.json({ detail: "unavailable" }, { status: 503 });
    if (mode === "receipt") return Response.json({ segment: { reservationId, segmentId, beforePeriod: before, afterPeriod: { ...before, to: before.to }, financialJournalId: null } });
    return Response.json({ detail: "occupancy conflict" }, { status: 409 });
  } });
  try {
    await expect(api.changeReservationDeparture(reservationId, segmentId, payload, "key")).rejects.toMatchObject({ uncertain: false });
    mode = "network";
    await expect(api.changeReservationDeparture(reservationId, segmentId, payload, "key")).rejects.toMatchObject({ uncertain: true });
    mode = "server";
    await expect(api.changeReservationDeparture(reservationId, segmentId, payload, "key")).rejects.toMatchObject({ uncertain: true });
    mode = "receipt";
    await expect(api.changeReservationDeparture(reservationId, segmentId, payload, "key")).rejects.toMatchObject({ uncertain: true });
  } finally { globalThis.fetch = original; }
});
