import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

test("Order 630 colleague readiness proves guest profile stay history", () => {
  const probe = readFileSync("tools/probe-colleague-demo-readiness.ts", "utf8");
  expect(probe).toContain("guest profile stay history");
  expect(probe).toContain("Sara Al Harbi");
  expect(probe).toContain("/parties:search");
  expect(probe).toContain("reservation-board?");
  expect(probe).toContain("primaryGuestDisplayName");
  expect(probe).toContain("guestHistoryReady");
});
