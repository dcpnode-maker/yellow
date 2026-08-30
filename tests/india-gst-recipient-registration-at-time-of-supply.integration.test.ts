import { describe, expect, test, beforeAll, afterAll, setDefaultTimeout } from "bun:test";
import { SQL } from "bun";
import {
  IndiaGstRecipientRegistrationAtTimeOfSupplyConflictError,
  IndiaGstRecipientRegistrationAtTimeOfSupplyNotFoundError,
  IndiaGstRecipientRegistrationAtTimeOfSupplyService,
  IndiaGstRecipientRegistrationAtTimeOfSupplyValidationError,
} from "../src/contexts/tax-fiscal";
import { createPositiveTaxAttributionSnapshot } from "../src/contexts/tax-fiscal/attribution";
import { Database } from "../src/kernel";

setDefaultTimeout(60_000);

const DEPLOY_URL = process.env.YELLOW_ORDER296_DEPLOY_DATABASE_URL;
const RUNTIME_URL = process.env.YELLOW_ORDER296_DATABASE_URL ?? process.env.YELLOW_RUNTIME_DATABASE_URL;
if (process.env.YELLOW_REQUIRE_ORDER296_DATABASE === "1" && (!DEPLOY_URL || !RUNTIME_URL)) {
  throw new Error("Order 296 proof requires deploy and runtime PostgreSQL URLs");
}
const live = DEPLOY_URL && RUNTIME_URL ? describe.serial : describe.skip;
const id = (n: number): string => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const hash = (value: unknown): string => new Bun.CryptoHasher("sha256").update(JSON.stringify(value)).digest("hex");

