import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";
import { Database } from "../src/kernel";
import { Hs256TokenSigner } from "../src/contexts/identity";
import { FiscalSubmissionDeliveryRuntime } from "../src/contexts/tax-fiscal";
import {
  assertFiscalDeliveryProofTargets,
  createFiscalDeliveryRuntime,
  createFiscalDeliveryScenario,
  createFiscalProtocolAdapter,
  fiscalFinancialSnapshot,
  type FiscalDeliveryScenario,
} from "./fixtures/order440-fiscal-delivery-runtime";
import {
  fiscalRetryRequest,
  fiscalSubmissionHttpApp,
  fiscalToken,
  type FiscalSubmissionHttpBody,
} from "./fixtures/order440-fiscal-submission-http";

const deployUrl = process.env.YELLOW_ORDER440_DELIVERY_DEPLOY_DATABASE_URL;
const runtimeUrl = process.env.YELLOW_ORDER440_DELIVERY_RUNTIME_DATABASE_URL;
if (process.env.YELLOW_REQUIRE_ORDER440_DELIVERY === "1" && (!deployUrl || !runtimeUrl)) {
  throw new Error("Required Q204 delivery proof needs explicit deploy and runtime URLs");
}
if (deployUrl && runtimeUrl) assertFiscalDeliveryProofTargets(deployUrl, runtimeUrl);
const databaseDescribe = deployUrl && runtimeUrl ? describe.serial : describe.skip;
const canonical78Hash = "65323a81a999a11e3d55893411c994c0b841af9b0465ca7e80630fd78d0ffae6";
const dueColumns = ["tenant_id", "submission_id", "provider_key",
  "provider_extension_id", "provider_extension_version"].sort();

interface DueRow {
  readonly tenant_id: string;
  readonly submission_id: string;
  readonly provider_key: string;
  readonly provider_extension_id: string;
  readonly provider_extension_version: number;
}

interface DeliveryHead {
  readonly status: string;
  readonly disposition: string;
  readonly attempt_number: number;
  readonly retry_count: number;
  readonly transition_seq: number;
  readonly claim_expires_at: Date | null;
}

interface DeliveryHistory {
  readonly event_type: string;
  readonly outcome: string | null;
  readonly status: string;
  readonly disposition: string;
  readonly attempt_number: number;
  readonly transition_seq: number;
}

function sha256(bytes: Uint8Array): string {
  return new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
}

async function waitUntil(predicate: () => boolean, message: string): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await Bun.sleep(10);
  }
  throw new Error(message);
}

async function expectSqlState(operation: () => Promise<unknown>, errno: string): Promise<void> {
  let failure: unknown;
  try {
    await operation();
  } catch (error) {
    failure = error;
  }
  expect(failure).toBeDefined();
  expect((failure as { errno?: string } | undefined)?.errno).toBe(errno);
}

describe("Q204 proof target isolation", () => {
  test("rejects retained targets, mixed authority and mismatched databases", () => {
    const deploy = "postgres://yellow_deploy:synthetic@127.0.0.1:55503/yellow_order440_q204_test";
    const runtime = "postgres://yellow_runtime:synthetic@127.0.0.1:55503/yellow_order440_q204_test";
    expect(() => assertFiscalDeliveryProofTargets(deploy, runtime)).not.toThrow();
    expect(() => assertFiscalDeliveryProofTargets(
      deploy.replace(":55503", ":5432"), runtime.replace(":55503", ":5432"),
    )).not.toThrow();
    expect(() => assertFiscalDeliveryProofTargets(deploy.replace("yellow_order440_q204_test", "yellow_order442_review"), runtime)).toThrow();
    expect(() => assertFiscalDeliveryProofTargets(deploy, deploy)).toThrow();
    expect(() => assertFiscalDeliveryProofTargets(deploy, runtime + "_other")).toThrow();
    expect(() => assertFiscalDeliveryProofTargets(deploy, runtime + "?options=-crole=app_role")).toThrow();
    expect(() => assertFiscalDeliveryProofTargets(deploy.replace("127.0.0.1:55503", "db.example:5432"), runtime)).toThrow();
    expect(() => assertFiscalDeliveryProofTargets(deploy.replace(":55503", ":0"), runtime.replace(":55503", ":0"))).toThrow();
    expect(() => assertFiscalDeliveryProofTargets(deploy.replace(":55503", ""), runtime.replace(":55503", ""))).toThrow();
  }, 60_000);
});

