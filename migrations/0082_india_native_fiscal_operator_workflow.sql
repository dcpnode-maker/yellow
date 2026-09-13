-- Order440/Q208: owner-mediated India native invoice workflow and confirmed issue.
-- Forward-only from canonical81. Existing v2 preparation/commit remain unchanged.

DO $q208_preconditions$
BEGIN
  IF (SELECT pg_catalog.max(version) FROM public.schema_migration) IS DISTINCT FROM 81
     OR NOT EXISTS (
       SELECT 1 FROM public.schema_migration
        WHERE version=81 AND filename='0081_fiscal_signed_delivery_receipts.sql'
          AND pg_catalog.btrim(checksum_sha256)='d2e4e34a4587f4ee12ed5c43f8fac9d4186345877bdbb75ac74217460f0e06ac'
     ) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Q208 requires exact canonical81';
  END IF;
  IF pg_catalog.to_regprocedure(
       'public.list_india_native_fiscal_documents(uuid,uuid,uuid,date,date,uuid,uuid,text,date,timestamp with time zone,uuid,integer)') IS NOT NULL
     OR EXISTS (SELECT 1 FROM public.permission WHERE code='tax-fiscal.documents:read') THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Q208 operator invoice capability is already present';
  END IF;
END
$q208_preconditions$;

SET ROLE yellow_owner;

INSERT INTO public.permission(code,description) VALUES
  ('tax-fiscal.documents:read','Read property-authorized immutable fiscal documents')
ON CONFLICT(code) DO UPDATE SET description=EXCLUDED.description;

CREATE INDEX india_native_operator_document_queue
  ON public.document(tenant_id,property_node,business_date DESC,issued_at DESC,id DESC)
  WHERE kind='invoice' AND status='issued';

CREATE INDEX india_native_operator_submission_document
  ON public.fiscal_submission(tenant_id,property_node,document_id,id);

