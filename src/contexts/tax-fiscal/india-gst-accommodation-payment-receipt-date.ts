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
  "paymentReceiptSnapshotId",
  "paymentReceiptDate",
] as const;
const ROW_KEYS = [
  "tenant_id",
  "id",
  "service_provision_snapshot_id",
  "currency",
  "amount_minor",
  "coverage_scope",
  "supplier_books_entry_date",
  "supplier_bank_credit_date",
  "payment_receipt_date",
  "payment_receipt_source",
  "payment_receipt_evidence_sha256",
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

interface PaymentReceiptRow {
  readonly tenant_id: string;
  readonly id: string;
  readonly service_provision_snapshot_id: string;
  readonly currency: string;
  readonly amount_minor: string | bigint;
  readonly coverage_scope: string;
  readonly supplier_books_entry_date: string;
  readonly supplier_bank_credit_date: string;
  readonly payment_receipt_date: string;
  readonly payment_receipt_source: string;
  readonly payment_receipt_evidence_sha256: string;
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

export interface IndiaGstAccommodationPaymentReceiptDateInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly reservationId: string;
  readonly serviceProvisionSnapshotId: string;
  readonly paymentReceiptSnapshotId: string;
  readonly paymentReceiptDate: string;
}

export interface IndiaGstAccommodationPaymentReceiptDateResult {
  readonly paymentReceiptSnapshotId: string;
  readonly propertyNode: string;
  readonly serviceProvision: ServiceProvisionEvidence;
  readonly supplierBooksEntryDate: string;
  readonly supplierBankCreditDate: string;
  readonly paymentReceiptDate: string;
  readonly coverageScope: "full_attribution";
  readonly amountMinor: string;
  readonly currency: string;
  readonly paymentReceiptSource: "governed_supplier_payment_receipt_record";
  readonly paymentReceiptEvidenceSha256: string;
  readonly legalRule: "CGST_ACT_13_2_EXPLANATION_II_PAYMENT_RECEIPT_DATE_INPUT_ONLY";
  readonly evidenceHash: string;
}

export class IndiaGstAccommodationPaymentReceiptDateValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaGstAccommodationPaymentReceiptDateValidationError";
  }
}

export class IndiaGstAccommodationPaymentReceiptDateNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaGstAccommodationPaymentReceiptDateNotFoundError";
  }
}

export class IndiaGstAccommodationPaymentReceiptDateConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaGstAccommodationPaymentReceiptDateConflictError";
  }
}

