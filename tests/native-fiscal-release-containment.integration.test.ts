import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { runMigrations } from "../scripts/migrate";

const ADMIN_URL = process.env.YELLOW_DEPLOY_DATABASE_URL;
const RUNTIME_URL = process.env.YELLOW_RUNTIME_DATABASE_URL;
const REQUIRED = process.env.YELLOW_REQUIRE_NATIVE_FISCAL_CONTAINMENT === "1";
if (REQUIRED && (!ADMIN_URL || !RUNTIME_URL)) {
  throw new Error("Order439 requires deploy and runtime PostgreSQL URLs");
}
const databaseDescribe = ADMIN_URL && RUNTIME_URL ? describe.serial : describe.skip;
const MIGRATIONS = resolve(import.meta.dir, "..", "migrations");
const SIGNATURE = "public.commit_india_native_fiscal_invoice(uuid,uuid,uuid,uuid,uuid,uuid,text,jsonb,uuid)";
let admin: SQL | undefined;

async function withDatabase(run: (url: string, sql: SQL, runtimeUrl: string) => Promise<void>) {
  const name = `yellow_containment_${crypto.randomUUID().replaceAll("-", "")}`;
  const deployUrl = new URL(ADMIN_URL!);
  const runtimeUrl = new URL(RUNTIME_URL!);
  deployUrl.pathname = runtimeUrl.pathname = `/${name}`;
  await admin!.unsafe(`CREATE DATABASE "${name}"`);
  const sql = new SQL(deployUrl.toString(), { max: 1, prepare: false });
  try {
    await run(deployUrl.toString(), sql, runtimeUrl.toString());
  } finally {
    await sql.close();
    await admin!.unsafe(`DROP DATABASE "${name}" WITH (FORCE)`);
  }
}

async function authority(sql: SQL) {
  return sql<Array<{ owner: string; publicExecute: boolean; appExecute: boolean; runtimeExecute: boolean }>>`
    SELECT pg_catalog.pg_get_userbyid(p.proowner) AS owner,
      EXISTS (
        SELECT 1 FROM pg_catalog.aclexplode(COALESCE(p.proacl, pg_catalog.acldefault('f', p.proowner))) acl
        WHERE acl.grantee = 0 AND acl.privilege_type = 'EXECUTE'
      ) AS "publicExecute",
      pg_catalog.has_function_privilege('app_role', p.oid, 'EXECUTE') AS "appExecute",
      pg_catalog.has_function_privilege('yellow_runtime', p.oid, 'EXECUTE') AS "runtimeExecute"
    FROM pg_catalog.pg_proc p WHERE p.oid = ${SIGNATURE}::regprocedure`;
}

async function withHistoricalMigrations(frontier: number, run: (directory: string) => Promise<void>) {
  const directory = await mkdtemp(join(tmpdir(), `yellow-containment-${frontier}-`));
  try {
    const names = (await readdir(MIGRATIONS)).filter(filename =>
      /^\d{4}_.+\.sql$/.test(filename) && Number(filename.slice(0, 4)) <= frontier);
    expect(names).toHaveLength(frontier);
    for (const filename of names) {
      await writeFile(join(directory, filename), await readFile(join(MIGRATIONS, filename)));
    }
    await run(directory);
  } finally { await rm(directory, { recursive: true, force: true }); }
}

async function assertContained(sql: SQL, runtimeUrl: string) {
  expect(await authority(sql)).toEqual([{
    owner: "yellow_owner", publicExecute: false, appExecute: false, runtimeExecute: false,
  }]);
  const runtime = new SQL(runtimeUrl, { max: 1 });
  try {
    for (const appRole of [false, true]) {
      const connection = await runtime.reserve();
      try {
        await connection`BEGIN`;
        if (appRole) await connection`SET LOCAL ROLE app_role`;
        let failure: unknown;
        try {
          await connection`
            SELECT * FROM public.commit_india_native_fiscal_invoice(
              NULL::uuid,NULL::uuid,NULL::uuid,NULL::uuid,NULL::uuid,NULL::uuid,
              'release-containment-proof'::text,'{}'::jsonb,NULL::uuid)`;
        } catch (error) { failure = error; }
        expect(failure).toBeDefined();
        expect((failure as { errno?: string }).errno).toBe("42501");
        expect((failure as Error).message).toContain("permission denied for function commit_india_native_fiscal_invoice");
      } finally {
        await connection`ROLLBACK`;
        connection.release();
      }
    }
  } finally { await runtime.close(); }
}

