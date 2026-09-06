import { types as utilTypes } from "node:util";

import {
  decodeFiscalExactJson,
  type FiscalExactJsonValue,
} from "./fiscal-exact-json";
import {
  FISCAL_SIGNED_JWS_LIMITS,
  createFiscalSignedJwsVerifier,
  type FiscalSignedJwsSignatureEvidence,
  type FiscalSignedJwsVerifier,
} from "./fiscal-signed-jws";
import { projectIssuedIndiaIrpWireCandidate } from "./india-irp-issued-wire-candidate";

export const INDIA_IRP_SIGNED_RECEIPT_BINDING_LIMITS = Object.freeze({
  maxConfigurationUtf8Bytes: 256 * 1024,
  maxContentCharacters: 1024 * 1024,
  maxIrnCharacters: 64,
  maxAcknowledgementDigits: 64,
  acknowledgementDateCharacters: 19,
  maxNumericLexemeCharacters: 128,
  maxAbsoluteNumericExponent: 1000,
} as const);

export const INDIA_IRP_SIGNED_RECEIPT_PROFILE_VERSION = "yellow_native_india_1_1_v1" as const;

export type IndiaIrpSignedReceiptBindingFactoryErrorCode =
  | "invalid_input"
  | "invalid_configuration"
  | "resource_exhausted";

export type IndiaIrpSignedReceiptBindingErrorCode =
  | "invalid_input"
  | "source_hash_mismatch"
  | "invalid_issued_document"
  | "invalid_signed_artifact"
  | "signature_verification_failed"
  | "unsupported_signed_shape"
  | "receipt_binding_mismatch"
  | "resource_exhausted";

export interface IndiaIrpSignedReceiptBindingError<Code extends string> {
  readonly code: Code;
  readonly message: string;
}

export interface IndiaIrpSignedReceiptBindingEvidence {
  readonly kind: "india_irp_signed_receipt_binding_v1";
  readonly profileVersion: typeof INDIA_IRP_SIGNED_RECEIPT_PROFILE_VERSION;
  readonly issuer: string;
  readonly verificationUnixMs: number;
  readonly documentId: string;
  readonly documentSha256: string;
  readonly wireJson: string;
  readonly wireSha256: string;
  readonly irn: string;
  readonly ackNo: string;
  readonly ackDt: string;
  readonly signedInvoice: Readonly<FiscalSignedJwsSignatureEvidence>;
  readonly signedQRCode: Readonly<FiscalSignedJwsSignatureEvidence>;
  /** Signature and source binding alone do not establish a provider's acceptance state. */
  readonly providerAcceptanceEstablished: false;
  /** An authenticated provider sandbox round-trip remains an independent acceptance gate. */
  readonly authenticatedProviderSandboxCertified: false;
}

export type IndiaIrpSignedReceiptBindingResult = Readonly<
  | { readonly ok: true; readonly value: Readonly<IndiaIrpSignedReceiptBindingEvidence> }
  | { readonly ok: false; readonly error: Readonly<IndiaIrpSignedReceiptBindingError<IndiaIrpSignedReceiptBindingErrorCode>> }
>;

export interface IndiaIrpSignedReceiptBindingVerifier {
  readonly kind: "india_irp_signed_receipt_binding_verifier_v1";
  readonly profileVersion: typeof INDIA_IRP_SIGNED_RECEIPT_PROFILE_VERSION;
  readonly issuer: string;
  /** The instant must come from authenticated runtime policy, never the request being verified. */
  verify(input: unknown, verificationUnixMs: unknown): Promise<IndiaIrpSignedReceiptBindingResult>;
}

export type IndiaIrpSignedReceiptBindingFactoryResult = Readonly<
  | { readonly ok: true; readonly value: Readonly<IndiaIrpSignedReceiptBindingVerifier> }
  | { readonly ok: false; readonly error: Readonly<IndiaIrpSignedReceiptBindingError<IndiaIrpSignedReceiptBindingFactoryErrorCode>> }
>;

type ExactObject = Extract<FiscalExactJsonValue, { readonly kind: "object" }>;
type ExactArray = Extract<FiscalExactJsonValue, { readonly kind: "array" }>;
type ExactNumber = Extract<FiscalExactJsonValue, { readonly kind: "number" }>;

