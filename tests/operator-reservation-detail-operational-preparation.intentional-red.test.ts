import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

test("Order 219 intentional red is green after reservation-detail operational preparation implementation", () => {
  const script = readFileSync(new URL("../src/http/operator/operator.js", import.meta.url), "utf8");
  const css = readFileSync(new URL("../src/http/operator/operator.css", import.meta.url), "utf8");

  expect(script).toContain("function reservationOperationalPreparation(");
  expect(script).toContain("function openReservationOperationalPreparation(");
  expect(css).toContain(".reservation-operational-preparation-action");
});
