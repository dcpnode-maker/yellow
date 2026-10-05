import { expect, test } from "bun:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { reservationViewFromSearch, reservationViewDestination, reservationViewForDestination, reservationViewHref } from "../frontend/yellow/src/reservation-navigation";
const P = "6081b544-22a1-534f-a86d-bb1ae0519e14";
async function withWindowAsync<T>(run: () => Promise<T>): Promise<T> {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: { location: { pathname: `/p/${P}/reservations`, search: "?view=crs" } } });
  try { return await run(); } finally { if (descriptor) Object.defineProperty(globalThis, "window", descriptor); else Reflect.deleteProperty(globalThis, "window"); }
}
function withWindow<T>(run: () => T): T {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: {
    location: { pathname: `/p/${P}/reservations`, search: "?view=crs", hash: "" },
    localStorage: { getItem: () => null, setItem() {} }, innerWidth: 1280, addEventListener() {}, removeEventListener() {},
  } });
  try { return run(); } finally { if (descriptor) Object.defineProperty(globalThis, "window", descriptor); else Reflect.deleteProperty(globalThis, "window"); }
}
const imports = await withWindowAsync(() => Promise.all([import("../frontend/yellow/src/ui/OperatorHeader"),
  import("../frontend/yellow/src/workspaces/StaffCrsWorkspace"), import("../frontend/yellow/src/workspaces/StaffRmsWorkspace")]));
// Real components render without running effects or opening transports.
test("CRS view joins original three reservation views and discards old creation draft on view navigation", () => {
  expect(reservationViewForDestination("reservations:crs")).toBe("crs"); expect(reservationViewFromSearch("?view=crs")).toBe("crs");
  expect(reservationViewDestination("crs")).toBe("reservations:crs");
  for (const view of ["list", "groups", "calendar", "crs"] as const) {
    const url = reservationViewHref(`/p/${P}/reservations`, "?group=stale&create=crs&from=2026-10-02&option_ref=old", "#row", view);
    expect(url).not.toContain("create="); expect(url).not.toContain("option_ref="); expect(url).toEndWith("#row");
    if (view !== "groups") expect(url).not.toContain("group=");
  }
});
test("actual original header renders named staff entries and retained hierarchy while locks disable navigation", () => withWindow(() => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  try {
    const render = (locked: boolean) => renderToString(createElement(QueryClientProvider, { client }, createElement(imports[0].OperatorHeader, {
      workspace: "reservations", propertyId: P, propertyName: "Synthetic property", locked, onNavigate() {}, onBilling() {},
      children: createElement("div", { className: "property-switcher" }, "Granted properties"),
    })));
    const html = render(false);
    for (const label of ["Operate", "Business", "System", "Reservations", "Individual", "Groups", "Calendar", "CRS", "CRM", "RMS", "Guests &amp; profiles", "Department tasks", "Rates &amp; distribution", "All workspaces", "Granted properties"]) expect(html).toContain(label);
    const locked = render(true); for (const label of ["CRS", "CRM", "RMS", "Guests &amp; profiles", "Department tasks"]) expect(locked).toMatch(new RegExp(`aria-label="${label}"[^>]*disabled=""`));
  } finally { client.clear(); }
}));
test("actual CRS handoff callback preserves each parent lock and rejects nonlocal or malformed destinations", async () => {
  const source = await Bun.file(new URL("../frontend/yellow/src/App.tsx", import.meta.url)).text();
  const start = source.indexOf("  const continueCrs = (href:"); const end = source.indexOf("  const billingDesk =", start);
  expect(start).toBeGreaterThan(0); const js = new Bun.Transpiler({ loader: "tsx" }).transformSync(source.slice(start, end));
  const make = new Function("reservationLifecycleBusyRef", "voiceTransferRecoveryLockedRef", "propertyModeNavigationLocked", "window", js + "\nreturn continueCrs;");
  for (const locks of [[false, false, false], [true, false, false], [false, true, false], [false, false, true]]) {
    const calls: string[] = []; const action = make({ current: locks[0] }, { current: locks[1] }, locks[2], { location: { assign: (href: string) => calls.push(href) } });
    const href = `/p/${P}/reservations?create=crs&from=2026-10-02`;
    action(href); action("https://outside.invalid/" + href); action(`/p/${P}/reservations?view=crs`);
    expect(calls).toEqual(locks.some(Boolean) ? [] : [href]);
  }
});
test("actual staff components render current controls and explicit authority limits using the original shell classes", () => withWindow(() => {
  const crs = renderToString(createElement(imports[1].StaffCrsWorkspace, { propertyId: P, timezone: "Asia/Riyadh", onContinue() {} }));
  for (const text of ["Staff CRS", "CRS", "Granted properties", "Search granted properties", "canonical guest", "explicit confirmation"]) expect(crs).toContain(text);
  const rms = renderToString(createElement(imports[2].StaffRmsWorkspace, { propertyId: P, snapshot: { ratePlans: [], inventory: { sellableUnits: [] } } }));
  for (const text of ["Staff RMS", "Rate models", "Quote resolver", "Recorded economics", "No configured rate plan", "does not publish rates"]) expect(rms).toContain(text);
}));

