import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";

describe("Order 386 owner-trust workbench intentional red", () => {
  test("requires the database-owned preparation capability and facade", async () => {
    expect(existsSync(join(import.meta.dir, "..", "migrations", "0068_prepare_owner_trust_expense.sql"))).toBeTrue();
    expect(existsSync(join(import.meta.dir, "..", "src", "contexts", "financials", "trust-workbench.ts"))).toBeTrue();
  });
});
