import { describe, expect, test } from "bun:test";

import {
  buildIndiaGstAccommodationSupplyNature,
  createPositiveTaxAttributionSnapshot,
  deriveIndiaGstAccommodationComponentFamily,
  deriveIndiaGstAccommodationLevyComponentIdentity,
  deriveIndiaGstAccommodationLevyInputBundle,
  deriveIndiaGstAccommodationRateChangeDate,
  deriveIndiaGstSection14PaymentReceiptDate,
  deriveIndiaGstSection14WorkingDayCalendarEvidence,
  IndiaGstAccommodationHistoricalResolutionService,
  IndiaGstAccommodationInvoiceIssueDateService,
  IndiaGstAccommodationPaymentReceiptDateService,
  IndiaGstAccommodationQuotedRateApplicabilityService,
  IndiaGstAccommodationServiceProvisionDateService,
  IndiaGstSection14RateSelectionService,
  resolveIndiaGstSection14PaymentProviso,
} from "../src/contexts/tax-fiscal";
import type { Tx } from "../src/kernel";

type Mutable = Record<PropertyKey, any>;
type Family = "igst" | "cgst_sgst" | "cgst_utgst";
const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const TENANT = id(34101), PROPERTY = id(34102), RESERVATION = id(34103), FOLIO = id(34104);
const LINEAGE = id(34105), HOLD = id(34106), ATTRIBUTION = id(34107), SEGMENT = id(34108), SELLABLE = id(34109);
const SERVICE_SNAPSHOT = id(34110), RECEIPT = id(34111), INVOICE = id(34112), SUPPLIER = id(34113), RECIPIENT = id(34114), RECIPIENT_REG = id(34115), SERVICE_LOCATION = id(34116), SUPPLIER_STATUS = id(34117), RECIPIENT_STATUS = id(34118), CLASSIFICATION = id(34119);
const PREDECESSOR = "a806f516-fed6-5768-b310-94aa03286adb", SUCCESSOR = "0b21daf2-ea6e-5568-9c21-69e4d4424574";
const PRE_FROM = "2022-07-17T18:30:00.000000Z", CUTOVER = "2025-09-21T18:30:00.000000Z";
const QUOTE = "a".repeat(64), SERVICE_EVIDENCE = "b".repeat(64), PAYMENT_EVIDENCE = "c".repeat(64), INVOICE_EVIDENCE = "d".repeat(64), CAL_SOURCE = "e".repeat(64);

function canonical(value: any): string { if (value === null || typeof value !== "object") return JSON.stringify(Object.is(value, -0) ? 0 : value); if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`; return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`; }
const hash = (value: unknown) => new Bun.CryptoHasher("sha256").update(canonical(value)).digest("hex");
const jsonHash = (value: unknown) => new Bun.CryptoHasher("sha256").update(JSON.stringify(value)).digest("hex");
function freeze<T>(value: T, seen = new Set<object>()): T { if (typeof value !== "object" || value === null || seen.has(value)) return value; seen.add(value); for (const key of Reflect.ownKeys(value)) freeze((value as Mutable)[key], seen); return Object.freeze(value); }
function expectDeepFrozen(value: unknown, seen = new Set<object>()): void { if (typeof value !== "object" || value === null || seen.has(value)) return; seen.add(value); expect(Object.isFrozen(value)).toBeTrue(); for (const key of Reflect.ownKeys(value)) expectDeepFrozen((value as Mutable)[key], seen); }
function content(lower: 0.12 | 0.05, itc: boolean) { return { country: "IN", price_display: "tax_exclusive", rounding: "document", taxes: [{ code: "GST_ROOM", name: "GST on accommodation", mode: "slab_percent", slab_basis: "transaction_value", applies_to: ["room_revenue"], slabs: [{ upto_minor: 750000, rate: lower, itc_eligible: itc }, { upto_minor: null, rate: 0.18, itc_eligible: true }] }] }; }
const extension = (idValue: string, version: number, status: string, body: unknown) => ({ id: idValue, tenantId: null, type: "tax_jurisdiction", key: "in-gst-lodging", version, content: body, status });

