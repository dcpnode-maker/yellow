-- Order 407: bind one governed India final component-tax root to one balanced
-- charge journal. The application inserts only the null-tax credit lines; this
-- owner capability reconstructs persisted statutory and routing truth, inserts
-- the guest root carrying canonical tax detail, and appends immutable lineage.

ALTER TABLE public.india_gst_accommodation_final_component_tax
  ADD CONSTRAINT india_gst_final_component_tax_posting_identity_uq
  UNIQUE (
    tenant_id,id,property_node,reservation_id,folio_id,applicability_id,
    valuation_id,valuation_generation,generation,currency,evidence_hash
  );

CREATE TABLE public.india_gst_accommodation_final_component_tax_journal_binding (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT pg_catalog.gen_random_uuid(),
  property_node uuid NOT NULL,
  posted_by uuid NOT NULL,
  tax_id uuid NOT NULL,
  tax_generation integer NOT NULL CHECK (tax_generation >= 0),
  tax_evidence_hash text NOT NULL CHECK (tax_evidence_hash ~ '^[0-9a-f]{64}$'),
  valuation_id uuid NOT NULL,
  valuation_generation integer NOT NULL CHECK (valuation_generation >= 0),
  applicability_id uuid NOT NULL,
  reservation_id uuid NOT NULL,
  folio_id uuid NOT NULL,
  guest_account_id uuid NOT NULL,
  journal_id uuid NOT NULL,
  currency character(3) NOT NULL CHECK (currency = 'INR'),
  business_date date NOT NULL CHECK (pg_catalog.isfinite(business_date)),
  posted_at timestamptz NOT NULL DEFAULT pg_catalog.transaction_timestamp(),
  CONSTRAINT india_gst_final_component_tax_journal_binding_pk PRIMARY KEY (tenant_id,id),
  CONSTRAINT india_gst_final_component_tax_journal_binding_tax_uq UNIQUE (tenant_id,tax_id),
  CONSTRAINT india_gst_final_component_tax_journal_binding_journal_uq UNIQUE (tenant_id,journal_id),
  CONSTRAINT india_gst_final_component_tax_journal_binding_property_fk
    FOREIGN KEY (tenant_id,property_node) REFERENCES public.org_node(tenant_id,id),
  CONSTRAINT india_gst_final_component_tax_journal_binding_actor_fk
    FOREIGN KEY (tenant_id,posted_by) REFERENCES public.app_user(tenant_id,id),
  CONSTRAINT india_gst_final_component_tax_journal_binding_tax_fk
    FOREIGN KEY (
      tenant_id,tax_id,property_node,reservation_id,folio_id,applicability_id,
      valuation_id,valuation_generation,tax_generation,currency,tax_evidence_hash
    ) REFERENCES public.india_gst_accommodation_final_component_tax (
      tenant_id,id,property_node,reservation_id,folio_id,applicability_id,
      valuation_id,valuation_generation,generation,currency,evidence_hash
    ),
  CONSTRAINT india_gst_final_component_tax_journal_binding_account_fk
    FOREIGN KEY (tenant_id,property_node,currency,guest_account_id)
    REFERENCES public.account(tenant_id,property_node,currency,id),
  CONSTRAINT india_gst_final_component_tax_journal_binding_folio_fk
    FOREIGN KEY (tenant_id,guest_account_id,folio_id)
    REFERENCES public.folio(tenant_id,account_id,id),
  CONSTRAINT india_gst_final_component_tax_journal_binding_journal_fk
    FOREIGN KEY (tenant_id,journal_id,property_node,business_date,currency)
    REFERENCES public.journal(tenant_id,id,property_node,business_date,currency)
);

CREATE INDEX india_gst_final_component_tax_journal_binding_property_lookup
  ON public.india_gst_accommodation_final_component_tax_journal_binding
  (tenant_id,property_node,business_date,posted_at,id);
