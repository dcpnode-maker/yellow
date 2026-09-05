import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";
import { IssueIndiaNativeFiscalInvoiceCommand } from "../src/commands/issue-india-native-fiscal-invoice";
import { IndiaGstAccommodationFinalValuationService, IndiaNativeFiscalInvoiceIssuanceService, IndiaNativeFiscalSeriesConfigurationService } from "../src/contexts/tax-fiscal";
import { IndiaNativeFiscalAccountingEventHandler } from "../src/contexts/financials";
import { createAuditEnvelope, Database, PostgresEventBus, PostgresIdempotency, type Tx } from "../src/kernel";
import { createNativeIssuanceFixture, createNativeSourceFixture, createNativeStatutoryFixture } from "./fixtures/india-native-fiscal-source-completion-fixture";

const draft = new URL("../handoff/drafts/order434/0076-native-preparation.sql", import.meta.url);
const deployUrl = process.env.YELLOW_ORDER434_NATIVE_ACCOUNTING_DEPLOY_DATABASE_URL;
if (process.env.YELLOW_REQUIRE_ORDER434_NATIVE_ACCOUNTING_DATABASE === "1" && !deployUrl) {
  throw new Error("Order434 preparation proof requires the explicit synthetic deploy database URL");
}
const databaseDescribe = deployUrl ? describe.serial : describe.skip;
const issueRuntimeUrl = process.env.YELLOW_ORDER434_NATIVE_ISSUANCE_RUNTIME_DATABASE_URL;
if (process.env.YELLOW_REQUIRE_ORDER434_NATIVE_ISSUANCE_DATABASE === "1" && (!deployUrl || !issueRuntimeUrl)) {
  throw new Error("Native issuance proof requires explicit synthetic deploy and real runtime database URLs");
}
const issuanceDescribe = deployUrl && issueRuntimeUrl ? describe.serial : describe.skip;
type ObjectValue = Record<string, unknown>;
type BasisParts = {
  context: ObjectValue;
  nativeInput: ObjectValue;
  nativeResult: ObjectValue;
  valuation: ObjectValue;
  prepared: ObjectValue;
  nature: ObjectValue;
  composition: ObjectValue;
  series: ObjectValue;
};
const id = (suffix: number): string => `00000000-0000-0000-0000-${String(suffix).padStart(12, "0")}`;
const hash = "a".repeat(64);
function freezeGraph<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freezeGraph(child);
    Object.freeze(value);
  }
  return value;
}
async function expectSqlState(operation: Promise<unknown>, state: string, message?: string): Promise<void> {
  let caught: unknown;
  try { await operation; } catch (error) { caught = error; }
  expect(caught).toBeDefined();
  const error = caught as { errno?: unknown; sqlState?: unknown; code?: unknown };
  expect(String(error.errno ?? error.sqlState ?? error.code)).toBe(state);
  if (message) expect((caught as Error).message).toContain(message);
}

// Serialization-only inputs, never inserted as hotel/fiscal evidence. Real
// persisted producer parity is exercised by the accounting writer suite.
function parts(): BasisParts {
  const context: ObjectValue = {
    tenantId: id(1), propertyNode: id(2), reservationId: id(3), folioId: id(4), actorId: id(5),
    valuationId: id(6), nativeTimingId: id(7), prospectiveDocumentId: id(8), seriesId: id(9),
    applicabilityId: id(10), taxId: id(11), accountingBindingId: id(12), requestId: id(13),
    requestKeyHash: hash, requestHash: "b".repeat(64), requestEventId: id(14),
    issuingTransactionId: "429", transactionTimestamp: "2026-03-31T20:00:00.000001Z",
    propertyTimezone: "Asia/Kolkata", invoiceIssueDate: "2026-04-01",
  };
  const scope = { tenantId: id(1), propertyNode: id(2), reservationId: id(3), folioId: id(4) };
  const timing = { nativeTimingId: id(7), prospectiveDocumentId: id(8), invoiceIssueDate: "2026-04-01" };
  const valuation: ObjectValue = {
    valuationId: id(6), generation: 0, actorId: id(5), requestId: id(13),
    recordedAt: "2026-03-30T10:00:00.000000Z", evidenceHash: hash, nativeConsiderationBasisHash: hash,
    basis: { ...scope, buyerPartyId: id(15) }, sourceClosure: {}, intake: {},
  };
  return {
    context,
    nativeInput: {
      kind: "native_current_transaction", tenantId: id(1), propertyNode: id(2), reservationId: id(3),
      serviceProvision: {}, paymentReceipt: {}, ordinaryRegime: {}, nativeTiming: timing,
      rateVersionPair: {}, rateChangeDateEvidence: {}, historicalResolutions: {}, section14PaymentEvidence: null,
    },
    nativeResult: { kind: "native_current_transaction", timing, rateSource: {}, evidenceHash: hash },
    valuation,
    prepared: {
      tenantId: id(1), legalBuyerPartyId: id(15), sellerRegistration: { registrationId: id(16) },
      recipientRegistration: {}, placeOfSupply: {}, classification: {}, supplyNatureAtTimeOfSupplyInput: {},
      supplyNatureAtTimeOfSupplyResult: scope,
    },
    nature: scope,
    composition: {
      componentFamilyCanonicalJson: "{}", levyInputBundleCanonicalJson: "{}", levyComponentIdentityCanonicalJson: "{}",
      quotedApplicabilityCanonicalJson: JSON.stringify({ kind: "native_current_transaction", nativeTiming: timing }),
      finalTaxCanonicalJson: JSON.stringify({ kind: "native_current_transaction", nativeTimingId: id(7), valuationId: id(6) }),
      taxPreview: { valuationId: id(6) },
    },
    series: { tenantId: id(1), propertyNode: id(2), seriesId: id(9), supplierRegistrationId: id(16),
      kind: "invoice", fiscal: true, financialYearStart: "2026-04-01", prefix: "I/2627/" },
  };
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const object = value as ObjectValue;
  return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${canonical(object[key])}`).join(",")}}`;
}

function domain(input: BasisParts): ObjectValue {
  return {
    kind: "india-native-fiscal-preparation-source-v1", context: input.context,
    nativeInvoiceSourceInputCanonicalJson: JSON.stringify(input.nativeInput),
    nativeInvoiceSourceResultCanonicalJson: JSON.stringify(input.nativeResult),
    valuationEvidence: input.valuation, preparedSourceCanonicalJson: JSON.stringify(input.prepared),
    serviceSupplyNatureCanonicalJson: JSON.stringify(input.nature), quotedTaxComposition: input.composition,
    seriesIdentity: input.series,
  };
}

async function boundedObservation<T>(promise: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([promise, new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error(`Timed out observing ${label}`)), 15_000);
    })]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