async function historical(day: "2025-09-21" | "2025-09-23") {
  const old = day === "2025-09-21";
  const state = {
    property: { tenant_id: TENANT, property_timezone: "Asia/Kolkata", business_day_from_instant: old ? "2025-09-20T18:30:00.000000Z" : "2025-09-22T18:30:00.000000Z", business_day_to_instant: old ? CUTOVER : "2025-09-23T18:30:00.000000Z" },
    assignments: [{ jurisdiction_key: "in-gst-lodging", effective_from: "2020-01-01", effective_to: null }],
    visible: [extension(PREDECESSOR, 1, "retired", content(0.12, true)), extension(SUCCESSOR, 2, "active", content(0.05, false))],
    periods: { [PREDECESSOR]: { extensionId: PREDECESSOR, ownerTenantId: null, effectiveFromInstant: PRE_FROM, effectiveToInstant: CUTOVER }, [SUCCESSOR]: { extensionId: SUCCESSOR, ownerTenantId: null, effectiveFromInstant: CUTOVER, effectiveToInstant: null } } as Mutable,
  };
  const tx = (async (strings: TemplateStringsArray) => { const sql = strings.join("?"); if (/FROM\s+(?:public\.)?org_node/i.test(sql)) return /property_timezone/i.test(sql) ? [state.property] : [{ tenant_id: TENANT }]; if (/FROM\s+(?:public\.)?tax_assignment/i.test(sql)) return state.assignments; throw new Error(`unexpected historical SQL: ${sql}`); }) as never;
  const registry = { async listVisible(tenantId: string) { expect(tenantId).toBe(TENANT); return state.visible; }, async readVisibleEffectivePeriod(tenantId: string, extensionId: string) { expect(tenantId).toBe(TENANT); return state.periods[extensionId]; } };
  return new IndiaGstAccommodationHistoricalResolutionService(registry).resolve(tx, { propertyNode: PROPERTY, businessDate: day });
}

function status(kind: "supplier" | "recipient", date: string, serviceHash = "6".repeat(64)) {
  const body = kind === "supplier"
    ? { supplierSezStatusId: SUPPLIER_STATUS, propertyNode: PROPERTY, supplierServiceLocation: freeze({ id: SERVICE_LOCATION, evidenceHash: serviceHash }), supplier: freeze({ registrationId: SUPPLIER, evidenceHash: "b".repeat(64) }), statusAsOf: date, gstRegistration: freeze({ status: "active", taxpayerType: "regular", source: "gst_common_portal", evidenceSha256: "5".repeat(64) }), sezStatus: "affirmatively_non_sez_regular", approval: null, legalRule: "IGST_ACT_7_5_B_AND_8_2_SUPPLIER_STATUS" }
    : { recipientSezStatusId: RECIPIENT_STATUS, recipient: freeze({ partyId: RECIPIENT, registrationId: RECIPIENT_REG, evidenceHash: "c".repeat(64) }), statusAsOf: date, gstRegistration: freeze({ status: "active", taxpayerType: "regular", source: "gst_common_portal", evidenceSha256: "4".repeat(64) }), sezStatus: "affirmatively_non_sez_regular", approval: null, legalRule: "IGST_ACT_7_5_B_AND_8_2_RECIPIENT_STATUS" };
  return freeze({ ...body, evidenceHash: jsonHash({ tenantId: TENANT, ...body }) });
}

