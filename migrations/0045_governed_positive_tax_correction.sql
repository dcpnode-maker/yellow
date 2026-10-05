-- Order 266: create one immutable, complete reversal of an Order-262
-- positive-tax journal.  The application may create the bounded header and
-- copy only sequences 2..N.  The owner capability proves the original
-- binding and the complete sign-negated posting set, then inserts the sole
-- reversal root with canonical tax-lineage evidence.

CREATE FUNCTION public.create_positive_tax_correction_header(
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
  v_binding public.tax_attribution_journal_binding%ROWTYPE;
  v_original public.journal%ROWTYPE;
  v_business_date date;
  v_journal_id uuid;
BEGIN
  IF session_user <> 'yellow_runtime'
     OR pg_catalog.current_setting('role', true) IS DISTINCT FROM 'app_role'
     OR current_user <> 'yellow_owner' THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'positive-tax correction header requires the governed runtime app role';
  END IF;

  BEGIN
    v_context_tenant := NULLIF(
      pg_catalog.current_setting('app.tenant_id', true), ''
    )::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'positive-tax correction header tenant context is invalid';
  END;
  IF v_context_tenant IS NULL OR p_tenant_id IS NULL
     OR v_context_tenant <> p_tenant_id THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'positive-tax correction header tenant context is invalid';
  END IF;

  IF p_original_journal_id IS NULL OR p_property_node IS NULL
     OR p_actor_id IS NULL OR p_description IS NULL
     OR p_description <> pg_catalog.btrim(p_description)
     OR pg_catalog.char_length(p_description) NOT BETWEEN 1 AND 500
     OR p_description ~ '[[:cntrl:]]'
     OR p_description ~ U&'[\200B-\200D\202A-\202E\2060\2066-\2069\FEFF]' THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'positive-tax correction header input is invalid';
  END IF;

  PERFORM 1
    FROM public.tenant AS tenant
   WHERE tenant.id = p_tenant_id
     AND tenant.status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'positive-tax correction authority is unavailable';
  END IF;

  SELECT binding.*
    INTO v_binding
    FROM public.tax_attribution_journal_binding AS binding
   WHERE binding.tenant_id = p_tenant_id
     AND binding.property_node = p_property_node
     AND binding.journal_id = p_original_journal_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'governed positive-tax original is unavailable';
  END IF;

  SELECT original.*
    INTO v_original
    FROM public.journal AS original
   WHERE original.tenant_id = p_tenant_id
     AND original.id = p_original_journal_id
     AND original.property_node = p_property_node
     AND original.business_date = v_binding.business_date
     AND original.currency = v_binding.currency
     AND original.kind = 'charge'
     AND original.reverses IS NULL
     AND original.source = pg_catalog.jsonb_build_object(
       'interface', 'financials.positive-tax.post',
       'lineage_id', v_binding.lineage_id::text
     );
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'governed positive-tax original is unavailable';
  END IF;

  PERFORM 1
    FROM public.app_user AS actor
   WHERE actor.tenant_id = p_tenant_id
     AND actor.id = p_actor_id
     AND actor.status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'positive-tax correction actor is unavailable';
  END IF;

  SELECT (pg_catalog.transaction_timestamp() AT TIME ZONE property.timezone)::date
    INTO v_business_date
    FROM public.org_node AS property
   WHERE property.tenant_id = p_tenant_id
     AND property.id = p_property_node
     AND property.kind = 'property'
     AND property.currency = v_original.currency;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'positive-tax correction property is unavailable';
  END IF;

  INSERT INTO public.journal (
    tenant_id, property_node, business_date, kind, description,
    currency, reverses, source, created_by
  ) VALUES (
    p_tenant_id, p_property_node, v_business_date, 'adjustment',
    p_description, v_original.currency, p_original_journal_id,
    pg_catalog.jsonb_build_object(
      'interface', 'financials.positive-tax.reverse',
      'original_journal_id', p_original_journal_id::text,
      'lineage_id', v_binding.lineage_id::text
    ),
    p_actor_id
  )
  RETURNING id INTO v_journal_id;

  RETURN QUERY SELECT v_journal_id, v_business_date, v_original.currency;
END;
$$;

CREATE FUNCTION public.record_positive_tax_correction_root(
  p_tenant_id uuid,
  p_original_journal_id uuid,
  p_reversal_journal_id uuid,
  p_actor_id uuid
) RETURNS TABLE (
  posting_binding_id uuid,
  lineage_id uuid,
  hold_binding_id uuid,
  attribution_id uuid,
  reservation_id uuid,
  segment_id uuid,
  folio_id uuid,
  journal_id uuid,
  origin_quote_hash text,
  snapshot_hash text,
  business_date date,
  currency character(3),
  line_count integer
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_context_tenant uuid;
  v_binding public.tax_attribution_journal_binding%ROWTYPE;
  v_lineage public.tax_attribution_reservation_binding%ROWTYPE;
  v_snapshot public.tax_attribution_snapshot%ROWTYPE;
  v_original public.journal%ROWTYPE;
  v_reversal public.journal%ROWTYPE;
  v_original_root public.posting_line%ROWTYPE;
  v_original_line_count integer;
  v_reversal_line_count integer;
  v_mismatched_nonroots integer;
  v_original_balance numeric;
  v_reversal_balance numeric;
  v_root_tax_detail jsonb;
BEGIN
  IF session_user <> 'yellow_runtime'
     OR pg_catalog.current_setting('role', true) IS DISTINCT FROM 'app_role'
     OR current_user <> 'yellow_owner' THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'positive-tax correction root requires the governed runtime app role';
  END IF;

  BEGIN
    v_context_tenant := NULLIF(
      pg_catalog.current_setting('app.tenant_id', true), ''
    )::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'positive-tax correction root tenant context is invalid';
  END;
  IF v_context_tenant IS NULL OR p_tenant_id IS NULL
     OR v_context_tenant <> p_tenant_id THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'positive-tax correction root tenant context is invalid';
  END IF;
  IF p_original_journal_id IS NULL OR p_reversal_journal_id IS NULL
     OR p_actor_id IS NULL OR p_original_journal_id = p_reversal_journal_id THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'positive-tax correction root input is invalid';
  END IF;

  SELECT binding.*
    INTO v_binding
    FROM public.tax_attribution_journal_binding AS binding
   WHERE binding.tenant_id = p_tenant_id
     AND binding.journal_id = p_original_journal_id
   FOR KEY SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'governed positive-tax original binding is unavailable';
  END IF;

  SELECT lineage.*
    INTO v_lineage
    FROM public.tax_attribution_reservation_binding AS lineage
   WHERE lineage.tenant_id = p_tenant_id
     AND lineage.id = v_binding.lineage_id
     AND lineage.property_node = v_binding.property_node
     AND lineage.binding_id = v_binding.hold_binding_id
     AND lineage.attribution_id = v_binding.attribution_id
     AND lineage.reservation_id = v_binding.reservation_id
     AND lineage.segment_id = v_binding.segment_id
     AND lineage.origin_quote_hash = v_binding.origin_quote_hash
     AND lineage.snapshot_hash = v_binding.snapshot_hash
     AND lineage.currency = v_binding.currency
   FOR KEY SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'positive-tax correction reservation lineage is unavailable';
  END IF;

  SELECT snapshot.*
    INTO v_snapshot
    FROM public.tax_attribution_snapshot AS snapshot
   WHERE snapshot.tenant_id = p_tenant_id
     AND snapshot.id = v_binding.attribution_id
     AND snapshot.property_node = v_binding.property_node
     AND snapshot.origin_kind = 'rate_quote'
     AND snapshot.origin_quote_hash = v_binding.origin_quote_hash
     AND snapshot.snapshot_hash = v_binding.snapshot_hash
     AND snapshot.currency = v_binding.currency
   FOR KEY SHARE;
  IF NOT FOUND
     OR v_snapshot.snapshot #>> '{evaluation,rounding}' IS DISTINCT FROM 'line'
     OR v_snapshot.snapshot #>> '{evaluation,country}' IS NOT DISTINCT FROM 'IN'
     OR v_snapshot.snapshot #>> '{evaluation,grandTotalMinor}' !~ '^[1-9][0-9]*$'
     OR v_snapshot.snapshot #>> '{evaluation,taxTotalMinor}' !~ '^[1-9][0-9]*$'
     OR EXISTS (
       SELECT 1
         FROM pg_catalog.jsonb_array_elements(
           v_snapshot.snapshot #> '{evaluation,taxes}'
         ) AS tax(value)
        WHERE tax.value ->> 'code' ~ '^GST(?:_|$)'
     ) THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'positive-tax correction attribution is ineligible';
  END IF;

  SELECT original.*
    INTO v_original
    FROM public.journal AS original
   WHERE original.tenant_id = p_tenant_id
     AND original.id = p_original_journal_id
     AND original.property_node = v_binding.property_node
     AND original.business_date = v_binding.business_date
     AND original.currency = v_binding.currency
     AND original.kind = 'charge'
     AND original.reverses IS NULL
     AND original.source = pg_catalog.jsonb_build_object(
       'interface', 'financials.positive-tax.post',
       'lineage_id', v_binding.lineage_id::text
     );
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'governed positive-tax original is unavailable';
  END IF;

  SELECT reversal.*
    INTO v_reversal
    FROM public.journal AS reversal
   WHERE reversal.tenant_id = p_tenant_id
     AND reversal.id = p_reversal_journal_id
     AND reversal.property_node = v_binding.property_node
     AND reversal.kind = 'adjustment'
     AND reversal.reverses = p_original_journal_id
     AND reversal.currency = v_binding.currency
     AND reversal.created_by = p_actor_id
     AND reversal.source = pg_catalog.jsonb_build_object(
       'interface', 'financials.positive-tax.reverse',
       'original_journal_id', p_original_journal_id::text,
       'lineage_id', v_binding.lineage_id::text
     );
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'governed positive-tax correction header is unavailable';
  END IF;

  PERFORM 1
    FROM public.app_user AS actor
   WHERE actor.tenant_id = p_tenant_id
     AND actor.id = p_actor_id
     AND actor.status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'positive-tax correction actor is unavailable';
  END IF;

  SELECT root.*
    INTO v_original_root
    FROM public.posting_line AS root
   WHERE root.tenant_id = p_tenant_id
     AND root.journal_id = p_original_journal_id
     AND root.seq = 1
     AND root.account_id = v_binding.guest_account_id
     AND root.folio_id = v_binding.folio_id
     AND root.business_date = v_original.business_date
     AND root.currency = v_original.currency
     AND root.amount_minor > 0
     AND root.tax_detail IS NOT NULL
     AND root.tax_detail #>> '{lineage,journalId}' = p_original_journal_id::text
     AND root.tax_detail #>> '{lineage,lineageId}' = v_binding.lineage_id::text
     AND root.tax_detail #>> '{lineage,attributionId}' = v_binding.attribution_id::text
     AND root.tax_detail #>> '{lineage,reservationId}' = v_binding.reservation_id::text
     AND root.tax_detail #>> '{lineage,segmentId}' = v_binding.segment_id::text
     AND root.tax_detail #>> '{lineage,folioId}' = v_binding.folio_id::text
     AND root.tax_detail #>> '{quote,originQuoteHash}' = v_binding.origin_quote_hash
     AND root.tax_detail #>> '{quote,snapshotHash}' = v_binding.snapshot_hash
     AND root.tax_detail #>> '{quote,currency}' = v_binding.currency::text;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'positive-tax correction root lineage is inconsistent';
  END IF;

  SELECT pg_catalog.count(*)::integer,
         COALESCE(pg_catalog.sum(line.amount_minor::numeric), 0::numeric)
    INTO v_original_line_count, v_original_balance
    FROM public.posting_line AS line
   WHERE line.tenant_id = p_tenant_id
     AND line.journal_id = p_original_journal_id;
  IF v_original_line_count < 3 OR v_original_line_count > 66
     OR v_original_balance <> 0::numeric
     OR NOT EXISTS (
       SELECT 1
         FROM public.posting_line AS tax_line
         JOIN public.account AS tax_account
           ON tax_account.tenant_id = tax_line.tenant_id
          AND tax_account.id = tax_line.account_id
        WHERE tax_line.tenant_id = p_tenant_id
          AND tax_line.journal_id = p_original_journal_id
          AND tax_line.seq > 2
          AND tax_account.role = 'tax_payable'
          AND tax_line.amount_minor < 0
     ) THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'positive-tax original posting set is incomplete';
  END IF;

  SELECT pg_catalog.count(*)::integer
    INTO v_mismatched_nonroots
    FROM public.posting_line AS original
    LEFT JOIN public.posting_line AS reversal
      ON reversal.tenant_id = original.tenant_id
     AND reversal.journal_id = p_reversal_journal_id
     AND reversal.seq = original.seq
     AND reversal.account_id = original.account_id
     AND reversal.folio_id IS NOT DISTINCT FROM original.folio_id
     AND reversal.tx_code = original.tx_code
     AND reversal.description = original.description
     AND reversal.amount_minor = -original.amount_minor
     AND reversal.quantity = original.quantity
     AND reversal.tax_detail IS NOT DISTINCT FROM original.tax_detail
     AND reversal.folio_transfer_root_line_id IS NOT DISTINCT FROM
         original.folio_transfer_root_line_id
     AND reversal.business_date = v_reversal.business_date
     AND reversal.currency = original.currency
   WHERE original.tenant_id = p_tenant_id
     AND original.journal_id = p_original_journal_id
     AND original.seq > 1
     AND reversal.id IS NULL;
  SELECT pg_catalog.count(*)::integer
    INTO v_reversal_line_count
    FROM public.posting_line AS line
   WHERE line.tenant_id = p_tenant_id
     AND line.journal_id = p_reversal_journal_id;
  IF v_mismatched_nonroots <> 0
     OR v_reversal_line_count <> v_original_line_count - 1
     OR EXISTS (
       SELECT 1
         FROM public.posting_line AS line
        WHERE line.tenant_id = p_tenant_id
          AND line.journal_id = p_reversal_journal_id
          AND line.seq = 1
     ) THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'positive-tax correction posting set is inconsistent';
  END IF;

  v_root_tax_detail := pg_catalog.jsonb_build_object(
    'schemaVersion', 2,
    'effect', 'full_reversal',
    'lineage', pg_catalog.jsonb_build_object(
      'originalPostingBindingId', v_binding.id::text,
      'lineageId', v_binding.lineage_id::text,
      'holdBindingId', v_binding.hold_binding_id::text,
      'attributionId', v_binding.attribution_id::text,
      'reservationId', v_binding.reservation_id::text,
      'segmentId', v_binding.segment_id::text,
      'folioId', v_binding.folio_id::text,
      'originalJournalId', p_original_journal_id::text,
      'reversalJournalId', p_reversal_journal_id::text
    ),
    'quote', pg_catalog.jsonb_build_object(
      'originQuoteHash', v_binding.origin_quote_hash,
      'snapshotHash', v_binding.snapshot_hash,
      'currency', v_binding.currency::text
    ),
    'originalTaxDetail', v_original_root.tax_detail
  );

  INSERT INTO public.posting_line (
    tenant_id, journal_id, seq, account_id, folio_id, tx_code,
    description, amount_minor, quantity, tax_detail,
    folio_transfer_root_line_id, business_date, currency
  ) VALUES (
    p_tenant_id, p_reversal_journal_id, 1, v_original_root.account_id,
    v_original_root.folio_id, v_original_root.tx_code,
    v_original_root.description, -v_original_root.amount_minor,
    v_original_root.quantity, v_root_tax_detail,
    v_original_root.folio_transfer_root_line_id,
    v_reversal.business_date, v_original_root.currency
  );

  SELECT pg_catalog.count(*)::integer,
         COALESCE(pg_catalog.sum(line.amount_minor::numeric), 0::numeric)
    INTO v_reversal_line_count, v_reversal_balance
    FROM public.posting_line AS line
   WHERE line.tenant_id = p_tenant_id
     AND line.journal_id = p_reversal_journal_id;
  IF v_reversal_line_count <> v_original_line_count
     OR v_reversal_balance <> 0::numeric
     OR EXISTS (
       SELECT 1
         FROM public.posting_line AS original
         LEFT JOIN public.posting_line AS reversal
           ON reversal.tenant_id = original.tenant_id
          AND reversal.journal_id = p_reversal_journal_id
          AND reversal.seq = original.seq
          AND reversal.account_id = original.account_id
          AND reversal.folio_id IS NOT DISTINCT FROM original.folio_id
          AND reversal.tx_code = original.tx_code
          AND reversal.description = original.description
          AND reversal.amount_minor = -original.amount_minor
          AND reversal.quantity = original.quantity
          AND reversal.folio_transfer_root_line_id IS NOT DISTINCT FROM
              original.folio_transfer_root_line_id
          AND reversal.business_date = v_reversal.business_date
          AND reversal.currency = original.currency
        WHERE original.tenant_id = p_tenant_id
          AND original.journal_id = p_original_journal_id
          AND reversal.id IS NULL
     ) THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'positive-tax correction failed exact nullification';
  END IF;

  RETURN QUERY SELECT
    v_binding.id, v_binding.lineage_id, v_binding.hold_binding_id,
    v_binding.attribution_id,
    v_binding.reservation_id, v_binding.segment_id, v_binding.folio_id,
    p_reversal_journal_id, v_binding.origin_quote_hash,
    v_binding.snapshot_hash, v_reversal.business_date, v_reversal.currency,
    v_reversal_line_count;
END;
$$;

ALTER FUNCTION public.create_positive_tax_correction_header(
  uuid,uuid,uuid,text,uuid
) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.create_positive_tax_correction_header(
  uuid,uuid,uuid,text,uuid
) FROM PUBLIC, app_role, yellow_runtime;
GRANT EXECUTE ON FUNCTION public.create_positive_tax_correction_header(
  uuid,uuid,uuid,text,uuid
) TO app_role;

ALTER FUNCTION public.record_positive_tax_correction_root(
  uuid,uuid,uuid,uuid
) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.record_positive_tax_correction_root(
  uuid,uuid,uuid,uuid
) FROM PUBLIC, app_role, yellow_runtime;
GRANT EXECUTE ON FUNCTION public.record_positive_tax_correction_root(
  uuid,uuid,uuid,uuid
) TO app_role;
