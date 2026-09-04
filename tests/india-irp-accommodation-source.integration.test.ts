import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { SQL } from "bun";
import { resolve } from "node:path";

import {
  IndiaGstAccommodationClassificationService,
  IndiaGstAccommodationPlaceOfSupplyService,
  IndiaGstRecipientRegistrationService,
  IndiaGstSupplierRegistrationService,
  IndiaIrpAccommodationSourceConflictError,
  IndiaIrpAccommodationSourceNotFoundError,
  IndiaIrpAccommodationSourceService,
  IndiaIrpAccommodationSourceValidationError,
  composeIndiaGstAccommodationSupplyNatureAtTimeOfSupply,
} from "../src/contexts/tax-fiscal";
import { Database } from "../src/kernel";

setDefaultTimeout(300_000);

const deployUrl = process.env.YELLOW_ORDER413_DATABASE_URL ?? process.env.YELLOW_DEPLOY_DATABASE_URL;
const runtimeUrl = process.env.YELLOW_ORDER413_RUNTIME_DATABASE_URL ?? process.env.YELLOW_RUNTIME_DATABASE_URL;
if (process.env.YELLOW_REQUIRE_ORDER413_DATABASE === "1" && (!deployUrl || !runtimeUrl)) {
  throw new Error("Order413 PostgreSQL proof requires deploy and runtime database URLs");
}
const live = deployUrl && runtimeUrl ? describe.serial : describe.skip;
type Mutable = Record<PropertyKey, any>;
interface Root { tenant_id:string; property_node:string; reservation_id:string; folio_id:string; journal_id:string; valuation_id:string; buyer_party_id:string; guest_account_id:string; reservation_primary_party_id:string; original_account_party_id:string|null; primary_folio_status:string; primary_account_status:string; jurisdiction_extension_id:string; jurisdiction_owner_tenant_id:string|null; jurisdiction_key:string; jurisdiction_version:number; jurisdiction_content_hash:string; classification_id:string; supplier_service_location_id:string; supplier_sez_status_id:string; recipient_sez_status_id:string; reservation_lineage_id:string; attribution_id:string; service_provision_snapshot_id:string; payment_receipt_snapshot_id:string; invoice_issue_snapshot_id:string; service_provision_date:string; payment_receipt_date:string; invoice_issue_date:string; time_of_supply_date:string; lineage_binding_id:string; lineage_segment_id:string; lineage_origin_quote_hash:string; lineage_snapshot_hash:string; reservation_lineage_evidence_hash:string; attribution_snapshot_evidence_hash:string; family:"igst"|"cgst_sgst"|"cgst_utgst"; rates:number[]; nights:number; zeroes:number; business_date:string; grand_total_minor:string }
export interface Fixture extends Root { recipient_registration_id:string; classification_id:string; supplier_registration_id:string; extension_id:string; supplyInput:any; supplyResult:any }
export const order413Fixtures: Fixture[] = [];
const digest = (value:unknown) => new Bun.CryptoHasher("sha256").update(JSON.stringify(value)).digest("hex");
const freeze = <T>(value:T, seen=new Set<object>()):T => { if (value && typeof value === "object" && !seen.has(value)) { seen.add(value); for (const key of Reflect.ownKeys(value)) freeze((value as Mutable)[key],seen); Object.freeze(value); } return value; };
const uuid = (seed:string) => { const hex=digest(seed); return `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`; };
const gstin = (stateCode:string, seed:string) => {
  const alphabet="0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const serial=String(Number.parseInt(digest(seed).slice(0,8),16)%10_000).padStart(4,"0");
  const body=`${stateCode}ABCDE${serial}F1Z`;
  let factor=2,sum=0;
  for(let index=body.length-1;index>=0;index-=1){const product=factor*alphabet.indexOf(body[index]!);factor=factor===2?1:2;sum+=Math.floor(product/36)+product%36;}
  return `${body}${alphabet[(36-sum%36)%36]!}`;
};
const addUtcDays = (date:string, days:number) => {
  const instant=new Date(`${date}T00:00:00.000Z`);
  instant.setUTCDate(instant.getUTCDate()+days);
  return instant.toISOString().slice(0,10);
};

