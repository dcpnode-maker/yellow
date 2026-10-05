import { expect, test } from "bun:test";
import { createElement, useEffect, useMemo, useRef, useState } from "react";
import * as React from "react";
import { jsxDEV } from "react/jsx-dev-runtime";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMovementQuery, movementGuestAttributes, movementNights } from "../frontend/yellow/src/today-workspace";
import { applyMovementTableQuery, movementColumns, queryMovementTableRows } from "../frontend/yellow/src/movement-table-query";
import { tableColumnSort } from "../frontend/yellow/src/table-query";
import { activateWorkspaceDockAction } from "../frontend/yellow/src/ui/workspace-dock";
import { DictationController, type SpeechEngine } from "../frontend/yellow/src/ui/field-dictation";
import { buildHotelSearchResults, isHotelSearchCurrent } from "../frontend/yellow/src/hotel-search";
import { CAPABILITY_REGISTRY } from "../frontend/yellow/src/ecosystem/capability-registry";
import { reservationViewForDestination, reservationViewHref } from "../frontend/yellow/src/reservation-navigation";

const PROPERTY = "6081b544-22a1-534f-a86d-bb1ae0519e14";
const RESERVATION = "11111111-1111-4111-8111-111111111111";
const GROUP = "22222222-2222-4222-8222-222222222222";
const appSource = await Bun.file(new URL("../frontend/yellow/src/App.tsx", import.meta.url)).text();
function withWindow<T>(run: () => T): T {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: {
    location: { pathname: `/p/${PROPERTY}/today`, search: "?lane=in_house", hash: "", href: `http://synthetic.invalid/p/${PROPERTY}/today?lane=in_house` },
    localStorage: { getItem: () => null, setItem() {} }, innerWidth: 1280, innerHeight: 900,
    addEventListener() {}, removeEventListener() {},
  } });
  try { return run(); } finally {
    if (descriptor) Object.defineProperty(globalThis, "window", descriptor); else Reflect.deleteProperty(globalThis, "window");
  }
}

// Import real components after installing a property-bound SSR window. No fetch/mock auth runs.
async function withWindowAsync<T>(run: () => Promise<T>): Promise<T> {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: {
    location: { pathname: `/p/${PROPERTY}/today`, search: "?lane=in_house", hash: "" },
    localStorage: { getItem: () => null, setItem() {} }, innerWidth: 1280, innerHeight: 900,
    addEventListener() {}, removeEventListener() {},
  } });
  try { return await run(); } finally {
    if (descriptor) Object.defineProperty(globalThis, "window", descriptor); else Reflect.deleteProperty(globalThis, "window");
  }
}
const components = await withWindowAsync(async () => {
  const header = await import("../frontend/yellow/src/ui/OperatorHeader");
  const controls = await import("../frontend/yellow/src/ui/MovementTableControls");
  const column = await import("../frontend/yellow/src/ui/TableColumnMenu");
  const copy = await import("../frontend/yellow/src/ui/CopyCellButton");
  const ribbon = await import("../frontend/yellow/src/ui/SegmentedRibbon");
  const ecosystem = await import("../frontend/yellow/src/workspaces/EcosystemHub");
  return { ...header, ...controls, ...column, ...copy, ...ribbon, EcosystemHub: ecosystem.default };
});

test("actual reference header preserves property control, search utility, nested routes and unavailable routes", () => withWindow(() => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const render = (locked: boolean) => renderToString(createElement(QueryClientProvider, { client },
    createElement(components.OperatorHeader, { workspace: "reservations", propertyId: PROPERTY, propertyName: "Locanda", locked,
      onNavigate() { throw new Error("SSR must not navigate"); }, onBilling() { throw new Error("SSR must not bill"); },
      children: [createElement("div", { className: "property-switcher", key: "property" }, "Granted selector"),
        createElement("div", { className: "hotel-search-entry", key: "search" }, "Search hotel")] })));
  try {
    const html = render(false);
    for (const label of ["operator-header", "operator-navigation", "Granted selector", "Search hotel", "Rates &amp; distribution", "All workspaces", "Individual", "Groups", "Calendar"]) expect(html).toContain(label);
    expect(html).toMatch(/aria-label="Map"[^>]*disabled=""/);
    expect(html).toMatch(/aria-label="Reports"[^>]*disabled=""/);
    expect(render(true)).toMatch(/aria-label="Rates &amp; distribution"[^>]*disabled=""/);
    const hub = renderToString(createElement(components.EcosystemHub, { propertyId: PROPERTY, propertyName: "Locanda" }));
    for (const label of ["CRS workspace", "RMS recommendations", "CRM", "Booking engine"]) expect(hub).toContain(label);
  } finally { client.clear(); }
}));

