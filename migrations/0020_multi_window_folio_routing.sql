-- Order 188: immutable, whole-allocation routing between sibling folio windows.
-- Existing posting rows remain unchanged; every move is one balanced transfer journal.

ALTER TABLE public.posting_line
  ADD CONSTRAINT posting_line_tenant_id_id_uq UNIQUE (tenant_id, id),
  ADD COLUMN folio_transfer_root_line_id uuid,
  ADD CONSTRAINT posting_line_transfer_root_not_self_ck
    CHECK (folio_transfer_root_line_id IS NULL OR folio_transfer_root_line_id <> id),
  ADD CONSTRAINT posting_line_transfer_shape_ck
    CHECK (
      folio_transfer_root_line_id IS NULL
      OR (folio_id IS NOT NULL AND amount_minor <> 0 AND tax_detail IS NULL)
    ),
  ADD CONSTRAINT posting_line_transfer_root_fk
    FOREIGN KEY (tenant_id, folio_transfer_root_line_id)
    REFERENCES public.posting_line (tenant_id, id);

CREATE INDEX posting_line_transfer_root_lookup
  ON public.posting_line (tenant_id, folio_transfer_root_line_id)
  WHERE folio_transfer_root_line_id IS NOT NULL;

CREATE FUNCTION public.create_folio_transfer(
  p_tenant_id uuid,
  p_source_folio uuid,
  p_destination_folio uuid,
  p_root_line_ids uuid[],
  p_actor_id uuid,
  p_reason text
) RETURNS TABLE (
  journal_id uuid,
  property_node uuid,
  business_date date,
  currency character(3),
  source_folio_id uuid,
  destination_folio_id uuid,
  root_line_id uuid,
  amount_minor bigint,
  tx_code text,
  description text,
  quantity numeric(10,3)
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_context_tenant uuid;
  v_requested_roots integer;
  v_account_id uuid;
  v_property_node uuid;
  v_reservation_id uuid;
  v_currency character(3);
  v_timezone text;
  v_business_date date;
  v_sealed_at timestamptz;
  v_family_count integer;
  v_root record;
  v_peer record;
  v_companion_root uuid;
  v_line_count integer;
  v_transfer_invalid boolean;
  v_nonzero_folios integer;
  v_allocated_folio uuid;
  v_family_amount numeric;
  v_source_amount numeric;
  v_journal_id uuid;
  v_root_id uuid;
  v_index integer := 0;
  v_sorted_roots uuid[];
  v_amounts bigint[] := ARRAY[]::bigint[];
  v_tx_codes text[] := ARRAY[]::text[];
  v_descriptions text[] := ARRAY[]::text[];
  v_quantities numeric(10,3)[] := ARRAY[]::numeric(10,3)[];
BEGIN
  IF session_user <> 'yellow_runtime'
     OR pg_catalog.current_setting('role', true) IS DISTINCT FROM 'app_role'
     OR current_user <> 'yellow_owner' THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'folio transfer requires the governed runtime app role';
  END IF;

  BEGIN
    v_context_tenant := NULLIF(
      pg_catalog.current_setting('app.tenant_id', true), ''
    )::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'folio transfer tenant context is invalid';
  END;
  IF v_context_tenant IS NULL OR p_tenant_id IS NULL
     OR v_context_tenant <> p_tenant_id THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'folio transfer tenant context is invalid';
  END IF;

  v_requested_roots := pg_catalog.cardinality(p_root_line_ids);
  IF p_source_folio IS NULL OR p_destination_folio IS NULL
     OR p_source_folio = p_destination_folio
     OR p_actor_id IS NULL
     OR v_requested_roots IS NULL OR v_requested_roots < 1 OR v_requested_roots > 50
     OR EXISTS (
       SELECT 1 FROM pg_catalog.unnest(p_root_line_ids) AS requested(id)
       WHERE requested.id IS NULL
     )
     OR (
       SELECT pg_catalog.count(DISTINCT requested.id)
       FROM pg_catalog.unnest(p_root_line_ids) AS requested(id)
     ) <> v_requested_roots
     OR p_reason IS NULL OR p_reason <> pg_catalog.btrim(p_reason)
     OR pg_catalog.char_length(p_reason) NOT BETWEEN 1 AND 500
     OR p_reason ~ '[[:cntrl:]]'
     OR p_reason ~ U&'[\200B-\200D\202A-\202E\2060\2066-\2069\FEFF]' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'folio transfer input is invalid';
  END IF;

  SELECT pg_catalog.array_agg(requested.id ORDER BY requested.id)
    INTO v_sorted_roots
    FROM pg_catalog.unnest(p_root_line_ids) AS requested(id);

  -- Discover the shared account, then serialize every command in this folio family.
  SELECT source.account_id INTO v_account_id
    FROM public.folio AS source
   WHERE source.tenant_id = p_tenant_id
     AND source.id = p_source_folio;
  IF v_account_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'source folio is unavailable';
  END IF;

  PERFORM 1
    FROM public.account AS account
   WHERE account.tenant_id = p_tenant_id
     AND account.id = v_account_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'folio account is unavailable';
  END IF;

  PERFORM folio.id
    FROM public.folio AS folio
   WHERE folio.tenant_id = p_tenant_id
     AND folio.id = ANY (ARRAY[p_source_folio, p_destination_folio]::uuid[])
   ORDER BY folio.id
   FOR UPDATE;

  SELECT account.property_node, folio.reservation_id, account.currency, property.timezone
    INTO v_property_node, v_reservation_id, v_currency, v_timezone
    FROM public.folio AS folio
    JOIN public.account AS account
      ON account.tenant_id = folio.tenant_id
     AND account.id = folio.account_id
    JOIN public.reservation AS reservation
      ON reservation.tenant_id = folio.tenant_id
     AND reservation.id = folio.reservation_id
    JOIN public.org_node AS property
      ON property.tenant_id = account.tenant_id
     AND property.id = account.property_node
     AND property.kind = 'property'
   WHERE folio.tenant_id = p_tenant_id
     AND folio.id = p_source_folio
     AND folio.account_id = v_account_id
     AND folio.status = 'open'
     AND account.status = 'open'
     AND account.role = 'guest'
     AND reservation.property_node = account.property_node
     AND reservation.currency = account.currency
     AND property.currency = account.currency;

  SELECT pg_catalog.count(*)::integer INTO v_family_count
    FROM public.folio AS folio
    JOIN public.account AS account
      ON account.tenant_id = folio.tenant_id
     AND account.id = folio.account_id
    JOIN public.reservation AS reservation
      ON reservation.tenant_id = folio.tenant_id
     AND reservation.id = folio.reservation_id
    JOIN public.org_node AS property
      ON property.tenant_id = account.tenant_id
     AND property.id = account.property_node
     AND property.kind = 'property'
   WHERE folio.tenant_id = p_tenant_id
     AND folio.id = ANY (ARRAY[p_source_folio, p_destination_folio]::uuid[])
     AND folio.account_id = v_account_id
     AND folio.reservation_id = v_reservation_id
     AND folio.status = 'open'
     AND account.status = 'open'
     AND account.role = 'guest'
     AND account.property_node = v_property_node
     AND account.currency = v_currency
     AND reservation.property_node = v_property_node
     AND reservation.currency = v_currency
     AND property.currency = v_currency;

  IF v_family_count <> 2 OR v_property_node IS NULL OR v_reservation_id IS NULL
     OR v_currency IS NULL OR v_timezone IS NULL
     OR EXISTS (
       SELECT 1
         FROM public.folio AS folio
        WHERE folio.tenant_id = p_tenant_id
          AND folio.id = ANY (ARRAY[p_source_folio, p_destination_folio]::uuid[])
          AND (folio.account_id <> v_account_id
            OR folio.reservation_id IS DISTINCT FROM v_reservation_id)
     ) THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'folio transfer requires open sibling folios in one guest account family';
  END IF;

  PERFORM 1
    FROM public.app_user AS actor
   WHERE actor.tenant_id = p_tenant_id
     AND actor.id = p_actor_id
     AND actor.status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'folio transfer actor is unavailable';
  END IF;

  -- The correction command takes the identical per-root key before checking the
  -- current allocation. Sorted acquisition makes multi-root transfers deterministic.
  FOREACH v_root_id IN ARRAY v_sorted_roots
  LOOP
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        p_tenant_id::text || ':folio-transfer-root:' || v_root_id::text,
        188
      )
    );
  END LOOP;

  -- Re-derive every root after the family locks. Nothing is inserted until the
  -- complete set, correction companion closure, and whole allocations validate.
  FOREACH v_root_id IN ARRAY v_sorted_roots
  LOOP
    SELECT root.id, root.journal_id, root.account_id, root.folio_id,
           root.tx_code, root.description, root.amount_minor, root.quantity,
           root.business_date, root.currency, root.tax_detail,
           header.kind, header.reverses, header.source, header.property_node,
           header.business_date AS header_business_date, header.currency AS header_currency
      INTO v_root
      FROM public.posting_line AS root
      JOIN public.journal AS header
        ON header.tenant_id = root.tenant_id
       AND header.id = root.journal_id
     WHERE root.tenant_id = p_tenant_id
       AND root.id = v_root_id
       AND root.folio_transfer_root_line_id IS NULL
       AND root.seq = 1
       AND root.account_id = v_account_id
       AND root.folio_id IS NOT NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'folio transfer root is unavailable';
    END IF;

    IF v_root.property_node <> v_property_node OR v_root.currency <> v_currency
       OR v_root.header_currency <> v_currency
       OR v_root.business_date <> v_root.header_business_date
       OR v_root.tax_detail IS NOT NULL
       OR NOT (
         (v_root.kind = 'charge' AND v_root.reverses IS NULL
           AND v_root.source = '{"interface":"financials.charge.post"}'::jsonb
           AND v_root.amount_minor > 0)
         OR
         (v_root.kind = 'adjustment' AND v_root.reverses IS NOT NULL
           AND v_root.source = '{"interface":"financials.charge.reverse"}'::jsonb
           AND v_root.amount_minor < 0)
       ) THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'folio transfer root is not governed';
    END IF;

    SELECT pg_catalog.count(*)::integer INTO v_line_count
      FROM public.posting_line AS line
     WHERE line.tenant_id = p_tenant_id
       AND line.journal_id = v_root.journal_id;
    SELECT peer.account_id, peer.folio_id, peer.tx_code, peer.description,
           peer.amount_minor, peer.quantity, peer.business_date, peer.currency,
           peer.tax_detail, peer_account.role, peer_account.property_node,
           peer_account.currency AS account_currency
      INTO v_peer
      FROM public.posting_line AS peer
      JOIN public.account AS peer_account
        ON peer_account.tenant_id = peer.tenant_id
       AND peer_account.id = peer.account_id
     WHERE peer.tenant_id = p_tenant_id
       AND peer.journal_id = v_root.journal_id
       AND peer.seq = 2;
    IF v_line_count <> 2 OR NOT FOUND
       OR v_peer.account_id = v_account_id OR v_peer.folio_id IS NOT NULL
       OR v_peer.role <> 'revenue' OR v_peer.property_node <> v_property_node
       OR v_peer.account_currency <> v_currency
       OR v_peer.amount_minor <> -v_root.amount_minor
       OR v_peer.tx_code <> v_root.tx_code
       OR v_peer.description IS DISTINCT FROM v_root.description
       OR v_peer.quantity <> v_root.quantity
       OR v_peer.business_date <> v_root.business_date
       OR v_peer.currency <> v_root.currency OR v_peer.tax_detail IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'folio transfer root posting set is inconsistent';
    END IF;

    IF v_root.kind = 'charge' THEN
      SELECT correction_root.id INTO v_companion_root
        FROM public.journal AS correction
        JOIN public.posting_line AS correction_root
          ON correction_root.tenant_id = correction.tenant_id
         AND correction_root.journal_id = correction.id
         AND correction_root.seq = 1
       WHERE correction.tenant_id = p_tenant_id
         AND correction.reverses = v_root.journal_id
         AND correction.kind = 'adjustment'
         AND correction.source = '{"interface":"financials.charge.reverse"}'::jsonb;
      IF FOUND AND NOT (v_companion_root = ANY (v_sorted_roots)) THEN
        RAISE EXCEPTION USING ERRCODE = '55000',
          MESSAGE = 'corrected folio transfer roots must move with their contra companion';
      END IF;
    ELSE
      SELECT original_root.id INTO v_companion_root
        FROM public.journal AS original
        JOIN public.posting_line AS original_root
          ON original_root.tenant_id = original.tenant_id
         AND original_root.journal_id = original.id
         AND original_root.seq = 1
       WHERE original.tenant_id = p_tenant_id
         AND original.id = v_root.reverses
         AND original.kind = 'charge'
         AND original.reverses IS NULL
         AND original.source = '{"interface":"financials.charge.post"}'::jsonb;
      IF NOT FOUND OR NOT (v_companion_root = ANY (v_sorted_roots)) THEN
        RAISE EXCEPTION USING ERRCODE = '55000',
          MESSAGE = 'correction folio transfer root requires its original companion';
      END IF;
    END IF;

    SELECT EXISTS (
      SELECT 1
        FROM public.posting_line AS transfer_line
        JOIN public.journal AS transfer_header
          ON transfer_header.tenant_id = transfer_line.tenant_id
         AND transfer_header.id = transfer_line.journal_id
       WHERE transfer_line.tenant_id = p_tenant_id
         AND transfer_line.folio_transfer_root_line_id = v_root_id
       GROUP BY transfer_header.id, transfer_header.kind, transfer_header.reverses,
                transfer_header.source, transfer_header.property_node,
                transfer_header.business_date, transfer_header.currency
      HAVING transfer_header.kind <> 'transfer'
          OR transfer_header.reverses IS NOT NULL
          OR transfer_header.source <> '{"interface":"financials.folio.transfer"}'::jsonb
          OR transfer_header.property_node <> v_property_node
          OR transfer_header.currency <> v_currency
          OR pg_catalog.count(*) <> 2
          OR pg_catalog.count(DISTINCT transfer_line.folio_id) <> 2
          OR pg_catalog.count(*) FILTER (WHERE transfer_line.amount_minor = v_root.amount_minor) <> 1
          OR pg_catalog.count(*) FILTER (WHERE transfer_line.amount_minor = -v_root.amount_minor) <> 1
          OR pg_catalog.bool_or(transfer_line.account_id <> v_account_id)
          OR pg_catalog.bool_or(transfer_line.folio_id IS NULL)
          OR pg_catalog.bool_or(transfer_line.tx_code <> v_root.tx_code)
          OR pg_catalog.bool_or(transfer_line.description IS DISTINCT FROM v_root.description)
          OR pg_catalog.bool_or(transfer_line.quantity <> v_root.quantity)
          OR pg_catalog.bool_or(transfer_line.business_date <> transfer_header.business_date)
          OR pg_catalog.bool_or(transfer_line.currency <> v_currency)
          OR pg_catalog.bool_or(transfer_line.tax_detail IS NOT NULL)
    ) INTO v_transfer_invalid;
    IF v_transfer_invalid THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'folio transfer lineage is inconsistent';
    END IF;

    SELECT pg_catalog.count(*) FILTER (WHERE allocation.amount <> 0)::integer,
           (pg_catalog.array_agg(allocation.folio_id ORDER BY allocation.folio_id)
             FILTER (WHERE allocation.amount <> 0))[1],
           pg_catalog.sum(allocation.amount),
           pg_catalog.sum(allocation.amount) FILTER (WHERE allocation.folio_id = p_source_folio)
      INTO v_nonzero_folios, v_allocated_folio, v_family_amount, v_source_amount
      FROM (
        SELECT family_line.folio_id, pg_catalog.sum(family_line.amount_minor::numeric) AS amount
          FROM (
            SELECT root.folio_id, root.amount_minor
              FROM public.posting_line AS root
             WHERE root.tenant_id = p_tenant_id AND root.id = v_root_id
            UNION ALL
            SELECT transfer_line.folio_id, transfer_line.amount_minor
              FROM public.posting_line AS transfer_line
             WHERE transfer_line.tenant_id = p_tenant_id
               AND transfer_line.folio_transfer_root_line_id = v_root_id
          ) AS family_line
         GROUP BY family_line.folio_id
      ) AS allocation;
    IF v_nonzero_folios <> 1 OR v_allocated_folio <> p_source_folio
       OR v_family_amount <> v_root.amount_minor
       OR v_source_amount IS DISTINCT FROM v_root.amount_minor::numeric THEN
      RAISE EXCEPTION USING ERRCODE = '55000',
        MESSAGE = 'folio transfer root is stale, split, or not wholly allocated to the source';
    END IF;

    v_amounts := pg_catalog.array_append(v_amounts, v_root.amount_minor::bigint);
    v_tx_codes := pg_catalog.array_append(v_tx_codes, v_root.tx_code::text);
    v_descriptions := pg_catalog.array_append(v_descriptions, v_root.description::text);
    v_quantities := pg_catalog.array_append(v_quantities, v_root.quantity::numeric(10,3));
  END LOOP;

  v_business_date := (pg_catalog.transaction_timestamp() AT TIME ZONE v_timezone)::date;
  SELECT day.sealed_at INTO v_sealed_at
    FROM public.business_day AS day
   WHERE day.tenant_id = p_tenant_id
     AND day.property_node = v_property_node
     AND day.business_date = v_business_date
   FOR SHARE;
  IF NOT FOUND OR v_sealed_at IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0011',
      MESSAGE = 'folio transfer business day is missing or sealed';
  END IF;

  INSERT INTO public.journal (
    tenant_id, property_node, business_date, kind, description,
    currency, source, created_by
  ) VALUES (
    p_tenant_id, v_property_node, v_business_date, 'transfer', p_reason,
    v_currency, '{"interface":"financials.folio.transfer"}'::jsonb, p_actor_id
  ) RETURNING id INTO v_journal_id;

  FOREACH v_root_id IN ARRAY v_sorted_roots
  LOOP
    v_index := v_index + 1;
    INSERT INTO public.posting_line (
      tenant_id, journal_id, seq, account_id, folio_id, tx_code,
      description, amount_minor, quantity, business_date, currency,
      folio_transfer_root_line_id
    ) VALUES
      (
        p_tenant_id, v_journal_id, (v_index * 2 - 1)::smallint,
        v_account_id, p_source_folio, v_tx_codes[v_index],
        v_descriptions[v_index], -v_amounts[v_index], v_quantities[v_index],
        v_business_date, v_currency, v_root_id
      ),
      (
        p_tenant_id, v_journal_id, (v_index * 2)::smallint,
        v_account_id, p_destination_folio, v_tx_codes[v_index],
        v_descriptions[v_index], v_amounts[v_index], v_quantities[v_index],
        v_business_date, v_currency, v_root_id
      );
  END LOOP;

  RETURN QUERY
  SELECT v_journal_id, v_property_node, v_business_date, v_currency,
         p_source_folio, p_destination_folio, requested.id,
         v_amounts[requested.ordinality::integer],
         v_tx_codes[requested.ordinality::integer],
         v_descriptions[requested.ordinality::integer],
         v_quantities[requested.ordinality::integer]
    FROM pg_catalog.unnest(v_sorted_roots) WITH ORDINALITY AS requested(id, ordinality)
   ORDER BY requested.id;
END;
$$;

ALTER FUNCTION public.create_folio_transfer(uuid,uuid,uuid,uuid[],uuid,text)
  OWNER TO yellow_owner;
REVOKE ALL ON FUNCTION public.create_folio_transfer(uuid,uuid,uuid,uuid[],uuid,text)
  FROM PUBLIC, app_role, yellow_runtime;
GRANT EXECUTE ON FUNCTION public.create_folio_transfer(uuid,uuid,uuid,uuid[],uuid,text)
  TO app_role;

-- The capability alone may populate typed routing lineage. Existing exact insert
-- grants deliberately omit the new column; make that denial explicit for drift tests.
REVOKE INSERT (folio_transfer_root_line_id), UPDATE (folio_transfer_root_line_id)
  ON public.posting_line FROM PUBLIC, app_role, yellow_runtime;
