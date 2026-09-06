-- Order 440 / Question 199: DRAFT ONLY.
-- Durable, provider-neutral delivery state for an already-issued India native-v2
-- invoice.  This file is deliberately outside the migration runner until the
-- complete disposable-database proof is independently accepted.
--
-- Trust boundaries:
-- * callers never supply document bytes, fiscal identity, money, tax, or hashes;
-- * request/retry are governed app_role commands with a fresh property grant;
-- * claim/reconcile are direct yellow_runtime infrastructure capabilities and
--   reject every active SET ROLE;
-- * only an authenticated adapter may construct a normalized reconciliation
--   event.  JSON shape validation here is binding validation, not authentication;
-- * history is the append-only delivery receipt.  fact_log/outbox are atomic
--   evidence and notification, but neither is the durable receipt.

DO $order440_preconditions$
BEGIN
  IF pg_catalog.to_regrole('yellow_owner') IS NULL
     OR pg_catalog.to_regrole('yellow_runtime') IS NULL
     OR pg_catalog.to_regrole('app_role') IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='55000',
      MESSAGE='Order440 requires yellow_owner, yellow_runtime, and app_role';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.schema_migration
     WHERE version=77 AND filename='0077_india_native_fiscal_source_completion.sql'
  ) OR (SELECT pg_catalog.count(*) FROM public.schema_migration)<>77 THEN
    RAISE EXCEPTION USING ERRCODE='55000',
      MESSAGE='Order440 draft requires the exact through-0077 migration frontier';
  END IF;
  IF pg_catalog.to_regclass('public.fiscal_submission_history') IS NOT NULL
     OR EXISTS (
       SELECT 1 FROM pg_catalog.pg_attribute
        WHERE attrelid='public.fiscal_submission'::pg_catalog.regclass
          AND attname='delivery_version' AND NOT attisdropped
     ) THEN
    RAISE EXCEPTION USING ERRCODE='55000',
      MESSAGE='Order440 durable fiscal draft is already present';
  END IF;
END
$order440_preconditions$;

SET ROLE yellow_owner;

INSERT INTO public.permission(code,description) VALUES
  ('tax-fiscal.submissions:request','Request durable registration of one issued fiscal document'),
  ('tax-fiscal.submissions:retry','Explicitly retry one fiscal delivery proven not sent')
ON CONFLICT(code) DO UPDATE SET description=EXCLUDED.description;

-- No permission is assigned here.  Property roles are a separately reviewed
-- operator decision; fixtures may assign the exact permission they exercise.

ALTER TABLE public.extension
  ADD CONSTRAINT extension_id_version_uq UNIQUE (id,version);

ALTER TABLE public.fiscal_submission
  ADD COLUMN delivery_version smallint,
  ADD COLUMN property_node uuid,
  ADD COLUMN business_date date,
  ADD COLUMN document_sha256 text,
  ADD COLUMN wire_sha256 text,
  ADD COLUMN wire_text text,
  ADD COLUMN provider_extension_id uuid,
  ADD COLUMN provider_extension_version integer,
  ADD COLUMN attempt_id uuid,
  ADD COLUMN attempt_number integer,
  ADD COLUMN retry_count integer,
  ADD COLUMN transition_seq bigint,
  ADD COLUMN claim_token_hash text,
  ADD COLUMN claim_expires_at timestamptz,
  ADD COLUMN claim_action text,
  ADD COLUMN disposition text,
  ADD COLUMN reconciliation_reason text,
  ADD COLUMN resolution_source text,
  ADD COLUMN response_sha256 text,
  ADD COLUMN requested_by uuid,
  ADD COLUMN request_id uuid,
  ADD CONSTRAINT fiscal_submission_tenant_id_uq UNIQUE (tenant_id,id),
  ADD CONSTRAINT fiscal_submission_document_scope_fk
    FOREIGN KEY (tenant_id,document_id) REFERENCES public.document(tenant_id,id),
  ADD CONSTRAINT fiscal_submission_property_scope_fk
    FOREIGN KEY (tenant_id,property_node) REFERENCES public.org_node(tenant_id,id),
  ADD CONSTRAINT fiscal_submission_provider_version_fk
    FOREIGN KEY (provider_extension_id,provider_extension_version)
    REFERENCES public.extension(id,version),
  ADD CONSTRAINT fiscal_submission_request_actor_fk
    FOREIGN KEY (tenant_id,requested_by) REFERENCES public.app_user(tenant_id,id),
  ADD CONSTRAINT fiscal_submission_delivery_all_or_none_ck CHECK ((
    (delivery_version IS NULL
      AND pg_catalog.num_nonnulls(property_node,business_date,document_sha256,wire_sha256,
        wire_text,provider_extension_id,provider_extension_version,attempt_id,attempt_number,
        retry_count,transition_seq,disposition,requested_by,request_id)=0
      AND pg_catalog.num_nonnulls(claim_token_hash,claim_expires_at,claim_action,
        reconciliation_reason,resolution_source,response_sha256)=0)
    OR
    (delivery_version=1
      AND pg_catalog.num_nonnulls(property_node,business_date,document_sha256,wire_sha256,
        wire_text,provider_extension_id,provider_extension_version,attempt_id,attempt_number,
        retry_count,transition_seq,disposition,requested_by,request_id)=14
      AND pg_catalog.isfinite(business_date)
      AND document_sha256~'^[0-9a-f]{64}$'
      AND wire_sha256~'^[0-9a-f]{64}$'
      AND pg_catalog.octet_length(wire_text) BETWEEN 1 AND 1048576
      AND provider_key~'^[a-z0-9](?:[a-z0-9._:-]{0,126}[a-z0-9])?$'
      AND provider_extension_version>0
      AND attempt_number=retry_count+1
      AND retry_count BETWEEN 0 AND 3
      AND transition_seq>0
      AND mode='reporting'
      AND disposition IN ('send','lookup','retry','none')
      AND ((
        (status='pending' AND disposition='send'
          AND pg_catalog.num_nonnulls(claim_token_hash,claim_expires_at,claim_action,
            reconciliation_reason,resolution_source,response_sha256)=0
          AND response IS NULL AND authority_ref IS NULL AND submitted_at IS NULL AND resolved_at IS NULL)
        OR
        (status='submitted' AND disposition='lookup'
          AND reconciliation_reason IN ('transport_started','timeout','duplicate','provider_pending')
          AND pg_catalog.num_nonnulls(claim_token_hash,claim_expires_at,claim_action)=3
          AND claim_token_hash~'^[0-9a-f]{64}$' AND claim_action IN ('submit','lookup')
          AND resolution_source IS NULL AND response_sha256 IS NULL AND authority_ref IS NULL
          AND submitted_at IS NOT NULL AND resolved_at IS NULL)
        OR
        (status='error' AND disposition='retry' AND reconciliation_reason='known_not_sent'
          AND resolution_source IN ('transport_result','lookup_result')
          AND pg_catalog.num_nonnulls(claim_token_hash,claim_expires_at,claim_action)=3
          AND claim_token_hash~'^[0-9a-f]{64}$' AND claim_action IN ('submit','lookup')
          AND response IS NOT NULL AND response_sha256 IS NULL AND authority_ref IS NULL
          AND submitted_at IS NOT NULL AND resolved_at IS NOT NULL)
        OR
        (status IN ('accepted','rejected') AND disposition='none'
          AND reconciliation_reason IS NULL
          AND resolution_source IN ('transport_result','lookup_result')
          AND pg_catalog.num_nonnulls(claim_token_hash,claim_expires_at,claim_action,
            response,response_sha256,authority_ref)=6
          AND claim_token_hash~'^[0-9a-f]{64}$' AND response_sha256~'^[0-9a-f]{64}$'
          AND claim_action IN ('submit','lookup')
          AND submitted_at IS NOT NULL AND resolved_at IS NOT NULL)
      ) IS TRUE))
  ) IS TRUE);

CREATE UNIQUE INDEX fiscal_submission_document_provider_uq
  ON public.fiscal_submission(tenant_id,document_id,provider_key)
  WHERE delivery_version=1;
CREATE INDEX fiscal_submission_delivery_queue
  ON public.fiscal_submission(tenant_id,status,claim_expires_at,id)
  WHERE delivery_version=1 AND status IN ('pending','submitted');

