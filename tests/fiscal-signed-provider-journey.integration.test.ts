import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import { createApp } from "../src/app";
import { BearerTenantResolver, Hs256TokenSigner } from "../src/contexts/identity";
import {
  FiscalSubmissionAdapterAvailabilityService,
  FiscalSubmissionReceiptReadService,
  FiscalSubmissionRepository,
  FiscalSubmissionWorker,
  VerifiedIndiaIrpAdapterRegistry,
  type FiscalSubmissionDeliveryReceipt,
  type FiscalSubmissionWorkerStepResult,
  type VerifiedIndiaIrpAdapterRegistration,
} from "../src/contexts/tax-fiscal";
import { projectIssuedIndiaIrpWireCandidate } from
  "../src/contexts/tax-fiscal/india-irp-issued-wire-candidate";
import { OperatorHttpApi } from "../src/http/operator";
import { Database } from "../src/kernel";
import {
  createOrder440ClearIrpProtocol,
  type Order440ClearIrpBehavior,
  type Order440ClearIrpIssuedDocument,
  type Order440ClearIrpProtocol,
} from "./fixtures/order440-clearirp-protocol";
import {
  FISCAL_RECEIPT_READ_SCOPE,
  assertSignedFiscalReceiptProofTargets,
  createSignedFiscalScenario,
  type SignedFiscalScenario,
} from "./fixtures/order440-signed-fiscal-receipt";

const deployUrl = process.env.YELLOW_ORDER440_SIGNED_DEPLOY_DATABASE_URL;
const runtimeUrl = process.env.YELLOW_ORDER440_SIGNED_RUNTIME_DATABASE_URL;
if (process.env.YELLOW_REQUIRE_ORDER440_SIGNED === "1" && (!deployUrl || !runtimeUrl)) {
  throw new Error("Required Q207 signed provider journey needs explicit deploy and runtime URLs");
}
if (deployUrl && runtimeUrl) assertSignedFiscalReceiptProofTargets(deployUrl, runtimeUrl);
const databaseDescribe = deployUrl && runtimeUrl ? describe.serial : describe.skip;

function receiptHttpApp(database: Database, tokens: Hs256TokenSigner) {
  const submissions = {
    async request() { throw new Error("receipt GET must not request a fiscal submission"); },
    async retry() { throw new Error("receipt GET must not retry a fiscal submission"); },
  };
  const dependencies = {
    submissions,
    adapters: new FiscalSubmissionAdapterAvailabilityService([]),
    receipts: new FiscalSubmissionReceiptReadService(),
  };
  const OperatorConstructor = OperatorHttpApi as unknown as new (...args: unknown[]) => OperatorHttpApi;
  const operator = new OperatorConstructor(
    {}, undefined, ...Array.from({ length: 44 }, () => undefined), dependencies,
  );
  return createApp({ database, tenantResolver: new BearerTenantResolver(tokens), operatorApi: operator });
}

function receiptRequest(scenario: SignedFiscalScenario, token: string): Request {
  return new Request(
    `http://yellow.test/api/v1/properties/${scenario.propertyNode}/fiscal-submissions/` +
      `${scenario.submissionId}/receipt`,
    { headers: { authorization: `Bearer ${token}`, "x-correlation-id": crypto.randomUUID() } },
  );
}

function worker(
  repository: FiscalSubmissionRepository,
  registration: VerifiedIndiaIrpAdapterRegistration,
): FiscalSubmissionWorker {
  return new FiscalSubmissionWorker(repository, new VerifiedIndiaIrpAdapterRegistry([registration]));
}

function workerInput(scenario: SignedFiscalScenario) {
  return Object.freeze({
    tenantId: scenario.tenantId,
    submissionId: scenario.submissionId,
    providerKey: scenario.provider.providerKey,
    providerExtensionId: scenario.provider.providerExtensionId,
    providerExtensionVersion: scenario.provider.providerExtensionVersion,
    leaseSeconds: 60,
    transportDeadlineMs: 20_000,
  });
}

function expectReconciled(
  result: FiscalSubmissionWorkerStepResult,
  action: "submit" | "lookup",
  status: "submitted" | "accepted" | "rejected" | "error",
  disposition: "lookup" | "none",
): void {
  expect(result).toMatchObject({ ok: true, kind: "reconciled", action, status, disposition, replayed: false });
}

