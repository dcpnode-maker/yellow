-- Order434 / Question190 / D1346. Private preparation building blocks ONLY.
-- Assemble with the accounting fragment into reserved0076 after the complete
-- prepare/authenticate/commit pipeline passes its gates. This fragment deliberately
-- grants no runtime capability and does not stand in for the missing source-graph
-- authenticator. Selecting a version/family here is arithmetic, NOT fiscal policy:
-- the eventual preparation must derive those identities from the native date,
-- registration, location and approved historical-rate graph before invoking it.

-- All values come from the actual native valuation. No caller amount/rate array.
-- Shared integer rounding lives in the Financials fragment and matches0070.
-- No row/advisory lock, event, journal, numbering or other write happens here.
CREATE OR REPLACE FUNCTION public.read_india_native_tax_preview(
  p_tenant uuid,p_property uuid,p_reservation uuid,p_folio uuid,p_valuation uuid,
  p_selected_extension uuid,p_component_family text
) RETURNS jsonb LANGUAGE plpgsql STABLE
SET search_path=pg_catalog,public SET timezone='UTC' SET datestyle='ISO,YMD' AS $$
DECLARE
  v_valuation public.india_gst_accommodation_final_valuation%ROWTYPE;
  v_extension public.extension%ROWTYPE;
  v_night public.india_gst_accommodation_valuation_room_night%ROWTYPE;
  v_lineage public.tax_attribution_reservation_binding%ROWTYPE;
  v_snapshot public.tax_attribution_snapshot%ROWTYPE;
  v_content jsonb; v_hash text; v_version smallint; v_status text;
  v_from timestamptz; v_to timestamptz; v_lower integer;
  v_identities text[]; v_size integer; v_count integer; v_i integer:=0; v_j integer;
  v_bps integer; v_slab bigint; v_itc boolean; v_value bigint; v_component bigint;
  v_night_tax numeric; v_total numeric:=0; v_tax numeric:=0; v_grand numeric;
  v_components text; v_room_json text:='['; v_sums numeric[];
  v_persistence jsonb:='[]'::jsonb; v_sum_json jsonb; v_previous_date date;
BEGIN
  IF p_tenant IS NULL OR p_tenant IS DISTINCT FROM
      NULLIF(pg_catalog.current_setting('app.tenant_id',true),'')::uuid THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='native tax preview tenant mismatch';
  END IF;
  SELECT v.* INTO v_valuation FROM public.india_gst_accommodation_final_valuation v
    WHERE v.tenant_id=p_tenant AND v.id=p_valuation AND v.property_node=p_property
      AND v.reservation_id=p_reservation AND v.folio_id=p_folio
      AND v.basis_kind='native_consideration' AND v.order341_evidence_hash IS NULL
      AND v.disposition='ordinary_final' AND v.currency='INR'
      AND v.transaction_value_minor>0 AND v.native_consideration_basis_hash IS NOT NULL
      AND NOT EXISTS(SELECT 1 FROM public.india_gst_accommodation_final_valuation successor
        WHERE successor.tenant_id=v.tenant_id AND successor.supersedes_valuation_id=v.id);
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native tax preview requires the current native valuation';
  END IF;
  SELECT l.* INTO v_lineage FROM public.tax_attribution_reservation_binding l
    WHERE l.tenant_id=p_tenant AND l.id=v_valuation.native_lineage_id
      AND l.property_node=p_property AND l.reservation_id=p_reservation AND l.currency='INR';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native tax preview lineage unavailable';
  END IF;
  SELECT a.* INTO v_snapshot FROM public.tax_attribution_snapshot a
    WHERE a.tenant_id=p_tenant AND a.id=v_lineage.attribution_id
      AND a.property_node=p_property AND a.snapshot_hash=v_lineage.snapshot_hash
      AND a.origin_quote_hash=v_lineage.origin_quote_hash AND a.origin_kind='rate_quote'
      AND a.currency='INR';
  IF NOT FOUND OR public.india_native_source_hash(v_snapshot.snapshot-'snapshotHash')
      IS DISTINCT FROM v_snapshot.snapshot_hash
      OR v_snapshot.snapshot->'evaluation'->>'priceDisplay' IS DISTINCT FROM 'tax_exclusive'
      OR pg_catalog.jsonb_typeof(v_snapshot.snapshot->'revenueLine'->'roomNights')
        IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native tax preview quoted ancestry is inconsistent';
  END IF;

  -- Exact registry members already admitted by303/305 and authenticated by0070.
  -- This is deliberately not a latest-rate lookup or a new rate policy.
  IF p_selected_extension='a806f516-fed6-5768-b310-94aa03286adb'::uuid THEN
    v_version:=1;v_status:='retired';v_from:='2022-07-17T18:30:00Z';
    v_to:='2025-09-21T18:30:00Z';v_lower:=1200;
    v_hash:='2160e1747afcb3c280f1fd66e55534a5be563a10f277e8fcc178324e51abaa08';
    v_content:='{"country":"IN","price_display":"tax_exclusive","rounding":"document","taxes":[{"code":"GST_ROOM","name":"GST on accommodation","mode":"slab_percent","slab_basis":"transaction_value","applies_to":["room_revenue"],"slabs":[{"upto_minor":750000,"rate":0.12,"itc_eligible":true},{"upto_minor":null,"rate":0.18,"itc_eligible":true}]},{"code":"GST_FNB","name":"GST on F&B (restaurant in hotel)","mode":"percent","rate":0.05,"applies_to":["fnb_revenue"]}]}'::jsonb;
  ELSIF p_selected_extension='0b21daf2-ea6e-5568-9c21-69e4d4424574'::uuid THEN
    v_version:=2;v_status:='active';v_from:='2025-09-21T18:30:00Z';
    v_to:=NULL;v_lower:=500;
    v_hash:='eb323eff707aad1e460b425c87b448d4e924d2eb17499094abad71b33c69a820';
    v_content:='{"country":"IN","price_display":"tax_exclusive","rounding":"document","taxes":[{"code":"GST_ROOM","name":"GST on accommodation","mode":"slab_percent","slab_basis":"transaction_value","applies_to":["room_revenue"],"slabs":[{"upto_minor":750000,"rate":0.05,"itc_eligible":false},{"upto_minor":null,"rate":0.18,"itc_eligible":true}]},{"code":"GST_FNB","name":"GST on F&B (restaurant in hotel)","mode":"percent","rate":0.05,"applies_to":["fnb_revenue"]}]}'::jsonb;
  ELSE
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native tax preview rate member is not admitted';
  END IF;
  SELECT e.* INTO v_extension FROM public.extension e WHERE e.id=p_selected_extension
    AND e.tenant_id IS NULL AND e.type='tax_jurisdiction' AND e.key='in-gst-lodging'
    AND e.version=v_version AND e.status=v_status;
  IF NOT FOUND OR v_extension.content IS DISTINCT FROM v_content
      OR pg_catalog.lower(v_extension.effective) IS DISTINCT FROM v_from
      OR pg_catalog.upper(v_extension.effective) IS DISTINCT FROM v_to THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native tax preview registry member is inconsistent';
  END IF;
  v_identities:=CASE p_component_family WHEN 'igst' THEN ARRAY['igst']
    WHEN 'cgst_sgst' THEN ARRAY['cgst','sgst']
    WHEN 'cgst_utgst' THEN ARRAY['cgst','utgst'] ELSE NULL END;
  IF v_identities IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='native tax preview component family is invalid';
  END IF;
  v_size:=pg_catalog.cardinality(v_identities);v_sums:=pg_catalog.array_fill(0::numeric,ARRAY[v_size]);
  SELECT pg_catalog.count(*)::integer INTO v_count
    FROM public.india_gst_accommodation_valuation_room_night n
    WHERE n.tenant_id=p_tenant AND n.valuation_id=p_valuation;
  IF v_count NOT BETWEEN 1 AND 366 OR v_count<>
      pg_catalog.jsonb_array_length(v_snapshot.snapshot->'revenueLine'->'roomNights') THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native tax preview room-night set is incomplete';
  END IF;
  FOR v_night IN SELECT n.* FROM public.india_gst_accommodation_valuation_room_night n
      WHERE n.tenant_id=p_tenant AND n.valuation_id=p_valuation ORDER BY n.ordinal LOOP
    IF v_night.ordinal<>v_i OR v_night.basis_kind<>'native_consideration'
        OR v_night.currency<>'INR' OR v_night.transaction_value_minor IS NULL
        OR v_night.transaction_value_minor<=0
        OR (v_previous_date IS NOT NULL AND v_night.business_date<>v_previous_date+1)
        OR v_snapshot.snapshot->'revenueLine'->'roomNights'->v_i->>'index' IS DISTINCT FROM v_i::text
        OR v_snapshot.snapshot->'revenueLine'->'roomNights'->v_i->>'businessDate'
          IS DISTINCT FROM v_night.business_date::text THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native tax preview room-night identity differs from valuation/quote';
    END IF;
    v_previous_date:=v_night.business_date;v_value:=v_night.transaction_value_minor;
    IF v_value<=750000 THEN v_slab:=750000;v_bps:=v_lower;v_itc:=(v_version=1);
    ELSE v_slab:=NULL;v_bps:=1800;v_itc:=true; END IF;
    v_night_tax:=0;v_components:='[';
    FOR v_j IN 1..v_size LOOP
      v_component:=public.india_native_component_tax_minor(v_value,v_bps/v_size);
      v_sums[v_j]:=v_sums[v_j]+v_component;v_night_tax:=v_night_tax+v_component;
      v_components:=v_components||CASE WHEN v_j=1 THEN '' ELSE ',' END
        ||'{"identity":"'||v_identities[v_j]||'","rateBasisPoints":'||(v_bps/v_size)::text
        ||',"taxMinor":"'||v_component::text||'"}';
    END LOOP;
    v_components:=v_components||']';v_total:=v_total+v_value;v_tax:=v_tax+v_night_tax;
    IF v_total>9223372036854775807::numeric OR v_tax>9223372036854775807::numeric THEN
      RAISE EXCEPTION USING ERRCODE='22003',MESSAGE='native tax preview total exceeds signed int64';
    END IF;
    -- Preserve the existing TS insertion-order preimage, not sorted JSONB text.
    v_room_json:=v_room_json||CASE WHEN v_i=0 THEN '' ELSE ',' END
      ||'{"ordinal":"'||v_i::text||'","businessDate":"'||v_night.business_date::text
      ||'","transactionValueMinor":"'||v_value::text||'","slab":{"uptoMinor":'
      ||COALESCE(v_slab::text,'null')||',"aggregateRateBasisPoints":'||v_bps::text
      ||',"components":'||v_components||'},"taxMinor":"'||v_night_tax::bigint::text||'"}';
    v_persistence:=v_persistence||pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'ordinal',v_i,'businessDate',v_night.business_date,'finalValueMinor',v_value::text,
      'slabUptoMinor',v_slab,'aggregateRateBasisPoints',v_bps,'itcEligible',v_itc,
      'taxMinor',v_night_tax::bigint::text,'components',v_components::jsonb));
    v_i:=v_i+1;
  END LOOP;
  IF v_total IS DISTINCT FROM v_valuation.transaction_value_minor::numeric THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native tax preview total differs from recorded valuation';
  END IF;
  v_grand:=v_total+v_tax;
  IF v_grand>9223372036854775807::numeric THEN
    RAISE EXCEPTION USING ERRCODE='22003',MESSAGE='native tax preview grand total exceeds signed int64';
  END IF;
  v_room_json:=v_room_json||']';
  SELECT pg_catalog.jsonb_agg(amount::bigint::text ORDER BY ordinal) INTO v_sum_json
    FROM pg_catalog.unnest(v_sums) WITH ORDINALITY amounts(amount,ordinal);
  RETURN pg_catalog.jsonb_build_object('valuationId',p_valuation,'generation',v_valuation.generation,
    'valuationEvidenceHash',v_valuation.evidence_hash,
    'nativeConsiderationBasisHash',v_valuation.native_consideration_basis_hash,
    'selectedExtensionId',p_selected_extension,'selectedExtensionVersion',v_version,
    'selectedContentHash',v_hash,'componentFamily',p_component_family,
    'componentIdentities',v_identities,'componentAmountsMinor',v_sum_json,
    'transactionValueMinor',v_total::bigint::text,'taxMinor',v_tax::bigint::text,
    'grandTotalMinor',v_grand::bigint::text,'roomNights',v_room_json::jsonb,
    'roomNightsCanonicalJson',v_room_json,'persistenceRoomNights',v_persistence);
