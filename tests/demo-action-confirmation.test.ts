import { describe, expect, it } from "bun:test";

import { app } from "../src/app";
import { confirmDemoAction } from "../src/demo/action-confirmation";

async function postAction(body: unknown): Promise<{ response: Response; json: Record<string, unknown> }> {
  const response = await app.handle(new Request("http://localhost/api/v1/demo/actions/confirm", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }));
  return { response, json: await response.json() as Record<string, unknown> };
}

describe("demo action confirmation", () => {
  it("requires an action id", async () => {
    const { response, json } = await postAction({ confirmationPhrase: "CONFIRM YELLOW OPERATION" });

    expect(response.status).toBe(400);
    expect(json.error).toBe("action_required");
  });

  it("rejects unknown action ids", async () => {
    const { response, json } = await postAction({ actionId: "unknown-action", confirmationPhrase: "CONFIRM YELLOW OPERATION" });

    expect(response.status).toBe(404);
    expect(json.error).toBe("unknown_action");
  });

  it("returns unconfirmed command envelope without the exact phrase", async () => {
    const { response, json } = await postAction({ actionId: "check-in-arrival" });

    expect(response.status).toBe(200);
    expect(json.actionLabel).toBe("Check in Sara Al Harbi");
    expect(json.workflowId).toBe("arrival");
    expect(json.requiresConfirmation).toBe(true);
    expect(json.confirmed).toBe(false);
    expect(json.executed).toBe(false);
    expect(json.executionEnabled).toBe(false);
    expect(json.authoritativeReread).toBeDefined();
  });

  it("accepts the exact phrase but still refuses real PMS execution until governed services exist", async () => {
    const { response, json } = await postAction({
      actionId: "post-charge",
      confirmationPhrase: "CONFIRM YELLOW OPERATION",
    });

    expect(response.status).toBe(200);
    expect(json.actionLabel).toBe("Post room, food, beverage or miscellaneous charge");
    expect(json.workflowId).toBe("cashier");
    expect(json.confirmed).toBe(true);
    expect(json.executed).toBe(false);
    expect(json.executionEnabled).toBe(false);
    expect(String(json.reason)).toContain("database-backed governed workflow services");
    expect((json.authoritativeReread as { guestScenario?: { reservationCode?: string } }).guestScenario?.reservationCode).toBe("L3R-HX-0126");
  });

  it("keeps the pure confirmation helper deterministic and reread-backed", () => {
    const left = confirmDemoAction({ actionId: "complete-checkout", confirmationPhrase: "CONFIRM YELLOW OPERATION" });
    const right = confirmDemoAction({ actionId: "complete-checkout", confirmationPhrase: "CONFIRM YELLOW OPERATION" });

    expect(left).toEqual(right);
    expect("authoritativeReread" in left && left.authoritativeReread.workflows.map((workflow) => workflow.id)).toContain("checkout");
  });
});
