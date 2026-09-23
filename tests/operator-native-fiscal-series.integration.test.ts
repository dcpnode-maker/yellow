import { describe, expect, test } from "bun:test";
import { afterAll, beforeAll } from "bun:test";
import { SQL } from "bun";
import { createApp } from "../src/app";
import { BearerTenantResolver, Hs256TokenSigner, type LocalLoginService } from "../src/contexts/identity";
import { Database, type Tx } from "../src/kernel";
import { OperatorHttpApi } from "../src/http/operator";
import { assertSeriesTargets, createSeriesFixture, parseSeriesMode, seriesCatalogue, seriesRows } from "./fixtures/india-native-fiscal-series-fixture";

const deployUrl = process.env.YELLOW_ORDER453_DEPLOY_DATABASE_URL;
const runtimeUrl = process.env.YELLOW_ORDER453_RUNTIME_DATABASE_URL;
const requireDatabase = process.env.YELLOW_REQUIRE_ORDER453_DATABASE === "1";
const nativeExecutionAdmitted = process.env.YELLOW_ORDER453_NATIVE_EXECUTE_AFTER_HANDOFF === "1";
if (requireDatabase && (!deployUrl || !runtimeUrl)) throw new Error("Required Order453 proof needs exact admitted credentials");
if (requireDatabase && !nativeExecutionAdmitted) throw new Error("Required Order453 native proof needs explicit Q242 admission");
const targetMode = requireDatabase || deployUrl || runtimeUrl
  ? parseSeriesMode(process.env.YELLOW_ORDER453_TARGET_MODE) : undefined;
if (deployUrl || runtimeUrl) {
  if (!deployUrl || !runtimeUrl) throw new Error("Order453 proof requires paired deploy/runtime credentials");
  const assertAdmittedSeriesTargets = assertSeriesTargets as unknown as (...args: unknown[]) => void;
  assertAdmittedSeriesTargets(deployUrl, runtimeUrl, "runtime", targetMode!,
    process.env.YELLOW_REQUIRE_ORDER453_CI_CANONICAL === "1", process.env.YELLOW_ORDER453_CI_DATABASE_ADDRESS,
    nativeExecutionAdmitted);
}

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const tenantId = id(1), propertyNode = id(2), actorId = id(3), supplierRegistrationId = id(4);
const scope = "tax-fiscal.series:configure";
const signer = new Hs256TokenSigner("order453-signed-session-test-key-not-for-production");
const seriesRow = {
  series_id: id(40), tenant_id: tenantId, property_node: propertyNode,
  supplier_registration_id: supplierRegistrationId, document_kind: "credit_note",
  prefix: "C453/", financial_year_start: "2026-04-01", next_no: "1", created: true,
};

function harness() {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  const control = { grant: true, row: { ...seriesRow }, error: null as string | null };
  const connection = Object.assign(async (parts: TemplateStringsArray, ...values: unknown[]) => {
    const sql = parts.join("?");
    if (sql.includes("set_config('app.tenant_id'")) return [{ tenant_id: values[0] }];
    if (sql.includes("current_user = session_user")) return [{ role_reset: true, tenant_reset: true }];
    if (sql.includes("FROM user_role")) {
      return control.grant ? [{ id: propertyNode, name: "Test hotel", timezone: "Asia/Kolkata", currency: "INR" }] : [];
    }
    if (sql.includes("current_setting('app.tenant_id'") && sql.includes("current_user::text")) {
      return [{ tenant_id: tenantId, current_user: "app_role", current_role: "app_role" }];
    }
    calls.push({ sql, values });
    if (control.error) throw Object.assign(new Error("private SQL detail"), { errno: control.error });
    if (sql.includes("create_india_native_fiscal_series")) return [control.row];
    throw new Error(`unexpected SQL: ${sql}`);
  }, {
    async unsafe(sql: string) {
      if (["BEGIN", "SET LOCAL ROLE app_role", "COMMIT", "ROLLBACK"].includes(sql)) return [];
      throw new Error(`unexpected unsafe SQL: ${sql}`);
    },
    release() {},
    async close() {},
  }) as unknown as Tx;
  const database = new Database({ async reserve() { return connection; } });
  const app = createApp({ database, tenantResolver: new BearerTenantResolver(signer), operatorApi: new OperatorHttpApi({} as LocalLoginService) });
  return { app, calls, control };
}

async function token(scopes: readonly string[], identity = { tenantId, actorId }) {
  return `Bearer ${await signer.issue({ userId: identity.actorId, tenantId: identity.tenantId, scopes })}`;
}

function url(property = propertyNode, suffix = "") {
  return `http://yellow.test/api/v1/properties/${property}/fiscal-series${suffix}`;
}

function requestBody(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({ supplierRegistrationId, documentKind: "credit_note", prefix: "C453/", ...overrides });
}

