-- Order 151: bounded structural row locking for current financial commands.
-- The capability returns no data and changes no row; business validation remains
-- in FolioService and ChargeService after the locks are acquired.

CREATE FUNCTION public.lock_financial_rows(
  p_tenant uuid,
  p_account_ids uuid[],
  p_folio_id uuid
) RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_context_tenant uuid;
  v_requested_accounts integer;
  v_locked_accounts integer;
  v_locked_folios integer;
BEGIN
  IF pg_catalog.current_setting('role', true) IS DISTINCT FROM 'app_role' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'financial row lock requires app_role';
  END IF;

  BEGIN
    v_context_tenant := NULLIF(
      pg_catalog.current_setting('app.tenant_id', true), ''
    )::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'financial row lock tenant context is invalid';
  END;
  IF v_context_tenant IS NULL OR p_tenant IS NULL OR v_context_tenant <> p_tenant THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'financial row lock tenant context is invalid';
  END IF;

  v_requested_accounts := pg_catalog.cardinality(p_account_ids);
  IF v_requested_accounts IS NULL OR v_requested_accounts < 1 OR v_requested_accounts > 2
     OR EXISTS (SELECT 1 FROM pg_catalog.unnest(p_account_ids) AS requested(id) WHERE id IS NULL)
     OR (SELECT pg_catalog.count(DISTINCT requested.id) FROM pg_catalog.unnest(p_account_ids) AS requested(id))
        <> v_requested_accounts THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'financial row lock account set is invalid';
  END IF;

  SELECT pg_catalog.count(*)::integer INTO v_locked_accounts
  FROM (
    SELECT account.id
    FROM public.account AS account
    WHERE account.tenant_id = p_tenant
      AND account.id = ANY (p_account_ids)
    ORDER BY account.id
    FOR UPDATE
  ) AS locked;
  IF v_locked_accounts <> v_requested_accounts THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'financial row lock targets are unavailable';
  END IF;

  IF p_folio_id IS NOT NULL THEN
    SELECT pg_catalog.count(*)::integer INTO v_locked_folios
    FROM (
      SELECT folio.id
      FROM public.folio AS folio
      WHERE folio.tenant_id = p_tenant
        AND folio.id = p_folio_id
        AND folio.account_id = ANY (p_account_ids)
      FOR UPDATE
    ) AS locked;
    IF v_locked_folios <> 1 THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'financial row lock targets are unavailable';
    END IF;
  END IF;
END;
$$;

ALTER FUNCTION public.lock_financial_rows(uuid,uuid[],uuid) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.lock_financial_rows(uuid,uuid[],uuid)
  FROM PUBLIC, app_role, yellow_runtime;
GRANT EXECUTE ON FUNCTION public.lock_financial_rows(uuid,uuid[],uuid) TO app_role;
