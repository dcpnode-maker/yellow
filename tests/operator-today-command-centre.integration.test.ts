import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { createApp } from "../src/app";
import { OperatorHttpApi } from "../src/http/operator";

const html = readFileSync(new URL("../src/http/operator/index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/http/operator/operator.css", import.meta.url), "utf8");
const script = readFileSync(new URL("../src/http/operator/operator.js", import.meta.url), "utf8");

function functionSource(name: string): string {
  const start = script.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`Missing function ${name}`);
  const opening = script.indexOf(") {", start) + 2;
  let depth = 0;
  for (let index = opening; index < script.length; index += 1) {
    if (script[index] === "{") depth += 1;
    if (script[index] === "}") depth -= 1;
    if (depth === 0) return script.slice(start, index + 1);
  }
  throw new Error(`Unclosed function ${name}`);
}

const todaySource = [
  "todayLaneElements",
  "setTodayLaneState",
  "propertyLocalDate",
  "todayWindow",
  "todayBoardQuery",
  "todayOperationalAction",
  "resetTodayState",
  "todayRequestIsCurrent",
  "todayReturnFocusDecision",
  "restoreTodayReturnFocus",
  "renderTodayLane",
  "loadTodayLane",
  "loadToday",
].map(functionSource).join("\n");

test("Order 177: Today is the first truthful Front desk route", async () => {
  const todayIndex = html.indexOf('id="nav-today"');
  const availabilityIndex = html.indexOf('id="nav-availability"');
  expect(todayIndex).toBeGreaterThan(0);
  expect(todayIndex).toBeLessThan(availabilityIndex);
  expect(html).toContain('data-view="today" aria-controls="today-view"');
  expect(html).toContain('id="today-view" hidden aria-labelledby="today-title"');
  expect(html).toContain("Each list is one bounded server page, not a hotel-wide total.");
  expect(script).toContain("(?:today|availability|inventory|");
  expect(script).toContain('location.pathname.endsWith("/today") ? "today"');

  const app = createApp({ operatorApi: new OperatorHttpApi({} as never) });
  const property = "00000000-0000-0000-0000-000000000177";
  const response = await app.handle(new Request(`http://yellow.test/p/${property}/today`));
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toContain("text/html");
  expect(await response.text()).toBe(html);
  for (const path of [`/p/${property}/today/extra`, `/p/${property}/unknown`]) {
    expect((await app.handle(new Request(`http://yellow.test${path}`))).status).toBe(404);
  }
});

test("Order 177: all three lanes own complete independent states", () => {
  for (const [status, label] of [["due_in", "Due in"], ["due_out", "Due out"], ["in_house", "In house"]] as const) {
    expect(html).toContain(`data-today-lane="${status}"`);
    expect(html).toContain(label);
  }
  for (const marker of ["data-today-summary", "data-today-loading", "data-today-error", "data-today-retry", "data-today-empty", "data-today-list", "data-today-more", "data-today-status"]) {
    expect(html.match(new RegExp(marker, "g"))).toHaveLength(3);
  }
  expect(html.match(/role="alert"/g)?.length).toBeGreaterThanOrEqual(3);
  expect(html.match(/data-today-status role="status" aria-live="polite"/g)).toHaveLength(3);
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  expect(ids.length).toBe(new Set(ids).size);
});

