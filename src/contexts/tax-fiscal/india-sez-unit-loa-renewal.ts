import { types as utilTypes } from "node:util";

import type { Tx } from "../../kernel";
import {
  IndiaGstSupplierSezStatusService,
  type IndiaGstSupplierSezStatusInput,
} from "./india-gst-supplier-sez-status";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const DATE = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/;
const DATE_RANGE = /^\[([0-9]{4}-[0-9]{2}-[0-9]{2}),([0-9]{4}-[0-9]{2}-[0-9]{2})\)$/;

const INPUT_KEYS = [
  "tenantId",
  "propertyNode",
  "reservationId",
  "supplierServiceLocationId",
  "supplierSezStatusId",
  "supplierLoaRenewalId",
  "statusAsOf",
] as const;
const SUPPLIER_STATUS_KEYS = [
  "supplierSezStatusId",
  "propertyNode",
  "supplierServiceLocation",
  "supplier",
  "statusAsOf",
  "gstRegistration",
  "sezStatus",
  "approval",
  "legalRule",
  "evidenceHash",
] as const;
const SERVICE_LOCATION_KEYS = ["id", "evidenceHash"] as const;
const SUPPLIER_KEYS = ["registrationId", "evidenceHash"] as const;
const GST_REGISTRATION_KEYS = [
  "status",
  "taxpayerType",
  "source",
  "evidenceSha256",
] as const;
const APPROVAL_KEYS = [
  "form",
  "reference",
  "validity",
  "status",
  "evidenceSha256",
] as const;
const VALIDITY_KEYS = ["fromInclusive", "toExclusive"] as const;
const ROW_KEYS = [
  "tenant_id",
  "id",
  "supplier_sez_status_id",
  "original_loa_reference",
  "original_loa_issue_date",
  "original_loa_evidence_sha256",
  "form_f2_file_number",
  "form_f2_issue_date",
  "renewal_validity",
  "renewal_status_as_of",
  "renewal_status",
  "renewal_status_source",
  "renewal_status_evidence_sha256",
  "form_f2_evidence_sha256",
  "legal_rule",
] as const;

const LEGAL_RULE = "SEZ_RULES_19_6_AND_19_6A_3_FORM_F2_CONTINUITY" as const;

interface SupplierSezStatusResolver {
  resolve(tx: Tx, input: IndiaGstSupplierSezStatusInput): Promise<unknown>;
}

interface SupplierLoaRenewalRow {
  readonly tenant_id: string;
  readonly id: string;
  readonly supplier_sez_status_id: string;
  readonly original_loa_reference: string;
  readonly original_loa_issue_date: string;
  readonly original_loa_evidence_sha256: string;
  readonly form_f2_file_number: string;
  readonly form_f2_issue_date: string;
  readonly renewal_validity: string;
  readonly renewal_status_as_of: string;
  readonly renewal_status: string;
  readonly renewal_status_source: string;
  readonly renewal_status_evidence_sha256: string;
  readonly form_f2_evidence_sha256: string;
  readonly legal_rule: string;
}

type SupplierServiceLocationEvidence = Readonly<{
  id: string;
  evidenceHash: string;
}>;

type SupplierEvidence = Readonly<{
  registrationId: string;
  evidenceHash: string;
}>;

type DateValidity = Readonly<{
  fromInclusive: string;
  toExclusive: string;
}>;

type SupplierSezUnitStatus = Readonly<{
  supplierSezStatusId: string;
  propertyNode: string;
  supplierServiceLocation: SupplierServiceLocationEvidence;
  supplier: SupplierEvidence;
  statusAsOf: string;
  approval: Readonly<{
    form: "sez_rules_form_g";
    reference: string;
    validity: DateValidity;
    status: "in_force";
    evidenceSha256: string;
  }>;
}>;

export interface IndiaSezUnitLoaRenewalInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly reservationId: string;
  readonly supplierServiceLocationId: string;
  readonly supplierSezStatusId: string;
  readonly supplierLoaRenewalId: string;
  readonly statusAsOf: string;
}