test("actual guarded App navigation blocks all locks and preserves nested view/finance route authority", () => {
  const start = appSource.indexOf("  const workflow = (part:");
  const end = appSource.indexOf("  const review = (stay:", start);
  const javascript = new Bun.Transpiler({ loader: "tsx" }).transformSync(appSource.slice(start, end));
  const make = new Function("reservationLifecycleBusyRef", "voiceTransferRecoveryLockedRef", "propertyModeNavigationLocked", "window", "navigateYellow", "propertyId", "internalMarketLabEnabled", "reservationViewForDestination", "reservationViewHref", "PopStateEvent", javascript + "\nreturn { workflow, billingDesk, open, openMovementBilling };");
  for (const [lifecycle, transfer, mode] of [[false, false, false], [true, false, false], [false, true, false], [false, false, true]]) {
    const navigated: string[] = [], pushed: string[] = [], events: string[] = [];
    const window = { location: { pathname: `/p/${PROPERTY}/reservations`, search: "?view=groups&group=" + GROUP, hash: "#stay" }, history: { pushState: (_a: unknown, _b: string, href: string) => pushed.push(href) }, dispatchEvent: (event: { type: string }) => events.push(event.type) };
    const actions = make({ current: lifecycle }, { current: transfer }, mode, window, (href: string) => navigated.push(href), PROPERTY, false, reservationViewForDestination, reservationViewHref, class { constructor(readonly type: string) {} });
    actions.workflow("reservations:calendar"); actions.workflow("rates"); actions.billingDesk(); actions.open({ reservationId: RESERVATION }); actions.openMovementBilling({ reservationId: RESERVATION });
    if (lifecycle || transfer || mode) { expect(navigated).toEqual([]); expect(pushed).toEqual([]); expect(events).toEqual([]); }
    else {
      expect(pushed).toEqual([]); expect(events).toEqual([]);
      expect(navigated).toEqual([`/p/${PROPERTY}/reservations?view=calendar#stay`, `/p/${PROPERTY}/today?workspace=rates`, `/p/${PROPERTY}/today?workspace=finance`, `/p/${PROPERTY}/res/${RESERVATION}`, `/p/${PROPERTY}/today?workspace=finance&reservation=${RESERVATION}`]);
    }
  }
  let count = 0; activateWorkspaceDockAction(() => ++count, true); expect(count).toBe(0); activateWorkspaceDockAction(() => ++count, false); expect(count).toBe(1);
});

test("all17 table fields sort/filter authorized loaded rows while null/text/numeric order and missing evidence remain truthful", () => {
  const columns = movementColumns("arrival", "Asia/Riyadh");
  expect(columns).toHaveLength(17);
  const rows = [{ reservationId: RESERVATION, confirmationNo: "B", primaryGuestDisplayName: "Zed", channelCode: "DIRECT", sourceCode: "walkin", marketCode: "leisure", unitTypeCode: "KING", ratePlanCode: "BAR", adults: 2, children: 0, stayFrom: "2026-10-01T00:00:00Z", stayTo: "2026-10-04T00:00:00Z" },
    { reservationId: GROUP, confirmationNo: "A", primaryGuestDisplayName: "Amy", channelCode: "OTA", adults: 4, stayFrom: "2026-10-01T00:00:00Z", stayTo: "2026-10-02T00:00:00Z" }];
  for (const column of columns) {
    const adapted = applyMovementTableQuery(createMovementQuery("arrival"), { search: "", filters: [], sorts: [{ column: column.key, direction: "asc" }] });
    expect(queryMovementTableRows(rows, adapted.query, [], "Asia/Riyadh")).toHaveLength(2);
  }
  const query = (column: string, direction: "asc" | "desc") => applyMovementTableQuery(createMovementQuery("arrival"), { search: "", filters: [], sorts: [{ column, direction }] }).query;
  expect(queryMovementTableRows(rows, query("sourceCode", "asc"), [], "UTC").map(row => row.confirmationNo)).toEqual(["A", "B"]);
  expect(queryMovementTableRows(rows, query("sourceCode", "desc"), [], "UTC").map(row => row.confirmationNo)).toEqual(["B", "A"]);
  expect(queryMovementTableRows(rows, query("adults", "asc"), [], "UTC").map(row => row.adults)).toEqual([2, 4]);
  expect(queryMovementTableRows(rows, query("nights", "desc"), [], "UTC").map(row => row.confirmationNo)).toEqual(["B", "A"]);
  expect(queryMovementTableRows(rows, createMovementQuery("arrival"), [{ column: "sourceCode", operator: "isEmpty", value: "" }], "UTC").map(row => row.confirmationNo)).toEqual(["A"]);
  expect(() => query("invented", "asc")).toThrow("Unsupported movement sort");
});

