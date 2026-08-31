# PMS End-to-End QA Test Suite — Complete Guest Journey
## Generated: 13 Aug 2026 · Schema v1.0 · 78 Tables, 13 Contexts

> **Reviewer's note (v1.1, 13 Aug 2026 — validated by execution).**
> This suite was reviewed against the live schema and its DB-level subset was RUN.
> Changes from v1.0: seed fixture repaired (truncated JSON schema literals regenerated
> from EXTENSIONS.md) and extended (6-bed dorm D101 for positional tests; Tenant B for
> RLS tests); TC-13.1 fixed to `SET ROLE app_role` (owner sessions bypass RLS — the
> original SQL proved nothing); TC-13.4 added (RLS through views — a real leak class
> found and fixed during review); `slot_kind` in examples is `'segment'` per schema.
> Executable battery: `tests/run_invariants.py` · first full run: **11/11 PASS**
> (see tests/RUN-RESULTS.md). App-layer tests (HTTP, tax engine, adapters) execute in
> their build phases per BUILD-PLAN.md.

**Purpose:** Validate every touchpoint of a hotel guest's lifecycle through the PMS, 
from availability search to final checkout, including edge cases, concurrency, 
compliance, and financial integrity.

**Test Categories:**
- 🟢 **Happy Path** — Standard flows that must work
- 🟡 **Edge Cases** — Boundary conditions, unusual but valid scenarios  
- 🔴 **Failure Modes** — What must be rejected, blocked, or handled gracefully
- ⚡ **Concurrency** — Race conditions, double-booking prevention
- 🔒 **Compliance** — Regulatory, fiscal, data protection
- 💰 **Financial Integrity** — Ledger balance, sealed days, trust accounting

---

## Test Data Prerequisites (Seed Fixture)

```sql
-- Run this before all tests
-- Tenant: "Acme Hotels" (tenant_id: '00000000-0000-0000-0000-000000000001')
-- Property: "Acme Downtown Dubai" (property_node path: 'acme.gulf.dxb01')
-- Timezone: Asia/Dubai, Currency: AED

INSERT INTO tenant (id, slug, name) VALUES 
  ('00000000-0000-0000-0000-000000000001', 'acme', 'Acme Hotels');

INSERT INTO org_node (id, tenant_id, path, kind, name, timezone, currency) VALUES
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 
   'acme', 'group', 'Acme Group', NULL, NULL),
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001',
   'acme.gulf', 'region', 'Gulf Region', NULL, NULL),
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001',
   'acme.gulf.dxb01', 'property', 'Acme Downtown Dubai', 'Asia/Dubai', 'AED');

-- Extension: hotel vertical profile
INSERT INTO extension_type (type, json_schema) VALUES 
  ('vertical_profile', '{"type":"object","required":["terminology","claim_mode_default","features"]}');

INSERT INTO extension (id, tenant_id, type, key, content, status) VALUES
  ('00000000-0000-0000-0000-000000000100', NULL, 'vertical_profile', 'hotel',
   '{"terminology":{"space":"Room","unit_type":"Room Type"},"claim_mode_default":"exclusive","features":{"dorm_beds":false,"hourly_slots":false,"long_stay_billing":false,"owner_statements":false,"kiosk_checkin":true,"meal_plans":true},"default_policies":["flex_24h","deposit_first_night"],"housekeeping_cadence":"daily","default_unit_types":[{"code":"STD","name":"Standard","claim_mode":"exclusive","capacity":2},{"code":"DLX","name":"Deluxe","claim_mode":"exclusive","capacity":3}]}',
   'active');

-- Tax jurisdiction: UAE VAT 5% inclusive
INSERT INTO extension (id, tenant_id, type, key, content, status) VALUES
  ('00000000-0000-0000-0000-000000000101', NULL, 'tax_jurisdiction', 'ae-vat',
   '{"country":"AE","price_display":"tax_inclusive","rounding":"line","taxes":[{"code":"VAT","name":"Value Added Tax","mode":"percent","rate":0.05,"applies_to":["room_revenue","fnb_revenue"]}]}',
   'active');

-- Spaces: 10 STD rooms, 5 DLX rooms
INSERT INTO space (id, tenant_id, property_node, code, profile_key, capacity, max_occupancy, status) VALUES
  ('00000000-0000-0000-0000-000000000200', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', '101', 'hotel', 1, 2, 'active'),
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', '102', 'hotel', 1, 2, 'active'),
  ('00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', '103', 'hotel', 1, 2, 'active'),
  ('00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', '104', 'hotel', 1, 2, 'active'),
  ('00000000-0000-0000-0000-000000000204', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', '105', 'hotel', 1, 2, 'active'),
  ('00000000-0000-0000-0000-000000000205', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', '106', 'hotel', 1, 2, 'active'),
  ('00000000-0000-0000-0000-000000000206', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', '107', 'hotel', 1, 2, 'active'),
  ('00000000-0000-0000-0000-000000000207', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', '108', 'hotel', 1, 2, 'active'),
  ('00000000-0000-0000-0000-000000000208', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', '109', 'hotel', 1, 2, 'active'),
  ('00000000-0000-0000-0000-000000000209', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', '110', 'hotel', 1, 2, 'active'),
  ('00000000-0000-0000-0000-000000000210', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', '201', 'hotel', 1, 3, 'active'),
  ('00000000-0000-0000-0000-000000000211', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', '202', 'hotel', 1, 3, 'active'),
  ('00000000-0000-0000-0000-000000000212', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', '203', 'hotel', 1, 3, 'active'),
  ('00000000-0000-0000-0000-000000000213', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', '204', 'hotel', 1, 3, 'active'),
  ('00000000-0000-0000-0000-000000000214', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', '205', 'hotel', 1, 3, 'active');

-- Unit types
INSERT INTO unit_type (id, tenant_id, property_node, code, name, profile_key, base_occupancy, max_occupancy) VALUES
  ('00000000-0000-0000-0000-000000000300', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', 'STD', 'Standard Room', 'hotel', 2, 2),
  ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', 'DLX', 'Deluxe Room', 'hotel', 2, 3);

-- Sellable units (1:1 with spaces for hotel exclusive mode)
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

-- Sellable unit spaces
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

-- Rate plan: BAR (Best Available Rate)
INSERT INTO policy (id, tenant_id, kind, name, content) VALUES
  ('00000000-0000-0000-0000-000000000500', '00000000-0000-0000-0000-000000000001', 'cancellation', 'Flex 24h',
   '{"kind":"cancellation","rules":[{"before_hours":24,"penalty":{"basis":"nights","value":0}},{"before_hours":0,"penalty":{"basis":"nights","value":1}}]}'),
  ('00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000001', 'guarantee', 'Card on File',
   '{"kind":"guarantee","guarantee":"card_on_file"}'),
  ('00000000-0000-0000-0000-000000000502', '00000000-0000-0000-0000-000000000001', 'deposit', 'First Night',
   '{"kind":"deposit","deposit":{"basis":"first_night","due":"at_booking"}}');

INSERT INTO rate_plan (id, tenant_id, property_node, code, name, currency, tax_inclusive, cancellation_policy, guarantee_policy, deposit_policy) VALUES
  ('00000000-0000-0000-0000-000000000600', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', 'BAR', 'Best Available Rate', 'AED', true,
   '00000000-0000-0000-0000-000000000500', '00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000502');

-- Rate prices: BAR = 500 AED/night for STD, 750 AED/night for DLX
INSERT INTO rate_price (id, tenant_id, rate_plan_id, unit_type_id, stay_dates, dow_mask, pricing) VALUES
  ('00000000-0000-0000-0000-000000000700', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000600', '00000000-0000-0000-0000-000000000300',
   '[2026-09-01,2026-12-31)', 127, '{"occ":{"1":50000,"2":50000},"extra_adult":0,"extra_child":[]}'),
  ('00000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000600', '00000000-0000-0000-0000-000000000301',
   '[2026-09-01,2026-12-31)', 127, '{"occ":{"1":75000,"2":75000,"3":75000},"extra_adult":0,"extra_child":[]}');

-- tx_codes
INSERT INTO tx_code (code, name, grp, usali_line, default_dr, default_cr) VALUES
  ('ROOM', 'Room Revenue', 'revenue', '4510', NULL, 'revenue'),
  ('FNB', 'F&B Revenue', 'revenue', '4520', NULL, 'revenue'),
  ('TAX', 'Tax Payable', 'tax', NULL, 'tax_payable', NULL),
  ('CASH', 'Cash Payment', 'payment', NULL, 'cash', NULL),
  ('CARD', 'Card Payment', 'payment', NULL, 'card_clearing', NULL),
  ('DEP', 'Deposit Liability', 'deposit', NULL, 'deposit_liability', NULL);

-- Accounts
INSERT INTO account (id, tenant_id, property_node, role, name, currency, status) VALUES
  ('00000000-0000-0000-0000-000000000800', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', 'revenue', 'Room Revenue', 'AED', 'open'),
  ('00000000-0000-0000-0000-000000000801', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', 'revenue', 'F&B Revenue', 'AED', 'open'),
  ('00000000-0000-0000-0000-000000000802', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', 'tax_payable', 'VAT Payable', 'AED', 'open'),
  ('00000000-0000-0000-0000-000000000803', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', 'cash', 'Cash on Hand', 'AED', 'open'),
  ('00000000-0000-0000-0000-000000000804', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', 'card_clearing', 'Card Clearing', 'AED', 'open'),
  ('00000000-0000-0000-0000-000000000805', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', 'deposit_liability', 'Deposit Liability', 'AED', 'open');

-- Business day open
INSERT INTO business_day (tenant_id, property_node, business_date, opened_at) VALUES
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', '2026-09-15', now());
```

