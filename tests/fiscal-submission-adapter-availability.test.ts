import { describe, expect, test } from "bun:test";
import {
  FiscalSubmissionAdapterAvailabilityService,
} from "../src/contexts/tax-fiscal/fiscal-submission-adapter-availability";

const EXTENSION = "00000000-0000-4000-8000-000000004501";
const OTHER_EXTENSION = "00000000-0000-4000-8000-000000004502";
const valid = Object.freeze({
  providerKey: "india-irp:test",
  providerExtensionId: EXTENSION,
  providerExtensionVersion: 1,
});

describe("Q203 fiscal submission adapter identity availability", () => {
  test("copies and freezes exact identity-only configuration", () => {
    const mutable: { providerKey: string; providerExtensionId: string; providerExtensionVersion: number } = { ...valid };
    const directory = new FiscalSubmissionAdapterAvailabilityService([mutable]);
    mutable.providerKey = "changed-after-construction";

    const found = directory.find(EXTENSION);
    expect(found).toEqual(valid);
    expect(Object.isFrozen(found)).toBe(true);
    expect(Object.isFrozen(directory)).toBe(true);
    expect(directory.find(OTHER_EXTENSION)).toBeUndefined();
    expect(directory.find("not-a-uuid")).toBeUndefined();
    const coercing = { toString: () => { throw new Error("must not coerce"); } };
    expect(directory.find(coercing as never)).toBeUndefined();
    expect("submit" in (found ?? {})).toBe(false);
    expect("lookup" in (found ?? {})).toBe(false);
  });

  test("empty configuration is an explicit unavailable-by-default directory", () => {
    const directory = new FiscalSubmissionAdapterAvailabilityService([]);
    expect(directory.find(EXTENSION)).toBeUndefined();
  });

  test("rejects duplicate extension identities and every malformed or capability-bearing entry", () => {
    const accessor = { ...valid };
    Object.defineProperty(accessor, "providerKey", { enumerable: true, get: () => valid.providerKey });
    const proxy = new Proxy({ ...valid }, {});
    const revoked = Proxy.revocable({ ...valid }, {});
    revoked.revoke();
    const revokedArray = Proxy.revocable([valid], {});
    revokedArray.revoke();

    for (const values of [
      [valid, { ...valid }],
      [valid, { ...valid, providerKey: "india-irp:other", providerExtensionVersion: 2 }],
      [{ ...valid, submit: () => undefined }],
      [{ ...valid, lookup: () => undefined }],
      [{ ...valid, providerKey: "INVALID" }],
      [{ ...valid, providerExtensionId: "not-a-uuid" }],
      [{ ...valid, providerExtensionVersion: 0 }],
      [accessor],
      [proxy],
      [revoked.proxy],
      Object.assign([valid], { surplus: true }),
      new Proxy([valid], {}),
      revokedArray.proxy,
      null,
      {},
    ]) {
      expect(() => new FiscalSubmissionAdapterAvailabilityService(values)).toThrow(
        "Fiscal submission adapter identity configuration is invalid",
      );
    }
  });
});
