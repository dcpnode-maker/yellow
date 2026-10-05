-- Order 248: retain the exact live cart-hold and canonical tax-attribution
-- identities that were bound by the governed quoted-tax command. This root is
-- append-only evidence: hold expiry/release changes no binding row and grants no
-- reservation, price-promise, posting, document or fiscal authority.

ALTER TABLE public.hold
  ADD CONSTRAINT hold_tax_binding_identity_uq
  UNIQUE (tenant_id, id, property_node, sellable_unit_id, period);

ALTER TABLE public.tax_attribution_snapshot
  ADD CONSTRAINT tax_attribution_snapshot_binding_identity_uq
  UNIQUE (
    tenant_id, id, property_node, actor_id,
    origin_quote_hash, snapshot_hash, currency
  );

CREATE TABLE public.tax_attribution_hold_binding (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT pg_catalog.gen_random_uuid(),
  property_node uuid NOT NULL,
  bound_by uuid NOT NULL,
  hold_id uuid NOT NULL,
  attribution_id uuid NOT NULL,
  sellable_unit_id uuid NOT NULL,
  period tstzrange NOT NULL,
  origin_quote_hash text NOT NULL,
  snapshot_hash text NOT NULL,
  currency character(3) NOT NULL,
  bound_at timestamptz NOT NULL DEFAULT pg_catalog.transaction_timestamp(),
  CONSTRAINT tax_attribution_hold_binding_pk PRIMARY KEY (tenant_id, id),
  CONSTRAINT tax_attribution_hold_binding_hold_uq UNIQUE (tenant_id, hold_id),
  CONSTRAINT tax_attribution_hold_binding_attribution_uq
    UNIQUE (tenant_id, attribution_id),
  CONSTRAINT tax_attribution_hold_binding_snapshot_hash_uq
    UNIQUE (tenant_id, snapshot_hash),
  CONSTRAINT tax_attribution_hold_binding_period_ck CHECK (
    NOT pg_catalog.isempty(period)
    AND pg_catalog.lower_inc(period)
    AND NOT pg_catalog.upper_inc(period)
    AND pg_catalog.lower(period) IS NOT NULL
    AND pg_catalog.upper(period) IS NOT NULL
    AND pg_catalog.lower(period) < pg_catalog.upper(period)
  ),
  CONSTRAINT tax_attribution_hold_binding_quote_hash_ck CHECK (
    origin_quote_hash ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT tax_attribution_hold_binding_snapshot_hash_ck CHECK (
    snapshot_hash ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT tax_attribution_hold_binding_currency_ck CHECK (
    currency ~ '^[A-Z]{3}$'
  ),
  CONSTRAINT tax_attribution_hold_binding_property_fk
    FOREIGN KEY (tenant_id, property_node)
    REFERENCES public.org_node (tenant_id, id),
  CONSTRAINT tax_attribution_hold_binding_actor_fk
    FOREIGN KEY (tenant_id, bound_by)
    REFERENCES public.app_user (tenant_id, id),
  CONSTRAINT tax_attribution_hold_binding_hold_fk
    FOREIGN KEY (
      tenant_id, hold_id, property_node, sellable_unit_id, period
    ) REFERENCES public.hold (
      tenant_id, id, property_node, sellable_unit_id, period
    ),
  CONSTRAINT tax_attribution_hold_binding_attribution_fk
    FOREIGN KEY (
      tenant_id, attribution_id, property_node, bound_by,
      origin_quote_hash, snapshot_hash, currency
    ) REFERENCES public.tax_attribution_snapshot (
      tenant_id, id, property_node, actor_id,
      origin_quote_hash, snapshot_hash, currency
    )
);

CREATE INDEX tax_attribution_hold_binding_property_lookup
  ON public.tax_attribution_hold_binding
  (tenant_id, property_node, bound_at, id);
CREATE INDEX tax_attribution_hold_binding_attribution_lookup
  ON public.tax_attribution_hold_binding
  (tenant_id, attribution_id, bound_at, id);

ALTER TABLE public.tax_attribution_hold_binding ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON public.tax_attribution_hold_binding
  USING (
    tenant_id = NULLIF(
      pg_catalog.current_setting('app.tenant_id', true), ''
    )::uuid
  )
  WITH CHECK (
    tenant_id = NULLIF(
      pg_catalog.current_setting('app.tenant_id', true), ''
    )::uuid
  );

CREATE FUNCTION public.record_tax_attribution_hold_binding(
  p_tenant_id uuid,
  p_property_node uuid,
  p_actor_id uuid,
  p_hold_id uuid,
  p_attribution_id uuid
) RETURNS TABLE (
  binding_id uuid,
  property_node uuid,
  hold_id uuid,
  attribution_id uuid,
  origin_quote_hash text,
  snapshot_hash text,
  currency character(3),
  bound_by uuid,
  bound_at timestamptz,
  created boolean
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
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

ALTER FUNCTION public.record_tax_attribution_hold_binding(
  uuid,uuid,uuid,uuid,uuid
) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.record_tax_attribution_hold_binding(
  uuid,uuid,uuid,uuid,uuid
) FROM PUBLIC, app_role, yellow_runtime;
GRANT EXECUTE ON FUNCTION public.record_tax_attribution_hold_binding(
  uuid,uuid,uuid,uuid,uuid
) TO app_role;

ALTER TABLE public.tax_attribution_hold_binding OWNER TO yellow_owner;
REVOKE ALL ON TABLE public.tax_attribution_hold_binding FROM PUBLIC, app_role;
REVOKE ALL ON TABLE public.tax_attribution_hold_binding FROM yellow_runtime;
GRANT SELECT ON TABLE public.tax_attribution_hold_binding TO app_role;
