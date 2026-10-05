import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "bun:test";
import { FolioChargeCorrectionView } from "../frontend/yellow/src/workspaces/FolioChargeCorrection";
import { correctionReasonLabel, type CorrectionRow, type CorrectionState, type CorrectionStatement } from "../frontend/yellow/src/workspaces/folio-charge-correction";

const original: CorrectionRow = { lineId: "line", journalId: "journal", kind: "charge", businessDate: "2026-09-25",
  description: "Room charge", postedAt: "2026-09-25T12:00:00.000000Z", reversesJournalId: null, reversedByJournalId: null,
  correctionEligible: true, correctionReason: null, quantity: "1.000", amountMinor: "12500", runningBalanceMinor: "12500", txCode: "ROOM",
  transferGroup: { id: "group", memberCount: 1, eligible: true, reason: null, currentWindowId: "folio" } };
const page: CorrectionStatement = { reservationId: "reservation", folio: { id: "folio", reference: "FOL-727", name: "Business", windowNo: 1, status: "open", currency: "USD" },
  siblingWindows: [], balanceMinor: "12500", stayTotalMinor: "12500", generation: "a".repeat(32), lineCount: 51, rows: [original],
  chargeOptions: [], chargeAvailability: { allowed: true, reason: null }, nextCursor: "older" };
const base: CorrectionState = { status: "browsing", page, rows: [original], nextCursor: "older", selected: null, reason: "", message: null };
const actions = { load: async () => {}, select: () => true, setReason: () => {}, review: () => true, edit: () => {}, cancel: () => {}, submit: async () => {} };
const render = (state: CorrectionState, disabled = false) => renderToStaticMarkup(createElement(FolioChargeCorrectionView, {
  state, actions, reservationLabel: "Ada Guest · Y-727", folioLabel: "Business · FOL-727", contextKey: "synthetic", disabled,
}));

test("posted charges expose bounded history and server eligibility before a draft", () => {
  const html = render(base);
  expect(html).toContain("Showing 1 of 51 postings"); expect(html).toContain("Load older postings");
  expect(html).toContain("Review correction"); expect(html).not.toContain("Confirm full reversal");
  expect(html).toContain("does not refund a payment or issue a credit note");
  expect(render({ ...base, rows: [{ ...original, correctionEligible: false, correctionReason: "post_seal_not_authorized" }] })).toContain("supervisor with sealed-day adjustment access");
});

test("named review shows exact signed amount, mandatory reason and explicit confirmation", () => {
  const editing = render({ ...base, status: "editing", selected: original });
  expect(editing).toContain("Reason for charge correction"); expect(editing).toContain('maxLength="500"');
  expect(editing).toContain("Review reversal"); expect(editing).not.toContain("Confirm full reversal");
  const review = render({ ...base, status: "review", selected: original, reason: "Duplicate room charge" });
  for (const content of ["Ada Guest", "Y-727", "Business", "FOL-727", "ROOM", "2026-09-25", "$125.00", "-$125.00", "Duplicate room charge", "Confirm full reversal", "Edit reason", "Cancel"])
    expect(review).toContain(content);
});

test("retained uncertainty has only the exact recovery action and no editable draft", () => {
  const html = render({ ...base, status: "uncertain", selected: original, reason: "Duplicate room charge" }, true);
  expect(html).toContain("Reconcile same correction"); expect(html).toContain('data-lifecycle-recovery="true"');
  expect(html).not.toContain("Edit reason"); expect(html).not.toContain(">Cancel<");
  expect(html).not.toContain("Confirm full reversal"); expect(html).not.toContain("Load older postings");
  expect(html.match(/<button/g)).toHaveLength(1); expect(html).not.toContain('disabled=""');
});

test("server refusal reasons remain specific without offering invented alternatives", () => {
  expect(correctionReasonLabel("charge_routed_from_original_folio")).toContain("original bill window");
  expect(correctionReasonLabel("already_corrected")).toContain("already");
  expect(correctionReasonLabel("future-unknown-reason")).toContain("not authorized");
  expect(render(base, true).match(/disabled=""/g)).toHaveLength(3);
});
