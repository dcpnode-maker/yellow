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

-- Order306 historical-resolution leaf, with the exact303/305 registered pair.
-- The date argument is PRIVATE: preparation derives it from authenticated intake
-- or its actual property-local transaction clock. This reader grants no public
-- legal-date override, does not create timing, and does not select Section14.
CREATE OR REPLACE FUNCTION public.read_india_native_rate_history_day(
  p_tenant uuid,p_property uuid,p_business_date date
) RETURNS jsonb LANGUAGE plpgsql STABLE
SET search_path=pg_catalog,public SET timezone='UTC' SET datestyle='ISO,YMD' AS $$
DECLARE
  v_context uuid;v_timezone text;v_from timestamptz;v_to timestamptz;
  v_from_text text;v_to_text text;v_assignment public.tax_assignment%ROWTYPE;
  v_assignment_count integer;v_extension public.extension%ROWTYPE;
  v_ids uuid[]:=ARRAY['a806f516-fed6-5768-b310-94aa03286adb'::uuid,'0b21daf2-ea6e-5568-9c21-69e4d4424574'::uuid];
  v_froms timestamptz[]:=ARRAY['2022-07-17T18:30:00Z'::timestamptz,'2025-09-21T18:30:00Z'::timestamptz];
  v_tos timestamptz[]:=ARRAY['2025-09-21T18:30:00Z'::timestamptz,NULL::timestamptz];
  v_hashes text[]:=ARRAY['2160e1747afcb3c280f1fd66e55534a5be563a10f277e8fcc178324e51abaa08',
    'eb323eff707aad1e460b425c87b448d4e924d2eb17499094abad71b33c69a820'];
  v_members jsonb[]:='{}'::jsonb[];v_i integer;v_matches integer:=0;
  v_pair jsonb;v_pair_hash text;v_body jsonb;v_selected jsonb;
