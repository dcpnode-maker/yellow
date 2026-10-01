-- Explicit staff-published guest booking site; no table or runtime DML grant expansion.
-- Controller-reserved0105. Migration0104 remains immutable.
DO $precondition$
BEGIN
 IF (SELECT count(*) FROM public.schema_migration) IS DISTINCT FROM 104::bigint
    OR (SELECT max(version) FROM public.schema_migration) IS DISTINCT FROM 104 THEN
  RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='public booking site requires canonical migration104';
 END IF;
END $precondition$;

CREATE FUNCTION public.assert_public_booking_publisher(p_tenant uuid,p_property uuid,p_actor uuid,p_rate_plan uuid DEFAULT NULL)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE
 required_scopes text[] := ARRAY['inventory.availability:read','rates.configuration:read',
   'inventory.holds:write','reservations.booking:write','crm.parties:read','crm.parties:write'];
 found_scopes text[] := ARRAY[]::text[];
 grant_row record;
BEGIN
 IF session_user <> 'yellow_runtime' OR current_setting('role',true) IS DISTINCT FROM 'app_role'
    OR current_user <> 'yellow_owner' OR p_tenant IS NULL OR p_property IS NULL OR p_actor IS NULL
    OR nullif(current_setting('app.tenant_id',true),'') IS DISTINCT FROM p_tenant::text THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='public booking authority unavailable';
 END IF;
 FOR grant_row IN
  SELECT permission.permission_code
  FROM public.tenant ten
  JOIN public.app_user actor ON actor.tenant_id=ten.id AND actor.id=p_actor AND actor.status='active'
  JOIN public.user_role membership ON membership.tenant_id=ten.id AND membership.user_id=actor.id
  JOIN public.role duty ON duty.tenant_id=ten.id AND duty.id=membership.role_id
  JOIN public.role_permission permission ON permission.role_id=duty.id AND permission.permission_code=ANY(required_scopes)
  JOIN public.org_node scope ON scope.tenant_id=ten.id AND scope.id=membership.scope_node
  JOIN public.org_node property ON property.tenant_id=ten.id AND property.id=p_property
    AND property.kind='property' AND property.path <@ scope.path
  WHERE ten.id=p_tenant AND ten.status='active'
  ORDER BY duty.id,scope.id,permission.permission_code
  FOR SHARE OF ten,actor,membership,duty,permission,scope,property
 LOOP
  found_scopes := array_append(found_scopes,grant_row.permission_code);
 END LOOP;
 IF NOT found_scopes @> required_scopes THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='public booking authority unavailable';
 END IF;
 IF p_rate_plan IS NOT NULL THEN
  PERFORM plan.id FROM public.rate_plan plan WHERE plan.tenant_id=p_tenant
    AND plan.property_node=p_property AND plan.id=p_rate_plan AND plan.status='active'
    FOR SHARE;
  IF NOT FOUND THEN
   RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='public booking authority unavailable';
  END IF;
  PERFORM policy.id FROM public.policy policy JOIN public.rate_plan plan
    ON policy.id IN (plan.cancellation_policy,plan.guarantee_policy,plan.deposit_policy)
    AND policy.tenant_id=plan.tenant_id
    WHERE plan.tenant_id=p_tenant AND plan.id=p_rate_plan
    ORDER BY policy.id FOR SHARE OF policy;
 END IF;
 RETURN clock_timestamp();
END $$;

ALTER FUNCTION public.assert_public_booking_publisher(uuid,uuid,uuid,uuid) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.assert_public_booking_publisher(uuid,uuid,uuid,uuid) FROM PUBLIC,app_role,yellow_runtime;

