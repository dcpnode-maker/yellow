import { describe, expect, test } from "bun:test";
import { FISCAL_SIGNED_JWS_LIMITS } from "../src/contexts/tax-fiscal/fiscal-signed-jws";
import {
  FISCAL_RECEIPT_PROTOCOL_PROFILE,
  FiscalSubmissionReceiptReadService,
  snapshotFiscalReceiptEvidence,
  snapshotFiscalSubmissionDeliveryReceipt,
  type FiscalSubmissionDeliveryReadResult,
} from "../src/contexts/tax-fiscal/fiscal-submission-receipt";
import type { Tx } from "../src/kernel";

const hash = (value: string | Uint8Array) => new Bun.CryptoHasher("sha256").update(value).digest("hex");
const raw = '{"Status":1,"Data":"ciphertext"}';
const data = '{"Status":"ACT"}';
const responseHash = hash(raw);
const base = {
  version: 1, protocolProfile: FISCAL_RECEIPT_PROTOCOL_PROFILE, environment: "sandbox",
  providerKey: "india-irp:fictional", documentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  documentSha256: "a".repeat(64), wireSha256: "b".repeat(64), receivedAtUnixMs: 1000,
  rawResponseBase64: Buffer.from(raw).toString("base64"),
  decryptedDataBase64: Buffer.from(data).toString("base64"), decryptedDataSha256: hash(data),
};

function accepted() {
  // These are format-only fixtures. No signature or fiscal acceptance is asserted.
  const compact = "e30.e30.YQ";
  return { ...base, kind: "accepted_signed_v1", irn: "c".repeat(64),
    ackNo: "9007199254740993", ackDt: "2026-09-07 01:00:00", signedInvoice: compact,
    signedInvoiceSha256: hash(compact), signedQRCode: compact, signedQrSha256: hash(compact),
    verification: { profileVersion: "yellow_native_india_1_1_v1", issuer: "fictional",
      verificationUnixMs: 1000, invoiceKeyId: "key-1", invoiceKeySpkiSha256: "d".repeat(64),
      invoiceBundleVersion: "bundle-1", qrKeyId: "key-1", qrKeySpkiSha256: "d".repeat(64),
      qrBundleVersion: "bundle-1" } };
}

