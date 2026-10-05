-- Order 236: create-only vehicle parking assignment. Parking remains an ordinary
-- capacity-one space and record_occupancy() remains the only claim write path.
--
-- The established six-argument choke point intentionally accepts only room/unit
-- segment claims whose period equals the complete segment. Parking starts when the
-- vehicle is assigned, so a private seven-argument overload adds the vehicle parent
-- needed to validate that narrower, server-derived period without weakening the
-- public room-occupancy contract.

CREATE FUNCTION public.record_occupancy(
  p_tenant uuid,
  p_space uuid,
  p_period tstzrange,
  p_slot uuid,
  p_slot_kind text,
  p_exclusive boolean,
  p_vehicle uuid
) RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_authority text := NULLIF(
    pg_catalog.current_setting('app.tenant_id', true), ''
  );
  v_invoker_role text := pg_catalog.current_setting('role', true);
  v_tenant uuid;
  v_id uuid;
  v_parent_valid boolean := false;
BEGIN
  IF v_authority IS NULL THEN
    IF session_user IN ('app_role', 'yellow_runtime')
       OR v_invoker_role = 'app_role' THEN
      RAISE EXCEPTION 'tenant authority missing' USING ERRCODE = '42501';
    END IF;
    v_tenant := p_tenant;
  ELSE
    BEGIN
      v_tenant := v_authority::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'tenant authority invalid' USING ERRCODE = '42501';
    END;
    IF p_tenant IS DISTINCT FROM v_tenant THEN
      RAISE EXCEPTION 'tenant authority mismatch' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF p_period IS NULL OR pg_catalog.isempty(p_period)
     OR pg_catalog.lower_inf(p_period) OR pg_catalog.upper_inf(p_period)
     OR pg_catalog.lower(p_period) >= pg_catalog.upper(p_period) THEN
    RAISE EXCEPTION 'occupancy period must be finite and nonempty'
      USING ERRCODE = '22023';
  END IF;
  IF p_slot_kind IS DISTINCT FROM 'segment' OR p_exclusive IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'vehicle parking requires an exclusive segment claim'
      USING ERRCODE = '22023';
  END IF;

  SELECT true
    INTO v_parent_valid
    FROM public.reservation_segment AS segment
    JOIN public.reservation AS reservation
      ON reservation.tenant_id = segment.tenant_id
     AND reservation.id = segment.reservation_id
     AND reservation.status IN ('in_house', 'due_out')
    JOIN public.vehicle AS vehicle
      ON vehicle.tenant_id = reservation.tenant_id
     AND vehicle.property_node = reservation.property_node
     AND vehicle.reservation_id = reservation.id
     AND vehicle.id = p_vehicle
     AND vehicle.entered_at IS NOT NULL
     AND vehicle.exited_at IS NULL
     AND vehicle.parking_space IS NULL
    JOIN public.space AS parking
      ON parking.tenant_id = reservation.tenant_id
     AND parking.property_node = reservation.property_node
     AND parking.id = p_space
     AND parking.profile_key = 'parking'
     AND parking.capacity = 1
     AND parking.status = 'active'
   WHERE segment.tenant_id = v_tenant
     AND segment.id = p_slot
     AND segment.status = 'in_house'
     AND segment.period @> pg_catalog.transaction_timestamp()
     AND NOT pg_catalog.upper_inf(segment.period)
     AND p_period = pg_catalog.tstzrange(
       pg_catalog.transaction_timestamp(),
       pg_catalog.upper(segment.period),
       '[)'
     );
  IF v_parent_valid IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'vehicle parking occupancy parent is invalid or stale'
      USING ERRCODE = 'P0003';
  END IF;

  INSERT INTO public.space_occupancy
    (tenant_id, space_id, period, slot_ref, slot_kind, exclusive, claim)
  VALUES
    (v_tenant, p_space, p_period, p_slot, 'segment', true,
     pg_catalog.int4range(0, NULL))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

ALTER FUNCTION public.record_occupancy(uuid, uuid, tstzrange, uuid, text, boolean, uuid)
  OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.record_occupancy(uuid, uuid, tstzrange, uuid, text, boolean, uuid)
  FROM PUBLIC, app_role, yellow_runtime;

-- Keep the established release contract as the only externally callable delete
-- choke point. Its former implementation becomes an owner-only typed-parent helper;
-- the wrapper validates and releases parking claims first, clears their vehicle
-- bindings, then delegates any room/unit claims for the same segment.
ALTER FUNCTION public.release_occupancy(uuid, uuid)
  RENAME TO release_occupancy_typed_parent;
ALTER FUNCTION public.release_occupancy_typed_parent(uuid, uuid)
  SECURITY INVOKER;
