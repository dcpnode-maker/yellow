import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";
import { issueIndiaNativeFiscalInvoice } from "../src/commands/issue-india-native-fiscal-invoice";
import type { IndiaNativeFiscalInvoiceReceipt } from "../src/contexts/tax-fiscal";
import {
  BusinessDaySealService,
  ChargeCorrectionService,
  FolioService,
  FolioTransferService,
} from "../src/contexts/financials";
import { createAuditEnvelope, Database, PostgresEventBus, PostgresIdempotency } from "../src/kernel";
import { createNativeIssuanceCohort, createNativeIssuanceFixture } from "./fixtures/india-native-fiscal-source-completion-fixture";

const preparationUrl = new URL(
  "../handoff/drafts/order434/0076-native-preparation.sql",
  import.meta.url,
);
const deployUrl = process.env.YELLOW_ORDER434_NATIVE_ACCOUNTING_DEPLOY_DATABASE_URL;
if (process.env.YELLOW_REQUIRE_ORDER434_NATIVE_ACCOUNTING_DATABASE === "1" && !deployUrl) {
  throw new Error("Order434 native source-lock metadata proof requires the explicit synthetic deploy database URL");
}
const databaseDescribe = deployUrl ? describe.serial : describe.skip;
const issuanceRuntimeUrl = process.env.YELLOW_ORDER434_NATIVE_ISSUANCE_RUNTIME_DATABASE_URL;
if (process.env.YELLOW_REQUIRE_ORDER434_NATIVE_ISSUANCE_DATABASE === "1" &&
    (!deployUrl || !issuanceRuntimeUrl)) {
  throw new Error("Order434 native issuance concurrency proof requires explicit synthetic deploy and runtime database URLs");
}
const issuanceDescribe = deployUrl && issuanceRuntimeUrl ? describe.serial : describe.skip;

interface IssuanceCensus {
  readonly documents: number;
  readonly origins: number;
  readonly timings: number;
  readonly applicability: number;
  readonly applicability_nights: number;
  readonly taxes: number;
  readonly tax_nights: number;
  readonly components: number;
  readonly bindings: number;
  readonly journals: number;
  readonly lines: number;
  readonly facts: number;
  readonly events: number;
  readonly receipts: number;
  readonly next_no: string;
  readonly last_doc_hash: string | null;
}

interface OriginalChargeRoot {
  readonly journal_id: string;
  readonly root_id: string;
  readonly amount_minor: string;
}

async function originalChargeRoot(deploy: SQL, tenantId: string, folioId: string,
  guestAccountId: string): Promise<OriginalChargeRoot> {
  const rows = await deploy<OriginalChargeRoot[]>`
    SELECT journal.id::text AS journal_id,line.id::text AS root_id,line.amount_minor::text
    FROM public.journal journal
    JOIN public.posting_line line ON line.tenant_id=journal.tenant_id AND line.journal_id=journal.id
    WHERE journal.tenant_id=${tenantId}::uuid AND journal.kind='charge'
      AND journal.reverses IS NULL AND journal.source='{"interface":"financials.charge.post"}'::jsonb
      AND line.seq=1 AND line.folio_id=${folioId}::uuid AND line.account_id=${guestAccountId}::uuid
    ORDER BY journal.id`;
  if (rows.length !== 1 || !rows[0]) throw new Error("Native issuance fixture original charge is ambiguous");
  return rows[0];
}

interface WinnerFinancialCensus {
  readonly journals: number;
  readonly lines: number;
  readonly reversals: number;
  readonly transfer_fragments: number;
  readonly root_amount: string;
  readonly root_fragments: number;
  readonly day_sealed: boolean;
}

async function winnerFinancialCensus(deploy: SQL, tenantId: string, propertyId: string,
  root: OriginalChargeRoot): Promise<WinnerFinancialCensus> {
  const [row] = await deploy<WinnerFinancialCensus[]>`
    SELECT
      (SELECT count(*)::integer FROM public.journal WHERE tenant_id=${tenantId}::uuid) AS journals,
      (SELECT count(*)::integer FROM public.posting_line WHERE tenant_id=${tenantId}::uuid) AS lines,
      (SELECT count(*)::integer FROM public.journal WHERE tenant_id=${tenantId}::uuid
        AND reverses=${root.journal_id}::uuid) AS reversals,
      (SELECT count(*)::integer FROM public.posting_line WHERE tenant_id=${tenantId}::uuid
        AND folio_transfer_root_line_id IS NOT NULL) AS transfer_fragments,
      (SELECT amount_minor::text FROM public.posting_line WHERE tenant_id=${tenantId}::uuid
        AND id=${root.root_id}::uuid) AS root_amount,
      (SELECT count(*)::integer FROM public.posting_line WHERE tenant_id=${tenantId}::uuid
        AND COALESCE(folio_transfer_root_line_id,id)=${root.root_id}::uuid) AS root_fragments,
      EXISTS(SELECT 1 FROM public.business_day WHERE tenant_id=${tenantId}::uuid
        AND property_node=${propertyId}::uuid AND sealed_at IS NOT NULL) AS day_sealed`;
  if (!row) throw new Error("Native committed-winner financial census is unavailable");
  return row;
}

function sqlState(error: unknown): string | undefined {
  const candidate = error as { errno?: unknown; code?: unknown };
  return [candidate.errno, candidate.code].find((value): value is string => typeof value === "string");
}

async function rejected(operation: Promise<unknown>): Promise<unknown> {
  try {
    await operation;
  } catch (error) {
    return error;
  }
  throw new Error("Expected committed-loser operation to reject");
}

