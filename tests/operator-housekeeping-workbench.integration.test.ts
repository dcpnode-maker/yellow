import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { createApp } from "../src/app";
import { AvailabilityService } from "../src/contexts/inventory";
import { LocalLoginService } from "../src/contexts/identity";
import { OperatorHttpApi } from "../src/http/operator";
import type { TenantRequestContext, Tx } from "../src/kernel";

const TENANT = "00000000-0000-0000-0000-000000021001";
const PROPERTY = "00000000-0000-0000-0000-000000021002";
const ACTOR = "00000000-0000-0000-0000-000000021003";
const TASK_START = "00000000-0000-0000-0000-000000021011";
const TASK_COMPLETE = "00000000-0000-0000-0000-000000021012";
const TASK_VERIFY = "00000000-0000-0000-0000-000000021013";
const SPACE = "00000000-0000-0000-0000-000000021020";
const UPDATED_AT = "2026-08-28T04:30:00.000Z";

const calls: Array<{ readonly method: string; readonly input: unknown }> = [];
const housekeeping = {
  async listBoard(input: unknown) {
    calls.push({ method: "listBoard", input });
    return [
      { taskId: TASK_START, taskStatus: "assigned" as const, spaceId: SPACE, spaceCode: "101", floor: "1",
        roomCondition: "dirty" as const, roomUpdatedAt: UPDATED_AT, assigneePartyId: ACTOR,
        dueAt: null, priority: 10, completedAt: null, eligibleAction: "start" as const },
      { taskId: TASK_COMPLETE, taskStatus: "in_progress" as const, spaceId: SPACE, spaceCode: "102", floor: "1",
        roomCondition: "pickup" as const, roomUpdatedAt: UPDATED_AT, assigneePartyId: ACTOR,
        dueAt: null, priority: 20, completedAt: null, eligibleAction: "complete" as const },
      { taskId: TASK_VERIFY, taskStatus: "done" as const, spaceId: SPACE, spaceCode: "103", floor: "1",
        roomCondition: "clean" as const, roomUpdatedAt: UPDATED_AT, assigneePartyId: ACTOR,
        dueAt: null, priority: 30, completedAt: UPDATED_AT, eligibleAction: "verify" as const },
    ];
  },
  async transition(input: unknown) {
    calls.push({ method: "transition", input });
    const command = input as { readonly taskId: string; readonly action: "start" | "complete" | "verify" };
    return { taskId: command.taskId, taskStatus: "in_progress" as const, spaceId: SPACE,
      roomCondition: "dirty" as const, roomUpdatedAt: UPDATED_AT, completedAt: null,
      action: command.action, eligibleAction: "complete" as const, replayed: false };
  },
};

const api = new OperatorHttpApi(
  {} as LocalLoginService, {} as AvailabilityService,
  undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
  undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
  undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
  undefined, undefined, undefined, undefined, undefined, housekeeping,
);

function context(path: string, scopes: readonly string[], granted = true, body?: unknown): TenantRequestContext {
  const tx = (() => Promise.resolve(granted
    ? [{ id: PROPERTY, name: "Hotel", timezone: "UTC", currency: "USD" }] : [])) as unknown as Tx;
  return {
    tenantId: TENANT,
    request: new Request(`http://yellow.test${path}`, body === undefined ? undefined : {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": "housekeeping-attempt-0001" },
      body: JSON.stringify(body),
    }),
    tx,
    identity: { tenantId: TENANT, actorId: ACTOR, scopes },
  };
}

