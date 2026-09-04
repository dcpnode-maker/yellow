-- Order 430: India native fiscal invoice authority.
--
-- Deliberate split: TypeScript is the only public command writer and composes the
-- Order426/429 evidence.  PostgreSQL cannot call those TypeScript composers, so
-- this private app_role capability accepts their frozen hashes/body but independently
-- proves all persisted financial identities, derives the legal date/number/body
-- hash, and commits the document, origin, fact, outbox and chain atomically.

INSERT INTO public.permission(code,description) VALUES
  ('tax-fiscal.series:configure','Configure one governed India native fiscal document series'),
  ('tax-fiscal.documents:issue','Issue one governed India native fiscal invoice')
ON CONFLICT(code) DO UPDATE SET description=EXCLUDED.description;

ALTER TABLE public.property_fiscal_registration
  ADD CONSTRAINT property_fiscal_registration_tenant_property_id_uq
    UNIQUE (tenant_id,property_node,id);

ALTER TABLE public.document_series
  ADD COLUMN supplier_registration_id uuid,
  ADD COLUMN financial_year_start date,
  ADD CONSTRAINT document_series_tenant_id_uq UNIQUE (tenant_id,id),
  ADD CONSTRAINT document_series_tenant_property_id_uq UNIQUE (tenant_id,property_node,id),
  ADD CONSTRAINT document_series_tenant_property_fk
    FOREIGN KEY (tenant_id,property_node) REFERENCES public.org_node(tenant_id,id),
  ADD CONSTRAINT document_series_india_native_fiscal_shape_ck CHECK (
    -- Preserve historic non-native/fiscal series while making the new scoped
    -- India-native shape non-optional once either native field is present.
    (supplier_registration_id IS NULL AND financial_year_start IS NULL)
    OR (
      fiscal AND kind IN ('invoice','credit_note','debit_note')
      AND supplier_registration_id IS NOT NULL
      AND financial_year_start IS NOT NULL
      AND financial_year_start = pg_catalog.make_date(pg_catalog.date_part('year',financial_year_start)::integer,4,1)
    )
  ),
  ADD CONSTRAINT document_series_india_native_supplier_property_fk
    FOREIGN KEY (tenant_id,property_node,supplier_registration_id)
    REFERENCES public.property_fiscal_registration(tenant_id,property_node,id);

ALTER TABLE public.document
  ADD CONSTRAINT document_tenant_id_uq UNIQUE (tenant_id,id),
  ADD CONSTRAINT document_series_scope_fk
    FOREIGN KEY (tenant_id,property_node,series_id)
    REFERENCES public.document_series(tenant_id,property_node,id),
  ADD CONSTRAINT document_series_doc_no_uq UNIQUE (tenant_id,series_id,doc_no);

CREATE UNIQUE INDEX document_series_india_native_fiscal_scope_uq
  ON public.document_series(tenant_id,property_node,supplier_registration_id,kind,financial_year_start)
  WHERE fiscal
    AND kind IN ('invoice','credit_note','debit_note')
    AND supplier_registration_id IS NOT NULL
    AND financial_year_start IS NOT NULL;

