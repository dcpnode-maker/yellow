import { types as utilTypes } from "node:util";

import type { AuditEnvelope, Tx } from "../../kernel";
import {
  IndiaGstAccommodationPaymentReceiptDateService,
  type IndiaGstAccommodationPaymentReceiptDateResult,
} from "./india-gst-accommodation-payment-receipt-date";
import {
  IndiaGstAccommodationServiceProvisionDateService,
  type IndiaGstAccommodationServiceProvisionDateResult,
} from "./india-gst-accommodation-service-provision-date";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const DATE = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/;
const POSITIVE_INTEGER = /^[1-9][0-9]*$/;
const IDEMPOTENCY_KEY = /^[\x21-\x7e]{8,200}$/;
const MAX_BIGINT = 9_223_372_036_854_775_807n;

const SERVICE_EVENT = "india_gst.accommodation_service_provision_recorded";
const SERVICE_SOURCE = "governed_service_provision_record";
const SERVICE_LEGAL_RULE = "CGST_ACT_13_2_B_SERVICE_PROVISION_DATE_INPUT_ONLY";
const PAYMENT_EVENT = "india_gst.accommodation_payment_receipt_recorded";
const PAYMENT_SOURCE = "governed_supplier_payment_receipt_record";
const PAYMENT_LEGAL_RULE = "CGST_ACT_13_2_EXPLANATION_II_PAYMENT_RECEIPT_DATE_INPUT_ONLY";

const SERVICE_KEYS = [
  "tenantId", "propertyNode", "reservationId", "reservationLineageId",
  "serviceProvisionDate", "serviceProvisionSource", "serviceProvisionEvidenceSha256",
  "legalRule", "idempotencyKey", "envelope",
] as const;
const PAYMENT_KEYS = [
  "tenantId", "propertyNode", "reservationId", "serviceProvisionSnapshotId",
  "amountMinor", "currency", "coverageScope", "supplierBooksEntryDate",
  "supplierBankCreditDate", "paymentReceiptSource", "paymentReceiptEvidenceSha256",
  "legalRule", "idempotencyKey", "envelope",
] as const;

export interface IndiaGstAccommodationServiceProvisionIntakeInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly reservationId: string;
  readonly reservationLineageId: string;
  readonly serviceProvisionDate: string;
  readonly serviceProvisionSource: typeof SERVICE_SOURCE;
  readonly serviceProvisionEvidenceSha256: string;
  readonly legalRule: typeof SERVICE_LEGAL_RULE;
  readonly idempotencyKey: string;
  readonly envelope: AuditEnvelope;
}

export interface IndiaGstAccommodationPaymentReceiptIntakeInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly reservationId: string;
  readonly serviceProvisionSnapshotId: string;
  readonly amountMinor: string;
  readonly currency: "INR";
  readonly coverageScope: "full_attribution";
  readonly supplierBooksEntryDate: string;
  readonly supplierBankCreditDate: string;
  readonly paymentReceiptSource: typeof PAYMENT_SOURCE;
  readonly paymentReceiptEvidenceSha256: string;
  readonly legalRule: typeof PAYMENT_LEGAL_RULE;
  readonly idempotencyKey: string;
  readonly envelope: AuditEnvelope;
}

export interface IndiaGstAccommodationServiceProvisionIntakeResult {
  readonly serviceProvision: IndiaGstAccommodationServiceProvisionDateResult;
  readonly evidenceHash: string;
  readonly created: boolean;
  readonly replayed: boolean;
}

export interface IndiaGstAccommodationPaymentReceiptIntakeResult {
  readonly paymentReceipt: IndiaGstAccommodationPaymentReceiptDateResult;
  readonly evidenceHash: string;
  readonly created: boolean;
  readonly replayed: boolean;
}

export class IndiaGstAccommodationSourceIntakeValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaGstAccommodationSourceIntakeValidationError";
  }
}

export class IndiaGstAccommodationSourceIntakeNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaGstAccommodationSourceIntakeNotFoundError";
  }
}

export class IndiaGstAccommodationSourceIntakeConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaGstAccommodationSourceIntakeConflictError";
  }
}

interface ServiceCapabilityRow {
  readonly service_provision_snapshot_id: string;
  readonly service_provision_evidence_sha256: string;
  readonly evidence_hash: string;
  readonly created: boolean;
}

interface PaymentCapabilityRow {
  readonly payment_receipt_snapshot_id: string;
  readonly payment_receipt_evidence_sha256: string;
  readonly evidence_hash: string;
  readonly created: boolean;
}

function fail(message: string): never {
  throw new IndiaGstAccommodationSourceIntakeValidationError(message);
}

function exact(value: unknown, keys: readonly string[], subject: string): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value) || utilTypes.isProxy(value)
      || Object.getOwnPropertySymbols(value).length !== 0
      || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    fail(`${subject} must be an exact plain record`);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const actual = Object.keys(descriptors).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])
      || Object.values(descriptors).some((descriptor) => descriptor.get !== undefined
        || descriptor.set !== undefined || descriptor.enumerable !== true || !("value" in descriptor))) {
    fail(`${subject} shape is invalid`);
  }
}

function deeplyFrozen(value: unknown, subject: string, seen = new Set<object>()): void {
  if (value === null || typeof value === "string" || typeof value === "boolean"
      || (typeof value === "number" && Number.isFinite(value))) return;
  if (typeof value !== "object" || utilTypes.isProxy(value) || !Object.isFrozen(value)
      || Object.getOwnPropertySymbols(value).length !== 0) {
    fail(`${subject} must be an exact deeply frozen graph`);
  }
  if (seen.has(value)) return;
  seen.add(value);
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype
      && Object.getPrototypeOf(value) !== null) {
    fail(`${subject} must contain only plain records`);
  }
  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
    if (Array.isArray(value) && key === "length") continue;
    if (descriptor.get !== undefined || descriptor.set !== undefined || descriptor.enumerable !== true
        || descriptor.configurable !== false || !("value" in descriptor) || descriptor.writable !== false) {
      fail(`${subject} contains invalid descriptors`);
    }
    deeplyFrozen(descriptor.value, subject, seen);
  }
}

function uuid(value: unknown, subject: string): string {
  if (typeof value !== "string" || !UUID.test(value)) fail(`${subject} must be a lowercase UUID`);
  return value;
}

function hash(value: unknown, subject: string): string {
  if (typeof value !== "string" || !SHA256.test(value)) fail(`${subject} must be lowercase SHA-256`);
  return value;
}

