import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { IssueIndiaNativeFiscalInvoiceCommand } from "../src/commands/issue-india-native-fiscal-invoice";
import {
  BusinessDaySealService,
  FolioSettlementService,
  LocalPaymentProvider,
  PaymentService,
} from "../src/contexts/financials";
import {
  createAuditEnvelope,
  Database,
  PostgresEventBus,
  PostgresIdempotency,
} from "../src/kernel";
import {
  createNativeCorrectionFirstIssuanceFixture,
  createNativeIssuanceFixture,
  createNativeMaximumBoundIssuanceFixture,
  createNativeTransferFirstIssuanceFixture,
  NATIVE_ISSUANCE_TEST_CUTOVER_CALENDAR,
} from "./fixtures/india-native-fiscal-source-completion-fixture";

const ROOT = join(import.meta.dir, "..");
const completion = readFileSync(
  join(ROOT, "handoff", "drafts", "order434", "0076-native-completion.sql"),
  "utf8",
);
const preparation = readFileSync(
  join(ROOT, "handoff", "drafts", "order434", "0076-native-preparation.sql"),
  "utf8",
);
const sourceEvidence = readFileSync(
  join(ROOT, "handoff", "drafts", "order434", "0075_india_native_fiscal_source_evidence.sql"),
  "utf8",
);
const service = readFileSync(
  join(ROOT, "src", "contexts", "tax-fiscal", "india-native-fiscal-invoice.ts"),
  "utf8",
);
const deployUrl = process.env.YELLOW_ORDER434_NATIVE_ACCOUNTING_DEPLOY_DATABASE_URL;
const runtimeUrl = process.env.YELLOW_ORDER434_NATIVE_ISSUANCE_RUNTIME_DATABASE_URL;
if (process.env.YELLOW_REQUIRE_ORDER434_NATIVE_ISSUANCE_DATABASE === "1" && (!deployUrl || !runtimeUrl)) {
  throw new Error("Order434 native completion proof requires explicit deploy and issuance runtime URLs");
}
const candidateDescribe = deployUrl && runtimeUrl ? describe.serial : describe.skip;

function body(name: string): string {
  const pattern = new RegExp(
    `CREATE OR REPLACE FUNCTION public\\.${name}\\([\\s\\S]*?\\$\\$;`,
  );
  const match = pattern.exec(completion);
  if (!match) throw new Error(`missing SQL function ${name}`);
  return match[0];
}

describe("Order434 native fiscal completion draft integration contract", () => {
  test("matches the exact seven-argument TypeScript wire and 20-column receipt", () => {
    const commit = body("commit_india_native_fiscal_invoice_v2");
    expect(service).toContain("public.commit_india_native_fiscal_invoice_v2(");
    expect(service).toContain("${input.tenantId}::uuid, ${input.propertyNode}::uuid, ${input.actorId}::uuid");
    expect(service).toContain("${nativeTimingId}::uuid, ${input.idempotencyKey}");
    expect(commit).toContain(
      "p_tenant uuid,p_property uuid,p_actor uuid,p_native_timing uuid,p_key text,\n  p_frozen_evidence jsonb,p_request uuid",
    );
    for (const column of [
      "document_id uuid", "document_kind text", "series_id uuid", "doc_no text",
      "property_node uuid", "reservation_id uuid", "folio_id uuid",
      "supplier_registration_id uuid", "recipient_registration_id uuid",
      "financial_year_start date", "currency character(3)", "status text",
      "business_date date", "issued_at timestamptz", "prev_hash text", "sha256 text",
      "source_evidence_hash text", "pre_document_evidence_hash text",
      "readiness_evidence_hash text", "created boolean",
    ]) expect(commit).toContain(column);
  });

  test("reconstructs and exact-compares Order413, Order426 and Order429 before allocation", () => {
    const compose = body("compose_india_native_fiscal_completion_evidence");
    const commit = body("commit_india_native_fiscal_invoice_v2");
    expect(compose).toContain("assert_india_native_preparation_authenticity");
    expect(compose).toContain("assert_india_native_accounting_binding");
    expect(compose).toContain("eligible_current_native_accounted_source");
    expect(compose).toContain("native_current_transaction_graph");
    expect(compose).toContain("eligible_irp_accommodation_room_night_item_candidates");
    expect(compose).toContain("incomplete_non_submit_ready_irp_accommodation_validation_compatibility_pre_document_evidence");
    expect(compose).toContain("blocked_pending_fiscal_document_origin_policy");
    expect(commit).toContain("sourceEvidencePreimage' IS DISTINCT FROM v_expected->>'sourceEvidencePreimage");
    expect(commit).toContain("preDocumentEvidencePreimage' IS DISTINCT FROM v_expected->>'preDocumentEvidencePreimage");
    expect(commit).toContain("readinessEvidencePreimage' IS DISTINCT FROM v_expected->>'readinessEvidencePreimage");
    expect(commit.indexOf("compose_india_native_fiscal_completion_evidence"))
      .toBeLessThan(commit.indexOf("INSERT INTO public.document("));
  });

  test("narrows PostgreSQL numeric component sums only after the bounded tax aggregate", () => {
    const compose = body("compose_india_native_fiscal_completion_evidence");
    expect(compose).toContain(
      "COALESCE(pg_catalog.sum(c.tax_amount_minor),0)::bigint",
    );
    expect(compose).toContain(
      "FILTER(WHERE c.component_identity='cgst'),0)::bigint",
    );
    expect(compose).toContain(
      "FILTER(WHERE c.component_identity IN ('sgst','utgst')),0)::bigint",
    );
    expect(compose).not.toMatch(
      /india_native_completion_minor_text\(COALESCE\(pg_catalog\.sum\([\s\S]*?\),0\)\)/,
    );
  });

  test("consumes only the already-held publication and document-context locks", () => {
    const commit = body("commit_india_native_fiscal_invoice_v2");
    expect(commit).toContain("native v2 fiscal completion requires the already-held publication lock");
    expect(commit).not.toContain("pg_advisory_xact_lock(");
    expect(commit).not.toMatch(/FOR\s+(?:NO\s+KEY\s+)?UPDATE/i);
    expect(commit).not.toMatch(/FOR\s+(?:KEY\s+)?SHARE/i);
    expect(commit).not.toContain("lock_financial_business_days");
    expect(commit).not.toContain("lock_india_native_document_context(");
  });

  test("writes the canonical 0074 artifact set with native-v2 origin bindings", () => {
    const commit = body("commit_india_native_fiscal_invoice_v2");
    const ordered = [
      "INSERT INTO public.document(",
      "UPDATE public.document_series SET next_no=next_no+1,last_doc_hash=v_hash",
      "INSERT INTO public.india_gst_native_fiscal_document_origin(",
      "INSERT INTO public.fact_log(",
      "INSERT INTO public.outbox(",
      "UPDATE public.api_idempotency SET response_status=201",
    ];
    let previous = -1;
    for (const marker of ordered) {
      const index = commit.indexOf(marker);
      expect(index).toBeGreaterThan(previous);
      previous = index;
    }
    expect(commit).toContain("'native_current_transaction_graph',2");
    expect(commit).toContain("n.id,b.id,n.native_source_basis_hash");
    expect(commit).toContain("'document.issued'");
    expect(commit).toContain("'documentId',n.prospective_document_id::text");
  });

  test("keeps both completion entry points owner-private", () => {
    for (const signature of [
      "commit_india_native_fiscal_invoice_v2(uuid,uuid,uuid,uuid,text,jsonb,uuid)",
      "read_india_native_completed_receipt(uuid,uuid)",
    ]) {
      expect(completion).toContain(`REVOKE ALL ON FUNCTION public.${signature}`);
      expect(completion).not.toContain(`GRANT EXECUTE ON FUNCTION public.${signature}`);
    }
  });

  test("keeps forward conservation private on the existing deferred trigger and rechecks the bounded prefix", () => {
    const conservation = body("assert_native_valuation_conservation");
    expect(conservation).toContain("WITH expected AS MATERIALIZED");
    expect(conservation).toContain("FULL JOIN actual a");
    expect(completion).toContain(
      "REVOKE ALL ON FUNCTION public.assert_native_valuation_conservation() FROM PUBLIC,app_role,yellow_runtime",
    );
    expect(completion).not.toMatch(/CREATE\s+(?:CONSTRAINT\s+)?TRIGGER\s+native_valuation_conservation/i);
    expect(sourceEvidence).toMatch(
      /CREATE CONSTRAINT TRIGGER native_valuation_conservation[\s\S]*?DEFERRABLE INITIALLY DEFERRED/,
    );
    expect(preparation).toContain("a.id=ANY(v_accounts) AND a.property_node=p_property AND a.currency='INR'");
    expect(preparation).toContain("v_source IS DISTINCT FROM public.read_india_native_valuation_source_closure(");
    expect(preparation).toContain("OR v_preview IS DISTINCT FROM public.read_india_native_tax_preview(");
    expect(preparation).toContain("OR v_routes IS DISTINCT FROM v_current_routes");
  });

  test("serializes each fiscal item once without rewriting the preceding items", () => {
    const composer = body("compose_india_native_fiscal_completion_evidence");
    expect(composer).toContain("v_item_texts:=pg_catalog.array_append(v_item_texts,");
    expect(composer).toContain("v_compat_item_texts:=pg_catalog.array_append(v_compat_item_texts,");
    expect(composer).toContain("pg_catalog.array_to_string(v_item_texts,',')");
    expect(composer).toContain("pg_catalog.array_to_string(v_compat_item_texts,',')");
    expect(composer).not.toContain("public.india_native_insertion_json(v_items)");
    expect(composer).not.toContain("public.india_native_insertion_json(v_compat_items)");
    expect(composer).toContain("v_item_count NOT BETWEEN 1 AND 366");
  });

  test("projects replay only from permanent immutable artifacts", () => {
    const replay = body("read_india_native_completed_receipt");
    expect(replay).toContain("india_gst_native_invoice_timing");
    expect(replay).toContain("india_gst_native_fiscal_document_origin");
    expect(replay).toContain("public.document document");
    expect(replay).toContain("public.document_series series");
    expect(replay).toContain("assert_india_native_accounting_binding");
    expect(replay).toContain("'created',false");
    expect(replay).toContain(
      `'issued_at',pg_catalog.to_char(d.issued_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`,
    );
    expect(replay).not.toContain("'issued_at',n.transaction_timestamp");
    expect(replay).not.toContain("api_idempotency");
    expect(replay).not.toContain("business_day");
    expect(replay).not.toContain("read_india_native_issue_authority");
    expect(replay).not.toContain("request_event_id");
    expect(replay).not.toContain("next_no");
    expect(replay).not.toMatch(/FOR\s+(?:NO\s+KEY\s+)?UPDATE/i);
    expect(replay).not.toMatch(/FOR\s+(?:KEY\s+)?SHARE/i);
  });
});

