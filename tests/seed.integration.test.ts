import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { SQL, type Subprocess } from "bun";
import { runMigrations } from "../scripts/migrate";
import {
  LAUNCH_EXTENSIONS,
  LAUNCH_EXTENSION_TYPES,
  runSeed,
  SEED_PROPERTY,
  SEED_TENANT,
  SeedError,
} from "../scripts/seed";

const PROJECT_ROOT = resolve(import.meta.dir, "..");
const SEED_SCRIPT = resolve(PROJECT_ROOT, "scripts", "seed.ts");
const ADMIN_URL = process.env.YELLOW_DEPLOY_DATABASE_URL ?? process.env.YELLOW_SEED_TEST_ADMIN_URL;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_SEED_DB === "1";
const FORBIDDEN_DATABASES = new Set(["yellow_dev", "yellow_test"]);

if (REQUIRE_DATABASE && !ADMIN_URL) {
  throw new Error("YELLOW_SEED_TEST_ADMIN_URL is required by bun run test:db:seed");
}

let admin: SQL | undefined;

function requiredAdminUrl(): string {
  if (!ADMIN_URL) throw new Error("Seed integration database is unavailable");
  return ADMIN_URL;
}

function requiredAdmin(): SQL {
  if (!admin) throw new Error("Seed integration admin client is unavailable");
  return admin;
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function databaseUrl(databaseName: string): string {
  const url = new URL(requiredAdminUrl());
  url.pathname = `/${databaseName}`;
  return url.toString();
}

async function withDatabase<T>(run: (targetUrl: string, sql: SQL) => Promise<T>): Promise<T> {
  const databaseName = `yellow_seed_${randomUUID().replaceAll("-", "")}`;
  const adminClient = requiredAdmin();
  await adminClient.unsafe(`CREATE DATABASE ${quoteIdentifier(databaseName)}`);
  const targetUrl = databaseUrl(databaseName);
  const sql = new SQL(targetUrl);
  try {
    await runMigrations({ databaseUrl: targetUrl, logger: () => undefined });
    return await run(targetUrl, sql);
  } finally {
    await sql.close().catch(() => undefined);
    await adminClient`
      SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
       WHERE datname = ${databaseName} AND pid <> pg_backend_pid()
    `.catch(() => undefined);
    await adminClient.unsafe(`DROP DATABASE IF EXISTS ${quoteIdentifier(databaseName)} WITH (FORCE)`);
  }
}

async function seedFailure(operation: () => Promise<unknown>): Promise<SeedError> {
  try {
    await operation();
  } catch (error) {
    if (error instanceof SeedError) return error;
    throw error;
  }
  throw new Error("Expected seed operation to fail");
}

async function collectChild(child: Subprocess<"ignore", "pipe", "pipe">): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  return { exitCode, stdout, stderr };
}

describe("seed CLI", () => {
    test("requires YELLOW_DEPLOY_DATABASE_URL", async () => {
    const env = { ...process.env };
    delete env.DATABASE_URL;
    delete env.YELLOW_DEPLOY_DATABASE_URL;
    const result = await collectChild(Bun.spawn([process.execPath, SEED_SCRIPT], {
      cwd: PROJECT_ROOT,
      env,
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
    }));
    expect(result).toEqual({ exitCode: 1, stdout: "", stderr: "YELLOW_DEPLOY_DATABASE_URL is required\n" });
  });
});

const databaseDescribe = ADMIN_URL ? describe.serial : describe.skip;

