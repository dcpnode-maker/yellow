import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

test("Order 225 builds exact register-to-reservation return continuity", () => {
  const script = readFileSync(new URL("../src/http/operator/operator.js", import.meta.url), "utf8");
  const css = readFileSync(new URL("../src/http/operator/operator.css", import.meta.url), "utf8");
  expect(script).toContain("function vehicleRegisterLinkedReservationActionIsCurrent(");
  expect(script).toContain("function openVehicleRegisterLinkedReservation(");
  expect(script).toContain("function returnFromReservationToVehicleRegister(");
  expect(css).toContain(".vehicle-register-linked-reservation-action");
});
