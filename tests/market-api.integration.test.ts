/**
 * Q265 is deliberately opt-in.  This file never creates a database, applies a
 * migration, or cleans up a cohort: the guarded native preparer supplies the
 * one synthetic Order472 target and the fixture inserts UUID-namespaced rows.
 */
import { createHash } from "node:crypto";

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import { createApp } from "../src/app";
import {
  Database,
  ExtensionRegistry,
  PostgresEventBus,
  type TenantIdentity,
  type TenantResolver,
} from "../src/kernel";
import {
  MARKET_COMPSET_READ_SCOPE,
  MARKET_COMPSET_WRITE_SCOPE,
  MarketCompsetService,
  tryAdmitMarketRegionalArtifact,
  type MarketRegionalAdmission,
} from "../src/contexts/distribution";
import { OVERTURE_REGIONAL_TRUSTED_MANIFEST } from "../src/contexts/distribution/market-regional-admission";
import { MarketHttpApi } from "../src/http/market";
import { readMarketCompsetIntegrationEnvironment } from "./helpers/market-compset-environment";
import { seedMarketCompsetFixture, type MarketCompsetFixture } from "./helpers/market-compset-fixture";

const REQUIRE_INTEGRATION = process.env.YELLOW_REQUIRE_MARKET_COMPSET_INTEGRATION === "1";
// This shared parser is the authority boundary: no generic URL is accepted, and
// all three exact role/host/port/database URLs are checked before a pool exists.
const proofEnvironment = REQUIRE_INTEGRATION ? readMarketCompsetIntegrationEnvironment() : null;

const databaseDescribe = REQUIRE_INTEGRATION ? describe.serial : describe.skip;
const encoder = new TextEncoder();
const correlation = "00000000-0000-0000-0000-000000000472";

function admittedEvidence(): Promise<MarketRegionalAdmission> {
  const region = Object.freeze({ minimumLatitude: 24.5, maximumLatitude: 25, minimumLongitude: 46.5, maximumLongitude: 47 });
  const sourceObject = OVERTURE_REGIONAL_TRUSTED_MANIFEST.sourceObjects[0];
  const rows = [
    {
      id: "order472-http-own", name: "فندق الاختبار", longitude: 46.6753, latitude: 24.7136,
      addresses: null, websites: ["https://example.invalid/own"], categories: { primary: "hotel", alternate: null },
      operatingStatus: null, confidence: null, sources: null, sourceObject,
    },
    {
      id: "order472-http-comparator", name: "اختبار المنافس", longitude: 46.6761, latitude: 24.7141,
      addresses: null, websites: ["https://example.invalid/comparator"], categories: { primary: "hotel", alternate: null },
      operatingStatus: null, confidence: null, sources: null, sourceObject,
    },
  ];
  const bytes = encoder.encode(JSON.stringify({
    format: "yellow/overture-region/v2", coordinateMethod: "source-wkb-point", release: "2026-08-19.0",
    sourceSchema: "v1.18.0", method: "publisher-range-extract", capturedAt: "2026-09-13T08:00:00.000Z",
    region, limit: 500, moreAvailable: false, rows,
    query: "SELECT source WKB points FROM read_parquet(?) LIMIT 501",
    sourceObjects: OVERTURE_REGIONAL_TRUSTED_MANIFEST.sourceObjects,
    tool: { duckdbVersion: "1.5.5", wheelSha256: OVERTURE_REGIONAL_TRUSTED_MANIFEST.wheelSha256,
      httpfsSha256: OVERTURE_REGIONAL_TRUSTED_MANIFEST.httpfsSha256 },
  }));
  return tryAdmitMarketRegionalArtifact(bytes, {
    logicalId: "order472-http-synthetic", byteLength: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"), region,
  }).then((result) => {
    if (!result.ok) throw new Error("Order472 synthetic admission was rejected");
    return result.value;
  });
}

function request(path: string, actor: string, init: RequestInit = {}): Request {
  return new Request(`http://yellow.test${path}`, {
    ...init,
    headers: { "x-correlation-id": correlation, "x-order472-actor": actor, ...init.headers },
  });
}

async function previewCounts(pool: SQL, value: MarketCompsetFixture): Promise<Readonly<{ versions: number; facts: number; events: number; idempotency: number }>> {
  const row = (await pool<Array<{ versions: number; facts: number; events: number; idempotency: number }>>`
    SELECT
      (SELECT count(*)::int FROM extension WHERE tenant_id=${value.tenantA}::uuid AND type='market_compset') AS versions,
      (SELECT count(*)::int FROM fact_log WHERE tenant_id=${value.tenantA}::uuid AND fact_type LIKE 'market_compset.%') AS facts,
      (SELECT count(*)::int FROM outbox WHERE tenant_id=${value.tenantA}::uuid AND event_type='extension.activated') AS events,
      (SELECT count(*)::int FROM api_idempotency WHERE tenant_id=${value.tenantA}::uuid
        AND operation='distribution.market.compset.confirm') AS idempotency
  `)[0];
  if (!row) throw new Error("Order472 preview counts are unavailable");
  return Object.freeze(row);
}

