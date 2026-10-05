import { useState } from "react";
import { createTableQuery, queryTableRows, tableColumnSort, type TableQuery } from "../table-query";
import type { FolioStatement } from "../yellow-api";
import { createFolioStatementColumns, folioStatementCellText, visibleFolioStatementColumns } from "../folio-statement-view";
import { TableControls } from "./TableControls";
import { TableColumnMenu } from "./TableColumnMenu";
import { CopyCellButton } from "./CopyCellButton";

type Props = Readonly<{
  rows: FolioStatement["rows"];
  currency: string;
}>;

const columns = createFolioStatementColumns();

export function FolioStatementTable({ rows, currency }: Props) {
  const [query, setQuery] = useState<TableQuery>(createTableQuery);
  const [selectedColumns, setSelectedColumns] = useState<readonly string[]>(() => columns.map(column => column.key));
  const visibleColumns = visibleFolioStatementColumns(selectedColumns);
  const visibleRows = queryTableRows(rows, columns, query);
  const reset = () => {
    setQuery(createTableQuery());
    setSelectedColumns(columns.map(column => column.key));
  };

  return <section className="folio-statement-view" aria-label="Folio statement transactions">
    <TableControls label="Folio transactions" columns={columns} query={query} onChange={setQuery}
      selectedColumns={visibleColumns.map(column => column.key)} onColumnsChange={setSelectedColumns}
      onReset={reset} count={visibleRows.length} total={rows.length} />
    <div className="folio-table-scroll" tabIndex={0} role="region" aria-label="Scrollable folio transaction table">
      <table className="folio-statement-table">
        <caption>Transactions ({currency})</caption>
        <thead><tr>
          {visibleColumns.map(column => <th key={column.key} scope="col"
            className={column.key === "amountMinor" || column.key === "runningBalanceMinor" ? "folio-money-cell" : undefined}
            aria-sort={query.sorts[0]?.column === column.key ? tableColumnSort(query, column.key) : "none"}>
            <TableColumnMenu column={column} query={query} onChange={setQuery} values={rows.map(column.value)} />
          </th>)}
        </tr></thead>
        <tbody>{visibleRows.map(row => <tr key={row.lineId}>
          {visibleColumns.map(column => {
            const text = folioStatementCellText(row, column.key, currency);
            return <td key={column.key} className={`movement-copy-cell${column.key === "amountMinor" || column.key === "runningBalanceMinor" ? " folio-money-cell" : ""}`}>
              {text}<CopyCellButton label={column.label} value={text} />
            </td>;
          })}
        </tr>)}</tbody>
      </table>
      {visibleRows.length === 0 ? <p className="empty">No postings match this statement view.</p> : null}
    </div>
    <p className="folio-statement-note" role="note">Ledger balances are the server-provided running balances in the original statement order. Filtering or sorting changes only the view; balances are not recalculated. Amount and ledger-balance filters use minor units.</p>
  </section>;
}
