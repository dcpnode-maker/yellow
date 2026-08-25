-- Separate the authenticated runtime identity from deployment and object ownership.
-- Login secrets are provisioned outside the migration; this file verifies the exact
-- password-free catalogue, transfers the approved public catalogue, and exposes only
-- the bounded global capabilities required by the runtime.

DO $order127_preconditions$
DECLARE
  v_deploy oid := pg_catalog.to_regrole('yellow_deploy');
  v_owner oid := pg_catalog.to_regrole('yellow_owner');
  v_runtime oid := pg_catalog.to_regrole('yellow_runtime');
  v_app oid := pg_catalog.to_regrole('app_role');
BEGIN
  IF v_deploy IS NULL OR v_owner IS NULL OR v_runtime IS NULL OR v_app IS NULL THEN
    RAISE EXCEPTION 'Order 127 requires yellow_deploy, yellow_owner, yellow_runtime, and app_role'
      USING ERRCODE = '55000';
  END IF;

  IF session_user <> 'yellow_deploy' OR current_user <> 'yellow_deploy' THEN
    RAISE EXCEPTION 'migration 0015 must execute directly as yellow_deploy'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_authid
     WHERE oid = v_deploy AND rolcanlogin AND rolsuper
  ) THEN
    RAISE EXCEPTION 'yellow_deploy is not the required login deployment administrator'
      USING ERRCODE = '55000';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_authid
     WHERE oid = v_owner
       AND NOT rolcanlogin AND rolconnlimit = 0 AND rolpassword IS NULL
       AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole
       AND NOT rolinherit AND NOT rolreplication AND NOT rolbypassrls
  ) THEN
    RAISE EXCEPTION 'yellow_owner has incompatible attributes'
      USING ERRCODE = '55000';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_authid
     WHERE oid = v_runtime
       AND rolcanlogin AND rolconnlimit = -1 AND rolpassword IS NOT NULL
       AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole
       AND NOT rolinherit AND NOT rolreplication AND NOT rolbypassrls
  ) THEN
    RAISE EXCEPTION 'yellow_runtime has incompatible attributes or no external password'
      USING ERRCODE = '55000';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_authid
     WHERE oid = v_app
       AND NOT rolcanlogin AND rolconnlimit = 0 AND rolpassword IS NULL
       AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole
       AND NOT rolinherit AND NOT rolreplication AND NOT rolbypassrls
  ) THEN
    RAISE EXCEPTION 'app_role is not the approved internal capability role'
      USING ERRCODE = '55000';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM pg_catalog.pg_auth_members
     WHERE (roleid IN (v_deploy, v_owner, v_runtime, v_app)
         OR member IN (v_deploy, v_owner, v_runtime, v_app))
       AND NOT (
         roleid = v_app
         AND member = v_runtime
         AND NOT admin_option
         AND NOT inherit_option
         AND set_option
       )
  ) THEN
    RAISE EXCEPTION 'Order 127 roles have an unexpected pre-migration membership edge'
      USING ERRCODE = '55000';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_stat_activity
     WHERE usename = 'yellow_runtime'
  ) THEN
    RAISE EXCEPTION 'yellow_runtime has an active session; drain it before migration'
      USING ERRCODE = '55000';
  END IF;

  IF (SELECT datdba FROM pg_catalog.pg_database WHERE datname = current_database()) <> v_deploy THEN
    RAISE EXCEPTION 'yellow_deploy must own the target database before migration 0015'
      USING ERRCODE = '55000';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.schema_migration
     WHERE version = 14
       AND filename = '0014_bind_occupancy_caller_tenant.sql'
       AND checksum_sha256 = '706806ad3c041d506df1e90f75b19ed219baa3fedb8968471828657ab6c7493a'
  ) OR (SELECT pg_catalog.count(*) FROM public.schema_migration) <> 14 THEN
    RAISE EXCEPTION 'migration ledger is not the exact approved through-0014 predecessor'
      USING ERRCODE = '55000';
  END IF;

  IF (SELECT pg_catalog.count(*)
        FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND c.relkind IN ('r', 'p', 'v', 'm', 'f', 'S')
         AND NOT EXISTS (
           SELECT 1 FROM pg_catalog.pg_depend d
            WHERE d.classid = 'pg_catalog.pg_class'::pg_catalog.regclass
              AND d.objid = c.oid AND d.deptype = 'e'
         )) <> 88 THEN
    RAISE EXCEPTION 'unexpected public relation catalogue before migration 0015'
      USING ERRCODE = '55000';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind IN ('r', 'p', 'v', 'm', 'f', 'S')
       AND NOT EXISTS (
         SELECT 1 FROM pg_catalog.pg_depend d
          WHERE d.classid = 'pg_catalog.pg_class'::pg_catalog.regclass
            AND d.objid = c.oid AND d.deptype = 'e'
       )
       AND c.relowner <> v_deploy
  ) THEN
    RAISE EXCEPTION 'yellow_deploy does not own the complete pre-0015 public relation catalogue'
      USING ERRCODE = '55000';
  END IF;

  IF (SELECT pg_catalog.count(*)
        FROM pg_catalog.pg_proc p
        JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public'
         AND NOT EXISTS (
           SELECT 1 FROM pg_catalog.pg_depend d
            WHERE d.classid = 'pg_catalog.pg_proc'::pg_catalog.regclass
              AND d.objid = p.oid AND d.deptype = 'e'
         )) <> 8 THEN
    RAISE EXCEPTION 'unexpected public function catalogue before migration 0015'
      USING ERRCODE = '55000';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proowner <> v_deploy
  ) THEN
    RAISE EXCEPTION 'yellow_deploy does not own the complete pre-0015 public function catalogue'
      USING ERRCODE = '55000';
  END IF;

  IF (SELECT pg_catalog.count(*)
        FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND c.relrowsecurity) <> 75
     OR (SELECT pg_catalog.count(*)
           FROM pg_catalog.pg_policy p
           JOIN pg_catalog.pg_class c ON c.oid = p.polrelid
           JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public') <> 75 THEN
    RAISE EXCEPTION 'unexpected RLS or policy catalogue before migration 0015'
      USING ERRCODE = '55000';
  END IF;
END
$order127_preconditions$;

CREATE TEMP TABLE order127_rls_snapshot ON COMMIT DROP AS
SELECT c.oid AS relation_oid,
       c.relrowsecurity,
       c.relforcerowsecurity
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public'
   AND c.relkind IN ('r', 'p');

CREATE TEMP TABLE order127_policy_snapshot ON COMMIT DROP AS
SELECT p.oid AS policy_oid,
       p.polrelid,
       p.polname,
       p.polcmd,
       p.polpermissive,
       p.polroles,
       pg_catalog.pg_get_expr(p.polqual, p.polrelid) AS using_expression,
       pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid) AS check_expression
  FROM pg_catalog.pg_policy p
  JOIN pg_catalog.pg_class c ON c.oid = p.polrelid
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public';

