import { describe, expect, test } from "bun:test";

import { buildIndiaIrpSellerDetails } from "../src/contexts/tax-fiscal";

const REGISTRATION_ID = "00000000-0000-0000-0000-000000027501";
const PROPERTY_NODE = "00000000-0000-0000-0000-000000027502";
const EXTENSION_ID = "00000000-0000-0000-0000-000000027503";
const TENANT_ID = "00000000-0000-0000-0000-000000027504";
const JURISDICTION_HASH = "a".repeat(64);
const EVIDENCE_HASH = "b".repeat(64);
const GST_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

type MutableRecord = Record<PropertyKey, unknown>;

function freezeDeep<T>(value: T, seen = new Set<object>()): T {
  if (typeof value !== "object" || value === null || seen.has(value)) return value;
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    freezeDeep((value as MutableRecord)[key], seen);
  }
  return Object.freeze(value);
}

function expectDeepFrozen(value: unknown, seen = new Set<object>()): void {
  if (typeof value !== "object" || value === null || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBeTrue();
  for (const key of Reflect.ownKeys(value)) {
    expectDeepFrozen((value as MutableRecord)[key], seen);
  }
}

function supplier(overrides: Record<string, unknown> = {}): Readonly<Record<string, unknown>> {
  const jurisdictionOverride = overrides.jurisdiction;
  const jurisdiction = jurisdictionOverride === undefined
    ? {
        extensionId: EXTENSION_ID,
        ownerTenantId: TENANT_ID,
        key: "in.order275.gst.27",
        version: "7",
        contentHash: JURISDICTION_HASH,
      }
    : jurisdictionOverride;
  const source: Record<string, unknown> = {
    registrationId: REGISTRATION_ID,
    propertyNode: PROPERTY_NODE,
    scheme: "in-gstin",
    currency: "INR",
    jurisdiction,
    gstin: "27AAPFU0939F1ZV",
    stateCode: "27",
    legalName: "Yellow Hospitality Private Limited",
    tradeName: "Yellow Hotels",
    addressLine: "1 Marine Drive",
    locality: "Mumbai",
    postalCode: "400001",
    evidenceHash: EVIDENCE_HASH,
    ...overrides,
  };
  return freezeDeep(source);
}

function jsonClone(value: Readonly<Record<string, unknown>>): MutableRecord {
  return JSON.parse(JSON.stringify(value)) as MutableRecord;
}

function withDefect(
  base: Readonly<Record<string, unknown>>,
  mutate: (copy: Record<string, unknown>) => void,
): Readonly<Record<string, unknown>> {
  const copy = jsonClone(base);
  mutate(copy);
  return freezeDeep(copy);
}

function gstinForState(stateCode: string): string {
  const body = `${stateCode}AAPFU0939F1Z`;
  let factor = 2;
  let sum = 0;
  for (let index = body.length - 1; index >= 0; index -= 1) {
    const character = body[index];
    if (character === undefined) throw new Error("GSTIN test fixture is invalid");
    const addend = factor * GST_ALPHABET.indexOf(character);
    factor = factor === 2 ? 1 : 2;
    sum += Math.floor(addend / 36) + addend % 36;
  }
  const checksum = GST_ALPHABET[(36 - sum % 36) % 36];
  if (checksum === undefined) throw new Error("GSTIN checksum fixture is invalid");
  return `${body}${checksum}`;
}

function sha256(value: string): string {
  return new Bun.CryptoHasher("sha256").update(value).digest("hex");
}

function expectRejected(source: unknown): void {
  expect(() => buildIndiaIrpSellerDetails(source)).toThrow();
}

describe("Order 275 exact India IRP 1.1 SellerDtls projection", () => {
  test("P1: exact supplier evidence produces only fixed-order notified seller JSON", () => {
    const source = supplier();
    const before = JSON.stringify(source);
    const result = buildIndiaIrpSellerDetails(source);
    const payloadJson =
      '{"SellerDtls":{"Gstin":"27AAPFU0939F1ZV","LglNm":"Yellow Hospitality Private Limited","TrdNm":"Yellow Hotels","Addr1":"1 Marine Drive","Loc":"Mumbai","Pin":400001,"Stcd":"27"}}';

    expect(result).toEqual({
      format: "irp_json_1_1",
      lineage: {
        registrationId: REGISTRATION_ID,
        evidenceHash: EVIDENCE_HASH,
      },
      payload: {
        SellerDtls: {
          Gstin: "27AAPFU0939F1ZV",
          LglNm: "Yellow Hospitality Private Limited",
          TrdNm: "Yellow Hotels",
          Addr1: "1 Marine Drive",
          Loc: "Mumbai",
          Pin: 400001,
          Stcd: "27",
        },
      },
      payloadJson,
      payloadHash: sha256(payloadJson),
    });
    expect(Object.keys(result)).toEqual([
      "format", "lineage", "payload", "payloadJson", "payloadHash",
    ]);
    expect(Object.keys(result.lineage)).toEqual(["registrationId", "evidenceHash"]);
    expect(Object.keys(result.payload)).toEqual(["SellerDtls"]);
    expect(Object.keys(result.payload.SellerDtls)).toEqual([
      "Gstin", "LglNm", "TrdNm", "Addr1", "Loc", "Pin", "Stcd",
    ]);
    expect(result.payloadJson).toBe(JSON.stringify(result.payload));
    expect(JSON.stringify(source)).toBe(before);
    expectDeepFrozen(source);
    expectDeepFrozen(result);
  });

  test("P2: exact null trade name omits TrdNm without changing field order", () => {
    const result = buildIndiaIrpSellerDetails(supplier({ tradeName: null }));
    const payloadJson =
      '{"SellerDtls":{"Gstin":"27AAPFU0939F1ZV","LglNm":"Yellow Hospitality Private Limited","Addr1":"1 Marine Drive","Loc":"Mumbai","Pin":400001,"Stcd":"27"}}';

    expect(result.payloadJson).toBe(payloadJson);
    expect(result.payloadHash).toBe(sha256(payloadJson));
    expect(Object.keys(result.payload.SellerDtls)).toEqual([
      "Gstin", "LglNm", "Addr1", "Loc", "Pin", "Stcd",
    ]);
    expect(result.payload.SellerDtls).not.toHaveProperty("TrdNm");
  });

  test("P3: replay is byte-identical, deterministic, deeply frozen and source-preserving", () => {
    const source = supplier();
    const before = JSON.stringify(source);
    const first = buildIndiaIrpSellerDetails(source);
    const second = buildIndiaIrpSellerDetails(source);

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first).toEqual(second);
    expect(first.payloadJson).toBe(second.payloadJson);
    expect(first.payloadHash).toBe(second.payloadHash);
    expect(first.lineage.registrationId).toBe(REGISTRATION_ID);
    expect(first.lineage.evidenceHash).toBe(EVIDENCE_HASH);
    expect(first.payloadJson).not.toContain(REGISTRATION_ID);
    expect(first.payloadJson).not.toContain(EVIDENCE_HASH);
    expect(first.payload).not.toHaveProperty("registrationId");
    expect(first.payload).not.toHaveProperty("evidenceHash");
    expect(JSON.stringify(source)).toBe(before);
    expectDeepFrozen(first);
    expectDeepFrozen(second);

    const tenantNeutralJurisdiction = {
      extensionId: EXTENSION_ID,
      ownerTenantId: null,
      key: "in.order275.gst.27",
      version: "7",
      contentHash: JURISDICTION_HASH,
    };
    expect(buildIndiaIrpSellerDetails(supplier({
      jurisdiction: tenantNeutralJurisdiction,
    })).lineage).toEqual(first.lineage);
  });

  test("P4: exact source and frozen jurisdiction shapes reject missing, surplus and hostile descriptors", () => {
    const exact = supplier();
    const missing = withDefect(exact, (copy) => { delete copy.propertyNode; });
    const surplus = withDefect(exact, (copy) => { copy.tenantId = TENANT_ID; });
    const symbol = jsonClone(exact) as MutableRecord;
    symbol[Symbol("surplus")] = true;
    freezeDeep(symbol);
    const accessor = jsonClone(exact);
    Object.defineProperty(accessor, "currency", {
      enumerable: true,
      configurable: true,
      get: () => "INR",
    });
    freezeDeep(accessor);
    const nonEnumerable = jsonClone(exact);
    Object.defineProperty(nonEnumerable, "currency", {
      value: "INR",
      enumerable: false,
      configurable: true,
    });
    freezeDeep(nonEnumerable);
    const missingJurisdiction = withDefect(exact, (copy) => {
      delete (copy.jurisdiction as Record<string, unknown>).version;
    });
    const surplusJurisdiction = withDefect(exact, (copy) => {
      (copy.jurisdiction as Record<string, unknown>).country = "IN";
    });
    const jurisdictionAccessor = jsonClone(exact);
    Object.defineProperty(jurisdictionAccessor.jurisdiction as Record<string, unknown>, "key", {
      enumerable: true,
      configurable: true,
      get: () => "in.order275.gst.27",
    });
    freezeDeep(jurisdictionAccessor);
    const unfrozen = jsonClone(exact);
    const nestedUnfrozen = jsonClone(exact);
    Object.freeze(nestedUnfrozen);
    const proxy = new Proxy(freezeDeep(jsonClone(exact)), {});

    for (const hostile of [
      null, undefined, true, 1, "supplier", [], new Date(), missing, surplus, symbol,
      accessor, nonEnumerable, missingJurisdiction, surplusJurisdiction,
      jurisdictionAccessor, unfrozen, nestedUnfrozen, proxy,
    ]) {
      expectRejected(hostile);
    }
  });

  test("P5: scheme, currency and complete frozen lineage identity fail closed on mismatch", () => {
    const defects: readonly Readonly<Record<string, unknown>>[] = [
      supplier({ registrationId: "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA" }),
      supplier({ registrationId: "not-a-uuid" }),
      supplier({ propertyNode: "not-a-uuid" }),
      supplier({ scheme: "gstin" }),
      supplier({ currency: "USD" }),
      supplier({ evidenceHash: "B".repeat(64) }),
      supplier({ evidenceHash: "b".repeat(63) }),
      supplier({ jurisdiction: {
        extensionId: "not-a-uuid", ownerTenantId: TENANT_ID,
        key: "in.order275.gst.27", version: "7", contentHash: JURISDICTION_HASH,
      } }),
      supplier({ jurisdiction: {
        extensionId: EXTENSION_ID, ownerTenantId: "not-a-uuid",
        key: "in.order275.gst.27", version: "7", contentHash: JURISDICTION_HASH,
      } }),
      supplier({ jurisdiction: {
        extensionId: EXTENSION_ID, ownerTenantId: TENANT_ID,
        key: "", version: "7", contentHash: JURISDICTION_HASH,
      } }),
      supplier({ jurisdiction: {
        extensionId: EXTENSION_ID, ownerTenantId: TENANT_ID,
        key: "in.order275.gst.27", version: "0", contentHash: JURISDICTION_HASH,
      } }),
      supplier({ jurisdiction: {
        extensionId: EXTENSION_ID, ownerTenantId: TENANT_ID,
        key: "in.order275.gst.27", version: "7.0", contentHash: JURISDICTION_HASH,
      } }),
      supplier({ jurisdiction: {
        extensionId: EXTENSION_ID, ownerTenantId: TENANT_ID,
        key: "in.order275.gst.27", version: "7", contentHash: "A".repeat(64),
      } }),
    ];
    for (const defect of defects) expectRejected(defect);
  });

  test("P6: GSTIN, current state/UT code and exact six-digit nonzero PIN fail closed", () => {
    const defects: readonly Readonly<Record<string, unknown>>[] = [
      supplier({ gstin: "27AAPFU0939F1ZA" }),
      supplier({ gstin: "27AAPFU0939F1ZV0" }),
      supplier({ gstin: gstinForState("29"), stateCode: "27" }),
      supplier({ gstin: gstinForState("28"), stateCode: "28" }),
      supplier({ stateCode: 27 }),
      supplier({ postalCode: "000001" }),
      supplier({ postalCode: "040001" }),
      supplier({ postalCode: "40001" }),
      supplier({ postalCode: "4000010" }),
      supplier({ postalCode: "40000A" }),
      supplier({ postalCode: 400001 }),
    ];
    for (const defect of defects) expectRejected(defect);
  });

  test("P7: IRP text limits and canonical identity reject alteration instead of trimming or truncating", () => {
    const defects: readonly Readonly<Record<string, unknown>>[] = [
      supplier({ legalName: "" }),
      supplier({ legalName: ` ${"L".repeat(100)}` }),
      supplier({ legalName: "L".repeat(101) }),
      supplier({ tradeName: "" }),
      supplier({ tradeName: `${"T".repeat(100)} ` }),
      supplier({ tradeName: "T".repeat(101) }),
      supplier({ addressLine: "" }),
      supplier({ addressLine: `${"A".repeat(100)}\n` }),
      supplier({ addressLine: "A".repeat(101) }),
      supplier({ locality: "" }),
      supplier({ locality: " Mumbai" }),
      supplier({ locality: "L".repeat(51) }),
      supplier({ locality: "Cafe\u0301" }),
      supplier({ legalName: 42 }),
      supplier({ tradeName: false }),
      supplier({ addressLine: { toString: () => "1 Marine Drive" } }),
      supplier({ locality: ["Mumbai"] }),
    ];
    for (const defect of defects) expectRejected(defect);

    const exactLimits = buildIndiaIrpSellerDetails(supplier({
      legalName: "L".repeat(100),
      tradeName: "T".repeat(100),
      addressLine: "A".repeat(100),
      locality: "L".repeat(50),
    }));
    expect(exactLimits.payload.SellerDtls.LglNm).toHaveLength(100);
    expect(exactLimits.payload.SellerDtls.TrdNm).toHaveLength(100);
    expect(exactLimits.payload.SellerDtls.Addr1).toHaveLength(100);
    expect(exactLimits.payload.SellerDtls.Loc).toHaveLength(50);
  });

  test("P8: projection has zero transaction, persistence, network or document authority", async () => {
    const source = await Bun.file(new URL(
      "../src/contexts/tax-fiscal/india-irp-seller-details.ts",
      import.meta.url,
    )).text();

    const imports = source.match(/^\s*import[^;]+;\s*$/gm) ?? [];
    for (const statement of imports) {
      expect(statement).toMatch(/from\s+["']node:util["']/);
    }
    expect(source).not.toMatch(/\b(?:Tx|SQL|Database|fetch|Elysia|service|repository)\b/i);
    expect(source).not.toMatch(/\b(?:INSERT\s+INTO|UPDATE\s+[A-Za-z_]|DELETE\s+FROM|SELECT\s+)\b/i);
    expect(source).not.toMatch(/\b(?:document|document_series|journal|posting_line|outbox|payment)\b/i);
    expect(source).not.toMatch(/\b(?:async|await)\b/);
    expect(source).not.toMatch(/\b(?:emit|publish|submit|send|write|save|persist)\s*\(/i);
  });
});
