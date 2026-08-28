import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

test("Order 219 intentional red: reservation-detail operational preparation is absent before implementation", () => {
  const script = readFileSync(new URL("../src/http/operator/operator.js", import.meta.url), "utf8");
  const css = readFileSync(new URL("../src/http/operator/operator.css", import.meta.url), "utf8");

  expect(script).not.toContain("function reservationOperationalPreparation(");
  expect(script).not.toContain('"Prepare check-in"');
  expect(script).not.toContain('"Prepare checkout"');
  expect(css).not.toContain(".reservation-operational-preparation-action");
});

