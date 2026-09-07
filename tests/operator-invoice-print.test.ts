import { describe, expect, test } from "bun:test";

// Browser assets are deliberately plain ESM and are not part of the TypeScript compilation unit.
// @ts-expect-error No declaration file is shipped for the isolated browser module.
import { INVOICE_PRINT_QR_LIMITS, INVOICE_PRINT_STYLES, buildInvoicePrintArtifact, createSignedQrArtifact } from "../src/http/operator/invoice-print.js";

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const sha = (value: string) => new Bun.CryptoHasher("sha256").update(value).digest("hex");

function invoice() {
  const content = {
    Version: "1.1",
    TranDtls: { TaxSch: "GST", SupTyp: "B2B" },
    DocDtls: { Typ: "INV", No: "INV/2044/17", Dt: "06/09/2044" },
    SellerDtls: {
      Gstin: "29AAPFU0939F1ZR", LglNm: "Yellow <script>alert(1)</script> & Co",
      TrdNm: "Yellow's Hotel", Addr1: "1 Main Road", Loc: "Bengaluru", Pin: 560001, Stcd: "29",
    },
    BuyerDtls: {
      Gstin: "27AAPFU0939F1ZV", LglNm: "Buyer <img src=x onerror=alert(1)>",
      Addr1: "1 Buyer Road", Loc: "Mumbai", Pin: 400001, Stcd: "27", Pos: "27",
    },
    ItemList: [{
      SlNo: "1", IsServc: "Y", HsnCd: "996311", Qty: "1.000", Unit: "OTH",
      UnitPrice: "9999999999999.99", TotAmt: "9999999999999.99", AssAmt: "9999999999999.99",
      GstRt: "5.00", IgstAmt: "500000000000.00", TotItemVal: "10499999999999.99",
    }],
    ValDtls: { AssVal: "9999999999999.99", IgstVal: "500000000000.00", TotInvVal: "10499999999999.99" },
  };
  const contentJson = JSON.stringify(content);
  return Object.freeze({
    kind: "india_native_invoice_v1", documentId: uuid(10), propertyNode: uuid(2),
    reservationId: uuid(4), folioId: uuid(5), seriesId: uuid(7), documentNumber: "INV/2044/17",
    businessDate: "2044-09-06", issuedAt: "2044-09-06T10:00:00.000001Z",
    recipientRegistrationId: uuid(6), sourceEvidenceHash: "a".repeat(64),
    documentSha256: sha(contentJson), previousHash: "b".repeat(64), contentJson,
  });
}

const signedQr = "e30.eyJpc3MiOiJzeW50aGV0aWMtaXJwIiwiaXJuIjoiMSJ9.YQ";

function accepted(environment: "sandbox" | "production" = "sandbox") {
  const document = invoice();
  const receipt = Object.freeze({
    kind: "accepted_signed_v1", submissionId: uuid(20), tenantId: uuid(1), propertyNode: uuid(2),
    documentId: document.documentId, documentSha256: document.documentSha256, wireSha256: "c".repeat(64),
    providerKey: "clearirp", attemptId: uuid(21), attemptNumber: 1, status: "accepted", disposition: "none",
    transitionSeq: 3, environment, responseSha256: "d".repeat(64), irn: "e".repeat(64),
    ackNo: "123456789", ackDt: "2044-09-06 10:00:00", signedInvoice: "e30.e30.YQ",
    signedQRCode: signedQr, signedInvoiceSha256: sha("e30.e30.YQ"), signedQrSha256: sha(signedQr),
    verification: {
      profileVersion: "yellow_native_india_1_1_v1", issuer: "synthetic-irp", verificationUnixMs: 2_356_742_400_000,
      invoiceKeyId: "invoice-key", invoiceKeySpkiSha256: "f".repeat(64), invoiceBundleVersion: "fixture-v1",
      qrKeyId: "qr-key", qrKeySpkiSha256: "0".repeat(64), qrBundleVersion: "fixture-v1",
    },
  });
  return Object.freeze({
    kind: "receipt", documentId: document.documentId, receipt,
  });
}

