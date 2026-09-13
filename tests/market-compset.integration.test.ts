/** Q265 opt-in real PostgreSQL proof. No provisioning, migrations, cleanup or generic DB environment. */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";
import {
  MarketCompsetService, MARKET_COMPSET_READ_SCOPE, MARKET_COMPSET_WRITE_SCOPE,
  OVERTURE_REGIONAL_ARTIFACT_PROVENANCE,
  type MarketCompsetActor, type MarketRegionalAdmission, type MarketCompsetReference,
  type MarketCompsetPrincipal, type MarketCompsetPlanCommand,
} from "../src/contexts/distribution";
import { Database, ExtensionRegistry, PostgresEventBus, PostgresIdempotency, type Tx } from "../src/kernel";
import { seedMarketCompsetFixture, type MarketCompsetFixture } from "./helpers/market-compset-fixture";
import { readMarketCompsetIntegrationEnvironment } from "./helpers/market-compset-environment";

const enabled = process.env.YELLOW_REQUIRE_MARKET_COMPSET_INTEGRATION === "1";
// Pure validation of all three exact URLs precedes any connection. This import
// never calls the preparer's review/provision/migration operations.
const proofEnvironment = enabled ? readMarketCompsetIntegrationEnvironment() : null;
let deploy: SQL;
let runtime: SQL;
let database: Database;
let registry: ExtensionRegistry;
let events: PostgresEventBus;

const capturedAt = "2026-09-13T08:00:00.000Z";
const region = { minimumLatitude: 24, maximumLatitude: 25, minimumLongitude: 46, maximumLongitude: 47 };
const records = ["own", "comparator", "replacement"].map(recordId => ({
  provenance: { source: "overture", release: "2026-08-19.0", schema: "v1.18.0", recordId, attribution: "Synthetic Order472 evidence" },
  name: `Synthetic ${recordId}`, coordinates: { latitude: 24.7, longitude: 46.6 }, address: null,
  websites: ["https://example.com/"], categories: ["hotel"], operatingStatus: "unknown" as const,
}));
const admission: MarketRegionalAdmission = {
  identity: { logicalId: "synthetic", sha256: "a".repeat(64), byteLength: 1024, region },
  artifact: { records, rawRows: [], rejectedRows: [], fieldExclusions: [],
    completeness: { scope: "publisher-range-extract-all-places", status: "complete", sourceRows: 3, returnedRecords: 3, rejectedRows: 0 },
    source: { ...OVERTURE_REGIONAL_ARTIFACT_PROVENANCE, capturedAt, region, limit: 500, moreAvailable: false,
      query: "synthetic fixture", sourceObjects: [], tool: { duckdbVersion: "1.5.5", wheelSha256: "a".repeat(64), httpfsSha256: "b".repeat(64) } },
  },
};
function ref(sourceRecordId = "own"): MarketCompsetReference { return { logicalId: "synthetic", sha256: "a".repeat(64), sourceRecordId }; }
function command(expectedActiveVersion: number | null = null) {
  return { expectedActiveVersion, ownProperty: ref(), comparators: [ref("comparator")] };
}
function actor(fixture: MarketCompsetFixture, overrides: Partial<MarketCompsetActor> = {}): MarketCompsetActor {
  return { tenantId: fixture.tenantA, propertyNode: fixture.propertyA, actorId: fixture.actorA, requestId: crypto.randomUUID(),
    scopes: [MARKET_COMPSET_READ_SCOPE, MARKET_COMPSET_WRITE_SCOPE], ...overrides };
}
function service(idempotency = new PostgresIdempotency()) {
  return new MarketCompsetService({ registry, events, idempotency, admissions: [admission] });
}
function run<T>(tenantId: string, operation: (tx: Tx) => Promise<T>): Promise<T> {
  return database.withTenantTransaction(tenantId, async tx => {
    await tx.unsafe("SET LOCAL statement_timeout = '6000ms'");
    await tx.unsafe("SET LOCAL lock_timeout = '3000ms'");
    return operation(tx);
  });
}
function sqlState(error: unknown): unknown {
  return typeof error === "object" && error !== null
    ? Object.getOwnPropertyDescriptor(error, "errno")?.value ?? Object.getOwnPropertyDescriptor(error, "code")?.value : undefined;
}
async function counts(fixture: MarketCompsetFixture) {
  return (await deploy<Array<{ versions: number; active: number; drafts: number; facts: number; events: number; requests: number }>>`
    SELECT (SELECT count(*)::int FROM extension WHERE tenant_id=${fixture.tenantA}::uuid AND type='market_compset') AS versions,
      (SELECT count(*)::int FROM extension WHERE tenant_id=${fixture.tenantA}::uuid AND type='market_compset' AND status='active') AS active,
      (SELECT count(*)::int FROM extension WHERE tenant_id=${fixture.tenantA}::uuid AND type='market_compset' AND status='draft') AS drafts,
      (SELECT count(*)::int FROM fact_log WHERE tenant_id=${fixture.tenantA}::uuid AND fact_type LIKE 'market_compset.%') AS facts,
      (SELECT count(*)::int FROM outbox WHERE tenant_id=${fixture.tenantA}::uuid AND event_type='extension.activated') AS events,
      (SELECT count(*)::int FROM api_idempotency WHERE tenant_id=${fixture.tenantA}::uuid AND operation='distribution.market.compset.confirm') AS requests
  `)[0]!;
}
function latch() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}
function principal(fixture: MarketCompsetFixture, overrides: Partial<MarketCompsetPrincipal> = {}): MarketCompsetPrincipal {
  return { tenantId: fixture.tenantA, actorId: fixture.actorA, requestId: crypto.randomUUID(), scopes: [MARKET_COMPSET_READ_SCOPE], ...overrides };
}
function suggestionCommand() { return { snapshot: { logicalId: "synthetic", sha256: "a".repeat(64) }, target: { recordId: "own" } }; }
function previewCommand(expected: { extensionId: string; version: number }): MarketCompsetPlanCommand {
  return { expectedCompset: { extensionId: expected.extensionId, version: expected.version }, comparatorIndexes: [0], conditions: {
    destination: "Synthetic regional destination", lookaheadMonths: 3, selectedSources: ["booking-mcp", "trivago-mcp"],
    guests: { rooms: 1, adults: 2, childAges: [] }, pointOfSaleMarket: "SA", language: "en", lengthsOfStayNights: [1],
  } };
}
async function bridgeFingerprint(fixture: MarketCompsetFixture): Promise<string> {
  const rows = await deploy<Array<{ state: string }>>`
    SELECT jsonb_build_object(
      'extensions',(SELECT jsonb_agg(to_jsonb(e) ORDER BY to_jsonb(e)::text) FROM extension e WHERE tenant_id=${fixture.tenantA}::uuid),
      'facts',(SELECT jsonb_agg(to_jsonb(f) ORDER BY to_jsonb(f)::text) FROM fact_log f WHERE tenant_id=${fixture.tenantA}::uuid),
      'outbox',(SELECT jsonb_agg(to_jsonb(o) ORDER BY to_jsonb(o)::text) FROM outbox o WHERE tenant_id=${fixture.tenantA}::uuid),
      'idempotency',(SELECT jsonb_agg(to_jsonb(i) ORDER BY to_jsonb(i)::text) FROM api_idempotency i WHERE tenant_id=${fixture.tenantA}::uuid)
    )::text AS state
  `;
  if (rows.length !== 1 || !rows[0]) throw new Error("Synthetic market read fingerprint is unavailable");
  return rows[0].state;
}

