import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { SQL } from "bun";

import { runMigrations } from "../scripts/migrate";
import { runSeed, SEED_PROPERTY, SEED_TENANT } from "../scripts/seed";
import {
  IndiaGstAccommodationHistoricalResolutionService,
} from "../src/contexts/tax-fiscal";
import { Database, ExtensionRegistry } from "../src/kernel";

setDefaultTimeout(120_000);

// This is an opt-in disposable PostgreSQL proof. With no explicit URLs the
// block is skipped; it never falls back to yellow_dev/yellow_test or Docker.
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_ORDER306_DATABASE === "1";
const ADMIN_URL = process.env.YELLOW_ORDER306_DEPLOY_DATABASE_URL
  ?? process.env.YELLOW_ORDER306_ADMIN_DATABASE_URL
  ?? process.env.YELLOW_ORDER306_DATABASE_URL;
const RUNTIME_URL = process.env.YELLOW_ORDER306_RUNTIME_DATABASE_URL;

if (REQUIRE_DATABASE && (!ADMIN_URL || !RUNTIME_URL)) {
  throw new Error("Order 306 live proof requires deploy/admin and runtime database URLs");
}

const live = ADMIN_URL && RUNTIME_URL ? describe.serial : describe.skip;
const FORBIDDEN_DATABASES = new Set(["yellow_dev", "yellow_test"]);
const TENANT_B = "00000000-0000-0000-0000-000000003062";
const PROPERTY_B = "00000000-0000-0000-0000-000000003063";
const KEY = "in-gst-lodging";
const V1_ID = "a806f516-fed6-5768-b310-94aa03286adb";
const V2_ID = "0b21daf2-ea6e-5568-9c21-69e4d4424574";
const CUTOVER = "2025-09-21T18:30:00.000000Z";

interface Effects {
  readonly extensionCount: string;
  readonly extensionDigest: string;
  readonly assignmentCount: string;
  readonly assignmentDigest: string;
  readonly factCount: string;
  readonly outboxCount: string;
  readonly journalCount: string;
  readonly postingCount: string;
  readonly documentCount: string;
  readonly fiscalSubmissionCount: string;
}

let admin: SQL | undefined;

