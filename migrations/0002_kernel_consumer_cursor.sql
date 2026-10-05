CREATE TABLE consumer_cursor (
  consumer        text        NOT NULL,
  last_seq        bigint      NOT NULL DEFAULT 0,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (consumer)
);

CREATE TABLE consumer_processed (
  consumer        text        NOT NULL,
  outbox_id       uuid        NOT NULL,
  processed_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (consumer, outbox_id)
);

CREATE INDEX consumer_processed_age ON consumer_processed USING brin (processed_at);

REVOKE ALL PRIVILEGES ON TABLE consumer_cursor, consumer_processed FROM PUBLIC;

DO $privileges$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_role') THEN
    REVOKE ALL PRIVILEGES ON TABLE consumer_cursor, consumer_processed FROM app_role;
  END IF;
END $privileges$;
