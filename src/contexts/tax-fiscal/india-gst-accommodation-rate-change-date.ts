import { types as utilTypes } from "node:util";

import type { IndiaGstAccommodationRateVersionPairResult } from "./india-gst-accommodation-rate-version-pair";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const PREDECESSOR_ID = "a806f516-fed6-5768-b310-94aa03286adb";
const SUCCESSOR_ID = "0b21daf2-ea6e-5568-9c21-69e4d4424574";
const PREDECESSOR_FROM = "2022-07-17T18:30:00.000000Z";
const CUTOVER = "2025-09-21T18:30:00.000000Z";
const RATE_CHANGE_DATE = "2025-09-22";
const SOURCE_20 = "ee920c82c30ed88d9bb515d7d79b975cc2ed599c6dad411d04d8b7fcd5a86901";
const SOURCE_04 = "c6d264f1906375e93466dd97b2c60bb9b21c0dec34b93900b15237b4a98b7716";
const SOURCE_15 = "46c9447579017d8bf1fefd75b6e6a48856dab7b23e44c7e06babfdc99ae9d289";

const PAIR_KEYS = ["propertyNode", "predecessor", "successor", "cutoverInstant", "statutoryLowerBandDelta", "sourceHashes", "evidenceHash"] as const;
const VERSION_KEYS = ["extensionId", "key", "version", "status", "effectiveFromInstant", "effectiveToInstant", "content", "contentHash", "gstRoomSlabs"] as const;
const DELTA_KEYS = ["thresholdMinor", "predecessorRate", "predecessorItcEligible", "successorRate", "successorItcEligible", "predecessorHasNilBand", "successorHasNilBand"] as const;
const SOURCE_KEYS = ["notification20_2019", "notification04_2022", "notification15_2025"] as const;
const SLAB_KEYS = ["uptoMinor", "rate", "itcEligible"] as const;
const CONTENT_KEYS = ["country", "price_display", "rounding", "taxes"] as const;
const GST_ROOM_KEYS = ["code", "name", "mode", "slab_basis", "applies_to", "slabs"] as const;
const CONTENT_SLAB_KEYS = ["upto_minor", "rate", "itc_eligible"] as const;
const INPUT_KEYS = ["tenantId", "rateVersionPair"] as const;

type RecordValue = Record<string, unknown>;

export interface IndiaGstAccommodationRateChangeDateIdentity {
  readonly extensionId: string;
  readonly version: 1 | 2;
  readonly status: "retired" | "active";
  readonly effectiveFromInstant: string;
  readonly effectiveToInstant: string | null;
  readonly contentHash: string;
}

export interface IndiaGstAccommodationRateChangeDateResult {
  readonly predecessor: IndiaGstAccommodationRateChangeDateIdentity;
  readonly successor: IndiaGstAccommodationRateChangeDateIdentity;
  readonly cutoverInstant: typeof CUTOVER;
  readonly rateChangeDate: typeof RATE_CHANGE_DATE;
  readonly notification15SourceHash: typeof SOURCE_15;
  readonly pairEvidenceHash: string;
  readonly evidenceHash: string;
}

export interface IndiaGstAccommodationRateChangeDateInput {
  readonly tenantId: string;
  readonly rateVersionPair: IndiaGstAccommodationRateVersionPairResult;
}

export class IndiaGstAccommodationRateChangeDateValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaGstAccommodationRateChangeDateValidationError";
  }
}

function fail(message: string): never { throw new IndiaGstAccommodationRateChangeDateValidationError(message); }