CREATE INDEX india_gst_final_component_tax_journal_binding_valuation_lookup
  ON public.india_gst_accommodation_final_component_tax_journal_binding
  (tenant_id,valuation_id,valuation_generation,posted_at,id);

ALTER TABLE public.india_gst_accommodation_final_component_tax_journal_binding ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.india_gst_accommodation_final_component_tax_journal_binding FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON public.india_gst_accommodation_final_component_tax_journal_binding
  USING (tenant_id=NULLIF(pg_catalog.current_setting('app.tenant_id',true),'')::uuid)
  WITH CHECK (tenant_id=NULLIF(pg_catalog.current_setting('app.tenant_id',true),'')::uuid);
REVOKE ALL ON TABLE public.india_gst_accommodation_final_component_tax_journal_binding
  FROM PUBLIC,app_role,yellow_runtime;
GRANT SELECT ON public.india_gst_accommodation_final_component_tax_journal_binding TO app_role;
ALTER TABLE public.india_gst_accommodation_final_component_tax_journal_binding OWNER TO yellow_owner;

CREATE FUNCTION public.record_india_final_component_tax_journal_binding(
  p_tenant_id uuid,
  p_property_node uuid,
  p_actor_id uuid,
  p_tax_id uuid,
  p_folio_id uuid,
  p_journal_id uuid,
  p_revenue_mapping_id uuid,
  p_component_mapping_ids uuid[],
  p_tax_detail jsonb
) RETURNS TABLE (
  posting_binding_id uuid,
  tax_id uuid,
  tax_generation integer,
  valuation_id uuid,
  applicability_id uuid,
  reservation_id uuid,
  folio_id uuid,
  journal_id uuid,
  currency character(3),
  business_date date,
  created boolean
)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_context_tenant uuid;
  v_tax public.india_gst_accommodation_final_component_tax%ROWTYPE;
  v_binding public.india_gst_accommodation_final_component_tax_journal_binding%ROWTYPE;
  v_created public.india_gst_accommodation_final_component_tax_journal_binding%ROWTYPE;
  v_journal public.journal%ROWTYPE;
  v_folio record;
  v_applicability record;
  v_revenue record;
  v_components jsonb;
  v_expected_detail jsonb;
  v_root_detail jsonb;
  v_mapping_count integer;
  v_nonzero_components integer;
  v_valid_component_routes integer;
  v_component_count integer;
  v_component_total numeric;
  v_night_count integer;
  v_credit_lines integer;
