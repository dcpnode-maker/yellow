import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

test("Order 220 intentional red is green after detail governed actions implementation", () => {
  const http = readFileSync(new URL("../src/http/operator.ts", import.meta.url), "utf8");
  const script = readFileSync(new URL("../src/http/operator/operator.js", import.meta.url), "utf8");
  const css = readFileSync(new URL("../src/http/operator/operator.css", import.meta.url), "utf8");

  expect(http).toContain("operatorHousekeepingTaskDetail(task, workGranted, inspectGranted)");
  expect(script).toContain("function submitHousekeepingTaskDetailAction(");
  expect(css).toContain(".housekeeping-task-detail-governed-action");
});
