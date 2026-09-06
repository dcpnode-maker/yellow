import { describe, expect, test } from "bun:test";

import type { FiscalProviderResolution } from "../src/contexts/tax-fiscal/fiscal-provider";
import {
  FiscalSubmissionRepository,
  type FiscalSubmissionClaim,
  type FiscalSubmissionNormalizedResult,
  type FiscalSubmissionReceipt,
  type FiscalSubmissionRepositoryResult,
} from "../src/contexts/tax-fiscal/fiscal-submission-repository";
import {
  FiscalSubmissionWorker,
  VerifiedIndiaIrpAdapterRegistry,
  type FiscalSubmissionWorkerRepository,
  type VerifiedIndiaIrpAdapterRegistration,
} from "../src/contexts/tax-fiscal/fiscal-submission-worker";
import type { ConnectionPool, Tx } from "../src/kernel";

const TENANT = "00000000-0000-4000-8000-000000004401";
const PROPERTY = "00000000-0000-4000-8000-000000004402";
const DOCUMENT = "00000000-0000-4000-8000-000000004403";
const EXTENSION = "00000000-0000-4000-8000-000000004404";
const ACTOR = "00000000-0000-4000-8000-000000004405";
const REQUEST = "00000000-0000-4000-8000-000000004406";
const SUBMISSION = "00000000-0000-4000-8000-000000004407";
const ATTEMPT = "00000000-0000-4000-8000-000000004408";
const CLAIM_TOKEN = "00000000-0000-4000-8000-000000004409";
const SOURCE_HASH = "1".repeat(64);
const RESPONSE_HASH = "2".repeat(64);
const PROVIDER_KEY = "in-irp:verified-one";
const WIRE_JSON = '{"Version":"1.1","DocDtls":{"No":"Y-440"}}';
const WIRE_HASH = new Bun.CryptoHasher("sha256").update(WIRE_JSON).digest("hex");

function claim(overrides: Partial<Extract<FiscalSubmissionClaim, { claimed: true }>> = {}): Extract<FiscalSubmissionClaim, { claimed: true }> {
  return {
    claimed: true,
    action: "submit",
    claimToken: CLAIM_TOKEN,
    submissionId: SUBMISSION,
    tenantId: TENANT,
    propertyNode: PROPERTY,
    documentId: DOCUMENT,
    documentSha256: SOURCE_HASH,
    wireSha256: WIRE_HASH,
    wireJson: WIRE_JSON,
    providerKey: PROVIDER_KEY,
    providerExtensionId: EXTENSION,
    providerExtensionVersion: 7,
    attemptId: ATTEMPT,
    attemptNumber: 1,
    ...overrides,
  };
}

function receipt(
  status: FiscalSubmissionReceipt["status"] = "accepted",
  disposition: FiscalSubmissionReceipt["disposition"] = "none",
  overrides: Partial<FiscalSubmissionReceipt> = {},
): FiscalSubmissionReceipt {
  return {
    submissionId: SUBMISSION,
    tenantId: TENANT,
    propertyNode: PROPERTY,
    documentId: DOCUMENT,
    documentSha256: SOURCE_HASH,
    wireSha256: WIRE_HASH,
    providerKey: PROVIDER_KEY,
    providerExtensionId: EXTENSION,
    providerExtensionVersion: 7,
    attemptId: ATTEMPT,
    attemptNumber: 1,
    retryCount: 0,
    status,
    disposition,
    transitionSeq: 3,
    replayed: false,
    ...overrides,
  };
}

function ok<T extends object>(value: T): FiscalSubmissionRepositoryResult<T> {
  return Object.freeze({ ok: true as const, value: Object.freeze(value) });
}

function registered(
  submit: VerifiedIndiaIrpAdapterRegistration["submit"],
  lookup: VerifiedIndiaIrpAdapterRegistration["lookup"] = async () => ({ verified: true, outcome: "pending" }),
  overrides: Partial<VerifiedIndiaIrpAdapterRegistration> = {},
): VerifiedIndiaIrpAdapterRegistration {
  return {
    kind: "registered_verified_india_irp_1_1_adapter",
    providerKey: PROVIDER_KEY,
    providerExtensionId: EXTENSION,
    providerExtensionVersion: 7,
    submit,
    lookup,
    ...overrides,
  };
}

