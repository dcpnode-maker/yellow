import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  IndiaGstRegistrationAtTimeOfSupplyConflictError,
  IndiaGstRegistrationAtTimeOfSupplyNotFoundError,
  IndiaGstRegistrationAtTimeOfSupplyService,
  IndiaGstRegistrationAtTimeOfSupplyValidationError,
  createPositiveTaxAttributionSnapshot,
} from "../src/contexts/tax-fiscal";
import { Database } from "../src/kernel";
import { SQL } from "bun";

const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const digest = (value: unknown) => new Bun.CryptoHasher("sha256").update(JSON.stringify(value)).digest("hex");
const T = id(29500), B = id(29600), P = id(29501), PB = id(29601), ACTOR = id(29502), GUEST = id(29503);
const UNIT_TYPE = id(29504), SELLABLE = id(29505), RATE = id(29506), EXT = id(29507);
const RES = id(29508), SEG = id(29509), HOLD = id(29510), ATTR = id(29511), HOLD_BIND = id(29512), LINE = id(29513);
const REG = id(29514), LOC = id(29515), STATUS = id(29516), SERVICE = id(29517), PAYMENT = id(29518), INVOICE = id(29519);
const QUOTE = "a".repeat(64), STATUS_EVIDENCE = "c".repeat(64), SERVICE_EVIDENCE = "e".repeat(64);
const PAYMENT_EVIDENCE = "1".repeat(64), INVOICE_EVIDENCE = "3".repeat(64), CONTENT = "5".repeat(64), ORDINARY = "6".repeat(64);
const KEY = "in.order295.gst.27", SERVICE_DATE = "2043-06-01", TOS_DATE = "2043-06-15", INVOICE_DATE = "2043-07-01";
const PERIOD = "[2043-06-01 15:00:00+00,2043-06-02 15:00:00+00)";

