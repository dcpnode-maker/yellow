import { Database, type Tx } from "../kernel";

export const DEMO_TENANT_ID = "6d9b7ce2-2d14-5576-b8c3-80f06501a603";
export const DEMO_PROPERTY_NODE = "4518a22f-b455-54c6-a50a-4584383749b9";
export const DEMO_ROOM_CODE = "303";
export const DEMO_ROOM_MOVE_TO_CODE = "305";
export const DEMO_CONFIRMATION_NO = "L3R-HX-0126";
export const DEMO_ACTOR_ID = "00000000-0000-0000-0000-000000000651";
export const DEMO_BUSINESS_DATE = "2026-09-23";

export const DEMO_IDS = Object.freeze({
  party: "00000000-0000-4000-8000-000000000652",
  unitType: "00000000-0000-4000-8000-000000006520",
  sellableUnit: "00000000-0000-4000-8000-000000006521",
  ratePlan: "00000000-0000-4000-8000-000000006522",
  account: "00000000-0000-4000-8000-000000006523",
  folio: "00000000-0000-4000-8000-000000006524",
  reservation: "00000000-0000-4000-8000-000000006525",
  segment: "00000000-0000-4000-8000-000000006526",
  revenueAccount: "00000000-0000-4000-8000-000000006527",
  cashAccount: "00000000-0000-4000-8000-000000006528",
  cashInstrument: "00000000-0000-4000-8000-000000006529",
  roomMoveSellableUnit: "00000000-0000-4000-8000-00000000652a",
  roomMoveSegment: "00000000-0000-4000-8000-00000000652b",
});

export interface DemoArrivalProvisionResult {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly confirmationNo: string;
  readonly roomCode: string;
  readonly reservationStatus: string;
  readonly segmentStatus: string;
  readonly folioStatus: string;
  readonly guestAccountId: string;
  readonly revenueAccountId: string;
  readonly cashAccountId: string;
  readonly cashInstrumentId: string;
}

interface ProvisionRow {
  readonly reservation_status: string;
  readonly segment_status: string;
  readonly folio_status: string;
  readonly guest_account_id: string;
  readonly revenue_account_id: string;
  readonly cash_account_id: string;
  readonly cash_instrument_id: string;
}

export async function provisionDemoArrivalFixture(databaseUrl: string): Promise<DemoArrivalProvisionResult> {
  const database = Database.connect(databaseUrl, { maxConnections: 1, prepare: false });
  try {
    return await database.withTenantTransaction(DEMO_TENANT_ID, async (tx) => {
      await upsertDemoArrivalFixture(tx);
      return readProvisionedFixture(tx);
    });
  } finally {
    database.close();
  }
}

