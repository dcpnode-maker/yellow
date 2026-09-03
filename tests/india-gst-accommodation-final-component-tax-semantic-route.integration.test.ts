import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";
import {
  IndiaGstAccommodationFinalComponentTaxSemanticRouteConflictError,
  IndiaGstAccommodationFinalComponentTaxSemanticRouteNotFoundError,
  IndiaGstAccommodationFinalComponentTaxSemanticRouteService,
} from "../src/contexts/tax-fiscal";
import { Database, type Tx } from "../src/kernel";

const id = (suffix: number): string =>
  `00000000-0000-0000-0000-${String(suffix).padStart(12, "0")}`;
const H = (character: string): string => character.repeat(64);

const TENANT = id(406001);
const PROPERTY = id(406002);
const RESERVATION = id(406003);
const FOLIO = id(406004);

type Row = Readonly<Record<string, unknown>>;

function exactInput() {
  return Object.freeze({
    tenantId: TENANT,
    propertyNode: PROPERTY,
    reservationId: RESERVATION,
    folioId: FOLIO,
  });
}

function root(overrides: Row = {}): Row {
  return {
    tax_id: id(406010), generation: 0, valuation_id: id(406011),
    valuation_generation: 0, applicability_id: id(406012), currency: "INR",
    transaction_value_minor: "100001", tax_minor: "18000",
    grand_total_minor: "118001", component_family: "igst",
    selected_extension_id: id(406013), selected_extension_version: 2,
    selected_extension_owner_tenant_id: null, selected_extension_key: "in-gst-lodging",
    selected_extension_content_hash: H("a"), evidence_hash: H("b"),
    final_valuation_evidence_hash: H("c"),
    quoted_rate_applicability_evidence_hash: H("d"),
    ...overrides,
  };
}

function component(identity: "igst" | "cgst" | "sgst" | "utgst",
  amount: string, ordinal = 0, summary: Row = {}): Row {
  return {
    component_identity: identity, tax_amount_minor: amount,
    first_ordinal: ordinal, component_count: 1,
    night_count: 1, first_night_ordinal: 0, last_night_ordinal: 0,
    night_value_total: "100001", night_tax_total: "18000",
    ...summary,
  };
}

function route(kind: "revenue" | "tax", code: string, ordinal: number): Row {
  const role = kind === "revenue" ? "revenue" : "tax_payable";
  return {
    mapping_id: id(406100 + ordinal), semantic_kind: kind, semantic_code: code,
    tx_code: `O406_${code.toUpperCase()}`, route_credit_account_id: id(406200 + ordinal),
    tx_code_value: `O406_${code.toUpperCase()}`,
    tx_code_group: kind === "revenue" ? "revenue" : "tax",
    usali_line: kind === "revenue" ? "Rooms" : null,
    account_id: id(406200 + ordinal), account_property_node: PROPERTY,
    account_role: role, account_currency: "INR", account_status: "open",
  };
}

function scriptedTx(options: {
  roots?: readonly Row[];
  components?: readonly Row[];
  routes?: readonly Row[];
}) {
  const writes: string[] = [];
  const tx = (async (strings: TemplateStringsArray) => {
    const sql = strings.join(" ").replace(/\s+/g, " ").toLowerCase();
    if (/\b(insert|update|delete|merge|call)\b/.test(sql)) writes.push(sql);
    if (sql.includes("tax_semantic_route")) return options.routes ?? [];
    if (sql.includes("final_component_tax_component")) return options.components ?? [];
    if (sql.includes("final_component_tax")) return options.roots ?? [];
    throw new Error(`unexpected Order406 query: ${sql}`);
  }) as Tx;
  return { tx, writes };
}

