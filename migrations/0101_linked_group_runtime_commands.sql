-- Order687: narrow runtime authority for linked group headers and association.
-- Group commands retain transaction-local tenant RLS and property validation.
GRANT INSERT (id, tenant_id, property_node, kind, code, name, status)
  ON TABLE public.reservation_group TO app_role;
GRANT UPDATE (group_id) ON TABLE public.reservation TO app_role;
