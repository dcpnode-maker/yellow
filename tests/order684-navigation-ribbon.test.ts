import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const headerModulePath: string = "../frontend/yellow/src/ui/OperatorHeader";
const { OperatorHeader } = await import(headerModulePath);

describe("Order684 unified navigation ribbon", () => {
  test("keeps routes and universal search in one accessible shell", () => {
    const markup = renderToStaticMarkup(createElement(OperatorHeader, {
      workspace: "reservations",
      propertyId: "property",
      propertyName: "Test hotel",
      onNavigate() {},
      onBilling() {},
      locked: false,
    }, createElement("div", { className: "hotel-search-entry" }, "Universal search")));

    expect(markup).toContain('aria-label="Collapse navigation"');
    expect(markup).toContain('aria-expanded="true"');
    expect(markup).toContain('aria-controls=');
    expect(markup).toContain('aria-label="Workspace navigation"');
    expect(markup).toContain('aria-label="Reservations" aria-expanded="true"');
    expect(markup).toContain('aria-label="Individual" aria-current="page"');
    expect(markup).toContain('aria-label="Groups"');
    expect(markup).toContain('aria-label="Calendar"');
    expect(markup).toContain("Universal search");
    expect(markup).toContain("Housekeeping");
    expect(markup).toContain('aria-label="Room status"');
    expect(markup).toContain('aria-label="Cleaning &amp; inspection"');
    expect(markup).toContain("Property setup");
    expect(markup).toContain('aria-label="Map"');
  });

  test("uses an integrated canvas shell, reclaims the collapsed rail, and preserves mobile behavior", () => {
    const styles = readFileSync("frontend/yellow/src/ui/reference-theme.css", "utf8");
    const shell = readFileSync("frontend/yellow/src/ui/OperatorHeader.tsx", "utf8");

    expect(styles).toContain("background: var(--reference-canvas)");
    expect(styles).toContain("border-right: 1px solid var(--reference-line)");
    expect(styles).toContain("box-shadow: none");
    expect(styles).toContain("width: 0; padding-inline: 0; border-right-width: 0; overflow: hidden; visibility: hidden");
    expect(styles).toContain("--operator-nav-width: 0px");
    expect(styles).toContain("max-width: calc(100vw - 24px)");
    expect(styles).toContain("prefers-reduced-motion: reduce");
    expect(shell).toContain('aria-expanded={open}');
    expect(shell).toContain('aria-label="Workspace navigation"');
    expect(shell).toContain('typeof window.matchMedia === "function"');
    expect(shell).toContain('event.key === "Escape"');
    expect(shell).toContain("node.inert = true");
    expect(shell).toContain("trigger.current?.focus()");
  });
});
