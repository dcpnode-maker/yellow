import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import {
  mkdtemp,
  readdir,
  readFile,
  rename,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { SQL, type Subprocess } from "bun";
import {
  MigrationError,
  runMigrations,
  type MigrationRunResult,
} from "../scripts/migrate";

const PROJECT_ROOT = resolve(import.meta.dir, "..");
const MIGRATE_SCRIPT = resolve(PROJECT_ROOT, "scripts", "migrate.ts");
const PROJECT_MIGRATIONS = resolve(PROJECT_ROOT, "migrations");
const BASELINE_PATH = resolve(PROJECT_ROOT, "migrations", "0001_init.sql");
const BASELINE_BYTES = await readFile(BASELINE_PATH);
const BUSINESS_DAY_SEAL_MIGRATION = await readFile(
  resolve(PROJECT_ROOT, "migrations", "0013_revoke_app_role_business_day_seal.sql"),
);
const BASELINE_SHA256 = "fe2a9fc949c6bacded3f8d3fc4d14fc596a83ebde9aeb043eb10845f07b30923";
const ADMIN_URL = process.env.YELLOW_DEPLOY_DATABASE_URL ?? process.env.YELLOW_MIGRATION_TEST_ADMIN_URL;
const RUNTIME_URL = process.env.YELLOW_RUNTIME_DATABASE_URL;
const REQUIRE_DATABASE = process.env.YELLOW_REQUIRE_MIGRATION_DB === "1";
const FORBIDDEN_DATABASES = new Set(["yellow_dev", "yellow_test"]);

if (REQUIRE_DATABASE && !ADMIN_URL) {
  throw new Error("YELLOW_MIGRATION_TEST_ADMIN_URL is required by bun run test:db:migrate");
}

type FileContents = string | Uint8Array;

interface ChildResult {
  readonly exitCode: number;
  readonly stderr: string;
  readonly stdout: string;
}

interface SummaryEvidence {
  readonly applied: number;
  readonly backendPid: number;
  readonly transactionPids: readonly number[];
}

let admin: SQL | undefined;

function requiredAdminUrl(): string {
  if (!ADMIN_URL) throw new Error("Migration integration database is unavailable");
  return ADMIN_URL;
}

function requiredAdmin(): SQL {
  if (!admin) throw new Error("Migration integration admin client is unavailable");
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

async function withDatabase<T>(
  run: (options: { databaseName: string; databaseUrl: string; sql: SQL }) => Promise<T>,
): Promise<T> {
  const databaseName = `yellow_migrate_${randomUUID().replaceAll("-", "")}`;
  const adminClient = requiredAdmin();
  await adminClient.unsafe(`CREATE DATABASE ${quoteIdentifier(databaseName)}`);
  const targetUrl = databaseUrl(databaseName);
  const sql = new SQL(targetUrl);

  try {
    return await run({ databaseName, databaseUrl: targetUrl, sql });
  } finally {
    await sql.close().catch(() => undefined);
    await adminClient`
      SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
       WHERE datname = ${databaseName}
         AND pid <> pg_backend_pid()
    `.catch(() => undefined);
    await adminClient.unsafe(`DROP DATABASE IF EXISTS ${quoteIdentifier(databaseName)} WITH (FORCE)`);
  }
}

async function withMigrationDirectory<T>(
  files: Readonly<Record<string, FileContents>>,
  run: (directory: string) => Promise<T>,
  baseline: Uint8Array = BASELINE_BYTES,
): Promise<T> {
  const directory = await mkdtemp(join(tmpdir(), "yellow-migrations-"));

  try {
    await writeFile(resolve(directory, "0001_init.sql"), baseline);
    for (const [filename, contents] of Object.entries(files)) {
      await writeFile(resolve(directory, filename), contents);
    }
    return await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function migrationFailure(operation: () => Promise<unknown>): Promise<MigrationError> {
  try {
    await operation();
  } catch (error) {
    if (error instanceof MigrationError) return error;
    throw error;
  }
  throw new Error("Expected migration operation to fail");
}

function spawnRunner(targetUrl: string, directory: string): Subprocess<"ignore", "pipe", "pipe"> {
  return Bun.spawn([process.execPath, MIGRATE_SCRIPT], {
    cwd: PROJECT_ROOT,
    env: {
      ...process.env,
      YELLOW_DEPLOY_DATABASE_URL: targetUrl,
      YELLOW_MIGRATIONS_DIR: directory,
    },
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
}

async function collectChild(child: Subprocess<"ignore", "pipe", "pipe">): Promise<ChildResult> {
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  return { exitCode, stdout, stderr };
}

function summaryEvidence(output: string): SummaryEvidence {
  const match = output.match(
    /migration summary: applied=(\d+) status=(?:applied|no-op) backend_pid=(\d+) transaction_pids=([^\r\n]+)/,
  );
  if (!match?.[1] || !match[2] || !match[3]) throw new Error(`Missing migration summary in: ${output}`);

  return {
    applied: Number(match[1]),
    backendPid: Number(match[2]),
    transactionPids: match[3] === "none" ? [] : match[3].split(",").map(Number),
  };
}

describe("migration CLI", () => {
  test("requires YELLOW_DEPLOY_DATABASE_URL instead of silently selecting a database", async () => {
    const env = { ...process.env };
    delete env.DATABASE_URL;
    delete env.YELLOW_DEPLOY_DATABASE_URL;
    delete env.YELLOW_MIGRATIONS_DIR;
    const child = Bun.spawn([process.execPath, MIGRATE_SCRIPT], {
      cwd: PROJECT_ROOT,
      env,
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
    });
    const result = await collectChild(child);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr.trim()).toBe("YELLOW_DEPLOY_DATABASE_URL is required");
  });
});

const databaseDescribe = ADMIN_URL ? describe.serial : describe.skip;

databaseDescribe("Bun SQL migration runner", () => {
  beforeAll(async () => {
    const parsed = new URL(requiredAdminUrl());
    const adminDatabase = parsed.pathname.replace(/^\//, "");
    if (FORBIDDEN_DATABASES.has(adminDatabase)) {
      throw new Error(`Admin URL must not point at protected database ${adminDatabase}`);
    }

    admin = new SQL(requiredAdminUrl());
    const rows = await admin<{ is_superuser: boolean }[]>`
      SELECT rolsuper AS is_superuser FROM pg_roles WHERE rolname = current_user
    `;
    if (rows[0]?.is_superuser !== true) {
      throw new Error("YELLOW_MIGRATION_TEST_ADMIN_URL must use a PostgreSQL superuser");
    }
  });

  afterAll(async () => {
    await admin?.close();
    admin = undefined;
  });

  test(
    "rejects migration 0015 atomically while yellow_runtime is connected, then retries after drain",
    async () => {
      if (!RUNTIME_URL) return;
      await withDatabase(async ({ databaseName, databaseUrl: targetUrl, sql }) => {
        const predecessorFiles = await readdir(PROJECT_MIGRATIONS);
        const predecessor = Object.fromEntries(await Promise.all(
          predecessorFiles
            .filter((filename) => {
              const version = Number(filename.slice(0, 4));
              return filename.endsWith(".sql") && version >= 2 && version <= 14;
            })
            .map(async (filename) => [filename, await readFile(resolve(PROJECT_MIGRATIONS, filename))] as const),
        ));
        await withMigrationDirectory(predecessor, async (directory) => {
          await runMigrations({ databaseUrl: targetUrl, migrationsDirectory: directory, logger: () => undefined });
        });

        const runtimeTargetUrl = new URL(RUNTIME_URL);
        runtimeTargetUrl.pathname = `/${databaseName}`;
        const blocker = new SQL(runtimeTargetUrl.toString(), { max: 1 });
        await blocker`SELECT 1`;
        try {
          await expect(
            runMigrations({ databaseUrl: targetUrl, migrationsDirectory: PROJECT_MIGRATIONS, logger: () => undefined }),
          ).rejects.toThrow(/active session|drain/i);

          const failedLedger = await sql<{ version: string | bigint }[]>`
            SELECT version FROM public.schema_migration ORDER BY version
          `;
          expect(failedLedger.map((row) => Number(row.version))).toEqual(
            Array.from({ length: 14 }, (_, index) => index + 1),
          );
          const ownership = await sql<{ owner: string; owner_objects: number }[]>`
            SELECT pg_get_userbyid(m.relowner) AS owner,
                   (SELECT count(*)::int
                      FROM pg_catalog.pg_class c
                      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
                     WHERE n.nspname = 'public' AND pg_get_userbyid(c.relowner) = 'yellow_owner') AS owner_objects
              FROM pg_catalog.pg_class m
             WHERE m.oid = 'public.schema_migration'::regclass
          `;
          expect(ownership).toEqual([{ owner: "yellow_deploy", owner_objects: 0 }]);
        } finally {
          await blocker.close();
        }

        const retry = await runMigrations({
          databaseUrl: targetUrl,
          migrationsDirectory: PROJECT_MIGRATIONS,
          logger: () => undefined,
        });
        expect(retry.appliedFiles).toContain("0015_runtime_database_authority.sql");
        const completed = await sql<{ version: string | bigint; filename: string }[]>`
          SELECT version, filename FROM public.schema_migration WHERE version = 15
        `;
        expect(completed.map((row) => ({ ...row, version: Number(row.version) }))).toEqual([{
          version: 15,
          filename: "0015_runtime_database_authority.sql",
        }]);
      });
    },
    120_000,
  );

  test(
    "migration 0015 transfers the owned outbox sequence with its parent table",
    async () => {
      await withDatabase(async ({ databaseUrl: targetUrl, sql }) => {
        let failure: unknown;
        let result: MigrationRunResult | undefined;
        try {
          result = await runMigrations({
            databaseUrl: targetUrl,
            migrationsDirectory: PROJECT_MIGRATIONS,
            logger: () => undefined,
          });
        } catch (error) {
          failure = error;
        }

        const ledger = await sql<{ version: string | bigint }[]>`
          SELECT version FROM public.schema_migration ORDER BY version
        `;
        const owners = await sql<{ relname: string; owner: string }[]>`
          SELECT c.relname, pg_get_userbyid(c.relowner) AS owner
            FROM pg_catalog.pg_class c
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'public' AND c.relname IN ('outbox', 'outbox_seq_seq')
           ORDER BY c.relname
        `;

        if (failure) {
          // Keep the builder red with direct evidence that 0015 rolled back before
          // any owner transfer or ledger insertion.
          expect(ledger.map((row) => Number(row.version))).toEqual(
            Array.from({ length: 14 }, (_, index) => index + 1),
          );
          expect(owners).toEqual([
            { relname: "outbox", owner: "yellow_deploy" },
            { relname: "outbox_seq_seq", owner: "yellow_deploy" },
          ]);
          throw failure;
        }

        expect(result?.appliedFiles).toContain("0015_runtime_database_authority.sql");
        expect(ledger.map((row) => Number(row.version))).toContain(15);
        expect(owners).toEqual([
          { relname: "outbox", owner: "yellow_owner" },
          { relname: "outbox_seq_seq", owner: "yellow_owner" },
        ]);
      });
    },
    120_000,
  );

  test(
    "reuses the cluster-global runtime membership across databases and fails closed on extras",
    async () => {
      const exactMembership = [{ role_name: "app_role", member_name: "yellow_runtime" }];

      await withDatabase(async ({ databaseUrl: firstUrl, sql: firstSql }) => {
        const first = await runMigrations({
          databaseUrl: firstUrl,
          migrationsDirectory: PROJECT_MIGRATIONS,
          logger: () => undefined,
        });
        expect(first.appliedFiles).toContain("0015_runtime_database_authority.sql");
        const firstMembership = await firstSql<{ role_name: string; member_name: string }[]>`
          SELECT pg_get_userbyid(roleid) AS role_name, pg_get_userbyid(member) AS member_name
            FROM pg_catalog.pg_auth_members
           WHERE roleid = 'app_role'::regrole OR member = 'yellow_runtime'::regrole
           ORDER BY role_name, member_name
        `;
        expect(firstMembership).toEqual(exactMembership);
      });

      await withDatabase(async ({ databaseUrl: secondUrl, sql: secondSql }) => {
        const second = await runMigrations({
          databaseUrl: secondUrl,
          migrationsDirectory: PROJECT_MIGRATIONS,
          logger: () => undefined,
        });
        expect(second.appliedFiles).toContain("0012_app_role_nonlogin.sql");
        expect(second.appliedFiles).toContain("0015_runtime_database_authority.sql");
        const secondLedger = await secondSql<{ version: string | bigint }[]>`
          SELECT version FROM public.schema_migration WHERE version IN (12, 15) ORDER BY version
        `;
        expect(secondLedger.map((row) => Number(row.version))).toEqual([12, 15]);
        const secondMembership = await secondSql<{ role_name: string; member_name: string }[]>`
          SELECT pg_get_userbyid(roleid) AS role_name, pg_get_userbyid(member) AS member_name
            FROM pg_catalog.pg_auth_members
           WHERE roleid = 'app_role'::regrole OR member = 'yellow_runtime'::regrole
           ORDER BY role_name, member_name
        `;
        expect(secondMembership).toEqual(exactMembership);
      });

      await admin!.unsafe("GRANT app_role TO yellow_owner");
      try {
        await withDatabase(async ({ databaseUrl: malformedUrl, sql: malformedSql }) => {
          const error = await migrationFailure(() => runMigrations({
            databaseUrl: malformedUrl,
            migrationsDirectory: PROJECT_MIGRATIONS,
            logger: () => undefined,
          }));
          expect(error.errno).toBe("55000");
          const malformedLedger = await malformedSql<{ version: string | bigint }[]>`
            SELECT version FROM public.schema_migration ORDER BY version
          `;
          expect(malformedLedger.map((row) => Number(row.version))).toEqual(
            Array.from({ length: 11 }, (_, index) => index + 1),
          );
          const malformedMembership = await admin!<{ role_name: string; member_name: string }[]>`
            SELECT pg_get_userbyid(roleid) AS role_name, pg_get_userbyid(member) AS member_name
              FROM pg_catalog.pg_auth_members
             WHERE roleid = 'app_role'::regrole OR member = 'yellow_runtime'::regrole
             ORDER BY role_name, member_name
          `;
          expect(malformedMembership).toEqual([
            { role_name: "app_role", member_name: "yellow_owner" },
            ...exactMembership,
          ]);
        });
      } finally {
        await admin!.unsafe("REVOKE app_role FROM yellow_owner");
      }
    },
    180_000,
  );

  test(
    "applies the immutable baseline once, validates metadata, and is a stable no-op",
    async () => {
      await withDatabase(async ({ databaseUrl: targetUrl, sql }) => {
        await withMigrationDirectory({}, async (directory) => {
          const firstLines: string[] = [];
          const first = await runMigrations({
            databaseUrl: targetUrl,
            migrationsDirectory: directory,
            logger: (line) => firstLines.push(line),
          });

          expect(first.appliedFiles).toEqual(["0001_init.sql"]);
          expect(first.transactionBackendPids).toEqual([first.backendPid]);
          expect(firstLines[0]).toBe("migration applied: 0001_init.sql");

          const ledgerBefore = await sql<
            { version: string | bigint; filename: string; checksum_sha256: string; applied_at: Date }[]
          >`SELECT version, filename, checksum_sha256, applied_at FROM public.schema_migration`;
          expect(ledgerBefore).toHaveLength(1);
          expect(Number(ledgerBefore[0]?.version)).toBe(1);
          expect(ledgerBefore[0]?.filename).toBe("0001_init.sql");
          expect(ledgerBefore[0]?.checksum_sha256).toBe(BASELINE_SHA256);

          const tableState = await sql<
            { owner_matches: boolean; relrowsecurity: boolean; relforcerowsecurity: boolean }[]
          >`
            SELECT pg_get_userbyid(c.relowner) = current_user AS owner_matches,
                   c.relrowsecurity,
                   c.relforcerowsecurity
              FROM pg_class c
             WHERE c.oid = 'public.schema_migration'::regclass
          `;
          expect(tableState).toEqual([
            { owner_matches: true, relrowsecurity: false, relforcerowsecurity: false },
          ]);

          const forbiddenGrants = await sql<{ count: string | bigint }[]>`
            SELECT count(*) AS count
              FROM information_schema.role_table_grants
             WHERE table_schema = 'public'
               AND table_name = 'schema_migration'
               AND grantee IN ('PUBLIC', 'app_role')
          `;
          expect(Number(forbiddenGrants[0]?.count)).toBe(0);

          const secondLines: string[] = [];
          const second = await runMigrations({
            databaseUrl: targetUrl,
            migrationsDirectory: directory,
            logger: (line) => secondLines.push(line),
          });
          expect(second.appliedFiles).toEqual([]);
          expect(second.transactionBackendPids).toEqual([]);
          expect(secondLines).toHaveLength(1);
          expect(secondLines[0]).toContain("applied=0 status=no-op");

          const ledgerAfter = await sql<{ applied_at: Date }[]>`
            SELECT applied_at FROM public.schema_migration
          `;
          expect(ledgerAfter[0]?.applied_at.getTime()).toBe(ledgerBefore[0]?.applied_at.getTime());
        });
      });
    },
    60_000,
  );

  test(
    "applies the exact app_role internalization migration without schema changes",
    async () => {
      await withDatabase(async ({ databaseUrl: targetUrl, sql }) => {
        const result = await runMigrations({
          databaseUrl: targetUrl,
          migrationsDirectory: PROJECT_MIGRATIONS,
          logger: () => undefined,
        });
        expect(result.appliedFiles).toContain("0012_app_role_nonlogin.sql");

        const ledger = await sql<
          { version: string | bigint; filename: string; checksum_sha256: string }[]
        >`
          SELECT version, filename, checksum_sha256
            FROM public.schema_migration
           WHERE version = 12
        `;
        expect(ledger.map((row) => ({ ...row, version: Number(row.version) }))).toEqual([{
          version: 12,
          filename: "0012_app_role_nonlogin.sql",
          checksum_sha256: "6f377ca182bcbd8ece5c6a0688597b4a4e0fc5129345a80f6f9d31076fb0ed25",
        }]);

        const role = await sql<Array<{
          can_login: boolean;
          connection_limit: number;
          password_is_null: boolean;
          safe_attributes: boolean;
          memberships: number;
        }>>`
          SELECT r.rolcanlogin AS can_login,
                 r.rolconnlimit AS connection_limit,
                 r.rolpassword IS NULL AS password_is_null,
                 NOT (r.rolsuper OR r.rolcreatedb OR r.rolcreaterole OR r.rolinherit
                      OR r.rolreplication OR r.rolbypassrls) AS safe_attributes,
                 (SELECT count(*)::int
                    FROM pg_catalog.pg_auth_members
                   WHERE roleid = r.oid OR member = r.oid) AS memberships
            FROM pg_catalog.pg_authid AS r
           WHERE r.rolname = 'app_role'
        `;
        expect(role).toEqual([{
          can_login: false,
          connection_limit: 0,
          password_is_null: true,
          safe_attributes: true,
          memberships: 1,
        }]);

        const tableCount = await sql<{ count: number }[]>`
          SELECT count(*)::int AS count FROM pg_catalog.pg_tables WHERE schemaname = 'public'
        `;
        expect(tableCount).toEqual([{ count: 108 }]);
      });
    },
    60_000,
  );

  test(
    "applies exact owner-only business-day seal authority and fails if the function is absent",
    async () => {
      await withDatabase(async ({ databaseUrl: targetUrl, sql }) => {
        const result = await runMigrations({
          databaseUrl: targetUrl,
          migrationsDirectory: PROJECT_MIGRATIONS,
          logger: () => undefined,
        });
        expect(result.appliedFiles).toContain("0013_revoke_app_role_business_day_seal.sql");

        const ledger = await sql<
          { version: string | bigint; filename: string; checksum_sha256: string }[]
        >`
          SELECT version, filename, checksum_sha256
            FROM public.schema_migration
           WHERE version = 13
        `;
        expect(ledger.map((row) => ({ ...row, version: Number(row.version) }))).toEqual([{
          version: 13,
          filename: "0013_revoke_app_role_business_day_seal.sql",
          checksum_sha256: "75aef629ebc90a7c2ba3dcf94532295cfce57fc521197d7b5cdc6b6d5a1bf712",
        }]);

        const authority = await sql<Array<{
          owner_matches: boolean;
          owner_execute: boolean;
          public_execute: boolean;
          app_execute: boolean;
        }>>`
          SELECT pg_get_userbyid(p.proowner) = 'yellow_owner' AS owner_matches,
                 has_function_privilege('yellow_owner', p.oid, 'EXECUTE') AS owner_execute,
                 has_function_privilege('public', p.oid, 'EXECUTE') AS public_execute,
                 has_function_privilege('app_role', p.oid, 'EXECUTE') AS app_execute
            FROM pg_catalog.pg_proc AS p
           WHERE p.oid = 'public.seal_business_day(uuid,uuid,date,uuid)'::regprocedure
        `;
        expect(authority).toEqual([{
          owner_matches: true,
          owner_execute: true,
          public_execute: false,
          app_execute: false,
        }]);
      });

      await withDatabase(async ({ databaseUrl: targetUrl, sql }) => {
        await withMigrationDirectory({
          "0002_remove_business_day_seal.sql":
            "DROP FUNCTION public.seal_business_day(uuid,uuid,date,uuid);\n",
          "0013_revoke_app_role_business_day_seal.sql": BUSINESS_DAY_SEAL_MIGRATION,
        }, async (directory) => {
          const error = await migrationFailure(() => runMigrations({
            databaseUrl: targetUrl,
            migrationsDirectory: directory,
            logger: () => undefined,
          }));
          expect(error.errno).toBe("42883");
          const ledger = await sql<Array<{ version: number | bigint }>>`
            SELECT version FROM public.schema_migration ORDER BY version
          `;
          expect(ledger.map(({ version }) => Number(version))).toEqual([1, 2]);
        });
      });
    },
    60_000,
  );

  test(
    "applies the exact positive runtime DML authority migration",
    async () => {
      await withDatabase(async ({ databaseUrl: targetUrl, sql }) => {
        const result = await runMigrations({
          databaseUrl: targetUrl,
          migrationsDirectory: PROJECT_MIGRATIONS,
          logger: () => undefined,
        });
        expect(result.appliedFiles).toContain("0016_runtime_dml_authority.sql");
        const ledger = await sql<Array<{ version: number | bigint; filename: string; checksum_sha256: string }>>`
          SELECT version, filename, checksum_sha256
            FROM public.schema_migration
           WHERE version = 16
        `;
        expect(ledger.map((row) => ({ ...row, version: Number(row.version) }))).toEqual([{
          version: 16,
          filename: "0016_runtime_dml_authority.sql",
          checksum_sha256: "216e79ab0b10a697b79e99872cbf3a65394dcdf94773af1fd4c13862f4e83fe5",
        }]);
      });
    },
    60_000,
  );

  test(
    "applies the exact financial row-lock capability migration",
    async () => {
      await withDatabase(async ({ databaseUrl: targetUrl, sql }) => {
        const result = await runMigrations({
          databaseUrl: targetUrl,
          migrationsDirectory: PROJECT_MIGRATIONS,
          logger: () => undefined,
        });
        expect(result.appliedFiles).toContain("0017_financial_row_lock_capability.sql");
        const ledger = await sql<Array<{ version: number | bigint; filename: string; checksum_sha256: string }>>`
          SELECT version, filename, checksum_sha256
            FROM public.schema_migration
           WHERE version = 17
        `;
        expect(ledger.map((row) => ({ ...row, version: Number(row.version) }))).toEqual([{
          version: 17,
          filename: "0017_financial_row_lock_capability.sql",
          checksum_sha256: "0d784fab670353b665e464d350e92ab5e6de401a131a737a63b86e1844a6ec81",
        }]);
      });
    },
    60_000,
  );

  test(
    "applies the exact extension type registrar capability migration",
    async () => {
      await withDatabase(async ({ databaseUrl: targetUrl, sql }) => {
        const result = await runMigrations({
          databaseUrl: targetUrl,
          migrationsDirectory: PROJECT_MIGRATIONS,
          logger: () => undefined,
        });
        expect(result.appliedFiles).toContain("0018_extension_type_registration_capability.sql");
        const ledger = await sql<Array<{ version: number | bigint; filename: string; checksum_sha256: string }>>`
          SELECT version, filename, checksum_sha256
            FROM public.schema_migration
           WHERE version = 18
        `;
        expect(ledger.map((row) => ({ ...row, version: Number(row.version) }))).toEqual([{
          version: 18,
          filename: "0018_extension_type_registration_capability.sql",
          checksum_sha256: "77e80f10c1c148fe79dcf71c546afe87fbdf97ac7f320644f5e550c88d409fc3",
        }]);
      });
    },
    60_000,
  );

  test(
    "applies the exact governed cashier-session migration",
    async () => {
      await withDatabase(async ({ databaseUrl: targetUrl, sql }) => {
        const result = await runMigrations({
          databaseUrl: targetUrl,
          migrationsDirectory: PROJECT_MIGRATIONS,
          logger: () => undefined,
        });
        expect(result.appliedFiles).toContain("0024_governed_cashier_sessions.sql");
        const ledger = await sql<Array<{
          version: number | bigint;
          filename: string;
          checksum_sha256: string;
        }>>`
          SELECT version, filename, checksum_sha256
            FROM public.schema_migration
           WHERE version = 24
        `;
        expect(ledger.map((row) => ({ ...row, version: Number(row.version) }))).toEqual([{
          version: 24,
          filename: "0024_governed_cashier_sessions.sql",
          checksum_sha256: "8884596df1155a308c752e733834e9cdcf95dd462b286450c6dbc3ae22b50e76",
        }]);

        const shape = await sql<Array<{ tables: number; policies: number; functions: number }>>`
          SELECT
            (SELECT count(*)::int FROM pg_catalog.pg_tables WHERE schemaname = 'public') AS tables,
            (SELECT count(*)::int FROM pg_catalog.pg_policies WHERE schemaname = 'public') AS policies,
            (SELECT count(*)::int
               FROM pg_catalog.pg_proc AS procedure
               JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
              WHERE namespace.nspname = 'public'
                AND procedure.proname IN (
                  'open_cashier_session', 'append_cashier_count', 'close_cashier_session'
                )) AS functions
        `;
        expect(shape).toEqual([{ tables: 108, policies: 98, functions: 3 }]);
      });
    },
    60_000,
  );

  test(
    "applies the exact governed receivable-transfer migration",
    async () => {
      await withDatabase(async ({ databaseUrl: targetUrl, sql }) => {
        const result = await runMigrations({
          databaseUrl: targetUrl,
          migrationsDirectory: PROJECT_MIGRATIONS,
          logger: () => undefined,
        });
        expect(result.appliedFiles).toContain("0025_governed_receivable_transfer.sql");
        const ledger = await sql<Array<{
          version: number | bigint;
          filename: string;
          checksum_sha256: string;
        }>>`
          SELECT version, filename, checksum_sha256
            FROM public.schema_migration
           WHERE version = 25
        `;
        expect(ledger.map((row) => ({ ...row, version: Number(row.version) }))).toEqual([{
          version: 25,
          filename: "0025_governed_receivable_transfer.sql",
          checksum_sha256: "ce3fe52783ffb467f56a2a7342c0a5808ab8824d625f3b01b5e3532e1191c9fe",
        }]);

        const shape = await sql<Array<{
          tables: number; policies: number; functions: number; approvalColumns: number;
        }>>`
          SELECT
            (SELECT count(*)::int FROM pg_catalog.pg_tables WHERE schemaname = 'public') AS tables,
            (SELECT count(*)::int FROM pg_catalog.pg_policies WHERE schemaname = 'public') AS policies,
            (SELECT count(*)::int
               FROM pg_catalog.pg_proc AS procedure
               JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
              WHERE namespace.nspname = 'public'
                AND procedure.proname = 'create_receivable_transfer') AS functions,
            (SELECT count(*)::int
               FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'journal'
                AND column_name = 'approval_request_id') AS "approvalColumns"
        `;
        expect(shape).toEqual([{ tables: 108, policies: 98, functions: 1, approvalColumns: 1 }]);
      });
    },
    60_000,
  );

  test(
    "applies the exact governed housekeeping-task transition migration",
    async () => {
      await withDatabase(async ({ databaseUrl: targetUrl, sql }) => {
        const result = await runMigrations({
          databaseUrl: targetUrl,
          migrationsDirectory: PROJECT_MIGRATIONS,
          logger: () => undefined,
        });
        expect(result.appliedFiles).toContain("0026_governed_housekeeping_task_transition.sql");
        const ledger = await sql<Array<{
          version: number | bigint;
          filename: string;
          checksum_sha256: string;
        }>>`
          SELECT version, filename, checksum_sha256
            FROM public.schema_migration
           WHERE version = 26
        `;
        expect(ledger.map((row) => ({ ...row, version: Number(row.version) }))).toEqual([{
          version: 26,
          filename: "0026_governed_housekeeping_task_transition.sql",
          checksum_sha256: "f3667d8443db21ad921512bfadc453e9a9f341b60594f888dad7f69a88f0fba6",
        }]);

        const shape = await sql<Array<{
          tables: number; policies: number; functions: number;
        }>>`
          SELECT
            (SELECT count(*)::int FROM pg_catalog.pg_tables WHERE schemaname = 'public') AS tables,
            (SELECT count(*)::int FROM pg_catalog.pg_policies WHERE schemaname = 'public') AS policies,
            (SELECT count(*)::int
               FROM pg_catalog.pg_proc AS procedure
               JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
              WHERE namespace.nspname = 'public'
                AND procedure.proname = 'transition_housekeeping_task') AS functions
        `;
        expect(shape).toEqual([{ tables: 108, policies: 98, functions: 1 }]);
      });
    },
    60_000,
  );

  test(
    "applies the exact governed housekeeping task-sheet generation migration",
    async () => {
      await withDatabase(async ({ databaseUrl: targetUrl, sql }) => {
        const result = await runMigrations({
          databaseUrl: targetUrl,
          migrationsDirectory: PROJECT_MIGRATIONS,
          logger: () => undefined,
        });
        expect(result.appliedFiles).toContain("0027_governed_housekeeping_task_sheet_generation.sql");
        const ledger = await sql<Array<{
          version: number | bigint; filename: string; checksum_sha256: string;
        }>>`
          SELECT version, filename, checksum_sha256
          FROM public.schema_migration
          WHERE version = 27
        `;
        expect(ledger.map((row) => ({ ...row, version: Number(row.version) }))).toEqual([{
          version: 27,
          filename: "0027_governed_housekeeping_task_sheet_generation.sql",
          checksum_sha256: "fb46db4af1ebca0dd1d66501e51ed2064c5dc108a40701a6a7b00d170b30be43",
        }]);
        const shape = await sql<Array<{ functions: number; indexes: number }>>`
          SELECT
            (SELECT count(*)::int FROM pg_proc AS procedure
              JOIN pg_namespace AS namespace ON namespace.oid=procedure.pronamespace
              WHERE namespace.nspname='public'
                AND procedure.proname='govern_housekeeping_task_sheet') AS functions,
            (SELECT count(*)::int FROM pg_indexes
              WHERE schemaname='public'
                AND indexname IN ('task_sheet_property_date_unique','task_housekeeping_sheet_space_unique')) AS indexes
        `;
        expect(shape).toEqual([{ functions: 1, indexes: 2 }]);
      });
    },
    60_000,
  );

  test(
    "applies the exact governed initial unit-condition migration",
    async () => {
      await withDatabase(async ({ databaseUrl: targetUrl, sql }) => {
        const result = await runMigrations({
          databaseUrl: targetUrl,
          migrationsDirectory: PROJECT_MIGRATIONS,
          logger: () => undefined,
        });
        expect(result.appliedFiles).toContain("0030_governed_unit_condition_initialization.sql");
        const ledger = await sql<Array<{
          version: number | bigint; filename: string; checksum_sha256: string;
        }>>`
          SELECT version, filename, checksum_sha256
            FROM public.schema_migration
           WHERE version = 30
        `;
        expect(ledger.map((row) => ({ ...row, version: Number(row.version) }))).toEqual([{
          version: 30,
          filename: "0030_governed_unit_condition_initialization.sql",
          checksum_sha256: "2afcace484bcba5f3513a92102216f8f73da2159e1f2348f6870b459fcef8524",
        }]);
        const shape = await sql<Array<{ functions: number }>>`
          SELECT count(*)::int AS functions
            FROM pg_catalog.pg_proc AS procedure
            JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid=procedure.pronamespace
           WHERE namespace.nspname='public'
             AND procedure.proname='initialize_unit_condition'
        `;
        expect(shape).toEqual([{ functions: 1 }]);
      });
    },
    60_000,
  );

  test(
    "applies the exact governed arrival pickup-task transition migration",
    async () => {
      await withDatabase(async ({ databaseUrl: targetUrl, sql }) => {
        const result = await runMigrations({
          databaseUrl: targetUrl,
          migrationsDirectory: PROJECT_MIGRATIONS,
          logger: () => undefined,
        });
        expect(result.appliedFiles).toContain("0031_governed_arrival_pickup_task_transition.sql");
        const ledger = await sql<Array<{
          version: number | bigint; filename: string; checksum_sha256: string;
        }>>`
          SELECT version, filename, checksum_sha256
            FROM public.schema_migration
           WHERE version = 31
        `;
        expect(ledger.map((row) => ({ ...row, version: Number(row.version) }))).toEqual([{
          version: 31,
          filename: "0031_governed_arrival_pickup_task_transition.sql",
          checksum_sha256: "e337fcb52b38e98d5877f3ce927dd54825d465d90328104d87e1df83a187598f",
        }]);
        const shape = await sql<Array<{ functions: number }>>`
          SELECT count(*)::int AS functions
            FROM pg_catalog.pg_proc AS procedure
            JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid=procedure.pronamespace
           WHERE namespace.nspname='public'
             AND procedure.proname='transition_arrival_pickup_task'
        `;
        expect(shape).toEqual([{ functions: 1 }]);
      });
    },
    60_000,
  );

  test(
    "applies the exact governed arrival room-cleaning task migration",
    async () => {
      await withDatabase(async ({ databaseUrl: targetUrl, sql }) => {
        const result = await runMigrations({
          databaseUrl: targetUrl,
          migrationsDirectory: PROJECT_MIGRATIONS,
          logger: () => undefined,
        });
        expect(result.appliedFiles).toContain("0032_governed_arrival_room_cleaning_task.sql");
        const ledger = await sql<Array<{
          version: number | bigint; filename: string; checksum_sha256: string;
        }>>`
          SELECT version, filename, checksum_sha256
            FROM public.schema_migration
           WHERE version = 32
        `;
        expect(ledger.map((row) => ({ ...row, version: Number(row.version) }))).toEqual([{
          version: 32,
          filename: "0032_governed_arrival_room_cleaning_task.sql",
          checksum_sha256: "f69c72349c237d635826136575ec1c66ccb48cf0f0ac9b3ea4a83f786b2a6718",
        }]);
        const shape = await sql<Array<{ functions: number; taskInsert: boolean; taskUpdate: boolean }>>`
          SELECT
            (SELECT count(*)::int
               FROM pg_catalog.pg_proc AS procedure
               JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid=procedure.pronamespace
              WHERE namespace.nspname='public'
                AND procedure.proname='create_arrival_room_cleaning_task') AS functions,
            has_table_privilege('app_role', 'public.task', 'INSERT') AS "taskInsert",
            has_table_privilege('app_role', 'public.task', 'UPDATE') AS "taskUpdate"
        `;
        expect(shape).toEqual([{ functions: 1, taskInsert: false, taskUpdate: false }]);
      });
    },
    60_000,
  );

  test(
    "applies the exact governed due-in room-assignment migration",
    async () => {
      await withDatabase(async ({ databaseUrl: targetUrl, sql }) => {
        const result = await runMigrations({
          databaseUrl: targetUrl,
          migrationsDirectory: PROJECT_MIGRATIONS,
          logger: () => undefined,
        });
        expect(result.appliedFiles).toContain("0033_governed_due_in_room_assignment.sql");
        const ledger = await sql<Array<{
          version: number | bigint; filename: string; checksum_sha256: string;
        }>>`
          SELECT version, filename, checksum_sha256
            FROM public.schema_migration
           WHERE version = 33
        `;
        expect(ledger.map((row) => ({ ...row, version: Number(row.version) }))).toEqual([{
          version: 33,
          filename: "0033_governed_due_in_room_assignment.sql",
          checksum_sha256: "cd983c31250bc5ace863fe156bc6aa15927eac74ba24ab449eff692e87aae82d",
        }]);
      });
    },
    60_000,
  );

  test(
    "applies the exact bounded runtime due-arrival scope migration",
    async () => {
      await withDatabase(async ({ databaseUrl: targetUrl, sql }) => {
        const result = await runMigrations({
          databaseUrl: targetUrl,
          migrationsDirectory: PROJECT_MIGRATIONS,
          logger: () => undefined,
        });
        expect(result.appliedFiles).toContain("0034_runtime_due_arrival_scopes.sql");
        const ledger = await sql<Array<{
          version: number | bigint; filename: string; checksum_sha256: string;
        }>>`
          SELECT version, filename, checksum_sha256
            FROM public.schema_migration
           WHERE version = 34
        `;
        expect(ledger.map((row) => ({ ...row, version: Number(row.version) }))).toEqual([{
          version: 34,
          filename: "0034_runtime_due_arrival_scopes.sql",
          checksum_sha256: "b59480ab270c8822c9f972de527fc47ab73c411dc9037d37e6d3d326f19cc21a",
        }]);
        const capability = await sql<Array<{
          owner: string; publicExecute: boolean; appExecute: boolean; runtimeExecute: boolean;
          volatility: string; config: string[] | null;
        }>>`
          SELECT pg_catalog.pg_get_userbyid(procedure.proowner) AS owner,
                 pg_catalog.has_function_privilege('public', procedure.oid, 'EXECUTE') AS "publicExecute",
                 pg_catalog.has_function_privilege('app_role', procedure.oid, 'EXECUTE') AS "appExecute",
                 pg_catalog.has_function_privilege('yellow_runtime', procedure.oid, 'EXECUTE') AS "runtimeExecute",
                 procedure.provolatile::text AS volatility,
                 procedure.proconfig AS config
            FROM pg_catalog.pg_proc AS procedure
            JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid=procedure.pronamespace
           WHERE namespace.nspname='public'
             AND procedure.proname='runtime_due_arrival_scopes'
        `;
        expect(capability).toEqual([{
          owner: "yellow_owner",
          publicExecute: false,
          appExecute: false,
          runtimeExecute: true,
          volatility: "s",
          config: ["search_path=pg_catalog, public, pg_temp"],
        }]);
      });
    },
    60_000,
  );

  test(
    "applies the exact bounded runtime due-departure scope migration",
    async () => {
      await withDatabase(async ({ databaseUrl: targetUrl, sql }) => {
        const result = await runMigrations({
          databaseUrl: targetUrl,
          migrationsDirectory: PROJECT_MIGRATIONS,
          logger: () => undefined,
        });
        expect(result.appliedFiles).toContain("0035_runtime_due_departure_scopes.sql");
        const ledger = await sql<Array<{
          version: number | bigint; filename: string; checksum_sha256: string;
        }>>`
          SELECT version, filename, checksum_sha256
            FROM public.schema_migration
           WHERE version = 35
        `;
        expect(ledger.map((row) => ({ ...row, version: Number(row.version) }))).toEqual([{
          version: 35,
          filename: "0035_runtime_due_departure_scopes.sql",
          checksum_sha256: "ee102c6e479badc14fb8945d0c493905840d1c58845b9def4d74d6e2bf1a7447",
        }]);
        const capability = await sql<Array<{
          owner: string; publicExecute: boolean; appExecute: boolean; runtimeExecute: boolean;
          volatility: string; config: string[] | null;
        }>>`
          SELECT pg_catalog.pg_get_userbyid(procedure.proowner) AS owner,
                 pg_catalog.has_function_privilege('public', procedure.oid, 'EXECUTE') AS "publicExecute",
                 pg_catalog.has_function_privilege('app_role', procedure.oid, 'EXECUTE') AS "appExecute",
                 pg_catalog.has_function_privilege('yellow_runtime', procedure.oid, 'EXECUTE') AS "runtimeExecute",
                 procedure.provolatile::text AS volatility,
                 procedure.proconfig AS config
            FROM pg_catalog.pg_proc AS procedure
            JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid=procedure.pronamespace
           WHERE namespace.nspname='public'
             AND procedure.proname='runtime_due_departure_scopes'
        `;
        expect(capability).toEqual([{
          owner: "yellow_owner",
          publicExecute: false,
          appExecute: false,
          runtimeExecute: true,
          volatility: "s",
          config: ["search_path=pg_catalog, public, pg_temp"],
        }]);
      });
    },
    60_000,
  );

  test(
    "applies the exact governed room-discrepancy reporting migration",
    async () => {
      await withDatabase(async ({ databaseUrl: targetUrl, sql }) => {
        const result = await runMigrations({
          databaseUrl: targetUrl,
          migrationsDirectory: PROJECT_MIGRATIONS,
          logger: () => undefined,
        });
        expect(result.appliedFiles).toContain("0036_governed_room_discrepancy_reporting.sql");
        const ledger = await sql<Array<{
          version: number | bigint; filename: string; checksum_sha256: string;
        }>>`
          SELECT version, filename, checksum_sha256
            FROM public.schema_migration
           WHERE version = 36
        `;
        expect(ledger.map((row) => ({ ...row, version: Number(row.version) }))).toEqual([{
          version: 36,
          filename: "0036_governed_room_discrepancy_reporting.sql",
          checksum_sha256: "bd72ca9ff3b02d4f0c00b4ce82a6afb1591056b71a04cebda71b61efacc61b76",
        }]);
        const capability = await sql<Array<{
          owner: string; securityDefiner: boolean; publicExecute: boolean; appExecute: boolean;
          runtimeExecute: boolean; volatility: string; config: string[] | null;
        }>>`
          SELECT pg_catalog.pg_get_userbyid(procedure.proowner) AS owner,
                 procedure.prosecdef AS "securityDefiner",
                 pg_catalog.has_function_privilege('public', procedure.oid, 'EXECUTE') AS "publicExecute",
                 pg_catalog.has_function_privilege('app_role', procedure.oid, 'EXECUTE') AS "appExecute",
                 pg_catalog.has_function_privilege('yellow_runtime', procedure.oid, 'EXECUTE') AS "runtimeExecute",
                 procedure.provolatile::text AS volatility,
                 procedure.proconfig AS config
            FROM pg_catalog.pg_proc AS procedure
            JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid=procedure.pronamespace
           WHERE namespace.nspname='public'
             AND procedure.oid =
               'public.report_room_discrepancy(uuid,uuid,uuid,text,integer,uuid)'::regprocedure
        `;
        expect(capability).toEqual([{
          owner: "yellow_owner",
          securityDefiner: true,
          publicExecute: false,
          appExecute: true,
          runtimeExecute: false,
          volatility: "v",
          config: ["search_path=pg_catalog, public"],
        }]);
        const parkingChokePoint = await sql<Array<{
          owner: string; securityDefiner: boolean; publicExecute: boolean; appExecute: boolean;
          runtimeExecute: boolean; volatility: string; config: string[] | null;
        }>>`
          SELECT pg_catalog.pg_get_userbyid(procedure.proowner) AS owner,
                 procedure.prosecdef AS "securityDefiner",
                 pg_catalog.has_function_privilege('public', procedure.oid, 'EXECUTE') AS "publicExecute",
                 pg_catalog.has_function_privilege('app_role', procedure.oid, 'EXECUTE') AS "appExecute",
                 pg_catalog.has_function_privilege('yellow_runtime', procedure.oid, 'EXECUTE') AS "runtimeExecute",
                 procedure.provolatile::text AS volatility,
                 procedure.proconfig AS config
            FROM pg_catalog.pg_proc AS procedure
            JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid=procedure.pronamespace
           WHERE namespace.nspname='public'
             AND procedure.oid =
               'public.record_occupancy(uuid,uuid,tstzrange,uuid,text,boolean,uuid)'::regprocedure
        `;
        expect(parkingChokePoint).toEqual([{
          owner: "yellow_owner",
          securityDefiner: true,
          publicExecute: false,
          appExecute: false,
          runtimeExecute: false,
          volatility: "v",
          config: ["search_path=pg_catalog, public, pg_temp"],
        }]);
      });
    },
    60_000,
  );

  test(
    "applies the exact governed vehicle-parking assignment migration",
    async () => {
      await withDatabase(async ({ databaseUrl: targetUrl, sql }) => {
        const result = await runMigrations({
          databaseUrl: targetUrl,
          migrationsDirectory: PROJECT_MIGRATIONS,
          logger: () => undefined,
        });
        expect(result.appliedFiles).toContain("0037_governed_vehicle_parking_assignment.sql");
        const ledger = await sql<Array<{
          version: number | bigint; filename: string; checksum_sha256: string;
        }>>`
          SELECT version, filename, checksum_sha256
            FROM public.schema_migration
           WHERE version = 37
        `;
        expect(ledger.map((row) => ({ ...row, version: Number(row.version) }))).toEqual([{
          version: 37,
          filename: "0037_governed_vehicle_parking_assignment.sql",
          checksum_sha256: "82df1de46ee97771390d1d102142380b40b590456f687fdd1bd0cd1d3a4d601a",
        }]);
        const capability = await sql<Array<{
          owner: string; securityDefiner: boolean; publicExecute: boolean; appExecute: boolean;
          runtimeExecute: boolean; volatility: string; config: string[] | null;
        }>>`
          SELECT pg_catalog.pg_get_userbyid(procedure.proowner) AS owner,
                 procedure.prosecdef AS "securityDefiner",
                 pg_catalog.has_function_privilege('public', procedure.oid, 'EXECUTE') AS "publicExecute",
                 pg_catalog.has_function_privilege('app_role', procedure.oid, 'EXECUTE') AS "appExecute",
                 pg_catalog.has_function_privilege('yellow_runtime', procedure.oid, 'EXECUTE') AS "runtimeExecute",
                 procedure.provolatile::text AS volatility,
                 procedure.proconfig AS config
            FROM pg_catalog.pg_proc AS procedure
            JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid=procedure.pronamespace
           WHERE namespace.nspname='public'
             AND procedure.oid =
               'public.assign_vehicle_parking(uuid,uuid,uuid,uuid,uuid)'::regprocedure
        `;
        expect(capability).toEqual([{
          owner: "yellow_owner",
          securityDefiner: true,
          publicExecute: false,
          appExecute: true,
          runtimeExecute: false,
          volatility: "v",
          config: ["search_path=pg_catalog, public"],
        }]);
      });
    },
    60_000,
  );

  test(
    "applies the exact canonical tax-attribution persistence migration",
    async () => {
      await withDatabase(async ({ databaseUrl: targetUrl, sql }) => {
        const result = await runMigrations({
          databaseUrl: targetUrl,
          migrationsDirectory: PROJECT_MIGRATIONS,
          logger: () => undefined,
        });
        expect(result.appliedFiles).toContain("0038_canonical_tax_attribution_persistence.sql");

        const ledger = await sql<Array<{
          version: number | bigint; filename: string; checksum_sha256: string;
        }>>`
          SELECT version, filename, checksum_sha256
            FROM public.schema_migration
           WHERE version = 38
        `;
        expect(ledger.map((row) => ({ ...row, version: Number(row.version) }))).toEqual([{
          version: 38,
          filename: "0038_canonical_tax_attribution_persistence.sql",
          checksum_sha256: "dea9cfaf573d56ce2c0f5ee7987bf7009d12d0517f72dcd8a3b316232937f982",
        }]);

        const relation = await sql<Array<{
          owner: string; rls: boolean; tenantPolicy: boolean; appSelect: boolean;
          rawDmlDenied: boolean; propertyFk: boolean; actorFk: boolean; hashUnique: boolean;
        }>>`
          SELECT pg_catalog.pg_get_userbyid(cls.relowner) AS owner,
                 cls.relrowsecurity AS rls,
                 EXISTS (
                   SELECT 1 FROM pg_catalog.pg_policy
                    WHERE polrelid=cls.oid AND polname='tenant_isolation'
                 ) AS "tenantPolicy",
                 pg_catalog.has_table_privilege(
                   'app_role', cls.oid, 'SELECT'
                 ) AS "appSelect",
                 NOT (
                   pg_catalog.has_table_privilege('app_role', cls.oid, 'INSERT')
                   OR pg_catalog.has_table_privilege('app_role', cls.oid, 'UPDATE')
                   OR pg_catalog.has_table_privilege('app_role', cls.oid, 'DELETE')
                   OR pg_catalog.has_table_privilege('app_role', cls.oid, 'TRUNCATE')
                 ) AS "rawDmlDenied",
                 EXISTS (
                   SELECT 1 FROM pg_catalog.pg_constraint
                    WHERE conrelid=cls.oid
                      AND conname='tax_attribution_snapshot_property_fk'
                      AND confrelid='public.org_node'::regclass
                 ) AS "propertyFk",
                 EXISTS (
                   SELECT 1 FROM pg_catalog.pg_constraint
                    WHERE conrelid=cls.oid
                      AND conname='tax_attribution_snapshot_actor_fk'
                      AND confrelid='public.app_user'::regclass
                 ) AS "actorFk",
                 EXISTS (
                   SELECT 1 FROM pg_catalog.pg_constraint
                    WHERE conrelid=cls.oid
                      AND conname='tax_attribution_snapshot_hash_uq'
                      AND contype='u'
                 ) AS "hashUnique"
            FROM pg_catalog.pg_class AS cls
           WHERE cls.oid='public.tax_attribution_snapshot'::regclass
        `;
        expect(relation).toEqual([{
          owner: "yellow_owner",
          rls: true,
          tenantPolicy: true,
          appSelect: true,
          rawDmlDenied: true,
          propertyFk: true,
          actorFk: true,
          hashUnique: true,
        }]);

        const capability = await sql<Array<{
          owner: string; securityDefiner: boolean; publicExecute: boolean; appExecute: boolean;
          runtimeExecute: boolean; volatility: string; config: string[] | null;
        }>>`
          SELECT pg_catalog.pg_get_userbyid(procedure.proowner) AS owner,
                 procedure.prosecdef AS "securityDefiner",
                 pg_catalog.has_function_privilege('public', procedure.oid, 'EXECUTE') AS "publicExecute",
                 pg_catalog.has_function_privilege('app_role', procedure.oid, 'EXECUTE') AS "appExecute",
                 pg_catalog.has_function_privilege('yellow_runtime', procedure.oid, 'EXECUTE') AS "runtimeExecute",
                 procedure.provolatile::text AS volatility,
                 procedure.proconfig AS config
            FROM pg_catalog.pg_proc AS procedure
            JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid=procedure.pronamespace
           WHERE namespace.nspname='public'
             AND procedure.oid =
               'public.record_tax_attribution_snapshot(uuid,uuid,uuid,integer,text,text,text,text,jsonb)'::regprocedure
        `;
        expect(capability).toEqual([{
          owner: "yellow_owner",
          securityDefiner: true,
          publicExecute: false,
          appExecute: true,
          runtimeExecute: false,
          volatility: "v",
          config: ["search_path=pg_catalog, public, pg_temp"],
        }]);
      });
    },
    60_000,
  );

  test(
    "applies the exact quoted-tax cart-hold binding migration and denies capability abuse",
    async () => {
      await withDatabase(async ({ databaseUrl: targetUrl, sql }) => {
        const result = await runMigrations({
          databaseUrl: targetUrl,
          migrationsDirectory: PROJECT_MIGRATIONS,
          logger: () => undefined,
        });
        expect(result.appliedFiles).toContain("0040_quoted_tax_hold_binding.sql");

        const ledger = await sql<Array<{
          version: number | bigint; filename: string; checksum_sha256: string;
        }>>`
          SELECT version, filename, checksum_sha256
            FROM public.schema_migration
           WHERE version = 40
        `;
        expect(ledger.map((row) => ({ ...row, version: Number(row.version) }))).toEqual([{
          version: 40,
          filename: "0040_quoted_tax_hold_binding.sql",
          checksum_sha256: "b61d1332acf17df9189612d355fb584754bdd7ddda9782e377bf73be44cc589b",
        }]);

        const relation = await sql<Array<{
          owner: string; rls: boolean; tenantPolicy: boolean; appSelect: boolean;
          rawDmlDenied: boolean; propertyFk: boolean; actorFk: boolean;
          holdFk: boolean; attributionFk: boolean; holdUnique: boolean;
          attributionUnique: boolean; snapshotHashUnique: boolean; parentHoldIdentity: boolean;
          parentAttributionIdentity: boolean;
        }>>`
          SELECT pg_catalog.pg_get_userbyid(cls.relowner) AS owner,
                 cls.relrowsecurity AS rls,
                 EXISTS (
                   SELECT 1 FROM pg_catalog.pg_policy
                    WHERE polrelid=cls.oid AND polname='tenant_isolation'
                 ) AS "tenantPolicy",
                 pg_catalog.has_table_privilege('app_role', cls.oid, 'SELECT') AS "appSelect",
                 NOT (
                   pg_catalog.has_table_privilege('app_role', cls.oid, 'INSERT')
                   OR pg_catalog.has_table_privilege('app_role', cls.oid, 'UPDATE')
                   OR pg_catalog.has_table_privilege('app_role', cls.oid, 'DELETE')
                   OR pg_catalog.has_table_privilege('app_role', cls.oid, 'TRUNCATE')
                 ) AS "rawDmlDenied",
                 EXISTS (
                   SELECT 1 FROM pg_catalog.pg_constraint
                    WHERE conrelid=cls.oid
                      AND conname='tax_attribution_hold_binding_property_fk'
                      AND confrelid='public.org_node'::regclass
                 ) AS "propertyFk",
                 EXISTS (
                   SELECT 1 FROM pg_catalog.pg_constraint
                    WHERE conrelid=cls.oid
                      AND conname='tax_attribution_hold_binding_actor_fk'
                      AND confrelid='public.app_user'::regclass
                 ) AS "actorFk",
                 EXISTS (
                   SELECT 1 FROM pg_catalog.pg_constraint
                    WHERE conrelid=cls.oid
                      AND conname='tax_attribution_hold_binding_hold_fk'
                      AND confrelid='public.hold'::regclass
                 ) AS "holdFk",
                 EXISTS (
                   SELECT 1 FROM pg_catalog.pg_constraint
                    WHERE conrelid=cls.oid
                      AND conname='tax_attribution_hold_binding_attribution_fk'
                      AND confrelid='public.tax_attribution_snapshot'::regclass
                 ) AS "attributionFk",
                 EXISTS (
                   SELECT 1 FROM pg_catalog.pg_constraint
                    WHERE conrelid=cls.oid
                      AND conname='tax_attribution_hold_binding_hold_uq'
                      AND contype='u'
                 ) AS "holdUnique",
                 EXISTS (
                   SELECT 1 FROM pg_catalog.pg_constraint
                    WHERE conrelid=cls.oid
                      AND conname='tax_attribution_hold_binding_attribution_uq'
                      AND contype='u'
                 ) AS "attributionUnique",
                 EXISTS (
                   SELECT 1 FROM pg_catalog.pg_constraint
                    WHERE conrelid=cls.oid
                      AND conname='tax_attribution_hold_binding_snapshot_hash_uq'
                      AND contype='u'
                 ) AS "snapshotHashUnique",
                 EXISTS (
                   SELECT 1 FROM pg_catalog.pg_constraint
                    WHERE conrelid='public.hold'::regclass
                      AND conname='hold_tax_binding_identity_uq'
                      AND contype='u'
                 ) AS "parentHoldIdentity",
                 EXISTS (
                   SELECT 1 FROM pg_catalog.pg_constraint
                    WHERE conrelid='public.tax_attribution_snapshot'::regclass
                      AND conname='tax_attribution_snapshot_binding_identity_uq'
                      AND contype='u'
                 ) AS "parentAttributionIdentity"
            FROM pg_catalog.pg_class AS cls
           WHERE cls.oid='public.tax_attribution_hold_binding'::regclass
        `;
        expect(relation).toEqual([{
          owner: "yellow_owner",
          rls: true,
          tenantPolicy: true,
          appSelect: true,
          rawDmlDenied: true,
          propertyFk: true,
          actorFk: true,
          holdFk: true,
          attributionFk: true,
          holdUnique: true,
          attributionUnique: true,
          snapshotHashUnique: true,
          parentHoldIdentity: true,
          parentAttributionIdentity: true,
        }]);

        const capability = await sql<Array<{
          owner: string; securityDefiner: boolean; publicExecute: boolean;
          appExecute: boolean; runtimeExecute: boolean; volatility: string;
          config: string[] | null; result: string;
        }>>`
          SELECT pg_catalog.pg_get_userbyid(procedure.proowner) AS owner,
                 procedure.prosecdef AS "securityDefiner",
                 pg_catalog.has_function_privilege('public', procedure.oid, 'EXECUTE') AS "publicExecute",
                 pg_catalog.has_function_privilege('app_role', procedure.oid, 'EXECUTE') AS "appExecute",
                 pg_catalog.has_function_privilege('yellow_runtime', procedure.oid, 'EXECUTE') AS "runtimeExecute",
                 procedure.provolatile::text AS volatility,
                 procedure.proconfig AS config,
                 pg_catalog.pg_get_function_result(procedure.oid) AS result
            FROM pg_catalog.pg_proc AS procedure
           WHERE procedure.oid =
             'public.record_tax_attribution_hold_binding(uuid,uuid,uuid,uuid,uuid)'::regprocedure
        `;
        expect(capability).toEqual([{
          owner: "yellow_owner",
          securityDefiner: true,
          publicExecute: false,
          appExecute: true,
          runtimeExecute: false,
          volatility: "v",
          config: ["search_path=pg_catalog, public, pg_temp"],
          result: "TABLE(binding_id uuid, property_node uuid, hold_id uuid, attribution_id uuid, origin_quote_hash text, snapshot_hash text, currency character, bound_by uuid, bound_at timestamp with time zone, created boolean)",
        }]);

        const expectSqlstate = async (operation: () => Promise<unknown>, state: string) => {
          try {
            await operation();
          } catch (error) {
            expect((error as { errno?: string }).errno).toBe(state);
            return;
          }
          throw new Error(`Expected SQLSTATE ${state}`);
        };
        await expectSqlstate(
          () => sql.begin(async (tx) => {
            await tx.unsafe("SET LOCAL ROLE app_role");
            await tx`SELECT * FROM public.record_tax_attribution_hold_binding(
              ${randomUUID()}::uuid, ${randomUUID()}::uuid, ${randomUUID()}::uuid,
              ${randomUUID()}::uuid, ${randomUUID()}::uuid
            )`;
          }),
          "42501",
        );
        await expectSqlstate(
          () => sql.begin(async (tx) => {
            await tx.unsafe("SET LOCAL ROLE app_role");
            await tx.unsafe("INSERT INTO public.tax_attribution_hold_binding DEFAULT VALUES");
          }),
          "42501",
        );
      });
    },
    60_000,
  );

  test(
    "applies the exact positive-tax semantic-route migration with SELECT-only app authority",
    async () => {
      await withDatabase(async ({ databaseUrl: targetUrl, sql }) => {
        const result = await runMigrations({
          databaseUrl: targetUrl,
          migrationsDirectory: PROJECT_MIGRATIONS,
          logger: () => undefined,
        });
        expect(result.appliedFiles).toContain("0043_positive_tax_semantic_route.sql");

        const ledger = await sql<Array<{
          version: number | bigint; filename: string; checksum_sha256: string;
        }>>`
          SELECT version, filename, checksum_sha256
            FROM public.schema_migration
           WHERE version = 43
        `;
        expect(ledger.map((row) => ({ ...row, version: Number(row.version) }))).toEqual([{
          version: 43,
          filename: "0043_positive_tax_semantic_route.sql",
          checksum_sha256: "a5036df30f07c4c8add08c46cdb805c71b87597efa542e368e64aa35d572bf40",
        }]);

        const relation = await sql<Array<{
          tables: number; policies: number; owner: string; rls: boolean;
          appSelect: boolean; appMutation: boolean; publicPrivileges: number;
          runtimePrivileges: number; constraintCount: number;
          tenantLeadingLookup: boolean;
        }>>`
          SELECT
            (SELECT count(*)::int FROM pg_catalog.pg_tables
              WHERE schemaname = 'public') AS tables,
            (SELECT count(*)::int FROM pg_catalog.pg_policies
              WHERE schemaname = 'public') AS policies,
            pg_catalog.pg_get_userbyid(class.relowner) AS owner,
            class.relrowsecurity AS rls,
            pg_catalog.has_table_privilege('app_role', class.oid, 'SELECT') AS "appSelect",
            (
              pg_catalog.has_table_privilege('app_role', class.oid, 'INSERT')
              OR pg_catalog.has_table_privilege('app_role', class.oid, 'UPDATE')
              OR pg_catalog.has_table_privilege('app_role', class.oid, 'DELETE')
              OR pg_catalog.has_table_privilege('app_role', class.oid, 'TRUNCATE')
            ) AS "appMutation",
            (
              SELECT count(*)::int
                FROM pg_catalog.aclexplode(
                  COALESCE(class.relacl, pg_catalog.acldefault('r', class.relowner))
                ) AS acl
               WHERE acl.grantee = 0
            ) AS "publicPrivileges",
            (
              SELECT count(*)::int
                FROM unnest(ARRAY[
                  'SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'
                ]) AS privilege
               WHERE pg_catalog.has_table_privilege('yellow_runtime', class.oid, privilege)
            ) AS "runtimePrivileges",
            (
              SELECT count(*)::int FROM pg_catalog.pg_constraint
               WHERE conrelid = class.oid
            ) AS "constraintCount",
            EXISTS (
              SELECT 1
                FROM pg_catalog.pg_index AS index
                JOIN pg_catalog.pg_class AS index_class ON index_class.oid = index.indexrelid
                JOIN pg_catalog.pg_attribute AS leading_attribute
                  ON leading_attribute.attrelid = class.oid
                 AND leading_attribute.attnum = (index.indkey::smallint[])[0]
               WHERE index.indrelid = class.oid
                 AND index_class.relname = 'tax_semantic_route_lookup'
                 AND leading_attribute.attname = 'tenant_id'
            ) AS "tenantLeadingLookup"
          FROM pg_catalog.pg_class AS class
         WHERE class.oid = 'public.tax_semantic_route'::regclass
        `;
        expect(relation).toEqual([{
          tables: 108,
          policies: 98,
          owner: "yellow_owner",
          rls: true,
          appSelect: true,
          appMutation: false,
          publicPrivileges: 0,
          runtimePrivileges: 0,
          constraintCount: 12,
          tenantLeadingLookup: true,
        }]);
      });
    },
    60_000,
  );

  test(
    "stages historical lineage then applies correction, repair and all India fiscal evidence exactly once",
    async () => {
      await withDatabase(async ({ databaseUrl: targetUrl, sql }) => {
        const predecessorFiles = await readdir(PROJECT_MIGRATIONS);
        const predecessor = Object.fromEntries(await Promise.all(
          predecessorFiles
            .filter((filename) => {
              const version = Number(filename.slice(0, 4));
              return filename.endsWith(".sql") && version >= 2 && version <= 44;
            })
            .map(async (filename) => [
              filename,
              await readFile(resolve(PROJECT_MIGRATIONS, filename)),
            ] as const),
        ));

        await withMigrationDirectory(predecessor, async (directory) => {
          const predecessorResult = await runMigrations({
            databaseUrl: targetUrl,
            migrationsDirectory: directory,
            logger: () => undefined,
          });
          expect(predecessorResult.appliedFiles).toHaveLength(44);
        });

        const predecessorLedger = await sql<Array<{
          version_bytes: string; filename_bytes: string; checksum_bytes: string; applied_at_bytes: string;
        }>>`
          SELECT pg_catalog.encode(pg_catalog.int8send(version), 'hex') AS version_bytes,
                 pg_catalog.encode(pg_catalog.textsend(filename), 'hex') AS filename_bytes,
                 pg_catalog.encode(pg_catalog.textsend(checksum_sha256), 'hex') AS checksum_bytes,
                 pg_catalog.encode(pg_catalog.timestamptz_send(applied_at), 'hex') AS applied_at_bytes
            FROM public.schema_migration
           WHERE version <= 44
           ORDER BY version
        `;

        const result = await runMigrations({
          databaseUrl: targetUrl,
          migrationsDirectory: PROJECT_MIGRATIONS,
          logger: () => undefined,
        });
        expect(result.appliedFiles).toEqual([
          "0045_governed_positive_tax_correction.sql",
          "0046_positive_tax_posting_ordinal_repair.sql",
          "0047_property_fiscal_registration.sql",
          "0048_party_fiscal_registration.sql",
          "0049_property_fiscal_location.sql",
          "0050_india_gst_item_classification.sql",
          "0051_india_gst_supplier_service_location.sql",
          "0052_india_gst_recipient_sez_status.sql",
          "0053_india_gst_supplier_sez_status.sql",
          "0054_india_sez_unit_loa_renewal.sql",
          "0055_india_gst_supplier_registration_status.sql",
          "0056_india_gst_accommodation_service_provision_date.sql",
        ]);

        const preservedLedger = await sql<Array<{
          version_bytes: string; filename_bytes: string; checksum_bytes: string; applied_at_bytes: string;
        }>>`
          SELECT pg_catalog.encode(pg_catalog.int8send(version), 'hex') AS version_bytes,
                 pg_catalog.encode(pg_catalog.textsend(filename), 'hex') AS filename_bytes,
                 pg_catalog.encode(pg_catalog.textsend(checksum_sha256), 'hex') AS checksum_bytes,
                 pg_catalog.encode(pg_catalog.timestamptz_send(applied_at), 'hex') AS applied_at_bytes
            FROM public.schema_migration
           WHERE version <= 44
           ORDER BY version
        `;
        expect(preservedLedger).toEqual(predecessorLedger);

        const upgradedLedger = await sql<Array<{
          version_bytes: string; filename_bytes: string; checksum_bytes: string; applied_at_bytes: string;
        }>>`
          SELECT pg_catalog.encode(pg_catalog.int8send(version), 'hex') AS version_bytes,
                 pg_catalog.encode(pg_catalog.textsend(filename), 'hex') AS filename_bytes,
                 pg_catalog.encode(pg_catalog.textsend(checksum_sha256), 'hex') AS checksum_bytes,
                 pg_catalog.encode(pg_catalog.timestamptz_send(applied_at), 'hex') AS applied_at_bytes
            FROM public.schema_migration
           ORDER BY version
        `;
        expect(upgradedLedger).toHaveLength(56);

        const noOpLog: string[] = [];
        const noOp = await runMigrations({
          databaseUrl: targetUrl,
          migrationsDirectory: PROJECT_MIGRATIONS,
          logger: (message) => noOpLog.push(message),
        });
        expect(noOp.appliedFiles).toEqual([]);
        expect(noOp.discoveredFiles).toBe(56);
        expect(noOp.transactionBackendPids).toEqual([]);
        expect(noOpLog).toHaveLength(1);
        expect(noOpLog[0]).toContain("applied=0 status=no-op");

        const noOpLedger = await sql<Array<{
          version_bytes: string; filename_bytes: string; checksum_bytes: string; applied_at_bytes: string;
        }>>`
          SELECT pg_catalog.encode(pg_catalog.int8send(version), 'hex') AS version_bytes,
                 pg_catalog.encode(pg_catalog.textsend(filename), 'hex') AS filename_bytes,
                 pg_catalog.encode(pg_catalog.textsend(checksum_sha256), 'hex') AS checksum_bytes,
                 pg_catalog.encode(pg_catalog.timestamptz_send(applied_at), 'hex') AS applied_at_bytes
            FROM public.schema_migration
           ORDER BY version
        `;
        expect(noOpLedger).toEqual(upgradedLedger);

        const ledger = await sql<Array<{
          version: number | bigint; filename: string; checksum_sha256: string;
        }>>`
          SELECT version, filename, checksum_sha256
            FROM public.schema_migration
           WHERE version IN (44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56)
           ORDER BY version
        `;
        expect(ledger.map((row) => ({ ...row, version: Number(row.version) }))).toEqual([
          {
            version: 44,
            filename: "0044_governed_positive_tax_posting.sql",
            checksum_sha256: "5ea338b18aabb3cb2c5a4613c00ebf57806be881b956b13df1e2c95262cce55c",
          },
          {
            version: 45,
            filename: "0045_governed_positive_tax_correction.sql",
            checksum_sha256: "aec7f04eaa0536568adf68d51d7e2fa3ff578cd043b3079c080a680d6e210dba",
          },
          {
            version: 46,
            filename: "0046_positive_tax_posting_ordinal_repair.sql",
            checksum_sha256: "bd7fb83f619aabf76b7247246a096ca09275823d07cbdceeb2deec8a1e76b574",
          },
          {
            version: 47,
            filename: "0047_property_fiscal_registration.sql",
            checksum_sha256: "7e5b8a912230ebbd7cf033b4883a7138ba5ae2d9fcb007dda42b5345d1c95bf0",
          },
          {
            version: 48,
            filename: "0048_party_fiscal_registration.sql",
            checksum_sha256: "d57c5db53f75d719ef2e802a738f815cd03a54a87dbdec1f8813574666e0012f",
          },
          {
            version: 49,
            filename: "0049_property_fiscal_location.sql",
            checksum_sha256: "7efed30ed6d84b7229ec298425925c38d28c13dc570f8e03eabc35fe17c276b4",
          },
          {
            version: 50,
            filename: "0050_india_gst_item_classification.sql",
            checksum_sha256: "a3eeba9a7a4b00c580c822126b8c48d17053c9acaccbf15538cadfddb47d9433",
          },
          {
            version: 51,
            filename: "0051_india_gst_supplier_service_location.sql",
            checksum_sha256: "af457264bb976d64930022eb4686a55096248bf0b9e1f13151454b47d47b2496",
          },
          {
            version: 52,
            filename: "0052_india_gst_recipient_sez_status.sql",
            checksum_sha256: "7a318a99c4e3e40722fc97c0445b3475e7cedc10feb651b4c5049f4e3afd65da",
          },
          {
            version: 53,
            filename: "0053_india_gst_supplier_sez_status.sql",
            checksum_sha256: "e5208a1698c06db64842946876c90912c03d9aa0481ed0ceced6fa0295020c3d",
          },
          {
            version: 54,
            filename: "0054_india_sez_unit_loa_renewal.sql",
            checksum_sha256: "54a65ae32acfc5e232037129685a7c7edfb950aa66b54d4ea053c7acf11bb717",
          },
          {
            version: 55,
            filename: "0055_india_gst_supplier_registration_status.sql",
            checksum_sha256: "c0f50dc59178da55cd89ad06bcbd4ee48f36a48e154c07e41b089a7608cb1f80",
          },
          {
            version: 56,
            filename: "0056_india_gst_accommodation_service_provision_date.sql",
            checksum_sha256: "920b98c03e65e7ed968b2fe277f6f9d67185be125a68aec3123b9ad0b8f27658",
          },
        ]);

        const authority = await sql<Array<{
          signature: string; owner: string; securityDefiner: boolean;
          config: string[]; appExecute: boolean; runtimeExecute: boolean;
        }>>`
          SELECT p.oid::regprocedure::text AS signature,
                 pg_catalog.pg_get_userbyid(p.proowner) AS owner,
                 p.prosecdef AS "securityDefiner",
                 p.proconfig AS config,
                 pg_catalog.has_function_privilege('app_role', p.oid, 'EXECUTE')
                   AS "appExecute",
                 pg_catalog.has_function_privilege('yellow_runtime', p.oid, 'EXECUTE')
                   AS "runtimeExecute"
            FROM pg_catalog.pg_proc AS p
            JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public'
             AND p.proname IN (
               'create_positive_tax_correction_header',
               'record_positive_tax_correction_root'
             )
           ORDER BY signature
        `;
        expect(authority).toEqual([
          {
            signature: "create_positive_tax_correction_header(uuid,uuid,uuid,text,uuid)",
            owner: "yellow_owner", securityDefiner: true,
            config: ["search_path=pg_catalog, public, pg_temp"],
            appExecute: true, runtimeExecute: false,
          },
          {
            signature: "record_positive_tax_correction_root(uuid,uuid,uuid,uuid)",
            owner: "yellow_owner", securityDefiner: true,
            config: ["search_path=pg_catalog, public, pg_temp"],
            appExecute: true, runtimeExecute: false,
          },
        ]);

        const counts = await sql<Array<{
          tables: number; rlsTables: number; policies: number; forceRlsTables: number;
        }>>`
          SELECT
            (SELECT pg_catalog.count(*)::int FROM pg_catalog.pg_tables
              WHERE schemaname = 'public') AS tables,
            (SELECT pg_catalog.count(*)::int
               FROM pg_catalog.pg_class AS class
               JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
              WHERE namespace.nspname = 'public'
                AND class.relkind IN ('r', 'p')
                AND class.relrowsecurity) AS "rlsTables",
            (SELECT pg_catalog.count(*)::int FROM pg_catalog.pg_policies
              WHERE schemaname = 'public') AS policies,
            (SELECT pg_catalog.count(*)::int
               FROM pg_catalog.pg_class AS class
               JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
              WHERE namespace.nspname = 'public'
                AND class.relkind IN ('r', 'p')
                AND class.relforcerowsecurity) AS "forceRlsTables"
        `;
        expect(counts).toEqual([{
          tables: 108, rlsTables: 98, policies: 98, forceRlsTables: 8,
        }]);

        const registration = await sql<Array<{
          owner: string; rls: boolean; policies: number;
          appSelect: boolean; appMutation: boolean; runtimePrivileges: number;
          constraintCount: number; tenantLeadingLookup: boolean;
        }>>`
          SELECT pg_catalog.pg_get_userbyid(class.relowner) AS owner,
                 class.relrowsecurity AS rls,
                 (SELECT count(*)::int FROM pg_catalog.pg_policy
                   WHERE polrelid = class.oid AND polname = 'tenant_isolation') AS policies,
                 pg_catalog.has_table_privilege('app_role', class.oid, 'SELECT') AS "appSelect",
                 (
                   pg_catalog.has_table_privilege('app_role', class.oid, 'INSERT')
                   OR pg_catalog.has_table_privilege('app_role', class.oid, 'UPDATE')
                   OR pg_catalog.has_table_privilege('app_role', class.oid, 'DELETE')
                   OR pg_catalog.has_table_privilege('app_role', class.oid, 'TRUNCATE')
                 ) AS "appMutation",
                 (
                   SELECT count(*)::int
                     FROM unnest(ARRAY[
                       'SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'
                     ]) AS privilege
                    WHERE pg_catalog.has_table_privilege('yellow_runtime', class.oid, privilege)
                 ) AS "runtimePrivileges",
                 (SELECT count(*)::int FROM pg_catalog.pg_constraint
                   WHERE conrelid = class.oid) AS "constraintCount",
                 EXISTS (
                   SELECT 1
                     FROM pg_catalog.pg_index AS index
                     JOIN pg_catalog.pg_class AS index_class ON index_class.oid = index.indexrelid
                     JOIN pg_catalog.pg_attribute AS leading_attribute
                       ON leading_attribute.attrelid = class.oid
                      AND leading_attribute.attnum = (index.indkey::smallint[])[0]
                    WHERE index.indrelid = class.oid
                      AND index_class.relname = 'property_fiscal_registration_lookup'
                      AND leading_attribute.attname = 'tenant_id'
                 ) AS "tenantLeadingLookup"
            FROM pg_catalog.pg_class AS class
           WHERE class.oid = 'public.property_fiscal_registration'::regclass
        `;
        expect(registration).toEqual([{
          owner: "yellow_owner", rls: true, policies: 1,
          appSelect: true, appMutation: false, runtimePrivileges: 0,
          constraintCount: 18, tenantLeadingLookup: true,
        }]);

        const propertyLocation = await sql<Array<{
          owner: string; rls: boolean; forceRls: boolean; policies: number;
          appSelect: boolean; appMutation: boolean; runtimePrivileges: number;
          constraintCount: number; requiredConstraints: number;
          primaryKeyIsTenantProperty: boolean; compositePropertyForeignKey: boolean;
          tenantLeadingIndexes: number; totalIndexes: number;
        }>>`
          SELECT pg_catalog.pg_get_userbyid(class.relowner) AS owner,
                 class.relrowsecurity AS rls,
                 class.relforcerowsecurity AS "forceRls",
                 (SELECT count(*)::int FROM pg_catalog.pg_policy
                   WHERE polrelid = class.oid AND polname = 'tenant_isolation') AS policies,
                 pg_catalog.has_table_privilege('app_role', class.oid, 'SELECT') AS "appSelect",
                 (
                   pg_catalog.has_table_privilege('app_role', class.oid, 'INSERT')
                   OR pg_catalog.has_table_privilege('app_role', class.oid, 'UPDATE')
                   OR pg_catalog.has_table_privilege('app_role', class.oid, 'DELETE')
                   OR pg_catalog.has_table_privilege('app_role', class.oid, 'TRUNCATE')
                 ) AS "appMutation",
                 (
                   SELECT count(*)::int
                     FROM unnest(ARRAY[
                       'SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'
                     ]) AS privilege
                    WHERE pg_catalog.has_table_privilege('yellow_runtime', class.oid, privilege)
                 ) AS "runtimePrivileges",
                 (SELECT count(*)::int FROM pg_catalog.pg_constraint
                   WHERE conrelid = class.oid) AS "constraintCount",
                 (
                   SELECT count(*)::int FROM pg_catalog.pg_constraint
                    WHERE conrelid = class.oid
                      AND conname = ANY(ARRAY[
                        'property_fiscal_location_pk',
                        'property_fiscal_location_property_fk',
                        'property_fiscal_location_country_ck',
                        'property_fiscal_location_state_ck',
                        'property_fiscal_location_address_line1_ck',
                        'property_fiscal_location_locality_ck',
                        'property_fiscal_location_pin_ck'
                      ])
                 ) AS "requiredConstraints",
                 EXISTS (
                   SELECT 1 FROM pg_catalog.pg_constraint AS constraint_row
                    WHERE constraint_row.conrelid = class.oid
                      AND constraint_row.conname = 'property_fiscal_location_pk'
                      AND pg_catalog.pg_get_constraintdef(constraint_row.oid)
                        = 'PRIMARY KEY (tenant_id, property_node)'
                 ) AS "primaryKeyIsTenantProperty",
                 EXISTS (
                   SELECT 1 FROM pg_catalog.pg_constraint AS constraint_row
                    WHERE constraint_row.conrelid = class.oid
                      AND constraint_row.conname = 'property_fiscal_location_property_fk'
                      AND pg_catalog.pg_get_constraintdef(constraint_row.oid)
                        = 'FOREIGN KEY (tenant_id, property_node) REFERENCES org_node(tenant_id, id)'
                 ) AS "compositePropertyForeignKey",
                 (
                   SELECT count(*)::int
                     FROM pg_catalog.pg_index AS index
                     JOIN pg_catalog.pg_attribute AS leading_attribute
                       ON leading_attribute.attrelid = class.oid
                      AND leading_attribute.attnum = (index.indkey::smallint[])[0]
                    WHERE index.indrelid = class.oid
                      AND leading_attribute.attname = 'tenant_id'
                 ) AS "tenantLeadingIndexes",
                 (SELECT count(*)::int FROM pg_catalog.pg_index AS index
                   WHERE index.indrelid = class.oid) AS "totalIndexes"
            FROM pg_catalog.pg_class AS class
           WHERE class.oid = 'public.property_fiscal_location'::regclass
        `;
        expect(propertyLocation).toEqual([{
          owner: "yellow_owner", rls: true, forceRls: true, policies: 1,
          appSelect: true, appMutation: false, runtimePrivileges: 0,
          constraintCount: 7, requiredConstraints: 7,
          primaryKeyIsTenantProperty: true, compositePropertyForeignKey: true,
          tenantLeadingIndexes: 1, totalIndexes: 1,
        }]);

        const itemClassification = await sql<Array<{
          owner: string; rls: boolean; forceRls: boolean; policies: number;
          appSelect: boolean; appMutation: boolean; runtimePrivileges: number;
          constraintCount: number; requiredConstraints: number;
          identityNullsNotDistinct: boolean; compositePropertyForeignKey: boolean;
          extensionForeignKey: boolean; tenantLeadingIndexes: number; totalIndexes: number;
        }>>`
          SELECT pg_catalog.pg_get_userbyid(class.relowner) AS owner,
                 class.relrowsecurity AS rls,
                 class.relforcerowsecurity AS "forceRls",
                 (SELECT count(*)::int FROM pg_catalog.pg_policy
                   WHERE polrelid = class.oid AND polname = 'tenant_isolation') AS policies,
                 pg_catalog.has_table_privilege('app_role', class.oid, 'SELECT') AS "appSelect",
                 (
                   pg_catalog.has_table_privilege('app_role', class.oid, 'INSERT')
                   OR pg_catalog.has_table_privilege('app_role', class.oid, 'UPDATE')
                   OR pg_catalog.has_table_privilege('app_role', class.oid, 'DELETE')
                   OR pg_catalog.has_table_privilege('app_role', class.oid, 'TRUNCATE')
                 ) AS "appMutation",
                 (
                   SELECT count(*)::int
                     FROM unnest(ARRAY[
                       'SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'
                     ]) AS privilege
                    WHERE pg_catalog.has_table_privilege('yellow_runtime', class.oid, privilege)
                 ) AS "runtimePrivileges",
                 (SELECT count(*)::int FROM pg_catalog.pg_constraint
                   WHERE conrelid = class.oid) AS "constraintCount",
                 (
                   SELECT count(*)::int FROM pg_catalog.pg_constraint
                    WHERE conrelid = class.oid
                      AND conname = ANY(ARRAY[
                        'india_gst_item_classification_pk',
                        'india_gst_item_classification_identity_uq',
                        'india_gst_item_classification_property_fk',
                        'india_gst_item_classification_extension_fk',
                        'india_gst_item_classification_jurisdiction_owner_ck',
                        'india_gst_item_classification_jurisdiction_key_ck',
                        'india_gst_item_classification_jurisdiction_version_ck',
                        'india_gst_item_classification_jurisdiction_hash_ck',
                        'india_gst_item_classification_country_ck',
                        'india_gst_item_classification_line_ck',
                        'india_gst_item_classification_revenue_group_ck',
                        'india_gst_item_classification_system_ck',
                        'india_gst_item_classification_code_ck',
                        'india_gst_item_classification_service_ck'
                      ])
                 ) AS "requiredConstraints",
                 EXISTS (
                   SELECT 1
                     FROM pg_catalog.pg_index AS index
                     JOIN pg_catalog.pg_class AS index_class ON index_class.oid = index.indexrelid
                    WHERE index.indrelid = class.oid
                      AND index_class.relname = 'india_gst_item_classification_identity_uq'
                      AND index.indisunique
                      AND index.indnullsnotdistinct
                 ) AS "identityNullsNotDistinct",
                 EXISTS (
                   SELECT 1 FROM pg_catalog.pg_constraint AS constraint_row
                    WHERE constraint_row.conrelid = class.oid
                      AND constraint_row.conname = 'india_gst_item_classification_property_fk'
                      AND pg_catalog.pg_get_constraintdef(constraint_row.oid)
                        = 'FOREIGN KEY (tenant_id, property_node) REFERENCES org_node(tenant_id, id)'
                 ) AS "compositePropertyForeignKey",
                 EXISTS (
                   SELECT 1 FROM pg_catalog.pg_constraint AS constraint_row
                    WHERE constraint_row.conrelid = class.oid
                      AND constraint_row.conname = 'india_gst_item_classification_extension_fk'
                      AND pg_catalog.pg_get_constraintdef(constraint_row.oid)
                        = 'FOREIGN KEY (jurisdiction_extension_id) REFERENCES extension(id)'
                 ) AS "extensionForeignKey",
                 (
                   SELECT count(*)::int
                     FROM pg_catalog.pg_index AS index
                     JOIN pg_catalog.pg_attribute AS leading_attribute
                       ON leading_attribute.attrelid = class.oid
                      AND leading_attribute.attnum = (index.indkey::smallint[])[0]
                    WHERE index.indrelid = class.oid
                      AND leading_attribute.attname = 'tenant_id'
                 ) AS "tenantLeadingIndexes",
                 (SELECT count(*)::int FROM pg_catalog.pg_index AS index
                   WHERE index.indrelid = class.oid) AS "totalIndexes"
            FROM pg_catalog.pg_class AS class
           WHERE class.oid = 'public.india_gst_item_classification'::regclass
        `;
        expect(itemClassification).toEqual([{
          owner: "yellow_owner", rls: true, forceRls: true, policies: 1,
          appSelect: true, appMutation: false, runtimePrivileges: 0,
          constraintCount: 14, requiredConstraints: 14,
          identityNullsNotDistinct: true,
          compositePropertyForeignKey: true, extensionForeignKey: true,
          tenantLeadingIndexes: 2, totalIndexes: 2,
        }]);

        const supplierServiceLocation = await sql<Array<{
          owner: string; rls: boolean; forceRls: boolean; policies: number;
          appSelect: boolean; appMutation: boolean; runtimePrivileges: number;
          constraintCount: number; requiredConstraints: number;
          exactIdentity: boolean; compositeRegistrationForeignKey: boolean;
          tenantLeadingIndexes: number; totalIndexes: number;
        }>>`
          SELECT pg_catalog.pg_get_userbyid(class.relowner) AS owner,
                 class.relrowsecurity AS rls,
                 class.relforcerowsecurity AS "forceRls",
                 (SELECT count(*)::int FROM pg_catalog.pg_policy
                   WHERE polrelid = class.oid AND polname = 'tenant_isolation') AS policies,
                 pg_catalog.has_table_privilege('app_role', class.oid, 'SELECT') AS "appSelect",
                 (
                   pg_catalog.has_table_privilege('app_role', class.oid, 'INSERT')
                   OR pg_catalog.has_table_privilege('app_role', class.oid, 'UPDATE')
                   OR pg_catalog.has_table_privilege('app_role', class.oid, 'DELETE')
                   OR pg_catalog.has_table_privilege('app_role', class.oid, 'TRUNCATE')
                 ) AS "appMutation",
                 (
                   SELECT count(*)::int
                     FROM unnest(ARRAY[
                       'SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'
                     ]) AS privilege
                    WHERE pg_catalog.has_table_privilege('yellow_runtime', class.oid, privilege)
                 ) AS "runtimePrivileges",
                 (SELECT count(*)::int FROM pg_catalog.pg_constraint
                   WHERE conrelid = class.oid) AS "constraintCount",
                 (
                   SELECT count(*)::int FROM pg_catalog.pg_constraint
                    WHERE conrelid = class.oid
                      AND conname = ANY(ARRAY[
                        'india_gst_supplier_service_location_pk',
                        'india_gst_supplier_service_location_identity_uq',
                        'india_gst_supplier_service_location_registration_fk',
                        'india_gst_supplier_service_location_supplier_hash_ck',
                        'india_gst_supplier_service_location_scope_ck',
                        'india_gst_supplier_service_location_registered_place_ck',
                        'india_gst_supplier_service_location_basis_ck',
                        'india_gst_supplier_service_location_legal_rule_ck'
                      ])
                 ) AS "requiredConstraints",
                 EXISTS (
                   SELECT 1 FROM pg_catalog.pg_constraint AS constraint_row
                    WHERE constraint_row.conrelid = class.oid
                      AND constraint_row.conname = 'india_gst_supplier_service_location_identity_uq'
                      AND pg_catalog.pg_get_constraintdef(constraint_row.oid)
                        = 'UNIQUE (tenant_id, supplier_registration_id, supplier_evidence_hash, service_scope)'
                 ) AS "exactIdentity",
                 EXISTS (
                   SELECT 1 FROM pg_catalog.pg_constraint AS constraint_row
                    WHERE constraint_row.conrelid = class.oid
                      AND constraint_row.conname = 'india_gst_supplier_service_location_registration_fk'
                      AND pg_catalog.pg_get_constraintdef(constraint_row.oid)
                        = 'FOREIGN KEY (tenant_id, supplier_registration_id) REFERENCES property_fiscal_registration(tenant_id, id)'
                 ) AS "compositeRegistrationForeignKey",
                 (
                   SELECT count(*)::int
                     FROM pg_catalog.pg_index AS index
                     JOIN pg_catalog.pg_attribute AS leading_attribute
                       ON leading_attribute.attrelid = class.oid
                      AND leading_attribute.attnum = (index.indkey::smallint[])[0]
                    WHERE index.indrelid = class.oid
                      AND leading_attribute.attname = 'tenant_id'
                 ) AS "tenantLeadingIndexes",
                 (SELECT count(*)::int FROM pg_catalog.pg_index AS index
                   WHERE index.indrelid = class.oid) AS "totalIndexes"
            FROM pg_catalog.pg_class AS class
           WHERE class.oid = 'public.india_gst_supplier_service_location'::regclass
        `;
        expect(supplierServiceLocation).toEqual([{
          owner: "yellow_owner", rls: true, forceRls: true, policies: 1,
          appSelect: true, appMutation: false, runtimePrivileges: 0,
          constraintCount: 8, requiredConstraints: 8,
          exactIdentity: true, compositeRegistrationForeignKey: true,
          tenantLeadingIndexes: 2, totalIndexes: 2,
        }]);

        const partyRegistration = await sql<Array<{
          owner: string; rls: boolean; policies: number;
          appSelect: boolean; appMutation: boolean; runtimePrivileges: number;
          constraintCount: number; tenantLeadingIndexes: number; totalIndexes: number;
          compositePartyForeignKey: boolean;
        }>>`
          SELECT pg_catalog.pg_get_userbyid(class.relowner) AS owner,
                 class.relrowsecurity AS rls,
                 (SELECT count(*)::int FROM pg_catalog.pg_policy
                   WHERE polrelid = class.oid AND polname = 'tenant_isolation') AS policies,
                 pg_catalog.has_table_privilege('app_role', class.oid, 'SELECT') AS "appSelect",
                 (
                   pg_catalog.has_table_privilege('app_role', class.oid, 'INSERT')
                   OR pg_catalog.has_table_privilege('app_role', class.oid, 'UPDATE')
                   OR pg_catalog.has_table_privilege('app_role', class.oid, 'DELETE')
                   OR pg_catalog.has_table_privilege('app_role', class.oid, 'TRUNCATE')
                 ) AS "appMutation",
                 (
                   SELECT count(*)::int
                     FROM unnest(ARRAY[
                       'SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'
                     ]) AS privilege
                    WHERE pg_catalog.has_table_privilege('yellow_runtime', class.oid, privilege)
                 ) AS "runtimePrivileges",
                 (SELECT count(*)::int FROM pg_catalog.pg_constraint
                   WHERE conrelid = class.oid) AS "constraintCount",
                 (
                   SELECT count(*)::int
                     FROM pg_catalog.pg_index AS index
                     JOIN pg_catalog.pg_attribute AS leading_attribute
                       ON leading_attribute.attrelid = class.oid
                      AND leading_attribute.attnum = (index.indkey::smallint[])[0]
                    WHERE index.indrelid = class.oid
                      AND leading_attribute.attname = 'tenant_id'
                 ) AS "tenantLeadingIndexes",
                 (SELECT count(*)::int FROM pg_catalog.pg_index AS index
                   WHERE index.indrelid = class.oid) AS "totalIndexes",
                 EXISTS (
                   SELECT 1 FROM pg_catalog.pg_constraint AS constraint_row
                    WHERE constraint_row.conrelid = class.oid
                      AND constraint_row.conname = 'party_fiscal_registration_party_fk'
                      AND pg_catalog.pg_get_constraintdef(constraint_row.oid)
                        = 'FOREIGN KEY (tenant_id, party_id) REFERENCES party(tenant_id, id)'
                 ) AS "compositePartyForeignKey"
            FROM pg_catalog.pg_class AS class
           WHERE class.oid = 'public.party_fiscal_registration'::regclass
        `;
        expect(partyRegistration).toEqual([{
          owner: "yellow_owner", rls: true, policies: 1,
          appSelect: true, appMutation: false, runtimePrivileges: 0,
          constraintCount: 12, tenantLeadingIndexes: 3, totalIndexes: 3,
          compositePartyForeignKey: true,
        }]);
      });
    },
    60_000,
  );

  test(
    "applies the exact account-folio integrity migration and rejects tenant-crossing references",
    async () => {
      await withDatabase(async ({ databaseUrl: targetUrl, sql }) => {
        const result = await runMigrations({
          databaseUrl: targetUrl,
          migrationsDirectory: PROJECT_MIGRATIONS,
          logger: () => undefined,
        });
        expect(result.appliedFiles).toContain("0009_account_folio_integrity.sql");

        const ledger = await sql<
          { version: string | bigint; filename: string; checksum_sha256: string }[]
        >`
          SELECT version, filename, checksum_sha256
            FROM schema_migration
           WHERE version = 9
        `;
        expect(ledger.map((row) => ({ ...row, version: Number(row.version) }))).toEqual([{
          version: 9,
          filename: "0009_account_folio_integrity.sql",
          checksum_sha256: "56d3d47e2007d9106376459dc77623551f21731c5b6312e43e6ab100150205c2",
        }]);

        const tenantA = randomUUID();
        const tenantB = randomUUID();
        const propertyA = randomUUID();
        const propertyB = randomUUID();
        const partyA = randomUUID();
        const partyB = randomUUID();
        const reservationA = randomUUID();
        const reservationB = randomUUID();
        const accountA = randomUUID();
        const accountB = randomUUID();

        await sql`INSERT INTO tenant (id, slug, name) VALUES
          (${tenantA}::uuid, ${`migration-a-${tenantA}`}, 'Migration A'),
          (${tenantB}::uuid, ${`migration-b-${tenantB}`}, 'Migration B')`;
        await sql`INSERT INTO org_node (id, tenant_id, path, kind, name, timezone, currency) VALUES
          (${propertyA}::uuid, ${tenantA}::uuid, ${`migration_a_${tenantA.replaceAll("-", "")}`}::ltree, 'property', 'A', 'UTC', 'USD'),
          (${propertyB}::uuid, ${tenantB}::uuid, ${`migration_b_${tenantB.replaceAll("-", "")}`}::ltree, 'property', 'B', 'UTC', 'USD')`;
        await sql`INSERT INTO party (id, tenant_id, kind, display_name) VALUES
          (${partyA}::uuid, ${tenantA}::uuid, 'person', 'Party A'),
          (${partyB}::uuid, ${tenantB}::uuid, 'person', 'Party B')`;
        await sql`INSERT INTO reservation
          (id, tenant_id, property_node, confirmation_no, primary_party, currency)
          VALUES
          (${reservationA}::uuid, ${tenantA}::uuid, ${propertyA}::uuid, 'MIG-A', ${partyA}::uuid, 'USD'),
          (${reservationB}::uuid, ${tenantB}::uuid, ${propertyB}::uuid, 'MIG-B', ${partyB}::uuid, 'USD')`;
        await sql`INSERT INTO account
          (id, tenant_id, property_node, role, party_id, name, currency)
          VALUES
          (${accountA}::uuid, ${tenantA}::uuid, ${propertyA}::uuid, 'guest', ${partyA}::uuid, 'Guest account', 'USD'),
          (${accountB}::uuid, ${tenantB}::uuid, ${propertyB}::uuid, 'guest', ${partyB}::uuid, 'Guest account', 'USD')`;

        const expectSqlstate = async (operation: () => Promise<unknown>, state: string) => {
          try {
            await operation();
          } catch (error) {
            expect((error as { errno?: string }).errno).toBe(state);
            return;
          }
          throw new Error(`Expected SQLSTATE ${state}`);
        };

        await expectSqlstate(
          () => sql`INSERT INTO account
            (tenant_id, property_node, role, party_id, name, currency)
            VALUES (${tenantA}::uuid, ${propertyB}::uuid, 'guest', ${partyA}::uuid, 'Wrong property', 'USD')`,
          "23503",
        );
        await expectSqlstate(
          () => sql`INSERT INTO account
            (tenant_id, property_node, role, party_id, name, currency)
            VALUES (${tenantA}::uuid, ${propertyA}::uuid, 'guest', ${partyB}::uuid, 'Wrong party', 'USD')`,
          "23503",
        );
        await expectSqlstate(
          () => sql`INSERT INTO folio (tenant_id, account_id, reservation_id, folio_no, window_no)
            VALUES (${tenantA}::uuid, ${accountB}::uuid, ${reservationA}::uuid, 'MIG-XA', 1)`,
          "23503",
        );
        await expectSqlstate(
          () => sql`INSERT INTO folio (tenant_id, account_id, reservation_id, folio_no, window_no)
            VALUES (${tenantA}::uuid, ${accountA}::uuid, ${reservationB}::uuid, 'MIG-XR', 1)`,
          "23503",
        );

        await sql`INSERT INTO folio (tenant_id, account_id, reservation_id, folio_no, window_no)
          VALUES (${tenantA}::uuid, ${accountA}::uuid, ${reservationA}::uuid, 'MIG-1', 1)`;
        await expectSqlstate(
          () => sql`INSERT INTO folio (tenant_id, account_id, reservation_id, folio_no, window_no)
            VALUES (${tenantA}::uuid, ${accountA}::uuid, ${reservationA}::uuid, 'MIG-2', 1)`,
          "23505",
        );
      });
    },
    60_000,
  );

  test(
    "applies exact posting integrity, read-only routes, and authority-safe day sealing",
    async () => {
      await withDatabase(async ({ databaseUrl: targetUrl, sql }) => {
        const result = await runMigrations({
          databaseUrl: targetUrl,
          migrationsDirectory: PROJECT_MIGRATIONS,
          logger: () => undefined,
        });
        expect(result.appliedFiles).toContain("0010_financial_posting_integrity.sql");

        const ledger = await sql<
          { version: string | bigint; filename: string; checksum_sha256: string }[]
        >`SELECT version, filename, checksum_sha256 FROM schema_migration WHERE version = 10`;
        expect(ledger.map((row) => ({ ...row, version: Number(row.version) }))).toEqual([{
          version: 10,
          filename: "0010_financial_posting_integrity.sql",
          checksum_sha256: "859bdbbba98d858ac04e24f51751914c2cda10073b26c3c068ff8a27d4698ae3",
        }]);

        const tableCount = await sql<{ count: number }[]>`
          SELECT count(*)::int AS count FROM pg_tables WHERE schemaname = 'public'
        `;
        expect(tableCount).toEqual([{ count: 108 }]);

        const privileges = await sql<{
          route_rls: boolean;
          route_select: boolean;
          route_insert: boolean;
          route_update: boolean;
          route_delete: boolean;
          code_insert: boolean;
          code_update: boolean;
          code_delete: boolean;
          day_update: boolean;
          public_seal: boolean;
          app_seal: boolean;
        }[]>`
          SELECT
            (SELECT relrowsecurity FROM pg_class WHERE oid = 'tx_code_route'::regclass) AS route_rls,
            has_table_privilege('app_role', 'tx_code_route', 'SELECT') AS route_select,
            has_table_privilege('app_role', 'tx_code_route', 'INSERT') AS route_insert,
            has_table_privilege('app_role', 'tx_code_route', 'UPDATE') AS route_update,
            has_table_privilege('app_role', 'tx_code_route', 'DELETE') AS route_delete,
            has_table_privilege('app_role', 'tx_code', 'INSERT') AS code_insert,
            has_table_privilege('app_role', 'tx_code', 'UPDATE') AS code_update,
            has_table_privilege('app_role', 'tx_code', 'DELETE') AS code_delete,
            has_table_privilege('app_role', 'business_day', 'UPDATE') AS day_update,
            has_function_privilege('public', 'seal_business_day(uuid,uuid,date,uuid)', 'EXECUTE') AS public_seal,
            has_function_privilege('app_role', 'seal_business_day(uuid,uuid,date,uuid)', 'EXECUTE') AS app_seal
        `;
        expect(privileges).toEqual([{
          route_rls: true,
          route_select: true,
          route_insert: false,
          route_update: false,
          route_delete: false,
          code_insert: false,
          code_update: false,
          code_delete: false,
          day_update: false,
          public_seal: false,
          app_seal: false,
        }]);

        const tenantA = randomUUID();
        const tenantB = randomUUID();
        const propertyA = randomUUID();
        const propertyB = randomUUID();
        const guestA = randomUUID();
        const otherGuestA = randomUUID();
        const revenueA = randomUUID();
        const guestB = randomUUID();
        const folioA = randomUUID();
        const journalA = randomUUID();

        await sql`INSERT INTO tenant (id, slug, name) VALUES
          (${tenantA}::uuid, ${`posting-a-${tenantA}`}, 'Posting A'),
          (${tenantB}::uuid, ${`posting-b-${tenantB}`}, 'Posting B')`;
        await sql`INSERT INTO org_node (id, tenant_id, path, kind, name, timezone, currency) VALUES
          (${propertyA}::uuid, ${tenantA}::uuid, ${`posting_a_${tenantA.replaceAll("-", "")}`}::ltree, 'property', 'A', 'UTC', 'USD'),
          (${propertyB}::uuid, ${tenantB}::uuid, ${`posting_b_${tenantB.replaceAll("-", "")}`}::ltree, 'property', 'B', 'UTC', 'USD')`;
        await sql`INSERT INTO account (id, tenant_id, property_node, role, name, currency) VALUES
          (${guestA}::uuid, ${tenantA}::uuid, ${propertyA}::uuid, 'guest', 'Guest A', 'USD'),
          (${otherGuestA}::uuid, ${tenantA}::uuid, ${propertyA}::uuid, 'guest', 'Other guest A', 'USD'),
          (${revenueA}::uuid, ${tenantA}::uuid, ${propertyA}::uuid, 'revenue', 'Revenue A', 'USD'),
          (${guestB}::uuid, ${tenantB}::uuid, ${propertyB}::uuid, 'guest', 'Guest B', 'USD')`;
        await sql`INSERT INTO folio (id, tenant_id, account_id, folio_no)
          VALUES (${folioA}::uuid, ${tenantA}::uuid, ${guestA}::uuid, 'POST-1')`;
        await sql`INSERT INTO business_day (tenant_id, property_node, business_date) VALUES
          (${tenantA}::uuid, ${propertyA}::uuid, '2026-08-24'),
          (${tenantB}::uuid, ${propertyB}::uuid, '2026-08-24')`;
        await sql`INSERT INTO tx_code (code, name, grp, usali_line, default_dr, default_cr)
          VALUES ('MIGROOM', 'Migration room', 'revenue', 'Rooms', 'guest', 'revenue')`;
        await sql`INSERT INTO tx_code_route
          (tenant_id, property_node, currency, tx_code, credit_account_id)
          VALUES (${tenantA}::uuid, ${propertyA}::uuid, 'USD', 'MIGROOM', ${revenueA}::uuid)`;

        const expectSqlstate = async (operation: () => Promise<unknown>, state: string) => {
          try {
            await operation();
          } catch (error) {
            expect((error as { errno?: string }).errno).toBe(state);
            return;
          }
          throw new Error(`Expected SQLSTATE ${state}`);
        };

        const visibleRoutes = await sql.begin(async (tx) => {
          await tx.unsafe("SET LOCAL ROLE app_role");
          await tx`SELECT set_config('app.tenant_id', ${tenantA}, true)`;
          return tx<{ tenant_id: string; tx_code: string }[]>`
            SELECT tenant_id::text, tx_code FROM tx_code_route ORDER BY tx_code
          `;
        });
        expect(visibleRoutes).toEqual([{ tenant_id: tenantA, tx_code: "MIGROOM" }]);

        await expectSqlstate(
          () => sql.begin(async (tx) => {
            await tx.unsafe("SET LOCAL ROLE app_role");
            await tx`SELECT seal_business_day(${tenantA}::uuid, ${propertyA}::uuid, '2026-08-24', NULL)`;
          }),
          "42501",
        );
        await expectSqlstate(
          () => sql.begin(async (tx) => {
            await tx.unsafe("SET LOCAL ROLE app_role");
            await tx`SELECT set_config('app.tenant_id', ${tenantB}, true)`;
            await tx`SELECT seal_business_day(${tenantA}::uuid, ${propertyA}::uuid, '2026-08-24', NULL)`;
          }),
          "42501",
        );
        await expectSqlstate(
          () => sql`INSERT INTO journal
            (tenant_id, property_node, business_date, kind, description, currency)
            VALUES (${tenantA}::uuid, ${propertyA}::uuid, '2026-08-25', 'charge', 'Missing day', 'USD')`,
          "P0011",
        );

        await sql`INSERT INTO journal
          (id, tenant_id, property_node, business_date, kind, description, currency)
          VALUES (${journalA}::uuid, ${tenantA}::uuid, ${propertyA}::uuid, '2026-08-24', 'charge', 'Balanced', 'USD')`;
        await expectSqlstate(
          () => sql`INSERT INTO posting_line
            (tenant_id, journal_id, seq, account_id, folio_id, tx_code, amount_minor, business_date, currency)
            VALUES (${tenantB}::uuid, ${journalA}::uuid, 1, ${guestB}::uuid, NULL, 'MIGROOM', 1, '2026-08-24', 'USD')`,
          "23503",
        );
        await expectSqlstate(
          () => sql`INSERT INTO posting_line
            (tenant_id, journal_id, seq, account_id, folio_id, tx_code, amount_minor, business_date, currency)
            VALUES (${tenantA}::uuid, ${journalA}::uuid, 1, ${otherGuestA}::uuid, ${folioA}::uuid, 'MIGROOM', 1, '2026-08-24', 'USD')`,
          "23503",
        );
        await expectSqlstate(
          () => sql`INSERT INTO posting_line
            (tenant_id, journal_id, seq, account_id, folio_id, tx_code, amount_minor, business_date, currency)
            VALUES (${tenantA}::uuid, ${journalA}::uuid, 1, ${guestA}::uuid, ${folioA}::uuid, 'MIGROOM', 1, '2026-08-23', 'USD')`,
          "23503",
        );

        await sql.begin(async (tx) => {
          await tx`INSERT INTO posting_line
            (tenant_id, journal_id, seq, account_id, folio_id, tx_code, amount_minor, business_date)
            VALUES
            (${tenantA}::uuid, ${journalA}::uuid, 1, ${guestA}::uuid, ${folioA}::uuid, 'MIGROOM', 12345, '2026-08-24'),
            (${tenantA}::uuid, ${journalA}::uuid, 2, ${revenueA}::uuid, NULL, 'MIGROOM', -12345, '2026-08-24')`;
        });
        const derived = await sql<{ currencies: string[]; total: string | bigint }[]>`
          SELECT array_agg(trim(currency) ORDER BY seq) AS currencies, sum(amount_minor) AS total
            FROM posting_line WHERE journal_id = ${journalA}::uuid
        `;
        expect(derived.map((row) => ({
          currencies: row.currencies,
          total: BigInt(row.total),
        }))).toEqual([{ currencies: ["USD", "USD"], total: 0n }]);

        await expectSqlstate(
          () => sql.begin(async (tx) => {
            const id = randomUUID();
            await tx`INSERT INTO journal
              (id, tenant_id, property_node, business_date, kind, description, currency)
              VALUES (${id}::uuid, ${tenantA}::uuid, ${propertyA}::uuid, '2026-08-24', 'charge', 'Unbalanced', 'USD')`;
            await tx`INSERT INTO posting_line
              (tenant_id, journal_id, seq, account_id, tx_code, amount_minor, business_date, currency)
              VALUES (${tenantA}::uuid, ${id}::uuid, 1, ${guestA}::uuid, 'MIGROOM', 1, '2026-08-24', 'USD')`;
          }),
          "P0010",
        );

        await sql`
          SELECT seal_business_day(${tenantA}::uuid, ${propertyA}::uuid, '2026-08-24', NULL)
        `;
        await expectSqlstate(
          () => sql`INSERT INTO journal
            (tenant_id, property_node, business_date, kind, description, currency)
            VALUES (${tenantA}::uuid, ${propertyA}::uuid, '2026-08-24', 'charge', 'Late', 'USD')`,
          "P0011",
        );
        await sql`INSERT INTO journal
          (tenant_id, property_node, business_date, kind, description, currency)
          VALUES (${tenantA}::uuid, ${propertyA}::uuid, '2026-08-24', 'adjustment', 'Allowed correction path', 'USD')`;
      });
    },
    60_000,
  );

  test(
    "applies exact SECURITY DEFINER containment and least-authority ACLs",
    async () => {
      await withDatabase(async ({ databaseUrl: targetUrl, sql }) => {
        const result = await runMigrations({
          databaseUrl: targetUrl,
          migrationsDirectory: PROJECT_MIGRATIONS,
          logger: () => undefined,
        });
        expect(result.appliedFiles).toContain("0011_security_definer_containment.sql");
        expect(result.appliedFiles).toContain("0039_parking_occupancy_definer_path_repair.sql");

        const ledger = await sql<
          { version: string | bigint; filename: string; checksum_sha256: string }[]
        >`SELECT version, filename, checksum_sha256 FROM schema_migration WHERE version = 11`;
        expect(ledger.map((row) => ({ ...row, version: Number(row.version) }))).toEqual([{
          version: 11,
          filename: "0011_security_definer_containment.sql",
          checksum_sha256: "6c9af4f72fa6be5a2c0e256624620c7ee8cf61d709c3ca99a37cd126bbe57796",
        }]);

        const repairLedger = await sql<
          { version: string | bigint; filename: string; checksum_sha256: string }[]
        >`SELECT version, filename, checksum_sha256 FROM schema_migration WHERE version = 39`;
        expect(repairLedger.map((row) => ({ ...row, version: Number(row.version) }))).toEqual([{
          version: 39,
          filename: "0039_parking_occupancy_definer_path_repair.sql",
          checksum_sha256: "365ffb951f4ea5f4febac97ed7a4d86d5c342891d0d5464e8a36a73653c1b841",
        }]);

        const functions = await sql<{
          count: number;
          unsafeConfig: number;
          publicExecute: number;
          appExecute: number;
        }[]>`
          SELECT count(*)::int AS count,
                 count(*) FILTER (
                   WHERE p.proconfig <> ARRAY['search_path=pg_catalog, public, pg_temp']::text[]
                 )::int AS "unsafeConfig",
                 count(*) FILTER (WHERE EXISTS (
                   SELECT 1
                     FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) AS acl
                    WHERE acl.grantee = 0 AND acl.privilege_type = 'EXECUTE'
                 ))::int AS "publicExecute",
                 count(*) FILTER (
                   WHERE has_function_privilege('app_role', p.oid, 'EXECUTE')
                 )::int AS "appExecute"
            FROM pg_proc AS p
            JOIN pg_namespace AS n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public'
             AND p.oid IN (
               'public.record_occupancy(uuid,uuid,tstzrange,uuid,text,boolean)'::regprocedure::oid,
               'public.record_occupancy(uuid,uuid,tstzrange,uuid,text,boolean,uuid)'::regprocedure::oid,
               'public.release_occupancy(uuid,uuid)'::regprocedure::oid,
               'public.expire_holds()'::regprocedure::oid,
               'public.prune_outbox(interval)'::regprocedure::oid,
               'public.assert_day_open()'::regprocedure::oid,
               'public.seal_business_day(uuid,uuid,date,uuid)'::regprocedure::oid
             )
        `;
        expect(functions).toEqual([{
          count: 7,
          unsafeConfig: 0,
          publicExecute: 0,
          appExecute: 2,
        }]);

        try {
          await sql`SELECT public.prune_outbox(interval '-1 second')`;
          throw new Error("negative retention unexpectedly succeeded");
        } catch (error) {
          expect((error as { errno?: string }).errno).toBe("22023");
        }
      });
    },
    60_000,
  );

  test(
    "fails a mutated baseline before creating migration metadata",
    async () => {
      await withDatabase(async ({ databaseUrl: targetUrl, sql }) => {
        const mutated = new Uint8Array([...BASELINE_BYTES, 0x0a]);
        await withMigrationDirectory({}, async (directory) => {
          const error = await migrationFailure(() =>
            runMigrations({ databaseUrl: targetUrl, migrationsDirectory: directory, logger: () => undefined }),
          );
          expect(error.message).toContain("Baseline checksum mismatch");
          const rows = await sql<{ relation: string | null }[]>`
            SELECT to_regclass('public.schema_migration')::text AS relation
          `;
          expect(rows[0]?.relation).toBeNull();
        }, mutated);
      });
    },
    30_000,
  );

  test(
    "redacts database credentials while preserving an authentication SQLSTATE",
    async () => {
      const invalidUrl = new URL(requiredAdminUrl());
      invalidUrl.password = "migration-secret-that-must-not-leak";

      await withMigrationDirectory({}, async (directory) => {
        const error = await migrationFailure(() =>
          runMigrations({
            databaseUrl: invalidUrl.toString(),
            migrationsDirectory: directory,
            logger: () => undefined,
          }),
        );
        expect(error.errno).toBe("28P01");
        expect(error.message).toContain("SQLSTATE 28P01");
        expect(error.message).not.toContain(invalidUrl.toString());
        expect(error.message).not.toContain("migration-secret-that-must-not-leak");
        expect(error.message).not.toContain(decodeURIComponent(invalidUrl.username));
      });
    },
    30_000,
  );

  test(
    "rejects checksum drift after application without changing the ledger",
    async () => {
      await withDatabase(async ({ databaseUrl: targetUrl, sql }) => {
        await withMigrationDirectory(
          { "0002_probe.sql": "CREATE TABLE public.checksum_probe (id integer);\n" },
          async (directory) => {
            await runMigrations({ databaseUrl: targetUrl, migrationsDirectory: directory, logger: () => undefined });
            const before = await sql<{ checksum_sha256: string }[]>`
              SELECT checksum_sha256 FROM public.schema_migration WHERE version = 2
            `;

            await writeFile(
              resolve(directory, "0002_probe.sql"),
              "CREATE TABLE public.checksum_probe (id integer);\n-- changed\n",
            );
            const error = await migrationFailure(() =>
              runMigrations({ databaseUrl: targetUrl, migrationsDirectory: directory, logger: () => undefined }),
            );
            expect(error.message).toContain("Applied migration checksum mismatch");

            const after = await sql<{ checksum_sha256: string }[]>`
              SELECT checksum_sha256 FROM public.schema_migration WHERE version = 2
            `;
            expect(after).toEqual(before);
          },
        );
      });
    },
    60_000,
  );

  test(
    "fails closed for invalid files before touching the database",
    async () => {
      await withDatabase(async ({ databaseUrl: targetUrl, sql }) => {
        const cases: ReadonlyArray<{ files: Record<string, FileContents>; expected: string }> = [
          { files: { "0001_duplicate.sql": "SELECT 1;\n" }, expected: "Duplicate migration version" },
          { files: { "bad.sql": "SELECT 1;\n" }, expected: "Malformed migration filename" },
          { files: { "0000_zero.sql": "SELECT 1;\n" }, expected: "version 0000 is forbidden" },
          {
            files: { "0002_bom.sql": new Uint8Array([0xef, 0xbb, 0xbf, 0x53, 0x45, 0x4c, 0x45, 0x43, 0x54]) },
            expected: "forbidden UTF-8 BOM",
          },
          { files: { "0002_invalid.sql": new Uint8Array([0xc3, 0x28]) }, expected: "not valid UTF-8" },
        ];

        for (const fixture of cases) {
          await withMigrationDirectory(fixture.files, async (directory) => {
            const error = await migrationFailure(() =>
              runMigrations({ databaseUrl: targetUrl, migrationsDirectory: directory, logger: () => undefined }),
            );
            expect(error.message).toContain(fixture.expected);
          });
        }

        await withMigrationDirectory({ "source.txt": "SELECT 1;\n" }, async (directory) => {
          try {
            await symlink(resolve(directory, "source.txt"), resolve(directory, "0002_link.sql"), "file");
          } catch (error) {
            if (process.platform !== "win32" || (error as NodeJS.ErrnoException).code !== "EPERM") throw error;
            expect(error).toMatchObject({ code: "EPERM" });
            return;
          }
          const error = await migrationFailure(() =>
            runMigrations({ databaseUrl: targetUrl, migrationsDirectory: directory, logger: () => undefined }),
          );
          expect(error.message).toContain("forbidden symlink");
        });

        const rows = await sql<{ relation: string | null }[]>`
          SELECT to_regclass('public.schema_migration')::text AS relation
        `;
        expect(rows[0]?.relation).toBeNull();
      });
    },
    60_000,
  );

  test(
    "rejects filename disagreement and applied versions missing locally",
    async () => {
      await withDatabase(async ({ databaseUrl: targetUrl }) => {
        await withMigrationDirectory(
          { "0002_alpha.sql": "CREATE TABLE public.filename_probe (id integer);\n" },
          async (directory) => {
            await runMigrations({ databaseUrl: targetUrl, migrationsDirectory: directory, logger: () => undefined });
            await rename(resolve(directory, "0002_alpha.sql"), resolve(directory, "0002_beta.sql"));

            const disagreement = await migrationFailure(() =>
              runMigrations({ databaseUrl: targetUrl, migrationsDirectory: directory, logger: () => undefined }),
            );
            expect(disagreement.message).toContain("filename mismatch");

            await unlink(resolve(directory, "0002_beta.sql"));
            const missing = await migrationFailure(() =>
              runMigrations({ databaseUrl: targetUrl, migrationsDirectory: directory, logger: () => undefined }),
            );
            expect(missing.message).toContain("absent from the local directory");
          },
        );
      });
    },
    60_000,
  );

  test(
    "allows numeric gaps while preserving numeric order",
    async () => {
      await withDatabase(async ({ databaseUrl: targetUrl, sql }) => {
        await withMigrationDirectory(
          { "0003_gap.sql": "CREATE TABLE public.gap_probe (id integer);\n" },
          async (directory) => {
            const result = await runMigrations({
              databaseUrl: targetUrl,
              migrationsDirectory: directory,
              logger: () => undefined,
            });
            expect(result.appliedFiles).toEqual(["0001_init.sql", "0003_gap.sql"]);
            const rows = await sql<{ version: string | bigint }[]>`
              SELECT version FROM public.schema_migration ORDER BY version
            `;
            expect(rows.map(({ version }) => Number(version))).toEqual([1, 3]);
          },
        );
      });
    },
    60_000,
  );

  test(
    "serializes concurrent runner processes and proves connection affinity",
    async () => {
      await withDatabase(async ({ databaseUrl: targetUrl, sql }) => {
        await withMigrationDirectory(
          {
            "0002_concurrency.sql":
              "SELECT pg_sleep(0.5);\nCREATE TABLE public.concurrent_probe (id integer);\n",
          },
          async (directory) => {
            const first = spawnRunner(targetUrl, directory);
            const second = spawnRunner(targetUrl, directory);
            const [firstResult, secondResult] = await Promise.all([
              collectChild(first),
              collectChild(second),
            ]);

            expect(firstResult.exitCode).toBe(0);
            expect(secondResult.exitCode).toBe(0);
            expect(firstResult.stderr).toBe("");
            expect(secondResult.stderr).toBe("");

            const evidence = [summaryEvidence(firstResult.stdout), summaryEvidence(secondResult.stdout)];
            expect(evidence.map(({ applied }) => applied).sort()).toEqual([0, 2]);
            for (const processEvidence of evidence) {
              expect(
                processEvidence.transactionPids.every((pid) => pid === processEvidence.backendPid),
              ).toBe(true);
            }

            const appliedLines = `${firstResult.stdout}${secondResult.stdout}`.match(/migration applied:/g) ?? [];
            expect(appliedLines).toHaveLength(2);
            const rows = await sql<{ count: string | bigint }[]>`
              SELECT count(*) AS count FROM public.schema_migration
            `;
            expect(Number(rows[0]?.count)).toBe(2);
          },
        );
      });
    },
    90_000,
  );

  test(
    "rolls back transaction-incompatible SQL and preserves the database SQLSTATE",
    async () => {
      await withDatabase(async ({ databaseUrl: targetUrl, sql }) => {
        await withMigrationDirectory(
          {
            "0002_nontransactional.sql": `
              CREATE TABLE public.must_rollback (id integer);
              CREATE INDEX CONCURRENTLY must_rollback_id_idx ON public.must_rollback (id);
            `,
          },
          async (directory) => {
            const error = await migrationFailure(() =>
              runMigrations({ databaseUrl: targetUrl, migrationsDirectory: directory, logger: () => undefined }),
            );
            expect(error.errno).toBe("25001");
            expect(error.rollbackConnectionUsable).toBe(true);
            expect(error.backendPid).toBeNumber();
            expect(error.message).toContain("SQLSTATE 25001");

            const rows = await sql<{ object_exists: boolean; ledger_exists: boolean }[]>`
              SELECT to_regclass('public.must_rollback') IS NOT NULL AS object_exists,
                     EXISTS (SELECT 1 FROM public.schema_migration WHERE version = 2) AS ledger_exists
            `;
            expect(rows).toEqual([{ object_exists: false, ledger_exists: false }]);

            const child = await collectChild(spawnRunner(targetUrl, directory));
            expect(child.exitCode).toBe(1);
            expect(child.stderr.match(/migration failed:/g)).toHaveLength(1);
            expect(child.stderr).not.toContain("Unhandled");
            expect(child.stderr).toContain("SQLSTATE 25001");
          },
        );
      });
    },
    60_000,
  );

  test(
    "releases the session lock when a child runner is killed",
    async () => {
      await withDatabase(async ({ databaseUrl: targetUrl, sql }) => {
        await withMigrationDirectory(
          {
            "0002_kill.sql":
              "SELECT pg_sleep(30);\nCREATE TABLE public.after_killed_lock (id integer);\n",
          },
          async (directory) => {
            const child = spawnRunner(targetUrl, directory);
            let sleeping = false;

            try {
              for (let attempt = 0; attempt < 200; attempt += 1) {
                const rows = await sql<{ sleeping: boolean }[]>`
                  SELECT EXISTS (
                    SELECT 1
                      FROM pg_stat_activity
                     WHERE datname = current_database()
                       AND pid <> pg_backend_pid()
                       AND state = 'active'
                       AND query LIKE '%pg_sleep(30)%'
                  ) AS sleeping
                `;
                sleeping = rows[0]?.sleeping === true;
                if (sleeping) break;
                await Bun.sleep(50);
              }
              expect(sleeping).toBe(true);
            } finally {
              child.kill("SIGKILL");
              await child.exited;
            }

            await writeFile(
              resolve(directory, "0002_kill.sql"),
              "CREATE TABLE public.after_killed_lock (id integer);\n",
            );
            const result = await runMigrations({
              databaseUrl: targetUrl,
              migrationsDirectory: directory,
              logger: () => undefined,
            });
            expect(result.appliedFiles).toEqual(["0002_kill.sql"]);

            const rows = await sql<{ object_exists: boolean }[]>`
              SELECT to_regclass('public.after_killed_lock') IS NOT NULL AS object_exists
            `;
            expect(rows[0]?.object_exists).toBe(true);
          },
        );
      });
    },
    90_000,
  );

  test(
    "rejects a same-named arbitrary tracking table",
    async () => {
      await withDatabase(async ({ databaseUrl: targetUrl, sql }) => {
        await sql.unsafe("CREATE TABLE public.schema_migration (version bigint PRIMARY KEY)");
        await withMigrationDirectory({}, async (directory) => {
          const error = await migrationFailure(() =>
            runMigrations({ databaseUrl: targetUrl, migrationsDirectory: directory, logger: () => undefined }),
          );
          expect(error.message).toContain("column contract");
          const rows = await sql<{ column_count: string | bigint }[]>`
            SELECT count(*) AS column_count
              FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'schema_migration'
          `;
          expect(Number(rows[0]?.column_count)).toBe(1);

          await sql.unsafe("DROP TABLE public.schema_migration");
          await sql.unsafe(`
            CREATE TABLE public.schema_migration (
              version bigint NOT NULL,
              filename text NOT NULL,
              checksum_sha256 char(64) NOT NULL,
              applied_at timestamptz NOT NULL DEFAULT clock_timestamp()
            )
          `);
          const constraintError = await migrationFailure(() =>
            runMigrations({ databaseUrl: targetUrl, migrationsDirectory: directory, logger: () => undefined }),
          );
          expect(constraintError.message).toContain("constraint contract");
        });
      });
    },
    30_000,
  );
});
