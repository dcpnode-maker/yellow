import { describe, expect, test } from "bun:test";
import { afterAll, beforeAll } from "bun:test";
import { SQL } from "bun";
import { createApp } from "../src/app";
import { BearerTenantResolver, Hs256TokenSigner, type LocalLoginService } from "../src/contexts/identity";
import { Database, type Tx } from "../src/kernel";
import { FiscalSubmissionRepository, FiscalSubmissionWorker, VerifiedIndiaIrpAdapterRegistry } from "../src/contexts/tax-fiscal";
import { OperatorHttpApi } from "../src/http/operator";
import { createCreditDeliveryScenario, parseCreditDeliveryTargetMode, assertCreditDeliveryTargets, creditDeliveryRows,
  creditDeliveryProtocolDocument, readCreditDelivery, requestCreditDelivery } from "./fixtures/india-native-credit-delivery-fixture";
import { createOrder447CreditProtocol } from "./fixtures/india-native-credit-submission-fixture";
import { creditSqlState } from "./fixtures/india-native-fiscal-credit-note-fixture";

const deployUrl = process.env.YELLOW_ORDER452_DEPLOY_DATABASE_URL;
const runtimeUrl = process.env.YELLOW_ORDER452_RUNTIME_DATABASE_URL;
const requireDatabase = process.env.YELLOW_REQUIRE_ORDER452_DATABASE === "1";
if (requireDatabase && (!deployUrl || !runtimeUrl)) throw new Error("Required Order452 proof needs exact admitted credentials");
const targetMode = requireDatabase || deployUrl || runtimeUrl
  ? parseCreditDeliveryTargetMode(process.env.YELLOW_ORDER452_TARGET_MODE) : undefined;
if (deployUrl || runtimeUrl) {
  if (!deployUrl || !runtimeUrl) throw new Error("Order452 proof requires paired deploy/runtime credentials");
  assertCreditDeliveryTargets(deployUrl, runtimeUrl, "runtime", targetMode!,
    process.env.YELLOW_REQUIRE_ORDER452_CI_CANONICAL === "1", process.env.YELLOW_ORDER452_CI_DATABASE_ADDRESS,
    process.env.YELLOW_ORDER452_NATIVE_EXECUTION_ADMITTED === "1");
}

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const documents = "tax-fiscal.documents:read";
const submissions = "tax-fiscal.submissions:read";
const signer = new Hs256TokenSigner("order452-signed-session-test-key-not-for-production");
const receipt = {
  kind: "pending", submissionId: id(20), tenantId: id(1), propertyNode: id(2), documentId: id(10),
  documentSha256: "a".repeat(64), wireSha256: "b".repeat(64), providerKey: "clearirp", attemptId: id(21),
  attemptNumber: 1, status: "pending", disposition: "send", transitionSeq: 1,
};

function harness() {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  const control = { grants: new Set([documents, submissions]), delivery: { kind: "receipt", documentId: id(10), receipt }, error: null as string | null };
  const connection = Object.assign(async (parts: TemplateStringsArray, ...values: unknown[]) => {
    const sql = parts.join("?");
    if (sql.includes("set_config('app.tenant_id'")) return [{ tenant_id: values[0] }];
    if (sql.includes("current_user = session_user")) return [{ role_reset: true, tenant_reset: true }];
    if (sql.includes("FROM user_role")) {
      const permission = values.find(value => value === documents || value === submissions);
      return permission && control.grants.has(permission as string)
        ? [{ id: id(2), name: "Test hotel", timezone: "Asia/Kolkata", currency: "INR" }] : [];
    }
    calls.push({ sql, values });
    if (control.error) throw Object.assign(new Error("private credential and SQL"), { errno: control.error });
    if (sql.includes("read_india_native_credit_delivery_by_document")) return [{ delivery: control.delivery }];
    if (sql === "COMMIT") return [];
    throw new Error("unexpected SQL");
  }, {
    async unsafe() { return []; },
    release() {},
    async close() {},
  }) as unknown as Tx;
  const database = new Database({ async reserve() { return connection; } });
  const app = createApp({ database, tenantResolver: new BearerTenantResolver(signer), operatorApi: new OperatorHttpApi({} as LocalLoginService) });
  return { app, calls, control };
}

async function token(scopes: readonly string[], identity: { userId?: string; tenantId?: string } = {}) {
  return `Bearer ${await signer.issue({ userId: identity.userId ?? id(3), tenantId: identity.tenantId ?? id(1), scopes })}`;
}

function url(suffix = "") {
  return `http://yellow.test/api/v1/properties/${id(2)}/credit-notes/${id(10)}/delivery${suffix}`;
}

