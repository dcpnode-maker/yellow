import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { AvailabilityService } from "../src/contexts/inventory";
import { LocalLoginService } from "../src/contexts/identity";
import { OperatorHttpApi } from "../src/http/operator";
import type { TenantRequestContext, Tx } from "../src/kernel";

const TENANT = "00000000-0000-0000-0000-000000227001";
const PROPERTY = "00000000-0000-0000-0000-000000227002";
const ACTOR = "00000000-0000-0000-0000-000000227003";
const SPACE = "00000000-0000-0000-0000-000000227004";
const IDEMPOTENCY_KEY = "00000000-0000-4000-8000-000000227005";
const UPDATED_AT = "2026-08-28T18:30:00.123456Z";

const candidateCalls: unknown[] = [];
const initializeCalls: unknown[] = [];
let replayed = false;

const housekeeping = {
  async listBoard() { return []; },
  async transition(): Promise<never> { throw new Error("not used"); },
  async listConditions() { return { rooms: [], nextCursor: null }; },
  async getInitialConditionCandidate(input: unknown) {
    candidateCalls.push(input);
    return Object.freeze({
      spaceId: SPACE,
      code: "101",
      floor: "1",
      roomCondition: null,
    });
  },
  async initializeCondition(input: unknown) {
    initializeCalls.push(input);
    const roomCondition = (input as { roomCondition?: unknown }).roomCondition;
    return Object.freeze({
      spaceId: SPACE,
      roomCondition,
      updatedAt: UPDATED_AT,
      replayed,
    });
  },
};

function operator(): OperatorHttpApi {
  return new OperatorHttpApi(
    {} as LocalLoginService,
    {} as AvailabilityService,
    undefined, undefined, undefined, undefined, undefined, undefined, undefined,
    undefined, undefined, undefined, undefined, undefined, undefined, undefined,
    undefined, undefined, undefined, undefined, undefined, undefined, undefined,
    undefined, undefined, undefined, undefined, undefined, undefined, undefined,
    undefined, undefined,
    housekeeping,
  );
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
  const headers = new Headers({ "content-type": "application/json" });
  if (idempotencyKey !== null) headers.set("idempotency-key", idempotencyKey);
  return {
    tenantId: TENANT,
    request: new Request(
      `http://yellow.test/api/v1/properties/${PROPERTY}/housekeeping/conditions/${SPACE}${suffix}`,
      { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) },
    ),
    tx,
    identity: { tenantId: TENANT, actorId: ACTOR, scopes },
  };
}

type ConditionIngressApi = OperatorHttpApi & {
  housekeepingInitialConditionCandidate(
    context: TenantRequestContext,
    propertyNode: string,
    spaceId: string,
  ): Promise<Response>;
  initializeHousekeepingCondition(
    context: TenantRequestContext,
    propertyNode: string,
    spaceId: string,
    body: unknown,
  ): Promise<Response>;
};

function ingressApi(): ConditionIngressApi {
  return operator() as ConditionIngressApi;
}

