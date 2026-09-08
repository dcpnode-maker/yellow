import { describe, expect, test } from "bun:test";
import type { Tx } from "../src/kernel";
import {
  IndiaNativeCreditDeliveryAuthorizationError,
  IndiaNativeCreditDeliveryDatabaseError,
  IndiaNativeCreditDeliveryService,
  IndiaNativeCreditDeliveryValidationError,
  snapshotIndiaNativeCreditDeliveryInput,
} from "../src/contexts/tax-fiscal";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const input = { tenantId: id(1), propertyNode: id(2), actorId: id(3), creditDocumentId: id(10) };
const pending = Object.freeze({
  kind: "pending" as const, submissionId: id(20), tenantId: id(1), propertyNode: id(2), documentId: id(10),
  documentSha256: "a".repeat(64), wireSha256: "b".repeat(64), providerKey: "clearirp",
  attemptId: id(21), attemptNumber: 1, status: "pending" as const, disposition: "send" as const, transitionSeq: 1,
});
const hash = (value: string) => new Bun.CryptoHasher("sha256").update(value).digest("hex");
const accepted = Object.freeze({
  ...pending, kind: "accepted_signed_v1" as const, status: "accepted" as const, disposition: "none" as const,
  environment: "sandbox" as const, responseSha256: "c".repeat(64), irn: "d".repeat(64), ackNo: "1",
  ackDt: "2044-09-07 12:00:00", signedInvoice: "a.b.c", signedQRCode: "d.e.f",
  signedInvoiceSha256: hash("a.b.c"), signedQrSha256: hash("d.e.f"),
  verification: Object.freeze({ profileVersion: "yellow_native_india_1_1_v1" as const, issuer: "test", verificationUnixMs: 1,
    invoiceKeyId: "invoice-key", invoiceKeySpkiSha256: "e".repeat(64), invoiceBundleVersion: "bundle-1",
    qrKeyId: "qr-key", qrKeySpkiSha256: "f".repeat(64), qrBundleVersion: "bundle-1" }),
});
const rejected = Object.freeze({ ...pending, kind: "rejected" as const, status: "rejected" as const,
  disposition: "none" as const, environment: "sandbox" as const, responseSha256: "c".repeat(64), errorCodes: ["E1"] });
const cancelled = Object.freeze({ ...pending, kind: "provider_cancelled" as const, status: "error" as const,
  disposition: "none" as const, environment: "sandbox" as const, responseSha256: "c".repeat(64), providerStatus: "CNL" as const });
const legacy = Object.freeze({ ...pending, kind: "legacy_hash_only" as const, status: "accepted" as const,
  disposition: "none" as const, authorityRef: null, responseSha256: null });
const retryable = Object.freeze({ ...pending, status: "error" as const, disposition: "retry" as const,
  retryBinding: Object.freeze({ providerExtensionId: id(30), providerExtensionVersion: 2 }) });

function deeplyFrozen(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return true;
  return Object.isFrozen(value) && Reflect.ownKeys(value).every(key => deeplyFrozen((value as Record<PropertyKey, unknown>)[key]));
}

function query(value: unknown) {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  const tx = (async (parts: TemplateStringsArray, ...values: unknown[]) => {
    calls.push({ sql: parts.join("?"), values });
    return typeof value === "function" ? value() : value;
  }) as unknown as Tx;
  return { tx, calls };
}

