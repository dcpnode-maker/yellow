import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { copyVisibleCellText } from "../frontend/yellow/src/ui/cell-copy";

const headerModulePath: string = "../frontend/yellow/src/ui/OperatorHeader";
const copyButtonModulePath: string = "../frontend/yellow/src/ui/CopyCellButton";
const [{ OperatorHeader }, { CopyCellButton }] = await Promise.all([
  import(headerModulePath),
  import(copyButtonModulePath),
]);

describe("Order694 nested Housekeeping navigation", () => {
  test("uses only backed room-status and housekeeping destinations with current state", () => {
    const navigated: string[] = [];
    const markup = renderToStaticMarkup(createElement(OperatorHeader, {
      workspace: "housekeeping",
      propertyId: "property",
      propertyName: "Test hotel",
      onNavigate: (destination: string) => navigated.push(destination),
      onBilling() {},
      locked: false,
    }, createElement("div", { className: "hotel-search-entry" }, "Universal search")));

    expect(markup).toContain('aria-label="Housekeeping" aria-expanded="true"');
    expect(markup).toContain('aria-label="Room and housekeeping views"');
    expect(markup).toContain('aria-label="Room status"');
    expect(markup).toContain('aria-label="Cleaning &amp; inspection" aria-current="page"');
    expect(markup).toContain("Universal search");
    expect(markup).not.toContain('aria-label="Rooms"');
    expect(markup).not.toContain('aria-label="Inventory"');
    expect(navigated).toEqual([]);
  });

  test("retains desktop collapse, mobile drawer, route guard and motion/accessibility styles", () => {
    const styles = readFileSync("frontend/yellow/src/ui/reference-theme.css", "utf8");
    const dock = readFileSync("frontend/yellow/src/ui/WorkspaceDock.tsx", "utf8");
    const dockStyles = readFileSync("frontend/yellow/src/ui/workspace-dock.css", "utf8");
    const shell = readFileSync("frontend/yellow/src/ui/OperatorHeader.tsx", "utf8");
    expect(shell).toContain("setRoomsOpen(value => !value)");
    expect(shell).toContain('onNavigate(route); setMobileOpen(false)');
    expect(shell).toContain('disabled={locked}');
    expect(dock).toContain('aria-label="Quick workspaces"');
    expect(dock).toContain("aria-describedby={tooltipId}");
    expect(shell).toContain('id: "housekeeping", label: "Housekeeping", current: workspace === "housekeeping"');
    expect(styles).toContain(".operator-navigation-nested");
    expect(styles).toContain('.movement-grid-head.movement-grid-row > span[role="columnheader"] { padding: 2px 6px');
    expect(styles).toContain('.movement-grid-head .table-column-trigger { height: 44px; min-height: 44px; padding: 4px 6px; box-sizing: border-box; }');
    expect(styles).toContain(".operator-navigation-children:not([hidden])");
    expect(styles).toContain("background: #eceef0");
    expect(styles).toContain('button[aria-current="page"] { border: 1px solid #e2e4e8; border-radius: 12px; background: #fff');
    expect(dockStyles).toContain("max-width: calc(100vw - 24px");
    expect(dockStyles).toContain("env(safe-area-inset-bottom, 0px)");
    expect(dockStyles).toContain(".operator-dock-tooltip");
    expect(dockStyles).toContain("clip-path: inset(50%)");
    expect(dockStyles).toContain(".operator-workspace-dock[data-placement=\"bottom\"] .operator-quick-dock");
    expect(dockStyles).toContain("overflow-x: auto");
    expect(dockStyles).toContain("min-width: 44px");
    expect(styles).toContain(".yellow-next .operator-navigation nav .operator-navigation-children > button { min-height: 44px");
    expect(styles).toContain("prefers-reduced-motion: reduce");
  });
});

describe("Order694 table header and visible-cell copy", () => {
  test("keeps direct header sort/filter indicators, priorities, and loaded-value caveat", () => {
    const source = readFileSync("frontend/yellow/src/ui/TableColumnMenu.tsx", "utf8");
    const styles = readFileSync("frontend/yellow/src/ui/table-controls.css", "utf8");
    expect(source).toContain("setTableColumnSort(query, column.key, \"asc\")");
    expect(source).toContain("sortIndex + 1");
    expect(source).toContain("filters.length}");
    expect(source).toContain("Applying replaces this column");
    expect(source).toContain("Choose a loaded value");
    expect(styles).toContain(".table-column-filter-state svg");
    expect(styles).toContain(".table-column-trigger:focus-visible");
    expect(styles).toContain(".table-column-menu :is(button,input,select)");
    expect(styles).toContain(".movement-grid-head .table-column-trigger > span { box-sizing: border-box; display: inline-flex;");
    expect(styles).toContain(".movement-grid-head .table-column-trigger > .table-column-state { min-width: 0; min-height: 18px; padding: 0;");
    expect(styles).toContain(".yellow-next .movement-adaptive-grid .movement-grid-head > span { padding: 2px 6px; }");
    expect(styles).toContain(".table-column-trigger.table-column-trigger { box-sizing: border-box;");
  });

  test("copies only an explicitly supplied visible string and reports denial instead of throwing", async () => {
    const writes: string[] = [];
    expect(await copyVisibleCellText("Guest display", async text => { writes.push(text); })).toBe("copied");
    expect(writes).toEqual(["Guest display"]);
    expect(await copyVisibleCellText("Guest display", async () => { throw new Error("denied"); })).toBe("failed");
    expect(await copyVisibleCellText("Guest display", null)).toBe("unavailable");
  });

  test("renders an explicit accessible button; no clipboard work occurs while rendering", () => {
    const markup = renderToStaticMarkup(createElement(CopyCellButton, { value: "A visible room", label: "Room" }));
    expect(markup).toContain('type="button"');
    expect(markup).toContain('aria-label="Copy Room cell text"');
    expect(markup).toContain('aria-live="polite"');
    expect(markup).not.toContain("A visible room");
    expect(markup).not.toContain("Copied");
  });
});
