import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";
import { readFileSync } from "node:fs";
import { Database, createAuditEnvelope, PostgresIdempotency } from "../src/kernel";
import { BusinessDaySealService } from "../src/contexts/financials";
import { IssueIndiaNativeFiscalInvoiceCommand } from "../src/commands/issue-india-native-fiscal-invoice";
import { CREDIT_MIGRATION, commitCredit, createCreditFixture, createCreditCohort, creditCensus, creditSqlState,
  originalCreditGraph, creditFixtureEvents, type CreditFixture } from "./fixtures/india-native-fiscal-credit-note-fixture";

const source = readFileSync(CREDIT_MIGRATION, "utf8");
type SourceLine = { root: string | null; source: string; current: string | null; role: string; line: Record<string, unknown> };
/** Independent expected financial oracle: persisted valuation allocation and
 * original account roles, not the production template or binding's plan. */
async function independentCreditLines(deploy: SQL, candidate: CreditFixture): Promise<SourceLine[]> {
  return deploy<SourceLine[]>`WITH original AS (
    SELECT b.* FROM public.india_gst_native_fiscal_document_origin o
    JOIN public.india_gst_accommodation_final_component_tax_journal_binding b
      ON b.tenant_id=o.tenant_id AND b.id=o.native_accounting_binding_id
    WHERE o.tenant_id=${candidate.fixture.tenant}::uuid AND o.document_id=${candidate.invoice.documentId}::uuid
  ), expected AS (
    SELECT 0 phase,s.posting_root_id root,l.id source,s.current_amount_minor::text current,a.role,l.seq,
      to_jsonb(l)-ARRAY['id','journal_id','business_date','seq'] || jsonb_build_object(
        'amount_minor',(CASE WHEN a.role='guest' THEN -s.current_amount_minor ELSE s.current_amount_minor END)::text,
        'folio_id',CASE WHEN a.role='guest' THEN o.folio_id ELSE NULL::uuid END,'quantity',l.quantity::text) line
    FROM original o JOIN public.india_gst_accommodation_valuation_source s ON s.tenant_id=o.tenant_id AND s.valuation_id=o.valuation_id
    JOIN public.posting_line root ON root.tenant_id=s.tenant_id AND root.id=s.posting_root_id
    JOIN public.posting_line l ON l.tenant_id=root.tenant_id AND l.journal_id=root.journal_id
    JOIN public.account a ON a.tenant_id=l.tenant_id AND a.id=l.account_id
    UNION ALL
    SELECT 1,NULL::uuid,l.id,NULL::text,a.role,l.seq,
      to_jsonb(l)-ARRAY['id','journal_id','business_date','seq'] || jsonb_build_object('amount_minor',(-l.amount_minor)::text,'quantity',l.quantity::text)
    FROM original o JOIN public.posting_line l ON l.tenant_id=o.tenant_id AND l.journal_id=o.journal_id
    JOIN public.account a ON a.tenant_id=l.tenant_id AND a.id=l.account_id
  ) SELECT root::text,source::text,current,role,line FROM expected ORDER BY phase,root,seq`;
}
async function assertIndependentLines(deploy: SQL, candidate: CreditFixture, journal: string, expected: SourceLine[]) {
  const actual = await deploy<{ root: string | null; source: string; line: Record<string, unknown> }[]>`
    SELECT plan->>'postingRootId' root,plan->>'sourceLineId' source,
      to_jsonb(l)-ARRAY['id','journal_id','business_date','seq'] || jsonb_build_object('amount_minor',l.amount_minor::text,'quantity',l.quantity::text) line
    FROM public.india_native_fiscal_credit_note c CROSS JOIN LATERAL jsonb_array_elements(c.planned_lines) plan
    JOIN public.posting_line l ON l.tenant_id=c.tenant_id AND l.journal_id=c.correction_journal_id
      AND l.seq=(plan->'line'->>'seq')::integer
    WHERE c.tenant_id=${candidate.fixture.tenant}::uuid AND c.correction_journal_id=${journal}::uuid ORDER BY l.seq`;
  expect(actual).toEqual(expected.map(({ root, source, line }) => ({ root, source, line })));
}
describe("Order446 draft admission", () => {
  test("requires complete insert-only binding and retains invoice-only origin", () => {
    expect(source).toContain("DEFERRABLE INITIALLY DEFERRED");
    expect(source).not.toMatch(/UPDATE\s+(?:public\.)?india_native_fiscal_credit_note/i);
    expect(source).not.toContain("ALTER TABLE public.india_gst_native_fiscal_document_origin");
    expect(source).toContain("planned->'line'=pg_catalog.to_jsonb(NEW)");
    expect(source).toContain("public.read_india_native_completed_receipt(p_tenant,o.native_timing_id)");
  });
  test("constructs one current-day correction without journal-wide reversal", () => {
    expect(source).toContain("v_date,'correction',p_reason,'INR',NULL");
    expect(source).toContain("s.current_amount_minor");
    expect(source).toContain("'Typ','CRN'");
    expect(source).toContain("'PrecDocDtls'");
    expect(source).toContain("'financials.adjustments:post-seal'");
  });
  test("new credit journals and roots are consumed against later reversals and transfers", () => {
    expect(source).toContain("$credit_consumption$");
    expect(source).toContain("credit.correction_journal_id=p_journal");
    expect(source).toContain("credit.correction_journal_id=credit_root.journal_id");
  });
});

