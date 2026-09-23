-- Order 408: bind one exact immutable full reversal to an Order407 India
-- accommodation final component-tax journal. The application inserts the
-- adjustment header and copied lines; this owner capability proves the entire
-- sign-negated set and statutory ancestry before admitting the sole binding.

CREATE TABLE public.india_gst_final_component_tax_journal_reversal_binding (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT pg_catalog.gen_random_uuid(),
  property_node uuid NOT NULL,
  reversed_by uuid NOT NULL,
  posting_binding_id uuid NOT NULL,
  tax_id uuid NOT NULL,
  original_journal_id uuid NOT NULL,
  reversal_journal_id uuid NOT NULL,
  reservation_id uuid NOT NULL,
  folio_id uuid NOT NULL,
  currency character(3) NOT NULL CHECK (currency = 'INR'),
  business_date date NOT NULL CHECK (pg_catalog.isfinite(business_date)),
  reversed_at timestamptz NOT NULL DEFAULT pg_catalog.transaction_timestamp(),
  CONSTRAINT india_gst_final_component_tax_journal_reversal_binding_pk
    PRIMARY KEY (tenant_id,id),
  CONSTRAINT india_gst_final_component_tax_journal_reversal_original_uq
    UNIQUE (tenant_id,original_journal_id),
  CONSTRAINT india_gst_final_component_tax_journal_reversal_journal_uq
    UNIQUE (tenant_id,reversal_journal_id),
  CONSTRAINT india_gst_final_component_tax_journal_reversal_property_fk
    FOREIGN KEY (tenant_id,property_node) REFERENCES public.org_node(tenant_id,id),
  CONSTRAINT india_gst_final_component_tax_journal_reversal_actor_fk
    FOREIGN KEY (tenant_id,reversed_by) REFERENCES public.app_user(tenant_id,id),
  CONSTRAINT india_gst_final_component_tax_journal_reversal_posting_fk
    FOREIGN KEY (tenant_id,posting_binding_id)
    REFERENCES public.india_gst_accommodation_final_component_tax_journal_binding(tenant_id,id),
  CONSTRAINT india_gst_final_component_tax_journal_reversal_tax_fk
    FOREIGN KEY (tenant_id,tax_id)
    REFERENCES public.india_gst_accommodation_final_component_tax(tenant_id,id),
  CONSTRAINT india_gst_final_component_tax_journal_reversal_original_fk
    FOREIGN KEY (tenant_id,original_journal_id,property_node,currency)
    REFERENCES public.journal(tenant_id,id,property_node,currency),
  CONSTRAINT india_gst_final_component_tax_journal_reversal_contra_fk
    FOREIGN KEY (tenant_id,reversal_journal_id,property_node,business_date,currency)
    REFERENCES public.journal(tenant_id,id,property_node,business_date,currency),
  CONSTRAINT india_gst_final_component_tax_journal_reversal_distinct_ck
    CHECK (original_journal_id<>reversal_journal_id)
);

CREATE INDEX india_gst_final_component_tax_journal_reversal_property_lookup
  ON public.india_gst_final_component_tax_journal_reversal_binding
  (tenant_id,property_node,business_date,reversal_journal_id);

ALTER TABLE public.india_gst_final_component_tax_journal_reversal_binding
  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.india_gst_final_component_tax_journal_reversal_binding
  FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation
  ON public.india_gst_final_component_tax_journal_reversal_binding
  USING (tenant_id=pg_catalog.current_setting('app.tenant_id',true)::uuid)
  WITH CHECK (tenant_id=pg_catalog.current_setting('app.tenant_id',true)::uuid);

ALTER TABLE public.india_gst_final_component_tax_journal_reversal_binding
  OWNER TO yellow_owner;
REVOKE ALL ON TABLE public.india_gst_final_component_tax_journal_reversal_binding
  FROM PUBLIC,app_role,yellow_runtime;
GRANT SELECT ON TABLE public.india_gst_final_component_tax_journal_reversal_binding
  TO app_role;

