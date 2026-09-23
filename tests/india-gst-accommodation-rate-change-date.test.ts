import { describe, expect, test } from "bun:test";

import { deriveIndiaGstAccommodationRateChangeDate } from "../src/contexts/tax-fiscal";

type AnyRecord = Record<PropertyKey, any>;

const id = (n: number): string =>
  `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;

const PROPERTY = id(30703);
const TENANT = id(30702);
const PREDECESSOR = "a806f516-fed6-5768-b310-94aa03286adb";
const SUCCESSOR = "0b21daf2-ea6e-5568-9c21-69e4d4424574";
const OTHER = id(30706);
const KEY = "in-gst-lodging";
const PRE_FROM = "2022-07-17T18:30:00.000000Z";
const CUTOVER = "2025-09-21T18:30:00.000000Z";
const RATE_CHANGE_DATE = "2025-09-22";
const SOURCE20 = "ee920c82c30ed88d9bb515d7d79b975cc2ed599c6dad411d04d8b7fcd5a86901";
const SOURCE04 = "c6d264f1906375e93466dd97b2c60bb9b21c0dec34b93900b15237b4a98b7716";
const SOURCE15 = "46c9447579017d8bf1fefd75b6e6a48856dab7b23e44c7e06babfdc99ae9d289";

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
}

function hash(value: unknown): string {
  return new Bun.CryptoHasher("sha256").update(stableJson(value)).digest("hex");
}

const content = (lowerRate: number, lowerItc: boolean): AnyRecord => ({
  country: "IN",
  price_display: "tax_exclusive",
  rounding: "document",
  taxes: [
    {
      code: "GST_ROOM",
      name: "GST on accommodation",
      mode: "slab_percent",
      slab_basis: "transaction_value",
      applies_to: ["room_revenue"],
      slabs: [
        { upto_minor: 750000, rate: lowerRate, itc_eligible: lowerItc },
        { upto_minor: null, rate: 0.18, itc_eligible: true },
      ],
    },
    {
      code: "GST_FNB",
      name: "GST on F&B (restaurant in hotel)",
      mode: "percent",
      rate: 0.05,
      applies_to: ["fnb_revenue"],
    },
  ],
});

const version = (
  extensionId: string,
  versionNumber: 1 | 2,
  status: "retired" | "active",
  lowerRate: number,
  lowerItc: boolean,
  from: string,
  to: string | null,
): AnyRecord => {
  const extensionContent = content(lowerRate, lowerItc);
  return {
    extensionId,
    key: KEY,
    version: versionNumber,
    status,
    effectiveFromInstant: from,
    effectiveToInstant: to,
    content: extensionContent,
    contentHash: hash(extensionContent),
    gstRoomSlabs: [
      { uptoMinor: 750000, rate: lowerRate, itcEligible: lowerItc },
      { uptoMinor: null, rate: 0.18, itcEligible: true },
    ],
  };
};

function pair(): AnyRecord {
  const predecessor = version(PREDECESSOR, 1, "retired", 0.12, true, PRE_FROM, CUTOVER);
  const successor = version(SUCCESSOR, 2, "active", 0.05, false, CUTOVER, null);
  const body = {
    propertyNode: PROPERTY,
    predecessor,
    successor,
    cutoverInstant: CUTOVER,
    statutoryLowerBandDelta: {
      thresholdMinor: 750000,
      predecessorRate: 0.12,
      predecessorItcEligible: true,
      successorRate: 0.05,
      successorItcEligible: false,
      predecessorHasNilBand: false,
      successorHasNilBand: false,
    },
    sourceHashes: {
      notification20_2019: SOURCE20,
      notification04_2022: SOURCE04,
      notification15_2025: SOURCE15,
    },
  };
  return {
    ...body,
    evidenceHash: hash({
      tenantId: TENANT,
      predecessorOwnerTenantId: null,
      successorOwnerTenantId: null,
      ...body,
    }),
  };
}

function rehashPair(value: AnyRecord): void {
  value.predecessor.contentHash = hash(value.predecessor.content);
  value.successor.contentHash = hash(value.successor.content);
  const { evidenceHash: _discarded, ...body } = value;
  value.evidenceHash = hash({
    tenantId: TENANT,
    predecessorOwnerTenantId: null,
    successorOwnerTenantId: null,
    ...body,
  });
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function deeplyFrozen(value: unknown, seen = new Set<object>()): void {
  if (typeof value !== "object" || value === null || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBeTrue();
  for (const key of Reflect.ownKeys(value)) deeplyFrozen((value as AnyRecord)[key], seen);
}

function derive(value: unknown): AnyRecord {
  return deriveIndiaGstAccommodationRateChangeDate({
    tenantId: TENANT,
    rateVersionPair: value,
  } as never) as AnyRecord;
}

describe("Order 307: India GST accommodation rate-change date", () => {
  test("derives only 2025-09-22 from the exact pair and binds cutover/source/pair evidence", () => {
    const input = pair();
    const result = derive(input);
    const text = JSON.stringify(result);

    expect(text).toContain(PREDECESSOR);
    expect(text).toContain(SUCCESSOR);
    expect(text).toContain(CUTOVER);
    expect(text).toContain(RATE_CHANGE_DATE);
    expect(text).toContain(SOURCE15);
    expect(text).toContain(input.evidenceHash);
    expect((result.rateChangeDate ?? result.changeDate)).toBe(RATE_CHANGE_DATE);
    expect(result.cutoverInstant).toBe(CUTOVER);
    expect(result.pairEvidenceHash).toBe(input.evidenceHash);
    expect(result.notification15SourceHash ?? result.sourceHash).toBe(SOURCE15);
  });

  test("accepts only the exact pair shape and rejects caller date, clock, timezone, calendar or latest authority", () => {
    const valid = pair();
    const hostile: unknown[] = [
      null,
      [],
      { ...valid, rateChangeDate: RATE_CHANGE_DATE },
      { ...valid, date: RATE_CHANGE_DATE },
      { ...valid, clock: "2025-09-21T18:30:00.000000Z" },
      { ...valid, timezone: "Asia/Kolkata" },
      { ...valid, calendar: "india-gazette" },
      { ...valid, latest: true },
      { ...valid, now: "2025-09-22" },
      { ...valid, predecessorExtensionId: PREDECESSOR },
      { ...valid, tenantId: id(30701) },
      { propertyNode: valid.propertyNode },
      new Proxy(valid, {}),
      { ...valid, [Symbol("hostile")]: true },
    ];
    for (const value of hostile) expect(() => derive(value)).toThrow();

    const accessor = clone(valid) as AnyRecord;
    Object.defineProperty(accessor, "cutoverInstant", {
      enumerable: true,
      get: () => CUTOVER,
    });
    expect(() => derive(accessor)).toThrow();

    expect(() => deriveIndiaGstAccommodationRateChangeDate({
      tenantId: OTHER,
      rateVersionPair: pair(),
    } as never)).toThrow();
    expect(() => deriveIndiaGstAccommodationRateChangeDate({
      tenantId: TENANT,
      rateVersionPair: Object.freeze({ ...pair(), evidenceHash: "0".repeat(64) }),
    } as never)).toThrow();
    expect(() => deriveIndiaGstAccommodationRateChangeDate({
      tenantId: TENANT,
      rateVersionPair: pair(),
      rateChangeDate: RATE_CHANGE_DATE,
    } as never)).toThrow();
  });

  test("rejects every identity, owner-visible shape, version, status, period and microsecond mutation", () => {
    const mutants: Array<(value: AnyRecord) => void> = [
      (value) => { value.predecessor.extensionId = OTHER; },
      (value) => { value.successor.extensionId = OTHER; },
      (value) => { value.predecessor.version = 2; },
      (value) => { value.successor.version = 1; },
      (value) => { value.predecessor.status = "active"; },
      (value) => { value.successor.status = "retired"; },
      (value) => { value.predecessor.effectiveFromInstant = "2022-07-17T18:30:00.000001Z"; },
      (value) => { value.predecessor.effectiveToInstant = "2025-09-21T18:30:00.000001Z"; },
      (value) => { value.successor.effectiveFromInstant = "2025-09-21T18:30:00.000001Z"; },
      (value) => { value.successor.effectiveToInstant = CUTOVER; },
      (value) => { value.predecessor.ownerTenantId = id(30701); },
      (value) => { value.successor.tenantId = id(30701); },
    ];
    for (const mutate of mutants) {
      const candidate = clone(pair());
      mutate(candidate);
      expect(() => derive(candidate)).toThrow();
    }
  });

  test("rejects rates, thresholds, ITC/nil bands, source hashes, pair hash and content hashes", () => {
    const mutants: Array<(value: AnyRecord) => void> = [
      (value) => { value.predecessor.content.taxes[0].slabs[0].rate = 0.05; },
      (value) => { value.successor.content.taxes[0].slabs[0].rate = 0.12; },
      (value) => { value.predecessor.content.taxes[0].slabs[1].rate = 0.05; },
      (value) => { value.successor.content.taxes[0].slabs[1].rate = 0.05; },
      (value) => { value.predecessor.content.taxes[0].slabs[0].upto_minor = 750001; },
      (value) => { value.successor.content.taxes[0].slabs[0].upto_minor = null; },
      (value) => { value.predecessor.content.taxes[0].slabs[0].itc_eligible = false; },
      (value) => { value.successor.content.taxes[0].slabs[0].itc_eligible = true; },
      (value) => { value.predecessor.content.taxes[0].slabs[0].upto_minor = null; },
      (value) => { value.successor.content.taxes[0].slabs[1].upto_minor = 900000; },
      (value) => { value.predecessor.gstRoomSlabs[0].rate = 0.05; },
      (value) => { value.successor.gstRoomSlabs[1].itcEligible = false; },
      (value) => { value.statutoryLowerBandDelta.thresholdMinor = 100000; },
      (value) => { value.statutoryLowerBandDelta.predecessorRate = 0.05; },
      (value) => { value.statutoryLowerBandDelta.successorItcEligible = true; },
      (value) => { value.statutoryLowerBandDelta.predecessorHasNilBand = true; },
      (value) => { value.statutoryLowerBandDelta.successorHasNilBand = true; },
      (value) => { value.sourceHashes.notification20_2019 = "0".repeat(64); },
      (value) => { value.sourceHashes.notification04_2022 = "0".repeat(64); },
      (value) => { value.sourceHashes.notification15_2025 = "0".repeat(64); },
      (value) => { value.evidenceHash = "not-a-sha256"; },
      (value) => { value.predecessor.contentHash = "0".repeat(64); },
      (value) => { value.successor.contentHash = "0".repeat(64); },
    ];
    for (const mutate of mutants) {
      const candidate = clone(pair());
      mutate(candidate);
      expect(() => derive(candidate)).toThrow();
    }
  });

  test("revalidates governed content even when a hostile caller recomputes every public hash", () => {
    const mutants: Array<(value: AnyRecord) => void> = [
      (value) => { value.predecessor.content.country = "CA"; },
      (value) => { value.successor.content.rounding = "line"; },
      (value) => { value.predecessor.content.taxes[0].name = "forged"; },
      (value) => { value.successor.content.taxes[0].mode = "percent"; },
      (value) => { value.predecessor.content.taxes[0].slab_basis = "folio_total"; },
      (value) => { value.successor.content.taxes[0].applies_to = ["fnb_revenue"]; },
      (value) => { value.predecessor.content.taxes[0].slabs[0].rate = 0.05; },
      (value) => { value.successor.content.taxes[0].slabs[0].itc_eligible = true; },
    ];
    for (const mutate of mutants) {
      const candidate = clone(pair());
      mutate(candidate);
      rehashPair(candidate);
      expect(() => derive(candidate)).toThrow();
    }
  });

  test("rejects hostile proxies, accessors and symbols at every evidence boundary", () => {
    const proxyPair = clone(pair());
    proxyPair.predecessor = new Proxy(proxyPair.predecessor, {});
    expect(() => derive(proxyPair)).toThrow();

    const proxyContent = clone(pair());
    proxyContent.successor.content = new Proxy(proxyContent.successor.content, {});
    expect(() => derive(proxyContent)).toThrow();

    const symbolContent = clone(pair());
    symbolContent.predecessor.content[Symbol("hostile")] = true;
    expect(() => derive(symbolContent)).toThrow();

    const accessorEvidence = clone(pair());
    Object.defineProperty(accessorEvidence.successor, "contentHash", {
      enumerable: true,
      get: () => accessorEvidence.successor.contentHash,
    });
    expect(() => derive(accessorEvidence)).toThrow();

    const symbolPair = clone(pair());
    symbolPair.sourceHashes[Symbol("hostile")] = true;
    expect(() => derive(symbolPair)).toThrow();
  });

  test("returns recursively frozen, byte-stable evidence with hash-bound pair identity", () => {
    const input = pair();
    const first = derive(input);
    const second = derive(pair());
    deeplyFrozen(first);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first.evidenceHash).toMatch(/^[0-9a-f]{64}$/);
    expect(first.evidenceHash).toBe(hash({
      propertyNode: PROPERTY,
      predecessor: first.predecessor,
      successor: first.successor,
      cutoverInstant: first.cutoverInstant,
      rateChangeDate: first.rateChangeDate,
      notification15SourceHash: first.notification15SourceHash,
      pairEvidenceHash: first.pairEvidenceHash,
    }));
    expect(first.pairEvidenceHash).toBe(input.evidenceHash);
    expect(JSON.stringify(first)).not.toContain(id(30701));
    expect(JSON.stringify(first)).not.toContain("tenantId");

  });

  test("remains a pure evidence bridge with no SQL or persistence verbs", async () => {
    const source = await Bun.file(new URL(
      "../src/contexts/tax-fiscal/india-gst-accommodation-rate-change-date.ts",
      import.meta.url,
    )).text();
    expect(source).not.toMatch(/\b(?:SELECT\s+.+\s+FROM|INSERT\s+INTO|UPDATE\s+\S+\s+SET|DELETE\s+FROM|TRUNCATE\s+TABLE|CREATE\s+TABLE|ALTER\s+TABLE|DROP\s+TABLE)\b/i);
    expect(source).not.toMatch(/\b(?:SQL|Database|Tx)\b/);
  });
});
