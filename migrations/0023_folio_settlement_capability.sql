-- Order 196: bounded, monotonic folio settlement and closure authority.
-- The app role retains no direct UPDATE privilege on folio; this capability may
-- change only one exact tenant/property folio from open -> settled or
-- settled -> closed after the shared financial row lock has been acquired.

CREATE FUNCTION public.transition_folio_status(
  p_tenant uuid,
  p_property uuid,
  p_folio uuid,
  p_action text
) RETURNS TABLE (
  folio_id uuid,
  account_id uuid,
  reservation_id uuid,
  window_no smallint,
  previous_status text,
  status text,
  balance_minor bigint
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_context_tenant uuid;
  v_account_id uuid;
  v_reservation_id uuid;
  v_window_no smallint;
  v_current_status text;
  v_expected_status text;
  v_next_status text;
  v_balance numeric;
  v_updated_id uuid;
BEGIN
  IF session_user <> 'yellow_runtime'
     OR pg_catalog.current_setting('role', true) IS DISTINCT FROM 'app_role'
     OR current_user <> 'yellow_owner' THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'folio transition requires the governed runtime app role';
  END IF;

  BEGIN
    v_context_tenant := NULLIF(
      pg_catalog.current_setting('app.tenant_id', true), ''
    )::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'folio transition tenant context is invalid';
  END;
  IF v_context_tenant IS NULL OR p_tenant IS NULL
     OR v_context_tenant <> p_tenant THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'folio transition tenant context is invalid';
  END IF;

  IF p_property IS NULL OR p_folio IS NULL
     OR p_action IS NULL OR p_action <> pg_catalog.btrim(p_action)
     OR p_action NOT IN ('settle', 'close') THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'folio transition input is invalid';
  END IF;

  IF p_action = 'settle' THEN
    v_expected_status := 'open';
    v_next_status := 'settled';
  ELSE
    v_expected_status := 'settled';
    v_next_status := 'closed';
  END IF;

  -- Discover only the structurally linked account, then acquire the same
  -- canonical lock order as every other financial command. Reacquiring locks
  -- already held by the service is harmless and keeps direct capability calls
  -- from inventing a second lock order.
  SELECT folio.account_id
    INTO v_account_id
    FROM public.folio AS folio
    JOIN public.account AS account
      ON account.tenant_id = folio.tenant_id
     AND account.id = folio.account_id
    JOIN public.org_node AS property
      ON property.tenant_id = account.tenant_id
     AND property.id = account.property_node
     AND property.kind = 'property'
     AND property.currency = account.currency
   WHERE folio.tenant_id = p_tenant
     AND folio.id = p_folio
     AND account.property_node = p_property
     AND account.role = 'guest';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'folio transition target is unavailable';
  END IF;

  PERFORM public.lock_financial_rows(
    p_tenant,
    ARRAY[v_account_id]::uuid[],
    p_folio
  );

  SELECT folio.account_id, folio.reservation_id, folio.window_no, folio.status
    INTO v_account_id, v_reservation_id, v_window_no, v_current_status
    FROM public.folio AS folio
    JOIN public.account AS account
      ON account.tenant_id = folio.tenant_id
     AND account.id = folio.account_id
    JOIN public.org_node AS property
      ON property.tenant_id = account.tenant_id
     AND property.id = account.property_node
     AND property.kind = 'property'
     AND property.currency = account.currency
   WHERE folio.tenant_id = p_tenant
     AND folio.id = p_folio
     AND account.property_node = p_property
     AND account.role = 'guest'
     AND account.status = 'open'
   FOR UPDATE OF folio, account;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'folio transition target is unavailable';
  END IF;
  IF v_current_status <> v_expected_status THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'folio transition state is invalid';
  END IF;

  SELECT balance.balance_minor
    INTO v_balance
    FROM public.folio_balance AS balance
   WHERE balance.tenant_id = p_tenant
     AND balance.folio_id = p_folio;
  v_balance := COALESCE(v_balance, 0::numeric);
  IF v_balance <> 0::numeric THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'folio transition requires a zero balance';
  END IF;

  UPDATE public.folio AS folio
     SET status = v_next_status
   WHERE folio.tenant_id = p_tenant
     AND folio.id = p_folio
     AND folio.account_id = v_account_id
     AND folio.status = v_expected_status
  RETURNING folio.id INTO v_updated_id;
  IF v_updated_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'folio transition state changed concurrently';
  END IF;

  RETURN QUERY
  SELECT v_updated_id, v_account_id, v_reservation_id, v_window_no,
         v_expected_status, v_next_status, 0::bigint;
END;
$$;

ALTER FUNCTION public.transition_folio_status(uuid,uuid,uuid,text)
  OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.transition_folio_status(uuid,uuid,uuid,text)
  FROM PUBLIC, app_role, yellow_runtime;
GRANT EXECUTE ON FUNCTION public.transition_folio_status(uuid,uuid,uuid,text)
  TO app_role;

-- Preserve the direct-mutation denial as an explicit migration contract.
REVOKE UPDATE ON public.folio FROM PUBLIC, app_role, yellow_runtime;