type Fixture = ReturnType<typeof fixture>;
function fixture(base: number) {
  const tenant = id(base), property = id(base + 1), actor = id(base + 2), guest = id(base + 3);
  const unitType = id(base + 4), sellable = id(base + 5), ratePlan = id(base + 6), extension = id(base + 7);
  const reservation = id(base + 8), segment = id(base + 9), hold = id(base + 10), attributionId = id(base + 11);
  const holdBinding = id(base + 12), lineage = id(base + 13), registration = id(base + 14), status = id(base + 15);
  const service = id(base + 16), payment = id(base + 17), invoice = id(base + 18);
  const quoteHash = "a".repeat(64), serviceEvidence = "b".repeat(64), paymentEvidence = "c".repeat(64);
  const invoiceEvidence = "d".repeat(64), statusEvidence = "e".repeat(64), contentHash = "f".repeat(64);
  const key = `in.order296.${base === 29600 ? "27" : "29"}`;
  const statusAsOf = "2043-06-15", serviceDate = "2043-06-01", paymentDate = statusAsOf, invoiceDate = "2043-07-01";
  const period = "[2043-06-01 10:00:00+00,2043-06-02 10:00:00+00)";
  const jurisdiction = { extensionId: extension, ownerTenantId: tenant, key, version: "7", contentHash };
  const recipientBody = {
    registrationId: registration, tenantId: tenant, partyId: guest, scheme: "in-gstin",
    gstin: base === 29600 ? "27AAPFU0939F1ZV" : "29AAPFU0939F1ZR", stateCode: base === 29600 ? "27" : "29",
    legalName: `Order 296 Recipient ${base}`, tradeName: `Order 296 Recipient ${base}`,
    addressLine1: base === 29600 ? "1 Marine Drive" : "1 Residency Road", locality: base === 29600 ? "Mumbai" : "Bengaluru", pin: base === 29600 ? "400001" : "560001",
  };
  const registrationHash = hash({
    registrationId: registration, tenantId: tenant, partyId: guest,
    scheme: "in-gstin",
    gstin: recipientBody.gstin, stateCode: recipientBody.stateCode,
    legalName: recipientBody.legalName, tradeName: recipientBody.tradeName,
    addressLine1: recipientBody.addressLine1, locality: recipientBody.locality,
    pin: recipientBody.pin,
  });
  // The recipient side is deliberately independent of supplier location; the hash below
  // still documents that this proof does not consume an Order284/289 supplier root.
  const sezStatusBody = {
    recipientSezStatusId: status,
    recipient: { partyId: guest, registrationId: registration, evidenceHash: registrationHash },
    statusAsOf, gstRegistration: { status: "active", taxpayerType: "regular", source: "gst_common_portal", evidenceSha256: statusEvidence },
    sezStatus: "affirmatively_non_sez_regular", approval: null,
    legalRule: "IGST_ACT_7_5_B_AND_8_2_RECIPIENT_STATUS",
  };
  const recipientStatusHash = hash({ tenantId: tenant, ...sezStatusBody });
  const attribution = createPositiveTaxAttributionSnapshot({
    origin: { kind: "rate_quote", quoteHash }, currency: "INR",
    line: { lineId: "room", revenueGroup: "room_revenue", amountMinor: 10500n, nights: 1, personNights: 2, roomNights: [{ businessDate: serviceDate, amountMinor: 10500n }] },
    assignments: [{ businessDate: serviceDate, jurisdictionKey: key, evidenceRef: `tax-assignment:${quoteHash}` }],
    jurisdiction: { extensionId: extension, ownerTenantId: tenant, key, version: 7, contentHash, evidenceRef: `tax-jurisdiction:${contentHash}` },
    evaluation: { schemaVersion: 1, jurisdictionKey: key, country: "IN", priceDisplay: "tax_exclusive", rounding: "line", inputTotalMinor: 10500n, baseTotalMinor: 10500n, taxTotalMinor: 0n, grandTotalMinor: 10500n, taxes: [{ code: "GST_ROOM", name: "GST", taxMinor: 0n, components: [{ lineId: "room", revenueGroup: "room_revenue", baseMinor: 10500n, taxMinor: 0n, rateBasisPoints: 0 }] }] },
  });
  const tosBody = {
    serviceProvisionSnapshotId: service, paymentReceiptSnapshotId: payment, invoiceIssueSnapshotId: invoice, propertyNode: property, reservationId: reservation,
    reservationLineage: { lineageId: lineage, holdBindingId: holdBinding, attributionId, reservationId: reservation, segmentId: segment, originQuoteHash: quoteHash, snapshotHash: attribution.snapshotHash, currency: "INR" },
    attribution: { originKind: "rate_quote", lineId: "room", revenueGroup: "room_revenue" }, serviceProvisionDate: serviceDate, paymentReceiptDate: paymentDate, invoiceIssueDate: invoiceDate, deadlineDate: invoiceDate,
    candidateDates: { invoiceIssueDate: invoiceDate, paymentReceiptDate: paymentDate }, branch: "section13_2_a_invoice_or_payment", timeOfSupplyDate: paymentDate, regime: "ordinary_rule47_30_day", source: "governed_rule47_ordinary_regime_record", legalRule: "CGST_ACT_13_2_A_OR_B_ORDINARY_TIME_OF_SUPPLY", ordinaryRegimeEvidenceSha256: "1".repeat(64), invoiceSeries: "FY2043", invoiceSerial: `296-${tenant.slice(-4)}`,
    supplierBooksEntryDate: paymentDate, supplierBankCreditDate: paymentDate, coverageScope: "full_attribution", serviceProvisionSource: "governed_service_provision_record", serviceProvisionLegalRule: "CGST_ACT_13_2_B_SERVICE_PROVISION_DATE_INPUT_ONLY", paymentReceiptSource: "governed_supplier_payment_receipt_record", paymentReceiptLegalRule: "CGST_ACT_13_2_EXPLANATION_II_PAYMENT_RECEIPT_DATE_INPUT_ONLY", invoiceIssueSource: "governed_supplier_tax_invoice_record", invoiceIssueLegalRule: "CGST_ACT_13_2_INVOICE_DATE_INPUT_ONLY", serviceProvisionEvidenceSha256: serviceEvidence, paymentReceiptEvidenceSha256: paymentEvidence, invoiceIssueEvidenceSha256: invoiceEvidence, amountMinor: "10500", currency: "INR",
  };
  return {
    tenant, property, actor, guest, unitType, sellable, ratePlan, extension, reservation, segment, hold, attributionId, holdBinding, lineage, registration, status, service, payment, invoice, quoteHash, serviceEvidence, paymentEvidence, invoiceEvidence, statusEvidence, contentHash, key, statusAsOf, serviceDate, paymentDate, invoiceDate, period, jurisdiction, recipientBody, registrationHash, attribution, tosBody, recipientStatusHash, tosHash: hash({ tenantId: tenant, ...tosBody }),
  };
}

const A = fixture(29600);
const B = fixture(29700);
let deploy: SQL | undefined;
let runtime: Database | undefined;

