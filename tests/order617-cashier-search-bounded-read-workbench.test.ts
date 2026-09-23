import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const finance = readFileSync("frontend/yellow/src/workspaces/FinanceWorkspace.tsx", "utf8");
const css = readFileSync("frontend/yellow/src/styles.css", "utf8");

test("cashier search renders a bounded page instead of the full reservation board", () => {
  expect(finance).toContain("const CASHIER_STAY_PAGE_SIZE = 12;");
  expect(finance).toContain("const pagedMatchingStays = matchingStays.slice");
  expect(finance).toContain("pagedMatchingStays.map((stay)");
  expect(finance).not.toContain("{matchingStays.map((stay)");
});

test("cashier search uses opaque stable cursor tokens for page navigation", () => {
  expect(finance).toContain("function cashierCursorFor(page: number): string");
  expect(finance).toContain("function cashierPageFromCursor(cursor: string | null): number");
  expect(finance).toContain("setCashierResultCursor(cashierCursorFor(cashierResultPage + 1))");
  expect(finance).toContain('aria-label="Cashier search result pagination"');
});

test("cashier results show canonical evidence fields without changing write gates", () => {
  for (const expected of [
    "cashierSearchEvidence(stay)",
    "Confirmation",
    "Room",
    "Source",
    "Market",
    "disabled={!canPost || !confirmed || posting || depositLocked}",
    "I confirm the selected class, amount and folio window. Post this immutable charge.",
  ]) {
    expect(finance).toContain(expected);
  }
});

test("cashier search pagination and evidence are mobile-contained", () => {
  expect(css).toContain(".cashier-result-evidence");
  expect(css).toContain(".cashier-result-pagination");
  expect(css).toContain("@media (max-width: 980px)");
  expect(css).toContain(".cashier-result-evidence { grid-template-columns: 1fr; }");
});