async function upsertDemoArrivalFixture(tx: Tx): Promise<void> {
  await tx`
    INSERT INTO tenant (id, slug, name)
    VALUES (${DEMO_TENANT_ID}::uuid, 'yellow-demo', 'Yellow Demo Tenant')
    ON CONFLICT (id) DO NOTHING
  `;
  await tx`
    INSERT INTO org_node (id, tenant_id, path, kind, name, timezone, currency, config)
    VALUES (${DEMO_PROPERTY_NODE}::uuid, ${DEMO_TENANT_ID}::uuid, 'yellow.demo'::ltree, 'property', 'Yellow Grand Demo Hotel', 'Asia/Kolkata', 'INR', '{"demo": true}'::jsonb)
    ON CONFLICT (id) DO NOTHING
  `;
  await tx`
    INSERT INTO party (id, tenant_id, kind, display_name, legal_name, attrs, vip_code, status)
    VALUES (${DEMO_IDS.party}::uuid, ${DEMO_TENANT_ID}::uuid, 'person', 'Sara Al Harbi', 'Sara Al Harbi', '{"demo": true, "language": "en-IN"}'::jsonb, 'VIP', 'active')
    ON CONFLICT (id) DO NOTHING
  `;
  await tx`
    INSERT INTO unit_type (id, tenant_id, property_node, code, name, profile_key, base_occupancy, max_occupancy, attrs, sort_order)
    VALUES (${DEMO_IDS.unitType}::uuid, ${DEMO_TENANT_ID}::uuid, ${DEMO_PROPERTY_NODE}::uuid, 'DLX', 'Deluxe King', 'hotel', 2, 3, '{"demo": true}'::jsonb, 20)
    ON CONFLICT (tenant_id, property_node, code) DO NOTHING
  `;
  await tx`
    INSERT INTO space (tenant_id, property_node, code, profile_key, capacity, max_occupancy, floor, area_sqm, status, attrs)
    VALUES (${DEMO_TENANT_ID}::uuid, ${DEMO_PROPERTY_NODE}::uuid, ${DEMO_ROOM_CODE}, 'hotel', 1, 2, '3', 30.0, 'active', '{"demo": true}'::jsonb)
    ON CONFLICT (tenant_id, property_node, code) DO NOTHING
  `;
  await tx`
    INSERT INTO space (tenant_id, property_node, code, profile_key, capacity, max_occupancy, floor, area_sqm, status, attrs)
    VALUES (${DEMO_TENANT_ID}::uuid, ${DEMO_PROPERTY_NODE}::uuid, ${DEMO_ROOM_MOVE_TO_CODE}, 'hotel', 1, 2, '3', 30.0, 'active', '{"demo": true, "roomMoveTarget": true}'::jsonb)
    ON CONFLICT (tenant_id, property_node, code) DO NOTHING
  `;
  await tx`
    INSERT INTO unit_condition (tenant_id, space_id, condition, updated_by)
    SELECT ${DEMO_TENANT_ID}::uuid, space.id, 'inspected', ${DEMO_ACTOR_ID}::uuid
      FROM space
     WHERE space.tenant_id = ${DEMO_TENANT_ID}::uuid
       AND space.property_node = ${DEMO_PROPERTY_NODE}::uuid
       AND space.code = ${DEMO_ROOM_CODE}
    ON CONFLICT (space_id) DO UPDATE
      SET condition = 'inspected',
          updated_at = now(),
          updated_by = ${DEMO_ACTOR_ID}::uuid
  `;
  await tx`
    INSERT INTO unit_condition (tenant_id, space_id, condition, updated_by)
    SELECT ${DEMO_TENANT_ID}::uuid, space.id, 'inspected', ${DEMO_ACTOR_ID}::uuid
      FROM space
     WHERE space.tenant_id = ${DEMO_TENANT_ID}::uuid
       AND space.property_node = ${DEMO_PROPERTY_NODE}::uuid
       AND space.code = ${DEMO_ROOM_MOVE_TO_CODE}
    ON CONFLICT (space_id) DO UPDATE
      SET condition = 'inspected',
          updated_at = now(),
          updated_by = ${DEMO_ACTOR_ID}::uuid
  `;
  await tx`
    INSERT INTO sellable_unit (id, tenant_id, unit_type_id, name, status)
    VALUES (${DEMO_IDS.sellableUnit}::uuid, ${DEMO_TENANT_ID}::uuid, ${DEMO_IDS.unitType}::uuid, 'Room 303 sellable unit', 'active')
    ON CONFLICT (id) DO NOTHING
  `;
  await tx`
    INSERT INTO sellable_unit (id, tenant_id, unit_type_id, name, status)
    VALUES (${DEMO_IDS.roomMoveSellableUnit}::uuid, ${DEMO_TENANT_ID}::uuid, ${DEMO_IDS.unitType}::uuid, 'Room 305 sellable unit', 'active')
    ON CONFLICT (id) DO NOTHING
  `;
  await tx`
    INSERT INTO sellable_unit_space (tenant_id, sellable_unit_id, space_id, claim_mode)
    SELECT ${DEMO_TENANT_ID}::uuid, ${DEMO_IDS.sellableUnit}::uuid, space.id, 'exclusive'
      FROM space
     WHERE space.tenant_id = ${DEMO_TENANT_ID}::uuid
       AND space.property_node = ${DEMO_PROPERTY_NODE}::uuid
       AND space.code = ${DEMO_ROOM_CODE}
    ON CONFLICT (sellable_unit_id, space_id) DO NOTHING
  `;
  await tx`
    INSERT INTO sellable_unit_space (tenant_id, sellable_unit_id, space_id, claim_mode)
    SELECT ${DEMO_TENANT_ID}::uuid, ${DEMO_IDS.roomMoveSellableUnit}::uuid, space.id, 'exclusive'
      FROM space
     WHERE space.tenant_id = ${DEMO_TENANT_ID}::uuid
       AND space.property_node = ${DEMO_PROPERTY_NODE}::uuid
       AND space.code = ${DEMO_ROOM_MOVE_TO_CODE}
    ON CONFLICT (sellable_unit_id, space_id) DO NOTHING
  `;
  await tx`
    INSERT INTO rate_plan (id, tenant_id, property_node, code, name, currency, tax_inclusive, market_code, source_code, status)
    VALUES (${DEMO_IDS.ratePlan}::uuid, ${DEMO_TENANT_ID}::uuid, ${DEMO_PROPERTY_NODE}::uuid, 'BAR-BB', 'Best Available Rate with Breakfast', 'INR', true, 'OTA-RETAIL', 'WEBSITE', 'active')
    ON CONFLICT (tenant_id, property_node, code) DO NOTHING
  `;
  await tx`
    INSERT INTO account (id, tenant_id, property_node, role, party_id, name, currency, status)
    VALUES (${DEMO_IDS.account}::uuid, ${DEMO_TENANT_ID}::uuid, ${DEMO_PROPERTY_NODE}::uuid, 'guest', ${DEMO_IDS.party}::uuid, 'Sara Al Harbi guest account', 'INR', 'open')
    ON CONFLICT (id) DO NOTHING
  `;
  await tx`
    INSERT INTO account (id, tenant_id, property_node, role, party_id, name, currency, status)
    VALUES (${DEMO_IDS.revenueAccount}::uuid, ${DEMO_TENANT_ID}::uuid, ${DEMO_PROPERTY_NODE}::uuid, 'revenue', NULL, 'Demo room and outlet revenue', 'INR', 'open')
    ON CONFLICT (id) DO NOTHING
  `;
  await tx`
    INSERT INTO account (id, tenant_id, property_node, role, party_id, name, currency, status)
    VALUES (${DEMO_IDS.cashAccount}::uuid, ${DEMO_TENANT_ID}::uuid, ${DEMO_PROPERTY_NODE}::uuid, 'cash', NULL, 'Demo cashier cash clearing', 'INR', 'open')
    ON CONFLICT (id) DO NOTHING
  `;
  await tx`
    INSERT INTO tx_code (code, name, grp, usali_line, default_dr, default_cr)
    VALUES ('DEMOFOOD', 'Demo food and beverage charge', 'revenue', 'FNB', 'guest', 'revenue')
    ON CONFLICT (code) DO NOTHING
  `;
  await tx`
    INSERT INTO tx_code (code, name, grp, usali_line, default_dr, default_cr)
    VALUES ('DEMOCASH', 'Demo cash settlement', 'payment', 'PAYMENT', 'cash', 'guest')
    ON CONFLICT (code) DO NOTHING
  `;
  await tx`
    INSERT INTO payment_instrument (id, tenant_id, party_id, kind, token, brand, last4, expiry, psp, status)
    VALUES (${DEMO_IDS.cashInstrument}::uuid, ${DEMO_TENANT_ID}::uuid, ${DEMO_IDS.party}::uuid, 'cash_marker', 'demo-cash-marker', NULL, NULL, NULL, 'yellow-demo', 'active')
    ON CONFLICT (id) DO NOTHING
  `;
  await tx`
    INSERT INTO business_day (tenant_id, property_node, business_date, sealed_at, sealed_by)
    VALUES (${DEMO_TENANT_ID}::uuid, ${DEMO_PROPERTY_NODE}::uuid, ${DEMO_BUSINESS_DATE}::date, NULL, NULL)
    ON CONFLICT (property_node, business_date) DO NOTHING
  `;
  await tx`
    INSERT INTO reservation (
      id, tenant_id, property_node, confirmation_no, status, primary_party, booker_party,
      channel_code, market_code, source_code, currency, eta, notes
    )
    VALUES (
      ${DEMO_IDS.reservation}::uuid, ${DEMO_TENANT_ID}::uuid, ${DEMO_PROPERTY_NODE}::uuid, ${DEMO_CONFIRMATION_NO}, 'due_in',
      ${DEMO_IDS.party}::uuid, ${DEMO_IDS.party}::uuid, 'direct', 'OTA-RETAIL', 'WEBSITE', 'INR', TIME WITH TIME ZONE '14:00+05:30',
      'Deterministic public-demo arrival fixture.'
    )
    ON CONFLICT (tenant_id, confirmation_no) DO NOTHING
  `;
  await tx`
    INSERT INTO reservation_segment (
      id, tenant_id, reservation_id, seq, unit_type_id, sellable_unit_id, period, adults, children, rate_plan_id, status
    )
    VALUES (
      ${DEMO_IDS.segment}::uuid, ${DEMO_TENANT_ID}::uuid, ${DEMO_IDS.reservation}::uuid, 1,
      ${DEMO_IDS.unitType}::uuid, ${DEMO_IDS.sellableUnit}::uuid,
      tstzrange(TIMESTAMPTZ '2026-09-23 14:00:00+05:30', TIMESTAMPTZ '2026-09-24 11:00:00+05:30', '[)'),
      1, '[]'::jsonb, ${DEMO_IDS.ratePlan}::uuid, 'booked'
    )
    ON CONFLICT (reservation_id, seq) DO NOTHING
  `;
  await tx`
    INSERT INTO reservation_guest (tenant_id, reservation_id, party_id, role, share_pct)
    VALUES (${DEMO_TENANT_ID}::uuid, ${DEMO_IDS.reservation}::uuid, ${DEMO_IDS.party}::uuid, 'primary', 100.00)
    ON CONFLICT (reservation_id, party_id) DO NOTHING
  `;
  await tx`
    INSERT INTO folio (id, tenant_id, account_id, reservation_id, folio_no, window_no, name, status)
    VALUES (${DEMO_IDS.folio}::uuid, ${DEMO_TENANT_ID}::uuid, ${DEMO_IDS.account}::uuid, ${DEMO_IDS.reservation}::uuid, 'FOL-DEMO-303', 1, 'Guest folio · Sara Al Harbi', 'open')
    ON CONFLICT (id) DO NOTHING
  `;
}