describe("Order452 native credit delivery HTTP boundary", () => {
  test("requires both signed-session scopes and current property grants before one read", async () => {
    for (const scopes of [[], [documents], [submissions]]) {
      const h = harness();
      const response = await h.app.handle(new Request(url(), { headers: { authorization: await token(scopes) } }));
      expect(response.status).toBe(403);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("idempotency-replayed")).toBeNull();
      expect(h.calls).toHaveLength(0);
    }
    const h = harness();
    const response = await h.app.handle(new Request(url(), { headers: { authorization: await token([documents, submissions]) } }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ delivery: { kind: "receipt", documentId: id(10), receipt } });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-correlation-id")).toMatch(/^[0-9a-f-]{36}$/);
    expect(h.calls).toHaveLength(1);
    expect(h.calls[0]!.values).toEqual([id(1), id(2), id(3), id(10)]);
  });

  test("conceals absent delivery, rejects query selectors and maps sanitized failures", async () => {
    const absent = harness(); absent.control.delivery = null as never;
    const absentResponse = await absent.app.handle(new Request(url(), { headers: { authorization: await token([documents, submissions]) } }));
    expect(absentResponse.status).toBe(404);
    expect(absentResponse.headers.get("cache-control")).toBe("no-store");
    const query = harness();
    const queryResponse = await query.app.handle(new Request(url("?submissionId=" + id(20) + "&submissionId=" + id(21)), { headers: { authorization: await token([documents, submissions]) } }));
    expect(queryResponse.status).toBe(400);
    expect(queryResponse.headers.get("cache-control")).toBe("no-store");
    const unauthenticated = harness();
    const unauthenticatedResponse = await unauthenticated.app.handle(new Request(url()));
    expect(unauthenticatedResponse.status).toBe(401);
    expect(unauthenticatedResponse.headers.get("cache-control")).toBe("no-store");
    for (const badUrl of [
      `http://yellow.test/api/v1/properties/not-a-property/credit-notes/${id(10)}/delivery`,
      `http://yellow.test/api/v1/properties/${id(2)}/credit-notes/not-a-document/delivery`,
      `http://yellow.test/api/v1/properties/${id(99)}/credit-notes/${id(10)}/delivery`,
    ]) {
      const malformed = harness();
      const response = await malformed.app.handle(new Request(badUrl, { headers: { authorization: await token([documents, submissions]) } }));
      expect(response.status).toBe(badUrl.includes(id(99)) ? 403 : 400);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(malformed.calls).toHaveLength(0);
    }
    for (const scope of [documents, submissions]) {
      const denied = harness(); denied.control.grants.delete(scope);
      const response = await denied.app.handle(new Request(url(), { headers: { authorization: await token([documents, submissions]) } }));
      expect(response.status).toBe(403);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(denied.calls).toHaveLength(0);
    }
    for (const error of ["42501", "XX000"] as const) {
      const h = harness(); h.control.error = error;
      const response = await h.app.handle(new Request(url(), { headers: { authorization: await token([documents, submissions]) } }));
      expect(response.status).toBe(error === "42501" ? 403 : 503);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("idempotency-replayed")).toBeNull();
      expect(await response.text()).not.toContain("private credential");
    }
  });
});

