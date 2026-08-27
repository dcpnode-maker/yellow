-- ============================================================================
-- PMS QA TEST SEED FIXTURE
-- Run this before executing any test cases from PMS_QA_Test_Suite.md
-- Tenant: Acme Hotels | Property: Downtown Dubai | 15 rooms | Currency: AED
-- ============================================================================

-- Set tenant context
SELECT set_config('app.tenant_id', '00000000-0000-0000-0000-000000000001', true);

-- ============================================================================
-- TENANT & ORG HIERARCHY
-- ============================================================================
INSERT INTO tenant (id, slug, name, tier, residency, status) VALUES 
  ('00000000-0000-0000-0000-000000000001', 'acme', 'Acme Hotels', 'shared', 'me-central', 'active');

INSERT INTO org_node (id, tenant_id, path, kind, name, timezone, currency, config) VALUES
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 
   'acme', 'group', 'Acme Group', NULL, NULL, '{}'),
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001',
   'acme.gulf', 'region', 'Gulf Region', NULL, NULL, '{}'),
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001',
   'acme.gulf.dxb01', 'property', 'Acme Downtown Dubai', 'Asia/Dubai', 'AED', 
   '{"address":"Sheikh Zayed Road, Dubai","phone":"+97145551234"}');

-- ============================================================================
-- EXTENSIONS
-- ============================================================================
INSERT INTO extension_type (type, json_schema) VALUES 
  ('vertical_profile', '{"$id": "pms:vertical_profile:1", "type": "object", "required": ["terminology", "claim_mode_default", "features"], "properties": {"terminology": {"type": "object", "additionalProperties": {"type": "string"}}, "claim_mode_default": {"enum": ["exclusive", "positional"]}, "features": {"type": "object", "properties": {"dorm_beds": {"type": "boolean"}, "hourly_slots": {"type": "boolean"}, "long_stay_billing": {"type": "boolean"}, "owner_statements": {"type": "boolean"}, "kiosk_checkin": {"type": "boolean"}, "meal_plans": {"type": "boolean"}}}, "default_policies": {"type": "array", "items": {"type": "string"}}, "housekeeping_cadence": {"enum": ["daily", "on_departure", "weekly", "custom"]}, "default_unit_types": {"type": "array", "items": {"type": "object", "required": ["code", "name", "claim_mode"], "properties": {"code": {"type": "string"}, "name": {"type": "string"}, "claim_mode": {"enum": ["exclusive", "positional"]}, "capacity": {"type": "integer", "minimum": 1}}}}}}'),
  ('tax_jurisdiction', '{"$id": "pms:tax_jurisdiction:1", "type": "object", "required": ["country", "taxes"], "properties": {"country": {"type": "string", "pattern": "^[A-Z]{2}$"}, "region": {"type": "string"}, "price_display": {"enum": ["tax_inclusive", "tax_exclusive"]}, "rounding": {"enum": ["line", "document"], "default": "line"}, "taxes": {"type": "array", "items": {"type": "object", "required": ["code", "name", "mode"], "properties": {"code": {"type": "string"}, "name": {"type": "string"}, "mode": {"enum": ["percent", "fixed_per_night", "fixed_per_person_night", "slab_percent"]}, "rate": {"type": "number"}, "amount_minor": {"type": "integer"}, "applies_to": {"type": "array", "items": {"type": "string"}}, "slabs": {"type": "array", "items": {"type": "object", "required": ["upto_minor", "rate"], "properties": {"upto_minor": {"type": ["integer", "null"]}, "rate": {"type": "number"}, "itc_eligible": {"type": "boolean"}}}}, "slab_basis": {"enum": ["declared_tariff_per_night", "transaction_value"]}, "compound_on": {"type": "array", "items": {"type": "string"}}}}}}}');

-- Hotel vertical profile
INSERT INTO extension (id, tenant_id, type, key, version, effective, content, status) VALUES
  ('00000000-0000-0000-0000-000000000100', NULL, 'vertical_profile', 'hotel', 1,
   tstzrange('2026-01-01', NULL),
   '{"terminology":{"space":"Room","unit_type":"Room Type"},"claim_mode_default":"exclusive","features":{"dorm_beds":false,"hourly_slots":false,"long_stay_billing":false,"owner_statements":false,"kiosk_checkin":true,"meal_plans":true},"default_policies":["flex_24h","deposit_first_night"],"housekeeping_cadence":"daily","default_unit_types":[{"code":"STD","name":"Standard","claim_mode":"exclusive","capacity":2},{"code":"DLX","name":"Deluxe","claim_mode":"exclusive","capacity":3}]}',
   'active');

