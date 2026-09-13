import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { LocalLoginService } from "../src/contexts/identity";
import { AvailabilityService } from "../src/contexts/inventory";
import { createApp } from "../src/app";
import { OperatorHttpApi } from "../src/http/operator";
import type { Database, TenantRequestContext, TenantResolver, Tx } from "../src/kernel";

const TENANT = "00000000-0000-0000-0000-000000046501";
const PROPERTY = "00000000-0000-0000-0000-000000046511";
const RESERVATION = "00000000-0000-0000-0000-000000046521";
const ALERT = "00000000-0000-0000-0000-000000046531";
const ACTOR = "00000000-0000-0000-0000-000000046541";
const calls: Array<Record<string, unknown>> = [];

const alerts = {
  async create(_tx: Tx, input: Record<string, any>) {
    calls.push({ type: "create", ...input });
    return {
      alert: { id: ALERT, code: input.code, message: input.message, showOn: input.showOn, active: true },
      changed: true, replayed: false,
    };
  },
  async deactivate(_tx: Tx, input: Record<string, any>) {
    calls.push({ type: "deactivate", ...input });
    return {
      alert: { id: input.alertId, code: "VIP", message: "Meet at reception", showOn: "checkin", active: false },
      changed: true, replayed: false,
    };
  },
};

const detail = {
  async findById() {
    return {
      reservationId: RESERVATION, confirmationNo: "O463-ALERT", status: "reserved",
      segments: [], guests: [], folios: [], alerts: [], travel: [], history: [],
    };
  },
};

function operator(): OperatorHttpApi {
  const args = [
    {} as LocalLoginService,
    {} as AvailabilityService,
    ...Array.from({ length: 20 }, () => undefined),
    detail,
    ...Array.from({ length: 24 }, () => undefined),
    alerts,
  ] as unknown as ConstructorParameters<typeof OperatorHttpApi>;
  return new OperatorHttpApi(...args);
}

function context(
  path: string,
  method: "POST",
  body: unknown,
  scopes: readonly string[] = ["reservations.lifecycle:write"],
  granted = true,
  key = "order463-http-alert",
): TenantRequestContext {
  const tx = (() => Promise.resolve(granted ? [{ id: PROPERTY }] : [])) as unknown as Tx;
  return {
    tenantId: TENANT,
    request: new Request(`http://yellow.test${path}`, {
      method,
      headers: { "content-type": "application/json", ...(key ? { "idempotency-key": key } : {}) },
      body: JSON.stringify(body),
    }),
    tx,
    identity: { tenantId: TENANT, actorId: ACTOR, scopes },
  };
}

