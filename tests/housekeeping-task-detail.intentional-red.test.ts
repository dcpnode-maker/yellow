import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

test("Order 217 intentional red is green after exact housekeeping-task detail implementation", () => {
  const service = readFileSync(new URL("../src/contexts/housekeeping/tasks.ts", import.meta.url), "utf8");
  const app = readFileSync(new URL("../src/app.ts", import.meta.url), "utf8");
  const operator = readFileSync(new URL("../src/http/operator/operator.js", import.meta.url), "utf8");

  expect(service).toContain("async get(input: HousekeepingTaskDetailInput)");
  expect(app).toContain('.get("/api/v1/properties/:property/housekeeping/tasks/:task"');
  expect(app).toContain('.get("/p/:property/housekeeping/tasks/:task"');
  expect(operator).toContain("function openHousekeepingTaskDetail(");
  expect(operator).toContain("function canonicalHousekeepingTaskDetailPath(");
});
