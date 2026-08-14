-- ============================================================================
-- MOTHER OF ALL PMS — CANONICAL SCHEMA (the ERD, executable form)   v1.0
-- 13 Aug 2026 · PostgreSQL 16+ · Single source of truth for every table.
--
-- This file IS the entity model. Claude Code sessions cite sections (§) here.
-- Rules that govern everything below:
--   R1  tenant_id uuid is the FIRST data column of every tenant-scoped table
--       and LEADS every composite index. RLS is applied to all such tables
--       by the DO block in §14 — never write a table that escapes it.
--   R2  Money is bigint minor units + currency char(3). Never float/numeric
--       for amounts. Column suffix: _minor.
--   R3  Times are timestamptz. Stay periods are tstzrange, half-open [).
--       business_date is date, derived from the PROPERTY's timezone.
--   R4  Insert-only tables (fact_log, posting_line, journal, outbox,
--       space_occupancy, document): no UPDATE, no DELETE, ever. Corrections
--       are new rows. The only sanctioned deletes go through §4 functions.
--   R5  space_occupancy is written ONLY via record_occupancy()/
--       release_occupancy(). Direct DML is revoked (proven: prototype T4).
--   R6  ids: uuid DEFAULT gen_random_uuid(). Ordering via seq/created_at.
--   R7  Partition-ready, not partitioned: journal, posting_line, fact_log,
--       outbox carry business_date/created_at for future partition keys.
--       Do NOT partition before ~100 GB (BUILD-PLAN trigger).
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS ltree;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================================
-- §1  IDENTITY & TENANCY                                    (Context 1)
-- ============================================================================
CREATE TABLE tenant (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text NOT NULL UNIQUE,
  name          text NOT NULL,
  tier          text NOT NULL DEFAULT 'shared'      -- shared | dedicated
                CHECK (tier IN ('shared','dedicated')),
  residency     text NOT NULL DEFAULT 'me-central', -- data-residency region
  status        text NOT NULL DEFAULT 'active',
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Org hierarchy: brand → region → property → outlet, as an ltree path.
CREATE TABLE org_node (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenant(id),
  path          ltree NOT NULL,                      -- e.g. acme.gulf.dxb01
  kind          text  NOT NULL CHECK (kind IN ('group','brand','region','property','outlet')),
  name          text  NOT NULL,
  timezone      text,                                -- REQUIRED when kind='property'
  currency      char(3),                             -- property base currency
  config        jsonb NOT NULL DEFAULT '{}',
  CONSTRAINT property_needs_tz CHECK (kind <> 'property' OR timezone IS NOT NULL),
  UNIQUE (tenant_id, path)
);
CREATE INDEX org_node_path_gist ON org_node USING gist (tenant_id, path);

CREATE TABLE app_user (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenant(id),
  email         text NOT NULL,
  display_name  text NOT NULL,
  auth          jsonb NOT NULL DEFAULT '{}',         -- hash/OIDC subject/etc.
  status        text NOT NULL DEFAULT 'active',
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, email)
);

-- Task-level permission catalog (seeded from code, e.g. 'reservation.checkin.dirty_room').
CREATE TABLE permission (code text PRIMARY KEY, description text NOT NULL);

CREATE TABLE role (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id),
  name text NOT NULL, UNIQUE (tenant_id, name)
);
CREATE TABLE role_permission (
  role_id uuid REFERENCES role(id), permission_code text REFERENCES permission(code),
  PRIMARY KEY (role_id, permission_code)
);
-- A user's role applies to an org subtree (the Grant primitive for staff).
CREATE TABLE user_role (
  tenant_id uuid NOT NULL,
  user_id uuid REFERENCES app_user(id), role_id uuid REFERENCES role(id),
  scope_node uuid REFERENCES org_node(id),
  PRIMARY KEY (user_id, role_id, scope_node)
);
CREATE TABLE api_client (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id),
  name text NOT NULL, scopes text[] NOT NULL DEFAULT '{}',
  scope_node uuid REFERENCES org_node(id),
  secret_hash text NOT NULL, status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Four-eyes approvals (credit overrides, rate overrides past threshold, etc.)
CREATE TABLE approval_request (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  kind text NOT NULL, subject_type text NOT NULL, subject_id uuid NOT NULL,
  requested_by uuid NOT NULL REFERENCES app_user(id),
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','expired')),
  decided_by uuid REFERENCES app_user(id), decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- §2  KERNEL PRIMITIVES: extension registry · fact_log · outbox · document · task
-- ============================================================================
-- One lifecycle for every plugin type; content stays TYPED per type (schema in
-- extension_type.json_schema, validated app-side on write). See EXTENSIONS.md.
CREATE TABLE extension_type (
  type          text PRIMARY KEY,      -- vertical_profile | tax_jurisdiction |
                                       -- statutory_adapter | fiscal_provider |
                                       -- policy_kind | channel_adapter | dp_regime
  json_schema   jsonb NOT NULL
);
CREATE TABLE extension (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid,                                -- NULL = platform-global
  type          text NOT NULL REFERENCES extension_type(type),
  key           text NOT NULL,                       -- 'hotel', 'in-gst', 'sa-zatca'
  version       int  NOT NULL DEFAULT 1,
  effective     tstzrange NOT NULL DEFAULT tstzrange(now(), NULL),
  content       jsonb NOT NULL,
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','retired')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, type, key, version)
);

-- THE bitemporal spine (Round 4 finding S). Insert-only. "Current" is a query.
CREATE TABLE fact_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL,
  entity_type   text NOT NULL,                       -- 'rate_price','reservation','automation','config',...
  entity_id     uuid NOT NULL,
  fact_type     text NOT NULL,                       -- discriminator within entity
  valid_from    timestamptz NOT NULL,                -- business truth begins
  valid_to      timestamptz,                         -- NULL = open-ended
  recorded_at   timestamptz NOT NULL DEFAULT now(),  -- system learned it
  business_date date NOT NULL,
  actor_id      uuid,
  payload       jsonb NOT NULL,
  supersedes    uuid REFERENCES fact_log(id)
);
CREATE INDEX fact_current ON fact_log (tenant_id, entity_type, entity_id, fact_type, recorded_at DESC);
CREATE INDEX fact_bdate   ON fact_log USING brin (business_date);

