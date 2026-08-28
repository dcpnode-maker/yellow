import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { AvailabilityService } from "../src/contexts/inventory";
import { LocalLoginService } from "../src/contexts/identity";
import {
  ReservationTravelConflictError,
  ReservationTravelNotFoundError,
  ReservationTravelValidationError,
} from "../src/contexts/reservations";
import { OperatorHttpApi } from "../src/http/operator";
import type { TenantRequestContext, Tx } from "../src/kernel";

const TENANT = "00000000-0000-0000-0000-000000021201";
const PROPERTY = "00000000-0000-0000-0000-000000021202";
const RESERVATION = "00000000-0000-0000-0000-000000021203";
const ACTOR = "00000000-0000-0000-0000-000000021204";
const TRAVEL_ID = "00000000-0000-0000-0000-000000021205";
const calls: Array<Record<string, unknown>> = [];
const replayed = new Set<string>();

const travel = {
  async put(_tx: Tx, input: Record<string, any>) {
    calls.push(input);
    const wasReplayed = replayed.has(input.idempotencyKey);
    replayed.add(input.idempotencyKey);
    return {
      reservationId: input.reservationId,
      status: "reserved" as const,
      direction: input.direction,
      travelId: TRAVEL_ID,
      travel: input.travel,
      changed: true,
      replayed: wasReplayed,
    };
  },
};

function operator(): OperatorHttpApi {
  const args = [
    {} as LocalLoginService,
    {} as AvailabilityService,
    ...Array.from({ length: 34 }, () => undefined),
    travel,
  ] as unknown as ConstructorParameters<typeof OperatorHttpApi>;
  return new OperatorHttpApi(...args);
}

function context(
  path: string,
  scopes: readonly string[],
  granted = true,
  key = "order212-travel-capture",
): TenantRequestContext {
  const tx = (() => Promise.resolve(
    granted ? [{ id: PROPERTY, name: "Hotel", timezone: "UTC", currency: "USD" }] : [],
  )) as unknown as Tx;
  return {
    tenantId: TENANT,
    request: new Request(`http://yellow.test${path}`, {
      method: "PUT",
      headers: { "content-type": "application/json", ...(key ? { "idempotency-key": key } : {}) },
      body: "{}",
    }),
    tx,
    identity: { tenantId: TENANT, actorId: ACTOR, scopes },
  };
}

const arrival = Object.freeze({
  mode: "flight",
  carrier: " Air India ",
  serviceNo: " AI 187 ",
  scheduledAt: "2049-01-02T03:04:05.123456Z",
  pickupRequested: true,
});

