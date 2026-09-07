import { describe, expect, test } from "bun:test";
import type { SQL } from "bun";

import { createApp } from "../src/app";
import {
  assertRuntimeReleaseReadiness,
  buildInfoFromEnvironment,
  CURRENT_MIGRATION_FRONTIER,
  UNKNOWN_BUILD_INFO,
} from "../src/kernel";

const REVISION = "0123456789abcdef0123456789abcdef01234567";

describe("release build identity and readiness", () => {
  test("requires the runtime-only fiscal delivery discovery capability", async () => {
    let query = "";
    let permissionChecks = 0;
    let permissionQuery = "";
    const sql = Object.assign(((strings: TemplateStringsArray) => {
      query = strings.join("?");
      return Promise.resolve([{
        runtimeIdentity: true,
        coreSchemaPresent: true,
        nativeSourceSchemaPresent: true,
        nativeEntryAuthorityExact: true,
        fiscalHistoryProtected: true,
        fiscalEntryAuthorityExact: true,
        fiscalReceiptReadAuthorityExact: true,
        fiscalRetryBindingAuthorityExact: true,
        fiscalReceiptColumnsProtected: true,
        issueFunctionPresent: true,
        publicIssueDenied: true,
        appIssueDenied: true,
        runtimeIssueDenied: true,
        q208PublicEntryAuthorityExact: true,
        q208PrivateEntryAuthorityExact: true,
        q208IndexesExact: true,
        nativeCreditBindingProtected: true,
        nativeCreditEntryAuthorityExact: true,
        nativeCreditPrivateAuthorityExact: true,
      }]);
    }), {
      begin: async (_options: string, operation: (transaction: SQL) => Promise<unknown>) => operation(Object.assign(
        ((strings: TemplateStringsArray) => {
          permissionChecks += 1;
          permissionQuery = strings.join("?");
          return Promise.resolve([{ exact: true }]);
        }),
        { unsafe: () => Promise.resolve([]) },
      ) as unknown as SQL),
    }) as unknown as SQL;

    await expect(assertRuntimeReleaseReadiness(sql)).resolves.toBeUndefined();
    const fiscalEntries = query.match(
      /fiscal_entry\(signature, runtime_allowed\) AS \(VALUES(?<entries>[\s\S]*?)\n    \), fiscal_authority/,
    )?.groups?.entries;
    expect(fiscalEntries).toBeDefined();
    expect(fiscalEntries?.match(/\('[^']+', (?:true|false)\)/g)).toHaveLength(6);
    expect(fiscalEntries).toContain(
      "('public.runtime_due_india_fiscal_submissions(integer,uuid,uuid)', true)",
    );
    expect(fiscalEntries).toContain(
      "('public.read_india_fiscal_submission_delivery_receipt(uuid,uuid,uuid,uuid)', false)",
    );
    expect(query).toContain("has_column_privilege");
    expect(query).toContain("fiscalReceiptReadAuthorityExact");
    expect(query).toContain("fiscalRetryBindingAuthorityExact");
    expect(query).toContain("nativeCreditBindingProtected");
    expect(query).toContain("nativeCreditEntryAuthorityExact");
    expect(query).toContain("nativeCreditPrivateAuthorityExact");
    expect(query).toContain("commit_india_native_fiscal_credit_note(uuid,uuid,uuid,uuid,text,text,uuid)");
    expect(query).toContain("read_india_native_fiscal_credit_note(uuid,uuid,uuid,uuid)");
    expect(query).toContain("india_native_credit_complete");
    expect(query).toContain("trigger_row.tgdeferrable AND trigger_row.tginitdeferred");
    expect(query).toContain("count(attribute.attnum)=22");
    expect(query).toContain("credit_key_shape");
    expect(query).toContain("credit_foreign_key_shape");
    expect(query).toContain("credit_check_shape");
    expect(query).toContain("credit_index_shape");
    expect(query).toContain("india_native_consumed_posting_line_guard");
    expect(query).toContain("fiscalReceiptColumnsProtected");
    expect(query).toContain("q208PublicEntryAuthorityExact");
    expect(query).toContain("q208PrivateEntryAuthorityExact");
    expect(query).toContain("q208IndexesExact");
    expect(query).toContain("prepare_india_native_fiscal_invoice_v4");
    expect(query).toContain("read_india_native_document_context_candidate");
    expect(query).toContain("india_fiscal_submission_retry_binding_v1(text,text,text,uuid,integer)");
    expect(query).toContain("procedure.provolatile='i'");
    expect(query).toContain("NOT procedure.prosecdef");
    expect(query).toContain("NOT procedure.proisstrict");
    expect(query).toContain("procedure.proparallel='u'");
    expect(query).toContain("NOT procedure.proleakproof");
    expect(query).toContain("language.lanname='sql'");
    expect(query).toContain("pg_get_functiondef");
    const q208PublicEntries = query.match(
      /q208_public_entry\(signature, volatility, expected_result, expected_config\) AS \(VALUES(?<entries>[\s\S]*?)\n    \), q208_public_authority/,
    )?.groups?.entries;
    const q208PrivateEntries = query.match(
      /q208_private_entry\(signature, volatility, expected_config\) AS \(VALUES(?<entries>[\s\S]*?)\n    \), q208_private_authority/,
    )?.groups?.entries;
    expect(q208PublicEntries?.match(/\('public\./g)).toHaveLength(7);
    expect(q208PrivateEntries?.match(/\('public\./g)).toHaveLength(2);
    expect(query).toContain("india_native_operator_document_queue");
    expect(query).toContain("india_native_operator_submission_document");
    expect(query).toContain("ARRAY['tenant_id','property_node','business_date','issued_at','id']");
    expect(query).toContain("'0 0 3 3 3'");
    expect(query).toContain("'0 0 0 0'");
    expect(query).toContain("index_row.indoption::text=q208_index.key_options");
    expect(query).not.toContain("'business_date DESC'");
    expect(permissionChecks).toBe(1);
    expect(permissionQuery).toContain("tax-fiscal.documents:read");
    expect(permissionQuery).not.toContain("role_permission");
  });

  test("refuses a ready claim when receipt read authority or column confinement fails", async () => {
    for (const failed of [
      "fiscalReceiptReadAuthorityExact", "fiscalRetryBindingAuthorityExact", "fiscalReceiptColumnsProtected",
      "q208PublicEntryAuthorityExact", "q208PrivateEntryAuthorityExact", "q208IndexesExact",
      "nativeCreditBindingProtected", "nativeCreditEntryAuthorityExact", "nativeCreditPrivateAuthorityExact",
    ]) {
      let permissionChecks = 0;
      for (const value of [false, null, undefined]) {
        const sql = Object.assign((() => Promise.resolve([{
          runtimeIdentity: true, coreSchemaPresent: true, nativeSourceSchemaPresent: true,
          nativeEntryAuthorityExact: true, fiscalHistoryProtected: true, fiscalEntryAuthorityExact: true,
          fiscalReceiptReadAuthorityExact: true, fiscalRetryBindingAuthorityExact: true,
          fiscalReceiptColumnsProtected: true,
          issueFunctionPresent: true, publicIssueDenied: true, appIssueDenied: true, runtimeIssueDenied: true,
          q208PublicEntryAuthorityExact: true, q208PrivateEntryAuthorityExact: true,
          q208IndexesExact: true,
          nativeCreditBindingProtected: true,
          nativeCreditEntryAuthorityExact: true,
          nativeCreditPrivateAuthorityExact: true,
          [failed]: value,
        }])), {
          begin: async () => { permissionChecks += 1; return [{ exact: true }]; },
        }) as unknown as SQL;
        await expect(assertRuntimeReleaseReadiness(sql)).rejects.toThrow("runtime release readiness is unavailable");
        expect(permissionChecks).toBe(0);
      }
    }
  });

  test("requires the document-read permission entry without requiring it to be unassigned", async () => {
    const catalogue = {
      runtimeIdentity: true, coreSchemaPresent: true, nativeSourceSchemaPresent: true,
      nativeEntryAuthorityExact: true, fiscalHistoryProtected: true, fiscalEntryAuthorityExact: true,
      fiscalReceiptReadAuthorityExact: true, fiscalRetryBindingAuthorityExact: true,
      fiscalReceiptColumnsProtected: true,
      issueFunctionPresent: true, publicIssueDenied: true, appIssueDenied: true, runtimeIssueDenied: true,
      q208PublicEntryAuthorityExact: true, q208PrivateEntryAuthorityExact: true,
      q208IndexesExact: true,
      nativeCreditBindingProtected: true,
      nativeCreditEntryAuthorityExact: true,
      nativeCreditPrivateAuthorityExact: true,
    };
    for (const permissionRows of [[], [{ exact: false }]]) {
      let localRole = "";
      const sql = Object.assign((() => Promise.resolve([catalogue])), {
        begin: async (_options: string, operation: (transaction: SQL) => Promise<unknown>) => operation(Object.assign(
          (() => Promise.resolve(permissionRows)),
          { unsafe: (statement: string) => { localRole = statement; return Promise.resolve([]); } },
        ) as unknown as SQL),
      }) as unknown as SQL;
      await expect(assertRuntimeReleaseReadiness(sql)).rejects.toThrow("runtime release readiness is unavailable");
      expect(localRole).toBe("SET LOCAL ROLE app_role");
    }
  });

  test("accepts only an exact immutable Git revision", () => {
    expect(buildInfoFromEnvironment({ YELLOW_BUILD_SHA: REVISION })).toEqual({
      schemaVersion: 1,
      revision: REVISION,
      expectedMigrationFrontier: 87,
    });
    expect(CURRENT_MIGRATION_FRONTIER).toBe(87);
    expect(buildInfoFromEnvironment({})).toBe(UNKNOWN_BUILD_INFO);
    expect(buildInfoFromEnvironment({ YELLOW_BUILD_SHA: "" })).toBe(UNKNOWN_BUILD_INFO);

    for (const value of [
      " 0123456789abcdef0123456789abcdef01234567",
      "0123456789ABCDEF0123456789ABCDEF01234567",
      "0123456",
      "g123456789abcdef0123456789abcdef01234567",
    ]) {
      expect(() => buildInfoFromEnvironment({ YELLOW_BUILD_SHA: value })).toThrow(
        "YELLOW_BUILD_SHA must be an exact lowercase 40-character Git commit SHA",
      );
    }
  });

  test("keeps liveness exact and fails readiness closed without build identity", async () => {
    let probes = 0;
    const app = createApp({ readinessProbe: async () => { probes += 1; } });

    const health = await app.handle(new Request("http://yellow.test/health"));
    expect(health.status).toBe(200);
    expect(await health.text()).toBe('{"status":"ok"}');

    const response = await app.handle(new Request("http://yellow.test/ready"));
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      status: "not_ready",
      reason: "build_revision_unavailable",
      build: { schemaVersion: 1, revision: null, expectedMigrationFrontier: 87 },
    });
    expect(probes).toBe(0);
  });

  test("requires a configured successful runtime dependency probe", async () => {
    const buildInfo = buildInfoFromEnvironment({ YELLOW_BUILD_SHA: REVISION });
    const unconfigured = createApp({ buildInfo });
    const unavailable = createApp({
      buildInfo,
      readinessProbe: async () => { throw new Error("sensitive database detail"); },
      readinessTarget: "yellow_runtime_database",
    });
    const ready = createApp({
      buildInfo,
      readinessProbe: async () => undefined,
      readinessTarget: "yellow_runtime_database",
    });

    const noRuntime = await unconfigured.handle(new Request("http://yellow.test/ready"));
    expect(noRuntime.status).toBe(503);
    expect(await noRuntime.json()).toEqual({
      status: "not_ready",
      reason: "runtime_not_configured",
      build: { schemaVersion: 1, revision: REVISION, expectedMigrationFrontier: 87 },
    });

    const failed = await unavailable.handle(new Request("http://yellow.test/ready"));
    expect(failed.status).toBe(503);
    const failedBody = await failed.text();
    expect(failedBody).not.toContain("sensitive");
    expect(JSON.parse(failedBody)).toEqual({
      status: "not_ready",
      reason: "runtime_dependency_unavailable",
      target: "yellow_runtime_database",
      build: { schemaVersion: 1, revision: REVISION, expectedMigrationFrontier: 87 },
    });

    const success = await ready.handle(new Request("http://yellow.test/ready"));
    expect(success.status).toBe(200);
    expect(success.headers.get("cache-control")).toBe("no-store");
    expect(await success.json()).toEqual({
      status: "ready",
      target: "yellow_runtime_database",
      build: { schemaVersion: 1, revision: REVISION, expectedMigrationFrontier: 87 },
    });
  });
});
