import { types as utilTypes } from "node:util";

import type { Tx } from "../../kernel";
import {
  IndiaGstSupplierServiceLocationService,
  type IndiaGstSupplierServiceLocationInput,
} from "./india-gst-supplier-service-location";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const DATE = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/;
const DATE_RANGE = /^\[([0-9]{4}-[0-9]{2}-[0-9]{2}),([0-9]{4}-[0-9]{2}-[0-9]{2})\)$/;
const PIN = /^[1-9][0-9]{5}$/;
const JURISDICTION_KEY = /^[a-z0-9][a-z0-9_.:-]{0,127}$/;
const GST_STATE_CODES = new Set([
  "01", "02", "03", "04", "05", "06", "07", "08", "09", "10",
  "11", "12", "13", "14", "15", "16", "17", "18", "19", "20",
  "21", "22", "23", "24", "26", "27", "29", "30", "31", "32",
  "33", "34", "35", "36", "37", "38",
]);

const INPUT_KEYS = [
  "tenantId",
  "propertyNode",
  "reservationId",
  "supplierServiceLocationId",
  "supplierSezStatusId",
] as const;
const SERVICE_LOCATION_KEYS = [
  "supplierServiceLocationId",
  "propertyNode",
  "jurisdiction",
  "supplier",
  "serviceScope",
  "registeredPlace",
  "locationBasis",
  "legalRule",
  "evidenceHash",
] as const;
const JURISDICTION_KEYS = [
  "extensionId",
  "ownerTenantId",
  "key",
  "version",
  "contentHash",
] as const;
const SUPPLIER_KEYS = ["registrationId", "evidenceHash"] as const;
const REGISTERED_PLACE_KEYS = [
  "kind",
  "stateCode",
  "addressLine",
  "locality",
  "postalCode",
] as const;
const ROW_KEYS = [
  "tenant_id",
  "id",
  "supplier_registration_id",
  "supplier_registration_evidence_hash",
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
type SupplierSezStatus =
  | "affirmatively_non_sez_regular"
  | "sez_unit"
  | "sez_developer";
type ApprovalForm =
  | "sez_rules_form_g"
  | "sez_rules_form_b"
  | "sez_rules_form_c";
type RegisteredPlaceKind =
  | "principal_place_of_business"
  | "additional_place_of_business";

interface SupplierServiceLocationResolver {
  resolve(
    tx: Tx,
    input: IndiaGstSupplierServiceLocationInput,
  ): Promise<unknown>;
}

interface SupplierSezStatusRow {
  readonly tenant_id: string;
  readonly id: string;
  readonly supplier_registration_id: string;
  readonly supplier_registration_evidence_hash: string;
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

type JurisdictionEvidence = Readonly<{
  extensionId: string;
  ownerTenantId: string | null;
  key: string;
  version: string;
  contentHash: string;
}>;

type SupplierServiceLocationEvidence = Readonly<{
  id: string;
  evidenceHash: string;
}>;

type SupplierEvidence = Readonly<{
  registrationId: string;
  evidenceHash: string;
}>;

type CurrentSupplierServiceLocation = Readonly<{
  supplierServiceLocation: SupplierServiceLocationEvidence;
  supplier: SupplierEvidence;
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

export interface IndiaGstSupplierSezStatusInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly reservationId: string;
  readonly supplierServiceLocationId: string;
  readonly supplierSezStatusId: string;
}

export interface IndiaGstSupplierSezStatusResult {
  readonly supplierSezStatusId: string;
  readonly propertyNode: string;
  readonly supplierServiceLocation: SupplierServiceLocationEvidence;
  readonly supplier: SupplierEvidence;
  readonly statusAsOf: string;
  readonly gstRegistration: GstRegistrationEvidence;
  readonly sezStatus: SupplierSezStatus;
  readonly approval: ApprovalEvidence | null;
  readonly legalRule: "IGST_ACT_7_5_B_AND_8_2_SUPPLIER_STATUS";
  readonly evidenceHash: string;
}

export class IndiaGstSupplierSezStatusValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaGstSupplierSezStatusValidationError";
  }
}

export class IndiaGstSupplierSezStatusNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaGstSupplierSezStatusNotFoundError";
  }
}

export class IndiaGstSupplierSezStatusConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaGstSupplierSezStatusConflictError";
  }
}