async function cleanup(): Promise<void> {
  if (!deploy) return;
  for (const table of [
    "india_gst_recipient_sez_status", "india_gst_accommodation_invoice_issue_snapshot", "india_gst_accommodation_payment_receipt_snapshot", "india_gst_accommodation_service_provision_snapshot",
    "api_idempotency",
    "tax_attribution_reservation_binding", "tax_attribution_hold_binding", "tax_attribution_snapshot", "reservation_segment", "reservation", "hold", "sellable_unit", "rate_plan", "unit_type", "party_fiscal_registration", "party", "app_user", "extension", "org_node", "tenant",
  ]) {
    const key = table === "tenant" ? "id" : "tenant_id";
    await deploy.unsafe(`DELETE FROM public.${table} WHERE ${key} IN ('${A.tenant}','${B.tenant}')`);
  }
}

async function seed(f: Fixture): Promise<void> {
  if (!deploy) throw new Error("deployment database unavailable");
  await deploy`INSERT INTO tenant(id,slug,name,tier,status) VALUES (${f.tenant}::uuid,${`order296-${f.tenant.slice(-4)}`},'Order 296 proof','shared','active')`;
  await deploy`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES (${f.property}::uuid,${f.tenant}::uuid,${`order296-${f.tenant.slice(-4)}.property`}::ltree,'property','Order 296 Hotel','Asia/Kolkata','INR')`;
  await deploy`INSERT INTO app_user(id,tenant_id,email,display_name,status) VALUES (${f.actor}::uuid,${f.tenant}::uuid,${`actor-${f.tenant.slice(-4)}@order296.local`},'Order 296 Actor','active')`;
  await deploy`INSERT INTO party(id,tenant_id,kind,display_name,status) VALUES (${f.guest}::uuid,${f.tenant}::uuid,'org','Order 296 Recipient','active')`;
  await deploy`INSERT INTO unit_type(id,tenant_id,property_node,code,name,profile_key,max_occupancy) VALUES (${f.unitType}::uuid,${f.tenant}::uuid,${f.property}::uuid,${`O296-${f.tenant.slice(-4)}`},'Order 296 Room','hotel',4)`;
  await deploy`INSERT INTO sellable_unit(id,tenant_id,unit_type_id,name,status) VALUES (${f.sellable}::uuid,${f.tenant}::uuid,${f.unitType}::uuid,'Order 296 Sellable','active')`;
  await deploy`INSERT INTO rate_plan(id,tenant_id,property_node,code,name,currency,tax_inclusive,status) VALUES (${f.ratePlan}::uuid,${f.tenant}::uuid,${f.property}::uuid,${`O296-${f.tenant.slice(-4)}`},'Order 296 India','INR',false,'active')`;
  await deploy`INSERT INTO extension(id,tenant_id,type,key,version,effective,content,status) VALUES (${f.extension}::uuid,${f.tenant}::uuid,'tax_jurisdiction',${f.key},7,'[2030-01-01 00:00:00+00,)'::tstzrange,'{"country":"IN","price_display":"tax_exclusive","rounding":"line","taxes":[]}'::jsonb,'active')`;
  await deploy`INSERT INTO reservation(id,tenant_id,property_node,confirmation_no,status,primary_party,booker_party,channel_code,currency) VALUES (${f.reservation}::uuid,${f.tenant}::uuid,${f.property}::uuid,${`O296-${f.tenant.slice(-4)}`},'reserved',${f.guest}::uuid,${f.guest}::uuid,'direct','INR')`;
  await deploy`INSERT INTO reservation_segment(id,tenant_id,reservation_id,seq,unit_type_id,sellable_unit_id,period,adults,children,rate_plan_id,status) VALUES (${f.segment}::uuid,${f.tenant}::uuid,${f.reservation}::uuid,1,${f.unitType}::uuid,${f.sellable}::uuid,${f.period}::tstzrange,2,'[]'::jsonb,${f.ratePlan}::uuid,'booked')`;
  await deploy`INSERT INTO hold(id,tenant_id,property_node,sellable_unit_id,period,kind,holder,expires_at,status) VALUES (${f.hold}::uuid,${f.tenant}::uuid,${f.property}::uuid,${f.sellable}::uuid,${f.period}::tstzrange,'cart','{}'::jsonb,'2043-06-02 15:00:00+00','consumed')`;
  await deploy`INSERT INTO tax_attribution_snapshot(tenant_id,id,property_node,actor_id,schema_version,origin_kind,origin_quote_hash,snapshot_hash,currency,snapshot) VALUES (${f.tenant}::uuid,${f.attributionId}::uuid,${f.property}::uuid,${f.actor}::uuid,1,'rate_quote',${f.quoteHash},${f.attribution.snapshotHash},'INR',${JSON.stringify(f.attribution)}::jsonb)`;
  await deploy`INSERT INTO tax_attribution_hold_binding(tenant_id,id,property_node,bound_by,hold_id,attribution_id,sellable_unit_id,period,origin_quote_hash,snapshot_hash,currency) VALUES (${f.tenant}::uuid,${f.holdBinding}::uuid,${f.property}::uuid,${f.actor}::uuid,${f.hold}::uuid,${f.attributionId}::uuid,${f.sellable}::uuid,${f.period}::tstzrange,${f.quoteHash},${f.attribution.snapshotHash},'INR')`;
  await deploy`INSERT INTO tax_attribution_reservation_binding(tenant_id,id,property_node,linked_by,binding_id,hold_id,attribution_id,reservation_id,segment_id,sellable_unit_id,period,origin_quote_hash,snapshot_hash,currency) VALUES (${f.tenant}::uuid,${f.lineage}::uuid,${f.property}::uuid,${f.actor}::uuid,${f.holdBinding}::uuid,${f.hold}::uuid,${f.attributionId}::uuid,${f.reservation}::uuid,${f.segment}::uuid,${f.sellable}::uuid,${f.period}::tstzrange,${f.quoteHash},${f.attribution.snapshotHash},'INR')`;
  await deploy`INSERT INTO party_fiscal_registration(tenant_id,id,party_id,scheme,registration_number,region_code,legal_name,trade_name,address_line1,locality,pin) VALUES (${f.tenant}::uuid,${f.registration}::uuid,${f.guest}::uuid,'in-gstin',${f.recipientBody.gstin},${f.recipientBody.stateCode},${f.recipientBody.legalName},${f.recipientBody.tradeName},${f.recipientBody.addressLine1},${f.recipientBody.locality},${f.recipientBody.pin})`;
  await deploy`INSERT INTO india_gst_recipient_sez_status(tenant_id,id,recipient_registration_id,recipient_registration_evidence_hash,status_as_of,gst_registration_status,gst_taxpayer_type,gst_status_source,gst_status_evidence_sha256,legal_rule) VALUES (${f.tenant}::uuid,${f.status}::uuid,${f.registration}::uuid,${f.registrationHash},${f.statusAsOf}::date,'active','regular','gst_common_portal',${f.statusEvidence},'IGST_ACT_7_5_B_AND_8_2_RECIPIENT_STATUS')`;
  await deploy`INSERT INTO india_gst_accommodation_service_provision_snapshot(tenant_id,id,property_node,reservation_lineage_id,hold_binding_id,attribution_id,reservation_id,segment_id,origin_quote_hash,snapshot_hash,currency,service_provision_date,service_provision_source,service_provision_evidence_sha256,legal_rule) VALUES (${f.tenant}::uuid,${f.service}::uuid,${f.property}::uuid,${f.lineage}::uuid,${f.holdBinding}::uuid,${f.attributionId}::uuid,${f.reservation}::uuid,${f.segment}::uuid,${f.quoteHash},${f.attribution.snapshotHash},'INR',${f.serviceDate}::date,'governed_service_provision_record',${f.serviceEvidence},'CGST_ACT_13_2_B_SERVICE_PROVISION_DATE_INPUT_ONLY')`;
  await deploy`INSERT INTO india_gst_accommodation_payment_receipt_snapshot(tenant_id,id,service_provision_snapshot_id,currency,amount_minor,coverage_scope,supplier_books_entry_date,supplier_bank_credit_date,payment_receipt_date,payment_receipt_source,payment_receipt_evidence_sha256,legal_rule) VALUES (${f.tenant}::uuid,${f.payment}::uuid,${f.service}::uuid,'INR',10500,'full_attribution',${f.paymentDate}::date,${f.paymentDate}::date,${f.paymentDate}::date,'governed_supplier_payment_receipt_record',${f.paymentEvidence},'CGST_ACT_13_2_EXPLANATION_II_PAYMENT_RECEIPT_DATE_INPUT_ONLY')`;
  await deploy`INSERT INTO india_gst_accommodation_invoice_issue_snapshot(tenant_id,id,service_provision_snapshot_id,currency,amount_minor,coverage_scope,invoice_series,invoice_serial,invoice_issue_date,invoice_issue_source,invoice_issue_evidence_sha256,legal_rule) VALUES (${f.tenant}::uuid,${f.invoice}::uuid,${f.service}::uuid,'INR',10500,'full_attribution','FY2043',${`296-${f.tenant.slice(-4)}`},${f.invoiceDate}::date,'governed_supplier_tax_invoice_record',${f.invoiceEvidence},'CGST_ACT_13_2_INVOICE_DATE_INPUT_ONLY')`;
}

