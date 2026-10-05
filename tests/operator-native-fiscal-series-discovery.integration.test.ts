import { describe, expect, test } from "bun:test";
import { afterAll, beforeAll } from "bun:test";
import { SQL } from "bun";
import { createApp } from "../src/app";
import { BearerTenantResolver, Hs256TokenSigner, type LocalLoginService } from "../src/contexts/identity";
import { Database, type Tx } from "../src/kernel";
import { OperatorHttpApi } from "../src/http/operator";
import { seriesCatalogue, seriesRows } from "./fixtures/india-native-fiscal-series-fixture";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const scope = "tax-fiscal.series:configure";
const signer = new Hs256TokenSigner("order454-signed-session-test-key-not-for-production");
const row = {
  authority_allowed: true, supplier_available: true, current_financial_year_start: "2026-04-01",
  series_id: id(5), tenant_id: id(1), property_node: id(2), supplier_registration_id: id(3),
  document_kind: "credit_note", prefix: "C453/", financial_year_start: "2026-04-01", next_no: "9",
};

function harness() {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  const control = { grants: true, result: [row] as unknown[], error: null as string | null };
  const connection = Object.assign(async (parts: TemplateStringsArray, ...values: unknown[]) => {
    const sql = parts.join("?");
    if (sql.includes("set_config('app.tenant_id'")) return [{ tenant_id: values[0] }];
    if (sql.includes("current_user = session_user")) return [{ role_reset: true, tenant_reset: true }];
    if (sql.includes("SELECT DISTINCT target.id")) {
      return control.grants ? [{ id: id(2), name: "Test hotel", timezone: "Asia/Kolkata", currency: "INR" }] : [];
    }
    calls.push({ sql, values });
    if (control.error) throw Object.assign(new Error("private fiscal-series database detail"), { errno: control.error });
    if (sql.includes("authority AS MATERIALIZED")) return control.result;
    if (sql === "COMMIT") return [];
    throw new Error("unexpected SQL");
  }, { async unsafe() { return []; }, release() {}, async close() {} }) as unknown as Tx;
  const database = new Database({ async reserve() { return connection; } });
  const app = createApp({ database, tenantResolver: new BearerTenantResolver(signer), operatorApi: new OperatorHttpApi({} as LocalLoginService) });
  return { app, calls, control };
}

async function token(scopes: readonly string[]) {
  return `Bearer ${await signer.issue({ userId: id(4), tenantId: id(1), scopes })}`;
}

function url(query = "supplierRegistrationId=" + id(3) + "&documentKind=credit_note") {
  return `http://yellow.test/api/v1/properties/${id(2)}/fiscal-series?${query}`;
}

