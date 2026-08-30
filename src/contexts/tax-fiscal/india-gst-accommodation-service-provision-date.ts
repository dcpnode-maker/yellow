import { types as utilTypes } from "node:util";

import type { Tx } from "../../kernel";
import { parsePositiveTaxAttributionSnapshot } from "./attribution";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const DATE = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/;
const CURRENCY = /^[A-Z]{3}$/;
const INPUT_KEYS = [
  "tenantId",
  "propertyNode",
  "reservationId",
  "serviceProvisionSnapshotId",
  "serviceProvisionDate",
] as const;
const ROW_KEYS = [
  "tenant_id",
  "id",
  "property_node",
  "reservation_lineage_id",
  "hold_binding_id",
  "attribution_id",
  "reservation_id",
  "segment_id",
  "origin_quote_hash",
  "snapshot_hash",
  "currency",
  "service_provision_date",
  "service_provision_source",
  "service_provision_evidence_sha256",
  "legal_rule",
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

interface ServiceProvisionRow {
  readonly tenant_id: string;
  readonly id: string;
  readonly property_node: string;
  readonly reservation_lineage_id: string;
  readonly hold_binding_id: string;
  readonly attribution_id: string;
  readonly reservation_id: string;
  readonly segment_id: string;
  readonly origin_quote_hash: string;
  readonly snapshot_hash: string;
  readonly currency: string;
  readonly service_provision_date: string;
  readonly service_provision_source: string;
  readonly service_provision_evidence_sha256: string;
  readonly legal_rule: string;
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

export interface IndiaGstAccommodationServiceProvisionDateInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly reservationId: string;
  readonly serviceProvisionSnapshotId: string;
  readonly serviceProvisionDate: string;
}

export interface IndiaGstAccommodationServiceProvisionDateResult {
  readonly serviceProvisionSnapshotId: string;
  readonly propertyNode: string;
  readonly reservationLineage: ReservationLineageEvidence;
  readonly attribution: Readonly<{
    originKind: "rate_quote";
    lineId: "room";
    revenueGroup: "room_revenue";
  }>;
  readonly serviceProvisionDate: string;
  readonly serviceProvisionSource: "governed_service_provision_record";
  readonly serviceProvisionEvidenceSha256: string;
  readonly legalRule: "CGST_ACT_13_2_B_SERVICE_PROVISION_DATE_INPUT_ONLY";
  readonly evidenceHash: string;
}

export class IndiaGstAccommodationServiceProvisionDateValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaGstAccommodationServiceProvisionDateValidationError";
  }
}

export class IndiaGstAccommodationServiceProvisionDateNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaGstAccommodationServiceProvisionDateNotFoundError";
  }
}

export class IndiaGstAccommodationServiceProvisionDateConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaGstAccommodationServiceProvisionDateConflictError";
  }
}

