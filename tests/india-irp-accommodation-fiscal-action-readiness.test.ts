import { describe, expect, test } from "bun:test";

import {
  IndiaIrpAccommodationFiscalActionReadinessService,
  IndiaIrpAccommodationFiscalActionReadinessValidationError,
} from "../src/contexts/tax-fiscal";

const IDS = {
  tenantId: "10000000-0000-4000-8000-000000000001",
  propertyNode: "b0000000-0000-4000-8000-00000000000b",
  reservationId: "80000000-0000-4000-8000-000000000008",
  folioId: "90000000-0000-4000-8000-000000000009",
  journalId: "40000000-0000-4000-8000-000000000004",
  recipientPartyId: "a0000000-0000-4000-8000-00000000000a",
  recipientRegistrationId: "c0000000-0000-4000-8000-00000000000c",
  classificationId: "e0000000-0000-4000-8000-00000000000e",
} as const;
const frozenInvalidInput = Object.freeze({
  ...IDS,
  supplyNatureAtTimeOfSupplyInput: Object.freeze({}),
  supplyNatureAtTimeOfSupplyResult: Object.freeze({}),
});

describe("Order429 hostile pure boundary", () => {
  test("rejects a missing transaction before any source access", async () => {
    await expect(new IndiaIrpAccommodationFiscalActionReadinessService().resolve(null as never, frozenInvalidInput as never))
      .rejects.toBeInstanceOf(IndiaIrpAccommodationFiscalActionReadinessValidationError);
  });

  test("rejects mutable or extra-key input graphs", async () => {
    const mutable = { ...frozenInvalidInput };
    await expect(new IndiaIrpAccommodationFiscalActionReadinessService().resolve((async () => []) as never, mutable as never))
      .rejects.toThrow("exact deeply frozen graph");
    const extra = Object.freeze({ ...frozenInvalidInput, extra: true });
    await expect(new IndiaIrpAccommodationFiscalActionReadinessService().resolve((async () => []) as never, extra as never))
      .rejects.toThrow("input shape is invalid");
  });
});
