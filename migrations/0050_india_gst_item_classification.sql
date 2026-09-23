-- Order 281: exact, read-only India GST accommodation-classification evidence.
-- This root does not decide ItemList, place/supply type, tax, documents or submission.

CREATE TABLE public.india_gst_item_classification (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT pg_catalog.gen_random_uuid(),
  property_node uuid NOT NULL,
  jurisdiction_extension_id uuid NOT NULL,
  jurisdiction_owner_tenant_id uuid,
  jurisdiction_key text NOT NULL,
  jurisdiction_version integer NOT NULL,
  jurisdiction_content_hash text NOT NULL,
  country_code char(2) NOT NULL,
  line_id text NOT NULL,
  revenue_group text NOT NULL,
  classification_system text NOT NULL,
  classification_code text NOT NULL,
  is_service_code char(1) NOT NULL,
  CONSTRAINT india_gst_item_classification_pk PRIMARY KEY (tenant_id, id),
  CONSTRAINT india_gst_item_classification_identity_uq UNIQUE NULLS NOT DISTINCT (
    tenant_id, property_node,
    jurisdiction_extension_id, jurisdiction_owner_tenant_id,
    jurisdiction_key, jurisdiction_version, jurisdiction_content_hash,
    line_id
  ),
  CONSTRAINT india_gst_item_classification_property_fk
    FOREIGN KEY (tenant_id, property_node)
    REFERENCES public.org_node (tenant_id, id),
  CONSTRAINT india_gst_item_classification_extension_fk
    FOREIGN KEY (jurisdiction_extension_id)
    REFERENCES public.extension (id),
  CONSTRAINT india_gst_item_classification_jurisdiction_owner_ck CHECK (
    jurisdiction_owner_tenant_id IS NULL
    OR jurisdiction_owner_tenant_id = tenant_id
  ),
  CONSTRAINT india_gst_item_classification_jurisdiction_key_ck CHECK (
    jurisdiction_key ~ '^[a-z0-9][a-z0-9_.:-]{0,127}$'
  ),
  CONSTRAINT india_gst_item_classification_jurisdiction_version_ck CHECK (
    jurisdiction_version > 0
  ),
  CONSTRAINT india_gst_item_classification_jurisdiction_hash_ck CHECK (
    jurisdiction_content_hash ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT india_gst_item_classification_country_ck CHECK (
    country_code = 'IN'::char(2)
  ),
  CONSTRAINT india_gst_item_classification_line_ck CHECK (
    line_id = 'room'
  ),
  CONSTRAINT india_gst_item_classification_revenue_group_ck CHECK (
    revenue_group = 'room_revenue'
  ),
  CONSTRAINT india_gst_item_classification_system_ck CHECK (
    classification_system = 'SAC'
  ),
  CONSTRAINT india_gst_item_classification_code_ck CHECK (
    classification_code IN (
      '996311', '996312', '996313',
      '996321', '996322', '996329'
    )
  ),
  CONSTRAINT india_gst_item_classification_service_ck CHECK (
    is_service_code = 'Y'::char(1)
  )
);

ALTER TABLE public.india_gst_item_classification ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.india_gst_item_classification FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON public.india_gst_item_classification
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

ALTER TABLE public.india_gst_item_classification OWNER TO yellow_owner;
REVOKE ALL ON TABLE public.india_gst_item_classification FROM PUBLIC, app_role;
REVOKE ALL ON TABLE public.india_gst_item_classification FROM yellow_runtime;
GRANT SELECT ON TABLE public.india_gst_item_classification TO app_role;
