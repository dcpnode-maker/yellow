-- Order 367: immutable, server-derived India accommodation component-tax evidence.

CREATE TABLE public.india_gst_accommodation_final_component_tax (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT pg_catalog.gen_random_uuid(),
  property_node uuid NOT NULL,
  reservation_id uuid NOT NULL,
  folio_id uuid NOT NULL,
  applicability_id uuid NOT NULL,
  valuation_id uuid NOT NULL,
  valuation_generation integer NOT NULL CHECK (valuation_generation >= 0),
  request_id uuid NOT NULL,
  generation integer NOT NULL CHECK (generation >= 0),
  currency char(3) NOT NULL CHECK (currency = 'INR'),
  transaction_value_minor bigint NOT NULL CHECK (transaction_value_minor > 0),
  tax_minor bigint NOT NULL CHECK (tax_minor >= 0),
  grand_total_minor bigint NOT NULL CHECK (grand_total_minor > 0),
  component_family text NOT NULL CHECK (component_family IN ('igst','cgst_sgst','cgst_utgst')),
  selected_version_side text NOT NULL CHECK (selected_version_side IN ('predecessor','successor')),
  selected_extension_id uuid NOT NULL,
  selected_extension_version smallint NOT NULL CHECK (selected_extension_version IN (1,2)),
  final_valuation_evidence_hash text NOT NULL CHECK (final_valuation_evidence_hash ~ '^[0-9a-f]{64}$'),
  quoted_rate_applicability_evidence_hash text NOT NULL CHECK (quoted_rate_applicability_evidence_hash ~ '^[0-9a-f]{64}$'),
  section14_evidence_hash text NOT NULL CHECK (section14_evidence_hash ~ '^[0-9a-f]{64}$'),
  levy_component_identity_evidence_hash text NOT NULL CHECK (levy_component_identity_evidence_hash ~ '^[0-9a-f]{64}$'),
  reservation_lineage_evidence_hash text NOT NULL CHECK (reservation_lineage_evidence_hash ~ '^[0-9a-f]{64}$'),
  attribution_snapshot_evidence_hash text NOT NULL CHECK (attribution_snapshot_evidence_hash ~ '^[0-9a-f]{64}$'),
  evidence_hash text NOT NULL CHECK (evidence_hash ~ '^[0-9a-f]{64}$'),
  supersedes_tax_id uuid,
  supersedes_tax_evidence_hash text CHECK (supersedes_tax_evidence_hash IS NULL OR supersedes_tax_evidence_hash ~ '^[0-9a-f]{64}$'),
  actor_id uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT pg_catalog.transaction_timestamp(),
  PRIMARY KEY (tenant_id,id),
  UNIQUE (tenant_id,id,evidence_hash),
  UNIQUE (tenant_id,request_id),
  UNIQUE (tenant_id,evidence_hash),
  UNIQUE (tenant_id,reservation_id,folio_id,generation),
  UNIQUE (tenant_id,valuation_id),
  UNIQUE (tenant_id,supersedes_tax_id),
  CHECK (grand_total_minor::numeric = transaction_value_minor::numeric + tax_minor::numeric),
  CHECK ((generation=0 AND supersedes_tax_id IS NULL AND supersedes_tax_evidence_hash IS NULL)
      OR (generation>0 AND supersedes_tax_id IS NOT NULL AND supersedes_tax_evidence_hash IS NOT NULL)),
  FOREIGN KEY (tenant_id,property_node) REFERENCES public.org_node(tenant_id,id),
  FOREIGN KEY (tenant_id,reservation_id) REFERENCES public.reservation(tenant_id,id),
  FOREIGN KEY (tenant_id,folio_id) REFERENCES public.folio(tenant_id,id),
  FOREIGN KEY (tenant_id,applicability_id) REFERENCES public.india_gst_accommodation_quoted_rate_applicability(tenant_id,id),
  FOREIGN KEY (tenant_id,valuation_id) REFERENCES public.india_gst_accommodation_final_valuation(tenant_id,id),
  FOREIGN KEY (tenant_id,supersedes_tax_id,supersedes_tax_evidence_hash)
    REFERENCES public.india_gst_accommodation_final_component_tax(tenant_id,id,evidence_hash),
  FOREIGN KEY (tenant_id,actor_id) REFERENCES public.app_user(tenant_id,id)
);
CREATE INDEX india_gst_final_component_tax_scope
  ON public.india_gst_accommodation_final_component_tax(tenant_id,property_node,reservation_id,folio_id,generation DESC);

CREATE TABLE public.india_gst_accommodation_final_component_tax_room_night (
  tenant_id uuid NOT NULL,
  tax_id uuid NOT NULL,
  ordinal integer NOT NULL CHECK (ordinal BETWEEN 0 AND 365),
  business_date date NOT NULL,
  final_value_minor bigint NOT NULL CHECK (final_value_minor > 0),
  currency char(3) NOT NULL CHECK (currency = 'INR'),
  slab_upto_minor bigint CHECK (slab_upto_minor IS NULL OR slab_upto_minor = 750000),
  aggregate_rate_basis_points integer NOT NULL CHECK (aggregate_rate_basis_points IN (500,1200,1800)),
  itc_eligible boolean NOT NULL,
  tax_minor bigint NOT NULL CHECK (tax_minor >= 0),
  PRIMARY KEY (tenant_id,tax_id,ordinal),
  UNIQUE (tenant_id,tax_id,business_date),
  FOREIGN KEY (tenant_id,tax_id) REFERENCES public.india_gst_accommodation_final_component_tax(tenant_id,id)
);

