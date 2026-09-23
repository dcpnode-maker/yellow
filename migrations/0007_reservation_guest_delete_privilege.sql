-- Exact reservation-guest replacement removes only application-selected non-primary rows.
-- Tenant visibility remains governed by the existing reservation_guest RLS policy.
REVOKE DELETE ON TABLE reservation_guest FROM PUBLIC;

DO $privileges$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_role') THEN
    GRANT DELETE ON TABLE reservation_guest TO app_role;
  END IF;
END $privileges$;
