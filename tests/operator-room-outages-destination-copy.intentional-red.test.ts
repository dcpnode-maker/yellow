import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../src/http/operator/index.html", import.meta.url), "utf8");
const script = readFileSync(new URL("../src/http/operator/operator.js", import.meta.url), "utf8");

function element(id: string): string {
  const match = html.match(new RegExp(`<([a-z][a-z0-9-]*)[^>]+id="${id}"[^>]*>[\\s\\S]*?<\\/\\1>`));
  if (!match) throw new Error(`Missing element ${id}`);
  return match[0];
}

function functionSource(name: string): string {
  const start = script.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`Missing function ${name}`);
  const opening = script.indexOf(") {", start) + 2;
  let depth = 0;
  for (let index = opening; index < script.length; index += 1) {
    if (script[index] === "{") depth += 1;
    if (script[index] === "}") depth -= 1;
    if (depth === 0) return script.slice(start, index + 1);
  }
  throw new Error(`Unclosed function ${name}`);
}

function operationsSection(): string {
  const start = html.indexOf('<section id="operations-view"');
  if (start < 0) throw new Error("Missing operations view");
  const end = html.indexOf('\n<section id="restrictions-view"', start);
  if (end < 0) throw new Error("Unclosed operations view");
  return html.slice(start, end);
}

test("Order 334 intentional red: the operations destination workbench title says Room outages", () => {
  const setView = functionSource("setView");

  expect(setView).toContain('activeView === "operations" ? "Room outages"');
  expect(setView).not.toContain('activeView === "operations" ? "Operations"');
});

test("Order 334 intentional red: the initial destination status says Open Room outages", () => {
  expect(element("operational-block-status")).toBe(
    '<p class="inventory-status" id="operational-block-status" role="status" aria-live="polite">Open Room outages to load active causes.</p>',
  );
});

test("Order 334 intentional red: operations identity, routing, requests and OOO/OOS controls do not drift", () => {
  const navigation = element("nav-operations");
  const operations = operationsSection();
  const setView = functionSource("setView");
  const loadOperationalBlocks = functionSource("loadOperationalBlocks");

  expect(navigation).toContain('id="nav-operations"');
  expect(navigation).toContain('data-view="operations"');
  expect(navigation).toContain('aria-controls="operations-view"');
  expect(navigation).toContain("<span>Room outages</span>");
  expect(html.match(/id="nav-operations"/g)).toHaveLength(1);
  expect(html.match(/id="operations-view"/g)).toHaveLength(1);
  expect(operations).toContain('aria-labelledby="operations-title"');
  expect(operations).toContain('<h2 id="operations-title">Out of order and out of service</h2>');
  expect(operations).toContain('id="refresh-operational-blocks"');
  expect(operations).toContain('id="oos-policy-form"');
  expect(operations).toContain('<option value="blocked">Blocked from sale</option>');
  expect(operations).toContain('<option value="allowed">Allowed with warning</option>');
  expect(operations).toContain('id="operational-block-form"');
  expect(operations).toContain('<option value="ooo">Out of order · physically unavailable</option>');
  expect(operations).toContain('<option value="oos">Out of service · commercially unavailable</option>');
  expect(operations).toContain("This view does not create maintenance tasks or change OOS policy.");

  expect(script).toContain('location.pathname.endsWith("/operations") ? "operations"');
  expect(script).toContain('history.pushState(null, "", `/p/${propertySelect.value}/${activeView}`)');
  expect(setView).toContain('operationsView.hidden = activeView !== "operations"');
  expect(setView.match(/activeView === "operations"/g)).toHaveLength(2);
  expect(setView).toContain('if (activeView === "operations") void loadOperationalBlocks()');
  expect(loadOperationalBlocks).toContain('request(`/api/v1/properties/${enc(property)}/operational-blocks`)');
  expect(script).toContain('request(`/api/v1/properties/${enc(propertySelect.value)}/operational-blocks`, {');
  expect(script).toContain('request(`/api/v1/properties/${enc(propertySelect.value)}/operational-blocks/${enc(block.id)}/close`, {');
});
