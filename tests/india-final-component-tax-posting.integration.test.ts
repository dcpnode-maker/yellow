import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { SQL } from "bun";

import {
  createAuditEnvelope,
  Database,
  PostgresEventBus,
  PostgresIdempotency,
  type EventBus,
  type OutboxEvent,
  type PublishEventInput,
  type Tx,
} from "../src/kernel";
import { IndiaFinalComponentTaxPostingService } from "../src/contexts/financials";
import { createPositiveTaxAttributionSnapshot } from "../src/contexts/tax-fiscal";

setDefaultTimeout(90_000);

const id = (suffix: number): string =>
  `00000000-0000-0000-0000-${String(suffix).padStart(12, "0")}`;
const TENANT = id(407001);
const FOREIGN_TENANT = id(407999);

function sqlState(error: unknown): string | undefined {
  const typed = error as { errno?: string; code?: string };
  return typed.errno ?? typed.code;
}

describe("Order 407 governed India final component-tax posting contract", () => {
  test("the service admits identity and audit authority only", async () => {
    const source = await Bun.file(new URL(
      "../src/contexts/financials/india-final-component-tax-postings.ts",
      import.meta.url,
    )).text();
    expect(source).toContain("IndiaFinalComponentTaxPostingService");
    expect(source).toContain("financials.india-final-component-tax.post");
    expect(source).toContain("record_india_final_component_tax_journal_binding");
    expect(source).toContain("india_gst.accommodation_final_component_tax_posted");
    expect(source).toContain("journal.posted");
    expect(source).toMatch(/IndiaGstAccommodationFinalComponentTaxSemanticRouteService/);
    expect(source).toMatch(/PositiveTaxFolioEligibilityService/);
    expect(source).toMatch(/current_setting\('app\.tenant_id',\s*true\)/);
    expect(source).not.toMatch(/Math\.(?:round|floor|ceil)|new\s+Date|Date\.now/);
    expect(source).not.toContain("ChargeCorrectionService");
    expect(source).not.toContain("PositiveTaxCorrectionService");

    const inputKeys = source.match(/"tenantId"\s*,\s*"propertyNode"\s*,\s*"reservationId"\s*,\s*"idempotencyKey"\s*,\s*"envelope"/g);
    expect(inputKeys?.length).toBeGreaterThan(0);
  });

  test("the posting order is derived, exact and balance-preserving", async () => {
    const source = await Bun.file(new URL(
      "../src/contexts/financials/india-final-component-tax-postings.ts",
      import.meta.url,
    )).text();
    expect(source).toContain("grandTotalMinor");
    expect(source).toContain("transactionValueMinor");
    expect(source).toContain("amountMinor");
    expect(source).toContain("componentIdentity");
    expect(source).toContain("india_accommodation_component_tax_v1");
    expect(source).toMatch(/BigInt\(/);
    expect(source).toMatch(/taxDetail|null/);
    expect(source).toMatch(/zero|!==\s*"0"|BigInt\([^)]*\)\s*!==\s*0n/i);
  });

  test("replay, convergence and atomic evidence are explicit", async () => {
    const source = await Bun.file(new URL(
      "../src/contexts/financials/india-final-component-tax-postings.ts",
      import.meta.url,
    )).text();
    expect(source).toContain("idempotency");
    expect(source).toContain("replayed");
    expect(source).toContain("created");
    expect(source).toMatch(/final_component_tax_journal_binding/);
    expect(source).toMatch(/recordFact/);
    expect(source.match(/events\.publish/g)?.length).toBe(2);
  });
});

const deployUrl = process.env.YELLOW_ORDER407_DATABASE_URL;
const runtimeUrl = process.env.YELLOW_ORDER407_RUNTIME_DATABASE_URL;
if (process.env.YELLOW_REQUIRE_ORDER407_DATABASE === "1" && (!deployUrl || !runtimeUrl)) {
  throw new Error("Order407 PostgreSQL proof requires deploy and runtime database URLs");
}
const databaseDescribe = deployUrl && runtimeUrl ? describe.serial : describe.skip;

