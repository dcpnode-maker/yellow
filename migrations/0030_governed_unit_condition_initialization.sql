-- Order 227: initialize one absent room condition through a bounded owner-mediated
-- capability. Existing conditions remain immutable through this ingress.

CREATE FUNCTION public.initialize_unit_condition(
  p_tenant uuid,
  p_property uuid,
  p_space uuid,
  p_condition text,
  p_actor uuid
) RETURNS TABLE (
  space_id uuid,
  room_condition text,
  room_updated_at timestamptz
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_context_tenant uuid;
  v_room public.space%ROWTYPE;
  v_condition public.unit_condition%ROWTYPE;
  v_now timestamptz := pg_catalog.transaction_timestamp();
BEGIN
  IF session_user <> 'yellow_runtime'
     OR pg_catalog.current_setting('role', true) IS DISTINCT FROM 'app_role'
     OR current_user <> 'yellow_owner' THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'unit condition initialization requires the governed runtime app role';
  END IF;

  BEGIN
    v_context_tenant := NULLIF(
      pg_catalog.current_setting('app.tenant_id', true), ''
    )::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'unit condition initialization tenant context is invalid';
  END;
  IF v_context_tenant IS NULL OR p_tenant IS NULL
     OR v_context_tenant <> p_tenant THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'unit condition initialization tenant context is invalid';
  END IF;

  IF p_property IS NULL OR p_space IS NULL OR p_actor IS NULL
     OR p_condition IS NULL
     OR p_condition NOT IN ('clean', 'dirty', 'pickup') THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'unit condition initialization input is invalid';
  END IF;

  PERFORM 1
    FROM public.app_user AS actor
   WHERE actor.tenant_id = p_tenant
     AND actor.id = p_actor
     AND actor.status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'unit condition initialization target is unavailable';
  END IF;

  PERFORM 1
    FROM public.org_node AS property
   WHERE property.tenant_id = p_tenant
     AND property.id = p_property
     AND property.kind = 'property';
  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT room.*
    INTO v_room
    FROM public.space AS room
   WHERE room.tenant_id = p_tenant
     AND room.property_node = p_property
     AND room.id = p_space
     AND room.status = 'active'
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT condition.*
    INTO v_condition
    FROM public.unit_condition AS condition
   WHERE condition.tenant_id = p_tenant
     AND condition.space_id = v_room.id;
  IF FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '40001',
      MESSAGE = 'unit condition already exists';
  END IF;

  INSERT INTO public.unit_condition (
    tenant_id, space_id, condition, updated_at, updated_by
  ) VALUES (
    p_tenant, v_room.id, p_condition, v_now, p_actor
  )
  RETURNING * INTO v_condition;

  RETURN QUERY SELECT v_condition.space_id, v_condition.condition,
                      v_condition.updated_at;
END;
$$;

ALTER FUNCTION public.initialize_unit_condition(uuid, uuid, uuid, text, uuid)
  OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.initialize_unit_condition(uuid, uuid, uuid, text, uuid)
  FROM PUBLIC, app_role, yellow_runtime;
GRANT EXECUTE ON FUNCTION public.initialize_unit_condition(uuid, uuid, uuid, text, uuid)
  TO app_role;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.unit_condition
  FROM app_role, yellow_runtime;
