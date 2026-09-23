import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);

test("Order 203 intentional red: governed departure readiness is absent before implementation", () => {
  const service = new URL("src/contexts/stay-operations/checkout-readiness.ts", root);
  const app = readFileSync(new URL("src/app.ts", root), "utf8");
  const operator = readFileSync(new URL("src/http/operator.ts", root), "utf8");
  const html = readFileSync(new URL("src/http/operator/index.html", root), "utf8");
  const script = readFileSync(new URL("src/http/operator/operator.js", root), "utf8");

  expect(existsSync(service)).toBe(true);
  expect(operator).toContain("stay-operations.checkout:read");
  expect(app).toContain("checkout-readiness");
  expect(html).toContain('id="reservation-departure-workbench"');
  expect(script).toContain("loadCheckoutReadiness");
});
