-- Order 386: read-only, lock-coherent owner-trust expense preparation.
CREATE FUNCTION public.prepare_owner_trust_expense(
  p_tenant uuid,p_trust_account uuid,p_actor uuid,p_amount bigint,p_reason text
) RETURNS TABLE(property_node uuid,owner_party_id uuid,owner_label text,
  trust_account_id uuid,trust_account_label text,payable_account_id uuid,
  currency character(3),amount_minor bigint,available_before_minor bigint,
  projected_available_minor bigint,approval_required boolean,approval_payload jsonb)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE
  v_context uuid; v_property uuid; v_owner uuid; v_owner_label text;
  v_trust_label text; v_payable uuid; v_currency char(3);
  v_sum numeric; v_before numeric; v_after numeric;
BEGIN
  IF session_user <> 'yellow_runtime' OR pg_catalog.current_setting('role',true) IS DISTINCT FROM 'app_role'
     OR current_user <> 'yellow_owner' THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='owner trust preparation requires governed runtime app role';
  END IF;
  BEGIN v_context:=NULLIF(pg_catalog.current_setting('app.tenant_id',true),'')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='owner trust tenant context is invalid';
  END;
  IF v_context IS NULL OR p_tenant IS NULL OR v_context<>p_tenant THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='owner trust tenant context is invalid';
  END IF;
  IF p_trust_account IS NULL OR p_actor IS NULL OR p_amount IS NULL OR p_amount<=0
     OR p_reason IS NULL OR pg_catalog.octet_length(p_reason) NOT BETWEEN 1 AND 500
     OR p_reason<>pg_catalog.btrim(p_reason) OR p_reason ~ '[[:cntrl:]]'
     OR p_reason ~ U&'[\200B-\200D\202A-\202E\2060\2066-\2069\FEFF]' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='owner trust expense input is invalid';
  END IF;

  SELECT trust.property_node,trust.party_id,trust.name,trust.currency,owner.display_name
    INTO v_property,v_owner,v_trust_label,v_currency,v_owner_label
    FROM public.account trust
    JOIN public.org_node property ON property.tenant_id=trust.tenant_id
      AND property.id=trust.property_node AND property.kind='property'
    JOIN public.party owner ON owner.tenant_id=trust.tenant_id
      AND owner.id=trust.party_id AND owner.status='active'
    JOIN public.party_role owner_role ON owner_role.tenant_id=owner.tenant_id
      AND owner_role.party_id=owner.id AND owner_role.role='owner'
   WHERE trust.tenant_id=p_tenant AND trust.id=p_trust_account
     AND trust.role='trust' AND trust.status='open';
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='owner trust account is unavailable'; END IF;
  SELECT route.credit_account_id INTO v_payable
    FROM public.tx_code_route route
   WHERE route.tenant_id=p_tenant AND route.property_node=v_property
     AND route.currency=v_currency AND route.tx_code='OWNER_TRUST_EXPENSE'
     AND route.debit_account_id=p_trust_account;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='owner trust route is unavailable'; END IF;

  -- Identical deterministic financial-row lock order to create_owner_trust_expense.
  PERFORM public.lock_financial_rows(p_tenant,ARRAY[p_trust_account,v_payable]::uuid[],NULL);
  PERFORM 1 FROM public.app_user actor
    JOIN public.user_role actor_role ON actor_role.tenant_id=actor.tenant_id
      AND actor_role.user_id=actor.id AND actor_role.scope_node=v_property
    JOIN public.role_permission permission ON permission.role_id=actor_role.role_id
      AND permission.permission_code='financials.trust:post'
   WHERE actor.tenant_id=p_tenant AND actor.id=p_actor AND actor.status='active';
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='owner trust actor is unauthorized'; END IF;
  PERFORM 1 FROM public.account trust
    JOIN public.party owner ON owner.tenant_id=trust.tenant_id
      AND owner.id=trust.party_id AND owner.status='active'
    JOIN public.party_role owner_role ON owner_role.tenant_id=owner.tenant_id
      AND owner_role.party_id=owner.id AND owner_role.role='owner'
    JOIN public.account payable ON payable.tenant_id=trust.tenant_id AND payable.id=v_payable
   WHERE trust.tenant_id=p_tenant AND trust.id=p_trust_account
     AND trust.property_node=v_property AND trust.role='trust' AND trust.status='open'
     AND trust.currency=v_currency AND payable.property_node=v_property
     AND payable.role='payable' AND payable.status='open' AND payable.currency=v_currency
   FOR UPDATE OF trust,payable,owner;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='owner trust route is unavailable'; END IF;
  SELECT COALESCE(pg_catalog.sum(line.amount_minor::numeric),0) INTO v_sum
    FROM public.posting_line line
   WHERE line.tenant_id=p_tenant AND line.account_id=p_trust_account;
  v_before:=-v_sum; v_after:=v_before-p_amount::numeric;
  IF v_before NOT BETWEEN (-9223372036854775808)::numeric AND 9223372036854775807::numeric
     OR v_after NOT BETWEEN (-9223372036854775808)::numeric AND 9223372036854775807::numeric THEN
    RAISE EXCEPTION USING ERRCODE='22003',MESSAGE='owner trust balance is outside signed int64';
  END IF;
  RETURN QUERY SELECT v_property,v_owner,v_owner_label,p_trust_account,v_trust_label,v_payable,
    v_currency,p_amount,v_before::bigint,v_after::bigint,(v_after<0),
    pg_catalog.jsonb_build_object('ownerPartyId',v_owner::text,'trustAccountId',p_trust_account::text,
      'payableAccountId',v_payable::text,'amountMinor',p_amount::text,
      'availableBeforeMinor',v_before::bigint::text,'projectedAvailableMinor',v_after::bigint::text,
      'reason',p_reason);
END $$;
ALTER FUNCTION public.prepare_owner_trust_expense(uuid,uuid,uuid,bigint,text) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.prepare_owner_trust_expense(uuid,uuid,uuid,bigint,text) FROM PUBLIC,app_role,yellow_runtime;
GRANT EXECUTE ON FUNCTION public.prepare_owner_trust_expense(uuid,uuid,uuid,bigint,text) TO app_role;