databaseDescribe("Order 407 live PostgreSQL contract", () => {
  const deploy = new SQL(deployUrl!, { max: 1, prepare: false });
  const database = Database.connect(runtimeUrl!, { maxConnections: 2, prepare: false });

  afterAll(async () => {
    await database.close();
    await deploy.close({ timeout: 0 });
  });

  test("binding is append-only, tenant-leading, forced-RLS and exactly constrained", async () => {
    const [shape] = await deploy<Array<Record<string, unknown>>>`SELECT
      c.relrowsecurity rls,c.relforcerowsecurity force_rls,
      pg_get_userbyid(c.relowner) owner,
      has_table_privilege('app_role',c.oid,'SELECT') app_select,
      has_table_privilege('app_role',c.oid,'INSERT') app_insert,
      has_table_privilege('app_role',c.oid,'UPDATE') app_update,
      has_table_privilege('app_role',c.oid,'DELETE') app_delete,
      has_table_privilege('yellow_runtime',c.oid,'SELECT') runtime_select,
      has_table_privilege('public',c.oid,'SELECT') public_select
      FROM pg_class c
      WHERE c.oid='public.india_gst_accommodation_final_component_tax_journal_binding'::regclass`;
    expect(shape).toMatchObject({
      rls: true, force_rls: true, owner: "yellow_owner", app_select: true,
      app_insert: false, app_update: false, app_delete: false,
      runtime_select: false, public_select: false,
    });

    const constraints = await deploy<Array<{ definition: string }>>`
      SELECT pg_get_constraintdef(oid) definition FROM pg_constraint
      WHERE conrelid='public.india_gst_accommodation_final_component_tax_journal_binding'::regclass`;
    expect(constraints.some(({ definition }) => definition.includes("UNIQUE (tenant_id, tax_id)"))).toBeTrue();
    expect(constraints.some(({ definition }) => definition.includes("UNIQUE (tenant_id, journal_id)"))).toBeTrue();
    expect(constraints.filter(({ definition }) => definition.startsWith("FOREIGN KEY"))
      .every(({ definition }) => definition.startsWith("FOREIGN KEY (tenant_id,"))).toBeTrue();
  });

  test("owner capability has the fixed path and app-only execution", async () => {
    const [fn] = await deploy<Array<Record<string, unknown>>>`SELECT
      pg_get_userbyid(p.proowner) owner,p.prosecdef security_definer,p.proconfig config,
      has_function_privilege('app_role',p.oid,'EXECUTE') app_execute,
      has_function_privilege('yellow_runtime',p.oid,'EXECUTE') runtime_execute,
      has_function_privilege('public',p.oid,'EXECUTE') public_execute,
      oidvectortypes(p.proargtypes) arguments,
      pg_get_function_result(p.oid) result
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public'
        AND p.proname='record_india_final_component_tax_journal_binding'`;
    expect(fn).toMatchObject({
      owner: "yellow_owner", security_definer: true, app_execute: true,
      runtime_execute: false, public_execute: false,
    });
    expect(fn!.config).toEqual(expect.arrayContaining([expect.stringContaining("search_path=")]));
    expect(fn!.arguments).toBe("uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid[], jsonb");
    expect(String(fn!.result)).toContain("posting_binding_id");
  });

  test("RLS conceals foreign bindings and app-role direct mutation is denied", async () => {
    const visible = await database.withTenantTransaction(TENANT, (tx) => tx<Array<{ count: number }>>`
      SELECT count(*)::int count
      FROM india_gst_accommodation_final_component_tax_journal_binding
      WHERE tenant_id=${FOREIGN_TENANT}::uuid`);
    expect(visible).toEqual([{ count: 0 }]);

    for (const statement of ["INSERT", "UPDATE", "DELETE"] as const) {
      let error: unknown;
      try {
        await database.withTenantTransaction(TENANT, (tx) => {
          if (statement === "INSERT") return tx`INSERT INTO india_gst_accommodation_final_component_tax_journal_binding(tenant_id,id,property_node,posted_by,tax_id,tax_generation,tax_evidence_hash,valuation_id,valuation_generation,applicability_id,reservation_id,folio_id,guest_account_id,journal_id,business_date,currency) VALUES(${TENANT}::uuid,${id(407020)}::uuid,${id(407021)}::uuid,${id(407022)}::uuid,${id(407023)}::uuid,0,${"0".repeat(64)},${id(407024)}::uuid,0,${id(407025)}::uuid,${id(407026)}::uuid,${id(407027)}::uuid,${id(407029)}::uuid,${id(407028)}::uuid,CURRENT_DATE,'INR')`;
          if (statement === "UPDATE") return tx`UPDATE india_gst_accommodation_final_component_tax_journal_binding SET currency='INR' WHERE tenant_id=${TENANT}::uuid`;
          return tx`DELETE FROM india_gst_accommodation_final_component_tax_journal_binding WHERE tenant_id=${TENANT}::uuid`;
        });
      } catch (caught) {
        error = caught;
      }
      expect(sqlState(error), statement).toBe("42501");
    }
  });

  test("every durable binding points to one exactly balanced canonical journal", async () => {
    const violations = await deploy<Array<Record<string, unknown>>>`SELECT
      b.tenant_id,b.tax_id,b.journal_id,
      count(l.id)::int line_count,coalesce(sum(l.amount_minor),0)::text balance,
      count(*) FILTER (WHERE l.tax_detail IS NOT NULL)::int detailed_lines,
      min(l.seq) FILTER (WHERE l.tax_detail IS NOT NULL)::int detail_seq
      FROM india_gst_accommodation_final_component_tax_journal_binding b
      JOIN india_gst_accommodation_final_component_tax t
        ON t.tenant_id=b.tenant_id AND t.id=b.tax_id
       AND t.generation=b.tax_generation AND t.evidence_hash=b.tax_evidence_hash
      JOIN india_gst_accommodation_final_valuation v
        ON v.tenant_id=b.tenant_id AND v.id=b.valuation_id
       AND v.generation=b.valuation_generation
      JOIN india_gst_accommodation_quoted_rate_applicability a
        ON a.tenant_id=b.tenant_id AND a.id=b.applicability_id
      JOIN journal j ON j.tenant_id=b.tenant_id AND j.id=b.journal_id
      JOIN posting_line l ON l.tenant_id=j.tenant_id AND l.journal_id=j.id
      GROUP BY b.tenant_id,b.tax_id,b.journal_id
      HAVING sum(l.amount_minor)<>0
        OR count(*) FILTER (WHERE l.tax_detail IS NOT NULL)<>1
        OR min(l.seq) FILTER (WHERE l.tax_detail IS NOT NULL)<>1`;
    expect(violations).toEqual([]);
  });

  test("the capability rejects forged empty lineage without leaving artifacts", async () => {
    const before = (await deploy<Array<Record<string, number>>>`SELECT
      (SELECT count(*)::int FROM journal WHERE tenant_id=${TENANT}::uuid) journals,
      (SELECT count(*)::int FROM posting_line WHERE tenant_id=${TENANT}::uuid) lines,
      (SELECT count(*)::int FROM india_gst_accommodation_final_component_tax_journal_binding
        WHERE tenant_id=${TENANT}::uuid) bindings,
      (SELECT count(*)::int FROM fact_log WHERE tenant_id=${TENANT}::uuid) facts,
      (SELECT count(*)::int FROM outbox WHERE tenant_id=${TENANT}::uuid) events,
      (SELECT count(*)::int FROM api_idempotency WHERE tenant_id=${TENANT}::uuid) keys`)[0]!;
    let error: unknown;
    try {
      await database.withTenantTransaction(TENANT, (tx) => tx`
        SELECT * FROM record_india_final_component_tax_journal_binding(
          ${TENANT}::uuid,${id(407002)}::uuid,${id(407003)}::uuid,${id(407004)}::uuid,
          ${id(407005)}::uuid,${id(407006)}::uuid,${id(407007)}::uuid,
          ARRAY[]::uuid[],'{}'::jsonb)`);
    } catch (caught) {
      error = caught;
    }
    expect(sqlState(error)).toBe("22023");
    const after = (await deploy<Array<Record<string, number>>>`SELECT
      (SELECT count(*)::int FROM journal WHERE tenant_id=${TENANT}::uuid) journals,
      (SELECT count(*)::int FROM posting_line WHERE tenant_id=${TENANT}::uuid) lines,
      (SELECT count(*)::int FROM india_gst_accommodation_final_component_tax_journal_binding
        WHERE tenant_id=${TENANT}::uuid) bindings,
      (SELECT count(*)::int FROM fact_log WHERE tenant_id=${TENANT}::uuid) facts,
      (SELECT count(*)::int FROM outbox WHERE tenant_id=${TENANT}::uuid) events,
      (SELECT count(*)::int FROM api_idempotency WHERE tenant_id=${TENANT}::uuid) keys`)[0]!;
    expect(after).toEqual(before);
  });
});

interface Journey {
  tenant: string;
  property: string;
  actor: string;
  alternateActor: string;
  reservation: string;
  folio: string;
  tax: string;
  valuation: string;
  applicability: string;
  guestAccount: string;
  revenueAccount: string;
  taxAccounts: readonly string[];
  revenueMapping: string;
  taxMappings: readonly string[];
  roomCode: string;
  taxCodes: readonly string[];
  currentDay: string;
}

type ComponentFamily = "igst" | "cgst_sgst" | "cgst_utgst";
interface JourneyOptions {
  readonly value?: bigint;
  readonly rateBasisPoints?: number;
  readonly roomNights?: readonly Readonly<{ value: bigint; components: readonly bigint[] }>[];
}

