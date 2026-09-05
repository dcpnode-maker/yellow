import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import {
  REVIEW_APPROVER_ROLE_NAME,
  REVIEW_PERMISSIONS,
  REVIEW_ROLE_NAME,
  runReviewSeed,
} from "../scripts/seed-review";
import { runSeed } from "../scripts/seed";

const DATABASE_URL = process.env.YELLOW_DEPLOY_DATABASE_URL;
const PASSWORD = process.env.YELLOW_REVIEW_SEED_PASSWORD;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_BUSINESS_DAY_READ_PERMISSION === "1";
const PERMISSION = Object.freeze({
  code: "financials.business-days:read",
  description: "Read governed property business-day close truth",
});

if (REQUIRE_DATABASE && (!DATABASE_URL || !PASSWORD)) {
  throw new Error(
    "YELLOW_DEPLOY_DATABASE_URL and YELLOW_REVIEW_SEED_PASSWORD are required by the Order 385 proof",
  );
}

const databaseDescribe = DATABASE_URL && PASSWORD ? describe.serial : describe.skip;
let admin: SQL | undefined;

async function permissionGrants() {
  return admin!<Array<{ role_name: string; permission_code: string }>>`
    SELECT role.name AS role_name, role_permission.permission_code
      FROM role_permission
      JOIN role ON role.id=role_permission.role_id
     WHERE role_permission.permission_code=${PERMISSION.code}
     ORDER BY role.name, role.id
  `;
}

async function allRoleGrants() {
  return admin!<Array<{ role_id: string; permission_code: string }>>`
    SELECT role_id::text, permission_code
      FROM role_permission
     ORDER BY role_id, permission_code
  `;
}

databaseDescribe("Order 385 business-day read permission", () => {
  beforeAll(() => { admin = new SQL(DATABASE_URL!); });
  afterAll(async () => { await admin?.close(); admin = undefined; });

  test("P1: migration adds exactly one canonical catalogue row and grants no role", async () => {
    expect(await admin!<Array<{ code: string; description: string }>>`
      SELECT code,description FROM permission WHERE code=${PERMISSION.code}
    `)
      .toEqual([{ code: PERMISSION.code, description: PERMISSION.description }]);
    expect(await permissionGrants()).toEqual([]);
  });

  test("P2: ordinary review provisioning grants it exactly once and excludes the post-seal approver", async () => {
    await runSeed({ databaseUrl: DATABASE_URL!, logger: () => undefined });
    await runReviewSeed({
      databaseUrl: DATABASE_URL!,
      password: PASSWORD!,
      mode: "identity_inventory",
      logger: () => undefined,
    });

    expect(REVIEW_PERMISSIONS.filter(({ code }) => code === PERMISSION.code)).toEqual([PERMISSION]);
    expect(await permissionGrants()).toEqual([
      { role_name: REVIEW_ROLE_NAME, permission_code: PERMISSION.code },
    ]);
    expect(await admin!<Array<{ count: number }>>`
      SELECT count(*)::int AS count
        FROM role_permission
        JOIN role ON role.id=role_permission.role_id
       WHERE role.name=${REVIEW_APPROVER_ROLE_NAME}
         AND role_permission.permission_code=${PERMISSION.code}
    `).toEqual([{ count: 0 }]);
  });

  test("P3: review-seed replay is idempotent and changes no unrelated role grant", async () => {
    const before = await allRoleGrants();
    await runReviewSeed({
      databaseUrl: DATABASE_URL!,
      password: PASSWORD!,
      mode: "identity_inventory",
      logger: () => undefined,
    });
    expect(await allRoleGrants()).toEqual(before);
    expect(await permissionGrants()).toHaveLength(1);
  });
});