test("actual saved movement presentation renders reference controls and keeps billing as an explicit callback", () => withWindow(() => {
  const start = appSource.indexOf("function MovementGrid({");
  const end = appSource.indexOf("\n/* Order584", start);
  const javascript = new Bun.Transpiler({ loader: "tsx" }).transformSync(appSource.slice(start, end)).replace(/jsxDEV_[a-z0-9]+/g, "jsxDEV").replace(/Fragment_[a-z0-9]+/g, "Fragment");
  const make = new Function("React", "jsxDEV", "Fragment", "useEffect", "useMemo", "useRef", "useState", "useMovementTable", "MovementTableControls", "TableColumnMenu", "CopyCellButton", "tableColumnSort", "nameOf", "movementNights", "movementGuestAttributes", "propertyId", javascript + "\nreturn MovementGrid;");
  const MovementGrid = make(React, jsxDEV, React.Fragment, useEffect, useMemo, useRef, useState, components.useMovementTable, components.MovementTableControls, components.TableColumnMenu, components.CopyCellButton, tableColumnSort, (row: { primaryGuestDisplayName: string }) => row.primaryGuestDisplayName, movementNights, movementGuestAttributes, PROPERTY);
  const html = renderToString(createElement(MovementGrid, { status: "in_house", timezone: "Asia/Riyadh", open() {}, onBilling() {}, lane: { reservations: [{ reservationId: RESERVATION, confirmationNo: "REF1", primaryGuestDisplayName: "Synthetic Guest", status: "in_house", stayFrom: "2026-10-01T00:00:00Z", stayTo: "2026-10-02T00:00:00Z" }] }, navigation: createElement(components.SegmentedRibbon, { label: "Guest movement views", value: "in_house", items: [{ key: "in_house", label: "In house", count: 1 }], onChange() {} }) }));
  for (const label of ["Guest movements", "movement-adaptive-grid", "table-controls", "segmented-ribbon", "Synthetic Guest", "Copy Guest cell text", "Dictate Search In-house reservations", "Not recorded", "Room unassigned"]) expect(html).toContain(label);
  expect(html).not.toContain("Ready");
  const errorHtml = renderToString(createElement(MovementGrid, { status: "in_house", timezone: "UTC", open() {}, error: "Permission denied" }));
  expect(errorHtml).toContain('role="alert"'); expect(errorHtml).toContain("Permission denied"); expect(errorHtml).not.toContain('role="table"');
}));

test("search preserves property-bound destination and hides stale submitted results; existing capability status remains exact", () => {
  const found = buildHotelSearchResults(PROPERTY, "Guest", [{ reservationId: RESERVATION, confirmationNo: "REF1", primaryGuestDisplayName: "Guest", status: "in_house" }], [], 30, { groups: [{ groupId: GROUP, code: "G1", name: "Guest group", kind: "linked", status: "open", memberCount: 1 }] });
  expect(found.results.find(result => result.kind === "reservation")?.href).toBe(`/p/${PROPERTY}/res/${RESERVATION}`);
  expect(found.results.find(result => result.kind === "group")?.href).toBe(`/p/${PROPERTY}/reservations?view=groups&group=${GROUP}`);
  expect(isHotelSearchCurrent("Changed", "Guest", false)).toBe(false); expect(isHotelSearchCurrent("Guest", "Guest", true)).toBe(false); expect(isHotelSearchCurrent("Guest", "Guest", false)).toBe(true);
  for (const [key, status] of [["reservations.crs", "preview"], ["revenue.rms-recommendations", "planned"], ["crm.guests", "live"], ["reservations.booking-engine", "blocked"]]) expect(CAPABILITY_REGISTRY.find(item => item.key === key)?.status).toBe(status);
});

test("saved dictation starts only after disclosure gesture, requires review/use and discards a changed field draft", () => {
  let started = 0, engine: SpeechEngine | undefined; const applied: string[] = [];
  class SyntheticSpeech implements SpeechEngine {
    continuous = false; interimResults = false; lang = "en"; onresult: SpeechEngine["onresult"] = null; onerror: SpeechEngine["onerror"] = null; onend: SpeechEngine["onend"] = null;
    constructor() { engine = this; } start() { ++started; } stop() { this.onend?.(); } abort() {}
  }
  const controller = new DictationController(() => {}, value => applied.push(value), () => SyntheticSpeech);
  try {
    controller.setField("", "one", 100, false); controller.setCurrentGuard(() => true);
    controller.open(); expect(started).toBe(0); expect(controller.state.stage).toBe("disclosure");
    controller.start(); expect(started).toBe(1);
    engine!.onresult?.({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: "Guest search" }, length: 1 }] });
    expect(applied).toEqual([]); controller.stop(); expect(controller.state.stage).toBe("review"); controller.use(); expect(applied).toEqual(["Guest search"]);
    controller.open(); controller.start(); engine!.onresult?.({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: "Stale" }, length: 1 }] });
    controller.stop(); controller.setField("Changed", "two", 100, false); controller.use(); expect(applied).toEqual(["Guest search"]); expect(controller.state.stage).toBe("closed");
  } finally { controller.dispose(); }
});
