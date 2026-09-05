-- Order434 / Question190 / D1346. Private preparation building blocks ONLY.
-- Assemble with the accounting fragment into reserved0076 after the complete
-- prepare/authenticate/commit pipeline passes its gates. This fragment deliberately
-- grants no runtime capability. Its source-graph authenticator is draft code whose
-- governed positive integration is not yet proved. Selecting a version/family
-- here is arithmetic, NOT fiscal policy:
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

-- Stage-4 current source-authority lock subset. The financial prefix must have
-- completed first. Snapshot the complete selected authorization tuples and the
-- mutable covering paths, lock only that original set in deterministic
-- table/primary-key order, then rerun both the strict reader and graph. Drift is
-- rejected; this helper never chases newly appearing authority rows.
CREATE OR REPLACE FUNCTION public.lock_india_native_issue_authority(
  p_tenant uuid,p_property uuid,p_actor uuid,p_reservation uuid,p_folio uuid
) RETURNS jsonb LANGUAGE plpgsql VOLATILE
SET search_path=pg_catalog,public SET timezone='UTC' SET datestyle='ISO,YMD' AS $$
DECLARE
  v_before jsonb;v_after jsonb;v_graph_before jsonb;v_graph_after jsonb;
  v_node_ids uuid[];v_role_ids uuid[];v_user_roles jsonb;v_role_permissions jsonb;
  v_permission_codes text[]:=ARRAY[
    'tax-fiscal.documents:issue','tax-fiscal.india-valuation:finalize'];
  v_locked integer;
BEGIN
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_locks l WHERE l.pid=pg_catalog.pg_backend_pid()
      AND l.locktype='advisory' AND l.granted AND l.objsubid=1
      AND l.classid=((6441674055002974568::bigint>>32)&4294967295)::oid
      AND l.objid=(6441674055002974568::bigint&4294967295)::oid) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native issue authority must be locked before publication';
  END IF;
  v_before:=public.read_india_native_issue_authority(
    p_tenant,p_property,p_actor,p_reservation,p_folio);
  WITH qualifying AS MATERIALIZED (
    SELECT actor.tenant_id,actor.id AS actor_id,ur.user_id,ur.role_id,ur.scope_node,
      rp.permission_code
      FROM public.app_user actor
      JOIN public.user_role ur ON ur.tenant_id=actor.tenant_id AND ur.user_id=actor.id
      JOIN public.role role_row ON role_row.tenant_id=ur.tenant_id AND role_row.id=ur.role_id
      JOIN public.role_permission rp ON rp.role_id=role_row.id
        AND rp.permission_code=ANY(v_permission_codes)
      JOIN public.permission permission_row ON permission_row.code=rp.permission_code
      JOIN public.org_node grant_node ON grant_node.tenant_id=ur.tenant_id
        AND grant_node.id=ur.scope_node
      JOIN public.org_node property ON property.tenant_id=actor.tenant_id
        AND property.id=p_property AND property.kind='property' AND property.currency='INR'
        AND grant_node.path @> property.path
     WHERE actor.tenant_id=p_tenant AND actor.id=p_actor AND actor.status='active'
  ), grant_rows AS (
    SELECT DISTINCT grant_node.id,grant_node.tenant_id,grant_node.path::text AS path
      FROM qualifying q JOIN public.org_node grant_node
        ON grant_node.tenant_id=q.tenant_id AND grant_node.id=q.scope_node
  ), user_role_rows AS (
    SELECT DISTINCT q.tenant_id,q.user_id,q.role_id,q.scope_node FROM qualifying q
  ), role_rows AS (
    SELECT DISTINCT role_row.id,role_row.tenant_id,role_row.name
      FROM qualifying q JOIN public.role role_row
        ON role_row.tenant_id=q.tenant_id AND role_row.id=q.role_id
  ), role_permission_rows AS (
    SELECT DISTINCT q.role_id,q.permission_code FROM qualifying q
  ), permission_rows AS (
    SELECT DISTINCT permission_row.code,permission_row.description
      FROM qualifying q JOIN public.permission permission_row
        ON permission_row.code=q.permission_code
  )
  SELECT pg_catalog.jsonb_build_object(
    'tenant',(SELECT pg_catalog.jsonb_build_object('id',tenant.id,'status',tenant.status)
      FROM public.tenant tenant WHERE tenant.id=p_tenant),
    'property',(SELECT pg_catalog.jsonb_build_object('id',property.id,'tenantId',property.tenant_id,
      'path',property.path::text,'kind',property.kind,'timezone',property.timezone,
      'currency',property.currency) FROM public.org_node property
      WHERE property.tenant_id=p_tenant AND property.id=p_property),
    'grantNodes',COALESCE((SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id',g.id,'tenantId',g.tenant_id,'path',g.path) ORDER BY g.id) FROM grant_rows g),'[]'::jsonb),
    'actor',(SELECT pg_catalog.jsonb_build_object('id',actor.id,'tenantId',actor.tenant_id,
      'status',actor.status) FROM public.app_user actor
      WHERE actor.tenant_id=p_tenant AND actor.id=p_actor),
    'userRoles',COALESCE((SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'tenantId',u.tenant_id,'userId',u.user_id,'roleId',u.role_id,'scopeNode',u.scope_node)
      ORDER BY u.user_id,u.role_id,u.scope_node) FROM user_role_rows u),'[]'::jsonb),
    'roles',COALESCE((SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id',r.id,'tenantId',r.tenant_id,'name',r.name) ORDER BY r.id) FROM role_rows r),'[]'::jsonb),
    'rolePermissions',COALESCE((SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'roleId',rp.role_id,'permissionCode',rp.permission_code)
      ORDER BY rp.role_id,rp.permission_code) FROM role_permission_rows rp),'[]'::jsonb),
    'permissions',COALESCE((SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'code',permission.code,'description',permission.description) ORDER BY permission.code)
      FROM permission_rows permission),'[]'::jsonb))
    INTO v_graph_before;
  IF pg_catalog.jsonb_array_length(v_graph_before->'permissions')<>2
      OR NOT (v_graph_before->'permissions' @> '[{"code":"tax-fiscal.documents:issue"}]'::jsonb)
      OR NOT (v_graph_before->'permissions' @> '[{"code":"tax-fiscal.india-valuation:finalize"}]'::jsonb) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='native issue authority graph is incomplete';
  END IF;
  SELECT pg_catalog.array_agg(id ORDER BY id) INTO v_node_ids FROM (
    SELECT p_property AS id
    UNION
    SELECT (node->>'id')::uuid FROM pg_catalog.jsonb_array_elements(
      v_graph_before->'grantNodes') node
  ) selected_nodes;
  SELECT pg_catalog.array_agg((role_row->>'id')::uuid ORDER BY (role_row->>'id')::uuid)
    INTO v_role_ids FROM pg_catalog.jsonb_array_elements(v_graph_before->'roles') role_row;
  v_user_roles:=v_graph_before->'userRoles';
  v_role_permissions:=v_graph_before->'rolePermissions';

  -- Fixed per-table lock order, with each relation ordered by its primary key.
  PERFORM 1 FROM public.tenant tenant
   WHERE tenant.id=p_tenant AND tenant.status='active' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='native issue tenant lock is unavailable'; END IF;
  SELECT pg_catalog.count(*)::integer INTO v_locked FROM (
    SELECT node.id FROM public.org_node node
     WHERE node.tenant_id=p_tenant AND node.id=ANY(v_node_ids)
     ORDER BY node.id FOR SHARE
  ) locked_nodes;
  IF v_locked<>pg_catalog.cardinality(v_node_ids) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native issue organization authority lock set changed';
  END IF;
  PERFORM 1 FROM public.app_user actor
   WHERE actor.tenant_id=p_tenant AND actor.id=p_actor AND actor.status='active'
   ORDER BY actor.id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='native issue actor lock is unavailable'; END IF;
  SELECT pg_catalog.count(*)::integer INTO v_locked FROM (
    SELECT ur.user_id,ur.role_id,ur.scope_node FROM public.user_role ur
     WHERE ur.tenant_id=p_tenant AND EXISTS(
       SELECT 1 FROM pg_catalog.jsonb_array_elements(v_user_roles) selected
        WHERE selected->>'tenantId'=ur.tenant_id::text
          AND selected->>'userId'=ur.user_id::text
          AND selected->>'roleId'=ur.role_id::text
          AND selected->>'scopeNode'=ur.scope_node::text)
     ORDER BY ur.user_id,ur.role_id,ur.scope_node FOR SHARE
  ) locked_user_roles;
  IF v_locked<>pg_catalog.jsonb_array_length(v_user_roles) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native issue user-role lock set changed';
  END IF;
  SELECT pg_catalog.count(*)::integer INTO v_locked FROM (
    SELECT role_row.id FROM public.role role_row
     WHERE role_row.tenant_id=p_tenant AND role_row.id=ANY(v_role_ids)
     ORDER BY role_row.id FOR SHARE
  ) locked_roles;
  IF v_locked<>pg_catalog.cardinality(v_role_ids) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native issue role lock set changed';
  END IF;
  SELECT pg_catalog.count(*)::integer INTO v_locked FROM (
    SELECT rp.role_id,rp.permission_code FROM public.role_permission rp
     WHERE EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(v_role_permissions) selected
       WHERE selected->>'roleId'=rp.role_id::text
         AND selected->>'permissionCode'=rp.permission_code)
     ORDER BY rp.role_id,rp.permission_code FOR SHARE
  ) locked_role_permissions;
  IF v_locked<>pg_catalog.jsonb_array_length(v_role_permissions) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native issue role-permission lock set changed';
  END IF;
  SELECT pg_catalog.count(*)::integer INTO v_locked FROM (
    SELECT permission.code FROM public.permission permission
     WHERE permission.code=ANY(v_permission_codes)
     ORDER BY permission.code FOR SHARE
  ) locked_permissions;
  IF v_locked<>pg_catalog.cardinality(v_permission_codes) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native issue permission catalogue lock set changed';
  END IF;

  v_after:=public.read_india_native_issue_authority(
    p_tenant,p_property,p_actor,p_reservation,p_folio);
  WITH qualifying AS MATERIALIZED (
    SELECT actor.tenant_id,actor.id AS actor_id,ur.user_id,ur.role_id,ur.scope_node,
      rp.permission_code
      FROM public.app_user actor
      JOIN public.user_role ur ON ur.tenant_id=actor.tenant_id AND ur.user_id=actor.id
      JOIN public.role role_row ON role_row.tenant_id=ur.tenant_id AND role_row.id=ur.role_id
      JOIN public.role_permission rp ON rp.role_id=role_row.id
        AND rp.permission_code=ANY(v_permission_codes)
      JOIN public.permission permission_row ON permission_row.code=rp.permission_code
      JOIN public.org_node grant_node ON grant_node.tenant_id=ur.tenant_id
        AND grant_node.id=ur.scope_node
      JOIN public.org_node property ON property.tenant_id=actor.tenant_id
        AND property.id=p_property AND property.kind='property' AND property.currency='INR'
        AND grant_node.path @> property.path
     WHERE actor.tenant_id=p_tenant AND actor.id=p_actor AND actor.status='active'
  ), grant_rows AS (
    SELECT DISTINCT grant_node.id,grant_node.tenant_id,grant_node.path::text AS path
      FROM qualifying q JOIN public.org_node grant_node
        ON grant_node.tenant_id=q.tenant_id AND grant_node.id=q.scope_node
  ), user_role_rows AS (
    SELECT DISTINCT q.tenant_id,q.user_id,q.role_id,q.scope_node FROM qualifying q
  ), role_rows AS (
    SELECT DISTINCT role_row.id,role_row.tenant_id,role_row.name
      FROM qualifying q JOIN public.role role_row
        ON role_row.tenant_id=q.tenant_id AND role_row.id=q.role_id
  ), role_permission_rows AS (
    SELECT DISTINCT q.role_id,q.permission_code FROM qualifying q
  ), permission_rows AS (
    SELECT DISTINCT permission_row.code,permission_row.description
      FROM qualifying q JOIN public.permission permission_row
        ON permission_row.code=q.permission_code
  )
  SELECT pg_catalog.jsonb_build_object(
    'tenant',(SELECT pg_catalog.jsonb_build_object('id',tenant.id,'status',tenant.status)
      FROM public.tenant tenant WHERE tenant.id=p_tenant),
    'property',(SELECT pg_catalog.jsonb_build_object('id',property.id,'tenantId',property.tenant_id,
      'path',property.path::text,'kind',property.kind,'timezone',property.timezone,
      'currency',property.currency) FROM public.org_node property
      WHERE property.tenant_id=p_tenant AND property.id=p_property),
    'grantNodes',COALESCE((SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id',g.id,'tenantId',g.tenant_id,'path',g.path) ORDER BY g.id) FROM grant_rows g),'[]'::jsonb),
    'actor',(SELECT pg_catalog.jsonb_build_object('id',actor.id,'tenantId',actor.tenant_id,
      'status',actor.status) FROM public.app_user actor
      WHERE actor.tenant_id=p_tenant AND actor.id=p_actor),
    'userRoles',COALESCE((SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'tenantId',u.tenant_id,'userId',u.user_id,'roleId',u.role_id,'scopeNode',u.scope_node)
      ORDER BY u.user_id,u.role_id,u.scope_node) FROM user_role_rows u),'[]'::jsonb),
    'roles',COALESCE((SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id',r.id,'tenantId',r.tenant_id,'name',r.name) ORDER BY r.id) FROM role_rows r),'[]'::jsonb),
    'rolePermissions',COALESCE((SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'roleId',rp.role_id,'permissionCode',rp.permission_code)
      ORDER BY rp.role_id,rp.permission_code) FROM role_permission_rows rp),'[]'::jsonb),
    'permissions',COALESCE((SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'code',permission.code,'description',permission.description) ORDER BY permission.code)
      FROM permission_rows permission),'[]'::jsonb))
    INTO v_graph_after;
  IF v_before IS DISTINCT FROM v_after OR v_graph_before IS DISTINCT FROM v_graph_after THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native issue authority changed while locking';
  END IF;
  RETURN v_after;
