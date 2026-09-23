import { describe, expect, test } from "bun:test";

import { createApp } from "../src/app";
import type { OperatorHttpApi } from "../src/http/operator";
import type { Database, TenantIdentity, TenantResolver, Tx } from "../src/kernel";

const TENANT = "00000000-0000-0000-0000-000000593001";
const ACTOR = "00000000-0000-0000-0000-000000593002";
const PROPERTY = "00000000-0000-0000-0000-000000593003";
const RESERVATION = "00000000-0000-0000-0000-000000593004";
const REQUEST = "00000000-0000-0000-0000-000000593005";

interface Call {
  readonly kind: "list" | "command";
  readonly propertyNode: string;
  readonly reservationId: string | null;
  readonly requestId?: string | null;
  readonly action?: string;
  readonly body?: unknown;
  readonly identity: TenantIdentity;
}

function mountedHarness(identity: TenantIdentity | null = {
  tenantId: TENANT,
  actorId: ACTOR,
  scopes: ["stay-operations.departure-services:read"],
}) {
  const calls: Call[] = [];
  const tx = (() => Promise.resolve([])) as unknown as Tx;
  const database = {
    async withTenantTransaction<T>(_tenantId: string, operation: (transaction: Tx) => Promise<T>): Promise<T> {
      return operation(tx);
    },
  } as unknown as Database;
  const tenantResolver: TenantResolver = {
    async resolve(): Promise<TenantIdentity | null> { return identity; },
  };
  const operator = {
    unauthorized: () => Response.json({ type: "auth/unauthorized" }, { status: 401 }),
    failure: (_request: Request, error: unknown) => Response.json({
      type: "departure-services/failure",
      detail: error instanceof Error ? error.message : "unknown",
    }, { status: 409 }),
    async departureServices(context: { identity: TenantIdentity }, propertyNode: string, reservationId: string | null) {
      calls.push({ kind: "list", propertyNode, reservationId, identity: context.identity });
      return Response.json({ requests: [], roles: [], staff: [] }, {
        headers: { "cache-control": "no-store" },
      });
    },
    async commandDepartureService(
      context: { identity: TenantIdentity },
      propertyNode: string,
      reservationId: string | null,
      requestId: string | null,
      action: string,
      body: unknown,
    ) {
      if ((body as { fail?: boolean } | null)?.fail === true) throw new Error("mapped route failure");
      calls.push({ kind: "command", propertyNode, reservationId, requestId, action, body, identity: context.identity });
      return Response.json({ accepted: true }, {
        status: action === "propose" ? 201 : 200,
        headers: {
          "cache-control": "no-store",
          "idempotency-replayed": "false",
        },
      });
    },
  } as unknown as OperatorHttpApi;
  return { calls, app: createApp({ database, tenantResolver, operatorApi: operator }) };
}

function request(path: string, method: "GET" | "POST" = "GET", body?: unknown): Request {
  return new Request(`http://yellow.test${path}`, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("Order 593 mounted departure-service HTTP routes", () => {
  test("mounts the reservation and staff queue reads with exact path identity", async () => {
    const { app, calls } = mountedHarness();
    const reservationResponse = await app.handle(request(
      `/api/v1/properties/${PROPERTY}/reservations/${RESERVATION}/departure-services`,
    ));
    const queueResponse = await app.handle(request(`/api/v1/properties/${PROPERTY}/departure-services`));

    expect(reservationResponse.status).toBe(200);
    expect(queueResponse.status).toBe(200);
    expect(reservationResponse.headers.get("cache-control")).toBe("no-store");
    expect(await queueResponse.json()).toEqual({ requests: [], roles: [], staff: [] });
    expect(calls).toEqual([
      { kind: "list", propertyNode: PROPERTY, reservationId: RESERVATION,
        identity: { tenantId: TENANT, actorId: ACTOR, scopes: ["stay-operations.departure-services:read"] } },
      { kind: "list", propertyNode: PROPERTY, reservationId: null,
        identity: { tenantId: TENANT, actorId: ACTOR, scopes: ["stay-operations.departure-services:read"] } },
    ]);
  });

  test("mounts proposal plus reservation and queue actions without changing path meaning", async () => {
    const { app, calls } = mountedHarness();
    const proposal = { serviceKind: "luggage_pickup", expectedVersion: 1 };
    const action = { expectedVersion: 2, staffPartyId: ACTOR, outcome: null };

    const proposed = await app.handle(request(
      `/api/v1/properties/${PROPERTY}/reservations/${RESERVATION}/departure-services/proposals`,
      "POST", proposal,
    ));
    const confirmed = await app.handle(request(
      `/api/v1/properties/${PROPERTY}/reservations/${RESERVATION}/departure-services/${REQUEST}/confirm`,
      "POST", action,
    ));
    const assigned = await app.handle(request(
      `/api/v1/properties/${PROPERTY}/departure-services/${REQUEST}/assign`,
      "POST", action,
    ));

    expect([proposed.status, confirmed.status, assigned.status]).toEqual([201, 200, 200]);
    expect(proposed.headers.get("idempotency-replayed")).toBe("false");
    expect(calls.map(({ identity: _identity, ...call }) => call)).toEqual([
      { kind: "command", propertyNode: PROPERTY, reservationId: RESERVATION,
        requestId: null, action: "propose", body: proposal },
      { kind: "command", propertyNode: PROPERTY, reservationId: RESERVATION,
        requestId: REQUEST, action: "confirm", body: action },
      { kind: "command", propertyNode: PROPERTY, reservationId: null,
        requestId: REQUEST, action: "assign", body: action },
    ]);
  });

  test("fails closed before a route handler without identity and maps handler failures", async () => {
    const anonymous = mountedHarness(null);
    const unauthorized = await anonymous.app.handle(request(`/api/v1/properties/${PROPERTY}/departure-services`));
    expect(unauthorized.status).toBe(401);
    expect(anonymous.calls).toEqual([]);

    const authenticated = mountedHarness();
    const failed = await authenticated.app.handle(request(
      `/api/v1/properties/${PROPERTY}/reservations/${RESERVATION}/departure-services/proposals`,
      "POST", { fail: true },
    ));
    expect(failed.status).toBe(409);
    expect(await failed.json()).toEqual({ type: "departure-services/failure", detail: "mapped route failure" });
    expect(authenticated.calls).toEqual([]);
  });

  test("rejects malformed JSON before the departure command handler", async () => {
    const { app, calls } = mountedHarness();
    const response = await app.handle(new Request(
      `http://yellow.test/api/v1/properties/${PROPERTY}/reservations/${RESERVATION}/departure-services/proposals`,
      { method: "POST", headers: { "content-type": "application/json" }, body: "{" },
    ));
    expect(response.status).toBe(400);
    expect(calls).toEqual([]);
  });
});
