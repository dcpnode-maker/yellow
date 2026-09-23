-- Order 244: append-only canonical ownership for an already parsed Order240
-- positive rate-quote tax-attribution snapshot. This root is evidence only: it
-- creates no reservation, posting, document or fiscal authority.

CREATE TABLE public.tax_attribution_snapshot (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT pg_catalog.gen_random_uuid(),
  property_node uuid NOT NULL,
  actor_id uuid NOT NULL,
  schema_version smallint NOT NULL,
  origin_kind text NOT NULL,
  origin_quote_hash text NOT NULL,
  snapshot_hash text NOT NULL,
  currency character(3) NOT NULL,
  snapshot jsonb NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT pg_catalog.transaction_timestamp(),
  CONSTRAINT tax_attribution_snapshot_pk PRIMARY KEY (tenant_id, id),
  CONSTRAINT tax_attribution_snapshot_hash_uq UNIQUE (tenant_id, snapshot_hash),
  CONSTRAINT tax_attribution_snapshot_property_fk
    FOREIGN KEY (tenant_id, property_node)
    REFERENCES public.org_node (tenant_id, id),
  CONSTRAINT tax_attribution_snapshot_actor_fk
    FOREIGN KEY (tenant_id, actor_id)
    REFERENCES public.app_user (tenant_id, id),
  CONSTRAINT tax_attribution_snapshot_version_ck CHECK (schema_version = 1),
  CONSTRAINT tax_attribution_snapshot_origin_ck CHECK (origin_kind = 'rate_quote'),
  CONSTRAINT tax_attribution_snapshot_quote_hash_ck CHECK (
    origin_quote_hash ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT tax_attribution_snapshot_hash_ck CHECK (
    snapshot_hash ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT tax_attribution_snapshot_currency_ck CHECK (
    currency ~ '^[A-Z]{3}$'
  ),
  CONSTRAINT tax_attribution_snapshot_outer_identity_ck CHECK (
    pg_catalog.jsonb_typeof(snapshot) = 'object'
    AND snapshot ?& ARRAY[
      'schemaVersion', 'origin', 'currency', 'revenueLine', 'assignments',
      'jurisdiction', 'evaluation', 'snapshotHash'
    ]
    AND snapshot - ARRAY[
      'schemaVersion', 'origin', 'currency', 'revenueLine', 'assignments',
      'jurisdiction', 'evaluation', 'snapshotHash'
    ] = '{}'::jsonb
    AND snapshot -> 'schemaVersion' = '1'::jsonb
    AND pg_catalog.jsonb_typeof(snapshot -> 'origin') = 'object'
    AND (snapshot -> 'origin') ?& ARRAY['kind', 'quoteHash']
    AND (snapshot -> 'origin') - ARRAY['kind', 'quoteHash'] = '{}'::jsonb
    AND snapshot -> 'origin' ->> 'kind' = origin_kind
    AND snapshot -> 'origin' ->> 'quoteHash' = origin_quote_hash
    AND snapshot ->> 'currency' = currency::text
    AND snapshot ->> 'snapshotHash' = snapshot_hash
    AND pg_catalog.octet_length(
      pg_catalog.convert_to(snapshot::text, 'UTF8')
    ) BETWEEN 1 AND 8388608
  )
);

CREATE INDEX tax_attribution_snapshot_property_lookup
  ON public.tax_attribution_snapshot
  (tenant_id, property_node, recorded_at, id);
CREATE INDEX tax_attribution_snapshot_quote_lookup
  ON public.tax_attribution_snapshot
  (tenant_id, origin_quote_hash, recorded_at, id);

ALTER TABLE public.tax_attribution_snapshot ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON public.tax_attribution_snapshot
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

CREATE FUNCTION public.record_tax_attribution_snapshot(
  p_tenant uuid,
  p_property uuid,
  p_actor uuid,
  p_schema_version integer,
  p_origin_kind text,
  p_origin_quote_hash text,
  p_snapshot_hash text,
  p_currency text,
  p_snapshot jsonb
) RETURNS TABLE (
  attribution_id uuid,
  property_node uuid,
  actor_id uuid,
  schema_version smallint,
  origin_kind text,
  origin_quote_hash text,
  snapshot_hash text,
  currency character(3),
  snapshot jsonb,
  recorded_at timestamptz,
  created boolean
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
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
$$;

ALTER FUNCTION public.record_tax_attribution_snapshot(
  uuid,uuid,uuid,integer,text,text,text,text,jsonb
) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.record_tax_attribution_snapshot(
  uuid,uuid,uuid,integer,text,text,text,text,jsonb
) FROM PUBLIC, app_role, yellow_runtime;
GRANT EXECUTE ON FUNCTION public.record_tax_attribution_snapshot(
  uuid,uuid,uuid,integer,text,text,text,text,jsonb
) TO app_role;

ALTER TABLE public.tax_attribution_snapshot OWNER TO yellow_owner;
REVOKE ALL ON TABLE public.tax_attribution_snapshot FROM PUBLIC, app_role;
REVOKE ALL ON TABLE public.tax_attribution_snapshot FROM yellow_runtime;
GRANT SELECT ON TABLE public.tax_attribution_snapshot TO app_role;
