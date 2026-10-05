import { expect, test } from "bun:test";

const source = await Bun.file(new URL("./review-seed.integration.test.ts", import.meta.url)).text();

test("the historical housekeeping profile is test-owned, tenant-specific and bounded", () => {
  expect(source).toContain('const HISTORICAL_DAILY_PROFILE_ID = "bd813aa7-e4ce-463a-8b23-d9961ead1713"');
  const start = source.indexOf("INSERT INTO extension (id, tenant_id, type, key, version, effective, content, status)");
  const end = source.indexOf("ON CONFLICT DO NOTHING", start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  const insert = source.slice(start, end);
  expect(insert).toContain("SELECT ${HISTORICAL_DAILY_PROFILE_ID}::uuid, ${SEED_TENANT.id}::uuid");
  expect(insert).toContain("tstzrange('2026-09-17T00:00:00Z'::timestamptz, '2026-09-20T00:00:00Z'::timestamptz, '[)')");
  expect(insert).toContain("tenant_id IS NULL AND type='vertical_profile' AND key='hotel'");
  expect(insert).toContain("version=1 AND status='active'");
});

test("the fixed September18 assertion never substitutes the current transaction clock", () => {
  const start = source.indexOf('test("Order 202 P7:');
  const end = source.indexOf('test("Order 203 P5:', start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  const assertion = source.slice(start, end);
  expect(assertion).toContain("WHERE id=${HISTORICAL_DAILY_PROFILE_ID}::uuid");
  expect(assertion).toContain("AND effective @> '2026-09-18T00:00:00Z'::timestamptz");
  expect(assertion).toContain("AND tenant_id=${SEED_TENANT.id}::uuid");
  expect(assertion).toContain('expect(profile).toEqual([{ cadence: "daily", matches: 1 }])');
  expect(assertion).not.toMatch(/transaction_timestamp|CURRENT_TIMESTAMP|now\(\)/i);
});
