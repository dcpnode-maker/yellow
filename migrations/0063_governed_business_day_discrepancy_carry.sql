-- Order 351: four-eyes carry of one unresolved room discrepancy to the
-- property's already-open current business day.

INSERT INTO public.permission(code,description) VALUES
 ('financials.business-day:carry-discrepancy','Carry an unresolved discrepancy to the current open business day'),
 ('financials.business-day:approve-discrepancy-carry','Approve a discrepancy carry')
ON CONFLICT (code) DO NOTHING;

ALTER TABLE public.discrepancy ADD CONSTRAINT discrepancy_tenant_id_id_uq UNIQUE(tenant_id,id);

CREATE TABLE public.business_day_discrepancy_carry(
 tenant_id uuid NOT NULL,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 request_id uuid NOT NULL,
 property_node uuid NOT NULL,
 source_discrepancy_id uuid NOT NULL,
 target_discrepancy_id uuid NOT NULL,
 source_business_date date NOT NULL,
 target_business_date date NOT NULL,
 target_opened_at timestamptz NOT NULL,
 space_id uuid NOT NULL,
 discrepancy_state_hash text NOT NULL CHECK(discrepancy_state_hash ~ '^[0-9a-f]{64}$'),
 reason text NOT NULL CHECK(length(reason) BETWEEN 1 AND 500),
 request_hash text NOT NULL CHECK(request_hash ~ '^[0-9a-f]{64}$'),
 approval_request_id uuid NOT NULL,
 requested_by uuid NOT NULL,
 approved_by uuid NOT NULL CHECK(approved_by<>requested_by),
 approval_requested_at timestamptz NOT NULL,
 approval_decided_at timestamptz NOT NULL,
 carried_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
 resolution text NOT NULL DEFAULT 'carried_forward' CHECK(resolution='carried_forward'),
 PRIMARY KEY(tenant_id,id),
 UNIQUE(tenant_id,request_id), UNIQUE(tenant_id,source_discrepancy_id),
 UNIQUE(tenant_id,target_discrepancy_id), UNIQUE(tenant_id,approval_request_id),
 FOREIGN KEY(tenant_id,source_discrepancy_id) REFERENCES public.discrepancy(tenant_id,id),
 FOREIGN KEY(tenant_id,target_discrepancy_id) REFERENCES public.discrepancy(tenant_id,id),
 FOREIGN KEY(tenant_id,property_node,source_business_date) REFERENCES public.business_day(tenant_id,property_node,business_date),
 FOREIGN KEY(tenant_id,property_node,target_business_date) REFERENCES public.business_day(tenant_id,property_node,business_date),
 FOREIGN KEY(tenant_id,approval_request_id) REFERENCES public.approval_request(tenant_id,id)
);
CREATE INDEX business_day_discrepancy_carry_property_date
 ON public.business_day_discrepancy_carry(tenant_id,property_node,target_business_date,id);
ALTER TABLE public.business_day_discrepancy_carry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_day_discrepancy_carry FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON public.business_day_discrepancy_carry
 USING(tenant_id=current_setting('app.tenant_id',true)::uuid)
 WITH CHECK(tenant_id=current_setting('app.tenant_id',true)::uuid);
ALTER TABLE public.business_day_discrepancy_carry OWNER TO yellow_owner;
REVOKE ALL ON public.business_day_discrepancy_carry FROM PUBLIC,app_role,yellow_runtime;
GRANT SELECT ON public.business_day_discrepancy_carry TO app_role;

CREATE FUNCTION public.prepare_business_day_discrepancy_carry(
 p_tenant uuid,p_property uuid,p_discrepancy uuid,p_source date,p_target date,
 p_reason text,p_request uuid,p_actor uuid
) RETURNS TABLE(discrepancy_state_hash text,request_hash text,approval_payload jsonb)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_context uuid; v_d public.discrepancy%ROWTYPE; v_target public.business_day%ROWTYPE;
 v_lineage record; v_state text; v_hash text; v_reason text; v_tz text;
