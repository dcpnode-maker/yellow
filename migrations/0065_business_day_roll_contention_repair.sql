-- Order 382: make current business-day opening converge across both existing
-- property/date and tenant/property/date uniqueness arbiters.

CREATE OR REPLACE FUNCTION public.open_current_business_day(p_tenant uuid, p_property uuid)
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
  ON CONFLICT DO NOTHING
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
