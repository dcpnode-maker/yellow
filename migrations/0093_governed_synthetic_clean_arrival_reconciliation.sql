-- Reconcile one known synthetic Yellow Demo arrival Party without widening CRM edits.

CREATE FUNCTION public.reconcile_synthetic_clean_arrival_party(
  p_tenant uuid,
  p_property uuid,
  p_party uuid,
  p_reservation uuid,
  p_actor uuid,
  p_request uuid,
  p_expected_display_name text,
  p_expected_legal_name text,
  p_expected_attrs jsonb,
  p_display_name text,
  p_legal_name text,
  p_attrs jsonb
) RETURNS TABLE (
  party_id uuid,
  changed boolean,
  changed_fields text[]
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_context_tenant uuid;
  v_party public.party%ROWTYPE;
  v_fields text[] := ARRAY[]::text[];
  v_now timestamptz := pg_catalog.transaction_timestamp();
  v_business_date date;
  v_expected_attrs constant jsonb := '{"source":"local-review","checkin_example":"clean"}'::jsonb;
  v_expected_display constant text := 'Aarav Mehta';
  v_expected_legal constant text := 'Aarav Mehta';
BEGIN
  IF session_user <> 'yellow_runtime'
     OR pg_catalog.current_setting('role', true) IS DISTINCT FROM 'app_role'
     OR current_user <> 'yellow_owner' THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'synthetic clean-arrival reconciliation requires the governed runtime app role';
  END IF;
  BEGIN
    v_context_tenant := NULLIF(pg_catalog.current_setting('app.tenant_id', true), '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'synthetic clean-arrival reconciliation tenant context is invalid';
  END;
  IF v_context_tenant IS NULL OR p_tenant <> v_context_tenant
     OR p_tenant <> '6d9b7ce2-2d14-5576-b8c3-80f06501a603'::uuid
     OR p_property <> '4518a22f-b455-54c6-a50a-4584383749b9'::uuid
     OR p_party <> '55ee1818-f8e8-570e-9fe5-6bc7f88db2df'::uuid
     OR p_reservation <> 'fe25d718-95b5-51d9-9443-0098cd4d10dc'::uuid
     OR p_actor <> '9f90d3e9-94f9-54de-95ec-35bd00b99b15'::uuid
     OR p_request IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'synthetic clean-arrival reconciliation target is invalid';
  END IF;
  IF p_expected_display_name IS NULL OR p_expected_legal_name IS NULL OR p_expected_attrs IS NULL
     OR p_display_name IS DISTINCT FROM v_expected_display
     OR p_legal_name IS DISTINCT FROM v_expected_legal
     OR p_attrs IS DISTINCT FROM v_expected_attrs THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'synthetic clean-arrival reconciliation payload is invalid';
  END IF;

  -- Lock the mutation target first. Every authorization relationship is then
  -- locked and revalidated before the update, closing concurrent relation drift.
  SELECT party.* INTO v_party FROM public.party AS party
   WHERE id = p_party AND tenant_id = p_tenant AND kind = 'person'
     AND status = 'active' AND merged_into IS NULL
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'synthetic clean-arrival Party is unavailable'; END IF;
  PERFORM 1 FROM public.org_node AS property
   WHERE property.id = p_property AND property.tenant_id = p_tenant AND property.kind = 'property' AND property.timezone = 'UTC'
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'synthetic clean-arrival property is unavailable'; END IF;
  PERFORM 1 FROM public.app_user AS actor
   WHERE actor.id = p_actor AND actor.tenant_id = p_tenant AND actor.status = 'active'
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'synthetic clean-arrival actor is unavailable'; END IF;
  PERFORM 1 FROM public.reservation AS reservation
   WHERE reservation.id = p_reservation AND reservation.tenant_id = p_tenant AND reservation.property_node = p_property
     AND reservation.primary_party = p_party AND reservation.confirmation_no = 'ARR-CLEAN'
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'synthetic clean-arrival reservation is unavailable'; END IF;
  PERFORM 1 FROM public.party_role AS guest_role
   WHERE guest_role.tenant_id = p_tenant AND guest_role.party_id = p_party AND guest_role.role = 'guest'
     AND guest_role.detail = v_expected_attrs
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'synthetic clean-arrival guest role is invalid'; END IF;
  IF v_party.display_name IS DISTINCT FROM p_expected_display_name
     OR v_party.legal_name IS DISTINCT FROM p_expected_legal_name
     OR v_party.attrs IS DISTINCT FROM p_expected_attrs THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'synthetic clean-arrival reconciliation compare-and-swap failed';
  END IF;

  IF v_party.display_name IS DISTINCT FROM p_display_name THEN v_fields := array_append(v_fields, 'display_name'); END IF;
  IF v_party.legal_name IS DISTINCT FROM p_legal_name THEN v_fields := array_append(v_fields, 'legal_name'); END IF;
  IF v_party.attrs IS DISTINCT FROM p_attrs THEN v_fields := array_append(v_fields, 'attrs'); END IF;
  IF cardinality(v_fields) = 0 THEN
    RETURN QUERY SELECT v_party.id, false, v_fields;
    RETURN;
  END IF;

  UPDATE public.party SET display_name = p_display_name, legal_name = p_legal_name, attrs = p_attrs
   WHERE id = v_party.id AND tenant_id = p_tenant;
  v_business_date := (v_now AT TIME ZONE 'UTC')::date;
  INSERT INTO public.fact_log(tenant_id, entity_type, entity_id, fact_type, valid_from, business_date, actor_id, payload)
  VALUES (p_tenant, 'party', v_party.id, 'party.reconciled', v_now, v_business_date, p_actor,
    pg_catalog.jsonb_build_object('party_id', v_party.id, 'changed_fields', v_fields, 'request_id', p_request));
  INSERT INTO public.outbox(tenant_id, property_node, business_date, aggregate_type, aggregate_id, event_type, actor_id, correlation_id, payload)
  VALUES (p_tenant, p_property, v_business_date, 'party', v_party.id, 'party.reconciled', p_actor, p_request,
    pg_catalog.jsonb_build_object('party_id', v_party.id, 'changed_fields', v_fields));
  RETURN QUERY SELECT v_party.id, true, v_fields;
END;
$$;

ALTER FUNCTION public.reconcile_synthetic_clean_arrival_party(uuid, uuid, uuid, uuid, uuid, uuid, text, text, jsonb, text, text, jsonb)
  OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.reconcile_synthetic_clean_arrival_party(uuid, uuid, uuid, uuid, uuid, uuid, text, text, jsonb, text, text, jsonb)
  FROM PUBLIC, app_role, yellow_runtime;
GRANT EXECUTE ON FUNCTION public.reconcile_synthetic_clean_arrival_party(uuid, uuid, uuid, uuid, uuid, uuid, text, text, jsonb, text, text, jsonb)
  TO app_role;
REVOKE UPDATE ON public.party FROM app_role, yellow_runtime;
