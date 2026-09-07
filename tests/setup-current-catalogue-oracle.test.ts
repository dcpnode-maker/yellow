import { describe, expect, test } from "bun:test";
import { join } from "node:path";

describe("Order 371 current setup catalogue oracle", () => {
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
