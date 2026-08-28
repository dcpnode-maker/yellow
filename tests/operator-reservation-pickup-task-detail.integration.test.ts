import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { createApp } from "../src/app";
import { AvailabilityService } from "../src/contexts/inventory";
import { LocalLoginService } from "../src/contexts/identity";
import {
  ReservationDetailConflictError,
  ReservationDetailNotFoundError,
  ReservationDetailValidationError,
} from "../src/contexts/reservations";
import { OperatorHttpApi } from "../src/http/operator";
import { Database, type TenantRequestContext, type Tx } from "../src/kernel";

const TENANT = "00000000-0000-0000-0000-000000021501";
const PROPERTY = "00000000-0000-0000-0000-000000021502";
const RESERVATION = "00000000-0000-0000-0000-000000021503";
const TASK = "00000000-0000-0000-0000-000000021504";
const ACTOR = "00000000-0000-0000-0000-000000021505";

const PICKUP_TASK = Object.freeze({
  taskId: TASK,
  reservationId: RESERVATION,
  confirmationNo: "YEL-215-ARRIVAL",
  status: "open" as const,
  dueAt: "2027-05-06T07:30:00.000000Z",
  priority: 3,
  createdAt: "2027-05-05T12:00:00.000000Z",
  completedAt: null,
});

type DetailFailure = "validation" | "not-found" | "conflict" | null;
const calls: unknown[] = [];
let failure: DetailFailure = null;

const detail = {
  async findById(): Promise<never> {
    throw new Error("Unexpected reservation detail read");
  },
  async pickupTaskDetail(tx: Tx, input: unknown) {
    calls.push({ tx, input });
    if (failure === "validation") throw new ReservationDetailValidationError("invalid");
    if (failure === "not-found") throw new ReservationDetailNotFoundError("concealed");
    if (failure === "conflict") throw new ReservationDetailConflictError("hostile task shape");
    return PICKUP_TASK;
  },
};

function operator(detailService: typeof detail | null = detail): OperatorHttpApi {
  return new OperatorHttpApi(
    {} as LocalLoginService,
    {} as AvailabilityService,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    detailService ?? undefined,
  );
}

function context(
  path: string,
  scopes: readonly string[] = ["reservations.lifecycle:read"],
  granted = true,
): TenantRequestContext {
  const tx = (async () => granted
    ? [{ id: PROPERTY, name: "Yellow", timezone: "UTC", currency: "USD" }]
    : []) as unknown as Tx;
  return {
    tenantId: TENANT,
    request: new Request(`http://yellow.test${path}`),
    tx,
    identity: { tenantId: TENANT, actorId: ACTOR, scopes },
  };
}

function routed(api: OperatorHttpApi) {
  const tx = (async () => [{
    id: PROPERTY,
    name: "Yellow",
    timezone: "UTC",
    currency: "USD",
  }]) as unknown as Tx;
  const database = {
    async withTenantTransaction<T>(_tenantId: string, handler: (commandTx: Tx) => Promise<T>): Promise<T> {
      return handler(tx);
    },
  } as unknown as Database;
  const app = createApp({
    database,
    tenantResolver: {
      async resolve() {
        return {
          tenantId: TENANT,
          actorId: ACTOR,
          scopes: ["reservations.lifecycle:read"],
        };
      },
    },
    operatorApi: api,
  });
  return { app, tx };
}

async function captured(
  api: OperatorHttpApi,
  request: TenantRequestContext,
  propertyNode = PROPERTY,
  reservationId = RESERVATION,
  taskId = TASK,
): Promise<Response> {
  try {
    return await api.reservationPickupTaskDetail(request, propertyNode, reservationId, taskId);
  } catch (error) {
    return api.failure(request.request, error);
  }
}

describe("Order 215 reservation-scoped arrival pickup-task HTTP detail", () => {
  test("exact route returns only minimized canonical task truth with no-store", async () => {
    calls.length = 0;
    failure = null;
    const api = operator();
    const { app, tx } = routed(api);
    const path = `/api/v1/properties/${PROPERTY}/reservations/${RESERVATION}/arrival-pickup-task/${TASK}`;
    const response = await app.handle(
      new Request(`http://yellow.test${path}`),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ pickupTask: PICKUP_TASK });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({
      tx,
      input: { tenantId: TENANT, propertyNode: PROPERTY, reservationId: RESERVATION, taskId: TASK },
    });

    const appSource = readFileSync(new URL("../src/app.ts", import.meta.url), "utf8");
    expect(appSource).toContain('"/api/v1/properties/:property/reservations/:reservation/arrival-pickup-task/:task"');
    expect(appSource).toContain("context, params.property, params.reservation, params.task");
  });

  test("UUID, empty-query, scope and exact property grant fail before the detail read", async () => {
    calls.length = 0;
    failure = null;
    const api = operator();
    const path = `/api/v1/properties/${PROPERTY}/reservations/${RESERVATION}/arrival-pickup-task/${TASK}`;

    for (const [request, propertyNode, reservationId, taskId, expected] of [
      [context(path), "bad", RESERVATION, TASK, 400],
      [context(path), PROPERTY, "bad", TASK, 400],
      [context(path), PROPERTY, RESERVATION, "bad", 400],
      [context(`${path}?task=${TASK}`), PROPERTY, RESERVATION, TASK, 400],
      [context(`${path}?task=${TASK}&task=${TASK}`), PROPERTY, RESERVATION, TASK, 400],
      [context(path, []), PROPERTY, RESERVATION, TASK, 403],
      [context(path, ["reservations.lifecycle:read"], false), PROPERTY, RESERVATION, TASK, 404],
    ] as const) {
      expect((await captured(api, request, propertyNode, reservationId, taskId)).status).toBe(expected);
    }
    expect(calls).toEqual([]);
  });

  test("domain validation, concealment and hostile linked shape map to exact bounded errors", async () => {
    const api = operator();
    const path = `/api/v1/properties/${PROPERTY}/reservations/${RESERVATION}/arrival-pickup-task/${TASK}`;
    for (const [nextFailure, status, type] of [
      ["validation", 400, "request/invalid"],
      ["not-found", 404, "reservations/not_found"],
      ["conflict", 409, "reservations/read_conflict"],
    ] as const) {
      failure = nextFailure;
      const response = await captured(api, context(path));
      expect(response.status).toBe(status);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(await response.json()).toMatchObject({ status, type });
    }
    failure = null;
  });

  test("missing detail composition is contained as service unavailable", async () => {
    const response = await captured(
      operator(null),
      context(`/api/v1/properties/${PROPERTY}/reservations/${RESERVATION}/arrival-pickup-task/${TASK}`),
    );
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ type: "service/unavailable", status: 503 });
  });
});
