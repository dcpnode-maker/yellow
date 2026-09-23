import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { SQL } from "bun";

import { runMigrations } from "../scripts/migrate";
import {
  LAUNCH_EXTENSIONS,
  runSeed,
  SEED_PROPERTY,
  SEED_TENANT,
  SeedError,
} from "../scripts/seed";
import { ExtensionRegistry } from "../src/kernel";
import { TaxJurisdictionResolutionService } from "../src/contexts/tax-fiscal";

setDefaultTimeout(120_000);

// This proof is deliberately opt-in and has no fallback to the founder's local
// database. The URL is an admin/deploy URL used only to create disposable DBs.
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_ORDER305_DATABASE === "1";
const ADMIN_URL = process.env.YELLOW_ORDER305_DEPLOY_DATABASE_URL
  ?? process.env.YELLOW_ORDER305_ADMIN_DATABASE_URL
  ?? process.env.YELLOW_ORDER305_DATABASE_URL;
const RUNTIME_URL = process.env.YELLOW_ORDER305_RUNTIME_DATABASE_URL;

if (REQUIRE_DATABASE && (!ADMIN_URL || !RUNTIME_URL)) {
  throw new Error(
    "Order 305 live proof requires deploy/admin and runtime database URLs",
  );
}

const databaseDescribe = ADMIN_URL ? describe.serial : describe.skip;
const PROJECT_ROOT = resolve(import.meta.dir, "..");
const FORBIDDEN_DATABASES = new Set(["yellow_dev", "yellow_test"]);
const V1_ID = "a806f516-fed6-5768-b310-94aa03286adb";
const V2_ID = "0b21daf2-ea6e-5568-9c21-69e4d4424574";
const CUTOVER = "2025-09-21T18:30:00.000000Z";
const V1_FROM = "2022-07-17T18:30:00.000000Z";

const predecessorContent = {
  country: "IN",
  price_display: "tax_exclusive",
  rounding: "document",
  taxes: [
    {
      code: "GST_ROOM",
      name: "GST on accommodation",
      mode: "slab_percent",
      slab_basis: "transaction_value",
      applies_to: ["room_revenue"],
      slabs: [
        { upto_minor: 750000, rate: 0.12, itc_eligible: true },
        { upto_minor: null, rate: 0.18, itc_eligible: true },
      ],
    },
    {
      code: "GST_FNB",
      name: "GST on F&B (restaurant in hotel)",
      mode: "percent",
      rate: 0.05,
      applies_to: ["fnb_revenue"],
    },
  ],
};

const successorContent = {
  country: "IN",
  price_display: "tax_exclusive",
  rounding: "document",
  taxes: [
    {
      code: "GST_ROOM",
      name: "GST on accommodation",
      mode: "slab_percent",
      slab_basis: "transaction_value",
      applies_to: ["room_revenue"],
      slabs: [
        { upto_minor: 750000, rate: 0.05, itc_eligible: false },
        { upto_minor: null, rate: 0.18, itc_eligible: true },
      ],
    },
    {
      code: "GST_FNB",
      name: "GST on F&B (restaurant in hotel)",
      mode: "percent",
      rate: 0.05,
      applies_to: ["fnb_revenue"],
    },
  ],
};

interface EffectSnapshot {
  readonly extensionCount: string;
  readonly extensionDigest: string;
  readonly factCount: string;
  readonly outboxCount: string;
  readonly journalCount: string;
  readonly postingCount: string;
  readonly documentCount: string;
  readonly fiscalSubmissionCount: string;
}

let admin: SQL | undefined;

function requiredAdminUrl(): string {
  if (!ADMIN_URL) throw new Error("Order 305 live database is unavailable");
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
  if (!RUNTIME_URL) throw new Error("Order 305 runtime database URL is unavailable");
  const url = new URL(RUNTIME_URL);
  url.pathname = new URL(databaseUrl).pathname;
  return url.toString();
}

