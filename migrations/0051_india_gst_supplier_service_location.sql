-- Order 284: exact, read-only India GST supplier service-location evidence.
-- This assignment proves only IGST Act section 2(15)(a); it does not decide
-- intra-State/inter-State treatment, levy components, documents or submission.

CREATE TABLE public.india_gst_supplier_service_location (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT pg_catalog.gen_random_uuid(),
  supplier_registration_id uuid NOT NULL,
  supplier_evidence_hash text NOT NULL,
  service_scope text NOT NULL,
  registered_place_kind text NOT NULL,
  location_basis text NOT NULL,
  legal_rule text NOT NULL,
  CONSTRAINT india_gst_supplier_service_location_pk PRIMARY KEY (tenant_id, id),
  CONSTRAINT india_gst_supplier_service_location_identity_uq UNIQUE (
    tenant_id, supplier_registration_id, supplier_evidence_hash, service_scope
  ),
  CONSTRAINT india_gst_supplier_service_location_registration_fk
    FOREIGN KEY (tenant_id, supplier_registration_id)
    REFERENCES public.property_fiscal_registration (tenant_id, id),
  CONSTRAINT india_gst_supplier_service_location_supplier_hash_ck CHECK (
    supplier_evidence_hash ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT india_gst_supplier_service_location_scope_ck CHECK (
    service_scope = 'lodging_accommodation'
  ),
  CONSTRAINT india_gst_supplier_service_location_registered_place_ck CHECK (
    registered_place_kind IN (
      'principal_place_of_business', 'additional_place_of_business'
    )
  ),
  CONSTRAINT india_gst_supplier_service_location_basis_ck CHECK (
    location_basis = 'supply_made_from_registered_place_of_business'
  ),
  CONSTRAINT india_gst_supplier_service_location_legal_rule_ck CHECK (
    legal_rule = 'IGST_ACT_2_15_A'
  )
);

ALTER TABLE public.india_gst_supplier_service_location ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.india_gst_supplier_service_location FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON public.india_gst_supplier_service_location
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

ALTER TABLE public.india_gst_supplier_service_location OWNER TO yellow_owner;
REVOKE ALL ON TABLE public.india_gst_supplier_service_location FROM PUBLIC, app_role;
REVOKE ALL ON TABLE public.india_gst_supplier_service_location FROM yellow_runtime;
GRANT SELECT ON TABLE public.india_gst_supplier_service_location TO app_role;