END;
$$;
ALTER FUNCTION public.read_india_native_tax_preview(uuid,uuid,uuid,uuid,uuid,uuid,text) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.read_india_native_tax_preview(uuid,uuid,uuid,uuid,uuid,uuid,text)
  FROM PUBLIC,app_role,yellow_runtime;

-- Financial/source PREFIX only. Call before authority/configuration/source row
-- locks, business-day, series and publication; none of those later stages is
-- silently performed here. Extension and family must already be derived by the
-- SQL preparation's fiscal source resolver, never passed from a public request.
CREATE OR REPLACE FUNCTION public.lock_india_native_invoice_source_prefix(
  p_tenant uuid,p_property uuid,p_reservation uuid,p_folio uuid,p_valuation uuid,
  p_selected_extension uuid,p_component_family text,p_new_tax uuid,p_key_hash text
) RETURNS jsonb LANGUAGE plpgsql VOLATILE
SET search_path=pg_catalog,public SET timezone='UTC' SET datestyle='ISO,YMD' AS $$
DECLARE
  v_source jsonb;v_preview jsonb;v_routes jsonb;v_current_routes jsonb;
  v_accounts uuid[];v_roots uuid[];v_journals uuid[];v_sums bigint[];
  v_id uuid;v_guest uuid;v_locked integer;v_folio public.folio%ROWTYPE;
BEGIN
  IF p_tenant IS NULL OR p_tenant IS DISTINCT FROM
      NULLIF(pg_catalog.current_setting('app.tenant_id',true),'')::uuid THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='native financial prefix tenant mismatch';
  END IF;
  IF p_property IS NULL OR p_reservation IS NULL OR p_folio IS NULL OR p_valuation IS NULL
      OR p_new_tax IS NULL OR p_key_hash IS NULL OR p_key_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='native financial prefix identity is invalid';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_locks l WHERE l.pid=pg_catalog.pg_backend_pid()
      AND l.locktype='advisory' AND l.granted AND l.objsubid=1
      AND l.classid=((6441674055002974568::bigint>>32)&4294967295)::oid
      AND l.objid=(6441674055002974568::bigint&4294967295)::oid) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native issue requires a transaction without prior publication';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    p_tenant::text||p_reservation::text||p_folio::text,0));
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'india-quoted-applicability:'||p_tenant::text||':'||p_reservation::text||':'||p_folio::text,400));
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'india-final-component-tax:'||p_tenant::text||':'||p_reservation::text||':'||p_folio::text,367));
  IF EXISTS(SELECT 1 FROM public.india_gst_accommodation_final_component_tax t
      WHERE t.tenant_id=p_tenant AND t.id=p_new_tax) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native financial prefix requires a new tax identity';
  END IF;
  v_source:=public.read_india_native_valuation_source_closure(
    p_tenant,p_property,p_reservation,p_folio,p_valuation);
  v_preview:=public.read_india_native_tax_preview(p_tenant,p_property,p_reservation,
    p_folio,p_valuation,p_selected_extension,p_component_family);
  v_guest:=(v_source->>'accountId')::uuid;
  SELECT pg_catalog.array_agg(value::uuid ORDER BY value::uuid) INTO v_roots
    FROM pg_catalog.jsonb_array_elements_text(v_source->'rootIds');
  SELECT pg_catalog.array_agg(value::bigint ORDER BY ordinal) INTO v_sums
    FROM pg_catalog.jsonb_array_elements_text(v_preview->'componentAmountsMinor')
      WITH ORDINALITY amounts(value,ordinal);
  SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(route) ORDER BY route.component_ordinal)
    INTO v_routes FROM public.india_native_component_tax_routes(p_tenant,p_property,
      p_selected_extension,(v_preview->>'selectedExtensionVersion')::smallint,
      v_preview->>'selectedContentHash',p_component_family,v_sums) route;
  SELECT pg_catalog.array_agg(id ORDER BY id) INTO v_accounts FROM (
    SELECT value::uuid id FROM pg_catalog.jsonb_array_elements_text(v_source->'accountIds')
    UNION SELECT (route->>'credit_account_id')::uuid
      FROM pg_catalog.jsonb_array_elements(v_routes) route
      WHERE route->>'credit_account_id' IS NOT NULL
  ) accounts;
  IF pg_catalog.cardinality(v_accounts) NOT BETWEEN 2 AND 503
      OR pg_catalog.cardinality(v_roots) NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native financial prefix exceeds complete source/account bounds';
  END IF;
  PERFORM 1 FROM public.account a WHERE a.tenant_id=p_tenant
    AND a.id=ANY(v_accounts) AND a.property_node=p_property AND a.currency='INR'
    ORDER BY a.id FOR UPDATE;
  GET DIAGNOSTICS v_locked=ROW_COUNT;
  IF v_locked<>pg_catalog.cardinality(v_accounts) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native financial prefix account set unavailable';
  END IF;
  SELECT f.* INTO v_folio FROM public.folio f WHERE f.tenant_id=p_tenant
    AND f.id=p_folio AND f.reservation_id=p_reservation AND f.account_id=v_guest
    AND f.status='open' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native financial prefix open folio unavailable';
  END IF;
  FOREACH v_id IN ARRAY v_roots LOOP
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      p_tenant::text||':folio-transfer-root:'||v_id::text,188));
  END LOOP;
  SELECT pg_catalog.array_agg(id ORDER BY id) INTO v_journals FROM (
    SELECT r.journal_id id FROM public.posting_line r WHERE r.tenant_id=p_tenant AND r.id=ANY(v_roots)
    UNION SELECT j.reverses FROM public.posting_line r JOIN public.journal j
      ON j.tenant_id=r.tenant_id AND j.id=r.journal_id
      WHERE r.tenant_id=p_tenant AND r.id=ANY(v_roots) AND j.reverses IS NOT NULL
  ) journals;
  FOREACH v_id IN ARRAY v_journals LOOP
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_tenant::text||':'||v_id::text,0));
  END LOOP;
  FOREACH v_id IN ARRAY v_journals LOOP
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      p_tenant::text||':positive-tax-correction:'||v_id::text,266));
  END LOOP;
  FOREACH v_id IN ARRAY v_journals LOOP
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      p_tenant::text||':india-final-component-tax-correction:'||v_id::text,408));
  END LOOP;
  FOREACH v_id IN ARRAY v_journals LOOP
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      'india-final-component-tax-journal-reversal:'||p_tenant::text||':'||v_id::text,408));
  END LOOP;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'india-final-component-tax-journal-binding:'||p_tenant::text||':'||p_new_tax::text,407));
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'india-native-fiscal-invoice:'||p_tenant::text||':'||p_reservation::text||':'||p_folio::text,430));
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'india-native-fiscal-idempotency:'||p_tenant::text||':'||p_key_hash,430));
  SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(route) ORDER BY route.component_ordinal)
    INTO v_current_routes FROM public.india_native_component_tax_routes(p_tenant,p_property,
      p_selected_extension,(v_preview->>'selectedExtensionVersion')::smallint,
      v_preview->>'selectedContentHash',p_component_family,v_sums) route;
  IF v_source IS DISTINCT FROM public.read_india_native_valuation_source_closure(
      p_tenant,p_property,p_reservation,p_folio,p_valuation)
      OR v_preview IS DISTINCT FROM public.read_india_native_tax_preview(p_tenant,p_property,
        p_reservation,p_folio,p_valuation,p_selected_extension,p_component_family)
      OR v_routes IS DISTINCT FROM v_current_routes THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native financial prefix source or route membership changed while locking';
  END IF;
  RETURN pg_catalog.jsonb_build_object('sourceClosure',v_source,'taxPreview',v_preview,
    'routes',v_routes,'lockedAccountIds',v_accounts,'folioId',p_folio,'newTaxId',p_new_tax);
