import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { SQL } from "bun";

import {
  IndiaGstAccommodationOrdinaryRegimeEvidenceConflictError,
  IndiaGstAccommodationOrdinaryRegimeEvidenceNotFoundError,
  IndiaGstAccommodationOrdinaryRegimeEvidenceService,
  IndiaGstAccommodationOrdinaryRegimeEvidenceValidationError,
  type IndiaGstAccommodationOrdinaryRegimeEvidenceInput,
} from "../src/contexts/tax-fiscal/india-gst-accommodation-ordinary-regime-evidence";
import { createAuditEnvelope, Database } from "../src/kernel";
import {
  createNativeSourceFixture,
  type NativeSourceFixture,
} from "./fixtures/india-native-fiscal-source-completion-fixture";

setDefaultTimeout(90_000);

const deployUrl = process.env.YELLOW_ORDER434_DEPLOY_DATABASE_URL;
const runtimeUrl = process.env.YELLOW_ORDER434_RUNTIME_DATABASE_URL
  ?? process.env.YELLOW_ORDER434_DATABASE_URL;
if (process.env.YELLOW_REQUIRE_ORDER434_DATABASE === "1" && (!deployUrl || !runtimeUrl)) {
  throw new Error("Order434 PostgreSQL proof requires deploy and yellow_runtime database URLs");
}
const databaseDescribe = deployUrl && runtimeUrl ? describe.serial : describe.skip;

const SERVICE_EVENT = "india_gst.accommodation_service_provision_recorded";
const PAYMENT_EVENT = "india_gst.accommodation_payment_receipt_recorded";
const ORDINARY_EVENT = "india_gst.accommodation_ordinary_regime_recorded";
const SERVICE_SHA_A = new Bun.CryptoHasher("sha256")
  .update("order434:test-only-service-source:a")
  .digest("hex");
const PAYMENT_SHA_A = new Bun.CryptoHasher("sha256")
  .update("order434:test-only-payment-source:a")
  .digest("hex");
const ORDINARY_SHA_A = new Bun.CryptoHasher("sha256")
  .update("order434:test-only-ordinary-assertion:a")
  .digest("hex");

interface Census {
  readonly services: number;
  readonly payments: number;
  readonly ordinary: number;
  readonly facts: number;
  readonly events: number;
  readonly journals: number;
  readonly lines: number;
  readonly documents: number;
}

function frozen<T extends object>(value: T): Readonly<T> {
  return Object.freeze(value);
}

