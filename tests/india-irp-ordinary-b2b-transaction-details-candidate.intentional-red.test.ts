import { expect, test } from "bun:test";

const sourceRoot = new URL("../src/contexts/tax-fiscal/", import.meta.url);

test("Order423 intentional red: transaction-details composer is absent before implementation", async () => {
  const source = Bun.file(new URL("india-irp-ordinary-b2b-transaction-details-candidate.ts", sourceRoot));
  const index = Bun.file(new URL("index.ts", sourceRoot));
  expect(source.size).toBeGreaterThan(0);
  const [moduleText, indexText] = await Promise.all([source.text(), index.text()]);
  expect(moduleText).toContain("export function composeIndiaIrpOrdinaryB2bTransactionDetailsCandidate");
  expect(moduleText).toContain("eligible_irp_ordinary_b2b_transaction_details_candidate");
  expect(indexText).toContain('from "./india-irp-ordinary-b2b-transaction-details-candidate"');
});
