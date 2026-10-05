import { describe, expect, test } from "bun:test";

import { AvailabilityService } from "../src/contexts/inventory";
import { LocalLoginService } from "../src/contexts/identity";
import { OperatorHttpApi } from "../src/http/operator";
import type { TenantRequestContext, Tx } from "../src/kernel";

const TENANT = "00000000-0000-0000-0000-000000020001";
const PROPERTY = "00000000-0000-0000-0000-000000020002";
const RESERVATION = "00000000-0000-0000-0000-000000020003";
const ACTOR = "00000000-0000-0000-0000-000000020004";

const calls: Array<{ readonly method: string; readonly input: unknown }> = [];
const checkIn = {
  async getReadiness(input: unknown) {
    calls.push({ method: "readiness", input });
    return { reservationId: RESERVATION, status: "due_in", segmentId: null, assignedSpaceId: null,
      primaryFolioId: null, roomCondition: "dirty" as const,
      identityGate: { required: false, satisfied: true, adapterKey: null },
      blockers: ["room_not_ready" as const], canCheckIn: false,
      dirtyRoomOverrideRequired: true, dirtyRoomOverrideAuthorized: false };
  },
  async checkIn(input: unknown) {
    calls.push({ method: "checkIn", input });
    return { reservationId: RESERVATION, reservationStatus: "in_house" as const,
      segmentId: "00000000-0000-0000-0000-000000020005", segmentStatus: "in_house" as const,
      assignedSpaceId: "00000000-0000-0000-0000-000000020006",
      primaryFolioId: "00000000-0000-0000-0000-000000020007", roomCondition: "dirty" as const,
      dirtyRoomOverrideUsed: true, identityGate: { required: false, satisfied: true, adapterKey: null }, replayed: false };
  },
};

const api = new OperatorHttpApi(
  {} as LocalLoginService, {} as AvailabilityService,
  undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
  undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
  undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
  undefined, undefined, undefined, undefined, checkIn,
);

function context(path: string, scopes: readonly string[], granted = true, body?: unknown): TenantRequestContext {
  const tx = (() => Promise.resolve(granted ? [{ id: PROPERTY, name: "Hotel", timezone: "UTC", currency: "USD" }] : [])) as unknown as Tx;
  return {
    tenantId: TENANT,
    request: new Request(`http://yellow.test${path}`, body === undefined ? undefined : {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": "checkin-attempt-0001" },
      body: JSON.stringify(body),
    }),
    tx,
    identity: { tenantId: TENANT, actorId: ACTOR, scopes },
  };
}

describe("Order 200 operator governed check-in surface", () => {
  test("readiness is no-store, property-granted and binds only server scope", async () => {
    calls.length = 0;
    const response = await api.checkInReadiness(
      context("/x", ["stay-operations.checkin:read"]), PROPERTY, RESERVATION,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(calls).toEqual([{ method: "readiness", input: {
      tenantId: TENANT, propertyNode: PROPERTY, reservationId: RESERVATION, dirtyRoomOverrideAuthorized: false,
    } }]);
    expect((await api.checkInReadiness(context("/x", [], true), PROPERTY, RESERVATION)).status).toBe(403);
    expect((await api.checkInReadiness(context("/x", ["stay-operations.checkin:read"], false), PROPERTY, RESERVATION)).status).toBe(404);
  });

  test("commit derives dirty-room authority and rejects browser authority fields", async () => {
    calls.length = 0;
    const scopes = ["stay-operations.checkin:commit", "stay-operations.checkin:dirty-room-override"];
    const response = await api.commitCheckIn(context("/x", scopes, true, { reason: "Urgent inspected arrival" }), PROPERTY, RESERVATION, { reason: "Urgent inspected arrival" });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ method: "checkIn", input: {
      tenantId: TENANT,
      propertyNode: PROPERTY,
      reservationId: RESERVATION,
      idempotencyKey: "checkin-attempt-0001",
      dirtyRoomOverrideAuthorized: true,
      dirtyRoomOverrideReason: "Urgent inspected arrival",
      envelope: { actorId: ACTOR, tenantId: TENANT, propertyNode: PROPERTY, operation: "reservation.checked_in" },
    } });

    for (const body of [
      { reason: "Urgent inspected arrival", canOverrideDirtyRoom: true },
      { reason: "Urgent inspected arrival", ready: true },
      { reason: " padded " },
      { reason: "" },
    ]) {
      expect((await api.commitCheckIn(context("/x", scopes, true, body), PROPERTY, RESERVATION, body)).status).toBe(400);
    }
    expect(calls).toHaveLength(1);
  });

  test("commit concealment, grants and retry key fail closed before service", async () => {
    calls.length = 0;
    const body = {};
    expect((await api.commitCheckIn(context("/x", [], true, body), PROPERTY, RESERVATION, body)).status).toBe(403);
    expect((await api.commitCheckIn(context("/x", ["stay-operations.checkin:commit"], false, body), PROPERTY, RESERVATION, body)).status).toBe(404);
    const missingKey = context("/x", ["stay-operations.checkin:commit"], true);
    expect((await api.commitCheckIn(missingKey, PROPERTY, RESERVATION, body)).status).toBe(400);
    expect(calls).toEqual([]);
  });
});
