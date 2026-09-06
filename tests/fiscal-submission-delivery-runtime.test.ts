import { describe, expect, test } from "bun:test";
import type { SQL } from "bun";

import {
  FiscalSubmissionDeliveryRuntime,
  type DueFiscalSubmission,
  type DueFiscalSubmissionSource,
  type FiscalSubmissionDeliveryOperations,
} from "../src/contexts/tax-fiscal/fiscal-submission-delivery-runtime";
import { PostgresDueFiscalSubmissionSource } from "../src/workers/postgres-due-fiscal-submissions";

const TENANT_A = "00000000-0000-4000-8000-000000004501";
const TENANT_B = "00000000-0000-4000-8000-000000004502";
const SUBMISSION_A = "00000000-0000-4000-8000-000000004503";
const SUBMISSION_B = "00000000-0000-4000-8000-000000004504";
const EXTENSION = "00000000-0000-4000-8000-000000004505";

function due(tenantId: string, submissionId: string): DueFiscalSubmission {
  return Object.freeze({
    tenantId,
    submissionId,
    providerKey: "in-irp:verified-one",
    providerExtensionId: EXTENSION,
    providerExtensionVersion: 7,
  });
}

describe("Order440/Q204 supervised fiscal delivery runtime", () => {
  test("advances the exact keyset cursor across every row and wraps only after an empty page", async () => {
    const pages: Array<readonly DueFiscalSubmission[]> = [
      [due(TENANT_A, SUBMISSION_A), due(TENANT_B, SUBMISSION_B)],
      [],
      [due(TENANT_A, SUBMISSION_A)],
    ];
    const cursors: unknown[] = [];
    const source: DueFiscalSubmissionSource = {
      async listDueSubmissions(limit, cursor) {
        expect(limit).toBe(2);
        cursors.push(cursor);
        return pages.shift() ?? [];
      },
    };
    const seen: DueFiscalSubmission[] = [];
    const delivery: FiscalSubmissionDeliveryOperations = {
      async runOnce(input) {
        seen.push(input);
        return Object.freeze({ ok: true as const, kind: "idle" as const, reason: "adapter_unavailable" as const });
      },
    };
    const runtime = new FiscalSubmissionDeliveryRuntime(delivery, source, {
      batchSize: 2,
      leaseSeconds: 60,
      transportDeadlineMs: 20_000,
      pollIntervalMs: 100,
    });

    expect(await runtime.drainOnce()).toMatchObject({ discovered: 2, unavailable: 2, failures: [] });
    expect(await runtime.drainOnce()).toMatchObject({ discovered: 0 });
    expect(await runtime.drainOnce()).toMatchObject({ discovered: 1 });
    expect(cursors).toEqual([
      null,
      { tenantId: TENANT_B, submissionId: SUBMISSION_B },
      null,
    ]);
    expect(seen.map(({ tenantId, submissionId }) => ({ tenantId, submissionId }))).toEqual([
      { tenantId: TENANT_A, submissionId: SUBMISSION_A },
      { tenantId: TENANT_B, submissionId: SUBMISSION_B },
      { tenantId: TENANT_A, submissionId: SUBMISSION_A },
    ]);
  });

  test("uses one bounded page per poll, stops before later claims on abort, and reports actual health", async () => {
    const controller = new AbortController();
    let calls = 0;
    const runtime = new FiscalSubmissionDeliveryRuntime({
      async runOnce() {
        calls += 1;
        controller.abort();
        return Object.freeze({ ok: true as const, kind: "idle" as const, reason: "busy" as const });
      },
    }, {
      async listDueSubmissions() {
        return [due(TENANT_A, SUBMISSION_A), due(TENANT_B, SUBMISSION_B)];
      },
    }, { batchSize: 2, leaseSeconds: 60, transportDeadlineMs: 20_000, pollIntervalMs: 100 });

    expect(runtime.state).toBe("disabled");
    await runtime.run({ signal: controller.signal });
    expect(calls).toBe(1);
    expect(runtime.state).toBe("disabled");
  });

  test("fails closed on an oversized source page and never exposes source details", async () => {
    const runtime = new FiscalSubmissionDeliveryRuntime({
      async runOnce() { throw new Error("must not run"); },
    }, {
      async listDueSubmissions() {
        return [due(TENANT_A, SUBMISSION_A), due(TENANT_B, SUBMISSION_B)];
      },
    }, { batchSize: 1, leaseSeconds: 60, transportDeadlineMs: 20_000, pollIntervalMs: 100 });
    await expect(runtime.drainOnce()).rejects.toThrow("due fiscal submission source returned an invalid bounded page");
  });

  test("marks an irreversibly unavailable repository as failed without exposing database details", async () => {
    const controller = new AbortController();
    let notified = 0;
    const runtime = new FiscalSubmissionDeliveryRuntime({
      async runOnce() {
        return Object.freeze({ ok: false as const, error: Object.freeze({
          code: "repository_unavailable" as const,
          message: "must-not-escape database detail",
        }) });
      },
    }, {
      async listDueSubmissions() { return [due(TENANT_A, SUBMISSION_A)]; },
    }, { batchSize: 1, leaseSeconds: 60, transportDeadlineMs: 20_000, pollIntervalMs: 100 });
    await expect(runtime.run({ signal: controller.signal, onError() { notified += 1; } }))
      .rejects.toThrow("fiscal submission runtime repository is unavailable");
    expect(runtime.state).toBe("failed");
    expect(notified).toBe(1);
  });

  test("rejects non-increasing source pages before delivery", async () => {
    let calls = 0;
    const runtime = new FiscalSubmissionDeliveryRuntime({
      async runOnce() {
        calls += 1;
        return Object.freeze({ ok: true as const, kind: "idle" as const, reason: "busy" as const });
      },
    }, {
      async listDueSubmissions() {
        return [due(TENANT_B, SUBMISSION_B), due(TENANT_A, SUBMISSION_A)];
      },
    }, { batchSize: 2, leaseSeconds: 60, transportDeadlineMs: 20_000, pollIntervalMs: 100 });
    await expect(runtime.drainOnce()).rejects.toThrow("invalid keyset page");
    expect(calls).toBe(0);
  });

  test("PostgreSQL discovery uses the exact bounded transaction and minimal function signature", async () => {
    const calls: Array<{ kind: "unsafe" | "query"; text: string; values: unknown[] }> = [];
    const connection = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
      calls.push({ kind: "query", text: strings.join("?"), values });
      return [{ tenant_id: TENANT_A, submission_id: SUBMISSION_A,
        provider_key: "in-irp:verified-one", provider_extension_id: EXTENSION,
        provider_extension_version: 7 }];
    }) as unknown as SQL;
    Object.assign(connection, {
      async unsafe(text: string, values: unknown[]) {
        calls.push({ kind: "unsafe", text, values });
        return [{ set_config: "ignored" }];
      },
    });
    const pool = {
      async begin<T>(operation: (tx: SQL) => Promise<T>) { return operation(connection); },
    } as unknown as SQL;
    const source = new PostgresDueFiscalSubmissionSource(pool);
    const rows = await source.listDueSubmissions(7, { tenantId: TENANT_A, submissionId: SUBMISSION_A });
    expect(rows).toEqual([due(TENANT_A, SUBMISSION_A)]);
    expect(Object.isFrozen(rows)).toBe(true);
    expect(Object.isFrozen(rows[0]!)).toBe(true);
    expect(calls[0]).toMatchObject({ kind: "unsafe", values: ["5000ms", "15000ms"] });
    expect(calls[1]?.text).toContain("runtime_due_india_fiscal_submissions");
    expect(calls[1]?.values).toEqual([7, TENANT_A, SUBMISSION_A]);

    const hostile = { tenantId: TENANT_A, submissionId: SUBMISSION_A };
    Object.defineProperty(hostile, "tenantId", { enumerable: true, get: () => TENANT_A });
    await expect(source.listDueSubmissions(1, hostile)).rejects.toThrow("cursor is invalid");
    expect(calls).toHaveLength(2);
  });
});
