import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";
import { readFileSync } from "node:fs";
import { copyFile, mkdir, mkdtemp, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runMigrations } from "../scripts/migrate";
import { Database } from "../src/kernel";
import { projectIssuedIndiaIrpWireCandidate } from "../src/contexts/tax-fiscal/india-irp-issued-wire-candidate";
import { creditSqlState } from "./fixtures/india-native-fiscal-credit-note-fixture";
import { assertCreditSubmissionTargets, createCreditSubmissionScenario, creditSubmissionMigration,
  ownerCreditProjection, parseCreditSubmissionTargetMode } from "./fixtures/india-native-credit-submission-fixture";

const deployUrl = process.env.YELLOW_ORDER447_UPGRADE_DEPLOY_DATABASE_URL;
const runtimeUrl = process.env.YELLOW_ORDER447_UPGRADE_RUNTIME_DATABASE_URL;
const required = process.env.YELLOW_REQUIRE_ORDER447_UPGRADE_DATABASE === "1";
if (required && (!deployUrl || !runtimeUrl)) throw new Error("Required Order447 populated87 rollback needs admitted credentials");
const targetMode = required || deployUrl || runtimeUrl
  ? parseCreditSubmissionTargetMode(process.env.YELLOW_ORDER447_TARGET_MODE) : undefined;
if (deployUrl || runtimeUrl) {
  if (!deployUrl || !runtimeUrl) throw new Error("Order447 upgrade proof requires paired deploy/runtime credentials");
  assertCreditSubmissionTargets(deployUrl, runtimeUrl, "rollback", targetMode!,
    process.env.YELLOW_REQUIRE_ORDER447_CI_CANONICAL === "1", process.env.YELLOW_ORDER447_CI_DATABASE_ADDRESS);
}
const db = required ? describe.serial : describe.skip;

db("Order447 populated87 whole-draft atomic rollback", () => {
  let deploy: SQL; let runtime: Database;
  beforeAll(async () => {
    deploy = new SQL(deployUrl!, { max: 2, prepare: false });
    runtime = Database.connect(runtimeUrl!, { maxConnections: 2, prepare: false });
    const [row] = await deploy<{ version: number; absent: boolean }[]>`SELECT max(version)::int version,
      position('Order447 authenticated full-credit branch' in pg_get_functiondef('public.india_fiscal_submission_project_wire(uuid,uuid,uuid)'::regprocedure))=0 absent
      FROM public.schema_migration`;
    expect(row).toEqual({ version: 87, absent: true });
  });
  afterAll(async () => { await runtime?.close(); await deploy?.close(); });

  test("genuine invoice and full credit survive exact DDL tail failure with unchanged rows, ledger, functions and ACLs", async () => {
    const scenario = await createCreditSubmissionScenario(deploy, runtime);
    const originalBefore = await ownerCreditProjection(deploy, scenario.tenantId, scenario.propertyNode, scenario.candidate.invoice.documentId);
    let deniedBefore: string | undefined;
    try { await ownerCreditProjection(deploy, scenario.tenantId, scenario.propertyNode, scenario.documentId); }
    catch (error) { deniedBefore = creditSqlState(error); }
    expect(deniedBefore).toBe("55000");
    const before = await fingerprint(deploy);
    let reachedTail = false;
    try {
      await deploy.begin(async tx => {
        await tx.unsafe(readFileSync(creditSubmissionMigration(targetMode!), "utf8"));
        await tx`SELECT set_config('app.tenant_id',${scenario.tenantId},true)`;
        const [after] = await tx<{ original: unknown; credit: { wireText: string; wireSha256: string }; content: string; hash: string }[]>`
          SELECT public.india_fiscal_submission_project_wire(${scenario.tenantId}::uuid,${scenario.propertyNode}::uuid,${scenario.candidate.invoice.documentId}::uuid) original,
            public.india_fiscal_submission_project_wire(${scenario.tenantId}::uuid,${scenario.propertyNode}::uuid,${scenario.documentId}::uuid) credit,
            d.content::text content,d.sha256 hash FROM public.document d
            WHERE d.tenant_id=${scenario.tenantId}::uuid AND d.id=${scenario.documentId}::uuid`;
        expect(after?.original).toEqual(originalBefore);
        const typed = projectIssuedIndiaIrpWireCandidate({ documentId: scenario.documentId, documentSha256: after!.hash, contentJson: after!.content });
        expect(typed.ok).toBe(true); if (!typed.ok) throw new Error(typed.error.code);
        expect(after?.credit.wireText).toBe(typed.value.wireJson);
        expect(after?.credit.wireSha256).toBe(typed.value.wireSha256);
        reachedTail = true;
        await tx.unsafe("DO $$ BEGIN RAISE EXCEPTION USING ERRCODE='PZ447',MESSAGE='Order447 deliberate whole-draft tail rollback'; END $$");
      });
      throw new Error("Expected deliberate migration tail fault");
    } catch (error) { expect(creditSqlState(error)).toBe("PZ447"); }
    expect(reachedTail).toBe(true);
    expect(await fingerprint(deploy)).toEqual(before);
    expect(await ownerCreditProjection(deploy, scenario.tenantId, scenario.propertyNode, scenario.candidate.invoice.documentId)).toEqual(originalBefore);
    await expect(ownerCreditProjection(deploy, scenario.tenantId, scenario.propertyNode, scenario.documentId)).rejects.toBeDefined();

    // Second proof uses the UNMODIFIED production runner and all exact canonical
    // predecessor bytes, not an invented ledger or transaction wrapper. The
    // private last-file tail verifies both wires before deliberately failing.
    const evidence = fileURLToPath(new URL("../.yellow/evidence/order447/", import.meta.url));
    await mkdir(evidence, { recursive: true });
    const directory = await mkdtemp(join(evidence, "rollback-prefix87-"));
    const canonical = new URL("../migrations/", import.meta.url);
    const files = (await readdir(canonical)).filter(name => /^\d{4}_[a-z0-9_-]+\.sql$/.test(name) && Number(name.slice(0, 4)) <= 87).sort();
    expect(files.map(name => Number(name.slice(0, 4)))).toEqual(Array.from({ length: 87 }, (_, index) => index + 1));
    await Promise.all(files.map(name => copyFile(new URL(name, canonical), join(directory, name))));
    const [source] = await deploy<{ content: string; hash: string }[]>`SELECT content::text content,sha256 hash FROM public.document
      WHERE tenant_id=${scenario.tenantId}::uuid AND id=${scenario.documentId}::uuid`;
    const typed = projectIssuedIndiaIrpWireCandidate({ documentId: scenario.documentId, documentSha256: source!.hash, contentJson: source!.content });
    expect(typed.ok).toBe(true); if (!typed.ok) throw new Error(typed.error.code);
    const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;
    const tail = `\nDO $order447_runner_tail$ BEGIN
      PERFORM set_config('app.tenant_id',${literal(scenario.tenantId)},true);
      IF public.india_fiscal_submission_project_wire(${literal(scenario.tenantId)}::uuid,${literal(scenario.propertyNode)}::uuid,${literal(scenario.candidate.invoice.documentId)}::uuid)->>'wireSha256'
          IS DISTINCT FROM ${literal(originalBefore.wireSha256)} OR
        public.india_fiscal_submission_project_wire(${literal(scenario.tenantId)}::uuid,${literal(scenario.propertyNode)}::uuid,${literal(scenario.documentId)}::uuid)->>'wireSha256'
          IS DISTINCT FROM ${literal(typed.value.wireSha256)} THEN
        RAISE EXCEPTION USING ERRCODE='P447V',MESSAGE='Order447 runner-tail wire verification failed'; END IF;
      RAISE EXCEPTION USING ERRCODE='PZ447',MESSAGE='Order447 production runner deliberate tail rollback';
      END $order447_runner_tail$;\n`;
    await writeFile(join(directory, "0088_native_credit_fiscal_submission.sql"),
      readFileSync(creditSubmissionMigration(targetMode!), "utf8") + tail, { flag: "wx" });
    let runnerState: string | undefined; let rollbackUsable: unknown;
    try { await runMigrations({ databaseUrl: deployUrl!, migrationsDirectory: directory, logger: () => {} }); }
    catch (error) { runnerState = creditSqlState(error); rollbackUsable = (error as { rollbackConnectionUsable?: unknown }).rollbackConnectionUsable; }
    expect(runnerState).toBe("PZ447"); expect(rollbackUsable).toBe(true);
    expect(await fingerprint(deploy)).toEqual(before);
    await writeFile(join(directory, "rollback-result.json"), JSON.stringify({ state: runnerState, rollbackUsable, oldFrontier: 87, preserved: true }), { flag: "wx" });
  }, 120_000);
});