describe("Order452 native credit delivery reader", () => {
  const service = new IndiaNativeCreditDeliveryService();

  test("snapshots exact signed identity and reads every governed union state", async () => {
    expect(snapshotIndiaNativeCreditDeliveryInput(input)).toEqual(input);
    expect(Object.isFrozen(snapshotIndiaNativeCreditDeliveryInput(input))).toBe(true);
    for (const delivery of [null,
      { kind: "not_requested", documentId: id(10) },
      { kind: "ambiguous", documentId: id(10) },
      { kind: "legacy_unsupported", documentId: id(10), submissionId: id(20) },
      { kind: "receipt", documentId: id(10), receipt: pending },
      { kind: "receipt", documentId: id(10), receipt: accepted },
      { kind: "receipt", documentId: id(10), receipt: rejected },
      { kind: "receipt", documentId: id(10), receipt: cancelled },
      { kind: "receipt", documentId: id(10), receipt: legacy },
      { kind: "receipt", documentId: id(10), receipt: retryable },
    ] as const) {
      const db = query([{ delivery }]);
      const result = await service.read(db.tx, input);
      expect(result).toEqual(delivery === null ? null : delivery);
      expect(db.calls).toHaveLength(1);
      expect(db.calls[0]!.values).toEqual([id(1), id(2), id(3), id(10)]);
      expect(db.calls[0]!.sql).toContain("read_india_native_credit_delivery_by_document");
      expect(db.calls[0]!.sql).not.toMatch(/INSERT|UPDATE|DELETE|submissionId|providerKey/);
      if (result !== null) expect(deeplyFrozen(result)).toBe(true);
    }
  });

  test("rejects selectors, accessors, rebound identities and malformed SQL without a partial call", async () => {
    for (const bad of [null, [], { ...input, tenantId: "not-a-tenant" }, { ...input, selector: id(8) },
      { ...input, creditDocumentId: "not-a-uuid" }]) {
      const db = query([]);
      await expect(service.read(db.tx, bad)).rejects.toBeInstanceOf(IndiaNativeCreditDeliveryValidationError);
      expect(db.calls).toHaveLength(0);
    }
    let touched = 0;
    const accessor = Object.defineProperty({ ...input }, "actorId", { enumerable: true, get() { touched++; return id(3); } });
    const db = query([]);
    await expect(service.read(db.tx, accessor)).rejects.toBeInstanceOf(IndiaNativeCreditDeliveryValidationError);
    expect(db.calls).toHaveLength(0);
    expect(touched).toBe(0);
    const wrappedAccessor = Object.defineProperty({}, "delivery", { enumerable: true, get() { touched++; return pending; } });
    for (const delivery of [{ kind: "not_requested", documentId: id(99) },
      { kind: "receipt", documentId: id(10), receipt: { ...pending, tenantId: id(99) } },
      { kind: "receipt", documentId: id(10), receipt: { ...pending, propertyNode: id(99) } },
      { kind: "receipt", documentId: id(10), receipt: { ...pending, private: "secret" } },
      { kind: "receipt", documentId: id(10), receipt: { ...accepted, signedInvoiceSha256: "0".repeat(64) } },
      { kind: "receipt", documentId: id(10), receipt: { ...retryable, retryBinding: { providerExtensionId: id(30), providerExtensionVersion: 0 } } }]) {
      await expect(service.read(query([{ delivery }]).tx, input)).rejects.toBeInstanceOf(IndiaNativeCreditDeliveryDatabaseError);
    }
    await expect(service.read(query([wrappedAccessor]).tx, input)).rejects.toBeInstanceOf(IndiaNativeCreditDeliveryDatabaseError);
    expect(touched).toBe(0);
    const proxyInput = new Proxy(input, { getOwnPropertyDescriptor() { touched++; throw new Error("input trap"); } });
    await expect(service.read(query([]).tx, proxyInput)).rejects.toBeInstanceOf(IndiaNativeCreditDeliveryValidationError);
    expect(touched).toBe(0);
    for (const rows of [[], [{ delivery: null }, { delivery: null }], new Array(1), [{ delivery: pending }, undefined]]) {
      await expect(service.read(query(rows).tx, input)).rejects.toBeInstanceOf(IndiaNativeCreditDeliveryDatabaseError);
    }
  });

  test("maps owner authority and storage failures to sanitized domain errors", async () => {
    const denied = query(() => { throw Object.assign(new Error("private credential"), { errno: "42501" }); });
    await expect(service.read(denied.tx, input)).rejects.toBeInstanceOf(IndiaNativeCreditDeliveryAuthorizationError);
    const deniedWithDriverCode = query(() => {
      throw Object.assign(new Error("private credential"), { code: "ERR_POSTGRES_SERVER_ERROR", errno: "42501" });
    });
    await expect(service.read(deniedWithDriverCode.tx, input)).rejects.toBeInstanceOf(IndiaNativeCreditDeliveryAuthorizationError);
    const failed = query(() => { throw Object.assign(new Error("private credential"), { code: "XX000" }); });
    await expect(service.read(failed.tx, input)).rejects.toBeInstanceOf(IndiaNativeCreditDeliveryDatabaseError);
    let release!: () => void;
    const paused = new Promise<void>(resolve => { release = resolve; });
    const delayedInput = { ...input };
    const delayed = query(async () => {
      await paused;
      return [{ delivery: { kind: "not_requested", documentId: id(10) } }];
    });
    const pendingRead = service.read(delayed.tx, delayedInput);
    delayedInput.actorId = id(99);
    release();
    const result = await pendingRead;
    expect(result).toEqual({ kind: "not_requested", documentId: id(10) });
    expect(delayed.calls[0]!.values).toEqual([id(1), id(2), id(3), id(10)]);
    expect(deeplyFrozen(result)).toBe(true);
  });
});
