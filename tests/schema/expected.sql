--
-- PostgreSQL database dump
--


-- Dumped from database version 16.15
-- Dumped by pg_dump version 16.15

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: btree_gist; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;


--
-- Name: ltree; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS ltree WITH SCHEMA public;


--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: assert_day_open(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assert_day_open() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE v_sealed timestamptz;
BEGIN
  SELECT sealed_at INTO v_sealed FROM business_day
   WHERE property_node = NEW.property_node AND business_date = NEW.business_date;
  IF v_sealed IS NOT NULL AND NEW.kind NOT IN ('adjustment','correction') THEN
    RAISE EXCEPTION 'business date % sealed', NEW.business_date USING ERRCODE='P0011';
  END IF;
  RETURN NEW;
END $$;


--
-- Name: assert_journal_balanced(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assert_journal_balanced() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE v bigint;
BEGIN
  SELECT COALESCE(sum(amount_minor),0) INTO v FROM posting_line WHERE journal_id = NEW.journal_id;
  IF v <> 0 THEN RAISE EXCEPTION 'journal % unbalanced by %', NEW.journal_id, v
    USING ERRCODE = 'P0010'; END IF;
  RETURN NULL;
END $$;


--
-- Name: expire_holds(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.expire_holds() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE n int := 0; r record;
BEGIN
  FOR r IN SELECT id, tenant_id FROM hold WHERE status='active' AND expires_at < now()
  LOOP
    PERFORM release_occupancy(r.tenant_id, r.id);
    UPDATE hold SET status='expired' WHERE id = r.id;
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;


--
-- Name: prune_outbox(interval); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prune_outbox(p_retain interval DEFAULT '30 days'::interval) RETURNS bigint
    LANGUAGE sql SECURITY DEFINER
    AS $$
  WITH gone AS (
    DELETE FROM outbox
     WHERE published_at IS NOT NULL AND published_at < now() - p_retain
    RETURNING 1)
  SELECT count(*) FROM gone;
$$;


--
-- Name: record_occupancy(uuid, uuid, tstzrange, uuid, text, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_occupancy(p_tenant uuid, p_space uuid, p_period tstzrange, p_slot uuid, p_slot_kind text, p_exclusive boolean) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_id uuid; v_cap int; v_pos int;
BEGIN
  IF p_exclusive THEN
    INSERT INTO space_occupancy (tenant_id, space_id, period, slot_ref, slot_kind, exclusive, claim)
    VALUES (p_tenant, p_space, p_period, p_slot, p_slot_kind, true, int4range(0, NULL))
    RETURNING id INTO v_id;
  ELSE
    -- Perf aid, NOT correctness (constraint is the truth). Queue is PER SPACE, so a
    -- property's spaces don't contend with each other; model mega-dorms as multiple
    -- physical spaces (they are anyway). On exclusion violation the APP retries the
    -- next position (bounded) before surfacing 409 — see CONTRACTS §2.
    PERFORM pg_advisory_xact_lock(hashtextextended(p_space::text, 42));
    SELECT capacity INTO v_cap FROM space WHERE id = p_space AND tenant_id = p_tenant;
    SELECT g.p INTO v_pos FROM generate_series(0, v_cap - 1) AS g(p)
     WHERE NOT EXISTS (SELECT 1 FROM space_occupancy so
        WHERE so.tenant_id = p_tenant AND so.space_id = p_space
          AND so.period && p_period AND so.claim && int4range(g.p, g.p + 1))
     ORDER BY g.p LIMIT 1;
    IF v_pos IS NULL THEN RAISE EXCEPTION 'capacity_exceeded' USING ERRCODE = 'P0002'; END IF;
    INSERT INTO space_occupancy (tenant_id, space_id, period, slot_ref, slot_kind, exclusive, claim)
    VALUES (p_tenant, p_space, p_period, p_slot, p_slot_kind, false, int4range(v_pos, v_pos + 1))
    RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END $$;


--
-- Name: release_occupancy(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.release_occupancy(p_tenant uuid, p_slot uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE n int;
BEGIN
  DELETE FROM space_occupancy WHERE tenant_id = p_tenant AND slot_ref = p_slot;
  GET DIAGNOSTICS n = ROW_COUNT; RETURN n;
END $$;


--
-- Name: seal_business_day(uuid, uuid, date, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.seal_business_day(p_tenant uuid, p_property uuid, p_date date, p_user uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE business_day SET sealed_at = now(), sealed_by = p_user
   WHERE tenant_id = p_tenant AND property_node = p_property
     AND business_date = p_date AND sealed_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'day missing or already sealed' USING ERRCODE='P0012'; END IF;
END $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: account; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    property_node uuid,
    role text NOT NULL,
    party_id uuid,
    name text NOT NULL,
    currency character(3) NOT NULL,
    credit_limit_minor bigint,
    status text DEFAULT 'open'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT account_role_check CHECK ((role = ANY (ARRAY['guest'::text, 'company'::text, 'group_master'::text, 'house'::text, 'outlet'::text, 'event'::text, 'trust'::text, 'ar_control'::text, 'cash'::text, 'bank'::text, 'card_clearing'::text, 'upi_clearing'::text, 'revenue'::text, 'tax_payable'::text, 'deposit_liability'::text, 'payable'::text, 'fx'::text]))),
    CONSTRAINT account_status_check CHECK ((status = ANY (ARRAY['open'::text, 'frozen'::text, 'closed'::text])))
);


--
-- Name: address; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.address (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    party_id uuid NOT NULL,
    kind text DEFAULT 'home'::text NOT NULL,
    lines text[],
    city text,
    region text,
    postal_code text,
    country character(2) NOT NULL
);


--
-- Name: alert; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alert (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    subject_type text NOT NULL,
    subject_id uuid NOT NULL,
    code text,
    message text NOT NULL,
    show_on text DEFAULT 'always'::text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    CONSTRAINT alert_show_on_check CHECK ((show_on = ANY (ARRAY['checkin'::text, 'checkout'::text, 'always'::text])))
);


--
-- Name: api_client; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.api_client (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    scopes text[] DEFAULT '{}'::text[] NOT NULL,
    scope_node uuid,
    secret_hash text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: api_idempotency; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.api_idempotency (
    tenant_id uuid NOT NULL,
    operation text NOT NULL,
    key_hash character(64) NOT NULL,
    request_hash character(64) NOT NULL,
    response_status smallint,
    response_body jsonb,
    created_at timestamp with time zone NOT NULL,
    completed_at timestamp with time zone,
    expires_at timestamp with time zone NOT NULL,
    CONSTRAINT api_idempotency_check CHECK ((expires_at = (created_at + '24:00:00'::interval))),
    CONSTRAINT api_idempotency_check1 CHECK ((((completed_at IS NULL) AND (response_status IS NULL) AND (response_body IS NULL)) OR ((completed_at IS NOT NULL) AND (response_status IS NOT NULL) AND (response_body IS NOT NULL) AND (completed_at >= created_at) AND (completed_at <= expires_at)))),
    CONSTRAINT api_idempotency_key_hash_check CHECK ((key_hash ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT api_idempotency_operation_check CHECK ((operation ~ '^[a-z][a-z0-9_.-]{0,127}$'::text)),
    CONSTRAINT api_idempotency_request_hash_check CHECK ((request_hash ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT api_idempotency_response_status_check CHECK (((response_status >= 200) AND (response_status <= 299)))
);


--
-- Name: app_user; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_user (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    email text NOT NULL,
    display_name text NOT NULL,
    auth jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: approval_request; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.approval_request (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    kind text NOT NULL,
    subject_type text NOT NULL,
    subject_id uuid NOT NULL,
    requested_by uuid NOT NULL,
    payload jsonb NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    decided_by uuid,
    decided_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT approval_request_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'expired'::text])))
);


--
-- Name: ar_allocation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ar_allocation (
    tenant_id uuid NOT NULL,
    invoice_doc uuid NOT NULL,
    payment_journal uuid NOT NULL,
    amount_minor bigint NOT NULL
);


--
-- Name: automation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.automation (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    scope_node uuid NOT NULL,
    name text NOT NULL,
    trigger_event text NOT NULL,
    condition jsonb DEFAULT '{}'::jsonb NOT NULL,
    action jsonb NOT NULL,
    priority integer DEFAULT 100 NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    effective tstzrange DEFAULT tstzrange(now(), NULL::timestamp with time zone) NOT NULL
);


--
-- Name: availability_projection; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.availability_projection (
    tenant_id uuid NOT NULL,
    property_node uuid NOT NULL,
    unit_type_id uuid NOT NULL,
    stay_date date NOT NULL,
    physical integer NOT NULL,
    sold integer NOT NULL,
    held integer NOT NULL,
    blocked integer NOT NULL,
    ooo integer NOT NULL,
    available integer GENERATED ALWAYS AS (((((physical - sold) - held) - blocked) - ooo)) STORED,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: block_allotment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.block_allotment (
    tenant_id uuid NOT NULL,
    group_id uuid NOT NULL,
    unit_type_id uuid NOT NULL,
    stay_date date NOT NULL,
    blocked integer NOT NULL,
    rate_override jsonb
);


--
-- Name: block_status_def; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.block_status_def (
    tenant_id uuid NOT NULL,
    code text NOT NULL,
    deducts boolean NOT NULL,
    sort integer DEFAULT 0 NOT NULL
);


--
-- Name: business_day; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.business_day (
    tenant_id uuid NOT NULL,
    property_node uuid NOT NULL,
    business_date date NOT NULL,
    opened_at timestamp with time zone DEFAULT now() NOT NULL,
    sealed_at timestamp with time zone,
    sealed_by uuid
);


--
-- Name: cashier_session; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cashier_session (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    property_node uuid NOT NULL,
    user_id uuid NOT NULL,
    opened_at timestamp with time zone DEFAULT now() NOT NULL,
    closed_at timestamp with time zone,
    opening_float jsonb,
    counted jsonb,
    over_short_minor bigint
);


--
-- Name: channel; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel (
    code text NOT NULL,
    name text NOT NULL,
    adapter_extension text
);


--
-- Name: channel_map; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel_map (
    tenant_id uuid NOT NULL,
    property_node uuid NOT NULL,
    channel_code text NOT NULL,
    kind text NOT NULL,
    internal_id uuid NOT NULL,
    external_code text NOT NULL,
    CONSTRAINT channel_map_kind_check CHECK ((kind = ANY (ARRAY['unit_type'::text, 'rate_plan'::text])))
);


--
-- Name: consent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.consent (
    tenant_id uuid NOT NULL,
    party_id uuid NOT NULL,
    purpose text NOT NULL,
    granted boolean NOT NULL,
    at timestamp with time zone DEFAULT now() NOT NULL,
    source text
);


--
-- Name: consumer_cursor; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.consumer_cursor (
    consumer text NOT NULL,
    last_seq bigint DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: consumer_processed; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.consumer_processed (
    consumer text NOT NULL,
    outbox_id uuid NOT NULL,
    processed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: contact_point; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contact_point (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    party_id uuid NOT NULL,
    kind text NOT NULL,
    value text NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    verified boolean DEFAULT false NOT NULL,
    CONSTRAINT contact_point_kind_check CHECK ((kind = ANY (ARRAY['email'::text, 'phone'::text, 'whatsapp'::text])))
);


--
-- Name: rate_price; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rate_price (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    rate_plan_id uuid NOT NULL,
    unit_type_id uuid NOT NULL,
    stay_dates daterange NOT NULL,
    dow_mask smallint DEFAULT 127 NOT NULL,
    pricing jsonb NOT NULL,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    superseded_by uuid
);


--
-- Name: current_rate_price; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.current_rate_price WITH (security_invoker='true') AS
 SELECT DISTINCT ON (tenant_id, rate_plan_id, unit_type_id, stay_dates, dow_mask) id,
    tenant_id,
    rate_plan_id,
    unit_type_id,
    stay_dates,
    dow_mask,
    pricing,
    recorded_at,
    superseded_by
   FROM public.rate_price
  WHERE (superseded_by IS NULL)
  ORDER BY tenant_id, rate_plan_id, unit_type_id, stay_dates, dow_mask, recorded_at DESC;


--
-- Name: discrepancy; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.discrepancy (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    space_id uuid NOT NULL,
    reported text NOT NULL,
    system_state text NOT NULL,
    reported_by uuid,
    reported_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved_at timestamp with time zone,
    resolution text
);


--
-- Name: document; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    property_node uuid,
    kind text NOT NULL,
    series_id uuid,
    doc_no text,
    status text DEFAULT 'draft'::text NOT NULL,
    subject_type text,
    subject_id uuid,
    content jsonb NOT NULL,
    rendered_ref text,
    sha256 text,
    prev_hash text,
    issued_at timestamp with time zone,
    business_date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT document_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'issued'::text, 'cleared'::text, 'rejected'::text, 'void'::text])))
);


--
-- Name: document_series; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_series (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    property_node uuid NOT NULL,
    kind text NOT NULL,
    prefix text NOT NULL,
    next_no bigint DEFAULT 1 NOT NULL,
    fiscal boolean DEFAULT false NOT NULL,
    last_doc_hash text
);


--
-- Name: erasure_request; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.erasure_request (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    party_id uuid NOT NULL,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    resolved_at timestamp with time zone,
    note text,
    CONSTRAINT erasure_request_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'anonymised'::text, 'rejected'::text])))
);


--
-- Name: extension; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.extension (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    type text NOT NULL,
    key text NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    effective tstzrange DEFAULT tstzrange(now(), NULL::timestamp with time zone) NOT NULL,
    content jsonb NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT extension_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'retired'::text])))
);


