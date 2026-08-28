import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const script = readFileSync(new URL("../src/http/operator/operator.js", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/app.ts", import.meta.url), "utf8");
const operator = readFileSync(new URL("../src/http/operator.ts", import.meta.url), "utf8");

function functionSource(source: string, name: string): string {
  const start = source.indexOf(`function ${name}(`);
  expect(start).toBeGreaterThan(-1);
  const next = source.indexOf("\n function ", start + 1);
  return source.slice(start, next === -1 ? source.length : next);
}

function asyncMethodSource(source: string, name: string): string {
  const start = source.indexOf(`  async ${name}(`);
  expect(start).toBeGreaterThan(-1);
  const next = source.indexOf("\n  async ", start + 1);
  return source.slice(start, next === -1 ? source.length : next);
}

describe("Order 218 exact vehicle linked-reservation navigation", () => {
  test("emits a semantic action only for the validated non-null reservation association", () => {
    const render = functionSource(script, "renderVehicleDetail");
    expect(render).toContain("vehicle.reservationId");
    expect(render).toContain('"vehicle-linked-reservation-action"');
    expect(render).toContain('"Open linked reservation"');
    expect(render).toMatch(/if \(vehicle\.reservationId !== null\)|if \(vehicle\.reservationId\)/);
    expect(render).toContain("openVehicleLinkedReservation");
  });

  test("rechecks every current identity and presentation boundary before navigation", () => {
    const current = functionSource(script, "vehicleLinkedReservationActionIsCurrent");
    expect(current).toContain('activeView === "vehicles"');
    expect(current).toContain("propertySelect.value");
    expect(current).toContain("vehicleRouteVehicleId");
    expect(current).toContain("Object.isFrozen(origin.detail)");
    expect(current).toContain("vehicleDetailData === origin.detail");
    expect(current).toContain("origin.detail.vehicleId === origin.vehicleId");
    expect(current).toContain("origin.detail.reservationId === origin.reservationId");
    expect(current).toContain("canonicalVehicleDetailPath");
    expect(current).toContain("location.pathname");
    expect(current).toContain("location.search");
    expect(current).toContain("vehicleDetailPanel");
    expect(current).toContain("isConnected");
    expect(current).toContain("action.disabled === false");
    expect(current).toContain("origin.panel.contains(action)");
    expect(current).toContain("hidden === false");
    expect(current).toMatch(/vehicleDetailRequestGeneration|generation/);
    expect(functionSource(script, "setView")).toContain("vehicleDetailRequestGeneration += 1");
  });

  test("targets only the existing canonical reservation route and read transport", () => {
    const openLinked = functionSource(script, "openVehicleLinkedReservation");
    const openReservation = functionSource(script, "openReservationDetail");
    const loadReservation = functionSource(script, "loadReservationDetail");
    expect(openLinked).toContain("vehicleLinkedReservationActionIsCurrent");
    expect(openLinked).toContain("openReservationDetail");
    expect(openReservation).toContain("/p/${propertySelect.value}/res/${reservationId}");
    expect(loadReservation).toContain("/api/v1/properties/${enc(property)}/reservations/${enc(reservationId)}");
    expect(app).toContain('.get("/p/:property/res/:reservation"');
    expect(openLinked).not.toContain("request(");
    expect(openLinked).not.toMatch(/\/api\/v1\//);
  });

  test("preserves the existing lifecycle-read authority and explicit 403 presentation", () => {
    const reservationDetail = asyncMethodSource(operator, "reservationDetail");
    const loadReservation = functionSource(script, "loadReservationDetail");
    expect(operator).toContain('const RESERVATION_LIFECYCLE_READ_SCOPE = "reservations.lifecycle:read"');
    expect(reservationDetail).toContain("hasScope(context, RESERVATION_LIFECYCLE_READ_SCOPE)");
    expect(reservationDetail).toContain('apiError(context.request, 403, "auth/scope_missing"');
    expect(reservationDetail).toContain('"Reservation access is not granted"');
    expect(loadReservation).toContain('error?.status === 403 ? "Reservation access is not granted for this property."');
  });

  test("adds one reservation history entry and supports refresh, Forward, Close, Escape and Back", () => {
    const openLinked = functionSource(script, "openVehicleLinkedReservation");
    const openReservation = functionSource(script, "openReservationDetail");
    const closeReservation = functionSource(script, "closeReservationDetail");
    const syncReservation = functionSource(script, "syncReservationRoute");
    expect((openLinked.match(/openReservationDetail\(/g) || []).length).toBe(1);
    expect((openLinked.match(/history\.pushState\(/g) || []).length).toBe(1);
    expect(openLinked).toContain("openReservationDetail(origin.reservationId, { push: false");
    expect(openReservation).toContain('yellowSurface: "reservation-detail"');
    expect(openReservation).toContain("vehicleLinkedReservationReturnFromState(history.state, propertySelect.value, reservationId)");
    expect(closeReservation).toContain("history.back()");
    expect(closeReservation).toContain('returnView === "vehicles"');
    expect(closeReservation).toContain('restoreFocus && returnView !== "vehicles"');
    expect(syncReservation).toContain("openReservationDetail(route.reservationId, { push: false");
    expect(script).toContain('window.addEventListener("popstate"');
    expect(script).toContain('if (!reservationDetailDrawer.hidden) { event.preventDefault(); closeReservationDetail(); return; }');
    expect(script).toContain('closeReservationDetail({ history: false, restoreFocus: false });\n  if (activeView !== "vehicles") setView("vehicles", false);\n  else syncVehicleRoute({ focus: true });');
  });

  test("returns first to authoritative vehicle detail and then to the exact retained register URL", () => {
    const linkedReturn = functionSource(script, "vehicleLinkedReservationReturnFromState");
    const syncVehicle = functionSource(script, "syncVehicleRoute");
    const openVehicle = functionSource(script, "openVehicleDetail");
    const closeVehicle = functionSource(script, "closeVehicleDetail");
    expect(script).toContain("vehicleLinkedReservationReturn");
    expect(linkedReturn).toContain('Object.keys(value).sort().join(",") !== "property,reservationId,vehicleDetailPath,vehicleId"');
    expect(linkedReturn).toContain('state?.yellowSurface !== "reservation-detail"');
    expect(linkedReturn).toContain("canonicalVehicleDetailPath");
    expect(syncVehicle).toContain("openVehicleDetail(route.vehicleId, { push: false, focus: true })");
    expect(openVehicle).toContain("loadVehicleDetail(vehicleId, { focus })");
    expect(openVehicle).toContain('yellowSurface: "vehicle-detail"');
    expect(openVehicle).toContain("vehicleReturnPath: returnPath");
    expect(closeVehicle).toContain("history.back()");
    expect(closeVehicle).toContain("returnPath");
    expect(openVehicle).toContain("vehicleReturnPathFromState(history.state, propertySelect.value)");
    expect(functionSource(script, "vehicleReturnPathFromState")).toContain('key !== "registration" && key !== "cursor"');
    expect(script).toContain('.vehicle-detail-title").focus({ preventScroll: true })');
  });

  test("adds no mutation, polling, storage or parking/onsite/access inference", () => {
    const linked = [
      functionSource(script, "vehicleLinkedReservationActionIsCurrent"),
      functionSource(script, "vehicleLinkedReservationReturnFromState"),
      functionSource(script, "openVehicleLinkedReservation"),
    ].join("\n");
    expect(linked).not.toMatch(/method:\s*"(?:POST|PUT|PATCH|DELETE)"/);
    expect(linked).not.toMatch(/setInterval|setTimeout|localStorage|sessionStorage/);
    expect(linked).not.toMatch(/parkingSpace|onsite|occupancy|accessDecision|accessAllowed/);
    expect(linked).not.toContain("request(");
  });
});
