-- Preserve inherited configuration authority while protecting the audited mode path.
-- A caller-set custom GUC is not an authority. Use the actual invoker role.
DO $$
BEGIN
  IF (SELECT count(*) FROM public.schema_migration) <> 102
     OR (SELECT max(version) FROM public.schema_migration) <> 102 THEN
    RAISE EXCEPTION 'property mode runtime guard requires predecessor102';
  END IF;
END
$$;

CREATE FUNCTION public.guard_property_operating_mode_runtime_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_changed boolean;
BEGIN
  IF TG_OP='INSERT' THEN
    v_changed := (NEW.config #> '{workspace,operating_mode}') IS NOT NULL;
  ELSE
    v_changed := (NEW.config #> '{workspace,operating_mode}')
      IS DISTINCT FROM (OLD.config #> '{workspace,operating_mode}');
  END IF;
  IF v_changed AND current_user <> 'yellow_owner'
     AND (current_user='app_role' OR session_user='yellow_runtime') THEN
    RAISE EXCEPTION 'property operating mode requires governed capability'
      USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END
$$;

ALTER FUNCTION public.guard_property_operating_mode_runtime_write() OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.guard_property_operating_mode_runtime_write()
  FROM PUBLIC, app_role, yellow_runtime;

CREATE TRIGGER property_operating_mode_runtime_write_guard
BEFORE INSERT OR UPDATE OF config ON public.org_node
FOR EACH ROW EXECUTE FUNCTION public.guard_property_operating_mode_runtime_write();
