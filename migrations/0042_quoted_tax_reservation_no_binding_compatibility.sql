-- Forward-only compatibility correction for unquoted reservation holds.
-- Migration 0041 is immutable historical evidence; this replacement preserves the
-- exact capability contract while returning zero rows before authority checks when
-- no quoted-tax hold binding exists.

CREATE OR REPLACE FUNCTION public.link_tax_attribution_reservation(
  p_tenant_id uuid,
  p_property_node uuid,
  p_actor_id uuid,
  p_hold_id uuid,
  p_reservation_id uuid,
  p_segment_id uuid
) RETURNS TABLE (
  lineage_id uuid,
  binding_id uuid,
  hold_id uuid,
  attribution_id uuid,
  reservation_id uuid,
  segment_id uuid,
  origin_quote_hash text,
  snapshot_hash text,
  currency character(3),
  linked_by uuid,
  linked_at timestamptz,
  created boolean
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
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

ALTER FUNCTION public.link_tax_attribution_reservation(
  uuid,uuid,uuid,uuid,uuid,uuid
) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.link_tax_attribution_reservation(
  uuid,uuid,uuid,uuid,uuid,uuid
) FROM PUBLIC, app_role, yellow_runtime;
GRANT EXECUTE ON FUNCTION public.link_tax_attribution_reservation(
  uuid,uuid,uuid,uuid,uuid,uuid
) TO app_role;

