-- Order440/Q212 reload-safe retry authority. The original immutable provider
-- extension identity is projected only for an exact known-not-sent retry head.

DO $q212_86_preconditions$
DECLARE v_read oid:=pg_catalog.to_regprocedure(
  'public.read_india_fiscal_submission_delivery_receipt(uuid,uuid,uuid,uuid)');
BEGIN
  IF (SELECT pg_catalog.max(version) FROM public.schema_migration) IS DISTINCT FROM 85
     OR NOT EXISTS (
       SELECT 1 FROM public.schema_migration WHERE version=85
        AND filename='0085_india_native_fiscal_operator_command.sql'
        AND pg_catalog.btrim(checksum_sha256)='c94c97efbb237fb99c5a35caf01faefa4d7fee98a07d8b30b89bec3ce0a7670c')
     OR v_read IS NULL
     OR (SELECT owner.rolname FROM pg_catalog.pg_proc function_row
          JOIN pg_catalog.pg_roles owner ON owner.oid=function_row.proowner
         WHERE function_row.oid=v_read)<>'yellow_owner'
     OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc function_row
          WHERE function_row.oid=v_read AND function_row.prosecdef AND function_row.provolatile='s'
            AND function_row.proconfig @> ARRAY[
              'search_path=pg_catalog, public, pg_temp','TimeZone=UTC','DateStyle=ISO,YMD'])
     OR NOT pg_catalog.has_function_privilege('app_role',v_read,'EXECUTE')
     OR pg_catalog.has_function_privilege('yellow_runtime',v_read,'EXECUTE')
     OR pg_catalog.has_function_privilege('public',v_read,'EXECUTE') THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Q212 retry binding requires exact applied85 receipt authority';
  END IF;
END
$q212_86_preconditions$;

SET ROLE yellow_owner;

CREATE FUNCTION public.india_fiscal_submission_retry_binding_v1(
  p_status text,p_disposition text,p_reconciliation_reason text,
  p_provider_extension_id uuid,p_provider_extension_version integer
) RETURNS jsonb LANGUAGE sql IMMUTABLE
SET search_path=pg_catalog,public AS $$
  SELECT CASE
    WHEN p_status='error' AND p_disposition='retry'
      AND p_reconciliation_reason='known_not_sent'
      AND p_provider_extension_id IS NOT NULL
      AND p_provider_extension_version BETWEEN 1 AND 2147483647
    THEN pg_catalog.jsonb_build_object('retryBinding',pg_catalog.jsonb_build_object(
      'providerExtensionId',p_provider_extension_id,
      'providerExtensionVersion',p_provider_extension_version))
    ELSE '{}'::pg_catalog.jsonb
  END
$$;

