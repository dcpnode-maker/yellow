import { expect, test } from "bun:test";

import { ReservationGuestService } from "../src/contexts/reservations";

test("Order 087 precondition: reservation guest service exists", () => {
  expect(typeof ReservationGuestService).toBe("function");
});