function expectDeepFrozen(value: unknown, seen = new Set<object>()): void {
  if (value === null || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBeTrue();
  for (const key of Reflect.ownKeys(value)) {
    expectDeepFrozen((value as Record<PropertyKey, unknown>)[key], seen);
  }
}

describe("Order 406 persisted India component-tax semantic route", () => {
  test("rejects malformed or mutable selectors before querying", async () => {
    const service = new IndiaGstAccommodationFinalComponentTaxSemanticRouteService();
    const candidates = [
      { ...exactInput(), taxMinor: "1" },
      { ...exactInput(), tenantId: "not-a-uuid" },
      { ...exactInput(), folioId: undefined },
      exactInput(),
    ];
    for (const [index, candidate] of candidates.entries()) {
      let queried = false;
      const tx = (async () => { queried = true; return []; }) as unknown as Tx;
      if (index === candidates.length - 1) {
        const mutable = { ...candidate };
        await expect(service.resolve(tx, mutable as never)).rejects.toBeInstanceOf(Error);
      } else {
        await expect(service.resolve(tx, Object.freeze(candidate) as never))
          .rejects.toBeInstanceOf(Error);
      }
      expect(queried).toBeFalse();
    }
  });

  test("resolves room revenue and persisted IGST without recalculation", async () => {
    const fixture = scriptedTx({
      roots: [root()], components: [component("igst", "18000")],
      routes: [route("revenue", "room_revenue", 1), route("tax", "IGST", 2)],
    });
    const result = await new IndiaGstAccommodationFinalComponentTaxSemanticRouteService()
      .resolve(fixture.tx, exactInput());
    expect(JSON.stringify(result)).toContain('"transactionValueMinor":"100001"');
    expect(JSON.stringify(result)).toContain('"taxMinor":"18000"');
    expect(JSON.stringify(result)).toContain('"componentIdentity":"igst"');
    expect(JSON.stringify(result)).toContain('"semanticCode":"room_revenue"');
    expect(fixture.writes).toEqual([]);
    expectDeepFrozen(result);
  });

  test("retains zero-rounded statutory lineage without requiring its payable route", async () => {
    const fixture = scriptedTx({
      roots: [root({ component_family: "cgst_sgst", tax_minor: "1", grand_total_minor: "100002" })],
      components: [
        component("cgst", "1", 0, { night_tax_total: "1" }),
        component("sgst", "0", 1, { night_tax_total: "1" }),
      ],
      routes: [route("revenue", "room_revenue", 1), route("tax", "CGST", 2)],
    });
    const result = await new IndiaGstAccommodationFinalComponentTaxSemanticRouteService()
      .resolve(fixture.tx, exactInput());
    const json = JSON.stringify(result);
    expect(json).toContain('"componentIdentity":"cgst"');
    expect(json).toContain('"componentIdentity":"sgst"');
    expect(json).toContain('"amountMinor":"0"');
    expect(json).not.toContain("O406_SGST");
    expect(fixture.writes).toEqual([]);
  });

  test("aggregates multi-night CGST+UTGST persisted amounts and replays byte-equally", async () => {
    const options = {
      roots: [root({ component_family: "cgst_utgst", tax_minor: "24000", grand_total_minor: "124001" })],
      components: [
        component("cgst", "12000", 0, {
          component_count: 2, night_count: 2, last_night_ordinal: 1,
          night_value_total: "100001", night_tax_total: "24000",
        }),
        component("utgst", "12000", 1, {
          component_count: 2, night_count: 2, last_night_ordinal: 1,
          night_value_total: "100001", night_tax_total: "24000",
        }),
      ],
      routes: [
        route("revenue", "room_revenue", 1), route("tax", "CGST", 2),
        route("tax", "UTGST", 3),
      ],
    };
    const firstFixture = scriptedTx(options);
    const secondFixture = scriptedTx(options);
    const service = new IndiaGstAccommodationFinalComponentTaxSemanticRouteService();
    const first = await service.resolve(firstFixture.tx, exactInput());
    const second = await service.resolve(secondFixture.tx, exactInput());
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    expect(second).not.toBe(first);
    expect(firstFixture.writes).toEqual([]);
    expect(secondFixture.writes).toEqual([]);
  });

  test("preserves persisted 5/12/18-percent and signed-bigint-boundary amounts", async () => {
    const amounts = ["5000", "12000", "18000"] as const;
    for (const amount of amounts) {
      const fixture = scriptedTx({
        roots: [root({ tax_minor: amount,
          grand_total_minor: (100001n + BigInt(amount)).toString() })],
        components: [component("igst", amount, 0, { night_tax_total: amount })],
        routes: [route("revenue", "room_revenue", 1), route("tax", "IGST", 2)],
      });
      const result = await new IndiaGstAccommodationFinalComponentTaxSemanticRouteService()
        .resolve(fixture.tx, exactInput());
      expect(result.taxMinor).toBe(amount);
      expect(result.components[0]?.amountMinor).toBe(amount);
    }

    const maximum = "9223372036854775807";
    const boundary = scriptedTx({
      roots: [root({ transaction_value_minor: "9223372036854775806",
        tax_minor: "1", grand_total_minor: maximum })],
      components: [component("igst", "1", 0, {
        night_value_total: "9223372036854775806", night_tax_total: "1",
      })],
      routes: [route("revenue", "room_revenue", 1), route("tax", "IGST", 2)],
    });
    const result = await new IndiaGstAccommodationFinalComponentTaxSemanticRouteService()
      .resolve(boundary.tx, exactInput());
    expect(result.grandTotalMinor).toBe(maximum);
    expect(boundary.writes).toEqual([]);
  });

  test("fails closed on missing, duplicate, stale and incoherent persisted evidence", async () => {
    const service = new IndiaGstAccommodationFinalComponentTaxSemanticRouteService();
    const cases: readonly [
      ReturnType<typeof scriptedTx>,
      new (message: string) => Error,
    ][] = [
      [scriptedTx({ roots: [] }), IndiaGstAccommodationFinalComponentTaxSemanticRouteNotFoundError],
      [scriptedTx({ roots: [root(), root({ tax_id: id(406099) })] }),
        IndiaGstAccommodationFinalComponentTaxSemanticRouteConflictError],
      [scriptedTx({ roots: [root({ currency: "USD" })] }),
        IndiaGstAccommodationFinalComponentTaxSemanticRouteConflictError],
      [scriptedTx({ roots: [root()], components: [component("igst", "17999")], routes: [] }),
        IndiaGstAccommodationFinalComponentTaxSemanticRouteConflictError],
      [scriptedTx({ roots: [root()], components: [component("igst", "18000")], routes: [] }),
        IndiaGstAccommodationFinalComponentTaxSemanticRouteNotFoundError],
    ];
    for (const [fixture, error] of cases) {
      await expect(service.resolve(fixture.tx, exactInput())).rejects.toBeInstanceOf(error);
      expect(fixture.writes).toEqual([]);
    }
  });

  test("production source is read-only and binds exact persisted/configured authorities", async () => {
    const source = await Bun.file(new URL(
      "../src/contexts/tax-fiscal/india-gst-accommodation-final-component-tax-semantic-route.ts",
      import.meta.url,
    )).text();
    expect(source).toContain("india_gst_accommodation_final_component_tax");
    expect(source).toContain("india_gst_accommodation_final_component_tax_component");
    expect(source).toContain("tax_semantic_route");
    expect(source).toContain("tx_code_route");
    expect(source).toContain("account");
    expect(source).toMatch(/current_setting\('app\.tenant_id',\s*true\)/);
    expect(source).toMatch(/supersedes_(?:tax|valuation)_id/);
    expect(source).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|MERGE)\b/i);
    expect(source).not.toMatch(/new\s+Date|Date\.now|Math\.(?:round|floor|ceil)/);
  });
});

