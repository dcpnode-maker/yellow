import { describe, expect, test } from "bun:test";
import { IndiaNativeFiscalCreditNoteDatabaseError, IndiaNativeFiscalCreditNoteService,
  type IndiaNativeFiscalCreditNoteReceipt } from "../src/contexts/tax-fiscal";
// @ts-expect-error Browser assets deliberately ship without declarations.
import { creditNoteDisclosureEnvelope } from "../src/http/operator/invoices.js";
// @ts-expect-error Browser assets deliberately ship without declarations.
import { fiscalDeliveryRegistrationStatus } from "../src/http/operator/invoice-print.js";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const hash = (character: string) => character.repeat(64);
const original = Object.freeze({ documentId: id(1), documentNumber: "I/4445/17", documentSha256: hash("a"),
  propertyNode: id(2), reservationId: id(3), folioId: id(4), recipientRegistrationId: id(5) });
const receipt = Object.freeze({ documentId: id(6), documentKind: "credit_note", originalDocumentId: id(1),
  originalDocNo: "I/4445/17", originalSha256: hash("a"), correctionJournalId: id(7), seriesId: id(8),
  docNo: "C/4445/18", propertyNode: id(2), reservationId: id(3), folioId: id(4), supplierRegistrationId: id(9),
  recipientRegistrationId: id(5), financialYearStart: "2044-04-01", currency: "INR", status: "issued",
  businessDate: "2044-09-07", issuedAt: "2044-09-07T08:09:10.123Z", prevHash: null,
  sha256: hash("b"), sourceEvidenceHash: hash("c"), totalMinor: "11800", reason: " Full cancellation " });
const discovery = Object.freeze({ tenantId: id(10), propertyNode: id(2), actorId: id(11), originalDocumentId: id(1) });

async function backend(candidate: unknown): Promise<Readonly<IndiaNativeFiscalCreditNoteReceipt>> {
  const tx = (async () => [{ receipt_json: JSON.stringify(candidate) }]) as never;
  const result = await new IndiaNativeFiscalCreditNoteService().discover(tx, discovery);
  if (!result) throw new Error("expected a discovered credit note");
  return result.receipt;
}
async function backendRejects(candidate: unknown): Promise<void> {
  await expect(backend(candidate)).rejects.toBeInstanceOf(IndiaNativeFiscalCreditNoteDatabaseError);
}

describe("Order466 backend/browser immutable credit receipt parity", () => {
  test("accepts backend-canonical Unicode, calendar, fiscal-year and signed-int64 boundaries", async () => {
    const accepted = [receipt, { ...receipt, reason: "😀".repeat(500) }, { ...receipt, reason: ` leadingand trailing ` },
      { ...receipt, businessDate: "2044-02-29", issuedAt: "2044-02-29T23:59:59.999Z",
        financialYearStart: "2043-04-01", totalMinor: "9223372036854775807", prevHash: hash("d") },
      { ...receipt, businessDate: "2044-03-31", financialYearStart: "2030-04-01" }];
    for (const candidate of accepted) {
      const serverReceipt = await backend(candidate);
      const projected = creditNoteDisclosureEnvelope(serverReceipt, original);
      expect(projected).not.toBeNull();
      expect(projected?.reason).toBe(candidate.reason);
      expect(Object.isFrozen(projected)).toBe(true);
    }
  });

  test("matches backend rejection at reason, date, time, UUID, hash, document and money boundaries", async () => {
    const rejected = [{ ...receipt, reason: "x".repeat(501) }, { ...receipt, reason: "😀".repeat(501) },
      { ...receipt, reason: " \t " }, { ...receipt, reason: "bad\u007f" }, { ...receipt, reason: "bad\ud800" },
      { ...receipt, reason: "bad\udc00" }, { ...receipt, businessDate: "2043-02-29" },
      { ...receipt, businessDate: "2044-02-30" }, { ...receipt, financialYearStart: "2044-03-31" },
      { ...receipt, issuedAt: "2044-09-07T08:09:10.123456Z" }, { ...receipt, issuedAt: "2044-02-30T08:09:10.123Z" },
      { ...receipt, documentId: "00000000-0000-0000-0000-000000000006" }, { ...receipt, sha256: hash("A") },
      { ...receipt, docNo: "CREDIT NOTE 18" }, { ...receipt, docNo: "C/1234567890123456" },
      { ...receipt, totalMinor: "0" }, { ...receipt, totalMinor: "01" },
      { ...receipt, totalMinor: "9223372036854775808" }, { ...receipt, status: "draft" },
      { ...receipt, extra: true }, Object.fromEntries(Object.entries(receipt).filter(([key]) => key !== "reason"))];
    for (const candidate of rejected) {
      await backendRejects(candidate);
      expect(creditNoteDisclosureEnvelope(candidate, original)).toBeNull();
    }
  });

  test("adds the original-invoice cross-bind that the durable receipt cannot establish alone", async () => {
    const linked = ["originalDocNo", "originalSha256", "reservationId", "folioId", "recipientRegistrationId"] as const;
    for (const key of linked) {
      const value = key.endsWith("Id") ? id(90) : key.endsWith("Sha256") ? hash("d") : "I/4445/99";
      const candidate = { ...receipt, [key]: value };
      expect(await backend(candidate)).toBeDefined();
      expect(creditNoteDisclosureEnvelope(candidate, original)).toBeNull();
    }
    for (const candidate of [{ ...receipt, originalDocumentId: id(90) }, { ...receipt, propertyNode: id(90) }]) {
      await backendRejects(candidate);
      expect(creditNoteDisclosureEnvelope(candidate, original)).toBeNull();
    }
    expect(creditNoteDisclosureEnvelope({ ...receipt, documentId: receipt.originalDocumentId }, original)).toBeNull();
    expect(creditNoteDisclosureEnvelope({ ...receipt, supplierRegistrationId: receipt.recipientRegistrationId }, original)).toBeNull();
  });

  test("rejects hostile receipt containers and keys without invoking accessors", () => {
    let reads = 0;
    const accessor = { ...receipt } as Record<string, unknown>;
    Object.defineProperty(accessor, "reason", { enumerable: true, get: () => { reads += 1; return "hidden"; } });
    expect(creditNoteDisclosureEnvelope(accessor, original)).toBeNull();
    expect(reads).toBe(0);
    const symbol = { ...receipt } as Record<PropertyKey, unknown>; symbol[Symbol("hidden")] = true;
    expect(creditNoteDisclosureEnvelope(symbol, original)).toBeNull();
    expect(creditNoteDisclosureEnvelope(Object.assign(Object.create(null), receipt), original)).not.toBeNull();
    expect(creditNoteDisclosureEnvelope(new Proxy(receipt, { ownKeys: () => { throw new Error("trap"); } }), original)).toBeNull();
  });
});