function workerRepository(
  claimed: FiscalSubmissionClaim,
  reconciled: FiscalSubmissionReceipt,
  events: FiscalSubmissionNormalizedResult[] = [],
): FiscalSubmissionWorkerRepository {
  return {
    async claim() { return ok(claimed); },
    async reconcile(input) {
      events.push(input.result);
      return ok(reconciled);
    },
  };
}

function deeplyFrozen(value: unknown, seen = new Set<object>()): boolean {
  if (typeof value !== "object" || value === null || seen.has(value)) return true;
  seen.add(value);
  if (!Object.isFrozen(value)) return false;
  return Reflect.ownKeys(value).every((key) => deeplyFrozen((value as Record<PropertyKey, unknown>)[key], seen));
}

interface RuntimeHarness {
  readonly pool: ConnectionPool;
  readonly log: string[];
  readonly tagValues: unknown[][];
  readonly state: {
    inTransaction: boolean;
    releases: number;
    reserves: number;
    closes: number;
    failClaimOnce: boolean;
    failCommitOnce: boolean;
    failRollbackOnce: boolean;
    failReleaseOnce: boolean;
    settlementDirty: boolean;
  };
}

function runtimeHarness(claimReceipt: unknown, reconcileReceipt: unknown): RuntimeHarness {
  const log: string[] = [];
  const tagValues: unknown[][] = [];
  const state = {
    inTransaction: false,
    releases: 0,
    reserves: 0,
    closes: 0,
    failClaimOnce: false,
    failCommitOnce: false,
    failRollbackOnce: false,
    failReleaseOnce: false,
    settlementDirty: false,
  };
  let tenant: string | null = null;
  const connection = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const sql = strings.join("?");
    tagValues.push(values);
    if (sql.includes("claim_india_fiscal_submission")) {
      log.push("db:claim");
      if (state.failClaimOnce) {
        state.failClaimOnce = false;
        throw new Error("secret claim database detail");
      }
      return [{ receipt: claimReceipt }];
    }
    if (sql.includes("reconcile_india_fiscal_submission")) {
      log.push("db:reconcile");
      return [{ receipt: reconcileReceipt }];
    }
    throw new Error("unexpected tagged SQL");
  }) as unknown as Tx;
  Object.assign(connection, {
    async unsafe(sql: string, values?: unknown[]) {
      const normalized = sql.trim().replace(/\s+/g, " ");
      if (normalized === "BEGIN") {
        log.push("db:begin");
        state.inTransaction = true;
        return [];
      }
      if (normalized === "COMMIT") {
        log.push("db:commit");
        if (state.failCommitOnce) {
          state.failCommitOnce = false;
          throw new Error("secret commit failure");
        }
        state.inTransaction = false;
        tenant = null;
        return [];
      }
      if (normalized === "ROLLBACK") {
        log.push("db:rollback");
        if (state.failRollbackOnce) throw new Error("secret rollback failure");
        state.inTransaction = false;
        tenant = null;
        return [];
      }
      if (normalized === "DISCARD ALL") {
        log.push("db:discard");
        tenant = null;
        state.settlementDirty = false;
        return [];
      }
      if (normalized.startsWith("SELECT set_config")) {
        tenant = String(values?.[0]);
        log.push("db:tenant");
        return [{ tenant_id: tenant }];
      }
      if (normalized.includes("session_user::text AS session_user")) {
        log.push("db:identity");
        return [{
          session_user: "yellow_runtime",
          current_user: "yellow_runtime",
          tenant_id: state.settlementDirty ? "00000000-0000-4000-8000-000000009999" : tenant,
          prepared_count: 0,
        }];
      }
      throw new Error(`unexpected unsafe SQL: ${normalized}`);
    },
    release() {
      log.push("db:release");
      if (state.failReleaseOnce) {
        state.failReleaseOnce = false;
        throw new Error("secret release failure");
      }
      state.releases += 1;
    },
  });
  const pool: ConnectionPool = {
    async reserve() {
      log.push("db:reserve");
      state.reserves += 1;
      return connection;
    },
    async close() {
      log.push("db:close");
      state.closes += 1;
    },
  };
  return { pool, log, tagValues, state };
}

