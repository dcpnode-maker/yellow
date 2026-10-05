import { expect, test } from "bun:test";

test("Order 209 intentional red: contextual Today preparation routing is absent", async () => {
  const script = await Bun.file("src/http/operator/operator.js").text();

  expect(script).toContain("function todayOperationalAction(");
  expect(script).toContain("Prepare check-in");
  expect(script).toContain("Prepare checkout");
  expect(script).toContain("workbench=check-in");
  expect(script).toContain("workbench=checkout");
  expect(script).toContain("function reservationWorkbenchIntent(");
  expect(script).toContain("currentReservationWorkbench");
  expect(script).toContain("applyReservationWorkbenchIntent");
});
