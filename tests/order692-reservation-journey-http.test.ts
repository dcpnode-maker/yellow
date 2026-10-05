import { expect, test } from "bun:test";
import type { LocalLoginService } from "../src/contexts/identity";
import type { AvailabilityService } from "../src/contexts/inventory";
import { ReservationBoardConflictError, ReservationBoardValidationError, type ReservationBoardInput } from "../src/contexts/reservations";
import { OperatorHttpApi } from "../src/http/operator";
import type { TenantRequestContext, Tx } from "../src/kernel";

const TENANT = "00000000-0000-0000-0000-000000069201";
const PROPERTY = "00000000-0000-0000-0000-000000069202";
const ACTOR = "00000000-0000-0000-0000-000000069203";

function fixture(path: string, failure?: Error, granted = true, scopes = ["reservations.lifecycle:read"]) {
  const calls: ReservationBoardInput[] = [];
  const board = { async list(_tx: Tx, input: ReservationBoardInput) {
    calls.push(input);
    if (failure) throw failure;
    return { reservations: [], nextCursor: null, businessDate: "2026-09-25" };
  } };
  const api = new OperatorHttpApi(
    {} as LocalLoginService, {} as AvailabilityService, undefined, undefined, undefined, undefined,
    undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
    undefined, undefined, undefined, undefined, undefined, undefined, board,
  );
  const tx = (() => Promise.resolve(granted ? [{ id: PROPERTY, name: "P", timezone: "UTC", currency: "USD" }] : [])) as unknown as Tx;
  const context: TenantRequestContext = { tenantId: TENANT, tx, request: new Request(`http://yellow.test${path}`),
    identity: { tenantId: TENANT, actorId: ACTOR, scopes } };
  return { api, context, calls };
}

test("board HTTP accepts one stage and returns the persisted day, not a browser date", async () => {
  const fixtureData = fixture(`/api/v1/properties/${PROPERTY}/reservation-board?stage=arrival&limit=25`);
  const result = await fixtureData.api.reservationBoard(fixtureData.context, PROPERTY);
  expect(result.status).toBe(200);
  expect(await result.json()).toEqual({ reservations: [], nextCursor: null, businessDate: "2026-09-25" });
  expect(fixtureData.calls).toHaveLength(1);
  expect(fixtureData.calls[0]).toMatchObject({ tenantId: TENANT, propertyNode: PROPERTY, stage: "arrival", limit: 25 });
});

test("malformed/combined stage, absent grant and scope fail before board read", async () => {
  for (const path of ["?stage=unknown", "?stage=arrival&stage=departure", "?stage=arrival&status=due_in", "?stage=arrival&guestName=private"]) {
    const current = fixture(`/api/v1/properties/${PROPERTY}/reservation-board${path}`);
    expect((await current.api.reservationBoard(current.context, PROPERTY)).status).toBe(400);
    expect(current.calls).toHaveLength(0);
  }
  for (const [granted, scopes] of [[false, ["reservations.lifecycle:read"]], [true, []]] as const) {
    const current = fixture(`/api/v1/properties/${PROPERTY}/reservation-board?stage=arrival`, undefined, granted, [...scopes]);
    expect((await current.api.reservationBoard(current.context, PROPERTY)).status).toBe(403);
    expect(current.calls).toHaveLength(0);
  }
});

test("no open day/stale cursor is a conflict or invalid request, never a 500", async () => {
  const noDay = fixture(`/api/v1/properties/${PROPERTY}/reservation-board?stage=arrival`, new ReservationBoardConflictError("No open property business day"));
  const noDayResponse = await noDay.api.reservationBoard(noDay.context, PROPERTY);
  expect(noDayResponse.status).toBe(409);
  expect(JSON.stringify(await noDayResponse.json())).toContain("reservations/board_conflict");
  const stale = fixture(`/api/v1/properties/${PROPERTY}/reservation-board?stage=arrival`, new ReservationBoardValidationError("cursor belongs to another business date"));
  const staleResponse = await stale.api.reservationBoard(stale.context, PROPERTY);
  expect(staleResponse.status).toBe(400);
  expect(JSON.stringify(await staleResponse.json())).toContain("request/invalid");
});