BEGIN
  BEGIN v_context:=NULLIF(pg_catalog.current_setting('app.tenant_id',true),'')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='native historical-rate tenant context is invalid';
  END;
  IF p_tenant IS NULL OR p_tenant IS DISTINCT FROM v_context THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='native historical-rate tenant mismatch';
  END IF;
  IF p_property IS NULL OR p_business_date IS NULL
      OR p_business_date NOT BETWEEN DATE '0001-01-01' AND DATE '9999-12-31' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='native historical-rate property and finite civil date are required';
  END IF;
  SELECT p.timezone INTO v_timezone FROM public.org_node p
    JOIN public.tenant t ON t.id=p.tenant_id AND t.status='active'
    WHERE p.tenant_id=p_tenant AND p.id=p_property AND p.kind='property';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native historical-rate property unavailable';
  END IF;
  IF v_timezone IS NULL OR v_timezone='' OR v_timezone<>pg_catalog.btrim(v_timezone) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native historical-rate property timezone is invalid';
  END IF;
  v_from:=p_business_date::timestamp AT TIME ZONE v_timezone;
  v_to:=(p_business_date+1)::timestamp AT TIME ZONE v_timezone;
  v_from_text:=pg_catalog.to_char(v_from AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"');
  v_to_text:=pg_catalog.to_char(v_to AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"');
  IF v_from>=v_to OR v_from_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{6}Z$'
      OR v_to_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{6}Z$' THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native historical-rate whole property day is invalid';
  END IF;
  SELECT pg_catalog.count(*)::integer INTO v_assignment_count FROM public.tax_assignment a
    WHERE a.tenant_id=p_tenant AND a.property_node=p_property AND a.jurisdiction_key='in-gst-lodging'
      AND a.effective @> p_business_date;
  IF v_assignment_count<>1 THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native historical-rate assignment is missing or ambiguous';
  END IF;
  SELECT a.* INTO STRICT v_assignment FROM public.tax_assignment a
    WHERE a.tenant_id=p_tenant AND a.property_node=p_property AND a.jurisdiction_key='in-gst-lodging'
      AND a.effective @> p_business_date;
  IF (pg_catalog.lower(v_assignment.effective) IS NOT NULL AND
        pg_catalog.lower(v_assignment.effective) NOT BETWEEN DATE '0001-01-01' AND DATE '9999-12-31')
      OR (pg_catalog.upper(v_assignment.effective) IS NOT NULL AND
        pg_catalog.upper(v_assignment.effective) NOT BETWEEN DATE '0001-01-01' AND DATE '9999-12-31') THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native historical-rate assignment bounds are not canonical civil dates';
  END IF;
  FOR v_i IN 1..2 LOOP
    SELECT e.* INTO v_extension FROM public.extension e WHERE e.id=v_ids[v_i]
      AND e.tenant_id IS NULL AND e.type='tax_jurisdiction' AND e.key='in-gst-lodging'
      AND e.version=v_i AND e.status=CASE v_i WHEN 1 THEN 'retired' ELSE 'active' END;
    IF NOT FOUND OR pg_catalog.lower(v_extension.effective) IS DISTINCT FROM v_froms[v_i]
        OR pg_catalog.upper(v_extension.effective) IS DISTINCT FROM v_tos[v_i]
        OR NOT pg_catalog.lower_inc(v_extension.effective) OR pg_catalog.upper_inc(v_extension.effective)
        OR public.india_native_source_hash(v_extension.content) IS DISTINCT FROM v_hashes[v_i] THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native historical-rate approved registry member is inconsistent';
    END IF;
    v_members:=pg_catalog.array_append(v_members,pg_catalog.jsonb_build_object('extensionId',v_extension.id,
      'key','in-gst-lodging','version',v_i,'status',v_extension.status,
      'effectiveFromInstant',pg_catalog.to_char(v_froms[v_i] AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
      'effectiveToInstant',CASE WHEN v_tos[v_i] IS NOT NULL THEN
        pg_catalog.to_char(v_tos[v_i] AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') END,
      'content',v_extension.content,'contentHash',v_hashes[v_i],
      'gstRoomSlabs',pg_catalog.jsonb_build_array(
        pg_catalog.jsonb_build_object('uptoMinor',750000,'rate',CASE v_i WHEN 1 THEN 0.12::numeric ELSE 0.05::numeric END,'itcEligible',v_i=1),
        pg_catalog.jsonb_build_object('uptoMinor',NULL,'rate',0.18::numeric,'itcEligible',true))));
    IF v_froms[v_i]<=v_from AND (v_tos[v_i] IS NULL OR v_tos[v_i]>=v_to) THEN
      v_matches:=v_matches+1;v_selected:=v_members[v_i];
    END IF;
  END LOOP;
  IF v_matches<>1 THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='no single approved native rate member contains the whole property day';
  END IF;
  v_pair:=pg_catalog.jsonb_build_object('propertyNode',p_property,'predecessor',v_members[1],
    'successor',v_members[2],'cutoverInstant','2025-09-21T18:30:00.000000Z',
    'statutoryLowerBandDelta',pg_catalog.jsonb_build_object('thresholdMinor',750000,
      'predecessorRate',0.12::numeric,'predecessorItcEligible',true,'successorRate',0.05::numeric,
      'successorItcEligible',false,'predecessorHasNilBand',false,'successorHasNilBand',false),
    'sourceHashes',pg_catalog.jsonb_build_object(
      'notification20_2019','ee920c82c30ed88d9bb515d7d79b975cc2ed599c6dad411d04d8b7fcd5a86901',
      'notification04_2022','c6d264f1906375e93466dd97b2c60bb9b21c0dec34b93900b15237b4a98b7716',
      'notification15_2025','46c9447579017d8bf1fefd75b6e6a48856dab7b23e44c7e06babfdc99ae9d289'));
  v_pair_hash:=public.india_native_source_hash(v_pair||pg_catalog.jsonb_build_object(
    'tenantId',p_tenant,'predecessorOwnerTenantId',NULL,'successorOwnerTenantId',NULL));
  v_pair:=v_pair||pg_catalog.jsonb_build_object('evidenceHash',v_pair_hash);
  v_body:=pg_catalog.jsonb_build_object('property',pg_catalog.jsonb_build_object(
      'propertyNode',p_property,'propertyTimezone',v_timezone),
    'businessDay',pg_catalog.jsonb_build_object('businessDate',p_business_date,'fromInstant',v_from_text,'toInstant',v_to_text),
    'assignment',pg_catalog.jsonb_build_object('jurisdictionKey','in-gst-lodging',
      'effectiveFrom',pg_catalog.lower(v_assignment.effective),'effectiveTo',pg_catalog.upper(v_assignment.effective)),
    'selectedExtension',v_selected,'rateVersionPair',v_pair);
  RETURN v_body||pg_catalog.jsonb_build_object('evidenceHash',public.india_native_source_hash(
    v_body||pg_catalog.jsonb_build_object('tenantId',p_tenant)));
END;
$$;
ALTER FUNCTION public.read_india_native_rate_history_day(uuid,uuid,date) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.read_india_native_rate_history_day(uuid,uuid,date) FROM PUBLIC,app_role,yellow_runtime;

-- Pure parity with Order340's six strict arrangements. This is date arithmetic,
-- not an invoice clock, source authenticator, or permission to issue a document.
CREATE OR REPLACE FUNCTION public.india_native_section14_case(
  p_service date,p_invoice date,p_payment date,p_change date
) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE
SET search_path=pg_catalog,public SET timezone='UTC' SET datestyle='ISO,YMD' AS $$
DECLARE v_case text;v_supply date;v_side text;
BEGIN
  IF p_service IS NULL OR p_invoice IS NULL OR p_payment IS NULL OR p_change IS NULL
      OR p_service NOT BETWEEN DATE '0001-01-01' AND DATE '9999-12-31'
      OR p_invoice NOT BETWEEN DATE '0001-01-01' AND DATE '9999-12-31'
      OR p_payment NOT BETWEEN DATE '0001-01-01' AND DATE '9999-12-31'
      OR p_change NOT BETWEEN DATE '0001-01-01' AND DATE '9999-12-31' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Section14 requires four finite civil dates';
  END IF;
  IF p_service<p_change AND p_invoice>p_change AND p_payment>p_change THEN
    v_case:='supply_before_invoice_after_payment_after';v_supply:=LEAST(p_invoice,p_payment);v_side:='successor';
  ELSIF p_service<p_change AND p_invoice<p_change AND p_payment>p_change THEN
    v_case:='supply_invoice_before_payment_after';v_supply:=p_invoice;v_side:='predecessor';
  ELSIF p_service<p_change AND p_invoice>p_change AND p_payment<p_change THEN
    v_case:='supply_payment_before_invoice_after';v_supply:=p_payment;v_side:='predecessor';
  ELSIF p_service>p_change AND p_invoice<p_change AND p_payment>p_change THEN
    v_case:='supply_after_invoice_before_payment_after';v_supply:=p_payment;v_side:='successor';
  ELSIF p_service>p_change AND p_invoice<p_change AND p_payment<p_change THEN
    v_case:='supply_after_invoice_payment_before';v_supply:=LEAST(p_invoice,p_payment);v_side:='predecessor';
  ELSIF p_service>p_change AND p_invoice>p_change AND p_payment<p_change THEN
    v_case:='supply_invoice_after_payment_before';v_supply:=p_invoice;v_side:='successor';
  ELSE
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='date arrangement has no admitted Section14 case';
  END IF;
  RETURN pg_catalog.jsonb_build_object('case',v_case,'timeOfSupplyDate',v_supply,'selectedVersionSide',v_side);
END;
$$;
ALTER FUNCTION public.india_native_section14_case(date,date,date,date) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.india_native_section14_case(date,date,date,date) FROM PUBLIC,app_role,yellow_runtime;

-- Authenticated read-only prospective timing/rate leaf. The eight UUID selectors
-- are private server inputs; no supplied issue date, clock, money, or hash is an
-- authority. The projection root is deliberately NOT the full time-of-supply
-- hash. Its domain binds recording roots and this actual transaction/property
-- clock; the existing native TS envelope then derives its separate timing hash.
-- Insertion-order transport strings preserve the original 337/338/339/340 hashes.
-- This does not authenticate issue permission, acquire locks, insert preparation,
-- accept a completed replay, or claim the remaining source/valuation graph.
CREATE OR REPLACE FUNCTION public.read_india_native_invoice_timing_source(
  p_tenant uuid,p_property uuid,p_reservation uuid,p_service uuid,p_payment uuid,p_ordinary uuid,
  p_native_timing uuid,p_document uuid,p_calendar_authority text,p_calendar_source_hash text,
  p_calendar_through date,p_calendar_dates date[],p_calendar_states text[]
) RETURNS jsonb LANGUAGE plpgsql VOLATILE
SET search_path=pg_catalog,public SET timezone='UTC' SET datestyle='ISO,YMD' AS $$
DECLARE
  v_intake jsonb;v_service json;v_payment json;v_ordinary jsonb;v_timezone text;v_context jsonb;
  v_invoice date;v_service_date date;v_books date;v_bank date;v_receipt date;v_supply date;v_deadline date;
  v_change date:=DATE '2025-09-22';v_projection jsonb;v_projection_preimage jsonb;v_timing jsonb;
  v_histories jsonb:='{}';v_history_hashes jsonb:='{}';v_history jsonb;v_pair jsonb;v_keys text[];
  v_dates date[];v_i integer;v_member_count integer;v_selected jsonb;v_identity json;
  v_rate_date json;v_proviso json;v_calendar json;v_governed json;v_section14 json;v_payment_evidence json;
  v_text text;v_hash text;v_days json;v_four date[];v_fourth date;v_class jsonb;v_rate json;v_result json;v_input json;
  v_body json;v_input_text text;v_result_text text;v_existing public.india_gst_native_invoice_timing%ROWTYPE;
BEGIN
  -- Intake authenticates tenant context and the entire immutable recording chain.
  v_intake:=public.read_india_native_intake_source(p_tenant,p_property,p_reservation,p_service,p_payment,p_ordinary);
  IF p_native_timing IS NULL OR p_document IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='prospective native timing and document identities are required';
  END IF;
  SELECT p.timezone INTO v_timezone FROM public.org_node p
    JOIN public.tenant t ON t.id=p.tenant_id AND t.status='active'
    WHERE p.tenant_id=p_tenant AND p.id=p_property AND p.kind='property';
  IF NOT FOUND OR v_timezone IS NULL OR v_timezone='' OR v_timezone<>pg_catalog.btrim(v_timezone) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native timing property clock unavailable';
  END IF;
  v_invoice:=(pg_catalog.transaction_timestamp() AT TIME ZONE v_timezone)::date;
  v_context:=pg_catalog.jsonb_build_object('issuingTransactionId',pg_catalog.pg_current_xact_id()::text,
    'transactionTimestamp',pg_catalog.to_char(pg_catalog.transaction_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'propertyTimezone',v_timezone,'invoiceIssueDate',v_invoice);
  v_projection:=pg_catalog.jsonb_build_object('nativeTimingId',p_native_timing,'prospectiveDocumentId',p_document,
    'propertyNode',p_property,'reservationId',p_reservation,'serviceProvisionSnapshotId',p_service,
    'paymentReceiptSnapshotId',p_payment,'ordinaryRegimeEvidenceId',p_ordinary,'invoiceIssueDate',v_invoice);
  v_projection_preimage:=pg_catalog.jsonb_build_object('kind','india-native-invoice-timing-projection-v1',
    'tenantId',p_tenant,'projection',v_projection,'recordingRoots',v_intake->'recordingRoots','transactionContext',v_context);
  v_projection:=v_projection||pg_catalog.jsonb_build_object('evidenceHash',public.india_native_source_hash(v_projection_preimage));
  -- If the ID already has a row, only its actual issuing transaction can re-read
  -- this prospective leaf. Completed receipt replay belongs to the future issuer.
  SELECT n.* INTO v_existing FROM public.india_gst_native_invoice_timing n
    WHERE n.tenant_id=p_tenant AND (n.id=p_native_timing OR n.prospective_document_id=p_document);
  IF FOUND AND (v_existing.id IS DISTINCT FROM p_native_timing OR v_existing.prospective_document_id IS DISTINCT FROM p_document
      OR v_existing.property_node IS DISTINCT FROM p_property OR v_existing.reservation_id IS DISTINCT FROM p_reservation
      OR v_existing.service_provision_snapshot_id IS DISTINCT FROM p_service
      OR v_existing.payment_receipt_snapshot_id IS DISTINCT FROM p_payment
      OR v_existing.ordinary_regime_evidence_id IS DISTINCT FROM p_ordinary
      OR v_existing.issuing_transaction_id IS DISTINCT FROM pg_catalog.pg_current_xact_id()
      OR v_existing.transaction_timestamp IS DISTINCT FROM pg_catalog.transaction_timestamp()
      OR v_existing.property_timezone IS DISTINCT FROM v_timezone OR v_existing.invoice_issue_date IS DISTINCT FROM v_invoice
      OR v_existing.evidence_hash IS DISTINCT FROM v_projection->>'evidenceHash'
      OR v_existing.service_provision_evidence_hash IS DISTINCT FROM v_intake#>>'{recordingRoots,serviceProvisionRecording}'
      OR v_existing.payment_receipt_evidence_hash IS DISTINCT FROM v_intake#>>'{recordingRoots,paymentReceiptRecording}'
      OR v_existing.ordinary_regime_evidence_hash IS DISTINCT FROM v_intake#>>'{recordingRoots,ordinaryRegimeRecording}') THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native timing is not the reconstructed current transaction projection';
  END IF;
  -- Recover original ordered date projections from their authenticated preimages.
  SELECT pg_catalog.json_object_agg(e.key,e.value ORDER BY e.ordinality) INTO v_service
    FROM pg_catalog.json_each((v_intake->>'serviceProvisionCanonicalJson')::json) WITH ORDINALITY e WHERE e.key<>'tenantId';
  v_text:=public.india_native_insertion_json(v_service);
  v_service:=(pg_catalog.left(v_text,pg_catalog.length(v_text)-1)||',"evidenceHash":'||(v_intake#>'{serviceProvision,evidenceHash}')::text||'}')::json;
  SELECT pg_catalog.json_object_agg(e.key,e.value ORDER BY e.ordinality) INTO v_payment
    FROM pg_catalog.json_each((v_intake->>'paymentReceiptCanonicalJson')::json) WITH ORDINALITY e WHERE e.key<>'tenantId';
  v_text:=public.india_native_insertion_json(v_payment);
  v_payment:=(pg_catalog.left(v_text,pg_catalog.length(v_text)-1)||',"evidenceHash":'||(v_intake#>'{paymentReceipt,evidenceHash}')::text||'}')::json;
  v_ordinary:=v_intake->'ordinaryRegime';v_service_date:=(v_service->>'serviceProvisionDate')::date;
  v_books:=(v_payment->>'supplierBooksEntryDate')::date;v_bank:=(v_payment->>'supplierBankCreditDate')::date;
  v_receipt:=LEAST(v_books,v_bank);v_deadline:=v_service_date+30;
  IF v_invoice NOT BETWEEN DATE '0001-01-01' AND DATE '9999-12-31'
      OR v_deadline>DATE '9999-12-31' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='native timing exceeds admitted civil dates';
  END IF;
  v_supply:=LEAST(CASE WHEN v_invoice<=v_deadline THEN v_invoice ELSE v_service_date END,v_receipt);
  v_timing:=pg_catalog.jsonb_build_object('kind','native_current_transaction','nativeTimingId',p_native_timing,
    'prospectiveDocumentId',p_document,'serviceProvisionSnapshotId',p_service,'paymentReceiptSnapshotId',p_payment,
    'ordinaryRegimeEvidenceId',p_ordinary,'propertyNode',p_property,'reservationId',p_reservation,
    'serviceProvisionDate',v_service_date,'paymentReceiptDate',v_receipt,'invoiceIssueDate',v_invoice,
    'supplierBooksEntryDate',v_books,'supplierBankCreditDate',v_bank,'deadlineDate',v_deadline,
    'candidateDates',CASE WHEN v_invoice<=v_deadline THEN pg_catalog.jsonb_build_object('invoiceIssueDate',v_invoice,'paymentReceiptDate',v_receipt)
      ELSE pg_catalog.jsonb_build_object('serviceProvisionDate',v_service_date,'paymentReceiptDate',v_receipt) END,
    'branch',CASE WHEN v_invoice<=v_deadline THEN 'section13_2_a_invoice_or_payment' ELSE 'section13_2_b_service_or_payment' END,
    'timeOfSupplyDate',v_supply,'regime','ordinary_rule47_30_day','ordinaryRegimeSource','governed_rule47_ordinary_regime_record',
    'ordinaryRegimeLegalBasis','CGST_RULE_47_ORDINARY_SERVICE_INVOICE_30_DAY_INPUT','amountMinor',v_payment->>'amountMinor','currency','INR',
    'predecessorHashes',pg_catalog.jsonb_build_object('serviceProvision',v_service->>'evidenceHash',
      'paymentReceipt',v_payment->>'evidenceHash','ordinaryRegime',v_ordinary->>'evidenceHash','nativeTiming',v_projection->>'evidenceHash'));
  v_timing:=v_timing||pg_catalog.jsonb_build_object('evidenceHash',public.india_native_source_hash(
    v_timing||pg_catalog.jsonb_build_object('tenantId',p_tenant)));
  v_keys:=ARRAY['serviceProvision','invoiceIssue','supplierBooksEntry','supplierBankCredit','paymentReceipt','timeOfSupply'];
  v_dates:=ARRAY[v_service_date,v_invoice,v_books,v_bank];
  FOR v_i IN 1..4 LOOP
    v_history:=public.read_india_native_rate_history_day(p_tenant,p_property,v_dates[v_i]);
    IF v_pair IS NULL THEN v_pair:=v_history->'rateVersionPair';
    ELSIF v_pair IS DISTINCT FROM v_history->'rateVersionPair' THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native timing rate history changed between source days';
    END IF;
    v_histories:=v_histories||pg_catalog.jsonb_build_object(v_keys[v_i],v_history);
  END LOOP;
  SELECT pg_catalog.count(DISTINCT e.value->'selectedExtension')::integer INTO v_member_count
    FROM pg_catalog.jsonb_each(v_histories) e;
  -- Order337 rate-date identity uses a sorted hash but the identity/result key
  -- order below is also preserved for 339's original exact insertion replay.
  SELECT pg_catalog.json_build_object('predecessor',pg_catalog.json_build_object(
      'extensionId',v_pair#>'{predecessor,extensionId}','version',1,'status','retired',
      'effectiveFromInstant',v_pair#>'{predecessor,effectiveFromInstant}','effectiveToInstant',v_pair#>'{predecessor,effectiveToInstant}',
      'contentHash',v_pair#>'{predecessor,contentHash}'),'successor',pg_catalog.json_build_object(
      'extensionId',v_pair#>'{successor,extensionId}','version',2,'status','active',
      'effectiveFromInstant',v_pair#>'{successor,effectiveFromInstant}','effectiveToInstant',NULL,
      'contentHash',v_pair#>'{successor,contentHash}'),'cutoverInstant',v_pair->'cutoverInstant','rateChangeDate',v_change,
      'notification15SourceHash',v_pair#>'{sourceHashes,notification15_2025}','pairEvidenceHash',v_pair->'evidenceHash') INTO v_rate_date;
  v_hash:=public.india_native_source_hash(v_rate_date::jsonb||pg_catalog.jsonb_build_object('propertyNode',p_property));
  v_text:=public.india_native_insertion_json(v_rate_date);
  v_rate_date:=(pg_catalog.left(v_text,pg_catalog.length(v_text)-1)||',"evidenceHash":"'||v_hash||'"}')::json;
  IF v_member_count=1 THEN
    IF p_calendar_authority IS NOT NULL OR p_calendar_source_hash IS NOT NULL OR p_calendar_through IS NOT NULL
        OR p_calendar_dates IS DISTINCT FROM ARRAY[]::date[] OR p_calendar_states IS DISTINCT FROM ARRAY[]::text[] THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='ordinary single-version timing cannot carry Section14 calendar evidence';
    END IF;
    v_selected:=v_histories#>'{serviceProvision,selectedExtension}';
  ELSIF v_member_count=2 THEN
    IF v_bank>v_change THEN
      v_proviso:=pg_catalog.json_build_object('state','working_day_calendar_required','supplierBooksEntryDate',v_books,
        'supplierBankCreditDate',v_bank,'rateChangeDate',v_change,'legalRule','CGST_ACT_14_PAYMENT_CREDIT_FOUR_WORKING_DAY_PROVISO_GUARD');
    ELSE
      v_proviso:=pg_catalog.json_build_object('state','proviso_not_triggered_on_recorded_dates','paymentReceiptDate',v_receipt,
        'supplierBooksEntryDate',v_books,'supplierBankCreditDate',v_bank,'rateChangeDate',v_change,
        'legalRule','CGST_ACT_14_PAYMENT_CREDIT_FOUR_WORKING_DAY_PROVISO_GUARD');
    END IF;
    v_text:=public.india_native_insertion_json(v_proviso);
    v_hash:=pg_catalog.encode(public.digest(pg_catalog.convert_to(v_text,'UTF8'),'sha256'),'hex');
    v_proviso:=(pg_catalog.left(v_text,pg_catalog.length(v_text)-1)||',"evidenceHash":"'||v_hash||'"}')::json;
    IF v_bank>v_change THEN
      IF p_calendar_authority IS NULL OR p_calendar_authority !~ '^[A-Z][A-Z0-9_.:-]{2,127}$'
          OR p_calendar_source_hash IS NULL OR p_calendar_source_hash !~ '^[0-9a-f]{64}$'
          OR p_calendar_through IS NULL OR p_calendar_dates IS NULL OR p_calendar_states IS NULL
          OR pg_catalog.cardinality(p_calendar_dates) NOT BETWEEN 4 AND 366
          OR pg_catalog.cardinality(p_calendar_dates)<>pg_catalog.cardinality(p_calendar_states)
          OR pg_catalog.array_ndims(p_calendar_dates)<>1 OR pg_catalog.array_lower(p_calendar_dates,1)<>1
          OR pg_catalog.array_ndims(p_calendar_states)<>1 OR pg_catalog.array_lower(p_calendar_states,1)<>1 THEN
        RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='mixed rate timing requires complete governed working-day calendar';
      END IF;
      v_four:=ARRAY[]::date[];
      FOR v_i IN 1..pg_catalog.cardinality(p_calendar_dates) LOOP
        IF p_calendar_dates[v_i] IS DISTINCT FROM v_change+v_i
            OR p_calendar_dates[v_i]>=DATE '9999-12-31' OR p_calendar_states[v_i] IS NULL
            OR p_calendar_states[v_i] NOT IN ('working','non_working') THEN
          RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='working-day calendar must classify consecutive days after the cutover';
        END IF;
        IF p_calendar_states[v_i]='working' AND pg_catalog.cardinality(v_four)<4 THEN
          v_four:=pg_catalog.array_append(v_four,p_calendar_dates[v_i]);
        END IF;
      END LOOP;
      IF p_calendar_dates[pg_catalog.cardinality(p_calendar_dates)] IS DISTINCT FROM p_calendar_through
          OR pg_catalog.cardinality(v_four)<>4 OR NOT(v_bank=ANY(p_calendar_dates)) THEN
        RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='working-day calendar must end at throughDate and cover bank credit and four working days';
      END IF;
      v_fourth:=v_four[4];
      SELECT pg_catalog.json_agg(pg_catalog.json_build_object('date',p_calendar_dates[i],'state',p_calendar_states[i]) ORDER BY i)
        INTO v_days FROM pg_catalog.generate_subscripts(p_calendar_dates,1) i;
      v_calendar:=pg_catalog.json_build_object('rateChangeDate',v_change,'throughDate',p_calendar_through,'jurisdiction','IN',
        'authorityId',p_calendar_authority,'sourceDigestSha256',p_calendar_source_hash,'calendarDays',v_days,
        'firstFourWorkingDates',v_four,'fourthWorkingDayDate',v_fourth,'legalRule','CGST_ACT_14_FOUR_WORKING_DAY_CALENDAR_EVIDENCE_ONLY');
      v_text:=public.india_native_insertion_json(v_calendar);
      v_hash:=pg_catalog.encode(public.digest(pg_catalog.convert_to('{"tenantId":'||pg_catalog.to_json(p_tenant)::text||','||pg_catalog.substr(v_text,2),'UTF8'),'sha256'),'hex');
      v_calendar:=(pg_catalog.left(v_text,pg_catalog.length(v_text)-1)||',"evidenceHash":"'||v_hash||'"}')::json;
      v_receipt:=CASE WHEN v_bank>v_fourth THEN v_bank ELSE LEAST(v_books,v_bank) END;
      v_governed:=pg_catalog.json_build_object('rateChangeDate',v_change,'supplierBooksEntryDate',v_books,'supplierBankCreditDate',v_bank,
        'fourthWorkingDayDate',v_fourth,'paymentReceiptDate',v_receipt,'branch',CASE WHEN v_bank>v_fourth
          THEN 'bank_credit_after_four_working_days' ELSE 'ordinary_earlier_of_within_four_working_days' END,
        'calendarAuthorityId',p_calendar_authority,'calendarSourceDigestSha256',p_calendar_source_hash,
        'legalRule','CGST_ACT_14_PAYMENT_RECEIPT_DATE_FOUR_WORKING_DAY_PROVISO','predecessorHashes',pg_catalog.json_build_object(
          'rateChangeDate',v_rate_date->>'evidenceHash','paymentProviso',v_proviso->>'evidenceHash','workingDayCalendar',v_calendar->>'evidenceHash'));
      v_text:=public.india_native_insertion_json(v_governed);
      v_hash:=pg_catalog.encode(public.digest(pg_catalog.convert_to('{"tenantId":'||pg_catalog.to_json(p_tenant)::text||','||pg_catalog.substr(v_text,2),'UTF8'),'sha256'),'hex');
      v_governed:=(pg_catalog.left(v_text,pg_catalog.length(v_text)-1)||',"evidenceHash":"'||v_hash||'"}')::json;
      v_payment_evidence:=pg_catalog.json_build_object('kind','calendar_governed_receipt','paymentProvisoEvidence',v_proviso,
        'throughDate',p_calendar_through,'calendarEvidence',pg_catalog.json_build_object('jurisdiction','IN','authorityId',p_calendar_authority,
          'sourceDigestSha256',p_calendar_source_hash,'days',v_days),'workingDayEvidence',v_calendar,'paymentReceiptEvidence',v_governed);
    ELSE
      IF p_calendar_authority IS NOT NULL OR p_calendar_source_hash IS NOT NULL OR p_calendar_through IS NOT NULL
          OR p_calendar_dates IS DISTINCT FROM ARRAY[]::date[] OR p_calendar_states IS DISTINCT FROM ARRAY[]::text[] THEN
        RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='safe ordinary receipt cannot carry working-day calendar evidence';
      END IF;
      v_payment_evidence:=pg_catalog.json_build_object('kind','safe_ordinary_receipt','paymentProvisoEvidence',v_proviso);
    END IF;
    v_class:=public.india_native_section14_case(v_service_date,v_invoice,v_receipt,v_change);
    v_supply:=(v_class->>'timeOfSupplyDate')::date;v_selected:=v_pair->(v_class->>'selectedVersionSide');
    v_identity:=pg_catalog.json_build_object('extensionId',v_selected->'extensionId','version',v_selected->'version',
      'status',v_selected->'status','contentHash',v_selected->'contentHash','effectiveFromInstant',v_selected->'effectiveFromInstant',
      'effectiveToInstant',v_selected->'effectiveToInstant');
    v_section14:=pg_catalog.json_build_object('case',v_class->>'case','serviceProvisionDate',v_service_date,'invoiceIssueDate',v_invoice,
      'paymentReceiptDate',v_receipt,'rateChangeDate',v_change,'timeOfSupplyDate',v_supply,'selectedVersionSide',v_class->>'selectedVersionSide',
      'selectedVersion',v_identity,'legalRule','CGST_ACT_14_CHANGE_IN_RATE_SIX_CASE_RATE_VERSION_SELECTION',
      'predecessorHashes',pg_catalog.json_build_object('rateVersionPair',v_pair->>'evidenceHash','rateChangeDate',v_rate_date->>'evidenceHash',
        'serviceProvision',v_service->>'evidenceHash','paymentReceipt',v_payment->>'evidenceHash','invoiceIssue',v_projection->>'evidenceHash',
        'paymentProviso',v_proviso->>'evidenceHash','workingDayCalendar',v_calendar->>'evidenceHash','governedPaymentReceipt',v_governed->>'evidenceHash'));
    v_text:=public.india_native_insertion_json(v_section14);
    v_hash:=pg_catalog.encode(public.digest(pg_catalog.convert_to('{"tenantId":'||pg_catalog.to_json(p_tenant)::text||',"propertyNode":'||
      pg_catalog.to_json(p_property)::text||',"reservationId":'||pg_catalog.to_json(p_reservation)::text||','||pg_catalog.substr(v_text,2),'UTF8'),'sha256'),'hex');
    v_section14:=(pg_catalog.left(v_text,pg_catalog.length(v_text)-1)||',"evidenceHash":"'||v_hash||'"}')::json;
  ELSE
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native timing lacks a single approved pair of rate versions';
  END IF;
  v_dates:=ARRAY[v_receipt,v_supply];
  FOR v_i IN 1..2 LOOP
    v_history:=public.read_india_native_rate_history_day(p_tenant,p_property,v_dates[v_i]);
    IF v_history->'rateVersionPair' IS DISTINCT FROM v_pair
        OR ((v_member_count=1 OR v_i=2) AND v_history->'selectedExtension' IS DISTINCT FROM v_selected) THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native selected rate conflicts with whole-day receipt or time-of-supply history';
    END IF;
    v_histories:=v_histories||pg_catalog.jsonb_build_object(v_keys[v_i+4],v_history);
  END LOOP;
  FOR v_i IN 1..6 LOOP
    v_history_hashes:=v_history_hashes||pg_catalog.jsonb_build_object(v_keys[v_i],v_histories#>ARRAY[v_keys[v_i],'evidenceHash']);
  END LOOP;
  v_rate:=CASE WHEN v_member_count=1 THEN pg_catalog.json_build_object('kind','ordinary_section13_single_version',
      'selectedVersion',v_selected,'historicalResolutionEvidenceHashes',v_history_hashes)
    ELSE pg_catalog.json_build_object('kind','genuine_section14_rate_change','section14',v_section14,'historicalResolutionEvidenceHashes',v_history_hashes) END;
  v_hash:=public.india_native_source_hash(v_rate::jsonb||pg_catalog.jsonb_build_object('tenantId',p_tenant,'propertyNode',p_property,
    'reservationId',p_reservation,'invoiceTimingEvidenceHash',v_timing->>'evidenceHash','rateVersionPairEvidenceHash',v_pair->>'evidenceHash'));
  v_text:=public.india_native_insertion_json(v_rate);
  v_rate:=(pg_catalog.left(v_text,pg_catalog.length(v_text)-1)||',"evidenceHash":"'||v_hash||'"}')::json;
  v_result:=pg_catalog.json_build_object('kind','native_current_transaction','timing',v_timing,'rateSource',v_rate);
  v_hash:=public.india_native_source_hash(v_result::jsonb||pg_catalog.jsonb_build_object('tenantId',p_tenant));
  v_text:=public.india_native_insertion_json(v_result);
  v_result_text:=pg_catalog.left(v_text,pg_catalog.length(v_text)-1)||',"evidenceHash":"'||v_hash||'"}';
  v_input:=pg_catalog.json_build_object('kind','native_current_transaction','tenantId',p_tenant,'propertyNode',p_property,
    'reservationId',p_reservation,'serviceProvision',v_service,'paymentReceipt',v_payment,'ordinaryRegime',v_ordinary,
    'nativeTiming',v_projection,'rateVersionPair',v_pair,'rateChangeDateEvidence',v_rate_date,
    'historicalResolutions',v_histories,'section14PaymentEvidence',v_payment_evidence);
  v_input_text:=public.india_native_insertion_json(v_input);
  RETURN pg_catalog.jsonb_build_object('nativeTiming',v_projection,'nativeTimingProjectionPreimage',v_projection_preimage,
    'transactionContext',v_context,'invoiceSourceInput',v_input::jsonb,'invoiceSourceResult',v_result_text::jsonb,
    'invoiceSourceInputCanonicalJson',v_input_text,'invoiceSourceResultCanonicalJson',v_result_text);
END;
$$;
ALTER FUNCTION public.read_india_native_invoice_timing_source(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,text,date,date[],text[]) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.read_india_native_invoice_timing_source(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,text,date,date[],text[]) FROM PUBLIC,app_role,yellow_runtime;

-- Private, write-free composition only. The three text arguments are exact
-- sibling-reader outputs assembled inside the future preparation capability;
-- recognizing their hashes is not complete preparation authenticity and grants
-- no actor, date, amount, numbering, or publication authority.
CREATE OR REPLACE FUNCTION public.compose_india_native_quoted_tax_source(
  p_tenant uuid,p_property uuid,p_reservation uuid,p_folio uuid,p_valuation uuid,
  p_native_invoice_source_input text,p_native_invoice_source_result text,
  p_service_supply_nature text
) RETURNS jsonb LANGUAGE plpgsql VOLATILE
SET search_path=pg_catalog,public SET timezone='UTC' SET datestyle='ISO,YMD' AS $$
DECLARE
  v_context uuid;v_input json;v_result json;v_nature json;v_nature_body json;v_fresh jsonb;
  v_calendar_authority text;v_calendar_hash text;v_calendar_through date;
  v_calendar_dates date[]:=ARRAY[]::date[];v_calendar_states text[]:=ARRAY[]::text[];
  v_payment_evidence jsonb;v_timing json;v_rate json;v_intake jsonb;v_valuation jsonb;
  v_history jsonb;v_history_selected jsonb;v_family_name text;v_component_rule text;
  v_family_jurisdiction json;v_family_body json;v_family json;v_family_text text;
  v_service_selected json;v_levy_body json;v_levy json;v_levy_text text;
  v_identities json;v_identity_predecessors json;v_identity_body json;v_identity json;v_identity_text text;
  v_selected json;v_rate_selection json;v_native_timing json;v_lineage json;
  v_attribution jsonb;v_night jsonb;v_slab jsonb;v_component json;v_quote_components json;
  v_components_text text:='[';v_quote_text text:='[';v_separator text:='';v_quote_separator text:='';
  v_night_ordinal integer:=0;
  v_amount bigint;v_total bigint:=0;v_aggregate_bps integer;v_component_bps integer;
  v_aggregate_rate numeric;v_component_rate numeric;v_identity_name text;v_identity_count integer;
  v_lineage_hash text;v_predecessors json;v_quote_body json;v_quote json;v_quote_canonical text;
  v_preview jsonb;v_tax_predecessors json;v_tax_body json;v_tax_canonical text;
  v_text text;v_hash text;
BEGIN
  -- This pure/private composition is not complete preparation authenticity.
  BEGIN
    v_context:=NULLIF(pg_catalog.current_setting('app.tenant_id',true),'')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='native quoted-tax tenant context is invalid';
  END;
  IF p_tenant IS NULL OR p_tenant IS DISTINCT FROM v_context THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='native quoted-tax tenant mismatch';
  END IF;
  IF p_property IS NULL OR p_reservation IS NULL OR p_folio IS NULL OR p_valuation IS NULL
      OR p_native_invoice_source_input IS NULL OR p_native_invoice_source_result IS NULL
      OR p_service_supply_nature IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='native quoted-tax private source transports are required';
  END IF;
  BEGIN
    v_input:=p_native_invoice_source_input::json;
    v_result:=p_native_invoice_source_result::json;
    v_nature:=p_service_supply_nature::json;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='native quoted-tax private source transport is not JSON';
  END;
  IF pg_catalog.json_typeof(v_input)<>'object' OR pg_catalog.json_typeof(v_result)<>'object'
      OR pg_catalog.json_typeof(v_nature)<>'object'
      OR p_native_invoice_source_input IS DISTINCT FROM public.india_native_insertion_json(v_input)
      OR p_native_invoice_source_result IS DISTINCT FROM public.india_native_insertion_json(v_result)
      OR p_service_supply_nature IS DISTINCT FROM public.india_native_insertion_json(v_nature)
      OR v_input->>'kind' IS DISTINCT FROM 'native_current_transaction'
      OR v_input->>'tenantId' IS DISTINCT FROM p_tenant::text
      OR v_input->>'propertyNode' IS DISTINCT FROM p_property::text
      OR v_input->>'reservationId' IS DISTINCT FROM p_reservation::text
      OR v_result->>'kind' IS DISTINCT FROM 'native_current_transaction' THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native quoted-tax source originals are not exact canonical transports';
  END IF;

  -- Re-run the actual-clock timing reader with calendar authority recovered only
  -- from its authenticated original input. Exact text equality rejects altered,
  -- reduced, or merely digest-shaped timing/rate evidence, including ordinary
  -- inputs carrying Section14 calendar material.
  v_payment_evidence:=v_input::jsonb->'section14PaymentEvidence';
  IF pg_catalog.jsonb_typeof(v_payment_evidence)='object'
      AND v_payment_evidence->>'kind'='calendar_governed_receipt' THEN
    v_calendar_authority:=v_payment_evidence#>>'{calendarEvidence,authorityId}';
    v_calendar_hash:=v_payment_evidence#>>'{calendarEvidence,sourceDigestSha256}';
    v_calendar_through:=(v_payment_evidence->>'throughDate')::date;
    SELECT pg_catalog.array_agg((d.value->>'date')::date ORDER BY d.ordinality),
           pg_catalog.array_agg(d.value->>'state' ORDER BY d.ordinality)
      INTO v_calendar_dates,v_calendar_states
      FROM pg_catalog.jsonb_array_elements(v_payment_evidence#>'{calendarEvidence,days}')
        WITH ORDINALITY d(value,ordinality);
  ELSIF pg_catalog.jsonb_typeof(v_payment_evidence)='null'
      OR (pg_catalog.jsonb_typeof(v_payment_evidence)='object'
        AND v_payment_evidence->>'kind'='safe_ordinary_receipt') THEN
    v_calendar_authority:=NULL;v_calendar_hash:=NULL;v_calendar_through:=NULL;
  ELSE
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native quoted-tax timing carries an unsupported payment/calendar branch';
  END IF;
  v_fresh:=public.read_india_native_invoice_timing_source(
    p_tenant,p_property,p_reservation,
    (v_input#>>'{serviceProvision,serviceProvisionSnapshotId}')::uuid,
    (v_input#>>'{paymentReceipt,paymentReceiptSnapshotId}')::uuid,
    (v_input#>>'{ordinaryRegime,ordinaryRegimeEvidenceId}')::uuid,
    (v_input#>>'{nativeTiming,nativeTimingId}')::uuid,
    (v_input#>>'{nativeTiming,prospectiveDocumentId}')::uuid,
    v_calendar_authority,v_calendar_hash,v_calendar_through,
    COALESCE(v_calendar_dates,ARRAY[]::date[]),COALESCE(v_calendar_states,ARRAY[]::text[]));
  IF v_fresh->>'invoiceSourceInputCanonicalJson' IS DISTINCT FROM p_native_invoice_source_input
      OR v_fresh->>'invoiceSourceResultCanonicalJson' IS DISTINCT FROM p_native_invoice_source_result THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native quoted-tax timing input/result do not byte-match current authenticated roots';
  END IF;
  v_timing:=v_result->'timing';v_rate:=v_result->'rateSource';
  v_valuation:=public.read_india_native_valuation_evidence(p_tenant,p_property,p_reservation,p_folio,p_valuation,
    (v_timing->>'serviceProvisionSnapshotId')::uuid,(v_timing->>'paymentReceiptSnapshotId')::uuid,
    (v_timing->>'ordinaryRegimeEvidenceId')::uuid);
  v_intake:=v_valuation->'intake';v_attribution:=v_intake->'attributionSnapshot';

  -- Replay the exact Order287 candidate preimage supplied by the private dual-date
  -- statutory reader. The family history is independently resolved at the service
  -- day; the selected time-of-supply member below remains a distinct rate graph.
  SELECT pg_catalog.json_object_agg(e.key,e.value ORDER BY e.ordinality) INTO v_nature_body
    FROM pg_catalog.json_each(v_nature) WITH ORDINALITY e
    WHERE e.key NOT IN ('candidateJson','candidateHash');
  v_text:=public.india_native_insertion_json(v_nature_body);
  v_hash:=pg_catalog.encode(public.digest(pg_catalog.convert_to(
    public.india_native_insertion_json(pg_catalog.json_build_object('tenantId',p_tenant,'candidate',v_nature_body)),
    'UTF8'),'sha256'),'hex');
  IF (SELECT pg_catalog.array_agg(key ORDER BY key) FROM pg_catalog.json_each(v_nature))
        IS DISTINCT FROM ARRAY['buyerAssociation','candidateHash','candidateJson','classification','determinationBasis',
          'folioId','jurisdiction','legalRule','placeOfSupply','propertyNode','recipient','registeredStateComparison',
          'reservationId','sezDirection','supplier','supplyDate','supplyNature']::text[]
      OR v_nature->>'propertyNode' IS DISTINCT FROM p_property::text
      OR v_nature->>'reservationId' IS DISTINCT FROM p_reservation::text
      OR v_nature->>'folioId' IS DISTINCT FROM p_folio::text
      OR v_nature->>'supplyDate' IS DISTINCT FROM v_timing->>'serviceProvisionDate'
      OR v_nature->>'candidateJson' IS DISTINCT FROM v_text
      OR v_nature->>'candidateHash' IS DISTINCT FROM v_hash THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native service-day supply-nature original is inconsistent';
  END IF;
  v_history:=public.read_india_native_rate_history_day(p_tenant,p_property,(v_nature->>'supplyDate')::date);
  v_history_selected:=v_history->'selectedExtension';
  IF v_nature::jsonb->'jurisdiction' IS DISTINCT FROM pg_catalog.jsonb_build_object(
      'extensionId',v_history_selected->'extensionId','ownerTenantId',NULL,'key',v_history_selected->'key',
      'version',v_history_selected->>'version','contentHash',v_history_selected->'contentHash') THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native service-day supply nature conflicts with approved whole-day history';
  END IF;
  v_family_name:=CASE v_nature->>'supplyNature' WHEN 'inter_state' THEN 'igst'
    WHEN 'intra_state' THEN CASE WHEN v_nature#>>'{placeOfSupply,pos}' IN ('04','26','31','35','38')
      THEN 'cgst_utgst' ELSE 'cgst_sgst' END END;
  v_component_rule:=CASE v_family_name WHEN 'igst' THEN 'IGST_ACT_5_1'
    WHEN 'cgst_sgst' THEN 'CGST_ACT_9_1_AND_SGST_ACT'
    WHEN 'cgst_utgst' THEN 'CGST_ACT_9_1_AND_UTGST_ACT_7_1' END;
  IF v_family_name IS NULL OR v_nature->>'legalRule' NOT IN ('IGST_ACT_8_2','IGST_ACT_7_3','IGST_ACT_7_5_B')
      OR (v_family_name='igst' AND v_nature->>'supplyNature'<>'inter_state')
      OR (v_family_name<>'igst' AND v_nature->>'supplyNature'<>'intra_state') THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native service-day statutory family is invalid';
  END IF;
  v_family_jurisdiction:=pg_catalog.json_build_object('extensionId',v_nature#>'{jurisdiction,extensionId}',
    'key',v_nature#>'{jurisdiction,key}','version',v_nature#>>'{jurisdiction,version}',
    'contentHash',v_nature#>'{jurisdiction,contentHash}');
  v_family_body:=pg_catalog.json_build_object('propertyNode',p_property,'reservationId',p_reservation,'folioId',p_folio,
    'supplyDate',v_nature->'supplyDate','jurisdiction',v_family_jurisdiction,
    'supplierRegistrationId',v_nature#>'{supplier,registrationId}',
    'placeOfSupplyStateCode',v_nature#>'{placeOfSupply,pos}','supplyNature',v_nature->'supplyNature',
    'determinationBasis',v_nature->'determinationBasis','sezDirection',v_nature->'sezDirection',
    'componentFamily',v_family_name,'legalSources',pg_catalog.json_build_object(
      'supplyNature',v_nature->'legalRule','componentFamily',v_component_rule),
    'predecessorCandidateHash',v_nature->'candidateHash');
  v_text:=public.india_native_insertion_json(v_family_body);
  v_hash:=pg_catalog.encode(public.digest(pg_catalog.convert_to(
    '{"tenantId":'||pg_catalog.to_json(p_tenant)::text||','||pg_catalog.substr(v_text,2),'UTF8'),'sha256'),'hex');
  v_family_text:=pg_catalog.left(v_text,pg_catalog.length(v_text)-1)||',"evidenceHash":"'||v_hash||'"}';
  v_family:=v_family_text::json;

  v_service_selected:=pg_catalog.json_build_object('extensionId',v_history_selected->'extensionId','key',v_history_selected->'key',
    'version',v_history_selected->'version','status',v_history_selected->'status',
    'effectiveFromInstant',v_history_selected->'effectiveFromInstant','effectiveToInstant',v_history_selected->'effectiveToInstant',
    'contentHash',v_history_selected->'contentHash');
  v_levy_body:=pg_catalog.json_build_object('propertyNode',p_property,'reservationId',p_reservation,'folioId',p_folio,
    'supplyDate',v_nature->'supplyDate','selectedVersion',v_service_selected,
    'gstRoomSlabs',v_history_selected->'gstRoomSlabs','componentFamily',v_family_name,
    'legalSources',v_family->'legalSources','predecessorHashes',pg_catalog.json_build_object(
      'historicalResolution',v_history->>'evidenceHash','rateVersionPair',v_history#>>'{rateVersionPair,evidenceHash}',
      'componentFamily',v_family->>'evidenceHash','supplyNatureCandidate',v_nature->>'candidateHash'));
  v_hash:=public.india_native_source_hash(v_levy_body::jsonb||pg_catalog.jsonb_build_object('tenantId',p_tenant));
  v_text:=public.india_native_insertion_json(v_levy_body);
  v_levy_text:=pg_catalog.left(v_text,pg_catalog.length(v_text)-1)||',"evidenceHash":"'||v_hash||'"}';
  v_levy:=v_levy_text::json;

  v_identities:=CASE v_family_name WHEN 'igst' THEN '["igst"]'::json
    WHEN 'cgst_sgst' THEN '["cgst","sgst"]'::json ELSE '["cgst","utgst"]'::json END;
  v_identity_predecessors:=pg_catalog.json_build_object(
    'historicalResolution',v_levy#>'{predecessorHashes,historicalResolution}',
    'rateVersionPair',v_levy#>'{predecessorHashes,rateVersionPair}',
    'componentFamily',v_levy#>'{predecessorHashes,componentFamily}',
    'supplyNatureCandidate',v_levy#>'{predecessorHashes,supplyNatureCandidate}',
    'levyInputBundle',v_levy->'evidenceHash');
  v_identity_body:=pg_catalog.json_build_object('propertyNode',p_property,'reservationId',p_reservation,'folioId',p_folio,
    'supplyDate',v_nature->'supplyDate','selectedVersion',v_service_selected,
    'gstRoomSlabs',v_history_selected->'gstRoomSlabs','componentFamily',v_family_name,
    'componentIdentities',v_identities,'readiness',CASE v_family_name WHEN 'igst' THEN 'sole_component_aggregate_schedule'
      ELSE 'numeric_component_split_authority_required' END,'legalSources',v_family->'legalSources',
    'predecessorHashes',v_identity_predecessors);
  v_text:=public.india_native_insertion_json(v_identity_body);
  v_hash:=pg_catalog.encode(public.digest(pg_catalog.convert_to(
    '{"tenantId":'||pg_catalog.to_json(p_tenant)::text||','||pg_catalog.substr(v_text,2),'UTF8'),'sha256'),'hex');
  v_identity_text:=pg_catalog.left(v_text,pg_catalog.length(v_text)-1)||',"evidenceHash":"'||v_hash||'"}';
  v_identity:=v_identity_text::json;

  -- Native quoted applicability uses the TOS-selected rate member, but the levy
  -- identity above remains the service-day graph. Reconstruct the exact persisted
  -- quote lineage and attribution components without writing a timing/app/tax row.
  IF v_rate->>'kind'='ordinary_section13_single_version' THEN
    v_selected:=v_rate->'selectedVersion';
    v_rate_selection:=pg_catalog.json_build_object('kind','ordinary_section13_single_version',
      'timeOfSupplyDate',v_timing->'timeOfSupplyDate','selectedVersion',v_selected);
  ELSIF v_rate->>'kind'='genuine_section14_rate_change' THEN
    v_selected:=v_input#>ARRAY['rateVersionPair',v_rate#>>'{section14,selectedVersionSide}'];
    v_rate_selection:=pg_catalog.json_build_object('kind','genuine_section14_rate_change',
      'case',v_rate#>'{section14,case}','timeOfSupplyDate',v_rate#>'{section14,timeOfSupplyDate}',
      'selectedVersionSide',v_rate#>'{section14,selectedVersionSide}','selectedVersion',v_selected,
      'section14EvidenceHash',v_rate#>'{section14,evidenceHash}');
  ELSE
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native quoted-tax rate selection branch is invalid';
  END IF;
  IF v_selected->>'key'<>'in-gst-lodging'
      OR v_selected->>'extensionId' IS DISTINCT FROM v_rate_selection#>>'{selectedVersion,extensionId}' THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native quoted-tax selected version is inconsistent';
  END IF;
  v_identity_count:=pg_catalog.json_array_length(v_identities);
  FOR v_night IN SELECT e.value FROM pg_catalog.jsonb_array_elements(v_attribution#>'{revenueLine,roomNights}')
      WITH ORDINALITY e(value,ordinality) ORDER BY e.ordinality LOOP
    IF v_night->>'index' IS NULL OR v_night->>'index' !~ '^(0|[1-9][0-9]*)$'
        OR (v_night->>'index')::integer<>v_night_ordinal
        OR v_night->>'businessDate' IS NULL OR v_night->>'amountMinor' IS NULL
        OR v_night->>'amountMinor' !~ '^[1-9][0-9]*$' THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native quoted-tax attribution room night is invalid';
    END IF;
    v_amount:=(v_night->>'amountMinor')::bigint;v_total:=v_total+v_amount;
    v_slab:=CASE WHEN v_amount<=750000 THEN v_selected::jsonb#>'{gstRoomSlabs,0}'
      ELSE v_selected::jsonb#>'{gstRoomSlabs,1}' END;
    v_aggregate_bps:=((v_slab->>'rate')::numeric*10000)::integer;
    IF (v_slab->>'rate')::numeric*10000<>v_aggregate_bps OR v_aggregate_bps<=0
        OR v_aggregate_bps%v_identity_count<>0 THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native quoted-tax selected rate is not an exact component schedule';
    END IF;
    v_component_bps:=v_aggregate_bps/v_identity_count;
    v_aggregate_rate:=CASE v_aggregate_bps WHEN 500 THEN 0.05 WHEN 1200 THEN 0.12 WHEN 1800 THEN 0.18 ELSE NULL END;
    v_component_rate:=CASE v_component_bps WHEN 250 THEN 0.025 WHEN 500 THEN 0.05 WHEN 600 THEN 0.06
      WHEN 900 THEN 0.09 WHEN 1200 THEN 0.12 WHEN 1800 THEN 0.18 ELSE NULL END;
    IF v_aggregate_rate IS NULL OR v_component_rate IS NULL THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native quoted-tax selected rate is outside the approved schedule';
    END IF;
    v_components_text:='[';v_separator:='';
    FOR v_identity_name IN SELECT e.value#>>'{}' FROM pg_catalog.json_array_elements(v_identities) WITH ORDINALITY e(value,ordinality)
        ORDER BY e.ordinality LOOP
      v_component:=pg_catalog.json_build_object('identity',v_identity_name,'rate',v_component_rate,
        'rateBasisPoints',v_component_bps);
      v_components_text:=v_components_text||v_separator||public.india_native_insertion_json(v_component);v_separator:=',';
    END LOOP;
    v_components_text:=v_components_text||']';
    v_component:=pg_catalog.json_build_object('ordinal',v_night->'index','businessDate',v_night->'businessDate',
      'quotedAmountMinor',v_night->'amountMinor','slab',pg_catalog.json_build_object(
        'uptoMinor',v_slab->'uptoMinor','aggregateRate',v_aggregate_rate,
        'aggregateRateBasisPoints',v_aggregate_bps,'itcEligible',v_slab->'itcEligible',
        'components',v_components_text::json));
    v_quote_text:=v_quote_text||v_quote_separator||public.india_native_insertion_json(v_component);v_quote_separator:=',';
    v_night_ordinal:=v_night_ordinal+1;
  END LOOP;
  v_quote_text:=v_quote_text||']';v_quote_components:=v_quote_text::json;
  IF v_total::text IS DISTINCT FROM v_attribution#>>'{revenueLine,inputAmountMinor}'
      OR v_attribution#>>'{evaluation,grandTotalMinor}' IS DISTINCT FROM v_timing->>'amountMinor'
      OR pg_catalog.json_array_length(v_quote_components)=0 THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native quoted-tax attribution does not reconcile to timing consideration';
  END IF;
  IF v_input#>>'{serviceProvision,reservationLineage,lineageId}' IS DISTINCT FROM v_intake#>>'{lineage,id}'
      OR v_input#>>'{serviceProvision,reservationLineage,holdBindingId}' IS DISTINCT FROM v_intake#>>'{lineage,binding_id}'
      OR v_input#>>'{serviceProvision,reservationLineage,attributionId}' IS DISTINCT FROM v_intake#>>'{lineage,attribution_id}'
      OR v_input#>>'{serviceProvision,reservationLineage,segmentId}' IS DISTINCT FROM v_intake#>>'{lineage,segment_id}'
      OR v_input#>>'{serviceProvision,reservationLineage,originQuoteHash}' IS DISTINCT FROM v_intake#>>'{lineage,origin_quote_hash}'
      OR v_input#>>'{serviceProvision,reservationLineage,snapshotHash}' IS DISTINCT FROM v_intake#>>'{lineage,snapshot_hash}' THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native quoted-tax reservation lineage conflicts with authenticated intake';
  END IF;
  v_lineage:=pg_catalog.json_build_object('lineageId',v_intake#>'{lineage,id}','holdBindingId',v_intake#>'{lineage,binding_id}',
    'reservationId',p_reservation,'segmentId',v_intake#>'{lineage,segment_id}','folioId',p_folio,
    'attributionId',v_intake#>'{lineage,attribution_id}','originQuoteHash',v_intake#>'{lineage,origin_quote_hash}',
    'snapshotHash',v_intake#>'{lineage,snapshot_hash}','currency','INR');
  -- proven-lineage hashing is insertion-sensitive; rebuild its exact append order.
  v_text:=pg_catalog.left(public.india_native_insertion_json(v_lineage),pg_catalog.length(public.india_native_insertion_json(v_lineage))-1)
    ||',"holdId":'||pg_catalog.to_json(v_intake#>>'{lineage,hold_id}')::text
    ||',"sellableUnitId":'||pg_catalog.to_json(v_intake#>>'{lineage,sellable_unit_id}')::text
    ||',"period":'||pg_catalog.to_json(v_intake#>>'{lineage,period}')::text||'}';
  v_lineage_hash:=pg_catalog.encode(public.digest(pg_catalog.convert_to(
    '{"tenantId":'||pg_catalog.to_json(p_tenant)::text||','||pg_catalog.substr(v_text,2),'UTF8'),'sha256'),'hex');
  v_native_timing:=pg_catalog.json_build_object('nativeTimingId',v_timing->'nativeTimingId',
    'prospectiveDocumentId',v_timing->'prospectiveDocumentId','serviceProvisionSnapshotId',v_timing->'serviceProvisionSnapshotId',
    'paymentReceiptSnapshotId',v_timing->'paymentReceiptSnapshotId','ordinaryRegimeEvidenceId',v_timing->'ordinaryRegimeEvidenceId',
    'invoiceIssueDate',v_timing->'invoiceIssueDate','branch',v_timing->'branch',
    'timeOfSupplyDate',v_timing->'timeOfSupplyDate','evidenceHash',v_timing->'evidenceHash');
  v_predecessors:=pg_catalog.json_build_object('nativeInvoiceSource',v_result->'evidenceHash',
    'nativeTiming',v_timing->'evidenceHash','serviceProvisionRecording',v_intake#>'{recordingRoots,serviceProvisionRecording}',
    'paymentReceiptRecording',v_intake#>'{recordingRoots,paymentReceiptRecording}',
    'ordinaryRegimeRecording',v_intake#>'{recordingRoots,ordinaryRegimeRecording}',
    'serviceProvisionProjection',v_input#>'{serviceProvision,evidenceHash}',
    'paymentReceiptProjection',v_input#>'{paymentReceipt,evidenceHash}',
    'rateSource',v_rate->'evidenceHash','levyComponentIdentity',v_identity->'evidenceHash',
    'reservationLineage',v_lineage_hash,'attributionSnapshot',v_attribution->'snapshotHash');
  v_quote_body:=pg_catalog.json_build_object('kind','native_current_transaction','rateSelection',v_rate_selection,
    'nativeTiming',v_native_timing,'reservationLineage',v_lineage,'components',v_quote_components,
    'predecessorHashes',v_predecessors);
  v_text:=public.india_native_insertion_json(v_quote_body);
  v_hash:=pg_catalog.encode(public.digest(pg_catalog.convert_to('{"tenantId":'||pg_catalog.to_json(p_tenant)::text
    ||',"propertyNode":'||pg_catalog.to_json(p_property)::text||',"reservationId":'||pg_catalog.to_json(p_reservation)::text
    ||',"folioId":'||pg_catalog.to_json(p_folio)::text||','||pg_catalog.substr(v_text,2),'UTF8'),'sha256'),'hex');
  v_quote_canonical:=pg_catalog.left(v_text,pg_catalog.length(v_text)-1)||',"evidenceHash":"'||v_hash||'"}';
  v_quote:=v_quote_canonical::json;

  v_preview:=public.read_india_native_tax_preview(p_tenant,p_property,p_reservation,p_folio,p_valuation,
    (v_selected->>'extensionId')::uuid,v_family_name);
  IF v_preview->>'componentFamily' IS DISTINCT FROM v_family_name
      OR v_preview->>'grandTotalMinor' IS DISTINCT FROM v_timing->>'amountMinor'
      OR v_preview->>'selectedExtensionId' IS DISTINCT FROM v_selected->>'extensionId'
      OR v_preview->>'selectedExtensionVersion' IS DISTINCT FROM v_selected->>'version'
      OR v_preview->>'selectedContentHash' IS DISTINCT FROM v_selected->>'contentHash' THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native final tax preview conflicts with selected rate or consideration';
  END IF;
  v_tax_predecessors:=pg_catalog.json_build_object('finalValuation',v_preview->'valuationEvidenceHash',
    'quotedRateApplicability',v_quote->'evidenceHash','nativeConsiderationBasis',v_preview->'nativeConsiderationBasisHash');
  SELECT pg_catalog.json_object_agg(e.key,e.value ORDER BY e.ordinality) INTO v_tax_predecessors
    FROM pg_catalog.json_each(v_tax_predecessors) WITH ORDINALITY e;
  v_tax_predecessors:=(pg_catalog.left(public.india_native_insertion_json(v_tax_predecessors),
    pg_catalog.length(public.india_native_insertion_json(v_tax_predecessors))-1)||','||
    pg_catalog.substr(public.india_native_insertion_json(v_predecessors),2))::json;
  v_tax_body:=pg_catalog.json_build_object('kind','native_current_transaction','nativeTimingId',v_timing->'nativeTimingId',
    'valuationId',v_preview->'valuationId','generation',v_preview->'generation',
    'rateSelectionKind',v_rate->'kind','roomNights',(v_preview->>'roomNightsCanonicalJson')::json,
    'taxMinor',v_preview->'taxMinor','grandTotalMinor',v_preview->'grandTotalMinor',
    'predecessorHashes',v_tax_predecessors);
  v_text:=public.india_native_insertion_json(v_tax_body);
  v_hash:=pg_catalog.encode(public.digest(pg_catalog.convert_to('{"tenant":'||pg_catalog.to_json(p_tenant)::text
    ||',"property":'||pg_catalog.to_json(p_property)::text||',"reservation":'||pg_catalog.to_json(p_reservation)::text
    ||',"folio":'||pg_catalog.to_json(p_folio)::text||','||pg_catalog.substr(v_text,2),'UTF8'),'sha256'),'hex');
  v_tax_canonical:=pg_catalog.left(v_text,pg_catalog.length(v_text)-1)||',"evidenceHash":"'||v_hash||'"}';
  RETURN pg_catalog.jsonb_build_object('componentFamilyCanonicalJson',v_family_text,
    'levyInputBundleCanonicalJson',v_levy_text,'levyComponentIdentityCanonicalJson',v_identity_text,
    'quotedApplicabilityCanonicalJson',v_quote_canonical,'finalTaxCanonicalJson',v_tax_canonical,
    'taxPreview',v_preview);
END;
$$;
ALTER FUNCTION public.compose_india_native_quoted_tax_source(uuid,uuid,uuid,uuid,uuid,text,text,text) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.compose_india_native_quoted_tax_source(uuid,uuid,uuid,uuid,uuid,text,text,text)
  FROM PUBLIC,app_role,yellow_runtime;