--
-- Name: extension_type; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.extension_type (
    type text NOT NULL,
    json_schema jsonb NOT NULL
);


--
-- Name: fact_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fact_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    fact_type text NOT NULL,
    valid_from timestamp with time zone NOT NULL,
    valid_to timestamp with time zone,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    business_date date NOT NULL,
    actor_id uuid,
    payload jsonb NOT NULL,
    supersedes uuid
);


--
-- Name: fiscal_submission; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fiscal_submission (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    document_id uuid NOT NULL,
    provider_key text NOT NULL,
    mode text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    authority_ref text,
    qr_payload text,
    response jsonb,
    submitted_at timestamp with time zone,
    resolved_at timestamp with time zone,
    CONSTRAINT fiscal_submission_mode_check CHECK ((mode = ANY (ARRAY['clearance'::text, 'reporting'::text, 'peppol'::text, 'exchange'::text]))),
    CONSTRAINT fiscal_submission_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'submitted'::text, 'cleared'::text, 'accepted'::text, 'rejected'::text, 'error'::text])))
);


--
-- Name: folio; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.folio (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    account_id uuid NOT NULL,
    reservation_id uuid,
    folio_no text,
    window_no smallint DEFAULT 1 NOT NULL,
    name text,
    status text DEFAULT 'open'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT folio_status_check CHECK ((status = ANY (ARRAY['open'::text, 'settled'::text, 'closed'::text])))
);


--
-- Name: posting_line; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.posting_line (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    journal_id uuid NOT NULL,
    seq smallint NOT NULL,
    account_id uuid NOT NULL,
    folio_id uuid,
    tx_code text NOT NULL,
    description text,
    amount_minor bigint NOT NULL,
    quantity numeric(10,3) DEFAULT 1 NOT NULL,
    tax_detail jsonb,
    business_date date NOT NULL
);


--
-- Name: folio_balance; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.folio_balance WITH (security_invoker='true') AS
 SELECT tenant_id,
    folio_id,
    sum(amount_minor) AS balance_minor,
    count(*) AS lines
   FROM public.posting_line
  WHERE (folio_id IS NOT NULL)
  GROUP BY tenant_id, folio_id;


--
-- Name: hold; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hold (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    property_node uuid NOT NULL,
    sellable_unit_id uuid NOT NULL,
    period tstzrange NOT NULL,
    kind text NOT NULL,
    holder jsonb DEFAULT '{}'::jsonb NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    CONSTRAINT hold_kind_check CHECK ((kind = ANY (ARRAY['cart'::text, 'offline_lease'::text, 'manual'::text]))),
    CONSTRAINT hold_status_check CHECK ((status = ANY (ARRAY['active'::text, 'consumed'::text, 'expired'::text, 'released'::text])))
);


--
-- Name: identity_document; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.identity_document (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    party_id uuid NOT NULL,
    kind text NOT NULL,
    number_enc text NOT NULL,
    issuing_country character(2),
    expiry date,
    scan_ref text
);


--
-- Name: inbound_message; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inbound_message (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    channel_code text NOT NULL,
    external_id text NOT NULL,
    payload jsonb NOT NULL,
    received_at timestamp with time zone DEFAULT now() NOT NULL,
    status text DEFAULT 'received'::text NOT NULL,
    error text,
    processed_at timestamp with time zone,
    CONSTRAINT inbound_message_status_check CHECK ((status = ANY (ARRAY['received'::text, 'processed'::text, 'error'::text, 'ignored'::text])))
);


--
-- Name: inventory_authority; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_authority (
    tenant_id uuid NOT NULL,
    property_node uuid NOT NULL,
    channel_code text DEFAULT '*'::text NOT NULL,
    mode text NOT NULL,
    CONSTRAINT inventory_authority_mode_check CHECK ((mode = ANY (ARRAY['pms'::text, 'crs'::text])))
);


--
-- Name: journal; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.journal (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    property_node uuid NOT NULL,
    business_date date NOT NULL,
    kind text NOT NULL,
    description text NOT NULL,
    currency character(3) NOT NULL,
    reverses uuid,
    source jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT journal_kind_check CHECK ((kind = ANY (ARRAY['charge'::text, 'payment'::text, 'refund'::text, 'adjustment'::text, 'transfer'::text, 'correction'::text, 'deposit'::text, 'paidout'::text, 'close'::text, 'fx'::text])))
);


--
-- Name: membership; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.membership (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    party_id uuid NOT NULL,
    program text NOT NULL,
    number text NOT NULL,
    tier text,
    points bigint DEFAULT 0 NOT NULL
);


--
-- Name: message; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.message (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    thread_key text NOT NULL,
    direction text NOT NULL,
    channel text NOT NULL,
    party_id uuid,
    reservation_id uuid,
    body text NOT NULL,
    meta jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT message_direction_check CHECK ((direction = ANY (ARRAY['in'::text, 'out'::text])))
);


--
-- Name: negotiated_rate; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.negotiated_rate (
    tenant_id uuid NOT NULL,
    party_id uuid NOT NULL,
    rate_plan_id uuid NOT NULL,
    effective daterange NOT NULL
);


--
-- Name: ooo_oos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ooo_oos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    space_id uuid NOT NULL,
    kind text NOT NULL,
    period tstzrange NOT NULL,
    reason text,
    work_order_task uuid,
    CONSTRAINT ooo_oos_kind_check CHECK ((kind = ANY (ARRAY['ooo'::text, 'oos'::text])))
);


--
-- Name: org_node; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.org_node (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    path public.ltree NOT NULL,
    kind text NOT NULL,
    name text NOT NULL,
    timezone text,
    currency character(3),
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT org_node_kind_check CHECK ((kind = ANY (ARRAY['group'::text, 'brand'::text, 'region'::text, 'property'::text, 'outlet'::text]))),
    CONSTRAINT property_needs_tz CHECK (((kind <> 'property'::text) OR (timezone IS NOT NULL)))
);


--
-- Name: outbox; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.outbox (
    seq bigint NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    property_node uuid,
    business_date date NOT NULL,
    aggregate_type text NOT NULL,
    aggregate_id uuid NOT NULL,
    event_type text NOT NULL,
    event_version integer DEFAULT 1 NOT NULL,
    actor_id uuid,
    correlation_id uuid NOT NULL,
    causation_id uuid,
    payload jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    published_at timestamp with time zone
)
WITH (autovacuum_vacuum_scale_factor='0.01', autovacuum_vacuum_cost_delay='0');


--
-- Name: outbox_seq_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.outbox ALTER COLUMN seq ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.outbox_seq_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: overbooking_limit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.overbooking_limit (
    tenant_id uuid NOT NULL,
    property_node uuid NOT NULL,
    unit_type_id uuid NOT NULL,
    stay_dates daterange NOT NULL,
    extra integer NOT NULL
);


--
-- Name: package; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.package (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL
);


--
-- Name: package_element; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.package_element (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    package_id uuid NOT NULL,
    tx_code text NOT NULL,
    rhythm text NOT NULL,
    amount_minor bigint NOT NULL,
    currency character(3) NOT NULL,
    allowance boolean DEFAULT false NOT NULL,
    CONSTRAINT package_element_rhythm_check CHECK ((rhythm = ANY (ARRAY['per_stay'::text, 'per_night'::text, 'per_person'::text, 'per_person_night'::text])))
);


--
-- Name: party; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.party (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    kind text NOT NULL,
    display_name text NOT NULL,
    legal_name text,
    attrs jsonb DEFAULT '{}'::jsonb NOT NULL,
    vip_code text,
    status text DEFAULT 'active'::text NOT NULL,
    merged_into uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT party_kind_check CHECK ((kind = ANY (ARRAY['person'::text, 'org'::text]))),
    CONSTRAINT party_status_check CHECK ((status = ANY (ARRAY['active'::text, 'merged'::text, 'anonymised'::text])))
);


--
-- Name: party_relationship; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.party_relationship (
    tenant_id uuid NOT NULL,
    from_party uuid NOT NULL,
    to_party uuid NOT NULL,
    kind text NOT NULL
);


--
-- Name: party_role; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.party_role (
    tenant_id uuid NOT NULL,
    party_id uuid NOT NULL,
    role text NOT NULL,
    detail jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT party_role_role_check CHECK ((role = ANY (ARRAY['guest'::text, 'company'::text, 'agent'::text, 'source'::text, 'vendor'::text, 'owner'::text, 'staff'::text, 'contact'::text])))
);


--
-- Name: payment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    journal_id uuid,
    instrument_id uuid,
    psp text,
    psp_ref text,
    method text NOT NULL,
    phase text NOT NULL,
    amount_minor bigint NOT NULL,
    currency character(3) NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT payment_phase_check CHECK ((phase = ANY (ARRAY['auth'::text, 'capture'::text, 'refund'::text, 'void'::text, 'incremental_auth'::text]))),
    CONSTRAINT payment_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'succeeded'::text, 'failed'::text])))
);


--
-- Name: payment_instrument; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_instrument (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    party_id uuid,
    kind text NOT NULL,
    token text,
    brand text,
    last4 character(4),
    expiry text,
    psp text,
    status text DEFAULT 'active'::text NOT NULL,
    CONSTRAINT payment_instrument_kind_check CHECK ((kind = ANY (ARRAY['card_network_token'::text, 'upi_vpa'::text, 'bank'::text, 'cash_marker'::text])))
);


--
-- Name: permission; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permission (
    code text NOT NULL,
    description text NOT NULL
);


--
-- Name: policy; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.policy (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    kind text NOT NULL,
    name text NOT NULL,
    content jsonb NOT NULL,
    CONSTRAINT policy_kind_check CHECK ((kind = ANY (ARRAY['cancellation'::text, 'guarantee'::text, 'deposit'::text, 'no_show'::text, 'early_departure'::text])))
);


--
-- Name: preference; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.preference (
    tenant_id uuid NOT NULL,
    party_id uuid NOT NULL,
    key text NOT NULL,
    value jsonb NOT NULL
);


