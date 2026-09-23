-- Order434 / Question190: NON-RUNNABLE Financials completion fragment.
-- Assemble only with the real canonical preparation/commit and correction
-- guards. No table or public capability grant is introduced by this fragment.
-- Native accounting reuses existing consideration; it never posts revenue.

-- Shared with the preparation preview: exact 0070 component-first integer
-- half-up rule. Numeric is only a widened intermediate; result remains int64.
CREATE OR REPLACE FUNCTION public.india_native_component_tax_minor(p_value bigint,p_bps integer)
RETURNS bigint LANGUAGE plpgsql IMMUTABLE
SET search_path=pg_catalog,public AS $$
DECLARE v_product numeric; v_result numeric;
BEGIN
  IF p_value IS NULL OR p_value<=0 OR p_bps IS NULL
     OR p_bps NOT IN (250,500,600,900,1200,1800) THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='native component amount requires positive int64 value and admitted component rate';
  END IF;
  v_product:=p_value::numeric*p_bps;
  v_result:=pg_catalog.trunc(v_product/10000)
    + CASE WHEN pg_catalog.mod(v_product,10000)*2>=10000 THEN 1 ELSE 0 END;
  IF v_result NOT BETWEEN 0 AND 9223372036854775807::numeric THEN
    RAISE EXCEPTION USING ERRCODE='22003',MESSAGE='native component tax exceeds signed int64';
  END IF;
  RETURN v_result::bigint;
END;
$$;
ALTER FUNCTION public.india_native_component_tax_minor(bigint,integer) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.india_native_component_tax_minor(bigint,integer) FROM PUBLIC,app_role,yellow_runtime;

-- The one no-lock reread shared by preparation, accounting and final completion.
-- Reproduce 0075's exact complete currentFragmentSetHash from actual rows,
-- including archived/live fragments and every line of multi-root transfers.
-- This verifies the financial closure, not the complete valuation/approval or
-- fiscal preimages; the preparation authentication helper must replay those.
CREATE OR REPLACE FUNCTION public.read_india_native_valuation_source_closure(
  p_tenant uuid,p_property uuid,p_reservation uuid,p_folio uuid,p_valuation uuid
) RETURNS jsonb LANGUAGE plpgsql VOLATILE
SET search_path=pg_catalog,public SET timezone='UTC' SET datestyle='ISO,YMD' AS $$
DECLARE
  v_valuation public.india_gst_accommodation_final_valuation%ROWTYPE;
  v_root public.posting_line%ROWTYPE; v_header public.journal%ROWTYPE;
  v_source public.india_gst_accommodation_valuation_source%ROWTYPE;
  v_roots uuid[]; v_recorded_roots uuid[]; v_accounts uuid[]; v_id uuid;
  v_lines jsonb; v_fragments jsonb; v_transfers jsonb; v_graph jsonb;
  v_sources jsonb:='[]'::jsonb; v_amount numeric; v_total numeric;
  v_active integer; v_folio_id uuid; v_hash text;
BEGIN
  IF p_tenant IS NULL OR p_property IS NULL OR p_reservation IS NULL OR p_folio IS NULL
     OR p_valuation IS NULL OR p_tenant IS DISTINCT FROM
       NULLIF(pg_catalog.current_setting('app.tenant_id',true),'')::uuid THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='native source closure requires the exact tenant context';
  END IF;
  SELECT v.* INTO v_valuation FROM public.india_gst_accommodation_final_valuation v
    JOIN public.folio f ON f.tenant_id=v.tenant_id AND f.id=v.folio_id
      AND f.reservation_id=v.reservation_id AND f.account_id=v.folio_account_id AND f.window_no=v.window_no
    JOIN public.account a ON a.tenant_id=f.tenant_id AND a.id=f.account_id
      AND a.property_node=v.property_node AND a.currency='INR' AND a.role='guest'
    WHERE v.tenant_id=p_tenant AND v.id=p_valuation AND v.property_node=p_property
      AND v.reservation_id=p_reservation AND v.folio_id=p_folio
      AND v.basis_kind='native_consideration' AND v.disposition='ordinary_final'
      AND v.currency='INR' AND v.transaction_value_minor>0
      AND NOT EXISTS(SELECT 1 FROM public.india_gst_accommodation_final_valuation next
        WHERE next.tenant_id=v.tenant_id AND next.supersedes_valuation_id=v.id);
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='current native valuation financial scope unavailable'; END IF;
  v_roots:=public.india_native_consideration_roots(p_tenant,p_folio,v_valuation.folio_account_id);
  SELECT pg_catalog.array_agg(s.posting_root_id ORDER BY s.posting_root_id) INTO v_recorded_roots
    FROM public.india_gst_accommodation_valuation_source s
    WHERE s.tenant_id=p_tenant AND s.valuation_id=p_valuation AND s.basis_kind='native_consideration';
  IF pg_catalog.cardinality(v_roots) NOT BETWEEN 1 AND 500
     OR v_roots IS DISTINCT FROM v_recorded_roots
     OR pg_catalog.cardinality(v_roots)<>v_valuation.native_source_count THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native consideration root membership differs from recorded valuation';
  END IF;
  v_accounts:=public.india_native_consideration_accounts(p_tenant,v_roots,v_valuation.folio_account_id);
  IF pg_catalog.cardinality(v_accounts)>501 THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native consideration exceeds its 501-account bound';
  END IF;
  FOREACH v_id IN ARRAY v_roots LOOP
    SELECT * INTO STRICT v_root FROM public.posting_line r WHERE r.tenant_id=p_tenant AND r.id=v_id;
    SELECT * INTO STRICT v_header FROM public.journal j WHERE j.tenant_id=p_tenant AND j.id=v_root.journal_id;
    SELECT * INTO STRICT v_source FROM public.india_gst_accommodation_valuation_source s
      WHERE s.tenant_id=p_tenant AND s.valuation_id=p_valuation AND s.posting_root_id=v_id;
    -- A reversal header is a source change even before its contra root exists.
    IF EXISTS(SELECT 1 FROM public.journal j WHERE j.tenant_id=p_tenant AND j.reverses=v_header.id
        AND NOT EXISTS(SELECT 1 FROM public.posting_line r WHERE r.tenant_id=j.tenant_id
          AND r.journal_id=j.id AND r.seq=1 AND r.id=ANY(v_roots)))
      OR (v_header.reverses IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.posting_line r
        WHERE r.tenant_id=p_tenant AND r.journal_id=v_header.reverses AND r.seq=1 AND r.id=ANY(v_roots)))
      OR EXISTS(SELECT 1 FROM public.tax_attribution_journal_binding b
        WHERE b.tenant_id=p_tenant AND b.journal_id=v_header.id)
      OR EXISTS(SELECT 1 FROM public.india_gst_accommodation_final_component_tax_journal_binding b
        WHERE b.tenant_id=p_tenant AND b.journal_id=v_header.id) THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native consideration has new or incomplete correction/tax ancestry';
    END IF;
    SELECT pg_catalog.count(*) FILTER (WHERE amount<>0),
      (pg_catalog.array_agg(folio_id ORDER BY folio_id) FILTER (WHERE amount<>0))[1],
      pg_catalog.sum(amount),pg_catalog.sum(amount) FILTER (WHERE folio_id=p_folio)
      INTO v_active,v_folio_id,v_total,v_amount
      FROM (SELECT f.folio_id,pg_catalog.sum(f.amount_minor::numeric) amount
        FROM public.posting_line f WHERE f.tenant_id=p_tenant
          AND COALESCE(f.folio_transfer_root_line_id,f.id)=v_id GROUP BY f.folio_id) allocation;
    IF v_active<>1 OR v_folio_id IS DISTINCT FROM p_folio
       OR v_total IS DISTINCT FROM v_root.amount_minor::numeric
       OR v_amount IS DISTINCT FROM v_source.current_amount_minor::numeric
       OR v_amount IS DISTINCT FROM v_root.amount_minor::numeric
       OR v_source.currency<>'INR' OR v_source.tx_code<>v_root.tx_code THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native consideration is split, partial or changed';
    END IF;
    SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(l) ORDER BY l.seq) INTO v_lines
      FROM public.posting_line l WHERE l.tenant_id=p_tenant AND l.journal_id=v_header.id;
    SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'line',pg_catalog.to_jsonb(f),'journal',pg_catalog.to_jsonb(j)) ORDER BY f.id)
      INTO v_fragments FROM public.posting_line f JOIN public.journal j
        ON j.tenant_id=f.tenant_id AND j.id=f.journal_id
      WHERE f.tenant_id=p_tenant AND COALESCE(f.folio_transfer_root_line_id,f.id)=v_id;
    SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'journal',pg_catalog.to_jsonb(j),'lines',(SELECT pg_catalog.jsonb_agg(
        pg_catalog.to_jsonb(l) ORDER BY l.seq) FROM public.posting_line l
        WHERE l.tenant_id=j.tenant_id AND l.journal_id=j.id)) ORDER BY j.id),'[]'::jsonb)
      INTO v_transfers FROM public.journal j
      WHERE j.tenant_id=p_tenant AND j.id IN (SELECT f.journal_id FROM public.posting_line f
        WHERE f.tenant_id=p_tenant AND f.folio_transfer_root_line_id=v_id);
    v_graph:=pg_catalog.jsonb_build_object('postingRootId',v_id,'root',pg_catalog.to_jsonb(v_root),
      'journal',pg_catalog.to_jsonb(v_header),'lines',v_lines,'fragments',v_fragments,
      'transferJournals',v_transfers,'currentFolioId',p_folio,
      'currentAmountMinor',v_amount::bigint::text,'txCode',v_root.tx_code);
    v_hash:=public.india_native_source_hash(v_graph);
    IF v_hash IS DISTINCT FROM v_source.current_fragment_set_hash THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='complete native consideration graph differs from recorded valuation';
    END IF;
    v_sources:=v_sources||pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'postingRootId',v_id,'journalId',v_header.id,'currentAmountMinor',v_amount::bigint::text,
      'txCode',v_root.tx_code,'currentFragmentSetHash',v_hash));
  END LOOP;
  IF (SELECT pg_catalog.sum(s.current_amount_minor) FROM public.india_gst_accommodation_valuation_source s
      WHERE s.tenant_id=p_tenant AND s.valuation_id=p_valuation) IS DISTINCT FROM v_valuation.transaction_value_minor::numeric
     OR v_roots IS DISTINCT FROM public.india_native_consideration_roots(p_tenant,p_folio,v_valuation.folio_account_id)
     OR v_accounts IS DISTINCT FROM public.india_native_consideration_accounts(p_tenant,v_roots,v_valuation.folio_account_id) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native consideration closure changed during complete reread';
  END IF;
  RETURN pg_catalog.jsonb_build_object('accountId',v_valuation.folio_account_id,
    'accountIds',v_accounts,'rootIds',v_roots,'sources',v_sources);
