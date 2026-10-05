import { Database, type Tx } from "../kernel";
import { DEMO_ACTOR_ID, DEMO_BUSINESS_DATE, DEMO_PROPERTY_NODE, DEMO_TENANT_ID } from "./demo-arrival-fixture";

export const DEMO_GROUP_BLOCK_CODE = "MEHRA-WED";

export const DEMO_GROUP_IDS = Object.freeze({
  accountParty: "00000000-0000-4000-8000-000000006560",
  group: "00000000-0000-4000-8000-000000006561",
  pickupGuestParty: "00000000-0000-4000-8000-000000006562",
  pickupUnitType: "00000000-0000-4000-8000-000000006563",
  pickupRatePlan: "00000000-0000-4000-8000-000000006564",
  roomingListGuestParty: "00000000-0000-4000-8000-000000006565",
});

export const DEMO_GROUP_PICKUP = Object.freeze({
  confirmationNo: "GRP-MEHRA-001",
  stayDate: "2026-10-03",
  departureDate: "2026-10-04",
  unitTypeCode: "DLX",
  blocked: 10,
  rateMinor: 780000,
  currency: "INR",
});

export interface DemoGroupBlockProvisionResult {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly blockCode: string;
  readonly groupId: string;
  readonly status: string;
  readonly tentativeDeducts: boolean;
  readonly definiteDeducts: boolean;
}

interface ProvisionRow {
  readonly group_id: string;
  readonly status: string;
  readonly tentative_deducts: boolean;
  readonly definite_deducts: boolean;
}

export async function provisionDemoGroupBlockFixture(databaseUrl: string): Promise<DemoGroupBlockProvisionResult> {
  const database = Database.connect(databaseUrl, { maxConnections: 1, prepare: false });
  try {
    return await database.withTenantTransaction(DEMO_TENANT_ID, async (tx) => {
      await upsertDemoGroupBlockFixture(tx);
      return readProvisionedGroupBlock(tx);
    });
  } finally {
    database.close();
  }
}

