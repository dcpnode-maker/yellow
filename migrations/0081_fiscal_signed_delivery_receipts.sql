-- Order440/Q207: authenticated India IRP signed receipt retention and governed read.
-- Forward-only from canonical80. Existing delivery rows and Q205 command receipts
-- remain byte-stable; exact provider bytes live only in the versioned head envelope.

DO $q207_preconditions$
BEGIN
  IF (SELECT pg_catalog.max(version) FROM public.schema_migration) IS DISTINCT FROM 80
     OR NOT EXISTS (
       SELECT 1 FROM public.schema_migration
        WHERE version=80 AND filename='0080_fiscal_submission_delivery_runtime.sql'
          AND pg_catalog.btrim(checksum_sha256)='2c6b1a82e031470bace7ae8b37a2d67e54497014bd1e82f5364d23a2ce25f250'
     ) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Q207 requires exact canonical80';
  END IF;
  IF pg_catalog.to_regprocedure(
       'public.read_india_fiscal_submission_delivery_receipt(uuid,uuid,uuid,uuid)') IS NOT NULL
     OR EXISTS (SELECT 1 FROM public.permission WHERE code='tax-fiscal.submissions:read') THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Q207 signed fiscal receipt capability is already present';
  END IF;
END
$q207_preconditions$;

SET ROLE yellow_owner;

INSERT INTO public.permission(code,description) VALUES
  ('tax-fiscal.submissions:read','Read a property-authorized durable fiscal delivery receipt')
ON CONFLICT(code) DO UPDATE SET description=EXCLUDED.description;

-- This helper is a CHECK/reconcile predicate, not a public capability. JSONB is
-- only the envelope: every byte digest is recomputed over the explicitly decoded
-- byte/string member and never over jsonb::text.
CREATE FUNCTION public.india_fiscal_submission_signed_result_v1_valid(
  p_result jsonb,p_response_sha256 text,p_qr_payload text,p_status text,p_disposition text,
  p_reconciliation_reason text,p_resolution_source text,p_authority_ref text,
  p_tenant uuid,p_attempt uuid,p_document uuid,p_document_sha256 text,
  p_wire_sha256 text,p_provider_key text
) RETURNS boolean LANGUAGE plpgsql IMMUTABLE
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE
  v_receipt jsonb;v_verification jsonb;v_kind text;v_outcome text;v_type text;
  v_keys text[];v_expected text[];v_raw bytea;v_decrypted bytea;v_ack timestamp;
  v_raw_base64 text;v_decrypted_base64 text;v_signed_invoice text;v_signed_qr text;
  v_error_count integer;v_error_distinct integer;