END;
$$;
ALTER FUNCTION public.read_india_native_valuation_source_closure(uuid,uuid,uuid,uuid,uuid) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.read_india_native_valuation_source_closure(uuid,uuid,uuid,uuid,uuid)
  FROM PUBLIC,app_role,yellow_runtime;

-- Private mapping only. Preparation passes independently SQL-derived preview
-- component sums before acquiring the complete <=503 account set. Accounting
-- calls this same mapper with authenticated persisted component sums. No locks,
-- rounding, caller account array, revenue route or standalone posting authority.
CREATE OR REPLACE FUNCTION public.india_native_component_tax_routes(
  p_tenant uuid,p_property uuid,p_extension uuid,p_version smallint,p_content_hash text,
  p_family text,p_component_amounts bigint[]
) RETURNS TABLE(component_ordinal smallint,component_identity text,amount_minor bigint,
  mapping_id uuid,tx_code text,credit_account_id uuid,route_evidence_hash text)
LANGUAGE plpgsql VOLATILE SET search_path=pg_catalog,public
SET timezone='UTC' SET datestyle='ISO,YMD' AS $$
DECLARE v_identities text[]; v_i integer; v_row record;
BEGIN
  v_identities:=CASE p_family WHEN 'igst' THEN ARRAY['igst'] WHEN 'cgst_sgst' THEN ARRAY['cgst','sgst']
    WHEN 'cgst_utgst' THEN ARRAY['cgst','utgst'] END;
  IF p_tenant IS NULL OR p_property IS NULL OR p_extension IS NULL OR p_version IS NULL
     OR p_content_hash IS NULL OR p_content_hash !~ '^[0-9a-f]{64}$' OR v_identities IS NULL
     OR pg_catalog.array_ndims(p_component_amounts) IS DISTINCT FROM 1
     OR pg_catalog.array_lower(p_component_amounts,1) IS DISTINCT FROM 1
     OR pg_catalog.cardinality(p_component_amounts) IS DISTINCT FROM pg_catalog.cardinality(v_identities)
     OR EXISTS(SELECT 1 FROM pg_catalog.unnest(p_component_amounts) a WHERE a IS NULL OR a<0)
     OR p_tenant IS DISTINCT FROM NULLIF(pg_catalog.current_setting('app.tenant_id',true),'')::uuid THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='native component route identity is invalid';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.extension e WHERE e.id=p_extension AND e.tenant_id IS NULL
      AND e.type='tax_jurisdiction' AND e.key='in-gst-lodging' AND e.version=p_version
      AND e.status IN ('active','retired')) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native component jurisdiction unavailable';
  END IF;
  FOR v_i IN 1..pg_catalog.cardinality(v_identities) LOOP
    component_ordinal:=(v_i-1)::smallint; component_identity:=v_identities[v_i];
    amount_minor:=p_component_amounts[v_i]; mapping_id:=NULL; tx_code:=NULL;
    credit_account_id:=NULL; route_evidence_hash:=NULL;
    IF amount_minor>0 THEN
      SELECT m.id,c.code,r.credit_account_id,
        public.india_native_source_hash(pg_catalog.jsonb_build_array('india-native-component-route-v1',
          pg_catalog.to_jsonb(m),pg_catalog.to_jsonb(r),pg_catalog.to_jsonb(c),
          pg_catalog.jsonb_build_object('tenantId',a.tenant_id,'id',a.id,'propertyNode',a.property_node,
            'role',a.role,'currency',a.currency))) AS evidence_hash
        INTO v_row FROM public.tax_semantic_route m
        JOIN public.tx_code c ON c.code=m.tx_code AND c.grp='tax'
        JOIN public.tx_code_route r ON r.tenant_id=m.tenant_id AND r.property_node=m.property_node
          AND r.currency=m.currency AND r.tx_code=m.tx_code
        JOIN public.account a ON a.tenant_id=r.tenant_id AND a.id=r.credit_account_id
          AND a.property_node=r.property_node AND a.currency=r.currency AND a.role='tax_payable' AND a.status='open'
        WHERE m.tenant_id=p_tenant AND m.property_node=p_property AND m.currency='INR'
          AND m.jurisdiction_extension_id=p_extension AND m.jurisdiction_owner_tenant_id IS NULL
          AND m.jurisdiction_key='in-gst-lodging' AND m.jurisdiction_version=p_version
          AND m.jurisdiction_content_hash=p_content_hash AND m.semantic_kind='tax'
          AND m.semantic_code=pg_catalog.upper(v_identities[v_i]);
      IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='exact configured native component-payable route unavailable'; END IF;
      mapping_id:=v_row.id; tx_code:=v_row.code; credit_account_id:=v_row.credit_account_id;
      route_evidence_hash:=v_row.evidence_hash;
    END IF;
    RETURN NEXT;
  END LOOP;
