import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import { ChargeCorrectionService, FolioService, FolioTransferService, type FolioTransferInput } from "../src/contexts/financials";
import {
  IndiaGstAccommodationFinalValuationConflictError,
  IndiaGstAccommodationFinalValuationNotFoundError,
  IndiaGstAccommodationFinalValuationValidationError,
  IndiaGstAccommodationFinalValuationService,
  type IndiaGstAccommodationNativeFinalValuationInput,
} from "../src/contexts/tax-fiscal/india-gst-accommodation-final-valuation";
import { allocateSignedLargestRemainder } from "../src/contexts/tax-fiscal/signed-largest-remainder";
import { createAuditEnvelope, Database, PostgresEventBus, PostgresIdempotency } from "../src/kernel";
import {
  createNativeSourceFixture,
  type NativeSourceFixture,
} from "./fixtures/india-native-fiscal-source-completion-fixture";

const deployUrl = process.env.YELLOW_ORDER434_DEPLOY_DATABASE_URL;
const runtimeUrl = process.env.YELLOW_ORDER434_RUNTIME_DATABASE_URL
  ?? process.env.YELLOW_ORDER434_DATABASE_URL;
if (process.env.YELLOW_REQUIRE_ORDER434_DATABASE === "1" && (!deployUrl || !runtimeUrl)) {
  throw new Error("Order434 native consideration proof requires deploy and runtime URLs");
}
const databaseDescribe = deployUrl && runtimeUrl ? describe.serial : describe.skip;
type NativeSource = IndiaGstAccommodationNativeFinalValuationInput["sources"][number];

function source(postingRootId: string, negative = false): NativeSource {
  return Object.freeze({
    postingRootId,
    sourceKind: negative ? "promotion_discount" : "room_consideration",
    additionSubtype: null,
    discountEligibility: null,
    evidenceSource: "operator_attestation",
    evidenceReference: `recorded-root:${postingRootId}`,
  });
}

function request(
  fixture: NativeSourceFixture,
  sources: readonly NativeSource[],
  key: string,
  changes: Partial<IndiaGstAccommodationNativeFinalValuationInput> = {},
): IndiaGstAccommodationNativeFinalValuationInput {
  return Object.freeze({
    tenantId: fixture.tenant,
    propertyNode: fixture.property,
    reservationId: fixture.reservation,
    folioId: fixture.folio,
    buyerPartyId: fixture.party,
    serviceProvisionSnapshotId: fixture.serviceResult.serviceProvision.serviceProvisionSnapshotId,
    sources: Object.freeze([...sources]),
    ordinaryAttestation: Object.freeze({
      relationshipConclusion: "unrelated_not_distinct",
      considerationConclusion: "money_only",
      section152Conclusion: "all_additions_enumerated",
      section153Conclusion: "all_discounts_eligible",
      sourceCompletenessConclusion: "all_sources_classified",
      evidenceSource: "operator_attestation",
      evidenceReference: "synthetic-ordinary-section15-proof",
    }),
    expectedCurrentValuationId: null,
    expectedCurrentEvidenceHash: null,
    approvalRequestId: null,
    idempotencyKey: key,
    envelope: createAuditEnvelope({
      tenantId: fixture.tenant,
      propertyNode: fixture.property,
      actorId: fixture.actor,
      requestId: crypto.randomUUID(),
      operation: "india_gst.accommodation_final_valuation_recorded",
    }),
    ...changes,
  });
}

interface Census {
  journals: number; lines: number; documents: number; externalInvoices: number;
  valuations: number; sources: number; nights: number; allocations: number;
  facts: number; events: number; guest: string; revenue: string;
}

