-- Order 558: check-in's final transaction may lock and read exactly one assigned
-- room condition without restoring runtime UPDATE authority on unit_condition.

CREATE FUNCTION public.lock_checkin_room_condition(
  p_tenant uuid,
  p_property uuid,
  p_space uuid
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
  v_condition public.unit_condition%ROWTYPE;
BEGIN
  IF session_user <> 'yellow_runtime'
     OR pg_catalog.current_setting('role', true) IS DISTINCT FROM 'app_role'
     OR current_user <> 'yellow_owner' THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'check-in room condition lock requires the governed runtime app role';
  END IF;

  BEGIN
    v_context_tenant := NULLIF(
      pg_catalog.current_setting('app.tenant_id', true), ''
    )::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'check-in room condition lock tenant context is invalid';
  END;
  IF v_context_tenant IS NULL OR p_tenant IS NULL
     OR v_context_tenant <> p_tenant THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'check-in room condition lock tenant context is invalid';
  END IF;
  IF p_property IS NULL OR p_space IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'check-in room condition lock input is invalid';
  END IF;

  SELECT condition.*
    INTO v_condition
    FROM public.unit_condition AS condition
    JOIN public.space AS room
      ON room.tenant_id = condition.tenant_id
     AND room.id = condition.space_id
     AND room.property_node = p_property
     AND room.status = 'active'
   WHERE condition.tenant_id = p_tenant
     AND condition.space_id = p_space
   FOR UPDATE OF condition;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT v_condition.space_id, v_condition.condition, v_condition.updated_at;
END;
$$;

ALTER FUNCTION public.lock_checkin_room_condition(uuid, uuid, uuid)
  OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.lock_checkin_room_condition(uuid, uuid, uuid)
  FROM PUBLIC, app_role, yellow_runtime;
GRANT EXECUTE ON FUNCTION public.lock_checkin_room_condition(uuid, uuid, uuid)
  TO app_role;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.unit_condition
  FROM app_role, yellow_runtime;
