import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { AvailabilityService } from "../src/contexts/inventory";
import { LocalLoginService } from "../src/contexts/identity";
import {
  VehicleRegisterConflictError,
  VehicleRegisterNotFoundError,
  VehicleRegisterValidationError,
} from "../src/contexts/stay-operations";
import { OperatorHttpApi } from "../src/http/operator";
import type { TenantRequestContext, Tx } from "../src/kernel";

const TENANT = "00000000-0000-0000-0000-000000216001";
const PROPERTY = "00000000-0000-0000-0000-000000216002";
const ACTOR = "00000000-0000-0000-0000-000000216003";
const VEHICLE = "00000000-0000-0000-0000-000000216004";
const RESERVATION = "00000000-0000-0000-0000-000000216005";
const PARTY = "00000000-0000-0000-0000-000000216006";
const calls: unknown[] = [];

const vehicles = {
  async list() {
    return { vehicles: [], nextCursor: null };
  },
  async get(input: unknown) {
    calls.push(input);
    return {
      vehicleId: VEHICLE,
      registration: "MH 12 AB 1234",
      make: "Tata",
      model: null,
      colour: "Blue",
      driverName: "Avery Driver",
      reservationId: RESERVATION,
      partyId: PARTY,
      enteredAt: "2026-08-28T08:00:00.123456Z",
      exitedAt: null,
      notes: "must never cross the adapter boundary",
      parkingSpaceId: "00000000-0000-0000-0000-000000216099",
      onsite: true,
    };
  },
};

function operator(vehicleRegister: typeof vehicles | undefined = vehicles): OperatorHttpApi {
  return new OperatorHttpApi(
    {} as LocalLoginService,
    {} as AvailabilityService,
    undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
    undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
    undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
    undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
    undefined, vehicleRegister,
  );
}

function operatorWithoutVehicleDetail(): OperatorHttpApi {
  return new OperatorHttpApi({} as LocalLoginService, {} as AvailabilityService);
}

function context(
  query = "",
  scopes: readonly string[] = ["stay-operations.vehicles:read"],
  granted = true,
): TenantRequestContext {
  const tx = (() => Promise.resolve(granted
    ? [{ id: PROPERTY, name: "Hotel", timezone: "UTC", currency: "INR" }]
    : [])) as unknown as Tx;
  return {
    tenantId: TENANT,
    request: new Request(`http://yellow.test/api/v1/properties/${PROPERTY}/vehicles/${VEHICLE}${query}`),
    tx,
    identity: { tenantId: TENANT, actorId: ACTOR, scopes },
  };
}

describe("Order 216 exact vehicle-register HTTP detail", () => {
  test("returns only the approved row in one no-store vehicle envelope", async () => {
    calls.length = 0;
    const response = await operator().vehicleRegisterDetail(context(), PROPERTY, VEHICLE);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      vehicle: {
        colour: "Blue",
        driverName: "Avery Driver",
        enteredAt: "2026-08-28T08:00:00.123456Z",
        exitedAt: null,
        make: "Tata",
        model: null,
        partyId: PARTY,
        registration: "MH 12 AB 1234",
        reservationId: RESERVATION,
        vehicleId: VEHICLE,
      },
    });
    expect(calls).toEqual([{ tenantId: TENANT, propertyNode: PROPERTY, vehicleId: VEHICLE }]);
  });

  test("UUID, no-query, scope and exact property grant fail before the detail read", async () => {
    calls.length = 0;
    const api = operator();
    expect((await api.vehicleRegisterDetail(context("?registration=x"), PROPERTY, VEHICLE)).status).toBe(400);
    expect((await api.vehicleRegisterDetail(context("?x=1&x=2"), PROPERTY, VEHICLE)).status).toBe(400);
    expect((await api.vehicleRegisterDetail(context("", []), PROPERTY, VEHICLE)).status).toBe(403);
    expect((await api.vehicleRegisterDetail(context("", ["stay-operations.vehicles:read"], false), PROPERTY, VEHICLE)).status).toBe(404);
    expect((await api.vehicleRegisterDetail(context(), "bad", VEHICLE)).status).toBe(400);
    expect((await api.vehicleRegisterDetail(context(), PROPERTY, "bad")).status).toBe(400);
    expect(calls).toEqual([]);
  });

  test("domain failures and missing composition map to bounded 400/404/409/503 outcomes", async () => {
    const api = operator();
    const request = new Request("http://yellow.test/x");
    expect(await api.failure(request, new VehicleRegisterValidationError("private input")).json())
      .toMatchObject({ status: 400, type: "request/invalid" });
    expect(await api.failure(request, new VehicleRegisterNotFoundError()).json())
      .toMatchObject({ status: 404, type: "vehicles/not_found" });
    const conflict = await api.failure(
      request,
      new VehicleRegisterConflictError(`foreign ${RESERVATION}`),
    ).json();
    expect(conflict).toMatchObject({ status: 409, type: "vehicles/conflict" });
    expect(JSON.stringify(conflict)).not.toContain(RESERVATION);
    expect((await operatorWithoutVehicleDetail().vehicleRegisterDetail(context(), PROPERTY, VEHICLE)).status).toBe(503);
  });

  test("wires only exact GET API and human routes without vehicle mutation authority", () => {
    const app = readFileSync(new URL("../src/app.ts", import.meta.url), "utf8");
    expect(app).toContain('.get("/api/v1/properties/:property/vehicles/:vehicle"');
    expect(app).toContain("operator.vehicleRegisterDetail(");
    expect(app).toContain('.get("/p/:property/vehicles/:vehicle"');
    expect(app).not.toContain('.post("/api/v1/properties/:property/vehicles/:vehicle"');
    expect(app).not.toContain('.put("/api/v1/properties/:property/vehicles/:vehicle"');
    expect(app).not.toContain('.patch("/api/v1/properties/:property/vehicles/:vehicle"');
    expect(app).not.toContain('.delete("/api/v1/properties/:property/vehicles/:vehicle"');
  });
});