describe("Order453 native fiscal-series HTTP boundary", () => {
  test("requires the signed configuration scope and current property grant", async () => {
    for (const scopes of [[], ["tax-fiscal.documents:read"]]) {
      const h = harness();
      const response = await h.app.handle(new Request(url(), {
        method: "POST", headers: { authorization: await token(scopes), "content-type": "application/json" }, body: requestBody(),
      }));
      expect(response.status).toBe(403);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(h.calls).toHaveLength(0);
    }
    const h = harness(); h.control.grant = false;
    const response = await h.app.handle(new Request(url(), {
      method: "POST", headers: { authorization: await token([scope]), "content-type": "application/json" }, body: requestBody(),
    }));
    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(h.calls).toHaveLength(0);
  });

  test("validates the body, route identity and query before SQL", async () => {
    const cases: Array<{ suffix?: string; body?: string; headers?: Record<string, string> }> = [
      { suffix: "?propertyNode=" + propertyNode },
      { body: requestBody({ unexpected: true }) },
      { body: requestBody({ tenantId }) },
      { body: requestBody({ actorId }) },
      { body: requestBody({ supplierRegistrationId: "not-a-uuid" }) },
      { body: requestBody({ prefix: "C 453/" }) },
      { body: requestBody(), headers: { "content-type": "text/plain" } },
      { suffix: "?x=1", body: requestBody() },
    ];
    for (const item of cases) {
      const h = harness();
      const response = await h.app.handle(new Request(url(propertyNode, item.suffix ?? ""), {
        method: "POST",
        headers: { authorization: await token([scope]), "content-type": "application/json", ...item.headers },
        body: item.body ?? requestBody(),
      }));
      expect(response.status).toBe(400);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(h.calls).toHaveLength(0);
    }
    const malformed = harness();
    const response = await malformed.app.handle(new Request(url("not-a-property"), {
      method: "POST", headers: { authorization: await token([scope]), "content-type": "application/json" }, body: requestBody(),
    }));
    expect(response.status).toBe(400);
    expect(malformed.calls).toHaveLength(0);
  });

  test("returns exact create and replay envelopes with six SQL arguments", async () => {
    const h = harness();
    let response = await h.app.handle(new Request(url(), {
      method: "POST", headers: { authorization: await token([scope]), "content-type": "application/json", "x-correlation-id": id(50) }, body: requestBody(),
    }));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ series: {
      seriesId: id(40), tenantId, propertyNode, supplierRegistrationId, documentKind: "credit_note", prefix: "C453/",
      financialYearStart: "2026-04-01", nextNo: "1", replayed: false,
    } });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-correlation-id")).toBe(id(50));
    expect(response.headers.get("idempotency-replayed")).toBeNull();
    expect(h.calls.filter(({ sql }) => sql.includes("create_india_native_fiscal_series"))).toHaveLength(1);
    expect(h.calls.find(({ sql }) => sql.includes("create_india_native_fiscal_series"))?.values).toEqual([
      tenantId, propertyNode, supplierRegistrationId, "credit_note", "C453/", actorId,
    ]);

    h.control.row = { ...seriesRow, created: false, next_no: "2" };
    response = await h.app.handle(new Request(url(), {
      method: "POST", headers: { authorization: await token([scope]), "content-type": "application/json" }, body: requestBody(),
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ series: {
      seriesId: id(40), tenantId, propertyNode, supplierRegistrationId, documentKind: "credit_note", prefix: "C453/",
      financialYearStart: "2026-04-01", nextNo: "2", replayed: true,
    } });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("idempotency-replayed")).toBeNull();
  });

  test("sanitizes database authorization, conflict and availability failures", async () => {
    for (const [error, status] of [["42501", 403], ["23505", 409], ["55000", 503], ["XX000", 503]] as const) {
      const h = harness(); h.control.error = error;
      const response = await h.app.handle(new Request(url(), {
        method: "POST", headers: { authorization: await token([scope]), "content-type": "application/json" }, body: requestBody(),
      }));
      expect(response.status).toBe(status);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(await response.text()).not.toContain("private SQL detail");
    }
    const corrupt = harness(); corrupt.control.row = null as never;
    const corruptResponse = await corrupt.app.handle(new Request(url(), {
      method: "POST", headers: { authorization: await token([scope]), "content-type": "application/json" }, body: requestBody(),
    }));
    expect(corruptResponse.status).toBe(503);
    expect(corruptResponse.headers.get("cache-control")).toBe("no-store");
    expect(await corruptResponse.text()).not.toContain("PostgreSQL");
    const unauthenticated = harness();
    const response = await unauthenticated.app.handle(new Request(url(), { method: "POST", headers: { "content-type": "application/json" }, body: requestBody() }));
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(unauthenticated.calls).toHaveLength(0);
  });
});

