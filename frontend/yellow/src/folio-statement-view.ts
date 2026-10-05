import type { TableColumn } from "./table-query";

export type FolioStatementRowView = Readonly<{
  lineId: string;
  businessDate: string;
  description: string | null;
  kind: string;
  txCode: string;
  quantity: string;
  amountMinor: string;
  runningBalanceMinor: string;
}>;

/** Columns used by the local-only folio table query. Money stays bigint minor units. */
export function createFolioStatementColumns(): readonly TableColumn<FolioStatementRowView>[] {
  return [
    { key: "businessDate", label: "Date", value: row => row.businessDate },
    { key: "description", label: "Description", value: row => row.description },
    { key: "kind", label: "Kind", value: row => row.kind },
    { key: "txCode", label: "Code", value: row => row.txCode },
    { key: "quantity", label: "Quantity", value: row => row.quantity },
    { key: "amountMinor", label: "Amount (minor units)", value: row => BigInt(row.amountMinor) },
    { key: "runningBalanceMinor", label: "Ledger balance (minor units)", value: row => BigInt(row.runningBalanceMinor) },
  ];
}

/** Keep header/body order stable, even after a hidden field is shown again. */
export function visibleFolioStatementColumns(keys: readonly string[]): readonly TableColumn<FolioStatementRowView>[] {
  const columns = createFolioStatementColumns();
  const visible = columns.filter(column => keys.includes(column.key));
  return visible.length ? visible : columns;
}

/** The copied value is exactly the visible text, not a rounded JS number. */
export function folioStatementCellText(row: FolioStatementRowView, key: string, currency: string, locale?: string): string {
  if (key === "amountMinor" || key === "runningBalanceMinor") return formatFolioMinor(row[key], currency, locale);
  const column = createFolioStatementColumns().find(candidate => candidate.key === key);
  return String(column?.value(row) ?? "—");
}

/** Format canonical integer minor units without converting money through Number. */
export function formatFolioMinor(minor: string, currency: string, locale?: string): string {
  const amount = BigInt(minor);
  const negative = amount < 0n;
  const absolute = negative ? -amount : amount;
  const formatter = new Intl.NumberFormat(locale, { style: "currency", currency });
  const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
  const scale = 10n ** BigInt(digits);
  const whole = absolute / scale;
  const fraction = (absolute % scale).toString().padStart(digits, "0");
  const parts = formatter.formatToParts(negative ? -1n : 1n);
  const integerParts = new Intl.NumberFormat(locale, { useGrouping: true, maximumFractionDigits: 0 }).formatToParts(whole);
  let replacedInteger = false;
  return parts.map(part => {
    if (part.type === "integer" || part.type === "group") {
      if (replacedInteger) return "";
      replacedInteger = true;
      return integerParts.filter(integerPart => integerPart.type === "integer" || integerPart.type === "group").map(integerPart => integerPart.value).join("");
    }
    if (part.type === "fraction") return fraction;
    return part.value;
  }).join("");
}
