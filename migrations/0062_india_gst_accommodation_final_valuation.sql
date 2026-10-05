-- Order 350: immutable India accommodation final-valuation evidence only.
ALTER TABLE public.folio
  ADD CONSTRAINT folio_tenant_id_uq UNIQUE (tenant_id,id);

ALTER TABLE public.approval_request
  ADD COLUMN valid_until timestamptz,
  ADD CONSTRAINT approval_request_buyer_override_validity_ck CHECK (
    kind <> 'india_gst_legal_buyer_override'
    OR valid_until IS NOT NULL AND valid_until > created_at
  );

INSERT INTO public.permission(code,description)
VALUES('tax-fiscal.india-valuation:finalize','Finalize governed India accommodation valuation evidence')
ON CONFLICT(code) DO UPDATE SET description=EXCLUDED.description;

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
  relationship_conclusion text,
  consideration_conclusion text,
  section15_2_conclusion text,
  section15_3_conclusion text,
  source_completeness_conclusion text,
  attestation_evidence_source text,
  attestation_evidence_reference text,
  relationship_set_hash text NOT NULL CHECK (relationship_set_hash ~ '^[0-9a-f]{64}$'),
  attested_by uuid NOT NULL,
  attested_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
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
      AND relationship_conclusion='unrelated_not_distinct' AND consideration_conclusion='money_only'
      AND section15_2_conclusion='all_additions_enumerated' AND section15_3_conclusion='all_discounts_eligible'
      AND source_completeness_conclusion='all_sources_classified' AND attestation_evidence_source IS NOT NULL AND attestation_evidence_reference IS NOT NULL
      OR disposition='manual_valuation_required' AND transaction_value_minor IS NULL AND cardinality(manual_reasons)>0
      AND relationship_conclusion IS NULL AND consideration_conclusion IS NULL AND section15_2_conclusion IS NULL AND section15_3_conclusion IS NULL
      AND source_completeness_conclusion IS NULL AND attestation_evidence_source IS NULL AND attestation_evidence_reference IS NULL)
    AND NOT (ordinary_evidence_hashes && manual_reasons)
    AND manual_reasons <@ ARRAY['related_person','distinct_person','non_money_consideration','pure_agent','special_supply_rules_27_35','tax_inclusive','omitted_section15_2_addition','ineligible_section15_3_discount','indeterminable_section15_3_discount','incomplete_source_classification','other_indeterminable_governed_evidence']::text[]
    AND (attestation_evidence_source IS NULL OR attestation_evidence_source ~ '^[a-z][a-z0-9_.:-]{2,63}$')
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
  ,FOREIGN KEY (tenant_id,attested_by) REFERENCES public.app_user(tenant_id,id)
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
  addition_subtype text,
  discount_eligibility text,
  evidence_source text NOT NULL CHECK (evidence_source ~ '^[a-z][a-z0-9_.:-]{2,63}$'),
  evidence_reference text NOT NULL CHECK (length(evidence_reference) BETWEEN 1 AND 200),
  attested_by uuid NOT NULL,
  attested_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (tenant_id,valuation_id,posting_root_id),
  FOREIGN KEY (tenant_id,valuation_id) REFERENCES public.india_gst_accommodation_final_valuation(tenant_id,id),
  FOREIGN KEY (tenant_id,posting_root_id) REFERENCES public.posting_line(tenant_id,id),
  FOREIGN KEY (tx_code) REFERENCES public.tx_code(code)
  ,FOREIGN KEY (tenant_id,attested_by) REFERENCES public.app_user(tenant_id,id),
  CHECK ((source_kind='section15_2_addition')=(addition_subtype IN ('tax_duty_cess_fee_charge_excluding_gst','supplier_liability_paid_by_recipient','incidental_expense','interest_late_fee_penalty','non_government_price_linked_subsidy'))),
  CHECK ((source_kind='section15_3_discount')=(discount_eligibility IN ('eligible_pre_supply_recorded','eligible_post_supply_linked_itc_reversed','ineligible','indeterminable')))
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
  p_tenant uuid,p_property uuid,p_reservation uuid,p_folio uuid,p_buyer uuid,p_attribution uuid,p_lineage uuid,
  p_request uuid,p_actor uuid,p_disposition text,p_order341_hash text,p_request_hash text,
  p_expected uuid,p_expected_hash text,p_approval uuid,
  p_relationship text,p_consideration text,p_section152 text,p_section153 text,p_source_completeness text,p_attestation_source text,p_attestation_reference text,p_manual_reasons text[],
  p_source_ids uuid[],p_source_kinds text[],p_source_additions text[],p_source_discounts text[],p_source_evidence_sources text[],p_source_evidence_references text[],
  p_room_ordinals integer[],p_room_dates date[],p_room_weights bigint[],p_allocations bigint[]
) RETURNS TABLE(valuation_id uuid,generation integer,disposition text,transaction_value_minor bigint,evidence_hash text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE
  v_folio public.folio%ROWTYPE; v_res public.reservation%ROWTYPE; v_id uuid:=gen_random_uuid();
  v_generation integer:=0; v_total numeric:=0; v_source_count integer; v_room_count integer;
  v_i integer; v_j integer; v_amount numeric; v_frag_hash text; v_tx text; v_fact uuid; v_date date; v_night_total numeric;
  v_source_amounts bigint[]:='{}'; v_fragment_hashes text[]:='{}'; v_tx_codes text[]:='{}';
  v_source_set_hash text; v_relationship_set_hash text; v_evidence_hash text; v_ordinary_hashes text[]:='{}'; v_current public.india_gst_accommodation_final_valuation%ROWTYPE;
  v_candidates uuid[]:='{}'; v_group_party uuid; v_known_relationship boolean;
BEGIN
  IF p_tenant IS DISTINCT FROM current_setting('app.tenant_id',true)::uuid THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='tenant context mismatch'; END IF;
  IF p_order341_hash !~ '^[0-9a-f]{64}$' OR p_request_hash !~ '^[0-9a-f]{64}$'
  THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='valuation hashes are non-canonical'; END IF;
  PERFORM 1 FROM public.app_user actor JOIN public.user_role ur ON ur.tenant_id=actor.tenant_id AND ur.user_id=actor.id JOIN public.role_permission rp ON rp.role_id=ur.role_id AND rp.permission_code='tax-fiscal.india-valuation:finalize' JOIN public.org_node grant_node ON grant_node.tenant_id=ur.tenant_id AND grant_node.id=ur.scope_node JOIN public.org_node property ON property.tenant_id=actor.tenant_id AND property.id=p_property AND grant_node.path @> property.path WHERE actor.tenant_id=p_tenant AND actor.id=p_actor AND actor.status='active'; IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='actor lacks property valuation authority'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant::text||p_reservation::text||p_folio::text,0));
  SELECT * INTO v_res FROM public.reservation WHERE tenant_id=p_tenant AND id=p_reservation AND property_node=p_property FOR SHARE;
  SELECT * INTO v_folio FROM public.folio WHERE tenant_id=p_tenant AND id=p_folio AND reservation_id=p_reservation AND status='open' FOR UPDATE;
  IF NOT FOUND OR v_res.id IS NULL THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='valuation scope unavailable'; END IF;
  PERFORM 1 FROM public.account WHERE tenant_id=p_tenant AND id=v_folio.account_id AND status='open' AND currency='INR' FOR SHARE; IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='INR folio account unavailable'; END IF;
  PERFORM 1
    FROM public.tax_attribution_reservation_binding lineage
    JOIN public.tax_attribution_hold_binding hold_binding ON hold_binding.tenant_id=lineage.tenant_id AND hold_binding.id=lineage.binding_id AND hold_binding.property_node=lineage.property_node AND hold_binding.hold_id=lineage.hold_id AND hold_binding.attribution_id=lineage.attribution_id AND hold_binding.sellable_unit_id=lineage.sellable_unit_id AND hold_binding.period=lineage.period AND hold_binding.origin_quote_hash=lineage.origin_quote_hash AND hold_binding.snapshot_hash=lineage.snapshot_hash AND hold_binding.currency=lineage.currency
    JOIN public.hold h ON h.tenant_id=lineage.tenant_id AND h.id=lineage.hold_id AND h.property_node=lineage.property_node AND h.sellable_unit_id=lineage.sellable_unit_id AND h.period=lineage.period AND h.status='consumed'
    JOIN public.reservation_segment segment ON segment.tenant_id=lineage.tenant_id AND segment.id=lineage.segment_id AND segment.reservation_id=lineage.reservation_id AND segment.sellable_unit_id=lineage.sellable_unit_id AND segment.period=lineage.period
    JOIN public.tax_attribution_snapshot attribution ON attribution.tenant_id=lineage.tenant_id AND attribution.id=lineage.attribution_id AND attribution.property_node=lineage.property_node AND attribution.origin_kind='rate_quote' AND attribution.origin_quote_hash=lineage.origin_quote_hash AND attribution.snapshot_hash=lineage.snapshot_hash AND attribution.currency=lineage.currency
   WHERE lineage.tenant_id=p_tenant AND lineage.id=p_lineage AND lineage.property_node=p_property AND lineage.attribution_id=p_attribution AND lineage.reservation_id=p_reservation AND lineage.currency='INR'
   FOR SHARE OF lineage,hold_binding,h,segment,attribution;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Order244 attribution lineage is unavailable'; END IF;
  PERFORM 1 FROM public.party p JOIN public.party_role r ON r.tenant_id=p.tenant_id AND r.party_id=p.id AND r.role IN ('guest','company') WHERE p.tenant_id=p_tenant AND p.id=p_buyer AND p.status='active' FOR SHARE OF p;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='legal buyer unavailable'; END IF;
  SELECT rg.account_party INTO v_group_party FROM public.reservation_group rg WHERE rg.tenant_id=p_tenant AND rg.id=v_res.group_id FOR SHARE;
  SELECT coalesce(array_agg(DISTINCT candidate ORDER BY candidate) FILTER(WHERE candidate IS NOT NULL),'{}') INTO v_candidates FROM unnest(ARRAY[v_res.primary_party,v_res.booker_party,(SELECT party_id FROM public.account WHERE tenant_id=p_tenant AND id=v_folio.account_id),v_group_party]) candidate;
  SELECT encode(digest(coalesce(string_agg(candidate::text,',' ORDER BY candidate),''),'sha256'),'hex') INTO v_relationship_set_hash FROM unnest(v_candidates) candidate;
  PERFORM 1 FROM public.party_relationship rel WHERE rel.tenant_id=p_tenant AND (rel.from_party=p_buyer OR rel.to_party=p_buyer) ORDER BY rel.from_party,rel.to_party,rel.kind FOR SHARE;
  v_known_relationship:=FOUND;
  IF p_relationship='unrelated_not_distinct' AND v_known_relationship THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='ordinary relationship attestation contradicts persisted relationship'; END IF;
  IF NOT p_buyer=ANY(v_candidates) THEN
    PERFORM 1 FROM public.approval_request ar JOIN public.app_user decider ON decider.tenant_id=ar.tenant_id AND decider.id=ar.decided_by AND decider.status='active'
      WHERE ar.tenant_id=p_tenant AND ar.id=p_approval AND ar.kind='india_gst_legal_buyer_override' AND ar.subject_type='folio' AND ar.subject_id=p_folio
        AND ar.status='approved' AND ar.requested_by=p_actor AND ar.decided_by<>p_actor AND ar.decided_at IS NOT NULL
        AND ar.decided_at<=transaction_timestamp() AND ar.decided_at<ar.valid_until AND ar.valid_until > transaction_timestamp()
        AND ar.payload=jsonb_build_object('propertyNode',p_property::text,'reservationId',p_reservation::text,'folioId',p_folio::text,'windowNo',v_folio.window_no,'buyerPartyId',p_buyer::text,'relationshipSetHash',v_relationship_set_hash,'requestHash',p_request_hash,'order341EvidenceHash',p_order341_hash)
      FOR UPDATE OF ar;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='exact different-user buyer approval unavailable'; END IF;
  ELSIF p_approval IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='related buyer must not consume override approval'; END IF;
  IF p_disposition='ordinary_final' THEN
    IF p_relationship<>'unrelated_not_distinct' OR p_consideration<>'money_only' OR p_section152<>'all_additions_enumerated' OR p_section153<>'all_discounts_eligible' OR p_source_completeness<>'all_sources_classified' OR p_attestation_source !~ '^[a-z][a-z0-9_.:-]{2,63}$' OR length(p_attestation_reference) NOT BETWEEN 1 AND 200 OR cardinality(p_manual_reasons)<>0 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='ordinary attestation is incomplete'; END IF;
    v_ordinary_hashes:=ARRAY[
      encode(digest('relationship:'||p_relationship||':'||p_attestation_source||':'||p_attestation_reference,'sha256'),'hex'),
      encode(digest('consideration:'||p_consideration||':'||p_attestation_source||':'||p_attestation_reference,'sha256'),'hex'),
      encode(digest('section152:'||p_section152||':'||p_attestation_source||':'||p_attestation_reference,'sha256'),'hex'),
      encode(digest('section153:'||p_section153||':'||p_attestation_source||':'||p_attestation_reference,'sha256'),'hex'),
      encode(digest('source-completeness:'||p_source_completeness||':'||p_attestation_source||':'||p_attestation_reference,'sha256'),'hex')];
  ELSIF p_disposition='manual_valuation_required' THEN
    IF cardinality(p_manual_reasons)=0 OR p_relationship IS NOT NULL OR p_consideration IS NOT NULL OR p_section152 IS NOT NULL OR p_section153 IS NOT NULL OR p_source_completeness IS NOT NULL OR p_attestation_source IS NOT NULL OR p_attestation_reference IS NOT NULL OR NOT p_manual_reasons <@ ARRAY['related_person','distinct_person','non_money_consideration','pure_agent','special_supply_rules_27_35','tax_inclusive','omitted_section15_2_addition','ineligible_section15_3_discount','indeterminable_section15_3_discount','incomplete_source_classification','other_indeterminable_governed_evidence']::text[] THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='manual attestation partition is invalid'; END IF;
  ELSE RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='valuation disposition is invalid'; END IF;
  IF p_expected IS NOT NULL THEN
    SELECT * INTO v_current FROM public.india_gst_accommodation_final_valuation c WHERE c.tenant_id=p_tenant AND c.id=p_expected AND c.evidence_hash=p_expected_hash AND c.reservation_id=p_reservation AND c.folio_id=p_folio AND NOT EXISTS(SELECT 1 FROM public.india_gst_accommodation_final_valuation n WHERE n.tenant_id=c.tenant_id AND n.supersedes_valuation_id=c.id) FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='expected current valuation is stale'; END IF; v_generation:=v_current.generation+1;
  ELSIF EXISTS(SELECT 1 FROM public.india_gst_accommodation_final_valuation WHERE tenant_id=p_tenant AND reservation_id=p_reservation AND folio_id=p_folio) THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='initial valuation already exists';
  END IF;
  v_source_count:=coalesce(array_length(p_source_ids,1),0); v_room_count:=coalesce(array_length(p_room_ordinals,1),0);
  IF v_source_count=0 OR v_room_count=0 OR v_room_count>366 OR array_length(p_source_kinds,1)<>v_source_count OR array_length(p_source_additions,1)<>v_source_count OR array_length(p_source_discounts,1)<>v_source_count OR array_length(p_source_evidence_sources,1)<>v_source_count OR array_length(p_source_evidence_references,1)<>v_source_count OR array_length(p_room_dates,1)<>v_room_count OR array_length(p_room_weights,1)<>v_room_count OR (SELECT count(DISTINCT x) FROM unnest(p_source_ids)x)<>v_source_count OR (SELECT count(DISTINCT x) FROM unnest(p_room_ordinals)x)<>v_room_count OR (SELECT count(DISTINCT x) FROM unnest(p_room_dates)x)<>v_room_count THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='valuation evidence arrays are incomplete'; END IF;
  IF p_disposition='ordinary_final' AND array_length(p_allocations,1)<>v_source_count*v_room_count THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='ordinary allocations are incomplete'; END IF;
  IF (WITH complete AS (
        SELECT root.id AS root_id
          FROM public.posting_line root
          JOIN public.journal root_journal ON root_journal.tenant_id=root.tenant_id AND root_journal.id=root.journal_id
          JOIN public.tx_code code ON code.code=root.tx_code
          JOIN public.posting_line fragment ON fragment.tenant_id=root.tenant_id AND coalesce(fragment.folio_transfer_root_line_id,fragment.id)=root.id
          JOIN public.journal fragment_journal ON fragment_journal.tenant_id=fragment.tenant_id AND fragment_journal.id=fragment.journal_id
         WHERE root.tenant_id=p_tenant AND root.folio_transfer_root_line_id IS NULL AND root.account_id=v_folio.account_id
           AND root_journal.currency='INR' AND fragment_journal.currency='INR' AND code.grp IN ('revenue','adjustment')
           AND NOT EXISTS(SELECT 1 FROM public.journal reversal WHERE reversal.tenant_id=root_journal.tenant_id AND reversal.reverses=root_journal.id)
         GROUP BY root.id HAVING sum(fragment.amount_minor) FILTER(WHERE fragment.folio_id=p_folio)<>0)
      SELECT count(*) FROM complete) <> v_source_count
     OR EXISTS(WITH complete AS (
        SELECT root.id AS root_id
          FROM public.posting_line root
          JOIN public.journal root_journal ON root_journal.tenant_id=root.tenant_id AND root_journal.id=root.journal_id
          JOIN public.tx_code code ON code.code=root.tx_code
          JOIN public.posting_line fragment ON fragment.tenant_id=root.tenant_id AND coalesce(fragment.folio_transfer_root_line_id,fragment.id)=root.id
          JOIN public.journal fragment_journal ON fragment_journal.tenant_id=fragment.tenant_id AND fragment_journal.id=fragment.journal_id
         WHERE root.tenant_id=p_tenant AND root.folio_transfer_root_line_id IS NULL AND root.account_id=v_folio.account_id
           AND root_journal.currency='INR' AND fragment_journal.currency='INR' AND code.grp IN ('revenue','adjustment')
           AND NOT EXISTS(SELECT 1 FROM public.journal reversal WHERE reversal.tenant_id=root_journal.tenant_id AND reversal.reverses=root_journal.id)
         GROUP BY root.id HAVING sum(fragment.amount_minor) FILTER(WHERE fragment.folio_id=p_folio)<>0)
      SELECT 1 FROM complete WHERE NOT complete.root_id=ANY(p_source_ids))
  THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='requested posting roots are not the complete consideration set'; END IF;
  SELECT encode(digest(string_agg(x::text,',' ORDER BY x),'sha256'),'hex') INTO v_source_set_hash FROM unnest(p_source_ids) x;
  FOR v_i IN 1..v_source_count LOOP
    PERFORM 1 FROM public.posting_line fragment JOIN public.journal j ON j.tenant_id=fragment.tenant_id AND j.id=fragment.journal_id
      WHERE fragment.tenant_id=p_tenant AND coalesce(fragment.folio_transfer_root_line_id,fragment.id)=p_source_ids[v_i]
      ORDER BY fragment.id FOR SHARE OF fragment,j;
    IF EXISTS(
      SELECT 1 FROM public.posting_line fragment JOIN public.journal transfer ON transfer.tenant_id=fragment.tenant_id AND transfer.id=fragment.journal_id
       WHERE fragment.tenant_id=p_tenant AND fragment.folio_transfer_root_line_id=p_source_ids[v_i] AND transfer.kind='transfer'
       GROUP BY transfer.id
       HAVING count(*)<>2 OR count(DISTINCT fragment.folio_id)<>2 OR sum(fragment.amount_minor)<>0 OR count(DISTINCT fragment.account_id)<>1
    ) THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='posting transfer family is ambiguous'; END IF;
    SELECT sum(fragment.amount_minor) FILTER(WHERE fragment.folio_id=p_folio)::numeric,
           encode(digest(string_agg(fragment.id::text||':'||fragment.amount_minor::text||':'||fragment.journal_id::text||':'||coalesce(fragment.folio_id::text,'-'),',' ORDER BY fragment.id),'sha256'),'hex'),root.tx_code
      INTO v_amount,v_frag_hash,v_tx
      FROM public.posting_line root
      JOIN public.posting_line fragment ON fragment.tenant_id=root.tenant_id AND coalesce(fragment.folio_transfer_root_line_id,fragment.id)=root.id
      JOIN public.journal j ON j.tenant_id=fragment.tenant_id AND j.id=fragment.journal_id
     WHERE root.tenant_id=p_tenant AND root.id=p_source_ids[v_i] AND root.folio_transfer_root_line_id IS NULL
       AND root.account_id=v_folio.account_id AND j.currency='INR'
     GROUP BY root.id,root.tx_code;
    IF v_amount IS NULL OR v_amount=0 OR v_amount NOT BETWEEN -9223372036854775808::numeric AND 9223372036854775807::numeric THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='posting source is unavailable or unsafe'; END IF;
    IF (p_source_kinds[v_i] IN ('promotion_discount','section15_3_discount')) <> (v_amount<0) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='source classification sign conflicts'; END IF;
    IF p_source_kinds[v_i] NOT IN ('room_consideration','package_consideration','promotion_discount','fee_consideration','section15_2_addition','section15_3_discount') OR p_source_evidence_sources[v_i] !~ '^[a-z][a-z0-9_.:-]{2,63}$' OR length(p_source_evidence_references[v_i]) NOT BETWEEN 1 AND 200 OR (p_source_kinds[v_i]='section15_2_addition')<>(p_source_additions[v_i] IN ('tax_duty_cess_fee_charge_excluding_gst','supplier_liability_paid_by_recipient','incidental_expense','interest_late_fee_penalty','non_government_price_linked_subsidy')) OR (p_source_kinds[v_i]='section15_3_discount')<>(p_source_discounts[v_i] IN ('eligible_pre_supply_recorded','eligible_post_supply_linked_itc_reversed','ineligible','indeterminable')) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='source attestation is incomplete'; END IF;
    IF p_disposition='ordinary_final' AND p_source_kinds[v_i]='section15_3_discount' AND p_source_discounts[v_i] NOT IN ('eligible_pre_supply_recorded','eligible_post_supply_linked_itc_reversed') THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='ordinary discount is not eligible'; END IF;
    IF p_expected IS NOT NULL AND EXISTS(SELECT 1 FROM public.india_gst_accommodation_valuation_source prior WHERE prior.tenant_id=p_tenant AND prior.valuation_id=p_expected AND prior.posting_root_id=p_source_ids[v_i] AND (prior.source_kind<>p_source_kinds[v_i] OR prior.addition_subtype IS DISTINCT FROM nullif(p_source_additions[v_i],'') OR prior.discount_eligibility IS DISTINCT FROM nullif(p_source_discounts[v_i],'') OR prior.evidence_source<>p_source_evidence_sources[v_i] OR prior.evidence_reference<>p_source_evidence_references[v_i])) THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='correction cannot reclassify an existing posting root'; END IF;
    v_source_amounts:=array_append(v_source_amounts,v_amount::bigint); v_fragment_hashes:=array_append(v_fragment_hashes,v_frag_hash); v_tx_codes:=array_append(v_tx_codes,v_tx);
    v_total:=v_total+v_amount;
  END LOOP;
  IF v_total NOT BETWEEN -9223372036854775808::numeric AND 9223372036854775807::numeric THEN RAISE EXCEPTION USING ERRCODE='22003',MESSAGE='valuation total exceeds signed int64'; END IF;
  v_evidence_hash:=encode(digest('v2:'||p_tenant::text||':'||p_request_hash||':'||v_source_set_hash||':'||v_relationship_set_hash||':'||array_to_string(v_fragment_hashes,',')||':'||array_to_string(v_ordinary_hashes,',')||':'||array_to_string(p_manual_reasons,','),'sha256'),'hex');
  INSERT INTO public.india_gst_accommodation_final_valuation(tenant_id,id,property_node,reservation_id,folio_id,folio_account_id,window_no,buyer_party_id,attribution_id,request_id,generation,disposition,currency,transaction_value_minor,source_set_hash,order341_evidence_hash,request_hash,evidence_hash,ordinary_evidence_hashes,manual_reasons,relationship_conclusion,consideration_conclusion,section15_2_conclusion,section15_3_conclusion,source_completeness_conclusion,attestation_evidence_source,attestation_evidence_reference,relationship_set_hash,attested_by,approval_request_id,supersedes_valuation_id,actor_id)
  VALUES(p_tenant,v_id,p_property,p_reservation,p_folio,v_folio.account_id,v_folio.window_no,p_buyer,p_attribution,p_request,v_generation,p_disposition,'INR',CASE WHEN p_disposition='ordinary_final' THEN v_total::bigint ELSE NULL END,v_source_set_hash,p_order341_hash,p_request_hash,v_evidence_hash,v_ordinary_hashes,p_manual_reasons,p_relationship,p_consideration,p_section152,p_section153,p_source_completeness,p_attestation_source,p_attestation_reference,v_relationship_set_hash,p_actor,p_approval,p_expected,p_actor);
  FOR v_i IN 1..v_source_count LOOP
    INSERT INTO public.india_gst_accommodation_valuation_source(tenant_id,valuation_id,posting_root_id,source_kind,current_amount_minor,currency,tx_code,current_fragment_set_hash,classification_evidence_hash,eligibility_evidence_hash,addition_subtype,discount_eligibility,evidence_source,evidence_reference,attested_by)
    VALUES(p_tenant,v_id,p_source_ids[v_i],p_source_kinds[v_i],v_source_amounts[v_i],'INR',v_tx_codes[v_i],v_fragment_hashes[v_i],encode(digest(p_source_ids[v_i]::text||':'||p_source_kinds[v_i]||':'||p_source_additions[v_i]||':'||p_source_discounts[v_i]||':'||p_source_evidence_sources[v_i]||':'||p_source_evidence_references[v_i]||':'||p_actor::text,'sha256'),'hex'),CASE WHEN p_source_kinds[v_i]='section15_3_discount' THEN encode(digest(p_source_ids[v_i]::text||':'||p_source_discounts[v_i]||':'||p_source_evidence_sources[v_i]||':'||p_source_evidence_references[v_i],'sha256'),'hex') END,nullif(p_source_additions[v_i],''),nullif(p_source_discounts[v_i],''),p_source_evidence_sources[v_i],p_source_evidence_references[v_i],p_actor);
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
  INSERT INTO public.fact_log(tenant_id,entity_type,entity_id,fact_type,valid_from,business_date,actor_id,payload,supersedes) VALUES(p_tenant,'india_gst_accommodation_final_valuation',v_id,'recorded',transaction_timestamp(),v_date,p_actor,jsonb_build_object('valuationId',v_id,'disposition',p_disposition,'evidenceHash',v_evidence_hash),(SELECT id FROM public.fact_log WHERE tenant_id=p_tenant AND entity_type='india_gst_accommodation_final_valuation' AND entity_id=p_expected ORDER BY recorded_at DESC LIMIT 1)) RETURNING id INTO v_fact;
  INSERT INTO public.outbox(tenant_id,property_node,business_date,aggregate_type,aggregate_id,event_type,actor_id,correlation_id,payload) VALUES(p_tenant,p_property,v_date,'india_gst_accommodation_final_valuation',v_id,'india_gst.accommodation_final_valuation_recorded',p_actor,p_request,jsonb_build_object('valuationId',v_id,'reservationId',p_reservation,'folioId',p_folio,'windowNo',v_folio.window_no,'buyerPartyId',p_buyer,'generation',v_generation,'disposition',p_disposition,'evidenceHash',v_evidence_hash));
  RETURN QUERY SELECT v_id,v_generation,p_disposition,CASE WHEN p_disposition='ordinary_final' THEN v_total::bigint ELSE NULL END,v_evidence_hash;
END $$;
ALTER FUNCTION public.record_india_gst_accommodation_final_valuation(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,text,text,uuid,text,uuid,text,text,text,text,text,text,text,text[],uuid[],text[],text[],text[],text[],text[],integer[],date[],bigint[],bigint[]) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.record_india_gst_accommodation_final_valuation(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,text,text,uuid,text,uuid,text,text,text,text,text,text,text,text[],uuid[],text[],text[],text[],text[],text[],integer[],date[],bigint[],bigint[]) FROM PUBLIC,app_role,yellow_runtime;
GRANT EXECUTE ON FUNCTION public.record_india_gst_accommodation_final_valuation(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,text,text,uuid,text,uuid,text,text,text,text,text,text,text,text[],uuid[],text[],text[],text[],text[],text[],integer[],date[],bigint[],bigint[]) TO app_role;
