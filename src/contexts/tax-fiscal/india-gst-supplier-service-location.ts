import { types as utilTypes } from "node:util";

import type { Tx } from "../../kernel";
import {
  IndiaGstSupplierRegistrationService,
  type IndiaGstSupplierRegistrationInput,
} from "./india-gst-supplier-registration";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const GSTIN = /^([0-9]{2})[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const GST_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const GST_STATE_CODES = new Set([
  "01", "02", "03", "04", "05", "06", "07", "08", "09", "10",
  "11", "12", "13", "14", "15", "16", "17", "18", "19", "20",
  "21", "22", "23", "24", "26", "27", "29", "30", "31", "32",
  "33", "34", "35", "36", "37", "38",
]);
const JURISDICTION_KEY = /^[a-z0-9][a-z0-9_.:-]{0,127}$/;
const INPUT_KEYS = [
  "tenantId",
  "propertyNode",
  "reservationId",
  "supplierServiceLocationId",
] as const;
const SUPPLIER_KEYS = [
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
const ROW_KEYS = [
  "tenant_id",
  "id",
  "supplier_registration_id",
  "supplier_evidence_hash",
  "service_scope",
  "registered_place_kind",
  "location_basis",
  "legal_rule",
] as const;
const REGISTERED_PLACE_KINDS = new Set([
  "principal_place_of_business",
  "additional_place_of_business",
]);

interface SupplierRegistrationResolver {
  resolve(
    tx: Tx,
    input: IndiaGstSupplierRegistrationInput,
  ): Promise<unknown>;
}

interface SupplierServiceLocationRow {
  readonly tenant_id: string;
  readonly id: string;
  readonly supplier_registration_id: string;
  readonly supplier_evidence_hash: string;
  readonly service_scope: string;
  readonly registered_place_kind: string;
  readonly location_basis: string;
  readonly legal_rule: string;
}

type JurisdictionEvidence = Readonly<{
  extensionId: string;
  ownerTenantId: string | null;
  key: string;
  version: string;
  contentHash: string;
}>;

type RegisteredPlaceKind =
  | "principal_place_of_business"
  | "additional_place_of_business";

export interface IndiaGstSupplierServiceLocationInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly reservationId: string;
  readonly supplierServiceLocationId: string;
}

export interface IndiaGstSupplierServiceLocationResult {
  readonly supplierServiceLocationId: string;
  readonly propertyNode: string;
  readonly jurisdiction: JurisdictionEvidence;
  readonly supplier: Readonly<{
    registrationId: string;
    evidenceHash: string;
  }>;
  readonly serviceScope: "lodging_accommodation";
  readonly registeredPlace: Readonly<{
    kind: RegisteredPlaceKind;
    stateCode: string;
    addressLine: string;
    locality: string;
    postalCode: string;
  }>;
  readonly locationBasis: "supply_made_from_registered_place_of_business";
  readonly legalRule: "IGST_ACT_2_15_A";
  readonly evidenceHash: string;
}

export class IndiaGstSupplierServiceLocationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaGstSupplierServiceLocationValidationError";
  }
}

export class IndiaGstSupplierServiceLocationNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaGstSupplierServiceLocationNotFoundError";
  }
}

export class IndiaGstSupplierServiceLocationConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaGstSupplierServiceLocationConflictError";
  }
}

