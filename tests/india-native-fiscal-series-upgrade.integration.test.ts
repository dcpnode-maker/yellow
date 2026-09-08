import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";
import { readFileSync } from "node:fs";
import { copyFile, mkdir, mkdtemp, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Database } from "../src/kernel";
import { IssueIndiaNativeFiscalInvoiceCommand } from "../src/commands/issue-india-native-fiscal-invoice";
import { runMigrations } from "../scripts/migrate";
import { assertSeriesTargets, configureSeries, createSeriesFixture, parseSeriesMode, SERIES_SIGNATURE,
  seriesCatalogue, seriesMigration, seriesRows, seriesSqlState } from "./fixtures/india-native-fiscal-series-fixture";

const deployUrl = process.env.YELLOW_ORDER453_UPGRADE_DEPLOY_DATABASE_URL;
const runtimeUrl = process.env.YELLOW_ORDER453_UPGRADE_RUNTIME_DATABASE_URL;
const required = process.env.YELLOW_REQUIRE_ORDER453_UPGRADE_DATABASE === "1";
const canonical = process.env.YELLOW_REQUIRE_ORDER453_CANONICAL_UPGRADE === "1";
const mode = required || canonical || deployUrl || runtimeUrl ? parseSeriesMode(process.env.YELLOW_ORDER453_TARGET_MODE) : undefined;
if (required || canonical || deployUrl || runtimeUrl) {
  if (!required || !deployUrl || !runtimeUrl) throw new Error("Order453 upgrade requires mandatory paired target admission");
  assertSeriesTargets(deployUrl, runtimeUrl, "upgrade", mode!, process.env.YELLOW_REQUIRE_ORDER453_CI_CANONICAL === "1",
    process.env.YELLOW_ORDER453_CI_DATABASE_ADDRESS, process.env.YELLOW_ORDER453_NATIVE_EXECUTE_AFTER_HANDOFF === "1");
  if (canonical && mode !== "ci-canonical") throw new Error("Order453 native canonical upgrade requires separate admission");
}

describe("Order453 predecessor source binding", () => {
  test("draft pins canonical89 and the actual unchanged series, authority and discovery bodies", () => {
    const draft = readFileSync(seriesMigration("native-draft"), "utf8");
    for (const [name, file] of [
      ["create_india_native_fiscal_series", "0074_india_native_fiscal_invoice_authority.sql"],
      ["assert_india_native_credit_authority", "0087_india_native_fiscal_credit_note.sql"],
      ["read_india_native_credit_delivery_by_document", "0089_native_credit_delivery_discovery.sql"],
    ]) {
      // Historical executable bodies stay historical when expected.sql advances90.
      const schema = readFileSync(new URL(`../migrations/${file}`, import.meta.url), "utf8");
      const match = new RegExp(`CREATE FUNCTION public\\.${name}\\([\\s\\S]*?AS (\\$[a-zA-Z0-9_]*\\$)([\\s\\S]*?)\\1;`).exec(schema);
      expect(match).not.toBeNull();
      const hash = new Bun.CryptoHasher("sha256").update(match![2]!.replaceAll("\r\n", "\n")).digest("hex");
      expect(draft).toContain(hash);
    }
    expect(draft).toContain(new Bun.CryptoHasher("sha256").update(readFileSync(new URL("../migrations/0089_native_credit_delivery_discovery.sql", import.meta.url))).digest("hex"));
  });
});

