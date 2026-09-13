import { SQL } from "bun";
import { IssueIndiaNativeFiscalInvoiceCommand } from "../../src/commands/issue-india-native-fiscal-invoice";
import { IndiaNativeFiscalSeriesConfigurationService, IndiaGstAccommodationFinalValuationService } from "../../src/contexts/tax-fiscal";
import { FolioService, FolioTransferService, type FolioTransferInput } from "../../src/contexts/financials";
import { createAuditEnvelope, Database, PostgresEventBus, PostgresIdempotency, type Tx } from "../../src/kernel";
import {
  createNativeIssuanceFixture,
  createNativeCorrectionFirstIssuanceFixture,
  createNativeIssuanceCohort,
  type NativeIssuanceFixtureOptions,
} from "./india-native-fiscal-source-completion-fixture";

// Release proofs execute the frozen canonical bytes, never a local draft copy.
export const CREDIT_MIGRATION = new URL("../../migrations/0087_india_native_fiscal_credit_note.sql", import.meta.url);
export type CreditFixture = Awaited<ReturnType<typeof createCreditFixture>>;
export type CreditWire = { receipt_json: string; replayed: boolean };

export async function createCreditCohort(deploy: SQL, runtime: Database, count: number): Promise<CreditFixture[]> {
  const cohort = await createNativeIssuanceCohort(deploy, runtime, { count, label: `cohort446-${crypto.randomUUID().slice(0, 8)}` });
  const result: CreditFixture[] = [];
  for (const candidate of cohort) result.push(await finishCreditFixture(deploy, runtime, candidate));
  return result;
}

/** All invoice, valuation and accounting rows come from real governed commands. */
export async function createCreditFixture(deploy: SQL, runtime: Database,
  options: NativeIssuanceFixtureOptions & { variant?: "ordinary" | "correction" | "transfer" } = {}) {
  const factory = options.variant === "correction" ? createNativeCorrectionFirstIssuanceFixture
    : options.variant === "transfer" ? createMultirootTransferCandidate : createNativeIssuanceFixture;
  const candidate = await factory(deploy, runtime, { ...options, label: options.label ?? `c446-${crypto.randomUUID().slice(0, 12)}` });
  return finishCreditFixture(deploy, runtime, candidate);
}

export function creditFixtureEvents() {
  return new PostgresEventBus({ reserve: async () => { throw new Error("Credit fixture cannot consume outbox"); } });
}
function freezeCreditInput<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const nested of Object.values(value)) freezeCreditInput(nested);
    Object.freeze(value);
  }
  return value;
}

/** A real two-root transfer retains an unrelated participant after that root
 * returns to its own folio. The issued invoice consumes only the stay root. */