const deployUrl = process.env.YELLOW_ORDER406_DATABASE_URL;
const runtimeUrl = process.env.YELLOW_ORDER406_RUNTIME_DATABASE_URL;
if (process.env.YELLOW_REQUIRE_ORDER406_DATABASE === "1" && (!deployUrl || !runtimeUrl)) {
  throw new Error("Order406 PostgreSQL proof requires deploy and runtime database URLs");
}
const databaseDescribe = deployUrl && runtimeUrl ? describe.serial : describe.skip;
const LIVE_TENANT = id(406801);
const LIVE_PROPERTY = id(406802);
const LIVE_RESERVATION = id(406803);
const LIVE_FOLIO = id(406804);
const LIVE_VALUATION = id(406805);
const LIVE_APPLICABILITY = id(406806);
const LIVE_TAX = id(406807);
const LIVE_EXTENSION = "0b21daf2-ea6e-5568-9c21-69e4d4424574";
const LIVE_ACTOR = id(406809);
const LIVE_VALUATION_HASH = "c".repeat(64);
const LIVE_APPLICABILITY_HASH = "d".repeat(64);
const LIVE_TAX_HASH = "b".repeat(64);
const LIVE_EXTENSION_HASH = "eb323eff707aad1e460b425c87b448d4e924d2eb17499094abad71b33c69a820";

