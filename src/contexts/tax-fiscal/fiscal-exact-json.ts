export const FISCAL_EXACT_JSON_LIMITS = Object.freeze({
  maxUtf8Bytes: 1024 * 1024,
  maxExplicitUtf8Bytes: 8 * 1024 * 1024,
  maxContainerDepth: 32,
  maxValueNodes: 100_000,
} as const);

export interface FiscalExactJsonDecodeOptions {
  readonly maxUtf8Bytes: number;
}

export type FiscalExactJsonValue = Readonly<
  | { readonly kind: "null" }
  | { readonly kind: "boolean"; readonly value: boolean }
  | { readonly kind: "string"; readonly value: string }
  | { readonly kind: "number"; readonly lexeme: string }
  | { readonly kind: "array"; readonly items: readonly FiscalExactJsonValue[] }
  | { readonly kind: "object"; readonly members: Readonly<Record<string, FiscalExactJsonValue>> }
>;

export type FiscalExactJsonErrorCode = "invalid_input" | "invalid_json" | "resource_exhausted";

export interface FiscalExactJsonError {
  readonly code: FiscalExactJsonErrorCode;
  readonly message: string;
}

export type FiscalExactJsonResult = Readonly<
  | { readonly ok: true; readonly value: FiscalExactJsonValue }
  | { readonly ok: false; readonly error: Readonly<FiscalExactJsonError> }
>;

class InvalidFiscalJson extends Error {}
class FiscalJsonResourceExhausted extends Error {}

function invalid(): never {
  throw new InvalidFiscalJson();
}

function exhausted(): never {
  throw new FiscalJsonResourceExhausted();
}

function failure(code: FiscalExactJsonErrorCode, message: string): FiscalExactJsonResult {
  return Object.freeze({ ok: false as const, error: Object.freeze({ code, message }) });
}

function isWellFormedUtf16(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      return false;
    }
  }
  return true;
}

function hexValue(unit: number): number {
  if (unit >= 0x30 && unit <= 0x39) return unit - 0x30;
  if (unit >= 0x41 && unit <= 0x46) return unit - 0x41 + 10;
  if (unit >= 0x61 && unit <= 0x66) return unit - 0x61 + 10;
  return invalid();
}

class FiscalExactJsonDecoder {
  #offset = 0;
  #nodes = 0;

  constructor(private readonly source: string) {}

