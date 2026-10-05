-- Target-bound synthetic fixture account-name correction; never a generic account editor.
CREATE FUNCTION public.reconcile_synthetic_clean_arrival_account(
  p_tenant uuid, p_property uuid, p_party uuid, p_reservation uuid, p_account uuid,
  p_folio uuid, p_actor uuid, p_request uuid, p_expected_name text, p_name text
) RETURNS TABLE(account_id uuid, changed boolean, changed_fields text[])
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_tenant uuid; v_context text; v_account public.account%ROWTYPE; v_now timestamptz:=pg_catalog.transaction_timestamp();
BEGIN
  IF session_user<>'yellow_runtime' OR pg_catalog.current_setting('role',true) IS DISTINCT FROM 'app_role' OR current_user<>'yellow_owner' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='synthetic account reconciliation requires governed runtime role'; END IF;
  v_context:=NULLIF(pg_catalog.current_setting('app.tenant_id',true),'');
  IF v_context IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='synthetic account reconciliation target is invalid'; END IF;
  BEGIN v_tenant:=v_context::uuid; EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='synthetic account reconciliation target is invalid'; END;
  IF v_tenant IS DISTINCT FROM p_tenant OR p_tenant IS DISTINCT FROM '6d9b7ce2-2d14-5576-b8c3-80f06501a603'::uuid OR p_property IS DISTINCT FROM '4518a22f-b455-54c6-a50a-4584383749b9'::uuid OR p_party IS DISTINCT FROM '55ee1818-f8e8-570e-9fe5-6bc7f88db2df'::uuid OR p_reservation IS DISTINCT FROM 'fe25d718-95b5-51d9-9443-0098cd4d10dc'::uuid OR p_account IS DISTINCT FROM 'b70473b6-48a9-5167-a734-3f510e27a18f'::uuid OR p_folio IS DISTINCT FROM 'b1b5c625-6093-5345-8d23-a307fbb70456'::uuid OR p_actor IS DISTINCT FROM '9f90d3e9-94f9-54de-95ec-35bd00b99b15'::uuid OR p_request IS NULL OR p_expected_name IS NULL OR p_name IS DISTINCT FROM 'Aarav Mehta Guest Ledger' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='synthetic account reconciliation target is invalid'; END IF;
  PERFORM 1 FROM public.party WHERE id=p_party AND tenant_id=p_tenant AND kind='person' AND status='active' AND merged_into IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='synthetic Party unavailable'; END IF;
  PERFORM 1 FROM public.org_node WHERE id=p_property AND tenant_id=p_tenant AND kind='property' AND timezone='UTC' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='synthetic property unavailable'; END IF;
  PERFORM 1 FROM public.app_user WHERE id=p_actor AND tenant_id=p_tenant AND status='active' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='synthetic actor unavailable'; END IF;
  PERFORM 1 FROM public.party_role WHERE tenant_id=p_tenant AND party_id=p_party AND role='guest' AND detail='{"source":"local-review","checkin_example":"clean"}'::jsonb FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='synthetic guest role unavailable'; END IF;
  SELECT * INTO v_account FROM public.account WHERE id=p_account AND tenant_id=p_tenant AND property_node=p_property AND party_id=p_party AND role='guest' AND currency='USD' AND credit_limit_minor IS NULL AND status='open' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='synthetic account unavailable'; END IF;
  PERFORM 1 FROM public.reservation WHERE id=p_reservation AND tenant_id=p_tenant AND property_node=p_property AND primary_party=p_party AND confirmation_no='ARR-CLEAN' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='synthetic reservation unavailable'; END IF;
  PERFORM 1 FROM public.folio AS f WHERE f.id=p_folio AND f.tenant_id=p_tenant AND f.account_id=p_account AND f.reservation_id=p_reservation AND f.window_no=1 AND f.status='open' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='synthetic primary folio unavailable'; END IF;
  IF EXISTS(SELECT 1 FROM public.posting_line AS pl WHERE pl.tenant_id=p_tenant AND pl.account_id=p_account) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='synthetic account has postings'; END IF;
  IF EXISTS(SELECT 1 FROM public.payment_operation WHERE tenant_id=p_tenant AND (guest_account_id=p_account OR folio_id=p_folio)) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='synthetic account has payment activity'; END IF;
  IF v_account.name IS DISTINCT FROM p_expected_name THEN RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='synthetic account reconciliation compare-and-swap failed'; END IF;
  IF v_account.name=p_name THEN RETURN QUERY SELECT v_account.id,false,ARRAY[]::text[]; RETURN; END IF;
  UPDATE public.account SET name=p_name WHERE id=v_account.id AND tenant_id=p_tenant;
  INSERT INTO public.fact_log(tenant_id,entity_type,entity_id,fact_type,valid_from,business_date,actor_id,payload) VALUES(p_tenant,'account',v_account.id,'account.reconciled',v_now,(v_now AT TIME ZONE 'UTC')::date,p_actor,jsonb_build_object('account_id',v_account.id,'changed_fields',ARRAY['name'],'request_id',p_request));
  INSERT INTO public.outbox(tenant_id,property_node,business_date,aggregate_type,aggregate_id,event_type,actor_id,correlation_id,payload) VALUES(p_tenant,p_property,(v_now AT TIME ZONE 'UTC')::date,'account',v_account.id,'account.reconciled',p_actor,p_request,jsonb_build_object('account_id',v_account.id,'changed_fields',ARRAY['name']));
  RETURN QUERY SELECT v_account.id,true,ARRAY['name']::text[];
END; $$;
ALTER FUNCTION public.reconcile_synthetic_clean_arrival_account(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,text) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.reconcile_synthetic_clean_arrival_account(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,text) FROM PUBLIC,app_role,yellow_runtime;
GRANT EXECUTE ON FUNCTION public.reconcile_synthetic_clean_arrival_account(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,text) TO app_role;
REVOKE UPDATE ON public.account FROM app_role,yellow_runtime;