END;
$$;
ALTER FUNCTION public.india_native_component_tax_routes(uuid,uuid,uuid,smallint,text,text,bigint[]) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.india_native_component_tax_routes(uuid,uuid,uuid,smallint,text,text,bigint[])
  FROM PUBLIC,app_role,yellow_runtime;

-- Independent persisted-money verification using the shared rule, not a second
-- preparation or a caller's requested totals. Full rate/history authentication
-- remains the canonical preparation helper's responsibility.
CREATE OR REPLACE FUNCTION public.read_india_native_component_tax_amounts(p_tenant uuid,p_tax uuid)
RETURNS bigint[] LANGUAGE plpgsql VOLATILE
SET search_path=pg_catalog,public SET timezone='UTC' SET datestyle='ISO,YMD' AS $$
DECLARE
  v_tax public.india_gst_accommodation_final_component_tax%ROWTYPE;
  v_valuation public.india_gst_accommodation_final_valuation%ROWTYPE;
  v_night record; v_component record; v_identities text[]; v_sums numeric[];
  v_i integer; v_ordinal integer:=0; v_bps integer; v_count integer;
  v_expected bigint; v_night_total numeric; v_total numeric:=0; v_value numeric:=0;
BEGIN
  SELECT * INTO v_tax FROM public.india_gst_accommodation_final_component_tax t
    WHERE t.tenant_id=p_tenant AND t.id=p_tax AND t.invoice_source_kind='native_current_transaction';
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native component tax root unavailable'; END IF;
  SELECT * INTO v_valuation FROM public.india_gst_accommodation_final_valuation v
    WHERE v.tenant_id=p_tenant AND v.id=v_tax.valuation_id AND v.generation=v_tax.valuation_generation
      AND v.evidence_hash=v_tax.final_valuation_evidence_hash AND v.basis_kind='native_consideration'
      AND v.disposition='ordinary_final' AND v.currency='INR';
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native component tax valuation unavailable'; END IF;
  v_identities:=CASE v_tax.component_family WHEN 'igst' THEN ARRAY['igst']
    WHEN 'cgst_sgst' THEN ARRAY['cgst','sgst'] WHEN 'cgst_utgst' THEN ARRAY['cgst','utgst'] END;
  v_count:=pg_catalog.cardinality(v_identities);
  v_sums:=pg_catalog.array_fill(0::numeric,ARRAY[v_count]);
  FOR v_night IN SELECT n.*,v.business_date AS valuation_date,v.transaction_value_minor AS valuation_amount
      FROM public.india_gst_accommodation_final_component_tax_room_night n
      LEFT JOIN public.india_gst_accommodation_valuation_room_night v
        ON v.tenant_id=n.tenant_id AND v.valuation_id=v_tax.valuation_id AND v.ordinal=n.ordinal
      WHERE n.tenant_id=p_tenant AND n.tax_id=p_tax ORDER BY n.ordinal LOOP
    v_bps:=CASE WHEN v_night.final_value_minor>750000 THEN 1800
      WHEN v_tax.selected_extension_version=1 THEN 1200 ELSE 500 END;
    IF v_night.ordinal<>v_ordinal OR v_night.currency<>'INR'
       OR v_night.business_date IS DISTINCT FROM v_night.valuation_date
       OR v_night.final_value_minor IS DISTINCT FROM v_night.valuation_amount
       OR v_night.aggregate_rate_basis_points<>v_bps
       OR v_night.slab_upto_minor IS DISTINCT FROM (CASE WHEN v_night.final_value_minor<=750000 THEN 750000::bigint ELSE NULL END)
       OR v_night.itc_eligible IS DISTINCT FROM (v_night.final_value_minor>750000 OR v_tax.selected_extension_version=1) THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native component-tax night differs from persisted valuation or admitted rate';
    END IF;
    v_night_total:=0;
    FOR v_i IN 1..v_count LOOP
      SELECT * INTO v_component FROM public.india_gst_accommodation_final_component_tax_component c
        WHERE c.tenant_id=p_tenant AND c.tax_id=p_tax AND c.room_night_ordinal=v_ordinal
          AND c.component_ordinal=v_i-1;
      v_expected:=public.india_native_component_tax_minor(v_night.final_value_minor,v_bps/v_count);
      IF NOT FOUND OR v_component.component_identity<>v_identities[v_i]
         OR v_component.rate_basis_points<>v_bps/v_count OR v_component.currency<>'INR'
         OR v_component.tax_amount_minor<>v_expected THEN
        RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native component amount does not equal canonical integer tax';
      END IF;
      v_sums[v_i]:=v_sums[v_i]+v_expected;
      v_night_total:=v_night_total+v_expected;
    END LOOP;
    IF v_night_total<>v_night.tax_minor::numeric THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native room-night component sum is inconsistent';
    END IF;
    v_total:=v_total+v_night_total; v_value:=v_value+v_night.final_value_minor;
    v_ordinal:=v_ordinal+1;
  END LOOP;
  IF v_ordinal NOT BETWEEN 1 AND 366 OR v_ordinal<>v_valuation.native_room_night_count
     OR (SELECT pg_catalog.count(*) FROM public.india_gst_accommodation_final_component_tax_component c
       WHERE c.tenant_id=p_tenant AND c.tax_id=p_tax)<>v_ordinal*v_count
     OR v_value<>v_valuation.transaction_value_minor::numeric OR v_value<>v_tax.transaction_value_minor::numeric
     OR v_total<>v_tax.tax_minor::numeric OR v_value+v_total<>v_tax.grand_total_minor::numeric THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native component-tax aggregate is incomplete or does not conserve';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_catalog.unnest(v_sums) a WHERE a NOT BETWEEN 0 AND 9223372036854775807::numeric) THEN
    RAISE EXCEPTION USING ERRCODE='22003',MESSAGE='native component aggregate exceeds signed int64';
  END IF;
  RETURN v_sums::bigint[];
END;
$$;
ALTER FUNCTION public.read_india_native_component_tax_amounts(uuid,uuid) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.read_india_native_component_tax_amounts(uuid,uuid) FROM PUBLIC,app_role,yellow_runtime;

-- Complete actual header/line evidence; NULL is the only zero-tax journal graph.
CREATE OR REPLACE FUNCTION public.india_native_accounting_journal_graph(p_tenant uuid,p_journal uuid)
RETURNS jsonb LANGUAGE sql VOLATILE SET search_path=pg_catalog,public
SET timezone='UTC' SET datestyle='ISO,YMD' AS $$
  SELECT CASE WHEN p_journal IS NULL THEN 'null'::jsonb ELSE (
    SELECT pg_catalog.jsonb_build_object('journal',pg_catalog.to_jsonb(j),'lines',
      (SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(l) ORDER BY l.seq)
       FROM public.posting_line l WHERE l.tenant_id=j.tenant_id AND l.journal_id=j.id))
    FROM public.journal j WHERE j.tenant_id=p_tenant AND j.id=p_journal) END
$$;
ALTER FUNCTION public.india_native_accounting_journal_graph(uuid,uuid) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.india_native_accounting_journal_graph(uuid,uuid) FROM PUBLIC,app_role,yellow_runtime;

