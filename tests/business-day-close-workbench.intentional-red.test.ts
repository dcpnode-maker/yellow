import { describe, expect, test } from "bun:test";
import { BusinessDayCloseWorkbenchService } from "../src/contexts/financials";

describe("Order 384 intentional red", () => {
  test("requires the authoritative close workbench service", () => {
    expect(BusinessDayCloseWorkbenchService).toBeDefined();
  });
});