export async function upsertDemoGroupBlockFixture(tx: Tx): Promise<void> {
  await tx`
    INSERT INTO tenant (id, slug, name, tier, residency, status)
    VALUES (${DEMO_TENANT_ID}::uuid, 'yellow-demo', 'Yellow Demo', 'shared', 'me-central', 'active')
    ON CONFLICT (id) DO NOTHING
  `;
  await tx`
    INSERT INTO org_node (id, tenant_id, path, kind, name, timezone, currency, config)
    VALUES (${DEMO_PROPERTY_NODE}::uuid, ${DEMO_TENANT_ID}::uuid, 'yellow_demo.property'::ltree, 'property', 'Yellow Demo Property', 'UTC', 'USD', '{}'::jsonb)
    ON CONFLICT (tenant_id, path) DO NOTHING
  `;
  await tx`
    INSERT INTO party (id, tenant_id, kind, display_name, legal_name, attrs, status)
    VALUES (${DEMO_GROUP_IDS.accountParty}::uuid, ${DEMO_TENANT_ID}::uuid, 'org', 'Mehra Family Events', 'Mehra Family Events', '{"demo": true, "segment": "social"}'::jsonb, 'active')
    ON CONFLICT (id) DO NOTHING
  `;
  await tx`
    INSERT INTO party (id, tenant_id, kind, display_name, legal_name, attrs, status)
    VALUES (${DEMO_GROUP_IDS.pickupGuestParty}::uuid, ${DEMO_TENANT_ID}::uuid, 'person', 'Mehra Wedding Guest 01', 'Mehra Wedding Guest 01', '{"demo": true, "groupPickup": true}'::jsonb, 'active')
    ON CONFLICT (id) DO NOTHING
  `;
  await tx`
    INSERT INTO party (id, tenant_id, kind, display_name, legal_name, attrs, status)
    VALUES (${DEMO_GROUP_IDS.roomingListGuestParty}::uuid, ${DEMO_TENANT_ID}::uuid, 'person', 'Mehra Wedding Guest 02', 'Mehra Wedding Guest 02', '{"demo": true, "roomingList": true}'::jsonb, 'active')
    ON CONFLICT (id) DO NOTHING
  `;
  await tx`
    INSERT INTO block_status_def (tenant_id, code, deducts, sort)
    VALUES
      (${DEMO_TENANT_ID}::uuid, 'prospect', false, 10),
      (${DEMO_TENANT_ID}::uuid, 'tentative', false, 20),
      (${DEMO_TENANT_ID}::uuid, 'definite', true, 30),
      (${DEMO_TENANT_ID}::uuid, 'cancelled', false, 90)
    ON CONFLICT (tenant_id, code) DO UPDATE
      SET deducts = EXCLUDED.deducts,
          sort = EXCLUDED.sort
      WHERE block_status_def.deducts IS DISTINCT FROM EXCLUDED.deducts
         OR block_status_def.sort IS DISTINCT FROM EXCLUDED.sort
  `;
  await tx`
    INSERT INTO reservation_group (
      id, tenant_id, property_node, kind, code, name, account_party, status, cutoff_date, elastic, wash_schedule, master_folio
    )
    VALUES (
      ${DEMO_GROUP_IDS.group}::uuid, ${DEMO_TENANT_ID}::uuid, ${DEMO_PROPERTY_NODE}::uuid,
      'block', ${DEMO_GROUP_BLOCK_CODE}, 'Mehra Wedding', ${DEMO_GROUP_IDS.accountParty}::uuid,
      'tentative', ${DEMO_BUSINESS_DATE}::date + 5, true,
      '[{"days_before":5,"release_pct":50}]'::jsonb, NULL
    )
    ON CONFLICT (tenant_id, property_node, code) DO NOTHING
  `;
  await tx`
    INSERT INTO unit_type (id, tenant_id, property_node, code, name, profile_key, base_occupancy, max_occupancy, attrs, sort_order)
    VALUES (${DEMO_GROUP_IDS.pickupUnitType}::uuid, ${DEMO_TENANT_ID}::uuid, ${DEMO_PROPERTY_NODE}::uuid, ${DEMO_GROUP_PICKUP.unitTypeCode}, 'Deluxe King', 'hotel', 2, 3, '{"demo": true, "groupPickup": true}'::jsonb, 20)
    ON CONFLICT (tenant_id, property_node, code) DO NOTHING
  `;
  await tx`
    INSERT INTO rate_plan (id, tenant_id, property_node, code, name, currency, tax_inclusive, market_code, source_code, status)
    VALUES (${DEMO_GROUP_IDS.pickupRatePlan}::uuid, ${DEMO_TENANT_ID}::uuid, ${DEMO_PROPERTY_NODE}::uuid, 'GRP-BB', 'Group Bed and Breakfast', ${DEMO_GROUP_PICKUP.currency}, true, 'GROUPS-SOCIAL', 'EVENTS', 'active')
    ON CONFLICT (tenant_id, property_node, code) DO NOTHING
  `;
  await tx`
    INSERT INTO block_allotment (tenant_id, group_id, unit_type_id, stay_date, blocked, rate_override)
    VALUES (
      ${DEMO_TENANT_ID}::uuid, ${DEMO_GROUP_IDS.group}::uuid, ${DEMO_GROUP_IDS.pickupUnitType}::uuid,
      ${DEMO_GROUP_PICKUP.stayDate}::date, ${DEMO_GROUP_PICKUP.blocked},
      ${JSON.stringify({ amount_minor: DEMO_GROUP_PICKUP.rateMinor, currency: DEMO_GROUP_PICKUP.currency })}::jsonb
    )
    ON CONFLICT (group_id, unit_type_id, stay_date) DO NOTHING
  `;
}

export async function readProvisionedGroupBlock(tx: Tx): Promise<DemoGroupBlockProvisionResult> {
  const rows = await tx<ProvisionRow[]>`
    SELECT reservation_group.id::text AS group_id,
           reservation_group.status AS status,
           tentative.deducts AS tentative_deducts,
           definite.deducts AS definite_deducts
      FROM reservation_group
      JOIN block_status_def tentative ON tentative.tenant_id = reservation_group.tenant_id AND tentative.code = 'tentative'
      JOIN block_status_def definite ON definite.tenant_id = reservation_group.tenant_id AND definite.code = 'definite'
     WHERE reservation_group.tenant_id = ${DEMO_TENANT_ID}::uuid
       AND reservation_group.property_node = ${DEMO_PROPERTY_NODE}::uuid
       AND reservation_group.code = ${DEMO_GROUP_BLOCK_CODE}
     LIMIT 1
  `;
  const row = rows[0];
  if (row === undefined) throw new Error("demo group block fixture was not provisioned");
  return Object.freeze({
    tenantId: DEMO_TENANT_ID,
    propertyNode: DEMO_PROPERTY_NODE,
    blockCode: DEMO_GROUP_BLOCK_CODE,
    groupId: row.group_id,
    status: row.status,
    tentativeDeducts: row.tentative_deducts,
    definiteDeducts: row.definite_deducts,
  });
}
