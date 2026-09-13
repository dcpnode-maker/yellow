import { describe, expect, test } from "bun:test";

import {
  MARKET_COMPSET_CI_DATABASE,
  readMarketCompsetIntegrationEnvironment,
} from "./helpers/market-compset-environment";

const deploy = "postgres://yellow_deploy:deploy-secret@127.0.0.1:54329/yellow_order472_market_ci";
const runtime = "postgres://yellow_runtime:runtime-secret@127.0.0.1:54329/yellow_order472_market_ci";
const registrar = "postgres://yellow_extension_registrar:registrar-secret@127.0.0.1:54329/yellow_order472_market_ci";

function ciEnvironment(overrides: Record<string, string | undefined> = {}) {
  return {
    YELLOW_REQUIRE_MARKET_COMPSET_INTEGRATION: "1",
    YELLOW_ORDER472_MARKET_COMPSET_CI_MODE: "1",
    CI: "true",
    GITHUB_ACTIONS: "true",
    POSTGRES_ADDRESS: "127.0.0.1:54329",
    YELLOW_ORDER472_MARKET_COMPSET_DEPLOY_DATABASE_URL: deploy,
    YELLOW_ORDER472_MARKET_COMPSET_RUNTIME_DATABASE_URL: runtime,
    YELLOW_ORDER472_MARKET_COMPSET_REGISTRAR_DATABASE_URL: registrar,
    ...overrides,
  };
}

describe("Order472 market integration environment selector", () => {
  test("delegates the default path to the unchanged exact native authority", () => {
    const native = readMarketCompsetIntegrationEnvironment({
      YELLOW_REQUIRE_MARKET_COMPSET_INTEGRATION: "1",
      YELLOW_ORDER472_MARKET_COMPSET_DEPLOY_DATABASE_URL: "postgres://yellow_deploy:native-secret@127.0.0.1:55503/yellow_order472_compset_20260913",
      YELLOW_ORDER472_MARKET_COMPSET_RUNTIME_DATABASE_URL: "postgres://yellow_runtime:native-secret@127.0.0.1:55503/yellow_order472_compset_20260913",
      YELLOW_ORDER472_MARKET_COMPSET_REGISTRAR_DATABASE_URL: "postgres://yellow_extension_registrar:native-secret@127.0.0.1:55503/yellow_order472_compset_20260913",
    });
    expect(native.mode).toBe("native");
    expect(native.database).toBe("yellow_order472_compset_20260913");
  });

  test("accepts only the explicit ephemeral CI authority", () => {
    expect(readMarketCompsetIntegrationEnvironment(ciEnvironment())).toEqual({
      mode: "ci", database: MARKET_COMPSET_CI_DATABASE,
      deployDatabaseUrl: deploy, runtimeDatabaseUrl: runtime, registrarDatabaseUrl: registrar,
    });
    expect(readMarketCompsetIntegrationEnvironment(ciEnvironment({
      YELLOW_ORDER472_MARKET_COMPSET_DEPLOY_DATABASE_URL: deploy.replace("postgres:", "postgresql:"),
    })).mode).toBe("ci");
  });

  test("rejects missing opt-in, CI sentinel, CI identity, address binding, and role/database substitutions", () => {
    const invalid = [
      ciEnvironment({ YELLOW_REQUIRE_MARKET_COMPSET_INTEGRATION: "0" }),
      ciEnvironment({ YELLOW_ORDER472_MARKET_COMPSET_CI_MODE: undefined }),
      ciEnvironment({ CI: "false" }),
      ciEnvironment({ GITHUB_ACTIONS: "false" }),
      ciEnvironment({ POSTGRES_ADDRESS: "127.0.0.1:54330" }),
      ciEnvironment({ YELLOW_ORDER472_MARKET_COMPSET_RUNTIME_DATABASE_URL: deploy }),
      ciEnvironment({ YELLOW_ORDER472_MARKET_COMPSET_DEPLOY_DATABASE_URL: deploy.replace("market_ci", "other") }),
      ciEnvironment({ YELLOW_ORDER472_MARKET_COMPSET_DEPLOY_DATABASE_URL: deploy.replace("127.0.0.1", "localhost") }),
      ciEnvironment({ YELLOW_ORDER472_MARKET_COMPSET_DEPLOY_DATABASE_URL: `${deploy}?sslmode=require` }),
      ciEnvironment({ YELLOW_ORDER472_MARKET_COMPSET_DEPLOY_DATABASE_URL: `${deploy}#fragment` }),
      ciEnvironment({ YELLOW_ORDER472_MARKET_COMPSET_DEPLOY_DATABASE_URL: "postgres://yellow_deploy:@127.0.0.1:54329/yellow_order472_market_ci" }),
      ciEnvironment({ POSTGRES_ADDRESS: "127.0.0.1" }),
      ciEnvironment({ POSTGRES_ADDRESS: "127.0.0.1:65536" }),
      ciEnvironment({ YELLOW_ORDER472_MARKET_COMPSET_REGISTRAR_DATABASE_URL: undefined }),
      ciEnvironment({
        YELLOW_ORDER472_MARKET_COMPSET_DEPLOY_DATABASE_URL: undefined,
        DATABASE_URL: deploy,
      }),
    ];
    for (const environment of invalid) {
      let thrown: unknown;
      try {
        readMarketCompsetIntegrationEnvironment(environment);
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(Error);
      const message = (thrown as Error).message;
      expect(message).not.toContain("secret");
      expect(message).not.toContain(deploy);
      expect(message).not.toContain(runtime);
      expect(message).not.toContain(registrar);
    }
  });
});
