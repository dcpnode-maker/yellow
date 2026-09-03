--
-- PostgreSQL database dump
--


-- Dumped from database version 16.15
-- Dumped by pg_dump version 16.15

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- Name: btree_gist; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;


--
-- Name: ltree; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS ltree WITH SCHEMA public;


--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: append_cashier_count(uuid, uuid, uuid, uuid, bigint[], bigint[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.append_cashier_count(p_tenant uuid, p_property uuid, p_session uuid, p_actor uuid, p_denomination_units bigint[], p_quantities bigint[]) RETURNS TABLE(count_id uuid, session_id uuid, attempt_no integer, counted_minor bigint, counted_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'pg_temp'
    AS $$
DECLARE
  v_context_tenant uuid;
  v_business_date date;
  v_drawer_id uuid;
  v_line_count integer;
  v_active_count integer;
  v_attempt_no integer;
  v_total_numeric numeric;
  v_total bigint;
  v_count_id uuid := pg_catalog.gen_random_uuid();
  v_counted_at timestamptz := pg_catalog.transaction_timestamp();
BEGIN
  IF session_user <> 'yellow_runtime'
     OR pg_catalog.current_setting('role', true) IS DISTINCT FROM 'app_role'
     OR current_user <> 'yellow_owner' THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'cashier count requires the governed runtime app role';
  END IF;

  BEGIN
    v_context_tenant := NULLIF(
      pg_catalog.current_setting('app.tenant_id', true), ''
    )::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'cashier count tenant context is invalid';
  END;
  IF v_context_tenant IS NULL OR p_tenant IS NULL
     OR v_context_tenant <> p_tenant THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'cashier count tenant context is invalid';
  END IF;

  v_line_count := pg_catalog.cardinality(p_denomination_units);
  IF p_property IS NULL OR p_session IS NULL OR p_actor IS NULL
     OR v_line_count IS NULL OR v_line_count < 1 OR v_line_count > 50
     OR v_line_count <> pg_catalog.cardinality(p_quantities)
     OR pg_catalog.array_ndims(p_denomination_units) <> 1
     OR pg_catalog.array_ndims(p_quantities) <> 1
     OR pg_catalog.array_lower(p_denomination_units, 1) <> 1
     OR pg_catalog.array_lower(p_quantities, 1) <> 1
     OR EXISTS (
       SELECT 1
       FROM pg_catalog.generate_subscripts(p_denomination_units, 1) AS line(i)
       WHERE p_denomination_units[line.i] IS NULL
          OR p_quantities[line.i] IS NULL
          OR p_denomination_units[line.i] <= 0
          OR p_quantities[line.i] < 0
     )
     OR (
       SELECT pg_catalog.count(DISTINCT p_denomination_units[line.i])
       FROM pg_catalog.generate_subscripts(p_denomination_units, 1) AS line(i)
     ) <> v_line_count THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'cashier count input is invalid';
  END IF;

  SELECT (pg_catalog.transaction_timestamp() AT TIME ZONE property.timezone)::date
    INTO v_business_date
    FROM public.org_node AS property
   WHERE property.tenant_id = p_tenant
     AND property.id = p_property
     AND property.kind = 'property'
     AND property.currency IS NOT NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'cashier property is unavailable';
  END IF;

  SELECT cashier.drawer_id
    INTO v_drawer_id
    FROM public.cashier_session AS cashier
   WHERE cashier.tenant_id = p_tenant
     AND cashier.id = p_session
     AND cashier.property_node = p_property;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'cashier session is unavailable';
  END IF;

  PERFORM 1
    FROM public.business_day AS day
   WHERE day.tenant_id = p_tenant
     AND day.property_node = p_property
     AND day.business_date = v_business_date
     AND day.sealed_at IS NULL
   FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'cashier business day is unavailable';
  END IF;

  PERFORM 1
    FROM public.cash_drawer AS drawer
   WHERE drawer.tenant_id = p_tenant
     AND drawer.id = v_drawer_id
     AND drawer.property_node = p_property
     AND drawer.active
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'cashier drawer is unavailable';
  END IF;

  PERFORM 1
    FROM public.cashier_session AS cashier
   WHERE cashier.tenant_id = p_tenant
     AND cashier.id = p_session
     AND cashier.property_node = p_property
     AND cashier.drawer_id = v_drawer_id
     AND cashier.business_date = v_business_date
     AND cashier.closed_at IS NULL
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'cashier session is unavailable';
  END IF;

  PERFORM 1
    FROM public.app_user AS actor
   WHERE actor.tenant_id = p_tenant
     AND actor.id = p_actor
     AND actor.status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'cashier actor is unavailable';
  END IF;

  SELECT pg_catalog.count(*)::integer
    INTO v_active_count
    FROM public.cash_drawer_denomination AS denomination
   WHERE denomination.tenant_id = p_tenant
     AND denomination.drawer_id = v_drawer_id
     AND denomination.active;
  IF v_active_count <> v_line_count OR EXISTS (
    SELECT 1
      FROM pg_catalog.generate_subscripts(p_denomination_units, 1) AS line(i)
      LEFT JOIN public.cash_drawer_denomination AS denomination
        ON denomination.tenant_id = p_tenant
       AND denomination.drawer_id = v_drawer_id
       AND denomination.unit_minor = p_denomination_units[line.i]
       AND denomination.active
     WHERE denomination.unit_minor IS NULL
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'cashier count denominations are invalid';
  END IF;

  SELECT pg_catalog.sum(
           p_denomination_units[line.i]::numeric
           * p_quantities[line.i]::numeric
         )
    INTO v_total_numeric
    FROM pg_catalog.generate_subscripts(p_denomination_units, 1) AS line(i);
  IF v_total_numeric IS NULL OR v_total_numeric < 0::numeric
     OR v_total_numeric > 9223372036854775807::numeric THEN
    RAISE EXCEPTION USING ERRCODE = '22003',
      MESSAGE = 'cashier count total is outside signed int64';
  END IF;
  v_total := v_total_numeric::bigint;

  SELECT COALESCE(pg_catalog.max(count.attempt_no), 0) + 1
    INTO v_attempt_no
    FROM public.cashier_count AS count
   WHERE count.tenant_id = p_tenant
     AND count.session_id = p_session;

  INSERT INTO public.cashier_count (
    tenant_id, id, session_id, drawer_id, kind, attempt_no,
    counted_by, counted_at, total_minor
  ) VALUES (
    p_tenant, v_count_id, p_session, v_drawer_id, 'closing', v_attempt_no,
    p_actor, v_counted_at, v_total
  );

  INSERT INTO public.cashier_count_line (
    tenant_id, count_id, session_id, drawer_id,
    denomination_minor, quantity, line_total_minor
  )
  SELECT p_tenant, v_count_id, p_session, v_drawer_id,
         p_denomination_units[line.i], p_quantities[line.i],
         (
           p_denomination_units[line.i]::numeric
           * p_quantities[line.i]::numeric
         )::bigint
    FROM pg_catalog.generate_subscripts(p_denomination_units, 1) AS line(i);

  RETURN QUERY SELECT v_count_id, p_session, v_attempt_no, v_total, v_counted_at;
END;
$$;


--
-- Name: assert_day_open(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assert_day_open() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'pg_temp'
    AS $$
DECLARE
  v_sealed timestamptz;
BEGIN
  SELECT sealed_at
    INTO v_sealed
    FROM public.business_day
   WHERE tenant_id = NEW.tenant_id
     AND property_node = NEW.property_node
     AND business_date = NEW.business_date
   FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'business date % missing', NEW.business_date
      USING ERRCODE = 'P0011';
  END IF;
  IF v_sealed IS NOT NULL AND NEW.kind NOT IN ('adjustment', 'correction') THEN
    RAISE EXCEPTION 'business date % sealed', NEW.business_date
      USING ERRCODE = 'P0011';
  END IF;
  RETURN NEW;
END $$;


--
-- Name: assert_journal_balanced(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assert_journal_balanced() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE v bigint;
BEGIN
  SELECT COALESCE(sum(amount_minor),0) INTO v FROM posting_line WHERE journal_id = NEW.journal_id;
  IF v <> 0 THEN RAISE EXCEPTION 'journal % unbalanced by %', NEW.journal_id, v
    USING ERRCODE = 'P0010'; END IF;
  RETURN NULL;
END $$;


--
-- Name: assign_due_in_room(uuid, uuid, uuid, uuid, uuid, tstzrange, uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assign_due_in_room(p_tenant uuid, p_property uuid, p_reservation uuid, p_segment uuid, p_expected_unit_type uuid, p_expected_period tstzrange, p_expected_sellable_unit uuid, p_sellable_unit uuid, p_actor uuid) RETURNS TABLE(segment_id uuid, unit_type_id uuid, previous_sellable_unit_id uuid, sellable_unit_id uuid, space_id uuid, period_from timestamp with time zone, period_to timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'pg_temp'
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


--
-- Name: assign_vehicle_parking(uuid, uuid, uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assign_vehicle_parking(p_tenant uuid, p_property uuid, p_vehicle uuid, p_parking_space uuid, p_actor uuid) RETURNS TABLE(vehicle_id uuid, vehicle_registration text, parking_space_id uuid, parking_code text, parking_floor text, reservation_segment_id uuid, occupancy_id uuid, occupancy_from timestamp with time zone, occupancy_to timestamp with time zone, occupancy_period text, occupancy_claim text, created boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
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


--
-- Name: carry_business_day_discrepancy(uuid, uuid, text, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.carry_business_day_discrepancy(p_tenant uuid, p_approval uuid, p_expected_hash text, p_request uuid, p_actor uuid) RETURNS TABLE(carry_id uuid, source_discrepancy_id uuid, target_discrepancy_id uuid, property_node uuid, source_business_date date, target_business_date date, resolution text, request_hash text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $_$
DECLARE a public.approval_request%ROWTYPE; d public.discrepancy%ROWTYPE; t public.business_day%ROWTYPE; v_property uuid; v_source date; v_target date; v_space uuid; v_reason text; v_state text; v_hash text; v_new uuid; v_carry uuid; v_tz text; v_lineage record;
BEGIN
 IF session_user<>'yellow_runtime' OR current_setting('role',true) IS DISTINCT FROM 'app_role' OR current_user<>'yellow_owner' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='discrepancy carry requires governed runtime'; END IF;
 IF nullif(current_setting('app.tenant_id',true),'')::uuid IS DISTINCT FROM p_tenant OR p_expected_hash !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='invalid discrepancy carry context'; END IF;
 SELECT * INTO a FROM public.approval_request WHERE tenant_id=p_tenant AND id=p_approval FOR UPDATE;
 IF NOT FOUND OR a.kind<>'business_day_discrepancy_carry' OR a.subject_type<>'discrepancy' OR a.status<>'approved' OR a.requested_by<>p_actor OR a.decided_by IS NULL OR a.decided_by=p_actor OR a.decided_at IS NULL OR NOT (a.decided_at <= transaction_timestamp()) OR transaction_timestamp()>=a.created_at+interval '30 minutes' OR a.decided_at>=a.created_at+interval '30 minutes' OR a.payload->>'requestHash'<>p_expected_hash THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='exact discrepancy carry approval unavailable'; END IF;
 v_property:=(a.payload->>'propertyNode')::uuid; v_source:=(a.payload->>'sourceBusinessDate')::date; v_target:=(a.payload->>'targetBusinessDate')::date; v_reason:=a.payload->>'reason';
 PERFORM 1 FROM public.app_user u JOIN public.user_role ur ON ur.tenant_id=u.tenant_id AND ur.user_id=u.id JOIN public.role_permission rp ON rp.role_id=ur.role_id AND rp.permission_code='financials.business-day:carry-discrepancy' JOIN public.org_node g ON g.tenant_id=ur.tenant_id AND g.id=ur.scope_node JOIN public.org_node property ON property.tenant_id=u.tenant_id AND property.id=v_property AND g.path @> property.path WHERE u.tenant_id=p_tenant AND u.id=p_actor AND u.status='active'; IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='requester unauthorized'; END IF;
 PERFORM 1 FROM public.app_user u JOIN public.user_role ur ON ur.tenant_id=u.tenant_id AND ur.user_id=u.id JOIN public.role_permission rp ON rp.role_id=ur.role_id AND rp.permission_code='financials.business-day:approve-discrepancy-carry' JOIN public.org_node g ON g.tenant_id=ur.tenant_id AND g.id=ur.scope_node JOIN public.org_node property ON property.tenant_id=u.tenant_id AND property.id=v_property AND g.path @> property.path WHERE u.tenant_id=p_tenant AND u.id=a.decided_by AND u.status='active'; IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='approver unauthorized'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('discrepancy-carry:'||p_tenant||':'||a.subject_id,351));
 SELECT x.* INTO d FROM public.discrepancy x JOIN public.space s ON s.tenant_id=x.tenant_id AND s.id=x.space_id AND s.property_node=v_property WHERE x.tenant_id=p_tenant AND x.id=a.subject_id AND x.resolved_at IS NULL FOR UPDATE OF x; IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='source discrepancy stale'; END IF; v_space:=d.space_id;
 SELECT o.business_date,o.property_node,count(*) OVER() n INTO v_lineage FROM public.outbox o WHERE o.tenant_id=p_tenant AND o.aggregate_type='discrepancy' AND o.aggregate_id=d.id AND o.event_type='discrepancy.reported'; IF NOT FOUND OR v_lineage.n<>1 OR v_lineage.property_node<>v_property OR v_lineage.business_date<>v_source THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='canonical discrepancy lineage stale'; END IF;
 SELECT timezone INTO v_tz FROM public.org_node WHERE tenant_id=p_tenant AND id=v_property; IF v_target<>(transaction_timestamp() AT TIME ZONE v_tz)::date THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='target date stale'; END IF;
 PERFORM 1 FROM public.business_day source_day WHERE source_day.tenant_id=p_tenant AND source_day.property_node=v_property AND source_day.business_date=v_source AND source_day.sealed_at IS NULL FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='source day stale'; END IF;
 SELECT target_day.* INTO t FROM public.business_day target_day WHERE target_day.tenant_id=p_tenant AND target_day.property_node=v_property AND target_day.business_date=v_target AND target_day.sealed_at IS NULL FOR UPDATE; IF NOT FOUND OR to_char(t.opened_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')<>a.payload->>'targetOpenedAt' THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='target day stale'; END IF;
 v_state:=encode(digest(jsonb_build_object('v',1,'tenantId',p_tenant,'discrepancyId',d.id,'spaceId',d.space_id,'reported',d.reported,'systemState',d.system_state,'reportedBy',d.reported_by,'reportedAt',d.reported_at,'resolvedAt',NULL)::text,'sha256'),'hex');
 v_hash:=encode(digest(jsonb_build_object('v',1,'tenantId',p_tenant,'propertyNode',v_property,'discrepancyId',d.id,'sourceBusinessDate',v_source,'targetBusinessDate',v_target,'reason',v_reason,'discrepancyStateHash',v_state,'targetOpenedAt',t.opened_at)::text,'sha256'),'hex');
 IF v_state<>a.payload->>'discrepancyStateHash' OR v_hash<>p_expected_hash OR a.payload<>jsonb_build_object('propertyNode',v_property::text,'sourceDiscrepancyId',d.id::text,'sourceBusinessDate',v_source::text,'targetBusinessDate',v_target::text,'reason',v_reason,'discrepancyStateHash',v_state,'requestHash',v_hash,'targetOpenedAt',to_char(t.opened_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')) THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='approval binding stale'; END IF;
 UPDATE public.discrepancy SET resolved_at=transaction_timestamp(),resolution='carried_forward' WHERE tenant_id=p_tenant AND id=d.id AND resolved_at IS NULL;
 INSERT INTO public.discrepancy(tenant_id,space_id,reported,system_state,reported_by,reported_at) VALUES(p_tenant,v_space,d.reported,d.system_state,p_actor,transaction_timestamp()) RETURNING id INTO v_new;
 INSERT INTO public.business_day_discrepancy_carry(tenant_id,request_id,property_node,source_discrepancy_id,target_discrepancy_id,source_business_date,target_business_date,target_opened_at,space_id,discrepancy_state_hash,reason,request_hash,approval_request_id,requested_by,approved_by,approval_requested_at,approval_decided_at) VALUES(p_tenant,p_request,v_property,d.id,v_new,v_source,v_target,t.opened_at,v_space,v_state,v_reason,v_hash,p_approval,p_actor,a.decided_by,a.created_at,a.decided_at) RETURNING id INTO v_carry;
 RETURN QUERY SELECT v_carry,d.id,v_new,v_property,v_source,v_target,'carried_forward'::text,v_hash;
END $_$;


--
-- Name: close_cashier_session(uuid, uuid, uuid, uuid, uuid, uuid, text, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.close_cashier_session(p_tenant uuid, p_property uuid, p_session uuid, p_actor uuid, p_count uuid, p_approval uuid, p_reason text, p_supervised boolean) RETURNS TABLE(session_id uuid, opening_count_id uuid, closing_count_id uuid, business_date date, currency character, expected_minor bigint, counted_minor bigint, over_short_minor bigint, closed_at timestamp with time zone, closed_by uuid, supervised boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'pg_temp'
    AS $$
DECLARE
  v_context_tenant uuid;
  v_business_date date;
  v_drawer_id uuid;
  v_opened_by uuid;
  v_opening_count_id uuid;
  v_latest_count_id uuid;
  v_counted_by uuid;
  v_currency character(3);
  v_expected bigint;
  v_counted bigint;
  v_over_short_numeric numeric;
  v_over_short bigint;
  v_closed_at timestamptz := pg_catalog.transaction_timestamp();
BEGIN
  IF session_user <> 'yellow_runtime'
     OR pg_catalog.current_setting('role', true) IS DISTINCT FROM 'app_role'
     OR current_user <> 'yellow_owner' THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'cashier close requires the governed runtime app role';
  END IF;

  BEGIN
    v_context_tenant := NULLIF(
      pg_catalog.current_setting('app.tenant_id', true), ''
    )::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'cashier close tenant context is invalid';
  END;
  IF v_context_tenant IS NULL OR p_tenant IS NULL
     OR v_context_tenant <> p_tenant THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'cashier close tenant context is invalid';
  END IF;
  IF p_property IS NULL OR p_session IS NULL OR p_actor IS NULL
     OR p_count IS NULL OR p_supervised IS NULL
     OR (p_reason IS NOT NULL AND (
       pg_catalog.octet_length(p_reason) NOT BETWEEN 1 AND 500
       OR p_reason <> pg_catalog.btrim(p_reason)
       OR p_reason ~ '[[:cntrl:]]'
       OR p_reason ~ U&'[\200B-\200D\202A-\202E\2060\2066-\2069\FEFF]'
     )) THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'cashier close input is invalid';
  END IF;

  SELECT (pg_catalog.transaction_timestamp() AT TIME ZONE property.timezone)::date
    INTO v_business_date
    FROM public.org_node AS property
   WHERE property.tenant_id = p_tenant
     AND property.id = p_property
     AND property.kind = 'property'
     AND property.currency IS NOT NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'cashier property is unavailable';
  END IF;

  SELECT cashier.drawer_id
    INTO v_drawer_id
    FROM public.cashier_session AS cashier
   WHERE cashier.tenant_id = p_tenant
     AND cashier.id = p_session
     AND cashier.property_node = p_property;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'cashier session is unavailable';
  END IF;

  PERFORM 1
    FROM public.business_day AS day
   WHERE day.tenant_id = p_tenant
     AND day.property_node = p_property
     AND day.business_date = v_business_date
     AND day.sealed_at IS NULL
   FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'cashier business day is unavailable';
  END IF;

  PERFORM 1
    FROM public.cash_drawer AS drawer
   WHERE drawer.tenant_id = p_tenant
     AND drawer.id = v_drawer_id
     AND drawer.property_node = p_property
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'cashier drawer is unavailable';
  END IF;

  SELECT cashier.user_id, cashier.opening_count_id, cashier.business_date,
         cashier.currency, cashier.expected_minor
    INTO v_opened_by, v_opening_count_id, v_business_date,
         v_currency, v_expected
    FROM public.cashier_session AS cashier
   WHERE cashier.tenant_id = p_tenant
     AND cashier.id = p_session
     AND cashier.property_node = p_property
     AND cashier.drawer_id = v_drawer_id
     AND cashier.business_date = v_business_date
     AND cashier.closed_at IS NULL
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'cashier session is unavailable';
  END IF;

  PERFORM 1
    FROM public.app_user AS actor
   WHERE actor.tenant_id = p_tenant
     AND actor.id = p_actor
     AND actor.status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'cashier actor is unavailable';
  END IF;

  SELECT count.id, count.counted_by, count.total_minor
    INTO v_latest_count_id, v_counted_by, v_counted
    FROM public.cashier_count AS count
   WHERE count.tenant_id = p_tenant
     AND count.session_id = p_session
     AND count.kind = 'closing'
   ORDER BY count.attempt_no DESC
   LIMIT 1;
  IF NOT FOUND OR v_latest_count_id <> p_count OR v_counted_by <> p_actor THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'cashier close count is stale or unavailable';
  END IF;

  IF (p_supervised AND p_actor = v_opened_by)
     OR (NOT p_supervised AND p_actor <> v_opened_by) THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'cashier close actor is not authorized for this close mode';
  END IF;

  v_over_short_numeric := v_counted::numeric - v_expected::numeric;
  IF v_over_short_numeric < (-9223372036854775808)::numeric
     OR v_over_short_numeric > 9223372036854775807::numeric THEN
    RAISE EXCEPTION USING ERRCODE = '22003',
      MESSAGE = 'cashier over-short is outside signed int64';
  END IF;
  v_over_short := v_over_short_numeric::bigint;

  IF p_supervised AND p_reason IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'supervised cashier close requires a reason';
  END IF;

  IF v_over_short = 0 THEN
    IF p_approval IS NOT NULL OR (NOT p_supervised AND p_reason IS NOT NULL) THEN
      RAISE EXCEPTION USING ERRCODE = '22023',
        MESSAGE = 'cashier close evidence is invalid';
    END IF;
  ELSE
    IF p_approval IS NULL OR p_reason IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '55000',
        MESSAGE = 'cashier discrepancy requires exact approval and reason';
    END IF;

    PERFORM 1
      FROM public.approval_request AS approval
     WHERE approval.tenant_id = p_tenant
       AND approval.id = p_approval
       AND approval.kind = 'cashier_over_short'
       AND approval.subject_type = 'cashier_session'
       AND approval.subject_id = p_session
       AND approval.requested_by = p_actor
       AND approval.status = 'approved'
       AND approval.decided_by IS NOT NULL
       AND approval.decided_by <> p_actor
       AND approval.decided_by <> v_opened_by
       AND approval.payload = pg_catalog.jsonb_build_object(
         'sessionId', p_session::text,
         'countId', p_count::text,
         'expectedMinor', v_expected::text,
         'countedMinor', v_counted::text,
         'overShortMinor', v_over_short::text
       )
     FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = '55000',
        MESSAGE = 'cashier discrepancy approval is unavailable or stale';
    END IF;
  END IF;

  UPDATE public.cashier_session AS cashier
     SET closing_count_id = p_count,
         counted_minor = v_counted,
         over_short_minor = v_over_short,
         closed_at = v_closed_at,
         closed_by = p_actor,
         close_reason = p_reason,
         approval_request_id = p_approval,
         supervised_close = p_supervised
   WHERE cashier.tenant_id = p_tenant
     AND cashier.id = p_session
     AND cashier.closed_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'cashier session changed concurrently';
  END IF;

  RETURN QUERY
  SELECT p_session, v_opening_count_id, p_count, v_business_date,
         v_currency, v_expected, v_counted, v_over_short,
         v_closed_at, p_actor, p_supervised;
END;
$$;


--
-- Name: create_arrival_room_cleaning_task(uuid, uuid, uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_arrival_room_cleaning_task(p_tenant uuid, p_property uuid, p_reservation uuid, p_attendant uuid, p_actor uuid) RETURNS TABLE(task_id uuid, room_id uuid, room_condition text, assignee_party uuid, due_at timestamp with time zone, created boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'pg_temp'
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


--
-- Name: create_charge_correction_header(uuid, uuid, uuid, character, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_charge_correction_header(p_tenant uuid, p_original uuid, p_property uuid, p_currency character, p_description text, p_actor uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'pg_temp'
    AS $$
DECLARE
  v_context_tenant uuid;
  v_business_date date;
  v_header_id uuid;
BEGIN
  IF pg_catalog.current_setting('role', true) IS DISTINCT FROM 'app_role' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'charge correction header requires app_role';
  END IF;

  BEGIN
    v_context_tenant := NULLIF(
      pg_catalog.current_setting('app.tenant_id', true), ''
    )::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'charge correction header tenant context is invalid';
  END;
  IF v_context_tenant IS NULL OR p_tenant IS NULL OR v_context_tenant <> p_tenant THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'charge correction header tenant context is invalid';
  END IF;
  IF p_original IS NULL OR p_property IS NULL OR p_currency IS NULL OR p_actor IS NULL
     OR p_description IS NULL OR p_description <> pg_catalog.btrim(p_description)
     OR pg_catalog.char_length(p_description) NOT BETWEEN 1 AND 500
     OR p_description ~ '[[:cntrl:]]'
     OR p_description ~ U&'[\200B-\200D\202A-\202E\2060\2066-\2069\FEFF]' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'charge correction header input is invalid';
  END IF;

  SELECT (pg_catalog.transaction_timestamp() AT TIME ZONE property.timezone)::date
    INTO v_business_date
    FROM public.org_node AS property
   WHERE property.tenant_id = p_tenant
     AND property.id = p_property
     AND property.kind = 'property'
     AND property.currency = p_currency;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'charge correction property is unavailable';
  END IF;

  PERFORM 1
    FROM public.app_user AS actor
   WHERE actor.tenant_id = p_tenant
     AND actor.id = p_actor
     AND actor.status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'charge correction actor is unavailable';
  END IF;

  PERFORM 1
    FROM public.journal AS original
   WHERE original.tenant_id = p_tenant
     AND original.id = p_original
     AND original.property_node = p_property
     AND original.currency = p_currency
     AND original.kind = 'charge'
     AND original.reverses IS NULL
     AND original.source = '{"interface":"financials.charge.post"}'::jsonb;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'governed original charge is unavailable';
  END IF;

  INSERT INTO public.journal (
    tenant_id, property_node, business_date, kind, description,
    currency, reverses, source, created_by
  ) VALUES (
    p_tenant, p_property, v_business_date, 'adjustment', p_description,
    p_currency, p_original, '{"interface":"financials.charge.reverse"}'::jsonb, p_actor
  ) RETURNING id INTO v_header_id;

  RETURN v_header_id;
END;
$$;


--
-- Name: create_folio_transfer(uuid, uuid, uuid, uuid[], uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_folio_transfer(p_tenant_id uuid, p_source_folio uuid, p_destination_folio uuid, p_root_line_ids uuid[], p_actor_id uuid, p_reason text) RETURNS TABLE(journal_id uuid, property_node uuid, business_date date, currency character, source_folio_id uuid, destination_folio_id uuid, root_line_id uuid, amount_minor bigint, tx_code text, description text, quantity numeric)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'pg_temp'
    AS $$
DECLARE
  v_context_tenant uuid;
  v_requested_roots integer;
  v_account_id uuid;
  v_property_node uuid;
  v_reservation_id uuid;
  v_currency character(3);
  v_timezone text;
  v_business_date date;
  v_sealed_at timestamptz;
  v_family_count integer;
  v_root record;
  v_peer record;
  v_companion_root uuid;
  v_line_count integer;
  v_transfer_invalid boolean;
  v_nonzero_folios integer;
  v_allocated_folio uuid;
  v_family_amount numeric;
  v_source_amount numeric;
  v_journal_id uuid;
  v_root_id uuid;
  v_index integer := 0;
  v_sorted_roots uuid[];
  v_amounts bigint[] := ARRAY[]::bigint[];
  v_tx_codes text[] := ARRAY[]::text[];
  v_descriptions text[] := ARRAY[]::text[];
  v_quantities numeric(10,3)[] := ARRAY[]::numeric(10,3)[];
BEGIN
  IF session_user <> 'yellow_runtime'
     OR pg_catalog.current_setting('role', true) IS DISTINCT FROM 'app_role'
     OR current_user <> 'yellow_owner' THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'folio transfer requires the governed runtime app role';
  END IF;

  BEGIN
    v_context_tenant := NULLIF(
      pg_catalog.current_setting('app.tenant_id', true), ''
    )::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'folio transfer tenant context is invalid';
  END;
  IF v_context_tenant IS NULL OR p_tenant_id IS NULL
     OR v_context_tenant <> p_tenant_id THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'folio transfer tenant context is invalid';
  END IF;

  v_requested_roots := pg_catalog.cardinality(p_root_line_ids);
  IF p_source_folio IS NULL OR p_destination_folio IS NULL
     OR p_source_folio = p_destination_folio
     OR p_actor_id IS NULL
     OR v_requested_roots IS NULL OR v_requested_roots < 1 OR v_requested_roots > 50
     OR EXISTS (
       SELECT 1 FROM pg_catalog.unnest(p_root_line_ids) AS requested(id)
       WHERE requested.id IS NULL
     )
     OR (
       SELECT pg_catalog.count(DISTINCT requested.id)
       FROM pg_catalog.unnest(p_root_line_ids) AS requested(id)
     ) <> v_requested_roots
     OR p_reason IS NULL OR p_reason <> pg_catalog.btrim(p_reason)
     OR pg_catalog.char_length(p_reason) NOT BETWEEN 1 AND 500
     OR p_reason ~ '[[:cntrl:]]'
     OR p_reason ~ U&'[\200B-\200D\202A-\202E\2060\2066-\2069\FEFF]' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'folio transfer input is invalid';
  END IF;

  SELECT pg_catalog.array_agg(requested.id ORDER BY requested.id)
    INTO v_sorted_roots
    FROM pg_catalog.unnest(p_root_line_ids) AS requested(id);

  -- Discover the shared account, then serialize every command in this folio family.
  SELECT source.account_id INTO v_account_id
    FROM public.folio AS source
   WHERE source.tenant_id = p_tenant_id
     AND source.id = p_source_folio;
  IF v_account_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'source folio is unavailable';
  END IF;

  PERFORM 1
    FROM public.account AS account
   WHERE account.tenant_id = p_tenant_id
     AND account.id = v_account_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'folio account is unavailable';
  END IF;

  PERFORM folio.id
    FROM public.folio AS folio
   WHERE folio.tenant_id = p_tenant_id
     AND folio.id = ANY (ARRAY[p_source_folio, p_destination_folio]::uuid[])
   ORDER BY folio.id
   FOR UPDATE;

  SELECT account.property_node, folio.reservation_id, account.currency, property.timezone
    INTO v_property_node, v_reservation_id, v_currency, v_timezone
    FROM public.folio AS folio
    JOIN public.account AS account
      ON account.tenant_id = folio.tenant_id
     AND account.id = folio.account_id
    JOIN public.reservation AS reservation
      ON reservation.tenant_id = folio.tenant_id
     AND reservation.id = folio.reservation_id
    JOIN public.org_node AS property
      ON property.tenant_id = account.tenant_id
     AND property.id = account.property_node
     AND property.kind = 'property'
   WHERE folio.tenant_id = p_tenant_id
     AND folio.id = p_source_folio
     AND folio.account_id = v_account_id
     AND folio.status = 'open'
     AND account.status = 'open'
     AND account.role = 'guest'
     AND reservation.property_node = account.property_node
     AND reservation.currency = account.currency
     AND property.currency = account.currency;

  SELECT pg_catalog.count(*)::integer INTO v_family_count
    FROM public.folio AS folio
    JOIN public.account AS account
      ON account.tenant_id = folio.tenant_id
     AND account.id = folio.account_id
    JOIN public.reservation AS reservation
      ON reservation.tenant_id = folio.tenant_id
     AND reservation.id = folio.reservation_id
    JOIN public.org_node AS property
      ON property.tenant_id = account.tenant_id
     AND property.id = account.property_node
     AND property.kind = 'property'
   WHERE folio.tenant_id = p_tenant_id
     AND folio.id = ANY (ARRAY[p_source_folio, p_destination_folio]::uuid[])
     AND folio.account_id = v_account_id
     AND folio.reservation_id = v_reservation_id
     AND folio.status = 'open'
     AND account.status = 'open'
     AND account.role = 'guest'
     AND account.property_node = v_property_node
     AND account.currency = v_currency
     AND reservation.property_node = v_property_node
     AND reservation.currency = v_currency
     AND property.currency = v_currency;

  IF v_family_count <> 2 OR v_property_node IS NULL OR v_reservation_id IS NULL
     OR v_currency IS NULL OR v_timezone IS NULL
     OR EXISTS (
       SELECT 1
         FROM public.folio AS folio
        WHERE folio.tenant_id = p_tenant_id
          AND folio.id = ANY (ARRAY[p_source_folio, p_destination_folio]::uuid[])
          AND (folio.account_id <> v_account_id
            OR folio.reservation_id IS DISTINCT FROM v_reservation_id)
     ) THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'folio transfer requires open sibling folios in one guest account family';
  END IF;

  PERFORM 1
    FROM public.app_user AS actor
   WHERE actor.tenant_id = p_tenant_id
     AND actor.id = p_actor_id
     AND actor.status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'folio transfer actor is unavailable';
  END IF;

  -- The correction command takes the identical per-root key before checking the
  -- current allocation. Sorted acquisition makes multi-root transfers deterministic.
  FOREACH v_root_id IN ARRAY v_sorted_roots
  LOOP
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        p_tenant_id::text || ':folio-transfer-root:' || v_root_id::text,
        188
      )
    );
  END LOOP;

  -- Re-derive every root after the family locks. Nothing is inserted until the
  -- complete set, correction companion closure, and whole allocations validate.
  FOREACH v_root_id IN ARRAY v_sorted_roots
  LOOP
    SELECT root.id, root.journal_id, root.account_id, root.folio_id,
           root.tx_code, root.description, root.amount_minor, root.quantity,
           root.business_date, root.currency, root.tax_detail,
           header.kind, header.reverses, header.source, header.property_node,
           header.business_date AS header_business_date, header.currency AS header_currency
      INTO v_root
      FROM public.posting_line AS root
      JOIN public.journal AS header
        ON header.tenant_id = root.tenant_id
       AND header.id = root.journal_id
     WHERE root.tenant_id = p_tenant_id
       AND root.id = v_root_id
       AND root.folio_transfer_root_line_id IS NULL
       AND root.seq = 1
       AND root.account_id = v_account_id
       AND root.folio_id IS NOT NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'folio transfer root is unavailable';
    END IF;

    IF v_root.property_node <> v_property_node OR v_root.currency <> v_currency
       OR v_root.header_currency <> v_currency
       OR v_root.business_date <> v_root.header_business_date
       OR v_root.tax_detail IS NOT NULL
       OR NOT (
         (v_root.kind = 'charge' AND v_root.reverses IS NULL
           AND v_root.source = '{"interface":"financials.charge.post"}'::jsonb
           AND v_root.amount_minor > 0)
         OR
         (v_root.kind = 'adjustment' AND v_root.reverses IS NOT NULL
           AND v_root.source = '{"interface":"financials.charge.reverse"}'::jsonb
           AND v_root.amount_minor < 0)
       ) THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'folio transfer root is not governed';
    END IF;

    SELECT pg_catalog.count(*)::integer INTO v_line_count
      FROM public.posting_line AS line
     WHERE line.tenant_id = p_tenant_id
       AND line.journal_id = v_root.journal_id;
    SELECT peer.account_id, peer.folio_id, peer.tx_code, peer.description,
           peer.amount_minor, peer.quantity, peer.business_date, peer.currency,
           peer.tax_detail, peer_account.role, peer_account.property_node,
           peer_account.currency AS account_currency
      INTO v_peer
      FROM public.posting_line AS peer
      JOIN public.account AS peer_account
        ON peer_account.tenant_id = peer.tenant_id
       AND peer_account.id = peer.account_id
     WHERE peer.tenant_id = p_tenant_id
       AND peer.journal_id = v_root.journal_id
       AND peer.seq = 2;
    IF v_line_count <> 2 OR NOT FOUND
       OR v_peer.account_id = v_account_id OR v_peer.folio_id IS NOT NULL
       OR v_peer.role <> 'revenue' OR v_peer.property_node <> v_property_node
       OR v_peer.account_currency <> v_currency
       OR v_peer.amount_minor <> -v_root.amount_minor
       OR v_peer.tx_code <> v_root.tx_code
       OR v_peer.description IS DISTINCT FROM v_root.description
       OR v_peer.quantity <> v_root.quantity
       OR v_peer.business_date <> v_root.business_date
       OR v_peer.currency <> v_root.currency OR v_peer.tax_detail IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'folio transfer root posting set is inconsistent';
    END IF;

    IF v_root.kind = 'charge' THEN
      SELECT correction_root.id INTO v_companion_root
        FROM public.journal AS correction
        JOIN public.posting_line AS correction_root
          ON correction_root.tenant_id = correction.tenant_id
         AND correction_root.journal_id = correction.id
         AND correction_root.seq = 1
       WHERE correction.tenant_id = p_tenant_id
         AND correction.reverses = v_root.journal_id
         AND correction.kind = 'adjustment'
         AND correction.source = '{"interface":"financials.charge.reverse"}'::jsonb;
      IF FOUND AND NOT (v_companion_root = ANY (v_sorted_roots)) THEN
        RAISE EXCEPTION USING ERRCODE = '55000',
          MESSAGE = 'corrected folio transfer roots must move with their contra companion';
      END IF;
    ELSE
      SELECT original_root.id INTO v_companion_root
        FROM public.journal AS original
        JOIN public.posting_line AS original_root
          ON original_root.tenant_id = original.tenant_id
         AND original_root.journal_id = original.id
         AND original_root.seq = 1
       WHERE original.tenant_id = p_tenant_id
         AND original.id = v_root.reverses
         AND original.kind = 'charge'
         AND original.reverses IS NULL
         AND original.source = '{"interface":"financials.charge.post"}'::jsonb;
      IF NOT FOUND OR NOT (v_companion_root = ANY (v_sorted_roots)) THEN
        RAISE EXCEPTION USING ERRCODE = '55000',
          MESSAGE = 'correction folio transfer root requires its original companion';
      END IF;
    END IF;

    SELECT EXISTS (
      SELECT 1
        FROM public.posting_line AS transfer_line
        JOIN public.journal AS transfer_header
          ON transfer_header.tenant_id = transfer_line.tenant_id
         AND transfer_header.id = transfer_line.journal_id
       WHERE transfer_line.tenant_id = p_tenant_id
         AND transfer_line.folio_transfer_root_line_id = v_root_id
       GROUP BY transfer_header.id, transfer_header.kind, transfer_header.reverses,
                transfer_header.source, transfer_header.property_node,
                transfer_header.business_date, transfer_header.currency
      HAVING transfer_header.kind <> 'transfer'
          OR transfer_header.reverses IS NOT NULL
          OR transfer_header.source <> '{"interface":"financials.folio.transfer"}'::jsonb
          OR transfer_header.property_node <> v_property_node
          OR transfer_header.currency <> v_currency
          OR pg_catalog.count(*) <> 2
          OR pg_catalog.count(DISTINCT transfer_line.folio_id) <> 2
          OR pg_catalog.count(*) FILTER (WHERE transfer_line.amount_minor = v_root.amount_minor) <> 1
          OR pg_catalog.count(*) FILTER (WHERE transfer_line.amount_minor = -v_root.amount_minor) <> 1
          OR pg_catalog.bool_or(transfer_line.account_id <> v_account_id)
          OR pg_catalog.bool_or(transfer_line.folio_id IS NULL)
          OR pg_catalog.bool_or(transfer_line.tx_code <> v_root.tx_code)
          OR pg_catalog.bool_or(transfer_line.description IS DISTINCT FROM v_root.description)
          OR pg_catalog.bool_or(transfer_line.quantity <> v_root.quantity)
          OR pg_catalog.bool_or(transfer_line.business_date <> transfer_header.business_date)
          OR pg_catalog.bool_or(transfer_line.currency <> v_currency)
          OR pg_catalog.bool_or(transfer_line.tax_detail IS NOT NULL)
    ) INTO v_transfer_invalid;
    IF v_transfer_invalid THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'folio transfer lineage is inconsistent';
    END IF;

    SELECT pg_catalog.count(*) FILTER (WHERE allocation.amount <> 0)::integer,
           (pg_catalog.array_agg(allocation.folio_id ORDER BY allocation.folio_id)
             FILTER (WHERE allocation.amount <> 0))[1],
           pg_catalog.sum(allocation.amount),
           pg_catalog.sum(allocation.amount) FILTER (WHERE allocation.folio_id = p_source_folio)
      INTO v_nonzero_folios, v_allocated_folio, v_family_amount, v_source_amount
      FROM (
        SELECT family_line.folio_id, pg_catalog.sum(family_line.amount_minor::numeric) AS amount
          FROM (
            SELECT root.folio_id, root.amount_minor
              FROM public.posting_line AS root
             WHERE root.tenant_id = p_tenant_id AND root.id = v_root_id
            UNION ALL
            SELECT transfer_line.folio_id, transfer_line.amount_minor
              FROM public.posting_line AS transfer_line
             WHERE transfer_line.tenant_id = p_tenant_id
               AND transfer_line.folio_transfer_root_line_id = v_root_id
          ) AS family_line
         GROUP BY family_line.folio_id
      ) AS allocation;
    IF v_nonzero_folios <> 1 OR v_allocated_folio <> p_source_folio
       OR v_family_amount <> v_root.amount_minor
       OR v_source_amount IS DISTINCT FROM v_root.amount_minor::numeric THEN
      RAISE EXCEPTION USING ERRCODE = '55000',
        MESSAGE = 'folio transfer root is stale, split, or not wholly allocated to the source';
    END IF;

    v_amounts := pg_catalog.array_append(v_amounts, v_root.amount_minor::bigint);
    v_tx_codes := pg_catalog.array_append(v_tx_codes, v_root.tx_code::text);
    v_descriptions := pg_catalog.array_append(v_descriptions, v_root.description::text);
    v_quantities := pg_catalog.array_append(v_quantities, v_root.quantity::numeric(10,3));
  END LOOP;

  v_business_date := (pg_catalog.transaction_timestamp() AT TIME ZONE v_timezone)::date;
  SELECT day.sealed_at INTO v_sealed_at
    FROM public.business_day AS day
   WHERE day.tenant_id = p_tenant_id
     AND day.property_node = v_property_node
     AND day.business_date = v_business_date
   FOR SHARE;
  IF NOT FOUND OR v_sealed_at IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0011',
      MESSAGE = 'folio transfer business day is missing or sealed';
  END IF;

  INSERT INTO public.journal (
    tenant_id, property_node, business_date, kind, description,
    currency, source, created_by
  ) VALUES (
    p_tenant_id, v_property_node, v_business_date, 'transfer', p_reason,
    v_currency, '{"interface":"financials.folio.transfer"}'::jsonb, p_actor_id
  ) RETURNING id INTO v_journal_id;

  FOREACH v_root_id IN ARRAY v_sorted_roots
  LOOP
    v_index := v_index + 1;
    INSERT INTO public.posting_line (
      tenant_id, journal_id, seq, account_id, folio_id, tx_code,
      description, amount_minor, quantity, business_date, currency,
      folio_transfer_root_line_id
    ) VALUES
      (
        p_tenant_id, v_journal_id, (v_index * 2 - 1)::smallint,
        v_account_id, p_source_folio, v_tx_codes[v_index],
        v_descriptions[v_index], -v_amounts[v_index], v_quantities[v_index],
        v_business_date, v_currency, v_root_id
      ),
      (
        p_tenant_id, v_journal_id, (v_index * 2)::smallint,
        v_account_id, p_destination_folio, v_tx_codes[v_index],
        v_descriptions[v_index], v_amounts[v_index], v_quantities[v_index],
        v_business_date, v_currency, v_root_id
      );
  END LOOP;

  RETURN QUERY
  SELECT v_journal_id, v_property_node, v_business_date, v_currency,
         p_source_folio, p_destination_folio, requested.id,
         v_amounts[requested.ordinality::integer],
         v_tx_codes[requested.ordinality::integer],
         v_descriptions[requested.ordinality::integer],
         v_quantities[requested.ordinality::integer]
    FROM pg_catalog.unnest(v_sorted_roots) WITH ORDINALITY AS requested(id, ordinality)
   ORDER BY requested.id;
END;
$$;


--
-- Name: create_owner_trust_expense(uuid, uuid, uuid, uuid, bigint, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_owner_trust_expense(p_tenant uuid, p_trust_account uuid, p_actor uuid, p_approval uuid, p_amount bigint, p_reason text) RETURNS TABLE(journal_id uuid, property_node uuid, owner_party_id uuid, trust_account_id uuid, payable_account_id uuid, business_date date, currency character, amount_minor bigint, available_before_minor bigint, projected_available_minor bigint, approval_request_id uuid)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'pg_temp'
    AS $$
DECLARE
  v_context uuid; v_property uuid; v_owner uuid; v_payable uuid; v_currency char(3);
  v_timezone text; v_date date; v_sum numeric; v_before numeric; v_after numeric; v_journal uuid;
BEGIN
  IF session_user <> 'yellow_runtime' OR pg_catalog.current_setting('role',true) IS DISTINCT FROM 'app_role'
     OR current_user <> 'yellow_owner' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='owner trust expense requires governed runtime app role'; END IF;
  BEGIN v_context:=NULLIF(pg_catalog.current_setting('app.tenant_id',true),'')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='owner trust tenant context is invalid'; END;
  IF v_context IS NULL OR p_tenant IS NULL OR v_context<>p_tenant THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='owner trust tenant context is invalid'; END IF;
  IF p_trust_account IS NULL OR p_actor IS NULL OR p_amount IS NULL OR p_amount<=0 OR p_reason IS NULL
     OR pg_catalog.octet_length(p_reason) NOT BETWEEN 1 AND 500 OR p_reason<>pg_catalog.btrim(p_reason)
     OR p_reason ~ '[[:cntrl:]]' OR p_reason ~ U&'[\200B-\200D\202A-\202E\2060\2066-\2069\FEFF]' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='owner trust expense input is invalid'; END IF;

  SELECT a.property_node,a.party_id,a.currency,p.timezone INTO v_property,v_owner,v_currency,v_timezone
    FROM public.account a JOIN public.org_node p ON p.tenant_id=a.tenant_id AND p.id=a.property_node AND p.kind='property'
   WHERE a.tenant_id=p_tenant AND a.id=p_trust_account;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='owner trust account is unavailable'; END IF;
  SELECT r.credit_account_id INTO v_payable FROM public.tx_code_route r
   WHERE r.tenant_id=p_tenant AND r.property_node=v_property AND r.currency=v_currency
     AND r.tx_code='OWNER_TRUST_EXPENSE' AND r.debit_account_id=p_trust_account;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='owner trust route is unavailable'; END IF;
  PERFORM public.lock_financial_rows(p_tenant,ARRAY[p_trust_account,v_payable]::uuid[],NULL);

  PERFORM 1 FROM public.app_user u
   JOIN public.user_role ur ON ur.tenant_id=u.tenant_id AND ur.user_id=u.id AND ur.scope_node=v_property
   JOIN public.role_permission rp ON rp.role_id=ur.role_id AND rp.permission_code='financials.trust:post'
   WHERE u.tenant_id=p_tenant AND u.id=p_actor AND u.status='active';
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='owner trust actor is unauthorized'; END IF;
  PERFORM 1 FROM public.account trust
   JOIN public.party owner ON owner.tenant_id=trust.tenant_id AND owner.id=trust.party_id AND owner.status='active'
   JOIN public.party_role pr ON pr.tenant_id=owner.tenant_id AND pr.party_id=owner.id AND pr.role='owner'
   JOIN public.account payable ON payable.tenant_id=trust.tenant_id AND payable.id=v_payable
   WHERE trust.tenant_id=p_tenant AND trust.id=p_trust_account AND trust.property_node=v_property
     AND trust.role='trust' AND trust.status='open' AND trust.currency=v_currency
     AND payable.property_node=v_property AND payable.role='payable' AND payable.status='open' AND payable.currency=v_currency
   FOR UPDATE OF trust,payable,owner;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='owner trust route is unavailable'; END IF;
  SELECT COALESCE(pg_catalog.sum(line.amount_minor::numeric),0) INTO v_sum
    FROM public.posting_line AS line
   WHERE line.tenant_id=p_tenant AND line.account_id=p_trust_account;
  v_before:=-v_sum; v_after:=v_before-p_amount::numeric;
  IF v_before NOT BETWEEN (-9223372036854775808)::numeric AND 9223372036854775807::numeric
     OR v_after NOT BETWEEN (-9223372036854775808)::numeric AND 9223372036854775807::numeric THEN
    RAISE EXCEPTION USING ERRCODE='22003',MESSAGE='owner trust balance is outside signed int64'; END IF;
  IF v_after>=0 THEN
    IF p_approval IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='non-negative owner trust expense must not consume approval'; END IF;
  ELSE
    IF p_approval IS NULL THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='negative owner trust expense requires exact approval'; END IF;
    PERFORM 1 FROM public.approval_request ar
      JOIN public.app_user checker ON checker.tenant_id=ar.tenant_id AND checker.id=ar.decided_by AND checker.status='active'
      JOIN public.user_role ur ON ur.tenant_id=checker.tenant_id AND ur.user_id=checker.id AND ur.scope_node=v_property
      JOIN public.role_permission rp ON rp.role_id=ur.role_id AND rp.permission_code='financials.trust:approve-negative'
     WHERE ar.tenant_id=p_tenant AND ar.id=p_approval AND ar.kind='owner_trust_negative_expense'
       AND ar.subject_type='account' AND ar.subject_id=p_trust_account AND ar.requested_by=p_actor
       AND ar.status='approved' AND ar.decided_by IS NOT NULL AND ar.decided_by<>p_actor AND ar.decided_at IS NOT NULL
       AND ar.payload=pg_catalog.jsonb_build_object('ownerPartyId',v_owner::text,'trustAccountId',p_trust_account::text,
         'payableAccountId',v_payable::text,'amountMinor',p_amount::text,'availableBeforeMinor',v_before::bigint::text,
         'projectedAvailableMinor',v_after::bigint::text,'reason',p_reason)
       AND NOT EXISTS(SELECT 1 FROM public.journal j WHERE j.tenant_id=p_tenant AND j.approval_request_id=p_approval)
     FOR UPDATE OF ar;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='owner trust approval is unavailable, stale, or used'; END IF;
  END IF;
  v_date:=(pg_catalog.transaction_timestamp() AT TIME ZONE v_timezone)::date;
  PERFORM 1 FROM public.business_day d WHERE d.tenant_id=p_tenant AND d.property_node=v_property AND d.business_date=v_date AND d.sealed_at IS NULL FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0011',MESSAGE='owner trust business day is unavailable or sealed'; END IF;
  INSERT INTO public.journal(tenant_id,property_node,business_date,kind,description,currency,source,created_by,approval_request_id)
  VALUES(p_tenant,v_property,v_date,'paidout',p_reason,v_currency,'{"interface":"financials.trust.owner-expense.post"}'::jsonb,p_actor,p_approval)
  RETURNING id INTO v_journal;
  INSERT INTO public.posting_line(tenant_id,journal_id,seq,account_id,folio_id,tx_code,description,amount_minor,quantity,tax_detail,business_date,currency)
  VALUES (p_tenant,v_journal,1,p_trust_account,NULL,'OWNER_TRUST_EXPENSE',p_reason,p_amount,1,NULL,v_date,v_currency),
         (p_tenant,v_journal,2,v_payable,NULL,'OWNER_TRUST_EXPENSE',p_reason,-p_amount,1,NULL,v_date,v_currency);
  IF v_after<0 THEN INSERT INTO public.trust_negative_authorization(tenant_id,property_node,owner_party_id,trust_account_id,payable_account_id,approval_request_id,journal_id,amount_minor,available_before_minor,projected_available_minor,currency,business_date)
    VALUES(p_tenant,v_property,v_owner,p_trust_account,v_payable,p_approval,v_journal,p_amount,v_before::bigint,v_after::bigint,v_currency,v_date); END IF;
  RETURN QUERY SELECT v_journal,v_property,v_owner,p_trust_account,v_payable,v_date,v_currency,p_amount,v_before::bigint,v_after::bigint,p_approval;
END $$;


--
-- Name: create_positive_tax_correction_header(uuid, uuid, uuid, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_positive_tax_correction_header(p_tenant_id uuid, p_original_journal_id uuid, p_property_node uuid, p_description text, p_actor_id uuid) RETURNS TABLE(journal_id uuid, business_date date, currency character)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'pg_temp'
    AS $$
DECLARE
  v_context_tenant uuid;
  v_binding public.tax_attribution_journal_binding%ROWTYPE;
  v_original public.journal%ROWTYPE;
  v_business_date date;
  v_journal_id uuid;
BEGIN
  IF session_user <> 'yellow_runtime'
     OR pg_catalog.current_setting('role', true) IS DISTINCT FROM 'app_role'
     OR current_user <> 'yellow_owner' THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'positive-tax correction header requires the governed runtime app role';
  END IF;

  BEGIN
    v_context_tenant := NULLIF(
      pg_catalog.current_setting('app.tenant_id', true), ''
    )::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'positive-tax correction header tenant context is invalid';
  END;
  IF v_context_tenant IS NULL OR p_tenant_id IS NULL
     OR v_context_tenant <> p_tenant_id THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'positive-tax correction header tenant context is invalid';
  END IF;

  IF p_original_journal_id IS NULL OR p_property_node IS NULL
     OR p_actor_id IS NULL OR p_description IS NULL
     OR p_description <> pg_catalog.btrim(p_description)
     OR pg_catalog.char_length(p_description) NOT BETWEEN 1 AND 500
     OR p_description ~ '[[:cntrl:]]'
     OR p_description ~ U&'[\200B-\200D\202A-\202E\2060\2066-\2069\FEFF]' THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'positive-tax correction header input is invalid';
  END IF;

  PERFORM 1
    FROM public.tenant AS tenant
   WHERE tenant.id = p_tenant_id
     AND tenant.status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'positive-tax correction authority is unavailable';
  END IF;

  SELECT binding.*
    INTO v_binding
    FROM public.tax_attribution_journal_binding AS binding
   WHERE binding.tenant_id = p_tenant_id
     AND binding.property_node = p_property_node
     AND binding.journal_id = p_original_journal_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'governed positive-tax original is unavailable';
  END IF;

  SELECT original.*
    INTO v_original
    FROM public.journal AS original
   WHERE original.tenant_id = p_tenant_id
     AND original.id = p_original_journal_id
     AND original.property_node = p_property_node
     AND original.business_date = v_binding.business_date
     AND original.currency = v_binding.currency
     AND original.kind = 'charge'
     AND original.reverses IS NULL
     AND original.source = pg_catalog.jsonb_build_object(
       'interface', 'financials.positive-tax.post',
       'lineage_id', v_binding.lineage_id::text
     );
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'governed positive-tax original is unavailable';
  END IF;

  PERFORM 1
    FROM public.app_user AS actor
   WHERE actor.tenant_id = p_tenant_id
     AND actor.id = p_actor_id
     AND actor.status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'positive-tax correction actor is unavailable';
  END IF;

  SELECT (pg_catalog.transaction_timestamp() AT TIME ZONE property.timezone)::date
    INTO v_business_date
    FROM public.org_node AS property
   WHERE property.tenant_id = p_tenant_id
     AND property.id = p_property_node
     AND property.kind = 'property'
     AND property.currency = v_original.currency;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'positive-tax correction property is unavailable';
  END IF;

  INSERT INTO public.journal (
    tenant_id, property_node, business_date, kind, description,
    currency, reverses, source, created_by
  ) VALUES (
    p_tenant_id, p_property_node, v_business_date, 'adjustment',
    p_description, v_original.currency, p_original_journal_id,
    pg_catalog.jsonb_build_object(
      'interface', 'financials.positive-tax.reverse',
      'original_journal_id', p_original_journal_id::text,
      'lineage_id', v_binding.lineage_id::text
    ),
    p_actor_id
  )
  RETURNING id INTO v_journal_id;

  RETURN QUERY SELECT v_journal_id, v_business_date, v_original.currency;
END;
$$;


--
-- Name: create_receivable_transfer(uuid, uuid, uuid, uuid, uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_receivable_transfer(p_tenant uuid, p_property uuid, p_folio uuid, p_receivable_account uuid, p_actor uuid, p_approval uuid, p_reason text) RETURNS TABLE(journal_id uuid, business_date date, currency character, folio_id uuid, guest_account_id uuid, receivable_account_id uuid, receivable_party_id uuid, receivable_party_role text, amount_minor bigint, exposure_before_minor bigint, credit_limit_minor bigint, projected_exposure_minor bigint, approval_request_id uuid)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'pg_temp'
    AS $$
DECLARE
  v_context_tenant uuid;
  v_guest_account uuid;
  v_receivable_party uuid;
  v_receivable_role text;
  v_timezone text;
  v_currency character(3);
  v_target_currency character(3);
  v_credit_limit bigint;
  v_balance numeric;
  v_exposure numeric;
  v_projected numeric;
  v_business_date date;
  v_day_sealed_at timestamptz;
  v_journal uuid;
  v_balance_after numeric;
BEGIN
  IF session_user <> 'yellow_runtime'
     OR pg_catalog.current_setting('role', true) IS DISTINCT FROM 'app_role'
     OR current_user <> 'yellow_owner' THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'receivable transfer requires the governed runtime app role';
  END IF;

  BEGIN
    v_context_tenant := NULLIF(
      pg_catalog.current_setting('app.tenant_id', true), ''
    )::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'receivable transfer tenant context is invalid';
  END;
  IF v_context_tenant IS NULL OR p_tenant IS NULL
     OR v_context_tenant <> p_tenant THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'receivable transfer tenant context is invalid';
  END IF;

  IF p_property IS NULL OR p_folio IS NULL OR p_receivable_account IS NULL
     OR p_actor IS NULL OR p_reason IS NULL
     OR pg_catalog.octet_length(p_reason) NOT BETWEEN 1 AND 500
     OR p_reason <> pg_catalog.btrim(p_reason)
     OR p_reason ~ '[[:cntrl:]]'
     OR p_reason ~ U&'[\200B-\200D\202A-\202E\2060\2066-\2069\FEFF]' THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'receivable transfer input is invalid';
  END IF;

  PERFORM 1
    FROM public.app_user AS actor
   WHERE actor.tenant_id = p_tenant
     AND actor.id = p_actor
     AND actor.status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'receivable transfer actor is unavailable';
  END IF;

  -- Discover only the guest account id needed by the shared lock capability.
  -- All economic and authority predicates are re-evaluated after locking.
  SELECT folio.account_id
    INTO v_guest_account
    FROM public.folio AS folio
   WHERE folio.tenant_id = p_tenant
     AND folio.id = p_folio;
  IF NOT FOUND OR v_guest_account = p_receivable_account THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'receivable transfer target is unavailable';
  END IF;

  PERFORM public.lock_financial_rows(
    p_tenant,
    ARRAY[v_guest_account, p_receivable_account]::uuid[],
    p_folio
  );

  SELECT property.timezone, property.currency,
         folio.account_id,
         target.currency, target.party_id, target.credit_limit_minor,
         CASE
           WHEN EXISTS (
             SELECT 1 FROM public.party_role AS role
              WHERE role.tenant_id = target.tenant_id
                AND role.party_id = target.party_id
                AND role.role = 'company'
           ) THEN 'company'
           ELSE 'agent'
         END
    INTO v_timezone, v_currency, v_guest_account,
         v_target_currency, v_receivable_party, v_credit_limit, v_receivable_role
    FROM public.folio AS folio
    JOIN public.account AS guest
      ON guest.tenant_id = folio.tenant_id
     AND guest.id = folio.account_id
    JOIN public.org_node AS property
      ON property.tenant_id = guest.tenant_id
     AND property.id = guest.property_node
     AND property.kind = 'property'
     AND property.currency = guest.currency
    JOIN public.account AS target
      ON target.tenant_id = guest.tenant_id
     AND target.id = p_receivable_account
     AND target.property_node = guest.property_node
     AND target.currency = guest.currency
    JOIN public.party AS party
      ON party.tenant_id = target.tenant_id
     AND party.id = target.party_id
     AND party.status = 'active'
   WHERE folio.tenant_id = p_tenant
     AND folio.id = p_folio
     AND folio.status = 'open'
     AND guest.property_node = p_property
     AND guest.role = 'guest'
     AND guest.status = 'open'
     AND target.role = 'company'
     AND target.status = 'open'
     AND target.credit_limit_minor IS NOT NULL
     AND target.credit_limit_minor >= 0
     AND EXISTS (
       SELECT 1
         FROM public.party_role AS role
        WHERE role.tenant_id = target.tenant_id
          AND role.party_id = target.party_id
          AND role.role IN ('company', 'agent')
     )
   FOR UPDATE OF folio, guest, target, party;
  IF NOT FOUND OR v_target_currency <> v_currency THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'receivable transfer target is unavailable';
  END IF;

  SELECT balance.balance_minor
    INTO v_balance
    FROM public.folio_balance AS balance
   WHERE balance.tenant_id = p_tenant
     AND balance.folio_id = p_folio;
  v_balance := COALESCE(v_balance, 0::numeric);
  IF v_balance <= 0::numeric THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'receivable transfer requires an exact positive folio balance';
  END IF;
  IF v_balance > 9223372036854775807::numeric THEN
    RAISE EXCEPTION USING ERRCODE = '22003',
      MESSAGE = 'receivable transfer amount is outside signed int64';
  END IF;

  SELECT COALESCE(pg_catalog.sum(line.amount_minor::numeric), 0::numeric)
    INTO v_exposure
    FROM public.posting_line AS line
   WHERE line.tenant_id = p_tenant
     AND line.account_id = p_receivable_account;
  v_projected := v_exposure + v_balance;
  IF v_exposure < (-9223372036854775808)::numeric
     OR v_exposure > 9223372036854775807::numeric
     OR v_projected < (-9223372036854775808)::numeric
     OR v_projected > 9223372036854775807::numeric THEN
    RAISE EXCEPTION USING ERRCODE = '22003',
      MESSAGE = 'receivable exposure is outside signed int64';
  END IF;

  IF v_projected <= v_credit_limit::numeric THEN
    IF p_approval IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE = '22023',
        MESSAGE = 'within-limit receivable transfer must not consume approval';
    END IF;
  ELSE
    IF p_approval IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '55000',
        MESSAGE = 'over-limit receivable transfer requires exact approval';
    END IF;

    PERFORM 1
      FROM public.approval_request AS approval
      JOIN public.app_user AS checker
        ON checker.tenant_id = approval.tenant_id
       AND checker.id = approval.decided_by
       AND checker.status = 'active'
     WHERE approval.tenant_id = p_tenant
       AND approval.id = p_approval
       AND approval.kind = 'receivable_transfer_over_limit'
       AND approval.subject_type = 'folio'
       AND approval.subject_id = p_folio
       AND approval.requested_by = p_actor
       AND approval.status = 'approved'
       AND approval.decided_by IS NOT NULL
       AND approval.decided_by <> p_actor
       AND approval.decided_at IS NOT NULL
       AND approval.payload = pg_catalog.jsonb_build_object(
         'partyId', v_receivable_party::text,
         'accountId', p_receivable_account::text,
         'folioId', p_folio::text,
         'amountMinor', v_balance::bigint::text,
         'exposureBeforeMinor', v_exposure::bigint::text,
         'creditLimitMinor', v_credit_limit::text,
         'projectedExposureMinor', v_projected::bigint::text
       )
       AND NOT EXISTS (
         SELECT 1
           FROM public.journal AS used
          WHERE used.tenant_id = p_tenant
            AND used.approval_request_id = p_approval
       )
     FOR UPDATE OF approval;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = '55000',
        MESSAGE = 'receivable transfer approval is unavailable, stale, or used';
    END IF;
  END IF;

  v_business_date := (
    pg_catalog.transaction_timestamp() AT TIME ZONE v_timezone
  )::date;
  SELECT day.sealed_at
    INTO v_day_sealed_at
    FROM public.business_day AS day
   WHERE day.tenant_id = p_tenant
     AND day.property_node = p_property
     AND day.business_date = v_business_date
   FOR SHARE;
  IF NOT FOUND OR v_day_sealed_at IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0011',
      MESSAGE = 'receivable transfer business day is missing or sealed';
  END IF;

  INSERT INTO public.journal (
    tenant_id, property_node, business_date, kind, description,
    currency, source, created_by, approval_request_id
  ) VALUES (
    p_tenant, p_property, v_business_date, 'transfer', p_reason,
    v_currency, '{"interface":"financials.receivable.transfer"}'::jsonb,
    p_actor, p_approval
  ) RETURNING id INTO v_journal;

  INSERT INTO public.posting_line (
    tenant_id, journal_id, seq, account_id, folio_id, tx_code,
    description, amount_minor, quantity, tax_detail, business_date, currency
  ) VALUES
    (
      p_tenant, v_journal, 1, v_guest_account, p_folio, 'DIRECT_BILL',
      p_reason, -v_balance::bigint, 1, NULL, v_business_date, v_currency
    ),
    (
      p_tenant, v_journal, 2, p_receivable_account, NULL, 'DIRECT_BILL',
      p_reason, v_balance::bigint, 1, NULL, v_business_date, v_currency
    );

  SELECT balance.balance_minor
    INTO v_balance_after
    FROM public.folio_balance AS balance
   WHERE balance.tenant_id = p_tenant
     AND balance.folio_id = p_folio;
  IF COALESCE(v_balance_after, 0::numeric) <> 0::numeric THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'receivable transfer did not clear the exact folio balance';
  END IF;

  RETURN QUERY
  SELECT v_journal, v_business_date, v_currency, p_folio,
         v_guest_account, p_receivable_account, v_receivable_party,
         v_receivable_role, v_balance::bigint, v_exposure::bigint,
         v_credit_limit, v_projected::bigint, p_approval;
END;
$$;


--
-- Name: derive_posting_line_currency(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.derive_posting_line_currency() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.currency IS NULL THEN
    SELECT header.currency
      INTO NEW.currency
      FROM journal AS header
     WHERE header.tenant_id = NEW.tenant_id
       AND header.id = NEW.journal_id;
  END IF;
  RETURN NEW;
END $$;


--
-- Name: expire_holds(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.expire_holds() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'pg_temp'
    AS $$
DECLARE
  n int := 0;
  r record;
BEGIN
  FOR r IN
    SELECT id, tenant_id
      FROM public.hold
     WHERE status = 'active'
       AND expires_at < pg_catalog.now()
  LOOP
    PERFORM public.release_occupancy(r.tenant_id, r.id);
    UPDATE public.hold SET status = 'expired' WHERE id = r.id;
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;


--
-- Name: govern_arrival_pickup_task(uuid, uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.govern_arrival_pickup_task(p_tenant uuid, p_property uuid, p_reservation uuid, p_actor uuid) RETURNS TABLE(task_id uuid, created boolean, due_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'pg_temp'
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


--
-- Name: govern_housekeeping_task_sheet(uuid, uuid, date, uuid, uuid, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.govern_housekeeping_task_sheet(p_tenant uuid, p_property uuid, p_sheet_date date, p_attendant uuid, p_actor uuid, p_mode text, p_limit integer) RETURNS TABLE(sheet_id uuid, sheet_date date, attendant_party uuid, created boolean, rooms jsonb)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'pg_temp'
    AS $$
DECLARE
  v_context_tenant uuid;
  v_timezone text;
  v_room_count integer;
  v_bad_profile_count integer;
  v_cadence_count integer;
  v_unsupported_count integer;
  v_candidates jsonb;
  v_sheet_id uuid;
  v_existing_attendant uuid;
  v_created boolean := false;
BEGIN
  IF session_user <> 'yellow_runtime'
     OR pg_catalog.current_setting('role', true) IS DISTINCT FROM 'app_role'
     OR current_user <> 'yellow_owner' THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'housekeeping sheet requires the governed runtime app role';
  END IF;

  BEGIN
    v_context_tenant := NULLIF(
      pg_catalog.current_setting('app.tenant_id', true), ''
    )::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'housekeeping sheet tenant context is invalid';
  END;
  IF v_context_tenant IS NULL OR p_tenant IS NULL OR v_context_tenant <> p_tenant THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'housekeeping sheet tenant context is invalid';
  END IF;

  IF p_property IS NULL OR p_sheet_date IS NULL OR p_mode NOT IN ('preview', 'generate')
     OR (p_mode = 'preview' AND (
       p_attendant IS NOT NULL OR p_actor IS NOT NULL OR p_limit IS NULL OR p_limit < 1 OR p_limit > 200
     ))
     OR (p_mode = 'generate' AND (p_attendant IS NULL OR p_actor IS NULL OR p_limit IS NOT NULL)) THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'housekeeping sheet input is invalid';
  END IF;

  SELECT property.timezone
    INTO v_timezone
    FROM public.org_node AS property
   WHERE property.tenant_id = p_tenant
     AND property.id = p_property
     AND property.kind = 'property';
  IF NOT FOUND OR v_timezone IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'housekeeping sheet target is unavailable';
  END IF;

  IF p_mode = 'generate' THEN
    PERFORM 1
      FROM public.app_user AS actor
     WHERE actor.tenant_id = p_tenant
       AND actor.id = p_actor
       AND actor.status = 'active';
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = '55000',
        MESSAGE = 'housekeeping sheet target is unavailable';
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
        MESSAGE = 'housekeeping sheet target is unavailable';
    END IF;

    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'housekeeping-sheet:' || p_tenant::text || ':' || p_property::text || ':' || p_sheet_date::text,
        202
      )
    );
  END IF;

  WITH day_bounds AS MATERIALIZED (
    SELECT (p_sheet_date::timestamp AT TIME ZONE v_timezone) AS starts_at,
           ((p_sheet_date + 1)::timestamp AT TIME ZONE v_timezone) AS ends_at
  ), occupied AS MATERIALIZED (
    SELECT room.id AS space_id,
           room.code AS space_code,
           room.floor,
           room.profile_key,
           pg_catalog.min(pg_catalog.lower(segment.period)) AS arrival_at,
           pg_catalog.max(pg_catalog.upper(segment.period)) AS departure_at,
           pg_catalog.bool_or(
             (pg_catalog.upper(segment.period) AT TIME ZONE v_timezone)::date = p_sheet_date
           ) AS departs_on_sheet_date
      FROM public.space AS room
      JOIN public.space_occupancy AS occupancy
        ON occupancy.tenant_id = room.tenant_id
       AND occupancy.space_id = room.id
       AND occupancy.slot_kind = 'segment'
      JOIN public.reservation_segment AS segment
        ON segment.tenant_id = occupancy.tenant_id
       AND segment.id = occupancy.slot_ref
       AND segment.status = 'in_house'
      JOIN public.reservation AS reservation
        ON reservation.tenant_id = segment.tenant_id
       AND reservation.id = segment.reservation_id
       AND reservation.property_node = room.property_node
       AND reservation.status = 'in_house'
      CROSS JOIN day_bounds
     WHERE room.tenant_id = p_tenant
       AND room.property_node = p_property
       AND room.status = 'active'
       AND occupancy.period && pg_catalog.tstzrange(day_bounds.starts_at, day_bounds.ends_at, '[)')
       AND segment.period && pg_catalog.tstzrange(day_bounds.starts_at, day_bounds.ends_at, '[)')
     GROUP BY room.id, room.code, room.floor, room.profile_key
  ), profile_candidates AS MATERIALIZED (
    SELECT occupied.*,
           profile.id AS profile_id,
           profile.content ->> 'housekeeping_cadence' AS cadence,
           CASE WHEN profile.tenant_id = p_tenant THEN 1 ELSE 0 END AS precedence
      FROM occupied
      LEFT JOIN public.extension AS profile
        ON profile.type = 'vertical_profile'
       AND profile.key = occupied.profile_key
       AND profile.status = 'active'
       AND profile.effective @> pg_catalog.transaction_timestamp()
       AND (profile.tenant_id = p_tenant OR profile.tenant_id IS NULL)
  ), winning_precedence AS MATERIALIZED (
    SELECT space_id, pg_catalog.max(precedence) AS precedence
      FROM profile_candidates
     WHERE profile_id IS NOT NULL
     GROUP BY space_id
  ), resolved AS MATERIALIZED (
    SELECT candidate.space_id,
           candidate.space_code,
           candidate.floor,
           candidate.profile_key,
           candidate.arrival_at,
           candidate.departure_at,
           candidate.departs_on_sheet_date,
           pg_catalog.count(candidate.profile_id) FILTER (
             WHERE candidate.precedence = winning.precedence
           )::integer AS profile_count,
           pg_catalog.min(candidate.cadence) FILTER (
             WHERE candidate.precedence = winning.precedence
           ) AS cadence
      FROM profile_candidates AS candidate
      LEFT JOIN winning_precedence AS winning ON winning.space_id = candidate.space_id
     GROUP BY candidate.space_id, candidate.space_code, candidate.floor,
              candidate.profile_key, candidate.arrival_at, candidate.departure_at,
              candidate.departs_on_sheet_date
  )
  SELECT pg_catalog.count(*)::integer,
         pg_catalog.count(*) FILTER (WHERE profile_count <> 1 OR cadence IS NULL)::integer,
         pg_catalog.count(DISTINCT cadence) FILTER (WHERE profile_count = 1)::integer,
         pg_catalog.count(*) FILTER (
           WHERE profile_count = 1 AND cadence NOT IN ('daily', 'on_departure')
         )::integer,
         COALESCE(
           pg_catalog.jsonb_agg(
             pg_catalog.jsonb_build_object(
               'space_id', space_id,
               'space_code', space_code,
               'floor', floor,
               'profile_key', profile_key,
               'cadence', cadence,
               'arrival_at', arrival_at,
               'departure_at', departure_at
             ) ORDER BY space_code, space_id
           ) FILTER (
             WHERE profile_count = 1
               AND (cadence = 'daily' OR (cadence = 'on_departure' AND departs_on_sheet_date))
           ),
           '[]'::jsonb
         )
    INTO v_room_count, v_bad_profile_count, v_cadence_count, v_unsupported_count, v_candidates
    FROM resolved;

  IF v_bad_profile_count <> 0 OR v_unsupported_count <> 0 OR v_cadence_count > 1 THEN
    RAISE EXCEPTION USING ERRCODE = '0A000',
      MESSAGE = 'housekeeping cadence is unsupported for this property date';
  END IF;

  IF p_mode = 'preview' THEN
    SELECT COALESCE(pg_catalog.jsonb_agg(candidate.value ORDER BY candidate.ordinality), '[]'::jsonb)
      INTO v_candidates
      FROM pg_catalog.jsonb_array_elements(v_candidates) WITH ORDINALITY AS candidate(value, ordinality)
     WHERE candidate.ordinality <= p_limit;
    RETURN QUERY SELECT NULL::uuid, p_sheet_date, NULL::uuid, false, v_candidates;
    RETURN;
  END IF;

  IF pg_catalog.jsonb_array_length(v_candidates) = 0 THEN
    RAISE EXCEPTION USING ERRCODE = '55001',
      MESSAGE = 'housekeeping sheet has no eligible rooms for this property date';
  END IF;

  v_sheet_id := (
    pg_catalog.substr(pg_catalog.md5(
      'yellow:housekeeping-sheet:' || p_tenant::text || ':' || p_property::text || ':' || p_sheet_date::text
    ), 1, 8) || '-' ||
    pg_catalog.substr(pg_catalog.md5(
      'yellow:housekeeping-sheet:' || p_tenant::text || ':' || p_property::text || ':' || p_sheet_date::text
    ), 9, 4) || '-5' ||
    pg_catalog.substr(pg_catalog.md5(
      'yellow:housekeeping-sheet:' || p_tenant::text || ':' || p_property::text || ':' || p_sheet_date::text
    ), 14, 3) || '-a' ||
    pg_catalog.substr(pg_catalog.md5(
      'yellow:housekeeping-sheet:' || p_tenant::text || ':' || p_property::text || ':' || p_sheet_date::text
    ), 18, 3) || '-' ||
    pg_catalog.substr(pg_catalog.md5(
      'yellow:housekeeping-sheet:' || p_tenant::text || ':' || p_property::text || ':' || p_sheet_date::text
    ), 21, 12)
  )::uuid;

  SELECT existing.attendant_party
    INTO v_existing_attendant
    FROM public.task_sheet AS existing
   WHERE existing.tenant_id = p_tenant
     AND existing.property_node = p_property
     AND existing.sheet_date = p_sheet_date
   FOR UPDATE;

  IF FOUND THEN
    IF v_existing_attendant IS DISTINCT FROM p_attendant THEN
      RAISE EXCEPTION USING ERRCODE = '23505',
        MESSAGE = 'housekeeping sheet already belongs to another attendant';
    END IF;
  ELSE
    INSERT INTO public.task_sheet (
      id, tenant_id, property_node, sheet_date, attendant_party, target_credits
    ) VALUES (
      v_sheet_id, p_tenant, p_property, p_sheet_date, p_attendant, NULL
    );
    v_created := true;

    INSERT INTO public.task (
      id, tenant_id, property_node, kind, status, subject_type, subject_id,
      assignee_party, department, due_at, priority, credits, sheet_id, payload
    )
    SELECT (
             pg_catalog.substr(pg_catalog.md5(
               'yellow:housekeeping-task:' || p_tenant::text || ':' || p_property::text || ':' ||
               p_sheet_date::text || ':' || (candidate.value ->> 'space_id')
             ), 1, 8) || '-' ||
             pg_catalog.substr(pg_catalog.md5(
               'yellow:housekeeping-task:' || p_tenant::text || ':' || p_property::text || ':' ||
               p_sheet_date::text || ':' || (candidate.value ->> 'space_id')
             ), 9, 4) || '-5' ||
             pg_catalog.substr(pg_catalog.md5(
               'yellow:housekeeping-task:' || p_tenant::text || ':' || p_property::text || ':' ||
               p_sheet_date::text || ':' || (candidate.value ->> 'space_id')
             ), 14, 3) || '-a' ||
             pg_catalog.substr(pg_catalog.md5(
               'yellow:housekeeping-task:' || p_tenant::text || ':' || p_property::text || ':' ||
               p_sheet_date::text || ':' || (candidate.value ->> 'space_id')
             ), 18, 3) || '-' ||
             pg_catalog.substr(pg_catalog.md5(
               'yellow:housekeeping-task:' || p_tenant::text || ':' || p_property::text || ':' ||
               p_sheet_date::text || ':' || (candidate.value ->> 'space_id')
             ), 21, 12)
           )::uuid,
           p_tenant,
           p_property,
           'housekeeping',
           'assigned',
           'space',
           (candidate.value ->> 'space_id')::uuid,
           p_attendant,
           'Housekeeping',
           NULL,
           3,
           NULL,
           v_sheet_id,
           pg_catalog.jsonb_build_object(
             'sheet_id', v_sheet_id,
             'sheet_date', p_sheet_date,
             'profile_key', candidate.value ->> 'profile_key',
             'cadence', candidate.value ->> 'cadence',
             'attendant_party_id', p_attendant
           )
      FROM pg_catalog.jsonb_array_elements(v_candidates) AS candidate(value);
  END IF;

  SELECT COALESCE(
           pg_catalog.jsonb_agg(
             pg_catalog.jsonb_build_object(
               'task_id', task.id,
               'space_id', room.id,
               'space_code', room.code,
               'profile_key', task.payload ->> 'profile_key',
               'cadence', task.payload ->> 'cadence'
             ) ORDER BY room.code, room.id
           ),
           '[]'::jsonb
         )
    INTO v_candidates
    FROM public.task AS task
    JOIN public.space AS room
      ON room.tenant_id = task.tenant_id
     AND room.id = task.subject_id
     AND room.property_node = task.property_node
   WHERE task.tenant_id = p_tenant
     AND task.property_node = p_property
     AND task.sheet_id = v_sheet_id
     AND task.kind = 'housekeeping'
     AND task.subject_type = 'space';

  RETURN QUERY SELECT v_sheet_id, p_sheet_date, p_attendant, v_created, v_candidates;
END;
$$;


--
-- Name: initialize_unit_condition(uuid, uuid, uuid, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.initialize_unit_condition(p_tenant uuid, p_property uuid, p_space uuid, p_condition text, p_actor uuid) RETURNS TABLE(space_id uuid, room_condition text, room_updated_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'pg_temp'
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


--
-- Name: link_tax_attribution_reservation(uuid, uuid, uuid, uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.link_tax_attribution_reservation(p_tenant_id uuid, p_property_node uuid, p_actor_id uuid, p_hold_id uuid, p_reservation_id uuid, p_segment_id uuid) RETURNS TABLE(lineage_id uuid, binding_id uuid, hold_id uuid, attribution_id uuid, reservation_id uuid, segment_id uuid, origin_quote_hash text, snapshot_hash text, currency character, linked_by uuid, linked_at timestamp with time zone, created boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'pg_temp'
    AS $$
DECLARE
  v_context_tenant uuid;
  v_binding public.tax_attribution_hold_binding%ROWTYPE;
  v_existing public.tax_attribution_reservation_binding%ROWTYPE;
  v_hold public.hold%ROWTYPE;
  v_reservation public.reservation%ROWTYPE;
  v_segment public.reservation_segment%ROWTYPE;
  v_created public.tax_attribution_reservation_binding%ROWTYPE;
BEGIN
  IF session_user <> 'yellow_runtime'
     OR pg_catalog.current_setting('role', true) IS DISTINCT FROM 'app_role'
     OR current_user <> 'yellow_owner' THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'tax attribution reservation linkage requires the governed runtime app role';
  END IF;

  BEGIN
    v_context_tenant := NULLIF(
      pg_catalog.current_setting('app.tenant_id', true), ''
    )::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'tax attribution reservation linkage tenant context is invalid';
  END;
  IF v_context_tenant IS NULL OR p_tenant_id IS NULL
     OR v_context_tenant <> p_tenant_id THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'tax attribution reservation linkage tenant context is invalid';
  END IF;

  IF p_property_node IS NULL OR p_actor_id IS NULL OR p_hold_id IS NULL
     OR p_reservation_id IS NULL OR p_segment_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'tax attribution reservation linkage identity is invalid';
  END IF;

  SELECT binding.*
    INTO v_binding
    FROM public.tax_attribution_hold_binding AS binding
   WHERE binding.tenant_id = p_tenant_id
     AND binding.hold_id = p_hold_id
   FOR KEY SHARE;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  IF v_binding.property_node IS DISTINCT FROM p_property_node THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'quoted-tax hold binding is unavailable for reservation linkage';
  END IF;

  PERFORM 1
    FROM public.tenant
   WHERE tenant.id = p_tenant_id
     AND tenant.status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'tax attribution reservation linkage authority is unavailable';
  END IF;
  PERFORM 1
    FROM public.org_node AS property
   WHERE property.tenant_id = p_tenant_id
     AND property.id = p_property_node
     AND property.kind = 'property';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'tax attribution reservation linkage authority is unavailable';
  END IF;
  PERFORM 1
    FROM public.app_user AS actor
   WHERE actor.tenant_id = p_tenant_id
     AND actor.id = p_actor_id
     AND actor.status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'tax attribution reservation linkage authority is unavailable';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'tax-attribution-reservation-binding:' || p_tenant_id::text || ':' ||
      v_binding.id::text,
      252
    )
  );

  SELECT lineage.*
    INTO v_existing
    FROM public.tax_attribution_reservation_binding AS lineage
   WHERE lineage.tenant_id = p_tenant_id
     AND lineage.binding_id = v_binding.id;
  IF FOUND THEN
    IF v_existing.property_node IS DISTINCT FROM p_property_node
       OR v_existing.linked_by IS DISTINCT FROM p_actor_id
       OR v_existing.hold_id IS DISTINCT FROM p_hold_id
       OR v_existing.reservation_id IS DISTINCT FROM p_reservation_id
       OR v_existing.segment_id IS DISTINCT FROM p_segment_id THEN
      RAISE EXCEPTION USING ERRCODE = '23505',
        MESSAGE = 'quoted-tax hold binding already has divergent reservation lineage';
    END IF;
    RETURN QUERY SELECT
      v_existing.id, v_existing.binding_id, v_existing.hold_id,
      v_existing.attribution_id, v_existing.reservation_id,
      v_existing.segment_id, v_existing.origin_quote_hash,
      v_existing.snapshot_hash, v_existing.currency,
      v_existing.linked_by, v_existing.linked_at, false;
    RETURN;
  END IF;

  SELECT hold.*
    INTO v_hold
    FROM public.hold
   WHERE hold.tenant_id = p_tenant_id
     AND hold.id = p_hold_id
     AND hold.property_node = p_property_node
     AND hold.status = 'consumed'
     AND hold.sellable_unit_id = v_binding.sellable_unit_id
     AND hold.period = v_binding.period
   FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'consumed quoted-tax hold is unavailable for reservation linkage';
  END IF;

  SELECT reservation.*
    INTO v_reservation
    FROM public.reservation
   WHERE reservation.tenant_id = p_tenant_id
     AND reservation.id = p_reservation_id
     AND reservation.property_node = p_property_node
     AND reservation.status = 'reserved'
     AND reservation.currency = v_binding.currency
   FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'reserved reservation is unavailable for quoted-tax lineage';
  END IF;

  SELECT segment.*
    INTO v_segment
    FROM public.reservation_segment AS segment
   WHERE segment.tenant_id = p_tenant_id
     AND segment.id = p_segment_id
     AND segment.reservation_id = p_reservation_id
     AND segment.status = 'booked'
     AND segment.sellable_unit_id = v_binding.sellable_unit_id
     AND segment.period = v_binding.period
   FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'booked reservation segment is unavailable for quoted-tax lineage';
  END IF;

  INSERT INTO public.tax_attribution_reservation_binding (
    tenant_id, property_node, linked_by, binding_id, hold_id, attribution_id,
    reservation_id, segment_id, sellable_unit_id, period,
    origin_quote_hash, snapshot_hash, currency
  ) VALUES (
    p_tenant_id, p_property_node, p_actor_id, v_binding.id,
    v_binding.hold_id, v_binding.attribution_id, p_reservation_id, p_segment_id,
    v_binding.sellable_unit_id, v_binding.period, v_binding.origin_quote_hash,
    v_binding.snapshot_hash, v_binding.currency
  )
  RETURNING * INTO v_created;

  RETURN QUERY SELECT
    v_created.id, v_created.binding_id, v_created.hold_id,
    v_created.attribution_id, v_created.reservation_id,
    v_created.segment_id, v_created.origin_quote_hash,
    v_created.snapshot_hash, v_created.currency,
    v_created.linked_by, v_created.linked_at, true;
END;
$$;


--
-- Name: lock_and_revoke_hosted_payment_requests(uuid, uuid, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lock_and_revoke_hosted_payment_requests(p_tenant uuid, p_folio uuid, p_revoked_at timestamp with time zone) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'pg_temp'
    AS $$
DECLARE v_context uuid; v_generation integer;
BEGIN
  IF pg_catalog.current_setting('role', true) IS DISTINCT FROM 'app_role' THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='hosted request lock requires app_role';
  END IF;
  BEGIN
    v_context := NULLIF(pg_catalog.current_setting('app.tenant_id', true), '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='hosted request tenant context is invalid';
  END;
  IF v_context IS NULL OR v_context <> p_tenant OR p_folio IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='hosted request tenant context is invalid';
  END IF;
  PERFORM 1 FROM public.folio WHERE tenant_id=p_tenant AND id=p_folio FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000', MESSAGE='folio is unavailable'; END IF;
  SELECT COALESCE(max(generation),0)+1 INTO v_generation
    FROM public.hosted_payment_request WHERE tenant_id=p_tenant AND folio_id=p_folio;
  UPDATE public.hosted_payment_request SET revoked_at=p_revoked_at
   WHERE tenant_id=p_tenant AND folio_id=p_folio AND revoked_at IS NULL AND expires_at>p_revoked_at;
  RETURN v_generation;
END;
$$;


--
-- Name: lock_financial_business_days(uuid, uuid, date[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lock_financial_business_days(p_tenant uuid, p_property uuid, p_dates date[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'pg_temp'
    AS $$
DECLARE
  v_context_tenant uuid;
  v_requested_dates integer;
  v_locked_dates integer;
BEGIN
  IF pg_catalog.current_setting('role', true) IS DISTINCT FROM 'app_role' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'financial business-day lock requires app_role';
  END IF;

  BEGIN
    v_context_tenant := NULLIF(
      pg_catalog.current_setting('app.tenant_id', true), ''
    )::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'financial business-day lock tenant context is invalid';
  END;
  IF v_context_tenant IS NULL OR p_tenant IS NULL OR v_context_tenant <> p_tenant THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'financial business-day lock tenant context is invalid';
  END IF;

  v_requested_dates := pg_catalog.cardinality(p_dates);
  IF p_property IS NULL OR v_requested_dates IS NULL
     OR v_requested_dates < 1 OR v_requested_dates > 2
     OR EXISTS (
       SELECT 1 FROM pg_catalog.unnest(p_dates) AS requested(value)
       WHERE requested.value IS NULL OR NOT pg_catalog.isfinite(requested.value)
     )
     OR (
       SELECT pg_catalog.count(DISTINCT requested.value)
       FROM pg_catalog.unnest(p_dates) AS requested(value)
     ) <> v_requested_dates THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'financial business-day lock target set is invalid';
  END IF;

  SELECT pg_catalog.count(*)::integer INTO v_locked_dates
  FROM (
    SELECT day.business_date
    FROM public.business_day AS day
    WHERE day.tenant_id = p_tenant
      AND day.property_node = p_property
      AND day.business_date = ANY (p_dates)
    ORDER BY day.business_date
    FOR SHARE
  ) AS locked;
  IF v_locked_dates <> v_requested_dates THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'financial business-day lock targets are unavailable';
  END IF;
END;
$$;


--
-- Name: lock_financial_rows(uuid, uuid[], uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lock_financial_rows(p_tenant uuid, p_account_ids uuid[], p_folio_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'pg_temp'
    AS $$
DECLARE
  v_context_tenant uuid;
  v_requested_accounts integer;
  v_locked_accounts integer;
  v_locked_folios integer;
BEGIN
  IF pg_catalog.current_setting('role', true) IS DISTINCT FROM 'app_role' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'financial row lock requires app_role';
  END IF;

  BEGIN
    v_context_tenant := NULLIF(
      pg_catalog.current_setting('app.tenant_id', true), ''
    )::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'financial row lock tenant context is invalid';
  END;
  IF v_context_tenant IS NULL OR p_tenant IS NULL OR v_context_tenant <> p_tenant THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'financial row lock tenant context is invalid';
  END IF;

  v_requested_accounts := pg_catalog.cardinality(p_account_ids);
  IF v_requested_accounts IS NULL OR v_requested_accounts < 1 OR v_requested_accounts > 2
     OR EXISTS (SELECT 1 FROM pg_catalog.unnest(p_account_ids) AS requested(id) WHERE id IS NULL)
     OR (SELECT pg_catalog.count(DISTINCT requested.id) FROM pg_catalog.unnest(p_account_ids) AS requested(id))
        <> v_requested_accounts THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'financial row lock account set is invalid';
  END IF;

  SELECT pg_catalog.count(*)::integer INTO v_locked_accounts
  FROM (
    SELECT account.id
    FROM public.account AS account
    WHERE account.tenant_id = p_tenant
      AND account.id = ANY (p_account_ids)
    ORDER BY account.id
    FOR UPDATE
  ) AS locked;
  IF v_locked_accounts <> v_requested_accounts THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'financial row lock targets are unavailable';
  END IF;

  IF p_folio_id IS NOT NULL THEN
    SELECT pg_catalog.count(*)::integer INTO v_locked_folios
    FROM (
      SELECT folio.id
      FROM public.folio AS folio
      WHERE folio.tenant_id = p_tenant
        AND folio.id = p_folio_id
        AND folio.account_id = ANY (p_account_ids)
      FOR UPDATE
    ) AS locked;
    IF v_locked_folios <> 1 THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'financial row lock targets are unavailable';
    END IF;
  END IF;
END;
$$;


--
-- Name: lock_payment_operation(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lock_payment_operation(p_tenant uuid, p_operation uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'pg_temp'
    AS $$
DECLARE
  v_context uuid;
BEGIN
  IF pg_catalog.current_setting('role', true) IS DISTINCT FROM 'app_role' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'payment operation lock requires app_role';
  END IF;
  BEGIN
    v_context := NULLIF(pg_catalog.current_setting('app.tenant_id', true), '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'payment operation tenant context is invalid';
  END;
  IF v_context IS NULL OR p_tenant IS NULL OR p_operation IS NULL OR v_context <> p_tenant THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'payment operation tenant context is invalid';
  END IF;
  PERFORM 1 FROM public.payment_operation
   WHERE tenant_id = p_tenant AND id = p_operation
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'payment operation is unavailable';
  END IF;
END;
$$;


--
-- Name: lock_positive_tax_posting_rows(uuid, uuid[], uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lock_positive_tax_posting_rows(p_tenant_id uuid, p_account_ids uuid[], p_folio_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'pg_temp'
    AS $$
DECLARE
  v_context_tenant uuid;
  v_requested_accounts integer;
  v_locked_accounts integer;
  v_locked_folios integer;
BEGIN
  IF session_user <> 'yellow_runtime'
     OR pg_catalog.current_setting('role', true) IS DISTINCT FROM 'app_role'
     OR current_user <> 'yellow_owner' THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'positive-tax posting lock requires the governed runtime app role';
  END IF;

  BEGIN
    v_context_tenant := NULLIF(
      pg_catalog.current_setting('app.tenant_id', true), ''
    )::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'positive-tax posting lock tenant context is invalid';
  END;
  IF v_context_tenant IS NULL OR p_tenant_id IS NULL
     OR v_context_tenant <> p_tenant_id THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'positive-tax posting lock tenant context is invalid';
  END IF;

  v_requested_accounts := pg_catalog.cardinality(p_account_ids);
  IF p_folio_id IS NULL OR v_requested_accounts IS NULL
     OR v_requested_accounts < 2 OR v_requested_accounts > 66
     OR EXISTS (
       SELECT 1
         FROM pg_catalog.unnest(p_account_ids) AS requested(id)
        WHERE requested.id IS NULL
     )
     OR (
       SELECT pg_catalog.count(DISTINCT requested.id)
         FROM pg_catalog.unnest(p_account_ids) AS requested(id)
     ) <> v_requested_accounts THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'positive-tax posting lock account set is invalid';
  END IF;

  SELECT pg_catalog.count(*)::integer
    INTO v_locked_accounts
    FROM (
      SELECT account.id
        FROM public.account AS account
       WHERE account.tenant_id = p_tenant_id
         AND account.id = ANY (p_account_ids)
         AND account.status = 'open'
         AND account.role IN ('guest', 'revenue', 'tax_payable')
       ORDER BY account.id
       FOR UPDATE
    ) AS locked;
  IF v_locked_accounts <> v_requested_accounts THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'positive-tax posting lock targets are unavailable';
  END IF;

  SELECT pg_catalog.count(*)::integer
    INTO v_locked_folios
    FROM (
      SELECT folio.id
        FROM public.folio AS folio
        JOIN public.account AS account
          ON account.tenant_id = folio.tenant_id
         AND account.id = folio.account_id
       WHERE folio.tenant_id = p_tenant_id
         AND folio.id = p_folio_id
         AND folio.account_id = ANY (p_account_ids)
         AND folio.window_no = 1
         AND folio.status = 'open'
         AND account.role = 'guest'
         AND account.status = 'open'
       FOR UPDATE OF folio
    ) AS locked;
  IF v_locked_folios <> 1 THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'positive-tax posting lock targets are unavailable';
  END IF;
END;
$$;


--
-- Name: open_cashier_session(uuid, uuid, uuid, uuid, bigint[], bigint[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.open_cashier_session(p_tenant uuid, p_property uuid, p_drawer uuid, p_actor uuid, p_denomination_units bigint[], p_quantities bigint[]) RETURNS TABLE(session_id uuid, count_id uuid, business_date date, currency character, expected_minor bigint, counted_minor bigint, opened_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'pg_temp'
    AS $$
DECLARE
  v_context_tenant uuid;
  v_currency character(3);
  v_business_date date;
  v_line_count integer;
  v_active_count integer;
  v_total_numeric numeric;
  v_total bigint;
  v_session_id uuid := pg_catalog.gen_random_uuid();
  v_count_id uuid := pg_catalog.gen_random_uuid();
  v_opened_at timestamptz := pg_catalog.transaction_timestamp();
BEGIN
  IF session_user <> 'yellow_runtime'
     OR pg_catalog.current_setting('role', true) IS DISTINCT FROM 'app_role'
     OR current_user <> 'yellow_owner' THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'cashier open requires the governed runtime app role';
  END IF;

  BEGIN
    v_context_tenant := NULLIF(
      pg_catalog.current_setting('app.tenant_id', true), ''
    )::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'cashier open tenant context is invalid';
  END;
  IF v_context_tenant IS NULL OR p_tenant IS NULL
     OR v_context_tenant <> p_tenant THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'cashier open tenant context is invalid';
  END IF;

  v_line_count := pg_catalog.cardinality(p_denomination_units);
  IF p_property IS NULL OR p_drawer IS NULL OR p_actor IS NULL
     OR v_line_count IS NULL OR v_line_count < 1 OR v_line_count > 50
     OR v_line_count <> pg_catalog.cardinality(p_quantities)
     OR pg_catalog.array_ndims(p_denomination_units) <> 1
     OR pg_catalog.array_ndims(p_quantities) <> 1
     OR pg_catalog.array_lower(p_denomination_units, 1) <> 1
     OR pg_catalog.array_lower(p_quantities, 1) <> 1
     OR EXISTS (
       SELECT 1
       FROM pg_catalog.generate_subscripts(p_denomination_units, 1) AS line(i)
       WHERE p_denomination_units[line.i] IS NULL
          OR p_quantities[line.i] IS NULL
          OR p_denomination_units[line.i] <= 0
          OR p_quantities[line.i] < 0
     )
     OR (
       SELECT pg_catalog.count(DISTINCT p_denomination_units[line.i])
       FROM pg_catalog.generate_subscripts(p_denomination_units, 1) AS line(i)
     ) <> v_line_count THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'cashier count input is invalid';
  END IF;

  SELECT property.currency,
         (pg_catalog.transaction_timestamp() AT TIME ZONE property.timezone)::date
    INTO v_currency, v_business_date
    FROM public.org_node AS property
   WHERE property.tenant_id = p_tenant
     AND property.id = p_property
     AND property.kind = 'property'
     AND property.currency IS NOT NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'cashier property is unavailable';
  END IF;

  -- Canonical lifecycle lock order: current property-local day, drawer,
  -- session, then count rows. The day lock is read-only and never seals it.
  PERFORM 1
    FROM public.business_day AS day
   WHERE day.tenant_id = p_tenant
     AND day.property_node = p_property
     AND day.business_date = v_business_date
     AND day.sealed_at IS NULL
   FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'cashier business day is unavailable';
  END IF;

  PERFORM 1
    FROM public.cash_drawer AS drawer
    JOIN public.account AS account
      ON account.tenant_id = drawer.tenant_id
     AND account.property_node = drawer.property_node
     AND account.currency = drawer.currency
     AND account.id = drawer.account_id
   WHERE drawer.tenant_id = p_tenant
     AND drawer.id = p_drawer
     AND drawer.property_node = p_property
     AND drawer.currency = v_currency
     AND drawer.active
     AND account.role = 'cash'
     AND account.status = 'open'
   FOR UPDATE OF drawer;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'cashier drawer is unavailable';
  END IF;

  PERFORM 1
    FROM public.app_user AS actor
   WHERE actor.tenant_id = p_tenant
     AND actor.id = p_actor
     AND actor.status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'cashier actor is unavailable';
  END IF;

  SELECT pg_catalog.count(*)::integer
    INTO v_active_count
    FROM public.cash_drawer_denomination AS denomination
   WHERE denomination.tenant_id = p_tenant
     AND denomination.drawer_id = p_drawer
     AND denomination.active;
  IF v_active_count <> v_line_count OR EXISTS (
    SELECT 1
      FROM pg_catalog.generate_subscripts(p_denomination_units, 1) AS line(i)
      LEFT JOIN public.cash_drawer_denomination AS denomination
        ON denomination.tenant_id = p_tenant
       AND denomination.drawer_id = p_drawer
       AND denomination.unit_minor = p_denomination_units[line.i]
       AND denomination.active
     WHERE denomination.unit_minor IS NULL
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'cashier count denominations are invalid';
  END IF;

  SELECT pg_catalog.sum(
           p_denomination_units[line.i]::numeric
           * p_quantities[line.i]::numeric
         )
    INTO v_total_numeric
    FROM pg_catalog.generate_subscripts(p_denomination_units, 1) AS line(i);
  IF v_total_numeric IS NULL OR v_total_numeric < 0::numeric
     OR v_total_numeric > 9223372036854775807::numeric THEN
    RAISE EXCEPTION USING ERRCODE = '22003',
      MESSAGE = 'cashier count total is outside signed int64';
  END IF;
  v_total := v_total_numeric::bigint;

  INSERT INTO public.cashier_session (
    id, tenant_id, property_node, user_id, drawer_id, business_date,
    currency, opening_count_id, expected_minor, opened_at
  ) VALUES (
    v_session_id, p_tenant, p_property, p_actor, p_drawer, v_business_date,
    v_currency, v_count_id, v_total, v_opened_at
  );

  INSERT INTO public.cashier_count (
    tenant_id, id, session_id, drawer_id, kind, attempt_no,
    counted_by, counted_at, total_minor
  ) VALUES (
    p_tenant, v_count_id, v_session_id, p_drawer, 'opening', 0,
    p_actor, v_opened_at, v_total
  );

  INSERT INTO public.cashier_count_line (
    tenant_id, count_id, session_id, drawer_id,
    denomination_minor, quantity, line_total_minor
  )
  SELECT p_tenant, v_count_id, v_session_id, p_drawer,
         p_denomination_units[line.i], p_quantities[line.i],
         (
           p_denomination_units[line.i]::numeric
           * p_quantities[line.i]::numeric
         )::bigint
    FROM pg_catalog.generate_subscripts(p_denomination_units, 1) AS line(i);

  RETURN QUERY SELECT v_session_id, v_count_id, v_business_date,
                      v_currency, v_total, v_total, v_opened_at;
END;
$$;


--
-- Name: open_current_business_day(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.open_current_business_day(p_tenant uuid, p_property uuid) RETURNS TABLE(business_date date, opened_at timestamp with time zone, opened boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'pg_temp'
    AS $_$
DECLARE
  v_context text;
  v_date date;
  v_opened_at timestamptz;
BEGIN
  v_context := pg_catalog.current_setting('app.tenant_id', true);
  IF v_context IS NULL OR v_context !~
      '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      OR v_context::uuid <> p_tenant THEN
    RAISE EXCEPTION 'business-day tenant context is invalid' USING ERRCODE = '42501';
  END IF;
  IF p_property IS NULL THEN
    RAISE EXCEPTION 'business-day property is required' USING ERRCODE = '22023';
  END IF;

  SELECT (pg_catalog.transaction_timestamp() AT TIME ZONE timezone.name)::date
    INTO v_date
    FROM public.tenant AS tenant
    JOIN public.org_node AS property
      ON property.tenant_id = tenant.id
     AND property.id = p_property
     AND property.kind = 'property'
    JOIN pg_catalog.pg_timezone_names AS timezone
      ON timezone.name = property.timezone
   WHERE tenant.id = p_tenant
     AND tenant.status = 'active';

  IF v_date IS NULL THEN
    RAISE EXCEPTION 'active tenant property with valid timezone was not found'
      USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.business_day AS day (tenant_id, property_node, business_date)
  VALUES (p_tenant, p_property, v_date)
  ON CONFLICT DO NOTHING
  RETURNING day.opened_at INTO v_opened_at;

  IF FOUND THEN
    RETURN QUERY SELECT v_date, v_opened_at, true;
    RETURN;
  END IF;

  SELECT day.opened_at INTO v_opened_at
    FROM public.business_day AS day
   WHERE day.tenant_id = p_tenant
     AND day.property_node = p_property
     AND day.business_date = v_date;
  IF v_opened_at IS NULL THEN
    RAISE EXCEPTION 'current business day could not be resolved' USING ERRCODE = '40001';
  END IF;
  RETURN QUERY SELECT v_date, v_opened_at, false;
END
$_$;


--
-- Name: prepare_business_day_discrepancy_carry(uuid, uuid, uuid, date, date, text, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prepare_business_day_discrepancy_carry(p_tenant uuid, p_property uuid, p_discrepancy uuid, p_source date, p_target date, p_reason text, p_request uuid, p_actor uuid) RETURNS TABLE(discrepancy_state_hash text, request_hash text, approval_payload jsonb)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
DECLARE v_context uuid; v_d public.discrepancy%ROWTYPE; v_target public.business_day%ROWTYPE;
 v_lineage record; v_state text; v_hash text; v_reason text; v_tz text;
BEGIN
 IF session_user<>'yellow_runtime' OR current_setting('role',true) IS DISTINCT FROM 'app_role' OR current_user<>'yellow_owner' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='discrepancy carry requires governed runtime'; END IF;
 BEGIN v_context:=nullif(current_setting('app.tenant_id',true),'')::uuid; EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='invalid tenant context'; END;
 v_reason:=btrim(p_reason);
 IF v_context IS NULL OR v_context<>p_tenant OR p_source=p_target OR v_reason IS DISTINCT FROM p_reason OR length(v_reason) NOT BETWEEN 1 AND 500 OR v_reason ~ '[[:cntrl:]]' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid discrepancy carry request'; END IF;
 PERFORM 1 FROM public.app_user u JOIN public.user_role ur ON ur.tenant_id=u.tenant_id AND ur.user_id=u.id JOIN public.role_permission rp ON rp.role_id=ur.role_id AND rp.permission_code='financials.business-day:carry-discrepancy' JOIN public.org_node g ON g.tenant_id=ur.tenant_id AND g.id=ur.scope_node JOIN public.org_node property ON property.tenant_id=u.tenant_id AND property.id=p_property AND property.kind='property' AND g.path @> property.path WHERE u.tenant_id=p_tenant AND u.id=p_actor AND u.status='active';
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='discrepancy carry actor is unauthorized'; END IF;
 SELECT timezone INTO v_tz FROM public.org_node WHERE tenant_id=p_tenant AND id=p_property;
 IF v_tz IS NULL OR p_target<>(transaction_timestamp() AT TIME ZONE v_tz)::date THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='target is not the current property business date'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('discrepancy-carry:'||p_tenant||':'||p_discrepancy,351));
 SELECT d.* INTO v_d FROM public.discrepancy d JOIN public.space s ON s.tenant_id=d.tenant_id AND s.id=d.space_id AND s.property_node=p_property WHERE d.tenant_id=p_tenant AND d.id=p_discrepancy AND d.resolved_at IS NULL FOR UPDATE OF d;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='source discrepancy unavailable'; END IF;
 SELECT o.business_date,o.property_node,count(*) OVER() n INTO v_lineage FROM public.outbox o WHERE o.tenant_id=p_tenant AND o.aggregate_type='discrepancy' AND o.aggregate_id=p_discrepancy AND o.event_type='discrepancy.reported';
 IF NOT FOUND OR v_lineage.n<>1 OR v_lineage.property_node<>p_property OR v_lineage.business_date<>p_source THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='canonical discrepancy lineage unavailable'; END IF;
 PERFORM 1 FROM public.business_day WHERE tenant_id=p_tenant AND property_node=p_property AND business_date=p_source AND sealed_at IS NULL FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='source day unavailable'; END IF;
 SELECT * INTO v_target FROM public.business_day WHERE tenant_id=p_tenant AND property_node=p_property AND business_date=p_target AND sealed_at IS NULL FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='target day unavailable'; END IF;
 v_state:=encode(digest(jsonb_build_object('v',1,'tenantId',p_tenant,'discrepancyId',v_d.id,'spaceId',v_d.space_id,'reported',v_d.reported,'systemState',v_d.system_state,'reportedBy',v_d.reported_by,'reportedAt',v_d.reported_at,'resolvedAt',NULL)::text,'sha256'),'hex');
 v_hash:=encode(digest(jsonb_build_object('v',1,'tenantId',p_tenant,'propertyNode',p_property,'discrepancyId',p_discrepancy,'sourceBusinessDate',p_source,'targetBusinessDate',p_target,'reason',v_reason,'discrepancyStateHash',v_state,'targetOpenedAt',v_target.opened_at)::text,'sha256'),'hex');
 RETURN QUERY SELECT v_state,v_hash,jsonb_build_object('propertyNode',p_property::text,'sourceDiscrepancyId',p_discrepancy::text,'sourceBusinessDate',p_source::text,'targetBusinessDate',p_target::text,'reason',v_reason,'discrepancyStateHash',v_state,'requestHash',v_hash,'targetOpenedAt',to_char(v_target.opened_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'));
END $$;


--
-- Name: prepare_owner_trust_expense(uuid, uuid, uuid, bigint, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prepare_owner_trust_expense(p_tenant uuid, p_trust_account uuid, p_actor uuid, p_amount bigint, p_reason text) RETURNS TABLE(property_node uuid, owner_party_id uuid, owner_label text, trust_account_id uuid, trust_account_label text, payable_account_id uuid, currency character, amount_minor bigint, available_before_minor bigint, projected_available_minor bigint, approval_required boolean, approval_payload jsonb)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'pg_temp'
    AS $$
DECLARE
  v_context uuid; v_property uuid; v_owner uuid; v_owner_label text;
  v_trust_label text; v_payable uuid; v_currency char(3);
  v_sum numeric; v_before numeric; v_after numeric;
BEGIN
  IF session_user <> 'yellow_runtime' OR pg_catalog.current_setting('role',true) IS DISTINCT FROM 'app_role'
     OR current_user <> 'yellow_owner' THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='owner trust preparation requires governed runtime app role';
  END IF;
  BEGIN v_context:=NULLIF(pg_catalog.current_setting('app.tenant_id',true),'')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='owner trust tenant context is invalid';
  END;
  IF v_context IS NULL OR p_tenant IS NULL OR v_context<>p_tenant THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='owner trust tenant context is invalid';
  END IF;
  IF p_trust_account IS NULL OR p_actor IS NULL OR p_amount IS NULL OR p_amount<=0
     OR p_reason IS NULL OR pg_catalog.octet_length(p_reason) NOT BETWEEN 1 AND 500
     OR p_reason<>pg_catalog.btrim(p_reason) OR p_reason ~ '[[:cntrl:]]'
     OR p_reason ~ U&'[\200B-\200D\202A-\202E\2060\2066-\2069\FEFF]' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='owner trust expense input is invalid';
  END IF;

  SELECT trust.property_node,trust.party_id,trust.name,trust.currency,owner.display_name
    INTO v_property,v_owner,v_trust_label,v_currency,v_owner_label
    FROM public.account trust
    JOIN public.org_node property ON property.tenant_id=trust.tenant_id
      AND property.id=trust.property_node AND property.kind='property'
    JOIN public.party owner ON owner.tenant_id=trust.tenant_id
      AND owner.id=trust.party_id AND owner.status='active'
    JOIN public.party_role owner_role ON owner_role.tenant_id=owner.tenant_id
      AND owner_role.party_id=owner.id AND owner_role.role='owner'
   WHERE trust.tenant_id=p_tenant AND trust.id=p_trust_account
     AND trust.role='trust' AND trust.status='open';
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='owner trust account is unavailable'; END IF;
  SELECT route.credit_account_id INTO v_payable
    FROM public.tx_code_route route
   WHERE route.tenant_id=p_tenant AND route.property_node=v_property
     AND route.currency=v_currency AND route.tx_code='OWNER_TRUST_EXPENSE'
     AND route.debit_account_id=p_trust_account;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='owner trust route is unavailable'; END IF;

  -- Identical deterministic financial-row lock order to create_owner_trust_expense.
  PERFORM public.lock_financial_rows(p_tenant,ARRAY[p_trust_account,v_payable]::uuid[],NULL);
  PERFORM 1 FROM public.app_user actor
    JOIN public.user_role actor_role ON actor_role.tenant_id=actor.tenant_id
      AND actor_role.user_id=actor.id AND actor_role.scope_node=v_property
    JOIN public.role_permission permission ON permission.role_id=actor_role.role_id
      AND permission.permission_code='financials.trust:post'
   WHERE actor.tenant_id=p_tenant AND actor.id=p_actor AND actor.status='active';
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='owner trust actor is unauthorized'; END IF;
  PERFORM 1 FROM public.account trust
    JOIN public.party owner ON owner.tenant_id=trust.tenant_id
      AND owner.id=trust.party_id AND owner.status='active'
    JOIN public.party_role owner_role ON owner_role.tenant_id=owner.tenant_id
      AND owner_role.party_id=owner.id AND owner_role.role='owner'
    JOIN public.account payable ON payable.tenant_id=trust.tenant_id AND payable.id=v_payable
   WHERE trust.tenant_id=p_tenant AND trust.id=p_trust_account
     AND trust.property_node=v_property AND trust.role='trust' AND trust.status='open'
     AND trust.currency=v_currency AND payable.property_node=v_property
     AND payable.role='payable' AND payable.status='open' AND payable.currency=v_currency
   FOR UPDATE OF trust,payable,owner;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='owner trust route is unavailable'; END IF;
  SELECT COALESCE(pg_catalog.sum(line.amount_minor::numeric),0) INTO v_sum
    FROM public.posting_line line
   WHERE line.tenant_id=p_tenant AND line.account_id=p_trust_account;
  v_before:=-v_sum; v_after:=v_before-p_amount::numeric;
  IF v_before NOT BETWEEN (-9223372036854775808)::numeric AND 9223372036854775807::numeric
     OR v_after NOT BETWEEN (-9223372036854775808)::numeric AND 9223372036854775807::numeric THEN
    RAISE EXCEPTION USING ERRCODE='22003',MESSAGE='owner trust balance is outside signed int64';
  END IF;
  RETURN QUERY SELECT v_property,v_owner,v_owner_label,p_trust_account,v_trust_label,v_payable,
    v_currency,p_amount,v_before::bigint,v_after::bigint,(v_after<0),
    pg_catalog.jsonb_build_object('ownerPartyId',v_owner::text,'trustAccountId',p_trust_account::text,
      'payableAccountId',v_payable::text,'amountMinor',p_amount::text,
      'availableBeforeMinor',v_before::bigint::text,'projectedAvailableMinor',v_after::bigint::text,
      'reason',p_reason);
END $$;


--
-- Name: prune_outbox(interval); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prune_outbox(p_retain interval DEFAULT '30 days'::interval) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'pg_temp'
    AS $$
DECLARE
  n bigint;
BEGIN
  IF p_retain < interval '0' THEN
    RAISE EXCEPTION 'outbox retention must be non-negative'
      USING ERRCODE = '22023';
  END IF;

  WITH gone AS (
    DELETE FROM public.outbox
     WHERE published_at IS NOT NULL
       AND published_at < pg_catalog.now() - p_retain
    RETURNING 1
  )
  SELECT pg_catalog.count(*) INTO n FROM gone;
  RETURN n;
END $$;


--
-- Name: put_reservation_travel(uuid, uuid, uuid, text, boolean, text, text, text, timestamp with time zone, boolean, text, text, text, timestamp with time zone, boolean, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.put_reservation_travel(p_tenant uuid, p_property uuid, p_reservation uuid, p_direction text, p_expected_present boolean, p_expected_mode text, p_expected_carrier text, p_expected_service_no text, p_expected_scheduled_at timestamp with time zone, p_expected_pickup_requested boolean, p_desired_mode text, p_desired_carrier text, p_desired_service_no text, p_desired_scheduled_at timestamp with time zone, p_desired_pickup_requested boolean, p_actor uuid) RETURNS TABLE(travel_id uuid, reservation_status text, previous_mode text, previous_carrier text, previous_service_no text, previous_scheduled_at timestamp with time zone, previous_pickup_requested boolean, current_mode text, current_carrier text, current_service_no text, current_scheduled_at timestamp with time zone, current_pickup_requested boolean, changed boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'pg_temp'
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


--
-- Name: record_india_gst_accommodation_final_component_tax(uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_india_gst_accommodation_final_component_tax(p_tenant uuid, p_property uuid, p_reservation uuid, p_folio uuid, p_applicability uuid, p_request uuid, p_actor uuid, p_expected_tax uuid, p_expected_tax_hash text) RETURNS TABLE(tax_id uuid, generation integer, valuation_id uuid, valuation_generation integer, transaction_value_minor bigint, tax_minor bigint, grand_total_minor bigint, evidence_hash text, created boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $_$
DECLARE
  v_id uuid:=pg_catalog.gen_random_uuid();
  v_app public.india_gst_accommodation_quoted_rate_applicability%ROWTYPE;
  v_valuation public.india_gst_accommodation_final_valuation%ROWTYPE;
  v_linked_valuation public.india_gst_accommodation_final_valuation%ROWTYPE;
  v_lineage public.tax_attribution_reservation_binding%ROWTYPE;
  v_extension public.extension%ROWTYPE;
  v_existing public.india_gst_accommodation_final_component_tax%ROWTYPE;
  v_head public.india_gst_accommodation_final_component_tax%ROWTYPE;
  v_head_count integer; v_valuation_count integer; v_n integer; v_app_n integer;
  v_i integer; v_j integer; v_family_size integer; v_generation integer:=0;
  v_expected_lower integer; v_expected_extension uuid; v_expected_version smallint;
  v_expected_status text; v_expected_content_hash text; v_expected_content jsonb;
  v_expected_from timestamptz; v_expected_to timestamptz; v_expected_identities text[];
  v_order341_json text; v_quoted_json text; v_lineage_json text; v_selected_from_json text; v_selected_to_json text;
  v_room_json text:='['; v_night_component_json text; v_component_json text;
  v_evidence_hash text; v_total numeric:=0; v_tax numeric:=0; v_grand numeric;
  v_value numeric; v_night_tax numeric; v_component_tax numeric; v_product numeric;
  v_slab bigint; v_bps integer; v_itc boolean; v_identity text; v_rate_number text;
  v_room_ordinals integer[]:='{}'; v_room_dates date[]:='{}'; v_room_values bigint[]:='{}';
  v_room_slabs bigint[]:='{}'; v_room_bps integer[]:='{}'; v_room_itc boolean[]:='{}'; v_room_taxes bigint[]:='{}';
  v_component_nights integer[]:='{}'; v_component_ordinals smallint[]:='{}';
  v_component_identities text[]:='{}'; v_component_bps integer[]:='{}'; v_component_taxes bigint[]:='{}';
  v_business_date date; v_fact uuid;
BEGIN
  IF session_user<>'yellow_runtime'
     OR pg_catalog.current_setting('role',true) IS DISTINCT FROM 'app_role'
     OR current_user<>'yellow_owner' THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='final component tax requires governed runtime app role';
  END IF;
  IF p_tenant IS DISTINCT FROM NULLIF(pg_catalog.current_setting('app.tenant_id',true),'')::uuid THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='final component tax tenant context mismatch';
  END IF;
  IF p_tenant IS NULL OR p_property IS NULL OR p_reservation IS NULL OR p_folio IS NULL
     OR p_applicability IS NULL OR p_request IS NULL OR p_actor IS NULL
     OR (p_expected_tax IS NULL)<>(p_expected_tax_hash IS NULL)
     OR (p_expected_tax_hash IS NOT NULL AND p_expected_tax_hash !~ '^[0-9a-f]{64}$') THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='final component tax identity is invalid';
  END IF;
  PERFORM 1 FROM public.tenant WHERE id=p_tenant AND status='active';
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='final component tax tenant unavailable'; END IF;
  PERFORM 1
    FROM public.app_user actor
    JOIN public.user_role ur ON ur.tenant_id=actor.tenant_id AND ur.user_id=actor.id
    JOIN public.role_permission rp ON rp.role_id=ur.role_id AND rp.permission_code='tax-fiscal.india-valuation:finalize'
    JOIN public.org_node grant_node ON grant_node.tenant_id=ur.tenant_id AND grant_node.id=ur.scope_node
    JOIN public.org_node property ON property.tenant_id=actor.tenant_id AND property.id=p_property
      AND property.kind='property' AND grant_node.path @> property.path
   WHERE actor.tenant_id=p_tenant AND actor.id=p_actor AND actor.status='active';
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='actor lacks property fiscal authority'; END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_tenant::text||p_reservation::text||p_folio::text,0));
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('india-final-component-tax:'||p_tenant::text||':'||p_reservation::text||':'||p_folio::text,367));

  SELECT a.* INTO v_app
    FROM public.india_gst_accommodation_quoted_rate_applicability a
   WHERE a.tenant_id=p_tenant AND a.id=p_applicability
     AND a.property_node=p_property AND a.reservation_id=p_reservation AND a.folio_id=p_folio
   FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='approved quoted-rate applicability is unavailable for this scope'; END IF;

  SELECT linked.* INTO v_linked_valuation
    FROM public.india_gst_accommodation_final_valuation linked
   WHERE linked.tenant_id=p_tenant AND linked.id=v_app.final_valuation_id
     AND linked.property_node=p_property AND linked.reservation_id=p_reservation AND linked.folio_id=p_folio
     AND linked.disposition='ordinary_final' AND linked.currency='INR'
     AND linked.transaction_value_minor>0 AND linked.order341_evidence_hash=v_app.evidence_hash
   FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='quoted-rate applicability has lost its approved valuation ancestry'; END IF;

  SELECT pg_catalog.count(*)::integer INTO v_valuation_count
    FROM public.india_gst_accommodation_final_valuation candidate
   WHERE candidate.tenant_id=p_tenant AND candidate.property_node=p_property
     AND candidate.reservation_id=p_reservation AND candidate.folio_id=p_folio
     AND candidate.disposition='ordinary_final' AND candidate.currency='INR'
     AND candidate.transaction_value_minor>0
     AND NOT EXISTS (
       SELECT 1 FROM public.india_gst_accommodation_final_valuation successor
        WHERE successor.tenant_id=candidate.tenant_id AND successor.supersedes_valuation_id=candidate.id
     );
  IF v_valuation_count<>1 THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='exactly one current ordinary-final valuation is required'; END IF;
  SELECT candidate.* INTO v_valuation
    FROM public.india_gst_accommodation_final_valuation candidate
   WHERE candidate.tenant_id=p_tenant AND candidate.property_node=p_property
     AND candidate.reservation_id=p_reservation AND candidate.folio_id=p_folio
     AND candidate.disposition='ordinary_final' AND candidate.currency='INR'
     AND candidate.transaction_value_minor>0
     AND NOT EXISTS (
       SELECT 1 FROM public.india_gst_accommodation_final_valuation successor
        WHERE successor.tenant_id=candidate.tenant_id AND successor.supersedes_valuation_id=candidate.id
     )
   FOR UPDATE;
  IF v_valuation.actor_id<>p_actor OR v_valuation.order341_evidence_hash<>v_app.evidence_hash THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='current valuation does not retain approved applicability and actor ancestry';
  END IF;

  SELECT l.* INTO v_lineage
    FROM public.tax_attribution_reservation_binding l
    JOIN public.tax_attribution_hold_binding b ON b.tenant_id=l.tenant_id AND b.id=l.binding_id
      AND b.hold_id=l.hold_id AND b.attribution_id=l.attribution_id AND b.sellable_unit_id=l.sellable_unit_id
      AND b.period=l.period AND b.origin_quote_hash=l.origin_quote_hash AND b.snapshot_hash=l.snapshot_hash AND b.currency=l.currency
    JOIN public.hold h ON h.tenant_id=l.tenant_id AND h.id=l.hold_id AND h.status='consumed'
      AND h.sellable_unit_id=l.sellable_unit_id AND h.period=l.period
    JOIN public.reservation_segment s ON s.tenant_id=l.tenant_id AND s.id=l.segment_id
      AND s.reservation_id=l.reservation_id AND s.sellable_unit_id=l.sellable_unit_id AND s.period=l.period
    JOIN public.tax_attribution_snapshot a ON a.tenant_id=l.tenant_id AND a.id=l.attribution_id
      AND a.property_node=l.property_node AND a.origin_kind='rate_quote'
      AND a.origin_quote_hash=l.origin_quote_hash AND a.snapshot_hash=l.snapshot_hash AND a.currency='INR'
   WHERE l.tenant_id=p_tenant AND l.id=v_app.reservation_lineage_id AND l.property_node=p_property
     AND l.reservation_id=p_reservation AND l.attribution_id=v_app.attribution_id AND l.currency='INR'
   FOR SHARE OF l,b,h,s,a;
  IF NOT FOUND OR v_app.attribution_snapshot_evidence_hash<>v_lineage.snapshot_hash THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='persisted attribution lineage is stale';
  END IF;
  v_lineage_json:='{"tenantId":"'||p_tenant::text||'","lineageId":"'||v_lineage.id::text
    ||'","holdBindingId":"'||v_lineage.binding_id::text||'","reservationId":"'||p_reservation::text
    ||'","segmentId":"'||v_lineage.segment_id::text||'","folioId":"'||p_folio::text
    ||'","attributionId":"'||v_lineage.attribution_id::text||'","originQuoteHash":"'||v_lineage.origin_quote_hash
    ||'","snapshotHash":"'||v_lineage.snapshot_hash||'","currency":"INR","holdId":"'||v_lineage.hold_id::text
    ||'","sellableUnitId":"'||v_lineage.sellable_unit_id::text||'","period":'||pg_catalog.to_json(v_lineage.period::text)::text||'}';
  IF pg_catalog.encode(public.digest(pg_catalog.convert_to(v_lineage_json,'UTF8'),'sha256'),'hex')<>v_app.reservation_lineage_evidence_hash THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='persisted reservation lineage evidence is stale';
  END IF;

  IF v_app.selected_version_side='predecessor' THEN
    v_expected_extension:='a806f516-fed6-5768-b310-94aa03286adb'; v_expected_version:=1; v_expected_status:='retired';
    v_expected_from:='2022-07-17T18:30:00Z'; v_expected_to:='2025-09-21T18:30:00Z'; v_expected_lower:=1200;
    v_expected_content_hash:='2160e1747afcb3c280f1fd66e55534a5be563a10f277e8fcc178324e51abaa08';
    v_expected_content:='{"country":"IN","price_display":"tax_exclusive","rounding":"document","taxes":[{"code":"GST_ROOM","name":"GST on accommodation","mode":"slab_percent","slab_basis":"transaction_value","applies_to":["room_revenue"],"slabs":[{"upto_minor":750000,"rate":0.12,"itc_eligible":true},{"upto_minor":null,"rate":0.18,"itc_eligible":true}]},{"code":"GST_FNB","name":"GST on F&B (restaurant in hotel)","mode":"percent","rate":0.05,"applies_to":["fnb_revenue"]}]}'::jsonb;
  ELSIF v_app.selected_version_side='successor' THEN
    v_expected_extension:='0b21daf2-ea6e-5568-9c21-69e4d4424574'; v_expected_version:=2; v_expected_status:='active';
    v_expected_from:='2025-09-21T18:30:00Z'; v_expected_to:=NULL; v_expected_lower:=500;
    v_expected_content_hash:='eb323eff707aad1e460b425c87b448d4e924d2eb17499094abad71b33c69a820';
    v_expected_content:='{"country":"IN","price_display":"tax_exclusive","rounding":"document","taxes":[{"code":"GST_ROOM","name":"GST on accommodation","mode":"slab_percent","slab_basis":"transaction_value","applies_to":["room_revenue"],"slabs":[{"upto_minor":750000,"rate":0.05,"itc_eligible":false},{"upto_minor":null,"rate":0.18,"itc_eligible":true}]},{"code":"GST_FNB","name":"GST on F&B (restaurant in hotel)","mode":"percent","rate":0.05,"applies_to":["fnb_revenue"]}]}'::jsonb;
  ELSE RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='persisted selected extension side is invalid'; END IF;
  SELECT e.* INTO v_extension FROM public.extension e
   WHERE e.id=v_expected_extension AND e.tenant_id IS NULL AND e.type='tax_jurisdiction'
     AND e.key='in-gst-lodging' AND e.version=v_expected_version AND e.status=v_expected_status
   FOR SHARE;
  IF NOT FOUND OR v_extension.content<>v_expected_content OR pg_catalog.lower(v_extension.effective)<>v_expected_from
     OR pg_catalog.upper(v_extension.effective) IS DISTINCT FROM v_expected_to
     OR v_app.selected_extension_id<>v_expected_extension OR v_app.selected_extension_version<>v_expected_version
     OR v_app.selected_extension_status<>v_expected_status OR v_app.selected_content_hash<>v_expected_content_hash
     OR v_app.selected_effective_from<>v_expected_from OR v_app.selected_effective_to IS DISTINCT FROM v_expected_to THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='persisted selected extension identity is stale';
  END IF;

  v_expected_identities:=CASE v_app.component_family WHEN 'igst' THEN ARRAY['igst']
    WHEN 'cgst_sgst' THEN ARRAY['cgst','sgst'] WHEN 'cgst_utgst' THEN ARRAY['cgst','utgst'] ELSE NULL END;
  IF v_expected_identities IS NULL THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='persisted component family is invalid'; END IF;
  v_family_size:=pg_catalog.cardinality(v_expected_identities);
  SELECT pg_catalog.count(*)::integer INTO v_app_n
    FROM public.india_gst_accommodation_quoted_rate_applicability_room_night q
   WHERE q.tenant_id=p_tenant AND q.applicability_id=p_applicability;
  IF v_app_n<1 OR v_app_n>366
     OR EXISTS (
       SELECT 1 FROM public.india_gst_accommodation_quoted_rate_applicability_room_night q
        WHERE q.tenant_id=p_tenant AND q.applicability_id=p_applicability
          AND (q.ordinal<0 OR q.ordinal>=v_app_n OR q.currency<>'INR'
            OR (q.quoted_amount_minor<=750000 AND (q.slab_upto_minor IS DISTINCT FROM 750000 OR q.aggregate_rate_basis_points<>v_expected_lower OR q.itc_eligible<>(v_app.selected_version_side='predecessor')))
            OR (q.quoted_amount_minor>750000 AND (q.slab_upto_minor IS NOT NULL OR q.aggregate_rate_basis_points<>1800 OR NOT q.itc_eligible)))
     )
     OR (SELECT pg_catalog.count(*) FROM public.india_gst_accommodation_quoted_rate_component c WHERE c.tenant_id=p_tenant AND c.applicability_id=p_applicability)<>v_app_n*v_family_size
     OR EXISTS (
       SELECT 1 FROM public.india_gst_accommodation_quoted_rate_component c
       JOIN public.india_gst_accommodation_quoted_rate_applicability_room_night q
         ON q.tenant_id=c.tenant_id AND q.applicability_id=c.applicability_id AND q.ordinal=c.room_night_ordinal
        WHERE c.tenant_id=p_tenant AND c.applicability_id=p_applicability
          AND (c.component_ordinal<0 OR c.component_ordinal>=v_family_size
            OR c.component_identity<>v_expected_identities[c.component_ordinal+1]
            OR c.rate_basis_points<>q.aggregate_rate_basis_points/v_family_size)
     ) THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='persisted quoted-rate component evidence is incomplete or stale'; END IF;

  SELECT '['||pg_catalog.string_agg(
    '{"ordinal":"'||q.ordinal::text||'","businessDate":"'||q.business_date::text
    ||'","quotedAmountMinor":"'||q.quoted_amount_minor::text||'","slab":{"uptoMinor":'||coalesce(q.slab_upto_minor::text,'null')
    ||',"aggregateRate":'||CASE q.aggregate_rate_basis_points WHEN 500 THEN '0.05' WHEN 1200 THEN '0.12' WHEN 1800 THEN '0.18' END
    ||',"aggregateRateBasisPoints":'||q.aggregate_rate_basis_points::text||',"itcEligible":'||CASE WHEN q.itc_eligible THEN 'true' ELSE 'false' END
    ||',"components":['||(SELECT pg_catalog.string_agg('{"identity":"'||c.component_identity||'","rate":'
      ||CASE c.rate_basis_points WHEN 250 THEN '0.025' WHEN 500 THEN '0.05' WHEN 600 THEN '0.06' WHEN 900 THEN '0.09' WHEN 1200 THEN '0.12' WHEN 1800 THEN '0.18' END
      ||',"rateBasisPoints":'||c.rate_basis_points::text||'}',',' ORDER BY c.component_ordinal)
      FROM public.india_gst_accommodation_quoted_rate_component c
      WHERE c.tenant_id=q.tenant_id AND c.applicability_id=q.applicability_id AND c.room_night_ordinal=q.ordinal)||']}}',',' ORDER BY q.ordinal)||']'
    INTO v_quoted_json
    FROM public.india_gst_accommodation_quoted_rate_applicability_room_night q
   WHERE q.tenant_id=p_tenant AND q.applicability_id=p_applicability;
  v_selected_from_json:=CASE v_app.selected_version_side WHEN 'predecessor' THEN '2022-07-17T18:30:00.000000Z' ELSE '2025-09-21T18:30:00.000000Z' END;
  v_selected_to_json:=CASE v_app.selected_version_side WHEN 'predecessor' THEN '"2025-09-21T18:30:00.000000Z"' ELSE 'null' END;
  v_order341_json:='{"tenantId":"'||p_tenant::text||'","propertyNode":"'||p_property::text
    ||'","reservationId":"'||p_reservation::text||'","folioId":"'||p_folio::text
    ||'","section14":{"case":"'||v_app.section14_case||'","timeOfSupplyDate":"'||v_app.time_of_supply_date::text
    ||'","selectedVersionSide":"'||v_app.selected_version_side||'","selectedVersion":{"extensionId":"'||v_app.selected_extension_id::text
    ||'","version":'||v_app.selected_extension_version::text||',"status":"'||v_app.selected_extension_status
    ||'","contentHash":"'||v_app.selected_content_hash||'","effectiveFromInstant":"'||v_selected_from_json
    ||'","effectiveToInstant":'||v_selected_to_json||'}},"reservationLineage":{"lineageId":"'||v_lineage.id::text
    ||'","holdBindingId":"'||v_lineage.binding_id::text||'","reservationId":"'||p_reservation::text
    ||'","segmentId":"'||v_lineage.segment_id::text||'","folioId":"'||p_folio::text
    ||'","attributionId":"'||v_lineage.attribution_id::text||'","originQuoteHash":"'||v_lineage.origin_quote_hash
    ||'","snapshotHash":"'||v_lineage.snapshot_hash||'","currency":"INR"},"components":'||v_quoted_json
    ||',"predecessorHashes":{"section14":"'||v_app.section14_evidence_hash||'","levyComponentIdentity":"'||v_app.levy_component_identity_evidence_hash
    ||'","reservationLineage":"'||v_app.reservation_lineage_evidence_hash||'","attributionSnapshot":"'||v_app.attribution_snapshot_evidence_hash||'"}}';
  IF pg_catalog.encode(public.digest(pg_catalog.convert_to(v_order341_json,'UTF8'),'sha256'),'hex')<>v_app.evidence_hash THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='persisted quoted-rate applicability does not byte-match its complete typed result';
  END IF;

  SELECT pg_catalog.count(*)::integer INTO v_n
    FROM public.india_gst_accommodation_valuation_room_night n
   WHERE n.tenant_id=p_tenant AND n.valuation_id=v_valuation.id;
  IF v_n<>v_app_n OR v_n<1 OR v_n>366
     OR EXISTS (
       SELECT 1 FROM public.india_gst_accommodation_valuation_room_night n
       LEFT JOIN public.india_gst_accommodation_quoted_rate_applicability_room_night q
         ON q.tenant_id=n.tenant_id AND q.applicability_id=p_applicability AND q.ordinal=n.ordinal
        WHERE n.tenant_id=p_tenant AND n.valuation_id=v_valuation.id
          AND (n.ordinal<0 OR n.ordinal>=v_n OR n.currency<>'INR' OR n.transaction_value_minor IS NULL
            OR n.transaction_value_minor<=0 OR q.ordinal IS NULL OR q.business_date<>n.business_date)
     ) THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='current valuation room-night evidence is incomplete or stale'; END IF;

  FOR v_i IN 0..v_n-1 LOOP
    SELECT n.transaction_value_minor::numeric,n.business_date INTO v_value,v_business_date
      FROM public.india_gst_accommodation_valuation_room_night n
     WHERE n.tenant_id=p_tenant AND n.valuation_id=v_valuation.id AND n.ordinal=v_i;
    IF v_value<=750000 THEN v_slab:=750000;v_bps:=v_expected_lower;v_itc:=(v_app.selected_version_side='predecessor');
    ELSE v_slab:=NULL;v_bps:=1800;v_itc:=true; END IF;
    v_night_tax:=0; v_night_component_json:='[';
    FOR v_j IN 1..v_family_size LOOP
      v_identity:=v_expected_identities[v_j];
      v_product:=v_value*(v_bps/v_family_size);
      v_component_tax:=pg_catalog.trunc(v_product/10000)+CASE WHEN pg_catalog.mod(v_product,10000)*2>=10000 THEN 1 ELSE 0 END;
      IF v_component_tax NOT BETWEEN 0 AND 9223372036854775807::numeric THEN RAISE EXCEPTION USING ERRCODE='22003',MESSAGE='component tax exceeds signed int64'; END IF;
      v_night_tax:=v_night_tax+v_component_tax;
      v_component_nights:=pg_catalog.array_append(v_component_nights,v_i);
      v_component_ordinals:=pg_catalog.array_append(v_component_ordinals,(v_j-1)::smallint);
      v_component_identities:=pg_catalog.array_append(v_component_identities,v_identity);
      v_component_bps:=pg_catalog.array_append(v_component_bps,v_bps/v_family_size);
      v_component_taxes:=pg_catalog.array_append(v_component_taxes,v_component_tax::bigint);
      v_night_component_json:=v_night_component_json||CASE WHEN v_j>1 THEN ',' ELSE '' END
        ||'{"identity":"'||v_identity||'","rateBasisPoints":'||(v_bps/v_family_size)::text
        ||',"taxMinor":"'||v_component_tax::bigint::text||'"}';
    END LOOP;
    v_night_component_json:=v_night_component_json||']';
    IF v_night_tax>9223372036854775807::numeric THEN RAISE EXCEPTION USING ERRCODE='22003',MESSAGE='room-night tax exceeds signed int64'; END IF;
    v_room_ordinals:=pg_catalog.array_append(v_room_ordinals,v_i);
    v_room_dates:=pg_catalog.array_append(v_room_dates,v_business_date);
    v_room_values:=pg_catalog.array_append(v_room_values,v_value::bigint);
    v_room_slabs:=pg_catalog.array_append(v_room_slabs,v_slab);
    v_room_bps:=pg_catalog.array_append(v_room_bps,v_bps);
    v_room_itc:=pg_catalog.array_append(v_room_itc,v_itc);
    v_room_taxes:=pg_catalog.array_append(v_room_taxes,v_night_tax::bigint);
    v_total:=v_total+v_value; v_tax:=v_tax+v_night_tax;
    v_room_json:=v_room_json||CASE WHEN v_i>0 THEN ',' ELSE '' END
      ||'{"ordinal":"'||v_i::text||'","businessDate":"'||v_business_date::text
      ||'","transactionValueMinor":"'||v_value::bigint::text||'","slab":{"uptoMinor":'||coalesce(v_slab::text,'null')
      ||',"aggregateRateBasisPoints":'||v_bps::text||',"components":'||v_night_component_json
      ||'},"taxMinor":"'||v_night_tax::bigint::text||'"}';
  END LOOP;
  v_room_json:=v_room_json||']';
  IF v_total<>v_valuation.transaction_value_minor OR v_total>9223372036854775807::numeric
     OR v_tax>9223372036854775807::numeric THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='current valuation total does not reconcile to dense room-night evidence';
  END IF;
  v_grand:=v_total+v_tax;
  IF v_grand>9223372036854775807::numeric THEN RAISE EXCEPTION USING ERRCODE='22003',MESSAGE='grand total exceeds signed int64'; END IF;
  v_evidence_hash:=pg_catalog.encode(public.digest(pg_catalog.convert_to(
    '{"tenant":"'||p_tenant::text||'","property":"'||p_property::text||'","reservation":"'||p_reservation::text
    ||'","folio":"'||p_folio::text||'","valuationId":"'||v_valuation.id::text||'","generation":'||v_valuation.generation::text
    ||',"roomNights":'||v_room_json||',"taxMinor":"'||v_tax::bigint::text||'","grandTotalMinor":"'||v_grand::bigint::text
    ||'","predecessorHashes":{"finalValuation":"'||v_valuation.evidence_hash||'","quotedRateApplicability":"'||v_app.evidence_hash
    ||'","section14":"'||v_app.section14_evidence_hash||'","levyComponentIdentity":"'||v_app.levy_component_identity_evidence_hash
    ||'","reservationLineage":"'||v_app.reservation_lineage_evidence_hash||'","attributionSnapshot":"'||v_app.attribution_snapshot_evidence_hash||'"}}','UTF8'),'sha256'),'hex');

  SELECT t.* INTO v_existing FROM public.india_gst_accommodation_final_component_tax t
   WHERE t.tenant_id=p_tenant AND t.request_id=p_request;
  IF FOUND THEN
    IF v_existing.property_node<>p_property OR v_existing.reservation_id<>p_reservation OR v_existing.folio_id<>p_folio
       OR v_existing.applicability_id<>p_applicability OR v_existing.valuation_id<>v_valuation.id
       OR v_existing.valuation_generation<>v_valuation.generation OR v_existing.actor_id<>p_actor
       OR v_existing.transaction_value_minor<>v_total OR v_existing.tax_minor<>v_tax OR v_existing.grand_total_minor<>v_grand
       OR v_existing.evidence_hash<>v_evidence_hash OR v_existing.supersedes_tax_id IS DISTINCT FROM p_expected_tax
       OR v_existing.supersedes_tax_evidence_hash IS DISTINCT FROM p_expected_tax_hash
       OR (SELECT pg_catalog.array_agg(n.ordinal ORDER BY n.ordinal) FROM public.india_gst_accommodation_final_component_tax_room_night n WHERE n.tenant_id=p_tenant AND n.tax_id=v_existing.id) IS DISTINCT FROM v_room_ordinals
       OR (SELECT pg_catalog.array_agg(c.component_identity ORDER BY c.room_night_ordinal,c.component_ordinal) FROM public.india_gst_accommodation_final_component_tax_component c WHERE c.tenant_id=p_tenant AND c.tax_id=v_existing.id) IS DISTINCT FROM v_component_identities THEN
      RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='final component tax request has divergent evidence';
    END IF;
    RETURN QUERY SELECT v_existing.id,v_existing.generation,v_existing.valuation_id,v_existing.valuation_generation,
      v_existing.transaction_value_minor,v_existing.tax_minor,v_existing.grand_total_minor,v_existing.evidence_hash,false;
    RETURN;
  END IF;

  SELECT pg_catalog.count(*)::integer INTO v_head_count
    FROM public.india_gst_accommodation_final_component_tax t
   WHERE t.tenant_id=p_tenant AND t.property_node=p_property AND t.reservation_id=p_reservation AND t.folio_id=p_folio
     AND NOT EXISTS (SELECT 1 FROM public.india_gst_accommodation_final_component_tax successor WHERE successor.tenant_id=t.tenant_id AND successor.supersedes_tax_id=t.id);
  IF v_head_count=0 THEN
    IF p_expected_tax IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='expected current component tax is stale'; END IF;
  ELSIF v_head_count=1 THEN
    IF p_expected_tax IS NULL THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='initial component tax already exists'; END IF;
    SELECT t.* INTO v_head FROM public.india_gst_accommodation_final_component_tax t
     WHERE t.tenant_id=p_tenant AND t.id=p_expected_tax AND t.evidence_hash=p_expected_tax_hash
       AND t.property_node=p_property AND t.reservation_id=p_reservation AND t.folio_id=p_folio
       AND NOT EXISTS (SELECT 1 FROM public.india_gst_accommodation_final_component_tax successor WHERE successor.tenant_id=t.tenant_id AND successor.supersedes_tax_id=t.id)
     FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='expected current component tax is stale'; END IF;
    IF v_head.valuation_id=v_valuation.id THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='component tax correction requires a new current valuation'; END IF;
    v_generation:=v_head.generation+1;
  ELSE RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='component tax lineage has multiple current heads'; END IF;

  INSERT INTO public.india_gst_accommodation_final_component_tax(
    tenant_id,id,property_node,reservation_id,folio_id,applicability_id,valuation_id,valuation_generation,
    request_id,generation,currency,transaction_value_minor,tax_minor,grand_total_minor,component_family,
    selected_version_side,selected_extension_id,selected_extension_version,final_valuation_evidence_hash,
    quoted_rate_applicability_evidence_hash,section14_evidence_hash,levy_component_identity_evidence_hash,
    reservation_lineage_evidence_hash,attribution_snapshot_evidence_hash,evidence_hash,
    supersedes_tax_id,supersedes_tax_evidence_hash,actor_id
  ) VALUES(
    p_tenant,v_id,p_property,p_reservation,p_folio,p_applicability,v_valuation.id,v_valuation.generation,
    p_request,v_generation,'INR',v_total::bigint,v_tax::bigint,v_grand::bigint,v_app.component_family,
    v_app.selected_version_side,v_app.selected_extension_id,v_app.selected_extension_version,v_valuation.evidence_hash,
    v_app.evidence_hash,v_app.section14_evidence_hash,v_app.levy_component_identity_evidence_hash,
    v_app.reservation_lineage_evidence_hash,v_app.attribution_snapshot_evidence_hash,v_evidence_hash,
    p_expected_tax,p_expected_tax_hash,p_actor
  );
  FOR v_i IN 1..v_n LOOP
    INSERT INTO public.india_gst_accommodation_final_component_tax_room_night(
      tenant_id,tax_id,ordinal,business_date,final_value_minor,currency,slab_upto_minor,
      aggregate_rate_basis_points,itc_eligible,tax_minor
    ) VALUES(p_tenant,v_id,v_room_ordinals[v_i],v_room_dates[v_i],v_room_values[v_i],'INR',v_room_slabs[v_i],v_room_bps[v_i],v_room_itc[v_i],v_room_taxes[v_i]);
  END LOOP;
  FOR v_i IN 1..pg_catalog.cardinality(v_component_identities) LOOP
    INSERT INTO public.india_gst_accommodation_final_component_tax_component(
      tenant_id,tax_id,room_night_ordinal,component_ordinal,component_identity,rate_basis_points,tax_amount_minor,currency
    ) VALUES(p_tenant,v_id,v_component_nights[v_i],v_component_ordinals[v_i],v_component_identities[v_i],v_component_bps[v_i],v_component_taxes[v_i],'INR');
  END LOOP;
  SELECT (pg_catalog.transaction_timestamp() AT TIME ZONE node.timezone)::date INTO v_business_date
    FROM public.org_node node WHERE node.tenant_id=p_tenant AND node.id=p_property;
  INSERT INTO public.fact_log(tenant_id,entity_type,entity_id,fact_type,valid_from,business_date,actor_id,payload,supersedes)
  VALUES(p_tenant,'india_gst_accommodation_final_component_tax',v_id,'recorded',pg_catalog.transaction_timestamp(),v_business_date,p_actor,
    pg_catalog.jsonb_build_object('taxId',v_id,'generation',v_generation,'evidenceHash',v_evidence_hash),
    (SELECT f.id FROM public.fact_log f WHERE f.tenant_id=p_tenant AND f.entity_type='india_gst_accommodation_final_component_tax' AND f.entity_id=p_expected_tax ORDER BY f.recorded_at DESC LIMIT 1))
  RETURNING id INTO v_fact;
  INSERT INTO public.outbox(tenant_id,property_node,business_date,aggregate_type,aggregate_id,event_type,actor_id,correlation_id,payload)
  VALUES(p_tenant,p_property,v_business_date,'india_gst_accommodation_final_component_tax',v_id,
    'india_gst.accommodation_final_component_tax_recorded',p_actor,p_request,
    pg_catalog.jsonb_build_object('taxId',v_id,'valuationId',v_valuation.id,'valuationGeneration',v_valuation.generation,
      'generation',v_generation,'evidenceHash',v_evidence_hash));
  RETURN QUERY SELECT v_id,v_generation,v_valuation.id,v_valuation.generation,v_total::bigint,v_tax::bigint,v_grand::bigint,v_evidence_hash,true;
END $_$;


--
-- Name: record_india_gst_accommodation_final_valuation(uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, text, text, text, uuid, text, uuid, text, text, text, text, text, text, text, text[], uuid[], text[], text[], text[], text[], text[], integer[], date[], bigint[], bigint[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_india_gst_accommodation_final_valuation(p_tenant uuid, p_property uuid, p_reservation uuid, p_folio uuid, p_buyer uuid, p_attribution uuid, p_lineage uuid, p_request uuid, p_actor uuid, p_disposition text, p_order341_hash text, p_request_hash text, p_expected uuid, p_expected_hash text, p_approval uuid, p_relationship text, p_consideration text, p_section152 text, p_section153 text, p_source_completeness text, p_attestation_source text, p_attestation_reference text, p_manual_reasons text[], p_source_ids uuid[], p_source_kinds text[], p_source_additions text[], p_source_discounts text[], p_source_evidence_sources text[], p_source_evidence_references text[], p_room_ordinals integer[], p_room_dates date[], p_room_weights bigint[], p_allocations bigint[]) RETURNS TABLE(valuation_id uuid, generation integer, disposition text, transaction_value_minor bigint, evidence_hash text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $_$
DECLARE
  v_folio public.folio%ROWTYPE; v_res public.reservation%ROWTYPE; v_id uuid:=gen_random_uuid();
  v_generation integer:=0; v_total numeric:=0; v_source_count integer; v_room_count integer;
  v_i integer; v_j integer; v_amount numeric; v_frag_hash text; v_tx text; v_fact uuid; v_date date; v_night_total numeric;
  v_source_amounts bigint[]:='{}'; v_fragment_hashes text[]:='{}'; v_tx_codes text[]:='{}';
  v_source_set_hash text; v_relationship_set_hash text; v_evidence_hash text; v_ordinary_hashes text[]:='{}'; v_current public.india_gst_accommodation_final_valuation%ROWTYPE;
  v_candidates uuid[]:='{}'; v_group_party uuid; v_known_relationship boolean;
BEGIN
  IF p_tenant IS DISTINCT FROM current_setting('app.tenant_id',true)::uuid THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='tenant context mismatch'; END IF;
  IF p_order341_hash !~ '^[0-9a-f]{64}$' OR p_request_hash !~ '^[0-9a-f]{64}$'
  THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='valuation hashes are non-canonical'; END IF;
  PERFORM 1 FROM public.app_user actor JOIN public.user_role ur ON ur.tenant_id=actor.tenant_id AND ur.user_id=actor.id JOIN public.role_permission rp ON rp.role_id=ur.role_id AND rp.permission_code='tax-fiscal.india-valuation:finalize' JOIN public.org_node grant_node ON grant_node.tenant_id=ur.tenant_id AND grant_node.id=ur.scope_node JOIN public.org_node property ON property.tenant_id=actor.tenant_id AND property.id=p_property AND grant_node.path @> property.path WHERE actor.tenant_id=p_tenant AND actor.id=p_actor AND actor.status='active'; IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='actor lacks property valuation authority'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant::text||p_reservation::text||p_folio::text,0));
  SELECT * INTO v_res FROM public.reservation WHERE tenant_id=p_tenant AND id=p_reservation AND property_node=p_property FOR SHARE;
  SELECT * INTO v_folio FROM public.folio WHERE tenant_id=p_tenant AND id=p_folio AND reservation_id=p_reservation AND status='open' FOR UPDATE;
  IF NOT FOUND OR v_res.id IS NULL THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='valuation scope unavailable'; END IF;
  PERFORM 1 FROM public.account WHERE tenant_id=p_tenant AND id=v_folio.account_id AND status='open' AND currency='INR' FOR SHARE; IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='INR folio account unavailable'; END IF;
  PERFORM 1
    FROM public.tax_attribution_reservation_binding lineage
    JOIN public.tax_attribution_hold_binding hold_binding ON hold_binding.tenant_id=lineage.tenant_id AND hold_binding.id=lineage.binding_id AND hold_binding.property_node=lineage.property_node AND hold_binding.hold_id=lineage.hold_id AND hold_binding.attribution_id=lineage.attribution_id AND hold_binding.sellable_unit_id=lineage.sellable_unit_id AND hold_binding.period=lineage.period AND hold_binding.origin_quote_hash=lineage.origin_quote_hash AND hold_binding.snapshot_hash=lineage.snapshot_hash AND hold_binding.currency=lineage.currency
    JOIN public.hold h ON h.tenant_id=lineage.tenant_id AND h.id=lineage.hold_id AND h.property_node=lineage.property_node AND h.sellable_unit_id=lineage.sellable_unit_id AND h.period=lineage.period AND h.status='consumed'
    JOIN public.reservation_segment segment ON segment.tenant_id=lineage.tenant_id AND segment.id=lineage.segment_id AND segment.reservation_id=lineage.reservation_id AND segment.sellable_unit_id=lineage.sellable_unit_id AND segment.period=lineage.period
    JOIN public.tax_attribution_snapshot attribution ON attribution.tenant_id=lineage.tenant_id AND attribution.id=lineage.attribution_id AND attribution.property_node=lineage.property_node AND attribution.origin_kind='rate_quote' AND attribution.origin_quote_hash=lineage.origin_quote_hash AND attribution.snapshot_hash=lineage.snapshot_hash AND attribution.currency=lineage.currency
   WHERE lineage.tenant_id=p_tenant AND lineage.id=p_lineage AND lineage.property_node=p_property AND lineage.attribution_id=p_attribution AND lineage.reservation_id=p_reservation AND lineage.currency='INR'
   FOR SHARE OF lineage,hold_binding,h,segment,attribution;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Order244 attribution lineage is unavailable'; END IF;
  PERFORM 1 FROM public.party p JOIN public.party_role r ON r.tenant_id=p.tenant_id AND r.party_id=p.id AND r.role IN ('guest','company') WHERE p.tenant_id=p_tenant AND p.id=p_buyer AND p.status='active' FOR SHARE OF p;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='legal buyer unavailable'; END IF;
  SELECT rg.account_party INTO v_group_party FROM public.reservation_group rg WHERE rg.tenant_id=p_tenant AND rg.id=v_res.group_id FOR SHARE;
  SELECT coalesce(array_agg(DISTINCT candidate ORDER BY candidate) FILTER(WHERE candidate IS NOT NULL),'{}') INTO v_candidates FROM unnest(ARRAY[v_res.primary_party,v_res.booker_party,(SELECT party_id FROM public.account WHERE tenant_id=p_tenant AND id=v_folio.account_id),v_group_party]) candidate;
  SELECT encode(digest(coalesce(string_agg(candidate::text,',' ORDER BY candidate),''),'sha256'),'hex') INTO v_relationship_set_hash FROM unnest(v_candidates) candidate;
  PERFORM 1 FROM public.party_relationship rel WHERE rel.tenant_id=p_tenant AND (rel.from_party=p_buyer OR rel.to_party=p_buyer) ORDER BY rel.from_party,rel.to_party,rel.kind FOR SHARE;
  v_known_relationship:=FOUND;
  IF p_relationship='unrelated_not_distinct' AND v_known_relationship THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='ordinary relationship attestation contradicts persisted relationship'; END IF;
  IF NOT p_buyer=ANY(v_candidates) THEN
    PERFORM 1 FROM public.approval_request ar JOIN public.app_user decider ON decider.tenant_id=ar.tenant_id AND decider.id=ar.decided_by AND decider.status='active'
      WHERE ar.tenant_id=p_tenant AND ar.id=p_approval AND ar.kind='india_gst_legal_buyer_override' AND ar.subject_type='folio' AND ar.subject_id=p_folio
        AND ar.status='approved' AND ar.requested_by=p_actor AND ar.decided_by<>p_actor AND ar.decided_at IS NOT NULL
        AND ar.decided_at<=transaction_timestamp() AND ar.decided_at<ar.valid_until AND ar.valid_until > transaction_timestamp()
        AND ar.payload=jsonb_build_object('propertyNode',p_property::text,'reservationId',p_reservation::text,'folioId',p_folio::text,'windowNo',v_folio.window_no,'buyerPartyId',p_buyer::text,'relationshipSetHash',v_relationship_set_hash,'requestHash',p_request_hash,'order341EvidenceHash',p_order341_hash)
      FOR UPDATE OF ar;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='exact different-user buyer approval unavailable'; END IF;
  ELSIF p_approval IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='related buyer must not consume override approval'; END IF;
  IF p_disposition='ordinary_final' THEN
    IF p_relationship<>'unrelated_not_distinct' OR p_consideration<>'money_only' OR p_section152<>'all_additions_enumerated' OR p_section153<>'all_discounts_eligible' OR p_source_completeness<>'all_sources_classified' OR p_attestation_source !~ '^[a-z][a-z0-9_.:-]{2,63}$' OR length(p_attestation_reference) NOT BETWEEN 1 AND 200 OR cardinality(p_manual_reasons)<>0 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='ordinary attestation is incomplete'; END IF;
    v_ordinary_hashes:=ARRAY[
      encode(digest('relationship:'||p_relationship||':'||p_attestation_source||':'||p_attestation_reference,'sha256'),'hex'),
      encode(digest('consideration:'||p_consideration||':'||p_attestation_source||':'||p_attestation_reference,'sha256'),'hex'),
      encode(digest('section152:'||p_section152||':'||p_attestation_source||':'||p_attestation_reference,'sha256'),'hex'),
      encode(digest('section153:'||p_section153||':'||p_attestation_source||':'||p_attestation_reference,'sha256'),'hex'),
      encode(digest('source-completeness:'||p_source_completeness||':'||p_attestation_source||':'||p_attestation_reference,'sha256'),'hex')];
  ELSIF p_disposition='manual_valuation_required' THEN
    IF cardinality(p_manual_reasons)=0 OR p_relationship IS NOT NULL OR p_consideration IS NOT NULL OR p_section152 IS NOT NULL OR p_section153 IS NOT NULL OR p_source_completeness IS NOT NULL OR p_attestation_source IS NOT NULL OR p_attestation_reference IS NOT NULL OR NOT p_manual_reasons <@ ARRAY['related_person','distinct_person','non_money_consideration','pure_agent','special_supply_rules_27_35','tax_inclusive','omitted_section15_2_addition','ineligible_section15_3_discount','indeterminable_section15_3_discount','incomplete_source_classification','other_indeterminable_governed_evidence']::text[] THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='manual attestation partition is invalid'; END IF;
  ELSE RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='valuation disposition is invalid'; END IF;
  IF p_expected IS NOT NULL THEN
    SELECT * INTO v_current FROM public.india_gst_accommodation_final_valuation c WHERE c.tenant_id=p_tenant AND c.id=p_expected AND c.evidence_hash=p_expected_hash AND c.reservation_id=p_reservation AND c.folio_id=p_folio AND NOT EXISTS(SELECT 1 FROM public.india_gst_accommodation_final_valuation n WHERE n.tenant_id=c.tenant_id AND n.supersedes_valuation_id=c.id) FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='expected current valuation is stale'; END IF; v_generation:=v_current.generation+1;
  ELSIF EXISTS(SELECT 1 FROM public.india_gst_accommodation_final_valuation WHERE tenant_id=p_tenant AND reservation_id=p_reservation AND folio_id=p_folio) THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='initial valuation already exists';
  END IF;
  v_source_count:=coalesce(array_length(p_source_ids,1),0); v_room_count:=coalesce(array_length(p_room_ordinals,1),0);
  IF v_source_count=0 OR v_room_count=0 OR v_room_count>366 OR array_length(p_source_kinds,1)<>v_source_count OR array_length(p_source_additions,1)<>v_source_count OR array_length(p_source_discounts,1)<>v_source_count OR array_length(p_source_evidence_sources,1)<>v_source_count OR array_length(p_source_evidence_references,1)<>v_source_count OR array_length(p_room_dates,1)<>v_room_count OR array_length(p_room_weights,1)<>v_room_count OR (SELECT count(DISTINCT x) FROM unnest(p_source_ids)x)<>v_source_count OR (SELECT count(DISTINCT x) FROM unnest(p_room_ordinals)x)<>v_room_count OR (SELECT count(DISTINCT x) FROM unnest(p_room_dates)x)<>v_room_count THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='valuation evidence arrays are incomplete'; END IF;
  IF p_disposition='ordinary_final' AND array_length(p_allocations,1)<>v_source_count*v_room_count THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='ordinary allocations are incomplete'; END IF;
  IF (WITH complete AS (
        SELECT root.id AS root_id
          FROM public.posting_line root
          JOIN public.journal root_journal ON root_journal.tenant_id=root.tenant_id AND root_journal.id=root.journal_id
          JOIN public.tx_code code ON code.code=root.tx_code
          JOIN public.posting_line fragment ON fragment.tenant_id=root.tenant_id AND coalesce(fragment.folio_transfer_root_line_id,fragment.id)=root.id
          JOIN public.journal fragment_journal ON fragment_journal.tenant_id=fragment.tenant_id AND fragment_journal.id=fragment.journal_id
         WHERE root.tenant_id=p_tenant AND root.folio_transfer_root_line_id IS NULL AND root.account_id=v_folio.account_id
           AND root_journal.currency='INR' AND fragment_journal.currency='INR' AND code.grp IN ('revenue','adjustment')
           AND NOT EXISTS(SELECT 1 FROM public.journal reversal WHERE reversal.tenant_id=root_journal.tenant_id AND reversal.reverses=root_journal.id)
         GROUP BY root.id HAVING sum(fragment.amount_minor) FILTER(WHERE fragment.folio_id=p_folio)<>0)
      SELECT count(*) FROM complete) <> v_source_count
     OR EXISTS(WITH complete AS (
        SELECT root.id AS root_id
          FROM public.posting_line root
          JOIN public.journal root_journal ON root_journal.tenant_id=root.tenant_id AND root_journal.id=root.journal_id
          JOIN public.tx_code code ON code.code=root.tx_code
          JOIN public.posting_line fragment ON fragment.tenant_id=root.tenant_id AND coalesce(fragment.folio_transfer_root_line_id,fragment.id)=root.id
          JOIN public.journal fragment_journal ON fragment_journal.tenant_id=fragment.tenant_id AND fragment_journal.id=fragment.journal_id
         WHERE root.tenant_id=p_tenant AND root.folio_transfer_root_line_id IS NULL AND root.account_id=v_folio.account_id
           AND root_journal.currency='INR' AND fragment_journal.currency='INR' AND code.grp IN ('revenue','adjustment')
           AND NOT EXISTS(SELECT 1 FROM public.journal reversal WHERE reversal.tenant_id=root_journal.tenant_id AND reversal.reverses=root_journal.id)
         GROUP BY root.id HAVING sum(fragment.amount_minor) FILTER(WHERE fragment.folio_id=p_folio)<>0)
      SELECT 1 FROM complete WHERE NOT complete.root_id=ANY(p_source_ids))
  THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='requested posting roots are not the complete consideration set'; END IF;
  SELECT encode(digest(string_agg(x::text,',' ORDER BY x),'sha256'),'hex') INTO v_source_set_hash FROM unnest(p_source_ids) x;
  FOR v_i IN 1..v_source_count LOOP
    PERFORM 1 FROM public.posting_line fragment JOIN public.journal j ON j.tenant_id=fragment.tenant_id AND j.id=fragment.journal_id
      WHERE fragment.tenant_id=p_tenant AND coalesce(fragment.folio_transfer_root_line_id,fragment.id)=p_source_ids[v_i]
      ORDER BY fragment.id FOR SHARE OF fragment,j;
    IF EXISTS(
      SELECT 1 FROM public.posting_line fragment JOIN public.journal transfer ON transfer.tenant_id=fragment.tenant_id AND transfer.id=fragment.journal_id
       WHERE fragment.tenant_id=p_tenant AND fragment.folio_transfer_root_line_id=p_source_ids[v_i] AND transfer.kind='transfer'
       GROUP BY transfer.id
       HAVING count(*)<>2 OR count(DISTINCT fragment.folio_id)<>2 OR sum(fragment.amount_minor)<>0 OR count(DISTINCT fragment.account_id)<>1
    ) THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='posting transfer family is ambiguous'; END IF;
    SELECT sum(fragment.amount_minor) FILTER(WHERE fragment.folio_id=p_folio)::numeric,
           encode(digest(string_agg(fragment.id::text||':'||fragment.amount_minor::text||':'||fragment.journal_id::text||':'||coalesce(fragment.folio_id::text,'-'),',' ORDER BY fragment.id),'sha256'),'hex'),root.tx_code
      INTO v_amount,v_frag_hash,v_tx
      FROM public.posting_line root
      JOIN public.posting_line fragment ON fragment.tenant_id=root.tenant_id AND coalesce(fragment.folio_transfer_root_line_id,fragment.id)=root.id
      JOIN public.journal j ON j.tenant_id=fragment.tenant_id AND j.id=fragment.journal_id
     WHERE root.tenant_id=p_tenant AND root.id=p_source_ids[v_i] AND root.folio_transfer_root_line_id IS NULL
       AND root.account_id=v_folio.account_id AND j.currency='INR'
     GROUP BY root.id,root.tx_code;
    IF v_amount IS NULL OR v_amount=0 OR v_amount NOT BETWEEN -9223372036854775808::numeric AND 9223372036854775807::numeric THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='posting source is unavailable or unsafe'; END IF;
    IF (p_source_kinds[v_i] IN ('promotion_discount','section15_3_discount')) <> (v_amount<0) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='source classification sign conflicts'; END IF;
    IF p_source_kinds[v_i] NOT IN ('room_consideration','package_consideration','promotion_discount','fee_consideration','section15_2_addition','section15_3_discount') OR p_source_evidence_sources[v_i] !~ '^[a-z][a-z0-9_.:-]{2,63}$' OR length(p_source_evidence_references[v_i]) NOT BETWEEN 1 AND 200 OR (p_source_kinds[v_i]='section15_2_addition')<>(p_source_additions[v_i] IN ('tax_duty_cess_fee_charge_excluding_gst','supplier_liability_paid_by_recipient','incidental_expense','interest_late_fee_penalty','non_government_price_linked_subsidy')) OR (p_source_kinds[v_i]='section15_3_discount')<>(p_source_discounts[v_i] IN ('eligible_pre_supply_recorded','eligible_post_supply_linked_itc_reversed','ineligible','indeterminable')) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='source attestation is incomplete'; END IF;
    IF p_disposition='ordinary_final' AND p_source_kinds[v_i]='section15_3_discount' AND p_source_discounts[v_i] NOT IN ('eligible_pre_supply_recorded','eligible_post_supply_linked_itc_reversed') THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='ordinary discount is not eligible'; END IF;
    IF p_expected IS NOT NULL AND EXISTS(SELECT 1 FROM public.india_gst_accommodation_valuation_source prior WHERE prior.tenant_id=p_tenant AND prior.valuation_id=p_expected AND prior.posting_root_id=p_source_ids[v_i] AND (prior.source_kind<>p_source_kinds[v_i] OR prior.addition_subtype IS DISTINCT FROM nullif(p_source_additions[v_i],'') OR prior.discount_eligibility IS DISTINCT FROM nullif(p_source_discounts[v_i],'') OR prior.evidence_source<>p_source_evidence_sources[v_i] OR prior.evidence_reference<>p_source_evidence_references[v_i])) THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='correction cannot reclassify an existing posting root'; END IF;
    v_source_amounts:=array_append(v_source_amounts,v_amount::bigint); v_fragment_hashes:=array_append(v_fragment_hashes,v_frag_hash); v_tx_codes:=array_append(v_tx_codes,v_tx);
    v_total:=v_total+v_amount;
  END LOOP;
  IF v_total NOT BETWEEN -9223372036854775808::numeric AND 9223372036854775807::numeric THEN RAISE EXCEPTION USING ERRCODE='22003',MESSAGE='valuation total exceeds signed int64'; END IF;
  v_evidence_hash:=encode(digest('v2:'||p_tenant::text||':'||p_request_hash||':'||v_source_set_hash||':'||v_relationship_set_hash||':'||array_to_string(v_fragment_hashes,',')||':'||array_to_string(v_ordinary_hashes,',')||':'||array_to_string(p_manual_reasons,','),'sha256'),'hex');
  INSERT INTO public.india_gst_accommodation_final_valuation(tenant_id,id,property_node,reservation_id,folio_id,folio_account_id,window_no,buyer_party_id,attribution_id,request_id,generation,disposition,currency,transaction_value_minor,source_set_hash,order341_evidence_hash,request_hash,evidence_hash,ordinary_evidence_hashes,manual_reasons,relationship_conclusion,consideration_conclusion,section15_2_conclusion,section15_3_conclusion,source_completeness_conclusion,attestation_evidence_source,attestation_evidence_reference,relationship_set_hash,attested_by,approval_request_id,supersedes_valuation_id,actor_id)
  VALUES(p_tenant,v_id,p_property,p_reservation,p_folio,v_folio.account_id,v_folio.window_no,p_buyer,p_attribution,p_request,v_generation,p_disposition,'INR',CASE WHEN p_disposition='ordinary_final' THEN v_total::bigint ELSE NULL END,v_source_set_hash,p_order341_hash,p_request_hash,v_evidence_hash,v_ordinary_hashes,p_manual_reasons,p_relationship,p_consideration,p_section152,p_section153,p_source_completeness,p_attestation_source,p_attestation_reference,v_relationship_set_hash,p_actor,p_approval,p_expected,p_actor);
  FOR v_i IN 1..v_source_count LOOP
    INSERT INTO public.india_gst_accommodation_valuation_source(tenant_id,valuation_id,posting_root_id,source_kind,current_amount_minor,currency,tx_code,current_fragment_set_hash,classification_evidence_hash,eligibility_evidence_hash,addition_subtype,discount_eligibility,evidence_source,evidence_reference,attested_by)
    VALUES(p_tenant,v_id,p_source_ids[v_i],p_source_kinds[v_i],v_source_amounts[v_i],'INR',v_tx_codes[v_i],v_fragment_hashes[v_i],encode(digest(p_source_ids[v_i]::text||':'||p_source_kinds[v_i]||':'||p_source_additions[v_i]||':'||p_source_discounts[v_i]||':'||p_source_evidence_sources[v_i]||':'||p_source_evidence_references[v_i]||':'||p_actor::text,'sha256'),'hex'),CASE WHEN p_source_kinds[v_i]='section15_3_discount' THEN encode(digest(p_source_ids[v_i]::text||':'||p_source_discounts[v_i]||':'||p_source_evidence_sources[v_i]||':'||p_source_evidence_references[v_i],'sha256'),'hex') END,nullif(p_source_additions[v_i],''),nullif(p_source_discounts[v_i],''),p_source_evidence_sources[v_i],p_source_evidence_references[v_i],p_actor);
  END LOOP;
  FOR v_j IN 1..v_room_count LOOP
    v_night_total:=NULL;
    IF p_disposition='ordinary_final' THEN
      v_night_total:=0; FOR v_i IN 1..v_source_count LOOP v_night_total:=v_night_total+p_allocations[(v_i-1)*v_room_count+v_j]; END LOOP;
      IF v_night_total<=0 OR v_night_total NOT BETWEEN 1 AND 9223372036854775807::numeric THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='ordinary room-night value must be positive'; END IF;
    END IF;
    INSERT INTO public.india_gst_accommodation_valuation_room_night VALUES(p_tenant,v_id,p_room_ordinals[v_j],p_room_dates[v_j],p_room_weights[v_j],v_night_total::bigint,'INR');
  END LOOP;
  IF p_disposition='ordinary_final' THEN
    FOR v_i IN 1..v_source_count LOOP FOR v_j IN 1..v_room_count LOOP
      IF p_allocations[(v_i-1)*v_room_count+v_j]<>0 THEN INSERT INTO public.india_gst_accommodation_valuation_allocation VALUES(p_tenant,v_id,p_source_ids[v_i],p_room_ordinals[v_j],p_allocations[(v_i-1)*v_room_count+v_j],'INR'); END IF;
    END LOOP; END LOOP;
    IF EXISTS(SELECT 1 FROM public.india_gst_accommodation_valuation_source s WHERE s.tenant_id=p_tenant AND s.valuation_id=v_id AND s.current_amount_minor<>(SELECT coalesce(sum(a.amount_minor),0) FROM public.india_gst_accommodation_valuation_allocation a WHERE a.tenant_id=s.tenant_id AND a.valuation_id=s.valuation_id AND a.posting_root_id=s.posting_root_id)) THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='source allocation does not reconcile'; END IF;
  END IF;
  SELECT (transaction_timestamp() AT TIME ZONE timezone)::date INTO v_date FROM public.org_node WHERE tenant_id=p_tenant AND id=p_property;
  INSERT INTO public.fact_log(tenant_id,entity_type,entity_id,fact_type,valid_from,business_date,actor_id,payload,supersedes) VALUES(p_tenant,'india_gst_accommodation_final_valuation',v_id,'recorded',transaction_timestamp(),v_date,p_actor,jsonb_build_object('valuationId',v_id,'disposition',p_disposition,'evidenceHash',v_evidence_hash),(SELECT id FROM public.fact_log WHERE tenant_id=p_tenant AND entity_type='india_gst_accommodation_final_valuation' AND entity_id=p_expected ORDER BY recorded_at DESC LIMIT 1)) RETURNING id INTO v_fact;
  INSERT INTO public.outbox(tenant_id,property_node,business_date,aggregate_type,aggregate_id,event_type,actor_id,correlation_id,payload) VALUES(p_tenant,p_property,v_date,'india_gst_accommodation_final_valuation',v_id,'india_gst.accommodation_final_valuation_recorded',p_actor,p_request,jsonb_build_object('valuationId',v_id,'reservationId',p_reservation,'folioId',p_folio,'windowNo',v_folio.window_no,'buyerPartyId',p_buyer,'generation',v_generation,'disposition',p_disposition,'evidenceHash',v_evidence_hash));
  RETURN QUERY SELECT v_id,v_generation,p_disposition,CASE WHEN p_disposition='ordinary_final' THEN v_total::bigint ELSE NULL END,v_evidence_hash;
END $_$;


--
-- Name: record_india_gst_accommodation_quoted_rate_applicability(uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, text, date, date, date, date, date, text, uuid, smallint, text, text, timestamp with time zone, timestamp with time zone, text, text, text, text, text, text, text, text, date, date[], text[], integer[], date[], bigint[], bigint[], integer[], boolean[], integer[], smallint[], text[], integer[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_india_gst_accommodation_quoted_rate_applicability(p_tenant uuid, p_property uuid, p_reservation uuid, p_folio uuid, p_lineage uuid, p_attribution uuid, p_request uuid, p_actor uuid, p_service_snapshot uuid, p_payment_snapshot uuid, p_invoice_snapshot uuid, p_family_jurisdiction_extension uuid, p_classification uuid, p_supplier_service_location uuid, p_supplier_sez_status uuid, p_recipient_sez_status uuid, p_recipient_party uuid, p_section14_case text, p_service_date date, p_invoice_date date, p_payment_date date, p_rate_change_date date, p_time_of_supply_date date, p_selected_side text, p_selected_extension uuid, p_selected_version smallint, p_selected_status text, p_selected_content_hash text, p_selected_from timestamp with time zone, p_selected_to timestamp with time zone, p_component_family text, p_section14_hash text, p_levy_hash text, p_lineage_hash text, p_attribution_hash text, p_evidence_hash text, p_calendar_authority text, p_calendar_source_hash text, p_calendar_through date, p_calendar_dates date[], p_calendar_states text[], p_night_ordinals integer[], p_night_dates date[], p_night_amounts bigint[], p_slab_upto bigint[], p_aggregate_bps integer[], p_itc_eligible boolean[], p_component_night_ordinals integer[], p_component_ordinals smallint[], p_component_identities text[], p_component_bps integer[]) RETURNS TABLE(applicability_id uuid, evidence_hash text, created boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $_$
DECLARE
  v_id uuid:=pg_catalog.gen_random_uuid(); v_existing public.india_gst_accommodation_quoted_rate_applicability%ROWTYPE;
  v_lineage public.tax_attribution_reservation_binding%ROWTYPE; v_folio public.folio%ROWTYPE;
  v_n integer; v_c integer; v_i integer; v_fact uuid; v_business_date date; v_expected_identities text[];
  v_calendar_count integer:=coalesce(pg_catalog.cardinality(p_calendar_dates),0); v_working integer:=0;
  v_first_four date[]:='{}'; v_fourth_working date; v_governed_payment_date date; v_governed_branch text;
  v_expected_extension uuid; v_expected_version smallint; v_expected_status text; v_expected_from timestamptz; v_expected_to timestamptz;
  v_expected_lower integer; v_expected_content_hash text; v_expected_content jsonb; v_extension public.extension%ROWTYPE;
  v_predecessor_extension public.extension%ROWTYPE; v_successor_extension public.extension%ROWTYPE; v_replay boolean:=false;
  v_service public.india_gst_accommodation_service_provision_snapshot%ROWTYPE; v_payment public.india_gst_accommodation_payment_receipt_snapshot%ROWTYPE; v_invoice public.india_gst_accommodation_invoice_issue_snapshot%ROWTYPE;
  v_component_json text; v_selected_from_json text; v_selected_to_json text; v_order341_json text;
  v_predecessor_content_json text; v_successor_content_json text; v_pair_predecessor_json text; v_pair_successor_json text;
  v_rate_pair_json text; v_rate_pair_hash text; v_rate_identity_predecessor_json text; v_rate_identity_successor_json text;
  v_rate_change_json text; v_rate_change_hash text; v_lineage_json text; v_attribution_json text; v_nested_service_json text;
  v_service_json text; v_service_hash text; v_payment_json text; v_payment_hash text; v_invoice_json text; v_invoice_hash text;
  v_proviso_json text; v_proviso_hash text; v_calendar_days_json text; v_first_four_json text; v_calendar_json text; v_calendar_hash text;
  v_governed_json text; v_governed_hash text; v_working_hash_json text:='null'; v_governed_hash_json text:='null';
  v_section14_json text; v_section14_hash text;
  v_supplier_region text; v_property_region text; v_supplier_taxpayer text; v_recipient_taxpayer text; v_derived_family text;
  v_valuation public.india_gst_accommodation_final_valuation%ROWTYPE;
BEGIN
  IF session_user<>'yellow_runtime' OR pg_catalog.current_setting('role',true) IS DISTINCT FROM 'app_role' OR current_user<>'yellow_owner' THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='quoted applicability requires governed runtime app role'; END IF;
  IF p_tenant IS DISTINCT FROM NULLIF(pg_catalog.current_setting('app.tenant_id',true),'')::uuid THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='quoted applicability tenant context mismatch'; END IF;
  IF p_request IS NULL OR p_actor IS NULL OR p_evidence_hash !~ '^[0-9a-f]{64}$' OR p_section14_hash !~ '^[0-9a-f]{64}$' OR p_levy_hash !~ '^[0-9a-f]{64}$' OR p_lineage_hash !~ '^[0-9a-f]{64}$' OR p_attribution_hash !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='quoted applicability identity is invalid'; END IF;
  PERFORM 1 FROM public.tenant WHERE id=p_tenant AND status='active'; IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='quoted applicability tenant unavailable'; END IF;
  PERFORM 1 FROM public.app_user actor JOIN public.user_role ur ON ur.tenant_id=actor.tenant_id AND ur.user_id=actor.id JOIN public.role_permission rp ON rp.role_id=ur.role_id AND rp.permission_code='tax-fiscal.india-valuation:finalize' JOIN public.org_node grant_node ON grant_node.tenant_id=ur.tenant_id AND grant_node.id=ur.scope_node JOIN public.org_node property ON property.tenant_id=actor.tenant_id AND property.id=p_property AND property.kind='property' AND grant_node.path @> property.path WHERE actor.tenant_id=p_tenant AND actor.id=p_actor AND actor.status='active';
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='actor lacks property fiscal authority'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_tenant::text||p_reservation::text||p_folio::text,0));
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('india-quoted-applicability:'||p_tenant::text||':'||p_reservation::text||':'||p_folio::text,400));
  SELECT * INTO v_existing FROM public.india_gst_accommodation_quoted_rate_applicability WHERE tenant_id=p_tenant AND request_id=p_request;
  IF FOUND THEN
    v_replay:=true;
  END IF;
  SELECT l.* INTO v_lineage FROM public.tax_attribution_reservation_binding l
    JOIN public.tax_attribution_hold_binding b ON b.tenant_id=l.tenant_id AND b.id=l.binding_id AND b.hold_id=l.hold_id AND b.attribution_id=l.attribution_id AND b.sellable_unit_id=l.sellable_unit_id AND b.period=l.period AND b.origin_quote_hash=l.origin_quote_hash AND b.snapshot_hash=l.snapshot_hash AND b.currency=l.currency
    JOIN public.hold h ON h.tenant_id=l.tenant_id AND h.id=l.hold_id AND h.status='consumed' AND h.sellable_unit_id=l.sellable_unit_id AND h.period=l.period
    JOIN public.reservation_segment s ON s.tenant_id=l.tenant_id AND s.id=l.segment_id AND s.reservation_id=l.reservation_id AND s.sellable_unit_id=l.sellable_unit_id AND s.period=l.period
    JOIN public.tax_attribution_snapshot a ON a.tenant_id=l.tenant_id AND a.id=l.attribution_id AND a.property_node=l.property_node AND a.origin_kind='rate_quote' AND a.origin_quote_hash=l.origin_quote_hash AND a.snapshot_hash=l.snapshot_hash AND a.currency='INR'
   WHERE l.tenant_id=p_tenant AND l.id=p_lineage AND l.property_node=p_property AND l.reservation_id=p_reservation AND l.attribution_id=p_attribution AND l.currency='INR' FOR SHARE OF l,b,h,s,a;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='exact quoted reservation lineage unavailable'; END IF;
  SELECT * INTO v_folio FROM public.folio WHERE tenant_id=p_tenant AND id=p_folio AND reservation_id=p_reservation AND window_no=1 FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='exact quoted folio unavailable'; END IF;
  SELECT service.* INTO v_service
    FROM public.india_gst_accommodation_service_provision_snapshot service
    JOIN public.india_gst_accommodation_payment_receipt_snapshot payment ON payment.tenant_id=service.tenant_id AND payment.service_provision_snapshot_id=service.id
    JOIN public.india_gst_accommodation_invoice_issue_snapshot invoice ON invoice.tenant_id=service.tenant_id AND invoice.service_provision_snapshot_id=service.id
   WHERE service.tenant_id=p_tenant AND service.id=p_service_snapshot AND payment.id=p_payment_snapshot AND invoice.id=p_invoice_snapshot
     AND service.property_node=p_property AND service.reservation_id=p_reservation AND service.reservation_lineage_id=p_lineage AND service.attribution_id=p_attribution
     AND service.service_provision_date=p_service_date AND invoice.invoice_issue_date=p_invoice_date
     AND service.currency='INR' AND payment.currency='INR' AND invoice.currency='INR'
     AND service.service_provision_source='governed_service_provision_record' AND payment.payment_receipt_source='governed_supplier_payment_receipt_record' AND invoice.invoice_issue_source='governed_supplier_tax_invoice_record'
     AND payment.amount_minor=invoice.amount_minor AND payment.coverage_scope='full_attribution' AND invoice.coverage_scope='full_attribution'
    FOR SHARE OF service,payment,invoice;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='exact governed service, payment and invoice ancestry unavailable'; END IF;
  SELECT * INTO v_payment FROM public.india_gst_accommodation_payment_receipt_snapshot
   WHERE tenant_id=p_tenant AND id=p_payment_snapshot;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='exact governed payment ancestry unavailable'; END IF;
  SELECT * INTO v_invoice FROM public.india_gst_accommodation_invoice_issue_snapshot
   WHERE tenant_id=p_tenant AND id=p_invoice_snapshot;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='exact governed invoice ancestry unavailable'; END IF;
  SELECT registration.region_code,property_location.state_code,supplier_status.gst_taxpayer_type,recipient_status.gst_taxpayer_type
    INTO v_supplier_region,v_property_region,v_supplier_taxpayer,v_recipient_taxpayer
    FROM public.india_gst_item_classification classification
    JOIN public.extension jurisdiction ON jurisdiction.id=classification.jurisdiction_extension_id
    JOIN public.org_node governed_property ON governed_property.tenant_id=classification.tenant_id AND governed_property.id=p_property AND governed_property.kind='property'
    JOIN public.india_gst_supplier_service_location supplier_location ON supplier_location.tenant_id=classification.tenant_id AND supplier_location.id=p_supplier_service_location
    JOIN public.property_fiscal_registration registration ON registration.tenant_id=supplier_location.tenant_id AND registration.id=supplier_location.supplier_registration_id AND registration.property_node=p_property
    JOIN public.india_gst_supplier_sez_status supplier_status ON supplier_status.tenant_id=registration.tenant_id AND supplier_status.id=p_supplier_sez_status AND supplier_status.supplier_registration_id=registration.id AND supplier_status.status_as_of=p_time_of_supply_date
    JOIN public.property_fiscal_location property_location ON property_location.tenant_id=classification.tenant_id AND property_location.property_node=p_property AND property_location.country_code='IN'
    JOIN public.india_gst_recipient_sez_status recipient_status ON recipient_status.tenant_id=classification.tenant_id AND recipient_status.id=p_recipient_sez_status AND recipient_status.status_as_of=p_time_of_supply_date
    JOIN public.party_fiscal_registration recipient_registration ON recipient_registration.tenant_id=recipient_status.tenant_id AND recipient_registration.id=recipient_status.recipient_registration_id AND recipient_registration.party_id=p_recipient_party AND recipient_registration.scheme='in-gstin'
    JOIN public.party recipient ON recipient.tenant_id=recipient_registration.tenant_id AND recipient.id=p_recipient_party AND recipient.status='active' AND recipient.merged_into IS NULL
   WHERE classification.tenant_id=p_tenant AND classification.id=p_classification AND classification.property_node=p_property
     AND classification.jurisdiction_extension_id=p_family_jurisdiction_extension
     AND classification.jurisdiction_key='in-gst-lodging' AND classification.country_code='IN' AND classification.line_id='room' AND classification.revenue_group='room_revenue' AND classification.classification_system='SAC' AND classification.is_service_code='Y'
     AND jurisdiction.tenant_id IS NULL AND jurisdiction.type='tax_jurisdiction' AND jurisdiction.key='in-gst-lodging'
     AND ((jurisdiction.id='a806f516-fed6-5768-b310-94aa03286adb' AND jurisdiction.version=1 AND jurisdiction.status='retired') OR (jurisdiction.id='0b21daf2-ea6e-5568-9c21-69e4d4424574' AND jurisdiction.version=2 AND jurisdiction.status='active'))
     AND classification.jurisdiction_version=jurisdiction.version
     AND classification.jurisdiction_content_hash=CASE jurisdiction.id WHEN 'a806f516-fed6-5768-b310-94aa03286adb'::uuid THEN '2160e1747afcb3c280f1fd66e55534a5be563a10f277e8fcc178324e51abaa08' ELSE 'eb323eff707aad1e460b425c87b448d4e924d2eb17499094abad71b33c69a820' END
     AND jurisdiction.effective @> (p_service_date::timestamp AT TIME ZONE governed_property.timezone)
     AND supplier_location.service_scope='lodging_accommodation' AND supplier_location.location_basis='supply_made_from_registered_place_of_business'
     AND supplier_status.gst_registration_status='active' AND recipient_status.gst_registration_status='active'
   FOR SHARE OF classification,jurisdiction,governed_property,supplier_location,registration,supplier_status,property_location,recipient_status,recipient_registration,recipient;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='exact component-family selector ancestry unavailable'; END IF;
  v_derived_family:=CASE
    WHEN v_supplier_taxpayer IN ('sez_unit','sez_developer') OR v_recipient_taxpayer IN ('sez_unit','sez_developer') THEN 'igst'
    WHEN v_supplier_region<>v_property_region THEN 'igst'
    WHEN v_property_region IN ('04','26','31','35','38') THEN 'cgst_utgst'
    ELSE 'cgst_sgst' END;
  IF p_component_family IS DISTINCT FROM v_derived_family THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='component family conflicts with persisted statutory selectors'; END IF;
  SELECT valuation.* INTO v_valuation
    FROM public.india_gst_accommodation_final_valuation valuation
   WHERE valuation.tenant_id=p_tenant AND valuation.property_node=p_property AND valuation.reservation_id=p_reservation AND valuation.folio_id=p_folio
     AND valuation.attribution_id=p_attribution AND valuation.buyer_party_id=p_recipient_party AND valuation.disposition='ordinary_final'
     AND valuation.order341_evidence_hash=p_evidence_hash
     AND NOT EXISTS(SELECT 1 FROM public.india_gst_accommodation_final_valuation successor WHERE successor.tenant_id=valuation.tenant_id AND successor.supersedes_valuation_id=valuation.id)
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='current ordinary valuation does not bind quoted applicability evidence'; END IF;
  IF p_rate_change_date<>DATE '2025-09-22' OR p_service_date=p_rate_change_date OR p_invoice_date=p_rate_change_date OR p_payment_date=p_rate_change_date THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Section14 date partition is invalid'; END IF;
  IF p_selected_side='predecessor' THEN v_expected_extension:='a806f516-fed6-5768-b310-94aa03286adb';v_expected_version:=1;v_expected_status:='retired';v_expected_from:='2022-07-17T18:30:00Z';v_expected_to:='2025-09-21T18:30:00Z';v_expected_lower:=1200;v_expected_content_hash:='2160e1747afcb3c280f1fd66e55534a5be563a10f277e8fcc178324e51abaa08';v_expected_content:='{"country":"IN","price_display":"tax_exclusive","rounding":"document","taxes":[{"code":"GST_ROOM","name":"GST on accommodation","mode":"slab_percent","slab_basis":"transaction_value","applies_to":["room_revenue"],"slabs":[{"upto_minor":750000,"rate":0.12,"itc_eligible":true},{"upto_minor":null,"rate":0.18,"itc_eligible":true}]},{"code":"GST_FNB","name":"GST on F&B (restaurant in hotel)","mode":"percent","rate":0.05,"applies_to":["fnb_revenue"]}]}'::jsonb;
  ELSIF p_selected_side='successor' THEN v_expected_extension:='0b21daf2-ea6e-5568-9c21-69e4d4424574';v_expected_version:=2;v_expected_status:='active';v_expected_from:='2025-09-21T18:30:00Z';v_expected_to:=NULL;v_expected_lower:=500;v_expected_content_hash:='eb323eff707aad1e460b425c87b448d4e924d2eb17499094abad71b33c69a820';v_expected_content:='{"country":"IN","price_display":"tax_exclusive","rounding":"document","taxes":[{"code":"GST_ROOM","name":"GST on accommodation","mode":"slab_percent","slab_basis":"transaction_value","applies_to":["room_revenue"],"slabs":[{"upto_minor":750000,"rate":0.05,"itc_eligible":false},{"upto_minor":null,"rate":0.18,"itc_eligible":true}]},{"code":"GST_FNB","name":"GST on F&B (restaurant in hotel)","mode":"percent","rate":0.05,"applies_to":["fnb_revenue"]}]}'::jsonb;
  ELSE RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='selected version side is invalid'; END IF;
  SELECT * INTO v_extension FROM public.extension WHERE id=v_expected_extension AND tenant_id IS NULL AND type='tax_jurisdiction' AND key='in-gst-lodging' AND version=v_expected_version AND status=v_expected_status FOR SHARE;
  IF NOT FOUND OR v_extension.content<>v_expected_content OR lower(v_extension.effective)<>v_expected_from OR upper(v_extension.effective) IS DISTINCT FROM v_expected_to OR p_selected_extension<>v_expected_extension OR p_selected_version<>v_expected_version OR p_selected_status<>v_expected_status OR p_selected_from<>v_expected_from OR p_selected_to IS DISTINCT FROM v_expected_to OR p_selected_content_hash<>v_expected_content_hash THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='selected extension identity is stale or forged'; END IF;
  -- Rebuild the complete pure Order304 pair and Order307 rate-change roots from
  -- the two persisted global extension versions.  The pair uses the pure
  -- predecessor's recursively key-sorted canonical JSON, while later hashes use
  -- insertion-order JSON.stringify preimages.
  v_predecessor_content_json:='{"country":"IN","price_display":"tax_exclusive","rounding":"document","taxes":[{"applies_to":["room_revenue"],"code":"GST_ROOM","mode":"slab_percent","name":"GST on accommodation","slab_basis":"transaction_value","slabs":[{"itc_eligible":true,"rate":0.12,"upto_minor":750000},{"itc_eligible":true,"rate":0.18,"upto_minor":null}]},{"applies_to":["fnb_revenue"],"code":"GST_FNB","mode":"percent","name":"GST on F&B (restaurant in hotel)","rate":0.05}]}';
  v_successor_content_json:='{"country":"IN","price_display":"tax_exclusive","rounding":"document","taxes":[{"applies_to":["room_revenue"],"code":"GST_ROOM","mode":"slab_percent","name":"GST on accommodation","slab_basis":"transaction_value","slabs":[{"itc_eligible":false,"rate":0.05,"upto_minor":750000},{"itc_eligible":true,"rate":0.18,"upto_minor":null}]},{"applies_to":["fnb_revenue"],"code":"GST_FNB","mode":"percent","name":"GST on F&B (restaurant in hotel)","rate":0.05}]}';
  SELECT * INTO v_predecessor_extension FROM public.extension
   WHERE id='a806f516-fed6-5768-b310-94aa03286adb' AND tenant_id IS NULL AND type='tax_jurisdiction'
     AND key='in-gst-lodging' AND version=1 AND status='retired' FOR SHARE;
  IF NOT FOUND OR v_predecessor_extension.content<>v_predecessor_content_json::jsonb
     OR lower(v_predecessor_extension.effective)<>'2022-07-17T18:30:00Z'::timestamptz
     OR upper(v_predecessor_extension.effective)<>'2025-09-21T18:30:00Z'::timestamptz
     OR encode(public.digest(pg_catalog.convert_to(v_predecessor_content_json,'UTF8'),'sha256'),'hex')<>'2160e1747afcb3c280f1fd66e55534a5be563a10f277e8fcc178324e51abaa08'
    THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='persisted predecessor rate version is unavailable'; END IF;
  SELECT * INTO v_successor_extension FROM public.extension
   WHERE id='0b21daf2-ea6e-5568-9c21-69e4d4424574' AND tenant_id IS NULL AND type='tax_jurisdiction'
     AND key='in-gst-lodging' AND version=2 AND status='active' FOR SHARE;
  IF NOT FOUND OR v_successor_extension.content<>v_successor_content_json::jsonb
     OR lower(v_successor_extension.effective)<>'2025-09-21T18:30:00Z'::timestamptz
     OR upper(v_successor_extension.effective) IS NOT NULL
     OR encode(public.digest(pg_catalog.convert_to(v_successor_content_json,'UTF8'),'sha256'),'hex')<>'eb323eff707aad1e460b425c87b448d4e924d2eb17499094abad71b33c69a820'
    THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='persisted successor rate version is unavailable'; END IF;

  v_pair_predecessor_json:='{"content":'||v_predecessor_content_json||',"contentHash":"2160e1747afcb3c280f1fd66e55534a5be563a10f277e8fcc178324e51abaa08","effectiveFromInstant":"2022-07-17T18:30:00.000000Z","effectiveToInstant":"2025-09-21T18:30:00.000000Z","extensionId":"a806f516-fed6-5768-b310-94aa03286adb","gstRoomSlabs":[{"itcEligible":true,"rate":0.12,"uptoMinor":750000},{"itcEligible":true,"rate":0.18,"uptoMinor":null}],"key":"in-gst-lodging","status":"retired","version":1}';
  v_pair_successor_json:='{"content":'||v_successor_content_json||',"contentHash":"eb323eff707aad1e460b425c87b448d4e924d2eb17499094abad71b33c69a820","effectiveFromInstant":"2025-09-21T18:30:00.000000Z","effectiveToInstant":null,"extensionId":"0b21daf2-ea6e-5568-9c21-69e4d4424574","gstRoomSlabs":[{"itcEligible":false,"rate":0.05,"uptoMinor":750000},{"itcEligible":true,"rate":0.18,"uptoMinor":null}],"key":"in-gst-lodging","status":"active","version":2}';
  v_rate_pair_json:='{"cutoverInstant":"2025-09-21T18:30:00.000000Z","predecessor":'||v_pair_predecessor_json||',"predecessorOwnerTenantId":null,"propertyNode":"'||p_property::text||'","sourceHashes":{"notification04_2022":"c6d264f1906375e93466dd97b2c60bb9b21c0dec34b93900b15237b4a98b7716","notification15_2025":"46c9447579017d8bf1fefd75b6e6a48856dab7b23e44c7e06babfdc99ae9d289","notification20_2019":"ee920c82c30ed88d9bb515d7d79b975cc2ed599c6dad411d04d8b7fcd5a86901"},"statutoryLowerBandDelta":{"predecessorHasNilBand":false,"predecessorItcEligible":true,"predecessorRate":0.12,"successorHasNilBand":false,"successorItcEligible":false,"successorRate":0.05,"thresholdMinor":750000},"successor":'||v_pair_successor_json||',"successorOwnerTenantId":null,"tenantId":"'||p_tenant::text||'"}';
  v_rate_pair_hash:=encode(public.digest(pg_catalog.convert_to(v_rate_pair_json,'UTF8'),'sha256'),'hex');
  v_rate_identity_predecessor_json:='{"contentHash":"2160e1747afcb3c280f1fd66e55534a5be563a10f277e8fcc178324e51abaa08","effectiveFromInstant":"2022-07-17T18:30:00.000000Z","effectiveToInstant":"2025-09-21T18:30:00.000000Z","extensionId":"a806f516-fed6-5768-b310-94aa03286adb","status":"retired","version":1}';
  v_rate_identity_successor_json:='{"contentHash":"eb323eff707aad1e460b425c87b448d4e924d2eb17499094abad71b33c69a820","effectiveFromInstant":"2025-09-21T18:30:00.000000Z","effectiveToInstant":null,"extensionId":"0b21daf2-ea6e-5568-9c21-69e4d4424574","status":"active","version":2}';
  v_rate_change_json:='{"cutoverInstant":"2025-09-21T18:30:00.000000Z","notification15SourceHash":"46c9447579017d8bf1fefd75b6e6a48856dab7b23e44c7e06babfdc99ae9d289","pairEvidenceHash":"'||v_rate_pair_hash||'","predecessor":'||v_rate_identity_predecessor_json||',"propertyNode":"'||p_property::text||'","rateChangeDate":"2025-09-22","successor":'||v_rate_identity_successor_json||'}';
  v_rate_change_hash:=encode(public.digest(pg_catalog.convert_to(v_rate_change_json,'UTF8'),'sha256'),'hex');

  v_lineage_json:='{"lineageId":"'||p_lineage::text||'","holdBindingId":"'||v_lineage.binding_id::text||'","attributionId":"'||p_attribution::text||'","reservationId":"'||p_reservation::text||'","segmentId":"'||v_lineage.segment_id::text||'","originQuoteHash":"'||v_lineage.origin_quote_hash||'","snapshotHash":"'||v_lineage.snapshot_hash||'","currency":"INR"}';
  v_attribution_json:='{"originKind":"rate_quote","lineId":"room","revenueGroup":"room_revenue"}';
  v_nested_service_json:='{"serviceProvisionSnapshotId":"'||v_service.id::text||'","serviceProvisionDate":"'||v_service.service_provision_date::text||'","serviceProvisionSource":"governed_service_provision_record","serviceProvisionEvidenceSha256":"'||v_service.service_provision_evidence_sha256||'","legalRule":"CGST_ACT_13_2_B_SERVICE_PROVISION_DATE_INPUT_ONLY","reservationLineage":'||v_lineage_json||',"attribution":'||v_attribution_json||'}';
  v_service_json:='{"tenantId":"'||p_tenant::text||'","serviceProvisionSnapshotId":"'||v_service.id::text||'","propertyNode":"'||p_property::text||'","reservationLineage":'||v_lineage_json||',"attribution":'||v_attribution_json||',"serviceProvisionDate":"'||v_service.service_provision_date::text||'","serviceProvisionSource":"governed_service_provision_record","serviceProvisionEvidenceSha256":"'||v_service.service_provision_evidence_sha256||'","legalRule":"CGST_ACT_13_2_B_SERVICE_PROVISION_DATE_INPUT_ONLY"}';
  v_service_hash:=encode(public.digest(pg_catalog.convert_to(v_service_json,'UTF8'),'sha256'),'hex');
  v_payment_json:='{"tenantId":"'||p_tenant::text||'","paymentReceiptSnapshotId":"'||v_payment.id::text||'","propertyNode":"'||p_property::text||'","serviceProvision":'||v_nested_service_json||',"supplierBooksEntryDate":"'||v_payment.supplier_books_entry_date::text||'","supplierBankCreditDate":"'||v_payment.supplier_bank_credit_date::text||'","paymentReceiptDate":"'||v_payment.payment_receipt_date::text||'","coverageScope":"full_attribution","amountMinor":"'||v_payment.amount_minor::text||'","currency":"INR","paymentReceiptSource":"governed_supplier_payment_receipt_record","paymentReceiptEvidenceSha256":"'||v_payment.payment_receipt_evidence_sha256||'","legalRule":"CGST_ACT_13_2_EXPLANATION_II_PAYMENT_RECEIPT_DATE_INPUT_ONLY"}';
  v_payment_hash:=encode(public.digest(pg_catalog.convert_to(v_payment_json,'UTF8'),'sha256'),'hex');
  v_invoice_json:='{"tenantId":"'||p_tenant::text||'","invoiceIssueSnapshotId":"'||v_invoice.id::text||'","propertyNode":"'||p_property::text||'","serviceProvision":'||v_nested_service_json||',"serviceProvisionDate":"'||v_service.service_provision_date::text||'","invoiceSeries":'||pg_catalog.to_json(v_invoice.invoice_series)::text||',"invoiceSerial":'||pg_catalog.to_json(v_invoice.invoice_serial)::text||',"invoiceIssueDate":"'||v_invoice.invoice_issue_date::text||'","coverageScope":"full_attribution","amountMinor":"'||v_invoice.amount_minor::text||'","currency":"INR","invoiceIssueSource":"governed_supplier_tax_invoice_record","invoiceIssueEvidenceSha256":"'||v_invoice.invoice_issue_evidence_sha256||'","legalRule":"CGST_ACT_13_2_INVOICE_DATE_INPUT_ONLY"}';
  v_invoice_hash:=encode(public.digest(pg_catalog.convert_to(v_invoice_json,'UTF8'),'sha256'),'hex');
  -- Re-derive the six statutory cases rather than accepting the caller's selector.
  IF (p_service_date<p_rate_change_date AND p_invoice_date>p_rate_change_date AND p_payment_date>p_rate_change_date AND (p_section14_case<>'supply_before_invoice_after_payment_after' OR p_selected_side<>'successor' OR p_time_of_supply_date<>least(p_invoice_date,p_payment_date)))
    OR (p_service_date<p_rate_change_date AND p_invoice_date<p_rate_change_date AND p_payment_date>p_rate_change_date AND (p_section14_case<>'supply_invoice_before_payment_after' OR p_selected_side<>'predecessor' OR p_time_of_supply_date<>p_invoice_date))
    OR (p_service_date<p_rate_change_date AND p_invoice_date>p_rate_change_date AND p_payment_date<p_rate_change_date AND (p_section14_case<>'supply_payment_before_invoice_after' OR p_selected_side<>'predecessor' OR p_time_of_supply_date<>p_payment_date))
    OR (p_service_date>p_rate_change_date AND p_invoice_date<p_rate_change_date AND p_payment_date>p_rate_change_date AND (p_section14_case<>'supply_after_invoice_before_payment_after' OR p_selected_side<>'successor' OR p_time_of_supply_date<>p_payment_date))
    OR (p_service_date>p_rate_change_date AND p_invoice_date<p_rate_change_date AND p_payment_date<p_rate_change_date AND (p_section14_case<>'supply_after_invoice_payment_before' OR p_selected_side<>'predecessor' OR p_time_of_supply_date<>least(p_invoice_date,p_payment_date)))
    OR (p_service_date>p_rate_change_date AND p_invoice_date>p_rate_change_date AND p_payment_date<p_rate_change_date AND (p_section14_case<>'supply_invoice_after_payment_before' OR p_selected_side<>'successor' OR p_time_of_supply_date<>p_invoice_date))
    OR NOT ((p_service_date<p_rate_change_date AND p_invoice_date>p_rate_change_date AND p_payment_date>p_rate_change_date) OR (p_service_date<p_rate_change_date AND p_invoice_date<p_rate_change_date AND p_payment_date>p_rate_change_date) OR (p_service_date<p_rate_change_date AND p_invoice_date>p_rate_change_date AND p_payment_date<p_rate_change_date) OR (p_service_date>p_rate_change_date AND p_invoice_date<p_rate_change_date AND p_payment_date>p_rate_change_date) OR (p_service_date>p_rate_change_date AND p_invoice_date<p_rate_change_date AND p_payment_date<p_rate_change_date) OR (p_service_date>p_rate_change_date AND p_invoice_date>p_rate_change_date AND p_payment_date<p_rate_change_date)) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Section14 case does not derive from dates'; END IF;
  IF p_calendar_dates IS NULL OR p_calendar_states IS NULL
     OR (p_calendar_authority IS NULL)<>(v_calendar_count=0)
     OR pg_catalog.cardinality(p_calendar_states)<>v_calendar_count OR v_calendar_count>366
     OR (v_calendar_count>0 AND (pg_catalog.array_ndims(p_calendar_dates)<>1 OR pg_catalog.array_lower(p_calendar_dates,1)<>1
       OR pg_catalog.array_ndims(p_calendar_states)<>1 OR pg_catalog.array_lower(p_calendar_states,1)<>1))
    THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='calendar evidence shape is invalid'; END IF;
  IF (v_payment.supplier_bank_credit_date>p_rate_change_date)<>(v_calendar_count>0) THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='calendar evidence branch conflicts with persisted payment truth'; END IF;
  IF v_payment.supplier_bank_credit_date>p_rate_change_date THEN
    v_proviso_json:='{"state":"working_day_calendar_required","supplierBooksEntryDate":"'||v_payment.supplier_books_entry_date::text||'","supplierBankCreditDate":"'||v_payment.supplier_bank_credit_date::text||'","rateChangeDate":"'||p_rate_change_date::text||'","legalRule":"CGST_ACT_14_PAYMENT_CREDIT_FOUR_WORKING_DAY_PROVISO_GUARD"}';
  ELSE
    v_proviso_json:='{"state":"proviso_not_triggered_on_recorded_dates","paymentReceiptDate":"'||least(v_payment.supplier_books_entry_date,v_payment.supplier_bank_credit_date)::text||'","supplierBooksEntryDate":"'||v_payment.supplier_books_entry_date::text||'","supplierBankCreditDate":"'||v_payment.supplier_bank_credit_date::text||'","rateChangeDate":"'||p_rate_change_date::text||'","legalRule":"CGST_ACT_14_PAYMENT_CREDIT_FOUR_WORKING_DAY_PROVISO_GUARD"}';
  END IF;
  v_proviso_hash:=encode(public.digest(pg_catalog.convert_to(v_proviso_json,'UTF8'),'sha256'),'hex');
  IF v_calendar_count>0 THEN
    IF v_calendar_count<4 OR p_calendar_authority!~'^[A-Z][A-Z0-9_.:-]{2,127}$'
       OR p_calendar_source_hash IS NULL OR p_calendar_source_hash!~'^[0-9a-f]{64}$'
       OR p_calendar_through IS DISTINCT FROM p_calendar_dates[v_calendar_count]
      THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='calendar evidence is incomplete'; END IF;
    FOR v_i IN 1..v_calendar_count LOOP
      IF p_calendar_dates[v_i]<>p_rate_change_date+v_i OR p_calendar_states[v_i] NOT IN ('working','non_working') THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='calendar evidence is not dense'; END IF;
      IF p_calendar_states[v_i]='working' THEN
        v_working:=v_working+1;
        IF pg_catalog.cardinality(v_first_four)<4 THEN v_first_four:=pg_catalog.array_append(v_first_four,p_calendar_dates[v_i]); END IF;
      END IF;
    END LOOP;
    IF v_working<4 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='calendar evidence must establish at least four working days'; END IF;
    v_fourth_working:=v_first_four[4];
    IF pg_catalog.array_position(p_calendar_dates,v_payment.supplier_bank_credit_date) IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='calendar evidence does not contain persisted bank-credit date'; END IF;
    v_governed_branch:=CASE WHEN v_payment.supplier_bank_credit_date>v_fourth_working THEN 'bank_credit_after_four_working_days' ELSE 'ordinary_earlier_of_within_four_working_days' END;
    v_governed_payment_date:=CASE WHEN v_payment.supplier_bank_credit_date>v_fourth_working THEN v_payment.supplier_bank_credit_date ELSE least(v_payment.supplier_books_entry_date,v_payment.supplier_bank_credit_date) END;
    IF p_payment_date<>v_governed_payment_date THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='calendar evidence does not derive governed payment date'; END IF;
    SELECT '['||pg_catalog.string_agg('{"date":"'||p_calendar_dates[i]::text||'","state":"'||p_calendar_states[i]||'"}',',' ORDER BY i)||']'
      INTO v_calendar_days_json FROM pg_catalog.generate_subscripts(p_calendar_dates,1)i;
    SELECT '['||pg_catalog.string_agg('"'||v_first_four[i]::text||'"',',' ORDER BY i)||']'
      INTO v_first_four_json FROM pg_catalog.generate_subscripts(v_first_four,1)i;
    v_calendar_json:='{"tenantId":"'||p_tenant::text||'","rateChangeDate":"'||p_rate_change_date::text||'","throughDate":"'||p_calendar_through::text||'","jurisdiction":"IN","authorityId":"'||p_calendar_authority||'","sourceDigestSha256":"'||p_calendar_source_hash||'","calendarDays":'||v_calendar_days_json||',"firstFourWorkingDates":'||v_first_four_json||',"fourthWorkingDayDate":"'||v_fourth_working::text||'","legalRule":"CGST_ACT_14_FOUR_WORKING_DAY_CALENDAR_EVIDENCE_ONLY"}';
    v_calendar_hash:=encode(public.digest(pg_catalog.convert_to(v_calendar_json,'UTF8'),'sha256'),'hex');
    v_governed_json:='{"tenantId":"'||p_tenant::text||'","rateChangeDate":"'||p_rate_change_date::text||'","supplierBooksEntryDate":"'||v_payment.supplier_books_entry_date::text||'","supplierBankCreditDate":"'||v_payment.supplier_bank_credit_date::text||'","fourthWorkingDayDate":"'||v_fourth_working::text||'","paymentReceiptDate":"'||v_governed_payment_date::text||'","branch":"'||v_governed_branch||'","calendarAuthorityId":"'||p_calendar_authority||'","calendarSourceDigestSha256":"'||p_calendar_source_hash||'","legalRule":"CGST_ACT_14_PAYMENT_RECEIPT_DATE_FOUR_WORKING_DAY_PROVISO","predecessorHashes":{"rateChangeDate":"'||v_rate_change_hash||'","paymentProviso":"'||v_proviso_hash||'","workingDayCalendar":"'||v_calendar_hash||'"}}';
    v_governed_hash:=encode(public.digest(pg_catalog.convert_to(v_governed_json,'UTF8'),'sha256'),'hex');
    v_working_hash_json:='"'||v_calendar_hash||'"'; v_governed_hash_json:='"'||v_governed_hash||'"';
  ELSIF p_calendar_source_hash IS NOT NULL OR p_calendar_through IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='ordinary receipt carries calendar evidence'; END IF;
  IF v_calendar_count=0 AND p_payment_date<>v_payment.payment_receipt_date THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='ordinary payment date is not persisted truth'; END IF;
  v_selected_from_json:=CASE p_selected_side WHEN 'predecessor' THEN '2022-07-17T18:30:00.000000Z' ELSE '2025-09-21T18:30:00.000000Z' END;
  v_selected_to_json:=CASE p_selected_side WHEN 'predecessor' THEN '"2025-09-21T18:30:00.000000Z"' ELSE 'null' END;
  v_section14_json:='{"tenantId":"'||p_tenant::text||'","propertyNode":"'||p_property::text||'","reservationId":"'||p_reservation::text||'","case":"'||p_section14_case||'","serviceProvisionDate":"'||p_service_date::text||'","invoiceIssueDate":"'||p_invoice_date::text||'","paymentReceiptDate":"'||p_payment_date::text||'","rateChangeDate":"'||p_rate_change_date::text||'","timeOfSupplyDate":"'||p_time_of_supply_date::text||'","selectedVersionSide":"'||p_selected_side||'","selectedVersion":{"extensionId":"'||p_selected_extension::text||'","version":'||p_selected_version::text||',"status":"'||p_selected_status||'","contentHash":"'||p_selected_content_hash||'","effectiveFromInstant":"'||v_selected_from_json||'","effectiveToInstant":'||v_selected_to_json||'},"legalRule":"CGST_ACT_14_CHANGE_IN_RATE_SIX_CASE_RATE_VERSION_SELECTION","predecessorHashes":{"rateVersionPair":"'||v_rate_pair_hash||'","rateChangeDate":"'||v_rate_change_hash||'","serviceProvision":"'||v_service_hash||'","paymentReceipt":"'||v_payment_hash||'","invoiceIssue":"'||v_invoice_hash||'","paymentProviso":"'||v_proviso_hash||'","workingDayCalendar":'||v_working_hash_json||',"governedPaymentReceipt":'||v_governed_hash_json||'}}';
  v_section14_hash:=encode(public.digest(pg_catalog.convert_to(v_section14_json,'UTF8'),'sha256'),'hex');
  IF v_section14_hash IS DISTINCT FROM p_section14_hash THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Section14 evidence hash does not byte-match complete persisted ancestry'; END IF;
  v_n:=coalesce(pg_catalog.cardinality(p_night_ordinals),0); v_c:=coalesce(pg_catalog.cardinality(p_component_night_ordinals),0);
  IF v_n<1 OR v_n>366 OR pg_catalog.cardinality(p_night_dates)<>v_n OR pg_catalog.cardinality(p_night_amounts)<>v_n OR pg_catalog.cardinality(p_slab_upto)<>v_n OR pg_catalog.cardinality(p_aggregate_bps)<>v_n OR pg_catalog.cardinality(p_itc_eligible)<>v_n OR pg_catalog.cardinality(p_component_ordinals)<>v_c OR pg_catalog.cardinality(p_component_identities)<>v_c OR pg_catalog.cardinality(p_component_bps)<>v_c THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='quoted applicability arrays are incomplete'; END IF;
  v_expected_identities:=CASE v_derived_family WHEN 'igst' THEN ARRAY['igst'] WHEN 'cgst_sgst' THEN ARRAY['cgst','sgst'] WHEN 'cgst_utgst' THEN ARRAY['cgst','utgst'] ELSE NULL END;
  IF v_expected_identities IS NULL OR v_c<>v_n*pg_catalog.cardinality(v_expected_identities) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='component family is invalid'; END IF;
  FOR v_i IN 1..v_n LOOP
    IF p_night_ordinals[v_i]<>v_i-1 OR p_night_amounts[v_i]<=0 OR (p_night_amounts[v_i]<=750000 AND (p_slab_upto[v_i] IS DISTINCT FROM 750000 OR p_aggregate_bps[v_i]<>v_expected_lower OR p_itc_eligible[v_i]<>(p_selected_side='predecessor'))) OR (p_night_amounts[v_i]>750000 AND (p_slab_upto[v_i] IS NOT NULL OR p_aggregate_bps[v_i]<>1800 OR NOT p_itc_eligible[v_i])) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='quoted room-night slab is invalid'; END IF;
  END LOOP;
  FOR v_i IN 1..v_c LOOP
    IF p_component_night_ordinals[v_i]<>((v_i-1)/pg_catalog.cardinality(v_expected_identities))::integer OR p_component_ordinals[v_i]<>((v_i-1)%pg_catalog.cardinality(v_expected_identities)) OR p_component_identities[v_i]<>v_expected_identities[((v_i-1)%pg_catalog.cardinality(v_expected_identities))+1] OR p_component_bps[v_i]<>(p_aggregate_bps[p_component_night_ordinals[v_i]+1]/pg_catalog.cardinality(v_expected_identities)) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='ordered component-rate split is invalid'; END IF;
  END LOOP;
  -- Rebuild the exact JSON.stringify preimage emitted by Order341. All strings
  -- below are already constrained to canonical UUID/hash/date/enum alphabets.
  SELECT '['||pg_catalog.string_agg(
    '{"ordinal":"'||p_night_ordinals[n]::text||'","businessDate":"'||p_night_dates[n]::text||'","quotedAmountMinor":"'||p_night_amounts[n]::text||'","slab":{"uptoMinor":'||coalesce(p_slab_upto[n]::text,'null')||',"aggregateRate":'||CASE p_aggregate_bps[n] WHEN 500 THEN '0.05' WHEN 1200 THEN '0.12' WHEN 1800 THEN '0.18' END||',"aggregateRateBasisPoints":'||p_aggregate_bps[n]::text||',"itcEligible":'||CASE WHEN p_itc_eligible[n] THEN 'true' ELSE 'false' END||',"components":['||(
      SELECT pg_catalog.string_agg('{"identity":"'||p_component_identities[c]||'","rate":'||CASE p_component_bps[c] WHEN 250 THEN '0.025' WHEN 500 THEN '0.05' WHEN 600 THEN '0.06' WHEN 900 THEN '0.09' WHEN 1200 THEN '0.12' WHEN 1800 THEN '0.18' END||',"rateBasisPoints":'||p_component_bps[c]::text||'}',',' ORDER BY p_component_ordinals[c]) FROM pg_catalog.generate_subscripts(p_component_identities,1)c WHERE p_component_night_ordinals[c]=p_night_ordinals[n]
    )||']}}',',' ORDER BY p_night_ordinals[n])||']'
    INTO v_component_json FROM pg_catalog.generate_subscripts(p_night_ordinals,1)n;
  v_selected_from_json:=CASE p_selected_side WHEN 'predecessor' THEN '2022-07-17T18:30:00.000000Z' ELSE '2025-09-21T18:30:00.000000Z' END;
  v_selected_to_json:=CASE p_selected_side WHEN 'predecessor' THEN '"2025-09-21T18:30:00.000000Z"' ELSE 'null' END;
  v_order341_json:='{"tenantId":"'||p_tenant::text||'","propertyNode":"'||p_property::text||'","reservationId":"'||p_reservation::text||'","folioId":"'||p_folio::text||'","section14":{"case":"'||p_section14_case||'","timeOfSupplyDate":"'||p_time_of_supply_date::text||'","selectedVersionSide":"'||p_selected_side||'","selectedVersion":{"extensionId":"'||p_selected_extension::text||'","version":'||p_selected_version::text||',"status":"'||p_selected_status||'","contentHash":"'||p_selected_content_hash||'","effectiveFromInstant":"'||v_selected_from_json||'","effectiveToInstant":'||v_selected_to_json||'}},"reservationLineage":{"lineageId":"'||p_lineage::text||'","holdBindingId":"'||v_lineage.binding_id::text||'","reservationId":"'||p_reservation::text||'","segmentId":"'||v_lineage.segment_id::text||'","folioId":"'||p_folio::text||'","attributionId":"'||p_attribution::text||'","originQuoteHash":"'||v_lineage.origin_quote_hash||'","snapshotHash":"'||v_lineage.snapshot_hash||'","currency":"INR"},"components":'||v_component_json||',"predecessorHashes":{"section14":"'||p_section14_hash||'","levyComponentIdentity":"'||p_levy_hash||'","reservationLineage":"'||p_lineage_hash||'","attributionSnapshot":"'||p_attribution_hash||'"}}';
  IF encode(public.digest(pg_catalog.convert_to(v_order341_json,'UTF8'),'sha256'),'hex')<>p_evidence_hash THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Order341 evidence hash does not byte-match typed result'; END IF;
  IF v_replay THEN
    IF v_existing.property_node IS DISTINCT FROM p_property OR v_existing.reservation_id IS DISTINCT FROM p_reservation OR v_existing.folio_id IS DISTINCT FROM p_folio OR v_existing.reservation_lineage_id IS DISTINCT FROM p_lineage OR v_existing.attribution_id IS DISTINCT FROM p_attribution OR v_existing.service_provision_snapshot_id IS DISTINCT FROM p_service_snapshot OR v_existing.payment_receipt_snapshot_id IS DISTINCT FROM p_payment_snapshot OR v_existing.invoice_issue_snapshot_id IS DISTINCT FROM p_invoice_snapshot OR v_existing.family_jurisdiction_extension_id IS DISTINCT FROM p_family_jurisdiction_extension OR v_existing.classification_id IS DISTINCT FROM p_classification OR v_existing.supplier_service_location_id IS DISTINCT FROM p_supplier_service_location OR v_existing.supplier_sez_status_id IS DISTINCT FROM p_supplier_sez_status OR v_existing.recipient_sez_status_id IS DISTINCT FROM p_recipient_sez_status OR v_existing.recipient_party_id IS DISTINCT FROM p_recipient_party OR v_existing.final_valuation_id IS DISTINCT FROM v_valuation.id OR v_existing.actor_id IS DISTINCT FROM p_actor OR v_existing.section14_case IS DISTINCT FROM p_section14_case OR v_existing.service_provision_date IS DISTINCT FROM p_service_date OR v_existing.invoice_issue_date IS DISTINCT FROM p_invoice_date OR v_existing.payment_receipt_date IS DISTINCT FROM p_payment_date OR v_existing.rate_change_date IS DISTINCT FROM p_rate_change_date OR v_existing.time_of_supply_date IS DISTINCT FROM p_time_of_supply_date OR v_existing.selected_version_side IS DISTINCT FROM p_selected_side OR v_existing.selected_extension_id IS DISTINCT FROM p_selected_extension OR v_existing.selected_extension_version IS DISTINCT FROM p_selected_version OR v_existing.selected_extension_status IS DISTINCT FROM p_selected_status OR v_existing.selected_content_hash IS DISTINCT FROM p_selected_content_hash OR v_existing.selected_effective_from IS DISTINCT FROM p_selected_from OR v_existing.selected_effective_to IS DISTINCT FROM p_selected_to OR v_existing.component_family IS DISTINCT FROM p_component_family OR v_existing.section14_evidence_hash IS DISTINCT FROM p_section14_hash OR v_existing.levy_component_identity_evidence_hash IS DISTINCT FROM p_levy_hash OR v_existing.reservation_lineage_evidence_hash IS DISTINCT FROM p_lineage_hash OR v_existing.attribution_snapshot_evidence_hash IS DISTINCT FROM p_attribution_hash OR v_existing.evidence_hash IS DISTINCT FROM p_evidence_hash OR v_existing.calendar_authority_id IS DISTINCT FROM p_calendar_authority OR v_existing.calendar_source_digest_sha256 IS DISTINCT FROM p_calendar_source_hash OR v_existing.calendar_through_date IS DISTINCT FROM p_calendar_through OR v_existing.calendar_dates IS DISTINCT FROM p_calendar_dates OR v_existing.calendar_states IS DISTINCT FROM p_calendar_states
      OR (SELECT array_agg(ordinal ORDER BY ordinal) FROM public.india_gst_accommodation_quoted_rate_applicability_room_night replay_night WHERE tenant_id=p_tenant AND replay_night.applicability_id=v_existing.id) IS DISTINCT FROM p_night_ordinals
      OR (SELECT array_agg(business_date ORDER BY ordinal) FROM public.india_gst_accommodation_quoted_rate_applicability_room_night replay_night WHERE tenant_id=p_tenant AND replay_night.applicability_id=v_existing.id) IS DISTINCT FROM p_night_dates
      OR (SELECT array_agg(quoted_amount_minor ORDER BY ordinal) FROM public.india_gst_accommodation_quoted_rate_applicability_room_night replay_night WHERE tenant_id=p_tenant AND replay_night.applicability_id=v_existing.id) IS DISTINCT FROM p_night_amounts
      OR (SELECT array_agg(slab_upto_minor ORDER BY ordinal) FROM public.india_gst_accommodation_quoted_rate_applicability_room_night replay_night WHERE tenant_id=p_tenant AND replay_night.applicability_id=v_existing.id) IS DISTINCT FROM p_slab_upto
      OR (SELECT array_agg(aggregate_rate_basis_points ORDER BY ordinal) FROM public.india_gst_accommodation_quoted_rate_applicability_room_night replay_night WHERE tenant_id=p_tenant AND replay_night.applicability_id=v_existing.id) IS DISTINCT FROM p_aggregate_bps
      OR (SELECT array_agg(itc_eligible ORDER BY ordinal) FROM public.india_gst_accommodation_quoted_rate_applicability_room_night replay_night WHERE tenant_id=p_tenant AND replay_night.applicability_id=v_existing.id) IS DISTINCT FROM p_itc_eligible
      OR (SELECT array_agg(room_night_ordinal ORDER BY room_night_ordinal,component_ordinal) FROM public.india_gst_accommodation_quoted_rate_component replay_component WHERE tenant_id=p_tenant AND replay_component.applicability_id=v_existing.id) IS DISTINCT FROM p_component_night_ordinals
      OR (SELECT array_agg(component_ordinal ORDER BY room_night_ordinal,component_ordinal) FROM public.india_gst_accommodation_quoted_rate_component replay_component WHERE tenant_id=p_tenant AND replay_component.applicability_id=v_existing.id) IS DISTINCT FROM p_component_ordinals
      OR (SELECT array_agg(component_identity ORDER BY room_night_ordinal,component_ordinal) FROM public.india_gst_accommodation_quoted_rate_component replay_component WHERE tenant_id=p_tenant AND replay_component.applicability_id=v_existing.id) IS DISTINCT FROM p_component_identities
      OR (SELECT array_agg(rate_basis_points ORDER BY room_night_ordinal,component_ordinal) FROM public.india_gst_accommodation_quoted_rate_component replay_component WHERE tenant_id=p_tenant AND replay_component.applicability_id=v_existing.id) IS DISTINCT FROM p_component_bps THEN RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='quoted applicability request has divergent evidence'; END IF;
    RETURN QUERY SELECT v_existing.id,v_existing.evidence_hash,false; RETURN;
  END IF;
  INSERT INTO public.india_gst_accommodation_quoted_rate_applicability VALUES(p_tenant,v_id,p_property,p_reservation,p_folio,p_lineage,p_attribution,p_service_snapshot,p_payment_snapshot,p_invoice_snapshot,p_family_jurisdiction_extension,p_classification,p_supplier_service_location,p_supplier_sez_status,p_recipient_sez_status,p_recipient_party,v_valuation.id,p_request,p_section14_case,p_service_date,p_invoice_date,p_payment_date,p_rate_change_date,p_time_of_supply_date,p_selected_side,p_selected_extension,p_selected_version,p_selected_status,p_selected_content_hash,p_selected_from,p_selected_to,v_derived_family,p_section14_hash,p_levy_hash,p_lineage_hash,p_attribution_hash,p_evidence_hash,p_calendar_authority,p_calendar_source_hash,p_calendar_through,p_calendar_dates,p_calendar_states,p_actor,pg_catalog.transaction_timestamp());
  FOR v_i IN 1..v_n LOOP INSERT INTO public.india_gst_accommodation_quoted_rate_applicability_room_night VALUES(p_tenant,v_id,p_night_ordinals[v_i],p_night_dates[v_i],p_night_amounts[v_i],'INR',p_slab_upto[v_i],p_aggregate_bps[v_i],p_itc_eligible[v_i]); END LOOP;
  FOR v_i IN 1..v_c LOOP INSERT INTO public.india_gst_accommodation_quoted_rate_component VALUES(p_tenant,v_id,p_component_night_ordinals[v_i],p_component_ordinals[v_i],p_component_identities[v_i],p_component_bps[v_i]); END LOOP;
  SELECT (pg_catalog.transaction_timestamp() AT TIME ZONE timezone)::date INTO v_business_date FROM public.org_node WHERE tenant_id=p_tenant AND id=p_property;
  INSERT INTO public.fact_log(tenant_id,entity_type,entity_id,fact_type,valid_from,business_date,actor_id,payload) VALUES(p_tenant,'india_gst_accommodation_quoted_rate_applicability',v_id,'recorded',pg_catalog.transaction_timestamp(),v_business_date,p_actor,pg_catalog.jsonb_build_object('applicabilityId',v_id,'evidenceHash',p_evidence_hash)) RETURNING id INTO v_fact;
  INSERT INTO public.outbox(tenant_id,property_node,business_date,aggregate_type,aggregate_id,event_type,actor_id,correlation_id,payload) VALUES(p_tenant,p_property,v_business_date,'india_gst_accommodation_quoted_rate_applicability',v_id,'india_gst.accommodation_quoted_rate_applicability_recorded',p_actor,p_request,pg_catalog.jsonb_build_object('applicabilityId',v_id,'reservationId',p_reservation,'folioId',p_folio,'evidenceHash',p_evidence_hash));
  RETURN QUERY SELECT v_id,p_evidence_hash,true;
END $_$;


--
-- Name: record_occupancy(uuid, uuid, tstzrange, uuid, text, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_occupancy(p_tenant uuid, p_space uuid, p_period tstzrange, p_slot uuid, p_slot_kind text, p_exclusive boolean) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'pg_temp'
    AS $$
DECLARE
  v_id uuid;
  v_cap int;
  v_pos int;
  v_authority text := NULLIF(
    pg_catalog.current_setting('app.tenant_id', true), ''
  );
  v_invoker_role text := pg_catalog.current_setting('role', true);
  v_tenant uuid;
  v_parent_valid boolean := false;
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

  IF p_period IS NULL OR pg_catalog.isempty(p_period)
     OR pg_catalog.lower_inf(p_period) OR pg_catalog.upper_inf(p_period)
     OR pg_catalog.lower(p_period) >= pg_catalog.upper(p_period) THEN
    RAISE EXCEPTION 'occupancy period must be finite and nonempty'
      USING ERRCODE = '22023';
  END IF;
  IF p_exclusive IS NULL THEN
    RAISE EXCEPTION 'occupancy claim mode is required' USING ERRCODE = '22023';
  END IF;
  IF p_slot_kind IS NULL OR p_slot_kind NOT IN ('hold', 'segment', 'ooo') THEN
    RAISE EXCEPTION 'invalid occupancy slot kind' USING ERRCODE = '22023';
  END IF;

  IF p_slot_kind = 'hold' THEN
    SELECT true
      INTO v_parent_valid
      FROM public.hold AS h
      JOIN public.sellable_unit AS su
        ON su.id = h.sellable_unit_id
       AND su.tenant_id = h.tenant_id
       AND su.status = 'active'
      JOIN public.unit_type AS ut
        ON ut.id = su.unit_type_id
       AND ut.tenant_id = su.tenant_id
       AND ut.property_node = h.property_node
      JOIN public.sellable_unit_space AS sus
        ON sus.sellable_unit_id = su.id
       AND sus.tenant_id = su.tenant_id
       AND sus.space_id = p_space
       AND sus.claim_mode = CASE WHEN p_exclusive THEN 'exclusive' ELSE 'positional' END
      JOIN public.space AS s
        ON s.id = sus.space_id
       AND s.tenant_id = sus.tenant_id
       AND s.property_node = h.property_node
       AND s.status = 'active'
     WHERE h.id = p_slot
       AND h.tenant_id = v_tenant
       AND h.status = 'active'
       AND h.expires_at > pg_catalog.transaction_timestamp()
       AND h.period = p_period;
  ELSIF p_slot_kind = 'segment' THEN
    SELECT true
      INTO v_parent_valid
      FROM public.reservation_segment AS rs
      JOIN public.reservation AS r
        ON r.id = rs.reservation_id
       AND r.tenant_id = rs.tenant_id
      JOIN public.sellable_unit AS su
        ON su.id = rs.sellable_unit_id
       AND su.tenant_id = rs.tenant_id
       AND su.unit_type_id = rs.unit_type_id
       AND su.status = 'active'
      JOIN public.unit_type AS ut
        ON ut.id = rs.unit_type_id
       AND ut.tenant_id = rs.tenant_id
       AND ut.property_node = r.property_node
      JOIN public.sellable_unit_space AS sus
        ON sus.sellable_unit_id = su.id
       AND sus.tenant_id = su.tenant_id
       AND sus.space_id = p_space
       AND sus.claim_mode = CASE WHEN p_exclusive THEN 'exclusive' ELSE 'positional' END
      JOIN public.space AS s
        ON s.id = sus.space_id
       AND s.tenant_id = sus.tenant_id
       AND s.property_node = r.property_node
       AND s.status = 'active'
     WHERE rs.id = p_slot
       AND rs.tenant_id = v_tenant
       AND rs.status IN ('booked', 'in_house')
       AND rs.period = p_period;
  ELSE
    SELECT true
      INTO v_parent_valid
      FROM public.ooo_oos AS block
      JOIN public.space AS s
        ON s.id = block.space_id
       AND s.tenant_id = block.tenant_id
       AND s.status = 'active'
     WHERE block.id = p_slot
       AND block.tenant_id = v_tenant
       AND block.kind = 'ooo'
       AND NOT pg_catalog.isempty(block.period)
       AND pg_catalog.upper(block.period) > pg_catalog.transaction_timestamp()
       AND block.space_id = p_space
       AND block.period = p_period
       AND p_exclusive;
  END IF;

  IF v_parent_valid IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'occupancy typed parent is invalid or stale'
      USING ERRCODE = 'P0003';
  END IF;

  IF p_exclusive THEN
    INSERT INTO public.space_occupancy
      (tenant_id, space_id, period, slot_ref, slot_kind, exclusive, claim)
    VALUES
      (v_tenant, p_space, p_period, p_slot, p_slot_kind, true,
       pg_catalog.int4range(0, NULL))
    RETURNING id INTO v_id;
  ELSE
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(p_space::text, 42)
    );
    SELECT capacity
      INTO v_cap
      FROM public.space
     WHERE id = p_space
       AND tenant_id = v_tenant;
    SELECT g.p
      INTO v_pos
      FROM pg_catalog.generate_series(0, v_cap - 1) AS g(p)
     WHERE NOT EXISTS (
       SELECT 1
         FROM public.space_occupancy AS so
        WHERE so.tenant_id = v_tenant
          AND so.space_id = p_space
          AND so.period && p_period
          AND so.claim && pg_catalog.int4range(g.p, g.p + 1)
     )
     ORDER BY g.p
     LIMIT 1;
    IF v_pos IS NULL THEN
      RAISE EXCEPTION 'capacity_exceeded' USING ERRCODE = 'P0002';
    END IF;
    INSERT INTO public.space_occupancy
      (tenant_id, space_id, period, slot_ref, slot_kind, exclusive, claim)
    VALUES
      (v_tenant, p_space, p_period, p_slot, p_slot_kind, false,
       pg_catalog.int4range(v_pos, v_pos + 1))
    RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END $$;


--
-- Name: record_occupancy(uuid, uuid, tstzrange, uuid, text, boolean, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_occupancy(p_tenant uuid, p_space uuid, p_period tstzrange, p_slot uuid, p_slot_kind text, p_exclusive boolean, p_vehicle uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'pg_temp'
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


--
-- Name: record_positive_tax_correction_root(uuid, uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_positive_tax_correction_root(p_tenant_id uuid, p_original_journal_id uuid, p_reversal_journal_id uuid, p_actor_id uuid) RETURNS TABLE(posting_binding_id uuid, lineage_id uuid, hold_binding_id uuid, attribution_id uuid, reservation_id uuid, segment_id uuid, folio_id uuid, journal_id uuid, origin_quote_hash text, snapshot_hash text, business_date date, currency character, line_count integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'pg_temp'
    AS $_$
DECLARE
  v_context_tenant uuid;
  v_binding public.tax_attribution_journal_binding%ROWTYPE;
  v_lineage public.tax_attribution_reservation_binding%ROWTYPE;
  v_snapshot public.tax_attribution_snapshot%ROWTYPE;
  v_original public.journal%ROWTYPE;
  v_reversal public.journal%ROWTYPE;
  v_original_root public.posting_line%ROWTYPE;
  v_original_line_count integer;
  v_reversal_line_count integer;
  v_mismatched_nonroots integer;
  v_original_balance numeric;
  v_reversal_balance numeric;
  v_root_tax_detail jsonb;
BEGIN
  IF session_user <> 'yellow_runtime'
     OR pg_catalog.current_setting('role', true) IS DISTINCT FROM 'app_role'
     OR current_user <> 'yellow_owner' THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'positive-tax correction root requires the governed runtime app role';
  END IF;

  BEGIN
    v_context_tenant := NULLIF(
      pg_catalog.current_setting('app.tenant_id', true), ''
    )::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'positive-tax correction root tenant context is invalid';
  END;
  IF v_context_tenant IS NULL OR p_tenant_id IS NULL
     OR v_context_tenant <> p_tenant_id THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'positive-tax correction root tenant context is invalid';
  END IF;
  IF p_original_journal_id IS NULL OR p_reversal_journal_id IS NULL
     OR p_actor_id IS NULL OR p_original_journal_id = p_reversal_journal_id THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'positive-tax correction root input is invalid';
  END IF;

  SELECT binding.*
    INTO v_binding
    FROM public.tax_attribution_journal_binding AS binding
   WHERE binding.tenant_id = p_tenant_id
     AND binding.journal_id = p_original_journal_id
   FOR KEY SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'governed positive-tax original binding is unavailable';
  END IF;

  SELECT lineage.*
    INTO v_lineage
    FROM public.tax_attribution_reservation_binding AS lineage
   WHERE lineage.tenant_id = p_tenant_id
     AND lineage.id = v_binding.lineage_id
     AND lineage.property_node = v_binding.property_node
     AND lineage.binding_id = v_binding.hold_binding_id
     AND lineage.attribution_id = v_binding.attribution_id
     AND lineage.reservation_id = v_binding.reservation_id
     AND lineage.segment_id = v_binding.segment_id
     AND lineage.origin_quote_hash = v_binding.origin_quote_hash
     AND lineage.snapshot_hash = v_binding.snapshot_hash
     AND lineage.currency = v_binding.currency
   FOR KEY SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'positive-tax correction reservation lineage is unavailable';
  END IF;

  SELECT snapshot.*
    INTO v_snapshot
    FROM public.tax_attribution_snapshot AS snapshot
   WHERE snapshot.tenant_id = p_tenant_id
     AND snapshot.id = v_binding.attribution_id
     AND snapshot.property_node = v_binding.property_node
     AND snapshot.origin_kind = 'rate_quote'
     AND snapshot.origin_quote_hash = v_binding.origin_quote_hash
     AND snapshot.snapshot_hash = v_binding.snapshot_hash
     AND snapshot.currency = v_binding.currency
   FOR KEY SHARE;
  IF NOT FOUND
     OR v_snapshot.snapshot #>> '{evaluation,rounding}' IS DISTINCT FROM 'line'
     OR v_snapshot.snapshot #>> '{evaluation,country}' IS NOT DISTINCT FROM 'IN'
     OR v_snapshot.snapshot #>> '{evaluation,grandTotalMinor}' !~ '^[1-9][0-9]*$'
     OR v_snapshot.snapshot #>> '{evaluation,taxTotalMinor}' !~ '^[1-9][0-9]*$'
     OR EXISTS (
       SELECT 1
         FROM pg_catalog.jsonb_array_elements(
           v_snapshot.snapshot #> '{evaluation,taxes}'
         ) AS tax(value)
        WHERE tax.value ->> 'code' ~ '^GST(?:_|$)'
     ) THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'positive-tax correction attribution is ineligible';
  END IF;

  SELECT original.*
    INTO v_original
    FROM public.journal AS original
   WHERE original.tenant_id = p_tenant_id
     AND original.id = p_original_journal_id
     AND original.property_node = v_binding.property_node
     AND original.business_date = v_binding.business_date
     AND original.currency = v_binding.currency
     AND original.kind = 'charge'
     AND original.reverses IS NULL
     AND original.source = pg_catalog.jsonb_build_object(
       'interface', 'financials.positive-tax.post',
       'lineage_id', v_binding.lineage_id::text
     );
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'governed positive-tax original is unavailable';
  END IF;

  SELECT reversal.*
    INTO v_reversal
    FROM public.journal AS reversal
   WHERE reversal.tenant_id = p_tenant_id
     AND reversal.id = p_reversal_journal_id
     AND reversal.property_node = v_binding.property_node
     AND reversal.kind = 'adjustment'
     AND reversal.reverses = p_original_journal_id
     AND reversal.currency = v_binding.currency
     AND reversal.created_by = p_actor_id
     AND reversal.source = pg_catalog.jsonb_build_object(
       'interface', 'financials.positive-tax.reverse',
       'original_journal_id', p_original_journal_id::text,
       'lineage_id', v_binding.lineage_id::text
     );
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'governed positive-tax correction header is unavailable';
  END IF;

  PERFORM 1
    FROM public.app_user AS actor
   WHERE actor.tenant_id = p_tenant_id
     AND actor.id = p_actor_id
     AND actor.status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'positive-tax correction actor is unavailable';
  END IF;

  SELECT root.*
    INTO v_original_root
    FROM public.posting_line AS root
   WHERE root.tenant_id = p_tenant_id
     AND root.journal_id = p_original_journal_id
     AND root.seq = 1
     AND root.account_id = v_binding.guest_account_id
     AND root.folio_id = v_binding.folio_id
     AND root.business_date = v_original.business_date
     AND root.currency = v_original.currency
     AND root.amount_minor > 0
     AND root.tax_detail IS NOT NULL
     AND root.tax_detail #>> '{lineage,journalId}' = p_original_journal_id::text
     AND root.tax_detail #>> '{lineage,lineageId}' = v_binding.lineage_id::text
     AND root.tax_detail #>> '{lineage,attributionId}' = v_binding.attribution_id::text
     AND root.tax_detail #>> '{lineage,reservationId}' = v_binding.reservation_id::text
     AND root.tax_detail #>> '{lineage,segmentId}' = v_binding.segment_id::text
     AND root.tax_detail #>> '{lineage,folioId}' = v_binding.folio_id::text
     AND root.tax_detail #>> '{quote,originQuoteHash}' = v_binding.origin_quote_hash
     AND root.tax_detail #>> '{quote,snapshotHash}' = v_binding.snapshot_hash
     AND root.tax_detail #>> '{quote,currency}' = v_binding.currency::text;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'positive-tax correction root lineage is inconsistent';
  END IF;

  SELECT pg_catalog.count(*)::integer,
         COALESCE(pg_catalog.sum(line.amount_minor::numeric), 0::numeric)
    INTO v_original_line_count, v_original_balance
    FROM public.posting_line AS line
   WHERE line.tenant_id = p_tenant_id
     AND line.journal_id = p_original_journal_id;
  IF v_original_line_count < 3 OR v_original_line_count > 66
     OR v_original_balance <> 0::numeric
     OR NOT EXISTS (
       SELECT 1
         FROM public.posting_line AS tax_line
         JOIN public.account AS tax_account
           ON tax_account.tenant_id = tax_line.tenant_id
          AND tax_account.id = tax_line.account_id
        WHERE tax_line.tenant_id = p_tenant_id
          AND tax_line.journal_id = p_original_journal_id
          AND tax_line.seq > 2
          AND tax_account.role = 'tax_payable'
          AND tax_line.amount_minor < 0
     ) THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'positive-tax original posting set is incomplete';
  END IF;

  SELECT pg_catalog.count(*)::integer
    INTO v_mismatched_nonroots
    FROM public.posting_line AS original
    LEFT JOIN public.posting_line AS reversal
      ON reversal.tenant_id = original.tenant_id
     AND reversal.journal_id = p_reversal_journal_id
     AND reversal.seq = original.seq
     AND reversal.account_id = original.account_id
     AND reversal.folio_id IS NOT DISTINCT FROM original.folio_id
     AND reversal.tx_code = original.tx_code
     AND reversal.description = original.description
     AND reversal.amount_minor = -original.amount_minor
     AND reversal.quantity = original.quantity
     AND reversal.tax_detail IS NOT DISTINCT FROM original.tax_detail
     AND reversal.folio_transfer_root_line_id IS NOT DISTINCT FROM
         original.folio_transfer_root_line_id
     AND reversal.business_date = v_reversal.business_date
     AND reversal.currency = original.currency
   WHERE original.tenant_id = p_tenant_id
     AND original.journal_id = p_original_journal_id
     AND original.seq > 1
     AND reversal.id IS NULL;
  SELECT pg_catalog.count(*)::integer
    INTO v_reversal_line_count
    FROM public.posting_line AS line
   WHERE line.tenant_id = p_tenant_id
     AND line.journal_id = p_reversal_journal_id;
  IF v_mismatched_nonroots <> 0
     OR v_reversal_line_count <> v_original_line_count - 1
     OR EXISTS (
       SELECT 1
         FROM public.posting_line AS line
        WHERE line.tenant_id = p_tenant_id
          AND line.journal_id = p_reversal_journal_id
          AND line.seq = 1
     ) THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'positive-tax correction posting set is inconsistent';
  END IF;

  v_root_tax_detail := pg_catalog.jsonb_build_object(
    'schemaVersion', 2,
    'effect', 'full_reversal',
    'lineage', pg_catalog.jsonb_build_object(
      'originalPostingBindingId', v_binding.id::text,
      'lineageId', v_binding.lineage_id::text,
      'holdBindingId', v_binding.hold_binding_id::text,
      'attributionId', v_binding.attribution_id::text,
      'reservationId', v_binding.reservation_id::text,
      'segmentId', v_binding.segment_id::text,
      'folioId', v_binding.folio_id::text,
      'originalJournalId', p_original_journal_id::text,
      'reversalJournalId', p_reversal_journal_id::text
    ),
    'quote', pg_catalog.jsonb_build_object(
      'originQuoteHash', v_binding.origin_quote_hash,
      'snapshotHash', v_binding.snapshot_hash,
      'currency', v_binding.currency::text
    ),
    'originalTaxDetail', v_original_root.tax_detail
  );

  INSERT INTO public.posting_line (
    tenant_id, journal_id, seq, account_id, folio_id, tx_code,
    description, amount_minor, quantity, tax_detail,
    folio_transfer_root_line_id, business_date, currency
  ) VALUES (
    p_tenant_id, p_reversal_journal_id, 1, v_original_root.account_id,
    v_original_root.folio_id, v_original_root.tx_code,
    v_original_root.description, -v_original_root.amount_minor,
    v_original_root.quantity, v_root_tax_detail,
    v_original_root.folio_transfer_root_line_id,
    v_reversal.business_date, v_original_root.currency
  );

  SELECT pg_catalog.count(*)::integer,
         COALESCE(pg_catalog.sum(line.amount_minor::numeric), 0::numeric)
    INTO v_reversal_line_count, v_reversal_balance
    FROM public.posting_line AS line
   WHERE line.tenant_id = p_tenant_id
     AND line.journal_id = p_reversal_journal_id;
  IF v_reversal_line_count <> v_original_line_count
     OR v_reversal_balance <> 0::numeric
     OR EXISTS (
       SELECT 1
         FROM public.posting_line AS original
         LEFT JOIN public.posting_line AS reversal
           ON reversal.tenant_id = original.tenant_id
          AND reversal.journal_id = p_reversal_journal_id
          AND reversal.seq = original.seq
          AND reversal.account_id = original.account_id
          AND reversal.folio_id IS NOT DISTINCT FROM original.folio_id
          AND reversal.tx_code = original.tx_code
          AND reversal.description = original.description
          AND reversal.amount_minor = -original.amount_minor
          AND reversal.quantity = original.quantity
          AND reversal.folio_transfer_root_line_id IS NOT DISTINCT FROM
              original.folio_transfer_root_line_id
          AND reversal.business_date = v_reversal.business_date
          AND reversal.currency = original.currency
        WHERE original.tenant_id = p_tenant_id
          AND original.journal_id = p_original_journal_id
          AND reversal.id IS NULL
     ) THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'positive-tax correction failed exact nullification';
  END IF;

  RETURN QUERY SELECT
    v_binding.id, v_binding.lineage_id, v_binding.hold_binding_id,
    v_binding.attribution_id,
    v_binding.reservation_id, v_binding.segment_id, v_binding.folio_id,
    p_reversal_journal_id, v_binding.origin_quote_hash,
    v_binding.snapshot_hash, v_reversal.business_date, v_reversal.currency,
    v_reversal_line_count;
END;
$_$;


--
-- Name: record_positive_tax_journal_binding(uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid[], jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_positive_tax_journal_binding(p_tenant_id uuid, p_property_node uuid, p_actor_id uuid, p_lineage_id uuid, p_folio_id uuid, p_journal_id uuid, p_revenue_mapping_id uuid, p_tax_mapping_ids uuid[], p_tax_detail jsonb) RETURNS TABLE(posting_binding_id uuid, lineage_id uuid, attribution_id uuid, reservation_id uuid, segment_id uuid, folio_id uuid, journal_id uuid, origin_quote_hash text, snapshot_hash text, currency character, business_date date, created boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'pg_temp'
    AS $_$
DECLARE
  v_context_tenant uuid;
  v_lineage public.tax_attribution_reservation_binding%ROWTYPE;
  v_snapshot public.tax_attribution_snapshot%ROWTYPE;
  v_journal public.journal%ROWTYPE;
  v_existing public.tax_attribution_journal_binding%ROWTYPE;
  v_created public.tax_attribution_journal_binding%ROWTYPE;
  v_folio record;
  v_revenue record;
  v_nonzero_taxes integer;
  v_mapping_count integer;
  v_valid_tax_routes integer;
  v_credit_lines integer;
  v_expected_tax_routes jsonb;
  v_expected_taxes jsonb;
  v_expected_tax_detail jsonb;
  v_root_detail jsonb;
  v_base_minor bigint;
  v_tax_minor bigint;
  v_grand_minor bigint;
  v_computed_tax_minor numeric;
BEGIN
  IF session_user <> 'yellow_runtime'
     OR pg_catalog.current_setting('role', true) IS DISTINCT FROM 'app_role'
     OR current_user <> 'yellow_owner' THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'positive-tax journal binding requires the governed runtime app role';
  END IF;

  BEGIN
    v_context_tenant := NULLIF(
      pg_catalog.current_setting('app.tenant_id', true), ''
    )::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'positive-tax journal binding tenant context is invalid';
  END;
  IF v_context_tenant IS NULL OR p_tenant_id IS NULL
     OR v_context_tenant <> p_tenant_id THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'positive-tax journal binding tenant context is invalid';
  END IF;

  v_mapping_count := pg_catalog.cardinality(p_tax_mapping_ids);
  IF p_property_node IS NULL OR p_actor_id IS NULL OR p_lineage_id IS NULL
     OR p_folio_id IS NULL OR p_journal_id IS NULL
     OR p_revenue_mapping_id IS NULL OR p_tax_mapping_ids IS NULL
     OR v_mapping_count > 64
     OR EXISTS (
       SELECT 1
         FROM pg_catalog.unnest(p_tax_mapping_ids) AS requested(id)
        WHERE requested.id IS NULL
     )
     OR (
       SELECT pg_catalog.count(DISTINCT requested.id)
         FROM pg_catalog.unnest(p_tax_mapping_ids) AS requested(id)
     ) <> v_mapping_count
     OR p_tax_detail IS NULL
     OR pg_catalog.jsonb_typeof(p_tax_detail) <> 'object'
     OR pg_catalog.octet_length(
       pg_catalog.convert_to(p_tax_detail::text, 'UTF8')
     ) NOT BETWEEN 1 AND 8388608 THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'positive-tax journal binding input is invalid';
  END IF;
  IF p_tax_detail #>> '{routes,revenue,mappingId}'
       IS DISTINCT FROM p_revenue_mapping_id::text
     OR COALESCE(
       (
         SELECT pg_catalog.array_agg(
           (route.value ->> 'mappingId')::uuid ORDER BY route.ordinality
         )
           FROM pg_catalog.jsonb_array_elements(
             p_tax_detail #> '{routes,taxes}'
           ) WITH ORDINALITY AS route(value, ordinality)
       ),
       ARRAY[]::uuid[]
     ) IS DISTINCT FROM p_tax_mapping_ids THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'positive-tax journal binding route evidence is invalid';
  END IF;

  PERFORM 1
    FROM public.tenant
   WHERE tenant.id = p_tenant_id
     AND tenant.status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'positive-tax journal binding authority is unavailable';
  END IF;
  PERFORM 1
    FROM public.org_node AS property
   WHERE property.tenant_id = p_tenant_id
     AND property.id = p_property_node
     AND property.kind = 'property';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'positive-tax journal binding authority is unavailable';
  END IF;
  PERFORM 1
    FROM public.app_user AS actor
   WHERE actor.tenant_id = p_tenant_id
     AND actor.id = p_actor_id
     AND actor.status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'positive-tax journal binding authority is unavailable';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'positive-tax-journal-binding:' || p_tenant_id::text || ':' ||
      p_lineage_id::text,
      262
    )
  );

  SELECT binding.*
    INTO v_existing
    FROM public.tax_attribution_journal_binding AS binding
   WHERE binding.tenant_id = p_tenant_id
     AND binding.lineage_id = p_lineage_id;
  IF FOUND THEN
    IF v_existing.property_node IS DISTINCT FROM p_property_node
       OR v_existing.posted_by IS DISTINCT FROM p_actor_id
       OR v_existing.folio_id IS DISTINCT FROM p_folio_id
       OR v_existing.journal_id IS DISTINCT FROM p_journal_id THEN
      RAISE EXCEPTION USING ERRCODE = '23505',
        MESSAGE = 'positive-tax lineage already has a divergent journal binding';
    END IF;
    SELECT line.tax_detail
      INTO v_root_detail
      FROM public.posting_line AS line
     WHERE line.tenant_id = p_tenant_id
       AND line.journal_id = p_journal_id
       AND line.seq = 1
       AND line.account_id = v_existing.guest_account_id
       AND line.folio_id = p_folio_id;
    IF NOT FOUND OR v_root_detail IS DISTINCT FROM p_tax_detail THEN
      RAISE EXCEPTION USING ERRCODE = '55000',
        MESSAGE = 'positive-tax journal binding evidence is inconsistent';
    END IF;
    RETURN QUERY SELECT
      v_existing.id, v_existing.lineage_id, v_existing.attribution_id,
      v_existing.reservation_id, v_existing.segment_id,
      v_existing.folio_id, v_existing.journal_id,
      v_existing.origin_quote_hash, v_existing.snapshot_hash,
      v_existing.currency, v_existing.business_date, false;
    RETURN;
  END IF;

  SELECT lineage.*
    INTO v_lineage
    FROM public.tax_attribution_reservation_binding AS lineage
   WHERE lineage.tenant_id = p_tenant_id
     AND lineage.id = p_lineage_id
     AND lineage.property_node = p_property_node
   FOR KEY SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'positive-tax reservation lineage is unavailable';
  END IF;

  SELECT attribution.*
    INTO v_snapshot
    FROM public.tax_attribution_snapshot AS attribution
   WHERE attribution.tenant_id = p_tenant_id
     AND attribution.id = v_lineage.attribution_id
     AND attribution.property_node = p_property_node
     AND attribution.origin_kind = 'rate_quote'
     AND attribution.origin_quote_hash = v_lineage.origin_quote_hash
     AND attribution.snapshot_hash = v_lineage.snapshot_hash
     AND attribution.currency = v_lineage.currency
   FOR KEY SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'canonical positive-tax attribution is unavailable';
  END IF;

  IF v_snapshot.snapshot ->> 'currency' IS DISTINCT FROM v_lineage.currency::text
     OR v_snapshot.snapshot ->> 'snapshotHash' IS DISTINCT FROM v_lineage.snapshot_hash
     OR v_snapshot.snapshot #>> '{origin,quoteHash}' IS DISTINCT FROM v_lineage.origin_quote_hash
     OR v_snapshot.snapshot #>> '{evaluation,rounding}' IS DISTINCT FROM 'line'
     OR v_snapshot.snapshot #>> '{evaluation,country}' IS NOT DISTINCT FROM 'IN'
     OR EXISTS (
       SELECT 1
         FROM pg_catalog.jsonb_array_elements(
           v_snapshot.snapshot #> '{evaluation,taxes}'
         ) AS tax(value)
        WHERE tax.value ->> 'code' ~ '^GST(?:_|$)'
     ) THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'positive-tax attribution requires a later policy path';
  END IF;

  IF v_snapshot.snapshot #>> '{evaluation,baseTotalMinor}' !~ '^[1-9][0-9]*$'
     OR v_snapshot.snapshot #>> '{evaluation,taxTotalMinor}' !~ '^(0|[1-9][0-9]*)$'
     OR v_snapshot.snapshot #>> '{evaluation,grandTotalMinor}' !~ '^[1-9][0-9]*$' THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'positive-tax attribution totals are invalid';
  END IF;
  BEGIN
    v_base_minor := (v_snapshot.snapshot #>> '{evaluation,baseTotalMinor}')::bigint;
    v_tax_minor := (v_snapshot.snapshot #>> '{evaluation,taxTotalMinor}')::bigint;
    v_grand_minor := (v_snapshot.snapshot #>> '{evaluation,grandTotalMinor}')::bigint;
  EXCEPTION WHEN numeric_value_out_of_range OR invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'positive-tax attribution totals are invalid';
  END;
  IF v_base_minor <= 0 OR v_tax_minor < 0 OR v_grand_minor <= 0
     OR v_base_minor + v_tax_minor <> v_grand_minor THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'positive-tax attribution totals are invalid';
  END IF;

  IF pg_catalog.jsonb_typeof(
       v_snapshot.snapshot #> '{evaluation,taxes}'
     ) IS DISTINCT FROM 'array'
     OR pg_catalog.jsonb_array_length(
       v_snapshot.snapshot #> '{evaluation,taxes}'
     ) > 64
     OR EXISTS (
       SELECT 1
         FROM pg_catalog.jsonb_array_elements(
           v_snapshot.snapshot #> '{evaluation,taxes}'
         ) WITH ORDINALITY AS tax(value, ordinality)
        WHERE pg_catalog.jsonb_typeof(tax.value) <> 'object'
           OR NOT (tax.value ?& ARRAY[
             'index', 'code', 'name', 'taxMinor', 'components'
           ])
           OR tax.value - ARRAY[
             'index', 'code', 'name', 'taxMinor', 'components'
           ] <> '{}'::jsonb
           OR tax.value ->> 'index' IS DISTINCT FROM
              (tax.ordinality - 1)::text
           OR tax.value ->> 'code' !~ '^[A-Z][A-Z0-9_]{0,63}$'
           OR tax.value ->> 'name' IS NULL
           OR pg_catalog.btrim(tax.value ->> 'name') = ''
           OR pg_catalog.char_length(tax.value ->> 'name') > 256
           OR tax.value ->> 'taxMinor' !~ '^(0|[1-9][0-9]*)$'
           OR pg_catalog.jsonb_typeof(tax.value -> 'components') <> 'array'
     )
     OR (
       SELECT pg_catalog.count(DISTINCT tax.value ->> 'code')
         FROM pg_catalog.jsonb_array_elements(
           v_snapshot.snapshot #> '{evaluation,taxes}'
         ) AS tax(value)
     ) <> pg_catalog.jsonb_array_length(
       v_snapshot.snapshot #> '{evaluation,taxes}'
     ) THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'positive-tax attribution tax lineage is invalid';
  END IF;
  BEGIN
    SELECT COALESCE(
             pg_catalog.sum((tax.value ->> 'taxMinor')::numeric),
             0::numeric
           )
      INTO v_computed_tax_minor
      FROM pg_catalog.jsonb_array_elements(
        v_snapshot.snapshot #> '{evaluation,taxes}'
      ) AS tax(value);
  EXCEPTION WHEN numeric_value_out_of_range OR invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'positive-tax attribution tax lineage is invalid';
  END;
  IF v_computed_tax_minor <> v_tax_minor::numeric
     OR v_computed_tax_minor > 9223372036854775807::numeric THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'positive-tax attribution tax lineage is invalid';
  END IF;

  SELECT folio.id, folio.account_id, folio.reservation_id,
         account.property_node, account.currency::text AS currency
    INTO v_folio
    FROM public.folio AS folio
    JOIN public.account AS account
      ON account.tenant_id = folio.tenant_id
     AND account.id = folio.account_id
   WHERE folio.tenant_id = p_tenant_id
     AND folio.id = p_folio_id
     AND folio.reservation_id = v_lineage.reservation_id
     AND folio.window_no = 1
     AND folio.status = 'open'
     AND account.property_node = p_property_node
     AND account.currency = v_lineage.currency
     AND account.role = 'guest'
     AND account.status = 'open';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'positive-tax primary folio is unavailable';
  END IF;

  SELECT journal.*
    INTO v_journal
    FROM public.journal AS journal
   WHERE journal.tenant_id = p_tenant_id
     AND journal.id = p_journal_id
     AND journal.property_node = p_property_node
     AND journal.kind = 'charge'
     AND journal.reverses IS NULL
     AND journal.currency = v_lineage.currency
     AND journal.created_by = p_actor_id
     AND journal.source = pg_catalog.jsonb_build_object(
       'interface', 'financials.positive-tax.post',
       'lineage_id', p_lineage_id::text
     );
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'governed positive-tax journal header is unavailable';
  END IF;
  PERFORM 1
    FROM public.business_day AS day
   WHERE day.tenant_id = p_tenant_id
     AND day.property_node = p_property_node
     AND day.business_date = v_journal.business_date
     AND day.sealed_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0011',
      MESSAGE = 'positive-tax journal business day is missing or sealed';
  END IF;

  SELECT mapping.id AS mapping_id, mapping.tx_code,
         route.credit_account_id,
         code.name AS tx_name
    INTO v_revenue
    FROM public.tax_semantic_route AS mapping
    JOIN public.tx_code AS code
      ON code.code = mapping.tx_code
     AND code.grp = 'revenue'
     AND code.usali_line IS NOT NULL
     AND pg_catalog.btrim(code.usali_line) <> ''
    JOIN public.tx_code_route AS route
      ON route.tenant_id = mapping.tenant_id
     AND route.property_node = mapping.property_node
     AND route.currency = mapping.currency
     AND route.tx_code = mapping.tx_code
    JOIN public.account AS account
      ON account.tenant_id = route.tenant_id
     AND account.id = route.credit_account_id
     AND account.property_node = route.property_node
     AND account.currency = route.currency
     AND account.role = 'revenue'
     AND account.status = 'open'
   WHERE mapping.tenant_id = p_tenant_id
     AND mapping.id = p_revenue_mapping_id
     AND mapping.property_node = p_property_node
     AND mapping.currency = v_lineage.currency
     AND mapping.jurisdiction_extension_id =
         (v_snapshot.snapshot #>> '{jurisdiction,extensionId}')::uuid
     AND mapping.jurisdiction_owner_tenant_id IS NOT DISTINCT FROM
         (v_snapshot.snapshot #>> '{jurisdiction,ownerTenantId}')::uuid
     AND mapping.jurisdiction_key = v_snapshot.snapshot #>> '{jurisdiction,key}'
     AND mapping.jurisdiction_version =
         (v_snapshot.snapshot #>> '{jurisdiction,version}')::integer
     AND mapping.jurisdiction_content_hash =
         v_snapshot.snapshot #>> '{jurisdiction,contentHash}'
     AND mapping.semantic_kind = 'revenue'
     AND mapping.semantic_code = 'room_revenue';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'configured positive-tax revenue route is unavailable';
  END IF;

  SELECT pg_catalog.count(*)::integer
    INTO v_nonzero_taxes
    FROM pg_catalog.jsonb_array_elements(
      v_snapshot.snapshot #> '{evaluation,taxes}'
    ) AS tax(value)
   WHERE (tax.value ->> 'taxMinor')::bigint <> 0;
  IF v_nonzero_taxes <> v_mapping_count THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'configured positive-tax route set is incomplete';
  END IF;

  WITH canonical_taxes AS (
    SELECT tax.value, tax.ordinality,
           pg_catalog.row_number() OVER (ORDER BY tax.ordinality) AS posting_ordinal
      FROM pg_catalog.jsonb_array_elements(
        v_snapshot.snapshot #> '{evaluation,taxes}'
      ) WITH ORDINALITY AS tax(value, ordinality)
     WHERE (tax.value ->> 'taxMinor')::bigint <> 0
  ), requested AS (
    SELECT mapping_id, ordinality
      FROM pg_catalog.unnest(p_tax_mapping_ids)
        WITH ORDINALITY AS supplied(mapping_id, ordinality)
  ), resolved AS (
    SELECT canonical_taxes.value, canonical_taxes.ordinality,
           canonical_taxes.posting_ordinal,
           mapping.id AS mapping_id, mapping.tx_code,
           route.credit_account_id
      FROM canonical_taxes
      JOIN requested
        ON requested.ordinality = canonical_taxes.posting_ordinal
      JOIN public.tax_semantic_route AS mapping
        ON mapping.tenant_id = p_tenant_id
       AND mapping.id = requested.mapping_id
       AND mapping.property_node = p_property_node
       AND mapping.currency = v_lineage.currency
       AND mapping.jurisdiction_extension_id =
           (v_snapshot.snapshot #>> '{jurisdiction,extensionId}')::uuid
       AND mapping.jurisdiction_owner_tenant_id IS NOT DISTINCT FROM
           (v_snapshot.snapshot #>> '{jurisdiction,ownerTenantId}')::uuid
       AND mapping.jurisdiction_key = v_snapshot.snapshot #>> '{jurisdiction,key}'
       AND mapping.jurisdiction_version =
           (v_snapshot.snapshot #>> '{jurisdiction,version}')::integer
       AND mapping.jurisdiction_content_hash =
           v_snapshot.snapshot #>> '{jurisdiction,contentHash}'
       AND mapping.semantic_kind = 'tax'
       AND mapping.semantic_code = canonical_taxes.value ->> 'code'
      JOIN public.tx_code AS code
        ON code.code = mapping.tx_code
       AND code.grp = 'tax'
      JOIN public.tx_code_route AS route
        ON route.tenant_id = mapping.tenant_id
       AND route.property_node = mapping.property_node
       AND route.currency = mapping.currency
       AND route.tx_code = mapping.tx_code
      JOIN public.account AS account
        ON account.tenant_id = route.tenant_id
       AND account.id = route.credit_account_id
       AND account.property_node = route.property_node
       AND account.currency = route.currency
       AND account.role = 'tax_payable'
       AND account.status = 'open'
  )
  SELECT pg_catalog.count(*)::integer,
         COALESCE(
           pg_catalog.jsonb_agg(
             pg_catalog.jsonb_build_object(
               'taxIndex', resolved.value ->> 'index',
               'taxCode', resolved.value ->> 'code',
               'mappingId', resolved.mapping_id::text,
               'txCode', resolved.tx_code,
               'creditAccountId', resolved.credit_account_id::text
             ) ORDER BY resolved.ordinality
           ),
           '[]'::jsonb
         )
    INTO v_valid_tax_routes, v_expected_tax_routes
    FROM resolved;
  IF v_valid_tax_routes <> v_nonzero_taxes THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'configured positive-tax route set is incoherent';
  END IF;

  SELECT COALESCE(
           pg_catalog.jsonb_agg(
             pg_catalog.jsonb_build_object(
               'index', tax.value ->> 'index',
               'code', tax.value ->> 'code',
               'name', tax.value ->> 'name',
               'taxMinor', tax.value ->> 'taxMinor'
             ) ORDER BY tax.ordinality
           ),
           '[]'::jsonb
         )
    INTO v_expected_taxes
    FROM pg_catalog.jsonb_array_elements(
      v_snapshot.snapshot #> '{evaluation,taxes}'
    ) WITH ORDINALITY AS tax(value, ordinality);

  v_expected_tax_detail := pg_catalog.jsonb_build_object(
    'schemaVersion', 1,
    'lineage', pg_catalog.jsonb_build_object(
      'lineageId', v_lineage.id::text,
      'holdBindingId', v_lineage.binding_id::text,
      'attributionId', v_lineage.attribution_id::text,
      'reservationId', v_lineage.reservation_id::text,
      'segmentId', v_lineage.segment_id::text,
      'folioId', p_folio_id::text,
      'journalId', p_journal_id::text
    ),
    'quote', pg_catalog.jsonb_build_object(
      'originQuoteHash', v_lineage.origin_quote_hash,
      'snapshotHash', v_lineage.snapshot_hash,
      'currency', v_lineage.currency::text
    ),
    'jurisdiction', pg_catalog.jsonb_build_object(
      'extensionId', v_snapshot.snapshot #>> '{jurisdiction,extensionId}',
      'ownerTenantId', v_snapshot.snapshot #> '{jurisdiction,ownerTenantId}',
      'key', v_snapshot.snapshot #>> '{jurisdiction,key}',
      'version', v_snapshot.snapshot #>> '{jurisdiction,version}',
      'contentHash', v_snapshot.snapshot #>> '{jurisdiction,contentHash}'
    ),
    'routes', pg_catalog.jsonb_build_object(
      'revenue', pg_catalog.jsonb_build_object(
        'mappingId', v_revenue.mapping_id::text,
        'semanticCode', 'room_revenue',
        'txCode', v_revenue.tx_code,
        'creditAccountId', v_revenue.credit_account_id::text
      ),
      'taxes', v_expected_tax_routes
    ),
    'totals', pg_catalog.jsonb_build_object(
      'baseMinor', v_base_minor::text,
      'taxMinor', v_tax_minor::text,
      'grandMinor', v_grand_minor::text
    ),
    'taxes', v_expected_taxes
  );
  IF p_tax_detail IS DISTINCT FROM v_expected_tax_detail THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'positive-tax detail does not match canonical posting evidence';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.posting_line AS root
     WHERE root.tenant_id = p_tenant_id
       AND root.journal_id = p_journal_id
       AND root.seq = 1
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'positive-tax journal guest root already exists without binding';
  END IF;

  WITH canonical_taxes AS (
    SELECT tax.value, tax.ordinality,
           pg_catalog.row_number() OVER (ORDER BY tax.ordinality) AS posting_ordinal
      FROM pg_catalog.jsonb_array_elements(
        v_snapshot.snapshot #> '{evaluation,taxes}'
      ) WITH ORDINALITY AS tax(value, ordinality)
     WHERE (tax.value ->> 'taxMinor')::bigint <> 0
  ), requested AS (
    SELECT mapping_id, ordinality
      FROM pg_catalog.unnest(p_tax_mapping_ids)
        WITH ORDINALITY AS supplied(mapping_id, ordinality)
  ), expected AS (
    SELECT (canonical_taxes.posting_ordinal + 2)::smallint AS seq,
           mapping.tx_code, route.credit_account_id,
           -((canonical_taxes.value ->> 'taxMinor')::bigint) AS amount_minor
      FROM canonical_taxes
      JOIN requested
        ON requested.ordinality = canonical_taxes.posting_ordinal
      JOIN public.tax_semantic_route AS mapping
        ON mapping.tenant_id = p_tenant_id
       AND mapping.id = requested.mapping_id
      JOIN public.tx_code_route AS route
        ON route.tenant_id = mapping.tenant_id
       AND route.property_node = mapping.property_node
       AND route.currency = mapping.currency
       AND route.tx_code = mapping.tx_code
  ), matched AS (
    SELECT line.seq
      FROM expected
      JOIN public.posting_line AS line
        ON line.tenant_id = p_tenant_id
       AND line.journal_id = p_journal_id
       AND line.seq = expected.seq
       AND line.account_id = expected.credit_account_id
       AND line.folio_id IS NULL
       AND line.tx_code = expected.tx_code
       AND line.amount_minor = expected.amount_minor
       AND line.quantity = 1.000::numeric(10,3)
       AND line.tax_detail IS NULL
       AND line.folio_transfer_root_line_id IS NULL
       AND line.business_date = v_journal.business_date
       AND line.currency = v_journal.currency
    UNION ALL
    SELECT line.seq
      FROM public.posting_line AS line
     WHERE line.tenant_id = p_tenant_id
       AND line.journal_id = p_journal_id
       AND line.seq = 2
       AND line.account_id = v_revenue.credit_account_id
       AND line.folio_id IS NULL
       AND line.tx_code = v_revenue.tx_code
       AND line.amount_minor = -v_base_minor
       AND line.quantity = 1.000::numeric(10,3)
       AND line.tax_detail IS NULL
       AND line.folio_transfer_root_line_id IS NULL
       AND line.business_date = v_journal.business_date
       AND line.currency = v_journal.currency
  )
  SELECT pg_catalog.count(*)::integer
    INTO v_credit_lines
    FROM matched;
  IF v_credit_lines <> v_nonzero_taxes + 1
     OR (
       SELECT pg_catalog.count(*)
         FROM public.posting_line AS line
        WHERE line.tenant_id = p_tenant_id
          AND line.journal_id = p_journal_id
     ) <> v_nonzero_taxes + 1 THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'positive-tax journal credit posting set is inconsistent';
  END IF;

  INSERT INTO public.posting_line (
    tenant_id, journal_id, seq, account_id, folio_id, tx_code,
    description, amount_minor, quantity, tax_detail, business_date, currency
  ) VALUES (
    p_tenant_id, p_journal_id, 1, v_folio.account_id, p_folio_id,
    v_revenue.tx_code, v_journal.description, v_grand_minor,
    1.000::numeric(10,3), p_tax_detail, v_journal.business_date,
    v_journal.currency
  );

  INSERT INTO public.tax_attribution_journal_binding (
    tenant_id, property_node, posted_by, lineage_id, hold_binding_id,
    attribution_id, reservation_id, segment_id, folio_id, guest_account_id,
    journal_id, origin_quote_hash, snapshot_hash, currency, business_date
  ) VALUES (
    p_tenant_id, p_property_node, p_actor_id, v_lineage.id,
    v_lineage.binding_id, v_lineage.attribution_id, v_lineage.reservation_id,
    v_lineage.segment_id, p_folio_id, v_folio.account_id, p_journal_id,
    v_lineage.origin_quote_hash, v_lineage.snapshot_hash,
    v_lineage.currency, v_journal.business_date
  )
  RETURNING * INTO v_created;

  RETURN QUERY SELECT
    v_created.id, v_created.lineage_id, v_created.attribution_id,
    v_created.reservation_id, v_created.segment_id,
    v_created.folio_id, v_created.journal_id,
    v_created.origin_quote_hash, v_created.snapshot_hash,
    v_created.currency, v_created.business_date, true;
END;
$_$;


--
-- Name: record_tax_attribution_hold_binding(uuid, uuid, uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_tax_attribution_hold_binding(p_tenant_id uuid, p_property_node uuid, p_actor_id uuid, p_hold_id uuid, p_attribution_id uuid) RETURNS TABLE(binding_id uuid, property_node uuid, hold_id uuid, attribution_id uuid, origin_quote_hash text, snapshot_hash text, currency character, bound_by uuid, bound_at timestamp with time zone, created boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'pg_temp'
    AS $$
DECLARE
  v_context_tenant uuid;
  v_hold public.hold%ROWTYPE;
  v_attribution public.tax_attribution_snapshot%ROWTYPE;
  v_existing public.tax_attribution_hold_binding%ROWTYPE;
  v_created public.tax_attribution_hold_binding%ROWTYPE;
BEGIN
  IF session_user <> 'yellow_runtime'
     OR pg_catalog.current_setting('role', true) IS DISTINCT FROM 'app_role'
     OR current_user <> 'yellow_owner' THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'tax attribution hold binding requires the governed runtime app role';
  END IF;

  BEGIN
    v_context_tenant := NULLIF(
      pg_catalog.current_setting('app.tenant_id', true), ''
    )::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'tax attribution hold binding tenant context is invalid';
  END;
  IF v_context_tenant IS NULL OR p_tenant_id IS NULL
     OR v_context_tenant <> p_tenant_id THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'tax attribution hold binding tenant context is invalid';
  END IF;

  IF p_property_node IS NULL OR p_actor_id IS NULL
     OR p_hold_id IS NULL OR p_attribution_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'tax attribution hold binding identity is invalid';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'tax-attribution-hold-binding:' || p_tenant_id::text || ':' || p_hold_id::text,
      248
    )
  );

  SELECT binding.*
    INTO v_existing
    FROM public.tax_attribution_hold_binding AS binding
   WHERE binding.tenant_id = p_tenant_id
     AND binding.hold_id = p_hold_id;
  IF FOUND THEN
    IF v_existing.property_node IS DISTINCT FROM p_property_node
       OR v_existing.bound_by IS DISTINCT FROM p_actor_id
       OR v_existing.attribution_id IS DISTINCT FROM p_attribution_id THEN
      RAISE EXCEPTION USING ERRCODE = '23505',
        MESSAGE = 'cart hold already has divergent tax attribution evidence';
    END IF;
    RETURN QUERY SELECT
      v_existing.id, v_existing.property_node,
      v_existing.hold_id, v_existing.attribution_id,
      v_existing.origin_quote_hash, v_existing.snapshot_hash,
      v_existing.currency, v_existing.bound_by, v_existing.bound_at, false;
    RETURN;
  END IF;

  PERFORM 1
    FROM public.tenant
   WHERE tenant.id = p_tenant_id
     AND tenant.status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'tax attribution hold binding authority is unavailable';
  END IF;
  PERFORM 1
    FROM public.org_node AS property
   WHERE property.tenant_id = p_tenant_id
     AND property.id = p_property_node
     AND property.kind = 'property';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'tax attribution hold binding authority is unavailable';
  END IF;
  PERFORM 1
    FROM public.app_user AS actor
   WHERE actor.tenant_id = p_tenant_id
     AND actor.id = p_actor_id
     AND actor.status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'tax attribution hold binding authority is unavailable';
  END IF;

  SELECT hold.*
    INTO v_hold
    FROM public.hold
   WHERE hold.tenant_id = p_tenant_id
     AND hold.id = p_hold_id
     AND hold.property_node = p_property_node
     AND hold.kind = 'cart'
     AND hold.status = 'active'
     AND hold.expires_at > pg_catalog.transaction_timestamp()
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'active cart hold is unavailable for tax attribution binding';
  END IF;

  SELECT attribution.*
    INTO v_attribution
    FROM public.tax_attribution_snapshot AS attribution
   WHERE attribution.tenant_id = p_tenant_id
     AND attribution.id = p_attribution_id
     AND attribution.property_node = p_property_node
     AND attribution.actor_id = p_actor_id
     AND attribution.origin_kind = 'rate_quote'
   FOR KEY SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'canonical tax attribution is unavailable for cart hold binding';
  END IF;

  INSERT INTO public.tax_attribution_hold_binding (
    tenant_id, property_node, bound_by, hold_id, attribution_id,
    sellable_unit_id, period, origin_quote_hash, snapshot_hash, currency
  ) VALUES (
    p_tenant_id, p_property_node, p_actor_id, p_hold_id, p_attribution_id,
    v_hold.sellable_unit_id, v_hold.period, v_attribution.origin_quote_hash,
    v_attribution.snapshot_hash, v_attribution.currency
  )
  RETURNING * INTO v_created;

  RETURN QUERY SELECT
    v_created.id, v_created.property_node,
    v_created.hold_id, v_created.attribution_id,
    v_created.origin_quote_hash, v_created.snapshot_hash,
    v_created.currency, v_created.bound_by, v_created.bound_at, true;
END;
$$;


--
-- Name: record_tax_attribution_snapshot(uuid, uuid, uuid, integer, text, text, text, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_tax_attribution_snapshot(p_tenant uuid, p_property uuid, p_actor uuid, p_schema_version integer, p_origin_kind text, p_origin_quote_hash text, p_snapshot_hash text, p_currency text, p_snapshot jsonb) RETURNS TABLE(attribution_id uuid, property_node uuid, actor_id uuid, schema_version smallint, origin_kind text, origin_quote_hash text, snapshot_hash text, currency character, snapshot jsonb, recorded_at timestamp with time zone, created boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'pg_temp'
    AS $_$
DECLARE
  v_context_tenant uuid;
  v_existing public.tax_attribution_snapshot%ROWTYPE;
  v_created public.tax_attribution_snapshot%ROWTYPE;
BEGIN
  IF session_user <> 'yellow_runtime'
     OR pg_catalog.current_setting('role', true) IS DISTINCT FROM 'app_role'
     OR current_user <> 'yellow_owner' THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'tax attribution recording requires the governed runtime app role';
  END IF;

  BEGIN
    v_context_tenant := NULLIF(
      pg_catalog.current_setting('app.tenant_id', true), ''
    )::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'tax attribution tenant context is invalid';
  END;
  IF v_context_tenant IS NULL OR p_tenant IS NULL
     OR v_context_tenant <> p_tenant THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'tax attribution tenant context is invalid';
  END IF;

  IF p_property IS NULL OR p_actor IS NULL OR p_schema_version IS DISTINCT FROM 1
     OR p_origin_kind IS DISTINCT FROM 'rate_quote'
     OR p_origin_quote_hash IS NULL
     OR p_origin_quote_hash !~ '^[0-9a-f]{64}$'
     OR p_snapshot_hash IS NULL
     OR p_snapshot_hash !~ '^[0-9a-f]{64}$'
     OR p_currency IS NULL OR p_currency !~ '^[A-Z]{3}$'
     OR p_snapshot IS NULL
     OR pg_catalog.jsonb_typeof(p_snapshot) <> 'object'
     OR NOT (p_snapshot ?& ARRAY[
       'schemaVersion', 'origin', 'currency', 'revenueLine', 'assignments',
       'jurisdiction', 'evaluation', 'snapshotHash'
     ])
     OR p_snapshot - ARRAY[
       'schemaVersion', 'origin', 'currency', 'revenueLine', 'assignments',
       'jurisdiction', 'evaluation', 'snapshotHash'
     ] <> '{}'::jsonb
     OR p_snapshot -> 'schemaVersion' <> '1'::jsonb
     OR pg_catalog.jsonb_typeof(p_snapshot -> 'origin') <> 'object'
     OR NOT ((p_snapshot -> 'origin') ?& ARRAY['kind', 'quoteHash'])
     OR (p_snapshot -> 'origin') - ARRAY['kind', 'quoteHash'] <> '{}'::jsonb
     OR p_snapshot -> 'origin' ->> 'kind' IS DISTINCT FROM p_origin_kind
     OR p_snapshot -> 'origin' ->> 'quoteHash' IS DISTINCT FROM p_origin_quote_hash
     OR p_snapshot ->> 'currency' IS DISTINCT FROM p_currency
     OR p_snapshot ->> 'snapshotHash' IS DISTINCT FROM p_snapshot_hash
     OR pg_catalog.octet_length(
       pg_catalog.convert_to(p_snapshot::text, 'UTF8')
     ) NOT BETWEEN 1 AND 8388608 THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'tax attribution snapshot identity is invalid';
  END IF;

  PERFORM 1
    FROM public.tenant
   WHERE tenant.id = p_tenant
     AND tenant.status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'tax attribution authority is unavailable';
  END IF;
  PERFORM 1
    FROM public.org_node AS property
   WHERE property.tenant_id = p_tenant
     AND property.id = p_property
     AND property.kind = 'property';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'tax attribution authority is unavailable';
  END IF;
  PERFORM 1
    FROM public.app_user AS actor
   WHERE actor.tenant_id = p_tenant
     AND actor.id = p_actor
     AND actor.status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'tax attribution authority is unavailable';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'tax-attribution:' || p_tenant::text || ':' || p_snapshot_hash,
      244
    )
  );

  SELECT attribution.*
    INTO v_existing
    FROM public.tax_attribution_snapshot AS attribution
   WHERE attribution.tenant_id = p_tenant
     AND attribution.snapshot_hash = p_snapshot_hash;
  IF FOUND THEN
    IF v_existing.property_node IS DISTINCT FROM p_property
       OR v_existing.actor_id IS DISTINCT FROM p_actor
       OR v_existing.schema_version IS DISTINCT FROM p_schema_version::smallint
       OR v_existing.origin_kind IS DISTINCT FROM p_origin_kind
       OR v_existing.origin_quote_hash IS DISTINCT FROM p_origin_quote_hash
       OR v_existing.currency::text IS DISTINCT FROM p_currency
       OR v_existing.snapshot IS DISTINCT FROM p_snapshot THEN
      RAISE EXCEPTION USING ERRCODE = '23505',
        MESSAGE = 'tax attribution snapshot hash already has divergent evidence';
    END IF;
    RETURN QUERY SELECT
      v_existing.id, v_existing.property_node, v_existing.actor_id,
      v_existing.schema_version, v_existing.origin_kind,
      v_existing.origin_quote_hash, v_existing.snapshot_hash,
      v_existing.currency, v_existing.snapshot, v_existing.recorded_at, false;
    RETURN;
  END IF;

  INSERT INTO public.tax_attribution_snapshot (
    tenant_id, property_node, actor_id, schema_version, origin_kind,
    origin_quote_hash, snapshot_hash, currency, snapshot
  ) VALUES (
    p_tenant, p_property, p_actor, p_schema_version::smallint, p_origin_kind,
    p_origin_quote_hash, p_snapshot_hash, p_currency::character(3), p_snapshot
  )
  RETURNING * INTO v_created;

  RETURN QUERY SELECT
    v_created.id, v_created.property_node, v_created.actor_id,
    v_created.schema_version, v_created.origin_kind,
    v_created.origin_quote_hash, v_created.snapshot_hash,
    v_created.currency, v_created.snapshot, v_created.recorded_at, true;
END;
$_$;


--
-- Name: register_extension_type(uuid, text, jsonb, uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.register_extension_type(p_tenant uuid, p_type text, p_json_schema jsonb, p_actor uuid, p_property uuid, p_request uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'pg_temp'
    AS $_$
DECLARE
  v_property_timezone text;
  v_inserted boolean := false;
  v_existing jsonb;
  v_subject_bytes bytea;
  v_subject_hex text;
  v_subject uuid;
BEGIN
  IF session_user <> 'yellow_extension_registrar'
     OR current_user <> 'yellow_owner' THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'extension type registration requires the dedicated registrar';
  END IF;
  IF p_tenant IS NULL OR p_actor IS NULL OR p_property IS NULL OR p_request IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'extension type audit envelope is invalid';
  END IF;
  IF p_type IS NULL OR pg_catalog.length(p_type) > 64
     OR p_type !~ '^[a-z][a-z0-9_.-]*$' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'extension type must be a stable lowercase identifier';
  END IF;
  IF p_json_schema IS NULL OR pg_catalog.jsonb_typeof(p_json_schema) <> 'object'
     OR pg_catalog.octet_length(pg_catalog.convert_to(p_json_schema::text, 'UTF8')) > 16384 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'extension type schema must be a bounded JSON object';
  END IF;

  SELECT property.timezone INTO v_property_timezone
    FROM public.tenant AS tenant
    JOIN public.org_node AS property
      ON property.tenant_id = tenant.id
     AND property.id = p_property
     AND property.kind = 'property'
    JOIN public.app_user AS actor
      ON actor.tenant_id = tenant.id
     AND actor.id = p_actor
     AND actor.status = 'active'
   WHERE tenant.id = p_tenant
     AND tenant.status = 'active';
  IF v_property_timezone IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'extension type audit authority is invalid';
  END IF;

  INSERT INTO public.extension_type(type, json_schema)
  VALUES (p_type, p_json_schema)
  ON CONFLICT (type) DO NOTHING
  RETURNING true INTO v_inserted;

  IF NOT COALESCE(v_inserted, false) THEN
    SELECT extension_type.json_schema INTO v_existing
      FROM public.extension_type AS extension_type
     WHERE extension_type.type = p_type;
    IF v_existing IS DISTINCT FROM p_json_schema THEN
      RAISE EXCEPTION 'extension type % already exists with divergent schema', p_type
        USING ERRCODE = '23505';
    END IF;
    RETURN false;
  END IF;

  v_subject_bytes := public.digest(
    pg_catalog.uuid_send('6ba7b811-9dad-11d1-80b4-00c04fd430c8'::uuid)
      || pg_catalog.convert_to('https://yellow.local/extension-type/' || p_type, 'UTF8'),
    'sha1'
  );
  v_subject_bytes := pg_catalog.set_byte(
    v_subject_bytes, 6, (pg_catalog.get_byte(v_subject_bytes, 6) & 15) | 80
  );
  v_subject_bytes := pg_catalog.set_byte(
    v_subject_bytes, 8, (pg_catalog.get_byte(v_subject_bytes, 8) & 63) | 128
  );
  v_subject_hex := pg_catalog.encode(pg_catalog.substring(v_subject_bytes, 1, 16), 'hex');
  v_subject := (
    pg_catalog.substring(v_subject_hex, 1, 8) || '-' ||
    pg_catalog.substring(v_subject_hex, 9, 4) || '-' ||
    pg_catalog.substring(v_subject_hex, 13, 4) || '-' ||
    pg_catalog.substring(v_subject_hex, 17, 4) || '-' ||
    pg_catalog.substring(v_subject_hex, 21, 12)
  )::uuid;

  INSERT INTO public.fact_log(
    tenant_id, entity_type, entity_id, fact_type, valid_from, business_date,
    actor_id, payload, supersedes
  ) VALUES (
    p_tenant, 'extension_type', v_subject, 'extension_type.registered',
    pg_catalog.transaction_timestamp(),
    (pg_catalog.transaction_timestamp() AT TIME ZONE v_property_timezone)::date,
    p_actor,
    pg_catalog.jsonb_build_object(
      'type', p_type, 'json_schema', p_json_schema, 'request_id', p_request
    ),
    NULL
  );
  RETURN true;
END;
$_$;


--
-- Name: release_occupancy(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.release_occupancy(p_tenant uuid, p_slot uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'pg_temp'
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


--
-- Name: release_occupancy_typed_parent(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.release_occupancy_typed_parent(p_tenant uuid, p_slot uuid) RETURNS integer
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public', 'pg_temp'
    AS $$
DECLARE
  n int := 0;
  r record;
  v_authority text := NULLIF(
    pg_catalog.current_setting('app.tenant_id', true), ''
  );
  v_invoker_role text := pg_catalog.current_setting('role', true);
  v_tenant uuid;
  v_parent_valid boolean;
  v_ids uuid[] := ARRAY[]::uuid[];
  v_deleted int;
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
    SELECT so.id, so.space_id, so.period, so.slot_ref, so.slot_kind, so.exclusive
      FROM public.space_occupancy AS so
     WHERE so.tenant_id = v_tenant
       AND so.slot_ref = p_slot
     ORDER BY so.id
     FOR UPDATE
  LOOP
    v_parent_valid := false;

    IF r.slot_kind = 'hold' THEN
      SELECT true
        INTO v_parent_valid
        FROM public.hold AS h
        JOIN public.sellable_unit AS su
          ON su.id = h.sellable_unit_id
         AND su.tenant_id = h.tenant_id
        JOIN public.unit_type AS ut
          ON ut.id = su.unit_type_id
         AND ut.tenant_id = su.tenant_id
         AND ut.property_node = h.property_node
        JOIN public.sellable_unit_space AS sus
          ON sus.sellable_unit_id = su.id
         AND sus.tenant_id = su.tenant_id
         AND sus.space_id = r.space_id
         AND sus.claim_mode = CASE WHEN r.exclusive THEN 'exclusive' ELSE 'positional' END
        JOIN public.space AS s
          ON s.id = sus.space_id
         AND s.tenant_id = sus.tenant_id
         AND s.property_node = h.property_node
       WHERE h.id = r.slot_ref
         AND h.tenant_id = v_tenant
         AND h.status = 'active'
         AND h.period = r.period;
    ELSIF r.slot_kind = 'segment' THEN
      SELECT true
        INTO v_parent_valid
        FROM public.reservation_segment AS rs
        JOIN public.reservation AS reservation
          ON reservation.id = rs.reservation_id
         AND reservation.tenant_id = rs.tenant_id
        JOIN public.sellable_unit AS su
          ON su.id = rs.sellable_unit_id
         AND su.tenant_id = rs.tenant_id
         AND su.unit_type_id = rs.unit_type_id
        JOIN public.unit_type AS ut
          ON ut.id = rs.unit_type_id
         AND ut.tenant_id = rs.tenant_id
         AND ut.property_node = reservation.property_node
        JOIN public.sellable_unit_space AS sus
          ON sus.sellable_unit_id = su.id
         AND sus.tenant_id = su.tenant_id
         AND sus.space_id = r.space_id
         AND sus.claim_mode = CASE WHEN r.exclusive THEN 'exclusive' ELSE 'positional' END
        JOIN public.space AS s
          ON s.id = sus.space_id
         AND s.tenant_id = sus.tenant_id
         AND s.property_node = reservation.property_node
       WHERE rs.id = r.slot_ref
         AND rs.tenant_id = v_tenant
         AND rs.status IN ('booked', 'in_house')
         AND rs.period = r.period;
    ELSIF r.slot_kind = 'ooo' THEN
      SELECT true
        INTO v_parent_valid
        FROM public.ooo_oos AS block
        JOIN public.space AS s
          ON s.id = block.space_id
         AND s.tenant_id = block.tenant_id
       WHERE block.id = r.slot_ref
         AND block.tenant_id = v_tenant
         AND block.kind = 'ooo'
         AND NOT pg_catalog.isempty(block.period)
         AND pg_catalog.upper(block.period) > pg_catalog.transaction_timestamp()
         AND block.space_id = r.space_id
         AND block.period = r.period
         AND r.exclusive;
    END IF;

    IF v_parent_valid IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'occupancy typed parent is invalid or stale'
        USING ERRCODE = 'P0003';
    END IF;
    v_ids := pg_catalog.array_append(v_ids, r.id);
    n := n + 1;
  END LOOP;

  IF n = 0 THEN
    RAISE EXCEPTION 'occupancy slot is unknown or foreign'
      USING ERRCODE = 'P0003';
  END IF;

  DELETE FROM public.space_occupancy
   WHERE id = ANY(v_ids);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  IF v_deleted <> n THEN
    RAISE EXCEPTION 'validated occupancy changed concurrently'
      USING ERRCODE = '40001';
  END IF;
  RETURN n;
END $$;


--
-- Name: report_room_discrepancy(uuid, uuid, uuid, text, integer, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.report_room_discrepancy(p_tenant uuid, p_property uuid, p_space uuid, p_observed_presence text, p_observed_persons integer, p_actor uuid) RETURNS TABLE(discrepancy_id uuid, room_id uuid, room_code text, room_floor text, discrepancy_kind text, reported_value text, system_value text, reporter_id uuid, discrepancy_reported_at timestamp with time zone, created boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
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


--
-- Name: runtime_consumer_advance(text, bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.runtime_consumer_advance(p_consumer text, p_last_seq bigint) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'pg_temp'
    AS $_$
DECLARE
  v_current bigint;
BEGIN
  IF p_consumer IS NULL OR pg_catalog.length(p_consumer) > 64
     OR p_consumer !~ '^[a-z][a-z0-9-]*$' THEN
    RAISE EXCEPTION 'consumer must be a stable lowercase name' USING ERRCODE = '22023';
  END IF;
  IF p_last_seq IS NULL OR p_last_seq < 0 THEN
    RAISE EXCEPTION 'consumer cursor must be non-negative' USING ERRCODE = '22023';
  END IF;

  SELECT c.last_seq INTO v_current
    FROM public.consumer_cursor AS c
   WHERE c.consumer = p_consumer
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'consumer cursor was not begun' USING ERRCODE = '55000';
  END IF;
  IF p_last_seq < v_current THEN
    RAISE EXCEPTION 'consumer cursor cannot move backwards' USING ERRCODE = '22023';
  END IF;

  IF p_last_seq <> v_current THEN
    UPDATE public.consumer_cursor
       SET last_seq = p_last_seq, updated_at = pg_catalog.now()
     WHERE consumer = p_consumer;
  END IF;
  RETURN p_last_seq;
END
$_$;


--
-- Name: runtime_consumer_begin(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.runtime_consumer_begin(p_consumer text) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'pg_temp'
    AS $_$
DECLARE
  v_last_seq bigint;
BEGIN
  IF p_consumer IS NULL OR pg_catalog.length(p_consumer) > 64
     OR p_consumer !~ '^[a-z][a-z0-9-]*$' THEN
    RAISE EXCEPTION 'consumer must be a stable lowercase name' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.consumer_cursor (consumer, last_seq)
  VALUES (p_consumer, 0)
  ON CONFLICT (consumer) DO NOTHING;

  SELECT c.last_seq INTO STRICT v_last_seq
    FROM public.consumer_cursor AS c
   WHERE c.consumer = p_consumer
   FOR UPDATE;
  RETURN v_last_seq;
END
$_$;


--
-- Name: runtime_consumer_mark(text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.runtime_consumer_mark(p_consumer text, p_outbox_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'pg_temp'
    AS $_$
DECLARE
  v_inserted boolean;
BEGIN
  IF p_consumer IS NULL OR pg_catalog.length(p_consumer) > 64
     OR p_consumer !~ '^[a-z][a-z0-9-]*$' OR p_outbox_id IS NULL THEN
    RAISE EXCEPTION 'valid consumer and outbox id are required' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.consumer_processed (consumer, outbox_id)
  VALUES (p_consumer, p_outbox_id)
  ON CONFLICT (consumer, outbox_id) DO NOTHING
  RETURNING true INTO v_inserted;
  RETURN COALESCE(v_inserted, false);
END
$_$;


--
-- Name: runtime_consumer_read(text, bigint, integer, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.runtime_consumer_read(p_consumer text, p_after bigint, p_limit integer, p_unpublished boolean) RETURNS TABLE(seq bigint, id uuid, tenant_id uuid, property_node uuid, business_date text, aggregate_type text, aggregate_id uuid, event_type text, event_version integer, actor_id uuid, correlation_id uuid, causation_id uuid, created_at timestamp with time zone, payload jsonb)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'pg_temp'
    AS $_$
DECLARE
  v_cursor bigint;
BEGIN
  IF p_consumer IS NULL OR pg_catalog.length(p_consumer) > 64
     OR p_consumer !~ '^[a-z][a-z0-9-]*$' THEN
    RAISE EXCEPTION 'consumer must be a stable lowercase name' USING ERRCODE = '22023';
  END IF;
  IF p_after IS NULL OR p_after < 0 THEN
    RAISE EXCEPTION 'consumer cursor must be non-negative' USING ERRCODE = '22023';
  END IF;
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 1000 THEN
    RAISE EXCEPTION 'consumer batch limit must be between 1 and 1000' USING ERRCODE = '22023';
  END IF;
  IF p_unpublished IS NULL THEN
    RAISE EXCEPTION 'unpublished selector is required' USING ERRCODE = '22023';
  END IF;

  SELECT c.last_seq INTO v_cursor
    FROM public.consumer_cursor AS c
   WHERE c.consumer = p_consumer
   FOR UPDATE;
  IF NOT FOUND OR v_cursor <> p_after THEN
    RAISE EXCEPTION 'consumer cursor changed or was not begun' USING ERRCODE = '55000';
  END IF;

  IF p_unpublished THEN
    RETURN QUERY
    SELECT o.seq,
           o.id,
           o.tenant_id,
           o.property_node,
           o.business_date::text,
           o.aggregate_type,
           o.aggregate_id,
           o.event_type,
           o.event_version,
           o.actor_id,
           o.correlation_id,
           o.causation_id,
           o.created_at,
           o.payload
      FROM public.outbox AS o
     WHERE o.published_at IS NULL
     ORDER BY o.seq
     LIMIT p_limit;
  ELSE
    RETURN QUERY
    SELECT o.seq,
           o.id,
           o.tenant_id,
           o.property_node,
           o.business_date::text,
           o.aggregate_type,
           o.aggregate_id,
           o.event_type,
           o.event_version,
           o.actor_id,
           o.correlation_id,
           o.causation_id,
           o.created_at,
           o.payload
      FROM public.outbox AS o
     WHERE o.seq > p_after
     ORDER BY o.seq
     LIMIT p_limit;
  END IF;
END
$_$;


--
-- Name: runtime_due_arrival_scopes(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.runtime_due_arrival_scopes(p_limit integer) RETURNS TABLE(tenant_id uuid, property_node uuid)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'pg_temp'
    AS $$
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 1000 THEN
    RAISE EXCEPTION 'limit must be between 1 and 1000' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT reservation.tenant_id, reservation.property_node
    FROM public.reservation AS reservation
    JOIN public.tenant AS tenant
      ON tenant.id = reservation.tenant_id
     AND tenant.status = 'active'
    JOIN public.org_node AS property
      ON property.tenant_id = reservation.tenant_id
     AND property.id = reservation.property_node
     AND property.kind = 'property'
    JOIN pg_catalog.pg_timezone_names AS timezone
      ON timezone.name = property.timezone
    JOIN LATERAL (
      SELECT segment.status, segment.period
        FROM public.reservation_segment AS segment
       WHERE segment.tenant_id = reservation.tenant_id
         AND segment.reservation_id = reservation.id
       ORDER BY segment.seq DESC, segment.id DESC
       LIMIT 1
    ) AS latest ON latest.status = 'booked'
   WHERE reservation.status = 'reserved'
     AND (pg_catalog.lower(latest.period) AT TIME ZONE timezone.name)::date =
         (pg_catalog.transaction_timestamp() AT TIME ZONE timezone.name)::date
   GROUP BY reservation.tenant_id, reservation.property_node
   ORDER BY reservation.tenant_id, reservation.property_node
   LIMIT p_limit;
END
$$;


--
-- Name: runtime_due_business_day_scopes(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.runtime_due_business_day_scopes(p_limit integer) RETURNS TABLE(tenant_id uuid, property_node uuid)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'pg_temp'
    AS $$
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 1000 THEN
    RAISE EXCEPTION 'limit must be between 1 and 1000' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT tenant.id, property.id
    FROM public.tenant AS tenant
    JOIN public.org_node AS property
      ON property.tenant_id = tenant.id
     AND property.kind = 'property'
    JOIN pg_catalog.pg_timezone_names AS timezone
      ON timezone.name = property.timezone
   WHERE tenant.status = 'active'
     AND NOT EXISTS (
       SELECT 1
         FROM public.business_day AS day
        WHERE day.tenant_id = tenant.id
          AND day.property_node = property.id
          AND day.business_date =
              (pg_catalog.transaction_timestamp() AT TIME ZONE timezone.name)::date
     )
   ORDER BY tenant.id, property.id
   LIMIT p_limit;
END
$$;


--
-- Name: runtime_due_departure_scopes(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.runtime_due_departure_scopes(p_limit integer) RETURNS TABLE(tenant_id uuid, property_node uuid)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'pg_temp'
    AS $$
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 1000 THEN
    RAISE EXCEPTION 'limit must be between 1 and 1000' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT reservation.tenant_id, reservation.property_node
    FROM public.reservation AS reservation
    JOIN public.tenant AS tenant
      ON tenant.id = reservation.tenant_id
     AND tenant.status = 'active'
    JOIN public.org_node AS property
      ON property.tenant_id = reservation.tenant_id
     AND property.id = reservation.property_node
     AND property.kind = 'property'
    JOIN pg_catalog.pg_timezone_names AS timezone
      ON timezone.name = property.timezone
    JOIN LATERAL (
      SELECT segment.status, segment.period
        FROM public.reservation_segment AS segment
       WHERE segment.tenant_id = reservation.tenant_id
         AND segment.reservation_id = reservation.id
       ORDER BY segment.seq DESC, segment.id DESC
       LIMIT 1
    ) AS latest ON latest.status = 'in_house'
   WHERE reservation.status = 'in_house'
     AND (pg_catalog.upper(latest.period) AT TIME ZONE timezone.name)::date =
         (pg_catalog.transaction_timestamp() AT TIME ZONE timezone.name)::date
   GROUP BY reservation.tenant_id, reservation.property_node
   ORDER BY reservation.tenant_id, reservation.property_node
   LIMIT p_limit;
END
$$;


--
-- Name: runtime_due_hold_scopes(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.runtime_due_hold_scopes(p_limit integer) RETURNS TABLE(tenant_id uuid, property_node uuid)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'pg_temp'
    AS $$
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 1000 THEN
    RAISE EXCEPTION 'limit must be between 1 and 1000' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT h.tenant_id, h.property_node
    FROM public.hold AS h
   WHERE h.status = 'active'
     AND h.expires_at <= pg_catalog.transaction_timestamp()
   GROUP BY h.tenant_id, h.property_node
   ORDER BY pg_catalog.min(h.expires_at), h.tenant_id, h.property_node
   LIMIT p_limit;
END
$$;


--
-- Name: runtime_extension_compatibility_inputs(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.runtime_extension_compatibility_inputs(p_type text) RETURNS TABLE(id uuid, content jsonb)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'pg_temp'
    AS $_$
BEGIN
  IF p_type IS NULL OR pg_catalog.length(p_type) > 64
     OR p_type !~ '^[a-z][a-z0-9_.-]*$' THEN
    RAISE EXCEPTION 'extension type must be a stable lowercase identifier'
      USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
  SELECT e.id, e.content
    FROM public.extension AS e
   WHERE e.type = p_type
   ORDER BY e.id;
END
$_$;


--
-- Name: runtime_mark_outbox_published(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.runtime_mark_outbox_published(p_event_ids uuid[]) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'pg_temp'
    AS $$
DECLARE
  v_count integer;
  v_size integer := COALESCE(pg_catalog.cardinality(p_event_ids), -1);
BEGIN
  IF v_size < 1 OR v_size > 1000 OR pg_catalog.array_position(p_event_ids, NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'event id array must contain between 1 and 1000 non-null UUIDs'
      USING ERRCODE = '22023';
  END IF;

  WITH ids AS (
    SELECT DISTINCT event_id
      FROM pg_catalog.unnest(p_event_ids) AS event_id
  ), marked AS (
    UPDATE public.outbox AS o
       SET published_at = COALESCE(o.published_at, pg_catalog.now())
     WHERE o.id IN (SELECT event_id FROM ids)
    RETURNING 1
  )
  SELECT pg_catalog.count(*)::integer INTO v_count FROM marked;
  RETURN v_count;
END
$$;


--
-- Name: runtime_prune_outbox(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.runtime_prune_outbox(p_retention_seconds integer) RETURNS TABLE(processed integer, outbox bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'pg_temp'
    AS $$
DECLARE
  v_processed integer;
  v_outbox bigint;
BEGIN
  IF p_retention_seconds IS NULL OR p_retention_seconds < 0 THEN
    RAISE EXCEPTION 'retention seconds must be a non-negative integer' USING ERRCODE = '22023';
  END IF;

  WITH gone AS (
    DELETE FROM public.consumer_processed AS processed_row
    USING public.outbox AS event
     WHERE processed_row.outbox_id = event.id
       AND event.published_at IS NOT NULL
       AND event.published_at < pg_catalog.now()
           - pg_catalog.make_interval(secs => p_retention_seconds)
    RETURNING 1
  )
  SELECT pg_catalog.count(*)::integer INTO v_processed FROM gone;

  SELECT public.prune_outbox(pg_catalog.make_interval(secs => p_retention_seconds))
    INTO v_outbox;
  RETURN QUERY SELECT v_processed, v_outbox;
END
$$;


--
-- Name: runtime_resolve_active_tenant(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.runtime_resolve_active_tenant(p_slug text) RETURNS uuid
    LANGUAGE sql STABLE STRICT SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'pg_temp'
    AS $_$
  SELECT t.id
    FROM public.tenant AS t
   WHERE pg_catalog.length(p_slug) BETWEEN 1 AND 63
     AND p_slug ~ '^[a-z0-9][a-z0-9-]{0,62}$'
     AND t.slug = p_slug
     AND t.status = 'active'
$_$;


--
-- Name: runtime_visible_extension_effective_period(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.runtime_visible_extension_effective_period(p_tenant uuid, p_extension uuid) RETURNS TABLE(extension_id uuid, owner_tenant_id uuid, effective_from_instant timestamp with time zone, effective_to_instant timestamp with time zone)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'pg_temp'
    AS $$
DECLARE
  v_ranges tstzrange[];
  v_extension_ids uuid[];
  v_owner_tenant_ids uuid[];
  v_effective tstzrange;
BEGIN
  IF session_user <> 'yellow_runtime' THEN
    RAISE EXCEPTION 'extension effective-period capability requires yellow_runtime'
      USING ERRCODE = '42501';
  END IF;
  IF p_tenant IS NULL OR p_extension IS NULL THEN
    RAISE EXCEPTION 'tenant id and selected extension id are required'
      USING ERRCODE = '22023';
  END IF;

  SELECT pg_catalog.array_agg(e.id ORDER BY e.id),
         pg_catalog.array_agg(e.tenant_id ORDER BY e.id),
         pg_catalog.array_agg(e.effective ORDER BY e.id)
    INTO v_extension_ids, v_owner_tenant_ids, v_ranges
    FROM public.extension AS e
   WHERE e.id = p_extension
     AND (e.tenant_id IS NULL OR e.tenant_id = p_tenant);

  IF COALESCE(pg_catalog.cardinality(v_ranges), 0) <> 1 THEN
    RAISE EXCEPTION 'selected visible extension identity is invalid'
      USING ERRCODE = '22023';
  END IF;
  v_effective := v_ranges[1];

  IF v_effective IS NULL
     OR pg_catalog.isempty(v_effective)
     OR (NOT pg_catalog.lower_inf(v_effective)
         AND (NOT pg_catalog.isfinite(pg_catalog.lower(v_effective))
              OR NOT pg_catalog.lower_inc(v_effective)))
     OR (NOT pg_catalog.upper_inf(v_effective)
         AND (NOT pg_catalog.isfinite(pg_catalog.upper(v_effective))
              OR pg_catalog.upper_inc(v_effective))) THEN
    RAISE EXCEPTION 'selected extension effective period is malformed'
      USING ERRCODE = '22023';
  END IF;

  RETURN QUERY SELECT
    v_extension_ids[1],
    v_owner_tenant_ids[1],
    CASE WHEN pg_catalog.lower_inf(v_effective)
      THEN NULL::timestamptz ELSE pg_catalog.lower(v_effective) END,
    CASE WHEN pg_catalog.upper_inf(v_effective)
      THEN NULL::timestamptz ELSE pg_catalog.upper(v_effective) END;
END
$$;


--
-- Name: runtime_visible_extensions(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.runtime_visible_extensions(p_tenant uuid) RETURNS TABLE(id uuid, tenant_id uuid, type text, key text, version integer, content jsonb, status text)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'pg_temp'
    AS $$
BEGIN
  IF p_tenant IS NULL THEN
    RAISE EXCEPTION 'tenant id is required' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
  SELECT e.id, e.tenant_id, e.type, e.key, e.version, e.content, e.status
    FROM public.extension AS e
   WHERE e.tenant_id IS NULL OR e.tenant_id = p_tenant
   ORDER BY e.type, e.key, e.version;
END
$$;


--
-- Name: seal_business_day(uuid, uuid, date, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.seal_business_day(p_tenant uuid, p_property uuid, p_date date, p_user uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'pg_temp'
    AS $$
DECLARE
  v_authority text := NULLIF(pg_catalog.current_setting('app.tenant_id', true), '');
  v_invoker_role text := pg_catalog.current_setting('role', true);
BEGIN
  IF v_authority IS NULL
     AND (session_user = 'app_role' OR v_invoker_role = 'app_role') THEN
    RAISE EXCEPTION 'tenant authority missing' USING ERRCODE = '42501';
  END IF;
  IF v_authority IS NOT NULL AND v_authority::uuid <> p_tenant THEN
    RAISE EXCEPTION 'tenant authority mismatch' USING ERRCODE = '42501';
  END IF;

  UPDATE public.business_day
     SET sealed_at = pg_catalog.now(), sealed_by = p_user
   WHERE tenant_id = p_tenant
     AND property_node = p_property
     AND business_date = p_date
     AND sealed_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'day missing or already sealed' USING ERRCODE = 'P0012';
  END IF;
END $$;


--
-- Name: seal_business_day_audited(uuid, uuid, date, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.seal_business_day_audited(p_tenant uuid, p_property uuid, p_date date, p_actor uuid) RETURNS TABLE(tenant_id uuid, property_node uuid, business_date date, previous_state text, state text, sealed_at timestamp with time zone, sealed_by uuid)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'pg_temp'
    AS $_$
#variable_conflict use_column
DECLARE
  v_context uuid;
  v_day public.business_day%ROWTYPE;
  v_sealed_at timestamptz;
  v_ready boolean;
BEGIN
  IF session_user <> 'yellow_runtime'
     OR pg_catalog.current_setting('role', true) IS DISTINCT FROM 'app_role'
     OR current_user <> 'yellow_owner' THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='audited business-day seal requires governed runtime';
  END IF;

  BEGIN
    v_context := NULLIF(pg_catalog.current_setting('app.tenant_id', true), '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='invalid tenant context';
  END;

  IF p_tenant IS NULL OR p_property IS NULL OR p_date IS NULL OR p_actor IS NULL
     OR v_context IS NULL OR v_context <> p_tenant THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='invalid audited business-day seal context';
  END IF;

  -- Fixed lexical relation order. SHARE ROW EXCLUSIVE conflicts with every ordinary
  -- writer and with another seal before either can acquire row/update locks, avoiding
  -- lock-upgrade deadlocks while preserving one coherent readiness transaction.
  LOCK TABLE public.app_user IN SHARE ROW EXCLUSIVE MODE;
  LOCK TABLE public.business_day IN SHARE ROW EXCLUSIVE MODE;
  LOCK TABLE public.business_day_discrepancy_carry IN SHARE ROW EXCLUSIVE MODE;
  LOCK TABLE public.cashier_session IN SHARE ROW EXCLUSIVE MODE;
  LOCK TABLE public.discrepancy IN SHARE ROW EXCLUSIVE MODE;
  LOCK TABLE public.document IN SHARE ROW EXCLUSIVE MODE;
  LOCK TABLE public.fiscal_submission IN SHARE ROW EXCLUSIVE MODE;
  LOCK TABLE public.inbound_message IN SHARE ROW EXCLUSIVE MODE;
  LOCK TABLE public.org_node IN SHARE ROW EXCLUSIVE MODE;
  LOCK TABLE public.outbox IN SHARE ROW EXCLUSIVE MODE;
  LOCK TABLE public.payment IN SHARE ROW EXCLUSIVE MODE;
  LOCK TABLE public.payment_operation IN SHARE ROW EXCLUSIVE MODE;
  LOCK TABLE public.reservation IN SHARE ROW EXCLUSIVE MODE;
  LOCK TABLE public.role_permission IN SHARE ROW EXCLUSIVE MODE;
  LOCK TABLE public.space IN SHARE ROW EXCLUSIVE MODE;
  LOCK TABLE public.statutory_submission IN SHARE ROW EXCLUSIVE MODE;
  LOCK TABLE public.tenant IN SHARE ROW EXCLUSIVE MODE;
  LOCK TABLE public.user_role IN SHARE ROW EXCLUSIVE MODE;

  PERFORM 1
    FROM public.tenant AS t
    JOIN public.app_user AS actor
      ON actor.tenant_id=t.id AND actor.id=p_actor AND actor.status='active'
    JOIN public.user_role AS ur
      ON ur.tenant_id=actor.tenant_id AND ur.user_id=actor.id
    JOIN public.role_permission AS rp
      ON rp.role_id=ur.role_id AND rp.permission_code='business_day.seal'
    JOIN public.org_node AS grant_node
      ON grant_node.tenant_id=ur.tenant_id AND grant_node.id=ur.scope_node
      AND grant_node.kind='property' AND grant_node.id=p_property
    JOIN public.org_node AS property
      ON property.tenant_id=t.id AND property.id=p_property
      AND property.kind='property' AND grant_node.path @> property.path
   WHERE t.id=p_tenant AND t.status='active';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='business-day seal actor is unauthorized';
  END IF;

  SELECT day.* INTO v_day
    FROM public.business_day AS day
   WHERE day.tenant_id=p_tenant
     AND day.property_node=p_property
     AND day.business_date=p_date
     AND day.sealed_at IS NULL
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='55000', MESSAGE='business day is missing or already sealed';
  END IF;

  WITH target AS MATERIALIZED (
          SELECT day.tenant_id, day.property_node, day.business_date,
                 pg_catalog.transaction_timestamp() AS captured_at
            FROM public.business_day AS day
            JOIN public.tenant ON tenant.id=day.tenant_id AND tenant.status='active'
            JOIN public.org_node AS property ON property.tenant_id=day.tenant_id
              AND property.id=day.property_node AND property.kind='property'
            JOIN public.app_user AS actor ON actor.tenant_id=day.tenant_id
              AND actor.id=p_actor AND actor.status='active'
           WHERE day.tenant_id=p_tenant
             AND day.property_node=p_property
             AND day.business_date=p_date
             AND day.sealed_at IS NULL
        ),
        due AS MATERIALIZED (
          SELECT count(*) FILTER (WHERE reservation.status='due_in' AND transition.safe
            AND transition.property_node=(SELECT property_node FROM target)
            AND transition.business_date=(SELECT business_date FROM target))::bigint AS due_in,
                 count(*) FILTER (WHERE reservation.status='due_out' AND transition.safe
            AND transition.property_node=(SELECT property_node FROM target)
            AND transition.business_date=(SELECT business_date FROM target))::bigint AS due_out,
                 count(*) FILTER (WHERE NOT COALESCE(transition.safe,false))::bigint AS unknown_due
            FROM public.reservation
            LEFT JOIN LATERAL (
              SELECT event.property_node, event.business_date,
                     event.event_type=('reservation.' || reservation.status) AND event.property_node IS NOT NULL
                       AND property.id IS NOT NULL AS safe
                FROM public.outbox AS event
                LEFT JOIN public.org_node AS property ON property.tenant_id=event.tenant_id
                  AND property.id=event.property_node AND property.kind='property'
               WHERE event.tenant_id=reservation.tenant_id
                 AND event.aggregate_type='reservation' AND event.aggregate_id=reservation.id
                 AND event.event_type IN ('reservation.due_in','reservation.due_out')
               ORDER BY event.seq DESC LIMIT 1
            ) AS transition ON true
           WHERE reservation.tenant_id=(SELECT tenant_id FROM target)
             AND reservation.status IN ('due_in','due_out')
        ),
        cashiers AS MATERIALIZED (
          SELECT count(*)::bigint AS open_cashiers FROM public.cashier_session
           WHERE tenant_id=(SELECT tenant_id FROM target)
             AND property_node=(SELECT property_node FROM target)
             AND business_date=(SELECT business_date FROM target) AND closed_at IS NULL
        ),
        reported_discrepancy_evidence AS MATERIALIZED (
          SELECT discrepancy.id,
                 count(event.seq)::bigint AS event_count,
                 min(event.property_node::text)::uuid AS event_property,
                 min(event.business_date) AS event_date
            FROM public.discrepancy
            LEFT JOIN public.outbox AS event ON event.tenant_id=discrepancy.tenant_id
              AND event.aggregate_type='discrepancy' AND event.aggregate_id=discrepancy.id
              AND event.event_type='discrepancy.reported'
           WHERE discrepancy.tenant_id=(SELECT tenant_id FROM target) AND discrepancy.resolved_at IS NULL
           GROUP BY discrepancy.id
        ),
        carried_discrepancy_event_evidence AS MATERIALIZED (
          SELECT discrepancy.id,
                 count(event.seq)::bigint AS event_count,
                 min(event.property_node::text)::uuid AS event_property,
                 min(event.business_date) AS event_date,
                 min(event.actor_id::text)::uuid AS event_actor,
                 min(event.correlation_id::text)::uuid AS event_request,
                 min(event.created_at) AS event_created_at
            FROM public.discrepancy
            LEFT JOIN public.outbox AS event ON event.tenant_id=discrepancy.tenant_id
              AND event.aggregate_type='discrepancy' AND event.aggregate_id=discrepancy.id
              AND event.event_type='discrepancy.carried'
           WHERE discrepancy.tenant_id=(SELECT tenant_id FROM target) AND discrepancy.resolved_at IS NULL
           GROUP BY discrepancy.id
        ),
        carried_discrepancy_link_evidence AS MATERIALIZED (
          SELECT target_discrepancy.id,
                 count(carry.id)::bigint AS link_count,
                 count(carry.id) FILTER (WHERE
                   source_discrepancy.id IS NOT NULL
                   AND source_discrepancy.id<>target_discrepancy.id
                   AND carry.source_business_date<>carry.target_business_date
                   AND carry.property_node=target_space.property_node
                   AND carry.space_id=target_discrepancy.space_id
                   AND carry.space_id=source_discrepancy.space_id
                   AND source_space.property_node=carry.property_node
                   AND source_discrepancy.resolution='carried_forward'
                   AND source_discrepancy.resolved_at=carry.carried_at
                   AND source_report.event_count=1
                   AND source_report.event_property=carry.property_node
                   AND source_report.event_date=carry.source_business_date
                   AND target_discrepancy.reported=source_discrepancy.reported
                   AND target_discrepancy.system_state=source_discrepancy.system_state
                   AND target_discrepancy.reported_by=carry.requested_by
                   AND target_discrepancy.reported_at=carry.carried_at
                   AND carry.resolution='carried_forward'
                   AND carry.requested_by<>carry.approved_by
                   AND carry.approval_requested_at<=carry.approval_decided_at
                   AND carry.approval_decided_at<=carry.carried_at
                   AND source_day.tenant_id IS NOT NULL
                   AND target_day.tenant_id IS NOT NULL
                   AND target_day.opened_at=carry.target_opened_at
                   AND carry.discrepancy_state_hash ~ '^[0-9a-f]{64}$'
                   AND carry.request_hash ~ '^[0-9a-f]{64}$'
                   AND carry.discrepancy_state_hash=canonical.discrepancy_state_hash
                   AND carry.request_hash=canonical.request_hash
                 )::bigint AS safe_link_count,
                 min(carry.property_node::text)::uuid AS link_property,
                 min(carry.target_business_date) AS link_target_date,
                 min(carry.requested_by::text)::uuid AS link_requester,
                 min(carry.request_id::text)::uuid AS link_request,
                 min(carry.carried_at) AS link_carried_at
            FROM public.discrepancy AS target_discrepancy
            LEFT JOIN public.space AS target_space ON target_space.tenant_id=target_discrepancy.tenant_id
              AND target_space.id=target_discrepancy.space_id
            LEFT JOIN public.business_day_discrepancy_carry AS carry
              ON carry.tenant_id=target_discrepancy.tenant_id
              AND carry.target_discrepancy_id=target_discrepancy.id
            LEFT JOIN public.discrepancy AS source_discrepancy ON source_discrepancy.tenant_id=carry.tenant_id
              AND source_discrepancy.id=carry.source_discrepancy_id
            LEFT JOIN public.space AS source_space ON source_space.tenant_id=source_discrepancy.tenant_id
              AND source_space.id=source_discrepancy.space_id
            LEFT JOIN public.business_day AS source_day ON source_day.tenant_id=carry.tenant_id
              AND source_day.property_node=carry.property_node
              AND source_day.business_date=carry.source_business_date
            LEFT JOIN LATERAL (
              SELECT count(event.seq)::bigint AS event_count,
                     min(event.property_node::text)::uuid AS event_property,
                     min(event.business_date) AS event_date
                FROM public.outbox AS event
               WHERE event.tenant_id=carry.tenant_id
                 AND event.aggregate_type='discrepancy'
                 AND event.aggregate_id=source_discrepancy.id
                 AND event.event_type='discrepancy.reported'
            ) AS source_report ON carry.id IS NOT NULL AND source_discrepancy.id IS NOT NULL
            LEFT JOIN public.business_day AS target_day ON target_day.tenant_id=carry.tenant_id
              AND target_day.property_node=carry.property_node
              AND target_day.business_date=carry.target_business_date
            LEFT JOIN LATERAL (
              SELECT state.discrepancy_state_hash,
                     pg_catalog.encode(public.digest(pg_catalog.jsonb_build_object(
                       'v',1,'tenantId',carry.tenant_id,'propertyNode',carry.property_node,
                       'discrepancyId',source_discrepancy.id,
                       'sourceBusinessDate',carry.source_business_date,
                       'targetBusinessDate',carry.target_business_date,'reason',carry.reason,
                       'discrepancyStateHash',state.discrepancy_state_hash,
                       'targetOpenedAt',carry.target_opened_at
                     )::text,'sha256'),'hex') AS request_hash
                FROM LATERAL (
                  SELECT pg_catalog.encode(public.digest(pg_catalog.jsonb_build_object(
                    'v',1,'tenantId',carry.tenant_id,'discrepancyId',source_discrepancy.id,
                    'spaceId',source_discrepancy.space_id,'reported',source_discrepancy.reported,
                    'systemState',source_discrepancy.system_state,
                    'reportedBy',source_discrepancy.reported_by,
                    'reportedAt',source_discrepancy.reported_at,'resolvedAt',NULL
                  )::text,'sha256'),'hex') AS discrepancy_state_hash
                ) AS state
            ) AS canonical ON carry.id IS NOT NULL AND source_discrepancy.id IS NOT NULL
           WHERE target_discrepancy.tenant_id=(SELECT tenant_id FROM target)
             AND target_discrepancy.resolved_at IS NULL
           GROUP BY target_discrepancy.id
        ),
        discrepancy_evidence AS MATERIALIZED (
          SELECT discrepancy.id, space.property_node AS space_property,
                 reported.event_count AS reported_event_count,
                 reported.event_property AS reported_event_property,
                 reported.event_date AS reported_event_date,
                 carried_event.event_count AS carried_event_count,
                 carried_event.event_property AS carried_event_property,
                 carried_event.event_date AS carried_event_date,
                 carry.link_count, carry.safe_link_count, carry.link_property,
                 carry.link_target_date, carry.link_requester, carry.link_request,
                 carry.link_carried_at, carried_event.event_actor,
                 carried_event.event_request, carried_event.event_created_at,
                 (carry.link_count=1 AND carry.safe_link_count=1
                   AND reported.event_count=0 AND carried_event.event_count=1
                   AND carry.link_property=carried_event.event_property
                   AND carry.link_target_date=carried_event.event_date
                   AND carry.link_requester=carried_event.event_actor
                   AND carry.link_request=carried_event.event_request
                   AND carry.link_carried_at=carried_event.event_created_at) AS safe_carry
            FROM public.discrepancy
            LEFT JOIN public.space ON space.tenant_id=discrepancy.tenant_id AND space.id=discrepancy.space_id
            JOIN reported_discrepancy_evidence AS reported ON reported.id=discrepancy.id
            JOIN carried_discrepancy_event_evidence AS carried_event ON carried_event.id=discrepancy.id
            JOIN carried_discrepancy_link_evidence AS carry ON carry.id=discrepancy.id
           WHERE discrepancy.tenant_id=(SELECT tenant_id FROM target) AND discrepancy.resolved_at IS NULL
        ),
        discrepancies AS MATERIALIZED (
          SELECT count(*) FILTER (WHERE
                   (reported_event_count=1 AND carried_event_count=0 AND link_count=0
                     AND space_property=reported_event_property
                     AND reported_event_property=(SELECT property_node FROM target)
                     AND reported_event_date=(SELECT business_date FROM target))
                   OR (safe_carry AND link_property=(SELECT property_node FROM target)
                     AND link_target_date=(SELECT business_date FROM target)))::bigint AS discrepancies,
                 count(*) FILTER (WHERE NOT safe_carry AND (
                   reported_event_count<>1 OR carried_event_count<>0 OR link_count<>0
                   OR space_property IS NULL OR reported_event_property IS NULL
                   OR space_property<>reported_event_property
                   OR (reported_event_property=(SELECT property_node FROM target)
                     AND reported_event_date IS DISTINCT FROM (SELECT business_date FROM target))))::bigint
                   AS unknown_discrepancy
            FROM discrepancy_evidence
        ),
        target_outbox AS MATERIALIZED (
          SELECT min(created_at) AS oldest_unpublished
            FROM public.outbox
           WHERE tenant_id=(SELECT tenant_id FROM target)
             AND property_node=(SELECT property_node FROM target)
             AND business_date=(SELECT business_date FROM target)
             AND published_at IS NULL AND created_at<=(SELECT captured_at FROM target)
        ),
        unsafe_outbox AS MATERIALIZED (
          SELECT count(*)::bigint AS unknown_outbox
            FROM public.outbox AS event
            LEFT JOIN public.org_node AS property ON property.tenant_id=event.tenant_id
              AND property.id=event.property_node AND property.kind='property'
           WHERE event.tenant_id=(SELECT tenant_id FROM target)
             AND event.business_date=(SELECT business_date FROM target) AND event.published_at IS NULL
             AND (event.property_node IS NULL OR property.id IS NULL OR
                  (event.property_node=(SELECT property_node FROM target)
                    AND event.created_at>(SELECT captured_at FROM target)))
        ),
        financial AS MATERIALIZED (
          SELECT 0::bigint AS financial_interface,
                 count(*)::bigint AS unknown_financial
            FROM public.payment_operation
            JOIN LATERAL (
              SELECT attempt.status
                FROM public.payment AS attempt
               WHERE attempt.tenant_id=payment_operation.tenant_id
                 AND attempt.operation_id=payment_operation.id
               ORDER BY attempt.attempt_no DESC, attempt.id DESC LIMIT 1
            ) AS head ON true
           WHERE payment_operation.tenant_id=(SELECT tenant_id FROM target)
             AND payment_operation.property_node=(SELECT property_node FROM target)
             AND head.status='pending'
        ),
        fiscal AS MATERIALIZED (
          SELECT count(*) FILTER (WHERE document.property_node=(SELECT property_node FROM target)
            AND document.business_date=(SELECT business_date FROM target))::bigint AS fiscal_interface,
                 count(*) FILTER (WHERE document.id IS NULL OR document.property_node IS NULL
                   OR document.business_date IS NULL OR property.id IS NULL)::bigint AS unknown_fiscal
            FROM public.fiscal_submission
            LEFT JOIN public.document ON document.tenant_id=fiscal_submission.tenant_id
              AND document.id=fiscal_submission.document_id
            LEFT JOIN public.org_node AS property ON property.tenant_id=document.tenant_id
              AND property.id=document.property_node AND property.kind='property'
           WHERE fiscal_submission.tenant_id=(SELECT tenant_id FROM target)
             AND fiscal_submission.status IN ('pending','submitted','rejected','error')
        ),
        statutory AS MATERIALIZED (
          SELECT 0::bigint AS statutory_interface,
                 count(*)::bigint AS unknown_statutory
            FROM public.statutory_submission
           WHERE tenant_id=(SELECT tenant_id FROM target)
             AND property_node=(SELECT property_node FROM target)
             AND status IN ('pending','submitted','failed')
        ),
        channel_work AS MATERIALIZED (
          SELECT 0::bigint AS channel_delivery,
            ((SELECT count(*) FROM public.inbound_message
               WHERE tenant_id=(SELECT tenant_id FROM target) AND status IN ('received','error'))
             + (SELECT count(*) FROM public.outbox
                 WHERE tenant_id=(SELECT tenant_id FROM target)
                   AND property_node=(SELECT property_node FROM target)
                   AND business_date=(SELECT business_date FROM target)
                   AND event_type='ari.push_requested' AND published_at IS NULL))::bigint AS unknown_channel
        )
        SELECT target.captured_at,
               due.due_in=0 AND due.due_out=0 AND cashiers.open_cashiers=0
               AND discrepancies.discrepancies=0 AND financial.financial_interface=0
               AND fiscal.fiscal_interface=0 AND statutory.statutory_interface=0
               AND channel_work.channel_delivery=0 AND due.unknown_due=0
               AND discrepancies.unknown_discrepancy=0 AND unsafe_outbox.unknown_outbox=0
               AND financial.unknown_financial=0 AND fiscal.unknown_fiscal=0
               AND statutory.unknown_statutory=0 AND channel_work.unknown_channel=0
               AND (target_outbox.oldest_unpublished IS NULL OR
                 target.captured_at-target_outbox.oldest_unpublished < interval '5 minutes')
          INTO v_sealed_at, v_ready
          FROM target CROSS JOIN due CROSS JOIN cashiers CROSS JOIN discrepancies
          CROSS JOIN target_outbox CROSS JOIN unsafe_outbox CROSS JOIN financial CROSS JOIN fiscal
          CROSS JOIN statutory CROSS JOIN channel_work;

  IF NOT FOUND OR v_ready IS DISTINCT FROM true OR v_sealed_at IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='55000', MESSAGE='business day is not ready to seal';
  END IF;

  UPDATE public.business_day AS day
     SET sealed_at=v_sealed_at, sealed_by=p_actor
   WHERE day.tenant_id=p_tenant
     AND day.property_node=p_property
     AND day.business_date=p_date
     AND day.sealed_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='55000', MESSAGE='business day seal latch lost';
  END IF;

  RETURN QUERY SELECT p_tenant,p_property,p_date,'open'::text,'sealed'::text,
                      v_sealed_at,p_actor;
END
$_$;


--
-- Name: transition_arrival_pickup_task(uuid, uuid, uuid, uuid, text, text, uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.transition_arrival_pickup_task(p_tenant uuid, p_property uuid, p_reservation uuid, p_task uuid, p_action text, p_expected_task_status text, p_expected_assignee_party uuid, p_staff_party uuid, p_actor uuid) RETURNS TABLE(task_id uuid, reservation_id uuid, previous_task_status text, task_status text, previous_assignee_party uuid, assignee_party uuid, task_completed_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'pg_temp'
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


--
-- Name: transition_folio_status(uuid, uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.transition_folio_status(p_tenant uuid, p_property uuid, p_folio uuid, p_action text) RETURNS TABLE(folio_id uuid, account_id uuid, reservation_id uuid, window_no smallint, previous_status text, status text, balance_minor bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'pg_temp'
    AS $$
DECLARE
  v_context_tenant uuid;
  v_account_id uuid;
  v_reservation_id uuid;
  v_window_no smallint;
  v_current_status text;
  v_expected_status text;
  v_next_status text;
  v_balance numeric;
  v_updated_id uuid;
BEGIN
  IF session_user <> 'yellow_runtime'
     OR pg_catalog.current_setting('role', true) IS DISTINCT FROM 'app_role'
     OR current_user <> 'yellow_owner' THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'folio transition requires the governed runtime app role';
  END IF;

  BEGIN
    v_context_tenant := NULLIF(
      pg_catalog.current_setting('app.tenant_id', true), ''
    )::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'folio transition tenant context is invalid';
  END;
  IF v_context_tenant IS NULL OR p_tenant IS NULL
     OR v_context_tenant <> p_tenant THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'folio transition tenant context is invalid';
  END IF;

  IF p_property IS NULL OR p_folio IS NULL
     OR p_action IS NULL OR p_action <> pg_catalog.btrim(p_action)
     OR p_action NOT IN ('settle', 'close') THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'folio transition input is invalid';
  END IF;

  IF p_action = 'settle' THEN
    v_expected_status := 'open';
    v_next_status := 'settled';
  ELSE
    v_expected_status := 'settled';
    v_next_status := 'closed';
  END IF;

  -- Discover only the structurally linked account, then acquire the same
  -- canonical lock order as every other financial command. Reacquiring locks
  -- already held by the service is harmless and keeps direct capability calls
  -- from inventing a second lock order.
  SELECT folio.account_id
    INTO v_account_id
    FROM public.folio AS folio
    JOIN public.account AS account
      ON account.tenant_id = folio.tenant_id
     AND account.id = folio.account_id
    JOIN public.org_node AS property
      ON property.tenant_id = account.tenant_id
     AND property.id = account.property_node
     AND property.kind = 'property'
     AND property.currency = account.currency
   WHERE folio.tenant_id = p_tenant
     AND folio.id = p_folio
     AND account.property_node = p_property
     AND account.role = 'guest';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'folio transition target is unavailable';
  END IF;

  PERFORM public.lock_financial_rows(
    p_tenant,
    ARRAY[v_account_id]::uuid[],
    p_folio
  );

  SELECT folio.account_id, folio.reservation_id, folio.window_no, folio.status
    INTO v_account_id, v_reservation_id, v_window_no, v_current_status
    FROM public.folio AS folio
    JOIN public.account AS account
      ON account.tenant_id = folio.tenant_id
     AND account.id = folio.account_id
    JOIN public.org_node AS property
      ON property.tenant_id = account.tenant_id
     AND property.id = account.property_node
     AND property.kind = 'property'
     AND property.currency = account.currency
   WHERE folio.tenant_id = p_tenant
     AND folio.id = p_folio
     AND account.property_node = p_property
     AND account.role = 'guest'
     AND account.status = 'open'
   FOR UPDATE OF folio, account;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'folio transition target is unavailable';
  END IF;
  IF v_current_status <> v_expected_status THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'folio transition state is invalid';
  END IF;

  SELECT balance.balance_minor
    INTO v_balance
    FROM public.folio_balance AS balance
   WHERE balance.tenant_id = p_tenant
     AND balance.folio_id = p_folio;
  v_balance := COALESCE(v_balance, 0::numeric);
  IF v_balance <> 0::numeric THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'folio transition requires a zero balance';
  END IF;

  UPDATE public.folio AS folio
     SET status = v_next_status
   WHERE folio.tenant_id = p_tenant
     AND folio.id = p_folio
     AND folio.account_id = v_account_id
     AND folio.status = v_expected_status
  RETURNING folio.id INTO v_updated_id;
  IF v_updated_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'folio transition state changed concurrently';
  END IF;

  RETURN QUERY
  SELECT v_updated_id, v_account_id, v_reservation_id, v_window_no,
         v_expected_status, v_next_status, 0::bigint;
END;
$$;


--
-- Name: transition_housekeeping_task(uuid, uuid, uuid, text, text, text, timestamp with time zone, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.transition_housekeeping_task(p_tenant uuid, p_property uuid, p_task uuid, p_action text, p_expected_task_status text, p_expected_room_condition text, p_expected_room_updated_at timestamp with time zone, p_actor uuid) RETURNS TABLE(task_id uuid, task_status text, space_id uuid, room_condition text, room_updated_at timestamp with time zone, task_completed_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'pg_temp'
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


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: account; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    property_node uuid,
    role text NOT NULL,
    party_id uuid,
    name text NOT NULL,
    currency character(3) NOT NULL,
    credit_limit_minor bigint,
    status text DEFAULT 'open'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT account_role_check CHECK ((role = ANY (ARRAY['guest'::text, 'company'::text, 'group_master'::text, 'house'::text, 'outlet'::text, 'event'::text, 'trust'::text, 'ar_control'::text, 'cash'::text, 'bank'::text, 'card_clearing'::text, 'upi_clearing'::text, 'revenue'::text, 'tax_payable'::text, 'deposit_liability'::text, 'payable'::text, 'fx'::text]))),
    CONSTRAINT account_status_check CHECK ((status = ANY (ARRAY['open'::text, 'frozen'::text, 'closed'::text])))
);


--
-- Name: address; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.address (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    party_id uuid NOT NULL,
    kind text DEFAULT 'home'::text NOT NULL,
    lines text[],
    city text,
    region text,
    postal_code text,
    country character(2) NOT NULL
);


--
-- Name: alert; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alert (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    subject_type text NOT NULL,
    subject_id uuid NOT NULL,
    code text,
    message text NOT NULL,
    show_on text DEFAULT 'always'::text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    CONSTRAINT alert_show_on_check CHECK ((show_on = ANY (ARRAY['checkin'::text, 'checkout'::text, 'always'::text])))
);


--
-- Name: api_client; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.api_client (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    scopes text[] DEFAULT '{}'::text[] NOT NULL,
    scope_node uuid,
    secret_hash text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: api_idempotency; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.api_idempotency (
    tenant_id uuid NOT NULL,
    operation text NOT NULL,
    key_hash character(64) NOT NULL,
    request_hash character(64) NOT NULL,
    response_status smallint,
    response_body jsonb,
    created_at timestamp with time zone NOT NULL,
    completed_at timestamp with time zone,
    expires_at timestamp with time zone NOT NULL,
    CONSTRAINT api_idempotency_check CHECK ((expires_at = (created_at + '24:00:00'::interval))),
    CONSTRAINT api_idempotency_check1 CHECK ((((completed_at IS NULL) AND (response_status IS NULL) AND (response_body IS NULL)) OR ((completed_at IS NOT NULL) AND (response_status IS NOT NULL) AND (response_body IS NOT NULL) AND (completed_at >= created_at) AND (completed_at <= expires_at)))),
    CONSTRAINT api_idempotency_key_hash_check CHECK ((key_hash ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT api_idempotency_operation_check CHECK ((operation ~ '^[a-z][a-z0-9_.-]{0,127}$'::text)),
    CONSTRAINT api_idempotency_request_hash_check CHECK ((request_hash ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT api_idempotency_response_status_check CHECK (((response_status >= 200) AND (response_status <= 299)))
);


--
-- Name: app_user; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_user (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    email text NOT NULL,
    display_name text NOT NULL,
    auth jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: approval_request; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.approval_request (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    kind text NOT NULL,
    subject_type text NOT NULL,
    subject_id uuid NOT NULL,
    requested_by uuid NOT NULL,
    payload jsonb NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    decided_by uuid,
    decided_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    valid_until timestamp with time zone,
    CONSTRAINT approval_request_buyer_override_validity_ck CHECK (((kind <> 'india_gst_legal_buyer_override'::text) OR ((valid_until IS NOT NULL) AND (valid_until > created_at)))),
    CONSTRAINT approval_request_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'expired'::text])))
);


--
-- Name: ar_allocation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ar_allocation (
    tenant_id uuid NOT NULL,
    invoice_doc uuid NOT NULL,
    payment_journal uuid NOT NULL,
    amount_minor bigint NOT NULL
);


--
-- Name: automation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.automation (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    scope_node uuid NOT NULL,
    name text NOT NULL,
    trigger_event text NOT NULL,
    condition jsonb DEFAULT '{}'::jsonb NOT NULL,
    action jsonb NOT NULL,
    priority integer DEFAULT 100 NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    effective tstzrange DEFAULT tstzrange(now(), NULL::timestamp with time zone) NOT NULL
);


--
-- Name: availability_projection; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.availability_projection (
    tenant_id uuid NOT NULL,
    property_node uuid NOT NULL,
    unit_type_id uuid NOT NULL,
    stay_date date NOT NULL,
    physical integer NOT NULL,
    sold integer NOT NULL,
    held integer NOT NULL,
    blocked integer NOT NULL,
    ooo integer NOT NULL,
    available integer GENERATED ALWAYS AS (((((physical - sold) - held) - blocked) - ooo)) STORED,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: block_allotment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.block_allotment (
    tenant_id uuid NOT NULL,
    group_id uuid NOT NULL,
    unit_type_id uuid NOT NULL,
    stay_date date NOT NULL,
    blocked integer NOT NULL,
    rate_override jsonb
);


--
-- Name: block_status_def; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.block_status_def (
    tenant_id uuid NOT NULL,
    code text NOT NULL,
    deducts boolean NOT NULL,
    sort integer DEFAULT 0 NOT NULL
);


--
-- Name: business_day; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.business_day (
    tenant_id uuid NOT NULL,
    property_node uuid NOT NULL,
    business_date date NOT NULL,
    opened_at timestamp with time zone DEFAULT now() NOT NULL,
    sealed_at timestamp with time zone,
    sealed_by uuid
);


--
-- Name: business_day_discrepancy_carry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.business_day_discrepancy_carry (
    tenant_id uuid NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_id uuid NOT NULL,
    property_node uuid NOT NULL,
    source_discrepancy_id uuid NOT NULL,
    target_discrepancy_id uuid NOT NULL,
    source_business_date date NOT NULL,
    target_business_date date NOT NULL,
    target_opened_at timestamp with time zone NOT NULL,
    space_id uuid NOT NULL,
    discrepancy_state_hash text NOT NULL,
    reason text NOT NULL,
    request_hash text NOT NULL,
    approval_request_id uuid NOT NULL,
    requested_by uuid NOT NULL,
    approved_by uuid NOT NULL,
    approval_requested_at timestamp with time zone NOT NULL,
    approval_decided_at timestamp with time zone NOT NULL,
    carried_at timestamp with time zone DEFAULT transaction_timestamp() NOT NULL,
    resolution text DEFAULT 'carried_forward'::text NOT NULL,
    CONSTRAINT business_day_discrepancy_carry_check CHECK ((approved_by <> requested_by)),
    CONSTRAINT business_day_discrepancy_carry_discrepancy_state_hash_check CHECK ((discrepancy_state_hash ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT business_day_discrepancy_carry_reason_check CHECK (((length(reason) >= 1) AND (length(reason) <= 500))),
    CONSTRAINT business_day_discrepancy_carry_request_hash_check CHECK ((request_hash ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT business_day_discrepancy_carry_resolution_check CHECK ((resolution = 'carried_forward'::text))
);

ALTER TABLE ONLY public.business_day_discrepancy_carry FORCE ROW LEVEL SECURITY;


--
-- Name: cash_drawer; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cash_drawer (
    tenant_id uuid NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    property_node uuid NOT NULL,
    account_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    currency character(3) NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT transaction_timestamp() NOT NULL,
    CONSTRAINT cash_drawer_code_ck CHECK ((((octet_length(code) >= 1) AND (octet_length(code) <= 64)) AND (code = btrim(code)) AND (code ~ '^[A-Z0-9][A-Z0-9._-]*$'::text))),
    CONSTRAINT cash_drawer_name_ck CHECK ((((octet_length(name) >= 1) AND (octet_length(name) <= 120)) AND (name = btrim(name)) AND (name !~ '[[:cntrl:]]'::text) AND (name !~ '[​-‍‪-‮⁠⁦-⁩﻿]'::text)))
);


--
-- Name: cash_drawer_denomination; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cash_drawer_denomination (
    tenant_id uuid NOT NULL,
    drawer_id uuid NOT NULL,
    unit_minor bigint NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT transaction_timestamp() NOT NULL,
    CONSTRAINT cash_drawer_denomination_unit_ck CHECK ((unit_minor > 0))
);


--
-- Name: cashier_count; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cashier_count (
    tenant_id uuid NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    drawer_id uuid NOT NULL,
    kind text NOT NULL,
    attempt_no integer NOT NULL,
    counted_by uuid NOT NULL,
    counted_at timestamp with time zone DEFAULT transaction_timestamp() NOT NULL,
    total_minor bigint NOT NULL,
    CONSTRAINT cashier_count_kind_attempt_ck CHECK ((((kind = 'opening'::text) AND (attempt_no = 0)) OR ((kind = 'closing'::text) AND (attempt_no > 0)))),
    CONSTRAINT cashier_count_total_ck CHECK ((total_minor >= 0))
);


--
-- Name: cashier_count_line; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cashier_count_line (
    tenant_id uuid NOT NULL,
    count_id uuid NOT NULL,
    session_id uuid NOT NULL,
    drawer_id uuid NOT NULL,
    denomination_minor bigint NOT NULL,
    quantity bigint NOT NULL,
    line_total_minor bigint NOT NULL,
    CONSTRAINT cashier_count_line_quantity_ck CHECK ((quantity >= 0)),
    CONSTRAINT cashier_count_line_total_ck CHECK (((line_total_minor >= 0) AND (line_total_minor = (denomination_minor * quantity))))
);


--
-- Name: cashier_session; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cashier_session (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    property_node uuid NOT NULL,
    user_id uuid NOT NULL,
    opened_at timestamp with time zone DEFAULT now() NOT NULL,
    closed_at timestamp with time zone,
    over_short_minor bigint,
    drawer_id uuid NOT NULL,
    business_date date NOT NULL,
    currency character(3) NOT NULL,
    opening_count_id uuid NOT NULL,
    closing_count_id uuid,
    expected_minor bigint NOT NULL,
    counted_minor bigint,
    closed_by uuid,
    close_reason text,
    approval_request_id uuid,
    supervised_close boolean DEFAULT false NOT NULL,
    CONSTRAINT cashier_session_close_evidence_ck CHECK ((((closed_at IS NULL) AND (closing_count_id IS NULL) AND (counted_minor IS NULL) AND (over_short_minor IS NULL) AND (closed_by IS NULL) AND (close_reason IS NULL) AND (approval_request_id IS NULL) AND (NOT supervised_close)) OR ((closed_at IS NOT NULL) AND (closing_count_id IS NOT NULL) AND (counted_minor IS NOT NULL) AND (over_short_minor IS NOT NULL) AND (closed_by IS NOT NULL) AND (over_short_minor = (counted_minor - expected_minor)) AND ((over_short_minor = 0) OR ((close_reason IS NOT NULL) AND (approval_request_id IS NOT NULL))) AND ((NOT supervised_close) OR ((closed_by <> user_id) AND (close_reason IS NOT NULL)))))),
    CONSTRAINT cashier_session_close_reason_ck CHECK (((close_reason IS NULL) OR (((octet_length(close_reason) >= 1) AND (octet_length(close_reason) <= 500)) AND (close_reason = btrim(close_reason)) AND (close_reason !~ '[[:cntrl:]]'::text) AND (close_reason !~ '[​-‍‪-‮⁠⁦-⁩﻿]'::text))))
);


--
-- Name: channel; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel (
    code text NOT NULL,
    name text NOT NULL,
    adapter_extension text
);


--
-- Name: channel_map; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel_map (
    tenant_id uuid NOT NULL,
    property_node uuid NOT NULL,
    channel_code text NOT NULL,
    kind text NOT NULL,
    internal_id uuid NOT NULL,
    external_code text NOT NULL,
    CONSTRAINT channel_map_kind_check CHECK ((kind = ANY (ARRAY['unit_type'::text, 'rate_plan'::text])))
);


--
-- Name: consent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.consent (
    tenant_id uuid NOT NULL,
    party_id uuid NOT NULL,
    purpose text NOT NULL,
    granted boolean NOT NULL,
    at timestamp with time zone DEFAULT now() NOT NULL,
    source text
);


--
-- Name: consumer_cursor; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.consumer_cursor (
    consumer text NOT NULL,
    last_seq bigint DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: consumer_processed; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.consumer_processed (
    consumer text NOT NULL,
    outbox_id uuid NOT NULL,
    processed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: contact_point; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contact_point (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    party_id uuid NOT NULL,
    kind text NOT NULL,
    value text NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    verified boolean DEFAULT false NOT NULL,
    CONSTRAINT contact_point_kind_check CHECK ((kind = ANY (ARRAY['email'::text, 'phone'::text, 'whatsapp'::text])))
);


--
-- Name: rate_price; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rate_price (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    rate_plan_id uuid NOT NULL,
    unit_type_id uuid NOT NULL,
    stay_dates daterange NOT NULL,
    dow_mask smallint DEFAULT 127 NOT NULL,
    pricing jsonb NOT NULL,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    superseded_by uuid
);


--
-- Name: current_rate_price; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.current_rate_price WITH (security_invoker='true') AS
 SELECT DISTINCT ON (tenant_id, rate_plan_id, unit_type_id, stay_dates, dow_mask) id,
    tenant_id,
    rate_plan_id,
    unit_type_id,
    stay_dates,
    dow_mask,
    pricing,
    recorded_at,
    superseded_by
   FROM public.rate_price
  WHERE (superseded_by IS NULL)
  ORDER BY tenant_id, rate_plan_id, unit_type_id, stay_dates, dow_mask, recorded_at DESC;


--
-- Name: deposit_application; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.deposit_application (
    tenant_id uuid NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    property_node uuid NOT NULL,
    hosted_request_id uuid NOT NULL,
    operation_id uuid NOT NULL,
    capture_payment_id uuid NOT NULL,
    capture_phase text DEFAULT 'capture'::text NOT NULL,
    capture_status text DEFAULT 'succeeded'::text NOT NULL,
    folio_id uuid NOT NULL,
    deposit_account_id uuid NOT NULL,
    guest_account_id uuid NOT NULL,
    amount_minor bigint NOT NULL,
    currency character(3) NOT NULL,
    journal_id uuid NOT NULL,
    key_hash character(64) NOT NULL,
    request_hash character(64) NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT transaction_timestamp() NOT NULL,
    CONSTRAINT deposit_application_amount_ck CHECK ((amount_minor > 0)),
    CONSTRAINT deposit_application_capture_kind_ck CHECK (((capture_phase = 'capture'::text) AND (capture_status = 'succeeded'::text))),
    CONSTRAINT deposit_application_hashes_ck CHECK (((key_hash ~ '^[0-9a-f]{64}$'::text) AND (request_hash ~ '^[0-9a-f]{64}$'::text)))
);


--
-- Name: discrepancy; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.discrepancy (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    space_id uuid NOT NULL,
    reported text NOT NULL,
    system_state text NOT NULL,
    reported_by uuid,
    reported_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved_at timestamp with time zone,
    resolution text
);


--
-- Name: document; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    property_node uuid,
    kind text NOT NULL,
    series_id uuid,
    doc_no text,
    status text DEFAULT 'draft'::text NOT NULL,
    subject_type text,
    subject_id uuid,
    content jsonb NOT NULL,
    rendered_ref text,
    sha256 text,
    prev_hash text,
    issued_at timestamp with time zone,
    business_date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT document_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'issued'::text, 'cleared'::text, 'rejected'::text, 'void'::text])))
);


--
-- Name: document_series; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_series (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    property_node uuid NOT NULL,
    kind text NOT NULL,
    prefix text NOT NULL,
    next_no bigint DEFAULT 1 NOT NULL,
    fiscal boolean DEFAULT false NOT NULL,
    last_doc_hash text
);


--
-- Name: erasure_request; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.erasure_request (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    party_id uuid NOT NULL,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    resolved_at timestamp with time zone,
    note text,
    CONSTRAINT erasure_request_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'anonymised'::text, 'rejected'::text])))
);


--
-- Name: extension; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.extension (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    type text NOT NULL,
    key text NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    effective tstzrange DEFAULT tstzrange(now(), NULL::timestamp with time zone) NOT NULL,
    content jsonb NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT extension_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'retired'::text])))
);


--
-- Name: extension_type; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.extension_type (
    type text NOT NULL,
    json_schema jsonb NOT NULL
);


--
-- Name: fact_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fact_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    fact_type text NOT NULL,
    valid_from timestamp with time zone NOT NULL,
    valid_to timestamp with time zone,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    business_date date NOT NULL,
    actor_id uuid,
    payload jsonb NOT NULL,
    supersedes uuid
);


--
-- Name: fiscal_submission; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fiscal_submission (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    document_id uuid NOT NULL,
    provider_key text NOT NULL,
    mode text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    authority_ref text,
    qr_payload text,
    response jsonb,
    submitted_at timestamp with time zone,
    resolved_at timestamp with time zone,
    CONSTRAINT fiscal_submission_mode_check CHECK ((mode = ANY (ARRAY['clearance'::text, 'reporting'::text, 'peppol'::text, 'exchange'::text]))),
    CONSTRAINT fiscal_submission_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'submitted'::text, 'cleared'::text, 'accepted'::text, 'rejected'::text, 'error'::text])))
);


--
-- Name: folio; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.folio (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    account_id uuid NOT NULL,
    reservation_id uuid,
    folio_no text,
    window_no smallint DEFAULT 1 NOT NULL,
    name text,
    status text DEFAULT 'open'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT folio_status_check CHECK ((status = ANY (ARRAY['open'::text, 'settled'::text, 'closed'::text])))
);


--
-- Name: posting_line; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.posting_line (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    journal_id uuid NOT NULL,
    seq smallint NOT NULL,
    account_id uuid NOT NULL,
    folio_id uuid,
    tx_code text NOT NULL,
    description text,
    amount_minor bigint NOT NULL,
    quantity numeric(10,3) DEFAULT 1 NOT NULL,
    tax_detail jsonb,
    business_date date NOT NULL,
    currency character(3) NOT NULL,
    folio_transfer_root_line_id uuid,
    CONSTRAINT posting_line_transfer_root_not_self_ck CHECK (((folio_transfer_root_line_id IS NULL) OR (folio_transfer_root_line_id <> id))),
    CONSTRAINT posting_line_transfer_shape_ck CHECK (((folio_transfer_root_line_id IS NULL) OR ((folio_id IS NOT NULL) AND (amount_minor <> 0) AND (tax_detail IS NULL))))
);


--
-- Name: folio_balance; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.folio_balance WITH (security_invoker='true') AS
 SELECT tenant_id,
    folio_id,
    sum(amount_minor) AS balance_minor,
    count(*) AS lines
   FROM public.posting_line
  WHERE (folio_id IS NOT NULL)
  GROUP BY tenant_id, folio_id;


--
-- Name: hold; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hold (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    property_node uuid NOT NULL,
    sellable_unit_id uuid NOT NULL,
    period tstzrange NOT NULL,
    kind text NOT NULL,
    holder jsonb DEFAULT '{}'::jsonb NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    CONSTRAINT hold_kind_check CHECK ((kind = ANY (ARRAY['cart'::text, 'offline_lease'::text, 'manual'::text]))),
    CONSTRAINT hold_status_check CHECK ((status = ANY (ARRAY['active'::text, 'consumed'::text, 'expired'::text, 'released'::text])))
);


--
-- Name: hosted_payment_request; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hosted_payment_request (
    tenant_id uuid NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    property_node uuid NOT NULL,
    folio_id uuid NOT NULL,
    guest_account_id uuid NOT NULL,
    operation_id uuid NOT NULL,
    deposit_account_id uuid NOT NULL,
    operation_purpose text DEFAULT 'deposit'::text NOT NULL,
    amount_minor bigint NOT NULL,
    currency character(3) NOT NULL,
    bearer_hash character(64) NOT NULL,
    key_hash character(64) NOT NULL,
    request_hash character(64) NOT NULL,
    generation integer NOT NULL,
    created_by uuid NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT transaction_timestamp() NOT NULL,
    CONSTRAINT hosted_payment_request_amount_ck CHECK ((amount_minor > 0)),
    CONSTRAINT hosted_payment_request_expiry_ck CHECK ((expires_at > created_at)),
    CONSTRAINT hosted_payment_request_generation_ck CHECK ((generation > 0)),
    CONSTRAINT hosted_payment_request_hash_ck CHECK ((bearer_hash ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT hosted_payment_request_key_hash_ck CHECK ((key_hash ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT hosted_payment_request_purpose_ck CHECK ((operation_purpose = 'deposit'::text)),
    CONSTRAINT hosted_payment_request_request_hash_ck CHECK ((request_hash ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT hosted_payment_request_revocation_ck CHECK (((revoked_at IS NULL) OR (revoked_at >= created_at)))
);


--
-- Name: identity_document; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.identity_document (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    party_id uuid NOT NULL,
    kind text NOT NULL,
    number_enc text NOT NULL,
    issuing_country character(2),
    expiry date,
    scan_ref text
);


--
-- Name: inbound_message; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inbound_message (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    channel_code text NOT NULL,
    external_id text NOT NULL,
    payload jsonb NOT NULL,
    received_at timestamp with time zone DEFAULT now() NOT NULL,
    status text DEFAULT 'received'::text NOT NULL,
    error text,
    processed_at timestamp with time zone,
    CONSTRAINT inbound_message_status_check CHECK ((status = ANY (ARRAY['received'::text, 'processed'::text, 'error'::text, 'ignored'::text])))
);


--
-- Name: india_gst_accommodation_final_component_tax; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.india_gst_accommodation_final_component_tax (
    tenant_id uuid NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    property_node uuid NOT NULL,
    reservation_id uuid NOT NULL,
    folio_id uuid NOT NULL,
    applicability_id uuid NOT NULL,
    valuation_id uuid NOT NULL,
    valuation_generation integer NOT NULL,
    request_id uuid NOT NULL,
    generation integer NOT NULL,
    currency character(3) NOT NULL,
    transaction_value_minor bigint NOT NULL,
    tax_minor bigint NOT NULL,
    grand_total_minor bigint NOT NULL,
    component_family text NOT NULL,
    selected_version_side text NOT NULL,
    selected_extension_id uuid NOT NULL,
    selected_extension_version smallint NOT NULL,
    final_valuation_evidence_hash text NOT NULL,
    quoted_rate_applicability_evidence_hash text NOT NULL,
    section14_evidence_hash text NOT NULL,
    levy_component_identity_evidence_hash text NOT NULL,
    reservation_lineage_evidence_hash text NOT NULL,
    attribution_snapshot_evidence_hash text NOT NULL,
    evidence_hash text NOT NULL,
    supersedes_tax_id uuid,
    supersedes_tax_evidence_hash text,
    actor_id uuid NOT NULL,
    recorded_at timestamp with time zone DEFAULT transaction_timestamp() NOT NULL,
    CONSTRAINT india_gst_accommodation_fina_attribution_snapshot_evidenc_check CHECK ((attribution_snapshot_evidence_hash ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT india_gst_accommodation_fina_final_valuation_evidence_has_check CHECK ((final_valuation_evidence_hash ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT india_gst_accommodation_fina_levy_component_identity_evid_check CHECK ((levy_component_identity_evidence_hash ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT india_gst_accommodation_fina_quoted_rate_applicability_ev_check CHECK ((quoted_rate_applicability_evidence_hash ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT india_gst_accommodation_fina_reservation_lineage_evidence_check CHECK ((reservation_lineage_evidence_hash ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT india_gst_accommodation_fina_supersedes_tax_evidence_hash_check CHECK (((supersedes_tax_evidence_hash IS NULL) OR (supersedes_tax_evidence_hash ~ '^[0-9a-f]{64}$'::text))),
    CONSTRAINT india_gst_accommodation_final__selected_extension_version_check CHECK ((selected_extension_version = ANY (ARRAY[1, 2]))),
    CONSTRAINT india_gst_accommodation_final_com_section14_evidence_hash_check CHECK ((section14_evidence_hash ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT india_gst_accommodation_final_com_transaction_value_minor_check CHECK ((transaction_value_minor > 0)),
    CONSTRAINT india_gst_accommodation_final_compo_selected_version_side_check CHECK ((selected_version_side = ANY (ARRAY['predecessor'::text, 'successor'::text]))),
    CONSTRAINT india_gst_accommodation_final_compon_valuation_generation_check CHECK ((valuation_generation >= 0)),
    CONSTRAINT india_gst_accommodation_final_component__component_family_check CHECK ((component_family = ANY (ARRAY['igst'::text, 'cgst_sgst'::text, 'cgst_utgst'::text]))),
    CONSTRAINT india_gst_accommodation_final_component_grand_total_minor_check CHECK ((grand_total_minor > 0)),
    CONSTRAINT india_gst_accommodation_final_component_tax_check CHECK (((grand_total_minor)::numeric = ((transaction_value_minor)::numeric + (tax_minor)::numeric))),
    CONSTRAINT india_gst_accommodation_final_component_tax_check1 CHECK ((((generation = 0) AND (supersedes_tax_id IS NULL) AND (supersedes_tax_evidence_hash IS NULL)) OR ((generation > 0) AND (supersedes_tax_id IS NOT NULL) AND (supersedes_tax_evidence_hash IS NOT NULL)))),
    CONSTRAINT india_gst_accommodation_final_component_tax_currency_check CHECK ((currency = 'INR'::bpchar)),
    CONSTRAINT india_gst_accommodation_final_component_tax_evidence_hash_check CHECK ((evidence_hash ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT india_gst_accommodation_final_component_tax_generation_check CHECK ((generation >= 0)),
    CONSTRAINT india_gst_accommodation_final_component_tax_tax_minor_check CHECK ((tax_minor >= 0))
);

ALTER TABLE ONLY public.india_gst_accommodation_final_component_tax FORCE ROW LEVEL SECURITY;


--
-- Name: india_gst_accommodation_final_component_tax_component; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.india_gst_accommodation_final_component_tax_component (
    tenant_id uuid NOT NULL,
    tax_id uuid NOT NULL,
    room_night_ordinal integer NOT NULL,
    component_ordinal smallint NOT NULL,
    component_identity text NOT NULL,
    rate_basis_points integer NOT NULL,
    tax_amount_minor bigint NOT NULL,
    currency character(3) NOT NULL,
    CONSTRAINT india_gst_accommodation_final_componen_component_identity_check CHECK ((component_identity = ANY (ARRAY['igst'::text, 'cgst'::text, 'sgst'::text, 'utgst'::text]))),
    CONSTRAINT india_gst_accommodation_final_componen_room_night_ordinal_check CHECK (((room_night_ordinal >= 0) AND (room_night_ordinal <= 365))),
    CONSTRAINT india_gst_accommodation_final_component__tax_amount_minor_check CHECK ((tax_amount_minor >= 0)),
    CONSTRAINT india_gst_accommodation_final_component_component_ordinal_check CHECK (((component_ordinal >= 0) AND (component_ordinal <= 1))),
    CONSTRAINT india_gst_accommodation_final_component_rate_basis_points_check CHECK ((rate_basis_points = ANY (ARRAY[250, 500, 600, 900, 1200, 1800]))),
    CONSTRAINT india_gst_accommodation_final_component_tax_comp_currency_check CHECK ((currency = 'INR'::bpchar))
);

ALTER TABLE ONLY public.india_gst_accommodation_final_component_tax_component FORCE ROW LEVEL SECURITY;


--
-- Name: india_gst_accommodation_final_component_tax_room_night; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.india_gst_accommodation_final_component_tax_room_night (
    tenant_id uuid NOT NULL,
    tax_id uuid NOT NULL,
    ordinal integer NOT NULL,
    business_date date NOT NULL,
    final_value_minor bigint NOT NULL,
    currency character(3) NOT NULL,
    slab_upto_minor bigint,
    aggregate_rate_basis_points integer NOT NULL,
    itc_eligible boolean NOT NULL,
    tax_minor bigint NOT NULL,
    CONSTRAINT india_gst_accommodation_final_aggregate_rate_basis_points_check CHECK ((aggregate_rate_basis_points = ANY (ARRAY[500, 1200, 1800]))),
    CONSTRAINT india_gst_accommodation_final_component_final_value_minor_check CHECK ((final_value_minor > 0)),
    CONSTRAINT india_gst_accommodation_final_component_t_slab_upto_minor_check CHECK (((slab_upto_minor IS NULL) OR (slab_upto_minor = 750000))),
    CONSTRAINT india_gst_accommodation_final_component_tax_roo_tax_minor_check CHECK ((tax_minor >= 0)),
    CONSTRAINT india_gst_accommodation_final_component_tax_room__ordinal_check CHECK (((ordinal >= 0) AND (ordinal <= 365))),
    CONSTRAINT india_gst_accommodation_final_component_tax_room_currency_check CHECK ((currency = 'INR'::bpchar))
);

ALTER TABLE ONLY public.india_gst_accommodation_final_component_tax_room_night FORCE ROW LEVEL SECURITY;


--
-- Name: india_gst_accommodation_final_valuation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.india_gst_accommodation_final_valuation (
    tenant_id uuid NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    property_node uuid NOT NULL,
    reservation_id uuid NOT NULL,
    folio_id uuid NOT NULL,
    folio_account_id uuid NOT NULL,
    window_no smallint NOT NULL,
    buyer_party_id uuid NOT NULL,
    attribution_id uuid NOT NULL,
    request_id uuid NOT NULL,
    generation integer NOT NULL,
    disposition text NOT NULL,
    currency character(3) NOT NULL,
    transaction_value_minor bigint,
    source_set_hash text NOT NULL,
    order341_evidence_hash text NOT NULL,
    request_hash text NOT NULL,
    evidence_hash text NOT NULL,
    ordinary_evidence_hashes text[] DEFAULT '{}'::text[] NOT NULL,
    manual_reasons text[] DEFAULT '{}'::text[] NOT NULL,
    relationship_conclusion text,
    consideration_conclusion text,
    section15_2_conclusion text,
    section15_3_conclusion text,
    source_completeness_conclusion text,
    attestation_evidence_source text,
    attestation_evidence_reference text,
    relationship_set_hash text NOT NULL,
    attested_by uuid NOT NULL,
    attested_at timestamp with time zone DEFAULT transaction_timestamp() NOT NULL,
    approval_request_id uuid,
    supersedes_valuation_id uuid,
    actor_id uuid NOT NULL,
    recorded_at timestamp with time zone DEFAULT transaction_timestamp() NOT NULL,
    CONSTRAINT india_gst_accommodation_final_valu_order341_evidence_hash_check CHECK ((order341_evidence_hash ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT india_gst_accommodation_final_valua_relationship_set_hash_check CHECK ((relationship_set_hash ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT india_gst_accommodation_final_valuation_currency_check CHECK ((currency = 'INR'::bpchar)),
    CONSTRAINT india_gst_accommodation_final_valuation_disposition_check CHECK ((disposition = ANY (ARRAY['ordinary_final'::text, 'manual_valuation_required'::text]))),
    CONSTRAINT india_gst_accommodation_final_valuation_evidence_hash_check CHECK ((evidence_hash ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT india_gst_accommodation_final_valuation_generation_check CHECK ((generation >= 0)),
    CONSTRAINT india_gst_accommodation_final_valuation_request_hash_check CHECK ((request_hash ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT india_gst_accommodation_final_valuation_source_set_hash_check CHECK ((source_set_hash ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT india_gst_accommodation_final_valuation_window_no_check CHECK ((window_no > 0)),
    CONSTRAINT india_gst_final_valuation_shape_ck CHECK (((((generation = 0) AND (supersedes_valuation_id IS NULL)) OR ((generation > 0) AND (supersedes_valuation_id IS NOT NULL))) AND (((disposition = 'ordinary_final'::text) AND (transaction_value_minor IS NOT NULL) AND (cardinality(ordinary_evidence_hashes) = 5) AND (cardinality(manual_reasons) = 0) AND (relationship_conclusion = 'unrelated_not_distinct'::text) AND (consideration_conclusion = 'money_only'::text) AND (section15_2_conclusion = 'all_additions_enumerated'::text) AND (section15_3_conclusion = 'all_discounts_eligible'::text) AND (source_completeness_conclusion = 'all_sources_classified'::text) AND (attestation_evidence_source IS NOT NULL) AND (attestation_evidence_reference IS NOT NULL)) OR ((disposition = 'manual_valuation_required'::text) AND (transaction_value_minor IS NULL) AND (cardinality(manual_reasons) > 0) AND (relationship_conclusion IS NULL) AND (consideration_conclusion IS NULL) AND (section15_2_conclusion IS NULL) AND (section15_3_conclusion IS NULL) AND (source_completeness_conclusion IS NULL) AND (attestation_evidence_source IS NULL) AND (attestation_evidence_reference IS NULL))) AND (NOT (ordinary_evidence_hashes && manual_reasons)) AND (manual_reasons <@ ARRAY['related_person'::text, 'distinct_person'::text, 'non_money_consideration'::text, 'pure_agent'::text, 'special_supply_rules_27_35'::text, 'tax_inclusive'::text, 'omitted_section15_2_addition'::text, 'ineligible_section15_3_discount'::text, 'indeterminable_section15_3_discount'::text, 'incomplete_source_classification'::text, 'other_indeterminable_governed_evidence'::text]) AND ((attestation_evidence_source IS NULL) OR (attestation_evidence_source ~ '^[a-z][a-z0-9_.:-]{2,63}$'::text))))
);

ALTER TABLE ONLY public.india_gst_accommodation_final_valuation FORCE ROW LEVEL SECURITY;


--
-- Name: india_gst_accommodation_invoice_issue_snapshot; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.india_gst_accommodation_invoice_issue_snapshot (
    tenant_id uuid NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    service_provision_snapshot_id uuid NOT NULL,
    currency character(3) NOT NULL,
    amount_minor bigint NOT NULL,
    coverage_scope text NOT NULL,
    invoice_series text NOT NULL,
    invoice_serial text NOT NULL,
    invoice_issue_date date NOT NULL,
    invoice_issue_source text NOT NULL,
    invoice_issue_evidence_sha256 text NOT NULL,
    legal_rule text NOT NULL,
    CONSTRAINT india_gst_accommodation_invoice_issue_amount_ck CHECK ((amount_minor > 0)),
    CONSTRAINT india_gst_accommodation_invoice_issue_coverage_ck CHECK ((coverage_scope = 'full_attribution'::text)),
    CONSTRAINT india_gst_accommodation_invoice_issue_currency_ck CHECK ((currency ~ '^[A-Z]{3}$'::text)),
    CONSTRAINT india_gst_accommodation_invoice_issue_date_ck CHECK (isfinite(invoice_issue_date)),
    CONSTRAINT india_gst_accommodation_invoice_issue_evidence_ck CHECK ((invoice_issue_evidence_sha256 ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT india_gst_accommodation_invoice_issue_legal_rule_ck CHECK ((legal_rule = 'CGST_ACT_13_2_INVOICE_DATE_INPUT_ONLY'::text)),
    CONSTRAINT india_gst_accommodation_invoice_issue_serial_ck CHECK (((char_length(invoice_serial) >= 1) AND (char_length(invoice_serial) <= 64))),
    CONSTRAINT india_gst_accommodation_invoice_issue_series_ck CHECK (((char_length(invoice_series) >= 1) AND (char_length(invoice_series) <= 64))),
    CONSTRAINT india_gst_accommodation_invoice_issue_source_ck CHECK ((invoice_issue_source = 'governed_supplier_tax_invoice_record'::text))
);

ALTER TABLE ONLY public.india_gst_accommodation_invoice_issue_snapshot FORCE ROW LEVEL SECURITY;


--
-- Name: india_gst_accommodation_payment_receipt_snapshot; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.india_gst_accommodation_payment_receipt_snapshot (
    tenant_id uuid NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    service_provision_snapshot_id uuid NOT NULL,
    currency character(3) NOT NULL,
    amount_minor bigint NOT NULL,
    coverage_scope text NOT NULL,
    supplier_books_entry_date date NOT NULL,
    supplier_bank_credit_date date NOT NULL,
    payment_receipt_date date NOT NULL,
    payment_receipt_source text NOT NULL,
    payment_receipt_evidence_sha256 text NOT NULL,
    legal_rule text NOT NULL,
    CONSTRAINT india_gst_accommodation_payment_receipt_amount_ck CHECK ((amount_minor > 0)),
    CONSTRAINT india_gst_accommodation_payment_receipt_bank_date_ck CHECK (isfinite(supplier_bank_credit_date)),
    CONSTRAINT india_gst_accommodation_payment_receipt_books_date_ck CHECK (isfinite(supplier_books_entry_date)),
    CONSTRAINT india_gst_accommodation_payment_receipt_coverage_ck CHECK ((coverage_scope = 'full_attribution'::text)),
    CONSTRAINT india_gst_accommodation_payment_receipt_currency_ck CHECK ((currency ~ '^[A-Z]{3}$'::text)),
    CONSTRAINT india_gst_accommodation_payment_receipt_date_ck CHECK ((isfinite(payment_receipt_date) AND (payment_receipt_date = LEAST(supplier_books_entry_date, supplier_bank_credit_date)))),
    CONSTRAINT india_gst_accommodation_payment_receipt_evidence_ck CHECK ((payment_receipt_evidence_sha256 ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT india_gst_accommodation_payment_receipt_legal_rule_ck CHECK ((legal_rule = 'CGST_ACT_13_2_EXPLANATION_II_PAYMENT_RECEIPT_DATE_INPUT_ONLY'::text)),
    CONSTRAINT india_gst_accommodation_payment_receipt_source_ck CHECK ((payment_receipt_source = 'governed_supplier_payment_receipt_record'::text))
);

ALTER TABLE ONLY public.india_gst_accommodation_payment_receipt_snapshot FORCE ROW LEVEL SECURITY;


--
-- Name: india_gst_accommodation_quoted_rate_applicability; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.india_gst_accommodation_quoted_rate_applicability (
    tenant_id uuid NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    property_node uuid NOT NULL,
    reservation_id uuid NOT NULL,
    folio_id uuid NOT NULL,
    reservation_lineage_id uuid NOT NULL,
    attribution_id uuid NOT NULL,
    service_provision_snapshot_id uuid NOT NULL,
    payment_receipt_snapshot_id uuid NOT NULL,
    invoice_issue_snapshot_id uuid NOT NULL,
    family_jurisdiction_extension_id uuid NOT NULL,
    classification_id uuid NOT NULL,
    supplier_service_location_id uuid NOT NULL,
    supplier_sez_status_id uuid NOT NULL,
    recipient_sez_status_id uuid NOT NULL,
    recipient_party_id uuid NOT NULL,
    final_valuation_id uuid NOT NULL,
    request_id uuid NOT NULL,
    section14_case text NOT NULL,
    service_provision_date date NOT NULL,
    invoice_issue_date date NOT NULL,
    payment_receipt_date date NOT NULL,
    rate_change_date date NOT NULL,
    time_of_supply_date date NOT NULL,
    selected_version_side text NOT NULL,
    selected_extension_id uuid NOT NULL,
    selected_extension_version smallint NOT NULL,
    selected_extension_status text NOT NULL,
    selected_content_hash text NOT NULL,
    selected_effective_from timestamp with time zone NOT NULL,
    selected_effective_to timestamp with time zone,
    component_family text NOT NULL,
    section14_evidence_hash text NOT NULL,
    levy_component_identity_evidence_hash text NOT NULL,
    reservation_lineage_evidence_hash text NOT NULL,
    attribution_snapshot_evidence_hash text NOT NULL,
    evidence_hash text NOT NULL,
    calendar_authority_id text,
    calendar_source_digest_sha256 text,
    calendar_through_date date,
    calendar_dates date[] DEFAULT '{}'::date[] NOT NULL,
    calendar_states text[] DEFAULT '{}'::text[] NOT NULL,
    actor_id uuid NOT NULL,
    recorded_at timestamp with time zone DEFAULT transaction_timestamp() NOT NULL,
    CONSTRAINT india_gst_accommodation_quot_attribution_snapshot_evidenc_check CHECK ((attribution_snapshot_evidence_hash ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT india_gst_accommodation_quot_calendar_source_digest_sha25_check CHECK (((calendar_source_digest_sha256 IS NULL) OR (calendar_source_digest_sha256 ~ '^[0-9a-f]{64}$'::text))),
    CONSTRAINT india_gst_accommodation_quot_levy_component_identity_evid_check CHECK ((levy_component_identity_evidence_hash ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT india_gst_accommodation_quot_reservation_lineage_evidence_check CHECK ((reservation_lineage_evidence_hash ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT india_gst_accommodation_quoted__selected_extension_status_check CHECK ((selected_extension_status = ANY (ARRAY['retired'::text, 'active'::text]))),
    CONSTRAINT india_gst_accommodation_quoted_ra_section14_evidence_hash_check CHECK ((section14_evidence_hash ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT india_gst_accommodation_quoted_rate_appl_component_family_check CHECK ((component_family = ANY (ARRAY['igst'::text, 'cgst_sgst'::text, 'cgst_utgst'::text]))),
    CONSTRAINT india_gst_accommodation_quoted_rate_appl_rate_change_date_check CHECK ((rate_change_date = '2025-09-22'::date)),
    CONSTRAINT india_gst_accommodation_quoted_rate_applic_section14_case_check CHECK ((section14_case = ANY (ARRAY['supply_before_invoice_after_payment_after'::text, 'supply_invoice_before_payment_after'::text, 'supply_payment_before_invoice_after'::text, 'supply_after_invoice_before_payment_after'::text, 'supply_after_invoice_payment_before'::text, 'supply_invoice_after_payment_before'::text]))),
    CONSTRAINT india_gst_accommodation_quoted_rate_applica_evidence_hash_check CHECK ((evidence_hash ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT india_gst_accommodation_quoted_rate_applicability_check CHECK ((((calendar_authority_id IS NULL) AND (calendar_source_digest_sha256 IS NULL) AND (calendar_through_date IS NULL) AND (cardinality(calendar_dates) = 0) AND (cardinality(calendar_states) = 0)) OR ((calendar_authority_id IS NOT NULL) AND (calendar_source_digest_sha256 IS NOT NULL) AND (calendar_through_date IS NOT NULL) AND ((cardinality(calendar_dates) >= 4) AND (cardinality(calendar_dates) <= 366)) AND (cardinality(calendar_states) = cardinality(calendar_dates))))),
    CONSTRAINT india_gst_accommodation_quoted_rate_calendar_authority_id_check CHECK (((calendar_authority_id IS NULL) OR (calendar_authority_id ~ '^[A-Z][A-Z0-9_.:-]{2,127}$'::text))),
    CONSTRAINT india_gst_accommodation_quoted_rate_selected_content_hash_check CHECK ((selected_content_hash ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT india_gst_accommodation_quoted_rate_selected_version_side_check CHECK ((selected_version_side = ANY (ARRAY['predecessor'::text, 'successor'::text]))),
    CONSTRAINT india_gst_accommodation_quoted_selected_extension_version_check CHECK ((selected_extension_version = ANY (ARRAY[1, 2])))
);

ALTER TABLE ONLY public.india_gst_accommodation_quoted_rate_applicability FORCE ROW LEVEL SECURITY;


--
-- Name: india_gst_accommodation_quoted_rate_applicability_room_night; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.india_gst_accommodation_quoted_rate_applicability_room_night (
    tenant_id uuid NOT NULL,
    applicability_id uuid NOT NULL,
    ordinal integer NOT NULL,
    business_date date NOT NULL,
    quoted_amount_minor bigint NOT NULL,
    currency character(3) NOT NULL,
    slab_upto_minor bigint,
    aggregate_rate_basis_points integer NOT NULL,
    itc_eligible boolean NOT NULL,
    CONSTRAINT india_gst_accommodation_quote_aggregate_rate_basis_points_check CHECK ((aggregate_rate_basis_points = ANY (ARRAY[500, 1200, 1800]))),
    CONSTRAINT india_gst_accommodation_quoted_rate_a_quoted_amount_minor_check CHECK ((quoted_amount_minor > 0)),
    CONSTRAINT india_gst_accommodation_quoted_rate_appli_slab_upto_minor_check CHECK (((slab_upto_minor IS NULL) OR (slab_upto_minor = 750000))),
    CONSTRAINT india_gst_accommodation_quoted_rate_applicabilit_currency_check CHECK ((currency = 'INR'::bpchar)),
    CONSTRAINT india_gst_accommodation_quoted_rate_applicability_ordinal_check CHECK (((ordinal >= 0) AND (ordinal <= 365)))
);

ALTER TABLE ONLY public.india_gst_accommodation_quoted_rate_applicability_room_night FORCE ROW LEVEL SECURITY;


--
-- Name: india_gst_accommodation_quoted_rate_component; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.india_gst_accommodation_quoted_rate_component (
    tenant_id uuid NOT NULL,
    applicability_id uuid NOT NULL,
    room_night_ordinal integer NOT NULL,
    component_ordinal smallint NOT NULL,
    component_identity text NOT NULL,
    rate_basis_points integer NOT NULL,
    CONSTRAINT india_gst_accommodation_quoted_rate_co_component_identity_check CHECK ((component_identity = ANY (ARRAY['igst'::text, 'cgst'::text, 'sgst'::text, 'utgst'::text]))),
    CONSTRAINT india_gst_accommodation_quoted_rate_com_component_ordinal_check CHECK (((component_ordinal >= 0) AND (component_ordinal <= 1))),
    CONSTRAINT india_gst_accommodation_quoted_rate_com_rate_basis_points_check CHECK ((rate_basis_points = ANY (ARRAY[250, 500, 600, 900, 1200, 1800])))
);

ALTER TABLE ONLY public.india_gst_accommodation_quoted_rate_component FORCE ROW LEVEL SECURITY;


--
-- Name: india_gst_accommodation_service_provision_snapshot; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.india_gst_accommodation_service_provision_snapshot (
    tenant_id uuid NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    property_node uuid NOT NULL,
    reservation_lineage_id uuid NOT NULL,
    hold_binding_id uuid NOT NULL,
    attribution_id uuid NOT NULL,
    reservation_id uuid NOT NULL,
    segment_id uuid NOT NULL,
    origin_quote_hash text NOT NULL,
    snapshot_hash text NOT NULL,
    currency character(3) NOT NULL,
    service_provision_date date NOT NULL,
    service_provision_source text NOT NULL,
    service_provision_evidence_sha256 text NOT NULL,
    legal_rule text NOT NULL,
    CONSTRAINT india_gst_accommodation_service_provision_currency_ck CHECK ((currency ~ '^[A-Z]{3}$'::text)),
    CONSTRAINT india_gst_accommodation_service_provision_date_ck CHECK (isfinite(service_provision_date)),
    CONSTRAINT india_gst_accommodation_service_provision_evidence_ck CHECK ((service_provision_evidence_sha256 ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT india_gst_accommodation_service_provision_legal_rule_ck CHECK ((legal_rule = 'CGST_ACT_13_2_B_SERVICE_PROVISION_DATE_INPUT_ONLY'::text)),
    CONSTRAINT india_gst_accommodation_service_provision_quote_hash_ck CHECK ((origin_quote_hash ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT india_gst_accommodation_service_provision_snapshot_hash_ck CHECK ((snapshot_hash ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT india_gst_accommodation_service_provision_source_ck CHECK ((service_provision_source = 'governed_service_provision_record'::text))
);

ALTER TABLE ONLY public.india_gst_accommodation_service_provision_snapshot FORCE ROW LEVEL SECURITY;


--
-- Name: india_gst_accommodation_valuation_allocation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.india_gst_accommodation_valuation_allocation (
    tenant_id uuid NOT NULL,
    valuation_id uuid NOT NULL,
    posting_root_id uuid NOT NULL,
    ordinal integer NOT NULL,
    amount_minor bigint NOT NULL,
    currency character(3) NOT NULL,
    CONSTRAINT india_gst_accommodation_valuation_allocation_amount_minor_check CHECK ((amount_minor <> 0)),
    CONSTRAINT india_gst_accommodation_valuation_allocation_currency_check CHECK ((currency = 'INR'::bpchar))
);

ALTER TABLE ONLY public.india_gst_accommodation_valuation_allocation FORCE ROW LEVEL SECURITY;


--
-- Name: india_gst_accommodation_valuation_room_night; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.india_gst_accommodation_valuation_room_night (
    tenant_id uuid NOT NULL,
    valuation_id uuid NOT NULL,
    ordinal integer NOT NULL,
    business_date date NOT NULL,
    quoted_weight_minor bigint NOT NULL,
    transaction_value_minor bigint,
    currency character(3) NOT NULL,
    CONSTRAINT india_gst_accommodation_valuation_roo_quoted_weight_minor_check CHECK ((quoted_weight_minor > 0)),
    CONSTRAINT india_gst_accommodation_valuation_room_night_currency_check CHECK ((currency = 'INR'::bpchar)),
    CONSTRAINT india_gst_accommodation_valuation_room_night_ordinal_check CHECK (((ordinal >= 0) AND (ordinal <= 365)))
);

ALTER TABLE ONLY public.india_gst_accommodation_valuation_room_night FORCE ROW LEVEL SECURITY;


--
-- Name: india_gst_accommodation_valuation_source; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.india_gst_accommodation_valuation_source (
    tenant_id uuid NOT NULL,
    valuation_id uuid NOT NULL,
    posting_root_id uuid NOT NULL,
    source_kind text NOT NULL,
    current_amount_minor bigint NOT NULL,
    currency character(3) NOT NULL,
    tx_code text NOT NULL,
    current_fragment_set_hash text NOT NULL,
    classification_evidence_hash text NOT NULL,
    eligibility_evidence_hash text,
    addition_subtype text,
    discount_eligibility text,
    evidence_source text NOT NULL,
    evidence_reference text NOT NULL,
    attested_by uuid NOT NULL,
    attested_at timestamp with time zone DEFAULT transaction_timestamp() NOT NULL,
    CONSTRAINT india_gst_accommodation_valu_classification_evidence_hash_check CHECK ((classification_evidence_hash ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT india_gst_accommodation_valuati_current_fragment_set_hash_check CHECK ((current_fragment_set_hash ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT india_gst_accommodation_valuati_eligibility_evidence_hash_check CHECK (((eligibility_evidence_hash IS NULL) OR (eligibility_evidence_hash ~ '^[0-9a-f]{64}$'::text))),
    CONSTRAINT india_gst_accommodation_valuation_so_current_amount_minor_check CHECK ((current_amount_minor <> 0)),
    CONSTRAINT india_gst_accommodation_valuation_sour_evidence_reference_check CHECK (((length(evidence_reference) >= 1) AND (length(evidence_reference) <= 200))),
    CONSTRAINT india_gst_accommodation_valuation_source_check CHECK (((source_kind = 'section15_2_addition'::text) = (addition_subtype = ANY (ARRAY['tax_duty_cess_fee_charge_excluding_gst'::text, 'supplier_liability_paid_by_recipient'::text, 'incidental_expense'::text, 'interest_late_fee_penalty'::text, 'non_government_price_linked_subsidy'::text])))),
    CONSTRAINT india_gst_accommodation_valuation_source_check1 CHECK (((source_kind = 'section15_3_discount'::text) = (discount_eligibility = ANY (ARRAY['eligible_pre_supply_recorded'::text, 'eligible_post_supply_linked_itc_reversed'::text, 'ineligible'::text, 'indeterminable'::text])))),
    CONSTRAINT india_gst_accommodation_valuation_source_currency_check CHECK ((currency = 'INR'::bpchar)),
    CONSTRAINT india_gst_accommodation_valuation_source_evidence_source_check CHECK ((evidence_source ~ '^[a-z][a-z0-9_.:-]{2,63}$'::text)),
    CONSTRAINT india_gst_accommodation_valuation_source_source_kind_check CHECK ((source_kind = ANY (ARRAY['room_consideration'::text, 'package_consideration'::text, 'promotion_discount'::text, 'fee_consideration'::text, 'section15_2_addition'::text, 'section15_3_discount'::text])))
);

ALTER TABLE ONLY public.india_gst_accommodation_valuation_source FORCE ROW LEVEL SECURITY;


--
-- Name: india_gst_item_classification; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.india_gst_item_classification (
    tenant_id uuid NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    property_node uuid NOT NULL,
    jurisdiction_extension_id uuid NOT NULL,
    jurisdiction_owner_tenant_id uuid,
    jurisdiction_key text NOT NULL,
    jurisdiction_version integer NOT NULL,
    jurisdiction_content_hash text NOT NULL,
    country_code character(2) NOT NULL,
    line_id text NOT NULL,
    revenue_group text NOT NULL,
    classification_system text NOT NULL,
    classification_code text NOT NULL,
    is_service_code character(1) NOT NULL,
    CONSTRAINT india_gst_item_classification_code_ck CHECK ((classification_code = ANY (ARRAY['996311'::text, '996312'::text, '996313'::text, '996321'::text, '996322'::text, '996329'::text]))),
    CONSTRAINT india_gst_item_classification_country_ck CHECK ((country_code = 'IN'::character(2))),
    CONSTRAINT india_gst_item_classification_jurisdiction_hash_ck CHECK ((jurisdiction_content_hash ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT india_gst_item_classification_jurisdiction_key_ck CHECK ((jurisdiction_key ~ '^[a-z0-9][a-z0-9_.:-]{0,127}$'::text)),
    CONSTRAINT india_gst_item_classification_jurisdiction_owner_ck CHECK (((jurisdiction_owner_tenant_id IS NULL) OR (jurisdiction_owner_tenant_id = tenant_id))),
    CONSTRAINT india_gst_item_classification_jurisdiction_version_ck CHECK ((jurisdiction_version > 0)),
    CONSTRAINT india_gst_item_classification_line_ck CHECK ((line_id = 'room'::text)),
    CONSTRAINT india_gst_item_classification_revenue_group_ck CHECK ((revenue_group = 'room_revenue'::text)),
    CONSTRAINT india_gst_item_classification_service_ck CHECK ((is_service_code = 'Y'::character(1))),
    CONSTRAINT india_gst_item_classification_system_ck CHECK ((classification_system = 'SAC'::text))
);

ALTER TABLE ONLY public.india_gst_item_classification FORCE ROW LEVEL SECURITY;


--
-- Name: india_gst_recipient_sez_status; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.india_gst_recipient_sez_status (
    tenant_id uuid NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    recipient_registration_id uuid NOT NULL,
    recipient_registration_evidence_hash text NOT NULL,
    status_as_of date NOT NULL,
    gst_registration_status text NOT NULL,
    gst_taxpayer_type text NOT NULL,
    gst_status_source text NOT NULL,
    gst_status_evidence_sha256 text NOT NULL,
    approval_form text,
    approval_reference text,
    approval_validity daterange,
    approval_status text,
    approval_evidence_sha256 text,
    legal_rule text NOT NULL,
    CONSTRAINT india_gst_recipient_sez_status_approval_shape_ck CHECK ((((gst_taxpayer_type = 'regular'::text) AND (approval_form IS NULL) AND (approval_reference IS NULL) AND (approval_validity IS NULL) AND (approval_status IS NULL) AND (approval_evidence_sha256 IS NULL)) OR ((gst_taxpayer_type = 'sez_unit'::text) AND (approval_form = 'sez_rules_form_g'::text) AND (approval_reference IS NOT NULL) AND ((char_length(approval_reference) >= 1) AND (char_length(approval_reference) <= 128)) AND (btrim(approval_reference) = approval_reference) AND (approval_reference !~ '[[:cntrl:]]'::text) AND (approval_validity IS NOT NULL) AND (NOT isempty(approval_validity)) AND (NOT lower_inf(approval_validity)) AND (NOT upper_inf(approval_validity)) AND lower_inc(approval_validity) AND (NOT upper_inc(approval_validity)) AND (approval_validity @> status_as_of) AND (approval_status = 'in_force'::text) AND (approval_evidence_sha256 ~ '^[0-9a-f]{64}$'::text)) OR ((gst_taxpayer_type = 'sez_developer'::text) AND (approval_form = ANY (ARRAY['sez_rules_form_b'::text, 'sez_rules_form_c'::text])) AND (approval_reference IS NOT NULL) AND ((char_length(approval_reference) >= 1) AND (char_length(approval_reference) <= 128)) AND (btrim(approval_reference) = approval_reference) AND (approval_reference !~ '[[:cntrl:]]'::text) AND (approval_validity IS NOT NULL) AND (NOT isempty(approval_validity)) AND (NOT lower_inf(approval_validity)) AND (NOT upper_inf(approval_validity)) AND lower_inc(approval_validity) AND (NOT upper_inc(approval_validity)) AND (approval_validity @> status_as_of) AND (approval_status = 'in_force'::text) AND (approval_evidence_sha256 ~ '^[0-9a-f]{64}$'::text)))),
    CONSTRAINT india_gst_recipient_sez_status_legal_rule_ck CHECK ((legal_rule = 'IGST_ACT_7_5_B_AND_8_2_RECIPIENT_STATUS'::text)),
    CONSTRAINT india_gst_recipient_sez_status_recipient_hash_ck CHECK ((recipient_registration_evidence_hash ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT india_gst_recipient_sez_status_registration_status_ck CHECK ((gst_registration_status = 'active'::text)),
    CONSTRAINT india_gst_recipient_sez_status_source_ck CHECK ((gst_status_source = 'gst_common_portal'::text)),
    CONSTRAINT india_gst_recipient_sez_status_status_hash_ck CHECK ((gst_status_evidence_sha256 ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT india_gst_recipient_sez_status_taxpayer_type_ck CHECK ((gst_taxpayer_type = ANY (ARRAY['regular'::text, 'sez_unit'::text, 'sez_developer'::text])))
);

ALTER TABLE ONLY public.india_gst_recipient_sez_status FORCE ROW LEVEL SECURITY;


--
-- Name: india_gst_supplier_registration_status_snapshot; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.india_gst_supplier_registration_status_snapshot (
    tenant_id uuid NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    supplier_registration_id uuid NOT NULL,
    supplier_registration_evidence_hash text NOT NULL,
    status_as_of date NOT NULL,
    gst_registration_status text NOT NULL,
    gst_taxpayer_type text NOT NULL,
    gst_status_source text NOT NULL,
    gst_status_evidence_sha256 text NOT NULL,
    legal_rule text NOT NULL,
    CONSTRAINT india_gst_supplier_registration_status_snapshot_legal_rule_ck CHECK ((legal_rule = 'CGST_ACT_25_29_30_AND_RULE_21A_REGISTRATION_STATUS'::text)),
    CONSTRAINT india_gst_supplier_registration_status_snapshot_source_ck CHECK ((gst_status_source = 'gst_common_portal'::text)),
    CONSTRAINT india_gst_supplier_registration_status_snapshot_status_ck CHECK ((gst_registration_status = 'active'::text)),
    CONSTRAINT india_gst_supplier_status_snapshot_portal_evidence_ck CHECK ((gst_status_evidence_sha256 ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT india_gst_supplier_status_snapshot_supplier_evidence_ck CHECK ((supplier_registration_evidence_hash ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT india_gst_supplier_status_snapshot_taxpayer_type_ck CHECK ((gst_taxpayer_type = ANY (ARRAY['regular'::text, 'sez_unit'::text, 'sez_developer'::text])))
);

ALTER TABLE ONLY public.india_gst_supplier_registration_status_snapshot FORCE ROW LEVEL SECURITY;


--
-- Name: india_gst_supplier_service_location; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.india_gst_supplier_service_location (
    tenant_id uuid NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    supplier_registration_id uuid NOT NULL,
    supplier_evidence_hash text NOT NULL,
    service_scope text NOT NULL,
    registered_place_kind text NOT NULL,
    location_basis text NOT NULL,
    legal_rule text NOT NULL,
    CONSTRAINT india_gst_supplier_service_location_basis_ck CHECK ((location_basis = 'supply_made_from_registered_place_of_business'::text)),
    CONSTRAINT india_gst_supplier_service_location_legal_rule_ck CHECK ((legal_rule = 'IGST_ACT_2_15_A'::text)),
    CONSTRAINT india_gst_supplier_service_location_registered_place_ck CHECK ((registered_place_kind = ANY (ARRAY['principal_place_of_business'::text, 'additional_place_of_business'::text]))),
    CONSTRAINT india_gst_supplier_service_location_scope_ck CHECK ((service_scope = 'lodging_accommodation'::text)),
    CONSTRAINT india_gst_supplier_service_location_supplier_hash_ck CHECK ((supplier_evidence_hash ~ '^[0-9a-f]{64}$'::text))
);

ALTER TABLE ONLY public.india_gst_supplier_service_location FORCE ROW LEVEL SECURITY;


--
-- Name: india_gst_supplier_sez_status; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.india_gst_supplier_sez_status (
    tenant_id uuid NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    supplier_registration_id uuid NOT NULL,
    supplier_registration_evidence_hash text NOT NULL,
    status_as_of date NOT NULL,
    gst_registration_status text NOT NULL,
    gst_taxpayer_type text NOT NULL,
    gst_status_source text NOT NULL,
    gst_status_evidence_sha256 text NOT NULL,
    approval_form text,
    approval_reference text,
    approval_validity daterange,
    approval_status text,
    approval_evidence_sha256 text,
    legal_rule text NOT NULL,
    CONSTRAINT india_gst_supplier_sez_status_approval_shape_ck CHECK ((((gst_taxpayer_type = 'regular'::text) AND (approval_form IS NULL) AND (approval_reference IS NULL) AND (approval_validity IS NULL) AND (approval_status IS NULL) AND (approval_evidence_sha256 IS NULL)) OR ((gst_taxpayer_type = 'sez_unit'::text) AND (approval_form = 'sez_rules_form_g'::text) AND (approval_reference IS NOT NULL) AND ((char_length(approval_reference) >= 1) AND (char_length(approval_reference) <= 128)) AND (btrim(approval_reference) = approval_reference) AND (approval_reference !~ '[[:cntrl:]]'::text) AND (approval_validity IS NOT NULL) AND (NOT isempty(approval_validity)) AND (NOT lower_inf(approval_validity)) AND (NOT upper_inf(approval_validity)) AND lower_inc(approval_validity) AND (NOT upper_inc(approval_validity)) AND (approval_validity @> status_as_of) AND (approval_status = 'in_force'::text) AND (approval_evidence_sha256 ~ '^[0-9a-f]{64}$'::text)) OR ((gst_taxpayer_type = 'sez_developer'::text) AND (approval_form = ANY (ARRAY['sez_rules_form_b'::text, 'sez_rules_form_c'::text])) AND (approval_reference IS NOT NULL) AND ((char_length(approval_reference) >= 1) AND (char_length(approval_reference) <= 128)) AND (btrim(approval_reference) = approval_reference) AND (approval_reference !~ '[[:cntrl:]]'::text) AND (approval_validity IS NOT NULL) AND (NOT isempty(approval_validity)) AND (NOT lower_inf(approval_validity)) AND (NOT upper_inf(approval_validity)) AND lower_inc(approval_validity) AND (NOT upper_inc(approval_validity)) AND (approval_validity @> status_as_of) AND (approval_status = 'in_force'::text) AND (approval_evidence_sha256 ~ '^[0-9a-f]{64}$'::text)))),
    CONSTRAINT india_gst_supplier_sez_status_legal_rule_ck CHECK ((legal_rule = 'IGST_ACT_7_5_B_AND_8_2_SUPPLIER_STATUS'::text)),
    CONSTRAINT india_gst_supplier_sez_status_registration_status_ck CHECK ((gst_registration_status = 'active'::text)),
    CONSTRAINT india_gst_supplier_sez_status_source_ck CHECK ((gst_status_source = 'gst_common_portal'::text)),
    CONSTRAINT india_gst_supplier_sez_status_status_hash_ck CHECK ((gst_status_evidence_sha256 ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT india_gst_supplier_sez_status_supplier_hash_ck CHECK ((supplier_registration_evidence_hash ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT india_gst_supplier_sez_status_taxpayer_type_ck CHECK ((gst_taxpayer_type = ANY (ARRAY['regular'::text, 'sez_unit'::text, 'sez_developer'::text])))
);

ALTER TABLE ONLY public.india_gst_supplier_sez_status FORCE ROW LEVEL SECURITY;


--
-- Name: india_sez_unit_loa_renewal; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.india_sez_unit_loa_renewal (
    tenant_id uuid NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    supplier_sez_status_id uuid NOT NULL,
    original_loa_reference text NOT NULL,
    original_loa_issue_date date NOT NULL,
    original_loa_evidence_sha256 text NOT NULL,
    form_f2_file_number text NOT NULL,
    form_f2_issue_date date NOT NULL,
    renewal_validity daterange NOT NULL,
    renewal_status_as_of date NOT NULL,
    renewal_status text NOT NULL,
    renewal_status_source text NOT NULL,
    renewal_status_evidence_sha256 text NOT NULL,
    form_f2_evidence_sha256 text NOT NULL,
    legal_rule text NOT NULL,
    CONSTRAINT india_sez_unit_loa_renewal_file_number_ck CHECK ((((char_length(form_f2_file_number) >= 1) AND (char_length(form_f2_file_number) <= 128)) AND (btrim(form_f2_file_number) = form_f2_file_number) AND (form_f2_file_number IS NFC NORMALIZED) AND (form_f2_file_number !~ '[[:cntrl:]]'::text))),
    CONSTRAINT india_sez_unit_loa_renewal_form_hash_ck CHECK ((form_f2_evidence_sha256 ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT india_sez_unit_loa_renewal_issue_chronology_ck CHECK (((original_loa_issue_date <= form_f2_issue_date) AND (form_f2_issue_date <= renewal_status_as_of))),
    CONSTRAINT india_sez_unit_loa_renewal_legal_rule_ck CHECK ((legal_rule = 'SEZ_RULES_19_6_AND_19_6A_3_FORM_F2_CONTINUITY'::text)),
    CONSTRAINT india_sez_unit_loa_renewal_original_hash_ck CHECK ((original_loa_evidence_sha256 ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT india_sez_unit_loa_renewal_original_reference_ck CHECK ((((char_length(original_loa_reference) >= 1) AND (char_length(original_loa_reference) <= 128)) AND (btrim(original_loa_reference) = original_loa_reference) AND (original_loa_reference IS NFC NORMALIZED) AND (original_loa_reference !~ '[[:cntrl:]]'::text))),
    CONSTRAINT india_sez_unit_loa_renewal_source_ck CHECK ((renewal_status_source = 'development_commissioner_record'::text)),
    CONSTRAINT india_sez_unit_loa_renewal_status_ck CHECK ((renewal_status = 'in_force'::text)),
    CONSTRAINT india_sez_unit_loa_renewal_status_hash_ck CHECK ((renewal_status_evidence_sha256 ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT india_sez_unit_loa_renewal_validity_ck CHECK (((NOT isempty(renewal_validity)) AND (NOT lower_inf(renewal_validity)) AND (NOT upper_inf(renewal_validity)) AND lower_inc(renewal_validity) AND (NOT upper_inc(renewal_validity)) AND (renewal_validity @> renewal_status_as_of)))
);

ALTER TABLE ONLY public.india_sez_unit_loa_renewal FORCE ROW LEVEL SECURITY;


--
-- Name: inventory_authority; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_authority (
    tenant_id uuid NOT NULL,
    property_node uuid NOT NULL,
    channel_code text DEFAULT '*'::text NOT NULL,
    mode text NOT NULL,
    CONSTRAINT inventory_authority_mode_check CHECK ((mode = ANY (ARRAY['pms'::text, 'crs'::text])))
);


--
-- Name: journal; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.journal (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    property_node uuid NOT NULL,
    business_date date NOT NULL,
    kind text NOT NULL,
    description text NOT NULL,
    currency character(3) NOT NULL,
    reverses uuid,
    source jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    approval_request_id uuid,
    CONSTRAINT journal_kind_check CHECK ((kind = ANY (ARRAY['charge'::text, 'payment'::text, 'refund'::text, 'adjustment'::text, 'transfer'::text, 'correction'::text, 'deposit'::text, 'paidout'::text, 'close'::text, 'fx'::text])))
);


--
-- Name: membership; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.membership (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    party_id uuid NOT NULL,
    program text NOT NULL,
    number text NOT NULL,
    tier text,
    points bigint DEFAULT 0 NOT NULL
);


--
-- Name: message; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.message (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    thread_key text NOT NULL,
    direction text NOT NULL,
    channel text NOT NULL,
    party_id uuid,
    reservation_id uuid,
    body text NOT NULL,
    meta jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT message_direction_check CHECK ((direction = ANY (ARRAY['in'::text, 'out'::text])))
);


--
-- Name: negotiated_rate; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.negotiated_rate (
    tenant_id uuid NOT NULL,
    party_id uuid NOT NULL,
    rate_plan_id uuid NOT NULL,
    effective daterange NOT NULL
);


--
-- Name: ooo_oos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ooo_oos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    space_id uuid NOT NULL,
    kind text NOT NULL,
    period tstzrange NOT NULL,
    reason text,
    work_order_task uuid,
    CONSTRAINT ooo_oos_kind_check CHECK ((kind = ANY (ARRAY['ooo'::text, 'oos'::text])))
);


--
-- Name: org_node; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.org_node (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    path public.ltree NOT NULL,
    kind text NOT NULL,
    name text NOT NULL,
    timezone text,
    currency character(3),
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT org_node_kind_check CHECK ((kind = ANY (ARRAY['group'::text, 'brand'::text, 'region'::text, 'property'::text, 'outlet'::text]))),
    CONSTRAINT property_needs_tz CHECK (((kind <> 'property'::text) OR (timezone IS NOT NULL)))
);


--
-- Name: outbox; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.outbox (
    seq bigint NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    property_node uuid,
    business_date date NOT NULL,
    aggregate_type text NOT NULL,
    aggregate_id uuid NOT NULL,
    event_type text NOT NULL,
    event_version integer DEFAULT 1 NOT NULL,
    actor_id uuid,
    correlation_id uuid NOT NULL,
    causation_id uuid,
    payload jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    published_at timestamp with time zone
)
WITH (autovacuum_vacuum_scale_factor='0.01', autovacuum_vacuum_cost_delay='0');


--
-- Name: outbox_seq_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.outbox ALTER COLUMN seq ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.outbox_seq_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: overbooking_limit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.overbooking_limit (
    tenant_id uuid NOT NULL,
    property_node uuid NOT NULL,
    unit_type_id uuid NOT NULL,
    stay_dates daterange NOT NULL,
    extra integer NOT NULL
);


--
-- Name: package; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.package (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL
);


--
-- Name: package_element; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.package_element (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    package_id uuid NOT NULL,
    tx_code text NOT NULL,
    rhythm text NOT NULL,
    amount_minor bigint NOT NULL,
    currency character(3) NOT NULL,
    allowance boolean DEFAULT false NOT NULL,
    CONSTRAINT package_element_rhythm_check CHECK ((rhythm = ANY (ARRAY['per_stay'::text, 'per_night'::text, 'per_person'::text, 'per_person_night'::text])))
);


--
-- Name: party; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.party (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    kind text NOT NULL,
    display_name text NOT NULL,
    legal_name text,
    attrs jsonb DEFAULT '{}'::jsonb NOT NULL,
    vip_code text,
    status text DEFAULT 'active'::text NOT NULL,
    merged_into uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT party_kind_check CHECK ((kind = ANY (ARRAY['person'::text, 'org'::text]))),
    CONSTRAINT party_status_check CHECK ((status = ANY (ARRAY['active'::text, 'merged'::text, 'anonymised'::text])))
);


--
-- Name: party_fiscal_registration; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.party_fiscal_registration (
    tenant_id uuid NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    party_id uuid NOT NULL,
    scheme text NOT NULL,
    registration_number text NOT NULL,
    region_code text NOT NULL,
    legal_name text NOT NULL,
    trade_name text,
    address_line1 text NOT NULL,
    locality text NOT NULL,
    pin text NOT NULL,
    CONSTRAINT party_fiscal_registration_address_line1_ck CHECK ((((char_length(address_line1) >= 1) AND (char_length(address_line1) <= 100)) AND (btrim(address_line1) = address_line1))),
    CONSTRAINT party_fiscal_registration_legal_name_ck CHECK ((((char_length(legal_name) >= 1) AND (char_length(legal_name) <= 100)) AND (btrim(legal_name) = legal_name))),
    CONSTRAINT party_fiscal_registration_locality_ck CHECK ((((char_length(locality) >= 1) AND (char_length(locality) <= 50)) AND (btrim(locality) = locality))),
    CONSTRAINT party_fiscal_registration_pin_ck CHECK ((pin ~ '^[1-9][0-9]{5}$'::text)),
    CONSTRAINT party_fiscal_registration_region_ck CHECK ((region_code = ANY (ARRAY['01'::text, '02'::text, '03'::text, '04'::text, '05'::text, '06'::text, '07'::text, '08'::text, '09'::text, '10'::text, '11'::text, '12'::text, '13'::text, '14'::text, '15'::text, '16'::text, '17'::text, '18'::text, '19'::text, '20'::text, '21'::text, '22'::text, '23'::text, '24'::text, '26'::text, '27'::text, '29'::text, '30'::text, '31'::text, '32'::text, '33'::text, '34'::text, '35'::text, '36'::text, '37'::text, '38'::text]))),
    CONSTRAINT party_fiscal_registration_registration_ck CHECK ((registration_number ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'::text)),
    CONSTRAINT party_fiscal_registration_registration_region_ck CHECK ((substr(registration_number, 1, 2) = region_code)),
    CONSTRAINT party_fiscal_registration_scheme_ck CHECK ((scheme = 'in-gstin'::text)),
    CONSTRAINT party_fiscal_registration_trade_name_ck CHECK (((trade_name IS NULL) OR (((char_length(trade_name) >= 1) AND (char_length(trade_name) <= 100)) AND (btrim(trade_name) = trade_name))))
);


--
-- Name: party_relationship; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.party_relationship (
    tenant_id uuid NOT NULL,
    from_party uuid NOT NULL,
    to_party uuid NOT NULL,
    kind text NOT NULL
);


--
-- Name: party_role; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.party_role (
    tenant_id uuid NOT NULL,
    party_id uuid NOT NULL,
    role text NOT NULL,
    detail jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT party_role_role_check CHECK ((role = ANY (ARRAY['guest'::text, 'company'::text, 'agent'::text, 'source'::text, 'vendor'::text, 'owner'::text, 'staff'::text, 'contact'::text])))
);


--
-- Name: payment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    journal_id uuid,
    instrument_id uuid NOT NULL,
    psp text NOT NULL,
    psp_ref text,
    method text NOT NULL,
    phase text NOT NULL,
    amount_minor bigint NOT NULL,
    currency character(3) NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    operation_id uuid NOT NULL,
    predecessor_payment_id uuid,
    receipt_id uuid,
    capture_payment_id uuid,
    capture_journal_id uuid,
    attempt_no integer NOT NULL,
    result_code text NOT NULL,
    command_key_hash character(64) NOT NULL,
    request_hash character(64) NOT NULL,
    CONSTRAINT payment_amount_positive_ck CHECK ((amount_minor > 0)),
    CONSTRAINT payment_attempt_positive_ck CHECK ((attempt_no > 0)),
    CONSTRAINT payment_hashes_ck CHECK (((command_key_hash ~ '^[0-9a-f]{64}$'::text) AND (request_hash ~ '^[0-9a-f]{64}$'::text))),
    CONSTRAINT payment_journal_shape_ck CHECK ((((status = 'succeeded'::text) AND (phase = ANY (ARRAY['capture'::text, 'refund'::text])) AND (journal_id IS NOT NULL)) OR ((NOT ((status = 'succeeded'::text) AND (phase = ANY (ARRAY['capture'::text, 'refund'::text])))) AND (journal_id IS NULL)))),
    CONSTRAINT payment_phase_check CHECK ((phase = ANY (ARRAY['auth'::text, 'capture'::text, 'refund'::text, 'void'::text, 'incremental_auth'::text]))),
    CONSTRAINT payment_refund_lineage_ck CHECK ((((status = 'succeeded'::text) AND (phase = 'refund'::text) AND (capture_payment_id IS NOT NULL) AND (capture_journal_id IS NOT NULL)) OR ((NOT ((status = 'succeeded'::text) AND (phase = 'refund'::text))) AND (capture_payment_id IS NULL) AND (capture_journal_id IS NULL)))),
    CONSTRAINT payment_result_code_ck CHECK ((result_code ~ '^[a-z][a-z0-9._-]{0,63}$'::text)),
    CONSTRAINT payment_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'succeeded'::text, 'failed'::text])))
);


--
-- Name: payment_instrument; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_instrument (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    party_id uuid,
    kind text NOT NULL,
    token text,
    brand text,
    last4 character(4),
    expiry text,
    psp text,
    status text DEFAULT 'active'::text NOT NULL,
    CONSTRAINT payment_instrument_kind_check CHECK ((kind = ANY (ARRAY['card_network_token'::text, 'upi_vpa'::text, 'bank'::text, 'cash_marker'::text]))),
    CONSTRAINT payment_instrument_status_ck CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text, 'revoked'::text]))),
    CONSTRAINT payment_instrument_token_shape_ck CHECK (((token IS NULL) OR (((octet_length(token) >= 16) AND (octet_length(token) <= 512)) AND (token ~ '^[!-~]+$'::text) AND (token !~ '^[0-9]{12,19}$'::text))))
);


--
-- Name: payment_operation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_operation (
    tenant_id uuid NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    property_node uuid NOT NULL,
    folio_id uuid NOT NULL,
    guest_account_id uuid NOT NULL,
    instrument_id uuid NOT NULL,
    provider text NOT NULL,
    method text NOT NULL,
    currency character(3) NOT NULL,
    tx_code text NOT NULL,
    clearing_account_id uuid NOT NULL,
    purpose text DEFAULT 'folio_payment'::text NOT NULL,
    key_hash character(64) NOT NULL,
    request_hash character(64) NOT NULL,
    actor_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT transaction_timestamp() NOT NULL,
    deposit_account_id uuid,
    CONSTRAINT payment_operation_hashes_ck CHECK (((key_hash ~ '^[0-9a-f]{64}$'::text) AND (request_hash ~ '^[0-9a-f]{64}$'::text))),
    CONSTRAINT payment_operation_method_ck CHECK ((method = ANY (ARRAY['card'::text, 'upi'::text]))),
    CONSTRAINT payment_operation_provider_ck CHECK ((provider ~ '^[a-z][a-z0-9._-]{0,63}$'::text)),
    CONSTRAINT payment_operation_purpose_ck CHECK ((((purpose = 'folio_payment'::text) AND (deposit_account_id IS NULL)) OR ((purpose = 'deposit'::text) AND (deposit_account_id IS NOT NULL))))
);


--
-- Name: permission; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permission (
    code text NOT NULL,
    description text NOT NULL
);


--
-- Name: policy; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.policy (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    kind text NOT NULL,
    name text NOT NULL,
    content jsonb NOT NULL,
    CONSTRAINT policy_kind_check CHECK ((kind = ANY (ARRAY['cancellation'::text, 'guarantee'::text, 'deposit'::text, 'no_show'::text, 'early_departure'::text])))
);


--
-- Name: preference; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.preference (
    tenant_id uuid NOT NULL,
    party_id uuid NOT NULL,
    key text NOT NULL,
    value jsonb NOT NULL
);


--
-- Name: promotion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promotion (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    code text NOT NULL,
    discount jsonb NOT NULL,
    book_window tstzrange,
    stay_dates daterange,
    constraints jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: property_fiscal_location; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.property_fiscal_location (
    tenant_id uuid NOT NULL,
    property_node uuid NOT NULL,
    country_code character(2) NOT NULL,
    state_code text NOT NULL,
    address_line1 text NOT NULL,
    locality text NOT NULL,
    pin text NOT NULL,
    CONSTRAINT property_fiscal_location_address_line1_ck CHECK ((((char_length(address_line1) >= 1) AND (char_length(address_line1) <= 100)) AND (btrim(address_line1) = address_line1))),
    CONSTRAINT property_fiscal_location_country_ck CHECK ((country_code = 'IN'::character(2))),
    CONSTRAINT property_fiscal_location_locality_ck CHECK ((((char_length(locality) >= 1) AND (char_length(locality) <= 50)) AND (btrim(locality) = locality))),
    CONSTRAINT property_fiscal_location_pin_ck CHECK ((pin ~ '^[1-9][0-9]{5}$'::text)),
    CONSTRAINT property_fiscal_location_state_ck CHECK ((state_code = ANY (ARRAY['01'::text, '02'::text, '03'::text, '04'::text, '05'::text, '06'::text, '07'::text, '08'::text, '09'::text, '10'::text, '11'::text, '12'::text, '13'::text, '14'::text, '15'::text, '16'::text, '17'::text, '18'::text, '19'::text, '20'::text, '21'::text, '22'::text, '23'::text, '24'::text, '26'::text, '27'::text, '29'::text, '30'::text, '31'::text, '32'::text, '33'::text, '34'::text, '35'::text, '36'::text, '37'::text, '38'::text])))
);

ALTER TABLE ONLY public.property_fiscal_location FORCE ROW LEVEL SECURITY;


--
-- Name: property_fiscal_registration; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.property_fiscal_registration (
    tenant_id uuid NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    property_node uuid NOT NULL,
    scheme text NOT NULL,
    currency character(3) NOT NULL,
    jurisdiction_extension_id uuid NOT NULL,
    jurisdiction_owner_tenant_id uuid,
    jurisdiction_key text NOT NULL,
    jurisdiction_version integer NOT NULL,
    jurisdiction_content_hash text NOT NULL,
    registration_number text NOT NULL,
    region_code text NOT NULL,
    legal_name text NOT NULL,
    trade_name text,
    address_line text NOT NULL,
    locality text NOT NULL,
    postal_code text NOT NULL,
    CONSTRAINT property_fiscal_registration_address_line_ck CHECK ((((char_length(address_line) >= 1) AND (char_length(address_line) <= 300)) AND (btrim(address_line) = address_line))),
    CONSTRAINT property_fiscal_registration_currency_ck CHECK ((currency = 'INR'::bpchar)),
    CONSTRAINT property_fiscal_registration_jurisdiction_hash_ck CHECK ((jurisdiction_content_hash ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT property_fiscal_registration_jurisdiction_key_ck CHECK ((jurisdiction_key ~ '^[a-z0-9][a-z0-9_.:-]{0,127}$'::text)),
    CONSTRAINT property_fiscal_registration_jurisdiction_owner_ck CHECK (((jurisdiction_owner_tenant_id IS NULL) OR (jurisdiction_owner_tenant_id = tenant_id))),
    CONSTRAINT property_fiscal_registration_jurisdiction_version_ck CHECK ((jurisdiction_version > 0)),
    CONSTRAINT property_fiscal_registration_legal_name_ck CHECK ((((char_length(legal_name) >= 1) AND (char_length(legal_name) <= 200)) AND (btrim(legal_name) = legal_name))),
    CONSTRAINT property_fiscal_registration_locality_ck CHECK ((((char_length(locality) >= 1) AND (char_length(locality) <= 120)) AND (btrim(locality) = locality))),
    CONSTRAINT property_fiscal_registration_postal_code_ck CHECK ((postal_code ~ '^[1-9][0-9]{5}$'::text)),
    CONSTRAINT property_fiscal_registration_region_ck CHECK ((region_code = ANY (ARRAY['01'::text, '02'::text, '03'::text, '04'::text, '05'::text, '06'::text, '07'::text, '08'::text, '09'::text, '10'::text, '11'::text, '12'::text, '13'::text, '14'::text, '15'::text, '16'::text, '17'::text, '18'::text, '19'::text, '20'::text, '21'::text, '22'::text, '23'::text, '24'::text, '26'::text, '27'::text, '29'::text, '30'::text, '31'::text, '32'::text, '33'::text, '34'::text, '35'::text, '36'::text, '37'::text, '38'::text]))),
    CONSTRAINT property_fiscal_registration_registration_ck CHECK ((registration_number ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'::text)),
    CONSTRAINT property_fiscal_registration_registration_region_ck CHECK ((substr(registration_number, 1, 2) = region_code)),
    CONSTRAINT property_fiscal_registration_scheme_ck CHECK ((scheme = 'in-gstin'::text)),
    CONSTRAINT property_fiscal_registration_trade_name_ck CHECK (((trade_name IS NULL) OR (((char_length(trade_name) >= 1) AND (char_length(trade_name) <= 200)) AND (btrim(trade_name) = trade_name))))
);


--
-- Name: provider_event_receipt; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.provider_event_receipt (
    tenant_id uuid NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    operation_id uuid NOT NULL,
    provider text NOT NULL,
    event_id text NOT NULL,
    content_hash character(64) NOT NULL,
    provider_reference text NOT NULL,
    phase text NOT NULL,
    outcome text NOT NULL,
    amount_minor bigint NOT NULL,
    currency character(3) NOT NULL,
    received_at timestamp with time zone DEFAULT transaction_timestamp() NOT NULL,
    CONSTRAINT provider_event_receipt_amount_ck CHECK ((amount_minor > 0)),
    CONSTRAINT provider_event_receipt_content_hash_ck CHECK ((content_hash ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT provider_event_receipt_event_id_ck CHECK ((((octet_length(event_id) >= 8) AND (octet_length(event_id) <= 200)) AND (event_id ~ '^[!-~]+$'::text))),
    CONSTRAINT provider_event_receipt_outcome_ck CHECK ((outcome = ANY (ARRAY['approved'::text, 'declined'::text, 'indeterminate'::text]))),
    CONSTRAINT provider_event_receipt_phase_ck CHECK ((phase = ANY (ARRAY['auth'::text, 'incremental_auth'::text, 'capture'::text, 'void'::text, 'refund'::text]))),
    CONSTRAINT provider_event_receipt_provider_ck CHECK ((provider ~ '^[a-z][a-z0-9._-]{0,63}$'::text)),
    CONSTRAINT provider_event_receipt_provider_reference_ck CHECK ((((octet_length(provider_reference) >= 1) AND (octet_length(provider_reference) <= 200)) AND (provider_reference ~ '^[!-~]+$'::text)))
);


--
-- Name: push_cursor; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.push_cursor (
    tenant_id uuid NOT NULL,
    property_node uuid NOT NULL,
    channel_code text NOT NULL,
    last_outbox_seq bigint DEFAULT 0 NOT NULL
);


--
-- Name: queue_entry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.queue_entry (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    segment_id uuid NOT NULL,
    queued_at timestamp with time zone DEFAULT now() NOT NULL,
    priority integer DEFAULT 100 NOT NULL,
    cleared_at timestamp with time zone
);


--
-- Name: rate_plan; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rate_plan (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    property_node uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    currency character(3) NOT NULL,
    tax_inclusive boolean DEFAULT true NOT NULL,
    cancellation_policy uuid,
    guarantee_policy uuid,
    deposit_policy uuid,
    parent_plan uuid,
    derivation jsonb,
    market_code text,
    source_code text,
    status text DEFAULT 'active'::text NOT NULL
);


--
-- Name: rate_plan_package; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rate_plan_package (
    rate_plan_id uuid NOT NULL,
    package_id uuid NOT NULL,
    included_in_rate boolean DEFAULT true NOT NULL
);


--
-- Name: reservation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reservation (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    property_node uuid NOT NULL,
    confirmation_no text NOT NULL,
    status text DEFAULT 'reserved'::text NOT NULL,
    primary_party uuid NOT NULL,
    booker_party uuid,
    group_id uuid,
    channel_code text DEFAULT 'direct'::text NOT NULL,
    market_code text,
    source_code text,
    origin_code text,
    currency character(3) NOT NULL,
    guarantee_policy uuid,
    eta time with time zone,
    etd time with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    cancelled_at timestamp with time zone,
    cancel_reason text,
    cancellation_no text,
    CONSTRAINT reservation_status_check CHECK ((status = ANY (ARRAY['quote'::text, 'reserved'::text, 'waitlist'::text, 'due_in'::text, 'in_house'::text, 'due_out'::text, 'checked_out'::text, 'cancelled'::text, 'no_show'::text])))
);


--
-- Name: reservation_group; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reservation_group (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    property_node uuid NOT NULL,
    kind text NOT NULL,
    code text NOT NULL,
    name text,
    account_party uuid,
    status text DEFAULT 'tentative'::text NOT NULL,
    cutoff_date date,
    elastic boolean DEFAULT false NOT NULL,
    wash_schedule jsonb,
    master_folio uuid,
    CONSTRAINT reservation_group_kind_check CHECK ((kind = ANY (ARRAY['linked'::text, 'block'::text, 'share'::text])))
);


--
-- Name: reservation_guest; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reservation_guest (
    tenant_id uuid NOT NULL,
    reservation_id uuid NOT NULL,
    party_id uuid NOT NULL,
    role text DEFAULT 'accompanying'::text NOT NULL,
    share_pct numeric(5,2),
    CONSTRAINT reservation_guest_role_check CHECK ((role = ANY (ARRAY['primary'::text, 'accompanying'::text, 'sharer'::text])))
);


--
-- Name: reservation_segment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reservation_segment (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    reservation_id uuid NOT NULL,
    seq smallint NOT NULL,
    unit_type_id uuid NOT NULL,
    sellable_unit_id uuid,
    period tstzrange NOT NULL,
    adults smallint DEFAULT 1 NOT NULL,
    children jsonb DEFAULT '[]'::jsonb NOT NULL,
    rate_plan_id uuid NOT NULL,
    price_override jsonb,
    status text DEFAULT 'booked'::text NOT NULL,
    CONSTRAINT reservation_segment_status_check CHECK ((status = ANY (ARRAY['booked'::text, 'in_house'::text, 'departed'::text, 'cancelled'::text])))
);


--
-- Name: restriction; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.restriction (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    scope_node uuid NOT NULL,
    unit_type_id uuid,
    rate_plan_id uuid,
    channel_code text,
    kind text NOT NULL,
    value integer,
    stay_dates daterange NOT NULL,
    source text DEFAULT 'manual'::text NOT NULL,
    CONSTRAINT restriction_kind_check CHECK ((kind = ANY (ARRAY['closed'::text, 'cta'::text, 'ctd'::text, 'min_los'::text, 'max_los'::text, 'min_adv'::text, 'max_adv'::text])))
);


--
-- Name: role; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL
);


--
-- Name: role_permission; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_permission (
    role_id uuid NOT NULL,
    permission_code text NOT NULL
);


--
-- Name: schema_migration; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migration (
    version bigint NOT NULL,
    filename text NOT NULL,
    checksum_sha256 character(64) NOT NULL,
    applied_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    CONSTRAINT schema_migration_checksum_sha256_check CHECK ((checksum_sha256 ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT schema_migration_version_check CHECK (((version >= 1) AND (version <= 9999)))
);


--
-- Name: sellable_unit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sellable_unit (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    unit_type_id uuid NOT NULL,
    name text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL
);


--
-- Name: sellable_unit_space; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sellable_unit_space (
    tenant_id uuid NOT NULL,
    sellable_unit_id uuid NOT NULL,
    space_id uuid NOT NULL,
    claim_mode text NOT NULL,
    CONSTRAINT sellable_unit_space_claim_mode_check CHECK ((claim_mode = ANY (ARRAY['exclusive'::text, 'positional'::text])))
);


--
-- Name: space; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.space (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    property_node uuid NOT NULL,
    code text NOT NULL,
    profile_key text NOT NULL,
    capacity smallint DEFAULT 1 NOT NULL,
    max_occupancy smallint,
    floor text,
    area_sqm numeric(8,2),
    gender_policy text,
    length_cm integer,
    beam_cm integer,
    draft_cm integer,
    power_amps integer,
    attrs jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    CONSTRAINT space_gender_policy_check CHECK ((gender_policy = ANY (ARRAY['any'::text, 'female'::text, 'male'::text])))
);


--
-- Name: space_occupancy; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.space_occupancy (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    space_id uuid NOT NULL,
    period tstzrange NOT NULL,
    slot_ref uuid NOT NULL,
    slot_kind text NOT NULL,
    exclusive boolean NOT NULL,
    claim int4range NOT NULL,
    CONSTRAINT claim_shape CHECK (((exclusive AND (claim = int4range(0, NULL::integer))) OR ((NOT exclusive) AND (lower(claim) >= 0) AND (upper(claim) = (lower(claim) + 1))))),
    CONSTRAINT space_occupancy_slot_kind_check CHECK ((slot_kind = ANY (ARRAY['segment'::text, 'hold'::text, 'ooo'::text])))
);


--
-- Name: space_relation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.space_relation (
    tenant_id uuid NOT NULL,
    parent_space uuid NOT NULL,
    child_space uuid NOT NULL,
    kind text NOT NULL,
    CONSTRAINT space_relation_kind_check CHECK ((kind = ANY (ARRAY['contains'::text, 'connects'::text])))
);


--
-- Name: stats_daily; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stats_daily (
    tenant_id uuid NOT NULL,
    property_node uuid NOT NULL,
    business_date date NOT NULL,
    unit_type_id uuid NOT NULL,
    market_code text NOT NULL,
    source_code text NOT NULL,
    channel_code text NOT NULL,
    rooms_available integer DEFAULT 0 NOT NULL,
    rooms_sold integer DEFAULT 0 NOT NULL,
    arrivals integer DEFAULT 0 NOT NULL,
    departures integer DEFAULT 0 NOT NULL,
    no_shows integer DEFAULT 0 NOT NULL,
    room_revenue_minor bigint DEFAULT 0 NOT NULL,
    fnb_revenue_minor bigint DEFAULT 0 NOT NULL,
    other_revenue_minor bigint DEFAULT 0 NOT NULL
);


--
-- Name: statutory_submission; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.statutory_submission (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    property_node uuid NOT NULL,
    reservation_id uuid NOT NULL,
    adapter_key text NOT NULL,
    due_at timestamp with time zone NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    payload jsonb,
    receipt jsonb,
    submitted_at timestamp with time zone,
    CONSTRAINT statutory_submission_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'submitted'::text, 'accepted'::text, 'failed'::text, 'not_required'::text])))
);


--
-- Name: task; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    property_node uuid NOT NULL,
    kind text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    subject_type text,
    subject_id uuid,
    assignee_party uuid,
    department text,
    due_at timestamp with time zone,
    priority smallint DEFAULT 3 NOT NULL,
    credits smallint,
    sheet_id uuid,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    CONSTRAINT task_status_check CHECK ((status = ANY (ARRAY['open'::text, 'assigned'::text, 'in_progress'::text, 'done'::text, 'verified'::text, 'cancelled'::text])))
);


--
-- Name: task_sheet; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_sheet (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    property_node uuid NOT NULL,
    sheet_date date NOT NULL,
    attendant_party uuid,
    target_credits smallint
);


--
-- Name: tax_assignment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tax_assignment (
    tenant_id uuid NOT NULL,
    property_node uuid NOT NULL,
    jurisdiction_key text NOT NULL,
    effective daterange NOT NULL
);


--
-- Name: tax_attribution_hold_binding; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tax_attribution_hold_binding (
    tenant_id uuid NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    property_node uuid NOT NULL,
    bound_by uuid NOT NULL,
    hold_id uuid NOT NULL,
    attribution_id uuid NOT NULL,
    sellable_unit_id uuid NOT NULL,
    period tstzrange NOT NULL,
    origin_quote_hash text NOT NULL,
    snapshot_hash text NOT NULL,
    currency character(3) NOT NULL,
    bound_at timestamp with time zone DEFAULT transaction_timestamp() NOT NULL,
    CONSTRAINT tax_attribution_hold_binding_currency_ck CHECK ((currency ~ '^[A-Z]{3}$'::text)),
    CONSTRAINT tax_attribution_hold_binding_period_ck CHECK (((NOT isempty(period)) AND lower_inc(period) AND (NOT upper_inc(period)) AND (lower(period) IS NOT NULL) AND (upper(period) IS NOT NULL) AND (lower(period) < upper(period)))),
    CONSTRAINT tax_attribution_hold_binding_quote_hash_ck CHECK ((origin_quote_hash ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT tax_attribution_hold_binding_snapshot_hash_ck CHECK ((snapshot_hash ~ '^[0-9a-f]{64}$'::text))
);


--
-- Name: tax_attribution_journal_binding; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tax_attribution_journal_binding (
    tenant_id uuid NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    property_node uuid NOT NULL,
    posted_by uuid NOT NULL,
    lineage_id uuid NOT NULL,
    hold_binding_id uuid NOT NULL,
    attribution_id uuid NOT NULL,
    reservation_id uuid NOT NULL,
    segment_id uuid NOT NULL,
    folio_id uuid NOT NULL,
    guest_account_id uuid NOT NULL,
    journal_id uuid NOT NULL,
    origin_quote_hash text NOT NULL,
    snapshot_hash text NOT NULL,
    currency character(3) NOT NULL,
    business_date date NOT NULL,
    posted_at timestamp with time zone DEFAULT transaction_timestamp() NOT NULL,
    CONSTRAINT tax_attribution_journal_binding_business_date_ck CHECK (isfinite(business_date)),
    CONSTRAINT tax_attribution_journal_binding_currency_ck CHECK ((currency ~ '^[A-Z]{3}$'::text)),
    CONSTRAINT tax_attribution_journal_binding_quote_hash_ck CHECK ((origin_quote_hash ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT tax_attribution_journal_binding_snapshot_hash_ck CHECK ((snapshot_hash ~ '^[0-9a-f]{64}$'::text))
);


--
-- Name: tax_attribution_reservation_binding; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tax_attribution_reservation_binding (
    tenant_id uuid NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    property_node uuid NOT NULL,
    linked_by uuid NOT NULL,
    binding_id uuid NOT NULL,
    hold_id uuid NOT NULL,
    attribution_id uuid NOT NULL,
    reservation_id uuid NOT NULL,
    segment_id uuid NOT NULL,
    sellable_unit_id uuid NOT NULL,
    period tstzrange NOT NULL,
    origin_quote_hash text NOT NULL,
    snapshot_hash text NOT NULL,
    currency character(3) NOT NULL,
    linked_at timestamp with time zone DEFAULT transaction_timestamp() NOT NULL,
    CONSTRAINT tax_attribution_reservation_binding_currency_ck CHECK ((currency ~ '^[A-Z]{3}$'::text)),
    CONSTRAINT tax_attribution_reservation_binding_period_ck CHECK (((NOT isempty(period)) AND lower_inc(period) AND (NOT upper_inc(period)) AND (lower(period) IS NOT NULL) AND (upper(period) IS NOT NULL) AND (lower(period) < upper(period)))),
    CONSTRAINT tax_attribution_reservation_binding_quote_hash_ck CHECK ((origin_quote_hash ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT tax_attribution_reservation_binding_snapshot_hash_ck CHECK ((snapshot_hash ~ '^[0-9a-f]{64}$'::text))
);


--
-- Name: tax_attribution_snapshot; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tax_attribution_snapshot (
    tenant_id uuid NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    property_node uuid NOT NULL,
    actor_id uuid NOT NULL,
    schema_version smallint NOT NULL,
    origin_kind text NOT NULL,
    origin_quote_hash text NOT NULL,
    snapshot_hash text NOT NULL,
    currency character(3) NOT NULL,
    snapshot jsonb NOT NULL,
    recorded_at timestamp with time zone DEFAULT transaction_timestamp() NOT NULL,
    CONSTRAINT tax_attribution_snapshot_currency_ck CHECK ((currency ~ '^[A-Z]{3}$'::text)),
    CONSTRAINT tax_attribution_snapshot_hash_ck CHECK ((snapshot_hash ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT tax_attribution_snapshot_origin_ck CHECK ((origin_kind = 'rate_quote'::text)),
    CONSTRAINT tax_attribution_snapshot_outer_identity_ck CHECK (((jsonb_typeof(snapshot) = 'object'::text) AND (snapshot ?& ARRAY['schemaVersion'::text, 'origin'::text, 'currency'::text, 'revenueLine'::text, 'assignments'::text, 'jurisdiction'::text, 'evaluation'::text, 'snapshotHash'::text]) AND ((snapshot - ARRAY['schemaVersion'::text, 'origin'::text, 'currency'::text, 'revenueLine'::text, 'assignments'::text, 'jurisdiction'::text, 'evaluation'::text, 'snapshotHash'::text]) = '{}'::jsonb) AND ((snapshot -> 'schemaVersion'::text) = '1'::jsonb) AND (jsonb_typeof((snapshot -> 'origin'::text)) = 'object'::text) AND ((snapshot -> 'origin'::text) ?& ARRAY['kind'::text, 'quoteHash'::text]) AND (((snapshot -> 'origin'::text) - ARRAY['kind'::text, 'quoteHash'::text]) = '{}'::jsonb) AND (((snapshot -> 'origin'::text) ->> 'kind'::text) = origin_kind) AND (((snapshot -> 'origin'::text) ->> 'quoteHash'::text) = origin_quote_hash) AND ((snapshot ->> 'currency'::text) = (currency)::text) AND ((snapshot ->> 'snapshotHash'::text) = snapshot_hash) AND ((octet_length(convert_to((snapshot)::text, 'UTF8'::name)) >= 1) AND (octet_length(convert_to((snapshot)::text, 'UTF8'::name)) <= 8388608)))),
    CONSTRAINT tax_attribution_snapshot_quote_hash_ck CHECK ((origin_quote_hash ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT tax_attribution_snapshot_version_ck CHECK ((schema_version = 1))
);


--
-- Name: tax_semantic_route; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tax_semantic_route (
    tenant_id uuid NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    property_node uuid NOT NULL,
    currency character(3) NOT NULL,
    jurisdiction_extension_id uuid NOT NULL,
    jurisdiction_owner_tenant_id uuid,
    jurisdiction_key text NOT NULL,
    jurisdiction_version integer NOT NULL,
    jurisdiction_content_hash text NOT NULL,
    semantic_kind text NOT NULL,
    semantic_code text NOT NULL,
    tx_code text NOT NULL,
    CONSTRAINT tax_semantic_route_currency_ck CHECK ((currency ~ '^[A-Z]{3}$'::text)),
    CONSTRAINT tax_semantic_route_jurisdiction_hash_ck CHECK ((jurisdiction_content_hash ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT tax_semantic_route_jurisdiction_key_ck CHECK ((jurisdiction_key ~ '^[a-z0-9][a-z0-9_.:-]{0,127}$'::text)),
    CONSTRAINT tax_semantic_route_jurisdiction_owner_ck CHECK (((jurisdiction_owner_tenant_id IS NULL) OR (jurisdiction_owner_tenant_id = tenant_id))),
    CONSTRAINT tax_semantic_route_jurisdiction_version_ck CHECK ((jurisdiction_version > 0)),
    CONSTRAINT tax_semantic_route_semantic_ck CHECK ((((semantic_kind = 'revenue'::text) AND (semantic_code = 'room_revenue'::text)) OR ((semantic_kind = 'tax'::text) AND (semantic_code ~ '^[A-Z][A-Z0-9_]{0,63}$'::text))))
);


--
-- Name: tenant; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    tier text DEFAULT 'shared'::text NOT NULL,
    residency text DEFAULT 'me-central'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tenant_tier_check CHECK ((tier = ANY (ARRAY['shared'::text, 'dedicated'::text])))
);


--
-- Name: travel_detail; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.travel_detail (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    reservation_id uuid NOT NULL,
    direction text NOT NULL,
    mode text,
    carrier text,
    service_no text,
    scheduled_at timestamp with time zone,
    pickup_requested boolean DEFAULT false NOT NULL,
    pickup_task_id uuid,
    notes text,
    CONSTRAINT travel_detail_direction_check CHECK ((direction = ANY (ARRAY['arrival'::text, 'departure'::text]))),
    CONSTRAINT travel_detail_mode_check CHECK ((mode = ANY (ARRAY['flight'::text, 'train'::text, 'bus'::text, 'car'::text, 'ferry'::text, 'other'::text])))
);


--
-- Name: trust_negative_authorization; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trust_negative_authorization (
    tenant_id uuid NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    property_node uuid NOT NULL,
    owner_party_id uuid NOT NULL,
    trust_account_id uuid NOT NULL,
    payable_account_id uuid NOT NULL,
    approval_request_id uuid NOT NULL,
    journal_id uuid NOT NULL,
    amount_minor bigint NOT NULL,
    available_before_minor bigint NOT NULL,
    projected_available_minor bigint NOT NULL,
    currency character(3) NOT NULL,
    business_date date NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT trust_negative_authorization_amount_minor_check CHECK ((amount_minor > 0)),
    CONSTRAINT trust_negative_authorization_projected_available_minor_check CHECK ((projected_available_minor < 0)),
    CONSTRAINT trust_negative_math_ck CHECK ((projected_available_minor = (available_before_minor - amount_minor)))
);


--
-- Name: tx_code; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tx_code (
    code text NOT NULL,
    name text NOT NULL,
    grp text NOT NULL,
    usali_line text,
    default_dr text,
    default_cr text,
    CONSTRAINT tx_code_grp_check CHECK ((grp = ANY (ARRAY['revenue'::text, 'payment'::text, 'tax'::text, 'adjustment'::text, 'transfer'::text, 'deposit'::text, 'paidout'::text])))
);


--
-- Name: tx_code_route; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tx_code_route (
    tenant_id uuid NOT NULL,
    property_node uuid NOT NULL,
    currency character(3) NOT NULL,
    tx_code text NOT NULL,
    debit_account_id uuid,
    credit_account_id uuid,
    CONSTRAINT tx_code_route_has_side_ck CHECK (((debit_account_id IS NOT NULL) OR (credit_account_id IS NOT NULL)))
);


--
-- Name: unit_condition; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unit_condition (
    tenant_id uuid NOT NULL,
    space_id uuid NOT NULL,
    condition text DEFAULT 'clean'::text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    CONSTRAINT unit_condition_condition_check CHECK ((condition = ANY (ARRAY['clean'::text, 'dirty'::text, 'pickup'::text, 'inspected'::text])))
);


--
-- Name: unit_type; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unit_type (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    property_node uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    profile_key text NOT NULL,
    base_occupancy smallint DEFAULT 2 NOT NULL,
    max_occupancy smallint DEFAULT 2 NOT NULL,
    attrs jsonb DEFAULT '{}'::jsonb NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL
);


--
-- Name: user_role; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_role (
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role_id uuid NOT NULL,
    scope_node uuid NOT NULL
);


--
-- Name: vehicle; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vehicle (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    property_node uuid NOT NULL,
    reservation_id uuid,
    party_id uuid,
    reg_no text NOT NULL,
    make text,
    model text,
    colour text,
    driver_name text,
    parking_space uuid,
    entered_at timestamp with time zone,
    exited_at timestamp with time zone,
    notes text
);


--
-- Name: waitlist_entry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.waitlist_entry (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    property_node uuid NOT NULL,
    unit_type_id uuid,
    stay_dates daterange NOT NULL,
    party_id uuid,
    priority integer DEFAULT 100 NOT NULL,
    status text DEFAULT 'open'::text NOT NULL
);


--
-- Name: account account_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT account_pkey PRIMARY KEY (id);


--
-- Name: account account_tenant_id_currency_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT account_tenant_id_currency_uq UNIQUE (tenant_id, id, currency);


--
-- Name: account account_tenant_id_id_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT account_tenant_id_id_uq UNIQUE (tenant_id, id);


--
-- Name: account account_tenant_property_currency_id_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT account_tenant_property_currency_id_uq UNIQUE (tenant_id, property_node, currency, id);


--
-- Name: address address_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.address
    ADD CONSTRAINT address_pkey PRIMARY KEY (id);


--
-- Name: alert alert_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert
    ADD CONSTRAINT alert_pkey PRIMARY KEY (id);


--
-- Name: api_client api_client_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_client
    ADD CONSTRAINT api_client_pkey PRIMARY KEY (id);


--
-- Name: api_idempotency api_idempotency_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_idempotency
    ADD CONSTRAINT api_idempotency_pkey PRIMARY KEY (tenant_id, operation, key_hash);


--
-- Name: app_user app_user_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_user
    ADD CONSTRAINT app_user_pkey PRIMARY KEY (id);


--
-- Name: app_user app_user_tenant_id_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_user
    ADD CONSTRAINT app_user_tenant_id_email_key UNIQUE (tenant_id, email);


--
-- Name: app_user app_user_tenant_id_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_user
    ADD CONSTRAINT app_user_tenant_id_uq UNIQUE (tenant_id, id);


--
-- Name: approval_request approval_request_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_request
    ADD CONSTRAINT approval_request_pkey PRIMARY KEY (id);


--
-- Name: approval_request approval_request_tenant_id_id_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_request
    ADD CONSTRAINT approval_request_tenant_id_id_uq UNIQUE (tenant_id, id);


--
-- Name: ar_allocation ar_allocation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ar_allocation
    ADD CONSTRAINT ar_allocation_pkey PRIMARY KEY (invoice_doc, payment_journal);


--
-- Name: automation automation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation
    ADD CONSTRAINT automation_pkey PRIMARY KEY (id);


--
-- Name: availability_projection availability_projection_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.availability_projection
    ADD CONSTRAINT availability_projection_pkey PRIMARY KEY (property_node, unit_type_id, stay_date);


--
-- Name: block_allotment block_allotment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.block_allotment
    ADD CONSTRAINT block_allotment_pkey PRIMARY KEY (group_id, unit_type_id, stay_date);


--
-- Name: block_status_def block_status_def_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.block_status_def
    ADD CONSTRAINT block_status_def_pkey PRIMARY KEY (tenant_id, code);


--
-- Name: business_day_discrepancy_carry business_day_discrepancy_carr_tenant_id_approval_request_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_day_discrepancy_carry
    ADD CONSTRAINT business_day_discrepancy_carr_tenant_id_approval_request_id_key UNIQUE (tenant_id, approval_request_id);


--
-- Name: business_day_discrepancy_carry business_day_discrepancy_carr_tenant_id_source_discrepancy__key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_day_discrepancy_carry
    ADD CONSTRAINT business_day_discrepancy_carr_tenant_id_source_discrepancy__key UNIQUE (tenant_id, source_discrepancy_id);


--
-- Name: business_day_discrepancy_carry business_day_discrepancy_carr_tenant_id_target_discrepancy__key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_day_discrepancy_carry
    ADD CONSTRAINT business_day_discrepancy_carr_tenant_id_target_discrepancy__key UNIQUE (tenant_id, target_discrepancy_id);


--
-- Name: business_day_discrepancy_carry business_day_discrepancy_carry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_day_discrepancy_carry
    ADD CONSTRAINT business_day_discrepancy_carry_pkey PRIMARY KEY (tenant_id, id);


--
-- Name: business_day_discrepancy_carry business_day_discrepancy_carry_tenant_id_request_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_day_discrepancy_carry
    ADD CONSTRAINT business_day_discrepancy_carry_tenant_id_request_id_key UNIQUE (tenant_id, request_id);


--
-- Name: business_day business_day_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_day
    ADD CONSTRAINT business_day_pkey PRIMARY KEY (property_node, business_date);


--
-- Name: business_day business_day_tenant_property_date_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_day
    ADD CONSTRAINT business_day_tenant_property_date_uq UNIQUE (tenant_id, property_node, business_date);


--
-- Name: cash_drawer_denomination cash_drawer_denomination_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_drawer_denomination
    ADD CONSTRAINT cash_drawer_denomination_pk PRIMARY KEY (tenant_id, drawer_id, unit_minor);


--
-- Name: cash_drawer cash_drawer_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_drawer
    ADD CONSTRAINT cash_drawer_pk PRIMARY KEY (tenant_id, id);


--
-- Name: cash_drawer cash_drawer_property_code_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_drawer
    ADD CONSTRAINT cash_drawer_property_code_uq UNIQUE (tenant_id, property_node, code);


--
-- Name: cash_drawer cash_drawer_tenant_id_currency_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_drawer
    ADD CONSTRAINT cash_drawer_tenant_id_currency_uq UNIQUE (tenant_id, id, currency);


--
-- Name: cashier_count_line cashier_count_line_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cashier_count_line
    ADD CONSTRAINT cashier_count_line_pk PRIMARY KEY (tenant_id, count_id, denomination_minor);


--
-- Name: cashier_count cashier_count_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cashier_count
    ADD CONSTRAINT cashier_count_pk PRIMARY KEY (tenant_id, id);


--
-- Name: cashier_count cashier_count_session_attempt_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cashier_count
    ADD CONSTRAINT cashier_count_session_attempt_uq UNIQUE (tenant_id, session_id, attempt_no);


--
-- Name: cashier_count cashier_count_tenant_id_id_drawer_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cashier_count
    ADD CONSTRAINT cashier_count_tenant_id_id_drawer_uq UNIQUE (tenant_id, id, session_id, drawer_id);


--
-- Name: cashier_session cashier_session_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cashier_session
    ADD CONSTRAINT cashier_session_pkey PRIMARY KEY (id);


--
-- Name: cashier_session cashier_session_tenant_id_id_drawer_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cashier_session
    ADD CONSTRAINT cashier_session_tenant_id_id_drawer_uq UNIQUE (tenant_id, id, drawer_id);


--
-- Name: cashier_session cashier_session_tenant_id_id_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cashier_session
    ADD CONSTRAINT cashier_session_tenant_id_id_uq UNIQUE (tenant_id, id);


--
-- Name: channel_map channel_map_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_map
    ADD CONSTRAINT channel_map_pkey PRIMARY KEY (property_node, channel_code, kind, internal_id);


--
-- Name: channel channel_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel
    ADD CONSTRAINT channel_pkey PRIMARY KEY (code);


--
-- Name: consent consent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent
    ADD CONSTRAINT consent_pkey PRIMARY KEY (party_id, purpose);


--
-- Name: consumer_cursor consumer_cursor_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consumer_cursor
    ADD CONSTRAINT consumer_cursor_pkey PRIMARY KEY (consumer);


--
-- Name: consumer_processed consumer_processed_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consumer_processed
    ADD CONSTRAINT consumer_processed_pkey PRIMARY KEY (consumer, outbox_id);


--
-- Name: contact_point contact_point_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_point
    ADD CONSTRAINT contact_point_pkey PRIMARY KEY (id);


--
-- Name: deposit_application deposit_application_key_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deposit_application
    ADD CONSTRAINT deposit_application_key_uq UNIQUE (tenant_id, key_hash);


--
-- Name: deposit_application deposit_application_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deposit_application
    ADD CONSTRAINT deposit_application_pk PRIMARY KEY (tenant_id, id);


--
-- Name: discrepancy discrepancy_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discrepancy
    ADD CONSTRAINT discrepancy_pkey PRIMARY KEY (id);


--
-- Name: discrepancy discrepancy_tenant_id_id_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discrepancy
    ADD CONSTRAINT discrepancy_tenant_id_id_uq UNIQUE (tenant_id, id);


--
-- Name: document document_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document
    ADD CONSTRAINT document_pkey PRIMARY KEY (id);


--
-- Name: document_series document_series_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_series
    ADD CONSTRAINT document_series_pkey PRIMARY KEY (id);


--
-- Name: document_series document_series_tenant_id_property_node_kind_prefix_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_series
    ADD CONSTRAINT document_series_tenant_id_property_node_kind_prefix_key UNIQUE (tenant_id, property_node, kind, prefix);


--
-- Name: erasure_request erasure_request_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.erasure_request
    ADD CONSTRAINT erasure_request_pkey PRIMARY KEY (id);


--
-- Name: extension extension_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.extension
    ADD CONSTRAINT extension_pkey PRIMARY KEY (id);


--
-- Name: extension extension_tenant_id_type_key_version_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.extension
    ADD CONSTRAINT extension_tenant_id_type_key_version_key UNIQUE (tenant_id, type, key, version);


--
-- Name: extension_type extension_type_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.extension_type
    ADD CONSTRAINT extension_type_pkey PRIMARY KEY (type);


--
-- Name: fact_log fact_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fact_log
    ADD CONSTRAINT fact_log_pkey PRIMARY KEY (id);


--
-- Name: fiscal_submission fiscal_submission_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fiscal_submission
    ADD CONSTRAINT fiscal_submission_pkey PRIMARY KEY (id);


--
-- Name: folio folio_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.folio
    ADD CONSTRAINT folio_pkey PRIMARY KEY (id);


--
-- Name: folio folio_reservation_window_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.folio
    ADD CONSTRAINT folio_reservation_window_uq UNIQUE (tenant_id, reservation_id, window_no);


--
-- Name: folio folio_tenant_account_id_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.folio
    ADD CONSTRAINT folio_tenant_account_id_uq UNIQUE (tenant_id, account_id, id);


--
-- Name: folio folio_tenant_id_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.folio
    ADD CONSTRAINT folio_tenant_id_uq UNIQUE (tenant_id, id);


--
-- Name: hold hold_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hold
    ADD CONSTRAINT hold_pkey PRIMARY KEY (id);


--
-- Name: hold hold_tax_binding_identity_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hold
    ADD CONSTRAINT hold_tax_binding_identity_uq UNIQUE (tenant_id, id, property_node, sellable_unit_id, period);


--
-- Name: hosted_payment_request hosted_payment_request_bearer_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hosted_payment_request
    ADD CONSTRAINT hosted_payment_request_bearer_uq UNIQUE (tenant_id, bearer_hash);


--
-- Name: hosted_payment_request hosted_payment_request_generation_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hosted_payment_request
    ADD CONSTRAINT hosted_payment_request_generation_uq UNIQUE (tenant_id, folio_id, generation);


--
-- Name: hosted_payment_request hosted_payment_request_key_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hosted_payment_request
    ADD CONSTRAINT hosted_payment_request_key_uq UNIQUE (tenant_id, key_hash);


--
-- Name: hosted_payment_request hosted_payment_request_lineage_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hosted_payment_request
    ADD CONSTRAINT hosted_payment_request_lineage_uq UNIQUE (tenant_id, id, property_node, folio_id, guest_account_id, operation_id, deposit_account_id, currency);


--
-- Name: hosted_payment_request hosted_payment_request_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hosted_payment_request
    ADD CONSTRAINT hosted_payment_request_pk PRIMARY KEY (tenant_id, id);


--
-- Name: identity_document identity_document_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.identity_document
    ADD CONSTRAINT identity_document_pkey PRIMARY KEY (id);


--
-- Name: inbound_message inbound_message_channel_code_external_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inbound_message
    ADD CONSTRAINT inbound_message_channel_code_external_id_key UNIQUE (channel_code, external_id);


--
-- Name: inbound_message inbound_message_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inbound_message
    ADD CONSTRAINT inbound_message_pkey PRIMARY KEY (id);


--
-- Name: india_gst_accommodation_final_component_tax india_gst_accommodation_final_c_tenant_id_supersedes_tax_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_final_component_tax
    ADD CONSTRAINT india_gst_accommodation_final_c_tenant_id_supersedes_tax_id_key UNIQUE (tenant_id, supersedes_tax_id);


--
-- Name: india_gst_accommodation_final_component_tax india_gst_accommodation_final_co_tenant_id_id_evidence_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_final_component_tax
    ADD CONSTRAINT india_gst_accommodation_final_co_tenant_id_id_evidence_hash_key UNIQUE (tenant_id, id, evidence_hash);


--
-- Name: india_gst_accommodation_final_component_tax india_gst_accommodation_final_compo_tenant_id_evidence_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_final_component_tax
    ADD CONSTRAINT india_gst_accommodation_final_compo_tenant_id_evidence_hash_key UNIQUE (tenant_id, evidence_hash);


--
-- Name: india_gst_accommodation_final_component_tax india_gst_accommodation_final_compon_tenant_id_valuation_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_final_component_tax
    ADD CONSTRAINT india_gst_accommodation_final_compon_tenant_id_valuation_id_key UNIQUE (tenant_id, valuation_id);


--
-- Name: india_gst_accommodation_final_component_tax india_gst_accommodation_final_componen_tenant_id_request_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_final_component_tax
    ADD CONSTRAINT india_gst_accommodation_final_componen_tenant_id_request_id_key UNIQUE (tenant_id, request_id);


--
-- Name: india_gst_accommodation_final_component_tax_component india_gst_accommodation_final_component_tax_component_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_final_component_tax_component
    ADD CONSTRAINT india_gst_accommodation_final_component_tax_component_pkey PRIMARY KEY (tenant_id, tax_id, room_night_ordinal, component_ordinal);


--
-- Name: india_gst_accommodation_final_component_tax india_gst_accommodation_final_component_tax_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_final_component_tax
    ADD CONSTRAINT india_gst_accommodation_final_component_tax_pkey PRIMARY KEY (tenant_id, id);


--
-- Name: india_gst_accommodation_final_component_tax_room_night india_gst_accommodation_final_component_tax_room_night_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_final_component_tax_room_night
    ADD CONSTRAINT india_gst_accommodation_final_component_tax_room_night_pkey PRIMARY KEY (tenant_id, tax_id, ordinal);


--
-- Name: india_gst_accommodation_final_valuation india_gst_accommodation_final_tenant_id_approval_request_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_final_valuation
    ADD CONSTRAINT india_gst_accommodation_final_tenant_id_approval_request_id_key UNIQUE (tenant_id, approval_request_id);


--
-- Name: india_gst_accommodation_final_component_tax india_gst_accommodation_final_tenant_id_reservation_id_fol_key1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_final_component_tax
    ADD CONSTRAINT india_gst_accommodation_final_tenant_id_reservation_id_fol_key1 UNIQUE (tenant_id, reservation_id, folio_id, generation);


--
-- Name: india_gst_accommodation_final_valuation india_gst_accommodation_final_tenant_id_reservation_id_foli_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_final_valuation
    ADD CONSTRAINT india_gst_accommodation_final_tenant_id_reservation_id_foli_key UNIQUE (tenant_id, reservation_id, folio_id, generation);


--
-- Name: india_gst_accommodation_final_valuation india_gst_accommodation_final_tenant_id_supersedes_valuatio_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_final_valuation
    ADD CONSTRAINT india_gst_accommodation_final_tenant_id_supersedes_valuatio_key UNIQUE (tenant_id, supersedes_valuation_id);


--
-- Name: india_gst_accommodation_final_component_tax_room_night india_gst_accommodation_final_tenant_id_tax_id_business_dat_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_final_component_tax_room_night
    ADD CONSTRAINT india_gst_accommodation_final_tenant_id_tax_id_business_dat_key UNIQUE (tenant_id, tax_id, business_date);


--
-- Name: india_gst_accommodation_final_component_tax_component india_gst_accommodation_final_tenant_id_tax_id_room_night_o_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_final_component_tax_component
    ADD CONSTRAINT india_gst_accommodation_final_tenant_id_tax_id_room_night_o_key UNIQUE (tenant_id, tax_id, room_night_ordinal, component_identity);


--
-- Name: india_gst_accommodation_final_valuation india_gst_accommodation_final_valua_tenant_id_evidence_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_final_valuation
    ADD CONSTRAINT india_gst_accommodation_final_valua_tenant_id_evidence_hash_key UNIQUE (tenant_id, evidence_hash);


--
-- Name: india_gst_accommodation_final_valuation india_gst_accommodation_final_valuatio_tenant_id_request_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_final_valuation
    ADD CONSTRAINT india_gst_accommodation_final_valuatio_tenant_id_request_id_key UNIQUE (tenant_id, request_id);


--
-- Name: india_gst_accommodation_final_valuation india_gst_accommodation_final_valuation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_final_valuation
    ADD CONSTRAINT india_gst_accommodation_final_valuation_pkey PRIMARY KEY (tenant_id, id);


--
-- Name: india_gst_accommodation_invoice_issue_snapshot india_gst_accommodation_invoice_issue_identity_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_invoice_issue_snapshot
    ADD CONSTRAINT india_gst_accommodation_invoice_issue_identity_uq UNIQUE (tenant_id, invoice_series, invoice_serial);


--
-- Name: india_gst_accommodation_invoice_issue_snapshot india_gst_accommodation_invoice_issue_service_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_invoice_issue_snapshot
    ADD CONSTRAINT india_gst_accommodation_invoice_issue_service_uq UNIQUE (tenant_id, service_provision_snapshot_id);


--
-- Name: india_gst_accommodation_invoice_issue_snapshot india_gst_accommodation_invoice_issue_snapshot_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_invoice_issue_snapshot
    ADD CONSTRAINT india_gst_accommodation_invoice_issue_snapshot_pk PRIMARY KEY (tenant_id, id);


--
-- Name: india_gst_accommodation_payment_receipt_snapshot india_gst_accommodation_payment_receipt_service_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_payment_receipt_snapshot
    ADD CONSTRAINT india_gst_accommodation_payment_receipt_service_uq UNIQUE (tenant_id, service_provision_snapshot_id);


--
-- Name: india_gst_accommodation_payment_receipt_snapshot india_gst_accommodation_payment_receipt_snapshot_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_payment_receipt_snapshot
    ADD CONSTRAINT india_gst_accommodation_payment_receipt_snapshot_pk PRIMARY KEY (tenant_id, id);


--
-- Name: india_gst_accommodation_quoted_rate_applicability_room_night india_gst_accommodation_quote_tenant_id_applicability_id_bu_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_quoted_rate_applicability_room_night
    ADD CONSTRAINT india_gst_accommodation_quote_tenant_id_applicability_id_bu_key UNIQUE (tenant_id, applicability_id, business_date);


--
-- Name: india_gst_accommodation_quoted_rate_component india_gst_accommodation_quote_tenant_id_applicability_id_ro_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_quoted_rate_component
    ADD CONSTRAINT india_gst_accommodation_quote_tenant_id_applicability_id_ro_key UNIQUE (tenant_id, applicability_id, room_night_ordinal, component_identity);


--
-- Name: india_gst_accommodation_quoted_rate_applicability india_gst_accommodation_quote_tenant_id_reservation_id_foli_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_quoted_rate_applicability
    ADD CONSTRAINT india_gst_accommodation_quote_tenant_id_reservation_id_foli_key UNIQUE (tenant_id, reservation_id, folio_id);


--
-- Name: india_gst_accommodation_quoted_rate_applicability india_gst_accommodation_quoted_rate_ap_tenant_id_request_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_quoted_rate_applicability
    ADD CONSTRAINT india_gst_accommodation_quoted_rate_ap_tenant_id_request_id_key UNIQUE (tenant_id, request_id);


--
-- Name: india_gst_accommodation_quoted_rate_applicability india_gst_accommodation_quoted_rate_applicability_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_quoted_rate_applicability
    ADD CONSTRAINT india_gst_accommodation_quoted_rate_applicability_pkey PRIMARY KEY (tenant_id, id);


--
-- Name: india_gst_accommodation_quoted_rate_applicability_room_night india_gst_accommodation_quoted_rate_applicability_room_nig_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_quoted_rate_applicability_room_night
    ADD CONSTRAINT india_gst_accommodation_quoted_rate_applicability_room_nig_pkey PRIMARY KEY (tenant_id, applicability_id, ordinal);


--
-- Name: india_gst_accommodation_quoted_rate_component india_gst_accommodation_quoted_rate_component_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_quoted_rate_component
    ADD CONSTRAINT india_gst_accommodation_quoted_rate_component_pkey PRIMARY KEY (tenant_id, applicability_id, room_night_ordinal, component_ordinal);


--
-- Name: india_gst_accommodation_quoted_rate_applicability india_gst_accommodation_quoted_rate_tenant_id_evidence_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_quoted_rate_applicability
    ADD CONSTRAINT india_gst_accommodation_quoted_rate_tenant_id_evidence_hash_key UNIQUE (tenant_id, evidence_hash);


--
-- Name: india_gst_accommodation_quoted_rate_applicability india_gst_accommodation_quoted_tenant_id_final_valuation_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_quoted_rate_applicability
    ADD CONSTRAINT india_gst_accommodation_quoted_tenant_id_final_valuation_id_key UNIQUE (tenant_id, final_valuation_id);


--
-- Name: india_gst_accommodation_service_provision_snapshot india_gst_accommodation_service_provision_lineage_date_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_service_provision_snapshot
    ADD CONSTRAINT india_gst_accommodation_service_provision_lineage_date_uq UNIQUE (tenant_id, reservation_lineage_id, service_provision_date);


--
-- Name: india_gst_accommodation_service_provision_snapshot india_gst_accommodation_service_provision_snapshot_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_service_provision_snapshot
    ADD CONSTRAINT india_gst_accommodation_service_provision_snapshot_pk PRIMARY KEY (tenant_id, id);


--
-- Name: india_gst_accommodation_valuation_room_night india_gst_accommodation_valua_tenant_id_valuation_id_busine_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_valuation_room_night
    ADD CONSTRAINT india_gst_accommodation_valua_tenant_id_valuation_id_busine_key UNIQUE (tenant_id, valuation_id, business_date);


--
-- Name: india_gst_accommodation_valuation_allocation india_gst_accommodation_valuation_allocation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_valuation_allocation
    ADD CONSTRAINT india_gst_accommodation_valuation_allocation_pkey PRIMARY KEY (tenant_id, valuation_id, posting_root_id, ordinal);


--
-- Name: india_gst_accommodation_valuation_room_night india_gst_accommodation_valuation_room_night_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_valuation_room_night
    ADD CONSTRAINT india_gst_accommodation_valuation_room_night_pkey PRIMARY KEY (tenant_id, valuation_id, ordinal);


--
-- Name: india_gst_accommodation_valuation_source india_gst_accommodation_valuation_source_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_valuation_source
    ADD CONSTRAINT india_gst_accommodation_valuation_source_pkey PRIMARY KEY (tenant_id, valuation_id, posting_root_id);


--
-- Name: india_gst_item_classification india_gst_item_classification_identity_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_item_classification
    ADD CONSTRAINT india_gst_item_classification_identity_uq UNIQUE NULLS NOT DISTINCT (tenant_id, property_node, jurisdiction_extension_id, jurisdiction_owner_tenant_id, jurisdiction_key, jurisdiction_version, jurisdiction_content_hash, line_id);


--
-- Name: india_gst_item_classification india_gst_item_classification_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_item_classification
    ADD CONSTRAINT india_gst_item_classification_pk PRIMARY KEY (tenant_id, id);


--
-- Name: india_gst_recipient_sez_status india_gst_recipient_sez_status_identity_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_recipient_sez_status
    ADD CONSTRAINT india_gst_recipient_sez_status_identity_uq UNIQUE (tenant_id, recipient_registration_id, recipient_registration_evidence_hash, status_as_of);


--
-- Name: india_gst_recipient_sez_status india_gst_recipient_sez_status_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_recipient_sez_status
    ADD CONSTRAINT india_gst_recipient_sez_status_pk PRIMARY KEY (tenant_id, id);


--
-- Name: india_gst_supplier_registration_status_snapshot india_gst_supplier_registration_status_snapshot_identity_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_supplier_registration_status_snapshot
    ADD CONSTRAINT india_gst_supplier_registration_status_snapshot_identity_uq UNIQUE (tenant_id, supplier_registration_id, supplier_registration_evidence_hash, status_as_of);


--
-- Name: india_gst_supplier_registration_status_snapshot india_gst_supplier_registration_status_snapshot_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_supplier_registration_status_snapshot
    ADD CONSTRAINT india_gst_supplier_registration_status_snapshot_pk PRIMARY KEY (tenant_id, id);


--
-- Name: india_gst_supplier_service_location india_gst_supplier_service_location_identity_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_supplier_service_location
    ADD CONSTRAINT india_gst_supplier_service_location_identity_uq UNIQUE (tenant_id, supplier_registration_id, supplier_evidence_hash, service_scope);


--
-- Name: india_gst_supplier_service_location india_gst_supplier_service_location_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_supplier_service_location
    ADD CONSTRAINT india_gst_supplier_service_location_pk PRIMARY KEY (tenant_id, id);


--
-- Name: india_gst_supplier_sez_status india_gst_supplier_sez_status_identity_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_supplier_sez_status
    ADD CONSTRAINT india_gst_supplier_sez_status_identity_uq UNIQUE (tenant_id, supplier_registration_id, supplier_registration_evidence_hash, status_as_of);


--
-- Name: india_gst_supplier_sez_status india_gst_supplier_sez_status_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_supplier_sez_status
    ADD CONSTRAINT india_gst_supplier_sez_status_pk PRIMARY KEY (tenant_id, id);


--
-- Name: india_sez_unit_loa_renewal india_sez_unit_loa_renewal_identity_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_sez_unit_loa_renewal
    ADD CONSTRAINT india_sez_unit_loa_renewal_identity_uq UNIQUE (tenant_id, supplier_sez_status_id, form_f2_file_number, form_f2_issue_date);


--
-- Name: india_sez_unit_loa_renewal india_sez_unit_loa_renewal_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_sez_unit_loa_renewal
    ADD CONSTRAINT india_sez_unit_loa_renewal_pk PRIMARY KEY (tenant_id, id);


--
-- Name: inventory_authority inventory_authority_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_authority
    ADD CONSTRAINT inventory_authority_pkey PRIMARY KEY (property_node, channel_code);


--
-- Name: journal journal_deposit_lineage_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal
    ADD CONSTRAINT journal_deposit_lineage_uq UNIQUE (tenant_id, id, property_node, currency);


--
-- Name: journal journal_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal
    ADD CONSTRAINT journal_pkey PRIMARY KEY (id);


--
-- Name: journal journal_positive_tax_binding_identity_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal
    ADD CONSTRAINT journal_positive_tax_binding_identity_uq UNIQUE (tenant_id, id, property_node, business_date, currency);


--
-- Name: journal journal_tenant_id_date_currency_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal
    ADD CONSTRAINT journal_tenant_id_date_currency_uq UNIQUE (tenant_id, id, business_date, currency);


--
-- Name: journal journal_tenant_id_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal
    ADD CONSTRAINT journal_tenant_id_uq UNIQUE (tenant_id, id);


--
-- Name: membership membership_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.membership
    ADD CONSTRAINT membership_pkey PRIMARY KEY (id);


--
-- Name: membership membership_tenant_id_program_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.membership
    ADD CONSTRAINT membership_tenant_id_program_number_key UNIQUE (tenant_id, program, number);


--
-- Name: message message_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message
    ADD CONSTRAINT message_pkey PRIMARY KEY (id);


--
-- Name: negotiated_rate negotiated_rate_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.negotiated_rate
    ADD CONSTRAINT negotiated_rate_pkey PRIMARY KEY (party_id, rate_plan_id);


--
-- Name: space_occupancy no_conflicting_claims; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.space_occupancy
    ADD CONSTRAINT no_conflicting_claims EXCLUDE USING gist (tenant_id WITH =, space_id WITH =, period WITH &&, claim WITH &&);


--
-- Name: ooo_oos ooo_oos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ooo_oos
    ADD CONSTRAINT ooo_oos_pkey PRIMARY KEY (id);


--
-- Name: org_node org_node_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_node
    ADD CONSTRAINT org_node_pkey PRIMARY KEY (id);


--
-- Name: org_node org_node_tenant_id_currency_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_node
    ADD CONSTRAINT org_node_tenant_id_currency_uq UNIQUE (tenant_id, id, currency);


--
-- Name: org_node org_node_tenant_id_id_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_node
    ADD CONSTRAINT org_node_tenant_id_id_uq UNIQUE (tenant_id, id);


--
-- Name: org_node org_node_tenant_id_path_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_node
    ADD CONSTRAINT org_node_tenant_id_path_key UNIQUE (tenant_id, path);


--
-- Name: outbox outbox_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outbox
    ADD CONSTRAINT outbox_pkey PRIMARY KEY (seq);


--
-- Name: overbooking_limit overbooking_limit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.overbooking_limit
    ADD CONSTRAINT overbooking_limit_pkey PRIMARY KEY (property_node, unit_type_id, stay_dates);


--
-- Name: package_element package_element_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.package_element
    ADD CONSTRAINT package_element_pkey PRIMARY KEY (id);


--
-- Name: package package_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.package
    ADD CONSTRAINT package_pkey PRIMARY KEY (id);


--
-- Name: package package_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.package
    ADD CONSTRAINT package_tenant_id_code_key UNIQUE (tenant_id, code);


--
-- Name: party_fiscal_registration party_fiscal_registration_identity_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.party_fiscal_registration
    ADD CONSTRAINT party_fiscal_registration_identity_uq UNIQUE (tenant_id, scheme, registration_number);


--
-- Name: party_fiscal_registration party_fiscal_registration_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.party_fiscal_registration
    ADD CONSTRAINT party_fiscal_registration_pk PRIMARY KEY (tenant_id, id);


--
-- Name: party party_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.party
    ADD CONSTRAINT party_pkey PRIMARY KEY (id);


--
-- Name: party_relationship party_relationship_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.party_relationship
    ADD CONSTRAINT party_relationship_pkey PRIMARY KEY (from_party, to_party, kind);


--
-- Name: party_role party_role_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.party_role
    ADD CONSTRAINT party_role_pkey PRIMARY KEY (party_id, role);


--
-- Name: party party_tenant_id_id_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.party
    ADD CONSTRAINT party_tenant_id_id_uq UNIQUE (tenant_id, id);


--
-- Name: payment payment_attempt_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment
    ADD CONSTRAINT payment_attempt_uq UNIQUE (tenant_id, operation_id, attempt_no);


--
-- Name: payment payment_command_key_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment
    ADD CONSTRAINT payment_command_key_uq UNIQUE (tenant_id, operation_id, command_key_hash);


--
-- Name: payment payment_deposit_capture_lineage_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment
    ADD CONSTRAINT payment_deposit_capture_lineage_uq UNIQUE (tenant_id, id, operation_id, currency, phase, status);


--
-- Name: payment_instrument payment_instrument_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_instrument
    ADD CONSTRAINT payment_instrument_pkey PRIMARY KEY (id);


--
-- Name: payment_instrument payment_instrument_tenant_id_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_instrument
    ADD CONSTRAINT payment_instrument_tenant_id_uq UNIQUE (tenant_id, id);


--
-- Name: payment_operation payment_operation_deposit_lineage_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_operation
    ADD CONSTRAINT payment_operation_deposit_lineage_uq UNIQUE (tenant_id, id, property_node, folio_id, guest_account_id, currency, deposit_account_id, purpose);


--
-- Name: payment_operation payment_operation_key_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_operation
    ADD CONSTRAINT payment_operation_key_uq UNIQUE (tenant_id, key_hash);


--
-- Name: payment_operation payment_operation_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_operation
    ADD CONSTRAINT payment_operation_pk PRIMARY KEY (tenant_id, id);


--
-- Name: payment_operation payment_operation_tenant_id_currency_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_operation
    ADD CONSTRAINT payment_operation_tenant_id_currency_uq UNIQUE (tenant_id, id, currency);


--
-- Name: payment payment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment
    ADD CONSTRAINT payment_pkey PRIMARY KEY (id);


--
-- Name: payment payment_receipt_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment
    ADD CONSTRAINT payment_receipt_uq UNIQUE (tenant_id, receipt_id);


--
-- Name: payment payment_tenant_id_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment
    ADD CONSTRAINT payment_tenant_id_uq UNIQUE (tenant_id, id);


--
-- Name: permission permission_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permission
    ADD CONSTRAINT permission_pkey PRIMARY KEY (code);


--
-- Name: policy policy_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy
    ADD CONSTRAINT policy_pkey PRIMARY KEY (id);


--
-- Name: posting_line posting_line_journal_id_seq_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posting_line
    ADD CONSTRAINT posting_line_journal_id_seq_key UNIQUE (journal_id, seq);


--
-- Name: posting_line posting_line_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posting_line
    ADD CONSTRAINT posting_line_pkey PRIMARY KEY (id);


--
-- Name: posting_line posting_line_tenant_id_id_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posting_line
    ADD CONSTRAINT posting_line_tenant_id_id_uq UNIQUE (tenant_id, id);


--
-- Name: preference preference_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.preference
    ADD CONSTRAINT preference_pkey PRIMARY KEY (party_id, key);


--
-- Name: promotion promotion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion
    ADD CONSTRAINT promotion_pkey PRIMARY KEY (id);


--
-- Name: promotion promotion_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion
    ADD CONSTRAINT promotion_tenant_id_code_key UNIQUE (tenant_id, code);


--
-- Name: property_fiscal_location property_fiscal_location_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_fiscal_location
    ADD CONSTRAINT property_fiscal_location_pk PRIMARY KEY (tenant_id, property_node);


--
-- Name: property_fiscal_registration property_fiscal_registration_identity_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_fiscal_registration
    ADD CONSTRAINT property_fiscal_registration_identity_uq UNIQUE NULLS NOT DISTINCT (tenant_id, property_node, scheme, currency, jurisdiction_extension_id, jurisdiction_owner_tenant_id, jurisdiction_key, jurisdiction_version, jurisdiction_content_hash);


--
-- Name: property_fiscal_registration property_fiscal_registration_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_fiscal_registration
    ADD CONSTRAINT property_fiscal_registration_pk PRIMARY KEY (tenant_id, id);


--
-- Name: provider_event_receipt provider_event_receipt_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_event_receipt
    ADD CONSTRAINT provider_event_receipt_pk PRIMARY KEY (tenant_id, id);


--
-- Name: provider_event_receipt provider_event_receipt_provider_event_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_event_receipt
    ADD CONSTRAINT provider_event_receipt_provider_event_uq UNIQUE (tenant_id, provider, event_id);


--
-- Name: push_cursor push_cursor_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_cursor
    ADD CONSTRAINT push_cursor_pkey PRIMARY KEY (property_node, channel_code);


--
-- Name: queue_entry queue_entry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.queue_entry
    ADD CONSTRAINT queue_entry_pkey PRIMARY KEY (id);


--
-- Name: rate_plan_package rate_plan_package_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_plan_package
    ADD CONSTRAINT rate_plan_package_pkey PRIMARY KEY (rate_plan_id, package_id);


--
-- Name: rate_plan rate_plan_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_plan
    ADD CONSTRAINT rate_plan_pkey PRIMARY KEY (id);


--
-- Name: rate_plan rate_plan_tenant_id_property_node_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_plan
    ADD CONSTRAINT rate_plan_tenant_id_property_node_code_key UNIQUE (tenant_id, property_node, code);


--
-- Name: rate_price rate_price_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_price
    ADD CONSTRAINT rate_price_pkey PRIMARY KEY (id);


--
-- Name: reservation_group reservation_group_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation_group
    ADD CONSTRAINT reservation_group_pkey PRIMARY KEY (id);


--
-- Name: reservation_group reservation_group_tenant_id_property_node_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation_group
    ADD CONSTRAINT reservation_group_tenant_id_property_node_code_key UNIQUE (tenant_id, property_node, code);


--
-- Name: reservation_guest reservation_guest_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation_guest
    ADD CONSTRAINT reservation_guest_pkey PRIMARY KEY (reservation_id, party_id);


--
-- Name: reservation reservation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation
    ADD CONSTRAINT reservation_pkey PRIMARY KEY (id);


--
-- Name: reservation_segment reservation_segment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation_segment
    ADD CONSTRAINT reservation_segment_pkey PRIMARY KEY (id);


--
-- Name: reservation_segment reservation_segment_reservation_id_seq_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation_segment
    ADD CONSTRAINT reservation_segment_reservation_id_seq_key UNIQUE (reservation_id, seq);


--
-- Name: reservation_segment reservation_segment_tenant_id_id_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation_segment
    ADD CONSTRAINT reservation_segment_tenant_id_id_uq UNIQUE (tenant_id, id);


--
-- Name: reservation reservation_tenant_id_confirmation_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation
    ADD CONSTRAINT reservation_tenant_id_confirmation_no_key UNIQUE (tenant_id, confirmation_no);


--
-- Name: reservation reservation_tenant_id_id_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation
    ADD CONSTRAINT reservation_tenant_id_id_uq UNIQUE (tenant_id, id);


--
-- Name: restriction restriction_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restriction
    ADD CONSTRAINT restriction_pkey PRIMARY KEY (id);


--
-- Name: role_permission role_permission_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permission
    ADD CONSTRAINT role_permission_pkey PRIMARY KEY (role_id, permission_code);


--
-- Name: role role_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role
    ADD CONSTRAINT role_pkey PRIMARY KEY (id);


--
-- Name: role role_tenant_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role
    ADD CONSTRAINT role_tenant_id_name_key UNIQUE (tenant_id, name);


--
-- Name: schema_migration schema_migration_filename_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migration
    ADD CONSTRAINT schema_migration_filename_key UNIQUE (filename);


--
-- Name: schema_migration schema_migration_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migration
    ADD CONSTRAINT schema_migration_pkey PRIMARY KEY (version);


--
-- Name: sellable_unit sellable_unit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sellable_unit
    ADD CONSTRAINT sellable_unit_pkey PRIMARY KEY (id);


--
-- Name: sellable_unit_space sellable_unit_space_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sellable_unit_space
    ADD CONSTRAINT sellable_unit_space_pkey PRIMARY KEY (sellable_unit_id, space_id);


--
-- Name: space_occupancy space_occupancy_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.space_occupancy
    ADD CONSTRAINT space_occupancy_pkey PRIMARY KEY (id);


--
-- Name: space space_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.space
    ADD CONSTRAINT space_pkey PRIMARY KEY (id);


--
-- Name: space_relation space_relation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.space_relation
    ADD CONSTRAINT space_relation_pkey PRIMARY KEY (parent_space, child_space, kind);


--
-- Name: space space_tenant_id_property_node_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.space
    ADD CONSTRAINT space_tenant_id_property_node_code_key UNIQUE (tenant_id, property_node, code);


--
-- Name: stats_daily stats_daily_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stats_daily
    ADD CONSTRAINT stats_daily_pkey PRIMARY KEY (property_node, business_date, unit_type_id, market_code, source_code, channel_code);


--
-- Name: statutory_submission statutory_submission_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.statutory_submission
    ADD CONSTRAINT statutory_submission_pkey PRIMARY KEY (id);


--
-- Name: task task_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task
    ADD CONSTRAINT task_pkey PRIMARY KEY (id);


--
-- Name: task_sheet task_sheet_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_sheet
    ADD CONSTRAINT task_sheet_pkey PRIMARY KEY (id);


--
-- Name: tax_assignment tax_assignment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_assignment
    ADD CONSTRAINT tax_assignment_pkey PRIMARY KEY (property_node, effective);


--
-- Name: tax_attribution_hold_binding tax_attribution_hold_binding_attribution_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_attribution_hold_binding
    ADD CONSTRAINT tax_attribution_hold_binding_attribution_uq UNIQUE (tenant_id, attribution_id);


--
-- Name: tax_attribution_hold_binding tax_attribution_hold_binding_hold_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_attribution_hold_binding
    ADD CONSTRAINT tax_attribution_hold_binding_hold_uq UNIQUE (tenant_id, hold_id);


--
-- Name: tax_attribution_hold_binding tax_attribution_hold_binding_lineage_identity_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_attribution_hold_binding
    ADD CONSTRAINT tax_attribution_hold_binding_lineage_identity_uq UNIQUE (tenant_id, id, property_node, hold_id, attribution_id, sellable_unit_id, period, origin_quote_hash, snapshot_hash, currency);


--
-- Name: tax_attribution_hold_binding tax_attribution_hold_binding_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_attribution_hold_binding
    ADD CONSTRAINT tax_attribution_hold_binding_pk PRIMARY KEY (tenant_id, id);


--
-- Name: tax_attribution_hold_binding tax_attribution_hold_binding_snapshot_hash_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_attribution_hold_binding
    ADD CONSTRAINT tax_attribution_hold_binding_snapshot_hash_uq UNIQUE (tenant_id, snapshot_hash);


--
-- Name: tax_attribution_journal_binding tax_attribution_journal_binding_attribution_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_attribution_journal_binding
    ADD CONSTRAINT tax_attribution_journal_binding_attribution_uq UNIQUE (tenant_id, attribution_id);


--
-- Name: tax_attribution_journal_binding tax_attribution_journal_binding_journal_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_attribution_journal_binding
    ADD CONSTRAINT tax_attribution_journal_binding_journal_uq UNIQUE (tenant_id, journal_id);


--
-- Name: tax_attribution_journal_binding tax_attribution_journal_binding_lineage_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_attribution_journal_binding
    ADD CONSTRAINT tax_attribution_journal_binding_lineage_uq UNIQUE (tenant_id, lineage_id);


--
-- Name: tax_attribution_journal_binding tax_attribution_journal_binding_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_attribution_journal_binding
    ADD CONSTRAINT tax_attribution_journal_binding_pk PRIMARY KEY (tenant_id, id);


--
-- Name: tax_attribution_journal_binding tax_attribution_journal_binding_reservation_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_attribution_journal_binding
    ADD CONSTRAINT tax_attribution_journal_binding_reservation_uq UNIQUE (tenant_id, reservation_id);


--
-- Name: tax_attribution_reservation_binding tax_attribution_reservation_binding_binding_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_attribution_reservation_binding
    ADD CONSTRAINT tax_attribution_reservation_binding_binding_uq UNIQUE (tenant_id, binding_id);


--
-- Name: tax_attribution_reservation_binding tax_attribution_reservation_binding_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_attribution_reservation_binding
    ADD CONSTRAINT tax_attribution_reservation_binding_pk PRIMARY KEY (tenant_id, id);


--
-- Name: tax_attribution_reservation_binding tax_attribution_reservation_binding_posting_identity_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_attribution_reservation_binding
    ADD CONSTRAINT tax_attribution_reservation_binding_posting_identity_uq UNIQUE (tenant_id, id, property_node, binding_id, attribution_id, reservation_id, segment_id, origin_quote_hash, snapshot_hash, currency);


--
-- Name: tax_attribution_reservation_binding tax_attribution_reservation_binding_reservation_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_attribution_reservation_binding
    ADD CONSTRAINT tax_attribution_reservation_binding_reservation_uq UNIQUE (tenant_id, reservation_id);


--
-- Name: tax_attribution_reservation_binding tax_attribution_reservation_binding_segment_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_attribution_reservation_binding
    ADD CONSTRAINT tax_attribution_reservation_binding_segment_uq UNIQUE (tenant_id, segment_id);


--
-- Name: tax_attribution_snapshot tax_attribution_snapshot_binding_identity_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_attribution_snapshot
    ADD CONSTRAINT tax_attribution_snapshot_binding_identity_uq UNIQUE (tenant_id, id, property_node, actor_id, origin_quote_hash, snapshot_hash, currency);


--
-- Name: tax_attribution_snapshot tax_attribution_snapshot_hash_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_attribution_snapshot
    ADD CONSTRAINT tax_attribution_snapshot_hash_uq UNIQUE (tenant_id, snapshot_hash);


--
-- Name: tax_attribution_snapshot tax_attribution_snapshot_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_attribution_snapshot
    ADD CONSTRAINT tax_attribution_snapshot_pk PRIMARY KEY (tenant_id, id);


--
-- Name: tax_semantic_route tax_semantic_route_identity_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_semantic_route
    ADD CONSTRAINT tax_semantic_route_identity_uq UNIQUE NULLS NOT DISTINCT (tenant_id, property_node, currency, jurisdiction_extension_id, jurisdiction_owner_tenant_id, jurisdiction_key, jurisdiction_version, jurisdiction_content_hash, semantic_kind, semantic_code);


--
-- Name: tax_semantic_route tax_semantic_route_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_semantic_route
    ADD CONSTRAINT tax_semantic_route_pk PRIMARY KEY (tenant_id, id);


--
-- Name: tenant tenant_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant
    ADD CONSTRAINT tenant_pkey PRIMARY KEY (id);


--
-- Name: tenant tenant_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant
    ADD CONSTRAINT tenant_slug_key UNIQUE (slug);


--
-- Name: travel_detail travel_detail_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.travel_detail
    ADD CONSTRAINT travel_detail_pkey PRIMARY KEY (id);


--
-- Name: travel_detail travel_detail_tenant_id_reservation_id_direction_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.travel_detail
    ADD CONSTRAINT travel_detail_tenant_id_reservation_id_direction_key UNIQUE (tenant_id, reservation_id, direction);


--
-- Name: trust_negative_authorization trust_negative_authorization_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trust_negative_authorization
    ADD CONSTRAINT trust_negative_authorization_pkey PRIMARY KEY (tenant_id, id);


--
-- Name: trust_negative_authorization trust_negative_authorization_tenant_id_approval_request_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trust_negative_authorization
    ADD CONSTRAINT trust_negative_authorization_tenant_id_approval_request_id_key UNIQUE (tenant_id, approval_request_id);


--
-- Name: trust_negative_authorization trust_negative_authorization_tenant_id_journal_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trust_negative_authorization
    ADD CONSTRAINT trust_negative_authorization_tenant_id_journal_id_key UNIQUE (tenant_id, journal_id);


--
-- Name: tx_code tx_code_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tx_code
    ADD CONSTRAINT tx_code_pkey PRIMARY KEY (code);


--
-- Name: tx_code_route tx_code_route_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tx_code_route
    ADD CONSTRAINT tx_code_route_pkey PRIMARY KEY (tenant_id, property_node, currency, tx_code);


--
-- Name: unit_condition unit_condition_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_condition
    ADD CONSTRAINT unit_condition_pkey PRIMARY KEY (space_id);


--
-- Name: unit_type unit_type_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_type
    ADD CONSTRAINT unit_type_pkey PRIMARY KEY (id);


--
-- Name: unit_type unit_type_tenant_id_property_node_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_type
    ADD CONSTRAINT unit_type_tenant_id_property_node_code_key UNIQUE (tenant_id, property_node, code);


--
-- Name: user_role user_role_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_role
    ADD CONSTRAINT user_role_pkey PRIMARY KEY (user_id, role_id, scope_node);


--
-- Name: vehicle vehicle_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicle
    ADD CONSTRAINT vehicle_pkey PRIMARY KEY (id);


--
-- Name: waitlist_entry waitlist_entry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waitlist_entry
    ADD CONSTRAINT waitlist_entry_pkey PRIMARY KEY (id);


--
-- Name: account_party; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX account_party ON public.account USING btree (tenant_id, party_id) WHERE (party_id IS NOT NULL);


--
-- Name: api_idempotency_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX api_idempotency_expiry ON public.api_idempotency USING btree (expires_at);


--
-- Name: approval_request_rate_release_plan_cursor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX approval_request_rate_release_plan_cursor ON public.approval_request USING btree (tenant_id, ((payload ->> 'rate_plan_id'::text)), created_at DESC, id DESC) WHERE ((kind = 'rate_plan_release'::text) AND (subject_type = 'extension'::text));


--
-- Name: business_day_discrepancy_carry_property_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX business_day_discrepancy_carry_property_date ON public.business_day_discrepancy_carry USING btree (tenant_id, property_node, target_business_date, id);


--
-- Name: cash_drawer_denomination_active_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cash_drawer_denomination_active_lookup ON public.cash_drawer_denomination USING btree (tenant_id, drawer_id, active, unit_minor);


--
-- Name: cash_drawer_property_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cash_drawer_property_lookup ON public.cash_drawer USING btree (tenant_id, property_node, active, code, id);


--
-- Name: cashier_count_line_session_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cashier_count_line_session_lookup ON public.cashier_count_line USING btree (tenant_id, session_id, count_id, denomination_minor);


--
-- Name: cashier_count_session_history; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cashier_count_session_history ON public.cashier_count USING btree (tenant_id, session_id, attempt_no DESC, counted_at DESC, id);


--
-- Name: cashier_session_one_open_drawer; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX cashier_session_one_open_drawer ON public.cashier_session USING btree (tenant_id, drawer_id) WHERE (closed_at IS NULL);


--
-- Name: cashier_session_one_open_user; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX cashier_session_one_open_user ON public.cashier_session USING btree (tenant_id, user_id) WHERE (closed_at IS NULL);


--
-- Name: cashier_session_one_use_approval; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX cashier_session_one_use_approval ON public.cashier_session USING btree (tenant_id, approval_request_id) WHERE (approval_request_id IS NOT NULL);


--
-- Name: cashier_session_property_history; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cashier_session_property_history ON public.cashier_session USING btree (tenant_id, property_node, business_date DESC, opened_at DESC, id);


--
-- Name: consumer_processed_age; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX consumer_processed_age ON public.consumer_processed USING brin (processed_at);


--
-- Name: contact_point_tenant_kind_value; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX contact_point_tenant_kind_value ON public.contact_point USING btree (tenant_id, kind, value, party_id);


--
-- Name: deposit_application_capture_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX deposit_application_capture_lookup ON public.deposit_application USING btree (tenant_id, capture_payment_id, created_at, id);


--
-- Name: deposit_application_folio_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX deposit_application_folio_lookup ON public.deposit_application USING btree (tenant_id, folio_id, created_at, id);


--
-- Name: deposit_application_operation_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX deposit_application_operation_lookup ON public.deposit_application USING btree (tenant_id, operation_id, created_at, id);


--
-- Name: discrepancy_unresolved_space_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX discrepancy_unresolved_space_unique ON public.discrepancy USING btree (tenant_id, space_id) WHERE (resolved_at IS NULL);


--
-- Name: document_subject; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_subject ON public.document USING btree (tenant_id, subject_type, subject_id);


--
-- Name: fact_bdate; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fact_bdate ON public.fact_log USING brin (business_date);


--
-- Name: fact_current; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fact_current ON public.fact_log USING btree (tenant_id, entity_type, entity_id, fact_type, recorded_at DESC);


--
-- Name: folio_no_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX folio_no_uq ON public.folio USING btree (tenant_id, folio_no) WHERE (folio_no IS NOT NULL);


--
-- Name: hold_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hold_expiry ON public.hold USING btree (expires_at) WHERE (status = 'active'::text);


--
-- Name: hosted_payment_request_expiry_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hosted_payment_request_expiry_lookup ON public.hosted_payment_request USING btree (tenant_id, expires_at, id) WHERE (revoked_at IS NULL);


--
-- Name: hosted_payment_request_folio_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hosted_payment_request_folio_lookup ON public.hosted_payment_request USING btree (tenant_id, folio_id, generation DESC, id);


--
-- Name: hosted_payment_request_operation_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hosted_payment_request_operation_lookup ON public.hosted_payment_request USING btree (tenant_id, operation_id, id);


--
-- Name: india_gst_final_component_tax_scope; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX india_gst_final_component_tax_scope ON public.india_gst_accommodation_final_component_tax USING btree (tenant_id, property_node, reservation_id, folio_id, generation DESC);


--
-- Name: india_gst_final_valuation_scope; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX india_gst_final_valuation_scope ON public.india_gst_accommodation_final_valuation USING btree (tenant_id, property_node, reservation_id, folio_id, generation DESC);


--
-- Name: india_gst_quoted_applicability_scope; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX india_gst_quoted_applicability_scope ON public.india_gst_accommodation_quoted_rate_applicability USING btree (tenant_id, property_node, reservation_id, folio_id, recorded_at, id);


--
-- Name: india_gst_valuation_allocation_night; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX india_gst_valuation_allocation_night ON public.india_gst_accommodation_valuation_allocation USING btree (tenant_id, valuation_id, ordinal, posting_root_id);


--
-- Name: india_gst_valuation_source_root; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX india_gst_valuation_source_root ON public.india_gst_accommodation_valuation_source USING btree (tenant_id, posting_root_id, valuation_id);


--
-- Name: journal_bdate; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX journal_bdate ON public.journal USING btree (tenant_id, property_node, business_date);


--
-- Name: journal_one_reversal; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX journal_one_reversal ON public.journal USING btree (tenant_id, reverses) WHERE (reverses IS NOT NULL);


--
-- Name: journal_one_use_approval; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX journal_one_use_approval ON public.journal USING btree (tenant_id, approval_request_id) WHERE (approval_request_id IS NOT NULL);


--
-- Name: message_thread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX message_thread ON public.message USING btree (tenant_id, thread_key, created_at);


--
-- Name: org_node_path_gist; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX org_node_path_gist ON public.org_node USING gist (tenant_id, path);


--
-- Name: outbox_unpublished; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX outbox_unpublished ON public.outbox USING btree (seq) WHERE (published_at IS NULL);


--
-- Name: party_fiscal_registration_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX party_fiscal_registration_lookup ON public.party_fiscal_registration USING btree (tenant_id, party_id, id, scheme);


--
-- Name: party_name_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX party_name_trgm ON public.party USING gin (display_name public.gin_trgm_ops);


--
-- Name: party_tenant_status_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX party_tenant_status_id ON public.party USING btree (tenant_id, status, id);


--
-- Name: payment_capture_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payment_capture_lookup ON public.payment USING btree (tenant_id, capture_payment_id) WHERE (capture_payment_id IS NOT NULL);


--
-- Name: payment_one_successful_capture; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX payment_one_successful_capture ON public.payment USING btree (tenant_id, operation_id) WHERE ((phase = 'capture'::text) AND (status = 'succeeded'::text));


--
-- Name: payment_operation_chain; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payment_operation_chain ON public.payment USING btree (tenant_id, operation_id, attempt_no, id);


--
-- Name: payment_operation_folio_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payment_operation_folio_lookup ON public.payment_operation USING btree (tenant_id, folio_id, created_at, id);


--
-- Name: payment_operation_instrument_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payment_operation_instrument_lookup ON public.payment_operation USING btree (tenant_id, instrument_id, created_at, id);


--
-- Name: payment_predecessor_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payment_predecessor_lookup ON public.payment USING btree (tenant_id, predecessor_payment_id) WHERE (predecessor_payment_id IS NOT NULL);


--
-- Name: posting_acct; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX posting_acct ON public.posting_line USING btree (tenant_id, account_id, business_date);


--
-- Name: posting_folio; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX posting_folio ON public.posting_line USING btree (tenant_id, folio_id) WHERE (folio_id IS NOT NULL);


--
-- Name: posting_line_transfer_root_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX posting_line_transfer_root_lookup ON public.posting_line USING btree (tenant_id, folio_transfer_root_line_id) WHERE (folio_transfer_root_line_id IS NOT NULL);


--
-- Name: property_fiscal_registration_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX property_fiscal_registration_lookup ON public.property_fiscal_registration USING btree (tenant_id, property_node, scheme, currency, jurisdiction_extension_id, jurisdiction_key, jurisdiction_version);


--
-- Name: provider_event_receipt_operation_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX provider_event_receipt_operation_lookup ON public.provider_event_receipt USING btree (tenant_id, operation_id, received_at, id);


--
-- Name: rate_current_contain; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rate_current_contain ON public.rate_price USING gist (tenant_id, rate_plan_id, unit_type_id, stay_dates) WHERE (superseded_by IS NULL);


--
-- Name: rate_current_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rate_current_lookup ON public.rate_price USING btree (tenant_id, rate_plan_id, unit_type_id, recorded_at DESC) WHERE (superseded_by IS NULL);


--
-- Name: rate_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rate_lookup ON public.rate_price USING btree (tenant_id, rate_plan_id, unit_type_id, recorded_at DESC);


--
-- Name: reservation_board; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reservation_board ON public.reservation USING btree (tenant_id, property_node, status);


--
-- Name: segment_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX segment_period ON public.reservation_segment USING gist (tenant_id, period);


--
-- Name: so_slot; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX so_slot ON public.space_occupancy USING btree (tenant_id, slot_ref);


--
-- Name: so_space_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX so_space_period ON public.space_occupancy USING gist (tenant_id, space_id, period);


--
-- Name: space_attrs_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX space_attrs_gin ON public.space USING gin (attrs jsonb_path_ops);


--
-- Name: task_board; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX task_board ON public.task USING btree (tenant_id, property_node, kind, status, due_at);


--
-- Name: task_housekeeping_sheet_space_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX task_housekeeping_sheet_space_unique ON public.task USING btree (tenant_id, sheet_id, subject_id) WHERE ((kind = 'housekeeping'::text) AND (subject_type = 'space'::text) AND (sheet_id IS NOT NULL));


--
-- Name: task_sheet_property_date_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX task_sheet_property_date_unique ON public.task_sheet USING btree (tenant_id, property_node, sheet_date);


--
-- Name: tax_attribution_hold_binding_attribution_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tax_attribution_hold_binding_attribution_lookup ON public.tax_attribution_hold_binding USING btree (tenant_id, attribution_id, bound_at, id);


--
-- Name: tax_attribution_hold_binding_property_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tax_attribution_hold_binding_property_lookup ON public.tax_attribution_hold_binding USING btree (tenant_id, property_node, bound_at, id);


--
-- Name: tax_attribution_journal_binding_property_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tax_attribution_journal_binding_property_lookup ON public.tax_attribution_journal_binding USING btree (tenant_id, property_node, business_date, posted_at, id);


--
-- Name: tax_attribution_journal_binding_snapshot_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tax_attribution_journal_binding_snapshot_lookup ON public.tax_attribution_journal_binding USING btree (tenant_id, snapshot_hash, posted_at, id);


--
-- Name: tax_attribution_reservation_binding_attribution_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tax_attribution_reservation_binding_attribution_lookup ON public.tax_attribution_reservation_binding USING btree (tenant_id, attribution_id, linked_at, id);


--
-- Name: tax_attribution_reservation_binding_property_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tax_attribution_reservation_binding_property_lookup ON public.tax_attribution_reservation_binding USING btree (tenant_id, property_node, linked_at, id);


--
-- Name: tax_attribution_snapshot_property_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tax_attribution_snapshot_property_lookup ON public.tax_attribution_snapshot USING btree (tenant_id, property_node, recorded_at, id);


--
-- Name: tax_attribution_snapshot_quote_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tax_attribution_snapshot_quote_lookup ON public.tax_attribution_snapshot USING btree (tenant_id, origin_quote_hash, recorded_at, id);


--
-- Name: tax_semantic_route_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tax_semantic_route_lookup ON public.tax_semantic_route USING btree (tenant_id, property_node, currency, jurisdiction_extension_id, semantic_kind, semantic_code);


--
-- Name: travel_pickup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX travel_pickup ON public.travel_detail USING btree (tenant_id, scheduled_at) WHERE (pickup_requested AND (pickup_task_id IS NULL));


--
-- Name: trust_negative_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX trust_negative_owner ON public.trust_negative_authorization USING btree (tenant_id, owner_party_id, created_at DESC);


--
-- Name: vehicle_onsite; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vehicle_onsite ON public.vehicle USING btree (tenant_id, property_node) WHERE (exited_at IS NULL);


--
-- Name: vehicle_reg; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vehicle_reg ON public.vehicle USING btree (tenant_id, property_node, reg_no);


--
-- Name: posting_line journal_balanced; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER journal_balanced AFTER INSERT ON public.posting_line DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.assert_journal_balanced();


--
-- Name: journal journal_day_open; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER journal_day_open BEFORE INSERT ON public.journal FOR EACH ROW EXECUTE FUNCTION public.assert_day_open();


--
-- Name: posting_line posting_line_currency; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER posting_line_currency BEFORE INSERT ON public.posting_line FOR EACH ROW EXECUTE FUNCTION public.derive_posting_line_currency();


--
-- Name: account account_party_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT account_party_id_fkey FOREIGN KEY (party_id) REFERENCES public.party(id);


--
-- Name: account account_property_node_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT account_property_node_fkey FOREIGN KEY (property_node) REFERENCES public.org_node(id);


--
-- Name: account account_tenant_party_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT account_tenant_party_fk FOREIGN KEY (tenant_id, party_id) REFERENCES public.party(tenant_id, id);


--
-- Name: account account_tenant_property_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT account_tenant_property_fk FOREIGN KEY (tenant_id, property_node) REFERENCES public.org_node(tenant_id, id);


--
-- Name: address address_party_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.address
    ADD CONSTRAINT address_party_id_fkey FOREIGN KEY (party_id) REFERENCES public.party(id);


--
-- Name: api_client api_client_scope_node_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_client
    ADD CONSTRAINT api_client_scope_node_fkey FOREIGN KEY (scope_node) REFERENCES public.org_node(id);


--
-- Name: api_client api_client_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_client
    ADD CONSTRAINT api_client_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id);


--
-- Name: api_idempotency api_idempotency_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_idempotency
    ADD CONSTRAINT api_idempotency_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id);


--
-- Name: app_user app_user_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_user
    ADD CONSTRAINT app_user_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id);


--
-- Name: approval_request approval_request_decided_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_request
    ADD CONSTRAINT approval_request_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES public.app_user(id);


--
-- Name: approval_request approval_request_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_request
    ADD CONSTRAINT approval_request_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.app_user(id);


--
-- Name: ar_allocation ar_allocation_invoice_doc_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ar_allocation
    ADD CONSTRAINT ar_allocation_invoice_doc_fkey FOREIGN KEY (invoice_doc) REFERENCES public.document(id);


--
-- Name: ar_allocation ar_allocation_payment_journal_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ar_allocation
    ADD CONSTRAINT ar_allocation_payment_journal_fkey FOREIGN KEY (payment_journal) REFERENCES public.journal(id);


--
-- Name: automation automation_scope_node_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation
    ADD CONSTRAINT automation_scope_node_fkey FOREIGN KEY (scope_node) REFERENCES public.org_node(id);


--
-- Name: block_allotment block_allotment_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.block_allotment
    ADD CONSTRAINT block_allotment_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.reservation_group(id);


--
-- Name: block_allotment block_allotment_unit_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.block_allotment
    ADD CONSTRAINT block_allotment_unit_type_id_fkey FOREIGN KEY (unit_type_id) REFERENCES public.unit_type(id);


--
-- Name: business_day_discrepancy_carry business_day_discrepancy_carr_tenant_id_approval_request_i_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_day_discrepancy_carry
    ADD CONSTRAINT business_day_discrepancy_carr_tenant_id_approval_request_i_fkey FOREIGN KEY (tenant_id, approval_request_id) REFERENCES public.approval_request(tenant_id, id);


--
-- Name: business_day_discrepancy_carry business_day_discrepancy_carr_tenant_id_property_node_sour_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_day_discrepancy_carry
    ADD CONSTRAINT business_day_discrepancy_carr_tenant_id_property_node_sour_fkey FOREIGN KEY (tenant_id, property_node, source_business_date) REFERENCES public.business_day(tenant_id, property_node, business_date);


--
-- Name: business_day_discrepancy_carry business_day_discrepancy_carr_tenant_id_property_node_targ_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_day_discrepancy_carry
    ADD CONSTRAINT business_day_discrepancy_carr_tenant_id_property_node_targ_fkey FOREIGN KEY (tenant_id, property_node, target_business_date) REFERENCES public.business_day(tenant_id, property_node, business_date);


--
-- Name: business_day_discrepancy_carry business_day_discrepancy_carr_tenant_id_source_discrepancy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_day_discrepancy_carry
    ADD CONSTRAINT business_day_discrepancy_carr_tenant_id_source_discrepancy_fkey FOREIGN KEY (tenant_id, source_discrepancy_id) REFERENCES public.discrepancy(tenant_id, id);


--
-- Name: business_day_discrepancy_carry business_day_discrepancy_carr_tenant_id_target_discrepancy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_day_discrepancy_carry
    ADD CONSTRAINT business_day_discrepancy_carr_tenant_id_target_discrepancy_fkey FOREIGN KEY (tenant_id, target_discrepancy_id) REFERENCES public.discrepancy(tenant_id, id);


--
-- Name: business_day business_day_property_node_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_day
    ADD CONSTRAINT business_day_property_node_fkey FOREIGN KEY (property_node) REFERENCES public.org_node(id);


--
-- Name: business_day business_day_tenant_property_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_day
    ADD CONSTRAINT business_day_tenant_property_fk FOREIGN KEY (tenant_id, property_node) REFERENCES public.org_node(tenant_id, id);


--
-- Name: cash_drawer cash_drawer_account_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_drawer
    ADD CONSTRAINT cash_drawer_account_fk FOREIGN KEY (tenant_id, property_node, currency, account_id) REFERENCES public.account(tenant_id, property_node, currency, id);


--
-- Name: cash_drawer_denomination cash_drawer_denomination_drawer_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_drawer_denomination
    ADD CONSTRAINT cash_drawer_denomination_drawer_fk FOREIGN KEY (tenant_id, drawer_id) REFERENCES public.cash_drawer(tenant_id, id);


--
-- Name: cash_drawer cash_drawer_property_currency_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_drawer
    ADD CONSTRAINT cash_drawer_property_currency_fk FOREIGN KEY (tenant_id, property_node, currency) REFERENCES public.org_node(tenant_id, id, currency);


--
-- Name: cashier_count cashier_count_actor_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cashier_count
    ADD CONSTRAINT cashier_count_actor_fk FOREIGN KEY (tenant_id, counted_by) REFERENCES public.app_user(tenant_id, id);


--
-- Name: cashier_count cashier_count_drawer_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cashier_count
    ADD CONSTRAINT cashier_count_drawer_fk FOREIGN KEY (tenant_id, drawer_id) REFERENCES public.cash_drawer(tenant_id, id);


--
-- Name: cashier_count_line cashier_count_line_count_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cashier_count_line
    ADD CONSTRAINT cashier_count_line_count_fk FOREIGN KEY (tenant_id, count_id, session_id, drawer_id) REFERENCES public.cashier_count(tenant_id, id, session_id, drawer_id);


--
-- Name: cashier_count_line cashier_count_line_denomination_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cashier_count_line
    ADD CONSTRAINT cashier_count_line_denomination_fk FOREIGN KEY (tenant_id, drawer_id, denomination_minor) REFERENCES public.cash_drawer_denomination(tenant_id, drawer_id, unit_minor);


--
-- Name: cashier_count cashier_count_session_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cashier_count
    ADD CONSTRAINT cashier_count_session_fk FOREIGN KEY (tenant_id, session_id, drawer_id) REFERENCES public.cashier_session(tenant_id, id, drawer_id);


--
-- Name: cashier_session cashier_session_approval_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cashier_session
    ADD CONSTRAINT cashier_session_approval_fk FOREIGN KEY (tenant_id, approval_request_id) REFERENCES public.approval_request(tenant_id, id);


--
-- Name: cashier_session cashier_session_closed_by_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cashier_session
    ADD CONSTRAINT cashier_session_closed_by_fk FOREIGN KEY (tenant_id, closed_by) REFERENCES public.app_user(tenant_id, id);


--
-- Name: cashier_session cashier_session_closing_count_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cashier_session
    ADD CONSTRAINT cashier_session_closing_count_fk FOREIGN KEY (tenant_id, closing_count_id, id, drawer_id) REFERENCES public.cashier_count(tenant_id, id, session_id, drawer_id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: cashier_session cashier_session_drawer_currency_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cashier_session
    ADD CONSTRAINT cashier_session_drawer_currency_fk FOREIGN KEY (tenant_id, drawer_id, currency) REFERENCES public.cash_drawer(tenant_id, id, currency);


--
-- Name: cashier_session cashier_session_opened_by_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cashier_session
    ADD CONSTRAINT cashier_session_opened_by_fk FOREIGN KEY (tenant_id, user_id) REFERENCES public.app_user(tenant_id, id);


--
-- Name: cashier_session cashier_session_opening_count_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cashier_session
    ADD CONSTRAINT cashier_session_opening_count_fk FOREIGN KEY (tenant_id, opening_count_id, id, drawer_id) REFERENCES public.cashier_count(tenant_id, id, session_id, drawer_id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: cashier_session cashier_session_property_day_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cashier_session
    ADD CONSTRAINT cashier_session_property_day_fk FOREIGN KEY (tenant_id, property_node, business_date) REFERENCES public.business_day(tenant_id, property_node, business_date);


--
-- Name: cashier_session cashier_session_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cashier_session
    ADD CONSTRAINT cashier_session_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_user(id);


--
-- Name: channel_map channel_map_channel_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_map
    ADD CONSTRAINT channel_map_channel_code_fkey FOREIGN KEY (channel_code) REFERENCES public.channel(code);


--
-- Name: channel_map channel_map_property_node_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_map
    ADD CONSTRAINT channel_map_property_node_fkey FOREIGN KEY (property_node) REFERENCES public.org_node(id);


--
-- Name: consent consent_party_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent
    ADD CONSTRAINT consent_party_id_fkey FOREIGN KEY (party_id) REFERENCES public.party(id);


--
-- Name: contact_point contact_point_party_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_point
    ADD CONSTRAINT contact_point_party_id_fkey FOREIGN KEY (party_id) REFERENCES public.party(id);


--
-- Name: deposit_application deposit_application_actor_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deposit_application
    ADD CONSTRAINT deposit_application_actor_fk FOREIGN KEY (tenant_id, created_by) REFERENCES public.app_user(tenant_id, id);


--
-- Name: deposit_application deposit_application_capture_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deposit_application
    ADD CONSTRAINT deposit_application_capture_fk FOREIGN KEY (tenant_id, capture_payment_id, operation_id, currency, capture_phase, capture_status) REFERENCES public.payment(tenant_id, id, operation_id, currency, phase, status);


--
-- Name: deposit_application deposit_application_deposit_account_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deposit_application
    ADD CONSTRAINT deposit_application_deposit_account_fk FOREIGN KEY (tenant_id, property_node, currency, deposit_account_id) REFERENCES public.account(tenant_id, property_node, currency, id);


--
-- Name: deposit_application deposit_application_folio_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deposit_application
    ADD CONSTRAINT deposit_application_folio_fk FOREIGN KEY (tenant_id, guest_account_id, folio_id) REFERENCES public.folio(tenant_id, account_id, id);


--
-- Name: deposit_application deposit_application_guest_account_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deposit_application
    ADD CONSTRAINT deposit_application_guest_account_fk FOREIGN KEY (tenant_id, property_node, currency, guest_account_id) REFERENCES public.account(tenant_id, property_node, currency, id);


--
-- Name: deposit_application deposit_application_journal_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deposit_application
    ADD CONSTRAINT deposit_application_journal_fk FOREIGN KEY (tenant_id, journal_id, property_node, currency) REFERENCES public.journal(tenant_id, id, property_node, currency);


--
-- Name: deposit_application deposit_application_property_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deposit_application
    ADD CONSTRAINT deposit_application_property_fk FOREIGN KEY (tenant_id, property_node) REFERENCES public.org_node(tenant_id, id);


--
-- Name: deposit_application deposit_application_request_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deposit_application
    ADD CONSTRAINT deposit_application_request_fk FOREIGN KEY (tenant_id, hosted_request_id, property_node, folio_id, guest_account_id, operation_id, deposit_account_id, currency) REFERENCES public.hosted_payment_request(tenant_id, id, property_node, folio_id, guest_account_id, operation_id, deposit_account_id, currency);


--
-- Name: discrepancy discrepancy_space_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discrepancy
    ADD CONSTRAINT discrepancy_space_id_fkey FOREIGN KEY (space_id) REFERENCES public.space(id);


--
-- Name: document document_property_node_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document
    ADD CONSTRAINT document_property_node_fkey FOREIGN KEY (property_node) REFERENCES public.org_node(id);


--
-- Name: document document_series_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document
    ADD CONSTRAINT document_series_id_fkey FOREIGN KEY (series_id) REFERENCES public.document_series(id);


--
-- Name: document_series document_series_property_node_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_series
    ADD CONSTRAINT document_series_property_node_fkey FOREIGN KEY (property_node) REFERENCES public.org_node(id);


--
-- Name: erasure_request erasure_request_party_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.erasure_request
    ADD CONSTRAINT erasure_request_party_id_fkey FOREIGN KEY (party_id) REFERENCES public.party(id);


--
-- Name: extension extension_type_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.extension
    ADD CONSTRAINT extension_type_fkey FOREIGN KEY (type) REFERENCES public.extension_type(type);


--
-- Name: fact_log fact_log_supersedes_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fact_log
    ADD CONSTRAINT fact_log_supersedes_fkey FOREIGN KEY (supersedes) REFERENCES public.fact_log(id);


--
-- Name: fiscal_submission fiscal_submission_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fiscal_submission
    ADD CONSTRAINT fiscal_submission_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.document(id);


--
-- Name: folio folio_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.folio
    ADD CONSTRAINT folio_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.account(id);


--
-- Name: folio folio_reservation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.folio
    ADD CONSTRAINT folio_reservation_id_fkey FOREIGN KEY (reservation_id) REFERENCES public.reservation(id);


--
-- Name: folio folio_tenant_account_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.folio
    ADD CONSTRAINT folio_tenant_account_fk FOREIGN KEY (tenant_id, account_id) REFERENCES public.account(tenant_id, id);


--
-- Name: folio folio_tenant_reservation_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.folio
    ADD CONSTRAINT folio_tenant_reservation_fk FOREIGN KEY (tenant_id, reservation_id) REFERENCES public.reservation(tenant_id, id);


--
-- Name: reservation_group group_master_folio_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation_group
    ADD CONSTRAINT group_master_folio_fk FOREIGN KEY (master_folio) REFERENCES public.folio(id);


--
-- Name: hold hold_property_node_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hold
    ADD CONSTRAINT hold_property_node_fkey FOREIGN KEY (property_node) REFERENCES public.org_node(id);


--
-- Name: hold hold_sellable_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hold
    ADD CONSTRAINT hold_sellable_unit_id_fkey FOREIGN KEY (sellable_unit_id) REFERENCES public.sellable_unit(id);


--
-- Name: hosted_payment_request hosted_payment_request_actor_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hosted_payment_request
    ADD CONSTRAINT hosted_payment_request_actor_fk FOREIGN KEY (tenant_id, created_by) REFERENCES public.app_user(tenant_id, id);


--
-- Name: hosted_payment_request hosted_payment_request_folio_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hosted_payment_request
    ADD CONSTRAINT hosted_payment_request_folio_fk FOREIGN KEY (tenant_id, guest_account_id, folio_id) REFERENCES public.folio(tenant_id, account_id, id);


--
-- Name: hosted_payment_request hosted_payment_request_operation_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hosted_payment_request
    ADD CONSTRAINT hosted_payment_request_operation_fk FOREIGN KEY (tenant_id, operation_id, property_node, folio_id, guest_account_id, currency, deposit_account_id, operation_purpose) REFERENCES public.payment_operation(tenant_id, id, property_node, folio_id, guest_account_id, currency, deposit_account_id, purpose);


--
-- Name: hosted_payment_request hosted_payment_request_property_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hosted_payment_request
    ADD CONSTRAINT hosted_payment_request_property_fk FOREIGN KEY (tenant_id, property_node) REFERENCES public.org_node(tenant_id, id);


--
-- Name: identity_document identity_document_party_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.identity_document
    ADD CONSTRAINT identity_document_party_id_fkey FOREIGN KEY (party_id) REFERENCES public.party(id);


--
-- Name: inbound_message inbound_message_channel_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inbound_message
    ADD CONSTRAINT inbound_message_channel_code_fkey FOREIGN KEY (channel_code) REFERENCES public.channel(code);


--
-- Name: india_gst_accommodation_final_component_tax india_gst_accommodation_final_c_tenant_id_applicability_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_final_component_tax
    ADD CONSTRAINT india_gst_accommodation_final_c_tenant_id_applicability_id_fkey FOREIGN KEY (tenant_id, applicability_id) REFERENCES public.india_gst_accommodation_quoted_rate_applicability(tenant_id, id);


--
-- Name: india_gst_accommodation_final_component_tax india_gst_accommodation_final_com_tenant_id_reservation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_final_component_tax
    ADD CONSTRAINT india_gst_accommodation_final_com_tenant_id_reservation_id_fkey FOREIGN KEY (tenant_id, reservation_id) REFERENCES public.reservation(tenant_id, id);


--
-- Name: india_gst_accommodation_final_component_tax india_gst_accommodation_final_comp_tenant_id_property_node_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_final_component_tax
    ADD CONSTRAINT india_gst_accommodation_final_comp_tenant_id_property_node_fkey FOREIGN KEY (tenant_id, property_node) REFERENCES public.org_node(tenant_id, id);


--
-- Name: india_gst_accommodation_final_component_tax india_gst_accommodation_final_compo_tenant_id_valuation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_final_component_tax
    ADD CONSTRAINT india_gst_accommodation_final_compo_tenant_id_valuation_id_fkey FOREIGN KEY (tenant_id, valuation_id) REFERENCES public.india_gst_accommodation_final_valuation(tenant_id, id);


--
-- Name: india_gst_accommodation_final_component_tax_room_night india_gst_accommodation_final_component_t_tenant_id_tax_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_final_component_tax_room_night
    ADD CONSTRAINT india_gst_accommodation_final_component_t_tenant_id_tax_id_fkey FOREIGN KEY (tenant_id, tax_id) REFERENCES public.india_gst_accommodation_final_component_tax(tenant_id, id);


--
-- Name: india_gst_accommodation_final_component_tax india_gst_accommodation_final_component_tenant_id_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_final_component_tax
    ADD CONSTRAINT india_gst_accommodation_final_component_tenant_id_actor_id_fkey FOREIGN KEY (tenant_id, actor_id) REFERENCES public.app_user(tenant_id, id);


--
-- Name: india_gst_accommodation_final_component_tax india_gst_accommodation_final_component_tenant_id_folio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_final_component_tax
    ADD CONSTRAINT india_gst_accommodation_final_component_tenant_id_folio_id_fkey FOREIGN KEY (tenant_id, folio_id) REFERENCES public.folio(tenant_id, id);


--
-- Name: india_gst_accommodation_final_valuation india_gst_accommodation_final_tenant_id_approval_request_i_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_final_valuation
    ADD CONSTRAINT india_gst_accommodation_final_tenant_id_approval_request_i_fkey FOREIGN KEY (tenant_id, approval_request_id) REFERENCES public.approval_request(tenant_id, id);


--
-- Name: india_gst_accommodation_final_component_tax india_gst_accommodation_final_tenant_id_supersedes_tax_id__fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_final_component_tax
    ADD CONSTRAINT india_gst_accommodation_final_tenant_id_supersedes_tax_id__fkey FOREIGN KEY (tenant_id, supersedes_tax_id, supersedes_tax_evidence_hash) REFERENCES public.india_gst_accommodation_final_component_tax(tenant_id, id, evidence_hash);


--
-- Name: india_gst_accommodation_final_valuation india_gst_accommodation_final_tenant_id_supersedes_valuati_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_final_valuation
    ADD CONSTRAINT india_gst_accommodation_final_tenant_id_supersedes_valuati_fkey FOREIGN KEY (tenant_id, supersedes_valuation_id) REFERENCES public.india_gst_accommodation_final_valuation(tenant_id, id);


--
-- Name: india_gst_accommodation_final_component_tax_component india_gst_accommodation_final_tenant_id_tax_id_room_night__fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_final_component_tax_component
    ADD CONSTRAINT india_gst_accommodation_final_tenant_id_tax_id_room_night__fkey FOREIGN KEY (tenant_id, tax_id, room_night_ordinal) REFERENCES public.india_gst_accommodation_final_component_tax_room_night(tenant_id, tax_id, ordinal);


--
-- Name: india_gst_accommodation_final_valuation india_gst_accommodation_final_v_tenant_id_folio_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_final_valuation
    ADD CONSTRAINT india_gst_accommodation_final_v_tenant_id_folio_account_id_fkey FOREIGN KEY (tenant_id, folio_account_id) REFERENCES public.account(tenant_id, id);


--
-- Name: india_gst_accommodation_final_valuation india_gst_accommodation_final_val_tenant_id_attribution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_final_valuation
    ADD CONSTRAINT india_gst_accommodation_final_val_tenant_id_attribution_id_fkey FOREIGN KEY (tenant_id, attribution_id) REFERENCES public.tax_attribution_snapshot(tenant_id, id);


--
-- Name: india_gst_accommodation_final_valuation india_gst_accommodation_final_val_tenant_id_buyer_party_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_final_valuation
    ADD CONSTRAINT india_gst_accommodation_final_val_tenant_id_buyer_party_id_fkey FOREIGN KEY (tenant_id, buyer_party_id) REFERENCES public.party(tenant_id, id);


--
-- Name: india_gst_accommodation_final_valuation india_gst_accommodation_final_val_tenant_id_reservation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_final_valuation
    ADD CONSTRAINT india_gst_accommodation_final_val_tenant_id_reservation_id_fkey FOREIGN KEY (tenant_id, reservation_id) REFERENCES public.reservation(tenant_id, id);


--
-- Name: india_gst_accommodation_final_valuation india_gst_accommodation_final_valu_tenant_id_property_node_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_final_valuation
    ADD CONSTRAINT india_gst_accommodation_final_valu_tenant_id_property_node_fkey FOREIGN KEY (tenant_id, property_node) REFERENCES public.org_node(tenant_id, id);


--
-- Name: india_gst_accommodation_final_valuation india_gst_accommodation_final_valuat_tenant_id_attested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_final_valuation
    ADD CONSTRAINT india_gst_accommodation_final_valuat_tenant_id_attested_by_fkey FOREIGN KEY (tenant_id, attested_by) REFERENCES public.app_user(tenant_id, id);


--
-- Name: india_gst_accommodation_final_valuation india_gst_accommodation_final_valuation_tenant_id_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_final_valuation
    ADD CONSTRAINT india_gst_accommodation_final_valuation_tenant_id_actor_id_fkey FOREIGN KEY (tenant_id, actor_id) REFERENCES public.app_user(tenant_id, id);


--
-- Name: india_gst_accommodation_final_valuation india_gst_accommodation_final_valuation_tenant_id_folio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_final_valuation
    ADD CONSTRAINT india_gst_accommodation_final_valuation_tenant_id_folio_id_fkey FOREIGN KEY (tenant_id, folio_id) REFERENCES public.folio(tenant_id, id);


--
-- Name: india_gst_accommodation_invoice_issue_snapshot india_gst_accommodation_invoice_issue_service_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_invoice_issue_snapshot
    ADD CONSTRAINT india_gst_accommodation_invoice_issue_service_fk FOREIGN KEY (tenant_id, service_provision_snapshot_id) REFERENCES public.india_gst_accommodation_service_provision_snapshot(tenant_id, id);


--
-- Name: india_gst_accommodation_payment_receipt_snapshot india_gst_accommodation_payment_receipt_service_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_payment_receipt_snapshot
    ADD CONSTRAINT india_gst_accommodation_payment_receipt_service_fk FOREIGN KEY (tenant_id, service_provision_snapshot_id) REFERENCES public.india_gst_accommodation_service_provision_snapshot(tenant_id, id);


--
-- Name: india_gst_accommodation_quoted_rate_applicability india_gst_accommodation_quote_family_jurisdiction_extensio_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_quoted_rate_applicability
    ADD CONSTRAINT india_gst_accommodation_quote_family_jurisdiction_extensio_fkey FOREIGN KEY (family_jurisdiction_extension_id) REFERENCES public.extension(id);


--
-- Name: india_gst_accommodation_quoted_rate_component india_gst_accommodation_quote_tenant_id_applicability_id_r_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_quoted_rate_component
    ADD CONSTRAINT india_gst_accommodation_quote_tenant_id_applicability_id_r_fkey FOREIGN KEY (tenant_id, applicability_id, room_night_ordinal) REFERENCES public.india_gst_accommodation_quoted_rate_applicability_room_night(tenant_id, applicability_id, ordinal);


--
-- Name: india_gst_accommodation_quoted_rate_applicability india_gst_accommodation_quote_tenant_id_final_valuation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_quoted_rate_applicability
    ADD CONSTRAINT india_gst_accommodation_quote_tenant_id_final_valuation_id_fkey FOREIGN KEY (tenant_id, final_valuation_id) REFERENCES public.india_gst_accommodation_final_valuation(tenant_id, id);


--
-- Name: india_gst_accommodation_quoted_rate_applicability india_gst_accommodation_quote_tenant_id_invoice_issue_snap_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_quoted_rate_applicability
    ADD CONSTRAINT india_gst_accommodation_quote_tenant_id_invoice_issue_snap_fkey FOREIGN KEY (tenant_id, invoice_issue_snapshot_id) REFERENCES public.india_gst_accommodation_invoice_issue_snapshot(tenant_id, id);


--
-- Name: india_gst_accommodation_quoted_rate_applicability india_gst_accommodation_quote_tenant_id_payment_receipt_sn_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_quoted_rate_applicability
    ADD CONSTRAINT india_gst_accommodation_quote_tenant_id_payment_receipt_sn_fkey FOREIGN KEY (tenant_id, payment_receipt_snapshot_id) REFERENCES public.india_gst_accommodation_payment_receipt_snapshot(tenant_id, id);


--
-- Name: india_gst_accommodation_quoted_rate_applicability india_gst_accommodation_quote_tenant_id_recipient_party_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_quoted_rate_applicability
    ADD CONSTRAINT india_gst_accommodation_quote_tenant_id_recipient_party_id_fkey FOREIGN KEY (tenant_id, recipient_party_id) REFERENCES public.party(tenant_id, id);


--
-- Name: india_gst_accommodation_quoted_rate_applicability india_gst_accommodation_quote_tenant_id_recipient_sez_stat_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_quoted_rate_applicability
    ADD CONSTRAINT india_gst_accommodation_quote_tenant_id_recipient_sez_stat_fkey FOREIGN KEY (tenant_id, recipient_sez_status_id) REFERENCES public.india_gst_recipient_sez_status(tenant_id, id);


--
-- Name: india_gst_accommodation_quoted_rate_applicability india_gst_accommodation_quote_tenant_id_reservation_lineag_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_quoted_rate_applicability
    ADD CONSTRAINT india_gst_accommodation_quote_tenant_id_reservation_lineag_fkey FOREIGN KEY (tenant_id, reservation_lineage_id) REFERENCES public.tax_attribution_reservation_binding(tenant_id, id);


--
-- Name: india_gst_accommodation_quoted_rate_applicability india_gst_accommodation_quote_tenant_id_service_provision__fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_quoted_rate_applicability
    ADD CONSTRAINT india_gst_accommodation_quote_tenant_id_service_provision__fkey FOREIGN KEY (tenant_id, service_provision_snapshot_id) REFERENCES public.india_gst_accommodation_service_provision_snapshot(tenant_id, id);


--
-- Name: india_gst_accommodation_quoted_rate_applicability india_gst_accommodation_quote_tenant_id_supplier_service_l_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_quoted_rate_applicability
    ADD CONSTRAINT india_gst_accommodation_quote_tenant_id_supplier_service_l_fkey FOREIGN KEY (tenant_id, supplier_service_location_id) REFERENCES public.india_gst_supplier_service_location(tenant_id, id);


--
-- Name: india_gst_accommodation_quoted_rate_applicability india_gst_accommodation_quote_tenant_id_supplier_sez_statu_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_quoted_rate_applicability
    ADD CONSTRAINT india_gst_accommodation_quote_tenant_id_supplier_sez_statu_fkey FOREIGN KEY (tenant_id, supplier_sez_status_id) REFERENCES public.india_gst_supplier_sez_status(tenant_id, id);


--
-- Name: india_gst_accommodation_quoted_rate_applicability_room_night india_gst_accommodation_quoted__tenant_id_applicability_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_quoted_rate_applicability_room_night
    ADD CONSTRAINT india_gst_accommodation_quoted__tenant_id_applicability_id_fkey FOREIGN KEY (tenant_id, applicability_id) REFERENCES public.india_gst_accommodation_quoted_rate_applicability(tenant_id, id);


--
-- Name: india_gst_accommodation_quoted_rate_applicability india_gst_accommodation_quoted_ra_tenant_id_attribution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_quoted_rate_applicability
    ADD CONSTRAINT india_gst_accommodation_quoted_ra_tenant_id_attribution_id_fkey FOREIGN KEY (tenant_id, attribution_id) REFERENCES public.tax_attribution_snapshot(tenant_id, id);


--
-- Name: india_gst_accommodation_quoted_rate_applicability india_gst_accommodation_quoted_ra_tenant_id_reservation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_quoted_rate_applicability
    ADD CONSTRAINT india_gst_accommodation_quoted_ra_tenant_id_reservation_id_fkey FOREIGN KEY (tenant_id, reservation_id) REFERENCES public.reservation(tenant_id, id);


--
-- Name: india_gst_accommodation_quoted_rate_applicability india_gst_accommodation_quoted_rat_tenant_id_property_node_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_quoted_rate_applicability
    ADD CONSTRAINT india_gst_accommodation_quoted_rat_tenant_id_property_node_fkey FOREIGN KEY (tenant_id, property_node) REFERENCES public.org_node(tenant_id, id);


--
-- Name: india_gst_accommodation_quoted_rate_applicability india_gst_accommodation_quoted_rate_app_tenant_id_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_quoted_rate_applicability
    ADD CONSTRAINT india_gst_accommodation_quoted_rate_app_tenant_id_actor_id_fkey FOREIGN KEY (tenant_id, actor_id) REFERENCES public.app_user(tenant_id, id);


--
-- Name: india_gst_accommodation_quoted_rate_applicability india_gst_accommodation_quoted_rate_app_tenant_id_folio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_quoted_rate_applicability
    ADD CONSTRAINT india_gst_accommodation_quoted_rate_app_tenant_id_folio_id_fkey FOREIGN KEY (tenant_id, folio_id) REFERENCES public.folio(tenant_id, id);


--
-- Name: india_gst_accommodation_quoted_rate_applicability india_gst_accommodation_quoted_tenant_id_classification_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_quoted_rate_applicability
    ADD CONSTRAINT india_gst_accommodation_quoted_tenant_id_classification_id_fkey FOREIGN KEY (tenant_id, classification_id) REFERENCES public.india_gst_item_classification(tenant_id, id);


--
-- Name: india_gst_accommodation_service_provision_snapshot india_gst_accommodation_service_provision_lineage_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_service_provision_snapshot
    ADD CONSTRAINT india_gst_accommodation_service_provision_lineage_fk FOREIGN KEY (tenant_id, reservation_lineage_id, property_node, hold_binding_id, attribution_id, reservation_id, segment_id, origin_quote_hash, snapshot_hash, currency) REFERENCES public.tax_attribution_reservation_binding(tenant_id, id, property_node, binding_id, attribution_id, reservation_id, segment_id, origin_quote_hash, snapshot_hash, currency);


--
-- Name: india_gst_accommodation_valuation_allocation india_gst_accommodation_valua_tenant_id_valuation_id_ordin_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_valuation_allocation
    ADD CONSTRAINT india_gst_accommodation_valua_tenant_id_valuation_id_ordin_fkey FOREIGN KEY (tenant_id, valuation_id, ordinal) REFERENCES public.india_gst_accommodation_valuation_room_night(tenant_id, valuation_id, ordinal);


--
-- Name: india_gst_accommodation_valuation_allocation india_gst_accommodation_valua_tenant_id_valuation_id_posti_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_valuation_allocation
    ADD CONSTRAINT india_gst_accommodation_valua_tenant_id_valuation_id_posti_fkey FOREIGN KEY (tenant_id, valuation_id, posting_root_id) REFERENCES public.india_gst_accommodation_valuation_source(tenant_id, valuation_id, posting_root_id);


--
-- Name: india_gst_accommodation_valuation_source india_gst_accommodation_valuatio_tenant_id_posting_root_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_valuation_source
    ADD CONSTRAINT india_gst_accommodation_valuatio_tenant_id_posting_root_id_fkey FOREIGN KEY (tenant_id, posting_root_id) REFERENCES public.posting_line(tenant_id, id);


--
-- Name: india_gst_accommodation_valuation_room_night india_gst_accommodation_valuation_r_tenant_id_valuation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_valuation_room_night
    ADD CONSTRAINT india_gst_accommodation_valuation_r_tenant_id_valuation_id_fkey FOREIGN KEY (tenant_id, valuation_id) REFERENCES public.india_gst_accommodation_final_valuation(tenant_id, id);


--
-- Name: india_gst_accommodation_valuation_source india_gst_accommodation_valuation_s_tenant_id_valuation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_valuation_source
    ADD CONSTRAINT india_gst_accommodation_valuation_s_tenant_id_valuation_id_fkey FOREIGN KEY (tenant_id, valuation_id) REFERENCES public.india_gst_accommodation_final_valuation(tenant_id, id);


--
-- Name: india_gst_accommodation_valuation_source india_gst_accommodation_valuation_so_tenant_id_attested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_valuation_source
    ADD CONSTRAINT india_gst_accommodation_valuation_so_tenant_id_attested_by_fkey FOREIGN KEY (tenant_id, attested_by) REFERENCES public.app_user(tenant_id, id);


--
-- Name: india_gst_accommodation_valuation_source india_gst_accommodation_valuation_source_tx_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_accommodation_valuation_source
    ADD CONSTRAINT india_gst_accommodation_valuation_source_tx_code_fkey FOREIGN KEY (tx_code) REFERENCES public.tx_code(code);


--
-- Name: india_gst_item_classification india_gst_item_classification_extension_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_item_classification
    ADD CONSTRAINT india_gst_item_classification_extension_fk FOREIGN KEY (jurisdiction_extension_id) REFERENCES public.extension(id);


--
-- Name: india_gst_item_classification india_gst_item_classification_property_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_item_classification
    ADD CONSTRAINT india_gst_item_classification_property_fk FOREIGN KEY (tenant_id, property_node) REFERENCES public.org_node(tenant_id, id);


--
-- Name: india_gst_recipient_sez_status india_gst_recipient_sez_status_registration_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_recipient_sez_status
    ADD CONSTRAINT india_gst_recipient_sez_status_registration_fk FOREIGN KEY (tenant_id, recipient_registration_id) REFERENCES public.party_fiscal_registration(tenant_id, id);


--
-- Name: india_gst_supplier_registration_status_snapshot india_gst_supplier_registration_status_snapshot_registration_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_supplier_registration_status_snapshot
    ADD CONSTRAINT india_gst_supplier_registration_status_snapshot_registration_fk FOREIGN KEY (tenant_id, supplier_registration_id) REFERENCES public.property_fiscal_registration(tenant_id, id);


--
-- Name: india_gst_supplier_service_location india_gst_supplier_service_location_registration_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_supplier_service_location
    ADD CONSTRAINT india_gst_supplier_service_location_registration_fk FOREIGN KEY (tenant_id, supplier_registration_id) REFERENCES public.property_fiscal_registration(tenant_id, id);


--
-- Name: india_gst_supplier_sez_status india_gst_supplier_sez_status_registration_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_gst_supplier_sez_status
    ADD CONSTRAINT india_gst_supplier_sez_status_registration_fk FOREIGN KEY (tenant_id, supplier_registration_id) REFERENCES public.property_fiscal_registration(tenant_id, id);


--
-- Name: india_sez_unit_loa_renewal india_sez_unit_loa_renewal_supplier_status_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.india_sez_unit_loa_renewal
    ADD CONSTRAINT india_sez_unit_loa_renewal_supplier_status_fk FOREIGN KEY (tenant_id, supplier_sez_status_id) REFERENCES public.india_gst_supplier_sez_status(tenant_id, id);


--
-- Name: inventory_authority inventory_authority_property_node_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_authority
    ADD CONSTRAINT inventory_authority_property_node_fkey FOREIGN KEY (property_node) REFERENCES public.org_node(id);


--
-- Name: journal journal_approval_request_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal
    ADD CONSTRAINT journal_approval_request_fk FOREIGN KEY (tenant_id, approval_request_id) REFERENCES public.approval_request(tenant_id, id);


--
-- Name: journal journal_property_node_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal
    ADD CONSTRAINT journal_property_node_fkey FOREIGN KEY (property_node) REFERENCES public.org_node(id);


--
-- Name: journal journal_reverses_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal
    ADD CONSTRAINT journal_reverses_fkey FOREIGN KEY (reverses) REFERENCES public.journal(id);


--
-- Name: journal journal_tenant_business_day_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal
    ADD CONSTRAINT journal_tenant_business_day_fk FOREIGN KEY (tenant_id, property_node, business_date) REFERENCES public.business_day(tenant_id, property_node, business_date);


--
-- Name: journal journal_tenant_property_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal
    ADD CONSTRAINT journal_tenant_property_fk FOREIGN KEY (tenant_id, property_node) REFERENCES public.org_node(tenant_id, id);


--
-- Name: journal journal_tenant_reverses_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal
    ADD CONSTRAINT journal_tenant_reverses_fk FOREIGN KEY (tenant_id, reverses) REFERENCES public.journal(tenant_id, id);


--
-- Name: membership membership_party_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.membership
    ADD CONSTRAINT membership_party_id_fkey FOREIGN KEY (party_id) REFERENCES public.party(id);


--
-- Name: message message_party_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message
    ADD CONSTRAINT message_party_id_fkey FOREIGN KEY (party_id) REFERENCES public.party(id);


--
-- Name: message message_reservation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message
    ADD CONSTRAINT message_reservation_id_fkey FOREIGN KEY (reservation_id) REFERENCES public.reservation(id);


--
-- Name: negotiated_rate negotiated_rate_party_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.negotiated_rate
    ADD CONSTRAINT negotiated_rate_party_id_fkey FOREIGN KEY (party_id) REFERENCES public.party(id);


--
-- Name: negotiated_rate negotiated_rate_rate_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.negotiated_rate
    ADD CONSTRAINT negotiated_rate_rate_plan_id_fkey FOREIGN KEY (rate_plan_id) REFERENCES public.rate_plan(id);


--
-- Name: ooo_oos ooo_oos_space_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ooo_oos
    ADD CONSTRAINT ooo_oos_space_id_fkey FOREIGN KEY (space_id) REFERENCES public.space(id);


--
-- Name: ooo_oos ooo_oos_work_order_task_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ooo_oos
    ADD CONSTRAINT ooo_oos_work_order_task_fkey FOREIGN KEY (work_order_task) REFERENCES public.task(id);


--
-- Name: org_node org_node_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_node
    ADD CONSTRAINT org_node_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id);


--
-- Name: overbooking_limit overbooking_limit_property_node_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.overbooking_limit
    ADD CONSTRAINT overbooking_limit_property_node_fkey FOREIGN KEY (property_node) REFERENCES public.org_node(id);


--
-- Name: overbooking_limit overbooking_limit_unit_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.overbooking_limit
    ADD CONSTRAINT overbooking_limit_unit_type_id_fkey FOREIGN KEY (unit_type_id) REFERENCES public.unit_type(id);


--
-- Name: package_element package_element_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.package_element
    ADD CONSTRAINT package_element_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.package(id);


--
-- Name: party_fiscal_registration party_fiscal_registration_party_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.party_fiscal_registration
    ADD CONSTRAINT party_fiscal_registration_party_fk FOREIGN KEY (tenant_id, party_id) REFERENCES public.party(tenant_id, id);


--
-- Name: party party_merged_into_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.party
    ADD CONSTRAINT party_merged_into_fkey FOREIGN KEY (merged_into) REFERENCES public.party(id);


--
-- Name: party_relationship party_relationship_from_party_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.party_relationship
    ADD CONSTRAINT party_relationship_from_party_fkey FOREIGN KEY (from_party) REFERENCES public.party(id);


--
-- Name: party_relationship party_relationship_to_party_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.party_relationship
    ADD CONSTRAINT party_relationship_to_party_fkey FOREIGN KEY (to_party) REFERENCES public.party(id);


--
-- Name: party_role party_role_party_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.party_role
    ADD CONSTRAINT party_role_party_id_fkey FOREIGN KEY (party_id) REFERENCES public.party(id);


--
-- Name: payment payment_capture_journal_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment
    ADD CONSTRAINT payment_capture_journal_tenant_fk FOREIGN KEY (tenant_id, capture_journal_id) REFERENCES public.journal(tenant_id, id);


--
-- Name: payment payment_capture_payment_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment
    ADD CONSTRAINT payment_capture_payment_tenant_fk FOREIGN KEY (tenant_id, capture_payment_id) REFERENCES public.payment(tenant_id, id);


--
-- Name: payment payment_instrument_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment
    ADD CONSTRAINT payment_instrument_id_fkey FOREIGN KEY (instrument_id) REFERENCES public.payment_instrument(id);


--
-- Name: payment_instrument payment_instrument_party_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_instrument
    ADD CONSTRAINT payment_instrument_party_id_fkey FOREIGN KEY (party_id) REFERENCES public.party(id);


--
-- Name: payment payment_instrument_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment
    ADD CONSTRAINT payment_instrument_tenant_fk FOREIGN KEY (tenant_id, instrument_id) REFERENCES public.payment_instrument(tenant_id, id);


--
-- Name: payment payment_journal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment
    ADD CONSTRAINT payment_journal_id_fkey FOREIGN KEY (journal_id) REFERENCES public.journal(id);


--
-- Name: payment payment_journal_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment
    ADD CONSTRAINT payment_journal_tenant_fk FOREIGN KEY (tenant_id, journal_id) REFERENCES public.journal(tenant_id, id);


--
-- Name: payment_operation payment_operation_actor_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_operation
    ADD CONSTRAINT payment_operation_actor_fk FOREIGN KEY (tenant_id, actor_id) REFERENCES public.app_user(tenant_id, id);


--
-- Name: payment_operation payment_operation_clearing_account_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_operation
    ADD CONSTRAINT payment_operation_clearing_account_fk FOREIGN KEY (tenant_id, property_node, currency, clearing_account_id) REFERENCES public.account(tenant_id, property_node, currency, id);


--
-- Name: payment_operation payment_operation_deposit_account_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_operation
    ADD CONSTRAINT payment_operation_deposit_account_fk FOREIGN KEY (tenant_id, property_node, currency, deposit_account_id) REFERENCES public.account(tenant_id, property_node, currency, id);


--
-- Name: payment payment_operation_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment
    ADD CONSTRAINT payment_operation_fk FOREIGN KEY (tenant_id, operation_id, currency) REFERENCES public.payment_operation(tenant_id, id, currency);


--
-- Name: payment_operation payment_operation_folio_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_operation
    ADD CONSTRAINT payment_operation_folio_fk FOREIGN KEY (tenant_id, guest_account_id, folio_id) REFERENCES public.folio(tenant_id, account_id, id);


--
-- Name: payment_operation payment_operation_guest_account_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_operation
    ADD CONSTRAINT payment_operation_guest_account_fk FOREIGN KEY (tenant_id, property_node, currency, guest_account_id) REFERENCES public.account(tenant_id, property_node, currency, id);


--
-- Name: payment_operation payment_operation_instrument_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_operation
    ADD CONSTRAINT payment_operation_instrument_fk FOREIGN KEY (tenant_id, instrument_id) REFERENCES public.payment_instrument(tenant_id, id);


--
-- Name: payment_operation payment_operation_property_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_operation
    ADD CONSTRAINT payment_operation_property_fk FOREIGN KEY (tenant_id, property_node) REFERENCES public.org_node(tenant_id, id);


--
-- Name: payment_operation payment_operation_tx_code_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_operation
    ADD CONSTRAINT payment_operation_tx_code_fk FOREIGN KEY (tx_code) REFERENCES public.tx_code(code);


--
-- Name: payment payment_predecessor_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment
    ADD CONSTRAINT payment_predecessor_tenant_fk FOREIGN KEY (tenant_id, predecessor_payment_id) REFERENCES public.payment(tenant_id, id);


--
-- Name: payment payment_receipt_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment
    ADD CONSTRAINT payment_receipt_tenant_fk FOREIGN KEY (tenant_id, receipt_id) REFERENCES public.provider_event_receipt(tenant_id, id);


--
-- Name: posting_line posting_line_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posting_line
    ADD CONSTRAINT posting_line_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.account(id);


--
-- Name: posting_line posting_line_folio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posting_line
    ADD CONSTRAINT posting_line_folio_id_fkey FOREIGN KEY (folio_id) REFERENCES public.folio(id);


--
-- Name: posting_line posting_line_journal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posting_line
    ADD CONSTRAINT posting_line_journal_id_fkey FOREIGN KEY (journal_id) REFERENCES public.journal(id);


--
-- Name: posting_line posting_line_tenant_account_currency_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posting_line
    ADD CONSTRAINT posting_line_tenant_account_currency_fk FOREIGN KEY (tenant_id, account_id, currency) REFERENCES public.account(tenant_id, id, currency);


--
-- Name: posting_line posting_line_tenant_account_folio_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posting_line
    ADD CONSTRAINT posting_line_tenant_account_folio_fk FOREIGN KEY (tenant_id, account_id, folio_id) REFERENCES public.folio(tenant_id, account_id, id);


--
-- Name: posting_line posting_line_tenant_journal_date_currency_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posting_line
    ADD CONSTRAINT posting_line_tenant_journal_date_currency_fk FOREIGN KEY (tenant_id, journal_id, business_date, currency) REFERENCES public.journal(tenant_id, id, business_date, currency);


--
-- Name: posting_line posting_line_transfer_root_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posting_line
    ADD CONSTRAINT posting_line_transfer_root_fk FOREIGN KEY (tenant_id, folio_transfer_root_line_id) REFERENCES public.posting_line(tenant_id, id);


--
-- Name: posting_line posting_line_tx_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posting_line
    ADD CONSTRAINT posting_line_tx_code_fkey FOREIGN KEY (tx_code) REFERENCES public.tx_code(code);


--
-- Name: preference preference_party_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.preference
    ADD CONSTRAINT preference_party_id_fkey FOREIGN KEY (party_id) REFERENCES public.party(id);


--
-- Name: property_fiscal_location property_fiscal_location_property_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_fiscal_location
    ADD CONSTRAINT property_fiscal_location_property_fk FOREIGN KEY (tenant_id, property_node) REFERENCES public.org_node(tenant_id, id);


--
-- Name: property_fiscal_registration property_fiscal_registration_extension_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_fiscal_registration
    ADD CONSTRAINT property_fiscal_registration_extension_fk FOREIGN KEY (jurisdiction_extension_id) REFERENCES public.extension(id);


--
-- Name: property_fiscal_registration property_fiscal_registration_property_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_fiscal_registration
    ADD CONSTRAINT property_fiscal_registration_property_fk FOREIGN KEY (tenant_id, property_node) REFERENCES public.org_node(tenant_id, id);


--
-- Name: provider_event_receipt provider_event_receipt_operation_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_event_receipt
    ADD CONSTRAINT provider_event_receipt_operation_fk FOREIGN KEY (tenant_id, operation_id, currency) REFERENCES public.payment_operation(tenant_id, id, currency);


--
-- Name: push_cursor push_cursor_channel_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_cursor
    ADD CONSTRAINT push_cursor_channel_code_fkey FOREIGN KEY (channel_code) REFERENCES public.channel(code);


--
-- Name: queue_entry queue_entry_segment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.queue_entry
    ADD CONSTRAINT queue_entry_segment_id_fkey FOREIGN KEY (segment_id) REFERENCES public.reservation_segment(id);


--
-- Name: rate_plan rate_plan_cancellation_policy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_plan
    ADD CONSTRAINT rate_plan_cancellation_policy_fkey FOREIGN KEY (cancellation_policy) REFERENCES public.policy(id);


--
-- Name: rate_plan rate_plan_deposit_policy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_plan
    ADD CONSTRAINT rate_plan_deposit_policy_fkey FOREIGN KEY (deposit_policy) REFERENCES public.policy(id);


--
-- Name: rate_plan rate_plan_guarantee_policy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_plan
    ADD CONSTRAINT rate_plan_guarantee_policy_fkey FOREIGN KEY (guarantee_policy) REFERENCES public.policy(id);


--
-- Name: rate_plan_package rate_plan_package_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_plan_package
    ADD CONSTRAINT rate_plan_package_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.package(id);


--
-- Name: rate_plan_package rate_plan_package_rate_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_plan_package
    ADD CONSTRAINT rate_plan_package_rate_plan_id_fkey FOREIGN KEY (rate_plan_id) REFERENCES public.rate_plan(id);


--
-- Name: rate_plan rate_plan_parent_plan_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_plan
    ADD CONSTRAINT rate_plan_parent_plan_fkey FOREIGN KEY (parent_plan) REFERENCES public.rate_plan(id);


--
-- Name: rate_plan rate_plan_property_node_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_plan
    ADD CONSTRAINT rate_plan_property_node_fkey FOREIGN KEY (property_node) REFERENCES public.org_node(id);


--
-- Name: rate_price rate_price_rate_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_price
    ADD CONSTRAINT rate_price_rate_plan_id_fkey FOREIGN KEY (rate_plan_id) REFERENCES public.rate_plan(id);


--
-- Name: rate_price rate_price_superseded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_price
    ADD CONSTRAINT rate_price_superseded_by_fkey FOREIGN KEY (superseded_by) REFERENCES public.rate_price(id);


--
-- Name: rate_price rate_price_unit_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_price
    ADD CONSTRAINT rate_price_unit_type_id_fkey FOREIGN KEY (unit_type_id) REFERENCES public.unit_type(id);


--
-- Name: reservation reservation_booker_party_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation
    ADD CONSTRAINT reservation_booker_party_fkey FOREIGN KEY (booker_party) REFERENCES public.party(id);


--
-- Name: reservation_group reservation_group_account_party_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation_group
    ADD CONSTRAINT reservation_group_account_party_fkey FOREIGN KEY (account_party) REFERENCES public.party(id);


--
-- Name: reservation reservation_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation
    ADD CONSTRAINT reservation_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.reservation_group(id);


--
-- Name: reservation_group reservation_group_property_node_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation_group
    ADD CONSTRAINT reservation_group_property_node_fkey FOREIGN KEY (property_node) REFERENCES public.org_node(id);


--
-- Name: reservation reservation_guarantee_policy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation
    ADD CONSTRAINT reservation_guarantee_policy_fkey FOREIGN KEY (guarantee_policy) REFERENCES public.policy(id);


--
-- Name: reservation_guest reservation_guest_party_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation_guest
    ADD CONSTRAINT reservation_guest_party_id_fkey FOREIGN KEY (party_id) REFERENCES public.party(id);


--
-- Name: reservation_guest reservation_guest_reservation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation_guest
    ADD CONSTRAINT reservation_guest_reservation_id_fkey FOREIGN KEY (reservation_id) REFERENCES public.reservation(id);


--
-- Name: reservation reservation_primary_party_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation
    ADD CONSTRAINT reservation_primary_party_fkey FOREIGN KEY (primary_party) REFERENCES public.party(id);


--
-- Name: reservation reservation_property_node_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation
    ADD CONSTRAINT reservation_property_node_fkey FOREIGN KEY (property_node) REFERENCES public.org_node(id);


--
-- Name: reservation_segment reservation_segment_rate_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation_segment
    ADD CONSTRAINT reservation_segment_rate_plan_id_fkey FOREIGN KEY (rate_plan_id) REFERENCES public.rate_plan(id);


--
-- Name: reservation_segment reservation_segment_reservation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation_segment
    ADD CONSTRAINT reservation_segment_reservation_id_fkey FOREIGN KEY (reservation_id) REFERENCES public.reservation(id);


--
-- Name: reservation_segment reservation_segment_sellable_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation_segment
    ADD CONSTRAINT reservation_segment_sellable_unit_id_fkey FOREIGN KEY (sellable_unit_id) REFERENCES public.sellable_unit(id);


--
-- Name: reservation_segment reservation_segment_unit_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation_segment
    ADD CONSTRAINT reservation_segment_unit_type_id_fkey FOREIGN KEY (unit_type_id) REFERENCES public.unit_type(id);


--
-- Name: restriction restriction_rate_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restriction
    ADD CONSTRAINT restriction_rate_fk FOREIGN KEY (rate_plan_id) REFERENCES public.rate_plan(id);


--
-- Name: restriction restriction_scope_node_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restriction
    ADD CONSTRAINT restriction_scope_node_fkey FOREIGN KEY (scope_node) REFERENCES public.org_node(id);


--
-- Name: restriction restriction_unit_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restriction
    ADD CONSTRAINT restriction_unit_type_id_fkey FOREIGN KEY (unit_type_id) REFERENCES public.unit_type(id);


--
-- Name: role_permission role_permission_permission_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permission
    ADD CONSTRAINT role_permission_permission_code_fkey FOREIGN KEY (permission_code) REFERENCES public.permission(code);


--
-- Name: role_permission role_permission_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permission
    ADD CONSTRAINT role_permission_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.role(id);


--
-- Name: role role_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role
    ADD CONSTRAINT role_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id);


--
-- Name: sellable_unit_space sellable_unit_space_sellable_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sellable_unit_space
    ADD CONSTRAINT sellable_unit_space_sellable_unit_id_fkey FOREIGN KEY (sellable_unit_id) REFERENCES public.sellable_unit(id);


--
-- Name: sellable_unit_space sellable_unit_space_space_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sellable_unit_space
    ADD CONSTRAINT sellable_unit_space_space_id_fkey FOREIGN KEY (space_id) REFERENCES public.space(id);


--
-- Name: sellable_unit sellable_unit_unit_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sellable_unit
    ADD CONSTRAINT sellable_unit_unit_type_id_fkey FOREIGN KEY (unit_type_id) REFERENCES public.unit_type(id);


--
-- Name: space_occupancy space_occupancy_space_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.space_occupancy
    ADD CONSTRAINT space_occupancy_space_id_fkey FOREIGN KEY (space_id) REFERENCES public.space(id);


--
-- Name: space space_property_node_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.space
    ADD CONSTRAINT space_property_node_fkey FOREIGN KEY (property_node) REFERENCES public.org_node(id);


--
-- Name: space_relation space_relation_child_space_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.space_relation
    ADD CONSTRAINT space_relation_child_space_fkey FOREIGN KEY (child_space) REFERENCES public.space(id);


--
-- Name: space_relation space_relation_parent_space_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.space_relation
    ADD CONSTRAINT space_relation_parent_space_fkey FOREIGN KEY (parent_space) REFERENCES public.space(id);


--
-- Name: statutory_submission statutory_submission_reservation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.statutory_submission
    ADD CONSTRAINT statutory_submission_reservation_id_fkey FOREIGN KEY (reservation_id) REFERENCES public.reservation(id);


--
-- Name: task task_property_node_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task
    ADD CONSTRAINT task_property_node_fkey FOREIGN KEY (property_node) REFERENCES public.org_node(id);


--
-- Name: task_sheet task_sheet_attendant_party_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_sheet
    ADD CONSTRAINT task_sheet_attendant_party_fkey FOREIGN KEY (attendant_party) REFERENCES public.party(id);


--
-- Name: tax_assignment tax_assignment_property_node_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_assignment
    ADD CONSTRAINT tax_assignment_property_node_fkey FOREIGN KEY (property_node) REFERENCES public.org_node(id);


--
-- Name: tax_attribution_hold_binding tax_attribution_hold_binding_actor_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_attribution_hold_binding
    ADD CONSTRAINT tax_attribution_hold_binding_actor_fk FOREIGN KEY (tenant_id, bound_by) REFERENCES public.app_user(tenant_id, id);


--
-- Name: tax_attribution_hold_binding tax_attribution_hold_binding_attribution_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_attribution_hold_binding
    ADD CONSTRAINT tax_attribution_hold_binding_attribution_fk FOREIGN KEY (tenant_id, attribution_id, property_node, bound_by, origin_quote_hash, snapshot_hash, currency) REFERENCES public.tax_attribution_snapshot(tenant_id, id, property_node, actor_id, origin_quote_hash, snapshot_hash, currency);


--
-- Name: tax_attribution_hold_binding tax_attribution_hold_binding_hold_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_attribution_hold_binding
    ADD CONSTRAINT tax_attribution_hold_binding_hold_fk FOREIGN KEY (tenant_id, hold_id, property_node, sellable_unit_id, period) REFERENCES public.hold(tenant_id, id, property_node, sellable_unit_id, period);


--
-- Name: tax_attribution_hold_binding tax_attribution_hold_binding_property_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_attribution_hold_binding
    ADD CONSTRAINT tax_attribution_hold_binding_property_fk FOREIGN KEY (tenant_id, property_node) REFERENCES public.org_node(tenant_id, id);


--
-- Name: tax_attribution_journal_binding tax_attribution_journal_binding_account_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_attribution_journal_binding
    ADD CONSTRAINT tax_attribution_journal_binding_account_fk FOREIGN KEY (tenant_id, property_node, currency, guest_account_id) REFERENCES public.account(tenant_id, property_node, currency, id);


--
-- Name: tax_attribution_journal_binding tax_attribution_journal_binding_actor_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_attribution_journal_binding
    ADD CONSTRAINT tax_attribution_journal_binding_actor_fk FOREIGN KEY (tenant_id, posted_by) REFERENCES public.app_user(tenant_id, id);


--
-- Name: tax_attribution_journal_binding tax_attribution_journal_binding_folio_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_attribution_journal_binding
    ADD CONSTRAINT tax_attribution_journal_binding_folio_fk FOREIGN KEY (tenant_id, guest_account_id, folio_id) REFERENCES public.folio(tenant_id, account_id, id);


--
-- Name: tax_attribution_journal_binding tax_attribution_journal_binding_journal_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_attribution_journal_binding
    ADD CONSTRAINT tax_attribution_journal_binding_journal_fk FOREIGN KEY (tenant_id, journal_id, property_node, business_date, currency) REFERENCES public.journal(tenant_id, id, property_node, business_date, currency);


--
-- Name: tax_attribution_journal_binding tax_attribution_journal_binding_lineage_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_attribution_journal_binding
    ADD CONSTRAINT tax_attribution_journal_binding_lineage_fk FOREIGN KEY (tenant_id, lineage_id, property_node, hold_binding_id, attribution_id, reservation_id, segment_id, origin_quote_hash, snapshot_hash, currency) REFERENCES public.tax_attribution_reservation_binding(tenant_id, id, property_node, binding_id, attribution_id, reservation_id, segment_id, origin_quote_hash, snapshot_hash, currency);


--
-- Name: tax_attribution_journal_binding tax_attribution_journal_binding_property_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_attribution_journal_binding
    ADD CONSTRAINT tax_attribution_journal_binding_property_fk FOREIGN KEY (tenant_id, property_node) REFERENCES public.org_node(tenant_id, id);


--
-- Name: tax_attribution_reservation_binding tax_attribution_reservation_binding_actor_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_attribution_reservation_binding
    ADD CONSTRAINT tax_attribution_reservation_binding_actor_fk FOREIGN KEY (tenant_id, linked_by) REFERENCES public.app_user(tenant_id, id);


--
-- Name: tax_attribution_reservation_binding tax_attribution_reservation_binding_property_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_attribution_reservation_binding
    ADD CONSTRAINT tax_attribution_reservation_binding_property_fk FOREIGN KEY (tenant_id, property_node) REFERENCES public.org_node(tenant_id, id);


--
-- Name: tax_attribution_reservation_binding tax_attribution_reservation_binding_reservation_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_attribution_reservation_binding
    ADD CONSTRAINT tax_attribution_reservation_binding_reservation_fk FOREIGN KEY (tenant_id, reservation_id) REFERENCES public.reservation(tenant_id, id);


--
-- Name: tax_attribution_reservation_binding tax_attribution_reservation_binding_segment_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_attribution_reservation_binding
    ADD CONSTRAINT tax_attribution_reservation_binding_segment_fk FOREIGN KEY (tenant_id, segment_id) REFERENCES public.reservation_segment(tenant_id, id);


--
-- Name: tax_attribution_reservation_binding tax_attribution_reservation_binding_source_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_attribution_reservation_binding
    ADD CONSTRAINT tax_attribution_reservation_binding_source_fk FOREIGN KEY (tenant_id, binding_id, property_node, hold_id, attribution_id, sellable_unit_id, period, origin_quote_hash, snapshot_hash, currency) REFERENCES public.tax_attribution_hold_binding(tenant_id, id, property_node, hold_id, attribution_id, sellable_unit_id, period, origin_quote_hash, snapshot_hash, currency);


--
-- Name: tax_attribution_snapshot tax_attribution_snapshot_actor_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_attribution_snapshot
    ADD CONSTRAINT tax_attribution_snapshot_actor_fk FOREIGN KEY (tenant_id, actor_id) REFERENCES public.app_user(tenant_id, id);


--
-- Name: tax_attribution_snapshot tax_attribution_snapshot_property_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_attribution_snapshot
    ADD CONSTRAINT tax_attribution_snapshot_property_fk FOREIGN KEY (tenant_id, property_node) REFERENCES public.org_node(tenant_id, id);


--
-- Name: tax_semantic_route tax_semantic_route_configured_route_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_semantic_route
    ADD CONSTRAINT tax_semantic_route_configured_route_fk FOREIGN KEY (tenant_id, property_node, currency, tx_code) REFERENCES public.tx_code_route(tenant_id, property_node, currency, tx_code);


--
-- Name: tax_semantic_route tax_semantic_route_extension_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_semantic_route
    ADD CONSTRAINT tax_semantic_route_extension_fk FOREIGN KEY (jurisdiction_extension_id) REFERENCES public.extension(id);


--
-- Name: tax_semantic_route tax_semantic_route_property_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_semantic_route
    ADD CONSTRAINT tax_semantic_route_property_fk FOREIGN KEY (tenant_id, property_node) REFERENCES public.org_node(tenant_id, id);


--
-- Name: tax_semantic_route tax_semantic_route_tx_code_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_semantic_route
    ADD CONSTRAINT tax_semantic_route_tx_code_fk FOREIGN KEY (tx_code) REFERENCES public.tx_code(code);


--
-- Name: travel_detail travel_detail_pickup_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.travel_detail
    ADD CONSTRAINT travel_detail_pickup_task_id_fkey FOREIGN KEY (pickup_task_id) REFERENCES public.task(id);


--
-- Name: travel_detail travel_detail_reservation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.travel_detail
    ADD CONSTRAINT travel_detail_reservation_id_fkey FOREIGN KEY (reservation_id) REFERENCES public.reservation(id);


--
-- Name: trust_negative_authorization trust_negative_approval_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trust_negative_authorization
    ADD CONSTRAINT trust_negative_approval_fk FOREIGN KEY (tenant_id, approval_request_id) REFERENCES public.approval_request(tenant_id, id);


--
-- Name: trust_negative_authorization trust_negative_journal_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trust_negative_authorization
    ADD CONSTRAINT trust_negative_journal_fk FOREIGN KEY (tenant_id, journal_id) REFERENCES public.journal(tenant_id, id);


--
-- Name: trust_negative_authorization trust_negative_owner_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trust_negative_authorization
    ADD CONSTRAINT trust_negative_owner_fk FOREIGN KEY (tenant_id, owner_party_id) REFERENCES public.party(tenant_id, id);


--
-- Name: trust_negative_authorization trust_negative_payable_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trust_negative_authorization
    ADD CONSTRAINT trust_negative_payable_fk FOREIGN KEY (tenant_id, payable_account_id) REFERENCES public.account(tenant_id, id);


--
-- Name: trust_negative_authorization trust_negative_property_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trust_negative_authorization
    ADD CONSTRAINT trust_negative_property_fk FOREIGN KEY (tenant_id, property_node) REFERENCES public.org_node(tenant_id, id);


--
-- Name: trust_negative_authorization trust_negative_trust_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trust_negative_authorization
    ADD CONSTRAINT trust_negative_trust_fk FOREIGN KEY (tenant_id, trust_account_id) REFERENCES public.account(tenant_id, id);


--
-- Name: tx_code_route tx_code_route_credit_account_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tx_code_route
    ADD CONSTRAINT tx_code_route_credit_account_fk FOREIGN KEY (tenant_id, property_node, currency, credit_account_id) REFERENCES public.account(tenant_id, property_node, currency, id);


--
-- Name: tx_code_route tx_code_route_debit_account_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tx_code_route
    ADD CONSTRAINT tx_code_route_debit_account_fk FOREIGN KEY (tenant_id, property_node, currency, debit_account_id) REFERENCES public.account(tenant_id, property_node, currency, id);


--
-- Name: tx_code_route tx_code_route_tenant_property_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tx_code_route
    ADD CONSTRAINT tx_code_route_tenant_property_fk FOREIGN KEY (tenant_id, property_node) REFERENCES public.org_node(tenant_id, id);


--
-- Name: tx_code_route tx_code_route_tx_code_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tx_code_route
    ADD CONSTRAINT tx_code_route_tx_code_fk FOREIGN KEY (tx_code) REFERENCES public.tx_code(code);


--
-- Name: unit_condition unit_condition_space_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_condition
    ADD CONSTRAINT unit_condition_space_id_fkey FOREIGN KEY (space_id) REFERENCES public.space(id);


--
-- Name: unit_type unit_type_property_node_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_type
    ADD CONSTRAINT unit_type_property_node_fkey FOREIGN KEY (property_node) REFERENCES public.org_node(id);


--
-- Name: user_role user_role_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_role
    ADD CONSTRAINT user_role_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.role(id);


--
-- Name: user_role user_role_scope_node_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_role
    ADD CONSTRAINT user_role_scope_node_fkey FOREIGN KEY (scope_node) REFERENCES public.org_node(id);


--
-- Name: user_role user_role_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_role
    ADD CONSTRAINT user_role_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_user(id);


--
-- Name: vehicle vehicle_parking_space_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicle
    ADD CONSTRAINT vehicle_parking_space_fkey FOREIGN KEY (parking_space) REFERENCES public.space(id);


--
-- Name: vehicle vehicle_party_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicle
    ADD CONSTRAINT vehicle_party_id_fkey FOREIGN KEY (party_id) REFERENCES public.party(id);


--
-- Name: vehicle vehicle_property_node_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicle
    ADD CONSTRAINT vehicle_property_node_fkey FOREIGN KEY (property_node) REFERENCES public.org_node(id);


--
-- Name: vehicle vehicle_reservation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicle
    ADD CONSTRAINT vehicle_reservation_id_fkey FOREIGN KEY (reservation_id) REFERENCES public.reservation(id);


--
-- Name: waitlist_entry waitlist_entry_party_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waitlist_entry
    ADD CONSTRAINT waitlist_entry_party_id_fkey FOREIGN KEY (party_id) REFERENCES public.party(id);


--
-- Name: waitlist_entry waitlist_entry_unit_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waitlist_entry
    ADD CONSTRAINT waitlist_entry_unit_type_id_fkey FOREIGN KEY (unit_type_id) REFERENCES public.unit_type(id);


--
-- Name: account; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.account ENABLE ROW LEVEL SECURITY;

--
-- Name: address; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.address ENABLE ROW LEVEL SECURITY;

--
-- Name: alert; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.alert ENABLE ROW LEVEL SECURITY;

--
-- Name: api_client; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.api_client ENABLE ROW LEVEL SECURITY;

--
-- Name: api_idempotency; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.api_idempotency ENABLE ROW LEVEL SECURITY;

--
-- Name: app_user; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.app_user ENABLE ROW LEVEL SECURITY;

--
-- Name: approval_request; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.approval_request ENABLE ROW LEVEL SECURITY;

--
-- Name: ar_allocation; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ar_allocation ENABLE ROW LEVEL SECURITY;

--
-- Name: automation; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.automation ENABLE ROW LEVEL SECURITY;

--
-- Name: availability_projection; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.availability_projection ENABLE ROW LEVEL SECURITY;

--
-- Name: block_allotment; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.block_allotment ENABLE ROW LEVEL SECURITY;

--
-- Name: block_status_def; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.block_status_def ENABLE ROW LEVEL SECURITY;

--
-- Name: business_day; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.business_day ENABLE ROW LEVEL SECURITY;

--
-- Name: business_day_discrepancy_carry; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.business_day_discrepancy_carry ENABLE ROW LEVEL SECURITY;

--
-- Name: cash_drawer; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cash_drawer ENABLE ROW LEVEL SECURITY;

--
-- Name: cash_drawer_denomination; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cash_drawer_denomination ENABLE ROW LEVEL SECURITY;

--
-- Name: cashier_count; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cashier_count ENABLE ROW LEVEL SECURITY;

--
-- Name: cashier_count_line; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cashier_count_line ENABLE ROW LEVEL SECURITY;

--
-- Name: cashier_session; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cashier_session ENABLE ROW LEVEL SECURITY;

--
-- Name: channel_map; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.channel_map ENABLE ROW LEVEL SECURITY;

--
-- Name: consent; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.consent ENABLE ROW LEVEL SECURITY;

--
-- Name: contact_point; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contact_point ENABLE ROW LEVEL SECURITY;

--
-- Name: deposit_application; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.deposit_application ENABLE ROW LEVEL SECURITY;

--
-- Name: discrepancy; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.discrepancy ENABLE ROW LEVEL SECURITY;

--
-- Name: document; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document ENABLE ROW LEVEL SECURITY;

--
-- Name: document_series; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_series ENABLE ROW LEVEL SECURITY;

--
-- Name: erasure_request; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.erasure_request ENABLE ROW LEVEL SECURITY;

--
-- Name: extension; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.extension ENABLE ROW LEVEL SECURITY;

--
-- Name: fact_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fact_log ENABLE ROW LEVEL SECURITY;

--
-- Name: fiscal_submission; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fiscal_submission ENABLE ROW LEVEL SECURITY;

--
-- Name: folio; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.folio ENABLE ROW LEVEL SECURITY;

--
-- Name: hold; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.hold ENABLE ROW LEVEL SECURITY;

--
-- Name: hosted_payment_request; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.hosted_payment_request ENABLE ROW LEVEL SECURITY;

--
-- Name: identity_document; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.identity_document ENABLE ROW LEVEL SECURITY;

--
-- Name: inbound_message; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inbound_message ENABLE ROW LEVEL SECURITY;

--
-- Name: india_gst_accommodation_final_component_tax; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.india_gst_accommodation_final_component_tax ENABLE ROW LEVEL SECURITY;

--
-- Name: india_gst_accommodation_final_component_tax_component; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.india_gst_accommodation_final_component_tax_component ENABLE ROW LEVEL SECURITY;

--
-- Name: india_gst_accommodation_final_component_tax_room_night; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.india_gst_accommodation_final_component_tax_room_night ENABLE ROW LEVEL SECURITY;

--
-- Name: india_gst_accommodation_final_valuation; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.india_gst_accommodation_final_valuation ENABLE ROW LEVEL SECURITY;

--
-- Name: india_gst_accommodation_invoice_issue_snapshot; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.india_gst_accommodation_invoice_issue_snapshot ENABLE ROW LEVEL SECURITY;

--
-- Name: india_gst_accommodation_payment_receipt_snapshot; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.india_gst_accommodation_payment_receipt_snapshot ENABLE ROW LEVEL SECURITY;

--
-- Name: india_gst_accommodation_quoted_rate_applicability; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.india_gst_accommodation_quoted_rate_applicability ENABLE ROW LEVEL SECURITY;

--
-- Name: india_gst_accommodation_quoted_rate_applicability_room_night; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.india_gst_accommodation_quoted_rate_applicability_room_night ENABLE ROW LEVEL SECURITY;

--
-- Name: india_gst_accommodation_quoted_rate_component; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.india_gst_accommodation_quoted_rate_component ENABLE ROW LEVEL SECURITY;

--
-- Name: india_gst_accommodation_service_provision_snapshot; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.india_gst_accommodation_service_provision_snapshot ENABLE ROW LEVEL SECURITY;

--
-- Name: india_gst_accommodation_valuation_allocation; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.india_gst_accommodation_valuation_allocation ENABLE ROW LEVEL SECURITY;

--
-- Name: india_gst_accommodation_valuation_room_night; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.india_gst_accommodation_valuation_room_night ENABLE ROW LEVEL SECURITY;

--
-- Name: india_gst_accommodation_valuation_source; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.india_gst_accommodation_valuation_source ENABLE ROW LEVEL SECURITY;

--
-- Name: india_gst_item_classification; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.india_gst_item_classification ENABLE ROW LEVEL SECURITY;

--
-- Name: india_gst_recipient_sez_status; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.india_gst_recipient_sez_status ENABLE ROW LEVEL SECURITY;

--
-- Name: india_gst_supplier_registration_status_snapshot; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.india_gst_supplier_registration_status_snapshot ENABLE ROW LEVEL SECURITY;

--
-- Name: india_gst_supplier_service_location; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.india_gst_supplier_service_location ENABLE ROW LEVEL SECURITY;

--
-- Name: india_gst_supplier_sez_status; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.india_gst_supplier_sez_status ENABLE ROW LEVEL SECURITY;

--
-- Name: india_sez_unit_loa_renewal; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.india_sez_unit_loa_renewal ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_authority; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_authority ENABLE ROW LEVEL SECURITY;

--
-- Name: journal; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.journal ENABLE ROW LEVEL SECURITY;

--
-- Name: membership; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.membership ENABLE ROW LEVEL SECURITY;

--
-- Name: message; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.message ENABLE ROW LEVEL SECURITY;

--
-- Name: negotiated_rate; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.negotiated_rate ENABLE ROW LEVEL SECURITY;

--
-- Name: ooo_oos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ooo_oos ENABLE ROW LEVEL SECURITY;

--
-- Name: org_node; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.org_node ENABLE ROW LEVEL SECURITY;

--
-- Name: outbox; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.outbox ENABLE ROW LEVEL SECURITY;

--
-- Name: overbooking_limit; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.overbooking_limit ENABLE ROW LEVEL SECURITY;

--
-- Name: package; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.package ENABLE ROW LEVEL SECURITY;

--
-- Name: package_element; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.package_element ENABLE ROW LEVEL SECURITY;

--
-- Name: party; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.party ENABLE ROW LEVEL SECURITY;

--
-- Name: party_fiscal_registration; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.party_fiscal_registration ENABLE ROW LEVEL SECURITY;

--
-- Name: party_relationship; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.party_relationship ENABLE ROW LEVEL SECURITY;

--
-- Name: party_role; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.party_role ENABLE ROW LEVEL SECURITY;

--
-- Name: payment; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_instrument; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment_instrument ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_operation; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment_operation ENABLE ROW LEVEL SECURITY;

--
-- Name: policy; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.policy ENABLE ROW LEVEL SECURITY;

--
-- Name: posting_line; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.posting_line ENABLE ROW LEVEL SECURITY;

--
-- Name: preference; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.preference ENABLE ROW LEVEL SECURITY;

--
-- Name: promotion; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.promotion ENABLE ROW LEVEL SECURITY;

--
-- Name: property_fiscal_location; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.property_fiscal_location ENABLE ROW LEVEL SECURITY;

--
-- Name: property_fiscal_registration; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.property_fiscal_registration ENABLE ROW LEVEL SECURITY;

--
-- Name: provider_event_receipt; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.provider_event_receipt ENABLE ROW LEVEL SECURITY;

--
-- Name: push_cursor; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.push_cursor ENABLE ROW LEVEL SECURITY;

--
-- Name: queue_entry; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.queue_entry ENABLE ROW LEVEL SECURITY;

--
-- Name: rate_plan; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rate_plan ENABLE ROW LEVEL SECURITY;

--
-- Name: rate_price; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rate_price ENABLE ROW LEVEL SECURITY;

--
-- Name: reservation; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reservation ENABLE ROW LEVEL SECURITY;

--
-- Name: reservation_group; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reservation_group ENABLE ROW LEVEL SECURITY;

--
-- Name: reservation_guest; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reservation_guest ENABLE ROW LEVEL SECURITY;

--
-- Name: reservation_segment; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reservation_segment ENABLE ROW LEVEL SECURITY;

--
-- Name: restriction; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.restriction ENABLE ROW LEVEL SECURITY;

--
-- Name: role; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.role ENABLE ROW LEVEL SECURITY;

--
-- Name: sellable_unit; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sellable_unit ENABLE ROW LEVEL SECURITY;

--
-- Name: sellable_unit_space; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sellable_unit_space ENABLE ROW LEVEL SECURITY;

--
-- Name: space; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.space ENABLE ROW LEVEL SECURITY;

--
-- Name: space_occupancy; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.space_occupancy ENABLE ROW LEVEL SECURITY;

--
-- Name: space_relation; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.space_relation ENABLE ROW LEVEL SECURITY;

--
-- Name: stats_daily; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stats_daily ENABLE ROW LEVEL SECURITY;

--
-- Name: statutory_submission; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.statutory_submission ENABLE ROW LEVEL SECURITY;

--
-- Name: task; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.task ENABLE ROW LEVEL SECURITY;

--
-- Name: task_sheet; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.task_sheet ENABLE ROW LEVEL SECURITY;

--
-- Name: tax_assignment; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tax_assignment ENABLE ROW LEVEL SECURITY;

--
-- Name: tax_attribution_hold_binding; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tax_attribution_hold_binding ENABLE ROW LEVEL SECURITY;

--
-- Name: tax_attribution_journal_binding; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tax_attribution_journal_binding ENABLE ROW LEVEL SECURITY;

--
-- Name: tax_attribution_reservation_binding; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tax_attribution_reservation_binding ENABLE ROW LEVEL SECURITY;

--
-- Name: tax_attribution_snapshot; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tax_attribution_snapshot ENABLE ROW LEVEL SECURITY;

--
-- Name: tax_semantic_route; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tax_semantic_route ENABLE ROW LEVEL SECURITY;

--
-- Name: account tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.account USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: address tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.address USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: alert tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.alert USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: api_client tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.api_client USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: api_idempotency tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.api_idempotency USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: app_user tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.app_user USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: approval_request tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.approval_request USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: ar_allocation tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ar_allocation USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: automation tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.automation USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: availability_projection tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.availability_projection USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: block_allotment tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.block_allotment USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: block_status_def tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.block_status_def USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: business_day tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.business_day USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: business_day_discrepancy_carry tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.business_day_discrepancy_carry USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: cash_drawer tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.cash_drawer USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: cash_drawer_denomination tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.cash_drawer_denomination USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: cashier_count tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.cashier_count USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: cashier_count_line tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.cashier_count_line USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: cashier_session tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.cashier_session USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: channel_map tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.channel_map USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: consent tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.consent USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: contact_point tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.contact_point USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: deposit_application tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.deposit_application USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: discrepancy tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.discrepancy USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: document tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.document USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: document_series tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.document_series USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: erasure_request tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.erasure_request USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: extension tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.extension USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: fact_log tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.fact_log USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: fiscal_submission tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.fiscal_submission USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: folio tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.folio USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: hold tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.hold USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: hosted_payment_request tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.hosted_payment_request USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: identity_document tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.identity_document USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: inbound_message tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.inbound_message USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: india_gst_accommodation_final_component_tax tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.india_gst_accommodation_final_component_tax USING ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid)) WITH CHECK ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid));


--
-- Name: india_gst_accommodation_final_component_tax_component tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.india_gst_accommodation_final_component_tax_component USING ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid)) WITH CHECK ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid));


--
-- Name: india_gst_accommodation_final_component_tax_room_night tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.india_gst_accommodation_final_component_tax_room_night USING ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid)) WITH CHECK ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid));


--
-- Name: india_gst_accommodation_final_valuation tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.india_gst_accommodation_final_valuation USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));


--
-- Name: india_gst_accommodation_invoice_issue_snapshot tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.india_gst_accommodation_invoice_issue_snapshot USING ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid)) WITH CHECK ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid));


--
-- Name: india_gst_accommodation_payment_receipt_snapshot tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.india_gst_accommodation_payment_receipt_snapshot USING ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid)) WITH CHECK ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid));


--
-- Name: india_gst_accommodation_quoted_rate_applicability tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.india_gst_accommodation_quoted_rate_applicability USING ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid)) WITH CHECK ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid));


--
-- Name: india_gst_accommodation_quoted_rate_applicability_room_night tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.india_gst_accommodation_quoted_rate_applicability_room_night USING ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid)) WITH CHECK ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid));


--
-- Name: india_gst_accommodation_quoted_rate_component tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.india_gst_accommodation_quoted_rate_component USING ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid)) WITH CHECK ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid));


--
-- Name: india_gst_accommodation_service_provision_snapshot tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.india_gst_accommodation_service_provision_snapshot USING ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid)) WITH CHECK ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid));


--
-- Name: india_gst_accommodation_valuation_allocation tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.india_gst_accommodation_valuation_allocation USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));


--
-- Name: india_gst_accommodation_valuation_room_night tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.india_gst_accommodation_valuation_room_night USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));


--
-- Name: india_gst_accommodation_valuation_source tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.india_gst_accommodation_valuation_source USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));


--
-- Name: india_gst_item_classification tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.india_gst_item_classification USING ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid)) WITH CHECK ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid));


--
-- Name: india_gst_recipient_sez_status tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.india_gst_recipient_sez_status USING ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid)) WITH CHECK ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid));


--
-- Name: india_gst_supplier_registration_status_snapshot tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.india_gst_supplier_registration_status_snapshot USING ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid)) WITH CHECK ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid));


--
-- Name: india_gst_supplier_service_location tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.india_gst_supplier_service_location USING ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid)) WITH CHECK ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid));


--
-- Name: india_gst_supplier_sez_status tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.india_gst_supplier_sez_status USING ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid)) WITH CHECK ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid));


--
-- Name: india_sez_unit_loa_renewal tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.india_sez_unit_loa_renewal USING ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid)) WITH CHECK ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid));


--
-- Name: inventory_authority tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.inventory_authority USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: journal tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.journal USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: membership tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.membership USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: message tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.message USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: negotiated_rate tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.negotiated_rate USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: ooo_oos tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ooo_oos USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: org_node tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.org_node USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: outbox tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.outbox USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: overbooking_limit tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.overbooking_limit USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: package tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.package USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: package_element tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.package_element USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: party tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.party USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: party_fiscal_registration tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.party_fiscal_registration USING ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid)) WITH CHECK ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid));


--
-- Name: party_relationship tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.party_relationship USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: party_role tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.party_role USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: payment tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.payment USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: payment_instrument tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.payment_instrument USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: payment_operation tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.payment_operation USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: policy tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.policy USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: posting_line tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.posting_line USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: preference tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.preference USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: promotion tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.promotion USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: property_fiscal_location tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.property_fiscal_location USING ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid)) WITH CHECK ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid));


--
-- Name: property_fiscal_registration tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.property_fiscal_registration USING ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid)) WITH CHECK ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid));


--
-- Name: provider_event_receipt tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.provider_event_receipt USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: push_cursor tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.push_cursor USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: queue_entry tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.queue_entry USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: rate_plan tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.rate_plan USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: rate_price tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.rate_price USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: reservation tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.reservation USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: reservation_group tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.reservation_group USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: reservation_guest tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.reservation_guest USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: reservation_segment tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.reservation_segment USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: restriction tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.restriction USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: role tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.role USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: sellable_unit tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.sellable_unit USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: sellable_unit_space tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.sellable_unit_space USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: space tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.space USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: space_occupancy tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.space_occupancy USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: space_relation tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.space_relation USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: stats_daily tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.stats_daily USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: statutory_submission tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.statutory_submission USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: task tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.task USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: task_sheet tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.task_sheet USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: tax_assignment tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.tax_assignment USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: tax_attribution_hold_binding tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.tax_attribution_hold_binding USING ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid)) WITH CHECK ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid));


--
-- Name: tax_attribution_journal_binding tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.tax_attribution_journal_binding USING ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid)) WITH CHECK ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid));


--
-- Name: tax_attribution_reservation_binding tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.tax_attribution_reservation_binding USING ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid)) WITH CHECK ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid));


--
-- Name: tax_attribution_snapshot tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.tax_attribution_snapshot USING ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid)) WITH CHECK ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid));


--
-- Name: tax_semantic_route tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.tax_semantic_route USING ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid)) WITH CHECK ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid));


--
-- Name: travel_detail tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.travel_detail USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: trust_negative_authorization tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.trust_negative_authorization USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));


--
-- Name: tx_code_route tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.tx_code_route USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: unit_condition tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.unit_condition USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: unit_type tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.unit_type USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: user_role tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.user_role USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: vehicle tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.vehicle USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: waitlist_entry tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.waitlist_entry USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: travel_detail; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.travel_detail ENABLE ROW LEVEL SECURITY;

--
-- Name: trust_negative_authorization; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.trust_negative_authorization ENABLE ROW LEVEL SECURITY;

--
-- Name: tx_code_route; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tx_code_route ENABLE ROW LEVEL SECURITY;

--
-- Name: unit_condition; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.unit_condition ENABLE ROW LEVEL SECURITY;

--
-- Name: unit_type; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.unit_type ENABLE ROW LEVEL SECURITY;

--
-- Name: user_role; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_role ENABLE ROW LEVEL SECURITY;

--
-- Name: vehicle; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.vehicle ENABLE ROW LEVEL SECURITY;

--
-- Name: waitlist_entry; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.waitlist_entry ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO app_role;
GRANT USAGE ON SCHEMA public TO yellow_runtime;
GRANT USAGE ON SCHEMA public TO yellow_extension_registrar;


--
-- Name: FUNCTION append_cashier_count(p_tenant uuid, p_property uuid, p_session uuid, p_actor uuid, p_denomination_units bigint[], p_quantities bigint[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.append_cashier_count(p_tenant uuid, p_property uuid, p_session uuid, p_actor uuid, p_denomination_units bigint[], p_quantities bigint[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.append_cashier_count(p_tenant uuid, p_property uuid, p_session uuid, p_actor uuid, p_denomination_units bigint[], p_quantities bigint[]) TO app_role;


--
-- Name: FUNCTION assert_day_open(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.assert_day_open() FROM PUBLIC;


--
-- Name: FUNCTION assert_journal_balanced(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.assert_journal_balanced() FROM PUBLIC;


--
-- Name: FUNCTION assign_due_in_room(p_tenant uuid, p_property uuid, p_reservation uuid, p_segment uuid, p_expected_unit_type uuid, p_expected_period tstzrange, p_expected_sellable_unit uuid, p_sellable_unit uuid, p_actor uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.assign_due_in_room(p_tenant uuid, p_property uuid, p_reservation uuid, p_segment uuid, p_expected_unit_type uuid, p_expected_period tstzrange, p_expected_sellable_unit uuid, p_sellable_unit uuid, p_actor uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.assign_due_in_room(p_tenant uuid, p_property uuid, p_reservation uuid, p_segment uuid, p_expected_unit_type uuid, p_expected_period tstzrange, p_expected_sellable_unit uuid, p_sellable_unit uuid, p_actor uuid) TO app_role;


--
-- Name: FUNCTION assign_vehicle_parking(p_tenant uuid, p_property uuid, p_vehicle uuid, p_parking_space uuid, p_actor uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.assign_vehicle_parking(p_tenant uuid, p_property uuid, p_vehicle uuid, p_parking_space uuid, p_actor uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.assign_vehicle_parking(p_tenant uuid, p_property uuid, p_vehicle uuid, p_parking_space uuid, p_actor uuid) TO app_role;


--
-- Name: FUNCTION carry_business_day_discrepancy(p_tenant uuid, p_approval uuid, p_expected_hash text, p_request uuid, p_actor uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.carry_business_day_discrepancy(p_tenant uuid, p_approval uuid, p_expected_hash text, p_request uuid, p_actor uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.carry_business_day_discrepancy(p_tenant uuid, p_approval uuid, p_expected_hash text, p_request uuid, p_actor uuid) TO app_role;


--
-- Name: FUNCTION close_cashier_session(p_tenant uuid, p_property uuid, p_session uuid, p_actor uuid, p_count uuid, p_approval uuid, p_reason text, p_supervised boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.close_cashier_session(p_tenant uuid, p_property uuid, p_session uuid, p_actor uuid, p_count uuid, p_approval uuid, p_reason text, p_supervised boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.close_cashier_session(p_tenant uuid, p_property uuid, p_session uuid, p_actor uuid, p_count uuid, p_approval uuid, p_reason text, p_supervised boolean) TO app_role;


--
-- Name: FUNCTION create_arrival_room_cleaning_task(p_tenant uuid, p_property uuid, p_reservation uuid, p_attendant uuid, p_actor uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_arrival_room_cleaning_task(p_tenant uuid, p_property uuid, p_reservation uuid, p_attendant uuid, p_actor uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_arrival_room_cleaning_task(p_tenant uuid, p_property uuid, p_reservation uuid, p_attendant uuid, p_actor uuid) TO app_role;


--
-- Name: FUNCTION create_charge_correction_header(p_tenant uuid, p_original uuid, p_property uuid, p_currency character, p_description text, p_actor uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_charge_correction_header(p_tenant uuid, p_original uuid, p_property uuid, p_currency character, p_description text, p_actor uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_charge_correction_header(p_tenant uuid, p_original uuid, p_property uuid, p_currency character, p_description text, p_actor uuid) TO app_role;


--
-- Name: FUNCTION create_folio_transfer(p_tenant_id uuid, p_source_folio uuid, p_destination_folio uuid, p_root_line_ids uuid[], p_actor_id uuid, p_reason text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_folio_transfer(p_tenant_id uuid, p_source_folio uuid, p_destination_folio uuid, p_root_line_ids uuid[], p_actor_id uuid, p_reason text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_folio_transfer(p_tenant_id uuid, p_source_folio uuid, p_destination_folio uuid, p_root_line_ids uuid[], p_actor_id uuid, p_reason text) TO app_role;


--
-- Name: FUNCTION create_owner_trust_expense(p_tenant uuid, p_trust_account uuid, p_actor uuid, p_approval uuid, p_amount bigint, p_reason text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_owner_trust_expense(p_tenant uuid, p_trust_account uuid, p_actor uuid, p_approval uuid, p_amount bigint, p_reason text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_owner_trust_expense(p_tenant uuid, p_trust_account uuid, p_actor uuid, p_approval uuid, p_amount bigint, p_reason text) TO app_role;


--
-- Name: FUNCTION create_positive_tax_correction_header(p_tenant_id uuid, p_original_journal_id uuid, p_property_node uuid, p_description text, p_actor_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_positive_tax_correction_header(p_tenant_id uuid, p_original_journal_id uuid, p_property_node uuid, p_description text, p_actor_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_positive_tax_correction_header(p_tenant_id uuid, p_original_journal_id uuid, p_property_node uuid, p_description text, p_actor_id uuid) TO app_role;


--
-- Name: FUNCTION create_receivable_transfer(p_tenant uuid, p_property uuid, p_folio uuid, p_receivable_account uuid, p_actor uuid, p_approval uuid, p_reason text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_receivable_transfer(p_tenant uuid, p_property uuid, p_folio uuid, p_receivable_account uuid, p_actor uuid, p_approval uuid, p_reason text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_receivable_transfer(p_tenant uuid, p_property uuid, p_folio uuid, p_receivable_account uuid, p_actor uuid, p_approval uuid, p_reason text) TO app_role;


--
-- Name: FUNCTION derive_posting_line_currency(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.derive_posting_line_currency() FROM PUBLIC;


--
-- Name: FUNCTION expire_holds(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.expire_holds() FROM PUBLIC;


--
-- Name: FUNCTION govern_arrival_pickup_task(p_tenant uuid, p_property uuid, p_reservation uuid, p_actor uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.govern_arrival_pickup_task(p_tenant uuid, p_property uuid, p_reservation uuid, p_actor uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.govern_arrival_pickup_task(p_tenant uuid, p_property uuid, p_reservation uuid, p_actor uuid) TO app_role;


--
-- Name: FUNCTION govern_housekeeping_task_sheet(p_tenant uuid, p_property uuid, p_sheet_date date, p_attendant uuid, p_actor uuid, p_mode text, p_limit integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.govern_housekeeping_task_sheet(p_tenant uuid, p_property uuid, p_sheet_date date, p_attendant uuid, p_actor uuid, p_mode text, p_limit integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.govern_housekeeping_task_sheet(p_tenant uuid, p_property uuid, p_sheet_date date, p_attendant uuid, p_actor uuid, p_mode text, p_limit integer) TO app_role;


--
-- Name: FUNCTION initialize_unit_condition(p_tenant uuid, p_property uuid, p_space uuid, p_condition text, p_actor uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.initialize_unit_condition(p_tenant uuid, p_property uuid, p_space uuid, p_condition text, p_actor uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.initialize_unit_condition(p_tenant uuid, p_property uuid, p_space uuid, p_condition text, p_actor uuid) TO app_role;


--
-- Name: FUNCTION link_tax_attribution_reservation(p_tenant_id uuid, p_property_node uuid, p_actor_id uuid, p_hold_id uuid, p_reservation_id uuid, p_segment_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.link_tax_attribution_reservation(p_tenant_id uuid, p_property_node uuid, p_actor_id uuid, p_hold_id uuid, p_reservation_id uuid, p_segment_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.link_tax_attribution_reservation(p_tenant_id uuid, p_property_node uuid, p_actor_id uuid, p_hold_id uuid, p_reservation_id uuid, p_segment_id uuid) TO app_role;


--
-- Name: FUNCTION lock_and_revoke_hosted_payment_requests(p_tenant uuid, p_folio uuid, p_revoked_at timestamp with time zone); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.lock_and_revoke_hosted_payment_requests(p_tenant uuid, p_folio uuid, p_revoked_at timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION public.lock_and_revoke_hosted_payment_requests(p_tenant uuid, p_folio uuid, p_revoked_at timestamp with time zone) TO app_role;


--
-- Name: FUNCTION lock_financial_business_days(p_tenant uuid, p_property uuid, p_dates date[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.lock_financial_business_days(p_tenant uuid, p_property uuid, p_dates date[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.lock_financial_business_days(p_tenant uuid, p_property uuid, p_dates date[]) TO app_role;


--
-- Name: FUNCTION lock_financial_rows(p_tenant uuid, p_account_ids uuid[], p_folio_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.lock_financial_rows(p_tenant uuid, p_account_ids uuid[], p_folio_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.lock_financial_rows(p_tenant uuid, p_account_ids uuid[], p_folio_id uuid) TO app_role;


--
-- Name: FUNCTION lock_payment_operation(p_tenant uuid, p_operation uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.lock_payment_operation(p_tenant uuid, p_operation uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.lock_payment_operation(p_tenant uuid, p_operation uuid) TO app_role;


--
-- Name: FUNCTION lock_positive_tax_posting_rows(p_tenant_id uuid, p_account_ids uuid[], p_folio_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.lock_positive_tax_posting_rows(p_tenant_id uuid, p_account_ids uuid[], p_folio_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.lock_positive_tax_posting_rows(p_tenant_id uuid, p_account_ids uuid[], p_folio_id uuid) TO app_role;


--
-- Name: FUNCTION open_cashier_session(p_tenant uuid, p_property uuid, p_drawer uuid, p_actor uuid, p_denomination_units bigint[], p_quantities bigint[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.open_cashier_session(p_tenant uuid, p_property uuid, p_drawer uuid, p_actor uuid, p_denomination_units bigint[], p_quantities bigint[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.open_cashier_session(p_tenant uuid, p_property uuid, p_drawer uuid, p_actor uuid, p_denomination_units bigint[], p_quantities bigint[]) TO app_role;


--
-- Name: FUNCTION open_current_business_day(p_tenant uuid, p_property uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.open_current_business_day(p_tenant uuid, p_property uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.open_current_business_day(p_tenant uuid, p_property uuid) TO app_role;


--
-- Name: FUNCTION prepare_business_day_discrepancy_carry(p_tenant uuid, p_property uuid, p_discrepancy uuid, p_source date, p_target date, p_reason text, p_request uuid, p_actor uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.prepare_business_day_discrepancy_carry(p_tenant uuid, p_property uuid, p_discrepancy uuid, p_source date, p_target date, p_reason text, p_request uuid, p_actor uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.prepare_business_day_discrepancy_carry(p_tenant uuid, p_property uuid, p_discrepancy uuid, p_source date, p_target date, p_reason text, p_request uuid, p_actor uuid) TO app_role;


--
-- Name: FUNCTION prepare_owner_trust_expense(p_tenant uuid, p_trust_account uuid, p_actor uuid, p_amount bigint, p_reason text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.prepare_owner_trust_expense(p_tenant uuid, p_trust_account uuid, p_actor uuid, p_amount bigint, p_reason text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.prepare_owner_trust_expense(p_tenant uuid, p_trust_account uuid, p_actor uuid, p_amount bigint, p_reason text) TO app_role;


--
-- Name: FUNCTION prune_outbox(p_retain interval); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.prune_outbox(p_retain interval) FROM PUBLIC;


--
-- Name: FUNCTION put_reservation_travel(p_tenant uuid, p_property uuid, p_reservation uuid, p_direction text, p_expected_present boolean, p_expected_mode text, p_expected_carrier text, p_expected_service_no text, p_expected_scheduled_at timestamp with time zone, p_expected_pickup_requested boolean, p_desired_mode text, p_desired_carrier text, p_desired_service_no text, p_desired_scheduled_at timestamp with time zone, p_desired_pickup_requested boolean, p_actor uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.put_reservation_travel(p_tenant uuid, p_property uuid, p_reservation uuid, p_direction text, p_expected_present boolean, p_expected_mode text, p_expected_carrier text, p_expected_service_no text, p_expected_scheduled_at timestamp with time zone, p_expected_pickup_requested boolean, p_desired_mode text, p_desired_carrier text, p_desired_service_no text, p_desired_scheduled_at timestamp with time zone, p_desired_pickup_requested boolean, p_actor uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.put_reservation_travel(p_tenant uuid, p_property uuid, p_reservation uuid, p_direction text, p_expected_present boolean, p_expected_mode text, p_expected_carrier text, p_expected_service_no text, p_expected_scheduled_at timestamp with time zone, p_expected_pickup_requested boolean, p_desired_mode text, p_desired_carrier text, p_desired_service_no text, p_desired_scheduled_at timestamp with time zone, p_desired_pickup_requested boolean, p_actor uuid) TO app_role;


--
-- Name: FUNCTION record_india_gst_accommodation_final_component_tax(p_tenant uuid, p_property uuid, p_reservation uuid, p_folio uuid, p_applicability uuid, p_request uuid, p_actor uuid, p_expected_tax uuid, p_expected_tax_hash text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.record_india_gst_accommodation_final_component_tax(p_tenant uuid, p_property uuid, p_reservation uuid, p_folio uuid, p_applicability uuid, p_request uuid, p_actor uuid, p_expected_tax uuid, p_expected_tax_hash text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.record_india_gst_accommodation_final_component_tax(p_tenant uuid, p_property uuid, p_reservation uuid, p_folio uuid, p_applicability uuid, p_request uuid, p_actor uuid, p_expected_tax uuid, p_expected_tax_hash text) TO app_role;


--
-- Name: FUNCTION record_india_gst_accommodation_final_valuation(p_tenant uuid, p_property uuid, p_reservation uuid, p_folio uuid, p_buyer uuid, p_attribution uuid, p_lineage uuid, p_request uuid, p_actor uuid, p_disposition text, p_order341_hash text, p_request_hash text, p_expected uuid, p_expected_hash text, p_approval uuid, p_relationship text, p_consideration text, p_section152 text, p_section153 text, p_source_completeness text, p_attestation_source text, p_attestation_reference text, p_manual_reasons text[], p_source_ids uuid[], p_source_kinds text[], p_source_additions text[], p_source_discounts text[], p_source_evidence_sources text[], p_source_evidence_references text[], p_room_ordinals integer[], p_room_dates date[], p_room_weights bigint[], p_allocations bigint[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.record_india_gst_accommodation_final_valuation(p_tenant uuid, p_property uuid, p_reservation uuid, p_folio uuid, p_buyer uuid, p_attribution uuid, p_lineage uuid, p_request uuid, p_actor uuid, p_disposition text, p_order341_hash text, p_request_hash text, p_expected uuid, p_expected_hash text, p_approval uuid, p_relationship text, p_consideration text, p_section152 text, p_section153 text, p_source_completeness text, p_attestation_source text, p_attestation_reference text, p_manual_reasons text[], p_source_ids uuid[], p_source_kinds text[], p_source_additions text[], p_source_discounts text[], p_source_evidence_sources text[], p_source_evidence_references text[], p_room_ordinals integer[], p_room_dates date[], p_room_weights bigint[], p_allocations bigint[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.record_india_gst_accommodation_final_valuation(p_tenant uuid, p_property uuid, p_reservation uuid, p_folio uuid, p_buyer uuid, p_attribution uuid, p_lineage uuid, p_request uuid, p_actor uuid, p_disposition text, p_order341_hash text, p_request_hash text, p_expected uuid, p_expected_hash text, p_approval uuid, p_relationship text, p_consideration text, p_section152 text, p_section153 text, p_source_completeness text, p_attestation_source text, p_attestation_reference text, p_manual_reasons text[], p_source_ids uuid[], p_source_kinds text[], p_source_additions text[], p_source_discounts text[], p_source_evidence_sources text[], p_source_evidence_references text[], p_room_ordinals integer[], p_room_dates date[], p_room_weights bigint[], p_allocations bigint[]) TO app_role;


--
-- Name: FUNCTION record_india_gst_accommodation_quoted_rate_applicability(p_tenant uuid, p_property uuid, p_reservation uuid, p_folio uuid, p_lineage uuid, p_attribution uuid, p_request uuid, p_actor uuid, p_service_snapshot uuid, p_payment_snapshot uuid, p_invoice_snapshot uuid, p_family_jurisdiction_extension uuid, p_classification uuid, p_supplier_service_location uuid, p_supplier_sez_status uuid, p_recipient_sez_status uuid, p_recipient_party uuid, p_section14_case text, p_service_date date, p_invoice_date date, p_payment_date date, p_rate_change_date date, p_time_of_supply_date date, p_selected_side text, p_selected_extension uuid, p_selected_version smallint, p_selected_status text, p_selected_content_hash text, p_selected_from timestamp with time zone, p_selected_to timestamp with time zone, p_component_family text, p_section14_hash text, p_levy_hash text, p_lineage_hash text, p_attribution_hash text, p_evidence_hash text, p_calendar_authority text, p_calendar_source_hash text, p_calendar_through date, p_calendar_dates date[], p_calendar_states text[], p_night_ordinals integer[], p_night_dates date[], p_night_amounts bigint[], p_slab_upto bigint[], p_aggregate_bps integer[], p_itc_eligible boolean[], p_component_night_ordinals integer[], p_component_ordinals smallint[], p_component_identities text[], p_component_bps integer[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.record_india_gst_accommodation_quoted_rate_applicability(p_tenant uuid, p_property uuid, p_reservation uuid, p_folio uuid, p_lineage uuid, p_attribution uuid, p_request uuid, p_actor uuid, p_service_snapshot uuid, p_payment_snapshot uuid, p_invoice_snapshot uuid, p_family_jurisdiction_extension uuid, p_classification uuid, p_supplier_service_location uuid, p_supplier_sez_status uuid, p_recipient_sez_status uuid, p_recipient_party uuid, p_section14_case text, p_service_date date, p_invoice_date date, p_payment_date date, p_rate_change_date date, p_time_of_supply_date date, p_selected_side text, p_selected_extension uuid, p_selected_version smallint, p_selected_status text, p_selected_content_hash text, p_selected_from timestamp with time zone, p_selected_to timestamp with time zone, p_component_family text, p_section14_hash text, p_levy_hash text, p_lineage_hash text, p_attribution_hash text, p_evidence_hash text, p_calendar_authority text, p_calendar_source_hash text, p_calendar_through date, p_calendar_dates date[], p_calendar_states text[], p_night_ordinals integer[], p_night_dates date[], p_night_amounts bigint[], p_slab_upto bigint[], p_aggregate_bps integer[], p_itc_eligible boolean[], p_component_night_ordinals integer[], p_component_ordinals smallint[], p_component_identities text[], p_component_bps integer[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.record_india_gst_accommodation_quoted_rate_applicability(p_tenant uuid, p_property uuid, p_reservation uuid, p_folio uuid, p_lineage uuid, p_attribution uuid, p_request uuid, p_actor uuid, p_service_snapshot uuid, p_payment_snapshot uuid, p_invoice_snapshot uuid, p_family_jurisdiction_extension uuid, p_classification uuid, p_supplier_service_location uuid, p_supplier_sez_status uuid, p_recipient_sez_status uuid, p_recipient_party uuid, p_section14_case text, p_service_date date, p_invoice_date date, p_payment_date date, p_rate_change_date date, p_time_of_supply_date date, p_selected_side text, p_selected_extension uuid, p_selected_version smallint, p_selected_status text, p_selected_content_hash text, p_selected_from timestamp with time zone, p_selected_to timestamp with time zone, p_component_family text, p_section14_hash text, p_levy_hash text, p_lineage_hash text, p_attribution_hash text, p_evidence_hash text, p_calendar_authority text, p_calendar_source_hash text, p_calendar_through date, p_calendar_dates date[], p_calendar_states text[], p_night_ordinals integer[], p_night_dates date[], p_night_amounts bigint[], p_slab_upto bigint[], p_aggregate_bps integer[], p_itc_eligible boolean[], p_component_night_ordinals integer[], p_component_ordinals smallint[], p_component_identities text[], p_component_bps integer[]) TO app_role;


--
-- Name: FUNCTION record_occupancy(p_tenant uuid, p_space uuid, p_period tstzrange, p_slot uuid, p_slot_kind text, p_exclusive boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.record_occupancy(p_tenant uuid, p_space uuid, p_period tstzrange, p_slot uuid, p_slot_kind text, p_exclusive boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.record_occupancy(p_tenant uuid, p_space uuid, p_period tstzrange, p_slot uuid, p_slot_kind text, p_exclusive boolean) TO app_role;


--
-- Name: FUNCTION record_occupancy(p_tenant uuid, p_space uuid, p_period tstzrange, p_slot uuid, p_slot_kind text, p_exclusive boolean, p_vehicle uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.record_occupancy(p_tenant uuid, p_space uuid, p_period tstzrange, p_slot uuid, p_slot_kind text, p_exclusive boolean, p_vehicle uuid) FROM PUBLIC;


--
-- Name: FUNCTION record_positive_tax_correction_root(p_tenant_id uuid, p_original_journal_id uuid, p_reversal_journal_id uuid, p_actor_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.record_positive_tax_correction_root(p_tenant_id uuid, p_original_journal_id uuid, p_reversal_journal_id uuid, p_actor_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.record_positive_tax_correction_root(p_tenant_id uuid, p_original_journal_id uuid, p_reversal_journal_id uuid, p_actor_id uuid) TO app_role;


--
-- Name: FUNCTION record_positive_tax_journal_binding(p_tenant_id uuid, p_property_node uuid, p_actor_id uuid, p_lineage_id uuid, p_folio_id uuid, p_journal_id uuid, p_revenue_mapping_id uuid, p_tax_mapping_ids uuid[], p_tax_detail jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.record_positive_tax_journal_binding(p_tenant_id uuid, p_property_node uuid, p_actor_id uuid, p_lineage_id uuid, p_folio_id uuid, p_journal_id uuid, p_revenue_mapping_id uuid, p_tax_mapping_ids uuid[], p_tax_detail jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.record_positive_tax_journal_binding(p_tenant_id uuid, p_property_node uuid, p_actor_id uuid, p_lineage_id uuid, p_folio_id uuid, p_journal_id uuid, p_revenue_mapping_id uuid, p_tax_mapping_ids uuid[], p_tax_detail jsonb) TO app_role;


--
-- Name: FUNCTION record_tax_attribution_hold_binding(p_tenant_id uuid, p_property_node uuid, p_actor_id uuid, p_hold_id uuid, p_attribution_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.record_tax_attribution_hold_binding(p_tenant_id uuid, p_property_node uuid, p_actor_id uuid, p_hold_id uuid, p_attribution_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.record_tax_attribution_hold_binding(p_tenant_id uuid, p_property_node uuid, p_actor_id uuid, p_hold_id uuid, p_attribution_id uuid) TO app_role;


--
-- Name: FUNCTION record_tax_attribution_snapshot(p_tenant uuid, p_property uuid, p_actor uuid, p_schema_version integer, p_origin_kind text, p_origin_quote_hash text, p_snapshot_hash text, p_currency text, p_snapshot jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.record_tax_attribution_snapshot(p_tenant uuid, p_property uuid, p_actor uuid, p_schema_version integer, p_origin_kind text, p_origin_quote_hash text, p_snapshot_hash text, p_currency text, p_snapshot jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.record_tax_attribution_snapshot(p_tenant uuid, p_property uuid, p_actor uuid, p_schema_version integer, p_origin_kind text, p_origin_quote_hash text, p_snapshot_hash text, p_currency text, p_snapshot jsonb) TO app_role;


--
-- Name: FUNCTION register_extension_type(p_tenant uuid, p_type text, p_json_schema jsonb, p_actor uuid, p_property uuid, p_request uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.register_extension_type(p_tenant uuid, p_type text, p_json_schema jsonb, p_actor uuid, p_property uuid, p_request uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.register_extension_type(p_tenant uuid, p_type text, p_json_schema jsonb, p_actor uuid, p_property uuid, p_request uuid) TO yellow_extension_registrar;


--
-- Name: FUNCTION release_occupancy(p_tenant uuid, p_slot uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.release_occupancy(p_tenant uuid, p_slot uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.release_occupancy(p_tenant uuid, p_slot uuid) TO app_role;


--
-- Name: FUNCTION release_occupancy_typed_parent(p_tenant uuid, p_slot uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.release_occupancy_typed_parent(p_tenant uuid, p_slot uuid) FROM PUBLIC;


--
-- Name: FUNCTION report_room_discrepancy(p_tenant uuid, p_property uuid, p_space uuid, p_observed_presence text, p_observed_persons integer, p_actor uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.report_room_discrepancy(p_tenant uuid, p_property uuid, p_space uuid, p_observed_presence text, p_observed_persons integer, p_actor uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.report_room_discrepancy(p_tenant uuid, p_property uuid, p_space uuid, p_observed_presence text, p_observed_persons integer, p_actor uuid) TO app_role;


--
-- Name: FUNCTION runtime_consumer_advance(p_consumer text, p_last_seq bigint); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.runtime_consumer_advance(p_consumer text, p_last_seq bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public.runtime_consumer_advance(p_consumer text, p_last_seq bigint) TO yellow_runtime;


--
-- Name: FUNCTION runtime_consumer_begin(p_consumer text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.runtime_consumer_begin(p_consumer text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.runtime_consumer_begin(p_consumer text) TO yellow_runtime;


--
-- Name: FUNCTION runtime_consumer_mark(p_consumer text, p_outbox_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.runtime_consumer_mark(p_consumer text, p_outbox_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.runtime_consumer_mark(p_consumer text, p_outbox_id uuid) TO yellow_runtime;


--
-- Name: FUNCTION runtime_consumer_read(p_consumer text, p_after bigint, p_limit integer, p_unpublished boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.runtime_consumer_read(p_consumer text, p_after bigint, p_limit integer, p_unpublished boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.runtime_consumer_read(p_consumer text, p_after bigint, p_limit integer, p_unpublished boolean) TO yellow_runtime;


--
-- Name: FUNCTION runtime_due_arrival_scopes(p_limit integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.runtime_due_arrival_scopes(p_limit integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.runtime_due_arrival_scopes(p_limit integer) TO yellow_runtime;


--
-- Name: FUNCTION runtime_due_business_day_scopes(p_limit integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.runtime_due_business_day_scopes(p_limit integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.runtime_due_business_day_scopes(p_limit integer) TO yellow_runtime;


--
-- Name: FUNCTION runtime_due_departure_scopes(p_limit integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.runtime_due_departure_scopes(p_limit integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.runtime_due_departure_scopes(p_limit integer) TO yellow_runtime;


--
-- Name: FUNCTION runtime_due_hold_scopes(p_limit integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.runtime_due_hold_scopes(p_limit integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.runtime_due_hold_scopes(p_limit integer) TO yellow_runtime;


--
-- Name: FUNCTION runtime_extension_compatibility_inputs(p_type text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.runtime_extension_compatibility_inputs(p_type text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.runtime_extension_compatibility_inputs(p_type text) TO yellow_runtime;


--
-- Name: FUNCTION runtime_mark_outbox_published(p_event_ids uuid[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.runtime_mark_outbox_published(p_event_ids uuid[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.runtime_mark_outbox_published(p_event_ids uuid[]) TO yellow_runtime;


--
-- Name: FUNCTION runtime_prune_outbox(p_retention_seconds integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.runtime_prune_outbox(p_retention_seconds integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.runtime_prune_outbox(p_retention_seconds integer) TO yellow_runtime;


--
-- Name: FUNCTION runtime_resolve_active_tenant(p_slug text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.runtime_resolve_active_tenant(p_slug text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.runtime_resolve_active_tenant(p_slug text) TO yellow_runtime;


--
-- Name: FUNCTION runtime_visible_extension_effective_period(p_tenant uuid, p_extension uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.runtime_visible_extension_effective_period(p_tenant uuid, p_extension uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.runtime_visible_extension_effective_period(p_tenant uuid, p_extension uuid) TO yellow_runtime;


--
-- Name: FUNCTION runtime_visible_extensions(p_tenant uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.runtime_visible_extensions(p_tenant uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.runtime_visible_extensions(p_tenant uuid) TO yellow_runtime;


--
-- Name: FUNCTION seal_business_day(p_tenant uuid, p_property uuid, p_date date, p_user uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.seal_business_day(p_tenant uuid, p_property uuid, p_date date, p_user uuid) FROM PUBLIC;


--
-- Name: FUNCTION seal_business_day_audited(p_tenant uuid, p_property uuid, p_date date, p_actor uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.seal_business_day_audited(p_tenant uuid, p_property uuid, p_date date, p_actor uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.seal_business_day_audited(p_tenant uuid, p_property uuid, p_date date, p_actor uuid) TO app_role;


--
-- Name: FUNCTION transition_arrival_pickup_task(p_tenant uuid, p_property uuid, p_reservation uuid, p_task uuid, p_action text, p_expected_task_status text, p_expected_assignee_party uuid, p_staff_party uuid, p_actor uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.transition_arrival_pickup_task(p_tenant uuid, p_property uuid, p_reservation uuid, p_task uuid, p_action text, p_expected_task_status text, p_expected_assignee_party uuid, p_staff_party uuid, p_actor uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.transition_arrival_pickup_task(p_tenant uuid, p_property uuid, p_reservation uuid, p_task uuid, p_action text, p_expected_task_status text, p_expected_assignee_party uuid, p_staff_party uuid, p_actor uuid) TO app_role;


--
-- Name: FUNCTION transition_folio_status(p_tenant uuid, p_property uuid, p_folio uuid, p_action text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.transition_folio_status(p_tenant uuid, p_property uuid, p_folio uuid, p_action text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.transition_folio_status(p_tenant uuid, p_property uuid, p_folio uuid, p_action text) TO app_role;


--
-- Name: FUNCTION transition_housekeeping_task(p_tenant uuid, p_property uuid, p_task uuid, p_action text, p_expected_task_status text, p_expected_room_condition text, p_expected_room_updated_at timestamp with time zone, p_actor uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.transition_housekeeping_task(p_tenant uuid, p_property uuid, p_task uuid, p_action text, p_expected_task_status text, p_expected_room_condition text, p_expected_room_updated_at timestamp with time zone, p_actor uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.transition_housekeeping_task(p_tenant uuid, p_property uuid, p_task uuid, p_action text, p_expected_task_status text, p_expected_room_condition text, p_expected_room_updated_at timestamp with time zone, p_actor uuid) TO app_role;


--
-- Name: TABLE account; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.account TO app_role;


--
-- Name: COLUMN account.tenant_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(tenant_id) ON TABLE public.account TO app_role;


--
-- Name: COLUMN account.property_node; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(property_node) ON TABLE public.account TO app_role;


--
-- Name: COLUMN account.role; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(role) ON TABLE public.account TO app_role;


--
-- Name: COLUMN account.party_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(party_id) ON TABLE public.account TO app_role;


--
-- Name: COLUMN account.name; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(name) ON TABLE public.account TO app_role;


--
-- Name: COLUMN account.currency; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(currency) ON TABLE public.account TO app_role;


--
-- Name: COLUMN account.status; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(status) ON TABLE public.account TO app_role;


--
-- Name: TABLE address; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.address TO app_role;


--
-- Name: TABLE alert; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.alert TO app_role;


--
-- Name: TABLE api_client; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.api_client TO app_role;


--
-- Name: TABLE api_idempotency; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.api_idempotency TO app_role;


--
-- Name: COLUMN api_idempotency.tenant_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(tenant_id) ON TABLE public.api_idempotency TO app_role;


--
-- Name: COLUMN api_idempotency.operation; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(operation) ON TABLE public.api_idempotency TO app_role;


--
-- Name: COLUMN api_idempotency.key_hash; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(key_hash) ON TABLE public.api_idempotency TO app_role;


--
-- Name: COLUMN api_idempotency.request_hash; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(request_hash),UPDATE(request_hash) ON TABLE public.api_idempotency TO app_role;


--
-- Name: COLUMN api_idempotency.response_status; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(response_status) ON TABLE public.api_idempotency TO app_role;


--
-- Name: COLUMN api_idempotency.response_body; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(response_body) ON TABLE public.api_idempotency TO app_role;


--
-- Name: COLUMN api_idempotency.created_at; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(created_at),UPDATE(created_at) ON TABLE public.api_idempotency TO app_role;


--
-- Name: COLUMN api_idempotency.completed_at; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(completed_at) ON TABLE public.api_idempotency TO app_role;


--
-- Name: COLUMN api_idempotency.expires_at; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(expires_at),UPDATE(expires_at) ON TABLE public.api_idempotency TO app_role;


--
-- Name: TABLE app_user; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.app_user TO app_role;


--
-- Name: TABLE approval_request; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.approval_request TO app_role;


--
-- Name: COLUMN approval_request.tenant_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(tenant_id) ON TABLE public.approval_request TO app_role;


--
-- Name: COLUMN approval_request.kind; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(kind) ON TABLE public.approval_request TO app_role;


--
-- Name: COLUMN approval_request.subject_type; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(subject_type) ON TABLE public.approval_request TO app_role;


--
-- Name: COLUMN approval_request.subject_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(subject_id) ON TABLE public.approval_request TO app_role;


--
-- Name: COLUMN approval_request.requested_by; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(requested_by) ON TABLE public.approval_request TO app_role;


--
-- Name: COLUMN approval_request.payload; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(payload) ON TABLE public.approval_request TO app_role;


--
-- Name: COLUMN approval_request.status; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(status) ON TABLE public.approval_request TO app_role;


--
-- Name: COLUMN approval_request.decided_by; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(decided_by) ON TABLE public.approval_request TO app_role;


--
-- Name: COLUMN approval_request.decided_at; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(decided_at) ON TABLE public.approval_request TO app_role;


--
-- Name: TABLE ar_allocation; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.ar_allocation TO app_role;


--
-- Name: TABLE automation; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.automation TO app_role;


--
-- Name: TABLE availability_projection; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,DELETE ON TABLE public.availability_projection TO app_role;


--
-- Name: COLUMN availability_projection.tenant_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(tenant_id) ON TABLE public.availability_projection TO app_role;


--
-- Name: COLUMN availability_projection.property_node; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(property_node) ON TABLE public.availability_projection TO app_role;


--
-- Name: COLUMN availability_projection.unit_type_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(unit_type_id) ON TABLE public.availability_projection TO app_role;


--
-- Name: COLUMN availability_projection.stay_date; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(stay_date) ON TABLE public.availability_projection TO app_role;


--
-- Name: COLUMN availability_projection.physical; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(physical) ON TABLE public.availability_projection TO app_role;


--
-- Name: COLUMN availability_projection.sold; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(sold) ON TABLE public.availability_projection TO app_role;


--
-- Name: COLUMN availability_projection.held; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(held) ON TABLE public.availability_projection TO app_role;


--
-- Name: COLUMN availability_projection.blocked; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(blocked) ON TABLE public.availability_projection TO app_role;


--
-- Name: COLUMN availability_projection.ooo; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(ooo) ON TABLE public.availability_projection TO app_role;


--
-- Name: COLUMN availability_projection.updated_at; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(updated_at) ON TABLE public.availability_projection TO app_role;


--
-- Name: TABLE block_allotment; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.block_allotment TO app_role;


--
-- Name: TABLE block_status_def; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.block_status_def TO app_role;


--
-- Name: TABLE business_day; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.business_day TO app_role;


--
-- Name: TABLE business_day_discrepancy_carry; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.business_day_discrepancy_carry TO app_role;


--
-- Name: TABLE cash_drawer; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.cash_drawer TO app_role;


--
-- Name: TABLE cash_drawer_denomination; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.cash_drawer_denomination TO app_role;


--
-- Name: TABLE cashier_count; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.cashier_count TO app_role;


--
-- Name: TABLE cashier_count_line; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.cashier_count_line TO app_role;


--
-- Name: TABLE cashier_session; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.cashier_session TO app_role;


--
-- Name: TABLE channel; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.channel TO app_role;


--
-- Name: TABLE channel_map; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.channel_map TO app_role;


--
-- Name: TABLE consent; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.consent TO app_role;


--
-- Name: TABLE contact_point; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.contact_point TO app_role;


--
-- Name: COLUMN contact_point.tenant_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(tenant_id) ON TABLE public.contact_point TO app_role;


--
-- Name: COLUMN contact_point.party_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(party_id) ON TABLE public.contact_point TO app_role;


--
-- Name: COLUMN contact_point.kind; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(kind) ON TABLE public.contact_point TO app_role;


--
-- Name: COLUMN contact_point.value; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(value) ON TABLE public.contact_point TO app_role;


--
-- Name: COLUMN contact_point.is_primary; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(is_primary) ON TABLE public.contact_point TO app_role;


--
-- Name: COLUMN contact_point.verified; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(verified) ON TABLE public.contact_point TO app_role;


--
-- Name: TABLE rate_price; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.rate_price TO app_role;


--
-- Name: COLUMN rate_price.tenant_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(tenant_id) ON TABLE public.rate_price TO app_role;


--
-- Name: COLUMN rate_price.rate_plan_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(rate_plan_id) ON TABLE public.rate_price TO app_role;


--
-- Name: COLUMN rate_price.unit_type_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(unit_type_id) ON TABLE public.rate_price TO app_role;


--
-- Name: COLUMN rate_price.stay_dates; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(stay_dates) ON TABLE public.rate_price TO app_role;


--
-- Name: COLUMN rate_price.dow_mask; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(dow_mask) ON TABLE public.rate_price TO app_role;


--
-- Name: COLUMN rate_price.pricing; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(pricing) ON TABLE public.rate_price TO app_role;


--
-- Name: COLUMN rate_price.superseded_by; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(superseded_by) ON TABLE public.rate_price TO app_role;


--
-- Name: TABLE current_rate_price; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.current_rate_price TO app_role;


--
-- Name: TABLE deposit_application; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.deposit_application TO app_role;


--
-- Name: COLUMN deposit_application.tenant_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(tenant_id) ON TABLE public.deposit_application TO app_role;


--
-- Name: COLUMN deposit_application.id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(id) ON TABLE public.deposit_application TO app_role;


--
-- Name: COLUMN deposit_application.property_node; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(property_node) ON TABLE public.deposit_application TO app_role;


--
-- Name: COLUMN deposit_application.hosted_request_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(hosted_request_id) ON TABLE public.deposit_application TO app_role;


--
-- Name: COLUMN deposit_application.operation_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(operation_id) ON TABLE public.deposit_application TO app_role;


--
-- Name: COLUMN deposit_application.capture_payment_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(capture_payment_id) ON TABLE public.deposit_application TO app_role;


--
-- Name: COLUMN deposit_application.folio_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(folio_id) ON TABLE public.deposit_application TO app_role;


--
-- Name: COLUMN deposit_application.deposit_account_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(deposit_account_id) ON TABLE public.deposit_application TO app_role;


--
-- Name: COLUMN deposit_application.guest_account_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(guest_account_id) ON TABLE public.deposit_application TO app_role;


--
-- Name: COLUMN deposit_application.amount_minor; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(amount_minor) ON TABLE public.deposit_application TO app_role;


--
-- Name: COLUMN deposit_application.currency; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(currency) ON TABLE public.deposit_application TO app_role;


--
-- Name: COLUMN deposit_application.journal_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(journal_id) ON TABLE public.deposit_application TO app_role;


--
-- Name: COLUMN deposit_application.key_hash; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(key_hash) ON TABLE public.deposit_application TO app_role;


--
-- Name: COLUMN deposit_application.request_hash; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(request_hash) ON TABLE public.deposit_application TO app_role;


--
-- Name: COLUMN deposit_application.created_by; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(created_by) ON TABLE public.deposit_application TO app_role;


--
-- Name: TABLE discrepancy; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.discrepancy TO app_role;


--
-- Name: TABLE document; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.document TO app_role;


--
-- Name: TABLE document_series; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.document_series TO app_role;


--
-- Name: COLUMN document_series.next_no; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(next_no) ON TABLE public.document_series TO app_role;


--
-- Name: TABLE erasure_request; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.erasure_request TO app_role;


--
-- Name: TABLE extension; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.extension TO app_role;


--
-- Name: COLUMN extension.tenant_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(tenant_id) ON TABLE public.extension TO app_role;


--
-- Name: COLUMN extension.type; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(type) ON TABLE public.extension TO app_role;


--
-- Name: COLUMN extension.key; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(key) ON TABLE public.extension TO app_role;


--
-- Name: COLUMN extension.version; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(version) ON TABLE public.extension TO app_role;


--
-- Name: COLUMN extension.content; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(content) ON TABLE public.extension TO app_role;


--
-- Name: COLUMN extension.status; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(status),UPDATE(status) ON TABLE public.extension TO app_role;


--
-- Name: TABLE extension_type; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.extension_type TO app_role;


--
-- Name: TABLE fact_log; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.fact_log TO app_role;


--
-- Name: COLUMN fact_log.tenant_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(tenant_id) ON TABLE public.fact_log TO app_role;


--
-- Name: COLUMN fact_log.entity_type; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(entity_type) ON TABLE public.fact_log TO app_role;


--
-- Name: COLUMN fact_log.entity_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(entity_id) ON TABLE public.fact_log TO app_role;


--
-- Name: COLUMN fact_log.fact_type; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(fact_type) ON TABLE public.fact_log TO app_role;


--
-- Name: COLUMN fact_log.valid_from; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(valid_from) ON TABLE public.fact_log TO app_role;


--
-- Name: COLUMN fact_log.business_date; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(business_date) ON TABLE public.fact_log TO app_role;


--
-- Name: COLUMN fact_log.actor_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(actor_id) ON TABLE public.fact_log TO app_role;


--
-- Name: COLUMN fact_log.payload; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(payload) ON TABLE public.fact_log TO app_role;


--
-- Name: COLUMN fact_log.supersedes; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(supersedes) ON TABLE public.fact_log TO app_role;


--
-- Name: TABLE fiscal_submission; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.fiscal_submission TO app_role;


--
-- Name: TABLE folio; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.folio TO app_role;


--
-- Name: COLUMN folio.tenant_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(tenant_id) ON TABLE public.folio TO app_role;


--
-- Name: COLUMN folio.account_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(account_id) ON TABLE public.folio TO app_role;


--
-- Name: COLUMN folio.reservation_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(reservation_id) ON TABLE public.folio TO app_role;


--
-- Name: COLUMN folio.folio_no; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(folio_no) ON TABLE public.folio TO app_role;


--
-- Name: COLUMN folio.window_no; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(window_no) ON TABLE public.folio TO app_role;


--
-- Name: COLUMN folio.name; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(name) ON TABLE public.folio TO app_role;


--
-- Name: COLUMN folio.status; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(status) ON TABLE public.folio TO app_role;


--
-- Name: TABLE posting_line; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.posting_line TO app_role;


--
-- Name: COLUMN posting_line.tenant_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(tenant_id) ON TABLE public.posting_line TO app_role;


--
-- Name: COLUMN posting_line.journal_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(journal_id) ON TABLE public.posting_line TO app_role;


--
-- Name: COLUMN posting_line.seq; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(seq) ON TABLE public.posting_line TO app_role;


--
-- Name: COLUMN posting_line.account_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(account_id) ON TABLE public.posting_line TO app_role;


--
-- Name: COLUMN posting_line.folio_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(folio_id) ON TABLE public.posting_line TO app_role;


--
-- Name: COLUMN posting_line.tx_code; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(tx_code) ON TABLE public.posting_line TO app_role;


--
-- Name: COLUMN posting_line.description; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(description) ON TABLE public.posting_line TO app_role;


--
-- Name: COLUMN posting_line.amount_minor; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(amount_minor) ON TABLE public.posting_line TO app_role;


--
-- Name: COLUMN posting_line.quantity; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(quantity) ON TABLE public.posting_line TO app_role;


--
-- Name: COLUMN posting_line.business_date; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(business_date) ON TABLE public.posting_line TO app_role;


--
-- Name: COLUMN posting_line.currency; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(currency) ON TABLE public.posting_line TO app_role;


--
-- Name: TABLE folio_balance; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.folio_balance TO app_role;


--
-- Name: TABLE hold; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.hold TO app_role;


--
-- Name: COLUMN hold.tenant_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(tenant_id) ON TABLE public.hold TO app_role;


--
-- Name: COLUMN hold.property_node; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(property_node) ON TABLE public.hold TO app_role;


--
-- Name: COLUMN hold.sellable_unit_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(sellable_unit_id) ON TABLE public.hold TO app_role;


--
-- Name: COLUMN hold.period; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(period) ON TABLE public.hold TO app_role;


--
-- Name: COLUMN hold.kind; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(kind) ON TABLE public.hold TO app_role;


--
-- Name: COLUMN hold.holder; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(holder) ON TABLE public.hold TO app_role;


--
-- Name: COLUMN hold.expires_at; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(expires_at) ON TABLE public.hold TO app_role;


--
-- Name: COLUMN hold.status; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(status) ON TABLE public.hold TO app_role;


--
-- Name: TABLE hosted_payment_request; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.hosted_payment_request TO app_role;


--
-- Name: COLUMN hosted_payment_request.tenant_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(tenant_id) ON TABLE public.hosted_payment_request TO app_role;


--
-- Name: COLUMN hosted_payment_request.id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(id) ON TABLE public.hosted_payment_request TO app_role;


--
-- Name: COLUMN hosted_payment_request.property_node; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(property_node) ON TABLE public.hosted_payment_request TO app_role;


--
-- Name: COLUMN hosted_payment_request.folio_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(folio_id) ON TABLE public.hosted_payment_request TO app_role;


--
-- Name: COLUMN hosted_payment_request.guest_account_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(guest_account_id) ON TABLE public.hosted_payment_request TO app_role;


--
-- Name: COLUMN hosted_payment_request.operation_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(operation_id) ON TABLE public.hosted_payment_request TO app_role;


--
-- Name: COLUMN hosted_payment_request.deposit_account_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(deposit_account_id) ON TABLE public.hosted_payment_request TO app_role;


--
-- Name: COLUMN hosted_payment_request.amount_minor; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(amount_minor) ON TABLE public.hosted_payment_request TO app_role;


--
-- Name: COLUMN hosted_payment_request.currency; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(currency) ON TABLE public.hosted_payment_request TO app_role;


--
-- Name: COLUMN hosted_payment_request.bearer_hash; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(bearer_hash) ON TABLE public.hosted_payment_request TO app_role;


--
-- Name: COLUMN hosted_payment_request.key_hash; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(key_hash) ON TABLE public.hosted_payment_request TO app_role;


--
-- Name: COLUMN hosted_payment_request.request_hash; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(request_hash) ON TABLE public.hosted_payment_request TO app_role;


--
-- Name: COLUMN hosted_payment_request.generation; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(generation) ON TABLE public.hosted_payment_request TO app_role;


--
-- Name: COLUMN hosted_payment_request.created_by; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(created_by) ON TABLE public.hosted_payment_request TO app_role;


--
-- Name: COLUMN hosted_payment_request.expires_at; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(expires_at) ON TABLE public.hosted_payment_request TO app_role;


--
-- Name: TABLE identity_document; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.identity_document TO app_role;


--
-- Name: TABLE inbound_message; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.inbound_message TO app_role;


--
-- Name: TABLE india_gst_accommodation_final_component_tax; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.india_gst_accommodation_final_component_tax TO app_role;


--
-- Name: TABLE india_gst_accommodation_final_component_tax_component; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.india_gst_accommodation_final_component_tax_component TO app_role;


--
-- Name: TABLE india_gst_accommodation_final_component_tax_room_night; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.india_gst_accommodation_final_component_tax_room_night TO app_role;


--
-- Name: TABLE india_gst_accommodation_final_valuation; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.india_gst_accommodation_final_valuation TO app_role;


--
-- Name: TABLE india_gst_accommodation_invoice_issue_snapshot; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.india_gst_accommodation_invoice_issue_snapshot TO app_role;


--
-- Name: TABLE india_gst_accommodation_payment_receipt_snapshot; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.india_gst_accommodation_payment_receipt_snapshot TO app_role;


--
-- Name: TABLE india_gst_accommodation_quoted_rate_applicability; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.india_gst_accommodation_quoted_rate_applicability TO app_role;


--
-- Name: TABLE india_gst_accommodation_quoted_rate_applicability_room_night; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.india_gst_accommodation_quoted_rate_applicability_room_night TO app_role;


--
-- Name: TABLE india_gst_accommodation_quoted_rate_component; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.india_gst_accommodation_quoted_rate_component TO app_role;


--
-- Name: TABLE india_gst_accommodation_service_provision_snapshot; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.india_gst_accommodation_service_provision_snapshot TO app_role;


--
-- Name: TABLE india_gst_accommodation_valuation_allocation; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.india_gst_accommodation_valuation_allocation TO app_role;


--
-- Name: TABLE india_gst_accommodation_valuation_room_night; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.india_gst_accommodation_valuation_room_night TO app_role;


--
-- Name: TABLE india_gst_accommodation_valuation_source; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.india_gst_accommodation_valuation_source TO app_role;


--
-- Name: TABLE india_gst_item_classification; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.india_gst_item_classification TO app_role;


--
-- Name: TABLE india_gst_recipient_sez_status; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.india_gst_recipient_sez_status TO app_role;


--
-- Name: TABLE india_gst_supplier_registration_status_snapshot; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.india_gst_supplier_registration_status_snapshot TO app_role;


--
-- Name: TABLE india_gst_supplier_service_location; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.india_gst_supplier_service_location TO app_role;


--
-- Name: TABLE india_gst_supplier_sez_status; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.india_gst_supplier_sez_status TO app_role;


--
-- Name: TABLE india_sez_unit_loa_renewal; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.india_sez_unit_loa_renewal TO app_role;


--
-- Name: TABLE inventory_authority; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.inventory_authority TO app_role;


--
-- Name: TABLE journal; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.journal TO app_role;


--
-- Name: COLUMN journal.tenant_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(tenant_id) ON TABLE public.journal TO app_role;


--
-- Name: COLUMN journal.property_node; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(property_node) ON TABLE public.journal TO app_role;


--
-- Name: COLUMN journal.business_date; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(business_date) ON TABLE public.journal TO app_role;


--
-- Name: COLUMN journal.kind; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(kind) ON TABLE public.journal TO app_role;


--
-- Name: COLUMN journal.description; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(description) ON TABLE public.journal TO app_role;


--
-- Name: COLUMN journal.currency; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(currency) ON TABLE public.journal TO app_role;


--
-- Name: COLUMN journal.source; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(source) ON TABLE public.journal TO app_role;


--
-- Name: COLUMN journal.created_by; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(created_by) ON TABLE public.journal TO app_role;


--
-- Name: TABLE membership; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.membership TO app_role;


--
-- Name: TABLE message; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.message TO app_role;


--
-- Name: TABLE negotiated_rate; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.negotiated_rate TO app_role;


--
-- Name: TABLE ooo_oos; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.ooo_oos TO app_role;


--
-- Name: COLUMN ooo_oos.tenant_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(tenant_id) ON TABLE public.ooo_oos TO app_role;


--
-- Name: COLUMN ooo_oos.space_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(space_id) ON TABLE public.ooo_oos TO app_role;


--
-- Name: COLUMN ooo_oos.kind; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(kind) ON TABLE public.ooo_oos TO app_role;


--
-- Name: COLUMN ooo_oos.period; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(period),UPDATE(period) ON TABLE public.ooo_oos TO app_role;


--
-- Name: COLUMN ooo_oos.reason; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(reason) ON TABLE public.ooo_oos TO app_role;


--
-- Name: TABLE org_node; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.org_node TO app_role;


--
-- Name: COLUMN org_node.config; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(config) ON TABLE public.org_node TO app_role;


--
-- Name: TABLE outbox; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.outbox TO app_role;


--
-- Name: COLUMN outbox.tenant_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(tenant_id) ON TABLE public.outbox TO app_role;


--
-- Name: COLUMN outbox.property_node; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(property_node) ON TABLE public.outbox TO app_role;


--
-- Name: COLUMN outbox.business_date; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(business_date) ON TABLE public.outbox TO app_role;


--
-- Name: COLUMN outbox.aggregate_type; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(aggregate_type) ON TABLE public.outbox TO app_role;


--
-- Name: COLUMN outbox.aggregate_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(aggregate_id) ON TABLE public.outbox TO app_role;


--
-- Name: COLUMN outbox.event_type; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(event_type) ON TABLE public.outbox TO app_role;


--
-- Name: COLUMN outbox.event_version; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(event_version) ON TABLE public.outbox TO app_role;


--
-- Name: COLUMN outbox.actor_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(actor_id) ON TABLE public.outbox TO app_role;


--
-- Name: COLUMN outbox.correlation_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(correlation_id) ON TABLE public.outbox TO app_role;


--
-- Name: COLUMN outbox.causation_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(causation_id) ON TABLE public.outbox TO app_role;


--
-- Name: COLUMN outbox.payload; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(payload) ON TABLE public.outbox TO app_role;


--
-- Name: TABLE overbooking_limit; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.overbooking_limit TO app_role;


--
-- Name: TABLE package; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.package TO app_role;


--
-- Name: TABLE package_element; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.package_element TO app_role;


--
-- Name: TABLE party; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.party TO app_role;


--
-- Name: COLUMN party.tenant_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(tenant_id) ON TABLE public.party TO app_role;


--
-- Name: COLUMN party.kind; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(kind) ON TABLE public.party TO app_role;


--
-- Name: COLUMN party.display_name; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(display_name) ON TABLE public.party TO app_role;


--
-- Name: COLUMN party.legal_name; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(legal_name) ON TABLE public.party TO app_role;


--
-- Name: TABLE party_fiscal_registration; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.party_fiscal_registration TO app_role;


--
-- Name: TABLE party_relationship; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.party_relationship TO app_role;


--
-- Name: TABLE party_role; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.party_role TO app_role;


--
-- Name: COLUMN party_role.tenant_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(tenant_id) ON TABLE public.party_role TO app_role;


--
-- Name: COLUMN party_role.party_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(party_id) ON TABLE public.party_role TO app_role;


--
-- Name: COLUMN party_role.role; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(role) ON TABLE public.party_role TO app_role;


--
-- Name: TABLE payment; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.payment TO app_role;


--
-- Name: COLUMN payment.tenant_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(tenant_id) ON TABLE public.payment TO app_role;


--
-- Name: COLUMN payment.journal_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(journal_id) ON TABLE public.payment TO app_role;


--
-- Name: COLUMN payment.instrument_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(instrument_id) ON TABLE public.payment TO app_role;


--
-- Name: COLUMN payment.psp; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(psp) ON TABLE public.payment TO app_role;


--
-- Name: COLUMN payment.psp_ref; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(psp_ref) ON TABLE public.payment TO app_role;


--
-- Name: COLUMN payment.method; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(method) ON TABLE public.payment TO app_role;


--
-- Name: COLUMN payment.phase; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(phase) ON TABLE public.payment TO app_role;


--
-- Name: COLUMN payment.amount_minor; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(amount_minor) ON TABLE public.payment TO app_role;


--
-- Name: COLUMN payment.currency; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(currency) ON TABLE public.payment TO app_role;


--
-- Name: COLUMN payment.status; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(status) ON TABLE public.payment TO app_role;


--
-- Name: COLUMN payment.operation_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(operation_id) ON TABLE public.payment TO app_role;


--
-- Name: COLUMN payment.predecessor_payment_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(predecessor_payment_id) ON TABLE public.payment TO app_role;


--
-- Name: COLUMN payment.receipt_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(receipt_id) ON TABLE public.payment TO app_role;


--
-- Name: COLUMN payment.capture_payment_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(capture_payment_id) ON TABLE public.payment TO app_role;


--
-- Name: COLUMN payment.capture_journal_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(capture_journal_id) ON TABLE public.payment TO app_role;


--
-- Name: COLUMN payment.attempt_no; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(attempt_no) ON TABLE public.payment TO app_role;


--
-- Name: COLUMN payment.result_code; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(result_code) ON TABLE public.payment TO app_role;


--
-- Name: COLUMN payment.command_key_hash; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(command_key_hash) ON TABLE public.payment TO app_role;


--
-- Name: COLUMN payment.request_hash; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(request_hash) ON TABLE public.payment TO app_role;


--
-- Name: TABLE payment_instrument; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.payment_instrument TO app_role;


--
-- Name: TABLE payment_operation; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.payment_operation TO app_role;


--
-- Name: COLUMN payment_operation.tenant_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(tenant_id) ON TABLE public.payment_operation TO app_role;


--
-- Name: COLUMN payment_operation.id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(id) ON TABLE public.payment_operation TO app_role;


--
-- Name: COLUMN payment_operation.property_node; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(property_node) ON TABLE public.payment_operation TO app_role;


--
-- Name: COLUMN payment_operation.folio_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(folio_id) ON TABLE public.payment_operation TO app_role;


--
-- Name: COLUMN payment_operation.guest_account_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(guest_account_id) ON TABLE public.payment_operation TO app_role;


--
-- Name: COLUMN payment_operation.instrument_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(instrument_id) ON TABLE public.payment_operation TO app_role;


--
-- Name: COLUMN payment_operation.provider; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(provider) ON TABLE public.payment_operation TO app_role;


--
-- Name: COLUMN payment_operation.method; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(method) ON TABLE public.payment_operation TO app_role;


--
-- Name: COLUMN payment_operation.currency; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(currency) ON TABLE public.payment_operation TO app_role;


--
-- Name: COLUMN payment_operation.tx_code; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(tx_code) ON TABLE public.payment_operation TO app_role;


--
-- Name: COLUMN payment_operation.clearing_account_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(clearing_account_id) ON TABLE public.payment_operation TO app_role;


--
-- Name: COLUMN payment_operation.purpose; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(purpose) ON TABLE public.payment_operation TO app_role;


--
-- Name: COLUMN payment_operation.key_hash; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(key_hash) ON TABLE public.payment_operation TO app_role;


--
-- Name: COLUMN payment_operation.request_hash; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(request_hash) ON TABLE public.payment_operation TO app_role;


--
-- Name: COLUMN payment_operation.actor_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(actor_id) ON TABLE public.payment_operation TO app_role;


--
-- Name: COLUMN payment_operation.deposit_account_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(deposit_account_id) ON TABLE public.payment_operation TO app_role;


--
-- Name: TABLE permission; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.permission TO app_role;


--
-- Name: TABLE policy; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.policy TO app_role;


--
-- Name: COLUMN policy.tenant_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(tenant_id) ON TABLE public.policy TO app_role;


--
-- Name: COLUMN policy.kind; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(kind) ON TABLE public.policy TO app_role;


--
-- Name: COLUMN policy.name; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(name) ON TABLE public.policy TO app_role;


--
-- Name: COLUMN policy.content; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(content) ON TABLE public.policy TO app_role;


--
-- Name: TABLE preference; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.preference TO app_role;


--
-- Name: TABLE promotion; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.promotion TO app_role;


--
-- Name: TABLE property_fiscal_location; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.property_fiscal_location TO app_role;


--
-- Name: TABLE property_fiscal_registration; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.property_fiscal_registration TO app_role;


--
-- Name: TABLE provider_event_receipt; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.provider_event_receipt TO app_role;


--
-- Name: COLUMN provider_event_receipt.tenant_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(tenant_id) ON TABLE public.provider_event_receipt TO app_role;


--
-- Name: COLUMN provider_event_receipt.operation_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(operation_id) ON TABLE public.provider_event_receipt TO app_role;


--
-- Name: COLUMN provider_event_receipt.provider; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(provider) ON TABLE public.provider_event_receipt TO app_role;


--
-- Name: COLUMN provider_event_receipt.event_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(event_id) ON TABLE public.provider_event_receipt TO app_role;


--
-- Name: COLUMN provider_event_receipt.content_hash; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(content_hash) ON TABLE public.provider_event_receipt TO app_role;


--
-- Name: COLUMN provider_event_receipt.provider_reference; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(provider_reference) ON TABLE public.provider_event_receipt TO app_role;


--
-- Name: COLUMN provider_event_receipt.phase; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(phase) ON TABLE public.provider_event_receipt TO app_role;


--
-- Name: COLUMN provider_event_receipt.outcome; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(outcome) ON TABLE public.provider_event_receipt TO app_role;


--
-- Name: COLUMN provider_event_receipt.amount_minor; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(amount_minor) ON TABLE public.provider_event_receipt TO app_role;


--
-- Name: COLUMN provider_event_receipt.currency; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(currency) ON TABLE public.provider_event_receipt TO app_role;


--
-- Name: TABLE push_cursor; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.push_cursor TO app_role;


--
-- Name: TABLE queue_entry; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.queue_entry TO app_role;


--
-- Name: TABLE rate_plan; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.rate_plan TO app_role;


--
-- Name: COLUMN rate_plan.tenant_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(tenant_id) ON TABLE public.rate_plan TO app_role;


--
-- Name: COLUMN rate_plan.property_node; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(property_node) ON TABLE public.rate_plan TO app_role;


--
-- Name: COLUMN rate_plan.code; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(code) ON TABLE public.rate_plan TO app_role;


--
-- Name: COLUMN rate_plan.name; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(name) ON TABLE public.rate_plan TO app_role;


--
-- Name: COLUMN rate_plan.currency; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(currency) ON TABLE public.rate_plan TO app_role;


--
-- Name: COLUMN rate_plan.tax_inclusive; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(tax_inclusive) ON TABLE public.rate_plan TO app_role;


--
-- Name: COLUMN rate_plan.cancellation_policy; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(cancellation_policy) ON TABLE public.rate_plan TO app_role;


--
-- Name: COLUMN rate_plan.guarantee_policy; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(guarantee_policy) ON TABLE public.rate_plan TO app_role;


--
-- Name: COLUMN rate_plan.deposit_policy; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(deposit_policy) ON TABLE public.rate_plan TO app_role;


--
-- Name: COLUMN rate_plan.market_code; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(market_code) ON TABLE public.rate_plan TO app_role;


--
-- Name: COLUMN rate_plan.source_code; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(source_code) ON TABLE public.rate_plan TO app_role;


--
-- Name: TABLE rate_plan_package; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.rate_plan_package TO app_role;


--
-- Name: TABLE reservation; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.reservation TO app_role;


--
-- Name: COLUMN reservation.id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(id) ON TABLE public.reservation TO app_role;


--
-- Name: COLUMN reservation.tenant_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(tenant_id) ON TABLE public.reservation TO app_role;


--
-- Name: COLUMN reservation.property_node; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(property_node) ON TABLE public.reservation TO app_role;


--
-- Name: COLUMN reservation.confirmation_no; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(confirmation_no) ON TABLE public.reservation TO app_role;


--
-- Name: COLUMN reservation.status; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(status),UPDATE(status) ON TABLE public.reservation TO app_role;


--
-- Name: COLUMN reservation.primary_party; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(primary_party) ON TABLE public.reservation TO app_role;


--
-- Name: COLUMN reservation.channel_code; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(channel_code) ON TABLE public.reservation TO app_role;


--
-- Name: COLUMN reservation.market_code; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(market_code),UPDATE(market_code) ON TABLE public.reservation TO app_role;


--
-- Name: COLUMN reservation.source_code; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(source_code),UPDATE(source_code) ON TABLE public.reservation TO app_role;


--
-- Name: COLUMN reservation.origin_code; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(origin_code) ON TABLE public.reservation TO app_role;


--
-- Name: COLUMN reservation.currency; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(currency) ON TABLE public.reservation TO app_role;


--
-- Name: COLUMN reservation.guarantee_policy; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(guarantee_policy) ON TABLE public.reservation TO app_role;


--
-- Name: COLUMN reservation.eta; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(eta) ON TABLE public.reservation TO app_role;


--
-- Name: COLUMN reservation.etd; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(etd) ON TABLE public.reservation TO app_role;


--
-- Name: COLUMN reservation.notes; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(notes) ON TABLE public.reservation TO app_role;


--
-- Name: COLUMN reservation.cancelled_at; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(cancelled_at) ON TABLE public.reservation TO app_role;


--
-- Name: COLUMN reservation.cancel_reason; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(cancel_reason) ON TABLE public.reservation TO app_role;


--
-- Name: COLUMN reservation.cancellation_no; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(cancellation_no) ON TABLE public.reservation TO app_role;


--
-- Name: TABLE reservation_group; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.reservation_group TO app_role;


--
-- Name: TABLE reservation_guest; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,DELETE ON TABLE public.reservation_guest TO app_role;


--
-- Name: COLUMN reservation_guest.tenant_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(tenant_id) ON TABLE public.reservation_guest TO app_role;


--
-- Name: COLUMN reservation_guest.reservation_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(reservation_id) ON TABLE public.reservation_guest TO app_role;


--
-- Name: COLUMN reservation_guest.party_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(party_id) ON TABLE public.reservation_guest TO app_role;


--
-- Name: COLUMN reservation_guest.role; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(role),UPDATE(role) ON TABLE public.reservation_guest TO app_role;


--
-- Name: COLUMN reservation_guest.share_pct; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(share_pct),UPDATE(share_pct) ON TABLE public.reservation_guest TO app_role;


--
-- Name: TABLE reservation_segment; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.reservation_segment TO app_role;


--
-- Name: COLUMN reservation_segment.id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(id) ON TABLE public.reservation_segment TO app_role;


--
-- Name: COLUMN reservation_segment.tenant_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(tenant_id) ON TABLE public.reservation_segment TO app_role;


--
-- Name: COLUMN reservation_segment.reservation_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(reservation_id) ON TABLE public.reservation_segment TO app_role;


--
-- Name: COLUMN reservation_segment.seq; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(seq) ON TABLE public.reservation_segment TO app_role;


--
-- Name: COLUMN reservation_segment.unit_type_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(unit_type_id) ON TABLE public.reservation_segment TO app_role;


--
-- Name: COLUMN reservation_segment.sellable_unit_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(sellable_unit_id) ON TABLE public.reservation_segment TO app_role;


--
-- Name: COLUMN reservation_segment.period; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(period),UPDATE(period) ON TABLE public.reservation_segment TO app_role;


--
-- Name: COLUMN reservation_segment.adults; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(adults) ON TABLE public.reservation_segment TO app_role;


--
-- Name: COLUMN reservation_segment.children; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(children) ON TABLE public.reservation_segment TO app_role;


--
-- Name: COLUMN reservation_segment.rate_plan_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(rate_plan_id) ON TABLE public.reservation_segment TO app_role;


--
-- Name: COLUMN reservation_segment.price_override; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(price_override) ON TABLE public.reservation_segment TO app_role;


--
-- Name: COLUMN reservation_segment.status; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(status),UPDATE(status) ON TABLE public.reservation_segment TO app_role;


--
-- Name: TABLE restriction; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.restriction TO app_role;


--
-- Name: COLUMN restriction.tenant_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(tenant_id) ON TABLE public.restriction TO app_role;


--
-- Name: COLUMN restriction.scope_node; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(scope_node) ON TABLE public.restriction TO app_role;


--
-- Name: COLUMN restriction.unit_type_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(unit_type_id) ON TABLE public.restriction TO app_role;


--
-- Name: COLUMN restriction.rate_plan_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(rate_plan_id) ON TABLE public.restriction TO app_role;


--
-- Name: COLUMN restriction.channel_code; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(channel_code) ON TABLE public.restriction TO app_role;


--
-- Name: COLUMN restriction.kind; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(kind) ON TABLE public.restriction TO app_role;


--
-- Name: COLUMN restriction.value; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(value) ON TABLE public.restriction TO app_role;


--
-- Name: COLUMN restriction.stay_dates; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(stay_dates) ON TABLE public.restriction TO app_role;


--
-- Name: COLUMN restriction.source; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(source) ON TABLE public.restriction TO app_role;


--
-- Name: TABLE role; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.role TO app_role;


--
-- Name: TABLE role_permission; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.role_permission TO app_role;


--
-- Name: TABLE sellable_unit; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.sellable_unit TO app_role;


--
-- Name: COLUMN sellable_unit.tenant_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(tenant_id) ON TABLE public.sellable_unit TO app_role;


--
-- Name: COLUMN sellable_unit.unit_type_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(unit_type_id) ON TABLE public.sellable_unit TO app_role;


--
-- Name: COLUMN sellable_unit.name; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(name) ON TABLE public.sellable_unit TO app_role;


--
-- Name: TABLE sellable_unit_space; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.sellable_unit_space TO app_role;


--
-- Name: COLUMN sellable_unit_space.tenant_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(tenant_id) ON TABLE public.sellable_unit_space TO app_role;


--
-- Name: COLUMN sellable_unit_space.sellable_unit_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(sellable_unit_id) ON TABLE public.sellable_unit_space TO app_role;


--
-- Name: COLUMN sellable_unit_space.space_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(space_id) ON TABLE public.sellable_unit_space TO app_role;


--
-- Name: COLUMN sellable_unit_space.claim_mode; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(claim_mode) ON TABLE public.sellable_unit_space TO app_role;


--
-- Name: TABLE space; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.space TO app_role;


--
-- Name: COLUMN space.tenant_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(tenant_id) ON TABLE public.space TO app_role;


--
-- Name: COLUMN space.property_node; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(property_node) ON TABLE public.space TO app_role;


--
-- Name: COLUMN space.code; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(code) ON TABLE public.space TO app_role;


--
-- Name: COLUMN space.profile_key; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(profile_key) ON TABLE public.space TO app_role;


--
-- Name: COLUMN space.capacity; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(capacity) ON TABLE public.space TO app_role;


--
-- Name: COLUMN space.max_occupancy; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(max_occupancy) ON TABLE public.space TO app_role;


--
-- Name: COLUMN space.floor; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(floor) ON TABLE public.space TO app_role;


--
-- Name: COLUMN space.area_sqm; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(area_sqm) ON TABLE public.space TO app_role;


--
-- Name: COLUMN space.gender_policy; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(gender_policy) ON TABLE public.space TO app_role;


--
-- Name: COLUMN space.attrs; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(attrs) ON TABLE public.space TO app_role;


--
-- Name: TABLE space_occupancy; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.space_occupancy TO app_role;


--
-- Name: TABLE space_relation; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.space_relation TO app_role;


--
-- Name: TABLE stats_daily; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.stats_daily TO app_role;


--
-- Name: TABLE statutory_submission; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.statutory_submission TO app_role;


--
-- Name: TABLE task; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.task TO app_role;


--
-- Name: TABLE task_sheet; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.task_sheet TO app_role;


--
-- Name: TABLE tax_assignment; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.tax_assignment TO app_role;


--
-- Name: TABLE tax_attribution_hold_binding; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.tax_attribution_hold_binding TO app_role;


--
-- Name: TABLE tax_attribution_journal_binding; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.tax_attribution_journal_binding TO app_role;


--
-- Name: TABLE tax_attribution_reservation_binding; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.tax_attribution_reservation_binding TO app_role;


--
-- Name: TABLE tax_attribution_snapshot; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.tax_attribution_snapshot TO app_role;


--
-- Name: TABLE tax_semantic_route; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.tax_semantic_route TO app_role;


--
-- Name: TABLE tenant; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.tenant TO app_role;


--
-- Name: TABLE travel_detail; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.travel_detail TO app_role;


--
-- Name: TABLE trust_negative_authorization; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.trust_negative_authorization TO app_role;


--
-- Name: TABLE tx_code; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.tx_code TO app_role;


--
-- Name: TABLE tx_code_route; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.tx_code_route TO app_role;


--
-- Name: TABLE unit_condition; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.unit_condition TO app_role;


--
-- Name: TABLE unit_type; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.unit_type TO app_role;


--
-- Name: COLUMN unit_type.tenant_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(tenant_id) ON TABLE public.unit_type TO app_role;


--
-- Name: COLUMN unit_type.property_node; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(property_node) ON TABLE public.unit_type TO app_role;


--
-- Name: COLUMN unit_type.code; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(code) ON TABLE public.unit_type TO app_role;


--
-- Name: COLUMN unit_type.name; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(name) ON TABLE public.unit_type TO app_role;


--
-- Name: COLUMN unit_type.profile_key; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(profile_key) ON TABLE public.unit_type TO app_role;


--
-- Name: COLUMN unit_type.base_occupancy; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(base_occupancy) ON TABLE public.unit_type TO app_role;


--
-- Name: COLUMN unit_type.max_occupancy; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(max_occupancy) ON TABLE public.unit_type TO app_role;


--
-- Name: COLUMN unit_type.attrs; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(attrs) ON TABLE public.unit_type TO app_role;


--
-- Name: COLUMN unit_type.sort_order; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(sort_order) ON TABLE public.unit_type TO app_role;


--
-- Name: TABLE user_role; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.user_role TO app_role;


--
-- Name: TABLE vehicle; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.vehicle TO app_role;


--
-- Name: TABLE waitlist_entry; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.waitlist_entry TO app_role;


--
-- PostgreSQL database dump complete
--
