import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import {
  REVIEW_APPROVER_EMAIL,
  REVIEW_APPROVER_ROLE_NAME,
  REVIEW_BUSINESS_DAY_SEAL_EDGE_PERMISSION,
  REVIEW_BUSINESS_DAY_SEAL_PERMISSION,
  REVIEW_DISCREPANCY_CARRY_PERMISSION,
  REVIEW_EMAIL,
  REVIEW_PERMISSIONS,
  REVIEW_ROLE_NAME,
  runReviewSeed,
} from "../scripts/seed-review";
import { runSeed, SEED_PROPERTY } from "../scripts/seed";

const DATABASE_URL = process.env.YELLOW_DEPLOY_DATABASE_URL;
const PASSWORD = process.env.YELLOW_REVIEW_SEED_PASSWORD;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_BUSINESS_DAY_SEAL_PERMISSION === "1";
const PERMISSION = REVIEW_BUSINESS_DAY_SEAL_PERMISSION;
const EDGE_PERMISSION = REVIEW_BUSINESS_DAY_SEAL_EDGE_PERMISSION;
const PERMISSION_CODES = [PERMISSION.code, EDGE_PERMISSION.code] as const;

if (REQUIRE_DATABASE && (!DATABASE_URL || !PASSWORD)) {
  throw new Error(
    "YELLOW_DEPLOY_DATABASE_URL and YELLOW_REVIEW_SEED_PASSWORD are required by the Order 388 proof",
  );
}

const databaseDescribe = DATABASE_URL && PASSWORD ? describe.serial : describe.skip;
let admin: SQL | undefined;

async function directGrants() {
  return admin!<Array<{ role_name: string; permission_code: string }>>`
    SELECT role.name AS role_name, role_permission.permission_code
      FROM role_permission
      JOIN role ON role.id=role_permission.role_id
     WHERE role_permission.permission_code IN (${PERMISSION.code}, ${EDGE_PERMISSION.code})
     ORDER BY role.name, role.id, role_permission.permission_code
  `;
}

async function effectiveGrants() {
  return admin!<Array<{ email: string; role_name: string; permission_code: string; scope_node: string }>>`
    SELECT app_user.email, role.name AS role_name, role_permission.permission_code,
           user_role.scope_node::text AS scope_node
      FROM user_role
      JOIN app_user ON app_user.id=user_role.user_id AND app_user.tenant_id=user_role.tenant_id
      JOIN role ON role.id=user_role.role_id AND role.tenant_id=user_role.tenant_id
      JOIN role_permission ON role_permission.role_id=role.id
     WHERE app_user.status='active'
       AND role_permission.permission_code IN (${PERMISSION.code}, ${EDGE_PERMISSION.code})
     ORDER BY app_user.email, role.name, role.id
  `;
}

async function allRoleGrants() {
  return admin!<Array<{ role_id: string; permission_code: string }>>`
    SELECT role_id::text, permission_code FROM role_permission ORDER BY role_id, permission_code
  `;
}

databaseDescribe("Order 388 business-day seal permission", () => {
  beforeAll(() => { admin = new SQL(DATABASE_URL!); });
  afterAll(async () => { await admin?.close(); admin = undefined; });

  test("P1: migration adds exactly two canonical catalogue rows and grants no role", async () => {
    expect(await admin!<Array<{ code: string; description: string }>>`
      SELECT code,description FROM permission
       WHERE code IN (${PERMISSION.code}, ${EDGE_PERMISSION.code}) ORDER BY code
    `).toEqual([PERMISSION, EDGE_PERMISSION]);
    expect(await directGrants()).toEqual([]);
    expect(await effectiveGrants()).toEqual([]);
  });

  test("P2: review seed grants both permissions only to the ordinary operator directly and effectively", async () => {
    await runSeed({ databaseUrl: DATABASE_URL!, logger: () => undefined });
    await runReviewSeed({
      databaseUrl: DATABASE_URL!, password: PASSWORD!, mode: "identity_inventory", logger: () => undefined,
    });

    expect(REVIEW_PERMISSIONS.filter(({ code }) => PERMISSION_CODES.includes(code as typeof PERMISSION_CODES[number])))
      .toEqual([EDGE_PERMISSION, PERMISSION]);
    expect(await directGrants()).toEqual([
      { role_name: REVIEW_ROLE_NAME, permission_code: PERMISSION.code },
      { role_name: REVIEW_ROLE_NAME, permission_code: EDGE_PERMISSION.code },
    ]);
    expect(await effectiveGrants()).toEqual([
      { email: REVIEW_EMAIL, role_name: REVIEW_ROLE_NAME, permission_code: PERMISSION.code,
        scope_node: SEED_PROPERTY.id },
      { email: REVIEW_EMAIL, role_name: REVIEW_ROLE_NAME, permission_code: EDGE_PERMISSION.code,
        scope_node: SEED_PROPERTY.id },
    ]);
  });

  test("P3: specialized approver explicitly excludes both seals and carry-maker authority", async () => {
    expect(await admin!<Array<{ email: string; permission_code: string }>>`
      SELECT app_user.email, role_permission.permission_code
        FROM user_role
        JOIN app_user ON app_user.id=user_role.user_id AND app_user.tenant_id=user_role.tenant_id
        JOIN role ON role.id=user_role.role_id AND role.tenant_id=user_role.tenant_id
        JOIN role_permission ON role_permission.role_id=role.id
       WHERE app_user.email=${REVIEW_APPROVER_EMAIL}
         AND role.name=${REVIEW_APPROVER_ROLE_NAME}
         AND role_permission.permission_code IN (
           ${PERMISSION.code}, ${EDGE_PERMISSION.code}, ${REVIEW_DISCREPANCY_CARRY_PERMISSION.code}
         )
       ORDER BY role_permission.permission_code
    `).toEqual([]);
  });

  test("P4: review-seed replay changes no direct grant and creates no extra effective grant", async () => {
    const before = await allRoleGrants();
    await runReviewSeed({
      databaseUrl: DATABASE_URL!, password: PASSWORD!, mode: "identity_inventory", logger: () => undefined,
    });
    expect(await allRoleGrants()).toEqual(before);
    expect(await directGrants()).toHaveLength(2);
    expect(await effectiveGrants()).toHaveLength(2);
  });
});
