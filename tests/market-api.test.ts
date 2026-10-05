import { describe, expect, test } from "bun:test";

import { createApp } from "../src/app";
import { MarketHttpApi } from "../src/http/market";
import type { Database, ExtensionRegistry, TenantIdentity, TenantResolver, Tx } from "../src/kernel";

const TENANT = "00000000-0000-0000-0000-000000000001";
const ACTOR = "00000000-0000-0000-0000-000000000960";
const PROPERTY = "00000000-0000-0000-0000-000000000012";
const READ = "distribution.market:read";
const WRITE = "distribution.market:write";

type MarketMethod = "discovery" | "current" | "suggestIdentity" | "previewPlan" | "properties" | "confirm";

interface Calls {
  readonly discovery: Array<readonly unknown[]>;
  readonly current: Array<readonly unknown[]>;
  readonly suggestIdentity: Array<readonly unknown[]>;
  readonly previewPlan: Array<readonly unknown[]>;
  readonly properties: Array<readonly unknown[]>;
  readonly confirm: Array<readonly unknown[]>;
}

function result(value: unknown): unknown {
  return Object.freeze({ ok: true, value });
}

function failed(code: "invalid_input" | "forbidden" | "conflict" | "invalid_state" | "unavailable"): unknown {
  return Object.freeze({ ok: false, error: Object.freeze({ code, message: "Market competitor-set operation could not be completed." }) });
}

function marketApi(outcomes: Partial<Record<MarketMethod, unknown>> = {}): { readonly api: MarketHttpApi; readonly calls: Calls } {
  const calls: Calls = { discovery: [], current: [], suggestIdentity: [], previewPlan: [], properties: [], confirm: [] };
  const service = {
    async discovery(...args: unknown[]): Promise<unknown> {
      calls.discovery.push(Object.freeze(args));
      return outcomes.discovery ?? result(Object.freeze({ snapshots: [] }));
    },
    async current(...args: unknown[]): Promise<unknown> {
      calls.current.push(Object.freeze(args));
      return outcomes.current ?? result(null);
    },
    async suggestIdentity(...args: unknown[]): Promise<unknown> {
      calls.suggestIdentity.push(Object.freeze(args));
      return outcomes.suggestIdentity ?? result(Object.freeze({ snapshot: Object.freeze({ logicalId: "riyadh", sha256: "a".repeat(64) }),
        requiresConfirmation: true, ambiguous: false, candidates: Object.freeze([]) }));
    },
    async previewPlan(...args: unknown[]): Promise<unknown> {
      calls.previewPlan.push(Object.freeze(args));
      return outcomes.previewPlan ?? result(Object.freeze({ previewOnly: true, executable: false }));
    },
    async properties(...args: unknown[]): Promise<unknown> {
      calls.properties.push(Object.freeze(args));
      return outcomes.properties ?? result(Object.freeze({ properties: Object.freeze([]), nextCursor: null }));
    },
    async confirm(...args: unknown[]): Promise<unknown> {
      calls.confirm.push(Object.freeze(args));
      return outcomes.confirm ?? result(Object.freeze({ version: Object.freeze({ extensionId: "00000000-0000-0000-0000-000000000301", version: 1, content: {} }), replayed: false }));
    },
  };
  return { api: new MarketHttpApi(service as never), calls };
}

function database(onFailure?: () => void): Database {
  return {
    async withTenantTransaction<T>(_tenantId: string, operation: (tx: Tx) => Promise<T>): Promise<T> {
      try {
        return await operation({} as Tx);
      } catch (error) {
        onFailure?.();
        throw error;
      }
    },
  } as unknown as Database;
}

function resolver(scopes: readonly string[], actorId: string | undefined = ACTOR): TenantResolver {
  const identity: TenantIdentity = Object.freeze({ tenantId: TENANT, ...(actorId === undefined ? {} : { actorId }), scopes: Object.freeze([...scopes]) });
  return Object.freeze({ async resolve(): Promise<TenantIdentity> { return identity; } });
}

function request(path: string, init: RequestInit = {}): Request {
  return new Request(`http://yellow.test${path}`, {
    ...init,
    headers: {
      "x-correlation-id": "00000000-0000-0000-0000-000000000777",
      ...init.headers,
    },
  });
}

