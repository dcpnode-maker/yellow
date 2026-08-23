import { expect, test } from "bun:test";

import {
  ReservationSegmentService,
  ReservationLifecycleConflictError,
} from "../src/contexts/reservations";

test("Order 086 P0: reservation segment change surface is present", () => {
  expect(typeof ReservationSegmentService).toBe("function");
  expect(ReservationLifecycleConflictError.prototype).toBeInstanceOf(Error);
});