const nativeDatabase = requireDatabase ? describe.serial : describe.skip;
nativeDatabase("Order453 admitted native signed-session fiscal-series proof", () => {
  let deploy: SQL;
  let runtime: Database;

  beforeAll(() => {
    deploy = new SQL(deployUrl!, { max: 2, prepare: false });
    runtime = Database.connect(runtimeUrl!, { maxConnections: 2, prepare: false });
  });
  afterAll(async () => { await runtime?.close(); await deploy?.close({ timeout: 0 }); });

  test("creates and replays one genuine series while denied identities leave no durable effects", async () => {
    const fixture = await createSeriesFixture(deploy, runtime, { label: `series453-http-${crypto.randomUUID().slice(0, 8)}` });
    const { input, roleId } = fixture;
    const expectedFinancialYearStart = fixture.candidate.series.financialYearStart;
    const app = createApp({ database: runtime, tenantResolver: new BearerTenantResolver(signer), operatorApi: new OperatorHttpApi({} as LocalLoginService) });
    const signedRequest = async (body: Record<string, unknown>, identity = { tenantId: input.tenant, actorId: input.actor }, suffix = "") =>
      app.handle(new Request(`http://yellow.test/api/v1/properties/${input.property}/fiscal-series${suffix}`, {
        method: "POST",
        headers: { authorization: await token([scope], identity), "content-type": "application/json" },
        body: JSON.stringify(body),
      }));
    const body = { supplierRegistrationId: input.supplier, documentKind: input.kind, prefix: input.prefix };
    const before = await seriesRows(deploy);
    const catalogueBefore = await seriesCatalogue(deploy);
    const created = await signedRequest(body);
    expect(created.status).toBe(201);
    const createdJson = await created.json() as { series: Record<string, unknown> };
    expect(createdJson).toEqual({ series: {
      seriesId: expect.any(String), tenantId: input.tenant, propertyNode: input.property,
      supplierRegistrationId: input.supplier, documentKind: input.kind, prefix: input.prefix,
      financialYearStart: expectedFinancialYearStart, nextNo: "1", replayed: false,
    } });
    expect(created.headers.get("cache-control")).toBe("no-store");
    expect(created.headers.get("x-correlation-id")).toMatch(/^[0-9a-f-]{36}$/);
    expect(created.headers.get("idempotency-replayed")).toBeNull();
    const afterCreate = await seriesRows(deploy);
    const changedTables = Object.keys(afterCreate).filter(name => JSON.stringify(afterCreate[name]) !== JSON.stringify(before[name])).sort();
    expect(changedTables).toEqual(["document_series", "fact_log", "outbox"]);
    for (const name of Object.keys(before)) {
      expect((before[name] ?? []).every(row => (afterCreate[name] ?? []).includes(row))).toBe(true);
      expect((afterCreate[name] ?? []).filter(row => !(before[name] ?? []).includes(row))).toHaveLength(name === "document_series" || name === "fact_log" || name === "outbox" ? 1 : 0);
    }
    const createdSeriesId = createdJson.series.seriesId;
    if (typeof createdSeriesId !== "string") throw new Error("Order453 response omitted the series identity");
    const [fact] = await deploy<{ entity_id: string; actor_id: string; payload: string }[]>`SELECT entity_id::text,actor_id::text,payload::text
      FROM public.fact_log WHERE tenant_id=${input.tenant}::uuid AND entity_type='document_series'
        AND entity_id=${createdSeriesId}::uuid AND fact_type='configured'`;
    expect(fact).toBeDefined();
    expect(fact).toMatchObject({ entity_id: createdSeriesId, actor_id: input.actor });
    expect(JSON.parse(fact!.payload)).toEqual({ seriesId: createdSeriesId, propertyNode: input.property,
      supplierRegistrationId: input.supplier, documentKind: input.kind, prefix: input.prefix,
      financialYearStart: expectedFinancialYearStart });
    const [event] = await deploy<{ aggregate_id: string; property_node: string; actor_id: string; event_type: string; payload: string }[]>`SELECT aggregate_id::text,property_node::text,actor_id::text,event_type,payload::text
      FROM public.outbox WHERE tenant_id=${input.tenant}::uuid AND aggregate_type='document_series'
        AND aggregate_id=${createdSeriesId}::uuid AND event_type='document.series.configured'`;
    expect(event).toBeDefined();
    expect(event).toMatchObject({ aggregate_id: createdSeriesId, property_node: input.property,
      actor_id: input.actor, event_type: "document.series.configured" });
    expect(JSON.parse(event!.payload)).toEqual(JSON.parse(fact!.payload));
    expect(await seriesCatalogue(deploy)).toBe(catalogueBefore);

    const replayed = await signedRequest(body);
    expect(replayed.status).toBe(200);
    expect(await replayed.json()).toEqual({ series: { ...createdJson.series, replayed: true } });
    expect(replayed.headers.get("cache-control")).toBe("no-store");
    expect(replayed.headers.get("idempotency-replayed")).toBeNull();
    expect(await seriesRows(deploy)).toEqual(afterCreate);

    const hostileBodies: Array<Record<string, unknown>> = [
      { ...body, financialYearStart: expectedFinancialYearStart, nextNo: "999999999999999999" },
      { ...body, seriesId: createdJson.series.seriesId },
      { ...body, tenantId: input.tenant },
      { ...body, actorId: input.actor },
    ];
    for (const hostile of hostileBodies) {
      const response = await signedRequest(hostile);
      expect(response.status).toBe(400);
      expect(response.headers.get("cache-control")).toBe("no-store");
    }
    const queryAttempt = await signedRequest(body, undefined, `?financialYearStart=${expectedFinancialYearStart}&nextNo=99`);
    expect(queryAttempt.status).toBe(400);
    expect(queryAttempt.headers.get("cache-control")).toBe("no-store");
    const foreignAttempt = await signedRequest(body, { tenantId: crypto.randomUUID(), actorId: input.actor });
    expect(foreignAttempt.status).toBe(403);
    expect(foreignAttempt.headers.get("cache-control")).toBe("no-store");
    const foreignProperty = await app.handle(new Request(`http://yellow.test/api/v1/properties/${crypto.randomUUID()}/fiscal-series`, {
      method: "POST", headers: { authorization: await token([scope], { tenantId: input.tenant, actorId: input.actor }), "content-type": "application/json" },
      body: JSON.stringify(body),
    }));
    expect(foreignProperty.status).toBe(403);
    expect(foreignProperty.headers.get("cache-control")).toBe("no-store");

    const [grant] = await deploy<{ role_id: string; permission_code: string }[]>`SELECT role_id::text,permission_code
      FROM public.role_permission WHERE role_id=${roleId}::uuid AND permission_code=${scope}`;
    if (!grant) throw new Error("Order453 expected the current series permission grant");
    try {
      await deploy`DELETE FROM public.role_permission WHERE role_id=${grant.role_id}::uuid AND permission_code=${grant.permission_code}`;
      const revokedState = await seriesRows(deploy);
      for (const attemptBody of [body, { ...body, documentKind: "debit_note", prefix: "D453/" }]) {
        const response = await signedRequest(attemptBody);
        expect(response.status).toBe(403);
        expect(response.headers.get("cache-control")).toBe("no-store");
        expect(await response.text()).not.toContain("role_permission");
        expect(await seriesRows(deploy)).toEqual(revokedState);
      }
    } finally {
      await deploy`INSERT INTO public.role_permission(role_id,permission_code)
        VALUES(${grant.role_id}::uuid,${grant.permission_code})`;
    }

    const [actorRow] = await deploy<{ status: string }[]>`SELECT status::text FROM public.app_user
      WHERE tenant_id=${input.tenant}::uuid AND id=${input.actor}::uuid`;
    if (!actorRow) throw new Error("Order453 expected the fixture actor");
    try {
      await deploy`UPDATE public.app_user SET status='inactive' WHERE tenant_id=${input.tenant}::uuid AND id=${input.actor}::uuid`;
      const revokedState = await seriesRows(deploy);
      for (const attemptBody of [body, { ...body, documentKind: "debit_note", prefix: "D453/" }]) {
        const response = await signedRequest(attemptBody);
        expect(response.status).toBe(403);
        expect(response.headers.get("cache-control")).toBe("no-store");
        expect(await seriesRows(deploy)).toEqual(revokedState);
      }
    } finally {
      await deploy`UPDATE public.app_user SET status=${actorRow.status} WHERE tenant_id=${input.tenant}::uuid AND id=${input.actor}::uuid`;
    }

    const [tenantRow] = await deploy<{ status: string }[]>`SELECT status::text FROM public.tenant WHERE id=${input.tenant}::uuid`;
    if (!tenantRow) throw new Error("Order453 expected the fixture tenant");
    try {
      await deploy`UPDATE public.tenant SET status='inactive' WHERE id=${input.tenant}::uuid`;
      const revokedState = await seriesRows(deploy);
      for (const attemptBody of [body, { ...body, documentKind: "debit_note", prefix: "D453/" }]) {
        const response = await signedRequest(attemptBody);
        expect(response.status).toBe(403);
        expect(response.headers.get("cache-control")).toBe("no-store");
        expect(await seriesRows(deploy)).toEqual(revokedState);
      }
    } finally {
      await deploy`UPDATE public.tenant SET status=${tenantRow.status} WHERE id=${input.tenant}::uuid`;
    }
    expect(await seriesRows(deploy)).toEqual(afterCreate);
    expect(await seriesCatalogue(deploy)).toBe(catalogueBefore);
  }, 120_000);
});
