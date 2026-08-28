import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

test("Order 220 intentional red: detail governed actions are absent before implementation", () => {
  const http = readFileSync(new URL("../src/http/operator.ts", import.meta.url), "utf8");
  const script = readFileSync(new URL("../src/http/operator/operator.js", import.meta.url), "utf8");
  const css = readFileSync(new URL("../src/http/operator/operator.css", import.meta.url), "utf8");

  expect(http).not.toContain("operatorHousekeepingTaskDetail(task, workGranted, inspectGranted)");
  expect(script).not.toContain("function submitHousekeepingTaskDetailAction(");
  expect(css).not.toContain(".housekeeping-task-detail-governed-action");
});