async function census(sql: SQL) {
  return sql`
    SELECT (SELECT count(*)::int FROM public.document) AS documents,
      (SELECT count(*)::int FROM public.document_series) AS series,
      (SELECT count(*)::int FROM public.journal) AS journals,
      (SELECT count(*)::int FROM public.posting_line) AS postings,
      (SELECT count(*)::int FROM public.fact_log) AS facts,
      (SELECT count(*)::int FROM public.outbox) AS events,
      (SELECT count(*)::int FROM pg_catalog.pg_tables WHERE schemaname = 'public') AS tables`;
}

databaseDescribe("Order439 released native fiscal authority is contained", () => {
  beforeAll(() => { admin = new SQL(ADMIN_URL!, { max: 1, prepare: false }); });
  afterAll(async () => { await admin?.close(); });

  test("fresh75 denies both runtime identities before the rejected function body", async () => {
    await withHistoricalMigrations(75, async historical => withDatabase(async (url, sql, runtimeUrl) => {
      const migration = await runMigrations({ databaseUrl: url, migrationsDirectory: historical, logger: () => undefined });
      expect(migration.appliedFiles).toHaveLength(75);
      const before = await census(sql);
      expect(before[0]?.tables).toBe(125);
      await assertContained(sql, runtimeUrl);
      expect(await census(sql)).toEqual(before);
    }));
  }, 120_000);

  test("74→75 revokes authority without changing prior ledger or business rows; replay is a no-op", async () => {
    await withHistoricalMigrations(74, async historical => {
      await withDatabase(async (url, sql, runtimeUrl) => {
        const predecessor = await runMigrations({ databaseUrl: url, migrationsDirectory: historical, logger: () => undefined });
        expect(predecessor.appliedFiles).toHaveLength(74);
        expect((await authority(sql))[0]?.appExecute).toBe(true);
        const priorLedger = await sql`SELECT row_to_json(m)::text AS row FROM public.schema_migration m ORDER BY version`;
        const before = await census(sql);
        const containmentFile = "0075_contain_unapproved_native_fiscal_issuance.sql";
        await writeFile(join(historical, containmentFile), await readFile(join(MIGRATIONS, containmentFile)));
        const upgrade = await runMigrations({ databaseUrl: url, migrationsDirectory: historical, logger: () => undefined });
        expect(upgrade.appliedFiles).toEqual(["0075_contain_unapproved_native_fiscal_issuance.sql"]);
        expect(await sql`SELECT row_to_json(m)::text AS row FROM public.schema_migration m WHERE version <= 74 ORDER BY version`).toEqual(priorLedger);
        await assertContained(sql, runtimeUrl);
        expect(await census(sql)).toEqual(before);
        const upgradedLedger = await sql`SELECT row_to_json(m)::text AS row FROM public.schema_migration m ORDER BY version`;
        expect(upgradedLedger).toHaveLength(75);
        const noOp = await runMigrations({ databaseUrl: url, migrationsDirectory: historical, logger: () => undefined });
        expect(noOp.appliedFiles).toEqual([]);
        expect(noOp.discoveredFiles).toBe(75);
        expect(await sql`SELECT row_to_json(m)::text AS row FROM public.schema_migration m ORDER BY version`).toEqual(upgradedLedger);
      });
    });
  }, 120_000);

  test("fresh79 retains legacy denial under both runtime identities without business side effects", async () => {
    await withDatabase(async (url, sql, runtimeUrl) => {
      const migration = await runMigrations({ databaseUrl: url, logger: () => undefined });
      expect(migration.appliedFiles).toHaveLength(79);
      const before = await census(sql);
      expect(before[0]?.tables).toBe(128);
      await assertContained(sql, runtimeUrl);
      expect(await census(sql)).toEqual(before);
    });
  }, 120_000);
});
