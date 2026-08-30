import { describe, expect, test } from "bun:test";
import {
  IndiaGstAccommodationTimeOfSupplyConflictError,
  IndiaGstAccommodationTimeOfSupplyNotFoundError,
  IndiaGstAccommodationTimeOfSupplyService,
  IndiaGstAccommodationTimeOfSupplyValidationError,
} from "../src/contexts/tax-fiscal";
import { createPositiveTaxAttributionSnapshot, type CreatePositiveTaxAttributionSnapshotInput } from "../src/contexts/tax-fiscal/attribution";
import type { Tx } from "../src/kernel";

const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const TENANT = id(29401), OTHER = id(29402), PROPERTY = id(29403), RESERVATION = id(29404);
const SERVICE = id(29405), PAYMENT = id(29406), INVOICE = id(29407), LINE = id(29408), HOLD = id(29409), ATTR = id(29410), SEGMENT = id(29411), EXTENSION = id(29412);
const QUOTE = "a".repeat(64), SERVICE_EVIDENCE = "b".repeat(64), PAYMENT_EVIDENCE = "c".repeat(64), INVOICE_EVIDENCE = "d".repeat(64);
type Row = Record<string, unknown>; type Mutable = Record<PropertyKey, unknown>;
const attribution = (overrides: Partial<CreatePositiveTaxAttributionSnapshotInput> = {}) => createPositiveTaxAttributionSnapshot({
  origin: { kind: "rate_quote", quoteHash: QUOTE }, currency: "INR",
  line: { lineId: "room", revenueGroup: "room_revenue", amountMinor: 10000n, nights: 1, personNights: 2, roomNights: [{ businessDate: "2043-06-01", amountMinor: 10000n }] },
  assignments: [{ businessDate: "2043-06-01", jurisdictionKey: "in.order294.gst.27", evidenceRef: `tax-assignment:${QUOTE}` }],
  jurisdiction: { extensionId: EXTENSION, ownerTenantId: TENANT, key: "in.order294.gst.27", version: 1, contentHash: "e".repeat(64), evidenceRef: `tax-jurisdiction:${"f".repeat(64)}` },
  evaluation: { schemaVersion: 1, jurisdictionKey: "in.order294.gst.27", country: "IN", priceDisplay: "tax_exclusive", rounding: "line", inputTotalMinor: 10000n, baseTotalMinor: 10000n, taxTotalMinor: 500n, grandTotalMinor: 10500n, taxes: [{ code: "GST_ROOM", name: "GST", taxMinor: 500n, components: [{ lineId: "room", revenueGroup: "room_revenue", baseMinor: 10000n, taxMinor: 500n, rateBasisPoints: 500 }] }] }, ...overrides,
});
const row = (overrides: Row = {}): Row => { const snapshot = attribution(), paymentDate = typeof overrides.payment_date === "string" ? overrides.payment_date : "2043-06-15"; return {
  tenant_id: TENANT, service_id: SERVICE, payment_id: PAYMENT, invoice_id: INVOICE, property_node: PROPERTY, reservation_id: RESERVATION, service_date: "2043-06-01", payment_date: paymentDate, invoice_date: "2043-07-01", service_currency: "INR", payment_currency: "INR", invoice_currency: "INR", service_amount: "10500", payment_amount: "10500", invoice_amount: "10500", service_evidence: SERVICE_EVIDENCE, payment_evidence: PAYMENT_EVIDENCE, invoice_evidence: INVOICE_EVIDENCE, books_date: paymentDate, bank_date: paymentDate, service_source: "governed_service_provision_record", service_rule: "CGST_ACT_13_2_B_SERVICE_PROVISION_DATE_INPUT_ONLY", payment_source: "governed_supplier_payment_receipt_record", payment_rule: "CGST_ACT_13_2_EXPLANATION_II_PAYMENT_RECEIPT_DATE_INPUT_ONLY", invoice_source: "governed_supplier_tax_invoice_record", invoice_rule: "CGST_ACT_13_2_INVOICE_DATE_INPUT_ONLY", coverage_scope: "full_attribution", invoice_series: "FY2043", invoice_serial: "000042", lineage_id: LINE, lineage_property_node: PROPERTY, lineage_hold_binding_id: HOLD, lineage_attribution_id: ATTR, lineage_reservation_id: RESERVATION, lineage_segment_id: SEGMENT, lineage_quote_hash: QUOTE, lineage_snapshot_hash: snapshot.snapshotHash, lineage_currency: "INR", service_lineage_id: LINE, service_hold_binding_id: HOLD, service_attribution_id: ATTR, service_segment_id: SEGMENT, service_quote_hash: QUOTE, service_snapshot_hash: snapshot.snapshotHash, attribution_snapshot: snapshot, ...overrides,
}; };
const input = (overrides: Row = {}) => ({ tenantId: TENANT, propertyNode: PROPERTY, reservationId: RESERVATION, serviceProvisionSnapshotId: SERVICE, paymentReceiptSnapshotId: PAYMENT, invoiceIssueSnapshotId: INVOICE, serviceProvisionDate: "2043-06-01", paymentReceiptDate: "2043-06-15", invoiceIssueDate: "2043-07-01", ordinaryRegimeSource: "governed_rule47_ordinary_regime_record", ordinaryRegimeEvidenceSha256: "1".repeat(64), ...overrides });
const tx = (rows: readonly Row[], captured: string[] = []): Tx => (async (strings: TemplateStringsArray) => { captured.push(strings.join("?")); return rows; }) as unknown as Tx;
const deepFrozen = (value: unknown, seen = new Set<object>()) => { if (typeof value !== "object" || value === null || seen.has(value)) return; seen.add(value); expect(Object.isFrozen(value)).toBeTrue(); for (const key of Reflect.ownKeys(value)) deepFrozen((value as Mutable)[key], seen); };

