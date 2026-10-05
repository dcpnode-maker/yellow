import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import type { HousekeepingTaskDetail } from "../src/contexts/housekeeping";
import { AvailabilityService } from "../src/contexts/inventory";
import { LocalLoginService } from "../src/contexts/identity";
import { OperatorHttpApi } from "../src/http/operator";
import type { TenantRequestContext, Tx } from "../src/kernel";

const TENANT = "00000000-0000-0000-0000-000000220001";
const PROPERTY = "00000000-0000-0000-0000-000000220002";
const ACTOR = "00000000-0000-0000-0000-000000220003";
const TASK = "00000000-0000-0000-0000-000000220004";
const SPACE = "00000000-0000-0000-0000-000000220005";
const UPDATED_AT = "2026-08-28T11:30:00.000Z";

let calls = 0;
let detail: HousekeepingTaskDetail = Object.freeze({
  taskId: TASK,
  taskStatus: "assigned",
  spaceId: SPACE,
  spaceCode: "101",
  floor: "1",
  roomCondition: "dirty",
  roomUpdatedAt: UPDATED_AT,
  assigned: true,
  dueAt: null,
  priority: 10,
  completedAt: null,
});

const housekeeping = {
  async listBoard() { return []; },
  async transition(): Promise<never> { throw new Error("Unexpected housekeeping transition"); },
  async get() {
    calls += 1;
    return Object.freeze({
      ...detail,
      assigneePartyId: ACTOR,
      payload: { guestName: "must not cross the adapter" },
    });
  },
};

const api = new OperatorHttpApi(
  {} as LocalLoginService, {} as AvailabilityService,
  undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
  undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
  undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
  undefined, undefined, undefined, undefined, undefined, housekeeping,
);

function context(
  scopes: readonly string[],
  grants: readonly string[],
  query = "",
): TenantRequestContext {
  const tx = ((_: TemplateStringsArray, permissionCode: unknown) => Promise.resolve(
    grants.includes(String(permissionCode))
      ? [{ id: PROPERTY, name: "Yellow", timezone: "UTC", currency: "USD" }]
      : [],
  )) as unknown as Tx;
  return {
    tenantId: TENANT,
    request: new Request(`http://yellow.test/api/v1/properties/${PROPERTY}/housekeeping/tasks/${TASK}${query}`),
    tx,
    identity: { tenantId: TENANT, actorId: ACTOR, scopes },
  };
}

async function read(
  scopes: readonly string[],
  grants: readonly string[],
  query = "",
): Promise<Response> {
  return api.housekeepingTaskDetail(context(scopes, grants, query), PROPERTY, TASK);
}

describe("Order 220 exact housekeeping-task detail action authority", () => {
  test("derives zero or one action from exact detail truth and distinct property grants", async () => {
    const readScope = "housekeeping.tasks:read";
    const workScope = "housekeeping.tasks:work";
    const inspectScope = "housekeeping.tasks:inspect";

    for (const [nextDetail, scopes, grants, expected] of [
      [{ ...detail, taskStatus: "assigned", assigned: true }, [readScope, workScope], [readScope, workScope], ["start"]],
      [{ ...detail, taskStatus: "assigned", assigned: true }, [readScope, workScope], [readScope], []],
      [{ ...detail, taskStatus: "assigned", assigned: false }, [readScope, workScope], [readScope, workScope], []],
      [{ ...detail, taskStatus: "in_progress", roomCondition: "pickup" }, [readScope, workScope], [readScope, workScope], ["complete"]],
      [{ ...detail, taskStatus: "done", roomCondition: "clean" }, [readScope, workScope], [readScope, workScope], []],
      [{ ...detail, taskStatus: "done", roomCondition: "clean" }, [readScope, inspectScope], [readScope, inspectScope], ["verify"]],
      [{ ...detail, taskStatus: "done", roomCondition: "clean" }, [readScope, inspectScope], [readScope], []],
    ] as const) {
      detail = Object.freeze(nextDetail) as HousekeepingTaskDetail;
      const response = await read(scopes, grants);
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("no-store");
      const body = await response.json() as { task: Record<string, unknown> };
      expect(Object.keys(body.task).sort()).toEqual([
        "allowedActions",
        "assigned",
        "completedAt",
        "dueAt",
        "floor",
        "priority",
        "roomCondition",
        "roomUpdatedAt",
        "spaceCode",
        "spaceId",
        "taskId",
        "taskStatus",
      ].sort());
      expect(body.task.allowedActions).toEqual(expected);
      expect((body.task.allowedActions as unknown[]).length).toBeLessThanOrEqual(1);
      expect(JSON.stringify(body)).not.toContain("assigneePartyId");
      expect(JSON.stringify(body)).not.toContain("guestName");
    }
  });

  test("keeps the exact no-query endpoint, read denial and concealed property behavior", async () => {
    calls = 0;
    const readScope = "housekeeping.tasks:read";
    const forbidden = await read([], []);
    expect(forbidden.status).toBe(403);
    expect(await forbidden.json()).toMatchObject({ type: "auth/scope_missing" });
    const concealed = await read([readScope], []);
    expect(concealed.status).toBe(404);
    expect(await concealed.json()).toMatchObject({ type: "housekeeping/not_found" });
    expect((await read([readScope], [readScope], "?action=start")).status).toBe(400);
    expect(calls).toBe(0);
  });

  test("freezes adapter evidence and reuses the existing board action filter", () => {
    const source = readFileSync(new URL("../src/http/operator.ts", import.meta.url), "utf8");
    expect(source).toContain("function housekeepingTaskDetailEligibleAction(");
    expect(source).toContain("operatorHousekeepingTaskDetail(task, workGranted, inspectGranted)");
    expect(source).toContain("allowedActions: allowedHousekeepingActions(");
    expect(source).toContain("return Object.freeze({");
  });
});