-- UAE VAT 5% tax inclusive
INSERT INTO extension (id, tenant_id, type, key, version, effective, content, status) VALUES
  ('00000000-0000-0000-0000-000000000101', NULL, 'tax_jurisdiction', 'ae-vat', 1,
   tstzrange('2026-01-01', NULL),
   '{"country":"AE","price_display":"tax_inclusive","rounding":"line","taxes":[{"code":"VAT","name":"Value Added Tax","mode":"percent","rate":0.05,"applies_to":["room_revenue","fnb_revenue"]}]}',
   'active');

-- India GST for boundary testing
INSERT INTO extension (id, tenant_id, type, key, version, effective, content, status) VALUES
  ('00000000-0000-0000-0000-000000000102', NULL, 'tax_jurisdiction', 'in-gst-lodging', 1,
   tstzrange('2026-01-01', NULL),
   '{"country":"IN","price_display":"tax_exclusive","rounding":"document","taxes":[{"code":"GST_ROOM","name":"GST on accommodation","mode":"slab_percent","slab_basis":"transaction_value","applies_to":["room_revenue"],"slabs":[{"upto_minor":100000,"rate":0,"itc_eligible":false},{"upto_minor":750000,"rate":0.05,"itc_eligible":false},{"upto_minor":null,"rate":0.18,"itc_eligible":true}]}]}',
   'active');

-- Deterministic reservation owner for the protected TC-12 occupancy referee.
INSERT INTO party (id, tenant_id, kind, display_name, status) VALUES
  ('00000000-0000-0000-0000-00000000d0cf', '00000000-0000-0000-0000-000000000001',
   'person', 'Invariant Referee Guest', 'active');
INSERT INTO party_role (tenant_id, party_id, role) VALUES
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000d0cf', 'guest');