BEGIN
 IF session_user<>'yellow_runtime' OR current_setting('role',true) IS DISTINCT FROM 'app_role' OR current_user<>'yellow_owner' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='discrepancy carry requires governed runtime'; END IF;
 BEGIN v_context:=nullif(current_setting('app.tenant_id',true),'')::uuid; EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='invalid tenant context'; END;
 v_reason:=btrim(p_reason);
 IF v_context IS NULL OR v_context<>p_tenant OR p_source=p_target OR v_reason IS DISTINCT FROM p_reason OR length(v_reason) NOT BETWEEN 1 AND 500 OR v_reason ~ '[[:cntrl:]]' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid discrepancy carry request'; END IF;
 PERFORM 1 FROM public.app_user u JOIN public.user_role ur ON ur.tenant_id=u.tenant_id AND ur.user_id=u.id JOIN public.role_permission rp ON rp.role_id=ur.role_id AND rp.permission_code='financials.business-day:carry-discrepancy' JOIN public.org_node g ON g.tenant_id=ur.tenant_id AND g.id=ur.scope_node JOIN public.org_node property ON property.tenant_id=u.tenant_id AND property.id=p_property AND property.kind='property' AND g.path @> property.path WHERE u.tenant_id=p_tenant AND u.id=p_actor AND u.status='active';
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='discrepancy carry actor is unauthorized'; END IF;
 SELECT timezone INTO v_tz FROM public.org_node WHERE tenant_id=p_tenant AND id=p_property;
 IF v_tz IS NULL OR p_target<>(transaction_timestamp() AT TIME ZONE v_tz)::date THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='target is not the current property business date'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('discrepancy-carry:'||p_tenant||':'||p_discrepancy,351));
 SELECT d.* INTO v_d FROM public.discrepancy d JOIN public.space s ON s.tenant_id=d.tenant_id AND s.id=d.space_id AND s.property_node=p_property WHERE d.tenant_id=p_tenant AND d.id=p_discrepancy AND d.resolved_at IS NULL FOR UPDATE OF d;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='source discrepancy unavailable'; END IF;
 SELECT o.business_date,o.property_node,count(*) OVER() n INTO v_lineage FROM public.outbox o WHERE o.tenant_id=p_tenant AND o.aggregate_type='discrepancy' AND o.aggregate_id=p_discrepancy AND o.event_type='discrepancy.reported';
 IF NOT FOUND OR v_lineage.n<>1 OR v_lineage.property_node<>p_property OR v_lineage.business_date<>p_source THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='canonical discrepancy lineage unavailable'; END IF;
 PERFORM 1 FROM public.business_day WHERE tenant_id=p_tenant AND property_node=p_property AND business_date=p_source AND sealed_at IS NULL FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='source day unavailable'; END IF;
 SELECT * INTO v_target FROM public.business_day WHERE tenant_id=p_tenant AND property_node=p_property AND business_date=p_target AND sealed_at IS NULL FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='target day unavailable'; END IF;
 v_state:=encode(digest(jsonb_build_object('v',1,'tenantId',p_tenant,'discrepancyId',v_d.id,'spaceId',v_d.space_id,'reported',v_d.reported,'systemState',v_d.system_state,'reportedBy',v_d.reported_by,'reportedAt',v_d.reported_at,'resolvedAt',NULL)::text,'sha256'),'hex');
 v_hash:=encode(digest(jsonb_build_object('v',1,'tenantId',p_tenant,'propertyNode',p_property,'discrepancyId',p_discrepancy,'sourceBusinessDate',p_source,'targetBusinessDate',p_target,'reason',v_reason,'discrepancyStateHash',v_state,'targetOpenedAt',v_target.opened_at)::text,'sha256'),'hex');
 RETURN QUERY SELECT v_state,v_hash,jsonb_build_object('propertyNode',p_property::text,'sourceDiscrepancyId',p_discrepancy::text,'sourceBusinessDate',p_source::text,'targetBusinessDate',p_target::text,'reason',v_reason,'discrepancyStateHash',v_state,'requestHash',v_hash,'targetOpenedAt',to_char(v_target.opened_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'));
END $$;

CREATE FUNCTION public.carry_business_day_discrepancy(p_tenant uuid,p_approval uuid,p_expected_hash text,p_request uuid,p_actor uuid)
RETURNS TABLE(carry_id uuid,source_discrepancy_id uuid,target_discrepancy_id uuid,property_node uuid,source_business_date date,target_business_date date,resolution text,request_hash text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE a public.approval_request%ROWTYPE; d public.discrepancy%ROWTYPE; t public.business_day%ROWTYPE; v_property uuid; v_source date; v_target date; v_space uuid; v_reason text; v_state text; v_hash text; v_new uuid; v_carry uuid; v_tz text; v_lineage record;
BEGIN
 IF session_user<>'yellow_runtime' OR current_setting('role',true) IS DISTINCT FROM 'app_role' OR current_user<>'yellow_owner' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='discrepancy carry requires governed runtime'; END IF;
 IF nullif(current_setting('app.tenant_id',true),'')::uuid IS DISTINCT FROM p_tenant OR p_expected_hash !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='invalid discrepancy carry context'; END IF;
 SELECT * INTO a FROM public.approval_request WHERE tenant_id=p_tenant AND id=p_approval FOR UPDATE;
 IF NOT FOUND OR a.kind<>'business_day_discrepancy_carry' OR a.subject_type<>'discrepancy' OR a.status<>'approved' OR a.requested_by<>p_actor OR a.decided_by IS NULL OR a.decided_by=p_actor OR a.decided_at IS NULL OR transaction_timestamp()>=a.created_at+interval '30 minutes' OR a.decided_at>=a.created_at+interval '30 minutes' OR a.payload->>'requestHash'<>p_expected_hash THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='exact discrepancy carry approval unavailable'; END IF;
 v_property:=(a.payload->>'propertyNode')::uuid; v_source:=(a.payload->>'sourceBusinessDate')::date; v_target:=(a.payload->>'targetBusinessDate')::date; v_reason:=a.payload->>'reason';
 PERFORM 1 FROM public.app_user u JOIN public.user_role ur ON ur.tenant_id=u.tenant_id AND ur.user_id=u.id JOIN public.role_permission rp ON rp.role_id=ur.role_id AND rp.permission_code='financials.business-day:carry-discrepancy' JOIN public.org_node g ON g.tenant_id=ur.tenant_id AND g.id=ur.scope_node JOIN public.org_node property ON property.tenant_id=u.tenant_id AND property.id=v_property AND g.path @> property.path WHERE u.tenant_id=p_tenant AND u.id=p_actor AND u.status='active'; IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='requester unauthorized'; END IF;
 PERFORM 1 FROM public.app_user u JOIN public.user_role ur ON ur.tenant_id=u.tenant_id AND ur.user_id=u.id JOIN public.role_permission rp ON rp.role_id=ur.role_id AND rp.permission_code='financials.business-day:approve-discrepancy-carry' JOIN public.org_node g ON g.tenant_id=ur.tenant_id AND g.id=ur.scope_node JOIN public.org_node property ON property.tenant_id=u.tenant_id AND property.id=v_property AND g.path @> property.path WHERE u.tenant_id=p_tenant AND u.id=a.decided_by AND u.status='active'; IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='approver unauthorized'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('discrepancy-carry:'||p_tenant||':'||a.subject_id,351));
 SELECT x.* INTO d FROM public.discrepancy x JOIN public.space s ON s.tenant_id=x.tenant_id AND s.id=x.space_id AND s.property_node=v_property WHERE x.tenant_id=p_tenant AND x.id=a.subject_id AND x.resolved_at IS NULL FOR UPDATE OF x; IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='source discrepancy stale'; END IF; v_space:=d.space_id;
 SELECT o.business_date,o.property_node,count(*) OVER() n INTO v_lineage FROM public.outbox o WHERE o.tenant_id=p_tenant AND o.aggregate_type='discrepancy' AND o.aggregate_id=d.id AND o.event_type='discrepancy.reported'; IF NOT FOUND OR v_lineage.n<>1 OR v_lineage.property_node<>v_property OR v_lineage.business_date<>v_source THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='canonical discrepancy lineage stale'; END IF;
 SELECT timezone INTO v_tz FROM public.org_node WHERE tenant_id=p_tenant AND id=v_property; IF v_target<>(transaction_timestamp() AT TIME ZONE v_tz)::date THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='target date stale'; END IF;
 PERFORM 1 FROM public.business_day source_day WHERE source_day.tenant_id=p_tenant AND source_day.property_node=v_property AND source_day.business_date=v_source AND source_day.sealed_at IS NULL FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='source day stale'; END IF;
 SELECT target_day.* INTO t FROM public.business_day target_day WHERE target_day.tenant_id=p_tenant AND target_day.property_node=v_property AND target_day.business_date=v_target AND target_day.sealed_at IS NULL FOR UPDATE; IF NOT FOUND OR to_char(t.opened_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')<>a.payload->>'targetOpenedAt' THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='target day stale'; END IF;
 v_state:=encode(digest(jsonb_build_object('v',1,'tenantId',p_tenant,'discrepancyId',d.id,'spaceId',d.space_id,'reported',d.reported,'systemState',d.system_state,'reportedBy',d.reported_by,'reportedAt',d.reported_at,'resolvedAt',NULL)::text,'sha256'),'hex');
 v_hash:=encode(digest(jsonb_build_object('v',1,'tenantId',p_tenant,'propertyNode',v_property,'discrepancyId',d.id,'sourceBusinessDate',v_source,'targetBusinessDate',v_target,'reason',v_reason,'discrepancyStateHash',v_state,'targetOpenedAt',t.opened_at)::text,'sha256'),'hex');
 IF v_state<>a.payload->>'discrepancyStateHash' OR v_hash<>p_expected_hash OR a.payload<>jsonb_build_object('propertyNode',v_property::text,'sourceDiscrepancyId',d.id::text,'sourceBusinessDate',v_source::text,'targetBusinessDate',v_target::text,'reason',v_reason,'discrepancyStateHash',v_state,'requestHash',v_hash,'targetOpenedAt',to_char(t.opened_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')) THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='approval binding stale'; END IF;
 UPDATE public.discrepancy SET resolved_at=transaction_timestamp(),resolution='carried_forward' WHERE tenant_id=p_tenant AND id=d.id AND resolved_at IS NULL;
 INSERT INTO public.discrepancy(tenant_id,space_id,reported,system_state,reported_by,reported_at) VALUES(p_tenant,v_space,d.reported,d.system_state,p_actor,transaction_timestamp()) RETURNING id INTO v_new;
 INSERT INTO public.business_day_discrepancy_carry(tenant_id,request_id,property_node,source_discrepancy_id,target_discrepancy_id,source_business_date,target_business_date,target_opened_at,space_id,discrepancy_state_hash,reason,request_hash,approval_request_id,requested_by,approved_by,approval_requested_at,approval_decided_at) VALUES(p_tenant,p_request,v_property,d.id,v_new,v_source,v_target,t.opened_at,v_space,v_state,v_reason,v_hash,p_approval,p_actor,a.decided_by,a.created_at,a.decided_at) RETURNING id INTO v_carry;
 RETURN QUERY SELECT v_carry,d.id,v_new,v_property,v_source,v_target,'carried_forward'::text,v_hash;
END $$;

ALTER FUNCTION public.prepare_business_day_discrepancy_carry(uuid,uuid,uuid,date,date,text,uuid,uuid) OWNER TO yellow_owner;
ALTER FUNCTION public.carry_business_day_discrepancy(uuid,uuid,text,uuid,uuid) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.prepare_business_day_discrepancy_carry(uuid,uuid,uuid,date,date,text,uuid,uuid) FROM PUBLIC,app_role,yellow_runtime;
REVOKE ALL ON FUNCTION public.carry_business_day_discrepancy(uuid,uuid,text,uuid,uuid) FROM PUBLIC,app_role,yellow_runtime;
GRANT EXECUTE ON FUNCTION public.prepare_business_day_discrepancy_carry(uuid,uuid,uuid,date,date,text,uuid,uuid) TO app_role;
GRANT EXECUTE ON FUNCTION public.carry_business_day_discrepancy(uuid,uuid,text,uuid,uuid) TO app_role;
