-- Order 344: accounting-only owner expense with an exact, one-use negative trust authorization.
INSERT INTO public.tx_code(code,name,grp,usali_line,default_dr,default_cr)
VALUES ('OWNER_TRUST_EXPENSE','Owner trust expense accrual','paidout',NULL,'trust','payable')
ON CONFLICT (code) DO NOTHING;

DO $guard$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.tx_code WHERE code='OWNER_TRUST_EXPENSE'
    AND name='Owner trust expense accrual' AND grp='paidout' AND usali_line IS NULL
    AND default_dr='trust' AND default_cr='payable') THEN
    RAISE EXCEPTION USING ERRCODE='55000', MESSAGE='OWNER_TRUST_EXPENSE configuration conflicts';
  END IF;
END $guard$;

CREATE TABLE public.trust_negative_authorization (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  property_node uuid NOT NULL,
  owner_party_id uuid NOT NULL,
  trust_account_id uuid NOT NULL,
  payable_account_id uuid NOT NULL,
  approval_request_id uuid NOT NULL,
  journal_id uuid NOT NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  available_before_minor bigint NOT NULL,
  projected_available_minor bigint NOT NULL CHECK (projected_available_minor < 0),
  currency char(3) NOT NULL,
  business_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id),
  UNIQUE (tenant_id,approval_request_id),
  UNIQUE (tenant_id,journal_id),
  CONSTRAINT trust_negative_math_ck CHECK (projected_available_minor = available_before_minor - amount_minor),
  CONSTRAINT trust_negative_property_fk FOREIGN KEY (tenant_id,property_node) REFERENCES public.org_node(tenant_id,id),
  CONSTRAINT trust_negative_owner_fk FOREIGN KEY (tenant_id,owner_party_id) REFERENCES public.party(tenant_id,id),
  CONSTRAINT trust_negative_trust_fk FOREIGN KEY (tenant_id,trust_account_id) REFERENCES public.account(tenant_id,id),
  CONSTRAINT trust_negative_payable_fk FOREIGN KEY (tenant_id,payable_account_id) REFERENCES public.account(tenant_id,id),
  CONSTRAINT trust_negative_approval_fk FOREIGN KEY (tenant_id,approval_request_id) REFERENCES public.approval_request(tenant_id,id),
  CONSTRAINT trust_negative_journal_fk FOREIGN KEY (tenant_id,journal_id) REFERENCES public.journal(tenant_id,id)
);
CREATE INDEX trust_negative_owner ON public.trust_negative_authorization(tenant_id,owner_party_id,created_at DESC);
ALTER TABLE public.trust_negative_authorization ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON public.trust_negative_authorization
  USING (tenant_id=current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id=current_setting('app.tenant_id')::uuid);
GRANT SELECT ON public.trust_negative_authorization TO app_role;
REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON public.trust_negative_authorization FROM PUBLIC,app_role,yellow_runtime;

CREATE FUNCTION public.create_owner_trust_expense(
  p_tenant uuid,p_trust_account uuid,p_actor uuid,p_approval uuid,p_amount bigint,p_reason text
) RETURNS TABLE(journal_id uuid,property_node uuid,owner_party_id uuid,trust_account_id uuid,
  payable_account_id uuid,business_date date,currency character(3),amount_minor bigint,
  available_before_minor bigint,projected_available_minor bigint,approval_request_id uuid)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE
  v_context uuid; v_property uuid; v_owner uuid; v_payable uuid; v_currency char(3);
  v_timezone text; v_date date; v_sum numeric; v_before numeric; v_after numeric; v_journal uuid;
