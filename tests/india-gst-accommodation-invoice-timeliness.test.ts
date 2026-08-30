import { describe, expect, test } from "bun:test";
import {
  IndiaGstAccommodationInvoiceTimelinessConflictError,
  IndiaGstAccommodationInvoiceTimelinessNotFoundError,
  IndiaGstAccommodationInvoiceTimelinessService,
  IndiaGstAccommodationInvoiceTimelinessValidationError,
} from "../src/contexts/tax-fiscal";
import {
  createPositiveTaxAttributionSnapshot,
  type CreatePositiveTaxAttributionSnapshotInput,
} from "../src/contexts/tax-fiscal/attribution";
import type { Tx } from "../src/kernel";

const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const TENANT = id(29301), OTHER = id(29302), PROPERTY = id(29303), RESERVATION = id(29305);
const LINE = id(29306), HOLD = id(29307), ATTR = id(29308), SEGMENT = id(29309);
const SERVICE = id(29310), INVOICE = id(29311), OTHER_INVOICE = id(29312), EXTENSION = id(29313);
const QUOTE = "a".repeat(64), SERVICE_HASH = "b".repeat(64), SERVICE_EVIDENCE = "c".repeat(64);
const ORDINARY_SOURCE = "governed_rule47_ordinary_regime_record";
const ORDINARY_LEGAL = "CGST_RULE_47_ORDINARY_SERVICE_INVOICE_30_DAY_INPUT";

type Row = Record<string, unknown>;
type Mutable = Record<PropertyKey, unknown>;

const attribution = (overrides: Partial<CreatePositiveTaxAttributionSnapshotInput> = {}) =>
  createPositiveTaxAttributionSnapshot({
    origin: { kind: "rate_quote", quoteHash: QUOTE }, currency: "INR",
    line: { lineId: "room", revenueGroup: "room_revenue", amountMinor: 10000n, nights: 1, personNights: 2, roomNights: [{ businessDate: "2039-01-01", amountMinor: 10000n }] },
    assignments: [{ businessDate: "2039-01-01", jurisdictionKey: "in.order293.gst.27", evidenceRef: `tax-assignment:${QUOTE}` }],
    jurisdiction: { extensionId: EXTENSION, ownerTenantId: TENANT, key: "in.order293.gst.27", version: 7, contentHash: "d".repeat(64), evidenceRef: `tax-jurisdiction:${"e".repeat(64)}` },
    evaluation: { schemaVersion: 1, jurisdictionKey: "in.order293.gst.27", country: "IN", priceDisplay: "tax_exclusive", rounding: "line", inputTotalMinor: 10000n, baseTotalMinor: 10000n, taxTotalMinor: 500n, grandTotalMinor: 10500n, taxes: [{ code: "GST_ROOM", name: "GST", taxMinor: 500n, components: [{ lineId: "room", revenueGroup: "room_revenue", baseMinor: 10000n, taxMinor: 500n, rateBasisPoints: 500 }] }] },
    ...overrides,
  });

const row = (overrides: Row = {}): Row => {
  const snapshot = attribution();
  return {
    tenant_id: TENANT, invoice_issue_snapshot_id: INVOICE, service_provision_snapshot_id: SERVICE,
    property_node: PROPERTY, reservation_id: RESERVATION, service_provision_date: "2043-06-01",
    invoice_issue_date: "2043-07-01", currency: "INR", amount_minor: "10500", coverage_scope: "full_attribution",
    invoice_issue_source: "governed_supplier_tax_invoice_record",
    invoice_issue_evidence_sha256: "f".repeat(64), invoice_legal_rule: "CGST_ACT_13_2_INVOICE_DATE_INPUT_ONLY",
    service_provision_source: "governed_service_provision_record", service_provision_evidence_sha256: SERVICE_EVIDENCE,
    service_legal_rule: "CGST_ACT_13_2_B_SERVICE_PROVISION_DATE_INPUT_ONLY", reservation_lineage_id: LINE,
    hold_binding_id: HOLD, attribution_id: ATTR, segment_id: SEGMENT, origin_quote_hash: QUOTE,
    snapshot_hash: snapshot.snapshotHash, service_currency: "INR", lineage_id: LINE, lineage_property_node: PROPERTY,
    lineage_hold_binding_id: HOLD, lineage_attribution_id: ATTR, lineage_reservation_id: RESERVATION,
    lineage_segment_id: SEGMENT, lineage_origin_quote_hash: QUOTE, lineage_snapshot_hash: snapshot.snapshotHash,
    lineage_currency: "INR", attribution_snapshot: snapshot, ...overrides,
  };
};