async function withFreshDatabase<T>(operation: (databaseUrl: string, sql: SQL) => Promise<T>): Promise<T> {
  if (!admin) throw new Error("Order 305 live admin connection is unavailable");
  const databaseName = `yellow_order305_${randomUUID().replaceAll("-", "")}`;
  await admin.unsafe(`CREATE DATABASE ${quoteIdentifier(databaseName)}`);
  const databaseUrl = targetUrl(databaseName);
  const sql = new SQL(databaseUrl, { max: 4, prepare: false });
  try {
    await runMigrations({ databaseUrl, logger: () => undefined });
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

async function effects(sql: SQL): Promise<EffectSnapshot> {
  const rows = await sql<EffectSnapshot[]>`SELECT
    (SELECT count(*)::text FROM extension) AS "extensionCount",
    (SELECT COALESCE(md5(string_agg(row_to_json(e)::text, '|' ORDER BY e.id)), md5('')) FROM extension e) AS "extensionDigest",
    (SELECT count(*)::text FROM fact_log) AS "factCount",
    (SELECT count(*)::text FROM outbox) AS "outboxCount",
    (SELECT count(*)::text FROM journal) AS "journalCount",
    (SELECT count(*)::text FROM posting_line) AS "postingCount",
    (SELECT count(*)::text FROM document) AS "documentCount",
    (SELECT count(*)::text FROM fiscal_submission) AS "fiscalSubmissionCount"`;
  const snapshot = rows[0];
  if (!snapshot) throw new Error("Order 305 effect snapshot was empty");
  return snapshot;
}

async function visibleHistory(sql: SQL): Promise<Array<Record<string, unknown>>> {
  return sql<Array<Record<string, unknown>>>`
    SELECT id::text, tenant_id::text, type, key, version,
           CASE WHEN lower(effective) IS NULL THEN NULL ELSE to_char(
             lower(effective) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') END AS effective_from,
           CASE WHEN upper(effective) IS NULL THEN NULL ELSE to_char(
             upper(effective) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') END AS effective_to,
           content, status
      FROM extension
     WHERE tenant_id IS NULL AND type = 'tax_jurisdiction' AND key = 'in-gst-lodging'
     ORDER BY version`;
}

async function assertCanonicalHistory(sql: SQL): Promise<void> {
  const rows = await visibleHistory(sql);
  expect(rows).toEqual([
    {
      id: V1_ID, tenant_id: null, type: "tax_jurisdiction", key: "in-gst-lodging", version: 1,
      effective_from: V1_FROM, effective_to: CUTOVER, content: predecessorContent, status: "retired",
    },
    {
      id: V2_ID, tenant_id: null, type: "tax_jurisdiction", key: "in-gst-lodging", version: 2,
      effective_from: CUTOVER, effective_to: null, content: successorContent, status: "active",
    },
  ]);
}

beforeAll(async () => {
  if (!ADMIN_URL) return;
  const parsed = new URL(requiredAdminUrl());
  const databaseName = parsed.pathname.replace(/^\//, "");
  if (FORBIDDEN_DATABASES.has(databaseName)) {
    throw new Error(`Order 305 admin URL must not point at protected database ${databaseName}`);
  }
  admin = new SQL(requiredAdminUrl(), { max: 2, prepare: false });
  const rows = await admin<{ is_superuser: boolean }[]>`
    SELECT rolsuper AS is_superuser FROM pg_roles WHERE rolname = current_user`;
  if (rows[0]?.is_superuser !== true) {
    throw new Error("Order 305 admin URL must use a PostgreSQL superuser");
  }
});

afterAll(async () => {
  await admin?.close();
  admin = undefined;
});

databaseDescribe("Order 305 fresh PostgreSQL seed/history proof", () => {
  test("first insert, exact replay, visible history, active-only v2 resolution, and zero read effects", async () => {
    await withFreshDatabase(async (databaseUrl, sql) => {
      const first = await runSeed({ databaseUrl, logger: () => undefined });
      expect(first.tenant).toBe("inserted");
      expect(first.property).toBe("inserted");
      expect(first.registry).toBe("inserted");
      await assertCanonicalHistory(sql);

      const replayBefore = await effects(sql);
      const replay = await runSeed({ databaseUrl, logger: () => undefined });
      expect(replay.tenant).toBe("already exact");
      expect(replay.property).toBe("already exact");
      expect(replay.registry).toBe("already exact");
      expect(await effects(sql)).toEqual(replayBefore);

      await sql`
        INSERT INTO tax_assignment (tenant_id, property_node, jurisdiction_key, effective)
        VALUES (${SEED_TENANT.id}::uuid, ${SEED_PROPERTY.id}::uuid, 'in-gst-lodging', daterange('2026-01-01', NULL, '[)'))`;
      const beforeRead = await effects(sql);
      const runtime = new SQL(runtimeUrl(databaseUrl), { max: 2, prepare: false });
      const registry = new ExtensionRegistry(runtime);
      const resolver = new TaxJurisdictionResolutionService(registry);
      const tx = await runtime.reserve();
      let resolved;
      try {
        await tx.unsafe("BEGIN");
        await tx`SELECT set_config('app.tenant_id', ${SEED_TENANT.id}, true)`;
        await tx.unsafe("SET LOCAL ROLE app_role");
        resolved = await resolver.resolve(tx, { propertyNode: SEED_PROPERTY.id, businessDate: "2026-01-01" });
        await tx.unsafe("COMMIT");
      } catch (error) {
        await tx.unsafe("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        tx.release();
        await runtime.close();
      }
      expect(resolved.state).toBe("resolved");
      if (resolved.state === "resolved") {
        expect(resolved.jurisdiction.extensionId).toBe(V2_ID);
        expect(resolved.jurisdiction.version).toBe(2);
        expect(resolved.jurisdiction.effectiveFromInstant).toBe(CUTOVER);
      }
      expect(await effects(sql)).toEqual(beforeRead);
      await assertCanonicalHistory(sql);

      const visible = await sql<Array<{ id: string; version: number; status: string }>>`
        SELECT id::text, version, status
          FROM runtime_visible_extensions(${SEED_TENANT.id}::uuid)
         WHERE type = 'tax_jurisdiction' AND key = 'in-gst-lodging'
         ORDER BY version`;
      expect(visible).toEqual([
        { id: V1_ID, version: 1, status: "retired" },
        { id: V2_ID, version: 2, status: "active" },
      ]);

      // The catalogue is the governed source; this catches accidental duplicate
      // definitions without coupling the proof to unrelated launch entries.
      expect(LAUNCH_EXTENSIONS.filter((entry) => entry.type === "tax_jurisdiction" && entry.key === "in-gst-lodging").length)
        .toBe(2);
    });
  });

  test("a launch-history collision rolls back the complete seed transaction and does not repair the collision", async () => {
    await withFreshDatabase(async (databaseUrl, sql) => {
      await runSeed({ databaseUrl, logger: () => undefined });
      await sql`DELETE FROM extension
                  WHERE type = 'tax_jurisdiction' AND key = 'sa-vat' AND tenant_id IS NULL`;
      const hostileId = "00000000-0000-0000-0000-000000000305";
      const cases: Array<{
        readonly name: string;
        readonly mutate: () => Promise<unknown>;
        readonly restore: () => Promise<unknown>;
      }> = [
        {
          name: "content",
          mutate: async () => sql`UPDATE extension SET content = jsonb_set(content, '{country}', '"XX"'::jsonb) WHERE id = ${V1_ID}::uuid`,
          restore: async () => sql`UPDATE extension SET content = ${JSON.stringify(predecessorContent)}::text::jsonb WHERE id = ${V1_ID}::uuid`,
        },
        {
          name: "predecessor status",
          mutate: async () => sql`UPDATE extension SET status = 'active' WHERE id = ${V1_ID}::uuid`,
          restore: async () => sql`UPDATE extension SET status = 'retired' WHERE id = ${V1_ID}::uuid`,
        },
        {
          name: "successor status",
          mutate: async () => sql`UPDATE extension SET status = 'retired' WHERE id = ${V2_ID}::uuid`,
          restore: async () => sql`UPDATE extension SET status = 'active' WHERE id = ${V2_ID}::uuid`,
        },
        {
          name: "microsecond upper bound",
          mutate: async () => sql`UPDATE extension SET effective = tstzrange(${V1_FROM}::timestamptz, '2025-09-21T18:30:00.000001Z'::timestamptz, '[)') WHERE id = ${V1_ID}::uuid`,
          restore: async () => sql`UPDATE extension SET effective = tstzrange(${V1_FROM}::timestamptz, ${CUTOVER}::timestamptz, '[)') WHERE id = ${V1_ID}::uuid`,
        },
        {
          name: "range inclusivity",
          mutate: async () => sql`UPDATE extension SET effective = tstzrange(${V1_FROM}::timestamptz, ${CUTOVER}::timestamptz, '(]') WHERE id = ${V1_ID}::uuid`,
          restore: async () => sql`UPDATE extension SET effective = tstzrange(${V1_FROM}::timestamptz, ${CUTOVER}::timestamptz, '[)') WHERE id = ${V1_ID}::uuid`,
        },
        {
          name: "version",
          mutate: async () => sql`UPDATE extension SET version = 3 WHERE id = ${V1_ID}::uuid`,
          restore: async () => sql`UPDATE extension SET version = 1 WHERE id = ${V1_ID}::uuid`,
        },
        {
          name: "deterministic id",
          mutate: async () => sql`UPDATE extension SET id = ${hostileId}::uuid WHERE id = ${V1_ID}::uuid`,
          restore: async () => sql`UPDATE extension SET id = ${V1_ID}::uuid WHERE id = ${hostileId}::uuid`,
        },
      ];

      for (const hostile of cases) {
        await hostile.mutate();
        const before = await effects(sql);
        let error: SeedError | undefined;
        try {
          await runSeed({ databaseUrl, logger: () => undefined });
        } catch (candidate) {
          if (!(candidate instanceof SeedError)) throw candidate;
          error = candidate;
        }
        expect(error, hostile.name).toBeDefined();
        expect(error?.message).toContain("Extension instance seed collision for tax_jurisdiction/in-gst-lodging");
        expect(error?.rollbackConnectionUsable).toBe(true);
        expect(error?.roleReset).toBe(true);
        expect(error?.tenantContextCleared).toBe(true);
        expect(await effects(sql)).toEqual(before);
        expect((await sql`SELECT count(*)::int AS count FROM extension WHERE type = 'tax_jurisdiction' AND key = 'sa-vat'`)[0]?.count).toBe(0);
        await hostile.restore();
        await assertCanonicalHistory(sql);
      }
    });
  });
});
