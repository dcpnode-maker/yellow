CREATE VIEW commercial_proto.inventory_leaf WITH(security_invoker=true)AS
SELECT tenant_id,property_id,business_date,counting_basis,rooms_available,history_status FROM commercial_proto.inventory_date;

CREATE VIEW commercial_proto.actual_night_leaf WITH(security_invoker=true)AS
SELECT a.tenant_id,a.property_id,a.reservation_id,a.business_date,a.booking_currency,
 COALESCE(msg.code,'UNMAPPED')msg_code,COALESCE(ms.code,'UNMAPPED')ms_code,
 COALESCE(a.channel_code,'UNMAPPED')channel_code,COALESCE(a.source_code,'UNMAPPED')source_code,
 COALESCE(a.company_party_id::text,'UNMAPPED')company_key,
 CASE WHEN a.company_mapping='explicit'THEN NULL ELSE upper(a.company_mapping)END company_null_reason,
 COALESCE(a.group_kind,'INDIVIDUAL')group_kind,l.room_class_code,l.unit_type_code,l.allocation_weight room_nights
FROM commercial_proto.stay_attribution a JOIN commercial_proto.stay_leg_source l
USING(tenant_id,property_id,reservation_id,business_date)
LEFT JOIN commercial_proto.demand_node msg ON msg.tenant_id=a.tenant_id AND msg.version_id=a.taxonomy_version_id AND msg.id=a.msg_id AND msg.kind='msg'
LEFT JOIN commercial_proto.demand_node ms ON ms.tenant_id=a.tenant_id AND ms.version_id=a.taxonomy_version_id AND ms.id=a.ms_id AND ms.kind='ms'
WHERE l.occupied_evidence;

CREATE VIEW commercial_proto.planned_night_leaf WITH(security_invoker=true)AS
SELECT a.tenant_id,a.property_id,a.reservation_id,a.business_date,a.booking_currency,
 COALESCE(msg.code,'UNMAPPED')msg_code,COALESCE(ms.code,'UNMAPPED')ms_code,
 COALESCE(a.channel_code,'UNMAPPED')channel_code,COALESCE(a.source_code,'UNMAPPED')source_code,
 COALESCE(a.company_party_id::text,'UNMAPPED')company_key,
 CASE WHEN a.company_mapping='explicit'THEN NULL ELSE upper(a.company_mapping)END company_null_reason,
 l.room_class_code,l.unit_type_code,l.allocation_weight room_nights
FROM commercial_proto.stay_attribution a JOIN commercial_proto.stay_leg_source l USING(tenant_id,property_id,reservation_id,business_date)
LEFT JOIN commercial_proto.demand_node msg ON msg.tenant_id=a.tenant_id AND msg.version_id=a.taxonomy_version_id AND msg.id=a.msg_id AND msg.kind='msg'
LEFT JOIN commercial_proto.demand_node ms ON ms.tenant_id=a.tenant_id AND ms.version_id=a.taxonomy_version_id AND ms.id=a.ms_id AND ms.kind='ms'
WHERE l.planned_evidence;

CREATE VIEW commercial_proto.signed_revenue_source WITH(security_invoker=true)AS
SELECT tenant_id,posting_line_id,journal_id,property_id,business_date,account_class,-amount_minor signed_revenue_minor,
 currency,quantity,reverses_journal_id FROM commercial_proto.raw_posting_line WHERE account_role='revenue';

CREATE VIEW commercial_proto.revenue_leaf WITH(security_invoker=true)AS
SELECT s.tenant_id,s.posting_line_id,s.journal_id,s.property_id,s.business_date,a.reservation_id,a.association_status,
 s.account_class,s.signed_revenue_minor,s.currency,s.quantity,s.reverses_journal_id,
 COALESCE(msg.code,'UNMAPPED')msg_code,COALESCE(ms.code,'UNMAPPED')ms_code,
 COALESCE(a.channel_code,'UNMAPPED')channel_code,COALESCE(a.source_code,'UNMAPPED')source_code,
 COALESCE(a.company_party_id::text,'UNMAPPED')company_key,
 CASE WHEN a.company_mapping='explicit'THEN NULL ELSE upper(a.company_mapping)END company_null_reason,
 COALESCE(a.room_class_code,'UNMAPPED')room_class_code,COALESCE(a.unit_type_code,'UNMAPPED')unit_type_code