const jurisdiction = { extensionId: EXT, ownerTenantId: T, key: KEY, version: "7", contentHash: CONTENT };
const registrationBody = {
  registrationId: REG, tenantId: T, propertyNode: P, scheme: "in-gstin", currency: "INR", jurisdiction,
  gstin: "27AAPFU0939F1ZV", stateCode: "27", legalName: "Order 295 Hotel Private Limited",
  tradeName: "Order 295 Hotel", addressLine: "1 Marine Drive", locality: "Mumbai", postalCode: "400001",
};
const REG_HASH = digest(registrationBody);
const LOCATION_HASH = digest({
  tenantId: T, supplierServiceLocationId: LOC, propertyNode: P, jurisdiction,
  supplier: { registrationId: REG, evidenceHash: REG_HASH }, serviceScope: "lodging_accommodation",
  registeredPlace: { kind: "principal_place_of_business", stateCode: "27", addressLine: "1 Marine Drive", locality: "Mumbai", postalCode: "400001" },
  locationBasis: "supply_made_from_registered_place_of_business", legalRule: "IGST_ACT_2_15_A",
});
const attribution = createPositiveTaxAttributionSnapshot({
  origin: { kind: "rate_quote", quoteHash: QUOTE }, currency: "INR",
  line: { lineId: "room", revenueGroup: "room_revenue", amountMinor: 10_500n, nights: 1, personNights: 2, roomNights: [{ businessDate: SERVICE_DATE, amountMinor: 10_500n }] },
  assignments: [{ businessDate: SERVICE_DATE, jurisdictionKey: KEY, evidenceRef: `tax-assignment:${QUOTE}` }],
  jurisdiction: { extensionId: EXT, ownerTenantId: T, key: KEY, version: 7, contentHash: CONTENT, evidenceRef: `tax-jurisdiction:${CONTENT}` },
  evaluation: { schemaVersion: 1, jurisdictionKey: KEY, country: "IN", priceDisplay: "tax_exclusive", rounding: "line", inputTotalMinor: 10_500n, baseTotalMinor: 10_500n, taxTotalMinor: 0n, grandTotalMinor: 10_500n, taxes: [{ code: "GST_ROOM", name: "GST", taxMinor: 0n, components: [{ lineId: "room", revenueGroup: "room_revenue", baseMinor: 10_500n, taxMinor: 0n, rateBasisPoints: 0 }] }] },
});
const STATUS_HASH = digest({
  tenantId: T, supplierGstRegistrationStatusId: STATUS, propertyNode: P,
  supplierServiceLocation: { id: LOC, evidenceHash: LOCATION_HASH }, supplier: { registrationId: REG, evidenceHash: REG_HASH },
  statusAsOf: TOS_DATE, gstRegistration: { status: "active", taxpayerType: "regular", source: "gst_common_portal", evidenceSha256: STATUS_EVIDENCE },
  legalRule: "CGST_ACT_25_29_30_AND_RULE_21A_REGISTRATION_STATUS",
});
const TOS_HASH = digest({
  serviceProvisionSnapshotId: SERVICE, paymentReceiptSnapshotId: PAYMENT, invoiceIssueSnapshotId: INVOICE,
  propertyNode: P, reservationId: RES,
  reservationLineage: { lineageId: LINE, holdBindingId: HOLD_BIND, attributionId: ATTR, reservationId: RES, segmentId: SEG, originQuoteHash: QUOTE, snapshotHash: attribution.snapshotHash, currency: "INR" },
  attribution: { originKind: "rate_quote", lineId: "room", revenueGroup: "room_revenue" },
  serviceProvisionDate: SERVICE_DATE, paymentReceiptDate: TOS_DATE, invoiceIssueDate: INVOICE_DATE, deadlineDate: INVOICE_DATE,
  candidateDates: { invoiceIssueDate: INVOICE_DATE, paymentReceiptDate: TOS_DATE }, branch: "section13_2_a_invoice_or_payment", timeOfSupplyDate: TOS_DATE,
  regime: "ordinary_rule47_30_day", source: "governed_rule47_ordinary_regime_record", legalRule: "CGST_ACT_13_2_A_OR_B_ORDINARY_TIME_OF_SUPPLY",
  ordinaryRegimeEvidenceSha256: ORDINARY, invoiceSeries: "FY2043", invoiceSerial: "000042", supplierBooksEntryDate: TOS_DATE, supplierBankCreditDate: TOS_DATE,
  coverageScope: "full_attribution", serviceProvisionSource: "governed_service_provision_record", serviceProvisionLegalRule: "CGST_ACT_13_2_B_SERVICE_PROVISION_DATE_INPUT_ONLY",
  paymentReceiptSource: "governed_supplier_payment_receipt_record", paymentReceiptLegalRule: "CGST_ACT_13_2_EXPLANATION_II_PAYMENT_RECEIPT_DATE_INPUT_ONLY",
  invoiceIssueSource: "governed_supplier_tax_invoice_record", invoiceIssueLegalRule: "CGST_ACT_13_2_INVOICE_DATE_INPUT_ONLY",
  serviceProvisionEvidenceSha256: SERVICE_EVIDENCE, paymentReceiptEvidenceSha256: PAYMENT_EVIDENCE, invoiceIssueEvidenceSha256: INVOICE_EVIDENCE,
  amountMinor: "10500", currency: "INR",
});

const DEPLOY_URL = process.env.YELLOW_ORDER295_DEPLOY_DATABASE_URL;
const RUNTIME_URL = process.env.YELLOW_ORDER295_DATABASE_URL;
const live = DEPLOY_URL && RUNTIME_URL ? describe.serial : describe.skip;
let deploy: SQL | undefined;
let runtime: Database | undefined;

async function cleanup(): Promise<void> {
  if (!deploy) return;
  for (const table of [
    "india_gst_accommodation_invoice_issue_snapshot", "india_gst_accommodation_payment_receipt_snapshot",
    "india_gst_accommodation_service_provision_snapshot", "india_gst_supplier_registration_status_snapshot",
    "india_gst_supplier_service_location", "property_fiscal_registration", "tax_attribution_reservation_binding",
    "tax_attribution_hold_binding", "tax_attribution_snapshot", "reservation_segment", "reservation", "hold",
    "sellable_unit", "rate_plan", "unit_type", "party", "app_user", "extension", "org_node",
  ]) await deploy.unsafe(`DELETE FROM public.${table} WHERE tenant_id IN ('${T}', '${B}')`);
  await deploy.unsafe(`DELETE FROM public.tenant WHERE id IN ('${T}', '${B}')`);
}

