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
import { IndiaGstAccommodationPaymentReceiptDateService } from "../src/contexts/tax-fiscal/india-gst-accommodation-payment-receipt-date";
import { IndiaGstAccommodationServiceProvisionDateService } from "../src/contexts/tax-fiscal/india-gst-accommodation-service-provision-date";
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
const SUCCESSOR_EXTENSION = "0b21daf2-ea6e-5568-9c21-69e4d4424574";
const D99_PUBLICATION_LOCK = "6441674055002974568";

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

function sqlState(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const candidate = error as { readonly errno?: unknown; readonly code?: unknown };
  if (typeof candidate.errno === "string") return candidate.errno;
  return typeof candidate.code === "string" ? candidate.code : undefined;
}

async function expectSqlState(operation: () => Promise<unknown>, expected: string): Promise<void> {
  try {
    await operation();
  } catch (error) {
    expect(sqlState(error)).toBe(expected);
    return;
  }
  throw new Error(`Expected PostgreSQL SQLSTATE ${expected}`);
}

interface Census {
  journals: number; lines: number; documents: number; externalInvoices: number;
  valuations: number; sources: number; nights: number; allocations: number;
  facts: number; events: number; guest: string; revenue: string;
}

type BuyerApprovalState = "approved_current" | "approved_expired" | "pending";

interface BuyerApprovalSeed {
  readonly approvalId: string;
  readonly input: IndiaGstAccommodationNativeFinalValuationInput;
  readonly requestHash: string;
  readonly approvalBasisHash: string;
}