CREATE OR REPLACE FUNCTION public.read_india_fiscal_submission_delivery_receipt(
  p_tenant uuid,p_property uuid,p_submission uuid,p_actor uuid
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp SET timezone='UTC' SET datestyle='ISO,YMD' AS $$
DECLARE v_context uuid;v_head public.fiscal_submission%ROWTYPE;v_common jsonb;v_receipt jsonb;
BEGIN
  IF session_user<>'yellow_runtime' OR pg_catalog.current_setting('role',true) IS DISTINCT FROM 'app_role'
     OR current_user<>'yellow_owner' THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='fiscal submission receipt read requires the governed runtime app role';
  END IF;
  BEGIN v_context:=NULLIF(pg_catalog.current_setting('app.tenant_id',true),'')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='fiscal submission receipt tenant context is invalid'; END;
  IF p_tenant IS NULL OR p_property IS NULL OR p_submission IS NULL OR p_actor IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='fiscal submission receipt read input is invalid';
  END IF;
  IF v_context IS DISTINCT FROM p_tenant THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='fiscal submission receipt tenant context is unauthorized';
  END IF;
  SELECT submission.* INTO v_head
    FROM public.fiscal_submission submission
   WHERE submission.tenant_id=p_tenant AND submission.property_node=p_property
     AND submission.id=p_submission AND submission.delivery_version=1
     AND EXISTS (
       SELECT 1 FROM public.tenant tenant
       JOIN public.app_user actor ON actor.tenant_id=tenant.id AND actor.id=p_actor AND actor.status='active'
       JOIN public.user_role ur ON ur.tenant_id=actor.tenant_id AND ur.user_id=actor.id
       JOIN public.role granted_role ON granted_role.tenant_id=tenant.id AND granted_role.id=ur.role_id
       JOIN public.role_permission rp ON rp.role_id=granted_role.id
         AND rp.permission_code='tax-fiscal.submissions:read'
       JOIN public.org_node grant_node ON grant_node.tenant_id=ur.tenant_id AND grant_node.id=ur.scope_node
       JOIN public.org_node property ON property.tenant_id=tenant.id AND property.id=p_property
         AND property.kind='property' AND grant_node.path @> property.path
       WHERE tenant.id=p_tenant AND tenant.status='active');
  IF NOT FOUND THEN RETURN NULL; END IF;
  v_common:=pg_catalog.jsonb_build_object(
    'kind','pending','submissionId',v_head.id,'tenantId',v_head.tenant_id,
    'propertyNode',v_head.property_node,'documentId',v_head.document_id,
    'documentSha256',v_head.document_sha256,'wireSha256',v_head.wire_sha256,
    'providerKey',v_head.provider_key,'attemptId',v_head.attempt_id,
    'attemptNumber',v_head.attempt_number,'status',v_head.status,
    'disposition',v_head.disposition,'transitionSeq',v_head.transition_seq);
  IF v_head.response ? 'receipt' THEN v_receipt:=v_head.response->'receipt'; END IF;
  IF v_head.status='accepted' AND v_receipt->>'kind'='accepted_signed_v1' THEN
    RETURN v_common||pg_catalog.jsonb_build_object('kind','accepted_signed_v1',
      'environment',v_receipt->>'environment','responseSha256',v_head.response_sha256,
      'irn',v_receipt->>'irn','ackNo',v_receipt->>'ackNo','ackDt',v_receipt->>'ackDt',
      'signedInvoice',v_receipt->>'signedInvoice','signedQRCode',v_head.qr_payload,
      'signedInvoiceSha256',v_receipt->>'signedInvoiceSha256',
      'signedQrSha256',v_receipt->>'signedQrSha256','verification',v_receipt->'verification');
  ELSIF v_head.status='rejected' AND v_receipt->>'kind'='rejected' THEN
    RETURN v_common||pg_catalog.jsonb_build_object('kind','rejected',
      'environment',v_receipt->>'environment','responseSha256',v_head.response_sha256,
      'errorCodes',v_receipt->'errorCodes');
  ELSIF v_head.status='error' AND v_head.disposition='none'
      AND v_head.reconciliation_reason='provider_cancelled'
      AND v_receipt->>'kind'='provider_cancelled' THEN
    RETURN v_common||pg_catalog.jsonb_build_object('kind','provider_cancelled',
      'environment',v_receipt->>'environment','responseSha256',v_head.response_sha256,
      'providerStatus','CNL');
  ELSIF v_head.status IN ('accepted','rejected') THEN
    RETURN v_common||pg_catalog.jsonb_build_object('kind','legacy_hash_only',
      'authorityRef',v_head.authority_ref,'responseSha256',v_head.response_sha256);
  END IF;
  RETURN v_common||public.india_fiscal_submission_retry_binding_v1(
    v_head.status,v_head.disposition,v_head.reconciliation_reason,
    v_head.provider_extension_id,v_head.provider_extension_version);
END;
$$;

ALTER FUNCTION public.india_fiscal_submission_retry_binding_v1(text,text,text,uuid,integer)
  OWNER TO yellow_owner;
ALTER FUNCTION public.read_india_fiscal_submission_delivery_receipt(uuid,uuid,uuid,uuid)
  OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.india_fiscal_submission_retry_binding_v1(text,text,text,uuid,integer)
  FROM PUBLIC,app_role,yellow_runtime;
REVOKE ALL ON FUNCTION public.read_india_fiscal_submission_delivery_receipt(uuid,uuid,uuid,uuid)
  FROM PUBLIC,app_role,yellow_runtime;
GRANT EXECUTE ON FUNCTION public.read_india_fiscal_submission_delivery_receipt(uuid,uuid,uuid,uuid)
  TO app_role;

DO $q212_86_postconditions$
DECLARE
  v_helper oid:=pg_catalog.to_regprocedure(
    'public.india_fiscal_submission_retry_binding_v1(text,text,text,uuid,integer)');
  v_read oid:=pg_catalog.to_regprocedure(
    'public.read_india_fiscal_submission_delivery_receipt(uuid,uuid,uuid,uuid)');
  v_source text;
BEGIN
  v_source:=pg_catalog.pg_get_functiondef(v_read);
  IF v_helper IS NULL OR v_read IS NULL
     OR (SELECT owner.rolname FROM pg_catalog.pg_proc function_row
          JOIN pg_catalog.pg_roles owner ON owner.oid=function_row.proowner
         WHERE function_row.oid=v_helper)<>'yellow_owner'
     OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc function_row
          WHERE function_row.oid=v_helper AND NOT function_row.prosecdef
            AND function_row.provolatile='i' AND NOT function_row.proisstrict
            AND function_row.proparallel='u' AND NOT function_row.proleakproof
            AND function_row.prolang=(SELECT language.oid FROM pg_catalog.pg_language language
                                      WHERE language.lanname='sql')
            AND pg_catalog.pg_get_function_result(function_row.oid)='jsonb'
            AND function_row.proconfig @> ARRAY['search_path=pg_catalog, public'])
     OR pg_catalog.has_function_privilege('app_role',v_helper,'EXECUTE')
     OR pg_catalog.has_function_privilege('yellow_runtime',v_helper,'EXECUTE')
     OR pg_catalog.has_function_privilege('public',v_helper,'EXECUTE')
     OR (SELECT owner.rolname FROM pg_catalog.pg_proc function_row
          JOIN pg_catalog.pg_roles owner ON owner.oid=function_row.proowner
         WHERE function_row.oid=v_read)<>'yellow_owner'
     OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc function_row
          WHERE function_row.oid=v_read AND function_row.prosecdef AND function_row.provolatile='s'
            AND function_row.proconfig @> ARRAY[
              'search_path=pg_catalog, public, pg_temp','TimeZone=UTC','DateStyle=ISO,YMD'])
     OR NOT pg_catalog.has_function_privilege('app_role',v_read,'EXECUTE')
     OR pg_catalog.has_function_privilege('yellow_runtime',v_read,'EXECUTE')
     OR pg_catalog.has_function_privilege('public',v_read,'EXECUTE')
     OR pg_catalog.strpos(v_source,'public.india_fiscal_submission_retry_binding_v1(')=0
     OR public.india_fiscal_submission_retry_binding_v1(
          'error','retry','known_not_sent','00000000-0000-4000-8000-000000000001'::uuid,2147483647)
        IS DISTINCT FROM pg_catalog.jsonb_build_object('retryBinding',pg_catalog.jsonb_build_object(
          'providerExtensionId','00000000-0000-4000-8000-000000000001'::uuid,
          'providerExtensionVersion',2147483647))
     OR public.india_fiscal_submission_retry_binding_v1(
          'pending','send',NULL,'00000000-0000-4000-8000-000000000001'::uuid,1)
        IS DISTINCT FROM '{}'::pg_catalog.jsonb THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Q212 retry binding receipt authority is malformed';
  END IF;
END
$q212_86_postconditions$;

RESET ROLE;