---

## Phase 1: AVAILABILITY & SEARCH

### TC-1.1 🟢 Basic Availability Search
**Setup:** 15 rooms total (10 STD, 5 DLX), all vacant for 2026-09-15 to 2026-09-18
**Action:** `POST /api/v1/properties/dxb01/availability:search`
```json
{
  "stay": {"from":"2026-09-15","to":"2026-09-18"},
  "party": {"adults":2},
  "currency": "AED"
}
```
**Expected:**
- HTTP 200
- 2 options: STD @ 500 AED/night × 3 = 150,000 minor; DLX @ 750 AED/night × 3 = 225,000 minor
- `available_count`: 10 for STD, 5 for DLX
- Taxes included (UAE tax_inclusive = true)
- Policies: cancellation (free before 24h), guarantee (card), deposit (first night)

**SQL Validation:**
```sql
SELECT set_config('app.tenant_id', '00000000-0000-0000-0000-000000000001', true);
SELECT * FROM availability_projection 
WHERE property_node = '00000000-0000-0000-0000-000000000012' 
  AND stay_date BETWEEN '2026-09-15' AND '2026-09-17'
  AND unit_type_id IN ('00000000-0000-0000-0000-000000000300', '00000000-0000-0000-0000-000000000301')
ORDER BY stay_date, unit_type_id;
-- Expected: physical=10/5, sold=0, held=0, blocked=0, ooo=0, available=10/5 for all dates
```

---

### TC-1.2 🟡 Search with Restrictions Applied
**Setup:** Add restriction: STD closed for arrival on 2026-09-15
```sql
INSERT INTO restriction (id, tenant_id, scope_node, unit_type_id, kind, value, stay_dates) VALUES
  ('00000000-0000-0000-0000-000000000900', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012',
   '00000000-0000-0000-0000-000000000300', 'closed', NULL, '[2026-09-15,2026-09-16)');
```
**Action:** Same search as TC-1.1
**Expected:**
- STD option present but with `restrictions_applied: ["closed"]`
- OR STD option excluded (per product decision — log in DECISIONS.log)
- DLX option unaffected

---

### TC-1.3 🟡 Search with OOO (Out of Order)
**Setup:** Mark room 101 as OOO for 2026-09-15 to 2026-09-17
```sql
INSERT INTO ooo_oos (id, tenant_id, space_id, kind, period, reason) VALUES
  ('00000000-0000-0000-0000-000000000901', '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000200', 'ooo', '[2026-09-15 00:00+04,2026-09-17 00:00+04)', 'AC repair');
```
**Action:** Search for STD 2026-09-15 to 2026-09-18
**Expected:**
- `available_count` for STD = 9 (10 physical - 1 OOO)
- Projection updated: `ooo=1` for STD on 2026-09-15, 2026-09-16

