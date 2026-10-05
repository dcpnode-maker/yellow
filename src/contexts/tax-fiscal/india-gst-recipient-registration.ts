import { types as utilTypes } from "node:util";

import type { Tx } from "../../kernel";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const GSTIN = /^([0-9]{2})[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const PIN = /^[1-9][0-9]{5}$/;
const GST_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const GST_STATE_CODES = new Set([
  "01", "02", "03", "04", "05", "06", "07", "08", "09", "10",
  "11", "12", "13", "14", "15", "16", "17", "18", "19", "20",
  "21", "22", "23", "24", "26", "27", "29", "30", "31", "32",
  "33", "34", "35", "36", "37", "38",
]);

const INPUT_KEYS = ["tenantId", "recipientPartyId", "registrationId"] as const;
const ROW_KEYS = [
  "id",
  "tenant_id",
  "party_id",
  "scheme",
  "registration_number",
  "region_code",
  "legal_name",
  "trade_name",
  "address_line1",
  "locality",
  "pin",
] as const;

interface RecipientRegistrationRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly party_id: string;
  readonly scheme: string;
  readonly registration_number: string;
  readonly region_code: string;
  readonly legal_name: string;
  readonly trade_name: string | null;
  readonly address_line1: string;
  readonly locality: string;
  readonly pin: string;
}

export interface IndiaGstRecipientRegistrationInput {
  readonly tenantId: string;
  readonly recipientPartyId: string;
  readonly registrationId: string;
}

export interface IndiaGstRecipientRegistrationResult {
  readonly registrationId: string;
  readonly partyId: string;
  readonly scheme: "in-gstin";
  readonly gstin: string;
  readonly stateCode: string;
  readonly legalName: string;
  readonly tradeName: string | null;
  readonly addressLine1: string;
  readonly locality: string;
  readonly pin: string;
  readonly evidenceHash: string;
}

export class IndiaGstRecipientRegistrationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaGstRecipientRegistrationValidationError";
  }
}

export class IndiaGstRecipientRegistrationNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaGstRecipientRegistrationNotFoundError";
  }
}

export class IndiaGstRecipientRegistrationConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaGstRecipientRegistrationConflictError";
  }
}

function exactPlainInput(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value) ||
      utilTypes.isProxy(value) ||
      (Object.getPrototypeOf(value) !== Object.prototype &&
        Object.getPrototypeOf(value) !== null) ||
      Object.getOwnPropertySymbols(value).length !== 0) {
    throw new IndiaGstRecipientRegistrationValidationError(
      "GST recipient-registration input must be an exact plain object",
    );
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Object.keys(descriptors).sort();
  const expected = [...INPUT_KEYS].sort();
  if (keys.length !== expected.length ||
      keys.some((key, index) => key !== expected[index]) ||
      Object.values(descriptors).some((descriptor) =>
        descriptor.get !== undefined || descriptor.set !== undefined ||
        descriptor.enumerable !== true || !("value" in descriptor))) {
    throw new IndiaGstRecipientRegistrationValidationError(
      "GST recipient-registration input shape is invalid",
    );
  }
  return value as Record<string, unknown>;
}

function inputUuid(value: unknown, subject: string): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new IndiaGstRecipientRegistrationValidationError(
      `${subject} must be a canonical UUID`,
    );
  }
  return value;
}

function normalizeInput(value: unknown): IndiaGstRecipientRegistrationInput {
  const input = exactPlainInput(value);
  return Object.freeze({
    tenantId: inputUuid(input.tenantId, "tenantId"),
    recipientPartyId: inputUuid(input.recipientPartyId, "recipientPartyId"),
    registrationId: inputUuid(input.registrationId, "registrationId"),
  });
}

function storedUuid(value: unknown, subject: string): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new IndiaGstRecipientRegistrationConflictError(`${subject} is invalid`);
  }
  return value;
}

function storedText(value: unknown, subject: string, maxLength: number): string {
  if (typeof value !== "string" || value.length === 0 || value.length > maxLength ||
      value !== value.trim() || value !== value.normalize("NFC") ||
      /[\u0000-\u001f\u007f]/.test(value)) {
    throw new IndiaGstRecipientRegistrationConflictError(`${subject} is not canonical`);
  }
  return value;
}

function storedOptionalText(
  value: unknown,
  subject: string,
  maxLength: number,
): string | null {
  return value === null ? null : storedText(value, subject, maxLength);
}

function gstinChecksum(body: string): string {
  let factor = 2;
  let sum = 0;
  for (let index = body.length - 1; index >= 0; index -= 1) {
    const character = body[index];
    if (character === undefined) {
      throw new IndiaGstRecipientRegistrationConflictError("GSTIN body is invalid");
    }
    const codePoint = GST_ALPHABET.indexOf(character);
    if (codePoint < 0) {
      throw new IndiaGstRecipientRegistrationConflictError("GSTIN body is invalid");
    }
    const addend = factor * codePoint;
    factor = factor === 2 ? 1 : 2;
    sum += Math.floor(addend / 36) + addend % 36;
  }
  const checksum = GST_ALPHABET[(36 - sum % 36) % 36];
  if (checksum === undefined) {
    throw new IndiaGstRecipientRegistrationConflictError("GSTIN checksum is invalid");
  }
  return checksum;
}

function storedGstin(value: unknown, stateCode: unknown): Readonly<{
  gstin: string;
  stateCode: string;
}> {
  if (typeof stateCode !== "string" || !GST_STATE_CODES.has(stateCode)) {
    throw new IndiaGstRecipientRegistrationConflictError("GST state code is invalid");
  }
  if (typeof value !== "string" || !GSTIN.test(value) ||
      value.slice(0, 2) !== stateCode ||
      gstinChecksum(value.slice(0, 14)) !== value[14]) {
    throw new IndiaGstRecipientRegistrationConflictError("GSTIN is not canonical");
  }
  return Object.freeze({ gstin: value, stateCode });
}

