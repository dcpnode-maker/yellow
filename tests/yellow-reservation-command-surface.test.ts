import { expect, test } from "bun:test";

const app = await Bun.file("frontend/yellow/src/App.tsx").text();
const styles = await Bun.file("frontend/yellow/src/styles.css").text();

test("uses one filtered reservation board with explicit front-desk state semantics", () => {
  expect(app).toContain('if (status === "due_in") return "Expected arrival";');
  expect(app).toContain('if (status === "due_out") return "Departure today";');
  expect(app).toContain('if (status === "in_house") return "In house";');
  expect(app).toContain('if (status === "in_house") return "In house · occupied";');
  expect(app).not.toContain('if (status === "in_house") return "Stayover";');
  expect(app).toContain('if (status === "checked_out") return "Departed history";');
  expect(app).toContain('placeholder="Search guest, reservation, room, source, rate or travel…"');
  expect(app).toContain('const query = controlledQuery ?? localQuery;');
  expect(app).toContain('const visibleRows = useMemo(');
  expect(app).toContain('filterAndSortMovementRows(rows, query, sorts, query.movementTime, timezone)');
  expect(app).toContain('const rendered = visibleRows.slice(first, last);');
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
