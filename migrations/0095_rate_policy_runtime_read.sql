-- Order 488: RateConfigurationService reads tenant-scoped policy references
-- under the normal app_role transaction. RLS remains the tenant boundary.
GRANT SELECT ON TABLE public.policy TO app_role;
REVOKE ALL ON TABLE public.policy FROM PUBLIC;
