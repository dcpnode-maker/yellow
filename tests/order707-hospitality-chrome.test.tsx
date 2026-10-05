import { expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
const iconPath: string = "../frontend/yellow/src/ui/HospitalityIcon";
const columnPath: string = "../frontend/yellow/src/ui/TableColumnMenu";
const { HospitalityIcon } = await import(iconPath);
const { TableColumnMenu } = await import(columnPath);

test("hospitality metaphors are distinct decorative vectors, not font glyphs", () => {
  const icons = ["arrival", "departure", "in-house"].map(name => renderToStaticMarkup(createElement(HospitalityIcon, { name })));
  expect(new Set(icons).size).toBe(3);
  for (const html of icons) {
    expect(html).toContain('viewBox="0 0 24 24"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('stroke="currentColor"');
    expect(html).toContain('stroke-width="1.7"');
    expect(html).toContain("<path");
  }
  const app = readFileSync("frontend/yellow/src/App.tsx", "utf8");
  expect(app).toContain('icon: "arrival", onOpen: () => openOperationalTable("due_in")');
  expect(app).toContain('icon: "departure", onOpen: () => openOperationalTable("due_out")');
  expect(app).toContain('icon: "in-house", onOpen: () => openOperationalTable("in_house")');
});

test("quiet headers preserve full sort precedence, filter count and disabled semantics", () => {
  let changes = 0;
  const html = renderToStaticMarkup(createElement(TableColumnMenu, {
    column: { key: "guest", label: "Guest" },
    query: { search: "", sorts: [{ column: "arrival", direction: "asc" }, { column: "guest", direction: "desc" }], filters: [{ column: "guest", operator: "contains", value: "A" }] },
    onChange: () => changes++, disabled: true,
  }));
  expect(changes).toBe(0);
  expect(html).toContain('aria-label="Guest column options, descending, priority 2, 1 filters"');
  expect(html).toContain('disabled=""');
  expect(html).toContain('aria-haspopup="dialog"');
  expect(html).toContain('class="table-column-label">Guest');
  expect(html).toContain('data-sort-direction="desc"');
  expect(html).toContain('<small>2</small>');
  expect(html.match(/<button /g)).toHaveLength(1);
  expect(html).not.toContain("↓");
});

test("header cell spacing cannot enlarge nested status indicators", () => {
  const base = readFileSync("frontend/yellow/src/styles.css", "utf8");
  const table = readFileSync("frontend/yellow/src/ui/table-controls.css", "utf8");
  expect(base).not.toMatch(/\.movement-grid-head span\s*\{/);
  expect(base).toContain(".movement-grid-head > span {");
  expect(table).toContain(".table-column-sort-state svg { width: 12px; height: 12px; }");
  expect(table).toContain(".table-column-trigger.table-column-trigger { min-height: 44px; }");
  expect(base).toContain(".today-glass-ribbon .hospitality-icon { width: 16px; height: 16px; }");
});