function componentInput(history: Mutable, family: Family) {
  const selected = history.selectedExtension, state = family === "cgst_utgst" ? "04" : "27", pos = family === "igst" ? "29" : state;
  const jurisdiction = () => freeze({ extensionId: selected.extensionId, ownerTenantId: TENANT, key: selected.key, version: String(selected.version), contentHash: selected.contentHash });
  const comparisonBody = freeze({ propertyNode: PROPERTY, reservationId: RESERVATION, folioId: FOLIO, jurisdiction: jurisdiction(), supplier: freeze({ registrationId: SUPPLIER, evidenceHash: "b".repeat(64), stateCode: state }), recipient: freeze({ partyId: RECIPIENT, registrationId: RECIPIENT_REG, evidenceHash: "c".repeat(64) }), buyerAssociation: freeze({ associationHash: "d".repeat(64), payloadHash: "e".repeat(64) }), classification: freeze({ classificationId: CLASSIFICATION, evidenceHash: "f".repeat(64) }), placeOfSupply: freeze({ candidateHash: "1".repeat(64), legalRule: "IGST_ACT_12_3_B", pos }), comparisonRule: "SUPPLIER_REGISTERED_STATE_VS_ACCOMMODATION_POS", stateRelationship: family === "igst" ? "different_state_or_union_territory" : "same_state_or_union_territory" });
  const comparison = freeze({ ...comparisonBody, candidateJson: JSON.stringify(comparisonBody), candidateHash: jsonHash({ tenantId: TENANT, candidate: comparisonBody }) });
  const serviceBody = { supplierServiceLocationId: SERVICE_LOCATION, propertyNode: PROPERTY, jurisdiction: jurisdiction(), supplier: freeze({ registrationId: SUPPLIER, evidenceHash: "b".repeat(64) }), serviceScope: "lodging_accommodation", registeredPlace: freeze({ kind: "principal_place_of_business", stateCode: state, addressLine: "1 Marine Drive", locality: "Mumbai", postalCode: "400001" }), locationBasis: "supply_made_from_registered_place_of_business", legalRule: "IGST_ACT_2_15_A" };
  const serviceLocation = freeze({ ...serviceBody, evidenceHash: jsonHash({ tenantId: TENANT, ...serviceBody }) });
  const supplyNature = buildIndiaGstAccommodationSupplyNature({ tenantId: TENANT, supplyDate: history.businessDay.businessDate, registeredStateComparison: comparison, supplierServiceLocation: serviceLocation, recipientSezStatus: status("recipient", history.businessDay.businessDate), supplierSezStatus: status("supplier", history.businessDay.businessDate, serviceLocation.evidenceHash) } as never);
  const componentFamily = deriveIndiaGstAccommodationComponentFamily({ tenantId: TENANT, supplyNature } as never);
  const ancestor = { tenantId: TENANT, historicalResolution: history, supplyNature, componentFamily };
  const levyInputBundle = deriveIndiaGstAccommodationLevyInputBundle(ancestor as never);
  const input = { ...ancestor, levyInputBundle };
  return { input, result: deriveIndiaGstAccommodationLevyComponentIdentity(input as never) };
}

function snapshot(serviceDate: string, amounts: readonly bigint[]) {
  const dates = serviceDate === "2025-09-21" ? ["2025-09-21", "2025-09-22"] : ["2025-09-23", "2025-09-24"];
  const total = amounts.reduce((sum, amount) => sum + amount, 0n), tax = 1n;
  return createPositiveTaxAttributionSnapshot({ origin: { kind: "rate_quote", quoteHash: QUOTE }, currency: "INR", line: { lineId: "room", revenueGroup: "room_revenue", amountMinor: total, nights: amounts.length, personNights: amounts.length, roomNights: amounts.map((amountMinor, index) => ({ businessDate: dates[index]!, amountMinor })) }, assignments: amounts.map((_, index) => ({ businessDate: dates[index]!, jurisdictionKey: "in.order341.gst", evidenceRef: `tax-assignment:${String(index + 2).repeat(64)}` })), jurisdiction: { extensionId: PREDECESSOR, ownerTenantId: TENANT, key: "in.order341.gst", version: 1, contentHash: "f".repeat(64), evidenceRef: `tax-jurisdiction:${"1".repeat(64)}` }, evaluation: { schemaVersion: 1, jurisdictionKey: "in.order341.gst", country: "IN", priceDisplay: "tax_exclusive", rounding: "line", inputTotalMinor: total, baseTotalMinor: total, taxTotalMinor: tax, grandTotalMinor: total + tax, taxes: [{ code: "GST_ROOM", name: "GST", taxMinor: tax, components: [{ lineId: "room", revenueGroup: "room_revenue", baseMinor: total, taxMinor: tax, rateBasisPoints: 1 }] }] } });
}