describe("Order 294 ordinary CGST section 13(2) accommodation time of supply", () => {
  test("replays timely day 30 and late day 31, selecting the exact branch candidates", async () => {
    const service = new IndiaGstAccommodationTimeOfSupplyService();
    const timely = await service.resolve(tx([row({ invoice_date: "2043-07-01", payment_date: "2043-06-15" })]), input());
    expect(timely.deadlineDate).toBe("2043-07-01"); expect(timely.branch).toBe("section13_2_a_invoice_or_payment"); expect(timely.candidateDates).toEqual({ invoiceIssueDate: "2043-07-01", paymentReceiptDate: "2043-06-15" }); expect(timely.timeOfSupplyDate).toBe("2043-06-15");
    const late = await service.resolve(tx([row({ invoice_date: "2043-07-02", payment_date: "2043-06-15" })]), input({ invoiceIssueDate: "2043-07-02" }));
    expect(late.branch).toBe("section13_2_b_service_or_payment"); expect(late.candidateDates).toEqual({ serviceProvisionDate: "2043-06-01", paymentReceiptDate: "2043-06-15" }); expect(late.timeOfSupplyDate).toBe("2043-06-01");
  });
  test("selects earlier payment/invoice/service candidates and accepts equal dates", async () => {
    const service = new IndiaGstAccommodationTimeOfSupplyService();
    const invoiceEarlier = await service.resolve(tx([row({ payment_date: "2043-06-20", invoice_date: "2043-06-10" })]), input({ paymentReceiptDate: "2043-06-20", invoiceIssueDate: "2043-06-10" })); expect(invoiceEarlier.timeOfSupplyDate).toBe("2043-06-10");
    const paymentEarlier = await service.resolve(tx([row({ payment_date: "2043-06-10", invoice_date: "2043-06-20" })]), input({ paymentReceiptDate: "2043-06-10", invoiceIssueDate: "2043-06-20" })); expect(paymentEarlier.timeOfSupplyDate).toBe("2043-06-10");
    const equal = await service.resolve(tx([row({ payment_date: "2043-07-01", invoice_date: "2043-07-01" })]), input({ paymentReceiptDate: "2043-07-01" })); expect(equal.branch).toBe("section13_2_a_invoice_or_payment"); expect(equal.timeOfSupplyDate).toBe("2043-07-01");
    const latePaymentEarlier = await service.resolve(tx([row({ invoice_date: "2043-07-02", payment_date: "2043-05-31" })]), input({ invoiceIssueDate: "2043-07-02", paymentReceiptDate: "2043-05-31" })); expect(latePaymentEarlier.timeOfSupplyDate).toBe("2043-05-31");
  });
  test("returns fixed-order, recursively frozen, replayable tenant-hidden evidence", async () => {
    const service = new IndiaGstAccommodationTimeOfSupplyService(), actual = await service.resolve(tx([row()]), input()); expect(actual).not.toHaveProperty("tenantId"); deepFrozen(actual); expect(await service.resolve(tx([row()]), input())).toEqual(actual);
    expect(Object.keys(actual)).toEqual(["serviceProvisionSnapshotId", "paymentReceiptSnapshotId", "invoiceIssueSnapshotId", "propertyNode", "reservationId", "reservationLineage", "attribution", "serviceProvisionDate", "paymentReceiptDate", "invoiceIssueDate", "deadlineDate", "candidateDates", "branch", "timeOfSupplyDate", "regime", "source", "legalRule", "ordinaryRegimeEvidenceSha256", "invoiceSeries", "invoiceSerial", "supplierBooksEntryDate", "supplierBankCreditDate", "coverageScope", "serviceProvisionSource", "serviceProvisionLegalRule", "paymentReceiptSource", "paymentReceiptLegalRule", "invoiceIssueSource", "invoiceIssueLegalRule", "serviceProvisionEvidenceSha256", "paymentReceiptEvidenceSha256", "invoiceIssueEvidenceSha256", "amountMinor", "currency", "evidenceHash"]);
    expect(actual.reservationLineage).toEqual({ lineageId: LINE, holdBindingId: HOLD, attributionId: ATTR, reservationId: RESERVATION, segmentId: SEGMENT, originQuoteHash: QUOTE, snapshotHash: String(row().lineage_snapshot_hash), currency: "INR" }); expect(actual.attribution).toEqual({ originKind: "rate_quote", lineId: "room", revenueGroup: "room_revenue" });
    const changed = await service.resolve(tx([row()]), input({ ordinaryRegimeEvidenceSha256: "2".repeat(64) })); expect(changed.evidenceHash).not.toBe(actual.evidenceHash);
  });
  test("exact eleven-key plain input rejects hostile shape and values before SQL", async () => {
    const exact = input(), bad: unknown[] = [null, [], new Proxy({ ...exact }, {}), { ...exact, extra: true }]; for (const key of Object.keys(exact)) { const candidate = { ...exact } as Mutable; delete candidate[key]; bad.push(candidate); } const accessor = { ...exact } as Mutable; Object.defineProperty(accessor, "invoiceIssueDate", { enumerable: true, get: () => exact.invoiceIssueDate }); bad.push(accessor, { ...exact, [Symbol("hostile")]: true });
    for (const [key, value] of [["tenantId", "not-a-uuid"], ["paymentReceiptSnapshotId", "not-a-uuid"], ["serviceProvisionDate", "2043-02-30"], ["paymentReceiptDate", "2043-13-01"], ["invoiceIssueDate", "2043-02-30"], ["ordinaryRegimeEvidenceSha256", "not-a-sha256"]] as const) bad.push({ ...exact, [key]: value });
    for (const candidate of bad) { let calls = 0; const query = (async () => { calls++; return []; }) as unknown as Tx; await expect(new IndiaGstAccommodationTimeOfSupplyService().resolve(query, candidate as never)).rejects.toBeInstanceOf(IndiaGstAccommodationTimeOfSupplyValidationError); expect(calls).toBe(0); }
  });
  test("missing, duplicate, malformed and hostile stored rows fail closed", async () => {
    const service = new IndiaGstAccommodationTimeOfSupplyService(); await expect(service.resolve(tx([]), input())).rejects.toBeInstanceOf(IndiaGstAccommodationTimeOfSupplyNotFoundError); await expect(service.resolve(tx([row(), row({ invoice_id: id(29490) })]), input())).rejects.toBeInstanceOf(IndiaGstAccommodationTimeOfSupplyConflictError);
    const missing = { ...row() } as Mutable; delete missing.invoice_date; const accessor = { ...row() } as Mutable; Object.defineProperty(accessor, "invoice_date", { enumerable: true, get: () => "2043-07-01" }); for (const candidate of [{ ...row(), extra: true }, missing, accessor, new Proxy(row(), {}), { ...row(), [Symbol("hostile")]: true }]) await expect(service.resolve(tx([candidate]), input())).rejects.toBeInstanceOf(IndiaGstAccommodationTimeOfSupplyConflictError);
  });
  test("complete lineage, sources, legal rules, hashes, amount, currency and payment invariant are mandatory", async () => {
    const service = new IndiaGstAccommodationTimeOfSupplyService();
    for (const defect of [{ tenant_id: OTHER }, { service_id: id(29491) }, { payment_id: id(29492) }, { invoice_id: id(29493) }, { property_node: OTHER }, { reservation_id: OTHER }, { lineage_id: OTHER }, { service_lineage_id: OTHER }, { lineage_quote_hash: "9".repeat(64) }, { service_snapshot_hash: "9".repeat(64) }, { service_source: "other" }, { service_rule: "other" }, { payment_source: "other" }, { payment_rule: "other" }, { invoice_source: "other" }, { invoice_rule: "other" }, { service_evidence: "A".repeat(64) }, { payment_evidence: "not-a-sha256" }, { invoice_evidence: "A".repeat(64) }, { service_amount: "1" }, { payment_amount: "1" }, { invoice_amount: "1" }, { lineage_currency: "CAD" }, { payment_currency: "CAD" }, { coverage_scope: "partial_attribution" }, { books_date: "2043-06-16" }, { payment_date: "2043-06-14", books_date: "2043-06-15" }, { attribution_snapshot: null }]) await expect(service.resolve(tx([row(defect)]), input())).rejects.toBeInstanceOf(IndiaGstAccommodationTimeOfSupplyConflictError);
  });
  test("query is exactly one tenant-bound equality read with all predecessors and no writes, clock or substitution", async () => {
    const captured: string[] = []; await new IndiaGstAccommodationTimeOfSupplyService().resolve(tx([row()], captured), input()); expect(captured).toHaveLength(1); for (const term of ["india_gst_accommodation_service_provision_snapshot", "india_gst_accommodation_payment_receipt_snapshot", "india_gst_accommodation_invoice_issue_snapshot", "tax_attribution_reservation_binding", "tax_attribution_snapshot", "service.id", "payment.id", "invoice.id", "current_setting('app.tenant_id', true)"]) expect(captured[0]).toContain(term); expect(captured[0]).not.toMatch(/ORDER BY|LIMIT|latest|nearest|current_date|now\s*\(|Date\s*\(|document|folio|journal|posting|check.?in|check.?out/i); expect(captured[0]).not.toMatch(/\b(?:INSERT\s+INTO|UPDATE\s+public\.|DELETE\s+FROM|TRUNCATE|LOCK|FOR\s+(?:UPDATE|SHARE))\b/i);
  });
  test("source contains no JavaScript Date or clock dependency", async () => { const source = await Bun.file(new URL("../src/contexts/tax-fiscal/india-gst-accommodation-time-of-supply.ts", import.meta.url)).text(); expect(source).not.toMatch(/\bDate\s*\(|Date\.UTC|Date\.now|new\s+Date/); });
});