live("Order413 live India accommodation statutory-envelope eligibility", () => {
  const deploy = new SQL(deployUrl!, { max:4, prepare:false });
  const database = Database.connect(runtimeUrl!, { maxConnections:8, prepare:false });
  const service = new IndiaIrpAccommodationSourceService();
  const fixtures = order413Fixtures;
  let ineligibleRoots:Root[]=[];

  const selected = (x:Fixture) => freeze({ tenantId:x.tenant_id, propertyNode:x.property_node, reservationId:x.reservation_id, folioId:x.folio_id, journalId:x.journal_id, recipientPartyId:x.buyer_party_id, recipientRegistrationId:x.recipient_registration_id, classificationId:x.classification_id, supplyNatureAtTimeOfSupplyInput:x.supplyInput, supplyNatureAtTimeOfSupplyResult:x.supplyResult });
  const read = (x:Fixture, input:any=selected(x)) => database.withTenantTransaction(x.tenant_id, tx => service.resolve(tx,input));
  async function census(tenant:string) {
    const [row]=await deploy<Array<{snapshot:unknown}>>`SELECT jsonb_build_object(
      'tenant_tables',(SELECT jsonb_object_agg(c.relname,(SELECT count(*) FROM pg_catalog.pg_class q WHERE q.oid=c.oid)) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid AND a.attname='tenant_id' WHERE c.relnamespace='public'::regnamespace AND c.relkind='r'),
      'financial',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.journal_id),'[]') FROM india_gst_accommodation_final_component_tax_journal_binding x WHERE x.tenant_id=${tenant}::uuid),
      'journals',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.id),'[]') FROM journal x WHERE x.tenant_id=${tenant}::uuid),
      'lines',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.journal_id,x.seq),'[]') FROM posting_line x WHERE x.tenant_id=${tenant}::uuid),
      'valuations',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.id,x.generation),'[]') FROM india_gst_accommodation_final_valuation x WHERE x.tenant_id=${tenant}::uuid),
      'tax',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.id,x.generation),'[]') FROM india_gst_accommodation_final_component_tax x WHERE x.tenant_id=${tenant}::uuid),
      'supplier',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.id),'[]') FROM property_fiscal_registration x WHERE x.tenant_id=${tenant}::uuid),
      'recipient',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.id),'[]') FROM party_fiscal_registration x WHERE x.tenant_id=${tenant}::uuid),
      'location',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.property_node),'[]') FROM property_fiscal_location x WHERE x.tenant_id=${tenant}::uuid),
      'classification',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.id),'[]') FROM india_gst_item_classification x WHERE x.tenant_id=${tenant}::uuid),
      'facts',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.id),'[]') FROM fact_log x WHERE x.tenant_id=${tenant}::uuid),
      'events',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.seq),'[]') FROM outbox x WHERE x.tenant_id=${tenant}::uuid),
      'documents',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.id),'[]') FROM document x WHERE x.tenant_id=${tenant}::uuid),
      'submissions',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.id),'[]') FROM fiscal_submission x WHERE x.tenant_id=${tenant}::uuid)) snapshot`;
    return JSON.stringify(row!.snapshot);
  }
  function divergentReplay(source:Fixture, field:"amountMinor"|"currency", value:string) {
    const input=structuredClone(source.supplyInput) as Mutable;
    for (const [name, tenantBound] of [["supplierRegistrationAtTimeOfSupply",false],["recipientRegistrationAtTimeOfSupply",true]] as const) {
      const registration=input[name] as Mutable;
      const time=registration.timeOfSupply as Mutable;
      time[field]=value;
      if(field==="currency") time.reservationLineage.currency=value;
      const timeBody={...time}; delete timeBody.evidenceHash;
      time.evidenceHash=tenantBound?digest({tenantId:source.tenant_id,...timeBody}):digest(timeBody);
      registration.timeOfSupplyEvidenceHash=time.evidenceHash;
      const registrationBody={...registration}; delete registrationBody.evidenceHash;
      registration.evidenceHash=digest({tenantId:source.tenant_id,...registrationBody});
    }
    freeze(input);
    return freeze({ ...selected(source), supplyNatureAtTimeOfSupplyInput:input,
      supplyNatureAtTimeOfSupplyResult:field==="currency"
        ? source.supplyResult
        : composeIndiaGstAccommodationSupplyNatureAtTimeOfSupply(input as never) });
  }

  beforeAll(async () => {
    const child=Bun.spawn(["bun","test","tests/india-final-component-tax-fiscal-source.integration.test.ts"],{cwd:resolve(import.meta.dir,".."),stdout:"pipe",stderr:"pipe",env:{...process.env,YELLOW_ORDER412_DATABASE_URL:deployUrl!,YELLOW_ORDER412_RUNTIME_DATABASE_URL:runtimeUrl!,YELLOW_REQUIRE_ORDER412_DATABASE:"1"}});
    const [code,stdout,stderr]=await Promise.all([child.exited,new Response(child.stdout).text(),new Response(child.stderr).text()]);
    expect(`${stdout}\n${stderr}`).toContain("Order412"); expect(code).toBe(0);
    const roots=await deploy<Root[]>`SELECT b.tenant_id::text,b.property_node::text,b.reservation_id::text,b.folio_id::text,b.journal_id::text,b.valuation_id::text,v.buyer_party_id::text,
      f.account_id::text guest_account_id,rsv.primary_party::text reservation_primary_party_id,a.party_id::text original_account_party_id,
      f.status primary_folio_status,a.status primary_account_status,
      app.selected_extension_id::text jurisdiction_extension_id,e.tenant_id::text jurisdiction_owner_tenant_id,e.key jurisdiction_key,
      app.selected_extension_version::int jurisdiction_version,app.selected_content_hash jurisdiction_content_hash,
      app.classification_id::text classification_id,app.supplier_service_location_id::text supplier_service_location_id,
      app.supplier_sez_status_id::text supplier_sez_status_id,app.recipient_sez_status_id::text recipient_sez_status_id,
      app.reservation_lineage_id::text reservation_lineage_id,app.attribution_id::text attribution_id,
      app.service_provision_snapshot_id::text service_provision_snapshot_id,app.payment_receipt_snapshot_id::text payment_receipt_snapshot_id,
      app.invoice_issue_snapshot_id::text invoice_issue_snapshot_id,app.service_provision_date::text service_provision_date,
      app.payment_receipt_date::text payment_receipt_date,app.invoice_issue_date::text invoice_issue_date,app.time_of_supply_date::text time_of_supply_date,
      lineage.binding_id::text lineage_binding_id,lineage.segment_id::text lineage_segment_id,lineage.origin_quote_hash lineage_origin_quote_hash,
      lineage.snapshot_hash lineage_snapshot_hash,app.reservation_lineage_evidence_hash,app.attribution_snapshot_evidence_hash,
      t.component_family family,t.grand_total_minor::text grand_total_minor,ARRAY(SELECT DISTINCT aggregate_rate_basis_points FROM india_gst_accommodation_final_component_tax_room_night n WHERE n.tenant_id=t.tenant_id AND n.tax_id=t.id ORDER BY 1) rates,
      (SELECT count(*)::int FROM india_gst_accommodation_final_component_tax_room_night n WHERE n.tenant_id=t.tenant_id AND n.tax_id=t.id) nights,
      (SELECT count(*)::int FROM india_gst_accommodation_final_component_tax_component c WHERE c.tenant_id=t.tenant_id AND c.tax_id=t.id AND c.tax_amount_minor=0) zeroes,
      j.business_date::text business_date FROM india_gst_accommodation_final_component_tax_journal_binding b JOIN india_gst_accommodation_final_component_tax t ON t.tenant_id=b.tenant_id AND t.id=b.tax_id JOIN india_gst_accommodation_quoted_rate_applicability app ON app.tenant_id=t.tenant_id AND app.id=t.applicability_id JOIN tax_attribution_reservation_binding lineage ON lineage.tenant_id=app.tenant_id AND lineage.id=app.reservation_lineage_id JOIN extension e ON e.id=app.selected_extension_id JOIN india_gst_accommodation_final_valuation v ON v.tenant_id=b.tenant_id AND v.id=b.valuation_id JOIN journal j ON j.tenant_id=b.tenant_id AND j.id=b.journal_id JOIN folio f ON f.tenant_id=b.tenant_id AND f.id=b.folio_id JOIN account a ON a.tenant_id=f.tenant_id AND a.id=f.account_id JOIN reservation rsv ON rsv.tenant_id=b.tenant_id AND rsv.id=b.reservation_id LEFT JOIN india_gst_final_component_tax_journal_reversal_binding r ON r.tenant_id=b.tenant_id AND r.original_journal_id=b.journal_id WHERE r.id IS NULL ORDER BY b.id`;
    ineligibleRoots=roots.filter(root=>root.primary_folio_status!=="open" || root.primary_account_status!=="open" || root.original_account_party_id!==root.reservation_primary_party_id);
    for (const root of roots) {
      if(ineligibleRoots.includes(root)) continue;
      const extension_id=root.jurisdiction_extension_id, supplier_registration_id=uuid(root.journal_id+"supplier"), recipient_registration_id=uuid(root.journal_id+"recipient"), classification_id=root.classification_id;
      const sellerState=root.family==="cgst_utgst"?"04":"27", posState=root.family==="igst"?"29":sellerState, key=root.jurisdiction_key;
      const sellerGstin=gstin(sellerState,root.journal_id+"seller-gstin"), recipientGstin=gstin(posState,root.journal_id+"recipient-gstin");
      const contentHash=root.jurisdiction_content_hash;
      expect(contentHash).toMatch(/^[0-9a-f]{64}$/);
      await deploy`INSERT INTO property_fiscal_registration(tenant_id,id,property_node,scheme,currency,jurisdiction_extension_id,jurisdiction_owner_tenant_id,jurisdiction_key,jurisdiction_version,jurisdiction_content_hash,registration_number,region_code,legal_name,trade_name,address_line,locality,postal_code) VALUES(${root.tenant_id}::uuid,${supplier_registration_id}::uuid,${root.property_node}::uuid,'in-gstin','INR',${extension_id}::uuid,${root.jurisdiction_owner_tenant_id}::uuid,${key},${root.jurisdiction_version},${contentHash},${sellerGstin},${sellerState},'Order 413 Hotel Private Limited','Order 413 Hotel','1 Hotel Road','Hotel City','400001')`;
      await deploy`INSERT INTO party_fiscal_registration(tenant_id,id,party_id,scheme,registration_number,region_code,legal_name,trade_name,address_line1,locality,pin) VALUES(${root.tenant_id}::uuid,${recipient_registration_id}::uuid,${root.buyer_party_id}::uuid,'in-gstin',${recipientGstin},${posState},'Order 413 Buyer Private Limited','Order 413 Buyer','1 Buyer Road','Buyer City','560001')`;
      await deploy`INSERT INTO property_fiscal_location(tenant_id,property_node,country_code,state_code,address_line1,locality,pin) VALUES(${root.tenant_id}::uuid,${root.property_node}::uuid,'IN',${posState},'1 Hotel Road','Hotel City','400001')`;
      await deploy`INSERT INTO india_gst_item_classification(tenant_id,id,property_node,jurisdiction_extension_id,jurisdiction_owner_tenant_id,jurisdiction_key,jurisdiction_version,jurisdiction_content_hash,country_code,line_id,revenue_group,classification_system,classification_code,is_service_code) VALUES(${root.tenant_id}::uuid,${classification_id}::uuid,${root.property_node}::uuid,${extension_id}::uuid,${root.jurisdiction_owner_tenant_id}::uuid,${key},${root.jurisdiction_version},${contentHash},'IN','room','room_revenue','SAC','996311','Y')`;
      const partial={...root,extension_id,supplier_registration_id,recipient_registration_id,classification_id} as Fixture;
      const resolved=await database.withTenantTransaction(root.tenant_id,async tx=>({seller:await new IndiaGstSupplierRegistrationService().resolve(tx,freeze({tenantId:root.tenant_id,propertyNode:root.property_node,reservationId:root.reservation_id})),recipient:await new IndiaGstRecipientRegistrationService().resolve(tx,freeze({tenantId:root.tenant_id,recipientPartyId:root.buyer_party_id,registrationId:recipient_registration_id})),classification:await new IndiaGstAccommodationClassificationService().resolve(tx,freeze({tenantId:root.tenant_id,propertyNode:root.property_node,reservationId:root.reservation_id,classificationId:classification_id})),pos:await new IndiaGstAccommodationPlaceOfSupplyService().resolve(tx,freeze({tenantId:root.tenant_id,propertyNode:root.property_node,reservationId:root.reservation_id,folioId:root.folio_id,recipientPartyId:root.buyer_party_id,recipientRegistrationId:recipient_registration_id,classificationId:classification_id}))}));
      const date=root.time_of_supply_date, deadlineDate=addUtcDays(root.service_provision_date,30), tosBody={serviceProvisionSnapshotId:root.service_provision_snapshot_id,paymentReceiptSnapshotId:root.payment_receipt_snapshot_id,invoiceIssueSnapshotId:root.invoice_issue_snapshot_id,propertyNode:root.property_node,reservationId:root.reservation_id,reservationLineage:{lineageId:root.reservation_lineage_id,holdBindingId:root.lineage_binding_id,attributionId:root.attribution_id,reservationId:root.reservation_id,segmentId:root.lineage_segment_id,originQuoteHash:root.lineage_origin_quote_hash,snapshotHash:root.lineage_snapshot_hash,currency:"INR"},attribution:{originKind:"rate_quote",lineId:"room",revenueGroup:"room_revenue"},serviceProvisionDate:root.service_provision_date,paymentReceiptDate:root.payment_receipt_date,invoiceIssueDate:root.invoice_issue_date,deadlineDate,candidateDates:{invoiceIssueDate:root.invoice_issue_date,paymentReceiptDate:root.payment_receipt_date},branch:"section13_2_a_invoice_or_payment",timeOfSupplyDate:date,regime:"ordinary_rule47_30_day",source:"governed_rule47_ordinary_regime_record",legalRule:"CGST_ACT_13_2_A_OR_B_ORDINARY_TIME_OF_SUPPLY",ordinaryRegimeSource:"governed_rule47_ordinary_regime_record",ordinaryRegimeEvidenceSha256:root.reservation_lineage_evidence_hash,invoiceSeries:"FY2043",invoiceSerial:"000413",supplierBooksEntryDate:root.payment_receipt_date,supplierBankCreditDate:root.payment_receipt_date,coverageScope:"full_attribution",serviceProvisionSource:"governed_service_provision_record",serviceProvisionLegalRule:"CGST_ACT_13_2_B_SERVICE_PROVISION_DATE_INPUT_ONLY",paymentReceiptSource:"governed_supplier_payment_receipt_record",paymentReceiptLegalRule:"CGST_ACT_13_2_EXPLANATION_II_PAYMENT_RECEIPT_DATE_INPUT_ONLY",invoiceIssueSource:"governed_supplier_tax_invoice_record",invoiceIssueLegalRule:"CGST_ACT_13_2_INVOICE_DATE_INPUT_ONLY",serviceProvisionEvidenceSha256:root.reservation_lineage_evidence_hash,paymentReceiptEvidenceSha256:root.attribution_snapshot_evidence_hash,invoiceIssueEvidenceSha256:root.reservation_lineage_evidence_hash,amountMinor:root.grand_total_minor,currency:"INR"};
      const tos=freeze({...tosBody,evidenceHash:digest(tosBody)}), recipientTos=freeze({...tosBody,evidenceHash:digest({tenantId:root.tenant_id,...tosBody})});
      const serviceLocationEvidenceHash=digest({tenantId:root.tenant_id,id:root.supplier_service_location_id,propertyNode:root.property_node,stateCode:resolved.seller.stateCode});
      const supplierStatusHash=digest({tenantId:root.tenant_id,supplierGstRegistrationStatusId:root.supplier_sez_status_id,propertyNode:root.property_node,supplierServiceLocation:{id:root.supplier_service_location_id,evidenceHash:serviceLocationEvidenceHash},supplier:{registrationId:supplier_registration_id,evidenceHash:resolved.seller.evidenceHash},statusAsOf:date,gstRegistration:{status:"active",taxpayerType:"regular",source:"gst_common_portal",evidenceSha256:root.reservation_lineage_evidence_hash},legalRule:"CGST_ACT_25_29_30_AND_RULE_21A_REGISTRATION_STATUS"});
      const recipientStatusHash=digest({tenantId:root.tenant_id,recipientSezStatusId:root.recipient_sez_status_id,recipient:{partyId:root.buyer_party_id,registrationId:recipient_registration_id,evidenceHash:resolved.recipient.evidenceHash},statusAsOf:date,gstRegistration:{status:"active",taxpayerType:"regular",source:"gst_common_portal",evidenceSha256:root.attribution_snapshot_evidence_hash},sezStatus:"affirmatively_non_sez_regular",approval:null,legalRule:"IGST_ACT_7_5_B_AND_8_2_RECIPIENT_STATUS"});
      const supply:any={propertyNode:root.property_node,reservationId:root.reservation_id,folioId:root.folio_id,supplyDate:date,jurisdiction:resolved.seller.jurisdiction,supplier:{registrationId:resolved.seller.registrationId,evidenceHash:resolved.seller.evidenceHash,stateCode:resolved.seller.stateCode,serviceLocation:{id:root.supplier_service_location_id,evidenceHash:serviceLocationEvidenceHash,kind:"principal_place_of_business",stateCode:resolved.seller.stateCode},status:{id:root.supplier_sez_status_id,evidenceHash:supplierStatusHash,statusAsOf:date,taxpayerType:"regular",sezStatus:"affirmatively_non_sez_regular"}},recipient:{partyId:root.buyer_party_id,registrationId:resolved.recipient.registrationId,evidenceHash:resolved.recipient.evidenceHash,status:{id:root.recipient_sez_status_id,evidenceHash:recipientStatusHash,statusAsOf:date,taxpayerType:"regular",sezStatus:"affirmatively_non_sez_regular"}},buyerAssociation:resolved.pos.buyerAssociation,classification:{classificationId:classification_id,evidenceHash:resolved.classification.evidenceHash},placeOfSupply:{candidateHash:resolved.pos.candidateHash,legalRule:resolved.pos.legalRule,pos:resolved.pos.pos},registeredStateComparison:{candidateHash:"7".repeat(64),comparisonRule:"SUPPLIER_REGISTERED_STATE_VS_ACCOMMODATION_POS",stateRelationship:root.family==="igst"?"different_state_or_union_territory":"same_state_or_union_territory"},supplyNature:root.family==="igst"?"inter_state":"intra_state",determinationBasis:"ordinary_registered_state_comparison",sezDirection:"none",legalRule:root.family==="igst"?"IGST_ACT_7_3":"IGST_ACT_8_2"};
      const candidateJson=JSON.stringify(supply); const supplyNature=freeze({...supply,candidateJson,candidateHash:digest({tenantId:root.tenant_id,candidate:supply})});
      const supplierStatusBody={supplierRegistrationId:supplier_registration_id,supplierGstRegistrationStatusId:supply.supplier.status.id,supplierServiceLocationId:supply.supplier.serviceLocation.id,propertyNode:root.property_node,reservationId:root.reservation_id,statusAsOf:date,timeOfSupplyDate:date,result:"active_at_time_of_supply",supplierServiceLocation:{id:supply.supplier.serviceLocation.id,evidenceHash:supply.supplier.serviceLocation.evidenceHash},supplier:{registrationId:supplier_registration_id,evidenceHash:resolved.seller.evidenceHash},gstRegistration:{status:"active",taxpayerType:"regular",source:"gst_common_portal",evidenceSha256:root.reservation_lineage_evidence_hash},supplierRegistrationStatusEvidenceHash:supply.supplier.status.evidenceHash,timeOfSupplyEvidenceHash:tos.evidenceHash,timeOfSupply:tos,registrationLegalRule:"CGST_ACT_25_29_30_AND_RULE_21A_REGISTRATION_STATUS",timeOfSupplyLegalRule:"CGST_ACT_13_2_A_OR_B_ORDINARY_TIME_OF_SUPPLY"};
      const recipientStatusBody={recipientPartyId:root.buyer_party_id,recipientRegistrationId:recipient_registration_id,recipientSezStatusId:supply.recipient.status.id,propertyNode:root.property_node,reservationId:root.reservation_id,statusAsOf:date,timeOfSupplyDate:date,result:"active_recipient_registration_at_time_of_supply",recipient:{registrationId:recipient_registration_id,evidenceHash:resolved.recipient.evidenceHash},gstRegistration:{status:"active",taxpayerType:"regular",source:"gst_common_portal",evidenceSha256:root.attribution_snapshot_evidence_hash},sezStatus:"affirmatively_non_sez_regular",approval:null,recipientRegistrationStatusEvidenceHash:supply.recipient.status.evidenceHash,timeOfSupplyEvidenceHash:recipientTos.evidenceHash,timeOfSupply:recipientTos,recipientRegistrationLegalRule:"IGST_ACT_7_5_B_AND_8_2_RECIPIENT_STATUS",timeOfSupplyLegalRule:"CGST_ACT_13_2_A_OR_B_ORDINARY_TIME_OF_SUPPLY"};
      const supplyInput=freeze({tenantId:root.tenant_id,supplyNature,supplierRegistrationAtTimeOfSupply:freeze({...supplierStatusBody,evidenceHash:digest({tenantId:root.tenant_id,...supplierStatusBody})}),recipientRegistrationAtTimeOfSupply:freeze({...recipientStatusBody,evidenceHash:digest({tenantId:root.tenant_id,...recipientStatusBody})})});
      partial.supplyInput=supplyInput; partial.supplyResult=composeIndiaGstAccommodationSupplyNatureAtTimeOfSupply(supplyInput as never); fixtures.push(partial);
    }
  });

  afterAll(async()=>{
    await database.close();await deploy.close({timeout:0});
  });

  test("5/12/18, every family, multiple nights and zero components compose exact deterministic frozen envelopes",async()=>{
    expect(new Set(fixtures.flatMap(x=>x.rates))).toEqual(new Set([500,1200,1800])); expect(new Set(fixtures.map(x=>x.family))).toEqual(new Set(["igst","cgst_sgst","cgst_utgst"])); expect(fixtures.some(x=>x.nights>1)).toBeTrue(); expect(fixtures.some(x=>x.zeroes>0)).toBeTrue();
    for(const fixture of fixtures){
      const before=await census(fixture.tenant_id); const first=await read(fixture);
      const second=await read(fixture); expect(first.state).toBe("eligible_irp_invoice_source");expect(first.financialSource.componentFamily).toBe(fixture.family);expect(first.financialSource.businessDate).toBe(fixture.business_date);expect(first.legalBuyerPartyId).toBe(fixture.buyer_party_id);expect(first.sellerDetails.payload.SellerDtls.Gstin).toBe(first.sellerRegistration.gstin);expect(first.buyerDetails.payload.BuyerDtls.Gstin).toBe(first.recipientRegistration.gstin);expect(first.placeOfSupply.pos).toBe(fixture.family==="igst"?"29":fixture.family==="cgst_utgst"?"04":"27");expect(first.classification.classificationCode).toBe("996311");expect(first.classification.isServiceCode).toBe("Y");expect(first.supplyNatureAtTimeOfSupply.supplyDate).toBe(fixture.time_of_supply_date);expect(first.componentFamily.componentFamily).toBe(fixture.family);expect(first).toEqual(second);expect(Object.isFrozen(first)).toBeTrue();expect(Object.isFrozen(first.financialSource)).toBeTrue();expect(Object.isFrozen(first.sellerDetails.payload.SellerDtls)).toBeTrue();expect(Object.isFrozen(first.componentFamily)).toBeTrue();expect(JSON.stringify(first)).not.toContain(fixture.tenant_id);expect(await census(fixture.tenant_id)).toBe(before);
    }
  });

  test("closed or party-divergent Order412 sources remain statutorily ineligible and read-only",async()=>{
    expect(ineligibleRoots.length).toBeGreaterThan(0);
    const donor=fixtures[0]!;
    for(const root of ineligibleRoots){
      const input=freeze({...selected(donor),tenantId:root.tenant_id,propertyNode:root.property_node,reservationId:root.reservation_id,folioId:root.folio_id,journalId:root.journal_id,recipientPartyId:root.buyer_party_id});
      const before=await census(root.tenant_id);
      await expect(database.withTenantTransaction(root.tenant_id,tx=>service.resolve(tx,input))).rejects.toThrow();
      expect(await census(root.tenant_id)).toBe(before);
    }
  });

  test("foreign and mixed selectors, stale sources, reversals and statutory mutations fail closed without writes",async()=>{
    const own=fixtures[0]!,foreign=fixtures.find(x=>x.tenant_id!==own.tenant_id)!; const mutations=[{...selected(own),journalId:foreign.journal_id},{...selected(own),recipientPartyId:foreign.buyer_party_id},{...selected(own),classificationId:foreign.classification_id}];
    for(const value of mutations){const beforeOwn=await census(own.tenant_id),beforeForeign=await census(foreign.tenant_id);await expect(read(own,freeze(value))).rejects.toThrow();expect(await census(own.tenant_id)).toBe(beforeOwn);expect(await census(foreign.tenant_id)).toBe(beforeForeign);}
    const mixed=structuredClone(selected(own)) as Mutable;mixed.supplyNatureAtTimeOfSupplyResult.evidenceHash="0".repeat(64);freeze(mixed);const before=await census(own.tenant_id);await expect(read(own,mixed)).rejects.toBeInstanceOf(IndiaIrpAccommodationSourceConflictError);expect(await census(own.tenant_id)).toBe(before);
    const stale=fixtures[1]!;
    await deploy`SET session_replication_role=replica`;
    try {
      await deploy`INSERT INTO india_gst_final_component_tax_journal_reversal_binding(
        tenant_id,id,property_node,reversed_by,posting_binding_id,tax_id,original_journal_id,reversal_journal_id,
        reservation_id,folio_id,currency,business_date)
        SELECT b.tenant_id,${uuid(stale.journal_id+"reversal-binding")}::uuid,b.property_node,b.posted_by,b.id,b.tax_id,b.journal_id,${uuid(stale.journal_id+"reversal-journal")}::uuid,
          b.reservation_id,b.folio_id,b.currency,b.business_date
        FROM india_gst_accommodation_final_component_tax_journal_binding b
        WHERE b.tenant_id=${stale.tenant_id}::uuid AND b.journal_id=${stale.journal_id}::uuid`;
      const afterSabotage=await census(stale.tenant_id);await expect(read(stale)).rejects.toBeInstanceOf(IndiaIrpAccommodationSourceNotFoundError);expect(await census(stale.tenant_id)).toBe(afterSabotage);
    } finally {
      await deploy`DELETE FROM india_gst_final_component_tax_journal_reversal_binding WHERE tenant_id=${stale.tenant_id}::uuid AND original_journal_id=${stale.journal_id}::uuid`;
      await deploy`SET session_replication_role=origin`;
    }
  });

  test("complete valid but different persisted Order297 ancestry and every supported identity/hash splice fail closed",async()=>{
    const target=fixtures[0]!, other=fixtures.find(x=>x!==target && x.family===target.family) ?? fixtures[1]!;
    const splices:Mutable[]=[];
    splices.push({ ...selected(target), supplyNatureAtTimeOfSupplyInput:other.supplyInput,
      supplyNatureAtTimeOfSupplyResult:other.supplyResult });
    for (const path of [
      ["supplyNature","classification","classificationId"],
      ["supplyNature","classification","evidenceHash"],
      ["supplyNature","supplier","registrationId"],
      ["supplyNature","supplier","evidenceHash"],
      ["supplyNature","supplier","serviceLocation","id"],
      ["supplyNature","supplier","serviceLocation","evidenceHash"],
      ["supplyNature","supplier","status","id"],
      ["supplyNature","supplier","status","evidenceHash"],
      ["supplyNature","recipient","registrationId"],
      ["supplyNature","recipient","evidenceHash"],
      ["supplyNature","recipient","status","id"],
      ["supplyNature","recipient","status","evidenceHash"],
    ] as const) {
      const candidate=structuredClone(selected(target)) as Mutable;
      let left=candidate.supplyNatureAtTimeOfSupplyInput as Mutable;
      let right=other.supplyInput as Mutable;
      for (const key of path.slice(0,-1)) { left=left[key] as Mutable; right=right[key] as Mutable; }
      left[path.at(-1)!]=right[path.at(-1)!];
      freeze(candidate); splices.push(candidate);
    }
    for(const splice of splices){const before=await census(target.tenant_id);await expect(read(target,freeze(splice))).rejects.toThrow();expect(await census(target.tenant_id)).toBe(before);}
  });

  test("replayed amount/currency divergence and a deeply frozen cycle are domain failures with unchanged census",async()=>{
    const target=fixtures.find(x=>x.family!=="cgst_sgst")!;
    for(const divergent of [divergentReplay(target,"amountMinor",String(BigInt(target.grand_total_minor)+1n)),divergentReplay(target,"currency","USD")]){
      const before=await census(target.tenant_id);await expect(read(target,divergent)).rejects.toBeInstanceOf(IndiaIrpAccommodationSourceConflictError);expect(await census(target.tenant_id)).toBe(before);
    }
    const cyclic=structuredClone(selected(target)) as Mutable;
    cyclic.supplyNatureAtTimeOfSupplyInput.supplyNature.jurisdiction.extensionId=cyclic;
    freeze(cyclic);
    const before=await census(target.tenant_id);
    try { await read(target,cyclic); expect.unreachable("cyclic graph must fail closed"); }
    catch(error) { expect(error).not.toBeInstanceOf(TypeError); expect(error instanceof IndiaIrpAccommodationSourceValidationError || error instanceof IndiaIrpAccommodationSourceConflictError).toBeTrue(); }
    expect(await census(target.tenant_id)).toBe(before);
  });
});
