import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const hadWindow = "window" in globalThis;
if (!hadWindow) Reflect.set(globalThis, "window", { location: { search: "" } });
let PortfolioExplorer: typeof import("../frontend/yellow/src/ui/PortfolioExplorer").PortfolioExplorer;
try {
  ({ PortfolioExplorer } = await import("../frontend/yellow/src/ui/PortfolioExplorer"));
} finally {
  if (!hadWindow) Reflect.deleteProperty(globalThis, "window");
}

describe("portfolio explorer entry control", () => {
  test("exposes the read-only portfolio dialog control and respects an active operation guard", () => {
    const available = renderToStaticMarkup(createElement(PortfolioExplorer, {
      propertyId: "30000000-0000-4000-8000-000000000003", propertyName: "Yellow Hotel", locked: false,
    }));
    expect(available).toContain("Choose another authorized property. Current property: Yellow Hotel");
    expect(available).toContain('aria-haspopup="dialog"');
    expect(available).toContain("Portfolio</span>");
    const guarded = renderToStaticMarkup(createElement(PortfolioExplorer, {
      propertyId: "30000000-0000-4000-8000-000000000003", propertyName: "Yellow Hotel", locked: true,
    }));
    expect(guarded).toContain('disabled=""');
  });
});