ALTER FUNCTION public.release_occupancy_typed_parent(uuid, uuid)
  OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.release_occupancy_typed_parent(uuid, uuid)
  FROM PUBLIC, app_role, yellow_runtime;

CREATE FUNCTION public.release_occupancy(p_tenant uuid, p_slot uuid)
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_authority text := NULLIF(
    pg_catalog.current_setting('app.tenant_id', true), ''
  );
  v_invoker_role text := pg_catalog.current_setting('role', true);
  v_tenant uuid;
  v_parent_valid boolean;
  v_parking_ids uuid[] := ARRAY[]::uuid[];
  v_parking_spaces uuid[] := ARRAY[]::uuid[];
  v_parking_count integer := 0;
  v_remaining integer;
  v_room_count integer := 0;
  v_deleted integer;
  v_cleared integer;
  r record;
BEGIN
  IF v_authority IS NULL THEN
    IF session_user = 'app_role' OR v_invoker_role = 'app_role' THEN
      RAISE EXCEPTION 'tenant authority missing' USING ERRCODE = '42501';
    END IF;
    v_tenant := p_tenant;
  ELSE
    BEGIN
      v_tenant := v_authority::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'tenant authority invalid' USING ERRCODE = '42501';
    END;
    IF p_tenant IS DISTINCT FROM v_tenant THEN
      RAISE EXCEPTION 'tenant authority mismatch' USING ERRCODE = '42501';
    END IF;
  END IF;

  FOR r IN
    SELECT occupancy.id, occupancy.space_id, occupancy.period,
           occupancy.slot_ref, occupancy.slot_kind,
           occupancy.exclusive, occupancy.claim
      FROM public.space_occupancy AS occupancy
      JOIN public.space
        ON space.tenant_id = occupancy.tenant_id
       AND space.id = occupancy.space_id
       AND space.profile_key = 'parking'
       AND space.capacity = 1
     WHERE occupancy.tenant_id = v_tenant
       AND occupancy.slot_ref = p_slot
     ORDER BY occupancy.id
     FOR UPDATE OF occupancy
  LOOP
    v_parent_valid := false;
    SELECT true
      INTO v_parent_valid
      FROM public.reservation_segment AS segment
      JOIN public.reservation AS reservation
        ON reservation.tenant_id = segment.tenant_id
       AND reservation.id = segment.reservation_id
      JOIN public.vehicle
        ON vehicle.tenant_id = reservation.tenant_id
       AND vehicle.property_node = reservation.property_node
       AND vehicle.reservation_id = reservation.id
       AND vehicle.parking_space = r.space_id
       AND vehicle.entered_at IS NOT NULL
     WHERE segment.tenant_id = v_tenant
       AND segment.id = r.slot_ref
       AND r.slot_kind = 'segment'
       AND r.exclusive
       AND r.claim = pg_catalog.int4range(0, NULL)
       AND r.period <@ segment.period
       AND pg_catalog.upper(r.period) = pg_catalog.upper(segment.period);
    IF v_parent_valid IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'vehicle parking occupancy parent is invalid or stale'
        USING ERRCODE = 'P0003';
    END IF;
    v_parking_ids := pg_catalog.array_append(v_parking_ids, r.id);
    v_parking_spaces := pg_catalog.array_append(v_parking_spaces, r.space_id);
    v_parking_count := v_parking_count + 1;
  END LOOP;

  IF v_parking_count > 0 THEN
    DELETE FROM public.space_occupancy
     WHERE tenant_id = v_tenant
       AND id = ANY(v_parking_ids);
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    IF v_deleted <> v_parking_count THEN
      RAISE EXCEPTION 'validated parking occupancy changed concurrently'
        USING ERRCODE = '40001';
    END IF;

    UPDATE public.vehicle AS vehicle
       SET parking_space = NULL
      FROM public.reservation_segment AS segment
     WHERE segment.tenant_id = v_tenant
       AND segment.id = p_slot
       AND vehicle.tenant_id = segment.tenant_id
       AND vehicle.reservation_id = segment.reservation_id
       AND vehicle.parking_space = ANY(v_parking_spaces);
    GET DIAGNOSTICS v_cleared = ROW_COUNT;
    IF v_cleared <> v_parking_count THEN
      RAISE EXCEPTION 'vehicle parking binding changed concurrently'
        USING ERRCODE = '40001';
    END IF;
  END IF;

  SELECT count(*)::integer
    INTO v_remaining
    FROM public.space_occupancy
   WHERE tenant_id = v_tenant
     AND slot_ref = p_slot;
  IF v_remaining > 0 THEN
    v_room_count := public.release_occupancy_typed_parent(v_tenant, p_slot);
  ELSIF v_parking_count = 0 THEN
    RAISE EXCEPTION 'occupancy slot is unknown or foreign'
      USING ERRCODE = 'P0003';
  END IF;
  RETURN v_parking_count + v_room_count;
