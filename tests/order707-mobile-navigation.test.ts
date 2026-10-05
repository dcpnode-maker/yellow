import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const headerModulePath: string = "../frontend/yellow/src/ui/OperatorHeader";
const { OperatorHeader } = await import(headerModulePath);
const styles = readFileSync("frontend/yellow/src/ui/reference-theme.css", "utf8");
const mobileStart = styles.indexOf("@media (max-width: 980px)");
const desktopStyles = styles.slice(0, mobileStart);
const mobileStyles = styles.slice(mobileStart, styles.indexOf("@keyframes operator-sheet-slide", mobileStart));

function declarations(source: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return source.match(new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
}

function pixels(rule: string, property: string): number {
  return Number(rule.match(new RegExp(`(?:^|;)\\s*${property}:\\s*(\\d+)px(?:;|$)`))?.[1]);
}

describe("Order707 compact phone Workspaces drawer", () => {
  test("limits phone width and spacing without changing desktop navigation", () => {
    expect(mobileStart).toBeGreaterThan(0);
    const drawer = declarations(mobileStyles, ".yellow-next .operator-navigation");
    expect(pixels(drawer, "width")).toBe(240);
    expect(drawer).toContain("max-width: calc(100vw - 32px)");
    expect(drawer).toContain("box-sizing: border-box");
    expect(pixels(drawer, "padding")).toBeLessThanOrEqual(8);
    for (const viewport of [320, 390]) {
      const drawerWidth = Math.min(pixels(drawer, "width"), viewport - 32);
      expect(drawerWidth).toBeLessThanOrEqual(240);
      expect(viewport - drawerWidth).toBeGreaterThanOrEqual(32);
    }
    expect(pixels(declarations(mobileStyles, ".operator-navigation-group"), "margin-bottom")).toBeLessThanOrEqual(8);
    expect(mobileStyles).not.toMatch(/(?:scale\(|zoom\s*:)/);
    const desktopDrawer = declarations(desktopStyles, ".yellow-next .operator-navigation");
    expect(desktopDrawer).toContain("width: var(--operator-nav-width)");
    expect(desktopDrawer).toContain("overflow: auto");
    expect(desktopDrawer).toContain("overscroll-behavior: contain");
    expect(declarations(desktopStyles, ".yellow-next .operator-navigation nav button svg")).toContain("width: 21px");
  });

  test("keeps readable labels, 18px icons and 44px navigation/property/close targets", () => {
    for (const selector of [
      ".yellow-next .operator-navigation nav button",
      ".yellow-next .operator-navigation nav .operator-navigation-children > button",
    ]) {
      const rule = declarations(mobileStyles, selector);
      expect(pixels(rule, "min-height")).toBeGreaterThanOrEqual(44);
      expect(pixels(rule, "font-size")).toBe(14);
    }
    const icon = declarations(mobileStyles, ".yellow-next .operator-navigation nav button svg");
    expect(pixels(icon, "width")).toBe(18);
    expect(pixels(icon, "height")).toBe(18);
    const close = declarations(mobileStyles, ".operator-navigation-heading button");
    expect(pixels(close, "width")).toBeGreaterThanOrEqual(44);
    expect(pixels(close, "height")).toBeGreaterThanOrEqual(44);
    const property = declarations(mobileStyles, ".operator-navigation-property .property-switcher .profile");
    expect(pixels(property, "min-height")).toBeGreaterThanOrEqual(44);
    expect(property).toContain("max-width: none");
    expect(pixels(declarations(mobileStyles, ".operator-navigation-property .property-options button"), "min-height")).toBeGreaterThanOrEqual(44);
    expect(styles).toContain(".operator-navigation-children[hidden] { display: none; }");
    expect(styles).toContain(".operator-header :is(button, a):focus-visible");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
  });

  test("preserves all ten destinations, both nested families and the property control", () => {
    const markup = renderToStaticMarkup(createElement(OperatorHeader, {
      workspace: "reservations", propertyId: "property", propertyName: "Test hotel",
      onNavigate() {}, onBilling() {}, locked: true,
    }, createElement("div", { className: "property-switcher" },
      createElement("button", { className: "profile", type: "button" }, "Test hotel property switcher"))));
    const navigation = markup.slice(markup.indexOf('<nav aria-label="Hotel operations">'), markup.indexOf("</nav>"));
    const destinations = ["Today", "Reservations", "Front desk", "Housekeeping", "Cashier", "Rates &amp; distribution", "Map", "Reports", "All workspaces", "Property setup"];
    let preceding = -1;
    for (const label of destinations) {
      const index = navigation.indexOf(`aria-label="${label}"`);
      expect(index).toBeGreaterThan(preceding);
      preceding = index;
    }
    expect(navigation.match(/<button\b/g)).toHaveLength(15);
    expect(navigation.match(/disabled=""/g)).toHaveLength(15);
    expect(navigation).toContain('aria-label="Reservation views"');
    expect(navigation).toContain('aria-label="Individual" aria-current="page"');
    expect(navigation).toContain('aria-label="Groups"');
    expect(navigation).toContain('aria-label="Calendar"');
    expect(navigation).toContain('aria-label="Room and housekeeping views" hidden=""');
    expect(navigation).toContain('aria-label="Room status"');
    expect(navigation).toContain('aria-label="Cleaning &amp; inspection"');
    expect(markup).toContain("Current property");
    expect(markup).toContain("Test hotel property switcher");
    expect(markup).toContain('aria-label="Workspace navigation"');
  });
});