async function seedExactBuyerOverride(
  deploy: SQL,
  fixture: NativeSourceFixture,
  buyerPartyId: string,
  deciderId: string,
  sources: readonly NativeSource[],
  state: BuyerApprovalState,
): Promise<BuyerApprovalSeed> {
  const approvalId = crypto.randomUUID();
  const input = request(fixture, sources, `native-buyer-${state}-${approvalId}`, {
    buyerPartyId,
    approvalRequestId: approvalId,
  });
  const requestSources = [...input.sources]
    .sort((left, right) => left.postingRootId.localeCompare(right.postingRootId))
    .map(item => Object.freeze({
      postingRootId: item.postingRootId,
      sourceKind: item.sourceKind,
      additionSubtype: item.additionSubtype,
      discountEligibility: item.discountEligibility,
      evidenceSource: item.evidenceSource,
      evidenceReference: item.evidenceReference,
    }));
  const [basis] = await deploy<Array<{
    window_no: number;
    relationship_hash: string;
    request_hash: string;
    approval_basis_hash: string;
  }>>`WITH live AS (
      SELECT reservation.primary_party,reservation.booker_party,account.party_id,
             reservation_group.account_party,folio.window_no,
             service.id service_id,service.evidence_hash service_hash,lineage.snapshot_hash
      FROM reservation
      JOIN folio ON folio.tenant_id=reservation.tenant_id
        AND folio.id=${fixture.folio}::uuid AND folio.reservation_id=reservation.id
      JOIN account ON account.tenant_id=folio.tenant_id AND account.id=folio.account_id
      LEFT JOIN reservation_group ON reservation_group.tenant_id=reservation.tenant_id
        AND reservation_group.id=reservation.group_id
      JOIN india_gst_accommodation_service_provision_snapshot service
        ON service.tenant_id=reservation.tenant_id
        AND service.id=${fixture.serviceResult.serviceProvision.serviceProvisionSnapshotId}::uuid
      JOIN tax_attribution_reservation_binding lineage
        ON lineage.tenant_id=reservation.tenant_id AND lineage.id=service.reservation_lineage_id
      WHERE reservation.tenant_id=${fixture.tenant}::uuid
        AND reservation.id=${fixture.reservation}::uuid
        AND reservation.property_node=${fixture.property}::uuid
    ), relationship AS (
      SELECT live.*,(SELECT encode(digest(coalesce(string_agg(candidate::text,',' ORDER BY candidate),''),'sha256'),'hex')
        FROM (SELECT DISTINCT candidate FROM unnest(ARRAY[
          live.primary_party,live.booker_party,live.party_id,live.account_party
        ]) candidate WHERE candidate IS NOT NULL) candidates) relationship_hash
      FROM live
    ), request_basis AS (
      SELECT relationship.*,public.india_native_source_hash(jsonb_build_object(
        'kind','india-native-valuation-request-v1','tenantId',${fixture.tenant}::uuid,
        'propertyNode',${fixture.property}::uuid,'reservationId',${fixture.reservation}::uuid,
        'folioId',${fixture.folio}::uuid,'buyerPartyId',${buyerPartyId}::uuid,
        'serviceProvisionSnapshotId',service_id,'actorId',${fixture.actor}::uuid,
        'expectedCurrentValuationId',NULL,'expectedCurrentEvidenceHash',NULL,
        'approvalRequestId',${approvalId}::uuid,'sources',${JSON.stringify(requestSources)}::jsonb,
        'ordinaryAttestation',${JSON.stringify(input.ordinaryAttestation)}::jsonb
      )) request_hash
      FROM relationship
    )
    SELECT window_no,relationship_hash,request_hash,
      public.india_native_source_hash(jsonb_build_array(
        'india-native-valuation-approval-basis-v1',${fixture.tenant}::uuid,
        ${fixture.property}::uuid,${fixture.reservation}::uuid,${fixture.folio}::uuid,
        ${buyerPartyId}::uuid,service_id,service_hash,snapshot_hash,request_hash,relationship_hash
      )) approval_basis_hash
    FROM request_basis`;
  if (!basis) throw new Error("Could not derive the exact native buyer approval basis");
  const payload = Object.freeze({
    propertyNode: fixture.property,
    reservationId: fixture.reservation,
    folioId: fixture.folio,
    windowNo: basis.window_no,
    buyerPartyId,
    relationshipSetHash: basis.relationship_hash,
    requestHash: basis.request_hash,
    basisKind: "native_consideration",
    serviceProvisionSnapshotId: fixture.serviceResult.serviceProvision.serviceProvisionSnapshotId,
    nativeApprovalBasisHash: basis.approval_basis_hash,
  });
  if (state === "approved_current") {
    await deploy`INSERT INTO approval_request(
        id,tenant_id,kind,subject_type,subject_id,requested_by,payload,status,
        decided_by,decided_at,created_at,valid_until)
      VALUES(${approvalId}::uuid,${fixture.tenant}::uuid,'india_gst_legal_buyer_override',
        'folio',${fixture.folio}::uuid,${fixture.actor}::uuid,${JSON.stringify(payload)}::jsonb,'approved',
        ${deciderId}::uuid,transaction_timestamp()-interval '5 minutes',
        transaction_timestamp()-interval '10 minutes',transaction_timestamp()+interval '1 hour')`;
  } else if (state === "approved_expired") {
    await deploy`INSERT INTO approval_request(
        id,tenant_id,kind,subject_type,subject_id,requested_by,payload,status,
        decided_by,decided_at,created_at,valid_until)
      VALUES(${approvalId}::uuid,${fixture.tenant}::uuid,'india_gst_legal_buyer_override',
        'folio',${fixture.folio}::uuid,${fixture.actor}::uuid,${JSON.stringify(payload)}::jsonb,'approved',
        ${deciderId}::uuid,transaction_timestamp()-interval '2 hours',
        transaction_timestamp()-interval '3 hours',transaction_timestamp()-interval '1 hour')`;
  } else {
    await deploy`INSERT INTO approval_request(
        id,tenant_id,kind,subject_type,subject_id,requested_by,payload,status,
        decided_by,decided_at,created_at,valid_until)
      VALUES(${approvalId}::uuid,${fixture.tenant}::uuid,'india_gst_legal_buyer_override',
        'folio',${fixture.folio}::uuid,${fixture.actor}::uuid,${JSON.stringify(payload)}::jsonb,'pending',
        NULL,NULL,transaction_timestamp()-interval '10 minutes',transaction_timestamp()+interval '1 hour')`;
  }
  return Object.freeze({
    approvalId,
    input,
    requestHash: basis.request_hash,
    approvalBasisHash: basis.approval_basis_hash,
  });
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

  test("keeps source recording hashes distinct from freshly resolved date projections", async () => {
    const fixture = await createNativeSourceFixture(deploy, database, { label: "native-source-hashes" });
    const [persisted] = await deploy<Array<{
      service_hash: string;
      payment_hash: string;
      ordinary_hash: string;
    }>>`SELECT
      (SELECT evidence_hash FROM india_gst_accommodation_service_provision_snapshot
        WHERE tenant_id=${fixture.tenant}::uuid
          AND id=${fixture.serviceResult.serviceProvision.serviceProvisionSnapshotId}::uuid) service_hash,
      (SELECT evidence_hash FROM india_gst_accommodation_payment_receipt_snapshot
        WHERE tenant_id=${fixture.tenant}::uuid
          AND id=${fixture.paymentResult.paymentReceipt.paymentReceiptSnapshotId}::uuid) payment_hash,
      (SELECT evidence_hash FROM india_gst_accommodation_ordinary_regime_evidence
        WHERE tenant_id=${fixture.tenant}::uuid
          AND id=${fixture.ordinaryResult.ordinaryRegimeEvidenceId}::uuid) ordinary_hash`;
    if (!persisted) throw new Error("Recorded native source evidence disappeared");
    expect(persisted).toEqual({
      service_hash: fixture.serviceResult.evidenceHash,
      payment_hash: fixture.paymentResult.evidenceHash,
      ordinary_hash: fixture.ordinaryResult.evidenceHash,
    });

    const fresh = await database.withTenantTransaction(fixture.tenant, async tx => {
      const service = await new IndiaGstAccommodationServiceProvisionDateService().resolve(
        tx,
        Object.freeze({
          tenantId: fixture.tenant,
          propertyNode: fixture.property,
          reservationId: fixture.reservation,
          serviceProvisionSnapshotId: fixture.serviceResult.serviceProvision.serviceProvisionSnapshotId,
          serviceProvisionDate: fixture.serviceResult.serviceProvision.serviceProvisionDate,
        }),
      );
      const payment = await new IndiaGstAccommodationPaymentReceiptDateService().resolve(
        tx,
        Object.freeze({
          tenantId: fixture.tenant,
          propertyNode: fixture.property,
          reservationId: fixture.reservation,
          serviceProvisionSnapshotId: fixture.serviceResult.serviceProvision.serviceProvisionSnapshotId,
          paymentReceiptSnapshotId: fixture.paymentResult.paymentReceipt.paymentReceiptSnapshotId,
          paymentReceiptDate: fixture.paymentResult.paymentReceipt.paymentReceiptDate,
        }),
      );
      return Object.freeze({ service, payment });
    });
    expect(fresh.service).toEqual(fixture.serviceResult.serviceProvision);
    expect(fresh.payment).toEqual(fixture.paymentResult.paymentReceipt);
    expect(fresh.service.evidenceHash).not.toBe(fixture.serviceResult.evidenceHash);
    expect(fresh.payment.evidenceHash).not.toBe(fixture.paymentResult.evidenceHash);
    expect(fixture.ordinaryResult.evidenceHash).toBe(persisted.ordinary_hash);
  });

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

  test("retains an exact active different-decider buyer override and rejects unavailable approval evidence atomically", async () => {
    const fixture = await createNativeSourceFixture(deploy, database, { label: "native-buyer" });
    const charge = await fixture.postCharge("10000");
    const sources = Object.freeze([source(charge.postingRootId)]);
    const buyerPartyId = crypto.randomUUID();
    const deciderId = crypto.randomUUID();
    await deploy.begin(async tx => {
      await tx`INSERT INTO party(id,tenant_id,kind,display_name,status)
        VALUES(${buyerPartyId}::uuid,${fixture.tenant}::uuid,'org','Order434 legal buyer','active')`;
      await tx`INSERT INTO party_role(tenant_id,party_id,role)
        VALUES(${fixture.tenant}::uuid,${buyerPartyId}::uuid,'company')`;
      await tx`INSERT INTO app_user(id,tenant_id,email,display_name,status)
        VALUES(${deciderId}::uuid,${fixture.tenant}::uuid,
          ${`buyer-decider-${deciderId}@order434.local`},'Order434 buyer decider','active')`;
    });

    // Kernel ApprovalService cannot supply 0062's required valid_until field, so
    // these are owner-seeded prerequisite approvals. The published SQL
    // canonicalizer derives every request/payload hash from the live fixture.
    const expired = await seedExactBuyerOverride(
      deploy, fixture, buyerPartyId, deciderId, sources, "approved_expired",
    );
    const pending = await seedExactBuyerOverride(
      deploy, fixture, buyerPartyId, deciderId, sources, "pending",
    );
    const approved = await seedExactBuyerOverride(
      deploy, fixture, buyerPartyId, deciderId, sources, "approved_current",
    );
    const before = await census(fixture);
    for (const unavailable of [expired.input, pending.input]) {
      await expect(finalize(unavailable))
        .rejects.toBeInstanceOf(IndiaGstAccommodationFinalValuationConflictError);
      expect(await census(fixture)).toEqual(before);
    }

    await deploy`UPDATE app_user SET status='inactive'
      WHERE tenant_id=${fixture.tenant}::uuid AND id=${deciderId}::uuid`;
    await expect(finalize(approved.input))
      .rejects.toBeInstanceOf(IndiaGstAccommodationFinalValuationConflictError);
    expect(await census(fixture)).toEqual(before);
    await deploy`UPDATE app_user SET status='active'
      WHERE tenant_id=${fixture.tenant}::uuid AND id=${deciderId}::uuid`;

    const [approvalBefore] = await deploy<Array<{
      row_json: string;
      decided_at: string;
      valid_until: string;
    }>>`
      SELECT to_jsonb(approval_request)::text row_json,decided_at::text,valid_until::text
      FROM approval_request
      WHERE tenant_id=${fixture.tenant}::uuid AND id=${approved.approvalId}::uuid`;
    if (!approvalBefore) throw new Error("Current native buyer approval disappeared");
    const result = await finalize(approved.input);
    expect(result).toMatchObject({
      generation: 0,
      disposition: "ordinary_final",
      transactionValueMinor: "10000",
      replayed: false,
    });
    const [retained] = await deploy<Array<{
      approval_request_id: string;
      native_approval_basis_hash: string;
      native_approval_actor_id: string;
      native_approval_decided_at: string;
      native_approval_valid_until: string;
      native_approval_evidence_hash: string;
      request_hash: string;
      approval_decided_at: string;
      approval_valid_until: string;
      approval_row_json: string;
    }>>`SELECT valuation.approval_request_id::text,
        valuation.native_approval_basis_hash,valuation.native_approval_actor_id::text,
        valuation.native_approval_decided_at::text,valuation.native_approval_valid_until::text,
        valuation.native_approval_evidence_hash,valuation.request_hash,
        approval.decided_at::text approval_decided_at,
        approval.valid_until::text approval_valid_until,
        to_jsonb(approval)::text approval_row_json
      FROM india_gst_accommodation_final_valuation valuation
      JOIN approval_request approval ON approval.tenant_id=valuation.tenant_id
        AND approval.id=valuation.approval_request_id
      WHERE valuation.tenant_id=${fixture.tenant}::uuid AND valuation.id=${result.valuationId}::uuid`;
    expect(retained).toMatchObject({
      approval_request_id: approved.approvalId,
      native_approval_basis_hash: approved.approvalBasisHash,
      native_approval_actor_id: deciderId,
      request_hash: approved.requestHash,
      native_approval_decided_at: approvalBefore.decided_at,
      native_approval_valid_until: approvalBefore.valid_until,
      approval_decided_at: approvalBefore.decided_at,
      approval_valid_until: approvalBefore.valid_until,
      approval_row_json: approvalBefore.row_json,
    });
    expect(retained?.native_approval_evidence_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(await census(fixture)).toEqual({
      ...before,
      valuations: 1,
      sources: 1,
      nights: 1,
      allocations: 1,
      facts: before.facts + 1,
      events: before.events + 1,
    });
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

  test("pins canonical writer settings and replays one request identically across caller time zones", async () => {
    const configurations = await deploy<Array<{ proname: string; proconfig: string[] }>>`
      SELECT procedure.proname,procedure.proconfig
      FROM pg_catalog.pg_proc procedure
      JOIN pg_catalog.pg_namespace namespace ON namespace.oid=procedure.pronamespace
      WHERE namespace.nspname='public' AND procedure.proname IN (
        'record_india_gst_accommodation_service_provision',
        'record_india_gst_accommodation_payment_receipt',
        'record_india_gst_accommodation_ordinary_regime_evidence',
        'lock_india_native_valuation_sources',
        'record_india_gst_native_accommodation_valuation'
      )
      ORDER BY procedure.proname`;
    expect(configurations).toHaveLength(5);
    for (const configuration of configurations) {
      expect(configuration.proconfig).toContain("TimeZone=UTC");
      expect(configuration.proconfig).toContain("DateStyle=ISO,YMD");
    }

    const fixture = await createNativeSourceFixture(deploy, database, { label: "native-timezone" });
    const charge = await fixture.postCharge("10000");
    const input = request(fixture, [source(charge.postingRootId)], "native-timezone-finalize");
    async function invoke(callerTimeZone: "UTC" | "Asia/Calcutta") {
      return database.withTenantTransaction(fixture.tenant, async tx => {
        await tx.unsafe(callerTimeZone === "UTC"
          ? "SET LOCAL TIME ZONE 'UTC'"
          : "SET LOCAL TIME ZONE 'Asia/Calcutta'");
        const [before] = await tx<Array<{ timezone: string }>>`
          SELECT current_setting('TimeZone') timezone`;
        const result = await valuation.finalizeNative(tx, input);
        const [after] = await tx<Array<{ timezone: string }>>`
          SELECT current_setting('TimeZone') timezone`;
        return Object.freeze({ result, before: before?.timezone, after: after?.timezone });
      });
    }

    const calcutta = await invoke("Asia/Calcutta");
    expect(calcutta.before).toBe("Asia/Calcutta");
    expect(calcutta.after).toBe("Asia/Calcutta");
    expect(calcutta.result.replayed).toBeFalse();
    const recorded = await census(fixture);
    const utc = await invoke("UTC");
    expect(utc.before).toBe("UTC");
    expect(utc.after).toBe("UTC");
    expect(utc.result).toEqual({ ...calcutta.result, replayed: true });
    expect(await census(fixture)).toEqual(recorded);
    const rows = await deploy<Array<{
      valuation_id: string;
      evidence_hash: string;
      native_consideration_basis_hash: string;
    }>>`SELECT id::text valuation_id,evidence_hash,native_consideration_basis_hash
      FROM india_gst_accommodation_final_valuation
      WHERE tenant_id=${fixture.tenant}::uuid
        AND native_request_key_hash=encode(digest(${input.idempotencyKey},'sha256'),'hex')`;
    expect(rows).toEqual([{
      valuation_id: calcutta.result.valuationId,
      evidence_hash: calcutta.result.evidenceHash,
      native_consideration_basis_hash: calcutta.result.nativeConsiderationBasisHash,
    }]);
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

  test("private source prefix locks the exact one-minor closure without publishing and rejects a later charge", async () => {
    const fixture = await createNativeSourceFixture(deploy, database, {
      label: "native-private-prefix",
      roomNightAmounts: ["20"],
    });
    const charge = await fixture.postCharge("1", "native-private-prefix-charge");
    const finalized = await finalize(request(
      fixture,
      [source(charge.postingRootId)],
      "native-private-prefix-valuation",
    ));
    expect(finalized.transactionValueMinor).toBe("1");

    const [recordedSource] = await deploy<Array<{
      postingRootId: string;
      journalId: string;
      currentAmountMinor: string;
      txCode: string;
      currentFragmentSetHash: string;
    }>>`SELECT source.posting_root_id::text AS "postingRootId",
              root.journal_id::text AS "journalId",
              source.current_amount_minor::text AS "currentAmountMinor",
              source.tx_code AS "txCode",
              source.current_fragment_set_hash AS "currentFragmentSetHash"
         FROM india_gst_accommodation_valuation_source source
         JOIN posting_line root
           ON root.tenant_id=source.tenant_id AND root.id=source.posting_root_id
        WHERE source.tenant_id=${fixture.tenant}::uuid
          AND source.valuation_id=${finalized.valuationId}::uuid`;
    if (!recordedSource) throw new Error("Missing persisted native valuation source");

    const beforePrefix = await census(fixture);
    const newTaxId = crypto.randomUUID();
    const keyHash = new Bun.CryptoHasher("sha256")
      .update("native-private-prefix-idempotency")
      .digest("hex");
    const positive = await deploy.begin(async tx => {
      await tx`SELECT set_config('app.tenant_id',${fixture.tenant},true)`;
      await tx`SET LOCAL ROLE yellow_owner`;
      const [row] = await tx<Array<{ prefix: {
        sourceClosure: {
          accountId: string;
          accountIds: string[];
          rootIds: string[];
          sources: Array<{
            postingRootId: string;
            journalId: string;
            currentAmountMinor: string;
            txCode: string;
            currentFragmentSetHash: string;
          }>;
        };
        taxPreview: {
          transactionValueMinor: string;
          taxMinor: string;
          grandTotalMinor: string;
          componentFamily: string;
          componentAmountsMinor: string[];
        };
        routes: Array<{
          component_ordinal: number;
          component_identity: string;
          amount_minor: number;
          mapping_id: string | null;
          tx_code: string | null;
          credit_account_id: string | null;
          route_evidence_hash: string | null;
        }>;
        lockedAccountIds: string[];
        folioId: string;
        newTaxId: string;
      } }>>`SELECT public.lock_india_native_invoice_source_prefix(
          ${fixture.tenant}::uuid,${fixture.property}::uuid,${fixture.reservation}::uuid,
          ${fixture.folio}::uuid,${finalized.valuationId}::uuid,
          ${SUCCESSOR_EXTENSION}::uuid,'cgst_sgst',${newTaxId}::uuid,${keyHash}
        ) AS prefix`;
      if (!row) throw new Error("Private native source prefix returned no row");
      const [publication] = await tx<Array<{ count: number }>>`SELECT count(*)::int AS count
        FROM pg_catalog.pg_locks lock
        WHERE lock.pid=pg_catalog.pg_backend_pid()
          AND lock.locktype='advisory' AND lock.granted AND lock.objsubid=1
          AND lock.classid=((${D99_PUBLICATION_LOCK}::bigint>>32)&4294967295)::oid
          AND lock.objid=(${D99_PUBLICATION_LOCK}::bigint&4294967295)::oid`;
      return Object.freeze({ prefix: row.prefix, publicationLocks: publication?.count });
    });

    const expectedAccountIds = [fixture.guestAccount, fixture.revenueAccount].sort();
    expect(positive.prefix.sourceClosure).toEqual({
      accountId: fixture.guestAccount,
      accountIds: expectedAccountIds,
      rootIds: [charge.postingRootId],
      sources: [recordedSource],
    });
    expect(positive.prefix).toMatchObject({
      lockedAccountIds: expectedAccountIds,
      folioId: fixture.folio,
      newTaxId,
      taxPreview: {
        transactionValueMinor: "1",
        taxMinor: "0",
        grandTotalMinor: "1",
        componentFamily: "cgst_sgst",
        componentAmountsMinor: ["0", "0"],
      },
      routes: [
        {
          component_ordinal: 0,
          component_identity: "cgst",
          amount_minor: 0,
          mapping_id: null,
          tx_code: null,
          credit_account_id: null,
          route_evidence_hash: null,
        },
        {
          component_ordinal: 1,
          component_identity: "sgst",
          amount_minor: 0,
          mapping_id: null,
          tx_code: null,
          credit_account_id: null,
          route_evidence_hash: null,
        },
      ],
    });
    expect(positive.publicationLocks).toBe(0);
    expect(await census(fixture)).toEqual(beforePrefix);

    await fixture.postCharge("1", "native-private-prefix-later-charge");
    const afterLaterCharge = await census(fixture);
    const staleClosure = () => deploy.begin(async tx => {
      await tx`SELECT set_config('app.tenant_id',${fixture.tenant},true)`;
      await tx`SET LOCAL ROLE yellow_owner`;
      return tx`SELECT public.read_india_native_valuation_source_closure(
        ${fixture.tenant}::uuid,${fixture.property}::uuid,${fixture.reservation}::uuid,
        ${fixture.folio}::uuid,${finalized.valuationId}::uuid)`;
    });
    const stalePrefix = () => deploy.begin(async tx => {
      await tx`SELECT set_config('app.tenant_id',${fixture.tenant},true)`;
      await tx`SET LOCAL ROLE yellow_owner`;
      return tx`SELECT public.lock_india_native_invoice_source_prefix(
        ${fixture.tenant}::uuid,${fixture.property}::uuid,${fixture.reservation}::uuid,
        ${fixture.folio}::uuid,${finalized.valuationId}::uuid,
        ${SUCCESSOR_EXTENSION}::uuid,'cgst_sgst',${crypto.randomUUID()}::uuid,${keyHash})`;
    });
    await expectSqlState(staleClosure, "55000");
    await expectSqlState(stalePrefix, "55000");
    expect(await census(fixture)).toEqual(afterLaterCharge);
  });
});
