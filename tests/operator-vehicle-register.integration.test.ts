import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { AvailabilityService } from "../src/contexts/inventory";
import { LocalLoginService } from "../src/contexts/identity";
import {
  VehicleRegisterConflictError,
  VehicleRegisterValidationError,
} from "../src/contexts/stay-operations";
import { OperatorHttpApi } from "../src/http/operator";
import type { TenantRequestContext, Tx } from "../src/kernel";

const TENANT = "00000000-0000-0000-0000-000000205001";
const PROPERTY = "00000000-0000-0000-0000-000000205002";
const ACTOR = "00000000-0000-0000-0000-000000205003";
const VEHICLE = "00000000-0000-0000-0000-000000205004";
const RESERVATION = "00000000-0000-0000-0000-000000205005";
const PARTY = "00000000-0000-0000-0000-000000205006";
const calls: unknown[] = [];

const vehicles = {
  async list(input: unknown) {
    calls.push(input);
    return {
      vehicles: [{
        vehicleId: VEHICLE,
        registration: "MH 12 AB 1234",
        make: "Tata",
        model: null,
        colour: "Blue",
        driverName: "Avery Driver",
        reservationId: RESERVATION,
        partyId: PARTY,
        enteredAt: "2026-08-28T08:00:00.000Z",
        exitedAt: null,
        notes: "must never cross the operator boundary",
        parkingSpaceId: "00000000-0000-0000-0000-000000205099",
      }],
      nextCursor: "eyJ2IjoxfQ",
    };
  },
};

const api = new OperatorHttpApi(
  {} as LocalLoginService,
  {} as AvailabilityService,
  undefined, // inventory
  undefined, // idempotency
  undefined, // restrictions
  undefined, // rates
  undefined, // pricing
  undefined, // blocks
  undefined, // policy
  undefined, // holds
  undefined, // projection
  undefined, // runtime status
  undefined, // rate builder
  undefined, // reservation commit
  undefined, // offers
  undefined, // guests
  undefined, // lifecycle
  undefined, // segments
  undefined, // parties
  undefined, // statements
  undefined, // charges
  undefined, // reservation board
  undefined, // reservation detail
  undefined, // folios
  undefined, // corrections
  undefined, // transfers
  undefined, // hosted deposits
  undefined, // settlements
  undefined, // cashiers
  undefined, // receivables
  undefined, // check-in
  undefined, // housekeeping tasks
  undefined, // housekeeping sheets
  undefined, // checkout readiness
  undefined, // checkout command
  vehicles,
);

function context(query: string, scopes: readonly string[], granted = true): TenantRequestContext {
  const tx = (() => Promise.resolve(granted
    ? [{ id: PROPERTY, name: "Hotel", timezone: "UTC", currency: "INR" }]
    : [])) as unknown as Tx;
  return {
    tenantId: TENANT,
    request: new Request(`http://yellow.test/api/v1/properties/${PROPERTY}/vehicles${query}`),
    tx,
    identity: { tenantId: TENANT, actorId: ACTOR, scopes },
  };
}

