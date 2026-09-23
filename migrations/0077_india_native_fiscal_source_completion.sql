-- Order434 complete native fiscal source candidate; canonical version0077.
-- Predecessor0075 contains legacy issuance;0076 persists original evidence.
-- Historical fragment bodies follow unchanged in dependency order.

-- Begin historical 0076-native-accounting.sql
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

-- End historical 0076-native-accounting.sql

-- Begin historical 0076-native-preparation.sql
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
  v_weights bigint[]:='{}'::bigint[];v_allocation bigint[];
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
  -- D1369: validate the complete persisted allocation relation once. Sparse zero
  -- allocations remain equivalent to the old per-source LEFT JOIN, while extra
  -- rows are visible instead of being silently omitted from the comparison.
  IF EXISTS(
    WITH expected AS MATERIALIZED (
      SELECT allocation_source.posting_root_id,(allocation.ordinal-1)::integer AS ordinal,allocation.amount
      FROM public.india_gst_accommodation_valuation_source allocation_source
      CROSS JOIN LATERAL pg_catalog.unnest(
        public.india_native_signed_allocations(allocation_source.current_amount_minor,v_weights)
      ) WITH ORDINALITY allocation(amount,ordinal)
      WHERE allocation_source.tenant_id=p_tenant AND allocation_source.valuation_id=p_valuation
    ), actual AS MATERIALIZED (
      SELECT a.posting_root_id,a.ordinal,a.amount_minor AS amount,a.currency,a.basis_kind
      FROM public.india_gst_accommodation_valuation_allocation a
      WHERE a.tenant_id=p_tenant AND a.valuation_id=p_valuation
    )
    SELECT 1 FROM expected e FULL JOIN actual a
      ON a.posting_root_id=e.posting_root_id AND a.ordinal=e.ordinal
    WHERE COALESCE(a.amount,0) IS DISTINCT FROM e.amount
       OR (a.posting_root_id IS NOT NULL AND (
         a.currency IS DISTINCT FROM 'INR' OR a.basis_kind IS DISTINCT FROM 'native_consideration'))
  ) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native valuation allocation differs from signed-largest-remainder result';
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
  v_change date:=DATE '2025-09-22';v_projection jsonb;v_projection_preimage jsonb;v_timing json;
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
  -- Order297 compares candidateDates in the domain's original insertion order.
  -- JSONB would reverse branch B's service/payment keys; hash through JSONB but
  -- retain ordered JSON for the canonical TypeScript replay source.
  v_timing:=pg_catalog.json_build_object('kind','native_current_transaction','nativeTimingId',p_native_timing,
    'prospectiveDocumentId',p_document,'serviceProvisionSnapshotId',p_service,'paymentReceiptSnapshotId',p_payment,
    'ordinaryRegimeEvidenceId',p_ordinary,'propertyNode',p_property,'reservationId',p_reservation,
    'serviceProvisionDate',v_service_date,'paymentReceiptDate',v_receipt,'invoiceIssueDate',v_invoice,
    'supplierBooksEntryDate',v_books,'supplierBankCreditDate',v_bank,'deadlineDate',v_deadline,
    'candidateDates',CASE WHEN v_invoice<=v_deadline THEN pg_catalog.json_build_object('invoiceIssueDate',v_invoice,'paymentReceiptDate',v_receipt)
      ELSE pg_catalog.json_build_object('serviceProvisionDate',v_service_date,'paymentReceiptDate',v_receipt) END,
    'branch',CASE WHEN v_invoice<=v_deadline THEN 'section13_2_a_invoice_or_payment' ELSE 'section13_2_b_service_or_payment' END,
    'timeOfSupplyDate',v_supply,'regime','ordinary_rule47_30_day','ordinaryRegimeSource','governed_rule47_ordinary_regime_record',
    'ordinaryRegimeLegalBasis','CGST_RULE_47_ORDINARY_SERVICE_INVOICE_30_DAY_INPUT','amountMinor',v_payment->>'amountMinor','currency','INR',
    'predecessorHashes',pg_catalog.json_build_object('serviceProvision',v_service->>'evidenceHash',
      'paymentReceipt',v_payment->>'evidenceHash','ordinaryRegime',v_ordinary->>'evidenceHash','nativeTiming',v_projection->>'evidenceHash'));
  v_hash:=public.india_native_source_hash(v_timing::jsonb||pg_catalog.jsonb_build_object('tenantId',p_tenant));
  v_text:=public.india_native_insertion_json(v_timing);
  v_timing:=(pg_catalog.left(v_text,pg_catalog.length(v_text)-1)||',"evidenceHash":"'||v_hash||'"}')::json;
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

-- Stage-4 valuation/intake/buyer/rate-configuration lock graph. The enclosing
-- preparation has already acquired its financial prefix and issue-authority
-- graph. The three text values are exact private reader originals, not caller
-- selectors. Statutory rows are deliberately left to the following dedicated
-- statutory helper. Snapshot only the complete discovered set, lock it in one
-- deterministic table/key order, then rebuild every genuine reader output;
-- never chase membership that appears while waiting.
CREATE OR REPLACE FUNCTION public.lock_india_native_source_configuration_graph(
  p_tenant uuid,p_property uuid,p_reservation uuid,p_folio uuid,p_valuation uuid,
  p_native_invoice_source_input text,p_native_invoice_source_result text,
  p_service_supply_nature text
) RETURNS jsonb LANGUAGE plpgsql VOLATILE
SET search_path=pg_catalog,public SET timezone='UTC' SET datestyle='ISO,YMD' AS $$
DECLARE
  v_input jsonb;v_result jsonb;v_before_valuation jsonb;v_after_valuation jsonb;
  v_before_composition jsonb;v_after_composition jsonb;
  v_before_assignments jsonb;v_after_assignments jsonb;
  v_before_extensions jsonb;v_after_extensions jsonb;
  v_before_routes jsonb;v_after_routes jsonb;
  v_before_buyer_roles jsonb;v_after_buyer_roles jsonb;
  v_before_relationships jsonb;v_after_relationships jsonb;
  v_value public.india_gst_accommodation_final_valuation%ROWTYPE;
  v_reservation public.reservation%ROWTYPE;
  v_service uuid;v_payment uuid;v_ordinary uuid;v_lineage uuid;v_hold_binding uuid;
  v_attribution uuid;v_hold uuid;v_segment uuid;v_buyer uuid;v_group uuid;v_approval uuid;
  v_selected_extension uuid;v_selected_version smallint;v_selected_content_hash text;
  v_component_family text;v_valuation_ids uuid[];v_history_dates date[];
  v_extension_ids uuid[];v_component_amounts bigint[];v_route_ids uuid[];v_route_codes text[];
  v_buyer_roles text[];v_assignment_ranges daterange[];
  v_expected integer;v_locked integer;