function exact(value: unknown, expected: readonly string[], subject: string): RecordValue {
  if (typeof value !== "object" || value === null || Array.isArray(value) || utilTypes.isProxy(value)
      || Object.getOwnPropertySymbols(value).length !== 0
      || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    return fail(`${subject} must be an exact plain object`);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Object.keys(descriptors).sort();
  const wanted = [...expected].sort();
  if (keys.length !== wanted.length || keys.some((key, index) => key !== wanted[index])
      || Object.values(descriptors).some((descriptor) => descriptor.get !== undefined || descriptor.set !== undefined
        || descriptor.enumerable !== true || !("value" in descriptor))) {
    return fail(`${subject} shape is invalid`);
  }
  return value as RecordValue;
}

function uuid(value: unknown, subject: string): string {
  return typeof value === "string" && UUID.test(value) ? value : fail(`${subject} must be a canonical UUID`);
}

function hash(value: unknown, subject: string): string {
  return typeof value === "string" && SHA256.test(value) ? value : fail(`${subject} must be a canonical SHA-256`);
}

function canonicalJson(value: unknown, ancestors = new Set<object>(), depth = 0): string {
  if (depth > 64) return fail("pair evidence is too deeply nested");
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") return Number.isFinite(value) ? JSON.stringify(Object.is(value, -0) ? 0 : value) : fail("pair evidence contains a non-finite number");
  if (typeof value !== "object" || utilTypes.isProxy(value) || ancestors.has(value)) return fail("pair evidence is not canonical JSON");
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      if (Object.getOwnPropertySymbols(value).length !== 0) return fail("pair evidence arrays must not contain symbol keys");
      const keys = Object.keys(value);
      const names = Object.getOwnPropertyNames(value);
      if (keys.length !== value.length || names.length !== value.length + 1 || names[value.length] !== "length"
          || keys.some((key, index) => key !== String(index))) return fail("pair evidence arrays must be dense");
      for (const key of keys) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor || descriptor.get !== undefined || descriptor.set !== undefined || descriptor.enumerable !== true || !("value" in descriptor)) return fail("pair evidence arrays must contain data fields only");
      }
      return `[${value.map((item) => canonicalJson(item, ancestors, depth + 1)).join(",")}]`;
    }
    if ((Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) || Object.getOwnPropertySymbols(value).length !== 0) return fail("pair evidence objects must be plain records");
    const keys = Object.keys(value);
    if (Object.getOwnPropertyNames(value).length !== keys.length) return fail("pair evidence objects must contain enumerable data fields only");
    return `{${keys.sort().map((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || descriptor.get !== undefined || descriptor.set !== undefined || descriptor.enumerable !== true || !("value" in descriptor)) return fail("pair evidence objects must contain data fields only");
      return `${JSON.stringify(key)}:${canonicalJson(descriptor.value, ancestors, depth + 1)}`;
    }).join(",")}}`;
  } finally {
    ancestors.delete(value);
  }
}

function exactArray(value: unknown, length: number, subject: string): readonly unknown[] {
  if (!Array.isArray(value) || utilTypes.isProxy(value) || Object.getOwnPropertySymbols(value).length !== 0) return fail(`${subject} must be an exact array`);
  const keys = Object.keys(value);
  const names = Object.getOwnPropertyNames(value);
  if (value.length !== length || keys.length !== length || names.length !== length + 1 || names[length] !== "length" || keys.some((key, index) => key !== String(index))) return fail(`${subject} shape is invalid`);
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || descriptor.get !== undefined || descriptor.set !== undefined || descriptor.enumerable !== true || !("value" in descriptor)) return fail(`${subject} must contain data fields only`);
  }
  return value;
}

function slabs(raw: unknown, lowerRate: 0.12 | 0.05, lowerItc: boolean, subject: string): void {
  const values = exactArray(raw, 2, `${subject} GST_ROOM slabs`);
  const lower = exact(values[0], SLAB_KEYS, `${subject} lower GST_ROOM slab`);
  const upper = exact(values[1], SLAB_KEYS, `${subject} upper GST_ROOM slab`);
  if (lower.uptoMinor !== 750000 || lower.rate !== lowerRate || lower.itcEligible !== lowerItc
      || upper.uptoMinor !== null || upper.rate !== 0.18 || upper.itcEligible !== true) {
    fail(`${subject} GST_ROOM slabs do not match the governed accommodation rates`);
  }
}

function contentSlabs(raw: unknown, lowerRate: 0.12 | 0.05, lowerItc: boolean, subject: string): void {
  const content = exact(raw, CONTENT_KEYS, `${subject} content`);
  if (content.country !== "IN" || content.price_display !== "tax_exclusive"
      || content.rounding !== "document" || !Array.isArray(content.taxes)
      || utilTypes.isProxy(content.taxes)) {
    fail(`${subject} content envelope is not the governed India lodging content`);
  }
  const taxes = exactArray(content.taxes, content.taxes.length, `${subject} taxes`);
  const matches = taxes.filter((tax) => typeof tax === "object" && tax !== null
    && !Array.isArray(tax) && !utilTypes.isProxy(tax)
    && Object.getOwnPropertyDescriptor(tax, "code")?.value === "GST_ROOM");
  if (matches.length !== 1) fail(`${subject} content must contain exactly one GST_ROOM definition`);
  const tax = exact(matches[0], GST_ROOM_KEYS, `${subject} GST_ROOM definition`);
  const appliesTo = exactArray(tax.applies_to, 1, `${subject} GST_ROOM applies_to`);
  if (tax.code !== "GST_ROOM" || tax.name !== "GST on accommodation"
      || tax.mode !== "slab_percent" || tax.slab_basis !== "transaction_value"
      || appliesTo[0] !== "room_revenue") {
    fail(`${subject} GST_ROOM definition is not the governed accommodation contract`);
  }
  const rawSlabs = exactArray(tax.slabs, 2, `${subject} content GST_ROOM slabs`);
  const lower = exact(rawSlabs[0], CONTENT_SLAB_KEYS, `${subject} content lower GST_ROOM slab`);
  const upper = exact(rawSlabs[1], CONTENT_SLAB_KEYS, `${subject} content upper GST_ROOM slab`);
  if (lower.upto_minor !== 750000 || lower.rate !== lowerRate || lower.itc_eligible !== lowerItc
      || upper.upto_minor !== null || upper.rate !== 0.18 || upper.itc_eligible !== true) {
    fail(`${subject} content GST_ROOM slabs do not match the governed accommodation rates`);
  }
}

