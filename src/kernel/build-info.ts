import type { ReservedSQL, SQL } from "bun";

const GIT_SHA = /^[0-9a-f]{40}$/;
export const CURRENT_MIGRATION_FRONTIER = 75 as const;

export interface BuildInfo {
  readonly schemaVersion: 1;
  readonly revision: string | null;
  readonly expectedMigrationFrontier: typeof CURRENT_MIGRATION_FRONTIER;
}

export const UNKNOWN_BUILD_INFO: BuildInfo = Object.freeze({
  schemaVersion: 1,
  revision: null,
  expectedMigrationFrontier: CURRENT_MIGRATION_FRONTIER,
});

/**
 * Reads immutable source identity injected by the image build or local review
 * launcher. A malformed value is a packaging error, so startup fails instead of
 * publishing a misleading revision.
 */
export function buildInfoFromEnvironment(
  environment: Readonly<Record<string, string | undefined>>,
): BuildInfo {
  const value = environment.YELLOW_BUILD_SHA;
  if (value === undefined || value === "") return UNKNOWN_BUILD_INFO;
  if (value !== value.trim() || !GIT_SHA.test(value)) {
    throw new Error("YELLOW_BUILD_SHA must be an exact lowercase 40-character Git commit SHA");
  }
  return Object.freeze({
    schemaVersion: 1 as const,
    revision: value,
    expectedMigrationFrontier: CURRENT_MIGRATION_FRONTIER,
  });
}

/**
 * Proves the bounded database contract required by the released operator app.
 * The deployment ledger remains deployment-only; this checks only runtime-visible
 * catalogue identity and the release containment boundary.
 */
export async function assertRuntimeReleaseReadiness(
  sql: SQL | ReservedSQL,
): Promise<void> {
  const rows = await sql<Array<{
    runtimeIdentity: boolean;
    coreSchemaPresent: boolean;
    issueFunctionPresent: boolean;
    publicIssueDenied: boolean;
    appIssueDenied: boolean;
    runtimeIssueDenied: boolean;
  }>>`
    WITH release_target AS (
      SELECT pg_catalog.to_regprocedure(
        'public.commit_india_native_fiscal_invoice(uuid,uuid,uuid,uuid,uuid,uuid,text,jsonb,uuid)'
      ) AS function_oid
    )
    SELECT
      session_user = 'yellow_runtime' AND current_user = 'yellow_runtime'
        AS "runtimeIdentity",
      pg_catalog.to_regclass('public.tenant') IS NOT NULL
        AND pg_catalog.to_regclass('public.fact_log') IS NOT NULL
        AND pg_catalog.to_regclass('public.outbox') IS NOT NULL
        AND pg_catalog.to_regclass('public.schema_migration') IS NOT NULL
        AS "coreSchemaPresent",
      target.function_oid IS NOT NULL AS "issueFunctionPresent",
      NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_proc target_procedure
        CROSS JOIN LATERAL pg_catalog.aclexplode(
          COALESCE(
            target_procedure.proacl,
            pg_catalog.acldefault('f', target_procedure.proowner)
          )
        ) privilege
        WHERE target_procedure.oid = target.function_oid
          AND privilege.grantee = 0
          AND privilege.privilege_type = 'EXECUTE'
      ) AS "publicIssueDenied",
      COALESCE(
        NOT pg_catalog.has_function_privilege('app_role', target.function_oid, 'EXECUTE'),
        false
      ) AS "appIssueDenied",
      COALESCE(
        NOT pg_catalog.has_function_privilege('yellow_runtime', target.function_oid, 'EXECUTE'),
        false
      ) AS "runtimeIssueDenied"
    FROM release_target target
  `;
  const proof = rows[0];
  if (rows.length !== 1 || !proof || Object.values(proof).some((value) => value !== true)) {
    throw new Error("runtime release readiness is unavailable");
  }
}
