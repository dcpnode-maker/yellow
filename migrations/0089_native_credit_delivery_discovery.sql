-- Order452: draft, not an execution admission. Production runMigrations owns
-- the transaction and ledger. Predecessor prosrc hashes use canonical LF bytes.
DO $precondition$
DECLARE p pg_catalog.pg_proc%ROWTYPE; expected record;
BEGIN
  IF (SELECT max(version) FROM public.schema_migration) IS DISTINCT FROM 88
      OR (SELECT count(*) FROM public.schema_migration) IS DISTINCT FROM 88::bigint
      OR NOT EXISTS(SELECT 1 FROM public.schema_migration WHERE version=88
        AND filename='0088_native_credit_fiscal_submission.sql'
        AND btrim(checksum_sha256)='214754e94bdfb0a2163395c9ab4449b0b5e87da7830c45e69d77ac05a2cddb64')
      OR pg_catalog.to_regprocedure('public.read_india_native_credit_delivery_by_document(uuid,uuid,uuid,uuid)') IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='credit delivery discovery requires exact canonical88 and absent capability';
  END IF;
  FOR expected IN SELECT * FROM (VALUES
    ('public.assert_india_native_credit_authority(uuid,uuid,uuid,text[],boolean)',
      '780b31932dcc4da23247abfb379efbe3b03ebbe8d5fc827154bcf80b497e8107',false,'v','void',1,
      ARRAY['search_path=pg_catalog, public, pg_temp']::text[],false),
    ('public.read_india_fiscal_submission_delivery_receipt(uuid,uuid,uuid,uuid)',
      '5ee83dd4ea4c35550414e66fb48a883d78ad7a5e51ac14439cc0ff15154b7ccc',true,'s','jsonb',0,
      ARRAY['search_path=pg_catalog, public, pg_temp','TimeZone=UTC','DateStyle=ISO,YMD']::text[],true)
  ) contracts(signature,body_hash,security_definer,volatility,result_type,defaults,config,app_execute) LOOP
    SELECT * INTO p FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure(expected.signature);
    IF p.oid IS NULL OR p.proowner IS DISTINCT FROM 'yellow_owner'::regrole
        OR p.prolang IS DISTINCT FROM (SELECT oid FROM pg_catalog.pg_language WHERE lanname='plpgsql')
        OR p.prosecdef IS DISTINCT FROM expected.security_definer OR p.provolatile::text IS DISTINCT FROM expected.volatility
        OR p.prorettype IS DISTINCT FROM expected.result_type::regtype OR p.proretset OR p.proisstrict OR p.proleakproof
        OR p.proparallel<>'u' OR p.prokind<>'f' OR p.provariadic<>0 OR p.pronargdefaults<>expected.defaults
        OR (expected.defaults=1 AND pg_catalog.pg_get_expr(p.proargdefaults,0) IS DISTINCT FROM 'false')
        OR p.proconfig IS DISTINCT FROM expected.config
        OR encode(public.digest(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'UTF8'),'sha256'),'hex') IS DISTINCT FROM expected.body_hash
        OR pg_catalog.has_function_privilege('app_role',p.oid,'EXECUTE') IS DISTINCT FROM expected.app_execute
        OR pg_catalog.has_function_privilege('yellow_runtime',p.oid,'EXECUTE')
        OR EXISTS(SELECT 1 FROM pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
          WHERE a.privilege_type<>'EXECUTE' OR a.is_grantable OR a.grantee NOT IN
            (p.proowner,CASE WHEN expected.app_execute THEN 'app_role'::regrole::oid ELSE p.proowner END)) THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='credit delivery predecessor body or authority differs';
    END IF;
  END LOOP;
END $precondition$;

