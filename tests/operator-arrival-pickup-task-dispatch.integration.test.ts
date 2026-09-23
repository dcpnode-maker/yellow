import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { AvailabilityService } from "../src/contexts/inventory";
import { LocalLoginService } from "../src/contexts/identity";
import {
  ArrivalPickupTaskDispatchConflictError,
  ArrivalPickupTaskDispatchNotFoundError,
  ArrivalPickupTaskDispatchValidationError,
  type ArrivalPickupTaskTransitionInput,
} from "../src/contexts/stay-operations";
import { OperatorHttpApi } from "../src/http/operator";
import type { TenantRequestContext, Tx } from "../src/kernel";

const TENANT = "00000000-0000-0000-0000-000000022801";
const PROPERTY = "00000000-0000-0000-0000-000000022802";
const RESERVATION = "00000000-0000-0000-0000-000000022803";
const TASK = "00000000-0000-0000-0000-000000022804";
const ACTOR = "00000000-0000-0000-0000-000000022805";
const STAFF = "00000000-0000-0000-0000-000000022806";
const IDEMPOTENCY = "order-228-pickup-transition";
const CORRELATION = "00000000-0000-4000-8000-000000022807";

const calls: unknown[] = [];
let replayed = false;
let failure: "validation" | "not-found" | "conflict" | null = null;

const dispatch = {
  async transition(input: ArrivalPickupTaskTransitionInput) {
    calls.push(input);
    if (failure === "validation") throw new ArrivalPickupTaskDispatchValidationError("invalid");
    if (failure === "not-found") throw new ArrivalPickupTaskDispatchNotFoundError("concealed");
    if (failure === "conflict") throw new ArrivalPickupTaskDispatchConflictError("stale");
    const action = input.action as "assign" | "start" | "complete";
    return Object.freeze({
      taskId: TASK,
      reservationId: RESERVATION,
      taskStatus: action === "assign" ? "assigned" as const
        : action === "start" ? "in_progress" as const : "done" as const,
      assigneePartyId: STAFF,
      completedAt: action === "complete" ? "2026-09-18T10:15:00.000Z" : null,
      action,
      eligibleAction: action === "assign" ? "start" as const
        : action === "start" ? "complete" as const : null,
      replayed,
    });
  },
};

function operator(withDispatch = true): OperatorHttpApi {
  const args: ConstructorParameters<typeof OperatorHttpApi> = [
    {} as LocalLoginService,
    {} as AvailabilityService,
    undefined, undefined, undefined, undefined, undefined, undefined, undefined,
    undefined, undefined, undefined, undefined, undefined, undefined, undefined,
    undefined, undefined, undefined, undefined, undefined, undefined, undefined,
    undefined, undefined, undefined, undefined, undefined, undefined, undefined,
    undefined, undefined, undefined, undefined, undefined, undefined, undefined,
    withDispatch ? dispatch : undefined,
  ];
  return new OperatorHttpApi(...args);
}

function context(
  action: "assign" | "start" | "complete",
  scopes: readonly string[],
  body: unknown,
  granted = true,
  idempotencyKey: string | null = IDEMPOTENCY,
  suffix = "",
): TenantRequestContext {
  const tx = (() => Promise.resolve(granted
    ? [{ id: PROPERTY, name: "Hotel", timezone: "UTC", currency: "USD" }]
    : [])) as unknown as Tx;
  const headers = new Headers({ "content-type": "application/json", "x-correlation-id": CORRELATION });
  if (idempotencyKey !== null) headers.set("idempotency-key", idempotencyKey);
  return {
    tenantId: TENANT,
    request: new Request(
      `http://yellow.test/api/v1/properties/${PROPERTY}/reservations/${RESERVATION}/arrival-pickup-task/${TASK}/${action}${suffix}`,
      { method: "POST", headers, body: JSON.stringify(body) },
    ),
    tx,
    identity: { tenantId: TENANT, actorId: ACTOR, scopes },
  };
}

