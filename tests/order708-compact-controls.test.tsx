import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { TableControls } from "../frontend/yellow/src/ui/TableControls";
import type { TableQuery } from "../frontend/yellow/src/table-query";

const query: TableQuery = { search: "", filters: [], sorts: [] };
const props = {
  label: "Arrivals",
  columns: [{ key: "guest", label: "Guest", value: (row: { guest: string }) => row.guest }],
  query,
  onChange() {},
  count: 2,
  total: 8,
  onReset() {},
};

describe("Order708 compact controls and dock", () => {
  test("column menu defers Escape to its open dictation surface", () => {
    const source = readFileSync("frontend/yellow/src/ui/TableColumnMenu.tsx", "utf8");
    const escape = source.slice(source.indexOf("const escape ="), source.indexOf('document.addEventListener("pointerdown"'));
    expect(escape).toContain('target?.closest(".voice-field-panel")');
    expect(escape).toContain('.voice-field-mic[aria-expanded="true"]');
    expect(escape.indexOf('target?.closest(".voice-field-panel")')).toBeLessThan(escape.indexOf("event.preventDefault()"));
  });
  test("reset does not restore search and sorts from the previous render", () => {
    const source = readFileSync("frontend/yellow/src/ui/MovementTableControls.tsx", "utf8");
    const reset = source.slice(source.indexOf("const resetControls ="), source.indexOf("const stayCriteria ="));
    expect(reset).toContain("onTableChange(reset)");
    expect(reset).toContain("onQueryChange(createMovementQuery(query.movementTime))");
    expect(reset).not.toContain("clearStayCriteria()");
    expect(reset).toContain("onColumnsChange(columns.filter(column => column.initial)");
  });
  test("groups search/count and reset/filter/sort/columns into two toolbar rows", () => {
    const html = renderToStaticMarkup(createElement(TableControls, props));
    const searchRow = html.indexOf("table-controls-search-row");
    const actionRow = html.indexOf("table-controls-action-row");
    expect(searchRow).toBeGreaterThan(-1);
    expect(actionRow).toBeGreaterThan(searchRow);
    expect(html.slice(searchRow, actionRow)).toContain('role="status"');
    const actions = html.slice(actionRow, html.indexOf("</div>", actionRow));
    for (const label of ["Reset", "Filter", "Sort", "Columns"]) expect(html).toContain(label);
    expect(actions).toContain("table-controls-actions");
    expect(html).toContain('class="table-controls-search-label"');
    expect(html).toContain('aria-label="Columns (1 visible)"');
    expect(html).toContain('class="table-controls-action-short" aria-hidden="true">Cols</span>');
  });

  test("mobile CSS keeps the two rows and touch targets, including a voice-field wrapper slot", () => {
    const css = readFileSync("frontend/yellow/src/ui/table-controls.css", "utf8");
    expect(css).toContain(".table-controls-search-row .voice-field");
    expect(css).toMatch(/@media \(pointer: coarse\), \(max-width: 600px\)[\s\S]*?min-height: 44px/);
    expect(css).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(css).toContain(".table-controls-action-row");
    expect(css).toContain(".table-controls-action-full { display: none; }");
    expect(css).toContain(".table-controls-action-short { display: inline; }");
  });

  test("idle dock translucency keeps pointer interaction and restores hover/focus/drag, with bottom scroll clearance", () => {
    const css = readFileSync("frontend/yellow/src/ui/workspace-dock.css", "utf8");
    expect(css).toContain("opacity: .48");
    expect(css).toContain(":hover, :focus-within, [data-dragging=\"true\"]");
    const dockRule = css.match(/\.yellow-next \.operator-header \.operator-workspace-dock \{([^}]*)\}/)?.[1] ?? "";
    expect(dockRule).not.toContain("pointer-events: none");
    expect(css).toContain("padding-bottom: max(96px");
    expect(css).toContain("scroll-padding-bottom: max(96px");
  });
});
