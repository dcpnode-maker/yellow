import { describe, expect, test } from "bun:test";
import { join } from "node:path";

describe("Order 371 current setup catalogue oracle", () => {
  test("derives the migration and public-table frontier before checking setup", async () => {
    const migrationGlob = new Bun.Glob("*.sql");
    const migrations = [...migrationGlob.scanSync({ cwd: join(import.meta.dir, "..", "migrations") })].sort();
    const expectedSchema = await Bun.file(new URL("schema/expected.sql", import.meta.url)).text();
    const setup = await Bun.file(new URL("../setup.sh", import.meta.url)).text();

    const lastMigration = migrations.at(-1);
    const highestMigration = Number(lastMigration?.slice(0, 4));
    const publicBaseTables = expectedSchema.match(/^CREATE TABLE public\./gm)?.length ?? 0;

    expect({ migrationCount: migrations.length, highestMigration, publicBaseTables }).toEqual({
      migrationCount: 63,
      highestMigration: 63,
      publicBaseTables: 116,
    });
    expect(setup).toContain("[ \"$tables\" = '116' ]");
    expect(setup).toContain("expected 116 after migrations 1-63");
    expect(setup).toContain("yellow_test tables: 116 after migrations 1-63");
    expect(setup).not.toContain("expected 115 after migrations 1-62");
  });
});