-- Transactional outbox: the event backbone's source of truth (v2 Correction 2).
CREATE TABLE outbox (
  seq           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id            uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL,
  property_node uuid,
  business_date date NOT NULL,
  aggregate_type text NOT NULL, aggregate_id uuid NOT NULL,
  event_type    text NOT NULL,                       -- see EVENTS.md catalogue
  event_version int  NOT NULL DEFAULT 1,
  actor_id      uuid,
  correlation_id uuid NOT NULL,
  causation_id  uuid,
  payload       jsonb NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  published_at  timestamptz
);
CREATE INDEX outbox_unpublished ON outbox (seq) WHERE published_at IS NULL;
-- Publishing flips rows out of the partial index → dead-tuple churn on a hot table.
-- Contain it: aggressive autovacuum + prune_outbox() (§12) keeps the table small.
ALTER TABLE outbox SET (autovacuum_vacuum_scale_factor = 0.01, autovacuum_vacuum_cost_delay = 0);

-- Rendered, optionally fiscal, artifacts: folios, invoices, reg cards,
-- statutory returns, owner statements, BEOs, confirmations.
CREATE TABLE document_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL, property_node uuid NOT NULL REFERENCES org_node(id),
  kind text NOT NULL,                                -- 'invoice','folio','credit_note',...
  prefix text NOT NULL, next_no bigint NOT NULL DEFAULT 1,
  fiscal boolean NOT NULL DEFAULT false,
  last_doc_hash text,                                -- ZATCA PIH chain tail
  UNIQUE (tenant_id, property_node, kind, prefix)
);
CREATE TABLE document (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL,
  property_node uuid REFERENCES org_node(id),
  kind          text NOT NULL,
  series_id     uuid REFERENCES document_series(id),
  doc_no        text,
  status        text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','issued','cleared','rejected','void')),
  subject_type  text, subject_id uuid,               -- folio/reservation/party it documents
  content       jsonb NOT NULL,                      -- structured payload (renders to PDF/XML)
  rendered_ref  text,                                -- object-storage key
  sha256        text,
  prev_hash     text,                                -- fiscal hash chain
  issued_at     timestamptz,
  business_date date,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX document_subject ON document (tenant_id, subject_type, subject_id);

-- The Task primitive: HK tasks, traces, work orders, guest requests, wake-ups,
-- robot instructions — one table, one lifecycle (STATE-MACHINES.md §4).
CREATE TABLE task (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL,
  property_node uuid NOT NULL REFERENCES org_node(id),
  kind          text NOT NULL,                       -- housekeeping|trace|work_order|guest_request|wakeup|robot
  status        text NOT NULL DEFAULT 'open' CHECK (status IN ('open','assigned','in_progress','done','verified','cancelled')),
  subject_type  text, subject_id uuid,               -- space / reservation / party
  assignee_party uuid,
  department    text,
  due_at        timestamptz,
  priority      smallint NOT NULL DEFAULT 3,
  credits       smallint,                            -- HK credit weighting
  sheet_id      uuid,                                -- task_sheet grouping
  payload       jsonb NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now(),
  completed_at  timestamptz
);
CREATE INDEX task_board ON task (tenant_id, property_node, kind, status, due_at);

-- The Automation primitive (BillingAutomation and every other trigger+condition+action).
-- Head row = current; every change also writes fact_log(entity_type='automation').
CREATE TABLE automation (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL,
  scope_node    uuid NOT NULL REFERENCES org_node(id),
  name          text NOT NULL,
  trigger_event text NOT NULL,                       -- event_type from EVENTS.md, or 'schedule:cron'
  condition     jsonb NOT NULL DEFAULT '{}',         -- predicate AST (CONTRACTS.md §6)
  action        jsonb NOT NULL,                      -- typed by action.type: route|post_charge|
                                                     -- transfer|generate_task|notify|deposit_request|
                                                     -- trust_split|wash_release|auto_checkout
  priority      int NOT NULL DEFAULT 100,
  status        text NOT NULL DEFAULT 'active',
  effective     tstzrange NOT NULL DEFAULT tstzrange(now(), NULL)
);

-- ============================================================================
-- §3  PARTY / CRM                                            (Context 8)
-- ============================================================================
CREATE TABLE party (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL,
  kind          text NOT NULL CHECK (kind IN ('person','org')),
  display_name  text NOT NULL,
  legal_name    text,
  attrs         jsonb NOT NULL DEFAULT '{}',         -- nationality, dob, tax ids...
  vip_code      text,
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active','merged','anonymised')),
  merged_into   uuid REFERENCES party(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX party_name_trgm ON party USING gin (display_name gin_trgm_ops);

-- Roles a party plays (a party can be several): guest, company, agent, source,
-- vendor, OWNER, staff, contact. First-class Owner/Agent per locked decisions.
CREATE TABLE party_role (
  tenant_id uuid NOT NULL,
  party_id uuid REFERENCES party(id),
  role text CHECK (role IN ('guest','company','agent','source','vendor','owner','staff','contact')),
  detail jsonb NOT NULL DEFAULT '{}',                -- IATA no, commission %, owner units...
  PRIMARY KEY (party_id, role)
);
CREATE TABLE contact_point (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL,
  party_id uuid NOT NULL REFERENCES party(id),
  kind text NOT NULL CHECK (kind IN ('email','phone','whatsapp')),
  value text NOT NULL, is_primary boolean NOT NULL DEFAULT false, verified boolean NOT NULL DEFAULT false
);
CREATE TABLE address (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL,
  party_id uuid NOT NULL REFERENCES party(id),
  kind text NOT NULL DEFAULT 'home', lines text[], city text, region text,
  postal_code text, country char(2) NOT NULL
);
CREATE TABLE identity_document (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL,
  party_id uuid NOT NULL REFERENCES party(id),
  kind text NOT NULL,                                -- passport|national_id|visa|emirates_id
  number_enc text NOT NULL,                          -- app-layer encrypted
  issuing_country char(2), expiry date, scan_ref text
);
CREATE TABLE party_relationship (
  tenant_id uuid NOT NULL,
  from_party uuid REFERENCES party(id), to_party uuid REFERENCES party(id),
  kind text NOT NULL,                                -- employee_of|subsidiary_of|books_for|family
  PRIMARY KEY (from_party, to_party, kind)
);
CREATE TABLE membership (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL,
  party_id uuid NOT NULL REFERENCES party(id),
  program text NOT NULL, number text NOT NULL, tier text,
  points bigint NOT NULL DEFAULT 0, UNIQUE (tenant_id, program, number)
);
CREATE TABLE preference (
  tenant_id uuid NOT NULL, party_id uuid REFERENCES party(id),
  key text, value jsonb NOT NULL, PRIMARY KEY (party_id, key)
);
-- Consent per purpose — purpose limitation enforced at query time (v2 §6.2).
CREATE TABLE consent (
  tenant_id uuid NOT NULL, party_id uuid REFERENCES party(id),
  purpose text, granted boolean NOT NULL, at timestamptz NOT NULL DEFAULT now(),
  source text, PRIMARY KEY (party_id, purpose)
);

-- ============================================================================
-- §4  INVENTORY & AVAILABILITY                               (Context 2)
--      Space → SellableUnit → occupancy. Claim-range design (prototype P1).
-- ============================================================================
CREATE TABLE space (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL,
  property_node uuid NOT NULL REFERENCES org_node(id),
  code          text NOT NULL,                       -- '101', 'DORM-A', 'BERTH-12', 'BALLROOM'
  profile_key   text NOT NULL,                       -- extension(vertical_profile).key
  capacity      smallint NOT NULL DEFAULT 1,         -- claimable positions (beds) for non-exclusive sale
  max_occupancy smallint,                            -- persons
  floor         text, area_sqm numeric(8,2),
  -- HOT typed attributes (filtered in matching; §2.6 hybrid rule). NULL when N/A.
  gender_policy text CHECK (gender_policy IN ('any','female','male')),
  length_cm     int, beam_cm int, draft_cm int, power_amps int,  -- marina-ready, unused v1
  attrs         jsonb NOT NULL DEFAULT '{}',         -- COLD attributes; query only with @>
  status        text NOT NULL DEFAULT 'active',
  UNIQUE (tenant_id, property_node, code)
);
CREATE INDEX space_attrs_gin ON space USING gin (attrs jsonb_path_ops);

-- Physical containment / adjacency (bed IN room, rooms CONNECT for suites).
CREATE TABLE space_relation (
  tenant_id uuid NOT NULL,
  parent_space uuid REFERENCES space(id), child_space uuid REFERENCES space(id),
  kind text NOT NULL CHECK (kind IN ('contains','connects')),
  PRIMARY KEY (parent_space, child_space, kind)
);

-- Commercial grouping for rates/availability ("room type"): DLX, DORM-BED, 2BR-APT.
CREATE TABLE unit_type (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL,
  property_node uuid NOT NULL REFERENCES org_node(id),
  code          text NOT NULL, name text NOT NULL,
  profile_key   text NOT NULL,
  base_occupancy smallint NOT NULL DEFAULT 2, max_occupancy smallint NOT NULL DEFAULT 2,
  attrs         jsonb NOT NULL DEFAULT '{}',
  sort_order    int NOT NULL DEFAULT 0,
  UNIQUE (tenant_id, property_node, code)
);

-- A sellable CONFIGURATION of one or more spaces (the composite-slot core):
--   'ROOM-101 private'          → exclusive on space 101
--   'DORM-A bed'                → positional (non-exclusive) on DORM-A
--   'Suite 101+102'             → exclusive on both
--   'DORM-A as private'         → exclusive on DORM-A (conflicts with beds — by claim)
CREATE TABLE sellable_unit (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL,
  unit_type_id  uuid NOT NULL REFERENCES unit_type(id),
  name          text NOT NULL,
  status        text NOT NULL DEFAULT 'active'
);
CREATE TABLE sellable_unit_space (
  tenant_id uuid NOT NULL,
  sellable_unit_id uuid REFERENCES sellable_unit(id),
  space_id uuid REFERENCES space(id),
  claim_mode text NOT NULL CHECK (claim_mode IN ('exclusive','positional')),
  PRIMARY KEY (sellable_unit_id, space_id)
);

-- ---------------------------------------------------------------------------
-- space_occupancy — THE integrity table. Claim-range design (prototype P1):
-- one declarative constraint covers private-vs-private, private-vs-bed,
-- bed-vs-bed. Capacity is declarative (positions 0..capacity-1).
-- PROVEN: 50-thread races → exactly-once winners; ~1,400 commits/sec.
-- ---------------------------------------------------------------------------
CREATE TABLE space_occupancy (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL,
  space_id      uuid NOT NULL REFERENCES space(id),
  period        tstzrange NOT NULL,
  slot_ref      uuid NOT NULL,       -- reservation_segment.id | hold.id | ooo.id
  slot_kind     text NOT NULL CHECK (slot_kind IN ('segment','hold','ooo')),
  exclusive     boolean NOT NULL,
  claim         int4range NOT NULL,
  CONSTRAINT claim_shape CHECK (
    (exclusive AND claim = int4range(0, NULL))
    OR (NOT exclusive AND lower(claim) >= 0 AND upper(claim) = lower(claim) + 1)),
  CONSTRAINT no_conflicting_claims EXCLUDE USING gist (
    tenant_id WITH =, space_id WITH =, period WITH &&, claim WITH &&)
);
CREATE INDEX so_space_period ON space_occupancy USING gist (tenant_id, space_id, period);
CREATE INDEX so_slot ON space_occupancy (tenant_id, slot_ref);

-- Single choke point (rule R5). SECURITY DEFINER; app role has EXECUTE only.
CREATE OR REPLACE FUNCTION record_occupancy(
  p_tenant uuid, p_space uuid, p_period tstzrange,
  p_slot uuid, p_slot_kind text, p_exclusive boolean
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

CREATE OR REPLACE FUNCTION release_occupancy(p_tenant uuid, p_slot uuid)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  DELETE FROM space_occupancy WHERE tenant_id = p_tenant AND slot_ref = p_slot;
  GET DIAGNOSTICS n = ROW_COUNT; RETURN n;
END $$;
-- Grants applied in §14 hardening block.

-- Holds: cart holds, OFFLINE PRE-LEASED POOL (v2 §5.1), manual blocks on a unit.
CREATE TABLE hold (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL,
  property_node uuid NOT NULL REFERENCES org_node(id),
  sellable_unit_id uuid NOT NULL REFERENCES sellable_unit(id),
  period        tstzrange NOT NULL,
  kind          text NOT NULL CHECK (kind IN ('cart','offline_lease','manual')),
  holder        jsonb NOT NULL DEFAULT '{}',         -- client id / user / device
  expires_at    timestamptz NOT NULL,
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active','consumed','expired','released'))
);
CREATE INDEX hold_expiry ON hold (expires_at) WHERE status = 'active';

CREATE TABLE restriction (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL,
  scope_node uuid NOT NULL REFERENCES org_node(id),
  unit_type_id uuid REFERENCES unit_type(id),        -- NULL = whole scope
  rate_plan_id uuid,                                 -- FK added in §5
  channel_code text,
  kind text NOT NULL CHECK (kind IN ('closed','cta','ctd','min_los','max_los','min_adv','max_adv')),
  value int,
  stay_dates daterange NOT NULL,
  source text NOT NULL DEFAULT 'manual'              -- manual|automation|rms
);
CREATE TABLE ooo_oos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL,
  space_id uuid NOT NULL REFERENCES space(id),
  kind text NOT NULL CHECK (kind IN ('ooo','oos')),  -- OOO removes from inventory (occupies);
  period tstzrange NOT NULL,                         -- OOS remains counted, not sellable
  reason text, work_order_task uuid REFERENCES task(id)
);
CREATE TABLE overbooking_limit (
  tenant_id uuid NOT NULL, property_node uuid REFERENCES org_node(id),
  unit_type_id uuid REFERENCES unit_type(id),        -- NULL = house level
  stay_dates daterange NOT NULL, extra int NOT NULL,
  PRIMARY KEY (property_node, unit_type_id, stay_dates)
);
-- Per-property/channel system-of-record mode (v2 §2.8).
CREATE TABLE inventory_authority (
  tenant_id uuid NOT NULL, property_node uuid REFERENCES org_node(id),
  channel_code text NOT NULL DEFAULT '*',
  mode text NOT NULL CHECK (mode IN ('pms','crs')),
  PRIMARY KEY (property_node, channel_code)
);
-- Derived read model (rebuildable; Valkey mirrors this — NEVER authoritative).
CREATE TABLE availability_projection (
  tenant_id uuid NOT NULL, property_node uuid NOT NULL,
  unit_type_id uuid NOT NULL, stay_date date NOT NULL,
  physical int NOT NULL, sold int NOT NULL, held int NOT NULL,
  blocked int NOT NULL, ooo int NOT NULL,
  available int GENERATED ALWAYS AS (physical - sold - held - blocked - ooo) STORED,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (property_node, unit_type_id, stay_date)
);

-- ============================================================================
-- §5  RATES, POLICIES, PACKAGES                              (Context 3)
-- ============================================================================
CREATE TABLE policy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('cancellation','guarantee','deposit','no_show','early_departure')),
  name text NOT NULL,
  content jsonb NOT NULL                             -- schema: EXTENSIONS.md §policy
);
CREATE TABLE rate_plan (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL,
  property_node uuid NOT NULL REFERENCES org_node(id),
  code          text NOT NULL, name text NOT NULL,
  currency      char(3) NOT NULL,
  tax_inclusive boolean NOT NULL DEFAULT true,
  cancellation_policy uuid REFERENCES policy(id),
  guarantee_policy    uuid REFERENCES policy(id),
  deposit_policy      uuid REFERENCES policy(id),
  parent_plan   uuid REFERENCES rate_plan(id),       -- derived rates
  derivation    jsonb,                               -- {op:'pct',value:-10} etc.
  market_code   text, source_code text,              -- statistical defaults
  status        text NOT NULL DEFAULT 'active',
  UNIQUE (tenant_id, property_node, code)
);
ALTER TABLE restriction ADD CONSTRAINT restriction_rate_fk
  FOREIGN KEY (rate_plan_id) REFERENCES rate_plan(id);

-- Insert-only bitemporal prices (fact_log pattern inlined for query speed).
CREATE TABLE rate_price (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL,
  rate_plan_id  uuid NOT NULL REFERENCES rate_plan(id),
  unit_type_id  uuid NOT NULL REFERENCES unit_type(id),
  stay_dates    daterange NOT NULL,                  -- valid-time (business)
  dow_mask      smallint NOT NULL DEFAULT 127,       -- bit 0=Mon .. 6=Sun
  pricing       jsonb NOT NULL,                      -- {occ:{"1":..,"2":..},extra_adult:..,extra_child:[{max_age,amount}]} minor units
  recorded_at   timestamptz NOT NULL DEFAULT now(),  -- transaction-time
  superseded_by uuid REFERENCES rate_price(id)       -- set ONLY by the superseding insert's txn
);
CREATE INDEX rate_lookup ON rate_price (tenant_id, rate_plan_id, unit_type_id, recorded_at DESC);
-- Current-rate hot path: partial indexes so live reads never wade through superseded history.
CREATE INDEX rate_current_lookup ON rate_price
  (tenant_id, rate_plan_id, unit_type_id, recorded_at DESC) WHERE superseded_by IS NULL;
CREATE INDEX rate_current_contain ON rate_price USING gist
  (tenant_id, rate_plan_id, unit_type_id, stay_dates) WHERE superseded_by IS NULL;  -- serves stay_dates @> :date
-- Deliberately NO range-overlap EXCLUDE here: overlapping stay_dates with disjoint dow_masks
-- (weekday vs weekend pricing over one season) is legitimate. Overlap precedence is
-- deterministic: latest recorded_at wins (see current_rate_price view).

CREATE TABLE package (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL,
  code text NOT NULL, name text NOT NULL, UNIQUE (tenant_id, code)
);
CREATE TABLE package_element (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL,
  package_id uuid NOT NULL REFERENCES package(id),
  tx_code text NOT NULL,                             -- posts to this transaction code
  rhythm text NOT NULL CHECK (rhythm IN ('per_stay','per_night','per_person','per_person_night')),
  amount_minor bigint NOT NULL, currency char(3) NOT NULL,
  allowance boolean NOT NULL DEFAULT false           -- consumed vs fixed (package ledger)
);
CREATE TABLE rate_plan_package (
  rate_plan_id uuid REFERENCES rate_plan(id), package_id uuid REFERENCES package(id),
  included_in_rate boolean NOT NULL DEFAULT true, PRIMARY KEY (rate_plan_id, package_id)
);
CREATE TABLE promotion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL,
  code text NOT NULL, discount jsonb NOT NULL, book_window tstzrange, stay_dates daterange,
  constraints jsonb NOT NULL DEFAULT '{}', UNIQUE (tenant_id, code)
);
CREATE TABLE negotiated_rate (
  tenant_id uuid NOT NULL, party_id uuid REFERENCES party(id),
  rate_plan_id uuid REFERENCES rate_plan(id), effective daterange NOT NULL,
  PRIMARY KEY (party_id, rate_plan_id)
);