--
-- Name: promotion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promotion (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    code text NOT NULL,
    discount jsonb NOT NULL,
    book_window tstzrange,
    stay_dates daterange,
    constraints jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: push_cursor; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.push_cursor (
    tenant_id uuid NOT NULL,
    property_node uuid NOT NULL,
    channel_code text NOT NULL,
    last_outbox_seq bigint DEFAULT 0 NOT NULL
);


--
-- Name: queue_entry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.queue_entry (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    segment_id uuid NOT NULL,
    queued_at timestamp with time zone DEFAULT now() NOT NULL,
    priority integer DEFAULT 100 NOT NULL,
    cleared_at timestamp with time zone
);


--
-- Name: rate_plan; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rate_plan (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    property_node uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    currency character(3) NOT NULL,
    tax_inclusive boolean DEFAULT true NOT NULL,
    cancellation_policy uuid,
    guarantee_policy uuid,
    deposit_policy uuid,
    parent_plan uuid,
    derivation jsonb,
    market_code text,
    source_code text,
    status text DEFAULT 'active'::text NOT NULL
);


--
-- Name: rate_plan_package; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rate_plan_package (
    rate_plan_id uuid NOT NULL,
    package_id uuid NOT NULL,
    included_in_rate boolean DEFAULT true NOT NULL
);


--
-- Name: reservation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reservation (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    property_node uuid NOT NULL,
    confirmation_no text NOT NULL,
    status text DEFAULT 'reserved'::text NOT NULL,
    primary_party uuid NOT NULL,
    booker_party uuid,
    group_id uuid,
    channel_code text DEFAULT 'direct'::text NOT NULL,
    market_code text,
    source_code text,
    origin_code text,
    currency character(3) NOT NULL,
    guarantee_policy uuid,
    eta time with time zone,
    etd time with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    cancelled_at timestamp with time zone,
    cancel_reason text,
    cancellation_no text,
    CONSTRAINT reservation_status_check CHECK ((status = ANY (ARRAY['quote'::text, 'reserved'::text, 'waitlist'::text, 'due_in'::text, 'in_house'::text, 'due_out'::text, 'checked_out'::text, 'cancelled'::text, 'no_show'::text])))
);


--
-- Name: reservation_group; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reservation_group (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    property_node uuid NOT NULL,
    kind text NOT NULL,
    code text NOT NULL,
    name text,
    account_party uuid,
    status text DEFAULT 'tentative'::text NOT NULL,
    cutoff_date date,
    elastic boolean DEFAULT false NOT NULL,
    wash_schedule jsonb,
    master_folio uuid,
    CONSTRAINT reservation_group_kind_check CHECK ((kind = ANY (ARRAY['linked'::text, 'block'::text, 'share'::text])))
);


--
-- Name: reservation_guest; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reservation_guest (
    tenant_id uuid NOT NULL,
    reservation_id uuid NOT NULL,
    party_id uuid NOT NULL,
    role text DEFAULT 'accompanying'::text NOT NULL,
    share_pct numeric(5,2),
    CONSTRAINT reservation_guest_role_check CHECK ((role = ANY (ARRAY['primary'::text, 'accompanying'::text, 'sharer'::text])))
);


--
-- Name: reservation_segment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reservation_segment (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    reservation_id uuid NOT NULL,
    seq smallint NOT NULL,
    unit_type_id uuid NOT NULL,
    sellable_unit_id uuid,
    period tstzrange NOT NULL,
    adults smallint DEFAULT 1 NOT NULL,
    children jsonb DEFAULT '[]'::jsonb NOT NULL,
    rate_plan_id uuid NOT NULL,
    price_override jsonb,
    status text DEFAULT 'booked'::text NOT NULL,
    CONSTRAINT reservation_segment_status_check CHECK ((status = ANY (ARRAY['booked'::text, 'in_house'::text, 'departed'::text, 'cancelled'::text])))
);


--
-- Name: restriction; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.restriction (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    scope_node uuid NOT NULL,
    unit_type_id uuid,
    rate_plan_id uuid,
    channel_code text,
    kind text NOT NULL,
    value integer,
    stay_dates daterange NOT NULL,
    source text DEFAULT 'manual'::text NOT NULL,
    CONSTRAINT restriction_kind_check CHECK ((kind = ANY (ARRAY['closed'::text, 'cta'::text, 'ctd'::text, 'min_los'::text, 'max_los'::text, 'min_adv'::text, 'max_adv'::text])))
);


--
-- Name: role; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL
);


--
-- Name: role_permission; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_permission (
    role_id uuid NOT NULL,
    permission_code text NOT NULL
);


--
-- Name: schema_migration; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migration (
    version bigint NOT NULL,
    filename text NOT NULL,
    checksum_sha256 character(64) NOT NULL,
    applied_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    CONSTRAINT schema_migration_checksum_sha256_check CHECK ((checksum_sha256 ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT schema_migration_version_check CHECK (((version >= 1) AND (version <= 9999)))
);


--
-- Name: sellable_unit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sellable_unit (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    unit_type_id uuid NOT NULL,
    name text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL
);


--
-- Name: sellable_unit_space; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sellable_unit_space (
    tenant_id uuid NOT NULL,
    sellable_unit_id uuid NOT NULL,
    space_id uuid NOT NULL,
    claim_mode text NOT NULL,
    CONSTRAINT sellable_unit_space_claim_mode_check CHECK ((claim_mode = ANY (ARRAY['exclusive'::text, 'positional'::text])))
);


--
-- Name: space; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.space (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    property_node uuid NOT NULL,
    code text NOT NULL,
    profile_key text NOT NULL,
    capacity smallint DEFAULT 1 NOT NULL,
    max_occupancy smallint,
    floor text,
    area_sqm numeric(8,2),
    gender_policy text,
    length_cm integer,
    beam_cm integer,
    draft_cm integer,
    power_amps integer,
    attrs jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    CONSTRAINT space_gender_policy_check CHECK ((gender_policy = ANY (ARRAY['any'::text, 'female'::text, 'male'::text])))
);


--
-- Name: space_occupancy; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.space_occupancy (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    space_id uuid NOT NULL,
    period tstzrange NOT NULL,
    slot_ref uuid NOT NULL,
    slot_kind text NOT NULL,
    exclusive boolean NOT NULL,
    claim int4range NOT NULL,
    CONSTRAINT claim_shape CHECK (((exclusive AND (claim = int4range(0, NULL::integer))) OR ((NOT exclusive) AND (lower(claim) >= 0) AND (upper(claim) = (lower(claim) + 1))))),
    CONSTRAINT space_occupancy_slot_kind_check CHECK ((slot_kind = ANY (ARRAY['segment'::text, 'hold'::text, 'ooo'::text])))
);


--
-- Name: space_relation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.space_relation (
    tenant_id uuid NOT NULL,
    parent_space uuid NOT NULL,
    child_space uuid NOT NULL,
    kind text NOT NULL,
    CONSTRAINT space_relation_kind_check CHECK ((kind = ANY (ARRAY['contains'::text, 'connects'::text])))
);


--
-- Name: stats_daily; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stats_daily (
    tenant_id uuid NOT NULL,
    property_node uuid NOT NULL,
    business_date date NOT NULL,
    unit_type_id uuid NOT NULL,
    market_code text NOT NULL,
    source_code text NOT NULL,
    channel_code text NOT NULL,
    rooms_available integer DEFAULT 0 NOT NULL,
    rooms_sold integer DEFAULT 0 NOT NULL,
    arrivals integer DEFAULT 0 NOT NULL,
    departures integer DEFAULT 0 NOT NULL,
    no_shows integer DEFAULT 0 NOT NULL,
    room_revenue_minor bigint DEFAULT 0 NOT NULL,
    fnb_revenue_minor bigint DEFAULT 0 NOT NULL,
    other_revenue_minor bigint DEFAULT 0 NOT NULL
);


--
-- Name: statutory_submission; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.statutory_submission (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    property_node uuid NOT NULL,
    reservation_id uuid NOT NULL,
    adapter_key text NOT NULL,
    due_at timestamp with time zone NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    payload jsonb,
    receipt jsonb,
    submitted_at timestamp with time zone,
    CONSTRAINT statutory_submission_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'submitted'::text, 'accepted'::text, 'failed'::text, 'not_required'::text])))
);


--
-- Name: task; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    property_node uuid NOT NULL,
    kind text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    subject_type text,
    subject_id uuid,
    assignee_party uuid,
    department text,
    due_at timestamp with time zone,
    priority smallint DEFAULT 3 NOT NULL,
    credits smallint,
    sheet_id uuid,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    CONSTRAINT task_status_check CHECK ((status = ANY (ARRAY['open'::text, 'assigned'::text, 'in_progress'::text, 'done'::text, 'verified'::text, 'cancelled'::text])))
);


--
-- Name: task_sheet; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_sheet (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    property_node uuid NOT NULL,
    sheet_date date NOT NULL,
    attendant_party uuid,
    target_credits smallint
);


--
-- Name: tax_assignment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tax_assignment (
    tenant_id uuid NOT NULL,
    property_node uuid NOT NULL,
    jurisdiction_key text NOT NULL,
    effective daterange NOT NULL
);


--
-- Name: tenant; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    tier text DEFAULT 'shared'::text NOT NULL,
    residency text DEFAULT 'me-central'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tenant_tier_check CHECK ((tier = ANY (ARRAY['shared'::text, 'dedicated'::text])))
);


--
-- Name: travel_detail; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.travel_detail (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    reservation_id uuid NOT NULL,
    direction text NOT NULL,
    mode text,
    carrier text,
    service_no text,
    scheduled_at timestamp with time zone,
    pickup_requested boolean DEFAULT false NOT NULL,
    pickup_task_id uuid,
    notes text,
    CONSTRAINT travel_detail_direction_check CHECK ((direction = ANY (ARRAY['arrival'::text, 'departure'::text]))),
    CONSTRAINT travel_detail_mode_check CHECK ((mode = ANY (ARRAY['flight'::text, 'train'::text, 'bus'::text, 'car'::text, 'ferry'::text, 'other'::text])))
);


--
-- Name: tx_code; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tx_code (
    code text NOT NULL,
    name text NOT NULL,
    grp text NOT NULL,
    usali_line text,
    default_dr text,
    default_cr text,
    CONSTRAINT tx_code_grp_check CHECK ((grp = ANY (ARRAY['revenue'::text, 'payment'::text, 'tax'::text, 'adjustment'::text, 'transfer'::text, 'deposit'::text, 'paidout'::text])))
);


--
-- Name: unit_condition; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unit_condition (
    tenant_id uuid NOT NULL,
    space_id uuid NOT NULL,
    condition text DEFAULT 'clean'::text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    CONSTRAINT unit_condition_condition_check CHECK ((condition = ANY (ARRAY['clean'::text, 'dirty'::text, 'pickup'::text, 'inspected'::text])))
);


--
-- Name: unit_type; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unit_type (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    property_node uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    profile_key text NOT NULL,
    base_occupancy smallint DEFAULT 2 NOT NULL,
    max_occupancy smallint DEFAULT 2 NOT NULL,
    attrs jsonb DEFAULT '{}'::jsonb NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL
);


--
-- Name: user_role; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_role (
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role_id uuid NOT NULL,
    scope_node uuid NOT NULL
);


--
-- Name: vehicle; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vehicle (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    property_node uuid NOT NULL,
    reservation_id uuid,
    party_id uuid,
    reg_no text NOT NULL,
    make text,
    model text,
    colour text,
    driver_name text,
    parking_space uuid,
    entered_at timestamp with time zone,
    exited_at timestamp with time zone,
    notes text
);


--
-- Name: waitlist_entry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.waitlist_entry (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    property_node uuid NOT NULL,
    unit_type_id uuid,
    stay_dates daterange NOT NULL,
    party_id uuid,
    priority integer DEFAULT 100 NOT NULL,
    status text DEFAULT 'open'::text NOT NULL
);


--
-- Name: account account_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT account_pkey PRIMARY KEY (id);


--
-- Name: account account_tenant_id_id_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT account_tenant_id_id_uq UNIQUE (tenant_id, id);


