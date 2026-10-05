import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../src/http/operator/index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/http/operator/operator.css", import.meta.url), "utf8");
const script = readFileSync(new URL("../src/http/operator/operator.js", import.meta.url), "utf8");
const operator = readFileSync(new URL("../src/http/operator.ts", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/app.ts", import.meta.url), "utf8");

function asyncSlice(name: string, next: string): string {
  const start = script.indexOf(`  async function ${name}`);
  const end = script.indexOf(`  ${next}`, start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return script.slice(start, end);
}

describe("Order 198 operator direct-billing workbench", () => {
  test("P5: the deep-linked folio workbench is semantic, accessible and confirmation-gated", () => {
    const directBillingPanel = html.slice(
      html.indexOf('id="folio-direct-billing-panel"'),
      html.indexOf('id="folio-correction-panel"'),
    );
    expect(html).toContain('id="folio-tab-direct-billing"');
    expect(html).toContain('id="folio-direct-billing-panel" role="tabpanel"');
    expect(html).toContain('id="receivable-transfer-workbench" aria-busy="false"');
    expect(html).toContain('id="receivable-transfer-account" name="receivableAccountId" required');
    expect(html).toContain('id="receivable-transfer-reason" name="reason" required');
    expect(html).toContain('id="receivable-transfer-confirm" type="checkbox"');
    expect(html).toContain('aria-live="assertive" aria-atomic="true"');
    expect(directBillingPanel).not.toContain('name="amountMinor"');
    expect(directBillingPanel).not.toContain('name="creditLimitMinor"');
  });

  test("P5: canonical routes are no-store, property-granted and server-authoritative", () => {
    expect(app).toContain('"/api/operator/properties/:propertyNode/receivable-transfers/targets"');
    expect(app).toContain('receivable-transfers:preview');
    expect(app).toContain('receivable-transfers/approvals/:approvalId/approve');
    expect(app).toContain('receivable-transfers/approvals/:approvalId/reject');
    expect(operator).toContain('const RECEIVABLE_READ_SCOPE = "financials.receivables:read"');
    expect(operator).toContain('const RECEIVABLE_TRANSFER_SCOPE = "financials.receivables:transfer"');
    expect(operator).toContain('const RECEIVABLE_APPROVE_SCOPE = "financials.receivables:approve"');
    expect(operator).toContain('listGrantedProperties(context, RECEIVABLE_READ_SCOPE)');
    expect(operator).toContain('listGrantedProperties(context, RECEIVABLE_TRANSFER_SCOPE)');
    expect(operator).toContain('listGrantedProperties(context, RECEIVABLE_APPROVE_SCOPE)');
    expect(operator).toContain('"cache-control": "no-store"');
    expect(operator).toContain('operation: "approval.requested"');
    expect(operator).toContain('operation: "approval.decided"');
    expect(operator).toContain('operation: "journal.posted"');
  });

  test("P5: target selection, preview, approval and transfer retain retries and suppress stale state", () => {
    const targets = asyncSlice("loadReceivableTransferTargets", "function renderReceivableTransferPreview");
    const preview = asyncSlice("loadReceivableTransferPreview", "async function requestReceivableTransferApproval");
    const approval = asyncSlice("requestReceivableTransferApproval", "async function decideReceivableTransferApproval");
    const transfer = asyncSlice("submitReceivableTransfer", "function folioCell");
    expect(targets).toContain("receivable-transfers/targets");
    expect(targets).toContain('folioActiveTab !== "direct-billing"');
    expect(preview).toContain("loadReceivableTransferPreview");
    expect(preview).toContain('receivablePreviewGeneration');
    expect(preview).toContain("receivable-transfers:preview");
    expect(preview).toContain("isCurrentFolioRequest(generation, property, identity, folioId)");
    expect(approval).toContain("receivableApprovalAttemptKey = crypto.randomUUID()");
    expect(approval).toContain('headers: { "idempotency-key": receivableApprovalAttemptKey }');
    expect(transfer).toContain("receivableTransferAttemptKey = crypto.randomUUID()");
    expect(transfer).toContain('headers: { "idempotency-key": receivableTransferAttemptKey }');
    expect(transfer).toContain("/statement?limit=50");
    expect(transfer.indexOf("renderFolioStatement(refreshed)")).toBeGreaterThan(transfer.indexOf("/statement?limit=50"));
    expect(`${preview}\n${approval}\n${transfer}`).not.toMatch(/Number\s*\(|parseInt\s*\(|parseFloat\s*\(|Math\.|\.toFixed\s*\(/);
    expect(`${preview}\n${approval}\n${transfer}`).not.toMatch(/amountMinor\s*:|exposureMinor\s*:|creditLimitMinor\s*:|currency\s*:/);
    expect(`${approval}\n${transfer}`).toContain("Retry keeps the same idempotency key.");
  });

  test("P5: all approved appearance systems compose the direct-billing panel", () => {
    for (const appearance of ["apple", "win95", "android", "glass", "neo", "erp"]) {
      expect(css).toContain(`:root[data-theme="${appearance}"] .folio-receivable-form fieldset`);
    }
    expect(css).toContain("min-height: 44px");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
