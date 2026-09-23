import { types as utilTypes } from "node:util";

import type { Tx } from "../../kernel";
import {
  IndiaGstRecipientRegistrationService,
  type IndiaGstRecipientRegistrationInput,
} from "./india-gst-recipient-registration";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const DATE = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/;
const DATE_RANGE = /^\[([0-9]{4}-[0-9]{2}-[0-9]{2}),([0-9]{4}-[0-9]{2}-[0-9]{2})\)$/;
const GSTIN = /^([0-9]{2})[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const PIN = /^[1-9][0-9]{5}$/;
const GST_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const GST_STATE_CODES = new Set([
  "01", "02", "03", "04", "05", "06", "07", "08", "09", "10",
  "11", "12", "13", "14", "15", "16", "17", "18", "19", "20",
  "21", "22", "23", "24", "26", "27", "29", "30", "31", "32",
  "33", "34", "35", "36", "37", "38",
]);

const INPUT_KEYS = [
  "tenantId",
  "recipientPartyId",
  "recipientRegistrationId",
  "recipientSezStatusId",
] as const;
const RECIPIENT_REGISTRATION_KEYS = [
  "registrationId",
  "partyId",
  "scheme",
  "gstin",
  "stateCode",
  "legalName",
  "tradeName",
  "addressLine1",
  "locality",
  "pin",
  "evidenceHash",
] as const;
const ROW_KEYS = [
  "tenant_id",
  "id",
  "recipient_registration_id",
  "recipient_registration_evidence_hash",
  "status_as_of",
  "gst_registration_status",
  "gst_taxpayer_type",
  "gst_status_source",
  "gst_status_evidence_sha256",
  "approval_form",
  "approval_reference",
  "approval_validity",
  "approval_status",
  "approval_evidence_sha256",
  "legal_rule",
] as const;

type GstTaxpayerType = "regular" | "sez_unit" | "sez_developer";
type RecipientSezStatus =
  | "affirmatively_non_sez_regular"
  | "sez_unit"
  | "sez_developer";
type ApprovalForm =
  | "sez_rules_form_g"
  | "sez_rules_form_b"
  | "sez_rules_form_c";

interface RecipientRegistrationResolver {
  resolve(
    tx: Tx,
    input: IndiaGstRecipientRegistrationInput,
  ): Promise<unknown>;
}

interface RecipientSezStatusRow {
  readonly tenant_id: string;
  readonly id: string;
  readonly recipient_registration_id: string;
  readonly recipient_registration_evidence_hash: string;
  readonly status_as_of: string;
  readonly gst_registration_status: string;
  readonly gst_taxpayer_type: string;
  readonly gst_status_source: string;
  readonly gst_status_evidence_sha256: string;
  readonly approval_form: string | null;
  readonly approval_reference: string | null;
  readonly approval_validity: string | null;
  readonly approval_status: string | null;
  readonly approval_evidence_sha256: string | null;
  readonly legal_rule: string;
}

type RecipientEvidence = Readonly<{
  partyId: string;
  registrationId: string;
  evidenceHash: string;
}>;

type GstRegistrationEvidence = Readonly<{
  status: "active";
  taxpayerType: GstTaxpayerType;
  source: "gst_common_portal";
  evidenceSha256: string;
}>;

type ApprovalEvidence = Readonly<{
  form: ApprovalForm;
  reference: string;
  validity: Readonly<{
    fromInclusive: string;
    toExclusive: string;
  }>;
  status: "in_force";
  evidenceSha256: string;
}>;

export interface IndiaGstRecipientSezStatusInput {
  readonly tenantId: string;
  readonly recipientPartyId: string;
  readonly recipientRegistrationId: string;
  readonly recipientSezStatusId: string;
}

export interface IndiaGstRecipientSezStatusResult {
  readonly recipientSezStatusId: string;
  readonly recipient: RecipientEvidence;
  readonly statusAsOf: string;
  readonly gstRegistration: GstRegistrationEvidence;
  readonly sezStatus: RecipientSezStatus;
  readonly approval: ApprovalEvidence | null;
  readonly legalRule: "IGST_ACT_7_5_B_AND_8_2_RECIPIENT_STATUS";
  readonly evidenceHash: string;
}

export class IndiaGstRecipientSezStatusValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaGstRecipientSezStatusValidationError";
  }
}

export class IndiaGstRecipientSezStatusNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaGstRecipientSezStatusNotFoundError";
  }
}

export class IndiaGstRecipientSezStatusConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaGstRecipientSezStatusConflictError";
  }
}