async function seed(): Promise<void> {
  if (!deploy) throw new Error("deployment database is unavailable");
  await deploy`INSERT INTO tenant(id,slug,name,tier,status) VALUES (${T}::uuid,'order295-a','Order 295 A','shared','active'),(${B}::uuid,'order295-b','Order 295 B','shared','active')`;
  await deploy`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES
    (${P}::uuid,${T}::uuid,'order295a.property'::ltree,'property','Order 295 A','Asia/Kolkata','INR'),
    (${PB}::uuid,${B}::uuid,'order295b.property'::ltree,'property','Order 295 B','Asia/Kolkata','INR')`;
  await deploy`INSERT INTO app_user(id,tenant_id,email,display_name,status) VALUES (${ACTOR}::uuid,${T}::uuid,'actor@order295.local','Order 295 Actor','active')`;
  await deploy`INSERT INTO party(id,tenant_id,kind,display_name,status) VALUES (${GUEST}::uuid,${T}::uuid,'person','Order 295 Guest','active')`;
  await deploy`INSERT INTO unit_type(id,tenant_id,property_node,code,name,profile_key,max_occupancy) VALUES (${UNIT_TYPE}::uuid,${T}::uuid,${P}::uuid,'O295','Order 295 Room','hotel',4)`;
  await deploy`INSERT INTO sellable_unit(id,tenant_id,unit_type_id,name,status) VALUES (${SELLABLE}::uuid,${T}::uuid,${UNIT_TYPE}::uuid,'Order 295 Sellable','active')`;
  await deploy`INSERT INTO rate_plan(id,tenant_id,property_node,code,name,currency,tax_inclusive,status) VALUES (${RATE}::uuid,${T}::uuid,${P}::uuid,'O295-IN','Order 295 India','INR',false,'active')`;
  await deploy`INSERT INTO extension(id,tenant_id,type,key,version,effective,content,status) VALUES (${EXT}::uuid,${T}::uuid,'tax_jurisdiction',${KEY},7,'[2030-01-01 00:00:00+00,)'::tstzrange,'{"country":"IN","price_display":"tax_exclusive","rounding":"line","taxes":[]}'::jsonb,'active')`;
  await deploy`INSERT INTO reservation(id,tenant_id,property_node,confirmation_no,status,primary_party,booker_party,channel_code,currency) VALUES (${RES}::uuid,${T}::uuid,${P}::uuid,'O295','reserved',${GUEST}::uuid,${GUEST}::uuid,'direct','INR')`;
  await deploy`INSERT INTO reservation_segment(id,tenant_id,reservation_id,seq,unit_type_id,sellable_unit_id,period,adults,children,rate_plan_id,status) VALUES (${SEG}::uuid,${T}::uuid,${RES}::uuid,1,${UNIT_TYPE}::uuid,${SELLABLE}::uuid,${PERIOD}::tstzrange,2,'[]'::jsonb,${RATE}::uuid,'booked')`;
  await deploy`INSERT INTO hold(id,tenant_id,property_node,sellable_unit_id,period,kind,holder,expires_at,status) VALUES (${HOLD}::uuid,${T}::uuid,${P}::uuid,${SELLABLE}::uuid,${PERIOD}::tstzrange,'cart','{}'::jsonb,'2043-06-02 15:00:00+00','consumed')`;
  await deploy`INSERT INTO tax_attribution_snapshot(tenant_id,id,property_node,actor_id,schema_version,origin_kind,origin_quote_hash,snapshot_hash,currency,snapshot) VALUES (${T}::uuid,${ATTR}::uuid,${P}::uuid,${ACTOR}::uuid,1,'rate_quote',${QUOTE},${attribution.snapshotHash},'INR',${JSON.stringify(attribution)}::jsonb)`;
  await deploy`INSERT INTO tax_attribution_hold_binding(tenant_id,id,property_node,bound_by,hold_id,attribution_id,sellable_unit_id,period,origin_quote_hash,snapshot_hash,currency) VALUES (${T}::uuid,${HOLD_BIND}::uuid,${P}::uuid,${ACTOR}::uuid,${HOLD}::uuid,${ATTR}::uuid,${SELLABLE}::uuid,${PERIOD}::tstzrange,${QUOTE},${attribution.snapshotHash},'INR')`;
  await deploy`INSERT INTO tax_attribution_reservation_binding(tenant_id,id,property_node,linked_by,binding_id,hold_id,attribution_id,reservation_id,segment_id,sellable_unit_id,period,origin_quote_hash,snapshot_hash,currency) VALUES (${T}::uuid,${LINE}::uuid,${P}::uuid,${ACTOR}::uuid,${HOLD_BIND}::uuid,${HOLD}::uuid,${ATTR}::uuid,${RES}::uuid,${SEG}::uuid,${SELLABLE}::uuid,${PERIOD}::tstzrange,${QUOTE},${attribution.snapshotHash},'INR')`;
  await deploy`INSERT INTO property_fiscal_registration(tenant_id,id,property_node,scheme,currency,jurisdiction_extension_id,jurisdiction_owner_tenant_id,jurisdiction_key,jurisdiction_version,jurisdiction_content_hash,registration_number,region_code,legal_name,trade_name,address_line,locality,postal_code) VALUES (${T}::uuid,${REG}::uuid,${P}::uuid,'in-gstin','INR',${EXT}::uuid,${T}::uuid,${KEY},7,${CONTENT},${registrationBody.gstin},'27',${registrationBody.legalName},${registrationBody.tradeName},${registrationBody.addressLine},${registrationBody.locality},${registrationBody.postalCode})`;
  await deploy`INSERT INTO india_gst_supplier_service_location(tenant_id,id,supplier_registration_id,supplier_evidence_hash,service_scope,registered_place_kind,location_basis,legal_rule) VALUES (${T}::uuid,${LOC}::uuid,${REG}::uuid,${REG_HASH},'lodging_accommodation','principal_place_of_business','supply_made_from_registered_place_of_business','IGST_ACT_2_15_A')`;
  await deploy`INSERT INTO india_gst_supplier_registration_status_snapshot(tenant_id,id,supplier_registration_id,supplier_registration_evidence_hash,status_as_of,gst_registration_status,gst_taxpayer_type,gst_status_source,gst_status_evidence_sha256,legal_rule) VALUES (${T}::uuid,${STATUS}::uuid,${REG}::uuid,${REG_HASH},${TOS_DATE}::date,'active','regular','gst_common_portal',${STATUS_EVIDENCE},'CGST_ACT_25_29_30_AND_RULE_21A_REGISTRATION_STATUS')`;
  await deploy`INSERT INTO india_gst_accommodation_service_provision_snapshot(tenant_id,id,property_node,reservation_lineage_id,hold_binding_id,attribution_id,reservation_id,segment_id,origin_quote_hash,snapshot_hash,currency,service_provision_date,service_provision_source,service_provision_evidence_sha256,legal_rule) VALUES (${T}::uuid,${SERVICE}::uuid,${P}::uuid,${LINE}::uuid,${HOLD_BIND}::uuid,${ATTR}::uuid,${RES}::uuid,${SEG}::uuid,${QUOTE},${attribution.snapshotHash},'INR',${SERVICE_DATE}::date,'governed_service_provision_record',${SERVICE_EVIDENCE},'CGST_ACT_13_2_B_SERVICE_PROVISION_DATE_INPUT_ONLY')`;
  await deploy`INSERT INTO india_gst_accommodation_payment_receipt_snapshot(tenant_id,id,service_provision_snapshot_id,currency,amount_minor,coverage_scope,supplier_books_entry_date,supplier_bank_credit_date,payment_receipt_date,payment_receipt_source,payment_receipt_evidence_sha256,legal_rule) VALUES (${T}::uuid,${PAYMENT}::uuid,${SERVICE}::uuid,'INR',10500,'full_attribution',${TOS_DATE}::date,${TOS_DATE}::date,${TOS_DATE}::date,'governed_supplier_payment_receipt_record',${PAYMENT_EVIDENCE},'CGST_ACT_13_2_EXPLANATION_II_PAYMENT_RECEIPT_DATE_INPUT_ONLY')`;
  await deploy`INSERT INTO india_gst_accommodation_invoice_issue_snapshot(tenant_id,id,service_provision_snapshot_id,currency,amount_minor,coverage_scope,invoice_series,invoice_serial,invoice_issue_date,invoice_issue_source,invoice_issue_evidence_sha256,legal_rule) VALUES (${T}::uuid,${INVOICE}::uuid,${SERVICE}::uuid,'INR',10500,'full_attribution','FY2043','000042',${INVOICE_DATE}::date,'governed_supplier_tax_invoice_record',${INVOICE_EVIDENCE},'CGST_ACT_13_2_INVOICE_DATE_INPUT_ONLY')`;
}

