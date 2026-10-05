import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import {
  ArrivalRoomCleaningConflictError,
  ArrivalRoomCleaningNotFoundError,
  ArrivalRoomCleaningValidationError,
  type ArrivalRoomCleaningCandidateInput,
  type ArrivalRoomCleaningCreateInput,
} from "../src/contexts/housekeeping";
import { AvailabilityService } from "../src/contexts/inventory";
import { LocalLoginService } from "../src/contexts/identity";
import { OperatorHttpApi } from "../src/http/operator";
import type { TenantRequestContext, Tx } from "../src/kernel";

const TENANT = "00000000-0000-0000-0000-000000022901";
const PROPERTY = "00000000-0000-0000-0000-000000022902";
const RESERVATION = "00000000-0000-0000-0000-000000022903";
const SPACE = "00000000-0000-0000-0000-000000022904";
const TASK = "00000000-0000-0000-0000-000000022905";
const ACTOR = "00000000-0000-0000-0000-000000022906";
const ATTENDANT = "00000000-0000-0000-0000-000000022907";
const CORRELATION = "00000000-0000-4000-8000-000000022908";
const IDEMPOTENCY = "order-229-arrival-cleaning";
const DUE_AT = "2026-09-20T14:00:00.000Z";

const candidateCalls: ArrivalRoomCleaningCandidateInput[] = [];
const createCalls: ArrivalRoomCleaningCreateInput[] = [];
let existingTaskId: string | null = null;
let created = true;
let replayed = false;
let failure: "validation" | "not-found" | "conflict" | null = null;

const cleaning = {
  async candidate(input: ArrivalRoomCleaningCandidateInput) {
    candidateCalls.push(input);
    if (failure === "validation") throw new ArrivalRoomCleaningValidationError("invalid");
    if (failure === "not-found") throw new ArrivalRoomCleaningNotFoundError("concealed");
    if (failure === "conflict") throw new ArrivalRoomCleaningConflictError("stale");
    return Object.freeze({
      reservationId: RESERVATION,
      spaceId: SPACE,
      spaceCode: "101",
      roomCondition: "dirty" as const,
      dueAt: DUE_AT,
      existingTaskId,
    });
  },
  async create(input: ArrivalRoomCleaningCreateInput) {
    createCalls.push(input);
    if (failure === "validation") throw new ArrivalRoomCleaningValidationError("invalid");
    if (failure === "not-found") throw new ArrivalRoomCleaningNotFoundError("concealed");
    if (failure === "conflict") throw new ArrivalRoomCleaningConflictError("stale");
    return Object.freeze({
      taskId: TASK,
      reservationId: RESERVATION,
      spaceId: SPACE,
      roomCondition: "dirty" as const,
      attendantPartyId: ATTENDANT,
      dueAt: DUE_AT,
      created,
      replayed,
    });
  },
};

function operator(withCleaning = true): OperatorHttpApi {
  const args = [
    {} as LocalLoginService,
    {} as AvailabilityService,
    ...Array.from({ length: 36 }, () => undefined),
    withCleaning ? cleaning : undefined,
  ] as unknown as ConstructorParameters<typeof OperatorHttpApi>;
  return new OperatorHttpApi(...args);
}

function context(
  method: "GET" | "POST",
  suffix: string,
  scopes: readonly string[],
  granted = true,
  body?: unknown,
  idempotencyKey: string | null = null,
): TenantRequestContext {
  const tx = (() => Promise.resolve(granted
    ? [{ id: PROPERTY, name: "Hotel", timezone: "UTC", currency: "USD" }]
    : [])) as unknown as Tx;
  const headers = new Headers({
    "content-type": "application/json",
    "x-correlation-id": CORRELATION,
  });
  if (idempotencyKey !== null) headers.set("idempotency-key", idempotencyKey);
  return {
    tenantId: TENANT,
    request: new Request(
      `http://yellow.test/api/v1/properties/${PROPERTY}/reservations/${RESERVATION}/arrival-room-cleaning-task${suffix}`,
      { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) },
    ),
    tx,
    identity: { tenantId: TENANT, actorId: ACTOR, scopes },
  };
}

