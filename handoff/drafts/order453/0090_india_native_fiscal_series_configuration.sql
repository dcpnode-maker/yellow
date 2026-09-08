-- Order453 draft. Production runMigrations owns the transaction and ledger.
-- Existing configuration history is not backfilled. Six arguments remain exact.
DO $precondition$
DECLARE p pg_catalog.pg_proc%ROWTYPE; expected record;
BEGIN
  IF (SELECT count(*) FROM public.schema_migration) IS DISTINCT FROM 89::bigint
      OR (SELECT max(version) FROM public.schema_migration) IS DISTINCT FROM 89
      OR NOT EXISTS(SELECT 1 FROM public.schema_migration WHERE version=89
        AND filename='0089_native_credit_delivery_discovery.sql'
        AND btrim(checksum_sha256)='26aac42e59146dfa29f558dc75209166420a5aa7621bc34b1f6ec0f9c834c1cd') THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='series configuration requires exact canonical89';
  END IF;
  FOR expected IN SELECT * FROM (VALUES
    ('public.create_india_native_fiscal_series(uuid,uuid,uuid,text,text,uuid)',
      '4b8be69c22a75305476c849d57e736b46af74b1edfd020b99fa6bacb7375d302',true,true,0,
      ARRAY['search_path=pg_catalog, public']::text[],true),
    ('public.assert_india_native_credit_authority(uuid,uuid,uuid,text[],boolean)',
      '780b31932dcc4da23247abfb379efbe3b03ebbe8d5fc827154bcf80b497e8107',false,false,1,
      ARRAY['search_path=pg_catalog, public, pg_temp']::text[],false),
    ('public.read_india_native_credit_delivery_by_document(uuid,uuid,uuid,uuid)',
      '702a035ea496c571ea4338c90fed6b3dbc717b62c3a14ba2e2db3764aaaaacad',true,false,0,
      ARRAY['search_path=pg_catalog, public, pg_temp','TimeZone=UTC','DateStyle=ISO,YMD']::text[],true)
  ) contracts(signature,body_hash,security_definer,returns_set,defaults,config,app_execute) LOOP
    SELECT * INTO p FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure(expected.signature);
    IF p.oid IS NULL OR p.proowner IS DISTINCT FROM 'yellow_owner'::regrole
        OR p.prolang IS DISTINCT FROM (SELECT oid FROM pg_catalog.pg_language WHERE lanname='plpgsql')
        OR p.prosecdef IS DISTINCT FROM expected.security_definer OR p.provolatile<>'v'
        OR p.proretset IS DISTINCT FROM expected.returns_set OR p.proisstrict OR p.proleakproof
        OR p.proparallel<>'u' OR p.prokind<>'f' OR p.provariadic<>0 OR p.pronargdefaults<>expected.defaults
        OR (expected.defaults=1 AND pg_catalog.pg_get_expr(p.proargdefaults,0) IS DISTINCT FROM 'false')
        OR p.proconfig IS DISTINCT FROM expected.config
        OR encode(public.digest(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'UTF8'),'sha256'),'hex') IS DISTINCT FROM expected.body_hash
        OR NOT pg_catalog.has_function_privilege('yellow_owner',p.oid,'EXECUTE')
        OR pg_catalog.has_function_privilege('app_role',p.oid,'EXECUTE') IS DISTINCT FROM expected.app_execute
        OR pg_catalog.has_function_privilege('yellow_runtime',p.oid,'EXECUTE')
        OR EXISTS(SELECT 1 FROM pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
          WHERE a.privilege_type<>'EXECUTE' OR a.is_grantable OR a.grantee NOT IN
            (p.proowner,CASE WHEN expected.app_execute THEN 'app_role'::regrole::oid ELSE p.proowner END)) THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='series configuration predecessor authority differs';
    END IF;
    IF expected.returns_set THEN
      IF pg_catalog.pg_get_function_result(p.oid) IS DISTINCT FROM
          'TABLE(series_id uuid, tenant_id uuid, property_node uuid, supplier_registration_id uuid, document_kind text, prefix text, financial_year_start date, next_no bigint, created boolean)'
          OR p.proargnames IS DISTINCT FROM ARRAY['p_tenant_id','p_property_node','p_supplier_registration_id',
            'p_document_kind','p_prefix','p_actor_id','series_id','tenant_id','property_node','supplier_registration_id',
            'document_kind','prefix','financial_year_start','next_no','created']::text[] THEN
        RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='series configuration predecessor signature differs';
      END IF;
    ELSIF p.prorettype IS DISTINCT FROM (CASE WHEN expected.defaults=1 THEN 'void'::regtype ELSE 'jsonb'::regtype END) THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='series configuration predecessor result differs';
    END IF;
  END LOOP;