describe("signed fiscal receipt evidence boundary (not signature verification)", () => {
  test("detaches and deeply freezes accepted metadata and exact unsafe acknowledgement text", () => {
    const input = accepted();
    const result = snapshotFiscalReceiptEvidence(input, responseHash);
    expect(result?.kind).toBe("accepted_signed_v1");
    if (result?.kind !== "accepted_signed_v1") throw new Error("receipt missing");
    expect(result.ackNo).toBe("9007199254740993");
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.verification)).toBe(true);
    input.verification.issuer = "changed";
    expect(result.verification.issuer).toBe("fictional");
  });

  test("rejection and cancellation cannot invent an authority reference or acceptance", () => {
    const rejected = { ...base, kind: "rejected", errorCodes: ["REJECTED_CODE"] };
    const result = snapshotFiscalReceiptEvidence(rejected, responseHash);
    expect(result?.kind).toBe("rejected");
    if (result?.kind !== "rejected") throw new Error("receipt missing");
    expect(Object.isFrozen(result.errorCodes)).toBe(true);
    rejected.errorCodes.push("LATER");
    expect(result.errorCodes).toEqual(["REJECTED_CODE"]);
    expect(snapshotFiscalReceiptEvidence({ ...rejected, authorityRef: "invented" }, responseHash)).toBeNull();
    expect(snapshotFiscalReceiptEvidence({ ...base, kind: "provider_cancelled", providerStatus: "CNL" }, responseHash)?.kind).toBe("provider_cancelled");
    expect(snapshotFiscalReceiptEvidence({ ...base, kind: "provider_cancelled", providerStatus: "ACT" }, responseHash)).toBeNull();
  });

  test("verifies exact byte hashes and canonical padded base64", () => {
    const valid = accepted();
    for (const field of ["documentSha256", "wireSha256", "decryptedDataSha256", "signedInvoiceSha256", "signedQrSha256"]) {
      expect(snapshotFiscalReceiptEvidence({ ...valid, [field]: "x".repeat(64) }, responseHash)).toBeNull();
    }
    expect(snapshotFiscalReceiptEvidence(valid, "e".repeat(64))).toBeNull();
    expect(snapshotFiscalReceiptEvidence({ ...valid, decryptedDataSha256: "e".repeat(64) }, responseHash)).toBeNull();
    expect(snapshotFiscalReceiptEvidence({ ...valid, signedInvoiceSha256: "e".repeat(64) }, responseHash)).toBeNull();
    expect(snapshotFiscalReceiptEvidence({ ...valid, rawResponseBase64: valid.rawResponseBase64 + "\n" }, responseHash)).toBeNull();
    expect(snapshotFiscalReceiptEvidence({ ...valid, decryptedDataBase64: "e30" }, responseHash)).toBeNull();
    const invalidUtf8 = new Uint8Array([0xff]);
    expect(snapshotFiscalReceiptEvidence({ ...valid, rawResponseBase64: Buffer.from(invalidUtf8).toString("base64") }, hash(invalidUtf8))).toBeNull();
  });

  test("accepts each exact body bound and bound-minus-one; rejects bound-plus-one", () => {
    for (const [field, maximum] of [["rawResponseBase64", 6 * 1024 * 1024], ["decryptedDataBase64", 4 * 1024 * 1024]] as const) {
      for (const delta of [-1, 0, 1]) {
        const body = " ".repeat(maximum + delta);
        const input = { ...accepted(), [field]: Buffer.from(body).toString("base64") };
        const expectedHash = field === "rawResponseBase64" ? hash(body) : responseHash;
        if (field === "decryptedDataBase64") input.decryptedDataSha256 = hash(body);
        const result = snapshotFiscalReceiptEvidence(input, expectedHash);
        expect(result !== null).toBe(delta <= 0);
      }
    }
  });

  test("rejects side effects, hostile shapes, secret fields and invalid ack calendars", () => {
    const valid = accepted();
    let called = 0;
    const getter = { ...valid };
    Object.defineProperty(getter, "irn", { enumerable: true, get() { called++; return valid.irn; } });
    expect(snapshotFiscalReceiptEvidence(getter, responseHash)).toBeNull();
    expect(called).toBe(0);
    const proxy = Proxy.revocable(valid, {}); proxy.revoke();
    expect(() => snapshotFiscalReceiptEvidence(proxy.proxy, responseHash)).not.toThrow();
    expect(snapshotFiscalReceiptEvidence(proxy.proxy, responseHash)).toBeNull();
    expect(snapshotFiscalReceiptEvidence({ ...valid, AuthToken: "secret" }, responseHash)).toBeNull();
    for (const ackDt of ["2026-02-30 01:00:00", "2026-09-07T01:00:00", "0000-09-07 01:00:00", "2026-09-07 24:00:00"]) {
      expect(snapshotFiscalReceiptEvidence({ ...valid, ackDt }, responseHash)).toBeNull();
    }
    for (const ackNo of ["0", "01", "1e3", 9007199254740992, "1".repeat(65)]) {
      expect(snapshotFiscalReceiptEvidence({ ...valid, ackNo }, responseHash)).toBeNull();
    }
    expect(snapshotFiscalReceiptEvidence({ ...base, kind: "rejected", errorCodes: ["A", "A"] }, responseHash)).toBeNull();
    expect(snapshotFiscalReceiptEvidence({ ...base, kind: "rejected", errorCodes: ["bad\ncode"] }, responseHash)).toBeNull();
  });
});

const deliveryIds = Object.freeze({
  submissionId: "00000000-0000-4000-8000-000000009101",
  tenantId: "00000000-0000-4000-8000-000000009102",
  propertyNode: "00000000-0000-4000-8000-000000009103",
  documentId: "00000000-0000-4000-8000-000000009104",
  attemptId: "00000000-0000-4000-8000-000000009105",
  actorId: "00000000-0000-4000-8000-000000009106",
});