databaseDescribe("deterministic app-role bootstrap seed", () => {
  beforeAll(async () => {
    const parsed = new URL(requiredAdminUrl());
    const adminDatabase = parsed.pathname.replace(/^\//, "");
    if (FORBIDDEN_DATABASES.has(adminDatabase)) throw new Error(`Admin URL must not point at protected database ${adminDatabase}`);
    admin = new SQL(requiredAdminUrl());
    const rows = await admin<{ is_superuser: boolean }[]>`SELECT rolsuper AS is_superuser FROM pg_roles WHERE rolname = current_user`;
    if (rows[0]?.is_superuser !== true) throw new Error("YELLOW_SEED_TEST_ADMIN_URL must use a PostgreSQL superuser");
  });

  afterAll(async () => {
    await admin?.close();
    admin = undefined;
  });

  test("runner then seed writes exactly one canonical tenant and property as app_role", async () => {
    await withDatabase(async (targetUrl, sql) => {
      const lines: string[] = [];
      const result = await runSeed({ databaseUrl: targetUrl, logger: (line) => lines.push(line) });
      expect(result.tenant).toBe("inserted");
      expect(result.property).toBe("inserted");
      expect(result.registry).toBe("inserted");
      expect(result.writeRole).toBe("app_role");
      expect(result.roleReset).toBe(true);
      expect(result.tenantContextCleared).toBe(true);
      expect(result.reuseProbeCleared).toBe(true);
      expect(lines).toEqual([
        "seed tenant: inserted",
        "seed property: inserted",
        `seed summary: status=applied backend_pid=${result.backendPid}`,
      ]);

      const tenants = await sql`SELECT id, slug, name, tier, residency, status FROM tenant`;
      const properties = await sql`
        SELECT id, tenant_id, path::text AS path, kind, name, timezone, currency,
               config, jsonb_typeof(config) AS config_type
        FROM org_node
      `;
      expect(tenants).toEqual([SEED_TENANT]);
      expect(properties).toEqual([{
        id: SEED_PROPERTY.id,
        tenant_id: SEED_PROPERTY.tenantId,
        path: SEED_PROPERTY.path,
        kind: SEED_PROPERTY.kind,
        name: SEED_PROPERTY.name,
        timezone: SEED_PROPERTY.timezone,
        currency: SEED_PROPERTY.currency,
        config: {},
        config_type: "object",
      }]);
      expect(Number((await sql`SELECT count(*)::int AS count FROM extension_type`)[0]?.count)).toBe(LAUNCH_EXTENSION_TYPES.length);
      expect(Number((await sql`SELECT count(*)::int AS count FROM extension WHERE tenant_id IS NULL`)[0]?.count)).toBe(LAUNCH_EXTENSIONS.length);
      expect(Number((await sql`
        SELECT count(*)::int AS count FROM fact_log
        WHERE fact_type IN ('extension_type.registered', 'extension.seeded')
      `)[0]?.count)).toBe(LAUNCH_EXTENSION_TYPES.length + LAUNCH_EXTENSIONS.length);
    });
  }, 60_000);

  test("identical rerun is an exact no-op and preserves timestamps", async () => {
    await withDatabase(async (targetUrl, sql) => {
      await runSeed({ databaseUrl: targetUrl, logger: () => undefined });
      const before = await sql`SELECT created_at FROM tenant WHERE id = ${SEED_TENANT.id}`;
      const second = await runSeed({ databaseUrl: targetUrl, logger: () => undefined });
      const after = await sql`SELECT created_at FROM tenant WHERE id = ${SEED_TENANT.id}`;
      expect(second.tenant).toBe("already exact");
      expect(second.property).toBe("already exact");
      expect(second.registry).toBe("already exact");
      expect(after).toEqual(before);
      expect(Number((await sql`SELECT count(*)::int AS count FROM tenant`)[0]?.count)).toBe(1);
      expect(Number((await sql`SELECT count(*)::int AS count FROM org_node`)[0]?.count)).toBe(1);
      expect(Number((await sql`SELECT count(*)::int AS count FROM extension_type`)[0]?.count)).toBe(LAUNCH_EXTENSION_TYPES.length);
      expect(Number((await sql`SELECT count(*)::int AS count FROM extension`)[0]?.count)).toBe(LAUNCH_EXTENSIONS.length);
      expect(Number((await sql`SELECT count(*)::int AS count FROM fact_log`)[0]?.count)).toBe(
        LAUNCH_EXTENSION_TYPES.length + LAUNCH_EXTENSIONS.length,
      );
    });
  }, 60_000);

  test("divergent launch registry content hard-fails without partial repair", async () => {
    await withDatabase(async (targetUrl, sql) => {
      await runSeed({ databaseUrl: targetUrl, logger: () => undefined });
      await sql`
        UPDATE extension_type
        SET json_schema = '{"type":"string"}'::jsonb
        WHERE type = 'vertical_profile'
      `;
      const before = Number((await sql`SELECT count(*)::int AS count FROM fact_log`)[0]?.count);
      const error = await seedFailure(() => runSeed({ databaseUrl: targetUrl, logger: () => undefined }));
      expect(error.message).toContain("Extension type seed collision for vertical_profile");
      expect(Number((await sql`SELECT count(*)::int AS count FROM fact_log`)[0]?.count)).toBe(before);
      expect((await sql`SELECT json_schema FROM extension_type WHERE type = 'vertical_profile'`)[0]?.json_schema).toEqual({ type: "string" });
    });
  }, 60_000);

  for (const collision of ["tenant id", "tenant slug", "property id", "property path"] as const) {
    test(`${collision} mismatch hard-fails without partial writes`, async () => {
      await withDatabase(async (targetUrl, sql) => {
        if (collision === "tenant id") {
          await sql`INSERT INTO tenant (id, slug, name) VALUES (${SEED_TENANT.id}, 'other-slug', 'Other')`;
        } else if (collision === "tenant slug") {
          await sql`INSERT INTO tenant (id, slug, name) VALUES (${randomUUID()}, ${SEED_TENANT.slug}, 'Other')`;
        } else {
          await sql`INSERT INTO tenant (id, slug, name, tier, residency, status) VALUES (${SEED_TENANT.id}, ${SEED_TENANT.slug}, ${SEED_TENANT.name}, ${SEED_TENANT.tier}, ${SEED_TENANT.residency}, ${SEED_TENANT.status})`;
          if (collision === "property id") {
            await sql`INSERT INTO org_node (id, tenant_id, path, kind, name, timezone, currency) VALUES (${SEED_PROPERTY.id}, ${SEED_TENANT.id}, 'other.property', 'property', 'Other', 'UTC', 'USD')`;
          } else {
            await sql`INSERT INTO org_node (id, tenant_id, path, kind, name, timezone, currency) VALUES (${randomUUID()}, ${SEED_TENANT.id}, ${SEED_PROPERTY.path}::ltree, 'property', 'Other', 'UTC', 'USD')`;
          }
        }

        const beforeTenantCount = Number((await sql`SELECT count(*)::int AS count FROM tenant`)[0]?.count);
        const beforePropertyCount = Number((await sql`SELECT count(*)::int AS count FROM org_node`)[0]?.count);
        const error = await seedFailure(() => runSeed({ databaseUrl: targetUrl, logger: () => undefined }));
        expect(error.message).toContain("collision");
        expect(error.rollbackConnectionUsable).toBe(true);
        expect(error.roleReset).toBe(true);
        expect(error.tenantContextCleared).toBe(true);
        expect(Number((await sql`SELECT count(*)::int AS count FROM tenant`)[0]?.count)).toBe(beforeTenantCount);
        expect(Number((await sql`SELECT count(*)::int AS count FROM org_node`)[0]?.count)).toBe(beforePropertyCount);
      });
    }, 60_000);
  }

  test("forced failure after tenant handling rolls back and leaves the reserved backend clean and usable", async () => {
    await withDatabase(async (targetUrl, sql) => {
      const error = await seedFailure(() => runSeed({
        databaseUrl: targetUrl,
        logger: () => undefined,
        beforeProperty: async (connection) => {
          const rows = await connection<{ current_user: string; tenant_context: string }[]>`
            SELECT current_user, current_setting('app.tenant_id', true) AS tenant_context
          `;
          expect(rows).toEqual([{ current_user: "app_role", tenant_context: SEED_TENANT.id }]);
          throw new Error("controlled pre-property failure");
        },
      }));
      expect(error.message).toContain("controlled pre-property failure");
      expect(error.rollbackConnectionUsable).toBe(true);
      expect(error.roleReset).toBe(true);
      expect(error.tenantContextCleared).toBe(true);
      expect(Number((await sql`SELECT count(*)::int AS count FROM tenant`)[0]?.count)).toBe(0);
      expect(Number((await sql`SELECT count(*)::int AS count FROM org_node`)[0]?.count)).toBe(0);
    });
  }, 60_000);

  test("CLI reports one controlled rejection with redacted credentials", async () => {
    await withDatabase(async (targetUrl, sql) => {
      await sql`INSERT INTO tenant (id, slug, name) VALUES (${SEED_TENANT.id}, 'wrong', 'Wrong')`;
      const url = new URL(targetUrl);
      url.username = "seed_secret_user";
      url.password = "seed_secret_password";
      // Authentication must succeed so the deterministic collision drives the child failure.
      const runnableUrl = targetUrl;
      const result = await collectChild(Bun.spawn([process.execPath, SEED_SCRIPT], {
        cwd: PROJECT_ROOT,
        env: { ...process.env, YELLOW_DEPLOY_DATABASE_URL: runnableUrl },
        stdin: "ignore",
        stdout: "pipe",
        stderr: "pipe",
      }));
      expect(result.exitCode).toBe(1);
      expect(result.stderr.match(/seed failed:/g)).toHaveLength(1);
      expect(result.stderr).not.toContain("Unhandled");
      expect(result.stderr).not.toContain(url.username);
      expect(result.stderr).not.toContain(url.password);
    });
  }, 60_000);
});