BEGIN
  -- SQL three-valued comparisons must never accept an absent required state.
  -- Authority/QR/reconciliation reason are variant-nullable; these bindings are not.
  IF p_result IS NULL OR pg_catalog.jsonb_typeof(p_result) IS DISTINCT FROM 'object'
     OR p_status IS NULL OR p_disposition IS NULL OR p_resolution_source IS NULL
     OR p_response_sha256 IS NULL OR p_tenant IS NULL OR p_attempt IS NULL
     OR p_document IS NULL OR p_document_sha256 IS NULL OR p_wire_sha256 IS NULL
     OR p_provider_key IS NULL THEN RETURN false; END IF;
  v_outcome:=p_result->>'outcome';v_type:=p_result->>'type';
  IF v_outcome NOT IN ('accepted','rejected','provider_cancelled')
     OR v_type NOT IN ('transport_result','lookup_result')
     OR p_resolution_source IS DISTINCT FROM v_type
     OR (v_outcome='provider_cancelled' AND v_type<>'lookup_result') THEN RETURN false; END IF;
  v_expected:=CASE WHEN v_outcome='accepted'
    THEN ARRAY['attemptId','authorityRef','documentId','outcome','payloadSha256','providerKey',
      'receipt','responseSha256','tenantId','type']
    ELSE ARRAY['attemptId','documentId','outcome','payloadSha256','providerKey',
      'receipt','responseSha256','tenantId','type'] END;
  SELECT pg_catalog.array_agg(key ORDER BY key) INTO v_keys FROM pg_catalog.jsonb_object_keys(p_result) key;
  IF v_keys IS DISTINCT FROM v_expected
     OR pg_catalog.jsonb_typeof(p_result->'type') IS DISTINCT FROM 'string'
     OR pg_catalog.jsonb_typeof(p_result->'outcome') IS DISTINCT FROM 'string'
     OR pg_catalog.jsonb_typeof(p_result->'tenantId') IS DISTINCT FROM 'string'
     OR pg_catalog.jsonb_typeof(p_result->'providerKey') IS DISTINCT FROM 'string'
     OR pg_catalog.jsonb_typeof(p_result->'attemptId') IS DISTINCT FROM 'string'
     OR pg_catalog.jsonb_typeof(p_result->'documentId') IS DISTINCT FROM 'string'
     OR pg_catalog.jsonb_typeof(p_result->'payloadSha256') IS DISTINCT FROM 'string'
     OR pg_catalog.jsonb_typeof(p_result->'responseSha256') IS DISTINCT FROM 'string'
     OR pg_catalog.jsonb_typeof(p_result->'receipt') IS DISTINCT FROM 'object'
     OR p_result->>'tenantId' IS DISTINCT FROM p_tenant::text
     OR p_result->>'attemptId' IS DISTINCT FROM p_attempt::text
     OR p_result->>'documentId' IS DISTINCT FROM p_document::text
     OR p_result->>'providerKey' IS DISTINCT FROM p_provider_key
     OR p_result->>'payloadSha256' IS DISTINCT FROM p_wire_sha256
     OR p_result->>'responseSha256' IS DISTINCT FROM p_response_sha256
     OR p_response_sha256!~'^[0-9a-f]{64}$' THEN RETURN false; END IF;

  v_receipt:=p_result->'receipt';v_kind:=v_receipt->>'kind';
  v_expected:=CASE v_kind
    WHEN 'accepted_signed_v1' THEN ARRAY['ackDt','ackNo','decryptedDataBase64','decryptedDataSha256',
      'documentId','documentSha256','environment','irn','kind','protocolProfile','providerKey',
      'rawResponseBase64','receivedAtUnixMs','signedInvoice','signedInvoiceSha256','signedQRCode',
      'signedQrSha256','verification','version','wireSha256']
    WHEN 'rejected' THEN ARRAY['decryptedDataBase64','decryptedDataSha256','documentId','documentSha256',
      'environment','errorCodes','kind','protocolProfile','providerKey','rawResponseBase64',
      'receivedAtUnixMs','version','wireSha256']
    WHEN 'provider_cancelled' THEN ARRAY['decryptedDataBase64','decryptedDataSha256','documentId',
      'documentSha256','environment','kind','protocolProfile','providerKey','providerStatus',
      'rawResponseBase64','receivedAtUnixMs','version','wireSha256']
    ELSE NULL END;
  SELECT pg_catalog.array_agg(key ORDER BY key) INTO v_keys FROM pg_catalog.jsonb_object_keys(v_receipt) key;
  IF v_expected IS NULL OR v_keys IS DISTINCT FROM v_expected
     OR (v_outcome='accepted' AND v_kind<>'accepted_signed_v1')
     OR (v_outcome='rejected' AND v_kind<>'rejected')
     OR (v_outcome='provider_cancelled' AND v_kind<>'provider_cancelled')
     OR v_receipt->'version' IS DISTINCT FROM '1'::jsonb
     OR pg_catalog.jsonb_typeof(v_receipt->'kind') IS DISTINCT FROM 'string'
     OR pg_catalog.jsonb_typeof(v_receipt->'protocolProfile') IS DISTINCT FROM 'string'
     OR v_receipt->>'protocolProfile'<>'clearirp_direct_v1_04_v1_03_v1'
     OR pg_catalog.jsonb_typeof(v_receipt->'environment') IS DISTINCT FROM 'string'
     OR v_receipt->>'environment' NOT IN ('sandbox','production')
     OR pg_catalog.jsonb_typeof(v_receipt->'providerKey') IS DISTINCT FROM 'string'
     OR v_receipt->>'providerKey' IS DISTINCT FROM p_provider_key
     OR pg_catalog.jsonb_typeof(v_receipt->'documentId') IS DISTINCT FROM 'string'
     OR v_receipt->>'documentId' IS DISTINCT FROM p_document::text
     OR pg_catalog.jsonb_typeof(v_receipt->'documentSha256') IS DISTINCT FROM 'string'
     OR v_receipt->>'documentSha256' IS DISTINCT FROM p_document_sha256
     OR p_document_sha256!~'^[0-9a-f]{64}$'
     OR pg_catalog.jsonb_typeof(v_receipt->'wireSha256') IS DISTINCT FROM 'string'
     OR v_receipt->>'wireSha256' IS DISTINCT FROM p_wire_sha256
     OR pg_catalog.jsonb_typeof(v_receipt->'receivedAtUnixMs') IS DISTINCT FROM 'number'
     OR v_receipt->>'receivedAtUnixMs'!~'^(?:0|[1-9][0-9]{0,15})$'
     OR (v_receipt->>'receivedAtUnixMs')::numeric>9007199254740991::numeric
     OR pg_catalog.jsonb_typeof(v_receipt->'rawResponseBase64') IS DISTINCT FROM 'string'
     OR pg_catalog.jsonb_typeof(v_receipt->'decryptedDataBase64') IS DISTINCT FROM 'string'
     OR pg_catalog.jsonb_typeof(v_receipt->'decryptedDataSha256') IS DISTINCT FROM 'string'
     OR v_receipt->>'decryptedDataSha256'!~'^[0-9a-f]{64}$'
     OR pg_catalog.octet_length(pg_catalog.convert_to(v_receipt::text,'UTF8'))>18874368 THEN RETURN false; END IF;

  v_raw_base64:=v_receipt->>'rawResponseBase64';
  v_decrypted_base64:=v_receipt->>'decryptedDataBase64';
  -- Bound allocation before decoding; exact re-encoding rejects all alphabet,
  -- whitespace, padding and pad-bit aliases without a large repeated regex.
  IF pg_catalog.octet_length(v_raw_base64) NOT BETWEEN 4 AND 8388608
     OR pg_catalog.octet_length(v_decrypted_base64) NOT BETWEEN 4 AND 5592408
     OR pg_catalog.length(v_raw_base64)%4<>0
     OR pg_catalog.length(v_decrypted_base64)%4<>0 THEN RETURN false; END IF;
  v_raw:=pg_catalog.decode(v_raw_base64,'base64');
  v_decrypted:=pg_catalog.decode(v_decrypted_base64,'base64');
  IF pg_catalog.octet_length(v_raw) NOT BETWEEN 1 AND 6291456
     OR pg_catalog.octet_length(v_decrypted) NOT BETWEEN 1 AND 4194304
     OR pg_catalog.translate(pg_catalog.encode(v_raw,'base64'),E'\n\r','') IS DISTINCT FROM v_raw_base64
     OR pg_catalog.translate(pg_catalog.encode(v_decrypted,'base64'),E'\n\r','') IS DISTINCT FROM v_decrypted_base64
     OR pg_catalog.encode(public.digest(v_raw,'sha256'),'hex') IS DISTINCT FROM p_response_sha256
     OR pg_catalog.encode(public.digest(v_decrypted,'sha256'),'hex')
       IS DISTINCT FROM v_receipt->>'decryptedDataSha256'
     OR pg_catalog.substr(v_raw,1,3)=pg_catalog.decode('efbbbf','hex')
     OR pg_catalog.substr(v_decrypted,1,3)=pg_catalog.decode('efbbbf','hex') THEN RETURN false; END IF;
  PERFORM pg_catalog.convert_from(v_raw,'UTF8');
  PERFORM pg_catalog.convert_from(v_decrypted,'UTF8');

  IF v_kind='accepted_signed_v1' THEN
    IF p_status<>'accepted' OR p_disposition<>'none' OR p_reconciliation_reason IS NOT NULL
       OR p_resolution_source NOT IN ('transport_result','lookup_result')
       OR pg_catalog.jsonb_typeof(p_result->'authorityRef') IS DISTINCT FROM 'string'
       OR pg_catalog.jsonb_typeof(v_receipt->'irn') IS DISTINCT FROM 'string'
       OR v_receipt->>'irn'!~'^[0-9a-f]{64}$'
       OR p_authority_ref IS DISTINCT FROM v_receipt->>'irn'
       OR p_result->>'authorityRef' IS DISTINCT FROM p_authority_ref
       OR pg_catalog.jsonb_typeof(v_receipt->'ackNo') IS DISTINCT FROM 'string'
       OR v_receipt->>'ackNo'!~'^[1-9][0-9]{0,63}$'
       OR pg_catalog.jsonb_typeof(v_receipt->'ackDt') IS DISTINCT FROM 'string'
       OR v_receipt->>'ackDt'!~'^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}$'
       OR pg_catalog.jsonb_typeof(v_receipt->'signedInvoice') IS DISTINCT FROM 'string'
       OR pg_catalog.jsonb_typeof(v_receipt->'signedInvoiceSha256') IS DISTINCT FROM 'string'
       OR pg_catalog.jsonb_typeof(v_receipt->'signedQRCode') IS DISTINCT FROM 'string'
       OR pg_catalog.jsonb_typeof(v_receipt->'signedQrSha256') IS DISTINCT FROM 'string'
       OR pg_catalog.jsonb_typeof(v_receipt->'verification') IS DISTINCT FROM 'object' THEN RETURN false; END IF;
    v_ack:=pg_catalog.make_timestamp(
      pg_catalog.substr(v_receipt->>'ackDt',1,4)::integer,
      pg_catalog.substr(v_receipt->>'ackDt',6,2)::integer,
      pg_catalog.substr(v_receipt->>'ackDt',9,2)::integer,
      pg_catalog.substr(v_receipt->>'ackDt',12,2)::integer,
      pg_catalog.substr(v_receipt->>'ackDt',15,2)::integer,
      pg_catalog.substr(v_receipt->>'ackDt',18,2)::double precision);
    IF pg_catalog.to_char(v_ack,'YYYY-MM-DD HH24:MI:SS') IS DISTINCT FROM v_receipt->>'ackDt' THEN RETURN false; END IF;
    v_signed_invoice:=v_receipt->>'signedInvoice';v_signed_qr:=v_receipt->>'signedQRCode';
    IF pg_catalog.char_length(v_signed_invoice) NOT BETWEEN 1 AND 1404249
       OR pg_catalog.char_length(v_signed_qr) NOT BETWEEN 1 AND 1404249
       OR v_signed_invoice COLLATE "C" !~ '^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$'
       OR v_signed_qr COLLATE "C" !~ '^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$'
       OR v_receipt->>'signedInvoiceSha256'!~'^[0-9a-f]{64}$'
       OR v_receipt->>'signedQrSha256'!~'^[0-9a-f]{64}$'
       OR pg_catalog.encode(public.digest(pg_catalog.convert_to(v_signed_invoice,'UTF8'),'sha256'),'hex')
         IS DISTINCT FROM v_receipt->>'signedInvoiceSha256'
       OR pg_catalog.encode(public.digest(pg_catalog.convert_to(v_signed_qr,'UTF8'),'sha256'),'hex')
         IS DISTINCT FROM v_receipt->>'signedQrSha256'
       OR p_qr_payload IS DISTINCT FROM v_signed_qr THEN RETURN false; END IF;
    v_verification:=v_receipt->'verification';
    SELECT pg_catalog.array_agg(key ORDER BY key) INTO v_keys
      FROM pg_catalog.jsonb_object_keys(v_verification) key;
    IF v_keys IS DISTINCT FROM ARRAY['invoiceBundleVersion','invoiceKeyId','invoiceKeySpkiSha256',
         'issuer','profileVersion','qrBundleVersion','qrKeyId','qrKeySpkiSha256','verificationUnixMs']
       OR pg_catalog.jsonb_typeof(v_verification->'profileVersion') IS DISTINCT FROM 'string'
       OR v_verification->>'profileVersion'<>'yellow_native_india_1_1_v1'
       OR pg_catalog.jsonb_typeof(v_verification->'issuer') IS DISTINCT FROM 'string'
       OR pg_catalog.octet_length(v_verification->>'issuer') NOT BETWEEN 1 AND 128
       OR v_verification->>'issuer' COLLATE "C" !~ '^[ -~]+$'
       OR pg_catalog.jsonb_typeof(v_verification->'verificationUnixMs') IS DISTINCT FROM 'number'
       OR v_verification->>'verificationUnixMs'!~'^(?:0|[1-9][0-9]{0,15})$'
       OR (v_verification->>'verificationUnixMs')::numeric>9007199254740991::numeric
       OR pg_catalog.jsonb_typeof(v_verification->'invoiceKeyId') IS DISTINCT FROM 'string'
       OR pg_catalog.octet_length(v_verification->>'invoiceKeyId') NOT BETWEEN 1 AND 256
       OR v_verification->>'invoiceKeyId' COLLATE "C" !~ '^[ -~]+$'
       OR pg_catalog.jsonb_typeof(v_verification->'qrKeyId') IS DISTINCT FROM 'string'
       OR pg_catalog.octet_length(v_verification->>'qrKeyId') NOT BETWEEN 1 AND 256
       OR v_verification->>'qrKeyId' COLLATE "C" !~ '^[ -~]+$'
       OR pg_catalog.jsonb_typeof(v_verification->'invoiceKeySpkiSha256') IS DISTINCT FROM 'string'
       OR v_verification->>'invoiceKeySpkiSha256'!~'^[0-9a-f]{64}$'
       OR pg_catalog.jsonb_typeof(v_verification->'qrKeySpkiSha256') IS DISTINCT FROM 'string'
       OR v_verification->>'qrKeySpkiSha256'!~'^[0-9a-f]{64}$'
       OR pg_catalog.jsonb_typeof(v_verification->'invoiceBundleVersion') IS DISTINCT FROM 'string'
       OR pg_catalog.octet_length(v_verification->>'invoiceBundleVersion') NOT BETWEEN 1 AND 128
       OR v_verification->>'invoiceBundleVersion' COLLATE "C" !~ '^[ -~]+$'
       OR pg_catalog.jsonb_typeof(v_verification->'qrBundleVersion') IS DISTINCT FROM 'string'
       OR pg_catalog.octet_length(v_verification->>'qrBundleVersion') NOT BETWEEN 1 AND 128
       OR v_verification->>'qrBundleVersion' COLLATE "C" !~ '^[ -~]+$' THEN RETURN false; END IF;
  ELSIF v_kind='rejected' THEN
    IF p_status<>'rejected' OR p_disposition<>'none' OR p_reconciliation_reason IS NOT NULL
       OR p_resolution_source NOT IN ('transport_result','lookup_result') OR p_authority_ref IS NOT NULL
       OR p_qr_payload IS NOT NULL OR pg_catalog.jsonb_typeof(v_receipt->'errorCodes') IS DISTINCT FROM 'array'
       OR pg_catalog.jsonb_array_length(v_receipt->'errorCodes') NOT BETWEEN 1 AND 32 THEN RETURN false; END IF;
    SELECT pg_catalog.count(*)::integer,pg_catalog.count(DISTINCT value)::integer
      INTO v_error_count,v_error_distinct
      FROM pg_catalog.jsonb_array_elements(v_receipt->'errorCodes') item(value)
     WHERE pg_catalog.jsonb_typeof(value)='string'
       AND pg_catalog.octet_length(value#>>'{}') BETWEEN 1 AND 64
       AND (value#>>'{}') COLLATE "C" ~ '^[ -~]+$';
    IF v_error_count<>pg_catalog.jsonb_array_length(v_receipt->'errorCodes')
       OR v_error_distinct<>v_error_count THEN RETURN false; END IF;
  ELSE
    IF p_status<>'error' OR p_disposition<>'none'
       OR p_reconciliation_reason IS DISTINCT FROM 'provider_cancelled'
       OR p_resolution_source IS DISTINCT FROM 'lookup_result'
       OR p_authority_ref IS NOT NULL OR p_qr_payload IS NOT NULL
       OR pg_catalog.jsonb_typeof(v_receipt->'providerStatus') IS DISTINCT FROM 'string'
       OR v_receipt->>'providerStatus'<>'CNL' THEN RETURN false; END IF;
  END IF;
  RETURN true;
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;

ALTER TABLE public.fiscal_submission DROP CONSTRAINT fiscal_submission_delivery_all_or_none_ck;
ALTER TABLE public.fiscal_submission ADD CONSTRAINT fiscal_submission_delivery_all_or_none_ck CHECK ((
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
    AND document_sha256~'^[0-9a-f]{64}$' AND wire_sha256~'^[0-9a-f]{64}$'
    AND pg_catalog.octet_length(wire_text) BETWEEN 1 AND 1048576
    AND provider_key~'^[a-z0-9](?:[a-z0-9._:-]{0,126}[a-z0-9])?$'
    AND provider_extension_version>0 AND attempt_number=retry_count+1
    AND retry_count BETWEEN 0 AND 3 AND transition_seq>0 AND mode='reporting'
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
      (status IN ('accepted','rejected') AND disposition='none' AND reconciliation_reason IS NULL
        AND resolution_source IN ('transport_result','lookup_result')
        AND pg_catalog.num_nonnulls(claim_token_hash,claim_expires_at,claim_action,response,response_sha256)=5
        AND claim_token_hash~'^[0-9a-f]{64}$' AND response_sha256~'^[0-9a-f]{64}$'
        AND claim_action IN ('submit','lookup') AND submitted_at IS NOT NULL AND resolved_at IS NOT NULL
        AND ((NOT (response ? 'receipt') AND authority_ref IS NOT NULL)
          OR public.india_fiscal_submission_signed_result_v1_valid(response,response_sha256,qr_payload,
            status,disposition,reconciliation_reason,resolution_source,authority_ref,tenant_id,attempt_id,
            document_id,document_sha256,wire_sha256,provider_key)))
      OR
      (status='error' AND disposition='none' AND reconciliation_reason='provider_cancelled'
        AND resolution_source='lookup_result'
        AND pg_catalog.num_nonnulls(claim_token_hash,claim_expires_at,claim_action,response,response_sha256)=5
        AND claim_token_hash~'^[0-9a-f]{64}$' AND response_sha256~'^[0-9a-f]{64}$'
        AND claim_action='lookup' AND authority_ref IS NULL AND submitted_at IS NOT NULL AND resolved_at IS NOT NULL
        AND public.india_fiscal_submission_signed_result_v1_valid(response,response_sha256,qr_payload,
          status,disposition,reconciliation_reason,resolution_source,authority_ref,tenant_id,attempt_id,
          document_id,document_sha256,wire_sha256,provider_key))
    ) IS TRUE))
) IS TRUE);

