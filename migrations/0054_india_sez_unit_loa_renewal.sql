-- Order 288: exact, read-only first Form-F2 continuity evidence for an India
-- supplier SEZ-unit Letter of Approval. The complete issued instrument remains
-- external evidence; this root neither authors nor interprets it.

CREATE TABLE public.india_sez_unit_loa_renewal (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT pg_catalog.gen_random_uuid(),
  supplier_sez_status_id uuid NOT NULL,
  original_loa_reference text NOT NULL,
  original_loa_issue_date date NOT NULL,
  original_loa_evidence_sha256 text NOT NULL,
  form_f2_file_number text NOT NULL,
  form_f2_issue_date date NOT NULL,
  renewal_validity daterange NOT NULL,
  renewal_status_as_of date NOT NULL,
  renewal_status text NOT NULL,
  renewal_status_source text NOT NULL,
  renewal_status_evidence_sha256 text NOT NULL,
  form_f2_evidence_sha256 text NOT NULL,
  legal_rule text NOT NULL,
  CONSTRAINT india_sez_unit_loa_renewal_pk PRIMARY KEY (tenant_id, id),
  CONSTRAINT india_sez_unit_loa_renewal_identity_uq UNIQUE (
    tenant_id,
    supplier_sez_status_id,
    form_f2_file_number,
    form_f2_issue_date
  ),
  CONSTRAINT india_sez_unit_loa_renewal_supplier_status_fk
    FOREIGN KEY (tenant_id, supplier_sez_status_id)
    REFERENCES public.india_gst_supplier_sez_status (tenant_id, id),
  CONSTRAINT india_sez_unit_loa_renewal_original_reference_ck CHECK (
    pg_catalog.char_length(original_loa_reference) BETWEEN 1 AND 128
    AND pg_catalog.btrim(original_loa_reference) = original_loa_reference
    AND original_loa_reference IS NFC NORMALIZED
    AND original_loa_reference !~ '[[:cntrl:]]'
  ),
  CONSTRAINT india_sez_unit_loa_renewal_original_hash_ck CHECK (
    original_loa_evidence_sha256 ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT india_sez_unit_loa_renewal_file_number_ck CHECK (
    pg_catalog.char_length(form_f2_file_number) BETWEEN 1 AND 128
    AND pg_catalog.btrim(form_f2_file_number) = form_f2_file_number
    AND form_f2_file_number IS NFC NORMALIZED
    AND form_f2_file_number !~ '[[:cntrl:]]'
  ),
  CONSTRAINT india_sez_unit_loa_renewal_validity_ck CHECK (
    NOT pg_catalog.isempty(renewal_validity)
    AND NOT pg_catalog.lower_inf(renewal_validity)
    AND NOT pg_catalog.upper_inf(renewal_validity)
    AND pg_catalog.lower_inc(renewal_validity)
    AND NOT pg_catalog.upper_inc(renewal_validity)
    AND renewal_validity @> renewal_status_as_of
  ),
  CONSTRAINT india_sez_unit_loa_renewal_issue_chronology_ck CHECK (
    original_loa_issue_date <= form_f2_issue_date
    AND form_f2_issue_date <= renewal_status_as_of
  ),
  CONSTRAINT india_sez_unit_loa_renewal_status_ck CHECK (
    renewal_status = 'in_force'
  ),
  CONSTRAINT india_sez_unit_loa_renewal_source_ck CHECK (
    renewal_status_source = 'development_commissioner_record'
  ),
  CONSTRAINT india_sez_unit_loa_renewal_status_hash_ck CHECK (
    renewal_status_evidence_sha256 ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT india_sez_unit_loa_renewal_form_hash_ck CHECK (
    form_f2_evidence_sha256 ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT india_sez_unit_loa_renewal_legal_rule_ck CHECK (
    legal_rule = 'SEZ_RULES_19_6_AND_19_6A_3_FORM_F2_CONTINUITY'
  )
);

ALTER TABLE public.india_sez_unit_loa_renewal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.india_sez_unit_loa_renewal FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON public.india_sez_unit_loa_renewal
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

ALTER TABLE public.india_sez_unit_loa_renewal OWNER TO yellow_owner;
REVOKE ALL ON TABLE public.india_sez_unit_loa_renewal FROM PUBLIC, app_role;
REVOKE ALL ON TABLE public.india_sez_unit_loa_renewal FROM yellow_runtime;
GRANT SELECT ON TABLE public.india_sez_unit_loa_renewal TO app_role;