CREATE FUNCTION public.create_india_final_component_tax_correction_header(
  p_tenant_id uuid,
  p_original_journal_id uuid,
  p_property_node uuid,
  p_description text,
  p_actor_id uuid
) RETURNS TABLE (
  journal_id uuid,
  business_date date,
  currency character(3)
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_context_tenant uuid;
  v_posting public.india_gst_accommodation_final_component_tax_journal_binding%ROWTYPE;
  v_original public.journal%ROWTYPE;
  v_business_date date;
  v_journal_id uuid;
BEGIN
  IF session_user<>'yellow_runtime'
     OR pg_catalog.current_setting('role',true) IS DISTINCT FROM 'app_role'
     OR current_user<>'yellow_owner' THEN
    RAISE EXCEPTION USING ERRCODE='42501',
      MESSAGE='India component-tax correction header requires the governed runtime app role';
  END IF;
  BEGIN
    v_context_tenant:=NULLIF(pg_catalog.current_setting('app.tenant_id',true),'')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE='42501',
      MESSAGE='India component-tax correction header tenant context is invalid';
  END;
  IF v_context_tenant IS NULL OR p_tenant_id IS NULL OR v_context_tenant<>p_tenant_id THEN
    RAISE EXCEPTION USING ERRCODE='42501',
      MESSAGE='India component-tax correction header tenant context is invalid';
  END IF;
  IF p_original_journal_id IS NULL OR p_property_node IS NULL OR p_actor_id IS NULL
     OR p_description IS NULL OR p_description<>pg_catalog.btrim(p_description)
     OR pg_catalog.char_length(p_description) NOT BETWEEN 1 AND 500
     OR p_description~'[[:cntrl:]]'
     OR p_description~U&'[\200B-\200D\202A-\202E\2060\2066-\2069\FEFF]' THEN
    RAISE EXCEPTION USING ERRCODE='22023',
      MESSAGE='India component-tax correction header input is invalid';
  END IF;
  PERFORM 1 FROM public.tenant AS target_tenant
   WHERE target_tenant.id=p_tenant_id AND target_tenant.status='active';
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='India component-tax correction authority is unavailable'; END IF;
  SELECT posting.* INTO v_posting
    FROM public.india_gst_accommodation_final_component_tax_journal_binding AS posting
   WHERE posting.tenant_id=p_tenant_id AND posting.property_node=p_property_node
     AND posting.journal_id=p_original_journal_id;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='governed India component-tax original binding is unavailable'; END IF;
  SELECT original.* INTO v_original FROM public.journal AS original
   WHERE original.tenant_id=p_tenant_id AND original.id=p_original_journal_id
     AND original.property_node=p_property_node AND original.business_date=v_posting.business_date
     AND original.currency='INR' AND original.kind='charge' AND original.reverses IS NULL
     AND original.source=pg_catalog.jsonb_build_object(
       'interface','financials.india-final-component-tax.post','tax_id',v_posting.tax_id::text);
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='governed India component-tax original journal is unavailable'; END IF;
  PERFORM 1 FROM public.app_user AS actor
   WHERE actor.tenant_id=p_tenant_id AND actor.id=p_actor_id AND actor.status='active';
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='India component-tax correction actor is unavailable'; END IF;
  SELECT (pg_catalog.transaction_timestamp() AT TIME ZONE property.timezone)::date
    INTO v_business_date FROM public.org_node AS property
   WHERE property.tenant_id=p_tenant_id AND property.id=p_property_node
     AND property.kind='property' AND property.currency='INR';
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='India component-tax correction property is unavailable'; END IF;
  PERFORM 1 FROM public.business_day AS target_day
   WHERE target_day.tenant_id=p_tenant_id AND target_day.property_node=p_property_node
     AND target_day.business_date=v_business_date AND target_day.sealed_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0011',MESSAGE='India component-tax correction business day is missing or sealed'; END IF;
  INSERT INTO public.journal(
    tenant_id,property_node,business_date,kind,description,currency,reverses,source,created_by)
  VALUES(p_tenant_id,p_property_node,v_business_date,'adjustment',p_description,'INR',p_original_journal_id,
    pg_catalog.jsonb_build_object('interface','financials.india-final-component-tax.reverse',
      'original_journal_id',p_original_journal_id::text,'tax_id',v_posting.tax_id::text),p_actor_id)
  RETURNING id INTO v_journal_id;
  RETURN QUERY SELECT v_journal_id,v_business_date,'INR'::character(3);
END;
$$;

ALTER FUNCTION public.create_india_final_component_tax_correction_header(
  uuid,uuid,uuid,text,uuid) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.create_india_final_component_tax_correction_header(
  uuid,uuid,uuid,text,uuid) FROM PUBLIC,app_role,yellow_runtime;
GRANT EXECUTE ON FUNCTION public.create_india_final_component_tax_correction_header(
  uuid,uuid,uuid,text,uuid) TO app_role;

CREATE FUNCTION public.record_india_final_component_tax_journal_reversal(
  p_tenant_id uuid,
  p_property_node uuid,
  p_actor_id uuid,
  p_original_journal_id uuid,
  p_reversal_journal_id uuid,
  p_post_seal_authorized boolean
) RETURNS TABLE (
  reversal_binding_id uuid,
  posting_binding_id uuid,
  tax_id uuid,
  original_journal_id uuid,
  reversal_journal_id uuid,
  reservation_id uuid,
  folio_id uuid,
  business_date date,
  currency character(3),
  line_count integer,
  created boolean
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_context_tenant uuid;
  v_posting public.india_gst_accommodation_final_component_tax_journal_binding%ROWTYPE;
  v_existing public.india_gst_final_component_tax_journal_reversal_binding%ROWTYPE;
  v_original public.journal%ROWTYPE;
  v_reversal public.journal%ROWTYPE;
  v_tax public.india_gst_accommodation_final_component_tax%ROWTYPE;
  v_original_root public.posting_line%ROWTYPE;
  v_created public.india_gst_final_component_tax_journal_reversal_binding%ROWTYPE;
  v_original_count integer;
  v_reversal_count integer;
  v_mismatches integer;
  v_original_balance numeric;
  v_reversal_balance numeric;
BEGIN
  IF session_user<>'yellow_runtime'
     OR pg_catalog.current_setting('role',true) IS DISTINCT FROM 'app_role'
     OR current_user<>'yellow_owner' THEN
    RAISE EXCEPTION USING ERRCODE='42501',
      MESSAGE='India component-tax reversal binding requires the governed runtime app role';
  END IF;
  BEGIN
    v_context_tenant:=NULLIF(pg_catalog.current_setting('app.tenant_id',true),'')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE='42501',
      MESSAGE='India component-tax reversal binding tenant context is invalid';
  END;
  IF v_context_tenant IS NULL OR p_tenant_id IS NULL OR v_context_tenant<>p_tenant_id THEN
    RAISE EXCEPTION USING ERRCODE='42501',
      MESSAGE='India component-tax reversal binding tenant context is invalid';
  END IF;
  IF p_property_node IS NULL OR p_actor_id IS NULL OR p_original_journal_id IS NULL
     OR p_reversal_journal_id IS NULL OR p_original_journal_id=p_reversal_journal_id
     OR p_post_seal_authorized IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='22023',
      MESSAGE='India component-tax reversal binding input is invalid';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'india-final-component-tax-journal-reversal:'||p_tenant_id::text||':'||p_original_journal_id::text,408));

  SELECT reversal_binding.* INTO v_existing
    FROM public.india_gst_final_component_tax_journal_reversal_binding AS reversal_binding
   WHERE reversal_binding.tenant_id=p_tenant_id
     AND reversal_binding.original_journal_id=p_original_journal_id;
  IF FOUND THEN
    IF v_existing.property_node<>p_property_node OR v_existing.reversed_by<>p_actor_id
       OR v_existing.reversal_journal_id<>p_reversal_journal_id THEN
      RAISE EXCEPTION USING ERRCODE='23505',
        MESSAGE='India component-tax journal already has a divergent reversal binding';
    END IF;
    SELECT pg_catalog.count(*)::integer INTO v_reversal_count
      FROM public.posting_line AS replay_line
     WHERE replay_line.tenant_id=p_tenant_id AND replay_line.journal_id=p_reversal_journal_id;
    RETURN QUERY SELECT v_existing.id,v_existing.posting_binding_id,v_existing.tax_id,
      v_existing.original_journal_id,v_existing.reversal_journal_id,v_existing.reservation_id,
      v_existing.folio_id,v_existing.business_date,v_existing.currency,v_reversal_count,false;
    RETURN;
  END IF;

  SELECT posting.* INTO v_posting
    FROM public.india_gst_accommodation_final_component_tax_journal_binding AS posting
   WHERE posting.tenant_id=p_tenant_id AND posting.property_node=p_property_node
     AND posting.journal_id=p_original_journal_id
   FOR KEY SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='governed India component-tax original binding is unavailable'; END IF;

  SELECT tax.* INTO v_tax
    FROM public.india_gst_accommodation_final_component_tax AS tax
   WHERE tax.tenant_id=p_tenant_id AND tax.id=v_posting.tax_id
     AND tax.generation=v_posting.tax_generation AND tax.evidence_hash=v_posting.tax_evidence_hash
     AND tax.property_node=v_posting.property_node AND tax.reservation_id=v_posting.reservation_id
     AND tax.folio_id=v_posting.folio_id AND tax.valuation_id=v_posting.valuation_id
     AND tax.valuation_generation=v_posting.valuation_generation
     AND tax.applicability_id=v_posting.applicability_id AND tax.currency='INR'
     AND NOT EXISTS (SELECT 1 FROM public.india_gst_accommodation_final_component_tax AS successor
                      WHERE successor.tenant_id=tax.tenant_id AND successor.supersedes_tax_id=tax.id)
   FOR KEY SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='current India component-tax root is unavailable'; END IF;

  PERFORM 1 FROM public.india_gst_accommodation_final_valuation AS valuation
   WHERE valuation.tenant_id=p_tenant_id AND valuation.id=v_posting.valuation_id
     AND valuation.generation=v_posting.valuation_generation
     AND valuation.evidence_hash=v_tax.final_valuation_evidence_hash
     AND NOT EXISTS (SELECT 1 FROM public.india_gst_accommodation_final_valuation AS successor
                      WHERE successor.tenant_id=valuation.tenant_id AND successor.supersedes_valuation_id=valuation.id);
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='current India component-tax valuation is unavailable'; END IF;
  PERFORM 1 FROM public.india_gst_accommodation_quoted_rate_applicability AS applicability
   WHERE applicability.tenant_id=p_tenant_id AND applicability.id=v_posting.applicability_id
     AND applicability.evidence_hash=v_tax.quoted_rate_applicability_evidence_hash
     AND applicability.final_valuation_id=v_posting.valuation_id
     AND applicability.property_node=p_property_node
     AND applicability.reservation_id=v_posting.reservation_id AND applicability.folio_id=v_posting.folio_id;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='India component-tax applicability is unavailable'; END IF;

  SELECT original.* INTO v_original FROM public.journal AS original
   WHERE original.tenant_id=p_tenant_id AND original.id=p_original_journal_id
     AND original.property_node=p_property_node AND original.business_date=v_posting.business_date
     AND original.kind='charge' AND original.reverses IS NULL AND original.currency='INR'
     AND original.source=pg_catalog.jsonb_build_object(
       'interface','financials.india-final-component-tax.post','tax_id',v_posting.tax_id::text);
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='governed India component-tax original journal is unavailable'; END IF;
  IF EXISTS (SELECT 1 FROM public.business_day AS original_day
              WHERE original_day.tenant_id=p_tenant_id AND original_day.property_node=p_property_node
                AND original_day.business_date=v_original.business_date AND original_day.sealed_at IS NOT NULL)
     AND NOT p_post_seal_authorized THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='post-seal India component-tax reversal authority is required';
  END IF;

  PERFORM 1 FROM public.app_user AS actor
   WHERE actor.tenant_id=p_tenant_id AND actor.id=p_actor_id AND actor.status='active';
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='India component-tax reversal actor is unavailable'; END IF;

  SELECT reversal.* INTO v_reversal FROM public.journal AS reversal
   WHERE reversal.tenant_id=p_tenant_id AND reversal.id=p_reversal_journal_id
     AND reversal.property_node=p_property_node AND reversal.kind='adjustment'
     AND reversal.reverses=p_original_journal_id AND reversal.currency='INR'
     AND reversal.created_by=p_actor_id
     AND reversal.source=pg_catalog.jsonb_build_object(
       'interface','financials.india-final-component-tax.reverse',
       'original_journal_id',p_original_journal_id::text,'tax_id',v_posting.tax_id::text);
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='governed India component-tax reversal journal is unavailable'; END IF;
  PERFORM 1 FROM public.business_day AS reversal_day
   WHERE reversal_day.tenant_id=p_tenant_id AND reversal_day.property_node=p_property_node
     AND reversal_day.business_date=v_reversal.business_date AND reversal_day.sealed_at IS NULL
     AND reversal_day.business_date=(pg_catalog.transaction_timestamp() AT TIME ZONE
       (SELECT property.timezone FROM public.org_node AS property
         WHERE property.tenant_id=p_tenant_id AND property.id=p_property_node AND property.kind='property'))::date;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0011',MESSAGE='India component-tax reversal business day is missing or sealed'; END IF;

  SELECT pg_catalog.count(*)::integer,COALESCE(pg_catalog.sum(original_line.amount_minor::numeric),0)
    INTO v_original_count,v_original_balance
    FROM public.posting_line AS original_line
   WHERE original_line.tenant_id=p_tenant_id AND original_line.journal_id=p_original_journal_id;
  SELECT pg_catalog.count(*)::integer,COALESCE(pg_catalog.sum(reversal_line.amount_minor::numeric),0)
    INTO v_reversal_count,v_reversal_balance
    FROM public.posting_line AS reversal_line
   WHERE reversal_line.tenant_id=p_tenant_id AND reversal_line.journal_id=p_reversal_journal_id;
  SELECT root_line.* INTO v_original_root
    FROM public.posting_line AS root_line
   WHERE root_line.tenant_id=p_tenant_id AND root_line.journal_id=p_original_journal_id
     AND root_line.seq=1 AND root_line.folio_id=v_posting.folio_id
     AND root_line.account_id=v_posting.guest_account_id
     AND root_line.tax_detail->>'schemaVersion'='india_accommodation_component_tax_v1'
     AND root_line.tax_detail#>>'{tax,taxId}'=v_posting.tax_id::text
     AND root_line.tax_detail#>>'{tax,evidenceHash}'=v_posting.tax_evidence_hash
     AND root_line.tax_detail#>>'{posting,journalId}'=p_original_journal_id::text;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='India component-tax reversal root lineage is inconsistent';
  END IF;

  SELECT pg_catalog.count(*)::integer INTO v_mismatches
    FROM public.posting_line AS original_line
    LEFT JOIN public.posting_line AS reversal_line
      ON reversal_line.tenant_id=original_line.tenant_id
     AND reversal_line.journal_id=p_reversal_journal_id AND reversal_line.seq=original_line.seq
   WHERE original_line.tenant_id=p_tenant_id AND original_line.journal_id=p_original_journal_id
     AND original_line.seq>1
     AND (reversal_line.id IS NULL
       OR reversal_line.account_id<>original_line.account_id
       OR reversal_line.folio_id IS DISTINCT FROM original_line.folio_id
       OR reversal_line.tx_code<>original_line.tx_code
       OR reversal_line.description<>original_line.description
       OR reversal_line.amount_minor<>-original_line.amount_minor
       OR reversal_line.quantity<>original_line.quantity
       OR reversal_line.tax_detail IS DISTINCT FROM original_line.tax_detail
       OR reversal_line.folio_transfer_root_line_id IS DISTINCT FROM original_line.folio_transfer_root_line_id
       OR reversal_line.business_date<>v_reversal.business_date
       OR reversal_line.currency<>original_line.currency);
  IF v_original_count<3 OR v_reversal_count<>v_original_count-1 OR v_mismatches<>0
     OR v_original_balance<>0
     OR EXISTS (SELECT 1 FROM public.posting_line AS unexpected_root
                 WHERE unexpected_root.tenant_id=p_tenant_id
                   AND unexpected_root.journal_id=p_reversal_journal_id AND unexpected_root.seq=1)
     OR (SELECT pg_catalog.count(*) FROM public.posting_line AS detail_line
          WHERE detail_line.tenant_id=p_tenant_id AND detail_line.journal_id=p_original_journal_id
            AND detail_line.tax_detail IS NOT NULL)<>1 THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='India component-tax reversal posting set is inconsistent';
  END IF;

  INSERT INTO public.posting_line(
    tenant_id,journal_id,seq,account_id,folio_id,tx_code,description,amount_minor,
    quantity,tax_detail,folio_transfer_root_line_id,business_date,currency)
  VALUES(p_tenant_id,p_reversal_journal_id,1,v_original_root.account_id,v_original_root.folio_id,
    v_original_root.tx_code,v_original_root.description,-v_original_root.amount_minor,
    v_original_root.quantity,v_original_root.tax_detail,v_original_root.folio_transfer_root_line_id,
    v_reversal.business_date,v_original_root.currency);

  SELECT pg_catalog.count(*)::integer,COALESCE(pg_catalog.sum(reversal_line.amount_minor::numeric),0)
    INTO v_reversal_count,v_reversal_balance
    FROM public.posting_line AS reversal_line
   WHERE reversal_line.tenant_id=p_tenant_id AND reversal_line.journal_id=p_reversal_journal_id;
  SELECT pg_catalog.count(*)::integer INTO v_mismatches
    FROM public.posting_line AS original_line
    LEFT JOIN public.posting_line AS reversal_line
      ON reversal_line.tenant_id=original_line.tenant_id
     AND reversal_line.journal_id=p_reversal_journal_id AND reversal_line.seq=original_line.seq
     AND reversal_line.account_id=original_line.account_id
     AND reversal_line.folio_id IS NOT DISTINCT FROM original_line.folio_id
     AND reversal_line.tx_code=original_line.tx_code
     AND reversal_line.description=original_line.description
     AND reversal_line.amount_minor=-original_line.amount_minor
     AND reversal_line.quantity=original_line.quantity
     AND reversal_line.tax_detail IS NOT DISTINCT FROM original_line.tax_detail
     AND reversal_line.folio_transfer_root_line_id IS NOT DISTINCT FROM original_line.folio_transfer_root_line_id
     AND reversal_line.business_date=v_reversal.business_date
     AND reversal_line.currency=original_line.currency
   WHERE original_line.tenant_id=p_tenant_id AND original_line.journal_id=p_original_journal_id
     AND reversal_line.id IS NULL;
  IF v_reversal_count<>v_original_count OR v_reversal_balance<>0 OR v_mismatches<>0 THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='India component-tax reversal failed exact nullification';
  END IF;

  INSERT INTO public.india_gst_final_component_tax_journal_reversal_binding(
    tenant_id,property_node,reversed_by,posting_binding_id,tax_id,original_journal_id,
    reversal_journal_id,reservation_id,folio_id,currency,business_date)
  VALUES(p_tenant_id,p_property_node,p_actor_id,v_posting.id,v_posting.tax_id,p_original_journal_id,
    p_reversal_journal_id,v_posting.reservation_id,v_posting.folio_id,'INR',v_reversal.business_date)
  RETURNING * INTO v_created;
  RETURN QUERY SELECT v_created.id,v_created.posting_binding_id,v_created.tax_id,
    v_created.original_journal_id,v_created.reversal_journal_id,v_created.reservation_id,
    v_created.folio_id,v_created.business_date,v_created.currency,v_reversal_count,true;
END;
$$;

ALTER FUNCTION public.record_india_final_component_tax_journal_reversal(
  uuid,uuid,uuid,uuid,uuid,boolean) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.record_india_final_component_tax_journal_reversal(
  uuid,uuid,uuid,uuid,uuid,boolean) FROM PUBLIC,app_role,yellow_runtime;
GRANT EXECUTE ON FUNCTION public.record_india_final_component_tax_journal_reversal(
  uuid,uuid,uuid,uuid,uuid,boolean) TO app_role;
