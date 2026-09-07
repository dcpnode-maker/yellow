-- Order440/Q208 public staff command composition. The durable native timing and
-- quoted-applicability graph is the sole selector store for completed replay.

DO $q208_85_preconditions$
BEGIN
  IF (SELECT pg_catalog.max(version) FROM public.schema_migration) IS DISTINCT FROM 84
     OR NOT EXISTS (
       SELECT 1 FROM public.schema_migration WHERE version=84
        AND filename='0084_india_native_fiscal_operator_query_execution.sql'
        AND pg_catalog.btrim(checksum_sha256)='e9d8b75f832e687f567806e82faaece7672cdbcf4ee8813c9c7b56cfc78ecd69') THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Q208 operator command requires exact applied84';
  END IF;
END
$q208_85_preconditions$;

SET ROLE yellow_owner;

DO $q208_85_discovery_bound$
DECLARE v_oid oid;v_definition text;v_changed text;v_hash text;
BEGIN
  v_oid:=pg_catalog.to_regprocedure(
    'public.discover_india_native_fiscal_issue(uuid,uuid,uuid,uuid,uuid,uuid,text,text,date,date[],text[])');
  v_definition:=pg_catalog.pg_get_functiondef(v_oid);
  v_hash:=pg_catalog.encode(public.digest(pg_catalog.convert_to(v_definition,'UTF8'),'sha256'),'hex');
  IF v_oid IS NULL OR v_hash IS DISTINCT FROM
      '223c3980622607354b9385af7544d7654955c1e378988dae99f7770cfcb28306' THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Q208 recipient discovery predecessor drifted';
  END IF;
  v_changed:=pg_catalog.replace(v_definition,
    $old$DECLARE
  v_authority jsonb;v_existing uuid;v_count integer;v_candidates jsonb;$old$,
    $new$DECLARE
  v_context uuid;v_authority jsonb;v_existing uuid;v_count integer;v_candidates jsonb;$new$);
  v_changed:=pg_catalog.replace(v_changed,
    $old$BEGIN
  v_authority:=public.read_india_native_issue_authority(p_tenant,p_property,p_actor,p_reservation,p_folio);$old$,
    $new$BEGIN
  BEGIN v_context:=NULLIF(pg_catalog.current_setting('app.tenant_id',true),'')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='native operator discovery tenant context is invalid'; END;
  IF session_user<>'yellow_runtime' OR current_user<>'yellow_owner'
      OR pg_catalog.current_setting('role',true) IS DISTINCT FROM 'app_role'
      OR p_tenant IS NULL OR v_context IS DISTINCT FROM p_tenant OR p_property IS NULL
      OR p_actor IS NULL OR p_reservation IS NULL OR p_folio IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='native operator discovery authority is unavailable';
  END IF;
  PERFORM 1 FROM public.tenant tenant
    JOIN public.app_user actor ON actor.tenant_id=tenant.id AND actor.id=p_actor AND actor.status='active'
    JOIN public.org_node property ON property.tenant_id=tenant.id AND property.id=p_property AND property.kind='property'
    JOIN public.folio folio ON folio.tenant_id=tenant.id AND folio.id=p_folio AND folio.reservation_id=p_reservation
    JOIN public.account account ON account.tenant_id=folio.tenant_id AND account.id=folio.account_id
      AND account.property_node=property.id AND account.role='guest'
    JOIN public.reservation reservation ON reservation.tenant_id=folio.tenant_id AND reservation.id=p_reservation
      AND reservation.property_node=property.id
   WHERE tenant.id=p_tenant AND tenant.status='active'
     AND EXISTS(SELECT 1 FROM public.user_role ur
       JOIN public.role role_row ON role_row.tenant_id=ur.tenant_id AND role_row.id=ur.role_id
       JOIN public.role_permission rp ON rp.role_id=role_row.id
         AND rp.permission_code='tax-fiscal.documents:issue'
       JOIN public.org_node grant_node ON grant_node.tenant_id=ur.tenant_id AND grant_node.id=ur.scope_node
      WHERE ur.tenant_id=p_tenant AND ur.user_id=p_actor AND grant_node.path @> property.path)
     AND EXISTS(SELECT 1 FROM public.user_role ur
       JOIN public.role role_row ON role_row.tenant_id=ur.tenant_id AND role_row.id=ur.role_id
       JOIN public.role_permission rp ON rp.role_id=role_row.id
         AND rp.permission_code='tax-fiscal.india-valuation:finalize'
       JOIN public.org_node grant_node ON grant_node.tenant_id=ur.tenant_id AND grant_node.id=ur.scope_node
      WHERE ur.tenant_id=p_tenant AND ur.user_id=p_actor AND grant_node.path @> property.path);
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='native operator discovery authority is unavailable';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.tax_assignment assignment
      WHERE assignment.tenant_id=p_tenant AND assignment.property_node=p_property
        AND assignment.jurisdiction_key='in-gst-lodging') THEN
    RAISE EXCEPTION USING ERRCODE='P2082',MESSAGE='native fiscal jurisdiction is unsupported';
  END IF;
  v_authority:=public.read_india_native_issue_authority(p_tenant,p_property,p_actor,p_reservation,p_folio);$new$);
  v_changed:=pg_catalog.replace(v_changed,
    $old$  SELECT pg_catalog.count(*)::integer,
      COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'recipientRegistrationId',registration.id,'legalName',registration.legal_name,
        'gstin',registration.registration_number,'stateCode',registration.region_code)
        ORDER BY registration.legal_name COLLATE "C",registration.id),'[]'::jsonb)
    INTO v_count,v_candidates
    FROM public.india_gst_accommodation_final_valuation valuation
    JOIN public.party_fiscal_registration registration
      ON registration.tenant_id=valuation.tenant_id AND registration.party_id=valuation.buyer_party_id
     AND registration.scheme='in-gstin'
   WHERE valuation.tenant_id=p_tenant AND valuation.id=v_valuation;
  IF p_recipient IS NULL THEN$old$,
    $new$  SELECT pg_catalog.count(*)::integer,
      COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'recipientRegistrationId',registration.id,'legalName',registration.legal_name,
        'gstin',registration.registration_number,'stateCode',registration.region_code)
        ORDER BY registration.legal_name COLLATE "C",registration.id),'[]'::jsonb)
    INTO v_count,v_candidates
    FROM (
      SELECT registration.id,registration.legal_name,registration.registration_number,registration.region_code
        FROM public.india_gst_accommodation_final_valuation valuation
        JOIN public.party_fiscal_registration registration
          ON registration.tenant_id=valuation.tenant_id AND registration.party_id=valuation.buyer_party_id
         AND registration.scheme='in-gstin'
       WHERE valuation.tenant_id=p_tenant AND valuation.id=v_valuation
       ORDER BY registration.legal_name COLLATE "C",registration.id
       LIMIT 501
    ) registration;
  IF v_count>500 THEN
    RETURN pg_catalog.jsonb_build_object('kind','blocked','blocker','recipient_selection_too_broad');
  END IF;
  IF p_recipient IS NULL THEN$new$);
  IF v_changed=v_definition
      OR pg_catalog.strpos(v_changed,'LIMIT 501')=0
      OR pg_catalog.strpos(v_changed,$find$'blocker','recipient_selection_too_broad'$find$)=0
      OR pg_catalog.strpos(v_changed,$find$ERRCODE='P2082'$find$)=0
      OR pg_catalog.strpos(v_changed,'role_row.tenant_id=ur.tenant_id')=0 THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Q208 recipient discovery bound was not exact';
  END IF;
  EXECUTE v_changed;
