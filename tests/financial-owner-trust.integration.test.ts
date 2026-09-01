import { describe, expect, test } from "bun:test";
import { TrustAccountingService } from "../src/contexts/financials";

describe("Order 344 owner-trust guard intentional red", () => {
  test("exports the governed owner-trust command", () => {
    expect(TrustAccountingService).toBeFunction();
  });
});