const input = (overrides: Record<string, unknown> = {}) => ({
  tenantId: T, propertyNode: P, reservationId: RES, supplierServiceLocationId: LOC, supplierGstRegistrationStatusId: STATUS,
  serviceProvisionSnapshotId: SERVICE, paymentReceiptSnapshotId: PAYMENT, invoiceIssueSnapshotId: INVOICE,
  statusAsOf: TOS_DATE, timeOfSupplyDate: TOS_DATE, serviceProvisionDate: SERVICE_DATE, paymentReceiptDate: TOS_DATE, invoiceIssueDate: INVOICE_DATE,
  ordinaryRegimeSource: "governed_rule47_ordinary_regime_record", ordinaryRegimeEvidenceSha256: ORDINARY,
  supplierRegistrationStatusEvidenceHash: STATUS_HASH, timeOfSupplyEvidenceHash: TOS_HASH, ...overrides,
});
async function effects(): Promise<Record<string, number>> {
  const rows = await deploy!<Array<Record<string, number>>>`SELECT
    (SELECT count(*)::int FROM property_fiscal_registration WHERE tenant_id IN (${T}::uuid,${B}::uuid)) registrations,
    (SELECT count(*)::int FROM india_gst_supplier_registration_status_snapshot WHERE tenant_id IN (${T}::uuid,${B}::uuid)) statuses,
    (SELECT count(*)::int FROM india_gst_accommodation_service_provision_snapshot WHERE tenant_id IN (${T}::uuid,${B}::uuid)) services,
    (SELECT count(*)::int FROM india_gst_accommodation_payment_receipt_snapshot WHERE tenant_id IN (${T}::uuid,${B}::uuid)) payments,
    (SELECT count(*)::int FROM india_gst_accommodation_invoice_issue_snapshot WHERE tenant_id IN (${T}::uuid,${B}::uuid)) invoices,
    (SELECT count(*)::int FROM tax_attribution_snapshot WHERE tenant_id IN (${T}::uuid,${B}::uuid)) attributions,
    (SELECT count(*)::int FROM tax_attribution_reservation_binding WHERE tenant_id IN (${T}::uuid,${B}::uuid)) lineages,
    (SELECT count(*)::int FROM fact_log WHERE tenant_id IN (${T}::uuid,${B}::uuid)) facts,
    (SELECT count(*)::int FROM outbox WHERE tenant_id IN (${T}::uuid,${B}::uuid)) events,
    (SELECT count(*)::int FROM document WHERE tenant_id IN (${T}::uuid,${B}::uuid)) documents,
    (SELECT count(*)::int FROM fiscal_submission WHERE tenant_id IN (${T}::uuid,${B}::uuid)) submissions,
    (SELECT count(*)::int FROM journal WHERE tenant_id IN (${T}::uuid,${B}::uuid)) journals,
    (SELECT count(*)::int FROM posting_line WHERE tenant_id IN (${T}::uuid,${B}::uuid)) postings,
    (SELECT count(*)::int FROM api_idempotency WHERE tenant_id IN (${T}::uuid,${B}::uuid)) idempotency`;
  return rows[0]!;
}

