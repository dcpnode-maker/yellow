import { describe, expect, test } from "bun:test";

import { createApp } from "../src/app";
import {
  buildInfoFromEnvironment,
  CURRENT_MIGRATION_FRONTIER,
  UNKNOWN_BUILD_INFO,
} from "../src/kernel";

const REVISION = "0123456789abcdef0123456789abcdef01234567";

describe("release build identity and readiness", () => {
  test("accepts only an exact immutable Git revision", () => {
    expect(buildInfoFromEnvironment({ YELLOW_BUILD_SHA: REVISION })).toEqual({
      schemaVersion: 1,
      revision: REVISION,
      expectedMigrationFrontier: 79,
    });
    expect(CURRENT_MIGRATION_FRONTIER).toBe(79);
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
      build: { schemaVersion: 1, revision: null, expectedMigrationFrontier: 79 },
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
      build: { schemaVersion: 1, revision: REVISION, expectedMigrationFrontier: 79 },
    });

    const failed = await unavailable.handle(new Request("http://yellow.test/ready"));
    expect(failed.status).toBe(503);
    const failedBody = await failed.text();
    expect(failedBody).not.toContain("sensitive");
    expect(JSON.parse(failedBody)).toEqual({
      status: "not_ready",
      reason: "runtime_dependency_unavailable",
      target: "yellow_runtime_database",
      build: { schemaVersion: 1, revision: REVISION, expectedMigrationFrontier: 79 },
    });

    const success = await ready.handle(new Request("http://yellow.test/ready"));
    expect(success.status).toBe(200);
    expect(success.headers.get("cache-control")).toBe("no-store");
    expect(await success.json()).toEqual({
      status: "ready",
      target: "yellow_runtime_database",
      build: { schemaVersion: 1, revision: REVISION, expectedMigrationFrontier: 79 },
    });
  });
});