CREATE TABLE public.fiscal_submission_history (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT pg_catalog.gen_random_uuid(),
  submission_id uuid NOT NULL,
  transition_seq bigint NOT NULL CHECK (transition_seq>0),
  property_node uuid NOT NULL,
  business_date date NOT NULL CHECK (pg_catalog.isfinite(business_date)),
  document_id uuid NOT NULL,
  document_sha256 text NOT NULL CHECK (document_sha256~'^[0-9a-f]{64}$'),
  wire_sha256 text NOT NULL CHECK (wire_sha256~'^[0-9a-f]{64}$'),
  provider_key text NOT NULL CHECK (provider_key~'^[a-z0-9](?:[a-z0-9._:-]{0,126}[a-z0-9])?$'),
  provider_extension_id uuid NOT NULL,
  provider_extension_version integer NOT NULL CHECK (provider_extension_version>0),
  attempt_id uuid NOT NULL,
  attempt_number integer NOT NULL CHECK (attempt_number BETWEEN 1 AND 4),
  retry_count integer NOT NULL CHECK (retry_count BETWEEN 0 AND 3 AND attempt_number=retry_count+1),
  status text NOT NULL CHECK (status IN ('pending','submitted','accepted','rejected','error')),
  disposition text NOT NULL CHECK (disposition IN ('send','lookup','retry','none')),
  event_type text NOT NULL CHECK (event_type IN (
    'fiscal.submission.requested','fiscal.submission.claimed',
    'fiscal.submission.reconciled','fiscal.submission.retry_requested')),
  outcome text CHECK (outcome IN ('pending','timeout','duplicate','known_not_sent','accepted','rejected')),
  reconciliation_reason text CHECK (reconciliation_reason IN
    ('transport_started','timeout','duplicate','provider_pending','known_not_sent')),
  resolution_source text CHECK (resolution_source IN ('transport_result','lookup_result')),
  authority_ref text,
  response_sha256 text CHECK (response_sha256 IS NULL OR response_sha256~'^[0-9a-f]{64}$'),
  claim_token_hash text CHECK (claim_token_hash IS NULL OR claim_token_hash~'^[0-9a-f]{64}$'),
  claim_expires_at timestamptz,
  claim_action text CHECK (claim_action IS NULL OR claim_action IN ('submit','lookup')),
  actor_id uuid,
  correlation_id uuid NOT NULL,
  idempotency_key_hash text CHECK (idempotency_key_hash IS NULL OR idempotency_key_hash~'^[0-9a-f]{64}$'),
  idempotency_request_hash text CHECK (idempotency_request_hash IS NULL OR idempotency_request_hash~'^[0-9a-f]{64}$'),
  recorded_at timestamptz NOT NULL DEFAULT pg_catalog.transaction_timestamp(),
  CONSTRAINT fiscal_submission_history_pk PRIMARY KEY (tenant_id,submission_id,transition_seq),
  CONSTRAINT fiscal_submission_history_id_uq UNIQUE (tenant_id,id),
  CONSTRAINT fiscal_submission_history_head_fk FOREIGN KEY (tenant_id,submission_id)
    REFERENCES public.fiscal_submission(tenant_id,id),
  CONSTRAINT fiscal_submission_history_document_fk FOREIGN KEY (tenant_id,document_id)
    REFERENCES public.document(tenant_id,id),
  CONSTRAINT fiscal_submission_history_property_fk FOREIGN KEY (tenant_id,property_node)
    REFERENCES public.org_node(tenant_id,id),
  CONSTRAINT fiscal_submission_history_provider_fk
    FOREIGN KEY (provider_extension_id,provider_extension_version)
    REFERENCES public.extension(id,version),
  CONSTRAINT fiscal_submission_history_actor_fk FOREIGN KEY (tenant_id,actor_id)
    REFERENCES public.app_user(tenant_id,id),
  CONSTRAINT fiscal_submission_history_event_shape_ck CHECK (
    (event_type IN ('fiscal.submission.requested','fiscal.submission.retry_requested')
      AND outcome IS NULL AND actor_id IS NOT NULL
      AND pg_catalog.num_nonnulls(idempotency_key_hash,idempotency_request_hash)=2)
    OR
    (event_type='fiscal.submission.claimed' AND outcome IS NULL AND actor_id IS NULL
      AND pg_catalog.num_nonnulls(idempotency_key_hash,idempotency_request_hash)=0
      AND pg_catalog.num_nonnulls(claim_token_hash,claim_expires_at,claim_action)=3)
    OR
    (event_type='fiscal.submission.reconciled' AND outcome IS NOT NULL AND actor_id IS NULL
      AND pg_catalog.num_nonnulls(idempotency_key_hash,idempotency_request_hash)=0
      AND pg_catalog.num_nonnulls(claim_token_hash,claim_expires_at,claim_action)=3)
  )
);
CREATE INDEX fiscal_submission_history_attempt
  ON public.fiscal_submission_history(tenant_id,submission_id,attempt_id,transition_seq);
CREATE UNIQUE INDEX fiscal_submission_history_idempotency_uq
  ON public.fiscal_submission_history(tenant_id,event_type,idempotency_key_hash)
  WHERE idempotency_key_hash IS NOT NULL;
ALTER TABLE public.fiscal_submission_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_submission_history FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON public.fiscal_submission_history
  USING (tenant_id=NULLIF(pg_catalog.current_setting('app.tenant_id',true),'')::uuid)
  WITH CHECK (tenant_id=NULLIF(pg_catalog.current_setting('app.tenant_id',true),'')::uuid);
REVOKE ALL ON TABLE public.fiscal_submission_history FROM PUBLIC,app_role,yellow_runtime;
GRANT SELECT ON TABLE public.fiscal_submission_history TO app_role;

CREATE FUNCTION public.india_fiscal_submission_prevent_history_mutation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
  RAISE EXCEPTION USING ERRCODE='55000',
    MESSAGE='fiscal submission history is append-only';
END;
$$;
CREATE TRIGGER fiscal_submission_history_immutable
  BEFORE UPDATE OR DELETE ON public.fiscal_submission_history
  FOR EACH ROW EXECUTE FUNCTION public.india_fiscal_submission_prevent_history_mutation();

CREATE FUNCTION public.india_fiscal_submission_protect_head()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
  IF OLD.delivery_version IS NULL AND NEW.delivery_version IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE='55000',
      MESSAGE='legacy fiscal submissions cannot be adopted as durable delivery evidence';
  END IF;
  IF OLD.delivery_version IS NOT NULL AND (
      NEW.delivery_version IS DISTINCT FROM OLD.delivery_version
      OR ROW(NEW.tenant_id,NEW.property_node,NEW.business_date,NEW.document_id,
        NEW.document_sha256,NEW.wire_sha256,NEW.wire_text,NEW.provider_key,NEW.mode,
        NEW.provider_extension_id,NEW.provider_extension_version,NEW.requested_by,NEW.request_id)
        IS DISTINCT FROM
        ROW(OLD.tenant_id,OLD.property_node,OLD.business_date,OLD.document_id,
          OLD.document_sha256,OLD.wire_sha256,OLD.wire_text,OLD.provider_key,OLD.mode,
          OLD.provider_extension_id,OLD.provider_extension_version,OLD.requested_by,OLD.request_id)
    ) THEN
    RAISE EXCEPTION USING ERRCODE='55000',
      MESSAGE='durable fiscal submission source references are immutable';
  END IF;
  IF OLD.delivery_version=1 AND OLD.status IN ('accepted','rejected')
     AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION USING ERRCODE='55000',
      MESSAGE='terminal durable fiscal submission is immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER fiscal_submission_protected_head
  BEFORE UPDATE ON public.fiscal_submission
  FOR EACH ROW EXECUTE FUNCTION public.india_fiscal_submission_protect_head();

-- Serialize every writer against the existing audited seal in the seal's lexical
-- relation subset order.  Extension is inserted at its lexical position; the seal
-- does not inspect it.  All row/advisory locks happen after this helper returns.
CREATE FUNCTION public.india_fiscal_submission_lock_relations()
RETURNS void LANGUAGE plpgsql VOLATILE
SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
  LOCK TABLE public.app_user IN ROW EXCLUSIVE MODE;
  LOCK TABLE public.business_day IN ROW EXCLUSIVE MODE;
  LOCK TABLE public.document IN ROW EXCLUSIVE MODE;
  LOCK TABLE public.extension IN ROW EXCLUSIVE MODE;
  LOCK TABLE public.fiscal_submission IN ROW EXCLUSIVE MODE;
  LOCK TABLE public.org_node IN ROW EXCLUSIVE MODE;
  LOCK TABLE public.outbox IN ROW EXCLUSIVE MODE;
  LOCK TABLE public.role_permission IN ROW EXCLUSIVE MODE;
  LOCK TABLE public.tenant IN ROW EXCLUSIVE MODE;
  LOCK TABLE public.user_role IN ROW EXCLUSIVE MODE;
END;
$$;

CREATE FUNCTION public.india_fiscal_submission_money_minor(p_value text)
RETURNS bigint LANGUAGE plpgsql IMMUTABLE STRICT
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_minor numeric;
BEGIN
  IF p_value !~ '^(?:0|[1-9][0-9]{0,13})\.[0-9]{2}$' THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='issued fiscal money text is invalid';
  END IF;
  v_minor:=pg_catalog.split_part(p_value,'.',1)::numeric*100
    +pg_catalog.split_part(p_value,'.',2)::numeric;
  IF v_minor NOT BETWEEN 0 AND 9223372036854775807::numeric THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='issued fiscal money exceeds int64';
  END IF;
  RETURN v_minor::bigint;
END;
$$;

CREATE FUNCTION public.india_fiscal_submission_reference(p_value text)
RETURNS text LANGUAGE plpgsql IMMUTABLE STRICT
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_utf16_length integer;
BEGIN
  SELECT COALESCE(pg_catalog.sum(CASE
      WHEN pg_catalog.ascii(pg_catalog.substr(p_value,i,1))>65535 THEN 2 ELSE 1 END),0)::integer
    INTO v_utf16_length
    FROM pg_catalog.generate_series(1,pg_catalog.char_length(p_value)) i;
  IF v_utf16_length NOT BETWEEN 1 AND 256 OR p_value~U&'[\0001-\001F\007F]' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='normalized fiscal authority reference is invalid';
  END IF;
  RETURN p_value;
END;
$$;

CREATE FUNCTION public.india_fiscal_submission_party_wire(p_party jsonb,p_buyer boolean)
RETURNS text LANGUAGE plpgsql IMMUTABLE STRICT
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE
  v_keys text[];v_expected text[];v_state text;v_pin text;v_result text;
