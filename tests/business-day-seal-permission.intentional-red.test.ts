import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");
const PERMISSION = "business_day.seal";
const DESCRIPTION = "Seal business day";
const EDGE_PERMISSION = "financials.business-days:seal";
const EDGE_DESCRIPTION = "Seal governed property business days";

describe("Order 388 intentional red: business-day seal authority prerequisite", () => {
  test("the forward permission migration exists and is catalogue-only", async () => {
    const sql = await readFile(
      join(ROOT, "migrations", "0067_business_day_seal_permission.sql"),
      "utf8",
    );

    expect(sql).toContain(PERMISSION);
    expect(sql).toContain(DESCRIPTION);
    expect(sql).toContain(EDGE_PERMISSION);
    expect(sql).toContain(EDGE_DESCRIPTION);
    expect(sql).not.toMatch(/\b(?:role_permission|GRANT|CREATE\s+ROLE)\b/i);
  });

  test("the ordinary review role requests the exact permission", async () => {
    const seed = await readFile(join(ROOT, "scripts", "seed-review.ts"), "utf8");
    const reviewPermissions = seed.slice(
      seed.indexOf("export const REVIEW_PERMISSIONS"),
      seed.indexOf("const REVIEW_USER_NAME"),
    );

    expect(reviewPermissions.match(/REVIEW_BUSINESS_DAY_SEAL_PERMISSION,/g)).toHaveLength(1);
    expect(reviewPermissions.match(/REVIEW_BUSINESS_DAY_SEAL_EDGE_PERMISSION/g)).toHaveLength(1);

    const approverCopy = seed.slice(
      seed.indexOf("for (const permission of REVIEW_PERMISSIONS)", seed.indexOf("const approverRoles")),
      seed.indexOf("const users = Object.freeze", seed.indexOf("const approverRoles")),
    );
    expect(approverCopy).toContain("REVIEW_DISCREPANCY_CARRY_PERMISSION.code");
    expect(approverCopy).toContain("REVIEW_BUSINESS_DAY_SEAL_PERMISSION.code");
    expect(approverCopy).toContain("REVIEW_BUSINESS_DAY_SEAL_EDGE_PERMISSION.code");
  });

  test("the fixture defers catalogue ownership but retains the Night Auditor grant", async () => {
    const fixture = await readFile(join(ROOT, "tests", "seed_fixture.sql"), "utf8");
    const permissionCatalogue = fixture.slice(
      fixture.indexOf("INSERT INTO permission"),
      fixture.indexOf("INSERT INTO role ("),
    );
    const roleGrants = fixture.slice(fixture.indexOf("INSERT INTO role_permission"));

    expect(permissionCatalogue).not.toContain(PERMISSION);
    expect(roleGrants.match(/'business_day\.seal'/g)).toHaveLength(1);
    expect(roleGrants).toContain("'00000000-0000-0000-0000-000000000951', 'business_day.seal'");
  });
});
