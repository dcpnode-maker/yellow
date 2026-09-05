import { beforeEach, describe, expect, test } from "bun:test";

import { AvailabilityService } from "../src/contexts/inventory";
import { LocalLoginService } from "../src/contexts/identity";
import { OperatorHttpApi } from "../src/http/operator";
import type { TenantRequestContext, Tx } from "../src/kernel";

const TENANT = "00000000-0000-0000-0000-000000023101";
const PROPERTY = "00000000-0000-0000-0000-000000023102";
const RESERVATION = "00000000-0000-0000-0000-000000023103";
const SEGMENT = "00000000-0000-0000-0000-000000023104";
const UNIT_TYPE = "00000000-0000-0000-0000-000000023105";
const SELLABLE = "00000000-0000-0000-0000-000000023106";
const SPACE = "00000000-0000-0000-0000-000000023107";
const ACTOR = "00000000-0000-0000-0000-000000023108";
const PERIOD = Object.freeze({ from: "2026-09-20T15:00:00.000Z", to: "2026-09-22T11:00:00.000Z" });
const KEY = "order231-room-assignment-key";

const calls: Array<{ readonly operation: string; readonly input: Record<string, unknown> }> = [];
let replayed = false;
const segments = {
  async findDueInRoomAssignmentCandidates(_tx: Tx, input: Record<string, unknown>) {
    calls.push({ operation: "candidates", input });
    return Object.freeze({
      reservationId: RESERVATION,
      segmentId: SEGMENT,
      expectedReservationStatus: "due_in" as const,
      expectedSegmentStatus: "booked" as const,
      expectedUnitTypeId: UNIT_TYPE,
      expectedSellableUnitId: null,
      expectedPeriod: PERIOD,
      candidates: Object.freeze([Object.freeze({
        sellableUnitId: SELLABLE,
        sellableUnitName: "Room 104",
        spaceId: SPACE,
        spaceCode: "104",
        floor: "1",
        roomCondition: "clean" as const,
      })]),
    });
  },
  async assignDueInRoom(_tx: Tx, input: Record<string, unknown>) {
    calls.push({ operation: "assign", input });
    return Object.freeze({
      reservationId: RESERVATION,
      segmentId: SEGMENT,
      unitTypeId: UNIT_TYPE,
      previousSellableUnitId: null,
      sellableUnitId: SELLABLE,
      spaceId: SPACE,
      period: PERIOD,
      claimCount: 1 as const,
      replayed,
    });
  },
};

function operator(): OperatorHttpApi {
  const args = [
    {} as LocalLoginService,
    {} as AvailabilityService,
    ...Array.from({ length: 15 }, () => undefined),
    segments,
  ] as unknown as ConstructorParameters<typeof OperatorHttpApi>;
  return new OperatorHttpApi(...args);
}

function context(
  method: "GET" | "POST",
  suffix: string,
  scopes: readonly string[],
  granted = true,
  body?: unknown,
  key: string | null = null,
): TenantRequestContext {
  const tx = (() => Promise.resolve(granted
    ? [{ id: PROPERTY, name: "Hotel", timezone: "UTC", currency: "USD" }]
    : [])) as unknown as Tx;
  const headers = new Headers({ "content-type": "application/json" });
  if (key !== null) headers.set("idempotency-key", key);
  return {
    tenantId: TENANT,
    request: new Request(
      `http://yellow.test/api/v1/properties/${PROPERTY}/reservations/${RESERVATION}/due-in-room-assignment${suffix}`,
      { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) },
    ),
    tx,
    identity: { tenantId: TENANT, actorId: ACTOR, scopes },
  };
}

async function captured(run: () => Promise<Response>, api: OperatorHttpApi, request: Request): Promise<Response> {
  try {
    return await run();
  } catch (error) {
    return api.failure(request, error);
  }
}