BEGIN
  IF pg_catalog.jsonb_typeof(p_party) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='issued fiscal party is invalid';
  END IF;
  SELECT pg_catalog.array_agg(key ORDER BY key) INTO v_keys
    FROM pg_catalog.jsonb_object_keys(p_party) key;
  v_expected:=CASE
    WHEN p_buyer AND p_party ? 'TrdNm' THEN ARRAY['Addr1','Gstin','LglNm','Loc','Pin','Pos','Stcd','TrdNm']
    WHEN p_buyer THEN ARRAY['Addr1','Gstin','LglNm','Loc','Pin','Pos','Stcd']
    WHEN p_party ? 'TrdNm' THEN ARRAY['Addr1','Gstin','LglNm','Loc','Pin','Stcd','TrdNm']
    ELSE ARRAY['Addr1','Gstin','LglNm','Loc','Pin','Stcd'] END;
  SELECT pg_catalog.array_agg(value ORDER BY value) INTO v_expected
    FROM pg_catalog.unnest(v_expected) value;
  IF v_keys IS DISTINCT FROM v_expected
     OR pg_catalog.jsonb_typeof(p_party->'Gstin') IS DISTINCT FROM 'string'
     OR pg_catalog.jsonb_typeof(p_party->'LglNm') IS DISTINCT FROM 'string'
     OR pg_catalog.jsonb_typeof(p_party->'Addr1') IS DISTINCT FROM 'string'
     OR pg_catalog.jsonb_typeof(p_party->'Loc') IS DISTINCT FROM 'string'
     OR pg_catalog.jsonb_typeof(p_party->'Pin') IS DISTINCT FROM 'number'
     OR pg_catalog.jsonb_typeof(p_party->'Stcd') IS DISTINCT FROM 'string'
     OR (p_party ? 'TrdNm' AND pg_catalog.jsonb_typeof(p_party->'TrdNm') IS DISTINCT FROM 'string')
     OR (p_buyer AND pg_catalog.jsonb_typeof(p_party->'Pos') IS DISTINCT FROM 'string') THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='issued fiscal party shape is invalid';
  END IF;
  v_state:=p_party->>'Stcd';v_pin:=(p_party->'Pin')::text;
  PERFORM public.india_native_statutory_gstin(p_party->>'Gstin',v_state);
  IF v_pin!~'^[1-9][0-9]{5}$' OR v_pin::integer NOT BETWEEN 100000 AND 999999
     OR v_state NOT IN ('01','02','03','04','05','06','07','08','09','10','11','12','13','14','15','16','17','18','19','20',
       '21','22','23','24','26','27','29','30','31','32','33','34','35','36','37','38')
     OR (p_buyer AND p_party->>'Pos' NOT IN
       ('01','02','03','04','05','06','07','08','09','10','11','12','13','14','15','16','17','18','19','20',
        '21','22','23','24','26','27','29','30','31','32','33','34','35','36','37','38')) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='issued fiscal party state or pin is invalid';
  END IF;
  v_result:='{"Gstin":'||pg_catalog.to_json(p_party->>'Gstin')::text
    ||',"LglNm":'||pg_catalog.to_json(public.india_native_statutory_text(p_party->>'LglNm',100))::text;
  IF p_party ? 'TrdNm' THEN
    v_result:=v_result||',"TrdNm":'||pg_catalog.to_json(
      public.india_native_statutory_text(p_party->>'TrdNm',100))::text;
  END IF;
  v_result:=v_result||',"Addr1":'||pg_catalog.to_json(
      public.india_native_statutory_text(p_party->>'Addr1',100))::text
    ||',"Loc":'||pg_catalog.to_json(public.india_native_statutory_text(p_party->>'Loc',50))::text
    ||',"Pin":'||v_pin||',"Stcd":'||pg_catalog.to_json(v_state)::text;
  IF p_buyer THEN v_result:=v_result||',"Pos":'||pg_catalog.to_json(p_party->>'Pos')::text; END IF;
  RETURN v_result||'}';
END;
$$;

-- Owner-derived byte projection matching the unchanged Q197 TypeScript oracle.
-- Stored decimal strings are validated and emitted as numeric tokens.  No rate
-- lookup, tax calculation, bigint-to-float conversion, or caller JSON is used.
CREATE FUNCTION public.india_fiscal_submission_project_wire(
  p_tenant uuid,p_property uuid,p_document uuid
) RETURNS jsonb LANGUAGE plpgsql VOLATILE
SET search_path=pg_catalog,public,pg_temp SET timezone='UTC' SET datestyle='ISO,YMD' AS $$
DECLARE
  d public.document%ROWTYPE;o public.india_gst_native_fiscal_document_origin%ROWTYPE;
  v_source text;v_actual_hash text;v_keys text[];v_doc jsonb;v_date date;
  v_seller text;v_buyer text;v_doc_text text;v_items text[]:='{}'::text[];
  v_item jsonb;v_item_keys text[];v_expected_keys text[];v_family text;v_this_family text;
  v_sl text;v_unit_price text;v_tot text;v_ass text;v_rate text;v_total text;
  v_cgst text;v_sgst text;v_igst text;v_ass_minor bigint;v_tax_minor numeric;v_total_minor bigint;
  v_ass_sum numeric:=0;v_total_sum numeric:=0;v_tax_sum numeric:=0;
  v_cgst_sum numeric:=0;v_sgst_sum numeric:=0;v_ordinal bigint;v_count integer:=0;
  v_val jsonb;v_val_keys text[];v_val_text text;v_wire text;v_wire_hash text;
  v_val_ass text;v_val_total text;v_val_tax text;v_val_cgst text;v_val_sgst text;
