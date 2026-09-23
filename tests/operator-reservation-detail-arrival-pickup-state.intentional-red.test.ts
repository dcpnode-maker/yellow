import { expect, test } from "bun:test";

test("Order 214 intentional red: canonical arrival pickup state is absent", async () => {
  const script = await Bun.file("src/http/operator/operator.js").text();
  const css = await Bun.file("src/http/operator/operator.css").text();

  expect(script).toContain("reservationPickupAutomationState");
  expect(script).toContain("reservation-pickup-state");
  expect(script).toContain("Pickup not requested");
  expect(script).toContain("Pickup requested · schedule required");
  expect(script).toContain("Pickup requested · task pending");
  expect(script).toContain("Pickup task linked");
  expect(css).toContain(".reservation-pickup-state");
});
