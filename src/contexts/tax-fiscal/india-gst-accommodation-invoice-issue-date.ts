import { types as utilTypes } from "node:util";

import type { Tx } from "../../kernel";
import { parsePositiveTaxAttributionSnapshot } from "./attribution";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const DATE = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/;
const CURRENCY = /^[A-Z]{3}$/;
const DECIMAL = /^(0|[1-9][0-9]*)$/;
const INPUT_KEYS = [
  "tenantId",
  "propertyNode",
  "reservationId",
  "serviceProvisionSnapshotId",
  "invoiceIssueSnapshotId",
  "invoiceIssueDate",
  "invoiceSeries",
  "invoiceSerial",
] as const;
const ROW_KEYS = [
  "tenant_id",
  "id",
  "service_provision_snapshot_id",
  "currency",
  "amount_minor",
  "coverage_scope",
  "invoice_series",
  "invoice_serial",
  "invoice_issue_date",
  "invoice_issue_source",
  "invoice_issue_evidence_sha256",
  "legal_rule",
  "service_tenant_id",
  "service_id",
  "property_node",
  "reservation_lineage_id",
  "hold_binding_id",
  "attribution_id",
  "reservation_id",
  "segment_id",
  "origin_quote_hash",
  "snapshot_hash",
  "service_currency",
  "service_provision_date",
  "service_provision_source",
  "service_provision_evidence_sha256",
  "service_legal_rule",
  "lineage_id",
  "lineage_property_node",
  "lineage_hold_binding_id",
  "lineage_attribution_id",
  "lineage_reservation_id",
  "lineage_segment_id",
  "lineage_origin_quote_hash",
  "lineage_snapshot_hash",
  "lineage_currency",
  "attribution_snapshot",
] as const;

interface InvoiceIssueRow {
  readonly tenant_id: string;
  readonly id: string;
  readonly service_provision_snapshot_id: string;
  readonly currency: string;
  readonly amount_minor: string | bigint;
  readonly coverage_scope: string;
  readonly invoice_series: string;
  readonly invoice_serial: string;
  readonly invoice_issue_date: string;
  readonly invoice_issue_source: string;
  readonly invoice_issue_evidence_sha256: string;
  readonly legal_rule: string;
  readonly service_tenant_id: string;
  readonly service_id: string;
  readonly property_node: string;
  readonly reservation_lineage_id: string;
  readonly hold_binding_id: string;
  readonly attribution_id: string;
  readonly reservation_id: string;
  readonly segment_id: string;
  readonly origin_quote_hash: string;
  readonly snapshot_hash: string;
  readonly service_currency: string;
  readonly service_provision_date: string;
  readonly service_provision_source: string;
  readonly service_provision_evidence_sha256: string;
  readonly service_legal_rule: string;
  readonly lineage_id: string;
  readonly lineage_property_node: string;
  readonly lineage_hold_binding_id: string;
  readonly lineage_attribution_id: string;
  readonly lineage_reservation_id: string;
  readonly lineage_segment_id: string;
  readonly lineage_origin_quote_hash: string;
  readonly lineage_snapshot_hash: string;
  readonly lineage_currency: string;
  readonly attribution_snapshot: unknown;
}

type ReservationLineageEvidence = Readonly<{
  lineageId: string;
  holdBindingId: string;
  attributionId: string;
  reservationId: string;
  segmentId: string;
  originQuoteHash: string;
  snapshotHash: string;
  currency: string;
}>;

type ServiceProvisionEvidence = Readonly<{
  serviceProvisionSnapshotId: string;
  serviceProvisionDate: string;
  serviceProvisionSource: "governed_service_provision_record";
  serviceProvisionEvidenceSha256: string;
  legalRule: "CGST_ACT_13_2_B_SERVICE_PROVISION_DATE_INPUT_ONLY";
  reservationLineage: ReservationLineageEvidence;
  attribution: Readonly<{
    originKind: "rate_quote";
    lineId: "room";
    revenueGroup: "room_revenue";
  }>;
}>;

export interface IndiaGstAccommodationInvoiceIssueDateInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly reservationId: string;
  readonly serviceProvisionSnapshotId: string;
  readonly invoiceIssueSnapshotId: string;
  readonly invoiceIssueDate: string;
  readonly invoiceSeries: string;
  readonly invoiceSerial: string;
}

