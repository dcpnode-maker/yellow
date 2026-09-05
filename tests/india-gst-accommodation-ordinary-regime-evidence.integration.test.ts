import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { SQL } from "bun";

import { createPositiveTaxAttributionSnapshot } from "../src/contexts/tax-fiscal/attribution";
import {
  IndiaGstAccommodationOrdinaryRegimeEvidenceConflictError,
  IndiaGstAccommodationOrdinaryRegimeEvidenceNotFoundError,
  IndiaGstAccommodationOrdinaryRegimeEvidenceService,
  IndiaGstAccommodationOrdinaryRegimeEvidenceValidationError,
  type IndiaGstAccommodationOrdinaryRegimeEvidenceInput,
} from "../src/contexts/tax-fiscal/india-gst-accommodation-ordinary-regime-evidence";
import {
  IndiaGstAccommodationSourceIntakeService,
  type IndiaGstAccommodationPaymentReceiptIntakeResult,
  type IndiaGstAccommodationServiceProvisionIntakeResult,
} from "../src/contexts/tax-fiscal/india-gst-accommodation-source-intake";
import { createAuditEnvelope, Database } from "../src/kernel";

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
const SERVICE_DATE = "2035-01-02";
const BOOKS_DATE = "2035-01-03";
const BANK_DATE = "2035-01-02";
const AMOUNT_MINOR = "10500";
const SERVICE_SHA = "a".repeat(64);
const PAYMENT_SHA = "b".repeat(64);
const ORDINARY_SHA = "c".repeat(64);