function conflict(message: string): IndiaGstAccommodationPaymentReceiptDateConflictError {
  return new IndiaGstAccommodationPaymentReceiptDateConflictError(message);
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
      ? new IndiaGstAccommodationPaymentReceiptDateValidationError(
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
    ? new IndiaGstAccommodationPaymentReceiptDateValidationError(
        `${subject} is invalid`,
      )
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

function sha256(value: unknown): string {
  return new Bun.CryptoHasher("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}

function normalizeInput(value: unknown): IndiaGstAccommodationPaymentReceiptDateInput {
  const input = exactRecord(
    value,
    INPUT_KEYS,
    "India GST accommodation payment-receipt-date input",
    (message) => new IndiaGstAccommodationPaymentReceiptDateValidationError(message),
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
    paymentReceiptSnapshotId: canonicalUuid(
      input.paymentReceiptSnapshotId,
      "paymentReceiptSnapshotId",
      true,
    ),
    paymentReceiptDate: canonicalDate(
      input.paymentReceiptDate,
      "paymentReceiptDate",
      true,
    ),
  });
}

function canonicalResult(
  candidate: unknown,
  input: IndiaGstAccommodationPaymentReceiptDateInput,
): IndiaGstAccommodationPaymentReceiptDateResult {
  const row = exactRecord(
    candidate,
    ROW_KEYS,
    "stored India GST accommodation payment-receipt-date row",
    conflict,
  ) as unknown as PaymentReceiptRow;
  const tenantId = canonicalUuid(row.tenant_id, "stored tenant id");
  const paymentReceiptSnapshotId = canonicalUuid(
    row.id,
    "stored payment-receipt snapshot id",
  );
  const serviceProvisionSnapshotId = canonicalUuid(
    row.service_provision_snapshot_id,
    "stored service-provision snapshot id",
  );
  const propertyNode = canonicalUuid(row.property_node, "stored property node");
  const reservationId = canonicalUuid(row.reservation_id, "stored reservation id");
  const currency = canonicalCurrency(row.currency, "stored receipt currency");
  const amountMinor = canonicalMinor(row.amount_minor, "stored receipt amount");
  const booksDate = canonicalDate(row.supplier_books_entry_date, "supplier books-entry date");
  const bankDate = canonicalDate(row.supplier_bank_credit_date, "supplier bank-credit date");
  const paymentReceiptDate = canonicalDate(row.payment_receipt_date, "payment-receipt date");
  const serviceDate = canonicalDate(row.service_provision_date, "service-provision date");
  const serviceCurrency = canonicalCurrency(row.service_currency, "service currency");
  const lineageId = canonicalUuid(row.reservation_lineage_id, "service lineage id");
  const holdBindingId = canonicalUuid(row.hold_binding_id, "service hold binding id");
  const attributionId = canonicalUuid(row.attribution_id, "service attribution id");
  const segmentId = canonicalUuid(row.segment_id, "service segment id");
  const originQuoteHash = canonicalHash(row.origin_quote_hash, "service quote hash");
  const snapshotHash = canonicalHash(row.snapshot_hash, "service snapshot hash");

  if (tenantId !== input.tenantId || paymentReceiptSnapshotId !== input.paymentReceiptSnapshotId ||
      serviceProvisionSnapshotId !== input.serviceProvisionSnapshotId ||
      propertyNode !== input.propertyNode || reservationId !== input.reservationId ||
      paymentReceiptDate !== input.paymentReceiptDate ||
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
      currency !== serviceCurrency ||
      row.coverage_scope !== "full_attribution" ||
      paymentReceiptDate !== (booksDate < bankDate ? booksDate : bankDate) ||
      row.payment_receipt_source !== "governed_supplier_payment_receipt_record" ||
      row.legal_rule !== "CGST_ACT_13_2_EXPLANATION_II_PAYMENT_RECEIPT_DATE_INPUT_ONLY" ||
      row.service_provision_source !== "governed_service_provision_record" ||
      row.service_legal_rule !== "CGST_ACT_13_2_B_SERVICE_PROVISION_DATE_INPUT_ONLY") {
    throw conflict("payment-receipt evidence conflicts with complete service lineage");
  }

  let snapshot;
  try {
    snapshot = parsePositiveTaxAttributionSnapshot(row.attribution_snapshot);
  } catch {
    throw conflict("canonical positive-tax attribution is malformed");
  }
  if (snapshot.origin.kind !== "rate_quote" ||
      snapshot.origin.quoteHash !== originQuoteHash ||
      snapshot.snapshotHash !== snapshotHash || snapshot.currency !== currency ||
      snapshot.revenueLine.lineId !== "room" ||
      snapshot.revenueLine.revenueGroup !== "room_revenue" ||
      snapshot.evaluation.grandTotalMinor !== amountMinor) {
    throw conflict("payment-receipt evidence conflicts with canonical full attribution");
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
  const paymentReceiptSource = "governed_supplier_payment_receipt_record" as const;
  const paymentReceiptEvidenceSha256 = canonicalHash(
    row.payment_receipt_evidence_sha256,
    "payment-receipt evidence hash",
  );
  const legalRule = "CGST_ACT_13_2_EXPLANATION_II_PAYMENT_RECEIPT_DATE_INPUT_ONLY" as const;
  const evidence = Object.freeze({
    tenantId,
    paymentReceiptSnapshotId,
    propertyNode,
    serviceProvision,
    supplierBooksEntryDate: booksDate,
    supplierBankCreditDate: bankDate,
    paymentReceiptDate,
    coverageScope: "full_attribution" as const,
    amountMinor,
    currency,
    paymentReceiptSource,
    paymentReceiptEvidenceSha256,
    legalRule,
  });
  return Object.freeze({
    paymentReceiptSnapshotId,
    propertyNode,
    serviceProvision,
    supplierBooksEntryDate: booksDate,
    supplierBankCreditDate: bankDate,
    paymentReceiptDate,
    coverageScope: "full_attribution" as const,
    amountMinor,
    currency,
    paymentReceiptSource,
    paymentReceiptEvidenceSha256,
    legalRule,
    evidenceHash: sha256(evidence),
  });
}

async function readExactPaymentReceiptDate(
  tx: Tx,
  input: IndiaGstAccommodationPaymentReceiptDateInput,
): Promise<IndiaGstAccommodationPaymentReceiptDateResult> {
  const rows = await tx<PaymentReceiptRow[]>`
    SELECT receipt.tenant_id::text AS tenant_id,
           receipt.id::text AS id,
           receipt.service_provision_snapshot_id::text AS service_provision_snapshot_id,
           receipt.currency::text AS currency,
           receipt.amount_minor::text AS amount_minor,
           receipt.coverage_scope,
           receipt.supplier_books_entry_date::text AS supplier_books_entry_date,
           receipt.supplier_bank_credit_date::text AS supplier_bank_credit_date,
           receipt.payment_receipt_date::text AS payment_receipt_date,
           receipt.payment_receipt_source,
           receipt.payment_receipt_evidence_sha256,
           receipt.legal_rule,
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
      FROM public.india_gst_accommodation_payment_receipt_snapshot AS receipt
      JOIN public.india_gst_accommodation_service_provision_snapshot AS service_date
        ON service_date.tenant_id = receipt.tenant_id
       AND service_date.id = receipt.service_provision_snapshot_id
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
     WHERE receipt.tenant_id = ${input.tenantId}::uuid
       AND receipt.tenant_id = current_setting('app.tenant_id', true)::uuid
       AND receipt.id = ${input.paymentReceiptSnapshotId}::uuid
       AND receipt.service_provision_snapshot_id = ${input.serviceProvisionSnapshotId}::uuid
       AND receipt.payment_receipt_date = ${input.paymentReceiptDate}::date
       AND service_date.property_node = ${input.propertyNode}::uuid
       AND service_date.reservation_id = ${input.reservationId}::uuid
       AND receipt.coverage_scope = 'full_attribution'
       AND receipt.payment_receipt_source = 'governed_supplier_payment_receipt_record'
       AND receipt.legal_rule = 'CGST_ACT_13_2_EXPLANATION_II_PAYMENT_RECEIPT_DATE_INPUT_ONLY'
       AND service_date.service_provision_source = 'governed_service_provision_record'
       AND service_date.legal_rule = 'CGST_ACT_13_2_B_SERVICE_PROVISION_DATE_INPUT_ONLY'
  `;
  if (rows.length === 0) {
    throw new IndiaGstAccommodationPaymentReceiptDateNotFoundError(
      "selected India GST accommodation payment-receipt date is unavailable",
    );
  }
  if (rows.length !== 1 || rows[0] === undefined) {
    throw conflict("selected accommodation payment-receipt date is ambiguous");
  }
  return canonicalResult(rows[0], input);
}

export class IndiaGstAccommodationPaymentReceiptDateService {
  async resolve(
    tx: Tx,
    input: IndiaGstAccommodationPaymentReceiptDateInput,
  ): Promise<IndiaGstAccommodationPaymentReceiptDateResult> {
    if (typeof tx !== "function") {
      throw new IndiaGstAccommodationPaymentReceiptDateValidationError(
        "tenant transaction is unavailable",
      );
    }
    return readExactPaymentReceiptDate(tx, normalizeInput(input));
  }
}
