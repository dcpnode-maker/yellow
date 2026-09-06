-- Order440 / Q205: exact command replay from append-only receipt history.
-- Forward correction only. Applied1-78 and all stored financial/delivery rows
-- remain unchanged; existing recorded command keys are repaired without backfill.
DO $q205_preconditions$
BEGIN
  IF (SELECT count(*) FROM public.schema_migration)<>78 OR NOT EXISTS (
    SELECT 1 FROM public.schema_migration
     WHERE version=78 AND filename='0078_fiscal_submission_durability.sql'
       AND btrim(checksum_sha256)='65323a81a999a11e3d55893411c994c0b841af9b0465ca7e80630fd78d0ffae6'
  ) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Q205 requires exact canonical78';
  END IF;
END
$q205_preconditions$;

SET ROLE yellow_owner;

-- Internal projection: it never reads mutable head/configuration and has no
-- caller authority. Only the governed request/retry owner can execute it.
CREATE FUNCTION public.india_fiscal_submission_history_receipt(
  p_receipt public.fiscal_submission_history,p_replayed boolean
) RETURNS jsonb LANGUAGE sql STABLE STRICT
SET search_path=pg_catalog,public,pg_temp AS $$
  SELECT pg_catalog.jsonb_build_object(
    'submissionId',p_receipt.submission_id,'tenantId',p_receipt.tenant_id,
    'propertyNode',p_receipt.property_node,'documentId',p_receipt.document_id,
    'documentSha256',p_receipt.document_sha256,'wireSha256',p_receipt.wire_sha256,
    'providerKey',p_receipt.provider_key,'providerExtensionId',p_receipt.provider_extension_id,
    'providerExtensionVersion',p_receipt.provider_extension_version,
    'attemptId',p_receipt.attempt_id,'attemptNumber',p_receipt.attempt_number,
    'retryCount',p_receipt.retry_count,'status',p_receipt.status,
    'disposition',p_receipt.disposition,'transitionSeq',p_receipt.transition_seq,
    'replayed',p_replayed)
$$;
REVOKE ALL ON FUNCTION public.india_fiscal_submission_history_receipt(public.fiscal_submission_history,boolean)
  FROM PUBLIC,app_role,yellow_runtime;