describe("Order227 exact missing-room condition ingress HTTP", () => {
  test("candidate GET is no-store, read-authorized, exact-room and minimized", async () => {
    candidateCalls.length = 0;
    const response = await ingressApi().housekeepingInitialConditionCandidate(
      context("GET", "/candidate", ["housekeeping.tasks:read", "housekeeping.conditions:initialize"]),
      PROPERTY,
      SPACE,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      candidate: {
        allowedInitialConditions: ["clean", "dirty", "pickup"],
        code: "101",
        floor: "1",
        roomCondition: null,
        spaceId: SPACE,
      },
    });
    expect(candidateCalls).toEqual([{ tenantId: TENANT, propertyNode: PROPERTY, spaceId: SPACE }]);

    const readOnly = await ingressApi().housekeepingInitialConditionCandidate(
      context("GET", "/candidate", ["housekeeping.tasks:read"]),
      PROPERTY,
      SPACE,
    );
    expect((await readOnly.json() as { candidate: { allowedInitialConditions: unknown[] } })
      .candidate.allowedInitialConditions).toEqual([]);
  });

  test("candidate UUID, query, read scope and exact property grant fail before its service", async () => {
    candidateCalls.length = 0;
    const api = ingressApi();
    expect((await api.housekeepingInitialConditionCandidate(
      context("GET", "/candidate", ["housekeeping.tasks:read"]), "bad", SPACE,
    )).status).toBe(400);
    expect((await api.housekeepingInitialConditionCandidate(
      context("GET", "/candidate", ["housekeeping.tasks:read"]), PROPERTY, "bad",
    )).status).toBe(400);
    expect((await api.housekeepingInitialConditionCandidate(
      context("GET", "/candidate?extra=1", ["housekeeping.tasks:read"]), PROPERTY, SPACE,
    )).status).toBe(400);
    expect((await api.housekeepingInitialConditionCandidate(
      context("GET", "/candidate", []), PROPERTY, SPACE,
    )).status).toBe(403);
    expect((await api.housekeepingInitialConditionCandidate(
      context("GET", "/candidate", ["housekeeping.tasks:read"], false), PROPERTY, SPACE,
    )).status).toBe(404);
    expect(candidateCalls).toEqual([]);
  });

  test("POST accepts only the absence expectation and one allowed literal with exact initialize authority", async () => {
    initializeCalls.length = 0;
    replayed = false;
    const request = context(
      "POST",
      "/initialize",
      ["housekeeping.conditions:initialize"],
      true,
      { expectedRoomCondition: null, roomCondition: "clean" },
      IDEMPOTENCY_KEY,
    );
    const response = await ingressApi().initializeHousekeepingCondition(
      request,
      PROPERTY,
      SPACE,
      { expectedRoomCondition: null, roomCondition: "clean" },
    );
    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("idempotency-replayed")).toBe("false");
    expect(response.headers.get("x-correlation-id")).toMatch(/^[0-9a-f-]{36}$/);
    expect(await response.json()).toEqual({
      replayed: false,
      roomCondition: "clean",
      spaceId: SPACE,
      updatedAt: UPDATED_AT,
    });
    expect(initializeCalls).toHaveLength(1);
    expect(initializeCalls[0]).toMatchObject({
      tenantId: TENANT,
      propertyNode: PROPERTY,
      spaceId: SPACE,
      expectedRoomCondition: null,
      roomCondition: "clean",
      idempotencyKey: IDEMPOTENCY_KEY,
      envelope: { actorId: ACTOR, tenantId: TENANT, propertyNode: PROPERTY },
    });
  });

  test("exact replay keeps the canonical receipt and replay header", async () => {
    initializeCalls.length = 0;
    replayed = true;
    const body = { expectedRoomCondition: null, roomCondition: "pickup" };
    const response = await ingressApi().initializeHousekeepingCondition(
      context("POST", "/initialize", ["housekeeping.conditions:initialize"], true, body, IDEMPOTENCY_KEY),
      PROPERTY,
      SPACE,
      body,
    );
    expect(response.status).toBe(201);
    expect(response.headers.get("idempotency-replayed")).toBe("true");
    expect((await response.json() as { replayed: boolean }).replayed).toBe(true);
  });

  test("POST rejects hostile body, inspected, missing idempotency, wrong authority and concealed property", async () => {
    initializeCalls.length = 0;
    const api = ingressApi();
    const valid = { expectedRoomCondition: null, roomCondition: "dirty" };
    for (const body of [
      {},
      { roomCondition: "clean" },
      { expectedRoomCondition: "clean", roomCondition: "dirty" },
      { expectedRoomCondition: null, roomCondition: "inspected" },
      { expectedRoomCondition: null, roomCondition: "ready" },
      { expectedRoomCondition: null, roomCondition: "clean", actorId: ACTOR },
      { expectedRoomCondition: null, roomCondition: "clean", updatedAt: UPDATED_AT },
    ]) {
      expect((await api.initializeHousekeepingCondition(
        context("POST", "/initialize", ["housekeeping.conditions:initialize"], true, body, IDEMPOTENCY_KEY),
        PROPERTY, SPACE, body,
      )).status).toBe(400);
    }
    expect((await api.initializeHousekeepingCondition(
      context("POST", "/initialize", ["housekeeping.conditions:initialize"], true, valid),
      PROPERTY, SPACE, valid,
    )).status).toBe(400);
    expect((await api.initializeHousekeepingCondition(
      context("POST", "/initialize", ["housekeeping.conditions:initialize"], true, valid, "not-a-key"),
      PROPERTY, SPACE, valid,
    )).status).toBe(400);
    expect((await api.initializeHousekeepingCondition(
      context("POST", "/initialize", ["housekeeping.conditions:initialize"], true, valid, IDEMPOTENCY_KEY),
      "bad", SPACE, valid,
    )).status).toBe(400);
    expect((await api.initializeHousekeepingCondition(
      context("POST", "/initialize", ["housekeeping.conditions:initialize"], true, valid, IDEMPOTENCY_KEY),
      PROPERTY, "bad", valid,
    )).status).toBe(400);
    expect((await api.initializeHousekeepingCondition(
      context("POST", "/initialize?extra=1", ["housekeeping.conditions:initialize"], true, valid, IDEMPOTENCY_KEY),
      PROPERTY, SPACE, valid,
    )).status).toBe(400);
    expect((await api.initializeHousekeepingCondition(
      context("POST", "/initialize", [], true, valid, IDEMPOTENCY_KEY),
      PROPERTY, SPACE, valid,
    )).status).toBe(403);
    expect((await api.initializeHousekeepingCondition(
      context("POST", "/initialize", ["housekeeping.conditions:initialize"], false, valid, IDEMPOTENCY_KEY),
      PROPERTY, SPACE, valid,
    )).status).toBe(404);
    expect(initializeCalls).toEqual([]);
  });

  test("the application exposes only the exact candidate GET and initialize POST", () => {
    const app = readFileSync(new URL("../src/app.ts", import.meta.url), "utf8");
    const candidate = "/api/v1/properties/:property/housekeeping/conditions/:space/candidate";
    const initialize = "/api/v1/properties/:property/housekeeping/conditions/:space/initialize";
    expect(app).toContain(`.get("${candidate}"`);
    expect(app).toContain(`.post("${initialize}"`);
    for (const verb of ["put", "patch", "delete"]) {
      expect(app).not.toContain(`.${verb}("${initialize}"`);
      expect(app).not.toContain(`.${verb}("${candidate}"`);
    }
  });
});
