-- Order 192: durable token-only payment operations, append-only attempts and
-- provider receipts. The migration is intentionally fail-closed because there is
-- no approved policy for assigning any legacy payment row to an operation.

DO $order192_no_legacy_payments$
BEGIN
  IF EXISTS (SELECT 1 FROM public.payment) THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'migration 0021 requires an empty legacy payment table';
  END IF;
END
$order192_no_legacy_payments$;

ALTER TABLE public.payment_instrument
  ADD CONSTRAINT payment_instrument_tenant_id_uq UNIQUE (tenant_id, id),
  ADD CONSTRAINT payment_instrument_token_shape_ck CHECK (
    token IS NULL OR (
      pg_catalog.octet_length(token) BETWEEN 16 AND 512
      AND token ~ '^[!-~]+$'
      AND token !~ '^[0-9]{12,19}$'
    )
  ),
  ADD CONSTRAINT payment_instrument_status_ck
    CHECK (status IN ('active', 'inactive', 'revoked'));

ALTER TABLE public.app_user
  ADD CONSTRAINT app_user_tenant_id_uq UNIQUE (tenant_id, id);

CREATE TABLE public.payment_operation (
  tenant_id          uuid NOT NULL,
  id                 uuid NOT NULL DEFAULT gen_random_uuid(),
  property_node      uuid NOT NULL,
  folio_id           uuid NOT NULL,
  guest_account_id   uuid NOT NULL,
  instrument_id      uuid NOT NULL,
  provider           text NOT NULL,
  method             text NOT NULL,
  currency           character(3) NOT NULL,
  tx_code             text NOT NULL,
  clearing_account_id uuid NOT NULL,
  purpose            text NOT NULL DEFAULT 'folio_payment',
  key_hash           character(64) NOT NULL,
  request_hash       character(64) NOT NULL,
  actor_id           uuid NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT pg_catalog.transaction_timestamp(),
  CONSTRAINT payment_operation_pk PRIMARY KEY (tenant_id, id),
  CONSTRAINT payment_operation_tenant_id_currency_uq UNIQUE (tenant_id, id, currency),
  CONSTRAINT payment_operation_key_uq UNIQUE (tenant_id, key_hash),
  CONSTRAINT payment_operation_property_fk
    FOREIGN KEY (tenant_id, property_node)
    REFERENCES public.org_node (tenant_id, id),
  CONSTRAINT payment_operation_folio_fk
    FOREIGN KEY (tenant_id, guest_account_id, folio_id)
    REFERENCES public.folio (tenant_id, account_id, id),
  CONSTRAINT payment_operation_guest_account_fk
    FOREIGN KEY (tenant_id, property_node, currency, guest_account_id)
    REFERENCES public.account (tenant_id, property_node, currency, id),
  CONSTRAINT payment_operation_clearing_account_fk
    FOREIGN KEY (tenant_id, property_node, currency, clearing_account_id)
    REFERENCES public.account (tenant_id, property_node, currency, id),
  CONSTRAINT payment_operation_instrument_fk
    FOREIGN KEY (tenant_id, instrument_id)
    REFERENCES public.payment_instrument (tenant_id, id),
  CONSTRAINT payment_operation_actor_fk
    FOREIGN KEY (tenant_id, actor_id)
    REFERENCES public.app_user (tenant_id, id),
  CONSTRAINT payment_operation_tx_code_fk
    FOREIGN KEY (tx_code) REFERENCES public.tx_code (code),
  CONSTRAINT payment_operation_provider_ck
    CHECK (provider ~ '^[a-z][a-z0-9._-]{0,63}$'),
  CONSTRAINT payment_operation_method_ck CHECK (method IN ('card', 'upi')),
  CONSTRAINT payment_operation_purpose_ck CHECK (purpose = 'folio_payment'),
  CONSTRAINT payment_operation_hashes_ck CHECK (
    key_hash ~ '^[0-9a-f]{64}$' AND request_hash ~ '^[0-9a-f]{64}$'
  )
);

CREATE INDEX payment_operation_folio_lookup
  ON public.payment_operation (tenant_id, folio_id, created_at, id);
CREATE INDEX payment_operation_instrument_lookup
  ON public.payment_operation (tenant_id, instrument_id, created_at, id);