CREATE TABLE public.india_gst_accommodation_final_component_tax_component (
  tenant_id uuid NOT NULL,
  tax_id uuid NOT NULL,
  room_night_ordinal integer NOT NULL CHECK (room_night_ordinal BETWEEN 0 AND 365),
  component_ordinal smallint NOT NULL CHECK (component_ordinal BETWEEN 0 AND 1),
  component_identity text NOT NULL CHECK (component_identity IN ('igst','cgst','sgst','utgst')),
  rate_basis_points integer NOT NULL CHECK (rate_basis_points IN (250,500,600,900,1200,1800)),
  tax_amount_minor bigint NOT NULL CHECK (tax_amount_minor >= 0),
  currency char(3) NOT NULL CHECK (currency = 'INR'),
  PRIMARY KEY (tenant_id,tax_id,room_night_ordinal,component_ordinal),
  UNIQUE (tenant_id,tax_id,room_night_ordinal,component_identity),
  FOREIGN KEY (tenant_id,tax_id,room_night_ordinal)
    REFERENCES public.india_gst_accommodation_final_component_tax_room_night(tenant_id,tax_id,ordinal)
);

ALTER TABLE public.india_gst_accommodation_final_component_tax ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.india_gst_accommodation_final_component_tax FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON public.india_gst_accommodation_final_component_tax
  USING (tenant_id=NULLIF(pg_catalog.current_setting('app.tenant_id',true),'')::uuid)
  WITH CHECK (tenant_id=NULLIF(pg_catalog.current_setting('app.tenant_id',true),'')::uuid);
REVOKE ALL ON TABLE public.india_gst_accommodation_final_component_tax FROM PUBLIC,app_role,yellow_runtime;
GRANT SELECT ON public.india_gst_accommodation_final_component_tax TO app_role;
ALTER TABLE public.india_gst_accommodation_final_component_tax OWNER TO yellow_owner;

ALTER TABLE public.india_gst_accommodation_final_component_tax_room_night ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.india_gst_accommodation_final_component_tax_room_night FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON public.india_gst_accommodation_final_component_tax_room_night
  USING (tenant_id=NULLIF(pg_catalog.current_setting('app.tenant_id',true),'')::uuid)
  WITH CHECK (tenant_id=NULLIF(pg_catalog.current_setting('app.tenant_id',true),'')::uuid);
REVOKE ALL ON TABLE public.india_gst_accommodation_final_component_tax_room_night FROM PUBLIC,app_role,yellow_runtime;
GRANT SELECT ON public.india_gst_accommodation_final_component_tax_room_night TO app_role;
ALTER TABLE public.india_gst_accommodation_final_component_tax_room_night OWNER TO yellow_owner;

ALTER TABLE public.india_gst_accommodation_final_component_tax_component ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.india_gst_accommodation_final_component_tax_component FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON public.india_gst_accommodation_final_component_tax_component
  USING (tenant_id=NULLIF(pg_catalog.current_setting('app.tenant_id',true),'')::uuid)
  WITH CHECK (tenant_id=NULLIF(pg_catalog.current_setting('app.tenant_id',true),'')::uuid);
REVOKE ALL ON TABLE public.india_gst_accommodation_final_component_tax_component FROM PUBLIC,app_role,yellow_runtime;
GRANT SELECT ON public.india_gst_accommodation_final_component_tax_component TO app_role;
ALTER TABLE public.india_gst_accommodation_final_component_tax_component OWNER TO yellow_owner;

CREATE FUNCTION public.record_india_gst_accommodation_final_component_tax(
  p_tenant uuid,
  p_property uuid,
  p_reservation uuid,
  p_folio uuid,
  p_applicability uuid,
  p_request uuid,
  p_actor uuid,
  p_expected_tax uuid,
  p_expected_tax_hash text
) RETURNS TABLE(
  tax_id uuid,
  generation integer,
  valuation_id uuid,
  valuation_generation integer,
  transaction_value_minor bigint,
  tax_minor bigint,
  grand_total_minor bigint,
  evidence_hash text,
  created boolean
)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
DECLARE
  v_id uuid:=pg_catalog.gen_random_uuid();
  v_app public.india_gst_accommodation_quoted_rate_applicability%ROWTYPE;
  v_valuation public.india_gst_accommodation_final_valuation%ROWTYPE;
  v_linked_valuation public.india_gst_accommodation_final_valuation%ROWTYPE;
  v_lineage public.tax_attribution_reservation_binding%ROWTYPE;
  v_extension public.extension%ROWTYPE;
  v_existing public.india_gst_accommodation_final_component_tax%ROWTYPE;
  v_head public.india_gst_accommodation_final_component_tax%ROWTYPE;
  v_head_count integer; v_valuation_count integer; v_n integer; v_app_n integer;
  v_i integer; v_j integer; v_family_size integer; v_generation integer:=0;
  v_expected_lower integer; v_expected_extension uuid; v_expected_version smallint;
  v_expected_status text; v_expected_content_hash text; v_expected_content jsonb;
  v_expected_from timestamptz; v_expected_to timestamptz; v_expected_identities text[];
  v_order341_json text; v_quoted_json text; v_lineage_json text; v_selected_from_json text; v_selected_to_json text;
  v_room_json text:='['; v_night_component_json text; v_component_json text;
  v_evidence_hash text; v_total numeric:=0; v_tax numeric:=0; v_grand numeric;
  v_value numeric; v_night_tax numeric; v_component_tax numeric; v_product numeric;
  v_slab bigint; v_bps integer; v_itc boolean; v_identity text; v_rate_number text;
  v_room_ordinals integer[]:='{}'; v_room_dates date[]:='{}'; v_room_values bigint[]:='{}';
  v_room_slabs bigint[]:='{}'; v_room_bps integer[]:='{}'; v_room_itc boolean[]:='{}'; v_room_taxes bigint[]:='{}';
  v_component_nights integer[]:='{}'; v_component_ordinals smallint[]:='{}';
  v_component_identities text[]:='{}'; v_component_bps integer[]:='{}'; v_component_taxes bigint[]:='{}';
  v_business_date date; v_fact uuid;
