import { describe, expect, test } from "bun:test";
import {
  createPropertyOperatingModeAttempt,
  clearPropertyOperatingModeDraft,
  isPropertyOperatingModeReceipt,
  isPropertyOperatingModeReceiptForAttempt,
  isPropertyOperatingModeSnapshot,
  reconcilePropertyOperatingModeAttempt,
  readPropertyOperatingModeDraft,
  samePropertyOperatingModeAttempt,
  writePropertyOperatingModeDraft,
  type PropertyOperatingModeSnapshot,
} from "../frontend/yellow/src/property-operating-mode";

const propertyNode = "30000000-0000-4000-8000-000000000003";
const idempotencyKey = "40000000-0000-4000-8000-000000000004";
const correlationId = "50000000-0000-4000-8000-000000000005";
const scope = { tenantId: "60000000-0000-4000-8000-000000000006", actorId: "70000000-0000-4000-8000-000000000007" };
const unconfigured: PropertyOperatingModeSnapshot = {
  propertyNode, mode: null, version: 0, effectiveAt: null, effectiveBusinessDate: null, canWrite: true,
};

describe("property operating mode version and retry contract", () => {
  test("accepts exact snapshots and receipts and rejects malformed or cross-property replies", () => {
    const configured = { ...unconfigured, mode: "both", version: 2, effectiveAt: "2026-10-01T10:00:00.000Z", effectiveBusinessDate: "2026-10-01" };
    expect(isPropertyOperatingModeSnapshot(unconfigured, propertyNode)).toBe(true);
    expect(isPropertyOperatingModeSnapshot(configured, propertyNode)).toBe(true);
    expect(isPropertyOperatingModeSnapshot({ ...unconfigured, version: 1 }, propertyNode)).toBe(false);
    expect(isPropertyOperatingModeSnapshot({ ...configured, version: 0 }, propertyNode)).toBe(false);
    expect(isPropertyOperatingModeSnapshot({ ...configured, effectiveAt: null }, propertyNode)).toBe(false);
    expect(isPropertyOperatingModeSnapshot({ ...configured, version: 2147483648 }, propertyNode)).toBe(false);
    expect(isPropertyOperatingModeSnapshot({ ...configured, effectiveAt: "nonsense" }, propertyNode)).toBe(false);
    expect(isPropertyOperatingModeSnapshot({ ...configured, effectiveAt: "2026-02-30T10:00:00.000Z" }, propertyNode)).toBe(false);
    expect(isPropertyOperatingModeSnapshot({ ...configured, effectiveBusinessDate: "2026-99-99" }, propertyNode)).toBe(false);
    expect(isPropertyOperatingModeSnapshot({ ...configured, effectiveBusinessDate: "2026-02-30" }, propertyNode)).toBe(false);
    expect(isPropertyOperatingModeSnapshot({ ...configured, propertyNode: idempotencyKey }, propertyNode)).toBe(false);
    expect(isPropertyOperatingModeSnapshot({ ...configured, unexpected: true }, propertyNode)).toBe(false);
    expect(isPropertyOperatingModeReceipt({ propertyMode: configured, changed: true, replayed: false }, propertyNode)).toBe(true);
    expect(isPropertyOperatingModeReceipt({ propertyMode: configured, changed: true, replayed: false, extra: 1 }, propertyNode)).toBe(false);
  });

  test("a retry preserves the exact version, mode, idempotency key, and correlation ID", () => {
    const attempt = createPropertyOperatingModeAttempt(0, "str", idempotencyKey, correlationId);
    expect(samePropertyOperatingModeAttempt(attempt, { ...attempt })).toBe(true);
    expect(createPropertyOperatingModeAttempt(attempt.expectedVersion, attempt.mode, attempt.idempotencyKey, attempt.correlationId)).toEqual(attempt);
    expect(() => createPropertyOperatingModeAttempt(-1, "hotel", idempotencyKey, correlationId)).toThrow();
    expect(() => createPropertyOperatingModeAttempt(0, "invalid" as "hotel", idempotencyKey, correlationId)).toThrow();
  });

  test("uncertain outcomes resolve only from a newer matching version or become a visible conflict", () => {
    const attempt = createPropertyOperatingModeAttempt(4, "str", idempotencyKey, correlationId);
    expect(reconcilePropertyOperatingModeAttempt(attempt, { ...unconfigured, version: 4, mode: "hotel" })).toBe("pending");
    expect(reconcilePropertyOperatingModeAttempt(attempt, { ...unconfigured, version: 5, mode: "str" })).toBe("accepted");
    expect(reconcilePropertyOperatingModeAttempt(attempt, { ...unconfigured, version: 5, mode: "both" })).toBe("conflict");
    expect(reconcilePropertyOperatingModeAttempt(attempt, { ...unconfigured, version: 6, mode: "str" })).toBe("conflict");
  });

  test("successful receipt must match the attempted mode and exact compare-and-set version", () => {
    const attempt = createPropertyOperatingModeAttempt(4, "str", idempotencyKey, correlationId);
    const accepted = { propertyMode: { ...unconfigured, mode: "str", version: 5, effectiveAt: "2026-10-01T10:00:00.000Z", effectiveBusinessDate: "2026-10-01" }, changed: true, replayed: false };
    expect(isPropertyOperatingModeReceiptForAttempt(accepted, propertyNode, attempt)).toBe(true);
    expect(isPropertyOperatingModeReceiptForAttempt({ ...accepted, propertyMode: { ...accepted.propertyMode, mode: "hotel" } }, propertyNode, attempt)).toBe(false);
    expect(isPropertyOperatingModeReceiptForAttempt({ ...accepted, propertyMode: { ...accepted.propertyMode, version: 999 } }, propertyNode, attempt)).toBe(false);
    expect(isPropertyOperatingModeReceiptForAttempt({ ...accepted, propertyMode: unconfigured, changed: false }, propertyNode, createPropertyOperatingModeAttempt(0, "str", idempotencyKey, correlationId))).toBe(false);
    expect(isPropertyOperatingModeReceipt({ propertyMode: unconfigured, changed: false, replayed: true }, propertyNode)).toBe(true);
  });

  test("pending attempt recovery is exact, explicit data and isolated by session actor and property", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
    };
    const attempt = createPropertyOperatingModeAttempt(0, "str", idempotencyKey, correlationId);
    writePropertyOperatingModeDraft(storage, scope, propertyNode, { selection: "str", attempt });
    expect(readPropertyOperatingModeDraft(storage, scope, propertyNode)).toEqual({ selection: "str", attempt });
    expect(readPropertyOperatingModeDraft(storage, { ...scope, actorId: correlationId }, propertyNode)).toBeNull();
    expect(readPropertyOperatingModeDraft(storage, scope, idempotencyKey)).toBeNull();
    expect(() => writePropertyOperatingModeDraft(storage, scope, propertyNode, { selection: "hotel", attempt })).toThrow();
    clearPropertyOperatingModeDraft(storage, scope, propertyNode);
    expect(readPropertyOperatingModeDraft(storage, scope, propertyNode)).toBeNull();
  });

});