-- Durable verification does not require a retained outbox row, an open folio,
-- or today's route configuration. It verifies the immutable financial graph
-- initially admitted by the authenticator, including exact component pairs.
CREATE OR REPLACE FUNCTION public.assert_india_native_accounting_binding(p_tenant uuid,p_binding uuid)
RETURNS void LANGUAGE plpgsql VOLATILE SET search_path=pg_catalog,public
SET timezone='UTC' SET datestyle='ISO,YMD' AS $$
DECLARE
  v_binding public.india_gst_accommodation_final_component_tax_journal_binding%ROWTYPE;
  v_timing public.india_gst_native_invoice_timing%ROWTYPE;
  v_journal public.journal%ROWTYPE; v_debit public.posting_line%ROWTYPE; v_credit public.posting_line%ROWTYPE;
  v_amounts bigint[]; v_i integer; v_seq integer:=1; v_closure jsonb; v_graph jsonb;
BEGIN
  SELECT * INTO v_binding FROM public.india_gst_accommodation_final_component_tax_journal_binding b
    WHERE b.tenant_id=p_tenant AND b.id=p_binding AND b.accounting_kind='native_component_tax_delta';
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native accounting binding unavailable'; END IF;
  SELECT * INTO v_timing FROM public.india_gst_native_invoice_timing n
    WHERE n.tenant_id=p_tenant AND n.id=v_binding.native_timing_id AND n.accounting_binding_id=p_binding;
  IF NOT FOUND OR v_binding.native_source_basis_hash IS DISTINCT FROM v_timing.native_source_basis_hash
     OR v_binding.request_event_seq IS DISTINCT FROM v_timing.request_event_seq
     OR v_binding.request_event_id IS DISTINCT FROM v_timing.request_event_id
     OR v_binding.request_event_payload_hash IS DISTINCT FROM v_timing.request_event_payload_hash THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native accounting binding preparation/event identity is inconsistent';
  END IF;
  v_amounts:=public.read_india_native_component_tax_amounts(p_tenant,v_binding.tax_id);
  v_closure:=public.read_india_native_valuation_source_closure(p_tenant,v_binding.property_node,
    v_binding.reservation_id,v_binding.folio_id,v_binding.valuation_id);
  v_graph:=public.india_native_accounting_journal_graph(p_tenant,v_binding.journal_id);
  IF v_binding.native_tax_minor>0 THEN
    SELECT * INTO v_journal FROM public.journal j WHERE j.tenant_id=p_tenant AND j.id=v_binding.journal_id;
    IF NOT FOUND OR v_journal.kind<>'charge' OR v_journal.reverses IS NOT NULL
       OR v_journal.property_node<>v_binding.property_node OR v_journal.currency<>'INR'
       OR v_journal.business_date<>v_binding.business_date OR v_journal.created_by IS DISTINCT FROM v_binding.posted_by
       OR v_journal.created_at<>v_timing.transaction_timestamp
       OR v_journal.source<>pg_catalog.jsonb_build_object('interface','financials.india-native-component-tax.post',
         'native_timing_id',v_timing.id::text,'tax_id',v_binding.tax_id::text,'request_event_id',v_binding.request_event_id::text) THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native component journal header is inconsistent';
    END IF;
    FOR v_i IN 1..pg_catalog.cardinality(v_amounts) LOOP
      IF v_amounts[v_i]=0 THEN CONTINUE; END IF;
      SELECT * INTO v_debit FROM public.posting_line l
        WHERE l.tenant_id=p_tenant AND l.journal_id=v_journal.id AND l.seq=v_seq;
      IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native component guest debit is missing'; END IF;
      SELECT * INTO v_credit FROM public.posting_line l
        WHERE l.tenant_id=p_tenant AND l.journal_id=v_journal.id AND l.seq=v_seq+1;
      IF NOT FOUND OR v_debit.account_id<>v_binding.guest_account_id
         OR v_debit.folio_id IS DISTINCT FROM v_binding.folio_id OR v_credit.folio_id IS NOT NULL
         OR v_debit.amount_minor<>v_amounts[v_i] OR v_credit.amount_minor<>-v_amounts[v_i]
         OR v_credit.tx_code<>v_debit.tx_code OR v_credit.description IS DISTINCT FROM v_debit.description
         OR v_debit.currency<>'INR' OR v_credit.currency<>'INR'
         OR v_debit.business_date<>v_binding.business_date OR v_credit.business_date<>v_binding.business_date
         OR v_debit.quantity<>1.000::numeric(10,3) OR v_credit.quantity<>1.000::numeric(10,3)
         OR v_debit.tax_detail IS NOT NULL OR v_credit.tax_detail IS NOT NULL
         OR v_debit.folio_transfer_root_line_id IS NOT NULL OR v_credit.folio_transfer_root_line_id IS NOT NULL
         OR NOT EXISTS(SELECT 1 FROM public.tx_code c WHERE c.code=v_debit.tx_code AND c.grp='tax')
         OR NOT EXISTS(SELECT 1 FROM public.account a WHERE a.tenant_id=p_tenant AND a.id=v_credit.account_id
           AND a.role='tax_payable' AND a.property_node=v_binding.property_node AND a.currency='INR') THEN
        RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native component journal does not contain exact balanced tax-only pairs';
      END IF;
      v_seq:=v_seq+2;
    END LOOP;
    IF (SELECT pg_catalog.count(*) FROM public.posting_line l
      WHERE l.tenant_id=p_tenant AND l.journal_id=v_journal.id)<>v_seq-1 THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native component journal contains an unexpected line';
    END IF;
  ELSIF v_binding.journal_id IS NOT NULL OR EXISTS(SELECT 1 FROM pg_catalog.unnest(v_amounts) a WHERE a<>0) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native zero-tax binding has a journal or nonzero component';
  END IF;
  IF v_graph IS NULL OR v_binding.evidence_hash IS DISTINCT FROM public.india_native_source_hash(
      pg_catalog.jsonb_build_array('india-native-accounting-binding-v1',
        pg_catalog.to_jsonb(v_binding)-'evidence_hash',v_closure,v_graph)) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native accounting binding canonical graph hash is inconsistent';
  END IF;
END;
$$;
ALTER FUNCTION public.assert_india_native_accounting_binding(uuid,uuid) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.assert_india_native_accounting_binding(uuid,uuid) FROM PUBLIC,app_role,yellow_runtime;

-- Read-only Financials bridge. Rebuild the complete historical/current source
-- graph instead of treating a stored fragment hash as proof of present closure.
-- This authenticates accounting, not statutory preparation or issuance authority.
-- Keep EXECUTE withheld until the complete native prepare/commit candidate lands.
CREATE OR REPLACE FUNCTION public.read_india_native_accounting_source_closure(
  p_tenant uuid,p_binding uuid
) RETURNS TABLE(posting_binding_id uuid,accounting_evidence_hash text,source_closure jsonb)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,public SET timezone='UTC' SET datestyle='ISO,YMD' AS $$
DECLARE
  v_context uuid;
  v_binding public.india_gst_accommodation_final_component_tax_journal_binding%ROWTYPE;
BEGIN
  BEGIN
    v_context:=NULLIF(pg_catalog.current_setting('app.tenant_id',true),'')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='native accounting source tenant context is invalid';
  END;
  IF p_tenant IS NULL OR p_binding IS NULL OR p_tenant IS DISTINCT FROM v_context THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='native accounting source requires exact tenant context and binding';
  END IF;
  SELECT b.* INTO v_binding FROM public.india_gst_accommodation_final_component_tax_journal_binding b
    WHERE b.tenant_id=p_tenant AND b.id=p_binding AND b.accounting_kind='native_component_tax_delta';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native accounting source binding unavailable';
  END IF;
  PERFORM public.assert_india_native_accounting_binding(p_tenant,p_binding);
  posting_binding_id:=v_binding.id;
  accounting_evidence_hash:=v_binding.evidence_hash;
  source_closure:=public.read_india_native_valuation_source_closure(p_tenant,
    v_binding.property_node,v_binding.reservation_id,v_binding.folio_id,v_binding.valuation_id);
  RETURN NEXT;