-- ============================================================================
-- §6  RESERVATIONS & GROUPS                                  (Contexts 4, 9)
-- ============================================================================
CREATE TABLE reservation_group (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL,
  property_node uuid NOT NULL REFERENCES org_node(id),
  kind          text NOT NULL CHECK (kind IN ('linked','block','share')),
  code          text NOT NULL, name text,
  account_party uuid REFERENCES party(id),           -- company/agent behind a block
  status        text NOT NULL DEFAULT 'tentative',   -- def per block_status_def
  cutoff_date   date, elastic boolean NOT NULL DEFAULT false,
  wash_schedule jsonb,                               -- [{days_before,release_pct}]
  master_folio  uuid,                                -- FK to folio added §7
  UNIQUE (tenant_id, property_node, code)
);
-- Block status → inventory-deduction mapping is CONFIG, not code (OPERA lesson kept).
CREATE TABLE block_status_def (
  tenant_id uuid NOT NULL, code text, deducts boolean NOT NULL,
  sort int NOT NULL DEFAULT 0, PRIMARY KEY (tenant_id, code)
);
CREATE TABLE block_allotment (
  tenant_id uuid NOT NULL,
  group_id uuid REFERENCES reservation_group(id),
  unit_type_id uuid REFERENCES unit_type(id),
  stay_date date NOT NULL,
  blocked int NOT NULL, rate_override jsonb,
  PRIMARY KEY (group_id, unit_type_id, stay_date)
);

