import { expect, test } from "bun:test";

test("Order 206 intentional red: arrival travel is absent from board and operator summaries", async () => {
  const board = await Bun.file("src/contexts/reservations/board.ts").text();
  const operator = await Bun.file("src/http/operator.ts").text();
  const script = await Bun.file("src/http/operator/operator.js").text();

  expect(board).toContain("readonly arrivalTravel: ReservationBoardArrivalTravel | null");
  expect(board).toContain("direction = 'arrival'");
  expect(operator).toContain("arrivalTravel: reservation.arrivalTravel");
  expect(script).toContain("reservationArrivalTravelSummary");
  expect(script).toContain("pickup requested");
});
