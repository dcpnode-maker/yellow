import type { Tx } from "../../kernel";
import {
  PositiveTaxFolioEligibilityService,
  type PositiveTaxFolioEligibilityInput,
  type PositiveTaxFolioEligibilityResult,
} from "./folio-eligibility";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const PINCODE = /^[1-9][0-9]{5}$/;
const GSTIN = /^([0-9]{2})[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const GST_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const GST_STATE_CODES = new Set([
  "01", "02", "03", "04", "05", "06", "07", "08", "09", "10",
  "11", "12", "13", "14", "15", "16", "17", "18", "19", "20",
  "21", "22", "23", "24", "26", "27", "29", "30", "31", "32",
  "33", "34", "35", "36", "37", "38",
]);

const MAX_LEGAL_NAME = 200;
const MAX_TRADE_NAME = 200;
const MAX_ADDRESS_LINE = 300;
const MAX_LOCALITY = 120;

interface PositiveTaxEligibilityResolver {
  discover?(
    tx: Tx,
    input: PositiveTaxFolioEligibilityInput,
  ): Promise<PositiveTaxFolioEligibilityResult>;
  resolve(
    tx: Tx,
    input: PositiveTaxFolioEligibilityInput,
  ): Promise<PositiveTaxFolioEligibilityResult>;
}

interface SupplierRegistrationRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly property_node: string;
  readonly scheme: string;
  readonly currency: string;
  readonly jurisdiction_extension_id: string;
  readonly jurisdiction_owner_tenant_id: string | null;
  readonly jurisdiction_key: string;
  readonly jurisdiction_version: number;
  readonly jurisdiction_content_hash: string;
  readonly registration_number: string;
  readonly region_code: string;
  readonly legal_name: string;
  readonly trade_name: string | null;
  readonly address_line: string;
  readonly locality: string;
  readonly postal_code: string;
}

export interface IndiaGstSupplierRegistrationInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly reservationId: string;
}

export interface IndiaGstSupplierRegistrationResult {
  readonly registrationId: string;
  readonly propertyNode: string;
  readonly scheme: "in-gstin";
  readonly currency: "INR";
  readonly jurisdiction: Readonly<{
    extensionId: string;
    ownerTenantId: string | null;
    key: string;
    version: string;
    contentHash: string;
  }>;
  readonly gstin: string;
  readonly stateCode: string;
  readonly legalName: string;
  readonly tradeName: string | null;
  readonly addressLine: string;
  readonly locality: string;
  readonly postalCode: string;
  readonly evidenceHash: string;
}

export class IndiaGstSupplierRegistrationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaGstSupplierRegistrationValidationError";
  }
}

export class IndiaGstSupplierRegistrationNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaGstSupplierRegistrationNotFoundError";
  }
}

export class IndiaGstSupplierRegistrationConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaGstSupplierRegistrationConflictError";
  }
}

function exactPlainRecord(
  value: unknown,
  expectedKeys: readonly string[],
  subject: string,
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value) ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) ||
      Object.getOwnPropertySymbols(value).length !== 0) {
    throw new IndiaGstSupplierRegistrationValidationError(`${subject} must be a plain object`);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Object.keys(descriptors).sort();
  const expected = [...expectedKeys].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index]) ||
      Object.values(descriptors).some((descriptor) => descriptor.get !== undefined ||
        descriptor.set !== undefined || descriptor.enumerable !== true)) {
    throw new IndiaGstSupplierRegistrationValidationError(`${subject} shape is invalid`);
  }
  return value as Record<string, unknown>;
}

function inputUuid(value: unknown, subject: string): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new IndiaGstSupplierRegistrationValidationError(`${subject} must be a canonical UUID`);
  }
  return value;
}

function normalizeInput(
  input: IndiaGstSupplierRegistrationInput,
): IndiaGstSupplierRegistrationInput {
  const source = exactPlainRecord(
    input,
    ["tenantId", "propertyNode", "reservationId"],
    "GST supplier-registration input",
  );
  return Object.freeze({
    tenantId: inputUuid(source.tenantId, "tenantId"),
    propertyNode: inputUuid(source.propertyNode, "propertyNode"),
    reservationId: inputUuid(source.reservationId, "reservationId"),
  });
}

function storedUuid(value: unknown, subject: string): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new IndiaGstSupplierRegistrationConflictError(`${subject} is invalid`);
  }
  return value;
}

