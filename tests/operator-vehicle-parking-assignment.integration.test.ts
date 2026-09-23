import { beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import {
  VehicleParkingConflictError,
  type VehicleParkingAssignmentResult,
  type VehicleParkingSnapshot,
} from "../src/contexts/stay-operations";
import { AvailabilityService } from "../src/contexts/inventory";
import { LocalLoginService } from "../src/contexts/identity";
import { OperatorHttpApi } from "../src/http/operator";
import type { TenantRequestContext, Tx } from "../src/kernel";

const TENANT = "00000000-0000-0000-0000-000000236001";
const PROPERTY = "00000000-0000-0000-0000-000000236002";
const ACTOR = "00000000-0000-0000-0000-000000236003";
const VEHICLE = "00000000-0000-0000-0000-000000236004";
const PARKING = "00000000-0000-0000-0000-000000236005";
const OTHER_PARKING = "00000000-0000-0000-0000-000000236006";
const REQUEST_ID = "00000000-0000-0000-0000-000000236099";
const KEY = "order236-parking-attempt-0001";
const SCOPE = "stay-operations.vehicles:park";

const snapshot: VehicleParkingSnapshot = Object.freeze({
  vehicleId: VEHICLE,
  assignment: null,
  candidates: Object.freeze([
    Object.freeze({ parkingSpaceId: PARKING, code: "P-01", floor: "B1" }),
    Object.freeze({ parkingSpaceId: OTHER_PARKING, code: "P-02", floor: null }),
  ]),
});

let assigned: VehicleParkingAssignmentResult = Object.freeze({
  assignment: Object.freeze({
    vehicleId: VEHICLE,
    registration: "KA01AB2360",
    parkingSpaceId: PARKING,
    code: "P-01",
    floor: "B1",
    from: "2026-08-28T09:00:00.000Z",
    to: "2026-08-29T05:30:00.000Z",
  }),
  created: true,
  replayed: false,
});
const calls: Array<{ readonly operation: "read" | "assign"; readonly input: unknown }> = [];
let conflict = false;

const parking = {
  async read(input: unknown) {
    calls.push({ operation: "read", input });
    return snapshot;
  },
  async assign(input: unknown) {
    calls.push({ operation: "assign", input });
    if (conflict) throw new VehicleParkingConflictError("parking claim changed");
    return assigned;
  },
};

function operator(): OperatorHttpApi {
  const args = [
    {} as LocalLoginService,
    {} as AvailabilityService,
    ...Array.from({ length: 38 }, () => undefined),
    parking,
  ] as unknown as ConstructorParameters<typeof OperatorHttpApi>;
  return new OperatorHttpApi(...args);
}

function context(
  method: "GET" | "POST",
  suffix = "",
  scopes: readonly string[] = [SCOPE],
  granted = true,
  idempotencyKey: string | null = method === "POST" ? KEY : null,
): TenantRequestContext {
  const tx = (() => Promise.resolve(granted
    ? [{ id: PROPERTY, name: "Yellow", timezone: "Asia/Kolkata", currency: "INR" }]
    : [])) as unknown as Tx;
  const headers = new Headers({ "x-correlation-id": REQUEST_ID });
  if (idempotencyKey !== null) headers.set("idempotency-key", idempotencyKey);
  return {
    tenantId: TENANT,
    request: new Request(
      `http://yellow.test/api/v1/properties/${PROPERTY}/vehicles/${VEHICLE}/parking${suffix}`,
      { method, headers },
    ),
    tx,
    identity: { tenantId: TENANT, actorId: ACTOR, scopes },
  };
}

async function captured(
  api: OperatorHttpApi,
  request: TenantRequestContext,
  run: () => Promise<Response>,
): Promise<Response> {
  try {
    return await run();
  } catch (error) {
    return api.failure(request.request, error);
  }
}

beforeEach(() => {
  calls.length = 0;
  conflict = false;
  assigned = Object.freeze({ ...assigned, created: true, replayed: false });
});

describe("Order 236 exact vehicle parking HTTP adapter", () => {
  test("GET is no-store and exposes only the exact assignment snapshot", async () => {
    const api = operator();
    const request = context("GET");
    const response = await api.vehicleParking(request, PROPERTY, VEHICLE);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-correlation-id")).toBe(REQUEST_ID);
    expect(await response.json()).toEqual({ snapshot });
    expect(calls).toEqual([{ operation: "read", input: {
      tenantId: TENANT,
      propertyNode: PROPERTY,
      vehicleId: VEHICLE,
    } }]);
  });

  test("POST binds the selected slot and actor envelope and returns a creation receipt", async () => {
    const api = operator();
    const request = context("POST");
    const response = await api.vehicleParkingAssign(request, PROPERTY, VEHICLE, { parkingSpaceId: PARKING });

    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("idempotency-replayed")).toBe("false");
    expect(response.headers.get("x-correlation-id")).toBe(REQUEST_ID);
    expect(await response.json()).toEqual(assigned);
    expect(calls).toEqual([{ operation: "assign", input: {
      tenantId: TENANT,
      propertyNode: PROPERTY,
      vehicleId: VEHICLE,
      parkingSpaceId: PARKING,
      idempotencyKey: KEY,
      envelope: {
        actorId: ACTOR,
        tenantId: TENANT,
        propertyNode: PROPERTY,
        requestId: REQUEST_ID,
        operation: "occupancy.recorded",
      },
    } }]);
  });

  test("exact replay is a 200 receipt and mapped claim conflicts remain no-store", async () => {
    const api = operator();
    assigned = Object.freeze({ ...assigned, created: false, replayed: true });
    const replayRequest = context("POST");
    const replay = await api.vehicleParkingAssign(
      replayRequest,
      PROPERTY,
      VEHICLE,
      { parkingSpaceId: PARKING },
    );
    expect(replay.status).toBe(200);
    expect(replay.headers.get("idempotency-replayed")).toBe("true");

    calls.length = 0;
    conflict = true;
    const conflictRequest = context("POST");
    const response = await captured(api, conflictRequest, () => api.vehicleParkingAssign(
      conflictRequest,
      PROPERTY,
      VEHICLE,
      { parkingSpaceId: PARKING },
    ));
    expect(response.status).toBe(409);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ type: "vehicles/conflict", status: 409 });
  });

  test("query, identifiers, body, key, scope and property fail before parking operations", async () => {
    const api = operator();
    expect((await api.vehicleParking(context("GET", "?history=1"), PROPERTY, VEHICLE)).status).toBe(400);
    expect((await api.vehicleParking(context("GET"), "NOT-A-UUID", VEHICLE)).status).toBe(400);
    expect((await api.vehicleParking(context("GET"), PROPERTY, "NOT-A-UUID")).status).toBe(400);
    expect((await api.vehicleParking(context("GET", "", []), PROPERTY, VEHICLE)).status).toBe(403);
    expect((await api.vehicleParking(context("GET", "", [SCOPE], false), PROPERTY, VEHICLE)).status).toBe(404);

    for (const body of [
      {},
      { parkingSpaceId: "NOT-A-UUID" },
      { parkingSpaceId: PARKING, replace: true },
    ]) {
      expect((await api.vehicleParkingAssign(context("POST"), PROPERTY, VEHICLE, body)).status).toBe(400);
    }
    expect((await api.vehicleParkingAssign(
      context("POST", "?replace=1"), PROPERTY, VEHICLE, { parkingSpaceId: PARKING },
    )).status).toBe(400);
    expect((await api.vehicleParkingAssign(
      context("POST", "", [SCOPE], true, null), PROPERTY, VEHICLE, { parkingSpaceId: PARKING },
    )).status).toBe(400);
    expect((await api.vehicleParkingAssign(
      context("POST", "", [SCOPE], true, "short"), PROPERTY, VEHICLE, { parkingSpaceId: PARKING },
    )).status).toBe(400);
    expect((await api.vehicleParkingAssign(
      context("POST", "", []), PROPERTY, VEHICLE, { parkingSpaceId: PARKING },
    )).status).toBe(403);
    expect((await api.vehicleParkingAssign(
      context("POST", "", [SCOPE], false), PROPERTY, VEHICLE, { parkingSpaceId: PARKING },
    )).status).toBe(404);
    expect(calls).toEqual([]);
  });

  test("application exposes only exact GET and POST routes", () => {
    const app = readFileSync(new URL("../src/app.ts", import.meta.url), "utf8");
    const route = "/api/v1/properties/:property/vehicles/:vehicle/parking";
    expect(app).toContain(`.get("${route}"`);
    expect(app).toContain(`.post("${route}"`);
    for (const verb of ["put", "patch", "delete"]) expect(app).not.toContain(`.${verb}("${route}"`);
  });
});
