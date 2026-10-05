import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

test("Order 218 intentional red is green after vehicle linked-reservation navigation implementation", () => {
  const script = readFileSync(new URL("../src/http/operator/operator.js", import.meta.url), "utf8");
  const css = readFileSync(new URL("../src/http/operator/operator.css", import.meta.url), "utf8");

  expect(script).toContain("function openVehicleLinkedReservation(");
  expect(script).toContain('"Open linked reservation"');
  expect(css).toContain(".vehicle-linked-reservation-action");
});
