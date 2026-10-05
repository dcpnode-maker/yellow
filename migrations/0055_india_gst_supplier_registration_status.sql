-- Order 289: exact, read-only GST Portal registration-status evidence for an
-- India supplier registration. The snapshot date is evidence time only; this
-- root neither decides nor projects statutory time of supply.

CREATE TABLE public.india_gst_supplier_registration_status_snapshot (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT pg_catalog.gen_random_uuid(),
  supplier_registration_id uuid NOT NULL,
  supplier_registration_evidence_hash text NOT NULL,
  status_as_of date NOT NULL,
  gst_registration_status text NOT NULL,
  gst_taxpayer_type text NOT NULL,
  gst_status_source text NOT NULL,
  gst_status_evidence_sha256 text NOT NULL,
  legal_rule text NOT NULL,
  CONSTRAINT india_gst_supplier_registration_status_snapshot_pk
    PRIMARY KEY (tenant_id, id),
  CONSTRAINT india_gst_supplier_registration_status_snapshot_identity_uq UNIQUE (
    tenant_id,
    supplier_registration_id,
    supplier_registration_evidence_hash,
    status_as_of
  ),
  CONSTRAINT india_gst_supplier_registration_status_snapshot_registration_fk
    FOREIGN KEY (tenant_id, supplier_registration_id)
    REFERENCES public.property_fiscal_registration (tenant_id, id),
  CONSTRAINT india_gst_supplier_status_snapshot_supplier_evidence_ck CHECK (
    supplier_registration_evidence_hash ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT india_gst_supplier_registration_status_snapshot_status_ck CHECK (
    gst_registration_status = 'active'
  ),
  CONSTRAINT india_gst_supplier_status_snapshot_taxpayer_type_ck CHECK (
    gst_taxpayer_type IN ('regular', 'sez_unit', 'sez_developer')
  ),
  CONSTRAINT india_gst_supplier_registration_status_snapshot_source_ck CHECK (
    gst_status_source = 'gst_common_portal'
  ),
  CONSTRAINT india_gst_supplier_status_snapshot_portal_evidence_ck CHECK (
    gst_status_evidence_sha256 ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT india_gst_supplier_registration_status_snapshot_legal_rule_ck CHECK (
    legal_rule = 'CGST_ACT_25_29_30_AND_RULE_21A_REGISTRATION_STATUS'
  )
);

ALTER TABLE public.india_gst_supplier_registration_status_snapshot
  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.india_gst_supplier_registration_status_snapshot
  FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation
  ON public.india_gst_supplier_registration_status_snapshot
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

ALTER TABLE public.india_gst_supplier_registration_status_snapshot
  OWNER TO yellow_owner;
REVOKE ALL ON TABLE public.india_gst_supplier_registration_status_snapshot
  FROM PUBLIC, app_role;
REVOKE ALL ON TABLE public.india_gst_supplier_registration_status_snapshot
  FROM yellow_runtime;
GRANT SELECT ON TABLE public.india_gst_supplier_registration_status_snapshot
  TO app_role;
