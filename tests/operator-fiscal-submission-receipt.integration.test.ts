import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import { createApp } from "../src/app";
import { BearerTenantResolver, Hs256TokenSigner } from "../src/contexts/identity";
import {
  FiscalSubmissionAdapterAvailabilityService,
  FiscalSubmissionReceiptReadService,
  type FiscalSubmissionDeliveryReadResult,
  type FiscalSubmissionDeliveryReceipt,
} from "../src/contexts/tax-fiscal";
import { OperatorHttpApi } from "../src/http/operator";
import { Database, type ConnectionPool, type Tx } from "../src/kernel";
import {
  FISCAL_RECEIPT_READ_SCOPE,
  assertSignedFiscalReceiptProofTargets,
  claimSignedFiscalSubmission,
  createSignedFiscalReceiptFactory,
  createSignedFiscalScenario,
  readSignedFiscalReceipt,
  reconcileSignedFiscalSubmission,
  type SignedFiscalReceiptFactory,
  type SignedFiscalScenario,
} from "./fixtures/order440-signed-fiscal-receipt";

const IDS = Object.freeze({
  tenantId: "00000000-0000-4000-8000-000000008101",
  propertyNode: "00000000-0000-4000-8000-000000008102",
  actorId: "00000000-0000-4000-8000-000000008103",
  submissionId: "00000000-0000-4000-8000-000000008104",
  documentId: "00000000-0000-4000-8000-000000008105",
  attemptId: "00000000-0000-4000-8000-000000008106",
});
const HASH = (character: string) => character.repeat(64);
const SIGNED_TOKEN = "e30.e30.YQ";
const signedTokenHash = new Bun.CryptoHasher("sha256").update(SIGNED_TOKEN).digest("hex");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function common(status: FiscalSubmissionDeliveryReceipt["status"], disposition: FiscalSubmissionDeliveryReceipt["disposition"]) {
  return {
    submissionId: IDS.submissionId, tenantId: IDS.tenantId, propertyNode: IDS.propertyNode,
    documentId: IDS.documentId, documentSha256: HASH("a"), wireSha256: HASH("b"),
    providerKey: "india-irp:fictional", attemptId: IDS.attemptId, attemptNumber: 1,
    status, disposition, transitionSeq: 7,
  } as const;
}

const verification = Object.freeze({
  profileVersion: "yellow_native_india_1_1_v1" as const,
  issuer: "YELLOW-FICTIONAL-IRP", verificationUnixMs: 1_800_000_000_000,
  invoiceKeyId: "invoice-key", invoiceKeySpkiSha256: HASH("c"), invoiceBundleVersion: "bundle-v1",
  qrKeyId: "qr-key", qrKeySpkiSha256: HASH("d"), qrBundleVersion: "bundle-v1",
});

const variants: readonly FiscalSubmissionDeliveryReceipt[] = Object.freeze([
  Object.freeze({ ...common("pending", "send"), kind: "pending" as const }),
  Object.freeze({ ...common("accepted", "none"), kind: "legacy_hash_only" as const,
    authorityRef: "legacy-reference", responseSha256: HASH("e") }),
  Object.freeze({ ...common("rejected", "none"), kind: "rejected" as const,
    environment: "sandbox" as const, responseSha256: HASH("f"), errorCodes: Object.freeze(["FICTIONAL-E100"]) }),
  Object.freeze({ ...common("error", "none"), kind: "provider_cancelled" as const,
    environment: "production" as const, responseSha256: HASH("1"), providerStatus: "CNL" as const }),
  Object.freeze({ ...common("accepted", "none"), kind: "accepted_signed_v1" as const,
    environment: "sandbox" as const, responseSha256: HASH("2"), irn: HASH("3"),
    ackNo: "90071992547409991", ackDt: "2044-09-07 12:34:56",
    signedInvoice: SIGNED_TOKEN, signedQRCode: SIGNED_TOKEN,
    signedInvoiceSha256: signedTokenHash, signedQrSha256: signedTokenHash, verification }),
]);

