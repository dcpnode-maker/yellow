import { expect, test } from "bun:test";

const app = await Bun.file("frontend/yellow/src/App.tsx").text();
const css = await Bun.file("frontend/yellow/src/styles.css").text();

test("reservation detail translates readiness codes into actionable operator steps", () => {
  expect(app).toContain("function checkInBlockerCopy");
  expect(app).toContain('case "dirty_room_override_unauthorized"');
  expect(app).toContain('title: "Room needs Housekeeping"');
  expect(app).toContain('case "primary_folio_not_open"');
  expect(app).toContain('title: "Primary folio needs opening"');
  expect(app).toContain('className="arrival-resolution-list"');
  expect(app).not.toContain('<li key={blocker}>{blocker}</li>');
});

test("reservation route opens the existing guided Yellow arrival journey", () => {
  expect(app).toContain("onResolveWithYellow?:");
  expect(app).toContain("onResolveWithYellow?.(reservation)");
  expect(app).toContain("const resolveReservationWithYellow = (reservation:");
  expect(app.match(/onResolveWithYellow=\{resolveReservationWithYellow\}/g)?.length).toBe(3);
  expect(app).toContain('eyebrow: "LIVE ARRIVAL FLOW"');
  expect(app).toContain("checkInReservationId: reservation.reservationId");
  expect(app).toContain("Every write remains confirmation-gated");
});

test("primary folio preparation keeps the exact Order496 guard and authoritative refresh", () => {
  expect(app).toContain('readiness.data.blockers[0] === "primary_folio_not_open"');
  expect(app).toContain('readiness.data?.identityGate.satisfied === true');
  expect(app).toContain('const inspectedAssignedRoom = readiness.data?.roomCondition === "inspected"');
  expect(app).toContain("await openPrimaryFolio(reservationId, folioAttempt.current)");
  expect(app).toContain("const [refreshedDetail, refreshedReadiness] = await Promise.all([detail.refetch(), readiness.refetch()]);");
  expect(app).toContain("!authoritativeOpenFolio || !authoritativeFolioReady");
  expect(app).toContain("folio.folioId === authoritativePrimaryFolioId && folio.status === \"open\"");
  expect(app).toContain("reconciledDetail?.isError === false");
  expect(app).toContain("reconciledReadiness?.isError === false");
  expect(app).toContain("folio.folioId === reconciledReadiness.data?.primaryFolioId && folio.status === \"open\"");
  expect(app).toContain("Primary folio opened and reconciled from the refreshed hotel record.");
  expect(app).toContain("I confirm opening the primary folio");
  expect(app).toContain("does not require an open physical cash drawer");
});

test("operational values are selected inline and the mobile sheet is contained", () => {
  expect(app).toContain('className="inline-edit-field"');
  expect(app).toContain("onClick={openOperationalEditor}");
  expect(app).not.toContain("Edit operational details");
  expect(css).toContain(".reservation-grid {");
  expect(css).toContain("border-radius: 22px;");
  expect(css).toContain(".arrival-resolution-actions");
  expect(css).toContain(".inline-edit-field");
  expect(css).toContain("min-height: 44px;");
  expect(css).toContain("@media (max-width: 760px)");
  expect(css).toContain(".reservation-workspace { padding: 18px 10px 100px; }");
});

test("reservation card opens the existing cashier even before a folio exists", () => {
  expect(app).toContain("Open cashier · in-house billing");
  expect(app).toContain("Open cashier · pre-arrival billing");
  expect(app).toContain("?workspace=finance&reservation=");
  expect(app).toContain("Arrival preparation can open the primary guest window");
  expect(css).toContain(".reservation-cashier-link");
});