function conflict(message: string): IndiaGstRecipientSezStatusConflictError {
  return new IndiaGstRecipientSezStatusConflictError(message);
}

function exactRecord(
  value: unknown,
  expectedKeys: readonly string[],
  subject: string,
  frozen: boolean,
  error: (message: string) => Error,
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value) ||
      utilTypes.isProxy(value) || Object.getOwnPropertySymbols(value).length !== 0 ||
      (Object.getPrototypeOf(value) !== Object.prototype &&
        Object.getPrototypeOf(value) !== null) ||
      (frozen && !Object.isFrozen(value))) {
    throw error(`${subject} must be an exact ${frozen ? "frozen " : ""}plain object`);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Object.keys(descriptors).sort();
  const expected = [...expectedKeys].sort();
  if (keys.length !== expected.length ||
      keys.some((key, index) => key !== expected[index]) ||
      Object.values(descriptors).some((descriptor) =>
        descriptor.get !== undefined || descriptor.set !== undefined ||
        descriptor.enumerable !== true || !("value" in descriptor) ||
        (frozen && (descriptor.configurable !== false || descriptor.writable !== false)))) {
    throw error(`${subject} shape is invalid`);
  }
  return value as Record<string, unknown>;
}

function uuid(value: unknown, subject: string, input = false): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw input
      ? new IndiaGstRecipientSezStatusValidationError(
          `${subject} must be a canonical UUID`,
        )
      : conflict(`${subject} is invalid`);
  }
  return value;
}

function hash(value: unknown, subject: string): string {
  if (typeof value !== "string" || !SHA256.test(value)) {
    throw conflict(`${subject} is invalid`);
  }
  return value;
}

