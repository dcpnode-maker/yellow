-- Order472/Q264: read-only, revoke-safe authority for managed market configuration.
-- app_role has SELECT, not UPDATE, on identity tables; row-lock privilege stays
-- inside this narrow capability. No row mutation, table, role or permission grant.
SET LOCAL ROLE yellow_owner;

CREATE FUNCTION public.assert_market_compset_authority(
  p_tenant uuid, p_property uuid, p_actor uuid, p_permission text
) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $market_authority$
DECLARE
  v_context uuid;
  v_role uuid;
  v_scope uuid;
  v_before jsonb;
  v_after jsonb;
BEGIN
  BEGIN
    v_context := NULLIF(current_setting('app.tenant_id', true), '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'market authority unavailable';
  END;
  IF session_user <> 'yellow_runtime' OR current_user <> 'yellow_owner'
    OR current_setting('role', true) IS DISTINCT FROM 'app_role'
    OR p_tenant IS NULL OR p_property IS NULL OR p_actor IS NULL
    OR v_context IS DISTINCT FROM p_tenant OR p_permission IS NULL
    OR p_permission NOT IN ('distribution.market:read', 'distribution.market:write') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'market authority unavailable';
  END IF;

  -- One complete grant is sufficient. Snapshot its exact membership and relevant
  -- hierarchy/status fields; do not lock or rely upon unrelated grants.
  SELECT r.id, scope.id, jsonb_build_array(
      t.id, t.status, a.id, a.tenant_id, a.status,
      p.id, p.tenant_id, p.path::text, p.kind, p.timezone,
      scope.id, scope.tenant_id, scope.path::text,
      r.id, r.tenant_id, ur.tenant_id, ur.user_id, ur.role_id, ur.scope_node,
      rp.role_id, rp.permission_code
    ) INTO v_role, v_scope, v_before
    FROM public.tenant t
    JOIN public.app_user a ON a.tenant_id = t.id AND a.id = p_actor AND a.status = 'active'
    JOIN public.org_node p ON p.tenant_id = t.id AND p.id = p_property AND p.kind = 'property'
    JOIN public.user_role ur ON ur.tenant_id = a.tenant_id AND ur.user_id = a.id
    JOIN public.role r ON r.tenant_id = ur.tenant_id AND r.id = ur.role_id
    JOIN public.role_permission rp ON rp.role_id = r.id AND rp.permission_code = p_permission
    JOIN public.org_node scope ON scope.tenant_id = ur.tenant_id AND scope.id = ur.scope_node AND scope.path @> p.path
    WHERE t.id = p_tenant AND t.status = 'active'
    ORDER BY r.id, scope.id LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'market authority unavailable';
  END IF;

  -- FOR SHARE (not KEY SHARE) blocks status, hierarchy and permission changes.
  -- Locks survive successful service savepoint release until caller transaction end.
  PERFORM 1 FROM public.tenant WHERE id = p_tenant FOR SHARE;
  PERFORM 1 FROM public.org_node WHERE tenant_id = p_tenant AND id = ANY(ARRAY[p_property, v_scope]) ORDER BY id FOR SHARE;
  PERFORM 1 FROM public.app_user WHERE tenant_id = p_tenant AND id = p_actor FOR SHARE;
  PERFORM 1 FROM public.role WHERE tenant_id = p_tenant AND id = v_role FOR SHARE;
  PERFORM 1 FROM public.user_role WHERE tenant_id = p_tenant AND user_id = p_actor
    AND role_id = v_role AND scope_node = v_scope FOR SHARE;
  PERFORM 1 FROM public.role_permission WHERE role_id = v_role AND permission_code = p_permission FOR SHARE;

  SELECT jsonb_build_array(
      t.id, t.status, a.id, a.tenant_id, a.status,
      p.id, p.tenant_id, p.path::text, p.kind, p.timezone,
      scope.id, scope.tenant_id, scope.path::text,
      r.id, r.tenant_id, ur.tenant_id, ur.user_id, ur.role_id, ur.scope_node,
      rp.role_id, rp.permission_code
    ) INTO v_after
    FROM public.tenant t
    JOIN public.app_user a ON a.tenant_id = t.id AND a.id = p_actor AND a.status = 'active'
    JOIN public.org_node p ON p.tenant_id = t.id AND p.id = p_property AND p.kind = 'property'
    JOIN public.user_role ur ON ur.tenant_id = a.tenant_id AND ur.user_id = a.id
      AND ur.role_id = v_role AND ur.scope_node = v_scope
    JOIN public.role r ON r.tenant_id = ur.tenant_id AND r.id = ur.role_id
    JOIN public.role_permission rp ON rp.role_id = r.id AND rp.permission_code = p_permission
    JOIN public.org_node scope ON scope.tenant_id = ur.tenant_id AND scope.id = ur.scope_node AND scope.path @> p.path
    WHERE t.id = p_tenant AND t.status = 'active';
  IF v_after IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'market authority unavailable';
  END IF;
  IF v_after IS DISTINCT FROM v_before THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'market authority changed while locking';
  END IF;
  RETURN true;
END;
$market_authority$;

ALTER FUNCTION public.assert_market_compset_authority(uuid, uuid, uuid, text) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.assert_market_compset_authority(uuid, uuid, uuid, text) FROM PUBLIC, app_role, yellow_runtime;
GRANT EXECUTE ON FUNCTION public.assert_market_compset_authority(uuid, uuid, uuid, text) TO app_role;
RESET ROLE;