END
$q208_85_discovery_bound$;

DO $q208_85_provider_preflight$
DECLARE v_oid oid;v_definition text;v_changed text;v_hash text;
BEGIN
  v_oid:=pg_catalog.to_regprocedure(
    'public.list_india_fiscal_submission_provider_options(uuid,uuid,uuid)');
  v_definition:=pg_catalog.pg_get_functiondef(v_oid);
  v_hash:=pg_catalog.encode(public.digest(pg_catalog.convert_to(v_definition,'UTF8'),'sha256'),'hex');
  IF v_oid IS NULL OR v_hash IS DISTINCT FROM
      '319838391d06874b97475d5d40aa2aac48e3747de59abff4b48476729383bc6d' THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Q208 provider preflight predecessor drifted';
  END IF;
  v_changed:=pg_catalog.replace(v_definition,
    $old$  END IF;
  RETURN QUERY SELECT extension.id,extension.version,extension.content->>'provider_key',extension.key$old$,
    $new$  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.tax_assignment assignment
      WHERE assignment.tenant_id=p_tenant AND assignment.property_node=p_property
        AND assignment.jurisdiction_key='in-gst-lodging') THEN
    RAISE EXCEPTION USING ERRCODE='P2082',MESSAGE='fiscal provider jurisdiction is unsupported';
  END IF;
  RETURN QUERY SELECT extension.id,extension.version,extension.content->>'provider_key',extension.key$new$);
  IF v_changed=v_definition OR pg_catalog.strpos(v_changed,$find$ERRCODE='P2082'$find$)=0 THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Q208 provider preflight correction was not exact';
  END IF;
  EXECUTE v_changed;
