import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";
import { isAbsolute } from "node:path";

import { createApp } from "../src/app";
import { BearerTenantResolver, Hs256TokenSigner, LocalLoginService } from "../src/contexts/identity";
import { AvailabilityService } from "../src/contexts/inventory";
import { OperatorHttpApi } from "../src/http/operator";
import { Database } from "../src/kernel";
import {
  FISCAL_REVIEW_MANIFEST_SCHEMA,
  fiscalReviewSeedManifestJson,
  runFiscalReviewSeed,
  type FiscalReviewSeedManifest,
  type FiscalReviewSeedResult,
} from "../scripts/seed-fiscal-review";
import {
  REVIEW_APPROVER_ROLE_NAME,
  REVIEW_FISCAL_PERMISSIONS,
  REVIEW_ROLE_NAME,
} from "../scripts/seed-review";
import { SEED_TENANT } from "../scripts/seed";

const id = (tail: number): string => `00000000-0000-4000-8000-${String(tail).padStart(12, "0")}`;

test("Order 444 fiscal manifest is strict, bounded, secret-free and stable", () => {
  const manifest: FiscalReviewSeedManifest = Object.freeze({
    schema: FISCAL_REVIEW_MANIFEST_SCHEMA,
    tenantSlug: "yellow-demo",
    propertyNode: id(1),
    operatorEmail: "operator@yellow.local",
    issuedDocumentId: id(2),
    eligible: Object.freeze({ reservationId: id(3), folioId: id(4), recipientRegistrationId: id(5) }),
  });
  const first = fiscalReviewSeedManifestJson(manifest);
  expect(first).toBe(fiscalReviewSeedManifestJson(structuredClone(manifest)));
  expect(first.endsWith("\n")).toBeTrue();
  expect(new TextEncoder().encode(first).length).toBeLessThanOrEqual(32 * 1024);
  expect(JSON.parse(first)).toEqual(manifest);
  expect(first).not.toMatch(/password|token|database|postgres|credential/i);
  expect(() => fiscalReviewSeedManifestJson({ ...manifest, databaseUrl: "secret" } as never)).toThrow();
  expect(() => fiscalReviewSeedManifestJson({ ...manifest, propertyNode: "not-a-uuid" })).toThrow();

  let getterCalls = 0;
  const getter = Object.defineProperty({ ...manifest }, "issuedDocumentId", {
    enumerable: true,
    get: () => { getterCalls += 1; return id(2); },
  });
  expect(() => fiscalReviewSeedManifestJson(getter as FiscalReviewSeedManifest)).toThrow();
  expect(getterCalls).toBe(0);
  expect(() => fiscalReviewSeedManifestJson(new Proxy(manifest, {}) as FiscalReviewSeedManifest)).toThrow();
});

test("Order 444 fiscal seed rejects invalid connection options before database I/O", async () => {
  await expect(runFiscalReviewSeed({ deploymentDatabaseUrl: "", runtimeDatabaseUrl: "not-opened" }))
    .rejects.toThrow("fiscal review seed options are invalid");
});

