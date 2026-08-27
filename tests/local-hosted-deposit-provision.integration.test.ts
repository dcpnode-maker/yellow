import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import {
  LOCAL_HOSTED_DEPOSIT_PERMISSIONS,
  provisionLocalHostedDepositUat,
} from "../scripts/provision-local-hosted-deposit-uat";
import { PROPERTY_NAME, SEED_PROPERTY, SEED_TENANT } from "../scripts/seed";
import { REVIEW_ROLE_NAME } from "../scripts/seed-review";
import { uuidV5 } from "../scripts/lib/uuid-v5";

const DATABASE_URL = process.env.YELLOW_LOCAL_HOSTED_DEPOSIT_PROVISION_URL;
if (process.env.YELLOW_REQUIRE_LOCAL_HOSTED_DEPOSIT_PROVISION === "1" && !DATABASE_URL) {
  throw new Error("YELLOW_LOCAL_HOSTED_DEPOSIT_PROVISION_URL is required by the Order 194 provisioner proof");
}

describe("Order 194 local hosted-deposit provisioner", () => {
  test("P0 exports only the three fixed payment/deposit permissions", () => {
    expect(LOCAL_HOSTED_DEPOSIT_PERMISSIONS.map(({ code }) => code)).toEqual([
      "financials.payments:read",
      "financials.payments:write",
      "financials.deposits:apply",
    ]);
  });

  test("P0 rejects non-loopback database authority before opening a connection", async () => {
    await expect(provisionLocalHostedDepositUat({
      databaseUrl: "postgresql://yellow_deploy:do-not-use@example.com/yellow",
      logger: () => undefined,
    })).rejects.toThrow("restricted to a loopback PostgreSQL host");
  });

  test("P0 rejects incomplete deployment authority before opening a connection", async () => {
    await expect(provisionLocalHostedDepositUat({
      databaseUrl: "postgresql://yellow_deploy@127.0.0.1/yellow",
      logger: () => undefined,
    })).rejects.toThrow("must include deployment credentials");
  });
});

let admin: SQL | undefined;
let ids: { cardClearing: string; depositLiability: string; instrument: string };

async function artifactCounts(): Promise<Record<string, number>> {
  const rows = await admin!<Array<Record<string, number>>>`
    SELECT
      (SELECT count(*)::int FROM hosted_payment_request WHERE tenant_id=${SEED_TENANT.id}::uuid) hosted_requests,
      (SELECT count(*)::int FROM payment_operation WHERE tenant_id=${SEED_TENANT.id}::uuid) payment_operations,
      (SELECT count(*)::int FROM provider_event_receipt WHERE tenant_id=${SEED_TENANT.id}::uuid) provider_receipts,
      (SELECT count(*)::int FROM payment WHERE tenant_id=${SEED_TENANT.id}::uuid) payment_attempts,
      (SELECT count(*)::int FROM deposit_application WHERE tenant_id=${SEED_TENANT.id}::uuid) deposit_applications,
      (SELECT count(*)::int FROM journal WHERE tenant_id=${SEED_TENANT.id}::uuid) journals,
      (SELECT count(*)::int FROM posting_line WHERE tenant_id=${SEED_TENANT.id}::uuid) posting_lines`;
  return rows[0]!;
}

async function fixtureCounts() {
  const rows = await admin!<Array<Record<string, number>>>`
    SELECT
      (SELECT count(*)::int FROM role_permission rp JOIN role r ON r.id=rp.role_id
        WHERE r.tenant_id=${SEED_TENANT.id}::uuid AND r.name=${REVIEW_ROLE_NAME}
          AND rp.permission_code IN (${LOCAL_HOSTED_DEPOSIT_PERMISSIONS[0]!.code},
            ${LOCAL_HOSTED_DEPOSIT_PERMISSIONS[1]!.code},${LOCAL_HOSTED_DEPOSIT_PERMISSIONS[2]!.code})) permissions,
      (SELECT count(*)::int FROM account WHERE id IN (${ids.cardClearing}::uuid,${ids.depositLiability}::uuid)) accounts,
      (SELECT count(*)::int FROM tx_code WHERE code IN ('CARD_PAYMENT','DEP')) transaction_codes,
      (SELECT count(*)::int FROM tx_code_route WHERE tenant_id=${SEED_TENANT.id}::uuid
        AND property_node=${SEED_PROPERTY.id}::uuid AND currency='USD' AND tx_code IN ('CARD_PAYMENT','DEP')) routes,
      (SELECT count(*)::int FROM payment_instrument WHERE id=${ids.instrument}::uuid) instruments`;
  return rows[0]!;
}

