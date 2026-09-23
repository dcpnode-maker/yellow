-- Govern an active Party display/legal-name update without granting direct Party UPDATE.

CREATE FUNCTION public.update_party_profile(
  p_tenant uuid,
  p_property uuid,
  p_party uuid,
  p_actor uuid,
  p_request uuid,
  p_expected_display_name text,
  p_expected_legal_name text,
  p_display_name text,
  p_legal_name text
) RETURNS TABLE (
  party_id uuid,
  party_kind text,
  display_name text,
  legal_name text,
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
  v_timezone text;
  v_business_date date;
  v_fields text[] := ARRAY[]::text[];
  v_now timestamptz := pg_catalog.transaction_timestamp();
BEGIN
  IF session_user <> 'yellow_runtime'
     OR pg_catalog.current_setting('role', true) IS DISTINCT FROM 'app_role'
     OR current_user <> 'yellow_owner' THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'party profile update requires the governed runtime app role';
  END IF;

  BEGIN
    v_context_tenant := NULLIF(pg_catalog.current_setting('app.tenant_id', true), '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'party profile update tenant context is invalid';
  END;
  IF v_context_tenant IS NULL OR p_tenant IS NULL OR v_context_tenant <> p_tenant THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'party profile update tenant context is invalid';
  END IF;
  IF p_property IS NULL OR p_party IS NULL OR p_actor IS NULL OR p_request IS NULL
     OR p_expected_display_name IS NULL OR p_display_name IS NULL
     OR pg_catalog.length(p_expected_display_name) = 0 OR pg_catalog.length(p_display_name) = 0
     OR pg_catalog.length(p_expected_display_name) > 200 OR pg_catalog.length(p_display_name) > 200
     OR (p_expected_legal_name IS NOT NULL AND pg_catalog.length(p_expected_legal_name) > 300)
     OR (p_legal_name IS NOT NULL AND pg_catalog.length(p_legal_name) > 300) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'party profile update input is invalid';
  END IF;

  SELECT property.timezone INTO v_timezone
    FROM public.org_node AS property
   WHERE property.tenant_id = p_tenant AND property.id = p_property AND property.kind = 'property';
  IF NOT FOUND THEN RETURN; END IF;
  PERFORM 1 FROM public.app_user AS actor
   WHERE actor.tenant_id = p_tenant AND actor.id = p_actor AND actor.status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'party profile update actor is unavailable';
  END IF;

  SELECT party.* INTO v_party FROM public.party AS party
   WHERE party.tenant_id = p_tenant AND party.id = p_party AND party.status = 'active'
   FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  IF v_party.display_name IS DISTINCT FROM p_expected_display_name
     OR v_party.legal_name IS DISTINCT FROM p_expected_legal_name THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'party profile update compare-and-swap failed';
  END IF;

  IF v_party.display_name IS DISTINCT FROM p_display_name THEN
    v_fields := array_append(v_fields, 'display_name');
  END IF;
  IF v_party.legal_name IS DISTINCT FROM p_legal_name THEN
    v_fields := array_append(v_fields, 'legal_name');
  END IF;
  IF cardinality(v_fields) = 0 THEN
    RETURN QUERY SELECT v_party.id, v_party.kind, v_party.display_name, v_party.legal_name, false, v_fields;
    RETURN;
  END IF;

  UPDATE public.party SET display_name = p_display_name, legal_name = p_legal_name
   WHERE tenant_id = p_tenant AND id = v_party.id;
  v_business_date := (v_now AT TIME ZONE v_timezone)::date;
  INSERT INTO public.fact_log(
    tenant_id, entity_type, entity_id, fact_type, valid_from, business_date, actor_id, payload
  ) VALUES (
    p_tenant, 'party', v_party.id, 'party.updated', v_now, v_business_date, p_actor,
    pg_catalog.jsonb_build_object('party_id', v_party.id, 'changed_fields', v_fields, 'request_id', p_request)
  );
  INSERT INTO public.outbox(
    tenant_id, property_node, business_date, aggregate_type, aggregate_id, event_type,
    actor_id, correlation_id, payload
  ) VALUES (
    p_tenant, p_property, v_business_date, 'party', v_party.id, 'party.updated',
    p_actor, p_request,
    pg_catalog.jsonb_build_object('party_id', v_party.id, 'changed_fields', v_fields)
  );
  RETURN QUERY SELECT v_party.id, v_party.kind, p_display_name, p_legal_name, true, v_fields;
END;
$$;

ALTER FUNCTION public.update_party_profile(uuid, uuid, uuid, uuid, uuid, text, text, text, text)
  OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.update_party_profile(uuid, uuid, uuid, uuid, uuid, text, text, text, text)
  FROM PUBLIC, app_role, yellow_runtime;
GRANT EXECUTE ON FUNCTION public.update_party_profile(uuid, uuid, uuid, uuid, uuid, text, text, text, text)
  TO app_role;
REVOKE UPDATE ON public.party FROM app_role, yellow_runtime;