class FailSecondPublish implements EventBus {
  #count = 0;
  constructor(readonly delegate: EventBus) {}
  async publish(tx: Tx, event: PublishEventInput): Promise<OutboxEvent> {
    const result = await this.delegate.publish(tx, event);
    if (++this.#count === 2) throw new Error("Order407 injected publication failure");
    return result;
  }
  consumeBatch(...args: Parameters<EventBus["consumeBatch"]>): ReturnType<EventBus["consumeBatch"]> {
    return this.delegate.consumeBatch(...args);
  }
}

databaseDescribe("Order407 real governed service journeys", () => {
  const deploy = new SQL(deployUrl!, { max: 4, prepare: false });
  const runtimePool = new SQL(runtimeUrl!, { max: 8, prepare: false });
  const database = Database.connect(runtimeUrl!, { maxConnections: 12, prepare: false });
  const events = new PostgresEventBus(runtimePool);
  const service = new IndiaFinalComponentTaxPostingService({ events, idempotency: new PostgresIdempotency() });
  const extension = "0b21daf2-ea6e-5568-9c21-69e4d4424574";
  const extensionHash = "eb323eff707aad1e460b425c87b448d4e924d2eb17499094abad71b33c69a820";
  const seeded: Journey[] = [];
  let serial = 0;

  function hash(seed: string): string {
    return seed.padStart(64, seed[0] ?? "a").slice(-64);
  }

  async function seedJourney(
    family: ComponentFamily,
    amounts: readonly bigint[],
    options: JourneyOptions = {},
  ): Promise<Journey> {
    const n = ++serial;
    const tenant = crypto.randomUUID(), property = crypto.randomUUID(), actor = crypto.randomUUID();
    const alternateActor = crypto.randomUUID();
    const party = crypto.randomUUID(), unitType = crypto.randomUUID(), sellable = crypto.randomUUID();
    const ratePlan = crypto.randomUUID(), reservation = crypto.randomUUID(), segment = crypto.randomUUID();
    const hold = crypto.randomUUID(), holdBinding = crypto.randomUUID(), attribution = crypto.randomUUID();
    const lineage = crypto.randomUUID(), guestAccount = crypto.randomUUID(), folio = crypto.randomUUID();
    const valuation = crypto.randomUUID(), applicability = crypto.randomUUID(), tax = crypto.randomUUID();
    const quoteHash = hash(`${n}a`), valuationHash = hash(`${n}b`), applicabilityHash = hash(`${n}c`), taxHash = hash(`${n}d`);
    const currentDay = (await deploy<Array<{ business_date: string }>>`SELECT (transaction_timestamp() AT TIME ZONE 'UTC')::date::text business_date`)[0]!.business_date;
    const nights = options.roomNights ?? [{ value: options.value ?? 100000n, components: amounts }];
    const value = nights.reduce((sum, night) => sum + night.value, 0n);
    const taxTotal = nights.reduce((sum, night) => sum + night.components.reduce((part, amount) => part + amount, 0n), 0n);
    const nightDates = await deploy<Array<{ business_date: string }>>`SELECT (${currentDay}::date+ordinal::int)::text business_date FROM generate_series(0,${nights.length - 1}) ordinal ORDER BY ordinal`;
    const snapshot = createPositiveTaxAttributionSnapshot({
      origin: { kind: "rate_quote", quoteHash }, currency: "INR",
      line: { lineId: "room", revenueGroup: "room_revenue", amountMinor: value, nights: nights.length, personNights: nights.length * 2,
        roomNights: nights.map((night, index) => ({ businessDate: nightDates[index]!.business_date, amountMinor: night.value })) },
      assignments: nightDates.map(({ business_date }, index) => ({ businessDate: business_date, jurisdictionKey: "in-gst-lodging", evidenceRef: `tax-assignment:${hash(`${n}f${index}`)}` })),
      jurisdiction: { extensionId: extension, ownerTenantId: null, key: "in-gst-lodging", version: 2,
        contentHash: extensionHash, evidenceRef: `tax-jurisdiction:${hash(`${n}e`)}` },
      evaluation: { schemaVersion: 1, jurisdictionKey: "in-gst-lodging", country: "IN",
        priceDisplay: "tax_exclusive", rounding: "document", inputTotalMinor: value,
        baseTotalMinor: value, taxTotalMinor: taxTotal, grandTotalMinor: value + taxTotal,
        taxes: [{ code: "GST_ROOM", name: "GST", taxMinor: taxTotal, components: [] }] },
    });
    const identities = family === "igst" ? ["igst"] : family === "cgst_sgst" ? ["cgst", "sgst"] : ["cgst", "utgst"];
    const semantic = family === "igst" ? ["IGST"] : family === "cgst_sgst" ? ["CGST", "SGST"] : ["CGST", "UTGST"];
    const revenueAccount = crypto.randomUUID();
    const taxAccounts = identities.map(() => crypto.randomUUID());
    const revenueMapping = crypto.randomUUID();
    const taxMappings = identities.map(() => crypto.randomUUID());
    const roomCode = `O407_ROOM_${n}`, taxCodes = semantic.map((code) => `O407_${code}_${n}`);

    await deploy.begin(async (tx) => {
      await tx`SET LOCAL session_replication_role=replica`;
      await tx`INSERT INTO tenant(id,slug,name,tier,status) VALUES(${tenant}::uuid,${`o407-${n}`},'Order407','shared','active')`;
      await tx`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency) VALUES(${property}::uuid,${tenant}::uuid,${`o407${n}.property`}::ltree,'property','Order407','UTC','INR')`;
      await tx`INSERT INTO app_user(id,tenant_id,email,display_name,status) VALUES(${actor}::uuid,${tenant}::uuid,${`actor${n}@o407.local`},'Actor','active')`;
      await tx`INSERT INTO app_user(id,tenant_id,email,display_name,status) VALUES(${alternateActor}::uuid,${tenant}::uuid,${`alternate${n}@o407.local`},'Alternate','active')`;
      await tx`INSERT INTO party(id,tenant_id,kind,display_name,status) VALUES(${party}::uuid,${tenant}::uuid,'person','Guest','active')`;
      await tx`INSERT INTO unit_type(id,tenant_id,property_node,code,name,profile_key,max_occupancy) VALUES(${unitType}::uuid,${tenant}::uuid,${property}::uuid,${`O407${n}`},'Room','hotel',2)`;
      await tx`INSERT INTO sellable_unit(id,tenant_id,unit_type_id,name,status) VALUES(${sellable}::uuid,${tenant}::uuid,${unitType}::uuid,'Room','active')`;
      await tx`INSERT INTO rate_plan(id,tenant_id,property_node,code,name,currency,tax_inclusive,status) VALUES(${ratePlan}::uuid,${tenant}::uuid,${property}::uuid,${`O407-${n}`},'Rate','INR',false,'active')`;
      await tx`INSERT INTO reservation(id,tenant_id,property_node,confirmation_no,status,primary_party,channel_code,currency) VALUES(${reservation}::uuid,${tenant}::uuid,${property}::uuid,${`O407-R-${n}`},'checked_out',${party}::uuid,'direct','INR')`;
      await tx`INSERT INTO reservation_segment(id,tenant_id,reservation_id,seq,unit_type_id,sellable_unit_id,period,adults,children,rate_plan_id,status) VALUES(${segment}::uuid,${tenant}::uuid,${reservation}::uuid,1,${unitType}::uuid,${sellable}::uuid,'[2035-01-01,2035-01-02)'::tstzrange,2,'[]',${ratePlan}::uuid,'booked')`;
      await tx`INSERT INTO hold(id,tenant_id,property_node,sellable_unit_id,period,kind,holder,expires_at,status) VALUES(${hold}::uuid,${tenant}::uuid,${property}::uuid,${sellable}::uuid,'[2035-01-01,2035-01-02)'::tstzrange,'cart','{}','2035-01-02','consumed')`;
      await tx`INSERT INTO tax_attribution_snapshot(tenant_id,id,property_node,actor_id,schema_version,origin_kind,origin_quote_hash,snapshot_hash,currency,snapshot) VALUES(${tenant}::uuid,${attribution}::uuid,${property}::uuid,${actor}::uuid,1,'rate_quote',${quoteHash},${snapshot.snapshotHash},'INR',${JSON.stringify(snapshot)}::jsonb)`;
      await tx`INSERT INTO tax_attribution_hold_binding(tenant_id,id,property_node,bound_by,hold_id,attribution_id,sellable_unit_id,period,origin_quote_hash,snapshot_hash,currency) VALUES(${tenant}::uuid,${holdBinding}::uuid,${property}::uuid,${actor}::uuid,${hold}::uuid,${attribution}::uuid,${sellable}::uuid,'[2035-01-01,2035-01-02)'::tstzrange,${quoteHash},${snapshot.snapshotHash},'INR')`;
      await tx`INSERT INTO tax_attribution_reservation_binding(tenant_id,id,property_node,linked_by,binding_id,hold_id,attribution_id,reservation_id,segment_id,sellable_unit_id,period,origin_quote_hash,snapshot_hash,currency) VALUES(${tenant}::uuid,${lineage}::uuid,${property}::uuid,${actor}::uuid,${holdBinding}::uuid,${hold}::uuid,${attribution}::uuid,${reservation}::uuid,${segment}::uuid,${sellable}::uuid,'[2035-01-01,2035-01-02)'::tstzrange,${quoteHash},${snapshot.snapshotHash},'INR')`;
      await tx`INSERT INTO account(id,tenant_id,property_node,role,party_id,name,currency,status) VALUES(${guestAccount}::uuid,${tenant}::uuid,${property}::uuid,'guest',${party}::uuid,'Guest','INR','open')`;
      await tx`INSERT INTO folio(id,tenant_id,account_id,reservation_id,folio_no,window_no,name,status) VALUES(${folio}::uuid,${tenant}::uuid,${guestAccount}::uuid,${reservation}::uuid,${`O407-F-${n}`},1,'Primary','open')`;
      await tx`INSERT INTO business_day(tenant_id,property_node,business_date) VALUES(${tenant}::uuid,${property}::uuid,${currentDay}::date)`;
      await tx`INSERT INTO india_gst_accommodation_final_valuation(tenant_id,id,property_node,reservation_id,folio_id,folio_account_id,window_no,buyer_party_id,attribution_id,request_id,generation,disposition,currency,transaction_value_minor,source_set_hash,order341_evidence_hash,request_hash,evidence_hash,ordinary_evidence_hashes,manual_reasons,relationship_conclusion,consideration_conclusion,section15_2_conclusion,section15_3_conclusion,source_completeness_conclusion,attestation_evidence_source,attestation_evidence_reference,relationship_set_hash,attested_by,actor_id) VALUES(${tenant}::uuid,${valuation}::uuid,${property}::uuid,${reservation}::uuid,${folio}::uuid,${guestAccount}::uuid,1,${party}::uuid,${attribution}::uuid,${crypto.randomUUID()}::uuid,0,'ordinary_final','INR',${value},${hash(`${n}1`)},${applicabilityHash},${hash(`${n}2`)},${valuationHash},ARRAY[${hash(`${n}3`)},${hash(`${n}4`)},${hash(`${n}5`)},${hash(`${n}6`)},${hash(`${n}7`)}],ARRAY[]::text[],'unrelated_not_distinct','money_only','all_additions_enumerated','all_discounts_eligible','all_sources_classified','order407.fixture','live',${hash(`${n}9`)},${actor}::uuid,${actor}::uuid)`;
      await tx`INSERT INTO india_gst_accommodation_quoted_rate_applicability(tenant_id,id,property_node,reservation_id,folio_id,reservation_lineage_id,attribution_id,service_provision_snapshot_id,payment_receipt_snapshot_id,invoice_issue_snapshot_id,family_jurisdiction_extension_id,classification_id,supplier_service_location_id,supplier_sez_status_id,recipient_sez_status_id,recipient_party_id,final_valuation_id,request_id,section14_case,service_provision_date,invoice_issue_date,payment_receipt_date,rate_change_date,time_of_supply_date,selected_version_side,selected_extension_id,selected_extension_version,selected_extension_status,selected_content_hash,selected_effective_from,component_family,section14_evidence_hash,levy_component_identity_evidence_hash,reservation_lineage_evidence_hash,attribution_snapshot_evidence_hash,evidence_hash,actor_id) VALUES(${tenant}::uuid,${applicability}::uuid,${property}::uuid,${reservation}::uuid,${folio}::uuid,${lineage}::uuid,${attribution}::uuid,${crypto.randomUUID()}::uuid,${crypto.randomUUID()}::uuid,${crypto.randomUUID()}::uuid,${extension}::uuid,${crypto.randomUUID()}::uuid,${crypto.randomUUID()}::uuid,${crypto.randomUUID()}::uuid,${crypto.randomUUID()}::uuid,${party}::uuid,${valuation}::uuid,${crypto.randomUUID()}::uuid,'supply_invoice_before_payment_after','2035-01-01','2035-01-01','2035-01-02','2025-09-22','2035-01-01','successor',${extension}::uuid,2,'active',${extensionHash},'2025-09-21 18:30:00+00',${family},${hash(`${n}5`)},${hash(`${n}6`)},${hash(`${n}7`)},${hash(`${n}8`)},${applicabilityHash},${actor}::uuid)`;
      await tx`INSERT INTO india_gst_accommodation_final_component_tax(tenant_id,id,property_node,reservation_id,folio_id,applicability_id,valuation_id,valuation_generation,request_id,generation,currency,transaction_value_minor,tax_minor,grand_total_minor,component_family,selected_version_side,selected_extension_id,selected_extension_version,final_valuation_evidence_hash,quoted_rate_applicability_evidence_hash,section14_evidence_hash,levy_component_identity_evidence_hash,reservation_lineage_evidence_hash,attribution_snapshot_evidence_hash,evidence_hash,actor_id) VALUES(${tenant}::uuid,${tax}::uuid,${property}::uuid,${reservation}::uuid,${folio}::uuid,${applicability}::uuid,${valuation}::uuid,0,${crypto.randomUUID()}::uuid,0,'INR',${value},${taxTotal},${value + taxTotal},${family},'successor',${extension}::uuid,2,${valuationHash},${applicabilityHash},${hash(`${n}5`)},${hash(`${n}6`)},${hash(`${n}7`)},${hash(`${n}8`)},${taxHash},${actor}::uuid)`;
      for (const [nightOrdinal, night] of nights.entries()) {
        const nightTax = night.components.reduce((sum, amount) => sum + amount, 0n);
        await tx`INSERT INTO india_gst_accommodation_final_component_tax_room_night(tenant_id,tax_id,ordinal,business_date,final_value_minor,currency,slab_upto_minor,aggregate_rate_basis_points,itc_eligible,tax_minor) VALUES(${tenant}::uuid,${tax}::uuid,${nightOrdinal}::smallint,${nightDates[nightOrdinal]!.business_date}::date,${night.value},'INR',NULL,${options.rateBasisPoints ?? 1800},true,${nightTax})`;
        for (const [index, identity] of identities.entries()) await tx`INSERT INTO india_gst_accommodation_final_component_tax_component(tenant_id,tax_id,room_night_ordinal,component_ordinal,component_identity,rate_basis_points,tax_amount_minor,currency) VALUES(${tenant}::uuid,${tax}::uuid,${nightOrdinal}::smallint,${index}::smallint,${identity},${Math.trunc((options.rateBasisPoints ?? 1800) / identities.length)},${night.components[index]!},'INR')`;
      }
      await tx`INSERT INTO account(id,tenant_id,property_node,role,name,currency,status) VALUES(${revenueAccount}::uuid,${tenant}::uuid,${property}::uuid,'revenue','Revenue','INR','open')`;
      for (const [index, account] of taxAccounts.entries()) await tx`INSERT INTO account(id,tenant_id,property_node,role,name,currency,status) VALUES(${account}::uuid,${tenant}::uuid,${property}::uuid,'tax_payable',${semantic[index]!},'INR','open')`;
      await tx`INSERT INTO tx_code(code,name,grp,usali_line,default_dr,default_cr) VALUES(${roomCode},'Room','revenue','Rooms','guest','revenue')`;
      for (const [index, code] of taxCodes.entries()) await tx`INSERT INTO tx_code(code,name,grp,default_dr,default_cr) VALUES(${code},${semantic[index]!},'tax','guest','tax_payable')`;
      await tx`INSERT INTO tx_code_route(tenant_id,property_node,currency,tx_code,credit_account_id) VALUES(${tenant}::uuid,${property}::uuid,'INR',${roomCode},${revenueAccount}::uuid)`;
      for (const [index, code] of taxCodes.entries()) await tx`INSERT INTO tx_code_route(tenant_id,property_node,currency,tx_code,credit_account_id) VALUES(${tenant}::uuid,${property}::uuid,'INR',${code},${taxAccounts[index]!}::uuid)`;
      await tx`INSERT INTO tax_semantic_route(tenant_id,id,property_node,currency,jurisdiction_extension_id,jurisdiction_owner_tenant_id,jurisdiction_key,jurisdiction_version,jurisdiction_content_hash,semantic_kind,semantic_code,tx_code) VALUES(${tenant}::uuid,${revenueMapping}::uuid,${property}::uuid,'INR',${extension}::uuid,NULL,'in-gst-lodging',2,${extensionHash},'revenue','room_revenue',${roomCode})`;
      for (const [index, code] of taxCodes.entries()) await tx`INSERT INTO tax_semantic_route(tenant_id,id,property_node,currency,jurisdiction_extension_id,jurisdiction_owner_tenant_id,jurisdiction_key,jurisdiction_version,jurisdiction_content_hash,semantic_kind,semantic_code,tx_code) VALUES(${tenant}::uuid,${taxMappings[index]!}::uuid,${property}::uuid,'INR',${extension}::uuid,NULL,'in-gst-lodging',2,${extensionHash},'tax',${semantic[index]!},${code})`;
    });
    const journey = { tenant, property, actor, alternateActor, reservation, folio, tax,
      valuation, applicability, guestAccount, revenueAccount, taxAccounts, revenueMapping,
      taxMappings, roomCode, taxCodes, currentDay };
    seeded.push(journey);
    return journey;
  }

  function request(journey: Journey, key: string, actor = journey.actor) {
    return Object.freeze({ tenantId: journey.tenant, propertyNode: journey.property,
      reservationId: journey.reservation, idempotencyKey: key,
      envelope: createAuditEnvelope({ operation: "journal.posted", tenantId: journey.tenant,
        propertyNode: journey.property, actorId: actor, requestId: crypto.randomUUID() }) });
  }

  async function post(journey: Journey, key: string, using = service, actor = journey.actor) {
    return database.withTenantTransaction(journey.tenant, (tx) => using.post(tx, request(journey, key, actor)));
  }

  async function census(tenant: string): Promise<string> {
    const [row] = await deploy<Array<{ snapshot: unknown }>>`SELECT jsonb_build_object(
      'valuation',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.id,x.generation),'[]') FROM india_gst_accommodation_final_valuation x WHERE x.tenant_id=${tenant}::uuid),
      'applicability',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.id),'[]') FROM india_gst_accommodation_quoted_rate_applicability x WHERE x.tenant_id=${tenant}::uuid),
      'tax',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.id,x.generation),'[]') FROM india_gst_accommodation_final_component_tax x WHERE x.tenant_id=${tenant}::uuid),
      'nights',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.tax_id,x.ordinal),'[]') FROM india_gst_accommodation_final_component_tax_room_night x WHERE x.tenant_id=${tenant}::uuid),
      'components',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.tax_id,x.room_night_ordinal,x.component_ordinal),'[]') FROM india_gst_accommodation_final_component_tax_component x WHERE x.tenant_id=${tenant}::uuid),
      'semantic_routes',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.id),'[]') FROM tax_semantic_route x WHERE x.tenant_id=${tenant}::uuid),
      'tx_routes',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.tx_code),'[]') FROM tx_code_route x WHERE x.tenant_id=${tenant}::uuid),
      'accounts',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.id),'[]') FROM account x WHERE x.tenant_id=${tenant}::uuid),
      'folios',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.id),'[]') FROM folio x WHERE x.tenant_id=${tenant}::uuid),
      'days',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.property_node,x.business_date),'[]') FROM business_day x WHERE x.tenant_id=${tenant}::uuid),
      'journals',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.id),'[]') FROM journal x WHERE x.tenant_id=${tenant}::uuid),
      'lines',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.journal_id,x.seq),'[]') FROM posting_line x WHERE x.tenant_id=${tenant}::uuid),
      'bindings',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.id),'[]') FROM india_gst_accommodation_final_component_tax_journal_binding x WHERE x.tenant_id=${tenant}::uuid),
      'documents',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.id),'[]') FROM document x WHERE x.tenant_id=${tenant}::uuid),
      'submissions',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.id),'[]') FROM fiscal_submission x WHERE x.tenant_id=${tenant}::uuid),
      'facts',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.id),'[]') FROM fact_log x WHERE x.tenant_id=${tenant}::uuid),
      'outbox',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.seq),'[]') FROM outbox x WHERE x.tenant_id=${tenant}::uuid),
      'idempotency',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.operation,x.key_hash),'[]') FROM api_idempotency x WHERE x.tenant_id=${tenant}::uuid)
    ) snapshot`;
    return JSON.stringify(row!.snapshot);
  }

  async function rejectUnchanged(journey: Journey, label: string): Promise<void> {
    const before = await census(journey.tenant);
    await expect(post(journey, `o407-reject-${label}-${crypto.randomUUID()}`)).rejects.toThrow();
    expect(await census(journey.tenant), label).toBe(before);
  }

  beforeAll(async () => {
    await deploy.begin(async (tx) => {
      await tx`SET LOCAL session_replication_role=replica`;
      await tx`INSERT INTO extension(id,tenant_id,type,key,version,effective,content,status) VALUES(${extension}::uuid,NULL,'tax_jurisdiction','in-gst-lodging',2,'[2025-09-21 18:30:00+00,)'::tstzrange,'{}','active') ON CONFLICT DO NOTHING`;
    });
  });

  afterAll(async () => {
    await Promise.all([database.close(), runtimePool.close({ timeout: 0 }), deploy.close({ timeout: 0 })]);
  });

  test("posts real IGST and split-with-zero roots, replays and converges without cross-tenant visibility", async () => {
    const igst = await seedJourney("igst", [18000n]);
    const first = await post(igst, `o407-${crypto.randomUUID()}`);
    expect(first).toMatchObject({ created: true, replayed: false, taxId: igst.tax, lineCount: 3, grandTotalMinor: "118000" });
    const replayRequest = request(igst, `o407-replay-${crypto.randomUUID()}`);
    const created = await database.withTenantTransaction(igst.tenant, (tx) => service.post(tx, replayRequest));
    const replay = await database.withTenantTransaction(igst.tenant, (tx) => service.post(tx, replayRequest));
    expect(replay).toMatchObject({ journalId: created.journalId, replayed: true });
    const converged = await post(igst, `o407-converge-${crypto.randomUUID()}`);
    expect(converged.journalId).toBe(first.journalId);
    const [proof] = await deploy<Array<Record<string, unknown>>>`SELECT
      (SELECT sum(amount_minor)::text FROM posting_line WHERE tenant_id=${igst.tenant}::uuid AND journal_id=${first.journalId}::uuid) balance,
      (SELECT count(*)::int FROM posting_line WHERE tenant_id=${igst.tenant}::uuid AND journal_id=${first.journalId}::uuid) lines,
      (SELECT count(*)::int FROM posting_line WHERE tenant_id=${igst.tenant}::uuid AND journal_id=${first.journalId}::uuid AND tax_detail IS NOT NULL) detailed,
      (SELECT tax_detail->>'schemaVersion' FROM posting_line WHERE tenant_id=${igst.tenant}::uuid AND journal_id=${first.journalId}::uuid AND seq=1) schema,
      (SELECT count(*)::int FROM outbox WHERE tenant_id=${igst.tenant}::uuid AND aggregate_id IN (${first.journalId}::uuid,${first.postingBindingId}::uuid)) events,
      (SELECT count(*)::int FROM fact_log WHERE tenant_id=${igst.tenant}::uuid AND entity_id IN (${first.journalId}::uuid,${first.postingBindingId}::uuid)) facts`;
    expect(proof).toMatchObject({ balance: "0", lines: 3, detailed: 1,
      schema: "india_accommodation_component_tax_v1", events: 2, facts: 2 });
    const split = await seedJourney("cgst_sgst", [9000n, 0n]);
    const splitResult = await post(split, `o407-${crypto.randomUUID()}`);
    expect(splitResult).toMatchObject({ lineCount: 3, grandTotalMinor: "109000" });
    const [splitDetail] = await deploy<Array<{ components: unknown }>>`
      SELECT tax_detail->'components' components FROM posting_line
       WHERE tenant_id=${split.tenant}::uuid AND journal_id=${splitResult.journalId}::uuid AND seq=1`;
    expect(splitDetail?.components).toEqual([
      expect.objectContaining({ componentIdentity: "cgst", amountMinor: "9000" }),
      expect.objectContaining({ componentIdentity: "sgst", amountMinor: "0", route: null }),
    ]);
    const hidden = await database.withTenantTransaction(split.tenant, (tx) => tx<Array<{ count: number }>>`SELECT count(*)::int count FROM india_gst_accommodation_final_component_tax_journal_binding WHERE tenant_id=${igst.tenant}::uuid`);
    expect(hidden).toEqual([{ count: 0 }]);
  });

  test("posts 5/12/18 percent, CGST+UTGST, multi-night residuals and signed-int64 values exactly", async () => {
    const cases = [
      { family: "igst" as const, amounts: [5000n], rate: 500, total: "105000", lines: 3 },
      { family: "cgst_sgst" as const, amounts: [6000n, 6000n], rate: 1200, total: "112000", lines: 4 },
      { family: "cgst_utgst" as const, amounts: [9000n, 9000n], rate: 1800, total: "118000", lines: 4 },
    ];
    for (const item of cases) {
      const journey = await seedJourney(item.family, item.amounts, { rateBasisPoints: item.rate });
      const receipt = await post(journey, `o407-rate-${item.rate}-${crypto.randomUUID()}`);
      expect(receipt).toMatchObject({ grandTotalMinor: item.total, lineCount: item.lines });
      const [proof] = await deploy<Array<{ balance: string; components: unknown }>>`SELECT
        (SELECT sum(amount_minor)::text FROM posting_line WHERE tenant_id=${journey.tenant}::uuid AND journal_id=${receipt.journalId}::uuid) balance,
        (SELECT tax_detail->'components' FROM posting_line WHERE tenant_id=${journey.tenant}::uuid AND journal_id=${receipt.journalId}::uuid AND seq=1) components`;
      expect(proof!.balance).toBe("0");
      expect((proof!.components as unknown[]).length).toBe(item.amounts.length);
    }

    const residual = await seedJourney("cgst_sgst", [1n, 1n], {
      rateBasisPoints: 500,
      roomNights: [{ value: 33n, components: [1n, 0n] }, { value: 34n, components: [0n, 1n] }],
    });
    const residualReceipt = await post(residual, `o407-residual-${crypto.randomUUID()}`);
    expect(residualReceipt).toMatchObject({ grandTotalMinor: "69", lineCount: 4 });
    const [residualProof] = await deploy<Array<{ balance: string; amounts: string[] }>>`SELECT
      sum(amount_minor)::text balance,array_agg(amount_minor::text ORDER BY seq) amounts
      FROM posting_line WHERE tenant_id=${residual.tenant}::uuid AND journal_id=${residualReceipt.journalId}::uuid`;
    expect(residualProof).toEqual({ balance: "0", amounts: ["69", "-67", "-1", "-1"] });

    const maxValue = 8_000_000_000_000_000_000n;
    const boundary = await seedJourney("igst", [400_000_000_000_000_000n], { value: maxValue, rateBasisPoints: 500 });
    const boundaryReceipt = await post(boundary, `o407-int64-${crypto.randomUUID()}`);
    expect(boundaryReceipt.grandTotalMinor).toBe("8400000000000000000");
    const [boundaryBalance] = await deploy<Array<{ balance: string }>>`SELECT sum(amount_minor)::text balance FROM posting_line WHERE tenant_id=${boundary.tenant}::uuid AND journal_id=${boundaryReceipt.journalId}::uuid`;
    expect(boundaryBalance).toEqual({ balance: "0" });
  });

  test("simultaneous different keys converge on one durable tax-root posting", async () => {
    const journey = await seedJourney("cgst_utgst", [9000n, 9000n]);
    const receipts = await Promise.all(Array.from({ length: 12 }, (_, index) =>
      post(journey, `o407-race-${index}-${crypto.randomUUID()}`)));
    expect(new Set(receipts.map((receipt) => receipt.journalId)).size).toBe(1);
    expect(new Set(receipts.map((receipt) => receipt.postingBindingId)).size).toBe(1);
    const [counts] = await deploy<Array<{ journals: number; lines: number; bindings: number; facts: number; events: number; keys: number }>>`SELECT
      (SELECT count(*)::int FROM journal WHERE tenant_id=${journey.tenant}::uuid) journals,
      (SELECT count(*)::int FROM posting_line WHERE tenant_id=${journey.tenant}::uuid) lines,
      (SELECT count(*)::int FROM india_gst_accommodation_final_component_tax_journal_binding WHERE tenant_id=${journey.tenant}::uuid) bindings,
      (SELECT count(*)::int FROM fact_log WHERE tenant_id=${journey.tenant}::uuid) facts,
      (SELECT count(*)::int FROM outbox WHERE tenant_id=${journey.tenant}::uuid) events,
      (SELECT count(*)::int FROM api_idempotency WHERE tenant_id=${journey.tenant}::uuid) keys`;
    expect(counts).toEqual({ journals: 1, lines: 4, bindings: 1, facts: 2, events: 2, keys: 12 });
  });

  test("fails closed through the posting service for every hostile lineage, component and route class", async () => {
    async function hostile(label: string, mutate: (tx: SQL, journey: Journey) => Promise<void>): Promise<void> {
      const journey = await seedJourney("igst", [18000n]);
      await deploy.begin(async (tx) => {
        await tx`SET LOCAL session_replication_role=replica`;
        await mutate(tx, journey);
      });
      await rejectUnchanged(journey, label);
    }

    await hostile("superseded-tax", async (tx, j) => {
      const nextValuation = crypto.randomUUID(), nextTax = crypto.randomUUID();
      await tx`INSERT INTO india_gst_accommodation_final_valuation(
        tenant_id,id,property_node,reservation_id,folio_id,folio_account_id,window_no,buyer_party_id,
        attribution_id,request_id,generation,disposition,currency,transaction_value_minor,source_set_hash,
        order341_evidence_hash,request_hash,evidence_hash,ordinary_evidence_hashes,manual_reasons,
        relationship_conclusion,consideration_conclusion,section15_2_conclusion,section15_3_conclusion,
        source_completeness_conclusion,attestation_evidence_source,attestation_evidence_reference,
        relationship_set_hash,attested_by,supersedes_valuation_id,actor_id)
        SELECT tenant_id,${nextValuation}::uuid,property_node,reservation_id,folio_id,folio_account_id,
        window_no,buyer_party_id,attribution_id,gen_random_uuid(),generation+1,disposition,currency,
        transaction_value_minor,${"3".repeat(64)},order341_evidence_hash,${"4".repeat(64)},${"5".repeat(64)},
        ordinary_evidence_hashes,manual_reasons,relationship_conclusion,consideration_conclusion,
        section15_2_conclusion,section15_3_conclusion,source_completeness_conclusion,
        attestation_evidence_source,attestation_evidence_reference,${"6".repeat(64)},attested_by,id,actor_id
        FROM india_gst_accommodation_final_valuation WHERE id=${j.valuation}::uuid`;
      await tx`INSERT INTO india_gst_accommodation_final_component_tax(
        tenant_id,id,property_node,reservation_id,folio_id,applicability_id,valuation_id,
        valuation_generation,request_id,generation,currency,transaction_value_minor,tax_minor,
        grand_total_minor,component_family,selected_version_side,selected_extension_id,
        selected_extension_version,final_valuation_evidence_hash,quoted_rate_applicability_evidence_hash,
        section14_evidence_hash,levy_component_identity_evidence_hash,reservation_lineage_evidence_hash,
        attribution_snapshot_evidence_hash,evidence_hash,supersedes_tax_id,supersedes_tax_evidence_hash,actor_id)
        SELECT tenant_id,${nextTax}::uuid,property_node,reservation_id,folio_id,applicability_id,
        ${nextValuation}::uuid,valuation_generation+1,gen_random_uuid(),generation+1,currency,
        transaction_value_minor,tax_minor,grand_total_minor,component_family,selected_version_side,
        selected_extension_id,selected_extension_version,${"5".repeat(64)},
        quoted_rate_applicability_evidence_hash,section14_evidence_hash,
        levy_component_identity_evidence_hash,reservation_lineage_evidence_hash,
        attribution_snapshot_evidence_hash,${"7".repeat(64)},id,evidence_hash,actor_id
        FROM india_gst_accommodation_final_component_tax WHERE id=${j.tax}::uuid`;
    });
    await hostile("superseded-valuation", async (tx, j) => {
      await tx`INSERT INTO india_gst_accommodation_final_valuation(
        tenant_id,id,property_node,reservation_id,folio_id,folio_account_id,window_no,buyer_party_id,
        attribution_id,request_id,generation,disposition,currency,transaction_value_minor,source_set_hash,
        order341_evidence_hash,request_hash,evidence_hash,ordinary_evidence_hashes,manual_reasons,
        relationship_conclusion,consideration_conclusion,section15_2_conclusion,section15_3_conclusion,
        source_completeness_conclusion,attestation_evidence_source,attestation_evidence_reference,
        relationship_set_hash,attested_by,supersedes_valuation_id,actor_id)
        SELECT tenant_id,gen_random_uuid(),property_node,reservation_id,folio_id,folio_account_id,
        window_no,buyer_party_id,attribution_id,gen_random_uuid(),generation+1,disposition,currency,
        transaction_value_minor,${"8".repeat(64)},order341_evidence_hash,${"9".repeat(64)},${"a".repeat(64)},
        ordinary_evidence_hashes,manual_reasons,relationship_conclusion,consideration_conclusion,
        section15_2_conclusion,section15_3_conclusion,source_completeness_conclusion,
        attestation_evidence_source,attestation_evidence_reference,${"b".repeat(64)},attested_by,id,actor_id
        FROM india_gst_accommodation_final_valuation WHERE id=${j.valuation}::uuid`;
    });
    await hostile("foreign-tax", (tx, j) => tx`UPDATE india_gst_accommodation_final_component_tax SET tenant_id=${FOREIGN_TENANT}::uuid WHERE id=${j.tax}::uuid`);
    await hostile("tax-hash", (tx, j) => tx`UPDATE india_gst_accommodation_final_component_tax SET final_valuation_evidence_hash=${"0".repeat(64)} WHERE id=${j.tax}::uuid`);
    await hostile("valuation-hash", (tx, j) => tx`UPDATE india_gst_accommodation_final_valuation SET evidence_hash=${"0".repeat(64)} WHERE id=${j.valuation}::uuid`);
    await hostile("foreign-valuation", (tx, j) => tx`UPDATE india_gst_accommodation_final_valuation SET tenant_id=${FOREIGN_TENANT}::uuid WHERE id=${j.valuation}::uuid`);
    await hostile("applicability-hash", (tx, j) => tx`UPDATE india_gst_accommodation_quoted_rate_applicability SET evidence_hash=${"0".repeat(64)} WHERE id=${j.applicability}::uuid`);
    await hostile("foreign-applicability", (tx, j) => tx`UPDATE india_gst_accommodation_quoted_rate_applicability SET tenant_id=${FOREIGN_TENANT}::uuid WHERE id=${j.applicability}::uuid`);
    await hostile("missing-component", (tx, j) => tx`DELETE FROM india_gst_accommodation_final_component_tax_component WHERE tenant_id=${j.tenant}::uuid AND tax_id=${j.tax}::uuid`);
    await hostile("reordered-component", (tx, j) => tx`UPDATE india_gst_accommodation_final_component_tax_component SET component_ordinal=1 WHERE tenant_id=${j.tenant}::uuid AND tax_id=${j.tax}::uuid`);
    await hostile("malformed-component", (tx, j) => tx`UPDATE india_gst_accommodation_final_component_tax_component SET component_identity='cgst' WHERE tenant_id=${j.tenant}::uuid AND tax_id=${j.tax}::uuid`);
    await hostile("foreign-component", (tx, j) => tx`UPDATE india_gst_accommodation_final_component_tax_component SET tenant_id=${FOREIGN_TENANT}::uuid WHERE tax_id=${j.tax}::uuid`);
    await hostile("duplicate-component", async (tx, j) => {
      await tx`INSERT INTO india_gst_accommodation_final_component_tax_component(tenant_id,tax_id,room_night_ordinal,component_ordinal,component_identity,rate_basis_points,tax_amount_minor,currency) VALUES(${j.tenant}::uuid,${j.tax}::uuid,0,1,'cgst',900,18000,'INR')`;
    });
    await hostile("missing-route", (tx, j) => tx`DELETE FROM tax_semantic_route WHERE id=${j.taxMappings[0]!}::uuid`);
    await hostile("wrong-group", (tx, j) => tx`UPDATE tx_code SET grp='revenue' WHERE code=${j.taxCodes[0]!}`);
    await hostile("route-currency", (tx, j) => tx`UPDATE tax_semantic_route SET currency='USD' WHERE id=${j.taxMappings[0]!}::uuid`);
    await hostile("route-property", (tx, j) => tx`UPDATE tax_semantic_route SET property_node=${crypto.randomUUID()}::uuid WHERE id=${j.taxMappings[0]!}::uuid`);
    await hostile("route-owner", (tx, j) => tx`UPDATE tax_semantic_route SET jurisdiction_owner_tenant_id=${j.tenant}::uuid WHERE id=${j.taxMappings[0]!}::uuid`);
    await hostile("route-key", (tx, j) => tx`UPDATE tax_semantic_route SET jurisdiction_key='in-gst-lodging-hostile' WHERE id=${j.taxMappings[0]!}::uuid`);
    await hostile("route-version", (tx, j) => tx`UPDATE tax_semantic_route SET jurisdiction_version=1 WHERE id=${j.taxMappings[0]!}::uuid`);
    await hostile("route-hash", (tx, j) => tx`UPDATE tax_semantic_route SET jurisdiction_content_hash=${"0".repeat(64)} WHERE id=${j.taxMappings[0]!}::uuid`);
    await hostile("closed-folio", (tx, j) => tx`UPDATE folio SET status='closed' WHERE id=${j.folio}::uuid`);
    await hostile("closed-guest-account", (tx, j) => tx`UPDATE account SET status='closed' WHERE id=${j.guestAccount}::uuid`);
    await hostile("closed-revenue-account", (tx, j) => tx`UPDATE account SET status='closed' WHERE id=${j.revenueAccount}::uuid`);
    await hostile("closed-tax-account", (tx, j) => tx`UPDATE account SET status='closed' WHERE id=${j.taxAccounts[0]!}::uuid`);
    await hostile("sealed-day", (tx, j) => tx`UPDATE business_day SET sealed_at=transaction_timestamp() WHERE tenant_id=${j.tenant}::uuid AND property_node=${j.property}::uuid`);
  });

  test("database constraints reject fork and duplicate evidence without effects", async () => {
    const journey = await seedJourney("igst", [18000n]);
    for (const [label, statement, expectedState] of [
      ["forked tax", `INSERT INTO india_gst_accommodation_final_component_tax SELECT tenant_id,gen_random_uuid(),property_node,reservation_id,folio_id,applicability_id,valuation_id,valuation_generation,gen_random_uuid(),generation,currency,transaction_value_minor,tax_minor,grand_total_minor,component_family,selected_version_side,selected_extension_id,selected_extension_version,final_valuation_evidence_hash,quoted_rate_applicability_evidence_hash,section14_evidence_hash,levy_component_identity_evidence_hash,reservation_lineage_evidence_hash,attribution_snapshot_evidence_hash,repeat('a',64),supersedes_tax_id,supersedes_tax_evidence_hash,actor_id,recorded_at FROM india_gst_accommodation_final_component_tax WHERE id='${journey.tax}'::uuid`, "23505"],
      ["duplicate route", `INSERT INTO tax_semantic_route SELECT tenant_id,gen_random_uuid(),property_node,currency,jurisdiction_extension_id,jurisdiction_owner_tenant_id,jurisdiction_key,jurisdiction_version,jurisdiction_content_hash,semantic_kind,semantic_code,tx_code FROM tax_semantic_route WHERE id='${journey.taxMappings[0]}'::uuid`, "23505"],
      ["duplicate child", `INSERT INTO india_gst_accommodation_final_component_tax_component SELECT * FROM india_gst_accommodation_final_component_tax_component WHERE tenant_id='${journey.tenant}'::uuid AND tax_id='${journey.tax}'::uuid`, "23505"],
      ["duplicate valuation", `INSERT INTO india_gst_accommodation_final_valuation SELECT * FROM india_gst_accommodation_final_valuation WHERE id='${journey.valuation}'::uuid`, "23505"],
      ["duplicate applicability", `INSERT INTO india_gst_accommodation_quoted_rate_applicability SELECT * FROM india_gst_accommodation_quoted_rate_applicability WHERE id='${journey.applicability}'::uuid`, "23505"],
    ] as const) {
      const before = await census(journey.tenant);
      let error: unknown;
      try { await deploy.unsafe(statement); } catch (caught) { error = caught; }
      expect(sqlState(error), label).toBe(expectedState);
      expect(await census(journey.tenant), label).toBe(before);
    }
  });

  test("post-resolve folio, account, route, tax and day drift is rejected after ordered lock barriers", async () => {
    const pause = () => new Promise<void>((resolve) => setTimeout(resolve, 250));
    async function barrierCase(
      label: string,
      lock: (tx: SQL, journey: Journey) => Promise<void>,
      mutate: (tx: SQL, journey: Journey) => Promise<void>,
    ): Promise<void> {
      const journey = await seedJourney("igst", [18000n]);
      const before = await census(journey.tenant);
      let release!: () => void;
      let announce!: () => void;
      const released = new Promise<void>((resolve) => { release = resolve; });
      const announced = new Promise<void>((resolve) => { announce = resolve; });
      const blocker = deploy.begin(async (tx) => {
        await lock(tx, journey);
        announce();
        await released;
        await tx`SET LOCAL session_replication_role=replica`;
        await mutate(tx, journey);
      });
      await announced;
      const attempt = post(journey, `o407-after-lock-${label}-${crypto.randomUUID()}`);
      await pause();
      release();
      await blocker;
      await expect(attempt).rejects.toThrow();
      const after = await census(journey.tenant);
      // The hostile fixture mutation is the only permitted delta: prove all posting
      // artifacts remain absent even though the authoritative row changed mid-call.
      const [effects] = await deploy<Array<{ journals: number; lines: number; bindings: number; facts: number; events: number; keys: number; documents: number; submissions: number }>>`SELECT
        (SELECT count(*)::int FROM journal WHERE tenant_id=${journey.tenant}::uuid) journals,
        (SELECT count(*)::int FROM posting_line WHERE tenant_id=${journey.tenant}::uuid) lines,
        (SELECT count(*)::int FROM india_gst_accommodation_final_component_tax_journal_binding WHERE tenant_id=${journey.tenant}::uuid) bindings,
        (SELECT count(*)::int FROM fact_log WHERE tenant_id=${journey.tenant}::uuid) facts,
        (SELECT count(*)::int FROM outbox WHERE tenant_id=${journey.tenant}::uuid) events,
        (SELECT count(*)::int FROM api_idempotency WHERE tenant_id=${journey.tenant}::uuid) keys,
        (SELECT count(*)::int FROM document WHERE tenant_id=${journey.tenant}::uuid) documents,
        (SELECT count(*)::int FROM fiscal_submission WHERE tenant_id=${journey.tenant}::uuid) submissions`;
      expect(effects, `${label}:${before.length}:${after.length}`).toEqual({ journals: 0, lines: 0, bindings: 0, facts: 0, events: 0, keys: 0, documents: 0, submissions: 0 });
    }

    await barrierCase("folio", (tx, j) => tx`SELECT id FROM folio WHERE id=${j.folio}::uuid FOR UPDATE`, (tx, j) => tx`UPDATE folio SET status='closed' WHERE id=${j.folio}::uuid`);
    await barrierCase("guest-account", (tx, j) => tx`SELECT id FROM account WHERE id=${j.guestAccount}::uuid FOR UPDATE`, (tx, j) => tx`UPDATE account SET status='closed' WHERE id=${j.guestAccount}::uuid`);
    await barrierCase("route", (tx, j) => tx`SELECT id FROM account WHERE id=${j.taxAccounts[0]!}::uuid FOR UPDATE`, (tx, j) => tx`UPDATE tax_semantic_route SET jurisdiction_version=1 WHERE id=${j.taxMappings[0]!}::uuid`);
    await barrierCase("tax", (tx, j) => tx`SELECT id FROM account WHERE id=${j.taxAccounts[0]!}::uuid FOR UPDATE`, (tx, j) => tx`UPDATE india_gst_accommodation_final_component_tax SET evidence_hash=${"0".repeat(64)} WHERE id=${j.tax}::uuid`);
    await barrierCase("business-day", (tx, j) => tx`SELECT business_date FROM business_day WHERE tenant_id=${j.tenant}::uuid AND property_node=${j.property}::uuid FOR UPDATE`, (tx, j) => tx`UPDATE business_day SET sealed_at=transaction_timestamp() WHERE tenant_id=${j.tenant}::uuid AND property_node=${j.property}::uuid`);
  });

  test("changed idempotency reuse and injected publication failure leave no partial posting", async () => {
    const changed = await seedJourney("igst", [18000n]);
    const key = `o407-changed-${crypto.randomUUID()}`;
    await post(changed, key);
    await expect(post(changed, key, service, changed.alternateActor)).rejects.toThrow();
    const failed = await seedJourney("igst", [18000n]);
    const failing = new IndiaFinalComponentTaxPostingService({ events: new FailSecondPublish(events), idempotency: new PostgresIdempotency() });
    const beforeFailure = await census(failed.tenant);
    await expect(post(failed, `o407-fail-${crypto.randomUUID()}`, failing)).rejects.toThrow("injected");
    expect(await census(failed.tenant)).toBe(beforeFailure);
  });
});