function input(f: Fixture, overrides: Record<string, unknown> = {}) {
  return {
    tenantId: f.tenant, recipientPartyId: f.guest, recipientRegistrationId: f.registration, recipientSezStatusId: f.status,
    propertyNode: f.property, reservationId: f.reservation, serviceProvisionSnapshotId: f.service, paymentReceiptSnapshotId: f.payment, invoiceIssueSnapshotId: f.invoice,
    statusAsOf: f.statusAsOf, timeOfSupplyDate: f.paymentDate, serviceProvisionDate: f.serviceDate, paymentReceiptDate: f.paymentDate, invoiceIssueDate: f.invoiceDate,
    ordinaryRegimeSource: "governed_rule47_ordinary_regime_record", ordinaryRegimeEvidenceSha256: "1".repeat(64), recipientRegistrationStatusEvidenceHash: f.recipientStatusHash, timeOfSupplyEvidenceHash: f.tosHash, ...overrides,
  };
}

async function effects(): Promise<Record<string, number | string>> {
  if (!deploy) throw new Error("deployment database unavailable");
  const rows = await deploy<Array<Record<string, number | string>>>`SELECT
    (SELECT count(*)::int FROM party_fiscal_registration WHERE tenant_id IN (${A.tenant}::uuid,${B.tenant}::uuid)) registrations,
    (SELECT count(*)::int FROM india_gst_recipient_sez_status WHERE tenant_id IN (${A.tenant}::uuid,${B.tenant}::uuid)) statuses,
    (SELECT count(*)::int FROM india_gst_accommodation_service_provision_snapshot WHERE tenant_id IN (${A.tenant}::uuid,${B.tenant}::uuid)) services,
    (SELECT count(*)::int FROM tax_attribution_snapshot WHERE tenant_id IN (${A.tenant}::uuid,${B.tenant}::uuid)) attributions,
    (SELECT count(*)::int FROM fact_log WHERE tenant_id IN (${A.tenant}::uuid,${B.tenant}::uuid)) facts,
    (SELECT count(*)::int FROM outbox WHERE tenant_id IN (${A.tenant}::uuid,${B.tenant}::uuid)) events,
    (SELECT count(*)::int FROM document WHERE tenant_id IN (${A.tenant}::uuid,${B.tenant}::uuid)) documents,
    (SELECT count(*)::int FROM fiscal_submission WHERE tenant_id IN (${A.tenant}::uuid,${B.tenant}::uuid)) submissions,
    (SELECT count(*)::int FROM journal WHERE tenant_id IN (${A.tenant}::uuid,${B.tenant}::uuid)) journals,
    (SELECT count(*)::int FROM posting_line WHERE tenant_id IN (${A.tenant}::uuid,${B.tenant}::uuid)) postings,
    (SELECT count(*)::int FROM api_idempotency WHERE tenant_id IN (${A.tenant}::uuid,${B.tenant}::uuid)) idempotency`;
  return rows[0]!;
}