export interface IndiaSezUnitLoaRenewalResult {
  readonly supplierLoaRenewalId: string;
  readonly supplierSezStatusId: string;
  readonly propertyNode: string;
  readonly supplierServiceLocation: SupplierServiceLocationEvidence;
  readonly supplier: SupplierEvidence;
  readonly statusAsOf: string;
  readonly originalLoa: Readonly<{
    form: "sez_rules_form_g";
    reference: string;
    issueDate: string;
    validity: DateValidity;
    status: "in_force";
    evidenceSha256: string;
  }>;
  readonly renewal: Readonly<{
    form: "sez_rules_form_f2";
    fileNumber: string;
    issueDate: string;
    validity: DateValidity;
    statusAsOf: string;
    status: "in_force";
    source: "development_commissioner_record";
    statusEvidenceSha256: string;
    evidenceSha256: string;
  }>;
  readonly continuity: Readonly<{
    from: "sez_rules_form_g";
    to: "sez_rules_form_f2";
    exactlyContiguous: true;
  }>;
  readonly legalRule: typeof LEGAL_RULE;
  readonly evidenceHash: string;
}

export class IndiaSezUnitLoaRenewalValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaSezUnitLoaRenewalValidationError";
  }
}

export class IndiaSezUnitLoaRenewalNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaSezUnitLoaRenewalNotFoundError";
  }
}

export class IndiaSezUnitLoaRenewalConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaSezUnitLoaRenewalConflictError";
  }
}

function conflict(message: string): IndiaSezUnitLoaRenewalConflictError {
  return new IndiaSezUnitLoaRenewalConflictError(message);
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

function canonicalUuid(value: unknown, subject: string, input = false): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw input
      ? new IndiaSezUnitLoaRenewalValidationError(
          `${subject} must be a canonical UUID`,
        )
      : conflict(`${subject} is invalid`);
  }
  return value;
}

function canonicalHash(value: unknown, subject: string): string {
  if (typeof value !== "string" || !SHA256.test(value)) {
    throw conflict(`${subject} is invalid`);
  }
  return value;
}

function sha256(value: unknown): string {
  return Bun.CryptoHasher.hash("sha256", JSON.stringify(value), "hex");
}

function canonicalText(value: unknown, subject: string, maximum: number): string {
  if (typeof value !== "string" || value.length === 0 || value.length > maximum ||
      value !== value.trim() || value !== value.normalize("NFC") ||
      /[\u0000-\u001f\u007f]/.test(value)) {
    throw conflict(`${subject} is not canonical`);
  }
  return value;
}