const deliveryBase = Object.freeze({
  submissionId: deliveryIds.submissionId,
  tenantId: deliveryIds.tenantId,
  propertyNode: deliveryIds.propertyNode,
  documentId: deliveryIds.documentId,
  documentSha256: "1".repeat(64),
  wireSha256: "2".repeat(64),
  providerKey: "india-irp",
  attemptId: deliveryIds.attemptId,
  attemptNumber: 1,
  transitionSeq: 2,
});

const deliveryVerification = Object.freeze({
  profileVersion: "yellow_native_india_1_1_v1",
  issuer: "YELLOW-TEST-IRP",
  verificationUnixMs: 1_800_000_000_000,
  invoiceKeyId: "invoice-key",
  invoiceKeySpkiSha256: "3".repeat(64),
  invoiceBundleVersion: "bundle-v1",
  qrKeyId: "qr-key",
  qrKeySpkiSha256: "4".repeat(64),
  qrBundleVersion: "bundle-v1",
});

function deliveryAccepted(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const signedInvoice = "e30.e30.YQ";
  const signedQRCode = "e30.eyJxciI6MX0.YQ";
  return { ...deliveryBase, kind: "accepted_signed_v1", status: "accepted", disposition: "none",
    environment: "sandbox", responseSha256: "5".repeat(64), irn: "6".repeat(64),
    ackNo: "90071992547409991", ackDt: "2044-09-07 12:34:56",
    signedInvoice, signedQRCode, signedInvoiceSha256: hash(signedInvoice),
    signedQrSha256: hash(signedQRCode), verification: { ...deliveryVerification }, ...overrides };
}

function deliveryInput() {
  return { tenantId: deliveryIds.tenantId, propertyNode: deliveryIds.propertyNode,
    submissionId: deliveryIds.submissionId, actorId: deliveryIds.actorId };
}

const invalidRead = (
  code: "invalid_input" | "invalid_receipt" | "database_error",
): FiscalSubmissionDeliveryReadResult => ({
  ok: false,
  error: { code, message: "Fiscal delivery receipt could not be read" },
});

