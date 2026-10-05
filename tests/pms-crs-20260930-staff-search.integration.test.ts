import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL, type ReservedSQL } from "bun";

import { createApp } from "../src/app";
import {
  BearerTenantResolver,
  Hs256TokenSigner,
  LocalLoginService,
} from "../src/contexts/identity";
import {
  AvailabilityProjectionService,
  AvailabilityService,
} from "../src/contexts/inventory";
import {
  RateConfigurationService,
  RatePublicationService,
  RateQuoteService,
} from "../src/contexts/rates";
import {
  ReservationOfferSearchService,
  type ReservationOfferSearchInput,
} from "../src/contexts/reservations";
import { TaxJurisdictionResolutionService } from "../src/contexts/tax-fiscal";
import { OperatorHttpApi } from "../src/http/operator";
import {
  ApprovalService,
  Database,
  ExtensionRegistry,
  PostgresEventBus,
  PostgresIdempotency,
  type TenantRequestContext,
} from "../src/kernel";
import { runReviewSeed } from "../scripts/seed-review";
import { runSeed, SEED_PROPERTY, SEED_TENANT } from "../scripts/seed";

const DEPLOY_URL = process.env.YELLOW_PMS_CRS_DEPLOY_URL;
const RUNTIME_URL = process.env.YELLOW_PMS_CRS_RUNTIME_URL;
const REQUIRED = process.env.YELLOW_REQUIRE_PMS_CRS_SEARCH === "1";
const SCOPE = "inventory.availability:read";
const TOKEN_SECRET = "«REDACTED-SECRET»";
const SYNTHETIC_PASSWORD = "disposable-crs-review-fixture-password-2026";
const SYNTHETIC_APPROVER_PASSWORD = "disposable-crs-approver-fixture-password-2026";
const FOREIGN_TENANT = "8b904b51-f411-4f8a-9f22-efc8d580cc01";
const FOREIGN_PROPERTY = "8b904b51-f411-4f8a-9f22-efc8d580cc02";
const BRAND_NODE = "8b904b51-f411-4f8a-9f22-efc8d580cc03";
const PEER_PROPERTY = "8b904b51-f411-4f8a-9f22-efc8d580cc04";
const BRAND_ACTOR = "8b904b51-f411-4f8a-9f22-efc8d580cc05";
const EXACT_ACTOR = "8b904b51-f411-4f8a-9f22-efc8d580cc06";
const NO_GRANT_ACTOR = "8b904b51-f411-4f8a-9f22-efc8d580cc07";
const FOREIGN_ACTOR = "8b904b51-f411-4f8a-9f22-efc8d580cc08";
const REVOKE_ACTOR = "8b904b51-f411-4f8a-9f22-efc8d580cc0d";
const BRAND_ROLE = "8b904b51-f411-4f8a-9f22-efc8d580cc09";
const EXACT_ROLE = "8b904b51-f411-4f8a-9f22-efc8d580cc0a";
const REVOKE_ROLE = "8b904b51-f411-4f8a-9f22-efc8d580cc0b";
const FOREIGN_ROLE = "8b904b51-f411-4f8a-9f22-efc8d580cc0c";

if (REQUIRED && (!DEPLOY_URL || !RUNTIME_URL)) {
  throw new Error("YELLOW_PMS_CRS_DEPLOY_URL and YELLOW_PMS_CRS_RUNTIME_URL are required for the CRS PostgreSQL proof");
}

const databaseDescribe = DEPLOY_URL && RUNTIME_URL ? describe.serial : describe.skip;

let deployment: SQL | undefined;
let runtimeProbe: SQL | undefined;
let runtimeDatabase: Database | undefined;
let loginPool: SQL | undefined;
let eventPool: SQL | undefined;
let registryPool: SQL | undefined;
let offerService: ReservationOfferSearchService | undefined;
let operator: OperatorHttpApi | undefined;
let app: ReturnType<typeof createApp> | undefined;
let signer: Hs256TokenSigner | undefined;
let brandToken = "";
let exactToken = "";
let revokeToken = "";
let noScopeToken = "";
let noGrantToken = "";
let foreignToken = "";
let offerCalls = 0;
let stayStart = new Date(0);
let stayEnd = new Date(0);
let peerTimezone = "Asia/Kathmandu";
let seedPropertyTimezone = "UTC";
let seedPropertyName: string = SEED_PROPERTY.name;

interface AppRoleProbe {
  readonly session_user: string;
  readonly can_login: boolean;
  readonly superuser: boolean;
  readonly bypass_rls: boolean;
  readonly app_role_member: boolean;
}

interface PropertyRow {
  readonly id: string;
  readonly name: string;
  readonly timezone: string;
  readonly currency: string | null;
}

