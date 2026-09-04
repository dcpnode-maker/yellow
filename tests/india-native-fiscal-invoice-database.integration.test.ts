import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { SQL } from "bun";

import {
  BusinessDaySealService,
  IndiaFinalComponentTaxCorrectionService,
} from "../src/contexts/financials";
import {
  IndiaIrpAccommodationFiscalActionReadinessService,
  IndiaIrpAccommodationSourceService,
  IndiaNativeFiscalInvoiceIssuanceService,
  IndiaNativeFiscalSeriesConfigurationService,
} from "../src/contexts/tax-fiscal";
import {
  Database,
  PostgresEventBus,
  PostgresIdempotency,
  createAuditEnvelope,
} from "../src/kernel";
import { order413Fixtures, type Fixture } from "./india-irp-accommodation-source.integration.test";
import { PersistedIndiaFiscalSourceFactory } from "./fixtures/india-native-fiscal-persisted-source-factory";

setDefaultTimeout(300_000);

const DEPLOY_URL = process.env.YELLOW_ORDER430_DEPLOY_DATABASE_URL ?? process.env.YELLOW_DEPLOY_DATABASE_URL;
const RUNTIME_URL = process.env.YELLOW_ORDER430_RUNTIME_DATABASE_URL ?? process.env.YELLOW_RUNTIME_DATABASE_URL;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_ORDER430_DATABASE === "1";

if (REQUIRE_DATABASE && (!DEPLOY_URL || !RUNTIME_URL)) {
  throw new Error("YELLOW_ORDER430_DEPLOY_DATABASE_URL and YELLOW_ORDER430_RUNTIME_DATABASE_URL are required");
}

const databaseDescribe = DEPLOY_URL && RUNTIME_URL ? describe.serial : describe.skip;
let deploy: SQL | undefined;
let runtime: SQL | undefined;
let database: Database | undefined;

const ACTOR = "00000000-0000-4000-8000-000000043021";
const ALTERNATE_ACTOR = "00000000-0000-4000-8000-000000043023";
const ROLE = "00000000-0000-4000-8000-000000043022";

type SelectedFixture = Pick<Fixture,
  "tenant_id" | "property_node" | "reservation_id" | "folio_id" | "journal_id" |
  "buyer_party_id" | "recipient_registration_id" | "classification_id" |
  "supplyInput" | "supplyResult">;

function selected(fixture: SelectedFixture) {
  return {
    tenantId: fixture.tenant_id,
    propertyNode: fixture.property_node,
    reservationId: fixture.reservation_id,
    folioId: fixture.folio_id,
    journalId: fixture.journal_id,
    recipientPartyId: fixture.buyer_party_id,
    recipientRegistrationId: fixture.recipient_registration_id,
    classificationId: fixture.classification_id,
    supplyNatureAtTimeOfSupplyInput: fixture.supplyInput,
    supplyNatureAtTimeOfSupplyResult: fixture.supplyResult,
  };
}

function evidencePreimage(value: Readonly<Record<string, unknown>>, tenantId: string): string {
  const { evidenceHash: _ignored, ...body } = value;
  return JSON.stringify({ tenantId, ...body });
}

function evidenceHash(value: unknown): string {
  return new Bun.CryptoHasher("sha256").update(JSON.stringify(value)).digest("hex");
}

function envelope(fixture: Fixture, operation: string, actorId = ACTOR) {
  return createAuditEnvelope({
    tenantId: fixture.tenant_id,
    propertyNode: fixture.property_node,
    actorId,
    operation,
    requestId: crypto.randomUUID(),
  });
}

async function expectSqlState(action: () => Promise<unknown>, expected: string) {
  try {
    await action();
  } catch (error) {
    const state = (error as { errno?: string; code?: string }).errno ?? (error as { code?: string }).code;
    expect(state).toBe(expected);
    return;
  }
  throw new Error(`expected SQLSTATE ${expected}`);
}

async function waitForRuntimeLock(observer: SQL, queryFragment: string): Promise<void> {
  for (let attempt = 0; attempt < 1_000; attempt += 1) {
    const [row] = await observer<Array<{ waiting: number }>>`
      SELECT count(*)::int AS waiting
        FROM pg_catalog.pg_stat_activity
       WHERE datname=pg_catalog.current_database()
         AND usename='yellow_runtime'
         AND pid<>pg_catalog.pg_backend_pid()
         AND wait_event_type='Lock'
         AND query LIKE ${`%${queryFragment}%`}`;
    if ((row?.waiting ?? 0) > 0) return;
    await Bun.sleep(5);
  }
  throw new Error(`timed out waiting for governed runtime lock: ${queryFragment}`);
}

async function waitForRuntimeLockCount(observer: SQL, minimum: number): Promise<void> {
  for (let attempt = 0; attempt < 1_000; attempt += 1) {
    const [row] = await observer<Array<{ waiting: number }>>`
      SELECT count(*)::int AS waiting
        FROM pg_catalog.pg_stat_activity
       WHERE datname=pg_catalog.current_database()
         AND usename='yellow_runtime'
         AND pid<>pg_catalog.pg_backend_pid()
         AND wait_event_type='Lock'`;
    if ((row?.waiting ?? 0) >= minimum) return;
    await Bun.sleep(5);
  }
  throw new Error(`timed out waiting for ${minimum} governed runtime lock waiters`);
}

beforeAll(() => {
  if (!DEPLOY_URL || !RUNTIME_URL) return;
  deploy = new SQL(DEPLOY_URL, { max: 1, prepare: false });
  runtime = new SQL(RUNTIME_URL, { max: 1, prepare: false });
  database = Database.connect(RUNTIME_URL, { maxConnections: 16, prepare: false });
});

afterAll(async () => {
  await runtime?.close();
  await deploy?.close();
  await database?.close();
});

