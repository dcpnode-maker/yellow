-- Order 156: move platform-global extension type registration behind one
-- credential-separated, fixed-shape command that writes its audit fact atomically.

RESET ROLE;
DO $order156_preconditions$
DECLARE
  v_registrar oid := pg_catalog.to_regrole('yellow_extension_registrar');
BEGIN
  IF session_user <> 'yellow_deploy' OR current_user <> 'yellow_deploy' THEN
    RAISE EXCEPTION 'migration 0018 requires the direct deploy session'
      USING ERRCODE = '42501';
  END IF;
  IF v_registrar IS NULL OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_authid
     WHERE oid = v_registrar AND rolcanlogin AND rolconnlimit = 4 AND rolpassword IS NOT NULL
       AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolinherit
       AND NOT rolreplication AND NOT rolbypassrls
  ) THEN
    RAISE EXCEPTION 'yellow_extension_registrar has incompatible attributes or no external password'
      USING ERRCODE = '55000';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_auth_members
     WHERE roleid = v_registrar OR member = v_registrar
  ) THEN
    RAISE EXCEPTION 'yellow_extension_registrar must have zero role membership'
      USING ERRCODE = '55000';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_class WHERE relowner = v_registrar
    UNION ALL
    SELECT 1 FROM pg_catalog.pg_proc WHERE proowner = v_registrar
    UNION ALL
    SELECT 1 FROM pg_catalog.pg_namespace WHERE nspowner = v_registrar
  ) THEN
    RAISE EXCEPTION 'yellow_extension_registrar must own no database object'
      USING ERRCODE = '55000';
  END IF;
END;
$order156_preconditions$;

GRANT USAGE ON SCHEMA public TO yellow_extension_registrar;
SET LOCAL ROLE yellow_owner;

CREATE FUNCTION public.register_extension_type(
  p_tenant uuid,
  p_type text,
  p_json_schema jsonb,
  p_actor uuid,
  p_property uuid,
  p_request uuid
) RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
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
$$;

ALTER FUNCTION public.register_extension_type(uuid,text,jsonb,uuid,uuid,uuid) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.register_extension_type(uuid,text,jsonb,uuid,uuid,uuid)
  FROM PUBLIC, app_role, yellow_runtime;
GRANT EXECUTE ON FUNCTION public.register_extension_type(uuid,text,jsonb,uuid,uuid,uuid)
  TO yellow_extension_registrar;
REVOKE INSERT (type, json_schema) ON public.extension_type FROM app_role;
