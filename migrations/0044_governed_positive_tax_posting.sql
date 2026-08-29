-- Order 262: bind one governed positive-tax journal to the immutable quoted-tax
-- reservation lineage. The application may create the header and the null-tax
-- credit lines only. The owner capability validates those rows against canonical
-- snapshot and configured-route truth, inserts the guest root with tax evidence,
-- and appends the binding. posting_line remains strictly insert-only.

ALTER TABLE public.tax_attribution_reservation_binding
  ADD CONSTRAINT tax_attribution_reservation_binding_posting_identity_uq
  UNIQUE (
    tenant_id, id, property_node, binding_id, attribution_id,
    reservation_id, segment_id, origin_quote_hash, snapshot_hash, currency
  );

ALTER TABLE public.journal
  ADD CONSTRAINT journal_positive_tax_binding_identity_uq
  UNIQUE (tenant_id, id, property_node, business_date, currency);

CREATE TABLE public.tax_attribution_journal_binding (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT pg_catalog.gen_random_uuid(),
  property_node uuid NOT NULL,
  posted_by uuid NOT NULL,
  lineage_id uuid NOT NULL,
  hold_binding_id uuid NOT NULL,
  attribution_id uuid NOT NULL,
  reservation_id uuid NOT NULL,
  segment_id uuid NOT NULL,
  folio_id uuid NOT NULL,
  guest_account_id uuid NOT NULL,
  journal_id uuid NOT NULL,
  origin_quote_hash text NOT NULL,
  snapshot_hash text NOT NULL,
  currency character(3) NOT NULL,
  business_date date NOT NULL,
  posted_at timestamptz NOT NULL DEFAULT pg_catalog.transaction_timestamp(),
  CONSTRAINT tax_attribution_journal_binding_pk PRIMARY KEY (tenant_id, id),
  CONSTRAINT tax_attribution_journal_binding_lineage_uq
    UNIQUE (tenant_id, lineage_id),
  CONSTRAINT tax_attribution_journal_binding_attribution_uq
    UNIQUE (tenant_id, attribution_id),
  CONSTRAINT tax_attribution_journal_binding_reservation_uq
    UNIQUE (tenant_id, reservation_id),
  CONSTRAINT tax_attribution_journal_binding_journal_uq
    UNIQUE (tenant_id, journal_id),
  CONSTRAINT tax_attribution_journal_binding_quote_hash_ck CHECK (
    origin_quote_hash ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT tax_attribution_journal_binding_snapshot_hash_ck CHECK (
    snapshot_hash ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT tax_attribution_journal_binding_currency_ck CHECK (
    currency ~ '^[A-Z]{3}$'
  ),
  CONSTRAINT tax_attribution_journal_binding_business_date_ck CHECK (
    pg_catalog.isfinite(business_date)
  ),
  CONSTRAINT tax_attribution_journal_binding_property_fk
    FOREIGN KEY (tenant_id, property_node)
    REFERENCES public.org_node (tenant_id, id),
  CONSTRAINT tax_attribution_journal_binding_actor_fk
    FOREIGN KEY (tenant_id, posted_by)
    REFERENCES public.app_user (tenant_id, id),
  CONSTRAINT tax_attribution_journal_binding_lineage_fk
    FOREIGN KEY (
      tenant_id, lineage_id, property_node, hold_binding_id, attribution_id,
      reservation_id, segment_id, origin_quote_hash, snapshot_hash, currency
    ) REFERENCES public.tax_attribution_reservation_binding (
      tenant_id, id, property_node, binding_id, attribution_id,
      reservation_id, segment_id, origin_quote_hash, snapshot_hash, currency
    ),
  CONSTRAINT tax_attribution_journal_binding_account_fk
    FOREIGN KEY (tenant_id, property_node, currency, guest_account_id)
    REFERENCES public.account (tenant_id, property_node, currency, id),
  CONSTRAINT tax_attribution_journal_binding_folio_fk
    FOREIGN KEY (tenant_id, guest_account_id, folio_id)
    REFERENCES public.folio (tenant_id, account_id, id),
  CONSTRAINT tax_attribution_journal_binding_journal_fk
    FOREIGN KEY (
      tenant_id, journal_id, property_node, business_date, currency
    ) REFERENCES public.journal (
      tenant_id, id, property_node, business_date, currency
    )
);

CREATE INDEX tax_attribution_journal_binding_property_lookup
  ON public.tax_attribution_journal_binding
  (tenant_id, property_node, business_date, posted_at, id);
CREATE INDEX tax_attribution_journal_binding_snapshot_lookup
  ON public.tax_attribution_journal_binding
  (tenant_id, snapshot_hash, posted_at, id);

ALTER TABLE public.tax_attribution_journal_binding ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON public.tax_attribution_journal_binding
  USING (
    tenant_id = NULLIF(
      pg_catalog.current_setting('app.tenant_id', true), ''
    )::uuid
  )
  WITH CHECK (
    tenant_id = NULLIF(
      pg_catalog.current_setting('app.tenant_id', true), ''
    )::uuid
  );

-- The existing two-account capability remains unchanged. This dedicated path
-- accepts the bounded positive-tax maximum (guest + revenue + 64 tax accounts)
-- and acquires every account in one global UUID order before the primary folio.
CREATE FUNCTION public.lock_positive_tax_posting_rows(
  p_tenant_id uuid,
  p_account_ids uuid[],
  p_folio_id uuid
) RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_context_tenant uuid;
  v_requested_accounts integer;
  v_locked_accounts integer;
  v_locked_folios integer;
BEGIN
  IF session_user <> 'yellow_runtime'
     OR pg_catalog.current_setting('role', true) IS DISTINCT FROM 'app_role'
     OR current_user <> 'yellow_owner' THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'positive-tax posting lock requires the governed runtime app role';
  END IF;

  BEGIN
    v_context_tenant := NULLIF(
      pg_catalog.current_setting('app.tenant_id', true), ''
    )::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'positive-tax posting lock tenant context is invalid';
  END;
  IF v_context_tenant IS NULL OR p_tenant_id IS NULL
     OR v_context_tenant <> p_tenant_id THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'positive-tax posting lock tenant context is invalid';
  END IF;

  v_requested_accounts := pg_catalog.cardinality(p_account_ids);
  IF p_folio_id IS NULL OR v_requested_accounts IS NULL
     OR v_requested_accounts < 2 OR v_requested_accounts > 66
     OR EXISTS (
       SELECT 1
         FROM pg_catalog.unnest(p_account_ids) AS requested(id)
        WHERE requested.id IS NULL
     )
     OR (
       SELECT pg_catalog.count(DISTINCT requested.id)
         FROM pg_catalog.unnest(p_account_ids) AS requested(id)
     ) <> v_requested_accounts THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'positive-tax posting lock account set is invalid';
  END IF;

  SELECT pg_catalog.count(*)::integer
    INTO v_locked_accounts
    FROM (
      SELECT account.id
        FROM public.account AS account
       WHERE account.tenant_id = p_tenant_id
         AND account.id = ANY (p_account_ids)
         AND account.status = 'open'
         AND account.role IN ('guest', 'revenue', 'tax_payable')
       ORDER BY account.id
       FOR UPDATE
    ) AS locked;
  IF v_locked_accounts <> v_requested_accounts THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'positive-tax posting lock targets are unavailable';
  END IF;

  SELECT pg_catalog.count(*)::integer
    INTO v_locked_folios
    FROM (
      SELECT folio.id
        FROM public.folio AS folio
        JOIN public.account AS account
          ON account.tenant_id = folio.tenant_id
         AND account.id = folio.account_id
       WHERE folio.tenant_id = p_tenant_id
         AND folio.id = p_folio_id
         AND folio.account_id = ANY (p_account_ids)
         AND folio.window_no = 1
         AND folio.status = 'open'
         AND account.role = 'guest'
         AND account.status = 'open'
       FOR UPDATE OF folio
    ) AS locked;
  IF v_locked_folios <> 1 THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'positive-tax posting lock targets are unavailable';
  END IF;
END;
$$;

-- Validate the just-created charge header and credit rows against the immutable
-- attribution and explicit semantic routes. Only this function can insert the
-- guest root carrying tax_detail or append the posting binding.
CREATE FUNCTION public.record_positive_tax_journal_binding(
  p_tenant_id uuid,
  p_property_node uuid,
  p_actor_id uuid,
  p_lineage_id uuid,
  p_folio_id uuid,
  p_journal_id uuid,
  p_revenue_mapping_id uuid,
  p_tax_mapping_ids uuid[],
  p_tax_detail jsonb
) RETURNS TABLE (
  posting_binding_id uuid,
  lineage_id uuid,
  attribution_id uuid,
  reservation_id uuid,
  segment_id uuid,
  folio_id uuid,
  journal_id uuid,
  origin_quote_hash text,
  snapshot_hash text,
  currency character(3),
  business_date date,
  created boolean
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_context_tenant uuid;
  v_lineage public.tax_attribution_reservation_binding%ROWTYPE;
  v_snapshot public.tax_attribution_snapshot%ROWTYPE;
  v_journal public.journal%ROWTYPE;
  v_existing public.tax_attribution_journal_binding%ROWTYPE;
  v_created public.tax_attribution_journal_binding%ROWTYPE;
  v_folio record;
  v_revenue record;
  v_nonzero_taxes integer;
  v_mapping_count integer;
  v_valid_tax_routes integer;
  v_credit_lines integer;
  v_expected_tax_routes jsonb;
  v_expected_taxes jsonb;
  v_expected_tax_detail jsonb;
  v_root_detail jsonb;
  v_base_minor bigint;
  v_tax_minor bigint;
  v_grand_minor bigint;
  v_computed_tax_minor numeric;
BEGIN
  IF session_user <> 'yellow_runtime'
     OR pg_catalog.current_setting('role', true) IS DISTINCT FROM 'app_role'
     OR current_user <> 'yellow_owner' THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'positive-tax journal binding requires the governed runtime app role';
  END IF;

  BEGIN
    v_context_tenant := NULLIF(
      pg_catalog.current_setting('app.tenant_id', true), ''
    )::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'positive-tax journal binding tenant context is invalid';
  END;
  IF v_context_tenant IS NULL OR p_tenant_id IS NULL
     OR v_context_tenant <> p_tenant_id THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'positive-tax journal binding tenant context is invalid';
  END IF;

  v_mapping_count := pg_catalog.cardinality(p_tax_mapping_ids);
  IF p_property_node IS NULL OR p_actor_id IS NULL OR p_lineage_id IS NULL
     OR p_folio_id IS NULL OR p_journal_id IS NULL
     OR p_revenue_mapping_id IS NULL OR p_tax_mapping_ids IS NULL
     OR v_mapping_count > 64
     OR EXISTS (
       SELECT 1
         FROM pg_catalog.unnest(p_tax_mapping_ids) AS requested(id)
        WHERE requested.id IS NULL
     )
     OR (
       SELECT pg_catalog.count(DISTINCT requested.id)
         FROM pg_catalog.unnest(p_tax_mapping_ids) AS requested(id)
     ) <> v_mapping_count
     OR p_tax_detail IS NULL
     OR pg_catalog.jsonb_typeof(p_tax_detail) <> 'object'
     OR pg_catalog.octet_length(
       pg_catalog.convert_to(p_tax_detail::text, 'UTF8')
     ) NOT BETWEEN 1 AND 8388608 THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'positive-tax journal binding input is invalid';
  END IF;
  IF p_tax_detail #>> '{routes,revenue,mappingId}'
       IS DISTINCT FROM p_revenue_mapping_id::text
     OR COALESCE(
       (
         SELECT pg_catalog.array_agg(
           (route.value ->> 'mappingId')::uuid ORDER BY route.ordinality
         )
           FROM pg_catalog.jsonb_array_elements(
             p_tax_detail #> '{routes,taxes}'
           ) WITH ORDINALITY AS route(value, ordinality)
       ),
       ARRAY[]::uuid[]
     ) IS DISTINCT FROM p_tax_mapping_ids THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'positive-tax journal binding route evidence is invalid';
  END IF;

  PERFORM 1
    FROM public.tenant
   WHERE tenant.id = p_tenant_id
     AND tenant.status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'positive-tax journal binding authority is unavailable';
  END IF;
  PERFORM 1
    FROM public.org_node AS property
   WHERE property.tenant_id = p_tenant_id
     AND property.id = p_property_node
     AND property.kind = 'property';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'positive-tax journal binding authority is unavailable';
  END IF;
  PERFORM 1
    FROM public.app_user AS actor
   WHERE actor.tenant_id = p_tenant_id
     AND actor.id = p_actor_id
     AND actor.status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'positive-tax journal binding authority is unavailable';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'positive-tax-journal-binding:' || p_tenant_id::text || ':' ||
      p_lineage_id::text,
      262
    )
  );

  SELECT binding.*
    INTO v_existing
    FROM public.tax_attribution_journal_binding AS binding
   WHERE binding.tenant_id = p_tenant_id
     AND binding.lineage_id = p_lineage_id;
  IF FOUND THEN
    IF v_existing.property_node IS DISTINCT FROM p_property_node
       OR v_existing.posted_by IS DISTINCT FROM p_actor_id
       OR v_existing.folio_id IS DISTINCT FROM p_folio_id
       OR v_existing.journal_id IS DISTINCT FROM p_journal_id THEN
      RAISE EXCEPTION USING ERRCODE = '23505',
        MESSAGE = 'positive-tax lineage already has a divergent journal binding';
    END IF;
    SELECT line.tax_detail
      INTO v_root_detail
      FROM public.posting_line AS line
     WHERE line.tenant_id = p_tenant_id
       AND line.journal_id = p_journal_id
       AND line.seq = 1
       AND line.account_id = v_existing.guest_account_id
       AND line.folio_id = p_folio_id;
    IF NOT FOUND OR v_root_detail IS DISTINCT FROM p_tax_detail THEN
      RAISE EXCEPTION USING ERRCODE = '55000',
        MESSAGE = 'positive-tax journal binding evidence is inconsistent';
    END IF;
    RETURN QUERY SELECT
      v_existing.id, v_existing.lineage_id, v_existing.attribution_id,
      v_existing.reservation_id, v_existing.segment_id,
      v_existing.folio_id, v_existing.journal_id,
      v_existing.origin_quote_hash, v_existing.snapshot_hash,
      v_existing.currency, v_existing.business_date, false;
    RETURN;
  END IF;

  SELECT lineage.*
    INTO v_lineage
    FROM public.tax_attribution_reservation_binding AS lineage
   WHERE lineage.tenant_id = p_tenant_id
     AND lineage.id = p_lineage_id
     AND lineage.property_node = p_property_node
   FOR KEY SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'positive-tax reservation lineage is unavailable';
  END IF;

  SELECT attribution.*
    INTO v_snapshot
    FROM public.tax_attribution_snapshot AS attribution
   WHERE attribution.tenant_id = p_tenant_id
     AND attribution.id = v_lineage.attribution_id
     AND attribution.property_node = p_property_node
     AND attribution.origin_kind = 'rate_quote'
     AND attribution.origin_quote_hash = v_lineage.origin_quote_hash
     AND attribution.snapshot_hash = v_lineage.snapshot_hash
     AND attribution.currency = v_lineage.currency
   FOR KEY SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'canonical positive-tax attribution is unavailable';
  END IF;

  IF v_snapshot.snapshot ->> 'currency' IS DISTINCT FROM v_lineage.currency::text
     OR v_snapshot.snapshot ->> 'snapshotHash' IS DISTINCT FROM v_lineage.snapshot_hash
     OR v_snapshot.snapshot #>> '{origin,quoteHash}' IS DISTINCT FROM v_lineage.origin_quote_hash
     OR v_snapshot.snapshot #>> '{evaluation,rounding}' IS DISTINCT FROM 'line'
     OR v_snapshot.snapshot #>> '{evaluation,country}' IS NOT DISTINCT FROM 'IN'
     OR EXISTS (
       SELECT 1
         FROM pg_catalog.jsonb_array_elements(
           v_snapshot.snapshot #> '{evaluation,taxes}'
         ) AS tax(value)
        WHERE tax.value ->> 'code' ~ '^GST(?:_|$)'
     ) THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'positive-tax attribution requires a later policy path';
  END IF;

  IF v_snapshot.snapshot #>> '{evaluation,baseTotalMinor}' !~ '^[1-9][0-9]*$'
     OR v_snapshot.snapshot #>> '{evaluation,taxTotalMinor}' !~ '^(0|[1-9][0-9]*)$'
     OR v_snapshot.snapshot #>> '{evaluation,grandTotalMinor}' !~ '^[1-9][0-9]*$' THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'positive-tax attribution totals are invalid';
  END IF;
  BEGIN
    v_base_minor := (v_snapshot.snapshot #>> '{evaluation,baseTotalMinor}')::bigint;
    v_tax_minor := (v_snapshot.snapshot #>> '{evaluation,taxTotalMinor}')::bigint;
    v_grand_minor := (v_snapshot.snapshot #>> '{evaluation,grandTotalMinor}')::bigint;
  EXCEPTION WHEN numeric_value_out_of_range OR invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'positive-tax attribution totals are invalid';
  END;
  IF v_base_minor <= 0 OR v_tax_minor < 0 OR v_grand_minor <= 0
     OR v_base_minor + v_tax_minor <> v_grand_minor THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'positive-tax attribution totals are invalid';
  END IF;

  IF pg_catalog.jsonb_typeof(
       v_snapshot.snapshot #> '{evaluation,taxes}'
     ) IS DISTINCT FROM 'array'
     OR pg_catalog.jsonb_array_length(
       v_snapshot.snapshot #> '{evaluation,taxes}'
     ) > 64
     OR EXISTS (
       SELECT 1
         FROM pg_catalog.jsonb_array_elements(
           v_snapshot.snapshot #> '{evaluation,taxes}'
         ) WITH ORDINALITY AS tax(value, ordinality)
        WHERE pg_catalog.jsonb_typeof(tax.value) <> 'object'
           OR NOT (tax.value ?& ARRAY[
             'index', 'code', 'name', 'taxMinor', 'components'
           ])
           OR tax.value - ARRAY[
             'index', 'code', 'name', 'taxMinor', 'components'
           ] <> '{}'::jsonb
           OR tax.value ->> 'index' IS DISTINCT FROM
              (tax.ordinality - 1)::text
           OR tax.value ->> 'code' !~ '^[A-Z][A-Z0-9_]{0,63}$'
           OR tax.value ->> 'name' IS NULL
           OR pg_catalog.btrim(tax.value ->> 'name') = ''
           OR pg_catalog.char_length(tax.value ->> 'name') > 256
           OR tax.value ->> 'taxMinor' !~ '^(0|[1-9][0-9]*)$'
           OR pg_catalog.jsonb_typeof(tax.value -> 'components') <> 'array'
     )
     OR (
       SELECT pg_catalog.count(DISTINCT tax.value ->> 'code')
         FROM pg_catalog.jsonb_array_elements(
           v_snapshot.snapshot #> '{evaluation,taxes}'
         ) AS tax(value)
     ) <> pg_catalog.jsonb_array_length(
       v_snapshot.snapshot #> '{evaluation,taxes}'
     ) THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'positive-tax attribution tax lineage is invalid';
  END IF;
  BEGIN
    SELECT COALESCE(
             pg_catalog.sum((tax.value ->> 'taxMinor')::numeric),
             0::numeric
           )
      INTO v_computed_tax_minor
      FROM pg_catalog.jsonb_array_elements(
        v_snapshot.snapshot #> '{evaluation,taxes}'
      ) AS tax(value);
  EXCEPTION WHEN numeric_value_out_of_range OR invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'positive-tax attribution tax lineage is invalid';
  END;
  IF v_computed_tax_minor <> v_tax_minor::numeric
     OR v_computed_tax_minor > 9223372036854775807::numeric THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'positive-tax attribution tax lineage is invalid';
  END IF;

  SELECT folio.id, folio.account_id, folio.reservation_id,
         account.property_node, account.currency::text AS currency
    INTO v_folio
    FROM public.folio AS folio
    JOIN public.account AS account
      ON account.tenant_id = folio.tenant_id
     AND account.id = folio.account_id
   WHERE folio.tenant_id = p_tenant_id
     AND folio.id = p_folio_id
     AND folio.reservation_id = v_lineage.reservation_id
     AND folio.window_no = 1
     AND folio.status = 'open'
     AND account.property_node = p_property_node
     AND account.currency = v_lineage.currency
     AND account.role = 'guest'
     AND account.status = 'open';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'positive-tax primary folio is unavailable';
  END IF;

  SELECT journal.*
    INTO v_journal
    FROM public.journal AS journal
   WHERE journal.tenant_id = p_tenant_id
     AND journal.id = p_journal_id
     AND journal.property_node = p_property_node
     AND journal.kind = 'charge'
     AND journal.reverses IS NULL
     AND journal.currency = v_lineage.currency
     AND journal.created_by = p_actor_id
     AND journal.source = pg_catalog.jsonb_build_object(
       'interface', 'financials.positive-tax.post',
       'lineage_id', p_lineage_id::text
     );
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'governed positive-tax journal header is unavailable';
  END IF;
  PERFORM 1
    FROM public.business_day AS day
   WHERE day.tenant_id = p_tenant_id
     AND day.property_node = p_property_node
     AND day.business_date = v_journal.business_date
     AND day.sealed_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0011',
      MESSAGE = 'positive-tax journal business day is missing or sealed';
  END IF;

  SELECT mapping.id AS mapping_id, mapping.tx_code,
         route.credit_account_id,
         code.name AS tx_name
    INTO v_revenue
    FROM public.tax_semantic_route AS mapping
    JOIN public.tx_code AS code
      ON code.code = mapping.tx_code
     AND code.grp = 'revenue'
     AND code.usali_line IS NOT NULL
     AND pg_catalog.btrim(code.usali_line) <> ''
    JOIN public.tx_code_route AS route
      ON route.tenant_id = mapping.tenant_id
     AND route.property_node = mapping.property_node
     AND route.currency = mapping.currency
     AND route.tx_code = mapping.tx_code
    JOIN public.account AS account
      ON account.tenant_id = route.tenant_id
     AND account.id = route.credit_account_id
     AND account.property_node = route.property_node
     AND account.currency = route.currency
     AND account.role = 'revenue'
     AND account.status = 'open'
   WHERE mapping.tenant_id = p_tenant_id
     AND mapping.id = p_revenue_mapping_id
     AND mapping.property_node = p_property_node
     AND mapping.currency = v_lineage.currency
     AND mapping.jurisdiction_extension_id =
         (v_snapshot.snapshot #>> '{jurisdiction,extensionId}')::uuid
     AND mapping.jurisdiction_owner_tenant_id IS NOT DISTINCT FROM
         (v_snapshot.snapshot #>> '{jurisdiction,ownerTenantId}')::uuid
     AND mapping.jurisdiction_key = v_snapshot.snapshot #>> '{jurisdiction,key}'
     AND mapping.jurisdiction_version =
         (v_snapshot.snapshot #>> '{jurisdiction,version}')::integer
     AND mapping.jurisdiction_content_hash =
         v_snapshot.snapshot #>> '{jurisdiction,contentHash}'
     AND mapping.semantic_kind = 'revenue'
     AND mapping.semantic_code = 'room_revenue';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'configured positive-tax revenue route is unavailable';
  END IF;

  SELECT pg_catalog.count(*)::integer
    INTO v_nonzero_taxes
    FROM pg_catalog.jsonb_array_elements(
      v_snapshot.snapshot #> '{evaluation,taxes}'
    ) AS tax(value)
   WHERE (tax.value ->> 'taxMinor')::bigint <> 0;
  IF v_nonzero_taxes <> v_mapping_count THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'configured positive-tax route set is incomplete';
  END IF;

  WITH canonical_taxes AS (
    SELECT tax.value, tax.ordinality,
           pg_catalog.row_number() OVER (ORDER BY tax.ordinality) AS posting_ordinal
      FROM pg_catalog.jsonb_array_elements(
        v_snapshot.snapshot #> '{evaluation,taxes}'
      ) WITH ORDINALITY AS tax(value, ordinality)
     WHERE (tax.value ->> 'taxMinor')::bigint <> 0
  ), requested AS (
    SELECT mapping_id, ordinality
      FROM pg_catalog.unnest(p_tax_mapping_ids)
        WITH ORDINALITY AS supplied(mapping_id, ordinality)
  ), resolved AS (
    SELECT canonical_taxes.value, canonical_taxes.ordinality,
           canonical_taxes.posting_ordinal,
           mapping.id AS mapping_id, mapping.tx_code,
           route.credit_account_id
      FROM canonical_taxes
      JOIN requested
        ON requested.ordinality = canonical_taxes.posting_ordinal
      JOIN public.tax_semantic_route AS mapping
        ON mapping.tenant_id = p_tenant_id
       AND mapping.id = requested.mapping_id
       AND mapping.property_node = p_property_node
       AND mapping.currency = v_lineage.currency
       AND mapping.jurisdiction_extension_id =
           (v_snapshot.snapshot #>> '{jurisdiction,extensionId}')::uuid
       AND mapping.jurisdiction_owner_tenant_id IS NOT DISTINCT FROM
           (v_snapshot.snapshot #>> '{jurisdiction,ownerTenantId}')::uuid
       AND mapping.jurisdiction_key = v_snapshot.snapshot #>> '{jurisdiction,key}'
       AND mapping.jurisdiction_version =
           (v_snapshot.snapshot #>> '{jurisdiction,version}')::integer
       AND mapping.jurisdiction_content_hash =
           v_snapshot.snapshot #>> '{jurisdiction,contentHash}'
       AND mapping.semantic_kind = 'tax'
       AND mapping.semantic_code = canonical_taxes.value ->> 'code'
      JOIN public.tx_code AS code
        ON code.code = mapping.tx_code
       AND code.grp = 'tax'
      JOIN public.tx_code_route AS route
        ON route.tenant_id = mapping.tenant_id
       AND route.property_node = mapping.property_node
       AND route.currency = mapping.currency
       AND route.tx_code = mapping.tx_code
      JOIN public.account AS account
        ON account.tenant_id = route.tenant_id
       AND account.id = route.credit_account_id
       AND account.property_node = route.property_node
       AND account.currency = route.currency
       AND account.role = 'tax_payable'
       AND account.status = 'open'
  )
  SELECT pg_catalog.count(*)::integer,
         COALESCE(
           pg_catalog.jsonb_agg(
             pg_catalog.jsonb_build_object(
               'taxIndex', resolved.value ->> 'index',
               'taxCode', resolved.value ->> 'code',
               'mappingId', resolved.mapping_id::text,
               'txCode', resolved.tx_code,
               'creditAccountId', resolved.credit_account_id::text
             ) ORDER BY resolved.ordinality
           ),
           '[]'::jsonb
         )
    INTO v_valid_tax_routes, v_expected_tax_routes
    FROM resolved;
  IF v_valid_tax_routes <> v_nonzero_taxes THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'configured positive-tax route set is incoherent';
  END IF;

  SELECT COALESCE(
           pg_catalog.jsonb_agg(
             pg_catalog.jsonb_build_object(
               'index', tax.value ->> 'index',
               'code', tax.value ->> 'code',
               'name', tax.value ->> 'name',
               'taxMinor', tax.value ->> 'taxMinor'
             ) ORDER BY tax.ordinality
           ),
           '[]'::jsonb
         )
    INTO v_expected_taxes
    FROM pg_catalog.jsonb_array_elements(
      v_snapshot.snapshot #> '{evaluation,taxes}'
    ) WITH ORDINALITY AS tax(value, ordinality);

  v_expected_tax_detail := pg_catalog.jsonb_build_object(
    'schemaVersion', 1,
    'lineage', pg_catalog.jsonb_build_object(
      'lineageId', v_lineage.id::text,
      'holdBindingId', v_lineage.binding_id::text,
      'attributionId', v_lineage.attribution_id::text,
      'reservationId', v_lineage.reservation_id::text,
      'segmentId', v_lineage.segment_id::text,
      'folioId', p_folio_id::text,
      'journalId', p_journal_id::text
    ),
    'quote', pg_catalog.jsonb_build_object(
      'originQuoteHash', v_lineage.origin_quote_hash,
      'snapshotHash', v_lineage.snapshot_hash,
      'currency', v_lineage.currency::text
    ),
    'jurisdiction', pg_catalog.jsonb_build_object(
      'extensionId', v_snapshot.snapshot #>> '{jurisdiction,extensionId}',
      'ownerTenantId', v_snapshot.snapshot #> '{jurisdiction,ownerTenantId}',
      'key', v_snapshot.snapshot #>> '{jurisdiction,key}',
      'version', v_snapshot.snapshot #>> '{jurisdiction,version}',
      'contentHash', v_snapshot.snapshot #>> '{jurisdiction,contentHash}'
    ),
    'routes', pg_catalog.jsonb_build_object(
      'revenue', pg_catalog.jsonb_build_object(
        'mappingId', v_revenue.mapping_id::text,
        'semanticCode', 'room_revenue',
        'txCode', v_revenue.tx_code,
        'creditAccountId', v_revenue.credit_account_id::text
      ),
      'taxes', v_expected_tax_routes
    ),
    'totals', pg_catalog.jsonb_build_object(
      'baseMinor', v_base_minor::text,
      'taxMinor', v_tax_minor::text,
      'grandMinor', v_grand_minor::text
    ),
    'taxes', v_expected_taxes
  );
  IF p_tax_detail IS DISTINCT FROM v_expected_tax_detail THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'positive-tax detail does not match canonical posting evidence';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.posting_line AS root
     WHERE root.tenant_id = p_tenant_id
       AND root.journal_id = p_journal_id
       AND root.seq = 1
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'positive-tax journal guest root already exists without binding';
  END IF;

  WITH canonical_taxes AS (
    SELECT tax.value, tax.ordinality,
           pg_catalog.row_number() OVER (ORDER BY tax.ordinality) AS posting_ordinal
      FROM pg_catalog.jsonb_array_elements(
        v_snapshot.snapshot #> '{evaluation,taxes}'
      ) WITH ORDINALITY AS tax(value, ordinality)
     WHERE (tax.value ->> 'taxMinor')::bigint <> 0
  ), requested AS (
    SELECT mapping_id, ordinality
      FROM pg_catalog.unnest(p_tax_mapping_ids)
        WITH ORDINALITY AS supplied(mapping_id, ordinality)
  ), expected AS (
    SELECT (canonical_taxes.posting_ordinal + 2)::smallint AS seq,
           mapping.tx_code, route.credit_account_id,
           -((canonical_taxes.value ->> 'taxMinor')::bigint) AS amount_minor
      FROM canonical_taxes
      JOIN requested
        ON requested.ordinality = canonical_taxes.posting_ordinal
      JOIN public.tax_semantic_route AS mapping
        ON mapping.tenant_id = p_tenant_id
       AND mapping.id = requested.mapping_id
      JOIN public.tx_code_route AS route
        ON route.tenant_id = mapping.tenant_id
       AND route.property_node = mapping.property_node
       AND route.currency = mapping.currency
       AND route.tx_code = mapping.tx_code
  ), matched AS (
    SELECT line.seq
      FROM expected
      JOIN public.posting_line AS line
        ON line.tenant_id = p_tenant_id
       AND line.journal_id = p_journal_id
       AND line.seq = expected.seq
       AND line.account_id = expected.credit_account_id
       AND line.folio_id IS NULL
       AND line.tx_code = expected.tx_code
       AND line.amount_minor = expected.amount_minor
       AND line.quantity = 1.000::numeric(10,3)
       AND line.tax_detail IS NULL
       AND line.folio_transfer_root_line_id IS NULL
       AND line.business_date = v_journal.business_date
       AND line.currency = v_journal.currency
    UNION ALL
    SELECT line.seq
      FROM public.posting_line AS line
     WHERE line.tenant_id = p_tenant_id
       AND line.journal_id = p_journal_id
       AND line.seq = 2
       AND line.account_id = v_revenue.credit_account_id
       AND line.folio_id IS NULL
       AND line.tx_code = v_revenue.tx_code
       AND line.amount_minor = -v_base_minor
       AND line.quantity = 1.000::numeric(10,3)
       AND line.tax_detail IS NULL
       AND line.folio_transfer_root_line_id IS NULL
       AND line.business_date = v_journal.business_date
       AND line.currency = v_journal.currency
  )
  SELECT pg_catalog.count(*)::integer
    INTO v_credit_lines
    FROM matched;
  IF v_credit_lines <> v_nonzero_taxes + 1
     OR (
       SELECT pg_catalog.count(*)
         FROM public.posting_line AS line
        WHERE line.tenant_id = p_tenant_id
          AND line.journal_id = p_journal_id
     ) <> v_nonzero_taxes + 1 THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'positive-tax journal credit posting set is inconsistent';
  END IF;

  INSERT INTO public.posting_line (
    tenant_id, journal_id, seq, account_id, folio_id, tx_code,
    description, amount_minor, quantity, tax_detail, business_date, currency
  ) VALUES (
    p_tenant_id, p_journal_id, 1, v_folio.account_id, p_folio_id,
    v_revenue.tx_code, v_journal.description, v_grand_minor,
    1.000::numeric(10,3), p_tax_detail, v_journal.business_date,
    v_journal.currency
  );

  INSERT INTO public.tax_attribution_journal_binding (
    tenant_id, property_node, posted_by, lineage_id, hold_binding_id,
    attribution_id, reservation_id, segment_id, folio_id, guest_account_id,
    journal_id, origin_quote_hash, snapshot_hash, currency, business_date
  ) VALUES (
    p_tenant_id, p_property_node, p_actor_id, v_lineage.id,
    v_lineage.binding_id, v_lineage.attribution_id, v_lineage.reservation_id,
    v_lineage.segment_id, p_folio_id, v_folio.account_id, p_journal_id,
    v_lineage.origin_quote_hash, v_lineage.snapshot_hash,
    v_lineage.currency, v_journal.business_date
  )
  RETURNING * INTO v_created;

  RETURN QUERY SELECT
    v_created.id, v_created.lineage_id, v_created.attribution_id,
    v_created.reservation_id, v_created.segment_id,
    v_created.folio_id, v_created.journal_id,
    v_created.origin_quote_hash, v_created.snapshot_hash,
    v_created.currency, v_created.business_date, true;
END;
$$;

ALTER FUNCTION public.lock_positive_tax_posting_rows(
  uuid,uuid[],uuid
) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.lock_positive_tax_posting_rows(
  uuid,uuid[],uuid
) FROM PUBLIC, app_role, yellow_runtime;
GRANT EXECUTE ON FUNCTION public.lock_positive_tax_posting_rows(
  uuid,uuid[],uuid
) TO app_role;

ALTER FUNCTION public.record_positive_tax_journal_binding(
  uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid[],jsonb
) OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.record_positive_tax_journal_binding(
  uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid[],jsonb
) FROM PUBLIC, app_role, yellow_runtime;
GRANT EXECUTE ON FUNCTION public.record_positive_tax_journal_binding(
  uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid[],jsonb
) TO app_role;

ALTER TABLE public.tax_attribution_journal_binding OWNER TO yellow_owner;
REVOKE ALL ON TABLE public.tax_attribution_journal_binding
  FROM PUBLIC, app_role;
REVOKE ALL ON TABLE public.tax_attribution_journal_binding
  FROM yellow_runtime;
GRANT SELECT ON TABLE public.tax_attribution_journal_binding TO app_role;
