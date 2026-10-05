import { describe, expect, test } from "bun:test";

// Browser assets are intentionally plain ESM.
// @ts-expect-error No declaration file is shipped for the isolated browser module.
import { buildCreditNotePrintArtifact, buildInvoicePrintArtifact } from "../src/http/operator/invoice-print.js";
import { projectIssuedIndiaIrpWireCandidate } from "../src/contexts/tax-fiscal/india-irp-issued-wire-candidate";

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const hash = (value: string) => new Bun.CryptoHasher("sha256").update(value).digest("hex");

function originalInvoice() {
  const contentJson = JSON.stringify({
    Version: "1.1", TranDtls: { TaxSch: "GST", SupTyp: "B2B" },
    DocDtls: { Typ: "INV", No: "INV/2044/17", Dt: "06/09/2044" },
    SellerDtls: { Gstin: "29AAPFU0939F1ZR", LglNm: "Yellow Hotel", Addr1: "1 Main Road", Loc: "Bengaluru", Pin: 560001, Stcd: "29" },
    BuyerDtls: { Gstin: "27AAPFU0939F1ZV", LglNm: "Buyer & Sons", Addr1: "1 Buyer Road", Loc: "Mumbai", Pin: 400001, Stcd: "27", Pos: "27" },
    ItemList: [{ SlNo: "1", IsServc: "Y", HsnCd: "996311", Qty: "1.000", Unit: "OTH", UnitPrice: "100.00", TotAmt: "100.00", AssAmt: "100.00", GstRt: "5.00", IgstAmt: "5.00", TotItemVal: "105.00" }],
    ValDtls: { AssVal: "100.00", IgstVal: "5.00", TotInvVal: "105.00" },
  });
  return Object.freeze({ kind: "india_native_invoice_v1", documentId: uuid(10), propertyNode: uuid(2),
    reservationId: uuid(4), folioId: uuid(5), seriesId: uuid(7), documentNumber: "INV/2044/17",
    businessDate: "2044-09-06", issuedAt: "2044-09-06T10:00:00.000001Z", recipientRegistrationId: uuid(6),
    sourceEvidenceHash: "a".repeat(64), documentSha256: hash(contentJson), previousHash: "b".repeat(64), contentJson });
}

function creditDocument(reason = "Full credit for <strong>duplicate</strong> charge") {
  const original = originalInvoice();
  const receiptBase = { documentId: uuid(20), documentKind: "credit_note", originalDocumentId: original.documentId,
    originalDocNo: original.documentNumber, originalSha256: original.documentSha256, correctionJournalId: uuid(21), seriesId: uuid(22),
    docNo: "CRN/2044/1", propertyNode: original.propertyNode, reservationId: original.reservationId, folioId: original.folioId,
    supplierRegistrationId: uuid(23), recipientRegistrationId: original.recipientRegistrationId, financialYearStart: "2044-04-01",
    currency: "INR", status: "issued", businessDate: "2044-09-07", issuedAt: "2044-09-07T10:00:00.123Z", prevHash: "c".repeat(64),
    sha256: "d".repeat(64), sourceEvidenceHash: "e".repeat(64), totalMinor: "10500", reason };
  const contentJson = JSON.stringify({
    Version: "1.1", TranDtls: { TaxSch: "GST", SupTyp: "B2B" },
    DocDtls: { Typ: "CRN", No: receiptBase.docNo, Dt: "07/09/2044" },
    SellerDtls: { Gstin: "29AAPFU0939F1ZR", LglNm: "Yellow Hotel", Addr1: "1 Main Road", Loc: "Bengaluru", Pin: 560001, Stcd: "29" },
    BuyerDtls: { Gstin: "27AAPFU0939F1ZV", LglNm: "Buyer & Sons", Addr1: "1 Buyer Road", Loc: "Mumbai", Pin: 400001, Stcd: "27", Pos: "27" },
    ItemList: [{ SlNo: "1", IsServc: "Y", HsnCd: "996311", Qty: "1.000", Unit: "OTH", UnitPrice: "100.00", TotAmt: "100.00", AssAmt: "100.00", GstRt: "5.00", IgstAmt: "5.00", TotItemVal: "105.00" }],
    ValDtls: { AssVal: "100.00", IgstVal: "5.00", TotInvVal: "105.00" },
    RefDtls: { PrecDocDtls: [{ InvNo: original.documentNumber, InvDt: "06/09/2044" }] },
    YellowCredit: { originalDocumentId: original.documentId, originalSha256: original.documentSha256,
      reason, correctionJournalId: receiptBase.correctionJournalId, sourceEvidenceHash: receiptBase.sourceEvidenceHash },
  });
  const receipt = Object.freeze({ ...receiptBase, sha256: hash(contentJson) });
  return { original, document: Object.freeze({ kind: "india_native_credit_note_v1", receipt, contentJson }), receipt };
}