---

### TC-1.4 🔴 Search with No Availability
**Setup:** Book all 10 STD rooms for 2026-09-15 to 2026-09-18
**Action:** Search for STD, same dates
**Expected:**
- HTTP 200 (search always returns, even if empty)
- `options: []` OR `available_count: 0` with `restrictions_applied`
- No errors

---

### TC-1.5 🟡 Search with Children & Age Pricing
**Setup:** Rate price has extra_child pricing
**Action:** Search with party `{"adults":2, "children":[{"age":6}]}`
**Expected:**
- Total includes child pricing if configured
- `per_night` breakdown shows adult vs child amounts

---

## Phase 2: HOLD & COMMIT (The Choke Point)

### TC-2.1 🟢 Successful Hold
**Setup:** Clean state, STD available
**Action:**
```json
POST /availability:hold
{
  "unit_type": "STD",
  "stay": {"from":"2026-09-15","to":"2026-09-18"},
  "ttl_s": 600
}
```
**Expected:**
- HTTP 201
- `hold_id` returned, `expires_at` = now + 600s
- `space_occupancy` row created with `slot_kind='hold'`
- `hold` row created with `status='active'`

**SQL Validation:**
```sql
SELECT * FROM space_occupancy WHERE slot_kind = 'hold';
-- Expected: 3 rows (one per night), claim = [0,NULL) for room 101
SELECT * FROM hold WHERE status = 'active';
-- Expected: 1 row, kind='cart', expires_at > now()
```

---

### TC-2.2 🟢 Hold → Commit (Honest End-to-End)
**Setup:** TC-2.1 hold active
**Action:**
```json
POST /reservations:commit
{
  "hold_id": "<hold_id>",
  "guest": {
    "party": {
      "display_name": "John Smith",
      "kind": "person",
      "contact": {"email":"john@example.com","phone":"+971501234567"}
    }
  },
  "payment": {"method":"card_on_file"},
  "idempotency_key": "test-commit-001"
}
```
**Expected:**
- HTTP 201, reservation created
- `hold.status` → `consumed`
- `space_occupancy.slot_kind` → `segment`
- `reservation.status` = `reserved`
- `folio` opened for guest account
- `outbox` events: `reservation.confirmed`, `folio.opened`
- `journal` posted: deposit liability for first night (per deposit policy)

**SQL Validation:**
```sql
-- Verify occupancy transfer
SELECT slot_kind, slot_ref, exclusive FROM space_occupancy 
WHERE space_id = '00000000-0000-0000-0000-000000000200';
-- Expected: slot_kind='segment', exclusive=true

-- Verify reservation state
SELECT status, confirmation_no FROM reservation WHERE id = '<reservation_id>';
-- Expected: status='reserved', confirmation_no generated

-- Verify folio
SELECT f.status, f.window_no, folio_balance.balance_minor 
FROM folio f 
LEFT JOIN folio_balance ON folio_balance.folio_id = f.id
WHERE f.reservation_id = '<reservation_id>';
-- Expected: status='open', window_no=1, balance = deposit amount (negative = guest owes)

-- Verify outbox events
SELECT event_type, aggregate_type FROM outbox 
WHERE aggregate_id = '<reservation_id>' ORDER BY seq;
-- Expected: reservation.confirmed, folio.opened, journal.posted (deposit)

-- Verify journal balance
SELECT j.id, SUM(pl.amount_minor) as balance 
FROM journal j 
JOIN posting_line pl ON pl.journal_id = j.id
WHERE j.source->>'ref' = '<reservation_id>'
GROUP BY j.id;
-- Expected: balance = 0 for every journal
```

---

### TC-2.3 ⚡ Racing Commits (The Money Test)
**Setup:** 2 STD rooms available, 3 simultaneous commit attempts
**Action:** 3 clients attempt commit for same STD, same dates, no hold
**Expected:**
- Exactly 1 HTTP 201 (winner)
- Exactly 2 HTTP 409 `conflict/occupancy`
- No double-booking in `space_occupancy`
- `available_count` in projection = 0 after all attempts

**SQL Validation:**
```sql
SELECT COUNT(*) as sold FROM space_occupancy so
JOIN reservation_segment rs ON rs.id = so.slot_ref
WHERE so.space_id = '00000000-0000-0000-0000-000000000200'
  AND so.period && '[2026-09-15 14:00+04,2026-09-18 12:00+04)';
-- Expected: sold = 1 (never 2 or 3)
```

---

### TC-2.4 🔴 Commit Without Hold (Direct)
**Setup:** No hold, room available
**Action:** Direct commit (same payload as TC-2.2, no hold_id)
**Expected:**
- HTTP 201 (direct commit attempts choke write inside txn)
- OR HTTP 409 if room sold between search and commit
- Either outcome is valid; no partial state

---

### TC-2.5 🔴 Expired Hold Cleanup
**Setup:** Create hold with ttl_s=1, wait 2 seconds
**Action:** Run `SELECT expire_holds();`
**Expected:**
- Hold status → `expired`
- `space_occupancy` rows deleted
- Projection updated: `held` decremented

---

### TC-2.6 🔴 Direct INSERT to space_occupancy (Choke Point Violation)
**Setup:** App role connected
**Action:**
```sql
-- As app_role
INSERT INTO space_occupancy (tenant_id, space_id, period, slot_ref, slot_kind, exclusive, claim)
VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000200',
        '[2026-09-20,2026-09-21)', gen_random_uuid(), 'segment', true, int4range(0, NULL));
```
**Expected:**
- ERROR: 42501 (insufficient_privilege)
- This MUST be the result — proven by prototype T4

---

## Phase 3: RESERVATION LIFECYCLE

