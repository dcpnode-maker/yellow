import { describe, expect, test } from "bun:test";

import {
  createPositiveTaxAttributionSnapshot,
  deriveIndiaGstAccommodationRateChangeDate,
  deriveIndiaGstSection14PaymentReceiptDate,
  deriveIndiaGstSection14WorkingDayCalendarEvidence,
  IndiaGstAccommodationInvoiceIssueDateService,
  IndiaGstAccommodationPaymentReceiptDateService,
  IndiaGstAccommodationServiceProvisionDateService,
  IndiaGstSection14RateSelectionService,
  resolveIndiaGstSection14PaymentProviso,
} from "../src/contexts/tax-fiscal";
import type { Tx } from "../src/kernel";

type Mutable = Record<PropertyKey, any>;
const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const TENANT = id(34001), OTHER = id(34002), PROPERTY = id(34003), RESERVATION = id(34004);
const LINEAGE = id(34005), HOLD = id(34006), ATTRIBUTION = id(34007), SEGMENT = id(34008), SERVICE = id(34009), RECEIPT = id(34010), INVOICE = id(34011), EXTENSION = id(34012);
const PREDECESSOR = "a806f516-fed6-5768-b310-94aa03286adb", SUCCESSOR = "0b21daf2-ea6e-5568-9c21-69e4d4424574";
const PRE_FROM = "2022-07-17T18:30:00.000000Z", CUTOVER = "2025-09-21T18:30:00.000000Z";
const SOURCE20 = "ee920c82c30ed88d9bb515d7d79b975cc2ed599c6dad411d04d8b7fcd5a86901";
const SOURCE04 = "c6d264f1906375e93466dd97b2c60bb9b21c0dec34b93900b15237b4a98b7716";
const SOURCE15 = "46c9447579017d8bf1fefd75b6e6a48856dab7b23e44c7e06babfdc99ae9d289";
const QUOTE = "a".repeat(64), SERVICE_EVIDENCE = "b".repeat(64), PAYMENT_EVIDENCE = "c".repeat(64), INVOICE_EVIDENCE = "d".repeat(64), CAL_SOURCE = "e".repeat(64);

function stable(value: any): string { if (value === null || typeof value !== "object") return JSON.stringify(value); if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`; return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`; }
const hash = (value: unknown) => new Bun.CryptoHasher("sha256").update(stable(value)).digest("hex");
function freeze<T>(value: T, seen = new Set<object>()): T { if (typeof value !== "object" || value === null || seen.has(value)) return value; seen.add(value); for (const key of Reflect.ownKeys(value)) freeze((value as Mutable)[key], seen); return Object.freeze(value); }
function content(lower: number, itc: boolean) { return { country: "IN", price_display: "tax_exclusive", rounding: "document", taxes: [{ code: "GST_ROOM", name: "GST on accommodation", mode: "slab_percent", slab_basis: "transaction_value", applies_to: ["room_revenue"], slabs: [{ upto_minor: 750000, rate: lower, itc_eligible: itc }, { upto_minor: null, rate: 0.18, itc_eligible: true }] }] }; }
function version(extensionId: string, number: 1 | 2, status: "retired" | "active", lower: number, itc: boolean, from: string, to: string | null) { const body = content(lower, itc); return { extensionId, key: "in-gst-lodging", version: number, status, effectiveFromInstant: from, effectiveToInstant: to, content: body, contentHash: hash(body), gstRoomSlabs: [{ uptoMinor: 750000, rate: lower, itcEligible: itc }, { uptoMinor: null, rate: 0.18, itcEligible: true }] }; }
function pair(tenant = TENANT) { const predecessor = version(PREDECESSOR, 1, "retired", 0.12, true, PRE_FROM, CUTOVER), successor = version(SUCCESSOR, 2, "active", 0.05, false, CUTOVER, null); const body = { propertyNode: PROPERTY, predecessor, successor, cutoverInstant: CUTOVER, statutoryLowerBandDelta: { thresholdMinor: 750000, predecessorRate: 0.12, predecessorItcEligible: true, successorRate: 0.05, successorItcEligible: false, predecessorHasNilBand: false, successorHasNilBand: false }, sourceHashes: { notification20_2019: SOURCE20, notification04_2022: SOURCE04, notification15_2025: SOURCE15 } }; return freeze({ ...body, evidenceHash: hash({ tenantId: tenant, predecessorOwnerTenantId: null, successorOwnerTenantId: null, ...body }) }); }

