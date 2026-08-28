import { expect, test } from "bun:test";

test("Order 215 intentional red: reservation-scoped pickup task detail is absent", async () => {
  const detail = await Bun.file("src/contexts/reservations/detail.ts").text();
  const app = await Bun.file("src/app.ts").text();
  const script = await Bun.file("src/http/operator/operator.js").text();
  const css = await Bun.file("src/http/operator/operator.css").text();

  expect(detail.includes("ReservationPickupTaskDetail")).toBeTrue();
  expect(app.includes("/arrival-pickup-task/:task")).toBeTrue();
  expect(script.includes("Open pickup task")).toBeTrue();
  expect(script.includes("pickup-task-detail-panel")).toBeTrue();
  expect(script.includes("reservationPickupTaskRoute")).toBeTrue();
  expect(css.includes(".pickup-task-detail-panel")).toBeTrue();
});
