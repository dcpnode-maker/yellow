import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import { Database } from "../src/kernel";

const DEPLOY_DATABASE_URL = process.env.YELLOW_DEPLOY_DATABASE_URL ?? process.env.YELLOW_BUSINESS_DAY_SEAL_URL;
const RUNTIME_DATABASE_URL = process.env.YELLOW_RUNTIME_DATABASE_URL ?? process.env.YELLOW_BUSINESS_DAY_SEAL_URL;
if (process.env.YELLOW_REQUIRE_BUSINESS_DAY_SEAL === "1" && (!DEPLOY_DATABASE_URL || !RUNTIME_DATABASE_URL)) {
  throw new Error("YELLOW_DEPLOY_DATABASE_URL and YELLOW_RUNTIME_DATABASE_URL are required by the Order 124 proof");
}

const TENANT_A = "00000000-0000-0000-0000-000000012401";
const TENANT_B = "00000000-0000-0000-0000-000000012402";
const PROPERTY_A = "00000000-0000-0000-0000-000000012411";
const PROPERTY_B = "00000000-0000-0000-0000-000000012412";
const ACTOR_A = "00000000-0000-0000-0000-000000012421";
const BUSINESS_DATE = "2026-08-24";
const OWNER_DATE = "2026-08-25";
const MISSING_DATE = "2026-08-26";

const databaseDescribe = DEPLOY_DATABASE_URL && RUNTIME_DATABASE_URL ? describe.serial : describe.skip;
const admin = DEPLOY_DATABASE_URL ? new SQL(DEPLOY_DATABASE_URL, { max: 1 }) : undefined;
const database = RUNTIME_DATABASE_URL ? Database.connect(RUNTIME_DATABASE_URL, { maxConnections: 1 }) : undefined;

function sqlState(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const candidate = error as { errno?: unknown; code?: unknown };
  if (typeof candidate.errno === "string") return candidate.errno;
  return typeof candidate.code === "string" ? candidate.code : undefined;
}

async function captureState(operation: () => Promise<unknown>): Promise<string | undefined> {
  try {
    await operation();
  } catch (error) {
    return sqlState(error);
  }
  return undefined;
}

beforeAll(async () => {
  if (!admin) return;
  await admin.unsafe(`
    INSERT INTO public.tenant (id, slug, name) VALUES
      ('${TENANT_A}', 'order124-a', 'Order 124 A'),
      ('${TENANT_B}', 'order124-b', 'Order 124 B');
    INSERT INTO public.org_node
      (id, tenant_id, path, kind, name, timezone, currency) VALUES
      ('${PROPERTY_A}', '${TENANT_A}', 'order124_a', 'property', 'Order 124 A', 'UTC', 'USD'),
      ('${PROPERTY_B}', '${TENANT_B}', 'order124_b', 'property', 'Order 124 B', 'UTC', 'USD');
    INSERT INTO public.app_user (id, tenant_id, email, display_name, status) VALUES
      ('${ACTOR_A}', '${TENANT_A}', 'actor@order124.test', 'Order 124 chosen actor', 'active');
    INSERT INTO public.business_day (tenant_id, property_node, business_date) VALUES
      ('${TENANT_A}', '${PROPERTY_A}', DATE '${BUSINESS_DATE}'),
      ('${TENANT_A}', '${PROPERTY_A}', DATE '${OWNER_DATE}'),
      ('${TENANT_B}', '${PROPERTY_B}', DATE '${BUSINESS_DATE}');
  `);
});

afterAll(async () => {
  if (admin) {
    await admin.unsafe(`
      DELETE FROM public.business_day WHERE tenant_id IN ('${TENANT_A}', '${TENANT_B}');
      DELETE FROM public.app_user WHERE id = '${ACTOR_A}';
      DELETE FROM public.org_node WHERE id IN ('${PROPERTY_A}', '${PROPERTY_B}');
      DELETE FROM public.tenant WHERE id IN ('${TENANT_A}', '${TENANT_B}');
    `).catch(() => undefined);
  }
  await database?.close();
  await admin?.close();
});