--
-- Name: address address_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.address
    ADD CONSTRAINT address_pkey PRIMARY KEY (id);


--
-- Name: alert alert_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert
    ADD CONSTRAINT alert_pkey PRIMARY KEY (id);


--
-- Name: api_client api_client_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_client
    ADD CONSTRAINT api_client_pkey PRIMARY KEY (id);


--
-- Name: api_idempotency api_idempotency_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_idempotency
    ADD CONSTRAINT api_idempotency_pkey PRIMARY KEY (tenant_id, operation, key_hash);


--
-- Name: app_user app_user_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_user
    ADD CONSTRAINT app_user_pkey PRIMARY KEY (id);


--
-- Name: app_user app_user_tenant_id_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_user
    ADD CONSTRAINT app_user_tenant_id_email_key UNIQUE (tenant_id, email);


--
-- Name: approval_request approval_request_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_request
    ADD CONSTRAINT approval_request_pkey PRIMARY KEY (id);


--
-- Name: ar_allocation ar_allocation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ar_allocation
    ADD CONSTRAINT ar_allocation_pkey PRIMARY KEY (invoice_doc, payment_journal);


--
-- Name: automation automation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation
    ADD CONSTRAINT automation_pkey PRIMARY KEY (id);


--
-- Name: availability_projection availability_projection_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.availability_projection
    ADD CONSTRAINT availability_projection_pkey PRIMARY KEY (property_node, unit_type_id, stay_date);


--
-- Name: block_allotment block_allotment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.block_allotment
    ADD CONSTRAINT block_allotment_pkey PRIMARY KEY (group_id, unit_type_id, stay_date);


--
-- Name: block_status_def block_status_def_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.block_status_def
    ADD CONSTRAINT block_status_def_pkey PRIMARY KEY (tenant_id, code);


--
-- Name: business_day business_day_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_day
    ADD CONSTRAINT business_day_pkey PRIMARY KEY (property_node, business_date);


--
-- Name: cashier_session cashier_session_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cashier_session
    ADD CONSTRAINT cashier_session_pkey PRIMARY KEY (id);


--
-- Name: channel_map channel_map_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_map
    ADD CONSTRAINT channel_map_pkey PRIMARY KEY (property_node, channel_code, kind, internal_id);


--
-- Name: channel channel_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel
    ADD CONSTRAINT channel_pkey PRIMARY KEY (code);


--
-- Name: consent consent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent
    ADD CONSTRAINT consent_pkey PRIMARY KEY (party_id, purpose);


--
-- Name: consumer_cursor consumer_cursor_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consumer_cursor
    ADD CONSTRAINT consumer_cursor_pkey PRIMARY KEY (consumer);


--
-- Name: consumer_processed consumer_processed_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consumer_processed
    ADD CONSTRAINT consumer_processed_pkey PRIMARY KEY (consumer, outbox_id);


--
-- Name: contact_point contact_point_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_point
    ADD CONSTRAINT contact_point_pkey PRIMARY KEY (id);


--
-- Name: discrepancy discrepancy_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discrepancy
    ADD CONSTRAINT discrepancy_pkey PRIMARY KEY (id);


--
-- Name: document document_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document
    ADD CONSTRAINT document_pkey PRIMARY KEY (id);


--
-- Name: document_series document_series_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_series
    ADD CONSTRAINT document_series_pkey PRIMARY KEY (id);


--
-- Name: document_series document_series_tenant_id_property_node_kind_prefix_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_series
    ADD CONSTRAINT document_series_tenant_id_property_node_kind_prefix_key UNIQUE (tenant_id, property_node, kind, prefix);


--
-- Name: erasure_request erasure_request_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.erasure_request
    ADD CONSTRAINT erasure_request_pkey PRIMARY KEY (id);


--
-- Name: extension extension_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.extension
    ADD CONSTRAINT extension_pkey PRIMARY KEY (id);


--
-- Name: extension extension_tenant_id_type_key_version_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.extension
    ADD CONSTRAINT extension_tenant_id_type_key_version_key UNIQUE (tenant_id, type, key, version);


--
-- Name: extension_type extension_type_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.extension_type
    ADD CONSTRAINT extension_type_pkey PRIMARY KEY (type);


--
-- Name: fact_log fact_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fact_log
    ADD CONSTRAINT fact_log_pkey PRIMARY KEY (id);


--
-- Name: fiscal_submission fiscal_submission_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fiscal_submission
    ADD CONSTRAINT fiscal_submission_pkey PRIMARY KEY (id);


--
-- Name: folio folio_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.folio
    ADD CONSTRAINT folio_pkey PRIMARY KEY (id);


--
-- Name: folio folio_reservation_window_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.folio
    ADD CONSTRAINT folio_reservation_window_uq UNIQUE (tenant_id, reservation_id, window_no);


--
-- Name: hold hold_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hold
    ADD CONSTRAINT hold_pkey PRIMARY KEY (id);


--
-- Name: identity_document identity_document_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.identity_document
    ADD CONSTRAINT identity_document_pkey PRIMARY KEY (id);


--
-- Name: inbound_message inbound_message_channel_code_external_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inbound_message
    ADD CONSTRAINT inbound_message_channel_code_external_id_key UNIQUE (channel_code, external_id);


--
-- Name: inbound_message inbound_message_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inbound_message
    ADD CONSTRAINT inbound_message_pkey PRIMARY KEY (id);


--
-- Name: inventory_authority inventory_authority_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_authority
    ADD CONSTRAINT inventory_authority_pkey PRIMARY KEY (property_node, channel_code);


--
-- Name: journal journal_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal
    ADD CONSTRAINT journal_pkey PRIMARY KEY (id);


--
-- Name: membership membership_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.membership
    ADD CONSTRAINT membership_pkey PRIMARY KEY (id);


--
-- Name: membership membership_tenant_id_program_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.membership
    ADD CONSTRAINT membership_tenant_id_program_number_key UNIQUE (tenant_id, program, number);


--
-- Name: message message_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message
    ADD CONSTRAINT message_pkey PRIMARY KEY (id);


--
-- Name: negotiated_rate negotiated_rate_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.negotiated_rate
    ADD CONSTRAINT negotiated_rate_pkey PRIMARY KEY (party_id, rate_plan_id);


--
-- Name: space_occupancy no_conflicting_claims; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.space_occupancy
    ADD CONSTRAINT no_conflicting_claims EXCLUDE USING gist (tenant_id WITH =, space_id WITH =, period WITH &&, claim WITH &&);


--
-- Name: ooo_oos ooo_oos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ooo_oos
    ADD CONSTRAINT ooo_oos_pkey PRIMARY KEY (id);


--
-- Name: org_node org_node_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_node
    ADD CONSTRAINT org_node_pkey PRIMARY KEY (id);


--
-- Name: org_node org_node_tenant_id_id_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_node
    ADD CONSTRAINT org_node_tenant_id_id_uq UNIQUE (tenant_id, id);


--
-- Name: org_node org_node_tenant_id_path_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_node
    ADD CONSTRAINT org_node_tenant_id_path_key UNIQUE (tenant_id, path);


--
-- Name: outbox outbox_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outbox
    ADD CONSTRAINT outbox_pkey PRIMARY KEY (seq);


--
-- Name: overbooking_limit overbooking_limit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.overbooking_limit
    ADD CONSTRAINT overbooking_limit_pkey PRIMARY KEY (property_node, unit_type_id, stay_dates);


--
-- Name: package_element package_element_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.package_element
    ADD CONSTRAINT package_element_pkey PRIMARY KEY (id);


--
-- Name: package package_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.package
    ADD CONSTRAINT package_pkey PRIMARY KEY (id);


--
-- Name: package package_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.package
    ADD CONSTRAINT package_tenant_id_code_key UNIQUE (tenant_id, code);


--
-- Name: party party_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.party
    ADD CONSTRAINT party_pkey PRIMARY KEY (id);


--
-- Name: party_relationship party_relationship_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.party_relationship
    ADD CONSTRAINT party_relationship_pkey PRIMARY KEY (from_party, to_party, kind);


--
-- Name: party_role party_role_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.party_role
    ADD CONSTRAINT party_role_pkey PRIMARY KEY (party_id, role);


--
-- Name: party party_tenant_id_id_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.party
    ADD CONSTRAINT party_tenant_id_id_uq UNIQUE (tenant_id, id);


--
-- Name: payment_instrument payment_instrument_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_instrument
    ADD CONSTRAINT payment_instrument_pkey PRIMARY KEY (id);


--
-- Name: payment payment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment
    ADD CONSTRAINT payment_pkey PRIMARY KEY (id);


--
-- Name: permission permission_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permission
    ADD CONSTRAINT permission_pkey PRIMARY KEY (code);


--
-- Name: policy policy_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy
    ADD CONSTRAINT policy_pkey PRIMARY KEY (id);


--
-- Name: posting_line posting_line_journal_id_seq_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posting_line
    ADD CONSTRAINT posting_line_journal_id_seq_key UNIQUE (journal_id, seq);


--
-- Name: posting_line posting_line_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posting_line
    ADD CONSTRAINT posting_line_pkey PRIMARY KEY (id);


--
-- Name: preference preference_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.preference
    ADD CONSTRAINT preference_pkey PRIMARY KEY (party_id, key);


--
-- Name: promotion promotion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion
    ADD CONSTRAINT promotion_pkey PRIMARY KEY (id);


--
-- Name: promotion promotion_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion
    ADD CONSTRAINT promotion_tenant_id_code_key UNIQUE (tenant_id, code);


--
-- Name: push_cursor push_cursor_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_cursor
    ADD CONSTRAINT push_cursor_pkey PRIMARY KEY (property_node, channel_code);


--
-- Name: queue_entry queue_entry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.queue_entry
    ADD CONSTRAINT queue_entry_pkey PRIMARY KEY (id);


--
-- Name: rate_plan_package rate_plan_package_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_plan_package
    ADD CONSTRAINT rate_plan_package_pkey PRIMARY KEY (rate_plan_id, package_id);


--
-- Name: rate_plan rate_plan_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_plan
    ADD CONSTRAINT rate_plan_pkey PRIMARY KEY (id);


--
-- Name: rate_plan rate_plan_tenant_id_property_node_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_plan
    ADD CONSTRAINT rate_plan_tenant_id_property_node_code_key UNIQUE (tenant_id, property_node, code);


--
-- Name: rate_price rate_price_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_price
    ADD CONSTRAINT rate_price_pkey PRIMARY KEY (id);


--
-- Name: reservation_group reservation_group_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation_group
    ADD CONSTRAINT reservation_group_pkey PRIMARY KEY (id);


--
-- Name: reservation_group reservation_group_tenant_id_property_node_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation_group
    ADD CONSTRAINT reservation_group_tenant_id_property_node_code_key UNIQUE (tenant_id, property_node, code);


--
-- Name: reservation_guest reservation_guest_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation_guest
    ADD CONSTRAINT reservation_guest_pkey PRIMARY KEY (reservation_id, party_id);


--
-- Name: reservation reservation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation
    ADD CONSTRAINT reservation_pkey PRIMARY KEY (id);


--
-- Name: reservation_segment reservation_segment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation_segment
    ADD CONSTRAINT reservation_segment_pkey PRIMARY KEY (id);


--
-- Name: reservation_segment reservation_segment_reservation_id_seq_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation_segment
    ADD CONSTRAINT reservation_segment_reservation_id_seq_key UNIQUE (reservation_id, seq);


--
-- Name: reservation reservation_tenant_id_confirmation_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation
    ADD CONSTRAINT reservation_tenant_id_confirmation_no_key UNIQUE (tenant_id, confirmation_no);


--
-- Name: reservation reservation_tenant_id_id_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation
    ADD CONSTRAINT reservation_tenant_id_id_uq UNIQUE (tenant_id, id);


