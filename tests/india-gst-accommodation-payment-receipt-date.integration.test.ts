import { describe, expect, test } from "bun:test";
import { IndiaGstAccommodationPaymentReceiptDateConflictError, IndiaGstAccommodationPaymentReceiptDateNotFoundError, IndiaGstAccommodationPaymentReceiptDateService, IndiaGstAccommodationPaymentReceiptDateValidationError, createPositiveTaxAttributionSnapshot, type CreatePositiveTaxAttributionSnapshotInput } from "../src/contexts/tax-fiscal";
import type { Tx } from "../src/kernel";

const id=(n:number)=>`00000000-0000-0000-0000-${String(n).padStart(12,"0")}`;
const TENANT=id(29101), OTHER=id(29102), PROPERTY=id(29103), RES=id(29105), LINE=id(29106), HOLD=id(29107), ATTR=id(29108), SEG=id(29109), SERVICE=id(29110), RECEIPT=id(29111), OTHER_RECEIPT=id(29112), EXT=id(29113);
const BOOKS="2043-06-21", BANK="2043-06-19", EARLIER=BANK, Q="a".repeat(64), SH="f".repeat(64), SE="b".repeat(64), RE="c".repeat(64), LEGAL="CGST_ACT_13_2_EXPLANATION_II_PAYMENT_RECEIPT_DATE_INPUT_ONLY";
type Mutable=Record<PropertyKey,unknown>;
interface Row { tenant_id:string; id:string; service_provision_snapshot_id:string; currency:string; amount_minor:string; coverage_scope:string; supplier_books_entry_date:string; supplier_bank_credit_date:string; payment_receipt_date:string; payment_receipt_source:string; payment_receipt_evidence_sha256:string; legal_rule:string; service_tenant_id:string; service_id:string; property_node:string; reservation_lineage_id:string; hold_binding_id:string; attribution_id:string; reservation_id:string; segment_id:string; origin_quote_hash:string; snapshot_hash:string; service_currency:string; service_provision_date:string; service_provision_source:string; service_provision_evidence_sha256:string; service_legal_rule:string; lineage_id:string; lineage_property_node:string; lineage_hold_binding_id:string; lineage_attribution_id:string; lineage_reservation_id:string; lineage_segment_id:string; lineage_origin_quote_hash:string; lineage_snapshot_hash:string; lineage_currency:string; attribution_snapshot:unknown }
function attribution(overrides:Partial<CreatePositiveTaxAttributionSnapshotInput>={}) { return createPositiveTaxAttributionSnapshot({ origin:{kind:"rate_quote",quoteHash:Q},currency:"INR",line:{lineId:"room",revenueGroup:"room_revenue",amountMinor:10000n,nights:1,personNights:2,roomNights:[{businessDate:"2039-01-01",amountMinor:10000n}]},assignments:[{businessDate:"2039-01-01",jurisdictionKey:"in.order291.gst.27",evidenceRef:`tax-assignment:${Q}`}],jurisdiction:{extensionId:EXT,ownerTenantId:TENANT,key:"in.order291.gst.27",version:7,contentHash:"d".repeat(64),evidenceRef:`tax-jurisdiction:${"e".repeat(64)}`},evaluation:{schemaVersion:1,jurisdictionKey:"in.order291.gst.27",country:"IN",priceDisplay:"tax_exclusive",rounding:"line",inputTotalMinor:10000n,baseTotalMinor:10000n,taxTotalMinor:500n,grandTotalMinor:10500n,taxes:[{code:"GST_ROOM",name:"GST",taxMinor:500n,components:[{lineId:"room",revenueGroup:"room_revenue",baseMinor:10000n,taxMinor:500n,rateBasisPoints:500}]}]},...overrides}); }
function row(overrides:Partial<Row>={}, snapshot=attribution()):Row { return {tenant_id:TENANT,id:RECEIPT,service_provision_snapshot_id:SERVICE,currency:"INR",amount_minor:"10500",coverage_scope:"full_attribution",supplier_books_entry_date:BOOKS,supplier_bank_credit_date:BANK,payment_receipt_date:EARLIER,payment_receipt_source:"governed_supplier_payment_receipt_record",payment_receipt_evidence_sha256:RE,legal_rule:LEGAL,service_tenant_id:TENANT,service_id:SERVICE,property_node:PROPERTY,reservation_lineage_id:LINE,hold_binding_id:HOLD,attribution_id:ATTR,reservation_id:RES,segment_id:SEG,origin_quote_hash:Q,snapshot_hash:snapshot.snapshotHash,service_currency:"INR",service_provision_date:"2043-06-17",service_provision_source:"governed_service_provision_record",service_provision_evidence_sha256:SE,service_legal_rule:"CGST_ACT_13_2_B_SERVICE_PROVISION_DATE_INPUT_ONLY",lineage_id:LINE,lineage_property_node:PROPERTY,lineage_hold_binding_id:HOLD,lineage_attribution_id:ATTR,lineage_reservation_id:RES,lineage_segment_id:SEG,lineage_origin_quote_hash:Q,lineage_snapshot_hash:snapshot.snapshotHash,lineage_currency:"INR",attribution_snapshot:snapshot,...overrides}; }
function input(overrides:Record<string,unknown>={}) { return {tenantId:TENANT,propertyNode:PROPERTY,reservationId:RES,serviceProvisionSnapshotId:SERVICE,paymentReceiptSnapshotId:RECEIPT,paymentReceiptDate:EARLIER,...overrides}; }
function tx(rows:readonly Row[], sql:string[]=[]):Tx { return (async(strings:TemplateStringsArray)=>{sql.push(strings.join("?"));return rows;}) as unknown as Tx; }
function deepFrozen(value:unknown,seen=new Set<object>()){if(typeof value!=="object"||value===null||seen.has(value))return;seen.add(value);expect(Object.isFrozen(value)).toBeTrue();for(const k of Reflect.ownKeys(value))deepFrozen((value as Mutable)[k],seen);}

