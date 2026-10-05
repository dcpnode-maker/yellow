-- Order 198: exact positive guest-folio debt may move only to one open,
-- party-specific company or travel-agent receivable under locked derived credit
-- authority. This adds no mutable AR balance, invoice, allocation or settlement.

-- The global posting code is schema configuration. A conflicting predecessor is
-- not silently repaired because its accounting hints are part of the command truth.
INSERT INTO public.tx_code (
  code, name, grp, usali_line, default_dr, default_cr
) VALUES (
  'DIRECT_BILL', 'Direct billing transfer', 'transfer', NULL, 'company', 'guest'
) ON CONFLICT (code) DO NOTHING;

DO $order198_direct_bill_code$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM public.tx_code AS code
     WHERE code.code = 'DIRECT_BILL'
       AND code.name = 'Direct billing transfer'
       AND code.grp = 'transfer'
       AND code.usali_line IS NULL
       AND code.default_dr = 'company'
       AND code.default_cr = 'guest'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'DIRECT_BILL transaction code conflicts with governed configuration';
  END IF;
END;
$order198_direct_bill_code$;

-- Approval evidence remains immutable in approval_request. The journal carries
-- the durable one-use relationship without creating a second receivable ledger.
ALTER TABLE public.journal
  ADD COLUMN approval_request_id uuid,
  ADD CONSTRAINT journal_approval_request_fk
    FOREIGN KEY (tenant_id, approval_request_id)
    REFERENCES public.approval_request (tenant_id, id);

CREATE UNIQUE INDEX journal_one_use_approval
  ON public.journal (tenant_id, approval_request_id)
  WHERE approval_request_id IS NOT NULL;

