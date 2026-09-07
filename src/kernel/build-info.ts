import type { ReservedSQL, SQL } from "bun";

const GIT_SHA = /^[0-9a-f]{40}$/;
export const CURRENT_MIGRATION_FRONTIER = 88 as const;

// PostgreSQL16's normalized form of0087's Unicode-aware, nonblank reason CHECK.
// Keep invisible Unicode separators escaped in source so reviews remain legible.
const CREDIT_REASON_WHITESPACE = "\u0020\u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff";
const CREDIT_REASON_CHECK = "(((char_length(reason) >= 1) AND (char_length(reason) <= 500))"
  + " AND (btrim(reason, '" + CREDIT_REASON_WHITESPACE + "'::text) <> ''::text)"
  + " AND (reason !~ '[\\x01-\\x1f\\x7f]'::text))";

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
    fiscalRetryBindingAuthorityExact: boolean;
    fiscalReceiptColumnsProtected: boolean;
    issueFunctionPresent: boolean;
    publicIssueDenied: boolean;
    appIssueDenied: boolean;
    runtimeIssueDenied: boolean;
    q208PublicEntryAuthorityExact: boolean;
    q208PrivateEntryAuthorityExact: boolean;
    q208IndexesExact: boolean;
    nativeCreditBindingProtected: boolean;
    nativeCreditEntryAuthorityExact: boolean;
    nativeCreditPrivateAuthorityExact: boolean;
    nativeCreditFiscalProjectionExact: boolean;
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
    ), fiscal_retry_binding AS (
      SELECT count(procedure.oid)=1 AND bool_and(
        procedure.proowner='yellow_owner'::regrole
        AND procedure.provolatile='i' AND NOT procedure.prosecdef
        AND NOT procedure.proisstrict AND procedure.proparallel='u'
        AND NOT procedure.proleakproof AND NOT procedure.proretset
        AND procedure.prorettype='pg_catalog.jsonb'::regtype
        AND procedure.proconfig=ARRAY['search_path=pg_catalog, public']
        AND language.lanname='sql'
        AND NOT pg_catalog.has_function_privilege('app_role',procedure.oid,'EXECUTE')
        AND NOT pg_catalog.has_function_privilege('yellow_runtime',procedure.oid,'EXECUTE')
        AND NOT EXISTS(
          SELECT 1 FROM pg_catalog.aclexplode(COALESCE(
            procedure.proacl,pg_catalog.acldefault('f',procedure.proowner)
          )) privilege WHERE privilege.grantee=0 AND privilege.privilege_type='EXECUTE'
        )
        AND pg_catalog.strpos(pg_catalog.pg_get_functiondef(receipt.oid),
          'public.india_fiscal_submission_retry_binding_v1(')>0
      ) AS exact
      FROM pg_catalog.pg_proc procedure
      JOIN pg_catalog.pg_language language ON language.oid=procedure.prolang
      LEFT JOIN pg_catalog.pg_proc receipt ON receipt.oid=pg_catalog.to_regprocedure(
        'public.read_india_fiscal_submission_delivery_receipt(uuid,uuid,uuid,uuid)'
      )
      WHERE procedure.oid=pg_catalog.to_regprocedure(
        'public.india_fiscal_submission_retry_binding_v1(text,text,text,uuid,integer)'
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
    ), credit_public_entry(signature, expected_result, expected_config) AS (VALUES
      ('public.commit_india_native_fiscal_credit_note(uuid,uuid,uuid,uuid,text,text,uuid)',
        'TABLE(receipt_json text, replayed boolean)',
        ARRAY['search_path=pg_catalog, public, pg_temp','TimeZone=UTC','DateStyle=ISO,YMD']::text[]),
      ('public.read_india_native_fiscal_credit_note(uuid,uuid,uuid,uuid)',
        'text', ARRAY['search_path=pg_catalog, public, pg_temp']::text[])
    ), credit_public_authority AS (
      SELECT count(procedure.oid)=2 AND bool_and(
        procedure.proowner='yellow_owner'::regrole AND procedure.prosecdef
        AND procedure.provolatile='v' AND NOT procedure.proisstrict
        AND procedure.prokind='f' AND procedure.proparallel='u' AND NOT procedure.proleakproof
        AND procedure.proconfig=credit_public_entry.expected_config
        AND pg_catalog.pg_get_function_result(procedure.oid)=credit_public_entry.expected_result
        AND pg_catalog.has_function_privilege('app_role',procedure.oid,'EXECUTE')
        AND NOT pg_catalog.has_function_privilege('yellow_runtime',procedure.oid,'EXECUTE')
        AND NOT EXISTS(SELECT 1 FROM pg_catalog.aclexplode(COALESCE(
          procedure.proacl,pg_catalog.acldefault('f',procedure.proowner)
        )) privilege WHERE privilege.grantee=0 AND privilege.privilege_type='EXECUTE')
      ) AS exact
      FROM credit_public_entry LEFT JOIN pg_catalog.pg_proc procedure
        ON procedure.oid=pg_catalog.to_regprocedure(credit_public_entry.signature)
    ), credit_private_entry(signature, security_definer, volatility, expected_result) AS (VALUES
      ('public.prevent_india_native_credit_mutation()',true,'v','trigger'),
      ('public.india_native_credit_line_templates(uuid,uuid)',false,'v','jsonb'),
      ('public.assert_india_native_credit_authority(uuid,uuid,uuid,text[],boolean)',false,'v','void'),
      ('public.guard_india_native_credit_birth()',true,'v','trigger'),
      ('public.guard_india_native_credit_artifact()',true,'v','trigger'),
      ('public.assert_india_native_credit_complete()',true,'v','trigger'),
      ('public.india_native_consideration_roots(uuid,uuid,uuid)',false,'s','uuid[]'),
      ('public.india_native_journal_is_consumed(uuid,uuid)',false,'s','boolean'),
      ('public.india_native_root_is_consumed(uuid,uuid)',false,'s','boolean'),
      ('public.guard_india_native_consumed_posting_line()',true,'v','trigger')
    ), credit_private_authority AS (
      SELECT count(procedure.oid)=10 AND bool_and(
        procedure.proowner='yellow_owner'::regrole
        AND procedure.prosecdef=credit_private_entry.security_definer
        AND procedure.provolatile::text=credit_private_entry.volatility
        AND pg_catalog.pg_get_function_result(procedure.oid)=credit_private_entry.expected_result
        AND procedure.prokind='f' AND NOT procedure.proisstrict AND NOT procedure.proretset
        AND procedure.proparallel='u' AND NOT procedure.proleakproof
        AND procedure.proconfig=CASE
          WHEN credit_private_entry.signature='public.assert_india_native_credit_complete()'
            THEN ARRAY['search_path=pg_catalog, public, pg_temp','TimeZone=UTC','DateStyle=ISO,YMD']::text[]
          ELSE ARRAY['search_path=pg_catalog, public, pg_temp']::text[] END
        AND NOT pg_catalog.has_function_privilege('app_role',procedure.oid,'EXECUTE')
        AND NOT pg_catalog.has_function_privilege('yellow_runtime',procedure.oid,'EXECUTE')
        AND NOT EXISTS(SELECT 1 FROM pg_catalog.aclexplode(COALESCE(
          procedure.proacl,pg_catalog.acldefault('f',procedure.proowner)
        )) privilege WHERE privilege.grantee=0 AND privilege.privilege_type='EXECUTE')
      ) AS exact
      FROM credit_private_entry LEFT JOIN pg_catalog.pg_proc procedure
        ON procedure.oid=pg_catalog.to_regprocedure(credit_private_entry.signature)
    ), credit_fiscal_projection AS (
      -- Exact independently executed0088 body; a copied CRN marker is not readiness.
      SELECT count(procedure.oid)=1 AND bool_and(
        procedure.proowner='yellow_owner'::regrole AND language.lanname='plpgsql'
        AND procedure.prokind='f' AND NOT procedure.prosecdef
        AND procedure.provolatile='v' AND NOT procedure.proisstrict AND NOT procedure.proretset
        AND procedure.proparallel='u' AND NOT procedure.proleakproof
        AND procedure.pronargs=3 AND procedure.pronargdefaults=0
        AND procedure.provariadic=0 AND procedure.proallargtypes IS NULL
        AND pg_catalog.pg_get_function_result(procedure.oid)='jsonb'
        AND procedure.proconfig=ARRAY[
          'search_path=pg_catalog, public, pg_temp','TimeZone=UTC','DateStyle=ISO,YMD'
        ]::text[]
        AND pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
          pg_catalog.replace(procedure.prosrc,chr(13)||chr(10),chr(10)),'UTF8'
        )),'hex')='b34eaf0095dad0df5cd55453b7e4bd1a42f5ae698a02c5ebca3dcac7645c9f96'
        AND pg_catalog.has_function_privilege('yellow_owner',procedure.oid,'EXECUTE')
        AND NOT pg_catalog.has_function_privilege('app_role',procedure.oid,'EXECUTE')
        AND NOT pg_catalog.has_function_privilege('yellow_runtime',procedure.oid,'EXECUTE')
        AND (SELECT count(*)=1 AND bool_and(
          privilege.privilege_type='EXECUTE' AND NOT privilege.is_grantable
        ) FROM pg_catalog.aclexplode(procedure.proacl) privilege)
        AND NOT EXISTS(SELECT 1 FROM pg_catalog.aclexplode(procedure.proacl) privilege
          WHERE privilege.grantee<>procedure.proowner OR privilege.grantor<>procedure.proowner)
      ) AS exact
      FROM pg_catalog.pg_proc procedure
      JOIN pg_catalog.pg_language language ON language.oid=procedure.prolang
      WHERE procedure.oid=pg_catalog.to_regprocedure(
        'public.india_fiscal_submission_project_wire(uuid,uuid,uuid)'
      )
    ), credit_trigger(table_name, trigger_name, function_signature, trigger_type, deferred) AS (VALUES
      ('india_native_fiscal_credit_note','india_native_credit_immutable','public.prevent_india_native_credit_mutation()',27,false),
      ('india_native_fiscal_credit_note','india_native_credit_birth','public.guard_india_native_credit_birth()',7,false),
      ('india_native_fiscal_credit_note','india_native_credit_complete','public.assert_india_native_credit_complete()',5,true),
      ('document','india_native_credit_document_immutable','public.guard_india_native_credit_artifact()',27,false),
      ('journal','india_native_credit_journal_immutable','public.guard_india_native_credit_artifact()',27,false),
      ('posting_line','india_native_credit_line_immutable','public.guard_india_native_credit_artifact()',27,false),
      ('posting_line','india_native_consumed_posting_line_guard','public.guard_india_native_consumed_posting_line()',7,false)
    ), credit_trigger_shape AS (
      SELECT count(trigger_row.oid)=7 AND bool_and(
        trigger_row.tgfoid=pg_catalog.to_regprocedure(credit_trigger.function_signature)
        AND trigger_row.tgtype=credit_trigger.trigger_type AND trigger_row.tgenabled='O'
        AND NOT trigger_row.tgisinternal AND trigger_row.tgqual IS NULL
        AND trigger_row.tgnargs=0 AND trigger_row.tgattr=''::int2vector
        AND CASE WHEN credit_trigger.deferred THEN trigger_row.tgdeferrable AND trigger_row.tginitdeferred
          ELSE NOT trigger_row.tgdeferrable AND NOT trigger_row.tginitdeferred END
      ) AS exact
      FROM credit_trigger LEFT JOIN pg_catalog.pg_trigger trigger_row
        ON trigger_row.tgrelid=pg_catalog.to_regclass('public.'||credit_trigger.table_name)
        AND trigger_row.tgname=credit_trigger.trigger_name
    ), credit_column(column_name, type_name) AS (VALUES
      ('tenant_id','uuid'),('id','uuid'),('property_node','uuid'),('actor_id','uuid'),
      ('original_document_id','uuid'),('original_origin_id','uuid'),('valuation_id','uuid'),
      ('accounting_binding_id','uuid'),('document_id','uuid'),('correction_journal_id','uuid'),
      ('series_id','uuid'),('business_date','date'),('created_at','timestamp with time zone'),
      ('issuing_transaction_id','xid8'),('reason','text'),('request_key_hash','text'),
      ('request_hash','text'),('correlation_id','uuid'),('source_evidence_hash','text'),
      ('planned_lines','jsonb'),('planned_document','jsonb'),('receipt_json','text')
    ), credit_column_shape AS (
      SELECT count(attribute.attnum)=22 AND bool_and(
        pg_catalog.format_type(attribute.atttypid,attribute.atttypmod)=credit_column.type_name
        AND attribute.attnotnull AND NOT attribute.atthasdef
        AND attribute.attgenerated='' AND attribute.attidentity=''
      ) AND (SELECT count(*)=22 FROM pg_catalog.pg_attribute attribute
        WHERE attribute.attrelid=pg_catalog.to_regclass('public.india_native_fiscal_credit_note')
          AND attribute.attnum>0 AND NOT attribute.attisdropped) AS exact
      FROM credit_column LEFT JOIN pg_catalog.pg_attribute attribute
        ON attribute.attrelid=pg_catalog.to_regclass('public.india_native_fiscal_credit_note')
        AND attribute.attname=credit_column.column_name AND attribute.attnum>0 AND NOT attribute.attisdropped
    ), credit_key(key_type, key_columns) AS (VALUES
      ('p',ARRAY['tenant_id','id']::text[]),
      ('u',ARRAY['tenant_id','original_document_id']::text[]),
      ('u',ARRAY['tenant_id','document_id']::text[]),
      ('u',ARRAY['tenant_id','correction_journal_id']::text[]),
      ('u',ARRAY['tenant_id','request_key_hash']::text[])
    ), credit_key_shape AS (
      SELECT count(constraint_row.oid)=5 AND bool_and(
        constraint_row.convalidated AND NOT constraint_row.condeferrable AND NOT constraint_row.condeferred
        AND index_row.indisvalid AND index_row.indisready AND index_row.indislive AND index_row.indisunique
        AND index_row.indisprimary=(credit_key.key_type='p') AND index_row.indpred IS NULL
        AND index_row.indexprs IS NULL AND index_row.indnkeyatts=2 AND index_row.indnatts=2
      ) AS exact
      FROM credit_key LEFT JOIN pg_catalog.pg_constraint constraint_row
        ON constraint_row.conrelid=pg_catalog.to_regclass('public.india_native_fiscal_credit_note')
        AND constraint_row.contype::text=credit_key.key_type
        AND ARRAY(SELECT attribute.attname::text FROM pg_catalog.unnest(constraint_row.conkey)
          WITH ORDINALITY key_column(attnum,ordinal)
          JOIN pg_catalog.pg_attribute attribute ON attribute.attrelid=constraint_row.conrelid
            AND attribute.attnum=key_column.attnum ORDER BY key_column.ordinal)=credit_key.key_columns
      LEFT JOIN pg_catalog.pg_index index_row ON index_row.indexrelid=constraint_row.conindid
    ), credit_foreign_key(column_name, target_table, deferred) AS (VALUES
      ('property_node','org_node',false),('actor_id','app_user',false),
      ('original_document_id','document',false),
      ('original_origin_id','india_gst_native_fiscal_document_origin',false),
      ('valuation_id','india_gst_accommodation_final_valuation',false),
      ('accounting_binding_id','india_gst_accommodation_final_component_tax_journal_binding',false),
      ('series_id','document_series',false),('document_id','document',true),
      ('correction_journal_id','journal',true)
    ), credit_foreign_key_shape AS (
      SELECT count(constraint_row.oid)=9 AND bool_and(
        constraint_row.convalidated AND constraint_row.condeferrable=credit_foreign_key.deferred
        AND constraint_row.condeferred=credit_foreign_key.deferred
        AND constraint_row.confrelid=pg_catalog.to_regclass('public.'||credit_foreign_key.target_table)
        AND constraint_row.confupdtype='a' AND constraint_row.confdeltype='a' AND constraint_row.confmatchtype='s'
        AND ARRAY(SELECT attribute.attname::text FROM pg_catalog.unnest(constraint_row.confkey)
          WITH ORDINALITY key_column(attnum,ordinal)
          JOIN pg_catalog.pg_attribute attribute ON attribute.attrelid=constraint_row.confrelid
            AND attribute.attnum=key_column.attnum ORDER BY key_column.ordinal)=ARRAY['tenant_id','id']::text[]
      ) AS exact
      FROM credit_foreign_key LEFT JOIN pg_catalog.pg_constraint constraint_row
        ON constraint_row.conrelid=pg_catalog.to_regclass('public.india_native_fiscal_credit_note')
        AND constraint_row.contype='f'
        AND ARRAY(SELECT attribute.attname::text FROM pg_catalog.unnest(constraint_row.conkey)
          WITH ORDINALITY key_column(attnum,ordinal)
          JOIN pg_catalog.pg_attribute attribute ON attribute.attrelid=constraint_row.conrelid
            AND attribute.attnum=key_column.attnum ORDER BY key_column.ordinal)
          =ARRAY['tenant_id',credit_foreign_key.column_name]::text[]
    ), credit_check(expected_expression) AS (VALUES
      ('isfinite(business_date)'),
      ('(document_id <> original_document_id)'),
      ('(jsonb_typeof(planned_document) = ''object''::text)'),
      ('((jsonb_typeof(planned_lines) = ''array''::text) AND ((jsonb_array_length(planned_lines) >= 2) AND (jsonb_array_length(planned_lines) <= 1004)))'),
      (${CREDIT_REASON_CHECK}),
      ('(jsonb_typeof((receipt_json)::jsonb) = ''object''::text)'),
      ('(request_hash ~ ''^[0-9a-f]{64}$''::text)'),
      ('(request_key_hash ~ ''^[0-9a-f]{64}$''::text)'),
      ('(source_evidence_hash ~ ''^[0-9a-f]{64}$''::text)')
    ), credit_check_shape AS (
      SELECT count(constraint_row.oid)=9 AND bool_and(
        constraint_row.convalidated AND NOT constraint_row.connoinherit
      ) AND (SELECT count(*)=9 FROM pg_catalog.pg_constraint constraint_row
        WHERE constraint_row.conrelid=pg_catalog.to_regclass('public.india_native_fiscal_credit_note')
          AND constraint_row.contype='c') AS exact
      FROM credit_check LEFT JOIN pg_catalog.pg_constraint constraint_row
        ON constraint_row.conrelid=pg_catalog.to_regclass('public.india_native_fiscal_credit_note')
        AND constraint_row.contype='c'
        AND pg_catalog.pg_get_expr(constraint_row.conbin,constraint_row.conrelid)=credit_check.expected_expression
    ), credit_index_shape AS (
      SELECT count(index_row.indexrelid)=1 AND bool_and(
        index_relation.relowner='yellow_owner'::regrole AND access_method.amname='btree'
        AND index_row.indisvalid AND index_row.indisready AND index_row.indislive
        AND NOT index_row.indisunique AND NOT index_row.indisprimary AND NOT index_row.indisexclusion
        AND index_row.indnkeyatts=4 AND index_row.indnatts=4
        AND index_row.indpred IS NULL AND index_row.indexprs IS NULL AND index_row.indoption::text='0 0 0 0'
        AND ARRAY(SELECT pg_catalog.pg_get_indexdef(index_relation.oid,key_ordinal,true)
          FROM pg_catalog.generate_series(1,4) key_ordinal ORDER BY key_ordinal)
          =ARRAY['tenant_id','property_node','business_date','document_id']::text[]
      ) AS exact
      FROM pg_catalog.pg_index index_row
      JOIN pg_catalog.pg_class index_relation ON index_relation.oid=index_row.indexrelid
      JOIN pg_catalog.pg_am access_method ON access_method.oid=index_relation.relam
      WHERE index_row.indrelid=pg_catalog.to_regclass('public.india_native_fiscal_credit_note')
        AND index_row.indexrelid=pg_catalog.to_regclass('public.india_native_credit_property')
    ), credit_binding AS (
      SELECT count(*)=1 AND bool_and(
        relation.relowner='yellow_owner'::regrole AND relation.relrowsecurity AND relation.relforcerowsecurity
        AND pg_catalog.has_table_privilege('app_role',relation.oid,'SELECT')
        AND NOT pg_catalog.has_table_privilege('app_role',relation.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
        AND NOT pg_catalog.has_any_column_privilege('app_role',relation.oid,'INSERT,UPDATE,REFERENCES')
        AND NOT pg_catalog.has_table_privilege('yellow_runtime',relation.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
        AND NOT pg_catalog.has_any_column_privilege('yellow_runtime',relation.oid,'SELECT,INSERT,UPDATE,REFERENCES')
        AND NOT EXISTS(SELECT 1 FROM pg_catalog.aclexplode(COALESCE(
          relation.relacl,pg_catalog.acldefault('r',relation.relowner)
        )) privilege WHERE privilege.grantee=0)
        AND (SELECT count(*)=1 AND bool_and(
          policy.polname='tenant_isolation' AND policy.polcmd='*' AND policy.polpermissive
          AND policy.polroles=ARRAY[0]::oid[]
          AND pg_catalog.pg_get_expr(policy.polqual,policy.polrelid)
            = '(tenant_id = (NULLIF(current_setting(''app.tenant_id''::text, true), ''''::text))::uuid)'
          AND pg_catalog.pg_get_expr(policy.polwithcheck,policy.polrelid)
            = '(tenant_id = (NULLIF(current_setting(''app.tenant_id''::text, true), ''''::text))::uuid)'
        ) FROM pg_catalog.pg_policy policy WHERE policy.polrelid=relation.oid)
      ) AND (SELECT exact FROM credit_trigger_shape)
        AND (SELECT exact FROM credit_column_shape) AND (SELECT exact FROM credit_key_shape)
        AND (SELECT exact FROM credit_foreign_key_shape) AND (SELECT exact FROM credit_check_shape)
        AND (SELECT exact FROM credit_index_shape) AS protected
      FROM pg_catalog.pg_class relation WHERE relation.oid=pg_catalog.to_regclass('public.india_native_fiscal_credit_note')
        AND relation.relkind='r'
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
      retry_binding.exact AS "fiscalRetryBindingAuthorityExact",
      receipt_columns.protected AS "fiscalReceiptColumnsProtected",
      q208_public.exact AS "q208PublicEntryAuthorityExact",
      q208_private.exact AS "q208PrivateEntryAuthorityExact",
      q208_indexes.exact AS "q208IndexesExact",
      credit_binding.protected AS "nativeCreditBindingProtected",
      credit_public.exact AS "nativeCreditEntryAuthorityExact",
      credit_private.exact AS "nativeCreditPrivateAuthorityExact",
      credit_projection.exact AS "nativeCreditFiscalProjectionExact",
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
      CROSS JOIN fiscal_receipt_read receipt_read CROSS JOIN fiscal_retry_binding retry_binding
      CROSS JOIN fiscal_receipt_columns receipt_columns
      CROSS JOIN q208_public_authority q208_public
      CROSS JOIN q208_private_authority q208_private CROSS JOIN q208_index_shape q208_indexes
      CROSS JOIN credit_binding CROSS JOIN credit_public_authority credit_public
      CROSS JOIN credit_private_authority credit_private
      CROSS JOIN credit_fiscal_projection credit_projection
  `;
  const proof = rows[0];
  if (rows.length !== 1 || !proof || Object.values(proof).some((value) => value !== true)
    || proof.nativeCreditBindingProtected !== true || proof.nativeCreditEntryAuthorityExact !== true
    || proof.nativeCreditPrivateAuthorityExact !== true || proof.nativeCreditFiscalProjectionExact !== true) {
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