END;
$$;

ALTER FUNCTION public.release_occupancy(uuid, uuid)
  OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.release_occupancy(uuid, uuid)
  FROM PUBLIC, yellow_runtime;
GRANT EXECUTE ON FUNCTION public.release_occupancy(uuid, uuid)
  TO app_role;

CREATE FUNCTION public.assign_vehicle_parking(
  p_tenant uuid,
  p_property uuid,
  p_vehicle uuid,
  p_parking_space uuid,
  p_actor uuid
) RETURNS TABLE (
  vehicle_id uuid,
  vehicle_registration text,
  parking_space_id uuid,
  parking_code text,
  parking_floor text,
  reservation_segment_id uuid,
  occupancy_id uuid,
  occupancy_from timestamptz,
  occupancy_to timestamptz,
  occupancy_period text,
  occupancy_claim text,
  created boolean
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_context_tenant uuid;
  v_vehicle public.vehicle%ROWTYPE;
  v_reservation public.reservation%ROWTYPE;
  v_segment public.reservation_segment%ROWTYPE;
  v_space public.space%ROWTYPE;
  v_occupancy public.space_occupancy%ROWTYPE;
  v_occupancy_id uuid;
  v_now timestamptz := pg_catalog.transaction_timestamp();
  v_period tstzrange;
  v_count integer;
BEGIN
  IF session_user <> 'yellow_runtime'
     OR pg_catalog.current_setting('role', true) IS DISTINCT FROM 'app_role'
     OR current_user <> 'yellow_owner' THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'vehicle parking assignment requires the governed runtime app role';
  END IF;

  BEGIN
    v_context_tenant := NULLIF(
      pg_catalog.current_setting('app.tenant_id', true), ''
    )::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'vehicle parking assignment tenant context is invalid';
  END;
  IF v_context_tenant IS NULL OR p_tenant IS NULL
     OR v_context_tenant <> p_tenant THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'vehicle parking assignment tenant context is invalid';
  END IF;
  IF p_property IS NULL OR p_vehicle IS NULL OR p_parking_space IS NULL
     OR p_actor IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'vehicle parking assignment input is invalid';
  END IF;

  PERFORM 1
    FROM public.app_user AS actor
   WHERE actor.tenant_id = p_tenant
     AND actor.id = p_actor
     AND actor.status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'vehicle parking assignment target is unavailable';
  END IF;
  PERFORM 1
    FROM public.org_node AS property
   WHERE property.tenant_id = p_tenant
     AND property.id = p_property
     AND property.kind = 'property';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'vehicle parking assignment target is unavailable';
  END IF;

  -- Same vehicle serializes first; contenders for one slot then serialize on the
  -- selected physical space. The exclusion constraint remains collision truth.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'vehicle-parking:' || p_tenant::text || ':' || p_vehicle::text,
      236
    )
  );
  SELECT vehicle.*
    INTO v_vehicle
    FROM public.vehicle AS vehicle
   WHERE vehicle.tenant_id = p_tenant
     AND vehicle.property_node = p_property
     AND vehicle.id = p_vehicle
   FOR UPDATE;
  IF NOT FOUND OR v_vehicle.entered_at IS NULL OR v_vehicle.exited_at IS NOT NULL
     OR v_vehicle.reservation_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'vehicle parking assignment target is unavailable';
  END IF;

  SELECT reservation.*
    INTO v_reservation
    FROM public.reservation AS reservation
   WHERE reservation.tenant_id = p_tenant
     AND reservation.property_node = p_property
     AND reservation.id = v_vehicle.reservation_id
   FOR UPDATE;
  IF NOT FOUND OR v_reservation.status NOT IN ('in_house', 'due_out') THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'vehicle parking assignment stay is unavailable';
  END IF;

  PERFORM 1
    FROM public.reservation_segment AS segment
   WHERE segment.tenant_id = p_tenant
     AND segment.reservation_id = v_reservation.id
     AND segment.period @> v_now
   ORDER BY segment.seq, segment.id
   FOR UPDATE;
  SELECT pg_catalog.count(*)::integer
    INTO v_count
    FROM public.reservation_segment AS segment
   WHERE segment.tenant_id = p_tenant
     AND segment.reservation_id = v_reservation.id
     AND segment.period @> v_now;
  IF v_count <> 1 THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'vehicle parking assignment stay is incoherent';
  END IF;
  SELECT segment.*
    INTO v_segment
    FROM public.reservation_segment AS segment
   WHERE segment.tenant_id = p_tenant
     AND segment.reservation_id = v_reservation.id
     AND segment.period @> v_now;
  IF NOT FOUND OR v_segment.status <> 'in_house'
     OR pg_catalog.upper_inf(v_segment.period)
     OR pg_catalog.upper(v_segment.period) <= v_now THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'vehicle parking assignment stay is unavailable';
  END IF;
  v_period := pg_catalog.tstzrange(v_now, pg_catalog.upper(v_segment.period), '[)');

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'parking-space:' || p_tenant::text || ':' || p_parking_space::text,
      236
    )
  );
  SELECT space.*
    INTO v_space
    FROM public.space AS space
   WHERE space.tenant_id = p_tenant
     AND space.property_node = p_property
     AND space.id = p_parking_space
     AND space.status = 'active'
     AND space.profile_key = 'parking'
     AND space.capacity = 1
   FOR UPDATE;
  IF NOT FOUND OR EXISTS (
    SELECT 1
      FROM public.sellable_unit_space AS mapping
     WHERE mapping.tenant_id = p_tenant
       AND mapping.space_id = p_parking_space
       AND mapping.claim_mode = 'positional'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'vehicle parking assignment space is unavailable';
  END IF;

  PERFORM 1
    FROM public.space_occupancy AS occupancy
   WHERE occupancy.tenant_id = p_tenant
     AND occupancy.space_id = p_parking_space
     AND occupancy.period && v_period
   ORDER BY occupancy.id
   FOR UPDATE;

  IF v_vehicle.parking_space IS NOT NULL THEN
    IF v_vehicle.parking_space <> p_parking_space THEN
      RAISE EXCEPTION USING ERRCODE = '40001',
        MESSAGE = 'vehicle already has a different parking assignment';
    END IF;
    SELECT occupancy.*
      INTO v_occupancy
      FROM public.space_occupancy AS occupancy
     WHERE occupancy.tenant_id = p_tenant
       AND occupancy.space_id = p_parking_space
       AND occupancy.slot_ref = v_segment.id
       AND occupancy.slot_kind = 'segment'
       AND occupancy.exclusive
       AND occupancy.claim = pg_catalog.int4range(0, NULL)
       AND occupancy.period @> v_now
       AND pg_catalog.upper(occupancy.period) = pg_catalog.upper(v_segment.period);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count <> 1 THEN
      RAISE EXCEPTION USING ERRCODE = '55000',
        MESSAGE = 'vehicle parking assignment evidence is incoherent';
    END IF;
    RETURN QUERY SELECT v_vehicle.id, v_vehicle.reg_no, v_space.id, v_space.code,
                        v_space.floor, v_segment.id, v_occupancy.id,
                        pg_catalog.lower(v_occupancy.period),
                        pg_catalog.upper(v_occupancy.period),
                        v_occupancy.period::text, v_occupancy.claim::text, false;
    RETURN;
  END IF;

  v_occupancy_id := public.record_occupancy(
    p_tenant, p_parking_space, v_period, v_segment.id, 'segment', true, p_vehicle
  );
  SELECT occupancy.*
    INTO v_occupancy
    FROM public.space_occupancy AS occupancy
   WHERE occupancy.tenant_id = p_tenant
     AND occupancy.id = v_occupancy_id
     AND occupancy.space_id = p_parking_space
     AND occupancy.slot_ref = v_segment.id
     AND occupancy.slot_kind = 'segment'
     AND occupancy.exclusive
     AND occupancy.claim = pg_catalog.int4range(0, NULL)
     AND occupancy.period = v_period;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'vehicle parking assignment evidence is incoherent';
  END IF;

  UPDATE public.vehicle AS vehicle
     SET parking_space = p_parking_space
   WHERE vehicle.tenant_id = p_tenant
     AND vehicle.property_node = p_property
     AND vehicle.id = p_vehicle
     AND vehicle.parking_space IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> 1 THEN
    RAISE EXCEPTION USING ERRCODE = '40001',
      MESSAGE = 'vehicle parking assignment changed concurrently';
  END IF;

  RETURN QUERY SELECT v_vehicle.id, v_vehicle.reg_no, v_space.id, v_space.code,
                      v_space.floor, v_segment.id, v_occupancy.id,
                      pg_catalog.lower(v_occupancy.period),
                      pg_catalog.upper(v_occupancy.period),
                      v_occupancy.period::text, v_occupancy.claim::text, true;
END;
$$;

ALTER FUNCTION public.assign_vehicle_parking(uuid, uuid, uuid, uuid, uuid)
  OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.assign_vehicle_parking(uuid, uuid, uuid, uuid, uuid)
  FROM PUBLIC, app_role, yellow_runtime;
GRANT EXECUTE ON FUNCTION public.assign_vehicle_parking(uuid, uuid, uuid, uuid, uuid)
  TO app_role;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.vehicle FROM app_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.vehicle FROM yellow_runtime;