END $precondition$;

SET ROLE yellow_owner;
CREATE OR REPLACE FUNCTION public.create_india_native_fiscal_series(
  p_tenant_id uuid,p_property_node uuid,p_supplier_registration_id uuid,
  p_document_kind text,p_prefix text,p_actor_id uuid
) RETURNS TABLE(
  series_id uuid,tenant_id uuid,property_node uuid,supplier_registration_id uuid,
  document_kind text,prefix text,financial_year_start date,next_no bigint,created boolean
)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER CALLED ON NULL INPUT PARALLEL UNSAFE
SET search_path=pg_catalog,public,pg_temp
AS $$
DECLARE
  v_issue_date date; v_financial_year date; v_existing public.document_series%ROWTYPE;
  v_payload jsonb; v_correlation_id uuid;
BEGIN
  -- One state-changing publication per transaction: authenticate before reporting
  -- an inverted lock order, then reacquire authoritative membership under locks.
  PERFORM public.assert_india_native_credit_authority(p_tenant_id,p_property_node,p_actor_id,
    ARRAY['tax-fiscal.series:configure']);
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_locks l WHERE l.pid=pg_catalog.pg_backend_pid() AND l.locktype='advisory' AND l.granted
      AND l.objsubid=1 AND l.classid=((6441674055002974568::bigint>>32)&4294967295)::oid
      AND l.objid=(6441674055002974568::bigint&4294967295)::oid) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native fiscal series requires transaction without prior publication';
  END IF;
  -- Includes current runtime identity/context and ordered, tenant-coherent locks.
  -- Authority is required even for absent supplier/property and exact replay.
  PERFORM public.assert_india_native_credit_authority(p_tenant_id,p_property_node,p_actor_id,
    ARRAY['tax-fiscal.series:configure'],true);
  IF p_supplier_registration_id IS NULL OR p_document_kind IS NULL
      OR p_document_kind NOT IN ('invoice','credit_note','debit_note')
      OR p_prefix IS NULL OR p_prefix<>pg_catalog.btrim(p_prefix)
      OR pg_catalog.char_length(p_prefix) NOT BETWEEN 1 AND 12 OR p_prefix !~ '^[A-Za-z0-9/-]+$' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='India native fiscal series input is invalid';
  END IF;
  SELECT (pg_catalog.transaction_timestamp() AT TIME ZONE property.timezone)::date
    INTO v_issue_date FROM public.org_node property
    WHERE property.tenant_id=p_tenant_id AND property.id=p_property_node AND property.kind='property' AND property.currency='INR';
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='India native fiscal property is unavailable'; END IF;
  v_financial_year:=pg_catalog.make_date(pg_catalog.date_part('year',v_issue_date)::integer
    -CASE WHEN pg_catalog.date_part('month',v_issue_date)<4 THEN 1 ELSE 0 END,4,1);
  IF pg_catalog.char_length(p_prefix||'1')>16 THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='India native fiscal prefix exceeds Rule-46 document reference limit';
  END IF;
  PERFORM 1 FROM public.property_fiscal_registration registration
    JOIN public.india_gst_supplier_registration_status_snapshot registration_status
      ON registration_status.tenant_id=registration.tenant_id
      AND registration_status.supplier_registration_id=registration.id
      AND registration_status.status_as_of=v_issue_date AND registration_status.gst_registration_status='active'
    WHERE registration.tenant_id=p_tenant_id AND registration.id=p_supplier_registration_id
      AND registration.property_node=p_property_node AND registration.scheme='in-gstin' AND registration.currency='INR'
    FOR KEY SHARE OF registration,registration_status;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='India native fiscal supplier registration is unavailable'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'india-native-fiscal-series:'||p_tenant_id::text||':'||p_property_node::text||':'||p_supplier_registration_id::text||':'||p_document_kind||':'||v_financial_year::text,430));
  SELECT * INTO v_existing FROM public.document_series series
    WHERE series.tenant_id=p_tenant_id AND series.property_node=p_property_node
      AND series.supplier_registration_id=p_supplier_registration_id AND series.kind=p_document_kind
      AND series.financial_year_start=v_financial_year AND series.fiscal FOR UPDATE;
  IF FOUND THEN
    IF v_existing.prefix<>p_prefix THEN RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='India native fiscal series already has a different locked prefix'; END IF;
    RETURN QUERY SELECT v_existing.id,v_existing.tenant_id,v_existing.property_node,v_existing.supplier_registration_id,
      v_existing.kind,v_existing.prefix,v_existing.financial_year_start,v_existing.next_no,false;
    RETURN;
  END IF;
  -- Publication last, after authority/supplier/series locks, before allocating seq.
  PERFORM pg_catalog.pg_advisory_xact_lock(6441674055002974568::bigint);
  INSERT INTO public.document_series(tenant_id,property_node,kind,prefix,next_no,fiscal,supplier_registration_id,financial_year_start)
    VALUES(p_tenant_id,p_property_node,p_document_kind,p_prefix,1,true,p_supplier_registration_id,v_financial_year)
    RETURNING * INTO v_existing;
  v_payload:=pg_catalog.jsonb_build_object('seriesId',v_existing.id,'propertyNode',v_existing.property_node,
    'supplierRegistrationId',v_existing.supplier_registration_id,'documentKind',v_existing.kind,
    'prefix',v_existing.prefix,'financialYearStart',pg_catalog.to_char(v_existing.financial_year_start,'YYYY-MM-DD'));
  -- Generated correlation is not the service envelope's requestId (not an argument).
  v_correlation_id:=pg_catalog.gen_random_uuid();
  INSERT INTO public.fact_log(tenant_id,entity_type,entity_id,fact_type,valid_from,business_date,actor_id,payload)
    VALUES(p_tenant_id,'document_series',v_existing.id,'configured',pg_catalog.transaction_timestamp(),v_issue_date,p_actor_id,v_payload);
  INSERT INTO public.outbox(tenant_id,property_node,business_date,aggregate_type,aggregate_id,event_type,event_version,
    actor_id,correlation_id,causation_id,payload)
    VALUES(p_tenant_id,p_property_node,v_issue_date,'document_series',v_existing.id,'document.series.configured',1,
      p_actor_id,v_correlation_id,NULL,v_payload);
  RETURN QUERY SELECT v_existing.id,v_existing.tenant_id,v_existing.property_node,v_existing.supplier_registration_id,
    v_existing.kind,v_existing.prefix,v_existing.financial_year_start,v_existing.next_no,true;
