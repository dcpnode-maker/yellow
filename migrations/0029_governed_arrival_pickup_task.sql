-- Order 213: atomically materialize one canonical arrival-pickup task from
-- current reservation and travel truth. Raw runtime task/travel DML stays denied.

CREATE FUNCTION public.govern_arrival_pickup_task(
  p_tenant uuid,
  p_property uuid,
  p_reservation uuid,
  p_actor uuid
) RETURNS TABLE (
  task_id uuid,
  created boolean,
  due_at timestamptz
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_context_tenant uuid;
  v_reservation public.reservation%ROWTYPE;
  v_travel public.travel_detail%ROWTYPE;
  v_task public.task%ROWTYPE;
BEGIN
  IF session_user <> 'yellow_runtime'
     OR pg_catalog.current_setting('role', true) IS DISTINCT FROM 'app_role'
     OR current_user <> 'yellow_owner' THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'arrival pickup task automation requires the governed runtime app role';
  END IF;

  BEGIN
    v_context_tenant := NULLIF(
      pg_catalog.current_setting('app.tenant_id', true), ''
    )::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'arrival pickup task automation tenant context is invalid';
  END;
  IF v_context_tenant IS NULL OR p_tenant IS NULL
     OR v_context_tenant <> p_tenant THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'arrival pickup task automation tenant context is invalid';
  END IF;

  IF p_property IS NULL OR p_reservation IS NULL OR p_actor IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'arrival pickup task automation input is invalid';
  END IF;

  PERFORM 1
    FROM public.app_user AS actor
   WHERE actor.tenant_id = p_tenant
     AND actor.id = p_actor
     AND actor.status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'arrival pickup task automation actor is unavailable';
  END IF;

  PERFORM 1
    FROM public.org_node AS property
   WHERE property.tenant_id = p_tenant
     AND property.id = p_property
     AND property.kind = 'property';
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::uuid, false, NULL::timestamptz;
    RETURN;
  END IF;

  SELECT reservation.*
    INTO v_reservation
    FROM public.reservation AS reservation
   WHERE reservation.tenant_id = p_tenant
     AND reservation.property_node = p_property
     AND reservation.id = p_reservation
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::uuid, false, NULL::timestamptz;
    RETURN;
  END IF;

  SELECT travel.*
    INTO v_travel
    FROM public.travel_detail AS travel
   WHERE travel.tenant_id = p_tenant
     AND travel.reservation_id = p_reservation
     AND travel.direction = 'arrival'
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::uuid, false, NULL::timestamptz;
    RETURN;
  END IF;

  IF v_travel.pickup_task_id IS NOT NULL THEN
    SELECT task.*
      INTO v_task
      FROM public.task AS task
     WHERE task.tenant_id = p_tenant
       AND task.property_node = p_property
       AND task.id = v_travel.pickup_task_id
     FOR UPDATE;
    IF NOT FOUND
       OR v_task.kind <> 'guest_request'
       OR v_task.subject_type IS DISTINCT FROM 'reservation'
       OR v_task.subject_id IS DISTINCT FROM p_reservation
       OR v_task.department IS DISTINCT FROM 'transport'
       OR v_task.due_at IS DISTINCT FROM v_travel.scheduled_at
       OR v_task.priority <> 3
       OR v_task.payload IS DISTINCT FROM
          pg_catalog.jsonb_build_object('requestType', 'arrival_pickup') THEN
      RAISE EXCEPTION USING ERRCODE = '55000',
        MESSAGE = 'arrival pickup task link is incoherent';
    END IF;

    RETURN QUERY SELECT v_task.id, false, v_task.due_at;
    RETURN;
  END IF;

  IF v_reservation.status NOT IN ('reserved', 'due_in')
     OR NOT v_travel.pickup_requested
     OR v_travel.scheduled_at IS NULL THEN
    RETURN QUERY SELECT NULL::uuid, false, NULL::timestamptz;
    RETURN;
  END IF;

  INSERT INTO public.task (
    tenant_id, property_node, kind, status, subject_type, subject_id,
    assignee_party, department, due_at, priority, payload
  ) VALUES (
    p_tenant, p_property, 'guest_request', 'open', 'reservation', p_reservation,
    NULL, 'transport', v_travel.scheduled_at, 3,
    pg_catalog.jsonb_build_object('requestType', 'arrival_pickup')
  )
  RETURNING * INTO v_task;

  UPDATE public.travel_detail AS travel
     SET pickup_task_id = v_task.id
   WHERE travel.tenant_id = p_tenant
     AND travel.id = v_travel.id
     AND travel.pickup_task_id IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '40001',
      MESSAGE = 'arrival pickup task linkage raced';
  END IF;

  RETURN QUERY SELECT v_task.id, true, v_task.due_at;
END;
$$;

ALTER FUNCTION public.govern_arrival_pickup_task(uuid, uuid, uuid, uuid)
  OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.govern_arrival_pickup_task(uuid, uuid, uuid, uuid)
  FROM PUBLIC, app_role, yellow_runtime;
GRANT EXECUTE ON FUNCTION public.govern_arrival_pickup_task(uuid, uuid, uuid, uuid)
  TO app_role;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.task
  FROM app_role, yellow_runtime;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.travel_detail
  FROM app_role, yellow_runtime;