-- No direct role has document mutation authority.  This trigger is a second
-- backstop: even a future owner-mediated maintenance path cannot alter/delete a
-- Yellow-native issued record; correction must create its own document.
CREATE FUNCTION public.prevent_india_native_fiscal_document_mutation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public
AS $$
BEGIN
  -- The origin relation is forced-RLS.  A document trigger can be invoked from
  -- privileged maintenance sessions with no tenant GUC, so establish the row's
  -- transaction-local tenant before asking the immutable-origin question.
  PERFORM pg_catalog.set_config('app.tenant_id',OLD.tenant_id::text,true);
  IF EXISTS (
    SELECT 1 FROM public.india_gst_native_fiscal_document_origin origin
     WHERE origin.tenant_id=OLD.tenant_id AND origin.document_id=OLD.id
  ) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='issued India native fiscal documents are immutable';
  END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TABLE public.india_gst_native_fiscal_document_origin (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT pg_catalog.gen_random_uuid(),
  document_id uuid NOT NULL,
  property_node uuid NOT NULL,
  document_kind text NOT NULL CHECK (document_kind='invoice'),
  reservation_id uuid NOT NULL,
  folio_id uuid NOT NULL,
  source_journal_id uuid NOT NULL,
  supplier_registration_id uuid NOT NULL,
  recipient_registration_id uuid NOT NULL,
  source_evidence_hash text NOT NULL CHECK (source_evidence_hash ~ '^[0-9a-f]{64}$'),
  pre_document_evidence_hash text NOT NULL CHECK (pre_document_evidence_hash ~ '^[0-9a-f]{64}$'),
  readiness_evidence_hash text NOT NULL CHECK (readiness_evidence_hash ~ '^[0-9a-f]{64}$'),
  origin_key text NOT NULL CHECK (origin_key ~ '^[0-9a-f]{64}$'),
  issue_date date NOT NULL CHECK (pg_catalog.isfinite(issue_date)),
  created_at timestamptz NOT NULL DEFAULT pg_catalog.transaction_timestamp(),
  CONSTRAINT india_gst_native_fiscal_document_origin_pk PRIMARY KEY (tenant_id,id),
  CONSTRAINT india_gst_native_fiscal_document_origin_document_uq UNIQUE (tenant_id,document_id),
  CONSTRAINT india_gst_native_fiscal_document_origin_key_uq UNIQUE (tenant_id,origin_key),
  CONSTRAINT india_gst_native_fiscal_document_origin_document_fk
    FOREIGN KEY (tenant_id,document_id) REFERENCES public.document(tenant_id,id),
  CONSTRAINT india_gst_native_fiscal_document_origin_property_fk
    FOREIGN KEY (tenant_id,property_node) REFERENCES public.org_node(tenant_id,id),
  CONSTRAINT india_gst_native_fiscal_document_origin_reservation_fk
    FOREIGN KEY (tenant_id,reservation_id) REFERENCES public.reservation(tenant_id,id),
  CONSTRAINT india_gst_native_fiscal_document_origin_folio_fk
    FOREIGN KEY (tenant_id,folio_id) REFERENCES public.folio(tenant_id,id),
  CONSTRAINT india_gst_native_fiscal_document_origin_journal_fk
    FOREIGN KEY (tenant_id,source_journal_id) REFERENCES public.journal(tenant_id,id),
  CONSTRAINT india_gst_native_fiscal_document_origin_supplier_fk
    FOREIGN KEY (tenant_id,property_node,supplier_registration_id)
    REFERENCES public.property_fiscal_registration(tenant_id,property_node,id),
  CONSTRAINT india_gst_native_fiscal_document_origin_recipient_fk
    FOREIGN KEY (tenant_id,recipient_registration_id) REFERENCES public.party_fiscal_registration(tenant_id,id),
  CONSTRAINT india_gst_native_fiscal_document_origin_distinct_party_ck
    CHECK (supplier_registration_id <> recipient_registration_id)
);
CREATE INDEX india_gst_native_fiscal_document_origin_scope
  ON public.india_gst_native_fiscal_document_origin(tenant_id,property_node,reservation_id,folio_id,created_at,id);
ALTER TABLE public.india_gst_native_fiscal_document_origin ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.india_gst_native_fiscal_document_origin FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON public.india_gst_native_fiscal_document_origin
  USING (tenant_id=NULLIF(pg_catalog.current_setting('app.tenant_id',true),'')::uuid)
  WITH CHECK (tenant_id=NULLIF(pg_catalog.current_setting('app.tenant_id',true),'')::uuid);
REVOKE ALL ON TABLE public.india_gst_native_fiscal_document_origin FROM PUBLIC,app_role,yellow_runtime;
GRANT SELECT ON TABLE public.india_gst_native_fiscal_document_origin TO app_role;
ALTER TABLE public.india_gst_native_fiscal_document_origin OWNER TO yellow_owner;

-- The origin is itself legal, immutable evidence.  Protecting only document is
-- insufficient because an owner-adjacent session could otherwise delete the
-- origin first and then evade the document trigger's native-document lookup.
CREATE FUNCTION public.prevent_india_native_fiscal_origin_mutation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public
AS $$
BEGIN
  RAISE EXCEPTION USING ERRCODE='55000',
    MESSAGE='issued India native fiscal document origins are immutable';
END;
$$;
ALTER FUNCTION public.prevent_india_native_fiscal_origin_mutation() OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.prevent_india_native_fiscal_origin_mutation() FROM PUBLIC,app_role,yellow_runtime;

CREATE TRIGGER india_gst_native_fiscal_document_origin_immutable
  BEFORE UPDATE OR DELETE ON public.india_gst_native_fiscal_document_origin
  FOR EACH ROW EXECUTE FUNCTION public.prevent_india_native_fiscal_origin_mutation();