interface CandidateCensus {
  readonly journals: number;
  readonly lines: number;
  readonly documents: number;
  readonly origins: number;
  readonly accountingBindings: number;
  readonly facts: number;
  readonly events: number;
  readonly idempotencyRows: number;
  readonly issueReceipts: number;
  readonly nextNo: string;
}

async function candidateCensus(deploy: SQL, tenantId: string, seriesId: string): Promise<CandidateCensus> {
  const [row] = await deploy<Array<{
    journals: number; lines: number; documents: number; origins: number; accounting_bindings: number;
    facts: number; events: number; idempotency_rows: number; issue_receipts: number; next_no: string;
  }>>`SELECT
    (SELECT count(*)::integer FROM public.journal WHERE tenant_id=${tenantId}::uuid) AS journals,
    (SELECT count(*)::integer FROM public.posting_line WHERE tenant_id=${tenantId}::uuid) AS lines,
    (SELECT count(*)::integer FROM public.document WHERE tenant_id=${tenantId}::uuid) AS documents,
    (SELECT count(*)::integer FROM public.india_gst_native_fiscal_document_origin
      WHERE tenant_id=${tenantId}::uuid) AS origins,
    (SELECT count(*)::integer FROM public.india_gst_accommodation_final_component_tax_journal_binding
      WHERE tenant_id=${tenantId}::uuid) AS accounting_bindings,
    (SELECT count(*)::integer FROM public.fact_log WHERE tenant_id=${tenantId}::uuid) AS facts,
    (SELECT count(*)::integer FROM public.outbox WHERE tenant_id=${tenantId}::uuid) AS events,
    (SELECT count(*)::integer FROM public.api_idempotency
      WHERE tenant_id=${tenantId}::uuid) AS idempotency_rows,
    (SELECT count(*)::integer FROM public.api_idempotency
      WHERE tenant_id=${tenantId}::uuid AND operation='document.issued') AS issue_receipts,
    (SELECT next_no::text FROM public.document_series
      WHERE tenant_id=${tenantId}::uuid AND id=${seriesId}::uuid) AS next_no`;
  if (!row) throw new Error("Native completion census is unavailable");
  const { next_no: nextNo, accounting_bindings: accountingBindings,
    idempotency_rows: idempotencyRows, issue_receipts: issueReceipts, ...counts } = row;
  return Object.freeze({ ...counts, accountingBindings, idempotencyRows, issueReceipts, nextNo });
}

function replayRequest<T extends {
  readonly tenantId: string; readonly propertyNode: string; readonly actorId: string;
}>(request: T): T {
  return Object.freeze({
    ...request,
    envelope: createAuditEnvelope({
      tenantId: request.tenantId,
      propertyNode: request.propertyNode,
      actorId: request.actorId,
      requestId: crypto.randomUUID(),
      operation: "document.issued",
    }),
  }) as T;
}