SET ROLE yellow_owner;
CREATE FUNCTION public.read_india_native_credit_delivery_by_document(
  p_tenant uuid,p_property uuid,p_actor uuid,p_document uuid
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER CALLED ON NULL INPUT PARALLEL UNSAFE
SET search_path=pg_catalog,public,pg_temp SET timezone='UTC' SET datestyle='ISO,YMD' AS $$
DECLARE
  c public.india_native_fiscal_credit_note%ROWTYPE; d public.document%ROWTYPE; original public.document%ROWTYPE;
  origin public.india_gst_native_fiscal_document_origin%ROWTYPE; correction public.journal%ROWTYPE;
  series public.document_series%ROWTYPE; head public.fiscal_submission%ROWTYPE;
  head_ids uuid[]; issued jsonb; receipt jsonb;
BEGIN
  -- Authority is deliberately before even the missing-document result.
  PERFORM public.assert_india_native_credit_authority(p_tenant,p_property,p_actor,
    ARRAY['tax-fiscal.documents:read','tax-fiscal.submissions:read']);
  IF p_document IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='credit delivery document is required';
  END IF;
  SELECT * INTO c FROM public.india_native_fiscal_credit_note
    WHERE tenant_id=p_tenant AND property_node=p_property AND document_id=p_document;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO d FROM public.document WHERE tenant_id=p_tenant AND id=c.document_id;
  SELECT * INTO original FROM public.document WHERE tenant_id=p_tenant AND id=c.original_document_id;
  SELECT * INTO origin FROM public.india_gst_native_fiscal_document_origin WHERE tenant_id=p_tenant AND id=c.original_origin_id;
  SELECT * INTO correction FROM public.journal WHERE tenant_id=p_tenant AND id=c.correction_journal_id;
  SELECT * INTO series FROM public.document_series WHERE tenant_id=p_tenant AND id=c.series_id;
  IF d.id IS NULL OR original.id IS NULL OR origin.id IS NULL OR correction.id IS NULL OR series.id IS NULL
      OR to_jsonb(d) IS DISTINCT FROM c.planned_document
      OR d.id IS DISTINCT FROM p_document OR d.kind IS DISTINCT FROM 'credit_note' OR d.status IS DISTINCT FROM 'issued'
      OR d.property_node IS DISTINCT FROM p_property OR d.series_id IS DISTINCT FROM c.series_id
      OR d.business_date IS DISTINCT FROM c.business_date OR d.issued_at IS DISTINCT FROM c.created_at
      OR d.created_at IS DISTINCT FROM c.created_at OR d.doc_no IS NULL OR d.sha256 IS NULL
      OR d.sha256!~'^[0-9a-f]{64}$' OR original.sha256 IS NULL OR original.sha256!~'^[0-9a-f]{64}$'
      OR original.kind IS DISTINCT FROM 'invoice' OR original.status IS DISTINCT FROM 'issued'
      OR original.property_node IS DISTINCT FROM p_property OR original.id=d.id
      OR origin.document_id IS DISTINCT FROM original.id OR origin.property_node IS DISTINCT FROM p_property
      OR origin.document_kind IS DISTINCT FROM 'invoice' OR origin.source_kind IS DISTINCT FROM 'native_current_transaction_graph'
      OR origin.source_version IS DISTINCT FROM 2 OR origin.native_accounting_binding_id IS DISTINCT FROM c.accounting_binding_id
      OR origin.issue_date IS DISTINCT FROM original.business_date OR origin.created_at IS DISTINCT FROM original.issued_at
      OR origin.native_timing_id IS NULL OR origin.native_source_basis_hash IS NULL
      OR series.property_node IS DISTINCT FROM p_property OR series.kind IS DISTINCT FROM 'credit_note'
      OR series.fiscal IS DISTINCT FROM true OR series.supplier_registration_id IS DISTINCT FROM origin.supplier_registration_id
      OR d.subject_type IS DISTINCT FROM 'folio' OR d.subject_id IS DISTINCT FROM origin.folio_id
      OR correction.kind IS DISTINCT FROM 'correction' OR correction.property_node IS DISTINCT FROM p_property
      OR correction.business_date IS DISTINCT FROM c.business_date OR correction.created_at IS DISTINCT FROM c.created_at
      OR correction.created_by IS DISTINCT FROM c.actor_id OR correction.currency IS DISTINCT FROM 'INR'
      OR correction.reverses IS NOT NULL OR correction.description IS DISTINCT FROM c.reason
      OR correction.source IS DISTINCT FROM jsonb_build_object('interface','financials.india-native-credit-note.post','credit_note_id',c.id) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='credit delivery immutable native ancestry differs';
  END IF;
  -- Never invoke birth/fact/outbox completeness guards: published events may be pruned.
  IF encode(public.digest(convert_to(d.content::text,'UTF8'),'sha256'),'hex') IS DISTINCT FROM d.sha256
      OR encode(public.digest(convert_to(original.content::text,'UTF8'),'sha256'),'hex') IS DISTINCT FROM original.sha256
      OR d.content->'DocDtls' IS DISTINCT FROM jsonb_build_object('Typ','CRN','No',d.doc_no,'Dt',to_char(c.business_date,'DD/MM/YYYY'))
      OR d.content->'YellowCredit' IS DISTINCT FROM jsonb_build_object('originalDocumentId',original.id,
        'originalSha256',original.sha256,'reason',c.reason,'correctionJournalId',c.correction_journal_id,'sourceEvidenceHash',c.source_evidence_hash)
      OR d.content->'RefDtls' IS DISTINCT FROM jsonb_build_object('PrecDocDtls',jsonb_build_array(jsonb_build_object(
        'InvNo',original.doc_no,'InvDt',to_char(original.business_date,'DD/MM/YYYY'))))
      OR (SELECT jsonb_agg(to_jsonb(line) ORDER BY line.seq) FROM public.posting_line line
        WHERE line.tenant_id=p_tenant AND line.journal_id=c.correction_journal_id)
        IS DISTINCT FROM (SELECT jsonb_agg(item->'line' ORDER BY (item->'line'->>'seq')::integer)
          FROM jsonb_array_elements(c.planned_lines) item)
      OR NOT EXISTS(SELECT 1 FROM public.india_gst_accommodation_final_component_tax_journal_binding b
        WHERE b.tenant_id=p_tenant AND b.id=c.accounting_binding_id AND b.valuation_id=c.valuation_id) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='credit delivery content hash or original reference differs';
  END IF;
  BEGIN issued:=c.receipt_json::jsonb;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='credit delivery issuance receipt is invalid'; END;
  IF issued->>'documentId' IS DISTINCT FROM d.id::text OR issued->>'sha256' IS DISTINCT FROM d.sha256
      OR issued->>'documentKind' IS DISTINCT FROM 'credit_note' OR issued->>'propertyNode' IS DISTINCT FROM p_property::text
      OR issued->>'originalDocumentId' IS DISTINCT FROM original.id::text OR issued->>'originalSha256' IS DISTINCT FROM original.sha256
      OR issued->>'correctionJournalId' IS DISTINCT FROM correction.id::text OR issued->>'seriesId' IS DISTINCT FROM series.id::text
      OR issued->>'docNo' IS DISTINCT FROM d.doc_no OR issued->>'sourceEvidenceHash' IS DISTINCT FROM c.source_evidence_hash THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='credit delivery issuance receipt binding differs';
  END IF;
  SELECT array_agg(id ORDER BY id) INTO head_ids FROM (
    SELECT id FROM public.fiscal_submission WHERE tenant_id=p_tenant AND property_node=p_property AND document_id=p_document
      ORDER BY id LIMIT 2
  ) bounded_heads;
  IF coalesce(cardinality(head_ids),0)=0 THEN RETURN jsonb_build_object('kind','not_requested','documentId',p_document); END IF;
  IF cardinality(head_ids)=2 THEN RETURN jsonb_build_object('kind','ambiguous','documentId',p_document); END IF;
  SELECT * INTO head FROM public.fiscal_submission WHERE tenant_id=p_tenant AND property_node=p_property
    AND document_id=p_document AND id=head_ids[1];
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='credit delivery selected head disappeared'; END IF;
  IF head.delivery_version IS DISTINCT FROM 1 THEN
    RETURN jsonb_build_object('kind','legacy_unsupported','documentId',p_document,'submissionId',head.id);
  END IF;
  IF head.document_sha256 IS DISTINCT FROM d.sha256 THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='credit delivery head document hash differs'; END IF;
  receipt:=public.read_india_fiscal_submission_delivery_receipt(p_tenant,p_property,head.id,p_actor);
  IF receipt IS NULL OR receipt->>'tenantId' IS DISTINCT FROM p_tenant::text
      OR receipt->>'propertyNode' IS DISTINCT FROM p_property::text OR receipt->>'documentId' IS DISTINCT FROM p_document::text
      OR receipt->>'submissionId' IS DISTINCT FROM head.id::text OR receipt->>'documentSha256' IS DISTINCT FROM d.sha256
      OR receipt->>'wireSha256' IS DISTINCT FROM head.wire_sha256 THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='credit delivery receipt identity differs';
  END IF;
  RETURN jsonb_build_object('kind','receipt','documentId',p_document,'receipt',receipt);
END $$;
ALTER FUNCTION public.read_india_native_credit_delivery_by_document(uuid,uuid,uuid,uuid) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.read_india_native_credit_delivery_by_document(uuid,uuid,uuid,uuid) FROM PUBLIC,app_role,yellow_runtime;
GRANT EXECUTE ON FUNCTION public.read_india_native_credit_delivery_by_document(uuid,uuid,uuid,uuid) TO app_role;
DO $capability_acl$
DECLARE p pg_catalog.pg_proc%ROWTYPE;
BEGIN
  SELECT * INTO STRICT p FROM pg_catalog.pg_proc
    WHERE oid='public.read_india_native_credit_delivery_by_document(uuid,uuid,uuid,uuid)'::regprocedure;
  IF p.proowner IS DISTINCT FROM 'yellow_owner'::regrole
      OR NOT pg_catalog.has_function_privilege('app_role',p.oid,'EXECUTE')
      OR pg_catalog.has_function_privilege('yellow_runtime',p.oid,'EXECUTE')
      OR EXISTS(SELECT 1 FROM pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
        WHERE a.privilege_type<>'EXECUTE' OR a.is_grantable OR a.grantee NOT IN (p.proowner,'app_role'::regrole::oid)) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='credit delivery capability ACL differs';
  END IF;
END $capability_acl$;
RESET ROLE;
