import { describe, expect, test } from "bun:test";
import type { FiscalSubmissionReceipt } from "../src/contexts/tax-fiscal";
import * as fiscalSurface from "../src/contexts/tax-fiscal";
import type { ConnectionPool, Tx } from "../src/kernel";
import { Database } from "../src/kernel";
import {
  RequestIndiaFiscalSubmissionCommand,
  requestIndiaFiscalSubmission,
} from "../src/commands/request-india-fiscal-submission";
import {
  RetryIndiaFiscalSubmissionCommand,
  retryIndiaFiscalSubmission,
} from "../src/commands/retry-india-fiscal-submission";

const TENANT = "00000000-0000-4000-8000-000000004401";
const OTHER_TENANT = "00000000-0000-4000-8000-000000004402";
const PROPERTY = "00000000-0000-4000-8000-000000004403";
const DOCUMENT = "00000000-0000-4000-8000-000000004404";
const EXTENSION = "00000000-0000-4000-8000-000000004405";
const ACTOR = "00000000-0000-4000-8000-000000004406";
const REQUEST_ID = "00000000-0000-4000-8000-000000004407";
const SUBMISSION = "00000000-0000-4000-8000-000000004408";
const ATTEMPT = "00000000-0000-4000-8000-000000004409";

const requestInput = Object.freeze({
  tenantId: TENANT,
  propertyNode: PROPERTY,
  documentId: DOCUMENT,
  providerExtensionId: EXTENSION,
  actorId: ACTOR,
  idempotencyKey: "order440-command-request",
  requestId: REQUEST_ID,
});

const retryInput = Object.freeze({
  tenantId: TENANT,
  submissionId: SUBMISSION,
  actorId: ACTOR,
  idempotencyKey: "order440-command-retry",
  requestId: REQUEST_ID,
});

function receipt(): FiscalSubmissionReceipt;
function receipt(overrides: Record<string, unknown>): Readonly<Record<string, unknown>>;
function receipt(overrides: Record<string, unknown> = {}): unknown {
  return Object.freeze({
    submissionId: SUBMISSION,
    tenantId: TENANT,
    propertyNode: PROPERTY,
    documentId: DOCUMENT,
    documentSha256: "1".repeat(64),
    wireSha256: "2".repeat(64),
    providerKey: "india-irp:test",
    providerExtensionId: EXTENSION,
    providerExtensionVersion: 1,
    attemptId: ATTEMPT,
    attemptNumber: 1,
    retryCount: 0,
    status: "pending",
    disposition: "send",
    transitionSeq: 1,
    replayed: false,
    ...overrides,
  });
}

interface HarnessOptions {
  readonly returnedReceipt?: unknown;
  readonly operationFailure?: Error;
  readonly commitFailure?: Error;
}