ALTER TABLE public.fiscal_submission_history
  DROP CONSTRAINT fiscal_submission_history_outcome_check,
  ADD CONSTRAINT fiscal_submission_history_outcome_check CHECK (outcome IN
    ('pending','timeout','duplicate','known_not_sent','accepted','rejected','provider_cancelled')),
  DROP CONSTRAINT fiscal_submission_history_reconciliation_reason_check,
  ADD CONSTRAINT fiscal_submission_history_reconciliation_reason_check CHECK (reconciliation_reason IN
    ('transport_started','timeout','duplicate','provider_pending','known_not_sent','provider_cancelled')),
  DROP CONSTRAINT fiscal_submission_history_event_shape_ck,
  ADD CONSTRAINT fiscal_submission_history_event_shape_ck CHECK (
    ((event_type IN ('fiscal.submission.requested','fiscal.submission.retry_requested')
        AND outcome IS NULL AND actor_id IS NOT NULL
        AND pg_catalog.num_nonnulls(idempotency_key_hash,idempotency_request_hash)=2)
      OR
      (event_type='fiscal.submission.claimed' AND outcome IS NULL AND actor_id IS NULL
        AND pg_catalog.num_nonnulls(idempotency_key_hash,idempotency_request_hash)=0
        AND pg_catalog.num_nonnulls(claim_token_hash,claim_expires_at,claim_action)=3)
      OR
      (event_type='fiscal.submission.reconciled' AND outcome IS NOT NULL AND actor_id IS NULL
        AND pg_catalog.num_nonnulls(idempotency_key_hash,idempotency_request_hash)=0
        AND pg_catalog.num_nonnulls(claim_token_hash,claim_expires_at,claim_action)=3))
    AND (outcome IS DISTINCT FROM 'provider_cancelled' OR
      (event_type='fiscal.submission.reconciled' AND status='error' AND disposition='none'
       AND reconciliation_reason='provider_cancelled' AND resolution_source='lookup_result'
       AND authority_ref IS NULL AND response_sha256 IS NOT NULL AND claim_action='lookup'))
    AND (reconciliation_reason IS DISTINCT FROM 'provider_cancelled' OR outcome='provider_cancelled')
  );