async function issuanceCensus(
  deploy: SQL,
  tenantId: string,
  seriesId: string,
): Promise<IssuanceCensus> {
  const [row] = await deploy<IssuanceCensus[]>`
    SELECT
      (SELECT count(*)::integer FROM public.document d
        WHERE d.tenant_id=${tenantId}::uuid) AS documents,
      (SELECT count(*)::integer FROM public.india_gst_native_fiscal_document_origin o
        WHERE o.tenant_id=${tenantId}::uuid) AS origins,
      (SELECT count(*)::integer FROM public.india_gst_native_invoice_timing n
        WHERE n.tenant_id=${tenantId}::uuid) AS timings,
      (SELECT count(*)::integer FROM public.india_gst_accommodation_quoted_rate_applicability a
        WHERE a.tenant_id=${tenantId}::uuid) AS applicability,
      (SELECT count(*)::integer FROM public.india_gst_accommodation_quoted_rate_applicability_room_night n
        WHERE n.tenant_id=${tenantId}::uuid) AS applicability_nights,
      (SELECT count(*)::integer FROM public.india_gst_accommodation_final_component_tax t
        WHERE t.tenant_id=${tenantId}::uuid) AS taxes,
      (SELECT count(*)::integer FROM public.india_gst_accommodation_final_component_tax_room_night n
        WHERE n.tenant_id=${tenantId}::uuid) AS tax_nights,
      (SELECT count(*)::integer FROM public.india_gst_accommodation_final_component_tax_component c
        WHERE c.tenant_id=${tenantId}::uuid) AS components,
      (SELECT count(*)::integer FROM public.india_gst_accommodation_final_component_tax_journal_binding b
        WHERE b.tenant_id=${tenantId}::uuid) AS bindings,
      (SELECT count(*)::integer FROM public.journal j
        WHERE j.tenant_id=${tenantId}::uuid) AS journals,
      (SELECT count(*)::integer FROM public.posting_line l
        WHERE l.tenant_id=${tenantId}::uuid) AS lines,
      (SELECT count(*)::integer FROM public.fact_log f
        WHERE f.tenant_id=${tenantId}::uuid) AS facts,
      (SELECT count(*)::integer FROM public.outbox e
        WHERE e.tenant_id=${tenantId}::uuid) AS events,
      (SELECT count(*)::integer FROM public.api_idempotency i
        WHERE i.tenant_id=${tenantId}::uuid AND i.operation='document.issued') AS receipts,
      s.next_no::text AS next_no,
      s.last_doc_hash
    FROM public.document_series s
    WHERE s.tenant_id=${tenantId}::uuid AND s.id=${seriesId}::uuid
  `;
  if (!row) throw new Error("Order434 native issuance fixture series is unavailable");
  return row;
}

function withoutReplay(receipt: IndiaNativeFiscalInvoiceReceipt) {
  const { replayed: _replayed, ...stable } = receipt;
  return stable;
}

function expectUnissuedFixture(census: IssuanceCensus, nextNo: string): void {
  expect(census).toMatchObject({
    documents: 0,
    origins: 0,
    timings: 0,
    applicability: 0,
    applicability_nights: 0,
    taxes: 0,
    tax_nights: 0,
    components: 0,
    bindings: 0,
    receipts: 0,
    next_no: nextNo,
    last_doc_hash: null,
  });
}

function expectSingleIssuanceDelta(
  before: IssuanceCensus,
  after: IssuanceCensus,
  receipt: IndiaNativeFiscalInvoiceReceipt,
): void {
  expect(after).toEqual({
    documents: before.documents + 1,
    origins: before.origins + 1,
    timings: before.timings + 1,
    applicability: before.applicability + 1,
    applicability_nights: before.applicability_nights + 1,
    taxes: before.taxes + 1,
    tax_nights: before.tax_nights + 1,
    components: before.components + 2,
    bindings: before.bindings + 1,
    journals: before.journals + 1,
    lines: before.lines + 4,
    facts: before.facts + 3,
    events: before.events + 4,
    receipts: before.receipts + 1,
    next_no: (BigInt(before.next_no) + 1n).toString(),
    last_doc_hash: receipt.sha256,
  });
}

async function sourceConfigurationLockSource(): Promise<{ source: string; complete: string }> {
  const complete = await Bun.file(preparationUrl).text();
  const start = complete.indexOf(
    "CREATE OR REPLACE FUNCTION public.lock_india_native_source_configuration_graph(",
  );
  const revoke = complete.indexOf(
    "REVOKE ALL ON FUNCTION public.lock_india_native_source_configuration_graph(",
    start,
  );
  const end = revoke < 0 ? -1 : complete.indexOf(";", revoke) + 1;
  if (start < 0 || revoke <= start || end <= revoke) {
    throw new Error("native source-configuration lock helper is unavailable");
  }
  return { source: complete.slice(start, end), complete };
}

