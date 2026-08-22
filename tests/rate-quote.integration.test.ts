import { describe, expect, test } from "bun:test";

import {
  RateQuoteService,
  RateRecommendationRegistry,
} from "../src/contexts/rates";

describe("Order 070 universal stay quote resolver", () => {
  test("P0: universal quote and governed recommendation surfaces exist", () => {
    expect(RateQuoteService).toBeDefined();
    expect(RateRecommendationRegistry).toBeDefined();
  });
});