async function captured(
  api: OperatorHttpApi,
  request: TenantRequestContext,
  action: "assign" | "start" | "complete",
  body: unknown,
  propertyNode = PROPERTY,
  reservationId = RESERVATION,
  taskId = TASK,
): Promise<Response> {
  try {
    return await api.transitionReservationPickupTask(
      request, propertyNode, reservationId, taskId, action, body,
    );
  } catch (error) {
    return api.failure(request.request, error);
  }
}

const CASES = [
  Object.freeze({
    action: "assign" as const,
    scope: "stay-operations.pickup-tasks:dispatch",
    body: Object.freeze({ expectedTaskStatus: "open", expectedAssigneePartyId: null, staffPartyId: STAFF }),
    status: "assigned",
    eligibleAction: "start",
  }),
  Object.freeze({
    action: "start" as const,
    scope: "stay-operations.pickup-tasks:work",
    body: Object.freeze({ expectedTaskStatus: "assigned", expectedAssigneePartyId: STAFF }),
    status: "in_progress",
    eligibleAction: "complete",
  }),
  Object.freeze({
    action: "complete" as const,
    scope: "stay-operations.pickup-tasks:work",
    body: Object.freeze({ expectedTaskStatus: "in_progress", expectedAssigneePartyId: STAFF }),
    status: "done",
    eligibleAction: null,
  }),
] as const;