function snapshot() { return createPositiveTaxAttributionSnapshot({ origin: { kind: "rate_quote", quoteHash: QUOTE }, currency: "INR", line: { lineId: "room", revenueGroup: "room_revenue", amountMinor: 10000n, nights: 1, personNights: 2, roomNights: [{ businessDate: "2025-09-21", amountMinor: 10000n }] }, assignments: [{ businessDate: "2025-09-21", jurisdictionKey: "in.order340.gst", evidenceRef: `tax-assignment:${QUOTE}` }], jurisdiction: { extensionId: EXTENSION, ownerTenantId: TENANT, key: "in.order340.gst", version: 1, contentHash: "f".repeat(64), evidenceRef: `tax-jurisdiction:${"1".repeat(64)}` }, evaluation: { schemaVersion: 1, jurisdictionKey: "in.order340.gst", country: "IN", priceDisplay: "tax_exclusive", rounding: "line", inputTotalMinor: 10000n, baseTotalMinor: 10000n, taxTotalMinor: 500n, grandTotalMinor: 10500n, taxes: [{ code: "GST_ROOM", name: "GST", taxMinor: 500n, components: [{ lineId: "room", revenueGroup: "room_revenue", baseMinor: 10000n, taxMinor: 500n, rateBasisPoints: 500 }] }] } }); }

function rows(serviceDate: string, booksDate: string, bankDate: string, invoiceDate: string) {
  const attribution = snapshot();
  const common = { tenant_id: TENANT, property_node: PROPERTY, reservation_lineage_id: LINEAGE, hold_binding_id: HOLD, attribution_id: ATTRIBUTION, reservation_id: RESERVATION, segment_id: SEGMENT, origin_quote_hash: QUOTE, snapshot_hash: attribution.snapshotHash, currency: "INR", lineage_id: LINEAGE, lineage_property_node: PROPERTY, lineage_hold_binding_id: HOLD, lineage_attribution_id: ATTRIBUTION, lineage_reservation_id: RESERVATION, lineage_segment_id: SEGMENT, lineage_origin_quote_hash: QUOTE, lineage_snapshot_hash: attribution.snapshotHash, lineage_currency: "INR", attribution_snapshot: attribution };
  const service = { ...common, id: SERVICE, service_provision_date: serviceDate, service_provision_source: "governed_service_provision_record", service_provision_evidence_sha256: SERVICE_EVIDENCE, legal_rule: "CGST_ACT_13_2_B_SERVICE_PROVISION_DATE_INPUT_ONLY" };
  const serviceJoin = { service_tenant_id: TENANT, service_id: SERVICE, property_node: PROPERTY, reservation_lineage_id: LINEAGE, hold_binding_id: HOLD, attribution_id: ATTRIBUTION, reservation_id: RESERVATION, segment_id: SEGMENT, origin_quote_hash: QUOTE, snapshot_hash: attribution.snapshotHash, service_currency: "INR", service_provision_date: serviceDate, service_provision_source: "governed_service_provision_record", service_provision_evidence_sha256: SERVICE_EVIDENCE, service_legal_rule: "CGST_ACT_13_2_B_SERVICE_PROVISION_DATE_INPUT_ONLY", lineage_id: LINEAGE, lineage_property_node: PROPERTY, lineage_hold_binding_id: HOLD, lineage_attribution_id: ATTRIBUTION, lineage_reservation_id: RESERVATION, lineage_segment_id: SEGMENT, lineage_origin_quote_hash: QUOTE, lineage_snapshot_hash: attribution.snapshotHash, lineage_currency: "INR", attribution_snapshot: attribution };
  const payment = { tenant_id: TENANT, id: RECEIPT, service_provision_snapshot_id: SERVICE, currency: "INR", amount_minor: "10500", coverage_scope: "full_attribution", supplier_books_entry_date: booksDate, supplier_bank_credit_date: bankDate, payment_receipt_date: booksDate < bankDate ? booksDate : bankDate, payment_receipt_source: "governed_supplier_payment_receipt_record", payment_receipt_evidence_sha256: PAYMENT_EVIDENCE, legal_rule: "CGST_ACT_13_2_EXPLANATION_II_PAYMENT_RECEIPT_DATE_INPUT_ONLY", ...serviceJoin };
  const invoice = { tenant_id: TENANT, id: INVOICE, service_provision_snapshot_id: SERVICE, currency: "INR", amount_minor: "10500", coverage_scope: "full_attribution", invoice_series: "FY2025", invoice_serial: "340", invoice_issue_date: invoiceDate, invoice_issue_source: "governed_supplier_tax_invoice_record", invoice_issue_evidence_sha256: INVOICE_EVIDENCE, legal_rule: "CGST_ACT_13_2_INVOICE_DATE_INPUT_ONLY", ...serviceJoin };
  return { service, payment, invoice };
}

