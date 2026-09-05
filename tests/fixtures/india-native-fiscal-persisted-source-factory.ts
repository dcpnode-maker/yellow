import { SQL } from "bun";

import {
  IndiaFinalComponentTaxFiscalSourceService,
  IndiaFinalComponentTaxPostingService,
} from "../../src/contexts/financials";
import {
  IndiaGstAccommodationClassificationService,
  IndiaGstAccommodationPlaceOfSupplyService,
  IndiaGstRecipientRegistrationService,
  IndiaGstSupplierRegistrationService,
  IndiaIrpAccommodationSourceService,
  composeIndiaGstAccommodationSupplyNatureAtTimeOfSupply,
  createPositiveTaxAttributionSnapshot,
} from "../../src/contexts/tax-fiscal";
import {
  Database,
  PostgresEventBus,
  PostgresIdempotency,
  createAuditEnvelope,
} from "../../src/kernel";

type Mutable = Record<PropertyKey, any>;

export interface PersistedIndiaFiscalSourceFixture {
  readonly tenant_id: string;
  readonly property_node: string;
  readonly actor_id: string;
  readonly reservation_id: string;
  readonly folio_id: string;
  readonly journal_id: string;
  readonly buyer_party_id: string;
  readonly recipient_registration_id: string;
  readonly classification_id: string;
  readonly supplier_registration_id: string;
  readonly supplyInput: any;
  readonly supplyResult: any;
}

const EXTENSION = "0b21daf2-ea6e-5568-9c21-69e4d4424574";
const EXTENSION_HASH = "eb323eff707aad1e460b425c87b448d4e924d2eb17499094abad71b33c69a820";

const digest = (value: unknown): string =>
  new Bun.CryptoHasher("sha256").update(JSON.stringify(value)).digest("hex");

const frozen = <T>(value: T, seen = new Set<object>()): T => {
  if (value !== null && typeof value === "object" && !seen.has(value)) {
    seen.add(value);
    for (const key of Reflect.ownKeys(value)) frozen((value as Mutable)[key], seen);
    Object.freeze(value);
  }
  return value;
};

function gstin(stateCode: string, seed: string): string {
  const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const fixtureSerial = /^fixture-(\d{1,4})$/.exec(seed)?.[1];
  const serial = fixtureSerial !== undefined
    ? String(Number(fixtureSerial) % 10_000).padStart(4, "0")
    : String(Number.parseInt(digest(seed).slice(0, 8), 16) % 10_000).padStart(4, "0");
  const body = `${stateCode}ABCDE${serial}F1Z`;
  let factor = 2;
  let sum = 0;
  for (let index = body.length - 1; index >= 0; index -= 1) {
    const product = factor * alphabet.indexOf(body[index]!);
    factor = factor === 2 ? 1 : 2;
    sum += Math.floor(product / 36) + product % 36;
  }
  return `${body}${alphabet[(36 - sum % 36) % 36]!}`;
}

const hashSentinel = (seed: string): string => digest(`order430:${seed}`);

/**
 * Test-only persisted-source factory for Order430. Unlike the historical Order407
 * harness, every source created here deliberately shares one tenant/property and
 * supplier registration. Each source still has independent reservation, folio,
 * valuation, tax, journal and recipient lineage and is posted through the real
 * Order407 service before being resolved through the real Order413 service.
 */
export class PersistedIndiaFiscalSourceFactory {
  readonly tenantId = crypto.randomUUID();
  readonly propertyNode = crypto.randomUUID();
  readonly actorId = crypto.randomUUID();
  readonly roleId = crypto.randomUUID();
  readonly supplierRegistrationId = crypto.randomUUID();
  readonly supplierServiceLocationId = crypto.randomUUID();
  readonly supplierStatusId = crypto.randomUUID();
  readonly classificationId = crypto.randomUUID();

  readonly #deploy: SQL;
  readonly #database: Database;
  readonly #posting: IndiaFinalComponentTaxPostingService;
  readonly #runtimePool: SQL;
  readonly #revenueAccount = crypto.randomUUID();
  readonly #taxAccount = crypto.randomUUID();
  readonly #unitType = crypto.randomUUID();
  readonly #sellable = crypto.randomUUID();
  readonly #ratePlan = crypto.randomUUID();
  readonly #roomCode = `O430_ROOM_${crypto.randomUUID().slice(0, 8)}`;
  readonly #taxCode = `O430_IGST_${crypto.randomUUID().slice(0, 8)}`;
  readonly #businessDate: string;
  readonly #sellerGstin: string;
  readonly #supplierEvidenceHash: string;
  readonly #serviceLocationEvidenceHash: string;
  #serial = 0;

