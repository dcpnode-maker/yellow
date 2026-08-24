import { describe, expect, test } from "bun:test";

import { FolioStatementService } from "../src/contexts/financials";

describe("Order 105 folio statement snapshot", () => {
  test("P0: the financial context exposes the absent statement service", () => {
    expect(typeof FolioStatementService).toBe("function");
  });
});
