import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../src/http/operator/index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/http/operator/operator.css", import.meta.url), "utf8");
const script = readFileSync(new URL("../src/http/operator/operator.js", import.meta.url), "utf8");
const operator = readFileSync(new URL("../src/http/operator.ts", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/app.ts", import.meta.url), "utf8");

describe("Order 197 operator cashier workbench", () => {
  test("P4: deep-linked cashier workbench is semantic, accessible and confirmation-gated", () => {
    expect(html).toContain('data-view="cashiers"');
    expect(html).toContain('id="cashiers-view"');
    expect(html).toContain('id="cashier-open-confirm" type="checkbox"');
    expect(html).toContain('id="cashier-count-confirm" type="checkbox"');
    expect(html).toContain('id="cashier-close-confirm" type="checkbox"');
    expect(html).toContain('id="cashier-error" hidden role="alert"');
    expect(html).toContain('aria-live="assertive"');
    expect(app).toContain('"/p/:property/cashiers"');
  });

  test("P4: routes are no-store, property-scoped and server-authoritative", () => {
    expect(app).toContain('"/api/v1/properties/:property/cashier-sessions"');
    expect(app).toContain('cashier-sessions/:sessionId/counts');
    expect(app).toContain('cashier-sessions/:sessionId/approvals');
    expect(app).toContain('approvals/:approvalId/approve');
    expect(app).toContain('approvals/:approvalId/reject');
    expect(app).toContain('supervised-close');
    expect(app).toContain('cashier-sessions/:sessionId/close');
    expect(operator).toContain('const CASHIER_READ_SCOPE = "financials.cashiers:read"');
    expect(operator).toContain('const CASHIER_OPERATE_SCOPE = "financials.cashiers:operate"');
    expect(operator).toContain('const CASHIER_SUPERVISE_SCOPE = "financials.cashiers:supervise"');
    expect(operator).toContain('supervised = hasScope(context, CASHIER_SUPERVISE_SCOPE)');
    expect(operator).toContain('"cache-control": "no-store"');
  });

  test("P4: blind count sends denomination quantities only, retains retry keys and refetches", () => {
    const start = script.indexOf("  async function submitCashierCount()");
    const end = script.indexOf("  async function requestCashierApproval", start);
    expect(start).toBeGreaterThanOrEqual(0);
    const count = script.slice(start, end);
    expect(count).toContain("cashierCountAttemptKey = crypto.randomUUID()");
    expect(count).toContain('"idempotency-key": cashierCountAttemptKey');
    expect(count).toContain("await loadCashierSession({ focus: true })");
    expect(count).not.toMatch(/expectedMinor|countedMinor|overShortMinor|Number\s*\(|parseInt\s*\(|parseFloat\s*\(|Math\./);
    expect(count).toContain("Retry keeps the same idempotency key.");
    expect(script).toContain("supervised-approvals");
    expect(script).toContain('decideCashierApproval("approve")');
    expect(script).toContain('decideCashierApproval("reject")');
  });

  test("P4: all approved appearance systems compose the cashier workbench", () => {
    for (const appearance of ["apple", "win95", "android", "glass", "neo", "erp"]) {
      expect(css).toContain(`:root[data-theme="${appearance}"] .cashier-workbench-head`);
    }
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("min-height: 44px");
  });
});
