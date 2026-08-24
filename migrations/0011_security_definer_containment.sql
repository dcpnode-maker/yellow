-- SECURITY DEFINER functions must not resolve attacker-owned temporary objects.
-- PostgreSQL searches pg_temp before an implicit search_path entry, so every Yellow
-- object is schema-qualified and pg_temp is placed explicitly last.

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
BEGIN
  IF p_exclusive THEN
    INSERT INTO public.space_occupancy
      (tenant_id, space_id, period, slot_ref, slot_kind, exclusive, claim)
    VALUES
      (p_tenant, p_space, p_period, p_slot, p_slot_kind, true,
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
       AND tenant_id = p_tenant;
    SELECT g.p
      INTO v_pos
      FROM pg_catalog.generate_series(0, v_cap - 1) AS g(p)
     WHERE NOT EXISTS (
       SELECT 1
         FROM public.space_occupancy AS so
        WHERE so.tenant_id = p_tenant
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
      (p_tenant, p_space, p_period, p_slot, p_slot_kind, false,
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
  n int;
BEGIN
  DELETE FROM public.space_occupancy
   WHERE tenant_id = p_tenant
     AND slot_ref = p_slot;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.prune_outbox(
  p_retain interval DEFAULT interval '30 days'
) RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
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

CREATE OR REPLACE FUNCTION public.expire_holds()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
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

CREATE OR REPLACE FUNCTION public.assert_day_open()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
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

CREATE OR REPLACE FUNCTION public.seal_business_day(
  p_tenant uuid,
  p_property uuid,
  p_date date,
  p_user uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
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

REVOKE ALL ON FUNCTION public.record_occupancy(uuid,uuid,tstzrange,uuid,text,boolean)
  FROM PUBLIC, app_role;
REVOKE ALL ON FUNCTION public.release_occupancy(uuid,uuid)
  FROM PUBLIC, app_role;
REVOKE ALL ON FUNCTION public.expire_holds()
  FROM PUBLIC, app_role;
REVOKE ALL ON FUNCTION public.prune_outbox(interval)
  FROM PUBLIC, app_role;
REVOKE ALL ON FUNCTION public.assert_day_open()
  FROM PUBLIC, app_role;
REVOKE ALL ON FUNCTION public.seal_business_day(uuid,uuid,date,uuid)
  FROM PUBLIC, app_role;

GRANT EXECUTE ON FUNCTION public.record_occupancy(uuid,uuid,tstzrange,uuid,text,boolean)
  TO app_role;
GRANT EXECUTE ON FUNCTION public.release_occupancy(uuid,uuid)
  TO app_role;
GRANT EXECUTE ON FUNCTION public.seal_business_day(uuid,uuid,date,uuid)
  TO app_role;

COMMENT ON FUNCTION public.prune_outbox(interval) IS
  'Deployment-owner outbox retention helper; app execution forbidden; non-negative retention required.';
COMMENT ON FUNCTION public.expire_holds() IS
  'Legacy deployment-owner maintenance helper. Application execution is forbidden; audited tenant-scoped expiry replaces it.';