END;
$$;
ALTER FUNCTION public.read_india_native_accounting_source_closure(uuid,uuid) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.read_india_native_accounting_source_closure(uuid,uuid)
  FROM PUBLIC,app_role,yellow_runtime;

CREATE OR REPLACE FUNCTION public.assert_india_native_accounting_request(p_tenant uuid,p_timing uuid)
RETURNS void LANGUAGE plpgsql VOLATILE SET search_path=pg_catalog,public
SET timezone='UTC' SET datestyle='ISO,YMD' AS $$
DECLARE v_timing public.india_gst_native_invoice_timing%ROWTYPE;
  v_event public.outbox%ROWTYPE; v_count bigint; v_payload jsonb;
BEGIN
  SELECT * INTO v_timing FROM public.india_gst_native_invoice_timing n WHERE n.tenant_id=p_tenant AND n.id=p_timing;
  IF NOT FOUND OR v_timing.issuing_transaction_id IS DISTINCT FROM pg_catalog.pg_current_xact_id()
     OR v_timing.transaction_timestamp IS DISTINCT FROM pg_catalog.transaction_timestamp() THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native accounting request requires its actual preparing transaction';
  END IF;
  SELECT pg_catalog.count(*) INTO v_count FROM public.outbox e
    WHERE e.tenant_id=p_tenant AND e.id=v_timing.request_event_id;
  SELECT * INTO v_event FROM public.outbox e
    WHERE e.tenant_id=p_tenant AND e.seq=v_timing.request_event_seq AND e.id=v_timing.request_event_id;
  v_payload:=pg_catalog.jsonb_build_object('nativeTimingId',v_timing.id::text,
    'documentId',v_timing.prospective_document_id::text,'taxId',v_timing.tax_id::text,
    'applicabilityId',v_timing.applicability_id::text,'valuationId',v_timing.valuation_id::text,
    'reservationId',v_timing.reservation_id::text,'folioId',v_timing.folio_id::text,
    'sourceBasisHash',v_timing.native_source_basis_hash);
  IF v_count<>1 OR v_event.seq IS NULL OR v_event.event_type<>'india_gst.native_accommodation_accounting_requested'
     OR v_event.event_version<>1 OR v_event.aggregate_type<>'india_gst_native_invoice_timing'
     OR v_event.aggregate_id<>v_timing.id OR v_event.actor_id IS DISTINCT FROM v_timing.actor_id
     OR v_event.property_node IS DISTINCT FROM v_timing.property_node OR v_event.business_date<>v_timing.invoice_issue_date
     OR v_event.correlation_id<>v_timing.request_id OR v_event.created_at<>v_timing.transaction_timestamp
     OR v_event.payload<>v_payload
     OR public.india_native_source_hash(v_event.payload)<>v_timing.request_event_payload_hash THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native accounting request event is not the exact prepared event';
  END IF;
END;
$$;
ALTER FUNCTION public.assert_india_native_accounting_request(uuid,uuid) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.assert_india_native_accounting_request(uuid,uuid) FROM PUBLIC,app_role,yellow_runtime;

CREATE OR REPLACE FUNCTION public.consume_india_native_fiscal_accounting_event(p_tenant uuid,p_event uuid)
RETURNS TABLE(posting_binding_id uuid,native_timing_id uuid,tax_id uuid,valuation_id uuid,
  applicability_id uuid,reservation_id uuid,folio_id uuid,journal_id uuid,currency character(3),
  business_date date,evidence_hash text,created boolean)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,public SET timezone='UTC' SET datestyle='ISO,YMD' AS $$
DECLARE
  v_context uuid; v_key bigint;
  v_timing public.india_gst_native_invoice_timing%ROWTYPE;
  v_tax public.india_gst_accommodation_final_component_tax%ROWTYPE;
  v_app public.india_gst_accommodation_quoted_rate_applicability%ROWTYPE;
  v_binding public.india_gst_accommodation_final_component_tax_journal_binding%ROWTYPE;
  v_route record;
  v_bound_payload jsonb; v_journal_payload jsonb;
  v_amounts bigint[]; v_routes jsonb; v_route_hash text; v_closure jsonb; v_journal_graph jsonb;
  v_journal uuid; v_seq integer:=1; v_description text; v_lines jsonb;
