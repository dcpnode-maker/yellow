import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../src/http/operator/index.html", import.meta.url), "utf8");
const script = readFileSync(new URL("../src/http/operator/operator.js", import.meta.url), "utf8");

test("D1131 regression: ordinary undated navigation discovers persisted truth before the dated workbench", () => {
  expect(html).toContain('id="day-close-view"');
  expect(script).toContain("close-workbench");
  expect(script).toContain("dayCloseRequestGeneration");
  const loader = script.slice(script.indexOf("async function loadDayCloseWorkbench"), script.indexOf("function setView", script.indexOf("async function loadDayCloseWorkbench")));
  const discovery = 'request(`/api/v1/properties/${enc(property)}/business-days/close-workbench`)';
  const dated = 'request(`/api/v1/properties/${enc(property)}/business-days/${enc(selected)}/close-workbench`)';
  expect(loader).toContain("let selected = businessDate;");
  expect(loader).toContain("if (!selected)");
  expect(loader.indexOf(discovery)).toBeGreaterThan(loader.indexOf("if (!selected)"));
  expect(loader.indexOf(discovery)).toBeLessThan(loader.indexOf(dated));
  expect(loader).toContain('activeView !== "day-close"');
  expect(script).not.toMatch(/day-close[^\n]*(?:seal|carry)[^\n]*(?:button|submit)/i);
});
