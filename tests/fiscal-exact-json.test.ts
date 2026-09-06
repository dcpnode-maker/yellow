import { describe, expect, test } from "bun:test";

import {
  FISCAL_EXACT_JSON_LIMITS,
  decodeFiscalExactJson,
  type FiscalExactJsonValue,
} from "../src/contexts/tax-fiscal/fiscal-exact-json";

function decoded(source: string): FiscalExactJsonValue {
  const result = decodeFiscalExactJson(source);
  if (!result.ok) throw new Error(`exact JSON unexpectedly failed: ${result.error.code}`);
  return result.value;
}

function errorCode(source: unknown): string {
  const result = decodeFiscalExactJson(source);
  if (result.ok) throw new Error("invalid exact JSON unexpectedly succeeded");
  return result.error.code;
}

function numericArrayWithTotalNodes(totalNodes: number): string {
  const itemCount = totalNodes - 1;
  return `[${new Array(itemCount).fill("0").join(",")}]`;
}

function expectDeeplyFrozen(value: FiscalExactJsonValue): void {
  expect(Object.isFrozen(value)).toBe(true);
  switch (value.kind) {
    case "null":
    case "boolean":
    case "string":
    case "number":
      return;
    case "array":
      expect(Object.isFrozen(value.items)).toBe(true);
      for (const item of value.items) expectDeeplyFrozen(item);
      return;
    case "object":
      expect(Object.getPrototypeOf(value.members)).toBeNull();
      expect(Object.isFrozen(value.members)).toBe(true);
      for (const item of Object.values(value.members)) expectDeeplyFrozen(item);
      return;
  }
}