function acceptedCreditDelivery(documentId: string, propertyNode: string, documentSha256: string) {
  const signedQr = "e30.e30.YQ";
  return { kind: "receipt", documentId, receipt: { kind: "accepted_signed_v1", submissionId: uuid(30), tenantId: uuid(1),
    propertyNode, documentId, documentSha256, wireSha256: "f".repeat(64), providerKey: "clearirp", attemptId: uuid(31),
    attemptNumber: 1, status: "accepted", disposition: "none", transitionSeq: 1, environment: "production",
    responseSha256: "0".repeat(64), irn: "1".repeat(64), ackNo: "123456", ackDt: "2044-09-07 10:00:00",
    signedInvoice: "e30.e30.YQ", signedQRCode: signedQr, signedInvoiceSha256: hash("e30.e30.YQ"), signedQrSha256: hash(signedQr),
    verification: { profileVersion: "yellow_native_india_1_1_v1", issuer: "synthetic-irp", verificationUnixMs: 2_356_742_400_000,
      invoiceKeyId: "invoice-key", invoiceKeySpkiSha256: "2".repeat(64), invoiceBundleVersion: "fixture-v1",
      qrKeyId: "qr-key", qrKeySpkiSha256: "3".repeat(64), qrBundleVersion: "fixture-v1" } } };
}