FROM commercial_proto.signed_revenue_source s JOIN commercial_proto.revenue_attribution a USING(tenant_id,posting_line_id)
LEFT JOIN commercial_proto.demand_node msg ON msg.tenant_id=a.tenant_id AND msg.version_id=a.taxonomy_version_id AND msg.id=a.msg_id AND msg.kind='msg'
LEFT JOIN commercial_proto.demand_node ms ON ms.tenant_id=a.tenant_id AND ms.version_id=a.taxonomy_version_id AND ms.id=a.ms_id AND ms.kind='ms';

CREATE VIEW commercial_proto.demand_metric WITH(security_invoker=true)AS
WITH n AS(SELECT tenant_id,property_id,business_date,msg_code,ms_code,sum(room_nights)room_nights FROM commercial_proto.actual_night_leaf GROUP BY 1,2,3,4,5),
r AS(SELECT tenant_id,property_id,business_date,msg_code,ms_code,currency,sum(signed_revenue_minor)room_revenue_minor FROM commercial_proto.revenue_leaf WHERE account_class='room_revenue'GROUP BY 1,2,3,4,5,6),
k AS(SELECT n.tenant_id,n.property_id,n.business_date,n.msg_code,n.ms_code,p.base_currency currency FROM n JOIN commercial_proto.org_node p ON p.tenant_id=n.tenant_id AND p.id=n.property_id
 UNION SELECT r.tenant_id,r.property_id,r.business_date,r.msg_code,r.ms_code,r.currency FROM r),
x AS(SELECT k.*,p.base_currency,n.room_nights,COALESCE(r.room_revenue_minor,0)room_revenue_minor FROM k
 JOIN commercial_proto.org_node p ON p.tenant_id=k.tenant_id AND p.id=k.property_id
 LEFT JOIN n ON n.tenant_id=k.tenant_id AND n.property_id=k.property_id AND n.business_date=k.business_date AND n.msg_code=k.msg_code AND n.ms_code=k.ms_code AND k.currency=p.base_currency
 LEFT JOIN r ON r.tenant_id=k.tenant_id AND r.property_id=k.property_id AND r.business_date=k.business_date AND r.msg_code=k.msg_code AND r.ms_code=k.ms_code AND r.currency=k.currency)
SELECT tenant_id,property_id,business_date,msg_code,ms_code,currency,
 CASE WHEN currency=base_currency THEN COALESCE(room_nights,0)END room_nights,room_revenue_minor,
 CASE WHEN currency=base_currency AND room_nights>0 THEN round(room_revenue_minor/room_nights,4)END adr_minor,
 NULL::numeric occupancy_pct,NULL::numeric revpar_minor,
 CASE WHEN currency<>base_currency THEN'CURRENCY_PROPERTY_MISMATCH'
      WHEN COALESCE(room_nights,0)=0 THEN'ADR_NO_ACTUAL_NIGHTS'
      ELSE'DEMAND_SCOPE_HAS_NO_INVENTORY_DENOMINATOR'END null_reason
FROM x;

