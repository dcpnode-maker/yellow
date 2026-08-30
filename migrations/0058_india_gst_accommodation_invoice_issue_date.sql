-- Order 292: exact externally governed accommodation tax-invoice issue-date
-- evidence. This input does not issue an invoice or decide its timeliness.

CREATE TABLE public.india_gst_accommodation_invoice_issue_snapshot (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT pg_catalog.gen_random_uuid(),
  service_provision_snapshot_id uuid NOT NULL,
  currency character(3) NOT NULL,
  amount_minor bigint NOT NULL,
  coverage_scope text NOT NULL,
  invoice_series text NOT NULL,
  invoice_serial text NOT NULL,
  invoice_issue_date date NOT NULL,
  invoice_issue_source text NOT NULL,
  invoice_issue_evidence_sha256 text NOT NULL,
  legal_rule text NOT NULL,
  CONSTRAINT india_gst_accommodation_invoice_issue_snapshot_pk
    PRIMARY KEY (tenant_id, id),
  CONSTRAINT india_gst_accommodation_invoice_issue_service_uq
    UNIQUE (tenant_id, service_provision_snapshot_id),
  CONSTRAINT india_gst_accommodation_invoice_issue_identity_uq
    UNIQUE (tenant_id, invoice_series, invoice_serial),
  CONSTRAINT india_gst_accommodation_invoice_issue_service_fk
    FOREIGN KEY (tenant_id, service_provision_snapshot_id)
    REFERENCES public.india_gst_accommodation_service_provision_snapshot
      (tenant_id, id),
  CONSTRAINT india_gst_accommodation_invoice_issue_currency_ck CHECK (
    currency ~ '^[A-Z]{3}$'
  ),
  CONSTRAINT india_gst_accommodation_invoice_issue_amount_ck CHECK (
    amount_minor > 0
  ),
  CONSTRAINT india_gst_accommodation_invoice_issue_coverage_ck CHECK (
    coverage_scope = 'full_attribution'
  ),
  CONSTRAINT india_gst_accommodation_invoice_issue_series_ck CHECK (
    char_length(invoice_series) BETWEEN 1 AND 64
  ),
  CONSTRAINT india_gst_accommodation_invoice_issue_serial_ck CHECK (
    char_length(invoice_serial) BETWEEN 1 AND 64
  ),
  CONSTRAINT india_gst_accommodation_invoice_issue_date_ck CHECK (
    pg_catalog.isfinite(invoice_issue_date)
  ),
  CONSTRAINT india_gst_accommodation_invoice_issue_source_ck CHECK (
    invoice_issue_source = 'governed_supplier_tax_invoice_record'
  ),
  CONSTRAINT india_gst_accommodation_invoice_issue_evidence_ck CHECK (
    invoice_issue_evidence_sha256 ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT india_gst_accommodation_invoice_issue_legal_rule_ck CHECK (
    legal_rule = 'CGST_ACT_13_2_INVOICE_DATE_INPUT_ONLY'
  )
);

ALTER TABLE public.india_gst_accommodation_invoice_issue_snapshot
  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.india_gst_accommodation_invoice_issue_snapshot
  FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation
  ON public.india_gst_accommodation_invoice_issue_snapshot
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

ALTER TABLE public.india_gst_accommodation_invoice_issue_snapshot
  OWNER TO yellow_owner;
REVOKE ALL ON TABLE public.india_gst_accommodation_invoice_issue_snapshot
  FROM PUBLIC, app_role;
REVOKE ALL ON TABLE public.india_gst_accommodation_invoice_issue_snapshot
  FROM yellow_runtime;
GRANT SELECT ON TABLE public.india_gst_accommodation_invoice_issue_snapshot
  TO app_role;
