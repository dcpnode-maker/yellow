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
