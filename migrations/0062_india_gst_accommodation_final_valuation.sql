-- Order 350: immutable India accommodation final-valuation evidence only.
ALTER TABLE public.folio
  ADD CONSTRAINT folio_tenant_id_uq UNIQUE (tenant_id,id);

CREATE TABLE public.india_gst_accommodation_final_valuation (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  property_node uuid NOT NULL,
  reservation_id uuid NOT NULL,
  folio_id uuid NOT NULL,
  folio_account_id uuid NOT NULL,
  window_no smallint NOT NULL CHECK (window_no > 0),
  buyer_party_id uuid NOT NULL,
  attribution_id uuid NOT NULL,
  request_id uuid NOT NULL,
  generation integer NOT NULL CHECK (generation >= 0),
  disposition text NOT NULL CHECK (disposition IN ('ordinary_final','manual_valuation_required')),
  currency char(3) NOT NULL CHECK (currency = 'INR'),
  transaction_value_minor bigint,
  source_set_hash text NOT NULL CHECK (source_set_hash ~ '^[0-9a-f]{64}$'),
  order341_evidence_hash text NOT NULL CHECK (order341_evidence_hash ~ '^[0-9a-f]{64}$'),
  request_hash text NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  evidence_hash text NOT NULL CHECK (evidence_hash ~ '^[0-9a-f]{64}$'),
  ordinary_evidence_hashes text[] NOT NULL DEFAULT '{}',
  manual_reasons text[] NOT NULL DEFAULT '{}',
  approval_request_id uuid,
  supersedes_valuation_id uuid,
  actor_id uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (tenant_id,id),
  UNIQUE (tenant_id,request_id),
  UNIQUE (tenant_id,evidence_hash),
  UNIQUE (tenant_id,reservation_id,folio_id,generation),
  UNIQUE (tenant_id,supersedes_valuation_id),
  UNIQUE (tenant_id,approval_request_id),
  CONSTRAINT india_gst_final_valuation_shape_ck CHECK (
    (generation=0 AND supersedes_valuation_id IS NULL OR generation>0 AND supersedes_valuation_id IS NOT NULL)
    AND (disposition='ordinary_final' AND transaction_value_minor IS NOT NULL AND cardinality(ordinary_evidence_hashes)=5 AND cardinality(manual_reasons)=0
      OR disposition='manual_valuation_required' AND transaction_value_minor IS NULL AND cardinality(manual_reasons)>0)
    AND NOT (ordinary_evidence_hashes && manual_reasons)
  ),
  FOREIGN KEY (tenant_id,property_node) REFERENCES public.org_node(tenant_id,id),
  FOREIGN KEY (tenant_id,reservation_id) REFERENCES public.reservation(tenant_id,id),
  FOREIGN KEY (tenant_id,folio_id) REFERENCES public.folio(tenant_id,id),
  FOREIGN KEY (tenant_id,folio_account_id) REFERENCES public.account(tenant_id,id),
  FOREIGN KEY (tenant_id,buyer_party_id) REFERENCES public.party(tenant_id,id),
  FOREIGN KEY (tenant_id,attribution_id) REFERENCES public.tax_attribution_snapshot(tenant_id,id),
  FOREIGN KEY (tenant_id,approval_request_id) REFERENCES public.approval_request(tenant_id,id),
  FOREIGN KEY (tenant_id,supersedes_valuation_id) REFERENCES public.india_gst_accommodation_final_valuation(tenant_id,id),
  FOREIGN KEY (tenant_id,actor_id) REFERENCES public.app_user(tenant_id,id)
);
CREATE INDEX india_gst_final_valuation_scope ON public.india_gst_accommodation_final_valuation(tenant_id,property_node,reservation_id,folio_id,generation DESC);

