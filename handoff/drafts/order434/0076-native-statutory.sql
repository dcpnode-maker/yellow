-- Order434 / D1352 / Question191: non-runnable, private statutory source fragment.
-- No runtime capability, lock, writer, issue authority, or completed preparation.
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
