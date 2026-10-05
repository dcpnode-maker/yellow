-- Order 201: the runtime may advance an existing housekeeping task only through
-- the canonical adjacent lifecycle and its exact room-condition consequence.
-- Task creation, assignment, cancellation, reopening and sheet generation stay absent.

CREATE FUNCTION public.transition_housekeeping_task(
  p_tenant uuid,
  p_property uuid,
  p_task uuid,
  p_action text,
  p_expected_task_status text,
  p_expected_room_condition text,
  p_expected_room_updated_at timestamptz,
  p_actor uuid
) RETURNS TABLE (
  task_id uuid,
  task_status text,
  space_id uuid,
  room_condition text,
  room_updated_at timestamptz,
  task_completed_at timestamptz
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_context_tenant uuid;
  v_task public.task%ROWTYPE;
  v_condition public.unit_condition%ROWTYPE;
  v_new_task_status text;
  v_new_condition text;
  v_now timestamptz := pg_catalog.transaction_timestamp();
BEGIN
  IF session_user <> 'yellow_runtime'
     OR pg_catalog.current_setting('role', true) IS DISTINCT FROM 'app_role'
     OR current_user <> 'yellow_owner' THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'housekeeping transition requires the governed runtime app role';
  END IF;

  BEGIN
    v_context_tenant := NULLIF(
      pg_catalog.current_setting('app.tenant_id', true), ''
    )::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'housekeeping transition tenant context is invalid';
  END;
  IF v_context_tenant IS NULL OR p_tenant IS NULL
     OR v_context_tenant <> p_tenant THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'housekeeping transition tenant context is invalid';
  END IF;

  IF p_property IS NULL OR p_task IS NULL OR p_actor IS NULL
     OR p_expected_room_updated_at IS NULL
     OR p_action NOT IN ('start', 'complete', 'verify')
     OR p_expected_task_status NOT IN ('assigned', 'in_progress', 'done')
     OR p_expected_room_condition NOT IN ('clean', 'dirty', 'pickup', 'inspected') THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'housekeeping transition input is invalid';
  END IF;

  PERFORM 1
    FROM public.app_user AS actor
   WHERE actor.tenant_id = p_tenant
     AND actor.id = p_actor
     AND actor.status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'housekeeping transition target is unavailable';
  END IF;

  PERFORM 1
    FROM public.org_node AS property
   WHERE property.tenant_id = p_tenant
     AND property.id = p_property
     AND property.kind = 'property';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'housekeeping transition target is unavailable';
  END IF;

  SELECT task.*
    INTO v_task
    FROM public.task AS task
    JOIN public.space AS room
      ON room.tenant_id = task.tenant_id
     AND room.id = task.subject_id
     AND room.property_node = task.property_node
     AND room.status = 'active'
   WHERE task.tenant_id = p_tenant
     AND task.property_node = p_property
     AND task.id = p_task
     AND task.kind = 'housekeeping'
     AND task.subject_type = 'space'
     AND task.subject_id IS NOT NULL
   FOR UPDATE OF task, room;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'housekeeping transition target is unavailable';
  END IF;

  SELECT condition.*
    INTO v_condition
    FROM public.unit_condition AS condition
   WHERE condition.tenant_id = p_tenant
     AND condition.space_id = v_task.subject_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'housekeeping transition target is unavailable';
  END IF;

  IF v_task.status <> p_expected_task_status
     OR v_condition.condition <> p_expected_room_condition
     OR v_condition.updated_at <> p_expected_room_updated_at THEN
    RAISE EXCEPTION USING ERRCODE = '40001',
      MESSAGE = 'housekeeping transition evidence is stale';
  END IF;

  CASE p_action
    WHEN 'start' THEN
      IF v_task.status <> 'assigned' OR v_task.assignee_party IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = '55000',
          MESSAGE = 'housekeeping transition is not allowed';
      END IF;
      v_new_task_status := 'in_progress';
      v_new_condition := v_condition.condition;
    WHEN 'complete' THEN
      IF v_task.status <> 'in_progress'
         OR v_condition.condition NOT IN ('dirty', 'pickup') THEN
        RAISE EXCEPTION USING ERRCODE = '55000',
          MESSAGE = 'housekeeping transition is not allowed';
      END IF;
      v_new_task_status := 'done';
      v_new_condition := 'clean';
    WHEN 'verify' THEN
      IF v_task.status <> 'done' OR v_condition.condition <> 'clean' THEN
        RAISE EXCEPTION USING ERRCODE = '55000',
          MESSAGE = 'housekeeping transition is not allowed';
      END IF;
      v_new_task_status := 'verified';
      v_new_condition := 'inspected';
    ELSE
      RAISE EXCEPTION USING ERRCODE = '22023',
        MESSAGE = 'housekeeping transition input is invalid';
  END CASE;

  UPDATE public.task AS task
     SET status = v_new_task_status,
         completed_at = CASE
           WHEN p_action = 'complete' THEN v_now
           ELSE task.completed_at
         END
   WHERE task.tenant_id = p_tenant
     AND task.id = p_task;

  IF v_new_condition <> v_condition.condition THEN
    UPDATE public.unit_condition AS condition
       SET condition = v_new_condition,
           updated_at = v_now,
           updated_by = p_actor
     WHERE condition.tenant_id = p_tenant
       AND condition.space_id = v_task.subject_id;
  END IF;

  RETURN QUERY
  SELECT task.id, task.status, v_task.subject_id,
         condition.condition, condition.updated_at, task.completed_at
    FROM public.task AS task
    JOIN public.unit_condition AS condition
      ON condition.tenant_id = task.tenant_id
     AND condition.space_id = task.subject_id
   WHERE task.tenant_id = p_tenant
     AND task.id = p_task;
END;
$$;

ALTER FUNCTION public.transition_housekeeping_task(
  uuid, uuid, uuid, text, text, text, timestamptz, uuid
) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.transition_housekeeping_task(
  uuid, uuid, uuid, text, text, text, timestamptz, uuid
) FROM PUBLIC, app_role, yellow_runtime;
GRANT EXECUTE ON FUNCTION public.transition_housekeeping_task(
  uuid, uuid, uuid, text, text, text, timestamptz, uuid
) TO app_role;

-- The function is the only runtime mutation path for these two records.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.task FROM app_role, yellow_runtime;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.unit_condition FROM app_role, yellow_runtime;