const deployUrl = process.env.YELLOW_ORDER446_DEPLOY_DATABASE_URL;
const runtimeUrl = process.env.YELLOW_ORDER446_RUNTIME_DATABASE_URL;
if (process.env.YELLOW_REQUIRE_ORDER446_DATABASE === "1" && (!deployUrl || !runtimeUrl)) {
  throw new Error("Order446 needs explicitly admitted deploy and runtime URLs");
}
const db = deployUrl && runtimeUrl ? describe.serial : describe.skip;
db("Order446 real PostgreSQL full credit", () => {
  let deploy: SQL;
  let runtime: Database;
  beforeAll(async () => {
    deploy = new SQL(deployUrl!, { max: 3, prepare: false });
    runtime = Database.connect(runtimeUrl!, { maxConnections: 12, prepare: false });
    const [row] = await deploy<{ ready: boolean }[]>`SELECT
      to_regprocedure('public.commit_india_native_fiscal_credit_note(uuid,uuid,uuid,uuid,text,text,uuid)') IS NOT NULL AS ready`;
    if (!row?.ready) throw new Error("Order446 SQL is not installed; no database proof claimed");
  });
  afterAll(async () => { await runtime?.close(); await deploy?.close(); });

  test("all twelve changed functions pin trusted schemas before pg_temp", async () => {
    const [row] = await deploy<{ n: number; safe: boolean }[]>`SELECT count(*)::int n,
      bool_and((SELECT option_value FROM pg_catalog.pg_options_to_table(p.proconfig) WHERE option_name='search_path')
        ='pg_catalog, public, pg_temp') safe FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname IN ('prevent_india_native_credit_mutation','india_native_consideration_roots',
      'india_native_credit_line_templates','assert_india_native_credit_authority','guard_india_native_credit_birth',
      'guard_india_native_credit_artifact','assert_india_native_credit_complete','commit_india_native_fiscal_credit_note',
      'read_india_native_fiscal_credit_note','india_native_journal_is_consumed','india_native_root_is_consumed','guard_india_native_consumed_posting_line')`;
    expect(row).toEqual({ n: 12, safe: true });
  });

  for (const variant of ["ordinary", "correction", "transfer"] as const) {
    test(`${variant}: credits exact consideration and tax while preserving the complete original graph`, async () => {
      const candidate = await createCreditFixture(deploy, runtime, { variant });
      const expected = await independentCreditLines(deploy, candidate);
      if (variant === "correction") expect(expected.some(row => row.current !== null && BigInt(row.current) < 0n)).toBe(true);
      if (variant === "transfer") {
        const [multi] = await deploy<{ n: number }[]>`SELECT count(*)::int n FROM (
          SELECT l.journal_id FROM public.posting_line l WHERE l.tenant_id=${candidate.fixture.tenant}::uuid
            AND l.folio_transfer_root_line_id IS NOT NULL GROUP BY l.journal_id
            HAVING count(DISTINCT l.folio_transfer_root_line_id)>1) roots`;
        expect(multi!.n).toBeGreaterThan(0);
      }
      const before = await originalCreditGraph(deploy, candidate);
      const wire = await runtime.withTenantTransaction(candidate.fixture.tenant, tx => commitCredit(tx, candidate));
      const receipt = JSON.parse(wire.receipt_json);
      expect(wire.replayed).toBe(false);
      expect(receipt.documentKind).toBe("credit_note");
      expect(receipt.originalDocumentId).toBe(candidate.invoice.documentId);
      expect(receipt.originalSha256).toBe(candidate.invoice.sha256);
      expect(receipt.docNo).toMatch(/^C\/[0-9]{4}\/1$/);
      expect(await originalCreditGraph(deploy, candidate)).toBe(before);
      const [proof] = await deploy<{ balance: string; guest: string; line_count: number; exact: boolean }[]>`
        SELECT sum(l.amount_minor)::text AS balance,
          sum(l.amount_minor) FILTER(WHERE l.folio_id=${candidate.request.folioId}::uuid)::text AS guest,
          count(*)::int AS line_count,
          bool_and(l.currency='INR') AS exact FROM public.posting_line l
        WHERE l.tenant_id=${candidate.fixture.tenant}::uuid AND l.journal_id=${receipt.correctionJournalId}::uuid`;
      expect(proof?.balance).toBe("0");
      expect(proof?.guest).toBe((-BigInt(receipt.totalMinor)).toString());
      expect(proof?.exact).toBe(true);
      expect(proof!.line_count).toBeGreaterThanOrEqual(2);
      await assertIndependentLines(deploy, candidate, receipt.correctionJournalId, expected);
      // Original issuance replay reauthenticates its financial closure after credit.
      const originalReplay = await new IssueIndiaNativeFiscalInvoiceCommand(runtime).execute(candidate.request);
      expect(originalReplay.documentId).toBe(candidate.invoice.documentId);
      expect(originalReplay.sha256).toBe(candidate.invoice.sha256);
      const read = await runtime.withTenantTransaction(candidate.fixture.tenant, tx => tx<{ receipt_json: string }[]>`
        SELECT public.read_india_native_fiscal_credit_note(${candidate.fixture.tenant}::uuid,
          ${candidate.fixture.property}::uuid,${candidate.fixture.actor}::uuid,${receipt.documentId}::uuid) AS receipt_json`);
      expect(read[0]?.receipt_json).toBe(wire.receipt_json);
    }, 120_000);
  }

  for (const configuration of ["maharashtra_supplier_karnataka_property", "chandigarh_supplier_chandigarh_property"] as const) {
    test(`exact original component family ${configuration}`, async () => {
      const candidate = await createCreditFixture(deploy, runtime, { statutoryOriginalConfiguration: configuration });
      const expected = await independentCreditLines(deploy, candidate);
      const wire = await runtime.withTenantTransaction(candidate.fixture.tenant, tx => commitCredit(tx, candidate));
      expect(JSON.parse(wire.receipt_json).totalMinor).toBe("10500");
      expect(wire.replayed).toBe(false);
      await assertIndependentLines(deploy, candidate, JSON.parse(wire.receipt_json).correctionJournalId, expected);
    }, 120_000);
  }
  test("rounded-zero tax has only consideration contra pairs", async () => {
    const candidate = await createCreditFixture(deploy, runtime, { roomNightAmounts: ["1"], quotedTaxRounding: "component_half_up" });
    const wire = await runtime.withTenantTransaction(candidate.fixture.tenant, tx => commitCredit(tx, candidate));
    const receipt = JSON.parse(wire.receipt_json);
    expect(receipt.totalMinor).toBe("1");
    const [count] = await deploy<{ n: number }[]>`SELECT count(*)::int n FROM public.posting_line
      WHERE tenant_id=${candidate.fixture.tenant}::uuid AND journal_id=${receipt.correctionJournalId}::uuid`;
    expect(count?.n).toBe(2);
  }, 120_000);

  test("full signed-int64 credit preserves exact integer consideration and tax", async () => {
    const candidate = await createCreditFixture(deploy, runtime, {
      roomNightAmounts: ["7816416980385403227"], quotedTaxRateBasisPoints: 1800,
      quotedTaxRounding: "component_half_up",
    });
    const before = await originalCreditGraph(deploy, candidate);
    const wire = await runtime.withTenantTransaction(candidate.fixture.tenant, tx => commitCredit(tx, candidate));
    const receipt = JSON.parse(wire.receipt_json);
    expect(receipt.totalMinor).toBe("9223372036854775807");
    const [net] = await deploy<{ guest: string; revenue: string; tax: string }[]>`
      SELECT sum(l.amount_minor) FILTER(WHERE a.role='guest')::text guest,
        sum(l.amount_minor) FILTER(WHERE a.role='revenue')::text revenue,
        sum(l.amount_minor) FILTER(WHERE a.role='tax_payable')::text tax
      FROM public.posting_line l JOIN public.account a ON a.tenant_id=l.tenant_id AND a.id=l.account_id
      WHERE l.tenant_id=${candidate.fixture.tenant}::uuid AND l.journal_id=${receipt.correctionJournalId}::uuid`;
    expect(net).toEqual({ guest: "-9223372036854775807", revenue: "7816416980385403227", tax: "1406955056469372580" });
    expect(await originalCreditGraph(deploy, candidate)).toBe(before);
  }, 120_000);

  test("366 persisted room nights remain exact in full credit content", async () => {
    const candidate = await createCreditFixture(deploy, runtime, {
      roomNightAmounts: Array.from({ length: 366 }, () => "10000"),
    });
    const wire = await runtime.withTenantTransaction(candidate.fixture.tenant, tx => commitCredit(tx, candidate));
    const receipt = JSON.parse(wire.receipt_json);
    expect(receipt.totalMinor).toBe("3843000");
    const [items] = await deploy<{ n: number; same: boolean }[]>`
      SELECT jsonb_array_length(credit.content->'ItemList') n,
        credit.content->'ItemList'=original.content->'ItemList' same
      FROM public.document credit JOIN public.document original ON original.tenant_id=credit.tenant_id
      WHERE credit.tenant_id=${candidate.fixture.tenant}::uuid AND credit.id=${receipt.documentId}::uuid
        AND original.id=${candidate.invoice.documentId}::uuid`;
    expect(items).toEqual({ n: 366, same: true });
  }, 180_000);

  test("one hundred distinct originals share contiguous C1–100 with a recomputable C-only hash chain", async () => {
    const cohort = await createCreditCohort(deploy, runtime, 100);
    const first = cohort[0]!;
    for (let start = 0; start < cohort.length; start += 5) {
      await Promise.all(cohort.slice(start, start + 5).map(candidate => runtime.withTenantTransaction(candidate.fixture.tenant,
        tx => commitCredit(tx, candidate))));
    }
    const chain = await deploy<{ n: number; previous: string | null; sha256: string; actual: string }[]>`
      SELECT substring(d.doc_no FROM length(s.prefix)+1)::int n,d.prev_hash previous,d.sha256,
        encode(digest(convert_to(d.content::text,'UTF8'),'sha256'),'hex') actual
      FROM public.document d JOIN public.document_series s ON s.tenant_id=d.tenant_id AND s.id=d.series_id
      WHERE d.tenant_id=${first.fixture.tenant}::uuid AND d.series_id=${first.creditSeries.seriesId}::uuid ORDER BY n`;
    expect(chain).toHaveLength(100);
    for (let index = 0; index < chain.length; index++) {
      expect(chain[index]!.n).toBe(index + 1);
      expect(chain[index]!.sha256).toBe(chain[index]!.actual);
      expect(chain[index]!.previous).toBe(index === 0 ? null : chain[index - 1]!.sha256);
    }
    const [tail] = await deploy<{ next: string; hash: string }[]>`SELECT next_no::text next,last_doc_hash hash
      FROM public.document_series WHERE tenant_id=${first.fixture.tenant}::uuid AND id=${first.creditSeries.seriesId}::uuid`;
    expect(tail).toEqual({ next: "101", hash: chain.at(-1)!.sha256 });
  }, 300_000);

  test("a sealed current day cannot receive credit, and sealed-source replay requires current post-seal permission", async () => {
    const candidate = await createCreditFixture(deploy, runtime);
    const wire = await runtime.withTenantTransaction(candidate.fixture.tenant, tx => commitCredit(tx, candidate));
    await deploy`SELECT public.seal_business_day(${candidate.fixture.tenant}::uuid,${candidate.fixture.property}::uuid,
      ${candidate.invoice.businessDate}::date,${candidate.fixture.actor}::uuid)`;
    await deploy`DELETE FROM public.role_permission WHERE permission_code='financials.adjustments:post-seal'
      AND role_id IN(SELECT role_id FROM public.user_role WHERE tenant_id=${candidate.fixture.tenant}::uuid
        AND user_id=${candidate.fixture.actor}::uuid)`;
    await expectState(() => runtime.withTenantTransaction(candidate.fixture.tenant, tx => commitCredit(tx, candidate)), "42501");
    await deploy`INSERT INTO public.role_permission(role_id,permission_code)
      SELECT role_id,'financials.adjustments:post-seal' FROM public.user_role
      WHERE tenant_id=${candidate.fixture.tenant}::uuid AND user_id=${candidate.fixture.actor}::uuid ON CONFLICT DO NOTHING`;
    expect(await runtime.withTenantTransaction(candidate.fixture.tenant, tx => commitCredit(tx, candidate)))
      .toEqual({ receipt_json: wire.receipt_json, replayed: true });
    const pending = await createCreditFixture(deploy, runtime);
    await deploy`SELECT public.seal_business_day(${pending.fixture.tenant}::uuid,${pending.fixture.property}::uuid,
      ${pending.invoice.businessDate}::date,${pending.fixture.actor}::uuid)`;
    const before = await creditCensus(deploy, pending.fixture.tenant);
    await expectState(() => runtime.withTenantTransaction(pending.fixture.tenant, tx => commitCredit(tx, pending)), "P0011");
    expect(await creditCensus(deploy, pending.fixture.tenant)).toBe(before);
  }, 120_000);

  test("sealed original posts only to the property's later current open day with post-seal authority", async () => {
    const candidate = await createCreditFixture(deploy, runtime, { timezone: "Etc/GMT+12" });
    await deploy`SELECT public.seal_business_day(${candidate.fixture.tenant}::uuid,${candidate.fixture.property}::uuid,
      ${candidate.invoice.businessDate}::date,${candidate.fixture.actor}::uuid)`;
    //26 hours of offset separation guarantees a different civil date at every UTC hour.
    await deploy`UPDATE public.org_node SET timezone='Pacific/Kiritimati'
      WHERE tenant_id=${candidate.fixture.tenant}::uuid AND id=${candidate.fixture.property}::uuid`;
    const [clock] = await deploy<{ today: string; fy: string }[]>`SELECT current_day::text today,
      make_date(extract(year FROM current_day)::int-CASE WHEN extract(month FROM current_day)<4 THEN 1 ELSE 0 END,4,1)::text fy
      FROM (SELECT (transaction_timestamp() AT TIME ZONE 'Pacific/Kiritimati')::date current_day) dates`;
    expect(clock!.today > candidate.invoice.businessDate).toBe(true);
    await deploy`INSERT INTO public.business_day(tenant_id,property_node,business_date)
      VALUES(${candidate.fixture.tenant}::uuid,${candidate.fixture.property}::uuid,${clock!.today}::date) ON CONFLICT DO NOTHING`;
    // At a fiscal-year boundary the new current year needs its own configured C-series.
    if (clock!.fy !== candidate.invoice.financialYearStart) {
      await deploy`INSERT INTO public.india_gst_supplier_registration_status_snapshot
        SELECT (jsonb_populate_record(NULL::public.india_gst_supplier_registration_status_snapshot,
          to_jsonb(status)||jsonb_build_object('id',gen_random_uuid(),'status_as_of',${clock!.today}::date))).*
        FROM public.india_gst_supplier_registration_status_snapshot status
        WHERE tenant_id=${candidate.fixture.tenant}::uuid AND id=${candidate.statutory.supplierStatusId}::uuid`;
      const suffix = `${clock!.fy.slice(2, 4)}${String(Number(clock!.fy.slice(0, 4)) + 1).slice(2)}`;
      await runtime.withTenantTransaction(candidate.fixture.tenant, tx => tx`SELECT public.create_india_native_fiscal_series(
        ${candidate.fixture.tenant}::uuid,${candidate.fixture.property}::uuid,${candidate.statutory.seller.registrationId}::uuid,
        'credit_note',${`C/${suffix}/`},${candidate.fixture.actor}::uuid)`);
    }
    const before = await creditCensus(deploy, candidate.fixture.tenant);
    await expectState(() => runtime.withTenantTransaction(candidate.fixture.tenant, tx => commitCredit(tx, candidate)), "42501");
    expect(await creditCensus(deploy, candidate.fixture.tenant)).toBe(before);
    await deploy`INSERT INTO public.role_permission(role_id,permission_code)
      SELECT role_id,'financials.adjustments:post-seal' FROM public.user_role
      WHERE tenant_id=${candidate.fixture.tenant}::uuid AND user_id=${candidate.fixture.actor}::uuid ON CONFLICT DO NOTHING`;
    const wire = await runtime.withTenantTransaction(candidate.fixture.tenant, tx => commitCredit(tx, candidate));
    expect(JSON.parse(wire.receipt_json).businessDate).toBe(clock!.today);
    const [old] = await deploy<{ sealed: boolean }[]>`SELECT sealed_at IS NOT NULL sealed FROM public.business_day
      WHERE tenant_id=${candidate.fixture.tenant}::uuid AND property_node=${candidate.fixture.property}::uuid
        AND business_date=${candidate.invoice.businessDate}::date`;
    expect(old?.sealed).toBe(true);
  }, 120_000);

  test("extra posting and journal reversal cannot alter an issued credit graph", async () => {
    const candidate = await createCreditFixture(deploy, runtime);
    const wire = await runtime.withTenantTransaction(candidate.fixture.tenant, tx => commitCredit(tx, candidate));
    const receipt = JSON.parse(wire.receipt_json);
    const before = await creditCensus(deploy, candidate.fixture.tenant);
    // Deployment-owner hostile probes intentionally exercise trigger backstops,
    // while runtime INSERT authority is separately denied above.
    await expectState(() => deploy.begin(async tx => {
      await tx`SELECT set_config('app.tenant_id',${candidate.fixture.tenant},true)`;
      await tx`INSERT INTO public.posting_line(id,tenant_id,journal_id,seq,account_id,folio_id,tx_code,description,
        amount_minor,quantity,tax_detail,business_date,currency,folio_transfer_root_line_id)
        SELECT gen_random_uuid(),tenant_id,journal_id,seq+100,account_id,folio_id,tx_code,description,
          amount_minor,quantity,tax_detail,business_date,currency,folio_transfer_root_line_id
        FROM public.posting_line WHERE tenant_id=${candidate.fixture.tenant}::uuid
          AND journal_id=${receipt.correctionJournalId}::uuid`;
    }), "55000");
    await expectState(() => deploy.begin(async tx => {
      await tx`SELECT set_config('app.tenant_id',${candidate.fixture.tenant},true)`;
      await tx`INSERT INTO public.journal(tenant_id,property_node,business_date,kind,description,currency,reverses)
        VALUES(${candidate.fixture.tenant}::uuid,${candidate.fixture.property}::uuid,${receipt.businessDate}::date,
          'correction','Hostile journal reversal','INR',${receipt.correctionJournalId}::uuid)`;
    }), "55000");
    await expectState(() => deploy`UPDATE public.document SET status='void'
      WHERE tenant_id=${candidate.fixture.tenant}::uuid AND id=${receipt.documentId}::uuid`, "55000");
    expect(await creditCensus(deploy, candidate.fixture.tenant)).toBe(before);
  }, 120_000);

  test("concurrent same key has one effect, permanent exact replay and changed payload denial", async () => {
    const cohort = await createCreditCohort(deploy, runtime, 2);
    const candidate = cohort[0]!;
    const results = await Promise.all(Array.from({ length: 8 }, () => runtime.withTenantTransaction(candidate.fixture.tenant,
      tx => commitCredit(tx, candidate))));
    expect(results.filter(row => !row.replayed)).toHaveLength(1);
    expect(new Set(results.map(row => row.receipt_json)).size).toBe(1);
    const before = await creditCensus(deploy, candidate.fixture.tenant);
    await expectState(() => runtime.withTenantTransaction(candidate.fixture.tenant,
      tx => commitCredit(tx, candidate, { reason: "Changed cancellation reason" })), "23505");
    await expectState(() => runtime.withTenantTransaction(candidate.fixture.tenant,
      tx => commitCredit(tx, candidate, { original: crypto.randomUUID() })), "23505");
    await expectState(() => runtime.withTenantTransaction(candidate.fixture.tenant,
      tx => commitCredit(tx, candidate, { original: cohort[1]!.invoice.documentId })), "23505");
    await expectState(() => runtime.withTenantTransaction(candidate.fixture.tenant,
      tx => commitCredit(tx, candidate, { key: "another-credit-key" })), "23505");
    expect(await creditCensus(deploy, candidate.fixture.tenant)).toBe(before);
    await deploy`DELETE FROM public.api_idempotency WHERE tenant_id=${candidate.fixture.tenant}::uuid
      AND operation='document.credit_note.issued'`;
    const replay = await runtime.withTenantTransaction(candidate.fixture.tenant, tx => commitCredit(tx, candidate));
    expect(replay).toEqual({ receipt_json: results[0]!.receipt_json, replayed: true });
  }, 120_000);

  test("different-key concurrent requests for one original have exactly one winner", async () => {
    const candidate = await createCreditFixture(deploy, runtime);
    const outcomes = await Promise.allSettled(Array.from({ length: 8 }, (_, index) =>
      runtime.withTenantTransaction(candidate.fixture.tenant, tx => commitCredit(tx, candidate, { key: `concurrent-key-${index}` }))));
    expect(outcomes.filter(row => row.status === "fulfilled")).toHaveLength(1);
    for (const row of outcomes) if (row.status === "rejected") expect(creditSqlState(row.reason)).toBe("23505");
    const [effect] = await deploy<{ count: number; next: string }[]>`SELECT
      (SELECT count(*)::int FROM public.india_native_fiscal_credit_note WHERE tenant_id=${candidate.fixture.tenant}::uuid) count,
      next_no::text next FROM public.document_series WHERE tenant_id=${candidate.fixture.tenant}::uuid AND id=${candidate.creditSeries.seriesId}::uuid`;
    expect(effect).toEqual({ count: 1, next: "2" });
  }, 120_000);

  for (const mutation of ["actor", "property-membership"] as const) {
    for (const completed of [false, true]) {
      test(`${mutation} revocation denies ${completed ? "completed replay" : "first issue"}`, async () => {
        const candidate = await createCreditFixture(deploy, runtime);
        if (completed) await runtime.withTenantTransaction(candidate.fixture.tenant, tx => commitCredit(tx, candidate));
        const before = await creditCensus(deploy, candidate.fixture.tenant);
        if (mutation === "actor") {
          await deploy`UPDATE public.app_user SET status='disabled' WHERE tenant_id=${candidate.fixture.tenant}::uuid AND id=${candidate.fixture.actor}::uuid`;
        } else {
          await deploy`DELETE FROM public.user_role WHERE tenant_id=${candidate.fixture.tenant}::uuid AND user_id=${candidate.fixture.actor}::uuid`;
        }
        await expectState(() => runtime.withTenantTransaction(candidate.fixture.tenant, tx => commitCredit(tx, candidate)), "42501");
        expect(await creditCensus(deploy, candidate.fixture.tenant)).toBe(before);
      }, 120_000);
    }
  }

  for (const winner of ["credit", "seal"] as const) {
    test(`${winner}-first production audited seal/credit race has coherent publication`, async () => {
      const candidate = await createCreditFixture(deploy, runtime);
      await deploy`INSERT INTO public.role_permission(role_id,permission_code)
        SELECT role_id,'business_day.seal' FROM public.user_role WHERE tenant_id=${candidate.fixture.tenant}::uuid
          AND user_id=${candidate.fixture.actor}::uuid ON CONFLICT DO NOTHING`;
      const seal = new BusinessDaySealService({ events: creditFixtureEvents(), idempotency: new PostgresIdempotency() });
      const sealInput = { tenantId: candidate.fixture.tenant, propertyNode: candidate.fixture.property,
        businessDate: candidate.invoice.businessDate, actorId: candidate.fixture.actor,
        idempotencyKey: `seal446-${candidate.invoice.documentId}`, envelope: createAuditEnvelope({
          tenantId: candidate.fixture.tenant, propertyNode: candidate.fixture.property, actorId: candidate.fixture.actor,
          requestId: crypto.randomUUID(), operation: "business_day.sealed" }) };
      const reached = Promise.withResolvers<number>();
      const release = Promise.withResolvers<void>();
      const holder = winner === "credit"
        ? runtime.withTenantTransaction(candidate.fixture.tenant, async tx => {
          const result = await commitCredit(tx, candidate);
          const [pid] = await tx<{ pid: number }[]>`SELECT pg_backend_pid() pid`;
          reached.resolve(pid!.pid); await release.promise; return result;
        })
        : runtime.withTenantTransaction(candidate.fixture.tenant, async tx => {
          await seal.seal(tx, sealInput);
          const [pid] = await tx<{ pid: number }[]>`SELECT pg_backend_pid() pid`;
          reached.resolve(pid!.pid); await release.promise;
        });
      void holder.catch(error => reached.reject(error));
      let waiter: Promise<unknown> | undefined;
      try {
        const pid = await reached.promise;
        waiter = winner === "credit"
          ? runtime.withTenantTransaction(candidate.fixture.tenant, tx => seal.seal(tx, sealInput))
          : runtime.withTenantTransaction(candidate.fixture.tenant, tx => commitCredit(tx, candidate));
        void waiter.catch(() => {});
        const observed = await observeWait(deploy, pid);
        expect(observed.waiting).toBe(true);
        if (winner === "seal") expect(observed.publication).toBe(false);
      } finally { release.resolve(); }
      await holder;
      if (winner === "credit") {
        await waiter;
        const [count] = await deploy<{ n: number }[]>`SELECT count(*)::int n FROM public.india_native_fiscal_credit_note
          WHERE tenant_id=${candidate.fixture.tenant}::uuid`;
        expect(count?.n).toBe(1);
      } else {
        await expectState(() => waiter!, "P0011");
      }
      const [inventory] = await deploy<{ sealed: boolean; credits: number; credit_facts: number; credit_events: number;
        credit_keys: number; seal_facts: number; seal_events: number; seal_keys: number; next_no: string }[]>`SELECT
        (SELECT sealed_at IS NOT NULL FROM public.business_day WHERE tenant_id=${candidate.fixture.tenant}::uuid
          AND property_node=${candidate.fixture.property}::uuid AND business_date=${candidate.invoice.businessDate}::date) sealed,
        (SELECT count(*)::int FROM public.india_native_fiscal_credit_note WHERE tenant_id=${candidate.fixture.tenant}::uuid) credits,
        (SELECT count(*)::int FROM public.fact_log WHERE tenant_id=${candidate.fixture.tenant}::uuid AND fact_type='issued'
          AND payload->>'documentKind'='credit_note') credit_facts,
        (SELECT count(*)::int FROM public.outbox WHERE tenant_id=${candidate.fixture.tenant}::uuid AND event_type='document.issued'
          AND payload->>'documentKind'='credit_note') credit_events,
        (SELECT count(*)::int FROM public.api_idempotency WHERE tenant_id=${candidate.fixture.tenant}::uuid AND operation='document.credit_note.issued') credit_keys,
        (SELECT count(*)::int FROM public.fact_log WHERE tenant_id=${candidate.fixture.tenant}::uuid AND fact_type='business_day.sealed') seal_facts,
        (SELECT count(*)::int FROM public.outbox WHERE tenant_id=${candidate.fixture.tenant}::uuid AND event_type='business_day.sealed') seal_events,
        (SELECT count(*)::int FROM public.api_idempotency WHERE tenant_id=${candidate.fixture.tenant}::uuid
          AND operation='financials.business-day.seal' AND completed_at IS NOT NULL) seal_keys,
        (SELECT next_no::text FROM public.document_series WHERE tenant_id=${candidate.fixture.tenant}::uuid
          AND id=${candidate.creditSeries.seriesId}::uuid) next_no`;
      const credited = winner === "credit" ? 1 : 0;
      expect(inventory).toEqual({ sealed: true, credits: credited, credit_facts: credited, credit_events: credited,
        credit_keys: credited, seal_facts: 1, seal_events: 1, seal_keys: 1, next_no: String(credited + 1) });
    }, 120_000);
  }

  test("revoked issue/adjustment grant denies first call and replay; foreign scope is hidden", async () => {
    const candidate = await createCreditFixture(deploy, runtime);
    const before = await creditCensus(deploy, candidate.fixture.tenant);
    await expectState(() => runtime.withTenantTransaction(candidate.fixture.tenant,
      tx => commitCredit(tx, candidate, { actor: candidate.fixture.unauthorizedActor })), "42501");
    await expectState(() => runtime.withTenantTransaction(candidate.fixture.tenant,
      tx => commitCredit(tx, candidate, { tenant: crypto.randomUUID() })), "42501");
    expect(await creditCensus(deploy, candidate.fixture.tenant)).toBe(before);
    await runtime.withTenantTransaction(candidate.fixture.tenant, tx => commitCredit(tx, candidate));
    await deploy`DELETE FROM public.role_permission WHERE permission_code='financials.adjustments:write'
      AND role_id IN (SELECT role_id FROM public.user_role WHERE tenant_id=${candidate.fixture.tenant}::uuid AND user_id=${candidate.fixture.actor}::uuid)`;
    await expectState(() => runtime.withTenantTransaction(candidate.fixture.tenant, tx => commitCredit(tx, candidate)), "42501");
  }, 120_000);

  test("direct DML, private helpers, and fabricated source markers cannot admit a credit", async () => {
    const candidate = await createCreditFixture(deploy, runtime);
    const before = await creditCensus(deploy, candidate.fixture.tenant);
    await expectState(() => runtime.withTenantTransaction(candidate.fixture.tenant, tx => tx`
      INSERT INTO public.india_native_fiscal_credit_note(tenant_id,id) VALUES(${candidate.fixture.tenant}::uuid,${crypto.randomUUID()}::uuid)`), "42501");
    await expectState(() => runtime.withTenantTransaction(candidate.fixture.tenant, tx => tx`
      SELECT public.india_native_credit_line_templates(${candidate.fixture.tenant}::uuid,${candidate.invoice.documentId}::uuid)`), "42501");
    expect(await creditCensus(deploy, candidate.fixture.tenant)).toBe(before);
  }, 120_000);

  test("hostile temporary pg_locks cannot hide already acquired global publication lock", async () => {
    const candidate = await createCreditFixture(deploy, runtime);
    const before = await creditCensus(deploy, candidate.fixture.tenant);
    await expectState(() => runtime.withTenantTransaction(candidate.fixture.tenant, async tx => {
      await tx`CREATE TEMPORARY TABLE pg_locks (LIKE pg_catalog.pg_locks) ON COMMIT DROP`;
      await tx`GRANT SELECT ON pg_temp.pg_locks TO yellow_owner`;
      await tx`SELECT pg_catalog.pg_advisory_xact_lock(6441674055002974568::bigint)`;
      return commitCredit(tx, candidate);
    }), "55000");
    expect(await creditCensus(deploy, candidate.fixture.tenant)).toBe(before);
  }, 120_000);

  test("hostile temporary builtin type names fail closed without changing financial artifacts", async () => {
    const candidate = await createCreditFixture(deploy, runtime);
    const expected = await independentCreditLines(deploy, candidate);
    const before = await creditCensus(deploy, candidate.fixture.tenant);
    // The inherited invoice receipt validator rejects a shadowed UUID context.
    // Assert this denial, not an unsupported promise to tolerate hostile types.
    await expectState(() => runtime.withTenantTransaction(candidate.fixture.tenant, async tx => {
      await tx`CREATE TEMPORARY TABLE uuid (value pg_catalog.text) ON COMMIT DROP`;
      await tx`CREATE TEMPORARY TABLE numeric (value pg_catalog.text) ON COMMIT DROP`;
      await tx`CREATE TEMPORARY TABLE jsonb (value pg_catalog.text) ON COMMIT DROP`;
      return commitCredit(tx, candidate);
    }), "42501");
    expect(await creditCensus(deploy, candidate.fixture.tenant)).toBe(before);
    const wire = await runtime.withTenantTransaction(candidate.fixture.tenant, tx => commitCredit(tx, candidate));
    expect(wire.replayed).toBe(false);
    await assertIndependentLines(deploy, candidate, JSON.parse(wire.receipt_json).correctionJournalId, expected);
  }, 120_000);

  test("SQL reason validation counts Unicode codepoints and preserves exact valid bytes", async () => {
    const candidate = await createCreditFixture(deploy, runtime);
    const before = await creditCensus(deploy, candidate.fixture.tenant);
    for (const reason of ["", " ", "\u00a0\u3000", "bad\nreason", "bad\u007freason", "😀".repeat(501)]) {
      await expectState(() => runtime.withTenantTransaction(candidate.fixture.tenant,
        tx => commitCredit(tx, candidate, { reason })), "22023");
      expect(await creditCensus(deploy, candidate.fixture.tenant)).toBe(before);
    }
    const reason = ` ${"😀".repeat(498)} `;
    const wire = await runtime.withTenantTransaction(candidate.fixture.tenant, tx => commitCredit(tx, candidate, { reason }));
    expect(JSON.parse(wire.receipt_json).reason).toBe(reason);
    const replay = await runtime.withTenantTransaction(candidate.fixture.tenant, tx => commitCredit(tx, candidate, { reason }));
    expect(replay.receipt_json).toBe(wire.receipt_json);
    expect(replay.replayed).toBe(true);
  }, 120_000);

  test("failure at every artifact stage rolls back all rows and series allocation", async () => {
    const candidate = await createCreditFixture(deploy, runtime);
    const stages = ["india_native_fiscal_credit_note", "journal", "posting_line", "document", "document_series", "fact_log", "outbox", "api_idempotency"] as const;
    for (const table of stages) {
      const before = await creditCensus(deploy, candidate.fixture.tenant);
      const trigger = `order446_failure_${table}`;
      // Owned, named fault injection is removed in finally; no trigger is disabled.
      await deploy.unsafe(`CREATE FUNCTION public.${trigger}() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN IF NEW.tenant_id='${candidate.fixture.tenant}'::uuid THEN
          RAISE EXCEPTION USING ERRCODE='P0446',MESSAGE='Order446 intentional artifact failure'; END IF;
        RETURN NEW; END $$;
        CREATE TRIGGER ${trigger} AFTER ${table === "document_series" ? "UPDATE" : "INSERT"} ON public.${table}
          FOR EACH ROW EXECUTE FUNCTION public.${trigger}()`);
      try {
        await expectState(() => runtime.withTenantTransaction(candidate.fixture.tenant, tx => commitCredit(tx, candidate)), "P0446");
        expect(await creditCensus(deploy, candidate.fixture.tenant)).toBe(before);
      } finally {
        await deploy.unsafe(`DROP TRIGGER ${trigger} ON public.${table}; DROP FUNCTION public.${trigger}()`);
      }
    }
    const success = await runtime.withTenantTransaction(candidate.fixture.tenant, tx => commitCredit(tx, candidate));
    expect(JSON.parse(success.receipt_json).docNo).toMatch(/\/1$/);
  }, 120_000);

  test("deferred completion rejects a missing posting even when total remains balanced", async () => {
    const candidate = await createCreditFixture(deploy, runtime);
    const before = await creditCensus(deploy, candidate.fixture.tenant);
    await deploy.unsafe(`CREATE FUNCTION public.order446_skip_lines() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.tenant_id='${candidate.fixture.tenant}'::uuid THEN RETURN NULL; END IF; RETURN NEW; END $$;
      CREATE TRIGGER zz_order446_skip_lines BEFORE INSERT ON public.posting_line
        FOR EACH ROW EXECUTE FUNCTION public.order446_skip_lines()`);
    try {
      await expectState(() => runtime.withTenantTransaction(candidate.fixture.tenant, tx => commitCredit(tx, candidate)), "55000");
      expect(await creditCensus(deploy, candidate.fixture.tenant)).toBe(before);
    } finally {
      await deploy.unsafe("DROP TRIGGER zz_order446_skip_lines ON public.posting_line; DROP FUNCTION public.order446_skip_lines()");
    }
  }, 120_000);
});

