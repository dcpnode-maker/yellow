import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const script = readFileSync(new URL("../src/http/operator/operator.js", import.meta.url), "utf8");

function functionSource(name: string): string {
  const start = script.indexOf(`function ${name}(`);
  expect(start).toBeGreaterThan(-1);
  const opening = script.indexOf(") {", start) + 2;
  let depth = 0;
  for (let index = opening; index < script.length; index += 1) {
    if (script[index] === "{") depth += 1;
    if (script[index] === "}") depth -= 1;
    if (depth === 0) return script.slice(start, index + 1);
  }
  throw new Error(`Unclosed function ${name}`);
}

describe("Order 225 exact Vehicle Register linked-reservation continuity", () => {
  test("admits only an exact frozen linked row from the successfully rendered current page", () => {
    const card = functionSource("vehicleCard");
    const result = functionSource("vehicleRegisterResult");
    const render = functionSource("renderVehicleRegister");

    expect(result).toContain("Object.freeze");
    expect(result).toContain("vehicleRecordResult(vehicle)");
    expect(render).toContain("vehicleRegisterRows");
    expect(render).toContain("page.vehicles");
    expect(card).toContain("vehicle.reservationId !== null");
    expect(card).toContain('"vehicle-register-linked-reservation-action"');
    expect(card).toContain('"Open linked reservation"');
    expect(card).toContain("Object.freeze({");
    for (const identity of [
      "pageGeneration", "property", "registration", "cursor", "registerPath",
      "vehicleId", "reservationId", "row", "card",
    ]) expect(card).toContain(`${identity}:`);
    expect(card).toContain("openVehicleRegisterLinkedReservation");
  });

  test("rechecks the complete page, route, row, card, action and dataset mismatch matrix", () => {
    const current = functionSource("vehicleRegisterLinkedReservationActionIsCurrent");
    for (const boundary of [
      "vehicleRegisterGeneration", 'activeView === "vehicles"', "propertySelect.value",
      "vehicleRegisterFilter", "vehicleRegisterCursor", "vehicleRegisterRenderedPath",
      "vehicleRegisterRows", "Object.isFrozen(origin.row)", "origin.row.vehicleId",
      "origin.row.reservationId", "vehicleRegisterList", "origin.card.isConnected",
      "origin.card.hidden", "origin.card.contains(action)", "action.isConnected",
      "action.hidden", "action.disabled", "action.dataset.vehicleId",
      "action.dataset.reservationId", "location.pathname", "location.search",
    ]) expect(current).toContain(boundary);
    expect(current).toContain("canonicalVehiclePath");
    expect(current).toContain("origin.registerPath");
    expect(current).toContain("vehicleRegister.hidden === false");
  });

  test("pushes exactly one minimized reservation entry and reuses the existing detail read", () => {
    const open = functionSource("openVehicleRegisterLinkedReservation");
    expect(open).toContain("vehicleRegisterLinkedReservationActionIsCurrent");
    expect(open).toContain("vehicleRegisterLinkedReservationReturn");
    expect(open).toContain("Object.freeze({");
    for (const identity of [
      "property", "vehicleId", "reservationId", "registration", "cursor", "registerPath", "pageGeneration",
    ]) expect(open).toContain(`${identity}:`);
    expect((open.match(/history\.pushState\(/g) || []).length).toBe(1);
    expect(open).toContain('yellowSurface: "reservation-detail"');
    expect(open).toContain("canonicalReservationDetailPath");
    expect((open.match(/openReservationDetail\(/g) || []).length).toBe(1);
    expect(open).toContain("push: false");
    expect(open).not.toContain("request(");
    expect(open).not.toMatch(/\/api\/v1\//);
  });

  test("validates the frozen return state and supports refresh plus browser Forward", () => {
    const fromState = functionSource("vehicleRegisterLinkedReservationReturnFromState");
    const openReservation = functionSource("openReservationDetail");
    const syncReservation = functionSource("syncReservationRoute");

    expect(fromState).toContain('state?.yellowSurface !== "reservation-detail"');
    expect(fromState).toContain("vehicleRegisterLinkedReservationReturn");
    expect(fromState).toContain("Object.keys(value).sort().join(\",\")");
    expect(fromState).toContain("canonicalVehiclePath");
    expect(fromState).toContain("Object.freeze({");
    expect(openReservation).toContain("vehicleRegisterLinkedReservationReturnFromState");
    expect(syncReservation).toContain("openReservationDetail(route.reservationId, { push: false");
    expect(script).toContain('window.addEventListener("popstate"');
  });

  test("Close, Escape and Back refetch the exact register and restore exact or safe focus", () => {
    const closeReservation = functionSource("closeReservationDetail");
    const returning = functionSource("returnFromReservationToVehicleRegister");
    const load = functionSource("loadVehicleRegister");

    expect(closeReservation).toContain("returnFromReservationToVehicleRegister");
    expect(closeReservation).toContain("history.back()");
    expect(returning).toContain('setView("vehicles", false)');
    expect(returning).toContain("vehicleRegisterFilter");
    expect(returning).toContain("vehicleRegisterCursor");
    expect(returning).toContain("loadVehicleRegister");
    expect(returning).toContain("vehicle-register-linked-reservation-action");
    expect(returning).toContain("vehicleResultSummary");
    expect(returning).toContain("focus({ preventScroll: true })");
    expect(load).toContain("vehicleRegisterResult");
    expect(load).toContain("renderVehicleRegister");
    expect(script).toContain('if (!reservationDetailDrawer.hidden) { event.preventDefault(); closeReservationDetail(); return; }');
  });

  test("preserves Open vehicle and the Order218 detail-to-reservation composition", () => {
    const card = functionSource("vehicleCard");
    const openVehicle = functionSource("openVehicleDetail");
    const detailLinked = functionSource("openVehicleLinkedReservation");
    const detailCurrent = functionSource("vehicleLinkedReservationActionIsCurrent");

    expect(card).toContain('"Open vehicle"');
    expect(card).toContain("vehicle-detail-action");
    expect(card).toContain("openVehicleRegisterLinkedReservation");
    expect(script).toContain('vehicleRegisterList.addEventListener("click"');
    expect(script).toContain("openVehicleDetail(action.dataset.vehicleId, { trigger: action })");
    expect(openVehicle).toContain('yellowSurface: "vehicle-detail"');
    expect(detailLinked).toContain("vehicleLinkedReservationActionIsCurrent");
    expect(detailLinked).toContain("openReservationDetail(origin.reservationId, { push: false");
    expect(detailCurrent).toContain("vehicleDetailData === origin.detail");
  });

  test("adds no request, write, polling, storage or operational inference", () => {
    const continuity = [
      functionSource("vehicleRegisterLinkedReservationActionIsCurrent"),
      functionSource("vehicleRegisterLinkedReservationReturnFromState"),
      functionSource("openVehicleRegisterLinkedReservation"),
      functionSource("returnFromReservationToVehicleRegister"),
    ].join("\n");

    expect(continuity).not.toContain("request(");
    expect(continuity).not.toMatch(/method:\s*"(?:POST|PUT|PATCH|DELETE)"/);
    expect(continuity).not.toMatch(/setInterval|setTimeout|localStorage|sessionStorage|indexedDB/);
    expect(continuity).not.toMatch(/parkingSpace|onsite|occupancy|accessDecision|accessAllowed|accessGranted/);
  });
});
