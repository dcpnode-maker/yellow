import type { ReservedSQL, SQL } from "bun";

const GIT_SHA = /^[0-9a-f]{40}$/;
export const CURRENT_MIGRATION_FRONTIER = 85 as const;

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
    fiscalReceiptReadAuthorityExact: boolean;
    fiscalReceiptColumnsProtected: boolean;
    issueFunctionPresent: boolean;
    publicIssueDenied: boolean;
    appIssueDenied: boolean;
    runtimeIssueDenied: boolean;
    q208PublicEntryAuthorityExact: boolean;
    q208PrivateEntryAuthorityExact: boolean;
    q208IndexesExact: boolean;
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
      ('public.runtime_due_india_fiscal_submissions(integer,uuid,uuid)', true),
      ('public.read_india_fiscal_submission_delivery_receipt(uuid,uuid,uuid,uuid)', false)
    ), fiscal_authority AS (
      SELECT count(procedure.oid)=6
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
    ), fiscal_receipt_read AS (
      SELECT count(*)=1 AND bool_and(
        procedure.provolatile='s' AND NOT procedure.proretset
        AND procedure.prorettype='pg_catalog.jsonb'::regtype
      ) AS exact
      FROM pg_catalog.pg_proc procedure
      WHERE procedure.oid=pg_catalog.to_regprocedure(
        'public.read_india_fiscal_submission_delivery_receipt(uuid,uuid,uuid,uuid)'
      )
    ), fiscal_receipt_columns AS (
      SELECT count(DISTINCT relation.oid)=2 AND bool_and(
        NOT pg_catalog.has_table_privilege('app_role',relation.oid,'SELECT')
        AND NOT pg_catalog.has_table_privilege('yellow_runtime',relation.oid,'SELECT')
        AND pg_catalog.has_column_privilege('app_role',relation.oid,attribute.attnum,'SELECT')
          = (relation.relname='fiscal_submission'
             AND attribute.attname IN ('tenant_id','document_id','status'))
        AND NOT pg_catalog.has_column_privilege('yellow_runtime',relation.oid,attribute.attnum,'SELECT')
      ) AS protected
      FROM pg_catalog.pg_class relation
      JOIN pg_catalog.pg_namespace namespace ON namespace.oid=relation.relnamespace
      JOIN pg_catalog.pg_attribute attribute ON attribute.attrelid=relation.oid
        AND attribute.attnum>0 AND NOT attribute.attisdropped
      WHERE namespace.nspname='public' AND relation.relkind='r'
        AND relation.relname IN ('fiscal_submission','fiscal_submission_history')
    ), q208_public_entry(signature, volatility, expected_result, expected_config) AS (VALUES
      ('public.list_india_native_fiscal_documents(uuid,uuid,uuid,date,date,uuid,uuid,text,date,timestamp with time zone,uuid,integer)',
        's', 'TABLE(document_id uuid, business_date date, issued_at timestamp with time zone, summary jsonb, matching_count bigint)',
        ARRAY['search_path=pg_catalog, public','TimeZone=UTC','DateStyle=ISO,YMD']::text[]),
      ('public.read_india_native_fiscal_document(uuid,uuid,uuid,uuid)',
        's', 'jsonb', ARRAY['search_path=pg_catalog, public','TimeZone=UTC','DateStyle=ISO,YMD']::text[]),
      ('public.discover_india_native_fiscal_issue(uuid,uuid,uuid,uuid,uuid,uuid,text,text,date,date[],text[])',
        's', 'jsonb', ARRAY['search_path=pg_catalog, public','TimeZone=UTC','DateStyle=ISO,YMD']::text[]),
      ('public.read_india_fiscal_submission_delivery_receipt_by_document(uuid,uuid,uuid,uuid)',
        's', 'jsonb', ARRAY['search_path=pg_catalog, public, pg_temp','TimeZone=UTC']::text[]),
      ('public.list_india_fiscal_submission_provider_options(uuid,uuid,uuid)',
        's', 'TABLE(extension_id uuid, extension_version integer, provider_key text, label text)',
        ARRAY['search_path=pg_catalog, public, pg_temp','TimeZone=UTC']::text[]),
      ('public.prepare_india_native_fiscal_invoice_v3(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,text,date,date[],text[],text,uuid,text,text)',
        'v', 'TABLE(native_timing_id uuid, request_event_id uuid, posting_binding_id uuid, prepared_source_json text, completed_receipt jsonb)',
        ARRAY['search_path=pg_catalog, public','TimeZone=UTC','DateStyle=ISO,YMD']::text[]),
      ('public.prepare_india_native_fiscal_invoice_v4(uuid,uuid,uuid,uuid,uuid,uuid,text,text,date,date[],text[],text,uuid,text,text)',
        'v', 'TABLE(native_timing_id uuid, request_event_id uuid, posting_binding_id uuid, prepared_source_json text, completed_receipt jsonb, internal_selectors jsonb)',
        ARRAY['search_path=pg_catalog, public','TimeZone=UTC','DateStyle=ISO,YMD']::text[])
    ), q208_public_authority AS (
      SELECT count(procedure.oid)=7 AND bool_and(
        procedure.proowner='yellow_owner'::regrole AND procedure.prosecdef
        AND procedure.provolatile::text=q208_public_entry.volatility
        AND procedure.proconfig=q208_public_entry.expected_config
        AND pg_catalog.pg_get_function_result(procedure.oid)=q208_public_entry.expected_result
        AND pg_catalog.has_function_privilege('app_role',procedure.oid,'EXECUTE')
        AND NOT pg_catalog.has_function_privilege('yellow_runtime',procedure.oid,'EXECUTE')
        AND NOT EXISTS(
          SELECT 1 FROM pg_catalog.aclexplode(COALESCE(
            procedure.proacl,pg_catalog.acldefault('f',procedure.proowner)
          )) privilege WHERE privilege.grantee=0 AND privilege.privilege_type='EXECUTE'
        )
      ) AS exact
      FROM q208_public_entry
      LEFT JOIN pg_catalog.pg_proc procedure
        ON procedure.oid=pg_catalog.to_regprocedure(q208_public_entry.signature)
    ), q208_private_entry(signature, volatility, expected_config) AS (VALUES
      ('public.read_india_native_document_context_candidate(uuid,uuid,uuid,uuid,uuid,uuid)',
        's', ARRAY['search_path=pg_catalog, public','TimeZone=UTC','DateStyle=ISO,YMD']::text[]),
      ('public.compose_india_native_operator_confirmation_v1(uuid,uuid,uuid,uuid,uuid,text,jsonb,jsonb,text,text,jsonb,jsonb)',
        'i', ARRAY['search_path=pg_catalog, public','TimeZone=UTC','DateStyle=ISO,YMD']::text[])
    ), q208_private_authority AS (
      SELECT count(procedure.oid)=2 AND bool_and(
        procedure.proowner='yellow_owner'::regrole AND NOT procedure.prosecdef
        AND procedure.provolatile::text=q208_private_entry.volatility
        AND procedure.proconfig=q208_private_entry.expected_config
        AND pg_catalog.pg_get_function_result(procedure.oid)='jsonb'
        AND NOT pg_catalog.has_function_privilege('app_role',procedure.oid,'EXECUTE')
        AND NOT pg_catalog.has_function_privilege('yellow_runtime',procedure.oid,'EXECUTE')
        AND NOT EXISTS(
          SELECT 1 FROM pg_catalog.aclexplode(COALESCE(
            procedure.proacl,pg_catalog.acldefault('f',procedure.proowner)
          )) privilege WHERE privilege.grantee=0 AND privilege.privilege_type='EXECUTE'
        )
      ) AS exact
      FROM q208_private_entry
      LEFT JOIN pg_catalog.pg_proc procedure
        ON procedure.oid=pg_catalog.to_regprocedure(q208_private_entry.signature)
    ), q208_index(index_name, table_name, key_columns, key_options, predicate) AS (VALUES
      ('india_native_operator_document_queue','document',
        ARRAY['tenant_id','property_node','business_date','issued_at','id']::text[],
        '0 0 3 3 3',
        '((kind = ''invoice''::text) AND (status = ''issued''::text))'),
      ('india_native_operator_submission_document','fiscal_submission',
        ARRAY['tenant_id','property_node','document_id','id']::text[],
        '0 0 0 0',NULL::text)
    ), q208_index_shape AS (
      SELECT count(index_relation.oid)=2 AND bool_and(
        index_namespace.nspname='public' AND table_namespace.nspname='public'
        AND table_relation.relname=q208_index.table_name
        AND index_relation.relowner='yellow_owner'::regrole AND access_method.amname='btree'
        AND index_row.indisvalid AND index_row.indisready AND index_row.indislive
        AND NOT index_row.indisunique AND NOT index_row.indisprimary AND NOT index_row.indisexclusion
        AND index_row.indnatts=index_row.indnkeyatts
        AND ARRAY(
          SELECT pg_catalog.pg_get_indexdef(index_relation.oid,key_ordinal,true)
          FROM pg_catalog.generate_series(1,index_row.indnkeyatts) key_ordinal
          ORDER BY key_ordinal
        )=q208_index.key_columns
        AND index_row.indoption::text=q208_index.key_options
        AND CASE WHEN q208_index.predicate IS NULL THEN index_row.indpred IS NULL
          ELSE pg_catalog.pg_get_expr(index_row.indpred,index_row.indrelid)=q208_index.predicate END
      ) AS exact
      FROM q208_index
      LEFT JOIN pg_catalog.pg_class index_relation ON index_relation.relname=q208_index.index_name
      LEFT JOIN pg_catalog.pg_namespace index_namespace ON index_namespace.oid=index_relation.relnamespace
      LEFT JOIN pg_catalog.pg_index index_row ON index_row.indexrelid=index_relation.oid
      LEFT JOIN pg_catalog.pg_class table_relation ON table_relation.oid=index_row.indrelid
      LEFT JOIN pg_catalog.pg_namespace table_namespace ON table_namespace.oid=table_relation.relnamespace
      LEFT JOIN pg_catalog.pg_am access_method ON access_method.oid=index_relation.relam
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
        AND bool_and(NOT pg_catalog.has_table_privilege('app_role',relation.oid,'SELECT'))
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
      receipt_read.exact AS "fiscalReceiptReadAuthorityExact",
      receipt_columns.protected AS "fiscalReceiptColumnsProtected",
      q208_public.exact AS "q208PublicEntryAuthorityExact",
      q208_private.exact AS "q208PrivateEntryAuthorityExact",
      q208_indexes.exact AS "q208IndexesExact",
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
      CROSS JOIN fiscal_receipt_read receipt_read CROSS JOIN fiscal_receipt_columns receipt_columns
      CROSS JOIN q208_public_authority q208_public
      CROSS JOIN q208_private_authority q208_private CROSS JOIN q208_index_shape q208_indexes
  `;
  const proof = rows[0];
  if (rows.length !== 1 || !proof || Object.values(proof).some((value) => value !== true)) {
    throw new Error("runtime release readiness is unavailable");
  }
  let permission: Array<{ exact: boolean }>;
  try {
    permission = await sql.begin("read only", async (transaction) => {
      await transaction.unsafe("SET LOCAL ROLE app_role");
      return transaction<Array<{ exact: boolean }>>`
        SELECT count(*)=1 AS exact
        FROM public.permission
        WHERE code='tax-fiscal.documents:read'
      `;
    });
  } catch {
    throw new Error("runtime release readiness is unavailable");
  }
  if (permission.length !== 1 || permission[0]?.exact !== true) {
    throw new Error("runtime release readiness is unavailable");
  }
}