databaseDescribe("Q207 full synthetic ClearIRP provider-to-operator journey", () => {
  let deploy: SQL;
  let runtimePool: SQL;
  let database: Database;
  let repository: FiscalSubmissionRepository;
  let tokens: Hs256TokenSigner;

  beforeAll(async () => {
    deploy = new SQL(deployUrl!, { max: 3, prepare: false, connectionTimeout: 5 });
    runtimePool = new SQL(runtimeUrl!, { max: 4, prepare: false, connectionTimeout: 5 });
    database = Database.connect(runtimeUrl!, { maxConnections: 3, prepare: false });
    repository = new FiscalSubmissionRepository(runtimePool);
    tokens = new Hs256TokenSigner("q207-provider-journey-synthetic-session-secret-48-bytes");
    const [frontier] = await deploy<{ version: number; reader: string | null }[]>`
      SELECT max(version)::integer AS version,
        to_regprocedure('public.read_india_fiscal_submission_delivery_receipt(uuid,uuid,uuid,uuid)')::text AS reader
      FROM public.schema_migration`;
    if (frontier?.version !== 81 || frontier.reader === null) {
      throw new Error("Q207 signed provider journey requires canonical81");
    }
  }, 30_000);

  afterAll(async () => {
    await database?.close();
    await runtimePool?.close({ timeout: 0 });
    await deploy?.close({ timeout: 0 });
  }, 30_000);

  async function arrange(behavior: Order440ClearIrpBehavior): Promise<{
    scenario: SignedFiscalScenario;
    protocol: Order440ClearIrpProtocol;
    token: string;
    wireSha256: string;
  }> {
    const scenario = await createSignedFiscalScenario(deploy, runtimePool, database);
    const [source] = await deploy<{ sha256: string; contentJson: string }[]>`
      SELECT sha256,content::text AS "contentJson"
      FROM public.document
      WHERE tenant_id=${scenario.tenantId}::uuid AND id=${scenario.documentId}::uuid`;
    if (!source) throw new Error("Q207 issued document source is unavailable");
    const projected = projectIssuedIndiaIrpWireCandidate({
      documentId: scenario.documentId,
      documentSha256: source.sha256,
      contentJson: source.contentJson,
    });
    if (!projected.ok) throw new Error(`Q207 issued wire projection failed: ${projected.error.code}`);
    const document: Order440ClearIrpIssuedDocument = Object.freeze({
      documentId: scenario.documentId,
      documentSha256: source.sha256,
      sourceContentJson: source.contentJson,
      wireJson: projected.value.wireJson,
      wireSha256: projected.value.wireSha256,
      providerKey: scenario.provider.providerKey,
    });
    const protocol = await createOrder440ClearIrpProtocol(document, behavior);
    const token = await tokens.issue({ userId: scenario.actorId, tenantId: scenario.tenantId,
      scopes: [FISCAL_RECEIPT_READ_SCOPE] });
    return { scenario, protocol, token, wireSha256: projected.value.wireSha256 };
  }

  async function runFresh(scenario: SignedFiscalScenario, protocol: Order440ClearIrpProtocol) {
    const registration = await protocol.createRegistration(scenario.provider);
    return worker(repository, registration).runOnce(workerInput(scenario));
  }

  async function waitForExactLookupDue(scenario: SignedFiscalScenario): Promise<void> {
    const expiresAt = performance.now() + 20_000;
    while (performance.now() < expiresAt) {
      const [row] = await deploy<{ status: string; disposition: string; due: boolean; remainingMs: number }[]>`
        SELECT status,disposition,
          claim_expires_at + (CASE WHEN response IS NULL
            THEN interval '0 seconds' ELSE interval '15 seconds' END) <= clock_timestamp() AS due,
          ceil(greatest(0,extract(epoch FROM (
            claim_expires_at + (CASE WHEN response IS NULL
              THEN interval '0 seconds' ELSE interval '15 seconds' END) - clock_timestamp()
          )) * 1000))::integer AS "remainingMs"
        FROM public.fiscal_submission
        WHERE tenant_id=${scenario.tenantId}::uuid AND id=${scenario.submissionId}::uuid`;
      if (!row || row.status !== "submitted" || row.disposition !== "lookup"
          || typeof row.due !== "boolean" || !Number.isInteger(row.remainingMs) || row.remainingMs < 0) {
        throw new Error("Q207 exact owned submission due state is invalid");
      }
      if (row.due) return;
      const remainingBudget = Math.floor(expiresAt - performance.now());
      if (remainingBudget < 1) break;
      await Bun.sleep(Math.max(1, Math.min(row.remainingMs, remainingBudget, 250)));
    }
    throw new Error("Q207 exact owned submission did not naturally become due within the bounded wait");
  }

  async function expectImmediateBusyThenWait(
    scenario: SignedFiscalScenario,
    protocol: Order440ClearIrpProtocol,
  ): Promise<void> {
    const before = protocol.metrics();
    expect(await runFresh(scenario, protocol)).toEqual({ ok: true, kind: "idle", reason: "busy" });
    expect(protocol.metrics()).toEqual({
      adapterInstances: before.adapterInstances + 1,
      authenticationRequests: before.authenticationRequests,
      submissionPosts: before.submissionPosts,
      documentLookups: before.documentLookups,
      submittedWireSha256: before.submittedWireSha256,
    });
    await waitForExactLookupDue(scenario);
  }

  async function getReceipt(scenario: SignedFiscalScenario, token: string) {
    const response = await receiptHttpApp(database, tokens).handle(receiptRequest(scenario, token));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json() as { fiscalSubmissionReceipt: FiscalSubmissionDeliveryReceipt };
    expect(JSON.stringify(body)).not.toMatch(
      /rawResponse|decryptedData|sourceContent|wireJson|claimToken|clientSecret|password|AppKey|SEK/u,
    );
    return body.fiscalSubmissionReceipt;
  }

  test("recovers an authentic accepted response with a fresh adapter and worker without a duplicate POST", async () => {
    const { scenario, protocol, token, wireSha256 } = await arrange("accepted_after_response_loss");
    expectReconciled(await runFresh(scenario, protocol), "submit", "submitted", "lookup");
    expect(protocol.metrics()).toMatchObject({ adapterInstances: 1, authenticationRequests: 1,
      submissionPosts: 1, documentLookups: 0 });

    await expectImmediateBusyThenWait(scenario, protocol);
    expectReconciled(await runFresh(scenario, protocol), "lookup", "accepted", "none");
    expect(protocol.metrics()).toEqual({ adapterInstances: 3, authenticationRequests: 2,
      submissionPosts: 1, documentLookups: 1,
      submittedWireSha256: [wireSha256] });

    const receipt = await getReceipt(scenario, token);
    expect(receipt).toMatchObject({ kind: "accepted_signed_v1", status: "accepted", disposition: "none",
      submissionId: scenario.submissionId, tenantId: scenario.tenantId, propertyNode: scenario.propertyNode,
      documentId: scenario.documentId, providerKey: scenario.provider.providerKey });
    if (receipt.kind !== "accepted_signed_v1") throw new Error("accepted signed receipt was not returned");
    expect(receipt.irn).toMatch(/^[0-9a-f]{64}$/u);
    expect(receipt.signedInvoice).toContain(".");
    expect(receipt.signedQRCode).toContain(".");
  }, 60_000);

  test("stores an IRN-less definitive rejection from authenticated ErrorDetails", async () => {
    const { scenario, protocol, token } = await arrange("rejected");
    expectReconciled(await runFresh(scenario, protocol), "submit", "rejected", "none");
    expect(protocol.metrics()).toMatchObject({ submissionPosts: 1, documentLookups: 0 });
    const receipt = await getReceipt(scenario, token);
    expect(receipt).toMatchObject({ kind: "rejected", status: "rejected", disposition: "none",
      errorCodes: ["2150"] });
    expect(Object.hasOwn(receipt, "irn")).toBe(false);
    expect(Object.hasOwn(receipt, "authorityRef")).toBe(false);
  }, 60_000);

  test("records authenticated lookup CNL as terminal and never resubmits after response loss", async () => {
    const { scenario, protocol, token } = await arrange("cancelled_after_response_loss");
    expectReconciled(await runFresh(scenario, protocol), "submit", "submitted", "lookup");
    await expectImmediateBusyThenWait(scenario, protocol);
    expectReconciled(await runFresh(scenario, protocol), "lookup", "error", "none");
    expect(protocol.metrics()).toMatchObject({ adapterInstances: 3, authenticationRequests: 2,
      submissionPosts: 1, documentLookups: 1 });
    const receipt = await getReceipt(scenario, token);
    expect(receipt).toMatchObject({ kind: "provider_cancelled", status: "error", disposition: "none",
      providerStatus: "CNL" });
    expect(Object.hasOwn(receipt, "irn")).toBe(false);
    expect(Object.hasOwn(receipt, "authorityRef")).toBe(false);
  }, 60_000);

  test("keeps genuinely signed but source-mismatched values unresolved through submit and lookup", async () => {
    const { scenario, protocol, token } = await arrange("signed_source_mismatch");
    expectReconciled(await runFresh(scenario, protocol), "submit", "submitted", "lookup");
    await expectImmediateBusyThenWait(scenario, protocol);
    expectReconciled(await runFresh(scenario, protocol), "lookup", "submitted", "lookup");
    expect(protocol.metrics()).toMatchObject({ adapterInstances: 3, authenticationRequests: 2,
      submissionPosts: 1, documentLookups: 1 });
    const receipt = await getReceipt(scenario, token);
    expect(receipt).toMatchObject({ kind: "pending", status: "submitted", disposition: "lookup" });
    expect(Object.hasOwn(receipt, "irn")).toBe(false);
    expect(Object.hasOwn(receipt, "verification")).toBe(false);
  }, 60_000);
});