CREATE FUNCTION public.list_india_native_fiscal_documents(
  p_tenant uuid,p_property uuid,p_actor uuid,
  p_issued_from date,p_issued_before date,p_reservation uuid,p_folio uuid,
  p_query text,p_after_business_date date,p_after_issued_at timestamptz,
  p_after_document uuid,p_fetch_limit integer
) RETURNS TABLE(document_id uuid,business_date date,issued_at timestamptz,
    summary jsonb,matching_count bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public SET timezone='UTC' SET datestyle='ISO,YMD' AS $$
DECLARE v_context uuid;v_property_path ltree;v_query text;
BEGIN
  BEGIN v_context:=NULLIF(pg_catalog.current_setting('app.tenant_id',true),'')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='fiscal document read tenant context is invalid'; END;
  IF session_user<>'yellow_runtime' OR current_user<>'yellow_owner'
      OR pg_catalog.current_setting('role',true) IS DISTINCT FROM 'app_role'
      OR p_tenant IS NULL OR v_context IS DISTINCT FROM p_tenant THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='fiscal document read authority is unavailable';
  END IF;
  IF p_property IS NULL OR p_actor IS NULL OR p_issued_from IS NULL OR p_issued_before IS NULL
      OR NOT pg_catalog.isfinite(p_issued_from) OR NOT pg_catalog.isfinite(p_issued_before)
      OR p_issued_before<=p_issued_from OR p_issued_before-p_issued_from>366
      OR p_fetch_limit NOT BETWEEN 2 AND 101
      OR pg_catalog.num_nonnulls(p_after_business_date,p_after_issued_at,p_after_document) NOT IN (0,3) THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='fiscal document list input is invalid';
  END IF;
  v_query:=NULLIF(pg_catalog.btrim(p_query),'');
  IF v_query IS NOT NULL AND (pg_catalog.char_length(v_query)>240
      OR v_query~'[[:cntrl:]]') THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='fiscal document query is invalid';
  END IF;
  SELECT property.path INTO v_property_path FROM public.org_node property
   WHERE property.tenant_id=p_tenant AND property.id=p_property AND property.kind='property';
  IF NOT FOUND OR NOT EXISTS (
    SELECT 1 FROM public.tenant tenant
    JOIN public.app_user actor ON actor.tenant_id=tenant.id AND actor.id=p_actor AND actor.status='active'
    JOIN public.user_role ur ON ur.tenant_id=actor.tenant_id AND ur.user_id=actor.id
    JOIN public.role_permission rp ON rp.role_id=ur.role_id AND rp.permission_code='tax-fiscal.documents:read'
    JOIN public.org_node grant_node ON grant_node.tenant_id=ur.tenant_id AND grant_node.id=ur.scope_node
    WHERE tenant.id=p_tenant AND tenant.status='active' AND grant_node.path @> v_property_path
  ) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='fiscal document read authority is unavailable';
  END IF;

  RETURN QUERY
  WITH filtered AS MATERIALIZED (
    SELECT document.id,document.business_date,document.issued_at,document.doc_no,
           origin.reservation_id,origin.folio_id,origin.recipient_registration_id,
           document.content,tax.transaction_value_minor,tax.tax_minor,tax.grand_total_minor
      FROM public.document document
      JOIN public.india_gst_native_fiscal_document_origin origin
        ON origin.tenant_id=document.tenant_id AND origin.document_id=document.id
       AND origin.property_node=p_property AND origin.document_kind='invoice'
      JOIN public.india_gst_native_invoice_timing timing
        ON timing.tenant_id=origin.tenant_id AND timing.id=origin.native_timing_id
       AND timing.prospective_document_id=document.id
      JOIN public.india_gst_accommodation_final_component_tax tax
        ON tax.tenant_id=timing.tenant_id AND tax.id=timing.tax_id
     WHERE document.tenant_id=p_tenant AND document.property_node=p_property
       AND document.kind='invoice' AND document.status='issued'
       AND document.business_date>=p_issued_from AND document.business_date<p_issued_before
       AND (p_reservation IS NULL OR origin.reservation_id=p_reservation)
       AND (p_folio IS NULL OR origin.folio_id=p_folio)
       AND (v_query IS NULL OR document.doc_no ILIKE '%'||v_query||'%'
         OR document.content#>>'{BuyerDtls,LglNm}' ILIKE '%'||v_query||'%'
         OR document.content#>>'{BuyerDtls,Gstin}' ILIKE '%'||v_query||'%')
  ), counted AS MATERIALIZED (
    SELECT pg_catalog.count(*)::bigint AS total FROM filtered
  ), page AS MATERIALIZED (
    SELECT * FROM filtered
     WHERE p_after_document IS NULL
        OR (business_date,issued_at,id)<(p_after_business_date,p_after_issued_at,p_after_document)
     ORDER BY business_date DESC,issued_at DESC,id DESC LIMIT p_fetch_limit
  )
  SELECT page.id,page.business_date,page.issued_at,
    pg_catalog.jsonb_build_object(
      'documentId',page.id,'documentNumber',page.doc_no,
      'businessDate',page.business_date::text,
      'issuedAt',pg_catalog.to_char(page.issued_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
      'reservationId',page.reservation_id,'folioId',page.folio_id,
      'recipientRegistrationId',page.recipient_registration_id,
      'buyerName',page.content#>>'{BuyerDtls,LglNm}',
      'buyerGstin',page.content#>>'{BuyerDtls,Gstin}','currency','INR',
      'taxableMinor',page.transaction_value_minor::text,'taxMinor',page.tax_minor::text,
      'totalMinor',page.grand_total_minor::text),counted.total
    FROM page CROSS JOIN counted
  UNION ALL
  SELECT NULL::uuid,NULL::date,NULL::timestamptz,NULL::jsonb,counted.total
    FROM counted WHERE NOT EXISTS(SELECT 1 FROM page)
  ORDER BY business_date DESC NULLS LAST,issued_at DESC NULLS LAST,document_id DESC NULLS LAST;
END;
$$;

CREATE FUNCTION public.read_india_native_fiscal_document(
  p_tenant uuid,p_property uuid,p_document uuid,p_actor uuid
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public SET timezone='UTC' SET datestyle='ISO,YMD' AS $$
DECLARE v_context uuid;v_result jsonb;v_content text;v_hash text;
BEGIN
  BEGIN v_context:=NULLIF(pg_catalog.current_setting('app.tenant_id',true),'')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='fiscal document read tenant context is invalid'; END;
  IF session_user<>'yellow_runtime' OR current_user<>'yellow_owner'
      OR pg_catalog.current_setting('role',true) IS DISTINCT FROM 'app_role'
      OR p_tenant IS NULL OR v_context IS DISTINCT FROM p_tenant
      OR p_property IS NULL OR p_document IS NULL OR p_actor IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='fiscal document read authority is unavailable';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.tenant tenant
    JOIN public.app_user actor ON actor.tenant_id=tenant.id AND actor.id=p_actor AND actor.status='active'
    JOIN public.user_role ur ON ur.tenant_id=actor.tenant_id AND ur.user_id=actor.id
    JOIN public.role_permission rp ON rp.role_id=ur.role_id AND rp.permission_code='tax-fiscal.documents:read'
    JOIN public.org_node grant_node ON grant_node.tenant_id=ur.tenant_id AND grant_node.id=ur.scope_node
    JOIN public.org_node property ON property.tenant_id=tenant.id AND property.id=p_property
      AND property.kind='property' AND grant_node.path @> property.path
    WHERE tenant.id=p_tenant AND tenant.status='active') THEN RETURN NULL; END IF;
  SELECT document.content::text,document.sha256,
    pg_catalog.jsonb_build_object('kind','india_native_invoice_v1','documentId',document.id,
      'propertyNode',document.property_node,'reservationId',origin.reservation_id,
      'folioId',origin.folio_id,'seriesId',document.series_id,'documentNumber',document.doc_no,
      'businessDate',document.business_date::text,
      'issuedAt',pg_catalog.to_char(document.issued_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
      'recipientRegistrationId',origin.recipient_registration_id,
      'sourceEvidenceHash',origin.source_evidence_hash,'documentSha256',document.sha256,
      'previousHash',document.prev_hash,'contentJson',document.content::text)
    INTO v_content,v_hash,v_result
    FROM public.document document
    JOIN public.india_gst_native_fiscal_document_origin origin
      ON origin.tenant_id=document.tenant_id AND origin.document_id=document.id
   WHERE document.tenant_id=p_tenant AND document.property_node=p_property
     AND document.id=p_document AND document.kind='invoice' AND document.status='issued'
     AND document.issued_at IS NOT NULL AND document.business_date=origin.issue_date;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF v_hash IS NULL OR v_hash!~'^[0-9a-f]{64}$'
      OR pg_catalog.encode(public.digest(pg_catalog.convert_to(v_content,'UTF8'),'sha256'),'hex')<>v_hash THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='stored fiscal document authentication failed';
  END IF;
  RETURN v_result;
END;
$$;

CREATE FUNCTION public.read_india_fiscal_submission_delivery_receipt_by_document(
  p_tenant uuid,p_property uuid,p_document uuid,p_actor uuid
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp SET timezone='UTC' AS $$
DECLARE v_context uuid;v_count integer;v_submission uuid;v_delivery_version integer;v_receipt jsonb;
BEGIN
  BEGIN v_context:=NULLIF(pg_catalog.current_setting('app.tenant_id',true),'')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='fiscal receipt tenant context is invalid'; END;
  IF session_user<>'yellow_runtime' OR current_user<>'yellow_owner'
      OR pg_catalog.current_setting('role',true) IS DISTINCT FROM 'app_role'
      OR p_tenant IS NULL OR v_context IS DISTINCT FROM p_tenant
      OR p_property IS NULL OR p_document IS NULL OR p_actor IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='fiscal receipt authority is unavailable';
  END IF;
  -- Existing receipt capability remains the sole authorization oracle.
  IF NOT EXISTS (
    SELECT 1 FROM public.tenant tenant
    JOIN public.app_user actor ON actor.tenant_id=tenant.id AND actor.id=p_actor AND actor.status='active'
    JOIN public.user_role ur ON ur.tenant_id=actor.tenant_id AND ur.user_id=actor.id
    JOIN public.role_permission rp ON rp.role_id=ur.role_id AND rp.permission_code='tax-fiscal.submissions:read'
    JOIN public.org_node grant_node ON grant_node.tenant_id=ur.tenant_id AND grant_node.id=ur.scope_node
    JOIN public.org_node property ON property.tenant_id=tenant.id AND property.id=p_property
      AND property.kind='property' AND grant_node.path @> property.path
    WHERE tenant.id=p_tenant AND tenant.status='active') THEN RETURN NULL; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.document document
      JOIN public.india_gst_native_fiscal_document_origin origin
        ON origin.tenant_id=document.tenant_id AND origin.document_id=document.id
     WHERE document.tenant_id=p_tenant AND document.property_node=p_property
       AND document.id=p_document AND document.status='issued') THEN RETURN NULL; END IF;
  SELECT pg_catalog.count(*)::integer,pg_catalog.min(id),pg_catalog.min(delivery_version)
    INTO v_count,v_submission,v_delivery_version FROM public.fiscal_submission
   WHERE tenant_id=p_tenant AND property_node=p_property AND document_id=p_document;
  IF v_count=0 THEN RETURN pg_catalog.jsonb_build_object('kind','not_requested','documentId',p_document); END IF;
  IF v_count>1 THEN RETURN pg_catalog.jsonb_build_object('kind','ambiguous','documentId',p_document); END IF;
  IF v_delivery_version<>1 THEN
    RETURN pg_catalog.jsonb_build_object('kind','legacy_unsupported','documentId',p_document,'submissionId',v_submission);
  END IF;
  v_receipt:=public.read_india_fiscal_submission_delivery_receipt(p_tenant,p_property,v_submission,p_actor);
  IF v_receipt IS NULL THEN RETURN NULL; END IF;
  RETURN pg_catalog.jsonb_build_object('kind','receipt','documentId',p_document,'receipt',v_receipt);
END;
$$;

CREATE FUNCTION public.list_india_fiscal_submission_provider_options(
  p_tenant uuid,p_property uuid,p_actor uuid
) RETURNS TABLE(extension_id uuid,extension_version integer,provider_key text,label text)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp SET timezone='UTC' AS $$
DECLARE v_context uuid;
BEGIN
  BEGIN v_context:=NULLIF(pg_catalog.current_setting('app.tenant_id',true),'')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='fiscal provider option tenant context is invalid'; END;
  IF session_user<>'yellow_runtime' OR current_user<>'yellow_owner'
      OR pg_catalog.current_setting('role',true) IS DISTINCT FROM 'app_role'
      OR p_tenant IS NULL OR v_context IS DISTINCT FROM p_tenant
      OR p_property IS NULL OR p_actor IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='fiscal provider option authority is unavailable';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.tenant tenant
    JOIN public.app_user actor ON actor.tenant_id=tenant.id AND actor.id=p_actor AND actor.status='active'
    JOIN public.user_role ur ON ur.tenant_id=actor.tenant_id AND ur.user_id=actor.id
    JOIN public.role_permission rp ON rp.role_id=ur.role_id AND rp.permission_code='tax-fiscal.submissions:request'
    JOIN public.org_node grant_node ON grant_node.tenant_id=ur.tenant_id AND grant_node.id=ur.scope_node
    JOIN public.org_node property ON property.tenant_id=tenant.id AND property.id=p_property
      AND property.kind='property' AND grant_node.path @> property.path
    WHERE tenant.id=p_tenant AND tenant.status='active') THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='fiscal provider option authority is unavailable';
  END IF;
  RETURN QUERY SELECT extension.id,extension.version,extension.content->>'provider_key',extension.key
    FROM public.extension extension
   WHERE (extension.tenant_id IS NULL OR extension.tenant_id=p_tenant)
     AND extension.type='fiscal_provider' AND extension.status='active'
     AND extension.effective @> pg_catalog.transaction_timestamp()
     AND extension.content @> '{"jurisdiction":"IN","mode":"in_house_reporting","document_formats":["irp_json_1_1"]}'::jsonb
     AND extension.content->>'provider_key'~'^[a-z0-9](?:[a-z0-9._:-]{0,126}[a-z0-9])?$'
     AND NOT EXISTS(SELECT 1 FROM public.extension newer
       WHERE newer.tenant_id IS NOT DISTINCT FROM extension.tenant_id
         AND newer.type=extension.type AND newer.key=extension.key AND newer.version>extension.version)
   ORDER BY extension.key COLLATE "C",extension.version,extension.id;
END;
$$;

CREATE FUNCTION public.read_india_native_document_context_candidate(
  p_tenant uuid,p_property uuid,p_reservation uuid,p_folio uuid,p_actor uuid,
  p_supplier_registration uuid
) RETURNS jsonb LANGUAGE plpgsql STABLE
SET search_path=pg_catalog,public SET timezone='UTC' SET datestyle='ISO,YMD' AS $$
DECLARE v_authority jsonb;v_issue_date date;v_fy date;v_series public.document_series%ROWTYPE;
  v_supplier_hash text;v_status_count integer;v_open boolean;
BEGIN
  v_authority:=public.read_india_native_issue_authority(p_tenant,p_property,p_actor,p_reservation,p_folio);
  v_issue_date:=(v_authority->>'invoiceIssueDate')::date;
  v_fy:=pg_catalog.make_date(pg_catalog.date_part('year',v_issue_date)::integer
    -CASE WHEN pg_catalog.date_part('month',v_issue_date)<4 THEN 1 ELSE 0 END,4,1);
  SELECT public.india_native_source_hash(pg_catalog.jsonb_build_object(
      'registrationId',registration.id,'tenantId',registration.tenant_id,
      'propertyNode',registration.property_node,'scheme',registration.scheme,'currency',registration.currency,
      'jurisdiction',pg_catalog.jsonb_build_object('extensionId',registration.jurisdiction_extension_id,
        'ownerTenantId',registration.jurisdiction_owner_tenant_id,'key',registration.jurisdiction_key,
        'version',registration.jurisdiction_version::text,'contentHash',registration.jurisdiction_content_hash),
      'gstin',registration.registration_number,'stateCode',registration.region_code,
      'legalName',registration.legal_name,'tradeName',registration.trade_name,
      'addressLine',registration.address_line,'locality',registration.locality,'postalCode',registration.postal_code))
    INTO v_supplier_hash FROM public.property_fiscal_registration registration
   WHERE registration.tenant_id=p_tenant AND registration.property_node=p_property
     AND registration.id=p_supplier_registration AND registration.scheme='in-gstin' AND registration.currency='INR';
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native document supplier registration is unavailable'; END IF;
  SELECT pg_catalog.count(*)::integer INTO v_status_count
    FROM public.india_gst_supplier_registration_status_snapshot status
   WHERE status.tenant_id=p_tenant AND status.supplier_registration_id=p_supplier_registration
     AND status.supplier_registration_evidence_hash=v_supplier_hash AND status.status_as_of=v_issue_date
     AND status.gst_registration_status='active';
  SELECT day.sealed_at IS NULL INTO v_open FROM public.business_day day
   WHERE day.tenant_id=p_tenant AND day.property_node=p_property AND day.business_date=v_issue_date;
  IF NOT FOUND OR NOT v_open THEN RAISE EXCEPTION USING ERRCODE='P0011',MESSAGE='native fiscal issue business date is unavailable'; END IF;
  SELECT series.* INTO v_series FROM public.document_series series
   WHERE series.tenant_id=p_tenant AND series.property_node=p_property
     AND series.supplier_registration_id=p_supplier_registration AND series.kind='invoice'
     AND series.financial_year_start=v_fy AND series.fiscal;
  IF NOT FOUND OR v_series.prefix IS NULL OR v_series.prefix<>pg_catalog.btrim(v_series.prefix)
      OR pg_catalog.char_length(v_series.prefix) NOT BETWEEN 1 AND 12
      OR v_series.prefix!~'^[A-Za-z0-9/-]+$' OR v_series.next_no NOT BETWEEN 1 AND 9223372036854775806
      OR pg_catalog.char_length(v_series.prefix||v_series.next_no::text)>16 THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native fiscal invoice series is unavailable';
  END IF;
  RETURN pg_catalog.jsonb_build_object('tenantId',p_tenant,'propertyNode',p_property,
    'reservationId',p_reservation,'folioId',p_folio,'actorId',p_actor,
    'supplierRegistrationId',p_supplier_registration,'supplierEvidenceHash',v_supplier_hash,
    'issueDate',v_issue_date,'financialYearStart',v_fy,'seriesId',v_series.id,
    'prefix',v_series.prefix,'businessDayOpen',true,'issueStatusCount',v_status_count);
END;
$$;

CREATE FUNCTION public.compose_india_native_operator_confirmation_v1(
  p_tenant uuid,p_property uuid,p_reservation uuid,p_folio uuid,
  p_recipient_registration uuid,p_selector_hash text,
  p_timing jsonb,p_valuation_evidence jsonb,p_prepared_source_json text,
  p_service_supply_nature_json text,p_quoted_tax_composition jsonb,
  p_document_context jsonb
) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE
SET search_path=pg_catalog,public SET timezone='UTC' SET datestyle='ISO,YMD' AS $$
DECLARE v_prepared jsonb;v_nature jsonb;v_confirmation jsonb;v_hash text;
BEGIN
  IF p_tenant IS NULL OR p_property IS NULL OR p_reservation IS NULL OR p_folio IS NULL
      OR p_recipient_registration IS NULL OR p_selector_hash!~'^[0-9a-f]{64}$'
      OR p_timing IS NULL OR p_valuation_evidence IS NULL OR p_prepared_source_json IS NULL
      OR p_service_supply_nature_json IS NULL OR p_quoted_tax_composition IS NULL
      OR p_document_context IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='native operator confirmation input is invalid';
  END IF;
  BEGIN v_prepared:=p_prepared_source_json::jsonb;v_nature:=p_service_supply_nature_json::jsonb;
  EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='native operator confirmation source is invalid'; END;
  v_confirmation:=pg_catalog.jsonb_build_object(
    'version',1,'kind','india_native_operator_confirmation_v1','tenantId',p_tenant,
    'propertyNode',p_property,'reservationId',p_reservation,'folioId',p_folio,
    'recipientRegistrationId',p_recipient_registration,'selectorHash',p_selector_hash,
    'buyer',v_prepared->'buyerDetails','seller',v_prepared->'sellerRegistration',
    'placeOfSupply',v_prepared->'placeOfSupply','classification',v_nature->'classification',
    'serviceSupplyNature',v_nature-'candidateJson',
    'timing',((p_timing#>'{invoiceSourceResult,timing}')
      -ARRAY['nativeTimingId','prospectiveDocumentId','evidenceHash']::text[])
      ||pg_catalog.jsonb_build_object('predecessorHashes',
        (p_timing#>'{invoiceSourceResult,timing,predecessorHashes}')-'nativeTiming'),
    'valuationEvidence',p_valuation_evidence,
    'quotedTaxComposition',p_quoted_tax_composition,
    'recordingRoots',p_valuation_evidence->'recordingRoots',
    'configuration',pg_catalog.jsonb_build_object(
      'selectedExtensionId',p_quoted_tax_composition#>'{taxPreview,selectedExtensionId}',
      'selectedExtensionVersion',p_quoted_tax_composition#>'{taxPreview,selectedExtensionVersion}',
      'selectedExtensionContentHash',p_quoted_tax_composition#>'{taxPreview,selectedExtensionContentHash}'),
    'issue',pg_catalog.jsonb_build_object('issueDate',p_document_context->'issueDate',
      'financialYearStart',p_document_context->'financialYearStart','seriesId',p_document_context->'seriesId',
      'supplierRegistrationId',p_document_context->'supplierRegistrationId',
      'prefix',p_document_context->'prefix','businessDayOpen',true));
  v_hash:=public.india_native_source_hash(pg_catalog.jsonb_build_array(
    'india-native-operator-confirmation-v1',v_confirmation));
  RETURN pg_catalog.jsonb_build_object('confirmation',v_confirmation,'evidenceHash',v_hash);
END;
$$;

CREATE FUNCTION public.discover_india_native_fiscal_issue(
  p_tenant uuid,p_property uuid,p_actor uuid,p_reservation uuid,p_folio uuid,
  p_recipient uuid,p_calendar_authority text,p_calendar_source_hash text,
  p_calendar_through date,p_calendar_dates date[],p_calendar_states text[]
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public SET timezone='UTC' SET datestyle='ISO,YMD' AS $$
DECLARE
  v_authority jsonb;v_existing uuid;v_count integer;v_candidates jsonb;
  v_valuation uuid;v_service uuid;v_payment uuid;v_ordinary uuid;v_supplier uuid;
  v_location uuid;v_supplier_status uuid;v_supplier_sez uuid;v_recipient_sez uuid;v_classification uuid;
  v_timing jsonb;v_valuation_evidence jsonb;v_history jsonb;v_jurisdiction text;
  v_composition jsonb;v_document_context jsonb;v_confirmation jsonb;v_selector_hash text;
  v_statutory record;v_tos date;v_service_date date;v_preview_timing uuid:=pg_catalog.gen_random_uuid();
  v_preview_document uuid:=pg_catalog.gen_random_uuid();
BEGIN
  v_authority:=public.read_india_native_issue_authority(p_tenant,p_property,p_actor,p_reservation,p_folio);
  SELECT origin.document_id INTO v_existing FROM public.india_gst_native_fiscal_document_origin origin
   WHERE origin.tenant_id=p_tenant AND origin.property_node=p_property
     AND origin.reservation_id=p_reservation AND origin.folio_id=p_folio AND origin.document_kind='invoice';
  IF FOUND THEN RETURN pg_catalog.jsonb_build_object('kind','issued','documentId',v_existing); END IF;

  SELECT pg_catalog.count(*)::integer,pg_catalog.min(valuation.id),pg_catalog.min(valuation.native_service_provision_snapshot_id)
    INTO v_count,v_valuation,v_service
    FROM public.india_gst_accommodation_final_valuation valuation
   WHERE valuation.tenant_id=p_tenant AND valuation.property_node=p_property
     AND valuation.reservation_id=p_reservation AND valuation.folio_id=p_folio
     AND valuation.disposition='ordinary_final'
     AND NOT EXISTS(SELECT 1 FROM public.india_gst_accommodation_final_valuation successor
       WHERE successor.tenant_id=valuation.tenant_id AND successor.supersedes_valuation_id=valuation.id);
  IF v_count<>1 THEN RETURN pg_catalog.jsonb_build_object('kind','blocked','blocker','valuation_unavailable'); END IF;
  SELECT pg_catalog.count(*)::integer,pg_catalog.min(payment.id) INTO v_count,v_payment
    FROM public.india_gst_accommodation_payment_receipt_snapshot payment
   WHERE payment.tenant_id=p_tenant AND payment.service_provision_snapshot_id=v_service
     AND payment.recording_actor_id IS NOT NULL;
  IF v_count<>1 THEN RETURN pg_catalog.jsonb_build_object('kind','blocked','blocker','intake_unavailable'); END IF;
  SELECT pg_catalog.count(*)::integer,pg_catalog.min(ordinary.id) INTO v_count,v_ordinary
    FROM public.india_gst_accommodation_ordinary_regime_evidence ordinary
   WHERE ordinary.tenant_id=p_tenant AND ordinary.property_node=p_property
     AND ordinary.reservation_id=p_reservation AND ordinary.service_provision_snapshot_id=v_service;
  IF v_count<>1 THEN RETURN pg_catalog.jsonb_build_object('kind','blocked','blocker','intake_unavailable'); END IF;

  SELECT pg_catalog.count(*)::integer,
      pg_catalog.coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'recipientRegistrationId',registration.id,'legalName',registration.legal_name,
        'gstin',registration.registration_number,'stateCode',registration.region_code)
        ORDER BY registration.legal_name COLLATE "C",registration.id),'[]'::jsonb)
    INTO v_count,v_candidates
    FROM public.india_gst_accommodation_final_valuation valuation
    JOIN public.party_fiscal_registration registration
      ON registration.tenant_id=valuation.tenant_id AND registration.party_id=valuation.buyer_party_id
     AND registration.scheme='in-gstin'
   WHERE valuation.tenant_id=p_tenant AND valuation.id=v_valuation;
  IF p_recipient IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('kind','selection_required','recipients',v_candidates);
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.india_gst_accommodation_final_valuation valuation
      JOIN public.party_fiscal_registration registration
        ON registration.tenant_id=valuation.tenant_id AND registration.party_id=valuation.buyer_party_id
       AND registration.scheme='in-gstin'
     WHERE valuation.tenant_id=p_tenant AND valuation.id=v_valuation AND registration.id=p_recipient) THEN
    RETURN pg_catalog.jsonb_build_object('kind','blocked','blocker','recipient_registration_unavailable');
  END IF;
  IF p_calendar_authority IS NULL OR p_calendar_source_hash IS NULL OR p_calendar_through IS NULL
      OR p_calendar_dates IS NULL OR p_calendar_states IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('kind','blocked','blocker','working_day_calendar_required');
  END IF;

  BEGIN
    v_timing:=public.read_india_native_invoice_timing_source(p_tenant,p_property,p_reservation,
      v_service,v_payment,v_ordinary,v_preview_timing,v_preview_document,p_calendar_authority,
      p_calendar_source_hash,p_calendar_through,p_calendar_dates,p_calendar_states);
    v_valuation_evidence:=public.read_india_native_valuation_evidence(
      p_tenant,p_property,p_reservation,p_folio,v_valuation,v_service,v_payment,v_ordinary);
  EXCEPTION WHEN SQLSTATE 'P0010' OR SQLSTATE 'P0011' THEN
    RETURN pg_catalog.jsonb_build_object('kind','blocked','blocker','working_day_calendar_required');
  END;
  v_service_date:=(v_timing#>>'{invoiceSourceResult,timing,serviceProvisionDate}')::date;
  v_tos:=(v_timing#>>'{invoiceSourceResult,timing,timeOfSupplyDate}')::date;
  v_history:=public.read_india_native_rate_history_day(p_tenant,p_property,v_service_date);
  v_jurisdiction:=public.india_native_insertion_json(pg_catalog.json_build_object(
    'extensionId',v_history#>'{selectedExtension,extensionId}','ownerTenantId',NULL,
    'key',v_history#>'{selectedExtension,key}','version',v_history#>>'{selectedExtension,version}',
    'contentHash',v_history#>'{selectedExtension,contentHash}'));
  SELECT pg_catalog.count(*)::integer,pg_catalog.min(registration.id) INTO v_count,v_supplier
    FROM public.property_fiscal_registration registration
   WHERE registration.tenant_id=p_tenant AND registration.property_node=p_property
     AND registration.scheme='in-gstin' AND registration.currency='INR'
     AND registration.jurisdiction_extension_id=(v_history#>>'{selectedExtension,extensionId}')::uuid
     AND registration.jurisdiction_owner_tenant_id IS NULL
     AND registration.jurisdiction_key=v_history#>>'{selectedExtension,key}'
     AND registration.jurisdiction_version=(v_history#>>'{selectedExtension,version}')::integer
     AND registration.jurisdiction_content_hash=v_history#>>'{selectedExtension,contentHash}';
  IF v_count<>1 THEN RETURN pg_catalog.jsonb_build_object('kind','blocked','blocker','supplier_registration_unavailable'); END IF;
  SELECT pg_catalog.count(*)::integer,pg_catalog.min(location.id) INTO v_count,v_location
    FROM public.india_gst_supplier_service_location location
   WHERE location.tenant_id=p_tenant AND location.supplier_registration_id=v_supplier
     AND location.service_scope='lodging_accommodation';
  IF v_count<>1 THEN RETURN pg_catalog.jsonb_build_object('kind','blocked','blocker','supplier_location_unavailable'); END IF;
  SELECT pg_catalog.count(*)::integer,pg_catalog.min(status.id) INTO v_count,v_supplier_status
    FROM public.india_gst_supplier_registration_status_snapshot status
   WHERE status.tenant_id=p_tenant AND status.supplier_registration_id=v_supplier
     AND status.status_as_of=v_tos AND status.gst_registration_status='active';
  IF v_count<>1 THEN RETURN pg_catalog.jsonb_build_object('kind','blocked','blocker','supplier_status_unavailable'); END IF;
  SELECT pg_catalog.count(*)::integer,pg_catalog.min(status.id) INTO v_count,v_supplier_sez
    FROM public.india_gst_supplier_sez_status status
   WHERE status.tenant_id=p_tenant AND status.supplier_registration_id=v_supplier
     AND status.status_as_of=v_tos AND status.gst_registration_status='active';
  IF v_count<>1 THEN RETURN pg_catalog.jsonb_build_object('kind','blocked','blocker','supplier_status_unavailable'); END IF;
  SELECT pg_catalog.count(*)::integer,pg_catalog.min(status.id) INTO v_count,v_recipient_sez
    FROM public.india_gst_recipient_sez_status status
   WHERE status.tenant_id=p_tenant AND status.recipient_registration_id=p_recipient
     AND status.status_as_of=v_tos AND status.gst_registration_status='active';
  IF v_count<>1 THEN RETURN pg_catalog.jsonb_build_object('kind','blocked','blocker','recipient_status_unavailable'); END IF;
  SELECT pg_catalog.count(*)::integer,pg_catalog.min(classification.id) INTO v_count,v_classification
    FROM public.india_gst_item_classification classification
   WHERE classification.tenant_id=p_tenant AND classification.property_node=p_property
     AND classification.jurisdiction_extension_id=(v_history#>>'{selectedExtension,extensionId}')::uuid
     AND classification.jurisdiction_owner_tenant_id IS NULL
     AND classification.jurisdiction_key=v_history#>>'{selectedExtension,key}'
     AND classification.jurisdiction_version=(v_history#>>'{selectedExtension,version}')::integer
     AND classification.jurisdiction_content_hash=v_history#>>'{selectedExtension,contentHash}'
     AND classification.country_code='IN' AND classification.line_id='room';
  IF v_count<>1 THEN RETURN pg_catalog.jsonb_build_object('kind','blocked','blocker','classification_unavailable'); END IF;

  SELECT graph.* INTO STRICT v_statutory FROM public.read_india_native_statutory_root_graph(
    p_tenant,p_property,p_reservation,p_folio,v_valuation,v_location,v_supplier_status,v_supplier_sez,
    p_recipient,v_recipient_sez,v_classification,v_timing->>'invoiceSourceResultCanonicalJson',v_jurisdiction) graph;
  v_composition:=public.compose_india_native_quoted_tax_source(p_tenant,p_property,p_reservation,p_folio,
    v_valuation,v_timing->>'invoiceSourceInputCanonicalJson',v_timing->>'invoiceSourceResultCanonicalJson',
    v_statutory.service_supply_nature_json);
  BEGIN
    v_document_context:=public.read_india_native_document_context_candidate(
      p_tenant,p_property,p_reservation,p_folio,p_actor,v_supplier);
  EXCEPTION WHEN SQLSTATE 'P0011' THEN
    RETURN pg_catalog.jsonb_build_object('kind','blocked','blocker','business_day_unavailable');
  END;
  IF (v_document_context->>'issueStatusCount')::integer<>1 THEN
    RETURN pg_catalog.jsonb_build_object('kind','blocked','blocker','supplier_issue_status_unavailable');
  END IF;
  v_selector_hash:=public.india_native_source_hash(pg_catalog.jsonb_build_array(
    'india-native-operator-selector-v1',p_tenant,p_property,p_reservation,p_folio,v_valuation,
    v_service,v_payment,v_ordinary,v_location,v_supplier_status,v_supplier_sez,p_recipient,
    v_recipient_sez,v_classification,p_calendar_authority,p_calendar_source_hash,p_calendar_through,
    p_calendar_dates,p_calendar_states));
  v_confirmation:=public.compose_india_native_operator_confirmation_v1(
    p_tenant,p_property,p_reservation,p_folio,p_recipient,v_selector_hash,v_timing,v_valuation_evidence,
    v_statutory.prepared_source_json,v_statutory.service_supply_nature_json,v_composition,v_document_context);
  RETURN pg_catalog.jsonb_build_object('kind','ready','selectorHash',v_selector_hash,
    'evidenceHash',v_confirmation->>'evidenceHash','confirmation',v_confirmation->'confirmation',
    'internalSelectors',pg_catalog.jsonb_build_object('valuationId',v_valuation,'serviceProvisionSnapshotId',v_service,
      'paymentReceiptSnapshotId',v_payment,'ordinaryRegimeEvidenceId',v_ordinary,
      'supplierServiceLocationId',v_location,'supplierRegistrationStatusId',v_supplier_status,
      'supplierSezStatusId',v_supplier_sez,'recipientRegistrationId',p_recipient,
      'recipientSezStatusId',v_recipient_sez,'classificationId',v_classification));
END;
$$;

CREATE FUNCTION public.prepare_india_native_fiscal_invoice_v3(
  p_tenant uuid,p_property uuid,p_actor uuid,p_reservation uuid,p_folio uuid,p_valuation uuid,
  p_service uuid,p_payment uuid,p_ordinary uuid,p_supplier_location uuid,p_supplier_status uuid,
  p_supplier_sez uuid,p_recipient_registration uuid,p_recipient_sez uuid,p_classification uuid,
  p_calendar_authority text,p_calendar_source_hash text,p_calendar_through date,
  p_calendar_dates date[],p_calendar_states text[],p_key text,p_request uuid,
  p_expected_selector_hash text,p_expected_confirmation_hash text
) RETURNS TABLE(native_timing_id uuid,request_event_id uuid,posting_binding_id uuid,
    prepared_source_json text,completed_receipt jsonb)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,public SET timezone='UTC' SET datestyle='ISO,YMD' AS $$
DECLARE
  v_authority jsonb;v_request jsonb;v_timing jsonb;v_valuation jsonb;v_history jsonb;
  v_composition jsonb;v_prefix jsonb;v_locked jsonb;v_document_context jsonb;v_confirmation jsonb;
  v_context jsonb;v_series jsonb;v_basis jsonb;v_payload jsonb;v_result jsonb;
  v_existing public.india_gst_native_invoice_timing%ROWTYPE;
  v_statutory record;v_locked_statutory record;
  v_jurisdiction text;v_key_hash text;v_request_hash text;v_selector_hash text;v_claimed boolean;
  v_timing_id uuid;v_document_id uuid;v_app_id uuid;v_tax_id uuid;v_binding_id uuid;v_event_id uuid;
  v_event_seq bigint;v_series_id uuid;v_selected uuid;v_family text;v_issue_status_count integer;
BEGIN
  IF p_expected_selector_hash IS NULL OR p_expected_selector_hash!~'^[0-9a-f]{64}$'
      OR p_expected_confirmation_hash IS NULL OR p_expected_confirmation_hash!~'^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='native confirmed issue evidence hashes are invalid';
  END IF;
  v_authority:=public.read_india_native_issue_authority(p_tenant,p_property,p_actor,p_reservation,p_folio);
  v_request:=public.india_native_invoice_request_identity(p_tenant,p_property,p_actor,p_reservation,
    p_folio,p_valuation,p_service,p_payment,p_ordinary,p_supplier_location,p_supplier_status,
    p_supplier_sez,p_recipient_registration,p_recipient_sez,p_classification,p_calendar_authority,
    p_calendar_source_hash,p_calendar_through,p_calendar_dates,p_calendar_states,p_key,p_request);
  v_key_hash:=v_request->>'keyHash';v_request_hash:=v_request->>'requestHash';
  v_selector_hash:=public.india_native_source_hash(pg_catalog.jsonb_build_array(
    'india-native-operator-selector-v1',p_tenant,p_property,p_reservation,p_folio,p_valuation,
    p_service,p_payment,p_ordinary,p_supplier_location,p_supplier_status,p_supplier_sez,
    p_recipient_registration,p_recipient_sez,p_classification,p_calendar_authority,
    p_calendar_source_hash,p_calendar_through,p_calendar_dates,p_calendar_states));
  IF v_selector_hash<>p_expected_selector_hash THEN
    RAISE EXCEPTION USING ERRCODE='P2081',MESSAGE='displayed native invoice evidence is stale';
  END IF;

  IF EXISTS(SELECT 1 FROM pg_catalog.pg_locks l WHERE l.pid=pg_catalog.pg_backend_pid()
      AND l.locktype='advisory' AND l.granted AND l.objsubid=1
      AND l.classid=((6441674055002974568::bigint>>32)&4294967295)::oid
      AND l.objid=(6441674055002974568::bigint&4294967295)::oid) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native issue requires a transaction without prior publication';
  END IF;
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
    -- Replay is bound to the original selectors and current authority, never to
    -- mutable present-day confirmation sources.
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
  -- Forward82 closes D1314 for fresh issue only: the configured supplier must
  -- retain one authenticated active portal status on the locked issue date.
  SELECT pg_catalog.count(*)::integer INTO v_issue_status_count
    FROM public.india_gst_supplier_registration_status_snapshot status
   WHERE status.tenant_id=p_tenant
     AND status.supplier_registration_id=(v_document_context->>'supplierRegistrationId')::uuid
     AND status.supplier_registration_evidence_hash=
       v_statutory.prepared_source_json::json#>>'{sellerRegistration,evidenceHash}'
     AND status.status_as_of=(v_document_context->>'issueDate')::date
     AND status.gst_registration_status='active';
  IF v_issue_status_count<>1 THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='native supplier issue-date status is unavailable';
  END IF;
  v_confirmation:=public.compose_india_native_operator_confirmation_v1(
    p_tenant,p_property,p_reservation,p_folio,p_recipient_registration,v_selector_hash,
    v_timing,v_valuation,v_statutory.prepared_source_json,v_statutory.service_supply_nature_json,
    v_composition,v_document_context);
  IF v_confirmation->>'evidenceHash' IS DISTINCT FROM p_expected_confirmation_hash THEN
    RAISE EXCEPTION USING ERRCODE='P2081',MESSAGE='displayed native invoice evidence is stale';
  END IF;

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

ALTER FUNCTION public.list_india_native_fiscal_documents(
  uuid,uuid,uuid,date,date,uuid,uuid,text,date,timestamptz,uuid,integer) OWNER TO yellow_owner;
ALTER FUNCTION public.read_india_native_fiscal_document(uuid,uuid,uuid,uuid) OWNER TO yellow_owner;
ALTER FUNCTION public.discover_india_native_fiscal_issue(
  uuid,uuid,uuid,uuid,uuid,uuid,text,text,date,date[],text[]) OWNER TO yellow_owner;
ALTER FUNCTION public.read_india_fiscal_submission_delivery_receipt_by_document(
  uuid,uuid,uuid,uuid) OWNER TO yellow_owner;
ALTER FUNCTION public.list_india_fiscal_submission_provider_options(uuid,uuid,uuid) OWNER TO yellow_owner;
ALTER FUNCTION public.read_india_native_document_context_candidate(
  uuid,uuid,uuid,uuid,uuid,uuid) OWNER TO yellow_owner;
ALTER FUNCTION public.compose_india_native_operator_confirmation_v1(
  uuid,uuid,uuid,uuid,uuid,text,jsonb,jsonb,text,text,jsonb,jsonb) OWNER TO yellow_owner;
ALTER FUNCTION public.prepare_india_native_fiscal_invoice_v3(
  uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,
  text,text,date,date[],text[],text,uuid,text,text) OWNER TO yellow_owner;

REVOKE ALL ON FUNCTION public.list_india_native_fiscal_documents(
  uuid,uuid,uuid,date,date,uuid,uuid,text,date,timestamptz,uuid,integer) FROM PUBLIC,app_role,yellow_runtime;
REVOKE ALL ON FUNCTION public.read_india_native_fiscal_document(uuid,uuid,uuid,uuid) FROM PUBLIC,app_role,yellow_runtime;
REVOKE ALL ON FUNCTION public.discover_india_native_fiscal_issue(
  uuid,uuid,uuid,uuid,uuid,uuid,text,text,date,date[],text[]) FROM PUBLIC,app_role,yellow_runtime;
REVOKE ALL ON FUNCTION public.read_india_fiscal_submission_delivery_receipt_by_document(
  uuid,uuid,uuid,uuid) FROM PUBLIC,app_role,yellow_runtime;
REVOKE ALL ON FUNCTION public.list_india_fiscal_submission_provider_options(uuid,uuid,uuid)
  FROM PUBLIC,app_role,yellow_runtime;
REVOKE ALL ON FUNCTION public.read_india_native_document_context_candidate(
  uuid,uuid,uuid,uuid,uuid,uuid) FROM PUBLIC,app_role,yellow_runtime;
REVOKE ALL ON FUNCTION public.compose_india_native_operator_confirmation_v1(
  uuid,uuid,uuid,uuid,uuid,text,jsonb,jsonb,text,text,jsonb,jsonb) FROM PUBLIC,app_role,yellow_runtime;
REVOKE ALL ON FUNCTION public.prepare_india_native_fiscal_invoice_v3(
  uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,
  text,text,date,date[],text[],text,uuid,text,text) FROM PUBLIC,app_role,yellow_runtime;

GRANT EXECUTE ON FUNCTION public.list_india_native_fiscal_documents(
  uuid,uuid,uuid,date,date,uuid,uuid,text,date,timestamptz,uuid,integer) TO app_role;
GRANT EXECUTE ON FUNCTION public.read_india_native_fiscal_document(uuid,uuid,uuid,uuid) TO app_role;
GRANT EXECUTE ON FUNCTION public.discover_india_native_fiscal_issue(
  uuid,uuid,uuid,uuid,uuid,uuid,text,text,date,date[],text[]) TO app_role;
GRANT EXECUTE ON FUNCTION public.read_india_fiscal_submission_delivery_receipt_by_document(
  uuid,uuid,uuid,uuid) TO app_role;
GRANT EXECUTE ON FUNCTION public.list_india_fiscal_submission_provider_options(uuid,uuid,uuid) TO app_role;
GRANT EXECUTE ON FUNCTION public.prepare_india_native_fiscal_invoice_v3(
  uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,
  text,text,date,date[],text[],text,uuid,text,text) TO app_role;

DO $q208_postconditions$
DECLARE v_signature text;v_oid oid;
BEGIN
  FOREACH v_signature IN ARRAY ARRAY[
    'public.list_india_native_fiscal_documents(uuid,uuid,uuid,date,date,uuid,uuid,text,date,timestamp with time zone,uuid,integer)',
    'public.read_india_native_fiscal_document(uuid,uuid,uuid,uuid)',
    'public.discover_india_native_fiscal_issue(uuid,uuid,uuid,uuid,uuid,uuid,text,text,date,date[],text[])',
    'public.read_india_fiscal_submission_delivery_receipt_by_document(uuid,uuid,uuid,uuid)',
    'public.list_india_fiscal_submission_provider_options(uuid,uuid,uuid)',
    'public.prepare_india_native_fiscal_invoice_v3(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,text,date,date[],text[],text,uuid,text,text)'
  ] LOOP
    v_oid:=pg_catalog.to_regprocedure(v_signature);
    IF v_oid IS NULL OR NOT pg_catalog.has_function_privilege('app_role',v_oid,'EXECUTE')
        OR pg_catalog.has_function_privilege('yellow_runtime',v_oid,'EXECUTE')
        OR pg_catalog.has_function_privilege('public',v_oid,'EXECUTE') THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Q208 public capability ACL is malformed';
    END IF;
  END LOOP;
  FOREACH v_signature IN ARRAY ARRAY[
    'public.read_india_native_document_context_candidate(uuid,uuid,uuid,uuid,uuid,uuid)',
    'public.compose_india_native_operator_confirmation_v1(uuid,uuid,uuid,uuid,uuid,text,jsonb,jsonb,text,text,jsonb,jsonb)'
  ] LOOP
    v_oid:=pg_catalog.to_regprocedure(v_signature);
    IF v_oid IS NULL OR pg_catalog.has_function_privilege('app_role',v_oid,'EXECUTE')
        OR pg_catalog.has_function_privilege('yellow_runtime',v_oid,'EXECUTE')
        OR pg_catalog.has_function_privilege('public',v_oid,'EXECUTE') THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Q208 private helper ACL is malformed';
    END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM public.role_permission WHERE permission_code='tax-fiscal.documents:read') THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Q208 document read permission must remain unassigned';
  END IF;
END;
$q208_postconditions$;

RESET ROLE;