describe("Order472 market HTTP adapter", () => {
  test("preserves the existing property-scoped read routes and forwards verified read context", async () => {
    const { api, calls } = marketApi();
    const app = createApp({ database: database(), tenantResolver: resolver([READ]), marketApi: api });
    const discovery = await app.handle(request(`/api/v1/properties/${PROPERTY}/market/discovery`));
    const current = await app.handle(request(`/api/v1/properties/${PROPERTY}/market/compset`));
    expect(discovery.status).toBe(200);
    expect(await discovery.json()).toEqual({ discovery: { snapshots: [] } });
    expect(current.status).toBe(200);
    expect(await current.json()).toEqual({ compset: null });
    expect(calls.discovery).toHaveLength(1);
    expect(calls.current).toHaveLength(1);
    expect(calls.discovery[0]?.[1]).toMatchObject({ tenantId: TENANT, actorId: ACTOR, propertyNode: PROPERTY,
      requestId: "00000000-0000-0000-0000-000000000777", scopes: [READ] });
    expect(discovery.headers.get("cache-control")).toBe("no-store");
    expect(discovery.headers.get("x-correlation-id")).toBe("00000000-0000-0000-0000-000000000777");
  });

  test("Q267 forwards exact identity and preview bodies, with a separate market-only navigation principal", async () => {
    const identity = Object.freeze({ snapshot: Object.freeze({ logicalId: "riyadh", sha256: "a".repeat(64) }),
      target: Object.freeze({ recordId: "overture-identity-1" }) });
    const preview = Object.freeze({ expectedCompset: Object.freeze({ extensionId: "00000000-0000-0000-0000-000000000301", version: 2 }),
      comparatorIndexes: Object.freeze([0]), conditions: Object.freeze({ destination: "DXB", lookaheadMonths: 1,
        selectedSources: Object.freeze(["official-api"]), guests: Object.freeze({ rooms: 1, adults: 2, childAges: Object.freeze([]) }),
        pointOfSaleMarket: "AE", language: "en", lengthsOfStayNights: Object.freeze([1]) }) });
    const cursor = Buffer.from(PROPERTY, "utf8").toString("base64url");
    const { api, calls } = marketApi({
      suggestIdentity: result(Object.freeze({ snapshot: identity.snapshot, requiresConfirmation: true, ambiguous: true, candidates: Object.freeze([]) })),
      previewPlan: result(Object.freeze({ previewOnly: true, executable: false, sample: Object.freeze([]) })),
      properties: result(Object.freeze({ properties: Object.freeze([Object.freeze({ id: PROPERTY, name: "Market-only hotel", timezone: "Asia/Dubai", currency: "AED" })]), nextCursor: null })),
    });
    const app = createApp({ database: database(), tenantResolver: resolver([READ]), marketApi: api });
    const base = `/api/v1/properties/${PROPERTY}/market`;
    const headers = { "content-type": "application/json" };
    const [suggestion, plan, page] = await Promise.all([
      app.handle(request(`${base}/identity/suggest`, { method: "POST", headers, body: JSON.stringify(identity) })),
      app.handle(request(`${base}/plan/preview`, { method: "POST", headers, body: JSON.stringify(preview) })),
      app.handle(request(`/api/v1/me/market-properties?cursor=${cursor}`)),
    ]);
    expect(suggestion.status).toBe(200);
    expect(await suggestion.json()).toEqual({ suggestions: { snapshot: identity.snapshot, requiresConfirmation: true, ambiguous: true, candidates: [] } });
    expect(plan.status).toBe(200);
    expect(await plan.json()).toEqual({ preview: { previewOnly: true, executable: false, sample: [] } });
    expect(page.status).toBe(200);
    expect(await page.json()).toEqual({ marketProperties: { properties: [{ id: PROPERTY, name: "Market-only hotel", timezone: "Asia/Dubai", currency: "AED" }], nextCursor: null } });
    expect(calls.suggestIdentity[0]?.[1]).toMatchObject({ tenantId: TENANT, actorId: ACTOR, propertyNode: PROPERTY, scopes: [READ] });
    expect(calls.suggestIdentity[0]?.[2]).toEqual(identity);
    expect(calls.previewPlan[0]?.[1]).toMatchObject({ tenantId: TENANT, actorId: ACTOR, propertyNode: PROPERTY, scopes: [READ] });
    expect(calls.previewPlan[0]?.[2]).toEqual(preview);
    expect(calls.properties[0]?.[1]).toEqual({ tenantId: TENANT, actorId: ACTOR,
      requestId: "00000000-0000-0000-0000-000000000777", scopes: [READ] });
    expect(calls.properties[0]?.[2]).toEqual({ cursor });
  });

  test("Q267 rejects malformed route/query/JSON before it invokes a market operation", async () => {
    const { api, calls } = marketApi();
    const denied = createApp({ database: database(), tenantResolver: resolver([]), marketApi: api });
    const base = `/api/v1/properties/${PROPERTY}/market`;
    expect((await denied.handle(request(`${base}/identity/suggest`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }))).status).toBe(403);
    expect((await denied.handle(request("/api/v1/me/market-properties"))).status).toBe(403);
    const permitted = createApp({ database: database(), tenantResolver: resolver([READ]), marketApi: api });
    expect((await permitted.handle(request(`${base}/identity/suggest?unexpected=1`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }))).status).toBe(400);
    expect((await permitted.handle(request(`${base}/plan/preview`, { method: "POST", headers: { "content-type": "text/plain" }, body: "{}" }))).status).toBe(400);
    expect((await permitted.handle(request("/api/v1/me/market-properties?unexpected=1"))).status).toBe(400);
    expect((await permitted.handle(request("/api/v1/me/market-properties?cursor=one&cursor=two"))).status).toBe(400);
    expect(calls.suggestIdentity).toHaveLength(0);
    expect(calls.previewPlan).toHaveLength(0);
    expect(calls.properties).toHaveLength(0);
  });

  test("requires coarse scopes, exact route shape, JSON, and header idempotency before domain calls", async () => {
    const { api, calls } = marketApi();
    const denied = createApp({ database: database(), tenantResolver: resolver([]), marketApi: api });
    expect((await denied.handle(request(`/api/v1/properties/${PROPERTY}/market/discovery`))).status).toBe(403);
    expect((await denied.handle(request(`/api/v1/properties/${PROPERTY}/market/compset/confirm`, {
      method: "POST", body: "{}", headers: { "content-type": "application/json", "idempotency-key": "market-key-0001" },
    }))).status).toBe(403);

    const permitted = createApp({ database: database(), tenantResolver: resolver([READ, WRITE]), marketApi: api });
    expect((await permitted.handle(request(`/api/v1/properties/${PROPERTY}/market/discovery?extra=1`))).status).toBe(400);
    expect((await permitted.handle(request(`/api/v1/properties/${PROPERTY}/market/compset/confirm`, {
      method: "POST", body: "{}", headers: { "content-type": "application/json" },
    }))).status).toBe(400);
    expect((await permitted.handle(request(`/api/v1/properties/${PROPERTY}/market/compset/confirm`, {
      method: "POST", body: "{}", headers: { "content-type": "text/plain", "idempotency-key": "market-key-0001" },
    }))).status).toBe(400);
    expect(calls.discovery).toHaveLength(0);
    expect(calls.confirm).toHaveLength(0);
  });

  test("preserves the exact confirmation body/key and response replay state without HTTP idempotency wrapping", async () => {
    const command = Object.freeze({
      expectedActiveVersion: null,
      ownProperty: Object.freeze({ logicalId: "riyadh", sha256: "a".repeat(64), sourceRecordId: "overture-1" }),
      comparators: Object.freeze([]),
    });
    const { api, calls } = marketApi();
    const app = createApp({ database: database(), tenantResolver: resolver([WRITE]), marketApi: api });
    const response = await app.handle(request(`/api/v1/properties/${PROPERTY}/market/compset/confirm`, {
      method: "POST", body: JSON.stringify(command), headers: { "content-type": "application/json", "idempotency-key": "market-key-0001" },
    }));
    expect(response.status).toBe(201);
    expect(response.headers.get("idempotency-replayed")).toBe("false");
    expect(await response.json()).toEqual({ confirmation: {
      version: { extensionId: "00000000-0000-0000-0000-000000000301", version: 1, content: {} }, replayed: false,
    } });
    expect(calls.confirm).toHaveLength(1);
    expect(calls.confirm[0]?.[2]).toEqual(command);
    expect(calls.confirm[0]?.[3]).toBe("market-key-0001");

    const replay = marketApi({ confirm: result(Object.freeze({ version: Object.freeze({ extensionId: "00000000-0000-0000-0000-000000000301", version: 1, content: {} }), replayed: true })) });
    const replayed = createApp({ database: database(), tenantResolver: resolver([WRITE]), marketApi: replay.api });
    const replayResponse = await replayed.handle(request(`/api/v1/properties/${PROPERTY}/market/compset/confirm`, {
      method: "POST", body: JSON.stringify(command), headers: { "content-type": "application/json", "idempotency-key": "market-key-0001" },
    }));
    expect(replayResponse.status).toBe(200);
    expect(replayResponse.headers.get("idempotency-replayed")).toBe("true");
  });

  test("maps typed domain failures without diagnostics and leaves unexpected failures for transaction rollback", async () => {
    for (const [method, outcome, status] of [
      ["discovery", failed("invalid_input"), 400],
      ["current", failed("forbidden"), 403],
      ["suggestIdentity", failed("invalid_input"), 400],
      ["previewPlan", failed("conflict"), 409],
      ["properties", failed("forbidden"), 403],
      ["confirm", failed("conflict"), 409],
      ["confirm", failed("invalid_state"), 409],
      ["confirm", failed("unavailable"), 503],
    ] as const) {
      const { api } = marketApi({ [method]: outcome });
      const app = createApp({ database: database(), tenantResolver: resolver([READ, WRITE]), marketApi: api });
      const path = method === "discovery" ? `/api/v1/properties/${PROPERTY}/market/discovery`
        : method === "current" ? `/api/v1/properties/${PROPERTY}/market/compset`
          : method === "suggestIdentity" ? `/api/v1/properties/${PROPERTY}/market/identity/suggest`
            : method === "previewPlan" ? `/api/v1/properties/${PROPERTY}/market/plan/preview`
              : method === "properties" ? "/api/v1/me/market-properties"
                : `/api/v1/properties/${PROPERTY}/market/compset/confirm`;
      const post = method === "suggestIdentity" || method === "previewPlan" || method === "confirm";
      const reply = await app.handle(request(path, post ? {
        method: "POST", body: "{}", headers: { "content-type": "application/json", ...(method === "confirm" ? { "idempotency-key": "market-key-0001" } : {}) },
      } : {}));
      expect(reply.status).toBe(status);
      expect((await reply.json() as { detail: string }).detail).not.toContain("Market competitor-set operation could not be completed.");
    }

    let transactionFailure = 0;
    const unexpected = new MarketHttpApi({
      async discovery(): Promise<never> { throw new Error("private database detail"); },
      async current(): Promise<never> { throw new Error("private database detail"); },
      async confirm(): Promise<never> { throw new Error("private database detail"); },
    } as never);
    const app = createApp({ database: database(() => { transactionFailure += 1; }), tenantResolver: resolver([READ]), marketApi: unexpected });
    const response = await app.handle(request(`/api/v1/properties/${PROPERTY}/market/discovery`));
    expect(response.status).toBe(503);
    expect(transactionFailure).toBe(1);
    expect(await response.json()).toMatchObject({ type: "service/unavailable", detail: "Market competitor-set service is temporarily unavailable" });
  });

  test("reserves the managed extension type while preserving unrelated generic behavior", async () => {
    let registered = 0;
    let created = 0;
    const registry = {
      async registerType(): Promise<"inserted"> { registered += 1; return "inserted"; },
      async createInstance(): Promise<unknown> { created += 1; return { type: "ordinary_setting", key: "ordinary" }; },
      async listVisible(): Promise<readonly unknown[]> {
        return [
          { type: "market_compset", key: "property" },
          { type: "ordinary_setting", key: "ordinary" },
        ];
      },
    } as unknown as ExtensionRegistry;
    const app = createApp({ database: database(), tenantResolver: resolver([
      "identity.extension-type:register", "identity.extension:write", "identity.extension:read",
    ]), extensionRegistry: registry });
    const headers = { "content-type": "application/json" };
    const type = await app.handle(request("/api/extension-types", { method: "POST", headers,
      body: JSON.stringify({ type: "market_compset", propertyNode: PROPERTY, jsonSchema: {} }) }));
    const instance = await app.handle(request("/api/extensions", { method: "POST", headers,
      body: JSON.stringify({ type: "market_compset", key: "property", propertyNode: PROPERTY, content: {} }) }));
    expect(type.status).toBe(403);
    expect(await type.json()).toEqual({ error: "managed_type" });
    expect(instance.status).toBe(403);
    expect(registered).toBe(0);
    expect(created).toBe(0);

    const listed = await app.handle(request("/api/extensions"));
    expect(await listed.json()).toEqual({ extensions: [{ type: "ordinary_setting", key: "ordinary" }] });
    const ordinary = await app.handle(request("/api/extensions", { method: "POST", headers,
      body: JSON.stringify({ type: "ordinary_setting", key: "ordinary", propertyNode: PROPERTY, content: {} }) }));
    expect(ordinary.status).toBe(201);
    expect(created).toBe(1);
  });
});
