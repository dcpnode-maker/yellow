import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

test("Order 217 intentional red: exact housekeeping-task detail is absent before implementation", () => {
  const service = readFileSync(new URL("../src/contexts/housekeeping/tasks.ts", import.meta.url), "utf8");
  const app = readFileSync(new URL("../src/app.ts", import.meta.url), "utf8");
  const operator = readFileSync(new URL("../src/http/operator/operator.js", import.meta.url), "utf8");

  expect(service).not.toContain("async get(input: HousekeepingTaskDetailInput)");
  expect(app).not.toContain('.get("/api/v1/properties/:property/housekeeping/tasks/:task"');
  expect(app).not.toContain('.get("/p/:property/housekeeping/tasks/:task"');
  expect(operator).not.toContain("function openHousekeepingTaskDetail(");
  expect(operator).not.toContain("function canonicalHousekeepingTaskDetailPath(");
});