async function removeOrder194Fixture(): Promise<void> {
  await admin!.begin(async (tx) => {
    await tx`DELETE FROM role_permission WHERE permission_code IN (${LOCAL_HOSTED_DEPOSIT_PERMISSIONS[0]!.code},
      ${LOCAL_HOSTED_DEPOSIT_PERMISSIONS[1]!.code},${LOCAL_HOSTED_DEPOSIT_PERMISSIONS[2]!.code})
      AND role_id IN (SELECT id FROM role WHERE tenant_id=${SEED_TENANT.id}::uuid AND name=${REVIEW_ROLE_NAME})`;
    await tx`DELETE FROM tx_code_route WHERE tenant_id=${SEED_TENANT.id}::uuid
      AND property_node=${SEED_PROPERTY.id}::uuid AND currency='USD' AND tx_code IN ('CARD_PAYMENT','DEP')`;
    await tx`DELETE FROM tx_code WHERE code IN ('CARD_PAYMENT','DEP')`;
    await tx`DELETE FROM payment_instrument WHERE id=${ids.instrument}::uuid`;
    await tx`DELETE FROM account WHERE id IN (${ids.cardClearing}::uuid,${ids.depositLiability}::uuid)`;
  });
}

(DATABASE_URL ? describe.serial : describe.skip)("Order 194 disposable database provisioner proof", () => {
  beforeAll(async () => {
    admin = new SQL(DATABASE_URL!, { max: 2 });
    const base = await admin<Array<{ party_id: string }>>`
      SELECT a.party_id::text FROM folio f JOIN account a ON a.tenant_id=f.tenant_id AND a.id=f.account_id
      WHERE f.tenant_id=${SEED_TENANT.id}::uuid AND f.folio_no='FOL-1' AND f.window_no=1
        AND a.property_node=${SEED_PROPERTY.id}::uuid AND a.currency='USD'`;
    if (base.length !== 1 || !base[0]?.party_id) {
      throw new Error("Disposable Order 194 database must contain the canonical Yellow Demo FOL-1 USD guest");
    }
    ids = {
      cardClearing: await uuidV5(SEED_TENANT.id, `${PROPERTY_NAME}/order194/card-clearing/USD`),
      depositLiability: await uuidV5(SEED_TENANT.id, `${PROPERTY_NAME}/order194/deposit-liability/USD`),
      instrument: await uuidV5(SEED_TENANT.id,
        `${PROPERTY_NAME}/order194/local-deposit-instrument/${base[0].party_id}`),
    };
    await removeOrder194Fixture();
  });

  afterAll(async () => {
    await removeOrder194Fixture();
    await admin?.close();
  });

  test("P1 first run and replay are exact and create zero financial artifacts", async () => {
    const before = await artifactCounts();
    const first = await provisionLocalHostedDepositUat({ databaseUrl: DATABASE_URL!, logger: () => undefined });
    expect(await fixtureCounts()).toEqual({ permissions: 3, accounts: 2, transaction_codes: 2, routes: 2,
      instruments: 1 });
    expect(await artifactCounts()).toEqual(before);

    const replay = await provisionLocalHostedDepositUat({ databaseUrl: DATABASE_URL!, logger: () => undefined });
    expect(replay).toEqual({ ...first,
      permissions: Object.fromEntries(LOCAL_HOSTED_DEPOSIT_PERMISSIONS.map(({ code }) => [code, "already exact"])),
      accounts: { cardClearing: "already exact", depositLiability: "already exact" },
      transactionCodes: { CARD_PAYMENT: "already exact", DEP: "already exact" },
      routes: { CARD_PAYMENT: "already exact", DEP: "already exact" }, instrument: "already exact" });
    expect(await fixtureCounts()).toEqual({ permissions: 3, accounts: 2, transaction_codes: 2, routes: 2,
      instruments: 1 });
    expect(await artifactCounts()).toEqual(before);
  });

  test("P2 collision fails atomically and a repaired exact replay converges", async () => {
    const permission = LOCAL_HOSTED_DEPOSIT_PERMISSIONS[0]!.code;
    await admin!`DELETE FROM role_permission WHERE permission_code=${permission}
      AND role_id IN (SELECT id FROM role WHERE tenant_id=${SEED_TENANT.id}::uuid AND name=${REVIEW_ROLE_NAME})`;
    await admin!`UPDATE account SET name='deliberate Order 194 collision' WHERE id=${ids.cardClearing}::uuid`;
    const before = await artifactCounts();
    await expect(provisionLocalHostedDepositUat({ databaseUrl: DATABASE_URL!, logger: () => undefined }))
      .rejects.toThrow("collides with non-canonical Order 194 local UAT data");
    expect((await admin!`SELECT count(*)::int count FROM role_permission WHERE permission_code=${permission}
      AND role_id IN (SELECT id FROM role WHERE tenant_id=${SEED_TENANT.id}::uuid AND name=${REVIEW_ROLE_NAME})`)[0]!.count)
      .toBe(0);
    expect(await artifactCounts()).toEqual(before);
    await admin!`UPDATE account SET name='Local Deposit Card Clearing' WHERE id=${ids.cardClearing}::uuid`;
    await provisionLocalHostedDepositUat({ databaseUrl: DATABASE_URL!, logger: () => undefined });
    expect(await fixtureCounts()).toEqual({ permissions: 3, accounts: 2, transaction_codes: 2, routes: 2,
      instruments: 1 });
    expect(await artifactCounts()).toEqual(before);
  });
});