BEGIN
  IF p_tenant IS NULL OR p_property IS NULL OR p_document IS NULL
     OR p_tenant IS DISTINCT FROM NULLIF(pg_catalog.current_setting('app.tenant_id',true),'')::uuid THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='issued fiscal wire projection requires its tenant context';
  END IF;
  SELECT document.* INTO d FROM public.document document
   WHERE document.tenant_id=p_tenant AND document.id=p_document
     AND document.property_node=p_property AND document.kind='invoice'
     AND document.status='issued' AND document.doc_no IS NOT NULL
     AND document.sha256~'^[0-9a-f]{64}$' AND document.business_date IS NOT NULL
     AND document.issued_at IS NOT NULL;
  SELECT origin.* INTO o FROM public.india_gst_native_fiscal_document_origin origin
   WHERE origin.tenant_id=p_tenant AND origin.document_id=p_document
     AND origin.property_node=p_property AND origin.document_kind='invoice'
     AND origin.source_kind='native_current_transaction_graph' AND origin.source_version=2
     AND origin.issue_date=d.business_date AND origin.created_at=d.issued_at;
  IF d.id IS NULL OR o.id IS NULL OR o.native_timing_id IS NULL
     OR o.native_accounting_binding_id IS NULL OR o.native_source_basis_hash IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='issued fiscal document is not an authenticated native-v2 invoice';
  END IF;
  PERFORM public.read_india_native_completed_receipt(p_tenant,o.native_timing_id);
  v_source:=d.content::text;
  IF pg_catalog.octet_length(v_source) NOT BETWEEN 1 AND 1048576 THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='issued fiscal document exceeds the wire source bound';
  END IF;
  v_actual_hash:=pg_catalog.encode(public.digest(pg_catalog.convert_to(v_source,'UTF8'),'sha256'),'hex');
  IF v_actual_hash IS DISTINCT FROM d.sha256 THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='issued fiscal document hash does not match';
  END IF;
  SELECT pg_catalog.array_agg(key ORDER BY key) INTO v_keys FROM pg_catalog.jsonb_object_keys(d.content) key;
  IF v_keys IS DISTINCT FROM ARRAY['BuyerDtls','DocDtls','ItemList','SellerDtls','TranDtls','ValDtls','Version']::text[]
     OR pg_catalog.jsonb_typeof(d.content->'Version') IS DISTINCT FROM 'string' OR d.content->>'Version'<>'1.1'
     OR d.content->'TranDtls' IS NULL OR d.content->'DocDtls' IS NULL
     OR d.content->'SellerDtls' IS NULL OR d.content->'BuyerDtls' IS NULL
     OR pg_catalog.jsonb_typeof(d.content->'ItemList') IS DISTINCT FROM 'array'
     OR pg_catalog.jsonb_array_length(d.content->'ItemList') NOT BETWEEN 1 AND 366
     OR d.content->'ValDtls' IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='issued fiscal document shape is invalid';
  END IF;
  SELECT pg_catalog.array_agg(key ORDER BY key) INTO v_keys
    FROM pg_catalog.jsonb_object_keys(d.content->'TranDtls') key;
  IF v_keys IS DISTINCT FROM ARRAY['SupTyp','TaxSch']::text[]
     OR pg_catalog.jsonb_typeof(d.content#>'{TranDtls,TaxSch}') IS DISTINCT FROM 'string'
     OR pg_catalog.jsonb_typeof(d.content#>'{TranDtls,SupTyp}') IS DISTINCT FROM 'string'
     OR d.content#>>'{TranDtls,TaxSch}'<>'GST' OR d.content#>>'{TranDtls,SupTyp}'<>'B2B' THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='issued fiscal transaction details are invalid';
  END IF;
  v_doc:=d.content->'DocDtls';
  SELECT pg_catalog.array_agg(key ORDER BY key) INTO v_keys FROM pg_catalog.jsonb_object_keys(v_doc) key;
  IF v_keys IS DISTINCT FROM ARRAY['Dt','No','Typ']::text[]
     OR pg_catalog.jsonb_typeof(v_doc->'Typ') IS DISTINCT FROM 'string' OR v_doc->>'Typ'<>'INV'
     OR pg_catalog.jsonb_typeof(v_doc->'No') IS DISTINCT FROM 'string' OR v_doc->>'No'!~'^[A-Za-z0-9/-]{1,16}$'
     OR v_doc->>'No' IS DISTINCT FROM d.doc_no
     OR pg_catalog.jsonb_typeof(v_doc->'Dt') IS DISTINCT FROM 'string' OR v_doc->>'Dt'!~'^[0-9]{2}/[0-9]{2}/[0-9]{4}$' THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='issued fiscal document details are invalid';
  END IF;
  BEGIN
    v_date:=pg_catalog.make_date(pg_catalog.substr(v_doc->>'Dt',7,4)::integer,
      pg_catalog.substr(v_doc->>'Dt',4,2)::integer,pg_catalog.substr(v_doc->>'Dt',1,2)::integer);
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='issued fiscal document date is invalid';
  END;
  IF v_date IS DISTINCT FROM d.business_date THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='issued fiscal document date is inconsistent';
  END IF;
  v_doc_text:='{"Typ":"INV","No":'||pg_catalog.to_json(v_doc->>'No')::text
    ||',"Dt":'||pg_catalog.to_json(v_doc->>'Dt')::text||'}';
  v_seller:=public.india_fiscal_submission_party_wire(d.content->'SellerDtls',false);
  v_buyer:=public.india_fiscal_submission_party_wire(d.content->'BuyerDtls',true);

  FOR v_item,v_ordinal IN
    SELECT item.value,item.ordinality
      FROM pg_catalog.jsonb_array_elements(d.content->'ItemList') WITH ORDINALITY item(value,ordinality)
     ORDER BY item.ordinality
  LOOP
    IF pg_catalog.jsonb_typeof(v_item) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='issued fiscal item is invalid';
    END IF;
    v_this_family:=CASE WHEN v_item ? 'IgstAmt' THEN 'igst' ELSE 'split' END;
    v_expected_keys:=CASE WHEN v_this_family='igst'
      THEN ARRAY['AssAmt','GstRt','HsnCd','IgstAmt','IsServc','Qty','SlNo','TotAmt','TotItemVal','Unit','UnitPrice']
      ELSE ARRAY['AssAmt','CgstAmt','GstRt','HsnCd','IsServc','Qty','SgstAmt','SlNo','TotAmt','TotItemVal','Unit','UnitPrice'] END;
    SELECT pg_catalog.array_agg(key ORDER BY key) INTO v_item_keys
      FROM pg_catalog.jsonb_object_keys(v_item) key;
    IF v_item_keys IS DISTINCT FROM v_expected_keys
       OR pg_catalog.jsonb_typeof(v_item->'SlNo') IS DISTINCT FROM 'string'
       OR v_item->>'SlNo' IS DISTINCT FROM v_ordinal::text
       OR v_item->>'SlNo'!~'^(?:[1-9]|[1-9][0-9]|[1-2][0-9]{2}|3[0-5][0-9]|36[0-6])$'
       OR pg_catalog.jsonb_typeof(v_item->'IsServc') IS DISTINCT FROM 'string' OR v_item->>'IsServc'<>'Y'
       OR pg_catalog.jsonb_typeof(v_item->'HsnCd') IS DISTINCT FROM 'string' OR v_item->>'HsnCd'!~'^[0-9]{6}$'
       OR pg_catalog.jsonb_typeof(v_item->'Qty') IS DISTINCT FROM 'string' OR v_item->>'Qty'<>'1.000'
       OR pg_catalog.jsonb_typeof(v_item->'Unit') IS DISTINCT FROM 'string' OR v_item->>'Unit'<>'OTH'
       OR pg_catalog.jsonb_typeof(v_item->'UnitPrice') IS DISTINCT FROM 'string'
       OR pg_catalog.jsonb_typeof(v_item->'TotAmt') IS DISTINCT FROM 'string'
       OR pg_catalog.jsonb_typeof(v_item->'AssAmt') IS DISTINCT FROM 'string'
       OR pg_catalog.jsonb_typeof(v_item->'GstRt') IS DISTINCT FROM 'string'
       OR pg_catalog.jsonb_typeof(v_item->'TotItemVal') IS DISTINCT FROM 'string'
       OR (v_this_family='igst' AND pg_catalog.jsonb_typeof(v_item->'IgstAmt') IS DISTINCT FROM 'string')
       OR (v_this_family='split' AND (pg_catalog.jsonb_typeof(v_item->'CgstAmt') IS DISTINCT FROM 'string'
          OR pg_catalog.jsonb_typeof(v_item->'SgstAmt') IS DISTINCT FROM 'string')) THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='issued fiscal item shape is invalid';
    END IF;
    IF v_family IS NULL THEN v_family:=v_this_family;
    ELSIF v_family<>v_this_family THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='issued fiscal item families are mixed';
    END IF;
    v_sl:=v_item->>'SlNo';v_unit_price:=v_item->>'UnitPrice';v_tot:=v_item->>'TotAmt';
    v_ass:=v_item->>'AssAmt';v_rate:=v_item->>'GstRt';v_total:=v_item->>'TotItemVal';
    v_ass_minor:=public.india_fiscal_submission_money_minor(v_ass);
    IF public.india_fiscal_submission_money_minor(v_unit_price)<>v_ass_minor
       OR public.india_fiscal_submission_money_minor(v_tot)<>v_ass_minor
       OR v_rate!~'^(?:0|[1-9][0-9]{0,2})\.[0-9]{2}$' THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='issued fiscal item amount or rate is invalid';
    END IF;
    v_total_minor:=public.india_fiscal_submission_money_minor(v_total);
    IF v_family='igst' THEN
      v_igst:=v_item->>'IgstAmt';v_tax_minor:=public.india_fiscal_submission_money_minor(v_igst);
      v_cgst:=NULL;v_sgst:=NULL;
    ELSE
      v_cgst:=v_item->>'CgstAmt';v_sgst:=v_item->>'SgstAmt';v_igst:=NULL;
      v_tax_minor:=public.india_fiscal_submission_money_minor(v_cgst)::numeric
        +public.india_fiscal_submission_money_minor(v_sgst)::numeric;
      IF v_tax_minor>9223372036854775807::numeric THEN
        RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='issued fiscal item tax exceeds int64';
      END IF;
    END IF;
    IF v_ass_minor::numeric+v_tax_minor<>v_total_minor::numeric
       OR v_ass_minor::numeric+v_tax_minor>9223372036854775807::numeric THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='issued fiscal item total is inconsistent';
    END IF;
    v_ass_sum:=v_ass_sum+v_ass_minor;v_total_sum:=v_total_sum+v_total_minor;
    v_tax_sum:=v_tax_sum+v_tax_minor;
    IF v_family='split' THEN
      v_cgst_sum:=v_cgst_sum+public.india_fiscal_submission_money_minor(v_cgst);
      v_sgst_sum:=v_sgst_sum+public.india_fiscal_submission_money_minor(v_sgst);
    END IF;
    IF v_ass_sum>9223372036854775807::numeric OR v_total_sum>9223372036854775807::numeric
       OR v_tax_sum>9223372036854775807::numeric OR v_cgst_sum>9223372036854775807::numeric
       OR v_sgst_sum>9223372036854775807::numeric THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='issued fiscal aggregate exceeds int64';
    END IF;
    v_items:=pg_catalog.array_append(v_items,'{"SlNo":'||pg_catalog.to_json(v_sl)::text
      ||',"IsServc":"Y","HsnCd":'||pg_catalog.to_json(v_item->>'HsnCd')::text
      ||',"Qty":1.000,"Unit":"OTH","UnitPrice":'||v_unit_price
      ||',"TotAmt":'||v_tot||',"AssAmt":'||v_ass||',"GstRt":'||v_rate
      ||CASE WHEN v_family='igst' THEN ',"IgstAmt":'||v_igst
        ELSE ',"CgstAmt":'||v_cgst||',"SgstAmt":'||v_sgst END
      ||',"TotItemVal":'||v_total||'}');
    v_count:=v_count+1;
  END LOOP;
  IF v_count NOT BETWEEN 1 AND 366 THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='issued fiscal item set is invalid';
  END IF;
  v_val:=d.content->'ValDtls';
  IF pg_catalog.jsonb_typeof(v_val) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='issued fiscal value details are invalid';
  END IF;
  SELECT pg_catalog.array_agg(key ORDER BY key) INTO v_val_keys
    FROM pg_catalog.jsonb_object_keys(v_val) key;
  v_expected_keys:=CASE WHEN v_family='igst' THEN ARRAY['AssVal','IgstVal','TotInvVal']
    ELSE ARRAY['AssVal','CgstVal','SgstVal','TotInvVal'] END;
  IF v_val_keys IS DISTINCT FROM v_expected_keys
     OR pg_catalog.jsonb_typeof(v_val->'AssVal') IS DISTINCT FROM 'string'
     OR pg_catalog.jsonb_typeof(v_val->'TotInvVal') IS DISTINCT FROM 'string'
     OR (v_family='igst' AND pg_catalog.jsonb_typeof(v_val->'IgstVal') IS DISTINCT FROM 'string')
     OR (v_family='split' AND (pg_catalog.jsonb_typeof(v_val->'CgstVal') IS DISTINCT FROM 'string'
       OR pg_catalog.jsonb_typeof(v_val->'SgstVal') IS DISTINCT FROM 'string')) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='issued fiscal value details shape is invalid';
  END IF;
  v_val_ass:=v_val->>'AssVal';v_val_total:=v_val->>'TotInvVal';
  IF public.india_fiscal_submission_money_minor(v_val_ass)::numeric<>v_ass_sum
     OR public.india_fiscal_submission_money_minor(v_val_total)::numeric<>v_total_sum THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='issued fiscal aggregate values are inconsistent';
  END IF;
  IF v_family='igst' THEN
    v_val_tax:=v_val->>'IgstVal';
    IF public.india_fiscal_submission_money_minor(v_val_tax)::numeric<>v_tax_sum
       OR public.india_fiscal_submission_money_minor(v_val_ass)::numeric+v_tax_sum<>v_total_sum THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='issued fiscal IGST values are inconsistent';
    END IF;
    v_val_text:='{"AssVal":'||v_val_ass||',"IgstVal":'||v_val_tax||',"TotInvVal":'||v_val_total||'}';
  ELSE
    v_val_cgst:=v_val->>'CgstVal';v_val_sgst:=v_val->>'SgstVal';
    IF public.india_fiscal_submission_money_minor(v_val_cgst)::numeric<>v_cgst_sum
       OR public.india_fiscal_submission_money_minor(v_val_sgst)::numeric<>v_sgst_sum
       OR public.india_fiscal_submission_money_minor(v_val_ass)::numeric+v_cgst_sum+v_sgst_sum<>v_total_sum THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='issued fiscal split-tax values are inconsistent';
    END IF;
    v_val_text:='{"AssVal":'||v_val_ass||',"CgstVal":'||v_val_cgst
      ||',"SgstVal":'||v_val_sgst||',"TotInvVal":'||v_val_total||'}';
  END IF;
  v_wire:='{"Version":"1.1","TranDtls":{"TaxSch":"GST","SupTyp":"B2B"},"DocDtls":'
    ||v_doc_text||',"SellerDtls":'||v_seller||',"BuyerDtls":'||v_buyer
    ||',"ItemList":['||pg_catalog.array_to_string(v_items,',')||'],"ValDtls":'||v_val_text||'}';
  v_wire_hash:=pg_catalog.encode(public.digest(pg_catalog.convert_to(v_wire,'UTF8'),'sha256'),'hex');
  RETURN pg_catalog.jsonb_build_object('documentSha256',d.sha256,'wireSha256',v_wire_hash,
    'wireText',v_wire,'businessDate',d.business_date);
END;
$$;

CREATE FUNCTION public.india_fiscal_submission_receipt(
  p_submission public.fiscal_submission,p_replayed boolean
) RETURNS jsonb LANGUAGE sql STABLE STRICT
SET search_path=pg_catalog,public,pg_temp AS $$
  SELECT pg_catalog.jsonb_build_object(
    'submissionId',p_submission.id,'tenantId',p_submission.tenant_id,
    'propertyNode',p_submission.property_node,'documentId',p_submission.document_id,
    'documentSha256',p_submission.document_sha256,'wireSha256',p_submission.wire_sha256,
    'providerKey',p_submission.provider_key,'providerExtensionId',p_submission.provider_extension_id,
    'providerExtensionVersion',p_submission.provider_extension_version,
    'attemptId',p_submission.attempt_id,'attemptNumber',p_submission.attempt_number,
    'retryCount',p_submission.retry_count,'status',p_submission.status,
    'disposition',p_submission.disposition,'transitionSeq',p_submission.transition_seq,
    'replayed',p_replayed)
$$;

CREATE FUNCTION public.india_fiscal_submission_record_transition(
  p_submission public.fiscal_submission,p_event_type text,p_outcome text,
  p_actor uuid,p_correlation uuid,p_key_hash text,p_request_hash text
) RETURNS void LANGUAGE plpgsql VOLATILE
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_payload jsonb;v_now timestamptz:=pg_catalog.transaction_timestamp();
BEGIN
  IF p_submission.delivery_version<>1 OR p_correlation IS NULL
     OR p_event_type NOT IN ('fiscal.submission.requested','fiscal.submission.claimed',
       'fiscal.submission.reconciled','fiscal.submission.retry_requested') THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='durable fiscal transition evidence is invalid';
  END IF;
  INSERT INTO public.fiscal_submission_history(
    tenant_id,submission_id,transition_seq,property_node,business_date,document_id,
    document_sha256,wire_sha256,provider_key,provider_extension_id,provider_extension_version,
    attempt_id,attempt_number,retry_count,status,disposition,event_type,outcome,
    reconciliation_reason,resolution_source,authority_ref,response_sha256,
    claim_token_hash,claim_expires_at,claim_action,actor_id,correlation_id,
    idempotency_key_hash,idempotency_request_hash,recorded_at)
  VALUES(p_submission.tenant_id,p_submission.id,p_submission.transition_seq,p_submission.property_node,
    p_submission.business_date,p_submission.document_id,p_submission.document_sha256,
    p_submission.wire_sha256,p_submission.provider_key,p_submission.provider_extension_id,
    p_submission.provider_extension_version,p_submission.attempt_id,p_submission.attempt_number,
    p_submission.retry_count,p_submission.status,p_submission.disposition,p_event_type,p_outcome,
    p_submission.reconciliation_reason,p_submission.resolution_source,p_submission.authority_ref,
    p_submission.response_sha256,p_submission.claim_token_hash,p_submission.claim_expires_at,
    p_submission.claim_action,p_actor,p_correlation,p_key_hash,p_request_hash,v_now);
  v_payload:=pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
    'submissionId',p_submission.id,'documentId',p_submission.document_id,
    'documentSha256',p_submission.document_sha256,'wireSha256',p_submission.wire_sha256,
    'providerKey',p_submission.provider_key,'providerExtensionId',p_submission.provider_extension_id,
    'providerExtensionVersion',p_submission.provider_extension_version,
    'attemptId',p_submission.attempt_id,'attemptNumber',p_submission.attempt_number,
    'retryCount',p_submission.retry_count,'status',p_submission.status,
    'disposition',p_submission.disposition,'transitionSeq',p_submission.transition_seq,
    'outcome',p_outcome,'responseSha256',p_submission.response_sha256));
  INSERT INTO public.fact_log(tenant_id,entity_type,entity_id,fact_type,valid_from,
    business_date,actor_id,payload)
  VALUES(p_submission.tenant_id,'fiscal_submission',p_submission.id,p_event_type,v_now,
    p_submission.business_date,p_actor,v_payload);
  INSERT INTO public.outbox(tenant_id,property_node,business_date,aggregate_type,aggregate_id,
    event_type,event_version,actor_id,correlation_id,payload,created_at)
  VALUES(p_submission.tenant_id,p_submission.property_node,p_submission.business_date,
    'fiscal_submission',p_submission.id,p_event_type,1,p_actor,p_correlation,v_payload,v_now);
