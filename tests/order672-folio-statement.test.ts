import { expect, test } from "bun:test";
import { createTableQuery, queryTableRows } from "../frontend/yellow/src/table-query";
import { createFolioStatementColumns, formatFolioMinor, type FolioStatementRowView } from "../frontend/yellow/src/folio-statement-view";

const rows: readonly FolioStatementRowView[] = [
  { lineId: "a", businessDate: "2026-09-01", description: "Suite", kind: "charge", txCode: "ROOM", quantity: "1", amountMinor: "9007199254740993", runningBalanceMinor: "9007199254740993" },
  { lineId: "b", businessDate: "2026-09-02", description: "Payment", kind: "payment", txCode: "PAY", quantity: "1", amountMinor: "-1", runningBalanceMinor: "9007199254740992" },
  { lineId: "c", businessDate: "2026-09-03", description: null, kind: "adjustment", txCode: "ADJ", quantity: "2", amountMinor: "9007199254740992", runningBalanceMinor: "18014398509481984" },
];

test("folio currency formatter honors currency scale and retains exact large and negative values", () => {
  expect(formatFolioMinor("12345", "INR", "en-IN")).toBe("₹123.45");
  expect(formatFolioMinor("12345", "JPY", "en-US")).toBe("¥12,345");
  expect(formatFolioMinor("12345", "KWD", "en-US")).toBe("KWD 12.345");
  expect(formatFolioMinor("-1", "USD", "en-US")).toBe("-$0.01");
  expect(formatFolioMinor("900719925474099312345", "USD", "en-US")).toBe("$9,007,199,254,740,993,123.45");
});

test("folio table columns sort minor units exactly and queries preserve original rows and balances", () => {
  const originalOrder = [...rows];
  const columns = createFolioStatementColumns();
  expect(queryTableRows(rows, columns, { ...createTableQuery(), sorts: [{ column: "amountMinor", direction: "asc" }] }).map(row => row.lineId)).toEqual(["b", "c", "a"]);
  const filtered = queryTableRows(rows, columns, { search: "payment", filters: [], sorts: [] });
  expect(filtered).toHaveLength(1);
  expect(filtered[0]).toBe(rows[1]);
  expect(filtered[0]?.runningBalanceMinor).toBe("9007199254740992");
  expect(rows).toEqual(originalOrder);
  expect(rows[0]).toBe(originalOrder[0]);
});

test("amount columns expose bigint values for exact advanced filter and sort operations", () => {
  const amount = createFolioStatementColumns().find(column => column.key === "amountMinor");
  expect(amount?.value(rows[0]!)).toBe(9007199254740993n);
  expect(typeof amount?.value(rows[0]!)).toBe("bigint");
});