function rowSet(serviceDate: string, booksDate: string, bankDate: string, invoiceDate: string, amounts: readonly bigint[]) {
  const attribution = snapshot(serviceDate, amounts), total = attribution.evaluation.grandTotalMinor;
  const common = { tenant_id: TENANT, property_node: PROPERTY, reservation_lineage_id: LINEAGE, hold_binding_id: HOLD, attribution_id: ATTRIBUTION, reservation_id: RESERVATION, segment_id: SEGMENT, origin_quote_hash: QUOTE, snapshot_hash: attribution.snapshotHash, currency: "INR", lineage_id: LINEAGE, lineage_property_node: PROPERTY, lineage_hold_binding_id: HOLD, lineage_attribution_id: ATTRIBUTION, lineage_reservation_id: RESERVATION, lineage_segment_id: SEGMENT, lineage_origin_quote_hash: QUOTE, lineage_snapshot_hash: attribution.snapshotHash, lineage_currency: "INR", attribution_snapshot: attribution };
  const service = { ...common, id: SERVICE_SNAPSHOT, service_provision_date: serviceDate, service_provision_source: "governed_service_provision_record", service_provision_evidence_sha256: SERVICE_EVIDENCE, legal_rule: "CGST_ACT_13_2_B_SERVICE_PROVISION_DATE_INPUT_ONLY" };
  const serviceJoin = { service_tenant_id: TENANT, service_id: SERVICE_SNAPSHOT, property_node: PROPERTY, reservation_lineage_id: LINEAGE, hold_binding_id: HOLD, attribution_id: ATTRIBUTION, reservation_id: RESERVATION, segment_id: SEGMENT, origin_quote_hash: QUOTE, snapshot_hash: attribution.snapshotHash, service_currency: "INR", service_provision_date: serviceDate, service_provision_source: "governed_service_provision_record", service_provision_evidence_sha256: SERVICE_EVIDENCE, service_legal_rule: "CGST_ACT_13_2_B_SERVICE_PROVISION_DATE_INPUT_ONLY", lineage_id: LINEAGE, lineage_property_node: PROPERTY, lineage_hold_binding_id: HOLD, lineage_attribution_id: ATTRIBUTION, lineage_reservation_id: RESERVATION, lineage_segment_id: SEGMENT, lineage_origin_quote_hash: QUOTE, lineage_snapshot_hash: attribution.snapshotHash, lineage_currency: "INR", attribution_snapshot: attribution };
  const payment = { tenant_id: TENANT, id: RECEIPT, service_provision_snapshot_id: SERVICE_SNAPSHOT, currency: "INR", amount_minor: total, coverage_scope: "full_attribution", supplier_books_entry_date: booksDate, supplier_bank_credit_date: bankDate, payment_receipt_date: booksDate < bankDate ? booksDate : bankDate, payment_receipt_source: "governed_supplier_payment_receipt_record", payment_receipt_evidence_sha256: PAYMENT_EVIDENCE, legal_rule: "CGST_ACT_13_2_EXPLANATION_II_PAYMENT_RECEIPT_DATE_INPUT_ONLY", ...serviceJoin };
  const invoice = { tenant_id: TENANT, id: INVOICE, service_provision_snapshot_id: SERVICE_SNAPSHOT, currency: "INR", amount_minor: total, coverage_scope: "full_attribution", invoice_series: "FY2025", invoice_serial: "341", invoice_issue_date: invoiceDate, invoice_issue_source: "governed_supplier_tax_invoice_record", invoice_issue_evidence_sha256: INVOICE_EVIDENCE, legal_rule: "CGST_ACT_13_2_INVOICE_DATE_INPUT_ONLY", ...serviceJoin };
  const persisted = { tenant_id: TENANT, lineage_id: LINEAGE, property_node: PROPERTY, hold_binding_id: HOLD, hold_id: HOLD, attribution_id: ATTRIBUTION, reservation_id: RESERVATION, segment_id: SEGMENT, sellable_unit_id: SELLABLE, folio_id: FOLIO, origin_quote_hash: QUOTE, snapshot_hash: attribution.snapshotHash, currency: "INR", snapshot: attribution };
  return { service, payment, invoice, persisted, attribution };
}