describe("Order228 exact arrival pickup-task dispatch HTTP", () => {
  test("each exact action is no-store, actor-bound and returns only its minimized canonical receipt", async () => {
    calls.length = 0;
    failure = null;
    replayed = false;
    for (const item of CASES) {
      const response = await captured(
        operator(),
        context(item.action, [item.scope], item.body),
        item.action,
        item.body,
      );
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("idempotency-replayed")).toBe("false");
      expect(response.headers.get("x-correlation-id")).toBe(CORRELATION);
      expect(await response.json()).toEqual({
        assigneePartyId: STAFF,
        completedAt: item.action === "complete" ? "2026-09-18T10:15:00.000Z" : null,
        eligibleAction: item.eligibleAction,
        replayed: false,
        reservationId: RESERVATION,
        taskId: TASK,
        taskStatus: item.status,
      });
    }
    expect(calls).toHaveLength(3);
    expect(calls[0]).toMatchObject({
      tenantId: TENANT,
      propertyNode: PROPERTY,
      reservationId: RESERVATION,
      taskId: TASK,
      action: "assign",
      idempotencyKey: IDEMPOTENCY,
      envelope: {
        actorId: ACTOR,
        tenantId: TENANT,
        propertyNode: PROPERTY,
        requestId: CORRELATION,
        operation: "task.status_changed",
      },
    });
  });

  test("exact replay is disclosed without changing the public receipt shape", async () => {
    calls.length = 0;
    replayed = true;
    const item = CASES[0];
    const response = await captured(operator(), context(item.action, [item.scope], item.body), item.action, item.body);
    expect(response.status).toBe(200);
    expect(response.headers.get("idempotency-replayed")).toBe("true");
    expect((await response.json() as { replayed: boolean }).replayed).toBe(true);
    replayed = false;
  });

  test("UUID, empty query, idempotency, exact body, per-action scope and property grant fail before dispatch", async () => {
    calls.length = 0;
    const api = operator();
    const assign = CASES[0];
    for (const [action, request, propertyNode, reservationId, taskId, body, expected] of [
      ["assign", context("assign", [assign.scope], assign.body), "bad", RESERVATION, TASK, assign.body, 400],
      ["assign", context("assign", [assign.scope], assign.body), PROPERTY, "bad", TASK, assign.body, 400],
      ["assign", context("assign", [assign.scope], assign.body), PROPERTY, RESERVATION, "bad", assign.body, 400],
      ["assign", context("assign", [assign.scope], assign.body, true, IDEMPOTENCY, "?extra=1"), PROPERTY, RESERVATION, TASK, assign.body, 400],
      ["assign", context("assign", [assign.scope], assign.body, true, null), PROPERTY, RESERVATION, TASK, assign.body, 400],
      ["assign", context("assign", [assign.scope], assign.body, true, "short"), PROPERTY, RESERVATION, TASK, assign.body, 400],
      ["assign", context("assign", [], assign.body), PROPERTY, RESERVATION, TASK, assign.body, 403],
      ["assign", context("assign", ["stay-operations.pickup-tasks:work"], assign.body), PROPERTY, RESERVATION, TASK, assign.body, 403],
      ["start", context("start", ["stay-operations.pickup-tasks:dispatch"], CASES[1].body), PROPERTY, RESERVATION, TASK, CASES[1].body, 403],
      ["assign", context("assign", [assign.scope], assign.body, false), PROPERTY, RESERVATION, TASK, assign.body, 404],
    ] as const) {
      expect((await captured(api, request, action, body, propertyNode, reservationId, taskId)).status).toBe(expected);
    }
    for (const body of [
      {},
      { expectedTaskStatus: "assigned", expectedAssigneePartyId: null, staffPartyId: STAFF },
      { expectedTaskStatus: "open", expectedAssigneePartyId: STAFF, staffPartyId: STAFF },
      { expectedTaskStatus: "open", expectedAssigneePartyId: null },
      { expectedTaskStatus: "open", expectedAssigneePartyId: null, staffPartyId: "bad" },
      { expectedTaskStatus: "open", expectedAssigneePartyId: null, staffPartyId: STAFF, actorId: ACTOR },
    ]) {
      expect((await captured(
        api, context("assign", [assign.scope], body), "assign", body,
      )).status).toBe(400);
    }
    for (const [action, body] of [
      ["start", { expectedTaskStatus: "open", expectedAssigneePartyId: STAFF }],
      ["start", { expectedTaskStatus: "assigned", expectedAssigneePartyId: null }],
      ["start", { expectedTaskStatus: "assigned", expectedAssigneePartyId: STAFF, staffPartyId: STAFF }],
      ["complete", { expectedTaskStatus: "assigned", expectedAssigneePartyId: STAFF }],
      ["complete", { expectedTaskStatus: "in_progress", expectedAssigneePartyId: null }],
      ["complete", { expectedTaskStatus: "in_progress", expectedAssigneePartyId: STAFF, completedAt: null }],
    ] as const) {
      expect((await captured(
        api, context(action, ["stay-operations.pickup-tasks:work"], body), action, body,
      )).status).toBe(400);
    }
    expect(calls).toEqual([]);
  });

  test("domain validation, concealment and changed truth map to bounded no-store errors", async () => {
    const api = operator();
    const item = CASES[0];
    for (const [nextFailure, status, type] of [
      ["validation", 400, "request/invalid"],
      ["not-found", 404, "reservations/not_found"],
      ["conflict", 409, "reservations/conflict"],
    ] as const) {
      failure = nextFailure;
      const response = await captured(api, context(item.action, [item.scope], item.body), item.action, item.body);
      expect(response.status).toBe(status);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(await response.json()).toMatchObject({ status, type });
    }
    failure = null;
  });

  test("missing dispatch composition is contained and the app exposes only three exact POST routes", async () => {
    const item = CASES[0];
    expect((await captured(
      operator(false), context(item.action, [item.scope], item.body), item.action, item.body,
    )).status).toBe(503);
    const source = readFileSync(new URL("../src/app.ts", import.meta.url), "utf8");
    const base = "/api/v1/properties/:property/reservations/:reservation/arrival-pickup-task/:task";
    for (const action of ["assign", "start", "complete"]) {
      expect(source).toContain(`.post("${base}/${action}"`);
      for (const method of ["put", "patch", "delete"]) {
        expect(source).not.toContain(`.${method}("${base}/${action}"`);
      }
    }
  });
});