BEGIN
  IF session_user <> 'yellow_runtime' OR pg_catalog.current_setting('role',true) IS DISTINCT FROM 'app_role'
     OR current_user <> 'yellow_owner' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='owner trust expense requires governed runtime app role'; END IF;
  BEGIN v_context:=NULLIF(pg_catalog.current_setting('app.tenant_id',true),'')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='owner trust tenant context is invalid'; END;
  IF v_context IS NULL OR p_tenant IS NULL OR v_context<>p_tenant THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='owner trust tenant context is invalid'; END IF;
  IF p_trust_account IS NULL OR p_actor IS NULL OR p_amount IS NULL OR p_amount<=0 OR p_reason IS NULL
     OR pg_catalog.octet_length(p_reason) NOT BETWEEN 1 AND 500 OR p_reason<>pg_catalog.btrim(p_reason)
     OR p_reason ~ '[[:cntrl:]]' OR p_reason ~ U&'[\200B-\200D\202A-\202E\2060\2066-\2069\FEFF]' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='owner trust expense input is invalid'; END IF;

  SELECT a.property_node,a.party_id,a.currency,p.timezone INTO v_property,v_owner,v_currency,v_timezone
    FROM public.account a JOIN public.org_node p ON p.tenant_id=a.tenant_id AND p.id=a.property_node AND p.kind='property'
   WHERE a.tenant_id=p_tenant AND a.id=p_trust_account;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='owner trust account is unavailable'; END IF;
  SELECT r.credit_account_id INTO v_payable FROM public.tx_code_route r
   WHERE r.tenant_id=p_tenant AND r.property_node=v_property AND r.currency=v_currency
     AND r.tx_code='OWNER_TRUST_EXPENSE' AND r.debit_account_id=p_trust_account;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='owner trust route is unavailable'; END IF;
  PERFORM public.lock_financial_rows(p_tenant,ARRAY[p_trust_account,v_payable]::uuid[],NULL);

  PERFORM 1 FROM public.app_user u
   JOIN public.user_role ur ON ur.tenant_id=u.tenant_id AND ur.user_id=u.id AND ur.scope_node=v_property
   JOIN public.role_permission rp ON rp.role_id=ur.role_id AND rp.permission_code='financials.trust:post'
   WHERE u.tenant_id=p_tenant AND u.id=p_actor AND u.status='active';
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='owner trust actor is unauthorized'; END IF;
  PERFORM 1 FROM public.account trust
   JOIN public.party owner ON owner.tenant_id=trust.tenant_id AND owner.id=trust.party_id AND owner.status='active'
   JOIN public.party_role pr ON pr.tenant_id=owner.tenant_id AND pr.party_id=owner.id AND pr.role='owner'
   JOIN public.account payable ON payable.tenant_id=trust.tenant_id AND payable.id=v_payable
   WHERE trust.tenant_id=p_tenant AND trust.id=p_trust_account AND trust.property_node=v_property
     AND trust.role='trust' AND trust.status='open' AND trust.currency=v_currency
     AND payable.property_node=v_property AND payable.role='payable' AND payable.status='open' AND payable.currency=v_currency
   FOR UPDATE OF trust,payable,owner;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='owner trust route is unavailable'; END IF;
  SELECT COALESCE(pg_catalog.sum(line.amount_minor::numeric),0) INTO v_sum
    FROM public.posting_line AS line
   WHERE line.tenant_id=p_tenant AND line.account_id=p_trust_account;
  v_before:=-v_sum; v_after:=v_before-p_amount::numeric;
  IF v_before NOT BETWEEN (-9223372036854775808)::numeric AND 9223372036854775807::numeric
     OR v_after NOT BETWEEN (-9223372036854775808)::numeric AND 9223372036854775807::numeric THEN
    RAISE EXCEPTION USING ERRCODE='22003',MESSAGE='owner trust balance is outside signed int64'; END IF;
  IF v_after>=0 THEN
    IF p_approval IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='non-negative owner trust expense must not consume approval'; END IF;
  ELSE
    IF p_approval IS NULL THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='negative owner trust expense requires exact approval'; END IF;
    PERFORM 1 FROM public.approval_request ar
      JOIN public.app_user checker ON checker.tenant_id=ar.tenant_id AND checker.id=ar.decided_by AND checker.status='active'
      JOIN public.user_role ur ON ur.tenant_id=checker.tenant_id AND ur.user_id=checker.id AND ur.scope_node=v_property
      JOIN public.role_permission rp ON rp.role_id=ur.role_id AND rp.permission_code='financials.trust:approve-negative'
     WHERE ar.tenant_id=p_tenant AND ar.id=p_approval AND ar.kind='owner_trust_negative_expense'
       AND ar.subject_type='account' AND ar.subject_id=p_trust_account AND ar.requested_by=p_actor
       AND ar.status='approved' AND ar.decided_by IS NOT NULL AND ar.decided_by<>p_actor AND ar.decided_at IS NOT NULL
       AND ar.payload=pg_catalog.jsonb_build_object('ownerPartyId',v_owner::text,'trustAccountId',p_trust_account::text,
         'payableAccountId',v_payable::text,'amountMinor',p_amount::text,'availableBeforeMinor',v_before::bigint::text,
         'projectedAvailableMinor',v_after::bigint::text,'reason',p_reason)
       AND NOT EXISTS(SELECT 1 FROM public.journal j WHERE j.tenant_id=p_tenant AND j.approval_request_id=p_approval)
     FOR UPDATE OF ar;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='owner trust approval is unavailable, stale, or used'; END IF;
  END IF;
  v_date:=(pg_catalog.transaction_timestamp() AT TIME ZONE v_timezone)::date;
  PERFORM 1 FROM public.business_day d WHERE d.tenant_id=p_tenant AND d.property_node=v_property AND d.business_date=v_date AND d.sealed_at IS NULL FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0011',MESSAGE='owner trust business day is unavailable or sealed'; END IF;
  INSERT INTO public.journal(tenant_id,property_node,business_date,kind,description,currency,source,created_by,approval_request_id)
  VALUES(p_tenant,v_property,v_date,'paidout',p_reason,v_currency,'{"interface":"financials.trust.owner-expense.post"}'::jsonb,p_actor,p_approval)
  RETURNING id INTO v_journal;
  INSERT INTO public.posting_line(tenant_id,journal_id,seq,account_id,folio_id,tx_code,description,amount_minor,quantity,tax_detail,business_date,currency)
  VALUES (p_tenant,v_journal,1,p_trust_account,NULL,'OWNER_TRUST_EXPENSE',p_reason,p_amount,1,NULL,v_date,v_currency),
         (p_tenant,v_journal,2,v_payable,NULL,'OWNER_TRUST_EXPENSE',p_reason,-p_amount,1,NULL,v_date,v_currency);
  IF v_after<0 THEN INSERT INTO public.trust_negative_authorization(tenant_id,property_node,owner_party_id,trust_account_id,payable_account_id,approval_request_id,journal_id,amount_minor,available_before_minor,projected_available_minor,currency,business_date)
    VALUES(p_tenant,v_property,v_owner,p_trust_account,v_payable,p_approval,v_journal,p_amount,v_before::bigint,v_after::bigint,v_currency,v_date); END IF;
  RETURN QUERY SELECT v_journal,v_property,v_owner,p_trust_account,v_payable,v_date,v_currency,p_amount,v_before::bigint,v_after::bigint,p_approval;
END $$;
ALTER FUNCTION public.create_owner_trust_expense(uuid,uuid,uuid,uuid,bigint,text) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.create_owner_trust_expense(uuid,uuid,uuid,uuid,bigint,text) FROM PUBLIC,app_role,yellow_runtime;
GRANT EXECUTE ON FUNCTION public.create_owner_trust_expense(uuid,uuid,uuid,uuid,bigint,text) TO app_role;
