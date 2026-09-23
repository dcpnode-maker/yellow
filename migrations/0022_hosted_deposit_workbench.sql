-- Order 193: token-hash-only hosted deposit requests and immutable applications.

INSERT INTO public.permission (code, description) VALUES
  ('financials.payments:read', 'Read hosted payment and deposit status'),
  ('financials.payments:write', 'Create hosted deposit payment requests'),
  ('financials.deposits:apply', 'Apply captured deposit liability to a folio');

ALTER TABLE public.payment_operation
  DROP CONSTRAINT payment_operation_purpose_ck,
  ADD COLUMN deposit_account_id uuid,
  ADD CONSTRAINT payment_operation_deposit_account_fk
    FOREIGN KEY (tenant_id, property_node, currency, deposit_account_id)
    REFERENCES public.account (tenant_id, property_node, currency, id),
  ADD CONSTRAINT payment_operation_deposit_lineage_uq UNIQUE
    (tenant_id,id,property_node,folio_id,guest_account_id,currency,deposit_account_id,purpose),
  ADD CONSTRAINT payment_operation_purpose_ck CHECK (
    (purpose = 'folio_payment' AND deposit_account_id IS NULL)
    OR (purpose = 'deposit' AND deposit_account_id IS NOT NULL)
  );

GRANT INSERT (deposit_account_id) ON public.payment_operation TO app_role;