describe("Order434 private native source/configuration lock graph", () => {
  test("keeps the exact private eight-argument contract at the pre-document anchor", async () => {
    const { source, complete } = await sourceConfigurationLockSource();
    expect(source).toMatch(
      /lock_india_native_source_configuration_graph\(\s*p_tenant uuid,p_property uuid,p_reservation uuid,p_folio uuid,p_valuation uuid,\s*p_native_invoice_source_input text,p_native_invoice_source_result text,\s*p_service_supply_nature text\s*\) RETURNS jsonb/,
    );
    expect(complete.indexOf("lock_india_native_source_configuration_graph(")).toBeLessThan(
      complete.indexOf("lock_india_native_document_context("),
    );
    expect(source).toContain(
      "REVOKE ALL ON FUNCTION public.lock_india_native_source_configuration_graph(\n  uuid,uuid,uuid,uuid,uuid,text,text,text) FROM PUBLIC,app_role,yellow_runtime",
    );
    expect(source).not.toContain("GRANT EXECUTE");
    expect(source).not.toContain("SECURITY DEFINER");
    expect(source).toContain("ERRCODE='42501',MESSAGE='native source configuration tenant context is unavailable'");
    expect(source).toContain("ERRCODE='22023',MESSAGE='native source configuration identities and originals are required'");
  });

  test("discovers source membership only through the genuine valuation and composition readers", async () => {
    const { source } = await sourceConfigurationLockSource();
    expect(source.match(/public\.compose_india_native_quoted_tax_source\(/g)).toHaveLength(2);
    expect(source.match(/public\.read_india_native_valuation_evidence\(/g)).toHaveLength(2);
    expect(source.match(/public\.india_native_component_tax_routes\(/g)).toHaveLength(2);
    expect(source).toContain("v_result#>>'{timing,serviceProvisionSnapshotId}'");
    expect(source).toContain("v_result#>>'{timing,paymentReceiptSnapshotId}'");
    expect(source).toContain("v_result#>>'{timing,ordinaryRegimeEvidenceId}'");
    expect(source).toContain("v_input->'historicalResolutions'");
    expect(source).toContain("v_before_composition#>>'{taxPreview,selectedExtensionId}'");
    expect(source).toContain("v_before_composition#>'{taxPreview,componentAmountsMinor}'");
    expect(source).toContain("v_before_buyer_roles,v_buyer_roles");
    expect(source).toContain("v_before_relationships");
    expect(source).toContain("v_assignment_ranges");
    expect(source).not.toContain("p_account");
    expect(source).not.toContain("p_source_ids");
  });

  test("locks the complete discovered valuation, intake, buyer and catalogue tables in fixed order", async () => {
    const { source } = await sourceConfigurationLockSource();
    const orderedMarkers = [
      "PERFORM 1 FROM public.india_gst_accommodation_final_valuation value_row",
      "PERFORM 1 FROM public.india_gst_accommodation_valuation_source source_row",
      "PERFORM 1 FROM public.india_gst_accommodation_valuation_room_night night",
      "PERFORM 1 FROM public.india_gst_accommodation_valuation_allocation allocation",
      "PERFORM 1 FROM public.india_gst_accommodation_service_provision_snapshot source_row",
      "PERFORM 1 FROM public.india_gst_accommodation_payment_receipt_snapshot source_row",
      "PERFORM 1 FROM public.india_gst_accommodation_ordinary_regime_evidence source_row",
      "PERFORM 1 FROM public.tax_attribution_reservation_binding lineage",
      "PERFORM 1 FROM public.tax_attribution_hold_binding binding",
      "PERFORM 1 FROM public.tax_attribution_snapshot attribution",
      "PERFORM 1 FROM public.hold hold_row",
      "PERFORM 1 FROM public.reservation_segment segment",
      "PERFORM 1 FROM public.reservation reservation_row",
      "PERFORM 1 FROM public.reservation_group group_row",
      "PERFORM 1 FROM public.party party_row",
      "PERFORM 1 FROM public.party_role role_row",
      "PERFORM 1 FROM public.party_relationship relationship",
      "PERFORM 1 FROM public.approval_request approval",
      "PERFORM 1 FROM public.tax_assignment assignment",
      "PERFORM 1 FROM public.extension extension_row",
      "PERFORM 1 FROM public.tax_semantic_route route",
      "PERFORM 1 FROM public.tx_code code",
      "PERFORM 1 FROM public.tx_code_route route",
    ];
    let previous = -1;
    for (const marker of orderedMarkers) {
      const next = source.indexOf(marker);
      expect(next).toBeGreaterThan(previous);
      previous = next;
    }
    expect(source.match(/FOR SHARE/g)).toHaveLength(23);
    for (const order of [
      "ORDER BY value_row.id FOR SHARE",
      "ORDER BY source_row.valuation_id,source_row.posting_root_id FOR SHARE",
      "ORDER BY night.ordinal FOR SHARE",
      "ORDER BY allocation.posting_root_id,allocation.ordinal FOR SHARE",
      "ORDER BY role_row.role FOR SHARE",
      "ORDER BY relationship.from_party,relationship.to_party,relationship.kind FOR SHARE OF relationship",
      "ORDER BY extension_row.id FOR SHARE",
      "ORDER BY route.id FOR SHARE",
      "ORDER BY code.code FOR SHARE",
      "ORDER BY route.tenant_id,route.property_node,route.currency,route.tx_code FOR SHARE",
    ]) expect(source).toContain(order);
  });

  test("keeps financial, authority and statutory locks owned by their dedicated stages", async () => {
    const { source } = await sourceConfigurationLockSource();
    for (const absent of [
      "FROM public.account", "FROM public.folio", "FROM public.posting_line",
      "FROM public.journal", "FROM public.tenant", "FROM public.org_node",
      "FROM public.app_user", "FROM public.user_role", "FROM public.role_permission",
      "FROM public.property_fiscal_registration", "FROM public.party_fiscal_registration",
      "FROM public.india_gst_supplier_service_location",
      "FROM public.india_gst_supplier_registration_status_snapshot",
      "FROM public.india_gst_supplier_sez_status",
      "FROM public.india_gst_recipient_sez_status",
      "FROM public.india_gst_item_classification", "FROM public.property_fiscal_location",
    ]) expect(source).not.toContain(absent);
    expect(source).not.toContain("FOR UPDATE");
    expect(source).not.toContain("FOR KEY SHARE");
    expect(source).not.toContain("pg_catalog.pg_advisory_xact_lock(");
  });

  test("rejects post-publication use and fails any source/configuration drift", async () => {
    const { source } = await sourceConfigurationLockSource();
    expect(source).toContain("6441674055002974568::bigint");
    expect(source).toContain("native source configuration must be locked before publication");
    for (const comparison of [
      "v_before_valuation IS DISTINCT FROM v_after_valuation",
      "v_before_composition IS DISTINCT FROM v_after_composition",
      "v_before_buyer_roles IS DISTINCT FROM v_after_buyer_roles",
      "v_before_relationships IS DISTINCT FROM v_after_relationships",
      "v_before_assignments IS DISTINCT FROM v_after_assignments",
      "v_before_extensions IS DISTINCT FROM v_after_extensions",
      "v_before_routes IS DISTINCT FROM v_after_routes",
    ]) expect(source).toContain(comparison);
    expect(source).toContain("native source configuration graph changed during ordered locking");
    expect(source).not.toMatch(/\b(?:INSERT\s+INTO|UPDATE\s+public\.|DELETE\s+FROM|TRUNCATE)\b/i);
  });

  test("returns only the stabilized source artifacts and selected configuration", async () => {
    const { source } = await sourceConfigurationLockSource();
    for (const key of [
      "valuationEvidence", "quotedTaxComposition", "rateAssignments", "extensions", "routes",
    ]) expect(source).toContain(`'${key}'`);
    expect(source).toContain("pg_catalog.cardinality(v_history_dates) NOT BETWEEN 1 AND 6");
    expect(source).toContain("pg_catalog.cardinality(v_extension_ids)<>2");
    expect(source).toContain("v_value.supersedes_valuation_id");
    expect(source).toContain("value_row.id=ANY(v_valuation_ids)");
    expect(source).toContain("role_row.role=ANY(v_buyer_roles)");
    expect(source).toContain("assignment.effective=ANY(v_assignment_ranges)");
  });
});

databaseDescribe("Order434 installed private native source-lock metadata", () => {
  let deploy: SQL;
  beforeAll(() => { deploy = new SQL(deployUrl!, { max: 1, prepare: false }); });
  afterAll(async () => { await deploy?.close(); });

  test("is owner-only, volatile and has no state-changing statement", async () => {
    const [fn] = await deploy<Array<{
      owner: string; securityDefiner: boolean; volatility: string; arguments: string;
      result: string; app: boolean; runtime: boolean; public: boolean; definition: string;
    }>>`
      SELECT pg_get_userbyid(p.proowner) AS owner,p.prosecdef AS "securityDefiner",
        p.provolatile::text AS volatility,oidvectortypes(p.proargtypes) AS arguments,
        pg_get_function_result(p.oid) AS result,
        has_function_privilege('app_role',p.oid,'EXECUTE') AS app,
        has_function_privilege('yellow_runtime',p.oid,'EXECUTE') AS runtime,
        EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
          WHERE acl.grantee=0 AND acl.privilege_type='EXECUTE') AS public,
        pg_get_functiondef(p.oid) AS definition
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname='lock_india_native_source_configuration_graph'`;
    expect(fn).toMatchObject({
      owner: "yellow_owner", securityDefiner: false, volatility: "v",
      arguments: "uuid, uuid, uuid, uuid, uuid, text, text, text",
      result: "jsonb", app: false, runtime: false, public: false,
    });
    expect(fn!.definition).not.toMatch(/\b(?:INSERT\s+INTO|UPDATE\s+public\.|DELETE\s+FROM|TRUNCATE)\b/i);
    expect(fn!.definition).not.toContain("pg_advisory_xact_lock(");
  });
});

// The coordinator installs the complete candidate and grants exactly its four
// runtime entry points for this isolated proof window. This suite never changes
// privileges and the reusable fixture inserts no timing, tax, binding or document.
issuanceDescribe("Order434 authorized native issuance concurrency", () => {
  let deploy: SQL;
  let runtime: Database;
  let runtimeEvents: SQL;

  beforeAll(async () => {
    deploy = new SQL(deployUrl!, { max: 2, prepare: false });
    runtime = Database.connect(issuanceRuntimeUrl!, { maxConnections: 6, prepare: false });
    runtimeEvents = new SQL(issuanceRuntimeUrl!, { max: 2, prepare: false });
    const [installed] = await deploy<Array<{ available: boolean }>>`
      SELECT count(*)=4 AND bool_and(has_function_privilege('app_role',p.oid,'EXECUTE')) AS available
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname IN (
        'prepare_india_native_fiscal_invoice_v2','commit_india_native_fiscal_invoice_v2',
        'consume_india_native_fiscal_accounting_event','read_india_native_accounting_source_closure'
      )
    `;
    if (!installed?.available) {
      throw new Error("Complete isolated native issuance candidate is not authorized; no concurrency proof is claimed");
    }
  });

  afterAll(async () => {
    await runtime?.close();
    await runtimeEvents?.close({ timeout: 0 });
    await deploy?.close();
  });

  test("100 simultaneous identical-key requests converge on one complete gapless invoice", async () => {
    const { fixture, series, request } = await createNativeIssuanceFixture(deploy, runtime, {
      label: "native-issuance-same-key",
    });
    const before = await issuanceCensus(deploy, fixture.tenant, series.seriesId);
    expectUnissuedFixture(before, series.nextNo);

    const receipts = await Promise.all(Array.from({ length: 100 }, () =>
      issueIndiaNativeFiscalInvoice(runtime, request)));

    expect(receipts.filter(receipt => !receipt.replayed)).toHaveLength(1);
    expect(receipts.filter(receipt => receipt.replayed)).toHaveLength(99);
    const fresh = receipts.find(receipt => !receipt.replayed)!;
    for (const candidate of receipts) expect(withoutReplay(candidate)).toEqual(withoutReplay(fresh));
    expect(fresh).toMatchObject({
      documentKind: "invoice",
      seriesId: series.seriesId,
      docNo: `${series.prefix}${series.nextNo}`,
      propertyNode: fixture.property,
      reservationId: fixture.reservation,
      folioId: fixture.folio,
      status: "issued",
    });
    expectSingleIssuanceDelta(
      before,
      await issuanceCensus(deploy, fixture.tenant, series.seriesId),
      fresh,
    );
  }, 120_000);

  test("two keys for one folio yield one invoice and one 23505 without a number gap", async () => {
    const { fixture, series, request } = await createNativeIssuanceFixture(deploy, runtime, {
      label: "native-issuance-two-keys",
    });
    const secondRequest = Object.freeze({
      ...request,
      idempotencyKey: `${request.idempotencyKey}-alternate`,
    });
    const before = await issuanceCensus(deploy, fixture.tenant, series.seriesId);
    expectUnissuedFixture(before, series.nextNo);

    const outcomes = await Promise.allSettled([
      issueIndiaNativeFiscalInvoice(runtime, request),
      issueIndiaNativeFiscalInvoice(runtime, secondRequest),
    ]);
    const winners = outcomes.filter(
      (outcome): outcome is PromiseFulfilledResult<IndiaNativeFiscalInvoiceReceipt> => outcome.status === "fulfilled",
    );
    const losers = outcomes.filter(
      (outcome): outcome is PromiseRejectedResult => outcome.status === "rejected",
    );
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);
    const sqlState = (losers[0]!.reason as { errno?: unknown; code?: unknown }).errno ??
      (losers[0]!.reason as { code?: unknown }).code;
    expect(sqlState).toBe("23505");

    const winner = winners[0]!.value;
    expect(winner).toMatchObject({
      replayed: false,
      documentKind: "invoice",
      seriesId: series.seriesId,
      docNo: `${series.prefix}${series.nextNo}`,
      propertyNode: fixture.property,
      reservationId: fixture.reservation,
      folioId: fixture.folio,
      status: "issued",
    });
    expectSingleIssuanceDelta(
      before,
      await issuanceCensus(deploy, fixture.tenant, series.seriesId),
      winner,
    );
  }, 120_000);

  test("committed issue winner blocks later ordinary correction for positive and rounded-zero tax", async () => {
    for (const taxCase of [
      { label: "positive", roomNightAmounts: ["10000"] as const, quotedTaxRounding: "exact_5_percent" as const },
      { label: "rounded-zero", roomNightAmounts: ["1"] as const, quotedTaxRounding: "component_half_up" as const },
    ]) {
      const candidate = await createNativeIssuanceFixture(deploy, runtime, {
        label: `win-correct-${taxCase.label}`,
        roomNightAmounts: taxCase.roomNightAmounts,
        quotedTaxRounding: taxCase.quotedTaxRounding,
      });
      const root = await originalChargeRoot(deploy, candidate.fixture.tenant,
        candidate.fixture.folio, candidate.fixture.guestAccount);
      expect(root.amount_minor).toBe(taxCase.roomNightAmounts[0]);
      const issued = await issueIndiaNativeFiscalInvoice(runtime, candidate.request);
      const afterIssue = await issuanceCensus(deploy, candidate.fixture.tenant, candidate.series.seriesId);
      const financialAfterIssue = await winnerFinancialCensus(deploy, candidate.fixture.tenant,
        candidate.fixture.property, root);
      const corrections = new ChargeCorrectionService({
        events: new PostgresEventBus(runtimeEvents), idempotency: new PostgresIdempotency(),
      });
      const error = await rejected(runtime.withTenantTransaction(candidate.fixture.tenant, tx =>
        corrections.reverseCharge(tx, {
          tenantId: candidate.fixture.tenant, folioId: candidate.fixture.folio,
          reversesJournalId: root.journal_id, reason: "Attempt correction after committed native issue",
          postSealAuthorized: false, idempotencyKey: `native-issue-correction-loser-${taxCase.label}`,
          envelope: createAuditEnvelope({ tenantId: candidate.fixture.tenant,
            propertyNode: candidate.fixture.property, actorId: candidate.fixture.actor,
            requestId: crypto.randomUUID(), operation: "journal.posted" }),
        })));
      expect(sqlState(error)).toBe("55000");
      expect((error as Error).message).toContain(
        "issued India native fiscal consideration requires a numbered correction document",
      );
      expect(await winnerFinancialCensus(deploy, candidate.fixture.tenant,
        candidate.fixture.property, root)).toEqual(financialAfterIssue);
      expect(await issuanceCensus(deploy, candidate.fixture.tenant, candidate.series.seriesId)).toEqual(afterIssue);
      const replay = await issueIndiaNativeFiscalInvoice(runtime, {
        ...candidate.request, envelope: { ...candidate.request.envelope, requestId: crypto.randomUUID() },
      });
      expect(replay).toEqual({ ...issued, replayed: true });
      expect(await issuanceCensus(deploy, candidate.fixture.tenant, candidate.series.seriesId)).toEqual(afterIssue);
    }
  }, 120_000);

  test("committed issue winner blocks later folio transfer for positive and rounded-zero tax", async () => {
    for (const taxCase of [
      { label: "positive", roomNightAmounts: ["10000"] as const, quotedTaxRounding: "exact_5_percent" as const },
      { label: "rounded-zero", roomNightAmounts: ["1"] as const, quotedTaxRounding: "component_half_up" as const },
    ]) {
      const candidate = await createNativeIssuanceFixture(deploy, runtime, {
        label: `win-transfer-${taxCase.label}`,
        roomNightAmounts: taxCase.roomNightAmounts,
        quotedTaxRounding: taxCase.quotedTaxRounding,
      });
      const root = await originalChargeRoot(deploy, candidate.fixture.tenant,
        candidate.fixture.folio, candidate.fixture.guestAccount);
      const issued = await issueIndiaNativeFiscalInvoice(runtime, candidate.request);
      await deploy`INSERT INTO public.document_series(tenant_id,property_node,kind,prefix,next_no,fiscal)
        VALUES(${candidate.fixture.tenant}::uuid,${candidate.fixture.property}::uuid,'folio',
          ${`WIN-${taxCase.label.toUpperCase()}-`},1,false)`;
      const folios = new FolioService({
        events: new PostgresEventBus(runtimeEvents), idempotency: new PostgresIdempotency(),
      });
      const destination = await runtime.withTenantTransaction(candidate.fixture.tenant, tx =>
        folios.openAdditional(tx, {
          tenantId: candidate.fixture.tenant, reservationId: candidate.fixture.reservation,
          sourceFolioId: candidate.fixture.folio, name: `Committed loser ${taxCase.label}`,
          idempotencyKey: `native-transfer-destination-${taxCase.label}`,
          envelope: createAuditEnvelope({ tenantId: candidate.fixture.tenant,
            propertyNode: candidate.fixture.property, actorId: candidate.fixture.actor,
            requestId: crypto.randomUUID(), operation: "folio.opened" }),
        }));
      const family = await runtime.withTenantTransaction(candidate.fixture.tenant, tx =>
        tx<Array<{ id: string; window_no: number; balance_minor: string }>>`
          SELECT folio.id::text,folio.window_no,COALESCE(balance.balance_minor,0)::text AS balance_minor
          FROM public.folio folio LEFT JOIN public.folio_balance balance
            ON balance.tenant_id=folio.tenant_id AND balance.folio_id=folio.id
          WHERE folio.tenant_id=${candidate.fixture.tenant}::uuid
            AND folio.reservation_id=${candidate.fixture.reservation}::uuid
          ORDER BY folio.window_no,folio.id`);
      const generation = new Bun.CryptoHasher("md5").update(family
        .map(row => `${row.id}:${row.window_no}:${row.balance_minor}`).join("|")).digest("hex");
      const transfers = new FolioTransferService({
        events: new PostgresEventBus(runtimeEvents), idempotency: new PostgresIdempotency(), folios,
      });
      const transferInput = {
        tenantId: candidate.fixture.tenant, sourceFolioId: candidate.fixture.folio,
        destinationFolioId: destination.folioId, groupIds: [root.journal_id],
        reason: "Attempt transfer after committed native issue", generation, previewRevision: "",
        idempotencyKey: `native-issue-transfer-loser-${taxCase.label}`,
        envelope: createAuditEnvelope({ tenantId: candidate.fixture.tenant,
          propertyNode: candidate.fixture.property, actorId: candidate.fixture.actor,
          requestId: crypto.randomUUID(), operation: "journal.posted" }),
      } as const;
      const preview = await runtime.withTenantTransaction(candidate.fixture.tenant,
        tx => transfers.preview(tx, transferInput));
      const complete = Object.freeze({ ...transferInput, previewRevision: preview.previewRevision });
      const afterSetup = await issuanceCensus(deploy, candidate.fixture.tenant, candidate.series.seriesId);
      const financialAfterSetup = await winnerFinancialCensus(deploy, candidate.fixture.tenant,
        candidate.fixture.property, root);
      const error = await rejected(runtime.withTenantTransaction(candidate.fixture.tenant,
        tx => transfers.transfer(tx, complete)));
      expect(sqlState(error)).toBe("55000");
      expect((error as Error).message).toContain(
        "issued India native fiscal posting ancestry is immutable",
      );
      expect(await winnerFinancialCensus(deploy, candidate.fixture.tenant,
        candidate.fixture.property, root)).toEqual(financialAfterSetup);
      expect(await issuanceCensus(deploy, candidate.fixture.tenant, candidate.series.seriesId)).toEqual(afterSetup);
      const replay = await issueIndiaNativeFiscalInvoice(runtime, {
        ...candidate.request, envelope: { ...candidate.request.envelope, requestId: crypto.randomUUID() },
      });
      expect(replay).toEqual({ ...issued, replayed: true });
      expect(await issuanceCensus(deploy, candidate.fixture.tenant, candidate.series.seriesId)).toEqual(afterSetup);
    }
  }, 120_000);

  test("committed seal winner blocks later issue for positive and rounded-zero tax", async () => {
    for (const taxCase of [
      { label: "positive", roomNightAmounts: ["10000"] as const, quotedTaxRounding: "exact_5_percent" as const },
      { label: "rounded-zero", roomNightAmounts: ["1"] as const, quotedTaxRounding: "component_half_up" as const },
    ]) {
      const candidate = await createNativeIssuanceFixture(deploy, runtime, {
        label: `win-seal-${taxCase.label}`,
        roomNightAmounts: taxCase.roomNightAmounts,
        quotedTaxRounding: taxCase.quotedTaxRounding,
      });
      const root = await originalChargeRoot(deploy, candidate.fixture.tenant,
        candidate.fixture.folio, candidate.fixture.guestAccount);
      const roleId = crypto.randomUUID();
      await deploy.begin(async tx => {
        await tx`INSERT INTO public.permission(code,description) VALUES('business_day.seal',
          'Seal a ready business day') ON CONFLICT DO NOTHING`;
        await tx`INSERT INTO public.role(id,tenant_id,name) VALUES(${roleId}::uuid,
          ${candidate.fixture.tenant}::uuid,${`Order434 committed seal ${taxCase.label}`})`;
        await tx`INSERT INTO public.role_permission(role_id,permission_code)
          VALUES(${roleId}::uuid,'business_day.seal')`;
        await tx`INSERT INTO public.user_role(tenant_id,user_id,role_id,scope_node)
          VALUES(${candidate.fixture.tenant}::uuid,${candidate.fixture.actor}::uuid,${roleId}::uuid,
            ${candidate.fixture.property}::uuid)`;
      });
      const [day] = await deploy<Array<{ business_date: string }>>`
        SELECT business_date::text FROM public.business_day WHERE tenant_id=${candidate.fixture.tenant}::uuid
          AND property_node=${candidate.fixture.property}::uuid`;
      if (!day) throw new Error("Native committed-winner business day is unavailable");
      const seals = new BusinessDaySealService({
        events: new PostgresEventBus(runtimeEvents), idempotency: new PostgresIdempotency(),
      });
      const sealed = await runtime.withTenantTransaction(candidate.fixture.tenant, tx => seals.seal(tx, {
        tenantId: candidate.fixture.tenant, propertyNode: candidate.fixture.property,
        businessDate: day.business_date, actorId: candidate.fixture.actor,
        idempotencyKey: `native-seal-winner-${taxCase.label}`,
        envelope: createAuditEnvelope({ tenantId: candidate.fixture.tenant,
          propertyNode: candidate.fixture.property, actorId: candidate.fixture.actor,
          requestId: crypto.randomUUID(), operation: "business_day.sealed" }),
      }));
      expect(sealed).toMatchObject({ state: "sealed", replayed: false });
      const afterSeal = await issuanceCensus(deploy, candidate.fixture.tenant, candidate.series.seriesId);
      const financialAfterSeal = await winnerFinancialCensus(deploy, candidate.fixture.tenant,
        candidate.fixture.property, root);
      expect(financialAfterSeal.day_sealed).toBe(true);
      const error = await rejected(issueIndiaNativeFiscalInvoice(runtime, candidate.request));
      expect(sqlState(error)).toBe("P0011");
      expect((error as Error).message).toContain("native fiscal issue business date is sealed");
      expect(await issuanceCensus(deploy, candidate.fixture.tenant, candidate.series.seriesId)).toEqual(afterSeal);
      expect(await winnerFinancialCensus(deploy, candidate.fixture.tenant,
        candidate.fixture.property, root)).toEqual(financialAfterSeal);
      expectUnissuedFixture(afterSeal, candidate.series.nextNo);
    }
  }, 120_000);

  test("committed issue winner permits later audited seal and permanent replay for positive and rounded-zero tax", async () => {
    for (const taxCase of [
      { label: "positive", roomNightAmounts: ["10000"] as const, quotedTaxRounding: "exact_5_percent" as const },
      { label: "rounded-zero", roomNightAmounts: ["1"] as const, quotedTaxRounding: "component_half_up" as const },
    ]) {
      const candidate = await createNativeIssuanceFixture(deploy, runtime, {
        label: `win-issue-seal-${taxCase.label}`,
        roomNightAmounts: taxCase.roomNightAmounts,
        quotedTaxRounding: taxCase.quotedTaxRounding,
      });
      const root = await originalChargeRoot(deploy, candidate.fixture.tenant,
        candidate.fixture.folio, candidate.fixture.guestAccount);
      const issued = await issueIndiaNativeFiscalInvoice(runtime, candidate.request);
      const afterIssue = await issuanceCensus(deploy, candidate.fixture.tenant, candidate.series.seriesId);
      const roleId = crypto.randomUUID();
      await deploy.begin(async tx => {
        await tx`INSERT INTO public.permission(code,description) VALUES('business_day.seal',
          'Seal a ready business day') ON CONFLICT DO NOTHING`;
        await tx`INSERT INTO public.role(id,tenant_id,name) VALUES(${roleId}::uuid,
          ${candidate.fixture.tenant}::uuid,${`Order434 post-issue seal ${taxCase.label}`})`;
        await tx`INSERT INTO public.role_permission(role_id,permission_code)
          VALUES(${roleId}::uuid,'business_day.seal')`;
        await tx`INSERT INTO public.user_role(tenant_id,user_id,role_id,scope_node)
          VALUES(${candidate.fixture.tenant}::uuid,${candidate.fixture.actor}::uuid,${roleId}::uuid,
            ${candidate.fixture.property}::uuid)`;
      });
      const [day] = await deploy<Array<{ business_date: string }>>`
        SELECT business_date::text FROM public.business_day WHERE tenant_id=${candidate.fixture.tenant}::uuid
          AND property_node=${candidate.fixture.property}::uuid`;
      if (!day) throw new Error("Native post-issue business day is unavailable");
      const seals = new BusinessDaySealService({
        events: new PostgresEventBus(runtimeEvents), idempotency: new PostgresIdempotency(),
      });
      const sealInput = {
        tenantId: candidate.fixture.tenant, propertyNode: candidate.fixture.property,
        businessDate: day.business_date, actorId: candidate.fixture.actor,
        idempotencyKey: `native-post-issue-seal-${taxCase.label}`,
        envelope: createAuditEnvelope({ tenantId: candidate.fixture.tenant,
          propertyNode: candidate.fixture.property, actorId: candidate.fixture.actor,
          requestId: crypto.randomUUID(), operation: "business_day.sealed" }),
      } as const;
      const sealed = await runtime.withTenantTransaction(candidate.fixture.tenant, tx => seals.seal(tx, sealInput));
      expect(sealed).toMatchObject({ state: "sealed", replayed: false });
      const afterSeal = await issuanceCensus(deploy, candidate.fixture.tenant, candidate.series.seriesId);
      expect(afterSeal).toEqual({ ...afterIssue, facts: afterIssue.facts + 1, events: afterIssue.events + 1 });
      const financialAfterSeal = await winnerFinancialCensus(deploy, candidate.fixture.tenant,
        candidate.fixture.property, root);
      expect(financialAfterSeal.day_sealed).toBe(true);
      const replay = await issueIndiaNativeFiscalInvoice(runtime, {
        ...candidate.request, envelope: { ...candidate.request.envelope, requestId: crypto.randomUUID() },
      });
      expect(replay).toEqual({ ...issued, replayed: true });
      expect(await issuanceCensus(deploy, candidate.fixture.tenant, candidate.series.seriesId)).toEqual(afterSeal);
      expect(await winnerFinancialCensus(deploy, candidate.fixture.tenant,
        candidate.fixture.property, root)).toEqual(financialAfterSeal);
    }
  }, 120_000);

  test("100 distinct authentic sources share one gapless invoice series and recomputable chain", async () => {
    const candidates = await createNativeIssuanceCohort(deploy, runtime, {
      count: 100, label: "native-distinct-series", roomNightAmounts: ["10000"],
    });
    expect(candidates).toHaveLength(100);
    const first = candidates[0]!;
    for (const selector of [
      (candidate: typeof first) => candidate.fixture.tenant,
      (candidate: typeof first) => candidate.fixture.property,
      (candidate: typeof first) => candidate.fixture.actor,
      (candidate: typeof first) => candidate.statutory.seller.registrationId,
      (candidate: typeof first) => candidate.series.seriesId,
    ]) expect(new Set(candidates.map(selector)).size).toBe(1);
    for (const selector of [
      (candidate: typeof first) => candidate.fixture.party,
      (candidate: typeof first) => candidate.fixture.reservation,
      (candidate: typeof first) => candidate.fixture.folio,
      (candidate: typeof first) => candidate.valuation.valuationId,
      (candidate: typeof first) => candidate.request.serviceProvisionSnapshotId,
      (candidate: typeof first) => candidate.request.paymentReceiptSnapshotId,
      (candidate: typeof first) => candidate.request.ordinaryRegimeEvidenceId,
      (candidate: typeof first) => candidate.request.idempotencyKey,
    ]) expect(new Set(candidates.map(selector)).size).toBe(100);
    const before = await issuanceCensus(deploy, first.fixture.tenant, first.series.seriesId);
    expectUnissuedFixture(before, "1");
    expect(before.journals).toBe(100);
    expect(before.lines).toBe(200);

    // Schedule all application requests together through the bounded six-connection
    // runtime pool. No retry wrapper or owner-issued document is involved.
    const outcomes = await Promise.allSettled(candidates.map(candidate =>
      issueIndiaNativeFiscalInvoice(runtime, candidate.request)));
    const failures = outcomes.filter((outcome): outcome is PromiseRejectedResult => outcome.status === "rejected");
    if (failures.length) throw new AggregateError(failures.map(failure => failure.reason),
      `${failures.length} distinct-source native invoice requests failed`);
    const receipts = outcomes.map(outcome => (outcome as PromiseFulfilledResult<IndiaNativeFiscalInvoiceReceipt>).value);
    expect(receipts.every(receipt => !receipt.replayed)).toBe(true);
    expect(new Set(receipts.map(receipt => receipt.documentId)).size).toBe(100);
    expect(new Set(receipts.map(receipt => receipt.docNo))).toEqual(
      new Set(Array.from({ length: 100 }, (_, index) => `${first.series.prefix}${index + 1}`)));
    for (let index = 0; index < candidates.length; index++) {
      expect(receipts[index]).toMatchObject({
        seriesId: first.series.seriesId, propertyNode: first.fixture.property,
        reservationId: candidates[index]!.fixture.reservation,
        folioId: candidates[index]!.fixture.folio, status: "issued", replayed: false,
      });
    }
    const chain = await deploy<Array<{
      serial: number; id: string; sha256: string; prev_hash: string | null;
      content_text: string; folio_id: string; reservation_id: string;
      invoice_facts: number; invoice_events: number; completed_receipts: number;
    }>>`SELECT substring(d.doc_no from '[0-9]+$')::integer AS serial,
        d.id::text,d.sha256,d.prev_hash,d.content::text AS content_text,
        o.folio_id::text,o.reservation_id::text,
        (SELECT count(*)::integer FROM public.fact_log f WHERE f.tenant_id=d.tenant_id
          AND f.entity_type='document' AND f.entity_id=d.id AND f.fact_type='issued') AS invoice_facts,
        (SELECT count(*)::integer FROM public.outbox e WHERE e.tenant_id=d.tenant_id
          AND e.aggregate_id=d.id AND e.event_type='document.issued') AS invoice_events,
        (SELECT count(*)::integer FROM public.api_idempotency i WHERE i.tenant_id=d.tenant_id
          AND i.operation='document.issued' AND i.response_status=201 AND i.completed_at IS NOT NULL
          AND i.response_body @> jsonb_build_object('documentId',d.id::text)) AS completed_receipts
      FROM public.document d JOIN public.india_gst_native_fiscal_document_origin o
        ON o.tenant_id=d.tenant_id AND o.document_id=d.id
      WHERE d.tenant_id=${first.fixture.tenant}::uuid AND d.series_id=${first.series.seriesId}::uuid
      ORDER BY serial`;
    expect(chain).toHaveLength(100);
    const receiptsById = new Map(receipts.map(receipt => [receipt.documentId, receipt]));
    for (let index = 0; index < chain.length; index++) {
      const row = chain[index]!;
      expect(row.serial).toBe(index + 1);
      expect(row.prev_hash).toBe(index === 0 ? null : chain[index - 1]!.sha256);
      expect(new Bun.CryptoHasher("sha256").update(row.content_text).digest("hex")).toBe(row.sha256);
      expect(row).toMatchObject({ invoice_facts: 1, invoice_events: 1, completed_receipts: 1 });
      expect(receiptsById.get(row.id)).toMatchObject({
        sha256: row.sha256, folioId: row.folio_id, reservationId: row.reservation_id,
      });
    }
    const after = await issuanceCensus(deploy, first.fixture.tenant, first.series.seriesId);
    expect(after).toEqual({
      documents: 100, origins: 100, timings: 100, applicability: 100,
      applicability_nights: 100, taxes: 100, tax_nights: 100, components: 200,
      bindings: 100, journals: before.journals + 100, lines: before.lines + 400,
      facts: before.facts + 300, events: before.events + 400, receipts: 100,
      next_no: "101", last_doc_hash: chain[99]!.sha256,
    });
    const replays = await Promise.all(candidates.map(candidate => issueIndiaNativeFiscalInvoice(runtime, {
      ...candidate.request,
      envelope: { ...candidate.request.envelope, requestId: crypto.randomUUID() },
    })));
    for (let index = 0; index < replays.length; index++) {
      expect(replays[index]).toEqual({ ...receipts[index]!, replayed: true });
    }
    expect(await issuanceCensus(deploy, first.fixture.tenant, first.series.seriesId)).toEqual(after);
  }, 240_000);
});
