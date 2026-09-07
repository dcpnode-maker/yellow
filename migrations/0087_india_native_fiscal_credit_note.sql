-- Order446. Draft only until independently executed against admitted targets.
-- Full credit is a new financial graph; original invoice and transfer graphs stay intact.
DO $precondition$
BEGIN
  IF (SELECT max(version) FROM public.schema_migration) IS DISTINCT FROM 86 THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native credit note requires frontier86';
  END IF;
END $precondition$;

SET ROLE yellow_owner;

CREATE TABLE public.india_native_fiscal_credit_note (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL,
  property_node uuid NOT NULL,
  actor_id uuid NOT NULL,
  original_document_id uuid NOT NULL,
  original_origin_id uuid NOT NULL,
  valuation_id uuid NOT NULL,
  accounting_binding_id uuid NOT NULL,
  document_id uuid NOT NULL,
  correction_journal_id uuid NOT NULL,
  series_id uuid NOT NULL,
  business_date date NOT NULL CHECK (pg_catalog.isfinite(business_date)),
  created_at timestamptz NOT NULL,
  issuing_transaction_id xid8 NOT NULL,
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 500
    AND btrim(reason,U&'\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')<>''
    AND reason !~ '[\x01-\x1f\x7f]'),
  request_key_hash text NOT NULL CHECK (request_key_hash ~ '^[0-9a-f]{64}$'),
  request_hash text NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  correlation_id uuid NOT NULL,
  source_evidence_hash text NOT NULL CHECK (source_evidence_hash ~ '^[0-9a-f]{64}$'),
  planned_lines jsonb NOT NULL CHECK (jsonb_typeof(planned_lines)='array'
    AND jsonb_array_length(planned_lines) BETWEEN 2 AND 1004),
  planned_document jsonb NOT NULL CHECK (jsonb_typeof(planned_document)='object'),
  receipt_json text NOT NULL CHECK (jsonb_typeof(receipt_json::jsonb)='object'),
  PRIMARY KEY (tenant_id,id),
  UNIQUE (tenant_id,original_document_id),
  UNIQUE (tenant_id,document_id),
  UNIQUE (tenant_id,correction_journal_id),
  UNIQUE (tenant_id,request_key_hash),
  FOREIGN KEY (tenant_id,property_node) REFERENCES public.org_node(tenant_id,id),
  FOREIGN KEY (tenant_id,actor_id) REFERENCES public.app_user(tenant_id,id),
  FOREIGN KEY (tenant_id,original_document_id) REFERENCES public.document(tenant_id,id),
  FOREIGN KEY (tenant_id,original_origin_id) REFERENCES public.india_gst_native_fiscal_document_origin(tenant_id,id),
  FOREIGN KEY (tenant_id,valuation_id) REFERENCES public.india_gst_accommodation_final_valuation(tenant_id,id),
  FOREIGN KEY (tenant_id,accounting_binding_id) REFERENCES public.india_gst_accommodation_final_component_tax_journal_binding(tenant_id,id),
  FOREIGN KEY (tenant_id,series_id) REFERENCES public.document_series(tenant_id,id),
  FOREIGN KEY (tenant_id,document_id) REFERENCES public.document(tenant_id,id) DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (tenant_id,correction_journal_id) REFERENCES public.journal(tenant_id,id) DEFERRABLE INITIALLY DEFERRED,
  CHECK (document_id<>original_document_id)
);
CREATE INDEX india_native_credit_property ON public.india_native_fiscal_credit_note
  (tenant_id,property_node,business_date,document_id);
ALTER TABLE public.india_native_fiscal_credit_note ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.india_native_fiscal_credit_note FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON public.india_native_fiscal_credit_note
  USING (tenant_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)
  WITH CHECK (tenant_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid);
REVOKE ALL ON public.india_native_fiscal_credit_note FROM PUBLIC,app_role,yellow_runtime;
GRANT SELECT ON public.india_native_fiscal_credit_note TO app_role;

CREATE FUNCTION public.prevent_india_native_credit_mutation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
  RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native credit note artifacts are immutable';
END $$;
CREATE TRIGGER india_native_credit_immutable BEFORE UPDATE OR DELETE
  ON public.india_native_fiscal_credit_note FOR EACH ROW EXECUTE FUNCTION public.prevent_india_native_credit_mutation();

-- Exclude only credit roots authenticated by the final deferred artifact check.
-- A caller marker, source JSON or journal kind never excludes a consideration root.
CREATE OR REPLACE FUNCTION public.india_native_consideration_roots(
  p_tenant uuid,p_folio uuid,p_account uuid
) RETURNS uuid[] LANGUAGE sql STABLE SET search_path=pg_catalog,public,pg_temp AS $$
  SELECT COALESCE(array_agg(root_id ORDER BY root_id),'{}'::uuid[]) FROM (
    SELECT root.id root_id FROM public.posting_line root
    JOIN public.tx_code code ON code.code=root.tx_code AND code.grp IN ('revenue','adjustment')
    JOIN public.posting_line fragment ON fragment.tenant_id=root.tenant_id
      AND COALESCE(fragment.folio_transfer_root_line_id,fragment.id)=root.id
    WHERE root.tenant_id=p_tenant AND root.account_id=p_account
      AND root.folio_transfer_root_line_id IS NULL AND root.folio_id IS NOT NULL
      AND NOT EXISTS(SELECT 1 FROM public.india_native_fiscal_credit_note credit
        WHERE credit.tenant_id=root.tenant_id AND credit.correction_journal_id=root.journal_id)
    GROUP BY root.id HAVING sum(fragment.amount_minor::numeric)
      FILTER (WHERE fragment.folio_id=p_folio)<>0
  ) roots
$$;