BEGIN
  IF session_user<>'yellow_runtime' OR current_user<>'yellow_owner'
     OR pg_catalog.current_setting('role',true) IS DISTINCT FROM 'app_role' THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='native accounting requires the governed runtime app role';
  END IF;
  BEGIN v_context:=NULLIF(pg_catalog.current_setting('app.tenant_id',true),'')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='native accounting tenant context is invalid';
  END;
  IF p_tenant IS NULL OR v_context IS NULL OR p_tenant<>v_context THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='native accounting tenant context is invalid';
  END IF;
  IF p_event IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='native accounting event identity is required'; END IF;
  PERFORM 1 FROM public.tenant t WHERE t.id=p_tenant AND t.status='active';
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native accounting tenant is unavailable'; END IF;
  -- Permanent preparation identity is unique even though outbox UUID is not.
  SELECT * INTO v_timing FROM public.india_gst_native_invoice_timing n
    WHERE n.tenant_id=p_tenant AND n.request_event_id=p_event;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native accounting preparation is unavailable'; END IF;
  SELECT * INTO v_binding FROM public.india_gst_accommodation_final_component_tax_journal_binding b
    WHERE b.tenant_id=p_tenant AND b.native_timing_id=v_timing.id;
  IF FOUND THEN
    IF v_binding.id<>v_timing.accounting_binding_id OR v_binding.request_event_id<>p_event THEN
      RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='native preparation has a divergent accounting effect';
    END IF;
    IF v_timing.issuing_transaction_id=pg_catalog.pg_current_xact_id() THEN
      PERFORM public.assert_india_native_accounting_request(p_tenant,v_timing.id);
      -- REAL dependency supplied by the preparation fragment, never a stub.
      PERFORM public.assert_india_native_preparation_authenticity(p_tenant,v_timing.id);
    ELSIF NOT EXISTS(SELECT 1 FROM public.india_gst_native_fiscal_document_origin o
        JOIN public.document d ON d.tenant_id=o.tenant_id AND d.id=o.document_id
        WHERE o.tenant_id=p_tenant AND o.native_timing_id=v_timing.id
          AND o.native_accounting_binding_id=v_binding.id AND o.document_id=v_timing.prospective_document_id
          AND o.source_kind='native_current_transaction_graph' AND o.source_version=2
          AND o.source_journal_id IS NOT DISTINCT FROM v_binding.journal_id
          AND o.native_source_basis_hash=v_timing.native_source_basis_hash
          AND d.kind='invoice' AND d.status='issued' AND d.business_date=v_timing.invoice_issue_date
          AND d.issued_at=v_timing.transaction_timestamp) THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native accounting replay lacks a completed immutable origin';
    END IF;
    PERFORM public.assert_india_native_accounting_binding(p_tenant,v_binding.id);
    RETURN QUERY SELECT v_binding.id,v_binding.native_timing_id,v_binding.tax_id,v_binding.valuation_id,
      v_binding.applicability_id,v_binding.reservation_id,v_binding.folio_id,v_binding.journal_id,
      v_binding.currency,v_binding.business_date,v_binding.evidence_hash,false;
    RETURN;
  END IF;
  IF v_timing.issuing_transaction_id IS DISTINCT FROM pg_catalog.pg_current_xact_id()
     OR v_timing.transaction_timestamp IS DISTINCT FROM pg_catalog.transaction_timestamp() THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='unbound native accounting requires the actual preparing transaction';
  END IF;
  -- These are all already-owned preparation keys. No acquisition occurs here;
  -- account/folio/source/day/series row locks are the preparation's prior prefix.
  FOREACH v_key IN ARRAY ARRAY[
    6441674055002974568::bigint,
    pg_catalog.hashtextextended(p_tenant::text||v_timing.reservation_id::text||v_timing.folio_id::text,0),
    pg_catalog.hashtextextended('india-quoted-applicability:'||p_tenant::text||':'||v_timing.reservation_id::text||':'||v_timing.folio_id::text,400),
    pg_catalog.hashtextextended('india-final-component-tax:'||p_tenant::text||':'||v_timing.reservation_id::text||':'||v_timing.folio_id::text,367),
    pg_catalog.hashtextextended('india-native-fiscal-invoice:'||p_tenant::text||':'||v_timing.reservation_id::text||':'||v_timing.folio_id::text,430),
    pg_catalog.hashtextextended('india-native-fiscal-idempotency:'||p_tenant::text||':'||v_timing.request_key_hash,430),
    pg_catalog.hashtextextended('india-final-component-tax-journal-binding:'||p_tenant::text||':'||v_timing.tax_id::text,407)
  ] LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_locks l WHERE l.pid=pg_catalog.pg_backend_pid()
        AND l.locktype='advisory' AND l.granted AND l.mode='ExclusiveLock' AND l.objsubid=1
        AND l.classid=((v_key>>32)&4294967295)::oid AND l.objid=(v_key&4294967295)::oid) THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native accounting requires the already-held preparation/publication lock prefix';
    END IF;
  END LOOP;
  PERFORM public.assert_india_native_accounting_request(p_tenant,v_timing.id);
  -- Pending REAL prerequisite: authenticate complete native source/timing/rate/
  -- valuation/approval/tax/basis preimages and current issuer authority. Neither
  -- event existence nor matching hash columns substitute for that reconstruction.
  PERFORM public.assert_india_native_preparation_authenticity(p_tenant,v_timing.id);
  SELECT * INTO STRICT v_tax FROM public.india_gst_accommodation_final_component_tax t
    WHERE t.tenant_id=p_tenant AND t.id=v_timing.tax_id AND t.native_timing_id=v_timing.id;
  SELECT * INTO STRICT v_app FROM public.india_gst_accommodation_quoted_rate_applicability a
    WHERE a.tenant_id=p_tenant AND a.id=v_timing.applicability_id AND a.native_timing_id=v_timing.id;
  v_closure:=public.read_india_native_valuation_source_closure(p_tenant,v_timing.property_node,
    v_timing.reservation_id,v_timing.folio_id,v_timing.valuation_id);
  v_amounts:=public.read_india_native_component_tax_amounts(p_tenant,v_tax.id);
  SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(r) ORDER BY r.component_ordinal) INTO v_routes
    FROM public.india_native_component_tax_routes(p_tenant,v_timing.property_node,
      v_tax.selected_extension_id,v_tax.selected_extension_version,v_app.selected_content_hash,
      v_tax.component_family,v_amounts) r;
  v_route_hash:=public.india_native_source_hash(pg_catalog.jsonb_build_array('india-native-component-routes-v1',v_routes));
  PERFORM 1 FROM public.folio f JOIN public.account a ON a.tenant_id=f.tenant_id AND a.id=f.account_id
    WHERE f.tenant_id=p_tenant AND f.id=v_timing.folio_id AND f.reservation_id=v_timing.reservation_id
      AND f.account_id=v_timing.folio_account_id AND f.window_no=v_timing.window_no AND f.status='open'
      AND a.role='guest' AND a.status='open' AND a.property_node=v_timing.property_node AND a.currency='INR';
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native accounting guest folio is unavailable'; END IF;
  PERFORM 1 FROM public.business_day d WHERE d.tenant_id=p_tenant AND d.property_node=v_timing.property_node
    AND d.business_date=v_timing.invoice_issue_date AND d.sealed_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0011',MESSAGE='native accounting day is missing or sealed'; END IF;
  IF v_tax.tax_minor>0 THEN
    v_journal:=pg_catalog.gen_random_uuid();
    INSERT INTO public.journal(id,tenant_id,property_node,business_date,kind,description,currency,source,created_by,created_at)
      VALUES(v_journal,p_tenant,v_timing.property_node,v_timing.invoice_issue_date,'charge',
        'India native accommodation component tax','INR',pg_catalog.jsonb_build_object(
          'interface','financials.india-native-component-tax.post','native_timing_id',v_timing.id::text,
          'tax_id',v_tax.id::text,'request_event_id',p_event::text),v_timing.actor_id,v_timing.transaction_timestamp);
    FOR v_route IN SELECT * FROM pg_catalog.jsonb_to_recordset(v_routes) AS r(
        component_ordinal smallint,component_identity text,amount_minor bigint,mapping_id uuid,
        tx_code text,credit_account_id uuid,route_evidence_hash text) ORDER BY r.component_ordinal LOOP
      IF v_route.amount_minor=0 THEN CONTINUE; END IF;
      v_description:=pg_catalog.upper(v_route.component_identity)||' on accommodation';
      INSERT INTO public.posting_line(tenant_id,journal_id,seq,account_id,folio_id,tx_code,description,
        amount_minor,quantity,tax_detail,business_date,currency)
      VALUES(p_tenant,v_journal,v_seq::smallint,v_timing.folio_account_id,v_timing.folio_id,
        v_route.tx_code,v_description,v_route.amount_minor,1.000::numeric(10,3),NULL,v_timing.invoice_issue_date,'INR'),
        (p_tenant,v_journal,(v_seq+1)::smallint,v_route.credit_account_id,NULL,
        v_route.tx_code,v_description,-v_route.amount_minor,1.000::numeric(10,3),NULL,v_timing.invoice_issue_date,'INR');
      v_seq:=v_seq+2;
    END LOOP;
  END IF;
  -- Populate the typed row before hashing it; there is no temporary hash or UPDATE.
  v_binding.tenant_id:=p_tenant; v_binding.id:=v_timing.accounting_binding_id;
  v_binding.property_node:=v_timing.property_node; v_binding.posted_by:=v_timing.actor_id;
  v_binding.tax_id:=v_tax.id; v_binding.tax_generation:=v_tax.generation; v_binding.tax_evidence_hash:=v_tax.evidence_hash;
  v_binding.valuation_id:=v_timing.valuation_id; v_binding.valuation_generation:=v_timing.valuation_generation;
  v_binding.applicability_id:=v_timing.applicability_id; v_binding.reservation_id:=v_timing.reservation_id;
  v_binding.folio_id:=v_timing.folio_id; v_binding.guest_account_id:=v_timing.folio_account_id;
  v_binding.journal_id:=v_journal; v_binding.currency:='INR'; v_binding.business_date:=v_timing.invoice_issue_date;
  v_binding.posted_at:=v_timing.transaction_timestamp; v_binding.accounting_kind:='native_component_tax_delta';
  v_binding.invoice_source_kind:='native_current_transaction'; v_binding.native_timing_id:=v_timing.id;
  v_binding.native_source_basis_hash:=v_timing.native_source_basis_hash;
  v_binding.native_consideration_basis_hash:=v_timing.native_consideration_basis_hash;
  v_binding.native_tax_minor:=v_tax.tax_minor; v_binding.request_event_seq:=v_timing.request_event_seq;
  v_binding.request_event_id:=p_event; v_binding.request_event_payload_hash:=v_timing.request_event_payload_hash;
  v_binding.native_route_evidence_hash:=v_route_hash;
  v_journal_graph:=public.india_native_accounting_journal_graph(p_tenant,v_journal);
  v_binding.evidence_hash:=public.india_native_source_hash(pg_catalog.jsonb_build_array(
    'india-native-accounting-binding-v1',pg_catalog.to_jsonb(v_binding)-'evidence_hash',v_closure,v_journal_graph));
  INSERT INTO public.india_gst_accommodation_final_component_tax_journal_binding SELECT (v_binding).*;
  PERFORM public.assert_india_native_accounting_binding(p_tenant,v_binding.id);
  v_bound_payload:=pg_catalog.jsonb_build_object('bindingId',v_binding.id::text,'nativeTimingId',v_timing.id::text,
    'taxId',v_tax.id::text,'valuationId',v_timing.valuation_id::text,'reservationId',v_timing.reservation_id::text,
    'folioId',v_timing.folio_id::text,'journalId',v_journal,'evidenceHash',v_binding.evidence_hash);
  INSERT INTO public.fact_log(tenant_id,entity_type,entity_id,fact_type,valid_from,business_date,actor_id,payload)
    VALUES(p_tenant,'india_gst_accommodation_final_component_tax_journal_binding',v_binding.id,
      'india_gst.native_accommodation_accounting_bound',v_timing.transaction_timestamp,
      v_timing.invoice_issue_date,v_timing.actor_id,v_bound_payload);
  -- Already-held D99 is reused immediately before this publisher's first event.
  PERFORM pg_catalog.pg_advisory_xact_lock(6441674055002974568::bigint);
  INSERT INTO public.outbox(tenant_id,property_node,business_date,aggregate_type,aggregate_id,event_type,
    event_version,actor_id,correlation_id,causation_id,payload)
    VALUES(p_tenant,v_timing.property_node,v_timing.invoice_issue_date,
      'india_gst_accommodation_final_component_tax_journal_binding',v_binding.id,
      'india_gst.native_accommodation_accounting_bound',1,v_timing.actor_id,v_timing.request_id,p_event,v_bound_payload);
  IF v_journal IS NOT NULL THEN
    SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('account',l.account_id::text,
        'tx_code',l.tx_code,'amount_minor',l.amount_minor::text)
        || CASE WHEN l.folio_id IS NULL THEN '{}'::jsonb ELSE pg_catalog.jsonb_build_object('folio',l.folio_id::text) END
        ORDER BY l.seq) INTO v_lines FROM public.posting_line l WHERE l.tenant_id=p_tenant AND l.journal_id=v_journal;
    v_journal_payload:=pg_catalog.jsonb_build_object('kind','charge','lines',v_lines);
    INSERT INTO public.fact_log(tenant_id,entity_type,entity_id,fact_type,valid_from,business_date,actor_id,payload)
      VALUES(p_tenant,'journal',v_journal,'journal.posted',v_timing.transaction_timestamp,
        v_timing.invoice_issue_date,v_timing.actor_id,v_journal_payload);
    INSERT INTO public.outbox(tenant_id,property_node,business_date,aggregate_type,aggregate_id,event_type,
      event_version,actor_id,correlation_id,causation_id,payload)
      VALUES(p_tenant,v_timing.property_node,v_timing.invoice_issue_date,'journal',v_journal,'journal.posted',
        1,v_timing.actor_id,v_timing.request_id,p_event,v_journal_payload);
  END IF;
  RETURN QUERY SELECT v_binding.id,v_binding.native_timing_id,v_binding.tax_id,v_binding.valuation_id,
    v_binding.applicability_id,v_binding.reservation_id,v_binding.folio_id,v_binding.journal_id,
    v_binding.currency,v_binding.business_date,v_binding.evidence_hash,true;
