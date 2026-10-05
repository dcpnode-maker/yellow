import { expect, test } from "bun:test";

const app = await Bun.file("frontend/yellow/src/App.tsx").text();
const hub = await Bun.file("frontend/yellow/src/workspaces/OperationalHub.tsx").text();
const ribbon = await Bun.file("frontend/yellow/src/ui/SegmentedRibbon.tsx").text();
const drawer = await Bun.file("frontend/yellow/src/ui/OptionsDrawer.tsx").text();
const badge = await Bun.file("frontend/yellow/src/ui/StatusBadge.tsx").text();
const css = await Bun.file("frontend/yellow/src/styles.css").text();

test("the operational shell is a lazy governed workspace", () => {
  expect(app).toContain('const OperationalHub = lazy(() => import("./workspaces/OperationalHub"))');
  expect(app).toContain('| "operations"');
  expect(app).toContain('routeWorkspacePart === "operations"');
  expect(app).toContain('if (workspacePart === "operations")');
  expect(app).toContain("<Suspense fallback=");
  expect(app).toContain('onMouseEnter={() => void import("./workspaces/OperationalHub")}');
  expect(app).toContain('onFocus={() => void import("./workspaces/OperationalHub")}');
});

test("the ribbon is keyboard navigable and touch sized", () => {
  expect(ribbon).toContain('role="tablist"');
  expect(ribbon).toContain('role="tab"');
  expect(ribbon).toContain('aria-selected={item.key === value}');
  expect(ribbon).toContain('event.key === "ArrowLeft"');
  expect(ribbon).toContain('event.key === "ArrowRight"');
  expect(ribbon).toContain('event.key === "Home"');
  expect(ribbon).toContain('event.key === "End"');
  expect(ribbon).toContain('window.matchMedia("(prefers-reduced-motion: reduce)").matches');
  expect(css).toContain("min-height: 46px;");
  expect(css).toContain("min-height: 44px;");
});

test("detail remains contextual and honest", () => {
  expect(drawer).toContain('role="dialog"');
  expect(drawer).toContain('aria-modal="true"');
  expect(drawer).toContain('event.key === "Escape"');
  expect(hub).toContain("No result has been inferred");
  expect(hub).toContain("Yellow does not invent an action when no governed command exists.");
  expect(hub).toContain("These remain disabled until their governed connector is accepted.");
  expect(hub).toContain('<button type="button" disabled><strong>Overture</strong>');
  expect(hub).toContain("Booking.com · Expedia · Agoda");
});

test("status language uses one restrained verified glow and no LED decoration", () => {
  expect(badge).toContain('verified: "✓"');
  expect(css).toContain(".status-verified");
  expect(css).toContain("rgba(57,255,98,.7)");
  expect(css).toContain(".status-warning");
  expect(css).toContain(".status-urgent");
  expect(css.toLowerCase()).not.toContain("led-bulb");
});

test("the hub exposes live daily domains without faking unsupported mutations", () => {
  expect(hub).toContain('{ key: "rooms"');
  expect(hub).toContain('{ key: "arrivals"');
  expect(hub).toContain('{ key: "departures"');
  expect(hub).toContain('{ key: "service"');
  expect(hub).toContain('{ key: "sources"');
  expect(hub).toContain("observedSources");
  expect(hub).toContain("const sourcesTrusted");
  expect(hub).toContain("count: sourcesTrusted ? observedSources.length : null");
  expect(hub).toContain("displayedSources.map");
  expect(hub).toContain("onOpenReservation(stay)");
  expect(hub).toContain('onNavigate("housekeeping")');
  expect(hub).not.toContain('method: "POST"');
});