databaseDescribe("Order434 governed source intake on real PostgreSQL", () => {
  const deploy = new SQL(deployUrl!, { max: 2, prepare: false });
  const database = Database.connect(runtimeUrl!, { maxConnections: 4, prepare: false });
  const ordinaryEvidence = new IndiaGstAccommodationOrdinaryRegimeEvidenceService();
  let tenantA: NativeSourceFixture;
  let tenantB: NativeSourceFixture;

  function ordinaryRequest(
    journey: NativeSourceFixture,
    key: string,
    options: Readonly<{
      actorId?: string;
      requestId?: string;
      evidenceSha256?: string;
    }> = {},
  ): IndiaGstAccommodationOrdinaryRegimeEvidenceInput {
    return frozen({
      tenantId: journey.tenant,
      propertyNode: journey.property,
      reservationId: journey.reservation,
      serviceProvisionSnapshotId: journey.serviceResult.serviceProvision.serviceProvisionSnapshotId,
      regime: "ordinary_rule47_30_day" as const,
      ordinaryRegimeSource: "governed_rule47_ordinary_regime_record" as const,
      legalBasis: "CGST_RULE_47_ORDINARY_SERVICE_INVOICE_30_DAY_INPUT" as const,
      ordinaryRegimeEvidenceSha256: options.evidenceSha256 ?? ORDINARY_SHA_A,
      idempotencyKey: key,
      envelope: createAuditEnvelope({
        actorId: options.actorId ?? journey.actor,
        tenantId: journey.tenant,
        propertyNode: journey.property,
        requestId: options.requestId ?? crypto.randomUUID(),
        operation: ORDINARY_EVENT,
      }),
    });
  }

  async function census(tenant: string): Promise<Census> {
    const [row] = await deploy<Census[]>`SELECT
      (SELECT count(*)::int FROM india_gst_accommodation_service_provision_snapshot WHERE tenant_id=${tenant}::uuid) services,
      (SELECT count(*)::int FROM india_gst_accommodation_payment_receipt_snapshot WHERE tenant_id=${tenant}::uuid) payments,
      (SELECT count(*)::int FROM india_gst_accommodation_ordinary_regime_evidence WHERE tenant_id=${tenant}::uuid) ordinary,
      (SELECT count(*)::int FROM fact_log WHERE tenant_id=${tenant}::uuid) facts,
      (SELECT count(*)::int FROM outbox WHERE tenant_id=${tenant}::uuid) events,
      (SELECT count(*)::int FROM journal WHERE tenant_id=${tenant}::uuid) journals,
      (SELECT count(*)::int FROM posting_line WHERE tenant_id=${tenant}::uuid) lines,
      (SELECT count(*)::int FROM document WHERE tenant_id=${tenant}::uuid) documents`;
    if (!row) throw new Error("Order434 census returned no row");
    return row;
  }

  async function recordOrdinary(
    journey: NativeSourceFixture,
    key: string,
    options: Parameters<typeof ordinaryRequest>[2] = {},
  ) {
    return database.withTenantTransaction(journey.tenant, (tx) =>
      ordinaryEvidence.record(tx, ordinaryRequest(journey, key, options)));
  }

  beforeAll(async () => {
    tenantA = await createNativeSourceFixture(deploy, database, { label: "a" });
    tenantB = await createNativeSourceFixture(deploy, database, { label: "b" });
  });

  afterAll(async () => {
    await database.close();
    await deploy.close({ timeout: 0 });
  });

  test("all three recorders persist exact sources without changing financial state", async () => {
    const serviceA = tenantA.serviceResult;
    const paymentA = tenantA.paymentResult;
    const ordinaryA = tenantA.ordinaryResult;
    expect(serviceA).toMatchObject({ created: true, replayed: false });
    expect(paymentA).toMatchObject({ created: true, replayed: false });
    expect(ordinaryA).toMatchObject({
      created: true,
      replayed: false,
      regime: "ordinary_rule47_30_day",
      ordinaryRegimeSource: "governed_rule47_ordinary_regime_record",
      legalBasis: "CGST_RULE_47_ORDINARY_SERVICE_INVOICE_30_DAY_INPUT",
      ordinaryRegimeEvidenceSha256: ORDINARY_SHA_A,
    });
    expect(serviceA.serviceProvision.serviceProvisionEvidenceSha256).toBe(SERVICE_SHA_A);
    expect(paymentA.paymentReceipt.paymentReceiptEvidenceSha256).toBe(PAYMENT_SHA_A);
    expect(paymentA.paymentReceipt.amountMinor).toBe("10500");
    expect(paymentA.paymentReceipt.paymentReceiptDate).toBe(paymentA.paymentReceipt.supplierBankCreditDate);
    for (const rootHash of [serviceA.evidenceHash, paymentA.evidenceHash, ordinaryA.evidenceHash]) {
      expect(rootHash).toMatch(/^[0-9a-f]{64}$/);
    }

    const metadata = await deploy<Array<{
      kind: string;
      recording_actor_id: string;
      recording_request_id: string;
      request_key_hash: string;
      request_hash: string;
      evidence_hash: string;
      recorded: boolean;
    }>>`
      SELECT 'service' kind,recording_actor_id::text,recording_request_id::text,
             request_key_hash,request_hash,evidence_hash,recorded_at IS NOT NULL recorded
        FROM india_gst_accommodation_service_provision_snapshot
       WHERE tenant_id=${tenantA.tenant}::uuid
         AND id=${serviceA.serviceProvision.serviceProvisionSnapshotId}::uuid
      UNION ALL
      SELECT 'payment',recording_actor_id::text,recording_request_id::text,
             request_key_hash,request_hash,evidence_hash,recorded_at IS NOT NULL
        FROM india_gst_accommodation_payment_receipt_snapshot
       WHERE tenant_id=${tenantA.tenant}::uuid
         AND id=${paymentA.paymentReceipt.paymentReceiptSnapshotId}::uuid
      UNION ALL
      SELECT 'ordinary',recording_actor_id::text,recording_request_id::text,
             request_key_hash,request_hash,evidence_hash,recorded_at IS NOT NULL
        FROM india_gst_accommodation_ordinary_regime_evidence
       WHERE tenant_id=${tenantA.tenant}::uuid
         AND id=${ordinaryA.ordinaryRegimeEvidenceId}::uuid
      ORDER BY kind`;
    const keyHash = (key: string) => new Bun.CryptoHasher("sha256").update(key).digest("hex");
    expect(metadata).toEqual([
      {
        kind: "ordinary", recording_actor_id: tenantA.actor,
        recording_request_id: expect.stringMatching(/^[0-9a-f-]{36}$/),
        request_key_hash: keyHash("o434-ordinary-a"),
        request_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
        evidence_hash: ordinaryA.evidenceHash, recorded: true,
      },
      {
        kind: "payment", recording_actor_id: tenantA.actor,
        recording_request_id: expect.stringMatching(/^[0-9a-f-]{36}$/),
        request_key_hash: keyHash("o434-payment-a"),
        request_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
        evidence_hash: paymentA.evidenceHash, recorded: true,
      },
      {
        kind: "service", recording_actor_id: tenantA.actor,
        recording_request_id: expect.stringMatching(/^[0-9a-f-]{36}$/),
        request_key_hash: keyHash("o434-service-a"),
        request_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
        evidence_hash: serviceA.evidenceHash, recorded: true,
      },
    ]);

    expect(await census(tenantA.tenant)).toEqual({
      services: 1,
      payments: 1,
      ordinary: 1,
      facts: 3,
      events: 3,
      journals: 0,
      lines: 0,
      documents: 0,
    });
    const events = await deploy<Array<{ event_type: string; count: number }>>`
      SELECT event_type,count(*)::int count FROM outbox
       WHERE tenant_id=${tenantA.tenant}::uuid
         AND event_type IN (${SERVICE_EVENT},${PAYMENT_EVENT},${ORDINARY_EVENT})
       GROUP BY event_type ORDER BY event_type`;
    expect(events).toEqual([
      { event_type: ORDINARY_EVENT, count: 1 },
      { event_type: PAYMENT_EVENT, count: 1 },
      { event_type: SERVICE_EVENT, count: 1 },
    ]);
    const facts = await deploy<Array<{ entity_type: string; fact_type: string; count: number }>>`
      SELECT entity_type,fact_type,count(*)::int count FROM fact_log
       WHERE tenant_id=${tenantA.tenant}::uuid
         AND entity_type IN (
           'india_gst_accommodation_service_provision_snapshot',
           'india_gst_accommodation_payment_receipt_snapshot',
           'india_gst_accommodation_ordinary_regime_evidence')
       GROUP BY entity_type,fact_type ORDER BY entity_type`;
    expect(facts).toEqual([
      { entity_type: "india_gst_accommodation_ordinary_regime_evidence", fact_type: "recorded", count: 1 },
      { entity_type: "india_gst_accommodation_payment_receipt_snapshot", fact_type: "recorded", count: 1 },
      { entity_type: "india_gst_accommodation_service_provision_snapshot", fact_type: "recorded", count: 1 },
    ]);
  });

  test("same-key replay reauthorizes the original actor and changed evidence conflicts atomically", async () => {
    const before = await census(tenantA.tenant);
    const replay = await recordOrdinary(tenantA, "o434-ordinary-a");
    expect(replay).toEqual({ ...tenantA.ordinaryResult, created: false, replayed: true });
    expect(await census(tenantA.tenant)).toEqual(before);

    await deploy`UPDATE app_user SET status='inactive'
      WHERE tenant_id=${tenantA.tenant}::uuid AND id=${tenantA.actor}::uuid`;
    try {
      await expect(recordOrdinary(tenantA, "o434-ordinary-a"))
        .rejects.toBeInstanceOf(IndiaGstAccommodationOrdinaryRegimeEvidenceNotFoundError);
    } finally {
      await deploy`UPDATE app_user SET status='active'
        WHERE tenant_id=${tenantA.tenant}::uuid AND id=${tenantA.actor}::uuid`;
    }
    await expect(recordOrdinary(tenantA, "o434-ordinary-a", { evidenceSha256: "d".repeat(64) }))
      .rejects.toBeInstanceOf(IndiaGstAccommodationOrdinaryRegimeEvidenceConflictError);
    expect(await census(tenantA.tenant)).toEqual(before);
  });

  test("a second tenant has independent ordinary authority and remains RLS-isolated", async () => {
    expect(tenantB.ordinaryResult.created).toBe(true);
    await expect(recordOrdinary(
      tenantB,
      "order434-ordinary-b-denied",
      { actorId: tenantA.actor },
    )).rejects.toBeInstanceOf(IndiaGstAccommodationOrdinaryRegimeEvidenceNotFoundError);
    await expect(recordOrdinary(
      tenantB,
      "order434-ordinary-b-no-grant",
      { actorId: tenantB.unauthorizedActor },
    )).rejects.toBeInstanceOf(IndiaGstAccommodationOrdinaryRegimeEvidenceNotFoundError);
    const concealed = await database.withTenantTransaction(tenantA.tenant, (tx) =>
      tx<Array<{ count: number }>>`SELECT count(*)::int count
        FROM india_gst_accommodation_ordinary_regime_evidence
        WHERE tenant_id=${tenantB.tenant}::uuid`);
    expect(concealed).toEqual([{ count: 0 }]);
    expect(await census(tenantB.tenant)).toMatchObject({
      services: 1, payments: 1, ordinary: 1, facts: 3, events: 3,
    });
  });

  test("missing or inferred ordinary assertions fail before persistence", async () => {
    const before = await census(tenantA.tenant);
    const base = ordinaryRequest(tenantA, "order434-missing-ordinary");
    for (const mutation of [
      (input: Record<string, unknown>) => { delete input.regime; },
      (input: Record<string, unknown>) => { input.regime = "continuous_supply"; },
      (input: Record<string, unknown>) => { input.ordinaryRegimeSource = "inferred_from_silence"; },
      (input: Record<string, unknown>) => { input.ordinaryRegimeEvidenceSha256 = ""; },
    ]) {
      const candidate = { ...base } as Record<string, unknown>;
      mutation(candidate);
      Object.freeze(candidate);
      await expect(database.withTenantTransaction(tenantA.tenant, (tx) =>
        ordinaryEvidence.record(tx, candidate as unknown as IndiaGstAccommodationOrdinaryRegimeEvidenceInput)))
        .rejects.toBeInstanceOf(IndiaGstAccommodationOrdinaryRegimeEvidenceValidationError);
    }
    expect(await census(tenantA.tenant)).toEqual(before);
  });
});
