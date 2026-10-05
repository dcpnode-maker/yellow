import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

// Wiring guards complement the executable isolated command and component tests.
// No hotel database is mutated by this file.
const source = readFileSync("frontend/yellow/src/workspaces/FinanceWorkspace.tsx", "utf8");

test("additional window is mounted beside bill windows, not behind charge routing", () => {
  const start = source.indexOf('<AdditionalFolioWindow');
  const end = source.indexOf('/> : null}', start);
  const action = source.slice(start, end);
  expect(start).toBeGreaterThan(source.indexOf('aria-label="Bill windows"'));
  expect(start).toBeLessThan(source.indexOf('className="folio-statement-heading"'));
  for (const prop of [
    'propertyId={propertyId}', 'sourceFolioId={selectedBillingWindow.folioId}',
    'sourceFolioReference={selectedBillingWindow.folioNo}', 'getToken={session}',
    'reservationLabel={visibleReservationDetail.reservation.confirmationNo}',
    'loadReservation={loadReservation}', 'loadFolioStatement={loadFolioStatement}',
    'acquireMutationLease={acquireAdditionalWindowLease}',
    'releaseMutationLease={releaseAdditionalWindowLease}', 'onCreated={enterAdditionalBillingWindow}',
  ]) expect(action).toContain(prop);
  expect(action).toContain('disabled={financialNavigationLocked || reservationDetailRefreshUnavailable || selectedBillingWindow.status !== "open"}');
  expect(action).not.toContain('allocationGroupIds');
});

test("retained window attempt shares synchronous navigation and financial lock", () => {
  const leases = source.slice(source.indexOf('const acquireAdditionalWindowLease'), source.indexOf('const resetAllocationDraft'));
  expect(leases).toContain('additionalWindowLease.current === attemptId');
  expect(leases).toContain('additionalWindowLease.current !== null || !acquireDepositMutationLease()');
  expect(leases).toContain('additionalWindowLease.current !== attemptId');
  expect(leases).toContain('releaseDepositMutationLease()');
  expect(source).toContain('depositMutationLease.current = true');
  expect(source).toContain('const depositInteractionLocked = () => depositMutationLease.current || depositLocked');
  expect(source).toContain('allocationLocked || depositLocked');
});

test("only exact readback updates selected reservation and statement caches", () => {
  const callback = source.slice(source.indexOf('const enterAdditionalBillingWindow'), source.indexOf('const selectedBillingWindow'));
  expect(callback).toContain('fresh.reservation.reservationId !== selectedReservationId');
  expect(callback).toContain('statement.reservationId !== selectedReservationId');
  expect(callback).toContain('statement.folio.id !== folioId');
  expect(callback).toContain('window.folioId === folioId');
  expect(callback).toContain('queryClient.setQueryData(["cashier-reservation", propertyId, selectedReservationId], fresh)');
  expect(callback).toContain('queryClient.setQueryData(["cashier-folio-statement", propertyId, folioId], statement)');
  expect(callback).toContain('enterOpenedPrimaryBillingWindow(fresh, folioId)');
});