describe("Order 463 operator reservation alert adapter", () => {
  test("P0: createApp dispatches exactly the governed slash alert routes", async () => {
    const source = readFileSync(new URL("../src/app.ts", import.meta.url), "utf8");
    expect(source).toContain('.post("/api/v1/properties/:property/reservations/:reservation/alerts"');
    expect(source).toContain('.post("/api/v1/properties/:property/reservations/:reservation/alerts/:alert/deactivate"');

    calls.length = 0;
    const routeTx = (() => Promise.resolve([{ id: PROPERTY }])) as unknown as Tx;
    const database = {
      async withTenantTransaction<T>(_tenantId: string, operation: (tx: Tx) => Promise<T>): Promise<T> {
        return operation(routeTx);
      },
    } as Database;
    const tenantResolver: TenantResolver = {
      async resolve() {
        return { tenantId: TENANT, actorId: ACTOR, scopes: ["reservations.lifecycle:write"] };
      },
    };
    const app = createApp({ database, tenantResolver, operatorApi: operator() });
    const create = await app.handle(new Request(
      `http://yellow.test/api/v1/properties/${PROPERTY}/reservations/${RESERVATION}/alerts`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": "order463-route-create" },
        body: JSON.stringify({ code: "VIP", message: "Meet at reception", showOn: "checkin" }),
      },
    ));
    expect(create.status).toBe(200);
    expect(calls.at(-1)).toMatchObject({ type: "create", reservationId: RESERVATION });

    const deactivate = await app.handle(new Request(
      `http://yellow.test/api/v1/properties/${PROPERTY}/reservations/${RESERVATION}/alerts/${ALERT}/deactivate`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": "order463-route-deactivate" },
        body: "{}",
      },
    ));
    expect(deactivate.status).toBe(200);
    expect(calls.at(-1)).toMatchObject({ type: "deactivate", reservationId: RESERVATION, alertId: ALERT });

    const colonAlias = await app.handle(new Request(
      `http://yellow.test/api/v1/properties/${PROPERTY}/reservations/${RESERVATION}/alerts/${ALERT}:deactivate`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": "order463-route-colon" },
        body: "{}",
      },
    ));
    expect(colonAlias.status).toBe(404);
    expect(calls).toHaveLength(2);
  });

  test("P1: derives actor/property/tenant and returns the exact canonical response", async () => {
    calls.length = 0;
    const api = operator();
    const create = await api.createReservationAlert(
      context(`/api/v1/properties/${PROPERTY}/reservations/${RESERVATION}/alerts`, "POST", {
        code: " VIP ", message: " Meet at reception ", showOn: "checkin",
      }), PROPERTY, RESERVATION, { code: " VIP ", message: " Meet at reception ", showOn: "checkin" },
    );
    expect(create.status).toBe(200);
    expect(await create.json()).toEqual({
      alert: { id: ALERT, code: " VIP ", message: " Meet at reception ", showOn: "checkin", active: true },
      changed: true, replayed: false,
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ type: "create", reservationId: RESERVATION, idempotencyKey: "order463-http-alert" });
    expect(calls[0]?.envelope).toMatchObject({ actorId: ACTOR, tenantId: TENANT, propertyNode: PROPERTY, operation: "reservation.modified" });

    const deactivate = await api.deactivateReservationAlert(
      context(`/api/v1/properties/${PROPERTY}/reservations/${RESERVATION}/alerts/${ALERT}/deactivate`, "POST", {}),
      PROPERTY, RESERVATION, ALERT, {},
    );
    expect(deactivate.status).toBe(200);
    expect(await deactivate.json()).toEqual({
      alert: { id: ALERT, code: "VIP", message: "Meet at reception", showOn: "checkin", active: false },
      changed: true, replayed: false,
    });
  });

  test("P2: strict body, idempotency, scope and property boundaries reject before invoking the service", async () => {
    calls.length = 0;
    const api = operator();
    const malformed = await api.createReservationAlert(
      context(`/api/v1/properties/${PROPERTY}/reservations/${RESERVATION}/alerts`, "POST", {
        code: null, message: "note", showOn: "always", authority: true,
      }), PROPERTY, RESERVATION, { code: null, message: "note", showOn: "always", authority: true },
    );
    expect(malformed.status).toBe(400);
    const absentKey = await api.deactivateReservationAlert(
      context(`/api/v1/properties/${PROPERTY}/reservations/${RESERVATION}/alerts/${ALERT}/deactivate`, "POST", {}, undefined, true, ""),
      PROPERTY, RESERVATION, ALERT, {},
    );
    expect(absentKey.status).toBe(400);
    const readOnly = await api.createReservationAlert(
      context(`/api/v1/properties/${PROPERTY}/reservations/${RESERVATION}/alerts`, "POST", { code: null, message: "note", showOn: "always" }, []),
      PROPERTY, RESERVATION, { code: null, message: "note", showOn: "always" },
    );
    expect(readOnly.status).toBe(403);
    const forbidden = await api.createReservationAlert(
      context(`/api/v1/properties/${PROPERTY}/reservations/${RESERVATION}/alerts`, "POST", { code: null, message: "note", showOn: "always" }, undefined, false),
      PROPERTY, RESERVATION, { code: null, message: "note", showOn: "always" },
    );
    expect(forbidden.status).toBe(404);
    expect(calls).toHaveLength(0);
  });

  test("P3: detail exposes alert capability only from a live service plus exact lifecycle-write grant", async () => {
    const api = operator();
    const writable = await api.reservationDetail(
      context(`/api/v1/properties/${PROPERTY}/reservations/${RESERVATION}`, "POST", {}, [
        "reservations.lifecycle:read", "reservations.lifecycle:write",
      ]), PROPERTY, RESERVATION,
    );
    expect((await writable.json() as { actions: unknown }).actions).toMatchObject({ canManageAlerts: true });
    const readOnly = await api.reservationDetail(
      context(`/api/v1/properties/${PROPERTY}/reservations/${RESERVATION}`, "POST", {}, ["reservations.lifecycle:read"]),
      PROPERTY, RESERVATION,
    );
    expect((await readOnly.json() as { actions: unknown }).actions).toMatchObject({ canManageAlerts: false });
  });
});