describe("Order454 signed fiscal-series discovery HTTP boundary", () => {
  test("reads the current series with exact selectors and no-store response", async () => {
    const h = harness();
    const response = await h.app.handle(new Request(url(), { headers: { authorization: await token([scope]) } }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ series: {
      seriesId: id(5), tenantId: id(1), propertyNode: id(2), supplierRegistrationId: id(3),
      documentKind: "credit_note", prefix: "C453/", financialYearStart: "2026-04-01", nextNo: "9",
    } });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-correlation-id")).toMatch(/^[0-9a-f-]{36}$/);
    expect(h.calls).toHaveLength(1);
  });

  test("returns an authorized absence and rejects malformed identities before any SQL read", async () => {
    const absent = harness();
    absent.control.result = [{
      authority_allowed: true, supplier_available: true, current_financial_year_start: "2026-04-01",
      series_id: null, tenant_id: null, property_node: null, supplier_registration_id: null,
      document_kind: null, prefix: null, financial_year_start: null, next_no: null,
    }];
    const absentResponse = await absent.app.handle(new Request(url(), { headers: { authorization: await token([scope]) } }));
    expect(absentResponse.status).toBe(200);
    expect(await absentResponse.json()).toEqual({ series: null });
    expect(absentResponse.headers.get("cache-control")).toBe("no-store");
    for (const badUrl of [
      `http://yellow.test/api/v1/properties/not-a-property/fiscal-series?supplierRegistrationId=${id(3)}&documentKind=credit_note`,
      `http://yellow.test/api/v1/properties/${id(2)}/fiscal-series?supplierRegistrationId=not-a-supplier&documentKind=credit_note`,
      `http://yellow.test/api/v1/properties/${id(2)}/fiscal-series?supplierRegistrationId=${id(3)}&documentKind=unknown`,
    ]) {
      const h = harness();
      const response = await h.app.handle(new Request(badUrl, { headers: { authorization: await token([scope]) } }));
      expect(response.status).toBe(400);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(h.calls).toHaveLength(0);
    }
  });

  test("rejects absent scope, duplicate/extra selectors, revoked property and sanitized failures", async () => {
    for (const scopes of [[], ["tax-fiscal.documents:read"]]) {
      const h = harness();
      expect((await h.app.handle(new Request(url(), { headers: { authorization: await token(scopes) } }))).status).toBe(403);
      expect(h.calls).toHaveLength(0);
    }
    for (const query of [
      `supplierRegistrationId=${id(3)}&supplierRegistrationId=${id(3)}&documentKind=credit_note`,
      `supplierRegistrationId=${id(3)}&documentKind=credit_note&prefix=caller`,
    ]) {
      const h = harness();
      const response = await h.app.handle(new Request(url(query), { headers: { authorization: await token([scope]) } }));
      expect(response.status).toBe(400); expect(h.calls).toHaveLength(0);
    }
    const revoked = harness(); revoked.control.grants = false;
    expect((await revoked.app.handle(new Request(url(), { headers: { authorization: await token([scope]) } }))).status).toBe(403);
    const authorityDenied = harness(); authorityDenied.control.result = [{
      authority_allowed: false, supplier_available: null, current_financial_year_start: null,
      series_id: null, tenant_id: null, property_node: null, supplier_registration_id: null,
      document_kind: null, prefix: null, financial_year_start: null, next_no: null,
    }];
    const deniedResponse = await authorityDenied.app.handle(new Request(url(), { headers: { authorization: await token([scope]) } }));
    expect(deniedResponse.status).toBe(403);
    expect(deniedResponse.headers.get("cache-control")).toBe("no-store");
    const corrupt = harness(); corrupt.control.result = [Object.assign({}, row, { prefix: "not-a-valid-prefix" })];
    const corruptResponse = await corrupt.app.handle(new Request(url(), { headers: { authorization: await token([scope]) } }));
    expect(corruptResponse.status).toBe(503);
    expect(corruptResponse.headers.get("cache-control")).toBe("no-store");
    for (const error of ["42501", "XX000"] as const) {
      const h = harness(); h.control.error = error;
      const response = await h.app.handle(new Request(url(), { headers: { authorization: await token([scope]) } }));
      expect(response.status).toBe(error === "42501" ? 403 : 503);
      expect(await response.text()).not.toContain("private fiscal-series database detail");
    }
  });
});

type NativeSeries = Readonly<{
  seriesId: string;
  prefix: string;
  financialYearStart: string;
  nextNo: string;
}>;
type NativeCohort = Readonly<{
  tenantId: string;
  propertyNode: string;
  actorId: string;
  supplierRegistrationId: string;
  creditNote: NativeSeries;
  invoice: NativeSeries;
  secondProperty?: Readonly<{ propertyNode: string; supplierRegistrationId: string; creditNote: NativeSeries }>;
}>;
type NativeHttpManifest = Readonly<{ main: NativeCohort; foreign: NativeCohort }>;

const nativeHttpRequired = process.env.YELLOW_REQUIRE_ORDER454_HTTP_DATABASE === "1";
const nativeHttpDeployUrl = process.env.YELLOW_ORDER454_HTTP_DEPLOY_DATABASE_URL;
const nativeHttpRuntimeUrl = process.env.YELLOW_ORDER454_HTTP_RUNTIME_DATABASE_URL;
const nativeHttpAdmitted = process.env.YELLOW_ORDER454_HTTP_EXECUTION_ADMITTED === "1";
const nativeHttpManifestText = process.env.YELLOW_ORDER454_HTTP_COHORTS_JSON;

function nativeHttpManifest(): NativeHttpManifest {
  if (!nativeHttpManifestText) throw new Error("Order454 HTTP proof requires the exact admitted cohort manifest");
  let value: unknown;
  try { value = JSON.parse(nativeHttpManifestText); } catch { throw new Error("Order454 HTTP cohort manifest is invalid JSON"); }
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("Order454 HTTP cohort manifest is invalid");
  return value as NativeHttpManifest;
}