function txFor(rowSet: ReturnType<typeof rows>, calls?: string[]): Tx { return (async (strings: TemplateStringsArray) => { const sql = strings.join("?"); calls?.push(sql); if (sql.includes("payment_receipt_snapshot")) return [rowSet.payment]; if (sql.includes("invoice_issue_snapshot")) return [rowSet.invoice]; return [rowSet.service]; }) as unknown as Tx; }
async function fixture(serviceDate: string, booksDate: string, bankDate: string, invoiceDate: string, paymentKind: "safe" | "calendar" = "safe") {
  const rowSet = rows(serviceDate, booksDate, bankDate, invoiceDate);
  const serviceInput = { tenantId: TENANT, propertyNode: PROPERTY, reservationId: RESERVATION, serviceProvisionSnapshotId: SERVICE, serviceProvisionDate: serviceDate };
  const paymentInput = { tenantId: TENANT, propertyNode: PROPERTY, reservationId: RESERVATION, serviceProvisionSnapshotId: SERVICE, paymentReceiptSnapshotId: RECEIPT, paymentReceiptDate: booksDate < bankDate ? booksDate : bankDate };
  const invoiceInput = { tenantId: TENANT, propertyNode: PROPERTY, reservationId: RESERVATION, serviceProvisionSnapshotId: SERVICE, invoiceIssueSnapshotId: INVOICE, invoiceIssueDate: invoiceDate, invoiceSeries: "FY2025", invoiceSerial: "340" };
  const serviceProvisionResult = await new IndiaGstAccommodationServiceProvisionDateService().resolve(txFor(rowSet), serviceInput);
  const paymentReceiptResult = await new IndiaGstAccommodationPaymentReceiptDateService().resolve(txFor(rowSet), paymentInput);
  const invoiceIssueResult = await new IndiaGstAccommodationInvoiceIssueDateService().resolve(txFor(rowSet), invoiceInput);
  const rateVersionPair = pair(); const rateChangeDateEvidence = deriveIndiaGstAccommodationRateChangeDate({ tenantId: TENANT, rateVersionPair } as never);
  const paymentProvisoEvidence = resolveIndiaGstSection14PaymentProviso({ supplierBooksEntryDate: booksDate, supplierBankCreditDate: bankDate, rateChangeDate: rateChangeDateEvidence.rateChangeDate });
  const calendarEvidence = freeze({ jurisdiction: "IN", authorityId: "INDIA_GST_GOVERNED_WORKING_DAY_CALENDAR", sourceDigestSha256: CAL_SOURCE, days: [{ date: "2025-09-23", state: "working" }, { date: "2025-09-24", state: "working" }, { date: "2025-09-25", state: "working" }, { date: "2025-09-26", state: "working" }, { date: "2025-09-27", state: "working" }, { date: "2025-09-28", state: "working" }, { date: "2025-09-29", state: "working" }, { date: "2025-09-30", state: "working" }] });
  const workingDayEvidence = deriveIndiaGstSection14WorkingDayCalendarEvidence({ tenantId: TENANT, rateChangeDate: rateChangeDateEvidence.rateChangeDate, throughDate: "2025-09-30", calendarEvidence } as never);
  const paymentEvidence = paymentKind === "safe" ? freeze({ kind: "safe_ordinary_receipt", paymentProvisoEvidence }) : freeze({ kind: "calendar_governed_receipt", paymentProvisoEvidence, throughDate: "2025-09-30", calendarEvidence, workingDayEvidence, paymentReceiptEvidence: deriveIndiaGstSection14PaymentReceiptDate({ tenantId: TENANT, rateVersionPair, rateChangeDateEvidence, supplierBooksEntryDate: booksDate, supplierBankCreditDate: bankDate, paymentProvisoEvidence, throughDate: "2025-09-30", calendarEvidence, workingDayEvidence } as never) });
  return { input: { tenantId: TENANT, propertyNode: PROPERTY, reservationId: RESERVATION, rateVersionPair, rateChangeDateEvidence, serviceProvisionInput: serviceInput, serviceProvisionResult, paymentReceiptInput: paymentInput, paymentReceiptResult, invoiceIssueInput: invoiceInput, invoiceIssueResult, paymentEvidence }, rowSet };
}

