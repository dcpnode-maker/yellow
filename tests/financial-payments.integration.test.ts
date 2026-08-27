import { describe, expect, test } from "bun:test";

import {
  LocalPaymentProvider,
  PaymentService,
} from "../src/contexts/financials";

describe("Order 192 token-only payment foundation", () => {
  test("P0: the migration, provider port and payment service must exist", async () => {
    expect(await Bun.file("migrations/0021_token_only_payment_foundation.sql").exists()).toBeTrue();
    expect(typeof LocalPaymentProvider).toBe("function");
    expect(typeof PaymentService).toBe("function");
  });
});