CREATE TABLE reservation (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL,
  property_node uuid NOT NULL REFERENCES org_node(id),
  confirmation_no text NOT NULL,
  status        text NOT NULL DEFAULT 'reserved' CHECK (status IN
    ('quote','reserved','waitlist','due_in','in_house','due_out','checked_out','cancelled','no_show')),
  primary_party uuid NOT NULL REFERENCES party(id),
  booker_party  uuid REFERENCES party(id),
  group_id      uuid REFERENCES reservation_group(id),
  channel_code  text NOT NULL DEFAULT 'direct',
  market_code   text, source_code text, origin_code text,
  currency      char(3) NOT NULL,
  guarantee_policy uuid REFERENCES policy(id),
  eta timetz, etd timetz,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  cancelled_at  timestamptz, cancel_reason text, cancellation_no text,
  UNIQUE (tenant_id, confirmation_no)
);
CREATE INDEX reservation_board ON reservation (tenant_id, property_node, status);

-- Stay legs: unit type, dates, rate; unit assigned later; MOVES = new segment.
CREATE TABLE reservation_segment (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL,
  reservation_id uuid NOT NULL REFERENCES reservation(id),
  seq           smallint NOT NULL,
  unit_type_id  uuid NOT NULL REFERENCES unit_type(id),
  sellable_unit_id uuid REFERENCES sellable_unit(id),-- NULL until assigned
  period        tstzrange NOT NULL,                  -- property-local checkin/out instants
  adults        smallint NOT NULL DEFAULT 1,
  children      jsonb NOT NULL DEFAULT '[]',         -- [{age}]
  rate_plan_id  uuid NOT NULL REFERENCES rate_plan(id),
  price_override jsonb,                              -- requires approval_request
  status        text NOT NULL DEFAULT 'booked' CHECK (status IN ('booked','in_house','departed','cancelled')),
  UNIQUE (reservation_id, seq)
);
CREATE INDEX segment_period ON reservation_segment USING gist (tenant_id, period);

