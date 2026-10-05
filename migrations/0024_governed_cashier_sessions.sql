-- Order 197: governed property cash drawers, immutable denomination counts and
-- bounded cashier-session lifecycle authority. Cashier custody creates no
-- journal, posting, payment, document or business-day mutation.

DO $order197_no_legacy_cashier_sessions$
BEGIN
  IF EXISTS (SELECT 1 FROM public.cashier_session) THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'legacy cashier sessions require an explicit normalized migration';
  END IF;
END;
$order197_no_legacy_cashier_sessions$;

ALTER TABLE public.org_node
  ADD CONSTRAINT org_node_tenant_id_currency_uq
    UNIQUE (tenant_id, id, currency);

ALTER TABLE public.approval_request
  ADD CONSTRAINT approval_request_tenant_id_id_uq
    UNIQUE (tenant_id, id);

CREATE TABLE public.cash_drawer (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  property_node uuid NOT NULL,
  account_id uuid NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  currency character(3) NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  CONSTRAINT cash_drawer_pk PRIMARY KEY (tenant_id, id),
  CONSTRAINT cash_drawer_tenant_id_currency_uq
    UNIQUE (tenant_id, id, currency),
  CONSTRAINT cash_drawer_property_code_uq
    UNIQUE (tenant_id, property_node, code),
  CONSTRAINT cash_drawer_code_ck CHECK (
    pg_catalog.octet_length(code) BETWEEN 1 AND 64
    AND code = pg_catalog.btrim(code)
    AND code ~ '^[A-Z0-9][A-Z0-9._-]*$'
  ),
  CONSTRAINT cash_drawer_name_ck CHECK (
    pg_catalog.octet_length(name) BETWEEN 1 AND 120
    AND name = pg_catalog.btrim(name)
    AND name !~ '[[:cntrl:]]'
    AND name !~ U&'[\200B-\200D\202A-\202E\2060\2066-\2069\FEFF]'
  ),
  CONSTRAINT cash_drawer_property_currency_fk
    FOREIGN KEY (tenant_id, property_node, currency)
    REFERENCES public.org_node (tenant_id, id, currency),
  CONSTRAINT cash_drawer_account_fk
    FOREIGN KEY (tenant_id, property_node, currency, account_id)
    REFERENCES public.account (tenant_id, property_node, currency, id)
);

CREATE INDEX cash_drawer_property_lookup
  ON public.cash_drawer (tenant_id, property_node, active, code, id);

CREATE TABLE public.cash_drawer_denomination (
  tenant_id uuid NOT NULL,
  drawer_id uuid NOT NULL,
  unit_minor bigint NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  CONSTRAINT cash_drawer_denomination_pk
    PRIMARY KEY (tenant_id, drawer_id, unit_minor),
  CONSTRAINT cash_drawer_denomination_unit_ck CHECK (unit_minor > 0),
  CONSTRAINT cash_drawer_denomination_drawer_fk
    FOREIGN KEY (tenant_id, drawer_id)
    REFERENCES public.cash_drawer (tenant_id, id)
);

CREATE INDEX cash_drawer_denomination_active_lookup
  ON public.cash_drawer_denomination (tenant_id, drawer_id, active, unit_minor);