-- Parameterized date spine: absent inventory still returns an explicit unavailable row.
CREATE FUNCTION commercial_proto.property_day_metric_range(p_property uuid,p_from date,p_to date)
RETURNS TABLE(business_date date,counting_basis text,currency char(3),rooms_available numeric,room_nights numeric,
 revenue_minor numeric,occupancy_pct numeric,adr_minor numeric,revpar_minor numeric,null_reason text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,commercial_proto AS $$
WITH prop AS(SELECT tenant_id,id,base_currency FROM commercial_proto.org_node WHERE id=p_property AND kind='property'),
days AS(SELECT d::date business_date FROM generate_series(p_from,p_to-1,interval'1 day')d),
inv AS(SELECT i.tenant_id,i.property_id,i.business_date,count(*)basis_count,
 max(i.rooms_available)FILTER(WHERE i.counting_basis='room'AND i.history_status='known')::numeric rooms_available,
 bool_or(i.history_status<>'known')bad_history,bool_or(i.history_status='overlap_unsupported')overlap_unsupported FROM commercial_proto.inventory_date i JOIN prop p ON p.tenant_id=i.tenant_id AND p.id=i.property_id WHERE i.business_date>=p_from AND i.business_date<p_to GROUP BY 1,2,3),
n AS(SELECT x.tenant_id,x.property_id,x.business_date,sum(x.room_nights)::numeric room_nights FROM commercial_proto.actual_night_leaf x JOIN prop p ON p.tenant_id=x.tenant_id AND p.id=x.property_id WHERE x.business_date>=p_from AND x.business_date<p_to GROUP BY 1,2,3),
r AS(SELECT x.tenant_id,x.property_id,x.business_date,x.currency,sum(x.signed_revenue_minor)::numeric revenue_minor FROM commercial_proto.revenue_leaf x JOIN prop p ON p.tenant_id=x.tenant_id AND p.id=x.property_id WHERE x.account_class='room_revenue'AND x.business_date>=p_from AND x.business_date<p_to GROUP BY 1,2,3,4),
currencies AS(SELECT d.business_date,p.tenant_id,p.id property_id,p.base_currency currency FROM days d CROSS JOIN prop p UNION SELECT r.business_date,r.tenant_id,r.property_id,r.currency FROM r),
k AS(SELECT c.*,i.basis_count,i.rooms_available,i.bad_history,i.overlap_unsupported,COALESCE(n.room_nights,0)actual_nights,COALESCE(r.revenue_minor,0)revenue_minor,
 p.base_currency FROM currencies c JOIN prop p USING(tenant_id)LEFT JOIN inv i USING(tenant_id,property_id,business_date)LEFT JOIN n USING(tenant_id,property_id,business_date)LEFT JOIN r USING(tenant_id,property_id,business_date,currency))
SELECT business_date,'room'::text,currency,
 CASE WHEN currency<>base_currency OR basis_count IS DISTINCT FROM 1 OR bad_history OR rooms_available IS NULL THEN NULL ELSE rooms_available END,
 CASE WHEN currency<>base_currency OR basis_count IS DISTINCT FROM 1 OR bad_history THEN NULL ELSE actual_nights END,
 revenue_minor,
 CASE WHEN currency=base_currency AND basis_count=1 AND NOT COALESCE(bad_history,false)AND rooms_available>0 THEN round(actual_nights*100/rooms_available,4)END,
 CASE WHEN currency=base_currency AND basis_count=1 AND NOT COALESCE(bad_history,false)AND actual_nights>0 THEN round(revenue_minor/actual_nights,4)END,
 CASE WHEN currency=base_currency AND basis_count=1 AND NOT COALESCE(bad_history,false)AND rooms_available>0 THEN round(revenue_minor/rooms_available,4)END,
 CASE WHEN currency<>base_currency THEN'CURRENCY_PROPERTY_MISMATCH'
      WHEN overlap_unsupported THEN'PHYSICAL_OVERLAP_UNSUPPORTED'
      WHEN basis_count IS NULL THEN'INVENTORY_HISTORY_UNAVAILABLE'
      WHEN basis_count<>1 THEN'MIXED_COUNTING_BASES_UNSUPPORTED'
      WHEN bad_history OR rooms_available IS NULL THEN'INVENTORY_HISTORY_UNAVAILABLE'
      WHEN rooms_available=0 THEN'ZERO_INVENTORY_DENOMINATOR'END
FROM k ORDER BY business_date,currency
$$;

GRANT SELECT ON commercial_proto.inventory_leaf,commercial_proto.actual_night_leaf,commercial_proto.planned_night_leaf,
 commercial_proto.signed_revenue_source,commercial_proto.revenue_leaf,commercial_proto.demand_metric TO app_role;
GRANT EXECUTE ON FUNCTION commercial_proto.property_day_metric_range(uuid,date,date)TO app_role;