CREATE OR REPLACE FUNCTION public.request_india_fiscal_submission(
  p_tenant uuid,p_property uuid,p_document uuid,p_provider_extension uuid,
  p_actor uuid,p_idempotency_key text,p_request_id uuid
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp SET timezone='UTC' SET datestyle='ISO,YMD' AS $$
DECLARE
  v_context uuid;v_key_hash text;v_request_hash text;v_existing public.fiscal_submission_history%ROWTYPE;
  v_head public.fiscal_submission%ROWTYPE;v_provider public.extension%ROWTYPE;v_wire jsonb;
  v_submission_id uuid:=pg_catalog.gen_random_uuid();v_attempt_id uuid:=pg_catalog.gen_random_uuid();
  v_provider_key text;
BEGIN
  IF session_user<>'yellow_runtime' OR pg_catalog.current_setting('role',true) IS DISTINCT FROM 'app_role'
     OR current_user<>'yellow_owner' THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='fiscal submission request requires the governed runtime app role';
  END IF;
  BEGIN v_context:=NULLIF(pg_catalog.current_setting('app.tenant_id',true),'')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='fiscal submission tenant context is invalid'; END;
  IF p_tenant IS NULL OR p_property IS NULL OR p_document IS NULL OR p_provider_extension IS NULL
     OR p_actor IS NULL OR p_request_id IS NULL
     OR p_idempotency_key IS NULL OR p_idempotency_key COLLATE "C" !~'^[!-~]{8,200}$' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='fiscal submission request input is invalid';
  END IF;
  IF v_context IS DISTINCT FROM p_tenant THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='fiscal submission tenant context is unauthorized';
  END IF;
  PERFORM public.india_fiscal_submission_lock_relations();
  PERFORM 1 FROM public.tenant tenant
    JOIN public.app_user actor ON actor.tenant_id=tenant.id AND actor.id=p_actor AND actor.status='active'
    JOIN public.user_role ur ON ur.tenant_id=actor.tenant_id AND ur.user_id=actor.id
    JOIN public.role_permission rp ON rp.role_id=ur.role_id
      AND rp.permission_code='tax-fiscal.submissions:request'
    JOIN public.org_node grant_node ON grant_node.tenant_id=ur.tenant_id AND grant_node.id=ur.scope_node
    JOIN public.org_node property ON property.tenant_id=tenant.id AND property.id=p_property
      AND property.kind='property' AND grant_node.path @> property.path
   WHERE tenant.id=p_tenant AND tenant.status='active';
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='actor lacks property fiscal-submission request authority'; END IF;
  v_key_hash:=pg_catalog.encode(public.digest(p_idempotency_key,'sha256'),'hex');
  v_request_hash:=pg_catalog.encode(public.digest(pg_catalog.convert_to(
    -- request-id is the first effect's audit correlation, not semantic
    -- idempotency identity; a retrying client may legitimately mint a new one.
    pg_catalog.jsonb_build_array('request',p_tenant,p_property,p_document,p_provider_extension,p_actor)::text,'UTF8'),'sha256'),'hex');
  SELECT history.* INTO v_existing FROM public.fiscal_submission_history history
   WHERE history.tenant_id=p_tenant AND history.event_type='fiscal.submission.requested'
     AND history.idempotency_key_hash=v_key_hash;
  IF FOUND THEN
    IF v_existing.idempotency_request_hash IS DISTINCT FROM v_request_hash THEN
      RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='fiscal submission idempotency key conflicts';
    END IF;
    SELECT submission.* INTO STRICT v_head FROM public.fiscal_submission submission
     WHERE submission.tenant_id=p_tenant AND submission.id=v_existing.submission_id FOR UPDATE;
    RETURN public.india_fiscal_submission_history_receipt(v_existing,true);
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'india-fiscal-submission:'||p_tenant::text||':'||p_document::text,0));
  -- The advisory lock may have waited for an identical first request.  Read the
  -- now-committed receipt again before resolving effect-only source state.
  SELECT history.* INTO v_existing FROM public.fiscal_submission_history history
   WHERE history.tenant_id=p_tenant AND history.event_type='fiscal.submission.requested'
     AND history.idempotency_key_hash=v_key_hash;
  IF FOUND THEN
    IF v_existing.idempotency_request_hash IS DISTINCT FROM v_request_hash THEN
      RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='fiscal submission idempotency key conflicts';
    END IF;
    SELECT submission.* INTO STRICT v_head FROM public.fiscal_submission submission
     WHERE submission.tenant_id=p_tenant AND submission.id=v_existing.submission_id FOR UPDATE;
    RETURN public.india_fiscal_submission_history_receipt(v_existing,true);
  END IF;
  SELECT extension.* INTO v_provider FROM public.extension extension
   WHERE extension.id=p_provider_extension
     AND (extension.tenant_id IS NULL OR extension.tenant_id=p_tenant)
     AND extension.type='fiscal_provider' AND extension.status='active'
     AND extension.effective @> pg_catalog.transaction_timestamp()
     AND extension.content @> '{"jurisdiction":"IN","mode":"in_house_reporting","document_formats":["irp_json_1_1"]}'::jsonb
     AND NOT EXISTS(SELECT 1 FROM public.extension newer
       WHERE newer.tenant_id IS NOT DISTINCT FROM extension.tenant_id
         AND newer.type=extension.type AND newer.key=extension.key AND newer.version>extension.version)
   FOR SHARE;
  v_provider_key:=v_provider.content->>'provider_key';
  IF v_provider.id IS NULL OR v_provider_key IS NULL
     OR v_provider_key!~'^[a-z0-9](?:[a-z0-9._:-]{0,126}[a-z0-9])?$' THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='current India reporting provider extension is unavailable';
  END IF;
  v_wire:=public.india_fiscal_submission_project_wire(p_tenant,p_property,p_document);
  PERFORM 1 FROM public.business_day day
   WHERE day.tenant_id=p_tenant AND day.property_node=p_property
     AND day.business_date=(v_wire->>'businessDate')::date AND day.sealed_at IS NULL
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='issued fiscal document business day is missing or sealed'; END IF;
  IF EXISTS(SELECT 1 FROM public.fiscal_submission submission
      WHERE submission.tenant_id=p_tenant AND submission.document_id=p_document) THEN
    RAISE EXCEPTION USING ERRCODE='23505',
      MESSAGE='issued fiscal document already has a submission, including legacy evidence';
  END IF;
  INSERT INTO public.fiscal_submission(id,tenant_id,document_id,provider_key,mode,status,
    delivery_version,property_node,business_date,document_sha256,wire_sha256,wire_text,
    provider_extension_id,provider_extension_version,attempt_id,attempt_number,retry_count,
    transition_seq,disposition,requested_by,request_id)
  VALUES(v_submission_id,p_tenant,p_document,v_provider_key,'reporting','pending',1,p_property,
    (v_wire->>'businessDate')::date,v_wire->>'documentSha256',v_wire->>'wireSha256',v_wire->>'wireText',
    v_provider.id,v_provider.version,v_attempt_id,1,0,1,'send',p_actor,p_request_id)
  RETURNING * INTO v_head;
  PERFORM public.india_fiscal_submission_record_transition(v_head,'fiscal.submission.requested',
    NULL,p_actor,p_request_id,v_key_hash,v_request_hash);
  RETURN public.india_fiscal_submission_receipt(v_head,false);