async function capturedCandidate(
  api: OperatorHttpApi,
  request: TenantRequestContext,
  propertyNode = PROPERTY,
  reservationId = RESERVATION,
): Promise<Response> {
  try {
    return await api.arrivalRoomCleaningCandidate(request, propertyNode, reservationId);
  } catch (error) {
    return api.failure(request.request, error);
  }
}

async function capturedCreate(
  api: OperatorHttpApi,
  request: TenantRequestContext,
  body: unknown,
  propertyNode = PROPERTY,
  reservationId = RESERVATION,
): Promise<Response> {
  try {
    return await api.createArrivalRoomCleaningTask(request, propertyNode, reservationId, body);
  } catch (error) {
    return api.failure(request.request, error);
  }
}

describe("Order229 exact arrival room-cleaning task HTTP", () => {
  test("candidate GET is no-store, minimized and exposes create authority only for the exact property", async () => {
    candidateCalls.length = 0;
    failure = null;
    existingTaskId = null;
    const api = operator();
    const response = await capturedCandidate(api, context("GET", "/candidate", [
      "housekeeping.arrival-tasks:read", "housekeeping.arrival-tasks:create",
    ]));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      canCreate: true,
      candidate: {
        dueAt: DUE_AT,
        existingTaskId: null,
        reservationId: RESERVATION,
        roomCondition: "dirty",
        spaceCode: "101",
        spaceId: SPACE,
      },
    });
    expect(candidateCalls).toEqual([{
      tenantId: TENANT,
      propertyNode: PROPERTY,
      reservationId: RESERVATION,
      actorId: ACTOR,
    }]);

    const readOnly = await capturedCandidate(api, context("GET", "/candidate", [
      "housekeeping.arrival-tasks:read",
    ]));
    expect((await readOnly.json() as { canCreate: boolean }).canCreate).toBe(false);

    existingTaskId = TASK;
    const existing = await capturedCandidate(api, context("GET", "/candidate", [
      "housekeeping.arrival-tasks:read", "housekeeping.arrival-tasks:create",
    ]));
    expect(await existing.json()).toMatchObject({ canCreate: false, candidate: { existingTaskId: TASK } });
    existingTaskId = null;
  });

  test("candidate UUID, empty query, read scope and exact-property grant fail before service access", async () => {
    candidateCalls.length = 0;
    const api = operator();
    expect((await capturedCandidate(api, context("GET", "/candidate", ["housekeeping.arrival-tasks:read"]), "bad")).status).toBe(400);
    expect((await capturedCandidate(api, context("GET", "/candidate", ["housekeeping.arrival-tasks:read"]), PROPERTY, "bad")).status).toBe(400);
    expect((await capturedCandidate(api, context("GET", "/candidate?extra=1", ["housekeeping.arrival-tasks:read"]))).status).toBe(400);
    expect((await capturedCandidate(api, context("GET", "/candidate", []))).status).toBe(403);
    expect((await capturedCandidate(api, context("GET", "/candidate", ["housekeeping.arrival-tasks:read"], false))).status).toBe(404);
    expect(candidateCalls).toEqual([]);
  });

  test("create POST is actor-bound and distinguishes creation from existing-task convergence", async () => {
    createCalls.length = 0;
    failure = null;
    created = true;
    replayed = false;
    const body = { attendantPartyId: ATTENDANT };
    const response = await capturedCreate(operator(), context(
      "POST", "", ["housekeeping.arrival-tasks:create"], true, body, IDEMPOTENCY,
    ), body);
    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("idempotency-replayed")).toBe("false");
    expect(response.headers.get("x-correlation-id")).toBe(CORRELATION);
    expect(await response.json()).toEqual({
      attendantPartyId: ATTENDANT,
      created: true,
      dueAt: DUE_AT,
      replayed: false,
      reservationId: RESERVATION,
      roomCondition: "dirty",
      spaceId: SPACE,
      taskId: TASK,
    });
    expect(createCalls).toHaveLength(1);
    expect(createCalls[0]).toMatchObject({
      tenantId: TENANT,
      propertyNode: PROPERTY,
      reservationId: RESERVATION,
      attendantPartyId: ATTENDANT,
      idempotencyKey: IDEMPOTENCY,
      envelope: {
        actorId: ACTOR,
        tenantId: TENANT,
        propertyNode: PROPERTY,
        requestId: CORRELATION,
        operation: "task.created",
      },
    });

    created = false;
    replayed = true;
    const existing = await capturedCreate(operator(), context(
      "POST", "", ["housekeeping.arrival-tasks:create"], true, body, IDEMPOTENCY,
    ), body);
    expect(existing.status).toBe(200);
    expect(existing.headers.get("idempotency-replayed")).toBe("true");
    expect(await existing.json()).toMatchObject({ created: false, replayed: true, taskId: TASK });
    created = true;
    replayed = false;
  });

  test("create rejects hostile UUID, query, body, idempotency, scope and property truth before service access", async () => {
    createCalls.length = 0;
    const api = operator();
    const valid = { attendantPartyId: ATTENDANT };
    for (const body of [
      {},
      { attendantPartyId: "bad" },
      { attendantPartyId: ATTENDANT, actorId: ACTOR },
      { attendantPartyId: ATTENDANT, reservationId: RESERVATION },
      { attendantPartyId: ATTENDANT, taskId: TASK },
    ]) {
      expect((await capturedCreate(api, context(
        "POST", "", ["housekeeping.arrival-tasks:create"], true, body, IDEMPOTENCY,
      ), body)).status).toBe(400);
    }
    expect((await capturedCreate(api, context("POST", "", ["housekeeping.arrival-tasks:create"], true, valid), valid)).status).toBe(400);
    expect((await capturedCreate(api, context("POST", "", ["housekeeping.arrival-tasks:create"], true, valid, "short"), valid)).status).toBe(400);
    expect((await capturedCreate(api, context("POST", "", ["housekeeping.arrival-tasks:create"], true, valid, IDEMPOTENCY), valid, "bad")).status).toBe(400);
    expect((await capturedCreate(api, context("POST", "", ["housekeeping.arrival-tasks:create"], true, valid, IDEMPOTENCY), valid, PROPERTY, "bad")).status).toBe(400);
    expect((await capturedCreate(api, context("POST", "?extra=1", ["housekeeping.arrival-tasks:create"], true, valid, IDEMPOTENCY), valid)).status).toBe(400);
    expect((await capturedCreate(api, context("POST", "", [], true, valid, IDEMPOTENCY), valid)).status).toBe(403);
    expect((await capturedCreate(api, context("POST", "", ["housekeeping.arrival-tasks:read"], true, valid, IDEMPOTENCY), valid)).status).toBe(403);
    expect((await capturedCreate(api, context("POST", "", ["housekeeping.arrival-tasks:create"], false, valid, IDEMPOTENCY), valid)).status).toBe(404);
    expect(createCalls).toEqual([]);
  });

  test("bounded domain failures map to no-store errors and missing composition is contained", async () => {
    const api = operator();
    const body = { attendantPartyId: ATTENDANT };
    for (const [nextFailure, status, type] of [
      ["validation", 400, "request/invalid"],
      ["not-found", 404, "housekeeping/not_found"],
      ["conflict", 409, "housekeeping/conflict"],
    ] as const) {
      failure = nextFailure;
      const response = await capturedCreate(api, context(
        "POST", "", ["housekeeping.arrival-tasks:create"], true, body, IDEMPOTENCY,
      ), body);
      expect(response.status).toBe(status);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(await response.json()).toMatchObject({ status, type });
    }
    failure = null;
    expect((await capturedCandidate(operator(false), context(
      "GET", "/candidate", ["housekeeping.arrival-tasks:read"],
    ))).status).toBe(503);
    expect((await capturedCreate(operator(false), context(
      "POST", "", ["housekeeping.arrival-tasks:create"], true, body, IDEMPOTENCY,
    ), body)).status).toBe(503);
  });

  test("the application exposes only the exact candidate GET and create POST", () => {
    const app = readFileSync(new URL("../src/app.ts", import.meta.url), "utf8");
    const base = "/api/v1/properties/:property/reservations/:reservation/arrival-room-cleaning-task";
    expect(app).toContain(`.get("${base}/candidate"`);
    expect(app).toContain(`.post("${base}"`);
    for (const method of ["put", "patch", "delete"]) {
      expect(app).not.toContain(`.${method}("${base}`);
    }
  });
});
