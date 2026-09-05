import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/http/operator/operator.css", import.meta.url), "utf8");

describe("Order 228 reservation pickup-task dispatch UI", () => {
  test("contains semantic bounded assignment and action surfaces", () => {
    expect(css).toContain(".pickup-task-detail-governed-actions { min-width: 0; max-width: 100%;");
    expect(css).toContain(".pickup-task-detail-governed-action { min-width: 0; min-height: 44px; max-width: 100%;");
    expect(css).toContain(".pickup-task-assignee-picker,.pickup-task-assignee-picker fieldset");
    expect(css).toContain(".pickup-task-assignee-search-row");
    expect(css).toContain(".pickup-task-assignee-results");
    expect(css).toContain(".pickup-task-assignee-selected");
  });

  test("gives all six appearances an explicit dispatch treatment", () => {
    for (const theme of ["apple", "android", "win95", "glass", "neo", "erp"]) {
      expect(css).toContain(`:root[data-theme="${theme}"] .pickup-task-detail-governed-actions`);
      expect(css).toContain(`:root[data-theme="${theme}"] .pickup-task-detail-governed-action`);
    }
    expect(css).toContain(':root[data-theme="android"] .pickup-task-detail-governed-action');
    expect(css).toContain("min-height: 48px");
  });

  test("preserves 375px and 200% zoom containment with visible focus", () => {
    expect(css).toContain("@media (max-width: 480px)");
    expect(css).toContain(".pickup-task-assignee-search-row { grid-template-columns: minmax(0,1fr);");
    expect(css).toContain(".pickup-task-assignee-result,.pickup-task-assignee-selected { align-items: stretch; flex-direction: column;");
    expect(css).toContain(".pickup-task-detail-governed-action:focus-visible,.pickup-task-assignee-picker :focus-visible");
    expect(css).toContain("overflow-wrap: anywhere");
  });

  test("contains reduced-motion and final forced-colour protections", () => {
    const reduced = css.slice(css.lastIndexOf("@media (prefers-reduced-motion: reduce)"));
    expect(reduced).toContain(".pickup-task-detail-governed-action");
    expect(reduced).toContain("animation: none; transition: none; transform: none;");
    const forced = css.slice(css.lastIndexOf("@media (forced-colors: active)"));
    for (const selector of [
      ".pickup-task-detail-governed-actions",
      ".pickup-task-assignee-picker fieldset",
      ".pickup-task-assignee-result",
      ".pickup-task-assignee-selected",
      ".pickup-task-detail-governed-action",
      ".pickup-task-detail-governed-action:focus-visible",
      ".housekeeping-task-detail-panel",
      ".housekeeping-task-detail-governed-action",
    ]) expect(forced).toContain(selector);
    expect(forced).toContain("forced-color-adjust: auto");
  });
});
