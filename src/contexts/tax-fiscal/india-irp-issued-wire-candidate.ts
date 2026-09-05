import { types as utilTypes } from "node:util";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const GSTIN = /^([0-9]{2})[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const STATE_CODE = /^(?:0[1-9]|1[0-9]|2[0-46-9]|3[0-8])$/;
const DOCUMENT_NUMBER = /^[A-Za-z0-9/-]{1,16}$/;
const DOCUMENT_DATE = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const SERIAL = /^(?:[1-9]|[1-9][0-9]|[1-2][0-9]{2}|3[0-5][0-9]|36[0-6])$/;
const SAC = /^\d{6}$/;
const MONEY = /^(?:0|[1-9][0-9]{0,13})\.[0-9]{2}$/;
const RATE = /^(?:0|[1-9][0-9]{0,2})\.[0-9]{2}$/;
const MAX_SOURCE_BYTES = 1024 * 1024;
const MAX_ITEMS = 366;
const MAX_INT64 = 9_223_372_036_854_775_807n;
const GST_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

type RecordValue = Record<string, unknown>;
type ComponentFamily = "igst" | "split";

export interface IssuedIndiaIrpWireCandidate {
  readonly kind: "india_irp_1_1_issued_wire_candidate";
  readonly documentId: string;
  readonly documentSha256: string;
  readonly wireJson: string;
  readonly wireSha256: string;
  readonly authenticatedProviderSandboxCertified: false;
}

export type IssuedIndiaIrpWireCandidateErrorCode =
  | "invalid_input"
  | "source_hash_mismatch"
  | "invalid_issued_document";

export interface IssuedIndiaIrpWireCandidateError {
  readonly code: IssuedIndiaIrpWireCandidateErrorCode;
  readonly message: string;
}

export type IssuedIndiaIrpWireCandidateResult = Readonly<
  | { readonly ok: true; readonly value: Readonly<IssuedIndiaIrpWireCandidate> }
  | { readonly ok: false; readonly error: Readonly<IssuedIndiaIrpWireCandidateError> }
>;

class InvalidIssuedDocument extends Error {}

function failure(
  code: IssuedIndiaIrpWireCandidateErrorCode,
  message: string,
): IssuedIndiaIrpWireCandidateResult {
  return Object.freeze({ ok: false as const, error: Object.freeze({ code, message }) });
}

function invalid(): never {
  throw new InvalidIssuedDocument();
}

function snapshotInput(value: unknown): Readonly<{
  documentId: string;
  documentSha256: string;
  contentJson: string;
}> | null {
  try {
    if (typeof value !== "object" || value === null || utilTypes.isProxy(value) || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    if (Object.getOwnPropertySymbols(value).length !== 0) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Object.keys(descriptors).sort();
    const expected = ["contentJson", "documentId", "documentSha256"];
    if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) return null;
    for (const descriptor of Object.values(descriptors)) {
      if (descriptor.get !== undefined || descriptor.set !== undefined || !("value" in descriptor) ||
          descriptor.enumerable !== true) return null;
    }
    const documentId = descriptors.documentId?.value;
    const documentSha256 = descriptors.documentSha256?.value;
    const contentJson = descriptors.contentJson?.value;
    if (typeof documentId !== "string" || !UUID.test(documentId) ||
        typeof documentSha256 !== "string" || !SHA256.test(documentSha256) ||
        typeof contentJson !== "string") return null;
    return Object.freeze({ documentId, documentSha256, contentJson });
  } catch {
    return null;
  }
}

function isWellFormedUtf16(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next < 0xdc00 || next > 0xdfff) return false;
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) return false;
  }
  return true;
}

/** Validates JSON grammar and rejects duplicate decoded object names before JSON.parse can erase them. */
class ExactJsonScanner {
  #offset = 0;

  constructor(private readonly source: string) {}

