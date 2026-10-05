import { describe, expect, test } from "bun:test";

import { app } from "../src/app";
import { executeGovernedGroupRoomingListImport } from "../src/demo/governed-group-rooming-list-command";

describe("governed group rooming-list import command", () => {
  test("refuses execution without exact confirmation before database use", async () => {
    const result = await executeGovernedGroupRoomingListImport({
      databaseUrl: "postgres://should-not-be-used",
      confirmationPhrase: "yes",
    });

    expect(result.confirmed).toBe(false);
    expect(result.executed).toBe(false);
    expect(result.realPmsExecuted).toBe(false);
    expect(result.proof).toBeNull();
  });

  test("refuses unsupported imports before database use", async () => {
    const result = await executeGovernedGroupRoomingListImport({
      databaseUrl: "postgres://should-not-be-used",
      confirmationPhrase: "CONFIRM YELLOW OPERATION",
      blockCode: "OTHER",
    });

    expect(result.confirmed).toBe(true);
    expect(result.executed).toBe(false);
    expect(result.realPmsExecuted).toBe(false);
    expect(result.proof).toBeNull();
  });

  test("reports database unconfigured after supported confirmation", async () => {
    const result = await executeGovernedGroupRoomingListImport({
      confirmationPhrase: "CONFIRM YELLOW OPERATION",
    });

    expect(result.databaseConfigured).toBe(false);
    expect(result.executed).toBe(false);
    expect(result.proof).toBeNull();
  });

  test("serves the route and keeps unconfirmed calls non-mutating", async () => {
    const response = await app.handle(new Request("http://localhost/api/v1/demo/governed/group-block/rooming-list/import", {
      method: "POST",
      body: JSON.stringify({ confirmationPhrase: "not exact" }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.actionId).toBe("import-rooming-list");
    expect(body.executed).toBe(false);
  });

  test("rejects malformed JSON", async () => {
    const response = await app.handle(new Request("http://localhost/api/v1/demo/governed/group-block/rooming-list/import", {
      method: "POST",
      body: "{",
    }));

    expect(response.status).toBe(400);
  });
});