test("Order 177: Today queries are fixed, bounded, non-PII and GET-only", () => {
  const queryFactory = new Function(`
    const TODAY_STATUSES = Object.freeze(["due_in", "due_out", "in_house"]);
    return (${functionSource("todayBoardQuery")});
  `)() as (status: string, window: { from: string; to: string }, after?: string) => URLSearchParams;
  const window = { from: "2026-08-25T18:30:00.000Z", to: "2026-08-26T18:30:00.000Z" };
  for (const status of ["due_in", "due_out", "in_house"]) {
    expect(Object.fromEntries(queryFactory(status, window))).toEqual({ status, from: window.from, to: window.to, limit: "50" });
  }
  const cursor = queryFactory("due_out", window, "abc_DEF-123");
  expect(Object.fromEntries(cursor)).toEqual({ status: "due_out", from: window.from, to: window.to, limit: "50", after: "abc_DEF-123" });
  expect(() => queryFactory("reserved", window)).toThrow("Unsupported Today lane.");
  expect(todaySource).toContain("/reservation-board?${query}");
  expect(todaySource).not.toMatch(/method:\s*["'](?:POST|PUT|PATCH|DELETE)["']|guest|contact|confirmationNo/);
  expect(todaySource).not.toMatch(/localStorage|sessionStorage|document\.cookie|indexedDB|sendBeacon|setInterval|setTimeout|WebSocket|EventSource/);
});

test("Order 177: local-day boundaries preserve non-UTC and DST truth", () => {
  const helpers = new Function(`
    return {
      propertyLocalDate: ${functionSource("propertyLocalDate")},
      dateAfter: ${functionSource("dateAfter")},
      zonedInstant: ${functionSource("zonedInstant")},
    };
  `)() as {
    propertyLocalDate: (instant: Date, zone: string) => string;
    dateAfter: (date: string, days?: number) => string;
    zonedInstant: (date: string, hour: number, minute: number, zone: string) => string;
  };
  const indiaFrom = helpers.zonedInstant("2026-08-26", 0, 0, "Asia/Kolkata");
  const indiaTo = helpers.zonedInstant(helpers.dateAfter("2026-08-26"), 0, 0, "Asia/Kolkata");
  expect({ indiaFrom, indiaTo }).toEqual({ indiaFrom: "2026-08-25T18:30:00.000Z", indiaTo: "2026-08-26T18:30:00.000Z" });
  for (const [date, expectedHours] of [["2025-03-09", 23], ["2025-11-02", 25]] as const) {
    const from = helpers.zonedInstant(date, 0, 0, "America/New_York");
    const to = helpers.zonedInstant(helpers.dateAfter(date), 0, 0, "America/New_York");
    expect((Date.parse(to) - Date.parse(from)) / 3_600_000).toBe(expectedHours);
    expect(helpers.propertyLocalDate(new Date(from), "America/New_York")).toBe(date);
  }
  expect(functionSource("todayWindow")).toContain("propertyTimeZone()");
  expect(functionSource("todayWindow")).not.toMatch(/business.?date/i);
});

test("Order 177: bounded pages replace lane state and reject stale paint", () => {
  const render = functionSource("renderTodayLane");
  const current = functionSource("todayRequestIsCurrent");
  expect(render).toContain("page.reservations.slice(0, 50)");
  expect(render).toContain("elements.list.replaceChildren");
  expect(render).toContain("shown on this bounded page");
  expect(render).toContain("more records available");
  expect(render).not.toMatch(/arrivals|departures|occupancy|total/i);
  for (const guard of ["cycle === todayGeneration", "requestGeneration === todayLaneState[status].requestGeneration", "property === propertySelect.value", 'activeView === "today"', 'location.pathname === `/p/${property}/today`', "todayWindowState?.key === windowKey"]) {
    expect(current).toContain(guard);
  }
  const reset = functionSource("resetTodayState");
  for (const effect of ["todayGeneration += 1", "state.rows = []", "state.nextCursor = null", "state.requestGeneration += 1", "elements.list.replaceChildren()"] ) expect(reset).toContain(effect);
  expect(script).toContain("resetTodayState();");
});

test("Order 177: Today reuses UUID detail and responsive accessible shell", () => {
  expect(script).toContain('if (activeView === "today")');
  expect(script).toContain('reservationDrawerReturnView = "today"');
  expect(script).toContain('history.replaceState(null, "", `/p/${propertySelect.value}/today`)');
  expect(script).toContain("reservationDrawerReturnFocus?.isConnected");
  for (const contract of [
    ".today-lanes { min-width: 0;", "grid-template-columns: repeat(3, minmax(0, 1fr))",
    ".today-lane { min-width: 0;", ".today-lane-list { min-width: 0;",
    "@media (max-width: 900px)", ".today-lanes { grid-template-columns: 1fr; }",
    ".today-lane-loading span", "prefers-reduced-motion: reduce", "min-height: 44px",
  ]) expect(css).toContain(contract);
  expect(css).not.toMatch(/(?:html|body|\.workbench)[^{]*\{[^}]*overflow-x:\s*(?:hidden|clip)/);
  expect(`${html}\n${css}\n${todaySource}`).not.toMatch(/https?:\/\/|@import|url\s*\(/i);
});

test("Order 177 D-454: detail return uses stable identity after lane replacement", () => {
  const decision = new Function(`return (${functionSource("todayReturnFocusDecision")})`)() as
    (reservationId: string, matched: boolean, settled: boolean) => string;
  expect(decision("reservation-1", true, false)).toBe("row");
  expect(decision("reservation-1", false, false)).toBe("wait");
  expect(decision("reservation-1", false, true)).toBe("heading");
  expect(decision("", true, true)).toBe("none");

  const close = functionSource("closeReservationDetail");
  expect(close).toContain("todayReturnFocus = { reservationId: returnReservationId, cycle: 0 }");
  expect(close.indexOf("todayReturnFocus =")).toBeLessThan(close.indexOf('setView("today", false)'));
  expect(close).toContain('returnView === "today" ? document.querySelector("#today-title")');
  expect(functionSource("renderTodayLane")).toContain("restoreTodayReturnFocus(cycle)");
  expect(functionSource("loadToday")).toContain("Promise.all(TODAY_STATUSES.map");
  expect(functionSource("loadToday")).toContain("restoreTodayReturnFocus(cycle, true)");
  const restore = functionSource("restoreTodayReturnFocus");
  expect(restore).toContain("button.dataset.reservationId === todayReturnFocus.reservationId");
  expect(restore).toContain('decision === "row"');
  expect(restore).toContain('decision === "heading"');
});

test("Order 209: Today preparation routes use only exact lane/status truth and preserve stable return focus", () => {
  const action = new Function(`return (${functionSource("todayOperationalAction")})`)() as
    (lane: string, rowStatus: string) => { workbench: string; label: string } | null;
  expect(action("due_in", "due_in")).toEqual({ workbench: "check-in", label: "Prepare check-in" });
  expect(action("due_out", "due_out")).toEqual({ workbench: "checkout", label: "Prepare checkout" });
  expect(action("in_house", "in_house")).toEqual({ workbench: "checkout", label: "Prepare checkout" });
  for (const [lane, rowStatus] of [
    ["due_in", "in_house"], ["due_out", "in_house"],
    ["due_in", "due_out"], ["due_out", "due_in"], ["unknown", "due_in"],
  ] as const) expect(action(lane, rowStatus)).toBeNull();

  const helper = functionSource("todayOperationalAction");
  expect(helper).not.toMatch(/arrival|departureTravel|pickup|room|folio|readiness|request\(|method:\s*"POST"|submit/i);
  const render = functionSource("renderTodayLane");
  expect(render).toContain("operationalAction: todayOperationalAction(status, row.status)");
  const card = functionSource("reservationCard");
  expect(card).toContain('node("button", "today-operational-action", operationalAction.label)');
  expect(card).toContain("trigger: action, workbench: operationalAction.workbench");
  expect(card).not.toMatch(/method:\s*"POST"|submitCheckIn|submitCheckout|\.click\(\)/);

  const open = functionSource("openReservationDetail");
  expect(open).toContain('if (activeView === "today")');
  expect(open).toContain("reservationDrawerReturnReservationId = reservationId");
  const close = functionSource("closeReservationDetail");
  expect(close).toContain("todayReturnFocus = { reservationId: returnReservationId, cycle: 0 }");
  const restore = functionSource("restoreTodayReturnFocus");
  expect(restore).toContain("button.dataset.reservationId === todayReturnFocus.reservationId");
  expect(restore).toContain('if (decision === "heading") $("#today-title").focus()');
});

test("Order 206: arrival and pickup evidence is compact, accessible and due-in only on Today", () => {
  const summary = functionSource("reservationArrivalTravelSummary");
  for (const literal of [
    '"Arrival"', '"pickup requested"', '"pickup not requested"',
    '"pickup task linked"', '"no linked pickup task"', '"Time not recorded"',
  ]) expect(summary).toContain(literal);
  expect(summary).toContain('node("small", "reservation-arrival-travel", summary)');
  expect(summary).toContain('line.setAttribute("aria-label", summary)');
  expect(summary).not.toMatch(/taskStatus|taskState|queue|assignment|travelId|pickupTaskId|notes|party|contact|parking|vehicle/i);

  expect(functionSource("reservationTableRow")).toContain("reservationStaySummary(row)");
  expect(functionSource("reservationCard")).toContain("reservationArrivalTravelSummary(row)");
  const today = functionSource("renderTodayLane");
  expect(today).toContain('showArrivalTravel: status === "due_in"');
  expect(today).not.toMatch(/sort\(|scheduledAt.*(?:<|>)|setInterval|setTimeout|localStorage|sessionStorage/i);

  for (const contract of [
    ".reservation-stay-summary { min-width: 0; display: grid;",
    ".reservation-arrival-travel { display: block;",
    '.today-lane[data-today-lane="due_in"] .reservation-arrival-travel',
    "overflow-wrap: anywhere", "@media (forced-colors: active)",
  ]) expect(css).toContain(contract);
});

test("Order 207: departure evidence is compact, accessible and due-out only on Today", () => {
  const summary = functionSource("reservationDepartureTravelSummary");
  for (const literal of [
    '"Departure"', '"Mode not recorded"', '"Time not recorded"',
  ]) expect(summary).toContain(literal);
  expect(summary).toContain('node("small", "reservation-departure-travel", summary)');
  expect(summary).toContain('line.setAttribute("aria-label", summary)');
  expect(summary).not.toMatch(/pickup|taskStatus|taskState|queue|assignment|travelId|notes|party|contact|parking|vehicle/i);

  expect(functionSource("reservationStaySummary")).toContain("reservationDepartureTravelSummary(row)");
  expect(functionSource("reservationCard")).toContain("reservationDepartureTravelSummary(row)");
  const today = functionSource("renderTodayLane");
  expect(today).toContain('showDepartureTravel: status === "due_out"');
  expect(today).toContain('showArrivalTravel: status === "due_in"');
  expect(today).not.toMatch(/sort\(|scheduledAt.*(?:<|>)|setInterval|setTimeout|localStorage|sessionStorage/i);

  for (const contract of [
    ".reservation-departure-travel { display: block;",
    '.today-lane[data-today-lane="due_out"] .reservation-departure-travel',
    "overflow-wrap: anywhere", "@media (forced-colors: active)",
    ".reservation-departure-travel { color: CanvasText;",
  ]) expect(css).toContain(contract);
});