function txFor(rows: ReturnType<typeof rowSet>, calls?: string[]): Tx { return (async (strings: TemplateStringsArray) => { const sql = strings.join("?"); calls?.push(sql); if (sql.includes("tax_attribution_hold_binding")) return [rows.persisted]; if (sql.includes("payment_receipt_snapshot")) return [rows.payment]; if (sql.includes("invoice_issue_snapshot")) return [rows.invoice]; if (sql.includes("service_provision_snapshot")) return [rows.service]; throw new Error(`unexpected resolver SQL: ${sql}`); }) as unknown as Tx; }

async function fixture(family: Family, serviceDate: "2025-09-21" | "2025-09-23", booksDate: string, bankDate: string, invoiceDate: string, amounts: readonly bigint[] = [700000n, 800000n]) {
  const rows = rowSet(serviceDate, booksDate, bankDate, invoiceDate, amounts);
  const serviceProvisionInput = { tenantId: TENANT, propertyNode: PROPERTY, reservationId: RESERVATION, serviceProvisionSnapshotId: SERVICE_SNAPSHOT, serviceProvisionDate: serviceDate };
  const paymentReceiptInput = { tenantId: TENANT, propertyNode: PROPERTY, reservationId: RESERVATION, serviceProvisionSnapshotId: SERVICE_SNAPSHOT, paymentReceiptSnapshotId: RECEIPT, paymentReceiptDate: booksDate < bankDate ? booksDate : bankDate };
  const invoiceIssueInput = { tenantId: TENANT, propertyNode: PROPERTY, reservationId: RESERVATION, serviceProvisionSnapshotId: SERVICE_SNAPSHOT, invoiceIssueSnapshotId: INVOICE, invoiceIssueDate: invoiceDate, invoiceSeries: "FY2025", invoiceSerial: "341" };
  const serviceProvisionResult = await new IndiaGstAccommodationServiceProvisionDateService().resolve(txFor(rows), serviceProvisionInput);
  const paymentReceiptResult = await new IndiaGstAccommodationPaymentReceiptDateService().resolve(txFor(rows), paymentReceiptInput);
  const invoiceIssueResult = await new IndiaGstAccommodationInvoiceIssueDateService().resolve(txFor(rows), invoiceIssueInput);
  const history = await historical(serviceDate), component = componentInput(history as Mutable, family), rateVersionPair = history.rateVersionPair;
  const rateChangeDateEvidence = deriveIndiaGstAccommodationRateChangeDate({ tenantId: TENANT, rateVersionPair } as never);
  const paymentProvisoEvidence = resolveIndiaGstSection14PaymentProviso({ supplierBooksEntryDate: booksDate, supplierBankCreditDate: bankDate, rateChangeDate: rateChangeDateEvidence.rateChangeDate });
  const calendarEvidence = freeze({ jurisdiction: "IN", authorityId: "INDIA_GST_GOVERNED_WORKING_DAY_CALENDAR", sourceDigestSha256: CAL_SOURCE, days: ["2025-09-23", "2025-09-24", "2025-09-25", "2025-09-26", "2025-09-27", "2025-09-28", "2025-09-29", "2025-09-30"].map((date) => ({ date, state: "working" as const })) });
  const workingDayEvidence = deriveIndiaGstSection14WorkingDayCalendarEvidence({ tenantId: TENANT, rateChangeDate: rateChangeDateEvidence.rateChangeDate, throughDate: "2025-09-30", calendarEvidence } as never);
  const paymentEvidence = bankDate > "2025-09-22"
    ? freeze({ kind: "calendar_governed_receipt", paymentProvisoEvidence, throughDate: "2025-09-30", calendarEvidence, workingDayEvidence, paymentReceiptEvidence: deriveIndiaGstSection14PaymentReceiptDate({ tenantId: TENANT, rateVersionPair, rateChangeDateEvidence, supplierBooksEntryDate: booksDate, supplierBankCreditDate: bankDate, paymentProvisoEvidence, throughDate: "2025-09-30", calendarEvidence, workingDayEvidence } as never) })
    : freeze({ kind: "safe_ordinary_receipt", paymentProvisoEvidence });
  const section14Input = { tenantId: TENANT, propertyNode: PROPERTY, reservationId: RESERVATION, rateVersionPair, rateChangeDateEvidence, serviceProvisionInput, serviceProvisionResult, paymentReceiptInput, paymentReceiptResult, invoiceIssueInput, invoiceIssueResult, paymentEvidence };
  const section14Result = await new IndiaGstSection14RateSelectionService().resolve(txFor(rows), section14Input as never);
  return { rows, input: freeze(JSON.parse(JSON.stringify({ tenantId: TENANT, propertyNode: PROPERTY, reservationId: RESERVATION, folioId: FOLIO, reservationLineageId: LINEAGE, attributionId: ATTRIBUTION, section14Input, section14Result, componentIdentityInput: component.input, componentIdentityResult: component.result }))), section14Result };
}