DO $order127_transfer_relations$
DECLARE
  v_relation record;
BEGIN
  FOR v_relation IN
    SELECT c.oid,
           c.relkind,
           pg_catalog.format('%I.%I', n.nspname, c.relname) AS qualified_name
      FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
       AND NOT EXISTS (
         SELECT 1 FROM pg_catalog.pg_depend d
          WHERE d.classid = 'pg_catalog.pg_class'::pg_catalog.regclass
            AND d.objid = c.oid AND d.deptype = 'e'
       )
     ORDER BY c.oid
  LOOP
    CASE v_relation.relkind
      WHEN 'v' THEN EXECUTE pg_catalog.format('ALTER VIEW %s OWNER TO yellow_owner', v_relation.qualified_name);
      WHEN 'm' THEN EXECUTE pg_catalog.format('ALTER MATERIALIZED VIEW %s OWNER TO yellow_owner', v_relation.qualified_name);
      WHEN 'f' THEN EXECUTE pg_catalog.format('ALTER FOREIGN TABLE %s OWNER TO yellow_owner', v_relation.qualified_name);
      ELSE EXECUTE pg_catalog.format('ALTER TABLE %s OWNER TO yellow_owner', v_relation.qualified_name);
    END CASE;
  END LOOP;
END
$order127_transfer_relations$;