interface RuntimeContextProbe {
  readonly session_user: string;
  readonly current_user: string;
  readonly tenant_id: string | null;
  readonly backend_pid: number;
  readonly own_property_count: number;
  readonly foreign_property_count: number;
}

interface NormalizedDatabaseTarget {
  readonly host: string;
  readonly port: number;
  readonly database: string;
}

interface LiveDatabaseIdentity {
  readonly database_name: string;
  readonly database_oid: string;
  readonly server_address: string | null;
  readonly server_port: number | null;
  readonly postmaster_start: string;
}

function safeSqlState(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const value = Reflect.get(error, "errno");
  return typeof value === "string" && /^[0-9A-Z]{5}$/.test(value) ? value : undefined;
}

function safeFailure(prefix: string, error: unknown): Error {
  const state = safeSqlState(error);
  let detail = error instanceof Error ? error.message : "unexpected failure";
  for (const secret of [DEPLOY_URL, RUNTIME_URL, TOKEN_SECRET, SYNTHETIC_PASSWORD, SYNTHETIC_APPROVER_PASSWORD,
    brandToken, exactToken, revokeToken, noScopeToken, noGrantToken, foreignToken]) {
    if (secret) detail = detail.split(secret).join("[redacted]");
  }
  detail = detail.replace(/postgres(?:ql)?:\/\/[^\s'"<>]+/gi, "[redacted PostgreSQL URL]");
  detail = detail.replace(/(password|token|secret)\s*[=:]\s*[^\s,;]+/gi, "$1=[redacted]");
  return new Error(`${prefix}${state ? ` (SQLSTATE ${state})` : ""}: ${detail.slice(0, 240)}`);
}

function checkedDatabaseName(url: string): string {
  let name: string;
  try {
    name = decodeURIComponent(new URL(url).pathname.replace(/^\//, ""));
  } catch {
    throw new Error("CRS proof database URL is malformed");
  }
  if (!(name.startsWith("yellow_crs") || name.endsWith("proof"))) {
    throw new Error("CRS PostgreSQL proof requires a disposable yellow_crs or proof database");
  }
  return name;
}

function normalizeDatabaseTarget(url: string): NormalizedDatabaseTarget {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("CRS proof database URL is malformed");
  }
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new Error("CRS proof database URL protocol is invalid");
  }
  const configuredHost = parsed.searchParams.get("host") || parsed.hostname;
  const configuredPort = parsed.searchParams.get("port") || parsed.port || "5432";
  const port = Number(configuredPort);
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (!configuredHost || !Number.isInteger(port) || port < 1 || port > 65_535 || !database) {
    throw new Error("CRS proof database target is incomplete");
  }
  return {
    host: configuredHost.trim().toLowerCase().replace(/\.$/, ""),
    port,
    database,
  };
}

function assertMatchingDatabaseTargets(deployUrl: string, runtimeUrl: string): void {
  const deploy = normalizeDatabaseTarget(deployUrl);
  const runtime = normalizeDatabaseTarget(runtimeUrl);
  if (deploy.host !== runtime.host || deploy.port !== runtime.port || deploy.database !== runtime.database) {
    throw new Error("CRS deployment and runtime URLs do not identify the same PostgreSQL target");
  }
  if (!(deploy.database.startsWith("yellow_crs") || deploy.database.endsWith("proof"))) {
    throw new Error("CRS PostgreSQL proof requires a disposable yellow_crs or proof database");
  }
}

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function canonicalSearch(): Record<string, unknown> {
  return {
    stay: { from: stayStart.toISOString(), to: stayEnd.toISOString() },
    party: { adults: 1, children: [] },
    channel: "direct",
  };
}

function batchBody(propertyIds: readonly string[]): Record<string, unknown> {
  return { searches: propertyIds.map((property_id) => ({ property_id, search: canonicalSearch() })) };
}

function httpRequest(body: unknown, token = brandToken): Request {
  return new Request("http://yellow.test/api/v1/crs/availability:search", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
}

function issueToken(actorId: string, tenantId: string = SEED_TENANT.id, scopes: readonly string[] = [SCOPE]): Promise<string> {
  if (!signer) throw new Error("CRS proof token signer is unavailable");
  return signer.issue({ userId: actorId, tenantId, scopes });
}

function getDependencies(): {
  readonly deployment: SQL;
  readonly runtimeProbe: SQL;
  readonly runtimeDatabase: Database;
  readonly service: ReservationOfferSearchService;
  readonly operator: OperatorHttpApi;
  readonly app: ReturnType<typeof createApp>;
} {
  if (!deployment || !runtimeProbe || !runtimeDatabase || !offerService || !operator || !app) {
    throw new Error("CRS PostgreSQL proof fixtures are unavailable");
  }
  return { deployment, runtimeProbe, runtimeDatabase, service: offerService, operator, app };
}

async function provisionSyntheticIdentity(): Promise<void> {
  const db = deployment;
  if (!db) throw new Error("CRS deployment database is unavailable");

  const permission = await db<{ present: boolean }[]>`
    SELECT EXISTS (SELECT 1 FROM permission WHERE code = ${SCOPE}) AS present
  `;
  if (permission[0]?.present !== true) throw new Error("Canonical availability permission was not seeded");

  await db`
    INSERT INTO tenant (id, slug, name, tier, residency, status)
    VALUES (${FOREIGN_TENANT}::uuid, 'yellow-crs-proof-foreign', 'CRS Synthetic Foreign Tenant', 'shared', 'me-central', 'active')
    ON CONFLICT (id) DO NOTHING
  `;
  await db`
    INSERT INTO org_node (id, tenant_id, path, kind, name, timezone, currency, config)
    VALUES (${BRAND_NODE}::uuid, ${SEED_TENANT.id}::uuid, 'yellow_demo'::ltree, 'brand',
            'CRS Synthetic Brand', NULL, NULL, '{}'::jsonb)
    ON CONFLICT (id) DO NOTHING
  `;
  await db`
    INSERT INTO org_node (id, tenant_id, path, kind, name, timezone, currency, config)
    VALUES (${PEER_PROPERTY}::uuid, ${SEED_TENANT.id}::uuid, 'yellow_demo.crs_peer'::ltree, 'property',
            'CRS Synthetic Peer', ${peerTimezone}, 'NPR', '{}'::jsonb)
    ON CONFLICT (id) DO NOTHING
  `;
  await db`
    INSERT INTO org_node (id, tenant_id, path, kind, name, timezone, currency, config)
    VALUES (${FOREIGN_PROPERTY}::uuid, ${FOREIGN_TENANT}::uuid, 'crs_foreign.property'::ltree, 'property',
            'CRS Synthetic Foreign Property', 'Pacific/Auckland', 'NZD', '{}'::jsonb)
    ON CONFLICT (id) DO NOTHING
  `;

  for (const [id, email, displayName, tenantId] of [
    [BRAND_ACTOR, "crs-brand@yellow.local", "CRS Brand Operator", SEED_TENANT.id],
    [EXACT_ACTOR, "crs-exact@yellow.local", "CRS Exact Operator", SEED_TENANT.id],
    [NO_GRANT_ACTOR, "crs-no-grant@yellow.local", "CRS Unassigned Operator", SEED_TENANT.id],
    [FOREIGN_ACTOR, "crs-foreign@yellow.local", "CRS Foreign Operator", FOREIGN_TENANT],
    [REVOKE_ACTOR, "crs-revocable@yellow.local", "CRS Revocable Operator", SEED_TENANT.id],
  ] as const) {
    await db`
      INSERT INTO app_user (id, tenant_id, email, display_name, auth, status)
      VALUES (${id}::uuid, ${tenantId}::uuid, ${email}, ${displayName}, '{}'::jsonb, 'active')
      ON CONFLICT (id) DO NOTHING
    `;
  }

  for (const [id, name] of [
    [BRAND_ROLE, "CRS Proof Brand Read Role"],
    [EXACT_ROLE, "CRS Proof Exact Read Role"],
    [REVOKE_ROLE, "CRS Proof Revocable Read Role"],
    [FOREIGN_ROLE, "CRS Proof Foreign Read Role"],
  ] as const) {
    await db`
      INSERT INTO role (id, tenant_id, name)
      VALUES (${id}::uuid, ${id === FOREIGN_ROLE ? FOREIGN_TENANT : SEED_TENANT.id}::uuid, ${name})
      ON CONFLICT (id) DO NOTHING
    `;
    await db`
      INSERT INTO role_permission (role_id, permission_code) VALUES (${id}::uuid, ${SCOPE})
      ON CONFLICT (role_id, permission_code) DO NOTHING
    `;
  }

  for (const [tenantId, actorId, roleId, nodeId] of [
    [SEED_TENANT.id, BRAND_ACTOR, BRAND_ROLE, BRAND_NODE],
    [SEED_TENANT.id, EXACT_ACTOR, EXACT_ROLE, SEED_PROPERTY.id],
    [SEED_TENANT.id, REVOKE_ACTOR, REVOKE_ROLE, SEED_PROPERTY.id],
    [FOREIGN_TENANT, FOREIGN_ACTOR, FOREIGN_ROLE, FOREIGN_PROPERTY],
  ] as const) {
    await db`
      INSERT INTO user_role (tenant_id, user_id, role_id, scope_node)
      VALUES (${tenantId}::uuid, ${actorId}::uuid, ${roleId}::uuid, ${nodeId}::uuid)
      ON CONFLICT (user_id, role_id, scope_node) DO NOTHING
    `;
  }

  const shapes = await db<{ exact: boolean; foreign_exact: boolean; peer_exact: boolean; brand_exact: boolean }[]>`
    SELECT
      EXISTS (SELECT 1 FROM org_node WHERE id = ${BRAND_NODE}::uuid AND tenant_id = ${SEED_TENANT.id}::uuid
              AND path = 'yellow_demo'::ltree AND kind = 'brand') AS brand_exact,
      EXISTS (SELECT 1 FROM org_node WHERE id = ${PEER_PROPERTY}::uuid AND tenant_id = ${SEED_TENANT.id}::uuid
              AND path = 'yellow_demo.crs_peer'::ltree AND kind = 'property'
              AND timezone = ${peerTimezone} AND currency = 'NPR') AS peer_exact,
      EXISTS (SELECT 1 FROM org_node WHERE id = ${FOREIGN_PROPERTY}::uuid AND tenant_id = ${FOREIGN_TENANT}::uuid
              AND path = 'crs_foreign.property'::ltree AND kind = 'property') AS foreign_exact,
      EXISTS (SELECT 1 FROM tenant WHERE id = ${FOREIGN_TENANT}::uuid AND slug = 'yellow-crs-proof-foreign') AS exact
  `;
  const shape = shapes[0];
  if (!shape?.exact || !shape.foreign_exact || !shape.peer_exact || !shape.brand_exact) {
    throw new Error("Synthetic CRS authorization fixture shape differs");
  }
}

async function databaseFingerprint(db: SQL): Promise<string> {
  const tableRows = await db<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
  `;
  const tables: Array<readonly [string, string]> = [];
  for (const { tablename } of tableRows) {
    const relation = `public.${quoteIdentifier(tablename)}`;
    const rows = await db.unsafe<{ fingerprint: string }[]>(`
      SELECT md5(COALESCE(string_agg(row_json, E'\\n' ORDER BY row_json), '')) AS fingerprint
      FROM (SELECT to_jsonb(source_row)::text AS row_json FROM ${relation} AS source_row) AS rows
    `);
    tables.push([tablename, rows[0]?.fingerprint ?? ""]);
  }

  const sequenceRows = await db<{ sequence_name: string }[]>`
    SELECT sequence.relname AS sequence_name
    FROM pg_class AS sequence
    JOIN pg_namespace AS namespace ON namespace.oid = sequence.relnamespace
    WHERE namespace.nspname = 'public' AND sequence.relkind = 'S'
    ORDER BY sequence.relname
  `;
  const sequences: Array<readonly [string, string, boolean]> = [];
  for (const { sequence_name } of sequenceRows) {
    const rows = await db.unsafe<{ last_value: string; is_called: boolean }[]>(
      `SELECT last_value::text, is_called FROM public.${quoteIdentifier(sequence_name)}`,
    );
    const row = rows[0];
    sequences.push([sequence_name, row?.last_value ?? "", row?.is_called ?? false]);
  }
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(JSON.stringify({ tables, sequences }));
  return hasher.digest("hex");
}

async function assertRuntimeIdentity(): Promise<void> {
  const runtime = runtimeProbe;
  if (!runtime) throw new Error("CRS runtime probe is unavailable");
  const rows = await runtime<AppRoleProbe[]>`
    SELECT session_user::text AS session_user, role.rolcanlogin AS can_login,
           role.rolsuper AS superuser, role.rolbypassrls AS bypass_rls,
           pg_has_role(session_user, 'app_role', 'member') AS app_role_member
    FROM pg_roles AS role WHERE role.rolname = session_user
  `;
  const row = rows[0];
  if (!row || row.session_user !== "yellow_runtime" || !row.can_login || row.superuser ||
      row.bypass_rls || !row.app_role_member) {
    throw new Error("CRS runtime URL did not connect as the provisioned least-privilege yellow_runtime role");
  }
}

async function liveDatabaseIdentity(pool: SQL): Promise<LiveDatabaseIdentity> {
  const rows = await pool<LiveDatabaseIdentity[]>`
    SELECT current_database()::text AS database_name,
           (SELECT oid::text FROM pg_database WHERE datname = current_database()) AS database_oid,
           inet_server_addr()::text AS server_address,
           inet_server_port() AS server_port,
           pg_postmaster_start_time()::text AS postmaster_start
  `;
  const row = rows[0];
  if (!row) throw new Error("CRS live PostgreSQL identity probe returned no row");
  return row;
}

async function assertSameLiveDatabase(): Promise<void> {
  const deployPool = deployment;
  const runtimePool = runtimeProbe;
  if (!deployPool || !runtimePool) throw new Error("CRS PostgreSQL identity pools are unavailable");
  const [deploy, runtime] = await Promise.all([
    liveDatabaseIdentity(deployPool),
    liveDatabaseIdentity(runtimePool),
  ]);
  if (deploy.database_name !== runtime.database_name || deploy.database_oid !== runtime.database_oid ||
      deploy.server_address !== runtime.server_address || deploy.server_port !== runtime.server_port ||
      deploy.postmaster_start !== runtime.postmaster_start) {
    throw new Error("CRS deployment and runtime connections resolved to different PostgreSQL databases or servers");
  }
  const expected = normalizeDatabaseTarget(DEPLOY_URL!);
  if (deploy.database_name !== expected.database) {
    throw new Error("CRS connected PostgreSQL database differs from the guarded target name");
  }
}

async function runtimeContextProbe(tenantId: string, ownProperty: string, foreignProperty: string): Promise<RuntimeContextProbe> {
  const { runtimeDatabase: db } = getDependencies();
  return db.withTenantTransaction(tenantId, async (tx) => {
    const rows = await tx<RuntimeContextProbe[]>`
      SELECT session_user::text AS session_user, current_user::text AS current_user,
             NULLIF(current_setting('app.tenant_id', true), '') AS tenant_id,
             pg_backend_pid() AS backend_pid,
             (SELECT count(*)::int FROM org_node WHERE id = ${ownProperty}::uuid) AS own_property_count,
             (SELECT count(*)::int FROM org_node WHERE id = ${foreignProperty}::uuid) AS foreign_property_count
    `;
    const row = rows[0];
    if (!row) throw new Error("Runtime transaction identity probe returned no row");
    return row;
  });
}

function txContext(
  tx: ReservedSQL,
  actorId: string,
  body: Record<string, unknown>,
): TenantRequestContext {
  return {
    request: new Request("http://yellow.test/api/v1/crs/availability:search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    tenantId: SEED_TENANT.id,
    identity: { tenantId: SEED_TENANT.id, actorId, scopes: [SCOPE] },
    tx,
  };
}

beforeAll(async () => {
  if (!DEPLOY_URL || !RUNTIME_URL) return;
  try {
    assertMatchingDatabaseTargets(DEPLOY_URL, RUNTIME_URL);
    checkedDatabaseName(DEPLOY_URL);
    checkedDatabaseName(RUNTIME_URL);
    deployment = new SQL(DEPLOY_URL, { max: 3 });
    runtimeProbe = new SQL(RUNTIME_URL, { max: 1 });
    await assertSameLiveDatabase();
    await assertRuntimeIdentity();
    await runSeed({ databaseUrl: DEPLOY_URL, logger: () => undefined });
    await runReviewSeed({
      databaseUrl: DEPLOY_URL,
      password: SYNTHETIC_PASSWORD,
      approverPassword: SYNTHETIC_APPROVER_PASSWORD,
      logger: () => undefined,
    });
    await provisionSyntheticIdentity();

    const propertyRows = await deployment<PropertyRow[]>`
      SELECT id::text AS id, name, timezone, currency
      FROM org_node WHERE id = ${SEED_PROPERTY.id}::uuid OR id = ${PEER_PROPERTY}::uuid
      ORDER BY id
    `;
    const seedProperty = propertyRows.find(({ id }) => id === SEED_PROPERTY.id);
    const peerProperty = propertyRows.find(({ id }) => id === PEER_PROPERTY);
    if (!seedProperty || !peerProperty || seedProperty.timezone === null || peerProperty.timezone === null) {
      throw new Error("CRS offer properties are incomplete");
    }
    seedPropertyName = seedProperty.name;
    seedPropertyTimezone = seedProperty.timezone;
    peerTimezone = peerProperty.timezone;
    stayStart = new Date(Date.now() + 35 * 86_400_000);
    stayStart.setUTCHours(15, 0, 0, 0);
    stayEnd = new Date(stayStart.getTime() + 2 * 86_400_000);

    loginPool = new SQL(DEPLOY_URL, { max: 1 });
    eventPool = new SQL(DEPLOY_URL, { max: 4 });
    registryPool = new SQL(DEPLOY_URL, { max: 2 });
    runtimeDatabase = Database.connect(RUNTIME_URL, { maxConnections: 1 });
    const events = new PostgresEventBus(eventPool);
    const availability = new AvailabilityService();
    const projection = new AvailabilityProjectionService();
    const rates = new RateConfigurationService(events);
    const registry = new ExtensionRegistry(registryPool);
    const publication = new RatePublicationService(registry, new ApprovalService(events), events);
    const quote = new RateQuoteService(
      publication,
      new TaxJurisdictionResolutionService(registry),
      availability,
      projection,
    );
    offerService = new ReservationOfferSearchService(rates, quote, availability);
    const observedOffers: Pick<ReservationOfferSearchService, "search"> = {
      async search(tx, input: ReservationOfferSearchInput) {
        offerCalls += 1;
        return offerService!.search(tx, input);
      },
    };
    signer = new Hs256TokenSigner(TOKEN_SECRET);
    operator = new OperatorHttpApi(
      new LocalLoginService(loginPool, signer),
      availability,
      undefined,
      new PostgresIdempotency(),
      undefined,
      rates,
      undefined,
      undefined,
      undefined,
      undefined,
      projection,
      undefined,
      undefined,
      undefined,
      observedOffers,
    );
    app = createApp({ database: runtimeDatabase, tenantResolver: new BearerTenantResolver(signer), operatorApi: operator });
    brandToken = await issueToken(BRAND_ACTOR);
    exactToken = await issueToken(EXACT_ACTOR);
    revokeToken = await issueToken(REVOKE_ACTOR);
    noScopeToken = await issueToken(BRAND_ACTOR, SEED_TENANT.id, []);
    noGrantToken = await issueToken(NO_GRANT_ACTOR);
    foreignToken = await issueToken(FOREIGN_ACTOR, FOREIGN_TENANT);
  } catch (error) {
    throw safeFailure("CRS PostgreSQL proof setup failed", error);
  }
}, 120_000);

afterAll(async () => {
  await runtimeDatabase?.close();
  await loginPool?.close();
  await eventPool?.close();
  await registryPool?.close();
  await runtimeProbe?.close();
  await deployment?.close();
}, 30_000);

describe("PMS CRS required database authority", () => {
  test("required mode cannot silently skip either configured PostgreSQL authority", () => {
    if (REQUIRED) {
      expect(DEPLOY_URL).toBeTruthy();
      expect(RUNTIME_URL).toBeTruthy();
    }
  });

  test("rejects different normalized deployment and runtime targets without opening a connection", () => {
    expect(() => assertMatchingDatabaseTargets(
      "postgres://deploy@LOCALHOST/yellow_crs_pairing_proof",
      "postgresql://runtime@localhost:5432/yellow_crs_pairing_proof",
    )).not.toThrow();
    expect(() => assertMatchingDatabaseTargets(
      "postgres://deploy@localhost/yellow_crs_pairing_proof",
      "postgres://runtime@localhost:5432/yellow_crs_other_proof",
    )).toThrow("CRS deployment and runtime URLs do not identify the same PostgreSQL target");
    expect(() => assertMatchingDatabaseTargets(
      "postgres://deploy@localhost:5432/yellow_crs_pairing_proof",
      "postgres://runtime@127.0.0.1:5432/yellow_crs_pairing_proof",
    )).toThrow("CRS deployment and runtime URLs do not identify the same PostgreSQL target");
    expect(() => assertMatchingDatabaseTargets(
      "postgres://deploy@localhost:5432/yellow_crs_pairing_proof",
      "postgres://runtime@localhost:5433/yellow_crs_pairing_proof",
    )).toThrow("CRS deployment and runtime URLs do not identify the same PostgreSQL target");
  });
});

databaseDescribe("PMS CRS staff offer search on PostgreSQL", () => {
  test("requires the guarded disposable database and live least-privilege runtime role", async () => {
    const { deployment: deploy } = getDependencies();
    const rows = await deploy<{ database_name: string; session_user: string; current_user: string }[]>`
      SELECT current_database() AS database_name, session_user::text AS session_user, current_user::text AS current_user
    `;
    const row = rows[0];
    expect(row).toBeDefined();
    expect(row!.database_name.startsWith("yellow_crs") || row!.database_name.endsWith("proof")).toBe(true);
    expect(row!.session_user).not.toBe("yellow_runtime");
    expect(row!.current_user).toBe(row!.session_user);
    await assertRuntimeIdentity();
  });

  test("brand and exact grants authorize current properties, and batch results equal single-property results in one Tx", async () => {
    const { runtimeDatabase: db, operator: api } = getDependencies();
    const beforeCalls = offerCalls;
    const properties = [SEED_PROPERTY.id, PEER_PROPERTY] as const;

    const proof = await db.withTenantTransaction(SEED_TENANT.id, async (tx) => {
      const context = txContext(tx, BRAND_ACTOR, batchBody(properties));
      const batchResponse = await api.searchCrs(context);
      const batchBodyValue = await batchResponse.json() as {
        properties: Array<{
          property_id: string;
          property_name: string;
          time_zone: string;
          result: Record<string, unknown>;
        }>;
      };
      const individual: Array<Record<string, unknown>> = [];
      for (const propertyId of properties) {
        const response = await api.search(txContext(tx, BRAND_ACTOR, canonicalSearch()), propertyId, canonicalSearch());
        individual.push(await response.json() as Record<string, unknown>);
      }
      return { batchResponse, batchBodyValue, individual };
    });

    expect(proof.batchResponse.status).toBe(200);
    expect(proof.batchBodyValue.properties).toHaveLength(2);
    expect(proof.batchBodyValue.properties.map(({ property_id }) => property_id)).toEqual([...properties]);
    expect(proof.batchBodyValue.properties[0]).toMatchObject({
      property_id: SEED_PROPERTY.id,
      property_name: seedPropertyName,
      time_zone: seedPropertyTimezone,
    });
    expect(proof.batchBodyValue.properties[1]).toMatchObject({
      property_id: PEER_PROPERTY,
      property_name: "CRS Synthetic Peer",
      time_zone: peerTimezone,
    });
    expect(proof.batchBodyValue.properties[0]?.result).toEqual(proof.individual[0]);
    expect(proof.batchBodyValue.properties[1]?.result).toEqual(proof.individual[1]);

    const seedResult = proof.batchBodyValue.properties[0]?.result as {
      options?: Array<Record<string, unknown>>;
      summary?: { bookable?: number };
    } | undefined;
    expect(seedResult?.options?.length).toBeGreaterThan(0);
    expect(seedResult?.summary?.bookable).toBeGreaterThan(0);
    const evidenceOffer = seedResult?.options?.find((offer) => offer.bookable === true);
    expect(evidenceOffer).toBeDefined();
    expect(evidenceOffer).toMatchObject({
      promise: false,
      commit_arbitration_required: true,
      release: { content_hash: expect.stringMatching(/^[0-9a-f]{64}$/) },
      total: { amount_minor: expect.any(String), currency: "USD", kind: "pre_tax" },
      evidence: {
        quote_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
        availability_ref: expect.stringMatching(/^availability:/),
      },
    });
    expect(proof.batchBodyValue.properties[1]?.result).toMatchObject({ options: [], summary: { candidate_pairs: 0 } });
    expect(offerCalls - beforeCalls).toBe(4);

    const exact = await getDependencies().app.handle(httpRequest(batchBody([SEED_PROPERTY.id]), exactToken));
    expect(exact.status).toBe(200);
    const exactBody = await exact.json() as { properties: Array<{ property_id: string }> };
    expect(exactBody.properties.map(({ property_id }) => property_id)).toEqual([SEED_PROPERTY.id]);
    const exactPeer = await getDependencies().app.handle(httpRequest(batchBody([PEER_PROPERTY]), exactToken));
    expect(exactPeer.status).toBe(403);
  });

  test("denies foreign, unknown, mixed, stale-revoked, mismatched, unsigned, unscoped and malformed requests before offers", async () => {
    const { app: mounted, deployment: deploy } = getDependencies();
    const forbiddenType = { status: 403, type: "auth/forbidden" };
    const beforeCalls = offerCalls;

    for (const token of [brandToken, exactToken]) {
      const foreign = await mounted.handle(httpRequest(batchBody([FOREIGN_PROPERTY]), token));
      expect(foreign.status).toBe(403);
      expect(await foreign.json()).toMatchObject(forbiddenType);
      const unknown = await mounted.handle(httpRequest(batchBody(["8b904b51-f411-4f8a-9f22-efc8d580ccff"]), token));
      expect(unknown.status).toBe(403);
      expect(await unknown.json()).toMatchObject(forbiddenType);
      const mixed = await mounted.handle(httpRequest(batchBody([SEED_PROPERTY.id, FOREIGN_PROPERTY]), token));
      expect(mixed.status).toBe(403);
      expect(await mixed.json()).toMatchObject(forbiddenType);
    }

    const noScope = await mounted.handle(httpRequest(batchBody([SEED_PROPERTY.id]), noScopeToken));
    expect(noScope.status).toBe(403);
    expect(await noScope.json()).toMatchObject({ status: 403, type: "auth/scope_missing" });
    const unsigned = await mounted.handle(httpRequest(batchBody([SEED_PROPERTY.id]), "unsigned.test.token"));
    expect(unsigned.status).toBe(401);
    const actorMismatch = await mounted.handle(httpRequest(batchBody([SEED_PROPERTY.id]), noGrantToken));
    expect(actorMismatch.status).toBe(403);
    expect(await actorMismatch.json()).toMatchObject(forbiddenType);
    const tenantMismatch = await mounted.handle(httpRequest(batchBody([SEED_PROPERTY.id]), foreignToken));
    expect(tenantMismatch.status).toBe(403);
    expect(await tenantMismatch.json()).toMatchObject(forbiddenType);
    const mismatchedClaimPair = await issueToken(BRAND_ACTOR, FOREIGN_TENANT);
    const matchingTenantProperty = await mounted.handle(httpRequest(batchBody([FOREIGN_PROPERTY]), mismatchedClaimPair));
    expect(matchingTenantProperty.status).toBe(403);
    expect(await matchingTenantProperty.json()).toMatchObject(forbiddenType);

    const malformed = await mounted.handle(httpRequest({
      searches: [{ property_id: SEED_PROPERTY.id, search: { stay: {}, party: {}, channel: "direct", unknown: true } }],
    }));
    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toMatchObject({ status: 400, type: "request/invalid" });

    await deploy`
      DELETE FROM user_role
      WHERE tenant_id = ${SEED_TENANT.id}::uuid AND user_id = ${REVOKE_ACTOR}::uuid
        AND role_id = ${REVOKE_ROLE}::uuid AND scope_node = ${SEED_PROPERTY.id}::uuid
    `;
    try {
      const revoked = await mounted.handle(httpRequest(batchBody([SEED_PROPERTY.id]), revokeToken));
      expect(revoked.status).toBe(403);
      expect(await revoked.json()).toMatchObject(forbiddenType);
    } finally {
      await deploy`
        INSERT INTO user_role (tenant_id, user_id, role_id, scope_node)
        VALUES (${SEED_TENANT.id}::uuid, ${REVOKE_ACTOR}::uuid, ${REVOKE_ROLE}::uuid, ${SEED_PROPERTY.id}::uuid)
        ON CONFLICT (user_id, role_id, scope_node) DO NOTHING
      `;
    }
    expect(offerCalls).toBe(beforeCalls);
  });

  test("runtime transaction context is tenant-local, pooled identity is restricted, and searches do not write product rows or sequences", async () => {
    const { deployment: deploy, runtimeDatabase: db } = getDependencies();
    const before = await databaseFingerprint(deploy);
    const seedContext = await runtimeContextProbe(SEED_TENANT.id, SEED_PROPERTY.id, FOREIGN_PROPERTY);
    const foreignContext = await runtimeContextProbe(FOREIGN_TENANT, FOREIGN_PROPERTY, SEED_PROPERTY.id);
    expect(seedContext).toMatchObject({
      session_user: "yellow_runtime",
      current_user: "app_role",
      tenant_id: SEED_TENANT.id,
      own_property_count: 1,
      foreign_property_count: 0,
    });
    expect(foreignContext).toMatchObject({
      session_user: "yellow_runtime",
      current_user: "app_role",
      tenant_id: FOREIGN_TENANT,
      own_property_count: 1,
      foreign_property_count: 0,
    });
    expect(foreignContext.backend_pid).toBe(seedContext.backend_pid);

    const response = await getDependencies().app.handle(httpRequest(batchBody([SEED_PROPERTY.id, PEER_PROPERTY])));
    expect(response.status).toBe(200);
    const responseBody = await response.json() as {
      properties: Array<{ property_id: string; property_name: string; time_zone: string; result: unknown }>;
    };
    expect(responseBody.properties).toHaveLength(2);
    expect(responseBody.properties[0]).toMatchObject({
      property_id: SEED_PROPERTY.id,
      property_name: seedPropertyName,
      time_zone: seedPropertyTimezone,
    });
    expect(responseBody.properties[1]).toMatchObject({
      property_id: PEER_PROPERTY,
      property_name: "CRS Synthetic Peer",
      time_zone: peerTimezone,
    });
    const denied = await getDependencies().app.handle(httpRequest(batchBody([SEED_PROPERTY.id, FOREIGN_PROPERTY])));
    expect(denied.status).toBe(403);
    const malformed = await getDependencies().app.handle(httpRequest({ searches: [] }));
    expect(malformed.status).toBe(400);
    const callsBeforeInvalidStay = offerCalls;
    const reversedSearch = canonicalSearch();
    reversedSearch.stay = { from: stayEnd.toISOString(), to: stayStart.toISOString() };
    const invalidStay = await getDependencies().app.handle(
      httpRequest({ searches: [{ property_id: SEED_PROPERTY.id, search: reversedSearch }] }),
    );
    expect(invalidStay.status).toBe(400);
    expect(await invalidStay.json()).toMatchObject({ status: 400, type: "request/invalid" });
    expect(offerCalls - callsBeforeInvalidStay).toBe(1);

    const after = await databaseFingerprint(deploy);
    expect(after).toBe(before);
    const finalContext = await db.withTenantTransaction(SEED_TENANT.id, async (tx) => {
      const rows = await tx<{ tenant_id: string | null; current_user: string; session_user: string }[]>`
        SELECT NULLIF(current_setting('app.tenant_id', true), '') AS tenant_id,
               current_user::text AS current_user, session_user::text AS session_user
      `;
      return rows[0];
    });
    expect(finalContext).toMatchObject({
      tenant_id: SEED_TENANT.id,
      current_user: "app_role",
      session_user: "yellow_runtime",
    });
  });
});
