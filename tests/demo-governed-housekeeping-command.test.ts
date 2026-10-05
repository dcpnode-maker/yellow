import { describe, expect, test } from "bun:test";

import { app } from "../src/app";
import { executeGovernedHousekeepingCommand } from "../src/demo/governed-housekeeping-command";

describe("governed housekeeping command", () => {
  test("refuses execution without exact confirmation before database use", async () => {
    const result = await executeGovernedHousekeepingCommand({
      databaseUrl: "postgres://should-not-be-used",
      roomCode: "303",
    });

    expect(result.requiresConfirmation).toBe(true);
    expect(result.confirmed).toBe(false);
    expect(result.executed).toBe(false);
    expect(result.realPmsExecuted).toBe(false);
    expect(result.proof).toBeNull();
    expect(result.reason).toContain("Exact confirmation phrase");
  });

  test("reports database unconfigured after confirmation instead of pretending success", async () => {
    const result = await executeGovernedHousekeepingCommand({
      confirmationPhrase: "CONFIRM YELLOW OPERATION",
      roomCode: "303",
    });

    expect(result.confirmed).toBe(true);
    expect(result.databaseConfigured).toBe(false);
    expect(result.executed).toBe(false);
    expect(result.realPmsExecuted).toBe(false);
    expect(result.proof).toBeNull();
  });

  test("refuses out-of-scope room codes before database use", async () => {
    const result = await executeGovernedHousekeepingCommand({
      confirmationPhrase: "CONFIRM YELLOW OPERATION",
      databaseUrl: "postgres://should-not-be-used",
      roomCode: "999",
      condition: "dirty",
    });

    expect(result.confirmed).toBe(true);
    expect(result.databaseConfigured).toBe(true);
    expect(result.executed).toBe(false);
    expect(result.realPmsExecuted).toBe(false);
    expect(result.proof).toBeNull();
    expect(result.reason).toContain("outside the governed public-demo housekeeping command scope");
  });

  test("serves the route and keeps unconfirmed calls non-mutating", async () => {
    const response = await app.handle(new Request("http://localhost/api/v1/demo/governed/housekeeping/condition", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ roomCode: "303" }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-security-policy")).toContain("default-src 'self'");
    expect(body.mode).toBe("governed-db-command");
    expect(body.confirmed).toBe(false);
    expect(body.executed).toBe(false);
    expect(body.realPmsExecuted).toBe(false);
  });

  test("rejects invalid room condition values", async () => {
    const response = await app.handle(new Request("http://localhost/api/v1/demo/governed/housekeeping/condition", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ condition: "sold" }),
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("invalid_condition");
  });
});
