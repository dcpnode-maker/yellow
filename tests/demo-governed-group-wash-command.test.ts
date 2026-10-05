import { describe, expect, test } from "bun:test";

import { app } from "../src/app";
import { executeGovernedGroupWash } from "../src/demo/governed-group-wash-command";

describe("governed group wash command", () => {
  test("refuses execution without exact confirmation before database use", async () => {
    const result = await executeGovernedGroupWash({
      databaseUrl: "postgres://should-not-be-used",
      confirmationPhrase: "yes",
    });

    expect(result.confirmed).toBe(false);
    expect(result.executed).toBe(false);
    expect(result.realPmsExecuted).toBe(false);
    expect(result.proof).toBeNull();
  });

  test("refuses unsupported wash shapes before database use", async () => {
    const result = await executeGovernedGroupWash({
      databaseUrl: "postgres://should-not-be-used",
      confirmationPhrase: "CONFIRM YELLOW OPERATION",
      unitTypeCode: "SUITE",
    });

    expect(result.confirmed).toBe(true);
    expect(result.executed).toBe(false);
    expect(result.realPmsExecuted).toBe(false);
    expect(result.proof).toBeNull();
  });

  test("reports database unconfigured after supported confirmation", async () => {
    const result = await executeGovernedGroupWash({
      confirmationPhrase: "CONFIRM YELLOW OPERATION",
    });

    expect(result.databaseConfigured).toBe(false);
    expect(result.executed).toBe(false);
    expect(result.proof).toBeNull();
  });

  test("serves the route and keeps unconfirmed calls non-mutating", async () => {
    const response = await app.handle(new Request("http://localhost/api/v1/demo/governed/group-block/wash", {
      method: "POST",
      body: JSON.stringify({ confirmationPhrase: "not exact" }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.actionId).toBe("wash-or-release");
    expect(body.executed).toBe(false);
  });

  test("rejects malformed JSON", async () => {
    const response = await app.handle(new Request("http://localhost/api/v1/demo/governed/group-block/wash", {
      method: "POST",
      body: "{",
    }));

    expect(response.status).toBe(400);
  });
});
