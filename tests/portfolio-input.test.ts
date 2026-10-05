import { expect, test } from "bun:test";
import { parsePortfolioQuery, PortfolioReadService, PortfolioValidationError } from "../src/contexts/identity";
import type { Tx } from "../src/kernel";

test("portfolio query defaults and explicit keyset positions", () => {
  expect(parsePortfolioQuery(new URLSearchParams())).toEqual({ limit: 50 });
  const id = "71900000-0000-4000-8000-000000000001";
  expect(parsePortfolioQuery(new URLSearchParams({ scopeNode: id, after: id, limit: "100" })))
    .toEqual({ scopeNode: id, after: id, limit: 100 });
});

test("portfolio rejects ambiguous, injected and noncanonical query input", () => {
  for (const query of ["limit=0", "limit=101", "limit=01", "limit=1.0", "limit=+1", "limit=",
    "limit=50&limit=50", "scopeNode=", "after=", "after=bad", "scopeNode=bad", "tenantId=x",
    "demoRestricted=1", "scopeNode=71900000-0000-4000-8000-000000000001&scopeNode=71900000-0000-4000-8000-000000000001"])
    expect(() => parsePortfolioQuery(new URLSearchParams(query))).toThrow(PortfolioValidationError);
});

test("direct portfolio boundary rejects invalid identity/page inputs without SQL", async () => {
  const id = "71900000-0000-4000-8000-000000000001";
  let calls = 0;
  const tx = Object.assign(() => { calls++; throw new Error("Unexpected SQL"); }, {
    unsafe: () => { calls++; throw new Error("Unexpected SQL"); },
  }) as unknown as Tx;
  for (const change of [{ tenantId: "bad" }, { actorId: "bad" }, { scopeNode: "" }, { after: "bad" },
    { limit: 0 }, { limit: 101 }, { limit: 1.5 }]) {
    await expect(new PortfolioReadService().read(tx, { tenantId: id, actorId: id, limit: 50, ...change }))
      .rejects.toBeInstanceOf(PortfolioValidationError);
  }
  expect(calls).toBe(0);
});
