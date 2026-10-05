import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
// Root tests do not enable JSX; Bun loads the actual TSX module at runtime.
const { TodayGlassDashboard } = await import(new URL("../frontend/yellow/src/workspaces/TodayGlassDashboard.tsx", import.meta.url).href);

const source = (file: string) => readFileSync(resolve(import.meta.dir, "../frontend/yellow/src", file), "utf8");
const api = source("yellow-api.tsx");
const workspace = source("workspaces/ReservationWorkspace.tsx");
const transpiler = new Bun.Transpiler({ loader: "ts" });

// Exercise the real functions without evaluating the module's browser bootstrap.
function extract(text: string, name: string): string {
  const start = text.search(new RegExp(`(?:export )?(?:async )?function ${name}\\(`));
  if (start < 0) throw new Error(`Missing function ${name}`);
  const indent = text.slice(text.lastIndexOf("\n", start) + 1, start);
  const end = text.indexOf(`\n${indent}}`, start) + indent.length + 2;
  return text.slice(start, end).replace(/^export /, "");
}

test("room-candidate failures preserve the server's specific problem detail", async () => {
  const code = transpiler.transformSync(`${extract(api, "reservationApiError")}\n${extract(api, "loadDueInRoomCandidates")}`);
  for (const [response, message] of [
    [Response.json({ detail: "The booked stay is not active at the current time." }, { status: 409 }), "The booked stay is not active at the current time."],
    [Response.json({ title: "Access denied" }, { status: 403 }), "Access denied"],
    [new Response("offline", { status: 503 }), "Current eligible rooms are unavailable."],
  ] as const) {
    const calls: string[] = [];
    const run = new Function("fetch", "session", "propertyId", `${code}; return loadDueInRoomCandidates;`)(
      async (url: string, options: RequestInit) => {
        calls.push(url);
        expect(options.method ?? "GET").toBe("GET");
        expect(options.cache).toBe("no-store");
        expect(options.headers).toEqual({ authorization: "Bearer test-session" });
        return response;
      }, async () => "test-session", "property-test",
    );
    await expect(run("reservation-test")).rejects.toThrow(message);
    expect(calls).toEqual(["/api/v1/properties/property-test/reservations/reservation-test/due-in-room-assignment/candidates"]);
  }
});

test("active-segment blocker explains the check without inventing eligibility", () => {
  const code = transpiler.transformSync(extract(workspace, "checkInBlockerCopy"));
  const copy = new Function(`${code}; return checkInBlockerCopy;`)()("active_segment_missing");
  expect(copy.title).toBe("No unique active booked stay");
  expect(copy.detail).toContain("start/end");
  expect(copy.detail).toContain("early-arrival");
  expect(copy.detail).toContain("does not change");
});

test("arrival refresh is a read-only retry that clears stale approvals", () => {
  const handler = extract(workspace, "refreshArrival");
  for (const reset of ["setConfirmed(false)", "setFolioConfirmed(false)", "setRoomConfirmed(false)", "setRoomDraft(null)", "setSelectedRoomId(null)", "setConversationProposal(null)"]) {
    expect(handler.includes(reset)).toBe(true);
  }
  for (const query of ["detail.refetch()", "readiness.refetch()", "roomCandidates.refetch()"]) expect(handler.includes(query)).toBe(true);
  expect(/commitCheckIn|assignDueInRoom|openPrimaryFolio|\bfetch\(/.test(handler)).toBe(false);
  expect(workspace.includes("Refresh arrival readiness")).toBe(true);
  expect(workspace.includes("Review stay details")).toBe(true);
});

test("refresh executes only reads and waits while another action is in flight", async () => {
  const code = transpiler.transformSync(extract(workspace, "refreshArrival"));
  const setters = ["setConfirmed", "setFolioConfirmed", "setRoomConfirmed", "setRoomDraft", "setSelectedRoomId", "setConversationProposal"];
  for (const busy of [false, true]) {
    const events: string[] = [];
    const query = (name: string) => ({ isFetching: false, refetch: async () => { events.push(name); } });
    const run = new Function("detail", "readiness", "roomCandidates", "assigningRoom", "openingFolio", "committing", "conversationInFlight", ...setters, `${code}; return refreshArrival;`)(
      query("detail"), query("readiness"), query("rooms"), false, false, false, { current: busy },
      ...setters.map((name) => (value: unknown) => events.push(`${name}:${value}`)),
    );
    await run();
    expect(events).toEqual(busy ? [] : ["setConfirmed:false", "setFolioConfirmed:false", "setRoomConfirmed:false", "setRoomDraft:null", "setSelectedRoomId:null", "setConversationProposal:null", "detail", "readiness", "rooms"]);
  }
});

test("Today renders capacity rather than claiming that all capacity is unsold", () => {
  const move = { label: "Arrivals", value: 9, loading: false, unavailable: false, glyph: "", onOpen() {} };
  const html = renderToStaticMarkup(createElement(TodayGlassDashboard, {
    greeting: "Good evening", propertyName: "Test", localTime: "17:00", occupancyPercent: 70,
    roomNights: 14, roomsAvailable: 20, roomRevenue: "SAR 10,013", adr: "SAR 715", revpar: "SAR 501",
    performanceLoading: false, performanceUnavailable: false, movements: [move, {...move, label:"Departures"}, {...move, label:"In house"}],
    businessMix: [], demoSteps: [], onOpenPerformance() {},
  }));
  expect(html.includes("Room capacity")).toBe(true);
  expect(html.includes("occupancy denominator")).toBe(true);
  expect(html.includes("14 rooms sold · 20 capacity")).toBe(true);
  expect(html.includes("rooms left")).toBe(false);
});