END;
$$;
ALTER FUNCTION public.lock_india_native_invoice_source_prefix(uuid,uuid,uuid,uuid,uuid,uuid,text,uuid,text)
  OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.lock_india_native_invoice_source_prefix(uuid,uuid,uuid,uuid,uuid,uuid,text,uuid,text)
  FROM PUBLIC,app_role,yellow_runtime;

-- JSON (not JSONB) retains the insertion order required by the original0056/57
-- date projection contracts. This serializer compacts only structural whitespace;
-- it never strips whitespace inside strings or substitutes the sorted root hash.
-- Its inputs below are SQL-built fixed-key records with strings/integer values.
CREATE OR REPLACE FUNCTION public.india_native_insertion_json(p_value json)
RETURNS text LANGUAGE plpgsql IMMUTABLE STRICT
SET search_path=pg_catalog,public AS $$
DECLARE v_result text;
BEGIN
  CASE pg_catalog.json_typeof(p_value)
    WHEN 'object' THEN
      SELECT '{'||COALESCE(pg_catalog.string_agg(pg_catalog.to_json(e.key)::text||':'||
        public.india_native_insertion_json(e.value),',' ORDER BY e.ordinal),'')||'}'
        INTO v_result FROM pg_catalog.json_each(p_value) WITH ORDINALITY e(key,value,ordinal);
    WHEN 'array' THEN
      SELECT '['||COALESCE(pg_catalog.string_agg(public.india_native_insertion_json(e.value),
        ',' ORDER BY e.ordinal),'')||']' INTO v_result
        FROM pg_catalog.json_array_elements(p_value) WITH ORDINALITY e(value,ordinal);
    ELSE v_result:=p_value::text;
  END CASE;
  RETURN v_result;
END;
$$;
ALTER FUNCTION public.india_native_insertion_json(json) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.india_native_insertion_json(json) FROM PUBLIC,app_role,yellow_runtime;

-- Complete original intake authentication, with no lock acquisition. The future
-- preparation locks these rows after its financial prefix, then repeats this read;
-- the accounting/final checks can therefore reuse it after D99 without inversion.
-- Returned JSON is a derived projection, not persisted or caller-owned authority.
CREATE OR REPLACE FUNCTION public.read_india_native_intake_source(
  p_tenant uuid,p_property uuid,p_reservation uuid,p_service uuid,p_payment uuid,p_ordinary uuid
) RETURNS jsonb LANGUAGE plpgsql STABLE
SET search_path=pg_catalog,public SET timezone='UTC' SET datestyle='ISO,YMD' AS $$
DECLARE
  v_service public.india_gst_accommodation_service_provision_snapshot%ROWTYPE;
  v_payment public.india_gst_accommodation_payment_receipt_snapshot%ROWTYPE;
  v_ordinary public.india_gst_accommodation_ordinary_regime_evidence%ROWTYPE;
  v_lineage public.tax_attribution_reservation_binding%ROWTYPE;
  v_attribution public.tax_attribution_snapshot%ROWTYPE;
  v_lineage_json json;v_attribution_json json;v_service_nested json;
  v_service_json json;v_payment_json json;v_service_preimage text;v_payment_preimage text;
  v_service_hash text;v_payment_hash text;v_amount text;
