-- Order447: draft only, awaiting separately admitted executed proof.
-- Extend the existing owner-private read projection, not a reporting ledger.
-- The exact predecessor INV body remains intact. No runtime capability is added.
DO $precondition$
BEGIN
  IF (SELECT max(version) FROM public.schema_migration) IS DISTINCT FROM 87
      OR (SELECT btrim(checksum_sha256) FROM public.schema_migration WHERE version=87)
        IS DISTINCT FROM 'c8b4ada5702807a0705a13e888e95730e0dbcc8ac7796e0ad2358208a5f873ba' THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native credit fiscal projection requires exact canonical87';
  END IF;
END $precondition$;

SET ROLE yellow_owner;

DO $extend_native_credit_wire$
DECLARE
  v_oid oid:='public.india_fiscal_submission_project_wire(uuid,uuid,uuid)'::regprocedure;
  v_before pg_catalog.pg_proc%ROWTYPE;v_after pg_catalog.pg_proc%ROWTYPE;
  v_definition text;v_body text;
  v_anchor text:='  SELECT document.* INTO d FROM public.document document';
  v_branch text:=$credit_branch$
  -- Order447 authenticated full-credit branch. The unchanged INV branch follows.
  IF EXISTS(SELECT 1 FROM public.document candidate WHERE candidate.tenant_id=p_tenant
      AND candidate.property_node=p_property AND candidate.id=p_document AND candidate.kind='credit_note') THEN
    DECLARE
      credit_d public.document%ROWTYPE;original_d public.document%ROWTYPE;
      credit public.india_native_fiscal_credit_note%ROWTYPE;
      origin public.india_gst_native_fiscal_document_origin%ROWTYPE;
      binding public.india_gst_accommodation_final_component_tax_journal_binding%ROWTYPE;
      correction public.journal%ROWTYPE;series public.document_series%ROWTYPE;
      expected_lines jsonb;planned_source_lines jsonb;actual_lines jsonb;planned_lines jsonb;
      expected_content jsonb;original_wire jsonb;wire_text text;source_text text;wire_prefix text;
      original_doc_text text;credit_doc_text text;reference_text text;expected_source_hash text;
    BEGIN
      SELECT * INTO credit_d FROM public.document WHERE tenant_id=p_tenant AND id=p_document
        AND property_node=p_property AND kind='credit_note' AND status='issued' AND doc_no IS NOT NULL
        AND business_date IS NOT NULL AND issued_at IS NOT NULL AND sha256~'^[0-9a-f]{64}$';
      SELECT * INTO credit FROM public.india_native_fiscal_credit_note WHERE tenant_id=p_tenant
        AND property_node=p_property AND document_id=p_document;
      IF credit_d.id IS NULL OR credit.id IS NULL OR to_jsonb(credit_d) IS DISTINCT FROM credit.planned_document THEN
        RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='credit wire requires its exact immutable native document binding';
      END IF;
      SELECT * INTO original_d FROM public.document WHERE tenant_id=p_tenant AND id=credit.original_document_id
        AND property_node=p_property AND kind='invoice' AND status='issued';
      SELECT * INTO origin FROM public.india_gst_native_fiscal_document_origin WHERE tenant_id=p_tenant
        AND id=credit.original_origin_id AND document_id=credit.original_document_id AND property_node=p_property
        AND document_kind='invoice' AND source_kind='native_current_transaction_graph' AND source_version=2;
      SELECT * INTO binding FROM public.india_gst_accommodation_final_component_tax_journal_binding
        WHERE tenant_id=p_tenant AND id=credit.accounting_binding_id AND id=origin.native_accounting_binding_id;
      IF original_d.id IS NULL OR original_d.id=credit_d.id OR origin.id IS NULL OR binding.id IS NULL
          OR origin.native_timing_id IS NULL OR origin.native_source_basis_hash IS NULL
          OR credit.valuation_id IS DISTINCT FROM binding.valuation_id
          OR credit.business_date IS DISTINCT FROM credit_d.business_date
          OR credit.created_at IS DISTINCT FROM credit_d.issued_at
          OR credit.created_at IS DISTINCT FROM credit_d.created_at THEN
        RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='credit original native fiscal ancestry is incomplete';
      END IF;

      -- Re-derive original consideration and exact tax peers; planned JSON alone
      -- is not authority, even if a caller could fabricate a same-shaped document.
      expected_lines:=public.india_native_credit_line_templates(p_tenant,original_d.id);
      SELECT jsonb_agg(item||jsonb_build_object('line',(item->'line')-ARRAY['id','journal_id','business_date'])
        ORDER BY (item->'line'->>'seq')::integer) INTO planned_source_lines
        FROM jsonb_array_elements(credit.planned_lines) item;
      expected_source_hash:=public.india_native_source_hash(jsonb_build_object(
        'original',to_jsonb(origin),'accountingBinding',to_jsonb(binding),'lines',expected_lines));
      IF expected_lines IS NULL OR expected_lines IS DISTINCT FROM planned_source_lines
          OR expected_source_hash IS DISTINCT FROM credit.source_evidence_hash THEN
        RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='credit wire source evidence differs from original financial graph';
      END IF;
      SELECT jsonb_agg(to_jsonb(line) ORDER BY line.seq) INTO actual_lines FROM public.posting_line line
        WHERE line.tenant_id=p_tenant AND line.journal_id=credit.correction_journal_id;
      SELECT jsonb_agg(item->'line' ORDER BY (item->'line'->>'seq')::integer) INTO planned_lines
        FROM jsonb_array_elements(credit.planned_lines) item;
      SELECT * INTO correction FROM public.journal WHERE tenant_id=p_tenant AND id=credit.correction_journal_id;
      IF actual_lines IS NULL OR actual_lines IS DISTINCT FROM planned_lines OR correction.id IS NULL
          OR correction.kind IS DISTINCT FROM 'correction' OR correction.reverses IS NOT NULL OR correction.currency IS DISTINCT FROM 'INR'
          OR correction.property_node IS DISTINCT FROM p_property OR correction.business_date IS DISTINCT FROM credit.business_date
          OR correction.created_at IS DISTINCT FROM credit.created_at OR correction.created_by IS DISTINCT FROM credit.actor_id
          OR correction.description IS DISTINCT FROM credit.reason OR correction.source IS DISTINCT FROM jsonb_build_object(
            'interface','financials.india-native-credit-note.post','credit_note_id',credit.id) THEN
        RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='credit wire correction graph is incomplete';
      END IF;
      SELECT * INTO series FROM public.document_series WHERE tenant_id=p_tenant AND id=credit.series_id;
      IF series.id IS NULL OR series.kind IS DISTINCT FROM 'credit_note' OR series.fiscal IS DISTINCT FROM true
          OR series.property_node IS DISTINCT FROM p_property OR series.supplier_registration_id IS DISTINCT FROM origin.supplier_registration_id
          OR credit_d.series_id IS DISTINCT FROM series.id OR credit_d.subject_type IS DISTINCT FROM 'folio' OR credit_d.subject_id IS DISTINCT FROM origin.folio_id
          OR credit_d.doc_no!~'^[A-Za-z0-9/-]{1,16}$'
          OR series.financial_year_start IS DISTINCT FROM make_date(extract(year FROM credit.business_date)::integer
            -CASE WHEN extract(month FROM credit.business_date)<4 THEN 1 ELSE 0 END,4,1) THEN
        RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='credit wire fiscal document identity is inconsistent';
      END IF;
      expected_content:=original_d.content||jsonb_build_object('DocDtls',jsonb_build_object('Typ','CRN',
        'No',credit_d.doc_no,'Dt',to_char(credit.business_date,'DD/MM/YYYY')),
        'RefDtls',jsonb_build_object('PrecDocDtls',jsonb_build_array(jsonb_build_object(
          'InvNo',original_d.doc_no,'InvDt',to_char(original_d.business_date,'DD/MM/YYYY')))),
        'YellowCredit',jsonb_build_object('originalDocumentId',original_d.id,'originalSha256',original_d.sha256,
          'reason',credit.reason,'correctionJournalId',credit.correction_journal_id,'sourceEvidenceHash',credit.source_evidence_hash));
      source_text:=credit_d.content::text;
      IF credit_d.content IS DISTINCT FROM expected_content
          OR octet_length(source_text) NOT BETWEEN 1 AND 1048576
          OR encode(public.digest(convert_to(source_text,'UTF8'),'sha256'),'hex') IS DISTINCT FROM credit_d.sha256 THEN
        RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='credit wire source content/hash differs from authenticated original';
      END IF;

      -- Recursion is bounded to one authenticated original INVOICE, never another
      -- credit. This runs every original INV guard and shared scalar serializer,
      -- including v2 origins with their current completed-receipt evidence format.
      original_wire:=public.india_fiscal_submission_project_wire(p_tenant,p_property,original_d.id);
      wire_text:=original_wire->>'wireText';
      original_doc_text:='{"Typ":"INV","No":'||to_json(original_d.doc_no)::text
        ||',"Dt":'||to_json(to_char(original_d.business_date,'DD/MM/YYYY'))::text||'}';
      credit_doc_text:='{"Typ":"CRN","No":'||to_json(credit_d.doc_no)::text
        ||',"Dt":'||to_json(to_char(credit.business_date,'DD/MM/YYYY'))::text||'}';
      wire_prefix:='{"Version":"1.1","TranDtls":{"TaxSch":"GST","SupTyp":"B2B"},"DocDtls":';
      IF left(wire_text,length(wire_prefix||original_doc_text)) IS DISTINCT FROM wire_prefix||original_doc_text
          OR right(wire_text,1) IS DISTINCT FROM '}' THEN
        RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='authenticated original wire envelope is inconsistent';
      END IF;
      -- Splice only the validated exact leading DocDtls and final object close.
      -- No float, JSON reserialization, global replacement or private metadata.
      wire_text:=wire_prefix||credit_doc_text||substr(wire_text,length(wire_prefix||original_doc_text)+1);
      reference_text:='{"PrecDocDtls":[{"InvNo":'||to_json(original_d.doc_no)::text
        ||',"InvDt":'||to_json(to_char(original_d.business_date,'DD/MM/YYYY'))::text||'}]}';
      wire_text:=left(wire_text,length(wire_text)-1)||',"RefDtls":'||reference_text||'}';
      RETURN jsonb_build_object('documentSha256',credit_d.sha256,
        'wireSha256',encode(public.digest(convert_to(wire_text,'UTF8'),'sha256'),'hex'),
        'wireText',wire_text,'businessDate',credit_d.business_date);
    END;
  END IF;