live("Order 295 real PostgreSQL complete-chain proof", () => {
  beforeAll(async () => {
    deploy = new SQL(DEPLOY_URL!, { max: 4, prepare: false });
    runtime = Database.connect(RUNTIME_URL!, { maxConnections: 4, prepare: false });
    await cleanup();
    await seed();
  });
  afterAll(async () => {
    await cleanup();
    await runtime?.close();
    await deploy?.close({ timeout: 0 });
  });

  test("yellow_runtime/app_role reads one chain, preserves exact hashes, and performs no effects", async () => {
    const before = await effects();
    const result = await runtime!.withTenantTransaction(T, async (tx) => {
      expect(await tx<Array<{ session_user: string; current_user: string; tenant_id: string }>>`SELECT session_user::text,current_user::text,current_setting('app.tenant_id',true) tenant_id`).toEqual([{ session_user: "yellow_runtime", current_user: "app_role", tenant_id: T }]);
      return new IndiaGstRegistrationAtTimeOfSupplyService().resolve(tx, input() as never);
    });
    expect(result.result).toBe("active_at_time_of_supply");
    expect(result.supplier).toEqual({ registrationId: REG, evidenceHash: REG_HASH });
    expect(result.supplierServiceLocation).toEqual({ id: LOC, evidenceHash: LOCATION_HASH });
    expect(result.supplierRegistrationStatusEvidenceHash).toBe(STATUS_HASH);
    expect(result.timeOfSupplyEvidenceHash).toBe(TOS_HASH);
    expect(result.timeOfSupply.evidenceHash).toBe(TOS_HASH);
    expect(result).not.toHaveProperty("tenantId");
    expect(result).not.toHaveProperty("gstin");
    expect(await effects()).toEqual(before);
  }, 30_000);

  test("RLS concealment, duplicate identity and hostile predecessor evidence fail closed", async () => {
    const before = await effects();
    await expect(runtime!.withTenantTransaction(B, (tx) => new IndiaGstRegistrationAtTimeOfSupplyService().resolve(tx, input() as never))).rejects.toBeInstanceOf(IndiaGstRegistrationAtTimeOfSupplyNotFoundError);
    await expect(runtime!.withTenantTransaction(T, (tx) => new IndiaGstRegistrationAtTimeOfSupplyService().resolve(tx, input({ supplierRegistrationStatusEvidenceHash: "9".repeat(64) }) as never))).rejects.toBeInstanceOf(IndiaGstRegistrationAtTimeOfSupplyConflictError);
    await expect(runtime!.withTenantTransaction(T, (tx) => new IndiaGstRegistrationAtTimeOfSupplyService().resolve(tx, input({ timeOfSupplyDate: "2043-06-16" }) as never))).rejects.toBeInstanceOf(IndiaGstRegistrationAtTimeOfSupplyValidationError);
    await expect(runtime!.withTenantTransaction(T, (tx) => new IndiaGstRegistrationAtTimeOfSupplyService().resolve(tx, input({ invoiceIssueSnapshotId: id(29619) }) as never))).rejects.toBeInstanceOf(IndiaGstRegistrationAtTimeOfSupplyNotFoundError);
    let duplicateState: unknown;
    try { await deploy!`INSERT INTO india_gst_supplier_registration_status_snapshot SELECT * FROM india_gst_supplier_registration_status_snapshot WHERE tenant_id=${T}::uuid AND id=${STATUS}::uuid`; } catch (error) { duplicateState = (error as { errno?: unknown; code?: unknown }).errno ?? (error as { code?: unknown }).code; }
    expect(duplicateState).toBe("23505");
    expect(await effects()).toEqual(before);
  }, 30_000);
});