async function readProvisionedFixture(tx: Tx): Promise<DemoArrivalProvisionResult> {
  const rows = await tx<ProvisionRow[]>`
    SELECT reservation.status AS reservation_status,
           segment.status AS segment_status,
           folio.status AS folio_status,
           guest_account.id::text AS guest_account_id,
           revenue_account.id::text AS revenue_account_id,
           cash_account.id::text AS cash_account_id,
           cash_instrument.id::text AS cash_instrument_id
      FROM reservation
      JOIN reservation_segment segment ON segment.tenant_id = reservation.tenant_id AND segment.reservation_id = reservation.id
      JOIN folio ON folio.tenant_id = reservation.tenant_id AND folio.reservation_id = reservation.id
      JOIN account guest_account ON guest_account.tenant_id = reservation.tenant_id AND guest_account.id = folio.account_id
      JOIN account revenue_account ON revenue_account.tenant_id = reservation.tenant_id AND revenue_account.id = ${DEMO_IDS.revenueAccount}::uuid
      JOIN account cash_account ON cash_account.tenant_id = reservation.tenant_id AND cash_account.id = ${DEMO_IDS.cashAccount}::uuid
      JOIN payment_instrument cash_instrument ON cash_instrument.tenant_id = reservation.tenant_id AND cash_instrument.id = ${DEMO_IDS.cashInstrument}::uuid
     WHERE reservation.tenant_id = ${DEMO_TENANT_ID}::uuid
       AND reservation.confirmation_no = ${DEMO_CONFIRMATION_NO}
       AND segment.id = ${DEMO_IDS.segment}::uuid
       AND folio.id = ${DEMO_IDS.folio}::uuid
     LIMIT 1
  `;
  const row = rows[0];
  if (row === undefined) throw new Error("demo arrival fixture was not provisioned");
  return Object.freeze({
    tenantId: DEMO_TENANT_ID,
    propertyNode: DEMO_PROPERTY_NODE,
    confirmationNo: DEMO_CONFIRMATION_NO,
    roomCode: DEMO_ROOM_CODE,
    reservationStatus: row.reservation_status,
    segmentStatus: row.segment_status,
    folioStatus: row.folio_status,
    guestAccountId: row.guest_account_id,
    revenueAccountId: row.revenue_account_id,
    cashAccountId: row.cash_account_id,
    cashInstrumentId: row.cash_instrument_id,
  });
}
