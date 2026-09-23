-- Order 299: expose only the exact effective bounds of one already-selected,
-- tenant-visible extension. This capability does not select an extension or
-- decide whether any property-local date falls within the range.

CREATE FUNCTION public.runtime_visible_extension_effective_period(
  p_tenant uuid,
  p_extension uuid
)
RETURNS TABLE(
  extension_id uuid,
  owner_tenant_id uuid,
  effective_from_instant timestamptz,
  effective_to_instant timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $runtime_visible_extension_effective_period$
DECLARE
  v_ranges tstzrange[];
  v_extension_ids uuid[];
  v_owner_tenant_ids uuid[];
  v_effective tstzrange;
BEGIN
  IF session_user <> 'yellow_runtime' THEN
    RAISE EXCEPTION 'extension effective-period capability requires yellow_runtime'
      USING ERRCODE = '42501';
  END IF;
  IF p_tenant IS NULL OR p_extension IS NULL THEN
    RAISE EXCEPTION 'tenant id and selected extension id are required'
      USING ERRCODE = '22023';
  END IF;

  SELECT pg_catalog.array_agg(e.id ORDER BY e.id),
         pg_catalog.array_agg(e.tenant_id ORDER BY e.id),
         pg_catalog.array_agg(e.effective ORDER BY e.id)
    INTO v_extension_ids, v_owner_tenant_ids, v_ranges
    FROM public.extension AS e
   WHERE e.id = p_extension
     AND (e.tenant_id IS NULL OR e.tenant_id = p_tenant);

  IF COALESCE(pg_catalog.cardinality(v_ranges), 0) <> 1 THEN
    RAISE EXCEPTION 'selected visible extension identity is invalid'
      USING ERRCODE = '22023';
  END IF;
  v_effective := v_ranges[1];

  IF v_effective IS NULL
     OR pg_catalog.isempty(v_effective)
     OR (NOT pg_catalog.lower_inf(v_effective)
         AND (NOT pg_catalog.isfinite(pg_catalog.lower(v_effective))
              OR NOT pg_catalog.lower_inc(v_effective)))
     OR (NOT pg_catalog.upper_inf(v_effective)
         AND (NOT pg_catalog.isfinite(pg_catalog.upper(v_effective))
              OR pg_catalog.upper_inc(v_effective))) THEN
    RAISE EXCEPTION 'selected extension effective period is malformed'
      USING ERRCODE = '22023';
  END IF;

  RETURN QUERY SELECT
    v_extension_ids[1],
    v_owner_tenant_ids[1],
    CASE WHEN pg_catalog.lower_inf(v_effective)
      THEN NULL::timestamptz ELSE pg_catalog.lower(v_effective) END,
    CASE WHEN pg_catalog.upper_inf(v_effective)
      THEN NULL::timestamptz ELSE pg_catalog.upper(v_effective) END;
END
$runtime_visible_extension_effective_period$;

ALTER FUNCTION public.runtime_visible_extension_effective_period(uuid, uuid)
  OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.runtime_visible_extension_effective_period(uuid, uuid)
  FROM PUBLIC, app_role;
GRANT EXECUTE ON FUNCTION public.runtime_visible_extension_effective_period(uuid, uuid)
  TO yellow_runtime;

DO $order299_postconditions$
DECLARE
  v_function oid := pg_catalog.to_regprocedure(
    'public.runtime_visible_extension_effective_period(uuid,uuid)'
  );
BEGIN
  IF v_function IS NULL THEN
    RAISE EXCEPTION 'Order 299 function is missing' USING ERRCODE = '55000';
  END IF;
  IF NOT EXISTS (
    SELECT 1
      FROM pg_catalog.pg_proc AS p
      JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
     WHERE p.oid = v_function
       AND n.nspname = 'public'
       AND p.proowner = 'yellow_owner'::pg_catalog.regrole
       AND p.prosecdef
       AND p.provolatile = 's'
       AND p.proretset
       AND p.proconfig = ARRAY['search_path=pg_catalog, public, pg_temp']::text[]
  ) THEN
    RAISE EXCEPTION 'Order 299 function authority is malformed'
      USING ERRCODE = '55000';
  END IF;
  IF pg_catalog.has_function_privilege('public', v_function, 'EXECUTE')
     OR pg_catalog.has_function_privilege('app_role', v_function, 'EXECUTE')
     OR NOT pg_catalog.has_function_privilege('yellow_runtime', v_function, 'EXECUTE') THEN
    RAISE EXCEPTION 'Order 299 function privileges are malformed'
      USING ERRCODE = '55000';
  END IF;
  IF EXISTS (
    SELECT 1
      FROM pg_catalog.aclexplode(
        COALESCE(
          (SELECT p.proacl FROM pg_catalog.pg_proc AS p WHERE p.oid = v_function),
          pg_catalog.acldefault('f', 'yellow_owner'::pg_catalog.regrole)
        )
      ) AS acl
     WHERE acl.privilege_type = 'EXECUTE'
       AND acl.grantee NOT IN (
         'yellow_owner'::pg_catalog.regrole,
         'yellow_runtime'::pg_catalog.regrole
       )
  ) THEN
    RAISE EXCEPTION 'Order 299 function has an unexpected executor'
      USING ERRCODE = '55000';
  END IF;
END
$order299_postconditions$;