// This is a source-to-valuation proof. It must not be described as an issued
// native invoice: dependent timing, tax/accounting and completion remain separate.
databaseDescribe("Order434 native valuation from governed consideration", () => {
  let deploy: SQL;
  let runtimeEvents: SQL;
  let database: Database;
  let valuation: IndiaGstAccommodationFinalValuationService;
  let corrections: ChargeCorrectionService;
  let folios: FolioService;
  let transfers: FolioTransferService;

  beforeAll(() => {
    deploy = new SQL(deployUrl!, { max: 2, prepare: false });
    runtimeEvents = new SQL(runtimeUrl!, { max: 2, prepare: false });
    database = Database.connect(runtimeUrl!, { maxConnections: 8, prepare: false });
    valuation = new IndiaGstAccommodationFinalValuationService({ idempotency: new PostgresIdempotency() });
    corrections = new ChargeCorrectionService({
      events: new PostgresEventBus(runtimeEvents), idempotency: new PostgresIdempotency(),
    });
    folios = new FolioService({ events: new PostgresEventBus(runtimeEvents), idempotency: new PostgresIdempotency() });
    transfers = new FolioTransferService({ events: new PostgresEventBus(runtimeEvents), idempotency: new PostgresIdempotency(), folios });
  });
  afterAll(async () => {
    await database?.close();
    await runtimeEvents?.close();
    await deploy?.close();
  });

  function finalize(input: IndiaGstAccommodationNativeFinalValuationInput) {
    return database.withTenantTransaction(input.tenantId, tx => valuation.finalizeNative(tx, input));
  }
  async function census(fixture: NativeSourceFixture): Promise<Census> {
    const [row] = await deploy<Census[]>`SELECT
      (SELECT count(*)::int FROM journal WHERE tenant_id=${fixture.tenant}::uuid) journals,
      (SELECT count(*)::int FROM posting_line WHERE tenant_id=${fixture.tenant}::uuid) lines,
      (SELECT count(*)::int FROM document WHERE tenant_id=${fixture.tenant}::uuid) documents,
      (SELECT count(*)::int FROM india_gst_accommodation_invoice_issue_snapshot WHERE tenant_id=${fixture.tenant}::uuid) "externalInvoices",
      (SELECT count(*)::int FROM india_gst_accommodation_final_valuation WHERE tenant_id=${fixture.tenant}::uuid) valuations,
      (SELECT count(*)::int FROM india_gst_accommodation_valuation_source WHERE tenant_id=${fixture.tenant}::uuid) sources,
      (SELECT count(*)::int FROM india_gst_accommodation_valuation_room_night WHERE tenant_id=${fixture.tenant}::uuid) nights,
      (SELECT count(*)::int FROM india_gst_accommodation_valuation_allocation WHERE tenant_id=${fixture.tenant}::uuid) allocations,
      (SELECT count(*)::int FROM fact_log WHERE tenant_id=${fixture.tenant}::uuid) facts,
      (SELECT count(*)::int FROM outbox WHERE tenant_id=${fixture.tenant}::uuid) events,
      (SELECT coalesce(sum(amount_minor),0)::text FROM posting_line WHERE tenant_id=${fixture.tenant}::uuid AND account_id=${fixture.guestAccount}::uuid) guest,
      (SELECT coalesce(sum(amount_minor),0)::text FROM posting_line WHERE tenant_id=${fixture.tenant}::uuid AND account_id=${fixture.revenueAccount}::uuid) revenue`;
    if (!row) throw new Error("Missing native valuation census");
    return row;
  }

  test("records the real charge basis without any external invoice or duplicate money", async () => {
    const fixture = await createNativeSourceFixture(deploy, database, { label: "native-basic" });
    const charge = await fixture.postCharge("10000");
    const before = await census(fixture);
    expect(before).toMatchObject({ journals: 1, lines: 2, documents: 0, externalInvoices: 0, guest: "10000", revenue: "-10000" });
    const result = await finalize(request(fixture, [source(charge.postingRootId)], "native-basic-finalize"));
    expect(result).toMatchObject({ generation: 0, disposition: "ordinary_final", transactionValueMinor: "10000", replayed: false });
    expect(result.nativeConsiderationBasisHash).toMatch(/^[0-9a-f]{64}$/);
    expect(result.evidenceHash).toMatch(/^[0-9a-f]{64}$/);
    const [stored] = await deploy`SELECT basis_kind, order341_evidence_hash,
      native_service_provision_snapshot_id::text, native_lineage_id::text,
      native_consideration_basis_hash, actor_id::text, attested_by::text
      FROM india_gst_accommodation_final_valuation
      WHERE tenant_id=${fixture.tenant}::uuid AND id=${result.valuationId}::uuid`;
    expect(stored).toEqual({
      basis_kind: "native_consideration", order341_evidence_hash: null,
      native_service_provision_snapshot_id: fixture.serviceResult.serviceProvision.serviceProvisionSnapshotId,
      native_lineage_id: fixture.lineage,
      native_consideration_basis_hash: result.nativeConsiderationBasisHash,
      actor_id: fixture.actor, attested_by: fixture.actor,
    });
    expect(await census(fixture)).toEqual({ ...before, valuations: 1, sources: 1, nights: 1, allocations: 1, facts: before.facts + 1, events: before.events + 1 });
  });

  test("SQL allocations match the shared integer allocator, including ordinal remainder ties", async () => {
    const fixture = await createNativeSourceFixture(deploy, database, { label: "native-weights", roomNightAmounts: ["5000", "5000"] });
    const charge = await fixture.postCharge("10001");
    const result = await finalize(request(fixture, [source(charge.postingRootId)], "native-weights-finalize"));
    const rows = await deploy<{ ordinal: string; amountMinor: string; basis: string }[]>`
      SELECT ordinal::text,amount_minor::text "amountMinor",basis_kind basis
      FROM india_gst_accommodation_valuation_allocation
      WHERE tenant_id=${fixture.tenant}::uuid AND valuation_id=${result.valuationId}::uuid ORDER BY ordinal`;
    const weights = Object.freeze([Object.freeze({ ordinal: "0", weightMinor: "5000" }), Object.freeze({ ordinal: "1", weightMinor: "5000" })]);
    expect(rows.map(({ordinal, amountMinor}) => ({ordinal, amountMinor}))).toEqual([...allocateSignedLargestRemainder("10001", weights)]);
    expect(rows.map(row => row.basis)).toEqual(["native_consideration", "native_consideration"]);
    expect(result.transactionValueMinor).toBe("10001");
    expect((await census(fixture)).guest).toBe("10001");
  });

  test("complete source order is canonical and exact replay rechecks current actor authority", async () => {
    const fixture = await createNativeSourceFixture(deploy, database, { label: "native-replay" });
    const a = await fixture.postCharge("4000");
    const b = await fixture.postCharge("6000");
    const sources = [source(a.postingRootId), source(b.postingRootId)];
    const first = await finalize(request(fixture, sources, "native-replay-finalize"));
    const before = await census(fixture);
    const second = await finalize(request(fixture, [...sources].reverse(), "native-replay-finalize"));
    expect(second).toEqual({ ...first, replayed: true });
    expect(await census(fixture)).toEqual(before);
    await deploy`UPDATE app_user SET status='inactive' WHERE tenant_id=${fixture.tenant}::uuid AND id=${fixture.actor}::uuid`;
    try {
      await expect(finalize(request(fixture, sources, "native-replay-finalize"))).rejects.toBeInstanceOf(IndiaGstAccommodationFinalValuationNotFoundError);
      expect(await census(fixture)).toEqual(before);
    } finally {
      await deploy`UPDATE app_user SET status='active' WHERE tenant_id=${fixture.tenant}::uuid AND id=${fixture.actor}::uuid`;
    }
  });

  test("an omitted real charge fails atomically and complete data succeeds afterward", async () => {
    const fixture = await createNativeSourceFixture(deploy, database, { label: "native-closure" });
    const a = await fixture.postCharge("9999");
    const b = await fixture.postCharge("1");
    const before = await census(fixture);
    await expect(finalize(request(fixture, [source(a.postingRootId)], "native-closure-finalize"))).rejects.toBeInstanceOf(IndiaGstAccommodationFinalValuationConflictError);
    expect(await census(fixture)).toEqual(before);
    const result = await finalize(request(fixture, [source(a.postingRootId), source(b.postingRootId)], "native-closure-finalize"));
    expect(result.transactionValueMinor).toBe("10000");
    expect(result.replayed).toBeFalse();
  });

  test("a real charge correction retains original and contra roots without changing the net value", async () => {
    const fixture = await createNativeSourceFixture(deploy, database, { label: "native-correction", roomNightAmounts: ["5000", "5000"] });
    const stay = await fixture.postCharge("10000");
    const wrong = await fixture.postCharge("1");
    const corrected = await database.withTenantTransaction(fixture.tenant, async tx => {
      const result = await corrections.reverseCharge(tx, {
        tenantId: fixture.tenant, folioId: fixture.folio,
        reversesJournalId: wrong.result.journalId,
        reason: "Correct the synthetic extra room charge", postSealAuthorized: false,
        idempotencyKey: "native-correction-reverse",
        envelope: createAuditEnvelope({
          tenantId: fixture.tenant, propertyNode: fixture.property, actorId: fixture.actor,
          requestId: crypto.randomUUID(), operation: "journal.posted",
        }),
      });
      const [line] = await tx<{ id: string }[]>`SELECT id::text FROM posting_line
        WHERE tenant_id=${fixture.tenant}::uuid AND journal_id=${result.journalId}::uuid AND account_id=${fixture.guestAccount}::uuid`;
      if (!line) throw new Error("Governed correction root missing");
      return line.id;
    });
    const before = await census(fixture);
    expect(before).toMatchObject({ journals: 3, lines: 6, guest: "10000", revenue: "-10000" });
    const result = await finalize(request(fixture, [source(stay.postingRootId), source(wrong.postingRootId), source(corrected, true)], "native-correction-finalize"));
    expect(result.transactionValueMinor).toBe("10000");
    const nights = await deploy<{ amount: string }[]>`SELECT transaction_value_minor::text amount
      FROM india_gst_accommodation_valuation_room_night
      WHERE tenant_id=${fixture.tenant}::uuid AND valuation_id=${result.valuationId}::uuid ORDER BY ordinal`;
    expect(nights).toEqual([{amount: "5000"}, {amount: "5000"}]);
    const after = await census(fixture);
    expect(after).toMatchObject({ journals: before.journals, lines: before.lines, guest: before.guest, revenue: before.revenue, sources: 3, externalInvoices: 0, documents: 0 });
  });

  test("an outer transaction failure rolls back valuation and audit before an exact retry", async () => {
    const fixture = await createNativeSourceFixture(deploy, database, { label: "native-rollback" });
    const charge = await fixture.postCharge("10000");
    const input = request(fixture, [source(charge.postingRootId)], "native-rollback-finalize");
    const before = await census(fixture);
    const failure = new Error("Synthetic command failed after valuation");
    await expect(database.withTenantTransaction(fixture.tenant, async tx => {
      await valuation.finalizeNative(tx, input);
      throw failure;
    })).rejects.toBe(failure);
    expect(await census(fixture)).toEqual(before);
    expect((await finalize(input)).replayed).toBeFalse();
  });

  test("values complete multi-root transfer history after two governed folio reroutes", async () => {
    const fixture = await createNativeSourceFixture(deploy, database, { label: "native-transfer" });
    // This is ordinary non-fiscal configuration, not a seeded financial effect.
    await deploy`INSERT INTO document_series(tenant_id,property_node,kind,prefix,next_no,fiscal)
      VALUES(${fixture.tenant}::uuid,${fixture.property}::uuid,'folio','NATIVE-',1,false)`;
    const first = await fixture.postCharge("4000");
    const second = await fixture.postCharge("6000");
    async function open(name: string) {
      return database.withTenantTransaction(fixture.tenant, tx => folios.openAdditional(tx, {
        tenantId: fixture.tenant, reservationId: fixture.reservation, sourceFolioId: fixture.folio,
        name, idempotencyKey: `native-transfer-window-${name}`,
        envelope: createAuditEnvelope({ tenantId: fixture.tenant, propertyNode: fixture.property,
          actorId: fixture.actor, requestId: crypto.randomUUID(), operation: "folio.opened" }),
      }));
    }
    const business = await open("Business");
    const finalWindow = await open("Final");
    expect([business.windowNo, finalWindow.windowNo]).toEqual([2, 3]);

    async function route(sourceFolioId: string, destinationFolioId: string, key: string) {
      const family = await database.withTenantTransaction(fixture.tenant, tx =>
        tx<{ id: string; window_no: number; balance_minor: string }[]>`SELECT f.id::text,f.window_no,
          coalesce(b.balance_minor,0)::text balance_minor FROM folio f
          LEFT JOIN folio_balance b ON b.tenant_id=f.tenant_id AND b.folio_id=f.id
          WHERE f.tenant_id=${fixture.tenant}::uuid AND f.reservation_id=${fixture.reservation}::uuid
          ORDER BY f.window_no,f.id`);
      const generation = new Bun.CryptoHasher("md5").update(family
        .map(row => `${row.id}:${row.window_no}:${row.balance_minor}`).join("|")).digest("hex");
      const input: FolioTransferInput = {
        tenantId: fixture.tenant, sourceFolioId, destinationFolioId,
        groupIds: [first.result.journalId, second.result.journalId],
        reason: "Route the complete accommodation groups to the requested folio",
        generation, previewRevision: "", idempotencyKey: key,
        envelope: createAuditEnvelope({ tenantId: fixture.tenant, propertyNode: fixture.property,
          actorId: fixture.actor, requestId: crypto.randomUUID(), operation: "journal.posted" }),
      };
      const preview = await database.withTenantTransaction(fixture.tenant, tx => transfers.preview(tx, input));
      const complete = { ...input, previewRevision: preview.previewRevision };
      const result = await database.withTenantTransaction(fixture.tenant, tx => transfers.transfer(tx, complete));
      return { input: complete, result };
    }

    const initialRoute = await route(fixture.folio, business.folioId, "native-transfer-first");
    const finalRoute = await route(business.folioId, finalWindow.folioId, "native-transfer-second");
    expect([initialRoute.result.stayTotalMinor, finalRoute.result.stayTotalMinor]).toEqual(["10000", "10000"]);
    const [history] = await deploy`SELECT count(*)::int lines,count(DISTINCT journal_id)::int journals,
      count(DISTINCT folio_transfer_root_line_id)::int roots,sum(amount_minor)::text amount
      FROM posting_line WHERE tenant_id=${fixture.tenant}::uuid AND folio_transfer_root_line_id IS NOT NULL`;
    expect(history).toEqual({ lines: 8, journals: 2, roots: 2, amount: "0" });
    const balances = await deploy`SELECT f.window_no,coalesce(b.balance_minor,0)::text amount FROM folio f
      LEFT JOIN folio_balance b ON b.tenant_id=f.tenant_id AND b.folio_id=f.id
      WHERE f.tenant_id=${fixture.tenant}::uuid AND f.reservation_id=${fixture.reservation}::uuid ORDER BY f.window_no`;
    expect(balances).toEqual([{window_no: 1, amount: "0"}, {window_no: 2, amount: "0"}, {window_no: 3, amount: "10000"}]);
    const before = await census(fixture);
    const input = request(fixture, [source(first.postingRootId), source(second.postingRootId)], "native-transfer-finalize", {
      folioId: finalWindow.folioId,
    });
    const result = await finalize(input);
    expect(result).toMatchObject({ transactionValueMinor: "10000", generation: 0, replayed: false });
    expect(await census(fixture)).toEqual({ ...before, valuations: 1, sources: 2, nights: 1, allocations: 2,
      facts: before.facts + 1, events: before.events + 1 });
    expect(before).toMatchObject({ journals: 4, lines: 12, guest: "10000", revenue: "-10000", documents: 0, externalInvoices: 0 });
    expect(await finalize(input)).toEqual({ ...result, replayed: true });
    expect(await database.withTenantTransaction(fixture.tenant, tx => transfers.transfer(tx, initialRoute.input)))
      .toEqual({ ...initialRoute.result, replayed: true });
  });

  test("concurrent exact requests commit one valuation and retain one receipt", async () => {
    const fixture = await createNativeSourceFixture(deploy, database, { label: "native-concurrent" });
    const charge = await fixture.postCharge("10000");
    const before = await census(fixture);
    const results = await Promise.all(Array.from({ length: 16 }, () =>
      finalize(request(fixture, [source(charge.postingRootId)], "native-concurrent-finalize"))));
    expect(results.filter(result => !result.replayed)).toHaveLength(1);
    expect(new Set(results.map(result => result.valuationId)).size).toBe(1);
    expect(new Set(results.map(result => result.evidenceHash)).size).toBe(1);
    expect(new Set(results.map(result => result.nativeConsiderationBasisHash)).size).toBe(1);
    expect(await census(fixture)).toEqual({ ...before, valuations: 1, sources: 1, nights: 1, allocations: 1, facts: before.facts + 1, events: before.events + 1 });
  }, 15_000);

  test("records all 366 canonical room nights without truncating allocations", async () => {
    const fixture = await createNativeSourceFixture(deploy, database, {
      label: "native-night-bound", roomNightAmounts: Array.from({ length: 366 }, () => "20"),
    });
    const charge = await fixture.postCharge("7320");
    const result = await finalize(request(fixture, [source(charge.postingRootId)], "native-night-bound-finalize"));
    expect(result.transactionValueMinor).toBe("7320");
    const [shape] = await deploy`SELECT count(*)::int nights,min(ordinal)::int first,max(ordinal)::int last,
      count(DISTINCT business_date)::int dates, sum(transaction_value_minor)::text total,
      bool_and(transaction_value_minor=20 AND quoted_weight_minor=20 AND basis_kind='native_consideration') exact
      FROM india_gst_accommodation_valuation_room_night
      WHERE tenant_id=${fixture.tenant}::uuid AND valuation_id=${result.valuationId}::uuid`;
    expect(shape).toEqual({ nights: 366, first: 0, last: 365, dates: 366, total: "7320", exact: true });
    expect(await census(fixture)).toMatchObject({ journals: 1, lines: 2, valuations: 1, sources: 1, nights: 366, allocations: 366, guest: "7320", revenue: "-7320", documents: 0, externalInvoices: 0 });
  }, 15_000);

  test("values 500 real roots over 501 accounts and rejects an over-bound complete source set", async () => {
    const fixture = await createNativeSourceFixture(deploy, database, { label: "native-root-bound", revenueAccountCount: 500 });
    expect(fixture.revenueAccounts).toHaveLength(500);
    const sources: NativeSource[] = [];
    for (let index = 0; index < 500; index += 1) {
      const charge = await fixture.postCharge("20", `native-root-bound-charge-${index}`, index);
      sources.push(source(charge.postingRootId));
    }
    const before = await census(fixture);
    const result = await finalize(request(fixture, sources, "native-root-bound-finalize"));
    expect(result.transactionValueMinor).toBe("10000");
    const [money] = await deploy`SELECT count(DISTINCT l.account_id)::int accounts,
      sum(l.amount_minor) FILTER (WHERE a.role='guest')::text guest,
      sum(l.amount_minor) FILTER (WHERE a.role='revenue')::text revenue
      FROM posting_line l JOIN account a ON a.tenant_id=l.tenant_id AND a.id=l.account_id
      WHERE l.tenant_id=${fixture.tenant}::uuid`;
    expect(money).toEqual({ accounts: 501, guest: "10000", revenue: "-10000" });
    expect(await census(fixture)).toEqual({ ...before, valuations: 1, sources: 500, nights: 1, allocations: 500, facts: before.facts + 1, events: before.events + 1 });
    await fixture.postCharge("20", "native-root-bound-extra", 0);
    const overBound = await census(fixture);
    // Even an input capped at 500 cannot conceal the actual 501st recorded root:
    // the SQL capability discovers and validates complete persisted membership.
    await expect(finalize(request(fixture, sources, "native-root-bound-successor", {
      expectedCurrentValuationId: result.valuationId,
      expectedCurrentEvidenceHash: result.evidenceHash,
    }))).rejects.toBeInstanceOf(IndiaGstAccommodationFinalValuationValidationError);
    expect(await census(fixture)).toEqual(overBound);
  }, 60_000);

  test("a changed charge set needs an exact successor while original evidence remains immutable", async () => {
    const fixture = await createNativeSourceFixture(deploy, database, { label: "native-successor" });
    const firstCharge = await fixture.postCharge("10000");
    const initialInput = request(fixture, [source(firstCharge.postingRootId)], "native-successor-initial");
    const first = await finalize(initialInput);
    const secondCharge = await fixture.postCharge("2000");
    const allSources = [source(firstCharge.postingRootId), source(secondCharge.postingRootId)];
    const before = await census(fixture);
    await expect(finalize(request(fixture, allSources, "native-successor-missing-head")))
      .rejects.toBeInstanceOf(IndiaGstAccommodationFinalValuationConflictError);
    expect(await census(fixture)).toEqual(before);
    const nextInput = request(fixture, allSources, "native-successor-exact-head", {
      expectedCurrentValuationId: first.valuationId,
      expectedCurrentEvidenceHash: first.evidenceHash,
    });
    const successor = await finalize(nextInput);
    expect(successor).toMatchObject({ generation: 1, transactionValueMinor: "12000", replayed: false });
    const [original] = await deploy`SELECT transaction_value_minor::text amount, evidence_hash
      FROM india_gst_accommodation_final_valuation
      WHERE tenant_id=${fixture.tenant}::uuid AND id=${first.valuationId}::uuid`;
    expect(original).toEqual({ amount: "10000", evidence_hash: first.evidenceHash });
    const completed = await census(fixture);
    await expect(finalize(request(fixture, allSources, "native-successor-stale-head", {
      expectedCurrentValuationId: first.valuationId,
      expectedCurrentEvidenceHash: first.evidenceHash,
    }))).rejects.toBeInstanceOf(IndiaGstAccommodationFinalValuationConflictError);
    expect(await finalize(initialInput)).toEqual({ ...first, replayed: true });
    expect(await finalize(nextInput)).toEqual({ ...successor, replayed: true });
    expect(await census(fixture)).toEqual(completed);
    expect(completed).toMatchObject({ journals: 2, lines: 4, guest: "12000", revenue: "-12000", valuations: 2, sources: 3, nights: 2, allocations: 3, documents: 0, externalInvoices: 0 });
  });
});