// These cases use the actual four candidate capabilities installed by the
// coordinator. This test neither grants nor fabricates timing/tax/accounting
// rows; every derived row must be produced by the real same-transaction command.
candidateDescribe("Order434 native completion real candidate variants", () => {
  let deploy: SQL;
  let runtime: Database;
  let runtimeEvents: SQL;

  beforeAll(async () => {
    deploy = new SQL(deployUrl!, { max: 2, prepare: false });
    runtime = Database.connect(runtimeUrl!, { maxConnections: 3, prepare: false });
    runtimeEvents = new SQL(runtimeUrl!, { max: 2, prepare: false });
    const [installed] = await deploy<Array<{ available: boolean }>>`
      SELECT count(*)=4 AND bool_and(has_function_privilege('app_role',p.oid,'EXECUTE')) AS available
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname IN ('prepare_india_native_fiscal_invoice_v2',
        'commit_india_native_fiscal_invoice_v2','consume_india_native_fiscal_accounting_event',
        'read_india_native_accounting_source_closure')`;
    if (!installed?.available) {
      throw new Error("Complete isolated native issuance candidate is not enabled; no proof is claimed");
    }
  });

  afterAll(async () => {
    await runtime?.close();
    await runtimeEvents?.close({ timeout: 0 });
    await deploy?.close();
  });

  test("issues and permanently replays an authentic one-minor zero-tax invoice without a tax journal", async () => {
    const candidate = await createNativeIssuanceFixture(deploy, runtime, {
      label: "native-completion-real-zero",
      roomNightAmounts: ["1"],
      quotedTaxRounding: "component_half_up",
    });
    const before = await candidateCensus(deploy, candidate.fixture.tenant, candidate.series.seriesId);
    const command = new IssueIndiaNativeFiscalInvoiceCommand(runtime);
    const issued = await command.execute(candidate.request);
    const afterIssue = await candidateCensus(deploy, candidate.fixture.tenant, candidate.series.seriesId);
    expect(afterIssue).toMatchObject({
      journals: before.journals,
      lines: before.lines,
      documents: before.documents + 1,
      nextNo: (BigInt(before.nextNo) + 1n).toString(),
    });
    const [projection] = await deploy<Array<{
      tax_minor: string; grand_total_minor: string; rate_selection_kind: string;
      journal_id: string | null; ass_val: string; cgst_val: string; sgst_val: string; total_val: string;
    }>>`SELECT tax.tax_minor::text,tax.grand_total_minor::text,tax.rate_selection_kind,
        binding.journal_id::text,
        document.content#>>'{ValDtls,AssVal}' AS ass_val,
        document.content#>>'{ValDtls,CgstVal}' AS cgst_val,
        document.content#>>'{ValDtls,SgstVal}' AS sgst_val,
        document.content#>>'{ValDtls,TotInvVal}' AS total_val
      FROM public.india_gst_native_fiscal_document_origin origin
      JOIN public.document document ON document.tenant_id=origin.tenant_id AND document.id=origin.document_id
      JOIN public.india_gst_native_invoice_timing timing
        ON timing.tenant_id=origin.tenant_id AND timing.id=origin.native_timing_id
      JOIN public.india_gst_accommodation_final_component_tax tax
        ON tax.tenant_id=timing.tenant_id AND tax.id=timing.tax_id
      JOIN public.india_gst_accommodation_final_component_tax_journal_binding binding
        ON binding.tenant_id=timing.tenant_id AND binding.id=timing.accounting_binding_id
      WHERE origin.tenant_id=${candidate.fixture.tenant}::uuid AND origin.document_id=${issued.documentId}::uuid`;
    if (!projection) throw new Error("Authentic zero-tax native completion projection is unavailable");
    expect(projection).toEqual({
      tax_minor: "0", grand_total_minor: "1", rate_selection_kind: "ordinary_section13_single_version",
      journal_id: null, ass_val: "0.01", cgst_val: "0.00", sgst_val: "0.00", total_val: "0.01",
    });
    const replay = await command.execute(replayRequest(candidate.request));
    expect(replay).toEqual({ ...issued, replayed: true });
    expect(await candidateCensus(deploy, candidate.fixture.tenant, candidate.series.seriesId)).toEqual(afterIssue);
  }, 60_000);

  test("derives and issues every supported positive component family from original statutory locations", async () => {
    const cases = [
      {
        label: "native-family-sgst",
        configuration: "karnataka_supplier_karnataka_property" as const,
        family: "cgst_sgst",
        components: [{ identity: "cgst", amount: "250" }, { identity: "sgst", amount: "250" },
          { identity: "cgst", amount: "500" }, { identity: "sgst", amount: "500" }],
        igst: null, cgst: "7.50", sgst: "7.50", postingLines: 4, payableAccounts: 2,
      },
      {
        label: "native-family-utgst",
        configuration: "chandigarh_supplier_chandigarh_property" as const,
        family: "cgst_utgst",
        components: [{ identity: "cgst", amount: "250" }, { identity: "utgst", amount: "250" },
          { identity: "cgst", amount: "500" }, { identity: "utgst", amount: "500" }],
        igst: null, cgst: "7.50", sgst: "7.50", postingLines: 4, payableAccounts: 2,
      },
      {
        label: "native-family-igst",
        configuration: "maharashtra_supplier_karnataka_property" as const,
        family: "igst",
        components: [{ identity: "igst", amount: "500" }, { identity: "igst", amount: "1000" }],
        igst: "15.00", cgst: null, sgst: null, postingLines: 2, payableAccounts: 1,
      },
    ] as const;
    for (const expected of cases) {
      const candidate = await createNativeIssuanceFixture(deploy, runtime, {
        label: expected.label,
        roomNightAmounts: ["10000", "20000"],
        statutoryOriginalConfiguration: expected.configuration,
      });
      const command = new IssueIndiaNativeFiscalInvoiceCommand(runtime);
      const before = await candidateCensus(deploy, candidate.fixture.tenant, candidate.series.seriesId);
      const [considerationBefore] = await deploy<Array<{ amount: string }>>`
        SELECT COALESCE(sum(line.amount_minor),0)::text AS amount
        FROM public.posting_line line
        JOIN public.account account ON account.tenant_id=line.tenant_id AND account.id=line.account_id
        WHERE line.tenant_id=${candidate.fixture.tenant}::uuid AND account.role='revenue'`;
      if (!considerationBefore) throw new Error("Native family consideration baseline is unavailable");
      const issued = await command.execute(candidate.request);
      const afterIssue = await candidateCensus(deploy, candidate.fixture.tenant, candidate.series.seriesId);
      expect(afterIssue).toMatchObject({
        journals: before.journals + 1,
        lines: before.lines + expected.postingLines,
        documents: before.documents + 1,
        nextNo: (BigInt(before.nextNo) + 1n).toString(),
      });
      const [projection] = await deploy<Array<{
        component_family: string; transaction_value_minor: string; tax_minor: string;
        grand_total_minor: string; components: Array<{ identity: string; amount: string }>;
        journal_balance: string; guest_tax: string; payable_tax: string; payable_accounts: number;
        consideration_after: string; ass_val: string; igst_val: string | null; cgst_val: string | null;
        sgst_val: string | null; total_val: string;
      }>>`SELECT tax.component_family,tax.transaction_value_minor::text,tax.tax_minor::text,
          tax.grand_total_minor::text,
          (SELECT jsonb_agg(jsonb_build_object('identity',component.component_identity,
              'amount',component.tax_amount_minor::text) ORDER BY component.room_night_ordinal,
              component.component_ordinal)
            FROM public.india_gst_accommodation_final_component_tax_component component
            WHERE component.tenant_id=tax.tenant_id AND component.tax_id=tax.id) AS components,
          (SELECT sum(line.amount_minor)::text FROM public.posting_line line
            WHERE line.tenant_id=binding.tenant_id AND line.journal_id=binding.journal_id) AS journal_balance,
          (SELECT sum(line.amount_minor)::text FROM public.posting_line line
            WHERE line.tenant_id=binding.tenant_id AND line.journal_id=binding.journal_id
              AND line.folio_id=origin.folio_id) AS guest_tax,
          (SELECT (-sum(line.amount_minor))::text FROM public.posting_line line
            JOIN public.account account ON account.tenant_id=line.tenant_id AND account.id=line.account_id
            WHERE line.tenant_id=binding.tenant_id AND line.journal_id=binding.journal_id
              AND account.role='tax_payable') AS payable_tax,
          (SELECT count(DISTINCT line.account_id)::integer FROM public.posting_line line
            JOIN public.account account ON account.tenant_id=line.tenant_id AND account.id=line.account_id
            WHERE line.tenant_id=binding.tenant_id AND line.journal_id=binding.journal_id
              AND account.role='tax_payable') AS payable_accounts,
          (SELECT COALESCE(sum(line.amount_minor),0)::text FROM public.posting_line line
            JOIN public.account account ON account.tenant_id=line.tenant_id AND account.id=line.account_id
            WHERE line.tenant_id=origin.tenant_id AND account.role='revenue') AS consideration_after,
          document.content#>>'{ValDtls,AssVal}' AS ass_val,
          document.content#>>'{ValDtls,IgstVal}' AS igst_val,
          document.content#>>'{ValDtls,CgstVal}' AS cgst_val,
          document.content#>>'{ValDtls,SgstVal}' AS sgst_val,
          document.content#>>'{ValDtls,TotInvVal}' AS total_val
        FROM public.india_gst_native_fiscal_document_origin origin
        JOIN public.document document ON document.tenant_id=origin.tenant_id AND document.id=origin.document_id
        JOIN public.india_gst_native_invoice_timing timing
          ON timing.tenant_id=origin.tenant_id AND timing.id=origin.native_timing_id
        JOIN public.india_gst_accommodation_final_component_tax tax
          ON tax.tenant_id=timing.tenant_id AND tax.id=timing.tax_id
        JOIN public.india_gst_accommodation_final_component_tax_journal_binding binding
          ON binding.tenant_id=timing.tenant_id AND binding.id=timing.accounting_binding_id
        WHERE origin.tenant_id=${candidate.fixture.tenant}::uuid AND origin.document_id=${issued.documentId}::uuid`;
      if (!projection) throw new Error("Native tax-family projection is unavailable");
      expect(projection).toEqual({
        component_family: expected.family,
        transaction_value_minor: "30000",
        tax_minor: "1500",
        grand_total_minor: "31500",
        components: [...expected.components],
        journal_balance: "0",
        guest_tax: "1500",
        payable_tax: "1500",
        payable_accounts: expected.payableAccounts,
        consideration_after: considerationBefore.amount,
        ass_val: "300.00",
        igst_val: expected.igst,
        cgst_val: expected.cgst,
        sgst_val: expected.sgst,
        total_val: "315.00",
      });
      const replay = await command.execute(replayRequest(candidate.request));
      expect(replay).toEqual({ ...issued, replayed: true });
      expect(await candidateCensus(deploy, candidate.fixture.tenant, candidate.series.seriesId)).toEqual(afterIssue);
    }
  }, 120_000);

  test("issues after a committed genuine charge correction with complete source closure", async () => {
    for (const taxCase of [
      { label: "positive", amounts: ["10000"] as const, rounding: "exact_5_percent" as const,
        tax: "500", total: "10500", addedJournals: 1, addedLines: 4 },
      { label: "rounded-zero", amounts: ["1"] as const, rounding: "component_half_up" as const,
        tax: "0", total: "1", addedJournals: 0, addedLines: 0 },
    ]) {
      const candidate = await createNativeCorrectionFirstIssuanceFixture(deploy, runtime, {
        label: `correct-first-${taxCase.label}`, roomNightAmounts: taxCase.amounts,
        quotedTaxRounding: taxCase.rounding,
      });
      const before = await candidateCensus(deploy, candidate.fixture.tenant, candidate.series.seriesId);
      expect(before).toMatchObject({ journals: 3, lines: 6, documents: 0, nextNo: candidate.series.nextNo });
      const [sourceBefore] = await deploy<Array<{
        guest: string; revenue: string; valuation_sources: number; correction_journals: number;
        source_ids: string[];
      }>>`SELECT
          (SELECT sum(amount_minor)::text FROM public.posting_line
            WHERE tenant_id=${candidate.fixture.tenant}::uuid AND account_id=${candidate.fixture.guestAccount}::uuid) AS guest,
          (SELECT sum(line.amount_minor)::text FROM public.posting_line line JOIN public.account account
            ON account.tenant_id=line.tenant_id AND account.id=line.account_id
            WHERE line.tenant_id=${candidate.fixture.tenant}::uuid AND account.role='revenue') AS revenue,
          (SELECT count(*)::integer FROM public.india_gst_accommodation_valuation_source
            WHERE tenant_id=${candidate.fixture.tenant}::uuid AND valuation_id=${candidate.valuation.valuationId}::uuid) AS valuation_sources,
          (SELECT count(*)::integer FROM public.journal WHERE tenant_id=${candidate.fixture.tenant}::uuid
            AND reverses=${candidate.preparation.erroneous.result.journalId}::uuid) AS correction_journals,
          (SELECT array_agg(posting_root_id::text ORDER BY posting_root_id) FROM public.india_gst_accommodation_valuation_source
            WHERE tenant_id=${candidate.fixture.tenant}::uuid AND valuation_id=${candidate.valuation.valuationId}::uuid) AS source_ids`;
      if (!sourceBefore) throw new Error("Correction-first source closure is unavailable");
      expect(sourceBefore).toEqual({
        guest: taxCase.amounts[0], revenue: (-BigInt(taxCase.amounts[0])).toString(),
        valuation_sources: 3, correction_journals: 1,
        source_ids: [candidate.preparation.stay.postingRootId,
          candidate.preparation.erroneous.postingRootId,
          candidate.preparation.corrected.postingRootId].sort(),
      });
      const command = new IssueIndiaNativeFiscalInvoiceCommand(runtime);
      const issued = await command.execute(candidate.request);
      const afterIssue = await candidateCensus(deploy, candidate.fixture.tenant, candidate.series.seriesId);
      expect(afterIssue).toEqual({ ...before, journals: before.journals + taxCase.addedJournals,
        lines: before.lines + taxCase.addedLines, documents: before.documents + 1,
        origins: before.origins + 1, accountingBindings: before.accountingBindings + 1,
        facts: before.facts + (taxCase.addedJournals ? 3 : 2),
        events: before.events + (taxCase.addedJournals ? 4 : 3),
        idempotencyRows: before.idempotencyRows + 1, issueReceipts: before.issueReceipts + 1,
        nextNo: (BigInt(before.nextNo) + 1n).toString() });
      const [document] = await deploy<Array<{
        document_id: string; document_number: string; document_kind: string; document_status: string;
        folio_id: string; reservation_id: string; window_no: number; value: string; tax: string;
        total: string; source_count: number; source_ids: string[]; guest_after: string; revenue_after: string;
        tax_lines: Array<{ seq: number; account: string; folio: string | null; amount: string }>;
      }>>`
        SELECT document.id::text AS document_id,document.doc_no AS document_number,
          document.kind AS document_kind,document.status AS document_status,
          origin.folio_id::text,origin.reservation_id::text,folio.window_no,
          tax.transaction_value_minor::text AS value,tax.tax_minor::text AS tax,
          tax.grand_total_minor::text AS total,
          (SELECT count(*)::integer FROM public.india_gst_accommodation_valuation_source source
            WHERE source.tenant_id=tax.tenant_id AND source.valuation_id=tax.valuation_id) AS source_count,
          (SELECT array_agg(source.posting_root_id::text ORDER BY source.posting_root_id)
            FROM public.india_gst_accommodation_valuation_source source
            WHERE source.tenant_id=tax.tenant_id AND source.valuation_id=tax.valuation_id) AS source_ids,
          (SELECT COALESCE(sum(line.amount_minor),0)::text FROM public.posting_line line
            WHERE line.tenant_id=origin.tenant_id AND line.account_id=${candidate.fixture.guestAccount}::uuid) AS guest_after,
          (SELECT COALESCE(sum(line.amount_minor),0)::text FROM public.posting_line line JOIN public.account account
            ON account.tenant_id=line.tenant_id AND account.id=line.account_id
            WHERE line.tenant_id=origin.tenant_id AND account.role='revenue') AS revenue_after,
          COALESCE((SELECT jsonb_agg(jsonb_build_object('seq',line.seq,'account',line.account_id::text,
              'folio',line.folio_id::text,'amount',line.amount_minor::text) ORDER BY line.seq)
            FROM public.posting_line line WHERE line.tenant_id=binding.tenant_id
              AND line.journal_id=binding.journal_id),'[]'::jsonb) AS tax_lines
        FROM public.india_gst_native_invoice_timing timing
        JOIN public.india_gst_native_fiscal_document_origin origin
          ON origin.tenant_id=timing.tenant_id AND origin.native_timing_id=timing.id
        JOIN public.document document ON document.tenant_id=origin.tenant_id AND document.id=origin.document_id
        JOIN public.folio folio ON folio.tenant_id=origin.tenant_id AND folio.id=origin.folio_id
        JOIN public.india_gst_accommodation_final_component_tax tax
          ON tax.tenant_id=timing.tenant_id AND tax.id=timing.tax_id
        JOIN public.india_gst_accommodation_final_component_tax_journal_binding binding
          ON binding.tenant_id=timing.tenant_id AND binding.id=timing.accounting_binding_id
        WHERE timing.tenant_id=${candidate.fixture.tenant}::uuid
          AND timing.prospective_document_id=${issued.documentId}::uuid`;
      const halfTax = (BigInt(taxCase.tax) / 2n).toString();
      const taxLines = taxCase.addedLines ? [
        { seq: 1, account: candidate.fixture.guestAccount, folio: candidate.fixture.folio, amount: halfTax },
        { seq: 2, account: candidate.payableIds[0]!, folio: null, amount: `-${halfTax}` },
        { seq: 3, account: candidate.fixture.guestAccount, folio: candidate.fixture.folio, amount: halfTax },
        { seq: 4, account: candidate.payableIds[1]!, folio: null, amount: `-${halfTax}` },
      ] : [];
      expect(document).toEqual({ document_id: issued.documentId, document_number: issued.docNo,
        document_kind: "invoice", document_status: "issued", folio_id: candidate.fixture.folio,
        reservation_id: candidate.fixture.reservation, window_no: 1, value: taxCase.amounts[0], tax: taxCase.tax,
        total: taxCase.total, source_count: 3, source_ids: [candidate.preparation.stay.postingRootId,
          candidate.preparation.erroneous.postingRootId, candidate.preparation.corrected.postingRootId].sort(),
        guest_after: (BigInt(taxCase.amounts[0]) + BigInt(taxCase.tax)).toString(),
        revenue_after: (-BigInt(taxCase.amounts[0])).toString(), tax_lines: taxLines });
      const replay = await command.execute(replayRequest(candidate.request));
      expect(replay).toEqual({ ...issued, replayed: true });
      expect(await candidateCensus(deploy, candidate.fixture.tenant, candidate.series.seriesId)).toEqual(afterIssue);
    }
  }, 120_000);

  test("issues against the governed destination after a committed complete folio transfer", async () => {
    for (const taxCase of [
      { label: "positive", amounts: ["10000"] as const, rounding: "exact_5_percent" as const,
        tax: "500", total: "10500", addedJournals: 1, addedLines: 4 },
      { label: "rounded-zero", amounts: ["1"] as const, rounding: "component_half_up" as const,
        tax: "0", total: "1", addedJournals: 0, addedLines: 0 },
    ]) {
      const candidate = await createNativeTransferFirstIssuanceFixture(deploy, runtime, {
        label: `transfer-first-${taxCase.label}`, roomNightAmounts: taxCase.amounts,
        quotedTaxRounding: taxCase.rounding,
      });
      expect(candidate.request.folioId).toBe(candidate.preparation.destination.folioId);
      const before = await candidateCensus(deploy, candidate.fixture.tenant, candidate.series.seriesId);
      expect(before).toMatchObject({ journals: 2, lines: 4, documents: 0, nextNo: candidate.series.nextNo });
      const balances = await deploy<Array<{ id: string; amount: string }>>`
        SELECT folio.id::text,COALESCE(balance.balance_minor,0)::text AS amount
        FROM public.folio folio LEFT JOIN public.folio_balance balance
          ON balance.tenant_id=folio.tenant_id AND balance.folio_id=folio.id
        WHERE folio.tenant_id=${candidate.fixture.tenant}::uuid
          AND folio.reservation_id=${candidate.fixture.reservation}::uuid ORDER BY folio.window_no`;
      expect(balances).toEqual([
        { id: candidate.fixture.folio, amount: "0" },
        { id: candidate.preparation.destination.folioId, amount: taxCase.amounts[0] },
      ]);
      const fragments = await deploy<Array<{
        folio_id: string; window_no: number; reservation_id: string; amount: string;
        account_id: string; root_id: string; journal_id: string;
      }>>`SELECT line.folio_id::text,folio.window_no,folio.reservation_id::text,
          line.amount_minor::text AS amount,line.account_id::text,line.folio_transfer_root_line_id::text AS root_id,
          line.journal_id::text
        FROM public.posting_line line JOIN public.folio folio
          ON folio.tenant_id=line.tenant_id AND folio.id=line.folio_id
        WHERE line.tenant_id=${candidate.fixture.tenant}::uuid
          AND line.folio_transfer_root_line_id=${candidate.preparation.charge.postingRootId}::uuid
        ORDER BY folio.window_no`;
      expect(fragments).toEqual([
        { folio_id: candidate.fixture.folio, window_no: 1, reservation_id: candidate.fixture.reservation,
          amount: `-${taxCase.amounts[0]}`, account_id: candidate.fixture.guestAccount,
          root_id: candidate.preparation.charge.postingRootId, journal_id: candidate.preparation.transfer.journalId },
        { folio_id: candidate.preparation.destination.folioId, window_no: 2,
          reservation_id: candidate.fixture.reservation, amount: taxCase.amounts[0],
          account_id: candidate.fixture.guestAccount, root_id: candidate.preparation.charge.postingRootId,
          journal_id: candidate.preparation.transfer.journalId },
      ]);
      const [closure] = await deploy<Array<{
        transfer_journals: number; transfer_fragments: number; valuation_sources: number;
        guest: string; revenue: string;
      }>>`SELECT
          (SELECT count(DISTINCT journal_id)::integer FROM public.posting_line
            WHERE tenant_id=${candidate.fixture.tenant}::uuid AND folio_transfer_root_line_id IS NOT NULL) AS transfer_journals,
          (SELECT count(*)::integer FROM public.posting_line WHERE tenant_id=${candidate.fixture.tenant}::uuid
            AND folio_transfer_root_line_id=${candidate.preparation.charge.postingRootId}::uuid) AS transfer_fragments,
          (SELECT count(*)::integer FROM public.india_gst_accommodation_valuation_source
            WHERE tenant_id=${candidate.fixture.tenant}::uuid AND valuation_id=${candidate.valuation.valuationId}::uuid) AS valuation_sources,
          (SELECT sum(line.amount_minor)::text FROM public.posting_line line JOIN public.account account
            ON account.tenant_id=line.tenant_id AND account.id=line.account_id
            WHERE line.tenant_id=${candidate.fixture.tenant}::uuid AND account.role='guest') AS guest,
          (SELECT sum(line.amount_minor)::text FROM public.posting_line line JOIN public.account account
            ON account.tenant_id=line.tenant_id AND account.id=line.account_id
            WHERE line.tenant_id=${candidate.fixture.tenant}::uuid AND account.role='revenue') AS revenue`;
      expect(closure).toEqual({ transfer_journals: 1, transfer_fragments: 2, valuation_sources: 1,
        guest: taxCase.amounts[0], revenue: (-BigInt(taxCase.amounts[0])).toString() });
      const command = new IssueIndiaNativeFiscalInvoiceCommand(runtime);
      const issued = await command.execute(candidate.request);
      const afterIssue = await candidateCensus(deploy, candidate.fixture.tenant, candidate.series.seriesId);
      expect(afterIssue).toEqual({ ...before, journals: before.journals + taxCase.addedJournals,
        lines: before.lines + taxCase.addedLines, documents: before.documents + 1,
        origins: before.origins + 1, accountingBindings: before.accountingBindings + 1,
        facts: before.facts + (taxCase.addedJournals ? 3 : 2),
        events: before.events + (taxCase.addedJournals ? 4 : 3),
        idempotencyRows: before.idempotencyRows + 1, issueReceipts: before.issueReceipts + 1,
        nextNo: (BigInt(before.nextNo) + 1n).toString() });
      const [document] = await deploy<Array<{
        document_id: string; document_number: string; document_kind: string; document_status: string;
        folio_id: string; reservation_id: string; window_no: number; value: string; tax: string; total: string;
        guest_after: string; revenue_after: string;
        tax_lines: Array<{ seq: number; account: string; folio: string | null; amount: string }>;
      }>>`
        SELECT document.id::text AS document_id,document.doc_no AS document_number,
          document.kind AS document_kind,document.status AS document_status,
          origin.folio_id::text,origin.reservation_id::text,folio.window_no,
          tax.transaction_value_minor::text AS value,
          tax.tax_minor::text AS tax,tax.grand_total_minor::text AS total
          ,(SELECT COALESCE(sum(line.amount_minor),0)::text FROM public.posting_line line
            WHERE line.tenant_id=origin.tenant_id AND line.account_id=${candidate.fixture.guestAccount}::uuid) AS guest_after
          ,(SELECT COALESCE(sum(line.amount_minor),0)::text FROM public.posting_line line JOIN public.account account
            ON account.tenant_id=line.tenant_id AND account.id=line.account_id
            WHERE line.tenant_id=origin.tenant_id AND account.role='revenue') AS revenue_after
          ,COALESCE((SELECT jsonb_agg(jsonb_build_object('seq',line.seq,'account',line.account_id::text,
              'folio',line.folio_id::text,'amount',line.amount_minor::text) ORDER BY line.seq)
            FROM public.posting_line line WHERE line.tenant_id=binding.tenant_id
              AND line.journal_id=binding.journal_id),'[]'::jsonb) AS tax_lines
        FROM public.india_gst_native_fiscal_document_origin origin
        JOIN public.document document ON document.tenant_id=origin.tenant_id AND document.id=origin.document_id
        JOIN public.folio folio ON folio.tenant_id=origin.tenant_id AND folio.id=origin.folio_id
        JOIN public.india_gst_native_invoice_timing timing
          ON timing.tenant_id=origin.tenant_id AND timing.id=origin.native_timing_id
        JOIN public.india_gst_accommodation_final_component_tax tax
          ON tax.tenant_id=timing.tenant_id AND tax.id=timing.tax_id
        JOIN public.india_gst_accommodation_final_component_tax_journal_binding binding
          ON binding.tenant_id=timing.tenant_id AND binding.id=timing.accounting_binding_id
        WHERE origin.tenant_id=${candidate.fixture.tenant}::uuid AND origin.document_id=${issued.documentId}::uuid`;
      const halfTax = (BigInt(taxCase.tax) / 2n).toString();
      const taxLines = taxCase.addedLines ? [
        { seq: 1, account: candidate.fixture.guestAccount,
          folio: candidate.preparation.destination.folioId, amount: halfTax },
        { seq: 2, account: candidate.payableIds[0]!, folio: null, amount: `-${halfTax}` },
        { seq: 3, account: candidate.fixture.guestAccount,
          folio: candidate.preparation.destination.folioId, amount: halfTax },
        { seq: 4, account: candidate.payableIds[1]!, folio: null, amount: `-${halfTax}` },
      ] : [];
      expect(document).toEqual({ document_id: issued.documentId, document_number: issued.docNo,
        document_kind: "invoice", document_status: "issued",
        folio_id: candidate.preparation.destination.folioId, reservation_id: candidate.fixture.reservation,
        window_no: 2, value: taxCase.amounts[0], tax: taxCase.tax, total: taxCase.total,
        guest_after: (BigInt(taxCase.amounts[0]) + BigInt(taxCase.tax)).toString(),
        revenue_after: (-BigInt(taxCase.amounts[0])).toString(), tax_lines: taxLines });
      const replay = await command.execute(replayRequest(candidate.request));
      expect(replay).toEqual({ ...issued, replayed: true });
      expect(await candidateCensus(deploy, candidate.fixture.tenant, candidate.series.seriesId)).toEqual(afterIssue);
    }
  }, 120_000);

  test("issues and permanently replays the authentic 500-root 366-night native boundary", async () => {
    const stage = async <T>(label: string, run: () => T | Promise<T>): Promise<T> => {
      const started = performance.now();
      try {
        return await run();
      } finally {
        console.info(`[Order434 maximum] ${label}: ${Math.round(performance.now() - started)}ms`);
      }
    };
    const candidate = await stage("fixture setup", () => createNativeMaximumBoundIssuanceFixture(deploy, runtime, {
      label: "native-maximum-bound",
    }));
    const roots = candidate.preparation.charges.map(charge => charge.postingRootId).sort();
    expect(new Set(roots).size).toBe(500);
    expect(new Set(candidate.fixture.revenueAccounts).size).toBe(500);
    await stage("prefix assertions", async () => {
      const [prefix] = await deploy<Array<{
      source_count: number; distinct_roots: number; source_total: string; allocation_count: number;
      allocation_roots: number; allocation_nights: number; allocation_total: string;
      minimum_allocation: string; maximum_allocation: string; night_count: number; night_total: string;
      consideration_journals: number; consideration_lines: number; revenue_accounts: number;
      duplicate_revenue_accounts: number; guest_before: string; revenue_before: string;
      stored_roots: string[];
    }>>`WITH source AS (
          SELECT * FROM public.india_gst_accommodation_valuation_source
          WHERE tenant_id=${candidate.fixture.tenant}::uuid AND valuation_id=${candidate.valuation.valuationId}::uuid
        ), allocation AS (
          SELECT * FROM public.india_gst_accommodation_valuation_allocation
          WHERE tenant_id=${candidate.fixture.tenant}::uuid AND valuation_id=${candidate.valuation.valuationId}::uuid
        ), night AS (
          SELECT * FROM public.india_gst_accommodation_valuation_room_night
          WHERE tenant_id=${candidate.fixture.tenant}::uuid AND valuation_id=${candidate.valuation.valuationId}::uuid
        ), revenue_use AS (
          SELECT line.account_id,count(*)::integer AS uses FROM public.posting_line line
          JOIN public.account account ON account.tenant_id=line.tenant_id AND account.id=line.account_id
          WHERE line.tenant_id=${candidate.fixture.tenant}::uuid AND account.role='revenue'
          GROUP BY line.account_id
        ) SELECT
          (SELECT count(*)::integer FROM source) AS source_count,
          (SELECT count(DISTINCT posting_root_id)::integer FROM source) AS distinct_roots,
          (SELECT sum(current_amount_minor)::text FROM source) AS source_total,
          (SELECT count(*)::integer FROM allocation) AS allocation_count,
          (SELECT count(DISTINCT posting_root_id)::integer FROM allocation) AS allocation_roots,
          (SELECT count(DISTINCT ordinal)::integer FROM allocation) AS allocation_nights,
          (SELECT sum(amount_minor)::text FROM allocation) AS allocation_total,
          (SELECT min(amount_minor)::text FROM allocation) AS minimum_allocation,
          (SELECT max(amount_minor)::text FROM allocation) AS maximum_allocation,
          (SELECT count(*)::integer FROM night) AS night_count,
          (SELECT sum(transaction_value_minor)::text FROM night) AS night_total,
          (SELECT count(DISTINCT journal_id)::integer FROM public.posting_line
            WHERE tenant_id=${candidate.fixture.tenant}::uuid) AS consideration_journals,
          (SELECT count(*)::integer FROM public.posting_line
            WHERE tenant_id=${candidate.fixture.tenant}::uuid) AS consideration_lines,
          (SELECT count(*)::integer FROM revenue_use) AS revenue_accounts,
          (SELECT count(*)::integer FROM revenue_use WHERE uses<>1) AS duplicate_revenue_accounts,
          (SELECT sum(amount_minor)::text FROM public.posting_line
            WHERE tenant_id=${candidate.fixture.tenant}::uuid AND account_id=${candidate.fixture.guestAccount}::uuid) AS guest_before,
          (SELECT sum(line.amount_minor)::text FROM public.posting_line line JOIN public.account account
            ON account.tenant_id=line.tenant_id AND account.id=line.account_id
            WHERE line.tenant_id=${candidate.fixture.tenant}::uuid AND account.role='revenue') AS revenue_before,
          (SELECT array_agg(posting_root_id::text ORDER BY posting_root_id) FROM source) AS stored_roots`;
      if (!prefix) throw new Error("Maximum native financial prefix is unavailable");
      expect(prefix).toEqual({ source_count: 500, distinct_roots: 500, source_total: "3660000",
        allocation_count: 183000, allocation_roots: 500, allocation_nights: 366,
        allocation_total: "3660000", minimum_allocation: "20", maximum_allocation: "20",
        night_count: 366, night_total: "3660000", consideration_journals: 500,
        consideration_lines: 1000, revenue_accounts: 500, duplicate_revenue_accounts: 0,
        guest_before: "3660000", revenue_before: "-3660000", stored_roots: roots });
    });
    const before = await candidateCensus(deploy, candidate.fixture.tenant, candidate.series.seriesId);
    expect(before).toMatchObject({ journals: 500, lines: 1000, documents: 0, nextNo: candidate.series.nextNo });
    const command = new IssueIndiaNativeFiscalInvoiceCommand(runtime);
    const issued = await stage("issue", () => command.execute(candidate.request));
    const afterIssue = await candidateCensus(deploy, candidate.fixture.tenant, candidate.series.seriesId);
    expect(afterIssue).toEqual({ ...before, journals: before.journals + 1, lines: before.lines + 4,
      documents: before.documents + 1, origins: before.origins + 1,
      accountingBindings: before.accountingBindings + 1, facts: before.facts + 3,
      events: before.events + 4, idempotencyRows: before.idempotencyRows + 1,
      issueReceipts: before.issueReceipts + 1, nextNo: (BigInt(before.nextNo) + 1n).toString() });
    await stage("exact account and totals assertions", async () => {
      const [result] = await deploy<Array<{
      document_id: string; document_number: string; series_id: string; origin_folio: string;
      origin_reservation: string; tax_journal_id: string; tax_journal_lines: number;
      source_count: number; night_count: number;
      component_count: number; transaction_value: string; tax: string; total: string;
      guest_after: string; revenue_after: string; payable_after: string; tax_journal_balance: string;
      exact_account_ids: string[]; source_guest_accounts: number; source_revenue_accounts: number;
      routed_payable_accounts: number;
      }>>`SELECT document.id::text AS document_id,document.doc_no AS document_number,
        document.series_id::text,origin.folio_id::text AS origin_folio,
        origin.reservation_id::text AS origin_reservation,binding.journal_id::text AS tax_journal_id,
        (SELECT count(*)::integer FROM public.posting_line line
          WHERE line.tenant_id=binding.tenant_id AND line.journal_id=binding.journal_id) AS tax_journal_lines,
        (SELECT count(*)::integer FROM public.india_gst_accommodation_valuation_source source
          WHERE source.tenant_id=tax.tenant_id AND source.valuation_id=tax.valuation_id) AS source_count,
        (SELECT count(*)::integer FROM public.india_gst_accommodation_final_component_tax_room_night night
          WHERE night.tenant_id=tax.tenant_id AND night.tax_id=tax.id) AS night_count,
        (SELECT count(*)::integer FROM public.india_gst_accommodation_final_component_tax_component component
          WHERE component.tenant_id=tax.tenant_id AND component.tax_id=tax.id) AS component_count,
        tax.transaction_value_minor::text AS transaction_value,tax.tax_minor::text AS tax,
        tax.grand_total_minor::text AS total,
        (SELECT sum(amount_minor)::text FROM public.posting_line line
          WHERE line.tenant_id=origin.tenant_id AND line.account_id=${candidate.fixture.guestAccount}::uuid) AS guest_after,
        (SELECT sum(line.amount_minor)::text FROM public.posting_line line JOIN public.account account
          ON account.tenant_id=line.tenant_id AND account.id=line.account_id
          WHERE line.tenant_id=origin.tenant_id AND account.role='revenue') AS revenue_after,
        (SELECT (-sum(line.amount_minor))::text FROM public.posting_line line JOIN public.account account
          ON account.tenant_id=line.tenant_id AND account.id=line.account_id
          WHERE line.tenant_id=origin.tenant_id AND account.role='tax_payable') AS payable_after,
        (SELECT sum(line.amount_minor)::text FROM public.posting_line line
          WHERE line.tenant_id=binding.tenant_id AND line.journal_id=binding.journal_id) AS tax_journal_balance,
        (SELECT array_agg(account_id ORDER BY account_id) FROM (
          SELECT DISTINCT root.account_id::text AS account_id
          FROM public.india_gst_accommodation_valuation_source source
          JOIN public.posting_line root ON root.tenant_id=source.tenant_id AND root.id=source.posting_root_id
          WHERE source.tenant_id=tax.tenant_id AND source.valuation_id=tax.valuation_id
          UNION
          SELECT DISTINCT peer.account_id::text
          FROM public.india_gst_accommodation_valuation_source source
          JOIN public.posting_line root ON root.tenant_id=source.tenant_id AND root.id=source.posting_root_id
          JOIN public.posting_line peer ON peer.tenant_id=root.tenant_id AND peer.journal_id=root.journal_id
          JOIN public.account account ON account.tenant_id=peer.tenant_id AND account.id=peer.account_id
          WHERE source.tenant_id=tax.tenant_id AND source.valuation_id=tax.valuation_id AND account.role='revenue'
          UNION
          SELECT DISTINCT route.credit_account_id::text
          FROM public.tax_semantic_route mapping
          JOIN public.tx_code_route route ON route.tenant_id=mapping.tenant_id
            AND route.property_node=mapping.property_node AND route.currency=mapping.currency
            AND route.tx_code=mapping.tx_code
          JOIN public.account account ON account.tenant_id=route.tenant_id AND account.id=route.credit_account_id
          WHERE mapping.tenant_id=tax.tenant_id AND mapping.property_node=origin.property_node
            AND mapping.currency='INR' AND mapping.jurisdiction_extension_id=tax.selected_extension_id
            AND mapping.semantic_kind='tax' AND account.role='tax_payable'
            AND lower(mapping.semantic_code) IN (SELECT DISTINCT component.component_identity
              FROM public.india_gst_accommodation_final_component_tax_component component
              WHERE component.tenant_id=tax.tenant_id AND component.tax_id=tax.id)
        ) exact_accounts) AS exact_account_ids,
        (SELECT count(DISTINCT root.account_id)::integer
          FROM public.india_gst_accommodation_valuation_source source
          JOIN public.posting_line root ON root.tenant_id=source.tenant_id AND root.id=source.posting_root_id
          JOIN public.account account ON account.tenant_id=root.tenant_id AND account.id=root.account_id
          WHERE source.tenant_id=tax.tenant_id AND source.valuation_id=tax.valuation_id
            AND account.role='guest') AS source_guest_accounts,
        (SELECT count(DISTINCT peer.account_id)::integer
          FROM public.india_gst_accommodation_valuation_source source
          JOIN public.posting_line root ON root.tenant_id=source.tenant_id AND root.id=source.posting_root_id
          JOIN public.posting_line peer ON peer.tenant_id=root.tenant_id AND peer.journal_id=root.journal_id
          JOIN public.account account ON account.tenant_id=peer.tenant_id AND account.id=peer.account_id
          WHERE source.tenant_id=tax.tenant_id AND source.valuation_id=tax.valuation_id
            AND account.role='revenue') AS source_revenue_accounts,
        (SELECT count(DISTINCT route.credit_account_id)::integer FROM public.tax_semantic_route mapping
          JOIN public.tx_code_route route ON route.tenant_id=mapping.tenant_id
            AND route.property_node=mapping.property_node AND route.currency=mapping.currency
            AND route.tx_code=mapping.tx_code
          JOIN public.account account ON account.tenant_id=route.tenant_id AND account.id=route.credit_account_id
          WHERE mapping.tenant_id=tax.tenant_id AND mapping.property_node=origin.property_node
            AND mapping.currency='INR' AND mapping.jurisdiction_extension_id=tax.selected_extension_id
            AND mapping.semantic_kind='tax' AND account.role='tax_payable'
            AND lower(mapping.semantic_code) IN (SELECT DISTINCT component.component_identity
              FROM public.india_gst_accommodation_final_component_tax_component component
              WHERE component.tenant_id=tax.tenant_id AND component.tax_id=tax.id)) AS routed_payable_accounts
      FROM public.india_gst_native_fiscal_document_origin origin
      JOIN public.document document ON document.tenant_id=origin.tenant_id AND document.id=origin.document_id
      JOIN public.india_gst_native_invoice_timing timing
        ON timing.tenant_id=origin.tenant_id AND timing.id=origin.native_timing_id
      JOIN public.india_gst_accommodation_final_component_tax tax
        ON tax.tenant_id=timing.tenant_id AND tax.id=timing.tax_id
      JOIN public.india_gst_accommodation_final_component_tax_journal_binding binding
        ON binding.tenant_id=timing.tenant_id AND binding.id=timing.accounting_binding_id
      WHERE origin.tenant_id=${candidate.fixture.tenant}::uuid AND origin.document_id=${issued.documentId}::uuid`;
      expect(result).toEqual({ document_id: issued.documentId, document_number: issued.docNo,
        series_id: candidate.series.seriesId, origin_folio: candidate.fixture.folio,
        origin_reservation: candidate.fixture.reservation, tax_journal_id: expect.any(String), tax_journal_lines: 4,
        source_count: 500, night_count: 366, component_count: 732,
        transaction_value: "3660000", tax: "183000", total: "3843000",
        guest_after: "3843000", revenue_after: "-3660000", payable_after: "183000",
        tax_journal_balance: "0",
        exact_account_ids: [candidate.fixture.guestAccount, ...candidate.fixture.revenueAccounts,
          ...candidate.payableIds].sort(),
        source_guest_accounts: 1, source_revenue_accounts: 500, routed_payable_accounts: 2 });
    });
    await stage("replay", async () => {
      const replay = await command.execute(replayRequest(candidate.request));
      expect(replay).toEqual({ ...issued, replayed: true });
    });
    await stage("final census", async () => {
      expect(await candidateCensus(deploy, candidate.fixture.tenant, candidate.series.seriesId)).toEqual(afterIssue);
    });
  }, 300_000);

  test("rejects a one-minor valuation that cannot match the immutable fully-attributed payment root", async () => {
    const candidate = await createNativeIssuanceFixture(deploy, runtime, {
      label: "native-completion-zero",
      roomNightAmounts: ["10000"],
      chargeAmountMinor: "1",
    });
    const before = await candidateCensus(deploy, candidate.fixture.tenant, candidate.series.seriesId);
    await expect(new IssueIndiaNativeFiscalInvoiceCommand(runtime).execute(candidate.request))
      .rejects.toThrow("native final tax preview conflicts with selected rate or consideration");
    expect(await candidateCensus(deploy, candidate.fixture.tenant, candidate.series.seriesId)).toEqual(before);
  }, 60_000);

  test("issues and permanently replays a genuine Section14 invoice across distinct supply and rate-selection dates", async () => {
    const candidate = await createNativeIssuanceFixture(deploy, runtime, {
      label: "native-completion-genuine",
      roomNightAmounts: ["10000"],
      serviceProvisionDate: "2025-09-20",
      supplierBooksEntryDate: "2025-09-25",
      supplierBankCreditDate: "2025-09-25",
      calendarEvidence: NATIVE_ISSUANCE_TEST_CUTOVER_CALENDAR,
    });
    const before = await candidateCensus(deploy, candidate.fixture.tenant, candidate.series.seriesId);
    const command = new IssueIndiaNativeFiscalInvoiceCommand(runtime);
    const issued = await command.execute(candidate.request);
    const afterIssue = await candidateCensus(deploy, candidate.fixture.tenant, candidate.series.seriesId);
    expect(afterIssue.documents).toBe(before.documents + 1);
    expect(afterIssue.nextNo).toBe((BigInt(before.nextNo) + 1n).toString());
    const [projection] = await deploy<Array<{
      statutory_supply_date: string; service_provision_date: string; payment_receipt_date: string;
      native_time_of_supply_date: string; selected_rate_time_of_supply_date: string;
      rate_change_date: string; section14_case: string; selected_version_side: string;
      selected_extension_version: number; app_kind: string; tax_kind: string;
      tax_minor: string; grand_total_minor: string;
    }>>`SELECT supplier_status.status_as_of::text AS statutory_supply_date,
        app.service_provision_date::text,app.payment_receipt_date::text,
        app.time_of_supply_date::text AS native_time_of_supply_date,
        CASE app.section14_case
          WHEN 'supply_before_invoice_after_payment_after'
            THEN least(app.invoice_issue_date,app.payment_receipt_date)::text
          WHEN 'supply_invoice_before_payment_after' THEN app.invoice_issue_date::text
          WHEN 'supply_payment_before_invoice_after' THEN app.payment_receipt_date::text
          WHEN 'supply_after_invoice_before_payment_after' THEN app.payment_receipt_date::text
          WHEN 'supply_after_invoice_payment_before'
            THEN least(app.invoice_issue_date,app.payment_receipt_date)::text
          WHEN 'supply_invoice_after_payment_before' THEN app.invoice_issue_date::text
        END AS selected_rate_time_of_supply_date,
        app.rate_change_date::text,app.section14_case,
        app.selected_version_side,app.selected_extension_version,
        app.rate_selection_kind AS app_kind,tax.rate_selection_kind AS tax_kind,
        tax.tax_minor::text,tax.grand_total_minor::text
      FROM public.india_gst_native_fiscal_document_origin origin
      JOIN public.india_gst_native_invoice_timing timing
        ON timing.tenant_id=origin.tenant_id AND timing.id=origin.native_timing_id
      JOIN public.india_gst_supplier_registration_status_snapshot supplier_status
        ON supplier_status.tenant_id=timing.tenant_id AND supplier_status.id=timing.supplier_registration_status_id
      JOIN public.india_gst_accommodation_quoted_rate_applicability app
        ON app.tenant_id=timing.tenant_id AND app.id=timing.applicability_id
      JOIN public.india_gst_accommodation_final_component_tax tax
        ON tax.tenant_id=timing.tenant_id AND tax.id=timing.tax_id
      WHERE origin.tenant_id=${candidate.fixture.tenant}::uuid AND origin.document_id=${issued.documentId}::uuid`;
    if (!projection) throw new Error("Genuine native completion projection is unavailable");
    expect(projection).toEqual({
      statutory_supply_date: "2025-09-20",
      service_provision_date: "2025-09-20",
      payment_receipt_date: "2025-09-25",
      native_time_of_supply_date: "2025-09-20",
      selected_rate_time_of_supply_date: "2025-09-25",
      rate_change_date: "2025-09-22",
      section14_case: "supply_before_invoice_after_payment_after",
      selected_version_side: "successor",
      selected_extension_version: 2,
      app_kind: "genuine_section14_rate_change",
      tax_kind: "genuine_section14_rate_change",
      tax_minor: "500",
      grand_total_minor: "10500",
    });
    expect(projection.native_time_of_supply_date).not.toBe(projection.selected_rate_time_of_supply_date);
    const replay = await command.execute(replayRequest(candidate.request));
    expect(replay).toEqual({ ...issued, replayed: true });
    expect(await candidateCensus(deploy, candidate.fixture.tenant, candidate.series.seriesId)).toEqual(afterIssue);
  }, 60_000);

  test("permanently replays after exact ephemeral receipt and issuance events are retained away", async () => {
    const candidate = await createNativeIssuanceFixture(deploy, runtime, {
      label: "native-retained-replay",
      roomNightAmounts: ["10000"],
    });
    const command = new IssueIndiaNativeFiscalInvoiceCommand(runtime);
    const before = await candidateCensus(deploy, candidate.fixture.tenant, candidate.series.seriesId);
    const issued = await command.execute(candidate.request);
    const afterIssue = await candidateCensus(deploy, candidate.fixture.tenant, candidate.series.seriesId);
    expect(afterIssue).toMatchObject({
      journals: before.journals + 1,
      lines: before.lines + 4,
      documents: before.documents + 1,
      origins: before.origins + 1,
      accountingBindings: before.accountingBindings + 1,
      issueReceipts: before.issueReceipts + 1,
      nextNo: (BigInt(before.nextNo) + 1n).toString(),
    });

    const [retained] = await deploy.begin(async tx => {
      await tx`SELECT set_config('app.tenant_id',${candidate.fixture.tenant},true)`;
      const events = await tx<Array<{ id: string; event_type: string }>>`
        SELECT event.id::text,event.event_type
        FROM public.india_gst_native_invoice_timing timing
        JOIN public.outbox event ON event.tenant_id=timing.tenant_id
          AND ((event.id=timing.request_event_id
              AND event.seq=timing.request_event_seq
              AND event.aggregate_type='india_gst_native_invoice_timing'
              AND event.aggregate_id=timing.id
              AND event.event_type='india_gst.native_accommodation_accounting_requested')
            OR (event.aggregate_type='document'
              AND event.aggregate_id=timing.prospective_document_id
              AND event.event_type='document.issued'))
        WHERE timing.tenant_id=${candidate.fixture.tenant}::uuid
          AND timing.prospective_document_id=${issued.documentId}::uuid
          AND event.correlation_id=${candidate.request.envelope.requestId}::uuid
        ORDER BY event.event_type`;
      expect(events.map(event => event.event_type)).toEqual([
        "document.issued",
        "india_gst.native_accommodation_accounting_requested",
      ]);
      const eventIds = `{${events.map(event => event.id).join(",")}}`;
      const [processed] = await tx<Array<{ count: number }>>`
        SELECT count(*)::integer AS count FROM public.consumer_processed
        WHERE outbox_id=ANY(${eventIds}::uuid[])`;
      expect(processed?.count).toBe(0);
      const removedEvents = await tx<Array<{ id: string }>>`
        DELETE FROM public.outbox
        WHERE tenant_id=${candidate.fixture.tenant}::uuid AND id=ANY(${eventIds}::uuid[])
        RETURNING id::text`;
      const removedReceipts = await tx<Array<{ key_hash: string }>>`
        DELETE FROM public.api_idempotency receipt
        USING public.india_gst_native_invoice_timing timing
        WHERE receipt.tenant_id=${candidate.fixture.tenant}::uuid
          AND receipt.operation='document.issued'
          AND receipt.key_hash=timing.request_key_hash
          AND receipt.request_hash=timing.request_hash
          AND receipt.response_status=201
          AND receipt.completed_at IS NOT NULL
          AND receipt.response_body=pg_catalog.jsonb_build_object(
            'documentId',timing.prospective_document_id::text,
            'docNo',${issued.docNo}::text,'sha256',${issued.sha256}::text)
          AND timing.tenant_id=receipt.tenant_id
          AND timing.prospective_document_id=${issued.documentId}::uuid
        RETURNING receipt.key_hash::text`;
      return [{ events: removedEvents.length, receipts: removedReceipts.length }];
    });
    expect(retained).toEqual({ events: 2, receipts: 1 });

    const afterRetention = await candidateCensus(deploy, candidate.fixture.tenant, candidate.series.seriesId);
    expect(afterRetention).toEqual({
      ...afterIssue,
      events: afterIssue.events - 2,
      idempotencyRows: afterIssue.idempotencyRows - 1,
      issueReceipts: afterIssue.issueReceipts - 1,
    });
    const replay = await command.execute(replayRequest(candidate.request));
    expect(replay).toEqual({ ...issued, replayed: true });
    expect(await candidateCensus(deploy, candidate.fixture.tenant, candidate.series.seriesId))
      .toEqual(afterRetention);
  }, 60_000);

  test("permanently replays the original receipt after the real folio settlement workflow closes its window", async () => {
    const candidate = await createNativeIssuanceFixture(deploy, runtime, {
      label: "native-closed-replay",
      roomNightAmounts: ["10000"],
    });
    const command = new IssueIndiaNativeFiscalInvoiceCommand(runtime);
    const issued = await command.execute(candidate.request);
    const afterIssue = await candidateCensus(deploy, candidate.fixture.tenant, candidate.series.seriesId);
    const instrumentId = crypto.randomUUID();
    const clearingAccountId = crypto.randomUUID();
    const paymentCode = "CARD_PAYMENT";
    const sealRoleId = crypto.randomUUID();
    await deploy.begin(async tx => {
      await tx`INSERT INTO public.account(id,tenant_id,property_node,role,name,currency,status)
        VALUES(${clearingAccountId}::uuid,${candidate.fixture.tenant}::uuid,
          ${candidate.fixture.property}::uuid,'card_clearing','Native replay clearing','INR','open')`;
      await tx`INSERT INTO public.tx_code(code,name,grp,usali_line,default_dr,default_cr)
        VALUES(${paymentCode},'Card payment','payment',NULL,'card_clearing','guest')
        ON CONFLICT DO NOTHING`;
      await tx`INSERT INTO public.tx_code_route(
          tenant_id,property_node,currency,tx_code,debit_account_id)
        VALUES(${candidate.fixture.tenant}::uuid,${candidate.fixture.property}::uuid,
          'INR',${paymentCode},${clearingAccountId}::uuid)`;
      await tx`INSERT INTO public.payment_instrument(
          id,tenant_id,party_id,kind,token,brand,last4,expiry,psp,status)
        VALUES(${instrumentId}::uuid,${candidate.fixture.tenant}::uuid,
          ${candidate.fixture.party}::uuid,'card_network_token',
          ${`tok_${crypto.randomUUID().replaceAll("-", "")}`},'Test','0434','12/99','local','active')`;
      await tx`INSERT INTO public.permission(code,description)
        VALUES('business_day.seal','Seal a ready business day') ON CONFLICT DO NOTHING`;
      await tx`INSERT INTO public.role(id,tenant_id,name)
        VALUES(${sealRoleId}::uuid,${candidate.fixture.tenant}::uuid,'Order434 audited seal actor')`;
      await tx`INSERT INTO public.role_permission(role_id,permission_code)
        VALUES(${sealRoleId}::uuid,'business_day.seal')`;
      await tx`INSERT INTO public.user_role(tenant_id,user_id,role_id,scope_node)
        VALUES(${candidate.fixture.tenant}::uuid,${candidate.fixture.actor}::uuid,
          ${sealRoleId}::uuid,${candidate.fixture.property}::uuid)`;
    });
    const payments = new PaymentService({
      database: runtime,
      events: new PostgresEventBus(runtimeEvents),
      provider: new LocalPaymentProvider(),
    });
    const [balance] = await deploy<Array<{ amount: string }>>`
      SELECT COALESCE(sum(amount_minor),0)::text AS amount
      FROM public.posting_line
      WHERE tenant_id=${candidate.fixture.tenant}::uuid
        AND folio_id=${candidate.fixture.folio}::uuid`;
    if (!balance || BigInt(balance.amount) <= 0n) {
      throw new Error("Native closed-replay folio has no payable balance");
    }
    const authorization = await payments.authorize({
      tenantId: candidate.fixture.tenant,
      folioId: candidate.fixture.folio,
      instrumentId,
      amountMinor: balance.amount,
      idempotencyKey: "native-closed-replay-authorize",
      envelope: createAuditEnvelope({
        tenantId: candidate.fixture.tenant,
        propertyNode: candidate.fixture.property,
        actorId: candidate.fixture.actor,
        requestId: crypto.randomUUID(),
        operation: "payment.authorized",
      }),
    });
    const captured = await payments.capture({
      tenantId: candidate.fixture.tenant,
      operationId: authorization.operationId,
      amountMinor: balance.amount,
      idempotencyKey: "native-closed-replay-capture",
      envelope: createAuditEnvelope({
        tenantId: candidate.fixture.tenant,
        propertyNode: candidate.fixture.property,
        actorId: candidate.fixture.actor,
        requestId: crypto.randomUUID(),
        operation: "payment.captured",
      }),
    });
    expect(captured).toMatchObject({
      phase: "capture",
      outcome: "approved",
      amountMinor: balance.amount,
      journalId: expect.any(String),
      replayed: false,
    });
    const settlements = new FolioSettlementService({
      database: runtime,
      events: new PostgresEventBus(runtimeEvents),
      idempotency: new PostgresIdempotency(),
    });
    const settled = await settlements.settle({
      tenantId: candidate.fixture.tenant,
      folioId: candidate.fixture.folio,
      idempotencyKey: "native-closed-replay-settle",
      envelope: createAuditEnvelope({
        tenantId: candidate.fixture.tenant,
        propertyNode: candidate.fixture.property,
        actorId: candidate.fixture.actor,
        requestId: crypto.randomUUID(),
        operation: "folio.settled",
      }),
    });
    expect(settled).toMatchObject({
      folioId: candidate.fixture.folio,
      previousStatus: "open",
      status: "settled",
      balanceMinor: "0",
      replayed: false,
    });
    const closed = await settlements.close({
      tenantId: candidate.fixture.tenant,
      folioId: candidate.fixture.folio,
      idempotencyKey: "native-closed-replay-close",
      envelope: createAuditEnvelope({
        tenantId: candidate.fixture.tenant,
        propertyNode: candidate.fixture.property,
        actorId: candidate.fixture.actor,
        requestId: crypto.randomUUID(),
        operation: "folio.closed",
      }),
    });
    expect(closed).toMatchObject({
      folioId: candidate.fixture.folio,
      previousStatus: "settled",
      status: "closed",
      balanceMinor: "0",
      replayed: false,
    });
    const [day] = await deploy<Array<{ business_date: string }>>`
      SELECT business_date::text FROM public.business_day
      WHERE tenant_id=${candidate.fixture.tenant}::uuid
        AND property_node=${candidate.fixture.property}::uuid`;
    if (!day) throw new Error("Native closed-replay business day is unavailable");
    const sealService = new BusinessDaySealService({
      events: new PostgresEventBus(runtimeEvents),
      idempotency: new PostgresIdempotency(),
    });
    const sealInput = {
      tenantId: candidate.fixture.tenant,
      propertyNode: candidate.fixture.property,
      businessDate: day.business_date,
      actorId: candidate.fixture.actor,
      idempotencyKey: "native-closed-replay-seal",
      envelope: createAuditEnvelope({
        tenantId: candidate.fixture.tenant,
        propertyNode: candidate.fixture.property,
        actorId: candidate.fixture.actor,
        requestId: crypto.randomUUID(),
        operation: "business_day.sealed",
      }),
    } as const;
    const sealed = await runtime.withTenantTransaction(candidate.fixture.tenant,
      tx => sealService.seal(tx, sealInput));
    expect(sealed).toMatchObject({
      tenantId: candidate.fixture.tenant,
      propertyNode: candidate.fixture.property,
      businessDate: day.business_date,
      actorId: candidate.fixture.actor,
      replayed: false,
    });
    const sealReplay = await runtime.withTenantTransaction(candidate.fixture.tenant,
      tx => sealService.seal(tx, sealInput));
    expect(sealReplay).toEqual({ ...sealed, replayed: true });
    const [permanentBeforeReplay] = await deploy<Array<{
      folio_status: string; document_sha256: string; document_number: string;
      source_hash: string; pre_document_hash: string; readiness_hash: string;
      source_basis_hash: string; accounting_binding_id: string; business_day_sealed: boolean;
    }>>`SELECT folio.status AS folio_status,document.sha256 AS document_sha256,
        document.doc_no AS document_number,origin.source_evidence_hash AS source_hash,
        origin.pre_document_evidence_hash AS pre_document_hash,
        origin.readiness_evidence_hash AS readiness_hash,
        origin.native_source_basis_hash AS source_basis_hash,
        origin.native_accounting_binding_id::text AS accounting_binding_id,
        EXISTS (SELECT 1 FROM public.business_day day WHERE day.tenant_id=document.tenant_id
          AND day.property_node=document.property_node AND day.business_date=document.business_date
          AND day.sealed_at IS NOT NULL) AS business_day_sealed
      FROM public.india_gst_native_fiscal_document_origin origin
      JOIN public.document document
        ON document.tenant_id=origin.tenant_id AND document.id=origin.document_id
      JOIN public.folio folio
        ON folio.tenant_id=origin.tenant_id AND folio.id=origin.folio_id
      WHERE origin.tenant_id=${candidate.fixture.tenant}::uuid
        AND origin.document_id=${issued.documentId}::uuid`;
    if (!permanentBeforeReplay) throw new Error("Closed-folio native permanent projection is unavailable");
    expect(permanentBeforeReplay).toMatchObject({
      folio_status: "closed",
      document_sha256: issued.sha256,
      document_number: issued.docNo,
      business_day_sealed: true,
    });
    const afterClose = await candidateCensus(deploy, candidate.fixture.tenant, candidate.series.seriesId);
    expect(afterClose).toMatchObject({
      journals: afterIssue.journals + 1,
      lines: afterIssue.lines + 2,
      documents: afterIssue.documents,
      origins: afterIssue.origins,
      accountingBindings: afterIssue.accountingBindings,
      facts: afterIssue.facts + 6,
      events: afterIssue.events + 6,
      idempotencyRows: afterIssue.idempotencyRows + 3,
      issueReceipts: afterIssue.issueReceipts,
      nextNo: afterIssue.nextNo,
    });
    const replay = await command.execute(replayRequest(candidate.request));
    expect(replay).toEqual({ ...issued, replayed: true });
    expect(await candidateCensus(deploy, candidate.fixture.tenant, candidate.series.seriesId))
      .toEqual(afterClose);
    const [permanentAfterReplay] = await deploy<Array<typeof permanentBeforeReplay>>`
      SELECT folio.status AS folio_status,document.sha256 AS document_sha256,
        document.doc_no AS document_number,origin.source_evidence_hash AS source_hash,
        origin.pre_document_evidence_hash AS pre_document_hash,
        origin.readiness_evidence_hash AS readiness_hash,
        origin.native_source_basis_hash AS source_basis_hash,
        origin.native_accounting_binding_id::text AS accounting_binding_id,
        EXISTS (SELECT 1 FROM public.business_day day WHERE day.tenant_id=document.tenant_id
          AND day.property_node=document.property_node AND day.business_date=document.business_date
          AND day.sealed_at IS NOT NULL) AS business_day_sealed
      FROM public.india_gst_native_fiscal_document_origin origin
      JOIN public.document document
        ON document.tenant_id=origin.tenant_id AND document.id=origin.document_id
      JOIN public.folio folio
        ON folio.tenant_id=origin.tenant_id AND folio.id=origin.folio_id
      WHERE origin.tenant_id=${candidate.fixture.tenant}::uuid
        AND origin.document_id=${issued.documentId}::uuid`;
    expect(permanentAfterReplay).toEqual(permanentBeforeReplay);
  }, 60_000);
});
