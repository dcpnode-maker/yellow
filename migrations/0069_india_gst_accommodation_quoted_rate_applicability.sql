-- Order 400: immutable typed persistence for the already-derived Order341
-- accommodation quoted-rate applicability result.  This migration grants no
-- final-tax, posting, document, invoice or IRP authority.

CREATE TABLE public.india_gst_accommodation_quoted_rate_applicability (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT pg_catalog.gen_random_uuid(),
  property_node uuid NOT NULL,
  reservation_id uuid NOT NULL,
  folio_id uuid NOT NULL,
  reservation_lineage_id uuid NOT NULL,
  attribution_id uuid NOT NULL,
  service_provision_snapshot_id uuid NOT NULL,
  payment_receipt_snapshot_id uuid NOT NULL,
  invoice_issue_snapshot_id uuid NOT NULL,
  family_jurisdiction_extension_id uuid NOT NULL,
  classification_id uuid NOT NULL,
  supplier_service_location_id uuid NOT NULL,
  supplier_sez_status_id uuid NOT NULL,
  recipient_sez_status_id uuid NOT NULL,
  recipient_party_id uuid NOT NULL,
  final_valuation_id uuid NOT NULL,
  request_id uuid NOT NULL,
  section14_case text NOT NULL CHECK (section14_case IN (
    'supply_before_invoice_after_payment_after','supply_invoice_before_payment_after',
    'supply_payment_before_invoice_after','supply_after_invoice_before_payment_after',
    'supply_after_invoice_payment_before','supply_invoice_after_payment_before')),
  service_provision_date date NOT NULL,
  invoice_issue_date date NOT NULL,
  payment_receipt_date date NOT NULL,
  rate_change_date date NOT NULL CHECK (rate_change_date = DATE '2025-09-22'),
  time_of_supply_date date NOT NULL,
  selected_version_side text NOT NULL CHECK (selected_version_side IN ('predecessor','successor')),
  selected_extension_id uuid NOT NULL,
  selected_extension_version smallint NOT NULL CHECK (selected_extension_version IN (1,2)),
  selected_extension_status text NOT NULL CHECK (selected_extension_status IN ('retired','active')),
  selected_content_hash text NOT NULL CHECK (selected_content_hash ~ '^[0-9a-f]{64}$'),
  selected_effective_from timestamptz NOT NULL,
  selected_effective_to timestamptz,
  component_family text NOT NULL CHECK (component_family IN ('igst','cgst_sgst','cgst_utgst')),
  section14_evidence_hash text NOT NULL CHECK (section14_evidence_hash ~ '^[0-9a-f]{64}$'),
  levy_component_identity_evidence_hash text NOT NULL CHECK (levy_component_identity_evidence_hash ~ '^[0-9a-f]{64}$'),
  reservation_lineage_evidence_hash text NOT NULL CHECK (reservation_lineage_evidence_hash ~ '^[0-9a-f]{64}$'),
  attribution_snapshot_evidence_hash text NOT NULL CHECK (attribution_snapshot_evidence_hash ~ '^[0-9a-f]{64}$'),
  evidence_hash text NOT NULL CHECK (evidence_hash ~ '^[0-9a-f]{64}$'),
  calendar_authority_id text CHECK (calendar_authority_id IS NULL OR calendar_authority_id ~ '^[A-Z][A-Z0-9_.:-]{2,127}$'),
  calendar_source_digest_sha256 text CHECK (calendar_source_digest_sha256 IS NULL OR calendar_source_digest_sha256 ~ '^[0-9a-f]{64}$'),
  calendar_through_date date,
  calendar_dates date[] NOT NULL DEFAULT '{}',
  calendar_states text[] NOT NULL DEFAULT '{}',
  actor_id uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT pg_catalog.transaction_timestamp(),
  PRIMARY KEY (tenant_id,id),
  UNIQUE (tenant_id,request_id),
  UNIQUE (tenant_id,evidence_hash),
  UNIQUE (tenant_id,reservation_id,folio_id),
  UNIQUE (tenant_id,final_valuation_id),
  FOREIGN KEY (tenant_id,property_node) REFERENCES public.org_node(tenant_id,id),
  FOREIGN KEY (tenant_id,reservation_id) REFERENCES public.reservation(tenant_id,id),
  FOREIGN KEY (tenant_id,folio_id) REFERENCES public.folio(tenant_id,id),
  FOREIGN KEY (tenant_id,reservation_lineage_id) REFERENCES public.tax_attribution_reservation_binding(tenant_id,id),
  FOREIGN KEY (tenant_id,attribution_id) REFERENCES public.tax_attribution_snapshot(tenant_id,id),
  FOREIGN KEY (tenant_id,service_provision_snapshot_id) REFERENCES public.india_gst_accommodation_service_provision_snapshot(tenant_id,id),
  FOREIGN KEY (tenant_id,payment_receipt_snapshot_id) REFERENCES public.india_gst_accommodation_payment_receipt_snapshot(tenant_id,id),
  FOREIGN KEY (tenant_id,invoice_issue_snapshot_id) REFERENCES public.india_gst_accommodation_invoice_issue_snapshot(tenant_id,id),
  FOREIGN KEY (family_jurisdiction_extension_id) REFERENCES public.extension(id),
  FOREIGN KEY (tenant_id,classification_id) REFERENCES public.india_gst_item_classification(tenant_id,id),
  FOREIGN KEY (tenant_id,supplier_service_location_id) REFERENCES public.india_gst_supplier_service_location(tenant_id,id),
  FOREIGN KEY (tenant_id,supplier_sez_status_id) REFERENCES public.india_gst_supplier_sez_status(tenant_id,id),
  FOREIGN KEY (tenant_id,recipient_sez_status_id) REFERENCES public.india_gst_recipient_sez_status(tenant_id,id),
  FOREIGN KEY (tenant_id,recipient_party_id) REFERENCES public.party(tenant_id,id),
  FOREIGN KEY (tenant_id,final_valuation_id) REFERENCES public.india_gst_accommodation_final_valuation(tenant_id,id),
  FOREIGN KEY (tenant_id,actor_id) REFERENCES public.app_user(tenant_id,id),
  CHECK ((calendar_authority_id IS NULL AND calendar_source_digest_sha256 IS NULL AND calendar_through_date IS NULL AND cardinality(calendar_dates)=0 AND cardinality(calendar_states)=0)
      OR (calendar_authority_id IS NOT NULL AND calendar_source_digest_sha256 IS NOT NULL AND calendar_through_date IS NOT NULL AND cardinality(calendar_dates) BETWEEN 4 AND 366 AND cardinality(calendar_states)=cardinality(calendar_dates)))
);
CREATE INDEX india_gst_quoted_applicability_scope ON public.india_gst_accommodation_quoted_rate_applicability
  (tenant_id,property_node,reservation_id,folio_id,recorded_at,id);

CREATE TABLE public.india_gst_accommodation_quoted_rate_applicability_room_night (
  tenant_id uuid NOT NULL,
  applicability_id uuid NOT NULL,
  ordinal integer NOT NULL CHECK (ordinal BETWEEN 0 AND 365),
  business_date date NOT NULL,
  quoted_amount_minor bigint NOT NULL CHECK (quoted_amount_minor > 0),
  currency char(3) NOT NULL CHECK (currency='INR'),
  slab_upto_minor bigint CHECK (slab_upto_minor IS NULL OR slab_upto_minor=750000),
  aggregate_rate_basis_points integer NOT NULL CHECK (aggregate_rate_basis_points IN (500,1200,1800)),
  itc_eligible boolean NOT NULL,
  PRIMARY KEY (tenant_id,applicability_id,ordinal),
  UNIQUE (tenant_id,applicability_id,business_date),
  FOREIGN KEY (tenant_id,applicability_id) REFERENCES public.india_gst_accommodation_quoted_rate_applicability(tenant_id,id)
);

CREATE TABLE public.india_gst_accommodation_quoted_rate_component (
  tenant_id uuid NOT NULL,
  applicability_id uuid NOT NULL,
  room_night_ordinal integer NOT NULL,
  component_ordinal smallint NOT NULL CHECK (component_ordinal BETWEEN 0 AND 1),
  component_identity text NOT NULL CHECK (component_identity IN ('igst','cgst','sgst','utgst')),
  rate_basis_points integer NOT NULL CHECK (rate_basis_points IN (250,500,600,900,1200,1800)),
  PRIMARY KEY (tenant_id,applicability_id,room_night_ordinal,component_ordinal),
  UNIQUE (tenant_id,applicability_id,room_night_ordinal,component_identity),
  FOREIGN KEY (tenant_id,applicability_id,room_night_ordinal)
    REFERENCES public.india_gst_accommodation_quoted_rate_applicability_room_night(tenant_id,applicability_id,ordinal)
);