--
-- Name: restriction restriction_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restriction
    ADD CONSTRAINT restriction_pkey PRIMARY KEY (id);


--
-- Name: role_permission role_permission_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permission
    ADD CONSTRAINT role_permission_pkey PRIMARY KEY (role_id, permission_code);


--
-- Name: role role_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role
    ADD CONSTRAINT role_pkey PRIMARY KEY (id);


--
-- Name: role role_tenant_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role
    ADD CONSTRAINT role_tenant_id_name_key UNIQUE (tenant_id, name);


--
-- Name: schema_migration schema_migration_filename_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migration
    ADD CONSTRAINT schema_migration_filename_key UNIQUE (filename);


--
-- Name: schema_migration schema_migration_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migration
    ADD CONSTRAINT schema_migration_pkey PRIMARY KEY (version);


--
-- Name: sellable_unit sellable_unit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sellable_unit
    ADD CONSTRAINT sellable_unit_pkey PRIMARY KEY (id);


--
-- Name: sellable_unit_space sellable_unit_space_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sellable_unit_space
    ADD CONSTRAINT sellable_unit_space_pkey PRIMARY KEY (sellable_unit_id, space_id);


--
-- Name: space_occupancy space_occupancy_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.space_occupancy
    ADD CONSTRAINT space_occupancy_pkey PRIMARY KEY (id);


--
-- Name: space space_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.space
    ADD CONSTRAINT space_pkey PRIMARY KEY (id);


--
-- Name: space_relation space_relation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.space_relation
    ADD CONSTRAINT space_relation_pkey PRIMARY KEY (parent_space, child_space, kind);


--
-- Name: space space_tenant_id_property_node_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.space
    ADD CONSTRAINT space_tenant_id_property_node_code_key UNIQUE (tenant_id, property_node, code);


--
-- Name: stats_daily stats_daily_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stats_daily
    ADD CONSTRAINT stats_daily_pkey PRIMARY KEY (property_node, business_date, unit_type_id, market_code, source_code, channel_code);


--
-- Name: statutory_submission statutory_submission_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.statutory_submission
    ADD CONSTRAINT statutory_submission_pkey PRIMARY KEY (id);


--
-- Name: task task_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task
    ADD CONSTRAINT task_pkey PRIMARY KEY (id);


--
-- Name: task_sheet task_sheet_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_sheet
    ADD CONSTRAINT task_sheet_pkey PRIMARY KEY (id);


--
-- Name: tax_assignment tax_assignment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_assignment
    ADD CONSTRAINT tax_assignment_pkey PRIMARY KEY (property_node, effective);


--
-- Name: tenant tenant_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant
    ADD CONSTRAINT tenant_pkey PRIMARY KEY (id);


--
-- Name: tenant tenant_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant
    ADD CONSTRAINT tenant_slug_key UNIQUE (slug);


--
-- Name: travel_detail travel_detail_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.travel_detail
    ADD CONSTRAINT travel_detail_pkey PRIMARY KEY (id);


--
-- Name: travel_detail travel_detail_tenant_id_reservation_id_direction_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.travel_detail
    ADD CONSTRAINT travel_detail_tenant_id_reservation_id_direction_key UNIQUE (tenant_id, reservation_id, direction);


--
-- Name: tx_code tx_code_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tx_code
    ADD CONSTRAINT tx_code_pkey PRIMARY KEY (code);


--
-- Name: unit_condition unit_condition_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_condition
    ADD CONSTRAINT unit_condition_pkey PRIMARY KEY (space_id);


--
-- Name: unit_type unit_type_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_type
    ADD CONSTRAINT unit_type_pkey PRIMARY KEY (id);


--
-- Name: unit_type unit_type_tenant_id_property_node_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_type
    ADD CONSTRAINT unit_type_tenant_id_property_node_code_key UNIQUE (tenant_id, property_node, code);


--
-- Name: user_role user_role_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_role
    ADD CONSTRAINT user_role_pkey PRIMARY KEY (user_id, role_id, scope_node);


--
-- Name: vehicle vehicle_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicle
    ADD CONSTRAINT vehicle_pkey PRIMARY KEY (id);


--
-- Name: waitlist_entry waitlist_entry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waitlist_entry
    ADD CONSTRAINT waitlist_entry_pkey PRIMARY KEY (id);


--
-- Name: account_party; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX account_party ON public.account USING btree (tenant_id, party_id) WHERE (party_id IS NOT NULL);


--
-- Name: api_idempotency_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX api_idempotency_expiry ON public.api_idempotency USING btree (expires_at);


--
-- Name: approval_request_rate_release_plan_cursor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX approval_request_rate_release_plan_cursor ON public.approval_request USING btree (tenant_id, ((payload ->> 'rate_plan_id'::text)), created_at DESC, id DESC) WHERE ((kind = 'rate_plan_release'::text) AND (subject_type = 'extension'::text));


--
-- Name: consumer_processed_age; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX consumer_processed_age ON public.consumer_processed USING brin (processed_at);


--
-- Name: contact_point_tenant_kind_value; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX contact_point_tenant_kind_value ON public.contact_point USING btree (tenant_id, kind, value, party_id);


--
-- Name: document_subject; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_subject ON public.document USING btree (tenant_id, subject_type, subject_id);


--
-- Name: fact_bdate; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fact_bdate ON public.fact_log USING brin (business_date);


--
-- Name: fact_current; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fact_current ON public.fact_log USING btree (tenant_id, entity_type, entity_id, fact_type, recorded_at DESC);


--
-- Name: folio_no_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX folio_no_uq ON public.folio USING btree (tenant_id, folio_no) WHERE (folio_no IS NOT NULL);


--
-- Name: hold_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hold_expiry ON public.hold USING btree (expires_at) WHERE (status = 'active'::text);


--
-- Name: journal_bdate; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX journal_bdate ON public.journal USING btree (tenant_id, property_node, business_date);


--
-- Name: message_thread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX message_thread ON public.message USING btree (tenant_id, thread_key, created_at);


--
-- Name: org_node_path_gist; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX org_node_path_gist ON public.org_node USING gist (tenant_id, path);


--
-- Name: outbox_unpublished; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX outbox_unpublished ON public.outbox USING btree (seq) WHERE (published_at IS NULL);


--
-- Name: party_name_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX party_name_trgm ON public.party USING gin (display_name public.gin_trgm_ops);


--
-- Name: party_tenant_status_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX party_tenant_status_id ON public.party USING btree (tenant_id, status, id);


--
-- Name: posting_acct; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX posting_acct ON public.posting_line USING btree (tenant_id, account_id, business_date);


--
-- Name: posting_folio; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX posting_folio ON public.posting_line USING btree (tenant_id, folio_id) WHERE (folio_id IS NOT NULL);


--
-- Name: rate_current_contain; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rate_current_contain ON public.rate_price USING gist (tenant_id, rate_plan_id, unit_type_id, stay_dates) WHERE (superseded_by IS NULL);


--
-- Name: rate_current_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rate_current_lookup ON public.rate_price USING btree (tenant_id, rate_plan_id, unit_type_id, recorded_at DESC) WHERE (superseded_by IS NULL);


--
-- Name: rate_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rate_lookup ON public.rate_price USING btree (tenant_id, rate_plan_id, unit_type_id, recorded_at DESC);


--
-- Name: reservation_board; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reservation_board ON public.reservation USING btree (tenant_id, property_node, status);


--
-- Name: segment_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX segment_period ON public.reservation_segment USING gist (tenant_id, period);


--
-- Name: so_slot; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX so_slot ON public.space_occupancy USING btree (tenant_id, slot_ref);


--
-- Name: so_space_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX so_space_period ON public.space_occupancy USING gist (tenant_id, space_id, period);


--
-- Name: space_attrs_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX space_attrs_gin ON public.space USING gin (attrs jsonb_path_ops);


--
-- Name: task_board; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX task_board ON public.task USING btree (tenant_id, property_node, kind, status, due_at);


--
-- Name: travel_pickup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX travel_pickup ON public.travel_detail USING btree (tenant_id, scheduled_at) WHERE (pickup_requested AND (pickup_task_id IS NULL));


--
-- Name: vehicle_onsite; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vehicle_onsite ON public.vehicle USING btree (tenant_id, property_node) WHERE (exited_at IS NULL);


--
-- Name: vehicle_reg; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vehicle_reg ON public.vehicle USING btree (tenant_id, property_node, reg_no);


--
-- Name: posting_line journal_balanced; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER journal_balanced AFTER INSERT ON public.posting_line DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.assert_journal_balanced();


--
-- Name: journal journal_day_open; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER journal_day_open BEFORE INSERT ON public.journal FOR EACH ROW EXECUTE FUNCTION public.assert_day_open();


--
-- Name: account account_party_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT account_party_id_fkey FOREIGN KEY (party_id) REFERENCES public.party(id);


--
-- Name: account account_property_node_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT account_property_node_fkey FOREIGN KEY (property_node) REFERENCES public.org_node(id);


--
-- Name: account account_tenant_party_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT account_tenant_party_fk FOREIGN KEY (tenant_id, party_id) REFERENCES public.party(tenant_id, id);


--
-- Name: account account_tenant_property_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT account_tenant_property_fk FOREIGN KEY (tenant_id, property_node) REFERENCES public.org_node(tenant_id, id);


--
-- Name: address address_party_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.address
    ADD CONSTRAINT address_party_id_fkey FOREIGN KEY (party_id) REFERENCES public.party(id);


--
-- Name: api_client api_client_scope_node_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_client
    ADD CONSTRAINT api_client_scope_node_fkey FOREIGN KEY (scope_node) REFERENCES public.org_node(id);


--
-- Name: api_client api_client_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_client
    ADD CONSTRAINT api_client_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id);


--
-- Name: api_idempotency api_idempotency_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_idempotency
    ADD CONSTRAINT api_idempotency_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id);


--
-- Name: app_user app_user_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_user
    ADD CONSTRAINT app_user_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id);


--
-- Name: approval_request approval_request_decided_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_request
    ADD CONSTRAINT approval_request_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES public.app_user(id);


--
-- Name: approval_request approval_request_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_request
    ADD CONSTRAINT approval_request_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.app_user(id);


--
-- Name: ar_allocation ar_allocation_invoice_doc_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ar_allocation
    ADD CONSTRAINT ar_allocation_invoice_doc_fkey FOREIGN KEY (invoice_doc) REFERENCES public.document(id);


--
-- Name: ar_allocation ar_allocation_payment_journal_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ar_allocation
    ADD CONSTRAINT ar_allocation_payment_journal_fkey FOREIGN KEY (payment_journal) REFERENCES public.journal(id);


--
-- Name: automation automation_scope_node_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation
    ADD CONSTRAINT automation_scope_node_fkey FOREIGN KEY (scope_node) REFERENCES public.org_node(id);


--
-- Name: block_allotment block_allotment_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.block_allotment
    ADD CONSTRAINT block_allotment_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.reservation_group(id);


--
-- Name: block_allotment block_allotment_unit_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.block_allotment
    ADD CONSTRAINT block_allotment_unit_type_id_fkey FOREIGN KEY (unit_type_id) REFERENCES public.unit_type(id);


--
-- Name: business_day business_day_property_node_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_day
    ADD CONSTRAINT business_day_property_node_fkey FOREIGN KEY (property_node) REFERENCES public.org_node(id);


--
-- Name: cashier_session cashier_session_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cashier_session
    ADD CONSTRAINT cashier_session_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_user(id);


--
-- Name: channel_map channel_map_channel_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_map
    ADD CONSTRAINT channel_map_channel_code_fkey FOREIGN KEY (channel_code) REFERENCES public.channel(code);


--
-- Name: channel_map channel_map_property_node_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_map
    ADD CONSTRAINT channel_map_property_node_fkey FOREIGN KEY (property_node) REFERENCES public.org_node(id);


--
-- Name: consent consent_party_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent
    ADD CONSTRAINT consent_party_id_fkey FOREIGN KEY (party_id) REFERENCES public.party(id);