describe("Order 291 exact payment receipt evidence",()=>{
 test("golden result is earlier statutory date, full amount/currency, frozen and replayable",async()=>{const service=new IndiaGstAccommodationPaymentReceiptDateService();const result=await service.resolve(tx([row()]),input());expect(result.paymentReceiptDate).toBe(EARLIER);expect(result.supplierBooksEntryDate).toBe(BOOKS);expect(result.supplierBankCreditDate).toBe(BANK);expect(result.amountMinor).toBe("10500");expect(result.currency).toBe("INR");expect(result).not.toHaveProperty("tenantId");deepFrozen(result);expect(await service.resolve(tx([row()]),input())).toEqual(result);});
 test("both source-date orderings and equality resolve only LEAST",async()=>{const service=new IndiaGstAccommodationPaymentReceiptDateService();for(const [books,bank,earlier] of [[BOOKS,BANK,BANK],[BANK,BOOKS,BANK],[BOOKS,BOOKS,BOOKS]] as const)expect((await service.resolve(tx([row({supplier_books_entry_date:books,supplier_bank_credit_date:bank,payment_receipt_date:earlier})]),input({paymentReceiptDate:earlier}))).paymentReceiptDate).toBe(earlier);});
 test("six-key input shape and all missing/proxy/accessor/symbol defects fail before SQL",async()=>{const exact=input(),bad:unknown[]=[null,[],new Proxy({...exact},{}),Object.assign(Object.create({inherited:true}),exact),{...exact,extra:true}];for(const k of Object.keys(exact)){const x={...exact} as Mutable;delete x[k];bad.push(x);}for(const k of ["tenantId","propertyNode","reservationId","serviceProvisionSnapshotId","paymentReceiptSnapshotId"])bad.push({...exact,[k]:"not-a-uuid"});const a={...exact} as Mutable;Object.defineProperty(a,"paymentReceiptDate",{enumerable:true,get:()=>EARLIER});bad.push(a);const s={...exact} as Mutable;s[Symbol("x")]=true;bad.push(s);for(const candidate of bad){let calls=0;const query=(async()=>{calls++;return[];}) as unknown as Tx;await expect(new IndiaGstAccommodationPaymentReceiptDateService().resolve(query,candidate as never)).rejects.toBeInstanceOf(IndiaGstAccommodationPaymentReceiptDateValidationError);expect(calls).toBe(0);}});
 test("missing duplicate mixed-lineage and evidence defects fail closed",async()=>{const service=new IndiaGstAccommodationPaymentReceiptDateService();await expect(service.resolve(tx([]),input())).rejects.toBeInstanceOf(IndiaGstAccommodationPaymentReceiptDateNotFoundError);await expect(service.resolve(tx([row(),row({id:OTHER_RECEIPT})]),input())).rejects.toBeInstanceOf(IndiaGstAccommodationPaymentReceiptDateConflictError);for(const d of [{tenant_id:OTHER},{service_tenant_id:OTHER},{property_node:id(29190)},{service_id:id(29191)},{reservation_id:id(29192)},{lineage_id:id(29193)},{currency:"CAD"},{service_currency:"CAD"},{amount_minor:"1"},{coverage_scope:"partial_attribution"},{supplier_books_entry_date:"2043-06-20",supplier_bank_credit_date:"2043-06-21"},{supplier_bank_credit_date:"2043-06-20"},{payment_receipt_date:"2043-06-20"},{payment_receipt_source:"payment.created_at"},{payment_receipt_evidence_sha256:"C".repeat(64)},{legal_rule:"CGST_ACT_13"},{attribution_snapshot:null}] as Partial<Row>[]){await expect(service.resolve(tx([row(d)]),input())).rejects.toBeInstanceOf(IndiaGstAccommodationPaymentReceiptDateConflictError);}});
 test("SQL is equality-only complete lineage and read-only",async()=>{const sql:string[]=[];await new IndiaGstAccommodationPaymentReceiptDateService().resolve(tx([row()],sql),input());expect(sql).toHaveLength(1);for(const term of ["india_gst_accommodation_payment_receipt_snapshot","india_gst_accommodation_service_provision_snapshot","tax_attribution_reservation_binding","tax_attribution_snapshot","receipt.tenant_id","receipt.id","receipt.service_provision_snapshot_id","receipt.payment_receipt_date","receipt.amount_minor","receipt.currency","receipt.supplier_books_entry_date","receipt.supplier_bank_credit_date","current_setting('app.tenant_id', true)"])expect(sql[0]).toContain(term);expect(sql[0]).not.toMatch(/ORDER BY|LIMIT|latest|nearest|current_date|now\s*\(/i);expect(sql[0]).not.toMatch(/\b(?:INSERT\s+INTO|UPDATE\s+public\.|DELETE\s+FROM|TRUNCATE|LOCK|FOR\s+(?:UPDATE|SHARE))\b/i);expect(sql[0]).not.toMatch(/payment\.created_at|payment_operation|provider_event_receipt|settlement|folio|journal|posting|document|check.?in|check.?out/i);});
 test("source has no writer/network/clock/downstream authority",async()=>{const source=await Bun.file(new URL("../src/contexts/tax-fiscal/india-gst-accommodation-payment-receipt-date.ts",import.meta.url)).text();expect(source).not.toMatch(/fetch\s*\(|https?:|Date\.now|new Date|current_date|now\s*\(/i);expect(source).not.toMatch(/\b(?:INSERT\s+INTO|UPDATE\s+public\.|DELETE\s+FROM|TRUNCATE|invoice|receipt.?voucher|section.?13|section.?14|refund|reversal|void|cash|partial|excess|payment\.created_at|provider_event)/i);expect(source).toContain(LEGAL);});
});

const live = process.env.YELLOW_ORDER291_DATABASE_URL && process.env.YELLOW_ORDER291_DEPLOY_DATABASE_URL
  ? describe.serial : describe.skip;
live("Order 291 live forced-RLS and ACL proof", () => {
  test("app_role sees zero rows and cannot mutate; PUBLIC/runtime have no grants", async () => {
    const { SQL } = await import("bun");
    const deploy = new SQL(process.env.YELLOW_ORDER291_DEPLOY_DATABASE_URL!, { max: 1 });
    const runtime = new SQL(process.env.YELLOW_ORDER291_DATABASE_URL!, { max: 1 });
    try {
      const relation = await deploy<Array<{
        rls: boolean; force: boolean; appSelect: boolean; appInsert: boolean;
        appUpdate: boolean; appDelete: boolean; appTruncate: boolean;
        publicPrivileges: number; runtimePrivileges: number; policies: number;
      }>>`SELECT c.relrowsecurity rls, c.relforcerowsecurity force,
          has_table_privilege('app_role',c.oid,'SELECT') "appSelect",
          has_table_privilege('app_role',c.oid,'INSERT') "appInsert",
          has_table_privilege('app_role',c.oid,'UPDATE') "appUpdate",
          has_table_privilege('app_role',c.oid,'DELETE') "appDelete",
          has_table_privilege('app_role',c.oid,'TRUNCATE') "appTruncate",
          (SELECT count(*)::int FROM aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE a.grantee=0) "publicPrivileges",
          (SELECT count(*)::int FROM aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE a.grantee=(SELECT oid FROM pg_roles WHERE rolname='yellow_runtime')) "runtimePrivileges",
          (SELECT count(*)::int FROM pg_policy p WHERE p.polrelid=c.oid) policies
        FROM pg_class c WHERE c.oid='public.india_gst_accommodation_payment_receipt_snapshot'::regclass`;
      expect(relation).toEqual([{ rls: true, force: true, appSelect: true, appInsert: false, appUpdate: false, appDelete: false, appTruncate: false, publicPrivileges: 0, runtimePrivileges: 0, policies: 1 }]);
      await runtime.begin(async (tx) => {
        await tx.unsafe("SET LOCAL ROLE app_role");
        await tx`SELECT set_config('app.tenant_id', ${"00000000-0000-0000-0000-000000000001"}, true)`;
        const rows = await tx<Array<{ count: number }>>`SELECT count(*)::int count FROM public.india_gst_accommodation_payment_receipt_snapshot`;
        expect(rows).toEqual([{ count: 0 }]);
      });
      for (const operation of ["INSERT", "UPDATE", "DELETE", "TRUNCATE"] as const) {
        let code: unknown;
        try {
          await runtime.begin(async (tx) => {
            await tx.unsafe("SET LOCAL ROLE app_role");
            await tx`SELECT set_config('app.tenant_id', ${"00000000-0000-0000-0000-000000000001"}, true)`;
            if (operation === "INSERT") await tx.unsafe("INSERT INTO public.india_gst_accommodation_payment_receipt_snapshot DEFAULT VALUES");
            if (operation === "UPDATE") await tx.unsafe("UPDATE public.india_gst_accommodation_payment_receipt_snapshot SET payment_receipt_date=payment_receipt_date WHERE false");
            if (operation === "DELETE") await tx.unsafe("DELETE FROM public.india_gst_accommodation_payment_receipt_snapshot WHERE false");
            if (operation === "TRUNCATE") await tx.unsafe("TRUNCATE public.india_gst_accommodation_payment_receipt_snapshot");
          });
        } catch (error) { code = (error as { errno?: unknown }).errno; }
        expect(code).toBe("42501");
      }
    } finally { await Promise.all([deploy.close(), runtime.close()]); }
  }, 30_000);
});
