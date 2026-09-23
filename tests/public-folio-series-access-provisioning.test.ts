import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  EXPECTED_PUBLIC_FOLIO_SERIES_ACCESS,
  assertPublicFolioSeriesAccessTarget,
} from "../tools/provision-public-folio-series-access";

test("Order562 provisioning is pinned to the reviewed loopback deployment", () => {
  expect(() => assertPublicFolioSeriesAccessTarget(
    "postgresql://yellow_deploy:secret@127.0.0.1:55432/yellow_public_demo",
  )).not.toThrow();
  for (const target of [
    "postgresql://yellow_runtime:secret@127.0.0.1:55432/yellow_public_demo",
    "postgresql://yellow_deploy@127.0.0.1:55432/yellow_public_demo",
    "postgresql://yellow_deploy:secret@localhost:55432/yellow_public_demo",
    "postgresql://yellow_deploy:secret@127.0.0.1:5442/yellow_public_demo",
    "postgresql://yellow_deploy:secret@127.0.0.1:55432/yellow_order562_candidate",
    "postgresql://yellow_deploy:secret@127.0.0.1:55432/yellow_public_demo?sslmode=disable",
    "postgresql://yellow_deploy:secret@public.example/yellow_public_demo",
  ]) expect(() => assertPublicFolioSeriesAccessTarget(target)).toThrow(
    "Order562 public database target is not the reviewed loopback deployment",
  );
});

test("Order562 freezes the complete pre-grant permission and membership topology", () => {
  const expected = EXPECTED_PUBLIC_FOLIO_SERIES_ACCESS;
  expect(expected.rolePermissionsBefore).toHaveLength(65);
  expect([...expected.rolePermissionsBefore].sort()).toEqual([...expected.rolePermissionsBefore]);
  expect(new Set(expected.rolePermissionsBefore).size).toBe(65);
  expect(expected.rolePermissionsBefore).not.toContain(expected.permission);
  expect(expected.memberships).toHaveLength(9);
  expect(new Set(expected.memberships.map(([node]) => node)).size).toBe(9);
  expect(expected.memberships.map(([node, path]) => [node, path])).toContainEqual([
    expected.propertyId,
    expected.propertyPath,
  ]);

  const source = readFileSync(resolve(import.meta.dir, "..", "tools",
    "provision-public-folio-series-access.ts"), "utf8");
  expect(source).toContain("SELECT set_config('app.tenant_id'");
  expect(source).toContain("pg_advisory_xact_lock");
  expect(source).toContain("FOR UPDATE OF actor_role,permission NOWAIT");
  expect(source).toContain("authority topology is concurrently changing");
  expect(source).toContain("FOR SHARE OF tenant,property");
  expect(source).toContain("ledger.length !== 97");
  expect(source).toContain("complete role membership topology");
  expect(source).toContain("complete role permission topology");
  expect(source).toContain("permission already has an unreviewed recipient");
});
