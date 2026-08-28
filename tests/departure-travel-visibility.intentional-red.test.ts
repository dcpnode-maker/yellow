import { expect, test } from "bun:test";

test("Order 207 intentional red: departure travel is absent from board and operator summaries", async () => {
  const board = await Bun.file("src/contexts/reservations/board.ts").text();
  const operator = await Bun.file("src/http/operator.ts").text();
  const script = await Bun.file("src/http/operator/operator.js").text();

  expect(board).toContain("readonly departureTravel: ReservationBoardDepartureTravel | null");
  expect(board).toContain("direction = 'departure'");
  expect(operator).toContain("departureTravel: reservation.departureTravel");
  expect(script).toContain("reservationDepartureTravelSummary");
  expect(script).toContain("Departure");
});