BEGIN
  IF p_tenant IS NULL OR p_tenant IS DISTINCT FROM
      NULLIF(pg_catalog.current_setting('app.tenant_id',true),'')::uuid THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='native intake read tenant mismatch';
  END IF;
  IF p_property IS NULL OR p_reservation IS NULL OR p_service IS NULL
      OR p_payment IS NULL OR p_ordinary IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='native intake identities are required';
  END IF;
  SELECT s.* INTO v_service FROM public.india_gst_accommodation_service_provision_snapshot s
    WHERE s.tenant_id=p_tenant AND s.id=p_service AND s.property_node=p_property
      AND s.reservation_id=p_reservation AND s.currency='INR'
      AND s.recording_actor_id IS NOT NULL AND s.evidence_hash IS NOT NULL
      AND s.service_provision_source='governed_service_provision_record'
      AND s.legal_rule='CGST_ACT_13_2_B_SERVICE_PROVISION_DATE_INPUT_ONLY';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native governed service root unavailable';
  END IF;
  SELECT l.* INTO v_lineage FROM public.tax_attribution_reservation_binding l
    JOIN public.tax_attribution_hold_binding hb ON hb.tenant_id=l.tenant_id AND hb.id=l.binding_id
      AND hb.property_node=l.property_node AND hb.hold_id=l.hold_id
      AND hb.attribution_id=l.attribution_id AND hb.sellable_unit_id=l.sellable_unit_id
      AND hb.period=l.period AND hb.origin_quote_hash=l.origin_quote_hash
      AND hb.snapshot_hash=l.snapshot_hash AND hb.currency=l.currency
    JOIN public.tax_attribution_snapshot a ON a.tenant_id=hb.tenant_id AND a.id=hb.attribution_id
      AND a.property_node=hb.property_node AND a.actor_id=hb.bound_by
      AND a.origin_kind='rate_quote' AND a.schema_version=1
      AND a.origin_quote_hash=hb.origin_quote_hash AND a.snapshot_hash=hb.snapshot_hash
      AND a.currency=hb.currency
    JOIN public.hold h ON h.tenant_id=l.tenant_id AND h.id=l.hold_id
      AND h.property_node=l.property_node AND h.sellable_unit_id=l.sellable_unit_id
      AND h.period=l.period AND h.kind='cart' AND h.status='consumed'
    JOIN public.reservation r ON r.tenant_id=l.tenant_id AND r.id=l.reservation_id
      AND r.property_node=l.property_node AND r.currency=l.currency
    JOIN public.reservation_segment s ON s.tenant_id=l.tenant_id AND s.id=l.segment_id
      AND s.reservation_id=l.reservation_id AND s.sellable_unit_id=l.sellable_unit_id AND s.period=l.period
    WHERE l.tenant_id=p_tenant AND l.id=v_service.reservation_lineage_id
      AND l.property_node=p_property AND l.reservation_id=p_reservation AND l.currency='INR'
      AND l.binding_id=v_service.hold_binding_id AND l.attribution_id=v_service.attribution_id
      AND l.segment_id=v_service.segment_id AND l.origin_quote_hash=v_service.origin_quote_hash
      AND l.snapshot_hash=v_service.snapshot_hash;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native complete service attribution lineage unavailable';
  END IF;
  SELECT a.* INTO STRICT v_attribution FROM public.tax_attribution_snapshot a
    WHERE a.tenant_id=p_tenant AND a.id=v_lineage.attribution_id;
  v_amount:=v_attribution.snapshot->'evaluation'->>'grandTotalMinor';
  IF public.india_native_source_hash(v_attribution.snapshot-'snapshotHash')
        IS DISTINCT FROM v_lineage.snapshot_hash
      OR v_attribution.snapshot->>'snapshotHash' IS DISTINCT FROM v_lineage.snapshot_hash
      OR v_attribution.snapshot->>'currency' IS DISTINCT FROM 'INR'
      OR v_attribution.snapshot->'origin'->>'kind' IS DISTINCT FROM 'rate_quote'
      OR v_attribution.snapshot->'origin'->>'quoteHash' IS DISTINCT FROM v_lineage.origin_quote_hash
      OR v_attribution.snapshot->'evaluation'->'schemaVersion' IS DISTINCT FROM '1'::jsonb
      OR v_attribution.snapshot->'evaluation'->>'country' IS DISTINCT FROM 'IN'
      OR v_attribution.snapshot->'evaluation'->>'priceDisplay' IS DISTINCT FROM 'tax_exclusive'
      OR v_attribution.snapshot->'revenueLine'->>'lineId' IS DISTINCT FROM 'room'
      OR v_attribution.snapshot->'revenueLine'->>'revenueGroup' IS DISTINCT FROM 'room_revenue'
      OR pg_catalog.jsonb_typeof(v_attribution.snapshot->'evaluation'->'grandTotalMinor')
        IS DISTINCT FROM 'string' OR v_amount IS NULL OR v_amount !~ '^[1-9][0-9]{0,18}$' THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native canonical attribution identity is inconsistent';
  END IF;
  IF public.india_native_source_hash(pg_catalog.jsonb_build_array('india-native-service-root-v1',
      pg_catalog.to_jsonb(v_service)-'evidence_hash',pg_catalog.to_jsonb(v_lineage)))
      IS DISTINCT FROM v_service.evidence_hash
      OR public.india_native_source_hash(pg_catalog.jsonb_build_array('india-native-service-request-v1',
        p_tenant,p_property,p_reservation,v_lineage.id,v_service.service_provision_date,
        v_service.service_provision_evidence_sha256,v_service.recording_actor_id))
        IS DISTINCT FROM v_service.request_hash THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native service recording preimage is inconsistent';
  END IF;
  SELECT p.* INTO v_payment FROM public.india_gst_accommodation_payment_receipt_snapshot p
    WHERE p.tenant_id=p_tenant AND p.id=p_payment AND p.service_provision_snapshot_id=p_service
      AND p.recording_actor_id IS NOT NULL AND p.evidence_hash IS NOT NULL
      AND p.coverage_scope='full_attribution' AND p.currency='INR'
      AND p.payment_receipt_source='governed_supplier_payment_receipt_record'
      AND p.legal_rule='CGST_ACT_13_2_EXPLANATION_II_PAYMENT_RECEIPT_DATE_INPUT_ONLY';
  IF NOT FOUND OR v_payment.amount_minor IS DISTINCT FROM v_amount::bigint
      OR v_payment.payment_receipt_date IS DISTINCT FROM
        LEAST(v_payment.supplier_books_entry_date,v_payment.supplier_bank_credit_date)
      OR public.india_native_source_hash(pg_catalog.jsonb_build_array('india-native-payment-root-v1',
        pg_catalog.to_jsonb(v_payment)-'evidence_hash',pg_catalog.to_jsonb(v_service),
        pg_catalog.to_jsonb(v_lineage))) IS DISTINCT FROM v_payment.evidence_hash
      OR public.india_native_source_hash(pg_catalog.jsonb_build_array('india-native-payment-request-v1',
        p_tenant,p_property,p_reservation,p_service,v_payment.amount_minor::text,
        v_payment.supplier_books_entry_date,v_payment.supplier_bank_credit_date,
        v_payment.payment_receipt_evidence_sha256,v_payment.recording_actor_id))
        IS DISTINCT FROM v_payment.request_hash THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native payment recording preimage or coverage is inconsistent';
  END IF;
  SELECT o.* INTO v_ordinary FROM public.india_gst_accommodation_ordinary_regime_evidence o
    WHERE o.tenant_id=p_tenant AND o.id=p_ordinary AND o.property_node=p_property
      AND o.reservation_id=p_reservation AND o.service_provision_snapshot_id=p_service
      AND o.reservation_lineage_id=v_lineage.id AND o.hold_binding_id=v_lineage.binding_id
      AND o.attribution_id=v_lineage.attribution_id AND o.segment_id=v_lineage.segment_id
      AND o.origin_quote_hash=v_lineage.origin_quote_hash AND o.snapshot_hash=v_lineage.snapshot_hash
      AND o.currency='INR' AND o.service_provision_date=v_service.service_provision_date
      AND o.service_provision_evidence_sha256=v_service.service_provision_evidence_sha256
      AND o.service_evidence_hash=v_service.evidence_hash
      AND o.regime='ordinary_rule47_30_day'
      AND o.ordinary_regime_source='governed_rule47_ordinary_regime_record'
      AND o.legal_basis='CGST_RULE_47_ORDINARY_SERVICE_INVOICE_30_DAY_INPUT';
  IF NOT FOUND OR public.india_native_source_hash(pg_catalog.jsonb_build_array('india-native-ordinary-root-v1',
      pg_catalog.to_jsonb(v_ordinary)-'evidence_hash',pg_catalog.to_jsonb(v_service),
      pg_catalog.to_jsonb(v_lineage))) IS DISTINCT FROM v_ordinary.evidence_hash
      OR public.india_native_source_hash(pg_catalog.jsonb_build_array('india-native-ordinary-request-v1',
        p_tenant,p_property,p_reservation,p_service,v_ordinary.regime,v_ordinary.ordinary_regime_source,
        v_ordinary.legal_basis,v_ordinary.ordinary_regime_evidence_sha256,v_ordinary.recording_actor_id))
        IS DISTINCT FROM v_ordinary.request_hash THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native ordinary recording preimage is inconsistent';
  END IF;
  v_lineage_json:=pg_catalog.json_build_object('lineageId',v_lineage.id,
    'holdBindingId',v_lineage.binding_id,'attributionId',v_lineage.attribution_id,
    'reservationId',p_reservation,'segmentId',v_lineage.segment_id,
    'originQuoteHash',v_lineage.origin_quote_hash,'snapshotHash',v_lineage.snapshot_hash,'currency','INR');
  v_attribution_json:=pg_catalog.json_build_object('originKind','rate_quote','lineId','room','revenueGroup','room_revenue');
  v_service_json:=pg_catalog.json_build_object('tenantId',p_tenant,'serviceProvisionSnapshotId',p_service,
    'propertyNode',p_property,'reservationLineage',v_lineage_json,'attribution',v_attribution_json,
    'serviceProvisionDate',v_service.service_provision_date,
    'serviceProvisionSource',v_service.service_provision_source,
    'serviceProvisionEvidenceSha256',v_service.service_provision_evidence_sha256,'legalRule',v_service.legal_rule);
  v_service_preimage:=public.india_native_insertion_json(v_service_json);
  v_service_hash:=pg_catalog.encode(public.digest(pg_catalog.convert_to(v_service_preimage,'UTF8'),'sha256'),'hex');
  v_service_nested:=pg_catalog.json_build_object('serviceProvisionSnapshotId',p_service,
    'serviceProvisionDate',v_service.service_provision_date,'serviceProvisionSource',v_service.service_provision_source,
    'serviceProvisionEvidenceSha256',v_service.service_provision_evidence_sha256,'legalRule',v_service.legal_rule,
    'reservationLineage',v_lineage_json,'attribution',v_attribution_json);
  v_payment_json:=pg_catalog.json_build_object('tenantId',p_tenant,'paymentReceiptSnapshotId',p_payment,
    'propertyNode',p_property,'serviceProvision',v_service_nested,
    'supplierBooksEntryDate',v_payment.supplier_books_entry_date,'supplierBankCreditDate',v_payment.supplier_bank_credit_date,
    'paymentReceiptDate',v_payment.payment_receipt_date,'coverageScope','full_attribution',
    'amountMinor',v_payment.amount_minor::text,'currency','INR','paymentReceiptSource',v_payment.payment_receipt_source,
    'paymentReceiptEvidenceSha256',v_payment.payment_receipt_evidence_sha256,'legalRule',v_payment.legal_rule);
  v_payment_preimage:=public.india_native_insertion_json(v_payment_json);
  v_payment_hash:=pg_catalog.encode(public.digest(pg_catalog.convert_to(v_payment_preimage,'UTF8'),'sha256'),'hex');
  RETURN pg_catalog.jsonb_build_object(
    'serviceProvision',(v_service_json::jsonb-'tenantId')||pg_catalog.jsonb_build_object('evidenceHash',v_service_hash),
    'paymentReceipt',(v_payment_json::jsonb-'tenantId')||pg_catalog.jsonb_build_object('evidenceHash',v_payment_hash),
    'ordinaryRegime',pg_catalog.jsonb_build_object('ordinaryRegimeEvidenceId',p_ordinary,
      'serviceProvisionSnapshotId',p_service,'regime',v_ordinary.regime,
      'ordinaryRegimeSource',v_ordinary.ordinary_regime_source,'legalBasis',v_ordinary.legal_basis,
      'ordinaryRegimeEvidenceSha256',v_ordinary.ordinary_regime_evidence_sha256,'evidenceHash',v_ordinary.evidence_hash),
    'recordingRoots',pg_catalog.jsonb_build_object('serviceProvisionRecording',v_service.evidence_hash,
      'paymentReceiptRecording',v_payment.evidence_hash,'ordinaryRegimeRecording',v_ordinary.evidence_hash),
    'serviceProvisionCanonicalJson',v_service_preimage,'paymentReceiptCanonicalJson',v_payment_preimage,
    'lineage',pg_catalog.to_jsonb(v_lineage),'attributionSnapshot',v_attribution.snapshot);
