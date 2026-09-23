import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

test("public review starts with the complete operational scenario and retains the commercial fixture fallback", () => {
  const script = readFileSync(new URL("../src/http/operator/operator.js", import.meta.url), "utf8");
  expect(script).toContain('name === "Yellow Demo Property"');
  expect(script).toContain('name === "Riverstone Test Hotel"');
  expect(script).toContain("const operationalDemo");
  expect(script).toContain("propertySelect.value = operationalDemo.id");
});
