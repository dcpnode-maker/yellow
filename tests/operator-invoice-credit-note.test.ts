import { expect, test } from "bun:test";
// @ts-expect-error Browser asset has no TypeScript declaration.
import { creditNoteDisclosureEnvelope } from "../src/http/operator/invoices.js";
// @ts-expect-error Browser asset has no TypeScript declaration.
import { fiscalDeliveryRegistrationStatus } from "../src/http/operator/invoice-print.js";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const original = { documentId: id(1), documentNumber: "I/4445/17", documentSha256: "a".repeat(64), propertyNode: id(2), reservationId: id(3), folioId: id(4), recipientRegistrationId: id(5) };
const receipt = { documentId: id(6), documentKind: "credit_note", originalDocumentId: id(1), originalDocNo: "I/4445/17", originalSha256: "a".repeat(64), correctionJournalId: id(7), seriesId: id(8), docNo: "C/4445/18", propertyNode: id(2), reservationId: id(3), folioId: id(4), supplierRegistrationId: id(9), recipientRegistrationId: id(5), financialYearStart: "2044-04-01", currency: "INR", status: "issued", businessDate: "2044-09-07", issuedAt: "2044-09-07T08:09:10.123Z", prevHash: null, sha256: "b".repeat(64), sourceEvidenceHash: "c".repeat(64), totalMinor: "11800", reason: "Full cancellation" };

test("Order466 accepts only original-linked immutable full-credit receipt summaries", () => {
  expect(creditNoteDisclosureEnvelope(receipt, original)).toMatchObject({ documentId: id(6), totalMinor: "11800" });
  expect(creditNoteDisclosureEnvelope({ ...receipt, originalDocumentId: id(99) }, original)).toBeNull();
  expect(creditNoteDisclosureEnvelope({ ...receipt, totalMinor: "0" }, original)).toBeNull();
  expect(creditNoteDisclosureEnvelope({ ...receipt, reason: "x\u0000" }, original)).toBeNull();
  expect(creditNoteDisclosureEnvelope({ ...receipt, reason: "x".repeat(501) }, original)).toBeNull();
  for (const hostile of [{ ...receipt, businessDate: 7 }, { ...receipt, issuedAt: "2044-02-30T08:09:10.123Z" },
    { ...receipt, totalMinor: "9223372036854775808" }, { ...receipt, financialYearStart: "2044-05-01" },
    { ...receipt, supplierRegistrationId: id(5) }, { ...receipt, documentId: id(1) },
    { ...receipt, reason: "\ud800" }, { ...receipt, extra: true }]) expect(creditNoteDisclosureEnvelope(hostile, original)).toBeNull();
  expect(creditNoteDisclosureEnvelope({ ...receipt, businessDate: "2044-03-31", financialYearStart: "2043-04-01", reason: "Credit 😀" }, original)?.reason).toBe("Credit 😀");
});

test("Order466 uses the shared delivery facade without exposing fiscal payloads", () => {
  const identity = { documentId: id(6), propertyNode: id(2), documentSha256: "b".repeat(64) };
  const pending = { kind: "not_requested", documentId: id(6) };
  expect(fiscalDeliveryRegistrationStatus(identity, pending)).toEqual({ code: "not_requested", label: "Not registered — registration not requested" });
  expect(fiscalDeliveryRegistrationStatus({ ...identity, documentId: id(1) }, pending)).toBeNull();
  expect(fiscalDeliveryRegistrationStatus(identity, { kind: "receipt", receipt: { signedInvoice: "secret" } })).toBeNull();
});
