-- Order 150: replace inherited blanket app-role mutation with the exact current
-- direct-SQL caller catalogue. This is transitional mitigation; protected
-- lifecycle transitions named in docs/SECURITY.md remain capability debt.

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM app_role;
REVOKE UPDATE (published_at) ON public.outbox FROM app_role;
REVOKE UPDATE (superseded_by) ON public.rate_price FROM app_role;

-- Future yellow_owner migration relations receive no implicit runtime mutation.
ALTER DEFAULT PRIVILEGES FOR ROLE yellow_owner IN SCHEMA public
  REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLES FROM app_role;
-- Trigger functions do not require caller EXECUTE after trigger creation.
REVOKE ALL ON FUNCTION public.assert_journal_balanced() FROM PUBLIC, app_role, yellow_runtime;
REVOKE ALL ON FUNCTION public.derive_posting_line_currency() FROM PUBLIC, app_role, yellow_runtime;
-- Exact direct INSERT callers.
GRANT INSERT (tenant_id, kind, subject_type, subject_id, requested_by, payload)
  ON public.approval_request TO app_role;
GRANT INSERT (type, json_schema) ON public.extension_type TO app_role;
GRANT INSERT (tenant_id, type, key, version, content, status)
  ON public.extension TO app_role;
GRANT INSERT (tenant_id, entity_type, entity_id, fact_type, valid_from, business_date, actor_id, payload, supersedes)
  ON public.fact_log TO app_role;
GRANT INSERT (tenant_id, operation, key_hash, request_hash, created_at, expires_at)
  ON public.api_idempotency TO app_role;
GRANT INSERT (tenant_id, property_node, business_date, aggregate_type, aggregate_id, event_type, event_version, actor_id, correlation_id, causation_id, payload)
  ON public.outbox TO app_role;

GRANT INSERT (tenant_id, kind, display_name, legal_name) ON public.party TO app_role;
GRANT INSERT (tenant_id, party_id, role) ON public.party_role TO app_role;
GRANT INSERT (tenant_id, party_id, kind, value, is_primary, verified)
  ON public.contact_point TO app_role;

GRANT INSERT (tenant_id, property_node, sellable_unit_id, period, kind, holder, expires_at)
  ON public.hold TO app_role;
GRANT INSERT (tenant_id, property_node, unit_type_id, stay_date, physical, sold, held, blocked, ooo, updated_at)
  ON public.availability_projection TO app_role;
GRANT INSERT (tenant_id, scope_node, unit_type_id, rate_plan_id, channel_code, kind, value, stay_dates, source)
  ON public.restriction TO app_role;
GRANT INSERT (tenant_id, property_node, code, name, profile_key, base_occupancy, max_occupancy, attrs, sort_order)
  ON public.unit_type TO app_role;
GRANT INSERT (tenant_id, property_node, code, profile_key, capacity, max_occupancy, floor, area_sqm, gender_policy, attrs)
  ON public.space TO app_role;
GRANT INSERT (tenant_id, unit_type_id, name) ON public.sellable_unit TO app_role;
GRANT INSERT (tenant_id, sellable_unit_id, space_id, claim_mode)
  ON public.sellable_unit_space TO app_role;
GRANT INSERT (tenant_id, space_id, kind, period, reason) ON public.ooo_oos TO app_role;

GRANT INSERT (tenant_id, kind, name, content) ON public.policy TO app_role;
GRANT INSERT (tenant_id, property_node, code, name, currency, tax_inclusive, cancellation_policy, guarantee_policy, deposit_policy, market_code, source_code)
  ON public.rate_plan TO app_role;
GRANT INSERT (tenant_id, rate_plan_id, unit_type_id, stay_dates, dow_mask, pricing)
  ON public.rate_price TO app_role;

GRANT INSERT (id, tenant_id, property_node, confirmation_no, status, primary_party, channel_code, market_code, source_code, currency, guarantee_policy)
  ON public.reservation TO app_role;
GRANT INSERT (id, tenant_id, reservation_id, seq, unit_type_id, sellable_unit_id, period, adults, children, rate_plan_id, price_override, status)
  ON public.reservation_segment TO app_role;
GRANT INSERT (tenant_id, reservation_id, party_id, role, share_pct)
  ON public.reservation_guest TO app_role;

GRANT INSERT (tenant_id, property_node, role, party_id, name, currency, status)
  ON public.account TO app_role;
GRANT INSERT (tenant_id, account_id, reservation_id, folio_no, window_no, name, status)
  ON public.folio TO app_role;
GRANT INSERT (tenant_id, property_node, business_date, kind, description, currency, source, created_by)
  ON public.journal TO app_role;
GRANT INSERT (tenant_id, journal_id, seq, account_id, folio_id, tx_code, description, amount_minor, quantity, business_date, currency)
  ON public.posting_line TO app_role;

-- Exact direct UPDATE columns. Full-table UPDATE stays absent.
GRANT UPDATE (status, decided_by, decided_at) ON public.approval_request TO app_role;
GRANT UPDATE (status) ON public.extension TO app_role;
GRANT UPDATE (request_hash, response_status, response_body, created_at, completed_at, expires_at)
  ON public.api_idempotency TO app_role;
GRANT UPDATE (status) ON public.hold TO app_role;
GRANT UPDATE (config) ON public.org_node TO app_role;
GRANT UPDATE (period) ON public.ooo_oos TO app_role;
GRANT UPDATE (superseded_by) ON public.rate_price TO app_role;
GRANT UPDATE (notes, eta, etd, market_code, source_code, origin_code, status, cancelled_at, cancel_reason, cancellation_no)
  ON public.reservation TO app_role;
GRANT UPDATE (period, status) ON public.reservation_segment TO app_role;
GRANT UPDATE (role, share_pct) ON public.reservation_guest TO app_role;
GRANT UPDATE (next_no) ON public.document_series TO app_role;

-- Exact row-removal callers for derived/replacement state only.
GRANT DELETE ON public.availability_projection TO app_role;
GRANT DELETE ON public.reservation_guest TO app_role;