function conflict(message: string): IndiaGstSupplierSezStatusConflictError {
  return new IndiaGstSupplierSezStatusConflictError(message);
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
      ? new IndiaGstSupplierSezStatusValidationError(
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

function normalizeInput(value: unknown): IndiaGstSupplierSezStatusInput {
  const input = exactRecord(
    value,
    INPUT_KEYS,
    "India GST supplier SEZ-status input",
    false,
    (message) => new IndiaGstSupplierSezStatusValidationError(message),
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
    supplierSezStatusId: uuid(
      input.supplierSezStatusId,
      "supplierSezStatusId",
      true,
    ),
  });
}

function exactJurisdiction(value: unknown): JurisdictionEvidence {
  const jurisdiction = exactRecord(
    value,
    JURISDICTION_KEYS,
    "supplier service-location jurisdiction evidence",
    true,
    conflict,
  );
  const extensionId = uuid(jurisdiction.extensionId, "jurisdiction extension id");
  const ownerTenantId = jurisdiction.ownerTenantId === null
    ? null
    : uuid(jurisdiction.ownerTenantId, "jurisdiction owner tenant id");
  if (typeof jurisdiction.key !== "string" ||
      !JURISDICTION_KEY.test(jurisdiction.key) ||
      typeof jurisdiction.version !== "string" ||
      !/^[1-9][0-9]*$/.test(jurisdiction.version)) {
    throw conflict("supplier service-location jurisdiction identity is invalid");
  }
  return Object.freeze({
    extensionId,
    ownerTenantId,
    key: jurisdiction.key,
    version: jurisdiction.version,
    contentHash: hash(jurisdiction.contentHash, "jurisdiction content hash"),
  });
}

function exactSupplierServiceLocation(
  value: unknown,
  input: IndiaGstSupplierSezStatusInput,
): CurrentSupplierServiceLocation {
  const location = exactRecord(
    value,
    SERVICE_LOCATION_KEYS,
    "India GST supplier service-location evidence",
    true,
    conflict,
  );
  const supplierServiceLocationId = uuid(
    location.supplierServiceLocationId,
    "supplier service-location id",
  );
  const propertyNode = uuid(location.propertyNode, "supplier property node");
  if (supplierServiceLocationId !== input.supplierServiceLocationId ||
      propertyNode !== input.propertyNode) {
    throw conflict("supplier service location conflicts with the selected identity");
  }
  const jurisdiction = exactJurisdiction(location.jurisdiction);
  const supplierCandidate = exactRecord(
    location.supplier,
    SUPPLIER_KEYS,
    "supplier service-location registration evidence",
    true,
    conflict,
  );
  const supplier = Object.freeze({
    registrationId: uuid(
      supplierCandidate.registrationId,
      "supplier registration id",
    ),
    evidenceHash: hash(
      supplierCandidate.evidenceHash,
      "supplier registration evidence hash",
    ),
  });
  const registeredPlaceCandidate = exactRecord(
    location.registeredPlace,
    REGISTERED_PLACE_KEYS,
    "supplier registered-place evidence",
    true,
    conflict,
  );
  if (registeredPlaceCandidate.kind !== "principal_place_of_business" &&
      registeredPlaceCandidate.kind !== "additional_place_of_business") {
    throw conflict("supplier registered-place kind is unsupported");
  }
  if (typeof registeredPlaceCandidate.stateCode !== "string" ||
      !GST_STATE_CODES.has(registeredPlaceCandidate.stateCode)) {
    throw conflict("supplier registered-place state code is invalid");
  }
  const registeredPlace = Object.freeze({
    kind: registeredPlaceCandidate.kind as RegisteredPlaceKind,
    stateCode: registeredPlaceCandidate.stateCode,
    addressLine: normalizedText(
      registeredPlaceCandidate.addressLine,
      "supplier registered-place address line",
      300,
    ),
    locality: normalizedText(
      registeredPlaceCandidate.locality,
      "supplier registered-place locality",
      120,
    ),
    postalCode: (() => {
      if (typeof registeredPlaceCandidate.postalCode !== "string" ||
          !PIN.test(registeredPlaceCandidate.postalCode)) {
        throw conflict("supplier registered-place postal code is invalid");
      }
      return registeredPlaceCandidate.postalCode;
    })(),
  });
  if (location.serviceScope !== "lodging_accommodation" ||
      location.locationBasis !== "supply_made_from_registered_place_of_business" ||
      location.legalRule !== "IGST_ACT_2_15_A") {
    throw conflict("supplier service-location evidence is unsupported");
  }
  const evidence = Object.freeze({
    tenantId: input.tenantId,
    supplierServiceLocationId,
    propertyNode,
    jurisdiction,
    supplier,
    serviceScope: "lodging_accommodation" as const,
    registeredPlace,
    locationBasis: "supply_made_from_registered_place_of_business" as const,
    legalRule: "IGST_ACT_2_15_A" as const,
  });
  const evidenceHash = hash(
    location.evidenceHash,
    "supplier service-location evidence hash",
  );
  if (evidenceHash !== sha256(evidence)) {
    throw conflict("supplier service-location evidence hash is inconsistent");
  }
  return Object.freeze({
    supplierServiceLocation: Object.freeze({
      id: supplierServiceLocationId,
      evidenceHash,
    }),
    supplier,
  });
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
  input: IndiaGstSupplierSezStatusInput,
  current: CurrentSupplierServiceLocation,
): IndiaGstSupplierSezStatusResult {
  const row = exactRecord(
    candidate,
    ROW_KEYS,
    "stored India GST supplier SEZ-status row",
    false,
    conflict,
  ) as unknown as SupplierSezStatusRow;
  const tenantId = uuid(row.tenant_id, "stored supplier SEZ-status tenant id");
  const supplierSezStatusId = uuid(row.id, "stored supplier SEZ-status id");
  const supplierRegistrationId = uuid(
    row.supplier_registration_id,
    "stored supplier registration id",
  );
  const supplierRegistrationEvidenceHash = hash(
    row.supplier_registration_evidence_hash,
    "stored supplier registration evidence hash",
  );
  if (tenantId !== input.tenantId ||
      supplierSezStatusId !== input.supplierSezStatusId ||
      supplierRegistrationId !== current.supplier.registrationId ||
      supplierRegistrationEvidenceHash !== current.supplier.evidenceHash ||
      row.gst_registration_status !== "active" ||
      row.gst_status_source !== "gst_common_portal" ||
      row.legal_rule !== "IGST_ACT_7_5_B_AND_8_2_SUPPLIER_STATUS") {
    throw conflict("selected supplier SEZ status conflicts with current evidence");
  }

  const statusAsOf = canonicalDate(row.status_as_of, "GST status-as-of date");
  const type = taxpayerType(row.gst_taxpayer_type);
  const gstRegistration = Object.freeze({
    status: "active" as const,
    taxpayerType: type,
    source: "gst_common_portal" as const,
    evidenceSha256: hash(row.gst_status_evidence_sha256, "GST status evidence hash"),
  });

  let sezStatus: SupplierSezStatus;
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

  const legalRule = "IGST_ACT_7_5_B_AND_8_2_SUPPLIER_STATUS" as const;
  const evidence = Object.freeze({
    tenantId,
    supplierSezStatusId,
    propertyNode: input.propertyNode,
    supplierServiceLocation: current.supplierServiceLocation,
    supplier: current.supplier,
    statusAsOf,
    gstRegistration,
    sezStatus,
    approval,
    legalRule,
  });
  return Object.freeze({
    supplierSezStatusId,
    propertyNode: input.propertyNode,
    supplierServiceLocation: current.supplierServiceLocation,
    supplier: current.supplier,
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
  input: IndiaGstSupplierSezStatusInput,
  current: CurrentSupplierServiceLocation,
): Promise<IndiaGstSupplierSezStatusResult> {
  const rows = await tx<SupplierSezStatusRow[]>`
    SELECT status_row.tenant_id::text AS tenant_id,
           status_row.id::text AS id,
           status_row.supplier_registration_id::text AS supplier_registration_id,
           status_row.supplier_registration_evidence_hash,
           status_row.status_as_of::text AS status_as_of,
           status_row.gst_registration_status,
           status_row.gst_taxpayer_type,
           status_row.gst_status_source,
           status_row.gst_status_evidence_sha256,
           status_row.approval_form,
           status_row.approval_reference,
           status_row.approval_validity::text AS approval_validity,
           status_row.approval_status,
           status_row.approval_evidence_sha256,
           status_row.legal_rule
      FROM public.india_gst_supplier_sez_status AS status_row
     WHERE status_row.tenant_id = ${input.tenantId}::uuid
       AND status_row.tenant_id = current_setting('app.tenant_id', true)::uuid
       AND status_row.id = ${input.supplierSezStatusId}::uuid
       AND status_row.supplier_registration_id = ${current.supplier.registrationId}::uuid
       AND status_row.supplier_registration_evidence_hash = ${current.supplier.evidenceHash}
       AND status_row.gst_registration_status = 'active'
       AND status_row.gst_taxpayer_type IN ('regular', 'sez_unit', 'sez_developer')
       AND status_row.gst_status_source = 'gst_common_portal'
       AND status_row.legal_rule = 'IGST_ACT_7_5_B_AND_8_2_SUPPLIER_STATUS'
     ORDER BY status_row.id
  `;
  if (rows.length === 0) {
    throw new IndiaGstSupplierSezStatusNotFoundError(
      "selected India GST supplier SEZ status is unavailable",
    );
  }
  if (rows.length !== 1 || rows[0] === undefined) {
    throw conflict("selected India GST supplier SEZ status is ambiguous");
  }
  return canonicalResult(rows[0], input, current);
}

export class IndiaGstSupplierSezStatusService {
  constructor(
    private readonly supplierServiceLocation: SupplierServiceLocationResolver =
      new IndiaGstSupplierServiceLocationService(),
  ) {}

  async resolve(
    tx: Tx,
    input: IndiaGstSupplierSezStatusInput,
  ): Promise<IndiaGstSupplierSezStatusResult> {
    if (typeof tx !== "function") {
      throw new IndiaGstSupplierSezStatusValidationError(
        "tenant transaction is unavailable",
      );
    }
    const normalized = normalizeInput(input);
    const current = exactSupplierServiceLocation(
      await this.supplierServiceLocation.resolve(tx, Object.freeze({
        tenantId: normalized.tenantId,
        propertyNode: normalized.propertyNode,
        reservationId: normalized.reservationId,
        supplierServiceLocationId: normalized.supplierServiceLocationId,
      })),
      normalized,
    );
    return readExactStatus(tx, normalized, current);
  }
}