const body = Object.freeze({
  segmentId: SEGMENT,
  expectedReservationStatus: "due_in",
  expectedSegmentStatus: "booked",
  expectedUnitTypeId: UNIT_TYPE,
  expectedSellableUnitId: null,
  expectedPeriod: PERIOD,
  sellableUnitId: SELLABLE,
});

beforeEach(() => {
  calls.length = 0;
  replayed = false;
});

describe("Order 231 exact operator due-in room assignment adapter", () => {
  test("candidate read exposes only minimized rooms and derives tenant/property/reservation", async () => {
    const api = operator();
    const request = context("GET", "/candidates", ["reservations.segments:read"]);
    const response = await captured(
      () => api.dueInRoomAssignmentCandidates(request, PROPERTY, RESERVATION), api, request.request,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ candidates: [{
      sellableUnitId: SELLABLE,
      sellableUnitName: "Room 104",
      spaceId: SPACE,
      spaceCode: "104",
      floor: "1",
      roomCondition: "clean",
    }] });
    expect(calls).toEqual([{ operation: "candidates", input: {
      tenantId: TENANT, propertyNode: PROPERTY, reservationId: RESERVATION,
    } }]);
  });

  test("assignment binds exact CAS body, actor envelope, replay header and minimized result", async () => {
    replayed = true;
    const api = operator();
    const request = context("POST", "", ["reservations.segments:write"], true, body, KEY);
    const response = await captured(
      () => api.assignDueInRoom(request, PROPERTY, RESERVATION, body), api, request.request,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("idempotency-replayed")).toBe("true");
    expect(response.headers.get("x-correlation-id")).toBeTruthy();
    expect(await response.json()).toEqual({ assignment: {
      reservationId: RESERVATION,
      segmentId: SEGMENT,
      unitTypeId: UNIT_TYPE,
      previousSellableUnitId: null,
      sellableUnitId: SELLABLE,
      spaceId: SPACE,
      period: PERIOD,
      claimCount: 1,
    } });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ operation: "assign", input: {
      reservationId: RESERVATION,
      ...body,
      idempotencyKey: KEY,
      envelope: {
        tenantId: TENANT,
        actorId: ACTOR,
        propertyNode: PROPERTY,
        operation: "reservation.modified",
      },
    } });
  });

  test("strict shape, status literals, query, scope, property and key fail before domain", async () => {
    const api = operator();
    const invalidBodies = [
      { ...body, ready: true },
      { ...body, expectedReservationStatus: "reserved" },
      { ...body, expectedSegmentStatus: "in_house" },
      { ...body, expectedSellableUnitId: SELLABLE },
    ];
    for (const invalid of invalidBodies) {
      const request = context("POST", "", ["reservations.segments:write"], true, invalid, KEY);
      expect((await api.assignDueInRoom(request, PROPERTY, RESERVATION, invalid)).status).toBe(400);
    }
    const query = context("POST", "?extra=1", ["reservations.segments:write"], true, body, KEY);
    expect((await api.assignDueInRoom(query, PROPERTY, RESERVATION, body)).status).toBe(400);
    const noKey = context("POST", "", ["reservations.segments:write"], true, body);
    expect((await api.assignDueInRoom(noKey, PROPERTY, RESERVATION, body)).status).toBe(400);
    const noScope = context("POST", "", [], true, body, KEY);
    expect((await api.assignDueInRoom(noScope, PROPERTY, RESERVATION, body)).status).toBe(403);
    const foreign = context("POST", "", ["reservations.segments:write"], false, body, KEY);
    expect((await api.assignDueInRoom(foreign, PROPERTY, RESERVATION, body)).status).toBe(404);
    const candidateQuery = context("GET", "/candidates?extra=1", ["reservations.segments:read"]);
    expect((await api.dueInRoomAssignmentCandidates(candidateQuery, PROPERTY, RESERVATION)).status).toBe(400);
    expect(calls).toEqual([]);
  });
});