CREATE TABLE public.india_gst_accommodation_valuation_source (
  tenant_id uuid NOT NULL,
  valuation_id uuid NOT NULL,
  posting_root_id uuid NOT NULL,
  source_kind text NOT NULL CHECK (source_kind IN ('room_consideration','package_consideration','promotion_discount','fee_consideration','section15_2_addition','section15_3_discount')),
  current_amount_minor bigint NOT NULL CHECK (current_amount_minor <> 0),
  currency char(3) NOT NULL CHECK (currency='INR'),
  tx_code text NOT NULL,
  current_fragment_set_hash text NOT NULL CHECK (current_fragment_set_hash ~ '^[0-9a-f]{64}$'),
  classification_evidence_hash text NOT NULL CHECK (classification_evidence_hash ~ '^[0-9a-f]{64}$'),
  eligibility_evidence_hash text CHECK (eligibility_evidence_hash IS NULL OR eligibility_evidence_hash ~ '^[0-9a-f]{64}$'),
  PRIMARY KEY (tenant_id,valuation_id,posting_root_id),
  FOREIGN KEY (tenant_id,valuation_id) REFERENCES public.india_gst_accommodation_final_valuation(tenant_id,id),
  FOREIGN KEY (tenant_id,posting_root_id) REFERENCES public.posting_line(tenant_id,id),
  FOREIGN KEY (tx_code) REFERENCES public.tx_code(code)
);
CREATE INDEX india_gst_valuation_source_root ON public.india_gst_accommodation_valuation_source(tenant_id,posting_root_id,valuation_id);

CREATE TABLE public.india_gst_accommodation_valuation_room_night (
  tenant_id uuid NOT NULL,
  valuation_id uuid NOT NULL,
  ordinal integer NOT NULL CHECK (ordinal >= 0 AND ordinal <= 365),
  business_date date NOT NULL,
  quoted_weight_minor bigint NOT NULL CHECK (quoted_weight_minor > 0),
  transaction_value_minor bigint,
  currency char(3) NOT NULL CHECK (currency='INR'),
  PRIMARY KEY (tenant_id,valuation_id,ordinal),
  UNIQUE (tenant_id,valuation_id,business_date),
  FOREIGN KEY (tenant_id,valuation_id) REFERENCES public.india_gst_accommodation_final_valuation(tenant_id,id)
);

CREATE TABLE public.india_gst_accommodation_valuation_allocation (
  tenant_id uuid NOT NULL,
  valuation_id uuid NOT NULL,
  posting_root_id uuid NOT NULL,
  ordinal integer NOT NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor <> 0),
  currency char(3) NOT NULL CHECK (currency='INR'),
  PRIMARY KEY (tenant_id,valuation_id,posting_root_id,ordinal),
  FOREIGN KEY (tenant_id,valuation_id,posting_root_id) REFERENCES public.india_gst_accommodation_valuation_source(tenant_id,valuation_id,posting_root_id),
  FOREIGN KEY (tenant_id,valuation_id,ordinal) REFERENCES public.india_gst_accommodation_valuation_room_night(tenant_id,valuation_id,ordinal)
);
CREATE INDEX india_gst_valuation_allocation_night ON public.india_gst_accommodation_valuation_allocation(tenant_id,valuation_id,ordinal,posting_root_id);

