-- One property operating-view attribute; existing inventory and grants are unchanged.
DO $precondition$
BEGIN
  IF (SELECT count(*) FROM public.schema_migration) IS DISTINCT FROM 101::bigint
     OR (SELECT max(version) FROM public.schema_migration) IS DISTINCT FROM 101 THEN
    RAISE EXCEPTION USING ERRCODE='55000', MESSAGE='property operating mode requires canonical migration 101';
  END IF;
END $precondition$;

INSERT INTO public.permission(code,description) VALUES
  ('identity.property-mode:read','Read the persisted property operating view'),
  ('identity.property-mode:write','Change the persisted property operating view')
ON CONFLICT(code) DO UPDATE SET description=EXCLUDED.description;

CREATE FUNCTION public.assert_property_mode_write_authority(p_tenant_id uuid,p_property_node uuid,p_actor_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_context uuid; v_path public.ltree;
BEGIN
  IF session_user <> 'yellow_runtime' OR current_setting('role',true) IS DISTINCT FROM 'app_role'
     OR current_user <> 'yellow_owner' THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='property mode requires governed runtime app role';
  END IF;
  BEGIN v_context:=NULLIF(current_setting('app.tenant_id',true),'')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='property mode authority unavailable';
  END;
  IF p_tenant_id IS NULL OR p_property_node IS NULL OR p_actor_id IS NULL
     OR v_context IS NULL OR v_context<>p_tenant_id THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='property mode authority unavailable';
  END IF;
  -- Property first: intervening revocation may commit while this lock is awaited.
  SELECT p.path INTO v_path FROM public.org_node p
   WHERE p.tenant_id=p_tenant_id AND p.id=p_property_node AND p.kind='property' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='property mode authority unavailable'; END IF;
  PERFORM 1 FROM public.tenant t
    JOIN public.app_user actor ON actor.tenant_id=t.id AND actor.id=p_actor_id AND actor.status='active'
    JOIN public.user_role membership ON membership.tenant_id=actor.tenant_id AND membership.user_id=actor.id
    JOIN public.role r ON r.tenant_id=membership.tenant_id AND r.id=membership.role_id
    JOIN public.role_permission permission ON permission.role_id=r.id AND permission.permission_code='identity.property-mode:write'
    JOIN public.org_node scope ON scope.tenant_id=membership.tenant_id AND scope.id=membership.scope_node AND scope.path @> v_path
   WHERE t.id=p_tenant_id AND t.status='active'
   ORDER BY r.id,scope.id LIMIT 1
   FOR NO KEY UPDATE OF t,actor,membership,r,permission,scope;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='property mode authority unavailable'; END IF;
END $$;
ALTER FUNCTION public.assert_property_mode_write_authority(uuid,uuid,uuid) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.assert_property_mode_write_authority(uuid,uuid,uuid) FROM PUBLIC,app_role,yellow_runtime;
GRANT EXECUTE ON FUNCTION public.assert_property_mode_write_authority(uuid,uuid,uuid) TO app_role;

CREATE FUNCTION public.set_property_operating_mode(p_tenant_id uuid,p_property_node uuid,p_actor_id uuid,
  p_correlation_id uuid,p_expected_version integer,p_mode text)
RETURNS TABLE(property_node uuid,mode text,version integer,effective_at timestamptz,effective_business_date date,changed boolean)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER CALLED ON NULL INPUT PARALLEL UNSAFE
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE
  v_property public.org_node%ROWTYPE; v_fact public.fact_log%ROWTYPE;
  v_version integer:=0; v_previous_id uuid; v_previous_mode text;
  v_current_mode text; v_effective_at timestamptz; v_business_date date;
  v_now timestamptz:=transaction_timestamp(); v_payload jsonb;
BEGIN
  IF p_correlation_id IS NULL OR p_expected_version IS NULL OR p_expected_version<0
     OR p_mode IS NULL OR p_mode NOT IN ('hotel','str','both') THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='property mode input invalid';
  END IF;
  PERFORM public.assert_property_mode_write_authority(p_tenant_id,p_property_node,p_actor_id);
  SELECT p.* INTO STRICT v_property FROM public.org_node p WHERE p.tenant_id=p_tenant_id AND p.id=p_property_node;
  IF jsonb_typeof(v_property.config) IS DISTINCT FROM 'object'
     OR (v_property.config ? 'workspace' AND jsonb_typeof(v_property.config->'workspace') IS DISTINCT FROM 'object')
     OR ((v_property.config->'workspace') ? 'operating_mode' AND (
       jsonb_typeof(v_property.config#>'{workspace,operating_mode}') IS DISTINCT FROM 'string'
       OR v_property.config#>>'{workspace,operating_mode}' NOT IN ('hotel','str','both'))) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='property mode configuration incoherent';
  END IF;
  v_current_mode:=v_property.config#>>'{workspace,operating_mode}';
  -- Retrieval is by typed tenant/entity/fact keys. JSON is validated in the loop,
  -- never used as a selectivity predicate; guarded ordering cannot cast malformed data.
  FOR v_fact IN SELECT f.* FROM public.fact_log f WHERE f.tenant_id=p_tenant_id AND f.entity_type='org_node'
      AND f.entity_id=p_property_node AND f.fact_type='property.operating-mode.changed'
      ORDER BY CASE WHEN jsonb_typeof(f.payload->'version')='number' AND (f.payload->>'version') ~ '^[1-9][0-9]{0,9}$'
        THEN CASE WHEN (f.payload->>'version')::numeric<=2147483647 THEN (f.payload->>'version')::integer END END LOOP
    IF jsonb_typeof(v_fact.payload->'version') IS DISTINCT FROM 'number'
       OR (v_fact.payload->>'version') !~ '^[1-9][0-9]{0,9}$'
       OR (CASE WHEN (v_fact.payload->>'version') ~ '^[1-9][0-9]{0,9}$'
          THEN (v_fact.payload->>'version')::numeric>2147483647 ELSE false END) THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='property mode history incoherent';
    END IF;
    IF v_version=2147483647 OR (v_fact.payload->>'version')::integer<>v_version+1
       OR v_fact.supersedes IS DISTINCT FROM v_previous_id
       OR v_fact.actor_id IS NULL OR v_fact.valid_to IS NOT NULL
       OR v_fact.payload->>'mode' IS NULL OR v_fact.payload->>'mode' NOT IN ('hotel','str','both')
       OR (v_fact.payload->>'mode') IS NOT DISTINCT FROM v_previous_mode
       OR v_fact.payload->>'request_id' IS NULL
       OR (v_fact.payload->>'request_id') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       OR v_fact.business_date IS DISTINCT FROM (v_fact.valid_from AT TIME ZONE v_property.timezone)::date
       OR v_fact.payload IS DISTINCT FROM jsonb_build_object('version',v_version+1,'previous_mode',v_previous_mode,
          'mode',v_fact.payload->>'mode','request_id',v_fact.payload->>'request_id') THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='property mode history incoherent';
    END IF;
    v_version:=v_version+1; v_previous_id:=v_fact.id; v_previous_mode:=v_fact.payload->>'mode';
    v_effective_at:=v_fact.valid_from; v_business_date:=v_fact.business_date;
  END LOOP;
  IF v_current_mode IS DISTINCT FROM v_previous_mode THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='property mode config/history mismatch';
  END IF;
  IF p_expected_version<>v_version THEN RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='property mode version stale'; END IF;
  IF v_current_mode=p_mode THEN
    RETURN QUERY SELECT p_property_node,v_current_mode,v_version,v_effective_at,v_business_date,false;
    RETURN;
  END IF;
  IF v_version=2147483647 THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='property mode version exhausted'; END IF;
  UPDATE public.org_node SET config=jsonb_set(v_property.config,'{workspace}',
    COALESCE(v_property.config->'workspace','{}'::jsonb)||jsonb_build_object('operating_mode',p_mode),true)
    WHERE tenant_id=p_tenant_id AND id=p_property_node;
  v_payload:=jsonb_build_object('version',v_version+1,'previous_mode',v_current_mode,'mode',p_mode,'request_id',p_correlation_id::text);
  v_business_date:=(v_now AT TIME ZONE v_property.timezone)::date;
  INSERT INTO public.fact_log(tenant_id,entity_type,entity_id,fact_type,valid_from,business_date,actor_id,payload,supersedes)
    VALUES(p_tenant_id,'org_node',p_property_node,'property.operating-mode.changed',v_now,v_business_date,p_actor_id,v_payload,v_previous_id);
  INSERT INTO public.outbox(tenant_id,property_node,business_date,aggregate_type,aggregate_id,event_type,event_version,
    actor_id,correlation_id,causation_id,payload)
    VALUES(p_tenant_id,p_property_node,v_business_date,'org_node',p_property_node,'property.operating-mode.changed',1,
      p_actor_id,p_correlation_id,NULL,jsonb_build_object('version',v_version+1,'previous_mode',v_current_mode,'mode',p_mode));
  RETURN QUERY SELECT p_property_node,p_mode,v_version+1,v_now,v_business_date,true;
END $$;
ALTER FUNCTION public.set_property_operating_mode(uuid,uuid,uuid,uuid,integer,text) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.set_property_operating_mode(uuid,uuid,uuid,uuid,integer,text) FROM PUBLIC,app_role,yellow_runtime;
GRANT EXECUTE ON FUNCTION public.set_property_operating_mode(uuid,uuid,uuid,uuid,integer,text) TO app_role;