ALTER TABLE public.cashier_session
  DROP COLUMN opening_float,
  DROP COLUMN counted,
  ADD COLUMN drawer_id uuid NOT NULL,
  ADD COLUMN business_date date NOT NULL,
  ADD COLUMN currency character(3) NOT NULL,
  ADD COLUMN opening_count_id uuid NOT NULL,
  ADD COLUMN closing_count_id uuid,
  ADD COLUMN expected_minor bigint NOT NULL,
  ADD COLUMN counted_minor bigint,
  ADD COLUMN closed_by uuid,
  ADD COLUMN close_reason text,
  ADD COLUMN approval_request_id uuid,
  ADD COLUMN supervised_close boolean NOT NULL DEFAULT false,
  ADD CONSTRAINT cashier_session_tenant_id_id_uq
    UNIQUE (tenant_id, id),
  ADD CONSTRAINT cashier_session_tenant_id_id_drawer_uq
    UNIQUE (tenant_id, id, drawer_id),
  ADD CONSTRAINT cashier_session_property_day_fk
    FOREIGN KEY (tenant_id, property_node, business_date)
    REFERENCES public.business_day (tenant_id, property_node, business_date),
  ADD CONSTRAINT cashier_session_drawer_currency_fk
    FOREIGN KEY (tenant_id, drawer_id, currency)
    REFERENCES public.cash_drawer (tenant_id, id, currency),
  ADD CONSTRAINT cashier_session_opened_by_fk
    FOREIGN KEY (tenant_id, user_id)
    REFERENCES public.app_user (tenant_id, id),
  ADD CONSTRAINT cashier_session_closed_by_fk
    FOREIGN KEY (tenant_id, closed_by)
    REFERENCES public.app_user (tenant_id, id),
  ADD CONSTRAINT cashier_session_approval_fk
    FOREIGN KEY (tenant_id, approval_request_id)
    REFERENCES public.approval_request (tenant_id, id),
  ADD CONSTRAINT cashier_session_close_reason_ck CHECK (
    close_reason IS NULL OR (
      pg_catalog.octet_length(close_reason) BETWEEN 1 AND 500
      AND close_reason = pg_catalog.btrim(close_reason)
      AND close_reason !~ '[[:cntrl:]]'
      AND close_reason !~ U&'[\200B-\200D\202A-\202E\2060\2066-\2069\FEFF]'
    )
  ),
  ADD CONSTRAINT cashier_session_close_evidence_ck CHECK (
    (
      closed_at IS NULL
      AND closing_count_id IS NULL
      AND counted_minor IS NULL
      AND over_short_minor IS NULL
      AND closed_by IS NULL
      AND close_reason IS NULL
      AND approval_request_id IS NULL
      AND NOT supervised_close
    ) OR (
      closed_at IS NOT NULL
      AND closing_count_id IS NOT NULL
      AND counted_minor IS NOT NULL
      AND over_short_minor IS NOT NULL
      AND closed_by IS NOT NULL
      AND over_short_minor = counted_minor - expected_minor
      AND (over_short_minor = 0 OR (
        close_reason IS NOT NULL AND approval_request_id IS NOT NULL
      ))
      AND (NOT supervised_close OR (
        closed_by <> user_id AND close_reason IS NOT NULL
      ))
    )
  );

CREATE UNIQUE INDEX cashier_session_one_open_drawer
  ON public.cashier_session (tenant_id, drawer_id)
  WHERE closed_at IS NULL;

CREATE UNIQUE INDEX cashier_session_one_open_user
  ON public.cashier_session (tenant_id, user_id)
  WHERE closed_at IS NULL;

CREATE UNIQUE INDEX cashier_session_one_use_approval
  ON public.cashier_session (tenant_id, approval_request_id)
  WHERE approval_request_id IS NOT NULL;

CREATE INDEX cashier_session_property_history
  ON public.cashier_session (
    tenant_id, property_node, business_date DESC, opened_at DESC, id
  );

CREATE TABLE public.cashier_count (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  drawer_id uuid NOT NULL,
  kind text NOT NULL,
  attempt_no integer NOT NULL,
  counted_by uuid NOT NULL,
  counted_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  total_minor bigint NOT NULL,
  CONSTRAINT cashier_count_pk PRIMARY KEY (tenant_id, id),
  CONSTRAINT cashier_count_tenant_id_id_drawer_uq
    UNIQUE (tenant_id, id, session_id, drawer_id),
  CONSTRAINT cashier_count_session_attempt_uq
    UNIQUE (tenant_id, session_id, attempt_no),
  CONSTRAINT cashier_count_kind_attempt_ck CHECK (
    (kind = 'opening' AND attempt_no = 0)
    OR (kind = 'closing' AND attempt_no > 0)
  ),
  CONSTRAINT cashier_count_total_ck CHECK (total_minor >= 0),
  CONSTRAINT cashier_count_session_fk
    FOREIGN KEY (tenant_id, session_id, drawer_id)
    REFERENCES public.cashier_session (tenant_id, id, drawer_id),
  CONSTRAINT cashier_count_drawer_fk
    FOREIGN KEY (tenant_id, drawer_id)
    REFERENCES public.cash_drawer (tenant_id, id),
  CONSTRAINT cashier_count_actor_fk
    FOREIGN KEY (tenant_id, counted_by)
    REFERENCES public.app_user (tenant_id, id)
);