const input = (overrides: Record<string, unknown> = {}) => ({
  tenantId: TENANT, propertyNode: PROPERTY, reservationId: RESERVATION,
  serviceProvisionSnapshotId: SERVICE, invoiceIssueSnapshotId: INVOICE,
  serviceProvisionDate: "2043-06-01", invoiceIssueDate: "2043-07-01",
  ordinaryRegimeSource: ORDINARY_SOURCE, ordinaryRegimeEvidenceSha256: "1".repeat(64), ...overrides,
});
const tx = (rows: readonly Row[], captured: string[] = []): Tx => (async (strings: TemplateStringsArray) => {
  captured.push(strings.join("?")); return rows;
}) as unknown as Tx;
const deepFrozen = (value: unknown, seen = new Set<object>()) => {
  if (typeof value !== "object" || value === null || seen.has(value)) return;
  seen.add(value); expect(Object.isFrozen(value)).toBeTrue();
  for (const key of Reflect.ownKeys(value)) deepFrozen((value as Mutable)[key], seen);
};

describe("Order 293 exact India GST accommodation invoice timeliness", () => {
  test("day 30 is timely and day 31 is late with date-only deterministic evidence", async () => {
    const service = new IndiaGstAccommodationInvoiceTimelinessService();
    for (const [issueDate, result] of [["2043-07-01", "timely"], ["2043-07-02", "late"]] as const) {
      const actual = await service.resolve(tx([row({ invoice_issue_date: issueDate })]), input({ invoiceIssueDate: issueDate }));
      expect(actual.result).toBe(result); expect(actual.deadlineDate).toBe("2043-07-01");
      expect(actual.serviceProvisionDate).toBe("2043-06-01"); expect(actual.invoiceIssueDate).toBe(issueDate);
    }
  });

  test("before-service issue date remains deterministic evidence and is timely", async () => {
    const service = new IndiaGstAccommodationInvoiceTimelinessService();
    const actual = await service.resolve(tx([row({ invoice_issue_date: "2043-05-31" })]), input({ invoiceIssueDate: "2043-05-31" }));
    expect(actual.result).toBe("timely"); expect(actual.deadlineDate).toBe("2043-07-01");
  });

  test("returns fixed-order recursively frozen replayable evidence without tenant disclosure", async () => {
    const service = new IndiaGstAccommodationInvoiceTimelinessService();
    const actual = await service.resolve(tx([row()]), input());
    expect(actual).not.toHaveProperty("tenantId"); deepFrozen(actual);
    expect(await service.resolve(tx([row()]), input())).toEqual(actual);
    expect(Object.keys(actual)).toEqual(["invoiceIssueSnapshotId", "serviceProvisionSnapshotId", "propertyNode", "serviceProvisionDate", "invoiceIssueDate", "deadlineDate", "regime", "source", "legalRule", "ordinaryRegimeEvidenceSha256", "result", "amountMinor", "currency", "evidenceHash"]);
    const changed = await service.resolve(tx([row()]), input({ ordinaryRegimeEvidenceSha256: "2".repeat(64) }));
    expect(changed.ordinaryRegimeEvidenceSha256).toBe("2".repeat(64));
    expect(changed.evidenceHash).not.toBe(actual.evidenceHash);
  });

  test("exact nine-key plain input rejects missing, extras, proxy, accessor and symbols before SQL", async () => {
    const exact = input(); const bad: unknown[] = [null, [], new Proxy({ ...exact }, {}), { ...exact, extra: true }];
    for (const key of Object.keys(exact)) { const candidate = { ...exact } as Mutable; delete candidate[key]; bad.push(candidate); }
    const accessor = { ...exact } as Mutable; Object.defineProperty(accessor, "invoiceIssueDate", { enumerable: true, get: () => exact.invoiceIssueDate }); bad.push(accessor);
    bad.push({ ...exact, [Symbol("hostile")]: true });
    for (const [key, value] of [["tenantId", "not-a-uuid"], ["propertyNode", "not-a-uuid"], ["reservationId", "not-a-uuid"], ["serviceProvisionSnapshotId", "not-a-uuid"], ["invoiceIssueSnapshotId", "not-a-uuid"], ["serviceProvisionDate", "2043-02-30"], ["invoiceIssueDate", "2043-13-01"], ["ordinaryRegimeEvidenceSha256", "not-a-sha256"]] as const)
      bad.push({ ...exact, [key]: value });
    for (const candidate of bad) { let calls = 0; const query = (async () => { calls++; return []; }) as unknown as Tx;
      await expect(new IndiaGstAccommodationInvoiceTimelinessService().resolve(query, candidate as never)).rejects.toBeInstanceOf(IndiaGstAccommodationInvoiceTimelinessValidationError); expect(calls).toBe(0); }
  });

  test("missing and duplicate evidence fail closed", async () => {
    const service = new IndiaGstAccommodationInvoiceTimelinessService();
    await expect(service.resolve(tx([]), input())).rejects.toBeInstanceOf(IndiaGstAccommodationInvoiceTimelinessNotFoundError);
    await expect(service.resolve(tx([row(), row({ invoice_issue_snapshot_id: OTHER_INVOICE })]), input())).rejects.toBeInstanceOf(IndiaGstAccommodationInvoiceTimelinessConflictError);
  });

  test("stored row exact shape is mandatory and accessors, proxies and symbols fail closed", async () => {
    const service = new IndiaGstAccommodationInvoiceTimelinessService();
    const extra = { ...row(), extra: true };
    const missing = { ...row() } as Mutable; delete missing.invoice_issue_date;
    const accessor = { ...row() } as Mutable; Object.defineProperty(accessor, "invoice_issue_date", { enumerable: true, get: () => "2043-07-01" });
    const symbol = { ...row(), [Symbol("hostile")]: true };
    for (const candidate of [extra, missing, accessor, new Proxy(row(), {}), symbol])
      await expect(service.resolve(tx([candidate]), input())).rejects.toBeInstanceOf(IndiaGstAccommodationInvoiceTimelinessConflictError);
  });

  test("ordinary source/legal/hash and full amount/currency coherence are mandatory", async () => {
    const service = new IndiaGstAccommodationInvoiceTimelinessService();
    for (const defect of [{ currency: "CAD" }, { service_currency: "CAD" }, { amount_minor: "1" }, { coverage_scope: "partial_attribution" }, { property_node: id(29390) }, { reservation_id: id(29391) }, { lineage_id: id(29392) }, { snapshot_hash: SERVICE_HASH }, { attribution_snapshot: null }, { invoice_issue_evidence_sha256: "not-a-sha256" }, { service_provision_evidence_sha256: "not-a-sha256" }, { invoice_issue_evidence_sha256: "A".repeat(64) }, { service_provision_evidence_sha256: "A".repeat(64) }]) {
      await expect(service.resolve(tx([row(defect)]), input())).rejects.toBeInstanceOf(IndiaGstAccommodationInvoiceTimelinessConflictError);
    }
  });

  test("every exception regime and unsupported literal fails closed", async () => {
    const service = new IndiaGstAccommodationInvoiceTimelinessService();
    for (const regime of ["financial_institution_nbfc", "distinct_person", "continuous_supply", "reverse_charge", "exempt", "composition", "low_value", "receipt_voucher", "refund_voucher", "revised_invoice", "credit_note", "debit_note", "consolidated_invoice", "partial_attribution", "excess_attribution", "", "governed_rule47_ordinary_regime_record\0"])
      await expect(service.resolve(tx([row()]), input({ ordinaryRegimeSource: regime }))).rejects.toBeInstanceOf(IndiaGstAccommodationInvoiceTimelinessValidationError);
    for (const evidenceHash of ["", "not-a-sha256", "A".repeat(64), "1".repeat(63), "1".repeat(65)])
      await expect(service.resolve(tx([row()]), input({ ordinaryRegimeEvidenceSha256: evidenceHash }))).rejects.toBeInstanceOf(IndiaGstAccommodationInvoiceTimelinessValidationError);
  });

  test("query is one equality-bound read with complete lineage and no clock/network/write/substitution", async () => {
    const captured: string[] = []; await new IndiaGstAccommodationInvoiceTimelinessService().resolve(tx([row()], captured), input());
    expect(captured).toHaveLength(1);
    for (const term of ["india_gst_accommodation_invoice_issue_snapshot", "india_gst_accommodation_service_provision_snapshot", "invoice_issue_snapshot_id", "service_provision_snapshot_id", "invoice_issue_date", "service_provision_date", "current_setting('app.tenant_id', true)"]) expect(captured[0]).toContain(term);
    expect(captured[0]).not.toMatch(/ORDER BY|LIMIT|latest|nearest|current_date|now\s*\(|document|folio|journal|posting|payment|check.?in|check.?out/i);
    expect(captured[0]).not.toMatch(/\b(?:INSERT\s+INTO|UPDATE\s+public\.|DELETE\s+FROM|TRUNCATE|LOCK|FOR\s+(?:UPDATE|SHARE))\b/i);
  });

  test("hostile cross-mixes cannot substitute tenant, lineage, identity, amount, date or regime", async () => {
    const service = new IndiaGstAccommodationInvoiceTimelinessService();
    for (const defect of [{ tenant_id: OTHER }, { service_provision_snapshot_id: id(29393) }, { invoice_issue_snapshot_id: id(29394) }, { reservation_lineage_id: id(29395) }, { origin_quote_hash: "9".repeat(64) }, { invoice_issue_date: "2043-07-03" }, { service_provision_date: "2043-06-02" }])
      await expect(service.resolve(tx([row(defect)]), input())).rejects.toBeInstanceOf(IndiaGstAccommodationInvoiceTimelinessConflictError);
  });
});