-- Order408 and native issuance share the original-journal advisory lock.  Once a
-- legal invoice has won that arbitration, its financial source may only be
-- corrected by the separately numbered credit/debit path approved in D1302; a
-- later ordinary journal reversal must not invalidate the issued origin.
CREATE FUNCTION public.prevent_issued_india_native_fiscal_source_reversal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public
AS $$
BEGIN
  IF EXISTS(
    SELECT 1
      FROM public.india_gst_native_fiscal_document_origin origin
     WHERE origin.tenant_id=NEW.tenant_id
       AND origin.source_journal_id=NEW.original_journal_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE='55000',
      MESSAGE='issued India native fiscal source requires a numbered correction document';
  END IF;
  RETURN NEW;
END;
$$;
ALTER FUNCTION public.prevent_issued_india_native_fiscal_source_reversal() OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.prevent_issued_india_native_fiscal_source_reversal() FROM PUBLIC,app_role,yellow_runtime;

CREATE TRIGGER india_native_fiscal_source_reversal_guard
  BEFORE INSERT ON public.india_gst_final_component_tax_journal_reversal_binding
  FOR EACH ROW EXECUTE FUNCTION public.prevent_issued_india_native_fiscal_source_reversal();

CREATE FUNCTION public.create_india_native_fiscal_series(
  p_tenant_id uuid,p_property_node uuid,p_supplier_registration_id uuid,
  p_document_kind text,p_prefix text,p_actor_id uuid
) RETURNS TABLE(
  series_id uuid,tenant_id uuid,property_node uuid,supplier_registration_id uuid,
  document_kind text,prefix text,financial_year_start date,next_no bigint,created boolean
)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,public
AS $$
DECLARE
  v_context_tenant uuid; v_issue_date date; v_financial_year date;
  v_existing public.document_series%ROWTYPE;
BEGIN
  IF session_user<>'yellow_runtime' OR pg_catalog.current_setting('role',true) IS DISTINCT FROM 'app_role' OR current_user<>'yellow_owner' THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='India native fiscal series requires the governed runtime app role';
  END IF;
  BEGIN v_context_tenant:=NULLIF(pg_catalog.current_setting('app.tenant_id',true),'')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='India native fiscal series tenant context is invalid'; END;
  IF p_tenant_id IS NULL OR p_property_node IS NULL OR p_supplier_registration_id IS NULL OR p_actor_id IS NULL
     OR v_context_tenant IS NULL OR v_context_tenant<>p_tenant_id
     OR p_document_kind NOT IN ('invoice','credit_note','debit_note')
     OR p_prefix IS NULL OR p_prefix<>pg_catalog.btrim(p_prefix) OR pg_catalog.char_length(p_prefix) NOT BETWEEN 1 AND 12
     OR p_prefix !~ '^[A-Za-z0-9/-]+$' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='India native fiscal series input is invalid';
  END IF;
  SELECT (pg_catalog.transaction_timestamp() AT TIME ZONE property.timezone)::date
    INTO v_issue_date FROM public.org_node property
   WHERE property.tenant_id=p_tenant_id AND property.id=p_property_node AND property.kind='property' AND property.currency='INR';
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='India native fiscal property is unavailable'; END IF;
  v_financial_year:=pg_catalog.make_date(pg_catalog.date_part('year',v_issue_date)::integer-CASE WHEN pg_catalog.date_part('month',v_issue_date)<4 THEN 1 ELSE 0 END,4,1);
  IF pg_catalog.char_length(p_prefix||'1')>16 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='India native fiscal prefix exceeds Rule-46 document reference limit'; END IF;
  PERFORM 1 FROM public.app_user actor JOIN public.user_role ur ON ur.tenant_id=actor.tenant_id AND ur.user_id=actor.id
    JOIN public.role_permission rp ON rp.role_id=ur.role_id AND rp.permission_code='tax-fiscal.series:configure'
    JOIN public.org_node grant_node ON grant_node.tenant_id=ur.tenant_id AND grant_node.id=ur.scope_node
    JOIN public.org_node property ON property.tenant_id=actor.tenant_id AND property.id=p_property_node AND grant_node.path @> property.path
   WHERE actor.tenant_id=p_tenant_id AND actor.id=p_actor_id AND actor.status='active';
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='actor lacks property fiscal-series authority'; END IF;
  -- Configuration must not bind a legal series to a merely shaped registration.
  -- Order289 is a separate dated status root, so re-resolve its active portal
  -- snapshot for the property-local legal issue date before creating or replaying
  -- a fiscal series.
  PERFORM 1 FROM public.property_fiscal_registration registration
    JOIN public.india_gst_supplier_registration_status_snapshot registration_status
      ON registration_status.tenant_id=registration.tenant_id
     AND registration_status.supplier_registration_id=registration.id
     AND registration_status.status_as_of=v_issue_date
     AND registration_status.gst_registration_status='active'
   WHERE registration.tenant_id=p_tenant_id AND registration.id=p_supplier_registration_id
     AND registration.property_node=p_property_node AND registration.scheme='in-gstin' AND registration.currency='INR'
   FOR KEY SHARE OF registration,registration_status;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='India native fiscal supplier registration is unavailable'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'india-native-fiscal-series:'||p_tenant_id::text||':'||p_property_node::text||':'||p_supplier_registration_id::text||':'||p_document_kind||':'||v_financial_year::text,430));
  SELECT * INTO v_existing FROM public.document_series series
   WHERE series.tenant_id=p_tenant_id AND series.property_node=p_property_node
     AND series.supplier_registration_id=p_supplier_registration_id AND series.kind=p_document_kind
     AND series.financial_year_start=v_financial_year AND series.fiscal
   FOR UPDATE;
  IF FOUND THEN
    IF v_existing.prefix<>p_prefix THEN RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='India native fiscal series already has a different locked prefix'; END IF;
    RETURN QUERY SELECT v_existing.id,v_existing.tenant_id,v_existing.property_node,v_existing.supplier_registration_id,
      v_existing.kind,v_existing.prefix,v_existing.financial_year_start,v_existing.next_no,false;
    RETURN;
  END IF;
  INSERT INTO public.document_series(tenant_id,property_node,kind,prefix,next_no,fiscal,supplier_registration_id,financial_year_start)
  VALUES(p_tenant_id,p_property_node,p_document_kind,p_prefix,1,true,p_supplier_registration_id,v_financial_year)
  RETURNING * INTO v_existing;
  RETURN QUERY SELECT v_existing.id,v_existing.tenant_id,v_existing.property_node,v_existing.supplier_registration_id,
    v_existing.kind,v_existing.prefix,v_existing.financial_year_start,v_existing.next_no,true;