databaseDescribe("Order 124 business-day seal authority containment", () => {
  test("P0: PUBLIC/prune/tenant protections stay green while app seal authority is denied", async () => {
    const privilege = await admin!<Array<{ publicExecute: boolean; appExecute: boolean }>>`
      SELECT has_function_privilege(
               'public', 'public.seal_business_day(uuid,uuid,date,uuid)', 'EXECUTE'
             ) AS "publicExecute",
             has_function_privilege(
               'app_role', 'public.seal_business_day(uuid,uuid,date,uuid)', 'EXECUTE'
             ) AS "appExecute"
    `;

    const negativePruneState = await captureState(
      () => admin!`SELECT public.prune_outbox(interval '-1 second')`,
    );
    const mismatchedTenantState = await captureState(
      () => database!.withTenantTransaction(TENANT_A, (tx) => tx`
        SELECT public.seal_business_day(
          ${TENANT_B}::uuid, ${PROPERTY_B}::uuid, ${BUSINESS_DATE}::date, ${ACTOR_A}::uuid
        )
      `),
    );
    const ownTenantState = await captureState(
      () => database!.withTenantTransaction(TENANT_A, (tx) => tx`
        SELECT public.seal_business_day(
          ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, ${BUSINESS_DATE}::date, ${ACTOR_A}::uuid
        )
      `),
    );
    const day = await admin!<Array<{ sealed: boolean; sealedBy: string | null }>>`
      SELECT sealed_at IS NOT NULL AS sealed, sealed_by::text AS "sealedBy"
        FROM public.business_day
       WHERE tenant_id = ${TENANT_A}::uuid
         AND property_node = ${PROPERTY_A}::uuid
         AND business_date = ${BUSINESS_DATE}::date
    `;

    expect({
      publicExecute: privilege[0]?.publicExecute,
      negativePruneState,
      mismatchedTenantState,
      appExecute: privilege[0]?.appExecute,
      ownTenantState,
      day: day[0],
    }).toEqual({
      publicExecute: false,
      negativePruneState: "22023",
      mismatchedTenantState: "42501",
      appExecute: false,
      ownTenantState: "42501",
      day: { sealed: false, sealedBy: null },
    });
  });

  test("P1: migration ledger and exact owner-only seal ACL are present", async () => {
    const ledger = await admin!<Array<{ version: number | bigint; filename: string; checksum: string }>>`
      SELECT version, filename, checksum_sha256 AS checksum
        FROM public.schema_migration
       WHERE version = 13
    `;
    expect(ledger.map((row) => ({ ...row, version: Number(row.version) }))).toEqual([{
      version: 13,
      filename: "0013_revoke_app_role_business_day_seal.sql",
      checksum: "75aef629ebc90a7c2ba3dcf94532295cfce57fc521197d7b5cdc6b6d5a1bf712",
    }]);

    const authority = await admin!<Array<{
      ownerMatches: boolean;
      ownerExecute: boolean;
      publicExecute: boolean;
      appExecute: boolean;
      securityDefiner: boolean;
      config: string[];
      source: string;
    }>>`
      SELECT pg_get_userbyid(p.proowner) = 'yellow_owner' AS "ownerMatches",
             has_function_privilege('yellow_owner', p.oid, 'EXECUTE') AS "ownerExecute",
             has_function_privilege('public', p.oid, 'EXECUTE') AS "publicExecute",
             has_function_privilege('app_role', p.oid, 'EXECUTE') AS "appExecute",
             p.prosecdef AS "securityDefiner",
             p.proconfig AS config,
             p.prosrc AS source
        FROM pg_catalog.pg_proc AS p
       WHERE p.oid = 'public.seal_business_day(uuid,uuid,date,uuid)'::regprocedure
    `;
    expect(authority).toEqual([{
      ownerMatches: true,
      ownerExecute: true,
      publicExecute: false,
      appExecute: false,
      securityDefiner: true,
      config: ["search_path=pg_catalog, public, pg_temp"],
      source: expect.stringContaining("UPDATE public.business_day"),
    }]);
  });

  test("P2: deployment owner preserves the exact one-way seal latch", async () => {
    await admin!`
      SELECT public.seal_business_day(
        ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, ${OWNER_DATE}::date, ${ACTOR_A}::uuid
      )
    `;
    const sealed = await admin!<Array<{ sealed: boolean; sealedBy: string | null }>>`
      SELECT sealed_at IS NOT NULL AS sealed, sealed_by::text AS "sealedBy"
        FROM public.business_day
       WHERE tenant_id = ${TENANT_A}::uuid
         AND property_node = ${PROPERTY_A}::uuid
         AND business_date = ${OWNER_DATE}::date
    `;
    expect(sealed).toEqual([{ sealed: true, sealedBy: ACTOR_A }]);
    expect(await captureState(() => admin!`
      SELECT public.seal_business_day(
        ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, ${OWNER_DATE}::date, ${ACTOR_A}::uuid
      )
    `)).toBe("P0012");
    expect(await captureState(() => admin!`
      SELECT public.seal_business_day(
        ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, ${MISSING_DATE}::date, ${ACTOR_A}::uuid
      )
    `)).toBe("P0012");
  });
});
