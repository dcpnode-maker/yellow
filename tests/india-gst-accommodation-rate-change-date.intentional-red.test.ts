import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");
const MODULE = join(
  ROOT,
  "src",
  "contexts",
  "tax-fiscal",
  "india-gst-accommodation-rate-change-date.ts",
);

test("Order 307 intentional red: source-bound accommodation rate-change date evidence exists", () => {
  expect(existsSync(MODULE)).toBe(true);
  const source = readFileSync(MODULE, "utf8");
  expect(source).toContain("deriveIndiaGstAccommodationRateChangeDate");
  expect(source).toContain("2025-09-22");
  expect(source).toContain("evidenceHash");
});
