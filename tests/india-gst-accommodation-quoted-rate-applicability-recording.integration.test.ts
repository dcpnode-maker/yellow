import { afterAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";
import {
  deriveIndiaGstAccommodationRateChangeDate,
  deriveIndiaGstSection14PaymentReceiptDate,
  deriveIndiaGstSection14WorkingDayCalendarEvidence,
  IndiaGstAccommodationQuotedRateApplicabilityRecorderService,
  IndiaGstAccommodationQuotedRateApplicabilityService,
  IndiaGstSection14RateSelectionService,
  resolveIndiaGstSection14PaymentProviso,
} from "../src/contexts/tax-fiscal";
import { PostgresIdempotency, type Tx } from "../src/kernel";
import {
  ATTRIBUTION,FOLIO,HOLD,LINEAGE,PROPERTY,RESERVATION,SEGMENT,SELLABLE,TENANT,fixture,
} from "./india-gst-accommodation-quoted-rate-applicability.test";

const migrationFile = Bun.file(new URL(
  "../migrations/0069_india_gst_accommodation_quoted_rate_applicability.sql",
  import.meta.url,
));
const recorderFile = Bun.file(new URL(
  "../src/contexts/tax-fiscal/india-gst-accommodation-quoted-rate-applicability-recorder.ts",
  import.meta.url,
));

const root = "india_gst_accommodation_quoted_rate_applicability";
const night = `${root}_room_night`;
const component = "india_gst_accommodation_quoted_rate_component";
const capability = "record_india_gst_accommodation_quoted_rate_applicability";
const tables = [root, night, component] as const;

describe("Order 400 persisted India quoted-rate applicability contract", () => {
  test("migration0069 owns exactly three typed insert-only evidence tables", async () => {
    const sql = await migrationFile.text();

    expect(sql.match(/CREATE TABLE public\.india_gst_accommodation_quoted_rate/g))
      .toHaveLength(3);
    for (const table of tables) {
      expect(sql).toContain(`CREATE TABLE public.${table}`);
      expect(sql).toContain(`ALTER TABLE public.${table} OWNER TO yellow_owner`);
    }
    expect(sql).toContain("quoted_amount_minor bigint NOT NULL");
    expect(sql).toContain("currency char(3) NOT NULL CHECK (currency='INR')");
    expect(sql).toContain("slab_upto_minor bigint");
    expect(sql).toContain("aggregate_rate_basis_points integer NOT NULL");
    expect(sql).toContain("rate_basis_points integer NOT NULL");
    expect(sql).not.toMatch(/(?:quoted_amount_minor|slab_upto_minor|rate_basis_points)\s+(?:json|jsonb|real|double precision|numeric)/i);
  });

  test("all statutory partitions, families, thresholds, rates and dense bounds are explicit", async () => {
    const sql = await migrationFile.text();

    for (const statutoryCase of [
      "supply_before_invoice_after_payment_after",
      "supply_invoice_before_payment_after",
      "supply_payment_before_invoice_after",
      "supply_after_invoice_before_payment_after",
      "supply_after_invoice_payment_before",
      "supply_invoice_after_payment_before",
    ]) expect(sql).toContain(`'${statutoryCase}'`);
    for (const family of ["igst", "cgst_sgst", "cgst_utgst"]) {
      expect(sql).toContain(`'${family}'`);
    }
    expect(sql).toContain("ordinal BETWEEN 0 AND 365");
    expect(sql).toContain("v_n>366");
    expect(sql).toContain("v_calendar_count>366");
    expect(sql).toContain("p_night_ordinals[v_i]<>v_i-1");
    expect(sql).toContain("p_calendar_dates[v_i]<>p_rate_change_date+v_i");
    expect(sql).toContain("p_night_amounts[v_i]<=750000");
    expect(sql).toContain("p_aggregate_bps[v_i]<>1800");
    expect(sql).toContain("v_expected_lower:=1200");
    expect(sql).toContain("v_expected_lower:=500");
    expect(sql).toContain("ARRAY['cgst','sgst']");
    expect(sql).toContain("ARRAY['cgst','utgst']");
  });

  test("calendar evidence is bounded, dense and classified without inventing authority", async () => {
    const sql = await migrationFile.text();

    expect(sql).toContain("p_calendar_authority text");
    expect(sql).toContain("p_calendar_source_hash text");
    expect(sql).toContain("p_calendar_dates date[]");
    expect(sql).toContain("p_calendar_states text[]");
    expect(sql).toContain("p_calendar_states[v_i] NOT IN ('working','non_working')");
    expect(sql).toContain("v_working<4");
    expect(sql).not.toContain("p_calendar_states[v_i]='working' AND v_working<4");
    expect(sql).toContain("ordinary receipt carries calendar evidence");
    expect(sql).not.toMatch(/extract\s*\(\s*(?:dow|isodow)|date_part\s*\(\s*'(?:dow|isodow)'/i);
  });

  test("the owner capability enforces tenant, runtime, actor, lineage and extension authority", async () => {
    const sql = await migrationFile.text();

    expect(sql).toContain(`CREATE FUNCTION public.${capability}(`);
    expect(sql).toContain("SECURITY DEFINER SET search_path=pg_catalog,public");
    expect(sql).toContain("session_user<>'yellow_runtime'");
    expect(sql).toContain("current_setting('role',true) IS DISTINCT FROM 'app_role'");
    expect(sql).toContain("current_user<>'yellow_owner'");
    expect(sql).toContain("current_setting('app.tenant_id',true)");
    expect(sql).toContain("permission_code='tax-fiscal.india-valuation:finalize'");
    expect(sql).toContain("grant_node.path @> property.path");
    expect(sql).toContain("exact quoted reservation lineage unavailable");
    expect(sql).toContain("selected extension identity is stale or forged");
    expect(sql).toContain("v_extension.content<>v_expected_content");
    expect(sql).toContain("p_selected_content_hash<>v_expected_content_hash");
    expect(sql).toContain("Section14 case does not derive from dates");
  });

  test("replay, divergence, races, gaps, duplicates and late failures fail closed", async () => {
    const sql = await migrationFile.text();

    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("WHERE tenant_id=p_tenant AND request_id=p_request");
    expect(sql).toContain("quoted applicability request has divergent evidence");
    expect(sql).toContain("UNIQUE (tenant_id,request_id)");
    expect(sql).toContain("UNIQUE (tenant_id,evidence_hash)");
    expect(sql).toContain("UNIQUE (tenant_id,reservation_id,folio_id)");
    expect(sql).toContain("PRIMARY KEY (tenant_id,applicability_id,ordinal)");
    expect(sql).toContain("UNIQUE (tenant_id,applicability_id,business_date)");
    expect(sql).toContain("PRIMARY KEY (tenant_id,applicability_id,room_night_ordinal,component_ordinal)");
    expect(sql).toContain("quoted applicability arrays are incomplete");
    expect(sql).toContain("ordered component-rate split is invalid");
    expect(sql).toContain("RETURN QUERY SELECT v_existing.id,v_existing.evidence_hash,false");
  });

  test("successful persistence emits only minimized evidence and no forbidden fiscal write", async () => {
    const sql = await migrationFile.text();

    expect(sql).toContain("'india_gst_accommodation_quoted_rate_applicability',v_id,'recorded'");
    expect(sql).toContain("'india_gst.accommodation_quoted_rate_applicability_recorded'");
    expect(sql).toContain("jsonb_build_object('applicabilityId',v_id,'evidenceHash',p_evidence_hash)");
    expect(sql).toContain("jsonb_build_object('applicabilityId',v_id,'reservationId',p_reservation,'folioId',p_folio,'evidenceHash',p_evidence_hash)");
    expect(sql).not.toMatch(/INSERT INTO public\.(?:journal|posting_line|document|fiscal_submission|space_occupancy)\b/i);
    expect(sql).not.toMatch(/(?:UPDATE|DELETE FROM) public\.(?:journal|posting_line|document|fiscal_submission|space_occupancy|fact_log|outbox)\b/i);
  });

  test("recorder reruns Order341, uses typed arrays and service-owned idempotency", async () => {
    const source = await recorderFile.text();

    expect(source).toContain("new IndiaGstAccommodationQuotedRateApplicabilityService().resolve(tx, predecessor)");
    expect(source).toContain('operation: "tax-fiscal.india-quoted-rate-applicability.record"');
    expect(source).toContain(`public.${capability}(`);
    expect(source).toContain("::bigint[]");
    expect(source).toContain("::integer[]");
    expect(source).toContain("::smallint[]");
    expect(source).toContain("::date[]");
    expect(source).toContain("::boolean[]");
    expect(source).not.toMatch(/taxMinor|grandTotalMinor|taxableValueMinor|rounding/i);
    expect(source).not.toMatch(/(?:INSERT|UPDATE|DELETE|MERGE)\s+/i);
  });

  test("recorder serializes all six Section14 cases and all three component families exactly", async () => {
    const statutoryCases = [
      ["2025-09-21", "2025-09-23", "2025-09-24", "2025-09-24", "supply_before_invoice_after_payment_after", "successor", 500],
      ["2025-09-21", "2025-09-21", "2025-09-23", "2025-09-23", "supply_payment_before_invoice_after", "predecessor", 1200],
      ["2025-09-21", "2025-09-23", "2025-09-24", "2025-09-21", "supply_invoice_before_payment_after", "predecessor", 1200],
      ["2025-09-23", "2025-09-23", "2025-09-24", "2025-09-21", "supply_after_invoice_before_payment_after", "successor", 500],
      ["2025-09-23", "2025-09-20", "2025-09-21", "2025-09-21", "supply_after_invoice_payment_before", "predecessor", 1200],
      ["2025-09-23", "2025-09-20", "2025-09-21", "2025-09-23", "supply_invoice_after_payment_before", "successor", 500],
    ] as const;
    const families = ["igst", "cgst_sgst", "cgst_utgst"] as const;
    const deepFreeze = <T>(value:T, seen=new Set<object>()):T => {
      if (value && typeof value === "object" && !seen.has(value as object)) {
        seen.add(value as object);
        for (const key of Reflect.ownKeys(value as object)) deepFreeze(Reflect.get(value as object,key),seen);
        Object.freeze(value);
      }
      return value;
    };
    const id = (n:number) => `00000000-0000-0000-0000-${String(n).padStart(12,"0")}`;

    for (const [serviceDate,booksDate,bankDate,invoiceDate,expectedCase,side,lowerRate] of statutoryCases) {
      for (const family of families) {
        const built = await fixture(family,serviceDate,booksDate,bankDate,invoiceDate);
        let capabilityArguments:unknown[]=[];
        const query = (async (strings:TemplateStringsArray,...values:unknown[]) => {
          const sql=strings.join("?");
          if (sql.includes(`public.${capability}`)) {
            capabilityArguments=values;
            return [{applicability_id:id(40001),evidence_hash:values[35],created:true}];
          }
          if (sql.includes("tax_attribution_hold_binding")) return [built.rows.persisted];
          if (sql.includes("payment_receipt_snapshot")) return [built.rows.payment];
          if (sql.includes("invoice_issue_snapshot")) return [built.rows.invoice];
          if (sql.includes("service_provision_snapshot")) return [built.rows.service];
          throw new Error(`unexpected Order400 SQL: ${sql}`);
        }) as unknown as Tx;
        const idempotency = {
          async execute(_tx:Tx,scope:Record<string,unknown>,work:(tx:Tx)=>Promise<{status:number;body:Record<string,unknown>}>) {
            expect(scope).toMatchObject({operation:"tax-fiscal.india-quoted-rate-applicability.record"});
            const result=await work(query);
            return {...result,replayed:false};
          },
        } as unknown as PostgresIdempotency;
        const input=deepFreeze({
          tenantId:built.input.tenantId,propertyNode:built.input.propertyNode,
          reservationId:built.input.reservationId,folioId:built.input.folioId,
          quotedRateApplicabilityInput:built.input,
          idempotencyKey:`order400-${expectedCase}-${family}`,
          envelope:{tenantId:built.input.tenantId,propertyNode:built.input.propertyNode,
            actorId:id(40002),requestId:id(40003),
            operation:"india_gst.accommodation_quoted_rate_applicability_recorded"},
        });
        const result=await new IndiaGstAccommodationQuotedRateApplicabilityRecorderService({idempotency})
          .record(query,input as never);
        expect(result).toMatchObject({applicabilityId:id(40001),created:true,replayed:false});
        expect(capabilityArguments).toHaveLength(51);
        expect(capabilityArguments[17]).toBe(expectedCase);
        expect(capabilityArguments[23]).toBe(side);
        expect(capabilityArguments[30]).toBe(family);
        expect(capabilityArguments[41]).toBe('{"0","1"}');
        expect(capabilityArguments[43]).toBe('{"700000","800000"}');
        expect(capabilityArguments[44]).toBe('{"750000",NULL}');
        expect(capabilityArguments[45]).toBe(`{"${lowerRate}","1800"}`);
        expect(capabilityArguments[47]).toBe(family==='igst'?'{"0","1"}':'{"0","0","1","1"}');
        expect(capabilityArguments[48]).toBe(family==='igst'?'{"0","0"}':'{"0","1","0","1"}');
        expect(capabilityArguments[49]).toEqual(
          family==='igst'?'{"igst","igst"}':
            family==='cgst_sgst'?'{"cgst","sgst","cgst","sgst"}':
              '{"cgst","utgst","cgst","utgst"}',
        );
      }
    }
  },30_000);
});

const databaseUrl = process.env.YELLOW_ORDER400_DATABASE_URL;
const runtimeDatabaseUrl = process.env.YELLOW_ORDER400_RUNTIME_DATABASE_URL;
const databaseDescribe = databaseUrl && runtimeDatabaseUrl ? describe : describe.skip;

databaseDescribe("Order 400 fresh PostgreSQL catalogue and authority", () => {
  const db = new SQL(databaseUrl!, { max: 4, prepare: false });
  const runtimeDb = new SQL(runtimeDatabaseUrl!, { max: 2, prepare: false });
  afterAll(async () => { await runtimeDb.close(); await db.close(); });

  test("fresh catalogue is exactly 75/125/115/115/24/2", async () => {
    const rows = await db<Array<{ migrations:number; tables:number; rls:number; policies:number; forced:number; views:number }>>`
      SELECT
        (SELECT count(*)::int FROM schema_migration) migrations,
        (SELECT count(*)::int FROM pg_tables WHERE schemaname='public') tables,
        (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
          WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity) rls,
        (SELECT count(*)::int FROM pg_policies WHERE schemaname='public') policies,
        (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
          WHERE n.nspname='public' AND c.relkind='r' AND c.relforcerowsecurity) forced,
        (SELECT count(*)::int FROM pg_views WHERE schemaname='public') views
    `;
    expect(rows).toEqual([{ migrations:75, tables:125, rls:115, policies:115, forced:24, views:2 }]);
  });

  test("all three tables are forced-RLS, tenant-leading and app-role SELECT-only", async () => {
    const rows = await db<Array<{ relname:string; rls:boolean; forced:boolean; select_privilege:boolean; insert_privilege:boolean; update_privilege:boolean; delete_privilege:boolean }>>`
      SELECT c.relname,c.relrowsecurity rls,c.relforcerowsecurity forced,
        has_table_privilege('app_role',c.oid,'SELECT') select_privilege,
        has_table_privilege('app_role',c.oid,'INSERT') insert_privilege,
        has_table_privilege('app_role',c.oid,'UPDATE') update_privilege,
        has_table_privilege('app_role',c.oid,'DELETE') delete_privilege
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname IN (${root},${night},${component}) ORDER BY c.relname
    `;
    expect(rows).toHaveLength(3);
    for (const row of rows) expect(row).toMatchObject({
      rls:true,forced:true,select_privilege:true,
      insert_privilege:false,update_privilege:false,delete_privilege:false,
    });
    const indexes = await db<Array<{ table_name:string; first_column:string }>>`
      SELECT t.relname table_name,a.attname first_column
      FROM pg_index i JOIN pg_class t ON t.oid=i.indrelid
      JOIN pg_namespace n ON n.oid=t.relnamespace
      JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=i.indkey[0]
      WHERE n.nspname='public' AND t.relname IN (${root},${night},${component})
    `;
    expect(new Set(indexes.map(({table_name})=>table_name))).toEqual(new Set(tables));
    expect(indexes.every(({first_column})=>first_column==='tenant_id')).toBeTrue();
  });

  test("sole 51-argument capability is owner-mediated with a fixed path", async () => {
    const rows = await db<Array<{ owner:string; definer:boolean; config:string[]; arguments:number; app:boolean; runtime:boolean; everyone:boolean }>>`
      SELECT pg_get_userbyid(p.proowner) owner,p.prosecdef definer,p.proconfig config,p.pronargs::int arguments,
        has_function_privilege('app_role',p.oid,'EXECUTE') app,
        has_function_privilege('yellow_runtime',p.oid,'EXECUTE') runtime,
        has_function_privilege('public',p.oid,'EXECUTE') everyone
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname=${capability}
    `;
    expect(rows).toEqual([{
      owner:'yellow_owner',definer:true,config:['search_path=pg_catalog, public'],arguments:51,
      app:true,runtime:false,everyone:false,
    }]);
  });

  test("real runtime records one atomic immutable bundle, replays write-free and rolls back cleanly", async () => {
    const built=await fixture("cgst_sgst","2025-09-21","2025-09-21","2025-09-23","2025-09-23");
    const canonicalContentHash="2160e1747afcb3c280f1fd66e55534a5be563a10f277e8fcc178324e51abaa08";
    const successorContentHash="eb323eff707aad1e460b425c87b448d4e924d2eb17499094abad71b33c69a820";
    const canonicalJson=(value:unknown):string => {
      if (value===null || typeof value!=="object") return JSON.stringify(Object.is(value,-0)?0:value);
      if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
      const record=value as Record<string,unknown>;
      return `{${Object.keys(record).sort().map((key)=>`${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
    };
    const canonicalHash=(value:unknown)=>new Bun.CryptoHasher("sha256").update(canonicalJson(value)).digest("hex");
    const predecessorContent={country:"IN",price_display:"tax_exclusive",rounding:"document",taxes:[
      {code:"GST_ROOM",name:"GST on accommodation",mode:"slab_percent",slab_basis:"transaction_value",applies_to:["room_revenue"],slabs:[{upto_minor:750000,rate:0.12,itc_eligible:true},{upto_minor:null,rate:0.18,itc_eligible:true}]},
      {code:"GST_FNB",name:"GST on F&B (restaurant in hotel)",mode:"percent",rate:0.05,applies_to:["fnb_revenue"]},
    ]};
    const successorContent={country:"IN",price_display:"tax_exclusive",rounding:"document",taxes:[
      {code:"GST_ROOM",name:"GST on accommodation",mode:"slab_percent",slab_basis:"transaction_value",applies_to:["room_revenue"],slabs:[{upto_minor:750000,rate:0.05,itc_eligible:false},{upto_minor:null,rate:0.18,itc_eligible:true}]},
      {code:"GST_FNB",name:"GST on F&B (restaurant in hotel)",mode:"percent",rate:0.05,applies_to:["fnb_revenue"]},
    ]};
    const pairBody={
      propertyNode:PROPERTY,
      predecessor:{extensionId:"a806f516-fed6-5768-b310-94aa03286adb",key:"in-gst-lodging",version:1,status:"retired",effectiveFromInstant:"2022-07-17T18:30:00.000000Z",effectiveToInstant:"2025-09-21T18:30:00.000000Z",content:predecessorContent,contentHash:canonicalContentHash,gstRoomSlabs:[{uptoMinor:750000,rate:0.12,itcEligible:true},{uptoMinor:null,rate:0.18,itcEligible:true}]},
      successor:{extensionId:"0b21daf2-ea6e-5568-9c21-69e4d4424574",key:"in-gst-lodging",version:2,status:"active",effectiveFromInstant:"2025-09-21T18:30:00.000000Z",effectiveToInstant:null,content:successorContent,contentHash:successorContentHash,gstRoomSlabs:[{uptoMinor:750000,rate:0.05,itcEligible:false},{uptoMinor:null,rate:0.18,itcEligible:true}]},
      cutoverInstant:"2025-09-21T18:30:00.000000Z",
      statutoryLowerBandDelta:{thresholdMinor:750000,predecessorRate:0.12,predecessorItcEligible:true,successorRate:0.05,successorItcEligible:false,predecessorHasNilBand:false,successorHasNilBand:false},
      sourceHashes:{notification20_2019:"ee920c82c30ed88d9bb515d7d79b975cc2ed599c6dad411d04d8b7fcd5a86901",notification04_2022:"c6d264f1906375e93466dd97b2c60bb9b21c0dec34b93900b15237b4a98b7716",notification15_2025:"46c9447579017d8bf1fefd75b6e6a48856dab7b23e44c7e06babfdc99ae9d289"},
    } as const;
    const rateVersionPair={...pairBody,evidenceHash:canonicalHash({tenantId:TENANT,predecessorOwnerTenantId:null,successorOwnerTenantId:null,...pairBody})};
    const resolverQuery=(async (strings:TemplateStringsArray) => {
      const sql=strings.join("?");
      if (sql.includes("tax_attribution_hold_binding")) return [built.rows.persisted];
      if (sql.includes("payment_receipt_snapshot")) return [built.rows.payment];
      if (sql.includes("invoice_issue_snapshot")) return [built.rows.invoice];
      if (sql.includes("service_provision_snapshot")) return [built.rows.service];
      throw new Error(`unexpected canonical Order400 resolver SQL: ${sql}`);
    }) as unknown as Tx;
    const partialResolved=structuredClone(
      await new IndiaGstAccommodationQuotedRateApplicabilityService().resolve(resolverQuery,built.input),
    );
    const deepFreeze=<T>(value:T,seen=new Set<object>()):T=>{if(value&&typeof value==="object"&&!seen.has(value as object)){seen.add(value as object);for(const key of Reflect.ownKeys(value as object))deepFreeze(Reflect.get(value as object,key),seen);Object.freeze(value);}return value;};
    const canonicalInput=structuredClone(built.input) as any;
    canonicalInput.section14Input.rateVersionPair=rateVersionPair;
    canonicalInput.section14Input.rateChangeDateEvidence=deriveIndiaGstAccommodationRateChangeDate({tenantId:TENANT,rateVersionPair} as never);
    const calendarInput=canonicalInput.section14Input.paymentEvidence;
    if (calendarInput.kind!=="calendar_governed_receipt") throw new Error("Order403 requires calendar-governed fixture truth");
    const boundedCalendarDates=Array.from({length:366},(_,offset)=>new Date(Date.UTC(2025,8,23+offset)).toISOString().slice(0,10));
    calendarInput.throughDate=boundedCalendarDates.at(-1)!;
    calendarInput.calendarEvidence.days=boundedCalendarDates.map((date)=>({date,state:"working" as const}));
    const paymentProvisoEvidence=resolveIndiaGstSection14PaymentProviso({supplierBooksEntryDate:built.rows.payment.supplier_books_entry_date,supplierBankCreditDate:built.rows.payment.supplier_bank_credit_date,rateChangeDate:canonicalInput.section14Input.rateChangeDateEvidence.rateChangeDate});
    deepFreeze(calendarInput.calendarEvidence);
    const workingDayEvidence=deriveIndiaGstSection14WorkingDayCalendarEvidence({tenantId:TENANT,rateChangeDate:canonicalInput.section14Input.rateChangeDateEvidence.rateChangeDate,throughDate:calendarInput.throughDate,calendarEvidence:calendarInput.calendarEvidence} as never);
    canonicalInput.section14Input.paymentEvidence={kind:"calendar_governed_receipt",paymentProvisoEvidence,throughDate:calendarInput.throughDate,calendarEvidence:calendarInput.calendarEvidence,workingDayEvidence,paymentReceiptEvidence:deriveIndiaGstSection14PaymentReceiptDate({tenantId:TENANT,rateVersionPair,rateChangeDateEvidence:canonicalInput.section14Input.rateChangeDateEvidence,supplierBooksEntryDate:built.rows.payment.supplier_books_entry_date,supplierBankCreditDate:built.rows.payment.supplier_bank_credit_date,paymentProvisoEvidence,throughDate:calendarInput.throughDate,calendarEvidence:calendarInput.calendarEvidence,workingDayEvidence} as never)};
    canonicalInput.section14Input=deepFreeze(canonicalInput.section14Input);
    canonicalInput.section14Result=await new IndiaGstSection14RateSelectionService().resolve(resolverQuery,canonicalInput.section14Input);
    const canonicalSection14={case:canonicalInput.section14Result.case,timeOfSupplyDate:canonicalInput.section14Result.timeOfSupplyDate,selectedVersionSide:canonicalInput.section14Result.selectedVersionSide,selectedVersion:canonicalInput.section14Result.selectedVersion};
    const canonicalResolved={...partialResolved,section14:canonicalSection14,predecessorHashes:{...partialResolved.predecessorHashes,section14:canonicalInput.section14Result.evidenceHash}};
    const {evidenceHash:ignoredEvidenceHash,...canonicalBody}=canonicalResolved;
    void ignoredEvidenceHash;
    (canonicalResolved as {evidenceHash:string}).evidenceHash=new Bun.CryptoHasher("sha256").update(JSON.stringify({
      tenantId:TENANT,propertyNode:PROPERTY,reservationId:RESERVATION,folioId:FOLIO,...canonicalBody,
    })).digest("hex");
    const selectors=built.input.componentIdentityInput.supplyNature;
    const jurisdiction=selectors.jurisdiction;
    const classification=selectors.classification;
    const supplier=selectors.supplier;
    const recipient=selectors.recipient;
    const propertyLocation=selectors.placeOfSupply;
    const actor="00000000-0000-0000-0000-000000040010";
    const alternateActor="00000000-0000-0000-0000-000000040011";
    const buyer=recipient.partyId;
    const account="00000000-0000-0000-0000-000000040012";
    const unitType="00000000-0000-0000-0000-000000040013";
    const ratePlan="00000000-0000-0000-0000-000000040014";
    const role="00000000-0000-0000-0000-000000040015";
    const request="00000000-0000-0000-0000-000000040016";
    const connection=await db.reserve();
    try {
      await connection.unsafe("BEGIN");
      await connection`SELECT set_config('app.tenant_id',${TENANT},true)`;
      await connection.unsafe("SET ROLE yellow_owner");
      await connection`INSERT INTO tenant(id,slug,name) VALUES(${TENANT}::uuid,'order400','Order400')`;
      await connection`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES(${PROPERTY}::uuid,${TENANT}::uuid,'order400'::ltree,'property','Order400','Asia/Kolkata','INR')`;
      await connection`INSERT INTO app_user(id,tenant_id,email,display_name,status) VALUES(${actor}::uuid,${TENANT}::uuid,'order400@example.test','Order400','active')`;
      await connection`INSERT INTO app_user(id,tenant_id,email,display_name,status) VALUES(${alternateActor}::uuid,${TENANT}::uuid,'order402-alternate@example.test','Order402 alternate','active')`;
      await connection`INSERT INTO permission(code,description) VALUES('tax-fiscal.india-valuation:finalize','Finalize governed India accommodation valuation') ON CONFLICT DO NOTHING`;
      await connection`INSERT INTO role(id,tenant_id,name) VALUES(${role}::uuid,${TENANT}::uuid,'Order400 finalizer')`;
      await connection`INSERT INTO role_permission(role_id,permission_code) VALUES(${role}::uuid,'tax-fiscal.india-valuation:finalize')`;
      await connection`INSERT INTO user_role(tenant_id,user_id,role_id,scope_node) VALUES(${TENANT}::uuid,${actor}::uuid,${role}::uuid,${PROPERTY}::uuid)`;
      await connection`INSERT INTO user_role(tenant_id,user_id,role_id,scope_node) VALUES(${TENANT}::uuid,${alternateActor}::uuid,${role}::uuid,${PROPERTY}::uuid)`;
      await connection`INSERT INTO party(id,tenant_id,kind,display_name,status) VALUES(${buyer}::uuid,${TENANT}::uuid,'person','Buyer','active')`;
      await connection`INSERT INTO extension_type(type,json_schema) VALUES('tax_jurisdiction','{"type":"object"}'::jsonb)`;
      await connection`INSERT INTO extension(id,tenant_id,type,key,version,effective,content,status) VALUES
        ('a806f516-fed6-5768-b310-94aa03286adb',NULL,'tax_jurisdiction','in-gst-lodging',1,tstzrange('2022-07-17T18:30:00Z','2025-09-21T18:30:00Z','[)'),${JSON.stringify(predecessorContent)}::jsonb,'retired'),
        ('0b21daf2-ea6e-5568-9c21-69e4d4424574',NULL,'tax_jurisdiction','in-gst-lodging',2,tstzrange('2025-09-21T18:30:00Z',NULL,'[)'),${JSON.stringify(successorContent)}::jsonb,'active')`;
      await connection`INSERT INTO property_fiscal_registration(tenant_id,id,property_node,scheme,currency,jurisdiction_extension_id,jurisdiction_owner_tenant_id,jurisdiction_key,jurisdiction_version,jurisdiction_content_hash,registration_number,region_code,legal_name,address_line,locality,postal_code) VALUES(${TENANT}::uuid,${supplier.registrationId}::uuid,${PROPERTY}::uuid,'in-gstin','INR',${jurisdiction.extensionId}::uuid,NULL,${jurisdiction.key},${jurisdiction.version}::integer,${canonicalContentHash},'27ABCDE1234F1Z5',${supplier.stateCode},'Order400 Supplier','1 Marine Drive','Mumbai','400001')`;
      await connection`INSERT INTO party_fiscal_registration(tenant_id,id,party_id,scheme,registration_number,region_code,legal_name,address_line1,locality,pin) VALUES(${TENANT}::uuid,${recipient.registrationId}::uuid,${buyer}::uuid,'in-gstin','27ABCDE1234F1Z5','27','Order400 Buyer','1 Buyer Road','Mumbai','400001')`;
      await connection`INSERT INTO property_fiscal_location(tenant_id,property_node,country_code,state_code,address_line1,locality,pin) VALUES(${TENANT}::uuid,${PROPERTY}::uuid,'IN',${propertyLocation.pos},'1 Marine Drive','Mumbai','400001')`;
      await connection`INSERT INTO india_gst_item_classification(tenant_id,id,property_node,jurisdiction_extension_id,jurisdiction_owner_tenant_id,jurisdiction_key,jurisdiction_version,jurisdiction_content_hash,country_code,line_id,revenue_group,classification_system,classification_code,is_service_code) VALUES(${TENANT}::uuid,${classification.classificationId}::uuid,${PROPERTY}::uuid,${jurisdiction.extensionId}::uuid,NULL,${jurisdiction.key},${jurisdiction.version}::integer,${canonicalContentHash},'IN','room','room_revenue','SAC','996311','Y')`;
      await connection`INSERT INTO india_gst_supplier_service_location(tenant_id,id,supplier_registration_id,supplier_evidence_hash,service_scope,registered_place_kind,location_basis,legal_rule) VALUES(${TENANT}::uuid,${supplier.serviceLocation.id}::uuid,${supplier.registrationId}::uuid,${supplier.evidenceHash},'lodging_accommodation',${supplier.serviceLocation.kind},'supply_made_from_registered_place_of_business','IGST_ACT_2_15_A')`;
      await connection`INSERT INTO india_gst_supplier_sez_status(tenant_id,id,supplier_registration_id,supplier_registration_evidence_hash,status_as_of,gst_registration_status,gst_taxpayer_type,gst_status_source,gst_status_evidence_sha256,legal_rule) VALUES(${TENANT}::uuid,${supplier.status.id}::uuid,${supplier.registrationId}::uuid,${supplier.evidenceHash},${supplier.status.statusAsOf}::date,'active',${supplier.status.taxpayerType},'gst_common_portal',${"5".repeat(64)},'IGST_ACT_7_5_B_AND_8_2_SUPPLIER_STATUS')`;
      await connection`INSERT INTO india_gst_recipient_sez_status(tenant_id,id,recipient_registration_id,recipient_registration_evidence_hash,status_as_of,gst_registration_status,gst_taxpayer_type,gst_status_source,gst_status_evidence_sha256,legal_rule) VALUES(${TENANT}::uuid,${recipient.status.id}::uuid,${recipient.registrationId}::uuid,${recipient.evidenceHash},${recipient.status.statusAsOf}::date,'active',${recipient.status.taxpayerType},'gst_common_portal',${"4".repeat(64)},'IGST_ACT_7_5_B_AND_8_2_RECIPIENT_STATUS')`;
      await connection`INSERT INTO unit_type(id,tenant_id,property_node,code,name,profile_key,max_occupancy) VALUES(${unitType}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'O400','Room','hotel',2)`;
      await connection`INSERT INTO sellable_unit(id,tenant_id,unit_type_id,name,status) VALUES(${SELLABLE}::uuid,${TENANT}::uuid,${unitType}::uuid,'Room 1','active')`;
      await connection`INSERT INTO rate_plan(id,tenant_id,property_node,code,name,currency,tax_inclusive,status) VALUES(${ratePlan}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'O400','Rate','INR',false,'active')`;
      await connection`INSERT INTO reservation(id,tenant_id,property_node,confirmation_no,status,primary_party,currency) VALUES(${RESERVATION}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'O400','reserved',${buyer}::uuid,'INR')`;
      await connection`INSERT INTO reservation_segment(id,tenant_id,reservation_id,seq,unit_type_id,sellable_unit_id,period,adults,children,rate_plan_id,status) VALUES(${SEGMENT}::uuid,${TENANT}::uuid,${RESERVATION}::uuid,1,${unitType}::uuid,${SELLABLE}::uuid,${built.rows.persisted.segment_period}::tstzrange,1,'[]'::jsonb,${ratePlan}::uuid,'booked')`;
      await connection`INSERT INTO hold(id,tenant_id,property_node,sellable_unit_id,period,kind,holder,expires_at,status) VALUES(${HOLD}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,${SELLABLE}::uuid,${built.rows.persisted.hold_period}::tstzrange,'cart','{}'::jsonb,'2030-01-01','consumed')`;
      await connection`INSERT INTO account(id,tenant_id,property_node,role,party_id,name,currency,status) VALUES(${account}::uuid,${TENANT}::uuid,${PROPERTY}::uuid,'guest',${buyer}::uuid,'Guest','INR','open')`;
      await connection`INSERT INTO folio(id,tenant_id,account_id,reservation_id,window_no,status) VALUES(${FOLIO}::uuid,${TENANT}::uuid,${account}::uuid,${RESERVATION}::uuid,1,'open')`;
      await connection`INSERT INTO tax_attribution_snapshot(tenant_id,id,property_node,actor_id,schema_version,origin_kind,origin_quote_hash,snapshot_hash,currency,snapshot) VALUES(${TENANT}::uuid,${ATTRIBUTION}::uuid,${PROPERTY}::uuid,${actor}::uuid,1,'rate_quote',${built.rows.persisted.origin_quote_hash},${built.rows.persisted.snapshot_hash},'INR',${JSON.stringify(built.rows.attribution)}::jsonb)`;
      await connection`INSERT INTO india_gst_accommodation_final_valuation(tenant_id,id,property_node,reservation_id,folio_id,folio_account_id,window_no,buyer_party_id,attribution_id,request_id,generation,disposition,currency,transaction_value_minor,source_set_hash,order341_evidence_hash,request_hash,evidence_hash,ordinary_evidence_hashes,manual_reasons,relationship_conclusion,consideration_conclusion,section15_2_conclusion,section15_3_conclusion,source_completeness_conclusion,attestation_evidence_source,attestation_evidence_reference,relationship_set_hash,attested_by,actor_id) VALUES(${TENANT}::uuid,'00000000-0000-0000-0000-000000040017'::uuid,${PROPERTY}::uuid,${RESERVATION}::uuid,${FOLIO}::uuid,${account}::uuid,1,${buyer}::uuid,${ATTRIBUTION}::uuid,'00000000-0000-0000-0000-000000040018'::uuid,0,'ordinary_final','INR',1500000,${"1".repeat(64)},${canonicalResolved.evidenceHash},${"2".repeat(64)},${"3".repeat(64)},ARRAY[${"4".repeat(64)},${"5".repeat(64)},${"6".repeat(64)},${"7".repeat(64)},${"8".repeat(64)}],ARRAY[]::text[],'unrelated_not_distinct','money_only','all_additions_enumerated','all_discounts_eligible','all_sources_classified','operator_attestation','ORDER400',${"9".repeat(64)},${actor}::uuid,${actor}::uuid)`;
      await connection`INSERT INTO tax_attribution_hold_binding(tenant_id,id,property_node,bound_by,hold_id,attribution_id,sellable_unit_id,period,origin_quote_hash,snapshot_hash,currency) VALUES(${TENANT}::uuid,${HOLD}::uuid,${PROPERTY}::uuid,${actor}::uuid,${HOLD}::uuid,${ATTRIBUTION}::uuid,${SELLABLE}::uuid,${built.rows.persisted.binding_period}::tstzrange,${built.rows.persisted.origin_quote_hash},${built.rows.persisted.snapshot_hash},'INR')`;
      await connection`INSERT INTO tax_attribution_reservation_binding(tenant_id,id,property_node,linked_by,binding_id,hold_id,attribution_id,reservation_id,segment_id,sellable_unit_id,period,origin_quote_hash,snapshot_hash,currency) VALUES(${TENANT}::uuid,${LINEAGE}::uuid,${PROPERTY}::uuid,${actor}::uuid,${HOLD}::uuid,${HOLD}::uuid,${ATTRIBUTION}::uuid,${RESERVATION}::uuid,${SEGMENT}::uuid,${SELLABLE}::uuid,${built.rows.persisted.lineage_period}::tstzrange,${built.rows.persisted.origin_quote_hash},${built.rows.persisted.snapshot_hash},'INR')`;
      const serviceRow=built.rows.service,paymentRow=built.rows.payment,invoiceRow=built.rows.invoice;
      await connection`INSERT INTO india_gst_accommodation_service_provision_snapshot(tenant_id,id,property_node,reservation_lineage_id,hold_binding_id,attribution_id,reservation_id,segment_id,origin_quote_hash,snapshot_hash,currency,service_provision_date,service_provision_source,service_provision_evidence_sha256,legal_rule) VALUES(${TENANT}::uuid,${serviceRow.id}::uuid,${PROPERTY}::uuid,${LINEAGE}::uuid,${HOLD}::uuid,${ATTRIBUTION}::uuid,${RESERVATION}::uuid,${SEGMENT}::uuid,${serviceRow.origin_quote_hash},${serviceRow.snapshot_hash},'INR',${serviceRow.service_provision_date}::date,${serviceRow.service_provision_source},${serviceRow.service_provision_evidence_sha256},${serviceRow.legal_rule})`;
      await connection`INSERT INTO india_gst_accommodation_payment_receipt_snapshot(tenant_id,id,service_provision_snapshot_id,currency,amount_minor,coverage_scope,supplier_books_entry_date,supplier_bank_credit_date,payment_receipt_date,payment_receipt_source,payment_receipt_evidence_sha256,legal_rule) VALUES(${TENANT}::uuid,${paymentRow.id}::uuid,${serviceRow.id}::uuid,'INR',${paymentRow.amount_minor},${paymentRow.coverage_scope},${paymentRow.supplier_books_entry_date}::date,${paymentRow.supplier_bank_credit_date}::date,${paymentRow.payment_receipt_date}::date,${paymentRow.payment_receipt_source},${paymentRow.payment_receipt_evidence_sha256},${paymentRow.legal_rule})`;
      await connection`INSERT INTO india_gst_accommodation_invoice_issue_snapshot(tenant_id,id,service_provision_snapshot_id,currency,amount_minor,coverage_scope,invoice_series,invoice_serial,invoice_issue_date,invoice_issue_source,invoice_issue_evidence_sha256,legal_rule) VALUES(${TENANT}::uuid,${invoiceRow.id}::uuid,${serviceRow.id}::uuid,'INR',${invoiceRow.amount_minor},${invoiceRow.coverage_scope},${invoiceRow.invoice_series},${invoiceRow.invoice_serial},${invoiceRow.invoice_issue_date}::date,${invoiceRow.invoice_issue_source},${invoiceRow.invoice_issue_evidence_sha256},${invoiceRow.legal_rule})`;
      await connection.unsafe("RESET ROLE");
      await connection.unsafe("COMMIT");
      const runtimeConnection=await runtimeDb.reserve();
      try {
      await runtimeConnection.unsafe("BEGIN");
      await runtimeConnection`SELECT set_config('app.tenant_id',${TENANT},true)`;
      await runtimeConnection.unsafe("SET LOCAL ROLE app_role");
      const input=deepFreeze({tenantId:TENANT,propertyNode:PROPERTY,reservationId:RESERVATION,folioId:FOLIO,
        quotedRateApplicabilityInput:deepFreeze(canonicalInput),idempotencyKey:"order400-real-replay",
        envelope:{tenantId:TENANT,propertyNode:PROPERTY,actorId:actor,requestId:request,
          operation:"india_gst.accommodation_quoted_rate_applicability_recorded"}});
      const paymentEvidence=canonicalInput.section14Input.paymentEvidence;
      if (paymentEvidence.kind!=="calendar_governed_receipt") throw new Error("Order402 requires calendar-governed fixture truth");
      const postgresArray=(values:readonly (string|number|bigint|boolean|null)[])=>`{${values.map((value)=>value===null
        ? "NULL"
        : `"${String(value).replaceAll("\\","\\\\").replaceAll('"','\\"')}"`).join(",")}}`;
      const selected=canonicalResolved.section14.selectedVersion;
      const baseCapability={
        tenant:TENANT,property:PROPERTY,reservation:RESERVATION,folio:FOLIO,
        lineage:built.input.reservationLineageId,attribution:built.input.attributionId,
        request:"00000000-0000-0000-0000-000000040020",actor,
        serviceSnapshot:built.input.section14Input.serviceProvisionResult.serviceProvisionSnapshotId,
        paymentSnapshot:built.input.section14Input.paymentReceiptResult.paymentReceiptSnapshotId,
        invoiceSnapshot:built.input.section14Input.invoiceIssueResult.invoiceIssueSnapshotId,
        familyJurisdiction:built.input.componentIdentityInput.supplyNature.jurisdiction.extensionId,
        classification:built.input.componentIdentityInput.supplyNature.classification.classificationId,
        supplierServiceLocation:built.input.componentIdentityInput.supplyNature.supplier.serviceLocation.id,
        supplierSezStatus:built.input.componentIdentityInput.supplyNature.supplier.status.id,
        recipientSezStatus:built.input.componentIdentityInput.supplyNature.recipient.status.id,
        recipientParty:built.input.componentIdentityInput.supplyNature.recipient.partyId,
        section14Case:canonicalResolved.section14.case,
        serviceDate:canonicalInput.section14Result.serviceProvisionDate,
        invoiceDate:canonicalInput.section14Result.invoiceIssueDate,
        paymentDate:canonicalInput.section14Result.paymentReceiptDate,
        rateChangeDate:canonicalInput.section14Result.rateChangeDate,
        timeOfSupplyDate:canonicalResolved.section14.timeOfSupplyDate,
        selectedSide:canonicalResolved.section14.selectedVersionSide,
        selectedExtension:selected.extensionId,selectedVersion:selected.version,selectedStatus:selected.status,
        selectedContentHash:selected.contentHash,selectedFrom:selected.effectiveFromInstant,
        selectedTo:selected.effectiveToInstant,
        componentFamily:built.input.componentIdentityResult.componentFamily,
        section14Hash:canonicalResolved.predecessorHashes.section14,
        levyHash:canonicalResolved.predecessorHashes.levyComponentIdentity,
        lineageHash:canonicalResolved.predecessorHashes.reservationLineage,
        attributionHash:canonicalResolved.predecessorHashes.attributionSnapshot,
        evidenceHash:canonicalResolved.evidenceHash,
        calendarAuthority:paymentEvidence.calendarEvidence.authorityId,
        calendarSourceHash:paymentEvidence.calendarEvidence.sourceDigestSha256,
        calendarThrough:paymentEvidence.throughDate,
        calendarDates:paymentEvidence.calendarEvidence.days.map(({date}:{date:string})=>date),
        calendarStates:paymentEvidence.calendarEvidence.days.map(({state}:{state:string})=>state),
        nightOrdinals:canonicalResolved.components.map(({ordinal})=>Number(ordinal)),
        nightDates:canonicalResolved.components.map(({businessDate})=>businessDate),
        nightAmounts:canonicalResolved.components.map(({quotedAmountMinor})=>BigInt(quotedAmountMinor)),
        slabUpto:canonicalResolved.components.map(({slab})=>slab.uptoMinor===null?null:BigInt(slab.uptoMinor)),
        aggregateBps:canonicalResolved.components.map(({slab})=>slab.aggregateRateBasisPoints),
        itcEligible:canonicalResolved.components.map(({slab})=>slab.itcEligible),
        componentNightOrdinals:canonicalResolved.components.flatMap(({ordinal,slab})=>slab.components.map(()=>Number(ordinal))),
        componentOrdinals:canonicalResolved.components.flatMap(({slab})=>slab.components.map((_,index)=>index)),
        componentIdentities:canonicalResolved.components.flatMap(({slab})=>slab.components.map(({identity})=>identity)),
        componentBps:canonicalResolved.components.flatMap(({slab})=>slab.components.map(({rateBasisPoints})=>rateBasisPoints)),
      };
      const invokeCapability=async(query:Tx,overrides:Partial<typeof baseCapability>={})=>{
        const value={...baseCapability,...overrides};
        return await query<Array<{applicability_id:string;evidence_hash:string;created:boolean}>>`
          SELECT * FROM public.record_india_gst_accommodation_quoted_rate_applicability(
            ${value.tenant}::uuid,${value.property}::uuid,${value.reservation}::uuid,${value.folio}::uuid,
            ${value.lineage}::uuid,${value.attribution}::uuid,${value.request}::uuid,${value.actor}::uuid,
            ${value.serviceSnapshot}::uuid,${value.paymentSnapshot}::uuid,${value.invoiceSnapshot}::uuid,
            ${value.familyJurisdiction}::uuid,${value.classification}::uuid,${value.supplierServiceLocation}::uuid,
            ${value.supplierSezStatus}::uuid,${value.recipientSezStatus}::uuid,${value.recipientParty}::uuid,
            ${value.section14Case},${value.serviceDate}::date,${value.invoiceDate}::date,${value.paymentDate}::date,
            ${value.rateChangeDate}::date,${value.timeOfSupplyDate}::date,${value.selectedSide},
            ${value.selectedExtension}::uuid,${value.selectedVersion}::smallint,${value.selectedStatus},
            ${value.selectedContentHash},${value.selectedFrom}::timestamptz,${value.selectedTo}::timestamptz,
            ${value.componentFamily},${value.section14Hash},${value.levyHash},${value.lineageHash},
            ${value.attributionHash},${value.evidenceHash},${value.calendarAuthority},${value.calendarSourceHash},
            ${value.calendarThrough}::date,${postgresArray(value.calendarDates)}::date[],
            ${postgresArray(value.calendarStates)}::text[],${postgresArray(value.nightOrdinals)}::integer[],
            ${postgresArray(value.nightDates)}::date[],${postgresArray(value.nightAmounts)}::bigint[],
            ${postgresArray(value.slabUpto)}::bigint[],${postgresArray(value.aggregateBps)}::integer[],
            ${postgresArray(value.itcEligible)}::boolean[],${postgresArray(value.componentNightOrdinals)}::integer[],
            ${postgresArray(value.componentOrdinals)}::smallint[],${postgresArray(value.componentIdentities)}::text[],
            ${postgresArray(value.componentBps)}::integer[]
          )`;
      };
      const resolverPrototype=IndiaGstAccommodationQuotedRateApplicabilityService.prototype as unknown as {
        resolve:(tx:Tx,input:unknown)=>Promise<typeof canonicalResolved>;
      };
      const originalResolve=resolverPrototype.resolve;
      resolverPrototype.resolve=async()=>canonicalResolved;
      let first:Awaited<ReturnType<IndiaGstAccommodationQuotedRateApplicabilityRecorderService["record"]>>;
      let replay:typeof first;
      try {
        const service=new IndiaGstAccommodationQuotedRateApplicabilityRecorderService({idempotency:new PostgresIdempotency()});
        const zeroWriteCensus=()=>runtimeConnection<Array<{roots:number;nights:number;components:number;facts:number;events:number}>>`SELECT
          (SELECT count(*)::int FROM public.india_gst_accommodation_quoted_rate_applicability WHERE tenant_id=${TENANT}::uuid) roots,
          (SELECT count(*)::int FROM public.india_gst_accommodation_quoted_rate_applicability_room_night WHERE tenant_id=${TENANT}::uuid) nights,
          (SELECT count(*)::int FROM public.india_gst_accommodation_quoted_rate_component WHERE tenant_id=${TENANT}::uuid) components,
          (SELECT count(*)::int FROM public.fact_log WHERE tenant_id=${TENANT}::uuid AND entity_type=${root}) facts,
          (SELECT count(*)::int FROM public.outbox WHERE tenant_id=${TENANT}::uuid AND event_type='india_gst.accommodation_quoted_rate_applicability_recorded') events`;
        let challengeOrdinal=0;
        const expectCapabilityRejection=async(overrides:Partial<typeof baseCapability>,errno:"22023"|"42501"|"55000"|"23505")=>{
          const savepoint=`hostile_${++challengeOrdinal}`;
          const before=await zeroWriteCensus();
          await runtimeConnection.unsafe(`SAVEPOINT ${savepoint}`);
          let failure:unknown;
          try { await invokeCapability(runtimeConnection,overrides); }
          catch(error) { failure=error; }
          await runtimeConnection.unsafe(`ROLLBACK TO SAVEPOINT ${savepoint}`);
          expect(failure).toMatchObject({errno});
          expect(await zeroWriteCensus()).toEqual(before);
        };
        await expectCapabilityRejection({calendarSourceHash:"f".repeat(64)},"22023");
        await expectCapabilityRejection({calendarAuthority:"FOREIGN_GOVERNED_CALENDAR"},"22023");
        const changedCalendarDates=[...baseCapability.calendarDates];
        changedCalendarDates[10]=changedCalendarDates[9]!;
        await expectCapabilityRejection({calendarDates:changedCalendarDates},"22023");
        const changedCalendarStates=[...baseCapability.calendarStates];
        changedCalendarStates[changedCalendarStates.length-1]="non_working";
        await expectCapabilityRejection({calendarStates:changedCalendarStates},"22023");
        await expectCapabilityRejection({calendarThrough:baseCapability.calendarDates.at(-2)!},"22023");
        await expectCapabilityRejection({calendarDates:[],calendarStates:[]},"22023");
        const calendar367Date=new Date(Date.UTC(2025,8,23+366)).toISOString().slice(0,10);
        await expectCapabilityRejection({calendarThrough:calendar367Date,calendarDates:[...baseCapability.calendarDates,calendar367Date],calendarStates:[...baseCapability.calendarStates,"working"]},"22023");
        await expectCapabilityRejection({selectedExtension:"0b21daf2-ea6e-5568-9c21-69e4d4424574"},"55000");
        await expectCapabilityRejection({selectedVersion:2},"55000");
        await expectCapabilityRejection({selectedStatus:"active"},"55000");
        await expectCapabilityRejection({selectedFrom:"2022-07-17T18:30:00.000001Z"},"55000");
        await expectCapabilityRejection({selectedContentHash:"0".repeat(64)},"55000");
        await expectCapabilityRejection({familyJurisdiction:"0b21daf2-ea6e-5568-9c21-69e4d4424574"},"55000");
        await expectCapabilityRejection({classification:"00000000-0000-0000-0000-000000040099"},"55000");
        await expectCapabilityRejection({lineage:"00000000-0000-0000-0000-000000040099"},"55000");
        await expectCapabilityRejection({attribution:"00000000-0000-0000-0000-000000040099"},"55000");
        await expectCapabilityRejection({serviceSnapshot:"00000000-0000-0000-0000-000000040099"},"55000");
        await expectCapabilityRejection({recipientParty:"00000000-0000-0000-0000-000000040099"},"55000");
        await expectCapabilityRejection({componentFamily:"igst"},"22023");
        await expectCapabilityRejection({nightOrdinals:[0,2]},"22023");
        await expectCapabilityRejection({nightOrdinals:[0,0]},"22023");
        await expectCapabilityRejection({componentOrdinals:[0,2,0,1]},"22023");
        await expectCapabilityRejection({componentOrdinals:[0,0,0,1]},"22023");
        const hostilePredecessor=structuredClone(canonicalInput) as any;
        hostilePredecessor.section14Input.paymentEvidence.calendarEvidence.authorityId="00000000-0000-0000-0000-000000040099";
        const hostileInput=deepFreeze({
          ...input,
          quotedRateApplicabilityInput:hostilePredecessor,
          idempotencyKey:"order400-foreign-calendar-authority",
          envelope:{...input.envelope,requestId:"00000000-0000-0000-0000-000000040019"},
        });
        await runtimeConnection.unsafe("SAVEPOINT foreign_calendar_authority");
        let hostileError:unknown;
        try {
          await service.record(runtimeConnection,hostileInput as never);
        } catch (error) {
          hostileError=error;
        }
        await runtimeConnection.unsafe("ROLLBACK TO SAVEPOINT foreign_calendar_authority");
        expect(hostileError).toBeDefined();
        await runtimeConnection.unsafe(`CREATE TEMP TABLE ${root}(marker text)`);
        await runtimeConnection.unsafe(`INSERT INTO ${root}(marker) VALUES('pg_temp sentinel')`);
        first=await service.record(runtimeConnection,input as never);
        expect(baseCapability.calendarDates).toHaveLength(366);
        expect(await runtimeConnection.unsafe<Array<{marker:string}>>(`SELECT marker FROM pg_temp.${root}`)).toEqual([{marker:"pg_temp sentinel"}]);
        const exactReplayCensus=await zeroWriteCensus();
        const exactCapabilityReplay=await invokeCapability(runtimeConnection,{request});
        expect(exactCapabilityReplay).toEqual([{applicability_id:first.applicabilityId,evidence_hash:first.evidenceHash,created:false}]);
        expect(await zeroWriteCensus()).toEqual(exactReplayCensus);
        await expectCapabilityRejection({request,actor:alternateActor},"23505");
        replay=await service.record(runtimeConnection,input as never);
      } finally {
        resolverPrototype.resolve=originalResolve;
      }
      expect(first).toMatchObject({created:true,replayed:false});
      expect(replay).toEqual({...first,replayed:true});
      const evidence=await runtimeConnection<Array<{roots:number;nights:number;components:number;facts:number;events:number;keys:number;calendar_count:number;fact_payload:Record<string,unknown>;event_payload:Record<string,unknown>}>>`
        SELECT
          (SELECT count(*)::int FROM public.india_gst_accommodation_quoted_rate_applicability WHERE tenant_id=${TENANT}::uuid) roots,
          (SELECT count(*)::int FROM public.india_gst_accommodation_quoted_rate_applicability_room_night WHERE tenant_id=${TENANT}::uuid) nights,
          (SELECT count(*)::int FROM public.india_gst_accommodation_quoted_rate_component WHERE tenant_id=${TENANT}::uuid) components,
          (SELECT count(*)::int FROM public.fact_log WHERE tenant_id=${TENANT}::uuid AND entity_type=${root}) facts,
          (SELECT count(*)::int FROM public.outbox WHERE tenant_id=${TENANT}::uuid AND event_type='india_gst.accommodation_quoted_rate_applicability_recorded') events,
          (SELECT count(*)::int FROM public.api_idempotency WHERE tenant_id=${TENANT}::uuid AND operation='tax-fiscal.india-quoted-rate-applicability.record') keys,
          (SELECT cardinality(calendar_dates)::int FROM public.india_gst_accommodation_quoted_rate_applicability WHERE tenant_id=${TENANT}::uuid LIMIT 1) calendar_count,
          (SELECT payload FROM public.fact_log WHERE tenant_id=${TENANT}::uuid AND entity_type=${root} LIMIT 1) fact_payload,
          (SELECT payload FROM public.outbox WHERE tenant_id=${TENANT}::uuid AND event_type='india_gst.accommodation_quoted_rate_applicability_recorded' LIMIT 1) event_payload
      `;
      expect(evidence).toEqual([{roots:1,nights:2,components:4,facts:1,events:1,keys:1,calendar_count:366,
        fact_payload:{applicabilityId:first.applicabilityId,evidenceHash:first.evidenceHash},
        event_payload:{applicabilityId:first.applicabilityId,reservationId:RESERVATION,folioId:FOLIO,evidenceHash:first.evidenceHash}}]);
      await runtimeConnection.unsafe("ROLLBACK");
      const absent=await db<Array<{roots:number;facts:number;events:number;keys:number}>>`SELECT
        (SELECT count(*)::int FROM public.india_gst_accommodation_quoted_rate_applicability WHERE tenant_id=${TENANT}::uuid) roots,
        (SELECT count(*)::int FROM public.fact_log WHERE tenant_id=${TENANT}::uuid AND entity_type=${root}) facts,
        (SELECT count(*)::int FROM public.outbox WHERE tenant_id=${TENANT}::uuid AND event_type='india_gst.accommodation_quoted_rate_applicability_recorded') events,
        (SELECT count(*)::int FROM public.api_idempotency WHERE tenant_id=${TENANT}::uuid AND operation='tax-fiscal.india-quoted-rate-applicability.record') keys`;
      expect(absent).toEqual([{roots:0,facts:0,events:0,keys:0}]);
      const contender=await runtimeDb.reserve();
      try {
        await runtimeConnection.unsafe("BEGIN");
        await runtimeConnection`SELECT set_config('app.tenant_id',${TENANT},true)`;
        await runtimeConnection.unsafe("SET LOCAL ROLE app_role");
        await contender.unsafe("BEGIN");
        await contender`SELECT set_config('app.tenant_id',${TENANT},true)`;
        await contender.unsafe("SET LOCAL ROLE app_role");
        const contenderPid=(await contender<Array<{pid:number}>>`SELECT pg_backend_pid()::int pid`)[0]!.pid;
        const arbitrationRequest="00000000-0000-0000-0000-000000040021";
        const winner=(await invokeCapability(runtimeConnection,{request:arbitrationRequest}))[0]!;
        const contenderResult=invokeCapability(contender,{request:arbitrationRequest});
        let observedLock=false;
        for(let attempt=0;attempt<100&&!observedLock;attempt++) {
          const state=await db<Array<{waiting:boolean}>>`SELECT (wait_event_type='Lock') waiting FROM pg_stat_activity WHERE pid=${contenderPid}`;
          observedLock=state[0]?.waiting===true;
          if(!observedLock) await Bun.sleep(10);
        }
        expect(observedLock).toBeTrue();
        await runtimeConnection.unsafe("COMMIT");
        const loser=(await contenderResult)[0]!;
        expect(winner).toMatchObject({evidence_hash:baseCapability.evidenceHash,created:true});
        expect(loser).toEqual({...winner,created:false});
        await contender.unsafe("ROLLBACK");
        const arbitrationCensus=await db<Array<{roots:number;nights:number;components:number;facts:number;events:number}>>`SELECT
          (SELECT count(*)::int FROM public.india_gst_accommodation_quoted_rate_applicability WHERE tenant_id=${TENANT}::uuid) roots,
          (SELECT count(*)::int FROM public.india_gst_accommodation_quoted_rate_applicability_room_night WHERE tenant_id=${TENANT}::uuid) nights,
          (SELECT count(*)::int FROM public.india_gst_accommodation_quoted_rate_component WHERE tenant_id=${TENANT}::uuid) components,
          (SELECT count(*)::int FROM public.fact_log WHERE tenant_id=${TENANT}::uuid AND entity_type=${root}) facts,
          (SELECT count(*)::int FROM public.outbox WHERE tenant_id=${TENANT}::uuid AND event_type='india_gst.accommodation_quoted_rate_applicability_recorded') events`;
        expect(arbitrationCensus).toEqual([{roots:1,nights:2,components:4,facts:1,events:1}]);
      } finally {
        await contender.unsafe("ROLLBACK").catch(()=>undefined);
        contender.release();
      }
      } finally {
        await runtimeConnection.unsafe("ROLLBACK").catch(()=>undefined);
        runtimeConnection.release();
      }
    } finally {
      await connection.unsafe("ROLLBACK").catch(()=>undefined);
      connection.release();
    }
  },30_000);

  test("RLS hides colliding evidence from the wrong tenant and raw app-role DML is denied", async () => {
    const connection = await db.reserve();
    try {
      await connection.unsafe("BEGIN");
      await connection`SELECT set_config('app.tenant_id','00000000-0000-0000-0000-000000040001',true)`;
      await connection.unsafe("SET LOCAL ROLE app_role");
      for (const table of tables) {
        const visible = await connection.unsafe<Array<{ count:number }>>(`SELECT count(*)::int count FROM public.${table}`);
        expect(visible[0]!.count).toBe(0);
        for (const statement of [
          `UPDATE public.${table} SET tenant_id=tenant_id WHERE false`,
          `DELETE FROM public.${table} WHERE false`,
        ]) {
          await connection.unsafe("SAVEPOINT denied_dml");
          try {
            await connection.unsafe(statement);
            throw new Error("raw app-role DML unexpectedly succeeded");
          } catch (error) {
            expect(error).toMatchObject({ errno:"42501" });
          }
          await connection.unsafe("ROLLBACK TO SAVEPOINT denied_dml");
        }
      }
      await connection.unsafe("ROLLBACK");
    } finally {
      connection.release();
    }
  });
});