DO $rls$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY[
    'india_gst_accommodation_quoted_rate_applicability',
    'india_gst_accommodation_quoted_rate_applicability_room_night',
    'india_gst_accommodation_quoted_rate_component'
  ] LOOP
    EXECUTE pg_catalog.format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE pg_catalog.format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',t);
    EXECUTE pg_catalog.format('CREATE POLICY tenant_isolation ON public.%I USING (tenant_id=NULLIF(current_setting(''app.tenant_id'',true),'''')::uuid) WITH CHECK (tenant_id=NULLIF(current_setting(''app.tenant_id'',true),'''')::uuid)',t);
    EXECUTE pg_catalog.format('REVOKE ALL ON TABLE public.%I FROM PUBLIC,app_role,yellow_runtime',t);
    EXECUTE pg_catalog.format('GRANT SELECT ON TABLE public.%I TO app_role',t);
  END LOOP;
END $rls$;
ALTER TABLE public.india_gst_accommodation_quoted_rate_applicability OWNER TO yellow_owner;
ALTER TABLE public.india_gst_accommodation_quoted_rate_applicability_room_night OWNER TO yellow_owner;
ALTER TABLE public.india_gst_accommodation_quoted_rate_component OWNER TO yellow_owner;

CREATE FUNCTION public.record_india_gst_accommodation_quoted_rate_applicability(
  p_tenant uuid,p_property uuid,p_reservation uuid,p_folio uuid,p_lineage uuid,p_attribution uuid,p_request uuid,p_actor uuid,
  p_service_snapshot uuid,p_payment_snapshot uuid,p_invoice_snapshot uuid,
  p_family_jurisdiction_extension uuid,p_classification uuid,p_supplier_service_location uuid,p_supplier_sez_status uuid,p_recipient_sez_status uuid,p_recipient_party uuid,
  p_section14_case text,p_service_date date,p_invoice_date date,p_payment_date date,p_rate_change_date date,p_time_of_supply_date date,
  p_selected_side text,p_selected_extension uuid,p_selected_version smallint,p_selected_status text,p_selected_content_hash text,
  p_selected_from timestamptz,p_selected_to timestamptz,p_component_family text,
  p_section14_hash text,p_levy_hash text,p_lineage_hash text,p_attribution_hash text,p_evidence_hash text,
  p_calendar_authority text,p_calendar_source_hash text,p_calendar_through date,p_calendar_dates date[],p_calendar_states text[],
  p_night_ordinals integer[],p_night_dates date[],p_night_amounts bigint[],p_slab_upto bigint[],p_aggregate_bps integer[],p_itc_eligible boolean[],
  p_component_night_ordinals integer[],p_component_ordinals smallint[],p_component_identities text[],p_component_bps integer[]
) RETURNS TABLE(applicability_id uuid,evidence_hash text,created boolean)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE
  v_id uuid:=pg_catalog.gen_random_uuid(); v_existing public.india_gst_accommodation_quoted_rate_applicability%ROWTYPE;
  v_lineage public.tax_attribution_reservation_binding%ROWTYPE; v_folio public.folio%ROWTYPE;
  v_n integer; v_c integer; v_i integer; v_fact uuid; v_business_date date; v_expected_identities text[];
  v_calendar_count integer:=coalesce(pg_catalog.cardinality(p_calendar_dates),0); v_working integer:=0;
  v_first_four date[]:='{}'; v_fourth_working date; v_governed_payment_date date; v_governed_branch text;
  v_expected_extension uuid; v_expected_version smallint; v_expected_status text; v_expected_from timestamptz; v_expected_to timestamptz;
  v_expected_lower integer; v_expected_content_hash text; v_expected_content jsonb; v_extension public.extension%ROWTYPE;
  v_predecessor_extension public.extension%ROWTYPE; v_successor_extension public.extension%ROWTYPE; v_replay boolean:=false;
  v_service public.india_gst_accommodation_service_provision_snapshot%ROWTYPE; v_payment public.india_gst_accommodation_payment_receipt_snapshot%ROWTYPE; v_invoice public.india_gst_accommodation_invoice_issue_snapshot%ROWTYPE;
  v_component_json text; v_selected_from_json text; v_selected_to_json text; v_order341_json text;
  v_predecessor_content_json text; v_successor_content_json text; v_pair_predecessor_json text; v_pair_successor_json text;
  v_rate_pair_json text; v_rate_pair_hash text; v_rate_identity_predecessor_json text; v_rate_identity_successor_json text;
  v_rate_change_json text; v_rate_change_hash text; v_lineage_json text; v_attribution_json text; v_nested_service_json text;
  v_service_json text; v_service_hash text; v_payment_json text; v_payment_hash text; v_invoice_json text; v_invoice_hash text;
  v_proviso_json text; v_proviso_hash text; v_calendar_days_json text; v_first_four_json text; v_calendar_json text; v_calendar_hash text;
  v_governed_json text; v_governed_hash text; v_working_hash_json text:='null'; v_governed_hash_json text:='null';
  v_section14_json text; v_section14_hash text;
  v_supplier_region text; v_property_region text; v_supplier_taxpayer text; v_recipient_taxpayer text; v_derived_family text;
  v_valuation public.india_gst_accommodation_final_valuation%ROWTYPE;
