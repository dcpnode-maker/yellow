-- Order 228: dispatch only the exact canonical arrival-pickup task through its
-- adjacent assignment/work lifecycle. Generic task mutation remains denied.

CREATE FUNCTION public.transition_arrival_pickup_task(
  p_tenant uuid,
  p_property uuid,
  p_reservation uuid,
  p_task uuid,
  p_action text,
  p_expected_task_status text,
  p_expected_assignee_party uuid,
  p_staff_party uuid,
  p_actor uuid
) RETURNS TABLE (
  task_id uuid,
  reservation_id uuid,
  previous_task_status text,
  task_status text,
  previous_assignee_party uuid,
  assignee_party uuid,
  task_completed_at timestamptz
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_context_tenant uuid;
  v_travel public.travel_detail%ROWTYPE;
  v_task public.task%ROWTYPE;
  v_new_status text;
  v_new_assignee uuid;
  v_now timestamptz := pg_catalog.transaction_timestamp();
BEGIN
  IF session_user <> 'yellow_runtime'
     OR pg_catalog.current_setting('role', true) IS DISTINCT FROM 'app_role'
     OR current_user <> 'yellow_owner' THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'arrival pickup task transition requires the governed runtime app role';
  END IF;

  BEGIN
    v_context_tenant := NULLIF(
      pg_catalog.current_setting('app.tenant_id', true), ''
    )::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'arrival pickup task transition tenant context is invalid';
  END;
  IF v_context_tenant IS NULL OR p_tenant IS NULL OR v_context_tenant <> p_tenant THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'arrival pickup task transition tenant context is invalid';
  END IF;

  IF p_property IS NULL OR p_reservation IS NULL OR p_task IS NULL OR p_actor IS NULL
     OR p_action NOT IN ('assign', 'start', 'complete')
     OR p_expected_task_status NOT IN ('open', 'assigned', 'in_progress')
     OR (p_action = 'assign' AND (
       p_expected_task_status <> 'open'
       OR p_expected_assignee_party IS NOT NULL
       OR p_staff_party IS NULL
     ))
     OR (p_action = 'start' AND (
       p_expected_task_status <> 'assigned'
       OR p_expected_assignee_party IS NULL
       OR p_staff_party IS NOT NULL
     ))
     OR (p_action = 'complete' AND (
       p_expected_task_status <> 'in_progress'
       OR p_expected_assignee_party IS NULL
       OR p_staff_party IS NOT NULL
     )) THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'arrival pickup task transition input is invalid';
  END IF;

  PERFORM 1
    FROM public.app_user AS actor
   WHERE actor.tenant_id = p_tenant
     AND actor.id = p_actor
     AND actor.status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'arrival pickup task transition target is unavailable';
  END IF;

  PERFORM 1
    FROM public.org_node AS property
   WHERE property.tenant_id = p_tenant
     AND property.id = p_property
     AND property.kind = 'property';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'arrival pickup task transition target is unavailable';
  END IF;

  PERFORM 1
    FROM public.reservation AS reservation
   WHERE reservation.tenant_id = p_tenant
     AND reservation.property_node = p_property
     AND reservation.id = p_reservation
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'arrival pickup task transition target is unavailable';
  END IF;

  SELECT travel.*
    INTO v_travel
    FROM public.travel_detail AS travel
   WHERE travel.tenant_id = p_tenant
     AND travel.reservation_id = p_reservation
     AND travel.direction = 'arrival'
   FOR UPDATE;
  IF NOT FOUND OR v_travel.pickup_task_id IS DISTINCT FROM p_task
     OR NOT v_travel.pickup_requested OR v_travel.scheduled_at IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'arrival pickup task transition target is unavailable';
  END IF;

  SELECT task.*
    INTO v_task
    FROM public.task AS task
   WHERE task.tenant_id = p_tenant
     AND task.property_node = p_property
     AND task.id = p_task
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
      MESSAGE = 'arrival pickup task transition target is unavailable';
  END IF;

  IF v_task.status <> p_expected_task_status
     OR v_task.assignee_party IS DISTINCT FROM p_expected_assignee_party THEN
    RAISE EXCEPTION USING ERRCODE = '40001',
      MESSAGE = 'arrival pickup task transition evidence is stale';
  END IF;

  CASE p_action
    WHEN 'assign' THEN
      IF v_task.status <> 'open' OR v_task.assignee_party IS NOT NULL
         OR v_task.completed_at IS NOT NULL THEN
        RAISE EXCEPTION USING ERRCODE = '55000',
          MESSAGE = 'arrival pickup task transition is not allowed';
      END IF;
      PERFORM 1
        FROM public.party AS staff_party
        JOIN public.party_role AS staff_role
          ON staff_role.tenant_id = staff_party.tenant_id
         AND staff_role.party_id = staff_party.id
         AND staff_role.role = 'staff'
       WHERE staff_party.tenant_id = p_tenant
         AND staff_party.id = p_staff_party
         AND staff_party.status = 'active';
      IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = '55000',
          MESSAGE = 'arrival pickup task transition assignee is unavailable';
      END IF;
      v_new_status := 'assigned';
      v_new_assignee := p_staff_party;
    WHEN 'start' THEN
      IF v_task.status <> 'assigned' OR v_task.assignee_party IS NULL
         OR v_task.completed_at IS NOT NULL THEN
        RAISE EXCEPTION USING ERRCODE = '55000',
          MESSAGE = 'arrival pickup task transition is not allowed';
      END IF;
      v_new_status := 'in_progress';
      v_new_assignee := v_task.assignee_party;
    WHEN 'complete' THEN
      IF v_task.status <> 'in_progress' OR v_task.assignee_party IS NULL
         OR v_task.completed_at IS NOT NULL THEN
        RAISE EXCEPTION USING ERRCODE = '55000',
          MESSAGE = 'arrival pickup task transition is not allowed';
      END IF;
      v_new_status := 'done';
      v_new_assignee := v_task.assignee_party;
    ELSE
      RAISE EXCEPTION USING ERRCODE = '22023',
        MESSAGE = 'arrival pickup task transition input is invalid';
  END CASE;

  UPDATE public.task AS task
     SET status = v_new_status,
         assignee_party = v_new_assignee,
         completed_at = CASE WHEN p_action = 'complete' THEN v_now ELSE NULL END
   WHERE task.tenant_id = p_tenant
     AND task.id = p_task;

  RETURN QUERY
  SELECT task.id, p_reservation, v_task.status, task.status,
         v_task.assignee_party, task.assignee_party, task.completed_at
    FROM public.task AS task
   WHERE task.tenant_id = p_tenant
     AND task.id = p_task;
END;
$$;

ALTER FUNCTION public.transition_arrival_pickup_task(
  uuid, uuid, uuid, uuid, text, text, uuid, uuid, uuid
) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.transition_arrival_pickup_task(
  uuid, uuid, uuid, uuid, text, text, uuid, uuid, uuid
) FROM PUBLIC, app_role, yellow_runtime;
GRANT EXECUTE ON FUNCTION public.transition_arrival_pickup_task(
  uuid, uuid, uuid, uuid, text, text, uuid, uuid, uuid
) TO app_role;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.task
  FROM app_role, yellow_runtime;
