REVOKE DELETE ON TABLE availability_projection FROM PUBLIC;

DO $privileges$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_role') THEN
    GRANT DELETE ON TABLE availability_projection TO app_role;
  END IF;
END $privileges$;
