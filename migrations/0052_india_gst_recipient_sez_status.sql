-- Order 285: exact, read-only India GST recipient SEZ-status evidence.
-- This root records only affirmative official registration/approval status at an
-- explicit evidence date; it does not decide supply nature, levy or zero rating.

CREATE TABLE public.india_gst_recipient_sez_status (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT pg_catalog.gen_random_uuid(),
  recipient_registration_id uuid NOT NULL,
  recipient_registration_evidence_hash text NOT NULL,
  status_as_of date NOT NULL,
  gst_registration_status text NOT NULL,
  gst_taxpayer_type text NOT NULL,
  gst_status_source text NOT NULL,
  gst_status_evidence_sha256 text NOT NULL,
  approval_form text,
  approval_reference text,
  approval_validity daterange,
  approval_status text,
  approval_evidence_sha256 text,
  legal_rule text NOT NULL,
  CONSTRAINT india_gst_recipient_sez_status_pk PRIMARY KEY (tenant_id, id),
  CONSTRAINT india_gst_recipient_sez_status_identity_uq UNIQUE (
    tenant_id,
    recipient_registration_id,
    recipient_registration_evidence_hash,
    status_as_of
  ),
  CONSTRAINT india_gst_recipient_sez_status_registration_fk
    FOREIGN KEY (tenant_id, recipient_registration_id)
    REFERENCES public.party_fiscal_registration (tenant_id, id),
  CONSTRAINT india_gst_recipient_sez_status_recipient_hash_ck CHECK (
    recipient_registration_evidence_hash ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT india_gst_recipient_sez_status_registration_status_ck CHECK (
    gst_registration_status = 'active'
  ),
  CONSTRAINT india_gst_recipient_sez_status_taxpayer_type_ck CHECK (
    gst_taxpayer_type IN ('regular', 'sez_unit', 'sez_developer')
  ),
  CONSTRAINT india_gst_recipient_sez_status_source_ck CHECK (
    gst_status_source = 'gst_common_portal'
  ),
  CONSTRAINT india_gst_recipient_sez_status_status_hash_ck CHECK (
    gst_status_evidence_sha256 ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT india_gst_recipient_sez_status_approval_shape_ck CHECK (
    (
      gst_taxpayer_type = 'regular'
      AND approval_form IS NULL
      AND approval_reference IS NULL
      AND approval_validity IS NULL
      AND approval_status IS NULL
      AND approval_evidence_sha256 IS NULL
    )
    OR
    (
      gst_taxpayer_type = 'sez_unit'
      AND approval_form = 'sez_rules_form_g'
      AND approval_reference IS NOT NULL
      AND pg_catalog.char_length(approval_reference) BETWEEN 1 AND 128
      AND pg_catalog.btrim(approval_reference) = approval_reference
      AND approval_reference !~ '[[:cntrl:]]'
      AND approval_validity IS NOT NULL
      AND NOT pg_catalog.isempty(approval_validity)
      AND NOT pg_catalog.lower_inf(approval_validity)
      AND NOT pg_catalog.upper_inf(approval_validity)
      AND pg_catalog.lower_inc(approval_validity)
      AND NOT pg_catalog.upper_inc(approval_validity)
      AND approval_validity @> status_as_of
      AND approval_status = 'in_force'
      AND approval_evidence_sha256 ~ '^[0-9a-f]{64}$'
    )
    OR
    (
      gst_taxpayer_type = 'sez_developer'
      AND approval_form IN ('sez_rules_form_b', 'sez_rules_form_c')
      AND approval_reference IS NOT NULL
      AND pg_catalog.char_length(approval_reference) BETWEEN 1 AND 128
      AND pg_catalog.btrim(approval_reference) = approval_reference
      AND approval_reference !~ '[[:cntrl:]]'
      AND approval_validity IS NOT NULL
      AND NOT pg_catalog.isempty(approval_validity)
      AND NOT pg_catalog.lower_inf(approval_validity)
      AND NOT pg_catalog.upper_inf(approval_validity)
      AND pg_catalog.lower_inc(approval_validity)
      AND NOT pg_catalog.upper_inc(approval_validity)
      AND approval_validity @> status_as_of
      AND approval_status = 'in_force'
      AND approval_evidence_sha256 ~ '^[0-9a-f]{64}$'
    )
  ),
  CONSTRAINT india_gst_recipient_sez_status_legal_rule_ck CHECK (
    legal_rule = 'IGST_ACT_7_5_B_AND_8_2_RECIPIENT_STATUS'
  )
);

ALTER TABLE public.india_gst_recipient_sez_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.india_gst_recipient_sez_status FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON public.india_gst_recipient_sez_status
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

ALTER TABLE public.india_gst_recipient_sez_status OWNER TO yellow_owner;
REVOKE ALL ON TABLE public.india_gst_recipient_sez_status FROM PUBLIC, app_role;
REVOKE ALL ON TABLE public.india_gst_recipient_sez_status FROM yellow_runtime;
GRANT SELECT ON TABLE public.india_gst_recipient_sez_status TO app_role;
