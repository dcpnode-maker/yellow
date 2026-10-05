import { describe, expect, test } from "bun:test";
// @ts-expect-error Browser asset deliberately ships without declarations.
import { creditNoteDocumentEnvelope } from "../src/http/operator/invoices.js";

const source = await Bun.file(new URL("../src/http/operator/invoices.js", import.meta.url)).text();
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const hash = (c: string) => c.repeat(64);
const original = Object.freeze({ documentId: id(1), documentNumber: "I/2044/17", documentSha256: hash("a"),
  propertyNode: id(2), reservationId: id(3), folioId: id(4), recipientRegistrationId: id(5) });
const receipt = Object.freeze({ documentId: id(6), documentKind: "credit_note", originalDocumentId: id(1),
  originalDocNo: "I/2044/17", originalSha256: hash("a"), correctionJournalId: id(7), seriesId: id(8),
  docNo: "C/2044/18", propertyNode: id(2), reservationId: id(3), folioId: id(4), supplierRegistrationId: id(9),
  recipientRegistrationId: id(5), financialYearStart: "2044-04-01", currency: "INR", status: "issued",
  businessDate: "2044-09-07", issuedAt: "2044-09-07T08:09:10.123Z", prevHash: null,
  sha256: hash("b"), sourceEvidenceHash: hash("c"), totalMinor: "11800", reason: "Full cancellation" });
const discovery = Object.freeze({ ...receipt });

describe("Order468 credit-note preview and print workflow", () => {
  test("offers deliberate, credit-specific actions without loading complete content during discovery", () => {
    expect(source).toContain("Preview credit note");
    expect(source).toContain("Print credit note");
    expect(source).toContain("/credit-notes/${encodeURIComponent(discovery.documentId)}/document");
    expect(source).toContain("/credit-notes/${encodeURIComponent(discovery.documentId)}/delivery");
    expect(source).toContain("module.buildCreditNotePrintArtifact(documentValue, delivery, original)");
    const discovery = source.indexOf("/invoices/${encodeURIComponent(original.documentId)}/credit-notes");
    const complete = source.indexOf("/credit-notes/${encodeURIComponent(discovery.documentId)}/document");
    expect(discovery).toBeGreaterThanOrEqual(0);
    expect(complete).toBeGreaterThan(discovery);
  });

  test("accepts only an exact backend document envelope bound to the displayed discovery", () => {
    const valid = { kind: "india_native_credit_note_v1", receipt, contentJson: "{\"DocDtls\":{}}" };
    expect(creditNoteDocumentEnvelope(valid, discovery, original)).toMatchObject({ kind: valid.kind, contentJson: valid.contentJson });
    for (const candidate of [
      { ...valid, kind: "credit_note" }, { ...valid, contentJson: "" },
      { ...valid, receipt: { ...receipt, totalMinor: "11801" } },
      { ...valid, receipt: { ...receipt, reason: "Other" } },
      { ...valid, receipt: { ...receipt, issuedAt: "2044-09-07T08:09:10.124Z" } },
      { ...valid, receipt: { ...receipt, propertyNode: id(99) } },
    ]) expect(creditNoteDocumentEnvelope(candidate, discovery, original)).toBeNull();
    let reads = 0;
    const hostile = { ...receipt };
    Object.defineProperty(hostile, "reason", { enumerable: true, get: () => { reads += 1; return receipt.reason; } });
    expect(creditNoteDocumentEnvelope({ ...valid, receipt: hostile }, discovery, original)).toBeNull();
    expect(reads).toBe(0);
  });

  test("binds the fresh document to discovery and original identity before delivery/renderer", () => {
    const binding = source.indexOf("creditNoteDocumentEnvelope(rawDocument, discovery, original)");
    const delivery = source.indexOf("const rawDelivery = await request(", binding);
    const renderer = source.indexOf("buildCreditNotePrintArtifact(documentValue, delivery, original)", binding);
    expect(binding).toBeGreaterThanOrEqual(0);
    expect(delivery).toBeGreaterThan(binding);
    expect(renderer).toBeGreaterThan(delivery);
    expect(source).toContain("bound.documentId !== discovery.documentId");
    expect(source).toContain("bound.sha256 !== discovery.sha256");
    expect(source).toContain("You do not have permission to refresh this credit note for printing.");
    expect(source).toContain("This credit note is no longer available for printing.");
    expect(source).toContain("The refreshed credit-note document is invalid and cannot be printed.");
    expect(source).toContain("The refreshed credit-note registration data is invalid and cannot be printed.");
    expect(source).toContain("The credit note’s signed QR data is too large to print safely.");
    expect(source).toContain("invoice-workbench__credit-note-print-status");
    expect(source).toContain('if (previewButton.disabled || !isActive()) return;\n    message.textContent = "";');
  });

  test("guards the iframe frame boundary against stale lifecycle state", () => {
    const frame = source.indexOf("async function printInFrame(artifact, isActive)");
    const boundary = source.indexOf("await new Promise((resolve) => requestAnimationFrame", frame);
    const print = source.indexOf("frame.contentWindow.focus(); frame.contentWindow.print();", boundary);
    expect(frame).toBeGreaterThanOrEqual(0);
    expect(boundary).toBeGreaterThan(frame);
    expect(print).toBeGreaterThan(boundary);
    expect(source.slice(boundary, print)).toContain("!isActive()");
  });
});