export interface IndiaGstAccommodationInvoiceIssueDateResult {
  readonly invoiceIssueSnapshotId: string;
  readonly propertyNode: string;
  readonly serviceProvision: ServiceProvisionEvidence;
  readonly serviceProvisionDate: string;
  readonly invoiceSeries: string;
  readonly invoiceSerial: string;
  readonly invoiceIssueDate: string;
  readonly coverageScope: "full_attribution";
  readonly amountMinor: string;
  readonly currency: string;
  readonly invoiceIssueSource: "governed_supplier_tax_invoice_record";
  readonly invoiceIssueEvidenceSha256: string;
  readonly legalRule: "CGST_ACT_13_2_INVOICE_DATE_INPUT_ONLY";
  readonly evidenceHash: string;
}

export class IndiaGstAccommodationInvoiceIssueDateValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaGstAccommodationInvoiceIssueDateValidationError";
  }
}

export class IndiaGstAccommodationInvoiceIssueDateNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaGstAccommodationInvoiceIssueDateNotFoundError";
  }
}

export class IndiaGstAccommodationInvoiceIssueDateConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaGstAccommodationInvoiceIssueDateConflictError";
  }
}

function conflict(message: string): IndiaGstAccommodationInvoiceIssueDateConflictError {
  return new IndiaGstAccommodationInvoiceIssueDateConflictError(message);
}

function exactRecord(
  value: unknown,
  expectedKeys: readonly string[],
  subject: string,
  error: (message: string) => Error,
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value) ||
      utilTypes.isProxy(value) || Object.getOwnPropertySymbols(value).length !== 0 ||
      (Object.getPrototypeOf(value) !== Object.prototype &&
        Object.getPrototypeOf(value) !== null)) {
    throw error(`${subject} must be an exact plain object`);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Object.keys(descriptors).sort();
  const expected = [...expectedKeys].sort();
  if (keys.length !== expected.length ||
      keys.some((key, index) => key !== expected[index]) ||
      Object.values(descriptors).some((descriptor) =>
        descriptor.get !== undefined || descriptor.set !== undefined ||
        descriptor.enumerable !== true || !("value" in descriptor))) {
    throw error(`${subject} shape is invalid`);
  }
  return value as Record<string, unknown>;
}

