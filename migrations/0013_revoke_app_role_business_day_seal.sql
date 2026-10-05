-- Day close has no audited application command yet. Keep the deployment owner as
-- the only execution authority until that domain boundary exists.
REVOKE EXECUTE ON FUNCTION public.seal_business_day(uuid,uuid,date,uuid)
  FROM app_role;