END;
$$;

CREATE OR REPLACE FUNCTION public.retry_india_fiscal_submission(
  p_tenant uuid,p_submission uuid,p_actor uuid,p_idempotency_key text,p_request_id uuid
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp SET timezone='UTC' SET datestyle='ISO,YMD' AS $$
DECLARE
  v_context uuid;v_key_hash text;v_request_hash text;v_existing public.fiscal_submission_history%ROWTYPE;
  v_head public.fiscal_submission%ROWTYPE;v_attempt uuid:=pg_catalog.gen_random_uuid();
BEGIN
  IF session_user<>'yellow_runtime' OR pg_catalog.current_setting('role',true) IS DISTINCT FROM 'app_role'
     OR current_user<>'yellow_owner' THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='fiscal submission retry requires the governed runtime app role';
  END IF;
  BEGIN v_context:=NULLIF(pg_catalog.current_setting('app.tenant_id',true),'')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='fiscal submission tenant context is invalid'; END;
  IF p_tenant IS NULL OR p_submission IS NULL OR p_actor IS NULL OR p_request_id IS NULL
     OR p_idempotency_key IS NULL
     OR p_idempotency_key COLLATE "C" !~'^[!-~]{8,200}$' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='fiscal submission retry input is invalid';
  END IF;
  IF v_context IS DISTINCT FROM p_tenant THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='fiscal submission tenant context is unauthorized';
  END IF;
  PERFORM public.india_fiscal_submission_lock_relations();
  SELECT submission.* INTO v_head FROM public.fiscal_submission submission
   WHERE submission.tenant_id=p_tenant AND submission.id=p_submission AND submission.delivery_version=1
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='durable fiscal submission is unavailable'; END IF;
  PERFORM 1 FROM public.tenant tenant
    JOIN public.app_user actor ON actor.tenant_id=tenant.id AND actor.id=p_actor AND actor.status='active'
    JOIN public.user_role ur ON ur.tenant_id=actor.tenant_id AND ur.user_id=actor.id
    JOIN public.role_permission rp ON rp.role_id=ur.role_id
      AND rp.permission_code='tax-fiscal.submissions:retry'
    JOIN public.org_node grant_node ON grant_node.tenant_id=ur.tenant_id AND grant_node.id=ur.scope_node
    JOIN public.org_node property ON property.tenant_id=tenant.id AND property.id=v_head.property_node
      AND property.kind='property' AND grant_node.path @> property.path
   WHERE tenant.id=p_tenant AND tenant.status='active';
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='actor lacks property fiscal-submission retry authority'; END IF;
  v_key_hash:=pg_catalog.encode(public.digest(p_idempotency_key,'sha256'),'hex');
  v_request_hash:=pg_catalog.encode(public.digest(pg_catalog.convert_to(
    -- As above, request-id is evidence correlation only.  Submission and actor
    -- remain part of the semantic retry identity and fresh authority is checked.
    pg_catalog.jsonb_build_array('retry',p_tenant,p_submission,p_actor)::text,'UTF8'),'sha256'),'hex');
  SELECT history.* INTO v_existing FROM public.fiscal_submission_history history
   WHERE history.tenant_id=p_tenant AND history.event_type='fiscal.submission.retry_requested'
     AND history.idempotency_key_hash=v_key_hash;
  IF FOUND THEN
    IF v_existing.idempotency_request_hash IS DISTINCT FROM v_request_hash
       OR v_existing.submission_id<>p_submission THEN
      RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='fiscal submission retry idempotency key conflicts';
    END IF;
    RETURN public.india_fiscal_submission_history_receipt(v_existing,true);
  END IF;
  IF v_head.status<>'error' OR v_head.disposition<>'retry'
     OR v_head.reconciliation_reason<>'known_not_sent' THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='only a known-not-sent submission may be retried';
  END IF;
  IF v_head.retry_count>=3 THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='fiscal submission retry limit is exhausted';
  END IF;
  UPDATE public.fiscal_submission SET status='pending',attempt_id=v_attempt,
      attempt_number=attempt_number+1,retry_count=retry_count+1,transition_seq=transition_seq+1,
      disposition='send',claim_token_hash=NULL,claim_expires_at=NULL,claim_action=NULL,
      reconciliation_reason=NULL,resolution_source=NULL,response_sha256=NULL,response=NULL,
      authority_ref=NULL,submitted_at=NULL,resolved_at=NULL
    WHERE tenant_id=p_tenant AND id=p_submission
    RETURNING * INTO v_head;
  PERFORM public.india_fiscal_submission_record_transition(v_head,'fiscal.submission.retry_requested',
    NULL,p_actor,p_request_id,v_key_hash,v_request_hash);
  RETURN public.india_fiscal_submission_receipt(v_head,false);
END;
$$;

RESET ROLE;

DO $q205_postconditions$
DECLARE
  v_helper oid:=pg_catalog.to_regprocedure('public.india_fiscal_submission_history_receipt(public.fiscal_submission_history,boolean)');
  v_request oid:=pg_catalog.to_regprocedure('public.request_india_fiscal_submission(uuid,uuid,uuid,uuid,uuid,text,uuid)');
  v_retry oid:=pg_catalog.to_regprocedure('public.retry_india_fiscal_submission(uuid,uuid,uuid,text,uuid)');
BEGIN
  IF v_helper IS NULL OR v_request IS NULL OR v_retry IS NULL
     OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc
       WHERE oid=v_helper AND proowner='yellow_owner'::pg_catalog.regrole AND NOT prosecdef
         AND proconfig=ARRAY['search_path=pg_catalog, public, pg_temp']::text[])
     OR pg_catalog.has_function_privilege('app_role',v_helper,'EXECUTE')
     OR pg_catalog.has_function_privilege('yellow_runtime',v_helper,'EXECUTE')
     OR pg_catalog.has_function_privilege('public',v_helper,'EXECUTE')
     OR NOT pg_catalog.has_function_privilege('app_role',v_request,'EXECUTE')
     OR NOT pg_catalog.has_function_privilege('app_role',v_retry,'EXECUTE')
     OR pg_catalog.has_function_privilege('yellow_runtime',v_request,'EXECUTE')
     OR pg_catalog.has_function_privilege('yellow_runtime',v_retry,'EXECUTE')
     OR pg_catalog.has_function_privilege('public',v_request,'EXECUTE')
     OR pg_catalog.has_function_privilege('public',v_retry,'EXECUTE') THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Q205 immutable receipt capability is malformed';
  END IF;
END
$q205_postconditions$;

