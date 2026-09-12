-- Order462. External research database ONLY. Never apply through PMS migrations.
-- Provision a dedicated database with PUBLIC CONNECT/TEMP revoked and a NOLOGIN
-- schema owner. Explicit loader/reader roles receive only the grants below.
-- Roles are provisioned separately as NOLOGIN, NOSUPERUSER, NOBYPASSRLS,
-- NOCREATEDB, NOCREATEROLE, NOREPLICATION. The owner owns this database.
BEGIN;
DO $$
BEGIN
  IF current_database() <> 'yellow_pricelabs_staging' THEN
    RAISE EXCEPTION 'wrong research database';
  END IF;
END;
$$;
SET LOCAL ROLE yellow_pricelabs_stage_owner;
REVOKE ALL ON DATABASE yellow_pricelabs_staging FROM PUBLIC;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
CREATE SCHEMA pricelabs_staging AUTHORIZATION yellow_pricelabs_stage_owner;
REVOKE ALL ON SCHEMA pricelabs_staging FROM PUBLIC;

CREATE TABLE pricelabs_staging.import_bundle (
  manifest_sha256 text NOT NULL CHECK (manifest_sha256 ~ '^[a-f0-9]{64}$'),
  importer_sha256 text NOT NULL CHECK (importer_sha256 ~ '^[a-f0-9]{64}$'),
  archive_sha256 text NOT NULL CHECK (archive_sha256 ~ '^[a-f0-9]{64}$'),
  staging_sha256 text NOT NULL CHECK (staging_sha256 ~ '^[a-f0-9]{64}$'),
  receipt_sha256 text NOT NULL CHECK (receipt_sha256 ~ '^[a-f0-9]{64}$'),
  preview_sha256 text NOT NULL CHECK (preview_sha256 ~ '^[a-f0-9]{64}$'),
  source_commit text NOT NULL CHECK (source_commit ~ '^[a-f0-9]{40}$'),
  research_date date NOT NULL,
  file_count integer NOT NULL CHECK (file_count BETWEEN 2 AND 500),
  file_bytes bigint NOT NULL CHECK (file_bytes BETWEEN 1 AND 104857600),
  staging_document jsonb NOT NULL CHECK (staging_document @>
    '{"schemaVersion":"yellow.external-research-staging/v1","operational":false,
      "mapping":{"required":true,"automaticGeographyMatch":false},
      "completeness":{"sourceNativeArchiveComplete":false}}'::jsonb),
  receipt_document jsonb NOT NULL CHECK (receipt_document @>
    '{"schemaVersion":"yellow.external-research-import-receipt/v1",
      "operationalWrites":false,"archiveVerified":true,"mappingRequired":true,
      "sourceNativeArchiveComplete":false}'::jsonb),
  imported_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (manifest_sha256, importer_sha256),
  UNIQUE (archive_sha256, importer_sha256)
);

CREATE TABLE pricelabs_staging.archive_file (
  manifest_sha256 text NOT NULL,
  importer_sha256 text NOT NULL,
  path text NOT NULL CHECK (path <> '' AND path !~ '[\\:]' AND
    path !~ '(^|/)[.]{1,2}(/|$)' AND path !~ '(^/|/$|//)'),
  manifest_listed boolean NOT NULL,
  byte_length bigint NOT NULL CHECK (byte_length BETWEEN 0 AND 104857600),
  sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  content bytea NOT NULL CHECK (octet_length(content) = byte_length),
  PRIMARY KEY (manifest_sha256, importer_sha256, path),
  FOREIGN KEY (manifest_sha256, importer_sha256)
    REFERENCES pricelabs_staging.import_bundle (manifest_sha256, importer_sha256)
);

CREATE FUNCTION pricelabs_staging.reject_mutation() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  RAISE EXCEPTION 'external research evidence is append only' USING ERRCODE = '42501';
END;
$$;
REVOKE ALL ON FUNCTION pricelabs_staging.reject_mutation() FROM PUBLIC;
CREATE TRIGGER immutable_bundle BEFORE UPDATE OR DELETE OR TRUNCATE
  ON pricelabs_staging.import_bundle FOR EACH STATEMENT
  EXECUTE FUNCTION pricelabs_staging.reject_mutation();
CREATE TRIGGER immutable_file BEFORE UPDATE OR DELETE OR TRUNCATE
  ON pricelabs_staging.archive_file FOR EACH STATEMENT
  EXECUTE FUNCTION pricelabs_staging.reject_mutation();
REVOKE ALL ON ALL TABLES IN SCHEMA pricelabs_staging FROM PUBLIC;
GRANT CONNECT ON DATABASE yellow_pricelabs_staging TO yellow_pricelabs_loader, yellow_pricelabs_reader;
GRANT USAGE ON SCHEMA pricelabs_staging TO yellow_pricelabs_loader, yellow_pricelabs_reader;
GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA pricelabs_staging TO yellow_pricelabs_loader;
GRANT SELECT ON ALL TABLES IN SCHEMA pricelabs_staging TO yellow_pricelabs_reader;
COMMIT;

-- No operational role, cross-database extension, UPDATE/DELETE/TRUNCATE,
-- CREATE(schema), or ownership granted to either. Live isolation proof precedes data.