CREATE OR REPLACE FUNCTION public.india_fiscal_submission_protect_head()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    IF OLD.delivery_version IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='durable fiscal submission cannot be deleted';
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.delivery_version=1 AND (NEW.status IN ('accepted','rejected')
        OR (NEW.status='error' AND NEW.disposition='none'))
       AND public.india_fiscal_submission_signed_result_v1_valid(
         NEW.response,NEW.response_sha256,NEW.qr_payload,NEW.status,NEW.disposition,
         NEW.reconciliation_reason,NEW.resolution_source,NEW.authority_ref,NEW.tenant_id,
         NEW.attempt_id,NEW.document_id,NEW.document_sha256,NEW.wire_sha256,NEW.provider_key) IS NOT TRUE THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='new terminal fiscal submission requires signed delivery evidence';
    END IF;
    RETURN NEW;
  END IF;
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
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='durable fiscal submission source references are immutable';
  END IF;
  IF OLD.delivery_version=1 AND (OLD.status IN ('accepted','rejected')
       OR (OLD.status='error' AND OLD.disposition='none'
         AND OLD.reconciliation_reason='provider_cancelled'))
     THEN
    IF NEW IS DISTINCT FROM OLD THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='terminal durable fiscal submission is immutable';
    END IF;
    -- Byte-identical retained pre81 rows remain untouched; this does not allow
    -- a pending row to acquire a newly fabricated legacy unsigned acceptance.
    RETURN NEW;
  END IF;
  IF NEW.delivery_version=1 AND (NEW.status IN ('accepted','rejected')
      OR (NEW.status='error' AND NEW.disposition='none'))
     AND public.india_fiscal_submission_signed_result_v1_valid(
       NEW.response,NEW.response_sha256,NEW.qr_payload,NEW.status,NEW.disposition,
       NEW.reconciliation_reason,NEW.resolution_source,NEW.authority_ref,NEW.tenant_id,
       NEW.attempt_id,NEW.document_id,NEW.document_sha256,NEW.wire_sha256,NEW.provider_key) IS NOT TRUE THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='new terminal fiscal submission requires signed delivery evidence';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER fiscal_submission_protected_head ON public.fiscal_submission;
