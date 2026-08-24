import { describe, expect, test } from "bun:test";

import { PartyProfileService } from "../src/contexts/crm";

describe("Order 101 tenant-safe Party search and create", () => {
  test("P0: CRM exposes the canonical Party profile service", () => {
    expect(typeof PartyProfileService).toBe("function");
  });
});