  scan(): void {
    this.#space();
    this.#value(0);
    this.#space();
    if (this.#offset !== this.source.length) invalid();
  }

  #value(depth: number): void {
    if (depth > 16) invalid();
    const token = this.source[this.#offset];
    if (token === "{") return this.#object(depth + 1);
    if (token === "[") return this.#array(depth + 1);
    if (token === '"') { this.#string(); return; }
    if (token === "t") return this.#literal("true");
    if (token === "f") return this.#literal("false");
    if (token === "n") return this.#literal("null");
    this.#number();
  }

  #object(depth: number): void {
    this.#offset += 1;
    this.#space();
    const names = new Set<string>();
    if (this.source[this.#offset] === "}") { this.#offset += 1; return; }
    while (true) {
      if (this.source[this.#offset] !== '"') invalid();
      const name = this.#string();
      if (names.has(name)) invalid();
      names.add(name);
      this.#space();
      if (this.source[this.#offset] !== ":") invalid();
      this.#offset += 1;
      this.#space();
      this.#value(depth);
      this.#space();
      const separator = this.source[this.#offset];
      if (separator === "}") { this.#offset += 1; return; }
      if (separator !== ",") invalid();
      this.#offset += 1;
      this.#space();
    }
  }

  #array(depth: number): void {
    this.#offset += 1;
    this.#space();
    if (this.source[this.#offset] === "]") { this.#offset += 1; return; }
    while (true) {
      this.#value(depth);
      this.#space();
      const separator = this.source[this.#offset];
      if (separator === "]") { this.#offset += 1; return; }
      if (separator !== ",") invalid();
      this.#offset += 1;
      this.#space();
    }
  }

  #string(): string {
    const start = this.#offset;
    this.#offset += 1;
    while (this.#offset < this.source.length) {
      const character = this.source.charCodeAt(this.#offset);
      if (character === 0x22) {
        this.#offset += 1;
        try { return JSON.parse(this.source.slice(start, this.#offset)) as string; }
        catch { return invalid(); }
      }
      if (character < 0x20) invalid();
      if (character === 0x5c) {
        this.#offset += 1;
        const escape = this.source[this.#offset];
        if (escape === "u") {
          for (let index = 1; index <= 4; index += 1) {
            if (!/[0-9a-f]/i.test(this.source[this.#offset + index] ?? "")) invalid();
          }
          this.#offset += 5;
          continue;
        }
        if (escape === undefined || !'"\\/bfnrt'.includes(escape)) invalid();
      }
      this.#offset += 1;
    }
    invalid();
  }

  #number(): void {
    const match = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/.exec(
      this.source.slice(this.#offset),
    );
    if (!match) invalid();
    this.#offset += match[0].length;
  }

  #literal(literal: string): void {
    if (!this.source.startsWith(literal, this.#offset)) invalid();
    this.#offset += literal.length;
  }

  #space(): void {
    while (this.source[this.#offset] === " " || this.source[this.#offset] === "\n" ||
        this.source[this.#offset] === "\r" || this.source[this.#offset] === "\t") this.#offset += 1;
  }
}

function record(value: unknown): RecordValue {
  if (typeof value !== "object" || value === null || Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Object.prototype) return invalid();
  return value as RecordValue;
}

function exact(value: RecordValue, required: readonly string[], optional: readonly string[] = []): void {
  const keys = Object.keys(value).sort();
  const allowed = [...required, ...optional].sort();
  if (keys.length < required.length || keys.length > allowed.length ||
      required.some((key) => !Object.hasOwn(value, key)) ||
      keys.some((key) => !allowed.includes(key))) invalid();
}

function text(value: unknown, maxLength: number): string {
  if (typeof value !== "string" || value.length === 0 || value.length > maxLength ||
      !isWellFormedUtf16(value) || value !== value.trim() || value !== value.normalize("NFC") ||
      /[\u0000-\u001f\u007f]/u.test(value)) invalid();
  return value;
}

function gstinChecksum(body: string): string {
  let factor = 2;
  let sum = 0;
  for (let index = body.length - 1; index >= 0; index -= 1) {
    const point = GST_ALPHABET.indexOf(body[index] ?? "");
    if (point < 0) invalid();
    const addend = factor * point;
    factor = factor === 2 ? 1 : 2;
    sum += Math.floor(addend / 36) + addend % 36;
  }
  return GST_ALPHABET[(36 - sum % 36) % 36] ?? invalid();
}

function gstin(value: unknown, stateCode: unknown): string {
  if (typeof value !== "string" || typeof stateCode !== "string" || !STATE_CODE.test(stateCode) ||
      !GSTIN.test(value) || value.slice(0, 2) !== stateCode ||
      gstinChecksum(value.slice(0, 14)) !== value[14]) invalid();
  return value;
}

function pin(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 100000 || value > 999999) invalid();
  return value;
}

function money(value: unknown): Readonly<{ lexeme: string; minor: bigint }> {
  if (typeof value !== "string" || !MONEY.test(value)) invalid();
  const [whole, fraction] = value.split(".");
  const minor = BigInt(whole!) * 100n + BigInt(fraction!);
  if (minor > MAX_INT64) invalid();
  return Object.freeze({ lexeme: value, minor });
}

function rate(value: unknown): string {
  if (typeof value !== "string" || !RATE.test(value)) invalid();
  return value;
}

function jsonString(value: string): string {
  return JSON.stringify(value);
}

function party(value: unknown, buyer: boolean): string {
  const source = record(value);
  const required = buyer
    ? ["Gstin", "LglNm", "Addr1", "Loc", "Pin", "Stcd", "Pos"]
    : ["Gstin", "LglNm", "Addr1", "Loc", "Pin", "Stcd"];
  exact(source, required, ["TrdNm"]);
  const stateCode = typeof source.Stcd === "string" && STATE_CODE.test(source.Stcd) ? source.Stcd : invalid();
  const values = [
    `"Gstin":${jsonString(gstin(source.Gstin, stateCode))}`,
    `"LglNm":${jsonString(text(source.LglNm, 100))}`,
  ];
  if (Object.hasOwn(source, "TrdNm")) values.push(`"TrdNm":${jsonString(text(source.TrdNm, 100))}`);
  values.push(
    `"Addr1":${jsonString(text(source.Addr1, 100))}`,
    `"Loc":${jsonString(text(source.Loc, 50))}`,
    `"Pin":${String(pin(source.Pin))}`,
    `"Stcd":${jsonString(stateCode)}`,
  );
  if (buyer) {
    const placeOfSupply = typeof source.Pos === "string" && STATE_CODE.test(source.Pos) ? source.Pos : invalid();
    values.push(`"Pos":${jsonString(placeOfSupply)}`);
  }
  return `{${values.join(",")}}`;
}

function documentDetails(value: unknown): string {
  const source = record(value);
  exact(source, ["Typ", "No", "Dt"]);
  if (source.Typ !== "INV" || typeof source.No !== "string" || !DOCUMENT_NUMBER.test(source.No) ||
      typeof source.Dt !== "string") invalid();
  const match = DOCUMENT_DATE.exec(source.Dt);
  if (!match) invalid();
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) invalid();
  return `{"Typ":"INV","No":${jsonString(source.No)},"Dt":${jsonString(source.Dt)}}`;
}

function transactionDetails(value: unknown): string {
  const source = record(value);
  exact(source, ["TaxSch", "SupTyp"]);
  if (source.TaxSch !== "GST" || source.SupTyp !== "B2B") invalid();
  return '{"TaxSch":"GST","SupTyp":"B2B"}';
}

interface ItemProjection {
  readonly json: string;
  readonly family: ComponentFamily;
  readonly assessable: bigint;
  readonly tax: bigint;
  readonly cgst: bigint;
  readonly sgst: bigint;
  readonly total: bigint;
}

function item(value: unknown, index: number): ItemProjection {
  const source = record(value);
  const common = ["SlNo", "IsServc", "HsnCd", "Qty", "Unit", "UnitPrice", "TotAmt", "AssAmt", "GstRt", "TotItemVal"];
  const hasIgst = Object.hasOwn(source, "IgstAmt");
  const family: ComponentFamily = hasIgst ? "igst" : "split";
  exact(source, family === "igst" ? [...common, "IgstAmt"] : [...common, "CgstAmt", "SgstAmt"]);
  if (source.SlNo !== String(index + 1) || !SERIAL.test(source.SlNo) || source.IsServc !== "Y" ||
      typeof source.HsnCd !== "string" || !SAC.test(source.HsnCd) ||
      source.Qty !== "1.000" || source.Unit !== "OTH") invalid();
  const unitPrice = money(source.UnitPrice);
  const totalAmount = money(source.TotAmt);
  const assessable = money(source.AssAmt);
  const total = money(source.TotItemVal);
  if (unitPrice.minor !== totalAmount.minor || totalAmount.minor !== assessable.minor) invalid();
  const fields = [
    `"SlNo":${jsonString(source.SlNo)}`,
    '"IsServc":"Y"',
    `"HsnCd":${jsonString(source.HsnCd)}`,
    '"Qty":1.000',
    '"Unit":"OTH"',
    `"UnitPrice":${unitPrice.lexeme}`,
    `"TotAmt":${totalAmount.lexeme}`,
    `"AssAmt":${assessable.lexeme}`,
    `"GstRt":${rate(source.GstRt)}`,
  ];
  let taxMinor: bigint;
  let cgstMinor = 0n;
  let sgstMinor = 0n;
  if (family === "igst") {
    const igst = money(source.IgstAmt);
    taxMinor = igst.minor;
    fields.push(`"IgstAmt":${igst.lexeme}`);
  } else {
    const cgst = money(source.CgstAmt);
    const sgst = money(source.SgstAmt);
    cgstMinor = cgst.minor;
    sgstMinor = sgst.minor;
    taxMinor = cgst.minor + sgst.minor;
    if (taxMinor > MAX_INT64) invalid();
    fields.push(`"CgstAmt":${cgst.lexeme}`, `"SgstAmt":${sgst.lexeme}`);
  }
  if (assessable.minor + taxMinor !== total.minor || total.minor > MAX_INT64) invalid();
  fields.push(`"TotItemVal":${total.lexeme}`);
  return Object.freeze({
    json: `{${fields.join(",")}}`, family, assessable: assessable.minor,
    tax: taxMinor, cgst: cgstMinor, sgst: sgstMinor, total: total.minor,
  });
}

function add(left: bigint, right: bigint): bigint {
  const total = left + right;
  if (total > MAX_INT64) invalid();
  return total;
}

function valueDetails(value: unknown, items: readonly ItemProjection[], family: ComponentFamily): string {
  const source = record(value);
  exact(source, family === "igst" ? ["AssVal", "IgstVal", "TotInvVal"] : ["AssVal", "CgstVal", "SgstVal", "TotInvVal"]);
  const assessable = money(source.AssVal);
  const total = money(source.TotInvVal);
  const itemAssessable = items.reduce((sum, candidate) => add(sum, candidate.assessable), 0n);
  const itemTotal = items.reduce((sum, candidate) => add(sum, candidate.total), 0n);
  if (assessable.minor !== itemAssessable || total.minor !== itemTotal) invalid();
  if (family === "igst") {
    const igst = money(source.IgstVal);
    const itemTax = items.reduce((sum, candidate) => add(sum, candidate.tax), 0n);
    if (igst.minor !== itemTax || add(assessable.minor, igst.minor) !== total.minor) invalid();
    return `{"AssVal":${assessable.lexeme},"IgstVal":${igst.lexeme},"TotInvVal":${total.lexeme}}`;
  }
  const cgst = money(source.CgstVal);
  const sgst = money(source.SgstVal);
  const itemCgst = items.reduce((sum, candidate) => add(sum, candidate.cgst), 0n);
  const itemSgst = items.reduce((sum, candidate) => add(sum, candidate.sgst), 0n);
  if (cgst.minor !== itemCgst || sgst.minor !== itemSgst ||
      add(add(assessable.minor, cgst.minor), sgst.minor) !== total.minor) invalid();
  return `{"AssVal":${assessable.lexeme},"CgstVal":${cgst.lexeme},"SgstVal":${sgst.lexeme},"TotInvVal":${total.lexeme}}`;
}

function project(sourceValue: unknown): string {
  const source = record(sourceValue);
  exact(source, ["Version", "TranDtls", "DocDtls", "SellerDtls", "BuyerDtls", "ItemList", "ValDtls"]);
  if (source.Version !== "1.1" || !Array.isArray(source.ItemList) ||
      source.ItemList.length < 1 || source.ItemList.length > MAX_ITEMS) invalid();
  const projectedItems = source.ItemList.map((candidate, index) => item(candidate, index));
  const family = projectedItems[0]!.family;
  if (projectedItems.some((candidate) => candidate.family !== family)) invalid();
  const itemJson = projectedItems.map((candidate) => candidate.json).join(",");
  return `{"Version":"1.1","TranDtls":${transactionDetails(source.TranDtls)},` +
    `"DocDtls":${documentDetails(source.DocDtls)},"SellerDtls":${party(source.SellerDtls, false)},` +
    `"BuyerDtls":${party(source.BuyerDtls, true)},"ItemList":[${itemJson}],` +
    `"ValDtls":${valueDetails(source.ValDtls, projectedItems, family)}}`;
}

export function projectIssuedIndiaIrpWireCandidate(inputValue: unknown): IssuedIndiaIrpWireCandidateResult {
  const input = snapshotInput(inputValue);
  if (!input) return failure("invalid_input", "issued fiscal wire candidate input is invalid");
  if (input.contentJson.length === 0 || input.contentJson.length > MAX_SOURCE_BYTES) {
    return failure("invalid_issued_document", "issued fiscal document is invalid");
  }
  const sourceBytes = new TextEncoder().encode(input.contentJson).byteLength;
  if (sourceBytes > MAX_SOURCE_BYTES) {
    return failure("invalid_issued_document", "issued fiscal document is invalid");
  }
  const actualHash = new Bun.CryptoHasher("sha256").update(input.contentJson).digest("hex");
  if (actualHash !== input.documentSha256) {
    return failure("source_hash_mismatch", "issued fiscal document hash does not match");
  }
  try {
    if (!isWellFormedUtf16(input.contentJson)) invalid();
    new ExactJsonScanner(input.contentJson).scan();
    const parsed: unknown = JSON.parse(input.contentJson);
    const wireJson = project(parsed);
    const wireSha256 = new Bun.CryptoHasher("sha256").update(wireJson).digest("hex");
    return Object.freeze({
      ok: true as const,
      value: Object.freeze({
        kind: "india_irp_1_1_issued_wire_candidate" as const,
        documentId: input.documentId,
        documentSha256: input.documentSha256,
        wireJson,
        wireSha256,
        authenticatedProviderSandboxCertified: false as const,
      }),
    });
  } catch {
    return failure("invalid_issued_document", "issued fiscal document is invalid");
  }
}
