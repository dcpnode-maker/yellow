import { describe, expect, test } from "bun:test";

describe("Order 227 intentional red: governed initial room condition", () => {
  test("the owner-mediated insert-once capability exists", async () => {
    const migration = Bun.file(new URL(
      "../migrations/0030_governed_unit_condition_initialization.sql",
      import.meta.url,
    ));

    expect(await migration.exists()).toBe(true);
    expect(await migration.text()).toContain("CREATE FUNCTION public.initialize_unit_condition(");
  });

  test("the housekeeping domain exposes only the bounded initialization surface", async () => {
    const domain = await Bun.file(new URL("../src/contexts/housekeeping/tasks.ts", import.meta.url)).text();
    const exports = await Bun.file(new URL("../src/contexts/housekeeping/index.ts", import.meta.url)).text();

    expect(domain).toContain("HOUSEKEEPING_INITIAL_CONDITIONS");
    expect(domain).toContain("async initializeCondition(");
    expect(domain).toContain("public.initialize_unit_condition(");
    expect(exports).toContain("HousekeepingConditionInitializationInput");
    expect(exports).toContain("HousekeepingConditionInitializationResult");
  });
});