END;
$$;
ALTER FUNCTION public.read_india_native_intake_source(uuid,uuid,uuid,uuid,uuid,uuid) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.read_india_native_intake_source(uuid,uuid,uuid,uuid,uuid,uuid)
  FROM PUBLIC,app_role,yellow_runtime;

-- Current authorization is deliberately separate from original attestation
-- provenance. Call before permanent replay as well as before a fresh preparation.
-- No lock here: the writer must lock and repeat the same grant graph before D99.
CREATE OR REPLACE FUNCTION public.read_india_native_issue_authority(
  p_tenant uuid,p_property uuid,p_actor uuid,p_reservation uuid,p_folio uuid
) RETURNS jsonb LANGUAGE plpgsql STABLE
SET search_path=pg_catalog,public SET timezone='UTC' SET datestyle='ISO,YMD' AS $$
DECLARE v_property public.org_node%ROWTYPE;v_folio public.folio%ROWTYPE;v_permission text;
BEGIN
  IF session_user<>'yellow_runtime' OR current_user<>'yellow_owner'
      OR pg_catalog.current_setting('role',true) IS DISTINCT FROM 'app_role'
      OR p_tenant IS NULL OR p_tenant IS DISTINCT FROM
        NULLIF(pg_catalog.current_setting('app.tenant_id',true),'')::uuid THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='native issue requires governed tenant runtime authority';
  END IF;
  IF p_property IS NULL OR p_actor IS NULL OR p_reservation IS NULL OR p_folio IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='native issue scope identities are required';
  END IF;
  PERFORM 1 FROM public.tenant t WHERE t.id=p_tenant AND t.status='active';
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='native tenant authority unavailable'; END IF;
  SELECT p.* INTO v_property FROM public.org_node p WHERE p.tenant_id=p_tenant
    AND p.id=p_property AND p.kind='property' AND p.currency='INR';
  IF NOT FOUND OR v_property.timezone IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='native property authority unavailable';
  END IF;
  FOREACH v_permission IN ARRAY ARRAY['tax-fiscal.documents:issue','tax-fiscal.india-valuation:finalize'] LOOP
    PERFORM 1 FROM public.app_user actor
      JOIN public.user_role ur ON ur.tenant_id=actor.tenant_id AND ur.user_id=actor.id
      JOIN public.role r ON r.tenant_id=ur.tenant_id AND r.id=ur.role_id
      JOIN public.role_permission rp ON rp.role_id=r.id AND rp.permission_code=v_permission
      JOIN public.permission permission_row ON permission_row.code=rp.permission_code
      JOIN public.org_node grant_node ON grant_node.tenant_id=ur.tenant_id AND grant_node.id=ur.scope_node
      WHERE actor.tenant_id=p_tenant AND actor.id=p_actor AND actor.status='active'
        AND grant_node.path @> v_property.path;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='native issuer requires both property issue and valuation authority';
    END IF;
  END LOOP;
  SELECT f.* INTO v_folio FROM public.folio f
    JOIN public.account a ON a.tenant_id=f.tenant_id AND a.id=f.account_id
      AND a.property_node=p_property AND a.role='guest' AND a.currency='INR'
    JOIN public.reservation r ON r.tenant_id=f.tenant_id AND r.id=f.reservation_id
      AND r.property_node=p_property AND r.currency='INR'
    WHERE f.tenant_id=p_tenant AND f.id=p_folio AND f.reservation_id=p_reservation;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native issue folio/property scope unavailable'; END IF;
  -- Closed folios remain eligible for exact completed replay. Fresh-write open
  -- state belongs to the locked prefix, not to permanent receipt authentication.
  RETURN pg_catalog.jsonb_build_object('propertyNode',p_property,'propertyTimezone',v_property.timezone,
    'folioAccountId',v_folio.account_id,'windowNo',v_folio.window_no,
    'invoiceIssueDate',(pg_catalog.transaction_timestamp() AT TIME ZONE v_property.timezone)::date,
    'transactionTimestamp',pg_catalog.transaction_timestamp(),'issuingTransactionId',pg_catalog.pg_current_xact_id()::text);
END;
$$;
ALTER FUNCTION public.read_india_native_issue_authority(uuid,uuid,uuid,uuid,uuid) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.read_india_native_issue_authority(uuid,uuid,uuid,uuid,uuid)
  FROM PUBLIC,app_role,yellow_runtime;

-- Rebuild the native valuation's complete original preimage from the four typed
-- tables and current consideration closure. This is not the final preparation
-- authenticator: fiscal configuration, date/rate/applicability and tax still have
-- their own required reconstruction. There is no lock or write in this reader.
CREATE OR REPLACE FUNCTION public.read_india_native_valuation_evidence(
  p_tenant uuid,p_property uuid,p_reservation uuid,p_folio uuid,p_valuation uuid,
  p_service uuid,p_payment uuid,p_ordinary uuid
) RETURNS jsonb LANGUAGE plpgsql STABLE
SET search_path=pg_catalog,public SET timezone='UTC' SET datestyle='ISO,YMD' AS $$
DECLARE
  v public.india_gst_accommodation_final_valuation%ROWTYPE;
  v_prior public.india_gst_accommodation_final_valuation%ROWTYPE;
  s public.india_gst_accommodation_valuation_source%ROWTYPE;
  n public.india_gst_accommodation_valuation_room_night%ROWTYPE;
  v_approval public.approval_request%ROWTYPE;v_reservation public.reservation%ROWTYPE;
  v_intake jsonb;v_closure jsonb;v_ordinary jsonb;v_request_sources jsonb:='[]'::jsonb;
  v_sources jsonb:='[]'::jsonb;v_nights jsonb:='[]'::jsonb;v_tuple jsonb;v_basis jsonb;
  v_weights bigint[]:='{}'::bigint[];v_allocation bigint[];v_actual bigint[];
  v_night_totals numeric[];v_dates date[]:='{}'::date[];v_ids uuid[]:='{}'::uuid[];
  v_candidates uuid[];v_group_party uuid;v_account_party uuid;
  v_relationship_hash text;v_request_hash text;v_approval_basis_hash text;v_approval_hash text;
  v_class_hash text;v_eligibility_hash text;v_source_hash text;v_basis_hash text;v_evidence_hash text;
  v_ordinary_hashes text[];v_expected_hash text;v_q jsonb;v_i integer:=0;v_j integer;v_count integer;
  v_source_count integer:=0;v_allocation_count integer:=0;v_total numeric:=0;v_weight_total numeric:=0;
