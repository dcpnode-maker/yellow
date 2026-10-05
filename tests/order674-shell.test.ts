import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
// The root test tsconfig intentionally excludes JSX; Bun loads the component for SSR proof.
const headerModulePath: string = "../frontend/yellow/src/ui/OperatorHeader";
const { OperatorHeader } = await import(headerModulePath);

describe("Order674 approved workspace shell", () => {
  test("one grouped navigation replaces duplicate topbar navigation without a guest-search tab", () => {
    const markup = renderToStaticMarkup(createElement(OperatorHeader, { workspace: "reservations", propertyId: "property", propertyName: "Test hotel", onNavigate() {}, onBilling() {}, locked: false }, createElement("nav", null, "Legacy navigation"), createElement("div", { className: "hotel-search-entry" }, "Universal search")));
    expect(markup).not.toContain("Legacy navigation");
    expect(markup).toContain("Universal search");
    expect(markup).toContain('aria-label="Reservations" aria-current="page"');
    expect(markup).not.toContain("Guest search");
    expect(markup).toContain("Property setup");
    expect(markup).toContain("Cashier");
  });
  test("recovery-locked navigation renders disabled destinations", () => {
    const markup = renderToStaticMarkup(createElement(OperatorHeader, { workspace: "finance", propertyId: "property", propertyName: "Test hotel", onNavigate() {}, onBilling() {}, locked: true }));
    expect(markup).toContain('aria-label="Cashier" aria-current="page" disabled=""');
  });
  test("all active shells use shared header and mobile modality is explicit", () => {
    const app = readFileSync("frontend/yellow/src/App.tsx", "utf8");
    expect(app.match(/<OperatorHeader /g)).toHaveLength(10);
    const shell = readFileSync("frontend/yellow/src/ui/OperatorHeader.tsx", "utf8");
    expect(shell).toContain('event.key === "Escape"');
    expect(shell).toContain("node.inert = true");
    expect(shell).toContain("trigger.current?.focus()");
    const styles = readFileSync("frontend/yellow/src/ui/reference-theme.css", "utf8");
    expect(styles).toContain("prefers-reduced-motion: reduce");
    expect(styles).toContain('.movement-adaptive-grid .movement-grid-row > span { display: flex; }');
  });
});