function sha256(value: unknown): string {
  return new Bun.CryptoHasher("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}

function normalizedText(value: unknown, subject: string, maxLength: number): string {
  if (typeof value !== "string" || value.length === 0 || value.length > maxLength ||
      value !== value.trim() || value !== value.normalize("NFC") ||
      /[\u0000-\u001f\u007f]/.test(value)) {
    throw conflict(`${subject} is not canonical`);
  }
  return value;
}

function normalizeInput(value: unknown): IndiaGstRecipientSezStatusInput {
  const input = exactRecord(
    value,
    INPUT_KEYS,
    "India GST recipient SEZ-status input",
    false,
    (message) => new IndiaGstRecipientSezStatusValidationError(message),
  );
  return Object.freeze({
    tenantId: uuid(input.tenantId, "tenantId", true),
    recipientPartyId: uuid(input.recipientPartyId, "recipientPartyId", true),
    recipientRegistrationId: uuid(
      input.recipientRegistrationId,
      "recipientRegistrationId",
      true,
    ),
    recipientSezStatusId: uuid(
      input.recipientSezStatusId,
      "recipientSezStatusId",
      true,
    ),
  });
}

function gstinChecksum(body: string): string {
  let factor = 2;
  let sum = 0;
  for (let index = body.length - 1; index >= 0; index -= 1) {
    const character = body[index];
    const codePoint = character === undefined ? -1 : GST_ALPHABET.indexOf(character);
    if (codePoint < 0) {
      throw conflict("recipient GSTIN is not canonical");
    }
    const addend = factor * codePoint;
    factor = factor === 2 ? 1 : 2;
    sum += Math.floor(addend / 36) + addend % 36;
  }
  const checksum = GST_ALPHABET[(36 - sum % 36) % 36];
  if (checksum === undefined) {
    throw conflict("recipient GSTIN is not canonical");
  }
  return checksum;
}

function exactRecipientRegistration(
  value: unknown,
  input: IndiaGstRecipientSezStatusInput,
): RecipientEvidence {
  const recipient = exactRecord(
    value,
    RECIPIENT_REGISTRATION_KEYS,
    "India GST recipient-registration evidence",
    true,
    conflict,
  );
  const registrationId = uuid(recipient.registrationId, "recipient registration id");
  const partyId = uuid(recipient.partyId, "recipient party id");
  if (registrationId !== input.recipientRegistrationId ||
      partyId !== input.recipientPartyId || recipient.scheme !== "in-gstin") {
    throw conflict("recipient registration conflicts with the selected identity");
  }
  if (typeof recipient.stateCode !== "string" ||
      !GST_STATE_CODES.has(recipient.stateCode) ||
      typeof recipient.gstin !== "string" || !GSTIN.test(recipient.gstin) ||
      recipient.gstin.slice(0, 2) !== recipient.stateCode ||
      gstinChecksum(recipient.gstin.slice(0, 14)) !== recipient.gstin[14]) {
    throw conflict("recipient GSTIN is not canonical");
  }
  const legalName = normalizedText(recipient.legalName, "recipient legal name", 100);
  const tradeName = recipient.tradeName === null
    ? null
    : normalizedText(recipient.tradeName, "recipient trade name", 100);
  const addressLine1 = normalizedText(
    recipient.addressLine1,
    "recipient address line1",
    100,
  );
  const locality = normalizedText(recipient.locality, "recipient locality", 50);
  if (typeof recipient.pin !== "string" || !PIN.test(recipient.pin)) {
    throw conflict("recipient PIN is invalid");
  }
  const evidenceHash = sha256({
    registrationId,
    tenantId: input.tenantId,
    partyId,
    scheme: "in-gstin",
    gstin: recipient.gstin,
    stateCode: recipient.stateCode,
    legalName,
    tradeName,
    addressLine1,
    locality,
    pin: recipient.pin,
  });
  if (hash(recipient.evidenceHash, "recipient registration evidence hash") !==
      evidenceHash) {
    throw conflict("recipient registration evidence hash is inconsistent");
  }
  return Object.freeze({ partyId, registrationId, evidenceHash });
}

function canonicalDate(value: unknown, subject: string): string {
  if (typeof value !== "string") {
    throw conflict(`${subject} is invalid`);
  }
  const match = DATE.exec(value);
  if (match === null) {
    throw conflict(`${subject} is invalid`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const maximumDay = daysInMonth[month - 1];
  if (year === 0 || maximumDay === undefined || day === 0 || day > maximumDay) {
    throw conflict(`${subject} is invalid`);
  }
  return value;
}

function approvalValidity(value: unknown): Readonly<{
  fromInclusive: string;
  toExclusive: string;
}> {
  if (typeof value !== "string") {
    throw conflict("SEZ approval validity is invalid");
  }
  const match = DATE_RANGE.exec(value);
  if (match === null) {
    throw conflict("SEZ approval validity is not finite canonical [)");
  }
  const fromInclusive = canonicalDate(match[1], "SEZ approval validity start");
  const toExclusive = canonicalDate(match[2], "SEZ approval validity end");
  if (fromInclusive >= toExclusive) {
    throw conflict("SEZ approval validity is empty");
  }
  return Object.freeze({ fromInclusive, toExclusive });
}

function taxpayerType(value: unknown): GstTaxpayerType {
  if (value === "regular" || value === "sez_unit" || value === "sez_developer") {
    return value;
  }
  throw conflict("GST taxpayer type is unsupported");
}

function canonicalResult(
  candidate: unknown,
  input: IndiaGstRecipientSezStatusInput,
  recipient: RecipientEvidence,
): IndiaGstRecipientSezStatusResult {
  const row = exactRecord(
    candidate,
    ROW_KEYS,
    "stored India GST recipient SEZ-status row",
    false,
    conflict,
  ) as unknown as RecipientSezStatusRow;
  const tenantId = uuid(row.tenant_id, "stored recipient SEZ-status tenant id");
  const recipientSezStatusId = uuid(row.id, "stored recipient SEZ-status id");
  const recipientRegistrationId = uuid(
    row.recipient_registration_id,
    "stored recipient registration id",
  );
  const recipientRegistrationEvidenceHash = hash(
    row.recipient_registration_evidence_hash,
    "stored recipient registration evidence hash",
  );
  if (tenantId !== input.tenantId ||
      recipientSezStatusId !== input.recipientSezStatusId ||
      recipientRegistrationId !== recipient.registrationId ||
      recipientRegistrationEvidenceHash !== recipient.evidenceHash ||
      row.gst_registration_status !== "active" ||
      row.gst_status_source !== "gst_common_portal" ||
      row.legal_rule !== "IGST_ACT_7_5_B_AND_8_2_RECIPIENT_STATUS") {
    throw conflict("selected recipient SEZ status conflicts with current evidence");
  }

  const statusAsOf = canonicalDate(row.status_as_of, "GST status-as-of date");
  const type = taxpayerType(row.gst_taxpayer_type);
  const gstRegistration = Object.freeze({
    status: "active" as const,
    taxpayerType: type,
    source: "gst_common_portal" as const,
    evidenceSha256: hash(row.gst_status_evidence_sha256, "GST status evidence hash"),
  });

  let sezStatus: RecipientSezStatus;
  let approval: ApprovalEvidence | null;
  if (type === "regular") {
    if (row.approval_form !== null || row.approval_reference !== null ||
        row.approval_validity !== null || row.approval_status !== null ||
        row.approval_evidence_sha256 !== null) {
      throw conflict("regular GST status cannot carry SEZ approval evidence");
    }
    sezStatus = "affirmatively_non_sez_regular";
    approval = null;
  } else {
    const form = row.approval_form;
    if ((type === "sez_unit" && form !== "sez_rules_form_g") ||
        (type === "sez_developer" && form !== "sez_rules_form_b" &&
          form !== "sez_rules_form_c")) {
      throw conflict("SEZ approval form conflicts with GST taxpayer type");
    }
    const validity = approvalValidity(row.approval_validity);
    if (statusAsOf < validity.fromInclusive || statusAsOf >= validity.toExclusive ||
        row.approval_status !== "in_force") {
      throw conflict("SEZ approval is not in force at the status-as-of date");
    }
    approval = Object.freeze({
      form: form as ApprovalForm,
      reference: normalizedText(row.approval_reference, "SEZ approval reference", 128),
      validity,
      status: "in_force" as const,
      evidenceSha256: hash(row.approval_evidence_sha256, "SEZ approval evidence hash"),
    });
    sezStatus = type;
  }

  const legalRule = "IGST_ACT_7_5_B_AND_8_2_RECIPIENT_STATUS" as const;
  const evidence = Object.freeze({
    tenantId,
    recipientSezStatusId,
    recipient,
    statusAsOf,
    gstRegistration,
    sezStatus,
    approval,
    legalRule,
  });
  return Object.freeze({
    recipientSezStatusId,
    recipient,
    statusAsOf,
    gstRegistration,
    sezStatus,
    approval,
    legalRule,
    evidenceHash: sha256(evidence),
  });
}

async function readExactStatus(
  tx: Tx,
  input: IndiaGstRecipientSezStatusInput,
  recipient: RecipientEvidence,
): Promise<IndiaGstRecipientSezStatusResult> {
  const rows = await tx<RecipientSezStatusRow[]>`
    SELECT status.tenant_id::text AS tenant_id,
           status.id::text AS id,
           status.recipient_registration_id::text AS recipient_registration_id,
           status.recipient_registration_evidence_hash,
           status.status_as_of::text AS status_as_of,
           status.gst_registration_status,
           status.gst_taxpayer_type,
           status.gst_status_source,
           status.gst_status_evidence_sha256,
           status.approval_form,
           status.approval_reference,
           status.approval_validity::text AS approval_validity,
           status.approval_status,
           status.approval_evidence_sha256,
           status.legal_rule
      FROM public.india_gst_recipient_sez_status AS status
     WHERE status.tenant_id = ${input.tenantId}::uuid
       AND status.tenant_id = current_setting('app.tenant_id', true)::uuid
       AND status.id = ${input.recipientSezStatusId}::uuid
       AND status.recipient_registration_id = ${recipient.registrationId}::uuid
       AND status.recipient_registration_evidence_hash = ${recipient.evidenceHash}
       AND status.gst_registration_status = 'active'
       AND status.gst_taxpayer_type IN ('regular', 'sez_unit', 'sez_developer')
       AND status.gst_status_source = 'gst_common_portal'
       AND status.legal_rule = 'IGST_ACT_7_5_B_AND_8_2_RECIPIENT_STATUS'
     ORDER BY status.id
  `;
  if (rows.length === 0) {
    throw new IndiaGstRecipientSezStatusNotFoundError(
      "selected India GST recipient SEZ status is unavailable",
    );
  }
  if (rows.length !== 1 || rows[0] === undefined) {
    throw conflict("selected India GST recipient SEZ status is ambiguous");
  }
  return canonicalResult(rows[0], input, recipient);
}

export class IndiaGstRecipientSezStatusService {
  constructor(
    private readonly recipientRegistration: RecipientRegistrationResolver =
      new IndiaGstRecipientRegistrationService(),
  ) {}

  async resolve(
    tx: Tx,
    input: IndiaGstRecipientSezStatusInput,
  ): Promise<IndiaGstRecipientSezStatusResult> {
    if (typeof tx !== "function") {
      throw new IndiaGstRecipientSezStatusValidationError(
        "tenant transaction is unavailable",
      );
    }
    const normalized = normalizeInput(input);
    const recipient = exactRecipientRegistration(
      await this.recipientRegistration.resolve(tx, Object.freeze({
        tenantId: normalized.tenantId,
        recipientPartyId: normalized.recipientPartyId,
        registrationId: normalized.recipientRegistrationId,
      })),
      normalized,
    );
    return readExactStatus(tx, normalized, recipient);
  }
}
