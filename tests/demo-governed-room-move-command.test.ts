import { describe, expect, test } from "bun:test";
import { createApp } from "../src/app";
import { executeGovernedRoomMove } from "../src/demo/governed-room-move-command";

describe("governed room move command", () => {
  test("refuses without exact confirmation before database work", async () => {
    const result = await executeGovernedRoomMove({
      confirmationNo: "L3R-HX-0126",
      fromRoomCode: "303",
      toRoomCode: "305",
      databaseUrl: "postgres://unused/unused",
    });

    expect(result.confirmed).toBe(false);
    expect(result.executed).toBe(false);
    expect(result.realPmsExecuted).toBe(false);
    expect(result.proof).toBeNull();
  });

  test("refuses unsupported target before database work", async () => {
    const result = await executeGovernedRoomMove({
      confirmationNo: "L3R-HX-0126",
      fromRoomCode: "303",
      toRoomCode: "999",
      confirmationPhrase: "CONFIRM YELLOW OPERATION",
      databaseUrl: "postgres://unused/unused",
    });

    expect(result.confirmed).toBe(true);
    expect(result.executed).toBe(false);
    expect(result.reason).toContain("fixed public-demo reservation");
    expect(result.proof).toBeNull();
  });

  test("reports missing database configuration after confirmation", async () => {
    const result = await executeGovernedRoomMove({
      confirmationNo: "L3R-HX-0126",
      fromRoomCode: "303",
      toRoomCode: "305",
      confirmationPhrase: "CONFIRM YELLOW OPERATION",
    });

    expect(result.confirmed).toBe(true);
    expect(result.databaseConfigured).toBe(false);
    expect(result.executed).toBe(false);
  });

  test("HTTP route refuses unconfirmed command without mutation", async () => {
    const app = createApp();
    const response = await app.handle(new Request("http://localhost/api/v1/demo/governed/room-move", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirmationNo: "L3R-HX-0126", fromRoomCode: "303", toRoomCode: "305" }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.actionId).toBe("move-room");
    expect(body.confirmed).toBe(false);
    expect(body.executed).toBe(false);
  });

  test("HTTP route rejects malformed JSON", async () => {
    const app = createApp();
    const response = await app.handle(new Request("http://localhost/api/v1/demo/governed/room-move", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invalid_json" });
  });
});