const deliveryIdentity = Object.freeze({ documentId: id(6), propertyNode: id(2), documentSha256: hash("b") });
const baseReceipt = Object.freeze({ kind: "pending", submissionId: id(20), tenantId: id(10), propertyNode: id(2),
  documentId: id(6), documentSha256: hash("b"), wireSha256: hash("d"), providerKey: "clearirp",
  attemptId: id(21), attemptNumber: 1, status: "submitted", disposition: "lookup", transitionSeq: 2 });
const delivery = (value: unknown) => Object.freeze({ kind: "receipt", documentId: id(6), receipt: value });
const accepted = (environment: "sandbox" | "production") => delivery({ ...baseReceipt, kind: "accepted_signed_v1",
  status: "accepted", disposition: "none", environment, responseSha256: hash("e"), irn: hash("f"), ackNo: "123456789",
  ackDt: "2044-09-07 08:09:10", signedInvoice: "e30.e30.YQ", signedQRCode: "e30.e30.YQ",
  signedInvoiceSha256: hash("1"), signedQrSha256: hash("2"), verification: { profileVersion: "yellow_native_india_1_1_v1",
    issuer: "synthetic-irp", verificationUnixMs: 2356742400000, invoiceKeyId: "invoice-key",
    invoiceKeySpkiSha256: hash("3"), invoiceBundleVersion: "fixture-v1", qrKeyId: "qr-key",
    qrKeySpkiSha256: hash("4"), qrBundleVersion: "fixture-v1" } });

