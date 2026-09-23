import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

test("Order 629 colleague readiness proves business-day close visibility", () => {
  const probe = readFileSync("tools/probe-colleague-demo-readiness.ts", "utf8");
  expect(probe).toContain("business-day close readiness");
  expect(probe).toContain("/business-days/close-workbench");
  expect(probe).toContain("businessDayWorkbench.readiness");
  expect(probe).toContain("readinessReasons.every");
  expect(probe).toContain("openDays.length > 0");
});