CREATE INDEX cashier_count_session_history
  ON public.cashier_count (
    tenant_id, session_id, attempt_no DESC, counted_at DESC, id
  );

CREATE TABLE public.cashier_count_line (
  tenant_id uuid NOT NULL,
  count_id uuid NOT NULL,
  session_id uuid NOT NULL,
  drawer_id uuid NOT NULL,
  denomination_minor bigint NOT NULL,
  quantity bigint NOT NULL,
  line_total_minor bigint NOT NULL,
  CONSTRAINT cashier_count_line_pk
    PRIMARY KEY (tenant_id, count_id, denomination_minor),
  CONSTRAINT cashier_count_line_quantity_ck CHECK (quantity >= 0),
  CONSTRAINT cashier_count_line_total_ck CHECK (
    line_total_minor >= 0
    AND line_total_minor = denomination_minor * quantity
  ),
  CONSTRAINT cashier_count_line_count_fk
    FOREIGN KEY (tenant_id, count_id, session_id, drawer_id)
    REFERENCES public.cashier_count (tenant_id, id, session_id, drawer_id),
  CONSTRAINT cashier_count_line_denomination_fk
    FOREIGN KEY (tenant_id, drawer_id, denomination_minor)
    REFERENCES public.cash_drawer_denomination (tenant_id, drawer_id, unit_minor)
);

CREATE INDEX cashier_count_line_session_lookup
  ON public.cashier_count_line (
    tenant_id, session_id, count_id, denomination_minor
  );

ALTER TABLE public.cashier_session
  ADD CONSTRAINT cashier_session_opening_count_fk
    FOREIGN KEY (tenant_id, opening_count_id, id, drawer_id)
    REFERENCES public.cashier_count (tenant_id, id, session_id, drawer_id)
    DEFERRABLE INITIALLY DEFERRED,
  ADD CONSTRAINT cashier_session_closing_count_fk
    FOREIGN KEY (tenant_id, closing_count_id, id, drawer_id)
    REFERENCES public.cashier_count (tenant_id, id, session_id, drawer_id)
    DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE public.cash_drawer ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_drawer_denomination ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cashier_count ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cashier_count_line ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON public.cash_drawer
  USING (tenant_id = pg_catalog.current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = pg_catalog.current_setting('app.tenant_id', true)::uuid);
CREATE POLICY tenant_isolation ON public.cash_drawer_denomination
  USING (tenant_id = pg_catalog.current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = pg_catalog.current_setting('app.tenant_id', true)::uuid);
CREATE POLICY tenant_isolation ON public.cashier_count
  USING (tenant_id = pg_catalog.current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = pg_catalog.current_setting('app.tenant_id', true)::uuid);
CREATE POLICY tenant_isolation ON public.cashier_count_line
  USING (tenant_id = pg_catalog.current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = pg_catalog.current_setting('app.tenant_id', true)::uuid);

