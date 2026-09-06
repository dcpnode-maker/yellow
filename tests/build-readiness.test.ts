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
    const sql = ((strings: TemplateStringsArray) => {
      query = strings.join("?");
      return Promise.resolve([{
        runtimeIdentity: true,
        coreSchemaPresent: true,
        nativeSourceSchemaPresent: true,
        nativeEntryAuthorityExact: true,
        fiscalHistoryProtected: true,
        fiscalEntryAuthorityExact: true,
        issueFunctionPresent: true,
        publicIssueDenied: true,
        appIssueDenied: true,
        runtimeIssueDenied: true,
      }]);
    }) as unknown as SQL;

    await expect(assertRuntimeReleaseReadiness(sql)).resolves.toBeUndefined();
    const fiscalEntries = query.match(
      /fiscal_entry\(signature, runtime_allowed\) AS \(VALUES(?<entries>[\s\S]*?)\n    \), fiscal_authority/,
    )?.groups?.entries;
    expect(fiscalEntries).toBeDefined();
    expect(fiscalEntries?.match(/\('[^']+', (?:true|false)\)/g)).toHaveLength(5);
    expect(fiscalEntries).toContain(
      "('public.runtime_due_india_fiscal_submissions(integer,uuid,uuid)', true)",
    );
  });

  test("accepts only an exact immutable Git revision", () => {
    expect(buildInfoFromEnvironment({ YELLOW_BUILD_SHA: REVISION })).toEqual({
      schemaVersion: 1,
      revision: REVISION,
      expectedMigrationFrontier: 80,
    });
    expect(CURRENT_MIGRATION_FRONTIER).toBe(80);
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
      build: { schemaVersion: 1, revision: null, expectedMigrationFrontier: 80 },
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
      build: { schemaVersion: 1, revision: REVISION, expectedMigrationFrontier: 80 },
    });

    const failed = await unavailable.handle(new Request("http://yellow.test/ready"));
    expect(failed.status).toBe(503);
    const failedBody = await failed.text();
    expect(failedBody).not.toContain("sensitive");
    expect(JSON.parse(failedBody)).toEqual({
      status: "not_ready",
      reason: "runtime_dependency_unavailable",
      target: "yellow_runtime_database",
      build: { schemaVersion: 1, revision: REVISION, expectedMigrationFrontier: 80 },
    });

    const success = await ready.handle(new Request("http://yellow.test/ready"));
    expect(success.status).toBe(200);
    expect(success.headers.get("cache-control")).toBe("no-store");
    expect(await success.json()).toEqual({
      status: "ready",
      target: "yellow_runtime_database",
      build: { schemaVersion: 1, revision: REVISION, expectedMigrationFrontier: 80 },
    });
  });
});
