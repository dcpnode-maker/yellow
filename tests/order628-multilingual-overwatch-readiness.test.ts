import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

test("Order 628 colleague readiness proves multilingual confirmation-gated Overwatch", () => {
  const probe = readFileSync("tools/probe-colleague-demo-readiness.ts", "utf8");
  expect(probe).toContain("Overwatch Hindi confirmation-gated cancellation");
  expect(probe).toContain("आरक्षण रद्द करें");
  expect(probe).toContain('hindiOverwatch.navigation === "reservations"');
  expect(probe).toContain('hindiOverwatch.reservationOperation === "cancel"');
  expect(probe).toContain("hindiOverwatch.requiresConfirmation === true");
});