function conflict(message: string): IndiaGstSupplierServiceLocationConflictError {
  return new IndiaGstSupplierServiceLocationConflictError(message);
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
      ? new IndiaGstSupplierServiceLocationValidationError(
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

function normalizeInput(value: unknown): IndiaGstSupplierServiceLocationInput {
  const input = exactRecord(
    value,
    INPUT_KEYS,
    "India GST supplier service-location input",
    false,
    (message) => new IndiaGstSupplierServiceLocationValidationError(message),
  );
  return Object.freeze({
    tenantId: uuid(input.tenantId, "tenantId", true),
    propertyNode: uuid(input.propertyNode, "propertyNode", true),
    reservationId: uuid(input.reservationId, "reservationId", true),
    supplierServiceLocationId: uuid(
      input.supplierServiceLocationId,
      "supplierServiceLocationId",
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
      throw conflict("supplier GSTIN is not canonical");
    }
    const addend = factor * codePoint;
    factor = factor === 2 ? 1 : 2;
    sum += Math.floor(addend / 36) + addend % 36;
  }
  const checksum = GST_ALPHABET[(36 - sum % 36) % 36];
  if (checksum === undefined) {
    throw conflict("supplier GSTIN is not canonical");
  }
  return checksum;
}

function exactJurisdiction(value: unknown): JurisdictionEvidence {
  const jurisdiction = exactRecord(
    value,
    JURISDICTION_KEYS,
    "supplier jurisdiction evidence",
    true,
    conflict,
  );
  const extensionId = uuid(jurisdiction.extensionId, "supplier jurisdiction extension id");
  const ownerTenantId = jurisdiction.ownerTenantId === null
    ? null
    : uuid(jurisdiction.ownerTenantId, "supplier jurisdiction owner tenant id");
  if (typeof jurisdiction.key !== "string" ||
      !JURISDICTION_KEY.test(jurisdiction.key) ||
      typeof jurisdiction.version !== "string" ||
      !/^[1-9][0-9]*$/.test(jurisdiction.version)) {
    throw conflict("supplier jurisdiction identity is invalid");
  }
  return Object.freeze({
    extensionId,
    ownerTenantId,
    key: jurisdiction.key,
    version: jurisdiction.version,
    contentHash: hash(jurisdiction.contentHash, "supplier jurisdiction content hash"),
  });
}

function exactSupplier(
  value: unknown,
  input: IndiaGstSupplierServiceLocationInput,
): Readonly<{
  registrationId: string;
  jurisdiction: JurisdictionEvidence;
  evidenceHash: string;
  stateCode: string;
  addressLine: string;
  locality: string;
  postalCode: string;
}> {
  const supplier = exactRecord(
    value,
    SUPPLIER_KEYS,
    "India GST supplier-registration evidence",
    true,
    conflict,
  );
  const registrationId = uuid(supplier.registrationId, "supplier registration id");
  const propertyNode = uuid(supplier.propertyNode, "supplier property node");
  const jurisdiction = exactJurisdiction(supplier.jurisdiction);
  if (propertyNode !== input.propertyNode || supplier.scheme !== "in-gstin" ||
      supplier.currency !== "INR") {
    throw conflict("supplier registration conflicts with selected India/INR property");
  }
  if (typeof supplier.stateCode !== "string" ||
      !GST_STATE_CODES.has(supplier.stateCode) || typeof supplier.gstin !== "string" ||
      !GSTIN.test(supplier.gstin) || supplier.gstin.slice(0, 2) !== supplier.stateCode ||
      gstinChecksum(supplier.gstin.slice(0, 14)) !== supplier.gstin[14]) {
    throw conflict("supplier GSTIN is not canonical");
  }
  const legalName = normalizedText(supplier.legalName, "supplier legal name", 200);
  const tradeName = supplier.tradeName === null
    ? null
    : normalizedText(supplier.tradeName, "supplier trade name", 200);
  const addressLine = normalizedText(supplier.addressLine, "supplier address line", 300);
  const locality = normalizedText(supplier.locality, "supplier locality", 120);
  if (typeof supplier.postalCode !== "string" ||
      !/^[1-9][0-9]{5}$/.test(supplier.postalCode)) {
    throw conflict("supplier postal code is invalid");
  }
  const evidenceHash = sha256({
    registrationId,
    tenantId: input.tenantId,
    propertyNode,
    scheme: "in-gstin",
    currency: "INR",
    jurisdiction,
    gstin: supplier.gstin,
    stateCode: supplier.stateCode,
    legalName,
    tradeName,
    addressLine,
    locality,
    postalCode: supplier.postalCode,
  });
  if (hash(supplier.evidenceHash, "supplier evidence hash") !== evidenceHash) {
    throw conflict("supplier evidence hash is inconsistent");
  }
  return Object.freeze({
    registrationId,
    jurisdiction,
    evidenceHash,
    stateCode: supplier.stateCode,
    addressLine,
    locality,
    postalCode: supplier.postalCode,
  });
}

function canonicalResult(
  candidate: unknown,
  input: IndiaGstSupplierServiceLocationInput,
  supplier: ReturnType<typeof exactSupplier>,
): IndiaGstSupplierServiceLocationResult {
  const row = exactRecord(
    candidate,
    ROW_KEYS,
    "stored India GST supplier service-location row",
    false,
    conflict,
  ) as unknown as SupplierServiceLocationRow;
  const tenantId = uuid(row.tenant_id, "stored supplier service-location tenant id");
  const supplierServiceLocationId = uuid(
    row.id,
    "stored supplier service-location id",
  );
  const supplierRegistrationId = uuid(
    row.supplier_registration_id,
    "stored supplier-registration id",
  );
  const supplierEvidenceHash = hash(
    row.supplier_evidence_hash,
    "stored supplier evidence hash",
  );
  if (tenantId !== input.tenantId ||
      supplierServiceLocationId !== input.supplierServiceLocationId ||
      supplierRegistrationId !== supplier.registrationId ||
      supplierEvidenceHash !== supplier.evidenceHash ||
      row.service_scope !== "lodging_accommodation" ||
      !REGISTERED_PLACE_KINDS.has(row.registered_place_kind) ||
      row.location_basis !== "supply_made_from_registered_place_of_business" ||
      row.legal_rule !== "IGST_ACT_2_15_A") {
    throw conflict(
      "selected supplier service location conflicts with current supplier evidence",
    );
  }

  const jurisdiction = supplier.jurisdiction;
  const supplierEvidence = Object.freeze({
    registrationId: supplier.registrationId,
    evidenceHash: supplier.evidenceHash,
  });
  const registeredPlace = Object.freeze({
    kind: row.registered_place_kind as RegisteredPlaceKind,
    stateCode: supplier.stateCode,
    addressLine: supplier.addressLine,
    locality: supplier.locality,
    postalCode: supplier.postalCode,
  });
  const evidence = Object.freeze({
    tenantId,
    supplierServiceLocationId,
    propertyNode: input.propertyNode,
    jurisdiction,
    supplier: supplierEvidence,
    serviceScope: "lodging_accommodation" as const,
    registeredPlace,
    locationBasis: "supply_made_from_registered_place_of_business" as const,
    legalRule: "IGST_ACT_2_15_A" as const,
  });
  return Object.freeze({
    supplierServiceLocationId,
    propertyNode: input.propertyNode,
    jurisdiction,
    supplier: supplierEvidence,
    serviceScope: evidence.serviceScope,
    registeredPlace,
    locationBasis: evidence.locationBasis,
    legalRule: evidence.legalRule,
    evidenceHash: sha256(evidence),
  });
}

async function readExactAssignment(
  tx: Tx,
  input: IndiaGstSupplierServiceLocationInput,
  supplier: ReturnType<typeof exactSupplier>,
): Promise<IndiaGstSupplierServiceLocationResult> {
  const rows = await tx<SupplierServiceLocationRow[]>`
    SELECT location.tenant_id::text AS tenant_id,
           location.id::text AS id,
           location.supplier_registration_id::text AS supplier_registration_id,
           location.supplier_evidence_hash,
           location.service_scope,
           location.registered_place_kind,
           location.location_basis,
           location.legal_rule
      FROM public.india_gst_supplier_service_location AS location
     WHERE location.tenant_id = ${input.tenantId}::uuid
       AND location.tenant_id = current_setting('app.tenant_id', true)::uuid
       AND location.id = ${input.supplierServiceLocationId}::uuid
       AND location.supplier_registration_id = ${supplier.registrationId}::uuid
       AND location.supplier_evidence_hash = ${supplier.evidenceHash}
       AND location.service_scope = 'lodging_accommodation'
       AND location.registered_place_kind IN (
         'principal_place_of_business', 'additional_place_of_business'
       )
       AND location.location_basis = 'supply_made_from_registered_place_of_business'
       AND location.legal_rule = 'IGST_ACT_2_15_A'
     ORDER BY location.id
  `;
  if (rows.length === 0) {
    throw new IndiaGstSupplierServiceLocationNotFoundError(
      "selected India GST supplier service location is unavailable",
    );
  }
  if (rows.length !== 1 || rows[0] === undefined) {
    throw conflict("selected India GST supplier service location is ambiguous");
  }
  return canonicalResult(rows[0], input, supplier);
}

export class IndiaGstSupplierServiceLocationService {
  constructor(
    private readonly supplier: SupplierRegistrationResolver =
      new IndiaGstSupplierRegistrationService(),
  ) {}

  async resolve(
    tx: Tx,
    input: IndiaGstSupplierServiceLocationInput,
  ): Promise<IndiaGstSupplierServiceLocationResult> {
    if (typeof tx !== "function") {
      throw new IndiaGstSupplierServiceLocationValidationError(
        "tenant transaction is unavailable",
      );
    }
    const normalized = normalizeInput(input);
    const supplier = exactSupplier(await this.supplier.resolve(tx, Object.freeze({
      tenantId: normalized.tenantId,
      propertyNode: normalized.propertyNode,
      reservationId: normalized.reservationId,
    })), normalized);
    return readExactAssignment(tx, normalized, supplier);
  }
}
