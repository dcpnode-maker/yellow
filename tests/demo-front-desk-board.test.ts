import { describe, expect, test } from "bun:test";

import { app } from "../src/app";
import { buildDemoFrontDeskBoard } from "../src/demo/front-desk-board";

describe("demo front desk operations board", () => {
  test("returns useful current-day operating queues", () => {
    const board = buildDemoFrontDeskBoard();

    expect(board.headline.dueIn).toBe(3);
    expect(board.headline.inHouse).toBe(42);
    expect(board.headline.dueOut).toBe(2);
    expect(board.headline.cashierExceptions).toBe(1);
    expect(board.arrivals.map((arrival) => arrival.marketSegmentGroup)).toEqual(["OTA", "GROUPS", "CORP"]);
    expect(board.roomStatus.inspected + board.roomStatus.clean + board.roomStatus.dirty + board.roomStatus.pickup + board.roomStatus.outOfOrder).toBe(110);
  });

  test("models cashier access without requiring cash drawer for reads", () => {
    const board = buildDemoFrontDeskBoard();
    const cashier = board.rolePermissions.find((role) => role.role === "cashier");
    const frontDesk = board.rolePermissions.find((role) => role.role === "front_desk_agent");

    expect(cashier?.canReadFolio).toBe(true);
    expect(cashier?.canPrepareCashierWork).toBe(true);
    expect(cashier?.canPostCharge).toBe(true);
    expect(cashier?.canSettlePayment).toBe(true);
    expect(cashier?.cashDrawerRequiredForRead).toBe(false);
    expect(frontDesk?.canPostCharge).toBe(false);
  });

  test("keeps payment and posting actions confirmation-gated and disabled", () => {
    const board = buildDemoFrontDeskBoard();
    const actions = [...board.arrivals.flatMap((arrival) => arrival.actions), ...board.departures.flatMap((departure) => departure.actions)];
    const settlement = actions.find((action) => action.id === "settle-payment");
    const posting = actions.find((action) => action.id === "post-charge");

    expect(posting?.roleRequired).toBe("cashier");
    expect(posting?.requiresConfirmation).toBe(true);
    expect(posting?.executionEnabled).toBe(false);
    expect(posting?.cashDrawerRequired).toBe(false);
    expect(settlement?.roleRequired).toBe("cashier");
    expect(settlement?.requiresConfirmation).toBe(true);
    expect(settlement?.executionEnabled).toBe(false);
    expect(settlement?.cashDrawerRequired).toBe(true);
  });

  test("serves the board through the public demo API", async () => {
    const response = await app.handle(new Request("http://localhost/api/v1/demo/front-desk-board"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(buildDemoFrontDeskBoard());
    expect(JSON.stringify(body)).toContain("Cashier access is role-governed");
  });
});
