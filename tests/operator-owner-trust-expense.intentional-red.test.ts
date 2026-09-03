import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

test("Order 386 intentional red: governed owner-trust expense edge is composed", () => {
  const operator = readFileSync(new URL("../src/http/operator.ts", import.meta.url), "utf8");
  const app = readFileSync(new URL("../src/app.ts", import.meta.url), "utf8");
  const server = readFileSync(new URL("../src/server.ts", import.meta.url), "utf8");
  expect(operator).toContain("OwnerTrustExpenseWorkbenchService");
  expect(operator).toContain("ownerTrustAccounts");
  expect(operator).toContain("postOwnerTrustExpense");
  expect(app).toContain("trust/accounts/:accountId/expenses");
  expect(server).toContain("new OwnerTrustExpenseWorkbenchService");
});
