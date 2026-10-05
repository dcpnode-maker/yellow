-- Order 410: remove raw document-series counter mutation from the runtime and
-- retain only one fixed-path capability for non-fiscal folio references.

REVOKE UPDATE (next_no) ON public.document_series FROM app_role;

CREATE FUNCTION public.allocate_non_fiscal_folio_reference(
  p_tenant_id uuid,
  p_property_node uuid
) RETURNS TABLE (
  series_id uuid,
  folio_reference text
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_context_tenant uuid;
  v_series_count integer;
  v_series_id uuid;
  v_prefix text;
  v_next_no bigint;
BEGIN
  IF session_user <> 'yellow_runtime'
     OR pg_catalog.current_setting('role', true) IS DISTINCT FROM 'app_role'
     OR current_user <> 'yellow_owner' THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'non-fiscal folio reference allocation requires the governed runtime app role';
  END IF;

  BEGIN
    v_context_tenant := NULLIF(
      pg_catalog.current_setting('app.tenant_id', true), ''
    )::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'non-fiscal folio reference tenant context is invalid';
  END;

  IF p_tenant_id IS NULL OR p_property_node IS NULL
     OR v_context_tenant IS NULL OR v_context_tenant <> p_tenant_id THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'non-fiscal folio reference tenant context is invalid';
  END IF;

  PERFORM 1
    FROM public.tenant AS target_tenant
   WHERE target_tenant.id = p_tenant_id
     AND target_tenant.status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'non-fiscal folio reference tenant is unavailable';
  END IF;

  PERFORM 1
    FROM public.org_node AS property
   WHERE property.tenant_id = p_tenant_id
     AND property.id = p_property_node
     AND property.kind = 'property';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'non-fiscal folio reference property is unavailable';
  END IF;

  -- Serialize discovery as well as allocation so two governed callers cannot
  -- observe or advance the same property counter concurrently out of order.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_tenant_id::text || ':' || p_property_node::text || ':non-fiscal-folio',
      0
    )
  );

  SELECT pg_catalog.count(*)::integer
    INTO v_series_count
    FROM public.document_series AS candidate
   WHERE candidate.tenant_id = p_tenant_id
     AND candidate.property_node = p_property_node
     AND candidate.kind = 'folio'
     AND candidate.fiscal = false;

  IF v_series_count <> 1 THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'exactly one non-fiscal folio series is required';
  END IF;

  SELECT candidate.id, candidate.prefix, candidate.next_no
    INTO v_series_id, v_prefix, v_next_no
    FROM public.document_series AS candidate
   WHERE candidate.tenant_id = p_tenant_id
     AND candidate.property_node = p_property_node
     AND candidate.kind = 'folio'
     AND candidate.fiscal = false
   FOR UPDATE;

  IF v_prefix IS NULL
     OR v_prefix <> pg_catalog.btrim(v_prefix)
     OR pg_catalog.char_length(v_prefix) NOT BETWEEN 1 AND 64
     OR pg_catalog.octet_length(v_prefix) NOT BETWEEN 1 AND 128
     OR v_prefix ~ '[[:cntrl:]]'
     OR v_prefix ~ U&'[\200B-\200D\202A-\202E\2060\2066-\2069\FEFF]'
     OR v_next_no NOT BETWEEN 1 AND 9223372036854775806 THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'non-fiscal folio series counter or prefix is invalid';
  END IF;

  RETURN QUERY
  UPDATE public.document_series AS target
     SET next_no = target.next_no + 1
   WHERE target.id = v_series_id
     AND target.tenant_id = p_tenant_id
     AND target.property_node = p_property_node
     AND target.kind = 'folio'
     AND target.fiscal = false
     AND target.next_no = v_next_no
  RETURNING target.id, target.prefix || (target.next_no - 1)::text;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '40001',
      MESSAGE = 'non-fiscal folio series changed during allocation';
  END IF;
END;
$$;

ALTER FUNCTION public.allocate_non_fiscal_folio_reference(uuid, uuid)
  OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.allocate_non_fiscal_folio_reference(uuid, uuid)
  FROM PUBLIC, app_role, yellow_runtime;
GRANT EXECUTE ON FUNCTION public.allocate_non_fiscal_folio_reference(uuid, uuid)
  TO app_role;
