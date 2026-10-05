-- Order 272: exact, read-only property fiscal-registration evidence for one
-- frozen India GST jurisdiction identity. This table grants no authoring,
-- decomposition, posting, document or submission authority.

CREATE TABLE public.property_fiscal_registration (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT pg_catalog.gen_random_uuid(),
  property_node uuid NOT NULL,
  scheme text NOT NULL,
  currency character(3) NOT NULL,
  jurisdiction_extension_id uuid NOT NULL,
  jurisdiction_owner_tenant_id uuid,
  jurisdiction_key text NOT NULL,
  jurisdiction_version integer NOT NULL,
  jurisdiction_content_hash text NOT NULL,
  registration_number text NOT NULL,
  region_code text NOT NULL,
  legal_name text NOT NULL,
  trade_name text,
  address_line text NOT NULL,
  locality text NOT NULL,
  postal_code text NOT NULL,
  CONSTRAINT property_fiscal_registration_pk PRIMARY KEY (tenant_id, id),
  CONSTRAINT property_fiscal_registration_identity_uq UNIQUE NULLS NOT DISTINCT (
    tenant_id, property_node, scheme, currency,
    jurisdiction_extension_id, jurisdiction_owner_tenant_id,
    jurisdiction_key, jurisdiction_version, jurisdiction_content_hash
  ),
  CONSTRAINT property_fiscal_registration_property_fk
    FOREIGN KEY (tenant_id, property_node)
    REFERENCES public.org_node (tenant_id, id),
  CONSTRAINT property_fiscal_registration_extension_fk
    FOREIGN KEY (jurisdiction_extension_id)
    REFERENCES public.extension (id),
  CONSTRAINT property_fiscal_registration_scheme_ck CHECK (
    scheme = 'in-gstin'
  ),
  CONSTRAINT property_fiscal_registration_currency_ck CHECK (
    currency = 'INR'
  ),
  CONSTRAINT property_fiscal_registration_jurisdiction_owner_ck CHECK (
    jurisdiction_owner_tenant_id IS NULL
    OR jurisdiction_owner_tenant_id = tenant_id
  ),
  CONSTRAINT property_fiscal_registration_jurisdiction_key_ck CHECK (
    jurisdiction_key ~ '^[a-z0-9][a-z0-9_.:-]{0,127}$'
  ),
  CONSTRAINT property_fiscal_registration_jurisdiction_version_ck CHECK (
    jurisdiction_version > 0
  ),
  CONSTRAINT property_fiscal_registration_jurisdiction_hash_ck CHECK (
    jurisdiction_content_hash ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT property_fiscal_registration_registration_ck CHECK (
    registration_number ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'
  ),
  CONSTRAINT property_fiscal_registration_region_ck CHECK (
    region_code IN (
      '01','02','03','04','05','06','07','08','09','10',
      '11','12','13','14','15','16','17','18','19','20',
      '21','22','23','24','26','27','29','30','31','32',
      '33','34','35','36','37','38'
    )
  ),
  CONSTRAINT property_fiscal_registration_registration_region_ck CHECK (
    pg_catalog.substr(registration_number, 1, 2) = region_code
  ),
  CONSTRAINT property_fiscal_registration_legal_name_ck CHECK (
    pg_catalog.char_length(legal_name) BETWEEN 1 AND 200
    AND pg_catalog.btrim(legal_name) = legal_name
  ),
  CONSTRAINT property_fiscal_registration_trade_name_ck CHECK (
    trade_name IS NULL
    OR (
      pg_catalog.char_length(trade_name) BETWEEN 1 AND 200
      AND pg_catalog.btrim(trade_name) = trade_name
    )
  ),
  CONSTRAINT property_fiscal_registration_address_line_ck CHECK (
    pg_catalog.char_length(address_line) BETWEEN 1 AND 300
    AND pg_catalog.btrim(address_line) = address_line
  ),
  CONSTRAINT property_fiscal_registration_locality_ck CHECK (
    pg_catalog.char_length(locality) BETWEEN 1 AND 120
    AND pg_catalog.btrim(locality) = locality
  ),
  CONSTRAINT property_fiscal_registration_postal_code_ck CHECK (
    postal_code ~ '^[1-9][0-9]{5}$'
  )
);

CREATE INDEX property_fiscal_registration_lookup
  ON public.property_fiscal_registration (
    tenant_id, property_node, scheme, currency,
    jurisdiction_extension_id, jurisdiction_key, jurisdiction_version
  );

ALTER TABLE public.property_fiscal_registration ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON public.property_fiscal_registration
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

ALTER TABLE public.property_fiscal_registration OWNER TO yellow_owner;
REVOKE ALL ON TABLE public.property_fiscal_registration FROM PUBLIC, app_role;
REVOKE ALL ON TABLE public.property_fiscal_registration FROM yellow_runtime;
GRANT SELECT ON TABLE public.property_fiscal_registration TO app_role;