function canonicalDate(value: unknown, subject: string, input = false): string {
  const fail = (message: string): never => {
    throw input
      ? new IndiaSezUnitLoaRenewalValidationError(message)
      : conflict(message);
  };
  if (typeof value !== "string") {
    return fail(`${subject} is invalid`);
  }
  const match = DATE.exec(value);
  if (match === null) {
    return fail(`${subject} is invalid`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const maximumDay = daysInMonth[month - 1];
  if (year === 0 || maximumDay === undefined || day === 0 || day > maximumDay) {
    return fail(`${subject} is invalid`);
  }
  return value;
}

function canonicalValidity(value: unknown, subject: string): DateValidity {
  if (typeof value !== "string") {
    throw conflict(`${subject} is invalid`);
  }
  const match = DATE_RANGE.exec(value);
  if (match === null) {
    throw conflict(`${subject} must be finite canonical [)`);
  }
  const fromInclusive = canonicalDate(match[1], `${subject} start`);
  const toExclusive = canonicalDate(match[2], `${subject} end`);
  if (fromInclusive >= toExclusive) {
    throw conflict(`${subject} is empty`);
  }
  return Object.freeze({ fromInclusive, toExclusive });
}

function exactValidity(value: unknown, subject: string): DateValidity {
  const validity = exactRecord(value, VALIDITY_KEYS, subject, true, conflict);
  const fromInclusive = canonicalDate(validity.fromInclusive, `${subject} start`);
  const toExclusive = canonicalDate(validity.toExclusive, `${subject} end`);
  if (fromInclusive >= toExclusive) {
    throw conflict(`${subject} is empty`);
  }
  return Object.freeze({ fromInclusive, toExclusive });
}

function normalizeInput(value: unknown): IndiaSezUnitLoaRenewalInput {
  const input = exactRecord(
    value,
    INPUT_KEYS,
    "India SEZ unit LoA renewal input",
    false,
    (message) => new IndiaSezUnitLoaRenewalValidationError(message),
  );
  return Object.freeze({
    tenantId: canonicalUuid(input.tenantId, "tenantId", true),
    propertyNode: canonicalUuid(input.propertyNode, "propertyNode", true),
    reservationId: canonicalUuid(input.reservationId, "reservationId", true),
    supplierServiceLocationId: canonicalUuid(
      input.supplierServiceLocationId,
      "supplierServiceLocationId",
      true,
    ),
    supplierSezStatusId: canonicalUuid(
      input.supplierSezStatusId,
      "supplierSezStatusId",
      true,
    ),
    supplierLoaRenewalId: canonicalUuid(
      input.supplierLoaRenewalId,
      "supplierLoaRenewalId",
      true,
    ),
    statusAsOf: canonicalDate(input.statusAsOf, "statusAsOf", true),
  });
}

function exactSupplierStatus(
  value: unknown,
  input: IndiaSezUnitLoaRenewalInput,
): SupplierSezUnitStatus {
  const status = exactRecord(
    value,
    SUPPLIER_STATUS_KEYS,
    "India GST supplier SEZ-status evidence",
    true,
    conflict,
  );
  const supplierSezStatusId = canonicalUuid(
    status.supplierSezStatusId,
    "supplier SEZ-status id",
  );
  const propertyNode = canonicalUuid(status.propertyNode, "supplier status property node");
  if (supplierSezStatusId !== input.supplierSezStatusId ||
      propertyNode !== input.propertyNode) {
    throw conflict("supplier SEZ status conflicts with the selected identity");
  }

  const locationSource = exactRecord(
    status.supplierServiceLocation,
    SERVICE_LOCATION_KEYS,
    "supplier status service-location evidence",
    true,
    conflict,
  );
  const supplierServiceLocation = Object.freeze({
    id: canonicalUuid(locationSource.id, "supplier service-location id"),
    evidenceHash: canonicalHash(
      locationSource.evidenceHash,
      "supplier service-location evidence hash",
    ),
  });
  if (supplierServiceLocation.id !== input.supplierServiceLocationId) {
    throw conflict("supplier service location conflicts with the selected identity");
  }

  const supplierSource = exactRecord(
    status.supplier,
    SUPPLIER_KEYS,
    "supplier registration evidence",
    true,
    conflict,
  );
  const supplier = Object.freeze({
    registrationId: canonicalUuid(
      supplierSource.registrationId,
      "supplier registration id",
    ),
    evidenceHash: canonicalHash(
      supplierSource.evidenceHash,
      "supplier registration evidence hash",
    ),
  });

  const statusAsOf = canonicalDate(status.statusAsOf, "supplier status-as-of date");
  const registrationSource = exactRecord(
    status.gstRegistration,
    GST_REGISTRATION_KEYS,
    "supplier GST-registration evidence",
    true,
    conflict,
  );
  if (registrationSource.status !== "active" ||
      registrationSource.taxpayerType !== "sez_unit" ||
      registrationSource.source !== "gst_common_portal") {
    throw conflict("supplier GST registration is not an active SEZ unit");
  }
  const gstRegistration = Object.freeze({
    status: "active" as const,
    taxpayerType: "sez_unit" as const,
    source: "gst_common_portal" as const,
    evidenceSha256: canonicalHash(
      registrationSource.evidenceSha256,
      "supplier GST-registration evidence hash",
    ),
  });
  if (status.sezStatus !== "sez_unit") {
    throw conflict("supplier SEZ status is not a unit");
  }

  const approvalSource = exactRecord(
    status.approval,
    APPROVAL_KEYS,
    "supplier Form-G approval evidence",
    true,
    conflict,
  );
  if (approvalSource.form !== "sez_rules_form_g" ||
      approvalSource.status !== "in_force") {
    throw conflict("supplier approval is not an in-force Form G");
  }
  const approval = Object.freeze({
    form: "sez_rules_form_g" as const,
    reference: canonicalText(
      approvalSource.reference,
      "supplier Form-G reference",
      128,
    ),
    validity: exactValidity(
      approvalSource.validity,
      "supplier Form-G validity",
    ),
    status: "in_force" as const,
    evidenceSha256: canonicalHash(
      approvalSource.evidenceSha256,
      "supplier Form-G evidence hash",
    ),
  });
  if (statusAsOf < approval.validity.fromInclusive ||
      statusAsOf >= approval.validity.toExclusive ||
      status.legalRule !== "IGST_ACT_7_5_B_AND_8_2_SUPPLIER_STATUS") {
    throw conflict("supplier Form-G status evidence is inconsistent");
  }

  const legalRule = "IGST_ACT_7_5_B_AND_8_2_SUPPLIER_STATUS" as const;
  const evidence = Object.freeze({
    tenantId: input.tenantId,
    supplierSezStatusId,
    propertyNode,
    supplierServiceLocation,
    supplier,
    statusAsOf,
    gstRegistration,
    sezStatus: "sez_unit" as const,
    approval,
    legalRule,
  });
  const evidenceHash = canonicalHash(
    status.evidenceHash,
    "supplier SEZ-status evidence hash",
  );
  if (evidenceHash !== sha256(evidence)) {
    throw conflict("supplier SEZ-status evidence hash is inconsistent");
  }
  return Object.freeze({
    supplierSezStatusId,
    propertyNode,
    supplierServiceLocation,
    supplier,
    statusAsOf,
    approval,
  });
}

function canonicalResult(
  value: unknown,
  input: IndiaSezUnitLoaRenewalInput,
  current: SupplierSezUnitStatus,
): IndiaSezUnitLoaRenewalResult {
  const row = exactRecord(
    value,
    ROW_KEYS,
    "stored India SEZ unit LoA-renewal row",
    false,
    conflict,
  ) as unknown as SupplierLoaRenewalRow;
  const tenantId = canonicalUuid(row.tenant_id, "stored LoA-renewal tenant id");
  const supplierLoaRenewalId = canonicalUuid(
    row.id,
    "stored LoA-renewal id",
  );
  const supplierSezStatusId = canonicalUuid(
    row.supplier_sez_status_id,
    "stored supplier SEZ-status id",
  );
  const statusAsOf = canonicalDate(
    row.renewal_status_as_of,
    "renewal status-as-of date",
  );
  if (tenantId !== input.tenantId ||
      supplierLoaRenewalId !== input.supplierLoaRenewalId ||
      supplierSezStatusId !== current.supplierSezStatusId ||
      statusAsOf !== input.statusAsOf ||
      row.renewal_status !== "in_force" ||
      row.renewal_status_source !== "development_commissioner_record" ||
      row.legal_rule !== LEGAL_RULE) {
    throw conflict("selected Form-F2 renewal conflicts with current evidence");
  }

  const originalReference = canonicalText(
    row.original_loa_reference,
    "original Form-G reference",
    128,
  );
  const originalEvidenceHash = canonicalHash(
    row.original_loa_evidence_sha256,
    "original Form-G evidence hash",
  );
  if (originalReference !== current.approval.reference ||
      originalEvidenceHash !== current.approval.evidenceSha256) {
    throw conflict("stored original LoA conflicts with current Form-G evidence");
  }
  const originalIssueDate = canonicalDate(
    row.original_loa_issue_date,
    "original Form-G issue date",
  );
  const formF2IssueDate = canonicalDate(
    row.form_f2_issue_date,
    "Form-F2 issue date",
  );
  const renewalValidity = canonicalValidity(
    row.renewal_validity,
    "Form-F2 renewal validity",
  );
  if (renewalValidity.fromInclusive !== current.approval.validity.toExclusive) {
    throw conflict("Form-F2 renewal is not directly contiguous with Form G");
  }
  if (statusAsOf < renewalValidity.fromInclusive ||
      statusAsOf >= renewalValidity.toExclusive) {
    throw conflict("Form-F2 renewal is not in force at the status-as-of date");
  }
  if (originalIssueDate > formF2IssueDate || formF2IssueDate > statusAsOf) {
    throw conflict("Form-G/Form-F2 issue chronology is invalid");
  }

  const originalLoa = Object.freeze({
    form: "sez_rules_form_g" as const,
    reference: originalReference,
    issueDate: originalIssueDate,
    validity: current.approval.validity,
    status: "in_force" as const,
    evidenceSha256: originalEvidenceHash,
  });
  const renewal = Object.freeze({
    form: "sez_rules_form_f2" as const,
    fileNumber: canonicalText(row.form_f2_file_number, "Form-F2 file number", 128),
    issueDate: formF2IssueDate,
    validity: renewalValidity,
    statusAsOf,
    status: "in_force" as const,
    source: "development_commissioner_record" as const,
    statusEvidenceSha256: canonicalHash(
      row.renewal_status_evidence_sha256,
      "Form-F2 renewal-status evidence hash",
    ),
    evidenceSha256: canonicalHash(
      row.form_f2_evidence_sha256,
      "Form-F2 evidence hash",
    ),
  });
  const continuity = Object.freeze({
    from: "sez_rules_form_g" as const,
    to: "sez_rules_form_f2" as const,
    exactlyContiguous: true as const,
  });
  const evidence = Object.freeze({
    tenantId,
    supplierLoaRenewalId,
    supplierSezStatusId,
    propertyNode: current.propertyNode,
    supplierServiceLocation: current.supplierServiceLocation,
    supplier: current.supplier,
    statusAsOf,
    originalLoa,
    renewal,
    continuity,
    legalRule: LEGAL_RULE,
  });
  return Object.freeze({
    supplierLoaRenewalId,
    supplierSezStatusId,
    propertyNode: current.propertyNode,
    supplierServiceLocation: current.supplierServiceLocation,
    supplier: current.supplier,
    statusAsOf,
    originalLoa,
    renewal,
    continuity,
    legalRule: LEGAL_RULE,
    evidenceHash: sha256(evidence),
  });
}

async function readExactRenewal(
  tx: Tx,
  input: IndiaSezUnitLoaRenewalInput,
  current: SupplierSezUnitStatus,
): Promise<IndiaSezUnitLoaRenewalResult> {
  const rows = await tx<SupplierLoaRenewalRow[]>`
    SELECT renewal.tenant_id::text AS tenant_id,
           renewal.id::text AS id,
           renewal.supplier_sez_status_id::text AS supplier_sez_status_id,
           renewal.original_loa_reference,
           renewal.original_loa_issue_date::text AS original_loa_issue_date,
           renewal.original_loa_evidence_sha256,
           renewal.form_f2_file_number,
           renewal.form_f2_issue_date::text AS form_f2_issue_date,
           renewal.renewal_validity::text AS renewal_validity,
           renewal.renewal_status_as_of::text AS renewal_status_as_of,
           renewal.renewal_status,
           renewal.renewal_status_source,
           renewal.renewal_status_evidence_sha256,
           renewal.form_f2_evidence_sha256,
           renewal.legal_rule
      FROM public.india_sez_unit_loa_renewal AS renewal
     WHERE renewal.tenant_id = ${input.tenantId}::uuid
       AND renewal.tenant_id = current_setting('app.tenant_id', true)::uuid
       AND renewal.id = ${input.supplierLoaRenewalId}::uuid
       AND renewal.supplier_sez_status_id = ${current.supplierSezStatusId}::uuid
       AND renewal.renewal_status_as_of = ${input.statusAsOf}::date
       AND renewal.renewal_status = 'in_force'
       AND renewal.renewal_status_source = 'development_commissioner_record'
       AND renewal.legal_rule = 'SEZ_RULES_19_6_AND_19_6A_3_FORM_F2_CONTINUITY'
  `;
  if (rows.length === 0) {
    throw new IndiaSezUnitLoaRenewalNotFoundError(
      "selected India SEZ unit LoA renewal is unavailable",
    );
  }
  if (rows.length !== 1 || rows[0] === undefined) {
    throw conflict("selected India SEZ unit LoA renewal is ambiguous");
  }
  return canonicalResult(rows[0], input, current);
}

export class IndiaSezUnitLoaRenewalService {
  constructor(
    private readonly supplierSezStatus: SupplierSezStatusResolver =
      new IndiaGstSupplierSezStatusService(),
  ) {}

  async resolve(
    tx: Tx,
    input: IndiaSezUnitLoaRenewalInput,
  ): Promise<IndiaSezUnitLoaRenewalResult> {
    if (typeof tx !== "function") {
      throw new IndiaSezUnitLoaRenewalValidationError(
        "tenant transaction is unavailable",
      );
    }
    const normalized = normalizeInput(input);
    const current = exactSupplierStatus(
      await this.supplierSezStatus.resolve(tx, Object.freeze({
        tenantId: normalized.tenantId,
        propertyNode: normalized.propertyNode,
        reservationId: normalized.reservationId,
        supplierServiceLocationId: normalized.supplierServiceLocationId,
        supplierSezStatusId: normalized.supplierSezStatusId,
      })),
      normalized,
    );
    return readExactRenewal(tx, normalized, current);
  }
}