function conflict(
  message: string,
): IndiaGstAccommodationServiceProvisionDateConflictError {
  return new IndiaGstAccommodationServiceProvisionDateConflictError(message);
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
      ? new IndiaGstAccommodationServiceProvisionDateValidationError(
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

function canonicalDate(value: unknown, subject: string, input = false): string {
  const invalid = (): Error => input
    ? new IndiaGstAccommodationServiceProvisionDateValidationError(
        `${subject} is invalid`,
      )
    : conflict(`${subject} is invalid`);
  if (typeof value !== "string") {
    throw invalid();
  }
  const match = DATE.exec(value);
  if (match === null) {
    throw invalid();
  }
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

function normalizeInput(
  value: unknown,
): IndiaGstAccommodationServiceProvisionDateInput {
  const input = exactRecord(
    value,
    INPUT_KEYS,
    "India GST accommodation service-provision-date input",
    (message) => new IndiaGstAccommodationServiceProvisionDateValidationError(message),
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
    serviceProvisionDate: canonicalDate(
      input.serviceProvisionDate,
      "serviceProvisionDate",
      true,
    ),
  });
}

function canonicalResult(
  candidate: unknown,
  input: IndiaGstAccommodationServiceProvisionDateInput,
): IndiaGstAccommodationServiceProvisionDateResult {
  const row = exactRecord(
    candidate,
    ROW_KEYS,
    "stored India GST accommodation service-provision-date row",
    conflict,
  ) as unknown as ServiceProvisionRow;
  const tenantId = canonicalUuid(row.tenant_id, "stored tenant id");
  const serviceProvisionSnapshotId = canonicalUuid(
    row.id,
    "stored service-provision snapshot id",
  );
  const propertyNode = canonicalUuid(row.property_node, "stored property node");
  const reservationLineageId = canonicalUuid(
    row.reservation_lineage_id,
    "stored reservation lineage id",
  );
  const holdBindingId = canonicalUuid(row.hold_binding_id, "stored hold binding id");
  const attributionId = canonicalUuid(row.attribution_id, "stored attribution id");
  const reservationId = canonicalUuid(row.reservation_id, "stored reservation id");
  const segmentId = canonicalUuid(row.segment_id, "stored segment id");
  const originQuoteHash = canonicalHash(row.origin_quote_hash, "stored quote hash");
  const snapshotHash = canonicalHash(row.snapshot_hash, "stored snapshot hash");
  const currency = canonicalCurrency(row.currency, "stored currency");
  const serviceProvisionDate = canonicalDate(
    row.service_provision_date,
    "stored service-provision date",
  );

  if (tenantId !== input.tenantId || propertyNode !== input.propertyNode ||
      reservationId !== input.reservationId ||
      serviceProvisionSnapshotId !== input.serviceProvisionSnapshotId ||
      serviceProvisionDate !== input.serviceProvisionDate ||
      reservationLineageId !== canonicalUuid(row.lineage_id, "lineage id") ||
      propertyNode !== canonicalUuid(row.lineage_property_node, "lineage property node") ||
      holdBindingId !== canonicalUuid(row.lineage_hold_binding_id, "lineage hold binding id") ||
      attributionId !== canonicalUuid(row.lineage_attribution_id, "lineage attribution id") ||
      reservationId !== canonicalUuid(row.lineage_reservation_id, "lineage reservation id") ||
      segmentId !== canonicalUuid(row.lineage_segment_id, "lineage segment id") ||
      originQuoteHash !== canonicalHash(row.lineage_origin_quote_hash, "lineage quote hash") ||
      snapshotHash !== canonicalHash(row.lineage_snapshot_hash, "lineage snapshot hash") ||
      currency !== canonicalCurrency(row.lineage_currency, "lineage currency") ||
      row.service_provision_source !== "governed_service_provision_record" ||
      row.legal_rule !== "CGST_ACT_13_2_B_SERVICE_PROVISION_DATE_INPUT_ONLY") {
    throw conflict("service-provision evidence conflicts with reservation lineage");
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
      snapshot.revenueLine.revenueGroup !== "room_revenue") {
    throw conflict("canonical positive-tax attribution conflicts with reservation lineage");
  }

  const reservationLineage = Object.freeze({
    lineageId: reservationLineageId,
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
  const serviceProvisionSource = "governed_service_provision_record" as const;
  const serviceProvisionEvidenceSha256 = canonicalHash(
    row.service_provision_evidence_sha256,
    "service-provision evidence hash",
  );
  const legalRule = "CGST_ACT_13_2_B_SERVICE_PROVISION_DATE_INPUT_ONLY" as const;
  const evidence = Object.freeze({
    tenantId,
    serviceProvisionSnapshotId,
    propertyNode,
    reservationLineage,
    attribution,
    serviceProvisionDate,
    serviceProvisionSource,
    serviceProvisionEvidenceSha256,
    legalRule,
  });
  return Object.freeze({
    serviceProvisionSnapshotId,
    propertyNode,
    reservationLineage,
    attribution,
    serviceProvisionDate,
    serviceProvisionSource,
    serviceProvisionEvidenceSha256,
    legalRule,
    evidenceHash: sha256(evidence),
  });
}

async function readExactServiceProvisionDate(
  tx: Tx,
  input: IndiaGstAccommodationServiceProvisionDateInput,
): Promise<IndiaGstAccommodationServiceProvisionDateResult> {
  const rows = await tx<ServiceProvisionRow[]>`
    SELECT service_date.tenant_id::text AS tenant_id,
           service_date.id::text AS id,
           service_date.property_node::text AS property_node,
           service_date.reservation_lineage_id::text AS reservation_lineage_id,
           service_date.hold_binding_id::text AS hold_binding_id,
           service_date.attribution_id::text AS attribution_id,
           service_date.reservation_id::text AS reservation_id,
           service_date.segment_id::text AS segment_id,
           service_date.origin_quote_hash,
           service_date.snapshot_hash,
           service_date.currency::text AS currency,
           service_date.service_provision_date::text AS service_provision_date,
           service_date.service_provision_source,
           service_date.service_provision_evidence_sha256,
           service_date.legal_rule,
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
      FROM public.india_gst_accommodation_service_provision_snapshot AS service_date
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
     WHERE service_date.tenant_id = ${input.tenantId}::uuid
       AND service_date.tenant_id = current_setting('app.tenant_id', true)::uuid
       AND service_date.id = ${input.serviceProvisionSnapshotId}::uuid
       AND service_date.property_node = ${input.propertyNode}::uuid
       AND service_date.reservation_id = ${input.reservationId}::uuid
       AND service_date.service_provision_date = ${input.serviceProvisionDate}::date
       AND service_date.service_provision_source = 'governed_service_provision_record'
       AND service_date.legal_rule = 'CGST_ACT_13_2_B_SERVICE_PROVISION_DATE_INPUT_ONLY'
  `;
  if (rows.length === 0) {
    throw new IndiaGstAccommodationServiceProvisionDateNotFoundError(
      "selected India GST accommodation service-provision date is unavailable",
    );
  }
  if (rows.length !== 1 || rows[0] === undefined) {
    throw conflict("selected accommodation service-provision date is ambiguous");
  }
  return canonicalResult(rows[0], input);
}

export class IndiaGstAccommodationServiceProvisionDateService {
  async resolve(
    tx: Tx,
    input: IndiaGstAccommodationServiceProvisionDateInput,
  ): Promise<IndiaGstAccommodationServiceProvisionDateResult> {
    if (typeof tx !== "function") {
      throw new IndiaGstAccommodationServiceProvisionDateValidationError(
        "tenant transaction is unavailable",
      );
    }
    return readExactServiceProvisionDate(tx, normalizeInput(input));
  }
}
