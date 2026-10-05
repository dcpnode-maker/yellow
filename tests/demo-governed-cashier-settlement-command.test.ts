import { describe, expect, test } from "bun:test";

import { app } from "../src/app";
import { executeGovernedCashierSettlement } from "../src/demo/governed-cashier-settlement-command";

describe("governed cashier settlement command", () => {
  test("refuses execution without exact confirmation before database use", async () => {
    const result = await executeGovernedCashierSettlement({
      databaseUrl: "postgres://should-not-be-used",
      confirmationNo: "L3R-HX-0126",
      folioNo: "FOL-DEMO-303",
      settlementKey: "cash-settlement-current-balance",
    });

    expect(result.actionId).toBe("settle-payment");
    expect(result.requiresConfirmation).toBe(true);
    expect(result.confirmed).toBe(false);
    expect(result.executed).toBe(false);
    expect(result.realPmsExecuted).toBe(false);
    expect(result.proof).toBeNull();
  });

  test("refuses unsupported folios and settlement keys before database use", async () => {
    const unsupportedFolio = await executeGovernedCashierSettlement({
      databaseUrl: "postgres://should-not-be-used",
      confirmationPhrase: "CONFIRM YELLOW OPERATION",
      confirmationNo: "L3R-HX-0126",
      folioNo: "FOL-OTHER",
      settlementKey: "cash-settlement-current-balance",
    });
    const unsupportedSettlement = await executeGovernedCashierSettlement({
      databaseUrl: "postgres://should-not-be-used",
      confirmationPhrase: "CONFIRM YELLOW OPERATION",
      confirmationNo: "L3R-HX-0126",
      folioNo: "FOL-DEMO-303",
      settlementKey: "arbitrary",
    });

    for (const result of [unsupportedFolio, unsupportedSettlement]) {
      expect(result.confirmed).toBe(true);
      expect(result.databaseConfigured).toBe(true);
      expect(result.executed).toBe(false);
      expect(result.realPmsExecuted).toBe(false);
      expect(result.proof).toBeNull();
      expect(result.reason).toContain("fixed public-demo folio and settlement key");
    }
  });

  test("reports database unconfigured after supported confirmation", async () => {
    const result = await executeGovernedCashierSettlement({
      confirmationPhrase: "CONFIRM YELLOW OPERATION",
      confirmationNo: "L3R-HX-0126",
      folioNo: "FOL-DEMO-303",
      settlementKey: "cash-settlement-current-balance",
    });

    expect(result.confirmed).toBe(true);
    expect(result.databaseConfigured).toBe(false);
    expect(result.executed).toBe(false);
    expect(result.realPmsExecuted).toBe(false);
    expect(result.proof).toBeNull();
  });

  test("serves the route and keeps unconfirmed calls non-mutating", async () => {
    const response = await app.handle(new Request("http://localhost/api/v1/demo/governed/cashier/settle-payment", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirmationNo: "L3R-HX-0126", folioNo: "FOL-DEMO-303", settlementKey: "cash-settlement-current-balance" }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-security-policy")).toContain("default-src 'self'");
    expect(body.mode).toBe("governed-db-command");
    expect(body.confirmed).toBe(false);
    expect(body.executed).toBe(false);
    expect(body.realPmsExecuted).toBe(false);
  });

  test("rejects malformed JSON", async () => {
    const response = await app.handle(new Request("http://localhost/api/v1/demo/governed/cashier/settle-payment", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("invalid_json");
  });
});
