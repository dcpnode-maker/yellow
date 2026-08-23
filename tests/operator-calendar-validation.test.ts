import { describe, expect, test } from "bun:test";

import { OperatorHttpApi } from "../src/http/operator";
import type { TenantRequestContext } from "../src/kernel";

const TENANT = "00000000-0000-0000-0000-000000008901";
const PROPERTY = "00000000-0000-0000-0000-000000008902";
const ACTOR = "00000000-0000-0000-0000-000000008903";
const RESOURCE = "00000000-0000-0000-0000-000000008904";
const VALID_FROM = "2048-03-01T10:00:00Z";
const VALID_TO = "2048-03-03T10:00:00Z";

const scopes = Object.freeze([
  "inventory.availability:read",
  "inventory.configuration:write",
  "inventory.blocks:write",
  "inventory.holds:write",
  "inventory.offline_leases:write",
  "rates.configuration:read",
  "reservations.booking:write",
]);

function context(): TenantRequestContext {
  const tx = (() => {
    throw new Error("calendar validation must finish before transaction work");
  }) as unknown as TenantRequestContext["tx"];
  return {
    request: new Request("http://yellow.test/calendar-proof", {
      headers: { "idempotency-key": "order089-calendar-proof" },
    }),
    tenantId: TENANT,
    identity: Object.freeze({ actorId: ACTOR, scopes }),
    tx,
  } as TenantRequestContext;
}

function api(): OperatorHttpApi {
  return new OperatorHttpApi({} as never);
}

function directCommitBody(from: string, to = VALID_TO): Record<string, unknown> {
  return {
    propertyNode: PROPERTY,
    direct: { sellableUnitId: RESOURCE, from, to },
    primaryPartyId: RESOURCE,
    ratePlanId: RESOURCE,
    adults: 1,
    childAges: [],
    channelCode: "direct",
  };
}

function rateQuoteBody(from: string, to = VALID_TO): Record<string, unknown> {
  return {
    sellableUnitId: RESOURCE,
    stayStart: from,
    stayEnd: to,
    guests: { adults: 1, childAges: [] },
    selectedPromotionCodes: [],
    commercial: { channelCode: "direct" },
    channelCode: "direct",
  };
}

describe("Order 089 strict operator calendar validation", () => {
  test("P0/P1: impossible instants fail at every shared HTTP consumer", async () => {
    const invalid = "2048-02-30T10:00:00Z";
    const target = api();
    const ctx = context();
    const responses = await Promise.all([
      target.search(ctx, PROPERTY, { from: invalid, to: VALID_TO }),
      target.search(ctx, PROPERTY, {
        stay: { from: invalid, to: VALID_TO },
        party: { adults: 1, children: [] },
        channel: "direct",
      }),
      target.commitReservation(ctx, directCommitBody(invalid)),
      target.placeHold(ctx, PROPERTY, {
        sellableUnitId: RESOURCE,
        from: invalid,
        to: VALID_TO,
        holderReference: "order089",
      }),
      target.placeOfflineLease(ctx, PROPERTY, {
        sellableUnitId: RESOURCE,
        from: invalid,
        to: VALID_TO,
        deviceId: "order089-device",
        leaseHours: 1,
      }),
      target.openOperationalBlock(ctx, PROPERTY, {
        spaceId: RESOURCE,
        kind: "ooo",
        from: invalid,
        to: VALID_TO,
        reason: "order089",
      }),
      target.resolveRateBuilderQuote(ctx, PROPERTY, RESOURCE, rateQuoteBody(invalid)),
    ]);
    expect(responses.map(({ status }) => status)).toEqual([400, 400, 400, 400, 400, 400, 400]);
  });

  test("P1: rollover clocks, leap seconds and invalid offsets fail closed", async () => {
    const target = api();
    const invalid = [
      "2048-04-31T10:00:00Z",
      "2048-01-01T24:00:00Z",
      "2048-01-01T10:00:60Z",
      "2048-01-01T10:00:00+01:60",
      "2048-01-01T10:00:00+14:01",
      "2048-01-01T10:00:00-14:01",
    ];
    for (const from of invalid) {
      expect((await target.commitReservation(context(), directCommitBody(from))).status).toBe(400);
    }
  });

  test("P2: supported leap, offset and precision boundaries still parse", async () => {
    const target = api();
    const valid = [
      "2048-02-29T10:00Z",
      "2048-02-29T10:00:00.1Z",
      "2048-02-29T10:00:00.12Z",
      "2048-02-29T10:00:00.123Z",
      "2048-02-29T10:00:00+14:00",
      "2048-02-29T10:00:00-14:00",
    ];
    for (const from of valid) {
      expect((await target.commitReservation(context(), directCommitBody(from))).status).toBe(503);
    }
  });

  test("P3: projection horizons use real local calendar dates", async () => {
    const target = api();
    expect((await target.rebuildAvailabilityProjection(context(), PROPERTY, {
      fromDate: "2047-02-29",
      toDate: "2047-03-02",
    })).status).toBe(400);
    expect((await target.rebuildAvailabilityProjection(context(), PROPERTY, {
      fromDate: "2048-04-31",
      toDate: "2048-05-02",
    })).status).toBe(400);
    expect((await target.rebuildAvailabilityProjection(context(), PROPERTY, {
      fromDate: "2048-02-29",
      toDate: "2048-03-02",
    })).status).toBe(503);
  });
});
