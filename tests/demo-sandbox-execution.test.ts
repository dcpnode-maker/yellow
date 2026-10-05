import { beforeEach, describe, expect, it } from "bun:test";

import { app } from "../src/app";
import { executeDemoSandboxAction, resetDemoSandbox } from "../src/demo/sandbox-execution";

async function execute(body: unknown): Promise<{ response: Response; json: Record<string, unknown> }> {
  const response = await app.handle(new Request("http://localhost/api/v1/demo/sandbox/actions/execute", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }));
  return { response, json: await response.json() as Record<string, unknown> };
}

describe("synthetic demo sandbox execution", () => {
  beforeEach(() => {
    resetDemoSandbox();
  });

  it("requires an action id", async () => {
    const { response, json } = await execute({ confirmationPhrase: "CONFIRM YELLOW OPERATION" });

    expect(response.status).toBe(400);
    expect(json.error).toBe("action_required");
  });

  it("rejects unknown action ids", async () => {
    const { response, json } = await execute({ actionId: "unknown", confirmationPhrase: "CONFIRM YELLOW OPERATION" });

    expect(response.status).toBe(404);
    expect(json.error).toBe("unknown_action");
  });

  it("does not change sandbox state without the exact phrase", async () => {
    const { response, json } = await execute({ actionId: "check-in-arrival" });

    expect(response.status).toBe(200);
    expect(json.confirmed).toBe(false);
    expect(json.sandboxExecuted).toBe(false);
    expect(json.realPmsExecuted).toBe(false);
    const reread = json.authoritativeReread as { sandbox?: { completedActionIds?: string[]; timeline?: string[] } };
    expect(reread.sandbox?.completedActionIds).toEqual([]);
    expect(reread.sandbox?.timeline).toEqual([]);
  });

  it("records a confirmed synthetic check-in without claiming real PMS execution", async () => {
    const { response, json } = await execute({
      actionId: "check-in-arrival",
      confirmationPhrase: "CONFIRM YELLOW OPERATION",
    });

    expect(response.status).toBe(200);
    expect(json.confirmed).toBe(true);
    expect(json.sandboxExecuted).toBe(true);
    expect(json.realPmsExecuted).toBe(false);
    const reread = json.authoritativeReread as { sandbox?: { completedActionIds?: string[]; timeline?: string[]; warnings?: string[] } };
    expect(reread.sandbox?.completedActionIds).toContain("check-in-arrival");
    expect(reread.sandbox?.timeline?.join(" ")).toContain("Sara Al Harbi");
    expect(reread.sandbox?.warnings?.join(" ")).toContain("no PostgreSQL table is changed");
  });

  it("keeps cashier/payment-like sandbox execution legally safe", () => {
    const result = executeDemoSandboxAction({
      actionId: "post-charge",
      confirmationPhrase: "CONFIRM YELLOW OPERATION",
    });

    expect("error" in result).toBe(false);
    if ("error" in result) throw new Error(result.error);
    expect(result.sandboxExecuted).toBe(true);
    expect(result.realPmsExecuted).toBe(false);
    expect(result.authoritativeReread.sandbox.timeline.join(" ")).toContain("no journal, payment, tax or document row was created");
    expect(result.authoritativeReread.sandbox.warnings.join(" ")).toContain("No occupancy, folio, journal, payment, fiscal document");
  });

  it("accumulates multiple confirmed demo actions in the in-memory overlay", () => {
    executeDemoSandboxAction({ actionId: "check-in-arrival", confirmationPhrase: "CONFIRM YELLOW OPERATION" });
    const second = executeDemoSandboxAction({ actionId: "mark-inspected", confirmationPhrase: "CONFIRM YELLOW OPERATION" });

    if ("error" in second) throw new Error(second.error);
    expect(second.authoritativeReread.sandbox.completedActionIds).toEqual(["check-in-arrival", "mark-inspected"]);
    expect(second.authoritativeReread.sandbox.timeline).toHaveLength(2);
  });
});
