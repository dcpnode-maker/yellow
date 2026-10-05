import { describe, expect, test } from "bun:test";

import { app } from "../src/app";
import { executeGovernedCheckInCommand } from "../src/demo/governed-checkin-command";

describe("governed check-in command", () => {
  test("refuses execution without exact confirmation before database use", async () => {
    const result = await executeGovernedCheckInCommand({
      databaseUrl: "postgres://should-not-be-used",
      confirmationNo: "L3R-HX-0126",
      roomCode: "303",
    });

    expect(result.actionId).toBe("check-in-arrival");
    expect(result.requiresConfirmation).toBe(true);
    expect(result.confirmed).toBe(false);
    expect(result.executed).toBe(false);
    expect(result.realPmsExecuted).toBe(false);
    expect(result.proof).toBeNull();
    expect(result.reason).toContain("Exact confirmation phrase");
  });

  test("refuses unsupported reservations before database use", async () => {
    const result = await executeGovernedCheckInCommand({
      databaseUrl: "postgres://should-not-be-used",
      confirmationPhrase: "CONFIRM YELLOW OPERATION",
      confirmationNo: "NOT-DEMO",
      roomCode: "303",
    });

    expect(result.confirmed).toBe(true);
    expect(result.databaseConfigured).toBe(true);
    expect(result.executed).toBe(false);
    expect(result.realPmsExecuted).toBe(false);
    expect(result.proof).toBeNull();
    expect(result.reason).toContain("limited to the provisioned public-demo arrival fixture");
  });

  test("reports database unconfigured after supported confirmation", async () => {
    const result = await executeGovernedCheckInCommand({
      confirmationPhrase: "CONFIRM YELLOW OPERATION",
      confirmationNo: "L3R-HX-0126",
      roomCode: "303",
    });

    expect(result.confirmed).toBe(true);
    expect(result.databaseConfigured).toBe(false);
    expect(result.executed).toBe(false);
    expect(result.realPmsExecuted).toBe(false);
    expect(result.proof).toBeNull();
  });

  test("serves the route and keeps unconfirmed calls non-mutating", async () => {
    const response = await app.handle(new Request("http://localhost/api/v1/demo/governed/check-in", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirmationNo: "L3R-HX-0126", roomCode: "303" }),
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
    const response = await app.handle(new Request("http://localhost/api/v1/demo/governed/check-in", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("invalid_json");
  });
});