describe("Order 212 exact operator reservation travel adapter", () => {
  test("P0/P4: createApp binds one exact PUT route to the governed handler", () => {
    const source = readFileSync(new URL("../src/app.ts", import.meta.url), "utf8");
    const server = readFileSync(new URL("../src/server.ts", import.meta.url), "utf8");
    const route = '.put("/api/v1/properties/:property/reservations/:reservation/travel/:direction"';
    expect(source.match(new RegExp(route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"))).toHaveLength(1);
    expect(source).not.toContain('.post("/api/v1/properties/:property/reservations/:reservation/travel/:direction"');
    expect(source).toContain("operator.putReservationTravel(");
    expect(source).toContain("context, params.property, params.reservation, params.direction, body");
    expect(server).toContain("new ReservationTravelService({ events, idempotency: new PostgresIdempotency() })");
    expect(server).toContain("vehicleRegister, reservationTravel)");
  });

  test("P4: exact authority, normalized transport and minimized no-store response are server-bound", async () => {
    calls.length = 0;
    replayed.clear();
    const api = operator();
    const body = { expected: null, travel: arrival };
    const response = await api.putReservationTravel(
      context("/travel/arrival", ["reservations.lifecycle:write"]),
      PROPERTY,
      RESERVATION,
      "arrival",
      body,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("idempotency-replayed")).toBe("false");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      reservationId: RESERVATION,
      direction: "arrival",
      expected: null,
      travel: {
        mode: "flight",
        carrier: "Air India",
        serviceNo: "AI 187",
        scheduledAt: "2049-01-02T03:04:05.123456Z",
        pickupRequested: true,
      },
      idempotencyKey: "order212-travel-capture",
      envelope: {
        tenantId: TENANT,
        actorId: ACTOR,
        propertyNode: PROPERTY,
        operation: "reservation.modified",
      },
    });
    const payload = await response.json() as Record<string, any>;
    expect(payload).toEqual({ travel: {
      reservationId: RESERVATION,
      status: "reserved",
      direction: "arrival",
      travel: { mode: "flight", carrier: "Air India", serviceNo: "AI 187",
        scheduledAt: "2049-01-02T03:04:05.123456Z", pickupRequested: true },
      changed: true,
    } });
    expect(JSON.stringify(payload)).not.toContain(TRAVEL_ID);
  });

  test("P4: replay header is exact and stable while the service owns idempotency", async () => {
    calls.length = 0;
    replayed.clear();
    const api = operator();
    const requestContext = () => context(
      "/travel/arrival", ["reservations.lifecycle:write"], true, "order212-exact-replay",
    );
    const body = { expected: null, travel: arrival };
    const first = await api.putReservationTravel(requestContext(), PROPERTY, RESERVATION, "arrival", body);
    const replay = await api.putReservationTravel(requestContext(), PROPERTY, RESERVATION, "arrival", body);
    expect(first.headers.get("idempotency-replayed")).toBe("false");
    expect(replay.headers.get("idempotency-replayed")).toBe("true");
    expect(await replay.json()).toEqual(await first.json());
  });

  test("P4: strict body, direction, key, query, scope and property concealment fail before service", async () => {
    calls.length = 0;
    replayed.clear();
    const api = operator();
    const valid = { expected: null, travel: arrival };
    const invalid: ReadonlyArray<readonly [string, unknown]> = [
      ["sideways", valid],
      ["arrival", { ...valid, authority: true }],
      ["arrival", { expected: null, travel: { ...arrival, mode: "plane" } }],
      ["arrival", { expected: null, travel: { ...arrival, scheduledAt: "2049-01-02T03:04:05Z" } }],
      ["arrival", { expected: null, travel: { ...arrival, scheduledAt: "not-an-instant" } }],
      ["arrival", { expected: null, travel: { mode: null, carrier: null, serviceNo: null,
        scheduledAt: null, pickupRequested: false } }],
      ["departure", { expected: null, travel: arrival }],
      ["departure", { expected: { ...arrival, pickupRequested: true },
        travel: { ...arrival, pickupRequested: false } }],
    ];
    for (const [direction, body] of invalid) {
      expect((await api.putReservationTravel(
        context("/travel", ["reservations.lifecycle:write"]), PROPERTY, RESERVATION, direction, body,
      )).status).toBe(400);
    }
    expect((await api.putReservationTravel(
      context("/travel", ["reservations.lifecycle:write"], true, ""), PROPERTY, RESERVATION, "arrival", valid,
    )).status).toBe(400);
    expect((await api.putReservationTravel(
      context("/travel?authority=true", ["reservations.lifecycle:write"]), PROPERTY, RESERVATION, "arrival", valid,
    )).status).toBe(400);
    expect((await api.putReservationTravel(
      context("/travel", []), PROPERTY, RESERVATION, "arrival", valid,
    )).status).toBe(403);
    const concealed = await api.putReservationTravel(
      context("/travel", ["reservations.lifecycle:write"], false), PROPERTY, RESERVATION, "arrival", valid,
    );
    expect(concealed.status).toBe(404);
    expect(await concealed.json()).toMatchObject({ type: "reservations/not_found", title: "Not found" });
    expect(calls).toEqual([]);
  });

  test("P4: domain validation, concealment and CAS conflicts map to bounded HTTP errors", async () => {
    const api = operator();
    const request = new Request("http://yellow.test/travel");
    const validation = api.failure(request, new ReservationTravelValidationError("hostile detail"));
    const absent = api.failure(request, new ReservationTravelNotFoundError("hostile detail"));
    const conflict = api.failure(request, new ReservationTravelConflictError("hostile detail"));
    expect(validation.status).toBe(400);
    expect(absent.status).toBe(404);
    expect(conflict.status).toBe(409);
    expect(await absent.json()).toEqual(expect.objectContaining({
      type: "reservations/not_found",
      title: "Not found",
    }));
    expect(JSON.stringify(await conflict.json())).not.toContain("hostile detail");
  });
});
