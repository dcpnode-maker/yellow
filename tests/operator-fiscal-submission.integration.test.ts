import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";
import { Database, type ConnectionPool, type Tx } from "../src/kernel";
import { Hs256TokenSigner } from "../src/contexts/identity";
import type { FiscalSubmissionReceipt } from "../src/contexts/tax-fiscal";
import {
  FISCAL_REQUEST_SCOPE,
  FISCAL_RETRY_SCOPE,
  createFiscalSubmissionHttpScenario,
  fiscalRequest,
  fiscalRetryRequest,
  fiscalSubmissionHttpApp,
  fiscalToken,
  grantFiscalSubmissionHttpPermissions,
  type FiscalSubmissionHttpBody,
  type FiscalSubmissionHttpScenario,
} from "./fixtures/order440-fiscal-submission-http";

const deployUrl = process.env.YELLOW_ORDER440_HTTP_DEPLOY_DATABASE_URL;
const runtimeUrl = process.env.YELLOW_ORDER440_HTTP_RUNTIME_DATABASE_URL;
if (process.env.YELLOW_REQUIRE_ORDER440_HTTP === "1" && (!deployUrl || !runtimeUrl)) {
  throw new Error("Order440 fiscal HTTP proof requires explicit isolated deploy and runtime URLs");
}

interface ProofDatabaseCoordinates {
  readonly hostname: string;
  readonly port: string;
  readonly database: string;
}

