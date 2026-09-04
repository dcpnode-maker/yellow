import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { SQL } from "bun";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

import {
  IndiaFinalComponentTaxFiscalSourceConflictError,
  IndiaFinalComponentTaxFiscalSourceNotFoundError,
  IndiaFinalComponentTaxFiscalSourceService,
} from "../src/contexts/financials";
import { Database } from "../src/kernel";

setDefaultTimeout(300_000);

const deployUrl = process.env.YELLOW_ORDER412_DATABASE_URL ?? process.env.YELLOW_DEPLOY_DATABASE_URL;
const runtimeUrl = process.env.YELLOW_ORDER412_RUNTIME_DATABASE_URL ?? process.env.YELLOW_RUNTIME_DATABASE_URL;
if (process.env.YELLOW_REQUIRE_ORDER412_DATABASE === "1" && (!deployUrl || !runtimeUrl)) {
  throw new Error("Order412 PostgreSQL proof requires deploy and runtime database URLs");
}
const live = deployUrl && runtimeUrl ? describe.serial : describe.skip;

interface SourceRoot {
  tenant_id: string;
  property_node: string;
  reservation_id: string;
  folio_id: string;
  journal_id: string;
  tax_id: string;
  valuation_id: string;
  applicability_id: string;
  guest_account_id: string;
  family: "igst" | "cgst_sgst" | "cgst_utgst";
  rates: number[];
  nights: number;
  zeroes: number;
}

const sha256 = (value: unknown): string => createHash("sha256").update(JSON.stringify(value)).digest("hex");

