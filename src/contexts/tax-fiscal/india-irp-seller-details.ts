import { types as utilTypes } from "node:util";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const POSITIVE_INTEGER = /^[1-9][0-9]*$/;
const PINCODE = /^[1-9][0-9]{5}$/;
const GSTIN = /^([0-9]{2})[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const GST_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const GST_STATE_CODES = new Set([
  "01", "02", "03", "04", "05", "06", "07", "08", "09", "10",
  "11", "12", "13", "14", "15", "16", "17", "18", "19", "20",
  "21", "22", "23", "24", "26", "27", "29", "30", "31", "32",
  "33", "34", "35", "36", "37", "38",
]);

const SOURCE_KEYS = [
  "registrationId",
  "propertyNode",
  "scheme",
  "currency",
  "jurisdiction",
  "gstin",
  "stateCode",
  "legalName",
  "tradeName",
  "addressLine",
  "locality",
  "postalCode",
  "evidenceHash",
] as const;

const JURISDICTION_KEYS = [
  "extensionId",
  "ownerTenantId",
  "key",
  "version",
  "contentHash",
] as const;

export interface IndiaIrpSellerDetailsV1 {
  readonly Gstin: string;
  readonly LglNm: string;
  readonly TrdNm?: string;
  readonly Addr1: string;
  readonly Loc: string;
  readonly Pin: number;
  readonly Stcd: string;
}

export interface IndiaIrpSellerDetailsResultV1 {
  readonly format: "irp_json_1_1";
  readonly lineage: Readonly<{
    registrationId: string;
    evidenceHash: string;
  }>;
  readonly payload: Readonly<{
    SellerDtls: Readonly<IndiaIrpSellerDetailsV1>;
  }>;
  readonly payloadJson: string;
  readonly payloadHash: string;
}

export class IndiaIrpSellerDetailsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaIrpSellerDetailsError";
  }
}