### TC-3.1 🟢 Modify Dates (Extend Stay)
**Setup:** Reservation from 2026-09-15 to 2026-09-18
**Action:** Modify to 2026-09-15 to 2026-09-20 (add 2 nights)
**Expected:**
- New `reservation_segment` row with seq=2? OR same segment extended?
- Per STATE-MACHINES.md: "Extensions/shortenings on the SAME unit: release + re-record inside one transaction"
- `reservation.modified` event emitted with diff
- New occupancy recorded for extended nights
- Folio adjusted with additional charges

**SQL Validation:**
```sql
-- Verify single segment (same unit extension)
SELECT seq, period, status FROM reservation_segment 
WHERE reservation_id = '<reservation_id>' ORDER BY seq;
-- Expected: seq=1, period=[2026-09-15,2026-09-20), status='booked'

-- Verify occupancy covers full period
SELECT period FROM space_occupancy 
WHERE slot_ref = '<segment_id>' ORDER BY period;
-- Expected: period covers 2026-09-15 to 2026-09-20

-- Verify events
SELECT event_type FROM outbox 
WHERE aggregate_id = '<reservation_id>' AND event_type = 'reservation.modified';
-- Expected: 1 row
```

---

### TC-3.2 🟡 Room Move
**Setup:** Guest in room 101 (STD), wants to move to 102 (STD)
**Action:** Move reservation segment to new space
**Expected:**
- Per STATE-MACHINES.md: "close the segment (departed, trim period) and open the next seq"
- Old segment: status=`departed`, period trimmed to now
- New segment: seq=2, new space, period from now to original checkout
- `segment.moved` event emitted
- No gap in occupancy (old released, new recorded in same txn)

**SQL Validation:**
```sql
SELECT seq, space_id, status, period FROM reservation_segment 
WHERE reservation_id = '<reservation_id>' ORDER BY seq;
-- Expected: 
-- seq=1, space_id=101, status='departed', period=[checkin, move_time)
-- seq=2, space_id=102, status='booked', period=[move_time, checkout)
```

---

### TC-3.3 🟢 Cancellation Within Policy
**Setup:** Reservation for 2026-09-15, cancelled on 2026-09-14 (>24h before)
**Action:** Cancel reservation
**Expected:**
- `reservation.status` → `cancelled`
- `reservation_segment.status` → `cancelled`
- Occupancy released via `release_occupancy()`
- `reservation.cancelled` event
- No penalty journal (cancelled >24h before)
- Folio closed with zero balance

---

### TC-3.4 🟡 Cancellation With Penalty
**Setup:** Reservation for 2026-09-15, cancelled on 2026-09-15 (<24h before)
**Action:** Cancel reservation
**Expected:**
- `reservation.status` → `cancelled`
- Penalty journal posted: 1 night charge (per cancellation policy)
- Guest folio shows charge, then payment applied from guarantee
- `reservation.cancelled` event includes `penalty_journal_id`

**SQL Validation:**
```sql
SELECT j.id, j.kind, j.description, j.reverses 
FROM journal j
JOIN posting_line pl ON pl.journal_id = j.id
WHERE pl.folio_id = '<folio_id>' AND j.kind = 'charge';
-- Expected: charge journal for 1 night (50,000 minor for STD)
-- SUM(amount_minor) across all lines = 0
```

---

### TC-3.5 🔴 Cancel Already Checked-In Guest
**Setup:** Guest status = `in_house`
**Action:** Attempt cancellation
**Expected:**
- HTTP 422 `invalid_transition`
- Must check out first, or use no-show flow

---

### TC-3.6 🟢 Reinstate Cancelled Reservation
**Setup:** Cancelled reservation, rooms still available
**Action:** Reinstate reservation
**Expected:**
- `reservation.status` → `reserved`
- Availability re-check passes
- New occupancy recorded
- `reservation.reinstated` event

---

## Phase 4: CHECK-IN

### TC-4.1 🟢 Standard Check-In
**Setup:** Reservation status = `due_in`, room 101 clean, folio open, deposit paid
**Action:** `POST /reservations/{id}:check_in` {segment_id, space_id: 101}
**Expected:**
- `reservation.status` → `in_house`
- `reservation_segment.status` → `in_house`
- `unit_condition` updated? (HK: dirty→clean→inspected required)
- `reservation.checked_in` event
- Statutory scheduler triggered (if property country has mandate)
- Keys generated (optional)

**SQL Validation:**
```sql
SELECT status FROM reservation WHERE id = '<reservation_id>';
-- Expected: 'in_house'

SELECT status FROM reservation_segment WHERE id = '<segment_id>';
-- Expected: 'in_house'

SELECT condition FROM unit_condition WHERE space_id = '00000000-0000-0000-0000-000000000200';
-- Expected: 'inspected' (if HK verified) or 'clean' (if checkin.dirty_room permission)

SELECT * FROM outbox WHERE event_type = 'reservation.checked_in' 
  AND aggregate_id = '<reservation_id>';
-- Expected: 1 row with payload {segment, space}
```

---

### TC-4.2 🔴 Check-In with Dirty Room (No Permission)
**Setup:** Room 101 condition = `dirty`, user lacks `checkin.dirty_room` permission
**Action:** Check-in to room 101
**Expected:**
- HTTP 422 with actionable error: "Room not ready: condition is dirty"
- Reservation status unchanged

---

### TC-4.3 🔴 Check-In with Missing Statutory Fields (Italy)
**Setup:** Property in Italy (requires Alloggiati), guest missing passport/nationality
**Action:** Check-in
**Expected:**
- HTTP 422: "Missing required identity fields for IT: passport_number, nationality"
- Check-in blocked until fields provided
- Per STATE-MACHINES.md: "check-in: id verified per statutory need"

---

### TC-4.4 🔴 Check-In with Open Balance
**Setup:** Deposit not paid, folio balance != 0
**Action:** Check-in
**Expected:**
- HTTP 422: "Deposit required: 50,000 AED"
- OR check-in allowed with guarantee (per policy)
- Behavior depends on guarantee_policy — must be consistent

---

### TC-4.5 🟡 No-Show Processing
**Setup:** Reservation status = `due_in`, arrival date passed, guest didn't show
**Action:** Day-roll job processes no-show
**Expected:**
- `reservation.status` → `no_show`
- No-show charge journal posted (per policy: first night)
- Occupancy released
- `reservation.no_show` event