DO $rls$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['india_gst_accommodation_final_valuation','india_gst_accommodation_valuation_source','india_gst_accommodation_valuation_room_night','india_gst_accommodation_valuation_allocation'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',t);
    EXECUTE format('CREATE POLICY tenant_isolation ON public.%I USING (tenant_id=current_setting(''app.tenant_id'')::uuid) WITH CHECK (tenant_id=current_setting(''app.tenant_id'')::uuid)',t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC,app_role,yellow_runtime',t);
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO app_role',t);
  END LOOP;
END $rls$;

ALTER TABLE public.india_gst_accommodation_final_valuation OWNER TO yellow_owner;
ALTER TABLE public.india_gst_accommodation_valuation_source OWNER TO yellow_owner;
ALTER TABLE public.india_gst_accommodation_valuation_room_night OWNER TO yellow_owner;
ALTER TABLE public.india_gst_accommodation_valuation_allocation OWNER TO yellow_owner;

CREATE FUNCTION public.record_india_gst_accommodation_final_valuation(
  p_tenant uuid,p_property uuid,p_reservation uuid,p_folio uuid,p_buyer uuid,p_attribution uuid,
  p_request uuid,p_actor uuid,p_disposition text,p_order341_hash text,p_request_hash text,p_evidence_hash text,
  p_expected uuid,p_expected_hash text,p_approval uuid,p_ordinary_hashes text[],p_manual_reasons text[],
  p_source_ids uuid[],p_source_kinds text[],p_source_hashes text[],p_source_eligibility text[],
  p_room_ordinals integer[],p_room_dates date[],p_room_weights bigint[],p_allocations bigint[]
) RETURNS TABLE(valuation_id uuid,generation integer,disposition text,transaction_value_minor bigint,evidence_hash text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE
  v_folio public.folio%ROWTYPE; v_res public.reservation%ROWTYPE; v_id uuid:=gen_random_uuid();
  v_generation integer:=0; v_total numeric:=0; v_source_count integer; v_room_count integer;
  v_i integer; v_j integer; v_amount numeric; v_frag_hash text; v_tx text; v_fact uuid; v_date date; v_night_total numeric;
  v_source_amounts bigint[]:='{}'; v_fragment_hashes text[]:='{}'; v_tx_codes text[]:='{}';
  v_source_set_hash text; v_current public.india_gst_accommodation_final_valuation%ROWTYPE;
BEGIN
  IF p_tenant IS DISTINCT FROM current_setting('app.tenant_id',true)::uuid THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='tenant context mismatch'; END IF;
  IF p_order341_hash !~ '^[0-9a-f]{64}$' OR p_request_hash !~ '^[0-9a-f]{64}$' OR p_evidence_hash !~ '^[0-9a-f]{64}$'
     OR EXISTS(SELECT 1 FROM unnest(p_source_hashes) h WHERE h !~ '^[0-9a-f]{64}$')
     OR EXISTS(SELECT 1 FROM unnest(p_source_eligibility) h WHERE h<>'' AND h !~ '^[0-9a-f]{64}$')
     OR EXISTS(SELECT 1 FROM unnest(p_ordinary_hashes) h WHERE h !~ '^[0-9a-f]{64}$')
  THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='valuation hashes are non-canonical'; END IF;
  PERFORM 1 FROM public.app_user WHERE tenant_id=p_tenant AND id=p_actor AND status='active'; IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='actor unavailable'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant::text||p_reservation::text||p_folio::text,0));
  SELECT * INTO v_res FROM public.reservation WHERE tenant_id=p_tenant AND id=p_reservation AND property_node=p_property FOR SHARE;
  SELECT * INTO v_folio FROM public.folio WHERE tenant_id=p_tenant AND id=p_folio AND reservation_id=p_reservation AND status='open' FOR UPDATE;
  IF NOT FOUND OR v_res.id IS NULL THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='valuation scope unavailable'; END IF;
  PERFORM 1 FROM public.account WHERE tenant_id=p_tenant AND id=v_folio.account_id AND status='open' AND currency='INR' FOR SHARE; IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='INR folio account unavailable'; END IF;
  PERFORM 1 FROM public.tax_attribution_snapshot WHERE tenant_id=p_tenant AND id=p_attribution AND property_node=p_property AND currency='INR' FOR SHARE; IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Order341 attribution unavailable'; END IF;
  PERFORM 1 FROM public.party p JOIN public.party_role r ON r.tenant_id=p.tenant_id AND r.party_id=p.id AND r.role IN ('guest','company') WHERE p.tenant_id=p_tenant AND p.id=p_buyer AND p.status='active' FOR SHARE OF p;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='legal buyer unavailable'; END IF;
  IF p_buyer IS DISTINCT FROM v_res.primary_party AND p_buyer IS DISTINCT FROM v_res.booker_party
     AND p_buyer IS DISTINCT FROM (SELECT party_id FROM public.account WHERE tenant_id=p_tenant AND id=v_folio.account_id) THEN
    PERFORM 1 FROM public.approval_request ar JOIN public.app_user decider ON decider.tenant_id=ar.tenant_id AND decider.id=ar.decided_by AND decider.status='active'
      WHERE ar.tenant_id=p_tenant AND ar.id=p_approval AND ar.kind='india_gst_legal_buyer_override' AND ar.subject_type='folio' AND ar.subject_id=p_folio
        AND ar.status='approved' AND ar.requested_by=p_actor AND ar.decided_by<>p_actor AND ar.decided_at IS NOT NULL
        AND ar.payload=jsonb_build_object('propertyNode',p_property::text,'reservationId',p_reservation::text,'folioId',p_folio::text,'windowNo',v_folio.window_no,'buyerPartyId',p_buyer::text,'requestHash',p_request_hash,'order341EvidenceHash',p_order341_hash)
      FOR UPDATE OF ar;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='exact different-user buyer approval unavailable'; END IF;
  ELSIF p_approval IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='related buyer must not consume override approval'; END IF;
  IF p_expected IS NOT NULL THEN
    SELECT * INTO v_current FROM public.india_gst_accommodation_final_valuation c WHERE c.tenant_id=p_tenant AND c.id=p_expected AND c.evidence_hash=p_expected_hash AND c.reservation_id=p_reservation AND c.folio_id=p_folio AND NOT EXISTS(SELECT 1 FROM public.india_gst_accommodation_final_valuation n WHERE n.tenant_id=c.tenant_id AND n.supersedes_valuation_id=c.id) FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='expected current valuation is stale'; END IF; v_generation:=v_current.generation+1;
  ELSIF EXISTS(SELECT 1 FROM public.india_gst_accommodation_final_valuation WHERE tenant_id=p_tenant AND reservation_id=p_reservation AND folio_id=p_folio) THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='initial valuation already exists';
  END IF;
  v_source_count:=coalesce(array_length(p_source_ids,1),0); v_room_count:=coalesce(array_length(p_room_ordinals,1),0);
  IF v_source_count=0 OR v_room_count=0 OR v_room_count>366 OR array_length(p_source_kinds,1)<>v_source_count OR array_length(p_source_hashes,1)<>v_source_count OR array_length(p_source_eligibility,1)<>v_source_count OR array_length(p_room_dates,1)<>v_room_count OR array_length(p_room_weights,1)<>v_room_count OR (SELECT count(DISTINCT x) FROM unnest(p_source_ids)x)<>v_source_count OR (SELECT count(DISTINCT x) FROM unnest(p_room_ordinals)x)<>v_room_count OR (SELECT count(DISTINCT x) FROM unnest(p_room_dates)x)<>v_room_count THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='valuation evidence arrays are incomplete'; END IF;
  IF p_disposition='ordinary_final' AND array_length(p_allocations,1)<>v_source_count*v_room_count THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='ordinary allocations are incomplete'; END IF;
  IF (SELECT count(DISTINCT coalesce(line.folio_transfer_root_line_id,line.id)) FROM public.posting_line line JOIN public.journal j ON j.tenant_id=line.tenant_id AND j.id=line.journal_id JOIN public.tx_code code ON code.code=line.tx_code
      WHERE line.tenant_id=p_tenant AND line.folio_id=p_folio AND j.currency='INR' AND code.grp IN ('revenue','adjustment')
        AND NOT EXISTS(SELECT 1 FROM public.journal reversal WHERE reversal.tenant_id=j.tenant_id AND reversal.reverses=j.id)) <> v_source_count
     OR EXISTS(SELECT 1 FROM (SELECT DISTINCT coalesce(line.folio_transfer_root_line_id,line.id) root_id FROM public.posting_line line JOIN public.journal j ON j.tenant_id=line.tenant_id AND j.id=line.journal_id JOIN public.tx_code code ON code.code=line.tx_code
      WHERE line.tenant_id=p_tenant AND line.folio_id=p_folio AND j.currency='INR' AND code.grp IN ('revenue','adjustment') AND NOT EXISTS(SELECT 1 FROM public.journal reversal WHERE reversal.tenant_id=j.tenant_id AND reversal.reverses=j.id)) complete WHERE NOT complete.root_id=ANY(p_source_ids))
  THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='requested posting roots are not the complete consideration set'; END IF;
  SELECT encode(digest(string_agg(x::text,',' ORDER BY x),'sha256'),'hex') INTO v_source_set_hash FROM unnest(p_source_ids) x;
  FOR v_i IN 1..v_source_count LOOP
    PERFORM 1 FROM public.posting_line line JOIN public.journal j ON j.tenant_id=line.tenant_id AND j.id=line.journal_id
      WHERE line.tenant_id=p_tenant AND coalesce(line.folio_transfer_root_line_id,line.id)=p_source_ids[v_i] AND line.folio_id=p_folio
      ORDER BY line.id FOR SHARE OF line,j;
    SELECT sum(line.amount_minor)::numeric,encode(digest(string_agg(line.id::text||':'||line.amount_minor::text||':'||line.journal_id::text,',' ORDER BY line.id),'sha256'),'hex'),min(line.tx_code)
      INTO v_amount,v_frag_hash,v_tx FROM public.posting_line line JOIN public.journal j ON j.tenant_id=line.tenant_id AND j.id=line.journal_id
      WHERE line.tenant_id=p_tenant AND coalesce(line.folio_transfer_root_line_id,line.id)=p_source_ids[v_i] AND line.folio_id=p_folio
        AND j.currency='INR' AND NOT EXISTS(SELECT 1 FROM public.journal reversal WHERE reversal.tenant_id=j.tenant_id AND reversal.reverses=j.id);
    IF v_amount IS NULL OR v_amount=0 OR v_amount NOT BETWEEN -9223372036854775808::numeric AND 9223372036854775807::numeric THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='posting source is unavailable or unsafe'; END IF;
    IF (p_source_kinds[v_i] IN ('promotion_discount','section15_3_discount')) <> (v_amount<0) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='source classification sign conflicts'; END IF;
    v_source_amounts:=array_append(v_source_amounts,v_amount::bigint); v_fragment_hashes:=array_append(v_fragment_hashes,v_frag_hash); v_tx_codes:=array_append(v_tx_codes,v_tx);
    v_total:=v_total+v_amount;
  END LOOP;
  IF v_total NOT BETWEEN -9223372036854775808::numeric AND 9223372036854775807::numeric THEN RAISE EXCEPTION USING ERRCODE='22003',MESSAGE='valuation total exceeds signed int64'; END IF;
  INSERT INTO public.india_gst_accommodation_final_valuation(tenant_id,id,property_node,reservation_id,folio_id,folio_account_id,window_no,buyer_party_id,attribution_id,request_id,generation,disposition,currency,transaction_value_minor,source_set_hash,order341_evidence_hash,request_hash,evidence_hash,ordinary_evidence_hashes,manual_reasons,approval_request_id,supersedes_valuation_id,actor_id)
  VALUES(p_tenant,v_id,p_property,p_reservation,p_folio,v_folio.account_id,v_folio.window_no,p_buyer,p_attribution,p_request,v_generation,p_disposition,'INR',CASE WHEN p_disposition='ordinary_final' THEN v_total::bigint ELSE NULL END,v_source_set_hash,p_order341_hash,p_request_hash,p_evidence_hash,p_ordinary_hashes,p_manual_reasons,p_approval,p_expected,p_actor);
  FOR v_i IN 1..v_source_count LOOP
    INSERT INTO public.india_gst_accommodation_valuation_source VALUES(p_tenant,v_id,p_source_ids[v_i],p_source_kinds[v_i],v_source_amounts[v_i],'INR',v_tx_codes[v_i],v_fragment_hashes[v_i],p_source_hashes[v_i],nullif(p_source_eligibility[v_i],''));
  END LOOP;
  FOR v_j IN 1..v_room_count LOOP
    v_night_total:=NULL;
    IF p_disposition='ordinary_final' THEN
      v_night_total:=0; FOR v_i IN 1..v_source_count LOOP v_night_total:=v_night_total+p_allocations[(v_i-1)*v_room_count+v_j]; END LOOP;
      IF v_night_total<=0 OR v_night_total NOT BETWEEN 1 AND 9223372036854775807::numeric THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='ordinary room-night value must be positive'; END IF;
    END IF;
    INSERT INTO public.india_gst_accommodation_valuation_room_night VALUES(p_tenant,v_id,p_room_ordinals[v_j],p_room_dates[v_j],p_room_weights[v_j],v_night_total::bigint,'INR');
  END LOOP;
  IF p_disposition='ordinary_final' THEN
    FOR v_i IN 1..v_source_count LOOP FOR v_j IN 1..v_room_count LOOP
      IF p_allocations[(v_i-1)*v_room_count+v_j]<>0 THEN INSERT INTO public.india_gst_accommodation_valuation_allocation VALUES(p_tenant,v_id,p_source_ids[v_i],p_room_ordinals[v_j],p_allocations[(v_i-1)*v_room_count+v_j],'INR'); END IF;
    END LOOP; END LOOP;
    IF EXISTS(SELECT 1 FROM public.india_gst_accommodation_valuation_source s WHERE s.tenant_id=p_tenant AND s.valuation_id=v_id AND s.current_amount_minor<>(SELECT coalesce(sum(a.amount_minor),0) FROM public.india_gst_accommodation_valuation_allocation a WHERE a.tenant_id=s.tenant_id AND a.valuation_id=s.valuation_id AND a.posting_root_id=s.posting_root_id)) THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='source allocation does not reconcile'; END IF;
  END IF;
  SELECT (transaction_timestamp() AT TIME ZONE timezone)::date INTO v_date FROM public.org_node WHERE tenant_id=p_tenant AND id=p_property;
  INSERT INTO public.fact_log(tenant_id,entity_type,entity_id,fact_type,valid_from,business_date,actor_id,payload,supersedes) VALUES(p_tenant,'india_gst_accommodation_final_valuation',v_id,'recorded',transaction_timestamp(),v_date,p_actor,jsonb_build_object('valuationId',v_id,'disposition',p_disposition,'evidenceHash',p_evidence_hash),(SELECT id FROM public.fact_log WHERE tenant_id=p_tenant AND entity_type='india_gst_accommodation_final_valuation' AND entity_id=p_expected ORDER BY recorded_at DESC LIMIT 1)) RETURNING id INTO v_fact;
  INSERT INTO public.outbox(tenant_id,property_node,business_date,aggregate_type,aggregate_id,event_type,actor_id,correlation_id,payload) VALUES(p_tenant,p_property,v_date,'india_gst_accommodation_final_valuation',v_id,'india_gst.accommodation_final_valuation_recorded',p_actor,p_request,jsonb_build_object('valuationId',v_id,'reservationId',p_reservation,'folioId',p_folio,'windowNo',v_folio.window_no,'buyerPartyId',p_buyer,'generation',v_generation,'disposition',p_disposition,'evidenceHash',p_evidence_hash));
  RETURN QUERY SELECT v_id,v_generation,p_disposition,CASE WHEN p_disposition='ordinary_final' THEN v_total::bigint ELSE NULL END,p_evidence_hash;
END $$;
ALTER FUNCTION public.record_india_gst_accommodation_final_valuation(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,text,text,text,uuid,text,uuid,text[],text[],uuid[],text[],text[],text[],integer[],date[],bigint[],bigint[]) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.record_india_gst_accommodation_final_valuation(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,text,text,text,uuid,text,uuid,text[],text[],uuid[],text[],text[],text[],integer[],date[],bigint[],bigint[]) FROM PUBLIC,app_role,yellow_runtime;
GRANT EXECUTE ON FUNCTION public.record_india_gst_accommodation_final_valuation(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,text,text,text,uuid,text,uuid,text[],text[],uuid[],text[],text[],text[],integer[],date[],bigint[],bigint[]) TO app_role;
