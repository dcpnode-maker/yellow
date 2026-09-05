-- Order 385: least-privilege read authority for the operator business-day workbench.
-- Role assignment remains an explicit provisioning concern outside this migration.

INSERT INTO public.permission(code, description)
VALUES (
  'financials.business-days:read',
  'Read governed property business-day close truth'
)
ON CONFLICT (code) DO NOTHING;
