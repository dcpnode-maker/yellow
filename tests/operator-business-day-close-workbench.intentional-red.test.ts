import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../src/http/operator/index.html", import.meta.url), "utf8");
const script = readFileSync(new URL("../src/http/operator/operator.js", import.meta.url), "utf8");

test("Order384 intentional red: operator exposes one read-only deep-linked close workbench", () => {
  expect(html).toContain('id="day-close-view"');
  expect(script).toContain("close-workbench");
  expect(script).toContain("dayCloseRequestGeneration");
  expect(script).not.toMatch(/day-close[^\n]*(?:seal|carry)[^\n]*(?:button|submit)/i);
});
