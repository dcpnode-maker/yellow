import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");
const SERVICE = join(
  ROOT,
  "src",
  "contexts",
  "tax-fiscal",
  "india-gst-accommodation-historical-resolution.ts",
);

test("Order 306 intentional red: governed historical lodging resolution exists", () => {
  expect(existsSync(SERVICE)).toBe(true);

  const source = readFileSync(SERVICE, "utf8");
  expect(source).toContain("IndiaGstAccommodationHistoricalResolutionService");
  expect(source).toContain("businessDate");
  expect(source).toContain("fromInstant");
  expect(source).toContain("toInstant");
  expect(source).toContain("evidenceHash");
});