$credit_branch$;
BEGIN
  SELECT * INTO STRICT v_before FROM pg_catalog.pg_proc WHERE oid=v_oid;
  v_body:=replace(v_before.prosrc,E'\r\n',E'\n');
  IF encode(public.digest(convert_to(v_body,'UTF8'),'sha256'),'hex')
      IS DISTINCT FROM 'ca6b253d5fd162f4ff79aa810d479c14cf5e11692ffbfcec2732d4f34c8a3cd0'
      OR v_before.proowner<>'yellow_owner'::regrole OR v_before.prosecdef
      OR v_before.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, public, pg_temp','TimeZone=UTC','DateStyle=ISO,YMD']::text[]
      OR has_function_privilege('app_role',v_oid,'EXECUTE') OR has_function_privilege('yellow_runtime',v_oid,'EXECUTE') THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='credit wire predecessor definition or private authority differs';
  END IF;
  v_definition:=replace(pg_catalog.pg_get_functiondef(v_oid),E'\r\n',E'\n');
  IF (length(v_definition)-length(replace(v_definition,v_anchor,'')))/length(v_anchor)<>1 THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='credit wire predecessor insertion point is ambiguous';
  END IF;
  EXECUTE replace(v_definition,v_anchor,v_branch||v_anchor);
  SELECT * INTO STRICT v_after FROM pg_catalog.pg_proc WHERE oid=v_oid;
  IF v_after.proowner IS DISTINCT FROM v_before.proowner OR v_after.proacl IS DISTINCT FROM v_before.proacl
      OR v_after.proconfig IS DISTINCT FROM v_before.proconfig OR v_after.prosecdef IS DISTINCT FROM v_before.prosecdef
      OR v_after.provolatile IS DISTINCT FROM v_before.provolatile OR v_after.proargtypes IS DISTINCT FROM v_before.proargtypes
      OR v_after.prorettype IS DISTINCT FROM v_before.prorettype
      OR replace(replace(v_after.prosrc,E'\r\n',E'\n'),v_branch,'') IS DISTINCT FROM v_body THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='credit wire replacement changed predecessor or capability identity';
  END IF;
END $extend_native_credit_wire$;

RESET ROLE;