END;
$$;
ALTER FUNCTION public.lock_india_native_issue_authority(uuid,uuid,uuid,uuid,uuid)
  OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.lock_india_native_issue_authority(uuid,uuid,uuid,uuid,uuid)
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

-- Stage-5 document context only. The caller must already hold the earlier
-- financial and source/configuration locks. This helper derives the legal clock,
-- locks the property-local day before the exact configured series and its
-- current tail, and returns the still-unallocated context. It never advances a
-- counter, writes a document, or publishes an event.
CREATE OR REPLACE FUNCTION public.lock_india_native_document_context(
  p_tenant uuid,p_property uuid,p_reservation uuid,p_folio uuid,p_actor uuid,
  p_supplier_registration uuid
) RETURNS jsonb LANGUAGE plpgsql VOLATILE
SET search_path=pg_catalog,public SET timezone='UTC' SET datestyle='ISO,YMD' AS $$
DECLARE
  v_context uuid;v_authority jsonb;v_transaction_timestamp timestamptz;
  v_property_timezone text;v_issue_date date;v_financial_year_start date;
  v_sealed_at timestamptz;v_series public.document_series%ROWTYPE;
  v_tail_document_id uuid;v_tail_document_hash text;v_tail_document_no text;
BEGIN
  BEGIN
    v_context:=NULLIF(pg_catalog.current_setting('app.tenant_id',true),'')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='native document context tenant is invalid';
  END;
  IF p_tenant IS NULL OR p_property IS NULL OR p_reservation IS NULL OR p_folio IS NULL
      OR p_actor IS NULL OR p_supplier_registration IS NULL
      OR v_context IS NULL OR v_context<>p_tenant THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='native document context tenant or identity is invalid';
  END IF;
  -- No pre-existing resource lock may be acquired after publication starts.
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_locks l WHERE l.pid=pg_catalog.pg_backend_pid()
      AND l.locktype='advisory' AND l.granted AND l.objsubid=1
      AND l.classid=((6441674055002974568::bigint>>32)&4294967295)::oid
      AND l.objid=(6441674055002974568::bigint&4294967295)::oid) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native document context must be locked before publication';
  END IF;
  -- This exact existing reader owns current governed-session, tenant, property,
  -- folio and dual issue-plus-valuation permission semantics. The stage-1
  -- financial prefix, not this stage, owns the locked open-folio requirement.
  v_authority:=public.read_india_native_issue_authority(
    p_tenant,p_property,p_actor,p_reservation,p_folio);
  v_property_timezone:=v_authority->>'propertyTimezone';
  v_issue_date:=(v_authority->>'invoiceIssueDate')::date;
  v_transaction_timestamp:=(v_authority->>'transactionTimestamp')::timestamptz;
  IF v_property_timezone IS NULL OR v_issue_date IS NULL OR v_transaction_timestamp IS NULL
      OR v_authority->>'propertyNode' IS DISTINCT FROM p_property::text
      OR (v_transaction_timestamp AT TIME ZONE v_property_timezone)::date<>v_issue_date THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native document context authority projection is inconsistent';
  END IF;
  v_financial_year_start:=pg_catalog.make_date(
    pg_catalog.date_part('year',v_issue_date)::integer
      - CASE WHEN pg_catalog.date_part('month',v_issue_date)<4 THEN 1 ELSE 0 END,4,1);
  -- The statutory source resolver has already locked this registration. This is
  -- a no-lock exact reread that prevents a series from binding a shaped UUID.
  PERFORM 1 FROM public.property_fiscal_registration registration
   WHERE registration.tenant_id=p_tenant AND registration.id=p_supplier_registration
     AND registration.property_node=p_property AND registration.scheme='in-gstin'
     AND registration.currency='INR';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native document context supplier registration is unavailable';
  END IF;
  -- Stage 5: day first, then the configured series row, then its immutable tail.
  SELECT day.sealed_at INTO v_sealed_at FROM public.business_day day
   WHERE day.tenant_id=p_tenant AND day.property_node=p_property
     AND day.business_date=v_issue_date
   FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='P0011',MESSAGE='native fiscal issue business date is missing';
  END IF;
  IF v_sealed_at IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE='P0011',MESSAGE='native fiscal issue business date is sealed';
  END IF;
  SELECT series.* INTO v_series FROM public.document_series series
   WHERE series.tenant_id=p_tenant AND series.property_node=p_property
     AND series.supplier_registration_id=p_supplier_registration
     AND series.kind='invoice' AND series.financial_year_start=v_financial_year_start
     AND series.fiscal
   FOR UPDATE;
  IF NOT FOUND OR v_series.prefix IS NULL OR v_series.prefix<>pg_catalog.btrim(v_series.prefix)
      OR pg_catalog.char_length(v_series.prefix) NOT BETWEEN 1 AND 12
      OR v_series.prefix !~ '^[A-Za-z0-9/-]+$'
      OR v_series.next_no NOT BETWEEN 1 AND 9223372036854775806
      OR pg_catalog.char_length(v_series.prefix||v_series.next_no::text)>16 THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='exact locked India native fiscal invoice series is unavailable';
  END IF;
  IF v_series.next_no=1 THEN
    IF v_series.last_doc_hash IS NOT NULL OR EXISTS(
      SELECT 1 FROM public.document document
       WHERE document.tenant_id=p_tenant AND document.series_id=v_series.id
    ) THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='India native fiscal series genesis is inconsistent';
    END IF;
  ELSE
    v_tail_document_no:=v_series.prefix||(v_series.next_no-1)::text;
    SELECT document.id,document.sha256 INTO v_tail_document_id,v_tail_document_hash
      FROM public.document document
      JOIN public.india_gst_native_fiscal_document_origin origin
        ON origin.tenant_id=document.tenant_id AND origin.document_id=document.id
       AND origin.property_node=p_property AND origin.document_kind='invoice'
       AND origin.supplier_registration_id=p_supplier_registration
     WHERE document.tenant_id=p_tenant AND document.property_node=p_property
       AND document.series_id=v_series.id AND document.kind='invoice'
       AND document.doc_no=v_tail_document_no AND document.status='issued'
       AND document.issued_at IS NOT NULL AND document.business_date=origin.issue_date
     FOR KEY SHARE OF document,origin;
    IF NOT FOUND OR v_series.last_doc_hash IS NULL
        OR v_series.last_doc_hash !~ '^[0-9a-f]{64}$'
        OR v_tail_document_hash IS DISTINCT FROM v_series.last_doc_hash THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='India native fiscal series tail is inconsistent';
    END IF;
  END IF;
  IF EXISTS(SELECT 1 FROM public.document document
      WHERE document.tenant_id=p_tenant AND document.series_id=v_series.id
        AND document.doc_no=v_series.prefix||v_series.next_no::text) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='India native fiscal series next number is already consumed';
  END IF;
  RETURN pg_catalog.jsonb_build_object(
    'tenantId',p_tenant,'propertyNode',p_property,'reservationId',p_reservation,
    'folioId',p_folio,'actorId',p_actor,'supplierRegistrationId',p_supplier_registration,
    'documentKind','invoice','transactionTimestamp',v_transaction_timestamp,
    'propertyTimezone',v_property_timezone,'issueDate',v_issue_date,
    'financialYearStart',v_financial_year_start,'seriesId',v_series.id,
    'prefix',v_series.prefix,'nextNo',v_series.next_no::text,
    'tailDocumentId',v_tail_document_id,'tailDocumentHash',v_tail_document_hash);
END;
$$;
ALTER FUNCTION public.lock_india_native_document_context(uuid,uuid,uuid,uuid,uuid,uuid)
  OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.lock_india_native_document_context(uuid,uuid,uuid,uuid,uuid,uuid)
  FROM PUBLIC,app_role,yellow_runtime;

-- Private stage-five persistence. The enclosing preparation capability owns all
-- actor checks and the ordered lock prefix. This function replays every supplied
-- source original and the selected source-basis domain before inserting the
-- timing -> applicability children -> final-tax children graph. It neither
-- publishes the request event nor creates accounting/document artifacts.
CREATE OR REPLACE FUNCTION public.persist_india_native_quoted_tax_source(
  p_tenant uuid,p_property uuid,p_reservation uuid,p_folio uuid,p_valuation uuid,
  p_actor uuid,p_request uuid,p_series uuid,p_applicability uuid,p_tax uuid,
  p_accounting_binding uuid,p_request_event_seq bigint,p_request_event_id uuid,
  p_request_key_hash text,p_request_hash text,p_native_source_basis_hash text,
  p_native_invoice_source_input text,p_native_invoice_source_result text,
  p_prepared_source text,p_service_supply_nature text
) RETURNS jsonb LANGUAGE plpgsql VOLATILE
SET search_path=pg_catalog,public SET timezone='UTC' SET datestyle='ISO,YMD' AS $$
DECLARE
  v_context_tenant uuid;v_input json;v_result json;v_prepared json;v_service_nature json;
  v_projection json;v_timing json;v_rate json;v_quote json;v_final json;v_family json;v_identity json;
  v_composition jsonb;v_valuation jsonb;v_basis jsonb;v_basis_context jsonb;v_series_identity jsonb;
  v_series public.document_series%ROWTYPE;v_folio public.folio%ROWTYPE;
  v_event_payload jsonb;v_event_payload_hash text;v_transaction_text text;v_invoice_date date;v_timezone text;
  v_selected json;v_night json;v_component json;v_payment_evidence jsonb;
  v_calendar_authority text;v_calendar_hash text;v_calendar_through date;
  v_calendar_dates date[]:=ARRAY[]::date[];v_calendar_states text[]:=ARRAY[]::text[];
  v_rate_kind text;v_section14_case text;v_rate_change date;v_selected_side text;v_section14_hash text;
  v_app_payment_date date;v_expected_ordinal integer:=0;v_component_ordinal integer;
