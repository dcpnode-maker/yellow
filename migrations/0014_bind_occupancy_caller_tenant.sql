-- Bind the occupancy choke points to transaction tenant authority and exact typed
-- parents. Signatures, owners and existing EXECUTE ACLs are intentionally preserved.

CREATE OR REPLACE FUNCTION public.record_occupancy(
  p_tenant uuid, p_space uuid, p_period tstzrange,
  p_slot uuid, p_slot_kind text, p_exclusive boolean
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
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

CREATE OR REPLACE FUNCTION public.release_occupancy(p_tenant uuid, p_slot uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
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