CREATE TABLE reservation_guest (
  tenant_id uuid NOT NULL,
  reservation_id uuid REFERENCES reservation(id), party_id uuid REFERENCES party(id),
  role text NOT NULL DEFAULT 'accompanying' CHECK (role IN ('primary','accompanying','sharer')),
  share_pct numeric(5,2),                            -- sharers' rate split
  PRIMARY KEY (reservation_id, party_id)
);
CREATE TABLE alert (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL,
  subject_type text NOT NULL, subject_id uuid NOT NULL,
  code text, message text NOT NULL,
  show_on text NOT NULL DEFAULT 'always' CHECK (show_on IN ('checkin','checkout','always')),
  active boolean NOT NULL DEFAULT true
);
CREATE TABLE waitlist_entry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL,
  property_node uuid NOT NULL, unit_type_id uuid REFERENCES unit_type(id),
  stay_dates daterange NOT NULL, party_id uuid REFERENCES party(id),
  priority int NOT NULL DEFAULT 100, status text NOT NULL DEFAULT 'open'
);

-- ============================================================================
-- §7  FINANCIALS — accounts, folios, double-entry postings   (Context 7)
-- ============================================================================
CREATE TABLE account (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL,
  property_node uuid REFERENCES org_node(id),        -- NULL = tenant-level (AR HQ etc.)
  role          text NOT NULL CHECK (role IN (
    'guest','company','group_master','house','outlet','event','trust',
    'ar_control','cash','bank','card_clearing','upi_clearing',
    'revenue','tax_payable','deposit_liability','payable','fx')),
  party_id      uuid REFERENCES party(id),
  name          text NOT NULL,
  currency      char(3) NOT NULL,
  credit_limit_minor bigint,
  status        text NOT NULL DEFAULT 'open' CHECK (status IN ('open','frozen','closed')),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX account_party ON account (tenant_id, party_id) WHERE party_id IS NOT NULL;

-- Folio = a presentation window over an ACCOUNT (locked decision 2.1).
CREATE TABLE folio (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL,
  account_id    uuid NOT NULL REFERENCES account(id),
  reservation_id uuid REFERENCES reservation(id),    -- NULL for house/outlet/event folios
  folio_no      text,                                -- human-readable, quoted by staff/guests
  window_no     smallint NOT NULL DEFAULT 1,
  name          text,
  status        text NOT NULL DEFAULT 'open' CHECK (status IN ('open','settled','closed')),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX folio_no_uq ON folio (tenant_id, folio_no) WHERE folio_no IS NOT NULL;

-- Travel legs. Airport/city hotels sort arrivals by ETA and raise pickup tasks from
-- these rows, so mode/pickup/scheduled_at are predicates, not decoration.
CREATE TABLE travel_detail (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL,
  reservation_id uuid NOT NULL REFERENCES reservation(id),
  direction     text NOT NULL CHECK (direction IN ('arrival','departure')),
  mode          text CHECK (mode IN ('flight','train','bus','car','ferry','other')),
  carrier       text, service_no text,               -- 'Emirates', 'EK512'
  scheduled_at  timestamptz,
  pickup_requested boolean NOT NULL DEFAULT false,
  pickup_task_id uuid REFERENCES task(id),           -- automation-created transfer task
  notes         text,
  UNIQUE (tenant_id, reservation_id, direction)
);
CREATE INDEX travel_pickup ON travel_detail (tenant_id, scheduled_at)
  WHERE pickup_requested AND pickup_task_id IS NULL;

-- Vehicle register. Gated properties in India/Gulf run a security register; the
-- lookup is "whose car is this plate?", so reg_no is indexed. Parking SLOT is not
-- modelled here — a slot is a space with profile_key 'parking', assigned through
-- the same occupancy choke point as any other space.
CREATE TABLE vehicle (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL,
  property_node uuid NOT NULL REFERENCES org_node(id),
  reservation_id uuid REFERENCES reservation(id),
  party_id      uuid REFERENCES party(id),           -- staff/visitor vehicles have no reservation
  reg_no        text NOT NULL,
  make text, model text, colour text,
  driver_name   text,
  parking_space uuid REFERENCES space(id),           -- slot assignment (profile_key='parking')
  entered_at    timestamptz, exited_at timestamptz,
  notes         text
);
CREATE INDEX vehicle_reg ON vehicle (tenant_id, property_node, reg_no);
CREATE INDEX vehicle_onsite ON vehicle (tenant_id, property_node) WHERE exited_at IS NULL;
ALTER TABLE reservation_group ADD CONSTRAINT group_master_folio_fk
  FOREIGN KEY (master_folio) REFERENCES folio(id);

CREATE TABLE tx_code (
  code text PRIMARY KEY,
  name text NOT NULL,
  grp  text NOT NULL CHECK (grp IN ('revenue','payment','tax','adjustment','transfer','deposit','paidout')),
  usali_line text,                                   -- USALI 12th mapping (Context 13)
  default_dr text, default_cr text                   -- account.role hints for posting engine
);

-- Journal header. Every money movement is one balanced journal (R4: insert-only).
CREATE TABLE journal (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL,
  property_node uuid NOT NULL REFERENCES org_node(id),
  business_date date NOT NULL,
  kind          text NOT NULL CHECK (kind IN
    ('charge','payment','refund','adjustment','transfer','correction','deposit','paidout','close','fx')),
  description   text NOT NULL,
  currency      char(3) NOT NULL,                    -- single currency per journal
  reverses      uuid REFERENCES journal(id),         -- contra-entry linkage
  source        jsonb NOT NULL DEFAULT '{}',         -- {interface|automation|user, ref}
  created_by    uuid, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX journal_bdate ON journal (tenant_id, property_node, business_date);

CREATE TABLE posting_line (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL,
  journal_id    uuid NOT NULL REFERENCES journal(id),
  seq           smallint NOT NULL,
  account_id    uuid NOT NULL REFERENCES account(id),
  folio_id      uuid REFERENCES folio(id),           -- guest-visible side only
  tx_code       text NOT NULL REFERENCES tx_code(code),
  description   text,
  amount_minor  bigint NOT NULL,                     -- signed; SUM per journal must = 0
  quantity      numeric(10,3) NOT NULL DEFAULT 1,
  tax_detail    jsonb,                               -- computed tax breakdown
  business_date date NOT NULL,                       -- denorm for partitioning/stats
  UNIQUE (journal_id, seq)
);
CREATE INDEX posting_folio ON posting_line (tenant_id, folio_id) WHERE folio_id IS NOT NULL;
CREATE INDEX posting_acct  ON posting_line (tenant_id, account_id, business_date);

-- Double-entry invariant: per-journal sum must be zero (deferred to commit).
CREATE OR REPLACE FUNCTION assert_journal_balanced() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v bigint;
BEGIN
  SELECT COALESCE(sum(amount_minor),0) INTO v FROM posting_line WHERE journal_id = NEW.journal_id;
  IF v <> 0 THEN RAISE EXCEPTION 'journal % unbalanced by %', NEW.journal_id, v
    USING ERRCODE = 'P0010'; END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER journal_balanced
  AFTER INSERT ON posting_line DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION assert_journal_balanced();

CREATE TABLE payment_instrument (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL,
  party_id uuid REFERENCES party(id),
  kind text NOT NULL CHECK (kind IN ('card_network_token','upi_vpa','bank','cash_marker')),
  token text,                                        -- PSP/network token ONLY (no PAN, ever)
  brand text, last4 char(4), expiry text, psp text,
  status text NOT NULL DEFAULT 'active'
);
CREATE TABLE payment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL,
  journal_id uuid REFERENCES journal(id),
  instrument_id uuid REFERENCES payment_instrument(id),
  psp text, psp_ref text, method text NOT NULL,
  phase text NOT NULL CHECK (phase IN ('auth','capture','refund','void','incremental_auth')),
  amount_minor bigint NOT NULL, currency char(3) NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','succeeded','failed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE cashier_session (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL,
  property_node uuid NOT NULL, user_id uuid NOT NULL REFERENCES app_user(id),
  opened_at timestamptz NOT NULL DEFAULT now(), closed_at timestamptz,
  opening_float jsonb, counted jsonb, over_short_minor bigint
);

-- Continuous close: the seal (v2 §5.4). After sealed_at, only kind='adjustment'
-- journals may carry this business_date (enforced by trigger below).
CREATE TABLE business_day (
  tenant_id uuid NOT NULL, property_node uuid REFERENCES org_node(id),
  business_date date NOT NULL,
  opened_at timestamptz NOT NULL DEFAULT now(),
  sealed_at timestamptz, sealed_by uuid,
  PRIMARY KEY (property_node, business_date)
);
CREATE OR REPLACE FUNCTION assert_day_open() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_sealed timestamptz;
BEGIN
  SELECT sealed_at INTO v_sealed FROM business_day
   WHERE property_node = NEW.property_node AND business_date = NEW.business_date;
  IF v_sealed IS NOT NULL AND NEW.kind NOT IN ('adjustment','correction') THEN
    RAISE EXCEPTION 'business date % sealed', NEW.business_date USING ERRCODE='P0011';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER journal_day_open BEFORE INSERT ON journal
  FOR EACH ROW EXECUTE FUNCTION assert_day_open();

-- AR: invoice = document(kind='invoice'); allocation matches receipts to them.
CREATE TABLE ar_allocation (
  tenant_id uuid NOT NULL,
  invoice_doc uuid REFERENCES document(id),
  payment_journal uuid REFERENCES journal(id),
  amount_minor bigint NOT NULL,
  PRIMARY KEY (invoice_doc, payment_journal)
);

-- ============================================================================
-- §8  HOUSEKEEPING & STAY OPS                                (Contexts 5, 6)
-- ============================================================================
CREATE TABLE unit_condition (
  tenant_id uuid NOT NULL,
  space_id uuid PRIMARY KEY REFERENCES space(id),
  condition text NOT NULL DEFAULT 'clean' CHECK (condition IN ('clean','dirty','pickup','inspected')),
  updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid
);
CREATE TABLE task_sheet (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL,
  property_node uuid NOT NULL, sheet_date date NOT NULL,
  attendant_party uuid REFERENCES party(id), target_credits smallint
);
CREATE TABLE discrepancy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL,
  space_id uuid NOT NULL REFERENCES space(id),
  reported text NOT NULL, system_state text NOT NULL,   -- sleep / skip
  reported_by uuid, reported_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz, resolution text
);
CREATE TABLE queue_entry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL,
  segment_id uuid NOT NULL REFERENCES reservation_segment(id),
  queued_at timestamptz NOT NULL DEFAULT now(), priority int NOT NULL DEFAULT 100,
  cleared_at timestamptz
);
CREATE TABLE message (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL,
  thread_key text NOT NULL,                          -- party or reservation scoped
  direction text NOT NULL CHECK (direction IN ('in','out')),
  channel text NOT NULL,                             -- email|whatsapp|sms|inapp
  party_id uuid REFERENCES party(id), reservation_id uuid REFERENCES reservation(id),
  body text NOT NULL, meta jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX message_thread ON message (tenant_id, thread_key, created_at);

-- ============================================================================
-- §9  DISTRIBUTION                                           (Context 10)
-- ============================================================================
CREATE TABLE channel (
  code text PRIMARY KEY,                             -- booking_com|expedia|direct|gds|...
  name text NOT NULL,
  adapter_extension text                             -- extension(channel_adapter).key
);
CREATE TABLE channel_map (
  tenant_id uuid NOT NULL, property_node uuid REFERENCES org_node(id),
  channel_code text REFERENCES channel(code),
  kind text NOT NULL CHECK (kind IN ('unit_type','rate_plan')),
  internal_id uuid NOT NULL, external_code text NOT NULL,
  PRIMARY KEY (property_node, channel_code, kind, internal_id)
);
-- Idempotent inbound store: raw first, process after (replayable).
CREATE TABLE inbound_message (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL,
  channel_code text NOT NULL REFERENCES channel(code),
  external_id text NOT NULL,
  payload jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received','processed','error','ignored')),
  error text, processed_at timestamptz,
  UNIQUE (channel_code, external_id)
);
CREATE TABLE push_cursor (
  tenant_id uuid NOT NULL, property_node uuid, channel_code text REFERENCES channel(code),
  last_outbox_seq bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (property_node, channel_code)
);

-- ============================================================================
-- §10 TAX, FISCAL, STATUTORY, DATA PROTECTION               (Contexts 11, 12)
-- ============================================================================
-- Jurisdiction rules & providers live in extension (§2). These bind them:
CREATE TABLE tax_assignment (
  tenant_id uuid NOT NULL, property_node uuid REFERENCES org_node(id),
  jurisdiction_key text NOT NULL,                    -- extension(tax_jurisdiction).key
  effective daterange NOT NULL,
  PRIMARY KEY (property_node, effective)
);
CREATE TABLE fiscal_submission (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL,
  document_id uuid NOT NULL REFERENCES document(id),
  provider_key text NOT NULL,                        -- 'sa-zatca'|'in-irp'|'ae-asp:<name>'
  mode text NOT NULL CHECK (mode IN ('clearance','reporting','peppol','exchange')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','submitted','cleared','accepted','rejected','error')),
  authority_ref text, qr_payload text, response jsonb,
  submitted_at timestamptz, resolved_at timestamptz
);
CREATE TABLE statutory_submission (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL,
  property_node uuid NOT NULL,
  reservation_id uuid NOT NULL REFERENCES reservation(id),
  adapter_key text NOT NULL,                         -- 'it-alloggiati'|'in-form-c'|...
  due_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','submitted','accepted','failed','not_required')),
  payload jsonb, receipt jsonb,
  submitted_at timestamptz
);
CREATE TABLE erasure_request (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL,
  party_id uuid NOT NULL REFERENCES party(id),
  requested_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','anonymised','rejected')),
  resolved_at timestamptz, note text                 -- anonymise, NEVER delete postings (v2 §6.2)
);

-- ============================================================================
-- §11 REPORTING PROJECTIONS                                  (Context 13)
-- ============================================================================
CREATE TABLE stats_daily (
  tenant_id uuid NOT NULL, property_node uuid NOT NULL,
  business_date date NOT NULL,
  unit_type_id uuid, market_code text, source_code text, channel_code text,
  rooms_available int NOT NULL DEFAULT 0, rooms_sold int NOT NULL DEFAULT 0,
  arrivals int NOT NULL DEFAULT 0, departures int NOT NULL DEFAULT 0, no_shows int NOT NULL DEFAULT 0,
  room_revenue_minor bigint NOT NULL DEFAULT 0,
  fnb_revenue_minor bigint NOT NULL DEFAULT 0,
  other_revenue_minor bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (property_node, business_date, unit_type_id, market_code, source_code, channel_code)
);

-- ============================================================================
-- §12 OFFLINE LEASE SWEEP + HELPERS
-- ============================================================================
-- Published events past the replay window are dead weight; NATS JetStream retains the
-- stream anyway. Run nightly. Replay window = retention interval.
CREATE OR REPLACE FUNCTION prune_outbox(p_retain interval DEFAULT interval '30 days')
RETURNS bigint LANGUAGE sql SECURITY DEFINER AS $$
  WITH gone AS (
    DELETE FROM outbox
     WHERE published_at IS NOT NULL AND published_at < now() - p_retain
    RETURNING 1)
  SELECT count(*) FROM gone;
$$;

CREATE OR REPLACE FUNCTION expire_holds() RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

-- Seal a business date (continuous close). Validations live app-side; this is the latch.
CREATE OR REPLACE FUNCTION seal_business_day(p_tenant uuid, p_property uuid, p_date date, p_user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE business_day SET sealed_at = now(), sealed_by = p_user
   WHERE tenant_id = p_tenant AND property_node = p_property
     AND business_date = p_date AND sealed_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'day missing or already sealed' USING ERRCODE='P0012'; END IF;
END $$;

-- ============================================================================
-- §13 CURRENT-STATE VIEWS (the "current is a query" doctrine, made convenient)
-- ============================================================================
CREATE VIEW current_rate_price WITH (security_invoker = true) AS
  SELECT DISTINCT ON (tenant_id, rate_plan_id, unit_type_id, stay_dates, dow_mask) *
  FROM rate_price WHERE superseded_by IS NULL
  ORDER BY tenant_id, rate_plan_id, unit_type_id, stay_dates, dow_mask, recorded_at DESC;

CREATE VIEW folio_balance WITH (security_invoker = true) AS
  SELECT tenant_id, folio_id, sum(amount_minor) AS balance_minor, count(*) AS lines
  FROM posting_line WHERE folio_id IS NOT NULL GROUP BY tenant_id, folio_id;

-- ============================================================================
-- §14 HARDENING: roles, choke-point grants, RLS EVERYWHERE
-- ============================================================================
-- VIEWS BYPASS RLS by default (they execute with their OWNER's privileges, and
-- owners skip row security). Proven leak in testing: a tenant session read every
-- tenant's rates through current_rate_price until security_invoker was set.
-- This loop makes the fix structural — any view added later is caught too.
DO $views$
DECLARE v record;
BEGIN
  FOR v IN SELECT viewname FROM pg_views WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER VIEW %I SET (security_invoker = true)', v.viewname);
  END LOOP;
END $views$;

DO $harden$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='app_role') THEN
    CREATE ROLE app_role LOGIN;
  END IF;
END $harden$;

GRANT USAGE ON SCHEMA public TO app_role;
GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA public TO app_role;
GRANT UPDATE ON tenant, org_node, app_user, role, role_permission, user_role, api_client,
  approval_request, extension, party, party_role, contact_point, address, identity_document,
  party_relationship, membership, preference, consent, space, space_relation, unit_type,
  sellable_unit, sellable_unit_space, hold, restriction, ooo_oos, overbooking_limit,
  inventory_authority, availability_projection, policy, rate_plan, package, package_element,
  rate_plan_package, promotion, negotiated_rate, reservation_group, block_status_def,
  block_allotment, reservation, reservation_segment, reservation_guest, alert, waitlist_entry,
  account, folio, payment_instrument, payment, cashier_session, business_day, task, task_sheet,
  unit_condition, discrepancy, queue_entry, channel_map, inbound_message, push_cursor,
  document_series, document, fiscal_submission, statutory_submission, erasure_request,
  stats_daily, automation, ar_allocation, rate_price, travel_detail, vehicle
  TO app_role;
-- R4 insert-only enforcement + R5 choke point:
REVOKE UPDATE, DELETE ON fact_log, outbox, journal, posting_line FROM app_role;
REVOKE INSERT, UPDATE, DELETE ON space_occupancy FROM app_role;
GRANT UPDATE (published_at) ON outbox TO app_role;            -- relay marks published
GRANT UPDATE (superseded_by) ON rate_price TO app_role;       -- the ONE sanctioned update
REVOKE ALL ON FUNCTION record_occupancy(uuid,uuid,tstzrange,uuid,text,boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION release_occupancy(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_occupancy(uuid,uuid,tstzrange,uuid,text,boolean) TO app_role;
GRANT EXECUTE ON FUNCTION release_occupancy(uuid,uuid) TO app_role;
GRANT EXECUTE ON FUNCTION expire_holds(), prune_outbox(interval), seal_business_day(uuid,uuid,date,uuid) TO app_role;

-- RLS on every tenant-scoped table. set_config('app.tenant_id', <uuid>, true)
-- — transaction-local TRUE is mandatory under PgBouncer (locked decision 2.5).
DO $rls$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT c.table_name FROM information_schema.columns c
    JOIN information_schema.tables tb
      ON tb.table_name = c.table_name AND tb.table_schema='public' AND tb.table_type='BASE TABLE'
    WHERE c.table_schema='public' AND c.column_name='tenant_id'
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t.table_name);
    EXECUTE format($p$CREATE POLICY tenant_isolation ON %I
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)$p$, t.table_name);
  END LOOP;
END $rls$;
-- ============================================================================
-- END OF SCHEMA v1.0 — 60+ tables, 13 contexts, every locked decision encoded.
-- ============================================================================
