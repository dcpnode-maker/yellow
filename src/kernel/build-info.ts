import type { ReservedSQL, SQL } from "bun";

const GIT_SHA = /^[0-9a-f]{40}$/;
export const CURRENT_MIGRATION_FRONTIER = 80 as const;

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
    nativeSourceSchemaPresent: boolean;
    nativeEntryAuthorityExact: boolean;
    fiscalHistoryProtected: boolean;
    fiscalEntryAuthorityExact: boolean;
    issueFunctionPresent: boolean;
    publicIssueDenied: boolean;
    appIssueDenied: boolean;
    runtimeIssueDenied: boolean;
  }>>`
    WITH release_target AS (
      SELECT pg_catalog.to_regprocedure(
        'public.commit_india_native_fiscal_invoice(uuid,uuid,uuid,uuid,uuid,uuid,text,jsonb,uuid)'
      ) AS function_oid
    ), native_entry(signature) AS (VALUES
      ('public.prepare_india_native_fiscal_invoice_v2(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,text,date,date[],text[],text,uuid)'),
      ('public.consume_india_native_fiscal_accounting_event(uuid,uuid)'),
      ('public.read_india_native_accounting_source_closure(uuid,uuid)'),
      ('public.commit_india_native_fiscal_invoice_v2(uuid,uuid,uuid,uuid,text,jsonb,uuid)'),
      ('public.create_approval_request_with_options(uuid,uuid,uuid,uuid,text,text,uuid,jsonb,timestamptz)')
    ), native_source_schema AS (
      SELECT count(*)=2 AS exact FROM pg_catalog.pg_class relation
      JOIN pg_catalog.pg_namespace namespace ON namespace.oid=relation.relnamespace
      WHERE namespace.nspname='public' AND relation.relkind='r'
        AND relation.relname IN (
          'india_gst_accommodation_ordinary_regime_evidence','india_gst_native_invoice_timing'
        )
    ), native_authority AS (
      SELECT count(procedure.oid)=5
        AND bool_and(pg_catalog.has_function_privilege('app_role',procedure.oid,'EXECUTE'))
        AND bool_and(NOT pg_catalog.has_function_privilege('yellow_runtime',procedure.oid,'EXECUTE'))
        AND bool_and(NOT EXISTS(
          SELECT 1 FROM pg_catalog.aclexplode(COALESCE(
            procedure.proacl,pg_catalog.acldefault('f',procedure.proowner)
          )) privilege WHERE privilege.grantee=0 AND privilege.privilege_type='EXECUTE'
        )) AS exact
      FROM native_entry
      LEFT JOIN pg_catalog.pg_proc procedure
        ON procedure.oid=pg_catalog.to_regprocedure(native_entry.signature)
    ), fiscal_entry(signature, runtime_allowed) AS (VALUES
      ('public.request_india_fiscal_submission(uuid,uuid,uuid,uuid,uuid,text,uuid)', false),
      ('public.retry_india_fiscal_submission(uuid,uuid,uuid,text,uuid)', false),
      ('public.claim_india_fiscal_submission(uuid,uuid,integer)', true),
      ('public.reconcile_india_fiscal_submission(uuid,uuid,uuid,uuid,jsonb)', true),
      ('public.runtime_due_india_fiscal_submissions(integer,uuid,uuid)', true)
    ), fiscal_authority AS (
      SELECT count(procedure.oid)=5
        AND bool_and(procedure.prosecdef AND procedure.proowner='yellow_owner'::regrole)
        AND bool_and(procedure.proconfig = ARRAY[
          'search_path=pg_catalog, public, pg_temp','TimeZone=UTC','DateStyle=ISO,YMD'
        ])
        AND bool_and(pg_catalog.has_function_privilege('app_role',procedure.oid,'EXECUTE')
          = (NOT fiscal_entry.runtime_allowed))
        AND bool_and(pg_catalog.has_function_privilege('yellow_runtime',procedure.oid,'EXECUTE')
          = fiscal_entry.runtime_allowed)
        AND bool_and(NOT EXISTS(
          SELECT 1 FROM pg_catalog.aclexplode(COALESCE(
            procedure.proacl,pg_catalog.acldefault('f',procedure.proowner)
          )) privilege WHERE privilege.grantee=0 AND privilege.privilege_type='EXECUTE'
        )) AS exact
      FROM fiscal_entry
      LEFT JOIN pg_catalog.pg_proc procedure
        ON procedure.oid=pg_catalog.to_regprocedure(fiscal_entry.signature)
    ), fiscal_history AS (
      SELECT count(*)=1
        AND bool_and(relation.relrowsecurity AND relation.relforcerowsecurity
          AND relation.relowner='yellow_owner'::regrole)
        AND bool_and((
          SELECT count(*)=1 AND bool_and(
            policy.polname='tenant_isolation' AND policy.polcmd='*'
            AND policy.polpermissive AND policy.polroles=ARRAY[0]::oid[]
            AND pg_catalog.pg_get_expr(policy.polqual,policy.polrelid)
              = '(tenant_id = (NULLIF(current_setting(''app.tenant_id''::text, true), ''''::text))::uuid)'
            AND pg_catalog.pg_get_expr(policy.polwithcheck,policy.polrelid)
              = '(tenant_id = (NULLIF(current_setting(''app.tenant_id''::text, true), ''''::text))::uuid)'
          ) FROM pg_catalog.pg_policy policy WHERE policy.polrelid=relation.oid
        ))
        AND bool_and(NOT EXISTS(
          SELECT 1 FROM pg_catalog.aclexplode(COALESCE(
            relation.relacl,pg_catalog.acldefault('r',relation.relowner)
          )) privilege WHERE privilege.grantee=0
        ))
        AND bool_and(pg_catalog.has_table_privilege('app_role',relation.oid,'SELECT'))
        AND bool_and(NOT pg_catalog.has_table_privilege('app_role',relation.oid,'INSERT,UPDATE,DELETE,TRUNCATE'))
        AND bool_and(NOT pg_catalog.has_table_privilege('yellow_runtime',relation.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE'))
        AS protected
      FROM pg_catalog.pg_class relation
      JOIN pg_catalog.pg_namespace namespace ON namespace.oid=relation.relnamespace
      WHERE namespace.nspname='public' AND relation.relkind='r'
        AND relation.relname='fiscal_submission_history'
    )
    SELECT
      session_user = 'yellow_runtime' AND current_user = 'yellow_runtime'
        AS "runtimeIdentity",
      pg_catalog.to_regclass('public.tenant') IS NOT NULL
        AND pg_catalog.to_regclass('public.fact_log') IS NOT NULL
        AND pg_catalog.to_regclass('public.outbox') IS NOT NULL
        AND pg_catalog.to_regclass('public.schema_migration') IS NOT NULL
        AS "coreSchemaPresent",
      source_schema.exact AS "nativeSourceSchemaPresent",
      authority.exact AS "nativeEntryAuthorityExact",
      history.protected AS "fiscalHistoryProtected",
      fiscal.exact AS "fiscalEntryAuthorityExact",
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
    FROM release_target target CROSS JOIN native_source_schema source_schema
      CROSS JOIN native_authority authority
      CROSS JOIN fiscal_authority fiscal CROSS JOIN fiscal_history history
  `;
  const proof = rows[0];
  if (rows.length !== 1 || !proof || Object.values(proof).some((value) => value !== true)) {
    throw new Error("runtime release readiness is unavailable");
  }
}
