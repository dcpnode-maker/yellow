-- Order 183: permit immutable reversal lineage on the existing journal primitive
-- and make one-reversal arbitration authoritative in PostgreSQL.

GRANT INSERT (reverses) ON public.journal TO app_role;

CREATE UNIQUE INDEX journal_one_reversal
  ON public.journal (tenant_id, reverses)
  WHERE reverses IS NOT NULL;

-- PostgreSQL requires UPDATE privilege for SELECT ... FOR SHARE. Keep direct
-- business-day mutation denied and expose only this bounded, tenant-bound lock.
CREATE FUNCTION public.lock_financial_business_days(
  p_tenant uuid,
  p_property uuid,
  p_dates date[]
) RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_context_tenant uuid;
  v_requested_dates integer;
  v_locked_dates integer;
BEGIN
  IF pg_catalog.current_setting('role', true) IS DISTINCT FROM 'app_role' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'financial business-day lock requires app_role';
  END IF;

  BEGIN
    v_context_tenant := NULLIF(
      pg_catalog.current_setting('app.tenant_id', true), ''
    )::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'financial business-day lock tenant context is invalid';
  END;
  IF v_context_tenant IS NULL OR p_tenant IS NULL OR v_context_tenant <> p_tenant THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'financial business-day lock tenant context is invalid';
  END IF;

  v_requested_dates := pg_catalog.cardinality(p_dates);
  IF p_property IS NULL OR v_requested_dates IS NULL
     OR v_requested_dates < 1 OR v_requested_dates > 2
     OR EXISTS (
       SELECT 1 FROM pg_catalog.unnest(p_dates) AS requested(value)
       WHERE requested.value IS NULL OR NOT pg_catalog.isfinite(requested.value)
     )
     OR (
       SELECT pg_catalog.count(DISTINCT requested.value)
       FROM pg_catalog.unnest(p_dates) AS requested(value)
     ) <> v_requested_dates THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'financial business-day lock target set is invalid';
  END IF;

  SELECT pg_catalog.count(*)::integer INTO v_locked_dates
  FROM (
    SELECT day.business_date
    FROM public.business_day AS day
    WHERE day.tenant_id = p_tenant
      AND day.property_node = p_property
      AND day.business_date = ANY (p_dates)
    ORDER BY day.business_date
    FOR SHARE
  ) AS locked;
  IF v_locked_dates <> v_requested_dates THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'financial business-day lock targets are unavailable';
  END IF;
END;
$$;

ALTER FUNCTION public.lock_financial_business_days(uuid,uuid,date[]) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.lock_financial_business_days(uuid,uuid,date[])
  FROM PUBLIC, app_role, yellow_runtime;
GRANT EXECUTE ON FUNCTION public.lock_financial_business_days(uuid,uuid,date[]) TO app_role;