CREATE TABLE public.hosted_payment_request (
  tenant_id       uuid NOT NULL,
  id              uuid NOT NULL DEFAULT gen_random_uuid(),
  property_node   uuid NOT NULL,
  folio_id        uuid NOT NULL,
  guest_account_id uuid NOT NULL,
  operation_id    uuid NOT NULL,
  deposit_account_id uuid NOT NULL,
  operation_purpose text NOT NULL DEFAULT 'deposit',
  amount_minor    bigint NOT NULL,
  currency        character(3) NOT NULL,
  bearer_hash     character(64) NOT NULL,
  key_hash        character(64) NOT NULL,
  request_hash    character(64) NOT NULL,
  generation      integer NOT NULL,
  created_by      uuid NOT NULL,
  expires_at      timestamptz NOT NULL,
  revoked_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT pg_catalog.transaction_timestamp(),
  CONSTRAINT hosted_payment_request_pk PRIMARY KEY (tenant_id, id),
  CONSTRAINT hosted_payment_request_bearer_uq UNIQUE (tenant_id, bearer_hash),
  CONSTRAINT hosted_payment_request_key_uq UNIQUE (tenant_id, key_hash),
  CONSTRAINT hosted_payment_request_generation_uq UNIQUE (tenant_id, folio_id, generation),
  CONSTRAINT hosted_payment_request_lineage_uq UNIQUE
    (tenant_id,id,property_node,folio_id,guest_account_id,operation_id,deposit_account_id,currency),
  CONSTRAINT hosted_payment_request_property_fk FOREIGN KEY (tenant_id, property_node)
    REFERENCES public.org_node (tenant_id, id),
  CONSTRAINT hosted_payment_request_operation_fk FOREIGN KEY
    (tenant_id,operation_id,property_node,folio_id,guest_account_id,currency,deposit_account_id,operation_purpose)
    REFERENCES public.payment_operation
    (tenant_id,id,property_node,folio_id,guest_account_id,currency,deposit_account_id,purpose),
  CONSTRAINT hosted_payment_request_folio_fk FOREIGN KEY (tenant_id, guest_account_id, folio_id)
    REFERENCES public.folio (tenant_id, account_id, id),
  CONSTRAINT hosted_payment_request_actor_fk FOREIGN KEY (tenant_id, created_by)
    REFERENCES public.app_user (tenant_id, id),
  CONSTRAINT hosted_payment_request_amount_ck CHECK (amount_minor > 0),
  CONSTRAINT hosted_payment_request_hash_ck CHECK (bearer_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT hosted_payment_request_key_hash_ck CHECK (key_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT hosted_payment_request_request_hash_ck CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT hosted_payment_request_generation_ck CHECK (generation > 0),
  CONSTRAINT hosted_payment_request_purpose_ck CHECK (operation_purpose = 'deposit'),
  CONSTRAINT hosted_payment_request_expiry_ck CHECK (expires_at > created_at),
  CONSTRAINT hosted_payment_request_revocation_ck CHECK (revoked_at IS NULL OR revoked_at >= created_at)
);

CREATE INDEX hosted_payment_request_folio_lookup
  ON public.hosted_payment_request (tenant_id, folio_id, generation DESC, id);
CREATE INDEX hosted_payment_request_operation_lookup
  ON public.hosted_payment_request (tenant_id, operation_id, id);
CREATE INDEX hosted_payment_request_expiry_lookup
  ON public.hosted_payment_request (tenant_id, expires_at, id) WHERE revoked_at IS NULL;

ALTER TABLE public.payment ADD CONSTRAINT payment_deposit_capture_lineage_uq UNIQUE
  (tenant_id,id,operation_id,currency,phase,status);
ALTER TABLE public.journal ADD CONSTRAINT journal_deposit_lineage_uq UNIQUE
  (tenant_id,id,property_node,currency);

CREATE TABLE public.deposit_application (
  tenant_id          uuid NOT NULL,
  id                 uuid NOT NULL DEFAULT gen_random_uuid(),
  property_node      uuid NOT NULL,
  hosted_request_id  uuid NOT NULL,
  operation_id       uuid NOT NULL,
  capture_payment_id uuid NOT NULL,
  capture_phase      text NOT NULL DEFAULT 'capture',
  capture_status     text NOT NULL DEFAULT 'succeeded',
  folio_id           uuid NOT NULL,
  deposit_account_id uuid NOT NULL,
  guest_account_id   uuid NOT NULL,
  amount_minor       bigint NOT NULL,
  currency           character(3) NOT NULL,
  journal_id         uuid NOT NULL,
  key_hash           character(64) NOT NULL,
  request_hash       character(64) NOT NULL,
  created_by         uuid NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT pg_catalog.transaction_timestamp(),
  CONSTRAINT deposit_application_pk PRIMARY KEY (tenant_id, id),
  CONSTRAINT deposit_application_key_uq UNIQUE (tenant_id, key_hash),
  CONSTRAINT deposit_application_property_fk FOREIGN KEY (tenant_id, property_node)
    REFERENCES public.org_node (tenant_id, id),
  CONSTRAINT deposit_application_request_fk FOREIGN KEY
    (tenant_id,hosted_request_id,property_node,folio_id,guest_account_id,operation_id,deposit_account_id,currency)
    REFERENCES public.hosted_payment_request
    (tenant_id,id,property_node,folio_id,guest_account_id,operation_id,deposit_account_id,currency),
  CONSTRAINT deposit_application_capture_fk FOREIGN KEY
    (tenant_id,capture_payment_id,operation_id,currency,capture_phase,capture_status)
    REFERENCES public.payment (tenant_id,id,operation_id,currency,phase,status),
  CONSTRAINT deposit_application_folio_fk FOREIGN KEY (tenant_id, guest_account_id, folio_id)
    REFERENCES public.folio (tenant_id, account_id, id),
  CONSTRAINT deposit_application_deposit_account_fk
    FOREIGN KEY (tenant_id, property_node, currency, deposit_account_id)
    REFERENCES public.account (tenant_id, property_node, currency, id),
  CONSTRAINT deposit_application_guest_account_fk
    FOREIGN KEY (tenant_id, property_node, currency, guest_account_id)
    REFERENCES public.account (tenant_id, property_node, currency, id),
  CONSTRAINT deposit_application_journal_fk FOREIGN KEY (tenant_id,journal_id,property_node,currency)
    REFERENCES public.journal (tenant_id,id,property_node,currency),
  CONSTRAINT deposit_application_actor_fk FOREIGN KEY (tenant_id, created_by)
    REFERENCES public.app_user (tenant_id, id),
  CONSTRAINT deposit_application_amount_ck CHECK (amount_minor > 0),
  CONSTRAINT deposit_application_capture_kind_ck CHECK
    (capture_phase = 'capture' AND capture_status = 'succeeded'),
  CONSTRAINT deposit_application_hashes_ck CHECK (
    key_hash ~ '^[0-9a-f]{64}$' AND request_hash ~ '^[0-9a-f]{64}$'
  )
);

CREATE INDEX deposit_application_capture_lookup
  ON public.deposit_application (tenant_id, capture_payment_id, created_at, id);
CREATE INDEX deposit_application_folio_lookup
  ON public.deposit_application (tenant_id, folio_id, created_at, id);
CREATE INDEX deposit_application_operation_lookup
  ON public.deposit_application (tenant_id, operation_id, created_at, id);

ALTER TABLE public.hosted_payment_request ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON public.hosted_payment_request
  USING (tenant_id = pg_catalog.current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = pg_catalog.current_setting('app.tenant_id', true)::uuid);
ALTER TABLE public.deposit_application ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON public.deposit_application
  USING (tenant_id = pg_catalog.current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = pg_catalog.current_setting('app.tenant_id', true)::uuid);

CREATE FUNCTION public.lock_and_revoke_hosted_payment_requests(
  p_tenant uuid, p_folio uuid, p_revoked_at timestamptz
) RETURNS integer
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE v_context uuid; v_generation integer;
BEGIN
  IF pg_catalog.current_setting('role', true) IS DISTINCT FROM 'app_role' THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='hosted request lock requires app_role';
  END IF;
  BEGIN
    v_context := NULLIF(pg_catalog.current_setting('app.tenant_id', true), '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='hosted request tenant context is invalid';
  END;
  IF v_context IS NULL OR v_context <> p_tenant OR p_folio IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='hosted request tenant context is invalid';
  END IF;
  PERFORM 1 FROM public.folio WHERE tenant_id=p_tenant AND id=p_folio FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000', MESSAGE='folio is unavailable'; END IF;
  SELECT COALESCE(max(generation),0)+1 INTO v_generation
    FROM public.hosted_payment_request WHERE tenant_id=p_tenant AND folio_id=p_folio;
  UPDATE public.hosted_payment_request SET revoked_at=p_revoked_at
   WHERE tenant_id=p_tenant AND folio_id=p_folio AND revoked_at IS NULL AND expires_at>p_revoked_at;
  RETURN v_generation;
END;
$$;
ALTER FUNCTION public.lock_and_revoke_hosted_payment_requests(uuid,uuid,timestamptz) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.lock_and_revoke_hosted_payment_requests(uuid,uuid,timestamptz)
  FROM PUBLIC, app_role, yellow_runtime;
GRANT EXECUTE ON FUNCTION public.lock_and_revoke_hosted_payment_requests(uuid,uuid,timestamptz) TO app_role;

REVOKE ALL ON TABLE public.hosted_payment_request, public.deposit_application
  FROM PUBLIC, app_role, yellow_runtime;
GRANT SELECT ON TABLE public.hosted_payment_request, public.deposit_application TO app_role;
GRANT INSERT (tenant_id,id,property_node,folio_id,guest_account_id,operation_id,deposit_account_id,amount_minor,currency,bearer_hash,
  key_hash,request_hash,generation,created_by,expires_at) ON public.hosted_payment_request TO app_role;
GRANT INSERT (tenant_id,id,property_node,hosted_request_id,operation_id,capture_payment_id,folio_id,
  deposit_account_id,guest_account_id,amount_minor,currency,journal_id,key_hash,request_hash,created_by)
  ON public.deposit_application TO app_role;
REVOKE UPDATE, DELETE, TRUNCATE ON public.hosted_payment_request, public.deposit_application
  FROM PUBLIC, app_role, yellow_runtime;