CREATE FUNCTION public.guard_public_booking_site_runtime_write()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN
 IF (NEW.config #> '{booking,public_site}') IS DISTINCT FROM
    (CASE WHEN TG_OP='UPDATE' THEN OLD.config #> '{booking,public_site}' ELSE NULL END)
    AND current_user <> 'yellow_owner' AND (current_user='app_role' OR session_user='yellow_runtime') THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='public booking requires governed publication';
 END IF;
 RETURN NEW;
END $$;
ALTER FUNCTION public.guard_public_booking_site_runtime_write() OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.guard_public_booking_site_runtime_write() FROM PUBLIC,app_role,yellow_runtime;
CREATE TRIGGER public_booking_site_runtime_write_guard
 BEFORE INSERT OR UPDATE OF config ON public.org_node
 FOR EACH ROW EXECUTE FUNCTION public.guard_public_booking_site_runtime_write();
CREATE UNIQUE INDEX public_booking_site_identity_unique
 ON public.org_node ((config #>> '{booking,public_site,siteId}'))
 WHERE kind='property' AND (config #>> '{booking,public_site,siteId}') IS NOT NULL;

CREATE FUNCTION public.publish_public_booking_site(
 p_tenant uuid,p_property uuid,p_actor uuid,p_expected_version integer,
 p_active boolean,p_plans uuid[],p_channel text,p_request uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE existing jsonb; old_config jsonb; next_site jsonb; plan uuid; version integer; site_id uuid;
 now timestamptz; local_day date; property_zone text; payload jsonb;
BEGIN
 IF session_user <> 'yellow_runtime' OR current_setting('role',true) IS DISTINCT FROM 'app_role'
    OR current_user <> 'yellow_owner' OR p_tenant IS NULL OR p_property IS NULL OR p_actor IS NULL
    OR nullif(current_setting('app.tenant_id',true),'') IS DISTINCT FROM p_tenant::text THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='public booking authority unavailable';
 END IF;
 IF p_request IS NULL THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='public booking publication input invalid';
 END IF;
 IF p_expected_version IS NULL OR p_expected_version<0 OR p_expected_version>2147483646
   OR p_active IS NULL OR p_plans IS NULL OR cardinality(p_plans) NOT BETWEEN 1 AND 16
   OR array_ndims(p_plans) IS DISTINCT FROM 1 OR array_lower(p_plans,1) IS DISTINCT FROM 1
   OR array_position(p_plans,NULL) IS NOT NULL
   OR cardinality(p_plans) <> (SELECT count(DISTINCT value) FROM unnest(p_plans) value)
   OR p_channel IS NULL OR p_channel !~ '^[a-z][a-z0-9._-]{0,63}$' THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='public booking publication input invalid';
 END IF;
 -- Lock the property first so simultaneous publishers cannot both upgrade SHARE.
 SELECT config #> '{booking,public_site}',timezone,config INTO existing,property_zone,old_config FROM public.org_node
 WHERE tenant_id=p_tenant AND id=p_property AND kind='property' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='public booking authority unavailable'; END IF;
 PERFORM public.assert_public_booking_publisher(p_tenant,p_property,p_actor,NULL);
 IF jsonb_typeof(old_config) IS DISTINCT FROM 'object'
   OR (old_config ? 'booking' AND jsonb_typeof(old_config->'booking') IS DISTINCT FROM 'object') THEN
  RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='public booking configuration incoherent';
 END IF;
 version:=COALESCE((existing->>'version')::integer,0);
 IF version<>p_expected_version THEN
  RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='public booking publication version changed';
 END IF;
 FOR plan IN SELECT value FROM unnest(p_plans) value ORDER BY value LOOP
  IF p_active THEN PERFORM public.assert_public_booking_publisher(p_tenant,p_property,p_actor,plan); END IF;
 END LOOP;
 site_id:=COALESCE((existing->>'siteId')::uuid,gen_random_uuid());
 next_site:=jsonb_build_object('siteId',site_id,'version',version+1,'active',p_active,
   'issuerId',p_actor,'channelCode',p_channel,'ratePlanIds',to_jsonb(p_plans));
 UPDATE public.org_node SET config=jsonb_set(
  jsonb_set(config,'{booking}',COALESCE(config->'booking','{}'::jsonb),true),
  '{booking,public_site}',next_site,true) WHERE tenant_id=p_tenant AND id=p_property;
 now:=clock_timestamp(); local_day:=(now AT TIME ZONE property_zone)::date;
 payload:=jsonb_build_object('siteId',site_id,'version',version+1,'active',p_active,
  'channelCode',p_channel,'ratePlanIds',to_jsonb(p_plans));
 INSERT INTO public.fact_log(tenant_id,entity_type,entity_id,fact_type,valid_from,business_date,actor_id,payload)
  VALUES(p_tenant,'org_node',p_property,'booking.site.published',now,local_day,p_actor,
   payload||jsonb_build_object('request_id',p_request));
 INSERT INTO public.outbox(tenant_id,property_node,business_date,aggregate_type,aggregate_id,event_type,event_version,
  actor_id,correlation_id,payload)
  VALUES(p_tenant,p_property,local_day,'org_node',p_property,'booking.site.published',1,p_actor,p_request,payload);
 RETURN next_site;
END $$;
ALTER FUNCTION public.publish_public_booking_site(uuid,uuid,uuid,integer,boolean,uuid[],text,uuid) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.publish_public_booking_site(uuid,uuid,uuid,integer,boolean,uuid[],text,uuid)
 FROM PUBLIC,app_role,yellow_runtime;
GRANT EXECUTE ON FUNCTION public.publish_public_booking_site(uuid,uuid,uuid,integer,boolean,uuid[],text,uuid) TO app_role;

CREATE FUNCTION public.resolve_public_booking_site(p_site uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE result jsonb;
BEGIN
 IF session_user<>'yellow_runtime' OR current_user<>'yellow_owner'
   OR current_setting('role',true) NOT IN ('none','yellow_runtime')
   OR nullif(current_setting('app.tenant_id',true),'') IS NOT NULL OR p_site IS NULL THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='public booking directory unavailable';
 END IF;
 SELECT jsonb_build_object('tenantId',node.tenant_id,'propertyNode',node.id,
   'propertyName',node.name,'timeZone',node.timezone,'site',node.config #> '{booking,public_site}') INTO result
 FROM public.org_node node JOIN public.tenant tenant ON tenant.id=node.tenant_id AND tenant.status='active'
 JOIN public.app_user actor ON actor.tenant_id=node.tenant_id
   AND actor.id=(node.config #>> '{booking,public_site,issuerId}')::uuid AND actor.status='active'
 WHERE node.kind='property' AND node.config #>> '{booking,public_site,siteId}'=p_site::text
   AND node.config #> '{booking,public_site,active}'='true'::jsonb;
 RETURN result;
END $$;
ALTER FUNCTION public.resolve_public_booking_site(uuid) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.resolve_public_booking_site(uuid) FROM PUBLIC,app_role,yellow_runtime;
GRANT EXECUTE ON FUNCTION public.resolve_public_booking_site(uuid) TO yellow_runtime;

CREATE FUNCTION public.assert_public_booking_site(p_site uuid,p_version integer,p_plan uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE node public.org_node%ROWTYPE; site jsonb; now timestamptz;
BEGIN
 IF session_user<>'yellow_runtime' OR current_user<>'yellow_owner'
   OR current_setting('role',true) IS DISTINCT FROM 'app_role' OR p_site IS NULL OR p_version IS NULL THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='public booking authority unavailable';
 END IF;
 SELECT * INTO node FROM public.org_node WHERE kind='property'
 AND tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid
 AND config #>> '{booking,public_site,siteId}'=p_site::text FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='public booking authority unavailable'; END IF;
 site:=node.config #> '{booking,public_site}';
 IF site->'active' IS DISTINCT FROM 'true'::jsonb OR (site->>'version')::integer IS DISTINCT FROM p_version
  OR (p_plan IS NOT NULL AND NOT (site->'ratePlanIds' @> to_jsonb(ARRAY[p_plan]))) THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='public booking authority unavailable';
 END IF;
 now:=public.assert_public_booking_publisher(node.tenant_id,node.id,(site->>'issuerId')::uuid,p_plan);
 RETURN jsonb_build_object('tenantId',node.tenant_id,'propertyNode',node.id,
  'propertyName',node.name,'timeZone',node.timezone,'site',site,'now',now);
END $$;
ALTER FUNCTION public.assert_public_booking_site(uuid,integer,uuid) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.assert_public_booking_site(uuid,integer,uuid) FROM PUBLIC,app_role,yellow_runtime;
GRANT EXECUTE ON FUNCTION public.assert_public_booking_site(uuid,integer,uuid) TO app_role;