describe("Order 341: India GST accommodation quoted-rate applicability", () => {
  test("executes the Section14-selected schedule for cases 1 and 5, every family, lower and upper quoted nights", async () => {
    const cases = [
      ["2025-09-21", "2025-09-23", "2025-09-24", "2025-09-24", "supply_before_invoice_after_payment_after", "successor", 500],
      ["2025-09-21", "2025-09-21", "2025-09-23", "2025-09-23", "supply_payment_before_invoice_after", "predecessor", 1200],
      ["2025-09-21", "2025-09-23", "2025-09-24", "2025-09-21", "supply_invoice_before_payment_after", "predecessor", 1200],
      ["2025-09-23", "2025-09-23", "2025-09-24", "2025-09-21", "supply_after_invoice_before_payment_after", "successor", 500],
      ["2025-09-23", "2025-09-20", "2025-09-21", "2025-09-21", "supply_after_invoice_payment_before", "predecessor", 1200],
      ["2025-09-23", "2025-09-20", "2025-09-21", "2025-09-23", "supply_invoice_after_payment_before", "successor", 500],
    ] as const;
    for (const [serviceDate, booksDate, bankDate, invoiceDate, statutoryCase, side, lowerRate] of cases) for (const family of ["igst", "cgst_sgst", "cgst_utgst"] as const) {
      const built = await fixture(family, serviceDate, booksDate, bankDate, invoiceDate), calls: string[] = [];
      const actual = await new IndiaGstAccommodationQuotedRateApplicabilityService().resolve(txFor(built.rows, calls), built.input);
      expect(actual.section14).toMatchObject({ case: statutoryCase, selectedVersionSide: side });
      expect(actual.components.map((component) => [component.quotedAmountMinor, component.slab.uptoMinor, component.slab.aggregateRateBasisPoints])).toEqual([["700000", 750000, lowerRate], ["800000", null, 1800]]);
      expect(actual.components.every((component) => component.slab.components.reduce((sum, rate) => sum + rate.rateBasisPoints, 0) === component.slab.aggregateRateBasisPoints)).toBeTrue();
      expect(actual.components[0]!.slab.components.map((component) => component.identity)).toEqual(family === "igst" ? ["igst"] : family === "cgst_sgst" ? ["cgst", "sgst"] : ["cgst", "utgst"]);
      expect(actual.reservationLineage).toMatchObject({ lineageId: LINEAGE, holdBindingId: HOLD, holdId: HOLD, reservationId: RESERVATION, segmentId: SEGMENT, sellableUnitId: SELLABLE, folioId: FOLIO, attributionId: ATTRIBUTION, originQuoteHash: QUOTE, snapshotHash: built.rows.attribution.snapshotHash, currency: "INR" });
      expectDeepFrozen(actual); expect(JSON.stringify(actual)).not.toContain(TENANT); expect(calls.some((sql) => sql.includes("tax_attribution_hold_binding"))).toBeTrue();
    }
  });

  test("keeps the statutory threshold inclusive in a real resolver execution", async () => {
    const built = await fixture("cgst_sgst", "2025-09-21", "2025-09-23", "2025-09-24", "2025-09-24", [750000n]);
    const actual = await new IndiaGstAccommodationQuotedRateApplicabilityService().resolve(txFor(built.rows), built.input);
    expect(actual.components).toHaveLength(1); expect(actual.components[0]!.slab).toMatchObject({ uptoMinor: 750000, aggregateRateBasisPoints: 500, itcEligible: false });
    expect(actual.components[0]!.slab.components.map((component) => component.rateBasisPoints)).toEqual([250, 250]);
  });

  test("fails closed for rederived input/result and persisted-lineage mutations", async () => {
    const built = await fixture("cgst_sgst", "2025-09-21", "2025-09-23", "2025-09-24", "2025-09-24"), service = new IndiaGstAccommodationQuotedRateApplicabilityService();
    const changedSection14 = structuredClone(built.input) as Mutable; changedSection14.section14Result.selectedVersionSide = "predecessor"; await expect(service.resolve(txFor(built.rows), freeze(changedSection14) as never)).rejects.toThrow();
    const changedIdentity = structuredClone(built.input) as Mutable; changedIdentity.componentIdentityResult.componentIdentities = ["igst"]; await expect(service.resolve(txFor(built.rows), freeze(changedIdentity) as never)).rejects.toThrow();
    const other = componentInput(await historical("2025-09-23") as Mutable, "cgst_sgst"), mismatchedSupply = structuredClone(built.input) as Mutable; mismatchedSupply.componentIdentityInput = other.input; mismatchedSupply.componentIdentityResult = other.result; await expect(service.resolve(txFor(built.rows), freeze(mismatchedSupply) as never)).rejects.toThrow();
    for (const mutate of [(row: Mutable) => { row.hold_binding_id = id(34190); }, (row: Mutable) => { row.snapshot_hash = "9".repeat(64); }, (row: Mutable) => { row.folio_id = id(34191); }]) {
      const rows = structuredClone(built.rows) as Mutable; mutate(rows.persisted); await expect(service.resolve(txFor(rows as never), built.input)).rejects.toThrow();
    }
  });

  test("retains static scope pins only as supplemental guards", async () => {
    const source = await Bun.file(new URL("../src/contexts/tax-fiscal/india-gst-accommodation-quoted-rate-applicability.ts", import.meta.url)).text();
    expect(source).toContain("componentIdentity.supplyDate !== section14.serviceProvisionDate");
    expect(source).toContain("deriveIndiaGstAccommodationComponentRateSlabs(componentIdentity.componentIdentities, selectedPairMember.gstRoomSlabs)");
    expect(source).not.toMatch(/INSERT\s+INTO|UPDATE\s+\S+\s+SET|DELETE\s+FROM|taxableValue|taxAmount|rounding|posting|document|irp/i);
  });
});
