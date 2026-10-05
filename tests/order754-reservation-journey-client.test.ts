import { expect, test } from "bun:test";
import { collectReservationJourneyPages, RESERVATION_JOURNEY_STAGES } from "../frontend/yellow/src/reservation-board";
import { reservationStageFromSearch, reservationStageHref, reservationViewHref } from "../frontend/yellow/src/reservation-navigation";
import { mkdtemp, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { runOwnedProofProcess } from "./helpers/owned-proof-process";

test("journey stages and navigation preserve other context while removing sibling selection", () => {
  expect(RESERVATION_JOURNEY_STAGES).toEqual(["pre_arrival", "arrival", "in_house", "departure", "post_departure"]);
  for (const stage of [...RESERVATION_JOURNEY_STAGES, "all"] as const) {
    expect(reservationStageFromSearch(`?stage=${stage}`)).toBe(stage);
    expect(reservationStageFromSearch(new URL(reservationStageHref("/p/P/reservations", "?view=groups&group=G&flag=1", "#focus", stage), "https://yellow.test").search)).toBe(stage);
  }
  for (const search of ["", "?stage=invalid", "?stage=arrival&stage=departure"]) expect(reservationStageFromSearch(search)).toBe("arrival");
  expect(reservationStageHref("/p/P/reservations", "?view=calendar&group=G&flag=1", "#focus", "departure")).toBe("/p/P/reservations?flag=1&stage=departure#focus");
  expect(reservationViewHref("/p/P/reservations", "?stage=departure", "", "groups")).toBe("/p/P/reservations?stage=departure&view=groups");
});

test("actual yellow-api helper exhausts native-shaped responses and fences changed context", async () => {
  const folder = await mkdtemp(resolve(".order754-client-"));
  const path = resolve(folder, "proof.ts");
  await writeFile(path, `
import assert from "node:assert/strict";
globalThis.window = { location: { search: "" } } as any;
const { reactAuthSession: auth } = await import("../frontend/yellow/src/auth-session");
const api = await import("../frontend/yellow/src/yellow-api");
const P = "00000000-0000-0000-0000-000000075402", Q = "00000000-0000-0000-0000-000000075405";
const U = "00000000-0000-0000-0000-000000075403", T = "00000000-0000-0000-0000-000000075401";
const R = "00000000-0000-0000-0000-000000075404";
let mode = "success", sequence = 0;
const boardCalls: string[] = [];
const credentials = { tenant: "synthetic", email: "synthetic@example.invalid", password: "synthetic-only" };
const makePage = (after: boolean) => ({ businessDate: "2026-10-04", reservations: [{ reservationId: R, confirmationNo: after ? "B" : "A", status: "reserved" }], nextCursor: after ? null : "next" });
globalThis.fetch = (async (url: string, init?: RequestInit) => {
  if (url === "/api/v1/auth/local:login") return Response.json({ accessToken: "test." + btoa(JSON.stringify({ sub: U, tid: T, sequence: ++sequence })) + ".test", tokenType: "Bearer", expiresInSeconds: 900, user: { id: U, displayName: "Synthetic" } });
  if (url === "/api/v1/me/properties") return Response.json({ properties: [P,Q].map(id => ({ id, name: "Synthetic", timezone: "Asia/Kolkata" })) });
  if (url.includes("/auth/")) return new Response(null, { status: 204 });
  assert(url.startsWith("/api/v1/properties/" + P + "/reservation-board?"));
  assert(new Headers(init?.headers).get("authorization")?.startsWith("Bearer "));
  assert.equal(init?.cache, "no-store");
  const query = new URL(url, "https://yellow.test").searchParams;
  assert.equal(query.get("stage"), "arrival"); assert.equal(query.get("limit"), "100");
  assert(!query.has("status")); assert(!query.has("businessDate"));
  boardCalls.push(url);
  if (mode === "property") { api.configureYellowApi(Q); api.configureYellowApi(P); }
  if (mode === "logout") await auth.logout();
  if (mode === "renew") await auth.signIn(credentials);
  if (mode === "deny" && query.has("after")) return Response.json({ detail: "Phase denied" }, { status: 403 });
  if (mode === "malformed") return Response.json({ businessDate: "2026-10-04", reservations: [{}], nextCursor: null });
  const page = makePage(query.has("after"));
  if (mode === "day" && query.has("after")) page.businessDate = "2026-10-05";
  if (mode === "body") return { ok: true, json: async () => { api.configureYellowApi(Q); return page; } } as Response;
  return Response.json(page);
}) as typeof fetch;
await auth.signIn(credentials); api.configureYellowApi(P);
const result = await api.loadReservationJourney("arrival");
assert.deepEqual(result.reservations.map(r => r.confirmationNo), ["A","B"]);
assert.equal(result.businessDate, "2026-10-04"); assert.equal(boardCalls.length, 2);
for (const next of ["property", "logout", "renew", "deny", "malformed", "day", "body"]) {
  mode = next; await auth.signIn(credentials); api.configureYellowApi(P); boardCalls.length = 0;
  await assert.rejects(() => api.loadReservationJourney("arrival"));
  assert(boardCalls.length <= 2);
}
mode = "success"; await auth.logout(); api.configureYellowApi(P); boardCalls.length = 0;
await assert.rejects(() => api.loadReservationJourney("arrival")); assert.equal(boardCalls.length, 0);
console.log(JSON.stringify({ passed: true, scenarios: 9 }));
`);
  const result = await runOwnedProofProcess([process.execPath, path], { cwd: process.cwd(), timeoutMs: 15_000, maxOutputBytes: 64_000 });
  expect(result.exitCode, result.stderr).toBe(0);
  expect(JSON.parse(result.stdout)).toEqual({ passed: true, scenarios: 9 });
}, 20_000);

test("collects all pages on one authoritative day and freezes the result", async () => {
  const seen: Array<string | null> = [];
  const result = await collectReservationJourneyPages(async after => {
    seen.push(after);
    return { reservations: after ? ["B"] : ["A"], businessDate: "2026-10-04", nextCursor: after ? null : "next" };
  });
  expect(seen).toEqual([null, "next"]);
  expect(result).toEqual({ reservations: ["A", "B"], businessDate: "2026-10-04" });
  expect(Object.isFrozen(result)).toBe(true);
  expect(Object.isFrozen(result.reservations)).toBe(true);
});

test("absent, impossible, changed dates and incomplete responses never become an empty success", async () => {
  for (const businessDate of [null, undefined, "", "2026-02-30", "2026-13-01", "0000-01-01", "2026-1-01", 42]) {
    await expect(collectReservationJourneyPages(async () => ({ reservations: [], nextCursor: null, businessDate } as never))).rejects.toThrow();
  }
  for (const page of [null, {}, { businessDate: "2026-10-04", nextCursor: null }, { businessDate: "2026-10-04", reservations: [] }]) {
    await expect(collectReservationJourneyPages(async () => page as never)).rejects.toThrow();
  }
  await expect(collectReservationJourneyPages(async after => ({ reservations: [], businessDate: after ? "2026-10-05" : "2026-10-04", nextCursor: after ? null : "next" }))).rejects.toThrow("business day changed");
  await expect(collectReservationJourneyPages(async () => ({ reservations: [], businessDate: "2026-10-04", nextCursor: "repeat" }))).rejects.toThrow("invalid cursor");
  await expect(collectReservationJourneyPages(async after => ({ reservations: [], businessDate: "2026-10-04", nextCursor: after ? "two" : "one" }), 2)).rejects.toThrow("safe page limit");
});