CREATE TRIGGER fiscal_submission_protected_head
  BEFORE INSERT OR UPDATE OR DELETE ON public.fiscal_submission
  FOR EACH ROW EXECUTE FUNCTION public.india_fiscal_submission_protect_head();

CREATE OR REPLACE FUNCTION public.claim_india_fiscal_submission(
  p_tenant uuid,p_submission uuid,p_lease_seconds integer DEFAULT 60
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp SET timezone='UTC' SET datestyle='ISO,YMD' AS $$
DECLARE
  v_context uuid;v_head public.fiscal_submission%ROWTYPE;v_action text;v_source text;v_source_hash text;
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
  PERFORM 1 FROM public.tenant tenant WHERE tenant.id=p_tenant AND tenant.status='active' FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='active fiscal submission tenant is unavailable';
  END IF;
  SELECT submission.* INTO v_head FROM public.fiscal_submission submission
   WHERE submission.tenant_id=p_tenant AND submission.id=p_submission AND submission.delivery_version=1
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='durable fiscal submission is unavailable'; END IF;
  SELECT document.content::text INTO v_source FROM public.document document
   WHERE document.tenant_id=v_head.tenant_id AND document.id=v_head.document_id;
  IF v_source IS NULL OR pg_catalog.octet_length(v_source) NOT BETWEEN 1 AND 1048576 THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='fiscal submission source content is unavailable';
  END IF;
  v_source_hash:=pg_catalog.encode(public.digest(pg_catalog.convert_to(v_source,'UTF8'),'sha256'),'hex');
  IF v_source_hash IS DISTINCT FROM v_head.document_sha256 THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='fiscal submission source content hash is inconsistent';
  END IF;
  v_now:=pg_catalog.clock_timestamp();
  IF v_head.status IN ('accepted','rejected')
     OR (v_head.status='error' AND v_head.disposition='none'
       AND v_head.reconciliation_reason='provider_cancelled') THEN
    RETURN pg_catalog.jsonb_build_object('claimed',false,'reason','terminal');
  ELSIF v_head.status='error' AND v_head.disposition='retry'
      AND v_head.reconciliation_reason='known_not_sent' THEN
    RETURN pg_catalog.jsonb_build_object('claimed',false,'reason','retry_required');
  ELSIF v_head.status='submitted'
    AND v_head.claim_expires_at + (CASE WHEN v_head.response IS NULL
      THEN interval '0 seconds' ELSE interval '15 seconds' END) > v_now THEN
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
      response=NULL,submitted_at=COALESCE(submitted_at,v_now)
    WHERE tenant_id=p_tenant AND id=p_submission RETURNING * INTO v_head;
  PERFORM public.india_fiscal_submission_record_transition(v_head,'fiscal.submission.claimed',
    NULL,NULL,v_correlation,NULL,NULL);
  RETURN pg_catalog.jsonb_build_object('claimed',true,'action',v_action,'claimToken',v_token,
    'submissionId',v_head.id,'tenantId',v_head.tenant_id,'propertyNode',v_head.property_node,
    'documentId',v_head.document_id,'documentSha256',v_head.document_sha256,
    'sourceContentJson',v_source,'wireSha256',v_head.wire_sha256,'wireJson',v_head.wire_text,
    'providerKey',v_head.provider_key,'providerExtensionId',v_head.provider_extension_id,
    'providerExtensionVersion',v_head.provider_extension_version,
    'attemptId',v_head.attempt_id,'attemptNumber',v_head.attempt_number);
END;
$$;

CREATE OR REPLACE FUNCTION public.reconcile_india_fiscal_submission(
  p_tenant uuid,p_submission uuid,p_attempt uuid,p_claim_token uuid,p_result jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp SET timezone='UTC' SET datestyle='ISO,YMD' AS $$
DECLARE
  v_context uuid;v_head public.fiscal_submission%ROWTYPE;v_keys text[];
  v_type text;v_outcome text;v_token_hash text;v_reason text;v_correlation uuid:=pg_catalog.gen_random_uuid();
  v_status text;v_disposition text;v_reconciliation_reason text;v_resolution_source text;
  v_authority_ref text;v_response_sha256 text;v_qr_payload text;v_now timestamptz;
BEGIN
  IF session_user<>'yellow_runtime' OR pg_catalog.current_setting('role',true) IS DISTINCT FROM 'none'
     OR current_user<>'yellow_owner' THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='fiscal submission reconciliation requires the direct runtime login';
  END IF;
  BEGIN v_context:=NULLIF(pg_catalog.current_setting('app.tenant_id',true),'')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='fiscal submission tenant context is invalid'; END;
  IF p_tenant IS NULL OR p_submission IS NULL OR p_attempt IS NULL OR p_claim_token IS NULL
     OR p_result IS NULL OR pg_catalog.jsonb_typeof(p_result) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='fiscal submission reconciliation input is invalid';
  END IF;
  IF v_context IS DISTINCT FROM p_tenant THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='fiscal submission tenant context is unauthorized';
  END IF;
  v_type:=p_result->>'type';v_outcome:=p_result->>'outcome';
  IF pg_catalog.jsonb_typeof(p_result->'type') IS DISTINCT FROM 'string'
     OR pg_catalog.jsonb_typeof(p_result->'outcome') IS DISTINCT FROM 'string'
     OR v_type NOT IN ('transport_result','lookup_result')
     OR v_outcome NOT IN ('pending','timeout','duplicate','known_not_sent','accepted','rejected','provider_cancelled') THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='normalized fiscal result shape is invalid';
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
  -- Existing terminal/nonterminal responses replay before the stricter post81
  -- terminal envelope check. Conflicting replacements remain forbidden.
  IF v_head.status IN ('accepted','rejected','error') OR v_head.response IS NOT NULL THEN
    IF v_head.response IS NOT DISTINCT FROM p_result THEN
      RETURN public.india_fiscal_submission_receipt(v_head,true);
    END IF;
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='fiscal submission receipt conflicts with retained history';
  END IF;
  IF v_head.status<>'submitted' THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='fiscal submission is not awaiting reconciliation';
  END IF;

  IF v_outcome IN ('accepted','rejected','provider_cancelled') THEN
    v_status:=CASE WHEN v_outcome='provider_cancelled' THEN 'error' ELSE v_outcome END;
    v_disposition:='none';
    v_reconciliation_reason:=CASE WHEN v_outcome='provider_cancelled' THEN 'provider_cancelled' ELSE NULL END;
    v_resolution_source:=v_type;
    v_authority_ref:=CASE WHEN v_outcome='accepted' THEN p_result->>'authorityRef' ELSE NULL END;
    v_response_sha256:=p_result->>'responseSha256';
    v_qr_payload:=CASE WHEN v_outcome='accepted' THEN p_result->'receipt'->>'signedQRCode' ELSE NULL END;
    IF NOT public.india_fiscal_submission_signed_result_v1_valid(p_result,v_response_sha256,v_qr_payload,
      v_status,v_disposition,v_reconciliation_reason,v_resolution_source,v_authority_ref,
      v_head.tenant_id,v_head.attempt_id,v_head.document_id,v_head.document_sha256,
      v_head.wire_sha256,v_head.provider_key) THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='normalized signed fiscal result is invalid';
    END IF;
  ELSE
    SELECT pg_catalog.array_agg(key ORDER BY key) INTO v_keys FROM pg_catalog.jsonb_object_keys(p_result) key;
    IF v_keys IS DISTINCT FROM ARRAY['attemptId','documentId','outcome','payloadSha256','providerKey','tenantId','type']
       OR pg_catalog.jsonb_typeof(p_result->'tenantId') IS DISTINCT FROM 'string'
       OR pg_catalog.jsonb_typeof(p_result->'providerKey') IS DISTINCT FROM 'string'
       OR pg_catalog.jsonb_typeof(p_result->'attemptId') IS DISTINCT FROM 'string'
       OR pg_catalog.jsonb_typeof(p_result->'documentId') IS DISTINCT FROM 'string'
       OR pg_catalog.jsonb_typeof(p_result->'payloadSha256') IS DISTINCT FROM 'string'
       OR p_result->>'payloadSha256'!~'^[0-9a-f]{64}$'
       OR (v_type='transport_result' AND v_outcome NOT IN ('pending','timeout','duplicate','known_not_sent'))
       OR (v_type='lookup_result' AND v_outcome NOT IN ('pending','known_not_sent')) THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='normalized fiscal result shape is invalid';
    END IF;
    IF v_outcome='pending' THEN v_reason:='provider_pending';
    ELSIF v_outcome IN ('timeout','duplicate') THEN v_reason:=v_outcome;
    ELSE v_reason:=NULL; END IF;
    v_status:=CASE WHEN v_outcome IN ('pending','timeout','duplicate') THEN 'submitted' ELSE 'error' END;
    v_disposition:=CASE WHEN v_outcome IN ('pending','timeout','duplicate') THEN 'lookup' ELSE 'retry' END;
    v_reconciliation_reason:=CASE WHEN v_outcome='known_not_sent' THEN 'known_not_sent' ELSE v_reason END;
    v_resolution_source:=CASE WHEN v_outcome='known_not_sent' THEN v_type ELSE NULL END;
  END IF;
  UPDATE public.fiscal_submission SET transition_seq=transition_seq+1,response=p_result,
      claim_expires_at=v_now,status=v_status,disposition=v_disposition,
      reconciliation_reason=v_reconciliation_reason,resolution_source=v_resolution_source,
      authority_ref=v_authority_ref,response_sha256=v_response_sha256,qr_payload=v_qr_payload,
      resolved_at=CASE WHEN v_outcome IN ('known_not_sent','accepted','rejected','provider_cancelled')
        THEN v_now ELSE NULL END
    WHERE tenant_id=p_tenant AND id=p_submission RETURNING * INTO v_head;
  PERFORM public.india_fiscal_submission_record_transition(v_head,'fiscal.submission.reconciled',
    v_outcome,NULL,v_correlation,NULL,NULL);
  RETURN public.india_fiscal_submission_receipt(v_head,false);
END;
$$;

CREATE FUNCTION public.read_india_fiscal_submission_delivery_receipt(
  p_tenant uuid,p_property uuid,p_submission uuid,p_actor uuid
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp SET timezone='UTC' SET datestyle='ISO,YMD' AS $$
DECLARE v_context uuid;v_head public.fiscal_submission%ROWTYPE;v_common jsonb;v_receipt jsonb;
BEGIN
  IF session_user<>'yellow_runtime' OR pg_catalog.current_setting('role',true) IS DISTINCT FROM 'app_role'
     OR current_user<>'yellow_owner' THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='fiscal submission receipt read requires the governed runtime app role';
  END IF;
  BEGIN v_context:=NULLIF(pg_catalog.current_setting('app.tenant_id',true),'')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='fiscal submission receipt tenant context is invalid'; END;
  IF p_tenant IS NULL OR p_property IS NULL OR p_submission IS NULL OR p_actor IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='fiscal submission receipt read input is invalid';
  END IF;
  IF v_context IS DISTINCT FROM p_tenant THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='fiscal submission receipt tenant context is unauthorized';
  END IF;
  SELECT submission.* INTO v_head
    FROM public.fiscal_submission submission
   WHERE submission.tenant_id=p_tenant AND submission.property_node=p_property
     AND submission.id=p_submission AND submission.delivery_version=1
     AND EXISTS (
       SELECT 1 FROM public.tenant tenant
       JOIN public.app_user actor ON actor.tenant_id=tenant.id AND actor.id=p_actor AND actor.status='active'
       JOIN public.user_role ur ON ur.tenant_id=actor.tenant_id AND ur.user_id=actor.id
       JOIN public.role granted_role ON granted_role.tenant_id=tenant.id AND granted_role.id=ur.role_id
       JOIN public.role_permission rp ON rp.role_id=granted_role.id
         AND rp.permission_code='tax-fiscal.submissions:read'
       JOIN public.org_node grant_node ON grant_node.tenant_id=ur.tenant_id AND grant_node.id=ur.scope_node
       JOIN public.org_node property ON property.tenant_id=tenant.id AND property.id=p_property
         AND property.kind='property' AND grant_node.path @> property.path
       WHERE tenant.id=p_tenant AND tenant.status='active');
  IF NOT FOUND THEN RETURN NULL; END IF;
  v_common:=pg_catalog.jsonb_build_object(
    'kind','pending','submissionId',v_head.id,'tenantId',v_head.tenant_id,
    'propertyNode',v_head.property_node,'documentId',v_head.document_id,
    'documentSha256',v_head.document_sha256,'wireSha256',v_head.wire_sha256,
    'providerKey',v_head.provider_key,'attemptId',v_head.attempt_id,
    'attemptNumber',v_head.attempt_number,'status',v_head.status,
    'disposition',v_head.disposition,'transitionSeq',v_head.transition_seq);
  IF v_head.response ? 'receipt' THEN v_receipt:=v_head.response->'receipt'; END IF;
  IF v_head.status='accepted' AND v_receipt->>'kind'='accepted_signed_v1' THEN
    RETURN v_common||pg_catalog.jsonb_build_object('kind','accepted_signed_v1',
      'environment',v_receipt->>'environment','responseSha256',v_head.response_sha256,
      'irn',v_receipt->>'irn','ackNo',v_receipt->>'ackNo','ackDt',v_receipt->>'ackDt',
      'signedInvoice',v_receipt->>'signedInvoice','signedQRCode',v_head.qr_payload,
      'signedInvoiceSha256',v_receipt->>'signedInvoiceSha256',
      'signedQrSha256',v_receipt->>'signedQrSha256','verification',v_receipt->'verification');
  ELSIF v_head.status='rejected' AND v_receipt->>'kind'='rejected' THEN
    RETURN v_common||pg_catalog.jsonb_build_object('kind','rejected',
      'environment',v_receipt->>'environment','responseSha256',v_head.response_sha256,
      'errorCodes',v_receipt->'errorCodes');
  ELSIF v_head.status='error' AND v_head.disposition='none'
      AND v_head.reconciliation_reason='provider_cancelled'
      AND v_receipt->>'kind'='provider_cancelled' THEN
    RETURN v_common||pg_catalog.jsonb_build_object('kind','provider_cancelled',
      'environment',v_receipt->>'environment','responseSha256',v_head.response_sha256,
      'providerStatus','CNL');
  ELSIF v_head.status IN ('accepted','rejected') THEN
    RETURN v_common||pg_catalog.jsonb_build_object('kind','legacy_hash_only',
      'authorityRef',v_head.authority_ref,'responseSha256',v_head.response_sha256);
  END IF;
  RETURN v_common;
END;
$$;

ALTER FUNCTION public.india_fiscal_submission_signed_result_v1_valid(
  jsonb,text,text,text,text,text,text,text,uuid,uuid,uuid,text,text,text) OWNER TO yellow_owner;
ALTER FUNCTION public.india_fiscal_submission_protect_head() OWNER TO yellow_owner;
ALTER FUNCTION public.claim_india_fiscal_submission(uuid,uuid,integer) OWNER TO yellow_owner;
ALTER FUNCTION public.reconcile_india_fiscal_submission(uuid,uuid,uuid,uuid,jsonb) OWNER TO yellow_owner;
ALTER FUNCTION public.read_india_fiscal_submission_delivery_receipt(uuid,uuid,uuid,uuid) OWNER TO yellow_owner;

REVOKE ALL ON FUNCTION public.india_fiscal_submission_signed_result_v1_valid(
  jsonb,text,text,text,text,text,text,text,uuid,uuid,uuid,text,text,text) FROM PUBLIC,app_role,yellow_runtime;
REVOKE ALL ON FUNCTION public.india_fiscal_submission_protect_head() FROM PUBLIC,app_role,yellow_runtime;
REVOKE ALL ON FUNCTION public.claim_india_fiscal_submission(uuid,uuid,integer) FROM PUBLIC,app_role;
REVOKE ALL ON FUNCTION public.reconcile_india_fiscal_submission(uuid,uuid,uuid,uuid,jsonb) FROM PUBLIC,app_role;
REVOKE ALL ON FUNCTION public.read_india_fiscal_submission_delivery_receipt(uuid,uuid,uuid,uuid)
  FROM PUBLIC,app_role,yellow_runtime;
GRANT EXECUTE ON FUNCTION public.claim_india_fiscal_submission(uuid,uuid,integer) TO yellow_runtime;
GRANT EXECUTE ON FUNCTION public.reconcile_india_fiscal_submission(uuid,uuid,uuid,uuid,jsonb) TO yellow_runtime;
GRANT EXECUTE ON FUNCTION public.read_india_fiscal_submission_delivery_receipt(uuid,uuid,uuid,uuid) TO app_role;

REVOKE SELECT ON TABLE public.fiscal_submission FROM app_role;
GRANT SELECT(tenant_id,document_id,status) ON TABLE public.fiscal_submission TO app_role;
REVOKE SELECT ON TABLE public.fiscal_submission_history FROM app_role;

DO $q207_postconditions$
DECLARE v_read oid:=pg_catalog.to_regprocedure(
  'public.read_india_fiscal_submission_delivery_receipt(uuid,uuid,uuid,uuid)');
BEGIN
  IF v_read IS NULL OR NOT pg_catalog.has_function_privilege('app_role',v_read,'EXECUTE')
     OR pg_catalog.has_function_privilege('yellow_runtime',v_read,'EXECUTE')
     OR pg_catalog.has_function_privilege('public',v_read,'EXECUTE') THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Q207 receipt read ACL is malformed';
  END IF;
  -- Revoking a table grant does not revoke separately granted column rights.
  -- Check every effective right, including PUBLIC and inherited grants. Unexpected
  -- deployment ACLs fail the whole migration instead of silently retaining a leak
  -- or altering unrelated role memberships to manufacture the expected result.
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_attribute attribute
     WHERE attribute.attrelid IN ('public.fiscal_submission'::pg_catalog.regclass,
                                  'public.fiscal_submission_history'::pg_catalog.regclass)
       AND attribute.attnum>0 AND NOT attribute.attisdropped
       AND (
         pg_catalog.has_table_privilege('app_role',attribute.attrelid,'SELECT')
         OR pg_catalog.has_table_privilege('yellow_runtime',attribute.attrelid,'SELECT')
         OR pg_catalog.has_column_privilege('yellow_runtime',attribute.attrelid,attribute.attnum,'SELECT')
         OR pg_catalog.has_column_privilege('app_role',attribute.attrelid,attribute.attnum,'SELECT')
           IS DISTINCT FROM (
             attribute.attrelid='public.fiscal_submission'::pg_catalog.regclass
             AND attribute.attname IN ('tenant_id','document_id','status'))
       )
  ) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Q207 fiscal receipt column ACL is malformed';
  END IF;
  IF EXISTS (SELECT 1 FROM public.role_permission WHERE permission_code='tax-fiscal.submissions:read') THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Q207 receipt permission must remain unassigned';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger
     WHERE tgrelid='public.fiscal_submission'::pg_catalog.regclass
       AND tgname='fiscal_submission_protected_head' AND NOT tgisinternal
       AND (tgtype & 4)=4 AND (tgtype & 8)=8 AND (tgtype & 16)=16
  ) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Q207 durable head mutation guard is incomplete';
  END IF;
END
$q207_postconditions$;

RESET ROLE;