--
-- Name: contact_point contact_point_party_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_point
    ADD CONSTRAINT contact_point_party_id_fkey FOREIGN KEY (party_id) REFERENCES public.party(id);


--
-- Name: discrepancy discrepancy_space_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discrepancy
    ADD CONSTRAINT discrepancy_space_id_fkey FOREIGN KEY (space_id) REFERENCES public.space(id);


--
-- Name: document document_property_node_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document
    ADD CONSTRAINT document_property_node_fkey FOREIGN KEY (property_node) REFERENCES public.org_node(id);


--
-- Name: document document_series_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document
    ADD CONSTRAINT document_series_id_fkey FOREIGN KEY (series_id) REFERENCES public.document_series(id);


--
-- Name: document_series document_series_property_node_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_series
    ADD CONSTRAINT document_series_property_node_fkey FOREIGN KEY (property_node) REFERENCES public.org_node(id);


--
-- Name: erasure_request erasure_request_party_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.erasure_request
    ADD CONSTRAINT erasure_request_party_id_fkey FOREIGN KEY (party_id) REFERENCES public.party(id);


--
-- Name: extension extension_type_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.extension
    ADD CONSTRAINT extension_type_fkey FOREIGN KEY (type) REFERENCES public.extension_type(type);


--
-- Name: fact_log fact_log_supersedes_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fact_log
    ADD CONSTRAINT fact_log_supersedes_fkey FOREIGN KEY (supersedes) REFERENCES public.fact_log(id);


--
-- Name: fiscal_submission fiscal_submission_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fiscal_submission
    ADD CONSTRAINT fiscal_submission_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.document(id);


--
-- Name: folio folio_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.folio
    ADD CONSTRAINT folio_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.account(id);


--
-- Name: folio folio_reservation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.folio
    ADD CONSTRAINT folio_reservation_id_fkey FOREIGN KEY (reservation_id) REFERENCES public.reservation(id);


--
-- Name: folio folio_tenant_account_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.folio
    ADD CONSTRAINT folio_tenant_account_fk FOREIGN KEY (tenant_id, account_id) REFERENCES public.account(tenant_id, id);


--
-- Name: folio folio_tenant_reservation_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.folio
    ADD CONSTRAINT folio_tenant_reservation_fk FOREIGN KEY (tenant_id, reservation_id) REFERENCES public.reservation(tenant_id, id);


--
-- Name: reservation_group group_master_folio_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation_group
    ADD CONSTRAINT group_master_folio_fk FOREIGN KEY (master_folio) REFERENCES public.folio(id);


--
-- Name: hold hold_property_node_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hold
    ADD CONSTRAINT hold_property_node_fkey FOREIGN KEY (property_node) REFERENCES public.org_node(id);


--
-- Name: hold hold_sellable_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hold
    ADD CONSTRAINT hold_sellable_unit_id_fkey FOREIGN KEY (sellable_unit_id) REFERENCES public.sellable_unit(id);


--
-- Name: identity_document identity_document_party_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.identity_document
    ADD CONSTRAINT identity_document_party_id_fkey FOREIGN KEY (party_id) REFERENCES public.party(id);


--
-- Name: inbound_message inbound_message_channel_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inbound_message
    ADD CONSTRAINT inbound_message_channel_code_fkey FOREIGN KEY (channel_code) REFERENCES public.channel(code);


--
-- Name: inventory_authority inventory_authority_property_node_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_authority
    ADD CONSTRAINT inventory_authority_property_node_fkey FOREIGN KEY (property_node) REFERENCES public.org_node(id);


--
-- Name: journal journal_property_node_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal
    ADD CONSTRAINT journal_property_node_fkey FOREIGN KEY (property_node) REFERENCES public.org_node(id);


--
-- Name: journal journal_reverses_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal
    ADD CONSTRAINT journal_reverses_fkey FOREIGN KEY (reverses) REFERENCES public.journal(id);


--
-- Name: membership membership_party_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.membership
    ADD CONSTRAINT membership_party_id_fkey FOREIGN KEY (party_id) REFERENCES public.party(id);


--
-- Name: message message_party_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message
    ADD CONSTRAINT message_party_id_fkey FOREIGN KEY (party_id) REFERENCES public.party(id);


--
-- Name: message message_reservation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message
    ADD CONSTRAINT message_reservation_id_fkey FOREIGN KEY (reservation_id) REFERENCES public.reservation(id);


--
-- Name: negotiated_rate negotiated_rate_party_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.negotiated_rate
    ADD CONSTRAINT negotiated_rate_party_id_fkey FOREIGN KEY (party_id) REFERENCES public.party(id);


--
-- Name: negotiated_rate negotiated_rate_rate_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.negotiated_rate
    ADD CONSTRAINT negotiated_rate_rate_plan_id_fkey FOREIGN KEY (rate_plan_id) REFERENCES public.rate_plan(id);


--
-- Name: ooo_oos ooo_oos_space_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ooo_oos
    ADD CONSTRAINT ooo_oos_space_id_fkey FOREIGN KEY (space_id) REFERENCES public.space(id);


--
-- Name: ooo_oos ooo_oos_work_order_task_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ooo_oos
    ADD CONSTRAINT ooo_oos_work_order_task_fkey FOREIGN KEY (work_order_task) REFERENCES public.task(id);


--
-- Name: org_node org_node_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_node
    ADD CONSTRAINT org_node_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id);


--
-- Name: overbooking_limit overbooking_limit_property_node_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.overbooking_limit
    ADD CONSTRAINT overbooking_limit_property_node_fkey FOREIGN KEY (property_node) REFERENCES public.org_node(id);


--
-- Name: overbooking_limit overbooking_limit_unit_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.overbooking_limit
    ADD CONSTRAINT overbooking_limit_unit_type_id_fkey FOREIGN KEY (unit_type_id) REFERENCES public.unit_type(id);


--
-- Name: package_element package_element_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.package_element
    ADD CONSTRAINT package_element_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.package(id);


--
-- Name: party party_merged_into_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.party
    ADD CONSTRAINT party_merged_into_fkey FOREIGN KEY (merged_into) REFERENCES public.party(id);


--
-- Name: party_relationship party_relationship_from_party_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.party_relationship
    ADD CONSTRAINT party_relationship_from_party_fkey FOREIGN KEY (from_party) REFERENCES public.party(id);


--
-- Name: party_relationship party_relationship_to_party_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.party_relationship
    ADD CONSTRAINT party_relationship_to_party_fkey FOREIGN KEY (to_party) REFERENCES public.party(id);


--
-- Name: party_role party_role_party_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.party_role
    ADD CONSTRAINT party_role_party_id_fkey FOREIGN KEY (party_id) REFERENCES public.party(id);


--
-- Name: payment payment_instrument_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment
    ADD CONSTRAINT payment_instrument_id_fkey FOREIGN KEY (instrument_id) REFERENCES public.payment_instrument(id);


--
-- Name: payment_instrument payment_instrument_party_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_instrument
    ADD CONSTRAINT payment_instrument_party_id_fkey FOREIGN KEY (party_id) REFERENCES public.party(id);


--
-- Name: payment payment_journal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment
    ADD CONSTRAINT payment_journal_id_fkey FOREIGN KEY (journal_id) REFERENCES public.journal(id);


--
-- Name: posting_line posting_line_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posting_line
    ADD CONSTRAINT posting_line_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.account(id);


--
-- Name: posting_line posting_line_folio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posting_line
    ADD CONSTRAINT posting_line_folio_id_fkey FOREIGN KEY (folio_id) REFERENCES public.folio(id);


--
-- Name: posting_line posting_line_journal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posting_line
    ADD CONSTRAINT posting_line_journal_id_fkey FOREIGN KEY (journal_id) REFERENCES public.journal(id);


--
-- Name: posting_line posting_line_tx_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posting_line
    ADD CONSTRAINT posting_line_tx_code_fkey FOREIGN KEY (tx_code) REFERENCES public.tx_code(code);


--
-- Name: preference preference_party_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.preference
    ADD CONSTRAINT preference_party_id_fkey FOREIGN KEY (party_id) REFERENCES public.party(id);


--
-- Name: push_cursor push_cursor_channel_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_cursor
    ADD CONSTRAINT push_cursor_channel_code_fkey FOREIGN KEY (channel_code) REFERENCES public.channel(code);


--
-- Name: queue_entry queue_entry_segment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.queue_entry
    ADD CONSTRAINT queue_entry_segment_id_fkey FOREIGN KEY (segment_id) REFERENCES public.reservation_segment(id);


--
-- Name: rate_plan rate_plan_cancellation_policy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_plan
    ADD CONSTRAINT rate_plan_cancellation_policy_fkey FOREIGN KEY (cancellation_policy) REFERENCES public.policy(id);


--
-- Name: rate_plan rate_plan_deposit_policy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_plan
    ADD CONSTRAINT rate_plan_deposit_policy_fkey FOREIGN KEY (deposit_policy) REFERENCES public.policy(id);


--
-- Name: rate_plan rate_plan_guarantee_policy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_plan
    ADD CONSTRAINT rate_plan_guarantee_policy_fkey FOREIGN KEY (guarantee_policy) REFERENCES public.policy(id);


--
-- Name: rate_plan_package rate_plan_package_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_plan_package
    ADD CONSTRAINT rate_plan_package_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.package(id);


--
-- Name: rate_plan_package rate_plan_package_rate_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_plan_package
    ADD CONSTRAINT rate_plan_package_rate_plan_id_fkey FOREIGN KEY (rate_plan_id) REFERENCES public.rate_plan(id);


--
-- Name: rate_plan rate_plan_parent_plan_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_plan
    ADD CONSTRAINT rate_plan_parent_plan_fkey FOREIGN KEY (parent_plan) REFERENCES public.rate_plan(id);


--
-- Name: rate_plan rate_plan_property_node_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_plan
    ADD CONSTRAINT rate_plan_property_node_fkey FOREIGN KEY (property_node) REFERENCES public.org_node(id);


--
-- Name: rate_price rate_price_rate_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_price
    ADD CONSTRAINT rate_price_rate_plan_id_fkey FOREIGN KEY (rate_plan_id) REFERENCES public.rate_plan(id);


--
-- Name: rate_price rate_price_superseded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_price
    ADD CONSTRAINT rate_price_superseded_by_fkey FOREIGN KEY (superseded_by) REFERENCES public.rate_price(id);


--
-- Name: rate_price rate_price_unit_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_price
    ADD CONSTRAINT rate_price_unit_type_id_fkey FOREIGN KEY (unit_type_id) REFERENCES public.unit_type(id);


--
-- Name: reservation reservation_booker_party_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation
    ADD CONSTRAINT reservation_booker_party_fkey FOREIGN KEY (booker_party) REFERENCES public.party(id);


--
-- Name: reservation_group reservation_group_account_party_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation_group
    ADD CONSTRAINT reservation_group_account_party_fkey FOREIGN KEY (account_party) REFERENCES public.party(id);


--
-- Name: reservation reservation_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation
    ADD CONSTRAINT reservation_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.reservation_group(id);


--
-- Name: reservation_group reservation_group_property_node_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation_group
    ADD CONSTRAINT reservation_group_property_node_fkey FOREIGN KEY (property_node) REFERENCES public.org_node(id);


--
-- Name: reservation reservation_guarantee_policy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation
    ADD CONSTRAINT reservation_guarantee_policy_fkey FOREIGN KEY (guarantee_policy) REFERENCES public.policy(id);


--
-- Name: reservation_guest reservation_guest_party_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation_guest
    ADD CONSTRAINT reservation_guest_party_id_fkey FOREIGN KEY (party_id) REFERENCES public.party(id);


--
-- Name: reservation_guest reservation_guest_reservation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation_guest
    ADD CONSTRAINT reservation_guest_reservation_id_fkey FOREIGN KEY (reservation_id) REFERENCES public.reservation(id);


