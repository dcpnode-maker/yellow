import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

test("Order 221 intentional red requires the generated-task receipt journey", () => {
  const script = readFileSync(new URL("../src/http/operator/operator.js", import.meta.url), "utf8");
  const css = readFileSync(new URL("../src/http/operator/operator.css", import.meta.url), "utf8");

  expect(script).toContain("function parseHousekeepingGenerationReceipt(");
  expect(script).toContain("function openGeneratedHousekeepingTaskDetail(");
  expect(css).toContain(".housekeeping-sheet-task-receipt");
});