END;
$$;
ALTER FUNCTION public.create_india_native_fiscal_series(uuid,uuid,uuid,text,text,uuid) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.create_india_native_fiscal_series(uuid,uuid,uuid,text,text,uuid) FROM PUBLIC,app_role,yellow_runtime;
GRANT EXECUTE ON FUNCTION public.create_india_native_fiscal_series(uuid,uuid,uuid,text,text,uuid) TO app_role;

CREATE FUNCTION public.commit_india_native_fiscal_invoice(
  p_tenant_id uuid,p_property_node uuid,p_actor_id uuid,p_reservation_id uuid,p_folio_id uuid,p_journal_id uuid,
  p_idempotency_key text,p_frozen_evidence jsonb,p_correlation_id uuid
) RETURNS TABLE(
  document_id uuid,document_kind text,series_id uuid,doc_no text,property_node uuid,reservation_id uuid,folio_id uuid,
  supplier_registration_id uuid,recipient_registration_id uuid,financial_year_start date,currency character(3),status text,
  business_date date,issued_at timestamptz,prev_hash text,sha256 text,source_evidence_hash text,
  pre_document_evidence_hash text,readiness_evidence_hash text,created boolean
)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,public
AS $$
DECLARE
  v_context_tenant uuid; v_source_hash text; v_pre_hash text; v_readiness_hash text; v_sections jsonb;
  v_recipient_registration_id uuid; v_tax record; v_series public.document_series%ROWTYPE;
  v_date date; v_fy date; v_doc_no text; v_document_id uuid:=pg_catalog.gen_random_uuid();
  v_origin_key text; v_prev_hash text; v_content jsonb; v_hash text; v_issued_at timestamptz:=pg_catalog.transaction_timestamp();
  v_ass_value bigint; v_total_value bigint; v_igst bigint; v_cgst bigint; v_sgst bigint; v_component_total bigint;
  v_key_hash text; v_request_hash text; v_idempotency public.api_idempotency%ROWTYPE; v_claimed boolean;