END;
$$;
ALTER FUNCTION public.consume_india_native_fiscal_accounting_event(uuid,uuid) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.consume_india_native_fiscal_accounting_event(uuid,uuid) FROM PUBLIC,app_role,yellow_runtime;
-- app_role EXECUTE is deliberately withheld until the assembled 0076 has the
-- real authenticator, prepare/commit, financial guards and executable acceptance.

-- Permanent consumed-source protection. These predicates inspect immutable typed
-- origins and bindings, not event retention or the existence of a tax journal.
-- A zero-tax native invoice therefore protects the same consideration ancestry.
CREATE OR REPLACE FUNCTION public.india_native_root_is_consumed(p_tenant uuid,p_root uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER
SET search_path=pg_catalog,public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.india_gst_native_fiscal_document_origin o
    JOIN public.india_gst_accommodation_final_component_tax_journal_binding b
      ON b.tenant_id=o.tenant_id AND b.id=o.native_accounting_binding_id
      AND b.native_timing_id=o.native_timing_id
    JOIN public.india_gst_accommodation_valuation_source s
      ON s.tenant_id=b.tenant_id AND s.valuation_id=b.valuation_id
    WHERE o.tenant_id=p_tenant AND o.source_kind='native_current_transaction_graph'
      AND s.posting_root_id=p_root
  )
$$;
ALTER FUNCTION public.india_native_root_is_consumed(uuid,uuid) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.india_native_root_is_consumed(uuid,uuid) FROM PUBLIC,app_role,yellow_runtime;

