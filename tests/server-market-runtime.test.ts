/** Q266 pure composition/readiness and source-order proof; never starts a server or reads artifact files. */
import { describe, expect, test } from "bun:test";
import type { SQL } from "bun";
import { createApp } from "../src/app";
import { MarketHttpApi } from "../src/http/market";
import type { MarketCompsetDependencies } from "../src/contexts/distribution";
import {
  assertMarketWorkbenchReadiness, composeMarketWorkbench, loadMarketWorkbenchConfiguration,
} from "../src/runtime/market-workbench";
import type { MarketRegionalArtifactCatalogResult } from "../src/runtime/market-regional-artifact-loader";

function catalog(): MarketRegionalArtifactCatalogResult {
  // Trusted-loader test double only; these are not byte-admitted release artifacts.
  return Object.freeze({ ok: true, value: Object.freeze({ entries: Object.freeze(["riyadh", "dubai"].map(logicalId =>
    Object.freeze({ logicalId, admission: Object.freeze({ identity: Object.freeze({ logicalId }), artifact: Object.freeze({ records: Object.freeze([]) }) }) }))) })
  }) as unknown as MarketRegionalArtifactCatalogResult;
}
const environment = { YELLOW_MARKET_WORKBENCH: "1", YELLOW_OPERATOR_WORKBENCH: "1" };
const dependencies: Omit<MarketCompsetDependencies, "admissions"> = {
  registry: { async createVersion() { throw new Error("unexpected registry mutation"); } },
  events: { async publish() { throw new Error("unexpected event publication"); } },
};

describe("Order472 Q266 explicit market startup composition", () => {
  test("disabled configuration reads no artifacts and mounts no market API", async () => {
    let calls = 0;
    for (const flag of [undefined, "", "0"]) {
      const configuration = await loadMarketWorkbenchConfiguration({ YELLOW_MARKET_WORKBENCH: flag }, async () => { calls += 1; return catalog(); });
      expect(configuration).toEqual({ enabled: false });
      expect(Object.isFrozen(configuration)).toBe(true);
      expect(composeMarketWorkbench(configuration, dependencies)).toBeUndefined();
      const app = createApp({ marketApi: composeMarketWorkbench(configuration, dependencies) });
      expect((await app.handle(new Request("http://yellow.test/api/v1/properties/00000000-0000-0000-0000-000000004720/market/compset"))).status).toBe(404);
    }
    expect(calls).toBe(0);
  });
  test("requires explicit normal operator mode before a single loader invocation", async () => {
    let calls = 0;
    const loader = async () => { calls += 1; return catalog(); };
    for (const invalid of [
      { YELLOW_MARKET_WORKBENCH: "1" },
      { ...environment, YELLOW_OPERATOR_WORKBENCH: "0" },
      { ...environment, YELLOW_HOSTED_PROVIDER_ONLY: "1" },
      { ...environment, YELLOW_MARKET_WORKBENCH: "true" },
    ]) await expect(loadMarketWorkbenchConfiguration(invalid, loader)).rejects.toThrow("Market workbench deployment configuration is unavailable");
    expect(calls).toBe(0);
    const configuration = await loadMarketWorkbenchConfiguration(environment, loader);
    expect(calls).toBe(1); expect(configuration.enabled).toBe(true);
    expect(configuration.enabled && Object.isFrozen(configuration.admissions)).toBe(true);
    expect(composeMarketWorkbench(configuration, dependencies)).toBeInstanceOf(MarketHttpApi);
    expect(composeMarketWorkbench(configuration, dependencies)).toBeInstanceOf(MarketHttpApi);
    expect(calls).toBe(1);
  });
  test("enabled load errors and partial catalog fail with static non-secret text", async () => {
    for (const loader of [
      async () => { throw new Error("private E:\\artifact path and credential"); },
      async () => ({ ok: false, error: { code: "reader_failed", message: "Market regional artifact catalog could not be loaded." } }) as const,
      async () => ({ ok: true, value: { entries: [] } }) as const,
    ]) {
      const error = await loadMarketWorkbenchConfiguration(environment, loader).catch(caught => caught as Error);
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe("Market workbench deployment configuration is unavailable");
      expect((error as Error).message).not.toContain("private");
    }
  });
  test("catalog awaits before all resources; readiness and API share that same configuration", async () => {
    const source = await Bun.file(new URL("../src/server.ts", import.meta.url)).text();
    const admission = source.indexOf("await loadMarketWorkbenchConfiguration(Bun.env)");
    expect(admission).toBeGreaterThan(0);
    for (const later of ["Database.connect", "new SQL(", "superviseWorker(projectionConsumer.run", "runtimeApp().listen"]) {
      expect(source.indexOf(later)).toBeGreaterThan(admission);
    }
    expect(source.match(/await loadMarketWorkbenchConfiguration\(Bun\.env\)/g)).toHaveLength(1);
    expect(source).toContain('if (marketWorkbenchConfiguration.enabled)');
    expect(source).toContain('await readinessPool.begin("read only", async tx =>');
    expect(source).toContain('await tx.unsafe("SET LOCAL ROLE app_role")');
    expect(source.indexOf("await assertMarketWorkbenchReadiness(tx)")).toBeGreaterThan(source.indexOf("await assertRuntimeReleaseReadiness(readinessPool)"));
    expect(source).toContain("marketApi: composeMarketWorkbench(marketWorkbenchConfiguration, { registry, events, idempotency: new PostgresIdempotency() })");
    expect(source).toContain("const maxRequestBodySize = 16 * 1024");
    const kernel = await Bun.file(new URL("../src/kernel/build-info.ts", import.meta.url)).text();
    expect(kernel).toContain("CURRENT_MIGRATION_FRONTIER = 92 as const");
    expect(kernel).not.toContain("market_compset");
    expect(kernel).not.toContain("../contexts/distribution");
  });
});