async function expectState(operation: () => Promise<unknown>, state: string) {
  try { await operation(); } catch (error) { expect(creditSqlState(error)).toBe(state); return; }
  throw new Error(`Expected PostgreSQL ${state}`);
}

async function observeWait(deploy: SQL, holder: number): Promise<{ waiting: boolean; publication: boolean }> {
  const deadline = performance.now() + 15_000;
  while (performance.now() < deadline) {
    const [row] = await deploy<{ waiting: boolean; publication: boolean }[]>`
      SELECT EXISTS(SELECT 1 FROM pg_locks WHERE pid=a.pid AND NOT granted) waiting,
        EXISTS(SELECT 1 FROM pg_locks WHERE pid=a.pid AND locktype='advisory' AND granted AND objsubid=1
          AND classid=((6441674055002974568::bigint>>32)&4294967295)::oid
          AND objid=(6441674055002974568::bigint&4294967295)::oid) publication
      FROM pg_stat_activity a WHERE a.datname=current_database() AND a.pid<>pg_backend_pid()
        AND ${holder}::int=ANY(pg_blocking_pids(a.pid)) ORDER BY a.pid LIMIT 1`;
    if (row?.waiting) return row;
    await Bun.sleep(25);
  }
  throw new Error("Expected real seal/credit lock contention was not observed");
}
