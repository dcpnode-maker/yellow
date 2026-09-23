-- Order440 / Q204: bounded provider-neutral fiscal delivery discovery.
-- Reuse the durable head/history. No new table, payload projection or transport.
-- Canonical1-79 and all retained financial/history rows remain unchanged.
DO $q204_preconditions$
BEGIN
  IF (SELECT count(*) FROM public.schema_migration)<>79 OR NOT EXISTS (
    SELECT 1 FROM public.schema_migration
     WHERE version=79 AND filename='0079_fiscal_immutable_command_receipts.sql'
       AND btrim(checksum_sha256)='b233821d0b683810542f91834458e98f657996268d81bc81398f6c15f86ca52f'
  ) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Q204 requires exact canonical79';
  END IF;
END
$q204_preconditions$;

SET ROLE yellow_owner;

-- Minimal keyset order is tenant-leading. Preserve the earlier status/lease index.
CREATE INDEX fiscal_submission_delivery_cursor
  ON public.fiscal_submission(tenant_id,id)
  WHERE delivery_version=1 AND status IN ('pending','submitted');

CREATE FUNCTION public.runtime_due_india_fiscal_submissions(
  p_limit integer,p_after_tenant uuid,p_after_submission uuid
) RETURNS TABLE(
  tenant_id uuid,submission_id uuid,provider_key text,
  provider_extension_id uuid,provider_extension_version integer
) LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp SET timezone='UTC' SET datestyle='ISO,YMD' AS $q204_due$
DECLARE
  v_now timestamptz:=pg_catalog.clock_timestamp();
BEGIN
  -- Discovery deliberately has no tenant context: it exposes infrastructure
  -- identities only. Tenant-scoped claim/reconcile retain their separate checks.
  IF session_user<>'yellow_runtime'
     OR pg_catalog.current_setting('role',true) IS DISTINCT FROM 'none'
     OR current_user<>'yellow_owner'
     OR NULLIF(pg_catalog.current_setting('app.tenant_id',true),'') IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='fiscal discovery requires context-free direct runtime login';
  END IF;
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 500
     OR (p_after_tenant IS NULL) IS DISTINCT FROM (p_after_submission IS NULL) THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='fiscal discovery cursor or limit is invalid';
  END IF;

  RETURN QUERY
  SELECT submission.tenant_id,submission.id,submission.provider_key::text,
         submission.provider_extension_id,submission.provider_extension_version
    FROM public.fiscal_submission submission
    JOIN public.tenant tenant ON tenant.id=submission.tenant_id AND tenant.status='active'
   WHERE submission.delivery_version=1
     AND submission.status IN ('pending','submitted')
     AND (p_after_tenant IS NULL
       OR (submission.tenant_id,submission.id)>(p_after_tenant,p_after_submission))
     AND ((submission.status='pending' AND submission.disposition='send')
       OR (submission.status='submitted' AND submission.disposition='lookup'
         AND submission.claim_expires_at + (CASE WHEN submission.response IS NULL
           THEN interval '0 seconds' ELSE interval '15 seconds' END) <= v_now))
   ORDER BY submission.tenant_id,submission.id
   LIMIT p_limit;
END
$q204_due$;

REVOKE ALL ON FUNCTION public.runtime_due_india_fiscal_submissions(integer,uuid,uuid)
  FROM PUBLIC,app_role,yellow_runtime;
GRANT EXECUTE ON FUNCTION public.runtime_due_india_fiscal_submissions(integer,uuid,uuid)
  TO yellow_runtime;

