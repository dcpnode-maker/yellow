-- app_role is an internal RLS policy/capability role, never a database principal.
-- Fail before changing it if an unsupported direct session or either direction of
-- explicit membership exists. The migration runner wraps this file and its ledger
-- insert in one transaction, so every precondition failure leaves both untouched.

DO $$
DECLARE
  v_app_role oid := pg_catalog.to_regrole('app_role');
BEGIN
  IF v_app_role IS NULL THEN
    RAISE EXCEPTION 'required internal role app_role does not exist'
      USING ERRCODE = '55000';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM pg_catalog.pg_auth_members
     WHERE roleid = v_app_role
  ) THEN
    RAISE EXCEPTION 'app_role has explicit members; revoke them before migration'
      USING ERRCODE = '55000';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM pg_catalog.pg_auth_members
     WHERE member = v_app_role
  ) THEN
    RAISE EXCEPTION 'app_role inherits an explicit role; revoke it before migration'
      USING ERRCODE = '55000';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM pg_catalog.pg_stat_activity
     WHERE usename = 'app_role'
  ) THEN
    RAISE EXCEPTION 'app_role has an authenticated direct session; drain it before migration'
      USING ERRCODE = '55000';
  END IF;
END
$$;

ALTER ROLE app_role WITH
  NOLOGIN
  PASSWORD NULL
  CONNECTION LIMIT 0
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOINHERIT
  NOREPLICATION
  NOBYPASSRLS;

DO $$
DECLARE
  v_app_role oid := 'app_role'::pg_catalog.regrole;
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_catalog.pg_authid
     WHERE oid = v_app_role
       AND rolcanlogin = false
       AND rolconnlimit = 0
       AND rolpassword IS NULL
       AND rolsuper = false
       AND rolcreatedb = false
       AND rolcreaterole = false
       AND rolinherit = false
       AND rolreplication = false
       AND rolbypassrls = false
  ) THEN
    RAISE EXCEPTION 'app_role did not reach the required internal-role contract'
      USING ERRCODE = '55000';
  END IF;
END
$$;
