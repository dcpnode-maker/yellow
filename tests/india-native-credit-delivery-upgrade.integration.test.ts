import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";
import { readFileSync } from "node:fs";
import { copyFile, mkdir, mkdtemp, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runMigrations } from "../scripts/migrate";
import { Database } from "../src/kernel";
import { creditSqlState } from "./fixtures/india-native-fiscal-credit-note-fixture";
import { assertCreditDeliveryTargets, createCreditDeliveryScenario, creditDeliveryCatalogue, creditDeliveryMigration,
  creditDeliveryRows, parseCreditDeliveryTargetMode, readCreditDelivery } from "./fixtures/india-native-credit-delivery-fixture";

const deployUrl = process.env.YELLOW_ORDER452_UPGRADE_DEPLOY_DATABASE_URL;
const runtimeUrl = process.env.YELLOW_ORDER452_UPGRADE_RUNTIME_DATABASE_URL;
const required = process.env.YELLOW_REQUIRE_ORDER452_UPGRADE_DATABASE === "1";
const applyCanonical = process.env.YELLOW_REQUIRE_ORDER452_CANONICAL_UPGRADE === "1";
const mode = required || applyCanonical || deployUrl || runtimeUrl
  ? parseCreditDeliveryTargetMode(process.env.YELLOW_ORDER452_TARGET_MODE) : undefined;
if (required || applyCanonical || deployUrl || runtimeUrl) {
  if (!deployUrl || !runtimeUrl || !required) throw new Error("Order452 upgrade needs explicit mandatory paired target admission");
  assertCreditDeliveryTargets(deployUrl, runtimeUrl, "rollback", mode!, process.env.YELLOW_REQUIRE_ORDER452_CI_CANONICAL === "1",
    process.env.YELLOW_ORDER452_CI_DATABASE_ADDRESS, process.env.YELLOW_ORDER452_NATIVE_EXECUTION_ADMITTED === "1");
  if (applyCanonical && mode !== "ci-canonical") throw new Error("Native canonical upgrade needs its separate later promotion admission");
}

describe("Order452 exact executable predecessor pins", () => {
  test("precondition hashes match canonical receipt and authority bodies, not a label", () => {
    const schema = readFileSync(new URL("./schema/expected.sql", import.meta.url), "utf8");
    const draft = readFileSync(creditDeliveryMigration("native-draft"), "utf8");
    for (const name of ["assert_india_native_credit_authority", "read_india_fiscal_submission_delivery_receipt"]) {
      const match = new RegExp(`CREATE FUNCTION public\\.${name}\\([\\s\\S]*?AS \\$\\$([\\s\\S]*?)\\$\\$;`).exec(schema);
      expect(match).not.toBeNull();
      const hash = new Bun.CryptoHasher("sha256").update(match![1]!.replaceAll("\r\n", "\n")).digest("hex");
      expect(draft).toContain(hash);
    }
    const canonical = readFileSync(new URL("../migrations/0088_native_credit_fiscal_submission.sql", import.meta.url));
    expect(draft).toContain(new Bun.CryptoHasher("sha256").update(canonical).digest("hex"));
    expect(draft).toContain("pg_catalog.pg_get_expr(p.proargdefaults,0) IS DISTINCT FROM 'false'");
  });
});