CREATE TABLE public.provider_event_receipt (
  tenant_id        uuid NOT NULL,
  id               uuid NOT NULL DEFAULT gen_random_uuid(),
  operation_id     uuid NOT NULL,
  provider         text NOT NULL,
  event_id         text NOT NULL,
  content_hash     character(64) NOT NULL,
  provider_reference text NOT NULL,
  phase            text NOT NULL,
  outcome          text NOT NULL,
  amount_minor     bigint NOT NULL,
  currency         character(3) NOT NULL,
  received_at      timestamptz NOT NULL DEFAULT pg_catalog.transaction_timestamp(),
  CONSTRAINT provider_event_receipt_pk PRIMARY KEY (tenant_id, id),
  CONSTRAINT provider_event_receipt_provider_event_uq UNIQUE (tenant_id, provider, event_id),
  CONSTRAINT provider_event_receipt_operation_fk
    FOREIGN KEY (tenant_id, operation_id, currency)
    REFERENCES public.payment_operation (tenant_id, id, currency),
  CONSTRAINT provider_event_receipt_provider_ck
    CHECK (provider ~ '^[a-z][a-z0-9._-]{0,63}$'),
  CONSTRAINT provider_event_receipt_event_id_ck
    CHECK (pg_catalog.octet_length(event_id) BETWEEN 8 AND 200 AND event_id ~ '^[!-~]+$'),
  CONSTRAINT provider_event_receipt_provider_reference_ck
    CHECK (pg_catalog.octet_length(provider_reference) BETWEEN 1 AND 200
      AND provider_reference ~ '^[!-~]+$'),
  CONSTRAINT provider_event_receipt_content_hash_ck CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT provider_event_receipt_phase_ck
    CHECK (phase IN ('auth', 'incremental_auth', 'capture', 'void', 'refund')),
  CONSTRAINT provider_event_receipt_outcome_ck
    CHECK (outcome IN ('approved', 'declined', 'indeterminate')),
  CONSTRAINT provider_event_receipt_amount_ck CHECK (amount_minor > 0)
);

CREATE INDEX provider_event_receipt_operation_lookup
  ON public.provider_event_receipt (tenant_id, operation_id, received_at, id);

ALTER TABLE public.payment
  ADD COLUMN operation_id uuid,
  ADD COLUMN predecessor_payment_id uuid,
  ADD COLUMN receipt_id uuid,
  ADD COLUMN capture_payment_id uuid,
  ADD COLUMN capture_journal_id uuid,
  ADD COLUMN attempt_no integer,
  ADD COLUMN result_code text,
  ADD COLUMN command_key_hash character(64),
  ADD COLUMN request_hash character(64),
  ADD CONSTRAINT payment_tenant_id_uq UNIQUE (tenant_id, id),
  ADD CONSTRAINT payment_operation_fk
    FOREIGN KEY (tenant_id, operation_id, currency)
    REFERENCES public.payment_operation (tenant_id, id, currency),
  ADD CONSTRAINT payment_instrument_tenant_fk
    FOREIGN KEY (tenant_id, instrument_id)
    REFERENCES public.payment_instrument (tenant_id, id),
  ADD CONSTRAINT payment_journal_tenant_fk
    FOREIGN KEY (tenant_id, journal_id)
    REFERENCES public.journal (tenant_id, id),
  ADD CONSTRAINT payment_predecessor_tenant_fk
    FOREIGN KEY (tenant_id, predecessor_payment_id)
    REFERENCES public.payment (tenant_id, id),
  ADD CONSTRAINT payment_receipt_tenant_fk
    FOREIGN KEY (tenant_id, receipt_id)
    REFERENCES public.provider_event_receipt (tenant_id, id),
  ADD CONSTRAINT payment_capture_payment_tenant_fk
    FOREIGN KEY (tenant_id, capture_payment_id)
    REFERENCES public.payment (tenant_id, id),
  ADD CONSTRAINT payment_capture_journal_tenant_fk
    FOREIGN KEY (tenant_id, capture_journal_id)
    REFERENCES public.journal (tenant_id, id),
  ADD CONSTRAINT payment_attempt_uq UNIQUE (tenant_id, operation_id, attempt_no),
  ADD CONSTRAINT payment_command_key_uq UNIQUE (tenant_id, operation_id, command_key_hash),
  ADD CONSTRAINT payment_receipt_uq UNIQUE (tenant_id, receipt_id),
  ADD CONSTRAINT payment_amount_positive_ck CHECK (amount_minor > 0),
  ADD CONSTRAINT payment_attempt_positive_ck CHECK (attempt_no > 0),
  ADD CONSTRAINT payment_result_code_ck
    CHECK (result_code ~ '^[a-z][a-z0-9._-]{0,63}$'),
  ADD CONSTRAINT payment_hashes_ck CHECK (
    command_key_hash ~ '^[0-9a-f]{64}$' AND request_hash ~ '^[0-9a-f]{64}$'
  ),
  ADD CONSTRAINT payment_journal_shape_ck CHECK (
    (status = 'succeeded' AND phase IN ('capture', 'refund') AND journal_id IS NOT NULL)
    OR (NOT (status = 'succeeded' AND phase IN ('capture', 'refund')) AND journal_id IS NULL)
  ),
  ADD CONSTRAINT payment_refund_lineage_ck CHECK (
    (status = 'succeeded' AND phase = 'refund'
      AND capture_payment_id IS NOT NULL AND capture_journal_id IS NOT NULL)
    OR (NOT (status = 'succeeded' AND phase = 'refund')
      AND capture_payment_id IS NULL AND capture_journal_id IS NULL)
  );