BEGIN
  v_intake:=public.read_india_native_intake_source(p_tenant,p_property,p_reservation,p_service,p_payment,p_ordinary);
  v_closure:=public.read_india_native_valuation_source_closure(p_tenant,p_property,p_reservation,p_folio,p_valuation);
  SELECT val.* INTO v FROM public.india_gst_accommodation_final_valuation val
    JOIN public.folio f ON f.tenant_id=val.tenant_id AND f.id=val.folio_id
      AND f.reservation_id=val.reservation_id AND f.account_id=val.folio_account_id AND f.window_no=val.window_no
    WHERE val.tenant_id=p_tenant AND val.id=p_valuation AND val.property_node=p_property
      AND val.reservation_id=p_reservation AND val.folio_id=p_folio
      AND val.basis_kind='native_consideration' AND val.disposition='ordinary_final' AND val.currency='INR'
      AND val.native_service_provision_snapshot_id=p_service
      AND val.native_lineage_id=(v_intake->'lineage'->>'id')::uuid
      AND val.attribution_id=(v_intake->'lineage'->>'attribution_id')::uuid
      AND val.order341_evidence_hash IS NULL AND val.actor_id=val.attested_by AND val.recorded_at=val.attested_at
      AND val.relationship_conclusion='unrelated_not_distinct' AND val.consideration_conclusion='money_only'
      AND val.section15_2_conclusion='all_additions_enumerated' AND val.section15_3_conclusion='all_discounts_eligible'
      AND val.source_completeness_conclusion='all_sources_classified' AND pg_catalog.cardinality(val.manual_reasons)=0;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native valuation typed identity is inconsistent'; END IF;
  IF v.supersedes_valuation_id IS NOT NULL THEN
    SELECT old.* INTO v_prior FROM public.india_gst_accommodation_final_valuation old
      WHERE old.tenant_id=p_tenant AND old.id=v.supersedes_valuation_id
        AND old.basis_kind='native_consideration' AND old.property_node=p_property
        AND old.reservation_id=p_reservation AND old.folio_id=p_folio
        AND old.native_service_provision_snapshot_id=p_service AND old.generation=v.generation-1;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native valuation predecessor unavailable'; END IF;
    v_expected_hash:=v_prior.evidence_hash;
  ELSIF v.generation<>0 THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native valuation initial generation is inconsistent';
  END IF;
  v_count:=pg_catalog.jsonb_array_length(v_intake->'attributionSnapshot'->'revenueLine'->'roomNights');
  IF v_count NOT BETWEEN 1 AND 366 OR v_count IS DISTINCT FROM v.native_room_night_count
      OR v_intake->'attributionSnapshot'->'revenueLine'->>'nights' IS DISTINCT FROM v_count::text THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native valuation quote night count is inconsistent';
  END IF;
  FOR n IN SELECT night.* FROM public.india_gst_accommodation_valuation_room_night night
      WHERE night.tenant_id=p_tenant AND night.valuation_id=p_valuation ORDER BY night.ordinal LOOP
    v_q:=v_intake->'attributionSnapshot'->'revenueLine'->'roomNights'->v_i;
    IF n.ordinal<>v_i OR n.basis_kind<>'native_consideration' OR n.currency<>'INR'
        OR n.transaction_value_minor IS NULL OR n.transaction_value_minor<=0
        OR pg_catalog.jsonb_typeof(v_q) IS DISTINCT FROM 'object'
        OR NOT v_q ?& ARRAY['index','businessDate','amountMinor']
        OR v_q-ARRAY['index','businessDate','amountMinor']<>'{}'::jsonb
        OR v_q->>'index' IS DISTINCT FROM v_i::text
        OR v_q->>'businessDate' IS DISTINCT FROM n.business_date::text
        OR v_q->>'amountMinor' IS DISTINCT FROM n.quoted_weight_minor::text
        OR pg_catalog.jsonb_typeof(v_q->'amountMinor') IS DISTINCT FROM 'string'
        OR n.quoted_weight_minor<=0 OR (v_i>0 AND n.business_date<>v_dates[v_i]+1) THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native valuation quoted weights or dense dates are inconsistent';
    END IF;
    v_weights:=pg_catalog.array_append(v_weights,n.quoted_weight_minor);
    v_dates:=pg_catalog.array_append(v_dates,n.business_date);v_weight_total:=v_weight_total+n.quoted_weight_minor;
    v_nights:=v_nights||pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('ordinal',v_i,
      'businessDate',n.business_date,'quotedWeightMinor',n.quoted_weight_minor::text,
      'transactionValueMinor',n.transaction_value_minor::text));
    v_i:=v_i+1;
  END LOOP;
  IF v_i<>v_count OR v_weight_total>9223372036854775807::numeric
      OR v_weight_total::text IS DISTINCT FROM v_intake->'attributionSnapshot'->'revenueLine'->>'inputAmountMinor'
      OR v_weight_total::text IS DISTINCT FROM v_intake->'attributionSnapshot'->'evaluation'->>'inputTotalMinor' THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native valuation complete quoted weight total is inconsistent';
  END IF;
  v_night_totals:=pg_catalog.array_fill(0::numeric,ARRAY[v_count]);
  FOR s IN SELECT source.* FROM public.india_gst_accommodation_valuation_source source
      WHERE source.tenant_id=p_tenant AND source.valuation_id=p_valuation ORDER BY source.posting_root_id LOOP
    IF s.basis_kind<>'native_consideration' OR s.currency<>'INR'
        OR s.attested_by<>v.actor_id OR s.attested_at<>v.recorded_at
        OR ((s.source_kind IN ('promotion_discount','section15_3_discount'))<>(s.current_amount_minor<0))
        OR (s.source_kind='section15_2_addition' AND (s.addition_subtype IS NULL OR s.addition_subtype NOT IN (
          'tax_duty_cess_fee_charge_excluding_gst','supplier_liability_paid_by_recipient','incidental_expense',
          'interest_late_fee_penalty','non_government_price_linked_subsidy')))
        OR (s.source_kind<>'section15_2_addition' AND s.addition_subtype IS NOT NULL)
        OR (s.source_kind='section15_3_discount' AND (s.discount_eligibility IS NULL OR s.discount_eligibility NOT IN (
          'eligible_pre_supply_recorded','eligible_post_supply_linked_itc_reversed')))
        OR (s.source_kind<>'section15_3_discount' AND s.discount_eligibility IS NOT NULL)
        OR s.evidence_source !~ '^[a-z][a-z0-9_.:-]{2,63}$'
        OR pg_catalog.length(s.evidence_reference) NOT BETWEEN 1 AND 200 THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native valuation source classification is inconsistent';
    END IF;
    v_tuple:=pg_catalog.jsonb_build_object('postingRootId',s.posting_root_id,'sourceKind',s.source_kind,
      'additionSubtype',s.addition_subtype,'discountEligibility',s.discount_eligibility,
      'evidenceSource',s.evidence_source,'evidenceReference',s.evidence_reference);
    v_class_hash:=public.india_native_source_hash(pg_catalog.jsonb_build_array(
      'india-native-valuation-classification-v1',v_tuple,v.actor_id));
    v_eligibility_hash:=CASE WHEN s.source_kind='section15_3_discount' THEN
      public.india_native_source_hash(pg_catalog.jsonb_build_array('india-native-valuation-discount-v1',v_tuple,v.actor_id)) END;
    IF s.classification_evidence_hash IS DISTINCT FROM v_class_hash
        OR s.eligibility_evidence_hash IS DISTINCT FROM v_eligibility_hash THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native valuation classification preimage is inconsistent';
    END IF;
    IF v.supersedes_valuation_id IS NOT NULL AND EXISTS(
      SELECT 1 FROM public.india_gst_accommodation_valuation_source old
        WHERE old.tenant_id=p_tenant AND old.valuation_id=v.supersedes_valuation_id AND old.posting_root_id=s.posting_root_id
          AND (old.source_kind IS DISTINCT FROM s.source_kind OR old.addition_subtype IS DISTINCT FROM s.addition_subtype
            OR old.discount_eligibility IS DISTINCT FROM s.discount_eligibility
            OR old.evidence_source IS DISTINCT FROM s.evidence_source OR old.evidence_reference IS DISTINCT FROM s.evidence_reference)) THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native valuation successor reclassified an existing root';
    END IF;
    v_allocation:=public.india_native_signed_allocations(s.current_amount_minor,v_weights);
    SELECT pg_catalog.array_agg(COALESCE(a.amount_minor,0) ORDER BY night.ordinal) INTO v_actual
      FROM public.india_gst_accommodation_valuation_room_night night
      LEFT JOIN public.india_gst_accommodation_valuation_allocation a
        ON a.tenant_id=night.tenant_id AND a.valuation_id=night.valuation_id AND a.ordinal=night.ordinal
          AND a.posting_root_id=s.posting_root_id AND a.currency='INR' AND a.basis_kind='native_consideration'
      WHERE night.tenant_id=p_tenant AND night.valuation_id=p_valuation;
    IF v_actual IS DISTINCT FROM v_allocation THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native valuation allocation differs from signed-largest-remainder result';
    END IF;
    FOR v_j IN 1..v_count LOOP
      v_night_totals[v_j]:=v_night_totals[v_j]+v_allocation[v_j];
      IF v_allocation[v_j]<>0 THEN v_allocation_count:=v_allocation_count+1; END IF;
    END LOOP;
    v_request_sources:=v_request_sources||pg_catalog.jsonb_build_array(v_tuple);
    v_sources:=v_sources||pg_catalog.jsonb_build_array(v_tuple||pg_catalog.jsonb_build_object(
      'currentAmountMinor',s.current_amount_minor::text,'currency','INR','txCode',s.tx_code,
      'currentFragmentSetHash',s.current_fragment_set_hash,'classificationEvidenceHash',v_class_hash,
      'eligibilityEvidenceHash',v_eligibility_hash,'attestedBy',v.actor_id,
      'allocations',(SELECT pg_catalog.jsonb_agg(amount::text ORDER BY ordinal)
        FROM pg_catalog.unnest(v_allocation) WITH ORDINALITY allocations(amount,ordinal))));
    v_ids:=pg_catalog.array_append(v_ids,s.posting_root_id);v_source_count:=v_source_count+1;
    v_total:=v_total+s.current_amount_minor;
  END LOOP;
  IF v_source_count NOT BETWEEN 1 AND 500 OR v_source_count<>v.native_source_count
      OR v_total IS DISTINCT FROM v.transaction_value_minor::numeric
      OR v_total NOT BETWEEN 1 AND 9223372036854775807::numeric
      OR (SELECT pg_catalog.count(*) FROM public.india_gst_accommodation_valuation_allocation a
        WHERE a.tenant_id=p_tenant AND a.valuation_id=p_valuation)<>v_allocation_count THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native valuation complete source/allocation conservation failed';
  END IF;
  FOR v_j IN 1..v_count LOOP
    IF v_night_totals[v_j] NOT BETWEEN 1 AND 9223372036854775807::numeric
        OR v_night_totals[v_j]::bigint::text IS DISTINCT FROM v_nights->(v_j-1)->>'transactionValueMinor' THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native valuation per-night conservation failed';
    END IF;
  END LOOP;
  SELECT pg_catalog.encode(public.digest(pg_catalog.string_agg(id::text,',' ORDER BY id),'sha256'),'hex')
    INTO v_source_hash FROM pg_catalog.unnest(v_ids) id;
  IF v_source_hash IS DISTINCT FROM v.source_set_hash THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native valuation source-set hash is inconsistent';
  END IF;
  v_ordinary:=pg_catalog.jsonb_build_object('relationshipConclusion',v.relationship_conclusion,
    'considerationConclusion',v.consideration_conclusion,'section152Conclusion',v.section15_2_conclusion,
    'section153Conclusion',v.section15_3_conclusion,'sourceCompletenessConclusion',v.source_completeness_conclusion,
    'evidenceSource',v.attestation_evidence_source,'evidenceReference',v.attestation_evidence_reference);
  v_request_hash:=public.india_native_source_hash(pg_catalog.jsonb_build_object('kind','india-native-valuation-request-v1',
    'tenantId',p_tenant,'propertyNode',p_property,'reservationId',p_reservation,'folioId',p_folio,
    'buyerPartyId',v.buyer_party_id,'serviceProvisionSnapshotId',p_service,'actorId',v.actor_id,
    'expectedCurrentValuationId',v.supersedes_valuation_id,'expectedCurrentEvidenceHash',v_expected_hash,
    'approvalRequestId',v.approval_request_id,'sources',v_request_sources,'ordinaryAttestation',v_ordinary));
  IF v_request_hash IS DISTINCT FROM v.request_hash THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native valuation original actor-bound request is inconsistent';
  END IF;
  SELECT r.* INTO STRICT v_reservation FROM public.reservation r WHERE r.tenant_id=p_tenant AND r.id=p_reservation;
  SELECT a.party_id INTO STRICT v_account_party FROM public.account a WHERE a.tenant_id=p_tenant AND a.id=v.folio_account_id;
  SELECT g.account_party INTO v_group_party FROM public.reservation_group g WHERE g.tenant_id=p_tenant AND g.id=v_reservation.group_id;
  SELECT COALESCE(pg_catalog.array_agg(DISTINCT candidate ORDER BY candidate)
    FILTER (WHERE candidate IS NOT NULL),'{}'::uuid[]) INTO v_candidates
    FROM pg_catalog.unnest(ARRAY[v_reservation.primary_party,v_reservation.booker_party,v_account_party,v_group_party]) candidate;
  SELECT pg_catalog.encode(public.digest(COALESCE(pg_catalog.string_agg(candidate::text,',' ORDER BY candidate),''),'sha256'),'hex')
    INTO v_relationship_hash FROM pg_catalog.unnest(v_candidates) candidate;
  IF v_relationship_hash IS DISTINCT FROM v.relationship_set_hash
      OR EXISTS(SELECT 1 FROM public.party_relationship r WHERE r.tenant_id=p_tenant
        AND (r.from_party=v.buyer_party_id OR r.to_party=v.buyer_party_id))
      OR NOT EXISTS(SELECT 1 FROM public.party p WHERE p.tenant_id=p_tenant AND p.id=v.buyer_party_id AND p.status='active'
        AND EXISTS(SELECT 1 FROM public.party_role pr WHERE pr.tenant_id=p_tenant AND pr.party_id=p.id AND pr.role IN ('guest','company'))) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native valuation current legal buyer relationship differs';
  END IF;
  v_approval_basis_hash:=public.india_native_source_hash(pg_catalog.jsonb_build_array('india-native-valuation-approval-basis-v1',
    p_tenant,p_property,p_reservation,p_folio,v.buyer_party_id,p_service,
    v_intake->'recordingRoots'->>'serviceProvisionRecording',v_intake->'lineage'->>'snapshot_hash',
    v_request_hash,v_relationship_hash));
  IF NOT v.buyer_party_id=ANY(v_candidates) THEN
    -- An approval is consumed by the original valuation. Validate that recorded
    -- decision at recorded_at; do not invent expiry renewal or decider activity
    -- requirements for the later, independently authorized invoice issuer.
    SELECT ar.* INTO v_approval FROM public.approval_request ar WHERE ar.tenant_id=p_tenant
      AND ar.id=v.approval_request_id AND ar.kind='india_gst_legal_buyer_override'
      AND ar.subject_type='folio' AND ar.subject_id=p_folio AND ar.status='approved'
      AND ar.requested_by=v.actor_id AND ar.decided_by<>v.actor_id
      AND ar.decided_by=v.native_approval_actor_id AND ar.decided_at=v.native_approval_decided_at
      AND ar.valid_until=v.native_approval_valid_until AND ar.decided_at<=v.recorded_at
      AND ar.decided_at<ar.valid_until AND ar.valid_until>v.recorded_at
      AND ar.payload=pg_catalog.jsonb_build_object('propertyNode',p_property::text,'reservationId',p_reservation::text,
        'folioId',p_folio::text,'windowNo',v.window_no,'buyerPartyId',v.buyer_party_id::text,
        'relationshipSetHash',v_relationship_hash,'requestHash',v_request_hash,'basisKind','native_consideration',
        'serviceProvisionSnapshotId',p_service::text,'nativeApprovalBasisHash',v_approval_basis_hash);
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native valuation original approved override differs'; END IF;
    v_approval_hash:=public.india_native_source_hash(pg_catalog.jsonb_build_array('india-native-valuation-approval-v1',pg_catalog.to_jsonb(v_approval)));
  ELSIF v.approval_request_id IS NOT NULL OR v.native_approval_actor_id IS NOT NULL
      OR v.native_approval_decided_at IS NOT NULL OR v.native_approval_valid_until IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native related buyer has unexpected override evidence';
  END IF;
  IF v_approval_basis_hash IS DISTINCT FROM v.native_approval_basis_hash
      OR v_approval_hash IS DISTINCT FROM v.native_approval_evidence_hash THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native valuation approval evidence hash is inconsistent';
  END IF;
  v_ordinary_hashes:=ARRAY[
    public.india_native_source_hash(pg_catalog.jsonb_build_array('relationship',v.relationship_conclusion,v.attestation_evidence_source,v.attestation_evidence_reference,v.actor_id)),
    public.india_native_source_hash(pg_catalog.jsonb_build_array('consideration',v.consideration_conclusion,v.attestation_evidence_source,v.attestation_evidence_reference,v.actor_id)),
    public.india_native_source_hash(pg_catalog.jsonb_build_array('section152',v.section15_2_conclusion,v.attestation_evidence_source,v.attestation_evidence_reference,v.actor_id)),
    public.india_native_source_hash(pg_catalog.jsonb_build_array('section153',v.section15_3_conclusion,v.attestation_evidence_source,v.attestation_evidence_reference,v.actor_id)),
    public.india_native_source_hash(pg_catalog.jsonb_build_array('source-completeness',v.source_completeness_conclusion,v.attestation_evidence_source,v.attestation_evidence_reference,v.actor_id))];
  IF v_ordinary_hashes IS DISTINCT FROM v.ordinary_evidence_hashes THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native Section15 attestation preimages differ';
  END IF;
  v_basis:=pg_catalog.jsonb_build_object('kind','india-native-consideration-basis-v1',
    'tenantId',p_tenant,'propertyNode',p_property,'reservationId',p_reservation,'folioId',p_folio,
    'folioAccountId',v.folio_account_id,'windowNo',v.window_no,'buyerPartyId',v.buyer_party_id,
    'serviceProvisionSnapshotId',p_service,'serviceEvidenceHash',v_intake->'recordingRoots'->>'serviceProvisionRecording',
    'lineage',v_intake->'lineage','attributionSnapshotHash',v_intake->'lineage'->>'snapshot_hash',
    'sourceSetHash',v_source_hash,'sources',v_sources,'roomNights',v_nights,
    'ordinaryAttestation',v_ordinary,'ordinaryEvidenceHashes',v_ordinary_hashes,
    'relationshipSetHash',v_relationship_hash,'nativeApprovalBasisHash',v_approval_basis_hash,
    'approvalRequestId',v.approval_request_id,'approvalEvidenceHash',v_approval_hash,
    'approvalActorId',v_approval.decided_by,'approvalDecidedAt',v_approval.decided_at,
    'approvalValidUntil',v_approval.valid_until,'currency','INR','transactionValueMinor',v_total::bigint::text);
  v_basis_hash:=public.india_native_source_hash(v_basis);
  v_evidence_hash:=public.india_native_source_hash(pg_catalog.jsonb_build_array('india-native-valuation-root-v1',
    v.id,p_tenant,v.request_id,v.actor_id,v.native_request_key_hash,v_request_hash,
    v_basis_hash,v.generation,v.supersedes_valuation_id,v_expected_hash,v.recorded_at));
  IF v_basis_hash IS DISTINCT FROM v.native_consideration_basis_hash OR v_evidence_hash IS DISTINCT FROM v.evidence_hash THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native valuation complete canonical root is inconsistent';
  END IF;
  RETURN pg_catalog.jsonb_build_object('valuationId',v.id,'generation',v.generation,'actorId',v.actor_id,
    'requestId',v.request_id,'recordedAt',v.recorded_at,'evidenceHash',v_evidence_hash,
    'nativeConsiderationBasisHash',v_basis_hash,'basis',v_basis,'sourceClosure',v_closure,'intake',v_intake);
