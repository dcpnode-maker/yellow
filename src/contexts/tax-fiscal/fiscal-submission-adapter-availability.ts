import { types as utilTypes } from "node:util";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PROVIDER_KEY = /^[a-z0-9](?:[a-z0-9._:-]{0,126}[a-z0-9])?$/;
const IDENTITY_KEYS = ["providerKey", "providerExtensionId", "providerExtensionVersion"] as const;

type RecordValue = Record<string, unknown>;

export interface FiscalSubmissionAdapterIdentity {
  readonly providerKey: string;
  readonly providerExtensionId: string;
  readonly providerExtensionVersion: number;
}

function invalid(): never {
  throw new Error("Fiscal submission adapter identity configuration is invalid");
}

function exactRecord(value: unknown): RecordValue | null {
  if (typeof value !== "object" || value === null || utilTypes.isProxy(value)) return null;
  try {
    if (Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.some((key) => typeof key === "symbol")) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    for (const key of keys) {
      const descriptor = descriptors[String(key)];
      if (!descriptor || descriptor.get !== undefined || descriptor.set !== undefined
          || !("value" in descriptor) || descriptor.enumerable !== true) return null;
    }
    return Object.fromEntries(keys.map((key) => [String(key), descriptors[String(key)]!.value]));
  } catch {
    return null;
  }
}

function identity(value: unknown): Readonly<FiscalSubmissionAdapterIdentity> | null {
  const row = exactRecord(value);
  if (!row) return null;
  const keys = Object.keys(row).sort();
  const expected = [...IDENTITY_KEYS].sort();
  if (keys.length !== expected.length || !keys.every((key, index) => key === expected[index])
      || typeof row.providerKey !== "string" || !PROVIDER_KEY.test(row.providerKey)
      || typeof row.providerExtensionId !== "string" || !UUID.test(row.providerExtensionId)
      || typeof row.providerExtensionVersion !== "number"
      || !Number.isSafeInteger(row.providerExtensionVersion) || row.providerExtensionVersion < 1) return null;
  return Object.freeze({
    providerKey: row.providerKey,
    providerExtensionId: row.providerExtensionId,
    providerExtensionVersion: row.providerExtensionVersion,
  });
}

function arrayValues(values: unknown): readonly unknown[] {
  if (typeof values === "object" && values !== null && utilTypes.isProxy(values)) return invalid();
  if (!Array.isArray(values) || Object.getPrototypeOf(values) !== Array.prototype) {
    return invalid();
  }
  const descriptors = Object.getOwnPropertyDescriptors(values) as Record<string, PropertyDescriptor>;
  const length = descriptors["length"];
  const lengthValue = length && "value" in length ? length.value : null;
  if (typeof lengthValue !== "number" || !Number.isSafeInteger(lengthValue) || lengthValue < 0) return invalid();
  const snapshot: unknown[] = [];
  for (let index = 0; index < lengthValue; index += 1) {
    const descriptor = descriptors[String(index)];
    if (!descriptor || descriptor.get !== undefined || descriptor.set !== undefined
        || !("value" in descriptor) || descriptor.enumerable !== true) return invalid();
    snapshot.push(descriptor.value);
  }
  const allowed = new Set(["length", ...snapshot.map((_, index) => String(index))]);
  if (Reflect.ownKeys(values).some((key) => typeof key === "symbol" || !allowed.has(String(key)))) return invalid();
  return snapshot;
}

/**
 * An identity-only projection of adapters selected by the composition root.
 * It deliberately carries no transport function and does not establish provider authentication.
 */
export class FiscalSubmissionAdapterAvailabilityService {
  readonly #byExtensionId: ReadonlyMap<string, Readonly<FiscalSubmissionAdapterIdentity>>;

  constructor(values: unknown) {
    const byExtensionId = new Map<string, Readonly<FiscalSubmissionAdapterIdentity>>();
    for (const value of arrayValues(values)) {
      const entry = identity(value);
      if (!entry || byExtensionId.has(entry.providerExtensionId)) invalid();
      byExtensionId.set(entry.providerExtensionId, entry);
    }
    this.#byExtensionId = byExtensionId;
    Object.freeze(this);
  }

  find(providerExtensionId: string): Readonly<FiscalSubmissionAdapterIdentity> | undefined {
    if (typeof providerExtensionId !== "string" || !UUID.test(providerExtensionId)) return undefined;
    return this.#byExtensionId.get(providerExtensionId);
  }
}
