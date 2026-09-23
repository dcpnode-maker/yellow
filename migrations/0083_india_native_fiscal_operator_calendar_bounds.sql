-- Order440/Q208 forward repair after applied82: preserve its signatures and ACLs
-- while correcting PostgreSQL16 execution, exact query bounds, canonical calendar
-- branch handling and the existing supplier-active-at-issue invariant.

DO $q208_83_preconditions$
BEGIN
  IF (SELECT pg_catalog.max(version) FROM public.schema_migration) IS DISTINCT FROM 82
     OR NOT EXISTS (
       SELECT 1 FROM public.schema_migration WHERE version=82
        AND filename='0082_india_native_fiscal_operator_workflow.sql'
        AND pg_catalog.btrim(checksum_sha256)='702f66b3e05547f397e2393ae5a608a6f0c3069ec534b2c947bfc309983bf185') THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Q208 correction requires exact applied82';
  END IF;
END
$q208_83_preconditions$;

SET ROLE yellow_owner;

-- The predecessor body hashes make these transformations deterministic and make
-- any unrecorded function drift fail before replacement. pg_get_functiondef is
-- used only to preserve the large, already-applied82 bodies byte-for-byte outside
-- the narrowly admitted corrections.
DO $q208_83_repair$
DECLARE v_oid oid;v_definition text;v_changed text;v_hash text;
BEGIN
  v_oid:=pg_catalog.to_regprocedure(
    'public.list_india_native_fiscal_documents(uuid,uuid,uuid,date,date,uuid,uuid,text,date,timestamp with time zone,uuid,integer)');
  v_definition:=pg_catalog.pg_get_functiondef(v_oid);
  v_hash:=pg_catalog.encode(public.digest(pg_catalog.convert_to(v_definition,'UTF8'),'sha256'),'hex');
  IF v_hash<>'d28f18db4521c9b08d0354eeac0d0b36ecb923c24f858063186b831bdc191335' THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Q208 document list predecessor drifted';
  END IF;
  v_changed:=pg_catalog.replace(v_definition,
    $old$pg_catalog.char_length(v_query)>240$old$,
    $new$pg_catalog.char_length(v_query)>120$new$);
  v_changed:=pg_catalog.replace(v_changed,
    $old$AS $function$
DECLARE$old$,
    $new$AS $function$
#variable_conflict use_column
DECLARE$new$);
  IF v_changed=v_definition OR pg_catalog.strpos(v_changed,'char_length(v_query)>240')<>0
      OR pg_catalog.strpos(v_changed,'#variable_conflict use_column')=0 THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Q208 document list correction was not exact';
  END IF;
  EXECUTE v_changed;

  v_oid:=pg_catalog.to_regprocedure(
    'public.read_india_fiscal_submission_delivery_receipt_by_document(uuid,uuid,uuid,uuid)');
  v_definition:=pg_catalog.pg_get_functiondef(v_oid);
  v_hash:=pg_catalog.encode(public.digest(pg_catalog.convert_to(v_definition,'UTF8'),'sha256'),'hex');
  IF v_hash<>'45ba8a4095a2b488382d78482c57aa05be0622e5667e5f0fec955747f550f259' THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Q208 receipt-by-document predecessor drifted';
  END IF;
  v_changed:=pg_catalog.replace(v_definition,
    $old$pg_catalog.min(id),pg_catalog.min(delivery_version)$old$,
    $new$(pg_catalog.array_agg(id ORDER BY id))[1],pg_catalog.min(delivery_version)$new$);
  IF v_changed=v_definition OR pg_catalog.strpos(v_changed,'pg_catalog.min(id)')<>0 THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Q208 receipt UUID aggregation correction was not exact';
  END IF;
  EXECUTE v_changed;

  v_oid:=pg_catalog.to_regprocedure(
    'public.discover_india_native_fiscal_issue(uuid,uuid,uuid,uuid,uuid,uuid,text,text,date,date[],text[])');
  v_definition:=pg_catalog.pg_get_functiondef(v_oid);
  v_hash:=pg_catalog.encode(public.digest(pg_catalog.convert_to(v_definition,'UTF8'),'sha256'),'hex');
  IF v_hash<>'151298d825d231fd6ce7ce15426bcb42b353e4c127ce6580af5cf5754ef92841' THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Q208 discovery predecessor drifted';
  END IF;
  v_changed:=pg_catalog.replace(v_definition,
    $old$v_statutory record;v_tos date;v_service_date date;v_preview_timing uuid:=pg_catalog.gen_random_uuid();$old$,
    $new$v_statutory record;v_tos date;v_service_date date;v_error text;v_preview_timing uuid:=pg_catalog.gen_random_uuid();$new$);
  v_changed:=pg_catalog.replace(v_changed,
    $old$pg_catalog.min(valuation.id),pg_catalog.min(valuation.native_service_provision_snapshot_id)$old$,
    $new$(pg_catalog.array_agg(valuation.id ORDER BY valuation.id))[1],
      (pg_catalog.array_agg(valuation.native_service_provision_snapshot_id ORDER BY valuation.id))[1]$new$);
  v_changed:=pg_catalog.replace(v_changed,$old$pg_catalog.min(payment.id)$old$,
    $new$(pg_catalog.array_agg(payment.id ORDER BY payment.id))[1]$new$);
  v_changed:=pg_catalog.replace(v_changed,$old$pg_catalog.min(ordinary.id)$old$,
    $new$(pg_catalog.array_agg(ordinary.id ORDER BY ordinary.id))[1]$new$);
  v_changed:=pg_catalog.replace(v_changed,$old$pg_catalog.min(registration.id)$old$,
    $new$(pg_catalog.array_agg(registration.id ORDER BY registration.id))[1]$new$);
  v_changed:=pg_catalog.replace(v_changed,$old$pg_catalog.min(location.id)$old$,
    $new$(pg_catalog.array_agg(location.id ORDER BY location.id))[1]$new$);
  v_changed:=pg_catalog.replace(v_changed,$old$pg_catalog.min(status.id)$old$,
    $new$(pg_catalog.array_agg(status.id ORDER BY status.id))[1]$new$);
  v_changed:=pg_catalog.replace(v_changed,$old$pg_catalog.min(classification.id)$old$,
    $new$(pg_catalog.array_agg(classification.id ORDER BY classification.id))[1]$new$);
  v_changed:=pg_catalog.replace(v_changed,
    $old$  IF p_calendar_authority IS NULL OR p_calendar_source_hash IS NULL OR p_calendar_through IS NULL
      OR p_calendar_dates IS NULL OR p_calendar_states IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('kind','blocked','blocker','working_day_calendar_required');
  END IF;

$old$,$new$$new$);
  v_changed:=pg_catalog.replace(v_changed,
    $old$  EXCEPTION WHEN SQLSTATE 'P0010' OR SQLSTATE 'P0011' THEN
    RETURN pg_catalog.jsonb_build_object('kind','blocked','blocker','working_day_calendar_required');
  END;$old$,
    $new$  EXCEPTION
    WHEN SQLSTATE '22023' THEN
      GET STACKED DIAGNOSTICS v_error=MESSAGE_TEXT;
      IF v_error='mixed rate timing requires complete governed working-day calendar'
          AND p_calendar_authority IS NULL AND p_calendar_source_hash IS NULL
          AND p_calendar_through IS NULL AND COALESCE(pg_catalog.cardinality(p_calendar_dates),0)=0
          AND COALESCE(pg_catalog.cardinality(p_calendar_states),0)=0 THEN
        RETURN pg_catalog.jsonb_build_object('kind','blocked','blocker','working_day_calendar_required');
      END IF;
      RAISE;
    WHEN SQLSTATE 'P0010' OR SQLSTATE 'P0011' THEN
      RETURN pg_catalog.jsonb_build_object('kind','blocked','blocker','working_day_calendar_required');
  END;$new$);
  IF v_changed=v_definition OR pg_catalog.strpos(v_changed,'pg_catalog.min(')<>0
      OR pg_catalog.strpos(v_changed,
        $old$RETURN pg_catalog.jsonb_build_object('kind','blocked','blocker','working_day_calendar_required');
  END IF;

  BEGIN
    v_timing$old$)<>0
      OR pg_catalog.strpos(v_changed,'v_error=MESSAGE_TEXT')=0 THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Q208 discovery correction was not exact';
  END IF;
  EXECUTE v_changed;

  v_oid:=pg_catalog.to_regprocedure(
    'public.lock_india_native_statutory_source_graph(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,text)');
  v_definition:=pg_catalog.pg_get_functiondef(v_oid);
  v_hash:=pg_catalog.encode(public.digest(pg_catalog.convert_to(v_definition,'UTF8'),'sha256'),'hex');
  IF v_hash<>'07fb69d441c20e12aa7b4e61514cc658b6ae0fcfd47728893edecc87b7af6c9a' THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Q208 statutory lock predecessor drifted';
  END IF;
  v_changed:=pg_catalog.replace(v_definition,
    $old$DECLARE v_before record;v_after record;v_seller uuid;v_id uuid;$old$,
    $new$DECLARE v_before record;v_after record;v_seller uuid;v_id uuid;
  v_issue_date date;v_issue_status uuid;v_issue_count integer;$new$);
  v_changed:=pg_catalog.replace(v_changed,
    $old$  v_seller:=(v_before.prepared_source_json::json#>>'{sellerRegistration,registrationId}')::uuid;

  -- Each statement locks one exact row; the two dated sets use UUID order.$old$,
    $new$  v_seller:=(v_before.prepared_source_json::json#>>'{sellerRegistration,registrationId}')::uuid;
  v_issue_date:=(p_native_invoice_source::jsonb#>>'{timing,invoiceIssueDate}')::date;
  SELECT pg_catalog.count(*)::integer,(pg_catalog.array_agg(status.id ORDER BY status.id))[1]
    INTO v_issue_count,v_issue_status
    FROM public.india_gst_supplier_registration_status_snapshot status
   WHERE status.tenant_id=p_tenant AND status.supplier_registration_id=v_seller
     AND status.supplier_registration_evidence_hash=
       v_before.prepared_source_json::json#>>'{sellerRegistration,evidenceHash}'
     AND status.status_as_of=v_issue_date AND status.gst_registration_status='active';
  IF v_issue_count<>1 THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native supplier issue-date status is unavailable';
  END IF;

  -- Each statement locks one exact row; dated identities use UUID order.$new$);
  v_changed:=pg_catalog.replace(v_changed,
    $old$  PERFORM 1 FROM public.india_gst_supplier_registration_status_snapshot r
    WHERE r.tenant_id=p_tenant AND r.id=p_supplier_status FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native statutory supplier registration status disappeared before lock'; END IF;$old$,
    $new$  FOR v_id IN SELECT DISTINCT statuses.id FROM
      pg_catalog.unnest(ARRAY[p_supplier_status,v_issue_status]) AS statuses(id) ORDER BY statuses.id LOOP
    PERFORM 1 FROM public.india_gst_supplier_registration_status_snapshot r
      WHERE r.tenant_id=p_tenant AND r.id=v_id FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native statutory supplier registration status disappeared before lock'; END IF;
  END LOOP;$new$);
  v_changed:=pg_catalog.replace(v_changed,
    $old$  IF v_before.prepared_source_json IS DISTINCT FROM v_after.prepared_source_json$old$,
    $new$  PERFORM 1 FROM public.india_gst_supplier_registration_status_snapshot status
   WHERE status.tenant_id=p_tenant AND status.id=v_issue_status
     AND status.supplier_registration_id=v_seller
     AND status.supplier_registration_evidence_hash=
       v_after.prepared_source_json::json#>>'{sellerRegistration,evidenceHash}'
     AND status.status_as_of=v_issue_date AND status.gst_registration_status='active';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native supplier issue-date status changed during ordered locking';
  END IF;
  IF v_before.prepared_source_json IS DISTINCT FROM v_after.prepared_source_json$new$);
  IF v_changed=v_definition OR pg_catalog.strpos(v_changed,'v_issue_status')=0
      OR pg_catalog.strpos(v_changed,'unnest(ARRAY[p_supplier_status,v_issue_status])')=0 THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Q208 issue-date status lock correction was not exact';
  END IF;
  EXECUTE v_changed;
END
$q208_83_repair$;

DO $q208_83_postconditions$
DECLARE v_signature text;v_oid oid;v_source text;
BEGIN
  FOREACH v_signature IN ARRAY ARRAY[
    'public.list_india_native_fiscal_documents(uuid,uuid,uuid,date,date,uuid,uuid,text,date,timestamp with time zone,uuid,integer)',
    'public.discover_india_native_fiscal_issue(uuid,uuid,uuid,uuid,uuid,uuid,text,text,date,date[],text[])',
    'public.read_india_fiscal_submission_delivery_receipt_by_document(uuid,uuid,uuid,uuid)'
  ] LOOP
    v_oid:=pg_catalog.to_regprocedure(v_signature);
    IF v_oid IS NULL OR NOT pg_catalog.has_function_privilege('app_role',v_oid,'EXECUTE')
        OR pg_catalog.has_function_privilege('yellow_runtime',v_oid,'EXECUTE')
        OR pg_catalog.has_function_privilege('public',v_oid,'EXECUTE') THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Q208 corrected public capability ACL is malformed';
    END IF;
  END LOOP;
  v_source:=pg_catalog.pg_get_functiondef(pg_catalog.to_regprocedure(
    'public.lock_india_native_statutory_source_graph(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,text)'));
  IF pg_catalog.strpos(v_source,'unnest(ARRAY[p_supplier_status,v_issue_status])')=0
      OR (SELECT owner.rolname FROM pg_catalog.pg_proc function_row
          JOIN pg_catalog.pg_roles owner ON owner.oid=function_row.proowner
          WHERE function_row.oid=pg_catalog.to_regprocedure(
            'public.lock_india_native_statutory_source_graph(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,text)'))<>'yellow_owner'
      OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc function_row
          WHERE function_row.oid=pg_catalog.to_regprocedure(
            'public.lock_india_native_statutory_source_graph(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,text)')
            AND function_row.proconfig @> ARRAY['search_path=pg_catalog, public','TimeZone=UTC','DateStyle=ISO,YMD'])
      OR pg_catalog.has_function_privilege('app_role',
        'public.lock_india_native_statutory_source_graph(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,text)','EXECUTE')
      OR pg_catalog.has_function_privilege('yellow_runtime',
        'public.lock_india_native_statutory_source_graph(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,text)','EXECUTE')
      OR pg_catalog.has_function_privilege('public',
        'public.lock_india_native_statutory_source_graph(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,text)','EXECUTE') THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Q208 corrected issue-date lock authority is malformed';
  END IF;
END
$q208_83_postconditions$;

RESET ROLE;
