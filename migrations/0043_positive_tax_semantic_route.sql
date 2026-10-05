-- Order 259: explicit, read-only semantic routing for an exact positive-tax
-- jurisdiction identity. This table grants no route-authoring or posting authority.

CREATE TABLE public.tax_semantic_route (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT pg_catalog.gen_random_uuid(),
  property_node uuid NOT NULL,
  currency character(3) NOT NULL,
  jurisdiction_extension_id uuid NOT NULL,
  jurisdiction_owner_tenant_id uuid,
  jurisdiction_key text NOT NULL,
  jurisdiction_version integer NOT NULL,
  jurisdiction_content_hash text NOT NULL,
  semantic_kind text NOT NULL,
  semantic_code text NOT NULL,
  tx_code text NOT NULL,
  CONSTRAINT tax_semantic_route_pk PRIMARY KEY (tenant_id, id),
  CONSTRAINT tax_semantic_route_identity_uq UNIQUE NULLS NOT DISTINCT (
    tenant_id, property_node, currency,
    jurisdiction_extension_id, jurisdiction_owner_tenant_id,
    jurisdiction_key, jurisdiction_version, jurisdiction_content_hash,
    semantic_kind, semantic_code
  ),
  CONSTRAINT tax_semantic_route_property_fk
    FOREIGN KEY (tenant_id, property_node)
    REFERENCES public.org_node (tenant_id, id),
  CONSTRAINT tax_semantic_route_extension_fk
    FOREIGN KEY (jurisdiction_extension_id)
    REFERENCES public.extension (id),
  CONSTRAINT tax_semantic_route_tx_code_fk
    FOREIGN KEY (tx_code)
    REFERENCES public.tx_code (code),
  CONSTRAINT tax_semantic_route_configured_route_fk
    FOREIGN KEY (tenant_id, property_node, currency, tx_code)
    REFERENCES public.tx_code_route (tenant_id, property_node, currency, tx_code),
  CONSTRAINT tax_semantic_route_currency_ck CHECK (
    currency ~ '^[A-Z]{3}$'
  ),
  CONSTRAINT tax_semantic_route_jurisdiction_version_ck CHECK (
    jurisdiction_version > 0
  ),
  CONSTRAINT tax_semantic_route_jurisdiction_hash_ck CHECK (
    jurisdiction_content_hash ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT tax_semantic_route_jurisdiction_key_ck CHECK (
    jurisdiction_key ~ '^[a-z0-9][a-z0-9_.:-]{0,127}$'
  ),
  CONSTRAINT tax_semantic_route_jurisdiction_owner_ck CHECK (
    jurisdiction_owner_tenant_id IS NULL
    OR jurisdiction_owner_tenant_id = tenant_id
  ),
  CONSTRAINT tax_semantic_route_semantic_ck CHECK (
    (semantic_kind = 'revenue' AND semantic_code = 'room_revenue')
    OR (
      semantic_kind = 'tax'
      AND semantic_code ~ '^[A-Z][A-Z0-9_]{0,63}$'
    )
  )
);

CREATE INDEX tax_semantic_route_lookup
  ON public.tax_semantic_route (
    tenant_id, property_node, currency, jurisdiction_extension_id,
    semantic_kind, semantic_code
  );

ALTER TABLE public.tax_semantic_route ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON public.tax_semantic_route
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

ALTER TABLE public.tax_semantic_route OWNER TO yellow_owner;
REVOKE ALL ON TABLE public.tax_semantic_route FROM PUBLIC, app_role;
REVOKE ALL ON TABLE public.tax_semantic_route FROM yellow_runtime;
GRANT SELECT ON TABLE public.tax_semantic_route TO app_role;
