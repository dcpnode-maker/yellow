import { types as utilTypes } from "node:util";
import type { Tx } from "../../kernel";
import { parsePositiveTaxAttributionSnapshot } from "./attribution";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const INPUT_KEYS = [
  "tenantId",
  "propertyNode",
  "reservationId",
  "serviceProvisionSnapshotId",
  "invoiceIssueSnapshotId",
  "serviceProvisionDate",
  "invoiceIssueDate",
  "ordinaryRegimeSource",
  "ordinaryRegimeEvidenceSha256",
] as const;

export type IndiaGstAccommodationInvoiceTimeliness = "timely" | "late";
export interface IndiaGstAccommodationInvoiceTimelinessInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly reservationId: string;
  readonly serviceProvisionSnapshotId: string;
  readonly invoiceIssueSnapshotId: string;
  readonly serviceProvisionDate: string;
  readonly invoiceIssueDate: string;
  readonly ordinaryRegimeSource: string;
  readonly ordinaryRegimeEvidenceSha256: string;
}
export interface IndiaGstAccommodationInvoiceTimelinessResult {
  readonly invoiceIssueSnapshotId: string;
  readonly serviceProvisionSnapshotId: string;
  readonly propertyNode: string;
  readonly serviceProvisionDate: string;
  readonly invoiceIssueDate: string;
  readonly deadlineDate: string;
  readonly regime: "ordinary_rule47_30_day";
  readonly source: "governed_rule47_ordinary_regime_record";
  readonly legalRule: "CGST_RULE_47_ORDINARY_SERVICE_INVOICE_30_DAY_INPUT";
  readonly ordinaryRegimeEvidenceSha256: string;
  readonly result: IndiaGstAccommodationInvoiceTimeliness;
  readonly amountMinor: string;
  readonly currency: string;
  readonly evidenceHash: string;
}
export class IndiaGstAccommodationInvoiceTimelinessValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaGstAccommodationInvoiceTimelinessValidationError";
  }
}
export class IndiaGstAccommodationInvoiceTimelinessNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaGstAccommodationInvoiceTimelinessNotFoundError";
  }
}
export class IndiaGstAccommodationInvoiceTimelinessConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndiaGstAccommodationInvoiceTimelinessConflictError";
  }
}
type Row = Record<string, unknown>;