BEGIN
  IF session_user <> 'yellow_runtime'
     OR pg_catalog.current_setting('role',true) IS DISTINCT FROM 'app_role'
     OR current_user <> 'yellow_owner' THEN
    RAISE EXCEPTION USING ERRCODE='42501',
      MESSAGE='India component-tax journal binding requires the governed runtime app role';
  END IF;
  BEGIN
    v_context_tenant := NULLIF(pg_catalog.current_setting('app.tenant_id',true),'')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE='42501',
      MESSAGE='India component-tax journal binding tenant context is invalid';
  END;
  IF v_context_tenant IS NULL OR p_tenant_id IS NULL OR v_context_tenant<>p_tenant_id THEN
    RAISE EXCEPTION USING ERRCODE='42501',
      MESSAGE='India component-tax journal binding tenant context is invalid';
  END IF;

  v_mapping_count := pg_catalog.cardinality(p_component_mapping_ids);
  IF p_property_node IS NULL OR p_actor_id IS NULL OR p_tax_id IS NULL
     OR p_folio_id IS NULL OR p_journal_id IS NULL OR p_revenue_mapping_id IS NULL
     OR p_component_mapping_ids IS NULL OR v_mapping_count>4
     OR EXISTS (SELECT 1 FROM pg_catalog.unnest(p_component_mapping_ids) AS requested(id) WHERE id IS NULL)
     OR (SELECT pg_catalog.count(DISTINCT id) FROM pg_catalog.unnest(p_component_mapping_ids) AS requested(id))<>v_mapping_count
     OR p_tax_detail IS NULL OR pg_catalog.jsonb_typeof(p_tax_detail)<>'object'
     OR p_tax_detail->>'schemaVersion' IS DISTINCT FROM 'india_accommodation_component_tax_v1'
     OR pg_catalog.octet_length(pg_catalog.convert_to(p_tax_detail::text,'UTF8')) NOT BETWEEN 1 AND 8388608 THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='India component-tax journal binding input is invalid';
  END IF;

  PERFORM 1 FROM public.tenant AS target_tenant
   WHERE target_tenant.id=p_tenant_id AND target_tenant.status='active';
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='India component-tax journal binding authority is unavailable'; END IF;
  PERFORM 1 FROM public.org_node AS property
   WHERE property.tenant_id=p_tenant_id AND property.id=p_property_node AND property.kind='property';
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='India component-tax journal binding authority is unavailable'; END IF;
  PERFORM 1 FROM public.app_user AS actor
   WHERE actor.tenant_id=p_tenant_id AND actor.id=p_actor_id AND actor.status='active';
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='India component-tax journal binding authority is unavailable'; END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'india-final-component-tax-journal-binding:'||p_tenant_id::text||':'||p_tax_id::text,407));
  SELECT binding.* INTO v_binding
    FROM public.india_gst_accommodation_final_component_tax_journal_binding AS binding
   WHERE binding.tenant_id=p_tenant_id AND binding.tax_id=p_tax_id;
  IF FOUND THEN
    IF v_binding.property_node IS DISTINCT FROM p_property_node
       OR v_binding.posted_by IS DISTINCT FROM p_actor_id
       OR v_binding.folio_id IS DISTINCT FROM p_folio_id
       OR v_binding.journal_id IS DISTINCT FROM p_journal_id THEN
      RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='India component-tax root already has a divergent journal binding';
    END IF;
    SELECT root.tax_detail INTO v_root_detail FROM public.posting_line AS root
     WHERE root.tenant_id=p_tenant_id AND root.journal_id=p_journal_id AND root.seq=1
       AND root.account_id=v_binding.guest_account_id AND root.folio_id=p_folio_id;
    IF NOT FOUND OR v_root_detail IS DISTINCT FROM p_tax_detail THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='India component-tax journal binding evidence is inconsistent';
    END IF;
    RETURN QUERY SELECT v_binding.id,v_binding.tax_id,v_binding.tax_generation,
      v_binding.valuation_id,v_binding.applicability_id,v_binding.reservation_id,
      v_binding.folio_id,v_binding.journal_id,v_binding.currency,v_binding.business_date,false;
    RETURN;
  END IF;

  SELECT tax.* INTO v_tax
    FROM public.india_gst_accommodation_final_component_tax AS tax
   WHERE tax.tenant_id=p_tenant_id AND tax.id=p_tax_id
     AND tax.property_node=p_property_node AND tax.folio_id=p_folio_id
     AND tax.currency='INR'
     AND NOT EXISTS (SELECT 1 FROM public.india_gst_accommodation_final_component_tax AS successor
                      WHERE successor.tenant_id=tax.tenant_id AND successor.supersedes_tax_id=tax.id)
   FOR KEY SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='current India component-tax root is unavailable'; END IF;

  SELECT applicability.evidence_hash AS applicability_evidence_hash,
         applicability.selected_content_hash,
         valuation.evidence_hash AS valuation_evidence_hash
    INTO v_applicability
    FROM public.india_gst_accommodation_final_valuation AS valuation
    JOIN public.india_gst_accommodation_quoted_rate_applicability AS applicability
      ON applicability.tenant_id=v_tax.tenant_id AND applicability.id=v_tax.applicability_id
     AND applicability.property_node=v_tax.property_node
     AND applicability.reservation_id=v_tax.reservation_id AND applicability.folio_id=v_tax.folio_id
     AND applicability.final_valuation_id=v_tax.valuation_id
     AND applicability.component_family=v_tax.component_family
     AND applicability.selected_extension_id=v_tax.selected_extension_id
     AND applicability.selected_extension_version=v_tax.selected_extension_version
     AND applicability.evidence_hash=v_tax.quoted_rate_applicability_evidence_hash
   WHERE valuation.tenant_id=v_tax.tenant_id AND valuation.id=v_tax.valuation_id
     AND valuation.property_node=v_tax.property_node AND valuation.reservation_id=v_tax.reservation_id
     AND valuation.folio_id=v_tax.folio_id AND valuation.generation=v_tax.valuation_generation
     AND valuation.disposition='ordinary_final' AND valuation.currency='INR'
     AND valuation.evidence_hash=v_tax.final_valuation_evidence_hash
     AND NOT EXISTS (SELECT 1 FROM public.india_gst_accommodation_final_valuation AS successor
                      WHERE successor.tenant_id=valuation.tenant_id AND successor.supersedes_valuation_id=valuation.id);
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='current India component-tax ancestry is unavailable'; END IF;

  SELECT folio.id,folio.account_id
    INTO v_folio FROM public.folio
    JOIN public.account ON account.tenant_id=folio.tenant_id AND account.id=folio.account_id
   WHERE folio.tenant_id=p_tenant_id AND folio.id=p_folio_id
     AND folio.reservation_id=v_tax.reservation_id AND folio.window_no=1 AND folio.status='open'
     AND account.property_node=p_property_node AND account.currency='INR'
     AND account.role='guest' AND account.status='open';
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='India component-tax primary folio is unavailable'; END IF;

  SELECT target_journal.* INTO v_journal FROM public.journal AS target_journal
   WHERE target_journal.tenant_id=p_tenant_id AND target_journal.id=p_journal_id
     AND target_journal.property_node=p_property_node AND target_journal.kind='charge'
     AND target_journal.reverses IS NULL AND target_journal.currency='INR'
     AND target_journal.created_by=p_actor_id
     AND target_journal.source=pg_catalog.jsonb_build_object('interface','financials.india-final-component-tax.post','tax_id',p_tax_id::text);
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='governed India component-tax journal header is unavailable'; END IF;
  PERFORM 1 FROM public.business_day AS target_day
   WHERE target_day.tenant_id=p_tenant_id AND target_day.property_node=p_property_node
     AND target_day.business_date=v_journal.business_date AND target_day.sealed_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0011',MESSAGE='India component-tax journal business day is missing or sealed'; END IF;

  SELECT mapping.id AS mapping_id,mapping.tx_code,route.credit_account_id
    INTO v_revenue FROM public.tax_semantic_route AS mapping
    JOIN public.tx_code AS code ON code.code=mapping.tx_code AND code.grp='revenue'
      AND code.usali_line IS NOT NULL AND pg_catalog.btrim(code.usali_line)<>''
    JOIN public.tx_code_route AS route ON route.tenant_id=mapping.tenant_id
      AND route.property_node=mapping.property_node AND route.currency=mapping.currency AND route.tx_code=mapping.tx_code
    JOIN public.account AS account ON account.tenant_id=route.tenant_id AND account.id=route.credit_account_id
      AND account.property_node=route.property_node AND account.currency=route.currency
      AND account.role='revenue' AND account.status='open'
   WHERE mapping.tenant_id=p_tenant_id AND mapping.id=p_revenue_mapping_id
     AND mapping.property_node=p_property_node AND mapping.currency='INR'
     AND mapping.jurisdiction_extension_id=v_tax.selected_extension_id
     AND mapping.jurisdiction_owner_tenant_id IS NULL
     AND mapping.jurisdiction_key='in-gst-lodging'
     AND mapping.jurisdiction_version=v_tax.selected_extension_version
     AND mapping.jurisdiction_content_hash=v_applicability.selected_content_hash
     AND mapping.semantic_kind='revenue' AND mapping.semantic_code='room_revenue';
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='configured India component-tax revenue route is unavailable'; END IF;

  SELECT pg_catalog.count(*)::integer,pg_catalog.sum(night.tax_minor)::numeric
    INTO v_night_count,v_component_total
    FROM public.india_gst_accommodation_final_component_tax_room_night AS night
   WHERE night.tenant_id=p_tenant_id AND night.tax_id=p_tax_id AND night.currency='INR';
  IF v_night_count<1 OR v_component_total<>v_tax.tax_minor::numeric
     OR (SELECT pg_catalog.sum(night.final_value_minor)::numeric
           FROM public.india_gst_accommodation_final_component_tax_room_night AS night
          WHERE night.tenant_id=p_tenant_id AND night.tax_id=p_tax_id)<>v_tax.transaction_value_minor::numeric
     OR (SELECT pg_catalog.min(night.ordinal)
           FROM public.india_gst_accommodation_final_component_tax_room_night AS night
          WHERE night.tenant_id=p_tenant_id AND night.tax_id=p_tax_id)<>0
     OR (SELECT pg_catalog.max(night.ordinal)
           FROM public.india_gst_accommodation_final_component_tax_room_night AS night
          WHERE night.tenant_id=p_tenant_id AND night.tax_id=p_tax_id)<>v_night_count-1 THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='India component-tax room-night evidence is incoherent';
  END IF;

  SELECT pg_catalog.count(*)::integer,pg_catalog.sum(component.tax_amount_minor)::numeric
    INTO v_component_count,v_component_total
    FROM public.india_gst_accommodation_final_component_tax_component AS component
   WHERE component.tenant_id=p_tenant_id AND component.tax_id=p_tax_id AND component.currency='INR';
  IF v_component_total<>v_tax.tax_minor::numeric
     OR v_component_count<>v_night_count*(CASE WHEN v_tax.component_family='igst' THEN 1 ELSE 2 END)
     OR EXISTS (
       SELECT 1 FROM public.india_gst_accommodation_final_component_tax_component AS component
        WHERE component.tenant_id=p_tenant_id AND component.tax_id=p_tax_id
          AND CASE v_tax.component_family
            WHEN 'igst' THEN component.component_identity<>'igst' OR component.component_ordinal<>0
            WHEN 'cgst_sgst' THEN (component.component_identity,component.component_ordinal)
              NOT IN (('cgst',0::smallint),('sgst',1::smallint))
            WHEN 'cgst_utgst' THEN (component.component_identity,component.component_ordinal)
              NOT IN (('cgst',0::smallint),('utgst',1::smallint)) END
     ) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='India component-tax component evidence is incoherent';
  END IF;

  WITH component_totals AS (
    SELECT component.component_identity,pg_catalog.sum(component.tax_amount_minor)::bigint AS amount_minor,
           pg_catalog.min(component.component_ordinal) AS component_ordinal
      FROM public.india_gst_accommodation_final_component_tax_component AS component
     WHERE component.tenant_id=p_tenant_id AND component.tax_id=p_tax_id AND component.currency='INR'
     GROUP BY component.component_identity
  ), canonical AS (
    SELECT *,CASE component_identity WHEN 'igst' THEN 'IGST' WHEN 'cgst' THEN 'CGST'
      WHEN 'sgst' THEN 'SGST' WHEN 'utgst' THEN 'UTGST' END AS semantic_code,
      pg_catalog.row_number() OVER (ORDER BY component_ordinal,component_identity) AS canonical_ordinal,
      pg_catalog.count(*) FILTER (WHERE amount_minor>0)
        OVER (ORDER BY component_ordinal,component_identity) AS nonzero_ordinal
      FROM component_totals
  ), resolved AS (
    SELECT canonical.*,mapping.id AS mapping_id,mapping.tx_code,route.credit_account_id
      FROM canonical LEFT JOIN pg_catalog.unnest(p_component_mapping_ids) WITH ORDINALITY AS requested(mapping_id,ordinality)
        ON requested.ordinality=canonical.nonzero_ordinal AND canonical.amount_minor>0
      LEFT JOIN public.tax_semantic_route AS mapping ON mapping.tenant_id=p_tenant_id
        AND mapping.id=requested.mapping_id AND mapping.property_node=p_property_node AND mapping.currency='INR'
        AND mapping.jurisdiction_extension_id=v_tax.selected_extension_id
        AND mapping.jurisdiction_owner_tenant_id IS NULL AND mapping.jurisdiction_key='in-gst-lodging'
        AND mapping.jurisdiction_version=v_tax.selected_extension_version
        AND mapping.jurisdiction_content_hash=v_applicability.selected_content_hash
        AND mapping.semantic_kind='tax' AND mapping.semantic_code=canonical.semantic_code
      LEFT JOIN public.tx_code AS code ON code.code=mapping.tx_code AND code.grp='tax'
      LEFT JOIN public.tx_code_route AS route ON route.tenant_id=mapping.tenant_id
        AND route.property_node=mapping.property_node AND route.currency=mapping.currency AND route.tx_code=mapping.tx_code
      LEFT JOIN public.account AS account ON account.tenant_id=route.tenant_id AND account.id=route.credit_account_id
        AND account.property_node=route.property_node AND account.currency=route.currency
        AND account.role='tax_payable' AND account.status='open'
  )
  SELECT pg_catalog.count(*) FILTER (WHERE amount_minor>0)::integer,
         pg_catalog.count(*) FILTER (WHERE amount_minor>0 AND mapping_id IS NOT NULL
           AND tx_code IS NOT NULL AND credit_account_id IS NOT NULL)::integer,
         pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'componentIdentity',component_identity,'semanticCode',semantic_code,'amountMinor',amount_minor::text,
           'route',CASE WHEN amount_minor=0 THEN 'null'::jsonb ELSE pg_catalog.jsonb_build_object(
             'mappingId',mapping_id::text,'semanticCode',semantic_code,'txCode',tx_code,'creditAccountId',credit_account_id::text) END
         ) ORDER BY canonical_ordinal)
    INTO v_nonzero_components,v_valid_component_routes,v_components FROM resolved;
  IF v_components IS NULL OR v_nonzero_components<>v_mapping_count
     OR v_valid_component_routes<>v_nonzero_components
     OR pg_catalog.jsonb_array_length(v_components)<>(CASE WHEN v_tax.component_family='igst' THEN 1 ELSE 2 END) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='configured India component-tax route set is incoherent';
  END IF;

  v_expected_detail:=pg_catalog.jsonb_build_object(
    'schemaVersion','india_accommodation_component_tax_v1',
    'tax',pg_catalog.jsonb_build_object('taxId',v_tax.id::text,'taxGeneration',v_tax.generation,'evidenceHash',v_tax.evidence_hash),
    'valuation',pg_catalog.jsonb_build_object('valuationId',v_tax.valuation_id::text,'valuationGeneration',v_tax.valuation_generation,'evidenceHash',v_tax.final_valuation_evidence_hash),
    'applicability',pg_catalog.jsonb_build_object('applicabilityId',v_tax.applicability_id::text,'evidenceHash',v_applicability.applicability_evidence_hash),
    'posting',pg_catalog.jsonb_build_object('propertyNode',p_property_node::text,'reservationId',v_tax.reservation_id::text,'folioId',p_folio_id::text,'journalId',p_journal_id::text,'currency','INR'),
    'totals',pg_catalog.jsonb_build_object('transactionValueMinor',v_tax.transaction_value_minor::text,'taxMinor',v_tax.tax_minor::text,'grandTotalMinor',v_tax.grand_total_minor::text),
    'componentFamily',v_tax.component_family,
    'jurisdiction',pg_catalog.jsonb_build_object('extensionId',v_tax.selected_extension_id::text,'ownerTenantId','null'::jsonb,'key','in-gst-lodging','version',v_tax.selected_extension_version,'contentHash',v_applicability.selected_content_hash),
    'revenueRoute',pg_catalog.jsonb_build_object('mappingId',v_revenue.mapping_id::text,'semanticCode','room_revenue','txCode',v_revenue.tx_code,'creditAccountId',v_revenue.credit_account_id::text),
    'components',v_components);
  IF p_tax_detail IS DISTINCT FROM v_expected_detail THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='India component-tax detail does not match canonical posting evidence';
  END IF;

  IF EXISTS (SELECT 1 FROM public.posting_line AS root
              WHERE root.tenant_id=p_tenant_id AND root.journal_id=p_journal_id AND root.seq=1) THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='India component-tax journal guest root already exists without binding';
  END IF;
  WITH nonzero AS (
    SELECT value,pg_catalog.row_number() OVER () AS ordinal
      FROM pg_catalog.jsonb_array_elements(v_components) AS component(value)
     WHERE (value->>'amountMinor')::bigint>0
  ), expected AS (
    SELECT (ordinal+2)::smallint AS seq,(value#>>'{route,txCode}') AS tx_code,
      (value#>>'{route,creditAccountId}')::uuid AS account_id,-((value->>'amountMinor')::bigint) AS amount_minor
      FROM nonzero
    UNION ALL SELECT 2,v_revenue.tx_code,v_revenue.credit_account_id,-v_tax.transaction_value_minor
  )
  SELECT pg_catalog.count(*)::integer INTO v_credit_lines FROM expected
    JOIN public.posting_line AS line ON line.tenant_id=p_tenant_id AND line.journal_id=p_journal_id
      AND line.seq=expected.seq AND line.tx_code=expected.tx_code AND line.account_id=expected.account_id
      AND line.amount_minor=expected.amount_minor AND line.folio_id IS NULL AND line.quantity=1.000::numeric(10,3)
      AND line.tax_detail IS NULL AND line.folio_transfer_root_line_id IS NULL
      AND line.business_date=v_journal.business_date AND line.currency='INR';
  IF v_credit_lines<>v_nonzero_components+1 OR
     (SELECT pg_catalog.count(*) FROM public.posting_line AS existing_line
       WHERE existing_line.tenant_id=p_tenant_id AND existing_line.journal_id=p_journal_id)<>v_nonzero_components+1 THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='India component-tax journal credit posting set is inconsistent';
  END IF;

  INSERT INTO public.posting_line(tenant_id,journal_id,seq,account_id,folio_id,tx_code,description,
    amount_minor,quantity,tax_detail,business_date,currency)
  VALUES(p_tenant_id,p_journal_id,1,v_folio.account_id,p_folio_id,v_revenue.tx_code,v_journal.description,
    v_tax.grand_total_minor,1.000::numeric(10,3),p_tax_detail,v_journal.business_date,'INR');
  INSERT INTO public.india_gst_accommodation_final_component_tax_journal_binding(
    tenant_id,property_node,posted_by,tax_id,tax_generation,tax_evidence_hash,valuation_id,
    valuation_generation,applicability_id,reservation_id,folio_id,guest_account_id,journal_id,currency,business_date)
  VALUES(p_tenant_id,p_property_node,p_actor_id,v_tax.id,v_tax.generation,v_tax.evidence_hash,v_tax.valuation_id,
    v_tax.valuation_generation,v_tax.applicability_id,v_tax.reservation_id,p_folio_id,v_folio.account_id,p_journal_id,'INR',v_journal.business_date)
  RETURNING * INTO v_created;
  RETURN QUERY SELECT v_created.id,v_created.tax_id,v_created.tax_generation,v_created.valuation_id,
    v_created.applicability_id,v_created.reservation_id,v_created.folio_id,v_created.journal_id,
    v_created.currency,v_created.business_date,true;
END;
$$;

ALTER FUNCTION public.record_india_final_component_tax_journal_binding(
  uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid[],jsonb) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.record_india_final_component_tax_journal_binding(
  uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid[],jsonb) FROM PUBLIC,app_role,yellow_runtime;
GRANT EXECUTE ON FUNCTION public.record_india_final_component_tax_journal_binding(
  uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid[],jsonb) TO app_role;