function date(value: unknown, subject: string): string {
  if (typeof value !== "string") fail(`${subject} must be a calendar date`);
  const match = DATE.exec(value);
  if (!match) fail(`${subject} must be a calendar date`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const maximum = days[month - 1];
  if (year === 0 || maximum === undefined || day === 0 || day > maximum) {
    fail(`${subject} must be a calendar date`);
  }
  return value;
}

function positiveMoney(value: unknown, subject: string): string {
  if (typeof value !== "string" || !POSITIVE_INTEGER.test(value) || BigInt(value) > MAX_BIGINT) {
    fail(`${subject} must be positive signed-64-bit minor units`);
  }
  return value;
}

function idempotencyKey(value: unknown): string {
  if (typeof value !== "string" || !IDEMPOTENCY_KEY.test(value)) fail("idempotencyKey is invalid");
  return value;
}

function auditEnvelope(value: unknown, tenantId: string, propertyNode: string, operation: string): AuditEnvelope {
  exact(value, ["actorId", "tenantId", "propertyNode", "requestId", "operation"], "audit envelope");
  const actorId = uuid(value.actorId, "envelope.actorId");
  const requestId = uuid(value.requestId, "envelope.requestId");
  if (value.tenantId !== tenantId || value.propertyNode !== propertyNode || value.operation !== operation) {
    fail("audit envelope is invalid");
  }
  return value as unknown as AuditEnvelope & { readonly actorId: typeof actorId; readonly requestId: typeof requestId };
}

function mapDbError(error: unknown): never {
  if ((typeof error !== "object" || error === null) && typeof error !== "function") {
    throw error;
  }
  const shaped = error as {
    readonly errno?: unknown;
    readonly sqlState?: unknown;
    readonly code?: unknown;
  };
  const rawState = shaped.errno ?? shaped.sqlState ?? shaped.code;
  const code = typeof rawState === "string" || typeof rawState === "number"
    ? String(rawState)
    : undefined;
  if (code === "42501") {
    throw new IndiaGstAccommodationSourceIntakeNotFoundError("Accommodation source intake authority was not found");
  }
  if (code === "55000" || code === "23505" || code === "23503") {
    throw new IndiaGstAccommodationSourceIntakeConflictError("Accommodation source scope is stale or unavailable");
  }
  if (code === "22023" || code === "22003" || code === "23514") {
    throw new IndiaGstAccommodationSourceIntakeValidationError("Accommodation source evidence is invalid");
  }
  throw error;
}

export class IndiaGstAccommodationSourceIntakeService {
  async recordServiceProvision(
    tx: Tx,
    input: IndiaGstAccommodationServiceProvisionIntakeInput,
  ): Promise<IndiaGstAccommodationServiceProvisionIntakeResult> {
    if (typeof tx !== "function") fail("tenant transaction is unavailable");
    deeplyFrozen(input, "service-provision intake input");
    exact(input, SERVICE_KEYS, "service-provision intake input");
    const tenantId = uuid(input.tenantId, "tenantId");
    const propertyNode = uuid(input.propertyNode, "propertyNode");
    const reservationId = uuid(input.reservationId, "reservationId");
    const reservationLineageId = uuid(input.reservationLineageId, "reservationLineageId");
    const serviceProvisionDate = date(input.serviceProvisionDate, "serviceProvisionDate");
    const externalEvidence = hash(input.serviceProvisionEvidenceSha256, "serviceProvisionEvidenceSha256");
    if (input.serviceProvisionSource !== SERVICE_SOURCE || input.legalRule !== SERVICE_LEGAL_RULE) {
      fail("service-provision source or legal rule is unsupported");
    }
    const key = idempotencyKey(input.idempotencyKey);
    const envelope = auditEnvelope(input.envelope, tenantId, propertyNode, SERVICE_EVENT);
    const actorId = uuid(envelope.actorId, "envelope.actorId");
    const requestId = uuid(envelope.requestId, "envelope.requestId");
    try {
      const rows = await tx<ServiceCapabilityRow[]>`
        SELECT *
        FROM public.record_india_gst_accommodation_service_provision(
          ${tenantId}::uuid, ${propertyNode}::uuid, ${reservationId}::uuid,
          ${reservationLineageId}::uuid, ${serviceProvisionDate}::date,
          ${externalEvidence}, ${requestId}::uuid, ${actorId}::uuid, ${key}
        )
      `;
      const row = rows[0];
      if (rows.length !== 1 || !row || !UUID.test(row.service_provision_snapshot_id)
          || row.service_provision_evidence_sha256 !== externalEvidence
          || !SHA256.test(row.evidence_hash) || typeof row.created !== "boolean") {
        throw new IndiaGstAccommodationSourceIntakeConflictError(
          "Service-provision capability returned invalid evidence",
        );
      }
      const resolved = await new IndiaGstAccommodationServiceProvisionDateService().resolve(
        tx,
        Object.freeze({
          tenantId, propertyNode, reservationId,
          serviceProvisionSnapshotId: row.service_provision_snapshot_id,
          serviceProvisionDate,
        }),
      );
      if (resolved.reservationLineage.lineageId !== reservationLineageId
          || resolved.serviceProvisionEvidenceSha256 !== externalEvidence) {
        throw new IndiaGstAccommodationSourceIntakeConflictError(
          "Recorded service-provision evidence diverges from the governed request",
        );
      }
      return Object.freeze({
        serviceProvision: resolved,
        evidenceHash: row.evidence_hash,
        created: row.created,
        replayed: !row.created,
      });
    } catch (error) {
      return mapDbError(error);
    }
  }

  async recordPaymentReceipt(
    tx: Tx,
    input: IndiaGstAccommodationPaymentReceiptIntakeInput,
  ): Promise<IndiaGstAccommodationPaymentReceiptIntakeResult> {
    if (typeof tx !== "function") fail("tenant transaction is unavailable");
    deeplyFrozen(input, "payment-receipt intake input");
    exact(input, PAYMENT_KEYS, "payment-receipt intake input");
    const tenantId = uuid(input.tenantId, "tenantId");
    const propertyNode = uuid(input.propertyNode, "propertyNode");
    const reservationId = uuid(input.reservationId, "reservationId");
    const serviceProvisionSnapshotId = uuid(input.serviceProvisionSnapshotId, "serviceProvisionSnapshotId");
    const amountMinor = positiveMoney(input.amountMinor, "amountMinor");
    const supplierBooksEntryDate = date(input.supplierBooksEntryDate, "supplierBooksEntryDate");
    const supplierBankCreditDate = date(input.supplierBankCreditDate, "supplierBankCreditDate");
    const paymentReceiptDate = supplierBooksEntryDate < supplierBankCreditDate
      ? supplierBooksEntryDate
      : supplierBankCreditDate;
    const externalEvidence = hash(input.paymentReceiptEvidenceSha256, "paymentReceiptEvidenceSha256");
    if (input.currency !== "INR" || input.coverageScope !== "full_attribution"
        || input.paymentReceiptSource !== PAYMENT_SOURCE || input.legalRule !== PAYMENT_LEGAL_RULE) {
      fail("payment-receipt currency, coverage, source or legal rule is unsupported");
    }
    const key = idempotencyKey(input.idempotencyKey);
    const envelope = auditEnvelope(input.envelope, tenantId, propertyNode, PAYMENT_EVENT);
    const actorId = uuid(envelope.actorId, "envelope.actorId");
    const requestId = uuid(envelope.requestId, "envelope.requestId");
    try {
      const rows = await tx<PaymentCapabilityRow[]>`
        SELECT *
        FROM public.record_india_gst_accommodation_payment_receipt(
          ${tenantId}::uuid, ${propertyNode}::uuid, ${reservationId}::uuid,
          ${serviceProvisionSnapshotId}::uuid, ${BigInt(amountMinor)}::bigint,
          ${supplierBooksEntryDate}::date, ${supplierBankCreditDate}::date,
          ${externalEvidence}, ${requestId}::uuid, ${actorId}::uuid, ${key}
        )
      `;
      const row = rows[0];
      if (rows.length !== 1 || !row || !UUID.test(row.payment_receipt_snapshot_id)
          || row.payment_receipt_evidence_sha256 !== externalEvidence
          || !SHA256.test(row.evidence_hash) || typeof row.created !== "boolean") {
        throw new IndiaGstAccommodationSourceIntakeConflictError(
          "Payment-receipt capability returned invalid evidence",
        );
      }
      const resolved = await new IndiaGstAccommodationPaymentReceiptDateService().resolve(
        tx,
        Object.freeze({
          tenantId, propertyNode, reservationId, serviceProvisionSnapshotId,
          paymentReceiptSnapshotId: row.payment_receipt_snapshot_id,
          paymentReceiptDate,
        }),
      );
      if (resolved.amountMinor !== amountMinor
          || resolved.paymentReceiptEvidenceSha256 !== externalEvidence
          || resolved.supplierBooksEntryDate !== supplierBooksEntryDate
          || resolved.supplierBankCreditDate !== supplierBankCreditDate) {
        throw new IndiaGstAccommodationSourceIntakeConflictError(
          "Recorded payment-receipt evidence diverges from the governed request",
        );
      }
      return Object.freeze({
        paymentReceipt: resolved,
        evidenceHash: row.evidence_hash,
        created: row.created,
        replayed: !row.created,
      });
    } catch (error) {
      return mapDbError(error);
    }
  }
}
