import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../src/http/operator/index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/http/operator/operator.css", import.meta.url), "utf8");
const script = readFileSync(new URL("../src/http/operator/operator.js", import.meta.url), "utf8");

describe("Order 226 check-in to Housekeeping continuity presentation", () => {
  test("exposes two contextual semantic controls without replacing the established actions", () => {
    expect(html).toContain('<button class="quiet checkin-housekeeping-action" id="checkin-housekeeping-action" type="button" hidden>Review room in Housekeeping</button>');
    expect(html).toContain('<button class="quiet housekeeping-arrival-return" id="housekeeping-arrival-return" type="button" hidden>Back to arrival</button>');
    expect(html).toContain('<button class="primary" id="checkin-submit" type="submit" disabled>Check in guest</button>');
    expect(html).toContain('<button class="quiet" id="checkin-refresh" type="button">Refresh readiness</button>');
    expect(html).toContain('<button class="quiet" id="housekeeping-refresh" type="button">Refresh workspace</button>');
    expect(script).toContain('const checkInHousekeepingAction = $("#checkin-housekeeping-action")');
    expect(script).toContain('const housekeepingArrivalReturnAction = $("#housekeeping-arrival-return")');
    expect(script).not.toContain('node("button", "quiet housekeeping-arrival-return"');

    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
    expect(ids.length).toBe(new Set(ids).size);
  });

  test("keeps both controls keyboard-sized, wrapping and bounded at phone zoom", () => {
    expect(css).toContain(".checkin-housekeeping-action,.housekeeping-arrival-return { min-width: 0; min-height: 44px; max-width: 100%;");
    for (const containment of [
      "white-space: normal", "overflow-wrap: anywhere", "touch-action: manipulation",
      ".housekeeping-heading-actions { min-width: 0;", "flex-wrap: wrap",
      "@media (max-width: 420px)", ".checkin-housekeeping-action,.housekeeping-arrival-return { width: 100%; }",
    ]) expect(css).toContain(containment);
  });

  test("gives both controls a distinct treatment in every supported appearance", () => {
    for (const theme of ["apple", "android", "win95", "glass", "neo", "erp"]) {
      expect(css).toContain(`:root[data-theme="${theme}"] .checkin-housekeeping-action`);
      expect(css).toContain(`:root[data-theme="${theme}"] .housekeeping-arrival-return`);
    }
    expect(css).toContain(':root[data-theme="android"] .checkin-housekeeping-action');
    expect(css).toContain("min-height: 48px");
    expect(css).toContain('font-family: "MS Sans Serif"');
    expect(css).toContain("backdrop-filter: blur(20px) saturate(170%)");
    expect(css).toContain("box-shadow: -5px -5px 12px #fff,5px 5px 12px #bec8cd");
  });

  test("preserves visible focus, forced colours and reduced-motion containment", () => {
    expect(css).toContain(".checkin-housekeeping-action:focus-visible,.housekeeping-arrival-return:focus-visible { outline: 3px solid var(--focus);");
    expect(css).toContain("@media (prefers-reduced-motion: reduce) { .checkin-housekeeping-action,.housekeeping-arrival-return { animation: none; transition: none; transform: none; } }");
    expect(css).toContain("@media (forced-colors: active)");
    for (const selector of [".checkin-housekeeping-action", ".housekeeping-arrival-return"]) {
      expect(css).toContain(`${selector} { border: 2px solid ButtonText; background: ButtonFace; color: ButtonText;`);
      expect(css).toContain(`${selector}:focus-visible { outline: 3px solid Highlight; }`);
    }
    expect(css).toContain(".housekeeping-task-detail-governed-action:focus-visible { outline: 3px solid Highlight; }");
  });
});