function exactRecord(
  value: unknown,
  keys: readonly string[],
  subject: string,
  ErrorType = IndiaGstAccommodationInvoiceTimelinessValidationError,
): Row {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    utilTypes.isProxy(value) ||
    Object.getOwnPropertySymbols(value).length !== 0 ||
    (Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null)
  )
    throw new ErrorType(`${subject} must be an exact plain object`);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const actual = Object.keys(descriptors).sort();
  const expected = [...keys].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index]) ||
    Object.values(descriptors).some(
      (descriptor) =>
        descriptor.get !== undefined ||
        descriptor.set !== undefined ||
        descriptor.enumerable !== true ||
        !("value" in descriptor),
    )
  )
    throw new ErrorType(`${subject} shape is invalid`);
  return value as Row;
}
function uuid(
  value: unknown,
  subject: string,
  ErrorType = IndiaGstAccommodationInvoiceTimelinessConflictError,
): string {
  if (typeof value !== "string" || !UUID.test(value))
    throw new ErrorType(`${subject} is invalid`);
  return value;
}
function hash(value: unknown, subject: string): string {
  if (typeof value !== "string" || !SHA256.test(value))
    throw new IndiaGstAccommodationInvoiceTimelinessConflictError(
      `${subject} is invalid`,
    );
  return value;
}
function date(
  value: unknown,
  subject: string,
  ErrorType = IndiaGstAccommodationInvoiceTimelinessConflictError,
): string {
  if (typeof value !== "string" || !DATE.test(value))
    throw new ErrorType(`${subject} is invalid`);
  const match = DATE.exec(value)!;
  const year = +match[1]!,
    month = +match[2]!,
    day = +match[3]!,
    leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0),
    days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (
    year === 0 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > (days[month - 1] ?? 0)
  )
    throw new ErrorType(`${subject} is invalid`);
  return value;
}
function digest(value: unknown): string {
  return new Bun.CryptoHasher("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}
function addDays(value: string, days: number): string {
  const [year, month, day] = value.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const result = new Date(Date.UTC(year, month - 1, day + days));
  return `${String(result.getUTCFullYear()).padStart(4, "0")}-${String(result.getUTCMonth() + 1).padStart(2, "0")}-${String(result.getUTCDate()).padStart(2, "0")}`;
}

const ROW_KEYS = [
  "tenant_id",
  "invoice_issue_snapshot_id",
  "service_provision_snapshot_id",
  "property_node",
  "reservation_id",
  "service_provision_date",
  "invoice_issue_date",
  "currency",
  "amount_minor",
  "coverage_scope",
  "invoice_issue_source",
  "invoice_issue_evidence_sha256",
  "invoice_legal_rule",
  "service_provision_source",
  "service_provision_evidence_sha256",
  "service_legal_rule",
  "reservation_lineage_id",
  "hold_binding_id",
  "attribution_id",
  "segment_id",
  "origin_quote_hash",
  "snapshot_hash",
  "service_currency",
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

function build(
  row: Row,
  input: IndiaGstAccommodationInvoiceTimelinessInput,
): IndiaGstAccommodationInvoiceTimelinessResult {
  row = exactRecord(
    row,
    ROW_KEYS,
    "stored invoice timeliness row",
    IndiaGstAccommodationInvoiceTimelinessConflictError,
  );
  const tenant = uuid(row.tenant_id, "stored tenant"),
    property = uuid(row.property_node, "stored property"),
    reservation = uuid(row.reservation_id, "stored reservation"),
    serviceId = uuid(
      row.service_provision_snapshot_id,
      "stored service snapshot",
    ),
    invoiceId = uuid(row.invoice_issue_snapshot_id, "stored invoice snapshot");
  const serviceDate = date(row.service_provision_date, "stored service date"),
    invoiceDate = date(row.invoice_issue_date, "stored invoice date");
  const lineageKeys = [
    "reservation_lineage_id",
    "hold_binding_id",
    "attribution_id",
    "reservation_id",
    "segment_id",
    "origin_quote_hash",
    "snapshot_hash",
    "currency",
  ] as const;
  for (const key of lineageKeys) {
    if (key.endsWith("_hash")) hash(row[key], `stored ${key}`);
    else if (key !== "currency") uuid(row[key], `stored ${key}`);
  }
  hash(row.invoice_issue_evidence_sha256, "stored invoice evidence hash");
  hash(row.service_provision_evidence_sha256, "stored service evidence hash");
  if (
    tenant !== input.tenantId ||
    property !== input.propertyNode ||
    reservation !== input.reservationId ||
    serviceId !== input.serviceProvisionSnapshotId ||
    invoiceId !== input.invoiceIssueSnapshotId ||
    serviceDate !== input.serviceProvisionDate ||
    invoiceDate !== input.invoiceIssueDate ||
    row.reservation_lineage_id !== row.lineage_id ||
    row.property_node !== row.lineage_property_node ||
    row.hold_binding_id !== row.lineage_hold_binding_id ||
    row.attribution_id !== row.lineage_attribution_id ||
    row.reservation_id !== row.lineage_reservation_id ||
    row.segment_id !== row.lineage_segment_id ||
    row.origin_quote_hash !== row.lineage_origin_quote_hash ||
    row.snapshot_hash !== row.lineage_snapshot_hash ||
    row.currency !== row.service_currency ||
    row.currency !== row.lineage_currency ||
    row.coverage_scope !== "full_attribution" ||
    row.invoice_issue_source !== "governed_supplier_tax_invoice_record" ||
    row.invoice_legal_rule !== "CGST_ACT_13_2_INVOICE_DATE_INPUT_ONLY" ||
    row.service_provision_source !== "governed_service_provision_record" ||
    row.service_legal_rule !==
      "CGST_ACT_13_2_B_SERVICE_PROVISION_DATE_INPUT_ONLY"
  )
    throw new IndiaGstAccommodationInvoiceTimelinessConflictError(
      "evidence conflicts with complete lineage",
    );
  hash(input.ordinaryRegimeEvidenceSha256, "ordinary regime evidence");
  try {
    const attribution = parsePositiveTaxAttributionSnapshot(
      row.attribution_snapshot,
    );
    if (
      attribution.origin.kind !== "rate_quote" ||
      attribution.origin.quoteHash !== row.origin_quote_hash ||
      attribution.snapshotHash !== row.snapshot_hash ||
      attribution.currency !== row.currency ||
      attribution.revenueLine.lineId !== "room" ||
      attribution.revenueLine.revenueGroup !== "room_revenue" ||
      attribution.evaluation.grandTotalMinor.toString() !==
        String(row.amount_minor)
    )
      throw new Error();
  } catch {
    throw new IndiaGstAccommodationInvoiceTimelinessConflictError(
      "canonical attribution is malformed",
    );
  }
  const deadlineDate = addDays(serviceDate, 30);
  const evidence = {
    invoiceIssueSnapshotId: invoiceId,
    serviceProvisionSnapshotId: serviceId,
    propertyNode: property,
    serviceProvisionDate: serviceDate,
    invoiceIssueDate: invoiceDate,
    deadlineDate,
    regime: "ordinary_rule47_30_day" as const,
    source: "governed_rule47_ordinary_regime_record" as const,
    legalRule: "CGST_RULE_47_ORDINARY_SERVICE_INVOICE_30_DAY_INPUT" as const,
    ordinaryRegimeEvidenceSha256: input.ordinaryRegimeEvidenceSha256,
    result: (invoiceDate <= deadlineDate
      ? "timely"
      : "late") as IndiaGstAccommodationInvoiceTimeliness,
    amountMinor: String(row.amount_minor),
    currency: String(row.currency),
  };
  return Object.freeze({
    ...evidence,
    evidenceHash: digest({ tenantId: tenant, ...evidence }),
  });
}

export class IndiaGstAccommodationInvoiceTimelinessService {
  async resolve(
    tx: Tx,
    rawInput: IndiaGstAccommodationInvoiceTimelinessInput,
  ): Promise<IndiaGstAccommodationInvoiceTimelinessResult> {
    if (typeof tx !== "function")
      throw new IndiaGstAccommodationInvoiceTimelinessValidationError(
        "tenant transaction is unavailable",
      );
    const input = exactRecord(
      rawInput,
      INPUT_KEYS,
      "invoice timeliness input",
    ) as unknown as IndiaGstAccommodationInvoiceTimelinessInput;
    const tenant = uuid(
        input.tenantId,
        "tenantId",
        IndiaGstAccommodationInvoiceTimelinessValidationError,
      ),
      property = uuid(
        input.propertyNode,
        "propertyNode",
        IndiaGstAccommodationInvoiceTimelinessValidationError,
      ),
      reservation = uuid(
        input.reservationId,
        "reservationId",
        IndiaGstAccommodationInvoiceTimelinessValidationError,
      ),
      serviceId = uuid(
        input.serviceProvisionSnapshotId,
        "serviceProvisionSnapshotId",
        IndiaGstAccommodationInvoiceTimelinessValidationError,
      ),
      invoiceId = uuid(
        input.invoiceIssueSnapshotId,
        "invoiceIssueSnapshotId",
        IndiaGstAccommodationInvoiceTimelinessValidationError,
      );
    date(
      input.serviceProvisionDate,
      "serviceProvisionDate",
      IndiaGstAccommodationInvoiceTimelinessValidationError,
    );
    date(
      input.invoiceIssueDate,
      "invoiceIssueDate",
      IndiaGstAccommodationInvoiceTimelinessValidationError,
    );
    if (!SHA256.test(input.ordinaryRegimeEvidenceSha256))
      throw new IndiaGstAccommodationInvoiceTimelinessValidationError(
        "ordinaryRegimeEvidenceSha256 is invalid",
      );
    if (input.ordinaryRegimeSource !== "governed_rule47_ordinary_regime_record")
      throw new IndiaGstAccommodationInvoiceTimelinessValidationError(
        "unsupported regime",
      );
    const rows = await tx<
      Row[]
    >`SELECT invoice.id::text AS invoice_issue_snapshot_id, invoice.service_provision_snapshot_id::text AS service_provision_snapshot_id, invoice.tenant_id::text AS tenant_id, service_date.property_node::text AS property_node, service_date.reservation_id::text AS reservation_id, service_date.service_provision_date::text AS service_provision_date, invoice.invoice_issue_date::text AS invoice_issue_date, invoice.currency::text AS currency, invoice.amount_minor::text AS amount_minor, invoice.coverage_scope, invoice.invoice_issue_source, invoice.invoice_issue_evidence_sha256, invoice.legal_rule AS invoice_legal_rule, service_date.service_provision_source, service_date.service_provision_evidence_sha256, service_date.legal_rule AS service_legal_rule, service_date.reservation_lineage_id::text AS reservation_lineage_id, service_date.hold_binding_id::text AS hold_binding_id, service_date.attribution_id::text AS attribution_id, service_date.segment_id::text AS segment_id, service_date.origin_quote_hash, service_date.snapshot_hash, service_date.currency::text AS service_currency, lineage.id::text AS lineage_id, lineage.property_node::text AS lineage_property_node, lineage.binding_id::text AS lineage_hold_binding_id, lineage.attribution_id::text AS lineage_attribution_id, lineage.reservation_id::text AS lineage_reservation_id, lineage.segment_id::text AS lineage_segment_id, lineage.origin_quote_hash AS lineage_origin_quote_hash, lineage.snapshot_hash AS lineage_snapshot_hash, lineage.currency::text AS lineage_currency, attribution.snapshot AS attribution_snapshot FROM public.india_gst_accommodation_invoice_issue_snapshot AS invoice JOIN public.india_gst_accommodation_service_provision_snapshot AS service_date ON service_date.tenant_id = invoice.tenant_id AND service_date.id = invoice.service_provision_snapshot_id JOIN public.tax_attribution_reservation_binding AS lineage ON lineage.tenant_id = service_date.tenant_id AND lineage.id = service_date.reservation_lineage_id JOIN public.tax_attribution_snapshot AS attribution ON attribution.tenant_id = service_date.tenant_id AND attribution.id = service_date.attribution_id WHERE invoice.tenant_id = ${tenant}::uuid AND invoice.tenant_id = current_setting('app.tenant_id', true)::uuid AND invoice.id = ${invoiceId}::uuid AND invoice.service_provision_snapshot_id = ${serviceId}::uuid AND service_date.property_node = ${property}::uuid AND service_date.reservation_id = ${reservation}::uuid AND service_date.service_provision_date = ${input.serviceProvisionDate}::date AND invoice.invoice_issue_date = ${input.invoiceIssueDate}::date AND invoice.coverage_scope = 'full_attribution' AND invoice.invoice_issue_source = 'governed_supplier_tax_invoice_record' AND invoice.legal_rule = 'CGST_ACT_13_2_INVOICE_DATE_INPUT_ONLY' AND service_date.service_provision_source = 'governed_service_provision_record' AND service_date.legal_rule = 'CGST_ACT_13_2_B_SERVICE_PROVISION_DATE_INPUT_ONLY'`;
    if (rows.length === 0)
      throw new IndiaGstAccommodationInvoiceTimelinessNotFoundError(
        "selected invoice timeliness evidence is unavailable",
      );
    if (rows.length !== 1 || rows[0] === undefined)
      throw new IndiaGstAccommodationInvoiceTimelinessConflictError(
        "selected invoice timeliness evidence is ambiguous",
      );
    return build(rows[0], input);
  }
}

export function resolveIndiaGstAccommodationInvoiceTimeliness(
  tx: Tx,
  input: IndiaGstAccommodationInvoiceTimelinessInput,
): Promise<IndiaGstAccommodationInvoiceTimelinessResult> {
  return new IndiaGstAccommodationInvoiceTimelinessService().resolve(tx, input);
}
