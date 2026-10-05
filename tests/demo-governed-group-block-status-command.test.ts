import { describe, expect, test } from "bun:test";

import { app } from "../src/app";
import { executeGovernedGroupBlockStatus } from "../src/demo/governed-group-block-status-command";

describe("governed group block status command", () => {
  test("refuses execution without exact confirmation before database use", async () => {
    const result = await executeGovernedGroupBlockStatus({
      databaseUrl: "postgres://should-not-be-used",
      blockCode: "MEHRA-WED",
      targetStatus: "definite",
    });

    expect(result.actionId).toBe("convert-status");
    expect(result.requiresConfirmation).toBe(true);
    expect(result.confirmed).toBe(false);
    expect(result.executed).toBe(false);
    expect(result.realPmsExecuted).toBe(false);
    expect(result.proof).toBeNull();
  });

  test("refuses unsupported block codes and statuses before database use", async () => {
    const unsupportedBlock = await executeGovernedGroupBlockStatus({
      databaseUrl: "postgres://should-not-be-used",
      confirmationPhrase: "CONFIRM YELLOW OPERATION",
      blockCode: "YCC-0926",
      targetStatus: "definite",
    });
    const unsupportedStatus = await executeGovernedGroupBlockStatus({
      databaseUrl: "postgres://should-not-be-used",
      confirmationPhrase: "CONFIRM YELLOW OPERATION",
      blockCode: "MEHRA-WED",
      targetStatus: "cancelled",
    });

    for (const result of [unsupportedBlock, unsupportedStatus]) {
      expect(result.confirmed).toBe(true);
      expect(result.databaseConfigured).toBe(true);
      expect(result.executed).toBe(false);
      expect(result.realPmsExecuted).toBe(false);
      expect(result.proof).toBeNull();
      expect(result.reason).toContain("fixed public-demo block to definite");
    }
  });

  test("reports database unconfigured after supported confirmation", async () => {
    const result = await executeGovernedGroupBlockStatus({
      confirmationPhrase: "CONFIRM YELLOW OPERATION",
      blockCode: "MEHRA-WED",
      targetStatus: "definite",
    });

    expect(result.confirmed).toBe(true);
    expect(result.databaseConfigured).toBe(false);
    expect(result.executed).toBe(false);
    expect(result.realPmsExecuted).toBe(false);
    expect(result.proof).toBeNull();
  });

  test("serves the route and keeps unconfirmed calls non-mutating", async () => {
    const response = await app.handle(new Request("http://localhost/api/v1/demo/governed/group-block/status", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ blockCode: "MEHRA-WED", targetStatus: "definite" }),
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
    const response = await app.handle(new Request("http://localhost/api/v1/demo/governed/group-block/status", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("invalid_json");
  });
});