--
-- Name: reservation reservation_primary_party_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation
    ADD CONSTRAINT reservation_primary_party_fkey FOREIGN KEY (primary_party) REFERENCES public.party(id);


--
-- Name: reservation reservation_property_node_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation
    ADD CONSTRAINT reservation_property_node_fkey FOREIGN KEY (property_node) REFERENCES public.org_node(id);


--
-- Name: reservation_segment reservation_segment_rate_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation_segment
    ADD CONSTRAINT reservation_segment_rate_plan_id_fkey FOREIGN KEY (rate_plan_id) REFERENCES public.rate_plan(id);


--
-- Name: reservation_segment reservation_segment_reservation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation_segment
    ADD CONSTRAINT reservation_segment_reservation_id_fkey FOREIGN KEY (reservation_id) REFERENCES public.reservation(id);


--
-- Name: reservation_segment reservation_segment_sellable_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation_segment
    ADD CONSTRAINT reservation_segment_sellable_unit_id_fkey FOREIGN KEY (sellable_unit_id) REFERENCES public.sellable_unit(id);


--
-- Name: reservation_segment reservation_segment_unit_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation_segment
    ADD CONSTRAINT reservation_segment_unit_type_id_fkey FOREIGN KEY (unit_type_id) REFERENCES public.unit_type(id);


--
-- Name: restriction restriction_rate_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restriction
    ADD CONSTRAINT restriction_rate_fk FOREIGN KEY (rate_plan_id) REFERENCES public.rate_plan(id);


--
-- Name: restriction restriction_scope_node_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restriction
    ADD CONSTRAINT restriction_scope_node_fkey FOREIGN KEY (scope_node) REFERENCES public.org_node(id);


--
-- Name: restriction restriction_unit_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restriction
    ADD CONSTRAINT restriction_unit_type_id_fkey FOREIGN KEY (unit_type_id) REFERENCES public.unit_type(id);


--
-- Name: role_permission role_permission_permission_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permission
    ADD CONSTRAINT role_permission_permission_code_fkey FOREIGN KEY (permission_code) REFERENCES public.permission(code);


--
-- Name: role_permission role_permission_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permission
    ADD CONSTRAINT role_permission_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.role(id);


--
-- Name: role role_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role
    ADD CONSTRAINT role_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id);


--
-- Name: sellable_unit_space sellable_unit_space_sellable_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sellable_unit_space
    ADD CONSTRAINT sellable_unit_space_sellable_unit_id_fkey FOREIGN KEY (sellable_unit_id) REFERENCES public.sellable_unit(id);


--
-- Name: sellable_unit_space sellable_unit_space_space_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sellable_unit_space
    ADD CONSTRAINT sellable_unit_space_space_id_fkey FOREIGN KEY (space_id) REFERENCES public.space(id);


--
-- Name: sellable_unit sellable_unit_unit_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sellable_unit
    ADD CONSTRAINT sellable_unit_unit_type_id_fkey FOREIGN KEY (unit_type_id) REFERENCES public.unit_type(id);


--
-- Name: space_occupancy space_occupancy_space_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.space_occupancy
    ADD CONSTRAINT space_occupancy_space_id_fkey FOREIGN KEY (space_id) REFERENCES public.space(id);


--
-- Name: space space_property_node_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.space
    ADD CONSTRAINT space_property_node_fkey FOREIGN KEY (property_node) REFERENCES public.org_node(id);


--
-- Name: space_relation space_relation_child_space_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.space_relation
    ADD CONSTRAINT space_relation_child_space_fkey FOREIGN KEY (child_space) REFERENCES public.space(id);


--
-- Name: space_relation space_relation_parent_space_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.space_relation
    ADD CONSTRAINT space_relation_parent_space_fkey FOREIGN KEY (parent_space) REFERENCES public.space(id);


--
-- Name: statutory_submission statutory_submission_reservation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.statutory_submission
    ADD CONSTRAINT statutory_submission_reservation_id_fkey FOREIGN KEY (reservation_id) REFERENCES public.reservation(id);


--
-- Name: task task_property_node_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task
    ADD CONSTRAINT task_property_node_fkey FOREIGN KEY (property_node) REFERENCES public.org_node(id);


--
-- Name: task_sheet task_sheet_attendant_party_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_sheet
    ADD CONSTRAINT task_sheet_attendant_party_fkey FOREIGN KEY (attendant_party) REFERENCES public.party(id);


--
-- Name: tax_assignment tax_assignment_property_node_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_assignment
    ADD CONSTRAINT tax_assignment_property_node_fkey FOREIGN KEY (property_node) REFERENCES public.org_node(id);


--
-- Name: travel_detail travel_detail_pickup_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.travel_detail
    ADD CONSTRAINT travel_detail_pickup_task_id_fkey FOREIGN KEY (pickup_task_id) REFERENCES public.task(id);


--
-- Name: travel_detail travel_detail_reservation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.travel_detail
    ADD CONSTRAINT travel_detail_reservation_id_fkey FOREIGN KEY (reservation_id) REFERENCES public.reservation(id);


--
-- Name: unit_condition unit_condition_space_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_condition
    ADD CONSTRAINT unit_condition_space_id_fkey FOREIGN KEY (space_id) REFERENCES public.space(id);


--
-- Name: unit_type unit_type_property_node_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_type
    ADD CONSTRAINT unit_type_property_node_fkey FOREIGN KEY (property_node) REFERENCES public.org_node(id);


--
-- Name: user_role user_role_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_role
    ADD CONSTRAINT user_role_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.role(id);


--
-- Name: user_role user_role_scope_node_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_role
    ADD CONSTRAINT user_role_scope_node_fkey FOREIGN KEY (scope_node) REFERENCES public.org_node(id);


--
-- Name: user_role user_role_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_role
    ADD CONSTRAINT user_role_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_user(id);


--
-- Name: vehicle vehicle_parking_space_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicle
    ADD CONSTRAINT vehicle_parking_space_fkey FOREIGN KEY (parking_space) REFERENCES public.space(id);


--
-- Name: vehicle vehicle_party_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicle
    ADD CONSTRAINT vehicle_party_id_fkey FOREIGN KEY (party_id) REFERENCES public.party(id);


--
-- Name: vehicle vehicle_property_node_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicle
    ADD CONSTRAINT vehicle_property_node_fkey FOREIGN KEY (property_node) REFERENCES public.org_node(id);


--
-- Name: vehicle vehicle_reservation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicle
    ADD CONSTRAINT vehicle_reservation_id_fkey FOREIGN KEY (reservation_id) REFERENCES public.reservation(id);


--
-- Name: waitlist_entry waitlist_entry_party_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waitlist_entry
    ADD CONSTRAINT waitlist_entry_party_id_fkey FOREIGN KEY (party_id) REFERENCES public.party(id);


--
-- Name: waitlist_entry waitlist_entry_unit_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waitlist_entry
    ADD CONSTRAINT waitlist_entry_unit_type_id_fkey FOREIGN KEY (unit_type_id) REFERENCES public.unit_type(id);


--
-- Name: account; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.account ENABLE ROW LEVEL SECURITY;

--
-- Name: address; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.address ENABLE ROW LEVEL SECURITY;

--
-- Name: alert; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.alert ENABLE ROW LEVEL SECURITY;

--
-- Name: api_client; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.api_client ENABLE ROW LEVEL SECURITY;

--
-- Name: api_idempotency; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.api_idempotency ENABLE ROW LEVEL SECURITY;

--
-- Name: app_user; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.app_user ENABLE ROW LEVEL SECURITY;

--
-- Name: approval_request; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.approval_request ENABLE ROW LEVEL SECURITY;

--
-- Name: ar_allocation; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ar_allocation ENABLE ROW LEVEL SECURITY;

--
-- Name: automation; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.automation ENABLE ROW LEVEL SECURITY;

--
-- Name: availability_projection; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.availability_projection ENABLE ROW LEVEL SECURITY;

--
-- Name: block_allotment; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.block_allotment ENABLE ROW LEVEL SECURITY;

--
-- Name: block_status_def; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.block_status_def ENABLE ROW LEVEL SECURITY;

--
-- Name: business_day; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.business_day ENABLE ROW LEVEL SECURITY;

--
-- Name: cashier_session; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cashier_session ENABLE ROW LEVEL SECURITY;

--
-- Name: channel_map; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.channel_map ENABLE ROW LEVEL SECURITY;

--
-- Name: consent; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.consent ENABLE ROW LEVEL SECURITY;

--
-- Name: contact_point; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contact_point ENABLE ROW LEVEL SECURITY;

--
-- Name: discrepancy; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.discrepancy ENABLE ROW LEVEL SECURITY;

--
-- Name: document; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document ENABLE ROW LEVEL SECURITY;

--
-- Name: document_series; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_series ENABLE ROW LEVEL SECURITY;

--
-- Name: erasure_request; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.erasure_request ENABLE ROW LEVEL SECURITY;

--
-- Name: extension; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.extension ENABLE ROW LEVEL SECURITY;

--
-- Name: fact_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fact_log ENABLE ROW LEVEL SECURITY;

--
-- Name: fiscal_submission; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fiscal_submission ENABLE ROW LEVEL SECURITY;

--
-- Name: folio; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.folio ENABLE ROW LEVEL SECURITY;

--
-- Name: hold; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.hold ENABLE ROW LEVEL SECURITY;

--
-- Name: identity_document; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.identity_document ENABLE ROW LEVEL SECURITY;

--
-- Name: inbound_message; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inbound_message ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_authority; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_authority ENABLE ROW LEVEL SECURITY;

--
-- Name: journal; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.journal ENABLE ROW LEVEL SECURITY;

--
-- Name: membership; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.membership ENABLE ROW LEVEL SECURITY;

--
-- Name: message; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.message ENABLE ROW LEVEL SECURITY;

--
-- Name: negotiated_rate; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.negotiated_rate ENABLE ROW LEVEL SECURITY;

--
-- Name: ooo_oos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ooo_oos ENABLE ROW LEVEL SECURITY;

--
-- Name: org_node; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.org_node ENABLE ROW LEVEL SECURITY;

--
-- Name: outbox; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.outbox ENABLE ROW LEVEL SECURITY;

--
-- Name: overbooking_limit; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.overbooking_limit ENABLE ROW LEVEL SECURITY;

--
-- Name: package; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.package ENABLE ROW LEVEL SECURITY;

--
-- Name: package_element; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.package_element ENABLE ROW LEVEL SECURITY;

--
-- Name: party; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.party ENABLE ROW LEVEL SECURITY;

--
-- Name: party_relationship; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.party_relationship ENABLE ROW LEVEL SECURITY;

--
-- Name: party_role; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.party_role ENABLE ROW LEVEL SECURITY;

--
-- Name: payment; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_instrument; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment_instrument ENABLE ROW LEVEL SECURITY;

--
-- Name: policy; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.policy ENABLE ROW LEVEL SECURITY;

--
-- Name: posting_line; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.posting_line ENABLE ROW LEVEL SECURITY;

--
-- Name: preference; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.preference ENABLE ROW LEVEL SECURITY;

--
-- Name: promotion; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.promotion ENABLE ROW LEVEL SECURITY;

--
-- Name: push_cursor; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.push_cursor ENABLE ROW LEVEL SECURITY;

--
-- Name: queue_entry; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.queue_entry ENABLE ROW LEVEL SECURITY;

--
-- Name: rate_plan; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rate_plan ENABLE ROW LEVEL SECURITY;

--
-- Name: rate_price; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rate_price ENABLE ROW LEVEL SECURITY;

--
-- Name: reservation; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reservation ENABLE ROW LEVEL SECURITY;

--
-- Name: reservation_group; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reservation_group ENABLE ROW LEVEL SECURITY;

--
-- Name: reservation_guest; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reservation_guest ENABLE ROW LEVEL SECURITY;