function proofDatabaseCoordinates(value: string, label: string): ProofDatabaseCoordinates {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid PostgreSQL URL`);
  }
  if ((parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") || !parsed.hostname) {
    throw new Error(`${label} must be a valid PostgreSQL URL`);
  }
  let database: string;
  try {
    database = decodeURIComponent(parsed.pathname.slice(1));
  } catch {
    throw new Error(`${label} must be a valid PostgreSQL URL`);
  }
  if (!/^yellow_order440_q203_[a-zA-Z0-9_]+$/.test(database)) {
    throw new Error(`${label} must target a disposable yellow_order440_q203_* database`);
  }
  return Object.freeze({
    hostname: parsed.hostname.toLowerCase(),
    port: parsed.port || "5432",
    database,
  });
}

function assertSameDisposableProofDatabase(deploy: string, runtime: string): void {
  const deployTarget = proofDatabaseCoordinates(deploy, "Q203 deploy URL");
  const runtimeTarget = proofDatabaseCoordinates(runtime, "Q203 runtime URL");
  if (deployTarget.hostname !== runtimeTarget.hostname
    || deployTarget.port !== runtimeTarget.port
    || deployTarget.database !== runtimeTarget.database) {
    throw new Error("Q203 deploy and runtime URLs must target the same host, port, and database");
  }
}

if (deployUrl && runtimeUrl) assertSameDisposableProofDatabase(deployUrl, runtimeUrl);
const databaseDescribe = deployUrl && runtimeUrl ? describe.serial : describe.skip;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const key = (label: string) => `q203-${label}-${crypto.randomUUID()}`;

describe("Q203 HTTP proof target safety", () => {
  test("accepts only disposable Q203 proof database names", () => {
    expect(() => assertSameDisposableProofDatabase(
      "postgresql://deploy:secret@127.0.0.1:55503/yellow_order434_production",
      "postgresql://runtime:secret@127.0.0.1:55503/yellow_order434_production",
    )).toThrow("must target a disposable yellow_order440_q203_* database");
    expect(() => assertSameDisposableProofDatabase(
      "postgresql://deploy:secret@127.0.0.1:55503/yellow_order440_q203_",
      "postgresql://runtime:secret@127.0.0.1:55503/yellow_order440_q203_",
    )).toThrow("must target a disposable yellow_order440_q203_* database");
  });

  test("requires deploy and runtime URLs to share host, port, and database", () => {
    const deploy = "postgresql://deploy:secret@127.0.0.1:55503/yellow_order440_q203_guard";
    for (const runtime of [
      "postgresql://runtime:secret@localhost:55503/yellow_order440_q203_guard",
      "postgresql://runtime:secret@127.0.0.1:55504/yellow_order440_q203_guard",
      "postgresql://runtime:secret@127.0.0.1:55503/yellow_order440_q203_other",
    ]) {
      expect(() => assertSameDisposableProofDatabase(deploy, runtime)).toThrow(
        "must target the same host, port, and database",
      );
    }
  });
});

interface DeliveryEvidence {
  readonly heads: number;
  readonly history: number;
  readonly facts: number;
  readonly events: number;
}

interface ClaimedSubmission {
  readonly claimed: true;
  readonly claimToken: string;
  readonly submissionId: string;
  readonly attemptId: string;
  readonly documentId: string;
  readonly providerKey: string;
  readonly wireSha256: string;
}

const CLOSURE_SCENARIO: FiscalSubmissionHttpScenario = Object.freeze({
  tenantId: "00000000-0000-4000-8000-000000004601",
  propertyNode: "00000000-0000-4000-8000-000000004602",
  actorId: "00000000-0000-4000-8000-000000004603",
  unauthorizedActorId: "00000000-0000-4000-8000-000000004604",
  roleId: "00000000-0000-4000-8000-000000004605",
  documentId: "00000000-0000-4000-8000-000000004606",
  provider: Object.freeze({
    providerKey: "india-irp:test",
    providerExtensionId: "00000000-0000-4000-8000-000000004607",
    providerExtensionVersion: 1,
  }),
});

function closureReceipt(): FiscalSubmissionReceipt {
  return Object.freeze({
    submissionId: "00000000-0000-4000-8000-000000004608",
    tenantId: CLOSURE_SCENARIO.tenantId,
    propertyNode: CLOSURE_SCENARIO.propertyNode,
    documentId: CLOSURE_SCENARIO.documentId,
    documentSha256: "1".repeat(64),
    wireSha256: "2".repeat(64),
    providerKey: CLOSURE_SCENARIO.provider.providerKey,
    providerExtensionId: CLOSURE_SCENARIO.provider.providerExtensionId,
    providerExtensionVersion: CLOSURE_SCENARIO.provider.providerExtensionVersion,
    attemptId: "00000000-0000-4000-8000-000000004609",
    attemptNumber: 1,
    retryCount: 0,
    status: "pending",
    disposition: "send",
    transitionSeq: 1,
    replayed: false,
  });
}

function closureDatabase(commitFailure = false): { database: Database; log: string[]; tx: Tx } {
  const log: string[] = [];
  const tagged = async (strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown[]> => {
    const sql = strings.join("?");
    if (sql.includes("set_config('app.tenant_id'")) {
      log.push("tenant");
      return [{ tenant_id: values[0] }];
    }
    if (sql.includes("current_user = session_user")) {
      log.push("settlement");
      return [{ role_reset: true, tenant_reset: true }];
    }
    if (sql.includes("FROM user_role")) {
      log.push("property-grant");
      return [{ id: CLOSURE_SCENARIO.propertyNode, name: "Hotel", timezone: "UTC", currency: "INR" }];
    }
    throw new Error(`unexpected Q203 closure query: ${sql}`);
  };
  const connection = Object.assign(tagged, {
    async unsafe(sql: string): Promise<unknown[]> {
      if (sql === "BEGIN") log.push("begin");
      else if (sql === "SET LOCAL ROLE app_role") log.push("role");
      else if (sql === "COMMIT") {
        log.push("commit");
        if (commitFailure) throw new Error("private commit failure");
      } else if (sql === "ROLLBACK") log.push("rollback");
      else throw new Error(`unexpected Q203 closure command: ${sql}`);
      return [];
    },
    release() { log.push("release"); },
    async close() { log.push("close"); },
  }) as unknown as Tx;
  const pool: ConnectionPool = { async reserve() { log.push("reserve"); return connection; } };
  return { database: new Database(pool), log, tx: connection };
}

describe("Q203 outer HTTP transaction closure", () => {
  test("failed typed Results throw through middleware and roll back before the sanitized response", async () => {
    const harness = closureDatabase();
    const tokens = new Hs256TokenSigner("q203-failed-result-transaction-closure-secret-value");
    const signed = await fiscalToken(tokens, CLOSURE_SCENARIO);
    let calls = 0;
    let serviceTx: Tx | undefined;
    const failed = {
      async request(tx: Tx) {
        calls += 1;
        serviceTx = tx;
        return { ok: false as const, error: { code: "database_error" as const, message: "private database detail" } };
      },
      async retry(tx: Tx) {
        calls += 1;
        serviceTx = tx;
        return { ok: false as const, error: { code: "database_error" as const, message: "private database detail" } };
      },
    };
    const app = fiscalSubmissionHttpApp(harness.database, tokens, [CLOSURE_SCENARIO.provider], failed);
    const response = await app.handle(fiscalRetryRequest(
      CLOSURE_SCENARIO, signed, closureReceipt().submissionId, key("failed-result"),
    ));
    expect(response.status).toBe(503);
    expect(calls).toBe(1);
    expect(serviceTx as unknown).toBe(harness.tx as unknown);
    expect(harness.log).toEqual([
      "reserve", "begin", "tenant", "role", "property-grant", "rollback", "settlement", "release",
    ]);
    expect(JSON.stringify(await response.json())).not.toMatch(/private|database detail|sql|postgres/i);
  });

  test("a commit failure suppresses a success-shaped receipt and rolls the transaction back", async () => {
    const harness = closureDatabase(true);
    const tokens = new Hs256TokenSigner("q203-failed-commit-transaction-closure-secret-value");
    const signed = await fiscalToken(tokens, CLOSURE_SCENARIO);
    let calls = 0;
    const service = {
      async request(tx: Tx) {
        calls += 1;
        expect(tx as unknown).toBe(harness.tx as unknown);
        return { ok: true as const, value: closureReceipt() };
      },
      async retry() { return { ok: false as const, error: { code: "database_error" as const, message: "unused" } }; },
    };
    const app = fiscalSubmissionHttpApp(harness.database, tokens, [CLOSURE_SCENARIO.provider], service);
    const response = await app.handle(fiscalRequest(CLOSURE_SCENARIO, signed, key("commit-failure")));
    expect(response.status).toBe(503);
    expect(calls).toBe(1);
    expect(harness.log).toEqual([
      "reserve", "begin", "tenant", "role", "property-grant", "commit", "rollback", "settlement", "release",
    ]);
    expect(JSON.stringify(await response.json())).not.toMatch(/private|commit|receipt|sql|postgres/i);
  });
});

databaseDescribe("Q203 signed-session fiscal submission HTTP integration", () => {
  let deploy: SQL;
  let runtime: SQL;
  let database: Database;
  let tokens: Hs256TokenSigner;

  beforeAll(async () => {
    deploy = new SQL(deployUrl!, { max: 4, prepare: false });
    runtime = new SQL(runtimeUrl!, { max: 2, prepare: false });
    database = Database.connect(runtimeUrl!, { maxConnections: 4, prepare: false });
    tokens = new Hs256TokenSigner("q203-fiscal-http-signed-session-secret-48-bytes-minimum");
    const [frontier] = await deploy<{ applied: number; fiscal: string | null }[]>`
      SELECT count(*)::integer AS applied,
             to_regprocedure('public.request_india_fiscal_submission(uuid,uuid,uuid,uuid,uuid,text,uuid)')::text AS fiscal
      FROM public.schema_migration
    `;
    if (frontier?.applied !== 79 || frontier.fiscal === null) {
      throw new Error("Q203 proof database must be an exact canonical79 database");
    }
  });

  afterAll(async () => {
    await database?.close();
    await runtime?.close({ timeout: 0 });
    await deploy?.close({ timeout: 0 });
  });

  async function deliveryEvidence(tenantId: string): Promise<DeliveryEvidence> {
    const [row] = await deploy<DeliveryEvidence[]>`
      SELECT
        (SELECT count(*)::integer FROM public.fiscal_submission WHERE tenant_id=${tenantId}::uuid) AS heads,
        (SELECT count(*)::integer FROM public.fiscal_submission_history WHERE tenant_id=${tenantId}::uuid) AS history,
        (SELECT count(*)::integer FROM public.fact_log
          WHERE tenant_id=${tenantId}::uuid AND entity_type='fiscal_submission') AS facts,
        (SELECT count(*)::integer FROM public.outbox
          WHERE tenant_id=${tenantId}::uuid AND aggregate_type='fiscal_submission') AS events
    `;
    if (!row) throw new Error("Fiscal delivery evidence query returned no row");
    return row;
  }

  async function financialEvidence(tenantId: string): Promise<readonly string[]> {
    const rows: string[] = [];
    for (const table of ["document", "document_series", "journal", "posting_line"] as const) {
      const values = await deploy.unsafe<{ body: string }[]>(
        `SELECT to_jsonb(source)::text AS body FROM public.${table} source WHERE tenant_id=$1::uuid ORDER BY to_jsonb(source)::text`,
        [tenantId],
      );
      rows.push(...values.map(({ body }) => `${table}:${body}`));
    }
    return rows;
  }

  async function makeKnownNotSent(scenario: FiscalSubmissionHttpScenario, submissionId: string): Promise<void> {
    const claim = await runtime.begin(async (tx) => {
      await tx`SELECT set_config('app.tenant_id',${scenario.tenantId},true)`;
      const [row] = await tx<{ receipt: ClaimedSubmission }[]>`
        SELECT public.claim_india_fiscal_submission(
          ${scenario.tenantId}::uuid, ${submissionId}::uuid, 60
        ) AS receipt
      `;
      if (!row?.receipt.claimed) throw new Error("Q203 setup could not claim the durable submission");
      return row.receipt;
    });
    await runtime.begin(async (tx) => {
      await tx`SELECT set_config('app.tenant_id',${scenario.tenantId},true)`;
      const normalized = JSON.stringify({
        type: "transport_result",
        tenantId: scenario.tenantId,
        providerKey: claim.providerKey,
        attemptId: claim.attemptId,
        documentId: claim.documentId,
        payloadSha256: claim.wireSha256,
        outcome: "known_not_sent",
      });
      await tx`
        SELECT public.reconcile_india_fiscal_submission(
          ${scenario.tenantId}::uuid, ${submissionId}::uuid, ${claim.attemptId}::uuid,
          ${claim.claimToken}::uuid, ${normalized}::jsonb
        )
      `;
    });
  }

  test("routes are served while zero default grants and the empty production-style directory prevent persistence", async () => {
    const scenario = await createFiscalSubmissionHttpScenario(deploy, database, false);
    const signed = await fiscalToken(tokens, scenario);
    const app = fiscalSubmissionHttpApp(database, tokens, []);
    const denied = await app.handle(fiscalRequest(scenario, signed, key("default-deny")));
    expect(denied.status).toBe(403);
    expect(await deliveryEvidence(scenario.tenantId)).toEqual({ heads: 0, history: 0, facts: 0, events: 0 });

    await grantFiscalSubmissionHttpPermissions(deploy, scenario);
    const unavailable = await app.handle(fiscalRequest(scenario, signed, key("empty-directory")));
    expect(unavailable.status).toBe(503);
    expect(await unavailable.json()).toMatchObject({
      type: "service/unavailable", title: "Service unavailable", status: 503,
    });
    expect(await deliveryEvidence(scenario.tenantId)).toEqual({ heads: 0, history: 0, facts: 0, events: 0 });
  }, 30_000);

  test("a real signed request commits once, replays exactly and preserves financial and other-tenant truth", async () => {
    const scenario = await createFiscalSubmissionHttpScenario(deploy, database);
    const other = await createFiscalSubmissionHttpScenario(deploy, database);
    const beforeFinance = await financialEvidence(scenario.tenantId);
    const otherFinance = await financialEvidence(other.tenantId);
    const token = await fiscalToken(tokens, scenario);
    const otherToken = await fiscalToken(tokens, other);
    const app = fiscalSubmissionHttpApp(database, tokens, [scenario.provider, other.provider]);
    const idempotencyKey = key("request-replay");

    const first = await app.handle(fiscalRequest(scenario, token, idempotencyKey));
    expect(first.status).toBe(201);
    expect(first.headers.get("cache-control")).toBe("no-store");
    expect(first.headers.get("idempotency-replayed")).toBe("false");
    expect(first.headers.get("x-correlation-id")).toMatch(UUID);
    const firstBody = await first.json() as FiscalSubmissionHttpBody;
    expect(firstBody.fiscalSubmission).toMatchObject({
      documentId: scenario.documentId,
      attemptNumber: 1,
      retryCount: 0,
      status: "pending",
      disposition: "send",
      transitionSeq: 1,
      provider: {
        key: scenario.provider.providerKey,
        extensionId: scenario.provider.providerExtensionId,
        extensionVersion: scenario.provider.providerExtensionVersion,
      },
      replayed: false,
    });
    expect(Object.keys(firstBody.fiscalSubmission).sort()).toEqual([
      "attemptId", "attemptNumber", "disposition", "documentId", "provider", "replayed",
      "retryCount", "status", "submissionId", "transitionSeq",
    ]);
    expect(JSON.stringify(firstBody)).not.toMatch(/tenant|actor|sha256|wire|claim|credential|response/i);

    const replay = await app.handle(fiscalRequest(scenario, token, idempotencyKey));
    expect(replay.status).toBe(201);
    expect(replay.headers.get("idempotency-replayed")).toBe("true");
    const replayBody = await replay.json() as FiscalSubmissionHttpBody;
    expect(replayBody).toEqual(firstBody);
    expect(await deliveryEvidence(scenario.tenantId)).toEqual({ heads: 1, history: 1, facts: 1, events: 1 });

    const otherRequest = await app.handle(fiscalRequest(other, otherToken, key("other-tenant-source")));
    expect(otherRequest.status).toBe(201);
    const otherBody = await otherRequest.json() as FiscalSubmissionHttpBody;
    expect(otherBody.fiscalSubmission.documentId).toBe(other.documentId);
    const scenarioBeforeDenials = await deliveryEvidence(scenario.tenantId);
    const otherBeforeDenials = await deliveryEvidence(other.tenantId);
    expect(scenarioBeforeDenials).toEqual({ heads: 1, history: 1, facts: 1, events: 1 });
    expect(otherBeforeDenials).toEqual({ heads: 1, history: 1, facts: 1, events: 1 });

    const foreignProperty = await app.handle(fiscalRequest(other, token, key("existing-foreign-property")));
    expect(foreignProperty.status).toBe(403);
    const foreignPropertyCorrelation = foreignProperty.headers.get("x-correlation-id");
    expect(foreignPropertyCorrelation).toMatch(UUID);
    expect(await foreignProperty.json()).toEqual({
      type: "auth/property_forbidden",
      title: "Forbidden",
      status: 403,
      detail: "Property access is not granted",
      correlation_id: foreignPropertyCorrelation,
    });

    const foreignDocument = await app.handle(fiscalRequest(scenario, token, key("existing-foreign-document"), {
      documentId: other.documentId,
      providerExtensionId: scenario.provider.providerExtensionId,
    }));
    expect(foreignDocument.status).toBe(503);
    const foreignDocumentCorrelation = foreignDocument.headers.get("x-correlation-id");
    expect(foreignDocumentCorrelation).toMatch(UUID);
    expect(await foreignDocument.json()).toEqual({
      type: "service/unavailable",
      title: "Service unavailable",
      status: 503,
      detail: "Operator service is temporarily unavailable",
      correlation_id: foreignDocumentCorrelation,
    });

    const foreignSubmission = await app.handle(fiscalRetryRequest(
      scenario, token, otherBody.fiscalSubmission.submissionId, key("existing-foreign-submission"),
    ));
    expect(foreignSubmission.status).toBe(503);
    const foreignSubmissionCorrelation = foreignSubmission.headers.get("x-correlation-id");
    expect(foreignSubmissionCorrelation).toMatch(UUID);
    expect(await foreignSubmission.json()).toEqual({
      type: "service/unavailable",
      title: "Service unavailable",
      status: 503,
      detail: "Operator service is temporarily unavailable",
      correlation_id: foreignSubmissionCorrelation,
    });
    expect(await deliveryEvidence(scenario.tenantId)).toEqual(scenarioBeforeDenials);
    expect(await deliveryEvidence(other.tenantId)).toEqual(otherBeforeDenials);
    expect(await financialEvidence(scenario.tenantId)).toEqual(beforeFinance);
    expect(await financialEvidence(other.tenantId)).toEqual(otherFinance);

    await deploy`DELETE FROM public.role_permission
      WHERE role_id=${scenario.roleId}::uuid AND permission_code=${FISCAL_REQUEST_SCOPE}`;
    const revokedReplay = await app.handle(fiscalRequest(scenario, token, idempotencyKey));
    expect(revokedReplay.status).toBe(403);
    expect(await deliveryEvidence(scenario.tenantId)).toEqual({ heads: 1, history: 1, facts: 1, events: 1 });
    expect(await financialEvidence(scenario.tenantId)).toEqual(beforeFinance);
    expect(await deliveryEvidence(other.tenantId)).toEqual({ heads: 1, history: 1, facts: 1, events: 1 });
    expect(await financialEvidence(other.tenantId)).toEqual(otherFinance);
  }, 30_000);

  test("known-not-sent retry rechecks binding, rolls mismatches back, then commits and replays on the same key", async () => {
    const scenario = await createFiscalSubmissionHttpScenario(deploy, database);
    const token = await fiscalToken(tokens, scenario);
    const app = fiscalSubmissionHttpApp(database, tokens, [scenario.provider]);
    const requested = await app.handle(fiscalRequest(scenario, token, key("retry-source")));
    const requestBody = await requested.json() as FiscalSubmissionHttpBody;
    await makeKnownNotSent(scenario, requestBody.fiscalSubmission.submissionId);
    expect(await deliveryEvidence(scenario.tenantId)).toEqual({ heads: 1, history: 3, facts: 3, events: 3 });

    const wrongIdentity = { ...scenario.provider, providerKey: "india-irp:wrong" };
    const mismatchApp = fiscalSubmissionHttpApp(database, tokens, [wrongIdentity]);
    const retryKey = key("retry-binding");
    const mismatch = await mismatchApp.handle(fiscalRetryRequest(
      scenario, token, requestBody.fiscalSubmission.submissionId, retryKey,
    ));
    expect(mismatch.status).toBe(503);
    expect(await deliveryEvidence(scenario.tenantId)).toEqual({ heads: 1, history: 3, facts: 3, events: 3 });

    const first = await app.handle(fiscalRetryRequest(
      scenario, token, requestBody.fiscalSubmission.submissionId, retryKey,
    ));
    expect(first.status).toBe(201);
    const firstBody = await first.json() as FiscalSubmissionHttpBody;
    expect(firstBody.fiscalSubmission).toMatchObject({
      submissionId: requestBody.fiscalSubmission.submissionId,
      attemptNumber: 2,
      retryCount: 1,
      status: "pending",
      disposition: "send",
      transitionSeq: 4,
      replayed: false,
    });
    const replay = await app.handle(fiscalRetryRequest(
      scenario, token, requestBody.fiscalSubmission.submissionId, retryKey,
    ));
    expect(replay.status).toBe(201);
    expect(replay.headers.get("idempotency-replayed")).toBe("true");
    expect(await deliveryEvidence(scenario.tenantId)).toEqual({ heads: 1, history: 4, facts: 4, events: 4 });
    await deploy`DELETE FROM public.role_permission
      WHERE role_id=${scenario.roleId}::uuid AND permission_code=${FISCAL_RETRY_SCOPE}`;
    const revokedReplay = await app.handle(fiscalRetryRequest(
      scenario, token, requestBody.fiscalSubmission.submissionId, retryKey,
    ));
    expect(revokedReplay.status).toBe(403);
    expect(await deliveryEvidence(scenario.tenantId)).toEqual({ heads: 1, history: 4, facts: 4, events: 4 });
  }, 30_000);

  test("verified-session tenant, scope, property, actor and exact ingress failures create no fiscal evidence", async () => {
    const scenario = await createFiscalSubmissionHttpScenario(deploy, database);
    const token = await fiscalToken(tokens, scenario);
    const app = fiscalSubmissionHttpApp(database, tokens, [scenario.provider]);
    const validUrl = `http://yellow.test/api/v1/properties/${scenario.propertyNode}/fiscal-submissions`;
    const body = JSON.stringify({ documentId: scenario.documentId,
      providerExtensionId: scenario.provider.providerExtensionId });

    expect((await app.handle(new Request(validUrl, { method: "POST", body,
      headers: { "content-type": "application/json", "idempotency-key": key("no-auth") } }))).status).toBe(401);
    const noScope = await fiscalToken(tokens, scenario, []);
    expect((await app.handle(fiscalRequest(scenario, noScope, key("no-scope")))).status).toBe(403);
    const otherActor = await fiscalToken(tokens, { tenantId: scenario.tenantId, actorId: scenario.unauthorizedActorId });
    expect((await app.handle(fiscalRequest(scenario, otherActor, key("other-actor")))).status).toBe(403);
    const foreignTenant = await tokens.issue({ userId: scenario.actorId, tenantId: crypto.randomUUID(),
      scopes: [FISCAL_REQUEST_SCOPE, FISCAL_RETRY_SCOPE] });
    expect((await app.handle(fiscalRequest(scenario, foreignTenant, key("foreign-tenant")))).status).toBe(403);
    const requestOnlyToken = await fiscalToken(tokens, scenario, [FISCAL_REQUEST_SCOPE]);
    expect((await app.handle(fiscalRetryRequest(
      scenario, requestOnlyToken, crypto.randomUUID(), key("retry-no-scope"),
    ))).status).toBe(403);

    for (const request of [
      fiscalRequest(scenario, token, key("surplus"), { documentId: scenario.documentId,
        providerExtensionId: scenario.provider.providerExtensionId, verified: true }),
      fiscalRequest(scenario, token, key("invalid-document"), { documentId: "bad",
        providerExtensionId: scenario.provider.providerExtensionId }),
      fiscalRequest(scenario, token, key("query"), undefined, "?force=true"),
      fiscalRequest(scenario, token, "short"),
      new Request(validUrl, { method: "POST", body,
        headers: { authorization: `Bearer ${token}`, "content-type": "text/plain", "idempotency-key": key("media") } }),
    ]) {
      expect((await app.handle(request)).status).toBe(400);
    }
    for (const request of [
      fiscalRetryRequest(scenario, token, crypto.randomUUID(), key("retry-surplus"), {
        providerExtensionId: scenario.provider.providerExtensionId, verified: true,
      }),
      fiscalRetryRequest(scenario, token, crypto.randomUUID(), key("retry-query"), undefined, "?force=true"),
      fiscalRetryRequest(scenario, token, crypto.randomUUID(), "short"),
    ]) {
      expect((await app.handle(request)).status).toBe(400);
    }

    await deploy`UPDATE public.app_user SET status='disabled'
      WHERE tenant_id=${scenario.tenantId}::uuid AND id=${scenario.actorId}::uuid`;
    const revoked = await app.handle(fiscalRequest(scenario, token, key("revoked-actor")));
    expect(revoked.status).toBe(503);
    expect(JSON.stringify(await revoked.json())).not.toMatch(/actor|permission|sql|postgres|fiscal_submission/i);
    expect(await deliveryEvidence(scenario.tenantId)).toEqual({ heads: 0, history: 0, facts: 0, events: 0 });
  }, 30_000);

  test("malformed service receipts and late outbox failure are sanitized after rollback, then the same key succeeds", async () => {
    const scenario = await createFiscalSubmissionHttpScenario(deploy, database);
    const token = await fiscalToken(tokens, scenario);
    const malformed = {
      async request() { return { ok: true as const, value: { privateCredential: "do-not-render" } as never }; },
      async retry() { return { ok: false as const, error: { code: "database_error" as const, message: "private" } }; },
    };
    const malformedApp = fiscalSubmissionHttpApp(database, tokens, [scenario.provider], malformed);
    const malformedResponse = await malformedApp.handle(fiscalRequest(scenario, token, key("malformed-receipt")));
    expect(malformedResponse.status).toBe(503);
    expect(JSON.stringify(await malformedResponse.json())).not.toMatch(/private|credential|receipt|sql|postgres/i);
    expect(await deliveryEvidence(scenario.tenantId)).toEqual({ heads: 0, history: 0, facts: 0, events: 0 });

    const beforeFinance = await financialEvidence(scenario.tenantId);
    if (!UUID.test(scenario.tenantId)) throw new Error("Generated Q203 tenant is invalid");
    await deploy.unsafe(`ALTER TABLE public.outbox ADD CONSTRAINT q203_http_late_outbox_failure
      CHECK (tenant_id <> '${scenario.tenantId}'::uuid) NOT VALID`);
    const app = fiscalSubmissionHttpApp(database, tokens, [scenario.provider]);
    const retryableKey = key("late-outbox");
    try {
      const failed = await app.handle(fiscalRequest(scenario, token, retryableKey));
      expect(failed.status).toBe(503);
      expect(JSON.stringify(await failed.json())).not.toMatch(/23514|constraint|outbox|sql|postgres|credential/i);
    } finally {
      await deploy.unsafe("ALTER TABLE public.outbox DROP CONSTRAINT q203_http_late_outbox_failure");
    }
    expect(await deliveryEvidence(scenario.tenantId)).toEqual({ heads: 0, history: 0, facts: 0, events: 0 });
    expect(await financialEvidence(scenario.tenantId)).toEqual(beforeFinance);

    const recovered = await app.handle(fiscalRequest(scenario, token, retryableKey));
    expect(recovered.status).toBe(201);
    expect(recovered.headers.get("idempotency-replayed")).toBe("false");
    expect(await deliveryEvidence(scenario.tenantId)).toEqual({ heads: 1, history: 1, facts: 1, events: 1 });
  }, 30_000);
});