function exactFrozenRecord(
  value: unknown,
  expectedKeys: readonly string[],
  subject: string,
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value) ||
      utilTypes.isProxy(value) || !Object.isFrozen(value)) {
    throw new IndiaIrpSellerDetailsError(`${subject} must be an exact frozen plain object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new IndiaIrpSellerDetailsError(`${subject} must be an exact frozen plain object`);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Object.keys(descriptors).sort();
  const expected = [...expectedKeys].sort();
  if (Object.getOwnPropertySymbols(value).length !== 0 ||
      keys.length !== expected.length || keys.some((key, index) => key !== expected[index]) ||
      Object.values(descriptors).some((descriptor) =>
        descriptor.get !== undefined || descriptor.set !== undefined ||
        descriptor.enumerable !== true || descriptor.configurable !== false ||
        ("writable" in descriptor && descriptor.writable !== false))) {
    throw new IndiaIrpSellerDetailsError(`${subject} shape is invalid`);
  }
  return value as Record<string, unknown>;
}

function canonicalUuid(value: unknown, subject: string): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new IndiaIrpSellerDetailsError(`${subject} must be a canonical UUID`);
  }
  return value;
}

function canonicalText(
  value: unknown,
  subject: string,
  maxLength?: number,
): string {
  if (typeof value !== "string" || value.length === 0 ||
      (maxLength !== undefined && value.length > maxLength) ||
      value !== value.trim() || value !== value.normalize("NFC") ||
      /[\u0000-\u001f\u007f]/.test(value)) {
    throw new IndiaIrpSellerDetailsError(`${subject} is not canonical`);
  }
  return value;
}

function canonicalVersion(value: unknown): string {
  if (typeof value !== "string" || !POSITIVE_INTEGER.test(value)) {
    throw new IndiaIrpSellerDetailsError("jurisdiction version is invalid");
  }
  const numeric = Number(value);
  if (!Number.isSafeInteger(numeric) || numeric <= 0) {
    throw new IndiaIrpSellerDetailsError("jurisdiction version is invalid");
  }
  return value;
}

function canonicalHash(value: unknown, subject: string): string {
  if (typeof value !== "string" || !SHA256.test(value)) {
    throw new IndiaIrpSellerDetailsError(`${subject} must be a canonical SHA-256`);
  }
  return value;
}

function gstinChecksum(body: string): string {
  let factor = 2;
  let sum = 0;
  for (let index = body.length - 1; index >= 0; index -= 1) {
    const character = body[index];
    if (character === undefined) {
      throw new IndiaIrpSellerDetailsError("GSTIN body is invalid");
    }
    const codePoint = GST_ALPHABET.indexOf(character);
    if (codePoint < 0) {
      throw new IndiaIrpSellerDetailsError("GSTIN body is invalid");
    }
    const addend = factor * codePoint;
    factor = factor === 2 ? 1 : 2;
    sum += Math.floor(addend / 36) + addend % 36;
  }
  const checksum = GST_ALPHABET[(36 - sum % 36) % 36];
  if (checksum === undefined) {
    throw new IndiaIrpSellerDetailsError("GSTIN checksum is invalid");
  }
  return checksum;
}

function canonicalGstin(value: unknown, stateCode: unknown): Readonly<{
  gstin: string;
  stateCode: string;
}> {
  if (typeof stateCode !== "string" || !GST_STATE_CODES.has(stateCode)) {
    throw new IndiaIrpSellerDetailsError("GST state code is invalid");
  }
  if (typeof value !== "string" || value.length !== 15 || !GSTIN.test(value) ||
      value.slice(0, 2) !== stateCode ||
      gstinChecksum(value.slice(0, 14)) !== value[14]) {
    throw new IndiaIrpSellerDetailsError("GSTIN is not canonical");
  }
  return Object.freeze({ gstin: value, stateCode });
}

function canonicalPincode(value: unknown): number {
  if (typeof value !== "string" || !PINCODE.test(value)) {
    throw new IndiaIrpSellerDetailsError("supplier PIN is invalid");
  }
  return Number(value);
}

export function buildIndiaIrpSellerDetails(
  source: unknown,
): IndiaIrpSellerDetailsResultV1 {
  const exact = exactFrozenRecord(source, SOURCE_KEYS, "supplier evidence");
  const jurisdiction = exactFrozenRecord(
    exact.jurisdiction,
    JURISDICTION_KEYS,
    "supplier jurisdiction",
  );

  const registrationId = canonicalUuid(exact.registrationId, "registrationId");
  canonicalUuid(exact.propertyNode, "propertyNode");
  if (exact.scheme !== "in-gstin" || exact.currency !== "INR") {
    throw new IndiaIrpSellerDetailsError("supplier scheme or currency is invalid");
  }
  canonicalUuid(jurisdiction.extensionId, "jurisdiction extensionId");
  if (jurisdiction.ownerTenantId !== null) {
    canonicalUuid(jurisdiction.ownerTenantId, "jurisdiction ownerTenantId");
  }
  canonicalText(jurisdiction.key, "jurisdiction key");
  canonicalVersion(jurisdiction.version);
  canonicalHash(jurisdiction.contentHash, "jurisdiction contentHash");

  const registration = canonicalGstin(exact.gstin, exact.stateCode);
  const legalName = canonicalText(exact.legalName, "supplier legalName", 100);
  const tradeName = exact.tradeName === null
    ? null
    : canonicalText(exact.tradeName, "supplier tradeName", 100);
  const addressLine = canonicalText(exact.addressLine, "supplier addressLine", 100);
  const locality = canonicalText(exact.locality, "supplier locality", 50);
  const pincode = canonicalPincode(exact.postalCode);
  const evidenceHash = canonicalHash(exact.evidenceHash, "evidenceHash");

  const sellerDetails: Readonly<IndiaIrpSellerDetailsV1> = tradeName === null
    ? Object.freeze({
        Gstin: registration.gstin,
        LglNm: legalName,
        Addr1: addressLine,
        Loc: locality,
        Pin: pincode,
        Stcd: registration.stateCode,
      })
    : Object.freeze({
        Gstin: registration.gstin,
        LglNm: legalName,
        TrdNm: tradeName,
        Addr1: addressLine,
        Loc: locality,
        Pin: pincode,
        Stcd: registration.stateCode,
      });
  const payload = Object.freeze({ SellerDtls: sellerDetails });
  const payloadJson = JSON.stringify(payload);
  const payloadHash = new Bun.CryptoHasher("sha256").update(payloadJson).digest("hex");
  return Object.freeze({
    format: "irp_json_1_1",
    lineage: Object.freeze({ registrationId, evidenceHash }),
    payload,
    payloadJson,
    payloadHash,
  });
}
