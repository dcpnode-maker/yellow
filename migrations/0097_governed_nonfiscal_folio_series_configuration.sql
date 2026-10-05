-- Order 562: one governed, auditable property configuration boundary for the
-- non-fiscal numbering series consumed by primary and additional folio opening.

DO $precondition$
BEGIN
  IF (SELECT pg_catalog.count(*) FROM public.schema_migration) IS DISTINCT FROM 96::bigint
     OR (SELECT pg_catalog.max(version) FROM public.schema_migration) IS DISTINCT FROM 96
     OR pg_catalog.to_regprocedure(
       'public.allocate_non_fiscal_folio_reference(uuid,uuid)'
     ) IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'non-fiscal folio-series configuration requires canonical migration 96';
  END IF;
END $precondition$;

INSERT INTO public.permission(code, description)
VALUES(
  'financials.folio-series:configure',
  'Configure the property non-fiscal folio numbering series'
)
ON CONFLICT (code) DO UPDATE
SET description = EXCLUDED.description;

CREATE FUNCTION public.assert_non_fiscal_folio_series_configuration_authority(
  p_tenant_id uuid,
  p_property_node uuid,
  p_actor_id uuid
) RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
CALLED ON NULL INPUT
PARALLEL UNSAFE
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_context_tenant uuid;
BEGIN
  IF session_user <> 'yellow_runtime'
     OR pg_catalog.current_setting('role', true) IS DISTINCT FROM 'app_role'
     OR current_user <> 'yellow_owner' THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'non-fiscal folio-series authority check requires the governed runtime app role';
  END IF;

  BEGIN
    v_context_tenant := NULLIF(
      pg_catalog.current_setting('app.tenant_id', true), ''
    )::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'non-fiscal folio-series tenant context is invalid';
  END;

  IF p_tenant_id IS NULL OR p_property_node IS NULL OR p_actor_id IS NULL
     OR v_context_tenant IS NULL OR v_context_tenant <> p_tenant_id THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'non-fiscal folio-series authority is unavailable';
  END IF;

  PERFORM 1
    FROM public.tenant AS target_tenant
    JOIN public.app_user AS actor
      ON actor.tenant_id = target_tenant.id
     AND actor.id = p_actor_id
     AND actor.status = 'active'
    JOIN public.user_role AS membership
      ON membership.tenant_id = actor.tenant_id
     AND membership.user_id = actor.id
    JOIN public.role AS actor_role
      ON actor_role.tenant_id = membership.tenant_id
     AND actor_role.id = membership.role_id
    JOIN public.role_permission AS grant_row
      ON grant_row.role_id = actor_role.id
     AND grant_row.permission_code = 'financials.folio-series:configure'
    JOIN public.org_node AS scope_node
      ON scope_node.tenant_id = membership.tenant_id
     AND scope_node.id = membership.scope_node
    JOIN public.org_node AS property
      ON property.tenant_id = target_tenant.id
     AND property.id = p_property_node
     AND property.kind = 'property'
     AND scope_node.path @> property.path
   WHERE target_tenant.id = p_tenant_id
     AND target_tenant.status = 'active'
   ORDER BY actor_role.id, scope_node.id
   FOR SHARE OF target_tenant, actor, membership, actor_role, grant_row,
     scope_node, property;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'non-fiscal folio-series authority is unavailable';
  END IF;
END;
$$;

ALTER FUNCTION public.assert_non_fiscal_folio_series_configuration_authority(uuid, uuid, uuid)
  OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.assert_non_fiscal_folio_series_configuration_authority(uuid, uuid, uuid)
  FROM PUBLIC, app_role, yellow_runtime;
GRANT EXECUTE ON FUNCTION public.assert_non_fiscal_folio_series_configuration_authority(uuid, uuid, uuid)
  TO app_role;