  decode(): FiscalExactJsonValue {
    this.#space();
    const value = this.#value(0);
    this.#space();
    if (this.#offset !== this.source.length) invalid();
    return value;
  }

  #takeNode(): void {
    this.#nodes += 1;
    if (this.#nodes > FISCAL_EXACT_JSON_LIMITS.maxValueNodes) exhausted();
  }

  #value(containerDepth: number): FiscalExactJsonValue {
    this.#takeNode();
    const token = this.source.charCodeAt(this.#offset);
    if (token === 0x7b) return this.#object(containerDepth);
    if (token === 0x5b) return this.#array(containerDepth);
    if (token === 0x22) return Object.freeze({ kind: "string" as const, value: this.#string() });
    if (token === 0x74) {
      this.#literal("true");
      return Object.freeze({ kind: "boolean" as const, value: true });
    }
    if (token === 0x66) {
      this.#literal("false");
      return Object.freeze({ kind: "boolean" as const, value: false });
    }
    if (token === 0x6e) {
      this.#literal("null");
      return Object.freeze({ kind: "null" as const });
    }
    return Object.freeze({ kind: "number" as const, lexeme: this.#number() });
  }

  #object(containerDepth: number): FiscalExactJsonValue {
    if (containerDepth >= FISCAL_EXACT_JSON_LIMITS.maxContainerDepth) exhausted();
    this.#offset += 1;
    this.#space();
    const members = Object.create(null) as Record<string, FiscalExactJsonValue>;
    const names = new Set<string>();
    if (this.source.charCodeAt(this.#offset) === 0x7d) {
      this.#offset += 1;
      return Object.freeze({ kind: "object" as const, members: Object.freeze(members) });
    }
    while (true) {
      if (this.source.charCodeAt(this.#offset) !== 0x22) invalid();
      const name = this.#string();
      if (names.has(name)) invalid();
      names.add(name);
      this.#space();
      if (this.source.charCodeAt(this.#offset) !== 0x3a) invalid();
      this.#offset += 1;
      this.#space();
      members[name] = this.#value(containerDepth + 1);
      this.#space();
      const separator = this.source.charCodeAt(this.#offset);
      if (separator === 0x7d) {
        this.#offset += 1;
        return Object.freeze({ kind: "object" as const, members: Object.freeze(members) });
      }
      if (separator !== 0x2c) invalid();
      this.#offset += 1;
      this.#space();
    }
  }

  #array(containerDepth: number): FiscalExactJsonValue {
    if (containerDepth >= FISCAL_EXACT_JSON_LIMITS.maxContainerDepth) exhausted();
    this.#offset += 1;
    this.#space();
    const items: FiscalExactJsonValue[] = [];
    if (this.source.charCodeAt(this.#offset) === 0x5d) {
      this.#offset += 1;
      return Object.freeze({ kind: "array" as const, items: Object.freeze(items) });
    }
    while (true) {
      items.push(this.#value(containerDepth + 1));
      this.#space();
      const separator = this.source.charCodeAt(this.#offset);
      if (separator === 0x5d) {
        this.#offset += 1;
        return Object.freeze({ kind: "array" as const, items: Object.freeze(items) });
      }
      if (separator !== 0x2c) invalid();
      this.#offset += 1;
      this.#space();
    }
  }

  #string(): string {
    this.#offset += 1;
    let segmentStart = this.#offset;
    const chunks: string[] = [];
    while (this.#offset < this.source.length) {
      const unit = this.source.charCodeAt(this.#offset);
      if (unit === 0x22) {
        chunks.push(this.source.slice(segmentStart, this.#offset));
        this.#offset += 1;
        const decoded = chunks.join("");
        if (!isWellFormedUtf16(decoded)) invalid();
        return decoded;
      }
      if (unit < 0x20) invalid();
      if (unit !== 0x5c) {
        this.#offset += 1;
        continue;
      }

      chunks.push(this.source.slice(segmentStart, this.#offset));
      this.#offset += 1;
      const escape = this.source.charCodeAt(this.#offset);
      if (escape === 0x75) {
        if (this.#offset + 4 >= this.source.length) invalid();
        let escapedUnit = 0;
        for (let digit = 1; digit <= 4; digit += 1) {
          escapedUnit = escapedUnit * 16 + hexValue(this.source.charCodeAt(this.#offset + digit));
        }
        chunks.push(String.fromCharCode(escapedUnit));
        this.#offset += 5;
      } else {
        switch (escape) {
          case 0x22: chunks.push('"'); break;
          case 0x5c: chunks.push("\\"); break;
          case 0x2f: chunks.push("/"); break;
          case 0x62: chunks.push("\b"); break;
          case 0x66: chunks.push("\f"); break;
          case 0x6e: chunks.push("\n"); break;
          case 0x72: chunks.push("\r"); break;
          case 0x74: chunks.push("\t"); break;
          default: invalid();
        }
        this.#offset += 1;
      }
      segmentStart = this.#offset;
    }
    return invalid();
  }

  #number(): string {
    const start = this.#offset;
    if (this.source.charCodeAt(this.#offset) === 0x2d) this.#offset += 1;

    const first = this.source.charCodeAt(this.#offset);
    if (first === 0x30) {
      this.#offset += 1;
    } else if (first >= 0x31 && first <= 0x39) {
      this.#offset += 1;
      while (this.#digit(this.source.charCodeAt(this.#offset))) this.#offset += 1;
    } else {
      invalid();
    }

    if (this.source.charCodeAt(this.#offset) === 0x2e) {
      this.#offset += 1;
      if (!this.#digit(this.source.charCodeAt(this.#offset))) invalid();
      while (this.#digit(this.source.charCodeAt(this.#offset))) this.#offset += 1;
    }

    const exponent = this.source.charCodeAt(this.#offset);
    if (exponent === 0x65 || exponent === 0x45) {
      this.#offset += 1;
      const sign = this.source.charCodeAt(this.#offset);
      if (sign === 0x2b || sign === 0x2d) this.#offset += 1;
      if (!this.#digit(this.source.charCodeAt(this.#offset))) invalid();
      while (this.#digit(this.source.charCodeAt(this.#offset))) this.#offset += 1;
    }

    return this.source.slice(start, this.#offset);
  }

  #digit(unit: number): boolean {
    return unit >= 0x30 && unit <= 0x39;
  }

  #literal(literal: string): void {
    if (!this.source.startsWith(literal, this.#offset)) invalid();
    this.#offset += literal.length;
  }

  #space(): void {
    while (true) {
      const unit = this.source.charCodeAt(this.#offset);
      if (unit !== 0x20 && unit !== 0x09 && unit !== 0x0a && unit !== 0x0d) return;
      this.#offset += 1;
    }
  }
}

export function decodeFiscalExactJson(input: unknown): FiscalExactJsonResult;
export function decodeFiscalExactJson(
  input: unknown,
  options: Readonly<FiscalExactJsonDecodeOptions>,
): FiscalExactJsonResult;
export function decodeFiscalExactJson(
  input: unknown,
  options?: Readonly<FiscalExactJsonDecodeOptions>,
): FiscalExactJsonResult {
  let maxUtf8Bytes: number;
  if (options === undefined) {
    maxUtf8Bytes = FISCAL_EXACT_JSON_LIMITS.maxUtf8Bytes;
  } else {
    try {
      if (typeof options !== "object" || options === null || Array.isArray(options)
          || Object.getPrototypeOf(options) !== Object.prototype
          || Object.getOwnPropertySymbols(options).length !== 0) {
        return failure("invalid_input", "fiscal JSON input is invalid");
      }
      const descriptors = Object.getOwnPropertyDescriptors(options);
      const names = Object.keys(descriptors);
      const descriptor = descriptors.maxUtf8Bytes;
      if (names.length !== 1 || names[0] !== "maxUtf8Bytes" || !descriptor
          || !("value" in descriptor) || descriptor.get !== undefined || descriptor.set !== undefined
          || descriptor.enumerable !== true || typeof descriptor.value !== "number"
          || !Number.isSafeInteger(descriptor.value) || descriptor.value < 1
          || descriptor.value > FISCAL_EXACT_JSON_LIMITS.maxExplicitUtf8Bytes) {
        return failure("invalid_input", "fiscal JSON input is invalid");
      }
      maxUtf8Bytes = descriptor.value;
    } catch {
      return failure("invalid_input", "fiscal JSON input is invalid");
    }
  }
  if (typeof input !== "string") {
    return failure("invalid_input", "fiscal JSON input is invalid");
  }
  if (input.length > maxUtf8Bytes) {
    return failure("resource_exhausted", "fiscal JSON resource limit exceeded");
  }
  if (!isWellFormedUtf16(input)) return failure("invalid_json", "fiscal JSON is invalid");
  if (new TextEncoder().encode(input).byteLength > maxUtf8Bytes) {
    return failure("resource_exhausted", "fiscal JSON resource limit exceeded");
  }
  try {
    const value = new FiscalExactJsonDecoder(input).decode();
    return Object.freeze({ ok: true as const, value });
  } catch (error) {
    if (error instanceof FiscalJsonResourceExhausted) {
      return failure("resource_exhausted", "fiscal JSON resource limit exceeded");
    }
    return failure("invalid_json", "fiscal JSON is invalid");
  }
}