describe.skipIf(!enabled).serial("Order472 dedicated native compset authority and persistence", () => {
  beforeAll(async () => {
    deploy = new SQL(proofEnvironment!.deployDatabaseUrl, { max: 4, prepare: false });
    runtime = new SQL(proofEnvironment!.runtimeDatabaseUrl, { max: 8, prepare: false });
    const target = (await deploy<Array<{ database_name: string; session_role: string; migrations: number; frontier: string }>>`
      SELECT current_database() AS database_name, session_user AS session_role,
        (SELECT count(*)::int FROM schema_migration) AS migrations,
        (SELECT max(filename) FROM schema_migration) AS frontier
    `)[0];
    expect(target).toEqual({ database_name: proofEnvironment!.database, session_role: "yellow_deploy", migrations: 92, frontier: "0092_market_compset_authority.sql" });
    database = new Database(runtime);
    registry = new ExtensionRegistry(runtime);
    events = new PostgresEventBus(runtime);
    // No fixtures or runtime calls are allowed until target and real role are checked.
    const roles = await runtime<Array<{ session_role: string; effective_role: string; superuser: boolean; bypass: boolean }>>`
      SELECT session_user AS session_role, current_user AS effective_role, rolsuper AS superuser, rolbypassrls AS bypass
      FROM pg_roles WHERE rolname = current_user
    `;
    expect(roles).toEqual([{ session_role: "yellow_runtime", effective_role: "yellow_runtime", superuser: false, bypass: false }]);
  });
  afterAll(async () => {
    // Connection closure only. Every UUID cohort and database is deliberately retained.
    if (runtime) await runtime.close();
    if (deploy) await deploy.close();
  });

  test("narrow definer ownership and privileges; no broad identity UPDATE or direct-role bypass", async () => {
    const [capability] = await deploy<Array<{ owner: string; definer: boolean; config: string[]; public_execute: boolean; app_execute: boolean; broad_update: boolean }>>`
      SELECT pg_get_userbyid(p.proowner) AS owner, p.prosecdef AS definer, p.proconfig AS config,
        EXISTS(SELECT 1 FROM aclexplode(p.proacl) WHERE grantee=0 AND privilege_type='EXECUTE') AS public_execute,
        has_function_privilege('app_role',p.oid,'EXECUTE') AS app_execute,
        has_table_privilege('app_role','public.app_user','UPDATE') AS broad_update
      FROM pg_proc p WHERE p.oid='public.assert_market_compset_authority(uuid,uuid,uuid,text)'::regprocedure
    `;
    expect(capability?.owner).toBe("yellow_owner"); expect(capability?.definer).toBe(true);
    expect(capability?.config).toEqual(["search_path=pg_catalog, public, pg_temp"]);
    expect(capability?.public_execute).toBe(false); expect(capability?.app_execute).toBe(true); expect(capability?.broad_update).toBe(false);
    const fixture = await seedMarketCompsetFixture(deploy, { label: "authority" });
    let denied: unknown;
    try {
      await runtime.begin(async tx => {
        await tx`SELECT set_config('app.tenant_id',${fixture.tenantA},true)`;
        await tx`SELECT public.assert_market_compset_authority(${fixture.tenantA}::uuid,${fixture.propertyA}::uuid,${fixture.actorA}::uuid,${MARKET_COMPSET_READ_SCOPE})`;
      });
    } catch (error) { denied = sqlState(error); }
    expect(denied).toBe("42501");
    await run(fixture.tenantA, async tx => {
      const role = await tx<Array<{ current_role: string; tenant_id: string }>>`SELECT current_user AS current_role,current_setting('app.tenant_id') AS tenant_id`;
      expect(role).toEqual([{ current_role: "app_role", tenant_id: fixture.tenantA }]);
      expect((await service().current(tx, actor(fixture))).ok).toBe(true);
    });
  }, 20_000);

  test("tenant, property, active actor, scope and read/write grants are enforced", async () => {
    const fixture = await seedMarketCompsetFixture(deploy, { label: "isolation" });
    const market = service();
    for (const denied of [
      actor(fixture, { scopes: [] }),
      actor(fixture, { actorId: fixture.actorB }),
      actor(fixture, { propertyNode: fixture.propertyB }),
      actor(fixture, { actorId: fixture.wrongPropertyActorA }),
      actor(fixture, { tenantId: fixture.tenantB }),
    ]) {
      const result = await run(fixture.tenantA, tx => market.current(tx, denied));
      expect(!result.ok && result.error.code).toBe("forbidden");
    }
    const readOnly = actor(fixture, { actorId: fixture.readerA });
    expect((await run(fixture.tenantA, tx => market.discovery(tx, readOnly))).ok).toBe(true);
    const deniedWrite = await run(fixture.tenantA, tx => market.confirm(tx, readOnly, command(), crypto.randomUUID()));
    expect(!deniedWrite.ok && deniedWrite.error.code).toBe("forbidden");
    await deploy`UPDATE app_user SET status='disabled' WHERE tenant_id=${fixture.tenantA}::uuid AND id=${fixture.actorA}::uuid`;
    const disabled = await run(fixture.tenantA, tx => market.current(tx, actor(fixture)));
    expect(!disabled.ok && disabled.error.code).toBe("forbidden");
    expect(await counts(fixture)).toEqual({ versions: 0, active: 0, drafts: 0, facts: 0, events: 0, requests: 0 });
  }, 20_000);

  test("immutable versions, exact replay, explicit empty clear and historical receipt", async () => {
    const fixture = await seedMarketCompsetFixture(deploy, { label: "versions" });
    const market = service(); const firstKey = crypto.randomUUID(); const identity = actor(fixture);
    const first = await run(fixture.tenantA, tx => market.confirm(tx, identity, command(), firstKey));
    expect(first.ok && first.value.version.version).toBe(1);
    const changed = await run(fixture.tenantA, tx => market.confirm(tx, actor(fixture), { ...command(1), comparators: [] }, crypto.randomUUID()));
    expect(changed.ok && changed.value.version.version).toBe(2);
    expect(changed.ok && changed.value.version.content.comparators).toEqual([]);
    const replay = await run(fixture.tenantA, tx => market.confirm(tx, actor(fixture), command(), firstKey));
    expect(replay.ok && replay.value.replayed).toBe(true);
    expect(replay.ok && first.ok && replay.value.version).toEqual(first.ok && first.value.version);
    const current = await run(fixture.tenantA, tx => market.current(tx, actor(fixture)));
    expect(current.ok && current.value?.version).toBe(2);
    expect(await counts(fixture)).toEqual({ versions: 2, active: 1, drafts: 0, facts: 5, events: 2, requests: 2 });
    const prior = await deploy<Array<{ content: unknown; status: string }>>`
      SELECT content,status FROM extension WHERE tenant_id=${fixture.tenantA}::uuid AND type='market_compset' AND version=1
    `;
    expect(prior[0]?.status).toBe("retired"); expect(prior[0]?.content).toEqual(first.ok && first.value.version.content);
    await run(fixture.tenantB, async tx => {
      expect(await tx<Array<{ id: string }>>`SELECT id FROM extension WHERE tenant_id=${fixture.tenantA}::uuid AND type='market_compset'`).toEqual([]);
    });
  }, 20_000);

  test("concurrent different keys and concurrent identical keys have exactly one effect", async () => {
    const fixture = await seedMarketCompsetFixture(deploy, { label: "concurrent" });
    const market = service();
    const first = await Promise.all([1, 2].map(() => run(fixture.tenantA,
      tx => market.confirm(tx, actor(fixture), command(), crypto.randomUUID()))));
    expect(first.filter(result => result.ok)).toHaveLength(1);
    expect(first.filter(result => !result.ok && result.error.code === "conflict")).toHaveLength(1);
    const sameKey = crypto.randomUUID();
    const repeated = await Promise.all([1, 2].map(() => run(fixture.tenantA,
      tx => market.confirm(tx, actor(fixture), command(1), sameKey))));
    expect(repeated.every(result => result.ok)).toBe(true);
    expect(repeated.filter(result => result.ok && result.value.replayed)).toHaveLength(1);
    expect(await counts(fixture)).toEqual({ versions: 2, active: 1, drafts: 0, facts: 5, events: 2, requests: 2 });
  }, 20_000);

  test("expired idempotency, altered body and altered actor cannot bypass expected version", async () => {
    const fixture = await seedMarketCompsetFixture(deploy, { label: "idempotency" });
    const key = crypto.randomUUID();
    const market = service(new PostgresIdempotency({ now: () => new Date("2026-09-13T00:00:00Z") }));
    expect((await run(fixture.tenantA, tx => market.confirm(tx, actor(fixture), command(), key))).ok).toBe(true);
    const altered = await run(fixture.tenantA, tx => market.confirm(tx, actor(fixture), { ...command(), comparators: [] }, key));
    expect(!altered.ok && altered.error.code).toBe("conflict");
    // Grant the existing read-only test actor exact write authority in this retained
    // synthetic cohort only, so the next denial proves actor-bound replay, not scope.
    await deploy`INSERT INTO role_permission(role_id,permission_code) VALUES (${fixture.readerRoleA}::uuid,${MARKET_COMPSET_WRITE_SCOPE})`;
    const other = await run(fixture.tenantA, tx => market.confirm(tx, actor(fixture, { actorId: fixture.readerA }), command(), key));
    expect(!other.ok && other.error.code).toBe("conflict");
    const expired = service(new PostgresIdempotency({ now: () => new Date("2026-09-15T00:00:00Z") }));
    const stale = await run(fixture.tenantA, tx => expired.confirm(tx, actor(fixture), command(), key));
    expect(!stale.ok && stale.error.code).toBe("conflict");
    expect(await counts(fixture)).toEqual({ versions: 1, active: 1, drafts: 0, facts: 2, events: 1, requests: 1 });
  }, 20_000);

  test("late actual outbox write then failure rolls back replacement within a committed caller transaction", async () => {
    const fixture = await seedMarketCompsetFixture(deploy, { label: "rollback" });
    const market = service();
    expect((await run(fixture.tenantA, tx => market.confirm(tx, actor(fixture), command(), crypto.randomUUID()))).ok).toBe(true);
    const before = await counts(fixture);
    const broken = new MarketCompsetService({ registry, admissions: [admission], events: {
      async publish(tx, event) { await events.publish(tx, event); throw new Error("synthetic late failure"); },
    } });
    await run(fixture.tenantA, async tx => {
      const failed = await broken.confirm(tx, actor(fixture), command(1), crypto.randomUUID());
      expect(!failed.ok && failed.error.code).toBe("unavailable");
      // A Result is returned normally. This outer transaction intentionally COMMITs.
      expect((await market.current(tx, actor(fixture))).ok).toBe(true);
      expect((await tx<Array<{ active: number }>>`SELECT count(*)::int AS active FROM extension WHERE type='market_compset' AND status='active'`)[0]?.active).toBe(1);
    });
    expect(await counts(fixture)).toEqual(before);
    const current = await run(fixture.tenantA, tx => market.current(tx, actor(fixture)));
    expect(current.ok && current.value?.version).toBe(1);
  }, 20_000);

  test("locks survive savepoint release, block permission withdrawal, and revoked replay is denied", async () => {
    const fixture = await seedMarketCompsetFixture(deploy, { label: "revoke" });
    const market = service(); const key = crypto.randomUUID(); const ready = latch(); const release = latch();
    const holding = run(fixture.tenantA, async tx => {
      const result = await market.confirm(tx, actor(fixture), command(), key);
      ready.resolve(); await release.promise; return result;
    });
    // A connection/BEGIN/command failure must also release the readiness waiter.
    // Handle this observation promise, then await the original below to rethrow.
    void holding.catch(() => ready.resolve());
    try {
      await ready.promise;
      let blocked: unknown;
      try {
        await deploy.begin(async tx => {
          await tx.unsafe("SET LOCAL lock_timeout = '250ms'");
          await tx`DELETE FROM role_permission WHERE role_id=${fixture.writerRoleA}::uuid AND permission_code=${MARKET_COMPSET_WRITE_SCOPE}`;
        });
      } catch (error) { blocked = sqlState(error); }
      expect(blocked).toBe("55P03");
      let actorBlocked: unknown;
      try {
        await deploy.begin(async tx => {
          await tx.unsafe("SET LOCAL lock_timeout = '250ms'");
          await tx`UPDATE app_user SET status='disabled' WHERE tenant_id=${fixture.tenantA}::uuid AND id=${fixture.actorA}::uuid`;
        });
      } catch (error) { actorBlocked = sqlState(error); }
      expect(actorBlocked).toBe("55P03");
    } finally { release.resolve(); }
    expect((await holding).ok).toBe(true);
    await deploy`DELETE FROM role_permission WHERE role_id=${fixture.writerRoleA}::uuid AND permission_code=${MARKET_COMPSET_WRITE_SCOPE}`;
    const replay = await run(fixture.tenantA, tx => market.confirm(tx, actor(fixture), command(), key));
    expect(!replay.ok && replay.error.code).toBe("forbidden");
    expect(await counts(fixture)).toEqual({ versions: 1, active: 1, drafts: 0, facts: 2, events: 1, requests: 1 });
  }, 20_000);

  test("disabled actor and inactive tenant cannot replay a saved receipt", async () => {
    for (const disable of ["actor", "tenant"] as const) {
      const fixture = await seedMarketCompsetFixture(deploy, { label: `disabled-${disable}` });
      const market = service(); const key = crypto.randomUUID();
      expect((await run(fixture.tenantA, tx => market.confirm(tx, actor(fixture), command(), key))).ok).toBe(true);
      if (disable === "actor") await deploy`UPDATE app_user SET status='disabled' WHERE tenant_id=${fixture.tenantA}::uuid AND id=${fixture.actorA}::uuid`;
      else await deploy`UPDATE tenant SET status='disabled' WHERE id=${fixture.tenantA}::uuid`;
      const replay = await run(fixture.tenantA, tx => market.confirm(tx, actor(fixture), command(), key));
      expect(!replay.ok && replay.error.code).toBe("forbidden");
      expect((await counts(fixture)).versions).toBe(1);
    }
  }, 20_000);

  test("validates persisted evidence on read and denies runtime content rewrite", async () => {
    const fixture = await seedMarketCompsetFixture(deploy, { label: "read-validation" });
    const market = service();
    const first = await run(fixture.tenantA, tx => market.confirm(tx, actor(fixture), command(), crypto.randomUUID()));
    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error("Synthetic confirmation prerequisite failed");
    let denied: unknown;
    try {
      await run(fixture.tenantA, async tx => {
        await tx`UPDATE extension SET content='{}'::jsonb WHERE tenant_id=${fixture.tenantA}::uuid AND id=${first.value.version.extensionId}::uuid`;
      });
    } catch (error) { denied = sqlState(error); }
    expect(denied).toBe("42501");
    // Deliberate corruption of this exact synthetic cohort by its deploy fixture
    // owner proves that a database JSON object is not blindly trusted on reads.
    await deploy`UPDATE extension SET content='{}'::jsonb
      WHERE tenant_id=${fixture.tenantA}::uuid AND id=${first.value.version.extensionId}::uuid AND type='market_compset'`;
    const current = await run(fixture.tenantA, tx => market.current(tx, actor(fixture)));
    expect(!current.ok && current.error.code).toBe("invalid_state");
    const replacement = await run(fixture.tenantA, tx => market.confirm(tx, actor(fixture), command(1), crypto.randomUUID()));
    expect(!replacement.ok && replacement.error.code).toBe("invalid_state");
    expect((await counts(fixture)).versions).toBe(1);
  }, 20_000);

  test("Q267 identity suggestions preserve exact evidence and deny foreign, disabled and revoked readers without writes", async () => {
    const fixture = await seedMarketCompsetFixture(deploy, { label: "q267-identity" });
    const market = service(); const before = await bridgeFingerprint(fixture);
    const reader = actor(fixture, { actorId: fixture.readerA, scopes: [MARKET_COMPSET_READ_SCOPE] });
    const exact = await run(fixture.tenantA, tx => market.suggestIdentity(tx, reader, suggestionCommand()));
    expect(exact.ok).toBe(true);
    if (!exact.ok) throw new Error("Synthetic suggestion prerequisite failed");
    expect(exact.value.requiresConfirmation).toBe(true); expect(exact.value.ambiguous).toBe(false);
    expect(exact.value.candidates.map(item => item.reference)).toEqual([ref()]);
    expect(exact.value.candidates[0]?.matchedBy).toEqual(["source-record-id"]);
    expect(exact.value.candidates[0]?.capturedAt).toBe(capturedAt);
    const ambiguous = await run(fixture.tenantA, tx => market.suggestIdentity(tx, reader,
      { ...suggestionCommand(), target: { publicUrl: "https://example.com/" } }));
    expect(ambiguous.ok && ambiguous.value.ambiguous).toBe(true);
    expect(ambiguous.ok && ambiguous.value.candidates.length).toBe(3);
    for (const actorId of [fixture.actorB, fixture.inactiveActorA, fixture.wrongPropertyActorA]) {
      const denied = await run(fixture.tenantA, tx => market.suggestIdentity(tx, actor(fixture, { actorId }), suggestionCommand()));
      expect(!denied.ok && denied.error.code).toBe("forbidden");
    }
    const substituted = await run(fixture.tenantA, tx => market.suggestIdentity(tx, reader,
      { ...suggestionCommand(), snapshot: { logicalId: "synthetic", sha256: "b".repeat(64) } }));
    expect(!substituted.ok && substituted.error.code).toBe("invalid_input");
    const unsafe = await run(fixture.tenantA, tx => market.suggestIdentity(tx, reader,
      { ...suggestionCommand(), target: { publicUrl: "https://example.com/?secret=do-not-retain" } }));
    expect(!unsafe.ok && unsafe.error.code).toBe("invalid_input");
    await deploy`DELETE FROM role_permission WHERE role_id=${fixture.readerRoleA}::uuid AND permission_code=${MARKET_COMPSET_READ_SCOPE}`;
    const revoked = await run(fixture.tenantA, tx => market.suggestIdentity(tx, reader, suggestionCommand()));
    expect(!revoked.ok && revoked.error.code).toBe("forbidden");
    expect(await bridgeFingerprint(fixture)).toBe(before);
  }, 20_000);

  test("Q267 saved preview uses persisted evidence, property metadata and real server clock with zero durable effects", async () => {
    const fixture = await seedMarketCompsetFixture(deploy, { label: "q267-preview" });
    const market = service();
    for (const [propertyNode, timezone, currency] of [[fixture.propertyA, "Asia/Riyadh", "SAR"], [fixture.propertyA2, "Asia/Dubai", "AED"]] as const) {
      const caller = actor(fixture, { propertyNode });
      const confirmation = await run(fixture.tenantA, tx => market.confirm(tx, caller, command(), crypto.randomUUID()));
      if (!confirmation.ok) throw new Error("Synthetic saved-preview prerequisite failed");
      const before = await bridgeFingerprint(fixture);
      // No current artifact is required to read/plan validated historical evidence.
      const historical = new MarketCompsetService({ registry, events, admissions: [] });
      const preview = await run(fixture.tenantA, tx => historical.previewPlan(tx, caller, previewCommand(confirmation.value.version)));
      expect(preview.ok).toBe(true); if (!preview.ok) throw new Error("Synthetic saved preview failed");
      expect(preview.value.previewOnly).toBe(true); expect(preview.value.executable).toBe(false);
      expect(preview.value.propertyTimezone).toBe(timezone); expect(preview.value.currency).toBe(currency);
      expect(preview.value.comparatorMapping.map(item => ({ index: item.index, reference: item.reference }))).toEqual([{ index: 0, reference: ref("comparator") }]);
      expect(preview.value.sample).toHaveLength(10); expect(preview.value.plan.selectedRequestCount).toBe(100);
      expect(preview.value.plan.deferredDueToCadenceCount).toBe(0);
      const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, calendar: "gregory", numberingSystem: "latn",
        year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(preview.value.plan.asOfUtc));
      const part = (type: string) => parts.find(item => item.type === type)?.value;
      expect(preview.value.plan.propertyLocalDate).toBe(`${part("year")}-${part("month")}-${part("day")}`);
      expect(Math.abs(Date.now() - Date.parse(preview.value.plan.asOfUtc))).toBeLessThan(60_000);
      expect(JSON.stringify(preview.value)).not.toContain('"key"'); expect(JSON.stringify(preview.value)).not.toContain('"batches"');
      const invalidIndex = await run(fixture.tenantA, tx => historical.previewPlan(tx, caller,
        { ...previewCommand(confirmation.value.version), comparatorIndexes: [1] }));
      expect(!invalidIndex.ok && invalidIndex.error.code).toBe("invalid_input");
      for (const comparatorIndexes of [[], Array.from({ length: 201 }, (_, index) => index)]) {
        const bounded = await run(fixture.tenantA, tx => historical.previewPlan(tx, caller,
          { ...previewCommand(confirmation.value.version), comparatorIndexes }));
        expect(!bounded.ok && bounded.error.code).toBe("invalid_input");
      }
      const stale = await run(fixture.tenantA, tx => historical.previewPlan(tx, caller,
        previewCommand({ extensionId: confirmation.value.version.extensionId, version: 2 })));
      expect(!stale.ok && stale.error.code).toBe("conflict");
      for (const actorId of [fixture.actorB, fixture.inactiveActorA]) {
        const denied = await run(fixture.tenantA, tx => historical.previewPlan(tx, actor(fixture, { propertyNode, actorId }), previewCommand(confirmation.value.version)));
        expect(!denied.ok && denied.error.code).toBe("forbidden");
      }
      expect(await bridgeFingerprint(fixture)).toBe(before);
    }
  }, 20_000);

  test("Q267 preview retains current-grant and exact version locks until transaction end", async () => {
    const fixture = await seedMarketCompsetFixture(deploy, { label: "q267-preview-lock" }); const market = service();
    const confirmed = await run(fixture.tenantA, tx => market.confirm(tx, actor(fixture), command(), crypto.randomUUID()));
    if (!confirmed.ok) throw new Error("Synthetic preview-lock prerequisite failed");
    const before = await bridgeFingerprint(fixture); const ready = latch(); const release = latch();
    const holding = run(fixture.tenantA, async tx => {
      const result = await market.previewPlan(tx, actor(fixture), previewCommand(confirmed.value.version));
      ready.resolve(); await release.promise; return result;
    });
    void holding.catch(() => ready.resolve());
    try {
      await ready.promise;
      let denied: unknown;
      try {
        await deploy.begin(async tx => {
          await tx.unsafe("SET LOCAL lock_timeout = '250ms'");
          await tx`DELETE FROM role_permission WHERE role_id=${fixture.writerRoleA}::uuid AND permission_code=${MARKET_COMPSET_READ_SCOPE}`;
        });
      } catch (error) { denied = sqlState(error); }
      expect(denied).toBe("55P03");
      const replacement = await run(fixture.tenantA, async tx => {
        await tx.unsafe("SET LOCAL lock_timeout = '250ms'");
        return market.confirm(tx, actor(fixture), command(1), crypto.randomUUID());
      });
      expect(replacement.ok).toBe(false);
      expect(await bridgeFingerprint(fixture)).toBe(before);
    } finally { release.resolve(); }
    expect((await holding).ok).toBe(true);
    const replacement = await run(fixture.tenantA, tx => market.confirm(tx, actor(fixture), command(1), crypto.randomUUID()));
    expect(replacement.ok).toBe(true);
    const stale = await run(fixture.tenantA, tx => market.previewPlan(tx, actor(fixture), previewCommand(confirmed.value.version)));
    expect(!stale.ok && stale.error.code).toBe("conflict");
    await deploy`DELETE FROM role_permission WHERE role_id=${fixture.writerRoleA}::uuid AND permission_code=${MARKET_COMPSET_READ_SCOPE}`;
    const revoked = await run(fixture.tenantA, tx => market.previewPlan(tx, actor(fixture), previewCommand(confirmed.value.version)));
    expect(!revoked.ok && revoked.error.code).toBe("forbidden");
  }, 20_000);

  test("Q267 market-only property discovery proves actual 50-plus-sentinel UUID pagination and scope confinement", async () => {
    const fixture = await seedMarketCompsetFixture(deploy, { label: "q267-properties", additionalProperties: 51 });
    const market = service(); const before = await bridgeFingerprint(fixture);
    const first = await run(fixture.tenantA, tx => market.properties(tx, principal(fixture), { cursor: null }));
    expect(first.ok).toBe(true); if (!first.ok) throw new Error("Synthetic property-page prerequisite failed");
    expect(first.value.properties).toHaveLength(50); expect(first.value.nextCursor).toHaveLength(48);
    const second = await run(fixture.tenantA, tx => market.properties(tx, principal(fixture), { cursor: first.value.nextCursor }));
    expect(second.ok).toBe(true); if (!second.ok) throw new Error("Synthetic second property page failed");
    expect(second.value.properties).toHaveLength(3); expect(second.value.nextCursor).toBeNull();
    const expected = [fixture.propertyA, fixture.propertyA2, ...fixture.additionalPropertyIds].sort();
    expect([...first.value.properties, ...second.value.properties].map(row => row.id)).toEqual(expected);
    const assigned = await deploy<Array<{ permission_code: string }>>`
      SELECT rp.permission_code FROM role_permission rp JOIN user_role ur ON ur.role_id=rp.role_id
      WHERE ur.tenant_id=${fixture.tenantA}::uuid AND ur.user_id=${fixture.actorA}::uuid ORDER BY rp.permission_code
    `;
    expect(assigned.map(row => row.permission_code)).toEqual([MARKET_COMPSET_READ_SCOPE, MARKET_COMPSET_WRITE_SCOPE]);
    for (const [actorId, propertyNode] of [[fixture.readerA, fixture.propertyA], [fixture.wrongPropertyActorA, fixture.propertyA2]] as const) {
      const result = await run(fixture.tenantA, tx => market.properties(tx, principal(fixture, { actorId }), { cursor: null }));
      expect(result.ok && result.value.properties.map(row => row.id)).toEqual([propertyNode]);
    }
    for (const actorId of [fixture.actorB, fixture.inactiveActorA]) {
      const result = await run(fixture.tenantA, tx => market.properties(tx, principal(fixture, { actorId }), { cursor: null }));
      expect(!result.ok && result.error.code).toBe("forbidden");
    }
    const ungranted = await run(fixture.tenantA, tx => market.properties(tx, principal(fixture, { actorId: fixture.ungrantedActorA }), { cursor: null }));
    expect(ungranted.ok && ungranted.value.properties).toEqual([]);
    const wrongTenant = await run(fixture.tenantB, tx => market.properties(tx, principal(fixture), { cursor: null }));
    expect(!wrongTenant.ok && wrongTenant.error.code).toBe("forbidden");
    const ownerConnection = await deploy.reserve();
    try {
      await ownerConnection.unsafe("BEGIN");
      await ownerConnection`SELECT set_config('app.tenant_id',${fixture.tenantA},true)`;
      const ownerBypass = await market.properties(ownerConnection, principal(fixture), { cursor: null });
      expect(!ownerBypass.ok && ownerBypass.error.code).toBe("forbidden");
    } finally {
      let rolledBack = false;
      try { await ownerConnection.unsafe("ROLLBACK"); rolledBack = true; }
      finally { if (rolledBack) ownerConnection.release(); else await ownerConnection.close({ timeout: 0 }); }
    }
    const scope = await run(fixture.tenantA, tx => market.properties(tx, principal(fixture, { scopes: [] }), { cursor: null }));
    expect(!scope.ok && scope.error.code).toBe("forbidden");
    await deploy`DELETE FROM role_permission WHERE role_id=${fixture.readerRoleA}::uuid AND permission_code=${MARKET_COMPSET_READ_SCOPE}`;
    const revoked = await run(fixture.tenantA, tx => market.properties(tx, principal(fixture, { actorId: fixture.readerA }), { cursor: null }));
    expect(revoked.ok && revoked.value.properties).toEqual([]);
    expect(await bridgeFingerprint(fixture)).toBe(before);
  }, 20_000);
});
