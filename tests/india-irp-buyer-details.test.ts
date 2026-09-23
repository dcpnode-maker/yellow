import { describe, expect, test } from "bun:test";

import { buildIndiaIrpBuyerDetails } from "../src/contexts/tax-fiscal";

const REGISTRATION_ID = "00000000-0000-0000-0000-000000027801";
const PARTY_ID = "00000000-0000-0000-0000-000000027802";
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

function recipient(
  overrides: Record<string, unknown> = {},
): Readonly<Record<string, unknown>> {
  return freezeDeep({
    registrationId: REGISTRATION_ID,
    partyId: PARTY_ID,
    scheme: "in-gstin",
    gstin: "27AAPFU0939F1ZV",
    stateCode: "27",
    legalName: "Yellow Guest Private Limited",
    tradeName: "Yellow Guest",
    addressLine1: "1 Marine Drive",
    locality: "Mumbai",
    pin: "400001",
    evidenceHash: EVIDENCE_HASH,
    ...overrides,
  });
}

function jsonClone(value: Readonly<Record<string, unknown>>): MutableRecord {
  return JSON.parse(JSON.stringify(value)) as MutableRecord;
}

function withDefect(
  base: Readonly<Record<string, unknown>>,
  mutate: (copy: MutableRecord) => void,
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
  expect(() => buildIndiaIrpBuyerDetails(source)).toThrow();
}