describe("Order440/Q206 private lossless fiscal JSON decoder", () => {
  test("retains every scalar kind and exact numeric lexemes without Number coercion", () => {
    const value = decoded(String.raw`[null,true,false,"GST",-0,9007199254740993,1.000,6.022e+999999]`);
    expect(value).toEqual({
      kind: "array",
      items: [
        { kind: "null" },
        { kind: "boolean", value: true },
        { kind: "boolean", value: false },
        { kind: "string", value: "GST" },
        { kind: "number", lexeme: "-0" },
        { kind: "number", lexeme: "9007199254740993" },
        { kind: "number", lexeme: "1.000" },
        { kind: "number", lexeme: "6.022e+999999" },
      ],
    });
    if (value.kind !== "array") throw new Error("expected exact JSON array");
    expect("value" in value.items[4]!).toBe(false);
    expectDeeplyFrozen(value);
  });

  test("keeps AckNo, unsafe integer and changed-cent attacks lexically distinct", () => {
    const source = "{\"AckNo\":9223372036854775807,\"unsafe\":9007199254740993," +
      "\"before\":10000000000000000.00,\"after\":10000000000000000.01}";
    expect(JSON.parse("[10000000000000000.00,10000000000000000.01]")[0])
      .toBe(JSON.parse("[10000000000000000.00,10000000000000000.01]")[1]);
    const value = decoded(source);
    if (value.kind !== "object") throw new Error("expected exact JSON object");
    expect(value.members.AckNo).toEqual({ kind: "number", lexeme: "9223372036854775807" });
    expect(value.members.unsafe).toEqual({ kind: "number", lexeme: "9007199254740993" });
    expect(value.members.before).toEqual({ kind: "number", lexeme: "10000000000000000.00" });
    expect(value.members.after).toEqual({ kind: "number", lexeme: "10000000000000000.01" });
  });

  test("uses frozen null-prototype members for prototype-shaped names", () => {
    const value = decoded(String.raw`{"__proto__":{"polluted":true},"constructor":7,"prototype":"safe"}`);
    if (value.kind !== "object") throw new Error("expected exact JSON object");
    expect(Object.getPrototypeOf(value.members)).toBeNull();
    expect(Object.hasOwn(value.members, "__proto__")).toBe(true);
    expect(value.members.__proto__).toEqual({
      kind: "object",
      members: { polluted: { kind: "boolean", value: true } },
    });
    expect(value.members["constructor"]).toEqual({ kind: "number", lexeme: "7" });
    expect(value.members.prototype).toEqual({ kind: "string", value: "safe" });
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
    expectDeeplyFrozen(value);
  });

  test("decodes escapes without normalization and rejects duplicate decoded names", () => {
    const value = decoded(String.raw`{"raw-é":"e\u0301","\/\b\f\n\r\t\"\\":"` + "😀" +
      String.raw`","\u0061":1}`);
    if (value.kind !== "object") throw new Error("expected exact JSON object");
    expect(value.members["raw-é"]).toEqual({ kind: "string", value: "e\u0301" });
    expect(value.members["/\b\f\n\r\t\"\\"]).toEqual({ kind: "string", value: "😀" });
    expect(value.members.a).toEqual({ kind: "number", lexeme: "1" });
    expect(errorCode(String.raw`{"a":1,"\u0061":2}`)).toBe("invalid_json");
    expect(errorCode('{"😀":1,"\\ud83d\\ude00":2}')).toBe("invalid_json");
  });

  test("accepts paired raw and escaped Unicode and rejects every unpaired surrogate form", () => {
    expect(decoded('"😀"')).toEqual({ kind: "string", value: "😀" });
    expect(decoded(String.raw`"\ud83d\ude00"`)).toEqual({ kind: "string", value: "😀" });
    for (const source of [
      `"${String.fromCharCode(0xd800)}"`,
      `"${String.fromCharCode(0xdc00)}"`,
      String.raw`"\ud800"`,
      String.raw`"\ud800x"`,
      String.raw`"\udc00"`,
      String.raw`{"\ud800":1}`,
    ]) expect(errorCode(source)).toBe("invalid_json");
  });

  test("never lets an escape repair a malformed raw surrogate in a value or member name", () => {
    const rawHigh = String.fromCharCode(0xd800);
    const rawLow = String.fromCharCode(0xdc00);
    const malformed = [
      `"${rawHigh}\\uDC00"`,
      `"\\uD800${rawLow}"`,
      `{"${rawHigh}\\uDC00":null}`,
      `{"\\uD800${rawLow}":null}`,
    ];
    for (const source of malformed) {
      expect(source.isWellFormed()).toBe(false);
      expect(errorCode(source)).toBe("invalid_json");
    }
  });

  test("rejects strict-grammar violations, trailing input and duplicate ordinary keys", () => {
    for (const source of [
      "", " ", ".1", "01", "-", "1.", "1e", "1e+", "+1", "NaN", "Infinity",
      "TRUE", "nul", "true false", "[1,]", "[,1]", "{\"a\":1,}", "{a:1}",
      "{\"a\":1 \"b\":2}", "{\"a\":1,\"a\":2}", '"line\nbreak"', "\ufeffnull",
    ]) expect(errorCode(source)).toBe("invalid_json");
  });

  test("rejects hostile and non-string inputs with a frozen sanitized typed result", () => {
    const revoked = Proxy.revocable({}, {});
    revoked.revoke();
    for (const input of [undefined, null, true, 1, 1n, Symbol("secret"), {}, [], new String("null"), revoked.proxy]) {
      const result = decodeFiscalExactJson(input);
      expect(result).toEqual({
        ok: false,
        error: { code: "invalid_input", message: "fiscal JSON input is invalid" },
      });
      if (result.ok) throw new Error("non-string exact JSON unexpectedly succeeded");
      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.isFrozen(result.error)).toBe(true);
      expect(JSON.stringify(result)).not.toContain("secret");
    }
  });

  test("enforces exact UTF-8 byte boundary minus, exact and plus before decoding", () => {
    const { maxUtf8Bytes } = FISCAL_EXACT_JSON_LIMITS;
    const minus = JSON.stringify(`😀${"a".repeat(maxUtf8Bytes - 7)}`);
    const exact = JSON.stringify(`😀${"a".repeat(maxUtf8Bytes - 6)}`);
    const plus = JSON.stringify(`😀${"a".repeat(maxUtf8Bytes - 5)}`);
    expect(new TextEncoder().encode(minus)).toHaveLength(maxUtf8Bytes - 1);
    expect(new TextEncoder().encode(exact)).toHaveLength(maxUtf8Bytes);
    expect(new TextEncoder().encode(plus)).toHaveLength(maxUtf8Bytes + 1);
    expect(decodeFiscalExactJson(minus).ok).toBe(true);
    expect(decodeFiscalExactJson(exact).ok).toBe(true);
    expect(errorCode(plus)).toBe("resource_exhausted");
  });

  test("enforces container-depth boundary minus, exact and plus", () => {
    const { maxContainerDepth } = FISCAL_EXACT_JSON_LIMITS;
    const nested = (depth: number) => `${"[".repeat(depth)}0${"]".repeat(depth)}`;
    expect(decodeFiscalExactJson(nested(maxContainerDepth - 1)).ok).toBe(true);
    expect(decodeFiscalExactJson(nested(maxContainerDepth)).ok).toBe(true);
    expect(errorCode(nested(maxContainerDepth + 1))).toBe("resource_exhausted");
  });

  test("enforces value-node boundary with a dense numeric workload", () => {
    const { maxValueNodes } = FISCAL_EXACT_JSON_LIMITS;
    expect(decodeFiscalExactJson(numericArrayWithTotalNodes(maxValueNodes - 1)).ok).toBe(true);
    expect(decodeFiscalExactJson(numericArrayWithTotalNodes(maxValueNodes)).ok).toBe(true);
    expect(errorCode(numericArrayWithTotalNodes(maxValueNodes + 1))).toBe("resource_exhausted");
  });

  test("keeps syntax failures distinct from resource exhaustion and never reflects source text", () => {
    const invalid = decodeFiscalExactJson('{"credential":"must-not-escape",}');
    expect(invalid).toEqual({
      ok: false,
      error: { code: "invalid_json", message: "fiscal JSON is invalid" },
    });
    const exhausted = decodeFiscalExactJson(`"${"x".repeat(FISCAL_EXACT_JSON_LIMITS.maxUtf8Bytes)}"`);
    expect(exhausted).toEqual({
      ok: false,
      error: { code: "resource_exhausted", message: "fiscal JSON resource limit exceeded" },
    });
    expect(JSON.stringify([invalid, exhausted])).not.toContain("credential");
  });
});
