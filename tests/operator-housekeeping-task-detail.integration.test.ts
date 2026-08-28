import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { createApp } from "../src/app";
import {
  HousekeepingConflictError,
  HousekeepingNotFoundError,
  HousekeepingValidationError,
} from "../src/contexts/housekeeping";
import { AvailabilityService } from "../src/contexts/inventory";
import { LocalLoginService } from "../src/contexts/identity";
import { OperatorHttpApi } from "../src/http/operator";
import { Database, type TenantRequestContext, type Tx } from "../src/kernel";

const TENANT = "00000000-0000-0000-0000-000000217001";
const PROPERTY = "00000000-0000-0000-0000-000000217002";
const ACTOR = "00000000-0000-0000-0000-000000217003";
const TASK = "00000000-0000-0000-0000-000000217004";
const SPACE = "00000000-0000-0000-0000-000000217005";
const UPDATED_AT = "2026-08-28T08:30:00.123456Z";
const DUE_AT = "2026-08-28T09:00:00.654321Z";

type DetailFailure = "validation" | "not-found" | "conflict" | null;
const calls: unknown[] = [];
let failure: DetailFailure = null;

const housekeeping = {
  async listBoard() { return []; },
  async transition(): Promise<never> { throw new Error("Unexpected housekeeping transition"); },
  async get(input: unknown) {
    calls.push(input);
    if (failure === "validation") throw new HousekeepingValidationError("private validation detail");
    if (failure === "not-found") throw new HousekeepingNotFoundError("private concealed identity");
    if (failure === "conflict") throw new HousekeepingConflictError(`hostile stored ${SPACE}`);
    return Object.freeze({
      taskId: TASK,
      taskStatus: "assigned" as const,
      spaceId: SPACE,
      spaceCode: "101",
      floor: "1",
      roomCondition: "dirty" as const,
      roomUpdatedAt: UPDATED_AT,
      assigned: true,
      dueAt: DUE_AT,
      priority: 3,
      completedAt: null,
      assigneePartyId: ACTOR,
      notes: "must never cross the adapter",
      payload: { guestName: "must never cross the adapter" },
    });
  },
};

function operator(service: typeof housekeeping | null = housekeeping): OperatorHttpApi {
  return new OperatorHttpApi(
    {} as LocalLoginService,
    {} as AvailabilityService,
    undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
    undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
    undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
    undefined, undefined, undefined, undefined, undefined, service ?? undefined,
  );
}

function context(
  query = "",
  scopes: readonly string[] = ["housekeeping.tasks:read"],
  granted = true,
): TenantRequestContext {
  const tx = (async () => granted
    ? [{ id: PROPERTY, name: "Yellow", timezone: "UTC", currency: "USD" }]
    : []) as unknown as Tx;
  return {
    tenantId: TENANT,
    request: new Request(`http://yellow.test/api/v1/properties/${PROPERTY}/housekeeping/tasks/${TASK}${query}`),
    tx,
    identity: { tenantId: TENANT, actorId: ACTOR, scopes },
  };
}

async function captured(
  api: OperatorHttpApi,
  request: TenantRequestContext,
  propertyNode = PROPERTY,
  taskId = TASK,
): Promise<Response> {
  try {
    return await api.housekeepingTaskDetail(request, propertyNode, taskId);
  } catch (error) {
    return api.failure(request.request, error);
  }
}

function routed(api: OperatorHttpApi) {
  const tx = (async () => [{ id: PROPERTY, name: "Yellow", timezone: "UTC", currency: "USD" }]) as unknown as Tx;
  const database = {
    async withTenantTransaction<T>(_tenantId: string, handler: (commandTx: Tx) => Promise<T>): Promise<T> {
      return handler(tx);
    },
  } as unknown as Database;
  return createApp({
    database,
    tenantResolver: {
      async resolve() {
        return { tenantId: TENANT, actorId: ACTOR, scopes: ["housekeeping.tasks:read"] };
      },
    },
    operatorApi: api,
  });
}

describe("Order 217 exact housekeeping-task HTTP detail", () => {
  test("the exact GET route returns only minimized task truth with no-store", async () => {
    calls.length = 0;
    failure = null;
    const path = `/api/v1/properties/${PROPERTY}/housekeeping/tasks/${TASK}`;
    const response = await routed(operator()).handle(new Request(`http://yellow.test${path}`));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      task: {
        assigned: true,
        completedAt: null,
        dueAt: DUE_AT,
        floor: "1",
        priority: 3,
        roomCondition: "dirty",
        roomUpdatedAt: UPDATED_AT,
        spaceCode: "101",
        spaceId: SPACE,
        taskId: TASK,
        taskStatus: "assigned",
      },
    });
    expect(calls).toEqual([{ tenantId: TENANT, propertyNode: PROPERTY, taskId: TASK }]);
  });

  test("UUID, empty-query, scope and exact property grant fail before the detail read", async () => {
    calls.length = 0;
    failure = null;
    const api = operator();
    for (const [request, propertyNode, taskId, expected] of [
      [context(), "bad", TASK, 400],
      [context(), PROPERTY, "bad", 400],
      [context("?status=assigned"), PROPERTY, TASK, 400],
      [context("?x=1&x=2"), PROPERTY, TASK, 400],
      [context("", []), PROPERTY, TASK, 403],
      [context("", ["housekeeping.tasks:read"], false), PROPERTY, TASK, 404],
    ] as const) {
      expect((await captured(api, request, propertyNode, taskId)).status).toBe(expected);
    }
    expect(calls).toEqual([]);
  });

  test("domain failures and absent detail composition map to bounded outcomes", async () => {
    const api = operator();
    for (const [nextFailure, status, type] of [
      ["validation", 400, "request/invalid"],
      ["not-found", 404, "housekeeping/not_found"],
      ["conflict", 409, "housekeeping/conflict"],
    ] as const) {
      failure = nextFailure;
      const response = await captured(api, context());
      expect(response.status).toBe(status);
      expect(response.headers.get("cache-control")).toBe("no-store");
      const body = await response.json();
      expect(body).toMatchObject({ status, type });
      expect(JSON.stringify(body)).not.toContain(SPACE);
    }
    failure = null;
    expect((await captured(operator(null), context())).status).toBe(503);
  });

  test("wires only the exact GET API and human route while preserving transition POST", async () => {
    const appSource = readFileSync(new URL("../src/app.ts", import.meta.url), "utf8");
    const apiRoute = "/api/v1/properties/:property/housekeeping/tasks/:task";
    const humanRoute = "/p/:property/housekeeping/tasks/:task";
    expect(appSource).toContain(`.get("${apiRoute}"`);
    expect(appSource).toContain("operator.housekeepingTaskDetail(");
    expect(appSource).toContain(`.get("${humanRoute}"`);
    expect(appSource).toContain('.post("/api/v1/properties/:property/housekeeping/tasks/:task/transition"');
    for (const verb of ["post", "put", "patch", "delete"]) {
      expect(appSource).not.toContain(`.${verb}("${apiRoute}"`);
    }
    const human = await routed(operator()).handle(new Request(`http://yellow.test/p/${PROPERTY}/housekeeping/tasks/${TASK}`));
    expect(human.status).toBe(200);
    expect(human.headers.get("content-type")).toContain("text/html");
  });
});