describe("Order472 Q266 exact market catalog readiness", () => {
  test("accepts all exact fields and binds canonical function, schema and permissions", async () => {
    let text = ""; let values: readonly unknown[] = [];
    const tx = ((strings: TemplateStringsArray, ...parameters: unknown[]) => {
      text = strings.join("?"); values = parameters;
      return Promise.resolve([{ authorityExact: true, schemaExact: true, permissionsExact: true }]);
    }) as unknown as SQL;
    await assertMarketWorkbenchReadiness(tx);
    expect(text).toContain("procedure.proowner = 'yellow_owner'::regrole");
    expect(text).toContain("procedure.prosecdef");
    expect(text).toContain("acl.grantee NOT IN");
    expect(text).toContain("procedure.prosrc");
    expect(text).toContain("FROM public.extension_type");
    expect(text).toContain("FROM public.permission");
    expect(values).toContain("public.assert_market_compset_authority(uuid,uuid,uuid,text)");
    expect(values).toContain("distribution.market:read"); expect(values).toContain("distribution.market:write");
    expect(values.some(value => typeof value === "string" && value.includes('"yellow/market-compset/v1"'))).toBe(true);
    const migration = await Bun.file(new URL("../migrations/0092_market_compset_authority.sql", import.meta.url)).text();
    const body = migration.split("$market_authority$")[1];
    expect(body).toBeDefined();
    expect(values).toContain(new Bun.CryptoHasher("sha256").update(body!.replaceAll("\r\n", "\n")).digest("hex"));
  });
  test("missing, false, nonboolean, extra and partial results fail closed", async () => {
    const exact = { authorityExact: true, schemaExact: true, permissionsExact: true };
    const inputs: unknown[][] = [[], [exact, exact], [{ authorityExact: true }], [{ ...exact, extra: true }]];
    for (const key of Object.keys(exact)) for (const value of [false, null, undefined, 1, "true"]) inputs.push([{ ...exact, [key]: value }]);
    for (const rows of inputs) {
      const tx = (() => Promise.resolve(rows)) as unknown as SQL;
      await expect(assertMarketWorkbenchReadiness(tx)).rejects.toThrow("Market workbench readiness is unavailable");
    }
    const failing = (() => Promise.reject(new Error("private connection detail"))) as unknown as SQL;
    const error = await assertMarketWorkbenchReadiness(failing).catch(caught => caught as Error);
    expect((error as Error).message).toBe("Market workbench readiness is unavailable");
  });
});