BEGIN
  IF session_user<>'yellow_runtime'
     OR pg_catalog.current_setting('role',true) IS DISTINCT FROM 'app_role'
     OR current_user<>'yellow_owner' THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='final component tax requires governed runtime app role';
  END IF;
  IF p_tenant IS DISTINCT FROM NULLIF(pg_catalog.current_setting('app.tenant_id',true),'')::uuid THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='final component tax tenant context mismatch';
  END IF;
  IF p_tenant IS NULL OR p_property IS NULL OR p_reservation IS NULL OR p_folio IS NULL
     OR p_applicability IS NULL OR p_request IS NULL OR p_actor IS NULL
     OR (p_expected_tax IS NULL)<>(p_expected_tax_hash IS NULL)
     OR (p_expected_tax_hash IS NOT NULL AND p_expected_tax_hash !~ '^[0-9a-f]{64}$') THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='final component tax identity is invalid';
  END IF;
  PERFORM 1 FROM public.tenant WHERE id=p_tenant AND status='active';
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='final component tax tenant unavailable'; END IF;
  PERFORM 1
    FROM public.app_user actor
    JOIN public.user_role ur ON ur.tenant_id=actor.tenant_id AND ur.user_id=actor.id
    JOIN public.role_permission rp ON rp.role_id=ur.role_id AND rp.permission_code='tax-fiscal.india-valuation:finalize'
    JOIN public.org_node grant_node ON grant_node.tenant_id=ur.tenant_id AND grant_node.id=ur.scope_node
    JOIN public.org_node property ON property.tenant_id=actor.tenant_id AND property.id=p_property
      AND property.kind='property' AND grant_node.path @> property.path
   WHERE actor.tenant_id=p_tenant AND actor.id=p_actor AND actor.status='active';
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='actor lacks property fiscal authority'; END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_tenant::text||p_reservation::text||p_folio::text,0));
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('india-final-component-tax:'||p_tenant::text||':'||p_reservation::text||':'||p_folio::text,367));

  SELECT a.* INTO v_app
    FROM public.india_gst_accommodation_quoted_rate_applicability a
   WHERE a.tenant_id=p_tenant AND a.id=p_applicability
     AND a.property_node=p_property AND a.reservation_id=p_reservation AND a.folio_id=p_folio
   FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='approved quoted-rate applicability is unavailable for this scope'; END IF;

  SELECT linked.* INTO v_linked_valuation
    FROM public.india_gst_accommodation_final_valuation linked
   WHERE linked.tenant_id=p_tenant AND linked.id=v_app.final_valuation_id
     AND linked.property_node=p_property AND linked.reservation_id=p_reservation AND linked.folio_id=p_folio
     AND linked.disposition='ordinary_final' AND linked.currency='INR'
     AND linked.transaction_value_minor>0 AND linked.order341_evidence_hash=v_app.evidence_hash
   FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='quoted-rate applicability has lost its approved valuation ancestry'; END IF;

  SELECT pg_catalog.count(*)::integer INTO v_valuation_count
    FROM public.india_gst_accommodation_final_valuation candidate
   WHERE candidate.tenant_id=p_tenant AND candidate.property_node=p_property
     AND candidate.reservation_id=p_reservation AND candidate.folio_id=p_folio
     AND candidate.disposition='ordinary_final' AND candidate.currency='INR'
     AND candidate.transaction_value_minor>0
     AND NOT EXISTS (
       SELECT 1 FROM public.india_gst_accommodation_final_valuation successor
        WHERE successor.tenant_id=candidate.tenant_id AND successor.supersedes_valuation_id=candidate.id
     );
  IF v_valuation_count<>1 THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='exactly one current ordinary-final valuation is required'; END IF;
  SELECT candidate.* INTO v_valuation
    FROM public.india_gst_accommodation_final_valuation candidate
   WHERE candidate.tenant_id=p_tenant AND candidate.property_node=p_property
     AND candidate.reservation_id=p_reservation AND candidate.folio_id=p_folio
     AND candidate.disposition='ordinary_final' AND candidate.currency='INR'
     AND candidate.transaction_value_minor>0
     AND NOT EXISTS (
       SELECT 1 FROM public.india_gst_accommodation_final_valuation successor
        WHERE successor.tenant_id=candidate.tenant_id AND successor.supersedes_valuation_id=candidate.id
     )
   FOR UPDATE;
  IF v_valuation.actor_id<>p_actor OR v_valuation.order341_evidence_hash<>v_app.evidence_hash THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='current valuation does not retain approved applicability and actor ancestry';
  END IF;

  SELECT l.* INTO v_lineage
    FROM public.tax_attribution_reservation_binding l
    JOIN public.tax_attribution_hold_binding b ON b.tenant_id=l.tenant_id AND b.id=l.binding_id
      AND b.hold_id=l.hold_id AND b.attribution_id=l.attribution_id AND b.sellable_unit_id=l.sellable_unit_id
      AND b.period=l.period AND b.origin_quote_hash=l.origin_quote_hash AND b.snapshot_hash=l.snapshot_hash AND b.currency=l.currency
    JOIN public.hold h ON h.tenant_id=l.tenant_id AND h.id=l.hold_id AND h.status='consumed'
      AND h.sellable_unit_id=l.sellable_unit_id AND h.period=l.period
    JOIN public.reservation_segment s ON s.tenant_id=l.tenant_id AND s.id=l.segment_id
      AND s.reservation_id=l.reservation_id AND s.sellable_unit_id=l.sellable_unit_id AND s.period=l.period
    JOIN public.tax_attribution_snapshot a ON a.tenant_id=l.tenant_id AND a.id=l.attribution_id
      AND a.property_node=l.property_node AND a.origin_kind='rate_quote'
      AND a.origin_quote_hash=l.origin_quote_hash AND a.snapshot_hash=l.snapshot_hash AND a.currency='INR'
   WHERE l.tenant_id=p_tenant AND l.id=v_app.reservation_lineage_id AND l.property_node=p_property
     AND l.reservation_id=p_reservation AND l.attribution_id=v_app.attribution_id AND l.currency='INR'
   FOR SHARE OF l,b,h,s,a;
  IF NOT FOUND OR v_app.attribution_snapshot_evidence_hash<>v_lineage.snapshot_hash THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='persisted attribution lineage is stale';
  END IF;
  v_lineage_json:='{"tenantId":"'||p_tenant::text||'","lineageId":"'||v_lineage.id::text
    ||'","holdBindingId":"'||v_lineage.binding_id::text||'","reservationId":"'||p_reservation::text
    ||'","segmentId":"'||v_lineage.segment_id::text||'","folioId":"'||p_folio::text
    ||'","attributionId":"'||v_lineage.attribution_id::text||'","originQuoteHash":"'||v_lineage.origin_quote_hash
    ||'","snapshotHash":"'||v_lineage.snapshot_hash||'","currency":"INR","holdId":"'||v_lineage.hold_id::text
    ||'","sellableUnitId":"'||v_lineage.sellable_unit_id::text||'","period":'||pg_catalog.to_json(v_lineage.period::text)::text||'}';
  IF pg_catalog.encode(public.digest(pg_catalog.convert_to(v_lineage_json,'UTF8'),'sha256'),'hex')<>v_app.reservation_lineage_evidence_hash THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='persisted reservation lineage evidence is stale';
  END IF;

  IF v_app.selected_version_side='predecessor' THEN
    v_expected_extension:='a806f516-fed6-5768-b310-94aa03286adb'; v_expected_version:=1; v_expected_status:='retired';
    v_expected_from:='2022-07-17T18:30:00Z'; v_expected_to:='2025-09-21T18:30:00Z'; v_expected_lower:=1200;
    v_expected_content_hash:='2160e1747afcb3c280f1fd66e55534a5be563a10f277e8fcc178324e51abaa08';
    v_expected_content:='{"country":"IN","price_display":"tax_exclusive","rounding":"document","taxes":[{"code":"GST_ROOM","name":"GST on accommodation","mode":"slab_percent","slab_basis":"transaction_value","applies_to":["room_revenue"],"slabs":[{"upto_minor":750000,"rate":0.12,"itc_eligible":true},{"upto_minor":null,"rate":0.18,"itc_eligible":true}]},{"code":"GST_FNB","name":"GST on F&B (restaurant in hotel)","mode":"percent","rate":0.05,"applies_to":["fnb_revenue"]}]}'::jsonb;
  ELSIF v_app.selected_version_side='successor' THEN
    v_expected_extension:='0b21daf2-ea6e-5568-9c21-69e4d4424574'; v_expected_version:=2; v_expected_status:='active';
    v_expected_from:='2025-09-21T18:30:00Z'; v_expected_to:=NULL; v_expected_lower:=500;
    v_expected_content_hash:='eb323eff707aad1e460b425c87b448d4e924d2eb17499094abad71b33c69a820';
    v_expected_content:='{"country":"IN","price_display":"tax_exclusive","rounding":"document","taxes":[{"code":"GST_ROOM","name":"GST on accommodation","mode":"slab_percent","slab_basis":"transaction_value","applies_to":["room_revenue"],"slabs":[{"upto_minor":750000,"rate":0.05,"itc_eligible":false},{"upto_minor":null,"rate":0.18,"itc_eligible":true}]},{"code":"GST_FNB","name":"GST on F&B (restaurant in hotel)","mode":"percent","rate":0.05,"applies_to":["fnb_revenue"]}]}'::jsonb;
  ELSE RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='persisted selected extension side is invalid'; END IF;
  SELECT e.* INTO v_extension FROM public.extension e
   WHERE e.id=v_expected_extension AND e.tenant_id IS NULL AND e.type='tax_jurisdiction'
     AND e.key='in-gst-lodging' AND e.version=v_expected_version AND e.status=v_expected_status
   FOR SHARE;
  IF NOT FOUND OR v_extension.content<>v_expected_content OR pg_catalog.lower(v_extension.effective)<>v_expected_from
     OR pg_catalog.upper(v_extension.effective) IS DISTINCT FROM v_expected_to
     OR v_app.selected_extension_id<>v_expected_extension OR v_app.selected_extension_version<>v_expected_version
     OR v_app.selected_extension_status<>v_expected_status OR v_app.selected_content_hash<>v_expected_content_hash
     OR v_app.selected_effective_from<>v_expected_from OR v_app.selected_effective_to IS DISTINCT FROM v_expected_to THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='persisted selected extension identity is stale';
  END IF;

  v_expected_identities:=CASE v_app.component_family WHEN 'igst' THEN ARRAY['igst']
    WHEN 'cgst_sgst' THEN ARRAY['cgst','sgst'] WHEN 'cgst_utgst' THEN ARRAY['cgst','utgst'] ELSE NULL END;
  IF v_expected_identities IS NULL THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='persisted component family is invalid'; END IF;
  v_family_size:=pg_catalog.cardinality(v_expected_identities);
  SELECT pg_catalog.count(*)::integer INTO v_app_n
    FROM public.india_gst_accommodation_quoted_rate_applicability_room_night q
   WHERE q.tenant_id=p_tenant AND q.applicability_id=p_applicability;
  IF v_app_n<1 OR v_app_n>366
     OR EXISTS (
       SELECT 1 FROM public.india_gst_accommodation_quoted_rate_applicability_room_night q
        WHERE q.tenant_id=p_tenant AND q.applicability_id=p_applicability
          AND (q.ordinal<0 OR q.ordinal>=v_app_n OR q.currency<>'INR'
            OR (q.quoted_amount_minor<=750000 AND (q.slab_upto_minor IS DISTINCT FROM 750000 OR q.aggregate_rate_basis_points<>v_expected_lower OR q.itc_eligible<>(v_app.selected_version_side='predecessor')))
            OR (q.quoted_amount_minor>750000 AND (q.slab_upto_minor IS NOT NULL OR q.aggregate_rate_basis_points<>1800 OR NOT q.itc_eligible)))
     )
     OR (SELECT pg_catalog.count(*) FROM public.india_gst_accommodation_quoted_rate_component c WHERE c.tenant_id=p_tenant AND c.applicability_id=p_applicability)<>v_app_n*v_family_size
     OR EXISTS (
       SELECT 1 FROM public.india_gst_accommodation_quoted_rate_component c
       JOIN public.india_gst_accommodation_quoted_rate_applicability_room_night q
         ON q.tenant_id=c.tenant_id AND q.applicability_id=c.applicability_id AND q.ordinal=c.room_night_ordinal
        WHERE c.tenant_id=p_tenant AND c.applicability_id=p_applicability
          AND (c.component_ordinal<0 OR c.component_ordinal>=v_family_size
            OR c.component_identity<>v_expected_identities[c.component_ordinal+1]
            OR c.rate_basis_points<>q.aggregate_rate_basis_points/v_family_size)
     ) THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='persisted quoted-rate component evidence is incomplete or stale'; END IF;

  SELECT '['||pg_catalog.string_agg(
    '{"ordinal":"'||q.ordinal::text||'","businessDate":"'||q.business_date::text
    ||'","quotedAmountMinor":"'||q.quoted_amount_minor::text||'","slab":{"uptoMinor":'||coalesce(q.slab_upto_minor::text,'null')
    ||',"aggregateRate":'||CASE q.aggregate_rate_basis_points WHEN 500 THEN '0.05' WHEN 1200 THEN '0.12' WHEN 1800 THEN '0.18' END
    ||',"aggregateRateBasisPoints":'||q.aggregate_rate_basis_points::text||',"itcEligible":'||CASE WHEN q.itc_eligible THEN 'true' ELSE 'false' END
    ||',"components":['||(SELECT pg_catalog.string_agg('{"identity":"'||c.component_identity||'","rate":'
      ||CASE c.rate_basis_points WHEN 250 THEN '0.025' WHEN 500 THEN '0.05' WHEN 600 THEN '0.06' WHEN 900 THEN '0.09' WHEN 1200 THEN '0.12' WHEN 1800 THEN '0.18' END
      ||',"rateBasisPoints":'||c.rate_basis_points::text||'}',',' ORDER BY c.component_ordinal)
      FROM public.india_gst_accommodation_quoted_rate_component c
      WHERE c.tenant_id=q.tenant_id AND c.applicability_id=q.applicability_id AND c.room_night_ordinal=q.ordinal)||']}}',',' ORDER BY q.ordinal)||']'
    INTO v_quoted_json
    FROM public.india_gst_accommodation_quoted_rate_applicability_room_night q
   WHERE q.tenant_id=p_tenant AND q.applicability_id=p_applicability;
  v_selected_from_json:=CASE v_app.selected_version_side WHEN 'predecessor' THEN '2022-07-17T18:30:00.000000Z' ELSE '2025-09-21T18:30:00.000000Z' END;
  v_selected_to_json:=CASE v_app.selected_version_side WHEN 'predecessor' THEN '"2025-09-21T18:30:00.000000Z"' ELSE 'null' END;
  v_order341_json:='{"tenantId":"'||p_tenant::text||'","propertyNode":"'||p_property::text
    ||'","reservationId":"'||p_reservation::text||'","folioId":"'||p_folio::text
    ||'","section14":{"case":"'||v_app.section14_case||'","timeOfSupplyDate":"'||v_app.time_of_supply_date::text
    ||'","selectedVersionSide":"'||v_app.selected_version_side||'","selectedVersion":{"extensionId":"'||v_app.selected_extension_id::text
    ||'","version":'||v_app.selected_extension_version::text||',"status":"'||v_app.selected_extension_status
    ||'","contentHash":"'||v_app.selected_content_hash||'","effectiveFromInstant":"'||v_selected_from_json
    ||'","effectiveToInstant":'||v_selected_to_json||'}},"reservationLineage":{"lineageId":"'||v_lineage.id::text
    ||'","holdBindingId":"'||v_lineage.binding_id::text||'","reservationId":"'||p_reservation::text
    ||'","segmentId":"'||v_lineage.segment_id::text||'","folioId":"'||p_folio::text
    ||'","attributionId":"'||v_lineage.attribution_id::text||'","originQuoteHash":"'||v_lineage.origin_quote_hash
    ||'","snapshotHash":"'||v_lineage.snapshot_hash||'","currency":"INR"},"components":'||v_quoted_json
    ||',"predecessorHashes":{"section14":"'||v_app.section14_evidence_hash||'","levyComponentIdentity":"'||v_app.levy_component_identity_evidence_hash
    ||'","reservationLineage":"'||v_app.reservation_lineage_evidence_hash||'","attributionSnapshot":"'||v_app.attribution_snapshot_evidence_hash||'"}}';
  IF pg_catalog.encode(public.digest(pg_catalog.convert_to(v_order341_json,'UTF8'),'sha256'),'hex')<>v_app.evidence_hash THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='persisted quoted-rate applicability does not byte-match its complete typed result';
  END IF;

  SELECT pg_catalog.count(*)::integer INTO v_n
    FROM public.india_gst_accommodation_valuation_room_night n
   WHERE n.tenant_id=p_tenant AND n.valuation_id=v_valuation.id;
  IF v_n<>v_app_n OR v_n<1 OR v_n>366
     OR EXISTS (
       SELECT 1 FROM public.india_gst_accommodation_valuation_room_night n
       LEFT JOIN public.india_gst_accommodation_quoted_rate_applicability_room_night q
         ON q.tenant_id=n.tenant_id AND q.applicability_id=p_applicability AND q.ordinal=n.ordinal
        WHERE n.tenant_id=p_tenant AND n.valuation_id=v_valuation.id
          AND (n.ordinal<0 OR n.ordinal>=v_n OR n.currency<>'INR' OR n.transaction_value_minor IS NULL
            OR n.transaction_value_minor<=0 OR q.ordinal IS NULL OR q.business_date<>n.business_date)
     ) THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='current valuation room-night evidence is incomplete or stale'; END IF;

  FOR v_i IN 0..v_n-1 LOOP
    SELECT n.transaction_value_minor::numeric,n.business_date INTO v_value,v_business_date
      FROM public.india_gst_accommodation_valuation_room_night n
     WHERE n.tenant_id=p_tenant AND n.valuation_id=v_valuation.id AND n.ordinal=v_i;
    IF v_value<=750000 THEN v_slab:=750000;v_bps:=v_expected_lower;v_itc:=(v_app.selected_version_side='predecessor');
    ELSE v_slab:=NULL;v_bps:=1800;v_itc:=true; END IF;
    v_night_tax:=0; v_night_component_json:='[';
    FOR v_j IN 1..v_family_size LOOP
      v_identity:=v_expected_identities[v_j];
      v_product:=v_value*(v_bps/v_family_size);
      v_component_tax:=pg_catalog.trunc(v_product/10000)+CASE WHEN pg_catalog.mod(v_product,10000)*2>=10000 THEN 1 ELSE 0 END;
      IF v_component_tax NOT BETWEEN 0 AND 9223372036854775807::numeric THEN RAISE EXCEPTION USING ERRCODE='22003',MESSAGE='component tax exceeds signed int64'; END IF;
      v_night_tax:=v_night_tax+v_component_tax;
      v_component_nights:=pg_catalog.array_append(v_component_nights,v_i);
      v_component_ordinals:=pg_catalog.array_append(v_component_ordinals,(v_j-1)::smallint);
      v_component_identities:=pg_catalog.array_append(v_component_identities,v_identity);
      v_component_bps:=pg_catalog.array_append(v_component_bps,v_bps/v_family_size);
      v_component_taxes:=pg_catalog.array_append(v_component_taxes,v_component_tax::bigint);
      v_night_component_json:=v_night_component_json||CASE WHEN v_j>1 THEN ',' ELSE '' END
        ||'{"identity":"'||v_identity||'","rateBasisPoints":'||(v_bps/v_family_size)::text
        ||',"taxMinor":"'||v_component_tax::bigint::text||'"}';
    END LOOP;
    v_night_component_json:=v_night_component_json||']';
    IF v_night_tax>9223372036854775807::numeric THEN RAISE EXCEPTION USING ERRCODE='22003',MESSAGE='room-night tax exceeds signed int64'; END IF;
    v_room_ordinals:=pg_catalog.array_append(v_room_ordinals,v_i);
    v_room_dates:=pg_catalog.array_append(v_room_dates,v_business_date);
    v_room_values:=pg_catalog.array_append(v_room_values,v_value::bigint);
    v_room_slabs:=pg_catalog.array_append(v_room_slabs,v_slab);
    v_room_bps:=pg_catalog.array_append(v_room_bps,v_bps);
    v_room_itc:=pg_catalog.array_append(v_room_itc,v_itc);
    v_room_taxes:=pg_catalog.array_append(v_room_taxes,v_night_tax::bigint);
    v_total:=v_total+v_value; v_tax:=v_tax+v_night_tax;
    v_room_json:=v_room_json||CASE WHEN v_i>0 THEN ',' ELSE '' END
      ||'{"ordinal":"'||v_i::text||'","businessDate":"'||v_business_date::text
      ||'","transactionValueMinor":"'||v_value::bigint::text||'","slab":{"uptoMinor":'||coalesce(v_slab::text,'null')
      ||',"aggregateRateBasisPoints":'||v_bps::text||',"components":'||v_night_component_json
      ||'},"taxMinor":"'||v_night_tax::bigint::text||'"}';
  END LOOP;
  v_room_json:=v_room_json||']';
  IF v_total<>v_valuation.transaction_value_minor OR v_total>9223372036854775807::numeric
     OR v_tax>9223372036854775807::numeric THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='current valuation total does not reconcile to dense room-night evidence';
  END IF;
  v_grand:=v_total+v_tax;
  IF v_grand>9223372036854775807::numeric THEN RAISE EXCEPTION USING ERRCODE='22003',MESSAGE='grand total exceeds signed int64'; END IF;
  v_evidence_hash:=pg_catalog.encode(public.digest(pg_catalog.convert_to(
    '{"tenant":"'||p_tenant::text||'","property":"'||p_property::text||'","reservation":"'||p_reservation::text
    ||'","folio":"'||p_folio::text||'","valuationId":"'||v_valuation.id::text||'","generation":'||v_valuation.generation::text
    ||',"roomNights":'||v_room_json||',"taxMinor":"'||v_tax::bigint::text||'","grandTotalMinor":"'||v_grand::bigint::text
    ||'","predecessorHashes":{"finalValuation":"'||v_valuation.evidence_hash||'","quotedRateApplicability":"'||v_app.evidence_hash
    ||'","section14":"'||v_app.section14_evidence_hash||'","levyComponentIdentity":"'||v_app.levy_component_identity_evidence_hash
    ||'","reservationLineage":"'||v_app.reservation_lineage_evidence_hash||'","attributionSnapshot":"'||v_app.attribution_snapshot_evidence_hash||'"}}','UTF8'),'sha256'),'hex');

  SELECT t.* INTO v_existing FROM public.india_gst_accommodation_final_component_tax t
   WHERE t.tenant_id=p_tenant AND t.request_id=p_request;
  IF FOUND THEN
    IF v_existing.property_node<>p_property OR v_existing.reservation_id<>p_reservation OR v_existing.folio_id<>p_folio
       OR v_existing.applicability_id<>p_applicability OR v_existing.valuation_id<>v_valuation.id
       OR v_existing.valuation_generation<>v_valuation.generation OR v_existing.actor_id<>p_actor
       OR v_existing.transaction_value_minor<>v_total OR v_existing.tax_minor<>v_tax OR v_existing.grand_total_minor<>v_grand
       OR v_existing.evidence_hash<>v_evidence_hash OR v_existing.supersedes_tax_id IS DISTINCT FROM p_expected_tax
       OR v_existing.supersedes_tax_evidence_hash IS DISTINCT FROM p_expected_tax_hash
       OR (SELECT pg_catalog.array_agg(n.ordinal ORDER BY n.ordinal) FROM public.india_gst_accommodation_final_component_tax_room_night n WHERE n.tenant_id=p_tenant AND n.tax_id=v_existing.id) IS DISTINCT FROM v_room_ordinals
       OR (SELECT pg_catalog.array_agg(c.component_identity ORDER BY c.room_night_ordinal,c.component_ordinal) FROM public.india_gst_accommodation_final_component_tax_component c WHERE c.tenant_id=p_tenant AND c.tax_id=v_existing.id) IS DISTINCT FROM v_component_identities THEN
      RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='final component tax request has divergent evidence';
    END IF;
    RETURN QUERY SELECT v_existing.id,v_existing.generation,v_existing.valuation_id,v_existing.valuation_generation,
      v_existing.transaction_value_minor,v_existing.tax_minor,v_existing.grand_total_minor,v_existing.evidence_hash,false;
    RETURN;
  END IF;

  SELECT pg_catalog.count(*)::integer INTO v_head_count
    FROM public.india_gst_accommodation_final_component_tax t
   WHERE t.tenant_id=p_tenant AND t.property_node=p_property AND t.reservation_id=p_reservation AND t.folio_id=p_folio
     AND NOT EXISTS (SELECT 1 FROM public.india_gst_accommodation_final_component_tax successor WHERE successor.tenant_id=t.tenant_id AND successor.supersedes_tax_id=t.id);
  IF v_head_count=0 THEN
    IF p_expected_tax IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='expected current component tax is stale'; END IF;
  ELSIF v_head_count=1 THEN
    IF p_expected_tax IS NULL THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='initial component tax already exists'; END IF;
    SELECT t.* INTO v_head FROM public.india_gst_accommodation_final_component_tax t
     WHERE t.tenant_id=p_tenant AND t.id=p_expected_tax AND t.evidence_hash=p_expected_tax_hash
       AND t.property_node=p_property AND t.reservation_id=p_reservation AND t.folio_id=p_folio
       AND NOT EXISTS (SELECT 1 FROM public.india_gst_accommodation_final_component_tax successor WHERE successor.tenant_id=t.tenant_id AND successor.supersedes_tax_id=t.id)
     FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='expected current component tax is stale'; END IF;
    IF v_head.valuation_id=v_valuation.id THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='component tax correction requires a new current valuation'; END IF;
    v_generation:=v_head.generation+1;
  ELSE RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='component tax lineage has multiple current heads'; END IF;

  INSERT INTO public.india_gst_accommodation_final_component_tax(
    tenant_id,id,property_node,reservation_id,folio_id,applicability_id,valuation_id,valuation_generation,
    request_id,generation,currency,transaction_value_minor,tax_minor,grand_total_minor,component_family,
    selected_version_side,selected_extension_id,selected_extension_version,final_valuation_evidence_hash,
    quoted_rate_applicability_evidence_hash,section14_evidence_hash,levy_component_identity_evidence_hash,
    reservation_lineage_evidence_hash,attribution_snapshot_evidence_hash,evidence_hash,
    supersedes_tax_id,supersedes_tax_evidence_hash,actor_id
  ) VALUES(
    p_tenant,v_id,p_property,p_reservation,p_folio,p_applicability,v_valuation.id,v_valuation.generation,
    p_request,v_generation,'INR',v_total::bigint,v_tax::bigint,v_grand::bigint,v_app.component_family,
    v_app.selected_version_side,v_app.selected_extension_id,v_app.selected_extension_version,v_valuation.evidence_hash,
    v_app.evidence_hash,v_app.section14_evidence_hash,v_app.levy_component_identity_evidence_hash,
    v_app.reservation_lineage_evidence_hash,v_app.attribution_snapshot_evidence_hash,v_evidence_hash,
    p_expected_tax,p_expected_tax_hash,p_actor
  );
  FOR v_i IN 1..v_n LOOP
    INSERT INTO public.india_gst_accommodation_final_component_tax_room_night(
      tenant_id,tax_id,ordinal,business_date,final_value_minor,currency,slab_upto_minor,
      aggregate_rate_basis_points,itc_eligible,tax_minor
    ) VALUES(p_tenant,v_id,v_room_ordinals[v_i],v_room_dates[v_i],v_room_values[v_i],'INR',v_room_slabs[v_i],v_room_bps[v_i],v_room_itc[v_i],v_room_taxes[v_i]);
  END LOOP;
  FOR v_i IN 1..pg_catalog.cardinality(v_component_identities) LOOP
    INSERT INTO public.india_gst_accommodation_final_component_tax_component(
      tenant_id,tax_id,room_night_ordinal,component_ordinal,component_identity,rate_basis_points,tax_amount_minor,currency
    ) VALUES(p_tenant,v_id,v_component_nights[v_i],v_component_ordinals[v_i],v_component_identities[v_i],v_component_bps[v_i],v_component_taxes[v_i],'INR');
  END LOOP;
  SELECT (pg_catalog.transaction_timestamp() AT TIME ZONE node.timezone)::date INTO v_business_date
    FROM public.org_node node WHERE node.tenant_id=p_tenant AND node.id=p_property;
  INSERT INTO public.fact_log(tenant_id,entity_type,entity_id,fact_type,valid_from,business_date,actor_id,payload,supersedes)
  VALUES(p_tenant,'india_gst_accommodation_final_component_tax',v_id,'recorded',pg_catalog.transaction_timestamp(),v_business_date,p_actor,
    pg_catalog.jsonb_build_object('taxId',v_id,'generation',v_generation,'evidenceHash',v_evidence_hash),
    (SELECT f.id FROM public.fact_log f WHERE f.tenant_id=p_tenant AND f.entity_type='india_gst_accommodation_final_component_tax' AND f.entity_id=p_expected_tax ORDER BY f.recorded_at DESC LIMIT 1))
  RETURNING id INTO v_fact;
  INSERT INTO public.outbox(tenant_id,property_node,business_date,aggregate_type,aggregate_id,event_type,actor_id,correlation_id,payload)
  VALUES(p_tenant,p_property,v_business_date,'india_gst_accommodation_final_component_tax',v_id,
    'india_gst.accommodation_final_component_tax_recorded',p_actor,p_request,
    pg_catalog.jsonb_build_object('taxId',v_id,'valuationId',v_valuation.id,'valuationGeneration',v_valuation.generation,
      'generation',v_generation,'evidenceHash',v_evidence_hash));
  RETURN QUERY SELECT v_id,v_generation,v_valuation.id,v_valuation.generation,v_total::bigint,v_tax::bigint,v_grand::bigint,v_evidence_hash,true;
END $$;

ALTER FUNCTION public.record_india_gst_accommodation_final_component_tax(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.record_india_gst_accommodation_final_component_tax(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_india_gst_accommodation_final_component_tax(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text) FROM app_role;
REVOKE ALL ON FUNCTION public.record_india_gst_accommodation_final_component_tax(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text) FROM yellow_runtime;
GRANT EXECUTE ON FUNCTION public.record_india_gst_accommodation_final_component_tax(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text) TO app_role;