interface BindingInputSnapshot {
  readonly documentId: string;
  readonly documentSha256: string;
  readonly contentJson: string;
  readonly signedInvoice: string;
  readonly signedQRCode: string;
  readonly irn: string;
  readonly ackNo: string;
  readonly ackDt: string;
}

interface DecimalValue {
  readonly sign: -1 | 0 | 1;
  readonly coefficient: string;
  readonly exponent: bigint;
}

class InvalidConfiguration extends Error {}
class UnsupportedSignedShape extends Error {}
class ReceiptBindingMismatch extends Error {}
class BindingResourceExhausted extends Error {}

function invalidConfiguration(): never {
  throw new InvalidConfiguration();
}

function unsupported(): never {
  throw new UnsupportedSignedShape();
}

function mismatch(): never {
  throw new ReceiptBindingMismatch();
}

function exhausted(): never {
  throw new BindingResourceExhausted();
}

function failure<Code extends string>(code: Code, message: string): Readonly<{
  readonly ok: false;
  readonly error: Readonly<IndiaIrpSignedReceiptBindingError<Code>>;
}> {
  return Object.freeze({ ok: false as const, error: Object.freeze({ code, message }) });
}

function printableAscii(value: string, maximum: number): boolean {
  if (value.length < 1 || value.length > maximum) return false;
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit < 0x20 || unit > 0x7e) return false;
  }
  return true;
}

function configurationObject(value: FiscalExactJsonValue): ExactObject {
  if (value.kind !== "object") return invalidConfiguration();
  const names = Object.keys(value.members).sort();
  const expected = ["issuer", "profileVersion", "trustBundleJson"];
  if (names.length !== expected.length || names.some((name, index) => name !== expected[index])) {
    return invalidConfiguration();
  }
  return value;
}

function configurationString(value: FiscalExactJsonValue | undefined): string {
  if (value?.kind !== "string") return invalidConfiguration();
  return value.value;
}

function snapshotInput(value: unknown): BindingInputSnapshot | null {
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value) || utilTypes.isProxy(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    if (Object.getOwnPropertySymbols(value).length !== 0) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const names = Object.keys(descriptors).sort();
    const expected = [
      "ackDt", "ackNo", "contentJson", "documentId", "documentSha256", "irn", "signedInvoice", "signedQRCode",
    ];
    if (names.length !== expected.length || names.some((name, index) => name !== expected[index])) return null;
    for (const descriptor of Object.values(descriptors)) {
      if (!("value" in descriptor) || descriptor.get !== undefined || descriptor.set !== undefined
          || descriptor.enumerable !== true || typeof descriptor.value !== "string") return null;
    }
    return Object.freeze({
      documentId: descriptors.documentId!.value as string,
      documentSha256: descriptors.documentSha256!.value as string,
      contentJson: descriptors.contentJson!.value as string,
      signedInvoice: descriptors.signedInvoice!.value as string,
      signedQRCode: descriptors.signedQRCode!.value as string,
      irn: descriptors.irn!.value as string,
      ackNo: descriptors.ackNo!.value as string,
      ackDt: descriptors.ackDt!.value as string,
    });
  } catch {
    return null;
  }
}

