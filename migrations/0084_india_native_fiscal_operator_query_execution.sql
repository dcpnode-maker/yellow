-- Order440/Q208 forward repair after applied83: preserve every public contract
-- while correcting the admitted lazy query, authority, source-digest and stable
-- confirmation-comparison defects found by genuine rollback execution.

DO $q208_84_preconditions$
BEGIN
  IF (SELECT pg_catalog.max(version) FROM public.schema_migration) IS DISTINCT FROM 83
     OR NOT EXISTS (
       SELECT 1 FROM public.schema_migration WHERE version=83
        AND filename='0083_india_native_fiscal_operator_calendar_bounds.sql'
        AND pg_catalog.btrim(checksum_sha256)='5a8ac565f3aaebfee4245121a434dba5867f558091a58aad87f23bed5dee0705') THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Q208 query correction requires exact applied83';
  END IF;
END
$q208_84_preconditions$;

SET ROLE yellow_owner;

-- Preserve the large applied bodies byte-for-byte outside the admitted exact
-- replacements. Exact pg_get_functiondef hashes refuse any predecessor drift.
DO $q208_84_repair$
DECLARE v_oid oid;v_definition text;v_changed text;v_hash text;
BEGIN
  v_oid:=pg_catalog.to_regprocedure(
    'public.discover_india_native_fiscal_issue(uuid,uuid,uuid,uuid,uuid,uuid,text,text,date,date[],text[])');
  v_definition:=pg_catalog.pg_get_functiondef(v_oid);
  v_hash:=pg_catalog.encode(public.digest(pg_catalog.convert_to(v_definition,'UTF8'),'sha256'),'hex');
  IF v_hash<>'d406926884331948f7ca696f49cca0840777cc0f3657dade065acbf3e0f5ca3d' THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Q208 discovery query predecessor drifted';
  END IF;
  v_changed:=pg_catalog.replace(v_definition,
    $old$pg_catalog.coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object($old$,
    $new$COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object($new$);
  IF v_changed=v_definition
      OR pg_catalog.strpos(v_changed,'pg_catalog.coalesce(')<>0
      OR pg_catalog.strpos(v_changed,'COALESCE(pg_catalog.jsonb_agg(')=0 THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Q208 discovery query correction was not exact';
  END IF;
  EXECUTE v_changed;

  v_oid:=pg_catalog.to_regprocedure(
    'public.list_india_native_fiscal_documents(uuid,uuid,uuid,date,date,uuid,uuid,text,date,timestamp with time zone,uuid,integer)');
  v_definition:=pg_catalog.pg_get_functiondef(v_oid);
  v_hash:=pg_catalog.encode(public.digest(pg_catalog.convert_to(v_definition,'UTF8'),'sha256'),'hex');
  IF v_hash<>'5b706178c4a2f921d0ce229e7541c9138e03b57a08c1c4a03598d83eb211eaeb' THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Q208 document list query predecessor drifted';
  END IF;
  v_changed:=pg_catalog.replace(v_definition,
    $old$  RETURN QUERY
  WITH filtered AS MATERIALIZED ($old$,
    $new$  RETURN QUERY
  SELECT ordered.document_id,ordered.business_date,ordered.issued_at,
         ordered.summary,ordered.matching_count
    FROM (
  WITH filtered AS MATERIALIZED ($new$);
  v_changed:=pg_catalog.replace(v_changed,
    $old$      OR p_fetch_limit NOT BETWEEN 2 AND 101$old$,
    $new$      OR p_fetch_limit IS NULL OR p_fetch_limit NOT BETWEEN 2 AND 101$new$);
  v_changed:=pg_catalog.replace(v_changed,
    $old$    JOIN public.role_permission rp ON rp.role_id=ur.role_id AND rp.permission_code='tax-fiscal.documents:read'$old$,
    $new$    JOIN public.role role_row ON role_row.tenant_id=ur.tenant_id AND role_row.id=ur.role_id
    JOIN public.role_permission rp ON rp.role_id=role_row.id AND rp.permission_code='tax-fiscal.documents:read'$new$);
  v_changed:=pg_catalog.replace(v_changed,
    $old$  ) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='fiscal document read authority is unavailable';
  END IF;

  RETURN QUERY$old$,
    $new$  ) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='fiscal document read authority is unavailable';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.tax_assignment assignment
     WHERE assignment.tenant_id=p_tenant AND assignment.property_node=p_property
       AND assignment.jurisdiction_key='in-gst-lodging'
  ) THEN
    RAISE EXCEPTION USING ERRCODE='P2082',MESSAGE='fiscal document jurisdiction is unsupported';
  END IF;

  RETURN QUERY$new$);
  v_changed:=pg_catalog.replace(v_changed,
    $old$  ORDER BY business_date DESC NULLS LAST,issued_at DESC NULLS LAST,document_id DESC NULLS LAST;$old$,
    $new$  ) AS ordered(document_id,business_date,issued_at,summary,matching_count)
  ORDER BY ordered.business_date DESC NULLS LAST,ordered.issued_at DESC NULLS LAST,
           ordered.document_id DESC NULLS LAST;$new$);
  IF v_changed=v_definition
      OR pg_catalog.strpos(v_changed,'FROM ('||pg_catalog.chr(10)||'  WITH filtered AS MATERIALIZED')=0
      OR pg_catalog.strpos(v_changed,'p_fetch_limit IS NULL')=0
      OR pg_catalog.strpos(v_changed,'role_row.tenant_id=ur.tenant_id')=0
      OR pg_catalog.strpos(v_changed,$find$ERRCODE='P2082'$find$)=0
      OR pg_catalog.strpos(v_changed,
        'AS ordered(document_id,business_date,issued_at,summary,matching_count)')=0
      OR pg_catalog.strpos(v_changed,
        'ORDER BY business_date DESC NULLS LAST,issued_at DESC NULLS LAST,document_id DESC NULLS LAST')<>0 THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Q208 document list query correction was not exact';
  END IF;
  EXECUTE v_changed;

  v_oid:=pg_catalog.to_regprocedure(
    'public.read_india_native_fiscal_document(uuid,uuid,uuid,uuid)');
  v_definition:=pg_catalog.pg_get_functiondef(v_oid);
  v_hash:=pg_catalog.encode(public.digest(pg_catalog.convert_to(v_definition,'UTF8'),'sha256'),'hex');
  IF v_hash<>'db3b59a4b42825d5420f059948fe23542a8e59187a5ff37ee6d7646b795e03fc' THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Q208 document detail authority predecessor drifted';
  END IF;
  v_changed:=pg_catalog.replace(v_definition,
    $old$    JOIN public.role_permission rp ON rp.role_id=ur.role_id AND rp.permission_code='tax-fiscal.documents:read'$old$,
    $new$    JOIN public.role role_row ON role_row.tenant_id=ur.tenant_id AND role_row.id=ur.role_id
    JOIN public.role_permission rp ON rp.role_id=role_row.id AND rp.permission_code='tax-fiscal.documents:read'$new$);
  IF v_changed=v_definition OR pg_catalog.strpos(v_changed,'role_row.tenant_id=ur.tenant_id')=0 THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Q208 document detail authority correction was not exact';
  END IF;
  EXECUTE v_changed;

  v_oid:=pg_catalog.to_regprocedure(
    'public.read_india_fiscal_submission_delivery_receipt_by_document(uuid,uuid,uuid,uuid)');
  v_definition:=pg_catalog.pg_get_functiondef(v_oid);
  v_hash:=pg_catalog.encode(public.digest(pg_catalog.convert_to(v_definition,'UTF8'),'sha256'),'hex');
  IF v_hash<>'a5f690dc1e7983d911020999a250ed2d9acdd5a0f57587a46240ef6f13311cf0' THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Q208 receipt-by-document authority predecessor drifted';
  END IF;
  v_changed:=pg_catalog.replace(v_definition,
    $old$    JOIN public.role_permission rp ON rp.role_id=ur.role_id AND rp.permission_code='tax-fiscal.submissions:read'$old$,
    $new$    JOIN public.role role_row ON role_row.tenant_id=ur.tenant_id AND role_row.id=ur.role_id
    JOIN public.role_permission rp ON rp.role_id=role_row.id AND rp.permission_code='tax-fiscal.submissions:read'$new$);
  IF v_changed=v_definition OR pg_catalog.strpos(v_changed,'role_row.tenant_id=ur.tenant_id')=0 THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Q208 receipt-by-document authority correction was not exact';
  END IF;
  EXECUTE v_changed;

  v_oid:=pg_catalog.to_regprocedure(
    'public.list_india_fiscal_submission_provider_options(uuid,uuid,uuid)');
  v_definition:=pg_catalog.pg_get_functiondef(v_oid);
  v_hash:=pg_catalog.encode(public.digest(pg_catalog.convert_to(v_definition,'UTF8'),'sha256'),'hex');
  IF v_hash<>'0a5524b4c0e76dc54fc2ee0519e712f5030ea852cf8e0415da0efb5f020692b6' THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Q208 provider option authority predecessor drifted';
  END IF;
  v_changed:=pg_catalog.replace(v_definition,
    $old$    JOIN public.role_permission rp ON rp.role_id=ur.role_id AND rp.permission_code='tax-fiscal.submissions:request'$old$,
    $new$    JOIN public.role role_row ON role_row.tenant_id=ur.tenant_id AND role_row.id=ur.role_id
    JOIN public.role_permission rp ON rp.role_id=role_row.id AND rp.permission_code='tax-fiscal.submissions:request'$new$);
  IF v_changed=v_definition OR pg_catalog.strpos(v_changed,'role_row.tenant_id=ur.tenant_id')=0 THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Q208 provider option authority correction was not exact';
  END IF;
  EXECUTE v_changed;

  v_oid:=pg_catalog.to_regprocedure(
    'public.read_india_native_document_context_candidate(uuid,uuid,uuid,uuid,uuid,uuid)');
  v_definition:=pg_catalog.pg_get_functiondef(v_oid);
  v_hash:=pg_catalog.encode(public.digest(pg_catalog.convert_to(v_definition,'UTF8'),'sha256'),'hex');
  IF v_hash<>'5484a5f8ca81d04ef7ed85fcf27da8022f156553a1c7777fb041acc7dfe6b40d' THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Q208 document context predecessor drifted';
  END IF;
  v_changed:=pg_catalog.replace(v_definition,
    $old$SELECT public.india_native_source_hash(pg_catalog.jsonb_build_object($old$,
    $new$SELECT public.india_native_statutory_digest(pg_catalog.json_build_object($new$);
  v_changed:=pg_catalog.replace(v_changed,
    $old$'jurisdiction',pg_catalog.jsonb_build_object($old$,
    $new$'jurisdiction',pg_catalog.json_build_object($new$);
  IF v_changed=v_definition
      OR pg_catalog.strpos(v_changed,'india_native_source_hash(pg_catalog.jsonb_build_object')<>0
      OR pg_catalog.strpos(v_changed,'india_native_statutory_digest(pg_catalog.json_build_object')=0
      OR pg_catalog.strpos(v_changed,$find$'jurisdiction',pg_catalog.json_build_object$find$)=0 THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Q208 document context evidence correction was not exact';
  END IF;
  EXECUTE v_changed;

  v_oid:=pg_catalog.to_regprocedure(
    'public.compose_india_native_operator_confirmation_v1(uuid,uuid,uuid,uuid,uuid,text,jsonb,jsonb,text,text,jsonb,jsonb)');
  v_definition:=pg_catalog.pg_get_functiondef(v_oid);
  v_hash:=pg_catalog.encode(public.digest(pg_catalog.convert_to(v_definition,'UTF8'),'sha256'),'hex');
  IF v_hash<>'e722f8c13a55e788c22ed054ac7de93375c9f58f176fbfbfcfca047fb4eab63f' THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Q208 confirmation composer predecessor drifted';
  END IF;
  v_changed:=pg_catalog.replace(v_definition,
    $old$DECLARE v_prepared jsonb;v_nature jsonb;v_confirmation jsonb;v_hash text;$old$,
    $new$DECLARE v_prepared jsonb;v_nature jsonb;v_confirmation jsonb;v_hash text;
  v_buyer jsonb;v_component jsonb;v_levy jsonb;v_identity jsonb;v_quote jsonb;v_final jsonb;
  v_tax_preview jsonb;v_quote_stable jsonb;v_final_stable jsonb;v_quoted_stable jsonb;$new$);
  v_changed:=pg_catalog.replace(v_changed,
    $old$  BEGIN v_prepared:=p_prepared_source_json::jsonb;v_nature:=p_service_supply_nature_json::jsonb;
  EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='native operator confirmation source is invalid'; END;
  v_confirmation:=$old$,
    $new$  BEGIN
    v_prepared:=p_prepared_source_json::jsonb;v_nature:=p_service_supply_nature_json::jsonb;
    IF pg_catalog.jsonb_typeof(p_quoted_tax_composition) IS DISTINCT FROM 'object' OR
        (SELECT pg_catalog.array_agg(key ORDER BY key)
           FROM pg_catalog.jsonb_object_keys(p_quoted_tax_composition) key) IS DISTINCT FROM ARRAY[
          'componentFamilyCanonicalJson','finalTaxCanonicalJson','levyComponentIdentityCanonicalJson',
          'levyInputBundleCanonicalJson','quotedApplicabilityCanonicalJson','taxPreview']::text[] THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='native operator confirmation tax source is invalid';
    END IF;
    v_component:=(p_quoted_tax_composition->>'componentFamilyCanonicalJson')::jsonb;
    v_levy:=(p_quoted_tax_composition->>'levyInputBundleCanonicalJson')::jsonb;
    v_identity:=(p_quoted_tax_composition->>'levyComponentIdentityCanonicalJson')::jsonb;
    v_quote:=(p_quoted_tax_composition->>'quotedApplicabilityCanonicalJson')::jsonb;
    v_final:=(p_quoted_tax_composition->>'finalTaxCanonicalJson')::jsonb;
    v_tax_preview:=p_quoted_tax_composition->'taxPreview';
    v_buyer:=v_prepared->'recipientRegistration';
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='native operator confirmation source is invalid';
  END;
  IF pg_catalog.jsonb_typeof(v_buyer) IS DISTINCT FROM 'object'
      OR pg_catalog.jsonb_typeof(v_prepared->'placeOfSupply') IS DISTINCT FROM 'object'
      OR pg_catalog.jsonb_typeof(v_prepared#>'{placeOfSupply,recipient}') IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='native operator confirmation buyer structure is invalid';
  END IF;
  IF (SELECT pg_catalog.array_agg(key ORDER BY key) FROM pg_catalog.jsonb_object_keys(v_buyer) key)
         IS DISTINCT FROM ARRAY['addressLine1','evidenceHash','gstin','legalName','locality','partyId','pin',
           'registrationId','scheme','stateCode','tradeName']::text[]
      OR v_buyer->>'registrationId' IS DISTINCT FROM p_recipient_registration::text
      OR v_buyer->>'partyId' IS DISTINCT FROM v_prepared->>'legalBuyerPartyId'
      OR v_buyer->>'partyId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      OR pg_catalog.jsonb_typeof(v_buyer->'gstin') IS DISTINCT FROM 'string'
      OR pg_catalog.jsonb_typeof(v_buyer->'stateCode') IS DISTINCT FROM 'string'
      OR pg_catalog.jsonb_typeof(v_buyer->'pin') IS DISTINCT FROM 'string'
      OR pg_catalog.jsonb_typeof(v_buyer->'evidenceHash') IS DISTINCT FROM 'string'
      OR pg_catalog.jsonb_typeof(v_buyer->'legalName') IS DISTINCT FROM 'string'
      OR pg_catalog.jsonb_typeof(v_buyer->'addressLine1') IS DISTINCT FROM 'string'
      OR pg_catalog.jsonb_typeof(v_buyer->'locality') IS DISTINCT FROM 'string'
      OR v_buyer->>'scheme' IS DISTINCT FROM 'in-gstin'
      OR v_buyer->>'gstin' !~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'
      OR v_buyer->>'stateCode' !~ '^[0-9]{2}$'
      OR v_buyer->>'pin' !~ '^[1-9][0-9]{5}$'
      OR v_buyer->>'evidenceHash' !~ '^[0-9a-f]{64}$'
      OR pg_catalog.btrim(v_buyer->>'legalName')=''
      OR pg_catalog.char_length(v_buyer->>'legalName')>100
      OR pg_catalog.btrim(v_buyer->>'addressLine1')=''
      OR pg_catalog.char_length(v_buyer->>'addressLine1')>100
      OR pg_catalog.btrim(v_buyer->>'locality')=''
      OR pg_catalog.char_length(v_buyer->>'locality')>50
      OR pg_catalog.jsonb_typeof(v_buyer->'tradeName') NOT IN ('string','null')
      OR (pg_catalog.jsonb_typeof(v_buyer->'tradeName')='string'
          AND (pg_catalog.btrim(v_buyer->>'tradeName')='' OR pg_catalog.char_length(v_buyer->>'tradeName')>100))
      OR v_prepared#>>'{placeOfSupply,recipient,registrationId}' IS DISTINCT FROM v_buyer->>'registrationId'
      OR v_prepared#>>'{placeOfSupply,recipient,partyId}' IS DISTINCT FROM v_buyer->>'partyId'
      OR v_prepared#>>'{placeOfSupply,recipient,evidenceHash}' IS DISTINCT FROM v_buyer->>'evidenceHash' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='native operator confirmation buyer is invalid';
  END IF;
  IF pg_catalog.jsonb_typeof(v_component) IS DISTINCT FROM 'object'
      OR pg_catalog.jsonb_typeof(v_levy) IS DISTINCT FROM 'object'
      OR pg_catalog.jsonb_typeof(v_identity) IS DISTINCT FROM 'object'
      OR pg_catalog.jsonb_typeof(v_quote) IS DISTINCT FROM 'object'
      OR pg_catalog.jsonb_typeof(v_final) IS DISTINCT FROM 'object'
      OR pg_catalog.jsonb_typeof(v_tax_preview) IS DISTINCT FROM 'object'
      OR (SELECT pg_catalog.array_agg(key ORDER BY key) FROM pg_catalog.jsonb_object_keys(v_component) key)
         IS DISTINCT FROM ARRAY['componentFamily','determinationBasis','evidenceHash','folioId','jurisdiction',
           'legalSources','placeOfSupplyStateCode','predecessorCandidateHash','propertyNode','reservationId',
           'sezDirection','supplierRegistrationId','supplyDate','supplyNature']::text[]
      OR (SELECT pg_catalog.array_agg(key ORDER BY key) FROM pg_catalog.jsonb_object_keys(v_levy) key)
         IS DISTINCT FROM ARRAY['componentFamily','evidenceHash','folioId','gstRoomSlabs','legalSources',
           'predecessorHashes','propertyNode','reservationId','selectedVersion','supplyDate']::text[]
      OR (SELECT pg_catalog.array_agg(key ORDER BY key) FROM pg_catalog.jsonb_object_keys(v_identity) key)
         IS DISTINCT FROM ARRAY['componentFamily','componentIdentities','evidenceHash','folioId','gstRoomSlabs',
           'legalSources','predecessorHashes','propertyNode','readiness','reservationId','selectedVersion','supplyDate']::text[]
      OR (SELECT pg_catalog.array_agg(key ORDER BY key) FROM pg_catalog.jsonb_object_keys(v_quote) key)
         IS DISTINCT FROM ARRAY['components','evidenceHash','kind','nativeTiming','predecessorHashes',
           'rateSelection','reservationLineage']::text[]
      OR (SELECT pg_catalog.array_agg(key ORDER BY key) FROM pg_catalog.jsonb_object_keys(v_final) key)
         IS DISTINCT FROM ARRAY['evidenceHash','generation','grandTotalMinor','kind','nativeTimingId',
           'predecessorHashes','rateSelectionKind','roomNights','taxMinor','valuationId']::text[]
      OR (SELECT pg_catalog.array_agg(key ORDER BY key) FROM pg_catalog.jsonb_object_keys(v_tax_preview) key)
         IS DISTINCT FROM ARRAY['componentAmountsMinor','componentFamily','componentIdentities','generation',
           'grandTotalMinor','nativeConsiderationBasisHash','persistenceRoomNights','roomNights',
           'roomNightsCanonicalJson','selectedContentHash','selectedExtensionId','selectedExtensionVersion',
           'taxMinor','transactionValueMinor','valuationEvidenceHash','valuationId']::text[] THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='native operator confirmation tax structure is invalid';
  END IF;
  IF v_quote->>'kind' IS DISTINCT FROM 'native_current_transaction'
      OR pg_catalog.jsonb_typeof(v_quote->'rateSelection') IS DISTINCT FROM 'object'
      OR pg_catalog.jsonb_typeof(v_quote->'reservationLineage') IS DISTINCT FROM 'object'
      OR pg_catalog.jsonb_typeof(v_quote->'components') IS DISTINCT FROM 'array'
      OR pg_catalog.jsonb_array_length(v_quote->'components')=0
      OR pg_catalog.jsonb_typeof(v_quote->'nativeTiming') IS DISTINCT FROM 'object'
      OR pg_catalog.jsonb_typeof(v_quote->'predecessorHashes') IS DISTINCT FROM 'object'
      OR (SELECT pg_catalog.array_agg(key ORDER BY key) FROM pg_catalog.jsonb_object_keys(v_quote->'rateSelection') key)
         IS DISTINCT FROM ARRAY['kind','selectedVersion','timeOfSupplyDate']::text[]
      OR (SELECT pg_catalog.array_agg(key ORDER BY key) FROM pg_catalog.jsonb_object_keys(v_quote->'reservationLineage') key)
         IS DISTINCT FROM ARRAY['attributionId','currency','folioId','holdBindingId','lineageId','originQuoteHash',
           'reservationId','segmentId','snapshotHash']::text[]
      OR (SELECT pg_catalog.array_agg(key ORDER BY key) FROM pg_catalog.jsonb_object_keys(v_quote->'nativeTiming') key)
         IS DISTINCT FROM ARRAY['branch','evidenceHash','invoiceIssueDate','nativeTimingId','ordinaryRegimeEvidenceId',
           'paymentReceiptSnapshotId','prospectiveDocumentId','serviceProvisionSnapshotId','timeOfSupplyDate']::text[]
      OR (SELECT pg_catalog.array_agg(key ORDER BY key) FROM pg_catalog.jsonb_object_keys(v_quote->'predecessorHashes') key)
         IS DISTINCT FROM ARRAY['attributionSnapshot','levyComponentIdentity','nativeInvoiceSource','nativeTiming',
           'ordinaryRegimeRecording','paymentReceiptProjection','paymentReceiptRecording','rateSource',
           'reservationLineage','serviceProvisionProjection','serviceProvisionRecording']::text[]
      OR EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(v_quote->'components') item
          WHERE CASE WHEN pg_catalog.jsonb_typeof(item)='object' THEN
            (SELECT pg_catalog.array_agg(key ORDER BY key) FROM pg_catalog.jsonb_object_keys(item) key)
              IS DISTINCT FROM ARRAY['businessDate','ordinal','quotedAmountMinor','slab']::text[] ELSE true END)
      OR EXISTS(SELECT 1 FROM pg_catalog.jsonb_each_text(v_quote->'predecessorHashes') entry
          WHERE entry.value IS NULL OR entry.value!~'^[0-9a-f]{64}$') THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='native operator confirmation quote structure is invalid';
  END IF;
  IF v_final->>'kind' IS DISTINCT FROM 'native_current_transaction'
      OR pg_catalog.jsonb_typeof(v_final->'roomNights') IS DISTINCT FROM 'array'
      OR pg_catalog.jsonb_array_length(v_final->'roomNights')=0
      OR pg_catalog.jsonb_typeof(v_final->'predecessorHashes') IS DISTINCT FROM 'object'
      OR (SELECT pg_catalog.array_agg(key ORDER BY key) FROM pg_catalog.jsonb_object_keys(v_final->'predecessorHashes') key)
         IS DISTINCT FROM ARRAY['attributionSnapshot','finalValuation','levyComponentIdentity','nativeConsiderationBasis',
           'nativeInvoiceSource','nativeTiming','ordinaryRegimeRecording','paymentReceiptProjection',
           'paymentReceiptRecording','quotedRateApplicability','rateSource','reservationLineage',
           'serviceProvisionProjection','serviceProvisionRecording']::text[]
      OR EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(v_final->'roomNights') item
          WHERE CASE WHEN pg_catalog.jsonb_typeof(item)='object' THEN
            (SELECT pg_catalog.array_agg(key ORDER BY key) FROM pg_catalog.jsonb_object_keys(item) key)
              IS DISTINCT FROM ARRAY['businessDate','ordinal','slab','taxMinor','transactionValueMinor']::text[] ELSE true END)
      OR EXISTS(SELECT 1 FROM pg_catalog.jsonb_each_text(v_final->'predecessorHashes') entry
          WHERE entry.value IS NULL OR entry.value!~'^[0-9a-f]{64}$') THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='native operator confirmation final-tax structure is invalid';
  END IF;
  v_quote_stable:=pg_catalog.jsonb_build_object(
    'kind',v_quote->'kind','rateSelection',v_quote->'rateSelection',
    'reservationLineage',v_quote->'reservationLineage','components',v_quote->'components',
    'predecessorHashes',pg_catalog.jsonb_build_object(
      'attributionSnapshot',v_quote#>'{predecessorHashes,attributionSnapshot}',
      'levyComponentIdentity',v_quote#>'{predecessorHashes,levyComponentIdentity}',
      'ordinaryRegimeRecording',v_quote#>'{predecessorHashes,ordinaryRegimeRecording}',
      'paymentReceiptProjection',v_quote#>'{predecessorHashes,paymentReceiptProjection}',
      'paymentReceiptRecording',v_quote#>'{predecessorHashes,paymentReceiptRecording}',
      'reservationLineage',v_quote#>'{predecessorHashes,reservationLineage}',
      'serviceProvisionProjection',v_quote#>'{predecessorHashes,serviceProvisionProjection}',
      'serviceProvisionRecording',v_quote#>'{predecessorHashes,serviceProvisionRecording}'));
  v_final_stable:=pg_catalog.jsonb_build_object(
    'kind',v_final->'kind','valuationId',v_final->'valuationId','generation',v_final->'generation',
    'rateSelectionKind',v_final->'rateSelectionKind','roomNights',v_final->'roomNights',
    'taxMinor',v_final->'taxMinor','grandTotalMinor',v_final->'grandTotalMinor',
    'predecessorHashes',pg_catalog.jsonb_build_object(
      'attributionSnapshot',v_final#>'{predecessorHashes,attributionSnapshot}',
      'finalValuation',v_final#>'{predecessorHashes,finalValuation}',
      'levyComponentIdentity',v_final#>'{predecessorHashes,levyComponentIdentity}',
      'nativeConsiderationBasis',v_final#>'{predecessorHashes,nativeConsiderationBasis}',
      'ordinaryRegimeRecording',v_final#>'{predecessorHashes,ordinaryRegimeRecording}',
      'paymentReceiptProjection',v_final#>'{predecessorHashes,paymentReceiptProjection}',
      'paymentReceiptRecording',v_final#>'{predecessorHashes,paymentReceiptRecording}',
      'reservationLineage',v_final#>'{predecessorHashes,reservationLineage}',
      'serviceProvisionProjection',v_final#>'{predecessorHashes,serviceProvisionProjection}',
      'serviceProvisionRecording',v_final#>'{predecessorHashes,serviceProvisionRecording}'));
  v_quoted_stable:=pg_catalog.jsonb_build_object(
    'componentFamilyCanonicalJson',p_quoted_tax_composition->'componentFamilyCanonicalJson',
    'levyInputBundleCanonicalJson',p_quoted_tax_composition->'levyInputBundleCanonicalJson',
    'levyComponentIdentityCanonicalJson',p_quoted_tax_composition->'levyComponentIdentityCanonicalJson',
    'quotedApplicabilityCanonicalJson',v_quote_stable::text,
    'finalTaxCanonicalJson',v_final_stable::text,
    'taxPreview',v_tax_preview);
  v_confirmation:=$new$);
  v_changed:=pg_catalog.replace(v_changed,
    $old$    'buyer',v_prepared->'buyerDetails','seller',v_prepared->'sellerRegistration',$old$,
    $new$    'buyer',v_buyer,'seller',v_prepared->'sellerRegistration',$new$);
  v_changed:=pg_catalog.replace(v_changed,
    $old$    'quotedTaxComposition',p_quoted_tax_composition,$old$,
    $new$    'quotedTaxComposition',v_quoted_stable,$new$);
  v_changed:=pg_catalog.replace(v_changed,
    $old$      'selectedExtensionContentHash',p_quoted_tax_composition#>'{taxPreview,selectedExtensionContentHash}')$old$,
    $new$      'selectedExtensionContentHash',v_tax_preview->'selectedContentHash')$new$);
  IF v_changed=v_definition
      OR pg_catalog.strpos(v_changed,'v_quote_stable:=')=0
      OR pg_catalog.strpos(v_changed,$find$'buyer',v_prepared->'buyerDetails'$find$)<>0
      OR pg_catalog.strpos(v_changed,$find$'buyer',v_buyer$find$)=0
      OR pg_catalog.strpos(v_changed,$find$'quotedTaxComposition',p_quoted_tax_composition$find$)<>0
      OR pg_catalog.strpos(v_changed,$find$'{taxPreview,selectedExtensionContentHash}'$find$)<>0 THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Q208 confirmation projection correction was not exact';
  END IF;
  EXECUTE v_changed;
END
$q208_84_repair$;

DO $q208_84_postconditions$
DECLARE v_signature text;v_oid oid;v_source text;
BEGIN
  FOREACH v_signature IN ARRAY ARRAY[
    'public.list_india_native_fiscal_documents(uuid,uuid,uuid,date,date,uuid,uuid,text,date,timestamp with time zone,uuid,integer)',
    'public.read_india_native_fiscal_document(uuid,uuid,uuid,uuid)',
    'public.discover_india_native_fiscal_issue(uuid,uuid,uuid,uuid,uuid,uuid,text,text,date,date[],text[])',
    'public.read_india_fiscal_submission_delivery_receipt_by_document(uuid,uuid,uuid,uuid)',
    'public.list_india_fiscal_submission_provider_options(uuid,uuid,uuid)'
  ] LOOP
    v_oid:=pg_catalog.to_regprocedure(v_signature);
    IF v_oid IS NULL
        OR (SELECT owner.rolname FROM pg_catalog.pg_proc function_row
            JOIN pg_catalog.pg_roles owner ON owner.oid=function_row.proowner
            WHERE function_row.oid=v_oid)<>'yellow_owner'
        OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc function_row
            WHERE function_row.oid=v_oid
              AND function_row.proconfig @> ARRAY['TimeZone=UTC']
              AND function_row.proconfig && ARRAY[
                'search_path=pg_catalog, public','search_path=pg_catalog, public, pg_temp'])
        OR NOT pg_catalog.has_function_privilege('app_role',v_oid,'EXECUTE')
        OR pg_catalog.has_function_privilege('yellow_runtime',v_oid,'EXECUTE')
        OR pg_catalog.has_function_privilege('public',v_oid,'EXECUTE') THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Q208 corrected query capability authority is malformed';
    END IF;
  END LOOP;
  v_source:=pg_catalog.pg_get_functiondef(pg_catalog.to_regprocedure(
    'public.discover_india_native_fiscal_issue(uuid,uuid,uuid,uuid,uuid,uuid,text,text,date,date[],text[])'));
  IF pg_catalog.strpos(v_source,'pg_catalog.coalesce(')<>0
      OR pg_catalog.strpos(v_source,'COALESCE(pg_catalog.jsonb_agg(')=0 THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Q208 corrected discovery query is malformed';
  END IF;
  v_source:=pg_catalog.pg_get_functiondef(pg_catalog.to_regprocedure(
    'public.list_india_native_fiscal_documents(uuid,uuid,uuid,date,date,uuid,uuid,text,date,timestamp with time zone,uuid,integer)'));
  IF pg_catalog.strpos(v_source,
       'AS ordered(document_id,business_date,issued_at,summary,matching_count)')=0
      OR pg_catalog.strpos(v_source,
       'ORDER BY ordered.business_date DESC NULLS LAST,ordered.issued_at DESC NULLS LAST')=0
      OR pg_catalog.strpos(v_source,'p_fetch_limit IS NULL')=0
      OR pg_catalog.strpos(v_source,$find$ERRCODE='P2082'$find$)=0 THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Q208 corrected document list query is malformed';
  END IF;
  v_source:=pg_catalog.pg_get_functiondef(pg_catalog.to_regprocedure(
    'public.read_india_native_document_context_candidate(uuid,uuid,uuid,uuid,uuid,uuid)'));
  IF pg_catalog.strpos(v_source,'india_native_statutory_digest(pg_catalog.json_build_object')=0
      OR (SELECT owner.rolname FROM pg_catalog.pg_proc function_row
          JOIN pg_catalog.pg_roles owner ON owner.oid=function_row.proowner
          WHERE function_row.oid=pg_catalog.to_regprocedure(
            'public.read_india_native_document_context_candidate(uuid,uuid,uuid,uuid,uuid,uuid)'))<>'yellow_owner'
      OR pg_catalog.has_function_privilege('app_role',
        'public.read_india_native_document_context_candidate(uuid,uuid,uuid,uuid,uuid,uuid)','EXECUTE')
      OR pg_catalog.has_function_privilege('yellow_runtime',
        'public.read_india_native_document_context_candidate(uuid,uuid,uuid,uuid,uuid,uuid)','EXECUTE')
      OR pg_catalog.has_function_privilege('public',
        'public.read_india_native_document_context_candidate(uuid,uuid,uuid,uuid,uuid,uuid)','EXECUTE') THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Q208 corrected document context authority is malformed';
  END IF;
  v_oid:=pg_catalog.to_regprocedure(
    'public.compose_india_native_operator_confirmation_v1(uuid,uuid,uuid,uuid,uuid,text,jsonb,jsonb,text,text,jsonb,jsonb)');
  v_source:=pg_catalog.pg_get_functiondef(v_oid);
  IF v_oid IS NULL
      OR pg_catalog.strpos(v_source,'v_quote_stable:=')=0
      OR pg_catalog.strpos(v_source,$find$'buyer',v_buyer$find$)=0
      OR pg_catalog.strpos(v_source,$find$'buyer',v_prepared->'buyerDetails'$find$)<>0
      OR pg_catalog.strpos(v_source,$find$'quotedTaxComposition',v_quoted_stable$find$)=0
      OR pg_catalog.strpos(v_source,$find$'selectedExtensionContentHash',v_tax_preview->'selectedContentHash'$find$)=0
      OR pg_catalog.strpos(v_source,$find$'{taxPreview,selectedExtensionContentHash}'$find$)<>0
      OR (SELECT owner.rolname FROM pg_catalog.pg_proc function_row
          JOIN pg_catalog.pg_roles owner ON owner.oid=function_row.proowner
          WHERE function_row.oid=v_oid)<>'yellow_owner'
      OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc function_row
          WHERE function_row.oid=v_oid
            AND function_row.proconfig @> ARRAY['TimeZone=UTC','DateStyle=ISO,YMD']
            AND function_row.proconfig && ARRAY[
              'search_path=pg_catalog, public','search_path=pg_catalog, public, pg_temp'])
      OR pg_catalog.has_function_privilege('app_role',v_oid,'EXECUTE')
      OR pg_catalog.has_function_privilege('yellow_runtime',v_oid,'EXECUTE')
      OR pg_catalog.has_function_privilege('public',v_oid,'EXECUTE') THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Q208 corrected confirmation composer authority is malformed';
  END IF;
END
$q208_84_postconditions$;

RESET ROLE;