BEGIN
  IF session_user<>'yellow_runtime' OR pg_catalog.current_setting('role',true) IS DISTINCT FROM 'app_role' OR current_user<>'yellow_owner' THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='quoted applicability requires governed runtime app role'; END IF;
  IF p_tenant IS DISTINCT FROM NULLIF(pg_catalog.current_setting('app.tenant_id',true),'')::uuid THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='quoted applicability tenant context mismatch'; END IF;
  IF p_request IS NULL OR p_actor IS NULL OR p_evidence_hash !~ '^[0-9a-f]{64}$' OR p_section14_hash !~ '^[0-9a-f]{64}$' OR p_levy_hash !~ '^[0-9a-f]{64}$' OR p_lineage_hash !~ '^[0-9a-f]{64}$' OR p_attribution_hash !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='quoted applicability identity is invalid'; END IF;
  PERFORM 1 FROM public.tenant WHERE id=p_tenant AND status='active'; IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='quoted applicability tenant unavailable'; END IF;
  PERFORM 1 FROM public.app_user actor JOIN public.user_role ur ON ur.tenant_id=actor.tenant_id AND ur.user_id=actor.id JOIN public.role_permission rp ON rp.role_id=ur.role_id AND rp.permission_code='tax-fiscal.india-valuation:finalize' JOIN public.org_node grant_node ON grant_node.tenant_id=ur.tenant_id AND grant_node.id=ur.scope_node JOIN public.org_node property ON property.tenant_id=actor.tenant_id AND property.id=p_property AND property.kind='property' AND grant_node.path @> property.path WHERE actor.tenant_id=p_tenant AND actor.id=p_actor AND actor.status='active';
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='actor lacks property fiscal authority'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_tenant::text||p_reservation::text||p_folio::text,0));
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('india-quoted-applicability:'||p_tenant::text||':'||p_reservation::text||':'||p_folio::text,400));
  SELECT * INTO v_existing FROM public.india_gst_accommodation_quoted_rate_applicability WHERE tenant_id=p_tenant AND request_id=p_request;
  IF FOUND THEN
    v_replay:=true;
  END IF;
  SELECT l.* INTO v_lineage FROM public.tax_attribution_reservation_binding l
    JOIN public.tax_attribution_hold_binding b ON b.tenant_id=l.tenant_id AND b.id=l.binding_id AND b.hold_id=l.hold_id AND b.attribution_id=l.attribution_id AND b.sellable_unit_id=l.sellable_unit_id AND b.period=l.period AND b.origin_quote_hash=l.origin_quote_hash AND b.snapshot_hash=l.snapshot_hash AND b.currency=l.currency
    JOIN public.hold h ON h.tenant_id=l.tenant_id AND h.id=l.hold_id AND h.status='consumed' AND h.sellable_unit_id=l.sellable_unit_id AND h.period=l.period
    JOIN public.reservation_segment s ON s.tenant_id=l.tenant_id AND s.id=l.segment_id AND s.reservation_id=l.reservation_id AND s.sellable_unit_id=l.sellable_unit_id AND s.period=l.period
    JOIN public.tax_attribution_snapshot a ON a.tenant_id=l.tenant_id AND a.id=l.attribution_id AND a.property_node=l.property_node AND a.origin_kind='rate_quote' AND a.origin_quote_hash=l.origin_quote_hash AND a.snapshot_hash=l.snapshot_hash AND a.currency='INR'
   WHERE l.tenant_id=p_tenant AND l.id=p_lineage AND l.property_node=p_property AND l.reservation_id=p_reservation AND l.attribution_id=p_attribution AND l.currency='INR' FOR SHARE OF l,b,h,s,a;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='exact quoted reservation lineage unavailable'; END IF;
  SELECT * INTO v_folio FROM public.folio WHERE tenant_id=p_tenant AND id=p_folio AND reservation_id=p_reservation AND window_no=1 FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='exact quoted folio unavailable'; END IF;
  SELECT service.* INTO v_service
    FROM public.india_gst_accommodation_service_provision_snapshot service
    JOIN public.india_gst_accommodation_payment_receipt_snapshot payment ON payment.tenant_id=service.tenant_id AND payment.service_provision_snapshot_id=service.id
    JOIN public.india_gst_accommodation_invoice_issue_snapshot invoice ON invoice.tenant_id=service.tenant_id AND invoice.service_provision_snapshot_id=service.id
   WHERE service.tenant_id=p_tenant AND service.id=p_service_snapshot AND payment.id=p_payment_snapshot AND invoice.id=p_invoice_snapshot
     AND service.property_node=p_property AND service.reservation_id=p_reservation AND service.reservation_lineage_id=p_lineage AND service.attribution_id=p_attribution
     AND service.service_provision_date=p_service_date AND invoice.invoice_issue_date=p_invoice_date
     AND service.currency='INR' AND payment.currency='INR' AND invoice.currency='INR'
     AND service.service_provision_source='governed_service_provision_record' AND payment.payment_receipt_source='governed_supplier_payment_receipt_record' AND invoice.invoice_issue_source='governed_supplier_tax_invoice_record'
     AND payment.amount_minor=invoice.amount_minor AND payment.coverage_scope='full_attribution' AND invoice.coverage_scope='full_attribution'
    FOR SHARE OF service,payment,invoice;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='exact governed service, payment and invoice ancestry unavailable'; END IF;
  SELECT * INTO v_payment FROM public.india_gst_accommodation_payment_receipt_snapshot
   WHERE tenant_id=p_tenant AND id=p_payment_snapshot;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='exact governed payment ancestry unavailable'; END IF;
  SELECT * INTO v_invoice FROM public.india_gst_accommodation_invoice_issue_snapshot
   WHERE tenant_id=p_tenant AND id=p_invoice_snapshot;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='exact governed invoice ancestry unavailable'; END IF;
  SELECT registration.region_code,property_location.state_code,supplier_status.gst_taxpayer_type,recipient_status.gst_taxpayer_type
    INTO v_supplier_region,v_property_region,v_supplier_taxpayer,v_recipient_taxpayer
    FROM public.india_gst_item_classification classification
    JOIN public.extension jurisdiction ON jurisdiction.id=classification.jurisdiction_extension_id
    JOIN public.org_node governed_property ON governed_property.tenant_id=classification.tenant_id AND governed_property.id=p_property AND governed_property.kind='property'
    JOIN public.india_gst_supplier_service_location supplier_location ON supplier_location.tenant_id=classification.tenant_id AND supplier_location.id=p_supplier_service_location
    JOIN public.property_fiscal_registration registration ON registration.tenant_id=supplier_location.tenant_id AND registration.id=supplier_location.supplier_registration_id AND registration.property_node=p_property
    JOIN public.india_gst_supplier_sez_status supplier_status ON supplier_status.tenant_id=registration.tenant_id AND supplier_status.id=p_supplier_sez_status AND supplier_status.supplier_registration_id=registration.id AND supplier_status.status_as_of=p_time_of_supply_date
    JOIN public.property_fiscal_location property_location ON property_location.tenant_id=classification.tenant_id AND property_location.property_node=p_property AND property_location.country_code='IN'
    JOIN public.india_gst_recipient_sez_status recipient_status ON recipient_status.tenant_id=classification.tenant_id AND recipient_status.id=p_recipient_sez_status AND recipient_status.status_as_of=p_time_of_supply_date
    JOIN public.party_fiscal_registration recipient_registration ON recipient_registration.tenant_id=recipient_status.tenant_id AND recipient_registration.id=recipient_status.recipient_registration_id AND recipient_registration.party_id=p_recipient_party AND recipient_registration.scheme='in-gstin'
    JOIN public.party recipient ON recipient.tenant_id=recipient_registration.tenant_id AND recipient.id=p_recipient_party AND recipient.status='active' AND recipient.merged_into IS NULL
   WHERE classification.tenant_id=p_tenant AND classification.id=p_classification AND classification.property_node=p_property
     AND classification.jurisdiction_extension_id=p_family_jurisdiction_extension
     AND classification.jurisdiction_key='in-gst-lodging' AND classification.country_code='IN' AND classification.line_id='room' AND classification.revenue_group='room_revenue' AND classification.classification_system='SAC' AND classification.is_service_code='Y'
     AND jurisdiction.tenant_id IS NULL AND jurisdiction.type='tax_jurisdiction' AND jurisdiction.key='in-gst-lodging'
     AND ((jurisdiction.id='a806f516-fed6-5768-b310-94aa03286adb' AND jurisdiction.version=1 AND jurisdiction.status='retired') OR (jurisdiction.id='0b21daf2-ea6e-5568-9c21-69e4d4424574' AND jurisdiction.version=2 AND jurisdiction.status='active'))
     AND classification.jurisdiction_version=jurisdiction.version
     AND classification.jurisdiction_content_hash=CASE jurisdiction.id WHEN 'a806f516-fed6-5768-b310-94aa03286adb'::uuid THEN '2160e1747afcb3c280f1fd66e55534a5be563a10f277e8fcc178324e51abaa08' ELSE 'eb323eff707aad1e460b425c87b448d4e924d2eb17499094abad71b33c69a820' END
     AND jurisdiction.effective @> (p_service_date::timestamp AT TIME ZONE governed_property.timezone)
     AND supplier_location.service_scope='lodging_accommodation' AND supplier_location.location_basis='supply_made_from_registered_place_of_business'
     AND supplier_status.gst_registration_status='active' AND recipient_status.gst_registration_status='active'
   FOR SHARE OF classification,jurisdiction,governed_property,supplier_location,registration,supplier_status,property_location,recipient_status,recipient_registration,recipient;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='exact component-family selector ancestry unavailable'; END IF;
  v_derived_family:=CASE
    WHEN v_supplier_taxpayer IN ('sez_unit','sez_developer') OR v_recipient_taxpayer IN ('sez_unit','sez_developer') THEN 'igst'
    WHEN v_supplier_region<>v_property_region THEN 'igst'
    WHEN v_property_region IN ('04','26','31','35','38') THEN 'cgst_utgst'
    ELSE 'cgst_sgst' END;
  IF p_component_family IS DISTINCT FROM v_derived_family THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='component family conflicts with persisted statutory selectors'; END IF;
  SELECT valuation.* INTO v_valuation
    FROM public.india_gst_accommodation_final_valuation valuation
   WHERE valuation.tenant_id=p_tenant AND valuation.property_node=p_property AND valuation.reservation_id=p_reservation AND valuation.folio_id=p_folio
     AND valuation.attribution_id=p_attribution AND valuation.buyer_party_id=p_recipient_party AND valuation.disposition='ordinary_final'
     AND valuation.order341_evidence_hash=p_evidence_hash
     AND NOT EXISTS(SELECT 1 FROM public.india_gst_accommodation_final_valuation successor WHERE successor.tenant_id=valuation.tenant_id AND successor.supersedes_valuation_id=valuation.id)
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='current ordinary valuation does not bind quoted applicability evidence'; END IF;
  IF p_rate_change_date<>DATE '2025-09-22' OR p_service_date=p_rate_change_date OR p_invoice_date=p_rate_change_date OR p_payment_date=p_rate_change_date THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Section14 date partition is invalid'; END IF;
  IF p_selected_side='predecessor' THEN v_expected_extension:='a806f516-fed6-5768-b310-94aa03286adb';v_expected_version:=1;v_expected_status:='retired';v_expected_from:='2022-07-17T18:30:00Z';v_expected_to:='2025-09-21T18:30:00Z';v_expected_lower:=1200;v_expected_content_hash:='2160e1747afcb3c280f1fd66e55534a5be563a10f277e8fcc178324e51abaa08';v_expected_content:='{"country":"IN","price_display":"tax_exclusive","rounding":"document","taxes":[{"code":"GST_ROOM","name":"GST on accommodation","mode":"slab_percent","slab_basis":"transaction_value","applies_to":["room_revenue"],"slabs":[{"upto_minor":750000,"rate":0.12,"itc_eligible":true},{"upto_minor":null,"rate":0.18,"itc_eligible":true}]},{"code":"GST_FNB","name":"GST on F&B (restaurant in hotel)","mode":"percent","rate":0.05,"applies_to":["fnb_revenue"]}]}'::jsonb;
  ELSIF p_selected_side='successor' THEN v_expected_extension:='0b21daf2-ea6e-5568-9c21-69e4d4424574';v_expected_version:=2;v_expected_status:='active';v_expected_from:='2025-09-21T18:30:00Z';v_expected_to:=NULL;v_expected_lower:=500;v_expected_content_hash:='eb323eff707aad1e460b425c87b448d4e924d2eb17499094abad71b33c69a820';v_expected_content:='{"country":"IN","price_display":"tax_exclusive","rounding":"document","taxes":[{"code":"GST_ROOM","name":"GST on accommodation","mode":"slab_percent","slab_basis":"transaction_value","applies_to":["room_revenue"],"slabs":[{"upto_minor":750000,"rate":0.05,"itc_eligible":false},{"upto_minor":null,"rate":0.18,"itc_eligible":true}]},{"code":"GST_FNB","name":"GST on F&B (restaurant in hotel)","mode":"percent","rate":0.05,"applies_to":["fnb_revenue"]}]}'::jsonb;
  ELSE RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='selected version side is invalid'; END IF;
  SELECT * INTO v_extension FROM public.extension WHERE id=v_expected_extension AND tenant_id IS NULL AND type='tax_jurisdiction' AND key='in-gst-lodging' AND version=v_expected_version AND status=v_expected_status FOR SHARE;
  IF NOT FOUND OR v_extension.content<>v_expected_content OR lower(v_extension.effective)<>v_expected_from OR upper(v_extension.effective) IS DISTINCT FROM v_expected_to OR p_selected_extension<>v_expected_extension OR p_selected_version<>v_expected_version OR p_selected_status<>v_expected_status OR p_selected_from<>v_expected_from OR p_selected_to IS DISTINCT FROM v_expected_to OR p_selected_content_hash<>v_expected_content_hash THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='selected extension identity is stale or forged'; END IF;
  -- Rebuild the complete pure Order304 pair and Order307 rate-change roots from
  -- the two persisted global extension versions.  The pair uses the pure
  -- predecessor's recursively key-sorted canonical JSON, while later hashes use
  -- insertion-order JSON.stringify preimages.
  v_predecessor_content_json:='{"country":"IN","price_display":"tax_exclusive","rounding":"document","taxes":[{"applies_to":["room_revenue"],"code":"GST_ROOM","mode":"slab_percent","name":"GST on accommodation","slab_basis":"transaction_value","slabs":[{"itc_eligible":true,"rate":0.12,"upto_minor":750000},{"itc_eligible":true,"rate":0.18,"upto_minor":null}]},{"applies_to":["fnb_revenue"],"code":"GST_FNB","mode":"percent","name":"GST on F&B (restaurant in hotel)","rate":0.05}]}';
  v_successor_content_json:='{"country":"IN","price_display":"tax_exclusive","rounding":"document","taxes":[{"applies_to":["room_revenue"],"code":"GST_ROOM","mode":"slab_percent","name":"GST on accommodation","slab_basis":"transaction_value","slabs":[{"itc_eligible":false,"rate":0.05,"upto_minor":750000},{"itc_eligible":true,"rate":0.18,"upto_minor":null}]},{"applies_to":["fnb_revenue"],"code":"GST_FNB","mode":"percent","name":"GST on F&B (restaurant in hotel)","rate":0.05}]}';
  SELECT * INTO v_predecessor_extension FROM public.extension
   WHERE id='a806f516-fed6-5768-b310-94aa03286adb' AND tenant_id IS NULL AND type='tax_jurisdiction'
     AND key='in-gst-lodging' AND version=1 AND status='retired' FOR SHARE;
  IF NOT FOUND OR v_predecessor_extension.content<>v_predecessor_content_json::jsonb
     OR lower(v_predecessor_extension.effective)<>'2022-07-17T18:30:00Z'::timestamptz
     OR upper(v_predecessor_extension.effective)<>'2025-09-21T18:30:00Z'::timestamptz
     OR encode(public.digest(pg_catalog.convert_to(v_predecessor_content_json,'UTF8'),'sha256'),'hex')<>'2160e1747afcb3c280f1fd66e55534a5be563a10f277e8fcc178324e51abaa08'
    THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='persisted predecessor rate version is unavailable'; END IF;
  SELECT * INTO v_successor_extension FROM public.extension
   WHERE id='0b21daf2-ea6e-5568-9c21-69e4d4424574' AND tenant_id IS NULL AND type='tax_jurisdiction'
     AND key='in-gst-lodging' AND version=2 AND status='active' FOR SHARE;
  IF NOT FOUND OR v_successor_extension.content<>v_successor_content_json::jsonb
     OR lower(v_successor_extension.effective)<>'2025-09-21T18:30:00Z'::timestamptz
     OR upper(v_successor_extension.effective) IS NOT NULL
     OR encode(public.digest(pg_catalog.convert_to(v_successor_content_json,'UTF8'),'sha256'),'hex')<>'eb323eff707aad1e460b425c87b448d4e924d2eb17499094abad71b33c69a820'
    THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='persisted successor rate version is unavailable'; END IF;

  v_pair_predecessor_json:='{"content":'||v_predecessor_content_json||',"contentHash":"2160e1747afcb3c280f1fd66e55534a5be563a10f277e8fcc178324e51abaa08","effectiveFromInstant":"2022-07-17T18:30:00.000000Z","effectiveToInstant":"2025-09-21T18:30:00.000000Z","extensionId":"a806f516-fed6-5768-b310-94aa03286adb","gstRoomSlabs":[{"itcEligible":true,"rate":0.12,"uptoMinor":750000},{"itcEligible":true,"rate":0.18,"uptoMinor":null}],"key":"in-gst-lodging","status":"retired","version":1}';
  v_pair_successor_json:='{"content":'||v_successor_content_json||',"contentHash":"eb323eff707aad1e460b425c87b448d4e924d2eb17499094abad71b33c69a820","effectiveFromInstant":"2025-09-21T18:30:00.000000Z","effectiveToInstant":null,"extensionId":"0b21daf2-ea6e-5568-9c21-69e4d4424574","gstRoomSlabs":[{"itcEligible":false,"rate":0.05,"uptoMinor":750000},{"itcEligible":true,"rate":0.18,"uptoMinor":null}],"key":"in-gst-lodging","status":"active","version":2}';
  v_rate_pair_json:='{"cutoverInstant":"2025-09-21T18:30:00.000000Z","predecessor":'||v_pair_predecessor_json||',"predecessorOwnerTenantId":null,"propertyNode":"'||p_property::text||'","sourceHashes":{"notification04_2022":"c6d264f1906375e93466dd97b2c60bb9b21c0dec34b93900b15237b4a98b7716","notification15_2025":"46c9447579017d8bf1fefd75b6e6a48856dab7b23e44c7e06babfdc99ae9d289","notification20_2019":"ee920c82c30ed88d9bb515d7d79b975cc2ed599c6dad411d04d8b7fcd5a86901"},"statutoryLowerBandDelta":{"predecessorHasNilBand":false,"predecessorItcEligible":true,"predecessorRate":0.12,"successorHasNilBand":false,"successorItcEligible":false,"successorRate":0.05,"thresholdMinor":750000},"successor":'||v_pair_successor_json||',"successorOwnerTenantId":null,"tenantId":"'||p_tenant::text||'"}';
  v_rate_pair_hash:=encode(public.digest(pg_catalog.convert_to(v_rate_pair_json,'UTF8'),'sha256'),'hex');
  v_rate_identity_predecessor_json:='{"contentHash":"2160e1747afcb3c280f1fd66e55534a5be563a10f277e8fcc178324e51abaa08","effectiveFromInstant":"2022-07-17T18:30:00.000000Z","effectiveToInstant":"2025-09-21T18:30:00.000000Z","extensionId":"a806f516-fed6-5768-b310-94aa03286adb","status":"retired","version":1}';
  v_rate_identity_successor_json:='{"contentHash":"eb323eff707aad1e460b425c87b448d4e924d2eb17499094abad71b33c69a820","effectiveFromInstant":"2025-09-21T18:30:00.000000Z","effectiveToInstant":null,"extensionId":"0b21daf2-ea6e-5568-9c21-69e4d4424574","status":"active","version":2}';
  v_rate_change_json:='{"cutoverInstant":"2025-09-21T18:30:00.000000Z","notification15SourceHash":"46c9447579017d8bf1fefd75b6e6a48856dab7b23e44c7e06babfdc99ae9d289","pairEvidenceHash":"'||v_rate_pair_hash||'","predecessor":'||v_rate_identity_predecessor_json||',"propertyNode":"'||p_property::text||'","rateChangeDate":"2025-09-22","successor":'||v_rate_identity_successor_json||'}';
  v_rate_change_hash:=encode(public.digest(pg_catalog.convert_to(v_rate_change_json,'UTF8'),'sha256'),'hex');

  v_lineage_json:='{"lineageId":"'||p_lineage::text||'","holdBindingId":"'||v_lineage.binding_id::text||'","attributionId":"'||p_attribution::text||'","reservationId":"'||p_reservation::text||'","segmentId":"'||v_lineage.segment_id::text||'","originQuoteHash":"'||v_lineage.origin_quote_hash||'","snapshotHash":"'||v_lineage.snapshot_hash||'","currency":"INR"}';
  v_attribution_json:='{"originKind":"rate_quote","lineId":"room","revenueGroup":"room_revenue"}';
  v_nested_service_json:='{"serviceProvisionSnapshotId":"'||v_service.id::text||'","serviceProvisionDate":"'||v_service.service_provision_date::text||'","serviceProvisionSource":"governed_service_provision_record","serviceProvisionEvidenceSha256":"'||v_service.service_provision_evidence_sha256||'","legalRule":"CGST_ACT_13_2_B_SERVICE_PROVISION_DATE_INPUT_ONLY","reservationLineage":'||v_lineage_json||',"attribution":'||v_attribution_json||'}';
  v_service_json:='{"tenantId":"'||p_tenant::text||'","serviceProvisionSnapshotId":"'||v_service.id::text||'","propertyNode":"'||p_property::text||'","reservationLineage":'||v_lineage_json||',"attribution":'||v_attribution_json||',"serviceProvisionDate":"'||v_service.service_provision_date::text||'","serviceProvisionSource":"governed_service_provision_record","serviceProvisionEvidenceSha256":"'||v_service.service_provision_evidence_sha256||'","legalRule":"CGST_ACT_13_2_B_SERVICE_PROVISION_DATE_INPUT_ONLY"}';
  v_service_hash:=encode(public.digest(pg_catalog.convert_to(v_service_json,'UTF8'),'sha256'),'hex');
  v_payment_json:='{"tenantId":"'||p_tenant::text||'","paymentReceiptSnapshotId":"'||v_payment.id::text||'","propertyNode":"'||p_property::text||'","serviceProvision":'||v_nested_service_json||',"supplierBooksEntryDate":"'||v_payment.supplier_books_entry_date::text||'","supplierBankCreditDate":"'||v_payment.supplier_bank_credit_date::text||'","paymentReceiptDate":"'||v_payment.payment_receipt_date::text||'","coverageScope":"full_attribution","amountMinor":"'||v_payment.amount_minor::text||'","currency":"INR","paymentReceiptSource":"governed_supplier_payment_receipt_record","paymentReceiptEvidenceSha256":"'||v_payment.payment_receipt_evidence_sha256||'","legalRule":"CGST_ACT_13_2_EXPLANATION_II_PAYMENT_RECEIPT_DATE_INPUT_ONLY"}';
  v_payment_hash:=encode(public.digest(pg_catalog.convert_to(v_payment_json,'UTF8'),'sha256'),'hex');
  v_invoice_json:='{"tenantId":"'||p_tenant::text||'","invoiceIssueSnapshotId":"'||v_invoice.id::text||'","propertyNode":"'||p_property::text||'","serviceProvision":'||v_nested_service_json||',"serviceProvisionDate":"'||v_service.service_provision_date::text||'","invoiceSeries":'||pg_catalog.to_json(v_invoice.invoice_series)::text||',"invoiceSerial":'||pg_catalog.to_json(v_invoice.invoice_serial)::text||',"invoiceIssueDate":"'||v_invoice.invoice_issue_date::text||'","coverageScope":"full_attribution","amountMinor":"'||v_invoice.amount_minor::text||'","currency":"INR","invoiceIssueSource":"governed_supplier_tax_invoice_record","invoiceIssueEvidenceSha256":"'||v_invoice.invoice_issue_evidence_sha256||'","legalRule":"CGST_ACT_13_2_INVOICE_DATE_INPUT_ONLY"}';
  v_invoice_hash:=encode(public.digest(pg_catalog.convert_to(v_invoice_json,'UTF8'),'sha256'),'hex');
  -- Re-derive the six statutory cases rather than accepting the caller's selector.
  IF (p_service_date<p_rate_change_date AND p_invoice_date>p_rate_change_date AND p_payment_date>p_rate_change_date AND (p_section14_case<>'supply_before_invoice_after_payment_after' OR p_selected_side<>'successor' OR p_time_of_supply_date<>least(p_invoice_date,p_payment_date)))
    OR (p_service_date<p_rate_change_date AND p_invoice_date<p_rate_change_date AND p_payment_date>p_rate_change_date AND (p_section14_case<>'supply_invoice_before_payment_after' OR p_selected_side<>'predecessor' OR p_time_of_supply_date<>p_invoice_date))
    OR (p_service_date<p_rate_change_date AND p_invoice_date>p_rate_change_date AND p_payment_date<p_rate_change_date AND (p_section14_case<>'supply_payment_before_invoice_after' OR p_selected_side<>'predecessor' OR p_time_of_supply_date<>p_payment_date))
    OR (p_service_date>p_rate_change_date AND p_invoice_date<p_rate_change_date AND p_payment_date>p_rate_change_date AND (p_section14_case<>'supply_after_invoice_before_payment_after' OR p_selected_side<>'successor' OR p_time_of_supply_date<>p_payment_date))
    OR (p_service_date>p_rate_change_date AND p_invoice_date<p_rate_change_date AND p_payment_date<p_rate_change_date AND (p_section14_case<>'supply_after_invoice_payment_before' OR p_selected_side<>'predecessor' OR p_time_of_supply_date<>least(p_invoice_date,p_payment_date)))
    OR (p_service_date>p_rate_change_date AND p_invoice_date>p_rate_change_date AND p_payment_date<p_rate_change_date AND (p_section14_case<>'supply_invoice_after_payment_before' OR p_selected_side<>'successor' OR p_time_of_supply_date<>p_invoice_date))
    OR NOT ((p_service_date<p_rate_change_date AND p_invoice_date>p_rate_change_date AND p_payment_date>p_rate_change_date) OR (p_service_date<p_rate_change_date AND p_invoice_date<p_rate_change_date AND p_payment_date>p_rate_change_date) OR (p_service_date<p_rate_change_date AND p_invoice_date>p_rate_change_date AND p_payment_date<p_rate_change_date) OR (p_service_date>p_rate_change_date AND p_invoice_date<p_rate_change_date AND p_payment_date>p_rate_change_date) OR (p_service_date>p_rate_change_date AND p_invoice_date<p_rate_change_date AND p_payment_date<p_rate_change_date) OR (p_service_date>p_rate_change_date AND p_invoice_date>p_rate_change_date AND p_payment_date<p_rate_change_date)) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Section14 case does not derive from dates'; END IF;
  IF p_calendar_dates IS NULL OR p_calendar_states IS NULL
     OR (p_calendar_authority IS NULL)<>(v_calendar_count=0)
     OR pg_catalog.cardinality(p_calendar_states)<>v_calendar_count OR v_calendar_count>366
     OR (v_calendar_count>0 AND (pg_catalog.array_ndims(p_calendar_dates)<>1 OR pg_catalog.array_lower(p_calendar_dates,1)<>1
       OR pg_catalog.array_ndims(p_calendar_states)<>1 OR pg_catalog.array_lower(p_calendar_states,1)<>1))
    THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='calendar evidence shape is invalid'; END IF;
  IF (v_payment.supplier_bank_credit_date>p_rate_change_date)<>(v_calendar_count>0) THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='calendar evidence branch conflicts with persisted payment truth'; END IF;
  IF v_payment.supplier_bank_credit_date>p_rate_change_date THEN
    v_proviso_json:='{"state":"working_day_calendar_required","supplierBooksEntryDate":"'||v_payment.supplier_books_entry_date::text||'","supplierBankCreditDate":"'||v_payment.supplier_bank_credit_date::text||'","rateChangeDate":"'||p_rate_change_date::text||'","legalRule":"CGST_ACT_14_PAYMENT_CREDIT_FOUR_WORKING_DAY_PROVISO_GUARD"}';
  ELSE
    v_proviso_json:='{"state":"proviso_not_triggered_on_recorded_dates","paymentReceiptDate":"'||least(v_payment.supplier_books_entry_date,v_payment.supplier_bank_credit_date)::text||'","supplierBooksEntryDate":"'||v_payment.supplier_books_entry_date::text||'","supplierBankCreditDate":"'||v_payment.supplier_bank_credit_date::text||'","rateChangeDate":"'||p_rate_change_date::text||'","legalRule":"CGST_ACT_14_PAYMENT_CREDIT_FOUR_WORKING_DAY_PROVISO_GUARD"}';
  END IF;
  v_proviso_hash:=encode(public.digest(pg_catalog.convert_to(v_proviso_json,'UTF8'),'sha256'),'hex');
  IF v_calendar_count>0 THEN
    IF v_calendar_count<4 OR p_calendar_authority!~'^[A-Z][A-Z0-9_.:-]{2,127}$'
       OR p_calendar_source_hash IS NULL OR p_calendar_source_hash!~'^[0-9a-f]{64}$'
       OR p_calendar_through IS DISTINCT FROM p_calendar_dates[v_calendar_count]
      THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='calendar evidence is incomplete'; END IF;
    FOR v_i IN 1..v_calendar_count LOOP
      IF p_calendar_dates[v_i]<>p_rate_change_date+v_i OR p_calendar_states[v_i] NOT IN ('working','non_working') THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='calendar evidence is not dense'; END IF;
      IF p_calendar_states[v_i]='working' THEN
        v_working:=v_working+1;
        IF pg_catalog.cardinality(v_first_four)<4 THEN v_first_four:=pg_catalog.array_append(v_first_four,p_calendar_dates[v_i]); END IF;
      END IF;
    END LOOP;
    IF v_working<4 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='calendar evidence must establish at least four working days'; END IF;
    v_fourth_working:=v_first_four[4];
    IF pg_catalog.array_position(p_calendar_dates,v_payment.supplier_bank_credit_date) IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='calendar evidence does not contain persisted bank-credit date'; END IF;
    v_governed_branch:=CASE WHEN v_payment.supplier_bank_credit_date>v_fourth_working THEN 'bank_credit_after_four_working_days' ELSE 'ordinary_earlier_of_within_four_working_days' END;
    v_governed_payment_date:=CASE WHEN v_payment.supplier_bank_credit_date>v_fourth_working THEN v_payment.supplier_bank_credit_date ELSE least(v_payment.supplier_books_entry_date,v_payment.supplier_bank_credit_date) END;
    IF p_payment_date<>v_governed_payment_date THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='calendar evidence does not derive governed payment date'; END IF;
    SELECT '['||pg_catalog.string_agg('{"date":"'||p_calendar_dates[i]::text||'","state":"'||p_calendar_states[i]||'"}',',' ORDER BY i)||']'
      INTO v_calendar_days_json FROM pg_catalog.generate_subscripts(p_calendar_dates,1)i;
    SELECT '['||pg_catalog.string_agg('"'||v_first_four[i]::text||'"',',' ORDER BY i)||']'
      INTO v_first_four_json FROM pg_catalog.generate_subscripts(v_first_four,1)i;
    v_calendar_json:='{"tenantId":"'||p_tenant::text||'","rateChangeDate":"'||p_rate_change_date::text||'","throughDate":"'||p_calendar_through::text||'","jurisdiction":"IN","authorityId":"'||p_calendar_authority||'","sourceDigestSha256":"'||p_calendar_source_hash||'","calendarDays":'||v_calendar_days_json||',"firstFourWorkingDates":'||v_first_four_json||',"fourthWorkingDayDate":"'||v_fourth_working::text||'","legalRule":"CGST_ACT_14_FOUR_WORKING_DAY_CALENDAR_EVIDENCE_ONLY"}';
    v_calendar_hash:=encode(public.digest(pg_catalog.convert_to(v_calendar_json,'UTF8'),'sha256'),'hex');
    v_governed_json:='{"tenantId":"'||p_tenant::text||'","rateChangeDate":"'||p_rate_change_date::text||'","supplierBooksEntryDate":"'||v_payment.supplier_books_entry_date::text||'","supplierBankCreditDate":"'||v_payment.supplier_bank_credit_date::text||'","fourthWorkingDayDate":"'||v_fourth_working::text||'","paymentReceiptDate":"'||v_governed_payment_date::text||'","branch":"'||v_governed_branch||'","calendarAuthorityId":"'||p_calendar_authority||'","calendarSourceDigestSha256":"'||p_calendar_source_hash||'","legalRule":"CGST_ACT_14_PAYMENT_RECEIPT_DATE_FOUR_WORKING_DAY_PROVISO","predecessorHashes":{"rateChangeDate":"'||v_rate_change_hash||'","paymentProviso":"'||v_proviso_hash||'","workingDayCalendar":"'||v_calendar_hash||'"}}';
    v_governed_hash:=encode(public.digest(pg_catalog.convert_to(v_governed_json,'UTF8'),'sha256'),'hex');
    v_working_hash_json:='"'||v_calendar_hash||'"'; v_governed_hash_json:='"'||v_governed_hash||'"';
  ELSIF p_calendar_source_hash IS NOT NULL OR p_calendar_through IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='ordinary receipt carries calendar evidence'; END IF;
  IF v_calendar_count=0 AND p_payment_date<>v_payment.payment_receipt_date THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='ordinary payment date is not persisted truth'; END IF;
  v_selected_from_json:=CASE p_selected_side WHEN 'predecessor' THEN '2022-07-17T18:30:00.000000Z' ELSE '2025-09-21T18:30:00.000000Z' END;
  v_selected_to_json:=CASE p_selected_side WHEN 'predecessor' THEN '"2025-09-21T18:30:00.000000Z"' ELSE 'null' END;
  v_section14_json:='{"tenantId":"'||p_tenant::text||'","propertyNode":"'||p_property::text||'","reservationId":"'||p_reservation::text||'","case":"'||p_section14_case||'","serviceProvisionDate":"'||p_service_date::text||'","invoiceIssueDate":"'||p_invoice_date::text||'","paymentReceiptDate":"'||p_payment_date::text||'","rateChangeDate":"'||p_rate_change_date::text||'","timeOfSupplyDate":"'||p_time_of_supply_date::text||'","selectedVersionSide":"'||p_selected_side||'","selectedVersion":{"extensionId":"'||p_selected_extension::text||'","version":'||p_selected_version::text||',"status":"'||p_selected_status||'","contentHash":"'||p_selected_content_hash||'","effectiveFromInstant":"'||v_selected_from_json||'","effectiveToInstant":'||v_selected_to_json||'},"legalRule":"CGST_ACT_14_CHANGE_IN_RATE_SIX_CASE_RATE_VERSION_SELECTION","predecessorHashes":{"rateVersionPair":"'||v_rate_pair_hash||'","rateChangeDate":"'||v_rate_change_hash||'","serviceProvision":"'||v_service_hash||'","paymentReceipt":"'||v_payment_hash||'","invoiceIssue":"'||v_invoice_hash||'","paymentProviso":"'||v_proviso_hash||'","workingDayCalendar":'||v_working_hash_json||',"governedPaymentReceipt":'||v_governed_hash_json||'}}';
  v_section14_hash:=encode(public.digest(pg_catalog.convert_to(v_section14_json,'UTF8'),'sha256'),'hex');
  IF v_section14_hash IS DISTINCT FROM p_section14_hash THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Section14 evidence hash does not byte-match complete persisted ancestry'; END IF;
  v_n:=coalesce(pg_catalog.cardinality(p_night_ordinals),0); v_c:=coalesce(pg_catalog.cardinality(p_component_night_ordinals),0);
  IF v_n<1 OR v_n>366 OR pg_catalog.cardinality(p_night_dates)<>v_n OR pg_catalog.cardinality(p_night_amounts)<>v_n OR pg_catalog.cardinality(p_slab_upto)<>v_n OR pg_catalog.cardinality(p_aggregate_bps)<>v_n OR pg_catalog.cardinality(p_itc_eligible)<>v_n OR pg_catalog.cardinality(p_component_ordinals)<>v_c OR pg_catalog.cardinality(p_component_identities)<>v_c OR pg_catalog.cardinality(p_component_bps)<>v_c THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='quoted applicability arrays are incomplete'; END IF;
  v_expected_identities:=CASE v_derived_family WHEN 'igst' THEN ARRAY['igst'] WHEN 'cgst_sgst' THEN ARRAY['cgst','sgst'] WHEN 'cgst_utgst' THEN ARRAY['cgst','utgst'] ELSE NULL END;
  IF v_expected_identities IS NULL OR v_c<>v_n*pg_catalog.cardinality(v_expected_identities) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='component family is invalid'; END IF;
  FOR v_i IN 1..v_n LOOP
    IF p_night_ordinals[v_i]<>v_i-1 OR p_night_amounts[v_i]<=0 OR (p_night_amounts[v_i]<=750000 AND (p_slab_upto[v_i] IS DISTINCT FROM 750000 OR p_aggregate_bps[v_i]<>v_expected_lower OR p_itc_eligible[v_i]<>(p_selected_side='predecessor'))) OR (p_night_amounts[v_i]>750000 AND (p_slab_upto[v_i] IS NOT NULL OR p_aggregate_bps[v_i]<>1800 OR NOT p_itc_eligible[v_i])) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='quoted room-night slab is invalid'; END IF;
  END LOOP;
  FOR v_i IN 1..v_c LOOP
    IF p_component_night_ordinals[v_i]<>((v_i-1)/pg_catalog.cardinality(v_expected_identities))::integer OR p_component_ordinals[v_i]<>((v_i-1)%pg_catalog.cardinality(v_expected_identities)) OR p_component_identities[v_i]<>v_expected_identities[((v_i-1)%pg_catalog.cardinality(v_expected_identities))+1] OR p_component_bps[v_i]<>(p_aggregate_bps[p_component_night_ordinals[v_i]+1]/pg_catalog.cardinality(v_expected_identities)) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='ordered component-rate split is invalid'; END IF;
  END LOOP;
  -- Rebuild the exact JSON.stringify preimage emitted by Order341. All strings
  -- below are already constrained to canonical UUID/hash/date/enum alphabets.
  SELECT '['||pg_catalog.string_agg(
    '{"ordinal":"'||p_night_ordinals[n]::text||'","businessDate":"'||p_night_dates[n]::text||'","quotedAmountMinor":"'||p_night_amounts[n]::text||'","slab":{"uptoMinor":'||coalesce(p_slab_upto[n]::text,'null')||',"aggregateRate":'||CASE p_aggregate_bps[n] WHEN 500 THEN '0.05' WHEN 1200 THEN '0.12' WHEN 1800 THEN '0.18' END||',"aggregateRateBasisPoints":'||p_aggregate_bps[n]::text||',"itcEligible":'||CASE WHEN p_itc_eligible[n] THEN 'true' ELSE 'false' END||',"components":['||(
      SELECT pg_catalog.string_agg('{"identity":"'||p_component_identities[c]||'","rate":'||CASE p_component_bps[c] WHEN 250 THEN '0.025' WHEN 500 THEN '0.05' WHEN 600 THEN '0.06' WHEN 900 THEN '0.09' WHEN 1200 THEN '0.12' WHEN 1800 THEN '0.18' END||',"rateBasisPoints":'||p_component_bps[c]::text||'}',',' ORDER BY p_component_ordinals[c]) FROM pg_catalog.generate_subscripts(p_component_identities,1)c WHERE p_component_night_ordinals[c]=p_night_ordinals[n]
    )||']}}',',' ORDER BY p_night_ordinals[n])||']'
    INTO v_component_json FROM pg_catalog.generate_subscripts(p_night_ordinals,1)n;
  v_selected_from_json:=CASE p_selected_side WHEN 'predecessor' THEN '2022-07-17T18:30:00.000000Z' ELSE '2025-09-21T18:30:00.000000Z' END;
  v_selected_to_json:=CASE p_selected_side WHEN 'predecessor' THEN '"2025-09-21T18:30:00.000000Z"' ELSE 'null' END;
  v_order341_json:='{"tenantId":"'||p_tenant::text||'","propertyNode":"'||p_property::text||'","reservationId":"'||p_reservation::text||'","folioId":"'||p_folio::text||'","section14":{"case":"'||p_section14_case||'","timeOfSupplyDate":"'||p_time_of_supply_date::text||'","selectedVersionSide":"'||p_selected_side||'","selectedVersion":{"extensionId":"'||p_selected_extension::text||'","version":'||p_selected_version::text||',"status":"'||p_selected_status||'","contentHash":"'||p_selected_content_hash||'","effectiveFromInstant":"'||v_selected_from_json||'","effectiveToInstant":'||v_selected_to_json||'}},"reservationLineage":{"lineageId":"'||p_lineage::text||'","holdBindingId":"'||v_lineage.binding_id::text||'","reservationId":"'||p_reservation::text||'","segmentId":"'||v_lineage.segment_id::text||'","folioId":"'||p_folio::text||'","attributionId":"'||p_attribution::text||'","originQuoteHash":"'||v_lineage.origin_quote_hash||'","snapshotHash":"'||v_lineage.snapshot_hash||'","currency":"INR"},"components":'||v_component_json||',"predecessorHashes":{"section14":"'||p_section14_hash||'","levyComponentIdentity":"'||p_levy_hash||'","reservationLineage":"'||p_lineage_hash||'","attributionSnapshot":"'||p_attribution_hash||'"}}';
  IF encode(public.digest(pg_catalog.convert_to(v_order341_json,'UTF8'),'sha256'),'hex')<>p_evidence_hash THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Order341 evidence hash does not byte-match typed result'; END IF;
  IF v_replay THEN
    IF v_existing.property_node IS DISTINCT FROM p_property OR v_existing.reservation_id IS DISTINCT FROM p_reservation OR v_existing.folio_id IS DISTINCT FROM p_folio OR v_existing.reservation_lineage_id IS DISTINCT FROM p_lineage OR v_existing.attribution_id IS DISTINCT FROM p_attribution OR v_existing.service_provision_snapshot_id IS DISTINCT FROM p_service_snapshot OR v_existing.payment_receipt_snapshot_id IS DISTINCT FROM p_payment_snapshot OR v_existing.invoice_issue_snapshot_id IS DISTINCT FROM p_invoice_snapshot OR v_existing.family_jurisdiction_extension_id IS DISTINCT FROM p_family_jurisdiction_extension OR v_existing.classification_id IS DISTINCT FROM p_classification OR v_existing.supplier_service_location_id IS DISTINCT FROM p_supplier_service_location OR v_existing.supplier_sez_status_id IS DISTINCT FROM p_supplier_sez_status OR v_existing.recipient_sez_status_id IS DISTINCT FROM p_recipient_sez_status OR v_existing.recipient_party_id IS DISTINCT FROM p_recipient_party OR v_existing.final_valuation_id IS DISTINCT FROM v_valuation.id OR v_existing.actor_id IS DISTINCT FROM p_actor OR v_existing.section14_case IS DISTINCT FROM p_section14_case OR v_existing.service_provision_date IS DISTINCT FROM p_service_date OR v_existing.invoice_issue_date IS DISTINCT FROM p_invoice_date OR v_existing.payment_receipt_date IS DISTINCT FROM p_payment_date OR v_existing.rate_change_date IS DISTINCT FROM p_rate_change_date OR v_existing.time_of_supply_date IS DISTINCT FROM p_time_of_supply_date OR v_existing.selected_version_side IS DISTINCT FROM p_selected_side OR v_existing.selected_extension_id IS DISTINCT FROM p_selected_extension OR v_existing.selected_extension_version IS DISTINCT FROM p_selected_version OR v_existing.selected_extension_status IS DISTINCT FROM p_selected_status OR v_existing.selected_content_hash IS DISTINCT FROM p_selected_content_hash OR v_existing.selected_effective_from IS DISTINCT FROM p_selected_from OR v_existing.selected_effective_to IS DISTINCT FROM p_selected_to OR v_existing.component_family IS DISTINCT FROM p_component_family OR v_existing.section14_evidence_hash IS DISTINCT FROM p_section14_hash OR v_existing.levy_component_identity_evidence_hash IS DISTINCT FROM p_levy_hash OR v_existing.reservation_lineage_evidence_hash IS DISTINCT FROM p_lineage_hash OR v_existing.attribution_snapshot_evidence_hash IS DISTINCT FROM p_attribution_hash OR v_existing.evidence_hash IS DISTINCT FROM p_evidence_hash OR v_existing.calendar_authority_id IS DISTINCT FROM p_calendar_authority OR v_existing.calendar_source_digest_sha256 IS DISTINCT FROM p_calendar_source_hash OR v_existing.calendar_through_date IS DISTINCT FROM p_calendar_through OR v_existing.calendar_dates IS DISTINCT FROM p_calendar_dates OR v_existing.calendar_states IS DISTINCT FROM p_calendar_states
      OR (SELECT array_agg(ordinal ORDER BY ordinal) FROM public.india_gst_accommodation_quoted_rate_applicability_room_night replay_night WHERE tenant_id=p_tenant AND replay_night.applicability_id=v_existing.id) IS DISTINCT FROM p_night_ordinals
      OR (SELECT array_agg(business_date ORDER BY ordinal) FROM public.india_gst_accommodation_quoted_rate_applicability_room_night replay_night WHERE tenant_id=p_tenant AND replay_night.applicability_id=v_existing.id) IS DISTINCT FROM p_night_dates
      OR (SELECT array_agg(quoted_amount_minor ORDER BY ordinal) FROM public.india_gst_accommodation_quoted_rate_applicability_room_night replay_night WHERE tenant_id=p_tenant AND replay_night.applicability_id=v_existing.id) IS DISTINCT FROM p_night_amounts
      OR (SELECT array_agg(slab_upto_minor ORDER BY ordinal) FROM public.india_gst_accommodation_quoted_rate_applicability_room_night replay_night WHERE tenant_id=p_tenant AND replay_night.applicability_id=v_existing.id) IS DISTINCT FROM p_slab_upto
      OR (SELECT array_agg(aggregate_rate_basis_points ORDER BY ordinal) FROM public.india_gst_accommodation_quoted_rate_applicability_room_night replay_night WHERE tenant_id=p_tenant AND replay_night.applicability_id=v_existing.id) IS DISTINCT FROM p_aggregate_bps
      OR (SELECT array_agg(itc_eligible ORDER BY ordinal) FROM public.india_gst_accommodation_quoted_rate_applicability_room_night replay_night WHERE tenant_id=p_tenant AND replay_night.applicability_id=v_existing.id) IS DISTINCT FROM p_itc_eligible
      OR (SELECT array_agg(room_night_ordinal ORDER BY room_night_ordinal,component_ordinal) FROM public.india_gst_accommodation_quoted_rate_component replay_component WHERE tenant_id=p_tenant AND replay_component.applicability_id=v_existing.id) IS DISTINCT FROM p_component_night_ordinals
      OR (SELECT array_agg(component_ordinal ORDER BY room_night_ordinal,component_ordinal) FROM public.india_gst_accommodation_quoted_rate_component replay_component WHERE tenant_id=p_tenant AND replay_component.applicability_id=v_existing.id) IS DISTINCT FROM p_component_ordinals
      OR (SELECT array_agg(component_identity ORDER BY room_night_ordinal,component_ordinal) FROM public.india_gst_accommodation_quoted_rate_component replay_component WHERE tenant_id=p_tenant AND replay_component.applicability_id=v_existing.id) IS DISTINCT FROM p_component_identities
      OR (SELECT array_agg(rate_basis_points ORDER BY room_night_ordinal,component_ordinal) FROM public.india_gst_accommodation_quoted_rate_component replay_component WHERE tenant_id=p_tenant AND replay_component.applicability_id=v_existing.id) IS DISTINCT FROM p_component_bps THEN RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='quoted applicability request has divergent evidence'; END IF;
    RETURN QUERY SELECT v_existing.id,v_existing.evidence_hash,false; RETURN;
  END IF;
  INSERT INTO public.india_gst_accommodation_quoted_rate_applicability VALUES(p_tenant,v_id,p_property,p_reservation,p_folio,p_lineage,p_attribution,p_service_snapshot,p_payment_snapshot,p_invoice_snapshot,p_family_jurisdiction_extension,p_classification,p_supplier_service_location,p_supplier_sez_status,p_recipient_sez_status,p_recipient_party,v_valuation.id,p_request,p_section14_case,p_service_date,p_invoice_date,p_payment_date,p_rate_change_date,p_time_of_supply_date,p_selected_side,p_selected_extension,p_selected_version,p_selected_status,p_selected_content_hash,p_selected_from,p_selected_to,v_derived_family,p_section14_hash,p_levy_hash,p_lineage_hash,p_attribution_hash,p_evidence_hash,p_calendar_authority,p_calendar_source_hash,p_calendar_through,p_calendar_dates,p_calendar_states,p_actor,pg_catalog.transaction_timestamp());
  FOR v_i IN 1..v_n LOOP INSERT INTO public.india_gst_accommodation_quoted_rate_applicability_room_night VALUES(p_tenant,v_id,p_night_ordinals[v_i],p_night_dates[v_i],p_night_amounts[v_i],'INR',p_slab_upto[v_i],p_aggregate_bps[v_i],p_itc_eligible[v_i]); END LOOP;
  FOR v_i IN 1..v_c LOOP INSERT INTO public.india_gst_accommodation_quoted_rate_component VALUES(p_tenant,v_id,p_component_night_ordinals[v_i],p_component_ordinals[v_i],p_component_identities[v_i],p_component_bps[v_i]); END LOOP;
  SELECT (pg_catalog.transaction_timestamp() AT TIME ZONE timezone)::date INTO v_business_date FROM public.org_node WHERE tenant_id=p_tenant AND id=p_property;
  INSERT INTO public.fact_log(tenant_id,entity_type,entity_id,fact_type,valid_from,business_date,actor_id,payload) VALUES(p_tenant,'india_gst_accommodation_quoted_rate_applicability',v_id,'recorded',pg_catalog.transaction_timestamp(),v_business_date,p_actor,pg_catalog.jsonb_build_object('applicabilityId',v_id,'evidenceHash',p_evidence_hash)) RETURNING id INTO v_fact;
  INSERT INTO public.outbox(tenant_id,property_node,business_date,aggregate_type,aggregate_id,event_type,actor_id,correlation_id,payload) VALUES(p_tenant,p_property,v_business_date,'india_gst_accommodation_quoted_rate_applicability',v_id,'india_gst.accommodation_quoted_rate_applicability_recorded',p_actor,p_request,pg_catalog.jsonb_build_object('applicabilityId',v_id,'reservationId',p_reservation,'folioId',p_folio,'evidenceHash',p_evidence_hash));
  RETURN QUERY SELECT v_id,p_evidence_hash,true;
END $$;

ALTER FUNCTION public.record_india_gst_accommodation_quoted_rate_applicability(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,date,date,date,date,date,text,uuid,smallint,text,text,timestamptz,timestamptz,text,text,text,text,text,text,text,text,date,date[],text[],integer[],date[],bigint[],bigint[],integer[],boolean[],integer[],smallint[],text[],integer[]) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.record_india_gst_accommodation_quoted_rate_applicability(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,date,date,date,date,date,text,uuid,smallint,text,text,timestamptz,timestamptz,text,text,text,text,text,text,text,text,date,date[],text[],integer[],date[],bigint[],bigint[],integer[],boolean[],integer[],smallint[],text[],integer[]) FROM PUBLIC,app_role,yellow_runtime;
GRANT EXECUTE ON FUNCTION public.record_india_gst_accommodation_quoted_rate_applicability(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,date,date,date,date,date,text,uuid,smallint,text,text,timestamptz,timestamptz,text,text,text,text,text,text,text,text,date,date[],text[],integer[],date[],bigint[],bigint[],integer[],boolean[],integer[],smallint[],text[],integer[]) TO app_role;