function storedText(
  value: unknown,
  subject: string,
  maxLength: number,
): string {
  if (typeof value !== "string" || value.length === 0 || value.length > maxLength ||
      value !== value.trim() || value !== value.normalize("NFC") ||
      /[\u0000-\u001f\u007f]/.test(value)) {
    throw new IndiaGstSupplierRegistrationConflictError(`${subject} is not canonical`);
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
      throw new IndiaGstSupplierRegistrationConflictError("GSTIN body is invalid");
    }
    const codePoint = GST_ALPHABET.indexOf(character);
    if (codePoint < 0) {
      throw new IndiaGstSupplierRegistrationConflictError("GSTIN body is invalid");
    }
    const addend = factor * codePoint;
    factor = factor === 2 ? 1 : 2;
    sum += Math.floor(addend / 36) + addend % 36;
  }
  const checkPoint = (36 - sum % 36) % 36;
  const checksum = GST_ALPHABET[checkPoint];
  if (checksum === undefined) {
    throw new IndiaGstSupplierRegistrationConflictError("GSTIN checksum is invalid");
  }
  return checksum;
}

function storedGstin(value: unknown, stateCode: unknown): Readonly<{
  gstin: string;
  stateCode: string;
}> {
  if (typeof stateCode !== "string" || !GST_STATE_CODES.has(stateCode)) {
    throw new IndiaGstSupplierRegistrationConflictError("GST state code is invalid");
  }
  if (typeof value !== "string" || !GSTIN.test(value) ||
      value.slice(0, 2) !== stateCode ||
      gstinChecksum(value.slice(0, 14)) !== value[14]) {
    throw new IndiaGstSupplierRegistrationConflictError("GSTIN is not canonical");
  }
  return Object.freeze({ gstin: value, stateCode });
}

function canonicalHash(value: unknown): string {
  return new Bun.CryptoHasher("sha256").update(JSON.stringify(value)).digest("hex");
}

function frozenIndiaEligibility(eligibility: PositiveTaxFolioEligibilityResult): void {
  if (eligibility.currency !== "INR" || eligibility.snapshot.currency !== "INR" ||
      eligibility.snapshot.evaluation.country !== "IN" ||
      eligibility.snapshot.evaluation.jurisdictionKey !== eligibility.snapshot.jurisdiction.key) {
    throw new IndiaGstSupplierRegistrationConflictError(
      "Frozen positive-tax eligibility is not exact India/INR jurisdiction evidence",
    );
  }
}

function canonical(
  row: SupplierRegistrationRow,
  input: IndiaGstSupplierRegistrationInput,
  eligibility: PositiveTaxFolioEligibilityResult,
): IndiaGstSupplierRegistrationResult {
  const registrationId = storedUuid(row.id, "stored supplier-registration id");
  const tenantId = storedUuid(row.tenant_id, "stored supplier-registration tenant id");
  const propertyNode = storedUuid(row.property_node, "stored supplier-registration property id");
  const extensionId = storedUuid(
    row.jurisdiction_extension_id,
    "stored supplier-registration jurisdiction extension id",
  );
  const ownerTenantId = row.jurisdiction_owner_tenant_id === null
    ? null
    : storedUuid(
      row.jurisdiction_owner_tenant_id,
      "stored supplier-registration jurisdiction owner tenant id",
    );
  const jurisdiction = eligibility.snapshot.jurisdiction;
  const version = Number(jurisdiction.version);
  if (!Number.isSafeInteger(version) || version <= 0 || tenantId !== input.tenantId ||
      propertyNode !== input.propertyNode || eligibility.propertyNode !== input.propertyNode ||
      eligibility.reservationId !== input.reservationId ||
      row.scheme !== "in-gstin" || row.currency !== "INR" ||
      extensionId !== jurisdiction.extensionId || ownerTenantId !== jurisdiction.ownerTenantId ||
      row.jurisdiction_key !== jurisdiction.key || row.jurisdiction_version !== version ||
      !SHA256.test(row.jurisdiction_content_hash) ||
      row.jurisdiction_content_hash !== jurisdiction.contentHash) {
    throw new IndiaGstSupplierRegistrationConflictError(
      "Configured supplier registration is inconsistent with frozen jurisdiction evidence",
    );
  }

  const registration = storedGstin(row.registration_number, row.region_code);
  const legalName = storedText(row.legal_name, "GST supplier legal name", MAX_LEGAL_NAME);
  const tradeName = storedOptionalText(row.trade_name, "GST supplier trade name", MAX_TRADE_NAME);
  const addressLine = storedText(row.address_line, "GST supplier address line", MAX_ADDRESS_LINE);
  const locality = storedText(row.locality, "GST supplier locality", MAX_LOCALITY);
  if (typeof row.postal_code !== "string" || !PINCODE.test(row.postal_code)) {
    throw new IndiaGstSupplierRegistrationConflictError("GST supplier pincode is invalid");
  }

  const frozenJurisdiction = Object.freeze({
    extensionId,
    ownerTenantId,
    key: row.jurisdiction_key,
    version: jurisdiction.version,
    contentHash: row.jurisdiction_content_hash,
  });
  const evidence = Object.freeze({
    registrationId,
    tenantId,
    propertyNode,
    scheme: "in-gstin" as const,
    currency: "INR" as const,
    jurisdiction: frozenJurisdiction,
    gstin: registration.gstin,
    stateCode: registration.stateCode,
    legalName,
    tradeName,
    addressLine,
    locality,
    postalCode: row.postal_code,
  });
  return Object.freeze({
    registrationId,
    propertyNode,
    scheme: evidence.scheme,
    currency: evidence.currency,
    jurisdiction: frozenJurisdiction,
    gstin: registration.gstin,
    stateCode: registration.stateCode,
    legalName,
    tradeName,
    addressLine,
    locality,
    postalCode: row.postal_code,
    evidenceHash: canonicalHash(evidence),
  });
}