databaseDescribe("Q204 genuine fiscal delivery discovery", () => {
  let deploy: SQL;
  let runtime: SQL;
  let database: Database;
  let tokens: Hs256TokenSigner;
  const activeTenants = new Set<string>();

  async function scenario(): Promise<FiscalDeliveryScenario> {
    const created = await createFiscalDeliveryScenario(deploy, database, tokens);
    activeTenants.add(created.tenantId);
    return created;
  }

  async function head(value: FiscalDeliveryScenario): Promise<DeliveryHead> {
    const [row] = await deploy<DeliveryHead[]>`
      SELECT status,disposition,attempt_number,retry_count,
             transition_seq::integer AS transition_seq,claim_expires_at
        FROM public.fiscal_submission
       WHERE tenant_id=${value.tenantId}::uuid AND id=${value.submissionId}::uuid`;
    if (!row) throw new Error("Q204 fiscal submission head is unavailable");
    return row;
  }

  async function history(value: FiscalDeliveryScenario): Promise<readonly DeliveryHistory[]> {
    return deploy<DeliveryHistory[]>`
      SELECT event_type,outcome,status,disposition,attempt_number,
             transition_seq::integer AS transition_seq
        FROM public.fiscal_submission_history
       WHERE tenant_id=${value.tenantId}::uuid AND submission_id=${value.submissionId}::uuid
       ORDER BY transition_seq`;
  }

  beforeAll(async () => {
    deploy = new SQL(deployUrl!, { max: 4, prepare: false, connectionTimeout: 5 });
    runtime = new SQL(runtimeUrl!, { max: 4, prepare: false, connectionTimeout: 5 });
    database = Database.connect(runtimeUrl!, { maxConnections: 4, prepare: false });
    tokens = new Hs256TokenSigner("q204-fiscal-delivery-synthetic-token-secret-48-characters");
    const [identity] = await deploy<{ name: string; frontier: number }[]>`
      SELECT current_database()::text AS name,
             (SELECT max(version)::integer FROM public.schema_migration) AS frontier`;
    if (!identity || !/^yellow_order440_q204_[a-z0-9_]+$/.test(identity.name)
        || identity.frontier !== 80) {
      throw new Error("Q204 delivery proof needs an isolated canonical80 database");
    }
    const ledger = await deploy<{ version: number; filename: string; checksum: string }[]>`
      SELECT version::integer,filename,btrim(checksum_sha256) AS checksum
        FROM public.schema_migration WHERE version BETWEEN 78 AND 80 ORDER BY version`;
    const expectedFiles = [
      "0078_fiscal_submission_durability.sql",
      "0079_fiscal_immutable_command_receipts.sql",
      "0080_fiscal_submission_delivery_runtime.sql",
    ] as const;
    const expectedHashes = await Promise.all(expectedFiles.map(async filename =>
      sha256(new Uint8Array(await Bun.file(new URL(`../migrations/${filename}`, import.meta.url)).arrayBuffer()))));
    expect(ledger).toEqual(expectedFiles.map((filename, index) => ({
      version: index + 78,
      filename,
      checksum: index === 0 ? canonical78Hash : expectedHashes[index]!,
    })));
    const [contents] = await deploy<{ tenants: number; submissions: number }[]>`
      SELECT (SELECT count(*)::integer FROM public.tenant) AS tenants,
             (SELECT count(*)::integer FROM public.fiscal_submission) AS submissions`;
    if (!contents || contents.tenants !== 0 || contents.submissions !== 0) {
      throw new Error("Q204 delivery proof requires a fresh empty isolated target");
    }
  }, 120_000);

  afterEach(async () => {
    for (const tenantId of activeTenants) {
      await deploy`UPDATE public.tenant SET status='inactive' WHERE id=${tenantId}::uuid`;
    }
    activeTenants.clear();
  }, 60_000);

  afterAll(async () => {
    await database?.close();
    await runtime?.close({ timeout: 0 });
    await deploy?.close({ timeout: 0 });
  }, 60_000);

  test("discovers actual HTTP-requested invoices for two tenants with only minimal identities", async () => {
    const first = await scenario();
    const second = await scenario();
    const before = await Promise.all([first, second].map((value) => fiscalFinancialSnapshot(deploy, value.tenantId)));
    const rows = await runtime<DueRow[]>`
      SELECT * FROM public.runtime_due_india_fiscal_submissions(500,NULL,NULL)
    `;
    expect(rows.length).toBeLessThanOrEqual(500);
    for (const scenario of [first, second]) {
      const row = rows.find(({ submission_id }) => submission_id === scenario.submissionId);
      expect(row).toEqual({
        tenant_id: scenario.tenantId, submission_id: scenario.submissionId,
        provider_key: scenario.provider.providerKey,
        provider_extension_id: scenario.provider.providerExtensionId,
        provider_extension_version: scenario.provider.providerExtensionVersion,
      });
    }
    for (const row of rows) expect(Object.keys(row).sort()).toEqual(dueColumns);
    expect(await Promise.all([first, second].map((value) => fiscalFinancialSnapshot(deploy, value.tenantId)))).toEqual(before);
  }, 60_000);

  test("denies application/deployer roles and populated runtime tenant context", async () => {
    await expectSqlState(async () => deploy`SELECT * FROM public.runtime_due_india_fiscal_submissions(10,NULL,NULL)`, "42501");
    await expectSqlState(async () => runtime.begin(async (tx) => {
      await tx`SET LOCAL ROLE app_role`;
      return tx`SELECT * FROM public.runtime_due_india_fiscal_submissions(10,NULL,NULL)`;
    }), "42501");
    await expectSqlState(async () => runtime.begin(async (tx) => {
      await tx`SELECT set_config('app.tenant_id',${crypto.randomUUID()},true)`;
      return tx`SELECT * FROM public.runtime_due_india_fiscal_submissions(10,NULL,NULL)`;
    }), "42501");
    const [settled] = await runtime<{ role: string; tenant: string | null }[]>`
      SELECT current_user::text AS role, NULLIF(current_setting('app.tenant_id',true),'') AS tenant
    `;
    expect(settled).toEqual({ role: "yellow_runtime", tenant: null });
  }, 60_000);

  test("enforces bounds and traverses exact keyset pages without skipping or duplicating work", async () => {
    await scenario();
    await scenario();
    await scenario();
    for (const limit of [0, 501, -1]) {
      await expectSqlState(async () => runtime`SELECT * FROM public.runtime_due_india_fiscal_submissions(${limit},NULL,NULL)`, "22023");
    }
    await expectSqlState(async () => runtime`SELECT * FROM public.runtime_due_india_fiscal_submissions(
      1,${crypto.randomUUID()}::uuid,NULL)`, "22023");
    const all = await runtime<DueRow[]>`SELECT * FROM public.runtime_due_india_fiscal_submissions(500,NULL,NULL)`;
    const seen: DueRow[] = [];
    let tenant: string | null = null;
    let submission: string | null = null;
    for (let iteration = 0; iteration <= all.length; iteration++) {
      const page: DueRow[] = await runtime<DueRow[]>`
        SELECT * FROM public.runtime_due_india_fiscal_submissions(1,${tenant}::uuid,${submission}::uuid)
      `;
      if (page.length === 0) break;
      expect(page.length).toBe(1);
      const row: DueRow = page[0]!;
      seen.push(row); tenant = row.tenant_id; submission = row.submission_id;
    }
    expect(seen).toEqual([...all]);
    expect(new Set(seen.map((row) => row.submission_id)).size).toBe(seen.length);

    const fixture = createFiscalDeliveryRuntime(runtimeUrl!, [], { batchSize: 1 });
    const cursors: unknown[] = [];
    const wrappingRuntime = new FiscalSubmissionDeliveryRuntime(fixture.worker, {
      async listDueSubmissions(limit, cursor) {
        cursors.push(cursor);
        return fixture.source.listDueSubmissions(limit, cursor);
      },
    }, { batchSize: 1, pollIntervalMs: 100, leaseSeconds: 60, transportDeadlineMs: 20_000 });
    try {
      for (let index = 0; index < all.length; index += 1) {
        expect(await wrappingRuntime.drainOnce()).toMatchObject({ discovered: 1, unavailable: 1 });
      }
      expect(await wrappingRuntime.drainOnce()).toMatchObject({ discovered: 0 });
      expect(await wrappingRuntime.drainOnce()).toMatchObject({ discovered: 1, unavailable: 1 });
      expect(cursors[0]).toBeNull();
      expect(cursors.at(-2)).toEqual({ tenantId: all.at(-1)?.tenant_id,
        submissionId: all.at(-1)?.submission_id });
      expect(cursors.at(-1)).toBeNull();
    } finally {
      await fixture.close();
    }
  }, 120_000);

  test("runs signed HTTP request through discovery, provider transport and durable reconciliation", async () => {
    const value = await scenario();
    const finances = await fiscalFinancialSnapshot(deploy, value.tenantId);
    const protocol = createFiscalProtocolAdapter(value.provider);
    const fixture = createFiscalDeliveryRuntime(runtimeUrl!, [protocol.registration], { batchSize: 1 });
    try {
      expect(await fixture.runtime.drainOnce()).toMatchObject({
        discovered: 1, reconciled: 1, unavailable: 0, failures: [],
      });
      expect(await head(value)).toMatchObject({ status: "accepted", disposition: "none",
        attempt_number: 1, retry_count: 0, transition_seq: 3 });
      expect((await history(value)).map(({ event_type, outcome }) => ({ event_type, outcome }))).toEqual([
        { event_type: "fiscal.submission.requested", outcome: null },
        { event_type: "fiscal.submission.claimed", outcome: null },
        { event_type: "fiscal.submission.reconciled", outcome: "accepted" },
      ]);
      expect(protocol.calls).toHaveLength(1);
      expect(protocol.calls[0]).toMatchObject({ kind: "submit", tenantId: value.tenantId,
        documentId: value.documentId });
      expect(protocol.calls[0]?.payloadBodySha256).toBe(protocol.calls[0]?.payloadSha256);
      expect(protocol.calls[0]?.signal).toBeInstanceOf(AbortSignal);
      expect(protocol.calls[0]!.deadlineUnixMs).toBeGreaterThan(Date.now() - 20_000);
      expect(await fiscalFinancialSnapshot(deploy, value.tenantId)).toEqual(finances);
    } finally {
      await fixture.close();
    }
  }, 60_000);

  test("unavailable adapter advances discovery without consuming a claim or attempt", async () => {
    const value = await scenario();
    const beforeHead = await head(value);
    const beforeHistory = await history(value);
    const fixture = createFiscalDeliveryRuntime(runtimeUrl!, [], { batchSize: 1 });
    try {
      expect(await fixture.runtime.drainOnce()).toMatchObject({
        discovered: 1, reconciled: 0, unavailable: 1, failures: [],
      });
      expect(await head(value)).toEqual(beforeHead);
      expect(await history(value)).toEqual(beforeHistory);
      expect(beforeHistory).toHaveLength(1);
    } finally {
      await fixture.close();
    }
  }, 60_000);

  test("two competing runtimes produce exactly one provider submit and one reconciliation", async () => {
    const value = await scenario();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const protocol = createFiscalProtocolAdapter(value.provider, {
      async submit(input) {
        await gate;
        return Object.freeze({ verified: true, outcome: "accepted",
          authorityRef: `q204-competing-${input.attemptId}`,
          responseSha256: "a".repeat(64) });
      },
    });
    const first = createFiscalDeliveryRuntime(runtimeUrl!, [protocol.registration], { batchSize: 1 });
    const second = createFiscalDeliveryRuntime(runtimeUrl!, [protocol.registration], { batchSize: 1 });
    const firstDrain = first.runtime.drainOnce();
    const secondDrain = second.runtime.drainOnce();
    const drains = Promise.all([firstDrain, secondDrain]);
    try {
      await waitUntil(() => protocol.calls.length === 1, "Competing runtimes did not reach one provider submit");
      release();
      await drains;
      expect(protocol.calls.map(({ kind }) => kind)).toEqual(["submit"]);
      expect(await head(value)).toMatchObject({ status: "accepted", transition_seq: 3 });
      expect((await history(value)).map(({ event_type }) => event_type)).toEqual([
        "fiscal.submission.requested", "fiscal.submission.claimed", "fiscal.submission.reconciled",
      ]);
    } finally {
      release();
      await Promise.allSettled([drains]);
      await Promise.all([first.close(), second.close()]);
    }
  }, 60_000);

  test("shutdown after submit is unknown, late success is ignored, and database-clock cadence leads to lookup only", async () => {
    const value = await scenario();
    const finances = await fiscalFinancialSnapshot(deploy, value.tenantId);
    let settleSubmit!: (resolution: Readonly<{ verified: true; outcome: "accepted";
      authorityRef: string; responseSha256: string }>) => void;
    const pendingSubmit = new Promise<Readonly<{ verified: true; outcome: "accepted";
      authorityRef: string; responseSha256: string }>>((resolve) => { settleSubmit = resolve; });
    const protocol = createFiscalProtocolAdapter(value.provider, {
      async submit() { return pendingSubmit; },
    });
    const fixture = createFiscalDeliveryRuntime(runtimeUrl!, [protocol.registration], {
      batchSize: 1, leaseSeconds: 15, transportDeadlineMs: 5_000,
    });
    const controller = new AbortController();
    const drain = fixture.runtime.drainOnce(controller.signal);
    void drain.catch(() => undefined);
    try {
      await waitUntil(() => protocol.calls.length === 1, "Q204 provider submit did not begin");
      controller.abort();
      expect(await drain).toMatchObject({ discovered: 1, reconciled: 1, failures: [] });
      expect(protocol.calls[0]?.signal.aborted).toBe(true);
      expect(await head(value)).toMatchObject({ status: "submitted", disposition: "lookup", transition_seq: 3 });
      expect((await history(value)).at(-1)).toMatchObject({
        event_type: "fiscal.submission.reconciled", outcome: "timeout",
      });

      const quarantined = await fixture.worker.runOnce({ tenantId: value.tenantId,
        submissionId: value.submissionId, ...value.provider, leaseSeconds: 15,
        transportDeadlineMs: 100 });
      expect(quarantined).toEqual({ ok: true, kind: "idle", reason: "adapter_busy" });
      expect((await history(value))).toHaveLength(3);

      await deploy`UPDATE public.fiscal_submission
        SET claim_expires_at=clock_timestamp()-interval '14 seconds'
        WHERE tenant_id=${value.tenantId}::uuid AND id=${value.submissionId}::uuid`;
      expect(await runtime<DueRow[]>`SELECT * FROM public.runtime_due_india_fiscal_submissions(
        10,NULL,NULL) WHERE submission_id=${value.submissionId}::uuid`).toEqual([]);
      await deploy`UPDATE public.fiscal_submission
        SET claim_expires_at=clock_timestamp()-interval '16 seconds'
        WHERE tenant_id=${value.tenantId}::uuid AND id=${value.submissionId}::uuid`;
      expect(await runtime<DueRow[]>`SELECT * FROM public.runtime_due_india_fiscal_submissions(
        10,NULL,NULL) WHERE submission_id=${value.submissionId}::uuid`).toHaveLength(1);

      settleSubmit({ verified: true, outcome: "accepted", authorityRef: "q204-late-ignored",
        responseSha256: "b".repeat(64) });
      await Bun.sleep(0);
      expect(await head(value)).toMatchObject({ status: "submitted", disposition: "lookup", transition_seq: 3 });
      expect(await fixture.runtime.drainOnce()).toMatchObject({ discovered: 0 });
      expect(await fixture.runtime.drainOnce()).toMatchObject({ discovered: 1, reconciled: 1 });
      expect(protocol.calls.map(({ kind }) => kind)).toEqual(["submit", "lookup"]);
      expect(await head(value)).toMatchObject({ status: "accepted", disposition: "none", transition_seq: 5 });
      expect(await fiscalFinancialSnapshot(deploy, value.tenantId)).toEqual(finances);
    } finally {
      settleSubmit?.({ verified: true, outcome: "accepted", authorityRef: "q204-finalize",
        responseSha256: "c".repeat(64) });
      controller.abort();
      await Promise.allSettled([drain]);
      await fixture.close();
    }
  }, 60_000);

  test("a fresh worker recovers an abandoned expired lease with the exact issued wire and no resend", async () => {
    const value = await scenario();
    const claimant = createFiscalDeliveryRuntime(runtimeUrl!, [], {
      batchSize: 1, leaseSeconds: 15, transportDeadlineMs: 100,
    });
    let issuedWireHash: string;
    try {
      const abandoned = await claimant.repository.claim({ tenantId: value.tenantId,
        submissionId: value.submissionId, leaseSeconds: 15 });
      expect(abandoned).toMatchObject({ ok: true, value: { claimed: true, action: "submit" } });
      if (!abandoned.ok || !abandoned.value.claimed) throw new Error("Q204 abandoned claim was unavailable");
      issuedWireHash = abandoned.value.wireSha256;
    } finally {
      await claimant.close();
    }

    const protocol = createFiscalProtocolAdapter(value.provider);
    const fixture = createFiscalDeliveryRuntime(runtimeUrl!, [protocol.registration], {
      batchSize: 1, leaseSeconds: 15, transportDeadlineMs: 100,
    });
    try {
      expect(protocol.calls).toEqual([]);
      await deploy`UPDATE public.fiscal_submission SET claim_expires_at=clock_timestamp()-interval '1 second'
        WHERE tenant_id=${value.tenantId}::uuid AND id=${value.submissionId}::uuid`;
      expect(await fixture.runtime.drainOnce()).toMatchObject({ discovered: 1, reconciled: 1 });
      expect(protocol.calls.map(({ kind }) => kind)).toEqual(["lookup"]);
      expect(protocol.calls[0]).toMatchObject({ payloadSha256: issuedWireHash,
        payloadBodySha256: issuedWireHash });
      expect(await head(value)).toMatchObject({ status: "accepted", disposition: "none", transition_seq: 4 });
      expect((await history(value)).map(({ event_type }) => event_type)).toEqual([
        "fiscal.submission.requested", "fiscal.submission.claimed",
        "fiscal.submission.claimed", "fiscal.submission.reconciled",
      ]);
    } finally {
      await fixture.close();
    }
  }, 60_000);

  test("known-not-sent remains explicit-retry-only and resumes only after signed HTTP retry", async () => {
    const value = await scenario();
    let submits = 0;
    const protocol = createFiscalProtocolAdapter(value.provider, {
      async submit(input) {
        submits += 1;
        return submits === 1
          ? Object.freeze({ verified: true, outcome: "known_not_sent" })
          : Object.freeze({ verified: true, outcome: "accepted",
            authorityRef: `q204-retry-${input.attemptId}`, responseSha256: "d".repeat(64) });
      },
    });
    const fixture = createFiscalDeliveryRuntime(runtimeUrl!, [protocol.registration], { batchSize: 1 });
    try {
      expect(await fixture.runtime.drainOnce()).toMatchObject({ discovered: 1, reconciled: 1 });
      expect(await head(value)).toMatchObject({ status: "error", disposition: "retry",
        attempt_number: 1, retry_count: 0, transition_seq: 3 });
      expect(await runtime<DueRow[]>`SELECT * FROM public.runtime_due_india_fiscal_submissions(
        10,NULL,NULL) WHERE submission_id=${value.submissionId}::uuid`).toEqual([]);
      expect(await fixture.runtime.drainOnce()).toMatchObject({ discovered: 0 });
      expect(submits).toBe(1);

      const app = fiscalSubmissionHttpApp(database, tokens, [value.provider]);
      const response = await app.handle(fiscalRetryRequest(
        value,
        await fiscalToken(tokens, value),
        value.submissionId,
        `q204-explicit-retry-${crypto.randomUUID()}`,
      ));
      expect(response.status).toBe(201);
      const body = await response.json() as FiscalSubmissionHttpBody;
      expect(body.fiscalSubmission).toMatchObject({ submissionId: value.submissionId,
        status: "pending", disposition: "send", attemptNumber: 2, retryCount: 1 });
      expect(await fixture.runtime.drainOnce()).toMatchObject({ discovered: 1, reconciled: 1 });
      expect(submits).toBe(2);
      expect(await head(value)).toMatchObject({ status: "accepted", disposition: "none",
        attempt_number: 2, retry_count: 1, transition_seq: 6 });
    } finally {
      await fixture.close();
    }
  }, 60_000);

  test("deactivation between discovery and claim creates no claim, transport or delivery mutation", async () => {
    const value = await scenario();
    const protocol = createFiscalProtocolAdapter(value.provider);
    const base = createFiscalDeliveryRuntime(runtimeUrl!, [protocol.registration], { batchSize: 1 });
    const beforeHead = await head(value);
    const beforeHistory = await history(value);
    let discovered = 0;
    const racingRuntime = new FiscalSubmissionDeliveryRuntime(base.worker, {
      async listDueSubmissions(limit, cursor) {
        const due = await base.source.listDueSubmissions(limit, cursor);
        discovered += due.length;
        await deploy`UPDATE public.tenant SET status='inactive' WHERE id=${value.tenantId}::uuid`;
        return due;
      },
    }, { batchSize: 1, pollIntervalMs: 100, leaseSeconds: 60, transportDeadlineMs: 20_000 });
    try {
      const result = await racingRuntime.drainOnce();
      expect(discovered).toBe(1);
      expect(result.reconciled).toBe(0);
      expect(protocol.calls).toHaveLength(0);
      expect(await head(value)).toEqual(beforeHead);
      expect(await history(value)).toEqual(beforeHistory);
    } finally {
      await base.close();
    }
  }, 60_000);
});
