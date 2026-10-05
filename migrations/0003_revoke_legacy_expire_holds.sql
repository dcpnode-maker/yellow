REVOKE ALL PRIVILEGES ON FUNCTION expire_holds() FROM PUBLIC;

DO $privileges$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_role') THEN
    REVOKE ALL PRIVILEGES ON FUNCTION expire_holds() FROM app_role;
  END IF;
END $privileges$;

COMMENT ON FUNCTION expire_holds() IS
  'Legacy deployment-owner maintenance helper. Application execution is forbidden; audited tenant-scoped expiry replaces it.';
