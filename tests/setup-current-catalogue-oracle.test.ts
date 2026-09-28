import { describe, expect, test } from "bun:test";
import { join } from "node:path";

describe("Order 371 current setup catalogue oracle", () => {
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
      migrationCount: 81,
      highestMigration: 81,
      publicBaseTables: 128,
    });
    expect(setup).toContain("[ \"$tables\" = '128' ]");
    for (const entrypoint of [setup, nativeSetup]) {
      expect(entrypoint).toContain("expected 128 after migrations 1-81");
      expect(entrypoint).toContain("yellow_test tables: 128 after migrations 1-81");
    }
    expect(setup).not.toContain("expected 116 after migrations 1-64");
    expect(setup).not.toContain("expected 115 after migrations 1-62");
  });
});