const nativeDatabase = requireDatabase ? describe.serial : describe.skip;
nativeDatabase("Order452 admitted native signed-session delivery proof", () => {
  let deploy: SQL;
  let runtime: Database;
  let runtimePool: SQL;
  beforeAll(() => {
    deploy = new SQL(deployUrl!, { max: 2, prepare: false });
    runtime = Database.connect(runtimeUrl!, { maxConnections: 2, prepare: false });
    runtimePool = new SQL(runtimeUrl!, { max: 2, prepare: false });
  });
  afterAll(async () => { await runtime?.close(); await runtimePool?.close({ timeout: 0 }); await deploy?.close(); });

  test("reads the genuine submitted receipt through direct and signed HTTP paths without graph effects", async () => {
    const scenario = await createCreditDeliveryScenario(deploy, runtime);
    const requested = await requestCreditDelivery(runtime, scenario);
    const document = await creditDeliveryProtocolDocument(deploy, requested);
    const protocol = await createOrder447CreditProtocol(document, "accepted");
    const repository = new FiscalSubmissionRepository(runtimePool);
    const registration = await protocol.createRegistration(requested.provider);
    const worker = new FiscalSubmissionWorker(repository, new VerifiedIndiaIrpAdapterRegistry([registration]));
    const workerResult = await worker.runOnce(Object.freeze({
      tenantId: requested.tenantId, submissionId: requested.submissionId, providerKey: requested.provider.providerKey,
      providerExtensionId: requested.provider.providerExtensionId, providerExtensionVersion: requested.provider.providerExtensionVersion,
      leaseSeconds: 60, transportDeadlineMs: 20_000,
    }));
    expect(workerResult).toMatchObject({ ok: true, kind: "reconciled", action: "submit", status: "accepted", disposition: "none" });
    const before = await creditDeliveryRows(deploy);
    const direct = await runtime.withTenantTransaction(requested.tenantId, tx => readCreditDelivery(tx, requested));
    expect(direct).toBeDefined();
    const app = createApp({ database: runtime, tenantResolver: new BearerTenantResolver(signer), operatorApi: new OperatorHttpApi({} as LocalLoginService) });
    const response = await app.handle(new Request(
      `http://yellow.test/api/v1/properties/${requested.propertyNode}/credit-notes/${requested.documentId}/delivery`,
      { headers: { authorization: await token([documents, submissions], { userId: requested.actorId, tenantId: requested.tenantId }) } },
    ));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("idempotency-replayed")).toBeNull();
    expect((await response.json() as { delivery: unknown }).delivery).toEqual(direct);
    const absent = await app.handle(new Request(
      `http://yellow.test/api/v1/properties/${requested.propertyNode}/credit-notes/${id(999)}/delivery`,
      { headers: { authorization: await token([documents, submissions], { userId: requested.actorId, tenantId: requested.tenantId }) } },
    ));
    expect(absent.status).toBe(404);
    expect(absent.headers.get("cache-control")).toBe("no-store");
    expect(absent.headers.get("idempotency-replayed")).toBeNull();
    for (const scopes of [[documents], [submissions]] as const) {
      const denied = await app.handle(new Request(
        `http://yellow.test/api/v1/properties/${requested.propertyNode}/credit-notes/${requested.documentId}/delivery`,
        { headers: { authorization: await token(scopes, { userId: requested.actorId, tenantId: requested.tenantId }) } },
      ));
      expect(denied.status).toBe(403);
      expect(denied.headers.get("cache-control")).toBe("no-store");
    }
    const foreignProperty = await app.handle(new Request(
      `http://yellow.test/api/v1/properties/${id(998)}/credit-notes/${requested.documentId}/delivery`,
      { headers: { authorization: await token([documents, submissions], { userId: requested.actorId, tenantId: requested.tenantId }) } },
    ));
    expect(foreignProperty.status).toBe(403);
    expect(foreignProperty.headers.get("cache-control")).toBe("no-store");
    for (const permission of [documents, submissions]) {
      const [grant] = await deploy<{ role_id: string; permission_code: string }[]>`
        SELECT role_id::text,permission_code FROM public.role_permission
        WHERE role_id=${requested.roleId}::uuid AND permission_code=${permission}`;
      if (!grant) throw new Error("Order452 expected the current permission grant");
      expect(grant).toEqual({ role_id: requested.roleId, permission_code: permission });
      try {
        await deploy`DELETE FROM public.role_permission WHERE role_id=${requested.roleId}::uuid AND permission_code=${permission}`;
        let missingState: string | undefined;
        try {
          await runtime.withTenantTransaction(requested.tenantId,
            tx => readCreditDelivery(tx, { ...requested, documentId: id(999) }));
        } catch (error) { missingState = creditSqlState(error); }
        expect(missingState).toBe("42501");
        let existingState: string | undefined;
        try {
          await runtime.withTenantTransaction(requested.tenantId,
            tx => readCreditDelivery(tx, requested));
        } catch (error) { existingState = creditSqlState(error); }
        expect(existingState).toBe("42501");
        for (const documentId of [requested.documentId, id(999)]) {
          const denied = await app.handle(new Request(
            `http://yellow.test/api/v1/properties/${requested.propertyNode}/credit-notes/${documentId}/delivery`,
            { headers: { authorization: await token([documents, submissions], { userId: requested.actorId, tenantId: requested.tenantId }) } },
          ));
          expect(denied.status).toBe(403);
          expect(denied.headers.get("cache-control")).toBe("no-store");
          expect(denied.headers.get("idempotency-replayed")).toBeNull();
        }
      } finally {
        await deploy`INSERT INTO public.role_permission(role_id,permission_code)
          VALUES(${grant.role_id}::uuid,${grant.permission_code})`;
      }
      await expect(runtime.withTenantTransaction(requested.tenantId,
        tx => readCreditDelivery(tx, requested))).resolves.toBeDefined();
    }
    expect(await creditDeliveryRows(deploy)).toEqual(before);
  }, 120_000);
});