async function createMultirootTransferCandidate(deploy: SQL, runtime: Database, options: NativeIssuanceFixtureOptions) {
  const base = await createNativeIssuanceFixture(deploy, runtime, options);
  const { fixture } = base;
  const label = `multi446-${crypto.randomUUID()}`;
  const [stay] = await deploy<{ root: string; journal: string }[]>`SELECT s.posting_root_id::text root,l.journal_id::text journal
    FROM public.india_gst_accommodation_valuation_source s JOIN public.posting_line l
      ON l.tenant_id=s.tenant_id AND l.id=s.posting_root_id
    WHERE s.tenant_id=${fixture.tenant}::uuid AND s.valuation_id=${base.valuation.valuationId}::uuid`;
  if (!stay) throw new Error("Multi-root stay unavailable");
  const unrelated = await fixture.postCharge("20", `${label}-unrelated`);
  await deploy`INSERT INTO public.document_series(tenant_id,property_node,kind,prefix,next_no,fiscal)
    VALUES(${fixture.tenant}::uuid,${fixture.property}::uuid,'folio',${`MF-${crypto.randomUUID().slice(0, 8)}-`},1,false)`;
  const folios = new FolioService({ events: creditFixtureEvents(), idempotency: new PostgresIdempotency() });
  const envelope = (operation: "folio.opened" | "journal.posted" | "india_gst.accommodation_final_valuation_recorded") =>
    createAuditEnvelope({ tenantId: fixture.tenant, propertyNode: fixture.property, actorId: fixture.actor,
      requestId: crypto.randomUUID(), operation });
  const destination = await runtime.withTenantTransaction(fixture.tenant, tx => folios.openAdditional(tx, {
    tenantId: fixture.tenant, reservationId: fixture.reservation, sourceFolioId: fixture.folio,
    name: "Invoice only stay", idempotencyKey: `${label}-destination`, envelope: envelope("folio.opened"),
  }));
  const transfers = new FolioTransferService({ events: creditFixtureEvents(), idempotency: new PostgresIdempotency(), folios });
  async function transfer(sourceFolioId: string, destinationFolioId: string, groupIds: string[], key: string) {
    const family = await runtime.withTenantTransaction(fixture.tenant, tx => tx<{ id: string; window_no: number; balance_minor: string }[]>`
      SELECT f.id::text,f.window_no,COALESCE(b.balance_minor,0)::text balance_minor FROM public.folio f
      LEFT JOIN public.folio_balance b ON b.tenant_id=f.tenant_id AND b.folio_id=f.id
      WHERE f.tenant_id=${fixture.tenant}::uuid AND f.reservation_id=${fixture.reservation}::uuid ORDER BY f.window_no,f.id`);
    const generation = new Bun.CryptoHasher("md5").update(family.map(row => `${row.id}:${row.window_no}:${row.balance_minor}`).join("|")).digest("hex");
    const input: FolioTransferInput = { tenantId: fixture.tenant, sourceFolioId, destinationFolioId, groupIds,
      reason: "Separate unrelated multi-root participant", generation, previewRevision: "", idempotencyKey: key,
      envelope: envelope("journal.posted") };
    const preview = await runtime.withTenantTransaction(fixture.tenant, tx => transfers.preview(tx, input));
    return runtime.withTenantTransaction(fixture.tenant, tx => transfers.transfer(tx, { ...input, previewRevision: preview.previewRevision }));
  }
  await transfer(fixture.folio, destination.folioId, [stay.journal, unrelated.result.journalId], `${label}-both`);
  await transfer(destination.folioId, fixture.folio, [unrelated.result.journalId], `${label}-return`);
  const valuation = await runtime.withTenantTransaction(fixture.tenant, tx =>
    new IndiaGstAccommodationFinalValuationService({ idempotency: new PostgresIdempotency() }).finalizeNative(tx, freezeCreditInput({
      tenantId: fixture.tenant, propertyNode: fixture.property, reservationId: fixture.reservation,
      folioId: destination.folioId, buyerPartyId: fixture.party,
      serviceProvisionSnapshotId: fixture.serviceResult.serviceProvision.serviceProvisionSnapshotId,
      sources: [{ postingRootId: stay.root, sourceKind: "room_consideration", additionSubtype: null,
        discountEligibility: null, evidenceSource: "operator_attestation", evidenceReference: `${label}-stay` }],
      ordinaryAttestation: { relationshipConclusion: "unrelated_not_distinct", considerationConclusion: "money_only",
        section152Conclusion: "all_additions_enumerated", section153Conclusion: "all_discounts_eligible",
        sourceCompletenessConclusion: "all_sources_classified", evidenceSource: "operator_attestation", evidenceReference: `${label}-section15` },
      expectedCurrentValuationId: null, expectedCurrentEvidenceHash: null, approvalRequestId: null,
      idempotencyKey: `${label}-valuation`, envelope: envelope("india_gst.accommodation_final_valuation_recorded"),
    })));
  return { ...base, valuation, request: freezeCreditInput({ ...base.request, folioId: destination.folioId, valuationId: valuation.valuationId }) };
}

async function finishCreditFixture(deploy: SQL, runtime: Database,
  candidate: Awaited<ReturnType<typeof createNativeIssuanceFixture>>) {
  const invoice = await new IssueIndiaNativeFiscalInvoiceCommand(runtime).execute(candidate.request);
  const { fixture } = candidate;
  await deploy`INSERT INTO public.permission(code,description) VALUES
    ('financials.adjustments:write','Create governed immutable folio adjustments'),
    ('financials.adjustments:post-seal','Post governed corrections referencing sealed source days')
    ON CONFLICT DO NOTHING`;
  await deploy`INSERT INTO public.role_permission(role_id,permission_code)
    SELECT ur.role_id,p.code FROM public.user_role ur CROSS JOIN public.permission p
    WHERE ur.tenant_id=${fixture.tenant}::uuid AND ur.user_id=${fixture.actor}::uuid
      AND p.code IN ('financials.adjustments:write','tax-fiscal.documents:read') ON CONFLICT DO NOTHING`;
  const financialYearSuffix = `${invoice.financialYearStart.slice(2, 4)}${String(Number(invoice.financialYearStart.slice(0, 4)) + 1).slice(2)}`;
  const debitSeries = await runtime.withTenantTransaction(fixture.tenant, tx =>
    new IndiaNativeFiscalSeriesConfigurationService().configure(tx, {
      tenantId: fixture.tenant, propertyNode: fixture.property,
      supplierRegistrationId: candidate.statutory.seller.registrationId, documentKind: "debit_note", prefix: `D/${financialYearSuffix}/`,
      envelope: createAuditEnvelope({ tenantId: fixture.tenant, propertyNode: fixture.property,
        actorId: fixture.actor, requestId: crypto.randomUUID(), operation: "document.series.configured" }),
    }));
  const creditSeries = await runtime.withTenantTransaction(fixture.tenant, tx =>
    new IndiaNativeFiscalSeriesConfigurationService().configure(tx, {
      tenantId: fixture.tenant, propertyNode: fixture.property,
      supplierRegistrationId: candidate.statutory.seller.registrationId, documentKind: "credit_note",
      prefix: `C/${financialYearSuffix}/`,
      envelope: createAuditEnvelope({ tenantId: fixture.tenant, propertyNode: fixture.property,
        actorId: fixture.actor, requestId: crypto.randomUUID(), operation: "document.series.configured" }),
    }));
  return { ...candidate, invoice, creditSeries, debitSeries };
}