---

## Phase 5: STAY OPERATIONS

### TC-5.1 🟢 Post Room Charge
**Setup:** Guest in-house, night audit running
**Action:** Post nightly room charge to folio
**Expected:**
- Journal created with kind=`charge`
- Posting lines: DR guest folio, CR room revenue
- Amount: 50,000 minor (STD rate)
- Tax detail computed (UAE 5% VAT = 2,381 minor, included in 50,000)
- `journal.posted` event
- `folio_balance` updated

**SQL Validation:**
```sql
SELECT j.id, j.kind, j.currency, j.business_date,
       SUM(pl.amount_minor) as journal_balance,
       COUNT(pl.id) as line_count
FROM journal j
JOIN posting_line pl ON pl.journal_id = j.id
WHERE j.property_node = '00000000-0000-0000-0000-000000000012'
  AND j.business_date = '2026-09-15'
  AND j.kind = 'charge'
GROUP BY j.id
HAVING SUM(pl.amount_minor) <> 0;
-- Expected: 0 rows (all journals balanced)
```

---

### TC-5.2 🟢 Post F&B Charge
**Setup:** Guest orders room service
**Action:** Post F&B charge to folio
**Expected:**
- Journal: DR guest folio, CR F&B revenue, CR tax payable
- `tx_code` = 'FNB', `usali_line` = '4520'
- Quantity = items ordered

---

### TC-5.3 🟡 Transfer Between Folios
**Setup:** Two guests sharing room, split charges
**Action:** Transfer F&B charge from guest A folio to guest B folio
**Expected:**
- Journal kind = `transfer`
- Posting lines: DR guest A folio (negative = credit), CR guest B folio
- Original posting untouched (insert-only)

---

### TC-5.4 🔴 Post to Sealed Day
**Setup:** Business day 2026-09-15 sealed
**Action:** Attempt to post charge for 2026-09-15
**Expected:**
- ERROR: `business date 2026-09-15 sealed` (ERRCODE P0011)
- Journal blocked by `assert_day_open` trigger
- Per Invariant 7: After sealed_at, only adjustment/correction journals

---

### TC-5.5 🟡 Adjustment (Reversal)
**Setup:** Incorrect charge posted yesterday
**Action:** Create adjustment journal reversing the line
**Expected:**
- New journal with kind=`adjustment`, `reverses` = original_journal_id
- Posting lines: mirror of original (DR becomes CR, CR becomes DR)
- Original journal untouched (insert-only)
- `journal.posted` event

---

### TC-5.6 🔴 Unbalanced Journal
**Setup:** Developer bug — journal lines don't sum to zero
**Action:** Attempt to commit unbalanced journal
**Expected:**
- ERROR at COMMIT: `journal <id> unbalanced by <amount>` (ERRCODE P0010)
- Deferred trigger catches it
- Transaction rolls back
- No partial state

---

## Phase 6: CHECKOUT

### TC-6.1 🟢 Standard Checkout
**Setup:** Guest due out, all charges posted, folio balance = 0
**Action:** `POST /reservations/{id}:check_out`
**Expected:**
- `reservation.status` → `checked_out`
- `reservation_segment.status` → `departed`
- Occupancy released (period trimmed to now)
- Folio status → `settled` → `closed` (after document issued)
- `reservation.checked_out` event
- HK task generated: clean room

**SQL Validation:**
```sql
SELECT status FROM reservation WHERE id = '<reservation_id>';
-- Expected: 'checked_out'

SELECT status FROM folio WHERE reservation_id = '<reservation_id>';
-- Expected: 'closed' (or 'settled' if document not yet issued)

SELECT * FROM task WHERE subject_type = 'space' 
  AND subject_id = '00000000-0000-0000-0000-000000000200'
  AND kind = 'housekeeping';
-- Expected: 1 row, status='open', due_at = checkout time

SELECT * FROM space_occupancy WHERE slot_ref = '<segment_id>';
-- Expected: 0 rows (released) or period trimmed
```

---

### TC-6.2 🔴 Checkout with Open Balance
**Setup:** Folio balance != 0 (unpaid minibar)
**Action:** Attempt checkout
**Expected:**
- HTTP 422 with actionable error: "Open balance: 15,000 AED"
- Options: pay now, transfer to AR, or add to deposit
- Reservation status unchanged

---

### TC-6.3 🟡 Late Checkout
**Setup:** Guest requests 2-hour late checkout
**Action:** Extend stay by 2 hours, post additional charge
**Expected:**
- Segment period extended
- Additional charge posted (if policy requires)
- OR no charge if comped by front desk

---

### TC-6.4 🟡 Express Checkout (Zero Balance)
**Setup:** Guest prepaid everything, folio balance = 0
**Action:** Checkout without front desk interaction
**Expected:**
- Same as TC-6.1 but automated
- Invoice emailed automatically
- Keys deactivated

---

## Phase 7: FINANCIAL INTEGRITY

### TC-7.1 🟢 Trial Balance
**Setup:** Multiple transactions across days
**Action:** Run trial balance query
**Expected:**
- SUM(amount_minor) across ALL posting lines = 0
- Per account: DR and CR balance

**SQL Validation:**
```sql
SELECT SUM(amount_minor) FROM posting_line;
-- Expected: 0

SELECT a.name, a.role, SUM(pl.amount_minor) as balance
FROM account a
LEFT JOIN posting_line pl ON pl.account_id = a.id
GROUP BY a.id
HAVING SUM(pl.amount_minor) <> 0;
-- Expected: 0 rows (all accounts balance)
```

---

### TC-7.2 ⚡ Concurrent Postings (1,000 journals)
**Setup:** 10 threads posting 100 journals each
**Action:** Run concurrent posting test
**Expected:**
- All 1,000 journals committed
- Trial balance = 0
- No deadlock errors
- p99 latency < 100ms

---

### TC-7.3 🟡 Business Day Seal
**Setup:** Day ready: no open cashier, no discrepancies, outbox lag < threshold
**Action:** `SELECT seal_business_day(tenant, property, date, user);`
**Expected:**
- `business_day.sealed_at` set
- `business_day.sealed` event emitted
- Subsequent non-adjustment journals blocked

