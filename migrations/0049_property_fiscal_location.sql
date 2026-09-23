-- Order 280: exact, read-only Indian physical-property fiscal-location evidence.
-- This root does not decide place of supply, supply type, classification, tax,
-- documents or submission authority.

CREATE TABLE public.property_fiscal_location (
  tenant_id uuid NOT NULL,
  property_node uuid NOT NULL,
  country_code char(2) NOT NULL,
  state_code text NOT NULL,
  address_line1 text NOT NULL,
  locality text NOT NULL,
  pin text NOT NULL,
  CONSTRAINT property_fiscal_location_pk PRIMARY KEY (tenant_id, property_node),
  CONSTRAINT property_fiscal_location_property_fk
    FOREIGN KEY (tenant_id, property_node)
    REFERENCES public.org_node (tenant_id, id),
  CONSTRAINT property_fiscal_location_country_ck CHECK (
    country_code = 'IN'::char(2)
  ),
  CONSTRAINT property_fiscal_location_state_ck CHECK (
    state_code IN (
      '01','02','03','04','05','06','07','08','09','10',
      '11','12','13','14','15','16','17','18','19','20',
      '21','22','23','24','26','27','29','30','31','32',
      '33','34','35','36','37','38'
    )
  ),
  CONSTRAINT property_fiscal_location_address_line1_ck CHECK (
    pg_catalog.char_length(address_line1) BETWEEN 1 AND 100
    AND pg_catalog.btrim(address_line1) = address_line1
  ),
  CONSTRAINT property_fiscal_location_locality_ck CHECK (
    pg_catalog.char_length(locality) BETWEEN 1 AND 50
    AND pg_catalog.btrim(locality) = locality
  ),
  CONSTRAINT property_fiscal_location_pin_ck CHECK (
    pin ~ '^[1-9][0-9]{5}$'
  )
);

ALTER TABLE public.property_fiscal_location ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_fiscal_location FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON public.property_fiscal_location
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

ALTER TABLE public.property_fiscal_location OWNER TO yellow_owner;
REVOKE ALL ON TABLE public.property_fiscal_location FROM PUBLIC, app_role;
REVOKE ALL ON TABLE public.property_fiscal_location FROM yellow_runtime;
GRANT SELECT ON TABLE public.property_fiscal_location TO app_role;