describe("Order 278 exact India IRP 1.1 BuyerDtls candidate projection", () => {
  test("P1: exact recipient evidence produces only fixed-order notified buyer JSON", () => {
    const source = recipient();
    const before = JSON.stringify(source);
    const result = buildIndiaIrpBuyerDetails(source);
    const payloadJson =
      '{"BuyerDtls":{"Gstin":"27AAPFU0939F1ZV","LglNm":"Yellow Guest Private Limited","TrdNm":"Yellow Guest","Addr1":"1 Marine Drive","Loc":"Mumbai","Pin":400001,"Stcd":"27"}}';

    expect(result).toEqual({
      format: "irp_json_1_1",
      lineage: {
        partyId: PARTY_ID,
        registrationId: REGISTRATION_ID,
        evidenceHash: EVIDENCE_HASH,
      },
      payload: {
        BuyerDtls: {
          Gstin: "27AAPFU0939F1ZV",
          LglNm: "Yellow Guest Private Limited",
          TrdNm: "Yellow Guest",
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
    expect(Object.keys(result.lineage)).toEqual([
      "partyId", "registrationId", "evidenceHash",
    ]);
    expect(Object.keys(result.payload)).toEqual(["BuyerDtls"]);
    expect(Object.keys(result.payload.BuyerDtls)).toEqual([
      "Gstin", "LglNm", "TrdNm", "Addr1", "Loc", "Pin", "Stcd",
    ]);
    expect(result.payloadJson).toBe(JSON.stringify(result.payload));
    expect(result.payloadJson).not.toContain(PARTY_ID);
    expect(result.payloadJson).not.toContain(REGISTRATION_ID);
    expect(result.payloadJson).not.toContain(EVIDENCE_HASH);
    expect(JSON.stringify(source)).toBe(before);
    expectDeepFrozen(source);
    expectDeepFrozen(result);
  });

  test("P2: exact null trade name omits TrdNm without changing field order", () => {
    const result = buildIndiaIrpBuyerDetails(recipient({ tradeName: null }));
    const payloadJson =
      '{"BuyerDtls":{"Gstin":"27AAPFU0939F1ZV","LglNm":"Yellow Guest Private Limited","Addr1":"1 Marine Drive","Loc":"Mumbai","Pin":400001,"Stcd":"27"}}';

    expect(result.payloadJson).toBe(payloadJson);
    expect(result.payloadHash).toBe(sha256(payloadJson));
    expect(Object.keys(result.payload.BuyerDtls)).toEqual([
      "Gstin", "LglNm", "Addr1", "Loc", "Pin", "Stcd",
    ]);
    expect(result.payload.BuyerDtls).not.toHaveProperty("TrdNm");
  });

  test("P3: replay is byte-identical, deeply frozen and preserves three-field lineage", () => {
    const source = recipient();
    const before = JSON.stringify(source);
    const first = buildIndiaIrpBuyerDetails(source);
    const second = buildIndiaIrpBuyerDetails(source);

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first).toEqual(second);
    expect(first.payloadJson).toBe(second.payloadJson);
    expect(first.payloadHash).toBe(second.payloadHash);
    expect(first.lineage).toEqual({
      partyId: PARTY_ID,
      registrationId: REGISTRATION_ID,
      evidenceHash: EVIDENCE_HASH,
    });
    expect(Object.keys(first.lineage)).toEqual([
      "partyId", "registrationId", "evidenceHash",
    ]);
    expect(first.payload).not.toHaveProperty("partyId");
    expect(first.payload).not.toHaveProperty("registrationId");
    expect(first.payload).not.toHaveProperty("evidenceHash");
    expect(JSON.stringify(source)).toBe(before);
    expectDeepFrozen(first);
    expectDeepFrozen(second);
  });

  test("P4: only the exact frozen plain source shape is accepted", () => {
    const exact = recipient();
    const missing = withDefect(exact, (copy) => { delete copy.partyId; });
    const surplus = withDefect(exact, (copy) => { copy.tenantId = PARTY_ID; });
    const symbolic = jsonClone(exact);
    symbolic[Symbol("surplus")] = true;
    freezeDeep(symbolic);
    const accessor = jsonClone(exact);
    Object.defineProperty(accessor, "evidenceHash", {
      enumerable: true,
      configurable: true,
      get: () => EVIDENCE_HASH,
    });
    freezeDeep(accessor);
    const nonEnumerable = jsonClone(exact);
    Object.defineProperty(nonEnumerable, "scheme", {
      value: "in-gstin",
      enumerable: false,
      configurable: true,
    });
    freezeDeep(nonEnumerable);
    const unfrozen = jsonClone(exact);
    const proxy = new Proxy(freezeDeep(jsonClone(exact)), {});

    for (const hostile of [
      null, undefined, true, 1, "recipient", [], new Date(), missing, surplus,
      symbolic, accessor, nonEnumerable, unfrozen, proxy,
    ]) {
      expectRejected(hostile);
    }
  });

  test("P5: exact Party, registration and evidence lineage identity fail closed", () => {
    const defects: readonly Readonly<Record<string, unknown>>[] = [
      recipient({ partyId: "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA" }),
      recipient({ partyId: "not-a-uuid" }),
      recipient({ registrationId: "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA" }),
      recipient({ registrationId: "not-a-uuid" }),
      recipient({ evidenceHash: "B".repeat(64) }),
      recipient({ evidenceHash: "b".repeat(63) }),
      recipient({ evidenceHash: `${"b".repeat(63)}g` }),
      recipient({ scheme: "gstin" }),
    ];
    for (const defect of defects) expectRejected(defect);
  });

  test("P6: GSTIN, current state or UT code and exact nonzero six-digit PIN fail closed", () => {
    const defects: readonly Readonly<Record<string, unknown>>[] = [
      recipient({ gstin: "27AAPFU0939F1ZA" }),
      recipient({ gstin: "27AAPFU0939F1ZV0" }),
      recipient({ gstin: gstinForState("29"), stateCode: "27" }),
      recipient({ gstin: gstinForState("28"), stateCode: "28" }),
      recipient({ stateCode: 27 }),
      recipient({ pin: "000001" }),
      recipient({ pin: "040001" }),
      recipient({ pin: "40001" }),
      recipient({ pin: "4000010" }),
      recipient({ pin: "40000A" }),
      recipient({ pin: 400001 }),
    ];
    for (const defect of defects) expectRejected(defect);
  });

  test("P7: IRP text limits reject alteration instead of trimming, splitting or coercing", () => {
    const defects: readonly Readonly<Record<string, unknown>>[] = [
      recipient({ legalName: "" }),
      recipient({ legalName: ` ${"L".repeat(100)}` }),
      recipient({ legalName: "L".repeat(101) }),
      recipient({ legalName: "Cafe\u0301" }),
      recipient({ tradeName: "" }),
      recipient({ tradeName: `${"T".repeat(100)} ` }),
      recipient({ tradeName: "T".repeat(101) }),
      recipient({ addressLine1: "" }),
      recipient({ addressLine1: `${"A".repeat(100)}\n` }),
      recipient({ addressLine1: "A".repeat(101) }),
      recipient({ locality: "" }),
      recipient({ locality: " Mumbai" }),
      recipient({ locality: "L".repeat(51) }),
      recipient({ locality: "Cafe\u0301" }),
      recipient({ legalName: 42 }),
      recipient({ tradeName: false }),
      recipient({ addressLine1: { toString: () => "1 Marine Drive" } }),
      recipient({ locality: ["Mumbai"] }),
    ];
    for (const defect of defects) expectRejected(defect);

    const exactLimits = buildIndiaIrpBuyerDetails(recipient({
      legalName: "L".repeat(100),
      tradeName: "T".repeat(100),
      addressLine1: "A".repeat(100),
      locality: "L".repeat(50),
    }));
    expect(exactLimits.payload.BuyerDtls.LglNm).toHaveLength(100);
    expect(exactLimits.payload.BuyerDtls.TrdNm).toHaveLength(100);
    expect(exactLimits.payload.BuyerDtls.Addr1).toHaveLength(100);
    expect(exactLimits.payload.BuyerDtls.Loc).toHaveLength(50);
  });

  test("P8: projection has zero authority and never includes place of supply", async () => {
    const source = await Bun.file(new URL(
      "../src/contexts/tax-fiscal/india-irp-buyer-details.ts",
      import.meta.url,
    )).text();

    const imports = source.match(/^\s*import[^;]+;\s*$/gm) ?? [];
    for (const statement of imports) {
      expect(statement).toMatch(
        /from\s+["'](?:node:util|\.\/india-gst-recipient-registration)["']/,
      );
    }
    expect(source).not.toMatch(/\b(?:Tx|SQL|Database|fetch|Elysia|service|repository)\b/i);
    expect(source).not.toMatch(/\b(?:INSERT\s+INTO|UPDATE\s+[A-Za-z_]|DELETE\s+FROM|SELECT\s+)\b/i);
    expect(source).not.toMatch(/\b(?:document|document_series|journal|posting_line|outbox|payment)\b/i);
    expect(source).not.toMatch(/\b(?:async|await)\b/);
    expect(source).not.toMatch(/\b(?:emit|publish|submit|send|write|save|persist)\s*\(/i);
    expect(source).not.toMatch(/\bPos\s*[?:]/);
    expect(source).not.toMatch(/\b(?:Addr2|Ph|Em|SupTyp)\s*[?:]/);

    const result = buildIndiaIrpBuyerDetails(recipient());
    expect(result.payloadJson).not.toMatch(/"Pos"\s*:/);
    expect(result.payload.BuyerDtls).not.toHaveProperty("Pos");
  });
});