CREATE FUNCTION public.configure_non_fiscal_folio_series(
  p_tenant_id uuid,
  p_property_node uuid,
  p_prefix text,
  p_actor_id uuid,
  p_correlation_id uuid
) RETURNS TABLE (
  series_id uuid,
  tenant_id uuid,
  property_node uuid,
  prefix text,
  next_no bigint,
  created boolean
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
CALLED ON NULL INPUT
PARALLEL UNSAFE
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_business_date date;
  v_count integer;
  v_series public.document_series%ROWTYPE;
  v_payload jsonb;
BEGIN
  IF p_correlation_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'non-fiscal folio-series authority is unavailable';
  END IF;
  IF p_prefix IS NULL OR p_prefix <> pg_catalog.btrim(p_prefix)
     OR pg_catalog.char_length(p_prefix) NOT BETWEEN 1 AND 24
     OR p_prefix !~ '^[A-Za-z0-9/-]+$' THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'non-fiscal folio-series prefix is invalid';
  END IF;

  -- Reuse the exact locked authority boundary that the service calls before
  -- idempotency lookup, so new commands and same-key replays both fail closed.
  PERFORM public.assert_non_fiscal_folio_series_configuration_authority(
    p_tenant_id, p_property_node, p_actor_id
  );

  SELECT (pg_catalog.transaction_timestamp() AT TIME ZONE property.timezone)::date
    INTO v_business_date
    FROM public.org_node AS property
   WHERE property.tenant_id = p_tenant_id
     AND property.id = p_property_node
     AND property.kind = 'property';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'non-fiscal folio-series property is unavailable';
  END IF;

  -- This is deliberately identical to the allocator root in migration 0073.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_tenant_id::text || ':' || p_property_node::text || ':non-fiscal-folio',
      0
    )
  );

  SELECT pg_catalog.count(*)::integer
    INTO v_count
    FROM public.document_series AS candidate
   WHERE candidate.tenant_id = p_tenant_id
     AND candidate.property_node = p_property_node
     AND candidate.kind = 'folio';
  IF v_count > 1 THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'multiple folio series require reconciliation';
  END IF;

  IF v_count = 1 THEN
    SELECT candidate.*
      INTO STRICT v_series
      FROM public.document_series AS candidate
     WHERE candidate.tenant_id = p_tenant_id
       AND candidate.property_node = p_property_node
       AND candidate.kind = 'folio'
     FOR UPDATE;
    IF v_series.fiscal IS DISTINCT FROM false
       OR v_series.supplier_registration_id IS NOT NULL
       OR v_series.financial_year_start IS NOT NULL
       OR v_series.last_doc_hash IS NOT NULL
       OR v_series.next_no NOT BETWEEN 1 AND 9223372036854775806 THEN
      RAISE EXCEPTION USING ERRCODE = '55000',
        MESSAGE = 'existing non-fiscal folio series is invalid';
    END IF;
    IF v_series.prefix <> p_prefix THEN
      RAISE EXCEPTION USING ERRCODE = '23505',
        MESSAGE = 'property already has a different non-fiscal folio prefix';
    END IF;
    RETURN QUERY SELECT v_series.id, v_series.tenant_id,
      v_series.property_node, v_series.prefix, v_series.next_no, false;
    RETURN;
  END IF;

  INSERT INTO public.document_series(
    tenant_id, property_node, kind, prefix, next_no, fiscal,
    supplier_registration_id, financial_year_start, last_doc_hash
  ) VALUES (
    p_tenant_id, p_property_node, 'folio', p_prefix, 1, false,
    NULL, NULL, NULL
  ) RETURNING * INTO v_series;

  v_payload := pg_catalog.jsonb_build_object(
    'seriesId', v_series.id,
    'propertyNode', v_series.property_node,
    'kind', 'folio',
    'prefix', v_series.prefix,
    'fiscal', false
  );
  INSERT INTO public.fact_log(
    tenant_id, entity_type, entity_id, fact_type, valid_from,
    business_date, actor_id, payload
  ) VALUES (
    p_tenant_id, 'document_series', v_series.id, 'configured',
    pg_catalog.transaction_timestamp(), v_business_date, p_actor_id, v_payload
  );
  INSERT INTO public.outbox(
    tenant_id, property_node, business_date, aggregate_type, aggregate_id,
    event_type, event_version, actor_id, correlation_id, causation_id, payload
  ) VALUES (
    p_tenant_id, p_property_node, v_business_date, 'document_series',
    v_series.id, 'folio.series.configured', 1, p_actor_id,
    p_correlation_id, NULL, v_payload
  );

  RETURN QUERY SELECT v_series.id, v_series.tenant_id,
    v_series.property_node, v_series.prefix, v_series.next_no, true;
END;
$$;

ALTER FUNCTION public.configure_non_fiscal_folio_series(uuid, uuid, text, uuid, uuid)
  OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.configure_non_fiscal_folio_series(uuid, uuid, text, uuid, uuid)
  FROM PUBLIC, app_role, yellow_runtime;
GRANT EXECUTE ON FUNCTION public.configure_non_fiscal_folio_series(uuid, uuid, text, uuid, uuid)
  TO app_role;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.document_series
  FROM app_role, yellow_runtime;