interface MockHarness {
  readonly database: Database;
  readonly tx: Tx;
  readonly log: string[];
  grantsProperty: boolean;
}

function mockHarness(): MockHarness {
  const log: string[] = [];
  const harness = { grantsProperty: true } as MockHarness;
  const tagged = async (strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown[]> => {
    const statement = strings.join("?");
    if (statement.includes("set_config('app.tenant_id'")) {
      log.push(`tenant:${String(values[0])}`);
      return [{ tenant_id: values[0] }];
    }
    if (statement.includes("current_user = session_user")) {
      log.push("settlement");
      return [{ role_reset: true, tenant_reset: true }];
    }
    if (statement.includes("FROM user_role")) {
      log.push(`property-grant:${String(values[1])}:${String(values[0])}`);
      return harness.grantsProperty
        ? [{ id: IDS.propertyNode, name: "Fictional Hotel", timezone: "UTC", currency: "INR" }]
        : [];
    }
    throw new Error("unexpected Q207 mocked transaction query");
  };
  const connection = Object.assign(tagged, {
    async unsafe(statement: string): Promise<unknown[]> {
      if (statement === "BEGIN") log.push("begin");
      else if (statement === "SET LOCAL ROLE app_role") log.push("role");
      else if (statement === "COMMIT") log.push("commit");
      else if (statement === "ROLLBACK") log.push("rollback");
      else throw new Error("unexpected Q207 mocked transaction command");
      return [];
    },
    release() { log.push("release"); },
    async close() { log.push("close"); },
  }) as unknown as Tx;
  const pool: ConnectionPool = { async reserve() { log.push("reserve"); return connection; } };
  Object.assign(harness, { database: new Database(pool), tx: connection, log });
  return harness;
}

type ReceiptReader = Pick<FiscalSubmissionReceiptReadService, "read">;

function receiptHttpApp(database: Database, tokens: Hs256TokenSigner, receipts: ReceiptReader) {
  const unusedSubmissions = {
    async request() { throw new Error("receipt GET must not request a fiscal submission"); },
    async retry() { throw new Error("receipt GET must not retry a fiscal submission"); },
  };
  const dependencies = {
    submissions: unusedSubmissions,
    adapters: new FiscalSubmissionAdapterAvailabilityService([]),
    receipts,
  };
  const OperatorConstructor = OperatorHttpApi as unknown as new (...args: unknown[]) => OperatorHttpApi;
  const operator = new OperatorConstructor(
    {}, undefined, ...Array.from({ length: 44 }, () => undefined), dependencies,
  );
  return createApp({ database, tenantResolver: new BearerTenantResolver(tokens), operatorApi: operator });
}

function receiptRequest(
  token: string,
  propertyNode: string = IDS.propertyNode,
  submissionId: string = IDS.submissionId,
  suffix = "",
) {
  return new Request(
    `http://yellow.test/api/v1/properties/${propertyNode}/fiscal-submissions/${submissionId}/receipt${suffix}`,
    { headers: { authorization: `Bearer ${token}`, "x-correlation-id": crypto.randomUUID() } },
  );
}

async function signedToken(tokens: Hs256TokenSigner, input: { tenantId?: string; actorId?: string;
  scopes?: readonly string[] } = {}): Promise<string> {
  return tokens.issue({ userId: input.actorId ?? IDS.actorId, tenantId: input.tenantId ?? IDS.tenantId,
    scopes: input.scopes ?? [FISCAL_RECEIPT_READ_SCOPE] });
}

function fixedReader(result: FiscalSubmissionDeliveryReadResult, calls: unknown[]): ReceiptReader {
  return { async read(tx: Tx, input: unknown) { calls.push({ tx, input }); return result; } };
}

describe("Q207 fiscal delivery receipt read service", () => {
  test("binds all four identities to the governed SQL projection and detaches the exact DTO", async () => {
    for (const expected of variants) {
      let captured: readonly unknown[] = [];
      const tx = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
        expect(strings.join("?")).toContain("read_india_fiscal_submission_delivery_receipt");
        captured = values;
        return [{ receipt: JSON.parse(JSON.stringify(expected)) }];
      }) as unknown as Tx;
      const result = await new FiscalSubmissionReceiptReadService().read(tx, {
        tenantId: IDS.tenantId, propertyNode: IDS.propertyNode,
        submissionId: IDS.submissionId, actorId: IDS.actorId,
      });
      expect(captured).toEqual([IDS.tenantId, IDS.propertyNode, IDS.submissionId, IDS.actorId]);
      expect(result).toEqual({ ok: true, value: expected });
      if (result.ok && result.value) {
        expect(Object.isFrozen(result.value)).toBe(true);
        if (result.value.kind === "rejected") expect(Object.isFrozen(result.value.errorCodes)).toBe(true);
        if (result.value.kind === "accepted_signed_v1") expect(Object.isFrozen(result.value.verification)).toBe(true);
      }
    }
  });

  test("rejects hostile input and sanitizes malformed rows and database failures", async () => {
    let calls = 0;
    const unused = (async () => { calls++; return []; }) as unknown as Tx;
    const service = new FiscalSubmissionReceiptReadService();
    expect(await service.read(unused, { tenantId: IDS.tenantId, propertyNode: IDS.propertyNode,
      submissionId: "bad", actorId: IDS.actorId })).toEqual({ ok: false, error: {
      code: "invalid_input", message: "Fiscal delivery receipt could not be read" } });
    expect(calls).toBe(0);
    const malformed = (async () => [{ receipt: { ...variants[0], rawResponseBase64: "private" } }]) as unknown as Tx;
    expect(await service.read(malformed, { tenantId: IDS.tenantId, propertyNode: IDS.propertyNode,
      submissionId: IDS.submissionId, actorId: IDS.actorId })).toEqual({ ok: false, error: {
      code: "invalid_receipt", message: "Fiscal delivery receipt could not be read" } });
    const failed = (async () => { throw new Error("private database credentials and SQL"); }) as unknown as Tx;
    expect(await service.read(failed, { tenantId: IDS.tenantId, propertyNode: IDS.propertyNode,
      submissionId: IDS.submissionId, actorId: IDS.actorId })).toEqual({ ok: false, error: {
      code: "database_error", message: "Fiscal delivery receipt could not be read" } });
  });
});