describe("Order440 Q208 immutable invoice print artifact", () => {
  test("renders one legal record from issued content with exact decimal text and escaped labels", () => {
    const result = buildInvoicePrintArtifact(invoice(), { kind: "not_requested", documentId: uuid(10) });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.message);
    const { markup } = result.value;
    expect(markup.match(/<article\b/g)).toHaveLength(1);
    expect(markup.match(/INV\/2044\/17/g)).toHaveLength(1);
    expect(markup).toContain("06/09/2044");
    expect(markup).toContain("9999999999999.99");
    expect(markup).toContain("500000000000.00");
    expect(markup).toContain("10499999999999.99");
    expect(markup).not.toMatch(/1\.05e\+13/i);
    expect(markup).toContain("Yellow &lt;script&gt;alert(1)&lt;/script&gt; &amp; Co");
    expect(markup).toContain("Buyer &lt;img src=x onerror=alert(1)&gt;");
    expect(markup).not.toContain("<script>");
    expect(markup).not.toContain("<img");
    for (const identity of [uuid(10), uuid(4), uuid(5), uuid(7), "a".repeat(64), "b".repeat(64)]) {
      expect(markup).toContain(identity);
    }
    expect(result.value.status.code).toBe("not_requested");
    expect(result.value.qr).toBeNull();
    expect(Object.isFrozen(result.value)).toBe(true);
  });

  test("encodes the exact compact token with a four-module quiet zone and crisp black-white SVG", () => {
    const qr = createSignedQrArtifact(signedQr);
    expect(qr.ok).toBe(true);
    if (!qr.ok) throw new Error(qr.error.message);
    expect(qr.value).not.toHaveProperty("payload");
    expect(qr.value.quietZone).toBe(4);
    expect(qr.value.screenPixels).toBe(qr.value.size * 3);
    expect(qr.value.printMillimetres).toBe(50);
    expect(qr.value.modules).toHaveLength(qr.value.size);
    expect(qr.value.modules.every((row: readonly boolean[]) => row.length === qr.value.size)).toBe(true);
    for (let offset = 0; offset < qr.value.size; offset += 1) {
      expect(qr.value.modules[0]![offset]).toBe(false);
      expect(qr.value.modules[3]![offset]).toBe(false);
      expect(qr.value.modules[qr.value.size - 4]![offset]).toBe(false);
      expect(qr.value.modules[offset]![0]).toBe(false);
      expect(qr.value.modules[offset]![qr.value.size - 1]).toBe(false);
    }
    expect(qr.value.svg).toContain('shape-rendering="crispEdges"');
    expect(qr.value.svg).toContain(`data-qr-modules="${qr.value.size}"`);
    expect(qr.value.svg).toContain(`width="${qr.value.screenPixels}" height="${qr.value.screenPixels}"`);
    expect(qr.value.svg).toContain('fill="#fff"');
    expect(qr.value.svg).toContain('fill="#000"');
    expect(qr.value.svg).not.toContain(signedQr);
    expect(Object.isFrozen(qr.value.modules[4])).toBe(true);
  });

  test("rejects beyond real QR byte capacity before encoding and never truncates", () => {
    const atLimit = `${"a".repeat(1475)}.a.${"a".repeat(1475)}`;
    expect(atLimit).toHaveLength(INVOICE_PRINT_QR_LIMITS.maxUtf8Bytes);
    const acceptedBoundary = createSignedQrArtifact(atLimit);
    expect(acceptedBoundary.ok).toBe(true);
    if (acceptedBoundary.ok) {
      expect(acceptedBoundary.value.svg).not.toContain(atLimit);
      expect(acceptedBoundary.value.size).toBe(185);
      expect(acceptedBoundary.value.screenPixels).toBe(555);
      expect(acceptedBoundary.value.svg).toContain('data-qr-screen-pixels="555"');
    }
    const oversized = `${atLimit}a`;
    expect(createSignedQrArtifact(oversized)).toEqual({
      ok: false,
      error: { code: "qr_capacity_exceeded", message: "Signed QR data is too large to print safely" },
    });
    const linked = accepted("production");
    expect(buildInvoicePrintArtifact(invoice(), { ...linked,
      receipt: { ...linked.receipt, signedQRCode: oversized, signedQrSha256: sha(oversized) } })).toEqual({
      ok: false,
      error: { code: "qr_capacity_exceeded", message: "Signed QR data is too large to print safely" },
    });
  });

  test("shows every registration state explicitly and never implies a universal B2C IRN rule", () => {
    const document = invoice();
    const pendingReceipt = {
      kind: "pending", submissionId: uuid(20), tenantId: uuid(1), propertyNode: uuid(2),
      documentId: document.documentId, documentSha256: document.documentSha256, wireSha256: "c".repeat(64),
      providerKey: "clearirp", attemptId: uuid(21), attemptNumber: 1, status: "submitted", disposition: "lookup",
      transitionSeq: 2,
    };
    const links = [
      [{ kind: "unavailable", documentId: document.documentId }, "Registration not checked"],
      [{ kind: "not_requested", documentId: document.documentId }, "Not registered"],
      [{ kind: "legacy_unsupported", documentId: document.documentId, submissionId: uuid(20) }, "Legacy provider evidence"],
      [{ kind: "ambiguous", documentId: document.documentId }, "Registration status is ambiguous"],
      [{ kind: "receipt", documentId: document.documentId, receipt: pendingReceipt }, "Registration pending"],
      [{ kind: "receipt", documentId: document.documentId, receipt: { ...pendingReceipt, kind: "rejected", status: "rejected",
        disposition: "none", environment: "production", responseSha256: "d".repeat(64), errorCodes: ["E101", "<bad>"] } }, "Registration rejected"],
      [{ kind: "receipt", documentId: document.documentId, receipt: { ...pendingReceipt, kind: "provider_cancelled", status: "error",
        disposition: "none", environment: "production", responseSha256: "d".repeat(64), providerStatus: "CNL" } }, "Registration cancelled by provider"],
    ] as const;
    for (const [link, label] of links) {
      const result = buildInvoicePrintArtifact(document, link);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(result.error.message);
      expect(result.value.markup).toContain(label);
      expect(result.value.markup).not.toContain("All B2C");
      expect(result.value.markup).not.toContain("IRN required");
      expect(result.value.qr).toBeNull();
    }
    expect(buildInvoicePrintArtifact(document, null)).toMatchObject({ ok: false, error: { code: "invalid_delivery" } });
  });

  test("prints split CGST and SGST components without recomputing decimal display text", () => {
    const document = invoice();
    const source = JSON.parse(document.contentJson);
    const { IgstAmt: _itemIgst, ...item } = source.ItemList[0];
    const { IgstVal: _totalIgst, ...totals } = source.ValDtls;
    source.ItemList = [{ ...item, CgstAmt: "250000000000.00", SgstAmt: "250000000000.00" }];
    source.ValDtls = { ...totals, CgstVal: "250000000000.00", SgstVal: "250000000000.00" };
    const contentJson = JSON.stringify(source);
    const result = buildInvoicePrintArtifact({ ...document, contentJson, documentSha256: sha(contentJson) },
      { kind: "not_requested", documentId: document.documentId });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.markup).toContain("<th>CGST</th><th>SGST</th>");
    expect(result.value.markup.match(/250000000000\.00/g)?.length).toBeGreaterThanOrEqual(4);
  });

  test("preserves a genesis document's null previous hash without inventing a chain value", () => {
    const document = { ...invoice(), previousHash: null };
    const result = buildInvoicePrintArtifact(document, { kind: "not_requested", documentId: document.documentId });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.markup).toContain("Genesis — no previous document hash");
    expect(result.value.markup).not.toContain("0000000000000000000000000000000000000000000000000000000000000000");
  });

  test("renders signed QR only for an exact current document receipt and labels sandbox prominently", () => {
    const sandbox = buildInvoicePrintArtifact(invoice(), accepted("sandbox"));
    expect(sandbox.ok).toBe(true);
    if (!sandbox.ok) throw new Error(sandbox.error.message);
    expect(sandbox.value.status.code).toBe("accepted_sandbox");
    expect(sandbox.value.markup).toContain("SANDBOX — not a production registration");
    expect(sandbox.value.markup).toContain("IRP acknowledgement");
    expect(sandbox.value.markup).toContain("e".repeat(64));
    expect(sandbox.value.markup).not.toContain(signedQr);
    expect(sandbox.value.qr?.svg).not.toContain(signedQr);

    const valid = accepted("production");
    for (const changed of [
      { ...valid, documentId: uuid(99) },
      { ...valid, receipt: { ...valid.receipt, documentId: uuid(99) } },
      { ...valid, receipt: { ...valid.receipt, documentSha256: "9".repeat(64) } },
      { ...valid, receipt: { ...valid.receipt, propertyNode: uuid(99) } },
      { ...valid, receipt: { ...valid.receipt, status: "pending" } },
    ]) {
      expect(buildInvoicePrintArtifact(invoice(), changed)).toMatchObject({ ok: false, error: { code: "invalid_delivery" } });
    }
  });

  test("rejects malformed source shape, amount inconsistencies and accessors without reading them", () => {
    const document = invoice();
    const source = JSON.parse(document.contentJson);
    for (const changedSource of [
      { ...source, DocDtls: { ...source.DocDtls, No: "INV/OTHER" } },
      { ...source, DocDtls: { ...source.DocDtls, Dt: "07/09/2044" } },
      { ...source, ItemList: [{ ...source.ItemList[0], UnitPrice: 100 }] },
      { ...source, ItemList: [{ ...source.ItemList[0], TotItemVal: "10500000000000.00" }] },
      { ...source, hiddenMutableFact: true },
    ]) {
      const contentJson = JSON.stringify(changedSource);
      expect(buildInvoicePrintArtifact({ ...document, contentJson, documentSha256: sha(contentJson) },
        { kind: "not_requested", documentId: document.documentId })).toMatchObject({ ok: false, error: { code: "invalid_document" } });
    }
    let reads = 0;
    const accessor = { ...document };
    Object.defineProperty(accessor, "contentJson", { enumerable: true, get: () => { reads += 1; return document.contentJson; } });
    expect(buildInvoicePrintArtifact(accessor, { kind: "not_requested", documentId: document.documentId })).toMatchObject({
      ok: false, error: { code: "invalid_document" },
    });
    expect(reads).toBe(0);
  });

  test("ships a fixed A4 print stylesheet with repeating headers, wrapping and no theme/network dependency", async () => {
    expect(INVOICE_PRINT_STYLES).toContain("@page");
    expect(INVOICE_PRINT_STYLES).toContain("size: A4");
    expect(INVOICE_PRINT_STYLES).toContain("thead { display: table-header-group");
    expect(INVOICE_PRINT_STYLES).toContain("overflow-wrap: anywhere");
    expect(INVOICE_PRINT_STYLES).not.toContain("46mm");
    expect(INVOICE_PRINT_STYLES).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(INVOICE_PRINT_STYLES).toContain("container-type: inline-size");
    expect(INVOICE_PRINT_STYLES).toContain("@container (max-width: 599px)");
    expect(INVOICE_PRINT_STYLES).toContain(".invoice-print__qr-note");
    expect(INVOICE_PRINT_STYLES).toContain("width: 50mm !important");
    expect(INVOICE_PRINT_STYLES).toContain("[data-print-control]");
    expect(INVOICE_PRINT_STYLES).toContain("display: none !important");
    expect(INVOICE_PRINT_STYLES).toContain("#000");
    expect(INVOICE_PRINT_STYLES).toContain("#fff");
    expect(INVOICE_PRINT_STYLES).not.toMatch(/@import|https?:|url\(|var\(|animation|transition/i);
    const source = await Bun.file(new URL("../src/http/operator/invoice-print.js", import.meta.url)).text();
    expect(source).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|indexedDB/);
    expect(source.indexOf("token.length > INVOICE_PRINT_QR_LIMITS.maxUtf8Bytes"))
      .toBeLessThan(source.indexOf("qrcodegen.QrCode.encodeBinary"));
    expect(source).not.toContain("qrcodegen.QrCode.encodeText");
  });

  test("records the exact upstream and adapted QR artifact hashes with the full MIT grant", async () => {
    const vendor = await Bun.file(new URL("../src/http/operator/vendor/qrcodegen-v1.8.0-es6.js", import.meta.url)).text();
    const notice = await Bun.file(new URL("../src/http/operator/vendor/QR-CODE-NOTICE.md", import.meta.url)).text();
    expect(new TextEncoder().encode(vendor)).toHaveLength(45_358);
    expect(sha(vendor)).toBe("c6599a62397cf9cd70570c5f74b0f9b962eb21fc3444aadb440efbfbebe0d1d8");
    const attributes = await Bun.file(new URL("../.gitattributes", import.meta.url)).text();
    expect(attributes).toContain("src/http/operator/vendor/qrcodegen-v1.8.0-es6.js whitespace=-blank-at-eol");
    expect(vendor.endsWith("export { qrcodegen };\n")).toBe(true);
    expect(notice).toContain("6a1116192ed1dd67fa1bf31e77f5817103d71c23bbac24c382e698b7668bdd01");
    expect(notice).toContain("c6599a62397cf9cd70570c5f74b0f9b962eb21fc3444aadb440efbfbebe0d1d8");
    expect(notice).toContain("https://github.com/nayuki/QR-Code-generator/releases/download/v1.8.0/qrcodegen-v1.8.0-es6.js");
    expect(notice).toContain("Permission is hereby granted, free of charge");
    expect(notice).toContain("THE SOFTWARE IS PROVIDED \"AS IS\"");
  });
});
