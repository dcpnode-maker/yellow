import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { FolioStatementTable } from "../frontend/yellow/src/ui/FolioStatementTable";
import { createFolioStatementColumns, folioStatementCellText, visibleFolioStatementColumns } from "../frontend/yellow/src/folio-statement-view";
import type { FolioStatement } from "../frontend/yellow/src/yellow-api";

const row: FolioStatement["rows"][number] = {
  lineId: "line", journalId: "journal", kind: "charge", businessDate: "2026-09-25",
  description: "Laundry <express>", quantity: "1.000", amountMinor: "9007199254740993",
  runningBalanceMinor: "9007199254740993", txCode: "LAUNDRY",
  transferGroup: { id: "journal", memberCount: 1, eligible: true, reason: null, currentWindowId: "window" },
};

test("hidden columns use stable canonical order and never empty the table", () => {
  expect(visibleFolioStatementColumns(["amountMinor", "businessDate", "amountMinor", "unknown"]).map(c => c.key))
    .toEqual(["businessDate", "amountMinor"]);
  expect(visibleFolioStatementColumns(["description"]).map(c => c.key)).toEqual(["description"]);
  expect(visibleFolioStatementColumns([]).map(c => c.key)).toEqual(createFolioStatementColumns().map(c => c.key));
  expect(visibleFolioStatementColumns(["unknown"])).toHaveLength(7);
});

test("copy formatting matches visible values and retains exact money", () => {
  expect(folioStatementCellText(row, "amountMinor", "USD", "en-US")).toBe("$90,071,992,547,409.93");
  expect(folioStatementCellText({ ...row, amountMinor: "-1" }, "amountMinor", "USD", "en-US")).toBe("-$0.01");
  expect(folioStatementCellText({ ...row, runningBalanceMinor: "12345" }, "runningBalanceMinor", "KWD", "en-US")).toBe("KWD 12.345");
  expect(folioStatementCellText(row, "description", "SAR")).toBe("Laundry <express>");
  expect(folioStatementCellText({ ...row, description: null }, "description", "SAR")).toBe("—");
  expect(folioStatementCellText(row, "quantity", "SAR")).toBe("1.000");
});

test("folio table provides explicit reset and a named copy control for every displayed cell", () => {
  const html = renderToStaticMarkup(<FolioStatementTable rows={[row]} currency="SAR" />);
  expect(html).toContain('aria-label="Reset table controls"');
  expect(html).toContain('aria-label="Columns (7 visible)"');
  expect(html.match(/aria-label="Copy [^"]+ cell text"/g)).toHaveLength(7);
  expect(html.match(/scope="col"/g)).toHaveLength(7);
  expect(html.match(/<td /g)).toHaveLength(7);
  expect(html).toContain("Laundry &lt;express&gt;");
  expect(html).not.toContain("<express>");
  expect(html).toContain('class="movement-copy-cell folio-money-cell"');
});

test("column callback, reset and matched header/body projection are wired in the real component", async () => {
  const source = await Bun.file("frontend/yellow/src/ui/FolioStatementTable.tsx").text();
  expect(source).toContain("onColumnsChange={setSelectedColumns}");
  expect(source).toContain("setQuery(createTableQuery())");
  expect(source).toContain("setSelectedColumns(columns.map(column => column.key))");
  expect(source.match(/visibleColumns.map\(column =>/g)).toHaveLength(3);
  expect(source).toContain("value={text}");
});
