import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

test("Order 218 intentional red: vehicle linked-reservation navigation is absent before implementation", () => {
  const script = readFileSync(new URL("../src/http/operator/operator.js", import.meta.url), "utf8");
  const css = readFileSync(new URL("../src/http/operator/operator.css", import.meta.url), "utf8");

  expect(script).not.toContain("function openVehicleLinkedReservation(");
  expect(script).not.toContain('"Open linked reservation"');
  expect(css).not.toContain(".vehicle-linked-reservation-action");
});