describe("Q207 signed-session fiscal receipt HTTP boundary", () => {
  test("returns every exact receipt variant without an adapter, idempotency header, or private evidence", async () => {
    const tokens = new Hs256TokenSigner("q207-receipt-http-fictional-signing-secret-48-bytes");
    const token = await signedToken(tokens);
    for (const receipt of variants) {
      const harness = mockHarness();
      const calls: unknown[] = [];
      const app = receiptHttpApp(harness.database, tokens,
        fixedReader({ ok: true, value: receipt }, calls));
      const response = await app.handle(receiptRequest(token));
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(await response.json()).toEqual({ fiscalSubmissionReceipt: receipt });
      expect(calls).toEqual([{ tx: harness.tx, input: { tenantId: IDS.tenantId,
        propertyNode: IDS.propertyNode, submissionId: IDS.submissionId, actorId: IDS.actorId } }]);
      expect(harness.log).toEqual(["reserve", "begin", `tenant:${IDS.tenantId}`, "role",
        `property-grant:${IDS.actorId}:${FISCAL_RECEIPT_READ_SCOPE}`, "commit", "settlement", "release"]);
      expect(JSON.stringify(receipt)).not.toMatch(/rawResponse|decryptedData|sourceContent|wireJson|claimToken|password|AppKey|SEK/u);
    }
  });

  test("rejects auth, scope, UUID, query, property and revoked grants before reading", async () => {
    const tokens = new Hs256TokenSigner("q207-receipt-http-fictional-signing-secret-48-bytes");
    const harness = mockHarness();
    const calls: unknown[] = [];
    const app = receiptHttpApp(harness.database, tokens,
      fixedReader({ ok: true, value: variants[0]! }, calls));
    const token = await signedToken(tokens);
    const noScope = await signedToken(tokens, { scopes: [] });
    const otherActor = await signedToken(tokens, { actorId: "00000000-0000-4000-8000-000000008199" });

    expect((await app.handle(receiptRequest("not-a-token"))).status).toBe(401);
    expect((await app.handle(receiptRequest(noScope))).status).toBe(403);
    expect((await app.handle(receiptRequest(token, "bad"))).status).toBe(400);
    expect((await app.handle(receiptRequest(token, IDS.propertyNode, "bad"))).status).toBe(400);
    expect((await app.handle(receiptRequest(token, IDS.propertyNode, IDS.submissionId, "?raw=true"))).status).toBe(400);
    expect(calls).toHaveLength(0);

    harness.grantsProperty = false;
    expect((await app.handle(receiptRequest(token))).status).toBe(403);
    expect((await app.handle(receiptRequest(otherActor))).status).toBe(403);
    expect(calls).toHaveLength(0);
  });

  test("does not leak missing or foreign existence and sanitizes reader failures", async () => {
    const tokens = new Hs256TokenSigner("q207-receipt-http-fictional-signing-secret-48-bytes");
    const token = await signedToken(tokens);
    const missingApp = receiptHttpApp(mockHarness().database, tokens,
      fixedReader({ ok: true, value: null }, []));
    const missing = await missingApp.handle(receiptRequest(token));
    const foreign = await missingApp.handle(receiptRequest(token, IDS.propertyNode,
      "00000000-0000-4000-8000-000000008199"));
    expect(missing.status).toBe(404);
    expect(foreign.status).toBe(404);
    const missingBody = await missing.json() as Record<string, unknown>;
    const foreignBody = await foreign.json() as Record<string, unknown>;
    expect({ ...missingBody, correlation_id: null }).toEqual({ ...foreignBody, correlation_id: null });

    for (const result of [
      { ok: false as const, error: { code: "database_error" as const, message: "private SQL and password" } },
      { ok: true as const, value: { ...variants[0], tenantId: crypto.randomUUID() } as FiscalSubmissionDeliveryReceipt },
    ]) {
      const failedApp = receiptHttpApp(mockHarness().database, tokens, fixedReader(result, []));
      const response = await failedApp.handle(receiptRequest(token));
      expect(response.status).toBe(503);
      const body = await response.json();
      expect(body).toMatchObject({ type: "service/unavailable", title: "Service unavailable", status: 503,
        detail: "Operator service is temporarily unavailable" });
      expect(JSON.stringify(body)).not.toMatch(/private|password|sql|postgres|rawResponse|decryptedData/iu);
    }
  });
});