interface Journey {
  readonly tenant: string;
  readonly property: string;
  readonly actor: string;
  readonly unauthorizedActor: string;
  readonly reservation: string;
  readonly lineage: string;
}

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
  const sourceIntake = new IndiaGstAccommodationSourceIntakeService();
  const ordinaryEvidence = new IndiaGstAccommodationOrdinaryRegimeEvidenceService();
  let serial = 0;
  let tenantA: Journey;
  let tenantB: Journey;
  let serviceA: IndiaGstAccommodationServiceProvisionIntakeResult;
  let paymentA: IndiaGstAccommodationPaymentReceiptIntakeResult;
  let ordinaryA: Awaited<ReturnType<IndiaGstAccommodationOrdinaryRegimeEvidenceService["record"]>>;
  let baselineA: Census;

  async function seedJourney(label: string): Promise<Journey> {
    const marker = `${label}${++serial}${crypto.randomUUID().replaceAll("-", "").slice(0, 10)}`;
    const tenant = crypto.randomUUID();
    const property = crypto.randomUUID();
    const actor = crypto.randomUUID();
    const unauthorizedActor = crypto.randomUUID();
    const role = crypto.randomUUID();
    const party = crypto.randomUUID();
    const unitType = crypto.randomUUID();
    const sellable = crypto.randomUUID();
    const ratePlan = crypto.randomUUID();
    const reservation = crypto.randomUUID();
    const segment = crypto.randomUUID();
    const hold = crypto.randomUUID();
    const holdBinding = crypto.randomUUID();
    const attribution = crypto.randomUUID();
    const lineage = crypto.randomUUID();
    const extension = crypto.randomUUID();
    const quoteHash = new Bun.CryptoHasher("sha256").update(`quote:${marker}`).digest("hex");
    const snapshot = createPositiveTaxAttributionSnapshot({
      origin: { kind: "rate_quote", quoteHash },
      currency: "INR",
      line: {
        lineId: "room",
        revenueGroup: "room_revenue",
        amountMinor: 10_000n,
        nights: 1,
        personNights: 2,
        roomNights: [{ businessDate: "2035-01-01", amountMinor: 10_000n }],
      },
      assignments: [{
        businessDate: "2035-01-01",
        jurisdictionKey: `in.order434.${marker}`,
        evidenceRef: `tax-assignment:${quoteHash}`,
      }],
      jurisdiction: {
        extensionId: extension,
        ownerTenantId: tenant,
        key: `in.order434.${marker}`,
        version: 1,
        contentHash: new Bun.CryptoHasher("sha256").update(`content:${marker}`).digest("hex"),
        evidenceRef: `tax-jurisdiction:${new Bun.CryptoHasher("sha256").update(`jurisdiction:${marker}`).digest("hex")}`,
      },
      evaluation: {
        schemaVersion: 1,
        jurisdictionKey: `in.order434.${marker}`,
        country: "IN",
        priceDisplay: "tax_exclusive",
        rounding: "line",
        inputTotalMinor: 10_000n,
        baseTotalMinor: 10_000n,
        taxTotalMinor: 500n,
        grandTotalMinor: 10_500n,
        taxes: [{
          code: "GST_ROOM",
          name: "Aggregate GST evidence",
          taxMinor: 500n,
          components: [{
            lineId: "room",
            revenueGroup: "room_revenue",
            baseMinor: 10_000n,
            taxMinor: 500n,
            rateBasisPoints: 500,
          }],
        }],
      },
    });

    await deploy.begin(async (tx) => {
      await tx`SET LOCAL session_replication_role=replica`;
      await tx`INSERT INTO tenant(id,slug,name,tier,status)
        VALUES(${tenant}::uuid,${`o434-${marker}`} ,'Order434 source proof','shared','active')`;
      await tx`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone,currency)
        VALUES(${property}::uuid,${tenant}::uuid,${`o434${marker}.property`}::ltree,'property','Order434','UTC','INR')`;
      await tx`INSERT INTO app_user(id,tenant_id,email,display_name,status) VALUES
        (${actor}::uuid,${tenant}::uuid,${`actor-${marker}@order434.local`},'Recorder','active'),
        (${unauthorizedActor}::uuid,${tenant}::uuid,${`deny-${marker}@order434.local`},'No grant','active')`;
      await tx`INSERT INTO permission(code,description)
        VALUES('tax-fiscal.india-valuation:finalize','Finalize governed India accommodation valuation')
        ON CONFLICT DO NOTHING`;
      await tx`INSERT INTO role(id,tenant_id,name)
        VALUES(${role}::uuid,${tenant}::uuid,${`Order434 recorder ${marker}`})`;
      await tx`INSERT INTO role_permission(role_id,permission_code)
        VALUES(${role}::uuid,'tax-fiscal.india-valuation:finalize')`;
      await tx`INSERT INTO user_role(tenant_id,user_id,role_id,scope_node)
        VALUES(${tenant}::uuid,${actor}::uuid,${role}::uuid,${property}::uuid)`;
      await tx`INSERT INTO party(id,tenant_id,kind,display_name,status)
        VALUES(${party}::uuid,${tenant}::uuid,'person','Guest','active')`;
      await tx`INSERT INTO unit_type(id,tenant_id,property_node,code,name,profile_key,max_occupancy)
        VALUES(${unitType}::uuid,${tenant}::uuid,${property}::uuid,${`O434${serial}`} ,'Room','hotel',2)`;
      await tx`INSERT INTO sellable_unit(id,tenant_id,unit_type_id,name,status)
        VALUES(${sellable}::uuid,${tenant}::uuid,${unitType}::uuid,'Room','active')`;
      await tx`INSERT INTO rate_plan(id,tenant_id,property_node,code,name,currency,tax_inclusive,status)
        VALUES(${ratePlan}::uuid,${tenant}::uuid,${property}::uuid,${`O434-${serial}`} ,'Rate','INR',false,'active')`;
      await tx`INSERT INTO reservation(id,tenant_id,property_node,confirmation_no,status,primary_party,channel_code,currency)
        VALUES(${reservation}::uuid,${tenant}::uuid,${property}::uuid,${`O434-R-${marker}`} ,'checked_out',${party}::uuid,'direct','INR')`;
      await tx`INSERT INTO reservation_segment(id,tenant_id,reservation_id,seq,unit_type_id,sellable_unit_id,period,adults,children,rate_plan_id,status)
        VALUES(${segment}::uuid,${tenant}::uuid,${reservation}::uuid,1,${unitType}::uuid,${sellable}::uuid,
          '[2035-01-01,2035-01-02)'::tstzrange,2,'[]',${ratePlan}::uuid,'booked')`;
      await tx`INSERT INTO hold(id,tenant_id,property_node,sellable_unit_id,period,kind,holder,expires_at,status)
        VALUES(${hold}::uuid,${tenant}::uuid,${property}::uuid,${sellable}::uuid,
          '[2035-01-01,2035-01-02)'::tstzrange,'cart','{}','2035-01-02','consumed')`;
      await tx`INSERT INTO tax_attribution_snapshot(
          tenant_id,id,property_node,actor_id,schema_version,origin_kind,
          origin_quote_hash,snapshot_hash,currency,snapshot)
        VALUES(${tenant}::uuid,${attribution}::uuid,${property}::uuid,${actor}::uuid,1,
          'rate_quote',${quoteHash},${snapshot.snapshotHash},'INR',${JSON.stringify(snapshot)}::jsonb)`;
      await tx`INSERT INTO tax_attribution_hold_binding(
          tenant_id,id,property_node,bound_by,hold_id,attribution_id,sellable_unit_id,
          period,origin_quote_hash,snapshot_hash,currency)
        VALUES(${tenant}::uuid,${holdBinding}::uuid,${property}::uuid,${actor}::uuid,
          ${hold}::uuid,${attribution}::uuid,${sellable}::uuid,
          '[2035-01-01,2035-01-02)'::tstzrange,${quoteHash},${snapshot.snapshotHash},'INR')`;
      await tx`INSERT INTO tax_attribution_reservation_binding(
          tenant_id,id,property_node,linked_by,binding_id,hold_id,attribution_id,
          reservation_id,segment_id,sellable_unit_id,period,origin_quote_hash,snapshot_hash,currency)
        VALUES(${tenant}::uuid,${lineage}::uuid,${property}::uuid,${actor}::uuid,
          ${holdBinding}::uuid,${hold}::uuid,${attribution}::uuid,${reservation}::uuid,
          ${segment}::uuid,${sellable}::uuid,'[2035-01-01,2035-01-02)'::tstzrange,
          ${quoteHash},${snapshot.snapshotHash},'INR')`;
    });
    return { tenant, property, actor, unauthorizedActor, reservation, lineage };
  }

  function serviceRequest(journey: Journey, key: string, requestId = crypto.randomUUID()) {
    return frozen({
      tenantId: journey.tenant,
      propertyNode: journey.property,
      reservationId: journey.reservation,
      reservationLineageId: journey.lineage,
      serviceProvisionDate: SERVICE_DATE,
      serviceProvisionSource: "governed_service_provision_record" as const,
      serviceProvisionEvidenceSha256: SERVICE_SHA,
      legalRule: "CGST_ACT_13_2_B_SERVICE_PROVISION_DATE_INPUT_ONLY" as const,
      idempotencyKey: key,
      envelope: createAuditEnvelope({
        actorId: journey.actor,
        tenantId: journey.tenant,
        propertyNode: journey.property,
        requestId,
        operation: SERVICE_EVENT,
      }),
    });
  }

  function paymentRequest(
    journey: Journey,
    serviceProvisionSnapshotId: string,
    key: string,
    requestId = crypto.randomUUID(),
  ) {
    return frozen({
      tenantId: journey.tenant,
      propertyNode: journey.property,
      reservationId: journey.reservation,
      serviceProvisionSnapshotId,
      amountMinor: AMOUNT_MINOR,
      currency: "INR" as const,
      coverageScope: "full_attribution" as const,
      supplierBooksEntryDate: BOOKS_DATE,
      supplierBankCreditDate: BANK_DATE,
      paymentReceiptSource: "governed_supplier_payment_receipt_record" as const,
      paymentReceiptEvidenceSha256: PAYMENT_SHA,
      legalRule: "CGST_ACT_13_2_EXPLANATION_II_PAYMENT_RECEIPT_DATE_INPUT_ONLY" as const,
      idempotencyKey: key,
      envelope: createAuditEnvelope({
        actorId: journey.actor,
        tenantId: journey.tenant,
        propertyNode: journey.property,
        requestId,
        operation: PAYMENT_EVENT,
      }),
    });
  }

  function ordinaryRequest(
    journey: Journey,
    serviceProvisionSnapshotId: string,
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
      serviceProvisionSnapshotId,
      regime: "ordinary_rule47_30_day" as const,
      ordinaryRegimeSource: "governed_rule47_ordinary_regime_record" as const,
      legalBasis: "CGST_RULE_47_ORDINARY_SERVICE_INVOICE_30_DAY_INPUT" as const,
      ordinaryRegimeEvidenceSha256: options.evidenceSha256 ?? ORDINARY_SHA,
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

  async function recordService(
    journey: Journey,
    key: string,
    requestId = crypto.randomUUID(),
  ) {
    return database.withTenantTransaction(journey.tenant, (tx) =>
      sourceIntake.recordServiceProvision(tx, serviceRequest(journey, key, requestId)));
  }

  async function recordPayment(
    journey: Journey,
    serviceId: string,
    key: string,
    requestId = crypto.randomUUID(),
  ) {
    return database.withTenantTransaction(journey.tenant, (tx) =>
      sourceIntake.recordPaymentReceipt(tx, paymentRequest(journey, serviceId, key, requestId)));
  }

  async function recordOrdinary(
    journey: Journey,
    serviceId: string,
    key: string,
    options: Parameters<typeof ordinaryRequest>[3] = {},
  ) {
    return database.withTenantTransaction(journey.tenant, (tx) =>
      ordinaryEvidence.record(tx, ordinaryRequest(journey, serviceId, key, options)));
  }

  beforeAll(async () => {
    tenantA = await seedJourney("a");
    tenantB = await seedJourney("b");
    baselineA = await census(tenantA.tenant);
  });

  afterAll(async () => {
    await database.close();
    await deploy.close({ timeout: 0 });
  });

  test("all three recorders persist exact sources without changing financial state", async () => {
    const serviceRequestId = crypto.randomUUID();
    const paymentRequestId = crypto.randomUUID();
    const ordinaryRequestId = crypto.randomUUID();
    serviceA = await recordService(tenantA, "order434-service-a", serviceRequestId);
    paymentA = await recordPayment(
      tenantA,
      serviceA.serviceProvision.serviceProvisionSnapshotId,
      "order434-payment-a",
      paymentRequestId,
    );
    ordinaryA = await recordOrdinary(
      tenantA,
      serviceA.serviceProvision.serviceProvisionSnapshotId,
      "order434-ordinary-a",
      { requestId: ordinaryRequestId },
    );
    expect(serviceA).toMatchObject({ created: true, replayed: false });
    expect(paymentA).toMatchObject({ created: true, replayed: false });
    expect(ordinaryA).toMatchObject({
      created: true,
      replayed: false,
      regime: "ordinary_rule47_30_day",
      ordinaryRegimeSource: "governed_rule47_ordinary_regime_record",
      legalBasis: "CGST_RULE_47_ORDINARY_SERVICE_INVOICE_30_DAY_INPUT",
      ordinaryRegimeEvidenceSha256: ORDINARY_SHA,
    });
    expect(serviceA.serviceProvision.serviceProvisionEvidenceSha256).toBe(SERVICE_SHA);
    expect(paymentA.paymentReceipt.paymentReceiptEvidenceSha256).toBe(PAYMENT_SHA);
    expect(paymentA.paymentReceipt.amountMinor).toBe(AMOUNT_MINOR);
    expect(paymentA.paymentReceipt.paymentReceiptDate).toBe(BANK_DATE);
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
        recording_request_id: ordinaryRequestId,
        request_key_hash: keyHash("order434-ordinary-a"),
        request_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
        evidence_hash: ordinaryA.evidenceHash, recorded: true,
      },
      {
        kind: "payment", recording_actor_id: tenantA.actor,
        recording_request_id: paymentRequestId,
        request_key_hash: keyHash("order434-payment-a"),
        request_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
        evidence_hash: paymentA.evidenceHash, recorded: true,
      },
      {
        kind: "service", recording_actor_id: tenantA.actor,
        recording_request_id: serviceRequestId,
        request_key_hash: keyHash("order434-service-a"),
        request_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
        evidence_hash: serviceA.evidenceHash, recorded: true,
      },
    ]);

    const after = await census(tenantA.tenant);
    expect(after).toEqual({
      services: baselineA.services + 1,
      payments: baselineA.payments + 1,
      ordinary: baselineA.ordinary + 1,
      facts: baselineA.facts + 3,
      events: baselineA.events + 3,
      journals: baselineA.journals,
      lines: baselineA.lines,
      documents: baselineA.documents,
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
    const replay = await recordOrdinary(
      tenantA,
      serviceA.serviceProvision.serviceProvisionSnapshotId,
      "order434-ordinary-a",
      { requestId: crypto.randomUUID() },
    );
    expect(replay).toEqual({ ...ordinaryA, created: false, replayed: true });
    expect(await census(tenantA.tenant)).toEqual(before);

    await deploy`UPDATE app_user SET status='inactive'
      WHERE tenant_id=${tenantA.tenant}::uuid AND id=${tenantA.actor}::uuid`;
    try {
      await expect(recordOrdinary(
        tenantA,
        serviceA.serviceProvision.serviceProvisionSnapshotId,
        "order434-ordinary-a",
      )).rejects.toBeInstanceOf(IndiaGstAccommodationOrdinaryRegimeEvidenceNotFoundError);
    } finally {
      await deploy`UPDATE app_user SET status='active'
        WHERE tenant_id=${tenantA.tenant}::uuid AND id=${tenantA.actor}::uuid`;
    }
    await expect(recordOrdinary(
      tenantA,
      serviceA.serviceProvision.serviceProvisionSnapshotId,
      "order434-ordinary-a",
      { evidenceSha256: "d".repeat(64) },
    )).rejects.toBeInstanceOf(IndiaGstAccommodationOrdinaryRegimeEvidenceConflictError);
    expect(await census(tenantA.tenant)).toEqual(before);
  });

  test("a second tenant has independent ordinary authority and remains RLS-isolated", async () => {
    const serviceB = await recordService(tenantB, "order434-service-b");
    await recordPayment(
      tenantB,
      serviceB.serviceProvision.serviceProvisionSnapshotId,
      "order434-payment-b",
    );
    const ordinaryB = await recordOrdinary(
      tenantB,
      serviceB.serviceProvision.serviceProvisionSnapshotId,
      "order434-ordinary-b",
    );
    expect(ordinaryB.created).toBe(true);
    await expect(recordOrdinary(
      tenantB,
      serviceB.serviceProvision.serviceProvisionSnapshotId,
      "order434-ordinary-b-denied",
      { actorId: tenantA.actor },
    )).rejects.toBeInstanceOf(IndiaGstAccommodationOrdinaryRegimeEvidenceNotFoundError);
    await expect(recordOrdinary(
      tenantB,
      serviceB.serviceProvision.serviceProvisionSnapshotId,
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
    const base = ordinaryRequest(
      tenantA,
      serviceA.serviceProvision.serviceProvisionSnapshotId,
      "order434-missing-ordinary",
    );
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