ALTER TABLE public.payment
  ALTER COLUMN operation_id SET NOT NULL,
  ALTER COLUMN instrument_id SET NOT NULL,
  ALTER COLUMN attempt_no SET NOT NULL,
  ALTER COLUMN result_code SET NOT NULL,
  ALTER COLUMN command_key_hash SET NOT NULL,
  ALTER COLUMN request_hash SET NOT NULL,
  ALTER COLUMN psp SET NOT NULL;

CREATE UNIQUE INDEX payment_one_successful_capture
  ON public.payment (tenant_id, operation_id)
  WHERE phase = 'capture' AND status = 'succeeded';
CREATE INDEX payment_operation_chain
  ON public.payment (tenant_id, operation_id, attempt_no, id);
CREATE INDEX payment_predecessor_lookup
  ON public.payment (tenant_id, predecessor_payment_id)
  WHERE predecessor_payment_id IS NOT NULL;
CREATE INDEX payment_capture_lookup
  ON public.payment (tenant_id, capture_payment_id)
  WHERE capture_payment_id IS NOT NULL;

ALTER TABLE public.payment_operation ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON public.payment_operation
  USING (tenant_id = pg_catalog.current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = pg_catalog.current_setting('app.tenant_id', true)::uuid);
ALTER TABLE public.provider_event_receipt ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON public.provider_event_receipt
  USING (tenant_id = pg_catalog.current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = pg_catalog.current_setting('app.tenant_id', true)::uuid);

CREATE FUNCTION public.lock_payment_operation(p_tenant uuid, p_operation uuid)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_context uuid;
BEGIN
  IF pg_catalog.current_setting('role', true) IS DISTINCT FROM 'app_role' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'payment operation lock requires app_role';
  END IF;
  BEGIN
    v_context := NULLIF(pg_catalog.current_setting('app.tenant_id', true), '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'payment operation tenant context is invalid';
  END;
  IF v_context IS NULL OR p_tenant IS NULL OR p_operation IS NULL OR v_context <> p_tenant THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'payment operation tenant context is invalid';
  END IF;
  PERFORM 1 FROM public.payment_operation
   WHERE tenant_id = p_tenant AND id = p_operation
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'payment operation is unavailable';
  END IF;
END;
$$;

ALTER FUNCTION public.lock_payment_operation(uuid,uuid) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.lock_payment_operation(uuid,uuid)
  FROM PUBLIC, app_role, yellow_runtime;
GRANT EXECUTE ON FUNCTION public.lock_payment_operation(uuid,uuid) TO app_role;

REVOKE ALL ON TABLE public.payment_operation, public.provider_event_receipt
  FROM PUBLIC, app_role, yellow_runtime;
GRANT SELECT ON TABLE public.payment_operation, public.provider_event_receipt TO app_role;
GRANT INSERT (
  tenant_id, id, property_node, folio_id, guest_account_id, instrument_id,
  provider, method, currency, tx_code, clearing_account_id, purpose,
  key_hash, request_hash, actor_id
) ON public.payment_operation TO app_role;
GRANT INSERT (
  tenant_id, operation_id, provider, event_id, content_hash,
  provider_reference, phase, outcome, amount_minor, currency
) ON public.provider_event_receipt TO app_role;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.payment FROM app_role;
GRANT SELECT ON public.payment TO app_role;
GRANT INSERT (
  tenant_id, journal_id, instrument_id, psp, psp_ref, method, phase,
  amount_minor, currency, status, operation_id, predecessor_payment_id,
  receipt_id, capture_payment_id, capture_journal_id, attempt_no,
  result_code, command_key_hash, request_hash
) ON public.payment TO app_role;

REVOKE UPDATE, DELETE, TRUNCATE
  ON public.payment_operation, public.provider_event_receipt, public.payment
  FROM PUBLIC, app_role, yellow_runtime;
REVOKE INSERT (token, brand, last4, expiry, psp, status)
  ON public.payment_instrument FROM PUBLIC, app_role, yellow_runtime;
