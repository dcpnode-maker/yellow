import { describe, expect, test } from "bun:test";
import { join } from "node:path";

describe("Order 371 current setup catalogue oracle", () => {
  test("full-project migration acceptance stays current87 without relabeling the historical86 boundary", async () => {
    const source = await Bun.file(new URL("migrate.integration.test.ts", import.meta.url)).text();
    const testBlock = (name: string): string => {
      const start = source.indexOf(`  test(\n    "${name}"`);
      expect(start).toBeGreaterThanOrEqual(0);
      const end = source.indexOf("\n  test(", start + name.length);
      return source.slice(start, end < 0 ? undefined : end);
    };

    expect(testBlock("applies the exact app_role internalization migration without schema changes"))
      .toContain("expect(tableCount).toEqual([{ count: 129 }])");
    for (const [name, shape] of [
      ["applies the exact governed cashier-session migration", "tables: 129, policies: 119, functions: 3"],
      ["applies the exact governed receivable-transfer migration", "tables: 129, policies: 119, functions: 1, approvalColumns: 1"],
      ["applies the exact governed housekeeping-task transition migration", "tables: 129, policies: 119, functions: 1"],
    ] as const) {
      expect(testBlock(name)).toContain(shape);
    }
    expect(testBlock("applies the exact positive-tax semantic-route migration with SELECT-only app authority"))
      .toContain("tables: 129,\n          policies: 119,");
    const fullUpgrade = testBlock(
      "stages historical lineage then applies correction, repair and all India fiscal evidence exactly once",
    );
    for (const current of [
      '"0087_india_native_fiscal_credit_note.sql"',
      "expect(upgradedLedger).toHaveLength(87)",
      "expect(noOp.discoveredFiles).toBe(87)",
      "tables: 129, rlsTables: 119, policies: 119, forceRlsTables: 28",
    ]) expect(fullUpgrade).toContain(current);
    expect(testBlock("applies exact posting integrity, read-only routes, and authority-safe day sealing"))
      .toContain("expect(tableCount).toEqual([{ count: 129 }])");

    const historicalStart = source.indexOf('describe("Order440/Q212 canonical migration 85 to 86 boundary"');
    const historicalEnd = source.indexOf('describe("Order446 canonical migration 86 to 87 boundary"');
    expect({ historicalStart, historicalEnd }).toEqual({
      historicalStart: expect.any(Number), historicalEnd: expect.any(Number),
    });
    expect(historicalStart).toBeGreaterThanOrEqual(0);
    expect(historicalEnd).toBeGreaterThan(historicalStart);
    const historical86 = source.slice(historicalStart, historicalEnd);
    expect(historical86).toContain("expect(finalLedger).toHaveLength(86)");
    expect(historical86).toContain("discoveredFiles: 86");
    expect(historical86).toContain("expect(fresh.appliedFiles).toHaveLength(86)");
  });

  test("other full-current acceptance suites retain the exact current87 catalogue", async () => {
    const financial = await Bun.file(new URL("financial-postings.integration.test.ts", import.meta.url)).text();
    const applicability = await Bun.file(new URL("india-gst-accommodation-quoted-rate-applicability-recording.integration.test.ts", import.meta.url)).text();
    expect({
      financial129: financial.includes("table_type='BASE TABLE'`)[0]!.n).toBe(129)"),
      applicabilityTitle87: applicability.includes("fresh catalogue is exactly 87/129/119/119/28/2"),
      applicabilityShape87: applicability.includes("migrations:87, tables:129, rls:119, policies:119, forced:28, views:2"),
    }).toEqual({ financial129: true, applicabilityTitle87: true, applicabilityShape87: true });
  });

  test("derives the migration and public-table frontier before checking setup", async () => {
    const migrationGlob = new Bun.Glob("*.sql");
    const migrations = [...migrationGlob.scanSync({ cwd: join(import.meta.dir, "..", "migrations") })].sort();
    const expectedSchema = await Bun.file(new URL("schema/expected.sql", import.meta.url)).text();
    const setup = await Bun.file(new URL("../setup.sh", import.meta.url)).text();
    const nativeSetup = await Bun.file(new URL("../setup.ps1", import.meta.url)).text();

    const lastMigration = migrations.at(-1);
    const highestMigration = Number(lastMigration?.slice(0, 4));
    const publicBaseTables = expectedSchema.match(/^CREATE TABLE public\./gm)?.length ?? 0;

    expect({ migrationCount: migrations.length, highestMigration, publicBaseTables }).toEqual({
      migrationCount: 87,
      highestMigration: 87,
      publicBaseTables: 129,
    });
    expect(setup).toContain("[ \"$tables\" = '129' ]");
    for (const entrypoint of [setup, nativeSetup]) {
      expect(entrypoint).toContain("expected 129 after migrations 1-87");
      expect(entrypoint).toContain("yellow_test tables: 129 after migrations 1-87");
    }
    expect(setup).not.toContain("expected 116 after migrations 1-64");
    expect(setup).not.toContain("expected 115 after migrations 1-62");
  });
});