const html = readFileSync(new URL("../src/http/operator/index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/http/operator/operator.css", import.meta.url), "utf8");
const script = readFileSync(new URL("../src/http/operator/operator.js", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/app.ts", import.meta.url), "utf8");

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

describe("Order 205 operator Vehicle Register read", () => {
  test("GET is no-store, exactly scoped/property-granted and preserves literal query input", async () => {
    calls.length = 0;
    const response = await api.vehicleRegister(
      context("?registration=MH%2012%20AB%201234&cursor=eyJ2IjoxfQ&limit=25", ["stay-operations.vehicles:read"]),
      PROPERTY,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      nextCursor: "eyJ2IjoxfQ",
      vehicles: [{
        colour: "Blue",
        driverName: "Avery Driver",
        enteredAt: "2026-08-28T08:00:00.000Z",
        exitedAt: null,
        make: "Tata",
        model: null,
        partyId: PARTY,
        registration: "MH 12 AB 1234",
        reservationId: RESERVATION,
        vehicleId: VEHICLE,
      }],
    });
    expect(calls).toEqual([{ tenantId: TENANT, propertyNode: PROPERTY, registration: "MH 12 AB 1234", cursor: "eyJ2IjoxfQ", limit: 25 }]);
  });

  test("scope, concealment and the exact registration/cursor/limit boundary fail closed", async () => {
    calls.length = 0;
    expect((await api.vehicleRegister(context("", []), PROPERTY)).status).toBe(403);
    expect((await api.vehicleRegister(context("", ["stay-operations.vehicles:read"], false), PROPERTY)).status).toBe(404);
    const scope = ["stay-operations.vehicles:read"];
    for (const query of ["?offset=1", "?limit=0", "?limit=101", "?limit=1.5", "?cursor=bad%3D", "?cursor=a&cursor=b", "?registration=a&registration=b"]) {
      expect((await api.vehicleRegister(context(query, scope), PROPERTY)).status).toBe(400);
    }
    expect((await api.vehicleRegister(context("", scope), "bad")).status).toBe(400);
    expect(calls).toEqual([]);
  });

  test("an explicitly empty or whitespace registration remains a literal service input", async () => {
    calls.length = 0;
    expect((await api.vehicleRegister(context("?registration=", ["stay-operations.vehicles:read"]), PROPERTY)).status).toBe(200);
    expect((await api.vehicleRegister(context("?registration=%20", ["stay-operations.vehicles:read"]), PROPERTY)).status).toBe(200);
    expect(calls).toEqual([
      { tenantId: TENANT, propertyNode: PROPERTY, registration: "" },
      { tenantId: TENANT, propertyNode: PROPERTY, registration: " " },
    ]);
  });

  test("domain failures are bounded and hostile association detail is concealed", async () => {
    const request = new Request("http://yellow.test/x");
    expect(await api.failure(request, new VehicleRegisterValidationError("private cursor bytes")).json())
      .toMatchObject({ status: 400, type: "request/invalid", detail: "Vehicle register input is invalid" });
    const conflict = await api.failure(request, new VehicleRegisterConflictError(`foreign ${RESERVATION}`)).json();
    expect(conflict).toMatchObject({ status: 409, type: "vehicles/conflict" });
    expect(JSON.stringify(conflict)).not.toContain(RESERVATION);
  });

  test("the app exposes only the exact read route and one deep-linkable workbench route", () => {
    expect(app).toContain('.get("/api/v1/properties/:property/vehicles"');
    expect(app).toContain('.get("/p/:property/vehicles"');
    expect(app).not.toContain('.post("/api/v1/properties/:property/vehicles"');
    expect(app).not.toContain('.put("/api/v1/properties/:property/vehicles"');
    expect(app).not.toContain('.delete("/api/v1/properties/:property/vehicles"');
  });

  test("the human register has literal search, paging, loading, empty, error and retry states", () => {
    for (const id of [
      "nav-vehicles", "vehicles-view", "vehicles-title", "vehicle-search-form", "vehicle-registration",
      "vehicle-search-clear", "vehicle-result-summary", "vehicle-register-loading", "vehicle-register-error",
      "vehicle-register-retry", "vehicle-register-empty", "vehicle-register-list", "vehicle-register-next",
    ]) expect(html).toContain(`id="${id}"`);
    expect(html).toContain("case-sensitive registration plate");
    expect(html).toContain("does not trim, normalize, infer onsite status, disclose notes or assign parking");
    expect(html).toContain('role="alert"');
    expect(html).toContain('aria-busy="false"');

    const load = functionSource("loadVehicleRegister");
    const current = functionSource("vehicleRegisterIsCurrent");
    const result = functionSource("vehicleRegisterResult");
    const row = functionSource("vehicleRecordResult");
    const card = functionSource("vehicleCard");
    expect(load).toContain("/vehicles?");
    expect(load).toContain('query.set("registration", registration)');
    expect(load).toContain('query.set("cursor", cursor)');
    expect(load).toContain('limit: "25"');
    expect(load).toContain("vehicleRegisterRetry.focus");
    expect(load).toContain("vehicleRegisterResult");
    expect(current).toContain("vehicleRegisterGeneration");
    expect(current).toContain('activeView === "vehicles"');
    expect(current).toContain("propertySelect.value");
    expect(current).toContain("vehicleRegisterFilter");
    expect(current).toContain("vehicleRegisterCursor");
    expect(result).toContain("vehicleRecordResult(vehicle)");
    expect(row).toContain('Object.keys(vehicle).sort()');
    expect(card).not.toMatch(/notes|parking|onsite|occupancy/i);
    expect(load).not.toMatch(/localStorage|sessionStorage|setInterval|trim\(|toUpperCase|toLowerCase|replaceAll/);
  });

  test("Vehicle Register remains keyboard-sized, responsive and compatible with every appearance", () => {
    expect(css).toContain(".vehicle-register");
    expect(css).toContain("min-height: 44px");
    expect(css).toContain("min-height: 48px");
    for (const theme of ["apple", "android", "win95", "glass", "neo", "erp"]) {
      expect(css).toContain(`:root[data-theme="${theme}"] .vehicle-register`);
    }
    expect(css).toContain("@media (max-width: 420px)");
    expect(css).toContain("@media (forced-colors: active)");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