describe("Order 201 operator housekeeping authority", () => {
  test("board is no-store, concealed and exposes only server-filtered allowed actions", async () => {
    calls.length = 0;
    const readWork = ["housekeeping.tasks:read", "housekeeping.tasks:work"];
    const response = await api.housekeepingBoard(context(`/x?limit=200`, readWork), PROPERTY);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json() as { tasks: Array<Record<string, unknown>> };
    expect(body.tasks.map((task) => task.allowedActions)).toEqual([["start"], ["complete"], []]);
    expect(JSON.stringify(body)).not.toContain("assigneePartyId");
    expect(body.tasks[0]?.assigned).toBe(true);
    expect(calls).toEqual([{ method: "listBoard", input: { tenantId: TENANT, propertyNode: PROPERTY, limit: 200 } }]);
    expect((await api.housekeepingBoard(context("/x", [], true), PROPERTY)).status).toBe(403);
    expect((await api.housekeepingBoard(context("/x", ["housekeeping.tasks:read"], false), PROPERTY)).status).toBe(404);
    expect((await api.housekeepingBoard(context("/x?limit=201", readWork), PROPERTY)).status).toBe(400);

    const inspect = await api.housekeepingBoard(
      context("/x", ["housekeeping.tasks:read", "housekeeping.tasks:inspect"]), PROPERTY,
    );
    expect((await inspect.json() as { tasks: Array<{ allowedActions: string[] }> }).tasks.map((task) => task.allowedActions))
      .toEqual([[], [], ["verify"]]);
  });

  test("transition derives work versus inspect authority and forwards only bound evidence", async () => {
    calls.length = 0;
    const start = { action: "start", expectedTaskStatus: "assigned", expectedRoomCondition: "dirty", expectedRoomUpdatedAt: UPDATED_AT };
    const response = await api.transitionHousekeepingTask(
      context("/x", ["housekeeping.tasks:work"], true, start), PROPERTY, TASK_START, start,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(calls[0]).toMatchObject({ method: "transition", input: {
      tenantId: TENANT, propertyNode: PROPERTY, taskId: TASK_START, ...start,
      idempotencyKey: "housekeeping-attempt-0001",
      envelope: { actorId: ACTOR, tenantId: TENANT, propertyNode: PROPERTY, operation: "task.status_changed" },
    } });

    const verify = { action: "verify", expectedTaskStatus: "done", expectedRoomCondition: "clean", expectedRoomUpdatedAt: UPDATED_AT };
    expect((await api.transitionHousekeepingTask(
      context("/x", ["housekeeping.tasks:work"], true, verify), PROPERTY, TASK_VERIFY, verify,
    )).status).toBe(403);
    expect((await api.transitionHousekeepingTask(
      context("/x", ["housekeeping.tasks:inspect"], true, verify), PROPERTY, TASK_VERIFY, verify,
    )).status).toBe(200);
    expect((await api.transitionHousekeepingTask(
      context("/x", ["housekeeping.tasks:inspect"], false, verify), PROPERTY, TASK_VERIFY, verify,
    )).status).toBe(404);
  });

  test("browser authority, target state and malformed stale evidence fail closed", async () => {
    calls.length = 0;
    const scope = ["housekeeping.tasks:work"];
    for (const body of [
      { action: "start", expectedTaskStatus: "assigned", expectedRoomCondition: "dirty", expectedRoomUpdatedAt: UPDATED_AT, targetStatus: "verified" },
      { action: "start", expectedTaskStatus: "assigned", expectedRoomCondition: "dirty", expectedRoomUpdatedAt: UPDATED_AT, actorId: ACTOR },
      { action: "complete", expectedTaskStatus: "assigned", expectedRoomCondition: "dirty", expectedRoomUpdatedAt: UPDATED_AT },
      { action: "start", expectedTaskStatus: "assigned", expectedRoomCondition: "dirty", expectedRoomUpdatedAt: "2026-08-28T04:30:00Z" },
    ]) expect((await api.transitionHousekeepingTask(context("/x", scope, true, body), PROPERTY, TASK_START, body)).status).toBe(400);
    expect(calls).toEqual([]);
  });
});

const html = readFileSync(new URL("../src/http/operator/index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/http/operator/operator.css", import.meta.url), "utf8");
const script = readFileSync(new URL("../src/http/operator/operator.js", import.meta.url), "utf8");

test("Order 201 workbench is bounded, stale-safe, retry-safe and accessible in six appearances", () => {
  for (const marker of [
    'data-view="housekeeping"', 'id="housekeeping-view" hidden', 'id="housekeeping-title" tabindex="-1"',
    'id="housekeeping-refresh"', 'id="housekeeping-retry"', 'id="housekeeping-status" role="status" aria-live="polite"',
  ]) expect(html).toContain(marker);
  expect(html).toContain("does not create, assign, cancel or reopen tasks");
  expect(script).toContain(String.raw`(/^\/p\/[0-9a-f-]+\/housekeeping(?:\/tasks\/[0-9a-f-]+)?$/.test(location.pathname)) ? "housekeeping"`);
  expect(script).toContain('location.pathname === `/p/${property}/housekeeping`');
  expect(script).toContain("generation === housekeepingGeneration");
  expect(script).toContain("requestGeneration === housekeepingRequestGeneration");
  expect(script).toContain("housekeepingAttempts.get(taskId)");
  expect(script).toContain("existing?.draft === draft ? existing");
  expect(script).toContain('headers: { "idempotency-key": attempt.key }');
  expect(script).toContain('error?.status === 409');
  expect(script).toContain("housekeepingReturnFocus = taskId");
  expect(script).toContain("(control || $(\"#housekeeping-title\")).focus");
  expect(script).toContain("allowedActions.slice(0, 1)");
  expect(script).not.toMatch(/housekeeping[\s\S]{0,1200}(?:targetStatus|assigneePartyId|localStorage|sessionStorage)/);
  for (const theme of ["apple", "android", "win95", "glass", "neo", "erp"]) {
    expect(css).toContain(`:root[data-theme="${theme}"] .housekeeping-task-card`);
  }
  expect(css).toContain(".housekeeping-action { width: 100%; min-height: 44px;");
  expect(css).toContain("prefers-reduced-motion: reduce");
  expect(css).toContain(".housekeeping-loading span");
});

test("Order 201 housekeeping deep link serves only the exact workbench path", async () => {
  const app = createApp({ operatorApi: new OperatorHttpApi({} as never) });
  const response = await app.handle(new Request(`http://yellow.test/p/${PROPERTY}/housekeeping`));
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toContain("text/html");
  expect(await response.text()).toBe(html);
  expect((await app.handle(new Request(`http://yellow.test/p/${PROPERTY}/housekeeping/extra`))).status).toBe(404);
});
