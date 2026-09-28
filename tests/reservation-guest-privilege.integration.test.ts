import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

const DATABASE_URL = process.env.YELLOW_RESERVATION_GUEST_PRIVILEGE_URL;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_RESERVATION_GUEST_PRIVILEGE === "1";

const TENANT_A = "00000000-0000-0000-0000-000000009401";
const TENANT_B = "00000000-0000-0000-0000-000000009402";
const PROPERTY_A = "00000000-0000-0000-0000-000000009411";
const PROPERTY_B = "00000000-0000-0000-0000-000000009412";
const PRIMARY_A = "00000000-0000-0000-0000-000000009421";
const GUEST_A = "00000000-0000-0000-0000-000000009422";
const PRIMARY_B = "00000000-0000-0000-0000-000000009423";
const GUEST_B = "00000000-0000-0000-0000-000000009424";
const RESERVATION_A = "00000000-0000-0000-0000-000000009431";
const RESERVATION_B = "00000000-0000-0000-0000-000000009432";

if (REQUIRE_DATABASE && !DATABASE_URL) {
  throw new Error("YELLOW_RESERVATION_GUEST_PRIVILEGE_URL is required by the Order 094 proof");
}

const databaseDescribe = DATABASE_URL ? describe.serial : describe.skip;
let admin: SQL | undefined;

beforeAll(async () => {
  if (!DATABASE_URL) return;
  admin = new SQL(DATABASE_URL, { max: 4 });
  await admin`
    INSERT INTO tenant (id, slug, name, tier, status)
    VALUES
      (${TENANT_A}::uuid, 'order094-a', 'Order 094 A', 'shared', 'active'),
      (${TENANT_B}::uuid, 'order094-b', 'Order 094 B', 'shared', 'active')
  `;
  await admin`
    INSERT INTO org_node (id, tenant_id, path, kind, name, timezone, currency)
    VALUES
      (${PROPERTY_A}::uuid, ${TENANT_A}::uuid, 'order094_a', 'property', 'Order 094 A', 'UTC', 'USD'),
      (${PROPERTY_B}::uuid, ${TENANT_B}::uuid, 'order094_b', 'property', 'Order 094 B', 'UTC', 'EUR')
  `;
  await admin`
    INSERT INTO party (id, tenant_id, kind, display_name, status)
    VALUES
      (${PRIMARY_A}::uuid, ${TENANT_A}::uuid, 'person', 'Order 094 Primary A', 'active'),
      (${GUEST_A}::uuid, ${TENANT_A}::uuid, 'person', 'Order 094 Guest A', 'active'),
      (${PRIMARY_B}::uuid, ${TENANT_B}::uuid, 'person', 'Order 094 Primary B', 'active'),
      (${GUEST_B}::uuid, ${TENANT_B}::uuid, 'person', 'Order 094 Guest B', 'active')
  `;
  await admin`
    INSERT INTO reservation (id, tenant_id, property_node, confirmation_no, primary_party, currency)
    VALUES
      (${RESERVATION_A}::uuid, ${TENANT_A}::uuid, ${PROPERTY_A}::uuid, 'O94-A', ${PRIMARY_A}::uuid, 'USD'),
      (${RESERVATION_B}::uuid, ${TENANT_B}::uuid, ${PROPERTY_B}::uuid, 'O94-B', ${PRIMARY_B}::uuid, 'EUR')
  `;
  await admin`
    INSERT INTO reservation_guest (tenant_id, reservation_id, party_id, role, share_pct)
    VALUES
      (${TENANT_A}::uuid, ${RESERVATION_A}::uuid, ${PRIMARY_A}::uuid, 'primary', NULL),
      (${TENANT_A}::uuid, ${RESERVATION_A}::uuid, ${GUEST_A}::uuid, 'accompanying', NULL),
      (${TENANT_B}::uuid, ${RESERVATION_B}::uuid, ${PRIMARY_B}::uuid, 'primary', NULL),
      (${TENANT_B}::uuid, ${RESERVATION_B}::uuid, ${GUEST_B}::uuid, 'accompanying', NULL)
  `;
});

afterAll(async () => {
  if (!admin) return;
  await admin`DELETE FROM reservation_guest WHERE reservation_id IN (${RESERVATION_A}::uuid, ${RESERVATION_B}::uuid)`;
  await admin`DELETE FROM reservation WHERE id IN (${RESERVATION_A}::uuid, ${RESERVATION_B}::uuid)`;
  await admin`DELETE FROM party WHERE id IN (${PRIMARY_A}::uuid, ${GUEST_A}::uuid, ${PRIMARY_B}::uuid, ${GUEST_B}::uuid)`;
  await admin`DELETE FROM org_node WHERE id IN (${PROPERTY_A}::uuid, ${PROPERTY_B}::uuid)`;
  await admin`DELETE FROM tenant WHERE id IN (${TENANT_A}::uuid, ${TENANT_B}::uuid)`;
  await admin.close();
  admin = undefined;
});

databaseDescribe("Order 094 reservation-guest DELETE privilege", () => {
  test("P1: app_role receives only the named DELETE privilege while PUBLIC and protected tables remain denied", async () => {
    const rows = await admin!<Array<{
      reservation_guest_delete: boolean;
      public_delete: boolean;
      occupancy_delete: boolean;
      fact_delete: boolean;
      outbox_delete: boolean;
      journal_delete: boolean;
      posting_delete: boolean;
    }>>`
      SELECT
        has_table_privilege('app_role', 'reservation_guest', 'DELETE') AS reservation_guest_delete,
        has_table_privilege('public', 'reservation_guest', 'DELETE') AS public_delete,
        has_table_privilege('app_role', 'space_occupancy', 'DELETE') AS occupancy_delete,
        has_table_privilege('app_role', 'fact_log', 'DELETE') AS fact_delete,
        has_table_privilege('app_role', 'outbox', 'DELETE') AS outbox_delete,
        has_table_privilege('app_role', 'journal', 'DELETE') AS journal_delete,
        has_table_privilege('app_role', 'posting_line', 'DELETE') AS posting_delete
    `;
    expect(rows).toEqual([{
      reservation_guest_delete: true,
      public_delete: false,
      occupancy_delete: false,
      fact_delete: false,
      outbox_delete: false,
      journal_delete: false,
      posting_delete: false,
    }]);
  });

  test("P2: transaction-local tenant context deletes only the local non-primary guest and rollback restores it", async () => {
    const connection = await admin!.reserve();
    try {
      await connection.unsafe("BEGIN");
      await connection`SELECT set_config('app.tenant_id', ${TENANT_A}, true)`;
      await connection.unsafe("SET LOCAL ROLE app_role");
      const deleted = await connection<Array<{ tenant_id: string; party_id: string }>>`
        DELETE FROM reservation_guest
        WHERE reservation_id IN (${RESERVATION_A}::uuid, ${RESERVATION_B}::uuid)
          AND role <> 'primary'
        RETURNING tenant_id, party_id
      `;
      expect(deleted).toEqual([{ tenant_id: TENANT_A, party_id: GUEST_A }]);
      await connection.unsafe("ROLLBACK");
    } finally {
      connection.release();
    }

    const rows = await admin!<Array<{ tenant_id: string; party_id: string }>>`
      SELECT tenant_id, party_id
      FROM reservation_guest
      WHERE party_id IN (${GUEST_A}::uuid, ${GUEST_B}::uuid)
      ORDER BY tenant_id
    `;
    expect(rows).toEqual([
      { tenant_id: TENANT_A, party_id: GUEST_A },
      { tenant_id: TENANT_B, party_id: GUEST_B },
    ]);
  });
});

