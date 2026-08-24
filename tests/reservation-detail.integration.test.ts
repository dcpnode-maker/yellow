import { describe, expect, test } from "bun:test";

import {
  ReservationDetailNotFoundError,
  ReservationDetailService,
  ReservationDetailValidationError,
} from "../src/contexts/reservations";

describe("Order 141 reservation detail/history read model", () => {
  test("P0: planned public read model exists", () => {
    expect(ReservationDetailService).toBeDefined();
    expect(ReservationDetailValidationError).toBeDefined();
    expect(ReservationDetailNotFoundError).toBeDefined();
  });
});