export async function commitCredit(tx: Tx, candidate: CreditFixture, overrides: {
  tenant?: string; property?: string; actor?: string; original?: string; reason?: string; key?: string;
} = {}): Promise<CreditWire> {
  const rows = await tx<CreditWire[]>`SELECT * FROM public.commit_india_native_fiscal_credit_note(
    ${overrides.tenant ?? candidate.fixture.tenant}::pg_catalog.uuid,${overrides.property ?? candidate.fixture.property}::pg_catalog.uuid,
    ${overrides.actor ?? candidate.fixture.actor}::pg_catalog.uuid,${overrides.original ?? candidate.invoice.documentId}::pg_catalog.uuid,
    ${overrides.reason ?? "Full cancellation of issued invoice"},${overrides.key ?? `credit-${candidate.invoice.documentId}`},
    ${crypto.randomUUID()}::pg_catalog.uuid)`;
  if (rows.length !== 1 || !rows[0]) throw new Error("Credit capability did not return one receipt");
  return rows[0];
}

export function creditSqlState(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const row = error as { errno?: unknown; code?: unknown };
  return typeof row.errno === "string" ? row.errno : typeof row.code === "string" ? row.code : undefined;
}

/** Full source graph, including every unrelated participant in transfer journals. */
export async function originalCreditGraph(deploy: SQL, candidate: CreditFixture): Promise<string> {
  const [row] = await deploy<{ graph: string }[]>`SELECT jsonb_build_object(
    'document',(SELECT to_jsonb(d) FROM public.document d WHERE d.tenant_id=${candidate.fixture.tenant}::uuid AND d.id=${candidate.invoice.documentId}::uuid),
    'origins',(SELECT jsonb_agg(to_jsonb(o) ORDER BY o.id) FROM public.india_gst_native_fiscal_document_origin o WHERE o.tenant_id=${candidate.fixture.tenant}::uuid),
    'journals',(SELECT jsonb_agg(to_jsonb(j) ORDER BY j.id) FROM public.journal j WHERE j.tenant_id=${candidate.fixture.tenant}::uuid
      AND NOT EXISTS(SELECT 1 FROM public.india_native_fiscal_credit_note c WHERE c.tenant_id=j.tenant_id AND c.correction_journal_id=j.id)),
    'lines',(SELECT jsonb_agg(to_jsonb(l) ORDER BY l.id) FROM public.posting_line l WHERE l.tenant_id=${candidate.fixture.tenant}::uuid
      AND NOT EXISTS(SELECT 1 FROM public.india_native_fiscal_credit_note c WHERE c.tenant_id=l.tenant_id AND c.correction_journal_id=l.journal_id)),
    'series',(SELECT jsonb_agg(to_jsonb(s) ORDER BY s.id) FROM public.document_series s WHERE s.tenant_id=${candidate.fixture.tenant}::uuid AND s.kind<>'credit_note'),
    'submissions',(SELECT jsonb_agg(to_jsonb(s) ORDER BY s.id) FROM public.fiscal_submission s WHERE s.tenant_id=${candidate.fixture.tenant}::uuid)
    )::text AS graph`;
  if (!row) throw new Error("Original graph unavailable");
  return row.graph;
}

export async function creditCensus(deploy: SQL, tenant: string): Promise<string> {
  const [row] = await deploy<{ census: string }[]>`SELECT jsonb_build_object(
    'journals',(SELECT count(*) FROM public.journal WHERE tenant_id=${tenant}::uuid),
    'lines',(SELECT count(*) FROM public.posting_line WHERE tenant_id=${tenant}::uuid),
    'credits',(SELECT count(*) FROM public.india_native_fiscal_credit_note WHERE tenant_id=${tenant}::uuid),
    'documents',(SELECT count(*) FROM public.document WHERE tenant_id=${tenant}::uuid),
    'facts',(SELECT count(*) FROM public.fact_log WHERE tenant_id=${tenant}::uuid),
    'events',(SELECT count(*) FROM public.outbox WHERE tenant_id=${tenant}::uuid),
    'replay',(SELECT count(*) FROM public.api_idempotency WHERE tenant_id=${tenant}::uuid),
    'series',(SELECT jsonb_agg(to_jsonb(s) ORDER BY s.id) FROM public.document_series s WHERE s.tenant_id=${tenant}::uuid)
    )::text AS census`;
  if (!row) throw new Error("Credit census unavailable");
  return row.census;
}