databaseDescribe("Order430 India native fiscal database authority", () => {
  test("P0: the applied database has the 74/125 frontier and both governed capabilities", async () => {
    const frontier = await deploy!<Array<{ migrations: number; tables: number }>>`
      SELECT
        (SELECT count(*)::int FROM public.schema_migration) AS migrations,
        (SELECT count(*)::int FROM pg_catalog.pg_tables WHERE schemaname='public') AS tables`;
    expect(frontier).toEqual([{ migrations: 74, tables: 125 }]);

    const functions = await deploy!<Array<{ name: string; owner: string; securityDefiner: boolean; config: string[] | null }>>`
      SELECT p.proname AS name, pg_catalog.pg_get_userbyid(p.proowner) AS owner,
             p.prosecdef AS "securityDefiner", p.proconfig AS config
        FROM pg_catalog.pg_proc p
        JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='public'
         AND p.proname IN ('create_india_native_fiscal_series','commit_india_native_fiscal_invoice')
       ORDER BY p.proname`;
    expect(functions).toEqual([
      { name: "commit_india_native_fiscal_invoice", owner: "yellow_owner", securityDefiner: true, config: ["search_path=pg_catalog, public"] },
      { name: "create_india_native_fiscal_series", owner: "yellow_owner", securityDefiner: true, config: ["search_path=pg_catalog, public"] },
    ]);
  });

  test("P0: native origin is forced-RLS and fiscal capabilities reject an ungoverned caller without writes", async () => {
    const rls = await deploy!<Array<{ rls: boolean; forced: boolean }>>`
      SELECT relrowsecurity AS rls, relforcerowsecurity AS forced
        FROM pg_catalog.pg_class WHERE oid='public.india_gst_native_fiscal_document_origin'::regclass`;
    expect(rls).toEqual([{ rls: true, forced: true }]);

    const before = await deploy!<Array<{ series: number; documents: number; origins: number; keys: number }>>`
      SELECT
        (SELECT count(*)::int FROM public.document_series) AS series,
        (SELECT count(*)::int FROM public.document) AS documents,
        (SELECT count(*)::int FROM public.india_gst_native_fiscal_document_origin) AS origins,
        (SELECT count(*)::int FROM public.api_idempotency) AS keys`;

    await expectSqlState(() => runtime!`
      SELECT * FROM public.create_india_native_fiscal_series(
        '00000000-0000-0000-0000-000000043001'::uuid,
        '00000000-0000-0000-0000-000000043002'::uuid,
        '00000000-0000-0000-0000-000000043003'::uuid,
        'invoice','INV-', '00000000-0000-0000-0000-000000043004'::uuid)`, "42501");
    await expectSqlState(() => runtime!`
      SELECT * FROM public.commit_india_native_fiscal_invoice(
        '00000000-0000-0000-0000-000000043001'::uuid,
        '00000000-0000-0000-0000-000000043002'::uuid,
        '00000000-0000-0000-0000-000000043004'::uuid,
        '00000000-0000-0000-0000-000000043005'::uuid,
        '00000000-0000-0000-0000-000000043006'::uuid,
        '00000000-0000-0000-0000-000000043007'::uuid,
        'order430-invalid', '{}'::jsonb,
        '00000000-0000-0000-0000-000000043008'::uuid)`, "42501");
    await expectSqlState(() => runtime!`
      INSERT INTO public.document_series(tenant_id,property_node,kind,prefix)
      VALUES('00000000-0000-0000-0000-000000043001'::uuid,
             '00000000-0000-0000-0000-000000043002'::uuid,'invoice','INV-')`, "42501");

    expect(await deploy!<Array<{ series: number; documents: number; origins: number; keys: number }>>`
      SELECT
        (SELECT count(*)::int FROM public.document_series) AS series,
        (SELECT count(*)::int FROM public.document) AS documents,
        (SELECT count(*)::int FROM public.india_gst_native_fiscal_document_origin) AS origins,
        (SELECT count(*)::int FROM public.api_idempotency) AS keys`).toEqual(before);
  });

  test("P0: governed runtime rejects a self-consistent forged legal body and leaves zero issuance artifacts", async () => {
    const factory = await PersistedIndiaFiscalSourceFactory.create(deploy!, RUNTIME_URL!);
    try {
      const [fixture] = await factory.createMany(1);
      if (!fixture) throw new Error("Order430 forged-evidence source is unavailable");
      const configured = await database!.withTenantTransaction(factory.tenantId, (tx) =>
        new IndiaNativeFiscalSeriesConfigurationService().configure(tx, {
          tenantId: factory.tenantId, propertyNode: factory.propertyNode,
          supplierRegistrationId: factory.supplierRegistrationId, documentKind: "invoice", prefix: "I/2627/",
          envelope: createAuditEnvelope({ tenantId: factory.tenantId, propertyNode: factory.propertyNode,
            actorId: factory.actorId, operation: "document.series.configured", requestId: crypto.randomUUID() }),
        }));

      await expect(database!.withTenantTransaction(factory.tenantId, async (tx) => {
        const selectors = Object.freeze(selected(fixture));
        const source = await new IndiaIrpAccommodationSourceService().resolve(tx, selectors);
        const readiness = await new IndiaIrpAccommodationFiscalActionReadinessService().resolve(tx, selectors);
        const forgedSeller = { ...source.sellerDetails.payload.SellerDtls,
          Gstin: "29ABCDE1234F1Z5", LglNm: "FORGED SELLER PRIVATE LIMITED" };
        const forgedSourceBody = { ...source,
          sellerDetails: { ...source.sellerDetails, payload: { SellerDtls: forgedSeller } } } as Record<string, unknown>;
        delete forgedSourceBody.evidenceHash;
        const forgedSourcePreimage = { tenantId: factory.tenantId, ...forgedSourceBody };
        const forgedSourceHash = evidenceHash(forgedSourcePreimage);

        const forgedSections = { ...readiness.preDocumentEvidence.sections, SellerDtls: forgedSeller };
        const forgedSectionsJson = JSON.stringify(forgedSections);
        const forgedPreBody = { ...readiness.preDocumentEvidence, sections: forgedSections,
          sectionsJson: forgedSectionsJson, sourceEvidenceHash: forgedSourceHash,
          lineage: { ...readiness.preDocumentEvidence.lineage, sourceEvidenceHash: forgedSourceHash } } as Record<string, unknown>;
        delete forgedPreBody.evidenceHash;
        const forgedPrePreimage = { tenantId: factory.tenantId, ...forgedPreBody };
        const forgedPreHash = evidenceHash(forgedPrePreimage);
        const forgedPreComplete = { ...forgedPreBody, evidenceHash: forgedPreHash };

        const forgedReadinessBody = { ...readiness, sourceEvidenceHash: forgedSourceHash,
          preDocumentEvidenceHash: forgedPreHash, preDocumentEvidence: forgedPreComplete } as Record<string, unknown>;
        delete forgedReadinessBody.evidenceHash;
        const forgedReadinessPreimage = { tenantId: factory.tenantId, ...forgedReadinessBody };
        const forgedReadinessHash = evidenceHash(forgedReadinessPreimage);
        const frozen = {
          readinessState: readiness.state, submissionReady: readiness.submissionReady,
          permittedActions: readiness.permittedActions, blockers: readiness.blockers,
          recipientRegistrationId: source.recipientRegistration.registrationId,
          sourceEvidenceHash: forgedSourceHash, preDocumentEvidenceHash: forgedPreHash,
          readinessEvidenceHash: forgedReadinessHash, preDocumentJson: forgedSectionsJson,
          sourceEvidencePreimage: JSON.stringify(forgedSourcePreimage),
          preDocumentEvidencePreimage: JSON.stringify(forgedPrePreimage),
          readinessEvidencePreimage: JSON.stringify(forgedReadinessPreimage),
        };
        await tx`SELECT * FROM public.commit_india_native_fiscal_invoice(
          ${factory.tenantId}::uuid,${factory.propertyNode}::uuid,${factory.actorId}::uuid,
          ${fixture.reservation_id}::uuid,${fixture.folio_id}::uuid,${fixture.journal_id}::uuid,
          ${`order430-forged-${fixture.journal_id}`},${JSON.stringify(frozen)}::jsonb,${crypto.randomUUID()}::uuid)`;
      })).rejects.toThrow(/stale or forged/);

      expect(await deploy!<Array<{ next_no: string; documents: number; origins: number;
        facts: number; events: number; keys: number }>>`SELECT
          (SELECT next_no::text FROM document_series WHERE tenant_id=${factory.tenantId}::uuid
            AND id=${configured.seriesId}::uuid) next_no,
          (SELECT count(*)::int FROM document WHERE tenant_id=${factory.tenantId}::uuid
            AND series_id=${configured.seriesId}::uuid) documents,
          (SELECT count(*)::int FROM india_gst_native_fiscal_document_origin
            WHERE tenant_id=${factory.tenantId}::uuid) origins,
          (SELECT count(*)::int FROM fact_log WHERE tenant_id=${factory.tenantId}::uuid
            AND entity_type='document' AND fact_type='issued') facts,
          (SELECT count(*)::int FROM outbox WHERE tenant_id=${factory.tenantId}::uuid
            AND event_type='document.issued') events,
          (SELECT count(*)::int FROM api_idempotency WHERE tenant_id=${factory.tenantId}::uuid
            AND operation='document.issued') keys`).toEqual([{
              next_no: "1", documents: 0, origins: 0, facts: 0, events: 0, keys: 0,
            }]);
    } finally {
      await factory.close();
    }
  });

  test("P0: a genuine approved Order429 source configures an active dated registration and issues once", async () => {
    const fixture = order413Fixtures[0];
    if (!fixture) throw new Error("Order413 predecessor fixture is unavailable");
    const today = (await deploy!<Array<{ date: string }>>`
      SELECT (pg_catalog.transaction_timestamp() AT TIME ZONE node.timezone)::date::text AS date
        FROM public.org_node node
       WHERE node.tenant_id=${fixture.tenant_id}::uuid AND node.id=${fixture.property_node}::uuid`)[0]?.date;
    if (!today) throw new Error("fixture property issue date is unavailable");
    // Order413 composes the exact statutory source evidence but deliberately leaves
    // the legal evidence roots read-only.  Populate those already-approved roots
    // here so Order430 proves it re-resolves persisted source truth rather than
    // trusting a service-only snapshot.
    const supplier = {
      registrationId: fixture.supplier_registration_id,
      evidenceHash: fixture.supplyInput.supplyNature.supplier.evidenceHash as string,
      serviceLocationEvidenceHash: fixture.supplyInput.supplyNature.supplier.serviceLocation.evidenceHash as string,
      recipientEvidenceHash: fixture.supplyInput.supplyNature.recipient.evidenceHash as string,
    };
    const supplyDate = fixture.supplyInput.supplyNature.supplier.status.statusAsOf as string;
    await deploy!`INSERT INTO public.india_gst_supplier_service_location(
      tenant_id,id,supplier_registration_id,supplier_evidence_hash,service_scope,registered_place_kind,location_basis,legal_rule)
      VALUES(${fixture.tenant_id}::uuid,${fixture.supplier_service_location_id}::uuid,${supplier.registrationId}::uuid,
        ${supplier.evidenceHash},'lodging_accommodation','principal_place_of_business',
        'supply_made_from_registered_place_of_business','IGST_ACT_2_15_A')
      ON CONFLICT (tenant_id,id) DO NOTHING`;
    await deploy!`INSERT INTO public.india_gst_supplier_sez_status(
      tenant_id,id,supplier_registration_id,supplier_registration_evidence_hash,status_as_of,
      gst_registration_status,gst_taxpayer_type,gst_status_source,gst_status_evidence_sha256,legal_rule)
      VALUES(${fixture.tenant_id}::uuid,${fixture.supplier_sez_status_id}::uuid,${supplier.registrationId}::uuid,
        ${supplier.evidenceHash},${supplyDate}::date,'active','regular','gst_common_portal',${"b".repeat(64)},
        'IGST_ACT_7_5_B_AND_8_2_SUPPLIER_STATUS') ON CONFLICT (tenant_id,id) DO NOTHING`;
    await deploy!`INSERT INTO public.india_gst_recipient_sez_status(
      tenant_id,id,recipient_registration_id,recipient_registration_evidence_hash,status_as_of,
      gst_registration_status,gst_taxpayer_type,gst_status_source,gst_status_evidence_sha256,legal_rule)
      VALUES(${fixture.tenant_id}::uuid,${fixture.recipient_sez_status_id}::uuid,${fixture.recipient_registration_id}::uuid,
        ${supplier.recipientEvidenceHash},${supplyDate}::date,'active','regular','gst_common_portal',${"c".repeat(64)},
        'IGST_ACT_7_5_B_AND_8_2_RECIPIENT_STATUS') ON CONFLICT (tenant_id,id) DO NOTHING`;
    await deploy!`INSERT INTO public.app_user(id,tenant_id,email,display_name,status)
      VALUES(${ACTOR}::uuid,${fixture.tenant_id}::uuid,'order430-fiscal@example.test','Order430 fiscal actor','active')
      ON CONFLICT (tenant_id,email) DO NOTHING`;
    await deploy!`INSERT INTO public.app_user(id,tenant_id,email,display_name,status)
      VALUES(${ALTERNATE_ACTOR}::uuid,${fixture.tenant_id}::uuid,'order430-alternate@example.test','Order430 alternate fiscal actor','active')
      ON CONFLICT (tenant_id,email) DO NOTHING`;
    await deploy!`INSERT INTO public.role(id,tenant_id,name)
      VALUES(${ROLE}::uuid,${fixture.tenant_id}::uuid,'Order430 fiscal authority')
      ON CONFLICT (tenant_id,name) DO NOTHING`;
    await deploy!`INSERT INTO public.role_permission(role_id,permission_code) VALUES
      (${ROLE}::uuid,'tax-fiscal.series:configure'),(${ROLE}::uuid,'tax-fiscal.documents:issue')
      ON CONFLICT DO NOTHING`;
    await deploy!`INSERT INTO public.user_role(tenant_id,user_id,role_id,scope_node)
      VALUES(${fixture.tenant_id}::uuid,${ACTOR}::uuid,${ROLE}::uuid,${fixture.property_node}::uuid)
      ON CONFLICT DO NOTHING`;
    await deploy!`INSERT INTO public.user_role(tenant_id,user_id,role_id,scope_node)
      VALUES(${fixture.tenant_id}::uuid,${ALTERNATE_ACTOR}::uuid,${ROLE}::uuid,${fixture.property_node}::uuid)
      ON CONFLICT DO NOTHING`;
    await deploy!`INSERT INTO public.india_gst_supplier_registration_status_snapshot(
      tenant_id,supplier_registration_id,supplier_registration_evidence_hash,status_as_of,
      gst_registration_status,gst_taxpayer_type,gst_status_source,gst_status_evidence_sha256,legal_rule)
      VALUES(${fixture.tenant_id}::uuid,${supplier.registrationId}::uuid,${supplier.evidenceHash},${today}::date,
        'active','regular','gst_common_portal',${"a".repeat(64)},'CGST_ACT_25_29_30_AND_RULE_21A_REGISTRATION_STATUS')
      ON CONFLICT (tenant_id,supplier_registration_id,supplier_registration_evidence_hash,status_as_of) DO NOTHING`;
    await deploy!`INSERT INTO public.india_gst_supplier_registration_status_snapshot(
      tenant_id,supplier_registration_id,supplier_registration_evidence_hash,status_as_of,
      gst_registration_status,gst_taxpayer_type,gst_status_source,gst_status_evidence_sha256,legal_rule)
      VALUES(${fixture.tenant_id}::uuid,${supplier.registrationId}::uuid,${supplier.evidenceHash},${supplyDate}::date,
        'active','regular','gst_common_portal',${"a".repeat(64)},'CGST_ACT_25_29_30_AND_RULE_21A_REGISTRATION_STATUS')
      ON CONFLICT (tenant_id,supplier_registration_id,supplier_registration_evidence_hash,status_as_of) DO NOTHING`;

    const seriesService = new IndiaNativeFiscalSeriesConfigurationService();
    const configured = await database!.withTenantTransaction(fixture.tenant_id, (tx) => seriesService.configure(tx, {
      tenantId: fixture.tenant_id, propertyNode: fixture.property_node,
      supplierRegistrationId: supplier.registrationId, documentKind: "invoice", prefix: "I/2627/",
      envelope: envelope(fixture, "document.series.configured"),
    }));
    expect(configured.replayed).toBeFalse();
    expect(configured.nextNo).toBe("1");
    const configuredReplay = await database!.withTenantTransaction(fixture.tenant_id, (tx) => seriesService.configure(tx, {
      tenantId: fixture.tenant_id, propertyNode: fixture.property_node,
      supplierRegistrationId: supplier.registrationId, documentKind: "invoice", prefix: "I/2627/",
      envelope: envelope(fixture, "document.series.configured"),
    }));
    expect(configuredReplay).toEqual({ ...configured, replayed: true });

    const issueService = new IndiaNativeFiscalInvoiceIssuanceService();
    await expect(database!.withTenantTransaction(fixture.tenant_id, async (tx) => {
      const provisional = await issueService.issue(tx, {
        ...selected(fixture), actorId: ACTOR, idempotencyKey: "order430-rollback-probe",
        envelope: envelope(fixture, "document.issued"),
      });
      expect(provisional.docNo).toBe("I/2627/1");
      throw new Error("Order430 injected outer-transaction failure");
    })).rejects.toThrow("Order430 injected outer-transaction failure");
    const afterRollback = await deploy!<Array<{ nextNo: string; documents: number; origins: number; facts: number; events: number; keys: number }>>`
      SELECT
        (SELECT next_no::text FROM public.document_series WHERE tenant_id=${fixture.tenant_id}::uuid
          AND id=${configured.seriesId}::uuid) AS "nextNo",
        (SELECT count(*)::int FROM public.document WHERE tenant_id=${fixture.tenant_id}::uuid
          AND series_id=${configured.seriesId}::uuid) AS documents,
        (SELECT count(*)::int FROM public.india_gst_native_fiscal_document_origin
          WHERE tenant_id=${fixture.tenant_id}::uuid) AS origins,
        (SELECT count(*)::int FROM public.fact_log WHERE tenant_id=${fixture.tenant_id}::uuid
          AND entity_type='document' AND fact_type='issued') AS facts,
        (SELECT count(*)::int FROM public.outbox WHERE tenant_id=${fixture.tenant_id}::uuid
          AND event_type='document.issued') AS events,
        (SELECT count(*)::int FROM public.api_idempotency WHERE tenant_id=${fixture.tenant_id}::uuid
          AND operation='document.issued') AS keys`;
    expect(afterRollback).toEqual([{ nextNo: "1", documents: 0, origins: 0, facts: 0, events: 0, keys: 0 }]);

    const issued = await database!.withTenantTransaction(fixture.tenant_id, (tx) => issueService.issue(tx, {
      ...selected(fixture), actorId: ACTOR, idempotencyKey: "order430-positive-issue", envelope: envelope(fixture, "document.issued"),
    }));
    expect(issued).toMatchObject({ docNo: "I/2627/1", status: "issued", replayed: false });
    expect(issued.prevHash).toBeNull();
    expect(issued.sha256).toMatch(/^[0-9a-f]{64}$/);
    const replay = await database!.withTenantTransaction(fixture.tenant_id, (tx) => issueService.issue(tx, {
      ...selected(fixture), actorId: ACTOR, idempotencyKey: "order430-positive-issue", envelope: envelope(fixture, "document.issued"),
    }));
    expect(replay).toEqual({ ...issued, replayed: true });

    // One hundred independent runtime transactions contending on the same
    // genuine Order429 command must converge on the immutable replay receipt.
    // This exercises both the idempotency advisory lock and the persisted
    // completed receipt rather than an in-process promise cache.
    const replayContenders = await Promise.all(Array.from({ length: 100 }, () =>
      database!.withTenantTransaction(fixture.tenant_id, (tx) => issueService.issue(tx, {
        ...selected(fixture), actorId: ACTOR, idempotencyKey: "order430-positive-issue",
        envelope: envelope(fixture, "document.issued"),
      })),
    ));
    expect(replayContenders).toHaveLength(100);
    expect(replayContenders.every((candidate) =>
      JSON.stringify(candidate) === JSON.stringify({ ...issued, replayed: true }))).toBeTrue();

    // The same visible key with a different authorized actor is a changed
    // command, not a replay.  Its rejection must leave the one legal document
    // and the series counter untouched.
    await expect(database!.withTenantTransaction(fixture.tenant_id, (tx) => issueService.issue(tx, {
      ...selected(fixture), actorId: ALTERNATE_ACTOR, idempotencyKey: "order430-positive-issue",
      envelope: envelope(fixture, "document.issued", ALTERNATE_ACTOR),
    }))).rejects.toThrow();
    expect(await deploy!<Array<{ documents: number; origins: number; nextNo: string }>>`
      SELECT
        (SELECT count(*)::int FROM public.document WHERE tenant_id=${fixture.tenant_id}::uuid
          AND series_id=${issued.seriesId}::uuid) AS documents,
        (SELECT count(*)::int FROM public.india_gst_native_fiscal_document_origin
          WHERE tenant_id=${fixture.tenant_id}::uuid AND document_id=${issued.documentId}::uuid) AS origins,
        (SELECT next_no::text FROM public.document_series WHERE tenant_id=${fixture.tenant_id}::uuid
          AND id=${issued.seriesId}::uuid) AS "nextNo"`).toEqual([{ documents: 1, origins: 1, nextNo: "2" }]);

    // The database, not TypeScript object ordering, owns the canonical legal body
    // and its chained digest.  The genesis document has no predecessor and the
    // stored JSONB representation is what was actually hashed.
    const [stored] = await deploy!<Array<{ hash: string; recomputed: string; prev: string | null; facts: number; events: number; idempotency: number }>>`
      SELECT document.sha256 AS hash,
             encode(public.digest(convert_to(document.content::text,'UTF8'),'sha256'),'hex') AS recomputed,
             document.prev_hash AS prev,
             (SELECT count(*)::int FROM public.fact_log fact WHERE fact.tenant_id=document.tenant_id AND fact.entity_id=document.id AND fact.fact_type='issued') AS facts,
             (SELECT count(*)::int FROM public.outbox event WHERE event.tenant_id=document.tenant_id AND event.aggregate_id=document.id AND event.event_type='document.issued') AS events,
             (SELECT count(*)::int FROM public.api_idempotency key WHERE key.tenant_id=document.tenant_id AND key.operation='document.issued' AND key.response_body->>'documentId'=document.id::text) AS idempotency
        FROM public.document document WHERE document.tenant_id=${fixture.tenant_id}::uuid AND document.id=${issued.documentId}::uuid`;
    expect(stored).toEqual({ hash: issued.sha256, recomputed: issued.sha256, prev: null, facts: 1, events: 1, idempotency: 1 });

    // Even a definer/owner-adjacent deployment connection cannot mutate an issued
    // native record after its immutable typed origin was committed.
    await expectSqlState(() => deploy!`UPDATE public.document SET content=content WHERE tenant_id=${fixture.tenant_id}::uuid AND id=${issued.documentId}::uuid`, "55000");
    await expectSqlState(() => deploy!`UPDATE public.india_gst_native_fiscal_document_origin SET origin_key=origin_key
      WHERE tenant_id=${fixture.tenant_id}::uuid AND document_id=${issued.documentId}::uuid`, "55000");
    await expectSqlState(() => deploy!`DELETE FROM public.india_gst_native_fiscal_document_origin
      WHERE tenant_id=${fixture.tenant_id}::uuid AND document_id=${issued.documentId}::uuid`, "55000");

    const foreign = order413Fixtures.find((candidate) => candidate.tenant_id !== fixture.tenant_id);
    if (!foreign) throw new Error("cross-tenant predecessor fixture is unavailable");
    const beforeHostility = await deploy!<Array<{ documents: number; origins: number; nextNo: string }>>`
      SELECT
        (SELECT count(*)::int FROM public.document WHERE tenant_id=${fixture.tenant_id}::uuid
          AND series_id=${issued.seriesId}::uuid) AS documents,
        (SELECT count(*)::int FROM public.india_gst_native_fiscal_document_origin
          WHERE tenant_id=${fixture.tenant_id}::uuid) AS origins,
        (SELECT next_no::text FROM public.document_series WHERE tenant_id=${fixture.tenant_id}::uuid
          AND id=${issued.seriesId}::uuid) AS "nextNo"`;
    const hostileCommands = [
      { ...selected(fixture), propertyNode: foreign.property_node },
      { ...selected(fixture), reservationId: foreign.reservation_id },
      { ...selected(fixture), folioId: foreign.folio_id },
      { ...selected(fixture), journalId: foreign.journal_id },
      { ...selected(fixture), recipientPartyId: foreign.buyer_party_id },
      { ...selected(fixture), recipientRegistrationId: foreign.recipient_registration_id },
      { ...selected(fixture), classificationId: foreign.classification_id },
    ];
    for (const [index, command] of hostileCommands.entries()) {
      await expect(database!.withTenantTransaction(fixture.tenant_id, (tx) => issueService.issue(tx, {
        ...command, actorId: ACTOR, idempotencyKey: `order430-hostile-${index}`,
        envelope: envelope(fixture, "document.issued"),
      }))).rejects.toThrow();
      expect(await deploy!<Array<{ documents: number; origins: number; nextNo: string }>>`
        SELECT
          (SELECT count(*)::int FROM public.document WHERE tenant_id=${fixture.tenant_id}::uuid
            AND series_id=${issued.seriesId}::uuid) AS documents,
          (SELECT count(*)::int FROM public.india_gst_native_fiscal_document_origin
            WHERE tenant_id=${fixture.tenant_id}::uuid) AS origins,
          (SELECT next_no::text FROM public.document_series WHERE tenant_id=${fixture.tenant_id}::uuid
            AND id=${issued.seriesId}::uuid) AS "nextNo"`).toEqual(beforeHostility);
    }
    const concealed = await database!.withTenantTransaction(foreign.tenant_id, (tx) => tx<Array<{ count: number }>>`
      SELECT count(*)::int AS count FROM public.india_gst_native_fiscal_document_origin
       WHERE document_id=${issued.documentId}::uuid`);
    expect(concealed).toEqual([{ count: 0 }]);
  });

  test("P0: 100 independent governed sources contend on one series without gaps and form one valid hash chain", async () => {
    const factory = await PersistedIndiaFiscalSourceFactory.create(deploy!, RUNTIME_URL!);
    try {
      const fixtures = await factory.createMany(100);
      expect(fixtures).toHaveLength(100);
      expect(new Set(fixtures.map((fixture) => fixture.tenant_id))).toEqual(new Set([factory.tenantId]));
      expect(new Set(fixtures.map((fixture) => fixture.property_node))).toEqual(new Set([factory.propertyNode]));
      expect(new Set(fixtures.map((fixture) => fixture.reservation_id)).size).toBe(100);
      expect(new Set(fixtures.map((fixture) => fixture.folio_id)).size).toBe(100);
      expect(new Set(fixtures.map((fixture) => fixture.journal_id)).size).toBe(100);
      expect(new Set(fixtures.map((fixture) => fixture.recipient_registration_id)).size).toBe(100);

      const seriesService = new IndiaNativeFiscalSeriesConfigurationService();
      const issueService = new IndiaNativeFiscalInvoiceIssuanceService();
      const configured = await database!.withTenantTransaction(factory.tenantId, (tx) => seriesService.configure(tx, {
        tenantId: factory.tenantId,
        propertyNode: factory.propertyNode,
        supplierRegistrationId: factory.supplierRegistrationId,
        documentKind: "invoice",
        prefix: "I/2627/",
        envelope: createAuditEnvelope({ tenantId: factory.tenantId, propertyNode: factory.propertyNode,
          actorId: factory.actorId, operation: "document.series.configured", requestId: crypto.randomUUID() }),
      }));

      const commands = fixtures.map((fixture, index) => ({
        tenantId: fixture.tenant_id,
        propertyNode: fixture.property_node,
        reservationId: fixture.reservation_id,
        folioId: fixture.folio_id,
        journalId: fixture.journal_id,
        recipientPartyId: fixture.buyer_party_id,
        recipientRegistrationId: fixture.recipient_registration_id,
        classificationId: fixture.classification_id,
        supplyNatureAtTimeOfSupplyInput: fixture.supplyInput,
        supplyNatureAtTimeOfSupplyResult: fixture.supplyResult,
        actorId: fixture.actor_id,
        idempotencyKey: `order430-distinct-${String(index + 1).padStart(3, "0")}-${fixture.journal_id}`,
        envelope: createAuditEnvelope({ tenantId: fixture.tenant_id, propertyNode: fixture.property_node,
          actorId: fixture.actor_id, operation: "document.issued", requestId: crypto.randomUUID() }),
      }));
      const receipts = await Promise.all(commands.map((command) =>
        database!.withTenantTransaction(factory.tenantId, (tx) => issueService.issue(tx, command as never))));
      expect(receipts).toHaveLength(100);
      expect(receipts.every((receipt) => !receipt.replayed && receipt.seriesId === configured.seriesId)).toBeTrue();
      expect(receipts.map((receipt) => Number(receipt.docNo.slice("I/2627/".length))).sort((a, b) => a - b))
        .toEqual(Array.from({ length: 100 }, (_, index) => index + 1));

      const inventory = await deploy!<Array<{ next_no: string; documents: number; origins: number; facts: number;
        events: number; keys: number }>>`SELECT
          (SELECT next_no::text FROM document_series WHERE tenant_id=${factory.tenantId}::uuid
            AND id=${configured.seriesId}::uuid) next_no,
          (SELECT count(*)::int FROM document WHERE tenant_id=${factory.tenantId}::uuid
            AND series_id=${configured.seriesId}::uuid) documents,
          (SELECT count(*)::int FROM india_gst_native_fiscal_document_origin WHERE tenant_id=${factory.tenantId}::uuid) origins,
          (SELECT count(*)::int FROM fact_log WHERE tenant_id=${factory.tenantId}::uuid
            AND entity_type='document' AND fact_type='issued') facts,
          (SELECT count(*)::int FROM outbox WHERE tenant_id=${factory.tenantId}::uuid
            AND event_type='document.issued') events,
          (SELECT count(*)::int FROM api_idempotency WHERE tenant_id=${factory.tenantId}::uuid
            AND operation='document.issued' AND completed_at IS NOT NULL) keys`;
      expect(inventory).toEqual([{ next_no: "101", documents: 100, origins: 100, facts: 100, events: 100, keys: 100 }]);

      const chain = await deploy!<Array<{ serial: number; sha256: string; prev_hash: string | null;
        recomputed: string }>>`SELECT substring(doc_no from '[0-9]+$')::int serial,sha256,prev_hash,
          encode(public.digest(convert_to(content::text,'UTF8'),'sha256'),'hex') recomputed
        FROM document WHERE tenant_id=${factory.tenantId}::uuid AND series_id=${configured.seriesId}::uuid
        ORDER BY substring(doc_no from '[0-9]+$')::int`;
      expect(chain).toHaveLength(100);
      for (let index = 0; index < chain.length; index += 1) {
        expect(chain[index]!.serial).toBe(index + 1);
        expect(chain[index]!.recomputed).toBe(chain[index]!.sha256);
        expect(chain[index]!.prev_hash).toBe(index === 0 ? null : chain[index - 1]!.sha256);
      }
      const tail = await deploy!<Array<{ last_doc_hash: string }>>`SELECT last_doc_hash
        FROM document_series WHERE tenant_id=${factory.tenantId}::uuid AND id=${configured.seriesId}::uuid`;
      expect(tail).toEqual([{ last_doc_hash: chain[99]!.sha256 }]);
    } finally {
      await factory.close();
    }
  });

  test("P0: Order408 reversal versus native issue admits exactly one complete winner", async () => {
    const factory = await PersistedIndiaFiscalSourceFactory.create(deploy!, RUNTIME_URL!);
    try {
      const [fixture] = await factory.createMany(1);
      if (!fixture) throw new Error("Order430 reversal-race source is unavailable");
      const configured = await database!.withTenantTransaction(factory.tenantId, (tx) =>
        new IndiaNativeFiscalSeriesConfigurationService().configure(tx, {
          tenantId: factory.tenantId, propertyNode: factory.propertyNode,
          supplierRegistrationId: factory.supplierRegistrationId, documentKind: "invoice", prefix: "I/2627/",
          envelope: createAuditEnvelope({ tenantId: factory.tenantId, propertyNode: factory.propertyNode,
            actorId: factory.actorId, operation: "document.series.configured", requestId: crypto.randomUUID() }),
        }));
      const events = new PostgresEventBus(runtime!);
      const idempotency = new PostgresIdempotency();
      const issueService = new IndiaNativeFiscalInvoiceIssuanceService();
      const reversalService = new IndiaFinalComponentTaxCorrectionService({ events, idempotency });
      const issue = database!.withTenantTransaction(factory.tenantId, (tx) => issueService.issue(tx, {
        ...selected(fixture), actorId: factory.actorId,
        idempotencyKey: `order430-reversal-race-issue-${fixture.journal_id}`,
        envelope: createAuditEnvelope({ tenantId: factory.tenantId, propertyNode: factory.propertyNode,
          actorId: factory.actorId, operation: "document.issued", requestId: crypto.randomUUID() }),
      }));
      const reversal = database!.withTenantTransaction(factory.tenantId, (tx) => reversalService.reverse(tx, {
        tenantId: factory.tenantId, propertyNode: factory.propertyNode, originalJournalId: fixture.journal_id,
        reason: "Order430 exact reversal-versus-issue arbitration",
        idempotencyKey: `order430-reversal-race-reverse-${fixture.journal_id}`,
        envelope: createAuditEnvelope({ tenantId: factory.tenantId, propertyNode: factory.propertyNode,
          actorId: factory.actorId, operation: "journal.posted", requestId: crypto.randomUUID() }),
      }));
      const settled = await Promise.allSettled([issue, reversal]);
      expect(settled.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
      expect(settled.filter(({ status }) => status === "rejected")).toHaveLength(1);

      const inventory = await deploy!<Array<{ next_no: string; documents: number; origins: number;
        reversals: number; issue_facts: number; issue_events: number; issue_keys: number;
        reversal_journals: number }>>`SELECT
          (SELECT next_no::text FROM document_series WHERE tenant_id=${factory.tenantId}::uuid
            AND id=${configured.seriesId}::uuid) next_no,
          (SELECT count(*)::int FROM document WHERE tenant_id=${factory.tenantId}::uuid
            AND series_id=${configured.seriesId}::uuid) documents,
          (SELECT count(*)::int FROM india_gst_native_fiscal_document_origin
            WHERE tenant_id=${factory.tenantId}::uuid AND source_journal_id=${fixture.journal_id}::uuid) origins,
          (SELECT count(*)::int FROM india_gst_final_component_tax_journal_reversal_binding
            WHERE tenant_id=${factory.tenantId}::uuid AND original_journal_id=${fixture.journal_id}::uuid) reversals,
          (SELECT count(*)::int FROM fact_log WHERE tenant_id=${factory.tenantId}::uuid
            AND entity_type='document' AND fact_type='issued') issue_facts,
          (SELECT count(*)::int FROM outbox WHERE tenant_id=${factory.tenantId}::uuid
            AND event_type='document.issued') issue_events,
          (SELECT count(*)::int FROM api_idempotency WHERE tenant_id=${factory.tenantId}::uuid
            AND operation='document.issued' AND completed_at IS NOT NULL) issue_keys,
          (SELECT count(*)::int FROM journal WHERE tenant_id=${factory.tenantId}::uuid
            AND reverses=${fixture.journal_id}::uuid) reversal_journals`;
      const row = inventory[0]!;
      expect(row.documents + row.reversals).toBe(1);
      expect(row.origins).toBe(row.documents);
      expect(row.next_no).toBe(row.documents === 1 ? "2" : "1");
      expect([row.issue_facts, row.issue_events, row.issue_keys]).toEqual([row.documents, row.documents, row.documents]);
      expect(row.reversal_journals).toBe(row.reversals);
    } finally {
      await factory.close();
    }
  });

  test("P0: native issue queued first excludes the later Order408 reversal without a partial reversal", async () => {
    const factory = await PersistedIndiaFiscalSourceFactory.create(deploy!, RUNTIME_URL!);
    const observer = new SQL(DEPLOY_URL!, { max: 3, prepare: false });
    let releaseSeries!: () => void;
    let reportSeriesLocked!: () => void;
    const seriesLocked = new Promise<void>((resolve) => { reportSeriesLocked = resolve; });
    const seriesRelease = new Promise<void>((resolve) => { releaseSeries = resolve; });
    let activeIssue: Promise<unknown> | undefined;
    let activeReversal: Promise<unknown> | undefined;
    let activeBlocker: Promise<unknown> | undefined;
    try {
      const [fixture] = await factory.createMany(1);
      if (!fixture) throw new Error("Order430 issue-first reversal source is unavailable");
      const configured = await database!.withTenantTransaction(factory.tenantId, (tx) =>
        new IndiaNativeFiscalSeriesConfigurationService().configure(tx, {
          tenantId: factory.tenantId, propertyNode: factory.propertyNode,
          supplierRegistrationId: factory.supplierRegistrationId, documentKind: "invoice", prefix: "I/2627/",
          envelope: createAuditEnvelope({ tenantId: factory.tenantId, propertyNode: factory.propertyNode,
            actorId: factory.actorId, operation: "document.series.configured", requestId: crypto.randomUUID() }),
        }));
      const blocker = observer.begin(async (tx) => {
        await tx`SELECT id FROM document_series WHERE tenant_id=${factory.tenantId}::uuid
          AND id=${configured.seriesId}::uuid FOR UPDATE`;
        reportSeriesLocked();
        await seriesRelease;
      });
      activeBlocker = blocker;
      await seriesLocked;

      const issueService = new IndiaNativeFiscalInvoiceIssuanceService();
      const issue = database!.withTenantTransaction(factory.tenantId, (tx) => issueService.issue(tx, {
        ...selected(fixture), actorId: factory.actorId,
        idempotencyKey: `order430-issue-first-${fixture.journal_id}`,
        envelope: createAuditEnvelope({ tenantId: factory.tenantId, propertyNode: factory.propertyNode,
          actorId: factory.actorId, operation: "document.issued", requestId: crypto.randomUUID() }),
      }));
      activeIssue = issue;
      await waitForRuntimeLock(observer, "commit_india_native_fiscal_invoice");
      const reversalService = new IndiaFinalComponentTaxCorrectionService({
        events: new PostgresEventBus(runtime!), idempotency: new PostgresIdempotency(),
      });
      const reversal = database!.withTenantTransaction(factory.tenantId, (tx) => reversalService.reverse(tx, {
        tenantId: factory.tenantId, propertyNode: factory.propertyNode, originalJournalId: fixture.journal_id,
        reason: "Order430 issue-first exact shared-lock arbitration",
        idempotencyKey: `order430-issue-first-reverse-${fixture.journal_id}`,
        envelope: createAuditEnvelope({ tenantId: factory.tenantId, propertyNode: factory.propertyNode,
          actorId: factory.actorId, operation: "journal.posted", requestId: crypto.randomUUID() }),
      }));
      activeReversal = reversal;
      await waitForRuntimeLockCount(observer, 2);
      releaseSeries();
      await blocker;
      const [issued, reversed] = await Promise.allSettled([issue, reversal]);
      expect(issued.status).toBe("fulfilled");
      expect(reversed.status).toBe("rejected");
      expect(await deploy!<Array<{ next_no: string; documents: number; origins: number; reversals: number;
        issue_facts: number; issue_events: number; issue_keys: number; reversal_journals: number;
        reversal_facts: number; reversal_events: number; reversal_keys: number }>>`SELECT
          (SELECT next_no::text FROM document_series WHERE tenant_id=${factory.tenantId}::uuid
            AND id=${configured.seriesId}::uuid) next_no,
          (SELECT count(*)::int FROM document WHERE tenant_id=${factory.tenantId}::uuid
            AND series_id=${configured.seriesId}::uuid) documents,
          (SELECT count(*)::int FROM india_gst_native_fiscal_document_origin WHERE tenant_id=${factory.tenantId}::uuid
            AND source_journal_id=${fixture.journal_id}::uuid) origins,
          (SELECT count(*)::int FROM india_gst_final_component_tax_journal_reversal_binding WHERE tenant_id=${factory.tenantId}::uuid
            AND original_journal_id=${fixture.journal_id}::uuid) reversals,
          (SELECT count(*)::int FROM fact_log WHERE tenant_id=${factory.tenantId}::uuid
            AND entity_type='document' AND fact_type='issued') issue_facts,
          (SELECT count(*)::int FROM outbox WHERE tenant_id=${factory.tenantId}::uuid AND event_type='document.issued') issue_events,
          (SELECT count(*)::int FROM api_idempotency WHERE tenant_id=${factory.tenantId}::uuid
            AND operation='document.issued' AND completed_at IS NOT NULL) issue_keys,
          (SELECT count(*)::int FROM journal WHERE tenant_id=${factory.tenantId}::uuid
            AND reverses=${fixture.journal_id}::uuid) reversal_journals,
          (SELECT count(*)::int FROM fact_log WHERE tenant_id=${factory.tenantId}::uuid
            AND entity_type='india_gst_accommodation_final_component_tax_journal_reversed') reversal_facts,
          (SELECT count(*)::int FROM outbox WHERE tenant_id=${factory.tenantId}::uuid
            AND event_type='india_gst.accommodation_final_component_tax_journal_reversed') reversal_events,
          (SELECT count(*)::int FROM api_idempotency WHERE tenant_id=${factory.tenantId}::uuid
            AND operation='financials.india-final-component-tax.reverse') reversal_keys`).toEqual([{
              next_no: "2", documents: 1, origins: 1, reversals: 0,
              issue_facts: 1, issue_events: 1, issue_keys: 1,
              reversal_journals: 0, reversal_facts: 0, reversal_events: 0, reversal_keys: 0,
            }]);
    } finally {
      releaseSeries?.();
      await Promise.allSettled([activeIssue, activeReversal, activeBlocker].filter(
        (value): value is Promise<unknown> => value !== undefined));
      await observer.close({ timeout: 0 });
      await factory.close();
    }
  });

  test("P0: audited business-day seal versus native issue is serial and leaves no partial loser artifacts", async () => {
    const factory = await PersistedIndiaFiscalSourceFactory.create(deploy!, RUNTIME_URL!);
    try {
      const [fixture] = await factory.createMany(1);
      if (!fixture) throw new Error("Order430 seal-race source is unavailable");
      const configured = await database!.withTenantTransaction(factory.tenantId, (tx) =>
        new IndiaNativeFiscalSeriesConfigurationService().configure(tx, {
          tenantId: factory.tenantId, propertyNode: factory.propertyNode,
          supplierRegistrationId: factory.supplierRegistrationId, documentKind: "invoice", prefix: "I/2627/",
          envelope: createAuditEnvelope({ tenantId: factory.tenantId, propertyNode: factory.propertyNode,
            actorId: factory.actorId, operation: "document.series.configured", requestId: crypto.randomUUID() }),
        }));
      const events = new PostgresEventBus(runtime!);
      const idempotency = new PostgresIdempotency();
      const issueService = new IndiaNativeFiscalInvoiceIssuanceService();
      const sealService = new BusinessDaySealService({ events, idempotency });
      const issue = database!.withTenantTransaction(factory.tenantId, (tx) => issueService.issue(tx, {
        ...selected(fixture), actorId: factory.actorId,
        idempotencyKey: `order430-seal-race-issue-${fixture.journal_id}`,
        envelope: createAuditEnvelope({ tenantId: factory.tenantId, propertyNode: factory.propertyNode,
          actorId: factory.actorId, operation: "document.issued", requestId: crypto.randomUUID() }),
      }));
      const seal = database!.withTenantTransaction(factory.tenantId, (tx) => sealService.seal(tx, {
        tenantId: factory.tenantId, propertyNode: factory.propertyNode,
        businessDate: (fixture.supplyInput as { supplyNature: { supplyDate: string } }).supplyNature.supplyDate,
        actorId: factory.actorId, idempotencyKey: `order430-seal-race-${fixture.journal_id}`,
        envelope: createAuditEnvelope({ tenantId: factory.tenantId, propertyNode: factory.propertyNode,
          actorId: factory.actorId, operation: "business_day.sealed", requestId: crypto.randomUUID() }),
      }));
      const [issued, sealed] = await Promise.allSettled([issue, seal]);
      expect(issued.status).toBe("fulfilled");

      const inventory = await deploy!<Array<{ next_no: string; documents: number; origins: number;
        issue_facts: number; issue_events: number; issue_keys: number; sealed: boolean;
        seal_facts: number; seal_events: number; seal_keys: number; journal_changed: number }>>`SELECT
          (SELECT next_no::text FROM document_series WHERE tenant_id=${factory.tenantId}::uuid
            AND id=${configured.seriesId}::uuid) next_no,
          (SELECT count(*)::int FROM document WHERE tenant_id=${factory.tenantId}::uuid
            AND series_id=${configured.seriesId}::uuid) documents,
          (SELECT count(*)::int FROM india_gst_native_fiscal_document_origin
            WHERE tenant_id=${factory.tenantId}::uuid AND source_journal_id=${fixture.journal_id}::uuid) origins,
          (SELECT count(*)::int FROM fact_log WHERE tenant_id=${factory.tenantId}::uuid
            AND entity_type='document' AND fact_type='issued') issue_facts,
          (SELECT count(*)::int FROM outbox WHERE tenant_id=${factory.tenantId}::uuid
            AND event_type='document.issued') issue_events,
          (SELECT count(*)::int FROM api_idempotency WHERE tenant_id=${factory.tenantId}::uuid
            AND operation='document.issued' AND completed_at IS NOT NULL) issue_keys,
          (SELECT sealed_at IS NOT NULL FROM business_day WHERE tenant_id=${factory.tenantId}::uuid
            AND property_node=${factory.propertyNode}::uuid) sealed,
          (SELECT count(*)::int FROM fact_log WHERE tenant_id=${factory.tenantId}::uuid
            AND entity_type='business_day' AND fact_type='business_day.sealed') seal_facts,
          (SELECT count(*)::int FROM outbox WHERE tenant_id=${factory.tenantId}::uuid
            AND event_type='business_day.sealed') seal_events,
          (SELECT count(*)::int FROM api_idempotency WHERE tenant_id=${factory.tenantId}::uuid
            AND operation='financials.business-day.seal' AND completed_at IS NOT NULL) seal_keys,
          (SELECT count(*)::int FROM journal WHERE tenant_id=${factory.tenantId}::uuid
            AND id=${fixture.journal_id}::uuid AND reverses IS NOT NULL) journal_changed`;
      const row = inventory[0]!;
      expect(row).toMatchObject({ next_no: "2", documents: 1, origins: 1,
        issue_facts: 1, issue_events: 1, issue_keys: 1, journal_changed: 0 });
      if (sealed.status === "fulfilled") {
        expect(row).toMatchObject({ sealed: true, seal_facts: 1, seal_events: 1, seal_keys: 1 });
        expect(new Date(sealed.value.sealedAt).getTime()).toBeLessThanOrEqual(
          new Date(issued.status === "fulfilled" ? issued.value.issuedAt : "").getTime());
      } else {
        expect(row).toMatchObject({ sealed: false, seal_facts: 0, seal_events: 0, seal_keys: 0 });
      }
    } finally {
      await factory.close();
    }
  });

  test("P0: native issue queued first permits a coherent audited seal without changing the sealed source journal", async () => {
    const factory = await PersistedIndiaFiscalSourceFactory.create(deploy!, RUNTIME_URL!);
    const observer = new SQL(DEPLOY_URL!, { max: 3, prepare: false });
    let releaseDocument!: () => void;
    let reportDocumentLocked!: () => void;
    const documentLocked = new Promise<void>((resolve) => { reportDocumentLocked = resolve; });
    const documentRelease = new Promise<void>((resolve) => { releaseDocument = resolve; });
    let activeIssue: Promise<unknown> | undefined;
    let activeSeal: Promise<unknown> | undefined;
    let activeBlocker: Promise<unknown> | undefined;
    try {
      const [fixture] = await factory.createMany(1);
      if (!fixture) throw new Error("Order430 issue-first seal source is unavailable");
      const configured = await database!.withTenantTransaction(factory.tenantId, (tx) =>
        new IndiaNativeFiscalSeriesConfigurationService().configure(tx, {
          tenantId: factory.tenantId, propertyNode: factory.propertyNode,
          supplierRegistrationId: factory.supplierRegistrationId, documentKind: "invoice", prefix: "I/2627/",
          envelope: createAuditEnvelope({ tenantId: factory.tenantId, propertyNode: factory.propertyNode,
            actorId: factory.actorId, operation: "document.series.configured", requestId: crypto.randomUUID() }),
        }));
      const blocker = observer.begin(async (tx) => {
        await tx`LOCK TABLE document IN ACCESS EXCLUSIVE MODE`;
        reportDocumentLocked();
        await documentRelease;
      });
      activeBlocker = blocker;
      await documentLocked;

      const issueService = new IndiaNativeFiscalInvoiceIssuanceService();
      const issue = database!.withTenantTransaction(factory.tenantId, (tx) => issueService.issue(tx, {
        ...selected(fixture), actorId: factory.actorId,
        idempotencyKey: `order430-issue-first-seal-${fixture.journal_id}`,
        envelope: createAuditEnvelope({ tenantId: factory.tenantId, propertyNode: factory.propertyNode,
          actorId: factory.actorId, operation: "document.issued", requestId: crypto.randomUUID() }),
      }));
      activeIssue = issue;
      await waitForRuntimeLock(observer, "commit_india_native_fiscal_invoice");
      const sealService = new BusinessDaySealService({
        events: new PostgresEventBus(runtime!), idempotency: new PostgresIdempotency(),
      });
      const seal = database!.withTenantTransaction(factory.tenantId, (tx) => sealService.seal(tx, {
        tenantId: factory.tenantId, propertyNode: factory.propertyNode,
        businessDate: (fixture.supplyInput as { supplyNature: { supplyDate: string } }).supplyNature.supplyDate,
        actorId: factory.actorId, idempotencyKey: `order430-issue-first-seal-loser-${fixture.journal_id}`,
        envelope: createAuditEnvelope({ tenantId: factory.tenantId, propertyNode: factory.propertyNode,
          actorId: factory.actorId, operation: "business_day.sealed", requestId: crypto.randomUUID() }),
      }));
      activeSeal = seal;
      await waitForRuntimeLock(observer, "seal_business_day_audited");
      releaseDocument();
      await blocker;
      const [issued, sealed] = await Promise.allSettled([issue, seal]);
      expect(issued.status).toBe("fulfilled");
      expect(sealed.status).toBe("fulfilled");
      if (issued.status !== "fulfilled" || sealed.status !== "fulfilled") {
        throw new Error("Order430 issue-first seal race did not return both coherent receipts");
      }
      expect(new Date(issued.value.issuedAt).getTime()).toBeLessThanOrEqual(new Date(sealed.value.sealedAt).getTime());
      expect(await deploy!<Array<{ next_no: string; documents: number; origins: number;
        issue_facts: number; issue_events: number; issue_keys: number; sealed: boolean;
        seal_facts: number; seal_events: number; seal_keys: number; journal_changed: number }>>`SELECT
          (SELECT next_no::text FROM document_series WHERE tenant_id=${factory.tenantId}::uuid
            AND id=${configured.seriesId}::uuid) next_no,
          (SELECT count(*)::int FROM document WHERE tenant_id=${factory.tenantId}::uuid
            AND series_id=${configured.seriesId}::uuid) documents,
          (SELECT count(*)::int FROM india_gst_native_fiscal_document_origin WHERE tenant_id=${factory.tenantId}::uuid
            AND source_journal_id=${fixture.journal_id}::uuid) origins,
          (SELECT count(*)::int FROM fact_log WHERE tenant_id=${factory.tenantId}::uuid
            AND entity_type='document' AND fact_type='issued') issue_facts,
          (SELECT count(*)::int FROM outbox WHERE tenant_id=${factory.tenantId}::uuid AND event_type='document.issued') issue_events,
          (SELECT count(*)::int FROM api_idempotency WHERE tenant_id=${factory.tenantId}::uuid
            AND operation='document.issued' AND completed_at IS NOT NULL) issue_keys,
          (SELECT sealed_at IS NOT NULL FROM business_day WHERE tenant_id=${factory.tenantId}::uuid
            AND property_node=${factory.propertyNode}::uuid) sealed,
          (SELECT count(*)::int FROM fact_log WHERE tenant_id=${factory.tenantId}::uuid
            AND entity_type='business_day' AND fact_type='business_day.sealed') seal_facts,
          (SELECT count(*)::int FROM outbox WHERE tenant_id=${factory.tenantId}::uuid AND event_type='business_day.sealed') seal_events,
          (SELECT count(*)::int FROM api_idempotency WHERE tenant_id=${factory.tenantId}::uuid
            AND operation='financials.business-day.seal') seal_keys,
          (SELECT count(*)::int FROM journal WHERE tenant_id=${factory.tenantId}::uuid
            AND id=${fixture.journal_id}::uuid AND reverses IS NOT NULL) journal_changed`).toEqual([{
              next_no: "2", documents: 1, origins: 1, issue_facts: 1, issue_events: 1, issue_keys: 1,
              sealed: true, seal_facts: 1, seal_events: 1, seal_keys: 1, journal_changed: 0,
            }]);
    } finally {
      releaseDocument?.();
      await Promise.allSettled([activeIssue, activeSeal, activeBlocker].filter(
        (value): value is Promise<unknown> => value !== undefined));
      await observer.close({ timeout: 0 });
      await factory.close();
    }
  });
});
