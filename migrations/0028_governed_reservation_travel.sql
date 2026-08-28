-- Order 212: one exact compare-and-set command records arrival/departure travel
-- intent. Pickup-task automation and raw runtime travel mutation remain absent.

CREATE FUNCTION public.put_reservation_travel(
  p_tenant uuid,
  p_property uuid,
  p_reservation uuid,
  p_direction text,
  p_expected_present boolean,
  p_expected_mode text,
  p_expected_carrier text,
  p_expected_service_no text,
  p_expected_scheduled_at timestamptz,
  p_expected_pickup_requested boolean,
  p_desired_mode text,
  p_desired_carrier text,
  p_desired_service_no text,
  p_desired_scheduled_at timestamptz,
  p_desired_pickup_requested boolean,
  p_actor uuid
) RETURNS TABLE (
  travel_id uuid,
  reservation_status text,
  previous_mode text,
  previous_carrier text,
  previous_service_no text,
  previous_scheduled_at timestamptz,
  previous_pickup_requested boolean,
  current_mode text,
  current_carrier text,
  current_service_no text,
  current_scheduled_at timestamptz,
  current_pickup_requested boolean,
  changed boolean
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
  v_exists boolean := false;
  v_changed boolean;
BEGIN
  IF session_user <> 'yellow_runtime'
     OR pg_catalog.current_setting('role', true) IS DISTINCT FROM 'app_role'
     OR current_user <> 'yellow_owner' THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'reservation travel capture requires the governed runtime app role';
  END IF;

  BEGIN
    v_context_tenant := NULLIF(
      pg_catalog.current_setting('app.tenant_id', true), ''
    )::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'reservation travel capture tenant context is invalid';
  END;
  IF v_context_tenant IS NULL OR p_tenant IS NULL
     OR v_context_tenant <> p_tenant THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'reservation travel capture tenant context is invalid';
  END IF;

  IF p_property IS NULL OR p_reservation IS NULL OR p_actor IS NULL
     OR p_direction NOT IN ('arrival', 'departure')
     OR p_expected_present IS NULL
     OR p_desired_pickup_requested IS NULL
     OR p_desired_mode IS NOT NULL AND p_desired_mode NOT IN
       ('flight', 'train', 'bus', 'car', 'ferry', 'other')
     OR p_expected_mode IS NOT NULL AND p_expected_mode NOT IN
       ('flight', 'train', 'bus', 'car', 'ferry', 'other')
     OR p_desired_carrier IS NOT NULL AND (
       p_desired_carrier <> pg_catalog.btrim(p_desired_carrier)
       OR p_desired_carrier = '' OR pg_catalog.char_length(p_desired_carrier) > 120
     )
     OR p_expected_carrier IS NOT NULL AND (
       p_expected_carrier <> pg_catalog.btrim(p_expected_carrier)
       OR p_expected_carrier = '' OR pg_catalog.char_length(p_expected_carrier) > 120
     )
     OR p_desired_service_no IS NOT NULL AND (
       p_desired_service_no <> pg_catalog.btrim(p_desired_service_no)
       OR p_desired_service_no = '' OR pg_catalog.char_length(p_desired_service_no) > 64
     )
     OR p_expected_service_no IS NOT NULL AND (
       p_expected_service_no <> pg_catalog.btrim(p_expected_service_no)
       OR p_expected_service_no = '' OR pg_catalog.char_length(p_expected_service_no) > 64
     )
     OR p_expected_present AND p_expected_pickup_requested IS NULL
     OR p_direction = 'departure' AND p_desired_pickup_requested
     OR p_direction = 'departure' AND p_expected_present
       AND p_expected_pickup_requested
     OR (
       p_desired_mode IS NULL AND p_desired_carrier IS NULL
       AND p_desired_service_no IS NULL AND p_desired_scheduled_at IS NULL
       AND NOT p_desired_pickup_requested
     ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'reservation travel capture input is invalid';
  END IF;

  PERFORM 1
    FROM public.app_user AS actor
   WHERE actor.tenant_id = p_tenant
     AND actor.id = p_actor
     AND actor.status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'reservation travel capture target is unavailable';
  END IF;

  PERFORM 1
    FROM public.org_node AS property
   WHERE property.tenant_id = p_tenant
     AND property.id = p_property
     AND property.kind = 'property';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'reservation travel capture target is unavailable';
  END IF;

  SELECT reservation.*
    INTO v_reservation
    FROM public.reservation AS reservation
   WHERE reservation.tenant_id = p_tenant
     AND reservation.property_node = p_property
     AND reservation.id = p_reservation
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'reservation travel capture target is unavailable';
  END IF;
  IF v_reservation.status NOT IN ('reserved', 'due_in', 'in_house', 'due_out') THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'reservation travel capture is not allowed';
  END IF;

  SELECT travel.*
    INTO v_travel
    FROM public.travel_detail AS travel
   WHERE travel.tenant_id = p_tenant
     AND travel.reservation_id = p_reservation
     AND travel.direction = p_direction
   FOR UPDATE;
  v_exists := FOUND;

  IF v_exists AND v_travel.pickup_task_id IS NOT NULL THEN
    PERFORM 1
      FROM public.task AS task
     WHERE task.tenant_id = p_tenant
       AND task.property_node = p_property
       AND task.id = v_travel.pickup_task_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = '55000',
        MESSAGE = 'reservation travel capture task link is incoherent';
    END IF;
  END IF;

  IF p_expected_present <> v_exists THEN
    RAISE EXCEPTION USING ERRCODE = '40001',
      MESSAGE = 'reservation travel capture evidence is stale';
  END IF;
  IF p_expected_present AND (
    v_travel.mode IS DISTINCT FROM p_expected_mode
    OR v_travel.carrier IS DISTINCT FROM p_expected_carrier
    OR v_travel.service_no IS DISTINCT FROM p_expected_service_no
    OR v_travel.scheduled_at IS DISTINCT FROM p_expected_scheduled_at
    OR v_travel.pickup_requested IS DISTINCT FROM p_expected_pickup_requested
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '40001',
      MESSAGE = 'reservation travel capture evidence is stale';
  END IF;

  v_changed := NOT v_exists OR (
    v_travel.mode IS DISTINCT FROM p_desired_mode
    OR v_travel.carrier IS DISTINCT FROM p_desired_carrier
    OR v_travel.service_no IS DISTINCT FROM p_desired_service_no
    OR v_travel.scheduled_at IS DISTINCT FROM p_desired_scheduled_at
    OR v_travel.pickup_requested IS DISTINCT FROM p_desired_pickup_requested
  );
  IF v_changed AND v_exists AND v_travel.pickup_task_id IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'reservation travel capture cannot change linked pickup work';
  END IF;

  IF NOT v_exists THEN
    INSERT INTO public.travel_detail (
      tenant_id, reservation_id, direction, mode, carrier, service_no,
      scheduled_at, pickup_requested
    ) VALUES (
      p_tenant, p_reservation, p_direction, p_desired_mode, p_desired_carrier,
      p_desired_service_no, p_desired_scheduled_at, p_desired_pickup_requested
    )
    RETURNING * INTO v_travel;
  ELSIF v_changed THEN
    UPDATE public.travel_detail AS travel
       SET mode = p_desired_mode,
           carrier = p_desired_carrier,
           service_no = p_desired_service_no,
           scheduled_at = p_desired_scheduled_at,
           pickup_requested = p_desired_pickup_requested
     WHERE travel.tenant_id = p_tenant
       AND travel.id = v_travel.id
    RETURNING travel.* INTO v_travel;
  END IF;

  RETURN QUERY
  SELECT v_travel.id, v_reservation.status,
         CASE WHEN p_expected_present THEN p_expected_mode ELSE NULL END,
         CASE WHEN p_expected_present THEN p_expected_carrier ELSE NULL END,
         CASE WHEN p_expected_present THEN p_expected_service_no ELSE NULL END,
         CASE WHEN p_expected_present THEN p_expected_scheduled_at ELSE NULL END,
         CASE WHEN p_expected_present THEN p_expected_pickup_requested ELSE NULL END,
         v_travel.mode, v_travel.carrier, v_travel.service_no,
         v_travel.scheduled_at, v_travel.pickup_requested, v_changed;
END;
$$;

ALTER FUNCTION public.put_reservation_travel(
  uuid, uuid, uuid, text, boolean, text, text, text, timestamptz, boolean,
  text, text, text, timestamptz, boolean, uuid
) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.put_reservation_travel(
  uuid, uuid, uuid, text, boolean, text, text, text, timestamptz, boolean,
  text, text, text, timestamptz, boolean, uuid
) FROM PUBLIC, app_role, yellow_runtime;
GRANT EXECUTE ON FUNCTION public.put_reservation_travel(
  uuid, uuid, uuid, text, boolean, text, text, text, timestamptz, boolean,
  text, text, text, timestamptz, boolean, uuid
) TO app_role;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.travel_detail
  FROM app_role, yellow_runtime;
