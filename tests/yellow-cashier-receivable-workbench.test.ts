import { expect, test } from "bun:test";

const app = `${await Bun.file("frontend/yellow/src/workspaces/FinanceWorkspace.tsx").text()}\n${await Bun.file("frontend/yellow/src/yellow-api.tsx").text()}`;
const shell = await Bun.file("frontend/yellow/src/App.tsx").text();
const css = await Bun.file("frontend/yellow/src/styles.css").text();

test("cashier exposes account-owned Post Master direct billing without inventing a room", () => {
  expect(app).toContain("type ReceivableTarget");
  expect(app).toContain("type ReceivablePreview");
  expect(app).toContain("loadReceivableTargets");
  expect(app).toContain("previewReceivableTransfer");
  expect(app).toContain("requestReceivableApproval");
  expect(app).toContain("submitReceivableTransfer");
  expect(app).toContain('`/api/operator/properties/${propertyId}/receivable-transfers/targets`');
  expect(app).toContain('receivable-transfers:preview`');
  expect(app).toContain('receivable-transfers/approvals`');
  expect(app).toContain('receivable-transfers`');
  expect(app).toContain("Direct billing / Post Master");
  expect(app).toContain("Company and travel-agent balances move to account-owned receivables, never to a physical room.");
  expect(app).not.toMatch(/create.*PM.*room/i);
});

test("direct billing is previewed, separately confirmed and reconciled from the authoritative folio", () => {
  expect(app).toContain("I confirm this exact balance, target and audit reason. Record the immutable direct-billing transfer.");
  expect(app).toContain("preview.requiresApproval");
  expect(app).toContain("A different authorised supervisor must approve this exact over-limit request.");
  expect(app).toContain("receivableTransferKey.current");
  expect(app).toContain('"idempotency-key": idempotencyKey');
  expect(app).toContain("const refreshed = await loadFolioStatement(folioId)");
  expect(app).toContain("BigInt(refreshed.balanceMinor) !== 0n");
  expect(app).toContain("No successful transfer will be claimed without an exact zero-balance statement containing the confirmed journal and guest credit.");
  expect(app).toContain("const freshPreview = await previewReceivableTransfer(folioId, input.receivableAccountId)");
  expect(app).toContain("sameReceivablePreview(freshPreview, confirmedPreview)");
  expect(app).toContain("The live balance or credit evidence changed. Review the refreshed exact proposal and confirm it again.");
  expect(app).toContain("const refreshedStatement = await folio.refetch()");
  expect(app).toContain("refreshedStatement.data.balanceMinor !== freshPreview.amountMinor");
  expect(app).toContain("The proposal changed, but the authoritative folio could not be refreshed to the same exact balance.");
  expect(app).toContain("const expectedGuestCreditMinor = (-BigInt(receipt.amountMinor)).toString()");
  expect(app).toContain("receiptRows.length !== 1");
  expect(app).toContain("receiptRows[0]?.amountMinor !== expectedGuestCreditMinor");
  expect(app).toContain("moneyExactMinor(receivablePreview.amountMinor, receivablePreview.currency)");
  expect(app).toContain("const amount = BigInt(minor)");
  expect(app).toContain("formatter.formatToParts");
});

test("uncertain mutations keep one immutable proposal and operation key until reconciliation", () => {
  expect(app).toContain("receivableAttemptUncertain");
  expect(app).toContain("Retry and reconcile same transfer");
  expect(app).toContain("Yellow has locked this exact folio, target, amount, reason and operation key.");
  expect(app).toContain("readOnly={receivableAttemptUncertain}");
  expect(app).toContain("disabled={receivableBusy || receivableAttemptUncertain || depositLocked}");
  expect(app).toContain('receivableUncertainOperation === "transfer" ||');
  expect(app).toContain("transferSubmitted && (transferReceiptAccepted || housekeepingFailureIsUncertain(error))");
  expect(app).toContain('receivableUncertainOperation === "approval" || approvalReceiptAccepted || housekeepingFailureIsUncertain(error)');
  expect(app).toContain("onLifecycleBusyChange?.(keepParentLocked)");
  expect(app).toContain('receivableUncertainOperation !== "transfer"');
  expect(app).toContain("Retry same approval request");
  expect(app).toContain('data-lifecycle-recovery={receivableAttemptUncertain || undefined}');
  expect(shell).toContain("event.target.closest('[data-lifecycle-recovery=\"true\"]')");
  expect(app).toContain("The latest folio refresh failed. The last authoritative statement remains visible");
});

test("async reads and transfer receipts are bound to the current confirmed proposal", () => {
  expect(app).toContain("const receivableGeneration = useRef(0)");
  expect(app).toContain("generation !== receivableGeneration.current");
  expect(app).toContain("preview.partyId !== expected.partyId");
  expect(app).toContain("preview.currency !== expected.currency");
  expect(app).toContain("preview.amountMinor !== expected.amountMinor");
  expect(app).toContain("The direct-billing receipt could not be verified.");
});

test("cashier search includes operational identifiers while remaining bounded to returned reservations", () => {
  expect(app).toContain("stay.channelCode");
  expect(app).toContain("stay.sourceCode");
  expect(app).toContain("stay.marketCode");
  expect(app).toContain("Search guest, reservation, room, source, channel or folio");
  expect(app).toContain("All returned stays");
  expect(app).toContain("In house &amp; due out");
});

test("receivable controls are mobile-safe and visibly separated from cash custody", () => {
  expect(css).toContain(".cashier-receivable");
  expect(css).toContain(".receivable-targets");
  expect(css).toContain("min-height: 44px");
  expect(css).toContain(".receivable-preview-grid");
  expect(css).toContain("@media (max-width: 760px)");
});
