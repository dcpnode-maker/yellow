-- Order593: persisted proposals are not work; confirmation alone creates a task.
DO $precondition$
BEGIN
  IF (SELECT pg_catalog.count(*) FROM public.schema_migration) IS DISTINCT FROM 98::bigint
     OR (SELECT pg_catalog.max(version) FROM public.schema_migration) IS DISTINCT FROM 98 THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'governed departure service coordination requires canonical migration 98';
  END IF;
END $precondition$;

INSERT INTO public.permission(code, description) VALUES
 ('stay-operations.departure-services:read','Read governed departure service coordination work'),
 ('stay-operations.departure-services:request','Propose a governed departure service request'),
 ('stay-operations.departure-services:confirm','Confirm a governed departure service proposal'),
 ('stay-operations.departure-services:dispatch','Assign governed departure service work to active property staff'),
 ('stay-operations.departure-services:work','Start and complete governed departure service work'),
 ('stay-operations.departure-services:escalate','Escalate governed departure service work to a configured duty role')
ON CONFLICT (code) DO NOTHING;

CREATE UNIQUE INDEX departure_reservation_parent ON public.reservation(tenant_id,property_node,id);
CREATE UNIQUE INDEX departure_segment_parent ON public.reservation_segment(tenant_id,reservation_id,id);
CREATE UNIQUE INDEX departure_space_parent ON public.space(tenant_id,property_node,id);
CREATE UNIQUE INDEX departure_role_parent ON public.role(tenant_id,id);
CREATE UNIQUE INDEX departure_task_parent ON public.task(tenant_id,property_node,id);
CREATE UNIQUE INDEX departure_actor_parent ON public.app_user(tenant_id,id);
CREATE TABLE public.departure_service_request (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL,
 property_node uuid NOT NULL,
 reservation_id uuid NOT NULL,
 segment_id uuid NOT NULL,
 space_id uuid NOT NULL,
 departure_at timestamptz NOT NULL,
 service_kind text NOT NULL CHECK(service_kind IN ('luggage_pickup','minibar_check','room_inspection','escalation')),
 parent_request_id uuid,
 target_role_id uuid NOT NULL,
 schedule_mode text NOT NULL CHECK(schedule_mode IN ('immediate','delay','custom')),
 due_at timestamptz NOT NULL,
 proposal_status text NOT NULL DEFAULT 'pending' CHECK(proposal_status IN ('pending','confirmed','withdrawn')),
 version integer NOT NULL DEFAULT 1 CHECK(version > 0),
 expires_at timestamptz NOT NULL,
 proposed_by uuid NOT NULL,
 confirmed_by uuid,
 confirmed_at timestamptz,
 task_id uuid,
 outcome text CHECK(outcome IN ('clear','finding_reported','unable_to_complete')),
 created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
 UNIQUE(tenant_id,property_node,reservation_id,id),
 UNIQUE(tenant_id,task_id),
 FOREIGN KEY(tenant_id,property_node,reservation_id) REFERENCES public.reservation(tenant_id,property_node,id),
 FOREIGN KEY(tenant_id,reservation_id,segment_id) REFERENCES public.reservation_segment(tenant_id,reservation_id,id),
 FOREIGN KEY(tenant_id,property_node,space_id) REFERENCES public.space(tenant_id,property_node,id),
 FOREIGN KEY(tenant_id,target_role_id) REFERENCES public.role(tenant_id,id),
 FOREIGN KEY(tenant_id,property_node,task_id) REFERENCES public.task(tenant_id,property_node,id),
 FOREIGN KEY(tenant_id,proposed_by) REFERENCES public.app_user(tenant_id,id),
 FOREIGN KEY(tenant_id,confirmed_by) REFERENCES public.app_user(tenant_id,id),
 FOREIGN KEY(tenant_id,property_node,reservation_id,parent_request_id)
   REFERENCES public.departure_service_request(tenant_id,property_node,reservation_id,id),
 CHECK((service_kind='escalation') = (parent_request_id IS NOT NULL)),
 CHECK((proposal_status='confirmed') = (task_id IS NOT NULL)),
 CHECK((proposal_status='confirmed') = (confirmed_at IS NOT NULL AND confirmed_by IS NOT NULL)),
 CHECK(outcome IS NULL OR (proposal_status='confirmed' AND service_kind IN ('minibar_check','room_inspection')))
);
CREATE UNIQUE INDEX departure_service_episode ON public.departure_service_request(tenant_id,reservation_id,segment_id,service_kind)
 WHERE proposal_status <> 'withdrawn' AND parent_request_id IS NULL;
