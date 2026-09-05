import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import {
  IndiaGstRegistrationAtTimeOfSupplyConflictError,
  IndiaGstRegistrationAtTimeOfSupplyNotFoundError,
  IndiaGstRegistrationAtTimeOfSupplyService,
  IndiaGstRegistrationAtTimeOfSupplyValidationError,
  createPositiveTaxAttributionSnapshot,
} from "../src/contexts/tax-fiscal";
import { Database } from "../src/kernel";
import type { SQL } from "bun";

const id = (suffix: number): string =>
  `00000000-0000-0000-0000-${String(suffix).padStart(12, "0")}`;
const sha256 = (value: unknown): string =>
  new Bun.CryptoHasher("sha256").update(JSON.stringify(value)).digest("hex");
const deeplyFrozen = (value: unknown, seen = new Set<object>()): void => {
  if (typeof value !== "object" || value === null || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBeTrue();
  for (const key of Reflect.ownKeys(value)) {
    deeplyFrozen((value as Record<PropertyKey, unknown>)[key], seen);
  }
};

type Fixture = ReturnType<typeof fixture>;

function fixture(base: number) {
  const tenant = id(base);
  const property = id(base + 1);
  const actor = id(base + 2);
  const guest = id(base + 3);
  const unitType = id(base + 4);
  const sellable = id(base + 5);
  const ratePlan = id(base + 6);
  const extension = id(base + 7);
  const reservation = id(base + 8);
  const segment = id(base + 9);
  const hold = id(base + 10);
  const attribution = id(base + 11);
  const holdBinding = id(base + 12);
  const lineage = id(base + 13);
  const registration = id(base + 14);
  const location = id(base + 15);
  const status = id(base + 16);
  const service = id(base + 17);
  const payment = id(base + 18);
  const invoice = id(base + 19);
  const quoteHash = base === 29500 ? "a".repeat(64) : "b".repeat(64);
  const statusEvidence = base === 29500 ? "c".repeat(64) : "d".repeat(64);
  const serviceEvidence = base === 29500 ? "e".repeat(64) : "f".repeat(64);
  const paymentEvidence = base === 29500 ? "1".repeat(64) : "2".repeat(64);
  const invoiceEvidence = base === 29500 ? "3".repeat(64) : "4".repeat(64);
  const contentHash = "5".repeat(64);
  const key = "in.order295.gst.27";
  const statusAsOf = "2043-06-15";
  const serviceDate = "2043-06-01";
  const paymentDate = "2043-06-15";
  const invoiceDate = "2043-07-01";
  const period = "[2043-06-01 15:00:00+00,2043-06-02 15:00:00+00)";
  const ordinaryEvidence = "6".repeat(64);
  const jurisdiction = {
    extensionId: extension,
    ownerTenantId: tenant,
    key,
    version: "7",
    contentHash,
  } as const;
  const registrationBody = {
    registrationId: registration,
    tenantId: tenant,
    propertyNode: property,
    scheme: "in-gstin" as const,
    currency: "INR" as const,
    jurisdiction,
    gstin: "27AAPFU0939F1ZV",
    stateCode: "27",
    legalName: "Order 295 Hotel Private Limited",
    tradeName: "Order 295 Hotel",
    addressLine: "1 Marine Drive",
    locality: "Mumbai",
    postalCode: "400001",
  };
  const registrationHash = sha256(registrationBody);
  const locationBody = {
    supplierServiceLocationId: location,
    propertyNode: property,
    jurisdiction,
    supplier: { registrationId: registration, evidenceHash: registrationHash },
    serviceScope: "lodging_accommodation" as const,
    registeredPlace: {
      kind: "principal_place_of_business" as const,
      stateCode: "27",
      addressLine: "1 Marine Drive",
      locality: "Mumbai",
      postalCode: "400001",
    },
    locationBasis: "supply_made_from_registered_place_of_business" as const,
    legalRule: "IGST_ACT_2_15_A" as const,
  };
  const locationHash = sha256({ tenantId: tenant, ...locationBody });
  const snapshot = createPositiveTaxAttributionSnapshot({
    origin: { kind: "rate_quote", quoteHash },
    currency: "INR",
    line: {
      lineId: "room",
      revenueGroup: "room_revenue",
      amountMinor: 10_500n,
      nights: 1,
      personNights: 2,
      roomNights: [{ businessDate: serviceDate, amountMinor: 10_500n }],
    },
    assignments: [{
      businessDate: serviceDate,
      jurisdictionKey: key,
      evidenceRef: `tax-assignment:${quoteHash}`,
    }],
    jurisdiction: {
      extensionId: extension,
      ownerTenantId: tenant,
      key,
      version: 7,
      contentHash,
      evidenceRef: `tax-jurisdiction:${contentHash}`,
    },
    evaluation: {
      schemaVersion: 1,
      jurisdictionKey: key,
      country: "IN",
      priceDisplay: "tax_exclusive",
      rounding: "line",
      inputTotalMinor: 10_500n,
      baseTotalMinor: 10_500n,
      taxTotalMinor: 0n,
      grandTotalMinor: 10_500n,
      taxes: [{
        code: "GST_ROOM",
        name: "GST",
        taxMinor: 0n,
        components: [{
          lineId: "room",
          revenueGroup: "room_revenue",
          baseMinor: 10_500n,
          taxMinor: 0n,
          rateBasisPoints: 0,
        }],
      }],
    },
  });
  const statusHash = sha256({
    tenantId: tenant,
    supplierGstRegistrationStatusId: status,
    propertyNode: property,
    supplierServiceLocation: { id: location, evidenceHash: locationHash },
    supplier: { registrationId: registration, evidenceHash: registrationHash },
    statusAsOf,
    gstRegistration: {
      status: "active",
      taxpayerType: "regular",
      source: "gst_common_portal",
      evidenceSha256: statusEvidence,
    },
    legalRule: "CGST_ACT_25_29_30_AND_RULE_21A_REGISTRATION_STATUS",
  });
  const tosHash = sha256({
    serviceProvisionSnapshotId: service,
    paymentReceiptSnapshotId: payment,
    invoiceIssueSnapshotId: invoice,
    propertyNode: property,
    reservationId: reservation,
    reservationLineage: {
      lineageId: lineage,
      holdBindingId: holdBinding,
      attributionId: attribution,
      reservationId: reservation,
      segmentId: segment,
      originQuoteHash: quoteHash,
      snapshotHash: snapshot.snapshotHash,
      currency: "INR",
    },
    attribution: { originKind: "rate_quote", lineId: "room", revenueGroup: "room_revenue" },
    serviceProvisionDate: serviceDate,
    paymentReceiptDate: paymentDate,
    invoiceIssueDate: invoiceDate,
    deadlineDate: "2043-07-01",
    candidateDates: { invoiceIssueDate: invoiceDate, paymentReceiptDate: paymentDate },
    branch: "section13_2_a_invoice_or_payment",
    timeOfSupplyDate: paymentDate,
    regime: "ordinary_rule47_30_day",
    source: "governed_rule47_ordinary_regime_record",
    legalRule: "CGST_ACT_13_2_A_OR_B_ORDINARY_TIME_OF_SUPPLY",
    ordinaryRegimeEvidenceSha256: ordinaryEvidence,
    invoiceSeries: "FY2043",
    invoiceSerial: "000042",
    supplierBooksEntryDate: paymentDate,
    supplierBankCreditDate: paymentDate,
    coverageScope: "full_attribution",
    serviceProvisionSource: "governed_service_provision_record",
    serviceProvisionLegalRule: "CGST_ACT_13_2_B_SERVICE_PROVISION_DATE_INPUT_ONLY",
    paymentReceiptSource: "governed_supplier_payment_receipt_record",
    paymentReceiptLegalRule: "CGST_ACT_13_2_EXPLANATION_II_PAYMENT_RECEIPT_DATE_INPUT_ONLY",
    invoiceIssueSource: "governed_supplier_tax_invoice_record",
    invoiceIssueLegalRule: "CGST_ACT_13_2_INVOICE_DATE_INPUT_ONLY",
    serviceProvisionEvidenceSha256: serviceEvidence,
    paymentReceiptEvidenceSha256: paymentEvidence,
    invoiceIssueEvidenceSha256: invoiceEvidence,
    amountMinor: "10500",
    currency: "INR",
  });
  return {
    tenant, property, actor, guest, unitType, sellable, ratePlan, extension,
    reservation, segment, hold, attribution, holdBinding, lineage, registration,
    location, status, service, payment, invoice, quoteHash, statusEvidence,
    serviceEvidence, paymentEvidence, invoiceEvidence, contentHash, key,
    statusAsOf, serviceDate, paymentDate, invoiceDate, period, ordinaryEvidence,
    jurisdiction, registrationBody, registrationHash, locationHash, snapshot,
    statusHash, tosHash,
  };
}

const A = fixture(29500);
const B = fixture(29600);

const DEPLOY_URL = process.env.YELLOW_ORDER295_DEPLOY_DATABASE_URL;
const RUNTIME_URL = process.env.YELLOW_ORDER295_DATABASE_URL;
const live = DEPLOY_URL && RUNTIME_URL ? describe.serial : describe.skip;

let deploy: SQL | undefined;
let runtime: Database | undefined;

async function cleanup(): Promise<void> {
  if (!deploy) return;
  for (const table of [
    "india_gst_accommodation_invoice_issue_snapshot",
    "india_gst_accommodation_payment_receipt_snapshot",
    "india_gst_accommodation_service_provision_snapshot",
    "india_gst_supplier_registration_status_snapshot",
    "india_gst_supplier_service_location",
    "property_fiscal_registration",
    "tax_attribution_reservation_binding",
    "tax_attribution_hold_binding",
    "tax_attribution_snapshot",
    "reservation_segment",
    "reservation",
    "hold",
    "sellable_unit",
    "rate_plan",
    "unit_type",
    "party",
    "app_user",
    "extension",
    "org_node",
    "tenant",
  ]) {
    const key = table === "tenant" ? "id" : "tenant_id";
    await deploy.unsafe(`DELETE FROM public.${table} WHERE ${key} IN ('${A.tenant}', '${B.tenant}')`);
  }
}

async function seed(f: Fixture): Promise<void> {
  if (!deploy) throw new Error("deployment database is unavailable");
  await deploy`INSERT INTO tenant(id,slug,name,tier,status) VALUES
    (${f.tenant}::uuid,${`order295-${f.tenant.slice(-4)}`},'Order 295 PostgreSQL','shared','active')`;
  await deploy`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES
    (${f.property}::uuid,${f.tenant}::uuid,${`order295-${f.tenant.slice(-4)}.property`}::ltree,
     'property','Order 295 Hotel','Asia/Kolkata','INR')`;
  await deploy`INSERT INTO app_user(id,tenant_id,email,display_name,status) VALUES
    (${f.actor}::uuid,${f.tenant}::uuid,${`actor-${f.tenant.slice(-4)}@order295.local`},'Order 295 Actor','active')`;
  await deploy`INSERT INTO party(id,tenant_id,kind,display_name,status) VALUES
    (${f.guest}::uuid,${f.tenant}::uuid,'person','Order 295 Guest','active')`;
  await deploy`INSERT INTO unit_type(id,tenant_id,property_node,code,name,profile_key,max_occupancy) VALUES
    (${f.unitType}::uuid,${f.tenant}::uuid,${f.property}::uuid,${`O295-${f.tenant.slice(-4)}`},'Order 295 Room','hotel',4)`;
  await deploy`INSERT INTO sellable_unit(id,tenant_id,unit_type_id,name,status) VALUES
    (${f.sellable}::uuid,${f.tenant}::uuid,${f.unitType}::uuid,'Order 295 Sellable','active')`;
  await deploy`INSERT INTO rate_plan(id,tenant_id,property_node,code,name,currency,tax_inclusive,status) VALUES
    (${f.ratePlan}::uuid,${f.tenant}::uuid,${f.property}::uuid,${`O295-${f.tenant.slice(-4)}`},'Order 295 India','INR',false,'active')`;
  await deploy`INSERT INTO extension(id,tenant_id,type,key,version,effective,content,status) VALUES
    (${f.extension}::uuid,${f.tenant}::uuid,'tax_jurisdiction',${f.key},7,
     '[2030-01-01 00:00:00+00,)'::tstzrange,
     '{"country":"IN","price_display":"tax_exclusive","rounding":"line","taxes":[]}'::jsonb,'active')`;
  await deploy`INSERT INTO reservation(id,tenant_id,property_node,confirmation_no,status,primary_party,booker_party,channel_code,currency) VALUES
    (${f.reservation}::uuid,${f.tenant}::uuid,${f.property}::uuid,${`O295-${f.tenant.slice(-4)}`},'reserved',
     ${f.guest}::uuid,${f.guest}::uuid,'direct','INR')`;
  await deploy`INSERT INTO reservation_segment(id,tenant_id,reservation_id,seq,unit_type_id,sellable_unit_id,period,adults,children,rate_plan_id,status) VALUES
    (${f.segment}::uuid,${f.tenant}::uuid,${f.reservation}::uuid,1,${f.unitType}::uuid,${f.sellable}::uuid,
     ${f.period}::tstzrange,2,'[]'::jsonb,${f.ratePlan}::uuid,'booked')`;
  await deploy`INSERT INTO hold(id,tenant_id,property_node,sellable_unit_id,period,kind,holder,expires_at,status) VALUES
    (${f.hold}::uuid,${f.tenant}::uuid,${f.property}::uuid,${f.sellable}::uuid,${f.period}::tstzrange,
     'cart','{}'::jsonb,'2043-06-02 15:00:00+00','consumed')`;
  await deploy`INSERT INTO tax_attribution_snapshot(tenant_id,id,property_node,actor_id,schema_version,origin_kind,origin_quote_hash,snapshot_hash,currency,snapshot) VALUES
    (${f.tenant}::uuid,${f.attribution}::uuid,${f.property}::uuid,${f.actor}::uuid,1,'rate_quote',
     ${f.quoteHash},${f.snapshot.snapshotHash},'INR',${JSON.stringify(f.snapshot)}::jsonb)`;
  await deploy`INSERT INTO tax_attribution_hold_binding(tenant_id,id,property_node,bound_by,hold_id,attribution_id,sellable_unit_id,period,origin_quote_hash,snapshot_hash,currency) VALUES
    (${f.tenant}::uuid,${f.holdBinding}::uuid,${f.property}::uuid,${f.actor}::uuid,${f.hold}::uuid,
     ${f.attribution}::uuid,${f.sellable}::uuid,${f.period}::tstzrange,${f.quoteHash},${f.snapshot.snapshotHash},'INR')`;
  await deploy`INSERT INTO tax_attribution_reservation_binding(tenant_id,id,property_node,linked_by,binding_id,hold_id,attribution_id,reservation_id,segment_id,sellable_unit_id,period,origin_quote_hash,snapshot_hash,currency) VALUES
    (${f.tenant}::uuid,${f.lineage}::uuid,${f.property}::uuid,${f.actor}::uuid,${f.holdBinding}::uuid,
     ${f.hold}::uuid,${f.attribution}::uuid,${f.reservation}::uuid,${f.segment}::uuid,${f.sellable}::uuid,
     ${f.period}::tstzrange,${f.quoteHash},${f.snapshot.snapshotHash},'INR')`;
  await deploy`INSERT INTO property_fiscal_registration(tenant_id,id,property_node,scheme,currency,jurisdiction_extension_id,jurisdiction_owner_tenant_id,jurisdiction_key,jurisdiction_version,jurisdiction_content_hash,registration_number,region_code,legal_name,trade_name,address_line,locality,postal_code) VALUES
    (${f.tenant}::uuid,${f.registration}::uuid,${f.property}::uuid,'in-gstin','INR',${f.extension}::uuid,
     ${f.tenant}::uuid,${f.key},7,${f.contentHash},${f.registrationBody.gstin},'27',${f.registrationBody.legalName},
     ${f.registrationBody.tradeName},${f.registrationBody.addressLine},${f.registrationBody.locality},${f.registrationBody.postalCode})`;
  await deploy`INSERT INTO india_gst_supplier_service_location(tenant_id,id,supplier_registration_id,supplier_evidence_hash,service_scope,registered_place_kind,location_basis,legal_rule) VALUES
    (${f.tenant}::uuid,${f.location}::uuid,${f.registration}::uuid,${f.registrationHash},'lodging_accommodation',
     'principal_place_of_business','supply_made_from_registered_place_of_business','IGST_ACT_2_15_A')`;
  await deploy`INSERT INTO india_gst_supplier_registration_status_snapshot(tenant_id,id,supplier_registration_id,supplier_registration_evidence_hash,status_as_of,gst_registration_status,gst_taxpayer_type,gst_status_source,gst_status_evidence_sha256,legal_rule) VALUES
    (${f.tenant}::uuid,${f.status}::uuid,${f.registration}::uuid,${f.registrationHash},${f.statusAsOf}::date,
     'active','regular','gst_common_portal',${f.statusEvidence},'CGST_ACT_25_29_30_AND_RULE_21A_REGISTRATION_STATUS')`;
  await deploy`INSERT INTO india_gst_accommodation_service_provision_snapshot(tenant_id,id,property_node,reservation_lineage_id,hold_binding_id,attribution_id,reservation_id,segment_id,origin_quote_hash,snapshot_hash,currency,service_provision_date,service_provision_source,service_provision_evidence_sha256,legal_rule) VALUES
    (${f.tenant}::uuid,${f.service}::uuid,${f.property}::uuid,${f.lineage}::uuid,${f.holdBinding}::uuid,${f.attribution}::uuid,
     ${f.reservation}::uuid,${f.segment}::uuid,${f.quoteHash},${f.snapshot.snapshotHash},'INR',${f.serviceDate}::date,
     'governed_service_provision_record',${f.serviceEvidence},'CGST_ACT_13_2_B_SERVICE_PROVISION_DATE_INPUT_ONLY')`;
  await deploy`INSERT INTO india_gst_accommodation_payment_receipt_snapshot(tenant_id,id,service_provision_snapshot_id,currency,amount_minor,coverage_scope,supplier_books_entry_date,supplier_bank_credit_date,payment_receipt_date,payment_receipt_source,payment_receipt_evidence_sha256,legal_rule) VALUES
    (${f.tenant}::uuid,${f.payment}::uuid,${f.service}::uuid,'INR',10500,'full_attribution',${f.paymentDate}::date,${f.paymentDate}::date,${f.paymentDate}::date,
     'governed_supplier_payment_receipt_record',${f.paymentEvidence},'CGST_ACT_13_2_EXPLANATION_II_PAYMENT_RECEIPT_DATE_INPUT_ONLY')`;
  await deploy`INSERT INTO india_gst_accommodation_invoice_issue_snapshot(tenant_id,id,service_provision_snapshot_id,currency,amount_minor,coverage_scope,invoice_series,invoice_serial,invoice_issue_date,invoice_issue_source,invoice_issue_evidence_sha256,legal_rule) VALUES
    (${f.tenant}::uuid,${f.invoice}::uuid,${f.service}::uuid,'INR',10500,'full_attribution','FY2043','000042',${f.invoiceDate}::date,
     'governed_supplier_tax_invoice_record',${f.invoiceEvidence},'CGST_ACT_13_2_INVOICE_DATE_INPUT_ONLY')`;
}

function input(f: Fixture, overrides: Record<string, unknown> = {}) {
  return {
    tenantId: f.tenant,
    propertyNode: f.property,
    reservationId: f.reservation,
    supplierServiceLocationId: f.location,
    supplierGstRegistrationStatusId: f.status,
    serviceProvisionSnapshotId: f.service,
    paymentReceiptSnapshotId: f.payment,
    invoiceIssueSnapshotId: f.invoice,
    statusAsOf: f.statusAsOf,
    timeOfSupplyDate: f.paymentDate,
    serviceProvisionDate: f.serviceDate,
    paymentReceiptDate: f.paymentDate,
    invoiceIssueDate: f.invoiceDate,
    ordinaryRegimeSource: "governed_rule47_ordinary_regime_record",
    ordinaryRegimeEvidenceSha256: f.ordinaryEvidence,
    supplierRegistrationStatusEvidenceHash: f.statusHash,
    timeOfSupplyEvidenceHash: f.tosHash,
    ...overrides,
  };
}

async function effects(): Promise<Record<string, number | string>> {
  if (!deploy) throw new Error("deployment database is unavailable");
  const rows = await deploy<Array<Record<string, number | string>>>`SELECT
    (SELECT count(*)::int FROM property_fiscal_registration WHERE tenant_id IN (${A.tenant}::uuid,${B.tenant}::uuid)) registrations,
    (SELECT count(*)::int FROM india_gst_supplier_service_location WHERE tenant_id IN (${A.tenant}::uuid,${B.tenant}::uuid)) locations,
    (SELECT count(*)::int FROM india_gst_supplier_registration_status_snapshot WHERE tenant_id IN (${A.tenant}::uuid,${B.tenant}::uuid)) statuses,
    (SELECT count(*)::int FROM india_gst_accommodation_service_provision_snapshot WHERE tenant_id IN (${A.tenant}::uuid,${B.tenant}::uuid)) services,
    (SELECT count(*)::int FROM india_gst_accommodation_payment_receipt_snapshot WHERE tenant_id IN (${A.tenant}::uuid,${B.tenant}::uuid)) payments,
    (SELECT count(*)::int FROM india_gst_accommodation_invoice_issue_snapshot WHERE tenant_id IN (${A.tenant}::uuid,${B.tenant}::uuid)) invoices,
    (SELECT count(*)::int FROM tax_attribution_snapshot WHERE tenant_id IN (${A.tenant}::uuid,${B.tenant}::uuid)) attributions,
    (SELECT count(*)::int FROM tax_attribution_hold_binding WHERE tenant_id IN (${A.tenant}::uuid,${B.tenant}::uuid)) hold_bindings,
    (SELECT count(*)::int FROM tax_attribution_reservation_binding WHERE tenant_id IN (${A.tenant}::uuid,${B.tenant}::uuid)) lineages,
    (SELECT count(*)::int FROM fact_log WHERE tenant_id IN (${A.tenant}::uuid,${B.tenant}::uuid)) facts,
    (SELECT count(*)::int FROM outbox WHERE tenant_id IN (${A.tenant}::uuid,${B.tenant}::uuid)) events,
    (SELECT count(*)::int FROM document WHERE tenant_id IN (${A.tenant}::uuid,${B.tenant}::uuid)) documents,
    (SELECT count(*)::int FROM fiscal_submission WHERE tenant_id IN (${A.tenant}::uuid,${B.tenant}::uuid)) submissions,
    (SELECT count(*)::int FROM journal WHERE tenant_id IN (${A.tenant}::uuid,${B.tenant}::uuid)) journals,
    (SELECT count(*)::int FROM posting_line WHERE tenant_id IN (${A.tenant}::uuid,${B.tenant}::uuid)) postings,
    (SELECT count(*)::int FROM api_idempotency WHERE tenant_id IN (${A.tenant}::uuid,${B.tenant}::uuid)) idempotency`;
  return rows[0]!;
}

async function resolve(f: Fixture, overrides: Record<string, unknown> = {}, tenant = f.tenant) {
  if (!runtime) throw new Error("runtime database is unavailable");
  return runtime.withTenantTransaction(tenant, (tx) =>
    new IndiaGstRegistrationAtTimeOfSupplyService().resolve(tx, input(f, overrides) as never));
}

live("Order 295 real PostgreSQL predecessor-chain proof", () => {
  beforeAll(async () => {
    deploy = new (await import("bun")).SQL(DEPLOY_URL!, { max: 4, prepare: false });
    runtime = Database.connect(RUNTIME_URL!, { maxConnections: 4, prepare: false });
    await cleanup();
    await seed(A);
    await seed(B);
  });

  afterAll(async () => {
    await cleanup();
    await runtime?.close();
    await deploy?.close({ timeout: 0 });
  });

  test("uses yellow_runtime/app_role, reads one complete chain, and returns exact frozen hashes", async () => {
    if (!runtime) throw new Error("runtime database is unavailable");
    const before = await effects();
    const result = await runtime.withTenantTransaction(A.tenant, async (tx) => {
      const identity = await tx<Array<{ session_user: string; current_user: string; tenant_id: string }>>`
        SELECT session_user::text, current_user::text,
               current_setting('app.tenant_id', true) AS tenant_id`;
      expect(identity).toEqual([{ session_user: "yellow_runtime", current_user: "app_role", tenant_id: A.tenant }]);
      return new IndiaGstRegistrationAtTimeOfSupplyService().resolve(tx, input(A) as never);
    });
    expect(result.result).toBe("active_at_time_of_supply");
    expect(result.statusAsOf).toBe("2043-06-15");
    expect(result.timeOfSupplyDate).toBe("2043-06-15");
    expect(result.supplier).toEqual({ registrationId: A.registration, evidenceHash: A.registrationHash });
    expect(result.supplierServiceLocation).toEqual({ id: A.location, evidenceHash: A.locationHash });
    expect(result.supplierRegistrationStatusEvidenceHash).toBe(A.statusHash);
    expect(result.timeOfSupplyEvidenceHash).toBe(A.tosHash);
    expect(result.timeOfSupply.evidenceHash).toBe(A.tosHash);
    expect(result).not.toHaveProperty("tenantId");
    expect(result).not.toHaveProperty("gstin");
    expect(result.timeOfSupply.amountMinor).toBe("10500");
    expect(result.timeOfSupply.currency).toBe("INR");
    deeplyFrozen(result);
    expect(await effects()).toEqual(before);
  }, 30_000);

  test("tenant concealment, duplicate identity and hostile evidence fail closed without effects", async () => {
    const before = await effects();
    await expect(resolve(A, {}, B.tenant)).rejects.toBeInstanceOf(IndiaGstRegistrationAtTimeOfSupplyNotFoundError);
    await expect(resolve(B, {}, A.tenant)).rejects.toBeInstanceOf(IndiaGstRegistrationAtTimeOfSupplyNotFoundError);
    await expect(resolve(A, { supplierRegistrationStatusEvidenceHash: "9".repeat(64) })).rejects
      .toBeInstanceOf(IndiaGstRegistrationAtTimeOfSupplyConflictError);
    await expect(resolve(A, { timeOfSupplyEvidenceHash: "8".repeat(64) })).rejects
      .toBeInstanceOf(IndiaGstRegistrationAtTimeOfSupplyConflictError);
    await expect(resolve(A, { timeOfSupplyDate: "2043-06-16" })).rejects
      .toBeInstanceOf(IndiaGstRegistrationAtTimeOfSupplyValidationError);
    await expect(resolve(A, { invoiceIssueSnapshotId: B.invoice })).rejects
      .toBeInstanceOf(IndiaGstRegistrationAtTimeOfSupplyNotFoundError);

    let duplicateState: unknown;
    try {
      await deploy!`INSERT INTO india_gst_supplier_registration_status_snapshot(
        tenant_id,id,supplier_registration_id,supplier_registration_evidence_hash,status_as_of,
        gst_registration_status,gst_taxpayer_type,gst_status_source,gst_status_evidence_sha256,legal_rule
      ) SELECT tenant_id,id,supplier_registration_id,supplier_registration_evidence_hash,status_as_of,
        gst_registration_status,gst_taxpayer_type,gst_status_source,gst_status_evidence_sha256,legal_rule
        FROM india_gst_supplier_registration_status_snapshot WHERE tenant_id=${A.tenant}::uuid AND id=${A.status}::uuid`;
    } catch (error) {
      duplicateState = (error as { errno?: unknown; code?: unknown }).errno ??
        (error as { code?: unknown }).code;
    }
    expect(duplicateState).toBe("23505");
    expect(await effects()).toEqual(before);
  }, 30_000);
});
