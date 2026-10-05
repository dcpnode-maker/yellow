-- Order 581: one governed property-name transition. Runtime receives no direct
-- org_node.name update authority; this capability owns the lock, version and evidence.

DO $precondition$
BEGIN
  IF (SELECT pg_catalog.count(*) FROM public.schema_migration) IS DISTINCT FROM 97::bigint
     OR (SELECT pg_catalog.max(version) FROM public.schema_migration) IS DISTINCT FROM 97 THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'property identity profile requires canonical migration 97';
  END IF;
END $precondition$;

INSERT INTO public.permission(code, description) VALUES
  ('identity.property-profile:read', 'Read canonical property identity profile'),
  ('identity.property-profile:write', 'Change the canonical property name')
ON CONFLICT (code) DO UPDATE SET description = EXCLUDED.description;

-- PostgreSQL does not expose the Unicode Default_Ignorable_Code_Point property
-- to SQL regexes. Keep the current Unicode scalar set explicit and immutable so
-- the SECURITY DEFINER capability cannot accept a name that the TypeScript edge
-- rejects. The ranges cover default-ignorable scalars plus every Unicode Cf
-- scalar; visible international letters remain unaffected.
CREATE FUNCTION public.property_identity_name_is_visible(p_name text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
SET search_path = pg_catalog
AS $$
  WITH forbidden(codepoint) AS (
    SELECT * FROM (VALUES
      (173), (847), (1564), (1757), (1807), (2192), (2193), (2274),
      (4447), (4448), (6068), (6069), (12644), (65279), (65440)
    ) AS singleton(codepoint)
    UNION ALL SELECT generate_series(1536, 1541) -- U+0600..U+0605 Cf
    UNION ALL SELECT generate_series(6155, 6159) -- U+180B..U+180F
    UNION ALL SELECT generate_series(8203, 8207) -- U+200B..U+200F
    UNION ALL SELECT generate_series(8234, 8238) -- U+202A..U+202E
    UNION ALL SELECT generate_series(8288, 8303) -- U+2060..U+206F
    UNION ALL SELECT generate_series(65024, 65039) -- U+FE00..U+FE0F
    UNION ALL SELECT generate_series(65520, 65531) -- U+FFF0..U+FFFB
    UNION ALL SELECT generate_series(69821, 69821) -- U+110BD
    UNION ALL SELECT generate_series(69837, 69837) -- U+110CD
    UNION ALL SELECT generate_series(78896, 78911) -- U+13430..U+1343F
    UNION ALL SELECT generate_series(113824, 113827) -- U+1BCA0..U+1BCA3
    UNION ALL SELECT generate_series(119155, 119162) -- U+1D173..U+1D17A
    UNION ALL SELECT generate_series(917504, 917535) -- U+E0000..U+E001F
    UNION ALL SELECT generate_series(917536, 917631) -- U+E0020..U+E007F
    UNION ALL SELECT generate_series(917760, 917999) -- U+E0100..U+E01EF
  )
  SELECT p_name !~ '[[:cntrl:]]'
     AND NOT EXISTS (
       SELECT 1 FROM forbidden
        WHERE pg_catalog.strpos(p_name, pg_catalog.chr(codepoint)) > 0
     )
$$;

ALTER FUNCTION public.property_identity_name_is_visible(text) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.property_identity_name_is_visible(text)
  FROM PUBLIC, app_role, yellow_runtime;

-- Revalidate live authority after an idempotency receipt lock has been acquired.
-- Application roles receive only this narrowly-scoped capability, never direct
-- locking access to the governance roots.
CREATE FUNCTION public.assert_property_identity_write_authority(
  p_tenant_id uuid,
  p_property_node uuid,
  p_actor_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_context_tenant uuid;
  v_property_path ltree;
BEGIN
  BEGIN
    v_context_tenant := current_setting('app.tenant_id', true)::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'property identity tenant context is invalid';
  END;

  IF p_tenant_id IS NULL OR p_property_node IS NULL OR p_actor_id IS NULL
     OR v_context_tenant IS NULL OR v_context_tenant <> p_tenant_id THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'property identity authority is unavailable';
  END IF;

  -- Acquire the property lock first. A competing revocation must be able to
  -- commit while a command is waiting for this property, before its live
  -- authority roots are read and retained.
  SELECT property.path INTO v_property_path
    FROM public.org_node AS property
   WHERE property.tenant_id = p_tenant_id
     AND property.id = p_property_node
     AND property.kind = 'property'
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'property identity authority is unavailable';
  END IF;

  PERFORM 1
    FROM public.tenant AS target_tenant
    JOIN public.app_user AS actor
      ON actor.tenant_id = target_tenant.id
     AND actor.id = p_actor_id
     AND actor.status = 'active'
    JOIN public.user_role AS membership
      ON membership.tenant_id = actor.tenant_id
     AND membership.user_id = actor.id
    JOIN public.role AS actor_role
      ON actor_role.tenant_id = membership.tenant_id
     AND actor_role.id = membership.role_id
    JOIN public.role_permission AS grant_row
      ON grant_row.role_id = actor_role.id
     AND grant_row.permission_code = 'identity.property-profile:write'
    JOIN public.org_node AS scope_node
      ON scope_node.tenant_id = membership.tenant_id
     AND scope_node.id = membership.scope_node
     AND scope_node.path @> v_property_path
   WHERE target_tenant.id = p_tenant_id
     AND target_tenant.status = 'active'
   ORDER BY actor_role.id, scope_node.id
   LIMIT 1
   FOR NO KEY UPDATE OF target_tenant, actor, membership, actor_role, grant_row, scope_node;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'property identity authority is unavailable';
  END IF;
END;
$$;

ALTER FUNCTION public.assert_property_identity_write_authority(uuid, uuid, uuid)
  OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.assert_property_identity_write_authority(uuid, uuid, uuid)
  FROM PUBLIC, yellow_runtime;
GRANT EXECUTE ON FUNCTION public.assert_property_identity_write_authority(uuid, uuid, uuid)
  TO app_role;

CREATE FUNCTION public.rename_property_identity(
  p_tenant_id uuid,
  p_property_node uuid,
  p_actor_id uuid,
  p_correlation_id uuid,
  p_expected_version integer,
  p_name text
) RETURNS TABLE (
  property_node uuid,
  property_name text,
  timezone text,
  currency character(3),
  name_version integer,
  effective_at timestamptz,
  effective_business_date date,
  changed boolean
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
CALLED ON NULL INPUT
PARALLEL UNSAFE
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_context_tenant uuid;
  v_property public.org_node%ROWTYPE;
  v_fact_count integer;
  v_distinct_versions integer;
  v_min_version integer;
  v_max_version integer;
  v_leaf_count integer;
  v_current_fact_id uuid;
  v_current_version integer := 0;
  v_effective_at timestamptz;
  v_business_date date;
  v_now timestamptz := pg_catalog.transaction_timestamp();
  v_new_fact_id uuid;
  v_fact_payload jsonb;
  v_event_payload jsonb;
BEGIN
  IF session_user <> 'yellow_runtime'
     OR pg_catalog.current_setting('role', true) IS DISTINCT FROM 'app_role'
     OR current_user <> 'yellow_owner' THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'property identity change requires the governed runtime app role';
  END IF;

  BEGIN
    v_context_tenant := NULLIF(
      pg_catalog.current_setting('app.tenant_id', true), ''
    )::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'property identity tenant context is invalid';
  END;

  IF p_tenant_id IS NULL OR p_property_node IS NULL OR p_actor_id IS NULL
     OR p_correlation_id IS NULL OR v_context_tenant IS NULL
     OR v_context_tenant <> p_tenant_id THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'property identity authority is unavailable';
  END IF;
  IF p_expected_version IS NULL OR p_expected_version < 0 OR p_name IS NULL
     OR pg_catalog.char_length(p_name) NOT BETWEEN 1 AND 200
     OR p_name IS DISTINCT FROM NORMALIZE(p_name, NFKC)
     OR p_name <> pg_catalog.btrim(p_name)
     OR p_name <> pg_catalog.regexp_replace(p_name, '[[:space:]]+', ' ', 'g')
     OR NOT public.property_identity_name_is_visible(p_name) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'property name is invalid';
  END IF;

  -- The property must be the first lock. This lets an intervening actor or
  -- permission revocation commit before authority is revalidated below.
  SELECT property.* INTO v_property
    FROM public.org_node AS property
   WHERE property.tenant_id = p_tenant_id
     AND property.id = p_property_node
     AND property.kind = 'property'
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'property identity authority is unavailable';
  END IF;

  PERFORM 1
    FROM public.tenant AS target_tenant
    JOIN public.app_user AS actor
      ON actor.tenant_id = target_tenant.id
     AND actor.id = p_actor_id
     AND actor.status = 'active'
    JOIN public.user_role AS membership
      ON membership.tenant_id = actor.tenant_id
     AND membership.user_id = actor.id
    JOIN public.role AS actor_role
      ON actor_role.tenant_id = membership.tenant_id
     AND actor_role.id = membership.role_id
    JOIN public.role_permission AS grant_row
      ON grant_row.role_id = actor_role.id
     AND grant_row.permission_code = 'identity.property-profile:write'
    JOIN public.org_node AS scope_node
      ON scope_node.tenant_id = membership.tenant_id
     AND scope_node.id = membership.scope_node
     AND scope_node.path @> v_property.path
   WHERE target_tenant.id = p_tenant_id
     AND target_tenant.status = 'active'
   ORDER BY actor_role.id, scope_node.id
   LIMIT 1
   FOR NO KEY UPDATE OF target_tenant, actor, membership, actor_role, grant_row, scope_node;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'property identity authority is unavailable';
  END IF;

  SELECT pg_catalog.count(*)::integer,
         pg_catalog.count(DISTINCT (fact.payload ->> 'version')::integer)::integer,
         pg_catalog.min((fact.payload ->> 'version')::integer)::integer,
         pg_catalog.max((fact.payload ->> 'version')::integer)::integer
    INTO v_fact_count, v_distinct_versions, v_min_version, v_max_version
    FROM public.fact_log AS fact
   WHERE fact.tenant_id = p_tenant_id
     AND fact.entity_type = 'org_node'
     AND fact.entity_id = p_property_node
     AND fact.fact_type = 'property.identity.changed'
     AND pg_catalog.jsonb_typeof(fact.payload -> 'version') = 'number';

  IF EXISTS (
    SELECT 1 FROM public.fact_log AS malformed
     WHERE malformed.tenant_id = p_tenant_id
       AND malformed.entity_type = 'org_node'
       AND malformed.entity_id = p_property_node
       AND malformed.fact_type = 'property.identity.changed'
       AND (pg_catalog.jsonb_typeof(malformed.payload -> 'version') IS DISTINCT FROM 'number'
            OR (malformed.payload ->> 'version') !~ '^[1-9][0-9]*$')
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'property identity history is incoherent';
  END IF;

  IF v_fact_count > 0 THEN
    SELECT pg_catalog.count(*)::integer INTO v_leaf_count
      FROM public.fact_log AS fact
     WHERE fact.tenant_id = p_tenant_id
       AND fact.entity_type = 'org_node'
       AND fact.entity_id = p_property_node
       AND fact.fact_type = 'property.identity.changed'
       AND NOT EXISTS (
         SELECT 1 FROM public.fact_log AS successor
          WHERE successor.tenant_id = fact.tenant_id
            AND successor.entity_type = fact.entity_type
            AND successor.entity_id = fact.entity_id
            AND successor.fact_type = fact.fact_type
            AND successor.supersedes = fact.id
       );
    IF v_distinct_versions <> v_fact_count OR v_min_version <> 1
       OR v_max_version <> v_fact_count OR v_leaf_count <> 1 THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'property identity history is incoherent';
    END IF;
    SELECT fact.id, (fact.payload ->> 'version')::integer,
           fact.valid_from, fact.business_date
      INTO v_current_fact_id, v_current_version, v_effective_at, v_business_date
      FROM public.fact_log AS fact
     WHERE fact.tenant_id = p_tenant_id
       AND fact.entity_type = 'org_node'
       AND fact.entity_id = p_property_node
       AND fact.fact_type = 'property.identity.changed'
       AND NOT EXISTS (
         SELECT 1 FROM public.fact_log AS successor
          WHERE successor.tenant_id = fact.tenant_id
            AND successor.entity_type = fact.entity_type
            AND successor.entity_id = fact.entity_id
            AND successor.fact_type = fact.fact_type
            AND successor.supersedes = fact.id
       );
    IF v_current_version <> v_fact_count THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'property identity history is incoherent';
    END IF;
  END IF;

  IF p_expected_version <> v_current_version THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'property identity version is stale';
  END IF;
  IF v_property.name = p_name THEN
    RETURN QUERY SELECT v_property.id, v_property.name, v_property.timezone,
      v_property.currency, v_current_version, v_effective_at, v_business_date, false;
    RETURN;
  END IF;

  UPDATE public.org_node SET name = p_name
   WHERE tenant_id = p_tenant_id AND id = p_property_node;
  v_current_version := v_current_version + 1;
  v_business_date := (v_now AT TIME ZONE v_property.timezone)::date;
  v_fact_payload := pg_catalog.jsonb_build_object(
    'version', v_current_version,
    'changed_fields', pg_catalog.jsonb_build_array('name'),
    'previous_name', v_property.name,
    'name', p_name,
    'request_id', p_correlation_id
  );
  INSERT INTO public.fact_log(
    tenant_id, entity_type, entity_id, fact_type, valid_from,
    business_date, actor_id, payload, supersedes
  ) VALUES (
    p_tenant_id, 'org_node', p_property_node, 'property.identity.changed', v_now,
    v_business_date, p_actor_id, v_fact_payload, v_current_fact_id
  ) RETURNING id INTO v_new_fact_id;

  v_event_payload := pg_catalog.jsonb_build_object(
    'version', v_current_version,
    'changed_fields', pg_catalog.jsonb_build_array('name')
  );
  INSERT INTO public.outbox(
    tenant_id, property_node, business_date, aggregate_type, aggregate_id,
    event_type, event_version, actor_id, correlation_id, causation_id, payload
  ) VALUES (
    p_tenant_id, p_property_node, v_business_date, 'org_node', p_property_node,
    'property.identity.changed', 1, p_actor_id, p_correlation_id, NULL, v_event_payload
  );

  RETURN QUERY SELECT v_property.id, p_name, v_property.timezone,
    v_property.currency, v_current_version, v_now, v_business_date, true;
END;
$$;

ALTER FUNCTION public.rename_property_identity(uuid, uuid, uuid, uuid, integer, text)
  OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.rename_property_identity(uuid, uuid, uuid, uuid, integer, text)
  FROM PUBLIC, app_role, yellow_runtime;
GRANT EXECUTE ON FUNCTION public.rename_property_identity(uuid, uuid, uuid, uuid, integer, text)
  TO app_role;

-- Preserve the pre-existing config-only authority. Name is capability-only.
REVOKE UPDATE (name) ON public.org_node FROM app_role, yellow_runtime;