CREATE UNIQUE INDEX departure_service_escalation ON public.departure_service_request(tenant_id,parent_request_id,target_role_id)
 WHERE proposal_status <> 'withdrawn' AND parent_request_id IS NOT NULL;
CREATE INDEX departure_service_queue ON public.departure_service_request(tenant_id,property_node,target_role_id,proposal_status,due_at,id);
ALTER TABLE public.departure_service_request OWNER TO yellow_owner;
ALTER TABLE public.departure_service_request ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departure_service_request FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON public.departure_service_request
 USING(tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid);
REVOKE ALL ON public.departure_service_request FROM PUBLIC,app_role,yellow_runtime;
GRANT SELECT ON public.departure_service_request TO app_role;
REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON public.task FROM app_role,yellow_runtime;

-- Called before and after the idempotency receipt lock, including replay.
CREATE FUNCTION public.assert_departure_service_authority(p_tenant uuid,p_property uuid,p_actor uuid,p_permission text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_path public.ltree;
BEGIN
 IF session_user <> 'yellow_runtime' OR current_setting('role',true) IS DISTINCT FROM 'app_role'
    OR current_user <> 'yellow_owner' OR p_tenant IS NULL
    OR nullif(current_setting('app.tenant_id',true),'')::uuid IS DISTINCT FROM p_tenant
    OR p_permission NOT IN ('read','request','confirm','dispatch','work','escalate') OR p_permission IS NULL THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='departure service authority unavailable';
 END IF;
 SELECT path INTO v_path FROM public.org_node WHERE tenant_id=p_tenant AND id=p_property AND kind='property';
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='departure service authority unavailable'; END IF;
 PERFORM 1 FROM public.tenant ten
 JOIN public.app_user actor ON actor.tenant_id=ten.id AND actor.id=p_actor AND actor.status='active'
 JOIN public.user_role membership ON membership.tenant_id=ten.id AND membership.user_id=actor.id
 JOIN public.role duty ON duty.tenant_id=ten.id AND duty.id=membership.role_id
 JOIN public.role_permission permission ON permission.role_id=duty.id
   AND permission.permission_code='stay-operations.departure-services:'||p_permission
 JOIN public.org_node scope ON scope.tenant_id=ten.id AND scope.id=membership.scope_node AND scope.path @> v_path
 WHERE ten.id=p_tenant AND ten.status='active'
 ORDER BY duty.id,scope.id LIMIT 1
 FOR SHARE OF ten,actor,membership,duty,permission,scope;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='departure service authority unavailable'; END IF;
END $$;
ALTER FUNCTION public.assert_departure_service_authority(uuid,uuid,uuid,text) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.assert_departure_service_authority(uuid,uuid,uuid,text) FROM PUBLIC,app_role,yellow_runtime;
GRANT EXECUTE ON FUNCTION public.assert_departure_service_authority(uuid,uuid,uuid,text) TO app_role;

-- Private helper: caller has locked the reservation and its segments first.
CREATE FUNCTION public.departure_service_evidence(p_tenant uuid,p_property uuid,p_reservation uuid)
RETURNS TABLE(segment_id uuid,space_id uuid,departure_at timestamptz)
LANGUAGE sql STABLE SET search_path=pg_catalog,public,pg_temp AS $$
 WITH segments AS MATERIALIZED (
 SELECT s.* FROM public.reservation_segment s
 JOIN public.reservation r ON r.tenant_id=s.tenant_id AND r.id=s.reservation_id
 WHERE s.tenant_id=p_tenant AND r.property_node=p_property AND r.id=p_reservation
   AND r.status IN ('in_house','due_out') AND s.status='in_house'
 ), rooms AS MATERIALIZED (
 SELECT s.id segment_id,s.period,sp.id space_id FROM segments s
 JOIN public.sellable_unit u ON u.tenant_id=p_tenant AND u.id=s.sellable_unit_id AND u.status='active'
 JOIN public.sellable_unit_space m ON m.tenant_id=p_tenant AND m.sellable_unit_id=u.id
 JOIN public.space sp ON sp.tenant_id=p_tenant AND sp.id=m.space_id AND sp.property_node=p_property AND sp.status='active'
 WHERE (SELECT count(*) FROM segments)=1
 ), occupied AS MATERIALIZED (
 SELECT r.* FROM rooms r JOIN public.space_occupancy o ON o.tenant_id=p_tenant AND o.space_id=r.space_id
 AND o.slot_kind='segment' AND o.slot_ref=r.segment_id AND o.exclusive AND o.period=r.period
 WHERE (SELECT count(*) FROM rooms)=1
 ) SELECT segment_id,space_id,upper(period) FROM occupied WHERE (SELECT count(*) FROM occupied)=1
$$;
ALTER FUNCTION public.departure_service_evidence(uuid,uuid,uuid) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.departure_service_evidence(uuid,uuid,uuid) FROM PUBLIC,app_role,yellow_runtime;

CREATE FUNCTION public.read_departure_service_evidence(p_tenant uuid,p_property uuid,p_reservation uuid,p_actor uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_result jsonb;
BEGIN
 PERFORM public.assert_departure_service_authority(p_tenant,p_property,p_actor,'read');
 SELECT jsonb_build_object('segmentId',segment_id,'spaceId',space_id,
  'departureAt',to_char(departure_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'))
 INTO v_result FROM public.departure_service_evidence(p_tenant,p_property,p_reservation);
 RETURN v_result;
END $$;
ALTER FUNCTION public.read_departure_service_evidence(uuid,uuid,uuid,uuid) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.read_departure_service_evidence(uuid,uuid,uuid,uuid) FROM PUBLIC,app_role,yellow_runtime;
GRANT EXECUTE ON FUNCTION public.read_departure_service_evidence(uuid,uuid,uuid,uuid) TO app_role;

CREATE FUNCTION public.command_departure_service(
 p_tenant uuid,p_property uuid,p_reservation uuid,p_request uuid,p_actor uuid,p_correlation uuid,p_action text,p_input jsonb
) RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE
 v_request public.departure_service_request%ROWTYPE; v_parent public.departure_service_request%ROWTYPE;
 v_task public.task%ROWTYPE; v_evidence record; v_role uuid; v_kind text; v_permission text;
 v_now timestamptz; v_due timestamptz; v_zone text; v_mode text; v_version integer;
 v_local timestamp; v_minutes integer; v_offset integer; v_staff uuid; v_outcome text;
 v_previous text; v_event text; v_fact uuid; v_payload jsonb; v_body_keys text[];
BEGIN
 v_permission := CASE p_action WHEN 'propose' THEN CASE WHEN p_input->>'serviceKind'='escalation' THEN 'escalate' ELSE 'request' END
 WHEN 'confirm' THEN 'confirm' WHEN 'withdraw' THEN 'request' WHEN 'assign' THEN 'dispatch'
 WHEN 'start' THEN 'work' WHEN 'complete' THEN 'work' END;
 PERFORM public.assert_departure_service_authority(p_tenant,p_property,p_actor,v_permission);
 IF p_correlation IS NULL OR p_reservation IS NULL OR jsonb_typeof(p_input) IS DISTINCT FROM 'object' THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='departure service input invalid'; END IF;
 -- Shared lock order with checkout and room/departure changes.
 PERFORM 1 FROM public.reservation WHERE tenant_id=p_tenant AND property_node=p_property AND id=p_reservation FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='departure service target unavailable'; END IF;
 PERFORM 1 FROM public.reservation_segment WHERE tenant_id=p_tenant AND reservation_id=p_reservation ORDER BY seq,id FOR UPDATE;
 SELECT timezone INTO v_zone FROM public.org_node WHERE tenant_id=p_tenant AND id=p_property AND kind='property';
 v_now := clock_timestamp(); -- evaluate expiry after waiting for parent locks
 SELECT array_agg(k ORDER BY k) INTO v_body_keys FROM jsonb_object_keys(p_input) k;
 IF p_action='propose' THEN
  IF p_request IS NOT NULL OR v_body_keys IS DISTINCT FROM ARRAY['expected','parentRequestId','schedule','serviceKind','targetRoleId'] THEN
   RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='departure service proposal invalid'; END IF;
  IF jsonb_typeof(p_input->'expected') IS DISTINCT FROM 'object' OR jsonb_typeof(p_input->'schedule') IS DISTINCT FROM 'object'
   OR jsonb_typeof(p_input->'serviceKind') IS DISTINCT FROM 'string' OR jsonb_typeof(p_input->'targetRoleId') IS DISTINCT FROM 'string'
   OR jsonb_typeof(p_input->'parentRequestId') NOT IN ('null','string') THEN
   RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='departure service proposal shape invalid'; END IF;
  SELECT array_agg(k ORDER BY k) INTO v_body_keys FROM jsonb_object_keys(p_input->'expected') k;
  IF v_body_keys IS DISTINCT FROM ARRAY['departureAt','segmentId','spaceId']
   OR jsonb_typeof(p_input#>'{expected,segmentId}') IS DISTINCT FROM 'string'
   OR jsonb_typeof(p_input#>'{expected,spaceId}') IS DISTINCT FROM 'string'
   OR jsonb_typeof(p_input#>'{expected,departureAt}') IS DISTINCT FROM 'string' THEN
   RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='departure service expected shape invalid'; END IF;
  SELECT array_agg(k ORDER BY k) INTO v_body_keys FROM jsonb_object_keys(p_input->'schedule') k;
  IF v_body_keys IS DISTINCT FROM ARRAY['localAt','minutes','mode','utcOffsetMinutes']
   OR jsonb_typeof(p_input#>'{schedule,mode}') IS DISTINCT FROM 'string'
   OR jsonb_typeof(p_input#>'{schedule,minutes}') NOT IN ('null','number')
   OR jsonb_typeof(p_input#>'{schedule,localAt}') NOT IN ('null','string')
   OR jsonb_typeof(p_input#>'{schedule,utcOffsetMinutes}') NOT IN ('null','number') THEN
   RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='departure service schedule shape invalid'; END IF;
  v_kind:=p_input->>'serviceKind'; v_role:=(p_input->>'targetRoleId')::uuid;
  IF v_kind IS NULL OR v_kind NOT IN ('luggage_pickup','minibar_check','room_inspection','escalation') THEN
   RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='departure service kind invalid'; END IF;
  SELECT * INTO v_evidence FROM public.departure_service_evidence(p_tenant,p_property,p_reservation);
  IF NOT FOUND OR v_evidence.segment_id IS DISTINCT FROM (p_input#>>'{expected,segmentId}')::uuid
   OR v_evidence.space_id IS DISTINCT FROM (p_input#>>'{expected,spaceId}')::uuid
   OR v_evidence.departure_at IS DISTINCT FROM (p_input#>>'{expected,departureAt}')::timestamptz THEN
   RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='departure service stay evidence stale'; END IF;
  IF v_kind='escalation' THEN
   SELECT * INTO v_parent FROM public.departure_service_request WHERE tenant_id=p_tenant AND property_node=p_property
    AND reservation_id=p_reservation AND id=(p_input->>'parentRequestId')::uuid FOR UPDATE;
   IF NOT FOUND OR v_parent.proposal_status <> 'confirmed' OR v_parent.service_kind='escalation'
      OR v_parent.segment_id <> v_evidence.segment_id OR v_parent.space_id <> v_evidence.space_id THEN
    RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='departure service parent unavailable'; END IF;
  ELSIF p_input->'parentRequestId' IS DISTINCT FROM 'null'::jsonb THEN
   RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='departure service parent invalid';
  END IF;
  v_mode:=p_input#>>'{schedule,mode}'; v_minutes:=(p_input#>>'{schedule,minutes}')::integer;
  v_offset:=(p_input#>>'{schedule,utcOffsetMinutes}')::integer;
  IF v_mode='immediate' AND v_minutes IS NULL AND v_offset IS NULL AND p_input#>>'{schedule,localAt}' IS NULL THEN
   v_due:=transaction_timestamp();
  ELSIF v_mode='delay' AND v_minutes IN (10,15,30,45) AND v_offset IS NULL AND p_input#>>'{schedule,localAt}' IS NULL THEN
   v_due:=v_now + make_interval(mins=>v_minutes);
  ELSIF v_mode='custom' AND v_minutes IS NULL AND v_offset BETWEEN -840 AND 840
     AND (p_input#>>'{schedule,localAt}') ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$' THEN
   v_local:=(p_input#>>'{schedule,localAt}')::timestamp;
   v_due:=(v_local AT TIME ZONE 'UTC') - make_interval(mins=>v_offset);
   IF (v_due AT TIME ZONE v_zone) IS DISTINCT FROM v_local THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='departure service local time or offset invalid'; END IF;
  ELSE RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='departure service schedule invalid'; END IF;
  IF NOT isfinite(v_due) OR NOT isfinite(v_evidence.departure_at) OR v_now>v_evidence.departure_at+interval '6 hours'
    OR v_due>v_evidence.departure_at+interval '6 hours' OR (v_mode <> 'immediate' AND v_due<=v_now) THEN
   RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='departure service schedule outside allowed interval'; END IF;
 ELSE
  IF p_request IS NULL OR v_body_keys IS DISTINCT FROM ARRAY['expectedVersion','outcome','staffPartyId'] THEN
   RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='departure service action invalid'; END IF;
  IF jsonb_typeof(p_input->'expectedVersion') IS DISTINCT FROM 'number' OR (p_input->>'expectedVersion') !~ '^[1-9][0-9]*$'
    OR jsonb_typeof(p_input->'staffPartyId') NOT IN ('null','string') OR jsonb_typeof(p_input->'outcome') NOT IN ('null','string') THEN
   RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='departure service action shape invalid'; END IF;
  SELECT * INTO v_request FROM public.departure_service_request WHERE tenant_id=p_tenant AND property_node=p_property
   AND reservation_id=p_reservation AND id=p_request FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='departure service target unavailable'; END IF;
  v_version:=(p_input->>'expectedVersion')::integer;
  IF v_version IS NULL OR v_request.version<>v_version THEN RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='departure service version stale'; END IF;
  v_role:=v_request.target_role_id; v_kind:=v_request.service_kind;
  v_staff:=(p_input->>'staffPartyId')::uuid; v_outcome:=p_input->>'outcome';
  IF (p_action <> 'assign' AND v_staff IS NOT NULL) OR (p_action <> 'complete' AND v_outcome IS NOT NULL)
   OR (p_action='assign' AND v_staff IS NULL) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='departure service action input invalid'; END IF;
 END IF;
 -- A configured duty role means a named same-tenant role with a current active
 -- colleague and exact-property membership. No fabricated user/Party mapping.
 IF p_action <> 'withdraw' THEN
  PERFORM 1 FROM public.role duty
  JOIN public.role_permission permission ON permission.role_id=duty.id AND permission.permission_code='stay-operations.departure-services:read'
  JOIN public.user_role membership ON membership.tenant_id=duty.tenant_id AND membership.role_id=duty.id AND membership.scope_node=p_property
  JOIN public.app_user colleague ON colleague.tenant_id=duty.tenant_id AND colleague.id=membership.user_id AND colleague.status='active'
  WHERE duty.tenant_id=p_tenant AND duty.id=v_role AND duty.name IN
   ('Front Desk Cashier','Housekeeping Desk','Housekeeping Team Lead','Assistant Manager','Duty Manager')
  ORDER BY colleague.id LIMIT 1 FOR SHARE OF duty,permission,membership,colleague;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='departure service role unavailable'; END IF;
 END IF;
 IF p_action='propose' THEN
  INSERT INTO public.departure_service_request(tenant_id,property_node,reservation_id,segment_id,space_id,departure_at,
   service_kind,parent_request_id,target_role_id,schedule_mode,due_at,expires_at,proposed_by)
  VALUES(p_tenant,p_property,p_reservation,v_evidence.segment_id,v_evidence.space_id,v_evidence.departure_at,
   v_kind,v_parent.id,v_role,v_mode,v_due,v_now+interval '10 minutes',p_actor) RETURNING * INTO v_request;
 ELSIF p_action IN ('confirm','withdraw') THEN
  IF v_request.proposal_status <> 'pending' THEN RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='departure service proposal no longer pending'; END IF;
  IF p_action='withdraw' THEN
   UPDATE public.departure_service_request SET proposal_status='withdrawn',version=version+1 WHERE id=v_request.id RETURNING * INTO v_request;
  ELSE
   IF v_now>=v_request.expires_at THEN RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='departure service proposal expired'; END IF;
   SELECT * INTO v_evidence FROM public.departure_service_evidence(p_tenant,p_property,p_reservation);
   IF NOT FOUND OR v_evidence.segment_id<>v_request.segment_id OR v_evidence.space_id<>v_request.space_id
     OR v_evidence.departure_at<>v_request.departure_at THEN RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='departure service stay evidence stale'; END IF;
   IF v_request.service_kind='escalation' THEN
    PERFORM 1 FROM public.departure_service_request WHERE tenant_id=p_tenant AND property_node=p_property AND reservation_id=p_reservation
     AND id=v_request.parent_request_id AND proposal_status='confirmed' AND service_kind<>'escalation'
     AND segment_id=v_request.segment_id AND space_id=v_request.space_id FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='departure service escalation parent stale'; END IF;
   END IF;
   v_due:=CASE WHEN v_request.schedule_mode='immediate' THEN transaction_timestamp() ELSE v_request.due_at END;
   IF v_now>v_request.departure_at+interval '6 hours' OR v_due>v_request.departure_at+interval '6 hours'
      OR (v_request.schedule_mode<>'immediate' AND v_due<=v_now) THEN
    RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='departure service schedule stale'; END IF;
   INSERT INTO public.task(tenant_id,property_node,kind,status,subject_type,subject_id,department,due_at,priority,payload)
    VALUES(p_tenant,p_property,'guest_request','open','reservation',p_reservation,'departure_services',v_due,3,
     jsonb_build_object('requestType','departure_service','requestId',v_request.id,'serviceKind',v_request.service_kind)) RETURNING * INTO v_task;
   UPDATE public.departure_service_request SET proposal_status='confirmed',confirmed_by=p_actor,confirmed_at=v_now,
    due_at=v_due,task_id=v_task.id,version=version+1 WHERE id=v_request.id RETURNING * INTO v_request;
   v_event:='task.created';
  END IF;
 ELSE
  IF v_request.proposal_status<>'confirmed' THEN RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='departure service is not confirmed'; END IF;
  SELECT * INTO v_task FROM public.task WHERE tenant_id=p_tenant AND property_node=p_property AND id=v_request.task_id FOR UPDATE;
  IF NOT FOUND OR v_task.kind<>'guest_request' OR v_task.subject_type IS DISTINCT FROM 'reservation'
   OR v_task.subject_id IS DISTINCT FROM p_reservation OR v_task.department IS DISTINCT FROM 'departure_services'
   OR v_task.due_at IS DISTINCT FROM v_request.due_at OR v_task.payload IS DISTINCT FROM
    jsonb_build_object('requestType','departure_service','requestId',v_request.id,'serviceKind',v_request.service_kind) THEN
   RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='departure service task unavailable'; END IF;
  v_previous:=v_task.status;
  IF p_action='assign' AND v_task.status='open' AND v_task.assignee_party IS NULL AND v_task.completed_at IS NULL THEN
   PERFORM 1 FROM public.party staff JOIN public.party_role staff_role ON staff_role.tenant_id=staff.tenant_id
    AND staff_role.party_id=staff.id AND staff_role.role='staff'
    WHERE staff.tenant_id=p_tenant AND staff.id=v_staff AND staff.status='active' FOR SHARE OF staff,staff_role;
   IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='departure service staff unavailable'; END IF;
   UPDATE public.task SET status='assigned',assignee_party=v_staff WHERE id=v_task.id RETURNING * INTO v_task;
  ELSIF p_action IN ('start','complete') AND v_task.assignee_party IS NOT NULL AND v_task.completed_at IS NULL
    AND ((p_action='start' AND v_task.status='assigned') OR (p_action='complete' AND v_task.status='in_progress')) THEN
   PERFORM 1 FROM public.party staff JOIN public.party_role staff_role ON staff_role.tenant_id=staff.tenant_id
    AND staff_role.party_id=staff.id AND staff_role.role='staff'
    WHERE staff.tenant_id=p_tenant AND staff.id=v_task.assignee_party AND staff.status='active' FOR SHARE OF staff,staff_role;
   IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='departure service staff unavailable'; END IF;
   IF p_action='complete' AND ((v_kind IN ('luggage_pickup','escalation') AND v_outcome IS NOT NULL) OR
    (v_kind IN ('minibar_check','room_inspection') AND (v_outcome IS NULL OR v_outcome NOT IN ('clear','finding_reported','unable_to_complete')))) THEN
     RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='departure service outcome invalid'; END IF;
   UPDATE public.task SET status=CASE WHEN p_action='start' THEN 'in_progress' ELSE 'done' END,
    completed_at=CASE WHEN p_action='complete' THEN v_now ELSE NULL END WHERE id=v_task.id RETURNING * INTO v_task;
  ELSE RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='departure service transition stale'; END IF;
  UPDATE public.departure_service_request SET version=version+1,outcome=v_outcome WHERE id=v_request.id RETURNING * INTO v_request;
  v_event:='task.status_changed';
 END IF;
 v_payload:=jsonb_build_object('request_id',v_request.id,'reservation_id',p_reservation,'service_kind',v_kind,
  'parent_request_id',v_request.parent_request_id,'target_role_id',v_role,'action',p_action,'version',v_request.version,
  'previous_status',v_previous,'current_status',v_task.status,'outcome',v_request.outcome,'request_id_correlation',p_correlation);
 INSERT INTO public.fact_log(tenant_id,entity_type,entity_id,fact_type,valid_from,business_date,actor_id,payload)
 VALUES(p_tenant,CASE WHEN v_event IS NULL THEN 'departure_service_request' ELSE 'task' END,
  COALESCE(v_task.id,v_request.id),COALESCE(v_event,'departure_service.'||p_action),v_now,(v_now AT TIME ZONE v_zone)::date,p_actor,v_payload)
 RETURNING id INTO v_fact;
 IF v_event IS NOT NULL THEN
  PERFORM pg_advisory_xact_lock(6441674055002974568::bigint);
  INSERT INTO public.outbox(tenant_id,property_node,business_date,aggregate_type,aggregate_id,event_type,actor_id,correlation_id,causation_id,payload)
  VALUES(p_tenant,p_property,(v_now AT TIME ZONE v_zone)::date,'task',v_task.id,v_event,p_actor,p_correlation,v_fact,v_payload);
 END IF;
 RETURN v_request.id;
END $$;
ALTER FUNCTION public.command_departure_service(uuid,uuid,uuid,uuid,uuid,uuid,text,jsonb) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.command_departure_service(uuid,uuid,uuid,uuid,uuid,uuid,text,jsonb) FROM PUBLIC,app_role,yellow_runtime;
GRANT EXECUTE ON FUNCTION public.command_departure_service(uuid,uuid,uuid,uuid,uuid,uuid,text,jsonb) TO app_role;