END
$q208_85_provider_preflight$;

CREATE FUNCTION public.prepare_india_native_fiscal_invoice_v4(
  p_tenant uuid,p_property uuid,p_actor uuid,p_reservation uuid,p_folio uuid,
  p_recipient uuid,p_calendar_authority text,p_calendar_source_hash text,
  p_calendar_through date,p_calendar_dates date[],p_calendar_states text[],
  p_key text,p_request uuid,p_expected_selector_hash text,p_expected_confirmation_hash text
) RETURNS TABLE(native_timing_id uuid,request_event_id uuid,posting_binding_id uuid,
    prepared_source_json text,completed_receipt jsonb,internal_selectors jsonb)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,public SET timezone='UTC' SET datestyle='ISO,YMD' AS $$
#variable_conflict use_column
DECLARE
  v_authority jsonb;v_after_authority jsonb;v_key_hash text;v_readiness jsonb;
  v_existing public.india_gst_native_invoice_timing%ROWTYPE;
  v_applicability public.india_gst_accommodation_quoted_rate_applicability%ROWTYPE;
  v_selectors jsonb;v_kind text;
BEGIN
  -- Authenticate the signed-session route before reading durable key identity.
  v_authority:=public.read_india_native_issue_authority(
    p_tenant,p_property,p_actor,p_reservation,p_folio);
  IF p_recipient IS NULL OR p_key IS NULL OR p_key COLLATE "C" !~ '^[!-~]{8,200}$'
      OR p_request IS NULL OR p_calendar_dates IS NULL OR p_calendar_states IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='native operator command input is invalid';
  END IF;
  v_key_hash:=pg_catalog.encode(public.digest(p_key,'sha256'),'hex');

  -- This is the existing first financial lock used by v3. A waiter must select
  -- the completed identity only after the winner commits, before current roots.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    p_tenant::text||p_reservation::text||p_folio::text,0));
  v_after_authority:=public.read_india_native_issue_authority(
    p_tenant,p_property,p_actor,p_reservation,p_folio);
  IF v_after_authority IS DISTINCT FROM v_authority THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native issue authority changed while waiting for command identity';
  END IF;

  SELECT timing.* INTO v_existing
    FROM public.india_gst_native_invoice_timing timing
    JOIN public.india_gst_native_fiscal_document_origin origin
      ON origin.tenant_id=timing.tenant_id AND origin.native_timing_id=timing.id
    JOIN public.document document_row
      ON document_row.tenant_id=origin.tenant_id AND document_row.id=origin.document_id
     AND document_row.status='issued'
   WHERE timing.tenant_id=p_tenant AND timing.request_key_hash=v_key_hash;
  IF FOUND THEN
    SELECT applicability.* INTO STRICT v_applicability
      FROM public.india_gst_accommodation_quoted_rate_applicability applicability
     WHERE applicability.tenant_id=v_existing.tenant_id
       AND applicability.id=v_existing.applicability_id;
    IF v_existing.actor_id IS DISTINCT FROM p_actor
        OR v_existing.property_node IS DISTINCT FROM p_property
        OR v_existing.reservation_id IS DISTINCT FROM p_reservation
        OR v_existing.folio_id IS DISTINCT FROM p_folio
        OR v_existing.recipient_registration_id IS DISTINCT FROM p_recipient THEN
      RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='native invoice key belongs to a different permanent request';
    END IF;
    v_selectors:=pg_catalog.jsonb_build_object(
      'valuationId',v_existing.valuation_id,
      'serviceProvisionSnapshotId',v_existing.service_provision_snapshot_id,
      'paymentReceiptSnapshotId',v_existing.payment_receipt_snapshot_id,
      'ordinaryRegimeEvidenceId',v_existing.ordinary_regime_evidence_id,
      'supplierServiceLocationId',v_applicability.supplier_service_location_id,
      'supplierRegistrationStatusId',v_existing.supplier_registration_status_id,
      'supplierSezStatusId',v_applicability.supplier_sez_status_id,
      'recipientRegistrationId',v_existing.recipient_registration_id,
      'recipientSezStatusId',v_applicability.recipient_sez_status_id,
      'classificationId',v_applicability.classification_id);
  ELSE
    IF EXISTS(SELECT 1 FROM public.india_gst_native_invoice_timing timing
        WHERE timing.tenant_id=p_tenant AND timing.property_node=p_property
          AND timing.reservation_id=p_reservation AND timing.folio_id=p_folio)
        OR EXISTS(SELECT 1 FROM public.india_gst_native_fiscal_document_origin origin
          WHERE origin.tenant_id=p_tenant AND origin.property_node=p_property
            AND origin.reservation_id=p_reservation AND origin.folio_id=p_folio
            AND origin.document_kind='invoice') THEN
      RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='native invoice consideration window is already consumed';
    END IF;
    v_readiness:=public.discover_india_native_fiscal_issue(
      p_tenant,p_property,p_actor,p_reservation,p_folio,p_recipient,
      p_calendar_authority,p_calendar_source_hash,p_calendar_through,
      p_calendar_dates,p_calendar_states);
    v_kind:=v_readiness->>'kind';
    IF v_kind IS DISTINCT FROM 'ready' THEN
      IF v_kind='issued' THEN
        RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='native invoice consideration window is already consumed';
      END IF;
      RAISE EXCEPTION USING ERRCODE='P2081',MESSAGE='displayed native invoice evidence is stale';
    END IF;
    IF pg_catalog.jsonb_typeof(v_readiness) IS DISTINCT FROM 'object'
        OR (SELECT pg_catalog.array_agg(key ORDER BY key)
              FROM pg_catalog.jsonb_object_keys(v_readiness) key) IS DISTINCT FROM
           ARRAY['confirmation','evidenceHash','internalSelectors','kind','selectorHash']::text[]
        OR v_readiness->>'selectorHash' !~ '^[0-9a-f]{64}$'
        OR v_readiness->>'evidenceHash' !~ '^[0-9a-f]{64}$'
        OR pg_catalog.jsonb_typeof(v_readiness->'confirmation') IS DISTINCT FROM 'object'
        OR pg_catalog.jsonb_typeof(v_readiness->'internalSelectors') IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native operator readiness shape is invalid';
    END IF;
    v_selectors:=v_readiness->'internalSelectors';
  END IF;

  IF pg_catalog.jsonb_typeof(v_selectors) IS DISTINCT FROM 'object'
      OR (SELECT pg_catalog.array_agg(key ORDER BY key)
            FROM pg_catalog.jsonb_object_keys(v_selectors) key) IS DISTINCT FROM ARRAY[
          'classificationId','ordinaryRegimeEvidenceId','paymentReceiptSnapshotId',
          'recipientRegistrationId','recipientSezStatusId','serviceProvisionSnapshotId',
          'supplierRegistrationStatusId','supplierServiceLocationId','supplierSezStatusId',
          'valuationId']::text[]
      OR EXISTS(SELECT 1 FROM pg_catalog.jsonb_each_text(v_selectors) selector
          WHERE selector.value IS NULL OR selector.value COLLATE "C" !~
            '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
      OR v_selectors->>'recipientRegistrationId' IS DISTINCT FROM p_recipient::text THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native operator internal selector shape is invalid';
  END IF;

  RETURN QUERY
  SELECT prepared.native_timing_id,prepared.request_event_id,prepared.posting_binding_id,
         prepared.prepared_source_json,prepared.completed_receipt,v_selectors
    FROM public.prepare_india_native_fiscal_invoice_v3(
      p_tenant,p_property,p_actor,p_reservation,p_folio,
      (v_selectors->>'valuationId')::uuid,
      (v_selectors->>'serviceProvisionSnapshotId')::uuid,
      (v_selectors->>'paymentReceiptSnapshotId')::uuid,
      (v_selectors->>'ordinaryRegimeEvidenceId')::uuid,
      (v_selectors->>'supplierServiceLocationId')::uuid,
      (v_selectors->>'supplierRegistrationStatusId')::uuid,
      (v_selectors->>'supplierSezStatusId')::uuid,
      (v_selectors->>'recipientRegistrationId')::uuid,
      (v_selectors->>'recipientSezStatusId')::uuid,
      (v_selectors->>'classificationId')::uuid,
      p_calendar_authority,p_calendar_source_hash,p_calendar_through,
      p_calendar_dates,p_calendar_states,p_key,p_request,
      p_expected_selector_hash,p_expected_confirmation_hash) prepared;
END;
$$;

ALTER FUNCTION public.prepare_india_native_fiscal_invoice_v4(
  uuid,uuid,uuid,uuid,uuid,uuid,text,text,date,date[],text[],text,uuid,text,text)
  OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.prepare_india_native_fiscal_invoice_v4(
  uuid,uuid,uuid,uuid,uuid,uuid,text,text,date,date[],text[],text,uuid,text,text)
  FROM PUBLIC,app_role,yellow_runtime;
GRANT EXECUTE ON FUNCTION public.prepare_india_native_fiscal_invoice_v4(
  uuid,uuid,uuid,uuid,uuid,uuid,text,text,date,date[],text[],text,uuid,text,text)
  TO app_role;

DO $q208_85_postconditions$
DECLARE v_oid oid;v_source text;
BEGIN
  v_oid:=pg_catalog.to_regprocedure(
    'public.discover_india_native_fiscal_issue(uuid,uuid,uuid,uuid,uuid,uuid,text,text,date,date[],text[])');
  v_source:=pg_catalog.pg_get_functiondef(v_oid);
  IF v_oid IS NULL OR pg_catalog.strpos(v_source,'LIMIT 501')=0
      OR pg_catalog.strpos(v_source,$find$'blocker','recipient_selection_too_broad'$find$)=0
      OR pg_catalog.strpos(v_source,$find$ERRCODE='P2082'$find$)=0
      OR (SELECT owner.rolname FROM pg_catalog.pg_proc function_row
          JOIN pg_catalog.pg_roles owner ON owner.oid=function_row.proowner
          WHERE function_row.oid=v_oid)<>'yellow_owner'
      OR NOT pg_catalog.has_function_privilege('app_role',v_oid,'EXECUTE')
      OR pg_catalog.has_function_privilege('yellow_runtime',v_oid,'EXECUTE')
      OR pg_catalog.has_function_privilege('public',v_oid,'EXECUTE') THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Q208 bounded recipient discovery is malformed';
  END IF;
  v_oid:=pg_catalog.to_regprocedure(
    'public.list_india_fiscal_submission_provider_options(uuid,uuid,uuid)');
  v_source:=pg_catalog.pg_get_functiondef(v_oid);
  IF v_oid IS NULL OR pg_catalog.strpos(v_source,$find$ERRCODE='P2082'$find$)=0
      OR (SELECT owner.rolname FROM pg_catalog.pg_proc function_row
          JOIN pg_catalog.pg_roles owner ON owner.oid=function_row.proowner
          WHERE function_row.oid=v_oid)<>'yellow_owner'
      OR NOT pg_catalog.has_function_privilege('app_role',v_oid,'EXECUTE')
      OR pg_catalog.has_function_privilege('yellow_runtime',v_oid,'EXECUTE')
      OR pg_catalog.has_function_privilege('public',v_oid,'EXECUTE') THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Q208 provider jurisdiction preflight is malformed';
  END IF;
  v_oid:=pg_catalog.to_regprocedure(
    'public.prepare_india_native_fiscal_invoice_v4(uuid,uuid,uuid,uuid,uuid,uuid,text,text,date,date[],text[],text,uuid,text,text)');
  v_source:=pg_catalog.pg_get_functiondef(v_oid);
  IF v_oid IS NULL
      OR (SELECT owner.rolname FROM pg_catalog.pg_proc function_row
          JOIN pg_catalog.pg_roles owner ON owner.oid=function_row.proowner
          WHERE function_row.oid=v_oid)<>'yellow_owner'
      OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc function_row
          WHERE function_row.oid=v_oid AND function_row.prosecdef
            AND function_row.provolatile='v'
            AND function_row.proconfig @> ARRAY[
              'search_path=pg_catalog, public','TimeZone=UTC','DateStyle=ISO,YMD'])
      OR pg_catalog.pg_get_function_result(v_oid) IS DISTINCT FROM
         'TABLE(native_timing_id uuid, request_event_id uuid, posting_binding_id uuid, prepared_source_json text, completed_receipt jsonb, internal_selectors jsonb)'
      OR NOT pg_catalog.has_function_privilege('app_role',v_oid,'EXECUTE')
      OR pg_catalog.has_function_privilege('yellow_runtime',v_oid,'EXECUTE')
      OR pg_catalog.has_function_privilege('public',v_oid,'EXECUTE')
      OR pg_catalog.strpos(v_source,'pg_advisory_xact_lock(pg_catalog.hashtextextended(')=0
      OR pg_catalog.strpos(v_source,'v_after_authority:=public.read_india_native_issue_authority')=0
      OR pg_catalog.strpos(v_source,'public.prepare_india_native_fiscal_invoice_v3(')=0
      OR pg_catalog.strpos(v_source,'p_calendar_dates,p_calendar_states,p_key,p_request')=0 THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Q208 operator command capability is malformed';
  END IF;
END
$q208_85_postconditions$;

RESET ROLE;