BEGIN
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_locks l WHERE l.pid=pg_catalog.pg_backend_pid()
      AND l.locktype='advisory' AND l.granted AND l.objsubid=1
      AND l.classid=((6441674055002974568::bigint>>32)&4294967295)::oid
      AND l.objid=(6441674055002974568::bigint&4294967295)::oid) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native source configuration must be locked before publication';
  END IF;
  IF p_tenant IS NULL
      OR p_tenant IS DISTINCT FROM NULLIF(pg_catalog.current_setting('app.tenant_id',true),'')::uuid THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='native source configuration tenant context is unavailable';
  END IF;
  IF p_property IS NULL OR p_reservation IS NULL OR p_folio IS NULL OR p_valuation IS NULL
      OR p_native_invoice_source_input IS NULL OR p_native_invoice_source_result IS NULL
      OR p_service_supply_nature IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='native source configuration identities and originals are required';
  END IF;
  BEGIN
    v_input:=p_native_invoice_source_input::jsonb;
    v_result:=p_native_invoice_source_result::jsonb;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='native source configuration originals are not JSON';
  END;

  -- The existing composer is the exact discovery boundary. It replays timing,
  -- valuation, all six whole-day histories and the service-day statutory input.
  v_before_composition:=public.compose_india_native_quoted_tax_source(
    p_tenant,p_property,p_reservation,p_folio,p_valuation,
    p_native_invoice_source_input,p_native_invoice_source_result,p_service_supply_nature);
  v_service:=(v_result#>>'{timing,serviceProvisionSnapshotId}')::uuid;
  v_payment:=(v_result#>>'{timing,paymentReceiptSnapshotId}')::uuid;
  v_ordinary:=(v_result#>>'{timing,ordinaryRegimeEvidenceId}')::uuid;
  v_before_valuation:=public.read_india_native_valuation_evidence(
    p_tenant,p_property,p_reservation,p_folio,p_valuation,v_service,v_payment,v_ordinary);
  v_lineage:=(v_before_valuation#>>'{intake,lineage,id}')::uuid;
  v_hold_binding:=(v_before_valuation#>>'{intake,lineage,binding_id}')::uuid;
  v_attribution:=(v_before_valuation#>>'{intake,lineage,attribution_id}')::uuid;
  v_hold:=(v_before_valuation#>>'{intake,lineage,hold_id}')::uuid;
  v_segment:=(v_before_valuation#>>'{intake,lineage,segment_id}')::uuid;
  v_buyer:=(v_before_valuation#>>'{basis,buyerPartyId}')::uuid;

  SELECT value_row.* INTO v_value FROM public.india_gst_accommodation_final_valuation value_row
    WHERE value_row.tenant_id=p_tenant AND value_row.id=p_valuation
      AND value_row.property_node=p_property AND value_row.reservation_id=p_reservation
      AND value_row.folio_id=p_folio AND value_row.evidence_hash=v_before_valuation->>'evidenceHash';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native source configuration valuation head is unavailable';
  END IF;
  v_approval:=v_value.approval_request_id;
  v_valuation_ids:=ARRAY[p_valuation];
  IF v_value.supersedes_valuation_id IS NOT NULL THEN
    SELECT pg_catalog.array_agg(valuation_id ORDER BY valuation_id) INTO v_valuation_ids
      FROM pg_catalog.unnest(ARRAY[p_valuation,v_value.supersedes_valuation_id]) valuation(valuation_id);
  END IF;
  SELECT reservation_row.* INTO v_reservation FROM public.reservation reservation_row
    WHERE reservation_row.tenant_id=p_tenant AND reservation_row.id=p_reservation
      AND reservation_row.property_node=p_property;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native source configuration reservation is unavailable';
  END IF;
  v_group:=v_reservation.group_id;
  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(role_row) ORDER BY role_row.role),'[]'::jsonb),
    COALESCE(pg_catalog.array_agg(role_row.role ORDER BY role_row.role),'{}'::text[])
    INTO v_before_buyer_roles,v_buyer_roles FROM public.party_role role_row
    WHERE role_row.tenant_id=p_tenant AND role_row.party_id=v_buyer
      AND role_row.role IN ('company','guest');
  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(relationship)
      ORDER BY relationship.from_party,relationship.to_party,relationship.kind),'[]'::jsonb)
    INTO v_before_relationships FROM public.party_relationship relationship
    WHERE relationship.tenant_id=p_tenant
      AND (relationship.from_party=v_buyer OR relationship.to_party=v_buyer);
  IF pg_catalog.cardinality(v_buyer_roles)<1 OR pg_catalog.jsonb_array_length(v_before_relationships)<>0 THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native source configuration legal buyer graph is inconsistent';
  END IF;

  SELECT pg_catalog.array_agg(DISTINCT (history.value#>>'{businessDay,businessDate}')::date
      ORDER BY (history.value#>>'{businessDay,businessDate}')::date)
    INTO v_history_dates
    FROM pg_catalog.jsonb_each(v_input->'historicalResolutions') history;
  SELECT pg_catalog.array_agg(DISTINCT extension_id ORDER BY extension_id) INTO v_extension_ids
    FROM pg_catalog.unnest(ARRAY[
    (v_input#>>'{rateVersionPair,predecessor,extensionId}')::uuid,
    (v_input#>>'{rateVersionPair,successor,extensionId}')::uuid]) extension(extension_id);
  v_selected_extension:=(v_before_composition#>>'{taxPreview,selectedExtensionId}')::uuid;
  v_selected_version:=(v_before_composition#>>'{taxPreview,selectedExtensionVersion}')::smallint;
  v_selected_content_hash:=v_before_composition#>>'{taxPreview,selectedContentHash}';
  v_component_family:=v_before_composition#>>'{taxPreview,componentFamily}';
  SELECT pg_catalog.array_agg(value::bigint ORDER BY ordinality) INTO v_component_amounts
    FROM pg_catalog.jsonb_array_elements_text(
      v_before_composition#>'{taxPreview,componentAmountsMinor}') WITH ORDINALITY amount(value,ordinality);
  SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(route) ORDER BY route.component_ordinal)
    INTO v_before_routes FROM public.india_native_component_tax_routes(
      p_tenant,p_property,v_selected_extension,v_selected_version,
      v_selected_content_hash,v_component_family,v_component_amounts) route;
  SELECT COALESCE(pg_catalog.array_agg((route->>'mapping_id')::uuid ORDER BY (route->>'mapping_id')::uuid)
      FILTER (WHERE route->>'mapping_id' IS NOT NULL),'{}'::uuid[]),
    COALESCE(pg_catalog.array_agg(DISTINCT route->>'tx_code' ORDER BY route->>'tx_code')
      FILTER (WHERE route->>'tx_code' IS NOT NULL),'{}'::text[])
    INTO v_route_ids,v_route_codes FROM pg_catalog.jsonb_array_elements(v_before_routes) route;
  IF pg_catalog.cardinality(v_history_dates) NOT BETWEEN 1 AND 6
      OR pg_catalog.cardinality(v_extension_ids)<>2 OR v_before_routes IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native source configuration discovered graph is incomplete';
  END IF;

  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(assignment)
      ORDER BY pg_catalog.lower(assignment.effective),pg_catalog.upper(assignment.effective),
        pg_catalog.lower_inc(assignment.effective),pg_catalog.upper_inc(assignment.effective)),'[]'::jsonb),
    COALESCE(pg_catalog.array_agg(assignment.effective
      ORDER BY pg_catalog.lower(assignment.effective),pg_catalog.upper(assignment.effective),
        pg_catalog.lower_inc(assignment.effective),pg_catalog.upper_inc(assignment.effective)),'{}'::daterange[])
    INTO v_before_assignments,v_assignment_ranges FROM public.tax_assignment assignment
    WHERE assignment.tenant_id=p_tenant AND assignment.property_node=p_property
      AND assignment.jurisdiction_key='in-gst-lodging'
      AND EXISTS(SELECT 1 FROM pg_catalog.unnest(v_history_dates) day(business_date)
        WHERE assignment.effective @> day.business_date);
  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(extension_row) ORDER BY extension_row.id),'[]'::jsonb)
    INTO v_before_extensions FROM public.extension extension_row
    WHERE extension_row.id=ANY(v_extension_ids) AND extension_row.tenant_id IS NULL;

  -- Valuation head/predecessor and every child row consumed by the genuine
  -- valuation reader. The financial prefix's folio advisory lock prevents a
  -- concurrent successor; draft-0075 child guards prevent later child inserts.
  PERFORM 1 FROM public.india_gst_accommodation_final_valuation value_row
    WHERE value_row.tenant_id=p_tenant AND value_row.id=ANY(v_valuation_ids)
    ORDER BY value_row.id FOR SHARE;
  GET DIAGNOSTICS v_locked=ROW_COUNT;
  IF v_locked<>pg_catalog.cardinality(v_valuation_ids) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native source configuration valuation set changed before lock';
  END IF;
  SELECT pg_catalog.count(*)::integer INTO v_expected
    FROM public.india_gst_accommodation_valuation_source source_row
    WHERE source_row.tenant_id=p_tenant AND source_row.valuation_id=ANY(v_valuation_ids);
  PERFORM 1 FROM public.india_gst_accommodation_valuation_source source_row
    WHERE source_row.tenant_id=p_tenant AND source_row.valuation_id=ANY(v_valuation_ids)
    ORDER BY source_row.valuation_id,source_row.posting_root_id FOR SHARE;
  GET DIAGNOSTICS v_locked=ROW_COUNT;
  IF v_locked<>v_expected THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native source configuration valuation sources changed before lock';
  END IF;
  SELECT pg_catalog.count(*)::integer INTO v_expected
    FROM public.india_gst_accommodation_valuation_room_night night
    WHERE night.tenant_id=p_tenant AND night.valuation_id=p_valuation;
  PERFORM 1 FROM public.india_gst_accommodation_valuation_room_night night
    WHERE night.tenant_id=p_tenant AND night.valuation_id=p_valuation
    ORDER BY night.ordinal FOR SHARE;
  GET DIAGNOSTICS v_locked=ROW_COUNT;
  IF v_locked<>v_expected THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native source configuration valuation nights changed before lock';
  END IF;
  SELECT pg_catalog.count(*)::integer INTO v_expected
    FROM public.india_gst_accommodation_valuation_allocation allocation
    WHERE allocation.tenant_id=p_tenant AND allocation.valuation_id=p_valuation;
  PERFORM 1 FROM public.india_gst_accommodation_valuation_allocation allocation
    WHERE allocation.tenant_id=p_tenant AND allocation.valuation_id=p_valuation
    ORDER BY allocation.posting_root_id,allocation.ordinal FOR SHARE;
  GET DIAGNOSTICS v_locked=ROW_COUNT;
  IF v_locked<>v_expected THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native source configuration valuation allocations changed before lock';
  END IF;

  PERFORM 1 FROM public.india_gst_accommodation_service_provision_snapshot source_row
    WHERE source_row.tenant_id=p_tenant AND source_row.id=v_service FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native service source disappeared before lock'; END IF;
  PERFORM 1 FROM public.india_gst_accommodation_payment_receipt_snapshot source_row
    WHERE source_row.tenant_id=p_tenant AND source_row.id=v_payment FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native payment source disappeared before lock'; END IF;
  PERFORM 1 FROM public.india_gst_accommodation_ordinary_regime_evidence source_row
    WHERE source_row.tenant_id=p_tenant AND source_row.id=v_ordinary FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native ordinary source disappeared before lock'; END IF;
  PERFORM 1 FROM public.tax_attribution_reservation_binding lineage
    WHERE lineage.tenant_id=p_tenant AND lineage.id=v_lineage FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native reservation lineage disappeared before lock'; END IF;
  PERFORM 1 FROM public.tax_attribution_hold_binding binding
    WHERE binding.tenant_id=p_tenant AND binding.id=v_hold_binding FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native hold lineage disappeared before lock'; END IF;
  PERFORM 1 FROM public.tax_attribution_snapshot attribution
    WHERE attribution.tenant_id=p_tenant AND attribution.id=v_attribution FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native attribution source disappeared before lock'; END IF;
  PERFORM 1 FROM public.hold hold_row
    WHERE hold_row.tenant_id=p_tenant AND hold_row.id=v_hold FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native hold disappeared before lock'; END IF;
  PERFORM 1 FROM public.reservation_segment segment
    WHERE segment.tenant_id=p_tenant AND segment.id=v_segment FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native reservation segment disappeared before lock'; END IF;
  PERFORM 1 FROM public.reservation reservation_row
    WHERE reservation_row.tenant_id=p_tenant AND reservation_row.id=p_reservation FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native reservation disappeared before lock'; END IF;
  IF v_group IS NOT NULL THEN
    PERFORM 1 FROM public.reservation_group group_row
      WHERE group_row.tenant_id=p_tenant AND group_row.id=v_group FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native reservation group disappeared before lock'; END IF;
  END IF;
  PERFORM 1 FROM public.party party_row
    WHERE party_row.tenant_id=p_tenant AND party_row.id=v_buyer FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native legal buyer disappeared before lock'; END IF;
  PERFORM 1 FROM public.party_role role_row
    WHERE role_row.tenant_id=p_tenant AND role_row.party_id=v_buyer
      AND role_row.role=ANY(v_buyer_roles) ORDER BY role_row.role FOR SHARE;
  GET DIAGNOSTICS v_locked=ROW_COUNT;
  IF v_locked<>pg_catalog.cardinality(v_buyer_roles) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native legal buyer role set changed before lock';
  END IF;
  PERFORM 1 FROM public.party_relationship relationship
    JOIN pg_catalog.jsonb_to_recordset(v_before_relationships)
      expected(from_party uuid,to_party uuid,kind text)
      ON expected.from_party=relationship.from_party AND expected.to_party=relationship.to_party
        AND expected.kind=relationship.kind
    WHERE relationship.tenant_id=p_tenant
    ORDER BY relationship.from_party,relationship.to_party,relationship.kind FOR SHARE OF relationship;
  GET DIAGNOSTICS v_locked=ROW_COUNT;
  IF v_locked<>pg_catalog.jsonb_array_length(v_before_relationships) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native buyer relationship set changed before lock';
  END IF;
  IF v_approval IS NOT NULL THEN
    PERFORM 1 FROM public.approval_request approval
      WHERE approval.tenant_id=p_tenant AND approval.id=v_approval FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native buyer approval disappeared before lock'; END IF;
  END IF;

  SELECT pg_catalog.jsonb_array_length(v_before_assignments) INTO v_expected;
  PERFORM 1 FROM public.tax_assignment assignment
    WHERE assignment.tenant_id=p_tenant AND assignment.property_node=p_property
      AND assignment.jurisdiction_key='in-gst-lodging'
      AND assignment.effective=ANY(v_assignment_ranges)
    ORDER BY pg_catalog.lower(assignment.effective),pg_catalog.upper(assignment.effective),
      pg_catalog.lower_inc(assignment.effective),pg_catalog.upper_inc(assignment.effective) FOR SHARE;
  GET DIAGNOSTICS v_locked=ROW_COUNT;
  IF v_locked<>v_expected THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native rate assignment set changed before lock';
  END IF;
  PERFORM 1 FROM public.extension extension_row
    WHERE extension_row.id=ANY(v_extension_ids) AND extension_row.tenant_id IS NULL
    ORDER BY extension_row.id FOR SHARE;
  GET DIAGNOSTICS v_locked=ROW_COUNT;
  IF v_locked<>pg_catalog.cardinality(v_extension_ids) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native rate extension set changed before lock';
  END IF;
  IF pg_catalog.cardinality(v_route_ids)>0 THEN
    PERFORM 1 FROM public.tax_semantic_route route
      WHERE route.tenant_id=p_tenant AND route.id=ANY(v_route_ids)
      ORDER BY route.id FOR SHARE;
    GET DIAGNOSTICS v_locked=ROW_COUNT;
    IF v_locked<>pg_catalog.cardinality(v_route_ids) THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native semantic route set changed before lock';
    END IF;
    PERFORM 1 FROM public.tx_code code WHERE code.code=ANY(v_route_codes)
      ORDER BY code.code FOR SHARE;
    GET DIAGNOSTICS v_locked=ROW_COUNT;
    IF v_locked<>pg_catalog.cardinality(v_route_codes) THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native tax code set changed before lock';
    END IF;
    PERFORM 1 FROM public.tx_code_route route
      WHERE route.tenant_id=p_tenant AND route.property_node=p_property
        AND route.currency='INR' AND route.tx_code=ANY(v_route_codes)
      ORDER BY route.tenant_id,route.property_node,route.currency,route.tx_code FOR SHARE;
    GET DIAGNOSTICS v_locked=ROW_COUNT;
    IF v_locked<>pg_catalog.cardinality(v_route_codes) THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native configured tax route set changed before lock';
    END IF;
  END IF;

  -- Fresh statements after every wait observe READ COMMITTED drift. Exact reader
  -- outputs plus raw selected configuration rows and routes must all remain equal.
  v_after_valuation:=public.read_india_native_valuation_evidence(
    p_tenant,p_property,p_reservation,p_folio,p_valuation,v_service,v_payment,v_ordinary);
  v_after_composition:=public.compose_india_native_quoted_tax_source(
    p_tenant,p_property,p_reservation,p_folio,p_valuation,
    p_native_invoice_source_input,p_native_invoice_source_result,p_service_supply_nature);
  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(role_row) ORDER BY role_row.role),'[]'::jsonb)
    INTO v_after_buyer_roles FROM public.party_role role_row
    WHERE role_row.tenant_id=p_tenant AND role_row.party_id=v_buyer
      AND role_row.role IN ('company','guest');
  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(relationship)
      ORDER BY relationship.from_party,relationship.to_party,relationship.kind),'[]'::jsonb)
    INTO v_after_relationships FROM public.party_relationship relationship
    WHERE relationship.tenant_id=p_tenant
      AND (relationship.from_party=v_buyer OR relationship.to_party=v_buyer);
  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(assignment)
      ORDER BY pg_catalog.lower(assignment.effective),pg_catalog.upper(assignment.effective),
        pg_catalog.lower_inc(assignment.effective),pg_catalog.upper_inc(assignment.effective)),'[]'::jsonb)
    INTO v_after_assignments FROM public.tax_assignment assignment
    WHERE assignment.tenant_id=p_tenant AND assignment.property_node=p_property
      AND assignment.jurisdiction_key='in-gst-lodging'
      AND EXISTS(SELECT 1 FROM pg_catalog.unnest(v_history_dates) day(business_date)
        WHERE assignment.effective @> day.business_date);
  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(extension_row) ORDER BY extension_row.id),'[]'::jsonb)
    INTO v_after_extensions FROM public.extension extension_row
    WHERE extension_row.id=ANY(v_extension_ids) AND extension_row.tenant_id IS NULL;
  SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(route) ORDER BY route.component_ordinal)
    INTO v_after_routes FROM public.india_native_component_tax_routes(
      p_tenant,p_property,v_selected_extension,v_selected_version,
      v_selected_content_hash,v_component_family,v_component_amounts) route;
  IF v_before_valuation IS DISTINCT FROM v_after_valuation
      OR v_before_composition IS DISTINCT FROM v_after_composition
      OR v_before_buyer_roles IS DISTINCT FROM v_after_buyer_roles
      OR v_before_relationships IS DISTINCT FROM v_after_relationships
      OR v_before_assignments IS DISTINCT FROM v_after_assignments
      OR v_before_extensions IS DISTINCT FROM v_after_extensions
      OR v_before_routes IS DISTINCT FROM v_after_routes THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native source configuration graph changed during ordered locking';
  END IF;
  RETURN pg_catalog.jsonb_build_object('valuationEvidence',v_after_valuation,
    'quotedTaxComposition',v_after_composition,'rateAssignments',v_after_assignments,
    'extensions',v_after_extensions,'routes',v_after_routes);
END;
$$;
ALTER FUNCTION public.lock_india_native_source_configuration_graph(
  uuid,uuid,uuid,uuid,uuid,text,text,text) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.lock_india_native_source_configuration_graph(
  uuid,uuid,uuid,uuid,uuid,text,text,text) FROM PUBLIC,app_role,yellow_runtime;

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

-- The actual first half of the dedicated runtime transaction. There is no
-- separately committable preparation: draft75's deferred completion requires
-- the real accounting binding, document, origin, events and receipt at COMMIT.
-- Execution remains withheld until the complete candidate has its proofs.
CREATE OR REPLACE FUNCTION public.prepare_india_native_fiscal_invoice_v2(
  p_tenant uuid,p_property uuid,p_actor uuid,p_reservation uuid,p_folio uuid,p_valuation uuid,
  p_service uuid,p_payment uuid,p_ordinary uuid,p_supplier_location uuid,p_supplier_status uuid,
  p_supplier_sez uuid,p_recipient_registration uuid,p_recipient_sez uuid,p_classification uuid,
  p_calendar_authority text,p_calendar_source_hash text,p_calendar_through date,
  p_calendar_dates date[],p_calendar_states text[],p_key text,p_request uuid
) RETURNS TABLE(native_timing_id uuid,request_event_id uuid,posting_binding_id uuid,
    prepared_source_json text,completed_receipt jsonb)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,public SET timezone='UTC' SET datestyle='ISO,YMD' AS $$
DECLARE
  v_authority jsonb;v_request jsonb;v_timing jsonb;v_valuation jsonb;v_history jsonb;
  v_composition jsonb;v_prefix jsonb;v_locked jsonb;v_document_context jsonb;
  v_context jsonb;v_series jsonb;v_basis jsonb;v_payload jsonb;v_result jsonb;
  v_existing public.india_gst_native_invoice_timing%ROWTYPE;
  v_statutory record;v_locked_statutory record;
  v_jurisdiction text;v_key_hash text;v_request_hash text;v_claimed boolean;
  v_timing_id uuid;v_document_id uuid;v_app_id uuid;v_tax_id uuid;v_binding_id uuid;v_event_id uuid;
  v_event_seq bigint;v_series_id uuid;v_selected uuid;v_family text;
BEGIN
  v_authority:=public.read_india_native_issue_authority(p_tenant,p_property,p_actor,p_reservation,p_folio);
  v_request:=public.india_native_invoice_request_identity(p_tenant,p_property,p_actor,p_reservation,
    p_folio,p_valuation,p_service,p_payment,p_ordinary,p_supplier_location,p_supplier_status,
    p_supplier_sez,p_recipient_registration,p_recipient_sez,p_classification,p_calendar_authority,
    p_calendar_source_hash,p_calendar_through,p_calendar_dates,p_calendar_states,p_key,p_request);
  v_key_hash:=v_request->>'keyHash';v_request_hash:=v_request->>'requestHash';

  IF EXISTS(SELECT 1 FROM pg_catalog.pg_locks l WHERE l.pid=pg_catalog.pg_backend_pid()
      AND l.locktype='advisory' AND l.granted AND l.objsubid=1
      AND l.classid=((6441674055002974568::bigint>>32)&4294967295)::oid
      AND l.objid=(6441674055002974568::bigint&4294967295)::oid) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native issue requires a transaction without prior publication';
  END IF;

  -- Scope0 is first, never native430 before financial rows. A same-folio waiter
  -- must see the permanent winner before running current-date/open-source logic.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    p_tenant::text||p_reservation::text||p_folio::text,0));
  SELECT n.* INTO v_existing FROM public.india_gst_native_invoice_timing n
    WHERE n.tenant_id=p_tenant AND n.request_key_hash=v_key_hash;
  IF FOUND THEN
    IF v_existing.request_hash IS DISTINCT FROM v_request_hash
        OR v_existing.actor_id IS DISTINCT FROM p_actor
        OR v_existing.property_node IS DISTINCT FROM p_property
        OR v_existing.reservation_id IS DISTINCT FROM p_reservation
        OR v_existing.folio_id IS DISTINCT FROM p_folio THEN
      RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='native invoice key belongs to a different permanent request';
    END IF;
    -- Current permission remains mandatory; original clock, open-day, folio
    -- status, mutable series counter and prunable API/outbox records do not.
    PERFORM public.lock_india_native_issue_authority(p_tenant,p_property,p_actor,p_reservation,p_folio);
    v_result:=public.read_india_native_completed_receipt(p_tenant,v_existing.id);
    RETURN QUERY SELECT v_existing.id,v_existing.request_event_id,v_existing.accounting_binding_id,NULL::text,v_result;
    RETURN;
  END IF;
  IF EXISTS(SELECT 1 FROM public.india_gst_native_invoice_timing n
      WHERE n.tenant_id=p_tenant AND n.property_node=p_property
        AND n.reservation_id=p_reservation AND n.folio_id=p_folio)
      OR EXISTS(SELECT 1 FROM public.india_gst_native_fiscal_document_origin o
        WHERE o.tenant_id=p_tenant AND o.property_node=p_property
          AND o.reservation_id=p_reservation AND o.folio_id=p_folio AND o.document_kind='invoice') THEN
    RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='native invoice consideration window is already consumed';
  END IF;
  v_timing_id:=pg_catalog.gen_random_uuid();v_document_id:=pg_catalog.gen_random_uuid();
  v_app_id:=pg_catalog.gen_random_uuid();v_tax_id:=pg_catalog.gen_random_uuid();
  v_binding_id:=pg_catalog.gen_random_uuid();v_event_id:=pg_catalog.gen_random_uuid();

  -- Read-only discovery. All identities, dates, rates and amounts below come
  -- from real recorded roots; none are accepted as caller-calculated artifacts.
  v_timing:=public.read_india_native_invoice_timing_source(p_tenant,p_property,p_reservation,
    p_service,p_payment,p_ordinary,v_timing_id,v_document_id,p_calendar_authority,p_calendar_source_hash,
    p_calendar_through,p_calendar_dates,p_calendar_states);
  v_valuation:=public.read_india_native_valuation_evidence(p_tenant,p_property,p_reservation,p_folio,
    p_valuation,p_service,p_payment,p_ordinary);
  v_history:=public.read_india_native_rate_history_day(p_tenant,p_property,
    (v_timing#>>'{invoiceSourceResult,timing,serviceProvisionDate}')::date);
  v_jurisdiction:=public.india_native_insertion_json(pg_catalog.json_build_object(
    'extensionId',v_history#>'{selectedExtension,extensionId}','ownerTenantId',NULL,
    'key',v_history#>'{selectedExtension,key}','version',v_history#>>'{selectedExtension,version}',
    'contentHash',v_history#>'{selectedExtension,contentHash}'));
  SELECT g.* INTO STRICT v_statutory FROM public.read_india_native_statutory_root_graph(
    p_tenant,p_property,p_reservation,p_folio,p_valuation,p_supplier_location,p_supplier_status,p_supplier_sez,
    p_recipient_registration,p_recipient_sez,p_classification,
    v_timing->>'invoiceSourceResultCanonicalJson',v_jurisdiction) g;
  v_composition:=public.compose_india_native_quoted_tax_source(p_tenant,p_property,p_reservation,p_folio,
    p_valuation,v_timing->>'invoiceSourceInputCanonicalJson',v_timing->>'invoiceSourceResultCanonicalJson',
    v_statutory.service_supply_nature_json);
  v_selected:=(v_composition#>>'{taxPreview,selectedExtensionId}')::uuid;
  v_family:=v_composition#>>'{taxPreview,componentFamily}';
  v_prefix:=public.lock_india_native_invoice_source_prefix(p_tenant,p_property,p_reservation,p_folio,
    p_valuation,v_selected,v_family,v_tax_id,v_key_hash);
  -- Cross-folio same-key requests only converge on430 after their financial
  -- prefixes. Check the winner again; a fresh source may never replace it.
  IF EXISTS(SELECT 1 FROM public.india_gst_native_invoice_timing n
      WHERE n.tenant_id=p_tenant AND n.request_key_hash=v_key_hash) THEN
    RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='native invoice key was consumed while acquiring source locks';
  END IF;
  IF v_authority IS DISTINCT FROM public.lock_india_native_issue_authority(
      p_tenant,p_property,p_actor,p_reservation,p_folio) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native issue authority changed while acquiring source locks';
  END IF;
  v_locked:=public.lock_india_native_source_configuration_graph(p_tenant,p_property,p_reservation,p_folio,
    p_valuation,v_timing->>'invoiceSourceInputCanonicalJson',v_timing->>'invoiceSourceResultCanonicalJson',
    v_statutory.service_supply_nature_json);
  SELECT g.* INTO STRICT v_locked_statutory FROM public.lock_india_native_statutory_source_graph(
    p_tenant,p_property,p_reservation,p_folio,p_valuation,p_supplier_location,p_supplier_status,p_supplier_sez,
    p_recipient_registration,p_recipient_sez,p_classification,
    v_timing->>'invoiceSourceResultCanonicalJson',v_jurisdiction) g;
  IF ROW(v_statutory.prepared_source_json,v_statutory.service_supply_nature_json,
      v_statutory.service_supplier_sez_status_id,v_statutory.service_recipient_sez_status_id)
      IS DISTINCT FROM ROW(v_locked_statutory.prepared_source_json,v_locked_statutory.service_supply_nature_json,
      v_locked_statutory.service_supplier_sez_status_id,v_locked_statutory.service_recipient_sez_status_id)
      OR v_locked->'valuationEvidence' IS DISTINCT FROM v_valuation
      OR v_locked->'quotedTaxComposition' IS DISTINCT FROM v_composition
      OR v_timing IS DISTINCT FROM public.read_india_native_invoice_timing_source(
        p_tenant,p_property,p_reservation,p_service,p_payment,p_ordinary,v_timing_id,v_document_id,
        p_calendar_authority,p_calendar_source_hash,p_calendar_through,p_calendar_dates,p_calendar_states)
      OR v_valuation IS DISTINCT FROM public.read_india_native_valuation_evidence(p_tenant,p_property,
        p_reservation,p_folio,p_valuation,p_service,p_payment,p_ordinary)
      OR v_composition IS DISTINCT FROM public.compose_india_native_quoted_tax_source(p_tenant,p_property,
        p_reservation,p_folio,p_valuation,v_timing->>'invoiceSourceInputCanonicalJson',
        v_timing->>'invoiceSourceResultCanonicalJson',v_statutory.service_supply_nature_json)
      OR v_prefix->'sourceClosure' IS DISTINCT FROM public.read_india_native_valuation_source_closure(
        p_tenant,p_property,p_reservation,p_folio,p_valuation)
      OR v_prefix->'taxPreview' IS DISTINCT FROM v_composition->'taxPreview' THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native invoice source graph changed while acquiring its complete locks';
  END IF;

  v_document_context:=public.lock_india_native_document_context(p_tenant,p_property,p_reservation,p_folio,
    p_actor,(v_statutory.prepared_source_json::json#>>'{sellerRegistration,registrationId}')::uuid);
  v_series_id:=(v_document_context->>'seriesId')::uuid;
  v_series:=pg_catalog.jsonb_build_object('tenantId',p_tenant,'propertyNode',p_property,'seriesId',v_series_id,
    'supplierRegistrationId',v_document_context->'supplierRegistrationId','kind','invoice','fiscal',true,
    'financialYearStart',v_document_context->>'financialYearStart','prefix',v_document_context->>'prefix');
  v_context:=(v_timing->'transactionContext')||pg_catalog.jsonb_build_object('tenantId',p_tenant,
    'propertyNode',p_property,'reservationId',p_reservation,'folioId',p_folio,'actorId',p_actor,
    'valuationId',p_valuation,'nativeTimingId',v_timing_id,'prospectiveDocumentId',v_document_id,
    'seriesId',v_series_id,'applicabilityId',v_app_id,'taxId',v_tax_id,'accountingBindingId',v_binding_id,
    'requestId',p_request,'requestKeyHash',v_key_hash,'requestHash',v_request_hash,'requestEventId',v_event_id);
  v_basis:=public.india_native_preparation_source_basis(v_context,
    v_timing->>'invoiceSourceInputCanonicalJson',v_timing->>'invoiceSourceResultCanonicalJson',v_valuation,
    v_statutory.prepared_source_json,v_statutory.service_supply_nature_json,v_composition,v_series);

  -- Claim any existing API key before publication. Expiry never authorizes
  -- replacement of a native invoice; permanent timing was checked above.
  INSERT INTO public.api_idempotency(tenant_id,operation,key_hash,request_hash,created_at,expires_at)
    VALUES(p_tenant,'document.issued',v_key_hash,v_request_hash,pg_catalog.transaction_timestamp(),
      pg_catalog.transaction_timestamp()+interval '24 hours')
    ON CONFLICT(tenant_id,operation,key_hash) DO NOTHING RETURNING true INTO v_claimed;
  IF NOT COALESCE(v_claimed,false) THEN
    RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='native invoice API key already exists without its permanent completed origin';
  END IF;
  v_payload:=pg_catalog.jsonb_build_object('nativeTimingId',v_timing_id,'documentId',v_document_id,
    'taxId',v_tax_id,'applicabilityId',v_app_id,'valuationId',p_valuation,'reservationId',p_reservation,
    'folioId',p_folio,'sourceBasisHash',v_basis->>'sourceBasisHash');
  -- No pre-existing resource is discovered or newly locked below D99.
  PERFORM pg_catalog.pg_advisory_xact_lock(6441674055002974568::bigint);
  INSERT INTO public.outbox(tenant_id,id,property_node,business_date,aggregate_type,aggregate_id,
      event_type,event_version,actor_id,correlation_id,payload,created_at)
    VALUES(p_tenant,v_event_id,p_property,(v_document_context->>'issueDate')::date,
      'india_gst_native_invoice_timing',v_timing_id,'india_gst.native_accommodation_accounting_requested',1,
      p_actor,p_request,v_payload,pg_catalog.transaction_timestamp()) RETURNING seq INTO v_event_seq;
  PERFORM public.persist_india_native_quoted_tax_source(p_tenant,p_property,p_reservation,p_folio,p_valuation,
    p_actor,p_request,v_series_id,v_app_id,v_tax_id,v_binding_id,v_event_seq,v_event_id,v_key_hash,
    v_request_hash,v_basis->>'sourceBasisHash',v_timing->>'invoiceSourceInputCanonicalJson',
    v_timing->>'invoiceSourceResultCanonicalJson',v_statutory.prepared_source_json,v_statutory.service_supply_nature_json);
  v_result:=public.assert_india_native_preparation_authenticity(p_tenant,v_timing_id);
  IF v_result->>'preparedSourceCanonicalJson' IS DISTINCT FROM v_statutory.prepared_source_json
      OR v_result#>>'{sourceBasis,sourceBasisHash}' IS DISTINCT FROM v_basis->>'sourceBasisHash' THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native preparation did not preserve the complete authenticated source';
  END IF;
  RETURN QUERY SELECT v_timing_id,v_event_id,v_binding_id,v_statutory.prepared_source_json,NULL::jsonb;
END;
$$;
ALTER FUNCTION public.prepare_india_native_fiscal_invoice_v2(
  uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,text,date,date[],text[],text,uuid)
  OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.prepare_india_native_fiscal_invoice_v2(
  uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,text,date,date[],text[],text,uuid)
  FROM PUBLIC,app_role,yellow_runtime;

-- End historical 0076-native-preparation.sql

-- Begin historical 0076-native-statutory.sql
-- Order434 / D1352 / Question191: non-runnable, private statutory source fragment.
-- No runtime capability, writer, issue authority, or completed preparation.
-- The final completion migration must include the authenticated timing/source
-- preparation boundary before this leaf may be used by any issuing capability.

CREATE OR REPLACE FUNCTION public.india_native_statutory_text(p_value text,p_max integer,p_optional boolean DEFAULT false)
RETURNS text LANGUAGE plpgsql IMMUTABLE
SET search_path=pg_catalog,public SET timezone='UTC' SET datestyle='ISO,YMD' AS $$
DECLARE v_utf16_length integer;
BEGIN
  IF p_value IS NULL AND p_optional THEN RETURN NULL; END IF;
  SELECT COALESCE(pg_catalog.sum(CASE WHEN pg_catalog.ascii(pg_catalog.substr(p_value,i,1))>65535 THEN 2 ELSE 1 END),0)::integer
    INTO v_utf16_length FROM pg_catalog.generate_series(1,pg_catalog.char_length(p_value)) i;
  -- JS String.length counts UTF16 code units; String.trim uses this exact
  -- ECMAScript whitespace/line-terminator set, not PostgreSQL btrim's space only.
  IF p_value IS NULL OR p_max IS NULL OR p_max<1 OR v_utf16_length NOT BETWEEN 1 AND p_max
      OR p_value<>pg_catalog.btrim(p_value,U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')
      OR p_value<>normalize(p_value,NFC) OR p_value~U&'[\0001-\001F\007F]' THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='statutory source text is not canonical';
  END IF;
  RETURN p_value;
END;
$$;
ALTER FUNCTION public.india_native_statutory_text(text,integer,boolean) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.india_native_statutory_text(text,integer,boolean) FROM PUBLIC,app_role,yellow_runtime;

-- Exact existing GSTIN mod36 checksum, not just the table's shape constraint.
CREATE OR REPLACE FUNCTION public.india_native_statutory_gstin(p_gstin text,p_state text)
RETURNS text LANGUAGE plpgsql IMMUTABLE
SET search_path=pg_catalog,public SET timezone='UTC' SET datestyle='ISO,YMD' AS $$
DECLARE v_alphabet text:='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';v_factor integer:=2;v_sum integer:=0;v_add integer;v_i integer;
BEGIN
  IF p_state IS NULL OR p_state NOT IN ('01','02','03','04','05','06','07','08','09','10','11','12','13','14','15','16','17','18','19','20',
      '21','22','23','24','26','27','29','30','31','32','33','34','35','36','37','38')
      OR p_gstin IS NULL OR p_gstin !~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'
      OR pg_catalog.left(p_gstin,2)<>p_state THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='statutory GSTIN or state is invalid';
  END IF;
  FOR v_i IN REVERSE 14..1 LOOP
    v_add:=v_factor*(pg_catalog.strpos(v_alphabet,pg_catalog.substr(p_gstin,v_i,1))-1);
    v_sum:=v_sum+v_add/36+v_add%36;v_factor:=CASE v_factor WHEN 2 THEN 1 ELSE 2 END;
  END LOOP;
  IF pg_catalog.substr(v_alphabet,(36-v_sum%36)%36+1,1)<>pg_catalog.right(p_gstin,1) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='statutory GSTIN checksum is invalid';
  END IF;
  RETURN p_gstin;
END;
$$;
ALTER FUNCTION public.india_native_statutory_gstin(text,text) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.india_native_statutory_gstin(text,text) FROM PUBLIC,app_role,yellow_runtime;

-- Private insertion-sensitive encoding primitives. Their inputs are constructed
-- from typed rows by the reader, never accepted as request/source authority.
CREATE OR REPLACE FUNCTION public.india_native_statutory_digest(p_body json)
RETURNS text LANGUAGE sql IMMUTABLE STRICT
SET search_path=pg_catalog,public SET timezone='UTC' SET datestyle='ISO,YMD' AS $$
  SELECT pg_catalog.encode(public.digest(pg_catalog.convert_to(public.india_native_insertion_json(p_body),'UTF8'),'sha256'),'hex')
$$;
ALTER FUNCTION public.india_native_statutory_digest(json) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.india_native_statutory_digest(json) FROM PUBLIC,app_role,yellow_runtime;

CREATE OR REPLACE FUNCTION public.india_native_statutory_with_hash(p_body json,p_preimage json)
RETURNS json LANGUAGE plpgsql IMMUTABLE STRICT
SET search_path=pg_catalog,public SET timezone='UTC' SET datestyle='ISO,YMD' AS $$
DECLARE v_text text:=public.india_native_insertion_json(p_body);
BEGIN
  IF pg_catalog.json_typeof(p_body)<>'object' OR p_body::jsonb ? 'evidenceHash' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='statutory evidence body must be an unhashed object';
  END IF;
  RETURN (pg_catalog.left(v_text,pg_catalog.length(v_text)-1)||',"evidenceHash":"'||
    public.india_native_statutory_digest(p_preimage)||'"}')::json;
END;
$$;
ALTER FUNCTION public.india_native_statutory_with_hash(json,json) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.india_native_statutory_with_hash(json,json) FROM PUBLIC,app_role,yellow_runtime;

CREATE OR REPLACE FUNCTION public.india_native_statutory_tenant_hash(p_tenant uuid,p_body json)
RETURNS json LANGUAGE sql IMMUTABLE STRICT
SET search_path=pg_catalog,public SET timezone='UTC' SET datestyle='ISO,YMD' AS $$
  SELECT public.india_native_statutory_with_hash(p_body,
    ('{"tenantId":'||pg_catalog.to_json(p_tenant)::text||','||pg_catalog.substr(public.india_native_insertion_json(p_body),2))::json)
$$;
ALTER FUNCTION public.india_native_statutory_tenant_hash(uuid,json) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.india_native_statutory_tenant_hash(uuid,json) FROM PUBLIC,app_role,yellow_runtime;

CREATE OR REPLACE FUNCTION public.india_native_statutory_candidate(p_tenant uuid,p_body json)
RETURNS json LANGUAGE plpgsql IMMUTABLE STRICT
SET search_path=pg_catalog,public SET timezone='UTC' SET datestyle='ISO,YMD' AS $$
DECLARE v_text text:=public.india_native_insertion_json(p_body);v_hash text;
BEGIN
  IF pg_catalog.json_typeof(p_body)<>'object' OR p_body::jsonb ?| ARRAY['candidateHash','candidateJson'] THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='statutory candidate body must be an unhashed object';
  END IF;
  v_hash:=public.india_native_statutory_digest(pg_catalog.json_build_object('tenantId',p_tenant,'candidate',p_body));
  RETURN (pg_catalog.left(v_text,pg_catalog.length(v_text)-1)||',"candidateJson":'||pg_catalog.to_json(v_text)::text||',"candidateHash":"'||v_hash||'"}')::json;
END;
$$;
ALTER FUNCTION public.india_native_statutory_candidate(uuid,json) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.india_native_statutory_candidate(uuid,json) FROM PUBLIC,app_role,yellow_runtime;

CREATE OR REPLACE FUNCTION public.india_native_statutory_approval(
  p_type text,p_as_of date,p_form text,p_reference text,p_validity daterange,p_status text,p_hash text
) RETURNS json LANGUAGE plpgsql IMMUTABLE
SET search_path=pg_catalog,public SET timezone='UTC' SET datestyle='ISO,YMD' AS $$
BEGIN
  IF p_type='regular' THEN
    IF p_form IS NOT NULL OR p_reference IS NOT NULL OR p_validity IS NOT NULL OR p_status IS NOT NULL OR p_hash IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='regular statutory status cannot carry SEZ approval';
    END IF;
    RETURN 'null'::json;
  END IF;
  IF p_type IS NULL OR p_type NOT IN ('sez_unit','sez_developer') OR p_as_of IS NULL
      OR (p_type='sez_unit' AND p_form IS DISTINCT FROM 'sez_rules_form_g')
      OR (p_type='sez_developer' AND (p_form IS NULL OR p_form NOT IN ('sez_rules_form_b','sez_rules_form_c')))
      OR p_validity IS NULL OR pg_catalog.isempty(p_validity) OR pg_catalog.lower_inf(p_validity) OR pg_catalog.upper_inf(p_validity)
      OR NOT pg_catalog.lower_inc(p_validity) OR pg_catalog.upper_inc(p_validity)
      OR NOT(p_validity @> p_as_of) OR pg_catalog.lower(p_validity)<DATE '0001-01-01'
      OR pg_catalog.upper(p_validity)>DATE '9999-12-31' OR p_status IS DISTINCT FROM 'in_force'
      OR p_hash IS NULL OR p_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='statutory SEZ approval is not valid at the source date';
  END IF;
  RETURN pg_catalog.json_build_object('form',p_form,'reference',public.india_native_statutory_text(p_reference,128),
    'validity',pg_catalog.json_build_object('fromInclusive',pg_catalog.lower(p_validity),'toExclusive',pg_catalog.upper(p_validity)),
    'status','in_force','evidenceSha256',p_hash);
END;
$$;
ALTER FUNCTION public.india_native_statutory_approval(text,date,text,text,daterange,text,text) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.india_native_statutory_approval(text,date,text,text,daterange,text,text) FROM PUBLIC,app_role,yellow_runtime;

-- One Order287 composition for both authenticated date graphs. Inputs are private
-- row-derived results. The root reader owns their complete predecessor validation.
CREATE OR REPLACE FUNCTION public.india_native_statutory_supply_nature(
  p_tenant uuid,p_comparison json,p_location json,p_supplier_status json,p_recipient_status json,p_date date
) RETURNS json LANGUAGE plpgsql IMMUTABLE
SET search_path=pg_catalog,public SET timezone='UTC' SET datestyle='ISO,YMD' AS $$
DECLARE v_supplier_sez boolean;v_recipient_sez boolean;v_same boolean;
BEGIN
  IF p_tenant IS NULL OR p_date IS NULL OR p_supplier_status->>'statusAsOf' IS DISTINCT FROM p_date::text
      OR p_recipient_status->>'statusAsOf' IS DISTINCT FROM p_date::text
      OR p_comparison->>'propertyNode' IS DISTINCT FROM p_location->>'propertyNode'
      OR p_comparison->>'propertyNode' IS DISTINCT FROM p_supplier_status->>'propertyNode'
      OR p_comparison::jsonb#>'{supplier,registrationId}' IS DISTINCT FROM p_supplier_status::jsonb#>'{supplier,registrationId}'
      OR p_comparison::jsonb#>'{supplier,evidenceHash}' IS DISTINCT FROM p_supplier_status::jsonb#>'{supplier,evidenceHash}'
      OR p_location->>'supplierServiceLocationId' IS DISTINCT FROM p_supplier_status::jsonb#>>'{supplierServiceLocation,id}'
      OR p_location->>'evidenceHash' IS DISTINCT FROM p_supplier_status::jsonb#>>'{supplierServiceLocation,evidenceHash}'
      OR p_comparison::jsonb->'recipient' IS DISTINCT FROM p_recipient_status::jsonb->'recipient' THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='statutory supply-nature common roots or evidence dates disagree';
  END IF;
  v_supplier_sez:=p_supplier_status->>'sezStatus'<>'affirmatively_non_sez_regular';
  v_recipient_sez:=p_recipient_status->>'sezStatus'<>'affirmatively_non_sez_regular';
  v_same:=p_comparison->>'stateRelationship'='same_state_or_union_territory';
  RETURN public.india_native_statutory_candidate(p_tenant,pg_catalog.json_build_object(
    'propertyNode',p_comparison->'propertyNode','reservationId',p_comparison->'reservationId','folioId',p_comparison->'folioId',
    'supplyDate',p_date,'jurisdiction',p_comparison->'jurisdiction','supplier',pg_catalog.json_build_object(
      'registrationId',p_comparison::jsonb#>'{supplier,registrationId}','evidenceHash',p_comparison::jsonb#>'{supplier,evidenceHash}',
      'stateCode',p_comparison::jsonb#>'{supplier,stateCode}','serviceLocation',pg_catalog.json_build_object(
        'id',p_location->'supplierServiceLocationId','evidenceHash',p_location->'evidenceHash','kind',p_location::jsonb#>'{registeredPlace,kind}',
        'stateCode',p_location::jsonb#>'{registeredPlace,stateCode}'),
      'status',pg_catalog.json_build_object('id',p_supplier_status->'supplierSezStatusId','evidenceHash',p_supplier_status->'evidenceHash',
        'statusAsOf',p_date,'taxpayerType',p_supplier_status::jsonb#>'{gstRegistration,taxpayerType}','sezStatus',p_supplier_status->'sezStatus')),
    'recipient',pg_catalog.json_build_object('partyId',p_comparison::jsonb#>'{recipient,partyId}','registrationId',p_comparison::jsonb#>'{recipient,registrationId}',
      'evidenceHash',p_comparison::jsonb#>'{recipient,evidenceHash}','status',pg_catalog.json_build_object(
        'id',p_recipient_status->'recipientSezStatusId','evidenceHash',p_recipient_status->'evidenceHash','statusAsOf',p_date,
        'taxpayerType',p_recipient_status::jsonb#>'{gstRegistration,taxpayerType}','sezStatus',p_recipient_status->'sezStatus')),
    'buyerAssociation',p_comparison->'buyerAssociation','classification',p_comparison->'classification','placeOfSupply',p_comparison->'placeOfSupply',
    'registeredStateComparison',pg_catalog.json_build_object('candidateHash',p_comparison->'candidateHash','comparisonRule',p_comparison->'comparisonRule',
      'stateRelationship',p_comparison->'stateRelationship'),
    'supplyNature',CASE WHEN v_supplier_sez OR v_recipient_sez OR NOT v_same THEN 'inter_state' ELSE 'intra_state' END,
    'determinationBasis',CASE WHEN v_supplier_sez OR v_recipient_sez THEN 'sez_override' ELSE 'ordinary_registered_state_comparison' END,
    'sezDirection',CASE WHEN v_supplier_sez AND v_recipient_sez THEN 'to_and_by_sez' WHEN v_recipient_sez THEN 'to_sez' WHEN v_supplier_sez THEN 'by_sez' ELSE 'none' END,
    'legalRule',CASE WHEN v_supplier_sez OR v_recipient_sez THEN 'IGST_ACT_7_5_B' WHEN v_same THEN 'IGST_ACT_8_2' ELSE 'IGST_ACT_7_3' END));
END;
$$;
ALTER FUNCTION public.india_native_statutory_supply_nature(uuid,json,json,json,json,date) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.india_native_statutory_supply_nature(uuid,json,json,json,json,date) FROM PUBLIC,app_role,yellow_runtime;

-- The final two arguments are sibling-private reconstructed transports, NOT
-- command/request input. Timing/calendar/rate authentication belongs to the
-- upstream current-transaction reader; this leaf validates its native envelope
-- and independently reconstructs all statutory rows and hashes. It cannot prove
-- a caller-supplied timing/calendar merely by recognizing a digest, and is not
-- granted to a runtime role. Preparation must own locks and repeat this leaf.
CREATE OR REPLACE FUNCTION public.read_india_native_statutory_root_graph(
  p_tenant uuid,p_property uuid,p_reservation uuid,p_folio uuid,p_valuation uuid,
  p_supplier_location uuid,p_supplier_status uuid,p_supplier_sez uuid,
  p_recipient_registration uuid,p_recipient_sez uuid,p_classification uuid,
  p_native_invoice_source text,p_family_jurisdiction text
) RETURNS TABLE(prepared_source_json text,service_supply_nature_json text,
  service_supplier_sez_status_id uuid,service_recipient_sez_status_id uuid) LANGUAGE plpgsql STABLE
SET search_path=pg_catalog,public SET timezone='UTC' SET datestyle='ISO,YMD' AS $$
DECLARE
  v_context uuid;v_source json;v_timing json;v_timing_b jsonb;v_intake jsonb;v_valuation_evidence jsonb;
  v_history jsonb;v_jurisdiction json;v_source_date date;v_tos date;v_invoice date;v_deadline date;v_payment_date date;
  v_val public.india_gst_accommodation_final_valuation%ROWTYPE;v_folio public.folio%ROWTYPE;
  v_account public.account%ROWTYPE;v_reservation public.reservation%ROWTYPE;v_property public.org_node%ROWTYPE;
  v_seller public.property_fiscal_registration%ROWTYPE;v_recipient public.party_fiscal_registration%ROWTYPE;
  v_location public.india_gst_supplier_service_location%ROWTYPE;v_status public.india_gst_supplier_registration_status_snapshot%ROWTYPE;
  v_supplier_sez public.india_gst_supplier_sez_status%ROWTYPE;v_recipient_sez public.india_gst_recipient_sez_status%ROWTYPE;
  v_class public.india_gst_item_classification%ROWTYPE;v_physical public.property_fiscal_location%ROWTYPE;
  v_seller_json json;v_recipient_json json;v_location_json json;v_status_json json;v_supplier_sez_json json;v_recipient_sez_json json;
  v_class_json json;v_physical_json json;v_supplier_ref json;v_recipient_ref json;v_location_ref json;v_class_ref json;
  v_supplier_gst json;v_recipient_gst json;v_supplier_approval json;v_recipient_approval json;v_s_sez text;v_r_sez text;
  v_body json;v_preimage json;v_buyer_details json;v_payload json;v_buyer json;v_folio_json json;v_association json;
  v_place json;v_place_ref json;v_comparison json;v_nature json;v_supplier_time json;v_recipient_time json;v_295 json;v_296 json;v_297 json;
  v_relationship text;v_nature_kind text;v_basis text;v_direction text;v_rule text;v_text text;v_hash text;
BEGIN
  BEGIN v_context:=NULLIF(pg_catalog.current_setting('app.tenant_id',true),'')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='native statutory tenant context is invalid';
  END;
  IF p_tenant IS NULL OR p_tenant IS DISTINCT FROM v_context THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='native statutory tenant mismatch';
  END IF;
  IF p_property IS NULL OR p_reservation IS NULL OR p_folio IS NULL OR p_valuation IS NULL
      OR p_supplier_location IS NULL OR p_supplier_status IS NULL OR p_supplier_sez IS NULL
      OR p_recipient_registration IS NULL OR p_recipient_sez IS NULL OR p_classification IS NULL
      OR p_native_invoice_source IS NULL OR p_family_jurisdiction IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='native statutory source selectors and internal transports are required';
  END IF;
  v_source:=p_native_invoice_source::json;v_timing:=v_source->'timing';v_timing_b:=v_timing::jsonb;
  IF pg_catalog.json_typeof(v_source) IS DISTINCT FROM 'object'
      OR (SELECT pg_catalog.array_agg(key ORDER BY key) FROM pg_catalog.json_each(v_source))
        IS DISTINCT FROM ARRAY['evidenceHash','kind','rateSource','timing']::text[]
      OR v_source->>'kind' IS DISTINCT FROM 'native_current_transaction'
      OR v_source->>'evidenceHash' IS DISTINCT FROM public.india_native_source_hash(
        (v_source::jsonb-'evidenceHash')||pg_catalog.jsonb_build_object('tenantId',p_tenant))
      OR v_timing_b->>'kind' IS DISTINCT FROM 'native_current_transaction'
      OR v_timing_b->>'propertyNode' IS DISTINCT FROM p_property::text
      OR v_timing_b->>'reservationId' IS DISTINCT FROM p_reservation::text
      OR v_timing_b->>'evidenceHash' IS DISTINCT FROM public.india_native_source_hash(
        (v_timing_b-'evidenceHash')||pg_catalog.jsonb_build_object('tenantId',p_tenant)) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='internal native invoice-source envelope is inconsistent';
  END IF;
  SELECT p.* INTO v_property FROM public.org_node p JOIN public.tenant t ON t.id=p.tenant_id AND t.status='active'
    WHERE p.tenant_id=p_tenant AND p.id=p_property AND p.kind='property';
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native statutory property unavailable'; END IF;
  v_invoice:=(pg_catalog.transaction_timestamp() AT TIME ZONE v_property.timezone)::date;
  v_source_date:=(v_timing->>'serviceProvisionDate')::date;v_tos:=(v_timing->>'timeOfSupplyDate')::date;
  v_intake:=public.read_india_native_intake_source(p_tenant,p_property,p_reservation,
    (v_timing->>'serviceProvisionSnapshotId')::uuid,(v_timing->>'paymentReceiptSnapshotId')::uuid,(v_timing->>'ordinaryRegimeEvidenceId')::uuid);
  v_payment_date:=(v_intake#>>'{paymentReceipt,paymentReceiptDate}')::date;v_deadline:=v_source_date+30;
  IF v_timing->>'invoiceIssueDate' IS DISTINCT FROM v_invoice::text
      OR v_timing->>'serviceProvisionDate' IS DISTINCT FROM v_intake#>>'{serviceProvision,serviceProvisionDate}'
      OR v_timing->>'paymentReceiptDate' IS DISTINCT FROM v_payment_date::text
      OR v_timing->>'supplierBooksEntryDate' IS DISTINCT FROM v_intake#>>'{paymentReceipt,supplierBooksEntryDate}'
      OR v_timing->>'supplierBankCreditDate' IS DISTINCT FROM v_intake#>>'{paymentReceipt,supplierBankCreditDate}'
      OR v_timing->>'amountMinor' IS DISTINCT FROM v_intake#>>'{paymentReceipt,amountMinor}'
      OR v_timing->>'currency' IS DISTINCT FROM 'INR'
      OR v_timing->>'regime' IS DISTINCT FROM 'ordinary_rule47_30_day'
      OR v_timing->>'ordinaryRegimeSource' IS DISTINCT FROM 'governed_rule47_ordinary_regime_record'
      OR v_timing->>'ordinaryRegimeLegalBasis' IS DISTINCT FROM 'CGST_RULE_47_ORDINARY_SERVICE_INVOICE_30_DAY_INPUT'
      OR v_timing->>'deadlineDate' IS DISTINCT FROM v_deadline::text
      OR v_tos IS DISTINCT FROM LEAST(CASE WHEN v_invoice<=v_deadline THEN v_invoice ELSE v_source_date END,v_payment_date)
      OR v_timing->>'branch' IS DISTINCT FROM (CASE WHEN v_invoice<=v_deadline THEN 'section13_2_a_invoice_or_payment' ELSE 'section13_2_b_service_or_payment' END)
      OR v_timing_b->'candidateDates' IS DISTINCT FROM (CASE WHEN v_invoice<=v_deadline
        THEN pg_catalog.jsonb_build_object('invoiceIssueDate',v_invoice,'paymentReceiptDate',v_payment_date)
        ELSE pg_catalog.jsonb_build_object('serviceProvisionDate',v_source_date,'paymentReceiptDate',v_payment_date) END)
      OR v_timing_b#>>'{predecessorHashes,serviceProvision}' IS DISTINCT FROM v_intake#>>'{serviceProvision,evidenceHash}'
      OR v_timing_b#>>'{predecessorHashes,paymentReceipt}' IS DISTINCT FROM v_intake#>>'{paymentReceipt,evidenceHash}'
      OR v_timing_b#>>'{predecessorHashes,ordinaryRegime}' IS DISTINCT FROM v_intake#>>'{ordinaryRegime,evidenceHash}' THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native statutory timing conflicts with authenticated intake or current property clock';
  END IF;
  -- Legal buyer and original approved override are owned by the authentic native
  -- valuation; association JSON below is NOT independent buyer-selection authority.
  v_valuation_evidence:=public.read_india_native_valuation_evidence(p_tenant,p_property,p_reservation,p_folio,p_valuation,
    (v_timing->>'serviceProvisionSnapshotId')::uuid,(v_timing->>'paymentReceiptSnapshotId')::uuid,(v_timing->>'ordinaryRegimeEvidenceId')::uuid);
  SELECT v.* INTO STRICT v_val FROM public.india_gst_accommodation_final_valuation v WHERE v.tenant_id=p_tenant AND v.id=p_valuation;
  SELECT f.* INTO v_folio FROM public.folio f WHERE f.tenant_id=p_tenant AND f.id=p_folio AND f.reservation_id=p_reservation;
  IF NOT FOUND OR v_folio.status<>'open' OR v_folio.window_no NOT BETWEEN 1 AND 20 THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native statutory folio is unavailable for preparation';
  END IF;
  SELECT a.* INTO v_account FROM public.account a WHERE a.tenant_id=p_tenant AND a.id=v_folio.account_id
    AND a.property_node=p_property AND a.role='guest' AND a.currency='INR' AND a.status='open';
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native statutory guest account unavailable'; END IF;
  SELECT r.* INTO v_reservation FROM public.reservation r WHERE r.tenant_id=p_tenant AND r.id=p_reservation
    AND r.property_node=p_property AND r.currency='INR' AND r.status NOT IN ('cancelled','no_show');
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native statutory reservation unavailable'; END IF;
  v_history:=public.read_india_native_rate_history_day(p_tenant,p_property,v_source_date);
  -- Approved history's actual global owner is NULL, verified by that reader.
  v_jurisdiction:=pg_catalog.json_build_object('extensionId',v_history#>'{selectedExtension,extensionId}','ownerTenantId',NULL,
    'key',v_history#>'{selectedExtension,key}','version',v_history#>>'{selectedExtension,version}','contentHash',v_history#>'{selectedExtension,contentHash}');
  IF p_family_jurisdiction IS DISTINCT FROM public.india_native_insertion_json(v_jurisdiction) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native family jurisdiction is not the exact service-day assigned identity';
  END IF;
  SELECT s.* INTO v_seller FROM public.property_fiscal_registration s
    WHERE s.tenant_id=p_tenant AND s.property_node=p_property AND s.scheme='in-gstin' AND s.currency='INR'
      AND s.jurisdiction_extension_id=(v_jurisdiction->>'extensionId')::uuid AND s.jurisdiction_owner_tenant_id IS NULL
      AND s.jurisdiction_key=v_jurisdiction->>'key' AND s.jurisdiction_version=(v_jurisdiction->>'version')::integer
      AND s.jurisdiction_content_hash=v_jurisdiction->>'contentHash';
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native statutory supplier registration unavailable'; END IF;
  PERFORM public.india_native_statutory_gstin(v_seller.registration_number,v_seller.region_code);
  PERFORM public.india_native_statutory_text(v_seller.legal_name,200),public.india_native_statutory_text(v_seller.trade_name,200,true),
    public.india_native_statutory_text(v_seller.address_line,300),public.india_native_statutory_text(v_seller.locality,120);
  IF v_seller.postal_code !~ '^[1-9][0-9]{5}$' THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='supplier postal code invalid'; END IF;
  v_body:=pg_catalog.json_build_object('registrationId',v_seller.id,'propertyNode',p_property,'scheme','in-gstin','currency','INR',
    'jurisdiction',v_jurisdiction,'gstin',v_seller.registration_number,'stateCode',v_seller.region_code,'legalName',v_seller.legal_name,
    'tradeName',v_seller.trade_name,'addressLine',v_seller.address_line,'locality',v_seller.locality,'postalCode',v_seller.postal_code);
  v_preimage:=pg_catalog.json_build_object('registrationId',v_seller.id,'tenantId',p_tenant,'propertyNode',p_property,'scheme','in-gstin','currency','INR',
    'jurisdiction',v_jurisdiction,'gstin',v_seller.registration_number,'stateCode',v_seller.region_code,'legalName',v_seller.legal_name,
    'tradeName',v_seller.trade_name,'addressLine',v_seller.address_line,'locality',v_seller.locality,'postalCode',v_seller.postal_code);
  v_seller_json:=public.india_native_statutory_with_hash(v_body,v_preimage);
  v_supplier_ref:=pg_catalog.json_build_object('registrationId',v_seller.id,'evidenceHash',v_seller_json->>'evidenceHash');
  SELECT r.* INTO v_recipient FROM public.party_fiscal_registration r JOIN public.party p ON p.tenant_id=r.tenant_id AND p.id=r.party_id
    AND p.status='active' AND p.merged_into IS NULL WHERE r.tenant_id=p_tenant AND r.id=p_recipient_registration
    AND r.party_id=v_val.buyer_party_id AND r.scheme='in-gstin';
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native statutory recipient is not the valuation legal buyer'; END IF;
  PERFORM public.india_native_statutory_gstin(v_recipient.registration_number,v_recipient.region_code);
  PERFORM public.india_native_statutory_text(v_recipient.legal_name,100),public.india_native_statutory_text(v_recipient.trade_name,100,true),
    public.india_native_statutory_text(v_recipient.address_line1,100),public.india_native_statutory_text(v_recipient.locality,50);
  IF v_recipient.pin !~ '^[1-9][0-9]{5}$' THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='recipient postal code invalid'; END IF;
  v_body:=pg_catalog.json_build_object('registrationId',v_recipient.id,'partyId',v_recipient.party_id,'scheme','in-gstin',
    'gstin',v_recipient.registration_number,'stateCode',v_recipient.region_code,'legalName',v_recipient.legal_name,'tradeName',v_recipient.trade_name,
    'addressLine1',v_recipient.address_line1,'locality',v_recipient.locality,'pin',v_recipient.pin);
  v_preimage:=pg_catalog.json_build_object('registrationId',v_recipient.id,'tenantId',p_tenant,'partyId',v_recipient.party_id,'scheme','in-gstin',
    'gstin',v_recipient.registration_number,'stateCode',v_recipient.region_code,'legalName',v_recipient.legal_name,'tradeName',v_recipient.trade_name,
    'addressLine1',v_recipient.address_line1,'locality',v_recipient.locality,'pin',v_recipient.pin);
  v_recipient_json:=public.india_native_statutory_with_hash(v_body,v_preimage);
  v_recipient_ref:=pg_catalog.json_build_object('partyId',v_recipient.party_id,'registrationId',v_recipient.id,'evidenceHash',v_recipient_json->>'evidenceHash');
  SELECT l.* INTO v_location FROM public.india_gst_supplier_service_location l WHERE l.tenant_id=p_tenant AND l.id=p_supplier_location
    AND l.supplier_registration_id=v_seller.id AND l.supplier_evidence_hash=v_seller_json->>'evidenceHash'
    AND l.service_scope='lodging_accommodation' AND l.registered_place_kind IN ('principal_place_of_business','additional_place_of_business')
    AND l.location_basis='supply_made_from_registered_place_of_business' AND l.legal_rule='IGST_ACT_2_15_A';
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native supplier service-location ancestry unavailable'; END IF;
  v_location_json:=public.india_native_statutory_tenant_hash(p_tenant,pg_catalog.json_build_object('supplierServiceLocationId',v_location.id,
    'propertyNode',p_property,'jurisdiction',v_jurisdiction,'supplier',v_supplier_ref,'serviceScope',v_location.service_scope,
    'registeredPlace',pg_catalog.json_build_object('kind',v_location.registered_place_kind,'stateCode',v_seller.region_code,
      'addressLine',v_seller.address_line,'locality',v_seller.locality,'postalCode',v_seller.postal_code),
    'locationBasis',v_location.location_basis,'legalRule',v_location.legal_rule));
  v_location_ref:=pg_catalog.json_build_object('id',v_location.id,'evidenceHash',v_location_json->>'evidenceHash');
  SELECT s.* INTO v_status FROM public.india_gst_supplier_registration_status_snapshot s WHERE s.tenant_id=p_tenant AND s.id=p_supplier_status
    AND s.supplier_registration_id=v_seller.id AND s.supplier_registration_evidence_hash=v_seller_json->>'evidenceHash'
    AND s.status_as_of=v_tos AND s.gst_registration_status='active' AND s.gst_status_source='gst_common_portal'
    AND s.gst_taxpayer_type IN ('regular','sez_unit','sez_developer') AND s.legal_rule='CGST_ACT_25_29_30_AND_RULE_21A_REGISTRATION_STATUS';
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native supplier registration status unavailable at time of supply'; END IF;
  v_supplier_gst:=pg_catalog.json_build_object('status','active','taxpayerType',v_status.gst_taxpayer_type,'source','gst_common_portal','evidenceSha256',v_status.gst_status_evidence_sha256);
  v_status_json:=public.india_native_statutory_tenant_hash(p_tenant,pg_catalog.json_build_object('supplierGstRegistrationStatusId',v_status.id,
    'propertyNode',p_property,'supplierServiceLocation',v_location_ref,'supplier',v_supplier_ref,'statusAsOf',v_tos,
    'gstRegistration',v_supplier_gst,'legalRule',v_status.legal_rule));
  SELECT s.* INTO v_supplier_sez FROM public.india_gst_supplier_sez_status s WHERE s.tenant_id=p_tenant AND s.id=p_supplier_sez
    AND s.supplier_registration_id=v_seller.id AND s.supplier_registration_evidence_hash=v_seller_json->>'evidenceHash'
    AND s.status_as_of=v_tos AND s.gst_registration_status='active' AND s.gst_status_source='gst_common_portal'
    AND s.gst_taxpayer_type=v_status.gst_taxpayer_type AND s.gst_status_evidence_sha256=v_status.gst_status_evidence_sha256
    AND s.legal_rule='IGST_ACT_7_5_B_AND_8_2_SUPPLIER_STATUS';
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native distinct supplier SEZ status conflicts with portal registration status'; END IF;
  v_supplier_approval:=public.india_native_statutory_approval(v_supplier_sez.gst_taxpayer_type,v_tos,v_supplier_sez.approval_form,
    v_supplier_sez.approval_reference,v_supplier_sez.approval_validity,v_supplier_sez.approval_status,v_supplier_sez.approval_evidence_sha256);
  v_s_sez:=CASE v_supplier_sez.gst_taxpayer_type WHEN 'regular' THEN 'affirmatively_non_sez_regular' ELSE v_supplier_sez.gst_taxpayer_type END;
  v_supplier_sez_json:=public.india_native_statutory_tenant_hash(p_tenant,pg_catalog.json_build_object('supplierSezStatusId',v_supplier_sez.id,
    'propertyNode',p_property,'supplierServiceLocation',v_location_ref,'supplier',v_supplier_ref,'statusAsOf',v_tos,
    'gstRegistration',v_supplier_gst,'sezStatus',v_s_sez,'approval',v_supplier_approval,'legalRule',v_supplier_sez.legal_rule));
  SELECT r.* INTO v_recipient_sez FROM public.india_gst_recipient_sez_status r WHERE r.tenant_id=p_tenant AND r.id=p_recipient_sez
    AND r.recipient_registration_id=v_recipient.id AND r.recipient_registration_evidence_hash=v_recipient_json->>'evidenceHash'
    AND r.status_as_of=v_tos AND r.gst_registration_status='active' AND r.gst_status_source='gst_common_portal'
    AND r.gst_taxpayer_type IN ('regular','sez_unit','sez_developer') AND r.legal_rule='IGST_ACT_7_5_B_AND_8_2_RECIPIENT_STATUS';
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native recipient status unavailable at time of supply'; END IF;
  v_recipient_approval:=public.india_native_statutory_approval(v_recipient_sez.gst_taxpayer_type,v_tos,v_recipient_sez.approval_form,
    v_recipient_sez.approval_reference,v_recipient_sez.approval_validity,v_recipient_sez.approval_status,v_recipient_sez.approval_evidence_sha256);
  v_r_sez:=CASE v_recipient_sez.gst_taxpayer_type WHEN 'regular' THEN 'affirmatively_non_sez_regular' ELSE v_recipient_sez.gst_taxpayer_type END;
  v_recipient_gst:=pg_catalog.json_build_object('status','active','taxpayerType',v_recipient_sez.gst_taxpayer_type,'source','gst_common_portal','evidenceSha256',v_recipient_sez.gst_status_evidence_sha256);
  v_recipient_sez_json:=public.india_native_statutory_tenant_hash(p_tenant,pg_catalog.json_build_object('recipientSezStatusId',v_recipient_sez.id,
    'recipient',v_recipient_ref,'statusAsOf',v_tos,'gstRegistration',v_recipient_gst,'sezStatus',v_r_sez,'approval',v_recipient_approval,'legalRule',v_recipient_sez.legal_rule));
  SELECT c.* INTO v_class FROM public.india_gst_item_classification c WHERE c.tenant_id=p_tenant AND c.id=p_classification AND c.property_node=p_property
    AND c.jurisdiction_extension_id=v_seller.jurisdiction_extension_id AND c.jurisdiction_owner_tenant_id IS NOT DISTINCT FROM v_seller.jurisdiction_owner_tenant_id
    AND c.jurisdiction_key=v_seller.jurisdiction_key AND c.jurisdiction_version=v_seller.jurisdiction_version AND c.jurisdiction_content_hash=v_seller.jurisdiction_content_hash
    AND c.country_code='IN' AND c.line_id='room' AND c.revenue_group='room_revenue' AND c.classification_system='SAC'
    AND c.classification_code IN ('996311','996312','996313','996321','996322','996329') AND c.is_service_code='Y';
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native statutory accommodation classification unavailable'; END IF;
  v_class_json:=public.india_native_statutory_tenant_hash(p_tenant,pg_catalog.json_build_object('classificationId',v_class.id,'propertyNode',p_property,
    'jurisdiction',v_jurisdiction,'lineId','room','revenueGroup','room_revenue','classificationSystem','SAC','classificationCode',v_class.classification_code,'isServiceCode','Y'));
  v_class_ref:=pg_catalog.json_build_object('classificationId',v_class.id,'evidenceHash',v_class_json->>'evidenceHash');
  SELECT l.* INTO v_physical FROM public.property_fiscal_location l WHERE l.tenant_id=p_tenant AND l.property_node=p_property AND l.country_code='IN';
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native physical property fiscal location unavailable'; END IF;
  PERFORM public.india_native_statutory_text(v_physical.address_line1,100),public.india_native_statutory_text(v_physical.locality,50);
  v_physical_json:=public.india_native_statutory_tenant_hash(p_tenant,pg_catalog.json_build_object('propertyNode',p_property,'countryCode','IN',
    'stateCode',v_physical.state_code,'addressLine1',v_physical.address_line1,'locality',v_physical.locality,'pin',v_physical.pin));
  IF v_recipient.trade_name IS NULL THEN
    v_buyer_details:=pg_catalog.json_build_object('Gstin',v_recipient.registration_number,'LglNm',v_recipient.legal_name,
      'Addr1',v_recipient.address_line1,'Loc',v_recipient.locality,'Pin',v_recipient.pin::integer,'Stcd',v_recipient.region_code);
  ELSE
    v_buyer_details:=pg_catalog.json_build_object('Gstin',v_recipient.registration_number,'LglNm',v_recipient.legal_name,'TrdNm',v_recipient.trade_name,
      'Addr1',v_recipient.address_line1,'Loc',v_recipient.locality,'Pin',v_recipient.pin::integer,'Stcd',v_recipient.region_code);
  END IF;
  v_payload:=pg_catalog.json_build_object('BuyerDtls',v_buyer_details);
  v_buyer:=pg_catalog.json_build_object('format','irp_json_1_1','payload',v_payload,
    'payloadJson',public.india_native_insertion_json(v_payload),'payloadHash',public.india_native_statutory_digest(v_payload));
  v_folio_json:=pg_catalog.json_build_object('folioId',p_folio,'accountId',v_account.id,'reservationId',p_reservation,'windowNo',v_folio.window_no,
    'folioStatus',v_folio.status,'accountRole',v_account.role,'accountStatus',v_account.status,'reservationStatus',v_reservation.status,'currency','INR','propertyNode',p_property);
  v_association:=pg_catalog.json_build_object('associationHash',public.india_native_statutory_digest(pg_catalog.json_build_object(
    'folio',v_folio_json,'recipient',v_recipient_ref,'buyer',v_buyer)),'payloadHash',v_buyer->>'payloadHash');
  v_place:=public.india_native_statutory_candidate(p_tenant,pg_catalog.json_build_object('propertyNode',p_property,'reservationId',p_reservation,
    'folioId',p_folio,'jurisdiction',v_jurisdiction,'supplier',v_supplier_ref,'recipient',v_recipient_ref,'buyerAssociation',v_association,
    'classification',v_class_ref,'propertyLocation',pg_catalog.json_build_object('propertyNode',p_property,'evidenceHash',v_physical_json->>'evidenceHash'),
    'legalRule','IGST_ACT_12_3_B','pos',v_physical.state_code));
  v_place_ref:=pg_catalog.json_build_object('candidateHash',v_place->>'candidateHash','legalRule','IGST_ACT_12_3_B','pos',v_physical.state_code);
  v_relationship:=CASE WHEN v_seller.region_code=v_physical.state_code THEN 'same_state_or_union_territory' ELSE 'different_state_or_union_territory' END;
  v_comparison:=public.india_native_statutory_candidate(p_tenant,pg_catalog.json_build_object('propertyNode',p_property,'reservationId',p_reservation,
    'folioId',p_folio,'jurisdiction',v_jurisdiction,'supplier',pg_catalog.json_build_object('registrationId',v_seller.id,'evidenceHash',v_seller_json->>'evidenceHash',
      'stateCode',v_seller.region_code),'recipient',v_recipient_ref,'buyerAssociation',v_association,'classification',v_class_ref,'placeOfSupply',v_place_ref,
    'comparisonRule','SUPPLIER_REGISTERED_STATE_VS_ACCOMMODATION_POS','stateRelationship',v_relationship));
  v_nature_kind:=CASE WHEN v_s_sez<>'affirmatively_non_sez_regular' OR v_r_sez<>'affirmatively_non_sez_regular'
    OR v_relationship='different_state_or_union_territory' THEN 'inter_state' ELSE 'intra_state' END;
  v_basis:=CASE WHEN v_s_sez<>'affirmatively_non_sez_regular' OR v_r_sez<>'affirmatively_non_sez_regular' THEN 'sez_override' ELSE 'ordinary_registered_state_comparison' END;
  v_direction:=CASE WHEN v_s_sez<>'affirmatively_non_sez_regular' AND v_r_sez<>'affirmatively_non_sez_regular' THEN 'to_and_by_sez'
    WHEN v_r_sez<>'affirmatively_non_sez_regular' THEN 'to_sez' WHEN v_s_sez<>'affirmatively_non_sez_regular' THEN 'by_sez' ELSE 'none' END;
  v_rule:=CASE WHEN v_basis='sez_override' THEN 'IGST_ACT_7_5_B' WHEN v_nature_kind='intra_state' THEN 'IGST_ACT_8_2' ELSE 'IGST_ACT_7_3' END;
  v_nature:=public.india_native_statutory_supply_nature(p_tenant,v_comparison,v_location_json,v_supplier_sez_json,v_recipient_sez_json,v_tos);
  v_body:=pg_catalog.json_build_object('kind','native_current_transaction','nativeTiming',v_timing);
  v_supplier_time:=public.india_native_statutory_with_hash(v_body,v_body);
  v_recipient_time:=public.india_native_statutory_tenant_hash(p_tenant,v_body);
  v_295:=public.india_native_statutory_tenant_hash(p_tenant,pg_catalog.json_build_object('kind','native_current_transaction',
    'supplierRegistrationId',v_seller.id,'supplierGstRegistrationStatusId',v_status.id,'supplierServiceLocationId',v_location.id,
    'propertyNode',p_property,'reservationId',p_reservation,'statusAsOf',v_tos,'timeOfSupplyDate',v_tos,'result','active_at_time_of_supply',
    'supplierServiceLocation',v_location_ref,'supplier',v_supplier_ref,'gstRegistration',v_supplier_gst,
    'supplierRegistrationStatusEvidenceHash',v_status_json->>'evidenceHash','invoiceSourceEvidenceHash',v_source->>'evidenceHash',
    'timeOfSupplyEvidenceHash',v_supplier_time->>'evidenceHash','timeOfSupply',v_supplier_time,'registrationLegalRule',v_status.legal_rule,
    'timeOfSupplyLegalRule','CGST_ACT_13_2_A_OR_B_ORDINARY_TIME_OF_SUPPLY'));
  v_296:=public.india_native_statutory_tenant_hash(p_tenant,pg_catalog.json_build_object('kind','native_current_transaction',
    'recipientPartyId',v_recipient.party_id,'recipientRegistrationId',v_recipient.id,'recipientSezStatusId',v_recipient_sez.id,
    'propertyNode',p_property,'reservationId',p_reservation,'statusAsOf',v_tos,'timeOfSupplyDate',v_tos,'result','active_recipient_registration_at_time_of_supply',
    'recipient',pg_catalog.json_build_object('registrationId',v_recipient.id,'evidenceHash',v_recipient_json->>'evidenceHash'),
    'gstRegistration',v_recipient_gst,'sezStatus',v_r_sez,'approval',v_recipient_approval,'recipientRegistrationStatusEvidenceHash',v_recipient_sez_json->>'evidenceHash',
    'invoiceSourceEvidenceHash',v_source->>'evidenceHash','timeOfSupplyEvidenceHash',v_recipient_time->>'evidenceHash','timeOfSupply',v_recipient_time,
    'recipientRegistrationLegalRule',v_recipient_sez.legal_rule,'timeOfSupplyLegalRule','CGST_ACT_13_2_A_OR_B_ORDINARY_TIME_OF_SUPPLY'));
  v_297:=public.india_native_statutory_tenant_hash(p_tenant,pg_catalog.json_build_object('kind','native_current_transaction',
    'propertyNode',p_property,'reservationId',p_reservation,'folioId',p_folio,'supplyDate',v_tos,'supplyNature',v_nature_kind,
    'determinationBasis',v_basis,'sezDirection',v_direction,'legalRule',v_rule,'supplierRegistrationId',v_seller.id,
    'supplierGstRegistrationStatusId',v_status.id,'supplierServiceLocationId',v_location.id,'supplierRegistrationStatusEvidenceHash',v_status_json->>'evidenceHash',
    'supplierSezStatusId',v_supplier_sez.id,'supplierSezStatusEvidenceHash',v_supplier_sez_json->>'evidenceHash','recipientPartyId',v_recipient.party_id,
    'recipientRegistrationId',v_recipient.id,'recipientSezStatusId',v_recipient_sez.id,'recipientRegistrationStatusEvidenceHash',v_recipient_sez_json->>'evidenceHash',
    'timeOfSupplyDate',v_tos,'supplierTimeOfSupplyEvidenceHash',v_supplier_time->>'evidenceHash','recipientTimeOfSupplyEvidenceHash',v_recipient_time->>'evidenceHash',
    'invoiceSourceEvidenceHash',v_source->>'evidenceHash','nativeTimingEvidenceHash',v_timing->>'evidenceHash','result','supply_nature_and_registrations_bound_at_time_of_supply'));
  prepared_source_json:=public.india_native_insertion_json(pg_catalog.json_build_object('tenantId',p_tenant,'legalBuyerPartyId',v_val.buyer_party_id,
    'sellerRegistration',v_seller_json,'recipientRegistration',v_recipient_json,'placeOfSupply',v_place,'classification',v_class_json,
    'supplyNatureAtTimeOfSupplyInput',pg_catalog.json_build_object('tenantId',p_tenant,'supplyNature',v_nature,
      'supplierRegistrationAtTimeOfSupply',v_295,'supplierSezStatus',v_supplier_sez_json,'recipientRegistrationAtTimeOfSupply',v_296),
    'supplyNatureAtTimeOfSupplyResult',v_297));
  -- Service-day component-family ancestry is a distinct governed date graph.
  -- These unique lookups do not re-date the explicit TOS selectors above.
  BEGIN
    SELECT s.* INTO STRICT v_supplier_sez FROM public.india_gst_supplier_sez_status s WHERE s.tenant_id=p_tenant
      AND s.supplier_registration_id=v_seller.id AND s.supplier_registration_evidence_hash=v_seller_json->>'evidenceHash'
      AND s.status_as_of=v_source_date AND s.gst_registration_status='active' AND s.gst_status_source='gst_common_portal'
      AND s.gst_taxpayer_type IN ('regular','sez_unit','sez_developer') AND s.legal_rule='IGST_ACT_7_5_B_AND_8_2_SUPPLIER_STATUS';
  EXCEPTION WHEN no_data_found OR too_many_rows THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native service-day supplier SEZ evidence unavailable or ambiguous';
  END;
  BEGIN
    SELECT r.* INTO STRICT v_recipient_sez FROM public.india_gst_recipient_sez_status r WHERE r.tenant_id=p_tenant
      AND r.recipient_registration_id=v_recipient.id AND r.recipient_registration_evidence_hash=v_recipient_json->>'evidenceHash'
      AND r.status_as_of=v_source_date AND r.gst_registration_status='active' AND r.gst_status_source='gst_common_portal'
      AND r.gst_taxpayer_type IN ('regular','sez_unit','sez_developer') AND r.legal_rule='IGST_ACT_7_5_B_AND_8_2_RECIPIENT_STATUS';
  EXCEPTION WHEN no_data_found OR too_many_rows THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native service-day recipient SEZ evidence unavailable or ambiguous';
  END;
  service_supplier_sez_status_id:=v_supplier_sez.id;service_recipient_sez_status_id:=v_recipient_sez.id;
  v_supplier_gst:=pg_catalog.json_build_object('status','active','taxpayerType',v_supplier_sez.gst_taxpayer_type,'source','gst_common_portal','evidenceSha256',v_supplier_sez.gst_status_evidence_sha256);
  v_recipient_gst:=pg_catalog.json_build_object('status','active','taxpayerType',v_recipient_sez.gst_taxpayer_type,'source','gst_common_portal','evidenceSha256',v_recipient_sez.gst_status_evidence_sha256);
  v_supplier_approval:=public.india_native_statutory_approval(v_supplier_sez.gst_taxpayer_type,v_source_date,v_supplier_sez.approval_form,
    v_supplier_sez.approval_reference,v_supplier_sez.approval_validity,v_supplier_sez.approval_status,v_supplier_sez.approval_evidence_sha256);
  v_recipient_approval:=public.india_native_statutory_approval(v_recipient_sez.gst_taxpayer_type,v_source_date,v_recipient_sez.approval_form,
    v_recipient_sez.approval_reference,v_recipient_sez.approval_validity,v_recipient_sez.approval_status,v_recipient_sez.approval_evidence_sha256);
  v_s_sez:=CASE v_supplier_sez.gst_taxpayer_type WHEN 'regular' THEN 'affirmatively_non_sez_regular' ELSE v_supplier_sez.gst_taxpayer_type END;
  v_r_sez:=CASE v_recipient_sez.gst_taxpayer_type WHEN 'regular' THEN 'affirmatively_non_sez_regular' ELSE v_recipient_sez.gst_taxpayer_type END;
  v_supplier_sez_json:=public.india_native_statutory_tenant_hash(p_tenant,pg_catalog.json_build_object('supplierSezStatusId',v_supplier_sez.id,
    'propertyNode',p_property,'supplierServiceLocation',v_location_ref,'supplier',v_supplier_ref,'statusAsOf',v_source_date,
    'gstRegistration',v_supplier_gst,'sezStatus',v_s_sez,'approval',v_supplier_approval,'legalRule',v_supplier_sez.legal_rule));
  v_recipient_sez_json:=public.india_native_statutory_tenant_hash(p_tenant,pg_catalog.json_build_object('recipientSezStatusId',v_recipient_sez.id,
    'recipient',v_recipient_ref,'statusAsOf',v_source_date,'gstRegistration',v_recipient_gst,'sezStatus',v_r_sez,'approval',v_recipient_approval,'legalRule',v_recipient_sez.legal_rule));
  service_supply_nature_json:=public.india_native_insertion_json(public.india_native_statutory_supply_nature(
    p_tenant,v_comparison,v_location_json,v_supplier_sez_json,v_recipient_sez_json,v_source_date));
  RETURN NEXT;
END;
$$;
ALTER FUNCTION public.read_india_native_statutory_root_graph(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,text) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.read_india_native_statutory_root_graph(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,text) FROM PUBLIC,app_role,yellow_runtime;

CREATE OR REPLACE FUNCTION public.read_india_native_prepared_statutory_source(
  p_tenant uuid,p_property uuid,p_reservation uuid,p_folio uuid,p_valuation uuid,
  p_supplier_location uuid,p_supplier_status uuid,p_supplier_sez uuid,
  p_recipient_registration uuid,p_recipient_sez uuid,p_classification uuid,
  p_native_invoice_source text,p_family_jurisdiction text
) RETURNS text LANGUAGE sql STABLE
SET search_path=pg_catalog,public SET timezone='UTC' SET datestyle='ISO,YMD' AS $$
  SELECT g.prepared_source_json FROM public.read_india_native_statutory_root_graph(
    p_tenant,p_property,p_reservation,p_folio,p_valuation,p_supplier_location,p_supplier_status,p_supplier_sez,
    p_recipient_registration,p_recipient_sez,p_classification,p_native_invoice_source,p_family_jurisdiction) g
$$;
ALTER FUNCTION public.read_india_native_prepared_statutory_source(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,text) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.read_india_native_prepared_statutory_source(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,text) FROM PUBLIC,app_role,yellow_runtime;

-- Stage4 statutory subset only. The enclosing preparation first locks the
-- tenant/property/actor/grant graph, valuation/approval/buyer relationships and
-- active legal-buyer party, intake/lineage/extensions, and Financials sources.
-- It calls this stage before day/series locks and the D99 publication lock.
-- No new source membership is chased after discovery: a changed graph fails.
-- SHARE, rather than KEY SHARE, also stabilizes non-key configuration columns.
CREATE OR REPLACE FUNCTION public.lock_india_native_statutory_source_graph(
  p_tenant uuid,p_property uuid,p_reservation uuid,p_folio uuid,p_valuation uuid,
  p_supplier_location uuid,p_supplier_status uuid,p_supplier_sez uuid,
  p_recipient_registration uuid,p_recipient_sez uuid,p_classification uuid,
  p_native_invoice_source text,p_family_jurisdiction text
) RETURNS TABLE(prepared_source_json text,service_supply_nature_json text,
  service_supplier_sez_status_id uuid,service_recipient_sez_status_id uuid) LANGUAGE plpgsql VOLATILE
SET search_path=pg_catalog,public SET timezone='UTC' SET datestyle='ISO,YMD' AS $$
DECLARE v_before record;v_after record;v_seller uuid;v_id uuid;
BEGIN
  SELECT g.* INTO STRICT v_before FROM public.read_india_native_statutory_root_graph(
    p_tenant,p_property,p_reservation,p_folio,p_valuation,p_supplier_location,p_supplier_status,p_supplier_sez,
    p_recipient_registration,p_recipient_sez,p_classification,p_native_invoice_source,p_family_jurisdiction) g;
  v_seller:=(v_before.prepared_source_json::json#>>'{sellerRegistration,registrationId}')::uuid;

  -- Each statement locks one exact row; the two dated sets use UUID order.
  PERFORM 1 FROM public.property_fiscal_registration r
    WHERE r.tenant_id=p_tenant AND r.id=v_seller FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native statutory seller disappeared before lock'; END IF;
  PERFORM 1 FROM public.party_fiscal_registration r
    WHERE r.tenant_id=p_tenant AND r.id=p_recipient_registration FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native statutory recipient disappeared before lock'; END IF;
  PERFORM 1 FROM public.india_gst_supplier_service_location r
    WHERE r.tenant_id=p_tenant AND r.id=p_supplier_location FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native statutory service location disappeared before lock'; END IF;
  PERFORM 1 FROM public.india_gst_supplier_registration_status_snapshot r
    WHERE r.tenant_id=p_tenant AND r.id=p_supplier_status FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native statutory supplier registration status disappeared before lock'; END IF;
  FOR v_id IN SELECT DISTINCT s.id FROM pg_catalog.unnest(ARRAY[p_supplier_sez,v_before.service_supplier_sez_status_id]) s(id) ORDER BY s.id LOOP
    PERFORM 1 FROM public.india_gst_supplier_sez_status r
      WHERE r.tenant_id=p_tenant AND r.id=v_id FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native statutory supplier SEZ status disappeared before lock'; END IF;
  END LOOP;
  FOR v_id IN SELECT DISTINCT s.id FROM pg_catalog.unnest(ARRAY[p_recipient_sez,v_before.service_recipient_sez_status_id]) s(id) ORDER BY s.id LOOP
    PERFORM 1 FROM public.india_gst_recipient_sez_status r
      WHERE r.tenant_id=p_tenant AND r.id=v_id FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native statutory recipient SEZ status disappeared before lock'; END IF;
  END LOOP;
  PERFORM 1 FROM public.india_gst_item_classification r
    WHERE r.tenant_id=p_tenant AND r.id=p_classification FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native statutory classification disappeared before lock'; END IF;
  PERFORM 1 FROM public.property_fiscal_location r
    WHERE r.tenant_id=p_tenant AND r.property_node=p_property FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native statutory property location disappeared before lock'; END IF;

  -- Separate command in this VOLATILE wrapper obtains a fresh READ COMMITTED
  -- snapshot after any wait. Exact transport bytes preserve insertion hashes.
  SELECT g.* INTO STRICT v_after FROM public.read_india_native_statutory_root_graph(
    p_tenant,p_property,p_reservation,p_folio,p_valuation,p_supplier_location,p_supplier_status,p_supplier_sez,
    p_recipient_registration,p_recipient_sez,p_classification,p_native_invoice_source,p_family_jurisdiction) g;
  IF v_before.prepared_source_json IS DISTINCT FROM v_after.prepared_source_json
      OR v_before.service_supply_nature_json IS DISTINCT FROM v_after.service_supply_nature_json
      OR v_before.service_supplier_sez_status_id IS DISTINCT FROM v_after.service_supplier_sez_status_id
      OR v_before.service_recipient_sez_status_id IS DISTINCT FROM v_after.service_recipient_sez_status_id THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native statutory source graph changed during ordered locking';
  END IF;
  RETURN QUERY SELECT v_after.prepared_source_json,v_after.service_supply_nature_json,
    v_after.service_supplier_sez_status_id,v_after.service_recipient_sez_status_id;
END;
$$;
ALTER FUNCTION public.lock_india_native_statutory_source_graph(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,text) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.lock_india_native_statutory_source_graph(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,text) FROM PUBLIC,app_role,yellow_runtime;

-- End historical 0076-native-statutory.sql

-- Begin historical 0076-native-completion.sql
-- Order434 / D1362. Private native-v2 fiscal completion only.
--
-- This fragment is assembled into the eventual 0076 migration only after the
-- complete prepare/commit proof passes. It grants no runtime capability. The
-- fresh writer consumes the locks and roots established by preparation; it does
-- not acquire a new lock on any pre-existing row after the D99 publication lock.

CREATE OR REPLACE FUNCTION public.india_native_completion_minor_text(p_minor bigint)
RETURNS text LANGUAGE sql IMMUTABLE STRICT SET search_path=pg_catalog,public AS $$
  SELECT (p_minor/100)::text||'.'||pg_catalog.lpad((p_minor%100)::text,2,'0')
$$;
ALTER FUNCTION public.india_native_completion_minor_text(bigint) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.india_native_completion_minor_text(bigint)
  FROM PUBLIC,app_role,yellow_runtime;

CREATE OR REPLACE FUNCTION public.india_native_completion_rate_text(p_basis_points integer)
RETURNS text LANGUAGE sql IMMUTABLE STRICT SET search_path=pg_catalog,public AS $$
  SELECT (p_basis_points/100)::text||'.'||pg_catalog.lpad((p_basis_points%100)::text,2,'0')
$$;
ALTER FUNCTION public.india_native_completion_rate_text(integer) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.india_native_completion_rate_text(integer)
  FROM PUBLIC,app_role,yellow_runtime;

CREATE OR REPLACE FUNCTION public.india_native_completion_json_hash(p_value json)
RETURNS text LANGUAGE sql IMMUTABLE STRICT SET search_path=pg_catalog,public AS $$
  SELECT pg_catalog.encode(public.digest(pg_catalog.convert_to(
    public.india_native_insertion_json(p_value),'UTF8'),'sha256'),'hex')
$$;
ALTER FUNCTION public.india_native_completion_json_hash(json) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.india_native_completion_json_hash(json)
  FROM PUBLIC,app_role,yellow_runtime;

-- Reconstruct the exact Order413 -> Order426 -> Order429 TypeScript preimages
-- from authenticated native preparation/accounting roots. JSON (not jsonb) is
-- used throughout so the original composer insertion order remains observable.
CREATE OR REPLACE FUNCTION public.compose_india_native_fiscal_completion_evidence(
  p_tenant uuid,p_native_timing uuid
) RETURNS jsonb LANGUAGE plpgsql VOLATILE
SET search_path=pg_catalog,public SET timezone='UTC' SET datestyle='ISO,YMD' AS $$
DECLARE
  n public.india_gst_native_invoice_timing%ROWTYPE;
  a public.india_gst_accommodation_quoted_rate_applicability%ROWTYPE;
  t public.india_gst_accommodation_final_component_tax%ROWTYPE;
  b public.india_gst_accommodation_final_component_tax_journal_binding%ROWTYPE;
  v public.india_gst_accommodation_final_valuation%ROWTYPE;
  v_auth jsonb;v_prepared json;v_closure jsonb;
  v_financial_body json;v_financial json;v_financial_hash text;
  v_seller json;v_seller_payload json;v_seller_details json;v_seller_payload_text text;v_seller_payload_hash text;
  v_buyer json;v_buyer_payload json;v_buyer_details json;v_buyer_payload_text text;v_buyer_payload_hash text;
  v_family_body json;v_family_result json;v_family_hash text;v_family text;v_family_rule text;
  v_source_body json;v_source json;v_source_preimage json;v_source_hash text;
  v_predecessors json;v_accounts json;v_roots json;v_sources json;v_nights json;v_components json;v_lines json;
  v_item record;v_irp json;v_compat_irp json;v_lineage json;v_component_lineage json;
  v_items json:='[]'::json;v_compat_items json:='[]'::json;
  v_item_texts text[]:='{}'::text[];v_compat_item_texts text[]:='{}'::text[];v_item_count integer:=0;
  v_tax_component bigint;v_state_component bigint;v_total bigint;
  v_supply_body json;v_supply_hash text;v_transaction_payload json;v_transaction_body json;v_transaction_hash text;
  v_party_payload json;v_party_body json;v_party_hash text;
  v_item_body json;v_item_hash text;v_value_fields json;v_value_body json;v_value_hash text;
  v_base_sections json;v_base_sections_text text;v_base_pre_body json;v_base_pre json;v_base_pre_hash text;
  v_compat_body json;v_compat_hash text;v_sections json;v_sections_text text;
  v_pre_body json;v_pre json;v_pre_hash text;v_readiness_body json;v_readiness_hash text;
BEGIN
  IF p_tenant IS NULL OR p_native_timing IS NULL OR p_tenant IS DISTINCT FROM
      NULLIF(pg_catalog.current_setting('app.tenant_id',true),'')::uuid THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='native completion evidence requires its tenant context';
  END IF;
  v_auth:=public.assert_india_native_preparation_authenticity(p_tenant,p_native_timing);
  SELECT timing.* INTO n FROM public.india_gst_native_invoice_timing timing
    WHERE timing.tenant_id=p_tenant AND timing.id=p_native_timing;
  SELECT app.* INTO a FROM public.india_gst_accommodation_quoted_rate_applicability app
    WHERE app.tenant_id=p_tenant AND app.id=n.applicability_id AND app.native_timing_id=n.id;
  SELECT tax.* INTO t FROM public.india_gst_accommodation_final_component_tax tax
    WHERE tax.tenant_id=p_tenant AND tax.id=n.tax_id AND tax.native_timing_id=n.id;
  SELECT binding.* INTO b FROM public.india_gst_accommodation_final_component_tax_journal_binding binding
    WHERE binding.tenant_id=p_tenant AND binding.id=n.accounting_binding_id AND binding.native_timing_id=n.id;
  SELECT valuation.* INTO v FROM public.india_gst_accommodation_final_valuation valuation
    WHERE valuation.tenant_id=p_tenant AND valuation.id=n.valuation_id;
  IF n.id IS NULL OR a.id IS NULL OR t.id IS NULL OR b.id IS NULL OR v.id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native completion roots are unavailable';
  END IF;
  PERFORM public.assert_india_native_accounting_binding(p_tenant,b.id);
  IF b.accounting_kind<>'native_component_tax_delta' OR b.invoice_source_kind<>'native_current_transaction'
      OR b.tax_id<>t.id OR b.valuation_id<>v.id OR b.applicability_id<>a.id
      OR b.property_node<>n.property_node OR b.reservation_id<>n.reservation_id OR b.folio_id<>n.folio_id
      OR b.guest_account_id<>n.folio_account_id OR b.posted_by<>n.actor_id
      OR b.business_date<>n.invoice_issue_date OR b.posted_at<>n.transaction_timestamp
      OR b.currency<>'INR' OR b.native_tax_minor<>t.tax_minor
      OR b.native_source_basis_hash<>n.native_source_basis_hash
      OR b.native_consideration_basis_hash<>n.native_consideration_basis_hash
      OR t.invoice_source_kind<>'native_current_transaction' OR t.valuation_basis_kind<>'native_consideration'
      OR a.invoice_source_kind<>'native_current_transaction' OR a.valuation_basis_kind<>'native_consideration'
      OR v.basis_kind<>'native_consideration' OR v.disposition<>'ordinary_final' OR v.currency<>'INR'
      OR t.transaction_value_minor<>v.transaction_value_minor OR t.tax_minor<0
      OR t.grand_total_minor<>t.transaction_value_minor+t.tax_minor
      OR EXISTS(SELECT 1 FROM public.india_gst_accommodation_final_component_tax successor
        WHERE successor.tenant_id=p_tenant AND successor.supersedes_tax_id=t.id)
      OR EXISTS(SELECT 1 FROM public.india_gst_accommodation_final_valuation successor
        WHERE successor.tenant_id=p_tenant AND successor.supersedes_valuation_id=v.id)
      OR (b.journal_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.journal reversal
        WHERE reversal.tenant_id=p_tenant AND reversal.reverses=b.journal_id)) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native completion financial roots are inconsistent';
  END IF;

  v_prepared:=(v_auth->>'preparedSourceCanonicalJson')::json;
  v_closure:=public.read_india_native_valuation_source_closure(
    p_tenant,n.property_node,n.reservation_id,n.folio_id,n.valuation_id);
  IF v_closure->>'accountId' IS DISTINCT FROM n.folio_account_id::text THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native completion consideration account is inconsistent';
  END IF;
  SELECT pg_catalog.json_agg(value ORDER BY value) INTO v_accounts
    FROM pg_catalog.jsonb_array_elements_text(v_closure->'accountIds') value;
  SELECT pg_catalog.json_agg(value ORDER BY value) INTO v_roots
    FROM pg_catalog.jsonb_array_elements_text(v_closure->'rootIds') value;
  SELECT pg_catalog.json_agg(pg_catalog.json_build_object(
      'postingRootId',source.value->>'postingRootId','journalId',source.value->>'journalId',
      'currentAmountMinor',source.value->>'currentAmountMinor','txCode',source.value->>'txCode',
      'currentFragmentSetHash',source.value->>'currentFragmentSetHash') ORDER BY source.value->>'postingRootId')
    INTO v_sources FROM pg_catalog.jsonb_array_elements(v_closure->'sources') source(value);
  SELECT pg_catalog.json_agg(pg_catalog.json_build_object(
      'ordinal',night.ordinal::text,'businessDate',night.business_date::text,
      'transactionValueMinor',night.final_value_minor::text,
      'slabUptoMinor',CASE WHEN night.slab_upto_minor IS NULL THEN NULL ELSE night.slab_upto_minor::text END,
      'aggregateRateBasisPoints',night.aggregate_rate_basis_points,'itcEligible',night.itc_eligible,
      'taxMinor',night.tax_minor::text) ORDER BY night.ordinal)
    INTO v_nights FROM public.india_gst_accommodation_final_component_tax_room_night night
    WHERE night.tenant_id=p_tenant AND night.tax_id=t.id;
  SELECT pg_catalog.json_agg(pg_catalog.json_build_object(
      'roomNightOrdinal',component.room_night_ordinal,'componentOrdinal',component.component_ordinal,
      'componentIdentity',component.component_identity,'rateBasisPoints',component.rate_basis_points,
      'taxAmountMinor',component.tax_amount_minor::text)
      ORDER BY component.room_night_ordinal,component.component_ordinal)
    INTO v_components FROM public.india_gst_accommodation_final_component_tax_component component
    WHERE component.tenant_id=p_tenant AND component.tax_id=t.id;
  IF b.journal_id IS NULL THEN
    v_lines:='[]'::json;
  ELSE
    SELECT pg_catalog.json_agg(pg_catalog.json_build_object(
        'id',line.id,'seq',line.seq,'accountId',line.account_id,'accountRole',account.role,
        'folioId',line.folio_id,'txCode',line.tx_code,'description',line.description,
        'amountMinor',line.amount_minor::text,'quantity',line.quantity::text,
        'businessDate',line.business_date::text,'currency',line.currency::text,'taxDetail',line.tax_detail)
        ORDER BY line.seq,line.id)
      INTO v_lines FROM public.posting_line line
      JOIN public.account account ON account.tenant_id=line.tenant_id AND account.id=line.account_id
      WHERE line.tenant_id=p_tenant AND line.journal_id=b.journal_id;
  END IF;
  IF v_accounts IS NULL OR v_roots IS NULL OR v_sources IS NULL OR v_nights IS NULL
      OR v_components IS NULL OR v_lines IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native completion financial child set is incomplete';
  END IF;
  v_predecessors:=pg_catalog.json_build_object(
    'nativeTiming',n.evidence_hash,'nativeRateSelection',t.native_rate_selection_evidence_hash,
    'finalValuation',t.final_valuation_evidence_hash,
    'quotedRateApplicability',t.quoted_rate_applicability_evidence_hash,
    'levyComponentIdentity',t.levy_component_identity_evidence_hash,
    'reservationLineage',t.reservation_lineage_evidence_hash,
    'attributionSnapshot',t.attribution_snapshot_evidence_hash,
    'serviceProvisionRecording',n.service_provision_evidence_hash,
    'paymentReceiptRecording',n.payment_receipt_evidence_hash,
    'ordinaryRegimeRecording',n.ordinary_regime_evidence_hash,
    'requestEventPayload',n.request_event_payload_hash,'nativeRoute',b.native_route_evidence_hash);
  v_financial_body:=pg_catalog.json_build_object(
    'state','eligible_current_native_accounted_source','sourceKind','native_component_tax_delta',
    'postingBindingId',b.id,'accountingEvidenceHash',b.evidence_hash,
    'nativeTimingId',n.id,'nativeTimingEvidenceHash',n.evidence_hash,'journalId',b.journal_id,
    'taxId',t.id,'taxGeneration',t.generation,'taxEvidenceHash',t.evidence_hash,
    'valuationId',v.id,'valuationGeneration',v.generation,'finalValuationEvidenceHash',v.evidence_hash,
    'applicabilityId',a.id,'applicabilityEvidenceHash',a.evidence_hash,
    'reservationId',n.reservation_id,'folioId',n.folio_id,'guestAccountId',n.folio_account_id,
    'buyerPartyId',n.buyer_party_id,'propertyNode',n.property_node,'businessDate',n.invoice_issue_date::text,
    'currency','INR','transactionValueMinor',t.transaction_value_minor::text,
    'taxMinor',t.tax_minor::text,'grandTotalMinor',t.grand_total_minor::text,
    'componentFamily',t.component_family,'rateSelectionKind',t.rate_selection_kind,
    'predecessorHashes',v_predecessors,'nativeSourceBasisHash',n.native_source_basis_hash,
    'nativeConsiderationBasisHash',n.native_consideration_basis_hash,
    'considerationAccountIds',v_accounts,'considerationRootIds',v_roots,
    'considerationSources',v_sources,'roomNights',v_nights,'components',v_components,'journalLines',v_lines);
  v_financial_hash:=public.india_native_completion_json_hash(
    pg_catalog.json_build_object('tenantId',p_tenant,'state',v_financial_body->'state',
      'sourceKind',v_financial_body->'sourceKind','postingBindingId',v_financial_body->'postingBindingId',
      'accountingEvidenceHash',v_financial_body->'accountingEvidenceHash','nativeTimingId',v_financial_body->'nativeTimingId',
      'nativeTimingEvidenceHash',v_financial_body->'nativeTimingEvidenceHash','journalId',v_financial_body->'journalId',
      'taxId',v_financial_body->'taxId','taxGeneration',v_financial_body->'taxGeneration',
      'taxEvidenceHash',v_financial_body->'taxEvidenceHash','valuationId',v_financial_body->'valuationId',
      'valuationGeneration',v_financial_body->'valuationGeneration','finalValuationEvidenceHash',v_financial_body->'finalValuationEvidenceHash',
      'applicabilityId',v_financial_body->'applicabilityId','applicabilityEvidenceHash',v_financial_body->'applicabilityEvidenceHash',
      'reservationId',v_financial_body->'reservationId','folioId',v_financial_body->'folioId',
      'guestAccountId',v_financial_body->'guestAccountId','buyerPartyId',v_financial_body->'buyerPartyId',
      'propertyNode',v_financial_body->'propertyNode','businessDate',v_financial_body->'businessDate',
      'currency',v_financial_body->'currency','transactionValueMinor',v_financial_body->'transactionValueMinor',
      'taxMinor',v_financial_body->'taxMinor','grandTotalMinor',v_financial_body->'grandTotalMinor',
      'componentFamily',v_financial_body->'componentFamily','rateSelectionKind',v_financial_body->'rateSelectionKind',
      'predecessorHashes',v_predecessors,'nativeSourceBasisHash',v_financial_body->'nativeSourceBasisHash',
      'nativeConsiderationBasisHash',v_financial_body->'nativeConsiderationBasisHash',
      'considerationAccountIds',v_accounts,'considerationRootIds',v_roots,'considerationSources',v_sources,
      'roomNights',v_nights,'components',v_components,'journalLines',v_lines));
  v_financial:=(pg_catalog.left(public.india_native_insertion_json(v_financial_body),-1)
    ||',"sourceEvidenceHash":'||pg_catalog.to_json(v_financial_hash)::text||'}')::json;

  v_seller:=CASE WHEN v_prepared#>>'{sellerRegistration,tradeName}' IS NULL THEN
    pg_catalog.json_build_object('Gstin',v_prepared#>>'{sellerRegistration,gstin}',
      'LglNm',v_prepared#>>'{sellerRegistration,legalName}','Addr1',v_prepared#>>'{sellerRegistration,addressLine}',
      'Loc',v_prepared#>>'{sellerRegistration,locality}','Pin',(v_prepared#>>'{sellerRegistration,postalCode}')::integer,
      'Stcd',v_prepared#>>'{sellerRegistration,stateCode}')
    ELSE pg_catalog.json_build_object('Gstin',v_prepared#>>'{sellerRegistration,gstin}',
      'LglNm',v_prepared#>>'{sellerRegistration,legalName}','TrdNm',v_prepared#>>'{sellerRegistration,tradeName}',
      'Addr1',v_prepared#>>'{sellerRegistration,addressLine}','Loc',v_prepared#>>'{sellerRegistration,locality}',
      'Pin',(v_prepared#>>'{sellerRegistration,postalCode}')::integer,'Stcd',v_prepared#>>'{sellerRegistration,stateCode}') END;
  v_seller_payload:=pg_catalog.json_build_object('SellerDtls',v_seller);
  v_seller_payload_text:=public.india_native_insertion_json(v_seller_payload);
  v_seller_payload_hash:=public.india_native_completion_json_hash(v_seller_payload);
  v_seller_details:=pg_catalog.json_build_object('format','irp_json_1_1','lineage',pg_catalog.json_build_object(
      'registrationId',v_prepared#>>'{sellerRegistration,registrationId}',
      'evidenceHash',v_prepared#>>'{sellerRegistration,evidenceHash}'),
    'payload',v_seller_payload,'payloadJson',v_seller_payload_text,'payloadHash',v_seller_payload_hash);
  v_buyer:=CASE WHEN v_prepared#>>'{recipientRegistration,tradeName}' IS NULL THEN
    pg_catalog.json_build_object('Gstin',v_prepared#>>'{recipientRegistration,gstin}',
      'LglNm',v_prepared#>>'{recipientRegistration,legalName}','Addr1',v_prepared#>>'{recipientRegistration,addressLine1}',
      'Loc',v_prepared#>>'{recipientRegistration,locality}','Pin',(v_prepared#>>'{recipientRegistration,pin}')::integer,
      'Stcd',v_prepared#>>'{recipientRegistration,stateCode}')
    ELSE pg_catalog.json_build_object('Gstin',v_prepared#>>'{recipientRegistration,gstin}',
      'LglNm',v_prepared#>>'{recipientRegistration,legalName}','TrdNm',v_prepared#>>'{recipientRegistration,tradeName}',
      'Addr1',v_prepared#>>'{recipientRegistration,addressLine1}','Loc',v_prepared#>>'{recipientRegistration,locality}',
      'Pin',(v_prepared#>>'{recipientRegistration,pin}')::integer,'Stcd',v_prepared#>>'{recipientRegistration,stateCode}') END;
  v_buyer_payload:=pg_catalog.json_build_object('BuyerDtls',v_buyer);
  v_buyer_payload_text:=public.india_native_insertion_json(v_buyer_payload);
  v_buyer_payload_hash:=public.india_native_completion_json_hash(v_buyer_payload);
  v_buyer_details:=pg_catalog.json_build_object('format','irp_json_1_1','lineage',pg_catalog.json_build_object(
      'partyId',v_prepared#>>'{recipientRegistration,partyId}',
      'registrationId',v_prepared#>>'{recipientRegistration,registrationId}',
      'evidenceHash',v_prepared#>>'{recipientRegistration,evidenceHash}'),
    'payload',v_buyer_payload,'payloadJson',v_buyer_payload_text,'payloadHash',v_buyer_payload_hash);
  v_family:=t.component_family;
  v_family_rule:=CASE v_family WHEN 'igst' THEN 'IGST_ACT_5_1'
    WHEN 'cgst_sgst' THEN 'CGST_ACT_9_1_AND_SGST_ACT' ELSE 'CGST_ACT_9_1_AND_UTGST_ACT_7_1' END;
  v_family_body:=pg_catalog.json_build_object(
    'propertyNode',v_prepared#>'{supplyNatureAtTimeOfSupplyInput,supplyNature,propertyNode}',
    'reservationId',v_prepared#>'{supplyNatureAtTimeOfSupplyInput,supplyNature,reservationId}',
    'folioId',v_prepared#>'{supplyNatureAtTimeOfSupplyInput,supplyNature,folioId}',
    'supplyDate',v_prepared#>'{supplyNatureAtTimeOfSupplyInput,supplyNature,supplyDate}',
    'jurisdiction',pg_catalog.json_build_object(
      'extensionId',v_prepared#>'{supplyNatureAtTimeOfSupplyInput,supplyNature,jurisdiction,extensionId}',
      'key',v_prepared#>'{supplyNatureAtTimeOfSupplyInput,supplyNature,jurisdiction,key}',
      'version',v_prepared#>'{supplyNatureAtTimeOfSupplyInput,supplyNature,jurisdiction,version}',
      'contentHash',v_prepared#>'{supplyNatureAtTimeOfSupplyInput,supplyNature,jurisdiction,contentHash}'),
    'supplierRegistrationId',v_prepared#>'{supplyNatureAtTimeOfSupplyInput,supplyNature,supplier,registrationId}',
    'placeOfSupplyStateCode',v_prepared#>'{supplyNatureAtTimeOfSupplyInput,supplyNature,placeOfSupply,pos}',
    'supplyNature',v_prepared#>'{supplyNatureAtTimeOfSupplyInput,supplyNature,supplyNature}',
    'determinationBasis',v_prepared#>'{supplyNatureAtTimeOfSupplyInput,supplyNature,determinationBasis}',
    'sezDirection',v_prepared#>'{supplyNatureAtTimeOfSupplyInput,supplyNature,sezDirection}',
    'componentFamily',v_family,'legalSources',pg_catalog.json_build_object(
      'supplyNature',v_prepared#>'{supplyNatureAtTimeOfSupplyInput,supplyNature,legalRule}',
      'componentFamily',v_family_rule),
    'predecessorCandidateHash',v_prepared#>'{supplyNatureAtTimeOfSupplyInput,supplyNature,candidateHash}');
  v_family_hash:=public.india_native_completion_json_hash(pg_catalog.json_build_object('tenantId',p_tenant,
    'propertyNode',v_family_body->'propertyNode','reservationId',v_family_body->'reservationId',
    'folioId',v_family_body->'folioId','supplyDate',v_family_body->'supplyDate',
    'jurisdiction',v_family_body->'jurisdiction','supplierRegistrationId',v_family_body->'supplierRegistrationId',
    'placeOfSupplyStateCode',v_family_body->'placeOfSupplyStateCode','supplyNature',v_family_body->'supplyNature',
    'determinationBasis',v_family_body->'determinationBasis','sezDirection',v_family_body->'sezDirection',
    'componentFamily',v_family,'legalSources',v_family_body->'legalSources',
    'predecessorCandidateHash',v_family_body->'predecessorCandidateHash'));
  v_family_result:=(pg_catalog.left(public.india_native_insertion_json(v_family_body),-1)
    ||',"evidenceHash":'||pg_catalog.to_json(v_family_hash)::text||'}')::json;
  IF v_prepared->>'tenantId' IS DISTINCT FROM p_tenant::text
      OR v_prepared->>'legalBuyerPartyId' IS DISTINCT FROM n.buyer_party_id::text
      OR v_prepared#>>'{sellerRegistration,registrationId}' IS DISTINCT FROM n.supplier_registration_id::text
      OR v_prepared#>>'{recipientRegistration,registrationId}' IS DISTINCT FROM n.recipient_registration_id::text
      OR v_prepared#>>'{classification,classificationId}' IS DISTINCT FROM a.classification_id::text
      OR v_prepared#>>'{placeOfSupply,propertyNode}' IS DISTINCT FROM n.property_node::text
      OR v_prepared#>>'{supplyNatureAtTimeOfSupplyResult,propertyNode}' IS DISTINCT FROM n.property_node::text
      OR v_prepared#>>'{supplyNatureAtTimeOfSupplyResult,reservationId}' IS DISTINCT FROM n.reservation_id::text
      OR v_prepared#>>'{supplyNatureAtTimeOfSupplyResult,folioId}' IS DISTINCT FROM n.folio_id::text
      OR v_prepared#>>'{supplyNatureAtTimeOfSupplyResult,kind}' IS DISTINCT FROM 'native_current_transaction'
      OR v_prepared#>>'{supplyNatureAtTimeOfSupplyResult,nativeTimingEvidenceHash}' IS DISTINCT FROM
        v_prepared#>>'{supplyNatureAtTimeOfSupplyInput,supplierRegistrationAtTimeOfSupply,timeOfSupply,nativeTiming,evidenceHash}'
      OR v_prepared#>>'{supplyNatureAtTimeOfSupplyInput,supplierRegistrationAtTimeOfSupply,timeOfSupply,nativeTiming,predecessorHashes,nativeTiming}' IS DISTINCT FROM n.evidence_hash
      OR v_prepared#>>'{supplyNatureAtTimeOfSupplyInput,supplierRegistrationAtTimeOfSupply,timeOfSupply,nativeTiming,invoiceIssueDate}' IS DISTINCT FROM n.invoice_issue_date::text
      OR v_prepared#>>'{supplyNatureAtTimeOfSupplyInput,supplierRegistrationAtTimeOfSupply,timeOfSupply,nativeTiming,amountMinor}' IS DISTINCT FROM t.grand_total_minor::text
      OR v_prepared#>>'{supplyNatureAtTimeOfSupplyResult,determinationBasis}' IS DISTINCT FROM
        'ordinary_registered_state_comparison'
      OR v_prepared#>>'{supplyNatureAtTimeOfSupplyResult,sezDirection}' IS DISTINCT FROM 'none'
      OR (v_family='igst' AND v_prepared#>>'{supplyNatureAtTimeOfSupplyResult,legalRule}' IS DISTINCT FROM 'IGST_ACT_7_3')
      OR (v_family<>'igst' AND v_prepared#>>'{supplyNatureAtTimeOfSupplyResult,legalRule}' IS DISTINCT FROM 'IGST_ACT_8_2')
      OR v_family_body->>'componentFamily' IS DISTINCT FROM t.component_family THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native completion statutory and timing roots are inconsistent';
  END IF;

  v_source_body:=pg_catalog.json_build_object('state','eligible_irp_invoice_source',
    'sourceKind','native_current_transaction_graph','sourceVersion',2,'financialSource',v_financial,
    'legalBuyerPartyId',v_prepared->'legalBuyerPartyId','sellerRegistration',v_prepared->'sellerRegistration',
    'recipientRegistration',v_prepared->'recipientRegistration','sellerDetails',v_seller_details,
    'buyerDetails',v_buyer_details,'placeOfSupply',v_prepared->'placeOfSupply',
    'classification',v_prepared->'classification',
    'supplyNatureAtTimeOfSupply',v_prepared->'supplyNatureAtTimeOfSupplyResult','componentFamily',v_family_result);
  v_source_preimage:=pg_catalog.json_build_object('tenantId',p_tenant,'state',v_source_body->'state',
    'sourceKind',v_source_body->'sourceKind','sourceVersion',v_source_body->'sourceVersion',
    'financialSource',v_financial,'legalBuyerPartyId',v_source_body->'legalBuyerPartyId',
    'sellerRegistration',v_source_body->'sellerRegistration','recipientRegistration',v_source_body->'recipientRegistration',
    'sellerDetails',v_seller_details,'buyerDetails',v_buyer_details,'placeOfSupply',v_source_body->'placeOfSupply',
    'classification',v_source_body->'classification','supplyNatureAtTimeOfSupply',v_source_body->'supplyNatureAtTimeOfSupply',
    'componentFamily',v_family_result);
  v_source_hash:=public.india_native_completion_json_hash(v_source_preimage);
  v_source:=(pg_catalog.left(public.india_native_insertion_json(v_source_body),-1)
    ||',"evidenceHash":'||pg_catalog.to_json(v_source_hash)::text||'}')::json;

  v_supply_body:=pg_catalog.json_build_object('state','eligible_irp_ordinary_registered_b2b_supply_type',
    'supplyTypeCode','B2B','sourceEvidenceHash',v_source_hash);
  v_supply_hash:=public.india_native_completion_json_hash(pg_catalog.json_build_object('tenantId',p_tenant,
    'state',v_supply_body->'state','supplyTypeCode',v_supply_body->'supplyTypeCode',
    'sourceEvidenceHash',v_supply_body->'sourceEvidenceHash'));
  v_transaction_payload:=pg_catalog.json_build_object('TranDtls',pg_catalog.json_build_object('TaxSch','GST','SupTyp','B2B'));
  v_transaction_body:=pg_catalog.json_build_object('state','eligible_irp_ordinary_b2b_transaction_details_candidate',
    'format','irp_json_1_1','payload',v_transaction_payload,
    'payloadJson',public.india_native_insertion_json(v_transaction_payload),
    'lineage',pg_catalog.json_build_object('sourceEvidenceHash',v_source_hash,'supplyTypeEvidenceHash',v_supply_hash),
    'sourceEvidenceHash',v_source_hash);
  v_transaction_hash:=public.india_native_completion_json_hash(pg_catalog.json_build_object('tenantId',p_tenant,
    'state',v_transaction_body->'state','format',v_transaction_body->'format','payload',v_transaction_body->'payload',
    'payloadJson',v_transaction_body->'payloadJson','lineage',v_transaction_body->'lineage',
    'sourceEvidenceHash',v_source_hash));
  v_party_payload:=pg_catalog.json_build_object('SellerDtls',v_seller,'BuyerDtls',
    (pg_catalog.left(public.india_native_insertion_json(v_buyer),-1)||',"Pos":'||
      (v_prepared#>'{placeOfSupply,pos}')::text||'}')::json);
  v_party_body:=pg_catalog.json_build_object('state','eligible_irp_accommodation_party_details_candidate',
    'format','irp_json_1_1','payload',v_party_payload,'payloadJson',public.india_native_insertion_json(v_party_payload),
    'lineage',pg_catalog.json_build_object('sourceEvidenceHash',v_source_hash,
      'sellerPayloadHash',v_seller_payload_hash,'buyerPayloadHash',v_buyer_payload_hash,
      'placeOfSupplyCandidateHash',v_prepared#>'{placeOfSupply,candidateHash}'),'sourceEvidenceHash',v_source_hash);
  v_party_hash:=public.india_native_completion_json_hash(pg_catalog.json_build_object('tenantId',p_tenant,
    'state',v_party_body->'state','format',v_party_body->'format','payload',v_party_body->'payload',
    'payloadJson',v_party_body->'payloadJson','lineage',v_party_body->'lineage','sourceEvidenceHash',v_source_hash));

  FOR v_item IN SELECT night.*,pg_catalog.count(*) OVER() AS total_count
      FROM public.india_gst_accommodation_final_component_tax_room_night night
      WHERE night.tenant_id=p_tenant AND night.tax_id=t.id ORDER BY night.ordinal LOOP
    SELECT pg_catalog.json_agg(pg_catalog.json_build_object('componentOrdinal',component.component_ordinal,
        'componentIdentity',component.component_identity,'rateBasisPoints',component.rate_basis_points,
        'taxAmountMinor',component.tax_amount_minor::text) ORDER BY component.component_ordinal),
      COALESCE(pg_catalog.sum(component.tax_amount_minor) FILTER(WHERE component.component_identity='igst'),0),
      COALESCE(pg_catalog.sum(component.tax_amount_minor) FILTER(WHERE component.component_identity='sgst'),0)
        +COALESCE(pg_catalog.sum(component.tax_amount_minor) FILTER(WHERE component.component_identity='utgst'),0)
      INTO v_component_lineage,v_tax_component,v_state_component
      FROM public.india_gst_accommodation_final_component_tax_component component
      WHERE component.tenant_id=p_tenant AND component.tax_id=t.id
        AND component.room_night_ordinal=v_item.ordinal;
    v_total:=v_item.final_value_minor+v_item.tax_minor;
    IF v_family='igst' THEN
      v_irp:=pg_catalog.json_build_object('SlNo',(v_item.ordinal+1)::text,'IsServc','Y',
        'HsnCd',v_prepared#>>'{classification,classificationCode}',
        'UnitPrice',public.india_native_completion_minor_text(v_item.final_value_minor),
        'TotAmt',public.india_native_completion_minor_text(v_item.final_value_minor),
        'AssAmt',public.india_native_completion_minor_text(v_item.final_value_minor),
        'GstRt',public.india_native_completion_rate_text(v_item.aggregate_rate_basis_points),
        'IgstAmt',public.india_native_completion_minor_text(v_tax_component),
        'TotItemVal',public.india_native_completion_minor_text(v_total));
      v_compat_irp:=pg_catalog.json_build_object('SlNo',(v_item.ordinal+1)::text,'IsServc','Y',
        'HsnCd',v_prepared#>>'{classification,classificationCode}','Qty','1.000','Unit','OTH',
        'UnitPrice',public.india_native_completion_minor_text(v_item.final_value_minor),
        'TotAmt',public.india_native_completion_minor_text(v_item.final_value_minor),
        'AssAmt',public.india_native_completion_minor_text(v_item.final_value_minor),
        'GstRt',public.india_native_completion_rate_text(v_item.aggregate_rate_basis_points),
        'IgstAmt',public.india_native_completion_minor_text(v_tax_component),
        'TotItemVal',public.india_native_completion_minor_text(v_total));
    ELSE
      SELECT COALESCE(pg_catalog.sum(component.tax_amount_minor),0) INTO v_tax_component
        FROM public.india_gst_accommodation_final_component_tax_component component
        WHERE component.tenant_id=p_tenant AND component.tax_id=t.id
          AND component.room_night_ordinal=v_item.ordinal AND component.component_identity='cgst';
      v_irp:=pg_catalog.json_build_object('SlNo',(v_item.ordinal+1)::text,'IsServc','Y',
        'HsnCd',v_prepared#>>'{classification,classificationCode}',
        'UnitPrice',public.india_native_completion_minor_text(v_item.final_value_minor),
        'TotAmt',public.india_native_completion_minor_text(v_item.final_value_minor),
        'AssAmt',public.india_native_completion_minor_text(v_item.final_value_minor),
        'GstRt',public.india_native_completion_rate_text(v_item.aggregate_rate_basis_points),
        'CgstAmt',public.india_native_completion_minor_text(v_tax_component),
        'SgstAmt',public.india_native_completion_minor_text(v_state_component),
        'TotItemVal',public.india_native_completion_minor_text(v_total));
      v_compat_irp:=pg_catalog.json_build_object('SlNo',(v_item.ordinal+1)::text,'IsServc','Y',
        'HsnCd',v_prepared#>>'{classification,classificationCode}','Qty','1.000','Unit','OTH',
        'UnitPrice',public.india_native_completion_minor_text(v_item.final_value_minor),
        'TotAmt',public.india_native_completion_minor_text(v_item.final_value_minor),
        'AssAmt',public.india_native_completion_minor_text(v_item.final_value_minor),
        'GstRt',public.india_native_completion_rate_text(v_item.aggregate_rate_basis_points),
        'CgstAmt',public.india_native_completion_minor_text(v_tax_component),
        'SgstAmt',public.india_native_completion_minor_text(v_state_component),
        'TotItemVal',public.india_native_completion_minor_text(v_total));
    END IF;
    v_lineage:=pg_catalog.json_build_object('roomNightOrdinal',v_item.ordinal::text,
      'businessDate',v_item.business_date::text,'sourceEvidenceHash',v_source_hash,
      'componentFamily',v_family,'components',v_component_lineage);
    v_item_texts:=pg_catalog.array_append(v_item_texts,
      public.india_native_insertion_json(pg_catalog.json_build_object('irp',v_irp,'lineage',v_lineage)));
    v_compat_item_texts:=pg_catalog.array_append(v_compat_item_texts,
      public.india_native_insertion_json(pg_catalog.json_build_object('irp',v_compat_irp,'lineage',v_lineage)));
    v_item_count:=v_item_count+1;
  END LOOP;
  IF v_item_count NOT BETWEEN 1 AND 366 THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native completion item set is incomplete';
  END IF;
  v_items:=('['||pg_catalog.array_to_string(v_item_texts,',')||']')::json;
  v_compat_items:=('['||pg_catalog.array_to_string(v_compat_item_texts,',')||']')::json;
  v_item_body:=pg_catalog.json_build_object('state','eligible_irp_accommodation_room_night_item_candidates',
    'supplyTypeCode','B2B','currency','INR','items',v_items,'sourceEvidenceHash',v_source_hash);
  v_item_hash:=public.india_native_completion_json_hash(pg_catalog.json_build_object('tenantId',p_tenant,
    'state',v_item_body->'state','supplyTypeCode',v_item_body->'supplyTypeCode','currency','INR',
    'items',v_items,'sourceEvidenceHash',v_source_hash));
  IF v_family='igst' THEN
    SELECT pg_catalog.json_build_object('AssVal',public.india_native_completion_minor_text(t.transaction_value_minor),
      'IgstVal',public.india_native_completion_minor_text(
        COALESCE(pg_catalog.sum(c.tax_amount_minor),0)::bigint),
      'TotInvVal',public.india_native_completion_minor_text(t.grand_total_minor)) INTO v_value_fields
      FROM public.india_gst_accommodation_final_component_tax_component c
      WHERE c.tenant_id=p_tenant AND c.tax_id=t.id AND c.component_identity='igst';
  ELSE
    SELECT pg_catalog.json_build_object('AssVal',public.india_native_completion_minor_text(t.transaction_value_minor),
      'CgstVal',public.india_native_completion_minor_text(COALESCE(pg_catalog.sum(c.tax_amount_minor)
        FILTER(WHERE c.component_identity='cgst'),0)::bigint),
      'SgstVal',public.india_native_completion_minor_text(COALESCE(pg_catalog.sum(c.tax_amount_minor)
        FILTER(WHERE c.component_identity IN ('sgst','utgst')),0)::bigint),
      'TotInvVal',public.india_native_completion_minor_text(t.grand_total_minor)) INTO v_value_fields
      FROM public.india_gst_accommodation_final_component_tax_component c
      WHERE c.tenant_id=p_tenant AND c.tax_id=t.id;
  END IF;
  v_value_body:=pg_catalog.json_build_object('state','eligible_irp_accommodation_invoice_value_candidate',
    'supplyTypeCode','B2B','currency','INR','valDtls',v_value_fields,
    'lineage',pg_catalog.json_build_object('itemCandidateEvidenceHash',v_item_hash,
      'sourceEvidenceHash',v_source_hash,'itemCount',v_item_count,'componentFamily',v_family),
    'sourceEvidenceHash',v_source_hash);
  v_value_hash:=public.india_native_completion_json_hash(pg_catalog.json_build_object('tenantId',p_tenant,
    'state',v_value_body->'state','supplyTypeCode','B2B','currency','INR','valDtls',v_value_fields,
    'lineage',v_value_body->'lineage','sourceEvidenceHash',v_source_hash));
  v_base_sections:=pg_catalog.json_build_object('Version','1.1','TranDtls',v_transaction_payload->'TranDtls',
    'SellerDtls',v_party_payload->'SellerDtls','BuyerDtls',v_party_payload->'BuyerDtls',
    'ItemList',(SELECT pg_catalog.json_agg(value->'irp' ORDER BY ordinality)
      FROM pg_catalog.json_array_elements(v_items) WITH ORDINALITY item(value,ordinality)),
    'ValDtls',v_value_fields);
  v_base_sections_text:=public.india_native_insertion_json(v_base_sections);
  v_base_pre_body:=pg_catalog.json_build_object('state','incomplete_non_submit_ready_irp_accommodation_pre_document_evidence',
    'format','irp_json_1_1','submissionReady',false,
    'explicitlyExcludedEvidence',pg_catalog.json_build_array('DocDtls','ItemList[].Qty','ItemList[].Unit'),
    'sections',v_base_sections,'sectionsJson',v_base_sections_text,
    'lineage',pg_catalog.json_build_object('sourceEvidenceHash',v_source_hash,
      'transactionDetailsEvidenceHash',v_transaction_hash,'partyDetailsEvidenceHash',v_party_hash,
      'itemCandidatesEvidenceHash',v_item_hash,'invoiceValueEvidenceHash',v_value_hash),
    'sourceEvidenceHash',v_source_hash);
  v_base_pre_hash:=public.india_native_completion_json_hash(pg_catalog.json_build_object('tenantId',p_tenant,
    'state',v_base_pre_body->'state','format',v_base_pre_body->'format','submissionReady',false,
    'explicitlyExcludedEvidence',v_base_pre_body->'explicitlyExcludedEvidence','sections',v_base_sections,
    'sectionsJson',v_base_sections_text,'lineage',v_base_pre_body->'lineage','sourceEvidenceHash',v_source_hash));
  v_base_pre:=(pg_catalog.left(public.india_native_insertion_json(v_base_pre_body),-1)
    ||',"evidenceHash":'||pg_catalog.to_json(v_base_pre_hash)::text||'}')::json;
  v_compat_body:=pg_catalog.json_build_object('state','eligible_irp_accommodation_service_quantity_uqc_compatibility_candidate',
    'supplyTypeCode','B2B','currency','INR','items',v_compat_items,
    'lineage',pg_catalog.json_build_object('itemCandidateEvidenceHash',v_item_hash,
      'sourceEvidenceHash',v_source_hash,'itemCount',v_item_count,'componentFamily',v_family),
    'sourceEvidenceHash',v_source_hash);
  v_compat_hash:=public.india_native_completion_json_hash(pg_catalog.json_build_object('tenantId',p_tenant,
    'state',v_compat_body->'state','supplyTypeCode','B2B','currency','INR','items',v_compat_items,
    'lineage',v_compat_body->'lineage','sourceEvidenceHash',v_source_hash));
  v_sections:=pg_catalog.json_build_object('Version','1.1','TranDtls',v_transaction_payload->'TranDtls',
    'SellerDtls',v_party_payload->'SellerDtls','BuyerDtls',v_party_payload->'BuyerDtls',
    'ItemList',(SELECT pg_catalog.json_agg(value->'irp' ORDER BY ordinality)
      FROM pg_catalog.json_array_elements(v_compat_items) WITH ORDINALITY item(value,ordinality)),
    'ValDtls',v_value_fields);
  v_sections_text:=public.india_native_insertion_json(v_sections);
  v_pre_body:=pg_catalog.json_build_object(
    'state','incomplete_non_submit_ready_irp_accommodation_validation_compatibility_pre_document_evidence',
    'format','irp_json_1_1','submissionReady',false,'authenticatedProviderSandboxCertified',false,
    'explicitlyExcludedEvidence',pg_catalog.json_build_array('DocDtls'),'sections',v_sections,
    'sectionsJson',v_sections_text,'lineage',pg_catalog.json_build_object(
      'sourceEvidenceHash',v_source_hash,'preDocumentEvidenceAssemblyHash',v_base_pre_hash,
      'serviceQuantityUqcCompatibilityEvidenceHash',v_compat_hash,'itemCandidatesEvidenceHash',v_item_hash),
    'sourceEvidenceHash',v_source_hash);
  v_pre_hash:=public.india_native_completion_json_hash(pg_catalog.json_build_object('tenantId',p_tenant,
    'state',v_pre_body->'state','format',v_pre_body->'format','submissionReady',false,
    'authenticatedProviderSandboxCertified',false,'explicitlyExcludedEvidence',v_pre_body->'explicitlyExcludedEvidence',
    'sections',v_sections,'sectionsJson',v_sections_text,'lineage',v_pre_body->'lineage',
    'sourceEvidenceHash',v_source_hash));
  v_pre:=(pg_catalog.left(public.india_native_insertion_json(v_pre_body),-1)
    ||',"evidenceHash":'||pg_catalog.to_json(v_pre_hash)::text||'}')::json;
  v_readiness_body:=pg_catalog.json_build_object('state','blocked_pending_fiscal_document_origin_policy',
    'submissionReady',false,'permittedActions',pg_catalog.json_build_array(),
    'blockers',pg_catalog.json_build_array('FISCAL_DOCUMENT_ORIGIN_UNSELECTED',
      'LEGAL_DOCUMENT_NUMBER_FORMAT_UNCONFIGURED','DOCUMENT_SERIES_UNBOUND'),
    'preDocumentEvidence',v_pre,'sourceEvidenceHash',v_source_hash,
    'preDocumentEvidenceHash',v_pre_hash);
  v_readiness_hash:=public.india_native_completion_json_hash(pg_catalog.json_build_object('tenantId',p_tenant,
    'state',v_readiness_body->'state','submissionReady',false,'permittedActions',v_readiness_body->'permittedActions',
    'blockers',v_readiness_body->'blockers','preDocumentEvidence',v_pre,
    'sourceEvidenceHash',v_source_hash,'preDocumentEvidenceHash',v_pre_hash));
  RETURN pg_catalog.jsonb_build_object(
    'sourceEvidencePreimage',public.india_native_insertion_json(v_source_preimage),
    'sourceEvidenceHash',v_source_hash,
    'preDocumentEvidencePreimage',public.india_native_insertion_json(pg_catalog.json_build_object('tenantId',p_tenant,
      'state',v_pre_body->'state','format',v_pre_body->'format','submissionReady',false,
      'authenticatedProviderSandboxCertified',false,'explicitlyExcludedEvidence',v_pre_body->'explicitlyExcludedEvidence',
      'sections',v_sections,'sectionsJson',v_sections_text,'lineage',v_pre_body->'lineage',
      'sourceEvidenceHash',v_source_hash)),
    'preDocumentEvidenceHash',v_pre_hash,'preDocumentJson',v_sections_text,
    'readinessEvidencePreimage',public.india_native_insertion_json(pg_catalog.json_build_object('tenantId',p_tenant,
      'state',v_readiness_body->'state','submissionReady',false,'permittedActions',v_readiness_body->'permittedActions',
      'blockers',v_readiness_body->'blockers','preDocumentEvidence',v_pre,
      'sourceEvidenceHash',v_source_hash,'preDocumentEvidenceHash',v_pre_hash)),
    'readinessEvidenceHash',v_readiness_hash);
END;
$$;
ALTER FUNCTION public.compose_india_native_fiscal_completion_evidence(uuid,uuid) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.compose_india_native_fiscal_completion_evidence(uuid,uuid)
  FROM PUBLIC,app_role,yellow_runtime;

CREATE OR REPLACE FUNCTION public.commit_india_native_fiscal_invoice_v2(
  p_tenant uuid,p_property uuid,p_actor uuid,p_native_timing uuid,p_key text,
  p_frozen_evidence jsonb,p_request uuid
) RETURNS TABLE(
  document_id uuid,document_kind text,series_id uuid,doc_no text,property_node uuid,
  reservation_id uuid,folio_id uuid,supplier_registration_id uuid,recipient_registration_id uuid,
  financial_year_start date,currency character(3),status text,business_date date,issued_at timestamptz,
  prev_hash text,sha256 text,source_evidence_hash text,pre_document_evidence_hash text,
  readiness_evidence_hash text,created boolean
) LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,public SET timezone='UTC' SET datestyle='ISO,YMD' AS $$
DECLARE
  v_context uuid;n public.india_gst_native_invoice_timing%ROWTYPE;
  b public.india_gst_accommodation_final_component_tax_journal_binding%ROWTYPE;
  s public.document_series%ROWTYPE;r public.api_idempotency%ROWTYPE;
  v_expected jsonb;v_sections jsonb;v_content jsonb;v_hash text;v_doc_no text;v_origin_key text;
  v_fy date;v_tail_hash text;v_tail_no text;v_updated bigint;
BEGIN
  IF session_user<>'yellow_runtime' OR pg_catalog.current_setting('role',true) IS DISTINCT FROM 'app_role'
      OR current_user<>'yellow_owner' THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='native v2 fiscal completion requires the governed runtime app role';
  END IF;
  BEGIN v_context:=NULLIF(pg_catalog.current_setting('app.tenant_id',true),'')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='native v2 fiscal completion tenant context is invalid'; END;
  IF p_tenant IS NULL OR p_property IS NULL OR p_actor IS NULL OR p_native_timing IS NULL OR p_request IS NULL
      OR p_key IS NULL OR p_key COLLATE "C" !~ '^[!-~]{8,200}$' OR v_context IS DISTINCT FROM p_tenant
      OR p_frozen_evidence IS NULL OR pg_catalog.jsonb_typeof(p_frozen_evidence)<>'object'
      OR (SELECT pg_catalog.array_agg(key ORDER BY key) FROM pg_catalog.jsonb_object_keys(p_frozen_evidence) key)
        IS DISTINCT FROM ARRAY['blockers','permittedActions','preDocumentEvidenceHash','preDocumentEvidencePreimage',
          'preDocumentJson','readinessEvidenceHash','readinessEvidencePreimage','readinessState',
          'recipientRegistrationId','sourceEvidenceHash','sourceEvidencePreimage','submissionReady']::text[] THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='native v2 fiscal completion input is invalid';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_locks lock_row WHERE lock_row.pid=pg_catalog.pg_backend_pid()
      AND lock_row.locktype='advisory' AND lock_row.granted AND lock_row.objsubid=1
      AND lock_row.classid=((6441674055002974568::bigint>>32)&4294967295)::oid
      AND lock_row.objid=(6441674055002974568::bigint&4294967295)::oid) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native v2 fiscal completion requires the already-held publication lock';
  END IF;
  SELECT timing.* INTO n FROM public.india_gst_native_invoice_timing timing
    WHERE timing.tenant_id=p_tenant AND timing.id=p_native_timing;
  IF NOT FOUND OR n.issuing_transaction_id IS DISTINCT FROM pg_catalog.pg_current_xact_id()
      OR n.transaction_timestamp IS DISTINCT FROM pg_catalog.transaction_timestamp()
      OR n.property_node<>p_property OR n.actor_id<>p_actor OR n.request_id<>p_request
      OR n.request_key_hash<>pg_catalog.encode(public.digest(p_key,'sha256'),'hex') THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native v2 fiscal completion is not the prepared current transaction';
  END IF;
  SELECT binding.* INTO b FROM public.india_gst_accommodation_final_component_tax_journal_binding binding
    WHERE binding.tenant_id=p_tenant AND binding.id=n.accounting_binding_id AND binding.native_timing_id=n.id;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native v2 accounting binding is unavailable'; END IF;
  v_expected:=public.compose_india_native_fiscal_completion_evidence(p_tenant,p_native_timing);
  IF p_frozen_evidence->>'readinessState'<>'blocked_pending_fiscal_document_origin_policy'
      OR p_frozen_evidence->'submissionReady'<>'false'::jsonb
      OR p_frozen_evidence->'permittedActions'<>'[]'::jsonb
      OR p_frozen_evidence->'blockers'<>'["FISCAL_DOCUMENT_ORIGIN_UNSELECTED","LEGAL_DOCUMENT_NUMBER_FORMAT_UNCONFIGURED","DOCUMENT_SERIES_UNBOUND"]'::jsonb
      OR p_frozen_evidence->>'recipientRegistrationId' IS DISTINCT FROM n.recipient_registration_id::text
      OR p_frozen_evidence->>'sourceEvidencePreimage' IS DISTINCT FROM v_expected->>'sourceEvidencePreimage'
      OR p_frozen_evidence->>'sourceEvidenceHash' IS DISTINCT FROM v_expected->>'sourceEvidenceHash'
      OR p_frozen_evidence->>'preDocumentEvidencePreimage' IS DISTINCT FROM v_expected->>'preDocumentEvidencePreimage'
      OR p_frozen_evidence->>'preDocumentEvidenceHash' IS DISTINCT FROM v_expected->>'preDocumentEvidenceHash'
      OR p_frozen_evidence->>'preDocumentJson' IS DISTINCT FROM v_expected->>'preDocumentJson'
      OR p_frozen_evidence->>'readinessEvidencePreimage' IS DISTINCT FROM v_expected->>'readinessEvidencePreimage'
      OR p_frozen_evidence->>'readinessEvidenceHash' IS DISTINCT FROM v_expected->>'readinessEvidenceHash' THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native v2 Order413, Order426 or Order429 evidence differs from reconstructed roots';
  END IF;
  SELECT receipt.* INTO r FROM public.api_idempotency receipt
    WHERE receipt.tenant_id=p_tenant AND receipt.operation='document.issued'
      AND receipt.key_hash=n.request_key_hash AND receipt.request_hash=n.request_hash;
  IF NOT FOUND OR r.completed_at IS NOT NULL OR r.response_status IS NOT NULL OR r.response_body IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native v2 pending issue receipt is unavailable';
  END IF;
  IF EXISTS(SELECT 1 FROM public.document document WHERE document.tenant_id=p_tenant
        AND document.id=n.prospective_document_id)
      OR EXISTS(SELECT 1 FROM public.india_gst_native_fiscal_document_origin origin
        WHERE origin.tenant_id=p_tenant AND origin.native_timing_id=n.id) THEN
    RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='native v2 fiscal timing already has a document';
  END IF;
  SELECT series.* INTO s FROM public.document_series series
    WHERE series.tenant_id=p_tenant AND series.id=n.series_id AND series.property_node=p_property
      AND series.supplier_registration_id=n.supplier_registration_id AND series.kind='invoice' AND series.fiscal;
  v_fy:=pg_catalog.make_date(pg_catalog.date_part('year',n.invoice_issue_date)::integer
    -CASE WHEN pg_catalog.date_part('month',n.invoice_issue_date)<4 THEN 1 ELSE 0 END,4,1);
  IF NOT FOUND OR s.financial_year_start<>v_fy OR s.prefix IS NULL OR s.prefix<>pg_catalog.btrim(s.prefix)
      OR pg_catalog.char_length(s.prefix) NOT BETWEEN 1 AND 12 OR s.prefix !~ '^[A-Za-z0-9/-]+$'
      OR s.next_no NOT BETWEEN 1 AND 9223372036854775806
      OR pg_catalog.char_length(s.prefix||s.next_no::text)>16 THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native v2 locked fiscal series is unavailable';
  END IF;
  IF s.next_no=1 THEN
    IF s.last_doc_hash IS NOT NULL OR EXISTS(SELECT 1 FROM public.document document
        WHERE document.tenant_id=p_tenant AND document.series_id=s.id) THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native v2 fiscal series genesis is inconsistent';
    END IF;
  ELSE
    v_tail_no:=s.prefix||(s.next_no-1)::text;
    SELECT document.sha256 INTO v_tail_hash FROM public.document document
      JOIN public.india_gst_native_fiscal_document_origin origin
        ON origin.tenant_id=document.tenant_id AND origin.document_id=document.id
       AND origin.property_node=p_property AND origin.supplier_registration_id=n.supplier_registration_id
      WHERE document.tenant_id=p_tenant AND document.series_id=s.id AND document.doc_no=v_tail_no
        AND document.kind='invoice' AND document.status='issued'
        AND document.business_date=origin.issue_date AND document.issued_at=origin.created_at;
    IF NOT FOUND OR s.last_doc_hash IS NULL OR v_tail_hash IS DISTINCT FROM s.last_doc_hash THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native v2 fiscal series tail is inconsistent';
    END IF;
  END IF;
  BEGIN v_sections:=(v_expected->>'preDocumentJson')::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native v2 reconstructed pre-document is invalid'; END;
  v_doc_no:=s.prefix||s.next_no::text;
  v_content:=v_sections||pg_catalog.jsonb_build_object('DocDtls',pg_catalog.jsonb_build_object(
    'Typ','INV','No',v_doc_no,'Dt',pg_catalog.to_char(n.invoice_issue_date,'DD/MM/YYYY')));
  v_hash:=pg_catalog.encode(public.digest(pg_catalog.convert_to(v_content::text,'UTF8'),'sha256'),'hex');
  v_origin_key:=pg_catalog.encode(public.digest(p_tenant::text||':'||p_property::text||':'||
    n.reservation_id::text||':'||n.folio_id::text||':'||(v_expected->>'readinessEvidenceHash'),'sha256'),'hex');
  IF EXISTS(SELECT 1 FROM public.india_gst_native_fiscal_document_origin origin
      WHERE origin.tenant_id=p_tenant AND (origin.origin_key=v_origin_key OR origin.native_timing_id=n.id)) THEN
    RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='native v2 fiscal source already has an issued document';
  END IF;
  INSERT INTO public.document(id,tenant_id,property_node,kind,series_id,doc_no,status,subject_type,subject_id,
    content,sha256,prev_hash,issued_at,business_date)
  VALUES(n.prospective_document_id,p_tenant,p_property,'invoice',s.id,v_doc_no,'issued','folio',n.folio_id,
    v_content,v_hash,s.last_doc_hash,n.transaction_timestamp,n.invoice_issue_date);
  UPDATE public.document_series SET next_no=next_no+1,last_doc_hash=v_hash
    WHERE tenant_id=p_tenant AND id=s.id AND next_no=s.next_no AND last_doc_hash IS NOT DISTINCT FROM s.last_doc_hash;
  GET DIAGNOSTICS v_updated=ROW_COUNT;
  IF v_updated<>1 THEN
    RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='native v2 fiscal series changed during allocation';
  END IF;
  INSERT INTO public.india_gst_native_fiscal_document_origin(
    tenant_id,document_id,property_node,document_kind,reservation_id,folio_id,source_journal_id,
    supplier_registration_id,recipient_registration_id,source_evidence_hash,pre_document_evidence_hash,
    readiness_evidence_hash,origin_key,issue_date,created_at,source_kind,source_version,
    native_timing_id,native_accounting_binding_id,native_source_basis_hash)
  VALUES(p_tenant,n.prospective_document_id,p_property,'invoice',n.reservation_id,n.folio_id,b.journal_id,
    n.supplier_registration_id,n.recipient_registration_id,v_expected->>'sourceEvidenceHash',
    v_expected->>'preDocumentEvidenceHash',v_expected->>'readinessEvidenceHash',v_origin_key,
    n.invoice_issue_date,n.transaction_timestamp,'native_current_transaction_graph',2,
    n.id,b.id,n.native_source_basis_hash);
  INSERT INTO public.fact_log(tenant_id,entity_type,entity_id,fact_type,valid_from,business_date,actor_id,payload)
  VALUES(p_tenant,'document',n.prospective_document_id,'issued',n.transaction_timestamp,n.invoice_issue_date,
    p_actor,pg_catalog.jsonb_build_object('kind','invoice','doc_no',v_doc_no,'hash',v_hash));
  INSERT INTO public.outbox(tenant_id,property_node,business_date,aggregate_type,aggregate_id,event_type,
    actor_id,correlation_id,payload,created_at)
  VALUES(p_tenant,p_property,n.invoice_issue_date,'document',n.prospective_document_id,'document.issued',
    p_actor,p_request,pg_catalog.jsonb_build_object('kind','invoice','doc_no',v_doc_no,'hash',v_hash),n.transaction_timestamp);
  UPDATE public.api_idempotency SET response_status=201,
      response_body=pg_catalog.jsonb_build_object('documentId',n.prospective_document_id::text,
        'docNo',v_doc_no,'sha256',v_hash),completed_at=n.transaction_timestamp
    WHERE tenant_id=p_tenant AND operation='document.issued' AND key_hash=n.request_key_hash
      AND request_hash=n.request_hash AND completed_at IS NULL AND response_status IS NULL AND response_body IS NULL;
  GET DIAGNOSTICS v_updated=ROW_COUNT;
  IF v_updated<>1 THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native v2 fiscal idempotency receipt could not be completed';
  END IF;
  RETURN QUERY SELECT n.prospective_document_id,'invoice'::text,s.id,v_doc_no,p_property,n.reservation_id,n.folio_id,
    n.supplier_registration_id,n.recipient_registration_id,v_fy,'INR'::character(3),'issued'::text,
    n.invoice_issue_date,n.transaction_timestamp,s.last_doc_hash,v_hash,v_expected->>'sourceEvidenceHash',
    v_expected->>'preDocumentEvidenceHash',v_expected->>'readinessEvidenceHash',true;
END;
$$;
ALTER FUNCTION public.commit_india_native_fiscal_invoice_v2(uuid,uuid,uuid,uuid,text,jsonb,uuid)
  OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.commit_india_native_fiscal_invoice_v2(uuid,uuid,uuid,uuid,text,jsonb,uuid)
  FROM PUBLIC,app_role,yellow_runtime;

-- Permanent completed receipt projection. The outer prepare path must first
-- establish current actor/request authority. This function deliberately does not
-- consult the current property clock, folio state, business day, mutable series
-- counter, api_idempotency expiry or presence, or the prunable request outbox row.
CREATE OR REPLACE FUNCTION public.read_india_native_completed_receipt(
  p_tenant uuid,p_native_timing uuid
) RETURNS jsonb LANGUAGE plpgsql VOLATILE
SET search_path=pg_catalog,public SET timezone='UTC' SET datestyle='ISO,YMD' AS $$
DECLARE
  v_context uuid;n public.india_gst_native_invoice_timing%ROWTYPE;
  o public.india_gst_native_fiscal_document_origin%ROWTYPE;
  d public.document%ROWTYPE;s public.document_series%ROWTYPE;
  b public.india_gst_accommodation_final_component_tax_journal_binding%ROWTYPE;
  v_hash text;v_fy date;
BEGIN
  BEGIN v_context:=NULLIF(pg_catalog.current_setting('app.tenant_id',true),'')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='native completed receipt tenant context is invalid'; END;
  IF p_tenant IS NULL OR p_native_timing IS NULL OR v_context IS DISTINCT FROM p_tenant THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='native completed receipt requires its tenant context';
  END IF;
  SELECT timing.* INTO n FROM public.india_gst_native_invoice_timing timing
    WHERE timing.tenant_id=p_tenant AND timing.id=p_native_timing;
  SELECT origin.* INTO o FROM public.india_gst_native_fiscal_document_origin origin
    WHERE origin.tenant_id=p_tenant AND origin.native_timing_id=p_native_timing;
  SELECT document.* INTO d FROM public.document document
    WHERE document.tenant_id=p_tenant AND document.id=n.prospective_document_id;
  SELECT series.* INTO s FROM public.document_series series
    WHERE series.tenant_id=p_tenant AND series.id=n.series_id;
  SELECT binding.* INTO b FROM public.india_gst_accommodation_final_component_tax_journal_binding binding
    WHERE binding.tenant_id=p_tenant AND binding.id=n.accounting_binding_id;
  IF n.id IS NULL OR o.id IS NULL OR d.id IS NULL OR s.id IS NULL OR b.id IS NULL
      OR o.document_id<>n.prospective_document_id OR o.native_accounting_binding_id<>n.accounting_binding_id
      OR o.property_node<>n.property_node OR o.reservation_id<>n.reservation_id OR o.folio_id<>n.folio_id
      OR o.supplier_registration_id<>n.supplier_registration_id
      OR o.recipient_registration_id<>n.recipient_registration_id
      OR o.issue_date<>n.invoice_issue_date OR o.created_at<>n.transaction_timestamp
      OR o.source_kind<>'native_current_transaction_graph' OR o.source_version<>2
      OR o.source_journal_id IS DISTINCT FROM b.journal_id
      OR o.native_source_basis_hash<>n.native_source_basis_hash
      OR d.property_node<>n.property_node OR d.kind<>'invoice' OR d.series_id<>n.series_id
      OR d.status<>'issued' OR d.subject_type<>'folio' OR d.subject_id<>n.folio_id
      OR d.business_date<>n.invoice_issue_date OR d.issued_at<>n.transaction_timestamp
      OR d.doc_no IS NULL OR d.sha256 IS NULL OR d.sha256 !~ '^[0-9a-f]{64}$'
      OR s.property_node<>n.property_node OR s.supplier_registration_id<>n.supplier_registration_id
      OR s.kind<>'invoice' OR NOT s.fiscal THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native completed receipt permanent graph is inconsistent';
  END IF;
  PERFORM public.assert_india_native_accounting_binding(p_tenant,b.id);
  v_hash:=pg_catalog.encode(public.digest(pg_catalog.convert_to(d.content::text,'UTF8'),'sha256'),'hex');
  v_fy:=pg_catalog.make_date(pg_catalog.date_part('year',n.invoice_issue_date)::integer
    -CASE WHEN pg_catalog.date_part('month',n.invoice_issue_date)<4 THEN 1 ELSE 0 END,4,1);
  IF v_hash<>d.sha256 OR s.financial_year_start<>v_fy
      OR d.content->'DocDtls' IS DISTINCT FROM pg_catalog.jsonb_build_object(
        'Typ','INV','No',d.doc_no,'Dt',pg_catalog.to_char(n.invoice_issue_date,'DD/MM/YYYY'))
      OR o.origin_key<>pg_catalog.encode(public.digest(p_tenant::text||':'||n.property_node::text||':'||
        n.reservation_id::text||':'||n.folio_id::text||':'||o.readiness_evidence_hash,'sha256'),'hex') THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native completed receipt document or origin hash is inconsistent';
  END IF;
  RETURN pg_catalog.jsonb_build_object('document_id',d.id,'document_kind','invoice','series_id',s.id,
    'doc_no',d.doc_no,'property_node',n.property_node,'reservation_id',n.reservation_id,'folio_id',n.folio_id,
    'supplier_registration_id',n.supplier_registration_id,'recipient_registration_id',n.recipient_registration_id,
    'financial_year_start',v_fy,'currency','INR','status','issued','business_date',n.invoice_issue_date,
    'issued_at',pg_catalog.to_char(d.issued_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'prev_hash',d.prev_hash,'sha256',d.sha256,
    'source_evidence_hash',o.source_evidence_hash,'pre_document_evidence_hash',o.pre_document_evidence_hash,
    'readiness_evidence_hash',o.readiness_evidence_hash,'created',false);
END;
$$;
ALTER FUNCTION public.read_india_native_completed_receipt(uuid,uuid) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.read_india_native_completed_receipt(uuid,uuid)
  FROM PUBLIC,app_role,yellow_runtime;

-- Q193/D1367: an extended pending approval request, not decision or fiscal
-- authority. Kernel still records the fact and outbox in this same transaction.
-- Preserve0016's exact direct-INSERT column grants.
CREATE OR REPLACE FUNCTION public.create_approval_request_with_options(
  p_tenant uuid,p_property uuid,p_actor uuid,p_id uuid,p_kind text,
  p_subject_type text,p_subject_id uuid,p_payload jsonb,p_valid_until timestamptz
) RETURNS SETOF public.approval_request
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,public
AS $$
DECLARE v_context uuid; v_id uuid:=COALESCE(p_id,pg_catalog.gen_random_uuid());
  v_reservation uuid;
BEGIN
  IF session_user<>'yellow_runtime'
     OR pg_catalog.current_setting('role',true) IS DISTINCT FROM 'app_role'
     OR current_user<>'yellow_owner' THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='approval request requires governed runtime authority';
  END IF;
  BEGIN
    v_context:=NULLIF(pg_catalog.current_setting('app.tenant_id',true),'')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='approval request tenant context is invalid';
  END;
  IF p_tenant IS NULL OR v_context IS NULL OR v_context<>p_tenant THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='approval request tenant context is invalid';
  END IF;
  IF p_property IS NULL OR p_actor IS NULL OR p_subject_id IS NULL
     OR p_kind IS NULL OR p_kind COLLATE "C" !~ '^[a-z][a-z0-9_.-]*$'
     OR p_subject_type IS NULL OR p_subject_type COLLATE "C" !~ '^[a-z][a-z0-9_.-]*$'
     OR pg_catalog.jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='approval request identity or proposal is invalid';
  END IF;
  IF p_valid_until IS NOT NULL AND
      (NOT pg_catalog.isfinite(p_valid_until) OR p_valid_until<=pg_catalog.transaction_timestamp()) THEN
    RAISE EXCEPTION USING ERRCODE='22023',
      MESSAGE='approval validUntil must be later than the PostgreSQL transaction timestamp';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_locks l WHERE l.pid=pg_catalog.pg_backend_pid()
    AND l.locktype='advisory' AND l.granted AND l.objsubid=1
    AND l.classid=((6441674055002974568::bigint>>32)&4294967295)::oid
    AND l.objid=(6441674055002974568::bigint&4294967295)::oid) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='extended approval requires a transaction without prior publication';
  END IF;
  IF p_kind='india_gst_legal_buyer_override' THEN
    BEGIN
      v_reservation:=(p_payload->>'reservationId')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='native buyer approval reservation is invalid';
    END;
    IF p_subject_type<>'folio' OR v_reservation IS NULL OR p_valid_until IS NULL
       OR p_payload->>'propertyNode' IS DISTINCT FROM p_property::text
       OR p_payload->>'folioId' IS DISTINCT FROM p_subject_id::text THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='native buyer approval scope or expiry is invalid';
    END IF;
    PERFORM public.lock_india_native_intake_authority(p_tenant,p_property,
      v_reservation,v_id,p_actor,'approval-request:'||v_id::text,'valuation');
    PERFORM 1 FROM public.reservation r JOIN public.folio f
      ON f.tenant_id=r.tenant_id AND f.reservation_id=r.id
      WHERE r.tenant_id=p_tenant AND r.id=v_reservation
        AND r.property_node=p_property AND f.id=p_subject_id
      FOR SHARE OF r,f;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native buyer approval reservation and folio are unavailable';
    END IF;
  END IF;
  PERFORM 1 FROM public.tenant t WHERE t.id=p_tenant AND t.status='active' FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='approval request tenant is unavailable';
  END IF;
  PERFORM 1 FROM public.app_user actor JOIN public.org_node property
    ON property.tenant_id=actor.tenant_id AND property.id=p_property AND property.kind='property'
    WHERE actor.tenant_id=p_tenant AND actor.id=p_actor AND actor.status='active'
    FOR SHARE OF actor,property;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='approval request actor or property is unavailable';
  END IF;
  RETURN QUERY INSERT INTO public.approval_request AS approval(
    id,tenant_id,kind,subject_type,subject_id,requested_by,payload,valid_until)
    VALUES(v_id,p_tenant,p_kind,p_subject_type,p_subject_id,p_actor,p_payload,p_valid_until)
    RETURNING approval.*;
END;
$$;
ALTER FUNCTION public.create_approval_request_with_options(uuid,uuid,uuid,uuid,text,text,uuid,jsonb,timestamptz)
  OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.create_approval_request_with_options(uuid,uuid,uuid,uuid,text,text,uuid,jsonb,timestamptz)
  FROM PUBLIC,app_role,yellow_runtime;

-- D1369: forward replacement; the installed0075 trigger and its timing stay intact.
-- Read the complete allocation set once per comparison, not once per source/night.
CREATE OR REPLACE FUNCTION public.assert_native_valuation_conservation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public AS $$
DECLARE v_weights bigint[]; v_count integer;
BEGIN
  IF NEW.basis_kind<>'native_consideration' THEN RETURN NULL; END IF;
  PERFORM pg_catalog.set_config('app.tenant_id',NEW.tenant_id::text,true);
  IF (SELECT pg_catalog.count(*) FROM public.india_gst_accommodation_valuation_source s
      WHERE s.tenant_id=NEW.tenant_id AND s.valuation_id=NEW.id)<>NEW.native_source_count
    OR (SELECT pg_catalog.sum(s.current_amount_minor::numeric)
      FROM public.india_gst_accommodation_valuation_source s
      WHERE s.tenant_id=NEW.tenant_id AND s.valuation_id=NEW.id) IS DISTINCT FROM NEW.transaction_value_minor::numeric
    OR (SELECT pg_catalog.sum(n.transaction_value_minor::numeric)
      FROM public.india_gst_accommodation_valuation_room_night n
      WHERE n.tenant_id=NEW.tenant_id AND n.valuation_id=NEW.id) IS DISTINCT FROM NEW.transaction_value_minor::numeric
    OR EXISTS(SELECT 1 FROM public.india_gst_accommodation_valuation_source s
      WHERE s.tenant_id=NEW.tenant_id AND s.valuation_id=NEW.id
        AND (s.attested_by<>NEW.actor_id OR s.attested_at<>NEW.recorded_at)) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native valuation source conservation or actor binding failed';
  END IF;
  SELECT pg_catalog.count(*),pg_catalog.array_agg(n.quoted_weight_minor ORDER BY n.ordinal)
    INTO v_count,v_weights FROM public.india_gst_accommodation_valuation_room_night n
    WHERE n.tenant_id=NEW.tenant_id AND n.valuation_id=NEW.id;
  IF v_count<>NEW.native_room_night_count OR EXISTS(
    WITH totals AS MATERIALIZED (
      SELECT a.ordinal,pg_catalog.sum(a.amount_minor::numeric) AS amount
      FROM public.india_gst_accommodation_valuation_allocation a
      WHERE a.tenant_id=NEW.tenant_id AND a.valuation_id=NEW.id GROUP BY a.ordinal
    )
    SELECT 1 FROM public.india_gst_accommodation_valuation_room_night n
    LEFT JOIN totals a ON a.ordinal=n.ordinal
    WHERE n.tenant_id=NEW.tenant_id AND n.valuation_id=NEW.id
      AND (n.ordinal>=v_count OR n.transaction_value_minor IS NULL OR n.transaction_value_minor<=0
        OR n.transaction_value_minor::numeric IS DISTINCT FROM COALESCE(a.amount,0))
  ) THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native valuation room-night conservation failed'; END IF;
  IF EXISTS(
    WITH expected AS MATERIALIZED (
      SELECT s.posting_root_id,(allocation.ordinal-1)::integer AS ordinal,allocation.amount
      FROM public.india_gst_accommodation_valuation_source s
      CROSS JOIN LATERAL pg_catalog.unnest(
        public.india_native_signed_allocations(s.current_amount_minor,v_weights)
      ) WITH ORDINALITY allocation(amount,ordinal)
      WHERE s.tenant_id=NEW.tenant_id AND s.valuation_id=NEW.id
    ), actual AS MATERIALIZED (
      SELECT a.posting_root_id,a.ordinal,a.amount_minor AS amount
      FROM public.india_gst_accommodation_valuation_allocation a
      WHERE a.tenant_id=NEW.tenant_id AND a.valuation_id=NEW.id
    )
    SELECT 1 FROM expected e FULL JOIN actual a
      ON a.posting_root_id=e.posting_root_id AND a.ordinal=e.ordinal
    WHERE COALESCE(a.amount,0) IS DISTINCT FROM e.amount
  ) THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native valuation signed-largest-remainder proof failed'; END IF;
  RETURN NULL;
END;
$$;
ALTER FUNCTION public.assert_native_valuation_conservation() OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.assert_native_valuation_conservation() FROM PUBLIC,app_role,yellow_runtime;

-- End historical 0076-native-completion.sql

-- Exact governed application entry points (Order434, Questions192/193/195).
-- Legacy issue and internal helpers retain their explicit revocations.
GRANT EXECUTE ON FUNCTION public.prepare_india_native_fiscal_invoice_v2(
  uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,text,date,date[],text[],text,uuid)
  TO app_role;
GRANT EXECUTE ON FUNCTION public.consume_india_native_fiscal_accounting_event(uuid,uuid)
  TO app_role;
GRANT EXECUTE ON FUNCTION public.read_india_native_accounting_source_closure(uuid,uuid)
  TO app_role;
GRANT EXECUTE ON FUNCTION public.commit_india_native_fiscal_invoice_v2(uuid,uuid,uuid,uuid,text,jsonb,uuid)
  TO app_role;
GRANT EXECUTE ON FUNCTION public.create_approval_request_with_options(uuid,uuid,uuid,uuid,text,text,uuid,jsonb,timestamptz)
  TO app_role;
