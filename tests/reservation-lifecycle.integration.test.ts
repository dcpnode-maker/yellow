import { expect, test } from "bun:test";

import {
  ReservationApprovalRequiredError,
  ReservationLifecycleService,
} from "../src/contexts/reservations";

test("Order 085 P0: reservation lifecycle public surface is present", () => {
  expect(typeof ReservationLifecycleService).toBe("function");
  expect(ReservationApprovalRequiredError.prototype).toBeInstanceOf(Error);
});