  private constructor(deploy: SQL, runtimeUrl: string, runtimePool: SQL, businessDate: string) {
    this.#deploy = deploy;
    this.#runtimePool = runtimePool;
    this.#database = Database.connect(runtimeUrl, { maxConnections: 24, prepare: false });
    this.#posting = new IndiaFinalComponentTaxPostingService({
      events: new PostgresEventBus(runtimePool),
      idempotency: new PostgresIdempotency(),
    });
    this.#businessDate = businessDate;
    this.#sellerGstin = gstin("27", this.tenantId);
    this.#supplierEvidenceHash = digest({
      registrationId: this.supplierRegistrationId,
      tenantId: this.tenantId,
      propertyNode: this.propertyNode,
      scheme: "in-gstin",
      currency: "INR",
      jurisdiction: { extensionId: EXTENSION, ownerTenantId: null, key: "in-gst-lodging", version: "2", contentHash: EXTENSION_HASH },
      gstin: this.#sellerGstin,
      stateCode: "27",
      legalName: "Order430 Hotel Private Limited",
      tradeName: "Order430 Hotel",
      addressLine: "1 Hotel Road",
      locality: "Mumbai",
      postalCode: "400001",
    });
    this.#serviceLocationEvidenceHash = digest({ tenantId: this.tenantId, id: this.supplierServiceLocationId,
      propertyNode: this.propertyNode, stateCode: "27" });
  }

  static async create(deploy: SQL, runtimeUrl: string): Promise<PersistedIndiaFiscalSourceFactory> {
    const runtimePool = new SQL(runtimeUrl, { max: 24, prepare: false });
    const rows = await deploy<Array<{ date: string }>>`
      SELECT (transaction_timestamp() AT TIME ZONE 'Asia/Kolkata')::date::text date`;
    const date = rows[0]?.date;
    if (!date) throw new Error("Order430 property-local fixture date is unavailable");
    const factory = new PersistedIndiaFiscalSourceFactory(deploy, runtimeUrl, runtimePool, date);
    await factory.#bootstrap();
    return factory;
  }

  async close(): Promise<void> {
    await this.#database.close();
    await this.#runtimePool.close({ timeout: 0 });
  }

  async #bootstrap(): Promise<void> {
    const tenant = this.tenantId;
    const property = this.propertyNode;
    await this.#deploy.begin(async (tx) => {
      await tx`SET LOCAL session_replication_role=replica`;
      await tx`INSERT INTO tenant(id,slug,name,tier,status)
        VALUES(${tenant}::uuid,${`o430-${tenant.slice(0, 8)}`} ,'Order430 persisted-source hotel','shared','active')`;
      await tx`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency)
        VALUES(${property}::uuid,${tenant}::uuid,${`o430${tenant.replaceAll("-", "").slice(0, 8)}.property`}::ltree,
          'property','Order430 Hotel','Asia/Kolkata','INR')`;
      await tx`INSERT INTO app_user(id,tenant_id,email,display_name,status)
        VALUES(${this.actorId}::uuid,${tenant}::uuid,${`actor-${tenant.slice(0, 8)}@o430.test`},'Order430 actor','active')`;
      await tx`INSERT INTO role(id,tenant_id,name) VALUES(${this.roleId}::uuid,${tenant}::uuid,'Order430 issuer')`;
      await tx`INSERT INTO role_permission(role_id,permission_code) VALUES
        (${this.roleId}::uuid,'tax-fiscal.series:configure'),(${this.roleId}::uuid,'tax-fiscal.documents:issue'),
        (${this.roleId}::uuid,'financials.adjustments:write'),(${this.roleId}::uuid,'financials.adjustments:post-seal'),
        (${this.roleId}::uuid,'business_day.seal')`;
      await tx`INSERT INTO user_role(tenant_id,user_id,role_id,scope_node)
        VALUES(${tenant}::uuid,${this.actorId}::uuid,${this.roleId}::uuid,${property}::uuid)`;
      await tx`INSERT INTO unit_type(id,tenant_id,property_node,code,name,profile_key,max_occupancy)
        VALUES(${this.#unitType}::uuid,${tenant}::uuid,${property}::uuid,'O430','Room','hotel',2)`;
      await tx`INSERT INTO sellable_unit(id,tenant_id,unit_type_id,name,status)
        VALUES(${this.#sellable}::uuid,${tenant}::uuid,${this.#unitType}::uuid,'Room','active')`;
      await tx`INSERT INTO rate_plan(id,tenant_id,property_node,code,name,currency,tax_inclusive,status)
        VALUES(${this.#ratePlan}::uuid,${tenant}::uuid,${property}::uuid,'O430','Rate','INR',false,'active')`;
      await tx`INSERT INTO business_day(tenant_id,property_node,business_date)
        VALUES(${tenant}::uuid,${property}::uuid,${this.#businessDate}::date)`;
      await tx`INSERT INTO account(id,tenant_id,property_node,role,name,currency,status) VALUES
        (${this.#revenueAccount}::uuid,${tenant}::uuid,${property}::uuid,'revenue','Revenue','INR','open'),
        (${this.#taxAccount}::uuid,${tenant}::uuid,${property}::uuid,'tax_payable','IGST','INR','open')`;
      await tx`INSERT INTO tx_code(code,name,grp,usali_line,default_dr,default_cr)
        VALUES(${this.#roomCode},'Room','revenue','Rooms','guest','revenue')`;
      await tx`INSERT INTO tx_code(code,name,grp,default_dr,default_cr)
        VALUES(${this.#taxCode},'IGST','tax','guest','tax_payable')`;
      await tx`INSERT INTO tx_code_route(tenant_id,property_node,currency,tx_code,credit_account_id) VALUES
        (${tenant}::uuid,${property}::uuid,'INR',${this.#roomCode},${this.#revenueAccount}::uuid),
        (${tenant}::uuid,${property}::uuid,'INR',${this.#taxCode},${this.#taxAccount}::uuid)`;
      await tx`INSERT INTO tax_semantic_route(tenant_id,id,property_node,currency,jurisdiction_extension_id,
        jurisdiction_owner_tenant_id,jurisdiction_key,jurisdiction_version,jurisdiction_content_hash,
        semantic_kind,semantic_code,tx_code) VALUES
        (${tenant}::uuid,${crypto.randomUUID()}::uuid,${property}::uuid,'INR',${EXTENSION}::uuid,NULL,
          'in-gst-lodging',2,${EXTENSION_HASH},'revenue','room_revenue',${this.#roomCode}),
        (${tenant}::uuid,${crypto.randomUUID()}::uuid,${property}::uuid,'INR',${EXTENSION}::uuid,NULL,
          'in-gst-lodging',2,${EXTENSION_HASH},'tax','IGST',${this.#taxCode})`;
      await tx`INSERT INTO property_fiscal_registration(tenant_id,id,property_node,scheme,currency,
        jurisdiction_extension_id,jurisdiction_owner_tenant_id,jurisdiction_key,jurisdiction_version,
        jurisdiction_content_hash,registration_number,region_code,legal_name,trade_name,address_line,locality,postal_code)
        VALUES(${tenant}::uuid,${this.supplierRegistrationId}::uuid,${property}::uuid,'in-gstin','INR',
          ${EXTENSION}::uuid,NULL,'in-gst-lodging',2,${EXTENSION_HASH},${this.#sellerGstin},'27',
          'Order430 Hotel Private Limited','Order430 Hotel','1 Hotel Road','Mumbai','400001')`;
      await tx`INSERT INTO property_fiscal_location(tenant_id,property_node,country_code,state_code,address_line1,locality,pin)
        VALUES(${tenant}::uuid,${property}::uuid,'IN','29','1 Hotel Road','Bengaluru','560001')`;
      await tx`INSERT INTO india_gst_item_classification(tenant_id,id,property_node,jurisdiction_extension_id,
        jurisdiction_owner_tenant_id,jurisdiction_key,jurisdiction_version,jurisdiction_content_hash,country_code,
        line_id,revenue_group,classification_system,classification_code,is_service_code)
        VALUES(${tenant}::uuid,${this.classificationId}::uuid,${property}::uuid,${EXTENSION}::uuid,NULL,
          'in-gst-lodging',2,${EXTENSION_HASH},'IN','room','room_revenue','SAC','996311','Y')`;
      await tx`INSERT INTO india_gst_supplier_service_location(
        tenant_id,id,supplier_registration_id,supplier_evidence_hash,service_scope,registered_place_kind,location_basis,legal_rule)
        VALUES(${tenant}::uuid,${this.supplierServiceLocationId}::uuid,${this.supplierRegistrationId}::uuid,
          ${this.#supplierEvidenceHash},'lodging_accommodation','principal_place_of_business',
          'supply_made_from_registered_place_of_business','IGST_ACT_2_15_A')`;
      await tx`INSERT INTO india_gst_supplier_registration_status_snapshot(
        tenant_id,supplier_registration_id,supplier_registration_evidence_hash,status_as_of,gst_registration_status,
        gst_taxpayer_type,gst_status_source,gst_status_evidence_sha256,legal_rule)
        VALUES(${tenant}::uuid,${this.supplierRegistrationId}::uuid,${this.#supplierEvidenceHash},${this.#businessDate}::date,
          'active','regular','gst_common_portal',${digest({ tenant, status: "active" })},
          'CGST_ACT_25_29_30_AND_RULE_21A_REGISTRATION_STATUS')`;
      await tx`INSERT INTO india_gst_supplier_sez_status(tenant_id,id,supplier_registration_id,
        supplier_registration_evidence_hash,status_as_of,gst_registration_status,gst_taxpayer_type,gst_status_source,
        gst_status_evidence_sha256,legal_rule) VALUES(${tenant}::uuid,${this.supplierStatusId}::uuid,
        ${this.supplierRegistrationId}::uuid,${this.#supplierEvidenceHash},${this.#businessDate}::date,'active','regular',
        'gst_common_portal',${digest({ tenant, supplier: "active" })},'IGST_ACT_7_5_B_AND_8_2_SUPPLIER_STATUS')`;
    });
  }

  async createMany(count: number): Promise<readonly PersistedIndiaFiscalSourceFixture[]> {
    const sources: PersistedIndiaFiscalSourceFixture[] = [];
    for (let index = 0; index < count; index += 1) sources.push(await this.#createOne());
    return Object.freeze(sources);
  }

  async #createOne(): Promise<PersistedIndiaFiscalSourceFixture> {
    const n = ++this.#serial;
    const tenant = this.tenantId;
    const property = this.propertyNode;
    const party = crypto.randomUUID();
    const recipientRegistrationId = crypto.randomUUID();
    const recipientStatusId = crypto.randomUUID();
    const reservation = crypto.randomUUID();
    const segment = crypto.randomUUID();
    const hold = crypto.randomUUID();
    const holdBinding = crypto.randomUUID();
    const attribution = crypto.randomUUID();
    const lineage = crypto.randomUUID();
    const guestAccount = crypto.randomUUID();
    const folio = crypto.randomUUID();
    const valuation = crypto.randomUUID();
    const applicability = crypto.randomUUID();
    const tax = crypto.randomUUID();
    const quoteHash = hashSentinel(`${n}a`);
    const valuationHash = hashSentinel(`${n}b`);
    const applicabilityHash = hashSentinel(`${n}c`);
    const taxHash = hashSentinel(`${n}d`);
    const sourceHashA = hashSentinel(`${n}7`);
    const sourceHashB = hashSentinel(`${n}8`);
    const value = 100_000n + BigInt(n);
    const taxMinor = 18_000n;
    const snapshot = createPositiveTaxAttributionSnapshot({
      origin: { kind: "rate_quote", quoteHash }, currency: "INR",
      line: { lineId: "room", revenueGroup: "room_revenue", amountMinor: value, nights: 1,
        personNights: 2, roomNights: [{ businessDate: this.#businessDate, amountMinor: value }] },
      assignments: [{ businessDate: this.#businessDate, jurisdictionKey: "in-gst-lodging",
        evidenceRef: `tax-assignment:${hashSentinel(`${n}f`)}` }],
      jurisdiction: { extensionId: EXTENSION, ownerTenantId: null, key: "in-gst-lodging", version: 2,
        contentHash: EXTENSION_HASH, evidenceRef: `tax-jurisdiction:${hashSentinel(`${n}e`)}` },
      evaluation: { schemaVersion: 1, jurisdictionKey: "in-gst-lodging", country: "IN",
        priceDisplay: "tax_exclusive", rounding: "document", inputTotalMinor: value, baseTotalMinor: value,
        taxTotalMinor: taxMinor, grandTotalMinor: value + taxMinor,
        taxes: [{ code: "GST_ROOM", name: "GST", taxMinor, components: [] }] },
    });
    const serviceProvisionSnapshot = crypto.randomUUID();
    const paymentReceiptSnapshot = crypto.randomUUID();
    const invoiceIssueSnapshot = crypto.randomUUID();
    await this.#deploy.begin(async (tx) => {
      await tx`SET LOCAL session_replication_role=replica`;
      await tx`INSERT INTO party(id,tenant_id,kind,display_name,status)
        VALUES(${party}::uuid,${tenant}::uuid,'org',${`Buyer ${n}`} ,'active')`;
      await tx`INSERT INTO reservation(id,tenant_id,property_node,confirmation_no,status,primary_party,channel_code,currency)
        VALUES(${reservation}::uuid,${tenant}::uuid,${property}::uuid,${`O430-R-${n}`} ,'checked_out',${party}::uuid,'direct','INR')`;
      await tx`INSERT INTO reservation_segment(id,tenant_id,reservation_id,seq,unit_type_id,sellable_unit_id,period,
        adults,children,rate_plan_id,status) VALUES(${segment}::uuid,${tenant}::uuid,${reservation}::uuid,1,
        ${this.#unitType}::uuid,${this.#sellable}::uuid,'[2035-01-01,2035-01-02)'::tstzrange,2,'[]',${this.#ratePlan}::uuid,'booked')`;
      await tx`INSERT INTO hold(id,tenant_id,property_node,sellable_unit_id,period,kind,holder,expires_at,status)
        VALUES(${hold}::uuid,${tenant}::uuid,${property}::uuid,${this.#sellable}::uuid,
          '[2035-01-01,2035-01-02)'::tstzrange,'cart','{}','2035-01-02','consumed')`;
      await tx`INSERT INTO tax_attribution_snapshot(tenant_id,id,property_node,actor_id,schema_version,origin_kind,
        origin_quote_hash,snapshot_hash,currency,snapshot) VALUES(${tenant}::uuid,${attribution}::uuid,${property}::uuid,
        ${this.actorId}::uuid,1,'rate_quote',${quoteHash},${snapshot.snapshotHash},'INR',${JSON.stringify(snapshot)}::jsonb)`;
      await tx`INSERT INTO tax_attribution_hold_binding(tenant_id,id,property_node,bound_by,hold_id,attribution_id,
        sellable_unit_id,period,origin_quote_hash,snapshot_hash,currency) VALUES(${tenant}::uuid,${holdBinding}::uuid,
        ${property}::uuid,${this.actorId}::uuid,${hold}::uuid,${attribution}::uuid,${this.#sellable}::uuid,
        '[2035-01-01,2035-01-02)'::tstzrange,${quoteHash},${snapshot.snapshotHash},'INR')`;
      await tx`INSERT INTO tax_attribution_reservation_binding(tenant_id,id,property_node,linked_by,binding_id,hold_id,
        attribution_id,reservation_id,segment_id,sellable_unit_id,period,origin_quote_hash,snapshot_hash,currency)
        VALUES(${tenant}::uuid,${lineage}::uuid,${property}::uuid,${this.actorId}::uuid,${holdBinding}::uuid,${hold}::uuid,
          ${attribution}::uuid,${reservation}::uuid,${segment}::uuid,${this.#sellable}::uuid,
          '[2035-01-01,2035-01-02)'::tstzrange,${quoteHash},${snapshot.snapshotHash},'INR')`;
      await tx`INSERT INTO account(id,tenant_id,property_node,role,party_id,name,currency,status)
        VALUES(${guestAccount}::uuid,${tenant}::uuid,${property}::uuid,'guest',${party}::uuid,${`Guest ${n}`} ,'INR','open')`;
      await tx`INSERT INTO folio(id,tenant_id,account_id,reservation_id,folio_no,window_no,name,status)
        VALUES(${folio}::uuid,${tenant}::uuid,${guestAccount}::uuid,${reservation}::uuid,${`O430-F-${n}`},1,'Primary','open')`;
      await tx`INSERT INTO party_fiscal_registration(tenant_id,id,party_id,scheme,registration_number,region_code,
        legal_name,trade_name,address_line1,locality,pin) VALUES(${tenant}::uuid,${recipientRegistrationId}::uuid,
        ${party}::uuid,'in-gstin',${gstin("29", `fixture-${n}`)},'29',${`Buyer ${n} Private Limited`},
        ${`Buyer ${n}`} ,'1 Buyer Road','Bengaluru','560001')`;
      await tx`INSERT INTO india_gst_accommodation_final_valuation(tenant_id,id,property_node,reservation_id,folio_id,
        folio_account_id,window_no,buyer_party_id,attribution_id,request_id,generation,disposition,currency,
        transaction_value_minor,source_set_hash,order341_evidence_hash,request_hash,evidence_hash,ordinary_evidence_hashes,
        manual_reasons,relationship_conclusion,consideration_conclusion,section15_2_conclusion,section15_3_conclusion,
        source_completeness_conclusion,attestation_evidence_source,attestation_evidence_reference,relationship_set_hash,
        attested_by,actor_id) VALUES(${tenant}::uuid,${valuation}::uuid,${property}::uuid,${reservation}::uuid,${folio}::uuid,
        ${guestAccount}::uuid,1,${party}::uuid,${attribution}::uuid,${crypto.randomUUID()}::uuid,0,'ordinary_final','INR',
        ${value},${hashSentinel(`${n}1`)},${applicabilityHash},${hashSentinel(`${n}2`)},${valuationHash},
        ARRAY[${hashSentinel(`${n}3`)},${hashSentinel(`${n}4`)},${hashSentinel(`${n}5`)},${hashSentinel(`${n}6`)},${sourceHashA}],
        ARRAY[]::text[],'unrelated_not_distinct','money_only','all_additions_enumerated','all_discounts_eligible',
        'all_sources_classified','order430.fixture','live',${hashSentinel(`${n}9`)},${this.actorId}::uuid,${this.actorId}::uuid)`;
      await tx`INSERT INTO india_gst_accommodation_quoted_rate_applicability(tenant_id,id,property_node,reservation_id,
        folio_id,reservation_lineage_id,attribution_id,service_provision_snapshot_id,payment_receipt_snapshot_id,
        invoice_issue_snapshot_id,family_jurisdiction_extension_id,classification_id,supplier_service_location_id,
        supplier_sez_status_id,recipient_sez_status_id,recipient_party_id,final_valuation_id,request_id,section14_case,
        service_provision_date,invoice_issue_date,payment_receipt_date,rate_change_date,time_of_supply_date,
        selected_version_side,selected_extension_id,selected_extension_version,selected_extension_status,selected_content_hash,
        selected_effective_from,component_family,section14_evidence_hash,levy_component_identity_evidence_hash,
        reservation_lineage_evidence_hash,attribution_snapshot_evidence_hash,evidence_hash,actor_id)
        VALUES(${tenant}::uuid,${applicability}::uuid,${property}::uuid,${reservation}::uuid,${folio}::uuid,${lineage}::uuid,
          ${attribution}::uuid,${serviceProvisionSnapshot}::uuid,${paymentReceiptSnapshot}::uuid,${invoiceIssueSnapshot}::uuid,
          ${EXTENSION}::uuid,${this.classificationId}::uuid,${this.supplierServiceLocationId}::uuid,
          ${this.supplierStatusId}::uuid,${recipientStatusId}::uuid,${party}::uuid,${valuation}::uuid,${crypto.randomUUID()}::uuid,
          'supply_invoice_before_payment_after',${this.#businessDate}::date,${this.#businessDate}::date,${this.#businessDate}::date,
          '2025-09-22',${this.#businessDate}::date,'successor',${EXTENSION}::uuid,2,'active',${EXTENSION_HASH},
          '2025-09-21 18:30:00+00','igst',${hashSentinel(`${n}5`)},${hashSentinel(`${n}6`)},${sourceHashA},${sourceHashB},
          ${applicabilityHash},${this.actorId}::uuid)`;
      await tx`INSERT INTO india_gst_accommodation_final_component_tax(tenant_id,id,property_node,reservation_id,folio_id,
        applicability_id,valuation_id,valuation_generation,request_id,generation,currency,transaction_value_minor,tax_minor,
        grand_total_minor,component_family,selected_version_side,selected_extension_id,selected_extension_version,
        final_valuation_evidence_hash,quoted_rate_applicability_evidence_hash,section14_evidence_hash,
        levy_component_identity_evidence_hash,reservation_lineage_evidence_hash,attribution_snapshot_evidence_hash,evidence_hash,actor_id)
        VALUES(${tenant}::uuid,${tax}::uuid,${property}::uuid,${reservation}::uuid,${folio}::uuid,${applicability}::uuid,
          ${valuation}::uuid,0,${crypto.randomUUID()}::uuid,0,'INR',${value},${taxMinor},${value + taxMinor},'igst','successor',
          ${EXTENSION}::uuid,2,${valuationHash},${applicabilityHash},${hashSentinel(`${n}5`)},${hashSentinel(`${n}6`)},
          ${sourceHashA},${sourceHashB},${taxHash},${this.actorId}::uuid)`;
      await tx`INSERT INTO india_gst_accommodation_final_component_tax_room_night(tenant_id,tax_id,ordinal,business_date,
        final_value_minor,currency,slab_upto_minor,aggregate_rate_basis_points,itc_eligible,tax_minor)
        VALUES(${tenant}::uuid,${tax}::uuid,0,${this.#businessDate}::date,${value},'INR',NULL,1800,true,${taxMinor})`;
      await tx`INSERT INTO india_gst_accommodation_final_component_tax_component(tenant_id,tax_id,room_night_ordinal,
        component_ordinal,component_identity,rate_basis_points,tax_amount_minor,currency)
        VALUES(${tenant}::uuid,${tax}::uuid,0,0,'igst',1800,${taxMinor},'INR')`;
    });

    const posted = await this.#database.withTenantTransaction(tenant, (tx) => this.#posting.post(tx, frozen({
      tenantId: tenant, propertyNode: property, reservationId: reservation,
      idempotencyKey: `o430-post-${n}-${crypto.randomUUID()}`,
      envelope: createAuditEnvelope({ operation: "journal.posted", tenantId: tenant, propertyNode: property,
        actorId: this.actorId, requestId: crypto.randomUUID() }),
    })));
    await this.#canonicalizeTax(tax, posted.journalId);

    const resolved = await this.#database.withTenantTransaction(tenant, async (tx) => ({
      seller: await new IndiaGstSupplierRegistrationService().resolve(tx, frozen({ tenantId: tenant, propertyNode: property, reservationId: reservation })),
      recipient: await new IndiaGstRecipientRegistrationService().resolve(tx, frozen({ tenantId: tenant, recipientPartyId: party, registrationId: recipientRegistrationId })),
      classification: await new IndiaGstAccommodationClassificationService().resolve(tx, frozen({ tenantId: tenant, propertyNode: property, reservationId: reservation, classificationId: this.classificationId })),
      pos: await new IndiaGstAccommodationPlaceOfSupplyService().resolve(tx, frozen({ tenantId: tenant, propertyNode: property,
        reservationId: reservation, folioId: folio, recipientPartyId: party,
        recipientRegistrationId, classificationId: this.classificationId })),
    }));
    const serviceLocationEvidenceHash = this.#serviceLocationEvidenceHash;
    const recipientStatusEvidenceHash = digest({ tenantId: tenant, recipient: recipientRegistrationId, n });
    await this.#deploy.begin(async (tx) => {
      await tx`INSERT INTO india_gst_recipient_sez_status(tenant_id,id,recipient_registration_id,
        recipient_registration_evidence_hash,status_as_of,gst_registration_status,gst_taxpayer_type,gst_status_source,
        gst_status_evidence_sha256,legal_rule) VALUES(${tenant}::uuid,${recipientStatusId}::uuid,
        ${recipientRegistrationId}::uuid,${resolved.recipient.evidenceHash},${this.#businessDate}::date,'active','regular',
        'gst_common_portal',${recipientStatusEvidenceHash},'IGST_ACT_7_5_B_AND_8_2_RECIPIENT_STATUS')`;
    });

    const deadlineDate = new Date(`${this.#businessDate}T00:00:00Z`);
    deadlineDate.setUTCDate(deadlineDate.getUTCDate() + 30);
    const timeBody = {
      serviceProvisionSnapshotId: serviceProvisionSnapshot, paymentReceiptSnapshotId: paymentReceiptSnapshot,
      invoiceIssueSnapshotId: invoiceIssueSnapshot, propertyNode: property, reservationId: reservation,
      reservationLineage: { lineageId: lineage, holdBindingId: holdBinding, attributionId: attribution,
        reservationId: reservation, segmentId: segment, originQuoteHash: quoteHash, snapshotHash: snapshot.snapshotHash, currency: "INR" },
      attribution: { originKind: "rate_quote", lineId: "room", revenueGroup: "room_revenue" },
      serviceProvisionDate: this.#businessDate, paymentReceiptDate: this.#businessDate,
      invoiceIssueDate: this.#businessDate, deadlineDate: deadlineDate.toISOString().slice(0, 10),
      candidateDates: { invoiceIssueDate: this.#businessDate, paymentReceiptDate: this.#businessDate },
      branch: "section13_2_a_invoice_or_payment", timeOfSupplyDate: this.#businessDate,
      regime: "ordinary_rule47_30_day", source: "governed_rule47_ordinary_regime_record",
      legalRule: "CGST_ACT_13_2_A_OR_B_ORDINARY_TIME_OF_SUPPLY",
      ordinaryRegimeSource: "governed_rule47_ordinary_regime_record", ordinaryRegimeEvidenceSha256: sourceHashA,
      invoiceSeries: "FY2043", invoiceSerial: String(n).padStart(6, "0"),
      supplierBooksEntryDate: this.#businessDate, supplierBankCreditDate: this.#businessDate,
      coverageScope: "full_attribution", serviceProvisionSource: "governed_service_provision_record",
      serviceProvisionLegalRule: "CGST_ACT_13_2_B_SERVICE_PROVISION_DATE_INPUT_ONLY",
      paymentReceiptSource: "governed_supplier_payment_receipt_record",
      paymentReceiptLegalRule: "CGST_ACT_13_2_EXPLANATION_II_PAYMENT_RECEIPT_DATE_INPUT_ONLY",
      invoiceIssueSource: "governed_supplier_tax_invoice_record",
      invoiceIssueLegalRule: "CGST_ACT_13_2_INVOICE_DATE_INPUT_ONLY",
      serviceProvisionEvidenceSha256: sourceHashA, paymentReceiptEvidenceSha256: sourceHashB,
      invoiceIssueEvidenceSha256: sourceHashA, amountMinor: String(value + taxMinor), currency: "INR",
    };
    const supplierTime = frozen({ ...timeBody, evidenceHash: digest(timeBody) });
    const recipientTime = frozen({ ...timeBody, evidenceHash: digest({ tenantId: tenant, ...timeBody }) });
    const supplierStatusHash = digest({ tenantId: tenant, supplierGstRegistrationStatusId: this.supplierStatusId,
      propertyNode: property, supplierServiceLocation: { id: this.supplierServiceLocationId, evidenceHash: serviceLocationEvidenceHash },
      supplier: { registrationId: this.supplierRegistrationId, evidenceHash: resolved.seller.evidenceHash },
      statusAsOf: this.#businessDate, gstRegistration: { status: "active", taxpayerType: "regular", source: "gst_common_portal",
        evidenceSha256: sourceHashA }, legalRule: "CGST_ACT_25_29_30_AND_RULE_21A_REGISTRATION_STATUS" });
    const recipientStatusHash = digest({ tenantId: tenant, recipientSezStatusId: recipientStatusId,
      recipient: { partyId: party, registrationId: recipientRegistrationId, evidenceHash: resolved.recipient.evidenceHash },
      statusAsOf: this.#businessDate, gstRegistration: { status: "active", taxpayerType: "regular", source: "gst_common_portal",
        evidenceSha256: sourceHashB }, sezStatus: "affirmatively_non_sez_regular", approval: null,
      legalRule: "IGST_ACT_7_5_B_AND_8_2_RECIPIENT_STATUS" });
    const supply: any = {
      propertyNode: property, reservationId: reservation, folioId: folio, supplyDate: this.#businessDate,
      jurisdiction: resolved.seller.jurisdiction,
      supplier: { registrationId: this.supplierRegistrationId, evidenceHash: resolved.seller.evidenceHash,
        stateCode: resolved.seller.stateCode, serviceLocation: { id: this.supplierServiceLocationId,
          evidenceHash: serviceLocationEvidenceHash, kind: "principal_place_of_business", stateCode: resolved.seller.stateCode },
        status: { id: this.supplierStatusId, evidenceHash: supplierStatusHash, statusAsOf: this.#businessDate,
          taxpayerType: "regular", sezStatus: "affirmatively_non_sez_regular" } },
      recipient: { partyId: party, registrationId: recipientRegistrationId, evidenceHash: resolved.recipient.evidenceHash,
        status: { id: recipientStatusId, evidenceHash: recipientStatusHash, statusAsOf: this.#businessDate,
          taxpayerType: "regular", sezStatus: "affirmatively_non_sez_regular" } },
      buyerAssociation: resolved.pos.buyerAssociation,
      classification: { classificationId: this.classificationId, evidenceHash: resolved.classification.evidenceHash },
      placeOfSupply: { candidateHash: resolved.pos.candidateHash, legalRule: resolved.pos.legalRule, pos: resolved.pos.pos },
      registeredStateComparison: { candidateHash: "7".repeat(64),
        comparisonRule: "SUPPLIER_REGISTERED_STATE_VS_ACCOMMODATION_POS", stateRelationship: "different_state_or_union_territory" },
      supplyNature: "inter_state", determinationBasis: "ordinary_registered_state_comparison", sezDirection: "none", legalRule: "IGST_ACT_7_3",
    };
    const supplyNature = frozen({ ...supply, candidateJson: JSON.stringify(supply),
      candidateHash: digest({ tenantId: tenant, candidate: supply }) });
    const supplierStatusBody = { supplierRegistrationId: this.supplierRegistrationId,
      supplierGstRegistrationStatusId: this.supplierStatusId, supplierServiceLocationId: this.supplierServiceLocationId,
      propertyNode: property, reservationId: reservation, statusAsOf: this.#businessDate,
      timeOfSupplyDate: this.#businessDate, result: "active_at_time_of_supply",
      supplierServiceLocation: { id: this.supplierServiceLocationId, evidenceHash: serviceLocationEvidenceHash },
      supplier: { registrationId: this.supplierRegistrationId, evidenceHash: resolved.seller.evidenceHash },
      gstRegistration: { status: "active", taxpayerType: "regular", source: "gst_common_portal", evidenceSha256: sourceHashA },
      supplierRegistrationStatusEvidenceHash: supplierStatusHash, timeOfSupplyEvidenceHash: supplierTime.evidenceHash,
      timeOfSupply: supplierTime, registrationLegalRule: "CGST_ACT_25_29_30_AND_RULE_21A_REGISTRATION_STATUS",
      timeOfSupplyLegalRule: "CGST_ACT_13_2_A_OR_B_ORDINARY_TIME_OF_SUPPLY" };
    const recipientStatusBody = { recipientPartyId: party, recipientRegistrationId, recipientSezStatusId: recipientStatusId,
      propertyNode: property, reservationId: reservation, statusAsOf: this.#businessDate,
      timeOfSupplyDate: this.#businessDate, result: "active_recipient_registration_at_time_of_supply",
      recipient: { registrationId: recipientRegistrationId, evidenceHash: resolved.recipient.evidenceHash },
      gstRegistration: { status: "active", taxpayerType: "regular", source: "gst_common_portal", evidenceSha256: sourceHashB },
      sezStatus: "affirmatively_non_sez_regular", approval: null,
      recipientRegistrationStatusEvidenceHash: recipientStatusHash, timeOfSupplyEvidenceHash: recipientTime.evidenceHash,
      timeOfSupply: recipientTime, recipientRegistrationLegalRule: "IGST_ACT_7_5_B_AND_8_2_RECIPIENT_STATUS",
      timeOfSupplyLegalRule: "CGST_ACT_13_2_A_OR_B_ORDINARY_TIME_OF_SUPPLY" };
    const supplyInput = frozen({ tenantId: tenant, supplyNature,
      supplierRegistrationAtTimeOfSupply: frozen({ ...supplierStatusBody,
        evidenceHash: digest({ tenantId: tenant, ...supplierStatusBody }) }),
      recipientRegistrationAtTimeOfSupply: frozen({ ...recipientStatusBody,
        evidenceHash: digest({ tenantId: tenant, ...recipientStatusBody }) }) });
    const supplyResult = composeIndiaGstAccommodationSupplyNatureAtTimeOfSupply(supplyInput as never);
    const fixture = frozen({ tenant_id: tenant, property_node: property, actor_id: this.actorId,
      reservation_id: reservation, folio_id: folio, journal_id: posted.journalId, buyer_party_id: party,
      recipient_registration_id: recipientRegistrationId, classification_id: this.classificationId,
      supplier_registration_id: this.supplierRegistrationId, supplyInput, supplyResult });
    await this.#database.withTenantTransaction(tenant, (tx) => new IndiaIrpAccommodationSourceService().resolve(tx, frozen({
      tenantId: tenant, propertyNode: property, reservationId: reservation, folioId: folio, journalId: posted.journalId,
      recipientPartyId: party, recipientRegistrationId, classificationId: this.classificationId,
      supplyNatureAtTimeOfSupplyInput: supplyInput, supplyNatureAtTimeOfSupplyResult: supplyResult,
    }) as never));
    return fixture;
  }

  async #canonicalizeTax(taxId: string, journalId: string): Promise<void> {
    const [root] = await this.#deploy<Array<Record<string, unknown>>>`SELECT
      t.tenant_id::text tenant,t.property_node::text property,t.reservation_id::text reservation,t.folio_id::text folio,
      t.valuation_id::text valuation_id,t.valuation_generation,t.tax_minor::text tax_minor,
      t.grand_total_minor::text grand_total_minor,t.final_valuation_evidence_hash,
      t.quoted_rate_applicability_evidence_hash,t.section14_evidence_hash,t.levy_component_identity_evidence_hash,
      t.reservation_lineage_evidence_hash,t.attribution_snapshot_evidence_hash
      FROM india_gst_accommodation_final_component_tax t WHERE t.tenant_id=${this.tenantId}::uuid AND t.id=${taxId}::uuid`;
    const nights = await this.#deploy<Array<Record<string, unknown>>>`SELECT ordinal,business_date::text business_date,
      final_value_minor::text final_value_minor,slab_upto_minor::text slab_upto_minor,aggregate_rate_basis_points,
      itc_eligible,tax_minor::text tax_minor FROM india_gst_accommodation_final_component_tax_room_night
      WHERE tenant_id=${this.tenantId}::uuid AND tax_id=${taxId}::uuid ORDER BY ordinal`;
    const components = await this.#deploy<Array<Record<string, unknown>>>`SELECT room_night_ordinal,component_ordinal,
      component_identity,rate_basis_points,tax_amount_minor::text tax_amount_minor
      FROM india_gst_accommodation_final_component_tax_component
      WHERE tenant_id=${this.tenantId}::uuid AND tax_id=${taxId}::uuid ORDER BY room_night_ordinal,component_ordinal`;
    const roomNights = nights.map((night) => ({ ordinal: String(night.ordinal), businessDate: String(night.business_date),
      transactionValueMinor: String(night.final_value_minor), slab: { uptoMinor: night.slab_upto_minor === null ? null : Number(night.slab_upto_minor),
        aggregateRateBasisPoints: Number(night.aggregate_rate_basis_points), components: components.map((component) => ({
          identity: String(component.component_identity), rateBasisPoints: Number(component.rate_basis_points),
          taxMinor: String(component.tax_amount_minor) })) }, taxMinor: String(night.tax_minor) }));
    const body = { valuationId: String(root!.valuation_id), generation: Number(root!.valuation_generation), roomNights,
      taxMinor: String(root!.tax_minor), grandTotalMinor: String(root!.grand_total_minor), predecessorHashes: {
        finalValuation: String(root!.final_valuation_evidence_hash), quotedRateApplicability: String(root!.quoted_rate_applicability_evidence_hash),
        section14: String(root!.section14_evidence_hash), levyComponentIdentity: String(root!.levy_component_identity_evidence_hash),
        reservationLineage: String(root!.reservation_lineage_evidence_hash), attributionSnapshot: String(root!.attribution_snapshot_evidence_hash) } };
    const canonical = digest({ tenant: String(root!.tenant), property: String(root!.property), reservation: String(root!.reservation),
      folio: String(root!.folio), ...body });
    await this.#deploy.begin(async (tx) => {
      await tx`SET LOCAL session_replication_role=replica`;
      await tx`UPDATE india_gst_accommodation_final_component_tax SET evidence_hash=${canonical}
        WHERE tenant_id=${this.tenantId}::uuid AND id=${taxId}::uuid`;
      await tx`UPDATE india_gst_accommodation_final_component_tax_journal_binding SET tax_evidence_hash=${canonical}
        WHERE tenant_id=${this.tenantId}::uuid AND tax_id=${taxId}::uuid`;
      await tx`UPDATE posting_line SET tax_detail=jsonb_set(tax_detail,'{tax,evidenceHash}',to_jsonb(${canonical}::text),false)
        WHERE tenant_id=${this.tenantId}::uuid AND journal_id=${journalId}::uuid AND seq=1`;
    });
    await this.#database.withTenantTransaction(this.tenantId, (tx) => new IndiaFinalComponentTaxFiscalSourceService().resolve(tx, {
      tenantId: this.tenantId, propertyNode: this.propertyNode,
      reservationId: String(root!.reservation), folioId: String(root!.folio), journalId,
    }));
  }
}