function validCalendarTimestamp(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/u.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  if (year === 0 || month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day >= 1 && day <= days[month - 1]!;
}

function validateCheapInput(snapshot: BindingInputSnapshot): boolean {
  if (snapshot.contentJson.length > INDIA_IRP_SIGNED_RECEIPT_BINDING_LIMITS.maxContentCharacters
      || snapshot.signedInvoice.length > FISCAL_SIGNED_JWS_LIMITS.maxCompactChars
      || snapshot.signedQRCode.length > FISCAL_SIGNED_JWS_LIMITS.maxCompactChars) return exhausted();
  return snapshot.contentJson.length > 0 && snapshot.signedInvoice.length > 0 && snapshot.signedQRCode.length > 0
    && /^[0-9a-f]{64}$/u.test(snapshot.irn)
    && /^[1-9][0-9]{0,63}$/u.test(snapshot.ackNo)
    && snapshot.ackDt.length === INDIA_IRP_SIGNED_RECEIPT_BINDING_LIMITS.acknowledgementDateCharacters
    && validCalendarTimestamp(snapshot.ackDt);
}

function exactObject(value: FiscalExactJsonValue): ExactObject {
  if (value.kind !== "object") return unsupported();
  return value;
}

function exactArray(value: FiscalExactJsonValue | undefined): ExactArray {
  if (value?.kind !== "array") return unsupported();
  return value;
}

function exactString(value: FiscalExactJsonValue | undefined): string {
  if (value?.kind !== "string") return unsupported();
  return value.value;
}

function exactNumber(value: FiscalExactJsonValue | undefined): ExactNumber {
  if (value?.kind !== "number") return unsupported();
  return value;
}

function exactMembers(value: ExactObject, required: readonly string[], optional: readonly string[] = []): void {
  const names = Object.keys(value.members);
  const allowed = new Set([...required, ...optional]);
  if (names.length < required.length || names.length > allowed.size
      || required.some(name => !Object.hasOwn(value.members, name))
      || names.some(name => !allowed.has(name))) return unsupported();
}

function decimal(value: ExactNumber | string): DecimalValue {
  const lexeme = typeof value === "string" ? value : value.lexeme;
  if (lexeme.length > INDIA_IRP_SIGNED_RECEIPT_BINDING_LIMITS.maxNumericLexemeCharacters) return exhausted();
  const match = /^(-?)(0|[1-9][0-9]*)(?:\.([0-9]+))?(?:[eE]([+-]?[0-9]+))?$/u.exec(lexeme);
  if (!match) return unsupported();
  const explicitExponent = match[4] === undefined ? 0n : BigInt(match[4]);
  if (explicitExponent < -1000n || explicitExponent > 1000n) return exhausted();
  let coefficient = `${match[2]}${match[3] ?? ""}`.replace(/^0+/u, "");
  if (coefficient.length === 0) {
    if (match[1] === "-") return unsupported();
    return Object.freeze({ sign: 0 as const, coefficient: "0", exponent: 0n });
  }
  let exponent = explicitExponent - BigInt((match[3] ?? "").length);
  while (coefficient.endsWith("0")) {
    coefficient = coefficient.slice(0, -1);
    exponent += 1n;
  }
  if (exponent < -1000n || exponent > 1000n) return exhausted();
  return Object.freeze({
    sign: match[1] === "-" ? -1 as const : 1 as const,
    coefficient,
    exponent,
  });
}

function equalDecimal(left: ExactNumber | string, right: ExactNumber | string): boolean {
  const first = decimal(left);
  const second = decimal(right);
  return first.sign === second.sign && first.coefficient === second.coefficient && first.exponent === second.exponent;
}

function compareDecimal(left: ExactNumber, right: ExactNumber): number {
  const first = decimal(left);
  const second = decimal(right);
  if (first.sign !== second.sign) return first.sign < second.sign ? -1 : 1;
  if (first.sign === 0) return 0;
  const firstMagnitude = BigInt(first.coefficient.length) + first.exponent;
  const secondMagnitude = BigInt(second.coefficient.length) + second.exponent;
  let magnitudeComparison = 0;
  if (firstMagnitude !== secondMagnitude) magnitudeComparison = firstMagnitude < secondMagnitude ? -1 : 1;
  else {
    const width = Math.max(first.coefficient.length, second.coefficient.length);
    const firstDigits = first.coefficient.padEnd(width, "0");
    const secondDigits = second.coefficient.padEnd(width, "0");
    magnitudeComparison = firstDigits === secondDigits ? 0 : firstDigits < secondDigits ? -1 : 1;
  }
  return first.sign === 1 ? magnitudeComparison : -magnitudeComparison;
}

function requireSameValue(original: FiscalExactJsonValue, signed: FiscalExactJsonValue): void {
  if (original.kind !== signed.kind) return unsupported();
  switch (original.kind) {
    case "null": return;
    case "boolean":
      if (signed.kind !== "boolean" || original.value !== signed.value) return mismatch();
      return;
    case "string":
      if (signed.kind !== "string" || original.value !== signed.value) return mismatch();
      return;
    case "number":
      if (signed.kind !== "number" || !equalDecimal(original, signed)) return mismatch();
      return;
    case "array": {
      if (signed.kind !== "array" || original.items.length !== signed.items.length) return unsupported();
      for (let index = 0; index < original.items.length; index += 1) {
        requireSameValue(original.items[index]!, signed.items[index]!);
      }
      return;
    }
    case "object": {
      if (signed.kind !== "object") return unsupported();
      const names = Object.keys(original.members);
      exactMembers(signed, names);
      for (const name of names) requireSameValue(original.members[name]!, signed.members[name]!);
    }
  }
}

type AdditionalFieldRule = (value: FiscalExactJsonValue) => void;

function requireNull(value: FiscalExactJsonValue): void {
  if (value.kind !== "null") return unsupported();
}

function requireNullOrN(value: FiscalExactJsonValue): void {
  if (value.kind === "null") return;
  if (value.kind !== "string" || value.value !== "N") return unsupported();
}

function requireNumericZero(value: FiscalExactJsonValue): void {
  const numeric = exactNumber(value);
  if (decimal(numeric).sign !== 0) return unsupported();
}

function compareAugmentedObject(
  original: ExactObject,
  signed: FiscalExactJsonValue,
  additions: Readonly<Record<string, AdditionalFieldRule>>,
  compareOriginal: (name: string, originalValue: FiscalExactJsonValue, signedValue: FiscalExactJsonValue) => void =
    (_name, originalValue, signedValue) => requireSameValue(originalValue, signedValue),
): void {
  const signedObject = exactObject(signed);
  const originalNames = Object.keys(original.members);
  for (const name of originalNames) {
    if (!Object.hasOwn(signedObject.members, name)) return unsupported();
    compareOriginal(name, original.members[name]!, signedObject.members[name]!);
  }
  for (const name of Object.keys(signedObject.members)) {
    if (Object.hasOwn(original.members, name)) continue;
    const rule = additions[name];
    if (!rule) return unsupported();
    rule(signedObject.members[name]!);
  }
}

const ROOT_NULL_ADDITIONS = Object.freeze(Object.assign(Object.create(null) as Record<string, AdditionalFieldRule>, {
  DispDtls: requireNull,
  ShipDtls: requireNull,
  PayDtls: requireNull,
  RefDtls: requireNull,
  AddlDocDtls: requireNull,
  ExpDtls: requireNull,
  EwbDtls: requireNull,
}));

const TRAN_ADDITIONS = Object.freeze(Object.assign(Object.create(null) as Record<string, AdditionalFieldRule>, {
  RegRev: requireNullOrN,
  IgstOnIntra: requireNullOrN,
  EcmGstin: requireNull,
}));

const PARTY_ADDITIONS = Object.freeze(Object.assign(Object.create(null) as Record<string, AdditionalFieldRule>, {
  TrdNm: requireNull,
  Addr2: requireNull,
  Ph: requireNull,
  Em: requireNull,
}));

const ITEM_NULL_ADDITIONS = ["PrdDesc", "Barcde", "OrdLineRef", "OrgCntry", "PrdSlNo", "BchDtls", "AttribDtls"];
const ITEM_ZERO_ADDITIONS = [
  "FreeQty", "Discount", "PreTaxVal", "CesRt", "CesAmt", "CesNonAdvlAmt", "StateCesRt", "StateCesAmt",
  "StateCesNonAdvlAmt", "OthChrg", "IgstAmt", "CgstAmt", "SgstAmt",
];
const VALUE_ZERO_ADDITIONS = ["CesVal", "StCesVal", "Discount", "OthChrg", "RndOffAmt", "IgstVal", "CgstVal", "SgstVal"];

function compareItem(original: ExactObject, signed: FiscalExactJsonValue): void {
  const additions = Object.create(null) as Record<string, AdditionalFieldRule>;
  for (const name of ITEM_NULL_ADDITIONS) additions[name] = requireNull;
  for (const name of ITEM_ZERO_ADDITIONS) additions[name] = requireNumericZero;
  additions.ItemNo = (value) => {
    const slNo = exactString(original.members.SlNo);
    const itemNo = exactNumber(value);
    const normalized = decimal(itemNo);
    if (normalized.sign !== 1 || normalized.exponent < 0n) return unsupported();
    if (!equalDecimal(itemNo, slNo)) return mismatch();
  };
  compareAugmentedObject(original, signed, additions);
}

function compareItemList(original: FiscalExactJsonValue, signed: FiscalExactJsonValue): void {
  if (original.kind !== "array" || signed.kind !== "array") return unsupported();
  if (original.items.length !== signed.items.length) return unsupported();
  for (let index = 0; index < original.items.length; index += 1) {
    compareItem(exactObject(original.items[index]!), signed.items[index]!);
  }
}

function valueAdditions(): Readonly<Record<string, AdditionalFieldRule>> {
  const additions = Object.create(null) as Record<string, AdditionalFieldRule>;
  for (const name of VALUE_ZERO_ADDITIONS) additions[name] = requireNumericZero;
  additions.TotInvValFc = requireNull;
  return additions;
}

function bindSignedInvoice(
  originalValue: FiscalExactJsonValue,
  signedValue: FiscalExactJsonValue,
  expectedIrn: string,
  expectedAckNo: string,
  expectedAckDt: string,
): ExactObject {
  const original = exactObject(originalValue);
  const signed = exactObject(signedValue);
  const originalNames = Object.keys(original.members);
  const receiptNames = ["AckNo", "AckDt", "Irn"];
  exactMembers(signed, [...originalNames, ...receiptNames], Object.keys(ROOT_NULL_ADDITIONS));
  for (const name of originalNames) {
    const originalMember = original.members[name]!;
    const signedMember = signed.members[name]!;
    if (name === "TranDtls") compareAugmentedObject(exactObject(originalMember), signedMember, TRAN_ADDITIONS);
    else if (name === "SellerDtls" || name === "BuyerDtls") {
      compareAugmentedObject(exactObject(originalMember), signedMember, PARTY_ADDITIONS);
    } else if (name === "ItemList") compareItemList(originalMember, signedMember);
    else if (name === "ValDtls") compareAugmentedObject(exactObject(originalMember), signedMember, valueAdditions());
    else requireSameValue(originalMember, signedMember);
  }
  for (const name of Object.keys(ROOT_NULL_ADDITIONS)) {
    if (Object.hasOwn(signed.members, name)) ROOT_NULL_ADDITIONS[name]!(signed.members[name]!);
  }
  const signedAckNo = exactNumber(signed.members.AckNo);
  const normalizedAck = decimal(signedAckNo);
  if (normalizedAck.sign !== 1 || normalizedAck.exponent < 0n) return unsupported();
  if (!equalDecimal(signedAckNo, expectedAckNo)) return mismatch();
  if (exactString(signed.members.AckDt) !== expectedAckDt || exactString(signed.members.Irn) !== expectedIrn) {
    return mismatch();
  }
  return signed;
}

function maximumHsn(original: ExactObject): string {
  const items = exactArray(original.members.ItemList);
  let maximum: ExactNumber | undefined;
  const hsns = new Set<string>();
  for (const itemValue of items.items) {
    const item = exactObject(itemValue);
    const assessable = exactNumber(item.members.AssAmt);
    const hsn = exactString(item.members.HsnCd);
    if (!maximum || compareDecimal(assessable, maximum) > 0) {
      maximum = assessable;
      hsns.clear();
      hsns.add(hsn);
    } else if (compareDecimal(assessable, maximum) === 0) hsns.add(hsn);
  }
  if (!maximum || hsns.size !== 1) return unsupported();
  return hsns.values().next().value as string;
}

function bindSignedQr(
  originalValue: FiscalExactJsonValue,
  signedValue: FiscalExactJsonValue,
  expectedIrn: string,
  expectedAckDt: string,
): ExactObject {
  const original = exactObject(originalValue);
  const signed = exactObject(signedValue);
  exactMembers(signed, [
    "SellerGstin", "BuyerGstin", "DocNo", "DocTyp", "DocDt", "TotInvVal", "ItemCnt", "MainHsnCode", "Irn",
  ], ["IrnDt"]);
  const seller = exactObject(original.members.SellerDtls!);
  const buyer = exactObject(original.members.BuyerDtls!);
  const document = exactObject(original.members.DocDtls!);
  const values = exactObject(original.members.ValDtls!);
  const items = exactArray(original.members.ItemList);
  const identities: readonly [FiscalExactJsonValue | undefined, FiscalExactJsonValue | undefined][] = [
    [seller.members.Gstin, signed.members.SellerGstin],
    [buyer.members.Gstin, signed.members.BuyerGstin],
    [document.members.No, signed.members.DocNo],
    [document.members.Typ, signed.members.DocTyp],
    [document.members.Dt, signed.members.DocDt],
  ];
  for (const [originalIdentity, signedIdentity] of identities) {
    if (!originalIdentity || !signedIdentity) return unsupported();
    requireSameValue(originalIdentity, signedIdentity);
  }
  if (!equalDecimal(exactNumber(values.members.TotInvVal), exactNumber(signed.members.TotInvVal))) return mismatch();
  const itemCount = exactNumber(signed.members.ItemCnt);
  const normalizedCount = decimal(itemCount);
  if (normalizedCount.sign !== 1 || normalizedCount.exponent < 0n) return unsupported();
  if (!equalDecimal(itemCount, String(items.items.length))) return mismatch();
  if (exactString(signed.members.MainHsnCode) !== maximumHsn(original)
      || exactString(signed.members.Irn) !== expectedIrn) return mismatch();
  if (Object.hasOwn(signed.members, "IrnDt") && exactString(signed.members.IrnDt) !== expectedAckDt) return mismatch();
  return signed;
}

function signedInner(
  evidence: Readonly<FiscalSignedJwsSignatureEvidence>,
  issuer: string,
): FiscalExactJsonValue {
  const outer = exactObject(evidence.payload);
  exactMembers(outer, ["data", "iss"]);
  if (exactString(outer.members.iss) !== issuer) return mismatch();
  const decoded = decodeFiscalExactJson(exactString(outer.members.data));
  if (!decoded.ok) {
    if (decoded.error.code === "resource_exhausted") return exhausted();
    return unsupported();
  }
  if (decoded.value.kind !== "object") return unsupported();
  return decoded.value;
}

function mapSignedArtifactFailure(
  result: Awaited<ReturnType<FiscalSignedJwsVerifier["verify"]>>,
): IndiaIrpSignedReceiptBindingResult | null {
  if (result.ok) return null;
  if (result.error.code === "resource_exhausted") {
    return failure("resource_exhausted", "India IRP signed receipt resource limit exceeded");
  }
  if (result.error.code === "verification_failed") {
    return failure("signature_verification_failed", "India IRP signed receipt signature verification failed");
  }
  return failure("invalid_signed_artifact", "India IRP signed receipt artifact is invalid");
}

async function verifyBinding(
  verifier: FiscalSignedJwsVerifier,
  profileVersion: typeof INDIA_IRP_SIGNED_RECEIPT_PROFILE_VERSION,
  issuer: string,
  inputValue: unknown,
  verificationUnixMsValue: unknown,
): Promise<IndiaIrpSignedReceiptBindingResult> {
  const snapshot = snapshotInput(inputValue);
  if (!snapshot || typeof verificationUnixMsValue !== "number" || !Number.isSafeInteger(verificationUnixMsValue)
      || verificationUnixMsValue < 0) return failure("invalid_input", "India IRP signed receipt input is invalid");
  try {
    if (!validateCheapInput(snapshot)) return failure("invalid_input", "India IRP signed receipt input is invalid");
  } catch (error) {
    if (error instanceof BindingResourceExhausted) {
      return failure("resource_exhausted", "India IRP signed receipt resource limit exceeded");
    }
    return failure("invalid_input", "India IRP signed receipt input is invalid");
  }

  const projected = projectIssuedIndiaIrpWireCandidate({
    documentId: snapshot.documentId,
    documentSha256: snapshot.documentSha256,
    contentJson: snapshot.contentJson,
  });
  if (!projected.ok) {
    if (projected.error.code === "source_hash_mismatch") {
      return failure("source_hash_mismatch", "India IRP issued document hash does not match");
    }
    if (projected.error.code === "invalid_issued_document") {
      return failure("invalid_issued_document", "India IRP issued document is invalid");
    }
    return failure("invalid_input", "India IRP signed receipt input is invalid");
  }

  const [invoiceResult, qrResult] = await Promise.all([
    verifier.verify(snapshot.signedInvoice, verificationUnixMsValue),
    verifier.verify(snapshot.signedQRCode, verificationUnixMsValue),
  ]);
  const invoiceFailure = mapSignedArtifactFailure(invoiceResult);
  if (invoiceFailure) return invoiceFailure;
  const qrFailure = mapSignedArtifactFailure(qrResult);
  if (qrFailure) return qrFailure;
  if (!invoiceResult.ok || !qrResult.ok) {
    return failure("invalid_signed_artifact", "India IRP signed receipt artifact is invalid");
  }

  try {
    const original = decodeFiscalExactJson(projected.value.wireJson);
    if (!original.ok) return failure("invalid_issued_document", "India IRP issued document is invalid");
    const invoiceInner = signedInner(invoiceResult.value, issuer);
    const qrInner = signedInner(qrResult.value, issuer);
    bindSignedInvoice(original.value, invoiceInner, snapshot.irn, snapshot.ackNo, snapshot.ackDt);
    bindSignedQr(original.value, qrInner, snapshot.irn, snapshot.ackDt);
    return Object.freeze({
      ok: true as const,
      value: Object.freeze({
        kind: "india_irp_signed_receipt_binding_v1" as const,
        profileVersion,
        issuer,
        verificationUnixMs: verificationUnixMsValue,
        documentId: projected.value.documentId,
        documentSha256: projected.value.documentSha256,
        wireJson: projected.value.wireJson,
        wireSha256: projected.value.wireSha256,
        irn: snapshot.irn,
        ackNo: snapshot.ackNo,
        ackDt: snapshot.ackDt,
        signedInvoice: invoiceResult.value,
        signedQRCode: qrResult.value,
        providerAcceptanceEstablished: false as const,
        authenticatedProviderSandboxCertified: false as const,
      }),
    });
  } catch (error) {
    if (error instanceof BindingResourceExhausted) {
      return failure("resource_exhausted", "India IRP signed receipt resource limit exceeded");
    }
    if (error instanceof ReceiptBindingMismatch) {
      return failure("receipt_binding_mismatch", "India IRP signed receipt does not bind to the issued document");
    }
    return failure("unsupported_signed_shape", "India IRP signed receipt shape is unsupported");
  }
}

/** Configuration and its verification time must come from authenticated runtime policy. */
export async function createIndiaIrpSignedReceiptBindingVerifier(
  configuration: unknown,
): Promise<IndiaIrpSignedReceiptBindingFactoryResult> {
  if (typeof configuration !== "string") {
    return failure("invalid_input", "India IRP signed receipt binding configuration input is invalid");
  }
  if (configuration.length > INDIA_IRP_SIGNED_RECEIPT_BINDING_LIMITS.maxConfigurationUtf8Bytes
      || new TextEncoder().encode(configuration).byteLength
        > INDIA_IRP_SIGNED_RECEIPT_BINDING_LIMITS.maxConfigurationUtf8Bytes) {
    return failure("resource_exhausted", "India IRP signed receipt binding configuration resource limit exceeded");
  }
  try {
    const decoded = decodeFiscalExactJson(configuration);
    if (!decoded.ok) {
      if (decoded.error.code === "resource_exhausted") return exhausted();
      return invalidConfiguration();
    }
    const root = configurationObject(decoded.value);
    const profileVersion = configurationString(root.members.profileVersion);
    const issuer = configurationString(root.members.issuer);
    const trustBundleJson = configurationString(root.members.trustBundleJson);
    if (profileVersion !== INDIA_IRP_SIGNED_RECEIPT_PROFILE_VERSION || !printableAscii(issuer, 128)) {
      return invalidConfiguration();
    }
    const signedVerifier = await createFiscalSignedJwsVerifier(trustBundleJson);
    if (!signedVerifier.ok) {
      if (signedVerifier.error.code === "resource_exhausted") return exhausted();
      return invalidConfiguration();
    }
    const bindingVerifier: IndiaIrpSignedReceiptBindingVerifier = Object.freeze({
      kind: "india_irp_signed_receipt_binding_verifier_v1" as const,
      profileVersion,
      issuer,
      verify(input: unknown, verificationUnixMs: unknown) {
        return verifyBinding(signedVerifier.value, profileVersion, issuer, input, verificationUnixMs);
      },
    });
    return Object.freeze({ ok: true as const, value: bindingVerifier });
  } catch (error) {
    if (error instanceof BindingResourceExhausted) {
      return failure("resource_exhausted", "India IRP signed receipt binding configuration resource limit exceeded");
    }
    return failure("invalid_configuration", "India IRP signed receipt binding configuration is invalid");
  }
}