test("actual asynchronous CRS selection dereferences the latest parent guard and discards edited or revoked property drafts", async () => {
  const source = await Bun.file(new URL("../frontend/yellow/src/workspaces/StaffCrsWorkspace.tsx", import.meta.url)).text();
  const start = source.indexOf("  const continueWith = async"); const end = source.indexOf("  return <section", start);
  const js = new Bun.Transpiler({ loader: "tsx" }).transformSync(source.slice(start, end));
  const make = new Function("result", "busy", "generation", "active", "setBusy", "setError", "client", "navigation", "staffCrsReservationHref", js + "\nreturn continueWith;");
  const row = { property: { id: P, timezone: "Asia/Riyadh" }, offers: [] }; const offer = {};
  for (const scenario of ["current", "edit", "parent-lock", "revoked"]) {
    let resolve!: (value: unknown) => void; const pending = new Promise(done => { resolve = done; });
    const generation = { current: 4 }, active = { current: null as AbortController | null }, calls: string[] = [], errors: string[] = [];
    const navigation = { current: (href: string) => { calls.push(href); } };
    const action = make({ rows: [row], draft: {} }, false, generation, active, () => {}, (value: string) => errors.push(value),
      { properties: () => pending }, navigation, () => `/p/${P}/reservations?create=crs&from=2026-10-02`);
    const running = action(row, offer);
    if (scenario === "edit") { ++generation.current; active.current?.abort(); }
    if (scenario === "parent-lock") navigation.current = () => {}; // Actual parent passes a newly guarded callback after render.
    resolve(scenario === "revoked" ? [] : [row.property]); await running;
    expect(calls).toHaveLength(scenario === "current" ? 1 : 0);
    if (scenario === "revoked") expect(errors.at(-1)).toContain("Access to this property changed");
  }
});

test("actual RMS asynchronous controls discard changed inputs, view and property generations before rendering", async () => {
  const source = await Bun.file(new URL("../frontend/yellow/src/workspaces/StaffRmsWorkspace.tsx", import.meta.url)).text();
  const start = source.indexOf("  const read = async"); const end = source.indexOf("  return <article", start);
  const js = new Bun.Transpiler({ loader: "tsx" }).transformSync(source.slice(start, end));
  const make = new Function("invalidate", "generation", "active", "setBusy", "setError", "view", "snapshot", "plan", "unit", "client", "propertyId", "setBuilder", "setQuote", "setEconomics", "ages", "arrival", "departure", "adults", "channel", js + "\nreturn read;");
  const id = "22222222-2222-4222-8222-222222222222";
  for (const view of ["models", "quote", "economics"]) for (const stale of [false, true]) {
    let resolve!: (value: unknown) => void; const pending = new Promise(done => { resolve = done; });
    const generation = { current: 0 }, active = { current: null as AbortController | null }, rendered: unknown[] = [];
    const invalidate = () => { ++generation.current; active.current?.abort(); active.current = null; };
    const action = make(invalidate, generation, active, () => {}, () => {}, view, { ratePlans: [{ id }], inventory: { sellableUnits: [{ id }] } }, id, id,
      { builder: () => pending, quote: () => pending, economics: () => pending }, P,
      (value: unknown) => rendered.push(value), (value: unknown) => rendered.push(value), (value: unknown) => rendered.push(value), "0,12", "2026-10-02", "2026-10-05", 2, "direct");
    const running = action(); if (stale) invalidate(); resolve({ syntheticEvidence: view }); await running;
    expect(rendered).toEqual(stale ? [] : [{ syntheticEvidence: view }]);
  }
});