(required ? describe.serial : describe.skip)("Order452 populated canonical88 migration proof", () => {
  let deploy: SQL; let runtime: Database;
  beforeAll(async () => {
    deploy = new SQL(deployUrl!, { max: 2, prepare: false });
    runtime = Database.connect(runtimeUrl!, { maxConnections: 2, prepare: false });
    const [row] = await deploy<{ version: number; absent: boolean }[]>`SELECT max(version)::int version,
      to_regprocedure('public.read_india_native_credit_delivery_by_document(uuid,uuid,uuid,uuid)') IS NULL absent FROM public.schema_migration`;
    expect(row).toEqual({ version: 88, absent: true });
  });
  afterAll(async () => { await runtime?.close(); await deploy?.close(); });

  test("altered predecessor body and default are rejected atomically before the new capability exists", async () => {
    const before = { rows: await creditDeliveryRows(deploy), catalogue: await creditDeliveryCatalogue(deploy) };
    for (const drift of ["body", "default"] as const) {
      let state: string | undefined;
      try {
        await deploy.begin(async tx => {
          const [row] = await tx<{ definition: string }[]>`SELECT pg_get_functiondef(
            'public.assert_india_native_credit_authority(uuid,uuid,uuid,text[],boolean)'::regprocedure) definition`;
          expect(row).toBeDefined();
          const changed = drift === "body" ? row!.definition.replace("DECLARE v_permission", "-- deliberate Order452 predecessor fault\nDECLARE v_permission")
            : row!.definition.replace("DEFAULT false", "DEFAULT true");
          expect(changed).not.toBe(row!.definition);
          await tx.unsafe(changed);
          await tx.unsafe(readFileSync(creditDeliveryMigration(mode!), "utf8"));
          throw new Error("Predecessor drift must fail");
        });
      } catch (error) { state = creditSqlState(error); }
      expect(state).toBe("55000");
      expect({ rows: await creditDeliveryRows(deploy), catalogue: await creditDeliveryCatalogue(deploy) }).toEqual(before);
    }
  }, 60_000);

  test("unmodified production migrator late fault rolls back function and ledger while preserving a genuine populated credit", async () => {
    const scenario = await createCreditDeliveryScenario(deploy, runtime);
    const before = { rows: await creditDeliveryRows(deploy), catalogue: await creditDeliveryCatalogue(deploy) };
    const directory = await prefixDirectory();
    await writeFile(join(directory, "0089_native_credit_delivery_discovery.sql"), readFileSync(creditDeliveryMigration(mode!), "utf8") + `
DO $order452_tail$ BEGIN
  IF to_regprocedure('public.read_india_native_credit_delivery_by_document(uuid,uuid,uuid,uuid)') IS NULL
    OR NOT has_function_privilege('app_role','public.read_india_native_credit_delivery_by_document(uuid,uuid,uuid,uuid)','EXECUTE')
    OR has_function_privilege('yellow_runtime','public.read_india_native_credit_delivery_by_document(uuid,uuid,uuid,uuid)','EXECUTE') THEN
    RAISE EXCEPTION USING ERRCODE='P452V',MESSAGE='Order452 runner tail capability verification failed'; END IF;
  RAISE EXCEPTION USING ERRCODE='PZ452',MESSAGE='Order452 deliberate production runner tail rollback';
END $order452_tail$;
`, { flag: "wx" });
    let state: string | undefined; let usable: unknown;
    try { await runMigrations({ databaseUrl: deployUrl!, migrationsDirectory: directory, logger: () => {} }); }
    catch (error) { state = creditSqlState(error); usable = (error as { rollbackConnectionUsable?: unknown }).rollbackConnectionUsable; }
    expect(state).toBe("PZ452"); expect(usable).toBe(true);
    expect({ rows: await creditDeliveryRows(deploy), catalogue: await creditDeliveryCatalogue(deploy) }).toEqual(before);
    const [credit] = await deploy<{ id: string }[]>`SELECT document_id::text id FROM public.india_native_fiscal_credit_note
      WHERE tenant_id=${scenario.tenantId}::uuid AND document_id=${scenario.documentId}::uuid`;
    expect(credit?.id).toBe(scenario.documentId);
  }, 120_000);

  (applyCanonical ? test : test.skip)("canonical88 to89 preserves every old row and ledger entry then is an exact production-runner no-op", async () => {
    const scenario = await createCreditDeliveryScenario(deploy, runtime);
    const before = await creditDeliveryRows(deploy);
    const oldLedger = await deploy`SELECT to_jsonb(m)::text body FROM public.schema_migration m ORDER BY version`;
    const directory = await prefixDirectory();
    await copyFile(creditDeliveryMigration("ci-canonical"), join(directory, "0089_native_credit_delivery_discovery.sql"));
    await runMigrations({ databaseUrl: deployUrl!, migrationsDirectory: directory, logger: () => {} });
    const after = await creditDeliveryRows(deploy);
    expect(Object.keys(after)).toEqual(Object.keys(before));
    for (const name of Object.keys(before)) if (name !== "schema_migration") expect(after[name]).toBe(before[name]);
    expect(await deploy`SELECT to_jsonb(m)::text body FROM public.schema_migration m WHERE version<=88 ORDER BY version`).toEqual(oldLedger);
    const [ledger] = await deploy<{ version: number; filename: string; checksum: string }[]>`SELECT version::int version,filename,btrim(checksum_sha256) checksum
      FROM public.schema_migration WHERE version=89`;
    expect(ledger).toEqual({ version: 89, filename: "0089_native_credit_delivery_discovery.sql",
      checksum: new Bun.CryptoHasher("sha256").update(readFileSync(creditDeliveryMigration("ci-canonical"))).digest("hex") });
    expect(await runtime.withTenantTransaction(scenario.tenantId, tx => readCreditDelivery(tx, scenario)))
      .toEqual({ kind: "not_requested", documentId: scenario.documentId });
    const stable = { rows: await creditDeliveryRows(deploy), catalogue: await creditDeliveryCatalogue(deploy) };
    await runMigrations({ databaseUrl: deployUrl!, migrationsDirectory: directory, logger: () => {} });
    expect({ rows: await creditDeliveryRows(deploy), catalogue: await creditDeliveryCatalogue(deploy) }).toEqual(stable);
  }, 120_000);
});

async function prefixDirectory(): Promise<string> {
  const root = fileURLToPath(new URL("../.yellow/evidence/order452/", import.meta.url));
  await mkdir(root, { recursive: true });
  const directory = await mkdtemp(join(root, "production-prefix88-"));
  const canonical = new URL("../migrations/", import.meta.url);
  const files = (await readdir(canonical)).filter(name => /^\d{4}_[a-z0-9_-]+\.sql$/.test(name) && Number(name.slice(0, 4)) <= 88).sort();
  expect(files.map(name => Number(name.slice(0, 4)))).toEqual(Array.from({ length: 88 }, (_, i) => i + 1));
  await Promise.all(files.map(name => copyFile(new URL(name, canonical), join(directory, name))));
  return directory;
}
