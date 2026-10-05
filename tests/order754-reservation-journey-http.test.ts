import { expect, test } from "bun:test";
import type { LocalLoginService } from "../src/contexts/identity";
import type { AvailabilityService } from "../src/contexts/inventory";
import { ReservationBoardConflictError, ReservationBoardValidationError, type ReservationBoardInput } from "../src/contexts/reservations";
import { OperatorHttpApi } from "../src/http/operator";
import type { TenantRequestContext, Tx } from "../src/kernel";
const TENANT = "00000000-0000-0000-0000-000000075401";
const PROPERTY = "00000000-0000-0000-0000-000000075402";
const ACTOR = "00000000-0000-0000-0000-000000075403";
function fixture(query: string, options: { failure?: Error; granted?: boolean; scopes?: string[] } = {}) {
  const calls: ReservationBoardInput[] = [];
  const board = { async list(_tx: Tx, input: ReservationBoardInput) {
    calls.push(input);
    if (options.failure) throw options.failure;
    return { reservations: [], nextCursor: null, ...(input.stage ? { businessDate: "2026-10-04" } : {}) };
  } };
  const api = new OperatorHttpApi(
    {} as LocalLoginService, {} as AvailabilityService, undefined, undefined, undefined, undefined,
    undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
    undefined, undefined, undefined, undefined, undefined, undefined, board,
  );
  let grants = 0;
  const tx = (() => { grants++; return Promise.resolve(options.granted === false ? [] : [{ id: PROPERTY, name: "P", timezone: "Asia/Kolkata", currency: "INR" }]); }) as unknown as Tx;
  const context: TenantRequestContext = { tenantId: TENANT, tx, request: new Request(`https://yellow.test/api/v1/properties/${PROPERTY}/reservation-board${query}`),
    identity: { tenantId: TENANT, actorId: ACTOR, scopes: options.scopes ?? ["reservations.lifecycle:read"] } };
  return { api, context, calls, grants: () => grants };
}
test("HTTP stage parser returns persisted day and binds caller tenant and property", async () => {
  for (const stage of ["pre_arrival", "arrival", "in_house", "departure", "post_departure"] as const) {
    const f = fixture(`?stage=${stage}&limit=25`);
    const result = await f.api.reservationBoard(f.context, PROPERTY);
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({ reservations: [], nextCursor: null, businessDate: "2026-10-04" });
    expect(f.calls).toEqual([{ tenantId: TENANT, propertyNode: PROPERTY, stage, limit: 25 }]);
    expect(f.grants()).toBe(1);
  }
});
test("unknown, duplicate, hostile and mixed filters fail before grants or board reads", async () => {
  for (const query of ["?stage=all", "?stage=", "?stage=arrival&stage=arrival", "?stage=arrival&status=due_in",
    "?stage=arrival&tenantId=" + TENANT, "?stage=arrival&businessDate=2026-10-04", "?stage=arrival&after=!",
    "?stage=arrival&limit=101", "?stage=arrival&from=2026-10-04", "?stage=arrival&guestName=private"]) {
    const f = fixture(query);
    expect((await f.api.reservationBoard(f.context, PROPERTY)).status).toBe(400);
    expect(f.calls).toHaveLength(0); expect(f.grants()).toBe(0);
  }
});
test("legacy status, date-range and Party reads retain their request and response shape", async () => {
  const f = fixture(`?status=reserved&partyId=${ACTOR}&from=2026-10-01T00%3A00%3A00.000Z&to=2026-10-10T00%3A00%3A00.000Z&limit=10`);
  const result = await f.api.reservationBoard(f.context, PROPERTY);
  expect(result.status).toBe(200);
  expect(await result.json()).toEqual({ reservations: [], nextCursor: null });
  expect(f.calls[0]).toEqual({ tenantId: TENANT, propertyNode: PROPERTY, status: "reserved", partyId: ACTOR,
    from: new Date("2026-10-01Z"), to: new Date("2026-10-10Z"), limit: 10 });
});
test("scope and property denials retain existing concealment and never invoke board", async () => {
  for (const options of [{ granted: false }, { scopes: [] }, { scopes: ["reservations.lifecycle:write"] }]) {
    const f = fixture("?stage=arrival", options);
    expect((await f.api.reservationBoard(f.context, PROPERTY)).status).toBe(403);
    expect(f.calls).toHaveLength(0);
  }
  const f = fixture("?stage=arrival");
  expect((await f.api.reservationBoard(f.context, ACTOR)).status).toBe(403);
  expect(f.calls).toHaveLength(0);
});
test("missing day and cursor mismatch return bounded errors without exposing internal details", async () => {
  for (const [failure, status] of [[new ReservationBoardConflictError("private raw SQL"), 409],
    [new ReservationBoardValidationError("private scope"), 400]] as const) {
    const f = fixture("?stage=arrival", { failure });
    const result = await f.api.reservationBoard(f.context, PROPERTY);
    expect(result.status).toBe(status);
    expect(await result.text()).not.toContain("private");
  }
});
