import { expect, test } from "bun:test";
// @ts-expect-error Browser asset deliberately ships without declarations.
import { creditNoteDisclosureEnvelope, creditNoteIssueReason, creditNoteIssueSnapshot } from "../src/http/operator/invoices.js";

const id = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
const original = Object.freeze({
  kind: "india_native_invoice_v1", documentId: id(10), propertyNode: id(2), reservationId: id(4), folioId: id(5),
  seriesId: id(7), documentNumber: "INV/2044/17", businessDate: "2044-09-06", issuedAt: "2044-09-06T10:00:00.000001Z",
  recipientRegistrationId: id(6), sourceEvidenceHash: "a".repeat(64), documentSha256: "b".repeat(64), previousHash: null,
  contentJson: "{}",
});
const reason = " Full cancellation C1\u0085 and supplementary 🏨 ";
const receipt = (value = reason) => ({
  documentId: id(20), documentKind: "credit_note", originalDocumentId: original.documentId,
  originalDocNo: original.documentNumber, originalSha256: original.documentSha256, correctionJournalId: id(30), seriesId: id(31),
  docNo: "CRN/2044/1", propertyNode: original.propertyNode, reservationId: original.reservationId, folioId: original.folioId,
  supplierRegistrationId: id(8), recipientRegistrationId: original.recipientRegistrationId, financialYearStart: "2044-04-01",
  currency: "INR", status: "issued", businessDate: "2044-09-07", issuedAt: "2044-09-07T11:12:13.000Z",
  prevHash: null, sha256: "c".repeat(64), sourceEvidenceHash: "d".repeat(64), totalMinor: "10500", reason: value,
});

test("Order470 keeps the exact server-compatible credit reason bytes and scalar bounds", () => {
  expect(creditNoteIssueReason(reason)).toBe(reason);
  expect(creditNoteIssueReason("\u0085C1 remains valid")).toBe("\u0085C1 remains valid");
  expect(creditNoteIssueReason("x".repeat(500))).toBe("x".repeat(500));
  expect(creditNoteIssueReason("🏨".repeat(500))).toBe("🏨".repeat(500));
  for (const invalid of ["", " \u00a0\u2003 ", "\u0000x", "x\u001f", "x\u007f", "\ud800", "\udc00", "x".repeat(501), "🏨".repeat(501)]) {
    expect(creditNoteIssueReason(invalid)).toBeNull();
  }
});

test("Order470 snapshots only one strict original, reason and visible-ASCII request key", () => {
  const key = "credit-note-00000000-0000-4000-8000-000000000099";
  const snapshot = creditNoteIssueSnapshot(original, reason, key);
  expect(snapshot).toEqual({
    original: { documentId: original.documentId, propertyNode: original.propertyNode, reservationId: original.reservationId,
      folioId: original.folioId, recipientRegistrationId: original.recipientRegistrationId, documentSha256: original.documentSha256,
      documentNumber: original.documentNumber, businessDate: original.businessDate }, reason, idempotencyKey: key,
  });
  expect(Object.isFrozen(snapshot)).toBe(true); expect(Object.isFrozen(snapshot?.original)).toBe(true);
  for (const invalid of ["short", "x".repeat(201), "credit note 000000", "credit-note-\u0085-000000"]) {
    expect(creditNoteIssueSnapshot(original, reason, invalid)).toBeNull();
  }
  let reads = 0;
  const hostile = { ...original };
  Object.defineProperty(hostile, "documentId", { enumerable: true, get: () => { reads += 1; return original.documentId; } });
  expect(creditNoteIssueSnapshot(hostile, reason, key)).toBeNull(); expect(reads).toBe(0);
  expect(creditNoteIssueSnapshot({ ...original, documentId: "00000000-0000-0000-8000-000000000010" }, reason, key)).toBeNull();
});

test("Order470 accepts only a submitted-reason receipt bound to the immutable original", () => {
  const parsed = creditNoteDisclosureEnvelope(receipt(), original);
  expect(parsed).toMatchObject({ documentId: id(20), docNo: "CRN/2044/1", reason, totalMinor: "10500" });
  expect(parsed?.reason).toBe(reason);
  expect(creditNoteDisclosureEnvelope(receipt("Different reason"), original)?.reason === reason).toBe(false);
  expect(creditNoteDisclosureEnvelope({ ...receipt(), originalDocumentId: id(99) }, original)).toBeNull();
  expect(creditNoteDisclosureEnvelope({ ...receipt(), totalMinor: "0" }, original)).toBeNull();
  expect(creditNoteDisclosureEnvelope({ ...receipt(), extra: true }, original)).toBeNull();
});
