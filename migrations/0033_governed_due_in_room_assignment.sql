-- Order 231: establish the exact due-in segment assignment parent through one
-- bounded owner-mediated capability. Occupancy remains owned exclusively by
-- record_occupancy(), which the application calls after this capability in the
-- same transaction.

CREATE FUNCTION public.assign_due_in_room(
  p_tenant uuid,
  p_property uuid,
  p_reservation uuid,
  p_segment uuid,
  p_expected_unit_type uuid,
  p_expected_period tstzrange,
  p_expected_sellable_unit uuid,
  p_sellable_unit uuid,
  p_actor uuid
) RETURNS TABLE (
  segment_id uuid,
  unit_type_id uuid,
  previous_sellable_unit_id uuid,
  sellable_unit_id uuid,
  space_id uuid,
  period_from timestamptz,
  period_to timestamptz
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
  v_latest_segment uuid;
  v_space uuid;
  v_count integer;
BEGIN
  IF session_user <> 'yellow_runtime'
     OR pg_catalog.current_setting('role', true) IS DISTINCT FROM 'app_role'
     OR current_user <> 'yellow_owner' THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'due-in room assignment requires the governed runtime app role';
  END IF;

  BEGIN
    v_context_tenant := NULLIF(
      pg_catalog.current_setting('app.tenant_id', true), ''
    )::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'due-in room assignment tenant context is invalid';
  END;
  IF v_context_tenant IS NULL OR p_tenant IS NULL
     OR v_context_tenant <> p_tenant THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'due-in room assignment tenant context is invalid';
  END IF;

  IF p_property IS NULL OR p_reservation IS NULL OR p_segment IS NULL
     OR p_expected_unit_type IS NULL OR p_expected_period IS NULL
     OR p_sellable_unit IS NULL OR p_actor IS NULL
     OR p_expected_sellable_unit IS NOT NULL
     OR pg_catalog.isempty(p_expected_period)
     OR pg_catalog.lower_inf(p_expected_period)
     OR pg_catalog.upper_inf(p_expected_period)
     OR pg_catalog.lower(p_expected_period) >= pg_catalog.upper(p_expected_period) THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'due-in room assignment input is invalid';
  END IF;

  PERFORM 1
    FROM public.app_user AS actor
   WHERE actor.tenant_id = p_tenant
     AND actor.id = p_actor
     AND actor.status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'due-in room assignment target is unavailable';
  END IF;

  SELECT reservation.*
    INTO v_reservation
    FROM public.reservation AS reservation
   WHERE reservation.tenant_id = p_tenant
     AND reservation.property_node = p_property
     AND reservation.id = p_reservation
     AND reservation.status = 'due_in'
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Match the service lock order: reservation, every segment in canonical order,
  -- then the shared segment occupancy advisory lock.
  PERFORM 1
    FROM public.reservation_segment AS segment
   WHERE segment.tenant_id = p_tenant
     AND segment.reservation_id = p_reservation
   ORDER BY segment.seq, segment.id
   FOR UPDATE;

  SELECT segment.*
    INTO v_segment
    FROM public.reservation_segment AS segment
   WHERE segment.tenant_id = p_tenant
     AND segment.reservation_id = p_reservation
     AND segment.id = p_segment;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT segment.id
    INTO v_latest_segment
    FROM public.reservation_segment AS segment
   WHERE segment.tenant_id = p_tenant
     AND segment.reservation_id = p_reservation
   ORDER BY segment.seq DESC, segment.id DESC
   LIMIT 1;

  SELECT pg_catalog.count(*)::integer
    INTO v_count
    FROM public.reservation_segment AS segment
   WHERE segment.tenant_id = p_tenant
     AND segment.reservation_id = p_reservation
     AND segment.status = 'booked'
     AND segment.period @> pg_catalog.transaction_timestamp();

  IF v_latest_segment IS DISTINCT FROM v_segment.id
     OR v_segment.status <> 'booked'
     OR NOT (v_segment.period @> pg_catalog.transaction_timestamp())
     OR v_count <> 1
     OR v_segment.unit_type_id IS DISTINCT FROM p_expected_unit_type
     OR v_segment.period IS DISTINCT FROM p_expected_period
     OR v_segment.sellable_unit_id IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = '40001',
      MESSAGE = 'due-in room assignment truth changed concurrently';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_segment::text, 85)
  );
  PERFORM 1
    FROM public.space_occupancy AS occupancy
   WHERE occupancy.tenant_id = p_tenant
     AND occupancy.slot_kind = 'segment'
     AND occupancy.slot_ref = p_segment;
  IF FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '40001',
      MESSAGE = 'due-in room assignment occupancy already exists';
  END IF;

  SELECT pg_catalog.count(*)::integer,
         (pg_catalog.array_agg(mapping.space_id ORDER BY mapping.space_id))[1]
    INTO v_count, v_space
    FROM public.sellable_unit AS sellable
    JOIN public.unit_type AS unit_type
      ON unit_type.tenant_id = sellable.tenant_id
     AND unit_type.id = sellable.unit_type_id
    JOIN public.sellable_unit_space AS mapping
      ON mapping.tenant_id = sellable.tenant_id
     AND mapping.sellable_unit_id = sellable.id
    JOIN public.space AS room
      ON room.tenant_id = mapping.tenant_id
     AND room.id = mapping.space_id
   WHERE sellable.tenant_id = p_tenant
     AND sellable.id = p_sellable_unit
     AND sellable.status = 'active'
     AND sellable.unit_type_id = p_expected_unit_type
     AND unit_type.property_node = p_property
     AND mapping.claim_mode = 'exclusive'
     AND room.property_node = p_property
     AND room.status = 'active';
  IF v_count <> 1 OR v_space IS NULL THEN
    RETURN;
  END IF;

  -- Count every stored mapping, not only the eligible join above, so a composite
  -- or positional sellable can never be narrowed accidentally into one room.
  SELECT pg_catalog.count(*)::integer
    INTO v_count
    FROM public.sellable_unit_space AS mapping
   WHERE mapping.tenant_id = p_tenant
     AND mapping.sellable_unit_id = p_sellable_unit;
  IF v_count <> 1 THEN
    RETURN;
  END IF;

  PERFORM 1
    FROM public.sellable_unit AS sellable
    JOIN public.unit_type AS unit_type
      ON unit_type.tenant_id = sellable.tenant_id
     AND unit_type.id = sellable.unit_type_id
    JOIN public.sellable_unit_space AS mapping
      ON mapping.tenant_id = sellable.tenant_id
     AND mapping.sellable_unit_id = sellable.id
    JOIN public.space AS room
      ON room.tenant_id = mapping.tenant_id
     AND room.id = mapping.space_id
   WHERE sellable.tenant_id = p_tenant
     AND sellable.id = p_sellable_unit
     AND room.id = v_space
   FOR UPDATE OF sellable, unit_type, mapping, room;

  UPDATE public.reservation_segment AS segment
     SET sellable_unit_id = p_sellable_unit
   WHERE segment.tenant_id = p_tenant
     AND segment.reservation_id = p_reservation
     AND segment.id = p_segment
     AND segment.status = 'booked'
     AND segment.unit_type_id = p_expected_unit_type
     AND segment.period = p_expected_period
     AND segment.sellable_unit_id IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '40001',
      MESSAGE = 'due-in room assignment truth changed concurrently';
  END IF;

  RETURN QUERY SELECT v_segment.id, v_segment.unit_type_id, NULL::uuid,
                      p_sellable_unit, v_space,
                      pg_catalog.lower(v_segment.period),
                      pg_catalog.upper(v_segment.period);
END;
$$;

ALTER FUNCTION public.assign_due_in_room(
  uuid, uuid, uuid, uuid, uuid, tstzrange, uuid, uuid, uuid
) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.assign_due_in_room(
  uuid, uuid, uuid, uuid, uuid, tstzrange, uuid, uuid, uuid
) FROM PUBLIC, app_role, yellow_runtime;
GRANT EXECUTE ON FUNCTION public.assign_due_in_room(
  uuid, uuid, uuid, uuid, uuid, tstzrange, uuid, uuid, uuid
) TO app_role;
