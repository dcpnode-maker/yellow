-- Order 388: least-privilege seal authority for the ordinary business-day operator.
-- Role assignment remains an explicit provisioning concern outside this migration.

INSERT INTO public.permission(code, description)
VALUES
  ('business_day.seal', 'Seal business day'),
  ('financials.business-days:seal', 'Seal governed property business days')
ON CONFLICT (code) DO NOTHING;