function version(raw: unknown, expected: Readonly<{ id: string; version: 1 | 2; status: "retired" | "active"; from: string; to: string | null; rate: 0.12 | 0.05; itc: boolean }>, subject: string): IndiaGstAccommodationRateChangeDateIdentity {
  const value = exact(raw, VERSION_KEYS, subject);
  if (uuid(value.extensionId, `${subject} extension id`) !== expected.id || value.key !== "in-gst-lodging"
      || value.version !== expected.version || value.status !== expected.status || value.effectiveFromInstant !== expected.from || value.effectiveToInstant !== expected.to) {
    fail(`${subject} identity or period is not the governed rate version`);
  }
  const contentHash = hash(value.contentHash, `${subject} content hash`);
  if (new Bun.CryptoHasher("sha256").update(canonicalJson(value.content)).digest("hex") !== contentHash) fail(`${subject} content hash does not bind canonical content`);
  contentSlabs(value.content, expected.rate, expected.itc, subject);
  slabs(value.gstRoomSlabs, expected.rate, expected.itc, subject);
  return Object.freeze({ extensionId: expected.id, version: expected.version, status: expected.status, effectiveFromInstant: expected.from, effectiveToInstant: expected.to, contentHash });
}

function verify(
  raw: unknown,
  tenantId: string,
): Readonly<{ propertyNode: string; predecessor: IndiaGstAccommodationRateChangeDateIdentity; successor: IndiaGstAccommodationRateChangeDateIdentity; pairEvidenceHash: string }> {
  const value = exact(raw, PAIR_KEYS, "rate-version pair evidence");
  const propertyNode = uuid(value.propertyNode, "pair property node");
  if (value.cutoverInstant !== CUTOVER) fail("rate-version pair cutover is not the governed Kolkata transition");
  const delta = exact(value.statutoryLowerBandDelta, DELTA_KEYS, "statutory lower-band delta");
  if (delta.thresholdMinor !== 750000 || delta.predecessorRate !== 0.12 || delta.predecessorItcEligible !== true || delta.successorRate !== 0.05 || delta.successorItcEligible !== false || delta.predecessorHasNilBand !== false || delta.successorHasNilBand !== false) fail("statutory lower-band delta is not the governed accommodation change");
  const sources = exact(value.sourceHashes, SOURCE_KEYS, "notification source hashes");
  if (sources.notification20_2019 !== SOURCE_20 || sources.notification04_2022 !== SOURCE_04 || sources.notification15_2025 !== SOURCE_15) fail("notification source hashes are not the approved sources");
  const pairEvidenceHash = hash(value.evidenceHash, "rate-version pair evidence hash");
  const expectedPairHash = new Bun.CryptoHasher("sha256").update(canonicalJson({
    tenantId,
    predecessorOwnerTenantId: null,
    successorOwnerTenantId: null,
    propertyNode: value.propertyNode,
    predecessor: value.predecessor,
    successor: value.successor,
    cutoverInstant: value.cutoverInstant,
    statutoryLowerBandDelta: value.statutoryLowerBandDelta,
    sourceHashes: value.sourceHashes,
  })).digest("hex");
  if (pairEvidenceHash !== expectedPairHash) fail("rate-version pair evidence hash does not bind the tenant and pair");
  return Object.freeze({
    propertyNode,
    predecessor: version(value.predecessor, { id: PREDECESSOR_ID, version: 1, status: "retired", from: PREDECESSOR_FROM, to: CUTOVER, rate: 0.12, itc: true }, "predecessor rate version"),
    successor: version(value.successor, { id: SUCCESSOR_ID, version: 2, status: "active", from: CUTOVER, to: null, rate: 0.05, itc: false }, "successor rate version"),
    pairEvidenceHash,
  });
}

/** Evidence-only: no calendar, clock, tax calculation, or Section 14 conclusion. */
export function deriveIndiaGstAccommodationRateChangeDate(
  raw: IndiaGstAccommodationRateChangeDateInput,
): IndiaGstAccommodationRateChangeDateResult {
  const input = exact(raw, INPUT_KEYS, "rate-change date input");
  const tenantId = uuid(input.tenantId, "tenant id");
  const pair = verify(input.rateVersionPair, tenantId);
  const body = Object.freeze({ predecessor: pair.predecessor, successor: pair.successor, cutoverInstant: CUTOVER, rateChangeDate: RATE_CHANGE_DATE, notification15SourceHash: SOURCE_15, pairEvidenceHash: pair.pairEvidenceHash });
  return Object.freeze({ ...body, evidenceHash: new Bun.CryptoHasher("sha256").update(canonicalJson({ propertyNode: pair.propertyNode, ...body })).digest("hex") });
}
