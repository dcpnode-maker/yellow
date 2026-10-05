import { describe, expect, test } from "bun:test";
import { join } from "node:path";

describe("Order 371 current setup catalogue oracle", () => {
  test("full-project migration acceptance stays current99 without relabeling the historical86/87/88/89 boundaries", async () => {
    const source = await Bun.file(new URL("migrate.integration.test.ts", import.meta.url)).text();
    const testBlock = (name: string): string => {
      const start = source.indexOf(`  test(\n    "${name}"`);
      expect(start).toBeGreaterThanOrEqual(0);
      const end = source.indexOf("\n  test(", start + name.length);
      return source.slice(start, end < 0 ? undefined : end);
    };

    expect(testBlock("applies the exact app_role internalization migration without schema changes"))
      .toContain("expect(tableCount).toEqual([{ count: 130 }])");
    for (const [name, shape] of [
      ["applies the exact governed cashier-session migration", "tables: 130, policies: 120, functions: 3"],
      ["applies the exact governed receivable-transfer migration", "tables: 130, policies: 120, functions: 1, approvalColumns: 1"],
      ["applies the exact governed housekeeping-task transition migration", "tables: 130, policies: 120, functions: 1"],
    ] as const) {
      expect(testBlock(name)).toContain(shape);
    }
    expect(testBlock("applies the exact positive-tax semantic-route migration with SELECT-only app authority"))
      .toContain("tables: 130,\n          policies: 120,");
    const fullUpgrade = testBlock(
      "stages historical lineage then applies correction, repair and all India fiscal evidence exactly once",
    );
    for (const current of [
      '"0087_india_native_fiscal_credit_note.sql"',
      '"0088_native_credit_fiscal_submission.sql"',
      '"0089_native_credit_delivery_discovery.sql"',
      '"0090_india_native_fiscal_series_configuration.sql"',
      '"0091_reservation_alert_authority.sql"',
      "expect(upgradedLedger).toHaveLength(99)",
      "expect(noOp.discoveredFiles).toBe(99)",
      "tables: 130, rlsTables: 120, policies: 120, forceRlsTables: 29",
    ]) expect(fullUpgrade).toContain(current);
    expect(testBlock("applies exact posting integrity, read-only routes, and authority-safe day sealing"))
      .toContain("expect(tableCount).toEqual([{ count: 130 }])");

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
    const currentStart = source.indexOf('describe("Order447 canonical migration 87 to 88 boundary"');
    expect(currentStart).toBeGreaterThan(historicalEnd);
    const historical87 = source.slice(historicalEnd, currentStart);
    expect(historical87).toContain("expect(finalLedger).toHaveLength(87)");
    expect(historical87).toContain("discoveredFiles: 87");
    expect(historical87).toContain("expect(fresh.appliedFiles).toHaveLength(87)");
    const current89 = source.indexOf('describe("Order452 canonical migration 88 to 89 boundary"');
    expect(current89).toBeGreaterThan(currentStart);
    const historical88 = source.slice(currentStart, current89);
    expect(historical88).toContain("expect(finalLedger).toHaveLength(88)");
    expect(historical88).toContain("discoveredFiles: 88");
    expect(historical88).toContain("expect(fresh.appliedFiles).toHaveLength(88)");
  });

  test("other full-current acceptance suites retain the exact current99 catalogue", async () => {
    const financial = await Bun.file(new URL("financial-postings.integration.test.ts", import.meta.url)).text();
    const applicability = await Bun.file(new URL("india-gst-accommodation-quoted-rate-applicability-recording.integration.test.ts", import.meta.url)).text();
    expect({
      financial130: financial.includes("table_type='BASE TABLE'`)[0]!.n).toBe(130)"),
      applicabilityTitle99: applicability.includes("fresh catalogue is exactly 99/130/120/120/29/2"),
      applicabilityShape99: applicability.includes("migrations:99, tables:130, rls:120, policies:120, forced:29, views:2"),
    }).toEqual({ financial130: true, applicabilityTitle99: true, applicabilityShape99: true });
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
      migrationCount: 99,
      highestMigration: 99,
      publicBaseTables: 130,
    });
    expect(setup).toContain("[ \"$tables\" = '130' ]");
    for (const entrypoint of [setup, nativeSetup]) {
      expect(entrypoint).toContain("expected 130 after migrations 1-99");
      expect(entrypoint).toContain("yellow_test tables: 130 after migrations 1-99");
    }
    expect(setup).not.toContain("expected 116 after migrations 1-64");
    expect(setup).not.toContain("expected 115 after migrations 1-62");
  });
});
