import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import {
  mkdtemp,
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
const BASELINE_PATH = resolve(PROJECT_ROOT, "migrations", "0001_init.sql");
const BASELINE_BYTES = await readFile(BASELINE_PATH);
const BASELINE_SHA256 = "fe2a9fc949c6bacded3f8d3fc4d14fc596a83ebde9aeb043eb10845f07b30923";
const ADMIN_URL = process.env.YELLOW_MIGRATION_TEST_ADMIN_URL;
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
      DATABASE_URL: targetUrl,
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
  test("requires DATABASE_URL instead of silently selecting a database", async () => {
    const env = { ...process.env };
    delete env.DATABASE_URL;
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
    expect(result.stderr.trim()).toBe("DATABASE_URL is required");
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
          await symlink(resolve(directory, "source.txt"), resolve(directory, "0002_link.sql"), "file");
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