-- Extend consumption to the correction's own immutable journal/roots. This is
-- additive protection: no existing original-source guard is removed.
DO $credit_consumption$
DECLARE v_body text;v_changed text;
BEGIN
  v_body:=pg_get_functiondef('public.india_native_journal_is_consumed(uuid,uuid)'::regprocedure);
  v_changed:=replace(v_body,'SELECT EXISTS (','SELECT EXISTS (SELECT 1 FROM public.india_native_fiscal_credit_note credit
    WHERE credit.tenant_id=p_tenant AND credit.correction_journal_id=p_journal) OR EXISTS (');
  IF v_changed=v_body THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native journal consumption predecessor drifted'; END IF;
  EXECUTE v_changed;
  v_body:=pg_get_functiondef('public.india_native_root_is_consumed(uuid,uuid)'::regprocedure);
  v_changed:=replace(v_body,'SELECT EXISTS (','SELECT EXISTS (SELECT 1 FROM public.india_native_fiscal_credit_note credit
    JOIN public.posting_line credit_root ON credit_root.tenant_id=credit.tenant_id
      AND credit.correction_journal_id=credit_root.journal_id
    WHERE credit.tenant_id=p_tenant AND credit_root.id=p_root) OR EXISTS (');
  IF v_changed=v_body THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native root consumption predecessor drifted'; END IF;
  EXECUTE v_changed;
END $credit_consumption$;
ALTER FUNCTION public.india_native_journal_is_consumed(uuid,uuid) SET search_path TO pg_catalog,public,pg_temp;
ALTER FUNCTION public.india_native_root_is_consumed(uuid,uuid) SET search_path TO pg_catalog,public,pg_temp;

-- Derived immutable templates retain original quantity/description/tx-code/tax details.
-- Each consideration root has exactly one original revenue peer, even when its
-- guest allocation travelled in a multi-root transfer. Transfers are never reversed.
CREATE FUNCTION public.india_native_credit_line_templates(p_tenant uuid,p_original uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE o public.india_gst_native_fiscal_document_origin%ROWTYPE;
  b public.india_gst_accommodation_final_component_tax_journal_binding%ROWTYPE;
  v_result jsonb; v_count integer;
BEGIN
  SELECT * INTO STRICT o FROM public.india_gst_native_fiscal_document_origin
    WHERE tenant_id=p_tenant AND document_id=p_original AND source_kind='native_current_transaction_graph';
  SELECT * INTO STRICT b FROM public.india_gst_accommodation_final_component_tax_journal_binding
    WHERE tenant_id=p_tenant AND id=o.native_accounting_binding_id AND native_timing_id=o.native_timing_id;
  PERFORM public.read_india_native_completed_receipt(p_tenant,o.native_timing_id);
  SELECT count(*) INTO v_count FROM public.india_gst_accommodation_valuation_source
    WHERE tenant_id=p_tenant AND valuation_id=b.valuation_id;
  WITH source_lines AS (
    SELECT s.posting_root_id, l.id AS source_line_id, 0 AS phase, s.posting_root_id AS root_sort,l.seq AS line_sort,
      to_jsonb(l)-ARRAY['id','journal_id','seq','business_date'] || jsonb_build_object(
        'amount_minor',CASE WHEN l.seq=1 THEN -s.current_amount_minor ELSE s.current_amount_minor END,
        'folio_id',CASE WHEN l.seq=1 THEN b.folio_id ELSE NULL::uuid END) AS line
    FROM public.india_gst_accommodation_valuation_source s
    JOIN public.posting_line root ON root.tenant_id=s.tenant_id AND root.id=s.posting_root_id
    JOIN public.posting_line l ON l.tenant_id=root.tenant_id AND l.journal_id=root.journal_id AND l.seq IN (1,2)
    WHERE s.tenant_id=p_tenant AND s.valuation_id=b.valuation_id
    UNION ALL
    SELECT NULL::uuid,l.id,1,l.journal_id,l.seq,
      to_jsonb(l)-ARRAY['id','journal_id','seq','business_date'] || jsonb_build_object('amount_minor',-l.amount_minor)
    FROM public.posting_line l WHERE l.tenant_id=p_tenant AND l.journal_id=b.journal_id
  ) SELECT jsonb_agg(jsonb_build_object('postingRootId',posting_root_id,'sourceLineId',source_line_id,
      'line',line||jsonb_build_object('seq',ordinal)) ORDER BY ordinal) INTO v_result
    FROM (SELECT *,row_number() OVER(ORDER BY phase,root_sort,line_sort) ordinal FROM source_lines) numbered;
  IF jsonb_array_length(v_result)<>2*v_count+(SELECT count(*) FROM public.posting_line
      WHERE tenant_id=p_tenant AND journal_id=b.journal_id)
      OR EXISTS(SELECT 1 FROM jsonb_array_elements(v_result) item
        WHERE (item->'line'->>'amount_minor')::numeric NOT BETWEEN -9223372036854775807 AND 9223372036854775807)
      OR (SELECT sum((item->'line'->>'amount_minor')::numeric) FROM jsonb_array_elements(v_result) item)<>0 THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native credit source line set is inconsistent';
  END IF;
  RETURN v_result;
END $$;

-- Runtime authority is independent from the original actor and current folio state.
CREATE FUNCTION public.assert_india_native_credit_authority(
  p_tenant uuid,p_property uuid,p_actor uuid,p_permissions text[],p_lock boolean DEFAULT false
) RETURNS void LANGUAGE plpgsql VOLATILE SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_permission text; v_context uuid;v_roles uuid[];v_nodes uuid[];
  v_user_roles jsonb;v_grants jsonb;v_after jsonb;
BEGIN
  BEGIN v_context:=NULLIF(current_setting('app.tenant_id',true),'')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='native credit authority unavailable'; END;
  IF session_user<>'yellow_runtime' OR current_user<>'yellow_owner'
      OR current_setting('role',true) IS DISTINCT FROM 'app_role'
      OR p_tenant IS NULL OR p_property IS NULL OR p_actor IS NULL OR v_context IS DISTINCT FROM p_tenant THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='native credit authority unavailable';
  END IF;
  IF p_lock THEN
    SELECT array_agg(DISTINCT role_id ORDER BY role_id),
      jsonb_agg(to_jsonb(ur) ORDER BY role_id,scope_node) INTO v_roles,v_user_roles
      FROM public.user_role ur WHERE tenant_id=p_tenant AND user_id=p_actor;
    SELECT array_agg(id ORDER BY id) INTO v_nodes FROM (
      SELECT p_property id UNION SELECT scope_node FROM public.user_role
      WHERE tenant_id=p_tenant AND user_id=p_actor) nodes;
    SELECT jsonb_agg(to_jsonb(rp) ORDER BY role_id,permission_code) INTO v_grants
      FROM public.role_permission rp WHERE role_id=ANY(v_roles);
    PERFORM 1 FROM public.tenant WHERE id=p_tenant FOR SHARE;
    PERFORM 1 FROM public.org_node WHERE tenant_id=p_tenant AND id=ANY(v_nodes) ORDER BY id FOR SHARE;
    PERFORM 1 FROM public.app_user WHERE tenant_id=p_tenant AND id=p_actor FOR SHARE;
    PERFORM 1 FROM public.role WHERE tenant_id=p_tenant AND id=ANY(v_roles) ORDER BY id FOR SHARE;
    PERFORM 1 FROM public.user_role ur WHERE tenant_id=p_tenant AND user_id=p_actor
      AND EXISTS(SELECT 1 FROM jsonb_array_elements(v_user_roles) prior WHERE prior=to_jsonb(ur))
      ORDER BY role_id,scope_node FOR SHARE;
    PERFORM 1 FROM public.role_permission rp WHERE role_id=ANY(v_roles)
      AND EXISTS(SELECT 1 FROM jsonb_array_elements(v_grants) prior WHERE prior=to_jsonb(rp))
      ORDER BY role_id,permission_code FOR SHARE;
    SELECT jsonb_agg(to_jsonb(ur) ORDER BY role_id,scope_node) INTO v_after
      FROM public.user_role ur WHERE tenant_id=p_tenant AND user_id=p_actor;
    IF v_after IS DISTINCT FROM v_user_roles THEN
      RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='native credit actor membership changed while locking'; END IF;
    SELECT jsonb_agg(to_jsonb(rp) ORDER BY role_id,permission_code) INTO v_after
      FROM public.role_permission rp WHERE role_id=ANY(v_roles);
    IF v_after IS DISTINCT FROM v_grants THEN
      RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='native credit permission membership changed while locking'; END IF;
  END IF;
  FOREACH v_permission IN ARRAY p_permissions LOOP
    PERFORM 1 FROM public.tenant t
      JOIN public.app_user a ON a.tenant_id=t.id AND a.id=p_actor AND a.status='active'
      JOIN public.org_node p ON p.tenant_id=t.id AND p.id=p_property AND p.kind='property' AND p.currency='INR'
      JOIN public.user_role ur ON ur.tenant_id=a.tenant_id AND ur.user_id=a.id
      JOIN public.role r ON r.tenant_id=ur.tenant_id AND r.id=ur.role_id
      JOIN public.role_permission rp ON rp.role_id=r.id AND rp.permission_code=v_permission
      JOIN public.org_node scope ON scope.tenant_id=ur.tenant_id AND scope.id=ur.scope_node AND scope.path @> p.path
      WHERE t.id=p_tenant AND t.status='active';
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='native credit authority unavailable'; END IF;
  END LOOP;
END $$;

CREATE FUNCTION public.guard_india_native_credit_birth() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
  PERFORM public.assert_india_native_credit_authority(NEW.tenant_id,NEW.property_node,NEW.actor_id,
    ARRAY['tax-fiscal.documents:issue','financials.adjustments:write']);
  IF NEW.issuing_transaction_id IS DISTINCT FROM pg_current_xact_id()
      OR NEW.created_at IS DISTINCT FROM transaction_timestamp()
      OR NEW.business_date IS DISTINCT FROM (SELECT (transaction_timestamp() AT TIME ZONE p.timezone)::date
        FROM public.org_node p WHERE p.tenant_id=NEW.tenant_id AND p.id=NEW.property_node)
      OR NEW.request_hash IS DISTINCT FROM public.india_native_source_hash(jsonb_build_object(
        'tenantId',NEW.tenant_id,'propertyNode',NEW.property_node,'actorId',NEW.actor_id,
        'originalDocumentId',NEW.original_document_id,'reason',NEW.reason)) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native credit birth is not its current governed transaction';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER india_native_credit_birth BEFORE INSERT ON public.india_native_fiscal_credit_note
  FOR EACH ROW EXECUTE FUNCTION public.guard_india_native_credit_birth();

-- Exact preallocated line membership is the sole narrow exception to0077.
DO $posting_guard$
DECLARE v_original text;v_changed text;v_needle text:=$needle$  -- Only guest coordination roots:$needle$;
BEGIN
  v_original:=pg_get_functiondef('public.guard_india_native_consumed_posting_line()'::regprocedure);
  IF strpos(v_original,v_needle)=0 OR strpos(v_original,'india_native_fiscal_credit_note')<>0 THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native consumed posting guard predecessor drifted';
  END IF;
  v_changed:=replace(v_original,v_needle,$patch$
  IF EXISTS(SELECT 1 FROM public.india_native_fiscal_credit_note credit
      WHERE credit.tenant_id=NEW.tenant_id AND credit.correction_journal_id=NEW.journal_id) THEN
    IF NOT EXISTS(SELECT 1 FROM public.india_native_fiscal_credit_note credit,
        pg_catalog.jsonb_array_elements(credit.planned_lines) planned
        WHERE credit.tenant_id=NEW.tenant_id AND credit.correction_journal_id=NEW.journal_id
          AND credit.issuing_transaction_id=pg_catalog.pg_current_xact_id()
          AND planned->'line'=pg_catalog.to_jsonb(NEW)) THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native credit posting is not its exact planned artifact';
    END IF;
    PERFORM pg_catalog.set_config('app.tenant_id',v_previous_tenant,true);
    RETURN NEW;
  END IF;
  -- Only guest coordination roots:$patch$);
  EXECUTE v_changed;
END $posting_guard$;
ALTER FUNCTION public.guard_india_native_consumed_posting_line() SET search_path TO pg_catalog,public,pg_temp;

CREATE FUNCTION public.guard_india_native_credit_artifact() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_tenant uuid;v_id uuid;v_previous text:=current_setting('app.tenant_id',true);v_bound boolean;
BEGIN
  v_tenant:=OLD.tenant_id;v_id:=OLD.id;
  PERFORM set_config('app.tenant_id',v_tenant::text,true);
  SELECT EXISTS(SELECT 1 FROM public.india_native_fiscal_credit_note c WHERE c.tenant_id=v_tenant
    AND (CASE TG_TABLE_NAME WHEN 'document' THEN c.document_id=v_id
      WHEN 'journal' THEN c.correction_journal_id=v_id
      ELSE c.correction_journal_id=(to_jsonb(OLD)->>'journal_id')::uuid END)) INTO v_bound;
  IF v_bound THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native credit artifact is immutable'; END IF;
  PERFORM set_config('app.tenant_id',v_previous,true);
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER india_native_credit_document_immutable BEFORE UPDATE OR DELETE ON public.document
  FOR EACH ROW EXECUTE FUNCTION public.guard_india_native_credit_artifact();
CREATE TRIGGER india_native_credit_journal_immutable BEFORE UPDATE OR DELETE ON public.journal
  FOR EACH ROW EXECUTE FUNCTION public.guard_india_native_credit_artifact();
CREATE TRIGGER india_native_credit_line_immutable BEFORE UPDATE OR DELETE ON public.posting_line
  FOR EACH ROW EXECUTE FUNCTION public.guard_india_native_credit_artifact();

CREATE FUNCTION public.assert_india_native_credit_complete() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp SET timezone='UTC' SET datestyle='ISO,YMD' AS $$
DECLARE c public.india_native_fiscal_credit_note%ROWTYPE;v_expected jsonb;v_actual jsonb;
  j public.journal%ROWTYPE;o public.india_gst_native_fiscal_document_origin%ROWTYPE;
  b public.india_gst_accommodation_final_component_tax_journal_binding%ROWTYPE;
  d public.document%ROWTYPE;s public.document_series%ROWTYPE;v_total numeric;v_content jsonb;
  v_previous text:=current_setting('app.tenant_id',true);
BEGIN
  PERFORM set_config('app.tenant_id',NEW.tenant_id::text,true);
  SELECT * INTO STRICT c FROM public.india_native_fiscal_credit_note WHERE tenant_id=NEW.tenant_id AND id=NEW.id;
  SELECT * INTO STRICT o FROM public.india_gst_native_fiscal_document_origin
    WHERE tenant_id=c.tenant_id AND id=c.original_origin_id AND document_id=c.original_document_id;
  SELECT * INTO STRICT b FROM public.india_gst_accommodation_final_component_tax_journal_binding
    WHERE tenant_id=c.tenant_id AND id=c.accounting_binding_id AND id=o.native_accounting_binding_id;
  IF c.valuation_id<>b.valuation_id OR c.property_node<>o.property_node THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native credit source binding mismatch'; END IF;
  v_expected:=public.india_native_credit_line_templates(c.tenant_id,c.original_document_id);
  SELECT jsonb_agg(item||jsonb_build_object('line',(item->'line')-ARRAY['id','journal_id','business_date'])
    ORDER BY (item->'line'->>'seq')::integer) INTO v_actual FROM jsonb_array_elements(c.planned_lines) item;
  IF v_actual IS DISTINCT FROM v_expected OR c.source_evidence_hash IS DISTINCT FROM
      public.india_native_source_hash(jsonb_build_object('original',to_jsonb(o),'accountingBinding',to_jsonb(b),'lines',v_expected)) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native credit planned source differs from original'; END IF;
  SELECT -sum((item->'line'->>'amount_minor')::numeric) INTO v_total
    FROM jsonb_array_elements(v_expected) item WHERE item->'line'->>'folio_id'=o.folio_id::text;
  SELECT * INTO STRICT d FROM public.document WHERE tenant_id=c.tenant_id AND id=c.original_document_id;
  SELECT * INTO STRICT s FROM public.document_series WHERE tenant_id=c.tenant_id AND id=c.series_id;
  v_content:=d.content||jsonb_build_object('DocDtls',jsonb_build_object('Typ','CRN',
      'No',c.planned_document->>'doc_no','Dt',to_char(c.business_date,'DD/MM/YYYY')),
    'RefDtls',jsonb_build_object('PrecDocDtls',jsonb_build_array(jsonb_build_object('InvNo',d.doc_no,
      'InvDt',to_char(d.business_date,'DD/MM/YYYY')))),
    'YellowCredit',jsonb_build_object('originalDocumentId',d.id,'originalSha256',d.sha256,'reason',c.reason,
      'correctionJournalId',c.correction_journal_id,'sourceEvidenceHash',c.source_evidence_hash));
  IF v_total NOT BETWEEN 1 AND 9223372036854775807 OR s.kind<>'credit_note' OR NOT s.fiscal
      OR s.property_node<>c.property_node OR s.supplier_registration_id<>o.supplier_registration_id
      OR s.financial_year_start<>make_date(extract(year FROM c.business_date)::integer
        -CASE WHEN extract(month FROM c.business_date)<4 THEN 1 ELSE 0 END,4,1)
      OR c.planned_document->'content' IS DISTINCT FROM v_content
      OR c.planned_document->>'sha256' IS DISTINCT FROM encode(public.digest(convert_to(v_content::text,'UTF8'),'sha256'),'hex')
      OR c.planned_document->>'kind' IS DISTINCT FROM 'credit_note'
      OR c.planned_document->>'series_id' IS DISTINCT FROM c.series_id::text
      OR c.planned_document->>'property_node' IS DISTINCT FROM c.property_node::text
      OR c.planned_document->>'subject_type' IS DISTINCT FROM 'folio'
      OR c.planned_document->>'subject_id' IS DISTINCT FROM o.folio_id::text
      OR c.planned_document->>'business_date' IS DISTINCT FROM c.business_date::text
      OR c.planned_document->>'status' IS DISTINCT FROM 'issued'
      OR c.planned_document->>'doc_no' IS DISTINCT FROM s.prefix||(s.next_no-1)::text
      OR s.last_doc_hash IS DISTINCT FROM c.planned_document->>'sha256'
      OR (s.next_no=2 AND c.planned_document->'prev_hash'<>'null'::jsonb)
      OR (s.next_no>2 AND NOT EXISTS(SELECT 1 FROM public.document previous
        JOIN public.india_native_fiscal_credit_note prior ON prior.tenant_id=previous.tenant_id AND prior.document_id=previous.id
        WHERE previous.tenant_id=c.tenant_id AND previous.series_id=c.series_id
          AND previous.doc_no=s.prefix||(s.next_no-2)::text
          AND previous.sha256=c.planned_document->>'prev_hash'))
      OR (c.planned_document->>'issued_at')::timestamptz IS DISTINCT FROM c.created_at
      OR (c.planned_document->>'created_at')::timestamptz IS DISTINCT FROM c.created_at
      OR c.receipt_json::jsonb IS DISTINCT FROM jsonb_build_object(
        'documentId',c.document_id,'documentKind','credit_note','originalDocumentId',d.id,
        'originalDocNo',d.doc_no,'originalSha256',d.sha256,'correctionJournalId',c.correction_journal_id,
        'seriesId',s.id,'docNo',c.planned_document->>'doc_no','propertyNode',c.property_node,
        'reservationId',o.reservation_id,'folioId',o.folio_id,'supplierRegistrationId',o.supplier_registration_id,
        'recipientRegistrationId',o.recipient_registration_id,'financialYearStart',s.financial_year_start,
        'currency','INR','status','issued','businessDate',c.business_date,
        'issuedAt',to_char(c.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'prevHash',c.planned_document->'prev_hash','sha256',c.planned_document->>'sha256',
        'sourceEvidenceHash',c.source_evidence_hash,'totalMinor',v_total::bigint::text,'reason',c.reason) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native credit document/receipt differs from original source';
  END IF;
  SELECT jsonb_agg(to_jsonb(l) ORDER BY l.seq) INTO v_actual FROM public.posting_line l
    WHERE l.tenant_id=c.tenant_id AND l.journal_id=c.correction_journal_id;
  SELECT jsonb_agg(item->'line' ORDER BY (item->'line'->>'seq')::integer) INTO v_expected
    FROM jsonb_array_elements(c.planned_lines) item;
  SELECT * INTO j FROM public.journal WHERE tenant_id=c.tenant_id AND id=c.correction_journal_id;
  IF v_actual IS DISTINCT FROM v_expected OR j.id IS NULL OR j.kind<>'correction' OR j.reverses IS NOT NULL
      OR j.currency<>'INR' OR j.property_node<>c.property_node OR j.business_date<>c.business_date
      OR j.created_at<>c.created_at OR j.created_by<>c.actor_id OR j.description<>c.reason
      OR j.source<>jsonb_build_object('interface','financials.india-native-credit-note.post','credit_note_id',c.id) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native credit correction artifact is incomplete'; END IF;
  SELECT to_jsonb(actual_doc) INTO v_actual FROM public.document actual_doc
    WHERE actual_doc.tenant_id=c.tenant_id AND actual_doc.id=c.document_id;
  IF v_actual IS DISTINCT FROM c.planned_document
      OR c.receipt_json::jsonb->>'documentId'<>c.document_id::text
      OR c.receipt_json::jsonb->>'sha256'<>c.planned_document->>'sha256'
      OR NOT EXISTS(SELECT 1 FROM public.fact_log f WHERE f.tenant_id=c.tenant_id AND f.entity_type='document'
        AND f.entity_id=c.document_id AND f.fact_type='issued' AND f.actor_id=c.actor_id
        AND f.payload=c.receipt_json::jsonb AND f.business_date=c.business_date
        AND f.valid_from=c.created_at AND f.valid_to IS NULL AND f.recorded_at=c.created_at)
      OR (SELECT count(*) FROM public.fact_log f WHERE f.tenant_id=c.tenant_id AND f.entity_type='document'
        AND f.entity_id=c.document_id AND f.fact_type='issued')<>1
      OR NOT EXISTS(SELECT 1 FROM public.outbox e WHERE e.tenant_id=c.tenant_id AND e.aggregate_type='document'
        AND e.aggregate_id=c.document_id AND e.event_type='document.issued' AND e.actor_id=c.actor_id
        AND e.correlation_id=c.correlation_id AND e.payload=c.receipt_json::jsonb
        AND e.property_node=c.property_node AND e.business_date=c.business_date AND e.created_at=c.created_at)
      OR (SELECT count(*) FROM public.outbox e WHERE e.tenant_id=c.tenant_id AND e.aggregate_type='document'
        AND e.aggregate_id=c.document_id AND e.event_type='document.issued')<>1
      OR NOT EXISTS(SELECT 1 FROM public.api_idempotency r WHERE r.tenant_id=c.tenant_id
        AND r.operation='document.credit_note.issued' AND r.key_hash=c.request_key_hash
        AND r.request_hash=c.request_hash AND r.response_body=c.receipt_json::jsonb AND r.response_status=201
        AND r.completed_at=c.created_at) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native credit document/event/receipt artifact is incomplete'; END IF;
  PERFORM set_config('app.tenant_id',v_previous,true);
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER india_native_credit_complete AFTER INSERT ON public.india_native_fiscal_credit_note
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.assert_india_native_credit_complete();

CREATE FUNCTION public.commit_india_native_fiscal_credit_note(
  p_tenant uuid,p_property uuid,p_actor uuid,p_original uuid,p_reason text,p_key text,p_correlation uuid
) RETURNS TABLE(receipt_json text,replayed boolean)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp SET timezone='UTC' SET datestyle='ISO,YMD' AS $$
DECLARE o public.india_gst_native_fiscal_document_origin%ROWTYPE;
  b public.india_gst_accommodation_final_component_tax_journal_binding%ROWTYPE;
  c public.india_native_fiscal_credit_note%ROWTYPE;s public.document_series%ROWTYPE;d public.document%ROWTYPE;
  v_lines jsonb;v_before jsonb;v_templates jsonb;v_content jsonb;v_receipt text;v_source_hash text;
  v_key_hash text;v_request_hash text;v_date date;v_fy date;v_dates date[];v_roots uuid[];v_accounts uuid[];v_journals uuid[];
  v_id uuid;v_credit uuid:=gen_random_uuid();v_document uuid:=gen_random_uuid();v_journal uuid:=gen_random_uuid();
  v_now timestamptz:=transaction_timestamp();v_doc_no text;v_hash text;v_tail text;v_total numeric;v_locked integer;
  v_permissions text[]:=ARRAY['tax-fiscal.documents:issue','financials.adjustments:write'];
BEGIN
  PERFORM public.assert_india_native_credit_authority(p_tenant,p_property,p_actor,v_permissions);
  IF p_original IS NULL OR p_reason IS NULL OR char_length(p_reason) NOT BETWEEN 1 AND 500
      OR btrim(p_reason,U&'\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')=''
      OR p_reason ~ '[\x01-\x1f\x7f]'
      OR p_key IS NULL OR p_key COLLATE "C" !~ '^[!-~]{8,200}$' OR p_correlation IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='native credit input is invalid'; END IF;
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_locks l WHERE l.pid=pg_backend_pid() AND l.locktype='advisory' AND l.granted
      AND l.objsubid=1 AND l.classid=((6441674055002974568::bigint>>32)&4294967295)::oid
      AND l.objid=(6441674055002974568::bigint&4294967295)::oid) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native credit requires transaction without prior publication'; END IF;
  v_key_hash:=encode(public.digest(p_key,'sha256'),'hex');
  v_request_hash:=public.india_native_source_hash(jsonb_build_object('tenantId',p_tenant,'propertyNode',p_property,
    'actorId',p_actor,'originalDocumentId',p_original,'reason',p_reason));
  -- Resolve committed changed-key payloads before an altered source selector can
  -- become a not-found result. This immutable read adds no inverse-order lock.
  SELECT * INTO c FROM public.india_native_fiscal_credit_note WHERE tenant_id=p_tenant AND request_key_hash=v_key_hash;
  IF FOUND AND c.request_hash<>v_request_hash THEN
    RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='native credit idempotency conflict'; END IF;
  SELECT * INTO o FROM public.india_gst_native_fiscal_document_origin WHERE tenant_id=p_tenant
    AND document_id=p_original AND property_node=p_property AND source_kind='native_current_transaction_graph';
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='native original invoice unavailable'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant::text||o.reservation_id::text||o.folio_id::text,0));
  -- Durable binding survives api_idempotency expiry/pruning and later day/folio changes.
  SELECT * INTO c FROM public.india_native_fiscal_credit_note WHERE tenant_id=p_tenant AND request_key_hash=v_key_hash;
  IF FOUND THEN
    IF c.request_hash<>v_request_hash THEN RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='native credit idempotency conflict'; END IF;
    PERFORM public.assert_india_native_credit_authority(p_tenant,p_property,p_actor,v_permissions,true);
    IF EXISTS(SELECT 1 FROM public.business_day source_day WHERE source_day.tenant_id=p_tenant AND source_day.property_node=p_property
        AND source_day.sealed_at IS NOT NULL AND source_day.business_date IN (
          SELECT o.issue_date UNION SELECT accounting.business_date
          FROM public.india_gst_accommodation_final_component_tax_journal_binding accounting
          WHERE accounting.tenant_id=p_tenant AND accounting.id=o.native_accounting_binding_id
          UNION SELECT journal.business_date FROM public.india_gst_accommodation_valuation_source source
          JOIN public.posting_line fragment ON fragment.tenant_id=source.tenant_id
            AND COALESCE(fragment.folio_transfer_root_line_id,fragment.id)=source.posting_root_id
          JOIN public.journal journal ON journal.tenant_id=fragment.tenant_id AND journal.id=fragment.journal_id
          WHERE source.tenant_id=p_tenant AND source.valuation_id=c.valuation_id)) THEN
      PERFORM public.assert_india_native_credit_authority(p_tenant,p_property,p_actor,
        ARRAY['financials.adjustments:post-seal']);
    END IF;
    RETURN QUERY SELECT c.receipt_json,true;RETURN;
  END IF;
  IF EXISTS(SELECT 1 FROM public.india_native_fiscal_credit_note WHERE tenant_id=p_tenant AND original_document_id=p_original) THEN
    RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='native invoice already fully credited'; END IF;
  SELECT * INTO STRICT b FROM public.india_gst_accommodation_final_component_tax_journal_binding
    WHERE tenant_id=p_tenant AND id=o.native_accounting_binding_id;
  v_before:=public.india_native_credit_line_templates(p_tenant,p_original);
  SELECT array_agg(posting_root_id ORDER BY posting_root_id) INTO v_roots
    FROM public.india_gst_accommodation_valuation_source WHERE tenant_id=p_tenant AND valuation_id=b.valuation_id;
  SELECT array_agg(id ORDER BY id) INTO v_accounts FROM (
    SELECT unnest(public.india_native_consideration_accounts(p_tenant,v_roots,b.guest_account_id)) id
    UNION SELECT account_id FROM public.posting_line WHERE tenant_id=p_tenant AND journal_id=b.journal_id
  ) ids;
  PERFORM 1 FROM public.account WHERE tenant_id=p_tenant AND id=ANY(v_accounts) AND property_node=p_property
    AND currency='INR' ORDER BY id FOR UPDATE;
  GET DIAGNOSTICS v_locked=ROW_COUNT;
  IF v_locked<>cardinality(v_accounts) THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native credit accounts unavailable'; END IF;
  PERFORM 1 FROM public.folio WHERE tenant_id=p_tenant AND id=o.folio_id AND account_id=b.guest_account_id FOR UPDATE;
  FOREACH v_id IN ARRAY v_roots LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant::text||':folio-transfer-root:'||v_id::text,188));
  END LOOP;
  SELECT array_agg(id ORDER BY id) INTO v_journals FROM (
    SELECT l.journal_id id FROM public.posting_line l WHERE l.tenant_id=p_tenant
      AND COALESCE(l.folio_transfer_root_line_id,l.id)=ANY(v_roots)
    UNION SELECT j.reverses FROM public.journal j JOIN public.posting_line l
      ON l.tenant_id=j.tenant_id AND l.journal_id=j.id WHERE l.tenant_id=p_tenant AND l.id=ANY(v_roots) AND j.reverses IS NOT NULL
    UNION SELECT b.journal_id WHERE b.journal_id IS NOT NULL
  ) ids;
  FOREACH v_id IN ARRAY v_journals LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant::text||':'||v_id::text,0));
  END LOOP;
  FOREACH v_id IN ARRAY v_journals LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant::text||':positive-tax-correction:'||v_id::text,266));
  END LOOP;
  FOREACH v_id IN ARRAY v_journals LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant::text||':india-final-component-tax-correction:'||v_id::text,408));
  END LOOP;
  FOREACH v_id IN ARRAY v_journals LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended('india-final-component-tax-journal-reversal:'||p_tenant::text||':'||v_id::text,408));
  END LOOP;
  PERFORM pg_advisory_xact_lock(hashtextextended('india-native-credit-key:'||p_tenant::text||':'||v_key_hash,446));
  -- Recheck key after its cross-folio lock; no second effect can reuse a key.
  IF EXISTS(SELECT 1 FROM public.india_native_fiscal_credit_note WHERE tenant_id=p_tenant AND request_key_hash=v_key_hash) THEN
    RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='native credit idempotency conflict'; END IF;
  PERFORM public.assert_india_native_credit_authority(p_tenant,p_property,p_actor,v_permissions,true);
  v_templates:=public.india_native_credit_line_templates(p_tenant,p_original);
  IF v_templates IS DISTINCT FROM v_before THEN RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='native credit source changed'; END IF;
  SELECT (v_now AT TIME ZONE timezone)::date INTO v_date FROM public.org_node WHERE tenant_id=p_tenant AND id=p_property;
  SELECT array_agg(source_date ORDER BY source_date) INTO v_dates FROM (
    SELECT v_date AS source_date UNION SELECT o.issue_date UNION SELECT b.business_date
    UNION SELECT business_date FROM public.journal WHERE tenant_id=p_tenant AND id=ANY(v_journals)
  ) days;
  PERFORM 1 FROM public.business_day WHERE tenant_id=p_tenant AND property_node=p_property
    AND business_date=ANY(v_dates) ORDER BY business_date FOR SHARE;
  GET DIAGNOSTICS v_locked=ROW_COUNT;
  IF v_locked<>cardinality(v_dates) OR EXISTS(SELECT 1 FROM public.business_day WHERE tenant_id=p_tenant
      AND property_node=p_property AND business_date=v_date AND sealed_at IS NOT NULL) THEN
    RAISE EXCEPTION USING ERRCODE='P0011',MESSAGE='native credit current business day is unavailable'; END IF;
  IF EXISTS(SELECT 1 FROM public.business_day WHERE tenant_id=p_tenant AND property_node=p_property
      AND business_date=ANY(v_dates) AND sealed_at IS NOT NULL) THEN
    PERFORM public.assert_india_native_credit_authority(p_tenant,p_property,p_actor,
      ARRAY['financials.adjustments:post-seal']); END IF;
  v_fy:=make_date(extract(year FROM v_date)::integer-CASE WHEN extract(month FROM v_date)<4 THEN 1 ELSE 0 END,4,1);
  SELECT * INTO s FROM public.document_series WHERE tenant_id=p_tenant AND property_node=p_property
    AND supplier_registration_id=o.supplier_registration_id AND kind='credit_note' AND fiscal
    AND financial_year_start=v_fy FOR UPDATE;
  IF NOT FOUND OR s.next_no NOT BETWEEN 1 AND 9223372036854775806 OR s.prefix IS NULL
      OR s.prefix<>btrim(s.prefix) OR char_length(s.prefix) NOT BETWEEN 1 AND 12 OR s.prefix !~ '^[A-Za-z0-9/-]+$'
      OR length(s.prefix||s.next_no::text)>16 THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native credit fiscal series unavailable'; END IF;
  IF s.next_no=1 THEN
    IF s.last_doc_hash IS NOT NULL OR EXISTS(SELECT 1 FROM public.document WHERE tenant_id=p_tenant AND series_id=s.id) THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native credit series genesis inconsistent'; END IF;
  ELSE
    SELECT doc.sha256 INTO v_tail FROM public.document doc JOIN public.india_native_fiscal_credit_note credit
      ON credit.tenant_id=doc.tenant_id AND credit.document_id=doc.id AND credit.series_id=doc.series_id
      WHERE doc.tenant_id=p_tenant AND doc.series_id=s.id AND doc.doc_no=s.prefix||(s.next_no-1)::text
        AND doc.kind='credit_note' AND doc.status='issued';
    IF v_tail IS NULL OR v_tail IS DISTINCT FROM s.last_doc_hash THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native credit series tail inconsistent'; END IF;
  END IF;
  SELECT * INTO STRICT d FROM public.document WHERE tenant_id=p_tenant AND id=p_original;
  v_doc_no:=s.prefix||s.next_no::text;
  v_source_hash:=public.india_native_source_hash(jsonb_build_object('original',to_jsonb(o),'accountingBinding',to_jsonb(b),'lines',v_templates));
  v_content:=d.content||jsonb_build_object('DocDtls',jsonb_build_object('Typ','CRN','No',v_doc_no,'Dt',to_char(v_date,'DD/MM/YYYY')),
    'RefDtls',jsonb_build_object('PrecDocDtls',jsonb_build_array(jsonb_build_object('InvNo',d.doc_no,'InvDt',to_char(d.business_date,'DD/MM/YYYY')))),
    'YellowCredit',jsonb_build_object('originalDocumentId',p_original,'originalSha256',d.sha256,'reason',p_reason,
      'correctionJournalId',v_journal,'sourceEvidenceHash',v_source_hash));
  v_hash:=encode(public.digest(convert_to(v_content::text,'UTF8'),'sha256'),'hex');
  SELECT -sum((item->'line'->>'amount_minor')::numeric) INTO v_total FROM jsonb_array_elements(v_templates) item
    WHERE item->'line'->>'folio_id'=o.folio_id::text;
  IF v_total NOT BETWEEN 1 AND 9223372036854775807 THEN RAISE EXCEPTION USING ERRCODE='22003',MESSAGE='native credit total outside int64'; END IF;
  v_receipt:=jsonb_build_object('documentId',v_document,'documentKind','credit_note','originalDocumentId',p_original,
    'originalDocNo',d.doc_no,'originalSha256',d.sha256,'correctionJournalId',v_journal,'seriesId',s.id,'docNo',v_doc_no,
    'propertyNode',p_property,'reservationId',o.reservation_id,'folioId',o.folio_id,'supplierRegistrationId',o.supplier_registration_id,
    'recipientRegistrationId',o.recipient_registration_id,'financialYearStart',v_fy,'currency','INR','status','issued',
    'businessDate',v_date,'issuedAt',to_char(v_now AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'prevHash',s.last_doc_hash,'sha256',v_hash,'sourceEvidenceHash',v_source_hash,'totalMinor',v_total::bigint::text,'reason',p_reason)::text;
  SELECT jsonb_agg(item||jsonb_build_object('line',item->'line'||jsonb_build_object('id',gen_random_uuid(),
    'journal_id',v_journal,'business_date',v_date)) ORDER BY (item->'line'->>'seq')::integer) INTO v_lines
    FROM jsonb_array_elements(v_templates) item;
  -- Publication is acquired last. All following inserts use complete preallocated identities.
  PERFORM pg_advisory_xact_lock(6441674055002974568::bigint);
  INSERT INTO public.india_native_fiscal_credit_note(tenant_id,id,property_node,actor_id,original_document_id,original_origin_id,
    valuation_id,accounting_binding_id,document_id,correction_journal_id,series_id,business_date,created_at,issuing_transaction_id,
    reason,request_key_hash,request_hash,correlation_id,source_evidence_hash,planned_lines,planned_document,receipt_json)
  VALUES(p_tenant,v_credit,p_property,p_actor,p_original,o.id,b.valuation_id,b.id,v_document,v_journal,s.id,v_date,v_now,
    pg_current_xact_id(),p_reason,v_key_hash,v_request_hash,p_correlation,v_source_hash,v_lines,
    to_jsonb(jsonb_populate_record(NULL::public.document,jsonb_build_object('id',v_document,'tenant_id',p_tenant,
      'property_node',p_property,'kind','credit_note','series_id',s.id,'doc_no',v_doc_no,'status','issued','subject_type','folio',
      'subject_id',o.folio_id,'content',v_content,'sha256',v_hash,'prev_hash',s.last_doc_hash,'issued_at',v_now,'created_at',v_now,'business_date',v_date))),v_receipt);
  INSERT INTO public.journal(id,tenant_id,property_node,business_date,kind,description,currency,reverses,source,created_by,created_at)
    VALUES(v_journal,p_tenant,p_property,v_date,'correction',p_reason,'INR',NULL,
      jsonb_build_object('interface','financials.india-native-credit-note.post','credit_note_id',v_credit),p_actor,v_now);
  INSERT INTO public.posting_line SELECT (jsonb_populate_record(NULL::public.posting_line,item->'line')).*
    FROM jsonb_array_elements(v_lines) item ORDER BY (item->'line'->>'seq')::integer;
  INSERT INTO public.document SELECT (jsonb_populate_record(NULL::public.document,planned_document)).*
    FROM public.india_native_fiscal_credit_note WHERE tenant_id=p_tenant AND id=v_credit;
  UPDATE public.document_series SET next_no=next_no+1,last_doc_hash=v_hash WHERE tenant_id=p_tenant AND id=s.id;
  INSERT INTO public.fact_log(tenant_id,entity_type,entity_id,fact_type,valid_from,business_date,actor_id,payload)
    VALUES(p_tenant,'document',v_document,'issued',v_now,v_date,p_actor,v_receipt::jsonb);
  INSERT INTO public.outbox(tenant_id,property_node,business_date,aggregate_type,aggregate_id,event_type,actor_id,correlation_id,payload,created_at)
    VALUES(p_tenant,p_property,v_date,'document',v_document,'document.issued',p_actor,p_correlation,v_receipt::jsonb,v_now);
  INSERT INTO public.api_idempotency(tenant_id,operation,key_hash,request_hash,created_at,expires_at,response_status,response_body,completed_at)
    VALUES(p_tenant,'document.credit_note.issued',v_key_hash,v_request_hash,v_now,v_now+interval '24 hours',201,v_receipt::jsonb,v_now);
  RETURN QUERY SELECT v_receipt,false;
END $$;

CREATE FUNCTION public.read_india_native_fiscal_credit_note(p_tenant uuid,p_property uuid,p_actor uuid,p_document uuid)
RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
  PERFORM public.assert_india_native_credit_authority(p_tenant,p_property,p_actor,ARRAY['tax-fiscal.documents:read']);
  RETURN (SELECT credit.receipt_json FROM public.india_native_fiscal_credit_note credit
    WHERE credit.tenant_id=p_tenant AND credit.property_node=p_property AND credit.document_id=p_document);
END $$;

REVOKE ALL ON FUNCTION public.prevent_india_native_credit_mutation(),
  public.india_native_credit_line_templates(uuid,uuid),
  public.guard_india_native_credit_birth(),
  public.assert_india_native_credit_authority(uuid,uuid,uuid,text[],boolean),
  public.guard_india_native_credit_artifact(),public.assert_india_native_credit_complete(),
  public.commit_india_native_fiscal_credit_note(uuid,uuid,uuid,uuid,text,text,uuid),
  public.read_india_native_fiscal_credit_note(uuid,uuid,uuid,uuid) FROM PUBLIC,app_role,yellow_runtime;
GRANT EXECUTE ON FUNCTION public.commit_india_native_fiscal_credit_note(uuid,uuid,uuid,uuid,text,text,uuid),
  public.read_india_native_fiscal_credit_note(uuid,uuid,uuid,uuid) TO app_role;
RESET ROLE;