function databaseHarness(options: HarnessOptions = {}): {
  readonly database: Database;
  readonly log: string[];
  readonly tenantValues: unknown[];
  readonly operationValues: unknown[][];
  readonly state: { reserves: number; releases: number; closes: number };
} {
  const log: string[] = [];
  const tenantValues: unknown[] = [];
  const operationValues: unknown[][] = [];
  const state = { reserves: 0, releases: 0, closes: 0 };
  const tagged = async (strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown[]> => {
    const sql = strings.join("?");
    if (sql.includes("set_config('app.tenant_id'")) {
      log.push("db:tenant");
      tenantValues.push(...values);
      return [{ tenant_id: values[0] }];
    }
    if (sql.includes("current_user = session_user")) {
      log.push("db:settlement");
      return [{ role_reset: true, tenant_reset: true }];
    }
    if (sql.includes("request_india_fiscal_submission")) {
      log.push("db:request");
      operationValues.push(values);
      if (options.operationFailure) throw options.operationFailure;
      return [{ receipt: options.returnedReceipt ?? receipt() }];
    }
    if (sql.includes("retry_india_fiscal_submission")) {
      log.push("db:retry");
      operationValues.push(values);
      if (options.operationFailure) throw options.operationFailure;
      return [{ receipt: options.returnedReceipt ?? receipt({
        attemptId: "00000000-0000-4000-8000-000000004410",
        attemptNumber: 2,
        retryCount: 1,
      }) }];
    }
    throw new Error(`unexpected tagged query: ${sql}`);
  };
  const connection = Object.assign(tagged, {
    async unsafe(sql: string): Promise<unknown[]> {
      if (sql === "BEGIN") log.push("db:begin");
      else if (sql === "SET LOCAL ROLE app_role") log.push("db:role");
      else if (sql === "COMMIT") {
        log.push("db:commit");
        if (options.commitFailure) throw options.commitFailure;
      } else if (sql === "ROLLBACK") log.push("db:rollback");
      else if (sql === "DISCARD ALL") log.push("db:discard");
      else throw new Error(`unexpected unsafe query: ${sql}`);
      return [];
    },
    release(): void {
      log.push("db:release");
      state.releases += 1;
    },
    async close(): Promise<void> {
      log.push("db:close");
      state.closes += 1;
    },
  }) as unknown as Tx;
  const pool: ConnectionPool = {
    async reserve() {
      log.push("db:reserve");
      state.reserves += 1;
      return connection;
    },
  };
  return { database: new Database(pool), log, tenantValues, operationValues, state };
}

describe("Q201 fiscal submission application commands", () => {
  test("the bounded-context surface exports only the Tx request/retry service", () => {
    expect(typeof fiscalSurface.FiscalSubmissionService).toBe("function");
    expect("FiscalSubmissionRepository" in fiscalSurface).toBe(false);
    expect("FiscalSubmissionWorker" in fiscalSurface).toBe(false);
    expect("snapshotFiscalSubmissionClaim" in fiscalSurface).toBe(false);
    expect("snapshotFiscalSubmissionNormalizedResult" in fiscalSurface).toBe(false);
  });

  test("valid request and retry commit only after exact tenant-bound receipts", async () => {
    const requestHarness = databaseHarness();
    const requested = await requestIndiaFiscalSubmission(requestHarness.database, requestInput);
    expect(requested).toEqual({ ok: true, value: receipt() });
    expect(requestHarness.log).toEqual([
      "db:reserve", "db:begin", "db:tenant", "db:role", "db:request",
      "db:commit", "db:settlement", "db:release",
    ]);
    expect(requestHarness.tenantValues).toEqual([TENANT]);
    expect(requestHarness.operationValues).toEqual([[
      TENANT, PROPERTY, DOCUMENT, EXTENSION, ACTOR, "order440-command-request", REQUEST_ID,
    ]]);
    expect(Object.isFrozen(requested)).toBe(true);
    expect(requested.ok && Object.isFrozen(requested.value)).toBe(true);

    const retryHarness = databaseHarness();
    const retried = await retryIndiaFiscalSubmission(retryHarness.database, retryInput);
    expect(retried).toMatchObject({ ok: true, value: {
      tenantId: TENANT, submissionId: SUBMISSION, attemptNumber: 2, retryCount: 1,
    } });
    expect(retryHarness.log).toEqual([
      "db:reserve", "db:begin", "db:tenant", "db:role", "db:retry",
      "db:commit", "db:settlement", "db:release",
    ]);
  });

  test("failed Results and thrown operations roll back before returning sanitized failures", async () => {
    const secret = "postgres://operator:secret@example.invalid/yellow";
    const requestHarness = databaseHarness({ operationFailure: new Error(secret) });
    const requested = await new RequestIndiaFiscalSubmissionCommand(requestHarness.database).execute(requestInput);
    expect(requested).toEqual({ ok: false, error: {
      code: "database_error", message: "Fiscal submission request could not be persisted",
    } });
    expect(JSON.stringify(requested)).not.toContain(secret);
    expect(requestHarness.log).toEqual([
      "db:reserve", "db:begin", "db:tenant", "db:role", "db:request",
      "db:rollback", "db:settlement", "db:release",
    ]);

    const retryHarness = databaseHarness({ operationFailure: new Error(secret) });
    const retried = await new RetryIndiaFiscalSubmissionCommand(retryHarness.database).execute(retryInput);
    expect(retried).toEqual({ ok: false, error: {
      code: "database_error", message: "Fiscal submission retry could not be persisted",
    } });
    expect(retryHarness.log).toContain("db:rollback");
    expect(retryHarness.log).not.toContain("db:commit");
  });

  test("malformed and tenant-mismatched receipts roll back, never commit", async () => {
    for (const returnedReceipt of [
      { ...receipt(), credential: "must-not-pass" },
      receipt({ tenantId: OTHER_TENANT }),
      receipt({ documentId: "00000000-0000-4000-8000-000000004499" }),
      receipt({ providerExtensionId: "00000000-0000-4000-8000-000000004498" }),
    ]) {
      const harness = databaseHarness({ returnedReceipt });
      const result = await requestIndiaFiscalSubmission(harness.database, requestInput);
      expect(result).toEqual({ ok: false, error: {
        code: "invalid_receipt", message: "PostgreSQL returned an invalid fiscal submission receipt",
      } });
      expect(harness.log).toContain("db:rollback");
      expect(harness.log).not.toContain("db:commit");
      expect(JSON.stringify(result)).not.toContain("credential");
    }

    const retryHarness = databaseHarness({ returnedReceipt: receipt({ tenantId: OTHER_TENANT }) });
    expect(await retryIndiaFiscalSubmission(retryHarness.database, retryInput)).toMatchObject({
      ok: false, error: { code: "invalid_receipt" },
    });
    expect(retryHarness.log).toContain("db:rollback");
    expect(retryHarness.log).not.toContain("db:commit");
  });

  test("commit failure is a failure and the real transaction wrapper attempts rollback", async () => {
    const secret = "secret commit ambiguity";
    const harness = databaseHarness({ commitFailure: new Error(secret) });
    const result = await requestIndiaFiscalSubmission(harness.database, requestInput);
    expect(result).toEqual({ ok: false, error: {
      code: "database_error", message: "Fiscal submission request could not be persisted",
    } });
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(harness.log).toEqual([
      "db:reserve", "db:begin", "db:tenant", "db:role", "db:request", "db:commit",
      "db:rollback", "db:settlement", "db:release",
    ]);
  });

  test("malformed input, accessors, and revoked proxies never reserve or select a tenant", async () => {
    const harness = databaseHarness();
    const accessor = { ...requestInput };
    Object.defineProperty(accessor, "tenantId", { enumerable: true, get: () => TENANT });
    const proxy = new Proxy({ ...requestInput }, {});
    const revoked = Proxy.revocable({ ...requestInput }, {});
    revoked.revoke();
    for (const invalid of [
      { ...requestInput, extra: true },
      { ...requestInput, tenantId: OTHER_TENANT, idempotencyKey: " padded " },
      accessor,
      proxy,
      revoked.proxy,
      null,
    ]) {
      expect(await requestIndiaFiscalSubmission(harness.database, invalid)).toEqual({
        ok: false,
        error: { code: "invalid_input", message: "fiscal submission request is invalid" },
      });
    }
    const retryAccessor = { ...retryInput };
    Object.defineProperty(retryAccessor, "tenantId", { enumerable: true, get: () => TENANT });
    const retryProxy = new Proxy({ ...retryInput }, {});
    for (const invalid of [{ ...retryInput, extra: true }, retryAccessor, retryProxy]) {
      expect(await retryIndiaFiscalSubmission(harness.database, invalid)).toEqual({
        ok: false,
        error: { code: "invalid_input", message: "fiscal submission retry request is invalid" },
      });
    }
    expect(harness.log).toEqual([]);
    expect(harness.state).toEqual({ reserves: 0, releases: 0, closes: 0 });
  });

  test("commands preserve caller input and use a detached frozen snapshot only", async () => {
    const mutable = { ...requestInput };
    const before = structuredClone(mutable);
    const harness = databaseHarness();
    const result = await requestIndiaFiscalSubmission(harness.database, mutable);
    expect(result.ok).toBe(true);
    expect(mutable).toEqual(before);
    expect(Object.isFrozen(mutable)).toBe(false);
    expect(harness.tenantValues).toEqual([before.tenantId]);
    expect(harness.operationValues[0]).toEqual([
      before.tenantId, before.propertyNode, before.documentId, before.providerExtensionId,
      before.actorId, before.idempotencyKey, before.requestId,
    ]);
  });
});