function exactStoredRow(value: unknown): RecipientRegistrationRow {
  if (typeof value !== "object" || value === null || Array.isArray(value) ||
      utilTypes.isProxy(value) || Object.getOwnPropertySymbols(value).length !== 0 ||
      (Object.getPrototypeOf(value) !== Object.prototype &&
        Object.getPrototypeOf(value) !== null)) {
    throw new IndiaGstRecipientRegistrationConflictError(
      "Stored GST recipient registration row is invalid",
    );
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Object.keys(descriptors).sort();
  const expected = [...ROW_KEYS].sort();
  if (keys.length !== expected.length ||
      keys.some((key, index) => key !== expected[index]) ||
      Object.values(descriptors).some((descriptor) =>
        descriptor.get !== undefined || descriptor.set !== undefined ||
        descriptor.enumerable !== true || !("value" in descriptor))) {
    throw new IndiaGstRecipientRegistrationConflictError(
      "Stored GST recipient registration row shape is invalid",
    );
  }
  return value as RecipientRegistrationRow;
}

function canonicalResult(
  candidate: unknown,
  input: IndiaGstRecipientRegistrationInput,
): IndiaGstRecipientRegistrationResult {
  const row = exactStoredRow(candidate);
  const registrationId = storedUuid(row.id, "stored recipient-registration id");
  const tenantId = storedUuid(row.tenant_id, "stored recipient-registration tenant id");
  const partyId = storedUuid(row.party_id, "stored recipient-registration party id");
  if (registrationId !== input.registrationId || tenantId !== input.tenantId ||
      partyId !== input.recipientPartyId || row.scheme !== "in-gstin") {
    throw new IndiaGstRecipientRegistrationConflictError(
      "Stored GST recipient registration conflicts with the selected identity",
    );
  }
  const registration = storedGstin(row.registration_number, row.region_code);
  const legalName = storedText(row.legal_name, "GST recipient legal name", 100);
  const tradeName = storedOptionalText(row.trade_name, "GST recipient trade name", 100);
  const addressLine1 = storedText(row.address_line1, "GST recipient address line1", 100);
  const locality = storedText(row.locality, "GST recipient locality", 50);
  if (typeof row.pin !== "string" || !PIN.test(row.pin)) {
    throw new IndiaGstRecipientRegistrationConflictError("GST recipient PIN is invalid");
  }

  const evidence = {
    registrationId,
    tenantId,
    partyId,
    scheme: "in-gstin" as const,
    gstin: registration.gstin,
    stateCode: registration.stateCode,
    legalName,
    tradeName,
    addressLine1,
    locality,
    pin: row.pin,
  };
  const evidenceHash = new Bun.CryptoHasher("sha256")
    .update(JSON.stringify(evidence))
    .digest("hex");
  return Object.freeze({
    registrationId,
    partyId,
    scheme: "in-gstin",
    gstin: registration.gstin,
    stateCode: registration.stateCode,
    legalName,
    tradeName,
    addressLine1,
    locality,
    pin: row.pin,
    evidenceHash,
  });
}

async function readExactRegistration(
  tx: Tx,
  input: IndiaGstRecipientRegistrationInput,
): Promise<IndiaGstRecipientRegistrationResult> {
  const rows = await tx<RecipientRegistrationRow[]>`
    SELECT registration.id::text AS id,
           registration.tenant_id::text AS tenant_id,
           registration.party_id::text AS party_id,
           registration.scheme,
           registration.registration_number,
           registration.region_code,
           registration.legal_name,
           registration.trade_name,
           registration.address_line1,
           registration.locality,
           registration.pin
      FROM public.party_fiscal_registration AS registration
      JOIN public.party AS party
        ON party.tenant_id = registration.tenant_id
       AND party.id = registration.party_id
       AND party.status = 'active'
       AND party.merged_into IS NULL
     WHERE registration.tenant_id = ${input.tenantId}::uuid
       AND registration.tenant_id = current_setting('app.tenant_id', true)::uuid
       AND registration.party_id = ${input.recipientPartyId}::uuid
       AND registration.id = ${input.registrationId}::uuid
       AND registration.scheme = 'in-gstin'
     ORDER BY registration.id
  `;
  if (rows.length === 0) {
    throw new IndiaGstRecipientRegistrationNotFoundError(
      "Selected India GST recipient registration is unavailable",
    );
  }
  if (rows.length !== 1 || rows[0] === undefined) {
    throw new IndiaGstRecipientRegistrationConflictError(
      "Selected India GST recipient registration is ambiguous",
    );
  }
  return canonicalResult(rows[0], input);
}

export class IndiaGstRecipientRegistrationService {
  async discover(
    tx: Tx,
    input: IndiaGstRecipientRegistrationInput,
  ): Promise<IndiaGstRecipientRegistrationResult> {
    if (typeof tx !== "function") {
      throw new IndiaGstRecipientRegistrationValidationError(
        "tenant transaction is unavailable",
      );
    }
    return readExactRegistration(tx, normalizeInput(input));
  }

  async resolve(
    tx: Tx,
    input: IndiaGstRecipientRegistrationInput,
  ): Promise<IndiaGstRecipientRegistrationResult> {
    if (typeof tx !== "function") {
      throw new IndiaGstRecipientRegistrationValidationError(
        "tenant transaction is unavailable",
      );
    }
    return readExactRegistration(tx, normalizeInput(input));
  }
}