describe("Order 340: India GST section14 six-case rate selection", () => {
  test("implements only the statutory six cases and both earlier-of directions", async () => {
    const cases = [
      ["2025-09-21", "2025-09-23", "2025-09-24", "2025-09-23", "supply_before_invoice_after_payment_after", "2025-09-23", "successor"],
      ["2025-09-21", "2025-09-23", "2025-09-24", "2025-09-21", "supply_invoice_before_payment_after", "2025-09-21", "predecessor"],
      ["2025-09-21", "2025-09-21", "2025-09-23", "2025-09-23", "supply_payment_before_invoice_after", "2025-09-21", "predecessor"],
      ["2025-09-23", "2025-09-23", "2025-09-24", "2025-09-21", "supply_after_invoice_before_payment_after", "2025-09-23", "successor"],
      ["2025-09-23", "2025-09-21", "2025-09-20", "2025-09-21", "supply_after_invoice_payment_before", "2025-09-20", "predecessor"],
      ["2025-09-23", "2025-09-20", "2025-09-21", "2025-09-23", "supply_invoice_after_payment_before", "2025-09-23", "successor"],
    ] as const;
    for (const [service, books, bank, invoice, statutoryCase, time, side] of cases) {
      const built = await fixture(service, books, bank, invoice, bank > "2025-09-22" ? "calendar" : "safe");
      const actual = await new IndiaGstSection14RateSelectionService().resolve(txFor(built.rowSet), built.input as never);
      expect(actual.case).toBe(statutoryCase); expect(actual.timeOfSupplyDate).toBe(time); expect(actual.selectedVersionSide).toBe(side);
      expect(actual.selectedVersion.extensionId).toBe(side === "predecessor" ? PREDECESSOR : SUCCESSOR);
    }
  });

  test("normalizes only Order291 safe or Order339 calendar evidence and exact-replays all roots", async () => {
    const safe = await fixture("2025-09-21", "2025-09-20", "2025-09-21", "2025-09-23");
    const calls: string[] = [];
    const safeActual = await new IndiaGstSection14RateSelectionService().resolve(txFor(safe.rowSet, calls), safe.input as never);
    expect(safeActual.paymentReceiptDate).toBe("2025-09-20");
    expect(calls).toHaveLength(3);
    expect(calls.join("\n")).toContain("india_gst_accommodation_service_provision_snapshot");
    expect(calls.join("\n")).toContain("india_gst_accommodation_payment_receipt_snapshot");
    expect(calls.join("\n")).toContain("india_gst_accommodation_invoice_issue_snapshot");
    const calendar = await fixture("2025-09-23", "2025-09-23", "2025-09-30", "2025-09-21", "calendar");
    const calendarActual = await new IndiaGstSection14RateSelectionService().resolve(txFor(calendar.rowSet), calendar.input as never);
    expect(calendarActual.paymentReceiptDate).toBe("2025-09-30");
    for (const key of ["rateChangeDateEvidence", "serviceProvisionResult", "paymentReceiptResult", "invoiceIssueResult"] as const) {
      const changed = structuredClone(safe.input[key]) as Mutable; changed.evidenceHash = "0".repeat(64); freeze(changed);
      await expect(new IndiaGstSection14RateSelectionService().resolve(txFor(safe.rowSet), { ...safe.input, [key]: changed } as never)).rejects.toThrow();
    }
  });

  test("fails closed for equality, non-enumerated arrangements, mutable results, and tenant/lineage swaps", async () => {
    for (const dates of [["2025-09-22", "2025-09-20", "2025-09-21", "2025-09-23"], ["2025-09-21", "2025-09-20", "2025-09-21", "2025-09-20"], ["2025-09-23", "2025-09-23", "2025-09-24", "2025-09-23"]] as const) {
      const built = await fixture(dates[0], dates[1], dates[2], dates[3]); await expect(new IndiaGstSection14RateSelectionService().resolve(txFor(built.rowSet), built.input as never)).rejects.toThrow();
    }
    const built = await fixture("2025-09-21", "2025-09-20", "2025-09-21", "2025-09-23");
    await expect(new IndiaGstSection14RateSelectionService().resolve(txFor(built.rowSet), { ...built.input, serviceProvisionResult: { ...built.input.serviceProvisionResult } } as never)).rejects.toThrow();
    await expect(new IndiaGstSection14RateSelectionService().resolve(txFor(built.rowSet), { ...built.input, tenantId: OTHER } as never)).rejects.toThrow();
  });

  test("returns frozen tenant-hidden version identity and tenant-bound complete hashes", async () => {
    const built = await fixture("2025-09-21", "2025-09-20", "2025-09-21", "2025-09-23");
    const actual = await new IndiaGstSection14RateSelectionService().resolve(txFor(built.rowSet), built.input as never);
    expect(Object.isFrozen(actual)).toBeTrue(); expect(JSON.stringify(actual)).not.toContain(TENANT); expect(actual).not.toHaveProperty("rate"); expect(actual.selectedVersion).not.toHaveProperty("gstRoomSlabs");
    expect(actual.predecessorHashes).toEqual(expect.objectContaining({ rateVersionPair: built.input.rateVersionPair.evidenceHash, serviceProvision: built.input.serviceProvisionResult.evidenceHash, paymentReceipt: built.input.paymentReceiptResult.evidenceHash, invoiceIssue: built.input.invoiceIssueResult.evidenceHash }));
    const { evidenceHash, ...body } = actual; expect(evidenceHash).toBe(new Bun.CryptoHasher("sha256").update(JSON.stringify({ tenantId: TENANT, propertyNode: PROPERTY, reservationId: RESERVATION, ...body })).digest("hex"));
  });
});