CREATE FUNCTION public.open_cashier_session(
  p_tenant uuid,
  p_property uuid,
  p_drawer uuid,
  p_actor uuid,
  p_denomination_units bigint[],
  p_quantities bigint[]
) RETURNS TABLE (
  session_id uuid,
  count_id uuid,
  business_date date,
  currency character(3),
  expected_minor bigint,
  counted_minor bigint,
  opened_at timestamptz
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_context_tenant uuid;
  v_currency character(3);
  v_business_date date;
  v_line_count integer;
  v_active_count integer;
  v_total_numeric numeric;
  v_total bigint;
  v_session_id uuid := pg_catalog.gen_random_uuid();
  v_count_id uuid := pg_catalog.gen_random_uuid();
  v_opened_at timestamptz := pg_catalog.transaction_timestamp();
BEGIN
  IF session_user <> 'yellow_runtime'
     OR pg_catalog.current_setting('role', true) IS DISTINCT FROM 'app_role'
     OR current_user <> 'yellow_owner' THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'cashier open requires the governed runtime app role';
  END IF;

  BEGIN
    v_context_tenant := NULLIF(
      pg_catalog.current_setting('app.tenant_id', true), ''
    )::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'cashier open tenant context is invalid';
  END;
  IF v_context_tenant IS NULL OR p_tenant IS NULL
     OR v_context_tenant <> p_tenant THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'cashier open tenant context is invalid';
  END IF;

  v_line_count := pg_catalog.cardinality(p_denomination_units);
  IF p_property IS NULL OR p_drawer IS NULL OR p_actor IS NULL
     OR v_line_count IS NULL OR v_line_count < 1 OR v_line_count > 50
     OR v_line_count <> pg_catalog.cardinality(p_quantities)
     OR pg_catalog.array_ndims(p_denomination_units) <> 1
     OR pg_catalog.array_ndims(p_quantities) <> 1
     OR pg_catalog.array_lower(p_denomination_units, 1) <> 1
     OR pg_catalog.array_lower(p_quantities, 1) <> 1
     OR EXISTS (
       SELECT 1
       FROM pg_catalog.generate_subscripts(p_denomination_units, 1) AS line(i)
       WHERE p_denomination_units[line.i] IS NULL
          OR p_quantities[line.i] IS NULL
          OR p_denomination_units[line.i] <= 0
          OR p_quantities[line.i] < 0
     )
     OR (
       SELECT pg_catalog.count(DISTINCT p_denomination_units[line.i])
       FROM pg_catalog.generate_subscripts(p_denomination_units, 1) AS line(i)
     ) <> v_line_count THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'cashier count input is invalid';
  END IF;

  SELECT property.currency,
         (pg_catalog.transaction_timestamp() AT TIME ZONE property.timezone)::date
    INTO v_currency, v_business_date
    FROM public.org_node AS property
   WHERE property.tenant_id = p_tenant
     AND property.id = p_property
     AND property.kind = 'property'
     AND property.currency IS NOT NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'cashier property is unavailable';
  END IF;

  -- Canonical lifecycle lock order: current property-local day, drawer,
  -- session, then count rows. The day lock is read-only and never seals it.
  PERFORM 1
    FROM public.business_day AS day
   WHERE day.tenant_id = p_tenant
     AND day.property_node = p_property
     AND day.business_date = v_business_date
     AND day.sealed_at IS NULL
   FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'cashier business day is unavailable';
  END IF;

  PERFORM 1
    FROM public.cash_drawer AS drawer
    JOIN public.account AS account
      ON account.tenant_id = drawer.tenant_id
     AND account.property_node = drawer.property_node
     AND account.currency = drawer.currency
     AND account.id = drawer.account_id
   WHERE drawer.tenant_id = p_tenant
     AND drawer.id = p_drawer
     AND drawer.property_node = p_property
     AND drawer.currency = v_currency
     AND drawer.active
     AND account.role = 'cash'
     AND account.status = 'open'
   FOR UPDATE OF drawer;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'cashier drawer is unavailable';
  END IF;

  PERFORM 1
    FROM public.app_user AS actor
   WHERE actor.tenant_id = p_tenant
     AND actor.id = p_actor
     AND actor.status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'cashier actor is unavailable';
  END IF;

  SELECT pg_catalog.count(*)::integer
    INTO v_active_count
    FROM public.cash_drawer_denomination AS denomination
   WHERE denomination.tenant_id = p_tenant
     AND denomination.drawer_id = p_drawer
     AND denomination.active;
  IF v_active_count <> v_line_count OR EXISTS (
    SELECT 1
      FROM pg_catalog.generate_subscripts(p_denomination_units, 1) AS line(i)
      LEFT JOIN public.cash_drawer_denomination AS denomination
        ON denomination.tenant_id = p_tenant
       AND denomination.drawer_id = p_drawer
       AND denomination.unit_minor = p_denomination_units[line.i]
       AND denomination.active
     WHERE denomination.unit_minor IS NULL
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'cashier count denominations are invalid';
  END IF;

  SELECT pg_catalog.sum(
           p_denomination_units[line.i]::numeric
           * p_quantities[line.i]::numeric
         )
    INTO v_total_numeric
    FROM pg_catalog.generate_subscripts(p_denomination_units, 1) AS line(i);
  IF v_total_numeric IS NULL OR v_total_numeric < 0::numeric
     OR v_total_numeric > 9223372036854775807::numeric THEN
    RAISE EXCEPTION USING ERRCODE = '22003',
      MESSAGE = 'cashier count total is outside signed int64';
  END IF;
  v_total := v_total_numeric::bigint;

  INSERT INTO public.cashier_session (
    id, tenant_id, property_node, user_id, drawer_id, business_date,
    currency, opening_count_id, expected_minor, opened_at
  ) VALUES (
    v_session_id, p_tenant, p_property, p_actor, p_drawer, v_business_date,
    v_currency, v_count_id, v_total, v_opened_at
  );

  INSERT INTO public.cashier_count (
    tenant_id, id, session_id, drawer_id, kind, attempt_no,
    counted_by, counted_at, total_minor
  ) VALUES (
    p_tenant, v_count_id, v_session_id, p_drawer, 'opening', 0,
    p_actor, v_opened_at, v_total
  );

  INSERT INTO public.cashier_count_line (
    tenant_id, count_id, session_id, drawer_id,
    denomination_minor, quantity, line_total_minor
  )
  SELECT p_tenant, v_count_id, v_session_id, p_drawer,
         p_denomination_units[line.i], p_quantities[line.i],
         (
           p_denomination_units[line.i]::numeric
           * p_quantities[line.i]::numeric
         )::bigint
    FROM pg_catalog.generate_subscripts(p_denomination_units, 1) AS line(i);

  RETURN QUERY SELECT v_session_id, v_count_id, v_business_date,
                      v_currency, v_total, v_total, v_opened_at;
END;
$$;

CREATE FUNCTION public.append_cashier_count(
  p_tenant uuid,
  p_property uuid,
  p_session uuid,
  p_actor uuid,
  p_denomination_units bigint[],
  p_quantities bigint[]
) RETURNS TABLE (
  count_id uuid,
  session_id uuid,
  attempt_no integer,
  counted_minor bigint,
  counted_at timestamptz
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_context_tenant uuid;
  v_business_date date;
  v_drawer_id uuid;
  v_line_count integer;
  v_active_count integer;
  v_attempt_no integer;
  v_total_numeric numeric;
  v_total bigint;
  v_count_id uuid := pg_catalog.gen_random_uuid();
  v_counted_at timestamptz := pg_catalog.transaction_timestamp();
BEGIN
  IF session_user <> 'yellow_runtime'
     OR pg_catalog.current_setting('role', true) IS DISTINCT FROM 'app_role'
     OR current_user <> 'yellow_owner' THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'cashier count requires the governed runtime app role';
  END IF;

  BEGIN
    v_context_tenant := NULLIF(
      pg_catalog.current_setting('app.tenant_id', true), ''
    )::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'cashier count tenant context is invalid';
  END;
  IF v_context_tenant IS NULL OR p_tenant IS NULL
     OR v_context_tenant <> p_tenant THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'cashier count tenant context is invalid';
  END IF;

  v_line_count := pg_catalog.cardinality(p_denomination_units);
  IF p_property IS NULL OR p_session IS NULL OR p_actor IS NULL
     OR v_line_count IS NULL OR v_line_count < 1 OR v_line_count > 50
     OR v_line_count <> pg_catalog.cardinality(p_quantities)
     OR pg_catalog.array_ndims(p_denomination_units) <> 1
     OR pg_catalog.array_ndims(p_quantities) <> 1
     OR pg_catalog.array_lower(p_denomination_units, 1) <> 1
     OR pg_catalog.array_lower(p_quantities, 1) <> 1
     OR EXISTS (
       SELECT 1
       FROM pg_catalog.generate_subscripts(p_denomination_units, 1) AS line(i)
       WHERE p_denomination_units[line.i] IS NULL
          OR p_quantities[line.i] IS NULL
          OR p_denomination_units[line.i] <= 0
          OR p_quantities[line.i] < 0
     )
     OR (
       SELECT pg_catalog.count(DISTINCT p_denomination_units[line.i])
       FROM pg_catalog.generate_subscripts(p_denomination_units, 1) AS line(i)
     ) <> v_line_count THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'cashier count input is invalid';
  END IF;

  SELECT (pg_catalog.transaction_timestamp() AT TIME ZONE property.timezone)::date
    INTO v_business_date
    FROM public.org_node AS property
   WHERE property.tenant_id = p_tenant
     AND property.id = p_property
     AND property.kind = 'property'
     AND property.currency IS NOT NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'cashier property is unavailable';
  END IF;

  SELECT cashier.drawer_id
    INTO v_drawer_id
    FROM public.cashier_session AS cashier
   WHERE cashier.tenant_id = p_tenant
     AND cashier.id = p_session
     AND cashier.property_node = p_property;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'cashier session is unavailable';
  END IF;

  PERFORM 1
    FROM public.business_day AS day
   WHERE day.tenant_id = p_tenant
     AND day.property_node = p_property
     AND day.business_date = v_business_date
     AND day.sealed_at IS NULL
   FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'cashier business day is unavailable';
  END IF;

  PERFORM 1
    FROM public.cash_drawer AS drawer
   WHERE drawer.tenant_id = p_tenant
     AND drawer.id = v_drawer_id
     AND drawer.property_node = p_property
     AND drawer.active
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'cashier drawer is unavailable';
  END IF;

  PERFORM 1
    FROM public.cashier_session AS cashier
   WHERE cashier.tenant_id = p_tenant
     AND cashier.id = p_session
     AND cashier.property_node = p_property
     AND cashier.drawer_id = v_drawer_id
     AND cashier.business_date = v_business_date
     AND cashier.closed_at IS NULL
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'cashier session is unavailable';
  END IF;

  PERFORM 1
    FROM public.app_user AS actor
   WHERE actor.tenant_id = p_tenant
     AND actor.id = p_actor
     AND actor.status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'cashier actor is unavailable';
  END IF;

  SELECT pg_catalog.count(*)::integer
    INTO v_active_count
    FROM public.cash_drawer_denomination AS denomination
   WHERE denomination.tenant_id = p_tenant
     AND denomination.drawer_id = v_drawer_id
     AND denomination.active;
  IF v_active_count <> v_line_count OR EXISTS (
    SELECT 1
      FROM pg_catalog.generate_subscripts(p_denomination_units, 1) AS line(i)
      LEFT JOIN public.cash_drawer_denomination AS denomination
        ON denomination.tenant_id = p_tenant
       AND denomination.drawer_id = v_drawer_id
       AND denomination.unit_minor = p_denomination_units[line.i]
       AND denomination.active
     WHERE denomination.unit_minor IS NULL
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'cashier count denominations are invalid';
  END IF;

  SELECT pg_catalog.sum(
           p_denomination_units[line.i]::numeric
           * p_quantities[line.i]::numeric
         )
    INTO v_total_numeric
    FROM pg_catalog.generate_subscripts(p_denomination_units, 1) AS line(i);
  IF v_total_numeric IS NULL OR v_total_numeric < 0::numeric
     OR v_total_numeric > 9223372036854775807::numeric THEN
    RAISE EXCEPTION USING ERRCODE = '22003',
      MESSAGE = 'cashier count total is outside signed int64';
  END IF;
  v_total := v_total_numeric::bigint;

  SELECT COALESCE(pg_catalog.max(count.attempt_no), 0) + 1
    INTO v_attempt_no
    FROM public.cashier_count AS count
   WHERE count.tenant_id = p_tenant
     AND count.session_id = p_session;

  INSERT INTO public.cashier_count (
    tenant_id, id, session_id, drawer_id, kind, attempt_no,
    counted_by, counted_at, total_minor
  ) VALUES (
    p_tenant, v_count_id, p_session, v_drawer_id, 'closing', v_attempt_no,
    p_actor, v_counted_at, v_total
  );

  INSERT INTO public.cashier_count_line (
    tenant_id, count_id, session_id, drawer_id,
    denomination_minor, quantity, line_total_minor
  )
  SELECT p_tenant, v_count_id, p_session, v_drawer_id,
         p_denomination_units[line.i], p_quantities[line.i],
         (
           p_denomination_units[line.i]::numeric
           * p_quantities[line.i]::numeric
         )::bigint
    FROM pg_catalog.generate_subscripts(p_denomination_units, 1) AS line(i);

  RETURN QUERY SELECT v_count_id, p_session, v_attempt_no, v_total, v_counted_at;
END;
$$;

CREATE FUNCTION public.close_cashier_session(
  p_tenant uuid,
  p_property uuid,
  p_session uuid,
  p_actor uuid,
  p_count uuid,
  p_approval uuid,
  p_reason text,
  p_supervised boolean
) RETURNS TABLE (
  session_id uuid,
  opening_count_id uuid,
  closing_count_id uuid,
  business_date date,
  currency character(3),
  expected_minor bigint,
  counted_minor bigint,
  over_short_minor bigint,
  closed_at timestamptz,
  closed_by uuid,
  supervised boolean
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_context_tenant uuid;
  v_business_date date;
  v_drawer_id uuid;
  v_opened_by uuid;
  v_opening_count_id uuid;
  v_latest_count_id uuid;
  v_counted_by uuid;
  v_currency character(3);
  v_expected bigint;
  v_counted bigint;
  v_over_short_numeric numeric;
  v_over_short bigint;
  v_closed_at timestamptz := pg_catalog.transaction_timestamp();
BEGIN
  IF session_user <> 'yellow_runtime'
     OR pg_catalog.current_setting('role', true) IS DISTINCT FROM 'app_role'
     OR current_user <> 'yellow_owner' THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'cashier close requires the governed runtime app role';
  END IF;

  BEGIN
    v_context_tenant := NULLIF(
      pg_catalog.current_setting('app.tenant_id', true), ''
    )::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'cashier close tenant context is invalid';
  END;
  IF v_context_tenant IS NULL OR p_tenant IS NULL
     OR v_context_tenant <> p_tenant THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'cashier close tenant context is invalid';
  END IF;
  IF p_property IS NULL OR p_session IS NULL OR p_actor IS NULL
     OR p_count IS NULL OR p_supervised IS NULL
     OR (p_reason IS NOT NULL AND (
       pg_catalog.octet_length(p_reason) NOT BETWEEN 1 AND 500
       OR p_reason <> pg_catalog.btrim(p_reason)
       OR p_reason ~ '[[:cntrl:]]'
       OR p_reason ~ U&'[\200B-\200D\202A-\202E\2060\2066-\2069\FEFF]'
     )) THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'cashier close input is invalid';
  END IF;

  SELECT (pg_catalog.transaction_timestamp() AT TIME ZONE property.timezone)::date
    INTO v_business_date
    FROM public.org_node AS property
   WHERE property.tenant_id = p_tenant
     AND property.id = p_property
     AND property.kind = 'property'
     AND property.currency IS NOT NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'cashier property is unavailable';
  END IF;

  SELECT cashier.drawer_id
    INTO v_drawer_id
    FROM public.cashier_session AS cashier
   WHERE cashier.tenant_id = p_tenant
     AND cashier.id = p_session
     AND cashier.property_node = p_property;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'cashier session is unavailable';
  END IF;

  PERFORM 1
    FROM public.business_day AS day
   WHERE day.tenant_id = p_tenant
     AND day.property_node = p_property
     AND day.business_date = v_business_date
     AND day.sealed_at IS NULL
   FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'cashier business day is unavailable';
  END IF;

  PERFORM 1
    FROM public.cash_drawer AS drawer
   WHERE drawer.tenant_id = p_tenant
     AND drawer.id = v_drawer_id
     AND drawer.property_node = p_property
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'cashier drawer is unavailable';
  END IF;

  SELECT cashier.user_id, cashier.opening_count_id, cashier.business_date,
         cashier.currency, cashier.expected_minor
    INTO v_opened_by, v_opening_count_id, v_business_date,
         v_currency, v_expected
    FROM public.cashier_session AS cashier
   WHERE cashier.tenant_id = p_tenant
     AND cashier.id = p_session
     AND cashier.property_node = p_property
     AND cashier.drawer_id = v_drawer_id
     AND cashier.business_date = v_business_date
     AND cashier.closed_at IS NULL
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'cashier session is unavailable';
  END IF;

  PERFORM 1
    FROM public.app_user AS actor
   WHERE actor.tenant_id = p_tenant
     AND actor.id = p_actor
     AND actor.status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'cashier actor is unavailable';
  END IF;

  SELECT count.id, count.counted_by, count.total_minor
    INTO v_latest_count_id, v_counted_by, v_counted
    FROM public.cashier_count AS count
   WHERE count.tenant_id = p_tenant
     AND count.session_id = p_session
     AND count.kind = 'closing'
   ORDER BY count.attempt_no DESC
   LIMIT 1;
  IF NOT FOUND OR v_latest_count_id <> p_count OR v_counted_by <> p_actor THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'cashier close count is stale or unavailable';
  END IF;

  IF (p_supervised AND p_actor = v_opened_by)
     OR (NOT p_supervised AND p_actor <> v_opened_by) THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'cashier close actor is not authorized for this close mode';
  END IF;

  v_over_short_numeric := v_counted::numeric - v_expected::numeric;
  IF v_over_short_numeric < (-9223372036854775808)::numeric
     OR v_over_short_numeric > 9223372036854775807::numeric THEN
    RAISE EXCEPTION USING ERRCODE = '22003',
      MESSAGE = 'cashier over-short is outside signed int64';
  END IF;
  v_over_short := v_over_short_numeric::bigint;

  IF p_supervised AND p_reason IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'supervised cashier close requires a reason';
  END IF;

  IF v_over_short = 0 THEN
    IF p_approval IS NOT NULL OR (NOT p_supervised AND p_reason IS NOT NULL) THEN
      RAISE EXCEPTION USING ERRCODE = '22023',
        MESSAGE = 'cashier close evidence is invalid';
    END IF;
  ELSE
    IF p_approval IS NULL OR p_reason IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '55000',
        MESSAGE = 'cashier discrepancy requires exact approval and reason';
    END IF;

    PERFORM 1
      FROM public.approval_request AS approval
     WHERE approval.tenant_id = p_tenant
       AND approval.id = p_approval
       AND approval.kind = 'cashier_over_short'
       AND approval.subject_type = 'cashier_session'
       AND approval.subject_id = p_session
       AND approval.requested_by = p_actor
       AND approval.status = 'approved'
       AND approval.decided_by IS NOT NULL
       AND approval.decided_by <> p_actor
       AND approval.decided_by <> v_opened_by
       AND approval.payload = pg_catalog.jsonb_build_object(
         'sessionId', p_session::text,
         'countId', p_count::text,
         'expectedMinor', v_expected::text,
         'countedMinor', v_counted::text,
         'overShortMinor', v_over_short::text
       )
     FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = '55000',
        MESSAGE = 'cashier discrepancy approval is unavailable or stale';
    END IF;
  END IF;

  UPDATE public.cashier_session AS cashier
     SET closing_count_id = p_count,
         counted_minor = v_counted,
         over_short_minor = v_over_short,
         closed_at = v_closed_at,
         closed_by = p_actor,
         close_reason = p_reason,
         approval_request_id = p_approval,
         supervised_close = p_supervised
   WHERE cashier.tenant_id = p_tenant
     AND cashier.id = p_session
     AND cashier.closed_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'cashier session changed concurrently';
  END IF;

  RETURN QUERY
  SELECT p_session, v_opening_count_id, p_count, v_business_date,
         v_currency, v_expected, v_counted, v_over_short,
         v_closed_at, p_actor, p_supervised;
END;
$$;

ALTER FUNCTION public.open_cashier_session(uuid,uuid,uuid,uuid,bigint[],bigint[])
  OWNER TO yellow_owner;
ALTER FUNCTION public.append_cashier_count(uuid,uuid,uuid,uuid,bigint[],bigint[])
  OWNER TO yellow_owner;
ALTER FUNCTION public.close_cashier_session(uuid,uuid,uuid,uuid,uuid,uuid,text,boolean)
  OWNER TO yellow_owner;

REVOKE ALL ON FUNCTION public.open_cashier_session(uuid,uuid,uuid,uuid,bigint[],bigint[])
  FROM PUBLIC, app_role, yellow_runtime;
REVOKE ALL ON FUNCTION public.append_cashier_count(uuid,uuid,uuid,uuid,bigint[],bigint[])
  FROM PUBLIC, app_role, yellow_runtime;
REVOKE ALL ON FUNCTION public.close_cashier_session(uuid,uuid,uuid,uuid,uuid,uuid,text,boolean)
  FROM PUBLIC, app_role, yellow_runtime;
GRANT EXECUTE ON FUNCTION public.open_cashier_session(uuid,uuid,uuid,uuid,bigint[],bigint[])
  TO app_role;
GRANT EXECUTE ON FUNCTION public.append_cashier_count(uuid,uuid,uuid,uuid,bigint[],bigint[])
  TO app_role;
GRANT EXECUTE ON FUNCTION public.close_cashier_session(uuid,uuid,uuid,uuid,uuid,uuid,text,boolean)
  TO app_role;

GRANT SELECT ON public.cash_drawer, public.cash_drawer_denomination,
  public.cashier_count, public.cashier_count_line TO app_role;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE
  ON public.cash_drawer, public.cash_drawer_denomination,
     public.cashier_session, public.cashier_count, public.cashier_count_line
  FROM PUBLIC, app_role, yellow_runtime;
