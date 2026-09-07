import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";
import { readFileSync } from "node:fs";
import { Database } from "../src/kernel";
import { IssueIndiaNativeFiscalInvoiceCommand } from "../src/commands/issue-india-native-fiscal-invoice";
import { createNativeIssuanceFixture } from "./fixtures/india-native-fiscal-source-completion-fixture";
import { CREDIT_MIGRATION, creditSqlState } from "./fixtures/india-native-fiscal-credit-note-fixture";

// A separate explicitly admitted populated86 target; never the founder app.
// Every migration application here rolls back deliberately. Canonical runner,
// checksums and permanent promotion remain the coordinator's separate proof.
const deployUrl = process.env.YELLOW_ORDER446_UPGRADE_DEPLOY_DATABASE_URL;
const runtimeUrl = process.env.YELLOW_ORDER446_UPGRADE_RUNTIME_DATABASE_URL;
const db = deployUrl && runtimeUrl ? describe.serial : describe.skip;
if (process.env.YELLOW_REQUIRE_ORDER446_UPGRADE_DATABASE === "1" && (!deployUrl || !runtimeUrl)) {
  throw new Error("Order446 populated86 rollback proof requires its admitted pair of URLs");
}
db("Order446 populated86 transactional upgrade preservation", () => {
  let deploy: SQL;
  let runtime: Database;
  beforeAll(async () => {
    deploy = new SQL(deployUrl!, { max: 2, prepare: false });
    runtime = Database.connect(runtimeUrl!, { maxConnections: 2, prepare: false });
    const [row] = await deploy<{ version: number; absent: boolean }[]>`SELECT max(version)::int version,
      to_regclass('public.india_native_fiscal_credit_note') IS NULL absent FROM public.schema_migration`;
    expect(row).toEqual({ version: 86, absent: true });
  });
  afterAll(async () => { await runtime?.close(); await deploy?.close(); });

  test("genuine issued invoice survives DDL-tail failure with exact schema, ACLs, ledger and rows", async () => {
    const candidate = await createNativeIssuanceFixture(deploy, runtime, { label: `upgrade446-${crypto.randomUUID().slice(0, 10)}` });
    const invoice = await new IssueIndiaNativeFiscalInvoiceCommand(runtime).execute(candidate.request);
    const before = await fingerprint(deploy);
    let reachedTail = false;
    try {
      await deploy.begin(async tx => {
        await tx.unsafe(readFileSync(CREDIT_MIGRATION, "utf8"));
        const [installed] = await tx<{ installed: boolean }[]>`SELECT
          to_regprocedure('public.commit_india_native_fiscal_credit_note(uuid,uuid,uuid,uuid,text,text,uuid)') IS NOT NULL installed`;
        expect(installed?.installed).toBe(true);
        reachedTail = true;
        await tx.unsafe("DO $$ BEGIN RAISE EXCEPTION USING ERRCODE='PZ446',MESSAGE='Order446 intentional migration tail rollback'; END $$");
      });
      throw new Error("Expected migration tail failure");
    } catch (error) { expect(creditSqlState(error)).toBe("PZ446"); }
    expect(reachedTail).toBe(true);
    expect(await fingerprint(deploy)).toEqual(before);
    const replay = await new IssueIndiaNativeFiscalInvoiceCommand(runtime).execute(candidate.request);
    expect(replay.documentId).toBe(invoice.documentId);
    expect(replay.sha256).toBe(invoice.sha256);
  }, 120_000);
});

async function fingerprint(deploy: SQL) {
  const [catalogue] = await deploy<{ value: string }[]>`SELECT jsonb_build_object(
    'relations',(SELECT jsonb_agg(jsonb_build_array(c.oid,c.relname,c.relkind,c.relowner,c.relacl,c.relrowsecurity,c.relforcerowsecurity) ORDER BY c.oid)
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'),
    'functions',(SELECT jsonb_agg(jsonb_build_array(p.oid,pg_get_functiondef(p.oid),p.proacl) ORDER BY p.oid)
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f'),
    'ledger',(SELECT jsonb_agg(to_jsonb(m) ORDER BY version) FROM public.schema_migration m))::text value`;
  const tables = await deploy<{ name: string }[]>`SELECT c.relname name FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' ORDER BY c.relname`;
  const hashes: Record<string, string> = {};
  for (const { name } of tables) {
    if (!/^[a-z0-9_]+$/.test(name)) throw new Error("Unexpected public table identifier");
    const [row] = await deploy.unsafe<{ hash: string }[]>(`SELECT md5(COALESCE(string_agg(value,E'\n' ORDER BY value COLLATE "C"),'')) hash
      FROM (SELECT to_jsonb(r)::text value FROM public."${name}" r) rows`);
    if (!row) throw new Error("Missing preservation hash");
    hashes[name] = row.hash;
  }
  return { catalogue: catalogue?.value, hashes };
}
