CREATE TABLE api_idempotency (
  tenant_id       uuid        NOT NULL REFERENCES tenant(id),
  operation       text        NOT NULL CHECK (operation ~ '^[a-z][a-z0-9_.-]{0,127}$'),
  key_hash        char(64)    NOT NULL CHECK (key_hash ~ '^[0-9a-f]{64}$'),
  request_hash    char(64)    NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  response_status smallint    CHECK (response_status BETWEEN 200 AND 299),
  response_body   jsonb,
  created_at      timestamptz NOT NULL,
  completed_at    timestamptz,
  expires_at      timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, operation, key_hash),
  CHECK (expires_at = created_at + interval '24 hours'),
  CHECK (
    (completed_at IS NULL AND response_status IS NULL AND response_body IS NULL)
    OR
    (completed_at IS NOT NULL AND response_status IS NOT NULL AND response_body IS NOT NULL
      AND completed_at >= created_at AND completed_at <= expires_at)
  )
);

CREATE INDEX api_idempotency_expiry ON api_idempotency (expires_at);

ALTER TABLE api_idempotency ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON api_idempotency
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

REVOKE ALL PRIVILEGES ON TABLE api_idempotency FROM PUBLIC;

DO $privileges$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_role') THEN
    GRANT SELECT, INSERT, UPDATE ON TABLE api_idempotency TO app_role;
  END IF;
END $privileges$;

COMMENT ON TABLE api_idempotency IS
  'Tenant-local 24-hour API command replay records; raw caller keys are never stored.';