END;
$$;

CREATE FUNCTION public.request_india_fiscal_submission(
  p_tenant uuid,p_property uuid,p_document uuid,p_provider_extension uuid,
  p_actor uuid,p_idempotency_key text,p_request_id uuid
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp SET timezone='UTC' SET datestyle='ISO,YMD' AS $$
DECLARE
  v_context uuid;v_key_hash text;v_request_hash text;v_existing public.fiscal_submission_history%ROWTYPE;
  v_head public.fiscal_submission%ROWTYPE;v_provider public.extension%ROWTYPE;v_wire jsonb;
  v_submission_id uuid:=pg_catalog.gen_random_uuid();v_attempt_id uuid:=pg_catalog.gen_random_uuid();
  v_provider_key text;
BEGIN
  IF session_user<>'yellow_runtime' OR pg_catalog.current_setting('role',true) IS DISTINCT FROM 'app_role'
     OR current_user<>'yellow_owner' THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='fiscal submission request requires the governed runtime app role';
  END IF;
  BEGIN v_context:=NULLIF(pg_catalog.current_setting('app.tenant_id',true),'')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='fiscal submission tenant context is invalid'; END;
  IF p_tenant IS NULL OR p_property IS NULL OR p_document IS NULL OR p_provider_extension IS NULL
     OR p_actor IS NULL OR p_request_id IS NULL
     OR p_idempotency_key IS NULL OR p_idempotency_key COLLATE "C" !~'^[!-~]{8,200}$' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='fiscal submission request input is invalid';
  END IF;
  IF v_context IS DISTINCT FROM p_tenant THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='fiscal submission tenant context is unauthorized';
  END IF;
  PERFORM public.india_fiscal_submission_lock_relations();
  PERFORM 1 FROM public.tenant tenant
    JOIN public.app_user actor ON actor.tenant_id=tenant.id AND actor.id=p_actor AND actor.status='active'
    JOIN public.user_role ur ON ur.tenant_id=actor.tenant_id AND ur.user_id=actor.id
    JOIN public.role_permission rp ON rp.role_id=ur.role_id
      AND rp.permission_code='tax-fiscal.submissions:request'
    JOIN public.org_node grant_node ON grant_node.tenant_id=ur.tenant_id AND grant_node.id=ur.scope_node
    JOIN public.org_node property ON property.tenant_id=tenant.id AND property.id=p_property
      AND property.kind='property' AND grant_node.path @> property.path
   WHERE tenant.id=p_tenant AND tenant.status='active';
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='actor lacks property fiscal-submission request authority'; END IF;
  v_key_hash:=pg_catalog.encode(public.digest(p_idempotency_key,'sha256'),'hex');
  v_request_hash:=pg_catalog.encode(public.digest(pg_catalog.convert_to(
    -- request-id is the first effect's audit correlation, not semantic
    -- idempotency identity; a retrying client may legitimately mint a new one.
    pg_catalog.jsonb_build_array('request',p_tenant,p_property,p_document,p_provider_extension,p_actor)::text,'UTF8'),'sha256'),'hex');
  SELECT history.* INTO v_existing FROM public.fiscal_submission_history history
   WHERE history.tenant_id=p_tenant AND history.event_type='fiscal.submission.requested'
     AND history.idempotency_key_hash=v_key_hash;
  IF FOUND THEN
    IF v_existing.idempotency_request_hash IS DISTINCT FROM v_request_hash THEN
      RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='fiscal submission idempotency key conflicts';
    END IF;
    SELECT submission.* INTO STRICT v_head FROM public.fiscal_submission submission
     WHERE submission.tenant_id=p_tenant AND submission.id=v_existing.submission_id FOR UPDATE;
    RETURN public.india_fiscal_submission_receipt(v_head,true);
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'india-fiscal-submission:'||p_tenant::text||':'||p_document::text,0));
  -- The advisory lock may have waited for an identical first request.  Read the
  -- now-committed receipt again before resolving effect-only source state.
  SELECT history.* INTO v_existing FROM public.fiscal_submission_history history
   WHERE history.tenant_id=p_tenant AND history.event_type='fiscal.submission.requested'
     AND history.idempotency_key_hash=v_key_hash;
  IF FOUND THEN
    IF v_existing.idempotency_request_hash IS DISTINCT FROM v_request_hash THEN
      RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='fiscal submission idempotency key conflicts';
    END IF;
    SELECT submission.* INTO STRICT v_head FROM public.fiscal_submission submission
     WHERE submission.tenant_id=p_tenant AND submission.id=v_existing.submission_id FOR UPDATE;
    RETURN public.india_fiscal_submission_receipt(v_head,true);
  END IF;
  SELECT extension.* INTO v_provider FROM public.extension extension
   WHERE extension.id=p_provider_extension
     AND (extension.tenant_id IS NULL OR extension.tenant_id=p_tenant)
     AND extension.type='fiscal_provider' AND extension.status='active'
     AND extension.effective @> pg_catalog.transaction_timestamp()
     AND extension.content @> '{"jurisdiction":"IN","mode":"in_house_reporting","document_formats":["irp_json_1_1"]}'::jsonb
     AND NOT EXISTS(SELECT 1 FROM public.extension newer
       WHERE newer.tenant_id IS NOT DISTINCT FROM extension.tenant_id
         AND newer.type=extension.type AND newer.key=extension.key AND newer.version>extension.version)
   FOR SHARE;
  v_provider_key:=v_provider.content->>'provider_key';
  IF v_provider.id IS NULL OR v_provider_key IS NULL
     OR v_provider_key!~'^[a-z0-9](?:[a-z0-9._:-]{0,126}[a-z0-9])?$' THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='current India reporting provider extension is unavailable';
  END IF;
  v_wire:=public.india_fiscal_submission_project_wire(p_tenant,p_property,p_document);
  PERFORM 1 FROM public.business_day day
   WHERE day.tenant_id=p_tenant AND day.property_node=p_property
     AND day.business_date=(v_wire->>'businessDate')::date AND day.sealed_at IS NULL
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='issued fiscal document business day is missing or sealed'; END IF;
  IF EXISTS(SELECT 1 FROM public.fiscal_submission submission
      WHERE submission.tenant_id=p_tenant AND submission.document_id=p_document) THEN
    RAISE EXCEPTION USING ERRCODE='23505',
      MESSAGE='issued fiscal document already has a submission, including legacy evidence';
  END IF;
  INSERT INTO public.fiscal_submission(id,tenant_id,document_id,provider_key,mode,status,
    delivery_version,property_node,business_date,document_sha256,wire_sha256,wire_text,
    provider_extension_id,provider_extension_version,attempt_id,attempt_number,retry_count,
    transition_seq,disposition,requested_by,request_id)
  VALUES(v_submission_id,p_tenant,p_document,v_provider_key,'reporting','pending',1,p_property,
    (v_wire->>'businessDate')::date,v_wire->>'documentSha256',v_wire->>'wireSha256',v_wire->>'wireText',
    v_provider.id,v_provider.version,v_attempt_id,1,0,1,'send',p_actor,p_request_id)
  RETURNING * INTO v_head;
  PERFORM public.india_fiscal_submission_record_transition(v_head,'fiscal.submission.requested',
    NULL,p_actor,p_request_id,v_key_hash,v_request_hash);
  RETURN public.india_fiscal_submission_receipt(v_head,false);
