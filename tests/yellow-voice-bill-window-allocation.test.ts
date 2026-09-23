import { expect, test } from "bun:test";
import {
  folioBillWindowTransferIntent,
  hasFolioBillWindowPartialSplitIntent,
} from "../frontend/yellow/src/voice";

const app = await Bun.file("frontend/yellow/src/App.tsx").text();
const css = await Bun.file("frontend/yellow/src/styles.css").text();

Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: { location: { pathname: "/p/6081b544-22a1-534f-a86d-bb1ae0519e14/today", search: "" } },
});
// @ts-expect-error The root checker intentionally excludes JSX; Bun executes this focused runtime import.
const { resolveVoiceTransferSource } = await import("../frontend/yellow/src/App.tsx");

const sourceFolioId = "11111111-1111-4111-8111-111111111111";
const destinationFolioId = "22222222-2222-4222-8222-222222222222";
const transferGroupId = "33333333-3333-4333-8333-333333333333";

function sourceStatement(folioId: string, currentWindowId: string, eligible = true) {
  return {
    reservationId: "44444444-4444-4444-8444-444444444444",
    folio: { id: folioId, reference: null, name: null, windowNo: folioId === sourceFolioId ? 1 : 2, status: "open", currency: "SAR" },
    siblingWindows: [
      { id: sourceFolioId, reference: null, name: "Main", windowNo: 1, status: "open", balanceMinor: "12000" },
      { id: destinationFolioId, reference: null, name: "Personal", windowNo: 2, status: "open", balanceMinor: "0" },
    ],
    balanceMinor: folioId === sourceFolioId ? "12000" : "0",
    stayTotalMinor: "12000",
    generation: "generation-1",
    rows: [{ description: "Laundry", txCode: "LAUNDRY", transferGroup: { id: transferGroupId, eligible, currentWindowId } }],
  } as never;
}

test("accepts only an explicit whole-charge move with one named destination", () => {
  expect(folioBillWindowTransferIntent("Move Laundry for Omar Siddiqui to window 2")).toEqual({
    chargeQuery: "Laundry",
    guestQuery: "Omar Siddiqui",
    destination: { kind: "existing", windowNo: 2 },
  });
  expect(folioBillWindowTransferIntent("Move Laundry for Omar Siddiqui to a new bill called Personal")).toEqual({
    chargeQuery: "Laundry",
    guestQuery: "Omar Siddiqui",
    destination: { kind: "new", name: "Personal" },
  });
  for (const unsafe of [
    "Move Laundry for Omar Siddiqui",
    "Move Laundry for Omar Siddiqui to window 0",
    "Move Laundry for Omar Siddiqui to a new bill",
    "Move Laundry for Omar Siddiqui to window 2 and charge it twice",
  ]) expect(folioBillWindowTransferIntent(unsafe)).toBeNull();
});

test("refuses partial amounts, percentages, and quantities instead of reinterpreting them", () => {
  for (const partial of [
    "Move half Laundry for Omar Siddiqui to window 2",
    "Move 50 percent Laundry for Omar Siddiqui to window 2",
    "Move 50% Laundry for Omar Siddiqui to window 2",
    "Transfer Laundry for Omar Siddiqui to window 2 quantity 1",
    "Move Laundry for Omar Siddiqui to window 2 SAR 20",
    "Move Laundry for Omar Siddiqui to a new bill called Personal 50%",
    "Move Laundry for Omar Siddiqui to a new bill called Personal 50%.",
    "Move Laundry for Omar Siddiqui to a new bill called Personal 50%!",
  ]) {
    expect(hasFolioBillWindowPartialSplitIntent(partial)).toBeTrue();
    expect(folioBillWindowTransferIntent(partial)).toBeNull();
  }
});