CREATE FUNCTION public.create_receivable_transfer(
  p_tenant uuid,
  p_property uuid,
  p_folio uuid,
  p_receivable_account uuid,
  p_actor uuid,
  p_approval uuid,
  p_reason text
) RETURNS TABLE (
  journal_id uuid,
  business_date date,
  currency character(3),
  folio_id uuid,
  guest_account_id uuid,
  receivable_account_id uuid,
  receivable_party_id uuid,
  receivable_party_role text,
  amount_minor bigint,
  exposure_before_minor bigint,
  credit_limit_minor bigint,
  projected_exposure_minor bigint,
  approval_request_id uuid
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_context_tenant uuid;
  v_guest_account uuid;
  v_receivable_party uuid;
  v_receivable_role text;
  v_timezone text;
  v_currency character(3);
  v_target_currency character(3);
  v_credit_limit bigint;
  v_balance numeric;
  v_exposure numeric;
  v_projected numeric;
  v_business_date date;
  v_day_sealed_at timestamptz;
  v_journal uuid;
  v_balance_after numeric;
BEGIN
  IF session_user <> 'yellow_runtime'
     OR pg_catalog.current_setting('role', true) IS DISTINCT FROM 'app_role'
     OR current_user <> 'yellow_owner' THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'receivable transfer requires the governed runtime app role';
  END IF;

  BEGIN
    v_context_tenant := NULLIF(
      pg_catalog.current_setting('app.tenant_id', true), ''
    )::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'receivable transfer tenant context is invalid';
  END;
  IF v_context_tenant IS NULL OR p_tenant IS NULL
     OR v_context_tenant <> p_tenant THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'receivable transfer tenant context is invalid';
  END IF;

  IF p_property IS NULL OR p_folio IS NULL OR p_receivable_account IS NULL
     OR p_actor IS NULL OR p_reason IS NULL
     OR pg_catalog.octet_length(p_reason) NOT BETWEEN 1 AND 500
     OR p_reason <> pg_catalog.btrim(p_reason)
     OR p_reason ~ '[[:cntrl:]]'
     OR p_reason ~ U&'[\200B-\200D\202A-\202E\2060\2066-\2069\FEFF]' THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'receivable transfer input is invalid';
  END IF;

  PERFORM 1
    FROM public.app_user AS actor
   WHERE actor.tenant_id = p_tenant
     AND actor.id = p_actor
     AND actor.status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'receivable transfer actor is unavailable';
  END IF;

  -- Discover only the guest account id needed by the shared lock capability.
  -- All economic and authority predicates are re-evaluated after locking.
  SELECT folio.account_id
    INTO v_guest_account
    FROM public.folio AS folio
   WHERE folio.tenant_id = p_tenant
     AND folio.id = p_folio;
  IF NOT FOUND OR v_guest_account = p_receivable_account THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'receivable transfer target is unavailable';
  END IF;

  PERFORM public.lock_financial_rows(
    p_tenant,
    ARRAY[v_guest_account, p_receivable_account]::uuid[],
    p_folio
  );

  SELECT property.timezone, property.currency,
         folio.account_id,
         target.currency, target.party_id, target.credit_limit_minor,
         CASE
           WHEN EXISTS (
             SELECT 1 FROM public.party_role AS role
              WHERE role.tenant_id = target.tenant_id
                AND role.party_id = target.party_id
                AND role.role = 'company'
           ) THEN 'company'
           ELSE 'agent'
         END
    INTO v_timezone, v_currency, v_guest_account,
         v_target_currency, v_receivable_party, v_credit_limit, v_receivable_role
    FROM public.folio AS folio
    JOIN public.account AS guest
      ON guest.tenant_id = folio.tenant_id
     AND guest.id = folio.account_id
    JOIN public.org_node AS property
      ON property.tenant_id = guest.tenant_id
     AND property.id = guest.property_node
     AND property.kind = 'property'
     AND property.currency = guest.currency
    JOIN public.account AS target
      ON target.tenant_id = guest.tenant_id
     AND target.id = p_receivable_account
     AND target.property_node = guest.property_node
     AND target.currency = guest.currency
    JOIN public.party AS party
      ON party.tenant_id = target.tenant_id
     AND party.id = target.party_id
     AND party.status = 'active'
   WHERE folio.tenant_id = p_tenant
     AND folio.id = p_folio
     AND folio.status = 'open'
     AND guest.property_node = p_property
     AND guest.role = 'guest'
     AND guest.status = 'open'
     AND target.role = 'company'
     AND target.status = 'open'
     AND target.credit_limit_minor IS NOT NULL
     AND target.credit_limit_minor >= 0
     AND EXISTS (
       SELECT 1
         FROM public.party_role AS role
        WHERE role.tenant_id = target.tenant_id
          AND role.party_id = target.party_id
          AND role.role IN ('company', 'agent')
     )
   FOR UPDATE OF folio, guest, target, party;
  IF NOT FOUND OR v_target_currency <> v_currency THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'receivable transfer target is unavailable';
  END IF;

  SELECT balance.balance_minor
    INTO v_balance
    FROM public.folio_balance AS balance
   WHERE balance.tenant_id = p_tenant
     AND balance.folio_id = p_folio;
  v_balance := COALESCE(v_balance, 0::numeric);
  IF v_balance <= 0::numeric THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'receivable transfer requires an exact positive folio balance';
  END IF;
  IF v_balance > 9223372036854775807::numeric THEN
    RAISE EXCEPTION USING ERRCODE = '22003',
      MESSAGE = 'receivable transfer amount is outside signed int64';
  END IF;

  SELECT COALESCE(pg_catalog.sum(line.amount_minor::numeric), 0::numeric)
    INTO v_exposure
    FROM public.posting_line AS line
   WHERE line.tenant_id = p_tenant
     AND line.account_id = p_receivable_account;
  v_projected := v_exposure + v_balance;
  IF v_exposure < (-9223372036854775808)::numeric
     OR v_exposure > 9223372036854775807::numeric
     OR v_projected < (-9223372036854775808)::numeric
     OR v_projected > 9223372036854775807::numeric THEN
    RAISE EXCEPTION USING ERRCODE = '22003',
      MESSAGE = 'receivable exposure is outside signed int64';
  END IF;

  IF v_projected <= v_credit_limit::numeric THEN
    IF p_approval IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE = '22023',
        MESSAGE = 'within-limit receivable transfer must not consume approval';
    END IF;
  ELSE
    IF p_approval IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '55000',
        MESSAGE = 'over-limit receivable transfer requires exact approval';
    END IF;

    PERFORM 1
      FROM public.approval_request AS approval
      JOIN public.app_user AS checker
        ON checker.tenant_id = approval.tenant_id
       AND checker.id = approval.decided_by
       AND checker.status = 'active'
     WHERE approval.tenant_id = p_tenant
       AND approval.id = p_approval
       AND approval.kind = 'receivable_transfer_over_limit'
       AND approval.subject_type = 'folio'
       AND approval.subject_id = p_folio
       AND approval.requested_by = p_actor
       AND approval.status = 'approved'
       AND approval.decided_by IS NOT NULL
       AND approval.decided_by <> p_actor
       AND approval.decided_at IS NOT NULL
       AND approval.payload = pg_catalog.jsonb_build_object(
         'partyId', v_receivable_party::text,
         'accountId', p_receivable_account::text,
         'folioId', p_folio::text,
         'amountMinor', v_balance::bigint::text,
         'exposureBeforeMinor', v_exposure::bigint::text,
         'creditLimitMinor', v_credit_limit::text,
         'projectedExposureMinor', v_projected::bigint::text
       )
       AND NOT EXISTS (
         SELECT 1
           FROM public.journal AS used
          WHERE used.tenant_id = p_tenant
            AND used.approval_request_id = p_approval
       )
     FOR UPDATE OF approval;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = '55000',
        MESSAGE = 'receivable transfer approval is unavailable, stale, or used';
    END IF;
  END IF;

  v_business_date := (
    pg_catalog.transaction_timestamp() AT TIME ZONE v_timezone
  )::date;
  SELECT day.sealed_at
    INTO v_day_sealed_at
    FROM public.business_day AS day
   WHERE day.tenant_id = p_tenant
     AND day.property_node = p_property
     AND day.business_date = v_business_date
   FOR SHARE;
  IF NOT FOUND OR v_day_sealed_at IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0011',
      MESSAGE = 'receivable transfer business day is missing or sealed';
  END IF;

  INSERT INTO public.journal (
    tenant_id, property_node, business_date, kind, description,
    currency, source, created_by, approval_request_id
  ) VALUES (
    p_tenant, p_property, v_business_date, 'transfer', p_reason,
    v_currency, '{"interface":"financials.receivable.transfer"}'::jsonb,
    p_actor, p_approval
  ) RETURNING id INTO v_journal;

  INSERT INTO public.posting_line (
    tenant_id, journal_id, seq, account_id, folio_id, tx_code,
    description, amount_minor, quantity, tax_detail, business_date, currency
  ) VALUES
    (
      p_tenant, v_journal, 1, v_guest_account, p_folio, 'DIRECT_BILL',
      p_reason, -v_balance::bigint, 1, NULL, v_business_date, v_currency
    ),
    (
      p_tenant, v_journal, 2, p_receivable_account, NULL, 'DIRECT_BILL',
      p_reason, v_balance::bigint, 1, NULL, v_business_date, v_currency
    );

  SELECT balance.balance_minor
    INTO v_balance_after
    FROM public.folio_balance AS balance
   WHERE balance.tenant_id = p_tenant
     AND balance.folio_id = p_folio;
  IF COALESCE(v_balance_after, 0::numeric) <> 0::numeric THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'receivable transfer did not clear the exact folio balance';
  END IF;

  RETURN QUERY
  SELECT v_journal, v_business_date, v_currency, p_folio,
         v_guest_account, p_receivable_account, v_receivable_party,
         v_receivable_role, v_balance::bigint, v_exposure::bigint,
         v_credit_limit, v_projected::bigint, p_approval;
END;
$$;

ALTER FUNCTION public.create_receivable_transfer(uuid,uuid,uuid,uuid,uuid,uuid,text)
  OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.create_receivable_transfer(uuid,uuid,uuid,uuid,uuid,uuid,text)
  FROM PUBLIC, app_role, yellow_runtime;
GRANT EXECUTE ON FUNCTION public.create_receivable_transfer(uuid,uuid,uuid,uuid,uuid,uuid,text)
  TO app_role;

-- The runtime's existing journal insert catalogue cannot populate new approval
-- lineage; only the owner-mediated capability can bind one approval to one journal.
REVOKE INSERT (approval_request_id), UPDATE (approval_request_id)
  ON public.journal FROM PUBLIC, app_role, yellow_runtime;
