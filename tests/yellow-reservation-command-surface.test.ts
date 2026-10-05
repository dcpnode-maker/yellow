import { expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { TableQuery } from "../frontend/yellow/src/table-query";
const tableControlsModule: string = "../frontend/yellow/src/ui/TableControls";
const { TableControls } = await import(tableControlsModule);

const app = await Bun.file("frontend/yellow/src/App.tsx").text();
const styles = await Bun.file("frontend/yellow/src/styles.css").text();
const workspace = await Bun.file("frontend/yellow/src/workspaces/ReservationWorkspace.tsx").text();
const movementControls = await Bun.file("frontend/yellow/src/ui/MovementTableControls.tsx").text();
const tableControls = await Bun.file("frontend/yellow/src/ui/TableControls.tsx").text();
const emptyQuery: TableQuery = { search: "", filters: [], sorts: [] };

test("uses one filtered reservation board with explicit front-desk state semantics", () => {
  expect(app).toContain('if (status === "due_in") return "Expected arrival";');
  expect(app).toContain('if (status === "due_out") return "Departure today";');
  expect(app).toContain('if (status === "in_house") return "In house";');
  expect(app).toContain('if (status === "in_house") return "In house · occupied";');
  expect(app).not.toContain('if (status === "in_house") return "Stayover";');
  expect(app).toContain('if (status === "checked_out") return "Departed history";');
  const searchFor = (label: string) => renderToStaticMarkup(createElement(TableControls, {
    label,
    columns: [{ key: "guest", label: "Guest", value: (row: { guest: string }) => row.guest }],
    query: emptyQuery, onChange() {}, count: 0, total: 0,
  }));
  expect(searchFor("Arrivals")).toContain('aria-label="Search Arrivals"');
  expect(searchFor("Departures")).toContain('aria-label="Search Departures"');
  expect(tableControls).toContain('aria-label={`Search ${label}`}');
  expect(movementControls).toContain('const query = controlledQuery ?? saved?.query ?? defaultQuery;');
  expect(movementControls).toContain('const visibleRows = useMemo(');
  expect(movementControls).toContain('queryMovementTableRows(rows, query, filters, timezone, status === "all")');
  for (const source of [app, workspace]) {
    expect(source.includes('useMovementTable({ status, rows, timezone, controlledQuery, onQueryChange })')).toBe(true);
    expect(source.includes('const rendered = visibleRows.slice(first, last);')).toBe(true);
  }
});

test("expands only current API-backed reservation detail in place", () => {
  expect(app).toContain('function ReservationBoardRow');
  expect(app).toContain('queryFn: () => loadReservation(stay.reservationId)');
  expect(app).toContain('enabled: expanded');
  expect(app).toContain('aria-expanded={expanded}');
  expect(app).toContain('Named on this stay');
  expect(app).toContain('Server-owned windows');
  expect(app).toContain('No folio is open for this reservation.');
  expect(app).not.toContain('reservations/${stay.reservationId}${stay.status');
});

test("opens a selected Yellow reservation inside the retained filtered board", () => {
  expect(app).toContain('detailReservationId?: string;');
  expect(app).toContain('movement: { ...current.movement, detailReservationId: stay.reservationId }');
  expect(app).toContain('reservationId={assistantCard.movement.detailReservationId}');
  expect(app).toContain('Back to filtered reservations');
  expect(app).toContain('movement: { ...current.movement, detailReservationId: undefined }');
});

test("keeps the command surface usable at phone widths", () => {
  expect(styles).toContain('@media (max-width: 760px)');
  expect(styles).toContain('.board-head { display: none; }');
  expect(styles).toContain('.reservation-context-grid { grid-template-columns: 1fr; }');
});