function requiredAdminUrl(): string {
  if (!ADMIN_URL) throw new Error("Order 306 live admin database is unavailable");
  return ADMIN_URL;
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function targetUrl(databaseName: string): string {
  const url = new URL(requiredAdminUrl());
  url.pathname = `/${databaseName}`;
  return url.toString();
}

function runtimeUrl(databaseUrl: string): string {
  if (!RUNTIME_URL) throw new Error("Order 306 runtime database is unavailable");
  const url = new URL(RUNTIME_URL);
  url.pathname = new URL(databaseUrl).pathname;
  return url.toString();
}

async function withFreshDatabase<T>(operation: (databaseUrl: string, sql: SQL) => Promise<T>): Promise<T> {
  if (!admin) throw new Error("Order 306 live admin connection is unavailable");
  const databaseName = `yellow_order306_${randomUUID().replaceAll("-", "")}`;
  await admin.unsafe(`CREATE DATABASE ${quoteIdentifier(databaseName)}`);
  const databaseUrl = targetUrl(databaseName);
  const sql = new SQL(databaseUrl, { max: 4, prepare: false });
  try {
    await runMigrations({ databaseUrl, logger: () => undefined });
    await runSeed({ databaseUrl, logger: () => undefined });
    return await operation(databaseUrl, sql);
  } finally {
    await sql.close().catch(() => undefined);
    await admin`
      SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
       WHERE datname = ${databaseName} AND pid <> pg_backend_pid()
    `.catch(() => undefined);
    await admin.unsafe(`DROP DATABASE IF EXISTS ${quoteIdentifier(databaseName)} WITH (FORCE)`);
  }
}

async function effects(sql: SQL): Promise<Effects> {
  const rows = await sql<Effects[]>`SELECT
    (SELECT count(*)::text FROM extension) AS "extensionCount",
    (SELECT COALESCE(md5(string_agg(row_to_json(e)::text, '|' ORDER BY e.id)), md5('')) FROM extension e) AS "extensionDigest",
    (SELECT count(*)::text FROM tax_assignment) AS "assignmentCount",
    (SELECT COALESCE(md5(string_agg(row_to_json(a)::text, '|' ORDER BY a.property_node, a.effective)), md5('')) FROM tax_assignment a) AS "assignmentDigest",
    (SELECT count(*)::text FROM fact_log) AS "factCount",
    (SELECT count(*)::text FROM outbox) AS "outboxCount",
    (SELECT count(*)::text FROM journal) AS "journalCount",
    (SELECT count(*)::text FROM posting_line) AS "postingCount",
    (SELECT count(*)::text FROM document) AS "documentCount",
    (SELECT count(*)::text FROM fiscal_submission) AS "fiscalSubmissionCount"`;
  if (!rows[0]) throw new Error("Order 306 effect snapshot was empty");
  return rows[0];
}

async function setupFixture(sql: SQL): Promise<void> {
  await sql`UPDATE org_node SET timezone = 'Asia/Kolkata' WHERE id = ${SEED_PROPERTY.id}::uuid`;
  await sql`
    INSERT INTO tenant (id, slug, name, tier, residency, status)
    VALUES (${TENANT_B}::uuid, 'order306-foreign', 'Order 306 Foreign', 'shared', 'me-central', 'active')
  `;
  await sql`
    INSERT INTO org_node (id, tenant_id, path, kind, name, timezone, currency)
    VALUES (${PROPERTY_B}::uuid, ${TENANT_B}::uuid, 'order306_foreign.property', 'property',
            'Order 306 Foreign Property', 'Asia/Kolkata', 'INR')
  `;
  await sql`
    INSERT INTO tax_assignment (tenant_id, property_node, jurisdiction_key, effective)
    VALUES
      (${SEED_TENANT.id}::uuid, ${SEED_PROPERTY.id}::uuid, ${KEY}, daterange('2022-01-01', NULL, '[)')),
      (${TENANT_B}::uuid, ${PROPERTY_B}::uuid, ${KEY}, daterange('2022-01-01', NULL, '[)'))
  `;
}

function selected(result: unknown): Record<string, unknown> {
  if (typeof result !== "object" || result === null) throw new Error("historical result is not an object");
  const value = result as Record<string, unknown>;
  const extension = value.selectedExtension;
  if (typeof extension !== "object" || extension === null) throw new Error("selected extension evidence is absent");
  return extension as Record<string, unknown>;
}

async function resolveHistorical(
  database: Database,
  tenantId: string,
  propertyNode: string,
  businessDate: string,
  service: IndiaGstAccommodationHistoricalResolutionService,
): Promise<Record<string, unknown>> {
  const result = await database.withTenantTransaction(tenantId, async (tx) => {
    const context = await tx<Array<{ current_user: string; tenant_id: string | null }>>`
      SELECT current_user::text, current_setting('app.tenant_id', true) AS tenant_id
    `;
    expect(context).toEqual([{ current_user: "app_role", tenant_id: tenantId }]);
    return service.resolve(tx, { propertyNode, businessDate });
  });
  return result as unknown as Record<string, unknown>;
}

beforeAll(async () => {
  if (!ADMIN_URL) return;
  const parsed = new URL(requiredAdminUrl());
  const databaseName = parsed.pathname.replace(/^\//, "");
  if (FORBIDDEN_DATABASES.has(databaseName)) {
    throw new Error(`Order 306 admin URL must not point at protected database ${databaseName}`);
  }
  admin = new SQL(requiredAdminUrl(), { max: 2, prepare: false });
  const rows = await admin<{ is_superuser: boolean }[]>`
    SELECT rolsuper AS is_superuser FROM pg_roles WHERE rolname = current_user`;
  if (rows[0]?.is_superuser !== true) {
    throw new Error("Order 306 admin URL must use a PostgreSQL superuser");
  }
});

afterAll(async () => {
  await admin?.close();
  admin = undefined;
});

live("Order 306 historical lodging resolution PostgreSQL proof", () => {
  test("fresh seed selects v1 before cutover and v2 at/after cutover with exact zero read effects", async () => {
    await withFreshDatabase(async (databaseUrl, sql) => {
      await setupFixture(sql);
      const runtime = new SQL(runtimeUrl(databaseUrl), { max: 4, prepare: false });
      const database = Database.connect(runtimeUrl(databaseUrl), { maxConnections: 4, prepare: false });
      const service = new IndiaGstAccommodationHistoricalResolutionService(
        new ExtensionRegistry(runtime),
      );
      try {
        const before = await effects(sql);
        const v1 = await resolveHistorical(database, SEED_TENANT.id, SEED_PROPERTY.id, "2025-09-21", service);
        const v1Again = await resolveHistorical(database, SEED_TENANT.id, SEED_PROPERTY.id, "2025-09-21", service);
        const v2 = await resolveHistorical(database, SEED_TENANT.id, SEED_PROPERTY.id, "2025-09-22", service);
        expect(v1).toEqual(v1Again);
        expect(selected(v1)).toMatchObject({ extensionId: V1_ID, version: 1, status: "retired" });
        expect(selected(v2)).toMatchObject({ extensionId: V2_ID, version: 2, status: "active" });
        expect(v1).toMatchObject({ property: { propertyNode: SEED_PROPERTY.id, propertyTimezone: "Asia/Kolkata" },
          businessDay: { businessDate: "2025-09-21", fromInstant: "2025-09-20T18:30:00.000000Z",
            toInstant: CUTOVER } });
        expect(v2).toMatchObject({ businessDay: { businessDate: "2025-09-22" } });
        expect((v2.businessDay as Record<string, unknown>).fromInstant).toBe(CUTOVER);
        expect(v1).not.toHaveProperty("tenantId");
        expect(v1.evidenceHash).toMatch(/^[a-f0-9]{64}$/);
        expect(Object.isFrozen(v1)).toBeTrue();
        expect(Object.isFrozen(selected(v1))).toBeTrue();
        expect(await effects(sql)).toEqual(before);
      } finally {
        await database.close();
        await runtime.close();
      }
    });
  });

  test("same-tenant visibility, foreign-property concealment, DST and awkward offsets are database-derived", async () => {
    await withFreshDatabase(async (databaseUrl, sql) => {
      await setupFixture(sql);
      const runtime = new SQL(runtimeUrl(databaseUrl), { max: 4, prepare: false });
      const database = Database.connect(runtimeUrl(databaseUrl), { maxConnections: 4, prepare: false });
      const service = new IndiaGstAccommodationHistoricalResolutionService(new ExtensionRegistry(runtime));
      try {
        const before = await effects(sql);
        const foreign = await resolveHistorical(database, TENANT_B, PROPERTY_B, "2025-09-22", service);
        expect(selected(foreign)).toMatchObject({ extensionId: V2_ID, version: 2 });
        await expect(resolveHistorical(database, SEED_TENANT.id, PROPERTY_B, "2025-09-22", service)).rejects.toThrow();

        await sql`UPDATE org_node SET timezone = 'America/New_York' WHERE id = ${SEED_PROPERTY.id}::uuid`;
        const dstShort = await resolveHistorical(database, SEED_TENANT.id, SEED_PROPERTY.id, "2026-03-08", service);
        const dstLong = await resolveHistorical(database, SEED_TENANT.id, SEED_PROPERTY.id, "2026-11-01", service);
        expect(dstShort).toMatchObject({ property: { propertyTimezone: "America/New_York" },
          businessDay: { fromInstant: "2026-03-08T05:00:00.000000Z", toInstant: "2026-03-09T04:00:00.000000Z" } });
        expect(dstLong).toMatchObject({ businessDay: { fromInstant: "2026-11-01T04:00:00.000000Z",
          toInstant: "2026-11-02T05:00:00.000000Z" } });
        await sql`UPDATE org_node SET timezone = 'Asia/Kathmandu' WHERE id = ${SEED_PROPERTY.id}::uuid`;
        const awkward = await resolveHistorical(database, SEED_TENANT.id, SEED_PROPERTY.id, "2026-01-01", service);
        expect(awkward).toMatchObject({ property: { propertyTimezone: "Asia/Kathmandu" },
          businessDay: { fromInstant: "2025-12-31T18:15:00.000000Z", toInstant: "2026-01-01T18:15:00.000000Z" } });
        expect(await effects(sql)).toEqual(before);
      } finally {
        await database.close();
        await runtime.close();
      }
    });
  });

  test("a UTC day crossing the Kolkata cutover fails closed without partial evidence or writes", async () => {
    await withFreshDatabase(async (databaseUrl, sql) => {
      await setupFixture(sql);
      await sql`UPDATE org_node SET timezone = 'UTC' WHERE id = ${SEED_PROPERTY.id}::uuid`;
      const runtime = new SQL(runtimeUrl(databaseUrl), { max: 4, prepare: false });
      const database = Database.connect(runtimeUrl(databaseUrl), { maxConnections: 4, prepare: false });
      const service = new IndiaGstAccommodationHistoricalResolutionService(new ExtensionRegistry(runtime));
      try {
        const before = await effects(sql);
        await expect(resolveHistorical(database, SEED_TENANT.id, SEED_PROPERTY.id, "2025-09-21", service))
          .rejects.toThrow();
        await expect(resolveHistorical(database, SEED_TENANT.id, SEED_PROPERTY.id, "2025-09-21", service))
          .rejects.toThrow();
        expect(await effects(sql)).toEqual(before);
      } finally {
        await database.close();
        await runtime.close();
      }
    });
  });
});
