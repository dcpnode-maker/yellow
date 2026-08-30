import { describe, expect, test } from "bun:test";
import {
  IndiaGstRecipientRegistrationAtTimeOfSupplyConflictError,
  IndiaGstRecipientRegistrationAtTimeOfSupplyNotFoundError,
  IndiaGstRecipientRegistrationAtTimeOfSupplyService,
  IndiaGstRecipientRegistrationAtTimeOfSupplyValidationError,
  resolveIndiaGstRecipientRegistrationAtTimeOfSupply,
} from "../src/contexts/tax-fiscal";
import { createPositiveTaxAttributionSnapshot } from "../src/contexts/tax-fiscal/attribution";
import type { Tx } from "../src/kernel";

const id = (n: number): string =>
  `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const sha = (value: unknown): string =>
  new Bun.CryptoHasher("sha256").update(JSON.stringify(value)).digest("hex");

const TENANT = id(29601);
const PROPERTY = id(29602);
const RESERVATION = id(29603);
const PARTY = id(29604);
const REGISTRATION = id(29605);
const STATUS = id(29606);
const SERVICE = id(29607);
const PAYMENT = id(29608);
const INVOICE = id(29609);
const LINEAGE = id(29610);
const HOLD = id(29611);
const ATTRIBUTION = id(29612);
const SEGMENT = id(29613);
const EXTENSION = id(29614);
const QUOTE = "a".repeat(64);
const SERVICE_EVIDENCE = "b".repeat(64);
const PAYMENT_EVIDENCE = "c".repeat(64);
const INVOICE_EVIDENCE = "d".repeat(64);
const STATUS_EVIDENCE = "e".repeat(64);
const CONTENT = "f".repeat(64);

const jurisdiction = {
  extensionId: EXTENSION,
  ownerTenantId: TENANT,
  key: "in.order296.gst.27",
  version: "7",
  contentHash: CONTENT,
};
const registration = {
  registrationId: REGISTRATION,
  tenantId: TENANT,
  partyId: PARTY,
  scheme: "in-gstin",
  gstin: "27AAPFU0939F1ZV",
  stateCode: "27",
  legalName: "Yellow Order 296 Recipient Private Limited",
  tradeName: "Yellow Order 296 Recipient",
  addressLine1: "1 Marine Drive",
  locality: "Mumbai",
  pin: "400001",
};
// Order 285's complete public registration envelope is recomputed, while the
// Order 296 result exposes only the safe identity/evidence projection.
const registrationEvidence = {
  registrationId: REGISTRATION,
  tenantId: TENANT,
  partyId: PARTY,
  scheme: "in-gstin",
  gstin: registration.gstin,
  stateCode: registration.stateCode,
  legalName: registration.legalName,
  tradeName: registration.tradeName,
  addressLine1: registration.addressLine1,
  locality: registration.locality,
  pin: registration.pin,
};
const REGISTRATION_HASH = sha(registrationEvidence);
const statusBody = (type: "regular" | "sez_unit" | "sez_developer" = "regular", statusId = STATUS) => {
  const approval = type === "regular" ? null : {
    form: type === "sez_unit" ? "sez_rules_form_g" : "sez_rules_form_b",
    reference: "LOA/296/2038",
    validity: { fromInclusive: "2043-01-01", toExclusive: "2044-01-01" },
    status: "in_force",
    evidenceSha256: "1".repeat(64),
  };
  return {
    recipientSezStatusId: statusId,
    recipient: { partyId: PARTY, registrationId: REGISTRATION, evidenceHash: REGISTRATION_HASH },
    statusAsOf: "2043-06-15",
    gstRegistration: { status: "active", taxpayerType: type, source: "gst_common_portal", evidenceSha256: STATUS_EVIDENCE },
    sezStatus: type === "regular" ? "affirmatively_non_sez_regular" : type,
    approval,
    legalRule: "IGST_ACT_7_5_B_AND_8_2_RECIPIENT_STATUS",
  };
};
const RECIPIENT_STATUS_HASH = sha({ tenantId: TENANT, ...statusBody() });

const attribution = createPositiveTaxAttributionSnapshot({
  origin: { kind: "rate_quote", quoteHash: QUOTE },
  currency: "INR",
  line: {
    lineId: "room",
    revenueGroup: "room_revenue",
    amountMinor: 10500n,
    nights: 1,
    personNights: 2,
    roomNights: [{ businessDate: "2043-06-01", amountMinor: 10500n }],
  },
  assignments: [{ businessDate: "2043-06-01", jurisdictionKey: jurisdiction.key, evidenceRef: `tax-assignment:${QUOTE}` }],
  jurisdiction: {
    extensionId: EXTENSION,
    ownerTenantId: TENANT,
    key: jurisdiction.key,
    version: 7,
    contentHash: CONTENT,
    evidenceRef: `tax-jurisdiction:${CONTENT}`,
  },
  evaluation: {
    schemaVersion: 1,
    jurisdictionKey: jurisdiction.key,
    country: "IN",
    priceDisplay: "tax_exclusive",
    rounding: "line",
    inputTotalMinor: 10500n,
    baseTotalMinor: 10500n,
    taxTotalMinor: 0n,
    grandTotalMinor: 10500n,
    taxes: [{
      code: "GST_ROOM",
      name: "GST",
      taxMinor: 0n,
      components: [{ lineId: "room", revenueGroup: "room_revenue", baseMinor: 10500n, taxMinor: 0n, rateBasisPoints: 0 }],
    }],
  },
});

const tosBody = {
  serviceProvisionSnapshotId: SERVICE,
  paymentReceiptSnapshotId: PAYMENT,
  invoiceIssueSnapshotId: INVOICE,
  propertyNode: PROPERTY,
  reservationId: RESERVATION,
  reservationLineage: {
    lineageId: LINEAGE,
    holdBindingId: HOLD,
    attributionId: ATTRIBUTION,
    reservationId: RESERVATION,
    segmentId: SEGMENT,
    originQuoteHash: QUOTE,
    snapshotHash: attribution.snapshotHash,
    currency: "INR",
  },
  attribution: { originKind: "rate_quote", lineId: "room", revenueGroup: "room_revenue" },
  serviceProvisionDate: "2043-06-01",
  paymentReceiptDate: "2043-06-15",
  invoiceIssueDate: "2043-07-01",
  deadlineDate: "2043-07-01",
  candidateDates: { invoiceIssueDate: "2043-07-01", paymentReceiptDate: "2043-06-15" },
  branch: "section13_2_a_invoice_or_payment",
  timeOfSupplyDate: "2043-06-15",
  regime: "ordinary_rule47_30_day",
  source: "governed_rule47_ordinary_regime_record",
  legalRule: "CGST_ACT_13_2_A_OR_B_ORDINARY_TIME_OF_SUPPLY",
  ordinaryRegimeEvidenceSha256: "1".repeat(64),
  invoiceSeries: "FY2043",
  invoiceSerial: "000042",
  supplierBooksEntryDate: "2043-06-15",
  supplierBankCreditDate: "2043-06-15",
  coverageScope: "full_attribution",
  serviceProvisionSource: "governed_service_provision_record",
  serviceProvisionLegalRule: "CGST_ACT_13_2_B_SERVICE_PROVISION_DATE_INPUT_ONLY",
  paymentReceiptSource: "governed_supplier_payment_receipt_record",
  paymentReceiptLegalRule: "CGST_ACT_13_2_EXPLANATION_II_PAYMENT_RECEIPT_DATE_INPUT_ONLY",
  invoiceIssueSource: "governed_supplier_tax_invoice_record",
  invoiceIssueLegalRule: "CGST_ACT_13_2_INVOICE_DATE_INPUT_ONLY",
  serviceProvisionEvidenceSha256: SERVICE_EVIDENCE,
  paymentReceiptEvidenceSha256: PAYMENT_EVIDENCE,
  invoiceIssueEvidenceSha256: INVOICE_EVIDENCE,
  amountMinor: "10500",
  currency: "INR",
};
const TOS_HASH = sha({ tenantId: TENANT, ...tosBody });

type Row = Record<string, unknown>;
const row = (overrides: Row = {}): Row => ({
  tenant_id: TENANT,
  registration_id: REGISTRATION,
  registration_scheme: "in-gstin",
  registration_number: registration.gstin,
  region_code: "27",
  legal_name: registration.legalName,
  trade_name: registration.tradeName,
  address_line: registration.addressLine1,
  locality: registration.locality,
  postal_code: registration.pin,
  status_id: STATUS,
  status_registration_id: REGISTRATION,
  status_recipient_evidence_hash: REGISTRATION_HASH,
  status_as_of: "2043-06-15",
  gst_registration_status: "active",
  gst_taxpayer_type: "regular",
  gst_status_source: "gst_common_portal",
  gst_status_evidence_sha256: STATUS_EVIDENCE,
  approval_form: null,
  approval_reference: null,
  approval_validity: null,
  approval_status: null,
  approval_evidence_sha256: null,
  status_legal_rule: "IGST_ACT_7_5_B_AND_8_2_RECIPIENT_STATUS",
  service_id: SERVICE,
  payment_id: PAYMENT,
  invoice_id: INVOICE,
  property_node: PROPERTY,
  reservation_id: RESERVATION,
  service_date: "2043-06-01",
  payment_date: "2043-06-15",
  invoice_date: "2043-07-01",
  service_currency: "INR",
  payment_currency: "INR",
  invoice_currency: "INR",
  payment_amount: "10500",
  invoice_amount: "10500",
  service_evidence: SERVICE_EVIDENCE,
  payment_evidence: PAYMENT_EVIDENCE,
  invoice_evidence: INVOICE_EVIDENCE,
  books_date: "2043-06-15",
  bank_date: "2043-06-15",
  service_source: "governed_service_provision_record",
  service_rule: "CGST_ACT_13_2_B_SERVICE_PROVISION_DATE_INPUT_ONLY",
  payment_source: "governed_supplier_payment_receipt_record",
  payment_rule: "CGST_ACT_13_2_EXPLANATION_II_PAYMENT_RECEIPT_DATE_INPUT_ONLY",
  invoice_source: "governed_supplier_tax_invoice_record",
  invoice_rule: "CGST_ACT_13_2_INVOICE_DATE_INPUT_ONLY",
  coverage_scope: "full_attribution",
  invoice_series: "FY2043",
  invoice_serial: "000042",
  service_lineage_id: LINEAGE,
  service_hold_binding_id: HOLD,
  service_attribution_id: ATTRIBUTION,
  service_segment_id: SEGMENT,
  service_quote_hash: QUOTE,
  service_snapshot_hash: attribution.snapshotHash,
  lineage_id: LINEAGE,
  lineage_property_node: PROPERTY,
  lineage_hold_binding_id: HOLD,
  lineage_attribution_id: ATTRIBUTION,
  lineage_reservation_id: RESERVATION,
  lineage_segment_id: SEGMENT,
  lineage_quote_hash: QUOTE,
  lineage_snapshot_hash: attribution.snapshotHash,
  lineage_currency: "INR",
  attribution_snapshot: attribution,
  ...overrides,
});

const input = (overrides: Row = {}): Row => ({
  tenantId: TENANT,
  recipientPartyId: PARTY,
  recipientRegistrationId: REGISTRATION,
  recipientSezStatusId: STATUS,
  propertyNode: PROPERTY,
  reservationId: RESERVATION,
  serviceProvisionSnapshotId: SERVICE,
  paymentReceiptSnapshotId: PAYMENT,
  invoiceIssueSnapshotId: INVOICE,
  statusAsOf: "2043-06-15",
  timeOfSupplyDate: "2043-06-15",
  serviceProvisionDate: "2043-06-01",
  paymentReceiptDate: "2043-06-15",
  invoiceIssueDate: "2043-07-01",
  ordinaryRegimeSource: "governed_rule47_ordinary_regime_record",
  ordinaryRegimeEvidenceSha256: "1".repeat(64),
  recipientRegistrationStatusEvidenceHash: RECIPIENT_STATUS_HASH,
  timeOfSupplyEvidenceHash: TOS_HASH,
  ...overrides,
});

const tx = (rows: readonly Row[], statements: string[] = []): Tx =>
  (async (strings: TemplateStringsArray) => {
    statements.push(strings.join("?"));
    return rows;
  }) as unknown as Tx;
type Mutable = Record<PropertyKey, unknown>;
const deeplyFrozen = (value: unknown, seen = new Set<object>()): void => {
  if (typeof value !== "object" || value === null || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBeTrue();
  for (const key of Reflect.ownKeys(value)) deeplyFrozen((value as Mutable)[key], seen);
};

describe("Order 296 recipient GST registration at exact time of supply", () => {
  test("exports the narrow resolver boundary", async () => {
    const result = await resolveIndiaGstRecipientRegistrationAtTimeOfSupply(
      tx([row()]), input() as never,
    );
    expect(result.result).toBe("active_recipient_registration_at_time_of_supply");
  });

  test("one equality read revalidates complete Order285 and Order294 envelopes", async () => {
    const statements: string[] = [];
    const result = await new IndiaGstRecipientRegistrationAtTimeOfSupplyService()
      .resolve(tx([row()], statements), input() as never);
    expect(statements).toHaveLength(1);
    expect(result.result).toBe("active_recipient_registration_at_time_of_supply");
    expect(result.statusAsOf).toBe("2043-06-15");
    expect(result.timeOfSupplyDate).toBe("2043-06-15");
    expect(result.recipient).toEqual({ registrationId: REGISTRATION, evidenceHash: REGISTRATION_HASH });
    expect(result.recipientSezStatusId).toBe(STATUS);
    expect(result.recipientRegistrationStatusEvidenceHash).toBe(RECIPIENT_STATUS_HASH);
    expect(result.timeOfSupplyEvidenceHash).toBe(TOS_HASH);
    expect(result.timeOfSupply.evidenceHash).toBe(TOS_HASH);
    expect(Object.keys(result)).toEqual([
      "recipientPartyId", "recipientRegistrationId", "recipientSezStatusId",
      "propertyNode", "reservationId", "statusAsOf", "timeOfSupplyDate",
      "result", "recipient", "gstRegistration", "sezStatus", "approval",
      "recipientRegistrationStatusEvidenceHash", "timeOfSupplyEvidenceHash",
      "timeOfSupply", "recipientRegistrationLegalRule", "timeOfSupplyLegalRule",
      "evidenceHash",
    ]);
    const { evidenceHash, ...evidenceWithoutHash } = result;
    expect(evidenceHash).toBe(sha({ tenantId: TENANT, ...evidenceWithoutHash }));
    expect(result).not.toHaveProperty("tenantId");
    expect(result).not.toHaveProperty("gstin");
    expect(result).not.toHaveProperty("addressLine");
    expect(JSON.stringify(result)).not.toContain(registration.gstin);
    expect(JSON.stringify(result)).not.toContain(registration.addressLine1);
    expect(JSON.stringify(result)).not.toContain(registration.locality);
    deeplyFrozen(result);
    const sql = statements[0]!;
    expect(sql).toContain("current_setting('app.tenant_id', true)");
    expect(sql).toContain("india_gst_recipient_sez_status");
    expect(sql).toContain("tax_attribution_snapshot");
    expect(sql).not.toMatch(/ORDER BY|LIMIT|now\s*\(|current_date|INSERT\s+INTO|UPDATE\s+public|DELETE\s+FROM|TRUNCATE|FOR\s+(UPDATE|SHARE)/i);
  });

  test("regular, SEZ-unit and SEZ-developer status envelopes remain exact and frozen", async () => {
    const variants = [
      ["regular", STATUS, null] as const,
      ["sez_unit", id(29631), "sez_rules_form_g"] as const,
      ["sez_developer", id(29632), "sez_rules_form_b"] as const,
    ];
    for (const [type, statusId, form] of variants) {
      const status = statusBody(type, statusId);
      const expectedHash = sha({ tenantId: TENANT, ...status });
      const r = row({
        status_id: statusId,
        gst_taxpayer_type: type,
        approval_form: form,
        approval_reference: form === null ? null : "LOA/296/2038",
        approval_validity: form === null ? null : "[2043-01-01,2044-01-01)",
        approval_status: form === null ? null : "in_force",
        approval_evidence_sha256: form === null ? null : "1".repeat(64),
      });
      const result = await new IndiaGstRecipientRegistrationAtTimeOfSupplyService()
        .resolve(tx([r]), input({ recipientSezStatusId: statusId, recipientRegistrationStatusEvidenceHash: expectedHash }) as never);
      const exposed = result as unknown as Record<string, unknown>;
      expect((exposed.gstRegistration as Record<string, unknown> | undefined)?.taxpayerType).toBe(type);
      expect(result).not.toHaveProperty("gstin");
      deeplyFrozen(result);
    }
  });

  test("exact date equality is checked before any database read", async () => {
    let reads = 0;
    const noRead = (async () => { reads += 1; return []; }) as unknown as Tx;
    await expect(new IndiaGstRecipientRegistrationAtTimeOfSupplyService().resolve(
      noRead,
      input({ timeOfSupplyDate: "2043-06-16" }) as never,
    )).rejects.toBeInstanceOf(IndiaGstRecipientRegistrationAtTimeOfSupplyValidationError);
    expect(reads).toBe(0);
    await expect(new IndiaGstRecipientRegistrationAtTimeOfSupplyService().resolve(
      tx([]), input() as never,
    )).rejects.toBeInstanceOf(IndiaGstRecipientRegistrationAtTimeOfSupplyNotFoundError);
    await expect(new IndiaGstRecipientRegistrationAtTimeOfSupplyService().resolve(
      tx([row(), row()]), input() as never,
    )).rejects.toBeInstanceOf(IndiaGstRecipientRegistrationAtTimeOfSupplyConflictError);
  });

  test("malformed, stale, crossed, duplicate and tampered predecessor evidence fails closed", async () => {
    const service = new IndiaGstRecipientRegistrationAtTimeOfSupplyService();
    const defects: readonly Row[] = [
      row({ status_as_of: "2043-06-14" }),
      row({ gst_registration_status: "cancelled" }),
      row({ gst_status_source: "party_profile" }),
      row({ status_recipient_evidence_hash: "0".repeat(64) }),
      row({ lineage_reservation_id: id(29641) }),
      row({ lineage_snapshot_hash: "0".repeat(64) }),
      row({ attribution_snapshot: null }),
      row({ payment_date: "2043-06-14" }),
      row({ service_source: "clock" }),
      row({ approval_form: "sez_rules_form_g" }),
    ];
    for (const candidate of defects) {
      await expect(service.resolve(tx([candidate]), input() as never)).rejects
        .toBeInstanceOf(IndiaGstRecipientRegistrationAtTimeOfSupplyConflictError);
    }
    await expect(service.resolve(tx([row()]), input({ recipientRegistrationStatusEvidenceHash: "0".repeat(64) }) as never)).rejects
      .toBeInstanceOf(IndiaGstRecipientRegistrationAtTimeOfSupplyConflictError);
    await expect(service.resolve(tx([row()]), input({ timeOfSupplyEvidenceHash: "0".repeat(64) }) as never)).rejects
      .toBeInstanceOf(IndiaGstRecipientRegistrationAtTimeOfSupplyConflictError);
    await expect(service.resolve(tx([row()]), input({ recipientRegistrationId: id(29642) }) as never)).rejects
      .toBeInstanceOf(IndiaGstRecipientRegistrationAtTimeOfSupplyConflictError);
  });

  test("input and row objects are exact, accessor-free, symbol-free and unchanged", async () => {
    const exact = input();
    const hostile: unknown[] = [null, [], Object.assign(Object.create({ inherited: true }), exact), { ...exact, extra: true }, new Proxy({ ...exact }, {})];
    for (const key of Object.keys(exact)) {
      const missing = { ...exact } as Mutable;
      delete missing[key];
      hostile.push(missing);
    }
    const accessor = { ...exact } as Mutable;
    Object.defineProperty(accessor, "timeOfSupplyDate", { enumerable: true, get: () => "2043-06-15" });
    hostile.push(accessor);
    const symbolic = { ...exact } as Mutable;
    symbolic[Symbol("hostile")] = true;
    hostile.push(symbolic);
    for (const value of hostile) {
      const statements: string[] = [];
      await expect(new IndiaGstRecipientRegistrationAtTimeOfSupplyService().resolve(tx([row()], statements), value as never)).rejects
        .toBeInstanceOf(IndiaGstRecipientRegistrationAtTimeOfSupplyValidationError);
      expect(statements).toHaveLength(0);
    }
    const before = JSON.stringify(exact);
    await new IndiaGstRecipientRegistrationAtTimeOfSupplyService().resolve(tx([row()]), exact as never);
    expect(JSON.stringify(exact)).toBe(before);
  });

  test("source has no clock or write authority", async () => {
    const source = await Bun.file(new URL(
      "../src/contexts/tax-fiscal/india-gst-recipient-registration-at-time-of-supply.ts",
      import.meta.url,
    )).text();
    expect(source).not.toMatch(/\bDate\s*\(|Date\.UTC|Date\.now|new\s+Date/);
    expect(source).not.toMatch(/\b(?:INSERT\s+INTO|UPDATE\s+public\.|DELETE\s+FROM|TRUNCATE|LOCK|FOR\s+(?:UPDATE|SHARE))\b/i);
  });
});
