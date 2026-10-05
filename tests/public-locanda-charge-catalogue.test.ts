import { expect, test } from "bun:test";

import {
  LOCANDA_CHARGE_CODES,
  LOCANDA_CURRENCY,
  LOCANDA_EXPECTED_DATABASE,
  LOCANDA_PROPERTY_ID,
  LOCANDA_REVENUE_ACCOUNTS,
  LOCANDA_TENANT_ID,
} from "../scripts/provision-public-locanda-charge-catalogue";

test("freezes the exact Locanda property and database boundary", () => {
  expect(LOCANDA_EXPECTED_DATABASE).toBe("yellow_public_demo");
  expect(LOCANDA_TENANT_ID).toBe("6d9b7ce2-2d14-5576-b8c3-80f06501a603");
  expect(LOCANDA_PROPERTY_ID).toBe("6081b544-22a1-534f-a86d-bb1ae0519e14");
  expect(LOCANDA_CURRENCY).toBe("SAR");
});

test("defines unique revenue-only charge leaves and valid account parents", () => {
  const accountKeys = new Set(LOCANDA_REVENUE_ACCOUNTS.map((account) => account.key));
  expect(accountKeys.size).toBe(LOCANDA_REVENUE_ACCOUNTS.length);
  expect(new Set(LOCANDA_CHARGE_CODES.map((item) => item.code)).size).toBe(LOCANDA_CHARGE_CODES.length);
  for (const item of LOCANDA_CHARGE_CODES) {
    expect(accountKeys.has(item.accountKey)).toBe(true);
    expect(item.name.length).toBeGreaterThan(2);
    expect(item.usaliLine.length).toBeGreaterThan(2);
  }
  expect(LOCANDA_CHARGE_CODES.map((item) => item.code)).toContain("ROOM");
  expect(LOCANDA_CHARGE_CODES.some((item) => /alcohol/iu.test(`${item.code} ${item.name}`))).toBe(false);
});

test("keeps the provisioner configuration-only and confirmation-gated", async () => {
  const source = await Bun.file("scripts/provision-public-locanda-charge-catalogue.ts").text();
  expect(source).toContain('process.env.YELLOW_APPLY_ORDER563 !== "APPLY_REVIEWED_LOCANDA_CATALOGUE"');
  expect(source).toContain('await connection.unsafe("BEGIN")');
  expect(source).toContain('await connection.unsafe("ROLLBACK")');
  expect(source).toContain("pg_advisory_xact_lock");
  expect(source).toContain("LOCK TABLE public.account, public.tx_code, public.tx_code_route IN SHARE ROW EXCLUSIVE MODE");
  expect(source).toContain("FOR UPDATE");
  expect(source.match(/FOR UPDATE/gu)?.length).toBe(4);
  for (const forbidden of ["INSERT INTO journal", "INSERT INTO posting_line", "INSERT INTO payment", "INSERT INTO document", "record_occupancy(", "release_occupancy("]) {
    expect(source).not.toContain(forbidden);
  }
});
