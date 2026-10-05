-- Close the baseline's single-column financial-reference gaps before application
-- posting is enabled. Candidate keys remain tenant-leading and preserve the
-- immutable entity ids used by existing integrations.
ALTER TABLE account
  ADD CONSTRAINT account_tenant_property_currency_id_uq
    UNIQUE (tenant_id, property_node, currency, id),
  ADD CONSTRAINT account_tenant_id_currency_uq
    UNIQUE (tenant_id, id, currency);

ALTER TABLE folio
  ADD CONSTRAINT folio_tenant_account_id_uq
    UNIQUE (tenant_id, account_id, id);

ALTER TABLE business_day
  ADD CONSTRAINT business_day_tenant_property_date_uq
    UNIQUE (tenant_id, property_node, business_date),
  ADD CONSTRAINT business_day_tenant_property_fk
    FOREIGN KEY (tenant_id, property_node)
    REFERENCES org_node (tenant_id, id);

ALTER TABLE journal
  ADD CONSTRAINT journal_tenant_id_uq UNIQUE (tenant_id, id),
  ADD CONSTRAINT journal_tenant_id_date_currency_uq
    UNIQUE (tenant_id, id, business_date, currency),
  ADD CONSTRAINT journal_tenant_property_fk
    FOREIGN KEY (tenant_id, property_node)
    REFERENCES org_node (tenant_id, id),
  ADD CONSTRAINT journal_tenant_reverses_fk
    FOREIGN KEY (tenant_id, reverses)
    REFERENCES journal (tenant_id, id),
  ADD CONSTRAINT journal_tenant_business_day_fk
    FOREIGN KEY (tenant_id, property_node, business_date)
    REFERENCES business_day (tenant_id, property_node, business_date);

-- Existing baseline rows did not carry line currency. Derive it only from the
-- owning same-tenant journal; any pre-existing corrupt relationship deliberately
-- leaves NULL and makes the migration fail rather than silently rewriting truth.
ALTER TABLE posting_line ADD COLUMN currency char(3);

UPDATE posting_line AS line
   SET currency = header.currency
  FROM journal AS header
 WHERE header.tenant_id = line.tenant_id
   AND header.id = line.journal_id;

-- Preserve the historic safe insert surface (which omitted the denormalized line
-- currency) while making PostgreSQL, not a caller, derive the exact header value.
CREATE OR REPLACE FUNCTION derive_posting_line_currency() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.currency IS NULL THEN
    SELECT header.currency
      INTO NEW.currency
      FROM journal AS header
     WHERE header.tenant_id = NEW.tenant_id
       AND header.id = NEW.journal_id;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER posting_line_currency
  BEFORE INSERT ON posting_line
  FOR EACH ROW EXECUTE FUNCTION derive_posting_line_currency();

ALTER TABLE posting_line
  ALTER COLUMN currency SET NOT NULL,
  ADD CONSTRAINT posting_line_tenant_journal_date_currency_fk
    FOREIGN KEY (tenant_id, journal_id, business_date, currency)
    REFERENCES journal (tenant_id, id, business_date, currency),
  ADD CONSTRAINT posting_line_tenant_account_currency_fk
    FOREIGN KEY (tenant_id, account_id, currency)
    REFERENCES account (tenant_id, id, currency),
  ADD CONSTRAINT posting_line_tenant_account_folio_fk
    FOREIGN KEY (tenant_id, account_id, folio_id)
    REFERENCES folio (tenant_id, account_id, id);

-- A transaction-code role hint cannot select one account when a property has
-- multiple accounts with the same role. This exact, tenant-scoped route is data,
-- not caller authority; authoring/versioning remains later scope.
CREATE TABLE tx_code_route (
  tenant_id        uuid NOT NULL,
  property_node    uuid NOT NULL,
  currency         char(3) NOT NULL,
  tx_code          text NOT NULL,
  debit_account_id uuid,
  credit_account_id uuid,
  PRIMARY KEY (tenant_id, property_node, currency, tx_code),
  CONSTRAINT tx_code_route_has_side_ck
    CHECK (debit_account_id IS NOT NULL OR credit_account_id IS NOT NULL),
  CONSTRAINT tx_code_route_tenant_property_fk
    FOREIGN KEY (tenant_id, property_node)
    REFERENCES org_node (tenant_id, id),
  CONSTRAINT tx_code_route_tx_code_fk
    FOREIGN KEY (tx_code) REFERENCES tx_code (code),
  CONSTRAINT tx_code_route_debit_account_fk
    FOREIGN KEY (tenant_id, property_node, currency, debit_account_id)
    REFERENCES account (tenant_id, property_node, currency, id),
  CONSTRAINT tx_code_route_credit_account_fk
    FOREIGN KEY (tenant_id, property_node, currency, credit_account_id)
    REFERENCES account (tenant_id, property_node, currency, id)
);

ALTER TABLE tx_code_route ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON tx_code_route
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

REVOKE ALL ON TABLE tx_code_route FROM PUBLIC, app_role;
GRANT SELECT ON TABLE tx_code_route TO app_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE tx_code FROM app_role;
REVOKE UPDATE ON TABLE business_day FROM app_role;

-- A share lock makes ordinary postings and sealing serialize on the exact day
-- row. Adjustments/corrections retain the baseline sealed-day exception, while a
-- missing day is never silently treated as open.
CREATE OR REPLACE FUNCTION assert_day_open() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sealed timestamptz;
BEGIN
  SELECT sealed_at
    INTO v_sealed
    FROM business_day
   WHERE tenant_id = NEW.tenant_id
     AND property_node = NEW.property_node
     AND business_date = NEW.business_date
   FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'business date % missing', NEW.business_date
      USING ERRCODE = 'P0011';
  END IF;
  IF v_sealed IS NOT NULL AND NEW.kind NOT IN ('adjustment', 'correction') THEN
    RAISE EXCEPTION 'business date % sealed', NEW.business_date
      USING ERRCODE = 'P0011';
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION assert_day_open() FROM PUBLIC, app_role;

-- The application must not use a tenant argument to escape its transaction-local
-- authority. Deployment/referee connections without an application tenant retain
-- their owner-only maintenance path; any supplied authority must match exactly.
CREATE OR REPLACE FUNCTION seal_business_day(
  p_tenant uuid,
  p_property uuid,
  p_date date,
  p_user uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_authority text := NULLIF(current_setting('app.tenant_id', true), '');
  v_invoker_role text := current_setting('role', true);
BEGIN
  IF v_authority IS NULL
     AND (session_user = 'app_role' OR v_invoker_role = 'app_role') THEN
    RAISE EXCEPTION 'tenant authority missing' USING ERRCODE = '42501';
  END IF;
  IF v_authority IS NOT NULL AND v_authority::uuid <> p_tenant THEN
    RAISE EXCEPTION 'tenant authority mismatch' USING ERRCODE = '42501';
  END IF;

  UPDATE business_day
     SET sealed_at = now(), sealed_by = p_user
   WHERE tenant_id = p_tenant
     AND property_node = p_property
     AND business_date = p_date
     AND sealed_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'day missing or already sealed' USING ERRCODE = 'P0012';
  END IF;
END $$;

REVOKE ALL ON FUNCTION seal_business_day(uuid, uuid, date, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION seal_business_day(uuid, uuid, date, uuid) TO app_role;
