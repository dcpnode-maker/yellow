-- Order 347: expose only bounded active tenant/property scopes whose exact
-- PostgreSQL-derived property-local current day has not yet been opened.

CREATE FUNCTION public.open_current_business_day(p_tenant uuid, p_property uuid)
RETURNS TABLE(business_date date, opened_at timestamptz, opened boolean)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $open_current_business_day$
DECLARE
  v_context text;
  v_date date;
  v_opened_at timestamptz;
BEGIN
  v_context := pg_catalog.current_setting('app.tenant_id', true);
  IF v_context IS NULL OR v_context !~
      '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      OR v_context::uuid <> p_tenant THEN
    RAISE EXCEPTION 'business-day tenant context is invalid' USING ERRCODE = '42501';
  END IF;
  IF p_property IS NULL THEN
    RAISE EXCEPTION 'business-day property is required' USING ERRCODE = '22023';
  END IF;

  SELECT (pg_catalog.transaction_timestamp() AT TIME ZONE timezone.name)::date
    INTO v_date
    FROM public.tenant AS tenant
    JOIN public.org_node AS property
      ON property.tenant_id = tenant.id
     AND property.id = p_property
     AND property.kind = 'property'
    JOIN pg_catalog.pg_timezone_names AS timezone
      ON timezone.name = property.timezone
   WHERE tenant.id = p_tenant
     AND tenant.status = 'active';

  IF v_date IS NULL THEN
    RAISE EXCEPTION 'active tenant property with valid timezone was not found'
      USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.business_day AS day (tenant_id, property_node, business_date)
  VALUES (p_tenant, p_property, v_date)
  ON CONFLICT ON CONSTRAINT business_day_pkey DO NOTHING
  RETURNING day.opened_at INTO v_opened_at;

  IF FOUND THEN
    RETURN QUERY SELECT v_date, v_opened_at, true;
    RETURN;
  END IF;

  SELECT day.opened_at INTO v_opened_at
    FROM public.business_day AS day
   WHERE day.tenant_id = p_tenant
     AND day.property_node = p_property
     AND day.business_date = v_date;
  IF v_opened_at IS NULL THEN
    RAISE EXCEPTION 'current business day could not be resolved' USING ERRCODE = '40001';
  END IF;
  RETURN QUERY SELECT v_date, v_opened_at, false;
END
$open_current_business_day$;

ALTER FUNCTION public.open_current_business_day(uuid,uuid) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.open_current_business_day(uuid,uuid)
  FROM PUBLIC, app_role, yellow_runtime;
GRANT EXECUTE ON FUNCTION public.open_current_business_day(uuid,uuid) TO app_role;

CREATE FUNCTION public.runtime_due_business_day_scopes(p_limit integer)
RETURNS TABLE(tenant_id uuid, property_node uuid)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $runtime_due_business_day_scopes$
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 1000 THEN
    RAISE EXCEPTION 'limit must be between 1 and 1000' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT tenant.id, property.id
    FROM public.tenant AS tenant
    JOIN public.org_node AS property
      ON property.tenant_id = tenant.id
     AND property.kind = 'property'
    JOIN pg_catalog.pg_timezone_names AS timezone
      ON timezone.name = property.timezone
   WHERE tenant.status = 'active'
     AND NOT EXISTS (
       SELECT 1
         FROM public.business_day AS day
        WHERE day.tenant_id = tenant.id
          AND day.property_node = property.id
          AND day.business_date =
              (pg_catalog.transaction_timestamp() AT TIME ZONE timezone.name)::date
     )
   ORDER BY tenant.id, property.id
   LIMIT p_limit;
END
$runtime_due_business_day_scopes$;

ALTER FUNCTION public.runtime_due_business_day_scopes(integer) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.runtime_due_business_day_scopes(integer)
  FROM PUBLIC, app_role, yellow_runtime;
GRANT EXECUTE ON FUNCTION public.runtime_due_business_day_scopes(integer) TO yellow_runtime;