END;
$$;

CREATE FUNCTION public.retry_india_fiscal_submission(
  p_tenant uuid,p_submission uuid,p_actor uuid,p_idempotency_key text,p_request_id uuid
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp SET timezone='UTC' SET datestyle='ISO,YMD' AS $$
DECLARE
  v_context uuid;v_key_hash text;v_request_hash text;v_existing public.fiscal_submission_history%ROWTYPE;
  v_head public.fiscal_submission%ROWTYPE;v_attempt uuid:=pg_catalog.gen_random_uuid();
BEGIN
  IF session_user<>'yellow_runtime' OR pg_catalog.current_setting('role',true) IS DISTINCT FROM 'app_role'
     OR current_user<>'yellow_owner' THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='fiscal submission retry requires the governed runtime app role';
  END IF;
  BEGIN v_context:=NULLIF(pg_catalog.current_setting('app.tenant_id',true),'')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='fiscal submission tenant context is invalid'; END;
  IF p_tenant IS NULL OR p_submission IS NULL OR p_actor IS NULL OR p_request_id IS NULL
     OR p_idempotency_key IS NULL
     OR p_idempotency_key COLLATE "C" !~'^[!-~]{8,200}$' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='fiscal submission retry input is invalid';
  END IF;
  IF v_context IS DISTINCT FROM p_tenant THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='fiscal submission tenant context is unauthorized';
  END IF;
  PERFORM public.india_fiscal_submission_lock_relations();
  SELECT submission.* INTO v_head FROM public.fiscal_submission submission
   WHERE submission.tenant_id=p_tenant AND submission.id=p_submission AND submission.delivery_version=1
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='durable fiscal submission is unavailable'; END IF;
  PERFORM 1 FROM public.tenant tenant
    JOIN public.app_user actor ON actor.tenant_id=tenant.id AND actor.id=p_actor AND actor.status='active'
    JOIN public.user_role ur ON ur.tenant_id=actor.tenant_id AND ur.user_id=actor.id
    JOIN public.role_permission rp ON rp.role_id=ur.role_id
      AND rp.permission_code='tax-fiscal.submissions:retry'
    JOIN public.org_node grant_node ON grant_node.tenant_id=ur.tenant_id AND grant_node.id=ur.scope_node
    JOIN public.org_node property ON property.tenant_id=tenant.id AND property.id=v_head.property_node
      AND property.kind='property' AND grant_node.path @> property.path
   WHERE tenant.id=p_tenant AND tenant.status='active';
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='actor lacks property fiscal-submission retry authority'; END IF;
  v_key_hash:=pg_catalog.encode(public.digest(p_idempotency_key,'sha256'),'hex');
  v_request_hash:=pg_catalog.encode(public.digest(pg_catalog.convert_to(
    -- As above, request-id is evidence correlation only.  Submission and actor
    -- remain part of the semantic retry identity and fresh authority is checked.
    pg_catalog.jsonb_build_array('retry',p_tenant,p_submission,p_actor)::text,'UTF8'),'sha256'),'hex');
  SELECT history.* INTO v_existing FROM public.fiscal_submission_history history
   WHERE history.tenant_id=p_tenant AND history.event_type='fiscal.submission.retry_requested'
     AND history.idempotency_key_hash=v_key_hash;
  IF FOUND THEN
    IF v_existing.idempotency_request_hash IS DISTINCT FROM v_request_hash
       OR v_existing.submission_id<>p_submission THEN
      RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='fiscal submission retry idempotency key conflicts';
    END IF;
    RETURN public.india_fiscal_submission_receipt(v_head,true);
  END IF;
  IF v_head.status<>'error' OR v_head.disposition<>'retry'
     OR v_head.reconciliation_reason<>'known_not_sent' THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='only a known-not-sent submission may be retried';
  END IF;
  IF v_head.retry_count>=3 THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='fiscal submission retry limit is exhausted';
  END IF;
  UPDATE public.fiscal_submission SET status='pending',attempt_id=v_attempt,
      attempt_number=attempt_number+1,retry_count=retry_count+1,transition_seq=transition_seq+1,
      disposition='send',claim_token_hash=NULL,claim_expires_at=NULL,claim_action=NULL,
      reconciliation_reason=NULL,resolution_source=NULL,response_sha256=NULL,response=NULL,
      authority_ref=NULL,submitted_at=NULL,resolved_at=NULL
    WHERE tenant_id=p_tenant AND id=p_submission
    RETURNING * INTO v_head;
  PERFORM public.india_fiscal_submission_record_transition(v_head,'fiscal.submission.retry_requested',
    NULL,p_actor,p_request_id,v_key_hash,v_request_hash);
  RETURN public.india_fiscal_submission_receipt(v_head,false);
END;
$$;

CREATE FUNCTION public.claim_india_fiscal_submission(
  p_tenant uuid,p_submission uuid,p_lease_seconds integer DEFAULT 60
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp SET timezone='UTC' SET datestyle='ISO,YMD' AS $$
DECLARE
  v_context uuid;v_head public.fiscal_submission%ROWTYPE;v_action text;
  v_token uuid:=pg_catalog.gen_random_uuid();v_token_hash text;v_now timestamptz;
  v_correlation uuid:=pg_catalog.gen_random_uuid();
BEGIN
  IF session_user<>'yellow_runtime' OR pg_catalog.current_setting('role',true) IS DISTINCT FROM 'none'
     OR current_user<>'yellow_owner' THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='fiscal submission claim requires the direct runtime login';
  END IF;
  BEGIN v_context:=NULLIF(pg_catalog.current_setting('app.tenant_id',true),'')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='fiscal submission tenant context is invalid'; END;
  IF p_tenant IS NULL OR p_submission IS NULL OR p_lease_seconds IS NULL
     OR p_lease_seconds NOT BETWEEN 15 AND 300 THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='fiscal submission claim input is invalid';
  END IF;
  IF v_context IS DISTINCT FROM p_tenant THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='fiscal submission tenant context is unauthorized';
  END IF;
  PERFORM public.india_fiscal_submission_lock_relations();
  SELECT submission.* INTO v_head FROM public.fiscal_submission submission
   WHERE submission.tenant_id=p_tenant AND submission.id=p_submission AND submission.delivery_version=1
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='durable fiscal submission is unavailable'; END IF;
  -- A lease starts only after every possibly blocking relation/head lock is held.
  v_now:=pg_catalog.clock_timestamp();
  IF v_head.status IN ('accepted','rejected') THEN
    RETURN pg_catalog.jsonb_build_object('claimed',false,'reason','terminal');
  ELSIF v_head.status='error' THEN
    RETURN pg_catalog.jsonb_build_object('claimed',false,'reason','retry_required');
  ELSIF v_head.status='submitted' AND v_head.claim_expires_at>v_now THEN
    RETURN pg_catalog.jsonb_build_object('claimed',false,'reason','busy');
  ELSIF v_head.status='pending' THEN v_action:='submit';
  ELSIF v_head.status='submitted' THEN v_action:='lookup';
  ELSE
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='durable fiscal submission state is invalid';
  END IF;
  v_token_hash:=pg_catalog.encode(public.digest(v_token::text,'sha256'),'hex');
  UPDATE public.fiscal_submission SET status='submitted',disposition='lookup',
      transition_seq=transition_seq+1,claim_token_hash=v_token_hash,
      claim_expires_at=v_now+pg_catalog.make_interval(secs=>p_lease_seconds),claim_action=v_action,
      reconciliation_reason=CASE WHEN v_action='submit' THEN 'transport_started' ELSE reconciliation_reason END,
      -- A prior nonterminal adapter result remains in immutable history.  The new
      -- token owns a fresh reconciliation slot on the mutable delivery head.
      response=NULL,submitted_at=COALESCE(submitted_at,v_now)
    WHERE tenant_id=p_tenant AND id=p_submission RETURNING * INTO v_head;
  PERFORM public.india_fiscal_submission_record_transition(v_head,'fiscal.submission.claimed',
    NULL,NULL,v_correlation,NULL,NULL);
  RETURN pg_catalog.jsonb_build_object('claimed',true,'action',v_action,'claimToken',v_token,
    'submissionId',v_head.id,'tenantId',v_head.tenant_id,'propertyNode',v_head.property_node,
    'documentId',v_head.document_id,'documentSha256',v_head.document_sha256,
    'wireSha256',v_head.wire_sha256,'wireJson',v_head.wire_text,
    'providerKey',v_head.provider_key,'providerExtensionId',v_head.provider_extension_id,
    'providerExtensionVersion',v_head.provider_extension_version,
    'attemptId',v_head.attempt_id,'attemptNumber',v_head.attempt_number);
END;
$$;

CREATE FUNCTION public.reconcile_india_fiscal_submission(
  p_tenant uuid,p_submission uuid,p_attempt uuid,p_claim_token uuid,p_result jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp SET timezone='UTC' SET datestyle='ISO,YMD' AS $$
DECLARE
  v_context uuid;v_head public.fiscal_submission%ROWTYPE;v_keys text[];v_expected text[];
  v_type text;v_outcome text;v_token_hash text;v_reason text;v_correlation uuid:=pg_catalog.gen_random_uuid();
  v_now timestamptz;
BEGIN
  IF session_user<>'yellow_runtime' OR pg_catalog.current_setting('role',true) IS DISTINCT FROM 'none'
     OR current_user<>'yellow_owner' THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='fiscal submission reconciliation requires the direct runtime login';
  END IF;
  BEGIN v_context:=NULLIF(pg_catalog.current_setting('app.tenant_id',true),'')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='fiscal submission tenant context is invalid'; END;
  IF p_tenant IS NULL OR p_submission IS NULL OR p_attempt IS NULL OR p_claim_token IS NULL
     OR p_result IS NULL
     OR pg_catalog.jsonb_typeof(p_result) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='fiscal submission reconciliation input is invalid';
  END IF;
  IF v_context IS DISTINCT FROM p_tenant THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='fiscal submission tenant context is unauthorized';
  END IF;
  v_type:=p_result->>'type';v_outcome:=p_result->>'outcome';
  v_expected:=CASE WHEN v_outcome IN ('accepted','rejected','cleared')
    THEN ARRAY['attemptId','authorityRef','documentId','outcome','payloadSha256','providerKey','responseSha256','tenantId','type']
    ELSE ARRAY['attemptId','documentId','outcome','payloadSha256','providerKey','tenantId','type'] END;
  SELECT pg_catalog.array_agg(key ORDER BY key) INTO v_keys FROM pg_catalog.jsonb_object_keys(p_result) key;
  IF v_keys IS DISTINCT FROM v_expected
     OR pg_catalog.jsonb_typeof(p_result->'type') IS DISTINCT FROM 'string'
     OR pg_catalog.jsonb_typeof(p_result->'outcome') IS DISTINCT FROM 'string'
     OR v_type NOT IN ('transport_result','lookup_result')
     OR (v_type='transport_result' AND v_outcome NOT IN
       ('pending','timeout','duplicate','known_not_sent','accepted','rejected'))
     OR (v_type='lookup_result' AND v_outcome NOT IN
       ('pending','known_not_sent','accepted','rejected'))
     OR pg_catalog.jsonb_typeof(p_result->'tenantId') IS DISTINCT FROM 'string'
     OR pg_catalog.jsonb_typeof(p_result->'providerKey') IS DISTINCT FROM 'string'
     OR pg_catalog.jsonb_typeof(p_result->'attemptId') IS DISTINCT FROM 'string'
     OR pg_catalog.jsonb_typeof(p_result->'documentId') IS DISTINCT FROM 'string'
     OR pg_catalog.jsonb_typeof(p_result->'payloadSha256') IS DISTINCT FROM 'string'
     OR p_result->>'payloadSha256'!~'^[0-9a-f]{64}$'
     OR (v_outcome IN ('accepted','rejected') AND (
       pg_catalog.jsonb_typeof(p_result->'authorityRef') IS DISTINCT FROM 'string'
       OR pg_catalog.jsonb_typeof(p_result->'responseSha256') IS DISTINCT FROM 'string'
       OR p_result->>'responseSha256'!~'^[0-9a-f]{64}$')) THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='normalized fiscal result shape is invalid';
  END IF;
  IF v_outcome IN ('accepted','rejected') THEN
    PERFORM public.india_fiscal_submission_reference(p_result->>'authorityRef');
  END IF;
  PERFORM public.india_fiscal_submission_lock_relations();
  SELECT submission.* INTO v_head FROM public.fiscal_submission submission
   WHERE submission.tenant_id=p_tenant AND submission.id=p_submission AND submission.delivery_version=1
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='durable fiscal submission is unavailable'; END IF;
  v_now:=pg_catalog.clock_timestamp();
  v_token_hash:=pg_catalog.encode(public.digest(p_claim_token::text,'sha256'),'hex');
  IF v_head.attempt_id IS DISTINCT FROM p_attempt
     OR v_head.claim_token_hash IS DISTINCT FROM v_token_hash
     OR p_result->>'tenantId' IS DISTINCT FROM v_head.tenant_id::text
     OR p_result->>'providerKey' IS DISTINCT FROM v_head.provider_key
     OR p_result->>'attemptId' IS DISTINCT FROM v_head.attempt_id::text
     OR p_result->>'documentId' IS DISTINCT FROM v_head.document_id::text
     OR p_result->>'payloadSha256' IS DISTINCT FROM v_head.wire_sha256
     OR (v_head.claim_action='submit' AND v_type<>'transport_result')
     OR (v_head.claim_action='lookup' AND v_type<>'lookup_result') THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='fiscal submission attempt, token, or result binding is stale';
  END IF;
  IF v_head.status IN ('accepted','rejected','error') OR v_head.response IS NOT NULL THEN
    IF v_head.response IS NOT DISTINCT FROM p_result THEN
      RETURN public.india_fiscal_submission_receipt(v_head,true);
    END IF;
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='fiscal submission receipt conflicts with retained history';
  END IF;
  IF v_head.status<>'submitted' THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='fiscal submission is not awaiting reconciliation';
  END IF;
  IF v_outcome='pending' THEN v_reason:='provider_pending';
  ELSIF v_outcome IN ('timeout','duplicate') THEN v_reason:=v_outcome;
  ELSE v_reason:=NULL; END IF;
  UPDATE public.fiscal_submission SET transition_seq=transition_seq+1,response=p_result,
      claim_expires_at=v_now,
      status=CASE WHEN v_outcome IN ('pending','timeout','duplicate') THEN 'submitted'
        WHEN v_outcome='known_not_sent' THEN 'error' ELSE v_outcome END,
      disposition=CASE WHEN v_outcome IN ('pending','timeout','duplicate') THEN 'lookup'
        WHEN v_outcome='known_not_sent' THEN 'retry' ELSE 'none' END,
      reconciliation_reason=CASE WHEN v_outcome='known_not_sent' THEN 'known_not_sent' ELSE v_reason END,
      resolution_source=CASE WHEN v_outcome IN ('known_not_sent','accepted','rejected') THEN v_type ELSE NULL END,
      authority_ref=CASE WHEN v_outcome IN ('accepted','rejected') THEN p_result->>'authorityRef' ELSE NULL END,
      response_sha256=CASE WHEN v_outcome IN ('accepted','rejected') THEN p_result->>'responseSha256' ELSE NULL END,
      resolved_at=CASE WHEN v_outcome IN ('known_not_sent','accepted','rejected') THEN v_now ELSE NULL END
    WHERE tenant_id=p_tenant AND id=p_submission RETURNING * INTO v_head;
  PERFORM public.india_fiscal_submission_record_transition(v_head,'fiscal.submission.reconciled',
    v_outcome,NULL,v_correlation,NULL,NULL);
  RETURN public.india_fiscal_submission_receipt(v_head,false);
END;
$$;

-- Ownership, helper privacy, and exact public capability ACLs.
ALTER FUNCTION public.india_fiscal_submission_prevent_history_mutation() OWNER TO yellow_owner;
ALTER FUNCTION public.india_fiscal_submission_protect_head() OWNER TO yellow_owner;
ALTER FUNCTION public.india_fiscal_submission_lock_relations() OWNER TO yellow_owner;
ALTER FUNCTION public.india_fiscal_submission_money_minor(text) OWNER TO yellow_owner;
ALTER FUNCTION public.india_fiscal_submission_reference(text) OWNER TO yellow_owner;
ALTER FUNCTION public.india_fiscal_submission_party_wire(jsonb,boolean) OWNER TO yellow_owner;
ALTER FUNCTION public.india_fiscal_submission_project_wire(uuid,uuid,uuid) OWNER TO yellow_owner;
ALTER FUNCTION public.india_fiscal_submission_receipt(public.fiscal_submission,boolean) OWNER TO yellow_owner;
ALTER FUNCTION public.india_fiscal_submission_record_transition(
  public.fiscal_submission,text,text,uuid,uuid,text,text) OWNER TO yellow_owner;
ALTER FUNCTION public.request_india_fiscal_submission(uuid,uuid,uuid,uuid,uuid,text,uuid) OWNER TO yellow_owner;
ALTER FUNCTION public.retry_india_fiscal_submission(uuid,uuid,uuid,text,uuid) OWNER TO yellow_owner;
ALTER FUNCTION public.claim_india_fiscal_submission(uuid,uuid,integer) OWNER TO yellow_owner;
ALTER FUNCTION public.reconcile_india_fiscal_submission(uuid,uuid,uuid,uuid,jsonb) OWNER TO yellow_owner;

REVOKE ALL ON FUNCTION public.india_fiscal_submission_prevent_history_mutation() FROM PUBLIC,app_role,yellow_runtime;
REVOKE ALL ON FUNCTION public.india_fiscal_submission_protect_head() FROM PUBLIC,app_role,yellow_runtime;
REVOKE ALL ON FUNCTION public.india_fiscal_submission_lock_relations() FROM PUBLIC,app_role,yellow_runtime;
REVOKE ALL ON FUNCTION public.india_fiscal_submission_money_minor(text) FROM PUBLIC,app_role,yellow_runtime;
REVOKE ALL ON FUNCTION public.india_fiscal_submission_reference(text) FROM PUBLIC,app_role,yellow_runtime;
REVOKE ALL ON FUNCTION public.india_fiscal_submission_party_wire(jsonb,boolean) FROM PUBLIC,app_role,yellow_runtime;
REVOKE ALL ON FUNCTION public.india_fiscal_submission_project_wire(uuid,uuid,uuid) FROM PUBLIC,app_role,yellow_runtime;
REVOKE ALL ON FUNCTION public.india_fiscal_submission_receipt(public.fiscal_submission,boolean) FROM PUBLIC,app_role,yellow_runtime;
REVOKE ALL ON FUNCTION public.india_fiscal_submission_record_transition(
  public.fiscal_submission,text,text,uuid,uuid,text,text) FROM PUBLIC,app_role,yellow_runtime;
REVOKE ALL ON FUNCTION public.request_india_fiscal_submission(uuid,uuid,uuid,uuid,uuid,text,uuid)
  FROM PUBLIC,yellow_runtime;
REVOKE ALL ON FUNCTION public.retry_india_fiscal_submission(uuid,uuid,uuid,text,uuid)
  FROM PUBLIC,yellow_runtime;
REVOKE ALL ON FUNCTION public.claim_india_fiscal_submission(uuid,uuid,integer)
  FROM PUBLIC,app_role;
REVOKE ALL ON FUNCTION public.reconcile_india_fiscal_submission(uuid,uuid,uuid,uuid,jsonb)
  FROM PUBLIC,app_role;
GRANT EXECUTE ON FUNCTION public.request_india_fiscal_submission(uuid,uuid,uuid,uuid,uuid,text,uuid) TO app_role;
GRANT EXECUTE ON FUNCTION public.retry_india_fiscal_submission(uuid,uuid,uuid,text,uuid) TO app_role;
GRANT EXECUTE ON FUNCTION public.claim_india_fiscal_submission(uuid,uuid,integer) TO yellow_runtime;
GRANT EXECUTE ON FUNCTION public.reconcile_india_fiscal_submission(uuid,uuid,uuid,uuid,jsonb) TO yellow_runtime;

RESET ROLE;

DO $order440_postconditions$
DECLARE
  v_request oid:=pg_catalog.to_regprocedure('public.request_india_fiscal_submission(uuid,uuid,uuid,uuid,uuid,text,uuid)');
  v_retry oid:=pg_catalog.to_regprocedure('public.retry_india_fiscal_submission(uuid,uuid,uuid,text,uuid)');
  v_claim oid:=pg_catalog.to_regprocedure('public.claim_india_fiscal_submission(uuid,uuid,integer)');
  v_reconcile oid:=pg_catalog.to_regprocedure('public.reconcile_india_fiscal_submission(uuid,uuid,uuid,uuid,jsonb)');
BEGIN
  IF v_request IS NULL OR v_retry IS NULL OR v_claim IS NULL OR v_reconcile IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Order440 durable capabilities are incomplete';
  END IF;
  IF NOT pg_catalog.has_function_privilege('app_role',v_request,'EXECUTE')
     OR NOT pg_catalog.has_function_privilege('app_role',v_retry,'EXECUTE')
     OR pg_catalog.has_function_privilege('yellow_runtime',v_request,'EXECUTE')
     OR pg_catalog.has_function_privilege('yellow_runtime',v_retry,'EXECUTE')
     OR pg_catalog.has_function_privilege('app_role',v_claim,'EXECUTE')
     OR pg_catalog.has_function_privilege('app_role',v_reconcile,'EXECUTE')
     OR NOT pg_catalog.has_function_privilege('yellow_runtime',v_claim,'EXECUTE')
     OR NOT pg_catalog.has_function_privilege('yellow_runtime',v_reconcile,'EXECUTE')
     OR pg_catalog.has_function_privilege('public',v_request,'EXECUTE')
     OR pg_catalog.has_function_privilege('public',v_retry,'EXECUTE')
     OR pg_catalog.has_function_privilege('public',v_claim,'EXECUTE')
     OR pg_catalog.has_function_privilege('public',v_reconcile,'EXECUTE') THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Order440 durable capability ACLs are malformed';
  END IF;
  IF pg_catalog.has_table_privilege('app_role','public.fiscal_submission_history','INSERT,UPDATE,DELETE')
     OR pg_catalog.has_table_privilege('yellow_runtime','public.fiscal_submission_history','INSERT,UPDATE,DELETE') THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Order440 receipt history has direct runtime DML';
  END IF;
  IF NOT pg_catalog.has_table_privilege('app_role','public.fiscal_submission_history','SELECT')
     OR pg_catalog.has_table_privilege('yellow_runtime','public.fiscal_submission_history','SELECT')
     OR pg_catalog.has_table_privilege('public','public.fiscal_submission_history','SELECT') THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Order440 receipt history read ACL is malformed';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.role_permission
     WHERE permission_code IN ('tax-fiscal.submissions:request','tax-fiscal.submissions:retry')
  ) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Order440 submission permissions must remain unassigned';
  END IF;
END
$order440_postconditions$;