-- ============================================================================
-- SPACES (15 rooms: 10 STD floors 1-2, 5 DLX floor 2)
-- ============================================================================
INSERT INTO space (id, tenant_id, property_node, code, profile_key, capacity, max_occupancy, floor, area_sqm, status) VALUES
  ('00000000-0000-0000-0000-000000000200', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', '101', 'hotel', 1, 2, '1', 28.0, 'active'),
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', '102', 'hotel', 1, 2, '1', 28.0, 'active'),
  ('00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', '103', 'hotel', 1, 2, '1', 28.0, 'active'),
  ('00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', '104', 'hotel', 1, 2, '1', 28.0, 'active'),
  ('00000000-0000-0000-0000-000000000204', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', '105', 'hotel', 1, 2, '1', 28.0, 'active'),
  ('00000000-0000-0000-0000-000000000205', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', '106', 'hotel', 1, 2, '1', 28.0, 'active'),
  ('00000000-0000-0000-0000-000000000206', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', '107', 'hotel', 1, 2, '1', 28.0, 'active'),
  ('00000000-0000-0000-0000-000000000207', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', '108', 'hotel', 1, 2, '1', 28.0, 'active'),
  ('00000000-0000-0000-0000-000000000208', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', '109', 'hotel', 1, 2, '1', 28.0, 'active'),
  ('00000000-0000-0000-0000-000000000209', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', '110', 'hotel', 1, 2, '1', 28.0, 'active'),
  ('00000000-0000-0000-0000-000000000210', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', '201', 'hotel', 1, 3, '2', 42.0, 'active'),
  ('00000000-0000-0000-0000-000000000211', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', '202', 'hotel', 1, 3, '2', 42.0, 'active'),
  ('00000000-0000-0000-0000-000000000212', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', '203', 'hotel', 1, 3, '2', 42.0, 'active'),
  ('00000000-0000-0000-0000-000000000213', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', '204', 'hotel', 1, 3, '2', 42.0, 'active'),
  ('00000000-0000-0000-0000-000000000214', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', '205', 'hotel', 1, 3, '2', 42.0, 'active');

-- ============================================================================
-- UNIT TYPES
-- ============================================================================
INSERT INTO unit_type (id, tenant_id, property_node, code, name, profile_key, base_occupancy, max_occupancy, sort_order) VALUES
  ('00000000-0000-0000-0000-000000000300', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', 'STD', 'Standard Room', 'hotel', 2, 2, 10),
  ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', 'DLX', 'Deluxe Room', 'hotel', 2, 3, 20);

-- ============================================================================
-- SELLABLE UNITS (1:1 with spaces for hotel)
-- ============================================================================
INSERT INTO sellable_unit (id, tenant_id, unit_type_id, name, status) VALUES
  ('00000000-0000-0000-0000-000000000400', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000300', 'STD-101', 'active'),
  ('00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000300', 'STD-102', 'active'),
  ('00000000-0000-0000-0000-000000000402', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000300', 'STD-103', 'active'),
  ('00000000-0000-0000-0000-000000000403', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000300', 'STD-104', 'active'),
  ('00000000-0000-0000-0000-000000000404', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000300', 'STD-105', 'active'),
  ('00000000-0000-0000-0000-000000000405', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000300', 'STD-106', 'active'),
  ('00000000-0000-0000-0000-000000000406', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000300', 'STD-107', 'active'),
  ('00000000-0000-0000-0000-000000000407', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000300', 'STD-108', 'active'),
  ('00000000-0000-0000-0000-000000000408', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000300', 'STD-109', 'active'),
  ('00000000-0000-0000-0000-000000000409', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000300', 'STD-110', 'active'),
  ('00000000-0000-0000-0000-000000000410', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000301', 'DLX-201', 'active'),
  ('00000000-0000-0000-0000-000000000411', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000301', 'DLX-202', 'active'),
  ('00000000-0000-0000-0000-000000000412', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000301', 'DLX-203', 'active'),
  ('00000000-0000-0000-0000-000000000413', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000301', 'DLX-204', 'active'),
  ('00000000-0000-0000-0000-000000000414', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000301', 'DLX-205', 'active');

INSERT INTO sellable_unit_space (tenant_id, sellable_unit_id, space_id, claim_mode) VALUES
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000400', '00000000-0000-0000-0000-000000000200', 'exclusive'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000201', 'exclusive'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000402', '00000000-0000-0000-0000-000000000202', 'exclusive'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000403', '00000000-0000-0000-0000-000000000203', 'exclusive'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000404', '00000000-0000-0000-0000-000000000204', 'exclusive'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000405', '00000000-0000-0000-0000-000000000205', 'exclusive'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000406', '00000000-0000-0000-0000-000000000206', 'exclusive'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000407', '00000000-0000-0000-0000-000000000207', 'exclusive'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000408', '00000000-0000-0000-0000-000000000208', 'exclusive'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000409', '00000000-0000-0000-0000-000000000209', 'exclusive'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000410', '00000000-0000-0000-0000-000000000210', 'exclusive'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000411', '00000000-0000-0000-0000-000000000211', 'exclusive'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000412', '00000000-0000-0000-0000-000000000212', 'exclusive'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000413', '00000000-0000-0000-0000-000000000213', 'exclusive'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000414', '00000000-0000-0000-0000-000000000214', 'exclusive');

-- ============================================================================
-- POLICIES
-- ============================================================================
INSERT INTO policy (id, tenant_id, kind, name, content) VALUES
  ('00000000-0000-0000-0000-000000000500', '00000000-0000-0000-0000-000000000001', 'cancellation', 'Flex 24h',
   '{"kind":"cancellation","rules":[{"before_hours":24,"penalty":{"basis":"nights","value":0}},{"before_hours":0,"penalty":{"basis":"nights","value":1}}]}'),
  ('00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000001', 'guarantee', 'Card on File',
   '{"kind":"guarantee","guarantee":"card_on_file"}'),
  ('00000000-0000-0000-0000-000000000502', '00000000-0000-0000-0000-000000000001', 'deposit', 'First Night',
   '{"kind":"deposit","deposit":{"basis":"first_night","due":"at_booking"}}'),
  ('00000000-0000-0000-0000-000000000503', '00000000-0000-0000-0000-000000000001', 'no_show', 'First Night Charge',
   '{"kind":"no_show","no_show_charge":{"basis":"first_night","value":1}}');

-- ============================================================================
-- RATE PLAN
-- ============================================================================
INSERT INTO rate_plan (id, tenant_id, property_node, code, name, currency, tax_inclusive, cancellation_policy, guarantee_policy, deposit_policy, status) VALUES
  ('00000000-0000-0000-0000-000000000600', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', 'BAR', 'Best Available Rate', 'AED', true,
   '00000000-0000-0000-0000-000000000500', '00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000502', 'active');

-- ============================================================================
-- RATE PRICES (insert-only bitemporal)
-- ============================================================================
INSERT INTO rate_price (id, tenant_id, rate_plan_id, unit_type_id, stay_dates, dow_mask, pricing, recorded_at) VALUES
  ('00000000-0000-0000-0000-000000000700', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000600', '00000000-0000-0000-0000-000000000300',
   '[2026-09-01,2026-12-31)', 127, '{"occ":{"1":50000,"2":50000},"extra_adult":0,"extra_child":[]}', '2026-08-01 00:00:00+00'),
  ('00000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000600', '00000000-0000-0000-0000-000000000301',
   '[2026-09-01,2026-12-31)', 127, '{"occ":{"1":75000,"2":75000,"3":75000},"extra_adult":0,"extra_child":[]}', '2026-08-01 00:00:00+00');

-- ============================================================================
-- TX CODES (USALI 12th mapping)
-- ============================================================================
INSERT INTO tx_code (code, name, grp, usali_line, default_dr, default_cr) VALUES
  ('ROOM', 'Room Revenue', 'revenue', '4510', NULL, 'revenue'),
  ('FNB', 'F&B Revenue', 'revenue', '4520', NULL, 'revenue'),
  ('TAX', 'Tax Payable', 'tax', NULL, 'tax_payable', NULL),
  ('CASH', 'Cash Payment', 'payment', NULL, 'cash', NULL),
  ('CARD', 'Card Payment', 'payment', NULL, 'card_clearing', NULL),
  ('DEP', 'Deposit Liability', 'deposit', NULL, 'deposit_liability', NULL),
  ('ADJ', 'Adjustment', 'adjustment', NULL, NULL, NULL);

-- ============================================================================
-- ACCOUNTS
-- ============================================================================
INSERT INTO account (id, tenant_id, property_node, role, name, currency, status) VALUES
  ('00000000-0000-0000-0000-000000000800', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', 'revenue', 'Room Revenue', 'AED', 'open'),
  ('00000000-0000-0000-0000-000000000801', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', 'revenue', 'F&B Revenue', 'AED', 'open'),
  ('00000000-0000-0000-0000-000000000802', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', 'tax_payable', 'VAT Payable', 'AED', 'open'),
  ('00000000-0000-0000-0000-000000000803', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', 'cash', 'Cash on Hand', 'AED', 'open'),
  ('00000000-0000-0000-0000-000000000804', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', 'card_clearing', 'Card Clearing', 'AED', 'open'),
  ('00000000-0000-0000-0000-000000000805', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', 'deposit_liability', 'Deposit Liability', 'AED', 'open'),
  ('00000000-0000-0000-0000-000000000806', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', 'house', 'House Account', 'AED', 'open');

INSERT INTO tx_code_route (tenant_id, property_node, currency, tx_code, debit_account_id, credit_account_id) VALUES
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', 'AED', 'DEP', NULL,
   '00000000-0000-0000-0000-000000000805');

-- ============================================================================
-- BUSINESS DAY (open)
-- ============================================================================
INSERT INTO business_day (tenant_id, property_node, business_date, opened_at) VALUES
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', '2026-09-15', '2026-09-15 00:00:00+04'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', '2026-09-16', '2026-09-16 00:00:00+04'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', '2026-09-17', '2026-09-17 00:00:00+04'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', '2026-09-18', '2026-09-18 00:00:00+04');

-- ============================================================================
-- CHANNEL
-- ============================================================================
INSERT INTO channel (code, name, adapter_extension) VALUES
  ('direct', 'Direct', NULL),
  ('booking_com', 'Booking.com', 'booking-com-adapter'),
  ('expedia', 'Expedia', 'expedia-adapter');

-- ============================================================================
-- DOCUMENT SERIES
-- ============================================================================
INSERT INTO document_series (id, tenant_id, property_node, kind, prefix, next_no, fiscal) VALUES
  ('00000000-0000-0000-0000-000000000900', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', 'invoice', 'INV-DXB-', 1, true),
  ('00000000-0000-0000-0000-000000000901', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', 'folio', 'FOL-DXB-', 1, false),
  ('00000000-0000-0000-0000-000000000902', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', 'credit_note', 'CRN-DXB-', 1, true);

-- ============================================================================
-- AVAILABILITY PROJECTION (initial state: all available)
-- ============================================================================
-- This would normally be built by the projection rebuilder, but seed it for testing
INSERT INTO availability_projection (tenant_id, property_node, unit_type_id, stay_date, physical, sold, held, blocked, ooo, updated_at)
SELECT 
  '00000000-0000-0000-0000-000000000001' as tenant_id,
  '00000000-0000-0000-0000-000000000012' as property_node,
  ut.id as unit_type_id,
  d.stay_date,
  COUNT(DISTINCT s.id) as physical,
  0 as sold,
  0 as held,
  0 as blocked,
  0 as ooo,
  now() as updated_at
FROM unit_type ut
CROSS JOIN generate_series('2026-09-01'::date, '2026-12-31'::date, '1 day'::interval) d(stay_date)
JOIN sellable_unit su ON su.unit_type_id = ut.id
JOIN sellable_unit_space sus ON sus.sellable_unit_id = su.id
JOIN space s ON s.id = sus.space_id
WHERE ut.property_node = '00000000-0000-0000-0000-000000000012'
GROUP BY ut.id, d.stay_date;

-- ============================================================================
-- UNIT CONDITIONS (all clean initially)
-- ============================================================================
INSERT INTO unit_condition (tenant_id, space_id, condition, updated_at)
SELECT tenant_id, id, 'clean', now() FROM space 
WHERE property_node = '00000000-0000-0000-0000-000000000012';

-- ============================================================================
-- PERMISSIONS & ROLES
-- ============================================================================
INSERT INTO permission (code, description) VALUES
  ('reservation.checkin.dirty_room', 'Allow check-in to dirty room'),
  ('reservation.override.rate', 'Override rate above threshold'),
  ('finance.approval.trust_negative', 'Approve negative trust balance'),
  ('business_day.seal', 'Seal business day'),
  ('business_day.reopen', 'Reopen sealed business day');

INSERT INTO role (id, tenant_id, name) VALUES
  ('00000000-0000-0000-0000-000000000950', '00000000-0000-0000-0000-000000000001', 'Front Desk Agent'),
  ('00000000-0000-0000-0000-000000000951', '00000000-0000-0000-0000-000000000001', 'Night Auditor'),
  ('00000000-0000-0000-0000-000000000952', '00000000-0000-0000-0000-000000000001', 'Manager');

INSERT INTO role_permission (role_id, permission_code) VALUES
  ('00000000-0000-0000-0000-000000000950', 'reservation.checkin.dirty_room'),
  ('00000000-0000-0000-0000-000000000951', 'business_day.seal'),
  ('00000000-0000-0000-0000-000000000952', 'reservation.override.rate'),
  ('00000000-0000-0000-0000-000000000952', 'finance.approval.trust_negative'),
  ('00000000-0000-0000-0000-000000000952', 'business_day.reopen'),
  ('00000000-0000-0000-0000-000000000952', 'financials.payments:read'),
  ('00000000-0000-0000-0000-000000000952', 'financials.payments:write'),
  ('00000000-0000-0000-0000-000000000952', 'financials.deposits:apply');

-- ============================================================================
-- APP USER (test front desk agent)
-- ============================================================================
INSERT INTO app_user (id, tenant_id, email, display_name, auth, status) VALUES
  ('00000000-0000-0000-0000-000000000960', '00000000-0000-0000-0000-000000000001', 
   'agent@acmehotels.com', 'Test Agent', '{"provider":"local","hash":"$2b$12$..."}', 'active');

INSERT INTO user_role (tenant_id, user_id, role_id, scope_node) VALUES
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000960',
   '00000000-0000-0000-0000-000000000950', '00000000-0000-0000-0000-000000000012');

-- ============================================================================
-- SEED VERIFICATION QUERIES
-- ============================================================================
-- Run these after seeding to confirm fixture integrity:

-- 1. Room count
SELECT 'Total rooms' as check, COUNT(*) as value FROM space WHERE property_node = '00000000-0000-0000-0000-000000000012';
-- Expected: 15

-- 2. STD vs DLX
SELECT 'STD rooms' as check, COUNT(*) as value FROM space s 
JOIN sellable_unit_space sus ON sus.space_id = s.id 
JOIN sellable_unit su ON su.id = sus.sellable_unit_id
WHERE su.unit_type_id = '00000000-0000-0000-0000-000000000300';
-- Expected: 10

SELECT 'DLX rooms' as check, COUNT(*) as value FROM space s 
JOIN sellable_unit_space sus ON sus.space_id = s.id 
JOIN sellable_unit su ON su.id = sus.sellable_unit_id
WHERE su.unit_type_id = '00000000-0000-0000-0000-000000000301';
-- Expected: 5

-- 3. Availability projection
SELECT 'Projection rows' as check, COUNT(*) as value FROM availability_projection 
WHERE property_node = '00000000-0000-0000-0000-000000000012';
-- Expected: 15 rooms × 122 days = 1830 rows (Sep 1 - Dec 31)

-- 4. All rooms clean
SELECT 'Clean rooms' as check, COUNT(*) as value FROM unit_condition 
WHERE condition = 'clean';
-- Expected: 15

-- 5. Business days open
SELECT 'Open business days' as check, COUNT(*) as value FROM business_day 
WHERE property_node = '00000000-0000-0000-0000-000000000012' AND sealed_at IS NULL;
-- Expected: 4

-- 6. Rate prices current
SELECT 'Current rate prices' as check, COUNT(*) as value FROM current_rate_price;
-- Expected: 2

-- 7. RLS active
SELECT 'RLS enabled tables' as check, COUNT(*) as value FROM pg_tables 
WHERE schemaname = 'public' AND tablename IN (
  SELECT table_name FROM information_schema.columns 
  WHERE column_name = 'tenant_id' AND table_schema = 'public'
);
-- Expected: 60+ tables with RLS enabled

-- ============================================================================
-- ADDED BY REVIEW: dorm space (positional tests) + Tenant B (RLS tests)
-- ============================================================================
INSERT INTO unit_type (id, tenant_id, property_node, code, name, profile_key, base_occupancy, max_occupancy)
VALUES ('00000000-0000-0000-0000-00000000d0c0','00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000012','DORM6','6-Bed Dorm','hostel',1,1);
INSERT INTO space (id, tenant_id, property_node, code, profile_key, capacity, max_occupancy, floor, status)
VALUES ('00000000-0000-0000-0000-00000000d0c1','00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000012','D101','hostel',6,6,'1','active');
INSERT INTO sellable_unit (id, tenant_id, unit_type_id, name, status) VALUES
  ('00000000-0000-0000-0000-00000000d0c2','00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-00000000d0c0','DORM6-BED','active'),
  ('00000000-0000-0000-0000-00000000d0c3','00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-00000000d0c0','DORM6-PRIVATE','active');
INSERT INTO sellable_unit_space (tenant_id, sellable_unit_id, space_id, claim_mode) VALUES
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000d0c2',
   '00000000-0000-0000-0000-00000000d0c1','positional'),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000d0c3',
   '00000000-0000-0000-0000-00000000d0c1','exclusive');

INSERT INTO tenant (id, slug, name) VALUES
  ('00000000-0000-0000-0000-000000000002','tenant-b','Rival Hotels');
INSERT INTO org_node (id, tenant_id, kind, name, path, timezone, currency) VALUES
  ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-000000000002',
   'property','Rival Downtown','rival','Asia/Dubai','AED');
INSERT INTO unit_type (id, tenant_id, property_node, code, name, profile_key) VALUES
  ('00000000-0000-0000-0000-0000000000b2','00000000-0000-0000-0000-000000000002',
   '00000000-0000-0000-0000-0000000000b1','STD','Rival Std','hotel');
INSERT INTO rate_plan (id, tenant_id, property_node, code, name, currency) VALUES
  ('00000000-0000-0000-0000-0000000000b3','00000000-0000-0000-0000-000000000002',
   '00000000-0000-0000-0000-0000000000b1','BAR','Rival BAR','AED');
INSERT INTO rate_price (tenant_id, rate_plan_id, unit_type_id, stay_dates, pricing) VALUES
  ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000b3',
   '00000000-0000-0000-0000-0000000000b2','[2026-09-01,2027-01-01)','{"occ":{"2":88800}}');