test("Order 444 fiscal runtime seed has no test-factory or provider-receipt shortcut", async () => {
  const source = await Bun.file(new URL("../scripts/seed-fiscal-review.ts", import.meta.url)).text();
  expect(source).not.toMatch(/tests[\\/]fixtures|fake receipt|fiscal_submission\s*\(/i);
  expect(source).toContain("PartyProfileService");
  expect(source).toContain('ids.property, "party.created", await requestId("party")');
  expect(source).not.toContain('"profiles.party.create"');
  for (const operation of [
    "hold.created",
    "tax.attribution_recorded",
    "reservation.confirmed",
    "folio.opened",
    "journal.posted",
    "india_gst.accommodation_service_provision_recorded",
    "india_gst.accommodation_payment_receipt_recorded",
    "india_gst.accommodation_ordinary_regime_recorded",
    "india_gst.accommodation_final_valuation_recorded",
    "document.series.configured",
    "document.issued",
  ]) expect(source).toContain(`"${operation}"`);
  expect(source).toContain("ReservationCommitService");
  expect(source).toContain("FolioService");
  expect(source).toContain("ChargeService");
  expect(source).toContain("IndiaGstAccommodationSourceIntakeService");
  expect(source).toContain("IndiaGstAccommodationFinalValuationService");
  expect(source).toContain("IndiaNativeFiscalSeriesConfigurationService");
  expect(source).toContain("IndiaNativeFiscalOperatorReadService");
  expect(source).toContain("issueIndiaNativeFiscalInvoiceForOperator");
  expect(source).toContain("india_gst_accommodation_service_provision_snapshot");
  expect(source).toContain("retained fiscal review service evidence conflicts with its immutable stay period");
  expect(source).toContain("serviceProvisionDate: dates.serviceDate");
  expect(source).toContain("supplierBooksEntryDate: dates.serviceDate");
  expect(source).toContain("taxMinor: null, rateBasisPoints: 500");
  expect(source).toContain("supplierServiceStatusId");
  expect(source).toContain("[supplierIssueStatusId, issueDate]");
  expect(source).toContain("${dates.issueDate}::date");
});

const DEPLOY = process.env.YELLOW_DEPLOY_DATABASE_URL;
const RUNTIME = process.env.YELLOW_RUNTIME_DATABASE_URL;
const PASSWORD = process.env.YELLOW_REVIEW_SEED_PASSWORD ?? process.env.YELLOW_REVIEW_PASSWORD;
const APPROVER_PASSWORD = process.env.YELLOW_REVIEW_APPROVER_PASSWORD
  ?? (PASSWORD ? `${PASSWORD}-approver` : undefined);
const REQUIRE = process.env.YELLOW_REQUIRE_FISCAL_REVIEW_SEED === "1";
const TOKEN_SECRET = "yellow-order-444-fiscal-review-session-secret";
const FOREIGN_TENANT = "00000000-0000-4000-8000-000000000090";
const FOREIGN_PROPERTY = "00000000-0000-4000-8000-000000000091";
const FOREIGN_ACTOR = "00000000-0000-4000-8000-000000000092";
const FOREIGN_ROLE = "00000000-0000-4000-8000-000000000093";
if (REQUIRE && (!DEPLOY || !RUNTIME || !PASSWORD || !APPROVER_PASSWORD)) {
  throw new Error("Q209 fiscal review seed proof requires deploy/runtime URLs and both review passwords");
}

const databaseDescribe = DEPLOY && RUNTIME && PASSWORD && APPROVER_PASSWORD ? describe.serial : describe.skip;
let deploy: SQL;
let loginPool: SQL;
let database: Database;
let app: ReturnType<typeof createApp>;
let tokens: Hs256TokenSigner;
let first: FiscalReviewSeedResult;
let second: FiscalReviewSeedResult;
let beforeRerun: string;
let afterRerun: string;

async function immutableFiscalSnapshot(result: FiscalReviewSeedResult): Promise<string> {
  const rows = await deploy<Array<{ snapshot: string }>>`
    SELECT jsonb_build_object(
      'document',(
        SELECT jsonb_build_object(
          'id',document.id,'kind',document.kind,'doc_no',document.doc_no,
          'business_date',document.business_date,'issued_at',document.issued_at,
          'status',document.status,'prev_hash',document.prev_hash,
          'sha256',document.sha256,'content',document.content)
        FROM public.document
        WHERE document.tenant_id=${SEED_TENANT.id}::uuid
          AND document.id=${result.issuedDocumentId}::uuid),
      'origin',(
        SELECT to_jsonb(origin) FROM public.india_gst_native_fiscal_document_origin origin
        WHERE origin.tenant_id=${SEED_TENANT.id}::uuid
          AND origin.document_id=${result.issuedDocumentId}::uuid),
      'reservations',(
        SELECT jsonb_agg(to_jsonb(reservation) ORDER BY reservation.id)
        FROM public.reservation reservation
        WHERE reservation.tenant_id=${SEED_TENANT.id}::uuid
          AND reservation.id IN (${result.issuedReservationId}::uuid,${result.eligible.reservationId}::uuid)),
      'folios',(
        SELECT jsonb_agg(to_jsonb(folio) ORDER BY folio.id)
        FROM public.folio folio
        WHERE folio.tenant_id=${SEED_TENANT.id}::uuid
          AND folio.id IN (${result.issuedFolioId}::uuid,${result.eligible.folioId}::uuid)),
      'valuations',(
        SELECT jsonb_agg(to_jsonb(valuation) ORDER BY valuation.reservation_id)
        FROM public.india_gst_accommodation_final_valuation valuation
        WHERE valuation.tenant_id=${SEED_TENANT.id}::uuid
          AND valuation.reservation_id IN (
            ${result.issuedReservationId}::uuid,${result.eligible.reservationId}::uuid)),
      'serviceEvidence',(
        SELECT jsonb_agg(to_jsonb(service) ORDER BY service.reservation_id)
        FROM public.india_gst_accommodation_service_provision_snapshot service
        WHERE service.tenant_id=${SEED_TENANT.id}::uuid
          AND service.reservation_id IN (
            ${result.issuedReservationId}::uuid,${result.eligible.reservationId}::uuid)),
      'supplierStatuses',(
        SELECT jsonb_agg(to_jsonb(status) ORDER BY status.status_as_of,status.id)
        FROM public.india_gst_supplier_registration_status_snapshot status
        WHERE status.tenant_id=${SEED_TENANT.id}::uuid
          AND status.supplier_registration_id=(
            SELECT registration.id FROM public.property_fiscal_registration registration
            WHERE registration.tenant_id=${SEED_TENANT.id}::uuid
              AND registration.property_node=${result.propertyNode}::uuid
              AND registration.scheme='in-gstin')),
      'journals',(
        SELECT jsonb_agg(to_jsonb(journal) ORDER BY journal.id)
        FROM public.journal journal
        WHERE journal.tenant_id=${SEED_TENANT.id}::uuid
          AND journal.id IN (
            SELECT posting.journal_id FROM public.posting_line posting
            WHERE posting.tenant_id=${SEED_TENANT.id}::uuid
              AND posting.folio_id IN (${result.issuedFolioId}::uuid,${result.eligible.folioId}::uuid))),
      'postings',(
        SELECT jsonb_agg(to_jsonb(posting) ORDER BY posting.journal_id,posting.seq)
        FROM public.posting_line posting
        WHERE posting.tenant_id=${SEED_TENANT.id}::uuid
          AND posting.journal_id IN (
            SELECT scoped.journal_id FROM public.posting_line scoped
            WHERE scoped.tenant_id=${SEED_TENANT.id}::uuid
              AND scoped.folio_id IN (${result.issuedFolioId}::uuid,${result.eligible.folioId}::uuid))),
      'series',(
        SELECT jsonb_agg(to_jsonb(series) ORDER BY series.fiscal,series.kind,series.id)
        FROM public.document_series series
        WHERE series.tenant_id=${SEED_TENANT.id}::uuid
          AND series.property_node=${result.propertyNode}::uuid),
      'facts',(
        SELECT jsonb_agg(to_jsonb(fact) ORDER BY fact.recorded_at,fact.id)
        FROM public.fact_log fact
        WHERE fact.tenant_id=${SEED_TENANT.id}::uuid
          AND fact.actor_id=(SELECT id FROM public.app_user
            WHERE tenant_id=${SEED_TENANT.id}::uuid AND email='operator@yellow.local')),
      'outbox',(
        SELECT jsonb_agg(to_jsonb(event) ORDER BY event.seq)
        FROM public.outbox event
        WHERE event.tenant_id=${SEED_TENANT.id}::uuid
          AND event.property_node=${result.propertyNode}::uuid),
      'submissions',(
        SELECT coalesce(jsonb_agg(to_jsonb(submission) ORDER BY submission.id),'[]'::jsonb)
        FROM public.fiscal_submission submission
        WHERE submission.tenant_id=${SEED_TENANT.id}::uuid
          AND submission.document_id=${result.issuedDocumentId}::uuid)
    )::text AS snapshot`;
  if (rows.length !== 1 || !rows[0]) throw new Error("fiscal review snapshot returned no row");
  return rows[0].snapshot;
}

async function provisionForeignReadIdentity(): Promise<void> {
  await deploy.begin(async tx => {
    await tx`INSERT INTO public.tenant(id,slug,name,tier,residency,status)
      VALUES(${FOREIGN_TENANT}::uuid,'yellow-fiscal-foreign','Yellow Fiscal Foreign Test Tenant',
        'shared','IN','active') ON CONFLICT DO NOTHING`;
    await tx`INSERT INTO public.org_node(id,tenant_id,path,kind,name,timezone,currency,config)
      VALUES(${FOREIGN_PROPERTY}::uuid,${FOREIGN_TENANT}::uuid,'yellow_fiscal_foreign'::ltree,
        'property','Foreign fiscal isolation property','Asia/Kolkata','INR','{}'::jsonb)
      ON CONFLICT DO NOTHING`;
    await tx`INSERT INTO public.app_user(id,tenant_id,email,display_name,auth,status)
      VALUES(${FOREIGN_ACTOR}::uuid,${FOREIGN_TENANT}::uuid,'foreign-fiscal@yellow.local',
        'Foreign fiscal isolation operator','{}'::jsonb,'active') ON CONFLICT DO NOTHING`;
    await tx`INSERT INTO public.role(id,tenant_id,name)
      VALUES(${FOREIGN_ROLE}::uuid,${FOREIGN_TENANT}::uuid,'Foreign fiscal read isolation')
      ON CONFLICT DO NOTHING`;
    await tx`INSERT INTO public.role_permission(role_id,permission_code)
      VALUES(${FOREIGN_ROLE}::uuid,'tax-fiscal.documents:read') ON CONFLICT DO NOTHING`;
    await tx`INSERT INTO public.user_role(tenant_id,user_id,role_id,scope_node)
      VALUES(${FOREIGN_TENANT}::uuid,${FOREIGN_ACTOR}::uuid,${FOREIGN_ROLE}::uuid,${FOREIGN_PROPERTY}::uuid)
      ON CONFLICT DO NOTHING`;
    await tx`INSERT INTO public.tax_assignment(tenant_id,property_node,jurisdiction_key,effective)
      VALUES(${FOREIGN_TENANT}::uuid,${FOREIGN_PROPERTY}::uuid,'in-gst-lodging',daterange(NULL,NULL,'[)'))
      ON CONFLICT DO NOTHING`;
  });
  const exact = await deploy<Array<{ exact: boolean }>>`
    SELECT EXISTS(SELECT 1 FROM public.app_user WHERE id=${FOREIGN_ACTOR}::uuid
      AND tenant_id=${FOREIGN_TENANT}::uuid AND status='active')
      AND EXISTS(SELECT 1 FROM public.user_role WHERE tenant_id=${FOREIGN_TENANT}::uuid
        AND user_id=${FOREIGN_ACTOR}::uuid AND role_id=${FOREIGN_ROLE}::uuid
        AND scope_node=${FOREIGN_PROPERTY}::uuid)
      AND EXISTS(SELECT 1 FROM public.role_permission WHERE role_id=${FOREIGN_ROLE}::uuid
        AND permission_code='tax-fiscal.documents:read')
      AND EXISTS(SELECT 1 FROM public.tax_assignment WHERE tenant_id=${FOREIGN_TENANT}::uuid
        AND property_node=${FOREIGN_PROPERTY}::uuid AND jurisdiction_key='in-gst-lodging'
        AND effective=daterange(NULL,NULL,'[)')) AS exact`;
  if (exact.length !== 1 || exact[0]?.exact !== true) throw new Error("foreign fiscal identity is not canonical");
}

beforeAll(async () => {
  if (!DEPLOY || !RUNTIME) return;
  deploy = new SQL(DEPLOY, { max: 4, prepare: false });
  loginPool = new SQL(RUNTIME, { max: 4, prepare: false });
  database = Database.connect(RUNTIME, { maxConnections: 8, prepare: false });
  tokens = new Hs256TokenSigner(TOKEN_SECRET);
  app = createApp({ database, tenantResolver: new BearerTenantResolver(tokens),
    operatorApi: new OperatorHttpApi(new LocalLoginService(loginPool, tokens), new AvailabilityService()) });
  first = await runFiscalReviewSeed({ deploymentDatabaseUrl: DEPLOY, runtimeDatabaseUrl: RUNTIME,
    logger: () => undefined });
  beforeRerun = await immutableFiscalSnapshot(first);
  second = await runFiscalReviewSeed({ deploymentDatabaseUrl: DEPLOY, runtimeDatabaseUrl: RUNTIME,
    logger: () => undefined });
  afterRerun = await immutableFiscalSnapshot(second);
}, 60_000);

afterAll(async () => {
  if (database) await database.close();
  if (loginPool) await loginPool.close({ timeout: 0 });
  if (deploy) await deploy.close({ timeout: 0 });
});

databaseDescribe("Order 444 genuine fiscal review seed", () => {
  test("creates one issued source and one eligible source through the public production composition", () => {
    expect(first).toMatchObject({
      schema: FISCAL_REVIEW_MANIFEST_SCHEMA,
      tenantSlug: SEED_TENANT.slug,
      operatorEmail: "operator@yellow.local",
      eligibleKind: "ready",
    });
    expect(first.propertyNode).toMatch(/^[0-9a-f-]{36}$/);
    expect(first.issuedDocumentId).toMatch(/^[0-9a-f-]{36}$/);
    expect(first.issuedReservationId).not.toBe(first.eligible.reservationId);
    expect(first.issuedFolioId).not.toBe(first.eligible.folioId);
    const snapshot = JSON.parse(beforeRerun) as Record<string, unknown>;
    expect(snapshot.document).not.toBeNull();
    expect(snapshot.origin).not.toBeNull();
    expect(snapshot.reservations).toHaveLength(2);
    expect(snapshot.folios).toHaveLength(2);
    expect(snapshot.valuations).toHaveLength(2);
    expect(snapshot.serviceEvidence).toHaveLength(2);
    const document = snapshot.document as { business_date: string };
    const serviceEvidence = snapshot.serviceEvidence as Array<{ service_provision_date: string }>;
    for (const service of serviceEvidence) {
      expect(service.service_provision_date < document.business_date).toBeTrue();
    }
    const supplierStatuses = snapshot.supplierStatuses as Array<{ status_as_of: string }>;
    expect(supplierStatuses.map(status => status.status_as_of)).toEqual([
      serviceEvidence[0]!.service_provision_date,
      document.business_date,
    ]);
    expect((snapshot.journals as unknown[]).length).toBeGreaterThanOrEqual(2);
    expect(snapshot.postings).toHaveLength(8);
    expect((snapshot.series as unknown[]).length).toBeGreaterThanOrEqual(2);
    expect((snapshot.facts as unknown[]).length).toBeGreaterThan(0);
    expect((snapshot.outbox as unknown[]).length).toBeGreaterThan(0);
    expect(snapshot.submissions).toEqual([]);
  });

  test("retains every immutable fiscal and accounting byte on rerun", () => {
    expect(second).toEqual({ ...first, issuedReplayed: true });
    expect(afterRerun).toBe(beforeRerun);
  });

  test("keeps setup-only series authority separate from operator and checker", async () => {
    const fiscalCodes = REVIEW_FISCAL_PERMISSIONS.map(permission => permission.code);
    const rows = await deploy<Array<{ role_name: string; permission_code: string }>>`
      SELECT role.name AS role_name,role_permission.permission_code
      FROM public.role
      JOIN public.role_permission ON role_permission.role_id=role.id
      WHERE role.tenant_id=${SEED_TENANT.id}::uuid
        AND role.name IN (${REVIEW_ROLE_NAME},${REVIEW_APPROVER_ROLE_NAME},'Synthetic fiscal series setup')
        AND (role_permission.permission_code IN (
          ${fiscalCodes[0]},${fiscalCodes[1]},${fiscalCodes[2]},${fiscalCodes[3]},${fiscalCodes[4]})
          OR role_permission.permission_code='tax-fiscal.series:configure')
      ORDER BY role.name,role_permission.permission_code`;
    expect(rows).toEqual([
      ...fiscalCodes.sort().map(permission_code => ({ role_name: REVIEW_ROLE_NAME, permission_code })),
      { role_name: "Synthetic fiscal series setup", permission_code: "tax-fiscal.series:configure" },
    ]);
  });

  test("serves signed-session list, detail and readiness while denying checker and foreign authority", async () => {
    const login = async (email: string, password: string): Promise<string> => {
      const response = await app.handle(new Request("http://yellow.test/api/v1/auth/local:login", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenant: SEED_TENANT.slug, email, password }),
      }));
      expect(response.status).toBe(200);
      return ((await response.json()) as { accessToken: string }).accessToken;
    };
    const operatorToken = await login("operator@yellow.local", PASSWORD!);
    const checkerToken = await login("approver@yellow.local", APPROVER_PASSWORD!);
    const auth = { authorization: `Bearer ${operatorToken}`, "content-type": "application/json" };
    const dateRows = await deploy<Array<{ issued_from: string; issued_before: string }>>`
      SELECT document.business_date::text AS issued_from,(document.business_date+1)::text AS issued_before
      FROM public.document document WHERE document.tenant_id=${SEED_TENANT.id}::uuid
        AND document.id=${first.issuedDocumentId}::uuid`;
    const dates = dateRows[0]!;
    const list = await app.handle(new Request(
      `http://yellow.test/api/v1/properties/${first.propertyNode}/invoices/search`, {
        method: "POST", headers: auth, body: JSON.stringify({ issuedFrom: dates.issued_from,
          issuedBefore: dates.issued_before, query: "", limit: 50 }),
      },
    ));
    expect(list.status).toBe(200);
    expect(await list.json()).toMatchObject({ invoices: { matchingCount: "1",
      items: [{ documentId: first.issuedDocumentId, totalMinor: "10500" }] } });
    const detail = await app.handle(new Request(
      `http://yellow.test/api/v1/properties/${first.propertyNode}/invoices/${first.issuedDocumentId}`,
      { headers: { authorization: `Bearer ${operatorToken}` } },
    ));
    expect(detail.status).toBe(200);
    expect(await detail.json()).toMatchObject({ invoice: { documentId: first.issuedDocumentId,
      propertyNode: first.propertyNode, reservationId: first.issuedReservationId,
      folioId: first.issuedFolioId, documentSha256: expect.stringMatching(/^[0-9a-f]{64}$/) } });
    const readiness = await app.handle(new Request(
      `http://yellow.test/api/v1/properties/${first.propertyNode}/reservations/${first.eligible.reservationId}/folios/${first.eligible.folioId}/invoice-readiness`,
      { method: "POST", headers: auth, body: JSON.stringify({
        recipientRegistrationId: first.eligible.recipientRegistrationId, calendarEvidence: null,
      }) },
    ));
    expect(readiness.status).toBe(200);
    expect(await readiness.json()).toMatchObject({ readiness: { kind: "ready",
      confirmation: { buyer: { recipientRegistrationId: first.eligible.recipientRegistrationId } } } });

    const unauthenticated = await app.handle(new Request(
      `http://yellow.test/api/v1/properties/${first.propertyNode}/invoices/${first.issuedDocumentId}`,
    ));
    expect(unauthenticated.status).toBe(401);
    const checker = await app.handle(new Request(
      `http://yellow.test/api/v1/properties/${first.propertyNode}/invoices/${first.issuedDocumentId}`,
      { headers: { authorization: `Bearer ${checkerToken}` } },
    ));
    expect(checker.status).toBe(403);
    await provisionForeignReadIdentity();
    const foreignTenantToken = await tokens.issue({ userId: FOREIGN_ACTOR,
      tenantId: FOREIGN_TENANT, scopes: ["tax-fiscal.documents:read"] });
    const foreignOwnInvoices = await app.handle(new Request(
      `http://yellow.test/api/v1/properties/${FOREIGN_PROPERTY}/invoices/search`, {
        method: "POST",
        headers: { authorization: `Bearer ${foreignTenantToken}`, "content-type": "application/json" },
        body: JSON.stringify({ issuedFrom: dates.issued_from, issuedBefore: dates.issued_before,
          query: "", limit: 50 }),
      },
    ));
    expect(foreignOwnInvoices.status).toBe(200);
    expect(await foreignOwnInvoices.json()).toMatchObject({ invoices: { matchingCount: "0", items: [] } });
    const foreignTenant = await app.handle(new Request(
      `http://yellow.test/api/v1/properties/${first.propertyNode}/invoices/${first.issuedDocumentId}`,
      { headers: { authorization: `Bearer ${foreignTenantToken}` } },
    ));
    expect(foreignTenant.status).toBe(403);
  });
});

test("test harness does not accidentally designate a relative manifest path", () => {
  expect(isAbsolute("fiscal-review.json")).toBeFalse();
});