async function fingerprint(deploy: SQL) {
  const [catalogue] = await deploy<{ value: string }[]>`SELECT jsonb_build_object(
    'relations',(SELECT jsonb_agg(jsonb_build_array(c.oid,c.relname,c.relkind,c.relowner,c.relacl,c.relrowsecurity,c.relforcerowsecurity) ORDER BY c.oid)
      FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'),
    'functions',(SELECT jsonb_agg(jsonb_build_array(p.oid,pg_get_functiondef(p.oid),p.proacl,p.proowner,p.proconfig) ORDER BY p.oid)
      FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f'),
    'constraints',(SELECT jsonb_agg(to_jsonb(c) ORDER BY c.oid) FROM pg_catalog.pg_constraint c WHERE c.connamespace='public'::regnamespace),
    'triggers',(SELECT jsonb_agg(to_jsonb(t) ORDER BY t.oid) FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='public'::regnamespace),
    'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_catalog.pg_policy p JOIN pg_catalog.pg_class c ON c.oid=p.polrelid WHERE c.relnamespace='public'::regnamespace),
    'ledger',(SELECT jsonb_agg(to_jsonb(m) ORDER BY version) FROM public.schema_migration m))::text value`;
  const tables = await deploy<{ name: string }[]>`SELECT c.relname name FROM pg_catalog.pg_class c
    WHERE c.relnamespace='public'::regnamespace AND c.relkind='r' ORDER BY c.relname`;
  const rows: Record<string, string> = {};
  for (const { name } of tables) {
    if (!/^[a-z0-9_]+$/.test(name)) throw new Error("Unexpected public table identifier");
    const [row] = await deploy.unsafe<{ hash: string }[]>(`SELECT md5(COALESCE(string_agg(value,E'\\n' ORDER BY value COLLATE "C"),'')) hash
      FROM (SELECT to_jsonb(r)::text value FROM public."${name}" r) contents`);
    if (!row) throw new Error("Missing preservation fingerprint"); rows[name] = row.hash;
  }
  return { catalogue: catalogue?.value, rows };
}
