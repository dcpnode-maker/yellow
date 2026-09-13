import { expect, test } from "bun:test";
// @ts-expect-error Browser asset deliberately ships without declarations.
import { creditNoteProviderRequestPresentation, creditNoteProviderRequestSnapshot } from "../src/http/operator/invoices.js";

const id = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
const original = Object.freeze({
  kind: "india_native_invoice_v1", documentId: id(10), propertyNode: id(2), reservationId: id(4), folioId: id(5),
  seriesId: id(7), documentNumber: "INV/2044/17", businessDate: "2044-09-06", issuedAt: "2044-09-06T10:00:00.000001Z",
  recipientRegistrationId: id(6), sourceEvidenceHash: "a".repeat(64), documentSha256: "b".repeat(64), previousHash: null,
  contentJson: "{}",
});
const receipt = Object.freeze({
  documentId: id(20), documentKind: "credit_note", originalDocumentId: original.documentId,
  originalDocNo: original.documentNumber, originalSha256: original.documentSha256, correctionJournalId: id(30), seriesId: id(31),
  docNo: "CRN/2044/1", propertyNode: original.propertyNode, reservationId: original.reservationId, folioId: original.folioId,
  supplierRegistrationId: id(8), recipientRegistrationId: original.recipientRegistrationId, financialYearStart: "2044-04-01",
  currency: "INR", status: "issued", businessDate: "2044-09-07", issuedAt: "2044-09-07T11:12:13.000Z",
  prevHash: null, sha256: "c".repeat(64), sourceEvidenceHash: "d".repeat(64), totalMinor: "10500", reason: "Credit \ud83c\udfe8",
});
const provider = Object.freeze({
  providerExtensionId: id(40), providerExtensionVersion: 7, providerKey: "india-irp", label: "India IRP", environment: "sandbox",
});
const key = "fiscal-registration-00000000-0000-4000-8000-000000000099";

test("Order471 snapshots one immutable issued credit, offered provider, and visible-ASCII request identity", () => {
  const snapshot = creditNoteProviderRequestSnapshot(receipt, original, provider, key);
  expect(snapshot).toEqual({
    original: { documentId: original.documentId, propertyNode: original.propertyNode, reservationId: original.reservationId,
      folioId: original.folioId, recipientRegistrationId: original.recipientRegistrationId, documentSha256: original.documentSha256,
      documentNumber: original.documentNumber, businessDate: original.businessDate },
    credit: { documentId: receipt.documentId, docNo: receipt.docNo, sha256: receipt.sha256 },
    provider, idempotencyKey: key,
  });
  expect(Object.isFrozen(snapshot)).toBe(true);
  expect(Object.isFrozen(snapshot?.original)).toBe(true);
  expect(Object.isFrozen(snapshot?.credit)).toBe(true);
  expect(Object.isFrozen(snapshot?.provider)).toBe(true);
});

test("Order471 rejects unbound credit receipts, non-offered provider shapes, and nonvisible request keys", () => {
  expect(creditNoteProviderRequestSnapshot({ ...receipt, originalSha256: "e".repeat(64) }, original, provider, key)).toBeNull();
  expect(creditNoteProviderRequestSnapshot(receipt, original, { ...provider, providerExtensionVersion: 0 }, key)).toBeNull();
  expect(creditNoteProviderRequestSnapshot(receipt, original, { ...provider, label: "x\u0000" }, key)).toBeNull();
  expect(creditNoteProviderRequestSnapshot(receipt, original, { ...provider, extra: true }, key)).toBeNull();
  for (const invalid of ["short", "x".repeat(201), "fiscal registration 000000", "fiscal-registration-\u0085-000000"]) {
    expect(creditNoteProviderRequestSnapshot(receipt, original, provider, invalid)).toBeNull();
  }
});

test("Order471 rejects accessor-bearing command inputs before reading their fields", () => {
  let reads = 0;
  const hostile = { ...provider };
  Object.defineProperty(hostile, "providerKey", { enumerable: true, get: () => { reads += 1; return provider.providerKey; } });
  expect(creditNoteProviderRequestSnapshot(receipt, original, hostile, key)).toBeNull();
  expect(reads).toBe(0);
});

test("Order471 presents a settled accepted credit request before an obsolete in-flight flag", () => {
  expect(creditNoteProviderRequestPresentation("succeeded", true)).toBe("succeeded");
  expect(creditNoteProviderRequestPresentation("unknown", true)).toBe("in_flight");
  expect(creditNoteProviderRequestPresentation("unknown", false)).toBe("unknown");
  expect(creditNoteProviderRequestPresentation("ready", false)).toBeNull();
});
