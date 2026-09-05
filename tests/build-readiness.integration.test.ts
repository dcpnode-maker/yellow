import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import { runMigrations } from "../scripts/migrate";
import { assertRuntimeReleaseReadiness } from "../src/kernel";

const ADMIN_URL = process.env.YELLOW_DEPLOY_DATABASE_URL;
const RUNTIME_URL = process.env.YELLOW_RUNTIME_DATABASE_URL;
const REQUIRED = process.env.YELLOW_REQUIRE_BUILD_READINESS === "1";

if (REQUIRED && (!ADMIN_URL || !RUNTIME_URL)) {
  throw new Error("Order438 build-readiness proof requires deploy and runtime PostgreSQL URLs");
}

const databaseDescribe = ADMIN_URL && RUNTIME_URL ? describe.serial : describe.skip;
const databaseName = `yellow_build_readiness_${crypto.randomUUID().replaceAll("-", "")}`;
let administrator: SQL | undefined;
let deployment: SQL | undefined;
let runtime: SQL | undefined;

databaseDescribe("Order438 runtime release readiness identity", () => {
  beforeAll(async () => {
    administrator = new SQL(ADMIN_URL!, { max: 1, prepare: false });
    await administrator.unsafe(`CREATE DATABASE "${databaseName}"`);

    const deploymentUrl = new URL(ADMIN_URL!);
    deploymentUrl.pathname = `/${databaseName}`;
    const runtimeUrl = new URL(RUNTIME_URL!);
    runtimeUrl.pathname = `/${databaseName}`;

    await runMigrations({
      databaseUrl: deploymentUrl.toString(),
      logger: () => undefined,
    });
    deployment = new SQL(deploymentUrl.toString(), { max: 1, prepare: false });
    runtime = new SQL(runtimeUrl.toString(), { max: 1, prepare: false });
  }, 120_000);

  afterAll(async () => {
    await runtime?.close();
    await deployment?.close();
    if (administrator) {
      await administrator.unsafe(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
      await administrator.close();
    }
  });

  test("accepts only a direct yellow_runtime login against the contained release catalogue", async () => {
    await expect(assertRuntimeReleaseReadiness(runtime!)).resolves.toBeUndefined();
  });

  test("rejects the deployment login", async () => {
    await expect(assertRuntimeReleaseReadiness(deployment!)).rejects.toThrow(
      "runtime release readiness is unavailable",
    );
  });

  test("rejects a privileged deployment session after SET ROLE yellow_runtime", async () => {
    const connection = await deployment!.reserve();
    try {
      await connection.unsafe("BEGIN");
      await connection.unsafe("SET LOCAL ROLE yellow_runtime");
      await expect(assertRuntimeReleaseReadiness(connection)).rejects.toThrow(
        "runtime release readiness is unavailable",
      );
    } finally {
      await connection.unsafe("ROLLBACK");
      connection.release();
    }
  });
});