BEGIN
  IF session_user<>'yellow_runtime' OR pg_catalog.current_setting('role',true) IS DISTINCT FROM 'app_role' OR current_user<>'yellow_owner' THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='India native fiscal issue requires the governed runtime app role';
  END IF;
  BEGIN v_context_tenant:=NULLIF(pg_catalog.current_setting('app.tenant_id',true),'')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='India native fiscal issue tenant context is invalid'; END;
  IF p_tenant_id IS NULL OR p_property_node IS NULL OR p_actor_id IS NULL OR p_reservation_id IS NULL OR p_folio_id IS NULL OR p_journal_id IS NULL OR p_correlation_id IS NULL
     OR p_idempotency_key IS NULL OR p_idempotency_key !~ '^[!-~]{8,200}$'
     OR v_context_tenant IS NULL OR v_context_tenant<>p_tenant_id OR p_frozen_evidence IS NULL OR pg_catalog.jsonb_typeof(p_frozen_evidence)<>'object'
     OR (SELECT pg_catalog.array_agg(k ORDER BY k) FROM pg_catalog.jsonb_object_keys(p_frozen_evidence) k) IS DISTINCT FROM ARRAY['blockers','permittedActions','preDocumentEvidenceHash','preDocumentJson','readinessEvidenceHash','readinessState','recipientRegistrationId','sourceEvidenceHash','submissionReady']::text[] THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='India native fiscal issue input is invalid';
  END IF;
  IF p_frozen_evidence->>'readinessState'<>'blocked_pending_fiscal_document_origin_policy'
     OR p_frozen_evidence->'submissionReady'<>'false'::jsonb
     OR p_frozen_evidence->'permittedActions'<>'[]'::jsonb
     OR p_frozen_evidence->'blockers'<>'["FISCAL_DOCUMENT_ORIGIN_UNSELECTED","LEGAL_DOCUMENT_NUMBER_FORMAT_UNCONFIGURED","DOCUMENT_SERIES_UNBOUND"]'::jsonb
     OR (p_frozen_evidence->>'recipientRegistrationId') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Order429 frozen blocked-readiness evidence is not exact';
  END IF;
  v_key_hash:=pg_catalog.encode(public.digest(p_idempotency_key,'sha256'),'hex');
  v_request_hash:=pg_catalog.encode(public.digest(pg_catalog.jsonb_build_object(
    'actorId',p_actor_id::text,'propertyNode',p_property_node::text,'reservationId',p_reservation_id::text,
    'folioId',p_folio_id::text,'journalId',p_journal_id::text,'evidence',p_frozen_evidence
  )::text,'sha256'),'hex');
  v_source_hash:=p_frozen_evidence->>'sourceEvidenceHash'; v_pre_hash:=p_frozen_evidence->>'preDocumentEvidenceHash'; v_readiness_hash:=p_frozen_evidence->>'readinessEvidenceHash';
  IF v_source_hash !~ '^[0-9a-f]{64}$' OR v_pre_hash !~ '^[0-9a-f]{64}$' OR v_readiness_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='India native fiscal evidence hashes are invalid';
  END IF;
  BEGIN v_sections:=(p_frozen_evidence->>'preDocumentJson')::jsonb;
  EXCEPTION WHEN others THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='India native fiscal pre-document JSON is invalid'; END;
  IF pg_catalog.jsonb_typeof(v_sections)<>'object'
     -- Exact approved Order426 section body: SellerDtls is mandatory and the
     -- capability rejects both omission and caller-added sections.
     OR (SELECT pg_catalog.array_agg(k ORDER BY k) FROM pg_catalog.jsonb_object_keys(v_sections) k) IS DISTINCT FROM ARRAY['BuyerDtls','ItemList','SellerDtls','TranDtls','ValDtls','Version']::text[]
     OR v_sections->>'Version'<>'1.1' OR v_sections->'TranDtls'->>'TaxSch'<>'GST' OR v_sections->'TranDtls'->>'SupTyp'<>'B2B'
     OR pg_catalog.jsonb_typeof(v_sections->'SellerDtls')<>'object'
     OR pg_catalog.jsonb_typeof(v_sections->'ItemList')<>'array' OR pg_catalog.jsonb_array_length(v_sections->'ItemList')<1
     OR EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(v_sections->'ItemList') item WHERE item->>'Qty'<>'1.000' OR item->>'Unit'<>'OTH') THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='India native fiscal pre-document shape is invalid';
  END IF;
  -- The first lock is intentionally byte-for-byte the Order408 shared
  -- correction/issue arbitration key for this original journal.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    p_tenant_id::text||':india-final-component-tax-correction:'||p_journal_id::text,408));
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'india-native-fiscal-invoice:'||p_tenant_id::text||':'||p_reservation_id::text||':'||p_folio_id::text,430));
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'india-native-fiscal-idempotency:'||p_tenant_id::text||':'||v_key_hash,430));
  INSERT INTO public.api_idempotency(tenant_id,operation,key_hash,request_hash,created_at,expires_at)
  VALUES(p_tenant_id,'document.issued',v_key_hash,v_request_hash,v_issued_at,v_issued_at+interval '24 hours')
  ON CONFLICT (tenant_id,operation,key_hash) DO NOTHING
  RETURNING true INTO v_claimed;
  IF NOT COALESCE(v_claimed,false) THEN
    SELECT * INTO v_idempotency FROM public.api_idempotency
     WHERE tenant_id=p_tenant_id AND operation='document.issued' AND key_hash=v_key_hash FOR UPDATE;
    IF NOT FOUND OR v_idempotency.request_hash<>v_request_hash THEN
      RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='India native fiscal idempotency key was reused with a different request';
    END IF;
    IF v_idempotency.completed_at IS NULL OR v_idempotency.response_body IS NULL THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='India native fiscal idempotency record is incomplete';
    END IF;
    SELECT document.id,document.kind,series.id,document.doc_no,document.property_node,origin.reservation_id,origin.folio_id,
      origin.supplier_registration_id,origin.recipient_registration_id,series.financial_year_start,'INR'::character(3),document.status,
      document.business_date,document.issued_at,document.prev_hash,document.sha256,origin.source_evidence_hash,
      origin.pre_document_evidence_hash,origin.readiness_evidence_hash,false
      INTO document_id,document_kind,series_id,doc_no,property_node,reservation_id,folio_id,supplier_registration_id,
      recipient_registration_id,financial_year_start,currency,status,business_date,issued_at,prev_hash,sha256,source_evidence_hash,
      pre_document_evidence_hash,readiness_evidence_hash,created
      FROM public.india_gst_native_fiscal_document_origin origin
      JOIN public.document document ON document.tenant_id=origin.tenant_id AND document.id=origin.document_id
      JOIN public.document_series series ON series.tenant_id=document.tenant_id AND series.id=document.series_id
     WHERE origin.tenant_id=p_tenant_id AND origin.document_id=(v_idempotency.response_body->>'documentId')::uuid;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='India native fiscal idempotency receipt is incoherent'; END IF;
    RETURN NEXT;
    RETURN;
  END IF;
  SELECT (pg_catalog.transaction_timestamp() AT TIME ZONE property.timezone)::date INTO v_date
    FROM public.org_node property WHERE property.tenant_id=p_tenant_id AND property.id=p_property_node AND property.kind='property' AND property.currency='INR';
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='India native fiscal property is unavailable'; END IF;
  v_fy:=pg_catalog.make_date(pg_catalog.date_part('year',v_date)::integer-CASE WHEN pg_catalog.date_part('month',v_date)<4 THEN 1 ELSE 0 END,4,1);
  PERFORM 1 FROM public.app_user actor JOIN public.user_role ur ON ur.tenant_id=actor.tenant_id AND ur.user_id=actor.id
    JOIN public.role_permission rp ON rp.role_id=ur.role_id AND rp.permission_code='tax-fiscal.documents:issue'
    JOIN public.org_node grant_node ON grant_node.tenant_id=ur.tenant_id AND grant_node.id=ur.scope_node
    JOIN public.org_node property ON property.tenant_id=actor.tenant_id AND property.id=p_property_node AND grant_node.path @> property.path
   WHERE actor.tenant_id=p_tenant_id AND actor.id=p_actor_id AND actor.status='active';
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='actor lacks property fiscal-issue authority'; END IF;
  SELECT binding.id AS binding_id,tax.id AS tax_id,tax.transaction_value_minor,tax.tax_minor,tax.grand_total_minor,tax.component_family,
         binding.business_date,binding.reservation_id,binding.folio_id,binding.journal_id,
         supplier.supplier_registration_id,recipient.id AS recipient_registration_id,
         (SELECT COALESCE(pg_catalog.sum(component.tax_amount_minor),0)::bigint
            FROM public.india_gst_accommodation_final_component_tax_component component
           WHERE component.tenant_id=tax.tenant_id AND component.tax_id=tax.id AND component.currency='INR') AS component_total,
         (SELECT COALESCE(pg_catalog.sum(component.tax_amount_minor) FILTER (WHERE component.component_identity='igst'),0)::bigint
            FROM public.india_gst_accommodation_final_component_tax_component component
           WHERE component.tenant_id=tax.tenant_id AND component.tax_id=tax.id AND component.currency='INR') AS igst_total,
         (SELECT COALESCE(pg_catalog.sum(component.tax_amount_minor) FILTER (WHERE component.component_identity='cgst'),0)::bigint
            FROM public.india_gst_accommodation_final_component_tax_component component
           WHERE component.tenant_id=tax.tenant_id AND component.tax_id=tax.id AND component.currency='INR') AS cgst_total,
         (SELECT COALESCE(pg_catalog.sum(component.tax_amount_minor) FILTER (WHERE component.component_identity IN ('sgst','utgst')),0)::bigint
            FROM public.india_gst_accommodation_final_component_tax_component component
           WHERE component.tenant_id=tax.tenant_id AND component.tax_id=tax.id AND component.currency='INR') AS state_total
    INTO v_tax
    FROM public.india_gst_accommodation_final_component_tax_journal_binding binding
    JOIN public.india_gst_accommodation_final_component_tax tax ON tax.tenant_id=binding.tenant_id AND tax.id=binding.tax_id
    JOIN public.india_gst_accommodation_final_valuation valuation ON valuation.tenant_id=binding.tenant_id AND valuation.id=binding.valuation_id
    JOIN public.india_gst_accommodation_quoted_rate_applicability applicability ON applicability.tenant_id=tax.tenant_id AND applicability.id=tax.applicability_id
    JOIN public.india_gst_supplier_service_location supplier ON supplier.tenant_id=applicability.tenant_id AND supplier.id=applicability.supplier_service_location_id
    -- Registration activity is an independently changeable Order289 root, not
    -- a property-registration attribute.  Re-resolve its exact dated evidence
    -- under the same source lock before a legal number can be allocated.
    JOIN public.india_gst_supplier_registration_status_snapshot supplier_registration_status
      ON supplier_registration_status.tenant_id=supplier.tenant_id
     AND supplier_registration_status.supplier_registration_id=supplier.supplier_registration_id
     AND supplier_registration_status.supplier_registration_evidence_hash=supplier.supplier_evidence_hash
     AND supplier_registration_status.status_as_of=applicability.time_of_supply_date
     AND supplier_registration_status.gst_registration_status='active'
    JOIN public.india_gst_supplier_sez_status supplier_status ON supplier_status.tenant_id=applicability.tenant_id AND supplier_status.id=applicability.supplier_sez_status_id AND supplier_status.supplier_registration_id=supplier.supplier_registration_id AND supplier_status.gst_registration_status='active' AND supplier_status.status_as_of=applicability.time_of_supply_date
    JOIN public.india_gst_recipient_sez_status recipient_status ON recipient_status.tenant_id=applicability.tenant_id AND recipient_status.id=applicability.recipient_sez_status_id AND recipient_status.gst_registration_status='active' AND recipient_status.status_as_of=applicability.time_of_supply_date
    JOIN public.party_fiscal_registration recipient ON recipient.tenant_id=valuation.tenant_id AND recipient.id=recipient_status.recipient_registration_id AND recipient.party_id=valuation.buyer_party_id AND recipient.scheme='in-gstin'
    JOIN public.journal journal ON journal.tenant_id=binding.tenant_id AND journal.id=binding.journal_id AND journal.reverses IS NULL AND journal.currency='INR'
   WHERE binding.tenant_id=p_tenant_id AND binding.property_node=p_property_node AND binding.reservation_id=p_reservation_id AND binding.folio_id=p_folio_id AND binding.journal_id=p_journal_id
     AND binding.currency='INR' AND tax.currency='INR' AND valuation.currency='INR' AND valuation.disposition='ordinary_final'
     AND applicability.property_node=p_property_node AND applicability.reservation_id=p_reservation_id AND applicability.folio_id=p_folio_id
     AND NOT EXISTS(SELECT 1 FROM public.india_gst_final_component_tax_journal_reversal_binding reversal WHERE reversal.tenant_id=binding.tenant_id AND reversal.original_journal_id=binding.journal_id)
     AND NOT EXISTS(SELECT 1 FROM public.india_gst_accommodation_final_component_tax successor WHERE successor.tenant_id=tax.tenant_id AND successor.supersedes_tax_id=tax.id)
     AND NOT EXISTS(SELECT 1 FROM public.india_gst_accommodation_final_valuation successor WHERE successor.tenant_id=valuation.tenant_id AND successor.supersedes_valuation_id=valuation.id)
   FOR KEY SHARE OF binding,tax,valuation,applicability,supplier,supplier_registration_status,supplier_status,recipient_status,recipient,journal;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='current unreversed India fiscal source is unavailable'; END IF;
  v_recipient_registration_id:=v_tax.recipient_registration_id;
  IF v_recipient_registration_id::text<>p_frozen_evidence->>'recipientRegistrationId' THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='India native fiscal recipient registration is stale or forged';
  END IF;
  IF (v_sections->'ValDtls'->>'AssVal') !~ '^[0-9]+\.[0-9]{2}$'
     OR (v_sections->'ValDtls'->>'TotInvVal') !~ '^[0-9]+\.[0-9]{2}$' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='India native fiscal INR value evidence is invalid';
  END IF;
  v_ass_value:=((v_sections->'ValDtls'->>'AssVal')::numeric*100)::bigint;
  v_total_value:=((v_sections->'ValDtls'->>'TotInvVal')::numeric*100)::bigint;
  v_component_total:=v_tax.component_total;
  IF v_ass_value<>v_tax.transaction_value_minor OR v_total_value<>v_tax.grand_total_minor OR v_component_total<>v_tax.tax_minor THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='India native fiscal INR totals do not match persisted component evidence';
  END IF;
  IF v_tax.component_family='igst' THEN
    IF (v_sections->'ValDtls'->>'IgstVal') !~ '^[0-9]+\.[0-9]{2}$'
       OR ((v_sections->'ValDtls'->>'IgstVal')::numeric*100)::bigint<>v_tax.igst_total
       OR v_sections->'ValDtls' ? 'CgstVal' OR v_sections->'ValDtls' ? 'SgstVal' THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='India native fiscal IGST evidence is invalid';
    END IF;
  ELSE
    IF (v_sections->'ValDtls'->>'CgstVal') !~ '^[0-9]+\.[0-9]{2}$'
       OR (v_sections->'ValDtls'->>'SgstVal') !~ '^[0-9]+\.[0-9]{2}$'
       OR ((v_sections->'ValDtls'->>'CgstVal')::numeric*100)::bigint<>v_tax.cgst_total
       OR ((v_sections->'ValDtls'->>'SgstVal')::numeric*100)::bigint<>v_tax.state_total
       OR v_sections->'ValDtls' ? 'IgstVal' THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='India native fiscal CGST/State GST evidence is invalid';
    END IF;
  END IF;
  PERFORM public.lock_financial_business_days(p_tenant_id,p_property_node,ARRAY[v_tax.business_date]);
  v_origin_key:=pg_catalog.encode(public.digest(p_tenant_id::text||':'||p_property_node::text||':'||p_reservation_id::text||':'||p_folio_id::text||':'||v_readiness_hash,'sha256'),'hex');
  PERFORM 1 FROM public.india_gst_native_fiscal_document_origin origin WHERE origin.tenant_id=p_tenant_id AND origin.origin_key=v_origin_key FOR KEY SHARE;
  IF FOUND THEN RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='India native fiscal source already has an issued document'; END IF;
  SELECT series.* INTO v_series FROM public.document_series series
   WHERE series.tenant_id=p_tenant_id AND series.property_node=p_property_node AND series.supplier_registration_id=v_tax.supplier_registration_id
     AND series.kind='invoice' AND series.financial_year_start=v_fy AND series.fiscal
   FOR UPDATE;
  IF NOT FOUND OR v_series.next_no NOT BETWEEN 1 AND 9223372036854775806 OR v_series.prefix !~ '^[A-Za-z0-9/-]+$' THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='exact locked India native fiscal invoice series is unavailable'; END IF;
  v_doc_no:=v_series.prefix||v_series.next_no::text;
  IF pg_catalog.char_length(v_doc_no)>16 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='India native fiscal document reference exceeds Rule-46 limit'; END IF;
  -- Preserve the composer output; DocDtls is derived only here. jsonb text is canonical key order.
  v_content:=v_sections||pg_catalog.jsonb_build_object('DocDtls',pg_catalog.jsonb_build_object('Typ','INV','No',v_doc_no,'Dt',pg_catalog.to_char(v_date,'DD/MM/YYYY')));
  v_prev_hash:=v_series.last_doc_hash;
  v_hash:=pg_catalog.encode(public.digest(pg_catalog.convert_to(v_content::text,'UTF8'),'sha256'),'hex');
  INSERT INTO public.document(tenant_id,property_node,kind,series_id,doc_no,status,subject_type,subject_id,content,sha256,prev_hash,issued_at,business_date)
  VALUES(p_tenant_id,p_property_node,'invoice',v_series.id,v_doc_no,'issued','folio',p_folio_id,v_content,v_hash,v_prev_hash,v_issued_at,v_date);
  UPDATE public.document_series SET next_no=next_no+1,last_doc_hash=v_hash
   WHERE tenant_id=p_tenant_id AND id=v_series.id AND next_no=v_series.next_no;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='India native fiscal series changed during allocation'; END IF;
  SELECT issued_document.id INTO v_document_id
    FROM public.document AS issued_document
   WHERE issued_document.tenant_id=p_tenant_id
     AND issued_document.series_id=v_series.id
     AND issued_document.doc_no=v_doc_no
   FOR KEY SHARE;
  INSERT INTO public.india_gst_native_fiscal_document_origin(tenant_id,document_id,property_node,document_kind,reservation_id,folio_id,source_journal_id,supplier_registration_id,recipient_registration_id,source_evidence_hash,pre_document_evidence_hash,readiness_evidence_hash,origin_key,issue_date)
  VALUES(p_tenant_id,v_document_id,p_property_node,'invoice',p_reservation_id,p_folio_id,p_journal_id,v_tax.supplier_registration_id,v_recipient_registration_id,v_source_hash,v_pre_hash,v_readiness_hash,v_origin_key,v_date);
  INSERT INTO public.fact_log(tenant_id,entity_type,entity_id,fact_type,valid_from,business_date,actor_id,payload)
  VALUES(p_tenant_id,'document',v_document_id,'issued',v_issued_at,v_date,p_actor_id,pg_catalog.jsonb_build_object('kind','invoice','doc_no',v_doc_no,'hash',v_hash));
  INSERT INTO public.outbox(tenant_id,property_node,business_date,aggregate_type,aggregate_id,event_type,actor_id,correlation_id,payload)
  VALUES(p_tenant_id,p_property_node,v_date,'document',v_document_id,'document.issued',p_actor_id,p_correlation_id,pg_catalog.jsonb_build_object('kind','invoice','doc_no',v_doc_no,'hash',v_hash));
  UPDATE public.api_idempotency
     SET response_status=201,
         response_body=pg_catalog.jsonb_build_object('documentId',v_document_id::text,'docNo',v_doc_no,'sha256',v_hash),
         completed_at=v_issued_at
   WHERE tenant_id=p_tenant_id AND operation='document.issued' AND key_hash=v_key_hash
     AND request_hash=v_request_hash AND completed_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='India native fiscal idempotency receipt could not be completed'; END IF;
  RETURN QUERY SELECT v_document_id,'invoice'::text,v_series.id,v_doc_no,p_property_node,p_reservation_id,p_folio_id,
    v_tax.supplier_registration_id,v_recipient_registration_id,v_fy,'INR'::character(3),'issued'::text,v_date,v_issued_at,v_prev_hash,v_hash,v_source_hash,v_pre_hash,v_readiness_hash,true;
END;
$$;
ALTER FUNCTION public.commit_india_native_fiscal_invoice(uuid,uuid,uuid,uuid,uuid,uuid,text,jsonb,uuid) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.commit_india_native_fiscal_invoice(uuid,uuid,uuid,uuid,uuid,uuid,text,jsonb,uuid) FROM PUBLIC,app_role,yellow_runtime;
GRANT EXECUTE ON FUNCTION public.commit_india_native_fiscal_invoice(uuid,uuid,uuid,uuid,uuid,uuid,text,jsonb,uuid) TO app_role;

CREATE TRIGGER document_india_native_fiscal_immutable
  BEFORE UPDATE OR DELETE ON public.document
  FOR EACH ROW EXECUTE FUNCTION public.prevent_india_native_fiscal_document_mutation();
ALTER FUNCTION public.prevent_india_native_fiscal_document_mutation() OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.prevent_india_native_fiscal_document_mutation() FROM PUBLIC,app_role,yellow_runtime;