async function read(
  tx: Tx,
  input: IndiaGstSupplierRegistrationInput,
  eligibility: PositiveTaxFolioEligibilityResult,
): Promise<IndiaGstSupplierRegistrationResult> {
  frozenIndiaEligibility(eligibility);
  const jurisdiction = eligibility.snapshot.jurisdiction;
  const version = Number(jurisdiction.version);
  if (!Number.isSafeInteger(version) || version <= 0) {
    throw new IndiaGstSupplierRegistrationConflictError(
      "Frozen tax-jurisdiction version is invalid",
    );
  }
  const rows = await tx<SupplierRegistrationRow[]>`
    SELECT registration.id::text AS id,
           registration.tenant_id::text AS tenant_id,
           registration.property_node::text AS property_node,
           registration.scheme,
           registration.currency::text AS currency,
           registration.jurisdiction_extension_id::text AS jurisdiction_extension_id,
           registration.jurisdiction_owner_tenant_id::text AS jurisdiction_owner_tenant_id,
           registration.jurisdiction_key,
           registration.jurisdiction_version::int AS jurisdiction_version,
           registration.jurisdiction_content_hash,
           registration.registration_number,
           registration.region_code,
           registration.legal_name,
           registration.trade_name,
           registration.address_line,
           registration.locality,
           registration.postal_code
      FROM public.property_fiscal_registration AS registration
      JOIN public.org_node AS property
        ON property.tenant_id = registration.tenant_id
       AND property.id = registration.property_node
       AND property.kind = 'property'
     WHERE registration.tenant_id = ${input.tenantId}::uuid
       AND registration.tenant_id = current_setting('app.tenant_id', true)::uuid
       AND registration.property_node = ${input.propertyNode}::uuid
       AND registration.scheme = 'in-gstin'
       AND registration.currency = 'INR'::char(3)
       AND registration.jurisdiction_extension_id = ${jurisdiction.extensionId}::uuid
       AND registration.jurisdiction_owner_tenant_id IS NOT DISTINCT FROM
           ${jurisdiction.ownerTenantId}::uuid
       AND registration.jurisdiction_key = ${jurisdiction.key}
       AND registration.jurisdiction_version = ${version}::integer
       AND registration.jurisdiction_content_hash = ${jurisdiction.contentHash}
     ORDER BY registration.id
  `;
  if (rows.length === 0) {
    throw new IndiaGstSupplierRegistrationNotFoundError(
      "Configured India GST supplier registration is unavailable",
    );
  }
  if (rows.length !== 1 || !rows[0]) {
    throw new IndiaGstSupplierRegistrationConflictError(
      "Configured India GST supplier registration is ambiguous",
    );
  }
  return canonical(rows[0], input, eligibility);
}

export class IndiaGstSupplierRegistrationService {
  constructor(
    private readonly eligibility: PositiveTaxEligibilityResolver =
      new PositiveTaxFolioEligibilityService(),
  ) {}

  async discover(
    tx: Tx,
    input: IndiaGstSupplierRegistrationInput,
  ): Promise<IndiaGstSupplierRegistrationResult> {
    if (typeof tx !== "function") {
      throw new IndiaGstSupplierRegistrationValidationError(
        "tenant transaction is unavailable",
      );
    }
    if (!this.eligibility.discover) {
      throw new IndiaGstSupplierRegistrationConflictError(
        "Read-only positive-tax eligibility discovery is unavailable",
      );
    }
    const normalized = normalizeInput(input);
    const eligibility = await this.eligibility.discover(tx, normalized);
    return read(tx, normalized, eligibility);
  }

  async resolve(
    tx: Tx,
    input: IndiaGstSupplierRegistrationInput,
  ): Promise<IndiaGstSupplierRegistrationResult> {
    if (typeof tx !== "function") {
      throw new IndiaGstSupplierRegistrationValidationError(
        "tenant transaction is unavailable",
      );
    }
    const normalized = normalizeInput(input);
    const eligibility = await this.eligibility.resolve(tx, normalized);
    return read(tx, normalized, eligibility);
  }
}
