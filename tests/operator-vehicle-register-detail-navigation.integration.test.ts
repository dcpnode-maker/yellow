import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const script = readFileSync(new URL("../src/http/operator/operator.js", import.meta.url), "utf8");

function functionSource(name: string): string {
  const start = script.indexOf(`function ${name}(`);
  expect(start).toBeGreaterThan(-1);
  const next = script.indexOf("\n function ", start + 1);
  return script.slice(start, next === -1 ? script.length : next);
}

describe("Order 216 exact Vehicle Register detail navigation", () => {
  test("admits only the exact nested vehicle route and preserves the literal list route", () => {
    expect(functionSource("canonicalVehicleDetailPath")).toContain("/vehicles/${vehicleId}");
    expect(functionSource("vehicleDetailRouteFromLocation")).toContain("/vehicles\\/([0-9a-f-]+)$");
    expect(functionSource("vehicleNavigationRoute")).toContain('kind: "detail"');
    expect(functionSource("vehicleNavigationRoute")).toContain('kind: "register"');
    expect(functionSource("vehicleReturnPathFromState")).toContain('key !== "registration" && key !== "cursor"');
    expect(script).toContain('(?:\\/[0-9a-f-]+)?$/');
  });

  test("validates the exact envelope, row keys, routed identity and canonical timestamps", () => {
    const envelope = functionSource("vehicleDetailResult");
    const record = functionSource("vehicleRecordResult");
    const instant = functionSource("vehicleCanonicalInstant");
    expect(envelope).toContain('Object.keys(value).sort().join(",") !== "vehicle"');
    expect(envelope).toContain("vehicleRecordResult(value.vehicle, origin.vehicleId)");
    expect(record).toContain('Object.keys(vehicle).sort().join(",") !== keys.join(",")');
    expect(record).toContain("vehicle.vehicleId !== expectedId");
    expect(instant).toContain("\\.\\d{6}Z");
    expect(instant).toContain("Number.isFinite(Date.parse(value))");
  });

  test("opens only from a validated semantic action and fetches dedicated server truth", () => {
    const card = functionSource("vehicleCard");
    const load = functionSource("loadVehicleDetail");
    expect(card).toContain('"Open vehicle"');
    expect(card).toContain("open.dataset.vehicleId = vehicle.vehicleId");
    expect(script).toContain('vehicleRegisterList.addEventListener("click"');
    expect(script).toContain("openVehicleDetail(action.dataset.vehicleId, { trigger: action })");
    expect(load).toContain("/vehicles/${enc(origin.vehicleId)}");
    expect(load).toContain("vehicleDetailResult(body, origin)");
  });

  test("guards stale detail paint at every current identity boundary", () => {
    const current = functionSource("vehicleDetailRequestIsCurrent");
    expect(current).toContain("vehicleDetailRequestGeneration");
    expect(current).toContain('activeView === "vehicles"');
    expect(current).toContain("origin.property === propertySelect.value");
    expect(current).toContain("origin.vehicleId === vehicleRouteVehicleId");
    expect(current).toContain("panel.isConnected");
    expect(current).toContain("vehicleRegister.hidden === true");
    expect(current).toContain("canonicalVehicleDetailPath(origin.property, origin.vehicleId)");
    expect(functionSource("loadVehicleDetail").match(/vehicleDetailRequestIsCurrent\(origin, panel\)/g)?.length).toBeGreaterThanOrEqual(4);
  });

  test("supports direct refresh, Back, Forward, Escape, return URL and focus restoration", () => {
    const open = functionSource("openVehicleDetail");
    const close = functionSource("closeVehicleDetail");
    const sync = functionSource("syncVehicleRoute");
    expect(open).toContain('yellowSurface: "vehicle-detail"');
    expect(open).toContain("vehicleReturnPath: returnPath");
    expect(close).toContain("history.back()");
    expect(close).toContain("returnFocus?.isConnected");
    expect(sync).toContain("vehicleNavigationRoute()");
    expect(sync).toContain("loadVehicleRegister({ cursor: route.cursor");
    expect(script).toContain('activeView === "vehicles" && event.key === "Escape"');
    expect(script).toContain('window.addEventListener("popstate"');
  });

  test("preserves the canonical detail read while parking remains a separate governed command", () => {
    const detail = [
      functionSource("renderVehicleDetail"),
      functionSource("loadVehicleDetail"),
      functionSource("openVehicleDetail"),
    ].join("\n");
    expect(detail).not.toMatch(/method:\s*"(?:POST|PUT|PATCH|DELETE)"/);
    expect(detail).not.toMatch(/setInterval|setTimeout|localStorage|sessionStorage/);
    expect(detail).not.toMatch(/notes/);
    expect(detail).toContain("separate governed parking command");
    expect(detail).toContain("void loadVehicleParking(origin, panel)");
  });
});
