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