live("Order412 live India fiscal-source eligibility", () => {
  const deploy = new SQL(deployUrl!, { max: 4, prepare: false });
  // A single dedicated administrative connection keeps replication-role hostility
  // deterministic; the runtime resolver always reads the committed hostile state.
  const sabotage = new SQL(deployUrl!, { max: 1, prepare: false });
  const database = Database.connect(runtimeUrl!, { maxConnections: 8, prepare: false });
  const service = new IndiaFinalComponentTaxFiscalSourceService();
  let roots: SourceRoot[] = [];

  const input = (root: SourceRoot) => ({
    tenantId: root.tenant_id,
    propertyNode: root.property_node,
    reservationId: root.reservation_id,
    folioId: root.folio_id,
    journalId: root.journal_id,
  });
  const read = (root: SourceRoot) => database.withTenantTransaction(
    root.tenant_id,
    (tx) => service.resolve(tx, input(root)),
  );

  async function census(tenant: string): Promise<string> {
    const [row] = await deploy<Array<{ snapshot: unknown }>>`SELECT jsonb_build_object(
      'accounts',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.id),'[]') FROM account x WHERE x.tenant_id=${tenant}::uuid),
      'folios',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.id),'[]') FROM folio x WHERE x.tenant_id=${tenant}::uuid),
      'reservations',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.id),'[]') FROM reservation x WHERE x.tenant_id=${tenant}::uuid),
      'valuations',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.id,x.generation),'[]') FROM india_gst_accommodation_final_valuation x WHERE x.tenant_id=${tenant}::uuid),
      'valuation_nights',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.valuation_id,x.ordinal),'[]') FROM india_gst_accommodation_valuation_room_night x WHERE x.tenant_id=${tenant}::uuid),
      'applicabilities',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.id),'[]') FROM india_gst_accommodation_quoted_rate_applicability x WHERE x.tenant_id=${tenant}::uuid),
      'applicability_nights',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.applicability_id,x.ordinal),'[]') FROM india_gst_accommodation_quoted_rate_applicability_room_night x WHERE x.tenant_id=${tenant}::uuid),
      'applicability_components',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.applicability_id,x.room_night_ordinal,x.component_ordinal),'[]') FROM india_gst_accommodation_quoted_rate_component x WHERE x.tenant_id=${tenant}::uuid),
      'semantic_routes',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.id),'[]') FROM tax_semantic_route x WHERE x.tenant_id=${tenant}::uuid),
      'tx_code_routes',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.property_node,x.tx_code,x.currency),'[]') FROM tx_code_route x WHERE x.tenant_id=${tenant}::uuid),
      'business_days',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.property_node,x.business_date),'[]') FROM business_day x WHERE x.tenant_id=${tenant}::uuid),
      'tax',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.id,x.generation),'[]') FROM india_gst_accommodation_final_component_tax x WHERE x.tenant_id=${tenant}::uuid),
      'tax_nights',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.tax_id,x.ordinal),'[]') FROM india_gst_accommodation_final_component_tax_room_night x WHERE x.tenant_id=${tenant}::uuid),
      'tax_components',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.tax_id,x.room_night_ordinal,x.component_ordinal),'[]') FROM india_gst_accommodation_final_component_tax_component x WHERE x.tenant_id=${tenant}::uuid),
      'journals',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.id),'[]') FROM journal x WHERE x.tenant_id=${tenant}::uuid),
      'lines',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.journal_id,x.seq),'[]') FROM posting_line x WHERE x.tenant_id=${tenant}::uuid),
      'posting_bindings',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.id),'[]') FROM india_gst_accommodation_final_component_tax_journal_binding x WHERE x.tenant_id=${tenant}::uuid),
      'reversal_bindings',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.id),'[]') FROM india_gst_final_component_tax_journal_reversal_binding x WHERE x.tenant_id=${tenant}::uuid),
      'facts',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.id),'[]') FROM fact_log x WHERE x.tenant_id=${tenant}::uuid),
      'outbox',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.seq),'[]') FROM outbox x WHERE x.tenant_id=${tenant}::uuid),
      'idempotency',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.operation,x.key_hash),'[]') FROM api_idempotency x WHERE x.tenant_id=${tenant}::uuid),
      'documents',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.id),'[]') FROM document x WHERE x.tenant_id=${tenant}::uuid),
      'submissions',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.id),'[]') FROM fiscal_submission x WHERE x.tenant_id=${tenant}::uuid)
    ) snapshot`;
    return JSON.stringify(row!.snapshot);
  }

  async function expectConflictWithoutWrites(root: SourceRoot): Promise<void> {
    const before = await census(root.tenant_id);
    await expect(read(root)).rejects.toBeInstanceOf(IndiaFinalComponentTaxFiscalSourceConflictError);
    expect(await census(root.tenant_id), "complete fiscal-source census changed on rejection").toBe(before);
  }

  beforeAll(async () => {
    const child = Bun.spawn(["bun", "test", "tests/india-final-component-tax-posting.integration.test.ts"], {
      cwd: resolve(import.meta.dir, ".."),
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        YELLOW_ORDER407_DATABASE_URL: deployUrl!,
        YELLOW_ORDER407_RUNTIME_DATABASE_URL: runtimeUrl!,
        YELLOW_REQUIRE_ORDER407_DATABASE: "1",
      },
    });
    const [code, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ]);
    expect(`${stdout}\n${stderr}`).toContain("Order407");
    expect(code).toBe(0);

    // Order407's focused posting harness intentionally seeds recognizable hash
    // sentinels. Order412 is a byte-replay reader, so make that inherited fixture
    // truthful using the exact migration0070 canonical serializer before testing it.
    const canonicalRoots = await deploy<Array<Record<string, unknown>>>`SELECT
      b.tenant_id::text tenant,b.property_node::text property,b.reservation_id::text reservation,
      b.folio_id::text folio,b.journal_id::text journal,t.id::text tax_id,t.valuation_id::text valuation_id,
      t.valuation_generation,t.tax_minor::text tax_minor,t.grand_total_minor::text grand_total_minor,
      t.final_valuation_evidence_hash,t.quoted_rate_applicability_evidence_hash,t.section14_evidence_hash,
      t.levy_component_identity_evidence_hash,t.reservation_lineage_evidence_hash,t.attribution_snapshot_evidence_hash
      FROM india_gst_accommodation_final_component_tax_journal_binding b
      JOIN india_gst_accommodation_final_component_tax t ON t.tenant_id=b.tenant_id AND t.id=b.tax_id
      LEFT JOIN india_gst_final_component_tax_journal_reversal_binding r
        ON r.tenant_id=b.tenant_id AND r.original_journal_id=b.journal_id
      WHERE r.id IS NULL ORDER BY t.recorded_at,b.id`;
    const canonicalHashes = new Map<string, string>();
    for (const root of canonicalRoots) {
      const nights = await deploy<Array<Record<string, unknown>>>`SELECT ordinal,business_date::text business_date,
        final_value_minor::text final_value_minor,slab_upto_minor::text slab_upto_minor,
        aggregate_rate_basis_points,itc_eligible,tax_minor::text tax_minor
        FROM india_gst_accommodation_final_component_tax_room_night
        WHERE tenant_id=${String(root.tenant)}::uuid AND tax_id=${String(root.tax_id)}::uuid ORDER BY ordinal`;
      const components = await deploy<Array<Record<string, unknown>>>`SELECT room_night_ordinal,component_ordinal,
        component_identity,rate_basis_points,tax_amount_minor::text tax_amount_minor
        FROM india_gst_accommodation_final_component_tax_component
        WHERE tenant_id=${String(root.tenant)}::uuid AND tax_id=${String(root.tax_id)}::uuid
        ORDER BY room_night_ordinal,component_ordinal`;
      const roomNights = nights.map((night) => ({
        ordinal: String(night.ordinal),
        businessDate: String(night.business_date),
        transactionValueMinor: String(night.final_value_minor),
        slab: {
          uptoMinor: night.slab_upto_minor === null ? null : Number(night.slab_upto_minor),
          aggregateRateBasisPoints: Number(night.aggregate_rate_basis_points),
          components: components.filter((component) => Number(component.room_night_ordinal) === Number(night.ordinal)).map((component) => ({
            identity: String(component.component_identity),
            rateBasisPoints: Number(component.rate_basis_points),
            taxMinor: String(component.tax_amount_minor),
          })),
        },
        taxMinor: String(night.tax_minor),
      }));
      const body = {
        valuationId: String(root.valuation_id),
        generation: Number(root.valuation_generation),
        roomNights,
        taxMinor: String(root.tax_minor),
        grandTotalMinor: String(root.grand_total_minor),
        predecessorHashes: {
          finalValuation: String(root.final_valuation_evidence_hash),
          quotedRateApplicability: String(root.quoted_rate_applicability_evidence_hash),
          section14: String(root.section14_evidence_hash),
          levyComponentIdentity: String(root.levy_component_identity_evidence_hash),
          reservationLineage: String(root.reservation_lineage_evidence_hash),
          attributionSnapshot: String(root.attribution_snapshot_evidence_hash),
        },
      };
      const canonical = sha256({
        tenant: String(root.tenant), property: String(root.property), reservation: String(root.reservation),
        folio: String(root.folio), ...body,
      });
      canonicalHashes.set(String(root.tax_id), canonical);
      await sabotage`SET session_replication_role=replica`;
      try {
        await sabotage.begin(async (tx) => {
          await tx`UPDATE india_gst_accommodation_final_component_tax SET evidence_hash=${canonical}
            WHERE tenant_id=${String(root.tenant)}::uuid AND id=${String(root.tax_id)}::uuid`;
          await tx`UPDATE india_gst_accommodation_final_component_tax_journal_binding SET tax_evidence_hash=${canonical}
            WHERE tenant_id=${String(root.tenant)}::uuid AND tax_id=${String(root.tax_id)}::uuid`;
          await tx`UPDATE posting_line SET tax_detail=jsonb_set(tax_detail,'{tax,evidenceHash}',to_jsonb(${canonical}::text),false)
            WHERE tenant_id=${String(root.tenant)}::uuid AND journal_id=${String(root.journal)}::uuid AND seq=1`;
        });
      } finally {
        await sabotage`SET session_replication_role=origin`;
      }
    }
    const canonicalized = await deploy<Array<{ tax_id: string; evidence_hash: string; binding_hash: string; detail_hash: string }>>`
      SELECT t.id::text tax_id,t.evidence_hash,b.tax_evidence_hash binding_hash,
        l.tax_detail#>>'{tax,evidenceHash}' detail_hash
      FROM india_gst_accommodation_final_component_tax t
      JOIN india_gst_accommodation_final_component_tax_journal_binding b ON b.tenant_id=t.tenant_id AND b.tax_id=t.id
      JOIN posting_line l ON l.tenant_id=b.tenant_id AND l.journal_id=b.journal_id AND l.seq=1`;
    for (const row of canonicalized) {
      const expected = canonicalHashes.get(row.tax_id);
      expect(expected).toBeDefined();
      expect(row.evidence_hash).toBe(expected!);
      expect(row.binding_hash).toBe(row.evidence_hash);
      expect(row.detail_hash).toBe(row.evidence_hash);
    }

    roots = await deploy<SourceRoot[]>`SELECT
      b.tenant_id::text,b.property_node::text,b.reservation_id::text,b.folio_id::text,
      b.journal_id::text,b.tax_id::text,b.valuation_id::text,b.applicability_id::text,
      b.guest_account_id::text,t.component_family family,
      ARRAY(SELECT DISTINCT n.aggregate_rate_basis_points FROM india_gst_accommodation_final_component_tax_room_night n
        WHERE n.tenant_id=t.tenant_id AND n.tax_id=t.id ORDER BY n.aggregate_rate_basis_points) rates,
      (SELECT count(*)::int FROM india_gst_accommodation_final_component_tax_room_night n
        WHERE n.tenant_id=t.tenant_id AND n.tax_id=t.id) nights,
      (SELECT count(*)::int FROM india_gst_accommodation_final_component_tax_component c
        WHERE c.tenant_id=t.tenant_id AND c.tax_id=t.id AND c.tax_amount_minor=0) zeroes
      FROM india_gst_accommodation_final_component_tax_journal_binding b
      JOIN india_gst_accommodation_final_component_tax t ON t.tenant_id=b.tenant_id AND t.id=b.tax_id
      LEFT JOIN india_gst_final_component_tax_journal_reversal_binding r
        ON r.tenant_id=b.tenant_id AND r.original_journal_id=b.journal_id
      WHERE r.id IS NULL ORDER BY t.recorded_at,b.id`;
    expect(roots.length).toBeGreaterThanOrEqual(6);
  });

  afterAll(async () => {
    await database.close();
    await sabotage.close({ timeout: 0 });
    await deploy.close({ timeout: 0 });
  });

  test("5%, 12% and 18% IGST/split sources, zero components and multiple nights resolve deterministically", async () => {
    expect(new Set(roots.flatMap((root) => root.rates))).toEqual(new Set([500, 1200, 1800]));
    expect(new Set(roots.map((root) => root.family))).toEqual(new Set(["igst", "cgst_sgst", "cgst_utgst"]));
    expect(roots.some((root) => root.zeroes > 0)).toBeTrue();
    expect(roots.some((root) => root.nights > 1)).toBeTrue();

    for (const root of roots) {
      const before = await census(root.tenant_id);
      const first = await read(root);
      const second = await read(root);
      expect(first.state).toBe("eligible_current_posted_source");
      expect(first.currency).toBe("INR");
      expect(first.componentFamily).toBe(root.family);
      expect(first.sourceEvidenceHash).toMatch(/^[0-9a-f]{64}$/);
      expect(JSON.stringify(second)).toBe(JSON.stringify(first));
      expect(Object.isFrozen(first)).toBeTrue();
      expect(Object.isFrozen(first.predecessorHashes)).toBeTrue();
      expect(Object.isFrozen(first.roomNights)).toBeTrue();
      expect(Object.isFrozen(first.components)).toBeTrue();
      expect(Object.isFrozen(first.journalLines)).toBeTrue();
      expect(first.roomNights.every(Object.isFrozen)).toBeTrue();
      expect(first.components.every(Object.isFrozen)).toBeTrue();
      expect(first.journalLines.every(Object.isFrozen)).toBeTrue();
      expect(JSON.stringify(first)).not.toContain(root.tenant_id);
      expect(await census(root.tenant_id)).toBe(before);
    }
  });

  test("closed folio and guest account remain eligible without writes", async () => {
    const root = roots[0]!;
    await deploy`UPDATE folio SET status='closed' WHERE tenant_id=${root.tenant_id}::uuid AND id=${root.folio_id}::uuid`;
    await deploy`UPDATE account SET status='closed' WHERE tenant_id=${root.tenant_id}::uuid AND id=${root.guest_account_id}::uuid`;
    const before = await census(root.tenant_id);
    const result = await read(root);
    expect(result.state).toBe("eligible_current_posted_source");
    expect(await census(root.tenant_id)).toBe(before);
  });

  test("foreign and RLS-concealed identities are not found and mutation-free", async () => {
    const own = roots[0]!, foreign = roots.find((root) => root.tenant_id !== own.tenant_id)!;
    for (const hostile of [
      { ...input(own), tenantId: foreign.tenant_id },
      { ...input(own), propertyNode: foreign.property_node },
      { ...input(own), reservationId: foreign.reservation_id },
      { ...input(own), folioId: foreign.folio_id },
      { ...input(own), journalId: foreign.journal_id },
      { ...input(own), journalId: crypto.randomUUID() },
    ]) {
      const beforeOwn = await census(own.tenant_id), beforeForeign = await census(foreign.tenant_id);
      await expect(database.withTenantTransaction(hostile.tenantId, (tx) => service.resolve(tx, hostile)))
        .rejects.toBeInstanceOf(IndiaFinalComponentTaxFiscalSourceNotFoundError);
      expect(await census(own.tenant_id)).toBe(beforeOwn);
      expect(await census(foreign.tenant_id)).toBe(beforeForeign);
    }
  });

  test("altered root, child ordering, posting topology and account role all fail closed", async () => {
    const root = roots.find((candidate) => candidate.family === "igst")!;
    const [line] = await deploy<Array<{ id: string; amount: string }>>`SELECT id::text,amount_minor::text amount FROM posting_line
      WHERE tenant_id=${root.tenant_id}::uuid AND journal_id=${root.journal_id}::uuid ORDER BY seq DESC LIMIT 1`;
    const missingTaxId = crypto.randomUUID();
    const [account] = await deploy<Array<{ id: string; role: string }>>`SELECT a.id::text,a.role FROM account a
      JOIN posting_line l ON l.tenant_id=a.tenant_id AND l.account_id=a.id
      WHERE l.tenant_id=${root.tenant_id}::uuid AND l.journal_id=${root.journal_id}::uuid AND l.seq>1 ORDER BY l.seq LIMIT 1`;

    await sabotage`SET session_replication_role=replica`;
    try {
      await sabotage`UPDATE india_gst_accommodation_final_component_tax SET evidence_hash=${"f".repeat(64)}
        WHERE tenant_id=${root.tenant_id}::uuid AND id=${root.tax_id}::uuid`;
      await expectConflictWithoutWrites(root);
      await sabotage`UPDATE india_gst_accommodation_final_component_tax t SET evidence_hash=b.tax_evidence_hash
        FROM india_gst_accommodation_final_component_tax_journal_binding b
        WHERE t.tenant_id=b.tenant_id AND t.id=b.tax_id AND b.tenant_id=${root.tenant_id}::uuid AND b.journal_id=${root.journal_id}::uuid`;

      await sabotage`UPDATE india_gst_accommodation_final_valuation SET evidence_hash=${"e".repeat(64)}
        WHERE tenant_id=${root.tenant_id}::uuid AND id=${root.valuation_id}::uuid`;
      await expectConflictWithoutWrites(root);
      await sabotage`UPDATE india_gst_accommodation_final_valuation v SET evidence_hash=t.final_valuation_evidence_hash
        FROM india_gst_accommodation_final_component_tax t
        WHERE v.tenant_id=t.tenant_id AND v.id=t.valuation_id AND t.tenant_id=${root.tenant_id}::uuid AND t.id=${root.tax_id}::uuid`;

      await sabotage`UPDATE india_gst_accommodation_quoted_rate_applicability SET evidence_hash=${"d".repeat(64)}
        WHERE tenant_id=${root.tenant_id}::uuid AND id=${root.applicability_id}::uuid`;
      await expectConflictWithoutWrites(root);
      await sabotage`UPDATE india_gst_accommodation_quoted_rate_applicability a SET evidence_hash=t.quoted_rate_applicability_evidence_hash
        FROM india_gst_accommodation_final_component_tax t
        WHERE a.tenant_id=t.tenant_id AND a.id=t.applicability_id AND t.tenant_id=${root.tenant_id}::uuid AND t.id=${root.tax_id}::uuid`;

      await sabotage`UPDATE india_gst_accommodation_final_component_tax_journal_binding SET tax_id=${missingTaxId}::uuid
        WHERE tenant_id=${root.tenant_id}::uuid AND journal_id=${root.journal_id}::uuid`;
      await expectConflictWithoutWrites(root);
      await sabotage`UPDATE india_gst_accommodation_final_component_tax_journal_binding SET tax_id=${root.tax_id}::uuid
        WHERE tenant_id=${root.tenant_id}::uuid AND journal_id=${root.journal_id}::uuid`;

      await sabotage`UPDATE india_gst_accommodation_final_component_tax_component SET component_ordinal=1
        WHERE tenant_id=${root.tenant_id}::uuid AND tax_id=${root.tax_id}::uuid AND room_night_ordinal=0 AND component_ordinal=0`;
      await expectConflictWithoutWrites(root);
      await sabotage`UPDATE india_gst_accommodation_final_component_tax_component SET component_ordinal=0
        WHERE tenant_id=${root.tenant_id}::uuid AND tax_id=${root.tax_id}::uuid AND room_night_ordinal=0 AND component_ordinal=1`;

      await sabotage`UPDATE india_gst_accommodation_final_component_tax_component SET tax_id=${missingTaxId}::uuid
        WHERE tenant_id=${root.tenant_id}::uuid AND tax_id=${root.tax_id}::uuid AND room_night_ordinal=0 AND component_ordinal=0`;
      await expectConflictWithoutWrites(root);
      await sabotage`UPDATE india_gst_accommodation_final_component_tax_component SET tax_id=${root.tax_id}::uuid
        WHERE tenant_id=${root.tenant_id}::uuid AND tax_id=${missingTaxId}::uuid`;

      await sabotage`INSERT INTO india_gst_accommodation_final_component_tax_component(
          tenant_id,tax_id,room_night_ordinal,component_ordinal,component_identity,rate_basis_points,tax_amount_minor,currency)
        VALUES(${root.tenant_id}::uuid,${root.tax_id}::uuid,0,1,'cgst',250,0,'INR')`;
      await expectConflictWithoutWrites(root);
      await sabotage`DELETE FROM india_gst_accommodation_final_component_tax_component
        WHERE tenant_id=${root.tenant_id}::uuid AND tax_id=${root.tax_id}::uuid AND room_night_ordinal=0 AND component_ordinal=1`;

      await sabotage`UPDATE posting_line SET amount_minor=amount_minor+1 WHERE tenant_id=${root.tenant_id}::uuid AND id=${line!.id}::uuid`;
      await expectConflictWithoutWrites(root);
      await sabotage`UPDATE posting_line SET amount_minor=${line!.amount}::bigint WHERE tenant_id=${root.tenant_id}::uuid AND id=${line!.id}::uuid`;

      await sabotage`UPDATE posting_line target SET tax_detail=source.tax_detail
        FROM posting_line source
        WHERE target.tenant_id=source.tenant_id AND target.journal_id=source.journal_id
          AND target.tenant_id=${root.tenant_id}::uuid AND target.journal_id=${root.journal_id}::uuid
          AND target.id=${line!.id}::uuid AND source.seq=1`;
      await expectConflictWithoutWrites(root);
      await sabotage`UPDATE posting_line SET tax_detail=NULL WHERE tenant_id=${root.tenant_id}::uuid AND id=${line!.id}::uuid`;

      await sabotage`UPDATE account SET role='house' WHERE tenant_id=${root.tenant_id}::uuid AND id=${account!.id}::uuid`;
      await expectConflictWithoutWrites(root);
      await sabotage`UPDATE account SET role=${account!.role} WHERE tenant_id=${root.tenant_id}::uuid AND id=${account!.id}::uuid`;
    } finally {
      await sabotage`SET session_replication_role=origin`;
    }
  });

  test("later valuation/tax generation and an Order408 reversal make the source stale", async () => {
    const root = roots[2]!;
    const laterValuation = crypto.randomUUID(), laterTax = crypto.randomUUID();
    await sabotage`SET session_replication_role=replica`;
    try {
      await sabotage`INSERT INTO india_gst_accommodation_final_valuation(
          tenant_id,id,property_node,reservation_id,folio_id,folio_account_id,window_no,buyer_party_id,attribution_id,
          request_id,generation,disposition,currency,transaction_value_minor,source_set_hash,order341_evidence_hash,
          request_hash,evidence_hash,ordinary_evidence_hashes,manual_reasons,relationship_conclusion,consideration_conclusion,
          section15_2_conclusion,section15_3_conclusion,source_completeness_conclusion,attestation_evidence_source,
          attestation_evidence_reference,relationship_set_hash,attested_by,attested_at,approval_request_id,
          supersedes_valuation_id,actor_id,recorded_at)
        SELECT tenant_id,${laterValuation}::uuid,property_node,reservation_id,folio_id,folio_account_id,window_no,buyer_party_id,
          attribution_id,${crypto.randomUUID()}::uuid,generation+1,disposition,currency,transaction_value_minor,
          ${"1".repeat(64)},order341_evidence_hash,${"2".repeat(64)},${"3".repeat(64)},ordinary_evidence_hashes,manual_reasons,
          relationship_conclusion,consideration_conclusion,section15_2_conclusion,section15_3_conclusion,
          source_completeness_conclusion,attestation_evidence_source,attestation_evidence_reference,relationship_set_hash,
          attested_by,attested_at,approval_request_id,id,actor_id,transaction_timestamp()
        FROM india_gst_accommodation_final_valuation
        WHERE tenant_id=${root.tenant_id}::uuid AND id=${root.valuation_id}::uuid`;
      await expectConflictWithoutWrites(root);

      await sabotage`INSERT INTO india_gst_accommodation_final_component_tax(
          tenant_id,id,property_node,reservation_id,folio_id,applicability_id,valuation_id,valuation_generation,
          request_id,generation,currency,transaction_value_minor,tax_minor,grand_total_minor,component_family,
          selected_version_side,selected_extension_id,selected_extension_version,final_valuation_evidence_hash,
          quoted_rate_applicability_evidence_hash,section14_evidence_hash,levy_component_identity_evidence_hash,
          reservation_lineage_evidence_hash,attribution_snapshot_evidence_hash,evidence_hash,supersedes_tax_id,
          supersedes_tax_evidence_hash,actor_id,recorded_at)
        SELECT tenant_id,${laterTax}::uuid,property_node,reservation_id,folio_id,applicability_id,${laterValuation}::uuid,generation+1,
          ${crypto.randomUUID()}::uuid,generation+1,currency,transaction_value_minor,tax_minor,grand_total_minor,component_family,
          selected_version_side,selected_extension_id,selected_extension_version,${"3".repeat(64)},
          quoted_rate_applicability_evidence_hash,section14_evidence_hash,levy_component_identity_evidence_hash,
          reservation_lineage_evidence_hash,attribution_snapshot_evidence_hash,${"4".repeat(64)},id,evidence_hash,
          actor_id,transaction_timestamp()
        FROM india_gst_accommodation_final_component_tax
        WHERE tenant_id=${root.tenant_id}::uuid AND id=${root.tax_id}::uuid`;
      await expectConflictWithoutWrites(root);

      await sabotage`INSERT INTO india_gst_final_component_tax_journal_reversal_binding(
        tenant_id,id,property_node,reversed_by,posting_binding_id,tax_id,original_journal_id,reversal_journal_id,
        reservation_id,folio_id,currency,business_date)
        SELECT b.tenant_id,${crypto.randomUUID()}::uuid,b.property_node,b.posted_by,b.id,b.tax_id,b.journal_id,${crypto.randomUUID()}::uuid,
          b.reservation_id,b.folio_id,b.currency,b.business_date
        FROM india_gst_accommodation_final_component_tax_journal_binding b
        WHERE b.tenant_id=${root.tenant_id}::uuid AND b.journal_id=${root.journal_id}::uuid`;
      await expectConflictWithoutWrites(root);
    } finally {
      await sabotage`DELETE FROM india_gst_final_component_tax_journal_reversal_binding
        WHERE tenant_id=${root.tenant_id}::uuid AND original_journal_id=${root.journal_id}::uuid`;
      await sabotage`DELETE FROM india_gst_accommodation_final_component_tax WHERE tenant_id=${root.tenant_id}::uuid AND id=${laterTax}::uuid`;
      await sabotage`DELETE FROM india_gst_accommodation_final_valuation WHERE tenant_id=${root.tenant_id}::uuid AND id=${laterValuation}::uuid`;
      await sabotage`SET session_replication_role=origin`;
    }
  });
});