--
-- Name: reservation_segment; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reservation_segment ENABLE ROW LEVEL SECURITY;

--
-- Name: restriction; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.restriction ENABLE ROW LEVEL SECURITY;

--
-- Name: role; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.role ENABLE ROW LEVEL SECURITY;

--
-- Name: sellable_unit; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sellable_unit ENABLE ROW LEVEL SECURITY;

--
-- Name: sellable_unit_space; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sellable_unit_space ENABLE ROW LEVEL SECURITY;

--
-- Name: space; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.space ENABLE ROW LEVEL SECURITY;

--
-- Name: space_occupancy; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.space_occupancy ENABLE ROW LEVEL SECURITY;

--
-- Name: space_relation; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.space_relation ENABLE ROW LEVEL SECURITY;

--
-- Name: stats_daily; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stats_daily ENABLE ROW LEVEL SECURITY;

--
-- Name: statutory_submission; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.statutory_submission ENABLE ROW LEVEL SECURITY;

--
-- Name: task; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.task ENABLE ROW LEVEL SECURITY;

--
-- Name: task_sheet; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.task_sheet ENABLE ROW LEVEL SECURITY;

--
-- Name: tax_assignment; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tax_assignment ENABLE ROW LEVEL SECURITY;

--
-- Name: account tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.account USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: address tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.address USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: alert tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.alert USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: api_client tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.api_client USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: api_idempotency tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.api_idempotency USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: app_user tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.app_user USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: approval_request tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.approval_request USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: ar_allocation tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ar_allocation USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: automation tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.automation USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: availability_projection tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.availability_projection USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: block_allotment tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.block_allotment USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: block_status_def tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.block_status_def USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: business_day tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.business_day USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: cashier_session tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.cashier_session USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: channel_map tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.channel_map USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: consent tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.consent USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: contact_point tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.contact_point USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: discrepancy tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.discrepancy USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: document tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.document USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: document_series tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.document_series USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: erasure_request tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.erasure_request USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: extension tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.extension USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: fact_log tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.fact_log USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: fiscal_submission tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.fiscal_submission USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: folio tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.folio USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: hold tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.hold USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: identity_document tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.identity_document USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: inbound_message tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.inbound_message USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: inventory_authority tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.inventory_authority USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: journal tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.journal USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: membership tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.membership USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: message tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.message USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: negotiated_rate tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.negotiated_rate USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: ooo_oos tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.ooo_oos USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: org_node tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.org_node USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: outbox tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.outbox USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: overbooking_limit tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.overbooking_limit USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: package tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.package USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: package_element tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.package_element USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: party tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.party USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: party_relationship tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.party_relationship USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: party_role tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.party_role USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: payment tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.payment USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: payment_instrument tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.payment_instrument USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: policy tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.policy USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: posting_line tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.posting_line USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: preference tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.preference USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: promotion tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.promotion USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: push_cursor tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.push_cursor USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: queue_entry tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.queue_entry USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: rate_plan tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.rate_plan USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: rate_price tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.rate_price USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: reservation tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.reservation USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: reservation_group tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.reservation_group USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: reservation_guest tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.reservation_guest USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: reservation_segment tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.reservation_segment USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: restriction tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.restriction USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: role tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.role USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: sellable_unit tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.sellable_unit USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: sellable_unit_space tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.sellable_unit_space USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: space tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.space USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: space_occupancy tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.space_occupancy USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: space_relation tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.space_relation USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: stats_daily tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.stats_daily USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: statutory_submission tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.statutory_submission USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: task tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.task USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: task_sheet tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.task_sheet USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: tax_assignment tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.tax_assignment USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: travel_detail tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.travel_detail USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: unit_condition tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.unit_condition USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: unit_type tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.unit_type USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: user_role tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.user_role USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: vehicle tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.vehicle USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: waitlist_entry tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.waitlist_entry USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- Name: travel_detail; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.travel_detail ENABLE ROW LEVEL SECURITY;

--
-- Name: unit_condition; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.unit_condition ENABLE ROW LEVEL SECURITY;

--
-- Name: unit_type; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.unit_type ENABLE ROW LEVEL SECURITY;

--
-- Name: user_role; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_role ENABLE ROW LEVEL SECURITY;

--
-- Name: vehicle; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.vehicle ENABLE ROW LEVEL SECURITY;

--
-- Name: waitlist_entry; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.waitlist_entry ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO app_role;


--
-- Name: FUNCTION expire_holds(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.expire_holds() FROM PUBLIC;


--
-- Name: FUNCTION prune_outbox(p_retain interval); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.prune_outbox(p_retain interval) TO app_role;


--
-- Name: FUNCTION record_occupancy(p_tenant uuid, p_space uuid, p_period tstzrange, p_slot uuid, p_slot_kind text, p_exclusive boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.record_occupancy(p_tenant uuid, p_space uuid, p_period tstzrange, p_slot uuid, p_slot_kind text, p_exclusive boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.record_occupancy(p_tenant uuid, p_space uuid, p_period tstzrange, p_slot uuid, p_slot_kind text, p_exclusive boolean) TO app_role;


--
-- Name: FUNCTION release_occupancy(p_tenant uuid, p_slot uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.release_occupancy(p_tenant uuid, p_slot uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.release_occupancy(p_tenant uuid, p_slot uuid) TO app_role;


--
-- Name: FUNCTION seal_business_day(p_tenant uuid, p_property uuid, p_date date, p_user uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.seal_business_day(p_tenant uuid, p_property uuid, p_date date, p_user uuid) TO app_role;


--
-- Name: TABLE account; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.account TO app_role;


--
-- Name: TABLE address; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.address TO app_role;


--
-- Name: TABLE alert; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.alert TO app_role;


--
-- Name: TABLE api_client; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.api_client TO app_role;


--
-- Name: TABLE api_idempotency; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.api_idempotency TO app_role;


--
-- Name: TABLE app_user; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.app_user TO app_role;


--
-- Name: TABLE approval_request; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.approval_request TO app_role;


--
-- Name: TABLE ar_allocation; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.ar_allocation TO app_role;


--
-- Name: TABLE automation; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.automation TO app_role;


--
-- Name: TABLE availability_projection; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.availability_projection TO app_role;


--
-- Name: TABLE block_allotment; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.block_allotment TO app_role;


--
-- Name: TABLE block_status_def; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.block_status_def TO app_role;


--
-- Name: TABLE business_day; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.business_day TO app_role;


--
-- Name: TABLE cashier_session; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.cashier_session TO app_role;


--
-- Name: TABLE channel; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT ON TABLE public.channel TO app_role;


--
-- Name: TABLE channel_map; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.channel_map TO app_role;


--
-- Name: TABLE consent; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.consent TO app_role;


--
-- Name: TABLE contact_point; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.contact_point TO app_role;


--
-- Name: TABLE rate_price; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.rate_price TO app_role;


--
-- Name: COLUMN rate_price.superseded_by; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(superseded_by) ON TABLE public.rate_price TO app_role;


--
-- Name: TABLE current_rate_price; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT ON TABLE public.current_rate_price TO app_role;


--
-- Name: TABLE discrepancy; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.discrepancy TO app_role;


--
-- Name: TABLE document; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.document TO app_role;


--
-- Name: TABLE document_series; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.document_series TO app_role;


--
-- Name: TABLE erasure_request; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.erasure_request TO app_role;


--
-- Name: TABLE extension; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.extension TO app_role;


--
-- Name: TABLE extension_type; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT ON TABLE public.extension_type TO app_role;


--
-- Name: TABLE fact_log; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT ON TABLE public.fact_log TO app_role;


--
-- Name: TABLE fiscal_submission; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.fiscal_submission TO app_role;


--
-- Name: TABLE folio; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.folio TO app_role;


--
-- Name: TABLE posting_line; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT ON TABLE public.posting_line TO app_role;


--
-- Name: TABLE folio_balance; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT ON TABLE public.folio_balance TO app_role;


--
-- Name: TABLE hold; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.hold TO app_role;


--
-- Name: TABLE identity_document; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.identity_document TO app_role;


--
-- Name: TABLE inbound_message; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.inbound_message TO app_role;


--
-- Name: TABLE inventory_authority; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.inventory_authority TO app_role;


--
-- Name: TABLE journal; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT ON TABLE public.journal TO app_role;


--
-- Name: TABLE membership; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.membership TO app_role;


--
-- Name: TABLE message; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT ON TABLE public.message TO app_role;


--
-- Name: TABLE negotiated_rate; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.negotiated_rate TO app_role;


--
-- Name: TABLE ooo_oos; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.ooo_oos TO app_role;


--
-- Name: TABLE org_node; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.org_node TO app_role;


--
-- Name: TABLE outbox; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT ON TABLE public.outbox TO app_role;


--
-- Name: COLUMN outbox.published_at; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(published_at) ON TABLE public.outbox TO app_role;


--
-- Name: TABLE overbooking_limit; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.overbooking_limit TO app_role;


--
-- Name: TABLE package; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.package TO app_role;


--
-- Name: TABLE package_element; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.package_element TO app_role;


--
-- Name: TABLE party; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.party TO app_role;


--
-- Name: TABLE party_relationship; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.party_relationship TO app_role;


--
-- Name: TABLE party_role; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.party_role TO app_role;


--
-- Name: TABLE payment; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.payment TO app_role;


--
-- Name: TABLE payment_instrument; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.payment_instrument TO app_role;


--
-- Name: TABLE permission; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT ON TABLE public.permission TO app_role;


--
-- Name: TABLE policy; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.policy TO app_role;


--
-- Name: TABLE preference; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.preference TO app_role;


--
-- Name: TABLE promotion; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.promotion TO app_role;


--
-- Name: TABLE push_cursor; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.push_cursor TO app_role;


--
-- Name: TABLE queue_entry; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.queue_entry TO app_role;


--
-- Name: TABLE rate_plan; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.rate_plan TO app_role;


--
-- Name: TABLE rate_plan_package; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.rate_plan_package TO app_role;


--
-- Name: TABLE reservation; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.reservation TO app_role;


--
-- Name: TABLE reservation_group; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.reservation_group TO app_role;


--
-- Name: TABLE reservation_guest; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.reservation_guest TO app_role;


--
-- Name: TABLE reservation_segment; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.reservation_segment TO app_role;


--
-- Name: TABLE restriction; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.restriction TO app_role;


--
-- Name: TABLE role; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.role TO app_role;


--
-- Name: TABLE role_permission; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.role_permission TO app_role;


--
-- Name: TABLE sellable_unit; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.sellable_unit TO app_role;


--
-- Name: TABLE sellable_unit_space; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.sellable_unit_space TO app_role;


--
-- Name: TABLE space; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.space TO app_role;


--
-- Name: TABLE space_occupancy; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.space_occupancy TO app_role;


--
-- Name: TABLE space_relation; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.space_relation TO app_role;


--
-- Name: TABLE stats_daily; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.stats_daily TO app_role;


--
-- Name: TABLE statutory_submission; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.statutory_submission TO app_role;


--
-- Name: TABLE task; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.task TO app_role;


--
-- Name: TABLE task_sheet; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.task_sheet TO app_role;


--
-- Name: TABLE tax_assignment; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT ON TABLE public.tax_assignment TO app_role;


--
-- Name: TABLE tenant; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.tenant TO app_role;


--
-- Name: TABLE travel_detail; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.travel_detail TO app_role;


--
-- Name: TABLE tx_code; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT ON TABLE public.tx_code TO app_role;


--
-- Name: TABLE unit_condition; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.unit_condition TO app_role;


--
-- Name: TABLE unit_type; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.unit_type TO app_role;


--
-- Name: TABLE user_role; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.user_role TO app_role;


--
-- Name: TABLE vehicle; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.vehicle TO app_role;


--
-- Name: TABLE waitlist_entry; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.waitlist_entry TO app_role;


--
-- PostgreSQL database dump complete
--