describe("Order466 exact browser fiscal delivery status facade", () => {
  test("projects every exact state without overstating registration", () => {
    const variants = [
      [{ kind: "not_requested", documentId: id(6) }, "not_requested", "Not registered — registration not requested"],
      [{ kind: "ambiguous", documentId: id(6) }, "ambiguous", "Registration status is ambiguous"],
      [{ kind: "legacy_unsupported", documentId: id(6), submissionId: id(20) }, "legacy_unsupported", "Legacy provider evidence"],
      [delivery(baseReceipt), "pending", "Registration pending"],
      [delivery({ ...baseReceipt, status: "pending", disposition: "send" }), "pending", "Registration pending"],
      [delivery({ ...baseReceipt, status: "error", disposition: "retry", retryBinding: {
        providerExtensionId: id(30), providerExtensionVersion: 2147483647 } }), "pending", "Registration pending"],
      [delivery({ ...baseReceipt, kind: "rejected", status: "rejected", disposition: "none", environment: "sandbox",
        responseSha256: hash("e"), errorCodes: ["E101"] }), "rejected", "Registration rejected — not registered"],
      [delivery({ ...baseReceipt, kind: "provider_cancelled", status: "error", disposition: "none", environment: "production",
        responseSha256: hash("e"), providerStatus: "CNL" }), "provider_cancelled", "Registration cancelled by provider — not registered"],
      [delivery({ ...baseReceipt, kind: "legacy_hash_only", status: "accepted", disposition: "none",
        authorityRef: "legacy", responseSha256: hash("e") }), "legacy_hash_only", "Legacy provider evidence"],
      [accepted("sandbox"), "accepted_sandbox", "SANDBOX — not a production registration"],
      [accepted("production"), "accepted_production", "IRP registered"],
    ] as const;
    for (const [input, code, label] of variants) {
      const status = fiscalDeliveryRegistrationStatus(deliveryIdentity, input);
      expect(status).toEqual({ code, label });
      expect(Object.isFrozen(status)).toBe(true);
      expect(Object.keys(status!)).toEqual(["code", "label"]);
    }
  });

  test("rejects cross-document, property, hash, surplus, state and accessor drift", () => {
    const valid = accepted("production") as { readonly kind: string; readonly documentId: string; readonly receipt: Record<string, unknown> };
    const invalid = [{ ...valid, documentId: id(99) }, { ...valid, extra: true }, delivery({ ...valid.receipt, documentId: id(99) }),
      delivery({ ...valid.receipt, propertyNode: id(99) }), delivery({ ...valid.receipt, documentSha256: hash("9") }),
      delivery({ ...valid.receipt, status: "submitted" }), delivery({ ...valid.receipt, environment: "staging" }),
      delivery({ ...baseReceipt, status: "error", disposition: "retry", retryBinding: {
        providerExtensionId: id(30), providerExtensionVersion: 2147483648 } })];
    for (const input of invalid) expect(fiscalDeliveryRegistrationStatus(deliveryIdentity, input)).toBeNull();
    for (const identity of [{ ...deliveryIdentity, documentId: id(99) }, { ...deliveryIdentity, propertyNode: id(99) },
      { ...deliveryIdentity, documentSha256: hash("9") }, { ...deliveryIdentity, extra: true }])
      expect(fiscalDeliveryRegistrationStatus(identity, valid)).toBeNull();
    let reads = 0;
    const hostile = { kind: "receipt", documentId: id(6) } as Record<string, unknown>;
    Object.defineProperty(hostile, "receipt", { enumerable: true, get: () => { reads += 1; return valid.receipt; } });
    expect(fiscalDeliveryRegistrationStatus(deliveryIdentity, hostile)).toBeNull();
    const hostileReceipt = { ...valid.receipt };
    Object.defineProperty(hostileReceipt, "signedInvoice", { enumerable: true,
      get: () => { reads += 1; return "e30.e30.YQ"; } });
    expect(fiscalDeliveryRegistrationStatus(deliveryIdentity, delivery(hostileReceipt))).toBeNull();
    const hostileRetryBinding = { providerExtensionId: id(30) } as Record<string, unknown>;
    Object.defineProperty(hostileRetryBinding, "providerExtensionVersion", { enumerable: true,
      get: () => { reads += 1; return 1; } });
    expect(fiscalDeliveryRegistrationStatus(deliveryIdentity, delivery({ ...baseReceipt,
      status: "error", disposition: "retry", retryBinding: hostileRetryBinding }))).toBeNull();
    const hostileIdentity = { documentId: id(6), propertyNode: id(2) } as Record<string, unknown>;
    Object.defineProperty(hostileIdentity, "documentSha256", { enumerable: true, get: () => { reads += 1; return hash("b"); } });
    expect(fiscalDeliveryRegistrationStatus(hostileIdentity, valid)).toBeNull();
    expect(reads).toBe(0);
  });

  test("returns no receipt payload, provider identity or mutable nested value", () => {
    for (const input of [accepted("sandbox"), accepted("production"), delivery(baseReceipt)]) {
      const status = fiscalDeliveryRegistrationStatus(deliveryIdentity, input);
      expect(status).not.toBeNull();
      const serialized = JSON.stringify(status);
      for (const secret of ["signedInvoice", "signedQRCode", "providerKey", "submissionId", "attemptId", "verification", "clearirp"])
        expect(serialized).not.toContain(secret);
      expect(Object.isFrozen(status)).toBe(true);
    }
  });
});