databaseDescribe("Order406 real PostgreSQL/RLS proof", () => {
  const deploy = new SQL(deployUrl!, { max: 1, prepare: false });
  const database = Database.connect(runtimeUrl!, { maxConnections: 4, prepare: false });
  const service = new IndiaGstAccommodationFinalComponentTaxSemanticRouteService();

  async function fixtureMutation(statements: (tx: SQL) => Promise<void>): Promise<void> {
    await deploy.begin(async (tx) => {
      await tx`SET LOCAL session_replication_role = replica`;
      await statements(tx as SQL);
    });
  }

  async function cleanup(): Promise<void> {
    await fixtureMutation(async (tx) => {
      await tx`DELETE FROM tax_semantic_route WHERE tenant_id=${LIVE_TENANT}::uuid`;
      await tx`DELETE FROM tx_code_route WHERE tenant_id=${LIVE_TENANT}::uuid`;
      await tx`DELETE FROM account WHERE tenant_id=${LIVE_TENANT}::uuid`;
      await tx`DELETE FROM india_gst_accommodation_final_component_tax_component WHERE tenant_id=${LIVE_TENANT}::uuid`;
      await tx`DELETE FROM india_gst_accommodation_final_component_tax_room_night WHERE tenant_id=${LIVE_TENANT}::uuid`;
      await tx`DELETE FROM india_gst_accommodation_final_component_tax WHERE tenant_id=${LIVE_TENANT}::uuid`;
      await tx`DELETE FROM india_gst_accommodation_quoted_rate_applicability WHERE tenant_id=${LIVE_TENANT}::uuid`;
      await tx`DELETE FROM india_gst_accommodation_final_valuation WHERE tenant_id=${LIVE_TENANT}::uuid`;
      await tx`DELETE FROM extension WHERE id=${LIVE_EXTENSION}::uuid`;
      await tx`DELETE FROM tx_code WHERE code IN ('O406_LIVE_ROOM','O406_LIVE_IGST')`;
    });
  }

  beforeAll(async () => {
    await cleanup();
    await fixtureMutation(async (tx) => {
      await tx`INSERT INTO extension(id,tenant_id,type,key,version,effective,content,status)
        VALUES(${LIVE_EXTENSION}::uuid,NULL,'tax_jurisdiction','in-gst-lodging',2,
          '[2025-09-21 18:30:00+00,)'::tstzrange,
          '{"country":"IN","price_display":"tax_exclusive","rounding":"document","taxes":[{"code":"GST_ROOM","name":"GST on accommodation","mode":"slab_percent","slab_basis":"transaction_value","applies_to":["room_revenue"],"slabs":[{"upto_minor":750000,"rate":0.05,"itc_eligible":false},{"upto_minor":null,"rate":0.18,"itc_eligible":true}]},{"code":"GST_FNB","name":"GST on F&B (restaurant in hotel)","mode":"percent","rate":0.05,"applies_to":["fnb_revenue"]}]}'::jsonb,
          'active')`;
      await tx`INSERT INTO india_gst_accommodation_final_valuation(
        tenant_id,id,property_node,reservation_id,folio_id,folio_account_id,window_no,
        buyer_party_id,attribution_id,request_id,generation,disposition,currency,
        transaction_value_minor,source_set_hash,order341_evidence_hash,request_hash,
        evidence_hash,ordinary_evidence_hashes,manual_reasons,relationship_conclusion,
        consideration_conclusion,section15_2_conclusion,section15_3_conclusion,
        source_completeness_conclusion,attestation_evidence_source,
        attestation_evidence_reference,relationship_set_hash,attested_by,actor_id)
        VALUES(${LIVE_TENANT}::uuid,${LIVE_VALUATION}::uuid,${LIVE_PROPERTY}::uuid,
          ${LIVE_RESERVATION}::uuid,${LIVE_FOLIO}::uuid,${id(406810)}::uuid,1,
          ${id(406811)}::uuid,${id(406812)}::uuid,${id(406813)}::uuid,0,'ordinary_final','INR',
          100001,${H("1")},${LIVE_APPLICABILITY_HASH},${H("2")},${LIVE_VALUATION_HASH},
          ARRAY[${H("3")},${H("4")},${H("5")},${H("6")},${H("7")}],ARRAY[]::text[],
          'unrelated_not_distinct','money_only','all_additions_enumerated',
          'all_discounts_eligible','all_sources_classified','order406.fixture','live',
          ${H("8")},${LIVE_ACTOR}::uuid,${LIVE_ACTOR}::uuid)`;
      await tx`INSERT INTO india_gst_accommodation_quoted_rate_applicability(
        tenant_id,id,property_node,reservation_id,folio_id,reservation_lineage_id,
        attribution_id,service_provision_snapshot_id,payment_receipt_snapshot_id,
        invoice_issue_snapshot_id,family_jurisdiction_extension_id,classification_id,
        supplier_service_location_id,supplier_sez_status_id,recipient_sez_status_id,
        recipient_party_id,final_valuation_id,request_id,section14_case,
        service_provision_date,invoice_issue_date,payment_receipt_date,rate_change_date,
        time_of_supply_date,selected_version_side,selected_extension_id,
        selected_extension_version,selected_extension_status,selected_content_hash,
        selected_effective_from,component_family,section14_evidence_hash,
        levy_component_identity_evidence_hash,reservation_lineage_evidence_hash,
        attribution_snapshot_evidence_hash,evidence_hash,actor_id)
        VALUES(${LIVE_TENANT}::uuid,${LIVE_APPLICABILITY}::uuid,${LIVE_PROPERTY}::uuid,
          ${LIVE_RESERVATION}::uuid,${LIVE_FOLIO}::uuid,${id(406820)}::uuid,${id(406821)}::uuid,
          ${id(406822)}::uuid,${id(406823)}::uuid,${id(406824)}::uuid,${LIVE_EXTENSION}::uuid,
          ${id(406825)}::uuid,${id(406826)}::uuid,${id(406827)}::uuid,${id(406828)}::uuid,
          ${id(406829)}::uuid,${LIVE_VALUATION}::uuid,${id(406830)}::uuid,
          'supply_invoice_before_payment_after','2035-01-01','2035-01-01','2035-01-02',
          '2025-09-22','2035-01-01','successor',${LIVE_EXTENSION}::uuid,2,'active',
          ${LIVE_EXTENSION_HASH},
          '2025-09-21 18:30:00+00','igst',${H("9")},${H("a")},
          ${H("e")},${H("f")},${LIVE_APPLICABILITY_HASH},${LIVE_ACTOR}::uuid)`;
      await tx`INSERT INTO india_gst_accommodation_final_component_tax(
        tenant_id,id,property_node,reservation_id,folio_id,applicability_id,valuation_id,
        valuation_generation,request_id,generation,currency,transaction_value_minor,tax_minor,
        grand_total_minor,component_family,selected_version_side,selected_extension_id,
        selected_extension_version,final_valuation_evidence_hash,
        quoted_rate_applicability_evidence_hash,section14_evidence_hash,
        levy_component_identity_evidence_hash,reservation_lineage_evidence_hash,
        attribution_snapshot_evidence_hash,evidence_hash,actor_id)
        VALUES(${LIVE_TENANT}::uuid,${LIVE_TAX}::uuid,${LIVE_PROPERTY}::uuid,
          ${LIVE_RESERVATION}::uuid,${LIVE_FOLIO}::uuid,${LIVE_APPLICABILITY}::uuid,
          ${LIVE_VALUATION}::uuid,0,${id(406840)}::uuid,0,'INR',100001,18000,118001,
          'igst','successor',${LIVE_EXTENSION}::uuid,2,${LIVE_VALUATION_HASH},
          ${LIVE_APPLICABILITY_HASH},${H("9")},${H("a")},${H("e")},${H("f")},
          ${LIVE_TAX_HASH},${LIVE_ACTOR}::uuid)`;
      await tx`INSERT INTO india_gst_accommodation_final_component_tax_room_night(
        tenant_id,tax_id,ordinal,business_date,final_value_minor,currency,slab_upto_minor,
        aggregate_rate_basis_points,itc_eligible,tax_minor)
        VALUES(${LIVE_TENANT}::uuid,${LIVE_TAX}::uuid,0,'2035-01-01',100001,'INR',NULL,1800,true,18000)`;
      await tx`INSERT INTO india_gst_accommodation_final_component_tax_component(
        tenant_id,tax_id,room_night_ordinal,component_ordinal,component_identity,
        rate_basis_points,tax_amount_minor,currency)
        VALUES(${LIVE_TENANT}::uuid,${LIVE_TAX}::uuid,0,0,'igst',1800,18000,'INR')`;
      await tx`INSERT INTO account(id,tenant_id,property_node,role,name,currency,status) VALUES
        (${id(406850)}::uuid,${LIVE_TENANT}::uuid,${LIVE_PROPERTY}::uuid,'revenue','Order406 room','INR','open'),
        (${id(406851)}::uuid,${LIVE_TENANT}::uuid,${LIVE_PROPERTY}::uuid,'tax_payable','Order406 IGST','INR','open')`;
      await tx`INSERT INTO tx_code(code,name,grp,usali_line,default_dr,default_cr) VALUES
        ('O406_LIVE_ROOM','Order406 room','revenue','Rooms','guest','revenue'),
        ('O406_LIVE_IGST','Order406 IGST','tax',NULL,'guest','tax_payable')`;
      await tx`INSERT INTO tx_code_route(tenant_id,property_node,currency,tx_code,credit_account_id) VALUES
        (${LIVE_TENANT}::uuid,${LIVE_PROPERTY}::uuid,'INR','O406_LIVE_ROOM',${id(406850)}::uuid),
        (${LIVE_TENANT}::uuid,${LIVE_PROPERTY}::uuid,'INR','O406_LIVE_IGST',${id(406851)}::uuid)`;
      await tx`INSERT INTO tax_semantic_route(tenant_id,id,property_node,currency,
        jurisdiction_extension_id,jurisdiction_owner_tenant_id,jurisdiction_key,
        jurisdiction_version,jurisdiction_content_hash,semantic_kind,semantic_code,tx_code) VALUES
        (${LIVE_TENANT}::uuid,${id(406860)}::uuid,${LIVE_PROPERTY}::uuid,'INR',${LIVE_EXTENSION}::uuid,
          NULL,'in-gst-lodging',2,${LIVE_EXTENSION_HASH},
          'revenue','room_revenue','O406_LIVE_ROOM'),
        (${LIVE_TENANT}::uuid,${id(406861)}::uuid,${LIVE_PROPERTY}::uuid,'INR',${LIVE_EXTENSION}::uuid,
          NULL,'in-gst-lodging',2,${LIVE_EXTENSION_HASH},
          'tax','IGST','O406_LIVE_IGST')`;
    });
  });

  afterAll(async () => {
    await cleanup();
    await database.close();
    await deploy.close({ timeout: 0 });
  });

  const liveInput = Object.freeze({
    tenantId: LIVE_TENANT, propertyNode: LIVE_PROPERTY,
    reservationId: LIVE_RESERVATION, folioId: LIVE_FOLIO,
  });

  async function census(): Promise<Record<string, number>> {
    const [row] = await deploy<Array<Record<string, number>>>`SELECT
      (SELECT count(*)::int FROM journal WHERE tenant_id=${LIVE_TENANT}::uuid) journals,
      (SELECT count(*)::int FROM posting_line WHERE tenant_id=${LIVE_TENANT}::uuid) postings,
      (SELECT count(*)::int FROM posting_line WHERE tenant_id=${LIVE_TENANT}::uuid
        AND tax_detail IS NOT NULL) tax_details,
      (SELECT count(*)::int FROM document WHERE tenant_id=${LIVE_TENANT}::uuid) documents,
      (SELECT count(*)::int FROM fiscal_submission WHERE tenant_id=${LIVE_TENANT}::uuid) submissions,
      (SELECT count(*)::int FROM fact_log WHERE tenant_id=${LIVE_TENANT}::uuid) facts,
      (SELECT count(*)::int FROM outbox WHERE tenant_id=${LIVE_TENANT}::uuid) events,
      (SELECT count(*)::int FROM api_idempotency WHERE tenant_id=${LIVE_TENANT}::uuid) idempotency`;
    return row!;
  }

  test("executes Order259/367 joins under tenant RLS and performs zero writes", async () => {
    const before = await census();
    const [visible] = await database.withTenantTransaction(LIVE_TENANT, (tx) => tx<Array<{
      taxes: number; valuations: number; applicability: number; components: number;
      routes: number; global_extensions: number;
    }>>`SELECT
      (SELECT count(*)::int FROM india_gst_accommodation_final_component_tax WHERE id=${LIVE_TAX}::uuid) taxes,
      (SELECT count(*)::int FROM india_gst_accommodation_final_valuation WHERE id=${LIVE_VALUATION}::uuid) valuations,
      (SELECT count(*)::int FROM india_gst_accommodation_quoted_rate_applicability WHERE id=${LIVE_APPLICABILITY}::uuid) applicability,
      (SELECT count(*)::int FROM india_gst_accommodation_final_component_tax_component WHERE tax_id=${LIVE_TAX}::uuid) components,
      (SELECT count(*)::int FROM tax_semantic_route WHERE tenant_id=${LIVE_TENANT}::uuid) routes,
      (SELECT count(*)::int FROM extension WHERE id=${LIVE_EXTENSION}::uuid) global_extensions`);
    expect(visible).toEqual({
      taxes: 1, valuations: 1, applicability: 1, components: 1, routes: 2,
      global_extensions: 0,
    });
    const [globalExtension] = await deploy<Array<{
      owner_is_global: boolean; key: string; version: number; status: string;
      content_shape: boolean; selected_content_hash: string;
    }>>`SELECT tenant_id IS NULL owner_is_global,key,version,status,
      content @> '{"country":"IN","price_display":"tax_exclusive","rounding":"document"}'::jsonb content_shape,
      (SELECT selected_content_hash FROM india_gst_accommodation_quoted_rate_applicability
        WHERE id=${LIVE_APPLICABILITY}::uuid) selected_content_hash
      FROM extension WHERE id=${LIVE_EXTENSION}::uuid`;
    expect(globalExtension).toEqual({ owner_is_global: true, key: "in-gst-lodging", version: 2,
      status: "active", content_shape: true, selected_content_hash: LIVE_EXTENSION_HASH });
    const [ancestry] = await database.withTenantTransaction(LIVE_TENANT, (tx) => tx<Array<{
      valuation_join: number; applicability_join: number;
    }>>`SELECT
      (SELECT count(*)::int FROM india_gst_accommodation_final_component_tax t
        JOIN india_gst_accommodation_final_valuation v ON v.tenant_id=t.tenant_id AND v.id=t.valuation_id
          AND v.evidence_hash=t.final_valuation_evidence_hash WHERE t.id=${LIVE_TAX}::uuid) valuation_join,
      (SELECT count(*)::int FROM india_gst_accommodation_final_component_tax t
        JOIN india_gst_accommodation_quoted_rate_applicability a ON a.tenant_id=t.tenant_id AND a.id=t.applicability_id
          AND a.evidence_hash=t.quoted_rate_applicability_evidence_hash WHERE t.id=${LIVE_TAX}::uuid) applicability_join`);
    expect(ancestry).toEqual({ valuation_join: 1, applicability_join: 1 });
    const result = await database.withTenantTransaction(LIVE_TENANT, (tx) =>
      service.resolve(tx, liveInput));
    expect(result).toMatchObject({
      taxId: LIVE_TAX, valuationId: LIVE_VALUATION, applicabilityId: LIVE_APPLICABILITY,
      currency: "INR", transactionValueMinor: "100001", taxMinor: "18000",
      components: [{ componentIdentity: "igst", semanticCode: "IGST", amountMinor: "18000" }],
    });
    expect(await census()).toEqual(before);

    await expect(database.withTenantTransaction(id(406999), (tx) =>
      service.resolve(tx, liveInput)))
      .rejects.toBeInstanceOf(IndiaGstAccommodationFinalComponentTaxSemanticRouteNotFoundError);
    expect(await census()).toEqual(before);
  });

  test("fails closed against hostile current ancestry and configured routes without effects", async () => {
    const before = await census();
    await fixtureMutation(async (tx) => {
      await tx`UPDATE india_gst_accommodation_final_valuation SET evidence_hash=${H("0")}
        WHERE tenant_id=${LIVE_TENANT}::uuid AND id=${LIVE_VALUATION}::uuid`;
    });
    await expect(database.withTenantTransaction(LIVE_TENANT, (tx) => service.resolve(tx, liveInput)))
      .rejects.toBeInstanceOf(IndiaGstAccommodationFinalComponentTaxSemanticRouteNotFoundError);
    await fixtureMutation(async (tx) => {
      await tx`UPDATE india_gst_accommodation_final_valuation SET evidence_hash=${LIVE_VALUATION_HASH}
        WHERE tenant_id=${LIVE_TENANT}::uuid AND id=${LIVE_VALUATION}::uuid`;
      await tx`UPDATE account SET status='closed' WHERE tenant_id=${LIVE_TENANT}::uuid AND id=${id(406851)}::uuid`;
    });
    await expect(database.withTenantTransaction(LIVE_TENANT, (tx) => service.resolve(tx, liveInput)))
      .rejects.toBeInstanceOf(IndiaGstAccommodationFinalComponentTaxSemanticRouteConflictError);
    await fixtureMutation(async (tx) => {
      await tx`UPDATE account SET status='open' WHERE tenant_id=${LIVE_TENANT}::uuid AND id=${id(406851)}::uuid`;
    });
    expect(await census()).toEqual(before);
  });
});