END;
$$;
ALTER FUNCTION public.read_india_native_valuation_evidence(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.read_india_native_valuation_evidence(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid)
  FROM PUBLIC,app_role,yellow_runtime;

-- Identity-only request preimage. Clock, generated IDs, resulting money/hashes,
-- idempotency key and audit request UUID are deliberately excluded. The exact
-- governed338 calendar input is retained; there is no fictitious calendar UUID.
-- This helper does not select a rate, authenticate calendar policy, or authorize
-- replay. The public writer must check current issue authority before any return.
CREATE OR REPLACE FUNCTION public.india_native_invoice_request_identity(
  p_tenant uuid,p_property uuid,p_actor uuid,p_reservation uuid,p_folio uuid,p_valuation uuid,
  p_service uuid,p_payment uuid,p_ordinary uuid,p_supplier_location uuid,p_supplier_status uuid,
  p_supplier_sez uuid,p_recipient_registration uuid,p_recipient_sez uuid,p_classification uuid,
  p_calendar_authority text,p_calendar_source_hash text,p_calendar_through date,
  p_calendar_dates date[],p_calendar_states text[],p_key text,p_request uuid
) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE
SET search_path=pg_catalog,public SET timezone='UTC' SET datestyle='ISO,YMD' AS $$
DECLARE v_size integer;v_i integer;v_calendar jsonb;v_body jsonb;v_preimage text;
BEGIN
  IF p_tenant IS NULL OR p_property IS NULL OR p_actor IS NULL OR p_reservation IS NULL
      OR p_folio IS NULL OR p_valuation IS NULL OR p_service IS NULL OR p_payment IS NULL
      OR p_ordinary IS NULL OR p_supplier_location IS NULL OR p_supplier_status IS NULL
      OR p_supplier_sez IS NULL OR p_recipient_registration IS NULL OR p_recipient_sez IS NULL
      OR p_classification IS NULL OR p_request IS NULL OR p_key IS NULL
      OR p_key COLLATE "C" !~ '^[!-~]{8,200}$'
      OR p_calendar_dates IS NULL OR p_calendar_states IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='native issue request identities or key are invalid';
  END IF;
  v_size:=pg_catalog.cardinality(p_calendar_dates);
  IF pg_catalog.cardinality(p_calendar_states)<>v_size THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='native governed calendar arrays have different lengths';
  END IF;
  IF v_size=0 THEN
    IF p_calendar_authority IS NOT NULL OR p_calendar_source_hash IS NOT NULL OR p_calendar_through IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='native absent calendar has unexpected metadata';
    END IF;
    v_calendar:='null'::jsonb;
  ELSE
    IF v_size NOT BETWEEN 4 AND 366 OR pg_catalog.array_ndims(p_calendar_dates) IS DISTINCT FROM 1
        OR pg_catalog.array_ndims(p_calendar_states) IS DISTINCT FROM 1
        OR pg_catalog.array_lower(p_calendar_dates,1) IS DISTINCT FROM 1
        OR pg_catalog.array_lower(p_calendar_states,1) IS DISTINCT FROM 1
        OR p_calendar_authority IS NULL OR p_calendar_authority !~ '^[A-Z][A-Z0-9_.:-]{2,127}$'
        OR p_calendar_source_hash IS NULL OR p_calendar_source_hash !~ '^[0-9a-f]{64}$'
        OR p_calendar_through IS DISTINCT FROM p_calendar_dates[v_size] THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='native governed calendar identity is incomplete';
    END IF;
    FOR v_i IN 1..v_size LOOP
      IF p_calendar_dates[v_i] IS NULL OR p_calendar_dates[v_i] NOT BETWEEN DATE '0001-01-01' AND DATE '9999-12-31'
          OR p_calendar_states[v_i] IS NULL OR p_calendar_states[v_i] NOT IN ('working','non_working')
          OR (v_i>1 AND p_calendar_dates[v_i]<>p_calendar_dates[v_i-1]+1) THEN
        RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='native governed calendar must contain dense classified dates';
      END IF;
    END LOOP;
    v_calendar:=pg_catalog.jsonb_build_object('authorityId',p_calendar_authority,
      'sourceDigestSha256',p_calendar_source_hash,'throughDate',p_calendar_through,
      'days',(SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('date',p_calendar_dates[i],
        'state',p_calendar_states[i]) ORDER BY i) FROM pg_catalog.generate_series(1,v_size) i));
  END IF;
  v_body:=pg_catalog.jsonb_build_object('kind','india-native-invoice-request-v2',
    'tenantId',p_tenant,'propertyNode',p_property,'actorId',p_actor,'reservationId',p_reservation,
    'folioId',p_folio,'valuationId',p_valuation,'serviceProvisionSnapshotId',p_service,
    'paymentReceiptSnapshotId',p_payment,'ordinaryRegimeEvidenceId',p_ordinary,
    'supplierServiceLocationId',p_supplier_location,'supplierRegistrationStatusId',p_supplier_status,
    'supplierSezStatusId',p_supplier_sez,'recipientRegistrationId',p_recipient_registration,
    'recipientSezStatusId',p_recipient_sez,'classificationId',p_classification,'calendarEvidence',v_calendar);
  v_preimage:=public.india_native_source_canonical_json(v_body);
  RETURN pg_catalog.jsonb_build_object('keyHash',pg_catalog.encode(public.digest(p_key,'sha256'),'hex'),
    'requestHash',public.india_native_source_hash(v_body),'request',v_body,'requestCanonicalJson',v_preimage);
END;
$$;
ALTER FUNCTION public.india_native_invoice_request_identity(
  uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,text,date,date[],text[],text,uuid)
  OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.india_native_invoice_request_identity(
  uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,text,date,date[],text[],text,uuid)
  FROM PUBLIC,app_role,yellow_runtime;