test("resolves one complete-group source across coherent sibling open windows", () => {
  const source = sourceStatement(sourceFolioId, sourceFolioId);
  const destination = sourceStatement(destinationFolioId, destinationFolioId, false);
  const resolved = resolveVoiceTransferSource([source, destination], "Laundry", { kind: "existing", windowNo: 2 });
  expect(resolved.kind).toBe("resolved");
  if (resolved.kind === "resolved") {
    expect(resolved.statement.folio.id).toBe(sourceFolioId);
    expect(resolved.destinationWindow?.id).toBe(destinationFolioId);
  }
  const ambiguous = resolveVoiceTransferSource([
    sourceStatement(sourceFolioId, sourceFolioId),
    sourceStatement(destinationFolioId, destinationFolioId),
  ], "Laundry", { kind: "new", name: "Personal" });
  expect(ambiguous).toEqual({ kind: "ambiguous" });

  const multiplyMatchingSource = sourceStatement(sourceFolioId, sourceFolioId) as {
    rows: Array<{ description: string; txCode: string; transferGroup: { id: string; eligible: boolean; currentWindowId: string } }>;
  };
  multiplyMatchingSource.rows.push({
    description: "Laundry",
    txCode: "LAUNDRY-SECOND",
    transferGroup: {
      id: "55555555-5555-4555-8555-555555555555",
      eligible: true,
      currentWindowId: sourceFolioId,
    },
  });
  // A second window has one exact match too. The resolver must refuse the
  // whole family rather than skipping the ambiguous first window.
  expect(resolveVoiceTransferSource([
    multiplyMatchingSource as never,
    sourceStatement(destinationFolioId, destinationFolioId),
  ], "Laundry", { kind: "new", name: "Personal" })).toEqual({ kind: "ambiguous" });
});

test("the voice path resolves only server truth then reuses the governed transfer lifecycle", () => {
  expect(app).toContain("const billWindowInstruction = folioBillWindowTransferIntent(message);");
  expect(app).toContain("function resolveVoiceTransferGroup(");
  expect(app).toContain("group.eligible || group.currentWindowId !== statement.folio.id");
  expect(app).toContain("requestFolioTransferPreview(initialDraft)");
  expect(app).toContain("resolveVoiceTransferSource(");
  expect(app).toContain("const sourceStatements = await Promise.all(openFolios.map");
  expect(app).toContain("previewMatchesFolioTransferDraft(preview, initialDraft");
  expect(app).toContain("Say yes to submit this exact preview, or no to cancel.");
  expect(app).toContain("sameTransferPreview(freshPreview, proposal.preview)");
  expect(app).toContain("submitFolioTransfer(retained.draft, retained.key)");
  expect(app).toContain("receiptMatchesVoiceTransfer(receipt, retained)");
  expect(app).toContain("sourceStatement.balanceMinor === receipt.sourceAfterMinor");
  expect(app).toContain("destinationStatement.balanceMinor === receipt.destinationAfterMinor");
  expect(app).toContain("The transfer outcome is uncertain. Yellow retained the exact draft, body, and idempotency key.");
  expect(app).toContain("A complete bill-window transfer still needs same-key reconciliation.");
  expect(app).toContain("voiceTransferRecoveryLockedRef.current");
  expect(app).toContain('data-lifecycle-recovery={voiceTransferRecoveryLocked ? "true" : undefined}');
  expect(app).toContain("Say yes to retry the exact same operation, or cancel to keep it locked");
  expect(app).toContain("const candidateReceipt = await submitFolioTransfer(retained.draft, retained.key);");
  expect(app).toContain("if (!receiptMatchesVoiceTransfer(candidateReceipt, retained))");
  expect(app).toContain("receipt = candidateReceipt;");
  expect(app).not.toContain("amountMinor: billWindowInstruction");
  expect(app).not.toContain("quantity: billWindowInstruction");
});

test("the contained Yellow operation card keeps live financial progress readable on phone and desktop", () => {
  expect(app).toContain("CONFIRM COMPLETE CHARGE TRANSFER");
  expect(app).toContain("Before ${moneyExactMinor(preview.sourceBeforeMinor, preview.currency)} · after");
  expect(app).toContain("Conserved across both bill windows · audit reason: ${proposal.draft.reason}");
  expect(css).toContain(".yellow-live-result");
  expect(css).toContain("@media (max-width: 480px)");
});