DO $order127_transfer_standalone_sequences$
DECLARE
  v_sequence record;
BEGIN
  FOR v_sequence IN
    SELECT pg_catalog.format('%I.%I', n.nspname, c.relname) AS qualified_name
      FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind = 'S'
       AND NOT EXISTS (
         SELECT 1 FROM pg_catalog.pg_depend d
          WHERE d.classid = 'pg_catalog.pg_class'::pg_catalog.regclass
            AND d.objid = c.oid
            AND d.deptype IN ('a', 'i')
       )
       AND NOT EXISTS (
         SELECT 1 FROM pg_catalog.pg_depend d
          WHERE d.classid = 'pg_catalog.pg_class'::pg_catalog.regclass
            AND d.objid = c.oid AND d.deptype = 'e'
       )
     ORDER BY c.oid
  LOOP
    EXECUTE pg_catalog.format('ALTER SEQUENCE %s OWNER TO yellow_owner', v_sequence.qualified_name);
  END LOOP;
END
$order127_transfer_standalone_sequences$;

DO $order127_transfer_functions$
DECLARE
  v_function record;
BEGIN
  FOR v_function IN
    SELECT p.oid, p.prokind, p.oid::pg_catalog.regprocedure AS signature
      FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
     ORDER BY p.oid
  LOOP
    CASE v_function.prokind
      WHEN 'a' THEN EXECUTE pg_catalog.format('ALTER AGGREGATE %s OWNER TO yellow_owner', v_function.signature);
      WHEN 'p' THEN EXECUTE pg_catalog.format('ALTER PROCEDURE %s OWNER TO yellow_owner', v_function.signature);
      ELSE EXECUTE pg_catalog.format('ALTER FUNCTION %s OWNER TO yellow_owner', v_function.signature);
    END CASE;
  END LOOP;
END
$order127_transfer_functions$;

ALTER SCHEMA public OWNER TO yellow_owner;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

CREATE FUNCTION public.runtime_resolve_active_tenant(p_slug text)
RETURNS uuid
LANGUAGE sql
STABLE
STRICT
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $runtime_resolve_active_tenant$
  SELECT t.id
    FROM public.tenant AS t
   WHERE pg_catalog.length(p_slug) BETWEEN 1 AND 63
     AND p_slug ~ '^[a-z0-9][a-z0-9-]{0,62}$'
     AND t.slug = p_slug
     AND t.status = 'active'
$runtime_resolve_active_tenant$;

CREATE FUNCTION public.runtime_due_hold_scopes(p_limit integer)
RETURNS TABLE(tenant_id uuid, property_node ltree)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $runtime_due_hold_scopes$
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 1000 THEN
    RAISE EXCEPTION 'limit must be between 1 and 1000' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT h.tenant_id, h.property_node
    FROM public.hold AS h
   WHERE h.status = 'active'
     AND h.expires_at <= pg_catalog.transaction_timestamp()
   GROUP BY h.tenant_id, h.property_node
   ORDER BY pg_catalog.min(h.expires_at), h.tenant_id, h.property_node
   LIMIT p_limit;
END
$runtime_due_hold_scopes$;

CREATE FUNCTION public.runtime_consumer_begin(p_consumer text)
RETURNS bigint
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $runtime_consumer_begin$
DECLARE
  v_last_seq bigint;
BEGIN
  IF p_consumer IS NULL OR pg_catalog.length(p_consumer) > 64
     OR p_consumer !~ '^[a-z][a-z0-9-]*$' THEN
    RAISE EXCEPTION 'consumer must be a stable lowercase name' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.consumer_cursor (consumer, last_seq)
  VALUES (p_consumer, 0)
  ON CONFLICT (consumer) DO NOTHING;

  SELECT c.last_seq INTO STRICT v_last_seq
    FROM public.consumer_cursor AS c
   WHERE c.consumer = p_consumer
   FOR UPDATE;
  RETURN v_last_seq;