const deployUrl = process.env.YELLOW_ORDER440_SIGNED_DEPLOY_DATABASE_URL;
const runtimeUrl = process.env.YELLOW_ORDER440_SIGNED_RUNTIME_DATABASE_URL;
if (process.env.YELLOW_REQUIRE_ORDER440_SIGNED === "1" && (!deployUrl || !runtimeUrl)) {
  throw new Error("Required Q207 signed receipt HTTP proof needs explicit deploy and runtime URLs");
}
if (deployUrl && runtimeUrl) assertSignedFiscalReceiptProofTargets(deployUrl, runtimeUrl);
const databaseDescribe = deployUrl && runtimeUrl ? describe.serial : describe.skip;

databaseDescribe("Q207 canonical81 signed-session receipt GET", () => {
  let deploy: SQL;
  let runtime: SQL;
  let database: Database;
  let tokens: Hs256TokenSigner;
  let receipts: SignedFiscalReceiptFactory;
  let scenario: SignedFiscalScenario;

  beforeAll(async () => {
    deploy = new SQL(deployUrl!, { max: 3, prepare: false, connectionTimeout: 5 });
    runtime = new SQL(runtimeUrl!, { max: 3, prepare: false, connectionTimeout: 5 });
    database = Database.connect(runtimeUrl!, { maxConnections: 3, prepare: false });
    const [frontier] = await deploy<{ version: number; reader: string | null }[]>`
      SELECT max(version)::integer AS version,
        to_regprocedure('public.read_india_fiscal_submission_delivery_receipt(uuid,uuid,uuid,uuid)')::text AS reader
      FROM public.schema_migration`;
    if (frontier?.version !== 81 || frontier.reader === null) {
      throw new Error("Q207 receipt HTTP proof requires canonical81");
    }
    tokens = new Hs256TokenSigner("q207-receipt-http-database-fictional-secret-48-bytes");
    receipts = await createSignedFiscalReceiptFactory();
    scenario = await createSignedFiscalScenario(deploy, runtime, database);
    const claim = await claimSignedFiscalSubmission(runtime, scenario);
    await reconcileSignedFiscalSubmission(runtime, scenario, claim, await receipts.accepted(claim));
  }, 120_000);

  afterAll(async () => {
    await database?.close();
    await runtime?.close({ timeout: 0 });
    await deploy?.close({ timeout: 0 });
  }, 60_000);

  test("serves the genuine retained signed projection and rechecks current actor/property permission", async () => {
    const token = await tokens.issue({ userId: scenario.actorId, tenantId: scenario.tenantId,
      scopes: [FISCAL_RECEIPT_READ_SCOPE] });
    const app = receiptHttpApp(database, tokens, new FiscalSubmissionReceiptReadService());
    const first = await app.handle(receiptRequest(token, scenario.propertyNode, scenario.submissionId));
    expect(first.status).toBe(200);
    expect(first.headers.get("cache-control")).toBe("no-store");
    const body = await first.json() as { fiscalSubmissionReceipt: FiscalSubmissionDeliveryReceipt };
    expect(body.fiscalSubmissionReceipt).toEqual(
      await readSignedFiscalReceipt(runtime, scenario) as FiscalSubmissionDeliveryReceipt,
    );
    expect(body.fiscalSubmissionReceipt).toMatchObject({ kind: "accepted_signed_v1",
      tenantId: scenario.tenantId, propertyNode: scenario.propertyNode,
      submissionId: scenario.submissionId, documentId: scenario.documentId });
    expect(JSON.stringify(body)).not.toMatch(/rawResponse|decryptedData|sourceContent|wireJson|claimToken|password|AppKey|SEK/u);

    const other = await createSignedFiscalScenario(deploy, runtime, database);
    const absent = await app.handle(receiptRequest(token, scenario.propertyNode, other.submissionId));
    expect(absent.status).toBe(404);
    const unauthorized = await tokens.issue({ userId: scenario.unauthorizedActorId, tenantId: scenario.tenantId,
      scopes: [FISCAL_RECEIPT_READ_SCOPE] });
    expect((await app.handle(receiptRequest(unauthorized, scenario.propertyNode, scenario.submissionId))).status).toBe(403);
    expect((await app.handle(receiptRequest(token, other.propertyNode, scenario.submissionId))).status).toBe(403);
    await deploy`DELETE FROM public.role_permission WHERE role_id=${scenario.roleId}::uuid
      AND permission_code=${FISCAL_RECEIPT_READ_SCOPE}`;
    expect((await app.handle(receiptRequest(token, scenario.propertyNode, scenario.submissionId))).status).toBe(403);
  }, 90_000);
});