BEGIN
  BEGIN
    v_context_tenant:=NULLIF(pg_catalog.current_setting('app.tenant_id',true),'')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='native quoted-tax persistence tenant context is invalid';
  END;
  IF p_tenant IS NULL OR p_tenant IS DISTINCT FROM v_context_tenant THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='native quoted-tax persistence tenant mismatch';
  END IF;
  IF p_property IS NULL OR p_reservation IS NULL OR p_folio IS NULL OR p_valuation IS NULL
      OR p_actor IS NULL OR p_request IS NULL OR p_series IS NULL OR p_applicability IS NULL OR p_tax IS NULL
      OR p_accounting_binding IS NULL OR p_request_event_seq IS NULL OR p_request_event_seq<=0
      OR p_request_event_id IS NULL OR p_request_key_hash !~ '^[0-9a-f]{64}$'
      OR p_request_hash !~ '^[0-9a-f]{64}$' OR p_native_source_basis_hash !~ '^[0-9a-f]{64}$'
      OR p_native_invoice_source_input IS NULL OR p_native_invoice_source_result IS NULL
      OR p_prepared_source IS NULL OR p_service_supply_nature IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='native quoted-tax persistence identity is invalid';
  END IF;
  BEGIN
    v_input:=p_native_invoice_source_input::json;v_result:=p_native_invoice_source_result::json;
    v_prepared:=p_prepared_source::json;v_service_nature:=p_service_supply_nature::json;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='native quoted-tax persistence source transport is not JSON';
  END;
  IF pg_catalog.json_typeof(v_input)<>'object' OR pg_catalog.json_typeof(v_result)<>'object'
      OR pg_catalog.json_typeof(v_prepared)<>'object' OR pg_catalog.json_typeof(v_service_nature)<>'object'
      OR p_native_invoice_source_input IS DISTINCT FROM public.india_native_insertion_json(v_input)
      OR p_native_invoice_source_result IS DISTINCT FROM public.india_native_insertion_json(v_result)
      OR p_prepared_source IS DISTINCT FROM public.india_native_insertion_json(v_prepared)
      OR p_service_supply_nature IS DISTINCT FROM public.india_native_insertion_json(v_service_nature) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native quoted-tax persistence requires exact source originals';
  END IF;
  v_projection:=v_input->'nativeTiming';v_timing:=v_result->'timing';v_rate:=v_result->'rateSource';
  v_composition:=public.compose_india_native_quoted_tax_source(p_tenant,p_property,p_reservation,p_folio,p_valuation,
    p_native_invoice_source_input,p_native_invoice_source_result,p_service_supply_nature);
  v_family:=(v_composition->>'componentFamilyCanonicalJson')::json;
  v_identity:=(v_composition->>'levyComponentIdentityCanonicalJson')::json;
  v_quote:=(v_composition->>'quotedApplicabilityCanonicalJson')::json;
  v_final:=(v_composition->>'finalTaxCanonicalJson')::json;
  v_valuation:=public.read_india_native_valuation_evidence(p_tenant,p_property,p_reservation,p_folio,p_valuation,
    (v_timing->>'serviceProvisionSnapshotId')::uuid,(v_timing->>'paymentReceiptSnapshotId')::uuid,
    (v_timing->>'ordinaryRegimeEvidenceId')::uuid);
  SELECT f.* INTO v_folio FROM public.folio f
    WHERE f.tenant_id=p_tenant AND f.id=p_folio AND f.reservation_id=p_reservation
      AND f.account_id=(v_valuation#>>'{basis,folioAccountId}')::uuid
      AND f.window_no=(v_valuation#>>'{basis,windowNo}')::smallint;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native quoted-tax persistence folio identity is unavailable';
  END IF;
  v_invoice_date:=(v_timing->>'invoiceIssueDate')::date;
  SELECT s.* INTO v_series FROM public.document_series s
    WHERE s.tenant_id=p_tenant AND s.id=p_series AND s.property_node=p_property
      AND s.supplier_registration_id=(v_prepared#>>'{sellerRegistration,registrationId}')::uuid
      AND s.kind='invoice' AND s.fiscal
      AND s.prefix=pg_catalog.btrim(s.prefix) AND pg_catalog.char_length(s.prefix) BETWEEN 1 AND 12
      AND s.prefix ~ '^[A-Za-z0-9/-]+$'
      AND s.financial_year_start=pg_catalog.make_date(pg_catalog.date_part('year',v_invoice_date)::integer
        -CASE WHEN pg_catalog.date_part('month',v_invoice_date)<4 THEN 1 ELSE 0 END,4,1);
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native quoted-tax persistence fiscal series is unavailable';
  END IF;
  SELECT n.timezone INTO v_timezone FROM public.org_node n
    WHERE n.tenant_id=p_tenant AND n.id=p_property AND n.kind='property' AND n.currency='INR';
  IF NOT FOUND OR v_timezone IS NULL OR v_timezone='' OR v_timezone<>pg_catalog.btrim(v_timezone)
      OR v_invoice_date IS DISTINCT FROM (pg_catalog.transaction_timestamp() AT TIME ZONE v_timezone)::date THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native quoted-tax persistence property clock is inconsistent';
  END IF;
  IF v_prepared->>'tenantId' IS DISTINCT FROM p_tenant::text
      OR v_prepared->>'legalBuyerPartyId' IS DISTINCT FROM v_valuation#>>'{basis,buyerPartyId}'
      OR v_prepared#>>'{supplyNatureAtTimeOfSupplyResult,propertyNode}' IS DISTINCT FROM p_property::text
      OR v_prepared#>>'{supplyNatureAtTimeOfSupplyResult,reservationId}' IS DISTINCT FROM p_reservation::text
      OR v_prepared#>>'{supplyNatureAtTimeOfSupplyResult,folioId}' IS DISTINCT FROM p_folio::text
      OR v_prepared#>>'{supplyNatureAtTimeOfSupplyResult,timeOfSupplyDate}' IS DISTINCT FROM v_timing->>'timeOfSupplyDate'
      OR v_projection->>'nativeTimingId' IS DISTINCT FROM v_timing->>'nativeTimingId'
      OR v_projection->>'prospectiveDocumentId' IS DISTINCT FROM v_timing->>'prospectiveDocumentId'
      OR v_projection->>'invoiceIssueDate' IS DISTINCT FROM v_timing->>'invoiceIssueDate'
      OR v_final->>'nativeTimingId' IS DISTINCT FROM v_timing->>'nativeTimingId'
      OR v_final->>'valuationId' IS DISTINCT FROM p_valuation::text
      OR v_final->>'generation' IS DISTINCT FROM v_valuation->>'generation'
      OR v_quote#>>'{nativeTiming,evidenceHash}' IS DISTINCT FROM v_timing->>'evidenceHash'
      OR v_quote->>'evidenceHash' IS DISTINCT FROM v_final#>>'{predecessorHashes,quotedRateApplicability}'
      OR v_identity->>'evidenceHash' IS DISTINCT FROM v_quote#>>'{predecessorHashes,levyComponentIdentity}'
      OR v_family->>'componentFamily' IS DISTINCT FROM v_identity->>'componentFamily'
      OR v_family->>'componentFamily' IS DISTINCT FROM v_composition#>>'{taxPreview,componentFamily}' THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native quoted-tax persistence graph identities disagree';
  END IF;
  v_transaction_text:=pg_catalog.to_char(pg_catalog.transaction_timestamp() AT TIME ZONE 'UTC',
    'YYYY-MM-DD"T"HH24:MI:SS.US"Z"');
  v_basis_context:=pg_catalog.jsonb_build_object('tenantId',p_tenant::text,'propertyNode',p_property::text,
    'reservationId',p_reservation::text,'folioId',p_folio::text,'actorId',p_actor::text,
    'valuationId',p_valuation::text,'nativeTimingId',v_timing->>'nativeTimingId',
    'prospectiveDocumentId',v_timing->>'prospectiveDocumentId','seriesId',p_series::text,
    'applicabilityId',p_applicability::text,'taxId',p_tax::text,'accountingBindingId',p_accounting_binding::text,
    'requestId',p_request::text,'requestKeyHash',p_request_key_hash,'requestHash',p_request_hash,
    'requestEventId',p_request_event_id::text,'issuingTransactionId',pg_catalog.pg_current_xact_id()::text,
    'transactionTimestamp',v_transaction_text,'propertyTimezone',v_timezone,'invoiceIssueDate',v_invoice_date::text);
  v_series_identity:=pg_catalog.jsonb_build_object('tenantId',p_tenant::text,'propertyNode',p_property::text,
    'seriesId',p_series::text,'supplierRegistrationId',v_series.supplier_registration_id::text,
    'kind',v_series.kind,'fiscal',v_series.fiscal,'financialYearStart',v_series.financial_year_start::text,
    'prefix',v_series.prefix);
  v_basis:=public.india_native_preparation_source_basis(v_basis_context,p_native_invoice_source_input,
    p_native_invoice_source_result,v_valuation,p_prepared_source,p_service_supply_nature,v_composition,v_series_identity);
  IF v_basis->>'sourceBasisHash' IS DISTINCT FROM p_native_source_basis_hash THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native quoted-tax persistence source basis is inconsistent';
  END IF;
  v_event_payload:=pg_catalog.jsonb_build_object('nativeTimingId',v_timing->>'nativeTimingId',
    'documentId',v_timing->>'prospectiveDocumentId','taxId',p_tax::text,'applicabilityId',p_applicability::text,
    'valuationId',p_valuation::text,'reservationId',p_reservation::text,'folioId',p_folio::text,
    'sourceBasisHash',p_native_source_basis_hash);
  v_event_payload_hash:=public.india_native_source_hash(v_event_payload);
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
  END IF;
  v_rate_kind:=v_rate->>'kind';v_selected:=v_quote#>'{rateSelection,selectedVersion}';
  IF v_rate_kind='genuine_section14_rate_change' THEN
    v_section14_case:=v_rate#>>'{section14,case}';v_rate_change:=(v_rate#>>'{section14,rateChangeDate}')::date;
    v_selected_side:=v_rate#>>'{section14,selectedVersionSide}';v_section14_hash:=v_rate#>>'{section14,evidenceHash}';
    v_app_payment_date:=(v_rate#>>'{section14,paymentReceiptDate}')::date;
  ELSIF v_rate_kind='ordinary_section13_single_version' THEN
    v_app_payment_date:=(v_timing->>'paymentReceiptDate')::date;
  ELSE
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native quoted-tax persistence rate branch is invalid';
  END IF;

  INSERT INTO public.india_gst_native_invoice_timing(
    tenant_id,id,property_node,reservation_id,folio_id,folio_account_id,window_no,buyer_party_id,
    reservation_lineage_id,attribution_id,service_provision_snapshot_id,service_provision_evidence_hash,
    payment_receipt_snapshot_id,payment_receipt_evidence_hash,ordinary_regime_evidence_id,ordinary_regime_evidence_hash,
    valuation_id,valuation_generation,valuation_evidence_hash,native_consideration_basis_hash,
    prospective_document_id,series_id,supplier_registration_id,supplier_registration_status_id,
    recipient_registration_id,applicability_id,tax_id,accounting_binding_id,property_timezone,invoice_issue_date,
    actor_id,request_id,request_key_hash,request_hash,evidence_hash,native_source_basis_hash,
    request_event_seq,request_event_id,request_event_payload_hash)
  VALUES(p_tenant,(v_timing->>'nativeTimingId')::uuid,p_property,p_reservation,p_folio,v_folio.account_id,v_folio.window_no,
    (v_prepared->>'legalBuyerPartyId')::uuid,(v_valuation#>>'{intake,lineage,id}')::uuid,
    (v_valuation#>>'{intake,lineage,attribution_id}')::uuid,(v_timing->>'serviceProvisionSnapshotId')::uuid,
    v_valuation#>>'{intake,recordingRoots,serviceProvisionRecording}',(v_timing->>'paymentReceiptSnapshotId')::uuid,
    v_valuation#>>'{intake,recordingRoots,paymentReceiptRecording}',(v_timing->>'ordinaryRegimeEvidenceId')::uuid,
    v_valuation#>>'{intake,recordingRoots,ordinaryRegimeRecording}',p_valuation,(v_valuation->>'generation')::integer,
    v_valuation->>'evidenceHash',v_valuation->>'nativeConsiderationBasisHash',(v_timing->>'prospectiveDocumentId')::uuid,
    p_series,(v_prepared#>>'{sellerRegistration,registrationId}')::uuid,
    (v_prepared#>>'{supplyNatureAtTimeOfSupplyResult,supplierGstRegistrationStatusId}')::uuid,
    (v_prepared#>>'{recipientRegistration,registrationId}')::uuid,p_applicability,p_tax,p_accounting_binding,
    v_timezone,v_invoice_date,p_actor,p_request,p_request_key_hash,p_request_hash,v_projection->>'evidenceHash',
    p_native_source_basis_hash,p_request_event_seq,p_request_event_id,v_event_payload_hash);

  INSERT INTO public.india_gst_accommodation_quoted_rate_applicability(
    tenant_id,id,property_node,reservation_id,folio_id,reservation_lineage_id,attribution_id,
    service_provision_snapshot_id,payment_receipt_snapshot_id,invoice_issue_snapshot_id,
    family_jurisdiction_extension_id,classification_id,supplier_service_location_id,supplier_sez_status_id,
    recipient_sez_status_id,recipient_party_id,final_valuation_id,request_id,section14_case,
    service_provision_date,invoice_issue_date,payment_receipt_date,rate_change_date,time_of_supply_date,
    selected_version_side,selected_extension_id,selected_extension_version,selected_extension_status,
    selected_content_hash,selected_effective_from,selected_effective_to,component_family,section14_evidence_hash,
    levy_component_identity_evidence_hash,reservation_lineage_evidence_hash,attribution_snapshot_evidence_hash,
    evidence_hash,calendar_authority_id,calendar_source_digest_sha256,calendar_through_date,calendar_dates,
    calendar_states,actor_id,invoice_source_kind,rate_selection_kind,valuation_basis_kind,native_timing_id,
    native_timing_evidence_hash,ordinary_regime_evidence_id,ordinary_regime_evidence_hash,
    native_consideration_basis_hash,native_rate_selection_evidence_hash)
  VALUES(p_tenant,p_applicability,p_property,p_reservation,p_folio,
    (v_valuation#>>'{intake,lineage,id}')::uuid,(v_valuation#>>'{intake,lineage,attribution_id}')::uuid,
    (v_timing->>'serviceProvisionSnapshotId')::uuid,(v_timing->>'paymentReceiptSnapshotId')::uuid,NULL,
    (v_family#>>'{jurisdiction,extensionId}')::uuid,(v_prepared#>>'{classification,classificationId}')::uuid,
    (v_prepared#>>'{supplyNatureAtTimeOfSupplyResult,supplierServiceLocationId}')::uuid,
    (v_prepared#>>'{supplyNatureAtTimeOfSupplyResult,supplierSezStatusId}')::uuid,
    (v_prepared#>>'{supplyNatureAtTimeOfSupplyResult,recipientSezStatusId}')::uuid,
    (v_prepared->>'legalBuyerPartyId')::uuid,p_valuation,p_request,v_section14_case,
    (v_timing->>'serviceProvisionDate')::date,v_invoice_date,v_app_payment_date,v_rate_change,
    (v_timing->>'timeOfSupplyDate')::date,v_selected_side,(v_selected->>'extensionId')::uuid,
    (v_selected->>'version')::smallint,v_selected->>'status',v_selected->>'contentHash',
    (v_selected->>'effectiveFromInstant')::timestamptz,(v_selected->>'effectiveToInstant')::timestamptz,
    v_family->>'componentFamily',v_section14_hash,v_identity->>'evidenceHash',
    v_quote#>>'{predecessorHashes,reservationLineage}',v_quote#>>'{predecessorHashes,attributionSnapshot}',
    v_quote->>'evidenceHash',v_calendar_authority,v_calendar_hash,v_calendar_through,
    COALESCE(v_calendar_dates,ARRAY[]::date[]),COALESCE(v_calendar_states,ARRAY[]::text[]),p_actor,
    'native_current_transaction',v_rate_kind,'native_consideration',(v_timing->>'nativeTimingId')::uuid,
    v_projection->>'evidenceHash',(v_timing->>'ordinaryRegimeEvidenceId')::uuid,
    v_valuation#>>'{intake,recordingRoots,ordinaryRegimeRecording}',v_valuation->>'nativeConsiderationBasisHash',
    v_rate->>'evidenceHash');
  FOR v_night IN SELECT e.value FROM pg_catalog.json_array_elements(v_quote->'components')
      WITH ORDINALITY e(value,ordinality) ORDER BY e.ordinality LOOP
    IF (v_night->>'ordinal')::integer<>v_expected_ordinal THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native quoted-tax persistence quote ordinals are not dense';
    END IF;
    INSERT INTO public.india_gst_accommodation_quoted_rate_applicability_room_night(
      tenant_id,applicability_id,ordinal,business_date,quoted_amount_minor,currency,slab_upto_minor,
      aggregate_rate_basis_points,itc_eligible)
    VALUES(p_tenant,p_applicability,v_expected_ordinal,(v_night->>'businessDate')::date,
      (v_night->>'quotedAmountMinor')::bigint,'INR',(v_night#>>'{slab,uptoMinor}')::bigint,
      (v_night#>>'{slab,aggregateRateBasisPoints}')::integer,(v_night#>>'{slab,itcEligible}')::boolean);
    v_component_ordinal:=0;
    FOR v_component IN SELECT e.value FROM pg_catalog.json_array_elements(v_night#>'{slab,components}')
        WITH ORDINALITY e(value,ordinality) ORDER BY e.ordinality LOOP
      INSERT INTO public.india_gst_accommodation_quoted_rate_component(
        tenant_id,applicability_id,room_night_ordinal,component_ordinal,component_identity,rate_basis_points)
      VALUES(p_tenant,p_applicability,v_expected_ordinal,v_component_ordinal::smallint,
        v_component->>'identity',(v_component->>'rateBasisPoints')::integer);
      v_component_ordinal:=v_component_ordinal+1;
    END LOOP;
    v_expected_ordinal:=v_expected_ordinal+1;
  END LOOP;

  INSERT INTO public.india_gst_accommodation_final_component_tax(
    tenant_id,id,property_node,reservation_id,folio_id,applicability_id,valuation_id,valuation_generation,
    request_id,generation,currency,transaction_value_minor,tax_minor,grand_total_minor,component_family,
    selected_version_side,selected_extension_id,selected_extension_version,final_valuation_evidence_hash,
    quoted_rate_applicability_evidence_hash,section14_evidence_hash,levy_component_identity_evidence_hash,
    reservation_lineage_evidence_hash,attribution_snapshot_evidence_hash,evidence_hash,
    supersedes_tax_id,supersedes_tax_evidence_hash,actor_id,invoice_source_kind,rate_selection_kind,
    valuation_basis_kind,native_timing_id,native_timing_evidence_hash,native_rate_selection_evidence_hash,
    native_consideration_basis_hash)
  VALUES(p_tenant,p_tax,p_property,p_reservation,p_folio,p_applicability,p_valuation,
    (v_valuation->>'generation')::integer,p_request,0,'INR',(v_valuation#>>'{basis,transactionValueMinor}')::bigint,
    (v_final->>'taxMinor')::bigint,(v_final->>'grandTotalMinor')::bigint,v_family->>'componentFamily',
    v_selected_side,(v_selected->>'extensionId')::uuid,(v_selected->>'version')::smallint,
    v_valuation->>'evidenceHash',v_quote->>'evidenceHash',v_section14_hash,v_identity->>'evidenceHash',
    v_quote#>>'{predecessorHashes,reservationLineage}',v_quote#>>'{predecessorHashes,attributionSnapshot}',
    v_final->>'evidenceHash',NULL,NULL,p_actor,'native_current_transaction',v_rate_kind,
    'native_consideration',(v_timing->>'nativeTimingId')::uuid,v_projection->>'evidenceHash',
    v_rate->>'evidenceHash',v_valuation->>'nativeConsiderationBasisHash');
  v_expected_ordinal:=0;
  FOR v_night IN SELECT e.value FROM pg_catalog.json_array_elements(v_final->'roomNights')
      WITH ORDINALITY e(value,ordinality) ORDER BY e.ordinality LOOP
    IF (v_night->>'ordinal')::integer<>v_expected_ordinal THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native quoted-tax persistence tax ordinals are not dense';
    END IF;
    INSERT INTO public.india_gst_accommodation_final_component_tax_room_night(
      tenant_id,tax_id,ordinal,business_date,final_value_minor,currency,slab_upto_minor,
      aggregate_rate_basis_points,itc_eligible,tax_minor)
    VALUES(p_tenant,p_tax,v_expected_ordinal,(v_night->>'businessDate')::date,
      (v_night->>'transactionValueMinor')::bigint,'INR',(v_night#>>'{slab,uptoMinor}')::bigint,
      (v_night#>>'{slab,aggregateRateBasisPoints}')::integer,
      CASE WHEN v_night#>>'{slab,uptoMinor}' IS NULL
        THEN ((v_selected#>'{gstRoomSlabs,1}')->>'itcEligible')::boolean
        ELSE ((v_selected#>'{gstRoomSlabs,0}')->>'itcEligible')::boolean END,
      (v_night->>'taxMinor')::bigint);
    v_component_ordinal:=0;
    FOR v_component IN SELECT e.value FROM pg_catalog.json_array_elements(v_night#>'{slab,components}')
        WITH ORDINALITY e(value,ordinality) ORDER BY e.ordinality LOOP
      INSERT INTO public.india_gst_accommodation_final_component_tax_component(
        tenant_id,tax_id,room_night_ordinal,component_ordinal,component_identity,rate_basis_points,
        tax_amount_minor,currency)
      VALUES(p_tenant,p_tax,v_expected_ordinal,v_component_ordinal::smallint,v_component->>'identity',
        (v_component->>'rateBasisPoints')::integer,(v_component->>'taxMinor')::bigint,'INR');
      v_component_ordinal:=v_component_ordinal+1;
    END LOOP;
    v_expected_ordinal:=v_expected_ordinal+1;
  END LOOP;
  RETURN pg_catalog.jsonb_build_object('nativeTimingId',v_timing->>'nativeTimingId',
    'applicabilityId',p_applicability::text,'taxId',p_tax::text,
    'requestEventPayloadHash',v_event_payload_hash,'sourceBasisHash',p_native_source_basis_hash);
END;
$$;
ALTER FUNCTION public.persist_india_native_quoted_tax_source(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,bigint,uuid,text,text,text,text,text,text,text)
  OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.persist_india_native_quoted_tax_source(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,bigint,uuid,text,text,text,text,text,text,text)
  FROM PUBLIC,app_role,yellow_runtime;

-- Private read-only persisted projection check. The future preparation
-- authenticator supplies the freshly reconstructed statutory originals; this
-- helper replays the existing valuation/composition readers and exact-matches
-- their application/tax persistence. It is not complete source authenticity,
-- does not acquire a lock, and grants no caller an acceptance boundary.
CREATE OR REPLACE FUNCTION public.assert_india_native_persisted_tax_projection(
  p_tenant uuid,p_timing uuid,p_native_input text,p_native_result text,p_valuation jsonb,
  p_prepared text,p_service_nature text,p_composition jsonb
) RETURNS void LANGUAGE plpgsql STABLE
SET search_path=pg_catalog,public SET timezone='UTC' SET datestyle='ISO,YMD' AS $$
DECLARE
  v_context uuid;v_native_input jsonb;v_native_result jsonb;v_prepared jsonb;
  v_service_nature jsonb;v_actual_valuation jsonb;v_actual_composition jsonb;
  v_projection jsonb;v_timing_result jsonb;v_rate jsonb;v_quote jsonb;v_final jsonb;
  v_family jsonb;v_identity jsonb;v_selected jsonb;v_payment_evidence jsonb;
  v_timing public.india_gst_native_invoice_timing%ROWTYPE;
  v_app public.india_gst_accommodation_quoted_rate_applicability%ROWTYPE;
  v_tax public.india_gst_accommodation_final_component_tax%ROWTYPE;
  v_calendar_authority text;v_calendar_hash text;v_calendar_through date;
  v_calendar_dates date[]:=ARRAY[]::date[];v_calendar_states text[]:=ARRAY[]::text[];
  v_rate_kind text;v_section14_case text;v_selected_side text;v_section14_hash text;
  v_rate_change date;v_app_payment_date date;
BEGIN
  BEGIN
    v_context:=NULLIF(pg_catalog.current_setting('app.tenant_id',true),'')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='native persisted tax projection tenant context is invalid';
  END;
  IF p_tenant IS NULL OR p_timing IS NULL OR p_tenant IS DISTINCT FROM v_context
      OR p_native_input IS NULL OR p_native_result IS NULL OR p_prepared IS NULL
      OR p_service_nature IS NULL OR pg_catalog.jsonb_typeof(p_valuation) IS DISTINCT FROM 'object'
      OR pg_catalog.jsonb_typeof(p_composition) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='native persisted tax projection identity is invalid';
  END IF;
  BEGIN
    v_native_input:=p_native_input::jsonb;v_native_result:=p_native_result::jsonb;
    v_prepared:=p_prepared::jsonb;v_service_nature:=p_service_nature::jsonb;
    IF pg_catalog.jsonb_typeof(v_native_input) IS DISTINCT FROM 'object'
        OR pg_catalog.jsonb_typeof(v_native_result) IS DISTINCT FROM 'object'
        OR pg_catalog.jsonb_typeof(v_prepared) IS DISTINCT FROM 'object'
        OR pg_catalog.jsonb_typeof(v_service_nature) IS DISTINCT FROM 'object'
        OR p_native_input IS DISTINCT FROM public.india_native_insertion_json(p_native_input::json)
        OR p_native_result IS DISTINCT FROM public.india_native_insertion_json(p_native_result::json)
        OR p_prepared IS DISTINCT FROM public.india_native_insertion_json(p_prepared::json)
        OR p_service_nature IS DISTINCT FROM public.india_native_insertion_json(p_service_nature::json) THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native persisted tax projection requires exact source originals';
    END IF;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native persisted tax projection source transport is invalid';
  END;
  SELECT n.* INTO v_timing FROM public.india_gst_native_invoice_timing n
    WHERE n.tenant_id=p_tenant AND n.id=p_timing;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native persisted tax projection timing is unavailable';
  END IF;
  v_projection:=v_native_input->'nativeTiming';v_timing_result:=v_native_result->'timing';
  v_rate:=v_native_result->'rateSource';v_rate_kind:=v_rate->>'kind';
  IF v_projection->>'nativeTimingId' IS DISTINCT FROM v_timing.id::text
      OR v_projection->>'prospectiveDocumentId' IS DISTINCT FROM v_timing.prospective_document_id::text
      OR v_projection->>'evidenceHash' IS DISTINCT FROM v_timing.evidence_hash
      OR v_timing_result->>'nativeTimingId' IS DISTINCT FROM v_timing.id::text
      OR v_timing_result->>'prospectiveDocumentId' IS DISTINCT FROM v_timing.prospective_document_id::text
      OR v_timing_result->>'invoiceIssueDate' IS DISTINCT FROM v_timing.invoice_issue_date::text
      OR v_timing_result->>'serviceProvisionSnapshotId' IS DISTINCT FROM v_timing.service_provision_snapshot_id::text
      OR v_timing_result->>'paymentReceiptSnapshotId' IS DISTINCT FROM v_timing.payment_receipt_snapshot_id::text
      OR v_timing_result->>'ordinaryRegimeEvidenceId' IS DISTINCT FROM v_timing.ordinary_regime_evidence_id::text THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native persisted tax projection timing source disagrees';
  END IF;
  v_actual_valuation:=public.read_india_native_valuation_evidence(
    p_tenant,v_timing.property_node,v_timing.reservation_id,v_timing.folio_id,v_timing.valuation_id,
    v_timing.service_provision_snapshot_id,v_timing.payment_receipt_snapshot_id,v_timing.ordinary_regime_evidence_id);
  IF v_actual_valuation IS DISTINCT FROM p_valuation THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native persisted tax projection valuation reread disagrees';
  END IF;
  v_actual_composition:=public.compose_india_native_quoted_tax_source(
    p_tenant,v_timing.property_node,v_timing.reservation_id,v_timing.folio_id,v_timing.valuation_id,
    p_native_input,p_native_result,p_service_nature);
  IF v_actual_composition IS DISTINCT FROM p_composition THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native persisted tax projection composition reread disagrees';
  END IF;
  v_family:=(p_composition->>'componentFamilyCanonicalJson')::jsonb;
  v_identity:=(p_composition->>'levyComponentIdentityCanonicalJson')::jsonb;
  v_quote:=(p_composition->>'quotedApplicabilityCanonicalJson')::jsonb;
  v_final:=(p_composition->>'finalTaxCanonicalJson')::jsonb;
  v_selected:=v_quote#>'{rateSelection,selectedVersion}';
  v_payment_evidence:=v_native_input->'section14PaymentEvidence';
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
  END IF;
  IF v_rate_kind='genuine_section14_rate_change' THEN
    v_section14_case:=v_rate#>>'{section14,case}';
    v_rate_change:=(v_rate#>>'{section14,rateChangeDate}')::date;
    v_selected_side:=v_rate#>>'{section14,selectedVersionSide}';
    v_section14_hash:=v_rate#>>'{section14,evidenceHash}';
    v_app_payment_date:=(v_rate#>>'{section14,paymentReceiptDate}')::date;
  ELSIF v_rate_kind='ordinary_section13_single_version' THEN
    v_app_payment_date:=(v_timing_result->>'paymentReceiptDate')::date;
  ELSE
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native persisted tax projection rate branch is invalid';
  END IF;
  SELECT a.* INTO v_app FROM public.india_gst_accommodation_quoted_rate_applicability a
    WHERE a.tenant_id=p_tenant AND a.id=v_timing.applicability_id AND a.native_timing_id=p_timing;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native persisted tax projection applicability is unavailable';
  END IF;
  IF ROW(v_app.id,v_app.property_node,v_app.reservation_id,v_app.folio_id,
      v_app.reservation_lineage_id,v_app.attribution_id,v_app.service_provision_snapshot_id,
      v_app.payment_receipt_snapshot_id,v_app.invoice_issue_snapshot_id,
      v_app.family_jurisdiction_extension_id,v_app.classification_id,v_app.supplier_service_location_id,
      v_app.supplier_sez_status_id,v_app.recipient_sez_status_id,v_app.recipient_party_id,
      v_app.final_valuation_id,v_app.request_id,v_app.section14_case,v_app.service_provision_date,
      v_app.invoice_issue_date,v_app.payment_receipt_date,v_app.rate_change_date,v_app.time_of_supply_date,
      v_app.selected_version_side,v_app.selected_extension_id,v_app.selected_extension_version,
      v_app.selected_extension_status,v_app.selected_content_hash,v_app.selected_effective_from,
      v_app.selected_effective_to,v_app.component_family,v_app.section14_evidence_hash,
      v_app.levy_component_identity_evidence_hash,v_app.reservation_lineage_evidence_hash,
      v_app.attribution_snapshot_evidence_hash,v_app.evidence_hash,v_app.calendar_authority_id,
      v_app.calendar_source_digest_sha256,v_app.calendar_through_date,v_app.calendar_dates,
      v_app.calendar_states,v_app.actor_id,v_app.recorded_at,v_app.invoice_source_kind,
      v_app.rate_selection_kind,v_app.valuation_basis_kind,v_app.native_timing_id,
      v_app.native_timing_evidence_hash,v_app.ordinary_regime_evidence_id,
      v_app.ordinary_regime_evidence_hash,v_app.native_consideration_basis_hash,
      v_app.native_rate_selection_evidence_hash)
    IS DISTINCT FROM ROW(v_timing.applicability_id,v_timing.property_node,v_timing.reservation_id,v_timing.folio_id,
      (p_valuation#>>'{intake,lineage,id}')::uuid,(p_valuation#>>'{intake,lineage,attribution_id}')::uuid,
      v_timing.service_provision_snapshot_id,v_timing.payment_receipt_snapshot_id,NULL::uuid,
      (v_family#>>'{jurisdiction,extensionId}')::uuid,(v_prepared#>>'{classification,classificationId}')::uuid,
      (v_prepared#>>'{supplyNatureAtTimeOfSupplyResult,supplierServiceLocationId}')::uuid,
      (v_prepared#>>'{supplyNatureAtTimeOfSupplyResult,supplierSezStatusId}')::uuid,
      (v_prepared#>>'{supplyNatureAtTimeOfSupplyResult,recipientSezStatusId}')::uuid,
      (v_prepared->>'legalBuyerPartyId')::uuid,v_timing.valuation_id,v_timing.request_id,v_section14_case,
      (v_timing_result->>'serviceProvisionDate')::date,v_timing.invoice_issue_date,v_app_payment_date,
      v_rate_change,(v_timing_result->>'timeOfSupplyDate')::date,v_selected_side,
      (v_selected->>'extensionId')::uuid,(v_selected->>'version')::smallint,v_selected->>'status',
      v_selected->>'contentHash',(v_selected->>'effectiveFromInstant')::timestamptz,
      (v_selected->>'effectiveToInstant')::timestamptz,v_family->>'componentFamily',v_section14_hash,
      v_identity->>'evidenceHash',v_quote#>>'{predecessorHashes,reservationLineage}',
      v_quote#>>'{predecessorHashes,attributionSnapshot}',v_quote->>'evidenceHash',v_calendar_authority,
      v_calendar_hash,v_calendar_through,COALESCE(v_calendar_dates,ARRAY[]::date[]),
      COALESCE(v_calendar_states,ARRAY[]::text[]),v_timing.actor_id,v_timing.transaction_timestamp,
      'native_current_transaction'::text,v_rate_kind,'native_consideration'::text,v_timing.id,
      v_projection->>'evidenceHash',v_timing.ordinary_regime_evidence_id,
      p_valuation#>>'{intake,recordingRoots,ordinaryRegimeRecording}',
      p_valuation->>'nativeConsiderationBasisHash',v_rate->>'evidenceHash') THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native persisted applicability parent projection disagrees';
  END IF;
  SELECT t.* INTO v_tax FROM public.india_gst_accommodation_final_component_tax t
    WHERE t.tenant_id=p_tenant AND t.id=v_timing.tax_id AND t.native_timing_id=p_timing;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native persisted tax projection parent is unavailable';
  END IF;
  IF ROW(v_tax.id,v_tax.property_node,v_tax.reservation_id,v_tax.folio_id,v_tax.applicability_id,
      v_tax.valuation_id,v_tax.valuation_generation,v_tax.request_id,v_tax.generation,v_tax.currency,
      v_tax.transaction_value_minor,v_tax.tax_minor,v_tax.grand_total_minor,v_tax.component_family,
      v_tax.selected_version_side,v_tax.selected_extension_id,v_tax.selected_extension_version,
      v_tax.final_valuation_evidence_hash,v_tax.quoted_rate_applicability_evidence_hash,
      v_tax.section14_evidence_hash,v_tax.levy_component_identity_evidence_hash,
      v_tax.reservation_lineage_evidence_hash,v_tax.attribution_snapshot_evidence_hash,v_tax.evidence_hash,
      v_tax.supersedes_tax_id,v_tax.supersedes_tax_evidence_hash,v_tax.actor_id,v_tax.recorded_at,
      v_tax.invoice_source_kind,v_tax.rate_selection_kind,v_tax.valuation_basis_kind,v_tax.native_timing_id,
      v_tax.native_timing_evidence_hash,v_tax.native_rate_selection_evidence_hash,
      v_tax.native_consideration_basis_hash)
    IS DISTINCT FROM ROW(v_timing.tax_id,v_timing.property_node,v_timing.reservation_id,v_timing.folio_id,
      v_timing.applicability_id,v_timing.valuation_id,(p_valuation->>'generation')::integer,
      v_timing.request_id,0,'INR'::character(3),(p_valuation#>>'{basis,transactionValueMinor}')::bigint,
      (v_final->>'taxMinor')::bigint,(v_final->>'grandTotalMinor')::bigint,v_family->>'componentFamily',
      v_selected_side,(v_selected->>'extensionId')::uuid,(v_selected->>'version')::smallint,
      p_valuation->>'evidenceHash',v_quote->>'evidenceHash',v_section14_hash,v_identity->>'evidenceHash',
      v_quote#>>'{predecessorHashes,reservationLineage}',v_quote#>>'{predecessorHashes,attributionSnapshot}',
      v_final->>'evidenceHash',NULL::uuid,NULL::text,v_timing.actor_id,v_timing.transaction_timestamp,
      'native_current_transaction'::text,v_rate_kind,'native_consideration'::text,v_timing.id,
      v_projection->>'evidenceHash',v_rate->>'evidenceHash',p_valuation->>'nativeConsiderationBasisHash') THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native persisted final-tax parent projection disagrees';
  END IF;

  IF EXISTS((SELECT n.ordinal,n.business_date,n.quoted_amount_minor,n.currency::text,n.slab_upto_minor,
        n.aggregate_rate_basis_points,n.itc_eligible
      FROM public.india_gst_accommodation_quoted_rate_applicability_room_night n
      WHERE n.tenant_id=p_tenant AND n.applicability_id=v_app.id
      EXCEPT ALL
      SELECT (x.value->>'ordinal')::integer,(x.value->>'businessDate')::date,
        (x.value->>'quotedAmountMinor')::bigint,'INR'::text,(x.value#>>'{slab,uptoMinor}')::bigint,
        (x.value#>>'{slab,aggregateRateBasisPoints}')::integer,(x.value#>>'{slab,itcEligible}')::boolean
      FROM pg_catalog.jsonb_array_elements(v_quote->'components') x(value)))
    OR EXISTS((SELECT (x.value->>'ordinal')::integer,(x.value->>'businessDate')::date,
        (x.value->>'quotedAmountMinor')::bigint,'INR'::text,(x.value#>>'{slab,uptoMinor}')::bigint,
        (x.value#>>'{slab,aggregateRateBasisPoints}')::integer,(x.value#>>'{slab,itcEligible}')::boolean
      FROM pg_catalog.jsonb_array_elements(v_quote->'components') x(value)
      EXCEPT ALL
      SELECT n.ordinal,n.business_date,n.quoted_amount_minor,n.currency::text,n.slab_upto_minor,
        n.aggregate_rate_basis_points,n.itc_eligible
      FROM public.india_gst_accommodation_quoted_rate_applicability_room_night n
      WHERE n.tenant_id=p_tenant AND n.applicability_id=v_app.id)) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native persisted applicability night projection disagrees';
  END IF;
  IF EXISTS((SELECT c.room_night_ordinal,c.component_ordinal,c.component_identity,c.rate_basis_points
      FROM public.india_gst_accommodation_quoted_rate_component c
      WHERE c.tenant_id=p_tenant AND c.applicability_id=v_app.id
      EXCEPT ALL
      SELECT (n.value->>'ordinal')::integer,(c.ordinality-1)::smallint,c.value->>'identity',
        (c.value->>'rateBasisPoints')::integer
      FROM pg_catalog.jsonb_array_elements(v_quote->'components') n(value)
      CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(n.value#>'{slab,components}')
        WITH ORDINALITY c(value,ordinality)))
    OR EXISTS((SELECT (n.value->>'ordinal')::integer,(c.ordinality-1)::smallint,c.value->>'identity',
        (c.value->>'rateBasisPoints')::integer
      FROM pg_catalog.jsonb_array_elements(v_quote->'components') n(value)
      CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(n.value#>'{slab,components}')
        WITH ORDINALITY c(value,ordinality)
      EXCEPT ALL
      SELECT c.room_night_ordinal,c.component_ordinal,c.component_identity,c.rate_basis_points
      FROM public.india_gst_accommodation_quoted_rate_component c
      WHERE c.tenant_id=p_tenant AND c.applicability_id=v_app.id)) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native persisted applicability component projection disagrees';
  END IF;
  IF EXISTS((SELECT n.ordinal,n.business_date,n.final_value_minor,n.currency::text,n.slab_upto_minor,
        n.aggregate_rate_basis_points,n.itc_eligible,n.tax_minor
      FROM public.india_gst_accommodation_final_component_tax_room_night n
      WHERE n.tenant_id=p_tenant AND n.tax_id=v_tax.id
      EXCEPT ALL
      SELECT (x.value->>'ordinal')::integer,(x.value->>'businessDate')::date,
        (x.value->>'transactionValueMinor')::bigint,'INR'::text,(x.value#>>'{slab,uptoMinor}')::bigint,
        (x.value#>>'{slab,aggregateRateBasisPoints}')::integer,
        CASE WHEN x.value#>>'{slab,uptoMinor}' IS NULL
          THEN (v_selected#>>'{gstRoomSlabs,1,itcEligible}')::boolean
          ELSE (v_selected#>>'{gstRoomSlabs,0,itcEligible}')::boolean END,
        (x.value->>'taxMinor')::bigint
      FROM pg_catalog.jsonb_array_elements(v_final->'roomNights') x(value)))
    OR EXISTS((SELECT (x.value->>'ordinal')::integer,(x.value->>'businessDate')::date,
        (x.value->>'transactionValueMinor')::bigint,'INR'::text,(x.value#>>'{slab,uptoMinor}')::bigint,
        (x.value#>>'{slab,aggregateRateBasisPoints}')::integer,
        CASE WHEN x.value#>>'{slab,uptoMinor}' IS NULL
          THEN (v_selected#>>'{gstRoomSlabs,1,itcEligible}')::boolean
          ELSE (v_selected#>>'{gstRoomSlabs,0,itcEligible}')::boolean END,
        (x.value->>'taxMinor')::bigint
      FROM pg_catalog.jsonb_array_elements(v_final->'roomNights') x(value)
      EXCEPT ALL
      SELECT n.ordinal,n.business_date,n.final_value_minor,n.currency::text,n.slab_upto_minor,
        n.aggregate_rate_basis_points,n.itc_eligible,n.tax_minor
      FROM public.india_gst_accommodation_final_component_tax_room_night n
      WHERE n.tenant_id=p_tenant AND n.tax_id=v_tax.id)) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native persisted final-tax night projection disagrees';
  END IF;
  IF EXISTS((SELECT c.room_night_ordinal,c.component_ordinal,c.component_identity,
        c.rate_basis_points,c.tax_amount_minor,c.currency::text
      FROM public.india_gst_accommodation_final_component_tax_component c
      WHERE c.tenant_id=p_tenant AND c.tax_id=v_tax.id
      EXCEPT ALL
      SELECT (n.value->>'ordinal')::integer,(c.ordinality-1)::smallint,c.value->>'identity',
        (c.value->>'rateBasisPoints')::integer,(c.value->>'taxMinor')::bigint,'INR'::text
      FROM pg_catalog.jsonb_array_elements(v_final->'roomNights') n(value)
      CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(n.value#>'{slab,components}')
        WITH ORDINALITY c(value,ordinality)))
    OR EXISTS((SELECT (n.value->>'ordinal')::integer,(c.ordinality-1)::smallint,c.value->>'identity',
        (c.value->>'rateBasisPoints')::integer,(c.value->>'taxMinor')::bigint,'INR'::text
      FROM pg_catalog.jsonb_array_elements(v_final->'roomNights') n(value)
      CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(n.value#>'{slab,components}')
        WITH ORDINALITY c(value,ordinality)
      EXCEPT ALL
      SELECT c.room_night_ordinal,c.component_ordinal,c.component_identity,
        c.rate_basis_points,c.tax_amount_minor,c.currency::text
      FROM public.india_gst_accommodation_final_component_tax_component c
      WHERE c.tenant_id=p_tenant AND c.tax_id=v_tax.id)) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native persisted final-tax component projection disagrees';
  END IF;
END;
$$;
ALTER FUNCTION public.assert_india_native_persisted_tax_projection(uuid,uuid,text,text,jsonb,text,text,jsonb)
  OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.assert_india_native_persisted_tax_projection(uuid,uuid,text,text,jsonb,text,text,jsonb)
  FROM PUBLIC,app_role,yellow_runtime;

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

-- D1360: the acyclic preparation digest. This pure function binds already
-- reconstructed source artifacts and generated identities. It neither reads
-- authoritative records nor authenticates a caller, acquires locks or issues a
-- document. The preparation owner and persistence writer reconstruct its inputs.
CREATE OR REPLACE FUNCTION public.india_native_preparation_source_basis(
  p_context jsonb,p_native_input text,p_native_result text,p_valuation_evidence jsonb,
  p_prepared_source text,p_service_nature text,p_composition jsonb,p_series_identity jsonb
) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE
SET search_path=pg_catalog,public SET timezone='UTC' SET datestyle='ISO, YMD' AS $$
DECLARE
  v_input jsonb;v_result jsonb;v_prepared jsonb;v_nature jsonb;
  v_quote jsonb;v_tax jsonb;v_domain jsonb;v_key text;v_text text;
  v_timestamp timestamptz;v_issue_date date;v_year_start date;
BEGIN
  IF pg_catalog.jsonb_typeof(p_context) IS DISTINCT FROM 'object'
      OR NOT (p_context ?& ARRAY['tenantId','propertyNode','reservationId','folioId','actorId','valuationId',
        'nativeTimingId','prospectiveDocumentId','seriesId','applicabilityId','taxId','accountingBindingId',
        'requestId','requestKeyHash','requestHash','requestEventId','issuingTransactionId',
        'transactionTimestamp','propertyTimezone','invoiceIssueDate'])
      OR (SELECT pg_catalog.count(*) FROM pg_catalog.jsonb_object_keys(p_context))<>20
      OR pg_catalog.jsonb_typeof(p_series_identity) IS DISTINCT FROM 'object'
      OR NOT (p_series_identity ?& ARRAY['tenantId','propertyNode','seriesId','supplierRegistrationId',
        'kind','fiscal','financialYearStart','prefix'])
      OR (SELECT pg_catalog.count(*) FROM pg_catalog.jsonb_object_keys(p_series_identity))<>8
      OR pg_catalog.jsonb_typeof(p_composition) IS DISTINCT FROM 'object'
      OR NOT (p_composition ?& ARRAY['componentFamilyCanonicalJson','levyInputBundleCanonicalJson',
        'levyComponentIdentityCanonicalJson','quotedApplicabilityCanonicalJson','finalTaxCanonicalJson','taxPreview'])
      OR (SELECT pg_catalog.count(*) FROM pg_catalog.jsonb_object_keys(p_composition))<>6
      OR pg_catalog.jsonb_typeof(p_valuation_evidence) IS DISTINCT FROM 'object'
      OR NOT (p_valuation_evidence ?& ARRAY['valuationId','generation','actorId','requestId','recordedAt',
        'evidenceHash','nativeConsiderationBasisHash','basis','sourceClosure','intake'])
      OR (SELECT pg_catalog.count(*) FROM pg_catalog.jsonb_object_keys(p_valuation_evidence))<>10 THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native preparation basis has an invalid envelope';
  END IF;
  FOREACH v_key IN ARRAY ARRAY['tenantId','propertyNode','reservationId','folioId','actorId','valuationId',
      'nativeTimingId','prospectiveDocumentId','seriesId','applicabilityId','taxId','accountingBindingId','requestId','requestEventId'] LOOP
    IF pg_catalog.jsonb_typeof(p_context->v_key) IS DISTINCT FROM 'string'
        OR p_context->>v_key !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native preparation basis identity is not canonical';
    END IF;
  END LOOP;
  FOREACH v_key IN ARRAY ARRAY['requestKeyHash','requestHash'] LOOP
    IF pg_catalog.jsonb_typeof(p_context->v_key) IS DISTINCT FROM 'string'
        OR p_context->>v_key !~ '^[0-9a-f]{64}$' THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native preparation basis request identity is invalid';
    END IF;
  END LOOP;
  IF pg_catalog.jsonb_typeof(p_context->'issuingTransactionId') IS DISTINCT FROM 'string'
      OR p_context->>'issuingTransactionId' !~ '^[1-9][0-9]*$'
      OR pg_catalog.jsonb_typeof(p_context->'transactionTimestamp') IS DISTINCT FROM 'string'
      OR p_context->>'transactionTimestamp' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{6}Z$'
      OR pg_catalog.jsonb_typeof(p_context->'invoiceIssueDate') IS DISTINCT FROM 'string'
      OR p_context->>'invoiceIssueDate' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      OR pg_catalog.jsonb_typeof(p_context->'propertyTimezone') IS DISTINCT FROM 'string'
      OR p_context->>'propertyTimezone'=''
      OR p_context->>'propertyTimezone'<>pg_catalog.btrim(p_context->>'propertyTimezone') THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native preparation basis clock is invalid';
  END IF;
  BEGIN
    v_timestamp:=(p_context->>'transactionTimestamp')::timestamptz;
    v_issue_date:=(p_context->>'invoiceIssueDate')::date;
    IF pg_catalog.to_char(v_timestamp AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')<>p_context->>'transactionTimestamp'
        OR (v_timestamp AT TIME ZONE (p_context->>'propertyTimezone'))::date IS DISTINCT FROM v_issue_date THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native preparation basis property date disagrees';
    END IF;
    v_input:=p_native_input::jsonb;v_result:=p_native_result::jsonb;
    v_prepared:=p_prepared_source::jsonb;v_nature:=p_service_nature::jsonb;
    FOREACH v_text IN ARRAY ARRAY[p_native_input,p_native_result,p_prepared_source,p_service_nature] LOOP
      IF pg_catalog.jsonb_typeof(v_text::jsonb) IS DISTINCT FROM 'object'
          OR v_text IS DISTINCT FROM public.india_native_insertion_json(v_text::json) THEN
        RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native preparation basis artifact is not insertion canonical';
      END IF;
    END LOOP;
    FOREACH v_key IN ARRAY ARRAY['componentFamilyCanonicalJson','levyInputBundleCanonicalJson',
        'levyComponentIdentityCanonicalJson','quotedApplicabilityCanonicalJson','finalTaxCanonicalJson'] LOOP
      v_text:=p_composition->>v_key;
      IF pg_catalog.jsonb_typeof(p_composition->v_key) IS DISTINCT FROM 'string'
          OR pg_catalog.jsonb_typeof(v_text::jsonb) IS DISTINCT FROM 'object'
          OR v_text IS DISTINCT FROM public.india_native_insertion_json(v_text::json) THEN
        RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native preparation basis composition is not insertion canonical';
      END IF;
    END LOOP;
  EXCEPTION WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow OR invalid_parameter_value THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native preparation basis contains an invalid encoded artifact or clock';
  END;
  IF NOT (v_input ?& ARRAY['kind','tenantId','propertyNode','reservationId','serviceProvision','paymentReceipt',
        'ordinaryRegime','nativeTiming','rateVersionPair','rateChangeDateEvidence','historicalResolutions','section14PaymentEvidence'])
      OR (SELECT pg_catalog.count(*) FROM pg_catalog.jsonb_object_keys(v_input))<>12
      OR NOT (v_result ?& ARRAY['kind','timing','rateSource','evidenceHash'])
      OR (SELECT pg_catalog.count(*) FROM pg_catalog.jsonb_object_keys(v_result))<>4
      OR NOT (v_prepared ?& ARRAY['tenantId','legalBuyerPartyId','sellerRegistration','recipientRegistration',
        'placeOfSupply','classification','supplyNatureAtTimeOfSupplyInput','supplyNatureAtTimeOfSupplyResult'])
      OR (SELECT pg_catalog.count(*) FROM pg_catalog.jsonb_object_keys(v_prepared))<>8
      OR v_input->>'kind' IS DISTINCT FROM 'native_current_transaction'
      OR v_result->>'kind' IS DISTINCT FROM 'native_current_transaction' THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native preparation basis source envelope is invalid';
  END IF;
  v_quote:=(p_composition->>'quotedApplicabilityCanonicalJson')::jsonb;
  v_tax:=(p_composition->>'finalTaxCanonicalJson')::jsonb;
  FOREACH v_key IN ARRAY ARRAY['tenantId','propertyNode','reservationId'] LOOP
    IF p_context->v_key IS DISTINCT FROM v_input->v_key
        OR p_context->v_key IS DISTINCT FROM p_valuation_evidence#>ARRAY['basis',v_key] THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native preparation basis source scope disagrees';
    END IF;
  END LOOP;
  FOREACH v_key IN ARRAY ARRAY['propertyNode','reservationId','folioId'] LOOP
    IF p_context->v_key IS DISTINCT FROM v_nature->v_key
        OR p_context->v_key IS DISTINCT FROM v_prepared#>ARRAY['supplyNatureAtTimeOfSupplyResult',v_key] THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native preparation basis statutory scope disagrees';
    END IF;
  END LOOP;
  FOREACH v_key IN ARRAY ARRAY['nativeTimingId','prospectiveDocumentId','invoiceIssueDate'] LOOP
    IF p_context->v_key IS DISTINCT FROM v_input#>ARRAY['nativeTiming',v_key]
        OR p_context->v_key IS DISTINCT FROM v_result#>ARRAY['timing',v_key]
        OR p_context->v_key IS DISTINCT FROM v_quote#>ARRAY['nativeTiming',v_key] THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native preparation basis prospective timing disagrees';
    END IF;
  END LOOP;
  IF p_context->'folioId' IS DISTINCT FROM p_valuation_evidence#>'{basis,folioId}'
      OR p_context->'tenantId' IS DISTINCT FROM v_prepared->'tenantId'
      OR p_context->'valuationId' IS DISTINCT FROM p_valuation_evidence->'valuationId'
      OR p_context->'valuationId' IS DISTINCT FROM v_tax->'valuationId'
      OR p_context->'nativeTimingId' IS DISTINCT FROM v_tax->'nativeTimingId'
      OR p_context->'valuationId' IS DISTINCT FROM p_composition#>'{taxPreview,valuationId}'
      OR v_prepared->'legalBuyerPartyId' IS DISTINCT FROM p_valuation_evidence#>'{basis,buyerPartyId}'
      OR v_quote->'kind' IS DISTINCT FROM '"native_current_transaction"'::jsonb
      OR v_tax->'kind' IS DISTINCT FROM '"native_current_transaction"'::jsonb THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native preparation basis valuation composition disagrees';
  END IF;
  v_year_start:=pg_catalog.make_date(pg_catalog.date_part('year',v_issue_date)::integer
    -CASE WHEN pg_catalog.date_part('month',v_issue_date)<4 THEN 1 ELSE 0 END,4,1);
  IF p_series_identity->'tenantId' IS DISTINCT FROM p_context->'tenantId'
      OR p_series_identity->'propertyNode' IS DISTINCT FROM p_context->'propertyNode'
      OR p_series_identity->'seriesId' IS DISTINCT FROM p_context->'seriesId'
      OR pg_catalog.jsonb_typeof(p_series_identity->'supplierRegistrationId') IS DISTINCT FROM 'string'
      OR p_series_identity->>'supplierRegistrationId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      OR p_series_identity->'supplierRegistrationId' IS DISTINCT FROM v_prepared#>'{sellerRegistration,registrationId}'
      OR p_series_identity->'kind' IS DISTINCT FROM '"invoice"'::jsonb
      OR p_series_identity->'fiscal' IS DISTINCT FROM 'true'::jsonb
      OR p_series_identity->'financialYearStart' IS DISTINCT FROM pg_catalog.to_jsonb(v_year_start::text)
      OR pg_catalog.jsonb_typeof(p_series_identity->'prefix') IS DISTINCT FROM 'string'
      OR p_series_identity->>'prefix' !~ '^[A-Za-z0-9/-]{1,12}$' THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native preparation basis series identity disagrees';
  END IF;
  v_domain:=pg_catalog.jsonb_build_object('kind','india-native-fiscal-preparation-source-v1','context',p_context,
    'nativeInvoiceSourceInputCanonicalJson',p_native_input,'nativeInvoiceSourceResultCanonicalJson',p_native_result,
    'valuationEvidence',p_valuation_evidence,'preparedSourceCanonicalJson',p_prepared_source,
    'serviceSupplyNatureCanonicalJson',p_service_nature,'quotedTaxComposition',p_composition,'seriesIdentity',p_series_identity);
  RETURN pg_catalog.jsonb_build_object('preimageCanonicalJson',public.india_native_source_canonical_json(v_domain),
    'sourceBasisHash',public.india_native_source_hash(v_domain));
END;
$$;
ALTER FUNCTION public.india_native_preparation_source_basis(jsonb,text,text,jsonb,text,text,jsonb,jsonb) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.india_native_preparation_source_basis(jsonb,text,text,jsonb,text,text,jsonb,jsonb)
  FROM PUBLIC,app_role,yellow_runtime;

-- Actual current-transaction source reconstruction, not an evidence-hash shape
-- check. No locks are acquired here: the outer preparation owns the full ordered
-- lock graph before publishing its request. Historical completed-receipt replay
-- must use permanent issued-document provenance, not this prospective clock.
CREATE OR REPLACE FUNCTION public.assert_india_native_preparation_authenticity(
  p_tenant uuid,p_native_timing uuid
) RETURNS jsonb LANGUAGE plpgsql VOLATILE
SET search_path=pg_catalog,public SET timezone='UTC' SET datestyle='ISO,YMD' AS $$
DECLARE
  n public.india_gst_native_invoice_timing%ROWTYPE;
  a public.india_gst_accommodation_quoted_rate_applicability%ROWTYPE;
  s public.document_series%ROWTYPE;
  v_authority jsonb;v_timing jsonb;v_valuation jsonb;v_history jsonb;v_composition jsonb;
  v_prepared jsonb;v_projection jsonb;v_context jsonb;v_series jsonb;v_basis jsonb;
  v_calendar jsonb;v_request jsonb;v_jurisdiction text;v_count integer;
  v_statutory record;
BEGIN
  IF p_tenant IS NULL OR p_native_timing IS NULL OR p_tenant IS DISTINCT FROM
      NULLIF(pg_catalog.current_setting('app.tenant_id',true),'')::uuid THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='native preparation authentication requires its tenant context';
  END IF;
  SELECT t.* INTO n FROM public.india_gst_native_invoice_timing t
    WHERE t.tenant_id=p_tenant AND t.id=p_native_timing;
  IF NOT FOUND OR n.issuing_transaction_id IS DISTINCT FROM pg_catalog.pg_current_xact_id()
      OR n.transaction_timestamp IS DISTINCT FROM pg_catalog.transaction_timestamp() THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native preparation authentication requires the actual issuing transaction';
  END IF;
  v_authority:=public.read_india_native_issue_authority(p_tenant,n.property_node,n.actor_id,n.reservation_id,n.folio_id);
  IF v_authority->>'folioAccountId' IS DISTINCT FROM n.folio_account_id::text
      OR (v_authority->>'windowNo')::smallint IS DISTINCT FROM n.window_no
      OR v_authority->>'propertyTimezone' IS DISTINCT FROM n.property_timezone
      OR (v_authority->>'invoiceIssueDate')::date IS DISTINCT FROM n.invoice_issue_date THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native preparation authority or property clock differs';
  END IF;
  SELECT app.* INTO a FROM public.india_gst_accommodation_quoted_rate_applicability app
    WHERE app.tenant_id=p_tenant AND app.id=n.applicability_id AND app.native_timing_id=n.id;
  IF NOT FOUND OR a.invoice_source_kind<>'native_current_transaction'
      OR a.final_valuation_id IS DISTINCT FROM n.valuation_id
      OR a.actor_id IS DISTINCT FROM n.actor_id OR a.request_id IS DISTINCT FROM n.request_id THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native preparation applicability identity is unavailable';
  END IF;
  -- This reader rederives the complete original intake hashes and the actual
  -- property clock, six historical rate resolutions and governed calendar case.
  v_timing:=public.read_india_native_invoice_timing_source(p_tenant,n.property_node,n.reservation_id,
    n.service_provision_snapshot_id,n.payment_receipt_snapshot_id,n.ordinary_regime_evidence_id,
    n.id,n.prospective_document_id,a.calendar_authority_id,a.calendar_source_digest_sha256,
    a.calendar_through_date,a.calendar_dates,a.calendar_states);
  v_projection:=v_timing->'nativeTiming';
  v_valuation:=public.read_india_native_valuation_evidence(p_tenant,n.property_node,n.reservation_id,n.folio_id,
    n.valuation_id,n.service_provision_snapshot_id,n.payment_receipt_snapshot_id,n.ordinary_regime_evidence_id);
  IF ROW(n.reservation_lineage_id,n.attribution_id,n.buyer_party_id,n.valuation_generation,
        n.valuation_evidence_hash,n.native_consideration_basis_hash,n.service_provision_evidence_hash,
        n.payment_receipt_evidence_hash,n.ordinary_regime_evidence_hash,n.evidence_hash)
      IS DISTINCT FROM ROW((v_valuation#>>'{intake,lineage,id}')::uuid,(v_valuation#>>'{intake,lineage,attribution_id}')::uuid,
        (v_valuation#>>'{basis,buyerPartyId}')::uuid,(v_valuation->>'generation')::integer,
        v_valuation->>'evidenceHash',v_valuation->>'nativeConsiderationBasisHash',
        v_valuation#>>'{intake,recordingRoots,serviceProvisionRecording}',
        v_valuation#>>'{intake,recordingRoots,paymentReceiptRecording}',
        v_valuation#>>'{intake,recordingRoots,ordinaryRegimeRecording}',v_projection->>'evidenceHash') THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native preparation timing does not bind the reconstructed original roots';
  END IF;
  v_history:=public.read_india_native_rate_history_day(p_tenant,n.property_node,
    (v_timing#>>'{invoiceSourceResult,timing,serviceProvisionDate}')::date);
  v_jurisdiction:=public.india_native_insertion_json(pg_catalog.json_build_object(
    'extensionId',v_history#>'{selectedExtension,extensionId}','ownerTenantId',NULL,
    'key',v_history#>'{selectedExtension,key}','version',v_history#>>'{selectedExtension,version}',
    'contentHash',v_history#>'{selectedExtension,contentHash}'));
  SELECT * INTO STRICT v_statutory FROM public.read_india_native_statutory_root_graph(
    p_tenant,n.property_node,n.reservation_id,n.folio_id,n.valuation_id,
    a.supplier_service_location_id,n.supplier_registration_status_id,a.supplier_sez_status_id,
    n.recipient_registration_id,a.recipient_sez_status_id,a.classification_id,
    v_timing->>'invoiceSourceResultCanonicalJson',v_jurisdiction);
  v_prepared:=v_statutory.prepared_source_json::jsonb;
  IF v_prepared#>>'{sellerRegistration,registrationId}' IS DISTINCT FROM n.supplier_registration_id::text
      OR v_prepared#>>'{recipientRegistration,registrationId}' IS DISTINCT FROM n.recipient_registration_id::text
      OR v_prepared->>'legalBuyerPartyId' IS DISTINCT FROM n.buyer_party_id::text THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native preparation statutory parties disagree with timing';
  END IF;
  v_composition:=public.compose_india_native_quoted_tax_source(p_tenant,n.property_node,n.reservation_id,
    n.folio_id,n.valuation_id,v_timing->>'invoiceSourceInputCanonicalJson',
    v_timing->>'invoiceSourceResultCanonicalJson',v_statutory.service_supply_nature_json);
  -- Reconstruct the existing v2 semantic request, including selected source IDs
  -- and the whole calendar. The raw idempotency key is intentionally not stored;
  -- the outer command checks its SHA against n.request_key_hash before writing.
  v_count:=pg_catalog.cardinality(a.calendar_dates);
  IF v_count=0 THEN
    v_calendar:='null'::jsonb;
  ELSE
    v_calendar:=pg_catalog.jsonb_build_object('authorityId',a.calendar_authority_id,
      'sourceDigestSha256',a.calendar_source_digest_sha256,'throughDate',a.calendar_through_date,
      'days',(SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('date',a.calendar_dates[i],
        'state',a.calendar_states[i]) ORDER BY i) FROM pg_catalog.generate_series(1,v_count) i));
  END IF;
  v_request:=pg_catalog.jsonb_build_object('kind','india-native-invoice-request-v2',
    'tenantId',p_tenant,'propertyNode',n.property_node,'actorId',n.actor_id,'reservationId',n.reservation_id,
    'folioId',n.folio_id,'valuationId',n.valuation_id,'serviceProvisionSnapshotId',n.service_provision_snapshot_id,
    'paymentReceiptSnapshotId',n.payment_receipt_snapshot_id,'ordinaryRegimeEvidenceId',n.ordinary_regime_evidence_id,
    'supplierServiceLocationId',a.supplier_service_location_id,'supplierRegistrationStatusId',n.supplier_registration_status_id,
    'supplierSezStatusId',a.supplier_sez_status_id,'recipientRegistrationId',n.recipient_registration_id,
    'recipientSezStatusId',a.recipient_sez_status_id,'classificationId',a.classification_id,'calendarEvidence',v_calendar);
  IF public.india_native_source_hash(v_request) IS DISTINCT FROM n.request_hash THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native preparation request differs from reconstructed selectors and calendar';
  END IF;
  SELECT series.* INTO s FROM public.document_series series
    WHERE series.tenant_id=p_tenant AND series.id=n.series_id
      AND series.property_node=n.property_node AND series.supplier_registration_id=n.supplier_registration_id
      AND series.kind='invoice' AND series.fiscal;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native preparation configured fiscal series is unavailable';
  END IF;
  PERFORM 1 FROM public.business_day day WHERE day.tenant_id=p_tenant AND day.property_node=n.property_node
    AND day.business_date=n.invoice_issue_date AND day.sealed_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native preparation issue day is unavailable or sealed';
  END IF;
  v_context:=pg_catalog.jsonb_build_object('tenantId',p_tenant,'propertyNode',n.property_node,
    'reservationId',n.reservation_id,'folioId',n.folio_id,'actorId',n.actor_id,'valuationId',n.valuation_id,
    'nativeTimingId',n.id,'prospectiveDocumentId',n.prospective_document_id,'seriesId',n.series_id,
    'applicabilityId',n.applicability_id,'taxId',n.tax_id,'accountingBindingId',n.accounting_binding_id,
    'requestId',n.request_id,'requestKeyHash',n.request_key_hash,'requestHash',n.request_hash,
    'requestEventId',n.request_event_id,'issuingTransactionId',n.issuing_transaction_id::text,
    'transactionTimestamp',pg_catalog.to_char(n.transaction_timestamp AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'propertyTimezone',n.property_timezone,'invoiceIssueDate',n.invoice_issue_date::text);
  v_series:=pg_catalog.jsonb_build_object('tenantId',p_tenant,'propertyNode',n.property_node,'seriesId',n.series_id,
    'supplierRegistrationId',s.supplier_registration_id,'kind',s.kind,'fiscal',s.fiscal,
    'financialYearStart',s.financial_year_start::text,'prefix',s.prefix);
  v_basis:=public.india_native_preparation_source_basis(v_context,v_timing->>'invoiceSourceInputCanonicalJson',
    v_timing->>'invoiceSourceResultCanonicalJson',v_valuation,v_statutory.prepared_source_json,
    v_statutory.service_supply_nature_json,v_composition,v_series);
  IF v_basis->>'sourceBasisHash' IS DISTINCT FROM n.native_source_basis_hash THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native preparation complete source basis differs from original roots';
  END IF;
  PERFORM public.assert_india_native_persisted_tax_projection(p_tenant,n.id,
    v_timing->>'invoiceSourceInputCanonicalJson',v_timing->>'invoiceSourceResultCanonicalJson',
    v_valuation,v_statutory.prepared_source_json,v_statutory.service_supply_nature_json,v_composition);
  PERFORM public.assert_india_native_accounting_request(p_tenant,n.id);
  RETURN pg_catalog.jsonb_build_object('nativeTimingId',n.id,
    'invoiceSourceInputCanonicalJson',v_timing->>'invoiceSourceInputCanonicalJson',
    'invoiceSourceResultCanonicalJson',v_timing->>'invoiceSourceResultCanonicalJson',
    'preparedSourceCanonicalJson',v_statutory.prepared_source_json,
    'serviceSupplyNatureCanonicalJson',v_statutory.service_supply_nature_json,
    'valuationEvidence',v_valuation,'quotedTaxComposition',v_composition,'sourceBasis',v_basis,
    'requestCanonicalJson',public.india_native_source_canonical_json(v_request),'seriesIdentity',v_series);
END;
$$;
ALTER FUNCTION public.assert_india_native_preparation_authenticity(uuid,uuid) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.assert_india_native_preparation_authenticity(uuid,uuid) FROM PUBLIC,app_role,yellow_runtime;
