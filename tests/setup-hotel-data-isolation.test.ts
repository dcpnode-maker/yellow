import { describe, expect, test } from "bun:test";

describe("setup hotel-data isolation", () => {
  test("the standing database gate never seeds retained yellow_dev and removes its fixture database", async () => {
    const source = await Bun.file(new URL("../setup.sh", import.meta.url)).text();

    expect(source).not.toContain('YELLOW_DEPLOY_DATABASE_URL="$dev_url" bun scripts/seed.ts');
    expect(source).toContain("python3 tests/run_invariants.py yellow_test");

    const referee = source.indexOf("python3 tests/run_invariants.py yellow_test");
    const cleanup = source.indexOf("DROP DATABASE IF EXISTS yellow_test WITH (FORCE)", referee);
    expect(referee).toBeGreaterThan(-1);
    expect(cleanup).toBeGreaterThan(referee);
    expect(source).toContain("Removed disposable yellow_test proof database.");
  });
});