databaseDescribe("Q265 Order472 market HTTP integration (dedicated synthetic target only)", () => {
  let deploy: SQL | undefined;
  let runtime: SQL | undefined;
  let fixture: MarketCompsetFixture;
  let app: ReturnType<typeof createApp>;
  let admission: MarketRegionalAdmission;

  beforeAll(async () => {
    if (proofEnvironment === null) throw new Error("Order472 market HTTP integration is not opted in");
    const deployPool = new SQL(proofEnvironment.deployDatabaseUrl, { max: 1, prepare: false });
    const runtimePool = new SQL(proofEnvironment.runtimeDatabaseUrl, { max: 8, prepare: false });
    deploy = deployPool;
    runtime = runtimePool;
    admission = await admittedEvidence();
    fixture = await seedMarketCompsetFixture(deployPool, { label: "market-http" });
    const identities = new Map<string, TenantIdentity>([
      [fixture.actorA, Object.freeze({ tenantId: fixture.tenantA, actorId: fixture.actorA,
        scopes: Object.freeze([MARKET_COMPSET_READ_SCOPE, MARKET_COMPSET_WRITE_SCOPE]) })],
      [fixture.readerA, Object.freeze({ tenantId: fixture.tenantA, actorId: fixture.readerA,
        scopes: Object.freeze([MARKET_COMPSET_READ_SCOPE]) })],
      [fixture.wrongPropertyActorA, Object.freeze({ tenantId: fixture.tenantA, actorId: fixture.wrongPropertyActorA,
        scopes: Object.freeze([MARKET_COMPSET_READ_SCOPE, MARKET_COMPSET_WRITE_SCOPE]) })],
      [fixture.actorB, Object.freeze({ tenantId: fixture.tenantB, actorId: fixture.actorB,
        scopes: Object.freeze([MARKET_COMPSET_READ_SCOPE, MARKET_COMPSET_WRITE_SCOPE]) })],
    ]);
    const resolver: TenantResolver = Object.freeze({
      async resolve(requestValue: Request): Promise<TenantIdentity | null> {
        return identities.get(requestValue.headers.get("x-order472-actor") ?? "") ?? null;
      },
    });
    const database = new Database(runtimePool);
    const service = new MarketCompsetService({
      registry: new ExtensionRegistry(runtimePool), events: new PostgresEventBus(runtimePool), admissions: Object.freeze([admission]),
    });
    app = createApp({ database, tenantResolver: resolver, marketApi: new MarketHttpApi(service) });
  });

  afterAll(async () => {
    await Promise.all([runtime?.close({ timeout: 0 }), deploy?.close({ timeout: 0 })]);
  });

  test("uses the mounted routes, current authority, exact references, and durable replay", async () => {
    const records = admission.artifact.records;
    const own = records[0];
    const comparator = records[1];
    if (!own || !comparator) throw new Error("Order472 synthetic admission lacks test records");
    const command = Object.freeze({
      expectedActiveVersion: null,
      ownProperty: Object.freeze({ logicalId: admission.identity.logicalId, sha256: admission.identity.sha256,
        sourceRecordId: own.provenance.recordId }),
      comparators: Object.freeze([Object.freeze({ logicalId: admission.identity.logicalId, sha256: admission.identity.sha256,
        sourceRecordId: comparator.provenance.recordId })]),
    });
    const base = `/api/v1/properties/${fixture.propertyA}/market`;
    const discovery = await app.handle(request(`${base}/discovery`, fixture.actorA));
    expect(discovery.status).toBe(200);
    expect((await discovery.json() as { discovery: { snapshots: readonly unknown[] } }).discovery.snapshots).toHaveLength(1);
    expect(discovery.headers.get("x-correlation-id")).toBe(correlation);

    const initial = await app.handle(request(`${base}/compset`, fixture.actorA));
    expect(initial.status).toBe(200);
    expect(await initial.json()).toEqual({ compset: null });

    const headers = { "content-type": "application/json", "idempotency-key": "order472-market-http-key-001" };
    const confirmed = await app.handle(request(`${base}/compset/confirm`, fixture.actorA, {
      method: "POST", headers, body: JSON.stringify(command),
    }));
    expect(confirmed.status).toBe(201);
    expect(confirmed.headers.get("idempotency-replayed")).toBe("false");
    const confirmation = await confirmed.json() as { confirmation: { version: { extensionId: string; version: number } } };
    expect(confirmation.confirmation.version.version).toBe(1);

    const replay = await app.handle(request(`${base}/compset/confirm`, fixture.actorA, {
      method: "POST", headers, body: JSON.stringify(command),
    }));
    expect(replay.status).toBe(200);
    expect(replay.headers.get("idempotency-replayed")).toBe("true");
    expect((await replay.json() as { confirmation: { version: { extensionId: string } } }).confirmation.version.extensionId)
      .toBe(confirmation.confirmation.version.extensionId);

    const current = await app.handle(request(`${base}/compset`, fixture.actorA));
    expect(current.status).toBe(200);
    expect((await current.json() as { compset: { version: number } }).compset.version).toBe(1);

    const identity = await app.handle(request(`${base}/identity/suggest`, fixture.actorA, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        snapshot: { logicalId: admission.identity.logicalId, sha256: admission.identity.sha256 },
        target: { recordId: own.provenance.recordId },
      }),
    }));
    expect(identity.status).toBe(200);
    const suggestions = await identity.json() as { suggestions: { requiresConfirmation: boolean; candidates: readonly { reference: { sourceRecordId: string } }[] } };
    expect(suggestions.suggestions.requiresConfirmation).toBe(true);
    expect(suggestions.suggestions.candidates.map(candidate => candidate.reference.sourceRecordId)).toEqual([own.provenance.recordId]);

    const deployPool = deploy;
    if (!deployPool) throw new Error("Order472 deploy pool is unavailable");
    const beforePreview = await previewCounts(deployPool, fixture);
    const preview = await app.handle(request(`${base}/plan/preview`, fixture.actorA, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        expectedCompset: { extensionId: confirmation.confirmation.version.extensionId, version: 1 },
        comparatorIndexes: [0],
        conditions: { destination: "DXB", lookaheadMonths: 3, selectedSources: ["booking-mcp"],
          guests: { rooms: 1, adults: 2, childAges: [] }, pointOfSaleMarket: "AE", language: "en", lengthsOfStayNights: [1] },
      }),
    }));
    expect(preview.status).toBe(200);
    const previewBody = await preview.json() as { preview: { previewOnly: boolean; executable: boolean; compset: { extensionId: string; version: number }; comparatorMapping: readonly { token: string; index: number; reference: { logicalId: string; sha256: string; sourceRecordId: string } }[]; sample: readonly unknown[] } };
    expect(previewBody.preview.previewOnly).toBe(true);
    expect(previewBody.preview.executable).toBe(false);
    expect(previewBody.preview.compset).toEqual({ extensionId: confirmation.confirmation.version.extensionId, version: 1 });
    expect(previewBody.preview.comparatorMapping).toEqual([{ index: 0, reference: { logicalId: admission.identity.logicalId, sha256: admission.identity.sha256, sourceRecordId: comparator.provenance.recordId }, token: expect.any(String) }]);
    expect(previewBody.preview.sample.length).toBeLessThanOrEqual(10);
    expect(await previewCounts(deployPool, fixture)).toEqual(beforePreview);

    const marketProperties = await app.handle(request("/api/v1/me/market-properties", fixture.actorA));
    expect(marketProperties.status).toBe(200);
    const page = await marketProperties.json() as { marketProperties: { properties: readonly { id: string }[]; nextCursor: string | null } };
    expect(page.marketProperties.properties.map(property => property.id).sort()).toEqual([fixture.propertyA, fixture.propertyA2].sort());
    expect(page.marketProperties.nextCursor).toBeNull();
  });

  test("denies writes before or inside current property authority without leaking a cross-tenant set", async () => {
    const base = `/api/v1/properties/${fixture.propertyA}/market`;
    const body = JSON.stringify({ expectedActiveVersion: null, ownProperty: {}, comparators: [] });
    const headers = { "content-type": "application/json", "idempotency-key": "order472-market-http-key-002" };
    const reader = await app.handle(request(`${base}/compset/confirm`, fixture.readerA, { method: "POST", headers, body }));
    expect(reader.status).toBe(403);
    const wrongProperty = await app.handle(request(`${base}/compset`, fixture.wrongPropertyActorA));
    expect(wrongProperty.status).toBe(403);
    const foreignTenant = await app.handle(request(`${base}/compset`, fixture.actorB));
    expect(foreignTenant.status).toBe(403);
    for (const reply of [wrongProperty, foreignTenant]) {
      expect((await reply.json() as { detail: string }).detail).toBe("Market access is not granted");
    }
  });

  test("lists only current market-read properties and keeps identity/preview strict and read-only", async () => {
    const page = await app.handle(request("/api/v1/me/market-properties", fixture.readerA));
    expect(page.status).toBe(200);
    expect((await page.json() as { marketProperties: { properties: readonly { id: string }[] } }).marketProperties.properties.map(property => property.id))
      .toEqual([fixture.propertyA]);
    const base = `/api/v1/properties/${fixture.propertyA}/market`;
    const invalidIdentity = await app.handle(request(`${base}/identity/suggest`, fixture.readerA, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        snapshot: { logicalId: admission.identity.logicalId, sha256: admission.identity.sha256 }, target: { publicUrl: "https://example.invalid/path?secret=1" },
      }),
    }));
    expect(invalidIdentity.status).toBe(400);
    const invalidPreview = await app.handle(request(`${base}/plan/preview`, fixture.readerA, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        expectedCompset: { extensionId: "00000000-0000-0000-0000-000000000001", version: 1 }, comparatorIndexes: [],
        conditions: { destination: "DXB", lookaheadMonths: 3, selectedSources: ["booking-mcp"],
          guests: { rooms: 1, adults: 2, childAges: [] }, pointOfSaleMarket: "AE", language: "en", lengthsOfStayNights: [1] },
      }),
    }));
    expect(invalidPreview.status).toBe(400);
  });
});