-- Preserve the existing claim signature, authority, receipt, atomic transition
-- and original transport bytes. Only active-tenant gating and lookup cadence change.
CREATE OR REPLACE FUNCTION public.claim_india_fiscal_submission(
  p_tenant uuid,p_submission uuid,p_lease_seconds integer DEFAULT 60
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp SET timezone='UTC' SET datestyle='ISO,YMD' AS $$
DECLARE
  v_context uuid;v_head public.fiscal_submission%ROWTYPE;v_action text;
  v_token uuid:=pg_catalog.gen_random_uuid();v_token_hash text;v_now timestamptz;
  v_correlation uuid:=pg_catalog.gen_random_uuid();
BEGIN
  IF session_user<>'yellow_runtime' OR pg_catalog.current_setting('role',true) IS DISTINCT FROM 'none'
     OR current_user<>'yellow_owner' THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='fiscal submission claim requires the direct runtime login';
  END IF;
  BEGIN v_context:=NULLIF(pg_catalog.current_setting('app.tenant_id',true),'')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='fiscal submission tenant context is invalid'; END;
  IF p_tenant IS NULL OR p_submission IS NULL OR p_lease_seconds IS NULL
     OR p_lease_seconds NOT BETWEEN 15 AND 300 THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='fiscal submission claim input is invalid';
  END IF;
  IF v_context IS DISTINCT FROM p_tenant THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='fiscal submission tenant context is unauthorized';
  END IF;
  PERFORM public.india_fiscal_submission_lock_relations();
  -- Lock the current tenant status before the head. A concurrent suspension
  -- either wins before this check or waits until the atomic claim settles.
  PERFORM 1 FROM public.tenant tenant
   WHERE tenant.id=p_tenant AND tenant.status='active' FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='active fiscal submission tenant is unavailable';
  END IF;
  SELECT submission.* INTO v_head FROM public.fiscal_submission submission
   WHERE submission.tenant_id=p_tenant AND submission.id=p_submission AND submission.delivery_version=1
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='durable fiscal submission is unavailable'; END IF;
  -- A lease starts only after every possibly blocking relation/head lock is held.
  v_now:=pg_catalog.clock_timestamp();
  IF v_head.status IN ('accepted','rejected') THEN
    RETURN pg_catalog.jsonb_build_object('claimed',false,'reason','terminal');
  ELSIF v_head.status='error' THEN
    RETURN pg_catalog.jsonb_build_object('claimed',false,'reason','retry_required');
  ELSIF v_head.status='submitted'
    AND v_head.claim_expires_at + (CASE WHEN v_head.response IS NULL
      THEN interval '0 seconds' ELSE interval '15 seconds' END) > v_now THEN
    RETURN pg_catalog.jsonb_build_object('claimed',false,'reason','busy');
  ELSIF v_head.status='pending' THEN v_action:='submit';
  ELSIF v_head.status='submitted' THEN v_action:='lookup';
  ELSE
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='durable fiscal submission state is invalid';
  END IF;
  v_token_hash:=pg_catalog.encode(public.digest(v_token::text,'sha256'),'hex');
  UPDATE public.fiscal_submission SET status='submitted',disposition='lookup',
      transition_seq=transition_seq+1,claim_token_hash=v_token_hash,
      claim_expires_at=v_now+pg_catalog.make_interval(secs=>p_lease_seconds),claim_action=v_action,
      reconciliation_reason=CASE WHEN v_action='submit' THEN 'transport_started' ELSE reconciliation_reason END,
      -- A prior nonterminal adapter result remains in immutable history.  The new
      -- token owns a fresh reconciliation slot on the mutable delivery head.
      response=NULL,submitted_at=COALESCE(submitted_at,v_now)
    WHERE tenant_id=p_tenant AND id=p_submission RETURNING * INTO v_head;
  PERFORM public.india_fiscal_submission_record_transition(v_head,'fiscal.submission.claimed',
    NULL,NULL,v_correlation,NULL,NULL);
  RETURN pg_catalog.jsonb_build_object('claimed',true,'action',v_action,'claimToken',v_token,
    'submissionId',v_head.id,'tenantId',v_head.tenant_id,'propertyNode',v_head.property_node,
    'documentId',v_head.document_id,'documentSha256',v_head.document_sha256,
    'wireSha256',v_head.wire_sha256,'wireJson',v_head.wire_text,
    'providerKey',v_head.provider_key,'providerExtensionId',v_head.provider_extension_id,
    'providerExtensionVersion',v_head.provider_extension_version,
    'attemptId',v_head.attempt_id,'attemptNumber',v_head.attempt_number);
END;
$$;

RESET ROLE;