// Pause only after the actual command has returned inside its real transaction.
// No statement, authority, clock, connection or domain response is replaced.
function issuanceCommitBarrier() {
  const reached = Promise.withResolvers<number>();
  const release = Promise.withResolvers<void>();
  const pool = new SQL(issueRuntimeUrl!, { max: 1, prepare: false });
  const database = new class extends Database {
    override async withTenantTransaction<T>(tenantId: string, operation: (tx: Tx) => Promise<T>): Promise<T> {
      try {
        return await super.withTenantTransaction(tenantId, async tx => {
          const result = await operation(tx);
          const [backend] = await tx<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`;
          if (!backend) throw new Error("Issuance barrier backend is unavailable");
          reached.resolve(backend.pid);
          await release.promise;
          return result;
        });
      } catch (error) { reached.reject(error); throw error; }
    }
  }(pool);
  return { database, reached: reached.promise, release: () => release.resolve(),
    close: () => pool.close({ timeout: 0 }) };
}

async function observedWaiter(deploy: SQL, holder: number, waiter?: number) {
  const deadline = performance.now() + 10_000;
  while (performance.now() < deadline) {
    const rows = await deploy<Array<{
      pid: number; blockers: number[]; holder_blockers: number[]; waiting: boolean; publication: boolean;
    }>>`SELECT a.pid,pg_blocking_pids(a.pid) AS blockers,
      pg_blocking_pids(${holder}) AS holder_blockers,
      EXISTS(SELECT 1 FROM pg_locks WHERE pid=a.pid AND NOT granted) AS waiting,
      EXISTS(SELECT 1 FROM pg_locks WHERE pid=a.pid AND locktype='advisory' AND granted
        AND objsubid=1 AND classid=((6441674055002974568::bigint>>32)&4294967295)::oid
        AND objid=(6441674055002974568::bigint&4294967295)::oid) AS publication
      FROM pg_stat_activity a WHERE a.datname=current_database() AND a.pid<>pg_backend_pid()
        AND (${waiter ?? null}::integer IS NULL OR a.pid=${waiter ?? null}::integer)
        AND ${holder}=ANY(pg_blocking_pids(a.pid)) ORDER BY a.pid`;
    if (rows.length === 1 && rows[0]) return rows[0];
    // Poll observations only; neither business command is ever retried.
    await Bun.sleep(25);
  }
  throw new Error("Expected exact transaction wait was not observed");
}

async function concurrencyCensus(deploy: SQL, tenant: string, series: string) {
  const [row] = await deploy`SELECT
    (SELECT count(*)::integer FROM public.document WHERE tenant_id=${tenant}::uuid) AS documents,
    (SELECT count(*)::integer FROM public.india_gst_native_fiscal_document_origin WHERE tenant_id=${tenant}::uuid) AS origins,
    (SELECT count(*)::integer FROM public.india_gst_native_invoice_timing WHERE tenant_id=${tenant}::uuid) AS timings,
    (SELECT count(*)::integer FROM public.india_gst_accommodation_quoted_rate_applicability WHERE tenant_id=${tenant}::uuid) AS applicability,
    (SELECT count(*)::integer FROM public.india_gst_accommodation_quoted_rate_applicability_room_night WHERE tenant_id=${tenant}::uuid) AS applicability_nights,
    (SELECT count(*)::integer FROM public.india_gst_accommodation_final_component_tax WHERE tenant_id=${tenant}::uuid) AS taxes,
    (SELECT count(*)::integer FROM public.india_gst_accommodation_final_component_tax_room_night WHERE tenant_id=${tenant}::uuid) AS tax_nights,
    (SELECT count(*)::integer FROM public.india_gst_accommodation_final_component_tax_component WHERE tenant_id=${tenant}::uuid) AS components,
    (SELECT count(*)::integer FROM public.india_gst_accommodation_final_component_tax_journal_binding WHERE tenant_id=${tenant}::uuid) AS bindings,
    (SELECT count(*)::integer FROM public.journal WHERE tenant_id=${tenant}::uuid) AS journals,
    (SELECT count(*)::integer FROM public.posting_line WHERE tenant_id=${tenant}::uuid) AS lines,
    (SELECT count(*)::integer FROM public.api_idempotency WHERE tenant_id=${tenant}::uuid) AS receipts,
    (SELECT count(*)::integer FROM public.outbox WHERE tenant_id=${tenant}::uuid) AS events,
    (SELECT count(*)::integer FROM public.fact_log WHERE tenant_id=${tenant}::uuid) AS facts,
    (SELECT md5(string_agg(row_to_json(original)::text,'|' ORDER BY original.id)) FROM
      (SELECT p.* FROM public.posting_line p JOIN public.journal j ON j.tenant_id=p.tenant_id AND j.id=p.journal_id
        WHERE p.tenant_id=${tenant}::uuid AND j.kind='charge'
          AND j.source='{"interface":"financials.charge.post"}'::jsonb) original) AS original_lines,
    (SELECT coalesce(sum(p.amount_minor),0)::text FROM public.posting_line p JOIN public.account a
      ON a.tenant_id=p.tenant_id AND a.id=p.account_id WHERE p.tenant_id=${tenant}::uuid AND a.role='guest') AS guest,
    (SELECT coalesce(sum(p.amount_minor),0)::text FROM public.posting_line p JOIN public.account a
      ON a.tenant_id=p.tenant_id AND a.id=p.account_id WHERE p.tenant_id=${tenant}::uuid AND a.role='revenue') AS revenue,
    (SELECT coalesce(sum(p.amount_minor),0)::text FROM public.posting_line p JOIN public.account a
      ON a.tenant_id=p.tenant_id AND a.id=p.account_id WHERE p.tenant_id=${tenant}::uuid AND a.role='tax_payable') AS payables,
    (SELECT count(*)::integer FROM (SELECT journal_id FROM public.posting_line WHERE tenant_id=${tenant}::uuid
      GROUP BY journal_id HAVING sum(amount_minor)<>0) unbalanced) AS unbalanced,
    next_no::text,last_doc_hash FROM public.document_series WHERE tenant_id=${tenant}::uuid AND id=${series}::uuid`;
  if (!row) throw new Error("Concurrency fixture census is unavailable");
  return row;
}

function expectOneConcurrentInvoice(before: Awaited<ReturnType<typeof concurrencyCensus>>,
  after: Awaited<ReturnType<typeof concurrencyCensus>>, positive: boolean, extraEvents = 0): void {
  expect(after.last_doc_hash).toMatch(/^[0-9a-f]{64}$/);
  expect(after).toEqual({ ...before,
    documents: before.documents + 1, origins: before.origins + 1, timings: before.timings + 1,
    applicability: before.applicability + 1, applicability_nights: before.applicability_nights + 1,
    taxes: before.taxes + 1, tax_nights: before.tax_nights + 1, components: before.components + 2,
    bindings: before.bindings + 1, journals: before.journals + (positive ? 1 : 0),
    lines: before.lines + (positive ? 4 : 0), receipts: before.receipts + 1,
    facts: before.facts + (positive ? 3 : 2), events: before.events + (positive ? 4 : 3) + extraEvents,
    guest: (BigInt(before.guest) + (positive ? 500n : 0n)).toString(),
    payables: (BigInt(before.payables) - (positive ? 500n : 0n)).toString(),
    next_no: (BigInt(before.next_no) + 1n).toString(), last_doc_hash: after.last_doc_hash });
}

// Uses the production-shaped candidate capabilities, never a test authority
// wrapper or owner-inserted timing/tax/journal/document. The coordinator must
// install the complete isolated candidate first. Tests do not grant themselves
// privileges, alter a clock or weaken deferred completion constraints.
issuanceDescribe("Order434 genuine native invoice transaction", () => {
  let deploy: SQL;
  let runtime: Database;
  beforeAll(async () => {
    deploy = new SQL(deployUrl!, { max: 2, prepare: false });
    runtime = Database.connect(issueRuntimeUrl!, { maxConnections: 3, prepare: false });
    const [installed] = await deploy<Array<{ available: boolean }>>`
      SELECT count(*)=4 AND bool_and(has_function_privilege('app_role',p.oid,'EXECUTE')) AS available
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname IN ('prepare_india_native_fiscal_invoice_v2',
        'commit_india_native_fiscal_invoice_v2','consume_india_native_fiscal_accounting_event',
        'read_india_native_accounting_source_closure')`;
    if (!installed?.available) throw new Error("Complete isolated native issuance candidate is not enabled; no proof is claimed");
  });
  afterAll(async () => { await runtime?.close(); await deploy?.close(); });

  test("real charge and valuation issue one invoice without reposting revenue, then replay without any effects", async () => {
    const fixture = await createNativeSourceFixture(deploy, runtime, { label: "native-e2e" });
    const charge = await fixture.postCharge("10000", "native-e2e-charge");
    const valuationService = new IndiaGstAccommodationFinalValuationService({ idempotency: new PostgresIdempotency() });
    const valuation = await runtime.withTenantTransaction(fixture.tenant, tx => valuationService.finalizeNative(tx, freezeGraph({
      tenantId: fixture.tenant, propertyNode: fixture.property, reservationId: fixture.reservation,
      folioId: fixture.folio, buyerPartyId: fixture.party,
      serviceProvisionSnapshotId: fixture.serviceResult.serviceProvision.serviceProvisionSnapshotId,
      sources: [{ postingRootId: charge.postingRootId, sourceKind: "room_consideration", additionSubtype: null,
        discountEligibility: null, evidenceSource: "operator_attestation", evidenceReference: "native-e2e-charge" }],
      ordinaryAttestation: { relationshipConclusion: "unrelated_not_distinct", considerationConclusion: "money_only",
        section152Conclusion: "all_additions_enumerated", section153Conclusion: "all_discounts_eligible",
        sourceCompletenessConclusion: "all_sources_classified", evidenceSource: "operator_attestation",
        evidenceReference: "native-e2e-section15" },
      expectedCurrentValuationId: null, expectedCurrentEvidenceHash: null, approvalRequestId: null,
      idempotencyKey: "native-e2e-valuation",
      envelope: createAuditEnvelope({ tenantId: fixture.tenant, propertyNode: fixture.property,
        actorId: fixture.actor, requestId: crypto.randomUUID(), operation: "india_gst.accommodation_final_valuation_recorded" }),
    })));
    const statutory = await createNativeStatutoryFixture(deploy, fixture);
    await deploy`INSERT INTO public.role_permission(role_id,permission_code)
      SELECT ur.role_id,permission.code FROM public.user_role ur
      CROSS JOIN public.permission permission WHERE ur.tenant_id=${fixture.tenant}::uuid
        AND ur.user_id=${fixture.actor}::uuid AND permission.code IN ('tax-fiscal.documents:issue','tax-fiscal.series:configure')
      ON CONFLICT DO NOTHING`;
    const payableIds: string[] = [];
    for (const component of ["CGST", "SGST"]) {
      const account = crypto.randomUUID();
      const code = `N434_${component}_${crypto.randomUUID().replaceAll("-", "").slice(0, 10)}`;
      payableIds.push(account);
      await deploy.begin(async tx => {
        await tx`INSERT INTO public.account(tenant_id,id,property_node,role,name,currency)
          VALUES(${fixture.tenant}::uuid,${account}::uuid,${fixture.property}::uuid,'tax_payable',${component},'INR')`;
        await tx`INSERT INTO public.tx_code(code,name,grp,usali_line,default_dr,default_cr)
          VALUES(${code},${component},'tax','liabilities.tax','guest','tax_payable')`;
        await tx`INSERT INTO public.tx_code_route(tenant_id,property_node,currency,tx_code,credit_account_id)
          VALUES(${fixture.tenant}::uuid,${fixture.property}::uuid,'INR',${code},${account}::uuid)`;
        await tx`INSERT INTO public.tax_semantic_route(tenant_id,property_node,currency,jurisdiction_extension_id,
          jurisdiction_owner_tenant_id,jurisdiction_key,jurisdiction_version,jurisdiction_content_hash,semantic_kind,semantic_code,tx_code)
          VALUES(${fixture.tenant}::uuid,${fixture.property}::uuid,'INR',${statutory.jurisdiction.extensionId}::uuid,NULL,
            ${statutory.jurisdiction.key},${Number(statutory.jurisdiction.version)},${statutory.jurisdiction.contentHash},'tax',${component},${code})`;
      });
    }
    const series = await runtime.withTenantTransaction(fixture.tenant, tx => new IndiaNativeFiscalSeriesConfigurationService().configure(tx, {
      tenantId: fixture.tenant, propertyNode: fixture.property, supplierRegistrationId: statutory.seller.registrationId,
      documentKind: "invoice", prefix: "INV/",
      envelope: createAuditEnvelope({ tenantId: fixture.tenant, propertyNode: fixture.property, actorId: fixture.actor,
        requestId: crypto.randomUUID(), operation: "document.series.configured" }),
    }));
    const request = freezeGraph({
      tenantId: fixture.tenant, propertyNode: fixture.property, actorId: fixture.actor,
      reservationId: fixture.reservation, folioId: fixture.folio, valuationId: valuation.valuationId,
      serviceProvisionSnapshotId: fixture.serviceResult.serviceProvision.serviceProvisionSnapshotId,
      paymentReceiptSnapshotId: fixture.paymentResult.paymentReceipt.paymentReceiptSnapshotId,
      ordinaryRegimeEvidenceId: fixture.ordinaryResult.ordinaryRegimeEvidenceId,
      supplierServiceLocationId: statutory.location.supplierServiceLocationId,
      supplierRegistrationStatusId: statutory.supplierStatusId, supplierSezStatusId: statutory.supplierSez.supplierSezStatusId,
      recipientRegistrationId: statutory.recipient.registrationId, recipientSezStatusId: statutory.recipientSez.recipientSezStatusId,
      classificationId: statutory.classificationId, calendarEvidence: null, idempotencyKey: "native-e2e-first-invoice",
      envelope: createAuditEnvelope({ tenantId: fixture.tenant, propertyNode: fixture.property, actorId: fixture.actor,
        requestId: crypto.randomUUID(), operation: "document.issued" }),
    });
    const command = new IssueIndiaNativeFiscalInvoiceCommand(runtime);
    const issued = await command.execute(request); // Actual deferred COMMIT must succeed.
    expect(issued).toMatchObject({ replayed: false, documentKind: "invoice", seriesId: series.seriesId, docNo: "INV/1" });
    const [money] = await deploy<Array<{ revenue: string; guest: string; payables: string; journals: number; lines: number }>>`
      SELECT (SELECT coalesce(sum(p.amount_minor),0)::text FROM public.posting_line p WHERE p.tenant_id=${fixture.tenant}::uuid
        AND p.account_id=${fixture.revenueAccount}::uuid) AS revenue,
      (SELECT coalesce(sum(p.amount_minor),0)::text FROM public.posting_line p WHERE p.tenant_id=${fixture.tenant}::uuid
        AND p.account_id=${fixture.guestAccount}::uuid) AS guest,
      (SELECT coalesce(sum(p.amount_minor),0)::text FROM public.posting_line p JOIN public.account a ON a.tenant_id=p.tenant_id AND a.id=p.account_id
        WHERE p.tenant_id=${fixture.tenant}::uuid AND a.role='tax_payable') AS payables,
      (SELECT count(*)::integer FROM public.journal j WHERE j.tenant_id=${fixture.tenant}::uuid) AS journals,
      (SELECT count(*)::integer FROM public.posting_line p WHERE p.tenant_id=${fixture.tenant}::uuid) AS lines`;
    expect(money).toEqual({ revenue: "-10000", guest: "10500", payables: "-500", journals: 2, lines: 6 });
    const balances = await deploy<Array<{ amount: string }>>`SELECT sum(p.amount_minor)::text AS amount
      FROM public.posting_line p JOIN public.account a ON a.tenant_id=p.tenant_id AND a.id=p.account_id
      WHERE p.tenant_id=${fixture.tenant}::uuid AND a.role='tax_payable' GROUP BY a.id ORDER BY a.id`;
    expect(balances).toEqual([{ amount: "-250" }, { amount: "-250" }]);
    const census = async () => (await deploy`SELECT
      (SELECT count(*) FROM public.document WHERE tenant_id=${fixture.tenant}::uuid)::text AS documents,
      (SELECT count(*) FROM public.outbox WHERE tenant_id=${fixture.tenant}::uuid)::text AS events,
      (SELECT count(*) FROM public.fact_log WHERE tenant_id=${fixture.tenant}::uuid)::text AS facts,
      (SELECT count(*) FROM public.posting_line WHERE tenant_id=${fixture.tenant}::uuid)::text AS lines,
      (SELECT next_no::text FROM public.document_series WHERE tenant_id=${fixture.tenant}::uuid AND id=${series.seriesId}::uuid) AS next_no`)[0];
    const beforeReplay = await census();
    const replay = await command.execute(freezeGraph({ ...request, envelope: createAuditEnvelope({ tenantId: fixture.tenant,
      propertyNode: fixture.property, actorId: fixture.actor, requestId: crypto.randomUUID(), operation: "document.issued" }) }));
    expect(replay).toEqual({ ...issued, replayed: true });
    expect(await census()).toEqual(beforeReplay);
    expect(beforeReplay).toMatchObject({ documents: "1", next_no: "2" });
    expect(payableIds).toHaveLength(2);
  }, 60000);

  test("fresh issuance and permanent replay both require current issue and valuation permission", async () => {
    const { fixture, series, request } = await createNativeIssuanceFixture(deploy, runtime, { label: "native-current-authority" });
    const command = new IssueIndiaNativeFiscalInvoiceCommand(runtime);
    const census = async () => (await deploy`SELECT
      (SELECT count(*) FROM public.document WHERE tenant_id=${fixture.tenant}::uuid)::text AS documents,
      (SELECT count(*) FROM public.india_gst_native_invoice_timing WHERE tenant_id=${fixture.tenant}::uuid)::text AS timings,
      (SELECT count(*) FROM public.api_idempotency WHERE tenant_id=${fixture.tenant}::uuid)::text AS receipts,
      (SELECT count(*) FROM public.outbox WHERE tenant_id=${fixture.tenant}::uuid)::text AS events,
      (SELECT count(*) FROM public.fact_log WHERE tenant_id=${fixture.tenant}::uuid)::text AS facts,
      (SELECT count(*) FROM public.posting_line WHERE tenant_id=${fixture.tenant}::uuid)::text AS lines,
      (SELECT next_no::text FROM public.document_series WHERE tenant_id=${fixture.tenant}::uuid AND id=${series.seriesId}::uuid) AS next_no`)[0];
    const denyWithPermissionRemoved = async () => {
      for (const permission of ["tax-fiscal.documents:issue", "tax-fiscal.india-valuation:finalize"]) {
        const removed = await deploy<Array<{ role_id: string }>>`DELETE FROM public.role_permission rp
          USING public.user_role ur WHERE ur.tenant_id=${fixture.tenant}::uuid AND ur.user_id=${fixture.actor}::uuid
            AND rp.role_id=ur.role_id AND rp.permission_code=${permission} RETURNING rp.role_id::text`;
        expect(removed.length).toBeGreaterThan(0);
        try {
          const before = await census();
          await expectSqlState(command.execute(request), "42501");
          expect(await census()).toEqual(before);
        } finally {
          for (const role of removed) await deploy`INSERT INTO public.role_permission(role_id,permission_code)
            VALUES(${role.role_id}::uuid,${permission}) ON CONFLICT DO NOTHING`;
        }
      }
    };
    await denyWithPermissionRemoved();
    const issued = await command.execute(request);
    expect(issued.replayed).toBe(false);
    await denyWithPermissionRemoved();
    const beforeReplay = await census();
    expect(await command.execute(request)).toEqual({ ...issued, replayed: true });
    expect(await census()).toEqual(beforeReplay);
    expect(beforeReplay).toMatchObject({ documents: "1", timings: "1", next_no: "2" });
  }, 60000);

  test("real inline accounting replay preserves event order and survives original request-event retention", async () => {
    for (const variant of [
      { label: "positive", amount: "10000", rounding: "exact_5_percent" as const, hasTaxJournal: true },
      { label: "zero", amount: "1", rounding: "component_half_up" as const, hasTaxJournal: false },
    ]) {
      const { fixture, series, request } = await createNativeIssuanceFixture(deploy, runtime, {
        label: `native-inline-${variant.label}`, roomNightAmounts: [variant.amount], quotedTaxRounding: variant.rounding,
      });
      const snapshot = async (tx: Tx) => (await tx`SELECT
        (SELECT count(*)::integer FROM public.document WHERE tenant_id=${fixture.tenant}::uuid) AS documents,
        (SELECT count(*)::integer FROM public.india_gst_native_fiscal_document_origin WHERE tenant_id=${fixture.tenant}::uuid) AS origins,
        (SELECT count(*)::integer FROM public.india_gst_accommodation_final_component_tax_journal_binding WHERE tenant_id=${fixture.tenant}::uuid) AS bindings,
        (SELECT count(*)::integer FROM public.journal WHERE tenant_id=${fixture.tenant}::uuid) AS journals,
        (SELECT count(*)::integer FROM public.posting_line WHERE tenant_id=${fixture.tenant}::uuid) AS lines,
        (SELECT count(*)::integer FROM public.fact_log WHERE tenant_id=${fixture.tenant}::uuid) AS facts,
        (SELECT count(*)::integer FROM public.outbox WHERE tenant_id=${fixture.tenant}::uuid) AS events,
        (SELECT count(*)::integer FROM public.api_idempotency WHERE tenant_id=${fixture.tenant}::uuid) AS receipts,
        (SELECT next_no::text FROM public.document_series WHERE tenant_id=${fixture.tenant}::uuid AND id=${series.seriesId}::uuid) AS next_no`)[0];
      const handler = new IndiaNativeFiscalAccountingEventHandler();
      let recordedEventId: string | undefined;
      let recordedAccounting: Awaited<ReturnType<typeof handler.handle>> | undefined;
      // Delegate both calls to the real handler. This observation port changes
      // no SQL, clock, authentication, connection or financial source.
      const issuer = new IndiaNativeFiscalInvoiceIssuanceService({ nativeAccounting: {
        async handle(tx, input) {
          recordedEventId = input.eventId;
          const [before] = await tx<Array<{ pid: number; xid: string; documents: number; bindings: number }>>`
            SELECT pg_backend_pid() AS pid,pg_current_xact_id()::text AS xid,
              (SELECT count(*)::integer FROM public.document WHERE tenant_id=${fixture.tenant}::uuid) AS documents,
              (SELECT count(*)::integer FROM public.india_gst_accommodation_final_component_tax_journal_binding
                WHERE tenant_id=${fixture.tenant}::uuid) AS bindings`;
          expect(before).toMatchObject({ documents: 0, bindings: 0 });
          const first = await handler.handle(tx, input);
          expect(first).toMatchObject({ created: true, replayed: false, folioId: fixture.folio,
            reservationId: fixture.reservation, currency: "INR" });
          expect(first.journalId !== null).toBe(variant.hasTaxJournal);
          const afterFirst = await snapshot(tx);
          expect(afterFirst).toMatchObject({ documents: 0, origins: 0, bindings: 1, next_no: series.nextNo });
          expect(await handler.handle(tx, input)).toEqual({ ...first, created: false, replayed: true });
          expect(await snapshot(tx)).toEqual(afterFirst);
          const [after] = await tx<Array<{ pid: number; xid: string }>>`
            SELECT pg_backend_pid() AS pid,pg_current_xact_id()::text AS xid`;
          expect(after).toEqual({ pid: before!.pid, xid: before!.xid });
          recordedAccounting = first;
          return first;
        },
      } });
      const issued = await runtime.withTenantTransaction(fixture.tenant, tx => issuer.issueNative(tx, request));
      if (!recordedEventId || !recordedAccounting) throw new Error("Real inline accounting was not observed");
      const eventId = recordedEventId;
      const expectedReplay = { ...recordedAccounting, created: false, replayed: true };
      const events = await deploy<Array<{ kind: string; same_clock: boolean; request_cause: boolean }>>`
        SELECT e.event_type AS kind,e.created_at=n.transaction_timestamp AS same_clock,
          e.causation_id=n.request_event_id AS request_cause
        FROM public.india_gst_native_invoice_timing n JOIN public.outbox e
          ON e.tenant_id=n.tenant_id AND e.correlation_id=n.request_id
        WHERE n.tenant_id=${fixture.tenant}::uuid AND n.request_event_id=${eventId}::uuid ORDER BY e.seq`;
      expect(events.map(event => event.kind)).toEqual([
        "india_gst.native_accommodation_accounting_requested", "india_gst.native_accommodation_accounting_bound",
        ...(variant.hasTaxJournal ? ["journal.posted"] : []), "document.issued",
      ]);
      expect(events.every(event => event.same_clock)).toBe(true);
      expect(events.slice(1, -1).every(event => event.request_cause)).toBe(true);
      const committed = await runtime.withTenantTransaction(fixture.tenant, snapshot);
      expect(await runtime.withTenantTransaction(fixture.tenant, tx => handler.handle(tx, { tenantId: fixture.tenant, eventId })))
        .toEqual(expectedReplay);
      expect(await runtime.withTenantTransaction(fixture.tenant, snapshot)).toEqual(committed);
      const [dependencies] = await deploy<Array<{ count: number }>>`
        SELECT count(*)::integer AS count FROM public.consumer_processed WHERE outbox_id=${eventId}::uuid`;
      expect(dependencies).toEqual({ count: 0 });
      // Remove only this synthetic request event by its permanent timing link;
      // all financial records, document and immutable origin remain untouched.
      const removed = await deploy<Array<{ id: string }>>`
        DELETE FROM public.outbox e USING public.india_gst_native_invoice_timing n
        WHERE n.tenant_id=${fixture.tenant}::uuid AND n.prospective_document_id=${issued.documentId}::uuid
          AND n.request_event_id=${eventId}::uuid AND e.tenant_id=n.tenant_id
          AND e.id=n.request_event_id AND e.seq=n.request_event_seq
          AND e.event_type='india_gst.native_accommodation_accounting_requested' RETURNING e.id::text`;
      expect(removed).toEqual([{ id: eventId }]);
      const retained = await runtime.withTenantTransaction(fixture.tenant, snapshot);
      expect(retained).toEqual({ ...committed, events: committed.events - 1 });
      expect(await runtime.withTenantTransaction(fixture.tenant, tx => handler.handle(tx, { tenantId: fixture.tenant, eventId })))
        .toEqual(expectedReplay);
      expect(await runtime.withTenantTransaction(fixture.tenant, snapshot)).toEqual(retained);
      expect(await new IssueIndiaNativeFiscalInvoiceCommand(runtime).execute({ ...request,
        envelope: { ...request.envelope, requestId: crypto.randomUUID() } })).toEqual({ ...issued, replayed: true });
      expect(await runtime.withTenantTransaction(fixture.tenant, snapshot)).toEqual(retained);
    }
  }, 60_000);

  test("actual native issuance preserves the exact 30-calendar-day timely and late boundary", async () => {
    for (const daysAfterService of [30, 31] as const) {
      // Date only the original service/payment facts. The command must retain
      // its own PostgreSQL transaction clock and the actual property timezone.
      const [dates] = await deploy<Array<{ today: string; service: string; deadline: string }>>`
        SELECT (transaction_timestamp() AT TIME ZONE 'Asia/Kolkata')::date::text AS today,
          ((transaction_timestamp() AT TIME ZONE 'Asia/Kolkata')::date - ${daysAfterService})::text AS service,
          ((transaction_timestamp() AT TIME ZONE 'Asia/Kolkata')::date - ${daysAfterService} + 30)::text AS deadline`;
      if (!dates) throw new Error("Native timing boundary property date is unavailable");
      const { fixture, series, request } = await createNativeIssuanceFixture(deploy, runtime, {
        label: `native-calendar-${daysAfterService}`, roomNightAmounts: ["10000"],
        serviceProvisionDate: dates.service, supplierBooksEntryDate: dates.today,
        supplierBankCreditDate: dates.today,
      });
      const census = async () => (await deploy`SELECT
        (SELECT count(*)::integer FROM public.document WHERE tenant_id=${fixture.tenant}::uuid) AS documents,
        (SELECT count(*)::integer FROM public.india_gst_native_fiscal_document_origin WHERE tenant_id=${fixture.tenant}::uuid) AS origins,
        (SELECT count(*)::integer FROM public.india_gst_native_invoice_timing WHERE tenant_id=${fixture.tenant}::uuid) AS timings,
        (SELECT count(*)::integer FROM public.india_gst_accommodation_quoted_rate_applicability WHERE tenant_id=${fixture.tenant}::uuid) AS applicability,
        (SELECT count(*)::integer FROM public.india_gst_accommodation_final_component_tax WHERE tenant_id=${fixture.tenant}::uuid) AS taxes,
        (SELECT count(*)::integer FROM public.india_gst_accommodation_final_component_tax_journal_binding WHERE tenant_id=${fixture.tenant}::uuid) AS bindings,
        (SELECT count(*)::integer FROM public.journal WHERE tenant_id=${fixture.tenant}::uuid) AS journals,
        (SELECT count(*)::integer FROM public.posting_line WHERE tenant_id=${fixture.tenant}::uuid) AS lines,
        (SELECT count(*)::integer FROM public.api_idempotency WHERE tenant_id=${fixture.tenant}::uuid) AS receipts,
        (SELECT count(*)::integer FROM public.outbox WHERE tenant_id=${fixture.tenant}::uuid) AS events,
        (SELECT count(*)::integer FROM public.fact_log WHERE tenant_id=${fixture.tenant}::uuid) AS facts,
        (SELECT next_no::text FROM public.document_series WHERE tenant_id=${fixture.tenant}::uuid AND id=${series.seriesId}::uuid) AS next_no`)[0];
      const before = await census();
      const command = new IssueIndiaNativeFiscalInvoiceCommand(runtime);
      const issued = await command.execute(request);
      const [projection] = await deploy<Array<{
        issue_date: string; document_date: string; clock_date: string; service_date: string;
        deadline_date: string; receipt_date: string; supply_date: string; statutory_date: string;
        timely: boolean; timezone: string; source_kind: string; rate_kind: string;
        base: string; tax: string; total: string; guest: string; revenue: string;
      }>>`SELECT n.invoice_issue_date::text AS issue_date,d.business_date::text AS document_date,
          (n.transaction_timestamp AT TIME ZONE n.property_timezone)::date::text AS clock_date,
          a.service_provision_date::text AS service_date,(a.service_provision_date+30)::text AS deadline_date,
          a.payment_receipt_date::text AS receipt_date,a.time_of_supply_date::text AS supply_date,
          s.status_as_of::text AS statutory_date,n.invoice_issue_date<=a.service_provision_date+30 AS timely,
          n.property_timezone AS timezone,a.invoice_source_kind AS source_kind,a.rate_selection_kind AS rate_kind,
          t.transaction_value_minor::text AS base,t.tax_minor::text AS tax,t.grand_total_minor::text AS total,
          (SELECT sum(p.amount_minor)::text FROM public.posting_line p
            WHERE p.tenant_id=n.tenant_id AND p.account_id=${fixture.guestAccount}::uuid) AS guest,
          (SELECT sum(p.amount_minor)::text FROM public.posting_line p
            WHERE p.tenant_id=n.tenant_id AND p.account_id=${fixture.revenueAccount}::uuid) AS revenue
        FROM public.india_gst_native_fiscal_document_origin o
        JOIN public.document d ON d.tenant_id=o.tenant_id AND d.id=o.document_id
        JOIN public.india_gst_native_invoice_timing n ON n.tenant_id=o.tenant_id AND n.id=o.native_timing_id
        JOIN public.india_gst_accommodation_quoted_rate_applicability a ON a.tenant_id=n.tenant_id AND a.id=n.applicability_id
        JOIN public.india_gst_accommodation_final_component_tax t ON t.tenant_id=n.tenant_id AND t.id=n.tax_id
        JOIN public.india_gst_supplier_registration_status_snapshot s
          ON s.tenant_id=n.tenant_id AND s.id=n.supplier_registration_status_id
        WHERE o.tenant_id=${fixture.tenant}::uuid AND o.document_id=${issued.documentId}::uuid`;
      expect(projection).toEqual({
        issue_date: dates.today, document_date: dates.today, clock_date: dates.today,
        service_date: dates.service, deadline_date: dates.deadline, receipt_date: dates.today,
        supply_date: daysAfterService === 30 ? dates.today : dates.service,
        statutory_date: daysAfterService === 30 ? dates.today : dates.service,
        timely: daysAfterService === 30, timezone: "Asia/Kolkata", source_kind: "native_current_transaction",
        rate_kind: "ordinary_section13_single_version", base: "10000", tax: "500", total: "10500",
        guest: "10500", revenue: "-10000",
      });
      const after = await census();
      expect(after).toEqual({ ...before, documents: before.documents + 1, origins: before.origins + 1,
        timings: before.timings + 1, applicability: before.applicability + 1, taxes: before.taxes + 1,
        bindings: before.bindings + 1, journals: before.journals + 1, lines: before.lines + 4,
        receipts: before.receipts + 1, events: before.events + 4, facts: before.facts + 3,
        next_no: (BigInt(before.next_no) + 1n).toString() });
      expect(await command.execute({ ...request, envelope: { ...request.envelope, requestId: crypto.randomUUID() } }))
        .toEqual({ ...issued, replayed: true });
      expect(await census()).toEqual(after);
    }
  }, 60_000);

  test("publication wait retains already acquired financial day and series locks without inversion", async () => {
    for (const positive of [true, false]) {
      const { fixture, series, request } = await createNativeIssuanceFixture(deploy, runtime, {
        label: `native-publication-${positive}`, roomNightAmounts: [positive ? "10000" : "1"],
        quotedTaxRounding: positive ? "exact_5_percent" : "component_half_up",
      });
      const before = await concurrencyCensus(deploy, fixture.tenant, series.seriesId);
      const publication = Promise.withResolvers<number>();
      const releasePublisher = Promise.withResolvers<void>();
      const probes = new SQL(deployUrl!, { max: 3, prepare: false });
      const eventsPool = new SQL(issueRuntimeUrl!, { max: 1, prepare: false });
      const events = new PostgresEventBus(eventsPool);
      const barrier = issuanceCommitBarrier();
      const pending: Promise<unknown>[] = [];
      const publisher = runtime.withTenantTransaction(fixture.tenant, async tx => {
        const [backend] = await tx<Array<{ pid: number; day: string }>>`SELECT pg_backend_pid() AS pid,
          (transaction_timestamp() AT TIME ZONE 'Asia/Kolkata')::date::text AS day`;
        if (!backend) throw new Error("Publication holder backend is unavailable");
        const event = await events.publish(tx, { tenantId: fixture.tenant, propertyNode: fixture.property,
          businessDate: backend.day, aggregateType: "property", aggregateId: fixture.property,
          eventType: "order434.publication_probe", actorId: fixture.actor, correlationId: crypto.randomUUID(),
          payload: { synthetic: true } });
        publication.resolve(backend.pid);
        await releasePublisher.promise;
        return event;
      });
      pending.push(publisher);
      publisher.catch(error => publication.reject(error));
      try {
        const publisherPid = await boundedObservation(publication.promise, "publication holder");
        const issue = new IssueIndiaNativeFiscalInvoiceCommand(barrier.database).execute(request);
        pending.push(issue);
        const waiting = await observedWaiter(deploy, publisherPid);
        const issuerPid = waiting.pid;
        expect(issuerPid).not.toBe(publisherPid);
        expect(waiting).toMatchObject({ blockers: [publisherPid], holder_blockers: [], waiting: true, publication: false });
        expect(await concurrencyCensus(deploy, fixture.tenant, series.seriesId)).toEqual(before);
        const probePids: number[] = [];
        for (const resource of ["financial", "day", "series"] as const) {
          const started = Promise.withResolvers<number>();
          const probe = probes.begin(async tx => {
            const [backend] = await tx<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`;
            if (!backend) throw new Error("Resource probe backend is unavailable");
            started.resolve(backend.pid);
            // Read-only lock probes never invoke a business writer or acquire D99.
            if (resource === "financial") await tx`SELECT id FROM public.account
              WHERE tenant_id=${fixture.tenant}::uuid AND id=${fixture.guestAccount}::uuid FOR UPDATE`;
            else if (resource === "day") await tx`SELECT business_date FROM public.business_day
              WHERE tenant_id=${fixture.tenant}::uuid AND property_node=${fixture.property}::uuid FOR UPDATE`;
            else await tx`SELECT id FROM public.document_series
              WHERE tenant_id=${fixture.tenant}::uuid AND id=${series.seriesId}::uuid FOR UPDATE`;
          });
          pending.push(probe);
          probe.catch(error => started.reject(error));
          const probePid = await boundedObservation(started.promise, `${resource} lock probe`);
          probePids.push(probePid);
          const state = await observedWaiter(deploy, issuerPid, probePid);
          expect(state).toMatchObject({ blockers: [issuerPid], holder_blockers: [publisherPid], waiting: true, publication: false });
        }
        expect(new Set([publisherPid, issuerPid, ...probePids]).size).toBe(5);
        releasePublisher.resolve();
        const event = await boundedObservation(publisher, "publication COMMIT");
        expect(await boundedObservation(barrier.reached, "issuer pre-COMMIT")).toBe(issuerPid);
        for (const probePid of probePids) expect(await observedWaiter(deploy, issuerPid, probePid))
          .toMatchObject({ blockers: [issuerPid], holder_blockers: [], waiting: true, publication: false });
        expect(await concurrencyCensus(deploy, fixture.tenant, series.seriesId)).toEqual({ ...before, events: before.events + 1 });
        barrier.release();
        const issued = await boundedObservation(issue, "issuer COMMIT");
        await boundedObservation(Promise.all(pending), "resource probe release");
        const after = await concurrencyCensus(deploy, fixture.tenant, series.seriesId);
        expectOneConcurrentInvoice(before, after, positive, 1);
        const [sequence] = await deploy<Array<{ ordered: boolean }>>`SELECT n.request_event_seq>${event.seq} AS ordered
          FROM public.india_gst_native_invoice_timing n WHERE tenant_id=${fixture.tenant}::uuid
            AND prospective_document_id=${issued.documentId}::uuid`;
        expect(sequence).toEqual({ ordered: true });
        expect(await new IssueIndiaNativeFiscalInvoiceCommand(runtime).execute(request)).toEqual({ ...issued, replayed: true });
        expect(await concurrencyCensus(deploy, fixture.tenant, series.seriesId)).toEqual(after);
      } finally {
        releasePublisher.resolve(); barrier.release();
        await Promise.allSettled(pending);
        await barrier.close(); await probes.close({ timeout: 0 }); await eventsPool.close({ timeout: 0 });
      }
    }
  }, 120_000);

  test("concurrent authority removal and issuance preserve the committed authority winner", async () => {
    for (const issueFirst of [false, true]) for (const positive of [true, false]) {
      const { fixture, series, request } = await createNativeIssuanceFixture(deploy, runtime, {
        label: `native-authority-${issueFirst}-${positive}`, roomNightAmounts: [positive ? "10000" : "1"],
        quotedTaxRounding: positive ? "exact_5_percent" : "component_half_up",
      });
      // No grant-revoke application command exists. Modify only this synthetic
      // actor's configured role tuples through deployment and restore exactly.
      const permission = "tax-fiscal.documents:issue";
      const roles = await deploy<Array<{ role_id: string }>>`SELECT rp.role_id::text FROM public.role_permission rp
        JOIN public.user_role ur ON ur.role_id=rp.role_id WHERE ur.tenant_id=${fixture.tenant}::uuid
          AND ur.user_id=${fixture.actor}::uuid AND rp.permission_code=${permission} ORDER BY rp.role_id`;
      expect(roles.length).toBeGreaterThan(0);
      const before = await concurrencyCensus(deploy, fixture.tenant, series.seriesId);
      const configPool = new SQL(deployUrl!, { max: 1, prepare: false });
      const barrier = issuanceCommitBarrier();
      const remover = Promise.withResolvers<number>();
      const removed = Promise.withResolvers<void>();
      const releaseRemover = Promise.withResolvers<void>();
      const pending: Promise<unknown>[] = [];
      const remove = () => {
        const operation = configPool.begin(async tx => {
          const [backend] = await tx<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`;
          if (!backend) throw new Error("Authority remover backend is unavailable");
          remover.resolve(backend.pid);
          for (const role of roles) {
            const result = await tx`DELETE FROM public.role_permission WHERE role_id=${role.role_id}::uuid
              AND permission_code=${permission} RETURNING role_id`;
            expect(result).toHaveLength(1);
          }
          removed.resolve();
          await releaseRemover.promise;
        });
        operation.catch(error => { remover.reject(error); removed.reject(error); });
        pending.push(operation);
        return operation;
      };
      try {
        if (issueFirst) {
          const issue = new IssueIndiaNativeFiscalInvoiceCommand(barrier.database).execute(request);
          pending.push(issue);
          const issuerPid = await boundedObservation(barrier.reached, "authority-holding issuer");
          const removal = remove();
          const removerPid = await boundedObservation(remover.promise, "authority remover");
          expect(await observedWaiter(deploy, issuerPid, removerPid))
            .toMatchObject({ blockers: [issuerPid], holder_blockers: [], waiting: true, publication: false });
          expect(await concurrencyCensus(deploy, fixture.tenant, series.seriesId)).toEqual(before);
          barrier.release(); releaseRemover.resolve();
          const issued = await boundedObservation(issue, "authorized issuer COMMIT");
          await boundedObservation(removal, "post-issue authority removal");
          const after = await concurrencyCensus(deploy, fixture.tenant, series.seriesId);
          expectOneConcurrentInvoice(before, after, positive);
          await expectSqlState(new IssueIndiaNativeFiscalInvoiceCommand(runtime).execute(request), "42501",
            "native issuer requires both property issue and valuation authority");
          expect(await concurrencyCensus(deploy, fixture.tenant, series.seriesId)).toEqual(after);
          for (const role of roles) await deploy`INSERT INTO public.role_permission(role_id,permission_code)
            VALUES(${role.role_id}::uuid,${permission})`;
          expect(await new IssueIndiaNativeFiscalInvoiceCommand(runtime).execute(request)).toEqual({ ...issued, replayed: true });
          expect(await concurrencyCensus(deploy, fixture.tenant, series.seriesId)).toEqual(after);
        } else {
          const removal = remove();
          const removerPid = await boundedObservation(remover.promise, "first authority remover");
          await boundedObservation(removed.promise, "uncommitted authority removal");
          const issue = new IssueIndiaNativeFiscalInvoiceCommand(runtime).execute(request);
          pending.push(issue); void issue.catch(() => undefined);
          const waiting = await observedWaiter(deploy, removerPid);
          expect(waiting).toMatchObject({ blockers: [removerPid], holder_blockers: [], waiting: true, publication: false });
          expect(await concurrencyCensus(deploy, fixture.tenant, series.seriesId)).toEqual(before);
          releaseRemover.resolve();
          await boundedObservation(removal, "first authority removal COMMIT");
          await expectSqlState(issue, "55000", "native issue role-permission lock set changed");
          expect(await concurrencyCensus(deploy, fixture.tenant, series.seriesId)).toEqual(before);
        }
      } finally {
        releaseRemover.resolve(); barrier.release();
        await Promise.allSettled(pending);
        for (const role of roles) await deploy`INSERT INTO public.role_permission(role_id,permission_code)
          VALUES(${role.role_id}::uuid,${permission}) ON CONFLICT DO NOTHING`;
        await barrier.close(); await configPool.close({ timeout: 0 });
      }
    }
  }, 120_000);

  test("preparation without accounting and final document cannot commit or consume a number", async () => {
    const { fixture, series, request: r } = await createNativeIssuanceFixture(deploy, runtime, { label: "native-partial-rollback" });
    const census = async () => (await deploy`SELECT
      (SELECT count(*) FROM public.document WHERE tenant_id=${fixture.tenant}::uuid)::text AS documents,
      (SELECT count(*) FROM public.india_gst_native_invoice_timing WHERE tenant_id=${fixture.tenant}::uuid)::text AS timings,
      (SELECT count(*) FROM public.india_gst_accommodation_quoted_rate_applicability WHERE tenant_id=${fixture.tenant}::uuid)::text AS applicability,
      (SELECT count(*) FROM public.india_gst_accommodation_final_component_tax WHERE tenant_id=${fixture.tenant}::uuid)::text AS tax,
      (SELECT count(*) FROM public.api_idempotency WHERE tenant_id=${fixture.tenant}::uuid)::text AS receipts,
      (SELECT count(*) FROM public.outbox WHERE tenant_id=${fixture.tenant}::uuid)::text AS events,
      (SELECT count(*) FROM public.fact_log WHERE tenant_id=${fixture.tenant}::uuid)::text AS facts,
      (SELECT count(*) FROM public.posting_line WHERE tenant_id=${fixture.tenant}::uuid)::text AS lines,
      (SELECT next_no::text FROM public.document_series WHERE tenant_id=${fixture.tenant}::uuid AND id=${series.seriesId}::uuid) AS next_no`)[0];
    const before = await census();
    let prepared = false;
    await expectSqlState(runtime.withTenantTransaction(fixture.tenant, async tx => {
      const rows = await tx`
      SELECT * FROM public.prepare_india_native_fiscal_invoice_v2(
        ${r.tenantId}::uuid,${r.propertyNode}::uuid,${r.actorId}::uuid,${r.reservationId}::uuid,${r.folioId}::uuid,
        ${r.valuationId}::uuid,${r.serviceProvisionSnapshotId}::uuid,${r.paymentReceiptSnapshotId}::uuid,
        ${r.ordinaryRegimeEvidenceId}::uuid,${r.supplierServiceLocationId}::uuid,${r.supplierRegistrationStatusId}::uuid,
        ${r.supplierSezStatusId}::uuid,${r.recipientRegistrationId}::uuid,${r.recipientSezStatusId}::uuid,
        ${r.classificationId}::uuid,NULL::text,NULL::text,NULL::date,'{}'::date[],'{}'::text[],
        ${r.idempotencyKey},${r.envelope.requestId}::uuid)`;
      expect(rows).toHaveLength(1);
      prepared = true;
    }), "23503", "india_native_timing_document_fk");
    // The genuine preparation returned; its deferred document FK rejected
    // COMMIT before the later whole-issuance guard could run. No guard is disabled.
    expect(prepared).toBe(true);
    expect(await census()).toEqual(before);
    const issued = await new IssueIndiaNativeFiscalInvoiceCommand(runtime).execute(r);
    expect(issued).toMatchObject({ replayed: false, docNo: "INV/1" });
  }, 60000);
});

describe("Order434 preparation source basis contract", () => {
  test("outer preparation preserves the exact wire and locks before its event-first write tail", async () => {
    const complete = await Bun.file(draft).text();
    const start = complete.indexOf("CREATE OR REPLACE FUNCTION public.prepare_india_native_fiscal_invoice_v2(");
    expect(start).toBeGreaterThan(0);
    const source = complete.slice(start);
    expect(source).toContain("RETURNS TABLE(native_timing_id uuid,request_event_id uuid,posting_binding_id uuid,");
    expect(source).toContain("prepared_source_json text,completed_receipt jsonb)");
    expect(source).toContain("LANGUAGE plpgsql VOLATILE SECURITY DEFINER");
    expect(source).toContain("SET search_path=pg_catalog,public SET timezone='UTC'");
    expect(source).not.toContain("GRANT EXECUTE");
    const signature = source.slice(0, source.indexOf(") RETURNS TABLE"));
    expect(signature.match(/p_\w+ uuid/g)?.length).toBe(16);
    expect(signature.match(/p_\w+ (?:text\[\]|date\[\]|text|date)\b/g)?.length).toBe(6);
    const ordering = [
      "native issue requires a transaction without prior publication",
      "p_tenant::text||p_reservation::text||p_folio::text,0",
      "v_prefix:=public.lock_india_native_invoice_source_prefix(",
      "v_locked:=public.lock_india_native_source_configuration_graph(",
      "FROM public.lock_india_native_statutory_source_graph(",
      "v_document_context:=public.lock_india_native_document_context(",
      "v_basis:=public.india_native_preparation_source_basis(",
      "INSERT INTO public.api_idempotency(",
      "PERFORM pg_catalog.pg_advisory_xact_lock(6441674055002974568::bigint)",
      "INSERT INTO public.outbox(",
      "PERFORM public.persist_india_native_quoted_tax_source(",
      "v_result:=public.assert_india_native_preparation_authenticity(",
    ];
    let previous = -1;
    for (const step of ordering) {
      const index = source.indexOf(step);
      expect(index).toBeGreaterThan(previous);
      previous = index;
    }
    const tail = source.slice(source.indexOf("INSERT INTO public.outbox("));
    expect(tail).not.toMatch(/\bFOR\s+(?:UPDATE|SHARE|KEY SHARE)\b|pg_advisory_xact_lock|nextval\s*\(/i);
    expect(source).not.toMatch(/UPDATE\s+public\.document_series|INSERT\s+INTO\s+public\.(?:document|posting_line|journal)\b/i);
  });

  test("permanent replay precedes fresh source checks and returns no prepared source or new audit effects", async () => {
    const complete = await Bun.file(draft).text();
    const source = complete.slice(complete.indexOf("CREATE OR REPLACE FUNCTION public.prepare_india_native_fiscal_invoice_v2("));
    const replayStart = source.indexOf("SELECT n.* INTO v_existing");
    const replayEnd = source.indexOf("v_timing_id:=pg_catalog.gen_random_uuid()");
    expect(replayStart).toBeGreaterThan(0);
    expect(replayEnd).toBeGreaterThan(replayStart);
    const replay = source.slice(replayStart, replayEnd);
    for (const identity of ["request_hash", "actor_id", "property_node", "reservation_id", "folio_id"]) {
      expect(replay).toContain(`v_existing.${identity} IS DISTINCT FROM`);
    }
    expect(replay).toContain("public.lock_india_native_issue_authority(");
    expect(replay).toContain("public.read_india_native_completed_receipt(p_tenant,v_existing.id)");
    expect(replay).toContain("v_existing.id,v_existing.request_event_id,v_existing.accounting_binding_id,NULL::text,v_result");
    expect(replay).not.toMatch(/INSERT\s+INTO|UPDATE\s+public\.|expires_at|sealed_at|read_india_native_invoice_timing_source|assert_india_native_preparation_authenticity/i);
    expect(source.indexOf("public.read_india_native_invoice_timing_source(")).toBeGreaterThan(replayEnd);
  });

  test("fresh preparation compares source snapshots and publishes only the eight bound event fields", async () => {
    const complete = await Bun.file(draft).text();
    const source = complete.slice(complete.indexOf("CREATE OR REPLACE FUNCTION public.prepare_india_native_fiscal_invoice_v2("));
    for (const snapshot of [
      "v_locked->'valuationEvidence' IS DISTINCT FROM v_valuation",
      "v_locked->'quotedTaxComposition' IS DISTINCT FROM v_composition",
      "v_timing IS DISTINCT FROM public.read_india_native_invoice_timing_source(",
      "v_prefix->'sourceClosure' IS DISTINCT FROM public.read_india_native_valuation_source_closure(",
    ]) expect(source).toContain(snapshot);
    const payload = source.slice(source.indexOf("v_payload:=pg_catalog.jsonb_build_object("), source.indexOf("-- No pre-existing resource"));
    expect([...payload.matchAll(/'([A-Za-z]+)',/g)].map(match => match[1])).toEqual([
      "nativeTimingId", "documentId", "taxId", "applicabilityId", "valuationId", "reservationId", "folioId", "sourceBasisHash",
    ]);
    expect(source).toContain("'india_gst.native_accommodation_accounting_requested',1");
    expect(source).toContain("RETURNING seq INTO v_event_seq");
    expect(source).toContain("v_binding_id,v_event_seq,v_event_id,v_key_hash");
    expect(source).toContain("RETURN QUERY SELECT v_timing_id,v_event_id,v_binding_id,v_statutory.prepared_source_json,NULL::jsonb");
    // Contract checks do not substitute for the genuine same-Tx runtime proof.
  });

  test("stays private, pure and separate from the real source authenticator", async () => {
    const complete = await Bun.file(draft).text();
    const start = complete.indexOf("CREATE OR REPLACE FUNCTION public.india_native_preparation_source_basis(");
    expect(start).toBeGreaterThan(0);
    const end = complete.indexOf("FROM PUBLIC,app_role,yellow_runtime;", start);
    const source = complete.slice(start, end + "FROM PUBLIC,app_role,yellow_runtime;".length);
    expect(source).toContain("RETURNS jsonb LANGUAGE plpgsql IMMUTABLE");
    expect(source).toContain("OWNER TO yellow_owner");
    expect(source).toContain("REVOKE ALL ON FUNCTION public.india_native_preparation_source_basis");
    expect(source).toContain("FROM PUBLIC,app_role,yellow_runtime");
    expect(source).not.toMatch(/(?:INSERT\s+INTO|UPDATE\s+public\.|DELETE\s+FROM|pg_advisory_xact_lock|nextval\s*\()/i);
    expect(source).not.toContain("SECURITY DEFINER");
  });

  test("current-transaction authenticator reconstructs records before comparing the persisted projection", async () => {
    const complete = await Bun.file(draft).text();
    const start = complete.indexOf("CREATE OR REPLACE FUNCTION public.assert_india_native_preparation_authenticity(");
    expect(start).toBeGreaterThan(0);
    const end = complete.indexOf("FROM PUBLIC,app_role,yellow_runtime;", start);
    const source = complete.slice(start, end + "FROM PUBLIC,app_role,yellow_runtime;".length);
    for (const reader of [
      "read_india_native_issue_authority", "read_india_native_invoice_timing_source",
      "read_india_native_valuation_evidence", "read_india_native_rate_history_day",
      "read_india_native_statutory_root_graph", "compose_india_native_quoted_tax_source",
      "india_native_preparation_source_basis", "assert_india_native_persisted_tax_projection",
      "assert_india_native_accounting_request",
    ]) expect(source).toContain(`public.${reader}(`);
    expect(source).toContain("n.issuing_transaction_id IS DISTINCT FROM pg_catalog.pg_current_xact_id()");
    expect(source).toContain("n.transaction_timestamp IS DISTINCT FROM pg_catalog.transaction_timestamp()");
    expect(source).toContain("public.india_native_source_hash(v_request) IS DISTINCT FROM n.request_hash");
    expect(source).toContain("v_basis->>'sourceBasisHash' IS DISTINCT FROM n.native_source_basis_hash");
    expect(source.indexOf("public.india_native_preparation_source_basis(")).toBeLessThan(
      source.indexOf("public.assert_india_native_persisted_tax_projection("),
    );
    expect(source).not.toMatch(/(?:INSERT\s+INTO|UPDATE\s+public\.|DELETE\s+FROM|pg_advisory_xact_lock|nextval\s*\()/i);
    expect(source).not.toContain("SECURITY DEFINER");
    // Static dependency/contract proof only; no claim of governed positive issue.
  });
});

databaseDescribe("Order434 source-basis pure SQL integration (not invoice issuance)", () => {
  let deploy: SQL;
  beforeAll(() => { deploy = new SQL(deployUrl!, { max: 2, prepare: false }); });
  afterAll(async () => { await deploy?.close(); });

  async function evaluate(input: BasisParts, nativeInputText = JSON.stringify(input.nativeInput)) {
    return deploy.begin(async tx => {
      await tx`SET TRANSACTION READ ONLY`;
      await tx`SET LOCAL ROLE yellow_owner`;
      const [result] = await tx`
        SELECT public.india_native_preparation_source_basis(
          ${JSON.stringify(input.context)}::jsonb,${nativeInputText}::text,
          ${JSON.stringify(input.nativeResult)}::text,${JSON.stringify(input.valuation)}::jsonb,
          ${JSON.stringify(input.prepared)}::text,${JSON.stringify(input.nature)}::text,
          ${JSON.stringify(input.composition)}::jsonb,${JSON.stringify(input.series)}::jsonb) AS basis`;
      if (!result) throw new Error("source-basis query returned no row");
      return result.basis as { preimageCanonicalJson: string; sourceBasisHash: string };
    });
  }

  async function expectConflict(operation: Promise<unknown>): Promise<void> {
    let caught: unknown;
    try { await operation; } catch (error) { caught = error; }
    expect(caught).toBeDefined();
    const error = caught as { errno?: unknown; sqlState?: unknown; code?: unknown };
    expect(String(error.errno ?? error.sqlState ?? error.code)).toBe("55000");
  }

  test("matches independent exact canonical preimage and SHA256 in a read-only transaction", async () => {
    const input = parts();
    const expected = canonical(domain(input));
    const actual = await evaluate(input);
    expect(Object.keys(actual).sort()).toEqual(["preimageCanonicalJson", "sourceBasisHash"]);
    expect(actual.preimageCanonicalJson).toBe(expected);
    expect(actual.sourceBasisHash).toBe(new Bun.CryptoHasher("sha256").update(expected).digest("hex"));
    expect(await evaluate(input)).toEqual(actual);
  });

  test("ignores JSONB object insertion order while binding original artifact bytes", async () => {
    const input = parts();
    const initial = await evaluate(input);
    input.context = Object.fromEntries(Object.entries(input.context).reverse());
    input.series = Object.fromEntries(Object.entries(input.series).reverse());
    input.valuation = Object.fromEntries(Object.entries(input.valuation).reverse());
    expect(await evaluate(input)).toEqual(initial);
    input.nativeInput = Object.fromEntries(Object.entries(input.nativeInput).reverse());
    const reorderedArtifact = await evaluate(input);
    expect(reorderedArtifact.sourceBasisHash).not.toBe(initial.sourceBasisHash);
    expect(reorderedArtifact.preimageCanonicalJson).toBe(canonical(domain(input)));
  });

  test("binds each generated downstream identity without an accounting/document hash cycle", async () => {
    const initial = await evaluate(parts());
    for (const key of ["applicabilityId", "taxId", "accountingBindingId", "requestId", "requestEventId"]) {
      const input = parts();
      input.context[key] = id(100);
      expect((await evaluate(input)).sourceBasisHash).not.toBe(initial.sourceBasisHash);
    }
    const object = JSON.parse(initial.preimageCanonicalJson) as ObjectValue;
    expect(Object.keys(object)).toHaveLength(9);
    expect(Object.keys(object.context as ObjectValue)).toHaveLength(20);
    expect(Object.keys(object.seriesIdentity as ObjectValue)).toHaveLength(8);
  });

  test("validates the property-local April1 boundary, not the UTC date", async () => {
    expect((await evaluate(parts())).sourceBasisHash).toMatch(/^[0-9a-f]{64}$/);
    const incorrect = parts();
    incorrect.context.invoiceIssueDate = "2026-03-31";
    await expectConflict(evaluate(incorrect));
    const previousYear = parts();
    previousYear.series.financialYearStart = "2025-04-01";
    await expectConflict(evaluate(previousYear));
  });

  test("rejects missing, extra and incorrectly typed envelope fields", async () => {
    const inputs = [parts(), parts(), parts(), parts()];
    delete inputs[0]!.context.requestEventId;
    inputs[1]!.context.requestEventSeq = "100";
    inputs[2]!.series.nextNo = "1";
    inputs[3]!.context.issuingTransactionId = 429;
    for (const input of inputs) await expectConflict(evaluate(input));
  });

  test("rejects mismatched scope, valuation and configured series identity", async () => {
    const inputs = [parts(), parts(), parts()];
    inputs[0]!.nativeInput.tenantId = id(100);
    inputs[1]!.valuation.valuationId = id(100);
    inputs[2]!.series.supplierRegistrationId = id(100);
    for (const input of inputs) await expectConflict(evaluate(input));
  });

  test("requires compact insertion-canonical JSON objects and six-fraction UTC timestamps", async () => {
    const input = parts();
    await expectConflict(evaluate(input, JSON.stringify(input.nativeInput, null, 2)));
    await expectConflict(evaluate(input, "[]"));
    input.context.transactionTimestamp = "2026-03-31T20:00:00Z";
    await expectConflict(evaluate(input));
  });

  test("has only owner execution and does not introduce a runtime authority", async () => {
    const [metadata] = await deploy`
      SELECT p.provolatile,p.prosecdef,pg_get_userbyid(p.proowner) AS owner,
        has_function_privilege('app_role',p.oid,'EXECUTE') AS app_execute,
        has_function_privilege('yellow_runtime',p.oid,'EXECUTE') AS runtime_execute
      FROM pg_proc p WHERE p.oid=
        'public.india_native_preparation_source_basis(jsonb,text,text,jsonb,text,text,jsonb,jsonb)'::regprocedure`;
    expect(metadata).toMatchObject({ provolatile: "i", prosecdef: false, owner: "yellow_owner", app_execute: false, runtime_execute: false });
  });

  test("keeps the prospective authenticator invoker-private pending full governed integration", async () => {
    const [metadata] = await deploy`
      SELECT p.provolatile,p.prosecdef,pg_get_userbyid(p.proowner) AS owner,
        has_function_privilege('app_role',p.oid,'EXECUTE') AS app_execute,
        has_function_privilege('yellow_runtime',p.oid,'EXECUTE') AS runtime_execute
      FROM pg_proc p WHERE p.oid='public.assert_india_native_preparation_authenticity(uuid,uuid)'::regprocedure`;
    expect(metadata).toMatchObject({ provolatile: "v", prosecdef: false, owner: "yellow_owner", app_execute: false, runtime_execute: false });
  });
});