describe("Q207 public fiscal delivery receipt DTO boundary", () => {
  test("returns every exact public variant, detached and deeply frozen where values are nested", () => {
    const variants: Record<string, unknown>[] = [
      { ...deliveryBase, kind: "pending", status: "pending", disposition: "send" },
      { ...deliveryBase, kind: "pending", status: "submitted", disposition: "lookup" },
      { ...deliveryBase, kind: "pending", status: "error", disposition: "retry" },
      { ...deliveryBase, kind: "legacy_hash_only", status: "accepted", disposition: "none",
        authorityRef: "legacy-reference", responseSha256: "7".repeat(64) },
      { ...deliveryBase, kind: "legacy_hash_only", status: "rejected", disposition: "none",
        authorityRef: null, responseSha256: null },
      { ...deliveryBase, kind: "rejected", status: "rejected", disposition: "none",
        environment: "production", responseSha256: "8".repeat(64), errorCodes: ["E100", "E200"] },
      { ...deliveryBase, kind: "provider_cancelled", status: "error", disposition: "none",
        environment: "sandbox", responseSha256: "9".repeat(64), providerStatus: "CNL" },
      deliveryAccepted(),
    ];
    for (const source of variants) {
      const result = snapshotFiscalSubmissionDeliveryReceipt(source);
      expect(result).not.toBeNull();
      expect(Object.isFrozen(result)).toBe(true);
      expect(result).not.toBe(source);
      expect(Object.keys(result!).sort()).toEqual(Object.keys(source).sort());
      expect(JSON.stringify(result)).not.toMatch(/rawResponse|decryptedData|sourceContentJson|wireJson|claimToken/u);
      if (result?.kind === "rejected") {
        expect(Object.isFrozen(result.errorCodes)).toBe(true);
        (source.errorCodes as string[]).push("LATE");
        expect(result.errorCodes).toEqual(["E100", "E200"]);
      }
      if (result?.kind === "accepted_signed_v1") {
        expect(Object.isFrozen(result.verification)).toBe(true);
        (source.verification as { issuer: string }).issuer = "mutated";
        expect(result.verification.issuer).toBe("YELLOW-TEST-IRP");
      }
    }
  });

  test("enforces public state combinations and refuses private, ambiguous or weakly bound shapes", () => {
    const acceptedValue = deliveryAccepted();
    for (const mutation of [
      { status: "submitted" }, { disposition: "lookup" }, { attemptNumber: 0 }, { attemptNumber: 5 },
      { transitionSeq: 0 }, { providerKey: "India IRP" }, { documentSha256: "A".repeat(64) },
      { submissionId: "not-a-uuid" }, { AuthToken: "private" }, { rawResponseBase64: "private" },
    ]) expect(snapshotFiscalSubmissionDeliveryReceipt({ ...acceptedValue, ...mutation })).toBeNull();
    for (const invalid of [
      { ...deliveryBase, kind: "pending", status: "accepted", disposition: "none" },
      { ...deliveryBase, kind: "rejected", status: "rejected", disposition: "none",
        environment: "sandbox", responseSha256: "a".repeat(64), errorCodes: [] },
      { ...deliveryBase, kind: "provider_cancelled", status: "error", disposition: "none",
        environment: "sandbox", responseSha256: "a".repeat(64), providerStatus: "ACT" },
      { ...deliveryBase, kind: "legacy_hash_only", status: "error", disposition: "none",
        authorityRef: null, responseSha256: null },
    ]) expect(snapshotFiscalSubmissionDeliveryReceipt(invalid)).toBeNull();
  });

  test("accepts exact public text and collection ceilings and rejects each plus one", () => {
    const maximumCompact = `a.${"a".repeat(FISCAL_SIGNED_JWS_LIMITS.maxCompactChars - 4)}.a`;
    const atCompact = deliveryAccepted({ signedInvoice: maximumCompact,
      signedInvoiceSha256: hash(maximumCompact) });
    expect(() => snapshotFiscalSubmissionDeliveryReceipt(atCompact)).not.toThrow();
    expect(snapshotFiscalSubmissionDeliveryReceipt(atCompact)?.kind).toBe("accepted_signed_v1");
    const overCompact = `${maximumCompact}a`;
    expect(snapshotFiscalSubmissionDeliveryReceipt(deliveryAccepted({ signedInvoice: overCompact,
      signedInvoiceSha256: hash(overCompact) }))).toBeNull();
    expect(snapshotFiscalSubmissionDeliveryReceipt(deliveryAccepted({
      verification: { ...deliveryVerification, issuer: "I".repeat(128) },
    }))?.kind).toBe("accepted_signed_v1");
    expect(snapshotFiscalSubmissionDeliveryReceipt(deliveryAccepted({
      verification: { ...deliveryVerification, issuer: "I".repeat(129) },
    }))).toBeNull();
    expect(snapshotFiscalSubmissionDeliveryReceipt({ ...deliveryBase, kind: "legacy_hash_only",
      status: "accepted", disposition: "none", authorityRef: "R".repeat(256),
      responseSha256: null })?.kind).toBe("legacy_hash_only");
    expect(snapshotFiscalSubmissionDeliveryReceipt({ ...deliveryBase, kind: "legacy_hash_only",
      status: "accepted", disposition: "none", authorityRef: "R".repeat(257),
      responseSha256: null })).toBeNull();
    const codes = Array.from({ length: 32 }, (_, index) => `E${String(index).padStart(2, "0")}`);
    const rejection = { ...deliveryBase, kind: "rejected", status: "rejected", disposition: "none",
      environment: "sandbox", responseSha256: "a".repeat(64), errorCodes: codes };
    expect(snapshotFiscalSubmissionDeliveryReceipt(rejection)?.kind).toBe("rejected");
    expect(snapshotFiscalSubmissionDeliveryReceipt({ ...rejection,
      errorCodes: [...codes, "E32"] })).toBeNull();
    expect(snapshotFiscalSubmissionDeliveryReceipt({ ...rejection,
      errorCodes: ["E".repeat(64)] })?.kind).toBe("rejected");
    expect(snapshotFiscalSubmissionDeliveryReceipt({ ...rejection,
      errorCodes: ["E".repeat(65)] })).toBeNull();
  });

  test("rejects proxies, accessors, symbols and exotic prototypes without evaluating property code", () => {
    const valid = deliveryAccepted();
    let getterCalls = 0;
    const accessor = { ...valid };
    Object.defineProperty(accessor, "irn", { enumerable: true, get() { getterCalls += 1; return valid.irn; } });
    expect(snapshotFiscalSubmissionDeliveryReceipt(accessor)).toBeNull();
    expect(getterCalls).toBe(0);
    const proxy = new Proxy(valid, { get() { throw new Error("must not evaluate proxy traps"); } });
    expect(() => snapshotFiscalSubmissionDeliveryReceipt(proxy)).not.toThrow();
    expect(snapshotFiscalSubmissionDeliveryReceipt(proxy)).toBeNull();
    expect(snapshotFiscalSubmissionDeliveryReceipt(Object.assign(Object.create({}), valid))).toBeNull();
    expect(snapshotFiscalSubmissionDeliveryReceipt({ ...valid, [Symbol("private")]: "secret" })).toBeNull();
  });
});

