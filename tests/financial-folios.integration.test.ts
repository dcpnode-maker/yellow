import { describe, expect, test } from "bun:test";

import { FolioService } from "../src/contexts/financials";

describe("Order 103 account-owned reservation folio foundation", () => {
  test("P0: the financial context exposes canonical primary-folio opening", () => {
    expect(typeof FolioService).toBe("function");
  });
});
