import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");
const PERMISSION = "financials.business-days:read";

describe("Order 385 intentional red: business-day read authority prerequisite", () => {
  test("the forward permission migration exists and is catalogue-only", async () => {
    const sql = await readFile(
      join(ROOT, "migrations", "0066_business_day_read_permission.sql"),
      "utf8",
    );

    expect(sql).toContain(PERMISSION);
    expect(sql).not.toMatch(/\b(?:role_permission|GRANT|CREATE\s+ROLE)\b/i);
  });

  test("the ordinary review role requests the exact permission", async () => {
    const seed = await readFile(join(ROOT, "scripts", "seed-review.ts"), "utf8");
    const reviewPermissions = seed.slice(
      seed.indexOf("export const REVIEW_PERMISSIONS"),
      seed.indexOf("const REVIEW_USER_NAME"),
    );

    expect(reviewPermissions).toContain(PERMISSION);
  });
});
