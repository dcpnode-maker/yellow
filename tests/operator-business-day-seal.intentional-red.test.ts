import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

test("Order 389 intentional red: audited business-day seal operator edge exists", () => {
  const operator = readFileSync(new URL("../src/http/operator.ts", import.meta.url), "utf8");
  const app = readFileSync(new URL("../src/app.ts", import.meta.url), "utf8");
  const server = readFileSync(new URL("../src/server.ts", import.meta.url), "utf8");
  expect(operator).toContain("sealBusinessDay");
  expect(app).toContain('business-days/:businessDate/seal"');
  expect(app).toContain('{ parse: "none" }');
  expect(server).toContain("new BusinessDaySealService");
});
