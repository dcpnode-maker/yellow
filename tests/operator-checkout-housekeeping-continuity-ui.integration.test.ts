import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const script = readFileSync(new URL("../src/http/operator/operator.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/http/operator/operator.css", import.meta.url), "utf8");

describe("Order 234 checkout-to-Housekeeping continuity presentation", () => {
  test("renders one semantic completion action and one contextual return without changing established controls", () => {
    expect(script).toContain("checkout-housekeeping-completion");
    expect(script).toContain("checkout-housekeeping-action");
    expect(script).toContain('"Review room in Housekeeping"');
    expect(script).toContain("housekeeping-checkout-return");
    expect(script).toContain('"Back to checked-out stay"');
    expect(script).toContain('action.type = "button"');
    expect(script).toContain('action.setAttribute("aria-label"');
    expect(script).toContain("function ensureCheckoutHousekeepingReturnControl(");
    expect(script).toContain("function renderCheckoutHousekeepingReview(");
    expect(script).toContain('const checkInHousekeepingAction = $("#checkin-housekeeping-action")');
    expect(script).toContain('const housekeepingArrivalReturnAction = $("#housekeeping-arrival-return")');
  });

  test("keeps both contextual controls keyboard-sized, wrapping and bounded at phone zoom", () => {
    expect(css).toMatch(/\.checkout-housekeeping-action[^\{]*\{[^}]*min-height:\s*44px/s);
    expect(css).toMatch(/\.housekeeping-checkout-return[^\{]*\{[^}]*min-height:\s*44px/s);
    for (const containment of [
      "max-width: 100%", "white-space: normal", "overflow-wrap: anywhere", "touch-action: manipulation",
      ".checkout-housekeeping-completion", "@media (max-width: 420px)",
    ]) expect(css).toContain(containment);
    expect(css).toMatch(/@media \(max-width: 420px\)[\s\S]*\.checkout-housekeeping-action[^\{]*\{[^}]*width:\s*100%/);
    expect(css).toMatch(/@media \(max-width: 420px\)[\s\S]*\.housekeeping-checkout-return[^\{]*\{[^}]*width:\s*100%/);
  });

  test("gives checkout continuity a distinct treatment in every supported appearance", () => {
    for (const theme of ["apple", "android", "win95", "glass", "neo", "erp"]) {
      expect(css).toContain(`:root[data-theme="${theme}"] .checkout-housekeeping-action`);
      expect(css).toContain(`:root[data-theme="${theme}"] .housekeeping-checkout-return`);
    }
    expect(css).toMatch(/:root\[data-theme="android"\][\s\S]*\.checkout-housekeeping-action[^\{]*\{[^}]*min-height:\s*48px/);
    expect(css).toMatch(/:root\[data-theme="android"\][\s\S]*\.housekeeping-checkout-return[^\{]*\{[^}]*min-height:\s*48px/);
  });

  test("preserves visible focus, forced colours and reduced-motion containment", () => {
    expect(css).toMatch(/\.checkout-housekeeping-action:focus-visible[^\{]*\{[^}]*outline:\s*3px solid var\(--focus\)/);
    expect(css).toMatch(/\.housekeeping-checkout-return:focus-visible[^\{]*\{[^}]*outline:\s*3px solid var\(--focus\)/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.checkout-housekeeping-action[^\{]*\{[^}]*(?:animation:\s*none|transition:\s*none)/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.housekeeping-checkout-return[^\{]*\{[^}]*(?:animation:\s*none|transition:\s*none)/);
    expect(css).toMatch(/@media \(forced-colors: active\)[\s\S]*\.checkout-housekeeping-action[^\{]*\{[^}]*ButtonText/);
    expect(css).toMatch(/@media \(forced-colors: active\)[\s\S]*\.housekeeping-checkout-return[^\{]*\{[^}]*ButtonText/);
    expect(css).toContain("forced-color-adjust: auto");
  });
});
