-- Order 276: exact, read-only Party fiscal-registration evidence for one
-- caller-selected India GST registered-recipient candidate. This table grants no
-- legal-buyer selection, tax decomposition, document or submission authority.

CREATE TABLE public.party_fiscal_registration (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT pg_catalog.gen_random_uuid(),
  party_id uuid NOT NULL,
  scheme text NOT NULL,
  registration_number text NOT NULL,
  region_code text NOT NULL,
  legal_name text NOT NULL,
  trade_name text,
  address_line1 text NOT NULL,
  locality text NOT NULL,
  pin text NOT NULL,
  CONSTRAINT party_fiscal_registration_pk PRIMARY KEY (tenant_id, id),
  CONSTRAINT party_fiscal_registration_identity_uq UNIQUE (
    tenant_id, scheme, registration_number
  ),
  CONSTRAINT party_fiscal_registration_party_fk
    FOREIGN KEY (tenant_id, party_id)
    REFERENCES public.party (tenant_id, id),
  CONSTRAINT party_fiscal_registration_scheme_ck CHECK (
    scheme = 'in-gstin'
  ),
  CONSTRAINT party_fiscal_registration_registration_ck CHECK (
    registration_number ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'
  ),
  CONSTRAINT party_fiscal_registration_region_ck CHECK (
    region_code IN (
      '01','02','03','04','05','06','07','08','09','10',
      '11','12','13','14','15','16','17','18','19','20',
      '21','22','23','24','26','27','29','30','31','32',
      '33','34','35','36','37','38'
    )
  ),
  CONSTRAINT party_fiscal_registration_registration_region_ck CHECK (
    pg_catalog.substr(registration_number, 1, 2) = region_code
  ),
  CONSTRAINT party_fiscal_registration_legal_name_ck CHECK (
    pg_catalog.char_length(legal_name) BETWEEN 1 AND 100
    AND pg_catalog.btrim(legal_name) = legal_name
  ),
  CONSTRAINT party_fiscal_registration_trade_name_ck CHECK (
    trade_name IS NULL
    OR (
      pg_catalog.char_length(trade_name) BETWEEN 1 AND 100
      AND pg_catalog.btrim(trade_name) = trade_name
    )
  ),
  CONSTRAINT party_fiscal_registration_address_line1_ck CHECK (
    pg_catalog.char_length(address_line1) BETWEEN 1 AND 100
    AND pg_catalog.btrim(address_line1) = address_line1
  ),
  CONSTRAINT party_fiscal_registration_locality_ck CHECK (
    pg_catalog.char_length(locality) BETWEEN 1 AND 50
    AND pg_catalog.btrim(locality) = locality
  ),
  CONSTRAINT party_fiscal_registration_pin_ck CHECK (
    pin ~ '^[1-9][0-9]{5}$'
  )
);

CREATE INDEX party_fiscal_registration_lookup
  ON public.party_fiscal_registration (tenant_id, party_id, id, scheme);

ALTER TABLE public.party_fiscal_registration ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON public.party_fiscal_registration
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

ALTER TABLE public.party_fiscal_registration OWNER TO yellow_owner;
REVOKE ALL ON TABLE public.party_fiscal_registration FROM PUBLIC, app_role;
REVOKE ALL ON TABLE public.party_fiscal_registration FROM yellow_runtime;
GRANT SELECT ON TABLE public.party_fiscal_registration TO app_role;