CREATE OR REPLACE FUNCTION public.india_native_journal_is_consumed(p_tenant uuid,p_journal uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER
SET search_path=pg_catalog,public
AS $$
  SELECT EXISTS (
    -- Preserve the original0074 protection for already issued legacy origins.
    SELECT 1 FROM public.india_gst_native_fiscal_document_origin o
    WHERE o.tenant_id=p_tenant AND o.source_journal_id=p_journal
  ) OR EXISTS (
    SELECT 1 FROM public.india_gst_native_fiscal_document_origin o
    JOIN public.india_gst_accommodation_final_component_tax_journal_binding b
      ON b.tenant_id=o.tenant_id AND b.id=o.native_accounting_binding_id
      AND b.native_timing_id=o.native_timing_id
    JOIN public.india_gst_accommodation_valuation_source s
      ON s.tenant_id=b.tenant_id AND s.valuation_id=b.valuation_id
    JOIN public.posting_line fragment ON fragment.tenant_id=s.tenant_id
      AND COALESCE(fragment.folio_transfer_root_line_id,fragment.id)=s.posting_root_id
    WHERE o.tenant_id=p_tenant AND o.source_kind='native_current_transaction_graph'
      AND fragment.journal_id=p_journal
  )
$$;
ALTER FUNCTION public.india_native_journal_is_consumed(uuid,uuid) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.india_native_journal_is_consumed(uuid,uuid) FROM PUBLIC,app_role,yellow_runtime;

CREATE OR REPLACE FUNCTION public.guard_india_native_consumed_journal()
RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,public
AS $$
DECLARE v_previous_tenant text:=pg_catalog.current_setting('app.tenant_id',true);
BEGIN
  IF NEW.reverses IS NULL THEN RETURN NEW; END IF;
  PERFORM pg_catalog.set_config('app.tenant_id',NEW.tenant_id::text,true);
  -- Ordinary correction writers already hold these guest coordination rows.
  -- Acquire no revenue accounts, sibling folios, day, series or publication lock.
  PERFORM 1 FROM public.account a
    WHERE a.tenant_id=NEW.tenant_id AND a.role='guest' AND EXISTS (
      SELECT 1 FROM public.posting_line l WHERE l.tenant_id=a.tenant_id
        AND l.account_id=a.id AND l.journal_id=NEW.reverses)
    ORDER BY a.id FOR UPDATE OF a;
  IF public.india_native_journal_is_consumed(NEW.tenant_id,NEW.reverses) THEN
    RAISE EXCEPTION USING ERRCODE='55000',
      MESSAGE='issued India native fiscal consideration requires a numbered correction document';
  END IF;
  PERFORM pg_catalog.set_config('app.tenant_id',v_previous_tenant,true);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_catalog.set_config('app.tenant_id',v_previous_tenant,true);
  RAISE;
END;
$$;
ALTER FUNCTION public.guard_india_native_consumed_journal() OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.guard_india_native_consumed_journal() FROM PUBLIC,app_role,yellow_runtime;
CREATE OR REPLACE TRIGGER india_native_consumed_journal_guard
  BEFORE INSERT ON public.journal
  FOR EACH ROW EXECUTE FUNCTION public.guard_india_native_consumed_journal();

CREATE OR REPLACE FUNCTION public.guard_india_native_consumed_posting_line()
RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,public
AS $$
DECLARE
  v_previous_tenant text:=pg_catalog.current_setting('app.tenant_id',true);
  v_root uuid:=COALESCE(NEW.folio_transfer_root_line_id,NEW.id);
  v_root_group text; v_line_group text;
BEGIN
  PERFORM pg_catalog.set_config('app.tenant_id',NEW.tenant_id::text,true);
  -- Only guest coordination roots: the new line's own account, its immutable
  -- transfer root, or the guest side of the journal being appended. Governed
  -- charge/correction/transfer/settlement writers already lock these accounts.
  PERFORM 1 FROM public.account a WHERE a.tenant_id=NEW.tenant_id AND a.role='guest'
    AND (a.id=NEW.account_id OR EXISTS (
      SELECT 1 FROM public.posting_line l WHERE l.tenant_id=a.tenant_id
        AND l.account_id=a.id AND (l.id=v_root OR l.journal_id=NEW.journal_id)))
    ORDER BY a.id FOR UPDATE OF a;
  IF public.india_native_journal_is_consumed(NEW.tenant_id,NEW.journal_id)
     OR public.india_native_root_is_consumed(NEW.tenant_id,v_root) THEN
    RAISE EXCEPTION USING ERRCODE='55000',
      MESSAGE='issued India native fiscal posting ancestry is immutable';
  END IF;
  SELECT c.grp INTO v_line_group FROM public.tx_code c WHERE c.code=NEW.tx_code;
  IF NEW.folio_transfer_root_line_id IS NOT NULL THEN
    SELECT c.grp INTO v_root_group FROM public.posting_line r
      JOIN public.tx_code c ON c.code=r.tx_code
      WHERE r.tenant_id=NEW.tenant_id AND r.id=v_root;
  END IF;
  -- Incoming transfers carry the original revenue/adjustment classification.
  -- Payments, settlements and DIRECT_BILL (transfer without a revenue root)
  -- remain permitted; this is deliberately not a ban on all folio postings.
  IF NEW.folio_id IS NOT NULL
     AND COALESCE(v_root_group,v_line_group) IN ('revenue','adjustment')
     AND EXISTS (SELECT 1 FROM public.india_gst_native_fiscal_document_origin o
       WHERE o.tenant_id=NEW.tenant_id AND o.folio_id=NEW.folio_id
         AND o.source_kind='native_current_transaction_graph') THEN
    RAISE EXCEPTION USING ERRCODE='55000',
      MESSAGE='issued India native fiscal folio consideration requires a numbered correction document';
  END IF;
  PERFORM pg_catalog.set_config('app.tenant_id',v_previous_tenant,true);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_catalog.set_config('app.tenant_id',v_previous_tenant,true);
  RAISE;
END;
$$;
ALTER FUNCTION public.guard_india_native_consumed_posting_line() OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.guard_india_native_consumed_posting_line() FROM PUBLIC,app_role,yellow_runtime;
CREATE OR REPLACE TRIGGER india_native_consumed_posting_line_guard
  BEFORE INSERT ON public.posting_line
  FOR EACH ROW EXECUTE FUNCTION public.guard_india_native_consumed_posting_line();

CREATE OR REPLACE FUNCTION public.guard_india_native_consumed_fiscal_source()
RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,public
AS $$
DECLARE
  v_previous_tenant text:=pg_catalog.current_setting('app.tenant_id',true);
  v_reservation uuid; v_folio uuid;
BEGIN
  PERFORM pg_catalog.set_config('app.tenant_id',NEW.tenant_id::text,true);
  IF TG_TABLE_NAME IN ('india_gst_accommodation_final_valuation',
      'india_gst_accommodation_quoted_rate_applicability',
      'india_gst_accommodation_final_component_tax') THEN
    v_reservation:=NEW.reservation_id; v_folio:=NEW.folio_id;
  ELSIF TG_TABLE_NAME IN ('india_gst_accommodation_valuation_source',
      'india_gst_accommodation_valuation_room_night','india_gst_accommodation_valuation_allocation') THEN
    SELECT v.reservation_id,v.folio_id INTO v_reservation,v_folio
      FROM public.india_gst_accommodation_final_valuation v
      WHERE v.tenant_id=NEW.tenant_id AND v.id=NEW.valuation_id;
  ELSIF TG_TABLE_NAME IN ('india_gst_accommodation_final_component_tax_room_night',
      'india_gst_accommodation_final_component_tax_component') THEN
    SELECT t.reservation_id,t.folio_id INTO v_reservation,v_folio
      FROM public.india_gst_accommodation_final_component_tax t
      WHERE t.tenant_id=NEW.tenant_id AND t.id=NEW.tax_id;
  ELSE
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native source guard has an unsupported attachment';
  END IF;
  IF v_reservation IS NULL OR v_folio IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='23503',MESSAGE='native source guard parent scope is unavailable';
  END IF;
  -- Existing aggregate writers already hold scope0. Child guards must not add
  -- financial locks after publication or silently permit post-issue appends.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    NEW.tenant_id::text||v_reservation::text||v_folio::text,0));
  IF EXISTS (SELECT 1 FROM public.india_gst_native_fiscal_document_origin o
    WHERE o.tenant_id=NEW.tenant_id AND o.folio_id=v_folio
      AND o.source_kind='native_current_transaction_graph') THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='issued India native fiscal source generations and children are immutable';
  END IF;
  PERFORM pg_catalog.set_config('app.tenant_id',v_previous_tenant,true);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_catalog.set_config('app.tenant_id',v_previous_tenant,true);
  RAISE;
END;
$$;
ALTER FUNCTION public.guard_india_native_consumed_fiscal_source() OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.guard_india_native_consumed_fiscal_source() FROM PUBLIC,app_role,yellow_runtime;
DO $native_consumed_source_guards$
DECLARE v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'india_gst_accommodation_final_valuation','india_gst_accommodation_valuation_source',
    'india_gst_accommodation_valuation_room_night','india_gst_accommodation_valuation_allocation',
    'india_gst_accommodation_quoted_rate_applicability','india_gst_accommodation_final_component_tax',
    'india_gst_accommodation_final_component_tax_room_night','india_gst_accommodation_final_component_tax_component'] LOOP
    EXECUTE pg_catalog.format('CREATE OR REPLACE TRIGGER india_native_consumed_fiscal_source_guard
      BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.guard_india_native_consumed_fiscal_source()',v_table);
  END LOOP;
END;
$native_consumed_source_guards$;

-- Keep0074's existing reversal-binding attachment, broaden its permanent source
-- predicate, and take no late guest/account408 lock at this recheck boundary.
CREATE OR REPLACE FUNCTION public.prevent_issued_india_native_fiscal_source_reversal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public
AS $$
DECLARE v_previous_tenant text:=pg_catalog.current_setting('app.tenant_id',true);
BEGIN
  PERFORM pg_catalog.set_config('app.tenant_id',NEW.tenant_id::text,true);
  IF public.india_native_journal_is_consumed(NEW.tenant_id,NEW.original_journal_id) THEN
    RAISE EXCEPTION USING ERRCODE='55000',
      MESSAGE='issued India native fiscal source requires a numbered correction document';
  END IF;
  PERFORM pg_catalog.set_config('app.tenant_id',v_previous_tenant,true);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_catalog.set_config('app.tenant_id',v_previous_tenant,true);
  RAISE;
END;
$$;
ALTER FUNCTION public.prevent_issued_india_native_fiscal_source_reversal() OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.prevent_issued_india_native_fiscal_source_reversal() FROM PUBLIC,app_role,yellow_runtime;