function expectDeepFrozen(value: unknown, seen = new Set<object>()): void {
  if (typeof value !== "object" || value === null || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBeTrue();
  for (const key of Reflect.ownKeys(value)) {
    expectDeepFrozen((value as Record<PropertyKey, unknown>)[key], seen);
  }
}

async function resolve(f: Fixture, overrides: Record<string, unknown> = {}, tenant = f.tenant) {
  if (!runtime) throw new Error("runtime database unavailable");
  return runtime.withTenantTransaction(tenant, (tx) => new IndiaGstRecipientRegistrationAtTimeOfSupplyService().resolve(tx, input(f, overrides) as never));
}

live("Order 296 real PostgreSQL recipient-registration predecessor proof", () => {
  beforeAll(async () => {
    deploy = new SQL(DEPLOY_URL!, { max: 8, prepare: false });
    runtime = Database.connect(RUNTIME_URL!, { maxConnections: 8, prepare: false });
    await cleanup();
    await seed(A);
    await seed(B);
  });
  afterAll(async () => {
    await cleanup();
    await runtime?.close();
    await deploy?.close({ timeout: 0 });
  });

  test("uses transaction-local yellow_runtime to app_role, returns exact frozen result, and writes nothing", async () => {
    if (!runtime) throw new Error("runtime database unavailable");
    const before = await effects();
    const result = await runtime.withTenantTransaction(A.tenant, async (tx) => {
      const identity = await tx<Array<{ session_user: string; current_user: string; tenant_id: string }>>`SELECT session_user::text,current_user::text,current_setting('app.tenant_id',true) AS tenant_id`;
      expect(identity).toEqual([{ session_user: "yellow_runtime", current_user: "app_role", tenant_id: A.tenant }]);
      return new IndiaGstRecipientRegistrationAtTimeOfSupplyService().resolve(tx, input(A) as never);
    });
    expect(result.result).toBe("active_recipient_registration_at_time_of_supply");
    expect(result.statusAsOf).toBe(A.paymentDate);
    expect(result.timeOfSupplyDate).toBe(A.paymentDate);
    expect(result.recipient).toEqual({ registrationId: A.registration, evidenceHash: A.registrationHash });
    expect(result.recipientRegistrationStatusEvidenceHash).toBe(A.recipientStatusHash);
    expect(result.timeOfSupplyEvidenceHash).toBe(A.tosHash);
    const { evidenceHash, ...evidence } = result;
    expect(evidenceHash).toBe(hash({ tenantId: A.tenant, ...evidence }));
    expectDeepFrozen(result);
    expect(result).not.toHaveProperty("tenantId");
    expect(result).not.toHaveProperty("gstin");
    expect(result).not.toHaveProperty("addressLine");
    expect(JSON.stringify(result)).not.toContain(A.recipientBody.gstin);
    expect(JSON.stringify(result)).not.toContain(A.recipientBody.addressLine1);
    expect(JSON.stringify(result)).not.toContain(A.recipientBody.locality);
    expect(await effects()).toEqual(before);
  }, 30_000);

  test("cross-tenant, mixed-lineage, date and caller-hash attacks fail closed", async () => {
    const before = await effects();
    await expect(resolve(A, {}, B.tenant)).rejects.toBeInstanceOf(IndiaGstRecipientRegistrationAtTimeOfSupplyNotFoundError);
    await expect(resolve(B, {}, A.tenant)).rejects.toBeInstanceOf(IndiaGstRecipientRegistrationAtTimeOfSupplyNotFoundError);
    await expect(resolve(A, { recipientRegistrationStatusEvidenceHash: "0".repeat(64) })).rejects.toBeInstanceOf(IndiaGstRecipientRegistrationAtTimeOfSupplyConflictError);
    await expect(resolve(A, { timeOfSupplyEvidenceHash: "0".repeat(64) })).rejects.toBeInstanceOf(IndiaGstRecipientRegistrationAtTimeOfSupplyConflictError);
    await expect(resolve(A, { timeOfSupplyDate: "2043-06-16" })).rejects.toBeInstanceOf(IndiaGstRecipientRegistrationAtTimeOfSupplyValidationError);
    await expect(resolve(A, { invoiceIssueSnapshotId: B.invoice })).rejects.toBeInstanceOf(IndiaGstRecipientRegistrationAtTimeOfSupplyNotFoundError);
    expect(await effects()).toEqual(before);
  }, 30_000);

  test("a duplicate status identity is rejected by PostgreSQL without changing effects", async () => {
    const before = await effects();
    let code: unknown;
    try {
      await deploy!`INSERT INTO india_gst_recipient_sez_status(tenant_id,id,recipient_registration_id,recipient_registration_evidence_hash,status_as_of,gst_registration_status,gst_taxpayer_type,gst_status_source,gst_status_evidence_sha256,legal_rule) SELECT tenant_id,id,recipient_registration_id,recipient_registration_evidence_hash,status_as_of,gst_registration_status,gst_taxpayer_type,gst_status_source,gst_status_evidence_sha256,legal_rule FROM india_gst_recipient_sez_status WHERE tenant_id=${A.tenant}::uuid AND id=${A.status}::uuid`;
    } catch (error) {
      code = (error as { errno?: unknown; code?: unknown }).errno ?? (error as { code?: unknown }).code;
    }
    expect(code).toBe("23505");
    expect(await effects()).toEqual(before);
  }, 30_000);
});