---

### TC-7.4 🔴 Trust Account Negative
**Setup:** Owner trust account balance = 0
**Action:** Attempt to post owner expense exceeding balance
**Expected:**
- Blocked without approval_request
- OR approval_request created for `trust_negative` kind
- Per SKILL-2.md: "Trust accounts can never go negative against the owner without approval"

---

## Phase 8: COMPLIANCE & FISCAL

### TC-8.1 🟢 Document Issuance (Invoice)
**Setup:** Folio settled, checkout complete
**Action:** Issue invoice document
**Expected:**
- `document_series.next_no` incremented (gapless)
- `document.doc_no` = prefix + number
- `document.sha256` computed over canonical body
- `document.prev_hash` chained from series last_doc_hash
- `document.status` = `issued`
- `document.issued` event

**SQL Validation:**
```sql
SELECT doc_no, sha256, prev_hash, status FROM document 
WHERE kind = 'invoice' AND subject_id = '<folio_id>';
-- Expected: status='issued', doc_no not null, sha256 not null

SELECT next_no, last_doc_hash FROM document_series 
WHERE kind = 'invoice';
-- Expected: next_no incremented by 1, last_doc_hash = document.sha256
```

---

### TC-8.2 🔴 Document Number Gap
**Setup:** Concurrent invoice issuance
**Action:** 100 clients request invoice simultaneously
**Expected:**
- 100 documents issued
- doc_no sequence: 1, 2, 3, ... 100 (no gaps, no duplicates)
- Per SKILL-2.md: "gapless per series, allocated inside the issuing transaction"

---

### TC-8.3 🟡 ZATCA Clearance (Saudi)
**Setup:** Property in KSA, ZATCA Phase 2 configured
**Action:** Issue fiscal document
**Expected:**
- UBL 2.1 XML generated
- XAdES signed
- PIH (Previous Invoice Hash) included
- TLV QR encoded
- Sandbox clearance request submitted
- `fiscal_submission` row created with status=`pending`
- On clearance: status=`cleared`, authority_ref populated

---

### TC-8.4 🟡 India GST Slab Calculation
**Setup:** Property in India, room rate = ₹7,500/night
**Action:** Compute tax for 1 night
**Expected:**
- Slab: ≤₹7,500 → 5% GST without ITC
- Tax = ₹375 (5% of 7,500)
- Total = ₹7,875
- Document: IRN generated, signed QR stored

**Boundary Tests:**
| Rate | Expected GST | ITC |
|------|-------------|-----|
| ₹0 | Rejected (zero-value postings remain invalid) | No |
| ₹1,000 | 5% = ₹50 | No |
| ₹1,001 | 5% = ₹50.05 | No |
| ₹7,500 | 5% = ₹375 (boundary) | No |
| ₹7,501 | 18% = ₹1,350.18 | Yes |

---

### TC-8.5 🔒 GDPR Erasure Request
**Setup:** Guest requests data deletion
**Action:** Create erasure_request
**Expected:**
- `party.display_name` → tombstone value (e.g., "[redacted]")
- `party.attrs` cleared
- Contact points, addresses, identity_documents anonymized
- Postings, journals, documents, statutory_submissions UNCHANGED
- `erasure_request.status` → `anonymised`
- Per SKILL-2.md: "legal retention beats erasure for financial records"

---

## Phase 9: HOUSEKEEPING

### TC-9.1 🟢 Task Sheet Generation
**Setup:** 5 checkouts today, 3 stayovers
**Action:** Generate HK task sheet for 2026-09-16
**Expected:**
- 5 departure cleans (full clean + inspect)
- 3 stayover cleans (tidy + replenish)
- Task priorities set
- Credits allocated per cadence config

---