function canonicalUuid(value: unknown, subject: string, input = false): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw input
      ? new IndiaGstAccommodationInvoiceIssueDateValidationError(
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

function canonicalCurrency(value: unknown, subject: string): string {
  if (typeof value !== "string" || !CURRENCY.test(value)) {
    throw conflict(`${subject} is invalid`);
  }
  return value;
}

function canonicalMinor(value: unknown, subject: string): string {
  if (typeof value === "bigint") {
    if (value <= 0n) throw conflict(`${subject} is invalid`);
    return value.toString();
  }
  if (typeof value !== "string" || !DECIMAL.test(value) || BigInt(value) <= 0n) {
    throw conflict(`${subject} is invalid`);
  }
  return value;
}

function canonicalDate(value: unknown, subject: string, input = false): string {
  const invalid = (): Error => input
    ? new IndiaGstAccommodationInvoiceIssueDateValidationError(`${subject} is invalid`)
    : conflict(`${subject} is invalid`);
  if (typeof value !== "string") throw invalid();
  const match = DATE.exec(value);
  if (match === null) throw invalid();
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const maximum = days[month - 1];
  if (year === 0 || maximum === undefined || day === 0 || day > maximum) {
    throw invalid();
  }
  return value;
}

function invoiceIdentity(value: unknown, subject: string, input = false): string {
  if (typeof value !== "string" || value.length < 1 || value.length > 64) {
    throw input
      ? new IndiaGstAccommodationInvoiceIssueDateValidationError(`${subject} is invalid`)
      : conflict(`${subject} is invalid`);
  }
  return value;
}

function sha256(value: unknown): string {
  return new Bun.CryptoHasher("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}

function normalizeInput(value: unknown): IndiaGstAccommodationInvoiceIssueDateInput {
  const input = exactRecord(
    value,
    INPUT_KEYS,
    "India GST accommodation invoice-issue-date input",
    (message) => new IndiaGstAccommodationInvoiceIssueDateValidationError(message),
  );
  return Object.freeze({
    tenantId: canonicalUuid(input.tenantId, "tenantId", true),
    propertyNode: canonicalUuid(input.propertyNode, "propertyNode", true),
    reservationId: canonicalUuid(input.reservationId, "reservationId", true),
    serviceProvisionSnapshotId: canonicalUuid(
      input.serviceProvisionSnapshotId,
      "serviceProvisionSnapshotId",
      true,
    ),
    invoiceIssueSnapshotId: canonicalUuid(
      input.invoiceIssueSnapshotId,
      "invoiceIssueSnapshotId",
      true,
    ),
    invoiceIssueDate: canonicalDate(input.invoiceIssueDate, "invoiceIssueDate", true),
    invoiceSeries: invoiceIdentity(input.invoiceSeries, "invoiceSeries", true),
    invoiceSerial: invoiceIdentity(input.invoiceSerial, "invoiceSerial", true),
  });
}

function canonicalResult(
  candidate: unknown,
  input: IndiaGstAccommodationInvoiceIssueDateInput,
): IndiaGstAccommodationInvoiceIssueDateResult {
  const row = exactRecord(
    candidate,
    ROW_KEYS,
    "stored India GST accommodation invoice-issue-date row",
    conflict,
  ) as unknown as InvoiceIssueRow;
  const tenantId = canonicalUuid(row.tenant_id, "stored tenant id");
  const invoiceIssueSnapshotId = canonicalUuid(row.id, "stored invoice-issue snapshot id");
  const serviceProvisionSnapshotId = canonicalUuid(
    row.service_provision_snapshot_id,
    "stored service-provision snapshot id",
  );
  const propertyNode = canonicalUuid(row.property_node, "stored property node");
  const reservationId = canonicalUuid(row.reservation_id, "stored reservation id");
  const currency = canonicalCurrency(row.currency, "stored invoice currency");
  const amountMinor = canonicalMinor(row.amount_minor, "stored invoice amount");
  const invoiceSeries = invoiceIdentity(row.invoice_series, "stored invoice series");
  const invoiceSerial = invoiceIdentity(row.invoice_serial, "stored invoice serial");
  const invoiceIssueDate = canonicalDate(row.invoice_issue_date, "invoice-issue date");
  const serviceDate = canonicalDate(row.service_provision_date, "service-provision date");
  const serviceCurrency = canonicalCurrency(row.service_currency, "service currency");
  const lineageId = canonicalUuid(row.reservation_lineage_id, "service lineage id");
  const holdBindingId = canonicalUuid(row.hold_binding_id, "service hold binding id");
  const attributionId = canonicalUuid(row.attribution_id, "service attribution id");
  const segmentId = canonicalUuid(row.segment_id, "service segment id");
  const originQuoteHash = canonicalHash(row.origin_quote_hash, "service quote hash");
  const snapshotHash = canonicalHash(row.snapshot_hash, "service snapshot hash");

  if (tenantId !== input.tenantId || invoiceIssueSnapshotId !== input.invoiceIssueSnapshotId ||
      serviceProvisionSnapshotId !== input.serviceProvisionSnapshotId ||
      propertyNode !== input.propertyNode || reservationId !== input.reservationId ||
      invoiceIssueDate !== input.invoiceIssueDate || invoiceSeries !== input.invoiceSeries ||
      invoiceSerial !== input.invoiceSerial ||
      tenantId !== canonicalUuid(row.service_tenant_id, "service tenant id") ||
      serviceProvisionSnapshotId !== canonicalUuid(row.service_id, "service snapshot id") ||
      propertyNode !== canonicalUuid(row.lineage_property_node, "lineage property node") ||
      lineageId !== canonicalUuid(row.lineage_id, "lineage id") ||
      holdBindingId !== canonicalUuid(row.lineage_hold_binding_id, "lineage hold binding id") ||
      attributionId !== canonicalUuid(row.lineage_attribution_id, "lineage attribution id") ||
      reservationId !== canonicalUuid(row.lineage_reservation_id, "lineage reservation id") ||
      segmentId !== canonicalUuid(row.lineage_segment_id, "lineage segment id") ||
      originQuoteHash !== canonicalHash(row.lineage_origin_quote_hash, "lineage quote hash") ||
      snapshotHash !== canonicalHash(row.lineage_snapshot_hash, "lineage snapshot hash") ||
      serviceCurrency !== canonicalCurrency(row.lineage_currency, "lineage currency") ||
      currency !== serviceCurrency || row.coverage_scope !== "full_attribution" ||
      row.invoice_issue_source !== "governed_supplier_tax_invoice_record" ||
      row.legal_rule !== "CGST_ACT_13_2_INVOICE_DATE_INPUT_ONLY" ||
      row.service_provision_source !== "governed_service_provision_record" ||
      row.service_legal_rule !== "CGST_ACT_13_2_B_SERVICE_PROVISION_DATE_INPUT_ONLY") {
    throw conflict("invoice-issue evidence conflicts with complete service lineage");
  }

  let snapshot;
  try {
    snapshot = parsePositiveTaxAttributionSnapshot(row.attribution_snapshot);
  } catch {
    throw conflict("canonical positive-tax attribution is malformed");
  }
  if (snapshot.origin.kind !== "rate_quote" ||
      snapshot.origin.quoteHash !== originQuoteHash || snapshot.snapshotHash !== snapshotHash ||
      snapshot.currency !== currency || snapshot.revenueLine.lineId !== "room" ||
      snapshot.revenueLine.revenueGroup !== "room_revenue" ||
      snapshot.evaluation.grandTotalMinor !== amountMinor) {
    throw conflict("invoice-issue evidence conflicts with canonical full attribution");
  }

  const reservationLineage = Object.freeze({
    lineageId,
    holdBindingId,
    attributionId,
    reservationId,
    segmentId,
    originQuoteHash,
    snapshotHash,
    currency,
  });
  const attribution = Object.freeze({
    originKind: "rate_quote" as const,
    lineId: "room" as const,
    revenueGroup: "room_revenue" as const,
  });
  const serviceProvision = Object.freeze({
    serviceProvisionSnapshotId,
    serviceProvisionDate: serviceDate,
    serviceProvisionSource: "governed_service_provision_record" as const,
    serviceProvisionEvidenceSha256: canonicalHash(
      row.service_provision_evidence_sha256,
      "service-provision evidence hash",
    ),
    legalRule: "CGST_ACT_13_2_B_SERVICE_PROVISION_DATE_INPUT_ONLY" as const,
    reservationLineage,
    attribution,
  });
  const invoiceIssueSource = "governed_supplier_tax_invoice_record" as const;
  const invoiceIssueEvidenceSha256 = canonicalHash(
    row.invoice_issue_evidence_sha256,
    "invoice-issue evidence hash",
  );
  const legalRule = "CGST_ACT_13_2_INVOICE_DATE_INPUT_ONLY" as const;
  const evidence = Object.freeze({
    tenantId,
    invoiceIssueSnapshotId,
    propertyNode,
    serviceProvision,
    serviceProvisionDate: serviceDate,
    invoiceSeries,
    invoiceSerial,
    invoiceIssueDate,
    coverageScope: "full_attribution" as const,
    amountMinor,
    currency,
    invoiceIssueSource,
    invoiceIssueEvidenceSha256,
    legalRule,
  });
  return Object.freeze({
    invoiceIssueSnapshotId,
    propertyNode,
    serviceProvision,
    serviceProvisionDate: serviceDate,
    invoiceSeries,
    invoiceSerial,
    invoiceIssueDate,
    coverageScope: "full_attribution" as const,
    amountMinor,
    currency,
    invoiceIssueSource,
    invoiceIssueEvidenceSha256,
    legalRule,
    evidenceHash: sha256(evidence),
  });
}

async function readExactInvoiceIssueDate(
  tx: Tx,
  input: IndiaGstAccommodationInvoiceIssueDateInput,
): Promise<IndiaGstAccommodationInvoiceIssueDateResult> {
  const rows = await tx<InvoiceIssueRow[]>`
    SELECT invoice.tenant_id::text AS tenant_id,
           invoice.id::text AS id,
           invoice.service_provision_snapshot_id::text AS service_provision_snapshot_id,
           invoice.currency::text AS currency,
           invoice.amount_minor::text AS amount_minor,
           invoice.coverage_scope,
           invoice.invoice_series,
           invoice.invoice_serial,
           invoice.invoice_issue_date::text AS invoice_issue_date,
           invoice.invoice_issue_source,
           invoice.invoice_issue_evidence_sha256,
           invoice.legal_rule,
           service_date.tenant_id::text AS service_tenant_id,
           service_date.id::text AS service_id,
           service_date.property_node::text AS property_node,
           service_date.reservation_lineage_id::text AS reservation_lineage_id,
           service_date.hold_binding_id::text AS hold_binding_id,
           service_date.attribution_id::text AS attribution_id,
           service_date.reservation_id::text AS reservation_id,
           service_date.segment_id::text AS segment_id,
           service_date.origin_quote_hash AS origin_quote_hash,
           service_date.snapshot_hash AS snapshot_hash,
           service_date.currency::text AS service_currency,
           service_date.service_provision_date::text AS service_provision_date,
           service_date.service_provision_source,
           service_date.service_provision_evidence_sha256,
           service_date.legal_rule AS service_legal_rule,
           lineage.id::text AS lineage_id,
           lineage.property_node::text AS lineage_property_node,
           lineage.binding_id::text AS lineage_hold_binding_id,
           lineage.attribution_id::text AS lineage_attribution_id,
           lineage.reservation_id::text AS lineage_reservation_id,
           lineage.segment_id::text AS lineage_segment_id,
           lineage.origin_quote_hash AS lineage_origin_quote_hash,
           lineage.snapshot_hash AS lineage_snapshot_hash,
           lineage.currency::text AS lineage_currency,
           attribution.snapshot AS attribution_snapshot
      FROM public.india_gst_accommodation_invoice_issue_snapshot AS invoice
      JOIN public.india_gst_accommodation_service_provision_snapshot AS service_date
        ON service_date.tenant_id = invoice.tenant_id
       AND service_date.id = invoice.service_provision_snapshot_id
      JOIN public.tax_attribution_reservation_binding AS lineage
        ON lineage.tenant_id = service_date.tenant_id
       AND lineage.id = service_date.reservation_lineage_id
       AND lineage.property_node = service_date.property_node
       AND lineage.binding_id = service_date.hold_binding_id
       AND lineage.attribution_id = service_date.attribution_id
       AND lineage.reservation_id = service_date.reservation_id
       AND lineage.segment_id = service_date.segment_id
       AND lineage.origin_quote_hash = service_date.origin_quote_hash
       AND lineage.snapshot_hash = service_date.snapshot_hash
       AND lineage.currency = service_date.currency
      JOIN public.tax_attribution_snapshot AS attribution
        ON attribution.tenant_id = service_date.tenant_id
       AND attribution.id = service_date.attribution_id
       AND attribution.property_node = service_date.property_node
       AND attribution.origin_kind = 'rate_quote'
       AND attribution.origin_quote_hash = service_date.origin_quote_hash
       AND attribution.snapshot_hash = service_date.snapshot_hash
       AND attribution.currency = service_date.currency
     WHERE invoice.tenant_id = ${input.tenantId}::uuid
       AND invoice.tenant_id = current_setting('app.tenant_id', true)::uuid
       AND invoice.id = ${input.invoiceIssueSnapshotId}::uuid
       AND invoice.service_provision_snapshot_id = ${input.serviceProvisionSnapshotId}::uuid
       AND invoice.invoice_issue_date = ${input.invoiceIssueDate}::date
       AND invoice.invoice_series = ${input.invoiceSeries}
       AND invoice.invoice_serial = ${input.invoiceSerial}
       AND service_date.property_node = ${input.propertyNode}::uuid
       AND service_date.reservation_id = ${input.reservationId}::uuid
       AND invoice.coverage_scope = 'full_attribution'
       AND invoice.invoice_issue_source = 'governed_supplier_tax_invoice_record'
       AND invoice.legal_rule = 'CGST_ACT_13_2_INVOICE_DATE_INPUT_ONLY'
       AND service_date.service_provision_source = 'governed_service_provision_record'
       AND service_date.legal_rule = 'CGST_ACT_13_2_B_SERVICE_PROVISION_DATE_INPUT_ONLY'
  `;
  if (rows.length === 0) {
    throw new IndiaGstAccommodationInvoiceIssueDateNotFoundError(
      "selected India GST accommodation invoice-issue date is unavailable",
    );
  }
  if (rows.length !== 1 || rows[0] === undefined) {
    throw conflict("selected accommodation invoice-issue date is ambiguous");
  }
  return canonicalResult(rows[0], input);
}

export class IndiaGstAccommodationInvoiceIssueDateService {
  async resolve(
    tx: Tx,
    input: IndiaGstAccommodationInvoiceIssueDateInput,
  ): Promise<IndiaGstAccommodationInvoiceIssueDateResult> {
    if (typeof tx !== "function") {
      throw new IndiaGstAccommodationInvoiceIssueDateValidationError(
        "tenant transaction is unavailable",
      );
    }
    return readExactInvoiceIssueDate(tx, normalizeInput(input));
  }
}