describe("Order468 immutable credit-note print artifact", () => {
  test("renders only an exact stored CRN bound to its original invoice", () => {
    const { original, document, receipt } = creditDocument();
    const result = buildCreditNotePrintArtifact(document, { kind: "not_requested", documentId: receipt.documentId }, original);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.title).toBe("Credit note");
    expect(result.value.markup).toContain("Credit note number");
    expect(result.value.markup).toContain("CRN/2044/1");
    expect(result.value.markup).toContain("Original invoice");
    expect(result.value.markup).toContain("INV/2044/17");
    expect(result.value.markup).toContain("Original invoice date");
    expect(result.value.markup).toContain("06/09/2044");
    expect(result.value.markup).toContain("Credit total (INR)");
    expect(result.value.markup).toContain("105.00");
    expect(result.value.markup).toContain("Full credit for &lt;strong&gt;duplicate&lt;/strong&gt; charge");
    expect(result.value.markup).not.toContain("<strong>duplicate</strong>");
    expect(result.value.status.code).toBe("not_requested");
    expect(Object.isFrozen(result.value)).toBe(true);
  });

  test("accepts the actual backend CRN wire fixture and its C1-compatible immutable reason", () => {
    const { original, document, receipt } = creditDocument("C1\u0085metadata remains immutable");
    expect(projectIssuedIndiaIrpWireCandidate({ documentId: receipt.documentId, documentSha256: receipt.sha256,
      contentJson: document.contentJson }).ok).toBe(true);
    const result = buildCreditNotePrintArtifact(document, { kind: "not_requested", documentId: receipt.documentId }, original);
    expect(result).toMatchObject({ ok: true, value: { title: "Credit note" } });
    if (result.ok) expect(result.value.markup).toContain("C1metadata remains immutable");
  });

  test("rejects a CRN whose immutable lineage, reference, total, or envelope diverges", () => {
    const { original, document, receipt } = creditDocument();
    const source = JSON.parse(document.contentJson);
    const variants = [
      { ...document, receipt: { ...receipt, originalSha256: "f".repeat(64) } },
      { ...document, contentJson: JSON.stringify({ ...source, RefDtls: { PrecDocDtls: [{ ...source.RefDtls.PrecDocDtls[0], InvDt: "05/09/2044" }] } }) },
      { ...document, contentJson: JSON.stringify({ ...source, ValDtls: { ...source.ValDtls, TotInvVal: "104.99" } }) },
      { ...document, contentJson: JSON.stringify({ ...source, YellowCredit: { ...source.YellowCredit, reason: "other" } }) },
      { ...document, receipt: { ...receipt, reason: "\ud800" }, contentJson: JSON.stringify({ ...source,
        YellowCredit: { ...source.YellowCredit, reason: "\ud800" } }) },
      { ...document, receipt: { ...receipt, extra: true } },
      { kind: "india_native_credit_note_v1", receipt, contentJson: document.contentJson, extra: true },
    ];
    for (const candidate of variants) {
      expect(buildCreditNotePrintArtifact(candidate, { kind: "not_requested", documentId: receipt.documentId }, original))
        .toMatchObject({ ok: false, error: { code: "invalid_document" } });
    }
  });

  test("rejects hostile envelope accessors and a delivery bound to another document", () => {
    const { original, document, receipt } = creditDocument();
    let reads = 0;
    const hostile = { kind: document.kind, contentJson: document.contentJson };
    Object.defineProperty(hostile, "receipt", { enumerable: true, get() { reads += 1; return receipt; } });
    expect(buildCreditNotePrintArtifact(hostile, { kind: "not_requested", documentId: receipt.documentId }, original))
      .toMatchObject({ ok: false, error: { code: "invalid_document" } });
    expect(reads).toBe(0);
    expect(buildCreditNotePrintArtifact(document, { kind: "not_requested", documentId: uuid(99) }, original))
      .toMatchObject({ ok: false, error: { code: "invalid_delivery" } });
  });

  test("rejects backend-invalid CRN UUID variants and non-positive or overflowing receipt totals", () => {
    const { original, document, receipt } = creditDocument();
    for (const changed of [
      { documentId: "00000000-0000-0000-0000-000000000020" },
      { correctionJournalId: "00000000-0000-9000-8000-000000000021" },
      { propertyNode: "00000000-0000-4000-7000-000000000002" },
      { totalMinor: "0" }, { totalMinor: "-10500" }, { totalMinor: "9223372036854775808" },
    ]) {
      expect(buildCreditNotePrintArtifact({ ...document, receipt: { ...receipt, ...changed } },
        { kind: "not_requested", documentId: receipt.documentId }, original)).toMatchObject({ ok: false, error: { code: "invalid_document" } });
    }
  });

  test("rejects every original binding and source lineage divergence before rendering", () => {
    const { original, document, receipt } = creditDocument();
    const source = JSON.parse(document.contentJson);
    const receiptVariants = [
      { originalDocumentId: uuid(90) }, { originalDocNo: "INV/OTHER" }, { propertyNode: uuid(91) },
      { reservationId: uuid(92) }, { folioId: uuid(93) }, { recipientRegistrationId: uuid(94) },
      { businessDate: "2044-09-08" },
    ];
    for (const changed of receiptVariants) {
      expect(buildCreditNotePrintArtifact({ ...document, receipt: { ...receipt, ...changed } },
        { kind: "not_requested", documentId: receipt.documentId }, original)).toMatchObject({ ok: false, error: { code: "invalid_document" } });
    }
    for (const changed of [
      { correctionJournalId: uuid(95) }, { sourceEvidenceHash: "9".repeat(64) }, { originalDocumentId: uuid(96) },
    ]) {
      const contentJson = JSON.stringify({ ...source, YellowCredit: { ...source.YellowCredit, ...changed } });
      const candidate = { ...document, receipt: { ...receipt, sha256: hash(contentJson) }, contentJson };
      expect(buildCreditNotePrintArtifact(candidate, { kind: "not_requested", documentId: receipt.documentId }, original))
        .toMatchObject({ ok: false, error: { code: "invalid_document" } });
    }
  });

  test("keeps bounded source and scalar limits and accepts the persisted split-GST form", () => {
    const { original, document, receipt } = creditDocument();
    expect(buildCreditNotePrintArtifact({ ...document, contentJson: "x".repeat(1024 * 1024 + 1) },
      { kind: "not_requested", documentId: receipt.documentId }, original)).toMatchObject({ ok: false, error: { code: "invalid_document" } });
    const overlong = "x".repeat(501);
    const source = JSON.parse(document.contentJson);
    const longContent = JSON.stringify({ ...source, YellowCredit: { ...source.YellowCredit, reason: overlong } });
    expect(buildCreditNotePrintArtifact({ ...document, receipt: { ...receipt, reason: overlong, sha256: hash(longContent) }, contentJson: longContent },
      { kind: "not_requested", documentId: receipt.documentId }, original)).toMatchObject({ ok: false, error: { code: "invalid_document" } });
    const { IgstAmt: _igst, ...item } = source.ItemList[0];
    const { IgstVal: _totalIgst, ...totals } = source.ValDtls;
    const splitContent = JSON.stringify({ ...source, ItemList: [{ ...item, CgstAmt: "2.50", SgstAmt: "2.50" }],
      ValDtls: { ...totals, CgstVal: "2.50", SgstVal: "2.50" } });
    const split = buildCreditNotePrintArtifact({ ...document, receipt: { ...receipt, sha256: hash(splitContent) }, contentJson: splitContent },
      { kind: "not_requested", documentId: receipt.documentId }, original);
    expect(split).toMatchObject({ ok: true, value: { title: "Credit note" } });
    if (split.ok) expect(split.value.markup).toContain("<th>CGST</th><th>SGST</th>");
  });

  test("uses the existing delivery and QR rules without treating a credit note as an invoice", () => {
    const { original, document, receipt } = creditDocument();
    const result = buildCreditNotePrintArtifact(document,
      acceptedCreditDelivery(receipt.documentId, receipt.propertyNode, receipt.sha256), original);
    expect(result).toMatchObject({ ok: true, value: { title: "Credit note", status: { code: "accepted_production" } } });
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.markup).toContain("IRP registered");
    expect(result.value.markup).toContain("issued credit note");
    expect(result.value.markup).not.toContain("Tax invoice");
    expect(result.value.qr?.svg).toContain('shape-rendering="crispEdges"');
  });

  test("retains honest sandbox, pending, cancelled, ambiguous, and QR-limit delivery outcomes", () => {
    const { original, document, receipt } = creditDocument();
    const accepted = acceptedCreditDelivery(receipt.documentId, receipt.propertyNode, receipt.sha256);
    const pending = { kind: "receipt", documentId: receipt.documentId, receipt: { kind: "pending", submissionId: uuid(30), tenantId: uuid(1),
      propertyNode: receipt.propertyNode, documentId: receipt.documentId, documentSha256: receipt.sha256, wireSha256: "f".repeat(64),
      providerKey: "clearirp", attemptId: uuid(31), attemptNumber: 1, status: "submitted", disposition: "lookup", transitionSeq: 1 } };
    const cancelled = { kind: "receipt", documentId: receipt.documentId, receipt: { kind: "provider_cancelled", submissionId: uuid(30), tenantId: uuid(1),
      propertyNode: receipt.propertyNode, documentId: receipt.documentId, documentSha256: receipt.sha256, wireSha256: "f".repeat(64),
      providerKey: "clearirp", attemptId: uuid(31), attemptNumber: 1, status: "error", disposition: "none", transitionSeq: 1,
      environment: "production", responseSha256: "0".repeat(64), providerStatus: "CNL" } };
    const cases = [
      [{ ...accepted, receipt: { ...accepted.receipt, environment: "sandbox" } }, "SANDBOX — not a production registration"],
      [pending, "Registration pending"], [cancelled, "Registration cancelled by provider — not registered"],
      [{ kind: "ambiguous", documentId: receipt.documentId }, "Registration status is ambiguous"],
    ] as const;
    for (const [delivery, label] of cases) {
      const result = buildCreditNotePrintArtifact(document, delivery, original);
      expect(result).toMatchObject({ ok: true });
      if (result.ok) expect(result.value.markup).toContain(label);
    }
    const oversized = `${"a".repeat(1475)}.a.${"a".repeat(1476)}`;
    const tooLarge = buildCreditNotePrintArtifact(document, { ...accepted, receipt: { ...accepted.receipt,
      signedQRCode: oversized, signedQrSha256: hash(oversized) } }, original);
    expect(tooLarge).toMatchObject({ ok: false, error: { code: "qr_capacity_exceeded" } });
  });

  test("keeps the established INV renderer on its original accepted path", () => {
    const original = originalInvoice();
    const result = buildInvoicePrintArtifact(original, { kind: "not_requested", documentId: original.documentId });
    expect(result).toMatchObject({ ok: true, value: { title: "Tax invoice" } });
    if (result.ok) expect(result.value.markup).toContain("Invoice total (INR)");
  });
});