(required ? describe.serial : describe.skip)("Order453 populated canonical89 upgrade", () => {
  let deploy: SQL; let runtime: Database;
  beforeAll(async () => {
    deploy = new SQL(deployUrl!, { max: 2, prepare: false });
    runtime = Database.connect(runtimeUrl!, { maxConnections: 2, prepare: false });
    const [row] = await deploy<{ version: number; body: string }[]>`SELECT max(version)::int version,
      (SELECT prosrc FROM pg_catalog.pg_proc WHERE oid=${SERIES_SIGNATURE}::regprocedure) body FROM public.schema_migration`;
    expect(row?.version).toBe(89); expect(row?.body).not.toContain("'document.series.configured'");
  });
  afterAll(async () => { await runtime?.close(); await deploy?.close(); });

  test("prototype predecessor exposes the missing foreign-role and active-tenant checks without committed configuration", async () => {
    const a = await createSeriesFixture(deploy, runtime); const b = await createSeriesFixture(deploy, runtime);
    const baseline = { rows: await seriesRows(deploy), catalogue: await seriesCatalogue(deploy) };
    const rollbackCreate = async () => {
      let seen = false;
      try { await runtime.withTenantTransaction(a.input.tenant, async tx => {
        expect((await configureSeries(tx, a.input)).created).toBe(true); seen = true;
        throw new Error("Order453 predecessor prototype rollback");
      }); } catch (error) { expect(error instanceof Error && error.message).toBe("Order453 predecessor prototype rollback"); }
      expect(seen).toBe(true);
    };
    try {
      await deploy`DELETE FROM public.role_permission WHERE role_id=${a.roleId}::uuid AND permission_code='tax-fiscal.series:configure'`;
      await deploy`INSERT INTO public.user_role(tenant_id,user_id,role_id,scope_node)
        VALUES(${a.input.tenant}::uuid,${a.input.actor}::uuid,${b.roleId}::uuid,${a.input.property}::uuid)`;
      const hostile = await seriesRows(deploy); await rollbackCreate(); expect(await seriesRows(deploy)).toEqual(hostile);
    } finally {
      await deploy`DELETE FROM public.user_role WHERE tenant_id=${a.input.tenant}::uuid AND user_id=${a.input.actor}::uuid AND role_id=${b.roleId}::uuid AND scope_node=${a.input.property}::uuid`;
      await deploy`INSERT INTO public.role_permission(role_id,permission_code) VALUES(${a.roleId}::uuid,'tax-fiscal.series:configure')`;
    }
    try {
      await deploy`UPDATE public.tenant SET status='inactive' WHERE id=${a.input.tenant}::uuid`;
      const hostile = await seriesRows(deploy); await rollbackCreate(); expect(await seriesRows(deploy)).toEqual(hostile);
    } finally { await deploy`UPDATE public.tenant SET status='active' WHERE id=${a.input.tenant}::uuid`; }
    expect({ rows: await seriesRows(deploy), catalogue: await seriesCatalogue(deploy) }).toEqual(baseline);
  }, 120_000);

  test("altered executable predecessor body/default/ACL cannot be adopted by the migration", async () => {
    const original = { rows: await seriesRows(deploy), catalogue: await seriesCatalogue(deploy) };
    for (const drift of ["authority_body", "series_body", "delivery_body", "default", "acl"] as const) {
      let state: string | undefined;
      try { await deploy.begin(async tx => {
        if (drift === "acl") await tx.unsafe(`GRANT EXECUTE ON FUNCTION ${SERIES_SIGNATURE} TO yellow_runtime`);
        else {
          const signature = drift === "series_body" ? SERIES_SIGNATURE : drift === "delivery_body"
            ? "public.read_india_native_credit_delivery_by_document(uuid,uuid,uuid,uuid)"
            : "public.assert_india_native_credit_authority(uuid,uuid,uuid,text[],boolean)";
          const [row] = await tx<{ definition: string }[]>`SELECT pg_get_functiondef(${signature}::regprocedure) definition`;
          const changed = drift === "default" ? row!.definition.replace("DEFAULT false", "DEFAULT true")
            : row!.definition.replace("DECLARE", "-- Order453 deliberate pinned body fault\nDECLARE");
          expect(changed).not.toBe(row!.definition); await tx.unsafe(changed);
        }
        await tx.unsafe(readFileSync(seriesMigration(mode!), "utf8"));
        throw new Error("Order453 predecessor drift unexpectedly accepted");
      }); } catch (error) { state = seriesSqlState(error); }
      expect(state).toBe("55000");
      expect({ rows: await seriesRows(deploy), catalogue: await seriesCatalogue(deploy) }).toEqual(original);
    }
  }, 120_000);

  test("production-runner PZ453 tail rolls back replacement and ledger over genuine issued history", async () => {
    const { candidate } = await createSeriesFixture(deploy, runtime);
    await new IssueIndiaNativeFiscalInvoiceCommand(runtime).execute(candidate.request);
    const original = { rows: await seriesRows(deploy), catalogue: await seriesCatalogue(deploy) };
    const directory = await prefixDirectory();
    await writeFile(join(directory, "0090_india_native_fiscal_series_configuration.sql"), readFileSync(seriesMigration(mode!), "utf8") + `
DO $order453_tail$ BEGIN
  IF position('document.series.configured' in (SELECT prosrc FROM pg_catalog.pg_proc
    WHERE oid='${SERIES_SIGNATURE}'::regprocedure))=0 THEN
    RAISE EXCEPTION USING ERRCODE='P453V',MESSAGE='Order453 replacement missing'; END IF;
  RAISE EXCEPTION USING ERRCODE='PZ453',MESSAGE='Order453 deliberate migration rollback';
END $order453_tail$;
`, { flag: "wx" });
    let state: string | undefined; let usable: unknown;
    try { await runMigrations({ databaseUrl: deployUrl!, migrationsDirectory: directory, logger: () => {} }); }
    catch (error) { state = seriesSqlState(error); usable = (error as { rollbackConnectionUsable?: unknown }).rollbackConnectionUsable; }
    expect(state).toBe("PZ453"); expect(usable).toBe(true);
    expect({ rows: await seriesRows(deploy), catalogue: await seriesCatalogue(deploy) }).toEqual(original);
  }, 120_000);

  (canonical ? test : test.skip)("canonical89 to90 preserves all history, never backfills replay, and is an exact no-op", async () => {
    const { input, candidate } = await createSeriesFixture(deploy, runtime);
    await new IssueIndiaNativeFiscalInvoiceCommand(runtime).execute(candidate.request);
    const before = await seriesRows(deploy);
    const [oldEvents] = await deploy<{ count: number }[]>`SELECT count(*)::int count FROM public.outbox
      WHERE tenant_id=${input.tenant}::uuid AND aggregate_id=${candidate.series.seriesId}::uuid AND event_type='document.series.configured'`;
    expect(oldEvents?.count).toBe(0);
    const directory = await prefixDirectory();
    await copyFile(seriesMigration("ci-canonical"), join(directory, "0090_india_native_fiscal_series_configuration.sql"));
    await runMigrations({ databaseUrl: deployUrl!, migrationsDirectory: directory, logger: () => {} });
    const after = await seriesRows(deploy);
    for (const name of Object.keys(before)) if (name !== "schema_migration") expect(after[name]).toEqual(before[name]);
    expect(after.schema_migration?.filter(value => JSON.parse(value).version <= 89)).toEqual(before.schema_migration);
    const [ledger] = await deploy<{ version: number; filename: string; checksum: string }[]>`SELECT version::int version,filename,btrim(checksum_sha256) checksum
      FROM public.schema_migration WHERE version=90`;
    expect(ledger).toEqual({ version: 90, filename: "0090_india_native_fiscal_series_configuration.sql",
      checksum: new Bun.CryptoHasher("sha256").update(readFileSync(seriesMigration("ci-canonical"))).digest("hex") });
    const replay = await runtime.withTenantTransaction(input.tenant, tx => configureSeries(tx, { ...input, kind: "invoice", prefix: "INV/" }));
    expect(replay).toMatchObject({ created: false, next_no: "2", series_id: candidate.series.seriesId });
    expect(await seriesRows(deploy)).toEqual(after);
    const stable = { rows: after, catalogue: await seriesCatalogue(deploy) };
    await runMigrations({ databaseUrl: deployUrl!, migrationsDirectory: directory, logger: () => {} });
    expect({ rows: await seriesRows(deploy), catalogue: await seriesCatalogue(deploy) }).toEqual(stable);
  }, 120_000);
});

async function prefixDirectory(): Promise<string> {
  const root = fileURLToPath(new URL("../.yellow/evidence/order453/", import.meta.url));
  await mkdir(root, { recursive: true });
  const directory = await mkdtemp(join(root, "production-prefix89-"));
  const canonical = new URL("../migrations/", import.meta.url);
  const files = (await readdir(canonical)).filter(name => /^\d{4}_[a-z0-9_-]+\.sql$/.test(name) && Number(name.slice(0, 4)) <= 89).sort();
  expect(files.map(name => Number(name.slice(0, 4)))).toEqual(Array.from({ length: 89 }, (_, i) => i + 1));
  await Promise.all(files.map(name => copyFile(new URL(name, canonical), join(directory, name))));
  return directory;
}