describe("Order 440 durable fiscal submission repository", () => {
  test("request and explicit retry use only the caller transaction and exact Q199 signatures", async () => {
    const statements: Array<{ sql: string; values: unknown[] }> = [];
    const rows = [receipt("pending", "send")];
    const tx = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
      statements.push({ sql: strings.join("?"), values });
      return [{ receipt: rows.shift() ?? receipt("pending", "send") }];
    }) as unknown as Tx;
    const repository = new FiscalSubmissionRepository({
      async reserve(): Promise<never> { throw new Error("ordinary commands must not reserve"); },
    });

    const requested = await repository.request(tx, {
      tenantId: TENANT, propertyNode: PROPERTY, documentId: DOCUMENT,
      providerExtensionId: EXTENSION, actorId: ACTOR,
      idempotencyKey: "order440-request", requestId: REQUEST,
    });
    expect(requested).toMatchObject({ ok: true, value: { status: "pending", disposition: "send" } });
    rows.push(receipt("pending", "send", { attemptId: "00000000-0000-4000-8000-000000004410",
      attemptNumber: 2, retryCount: 1 }));
    const retried = await repository.retry(tx, {
      tenantId: TENANT, submissionId: SUBMISSION, actorId: ACTOR,
      idempotencyKey: "order440-retry", requestId: REQUEST,
    });
    expect(retried).toMatchObject({ ok: true, value: { attemptNumber: 2, retryCount: 1 } });
    expect(statements).toHaveLength(2);
    expect(statements[0]!.sql).toContain("request_india_fiscal_submission");
    expect(statements[0]!.values).toEqual([TENANT, PROPERTY, DOCUMENT, EXTENSION, ACTOR, "order440-request", REQUEST]);
    expect(statements[1]!.sql).toContain("retry_india_fiscal_submission");
    expect(statements[1]!.values).toEqual([TENANT, SUBMISSION, ACTOR, "order440-retry", REQUEST]);
    expect(statements.every(({ sql }) => !/BEGIN|COMMIT|ROLLBACK/i.test(sql))).toBe(true);
  });

  test("ordinary boundaries reject extra keys, accessors, revoked proxies, and mismatched receipts without leaking details", async () => {
    let calls = 0;
    let returned: unknown = receipt("pending", "send", { tenantId: "00000000-0000-4000-8000-000000004499" });
    const tx = (async () => { calls += 1; return [{ receipt: returned }]; }) as unknown as Tx;
    const repository = new FiscalSubmissionRepository({ async reserve(): Promise<never> { throw new Error("unused"); } });
    const exact = { tenantId: TENANT, propertyNode: PROPERTY, documentId: DOCUMENT,
      providerExtensionId: EXTENSION, actorId: ACTOR, idempotencyKey: "order440", requestId: REQUEST };
    for (const invalid of [{ ...exact, extra: true }, { ...exact, idempotencyKey: " padded " }]) {
      expect(await repository.request(tx, invalid)).toEqual({ ok: false,
        error: { code: "invalid_input", message: "fiscal submission request is invalid" } });
    }
    const accessor = { ...exact };
    Object.defineProperty(accessor, "actorId", { enumerable: true, get: () => ACTOR });
    expect((await repository.request(tx, accessor)).ok).toBe(false);
    const target = { ...exact };
    const proxy = Proxy.revocable(target, {});
    proxy.revoke();
    expect((await repository.request(tx, proxy.proxy)).ok).toBe(false);
    expect(calls).toBe(0);

    const mismatch = await repository.request(tx, exact);
    expect(mismatch).toEqual({ ok: false, error: { code: "invalid_receipt",
      message: "PostgreSQL returned an invalid fiscal submission receipt" } });
    returned = { ...receipt("pending", "send"), credential: "must-not-pass" };
    const extra = await repository.request(tx, exact);
    expect(extra).toEqual({ ok: false, error: { code: "invalid_receipt",
      message: "PostgreSQL returned an invalid fiscal submission receipt" } });
    expect(JSON.stringify([mismatch, extra])).not.toContain("credential");
  });

  test("claim commits a yellow_runtime tenant transaction and rejects a changed whole-wire digest", async () => {
    const malformed = claim({ wireSha256: "3".repeat(64) });
    const harness = runtimeHarness(malformed, receipt());
    const repository = new FiscalSubmissionRepository(harness.pool);
    const result = await repository.claim({ tenantId: TENANT, submissionId: SUBMISSION, leaseSeconds: 60 });
    expect(result).toEqual({ ok: false, error: { code: "invalid_receipt",
      message: "PostgreSQL returned an invalid fiscal submission receipt" } });
    expect(harness.log).toEqual([
      "db:reserve", "db:begin", "db:tenant", "db:identity", "db:claim",
      "db:rollback", "db:identity", "db:release",
    ]);
  });

  test("clean database failure rolls back and reuses the same pool; commit uncertainty fail-closes it", async () => {
    const reusable = runtimeHarness(claim(), receipt());
    reusable.state.failClaimOnce = true;
    const repository = new FiscalSubmissionRepository(reusable.pool);
    const first = await repository.claim({ tenantId: TENANT, submissionId: SUBMISSION, leaseSeconds: 60 });
    expect(first).toEqual({ ok: false, error: { code: "database_error",
      message: "Fiscal submission database operation failed" } });
    const second = await repository.claim({ tenantId: TENANT, submissionId: SUBMISSION, leaseSeconds: 60 });
    expect(second).toMatchObject({ ok: true, value: { claimed: true } });
    expect(reusable.state).toMatchObject({ reserves: 2, releases: 2, closes: 0 });
    expect(reusable.log.filter((entry) => entry === "db:rollback")).toHaveLength(1);

    const broken = runtimeHarness(claim(), receipt());
    broken.state.failCommitOnce = true;
    const brokenRepository = new FiscalSubmissionRepository(broken.pool);
    const uncertain = await brokenRepository.claim({ tenantId: TENANT, submissionId: SUBMISSION, leaseSeconds: 60 });
    expect(uncertain).toEqual({ ok: false, error: { code: "pool_failed",
      message: "Fiscal submission runtime pool is unavailable" } });
    expect(broken.state).toMatchObject({ reserves: 1, releases: 0, closes: 1 });
    const after = await brokenRepository.claim({ tenantId: TENANT, submissionId: SUBMISSION, leaseSeconds: 60 });
    expect(after).toEqual({ ok: false, error: { code: "pool_failed",
      message: "Fiscal submission runtime pool is unavailable" } });
    expect(broken.state.reserves).toBe(1);

    const releaseBroken = runtimeHarness(claim(), receipt());
    releaseBroken.state.failReleaseOnce = true;
    const releaseBrokenRepository = new FiscalSubmissionRepository(releaseBroken.pool);
    expect(await releaseBrokenRepository.claim({ tenantId: TENANT, submissionId: SUBMISSION, leaseSeconds: 60 }))
      .toEqual({ ok: false, error: { code: "pool_failed",
        message: "Fiscal submission runtime pool is unavailable" } });
    expect(releaseBroken.state).toMatchObject({ reserves: 1, releases: 0, closes: 1 });
    expect(await releaseBrokenRepository.claim({ tenantId: TENANT, submissionId: SUBMISSION, leaseSeconds: 60 }))
      .toMatchObject({ ok: false, error: { code: "pool_failed" } });
    expect(releaseBroken.state.reserves).toBe(1);
  });
});

