import { expect, test } from "bun:test";

const source = await Bun.file("tools/reconcile-public-showcase-rate-approver.ts").text();

test("reconciles only the exact missing two-property approver scope", () => {
  expect(source).toContain("pg_advisory_xact_lock");
  expect(source).toContain("set_config('app.tenant_id'");
  expect(source).toContain("Approver complete grant topology differs");
  expect(source).toContain("Approver full permission topology differs");
  expect(source).toContain("REVIEW_PERMISSIONS.filter");
  expect(source).toContain("Approver grant postcondition failed");
  expect(source).toContain("APPROVER_PERMISSIONS");
  expect(source).toContain("INSERT INTO user_role");
  expect(source).not.toMatch(/(?:INSERT|UPDATE|DELETE)\s+(?:INTO\s+)?(?:app_user|role|role_permission|org_node)/i);
  expect(source).not.toContain("ON CONFLICT");
});

test("requires a protected loopback deployment connection without embedded credentials", () => {
  expect(source).toContain("YELLOW_DEPLOY_DATABASE_URL");
  expect(source).toContain('process.argv.includes("--apply")');
  expect(source).toContain("127.0.0.1");
  expect(source).not.toContain("postgres://");
  expect(source).not.toMatch(/password\s*[:=]\s*["'][^"']+["']/i);
});
