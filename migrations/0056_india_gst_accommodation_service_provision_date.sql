-- Order 290: exact externally governed accommodation service-provision-date
-- evidence. This input does not derive or decide the statutory time of supply.

CREATE TABLE public.india_gst_accommodation_service_provision_snapshot (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT pg_catalog.gen_random_uuid(),
  property_node uuid NOT NULL,
  reservation_lineage_id uuid NOT NULL,
  hold_binding_id uuid NOT NULL,
  attribution_id uuid NOT NULL,
  reservation_id uuid NOT NULL,
  segment_id uuid NOT NULL,
  origin_quote_hash text NOT NULL,
  snapshot_hash text NOT NULL,
  currency character(3) NOT NULL,
  service_provision_date date NOT NULL,
  service_provision_source text NOT NULL,
  service_provision_evidence_sha256 text NOT NULL,
  legal_rule text NOT NULL,
  CONSTRAINT india_gst_accommodation_service_provision_snapshot_pk
    PRIMARY KEY (tenant_id, id),
  CONSTRAINT india_gst_accommodation_service_provision_lineage_date_uq
    UNIQUE (tenant_id, reservation_lineage_id, service_provision_date),
  CONSTRAINT india_gst_accommodation_service_provision_lineage_fk
    FOREIGN KEY (
      tenant_id, reservation_lineage_id, property_node, hold_binding_id,
      attribution_id, reservation_id, segment_id, origin_quote_hash,
      snapshot_hash, currency
    ) REFERENCES public.tax_attribution_reservation_binding (
      tenant_id, id, property_node, binding_id, attribution_id,
      reservation_id, segment_id, origin_quote_hash, snapshot_hash, currency
    ),
  CONSTRAINT india_gst_accommodation_service_provision_quote_hash_ck CHECK (
    origin_quote_hash ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT india_gst_accommodation_service_provision_snapshot_hash_ck CHECK (
    snapshot_hash ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT india_gst_accommodation_service_provision_currency_ck CHECK (
    currency ~ '^[A-Z]{3}$'
  ),
  CONSTRAINT india_gst_accommodation_service_provision_date_ck CHECK (
    pg_catalog.isfinite(service_provision_date)
  ),
  CONSTRAINT india_gst_accommodation_service_provision_source_ck CHECK (
    service_provision_source = 'governed_service_provision_record'
  ),
  CONSTRAINT india_gst_accommodation_service_provision_evidence_ck CHECK (
    service_provision_evidence_sha256 ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT india_gst_accommodation_service_provision_legal_rule_ck CHECK (
    legal_rule = 'CGST_ACT_13_2_B_SERVICE_PROVISION_DATE_INPUT_ONLY'
  )
);

ALTER TABLE public.india_gst_accommodation_service_provision_snapshot
  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.india_gst_accommodation_service_provision_snapshot
  FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation
  ON public.india_gst_accommodation_service_provision_snapshot
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

ALTER TABLE public.india_gst_accommodation_service_provision_snapshot
  OWNER TO yellow_owner;
REVOKE ALL ON TABLE public.india_gst_accommodation_service_provision_snapshot
  FROM PUBLIC, app_role;
REVOKE ALL ON TABLE public.india_gst_accommodation_service_provision_snapshot
  FROM yellow_runtime;
GRANT SELECT ON TABLE public.india_gst_accommodation_service_provision_snapshot
  TO app_role;