function assertNativeHttpTarget(value: string, username: string): void {
  const url = new URL(value);
  if (!["postgres:", "postgresql:"].includes(url.protocol) || url.hostname !== "127.0.0.1" || url.port !== "55503" ||
      url.pathname !== "/yellow_order453_referee90_20260908" || url.username !== username || !url.password || url.search || url.hash) {
    throw new Error("Order454 HTTP proof requires the exact paired referee90 target");
  }
}

if (nativeHttpRequired) {
  if (!nativeHttpAdmitted) throw new Error("Order454 HTTP proof requires explicit root HTTP admission");
  if (!nativeHttpDeployUrl || !nativeHttpRuntimeUrl) throw new Error("Order454 HTTP proof requires paired deploy/runtime credentials");
  assertNativeHttpTarget(nativeHttpDeployUrl, "yellow_deploy");
  assertNativeHttpTarget(nativeHttpRuntimeUrl, "yellow_runtime");
  nativeHttpManifest();
}

const nativeHttpDatabase = nativeHttpRequired ? describe.serial : describe.skip;
nativeHttpDatabase("Order454 admitted native signed fiscal-series discovery HTTP proof", () => {
  let deploy: SQL;
  let runtime: Database;
  let manifest: NativeHttpManifest;

  beforeAll(() => {
    manifest = nativeHttpManifest();
    deploy = new SQL(nativeHttpDeployUrl!, { max: 2, prepare: false });
    runtime = Database.connect(nativeHttpRuntimeUrl!, { maxConnections: 3, prepare: false });
  });
  afterAll(async () => { await runtime?.close(); await deploy?.close({ timeout: 0 }); });

  async function snapshot() {
    const rows = await seriesRows(deploy);
    const catalogue = await seriesCatalogue(deploy);
    const sequences = await deploy<{ value: string }[]>`SELECT to_jsonb(s)::text value
      FROM pg_catalog.pg_sequences s WHERE schemaname='public' ORDER BY sequencename`;
    return JSON.stringify({ rows, catalogue, sequences });
  }

  function expectedSeries(cohort: NativeCohort, series: NativeSeries, propertyNode = cohort.propertyNode,
    supplierRegistrationId = cohort.supplierRegistrationId, documentKind: "invoice" | "credit_note" = "credit_note") {
    return { seriesId: series.seriesId, tenantId: cohort.tenantId, propertyNode, supplierRegistrationId,
      documentKind, prefix: series.prefix, financialYearStart: series.financialYearStart, nextNo: series.nextNo };
  }

  async function request(propertyNode: string, query: string, tenantId: string, actorId: string, scopes: readonly string[]) {
    const app = createApp({ database: runtime, tenantResolver: new BearerTenantResolver(signer), operatorApi: new OperatorHttpApi({} as LocalLoginService) });
    return app.handle(new Request(`http://yellow.test/api/v1/properties/${propertyNode}/fiscal-series?${query}`, {
      headers: { authorization: await tokenForNative(tenantId, actorId, scopes) },
    }));
  }

  async function tokenForNative(tenantId: string, actorId: string, scopes: readonly string[]) {
    return `Bearer ${await signer.issue({ userId: actorId, tenantId, scopes })}`;
  }

  test("serves exact configured, absent and advanced series through signed HTTP without durable effects", async () => {
    const { main, foreign } = manifest;
    if (!main.secondProperty) throw new Error("Order454 main cohort lacks its admitted second property");
    const before = await snapshot();
    try {
      const configured = await request(main.propertyNode,
        `supplierRegistrationId=${main.supplierRegistrationId}&documentKind=credit_note`, main.tenantId, main.actorId, [scope]);
      expect(configured.status).toBe(200);
      expect(await configured.json()).toEqual({ series: expectedSeries(main, main.creditNote) });
      expect(configured.headers.get("cache-control")).toBe("no-store");

      const absent = await request(main.propertyNode,
        `supplierRegistrationId=${main.supplierRegistrationId}&documentKind=debit_note`, main.tenantId, main.actorId, [scope]);
      expect(absent.status).toBe(200);
      expect(await absent.json()).toEqual({ series: null });
      expect(absent.headers.get("cache-control")).toBe("no-store");

      const invoice = await request(main.propertyNode,
        `supplierRegistrationId=${main.supplierRegistrationId}&documentKind=invoice`, main.tenantId, main.actorId, [scope]);
      expect(invoice.status).toBe(200);
      expect(await invoice.json()).toEqual({ series: expectedSeries(main, main.invoice, main.propertyNode, main.supplierRegistrationId, "invoice") });
      expect(invoice.headers.get("cache-control")).toBe("no-store");

      const secondProperty = await request(main.secondProperty.propertyNode,
        `supplierRegistrationId=${main.secondProperty.supplierRegistrationId}&documentKind=credit_note`,
        main.tenantId, main.actorId, [scope]);
      expect(secondProperty.status).toBe(200);
      expect(await secondProperty.json()).toEqual({ series: expectedSeries(main, main.secondProperty.creditNote,
        main.secondProperty.propertyNode, main.secondProperty.supplierRegistrationId) });
      expect(secondProperty.headers.get("cache-control")).toBe("no-store");

      const foreignProperty = await request(foreign.propertyNode,
        `supplierRegistrationId=${main.supplierRegistrationId}&documentKind=credit_note`, main.tenantId, main.actorId, [scope]);
      expect(foreignProperty.status).toBe(403);
      expect(foreignProperty.headers.get("cache-control")).toBe("no-store");
      const foreignSupplier = await request(main.propertyNode,
        `supplierRegistrationId=${foreign.supplierRegistrationId}&documentKind=credit_note`, main.tenantId, main.actorId, [scope]);
      expect(foreignSupplier.status).toBe(503);
      expect(foreignSupplier.headers.get("cache-control")).toBe("no-store");
      const foreignActor = await request(main.propertyNode,
        `supplierRegistrationId=${main.supplierRegistrationId}&documentKind=credit_note`, main.tenantId, foreign.actorId, [scope]);
      expect(foreignActor.status).toBe(403);
      expect(foreignActor.headers.get("cache-control")).toBe("no-store");

      for (const scopes of [[], ["tax-fiscal.documents:read"]]) {
        const denied = await request(main.propertyNode,
          `supplierRegistrationId=${main.supplierRegistrationId}&documentKind=credit_note`, main.tenantId, main.actorId, scopes);
        expect(denied.status).toBe(403);
        expect(denied.headers.get("cache-control")).toBe("no-store");
      }
      for (const query of [
        `supplierRegistrationId=${main.supplierRegistrationId}&supplierRegistrationId=${main.supplierRegistrationId}&documentKind=credit_note`,
        `supplierRegistrationId=${main.supplierRegistrationId}&documentKind=credit_note&prefix=caller`,
      ]) {
        const invalid = await request(main.propertyNode, query, main.tenantId, main.actorId, [scope]);
        expect(invalid.status).toBe(400);
        expect(invalid.headers.get("cache-control")).toBe("no-store");
      }
    } finally {
      expect(await snapshot()).toBe(before);
    }
  }, 120_000);

  test("binds each admitted cohort identity to one exact configured series row", async () => {
    for (const cohort of [manifest.main, manifest.foreign]) {
      const [credit] = await deploy<{ count: number }[]>`SELECT count(*)::int count FROM public.document_series
        WHERE tenant_id=${cohort.tenantId}::uuid AND property_node=${cohort.propertyNode}::uuid
          AND supplier_registration_id=${cohort.supplierRegistrationId}::uuid AND kind='credit_note'
          AND id=${cohort.creditNote.seriesId}::uuid`;
      expect(credit?.count).toBe(1);
      const [invoice] = await deploy<{ count: number }[]>`SELECT count(*)::int count FROM public.document_series
        WHERE tenant_id=${cohort.tenantId}::uuid AND property_node=${cohort.propertyNode}::uuid
          AND supplier_registration_id=${cohort.supplierRegistrationId}::uuid AND kind='invoice'
          AND id=${cohort.invoice.seriesId}::uuid`;
      expect(invoice?.count).toBe(1);
    }
    const second = manifest.main.secondProperty;
    if (!second) throw new Error("Order454 main cohort lacks its admitted second property");
    const [secondCredit] = await deploy<{ count: number }[]>`SELECT count(*)::int count FROM public.document_series
      WHERE tenant_id=${manifest.main.tenantId}::uuid AND property_node=${second.propertyNode}::uuid
        AND supplier_registration_id=${second.supplierRegistrationId}::uuid AND kind='credit_note'
        AND id=${second.creditNote.seriesId}::uuid`;
    expect(secondCredit?.count).toBe(1);
  });
});