describe("Order 440 one-step fiscal submission worker", () => {
  test("claim COMMIT completes before submit, no transaction spans transport, and reconcile is a new short transaction", async () => {
    const harness = runtimeHarness(claim(), receipt());
    const repository = new FiscalSubmissionRepository(harness.pool);
    let transportInput: Uint8Array | undefined;
    const registry = new VerifiedIndiaIrpAdapterRegistry([registered(async (input) => {
      harness.log.push("provider:submit");
      expect(harness.state.inTransaction).toBe(false);
      transportInput = input.payload;
      return { verified: true, outcome: "accepted", authorityRef: "IRN-ORDER-440", responseSha256: RESPONSE_HASH };
    })]);
    const result = await new FiscalSubmissionWorker(repository, registry).runOnce({
      tenantId: TENANT, submissionId: SUBMISSION, leaseSeconds: 60,
    });
    expect(result).toEqual({ ok: true, kind: "reconciled", action: "submit",
      submissionId: SUBMISSION, attemptId: ATTEMPT, status: "accepted", disposition: "none", replayed: false });
    expect(new TextDecoder().decode(transportInput)).toBe(WIRE_JSON);
    const firstCommit = harness.log.indexOf("db:commit");
    const transport = harness.log.indexOf("provider:submit");
    const reconcileBegin = harness.log.indexOf("db:begin", firstCommit + 1);
    expect(firstCommit).toBeLessThan(transport);
    expect(transport).toBeLessThan(reconcileBegin);
    expect(harness.log.filter((entry) => entry === "db:commit")).toHaveLength(2);
    const reconcileValues = harness.tagValues.at(-1)!;
    expect(reconcileValues.slice(0, 4)).toEqual([TENANT, SUBMISSION, ATTEMPT, CLAIM_TOKEN]);
    expect(JSON.parse(String(reconcileValues[4]))).toEqual({
      type: "transport_result", tenantId: TENANT, providerKey: PROVIDER_KEY,
      attemptId: ATTEMPT, documentId: DOCUMENT, payloadSha256: WIRE_HASH,
      outcome: "accepted", authorityRef: "IRN-ORDER-440", responseSha256: RESPONSE_HASH,
    });
    expect(deeplyFrozen(result)).toBe(true);
  });

  test("an expired/uncertain claim performs lookup instead of resending", async () => {
    let submits = 0;
    let lookups = 0;
    const events: FiscalSubmissionNormalizedResult[] = [];
    const lookedUpClaim = claim({ action: "lookup" });
    const registry = new VerifiedIndiaIrpAdapterRegistry([registered(
      async () => { submits += 1; return { verified: true, outcome: "accepted", authorityRef: "bad", responseSha256: RESPONSE_HASH }; },
      async (input) => {
        lookups += 1;
        expect(input).toEqual({ tenantId: TENANT, providerKey: PROVIDER_KEY,
          attemptId: ATTEMPT, documentId: DOCUMENT, payloadSha256: WIRE_HASH });
        return { verified: true, outcome: "pending" };
      },
    )]);
    const worker = new FiscalSubmissionWorker(
      workerRepository(lookedUpClaim, receipt("submitted", "lookup"), events),
      registry,
    );
    expect(await worker.runOnce({ tenantId: TENANT, submissionId: SUBMISSION, leaseSeconds: 60 }))
      .toMatchObject({ ok: true, kind: "reconciled", action: "lookup", status: "submitted", disposition: "lookup" });
    expect({ submits, lookups }).toEqual({ submits: 0, lookups: 1 });
    expect(events).toEqual([{ type: "lookup_result", tenantId: TENANT, providerKey: PROVIDER_KEY,
      attemptId: ATTEMPT, documentId: DOCUMENT, payloadSha256: WIRE_HASH, outcome: "pending" }]);
  });

  test("transport exceptions are unknown outcomes and reconcile timeout, never known-not-sent", async () => {
    const events: FiscalSubmissionNormalizedResult[] = [];
    const worker = new FiscalSubmissionWorker(
      workerRepository(claim(), receipt("submitted", "lookup"), events),
      new VerifiedIndiaIrpAdapterRegistry([registered(async () => { throw new Error("provider credential body"); })]),
    );
    const result = await worker.runOnce({ tenantId: TENANT, submissionId: SUBMISSION, leaseSeconds: 60 });
    expect(result).toMatchObject({ ok: true, kind: "reconciled", status: "submitted", disposition: "lookup" });
    expect(events).toEqual([{ type: "transport_result", tenantId: TENANT, providerKey: PROVIDER_KEY,
      attemptId: ATTEMPT, documentId: DOCUMENT, payloadSha256: WIRE_HASH, outcome: "timeout" }]);
    expect(JSON.stringify(result)).not.toContain("credential");
  });

  test("known-not-sent becomes retry-required but this worker never starts another attempt", async () => {
    let submissions = 0;
    let claims = 0;
    const events: FiscalSubmissionNormalizedResult[] = [];
    const repository = workerRepository(claim(), receipt("error", "retry"), events);
    const counted: FiscalSubmissionWorkerRepository = {
      async claim(input) { claims += 1; return repository.claim(input); },
      reconcile: repository.reconcile.bind(repository),
    };
    const worker = new FiscalSubmissionWorker(counted, new VerifiedIndiaIrpAdapterRegistry([
      registered(async () => { submissions += 1; return { verified: true, outcome: "known_not_sent" }; }),
    ]));
    expect(await worker.runOnce({ tenantId: TENANT, submissionId: SUBMISSION, leaseSeconds: 60 }))
      .toMatchObject({ ok: true, kind: "reconciled", status: "error", disposition: "retry" });
    expect({ submissions, claims }).toEqual({ submissions: 1, claims: 1 });
    expect(events[0]?.outcome).toBe("known_not_sent");
  });

  test("busy, terminal, and retry-required claims are bounded idle results with zero provider or reconcile calls", async () => {
    for (const reason of ["busy", "terminal", "retry_required"] as const) {
      let providerCalls = 0;
      let reconciles = 0;
      const repository: FiscalSubmissionWorkerRepository = {
        async claim() { return ok({ claimed: false as const, reason }); },
        async reconcile() { reconciles += 1; return ok(receipt()); },
      };
      const registry = new VerifiedIndiaIrpAdapterRegistry([registered(async () => {
        providerCalls += 1;
        return { verified: true, outcome: "pending" };
      })]);
      const result = await new FiscalSubmissionWorker(repository, registry).runOnce({
        tenantId: TENANT, submissionId: SUBMISSION, leaseSeconds: 60,
      });
      expect(result).toEqual({ ok: true, kind: "idle", reason });
      expect({ providerCalls, reconciles }).toEqual({ providerCalls: 0, reconciles: 0 });
      expect(deeplyFrozen(result)).toBe(true);
    }
  });

  test("only an exact registered extension/version/key adapter may receive the wire", async () => {
    let calls = 0;
    const registry = new VerifiedIndiaIrpAdapterRegistry([registered(async () => {
      calls += 1;
      return { verified: true, outcome: "pending" };
    }, undefined, { providerExtensionVersion: 8 })]);
    const result = await new FiscalSubmissionWorker(
      workerRepository(claim(), receipt("submitted", "lookup")),
      registry,
    ).runOnce({ tenantId: TENANT, submissionId: SUBMISSION, leaseSeconds: 60 });
    expect(result).toEqual({ ok: false, error: { code: "adapter_unavailable",
      message: "verified fiscal provider adapter is unavailable" } });
    expect(calls).toBe(0);
    expect(() => new VerifiedIndiaIrpAdapterRegistry([
      registered(async () => ({ verified: true, outcome: "pending" })),
      registered(async () => ({ verified: true, outcome: "pending" })),
    ])).toThrow("duplicated");
  });

  test("unverified, clearance-mode, extra-key, unknown, and hostile provider results cannot establish acceptance", async () => {
    const hostile = new Proxy({ verified: true, outcome: "accepted",
      authorityRef: "IRN", responseSha256: RESPONSE_HASH }, {
      ownKeys() { throw new Error("hostile provider body"); },
    });
    const invalid: unknown[] = [
      { verified: false, outcome: "accepted", authorityRef: "IRN", responseSha256: RESPONSE_HASH },
      { verified: true, outcome: "cleared", authorityRef: "IRN", responseSha256: RESPONSE_HASH },
      { verified: true, outcome: "accepted", authorityRef: "IRN", responseSha256: RESPONSE_HASH, extra: true },
      { verified: true, outcome: "mystery" },
      hostile,
    ];
    for (const value of invalid) {
      let reconciles = 0;
      const base = workerRepository(claim(), receipt());
      const repository: FiscalSubmissionWorkerRepository = {
        claim: base.claim.bind(base),
        async reconcile(input) { reconciles += 1; return base.reconcile(input); },
      };
      const adapter = registered(async () => value as FiscalProviderResolution);
      const result = await new FiscalSubmissionWorker(repository,
        new VerifiedIndiaIrpAdapterRegistry([adapter])).runOnce({
          tenantId: TENANT, submissionId: SUBMISSION, leaseSeconds: 60,
        });
      expect(result).toEqual({ ok: false, error: { code: "provider_result_invalid",
        message: "verified fiscal provider result is invalid" } });
      expect(reconciles).toBe(0);
    }
  });

  test("malformed claims and contradictory terminal receipts fail closed", async () => {
    let providerCalls = 0;
    const registry = new VerifiedIndiaIrpAdapterRegistry([registered(async () => {
      providerCalls += 1;
      return { verified: true, outcome: "accepted", authorityRef: "IRN", responseSha256: RESPONSE_HASH };
    })]);
    const badClaim = { ...claim(), wireSha256: "4".repeat(64) };
    const invalidClaimResult = await new FiscalSubmissionWorker(
      workerRepository(badClaim, receipt()), registry,
    ).runOnce({ tenantId: TENANT, submissionId: SUBMISSION, leaseSeconds: 60 });
    expect(invalidClaimResult).toMatchObject({ ok: false, error: { code: "invalid_claim" } });
    expect(providerCalls).toBe(0);

    const conflict = await new FiscalSubmissionWorker(
      workerRepository(claim(), receipt("accepted", "none", { documentSha256: "5".repeat(64) })),
      registry,
    ).runOnce({ tenantId: TENANT, submissionId: SUBMISSION, leaseSeconds: 60 });
    expect(conflict).toEqual({ ok: false, error: { code: "reconciliation_conflict",
      message: "fiscal submission reconciliation receipt conflicts with the claim" } });
    expect(providerCalls).toBe(1);
  });

  test("invalid worker and repository envelopes, symbols, and accessors remain generic and frozen", async () => {
    let claims = 0;
    const repository: FiscalSubmissionWorkerRepository = {
      async claim() { claims += 1; return { ok: true, value: claim(), extra: "secret" } as never; },
      async reconcile() { throw new Error("unused"); },
    };
    const worker = new FiscalSubmissionWorker(repository, new VerifiedIndiaIrpAdapterRegistry([]));
    const symbolInput = { tenantId: TENANT, submissionId: SUBMISSION, leaseSeconds: 60 } as Record<PropertyKey, unknown>;
    symbolInput[Symbol("hostile")] = true;
    const invalidInput = await worker.runOnce(symbolInput);
    expect(invalidInput).toMatchObject({ ok: false, error: { code: "invalid_input" } });
    expect(claims).toBe(0);
    const envelope = await worker.runOnce({ tenantId: TENANT, submissionId: SUBMISSION, leaseSeconds: 60 });
    expect(envelope).toEqual({ ok: false, error: { code: "repository_error",
      message: "fiscal submission claim failed" } });
    expect(JSON.stringify(envelope)).not.toContain("secret");
    expect(deeplyFrozen(envelope)).toBe(true);
  });
});
