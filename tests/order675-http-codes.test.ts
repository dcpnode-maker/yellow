import { describe, expect, test } from "bun:test";
import type { LocalLoginService } from "../src/contexts/identity";
import type { AvailabilityService } from "../src/contexts/inventory";
import type { ReservationBoardInput, ReservationBoardRow } from "../src/contexts/reservations";
import { OperatorHttpApi } from "../src/http/operator";
import type { TenantRequestContext, Tx } from "../src/kernel";

const TENANT = "00000000-0000-0000-0000-000000067501";
const PROPERTY = "00000000-0000-0000-0000-000000067502";
const ACTOR = "00000000-0000-0000-0000-000000067503";
const stored: ReservationBoardRow = {
  reservationId: "00000000-0000-0000-0000-000000067504",
  primaryPartyId: "00000000-0000-0000-0000-000000067505",
  confirmationNo: "TEST-675", status: "due_in", operationalState: "due_in",
  primaryGuestDisplayName: "Synthetic guest", stayFrom: "2026-09-24T09:00:00.000000Z",
  stayTo: "2026-09-26T09:00:00.000000Z", createdAt: "2026-09-20T09:00:00.000000Z",
  unitTypeCode: "DLX", unitTypeLabel: "Deluxe", sellableUnitLabel: null,
  ratePlanCode: "FLEX", ratePlanLabel: "Best available flexible",
  adults: 2, children: 0, channelCode: "direct", marketCode: null, sourceCode: null,
  currency: "INR", arrivalTravel: null, departureTravel: null,
};

function setup(granted: boolean, scopes = ["reservations.lifecycle:read"]) {
  const calls: ReservationBoardInput[] = [];
  const board = { async list(_tx: Tx, input: ReservationBoardInput) {
    calls.push(input);
    return { reservations: [stored], nextCursor: null, businessDate: null };
  } };
  const api = new OperatorHttpApi(
    {} as LocalLoginService, {} as AvailabilityService, undefined, undefined, undefined, undefined,
    undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
    undefined, undefined, undefined, undefined, undefined, undefined, board,
  );
  const tx = (() => Promise.resolve(granted ? [{ id: PROPERTY, name: "P", timezone: "UTC", currency: "INR" }] : [])) as unknown as Tx;
  const context: TenantRequestContext = {
    tenantId: TENANT, tx, identity: { tenantId: TENANT, actorId: ACTOR, scopes },
    request: new Request(`http://yellow.test/api/v1/properties/${PROPERTY}/reservation-board?status=due_in&limit=10`),
  };
  return { api, context, calls };
}

describe("Order675 HTTP code contract", () => {
  test("authorized HTTP response preserves both codes separately from names", async () => {
    const { api, context, calls } = setup(true);
    const response = await api.reservationBoard(context, PROPERTY);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ reservations: [stored], nextCursor: null, businessDate: null });
    expect(calls).toEqual([{ tenantId: TENANT, propertyNode: PROPERTY, status: "due_in", limit: 10 }]);
  });
  test("missing scope or property grant never queries product codes", async () => {
    for (const { api, context, calls } of [setup(true, []), setup(false)]) {
      const response = await api.reservationBoard(context, PROPERTY);
      expect(response.status).toBe(403);
      expect(calls).toEqual([]);
      expect(await response.text()).not.toContain("FLEX");
    }
  });
});
