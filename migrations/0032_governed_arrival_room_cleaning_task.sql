-- Order 229: create at most one exact-room housekeeping task for an executable
-- dirty/pickup arrival blocker. Task selection and provenance stay server-owned.

CREATE FUNCTION public.create_arrival_room_cleaning_task(
  p_tenant uuid,
  p_property uuid,
  p_reservation uuid,
  p_attendant uuid,
  p_actor uuid
) RETURNS TABLE (
  task_id uuid,
  room_id uuid,
  room_condition text,
  assignee_party uuid,
  due_at timestamptz,
  created boolean
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_context_tenant uuid;
  v_reservation public.reservation%ROWTYPE;
  v_segment public.reservation_segment%ROWTYPE;
  v_room public.space%ROWTYPE;
  v_condition public.unit_condition%ROWTYPE;
  v_task public.task%ROWTYPE;
  v_count integer;
BEGIN
  IF session_user <> 'yellow_runtime'
     OR pg_catalog.current_setting('role', true) IS DISTINCT FROM 'app_role'
     OR current_user <> 'yellow_owner' THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'arrival room cleaning task requires the governed runtime app role';
  END IF;

  BEGIN
    v_context_tenant := NULLIF(pg_catalog.current_setting('app.tenant_id', true), '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'arrival room cleaning task tenant context is invalid';
  END;
  IF v_context_tenant IS NULL OR p_tenant IS NULL OR v_context_tenant <> p_tenant THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'arrival room cleaning task tenant context is invalid';
  END IF;
  IF p_property IS NULL OR p_reservation IS NULL OR p_attendant IS NULL OR p_actor IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'arrival room cleaning task input is invalid';
  END IF;

  PERFORM 1 FROM public.app_user AS actor
   WHERE actor.tenant_id = p_tenant AND actor.id = p_actor AND actor.status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'arrival room cleaning task target is unavailable';
  END IF;

  -- This capability exists only for the exact dirty-room blocker.  An actor who
  -- can override that blocker must continue through check-in instead of creating
  -- a housekeeping task through this path.  Recompute the property-scoped grant
  -- inside the owner transaction so a direct API call cannot bypass UI admission.
  PERFORM 1
    FROM public.user_role AS actor_grant
    JOIN public.role AS actor_role
      ON actor_role.tenant_id = actor_grant.tenant_id
     AND actor_role.id = actor_grant.role_id
    JOIN public.role_permission AS actor_permission
      ON actor_permission.role_id = actor_role.id
     AND actor_permission.permission_code = 'stay-operations.checkin:dirty-room-override'
    JOIN public.org_node AS grant_node
      ON grant_node.tenant_id = actor_grant.tenant_id
     AND grant_node.id = actor_grant.scope_node
    JOIN public.org_node AS target_property
      ON target_property.tenant_id = actor_grant.tenant_id
     AND target_property.id = p_property
     AND target_property.kind = 'property'
     AND target_property.path <@ grant_node.path
   WHERE actor_grant.tenant_id = p_tenant
     AND actor_grant.user_id = p_actor;
  IF FOUND THEN
    RETURN;
  END IF;

  PERFORM 1
    FROM public.party AS attendant
    JOIN public.party_role AS staff
      ON staff.tenant_id = attendant.tenant_id
     AND staff.party_id = attendant.id
     AND staff.role = 'staff'
   WHERE attendant.tenant_id = p_tenant
     AND attendant.id = p_attendant
     AND attendant.status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'arrival room cleaning task target is unavailable';
  END IF;

  SELECT reservation.* INTO v_reservation
    FROM public.reservation AS reservation
   WHERE reservation.tenant_id = p_tenant
     AND reservation.property_node = p_property
     AND reservation.id = p_reservation
     AND reservation.status = 'due_in'
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT pg_catalog.count(*)::integer INTO v_count
    FROM public.reservation_segment AS segment
   WHERE segment.tenant_id = p_tenant
     AND segment.reservation_id = p_reservation
     AND segment.status = 'booked'
     AND segment.period @> pg_catalog.transaction_timestamp();
  IF v_count <> 1 THEN
    RETURN;
  END IF;
  SELECT segment.* INTO v_segment
    FROM public.reservation_segment AS segment
   WHERE segment.tenant_id = p_tenant
     AND segment.reservation_id = p_reservation
     AND segment.status = 'booked'
     AND segment.period @> pg_catalog.transaction_timestamp()
   FOR UPDATE;
  IF v_segment.sellable_unit_id IS NULL THEN
    RETURN;
  END IF;

  SELECT pg_catalog.count(*)::integer INTO v_count
    FROM public.sellable_unit_space AS mapping
    JOIN public.space AS room
      ON room.tenant_id = mapping.tenant_id
     AND room.id = mapping.space_id
     AND room.property_node = p_property
     AND room.status = 'active'
   WHERE mapping.tenant_id = p_tenant
     AND mapping.sellable_unit_id = v_segment.sellable_unit_id;
  IF v_count <> 1 THEN
    RETURN;
  END IF;
  SELECT room.* INTO v_room
    FROM public.sellable_unit_space AS mapping
    JOIN public.space AS room
      ON room.tenant_id = mapping.tenant_id
     AND room.id = mapping.space_id
     AND room.property_node = p_property
     AND room.status = 'active'
   WHERE mapping.tenant_id = p_tenant
     AND mapping.sellable_unit_id = v_segment.sellable_unit_id
   FOR UPDATE OF room;

  SELECT condition.* INTO v_condition
    FROM public.unit_condition AS condition
   WHERE condition.tenant_id = p_tenant
     AND condition.space_id = v_room.id
     AND condition.condition IN ('dirty', 'pickup')
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'arrival-room-cleaning:' || p_tenant::text || ':' || p_property::text || ':' || v_room.id::text,
      229
    )
  );

  SELECT pg_catalog.count(*)::integer INTO v_count
    FROM public.task AS task
   WHERE task.tenant_id = p_tenant
     AND task.property_node = p_property
     AND task.kind = 'housekeeping'
     AND task.subject_type = 'space'
     AND task.subject_id = v_room.id
     AND task.status IN ('assigned', 'in_progress');
  IF v_count > 1 THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'arrival room cleaning task evidence is incoherent';
  ELSIF v_count = 1 THEN
    SELECT task.* INTO v_task
      FROM public.task AS task
     WHERE task.tenant_id = p_tenant
       AND task.property_node = p_property
       AND task.kind = 'housekeeping'
       AND task.subject_type = 'space'
       AND task.subject_id = v_room.id
       AND task.status IN ('assigned', 'in_progress')
     FOR UPDATE;
    RETURN QUERY SELECT v_task.id, v_room.id, v_condition.condition,
                        v_task.assignee_party, v_task.due_at, false;
    RETURN;
  END IF;

  INSERT INTO public.task (
    tenant_id, property_node, kind, status, subject_type, subject_id,
    assignee_party, department, due_at, priority, payload
  ) VALUES (
    p_tenant, p_property, 'housekeeping', 'assigned', 'space', v_room.id,
    p_attendant, 'Housekeeping', pg_catalog.lower(v_segment.period), 1,
    pg_catalog.jsonb_build_object(
      'source', 'arrival_room_cleaning',
      'reservation_id', p_reservation,
      'room_condition', v_condition.condition
    )
  ) RETURNING * INTO v_task;

  RETURN QUERY SELECT v_task.id, v_room.id, v_condition.condition,
                      v_task.assignee_party, v_task.due_at, true;
END;
$$;

ALTER FUNCTION public.create_arrival_room_cleaning_task(uuid, uuid, uuid, uuid, uuid)
  OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.create_arrival_room_cleaning_task(uuid, uuid, uuid, uuid, uuid)
  FROM PUBLIC, app_role, yellow_runtime;
GRANT EXECUTE ON FUNCTION public.create_arrival_room_cleaning_task(uuid, uuid, uuid, uuid, uuid)
  TO app_role;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.task FROM app_role, yellow_runtime;
