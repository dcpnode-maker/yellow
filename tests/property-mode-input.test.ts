import { expect, test } from "bun:test";
import { parsePropertyModeBody, PropertyModeService, PropertyModeValidationError } from "../src/contexts/identity";
import { PostgresIdempotency, createAuditEnvelope, type Tx } from "../src/kernel";

test("mode input accepts only explicit mode and int32 expected version", () => {
  for (const mode of ["hotel", "str", "both"] as const)
    expect(parsePropertyModeBody({ expectedVersion: 0, mode })).toEqual({ expectedVersion: 0, mode });
  expect(parsePropertyModeBody({ expectedVersion: 2147483647, mode: "both" })).toEqual({ expectedVersion: 2147483647, mode: "both" });
  for (const body of [null, [], {}, { mode: "hotel" }, { expectedVersion: 0 }, { expectedVersion: 0, mode: "Hotel" },
    { expectedVersion: 0, mode: null }, { expectedVersion: -1, mode: "hotel" }, { expectedVersion: 1.1, mode: "hotel" },
    { expectedVersion: "0", mode: "str" }, { expectedVersion: 2147483648, mode: "both" },
    { expectedVersion: 0, mode: "hotel", tenantId: "injected" }, { expectedVersion: 0, mode: "hotel", canWrite: true }])
    expect(() => parsePropertyModeBody(body)).toThrow(PropertyModeValidationError);
});

test("mode service rejects malformed command inputs before SQL", async () => {
  let calls = 0;
  const tx = (() => { calls++; throw new Error("Unexpected SQL"); }) as unknown as Tx;
  const service = new PropertyModeService(new PostgresIdempotency());
  const id = "72000000-0000-4000-8000-000000000001";
  const base = { expectedVersion: 0, mode: "hotel" as const, idempotencyKey: "mode-input-fixture",
    envelope: createAuditEnvelope({ tenantId: id, actorId: id, propertyNode: id, requestId: id, operation: "property.operating-mode.changed" }) };
  for (const change of [{ expectedVersion: -1 }, { idempotencyKey: "short" }, { idempotencyKey: undefined },
    { envelope: { ...base.envelope, operation: "property.identity.changed" } },
    { envelope: { ...base.envelope, tenantId: "invalid" } }])
    await expect(service.set(tx, { ...base, ...change } as typeof base)).rejects.toBeInstanceOf(PropertyModeValidationError);
  expect(calls).toBe(0);
});
