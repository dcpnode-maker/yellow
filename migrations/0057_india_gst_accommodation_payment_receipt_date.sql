-- Order 291: exact externally governed accommodation payment-receipt-date
-- evidence. This source root is input-only; it neither ingests a payment nor
-- determines time of supply.

CREATE TABLE public.india_gst_accommodation_payment_receipt_snapshot (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT pg_catalog.gen_random_uuid(),
  service_provision_snapshot_id uuid NOT NULL,
  currency character(3) NOT NULL,
  amount_minor bigint NOT NULL,
  coverage_scope text NOT NULL,
  supplier_books_entry_date date NOT NULL,
  supplier_bank_credit_date date NOT NULL,
  payment_receipt_date date NOT NULL,
  payment_receipt_source text NOT NULL,
  payment_receipt_evidence_sha256 text NOT NULL,
  legal_rule text NOT NULL,
  CONSTRAINT india_gst_accommodation_payment_receipt_snapshot_pk
    PRIMARY KEY (tenant_id, id),
  CONSTRAINT india_gst_accommodation_payment_receipt_service_uq
    UNIQUE (tenant_id, service_provision_snapshot_id),
  CONSTRAINT india_gst_accommodation_payment_receipt_service_fk
    FOREIGN KEY (tenant_id, service_provision_snapshot_id)
    REFERENCES public.india_gst_accommodation_service_provision_snapshot
      (tenant_id, id),
  CONSTRAINT india_gst_accommodation_payment_receipt_currency_ck CHECK (
    currency ~ '^[A-Z]{3}$'
  ),
  CONSTRAINT india_gst_accommodation_payment_receipt_amount_ck CHECK (
    amount_minor > 0
  ),
  CONSTRAINT india_gst_accommodation_payment_receipt_coverage_ck CHECK (
    coverage_scope = 'full_attribution'
  ),
  CONSTRAINT india_gst_accommodation_payment_receipt_books_date_ck CHECK (
    pg_catalog.isfinite(supplier_books_entry_date)
  ),
  CONSTRAINT india_gst_accommodation_payment_receipt_bank_date_ck CHECK (
    pg_catalog.isfinite(supplier_bank_credit_date)
  ),
  CONSTRAINT india_gst_accommodation_payment_receipt_date_ck CHECK (
    pg_catalog.isfinite(payment_receipt_date)
    AND payment_receipt_date = LEAST(
      supplier_books_entry_date,
      supplier_bank_credit_date
    )
  ),
  CONSTRAINT india_gst_accommodation_payment_receipt_source_ck CHECK (
    payment_receipt_source = 'governed_supplier_payment_receipt_record'
  ),
  CONSTRAINT india_gst_accommodation_payment_receipt_evidence_ck CHECK (
    payment_receipt_evidence_sha256 ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT india_gst_accommodation_payment_receipt_legal_rule_ck CHECK (
    legal_rule = 'CGST_ACT_13_2_EXPLANATION_II_PAYMENT_RECEIPT_DATE_INPUT_ONLY'
  )
);

ALTER TABLE public.india_gst_accommodation_payment_receipt_snapshot
  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.india_gst_accommodation_payment_receipt_snapshot
  FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation
  ON public.india_gst_accommodation_payment_receipt_snapshot
  USING (
    tenant_id = NULLIF(
      pg_catalog.current_setting('app.tenant_id', true), ''
    )::uuid
  )
  WITH CHECK (
    tenant_id = NULLIF(
      pg_catalog.current_setting('app.tenant_id', true), ''
    )::uuid
  );

ALTER TABLE public.india_gst_accommodation_payment_receipt_snapshot
  OWNER TO yellow_owner;
REVOKE ALL ON TABLE public.india_gst_accommodation_payment_receipt_snapshot
  FROM PUBLIC, app_role;
REVOKE ALL ON TABLE public.india_gst_accommodation_payment_receipt_snapshot
  FROM yellow_runtime;
GRANT SELECT ON TABLE public.india_gst_accommodation_payment_receipt_snapshot
  TO app_role;