END
$runtime_consumer_begin$;

CREATE FUNCTION public.runtime_consumer_read(
  p_consumer text,
  p_after bigint,
  p_limit integer,
  p_unpublished boolean
)
RETURNS TABLE(
  seq bigint,
  id uuid,
  tenant_id uuid,
  property_node uuid,
  business_date text,
  aggregate_type text,
  aggregate_id uuid,
  event_type text,
  event_version integer,
  actor_id uuid,
  correlation_id uuid,
  causation_id uuid,
  created_at timestamptz,
  payload jsonb
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $runtime_consumer_read$
DECLARE
  v_cursor bigint;
BEGIN
  IF p_consumer IS NULL OR pg_catalog.length(p_consumer) > 64
     OR p_consumer !~ '^[a-z][a-z0-9-]*$' THEN
    RAISE EXCEPTION 'consumer must be a stable lowercase name' USING ERRCODE = '22023';
  END IF;
  IF p_after IS NULL OR p_after < 0 THEN
    RAISE EXCEPTION 'consumer cursor must be non-negative' USING ERRCODE = '22023';
  END IF;
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 1000 THEN
    RAISE EXCEPTION 'consumer batch limit must be between 1 and 1000' USING ERRCODE = '22023';
  END IF;
  IF p_unpublished IS NULL THEN
    RAISE EXCEPTION 'unpublished selector is required' USING ERRCODE = '22023';
  END IF;

  SELECT c.last_seq INTO v_cursor
    FROM public.consumer_cursor AS c
   WHERE c.consumer = p_consumer
   FOR UPDATE;
  IF NOT FOUND OR v_cursor <> p_after THEN
    RAISE EXCEPTION 'consumer cursor changed or was not begun' USING ERRCODE = '55000';
  END IF;

  IF p_unpublished THEN
    RETURN QUERY
    SELECT o.seq,
           o.id,
           o.tenant_id,
           o.property_node,
           o.business_date::text,
           o.aggregate_type,
           o.aggregate_id,
           o.event_type,
           o.event_version,
           o.actor_id,
           o.correlation_id,
           o.causation_id,
           o.created_at,
           o.payload
      FROM public.outbox AS o
     WHERE o.published_at IS NULL
     ORDER BY o.seq
     LIMIT p_limit;
  ELSE
    RETURN QUERY
    SELECT o.seq,
           o.id,
           o.tenant_id,
           o.property_node,
           o.business_date::text,
           o.aggregate_type,
           o.aggregate_id,
           o.event_type,
           o.event_version,
           o.actor_id,
           o.correlation_id,
           o.causation_id,
           o.created_at,
           o.payload
      FROM public.outbox AS o
     WHERE o.seq > p_after
     ORDER BY o.seq
     LIMIT p_limit;
  END IF;
END
$runtime_consumer_read$;

CREATE FUNCTION public.runtime_consumer_mark(p_consumer text, p_outbox_id uuid)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $runtime_consumer_mark$
DECLARE
  v_inserted boolean;
BEGIN
  IF p_consumer IS NULL OR pg_catalog.length(p_consumer) > 64
     OR p_consumer !~ '^[a-z][a-z0-9-]*$' OR p_outbox_id IS NULL THEN
    RAISE EXCEPTION 'valid consumer and outbox id are required' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.consumer_processed (consumer, outbox_id)
  VALUES (p_consumer, p_outbox_id)
  ON CONFLICT (consumer, outbox_id) DO NOTHING
  RETURNING true INTO v_inserted;
  RETURN COALESCE(v_inserted, false);
END
$runtime_consumer_mark$;

CREATE FUNCTION public.runtime_consumer_advance(p_consumer text, p_last_seq bigint)
RETURNS bigint
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $runtime_consumer_advance$
DECLARE
  v_current bigint;
BEGIN
  IF p_consumer IS NULL OR pg_catalog.length(p_consumer) > 64
     OR p_consumer !~ '^[a-z][a-z0-9-]*$' THEN
    RAISE EXCEPTION 'consumer must be a stable lowercase name' USING ERRCODE = '22023';
  END IF;
  IF p_last_seq IS NULL OR p_last_seq < 0 THEN
    RAISE EXCEPTION 'consumer cursor must be non-negative' USING ERRCODE = '22023';
  END IF;

  SELECT c.last_seq INTO v_current
    FROM public.consumer_cursor AS c
   WHERE c.consumer = p_consumer
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'consumer cursor was not begun' USING ERRCODE = '55000';
  END IF;
  IF p_last_seq < v_current THEN
    RAISE EXCEPTION 'consumer cursor cannot move backwards' USING ERRCODE = '22023';
  END IF;

  IF p_last_seq <> v_current THEN
    UPDATE public.consumer_cursor
       SET last_seq = p_last_seq, updated_at = pg_catalog.now()
     WHERE consumer = p_consumer;
  END IF;
  RETURN p_last_seq;
END
$runtime_consumer_advance$;

CREATE FUNCTION public.runtime_mark_outbox_published(p_event_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $runtime_mark_outbox_published$
DECLARE
  v_count integer;
  v_size integer := COALESCE(pg_catalog.cardinality(p_event_ids), -1);
BEGIN
  IF v_size < 1 OR v_size > 1000 OR pg_catalog.array_position(p_event_ids, NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'event id array must contain between 1 and 1000 non-null UUIDs'
      USING ERRCODE = '22023';
  END IF;

  WITH ids AS (
    SELECT DISTINCT event_id
      FROM pg_catalog.unnest(p_event_ids) AS event_id
  ), marked AS (
    UPDATE public.outbox AS o
       SET published_at = COALESCE(o.published_at, pg_catalog.now())
     WHERE o.id IN (SELECT event_id FROM ids)
    RETURNING 1
  )
  SELECT pg_catalog.count(*)::integer INTO v_count FROM marked;
  RETURN v_count;
END
$runtime_mark_outbox_published$;

CREATE FUNCTION public.runtime_prune_outbox(p_retention_seconds integer)
RETURNS TABLE(processed integer, outbox bigint)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $runtime_prune_outbox$
DECLARE
  v_processed integer;
  v_outbox bigint;
BEGIN
  IF p_retention_seconds IS NULL OR p_retention_seconds < 0 THEN
    RAISE EXCEPTION 'retention seconds must be a non-negative integer' USING ERRCODE = '22023';
  END IF;

  WITH gone AS (
    DELETE FROM public.consumer_processed AS processed_row
    USING public.outbox AS event
     WHERE processed_row.outbox_id = event.id
       AND event.published_at IS NOT NULL
       AND event.published_at < pg_catalog.now()
           - pg_catalog.make_interval(secs => p_retention_seconds)
    RETURNING 1
  )
  SELECT pg_catalog.count(*)::integer INTO v_processed FROM gone;

  SELECT public.prune_outbox(pg_catalog.make_interval(secs => p_retention_seconds))
    INTO v_outbox;
  RETURN QUERY SELECT v_processed, v_outbox;
END
$runtime_prune_outbox$;

CREATE FUNCTION public.runtime_visible_extensions(p_tenant uuid)
RETURNS TABLE(
  id uuid,
  tenant_id uuid,
  type text,
  key text,
  version integer,
  content jsonb,
  status text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $runtime_visible_extensions$
BEGIN
  IF p_tenant IS NULL THEN
    RAISE EXCEPTION 'tenant id is required' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
  SELECT e.id, e.tenant_id, e.type, e.key, e.version, e.content, e.status
    FROM public.extension AS e
   WHERE e.tenant_id IS NULL OR e.tenant_id = p_tenant
   ORDER BY e.type, e.key, e.version;
END
$runtime_visible_extensions$;

CREATE FUNCTION public.runtime_extension_compatibility_inputs(p_type text)
RETURNS TABLE(id uuid, content jsonb)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $runtime_extension_compatibility_inputs$
BEGIN
  IF p_type IS NULL OR pg_catalog.length(p_type) > 64
     OR p_type !~ '^[a-z][a-z0-9_.-]*$' THEN
    RAISE EXCEPTION 'extension type must be a stable lowercase identifier'
      USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
  SELECT e.id, e.content
    FROM public.extension AS e
   WHERE e.type = p_type
   ORDER BY e.id;
END
$runtime_extension_compatibility_inputs$;

ALTER FUNCTION public.runtime_resolve_active_tenant(text) OWNER TO yellow_owner;
ALTER FUNCTION public.runtime_due_hold_scopes(integer) OWNER TO yellow_owner;
ALTER FUNCTION public.runtime_consumer_begin(text) OWNER TO yellow_owner;
ALTER FUNCTION public.runtime_consumer_read(text,bigint,integer,boolean) OWNER TO yellow_owner;
ALTER FUNCTION public.runtime_consumer_mark(text,uuid) OWNER TO yellow_owner;
ALTER FUNCTION public.runtime_consumer_advance(text,bigint) OWNER TO yellow_owner;
ALTER FUNCTION public.runtime_mark_outbox_published(uuid[]) OWNER TO yellow_owner;
ALTER FUNCTION public.runtime_prune_outbox(integer) OWNER TO yellow_owner;
ALTER FUNCTION public.runtime_visible_extensions(uuid) OWNER TO yellow_owner;
ALTER FUNCTION public.runtime_extension_compatibility_inputs(text) OWNER TO yellow_owner;

REVOKE ALL ON FUNCTION public.runtime_resolve_active_tenant(text) FROM PUBLIC, app_role;
REVOKE ALL ON FUNCTION public.runtime_due_hold_scopes(integer) FROM PUBLIC, app_role;
REVOKE ALL ON FUNCTION public.runtime_consumer_begin(text) FROM PUBLIC, app_role;
REVOKE ALL ON FUNCTION public.runtime_consumer_read(text,bigint,integer,boolean) FROM PUBLIC, app_role;
REVOKE ALL ON FUNCTION public.runtime_consumer_mark(text,uuid) FROM PUBLIC, app_role;
REVOKE ALL ON FUNCTION public.runtime_consumer_advance(text,bigint) FROM PUBLIC, app_role;
REVOKE ALL ON FUNCTION public.runtime_mark_outbox_published(uuid[]) FROM PUBLIC, app_role;
REVOKE ALL ON FUNCTION public.runtime_prune_outbox(integer) FROM PUBLIC, app_role;
REVOKE ALL ON FUNCTION public.runtime_visible_extensions(uuid) FROM PUBLIC, app_role;
REVOKE ALL ON FUNCTION public.runtime_extension_compatibility_inputs(text) FROM PUBLIC, app_role;

GRANT USAGE ON SCHEMA public TO yellow_runtime;
GRANT EXECUTE ON FUNCTION public.runtime_resolve_active_tenant(text) TO yellow_runtime;
GRANT EXECUTE ON FUNCTION public.runtime_due_hold_scopes(integer) TO yellow_runtime;
GRANT EXECUTE ON FUNCTION public.runtime_consumer_begin(text) TO yellow_runtime;
GRANT EXECUTE ON FUNCTION public.runtime_consumer_read(text,bigint,integer,boolean) TO yellow_runtime;
GRANT EXECUTE ON FUNCTION public.runtime_consumer_mark(text,uuid) TO yellow_runtime;
GRANT EXECUTE ON FUNCTION public.runtime_consumer_advance(text,bigint) TO yellow_runtime;
GRANT EXECUTE ON FUNCTION public.runtime_mark_outbox_published(uuid[]) TO yellow_runtime;
GRANT EXECUTE ON FUNCTION public.runtime_prune_outbox(integer) TO yellow_runtime;
GRANT EXECUTE ON FUNCTION public.runtime_visible_extensions(uuid) TO yellow_runtime;
GRANT EXECUTE ON FUNCTION public.runtime_extension_compatibility_inputs(text) TO yellow_runtime;

GRANT app_role TO yellow_runtime;

DO $order127_postconditions$
DECLARE
  v_owner oid := 'yellow_owner'::pg_catalog.regrole;
  v_runtime oid := 'yellow_runtime'::pg_catalog.regrole;
  v_app oid := 'app_role'::pg_catalog.regrole;
BEGIN
  IF EXISTS (
    SELECT 1
      FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind IN ('r', 'p', 'v', 'm', 'f', 'S')
       AND NOT EXISTS (
         SELECT 1 FROM pg_catalog.pg_depend d
          WHERE d.classid = 'pg_catalog.pg_class'::pg_catalog.regclass
            AND d.objid = c.oid AND d.deptype = 'e'
       )
       AND c.relowner <> v_owner
  ) OR EXISTS (
    SELECT 1
      FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proowner <> v_owner
  ) THEN
    RAISE EXCEPTION 'public object ownership transfer is incomplete'
      USING ERRCODE = '55000';
  END IF;

  IF (SELECT nspowner FROM pg_catalog.pg_namespace WHERE nspname = 'public') <> v_owner THEN
    RAISE EXCEPTION 'yellow_owner does not own the public schema' USING ERRCODE = '55000';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relowner = v_runtime
  ) OR EXISTS (
    SELECT 1
      FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proowner = v_runtime
  ) THEN
    RAISE EXCEPTION 'yellow_runtime owns a public object' USING ERRCODE = '55000';
  END IF;

  IF (SELECT pg_catalog.count(*) FROM pg_catalog.pg_auth_members
       WHERE roleid = v_app AND member = v_runtime
         AND NOT admin_option AND NOT inherit_option AND set_option) <> 1
     OR EXISTS (
       SELECT 1 FROM pg_catalog.pg_auth_members
        WHERE (roleid = v_runtime OR member = v_runtime)
          AND NOT (roleid = v_app AND member = v_runtime)
     ) THEN
    RAISE EXCEPTION 'yellow_runtime membership is not exactly app_role'
      USING ERRCODE = '55000';
  END IF;

  IF EXISTS (
    (SELECT relation_oid, relrowsecurity, relforcerowsecurity FROM order127_rls_snapshot
     EXCEPT
     SELECT c.oid, c.relrowsecurity, c.relforcerowsecurity
       FROM pg_catalog.pg_class c
       JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p'))
    UNION ALL
    (SELECT c.oid, c.relrowsecurity, c.relforcerowsecurity
       FROM pg_catalog.pg_class c
       JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
     EXCEPT
     SELECT relation_oid, relrowsecurity, relforcerowsecurity FROM order127_rls_snapshot)
  ) THEN
    RAISE EXCEPTION 'RLS flags changed during migration 0015' USING ERRCODE = '55000';
  END IF;

  IF EXISTS (
    (SELECT policy_oid, polrelid, polname, polcmd, polpermissive, polroles, using_expression, check_expression
       FROM order127_policy_snapshot
     EXCEPT
     SELECT p.oid, p.polrelid, p.polname, p.polcmd, p.polpermissive, p.polroles,
            pg_catalog.pg_get_expr(p.polqual, p.polrelid),
            pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid)
       FROM pg_catalog.pg_policy p
       JOIN pg_catalog.pg_class c ON c.oid = p.polrelid
       JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public')
    UNION ALL
    (SELECT p.oid, p.polrelid, p.polname, p.polcmd, p.polpermissive, p.polroles,
            pg_catalog.pg_get_expr(p.polqual, p.polrelid),
            pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid)
       FROM pg_catalog.pg_policy p
       JOIN pg_catalog.pg_class c ON c.oid = p.polrelid
       JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
     EXCEPT
     SELECT policy_oid, polrelid, polname, polcmd, polpermissive, polroles, using_expression, check_expression
       FROM order127_policy_snapshot)
  ) THEN
    RAISE EXCEPTION 'RLS policy catalogue changed during migration 0015' USING ERRCODE = '55000';
  END IF;
END
$order127_postconditions$;
