-- Order 235: compare one deliberate room observation with canonical current stay
-- and occupancy truth. Only the existing discrepancy primitive may be created.

CREATE UNIQUE INDEX discrepancy_unresolved_space_unique
  ON public.discrepancy (tenant_id, space_id)
  WHERE resolved_at IS NULL;

CREATE FUNCTION public.report_room_discrepancy(
  p_tenant uuid,
  p_property uuid,
  p_space uuid,
  p_observed_presence text,
  p_observed_persons integer,
  p_actor uuid
) RETURNS TABLE (
  discrepancy_id uuid,
  room_id uuid,
  room_code text,
  room_floor text,
  discrepancy_kind text,
  reported_value text,
  system_value text,
  reporter_id uuid,
  discrepancy_reported_at timestamptz,
  created boolean
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_context_tenant uuid;
  v_room public.space%ROWTYPE;
  v_occupancy public.space_occupancy%ROWTYPE;
  v_segment public.reservation_segment%ROWTYPE;
  v_reservation public.reservation%ROWTYPE;
  v_existing public.discrepancy%ROWTYPE;
  v_now timestamptz := pg_catalog.transaction_timestamp();
  v_count integer;
  v_expected_persons integer;
  v_system_presence text := 'vacant';
  v_kind text;
  v_reported text;
  v_system text;
BEGIN
  IF session_user <> 'yellow_runtime'
     OR pg_catalog.current_setting('role', true) IS DISTINCT FROM 'app_role'
     OR current_user <> 'yellow_owner' THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'room discrepancy reporting requires the governed runtime app role';
  END IF;

  BEGIN
    v_context_tenant := NULLIF(
      pg_catalog.current_setting('app.tenant_id', true), ''
    )::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'room discrepancy reporting tenant context is invalid';
  END;
  IF v_context_tenant IS NULL OR p_tenant IS NULL
     OR v_context_tenant <> p_tenant THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'room discrepancy reporting tenant context is invalid';
  END IF;

  IF p_property IS NULL OR p_space IS NULL OR p_actor IS NULL
     OR p_observed_presence NOT IN ('occupied', 'vacant')
     OR (p_observed_presence = 'occupied' AND (
       p_observed_persons IS NULL OR p_observed_persons < 1 OR p_observed_persons > 99
     ))
     OR (p_observed_presence = 'vacant' AND p_observed_persons IS NOT NULL) THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'room discrepancy reporting input is invalid';
  END IF;

  PERFORM 1
    FROM public.app_user AS actor
   WHERE actor.tenant_id = p_tenant
     AND actor.id = p_actor
     AND actor.status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'room discrepancy reporting target is unavailable';
  END IF;

  PERFORM 1
    FROM public.org_node AS property
   WHERE property.tenant_id = p_tenant
     AND property.id = p_property
     AND property.kind = 'property';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'room discrepancy reporting target is unavailable';
  END IF;

  -- Every reporter for one room serializes before inspecting mutable stay truth.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'room-discrepancy:' || p_tenant::text || ':' || p_space::text,
      235
    )
  );

  -- Follow the stay command lock order: parents, segments, then physical room and
  -- occupancy. Booked/due-in claims are locked too, but never imply presence.
  PERFORM 1
    FROM public.reservation AS reservation
    JOIN public.reservation_segment AS segment
      ON segment.tenant_id = reservation.tenant_id
     AND segment.reservation_id = reservation.id
    JOIN public.sellable_unit_space AS mapping
      ON mapping.tenant_id = segment.tenant_id
     AND mapping.sellable_unit_id = segment.sellable_unit_id
     AND mapping.space_id = p_space
   WHERE reservation.tenant_id = p_tenant
     AND reservation.property_node = p_property
     AND segment.period @> v_now
   ORDER BY reservation.id
   FOR UPDATE OF reservation;

  PERFORM 1
    FROM public.reservation_segment AS segment
    JOIN public.reservation AS reservation
      ON reservation.tenant_id = segment.tenant_id
     AND reservation.id = segment.reservation_id
     AND reservation.property_node = p_property
    JOIN public.sellable_unit_space AS mapping
      ON mapping.tenant_id = segment.tenant_id
     AND mapping.sellable_unit_id = segment.sellable_unit_id
     AND mapping.space_id = p_space
   WHERE segment.tenant_id = p_tenant
     AND segment.period @> v_now
   ORDER BY segment.reservation_id, segment.seq, segment.id
   FOR UPDATE OF segment;

  SELECT room.*
    INTO v_room
    FROM public.space AS room
    JOIN public.unit_condition AS condition
      ON condition.tenant_id = room.tenant_id
     AND condition.space_id = room.id
   WHERE room.tenant_id = p_tenant
     AND room.property_node = p_property
     AND room.id = p_space
     AND room.status = 'active'
   FOR UPDATE OF room, condition;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'room discrepancy reporting target is unavailable';
  END IF;

  -- A condition-bearing space is the canonical physical-room discriminator.
  -- Positional mappings are explicitly outside v1, even when an exclusive sale
  -- configuration also exists for the same space.
  PERFORM 1
    FROM public.sellable_unit_space AS mapping
   WHERE mapping.tenant_id = p_tenant
     AND mapping.space_id = p_space
     AND mapping.claim_mode = 'positional';
  IF FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'room discrepancy reporting target is unavailable';
  END IF;

  PERFORM 1
    FROM public.space_occupancy AS occupancy
   WHERE occupancy.tenant_id = p_tenant
     AND occupancy.space_id = p_space
     AND occupancy.period @> v_now
   ORDER BY occupancy.id
   FOR UPDATE;

  SELECT pg_catalog.count(*)::integer
    INTO v_count
    FROM public.space_occupancy AS occupancy
   WHERE occupancy.tenant_id = p_tenant
     AND occupancy.space_id = p_space
     AND occupancy.period @> v_now;
  IF v_count > 1 THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'room discrepancy reporting evidence is incoherent';
  ELSIF v_count = 1 THEN
    SELECT occupancy.*
      INTO v_occupancy
      FROM public.space_occupancy AS occupancy
     WHERE occupancy.tenant_id = p_tenant
       AND occupancy.space_id = p_space
       AND occupancy.period @> v_now;

    IF NOT v_occupancy.exclusive
       OR v_occupancy.claim IS DISTINCT FROM pg_catalog.int4range(0, NULL) THEN
      RAISE EXCEPTION USING ERRCODE = '55000',
        MESSAGE = 'room discrepancy reporting evidence is incoherent';
    END IF;

    IF v_occupancy.slot_kind = 'segment' THEN
      SELECT segment.*
        INTO v_segment
        FROM public.reservation_segment AS segment
       WHERE segment.tenant_id = p_tenant
         AND segment.id = v_occupancy.slot_ref;
      IF NOT FOUND OR v_segment.period IS DISTINCT FROM v_occupancy.period
         OR NOT (v_segment.period @> v_now)
         OR v_segment.sellable_unit_id IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = '55000',
          MESSAGE = 'room discrepancy reporting evidence is incoherent';
      END IF;

      SELECT reservation.*
        INTO v_reservation
        FROM public.reservation AS reservation
       WHERE reservation.tenant_id = p_tenant
         AND reservation.property_node = p_property
         AND reservation.id = v_segment.reservation_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = '55000',
          MESSAGE = 'room discrepancy reporting evidence is incoherent';
      END IF;

      SELECT pg_catalog.count(*)::integer
        INTO v_count
        FROM public.sellable_unit_space AS mapping
       WHERE mapping.tenant_id = p_tenant
         AND mapping.sellable_unit_id = v_segment.sellable_unit_id;
      IF v_count <> 1 THEN
        RAISE EXCEPTION USING ERRCODE = '55000',
          MESSAGE = 'room discrepancy reporting evidence is incoherent';
      END IF;
      PERFORM 1
        FROM public.sellable_unit AS sellable
        JOIN public.unit_type AS unit_type
          ON unit_type.tenant_id = sellable.tenant_id
         AND unit_type.id = sellable.unit_type_id
        JOIN public.sellable_unit_space AS mapping
          ON mapping.tenant_id = sellable.tenant_id
         AND mapping.sellable_unit_id = sellable.id
         AND mapping.space_id = p_space
         AND mapping.claim_mode = 'exclusive'
       WHERE sellable.tenant_id = p_tenant
         AND sellable.id = v_segment.sellable_unit_id
         AND sellable.status = 'active'
         AND unit_type.property_node = p_property;
      IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = '55000',
          MESSAGE = 'room discrepancy reporting evidence is incoherent';
      END IF;

      IF v_segment.status = 'in_house'
         AND v_reservation.status IN ('in_house', 'due_out') THEN
        SELECT pg_catalog.count(*)::integer
          INTO v_count
          FROM public.reservation_segment AS segment
         WHERE segment.tenant_id = p_tenant
           AND segment.reservation_id = v_segment.reservation_id
           AND segment.status = 'in_house'
           AND segment.period @> v_now;
        IF v_count <> 1 OR EXISTS (
          SELECT 1
            FROM public.reservation_segment AS later
           WHERE later.tenant_id = p_tenant
             AND later.reservation_id = v_segment.reservation_id
             AND later.period @> v_now
             AND (later.seq, later.id) > (v_segment.seq, v_segment.id)
        ) OR pg_catalog.jsonb_typeof(v_segment.children) IS DISTINCT FROM 'array' THEN
          RAISE EXCEPTION USING ERRCODE = '55000',
            MESSAGE = 'room discrepancy reporting evidence is incoherent';
        END IF;
        v_system_presence := 'occupied';
        v_expected_persons := v_segment.adults + pg_catalog.jsonb_array_length(v_segment.children);
        IF v_expected_persons < 1 OR v_expected_persons > 999 THEN
          RAISE EXCEPTION USING ERRCODE = '55000',
            MESSAGE = 'room discrepancy reporting evidence is incoherent';
        END IF;
      ELSIF v_segment.status = 'booked'
            AND v_reservation.status IN ('reserved', 'due_in') THEN
        v_system_presence := 'vacant';
      ELSE
        RAISE EXCEPTION USING ERRCODE = '55000',
          MESSAGE = 'room discrepancy reporting evidence is incoherent';
      END IF;
    ELSIF v_occupancy.slot_kind IN ('hold', 'ooo') THEN
      v_system_presence := 'vacant';
    ELSE
      RAISE EXCEPTION USING ERRCODE = '55000',
        MESSAGE = 'room discrepancy reporting evidence is incoherent';
    END IF;
  ELSE
    -- An in-house or currently booked assigned segment without its exact claim is
    -- stale/incoherent rather than a vacancy observation.
    SELECT pg_catalog.count(*)::integer
      INTO v_count
      FROM public.reservation_segment AS segment
      JOIN public.reservation AS reservation
        ON reservation.tenant_id = segment.tenant_id
       AND reservation.id = segment.reservation_id
       AND reservation.property_node = p_property
      JOIN public.sellable_unit_space AS mapping
        ON mapping.tenant_id = segment.tenant_id
       AND mapping.sellable_unit_id = segment.sellable_unit_id
       AND mapping.space_id = p_space
     WHERE segment.tenant_id = p_tenant
       AND segment.period @> v_now
       AND (
         (segment.status = 'in_house' AND reservation.status IN ('in_house', 'due_out'))
         OR (segment.status = 'booked' AND reservation.status IN ('reserved', 'due_in'))
       );
    IF v_count <> 0 THEN
      RAISE EXCEPTION USING ERRCODE = '55000',
        MESSAGE = 'room discrepancy reporting evidence is incoherent';
    END IF;
  END IF;

  IF p_observed_presence = 'occupied' AND v_system_presence = 'vacant' THEN
    v_kind := 'sleep';
    v_reported := 'occupied';
    v_system := 'vacant';
  ELSIF p_observed_presence = 'vacant' AND v_system_presence = 'occupied' THEN
    v_kind := 'skip';
    v_reported := 'vacant';
    v_system := 'occupied';
  ELSIF p_observed_presence = 'occupied' AND v_system_presence = 'occupied'
        AND p_observed_persons <> v_expected_persons THEN
    v_kind := 'person';
    v_reported := 'persons:' || p_observed_persons::text;
    v_system := 'persons:' || v_expected_persons::text;
  END IF;

  SELECT discrepancy.*
    INTO v_existing
    FROM public.discrepancy AS discrepancy
   WHERE discrepancy.tenant_id = p_tenant
     AND discrepancy.space_id = p_space
     AND discrepancy.resolved_at IS NULL
   FOR UPDATE;
  IF FOUND THEN
    IF v_kind IS NULL
       OR v_existing.reported IS DISTINCT FROM v_reported
       OR v_existing.system_state IS DISTINCT FROM v_system THEN
      RAISE EXCEPTION USING ERRCODE = '40001',
        MESSAGE = 'room discrepancy reporting conflicts with an open discrepancy';
    END IF;
    RETURN QUERY SELECT v_existing.id, v_room.id, v_room.code, v_room.floor,
                        v_kind, v_existing.reported, v_existing.system_state,
                        v_existing.reported_by, v_existing.reported_at, false;
    RETURN;
  END IF;

  IF v_kind IS NULL THEN
    RETURN QUERY SELECT NULL::uuid, v_room.id, v_room.code, v_room.floor,
                        NULL::text, NULL::text, NULL::text, NULL::uuid,
                        NULL::timestamptz, false;
    RETURN;
  END IF;

  INSERT INTO public.discrepancy (
    tenant_id, space_id, reported, system_state, reported_by, reported_at
  ) VALUES (
    p_tenant, p_space, v_reported, v_system, p_actor, v_now
  )
  RETURNING * INTO v_existing;

  RETURN QUERY SELECT v_existing.id, v_room.id, v_room.code, v_room.floor,
                      v_kind, v_existing.reported, v_existing.system_state,
                      v_existing.reported_by, v_existing.reported_at, true;
END;
$$;

ALTER FUNCTION public.report_room_discrepancy(uuid, uuid, uuid, text, integer, uuid)
  OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.report_room_discrepancy(uuid, uuid, uuid, text, integer, uuid)
  FROM PUBLIC, app_role, yellow_runtime;
GRANT EXECUTE ON FUNCTION public.report_room_discrepancy(uuid, uuid, uuid, text, integer, uuid)
  TO app_role;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.discrepancy FROM app_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.discrepancy FROM yellow_runtime;