### TC-9.2 🟡 Discrepancy Reporting
**Setup:** HK reports room 101 as sleep (guest didn't check out but room is occupied)
**Action:** Create discrepancy
**Expected:**
- `discrepancy` row: reported=`sleep`, system_state=`departed`
- Alert created for front desk
- Queue entry created for resolution

---

## Phase 10: DISTRIBUTION (OTA)

### TC-10.1 🟢 Inbound Booking.com Reservation
**Setup:** Channel map configured
**Action:** Receive Booking.com OTA message
**Expected:**
- `inbound_message` stored with status=`received`
- Idempotent: same `external_id` = no-op
- Reservation created with `channel_code='booking_com'`
- Folio opened
- ARI push triggered (inventory decrement)

---

### TC-10.2 🟡 ARI Push Convergence
**Setup:** 500 rate changes burst
**Action:** Process rate updates
**Expected:**
- `push_cursor` advances monotonically
- No thundering herd (batched 5-30s adaptive)
- All channels receive updates
- Cursor resets on channel reconnect

---

## Phase 11: GROUPS & BLOCKS

### TC-11.1 🟢 Block Creation
**Setup:** Corporate group wants 50 rooms for conference
**Action:** Create reservation_group kind=`block`
**Expected:**
- `block_allotment` rows: 50 STD, 20 DLX per night
- `availability_projection.blocked` incremented
- House inventory NOT decremented (yet)

---

### TC-11.2 🟢 Block Pickup
**Setup:** Block with deduct=true status
**Action:** Create reservation with group_id
**Expected:**
- `block_allotment.blocked` decremented
- House inventory NOT decremented (allotment consumed first)
- `reservation_group.status` updated

---

### TC-11.3 🟡 Block Wash
**Setup:** Block cutoff date passed, un-picked rooms
**Action:** Automation runs `wash_release`
**Expected:**
- Unpicked allotment released
- `availability_projection.blocked` decremented
- `block.rooms_released` event

---

## Phase 12: CONCURRENCY & STRESS

### TC-12.1 ⚡ T1: Exclusive Race
**Setup:** 50 clients, 1 room, same dates
**Expected:** Exactly 1 winner, 49 rejections

### TC-12.2 ⚡ T2: Composite Race (Private vs Beds)
**Setup:** 25 clients try dorm as private, 25 try beds simultaneously
**Expected:** Either private wins (1,0) OR beds win (0,1-6), NEVER both

### TC-12.3 ⚡ T3: Capacity Race
**Setup:** 40 clients, 6-bed dorm, same dates
**Expected:** Exactly 6 winners, 34 rejections

### TC-12.4 ⚡ T4: Choke Point
**Setup:** App role attempts direct INSERT
**Expected:** 42501 permission denied

### TC-12.5 ⚡ T5: Throughput
**Setup:** 500 non-overlapping bookings, 10 threads
**Expected:** >1,000 commits/sec, zero conflicts

---

## Phase 13: CROSS-CUTTING CONCERNS

### TC-13.1 🔒 RLS Isolation
**Setup:** Tenant A and Tenant B have same room codes
**Action:** Query spaces as Tenant A
**Expected:**
- Only Tenant A's spaces returned
- `set_config('app.tenant_id', 'tenant-a-uuid', true)` enforced

**SQL Validation:**
```sql
-- MUST run as the app role: the DB owner bypasses RLS, so without SET ROLE
-- this test proves nothing.
SET ROLE app_role;
SELECT set_config('app.tenant_id', '00000000-0000-0000-0000-000000000001', true);
SELECT COUNT(*) FROM space; -- Expected: 16 (Tenant A)

SET ROLE app_role;
SELECT set_config('app.tenant_id', '00000000-0000-0000-0000-000000000002', true);
SELECT COUNT(*) FROM space; -- Expected: 0 (Tenant B has no spaces in fixture)
```

---

### TC-13.4 🔒 RLS Through Views (leak-class regression)
**Why this exists:** views execute with their OWNER's privileges by default and
owners bypass RLS — a plain `CREATE VIEW` leaked every tenant's rates in testing
until `security_invoker = true` was set. This test must never be removed.
**Action:** As each tenant (via `SET ROLE app_role` + set_config), read
`current_rate_price` and `folio_balance`.
**Expected:** `count(DISTINCT tenant_id) = 1` — each session sees only itself.

**SQL Validation:**
```sql
SET ROLE app_role;
SELECT set_config('app.tenant_id', '00000000-0000-0000-0000-000000000001', true);
SELECT count(DISTINCT tenant_id) FROM current_rate_price; -- Expected: 1
SET ROLE app_role;
SELECT set_config('app.tenant_id', '00000000-0000-0000-0000-000000000002', true);
SELECT count(DISTINCT tenant_id) FROM current_rate_price; -- Expected: 1
```

---

### TC-13.2 🔒 Idempotency Key
**Setup:** Same commit attempted twice (network retry)
**Action:** POST /reservations:commit with same Idempotency-Key
**Expected:**
- First request: 201 + reservation
- Second request: 200 + same reservation (not duplicate)
- Stored hash→response for 24h

---

### TC-13.3 🔒 Tenancy Middleware
**Setup:** Request with JWT containing tenant_id and scopes
**Action:** Any API call
**Expected:**
- `tenant_id` derived from JWT, never from body
- `set_config` called transaction-local (true)
- RLS policy enforced
- Scope check before handler execution

---

## Test Execution Matrix

| Phase | Tests | Happy | Edge | Failure | Concurrency | Compliance |
|-------|-------|-------|------|---------|-------------|------------|
| 1. Search | 5 | 1 | 3 | 1 | 0 | 0 |
| 2. Hold/Commit | 6 | 2 | 1 | 3 | 1 | 0 |
| 3. Reservation | 6 | 3 | 2 | 1 | 0 | 0 |
| 4. Check-In | 5 | 1 | 1 | 3 | 0 | 1 |
| 5. Stay Ops | 6 | 2 | 2 | 2 | 0 | 0 |
| 6. Checkout | 4 | 2 | 1 | 1 | 0 | 0 |
| 7. Financials | 4 | 2 | 1 | 1 | 1 | 0 |
| 8. Compliance | 5 | 1 | 2 | 1 | 1 | 5 |
| 9. Housekeeping | 2 | 1 | 1 | 0 | 0 | 0 |
| 10. Distribution | 2 | 1 | 1 | 0 | 0 | 0 |
| 11. Groups | 3 | 2 | 1 | 0 | 0 | 0 |
| 12. Concurrency | 5 | 0 | 0 | 0 | 5 | 0 |
| 13. Cross-Cutting | 3 | 1 | 1 | 1 | 0 | 3 |
| **TOTAL** | **56** | **19** | **17** | **14** | **7** | **9** |

---

## SQL Health Check Queries (Run After Any Test)

```sql
-- 1. All journals balance?
SELECT j.id, j.kind, SUM(pl.amount_minor) as imbalance
FROM journal j
JOIN posting_line pl ON pl.journal_id = j.id
GROUP BY j.id
HAVING SUM(pl.amount_minor) <> 0;
-- Expected: 0 rows

-- 2. No orphaned occupancy?
SELECT so.* FROM space_occupancy so
LEFT JOIN reservation_segment rs ON rs.id = so.slot_ref
LEFT JOIN hold h ON h.id = so.slot_ref
LEFT JOIN ooo_oos ooo ON ooo.id = so.slot_ref
WHERE so.slot_kind = 'segment' AND rs.id IS NULL
   OR so.slot_kind = 'hold' AND h.id IS NULL
   OR so.slot_kind = 'ooo' AND ooo.id IS NULL;
-- Expected: 0 rows

-- 3. Outbox lag?
SELECT COUNT(*) as unpublished FROM outbox WHERE published_at IS NULL;
-- Expected: 0 (after relay catches up)

-- 4. Folio balance matches posting lines?
SELECT f.id, fb.balance_minor, 
       (SELECT SUM(amount_minor) FROM posting_line WHERE folio_id = f.id) as computed
FROM folio f
JOIN folio_balance fb ON fb.folio_id = f.id
WHERE fb.balance_minor <> (SELECT COALESCE(SUM(amount_minor),0) FROM posting_line WHERE folio_id = f.id);
-- Expected: 0 rows

-- 5. Sealed day integrity?
SELECT bd.property_node, bd.business_date, bd.sealed_at,
       COUNT(j.id) as post_seal_journals
FROM business_day bd
LEFT JOIN journal j ON j.property_node = bd.property_node 
  AND j.business_date = bd.business_date
  AND j.kind NOT IN ('adjustment','correction')
WHERE bd.sealed_at IS NOT NULL
GROUP BY bd.property_node, bd.business_date, bd.sealed_at
HAVING COUNT(j.id) > 0;
-- Expected: 0 rows

-- 6. Document hash chain integrity?
WITH doc_chain AS (
  SELECT d.id, d.doc_no, d.sha256, d.prev_hash, 
         LAG(d.sha256) OVER (ORDER BY d.doc_no) as expected_prev
  FROM document d
  WHERE d.series_id = '<series_id>' AND d.status = 'issued'
)
SELECT * FROM doc_chain WHERE prev_hash IS DISTINCT FROM expected_prev;
-- Expected: 0 rows

-- 7. RLS working?
SELECT set_config('app.tenant_id', '00000000-0000-0000-0000-000000000999', true);
SELECT COUNT(*) FROM space; -- Should return 0 for non-existent tenant
```

---

## Notes for Claude Code

1. **Every test must start with `set_config('app.tenant_id', ..., true)`**
2. **Money amounts are in minor units** (AED 500.00 = 50000)
3. **Dates are half-open ranges** `[from, to)` — 3 nights = 15th to 18th
4. **Events are the only cross-context mechanism** — verify outbox, not direct table reads
5. **Insert-only means no UPDATE/DELETE** — verify with `REVOKE` tests
6. **The constraint is the truth** — `space_occupancy` conflicts are caught by PostgreSQL, not application code
7. **Business date != server date** — derive from property timezone
8. **Idempotency keys prevent duplicates** — store hash→response for 24h
9. **Document numbers are gapless** — use `FOR UPDATE` on series row
10. **Trust accounts never negative** — require approval_request

---

*Generated for the Yellow build. Share this document with Claude Code 
as the canonical test specification for Phase 0-12 validation.*

## Order 304 — India GST accommodation rate-version pair proof

This Tier-3 compliance slice is a read-only composition over the existing extension
registry and selected-extension effective-period projections. The live fixture uses
two tenants and one property per tenant. Tenant A receives an explicitly inserted,
retired version 1 and active version 2 of `in-gst-lodging`; their ranges are exactly
`[2022-07-17T18:30:00.000000Z,2025-09-21T18:30:00.000000Z)` and
`[2025-09-21T18:30:00.000000Z,infinity)`. Tenant B receives a separate pair.

The integration proof must establish:

- exact predecessor/successor ids, owner, key, type, status, version and periods;
- 12%-with-ITC then 18%-with-ITC predecessor `GST_ROOM` slabs, and 5%-without-ITC
  then 18%-with-ITC successor slabs, with no nil band;
- all three official source-byte hashes and canonical content hashes are present in
  the frozen evidence, while tenant identity is absent from the returned shape;
- one-microsecond period drift, foreign ids, duplicate/invisible identities, status,
  owner, version, key, type, threshold, rate, ITC, nil-band and source-hash changes
  fail closed;
- `runtime_visible_extensions` conceals Tenant B from Tenant A and the existing
  tax-jurisdiction resolver still selects only active successor version 2;
- after fixture setup, extension, fact, outbox, journal, posting and fiscal-submission
  row snapshots are byte-identical following successful, foreign and failed reads.

The proof may not seed production history, mutate extension state, choose a retired
rate, use a clock/latest lookup, calculate tax, apply section 14, or touch fiscal
documents, IRP, API, UI or downstream state. Missing `YELLOW_ORDER304_*` URLs skip
the live block unless `YELLOW_REQUIRE_ORDER304_DATABASE=1`, in which case the test
fails closed before execution.

## Order 305 — fresh-bootstrap India GST accommodation launch history

The live proof creates a disposable real PostgreSQL database, runs the complete
migration set, and then runs the production seed. It must establish exactly one
global `in-gst-lodging` predecessor/successor pair: retired v1 over
`[2022-07-17T18:30:00.000000Z,2025-09-21T18:30:00.000000Z)` with 12%-with-ITC then
18%-with-ITC bands, and active v2 over
`[2025-09-21T18:30:00.000000Z,infinity)` with 5%-without-ITC then 18%-with-ITC
bands. Both use the INR 7,500 threshold and preserve the unchanged 5% `GST_FNB`
example.

The proof must cover first insert, exact replay with no new audit/effect rows, a
collision that rolls the complete seed transaction back without repair, exact
runtime visibility of both rows, and the existing active-only resolver returning
v2. Resolver reads must leave extension, fact, outbox, journal, posting, document
and fiscal-submission snapshots unchanged. It must not touch an installed database
or select retired content for a stay. Missing `YELLOW_ORDER305_*` configuration
skips this live block; `YELLOW_REQUIRE_ORDER305_DATABASE=1` with no explicit
Order305 deploy/admin URL fails before execution.

## Order 306 — historical India GST accommodation resolution

The live proof creates a disposable PostgreSQL database, applies all migrations, runs
the exact Order305 fresh seed, and adds only bounded tenant/property/assignment test
fixtures. It must establish that one active same-tenant property and one exact
`in-gst-lodging` assignment resolve whole Kolkata local days before the cutover to
retired v1 and days at/after the cutover to active v2. A foreign property is concealed
from the wrong tenant while its own tenant can resolve it. PostgreSQL-derived DST
23/25-hour and awkward-offset envelopes are asserted where the database permits.

The proof must reject a local day whose UTC envelope crosses the Kolkata cutover,
return recursively frozen tenant-hidden evidence with a deterministic hash, and leave
extension, assignment, fact, outbox, journal, posting, document and fiscal-submission
snapshots byte-identical across repeated successful and failed reads. It must use a
transaction-local tenant setting and `app_role`, and must never choose by clock,
latest/max version or caller extension id, mutate installed data, select a retired rate
for a stay, calculate tax, apply section 14, or touch downstream fiscal/API/UI state.
Missing `YELLOW_ORDER306_*` URLs skip this live block; setting
`YELLOW_REQUIRE_ORDER306_DATABASE=1` without explicit deploy/admin and runtime URLs
fails before execution.