describe("Q207 fiscal delivery receipt same-transaction read service", () => {
  test("uses exactly the supplied Tx/function/argument order and returns its detached authorized DTO", async () => {
    const source = deliveryAccepted();
    const calls: Array<{ sql: string; values: readonly unknown[] }> = [];
    const tx = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
      calls.push({ sql: strings.join("?").replace(/\s+/gu, " ").trim(), values });
      return [{ receipt: source }];
    }) as unknown as Tx;
    const service = new FiscalSubmissionReceiptReadService();
    const result = await service.read(tx, deliveryInput());
    expect(calls).toEqual([{ sql: "SELECT read_india_fiscal_submission_delivery_receipt( " +
      "?::uuid, ?::uuid, ?::uuid, ?::uuid ) AS receipt", values: [deliveryIds.tenantId,
      deliveryIds.propertyNode, deliveryIds.submissionId, deliveryIds.actorId] }]);
    expect(result.ok).toBe(true);
    if (!result.ok || !result.value || result.value.kind !== "accepted_signed_v1") {
      throw new Error("Q207 accepted read result missing");
    }
    expect(result.value as unknown).toEqual(source);
    expect(result.value).not.toBe(source);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.value)).toBe(true);
    expect(Object.isFrozen(result.value.verification)).toBe(true);
    (source.verification as { issuer: string }).issuer = "changed-after-read";
    expect(result.value.verification.issuer).toBe("YELLOW-TEST-IRP");
  });

  test("accepts only the exact one-row null shape and sanitizes every other result envelope", async () => {
    const service = new FiscalSubmissionReceiptReadService();
    const responses: readonly [unknown, FiscalSubmissionDeliveryReadResult][] = [
      [[{ receipt: null }], { ok: true, value: null }],
      [[], invalidRead("invalid_receipt")],
      [[{ receipt: null }, { receipt: null }], invalidRead("invalid_receipt")],
      [[null], invalidRead("invalid_receipt")],
      [[{}], invalidRead("invalid_receipt")],
      [[{ receipt: null, extra: true }], invalidRead("invalid_receipt")],
      [{ 0: { receipt: null }, length: 1 }, invalidRead("invalid_receipt")],
    ];
    for (const [rows, expected] of responses) {
      const tx = (async () => rows) as unknown as Tx;
      expect(await service.read(tx, deliveryInput())).toEqual(expected);
    }
  });

  test("binds tenant/property/submission on returned rows and never substitutes actor identity", async () => {
    const service = new FiscalSubmissionReceiptReadService();
    for (const field of ["tenantId", "propertyNode", "submissionId"] as const) {
      const foreign = { ...deliveryAccepted(), [field]: crypto.randomUUID() };
      const tx = (async () => [{ receipt: foreign }]) as unknown as Tx;
      expect(await service.read(tx, deliveryInput())).toEqual(invalidRead("invalid_receipt"));
    }
    let values: readonly unknown[] = [];
    const tx = (async (_strings: TemplateStringsArray, ...args: unknown[]) => {
      values = args;
      return [{ receipt: deliveryAccepted() }];
    }) as unknown as Tx;
    const result = await service.read(tx, deliveryInput());
    expect(result.ok).toBe(true);
    expect(values[3]).toBe(deliveryIds.actorId);
    expect(values[3]).not.toBe(deliveryIds.tenantId);
  });

  test("rejects hostile inputs before Tx and does not evaluate input accessors or proxy traps", async () => {
    let calls = 0;
    const tx = (async () => { calls += 1; return [{ receipt: null }]; }) as unknown as Tx;
    const service = new FiscalSubmissionReceiptReadService();
    for (const input of [null, [], { ...deliveryInput(), extra: true },
      { ...deliveryInput(), actorId: "bad" }, Object.assign(Object.create({}), deliveryInput())]) {
      expect(await service.read(tx, input)).toEqual(invalidRead("invalid_input"));
    }
    let getterCalls = 0;
    const accessor = { ...deliveryInput() };
    Object.defineProperty(accessor, "actorId", { enumerable: true,
      get() { getterCalls += 1; return deliveryIds.actorId; } });
    expect(await service.read(tx, accessor)).toEqual(invalidRead("invalid_input"));
    expect(getterCalls).toBe(0);
    const proxy = new Proxy(deliveryInput(), { get() { throw new Error("input proxy trap executed"); } });
    expect(await service.read(tx, proxy)).toEqual(invalidRead("invalid_input"));
    expect(calls).toBe(0);
  });

  test("rejects proxied/accessor database result containers without evaluating their traps", async () => {
    const service = new FiscalSubmissionReceiptReadService();
    let wrapperAccessorCalls = 0;
    const wrapper: Record<string, unknown> = {};
    Object.defineProperty(wrapper, "receipt", { enumerable: true,
      get() { wrapperAccessorCalls += 1; return deliveryAccepted(); } });
    const wrapperTx = (async () => [wrapper]) as unknown as Tx;
    expect(await service.read(wrapperTx, deliveryInput())).toEqual(invalidRead("invalid_receipt"));
    expect(wrapperAccessorCalls).toBe(0);

    let accessorCalls = 0;
    const accessorRows: unknown[] = [];
    Object.defineProperty(accessorRows, "0", { enumerable: true, configurable: true,
      get() { accessorCalls += 1; return { receipt: deliveryAccepted() }; } });
    const accessorTx = (async () => accessorRows) as unknown as Tx;
    expect(await service.read(accessorTx, deliveryInput())).toEqual(invalidRead("invalid_receipt"));
    expect(accessorCalls).toBe(0);

    const proxyReads: PropertyKey[] = [];
    const proxyRows = new Proxy([{ receipt: deliveryAccepted() }], {
      get(target, property, receiver) {
        proxyReads.push(property);
        return Reflect.get(target, property, receiver);
      },
    });
    const proxyTx = (async () => proxyRows) as unknown as Tx;
    expect(await service.read(proxyTx, deliveryInput())).toEqual(invalidRead("invalid_receipt"));
    // Returning a Proxy from an async function necessarily performs the ECMAScript
    // Promise-resolution `then` lookup before the service receives the value.
    expect(proxyReads).toEqual(["then"]);
    expect(proxyReads).not.toContain("length");
    expect(proxyReads).not.toContain("0");
  });

  test("accepts a data-only driver Array subclass with harmless result metadata", async () => {
    class DriverRows<T> extends Array<T> {}
    const rows = new DriverRows<{ receipt: unknown }>();
    rows.push({ receipt: deliveryAccepted() });
    Object.defineProperties(rows, {
      rowCount: { value: 1, enumerable: false },
      command: { value: "SELECT", enumerable: true },
    });
    const tx = (async () => rows) as unknown as Tx;
    const result = await new FiscalSubmissionReceiptReadService().read(tx, deliveryInput());
    expect(result.ok).toBe(true);
    expect(result.ok && result.value?.kind).toBe("accepted_signed_v1");
  });

  test("maps thrown transaction failures to one frozen sanitized error", async () => {
    const tx = (async () => { throw new Error("postgres://private:secret@host/database SQL body"); }) as unknown as Tx;
    const result = await new FiscalSubmissionReceiptReadService().read(tx, deliveryInput());
    expect(result).toEqual(invalidRead("database_error"));
    expect(Object.isFrozen(result)).toBe(true);
    expect(!result.ok && Object.isFrozen(result.error)).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/private|secret|postgres|SQL body/u);
  });
});
