import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const finance = readFileSync("frontend/yellow/src/workspaces/FinanceWorkspace.tsx", "utf8");
const ribbon = readFileSync("frontend/yellow/src/ui/FolioActionRibbon.tsx", "utf8");

test("correction owns the shared synchronous financial lease without exposing deposits", () => {
  const lease = finance.slice(finance.indexOf("const acquireCorrectionLease"), finance.indexOf("const resetAllocationDraft"));
  expect(lease).toContain("correctionLease.current === attemptId");
  expect(lease).toContain("correctionLease.current !== null || !acquireDepositMutationLease()");
  expect(lease).toContain("correctionLease.current !== attemptId");
  expect(lease).toContain("releaseDepositMutationLease()");
  expect(finance).toContain("locked={correctionLease.current !== null}");
  expect(finance).toContain("locked={depositLocked && additionalWindowLease.current === null && correctionLease.current === null}");
  expect(finance).toContain("const depositInteractionLocked = () => depositMutationLease.current || depositLocked");
});

test("active correction is property-bound, names the guest and updates only its verified statement", () => {
  const block = finance.slice(finance.indexOf("<FolioChargeCorrection"), finance.indexOf("</FolioActionRibbon>"));
  for (const code of ["propertyId={propertyId}", "reservationId={selectedReservationId!}", "folioId={folio.data.folio.id}",
    "reservationLabel=", "folioLabel=", "acquireMutationLease={acquireCorrectionLease}", "releaseMutationLease={releaseCorrectionLease}",
    "refreshed.reservationId !== selectedReservationId || refreshed.folio.id !== selectedFolioId",
    'queryClient.setQueryData(["cashier-folio-statement", propertyId, refreshed.folio.id], refreshed)']) expect(block).toContain(code);
  expect(ribbon).toContain('if (title === "Corrections") return "correction"');
  expect(ribbon).toContain("const open = expanded || locked");
});