END;
$$;
ALTER FUNCTION public.create_india_native_fiscal_series(uuid,uuid,uuid,text,text,uuid) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.create_india_native_fiscal_series(uuid,uuid,uuid,text,text,uuid) FROM PUBLIC,app_role,yellow_runtime;
GRANT EXECUTE ON FUNCTION public.create_india_native_fiscal_series(uuid,uuid,uuid,text,text,uuid) TO app_role;
DO $capability_acl$
DECLARE p pg_catalog.pg_proc%ROWTYPE;
BEGIN
  SELECT * INTO STRICT p FROM pg_catalog.pg_proc
    WHERE oid='public.create_india_native_fiscal_series(uuid,uuid,uuid,text,text,uuid)'::regprocedure;
  IF p.proowner IS DISTINCT FROM 'yellow_owner'::regrole
      OR NOT pg_catalog.has_function_privilege('yellow_owner',p.oid,'EXECUTE')
      OR NOT pg_catalog.has_function_privilege('app_role',p.oid,'EXECUTE')
      OR pg_catalog.has_function_privilege('yellow_runtime',p.oid,'EXECUTE')
      OR EXISTS(SELECT 1 FROM pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
        WHERE a.privilege_type<>'EXECUTE' OR a.is_grantable OR a.grantee NOT IN (p.proowner,'app_role'::regrole::oid)) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='series configuration capability ACL differs';
  END IF;
END $capability_acl$;
RESET ROLE;
