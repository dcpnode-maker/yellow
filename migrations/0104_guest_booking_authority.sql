-- Reserved by laptop controller for invitation-bound guest booking authority.
-- No new tables or runtime DML grants. Lock live authority until transaction ends.
DO $precondition$
BEGIN
  IF (SELECT count(*) FROM public.schema_migration) IS DISTINCT FROM 103::bigint
     OR (SELECT max(version) FROM public.schema_migration) IS DISTINCT FROM 103 THEN
    RAISE EXCEPTION USING ERRCODE='55000',
      MESSAGE='guest booking authority requires canonical migration103';
  END IF;
END
$precondition$;

CREATE FUNCTION public.assert_guest_booking_authority(p_tenant uuid,p_property uuid,p_actor uuid,p_party uuid,p_rate_plan uuid DEFAULT NULL)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE
 required_scopes text[] := ARRAY['inventory.availability:read','rates.configuration:read',
   'inventory.holds:write','reservations.booking:write','crm.parties:read'];
 found_scopes text[] := ARRAY[]::text[];
 grant_row record;
BEGIN
 IF session_user <> 'yellow_runtime' OR current_setting('role',true) IS DISTINCT FROM 'app_role'
    OR current_user <> 'yellow_owner' OR p_tenant IS NULL OR p_property IS NULL OR p_actor IS NULL OR p_party IS NULL
    OR nullif(current_setting('app.tenant_id',true),'') IS DISTINCT FROM p_tenant::text THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='guest booking authority unavailable';
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
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='guest booking authority unavailable';
 END IF;
 PERFORM guest.id FROM public.party guest
 WHERE guest.tenant_id=p_tenant AND guest.id=p_party AND guest.status='active'
 FOR SHARE;
 IF NOT FOUND THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='guest booking authority unavailable';
 END IF;
 IF p_rate_plan IS NOT NULL THEN
  PERFORM plan.id FROM public.rate_plan plan WHERE plan.tenant_id=p_tenant
    AND plan.property_node=p_property AND plan.id=p_rate_plan AND plan.status='active'
    FOR SHARE;
  IF NOT FOUND THEN
   RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='guest booking authority unavailable';
  END IF;
  PERFORM policy.id FROM public.policy policy JOIN public.rate_plan plan
    ON policy.id IN (plan.cancellation_policy,plan.guarantee_policy,plan.deposit_policy)
    AND policy.tenant_id=plan.tenant_id
    WHERE plan.tenant_id=p_tenant AND plan.id=p_rate_plan
    ORDER BY policy.id FOR SHARE OF policy;
 END IF;
 RETURN clock_timestamp();
END $$;
ALTER FUNCTION public.assert_guest_booking_authority(uuid,uuid,uuid,uuid,uuid) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.assert_guest_booking_authority(uuid,uuid,uuid,uuid,uuid) FROM PUBLIC,app_role,yellow_runtime;
GRANT EXECUTE ON FUNCTION public.assert_guest_booking_authority(uuid,uuid,uuid,uuid,uuid) TO app_role;
