import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";
import { copyFile, mkdtemp, readdir, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative } from "node:path";
import { runMigrations } from "../scripts/migrate";
import { Database } from "../src/kernel";
import { Hs256TokenSigner } from "../src/contexts/identity";
import {
  createFiscalSubmissionHttpScenario, fiscalRequest, fiscalRetryRequest,
  fiscalSubmissionHttpApp, fiscalToken, FISCAL_REQUEST_SCOPE, FISCAL_RETRY_SCOPE,
  type FiscalSubmissionHttpBody, type FiscalSubmissionHttpScenario,
} from "./fixtures/order440-fiscal-submission-http";
import {
  assertFiscalReplayProofTargets, claimFiscalReplaySubmission,
  reconcileFiscalReplaySubmission, fiscalReplaySnapshot,
} from "./fixtures/order440-fiscal-immutable-replay";

const deployUrl = process.env.YELLOW_ORDER440_REPLAY_DEPLOY_DATABASE_URL;
const runtimeUrl = process.env.YELLOW_ORDER440_REPLAY_RUNTIME_DATABASE_URL;
const upgrade = process.env.YELLOW_ORDER440_REPLAY_APPLY_UPGRADE === "1";
if ((process.env.YELLOW_REQUIRE_ORDER440_REPLAY === "1" || upgrade) && (!deployUrl || !runtimeUrl)) {
  throw new Error("Required Q205 replay proof needs explicit isolated deploy and runtime URLs");
}
if (deployUrl && runtimeUrl) assertFiscalReplayProofTargets(deployUrl, runtimeUrl);
const databaseDescribe = deployUrl && runtimeUrl ? describe.serial : describe.skip;
const canonical78Hash = "65323a81a999a11e3d55893411c994c0b841af9b0465ca7e80630fd78d0ffae6";
const key = () => `q205-${crypto.randomUUID()}`;

// Q205 is specifically a historical78-to79 proof even after runtime80 is added.
// Copy exact canonical bytes; never let a later migration silently change its case.
async function applyCanonical79ReplayUpgrade() {
  const base = await realpath(tmpdir());
  const directory = await mkdtemp(join(base, "yellow-order440-q205-prefix79-"));
  const migrations = new URL("../migrations/", import.meta.url);
  try {
    const files = (await readdir(migrations))
      .filter(name => /^\d{4}_[a-z0-9_-]+\.sql$/.test(name) && Number(name.slice(0, 4)) <= 79)
      .sort();
    expect(files.map(name => Number(name.slice(0, 4))))
      .toEqual(Array.from({ length: 79 }, (_, index) => index + 1));
    await Promise.all(files.map(name => copyFile(new URL(name, migrations), join(directory, name))));
    return await runMigrations({ databaseUrl: deployUrl!, migrationsDirectory: directory, logger: () => {} });
  } finally {
    const target = await realpath(directory);
    const child = relative(base, target);
    if (isAbsolute(child) || !/^yellow-order440-q205-prefix79-[^/\\]+$/.test(child)) {
      throw new Error("Q205 migration prefix escaped its isolated temporary directory");
    }
    await rm(target, { recursive: true, force: true });
  }
}

describe("Q205 replay target isolation", () => {
  test("rejects retained databases, shared credentials, URL options and mismatched targets", () => {
    const deploy = "postgres://yellow_deploy:synthetic@127.0.0.1:55503/yellow_order440_q205_test";
    const runtime = deploy.replace("yellow_deploy", "yellow_runtime");
    expect(() => assertFiscalReplayProofTargets(deploy, runtime)).not.toThrow();
    expect(() => assertFiscalReplayProofTargets(deploy, deploy)).toThrow();
    expect(() => assertFiscalReplayProofTargets(deploy.replace("q205_test", "q203_test"), runtime)).toThrow();
    expect(() => assertFiscalReplayProofTargets(deploy, runtime + "_other")).toThrow();
    expect(() => assertFiscalReplayProofTargets(deploy, runtime + "?options=-crole=app_role")).toThrow();
  });
});

databaseDescribe("Q205 immutable fiscal command receipts", () => {
  let deploy: SQL;
  let runtime: SQL;
  let database: Database;
  const tokens = new Hs256TokenSigner("q205-immutable-replay-synthetic-token-secret-48-characters");
  let preUpgrade: Awaited<ReturnType<typeof historyScenario>> | undefined;

  async function historyScenario() {
    const scenario = await createFiscalSubmissionHttpScenario(deploy, database);
    const token = await fiscalToken(tokens, scenario);
    const app = fiscalSubmissionHttpApp(database, tokens, [scenario.provider]);
    const requestKey = key();
    const response = await app.handle(fiscalRequest(scenario, token, requestKey));
    expect(response.status).toBe(201);
    const requestBytes = await response.text();
    const requestBody = JSON.parse(requestBytes) as FiscalSubmissionHttpBody;
    const submissionId = requestBody.fiscalSubmission.submissionId;
    const claim = await claimFiscalReplaySubmission(runtime, scenario.tenantId, submissionId);
    await reconcileFiscalReplaySubmission(runtime, scenario.tenantId, submissionId, claim, "known_not_sent");
    const retryKey = key();
    const retry = await app.handle(fiscalRetryRequest(scenario, token, submissionId, retryKey));
    expect(retry.status).toBe(201);
    const retryBytes = await retry.text();
    const retryBody = JSON.parse(retryBytes) as FiscalSubmissionHttpBody;
    expect(requestBody.fiscalSubmission.attemptNumber).toBe(1);
    expect(retryBody.fiscalSubmission.attemptNumber).toBe(2);
    return { scenario, token, app, requestKey, requestBytes, requestBody, submissionId, retryKey, retryBytes, retryBody };
  }

  beforeAll(async () => {
    deploy = new SQL(deployUrl!, { max: 4, prepare: false });
    runtime = new SQL(runtimeUrl!, { max: 4, prepare: false });
    database = Database.connect(runtimeUrl!, { maxConnections: 4, prepare: false });
    const [identity] = await deploy<{ name: string; frontier: number; checksum: string }[]>`
      SELECT current_database()::text AS name,
        (SELECT max(version)::integer FROM schema_migration) AS frontier,
        btrim(checksum_sha256) AS checksum FROM schema_migration WHERE version=78
    `;
    if (!identity || !/^yellow_order440_q205_[a-z0-9_]+$/.test(identity.name)
        || ![78, 79].includes(identity.frontier) || identity.checksum !== canonical78Hash) {
      throw new Error("Q205 needs exact isolated canonical78 or corrective79");
    }
    if (upgrade) {
      if (identity.frontier !== 78) throw new Error("Pre-upgrade proof requires an actual78 starting frontier");
      preUpgrade = await historyScenario();
      const before = await fiscalReplaySnapshot(deploy, preUpgrade.scenario.tenantId);
      const result = await applyCanonical79ReplayUpgrade();
      expect(result.appliedFiles).toEqual(["0079_fiscal_immutable_command_receipts.sql"]);
      expect(await fiscalReplaySnapshot(deploy, preUpgrade.scenario.tenantId)).toEqual(before);
    }
  }, 60_000);

  afterAll(async () => {
    await database?.close();
    await runtime?.close({ timeout: 0 });
    await deploy?.close({ timeout: 0 });
  });

  async function assertOriginalReceipts(
    value: Awaited<ReturnType<typeof historyScenario>>,
    laterReceipts: readonly { key: string; bytes: string }[] = [],
  ) {
    const before = await fiscalReplaySnapshot(deploy, value.scenario.tenantId);
    const commands = [
      { request: () => fiscalRequest(value.scenario, value.token, value.requestKey), bytes: value.requestBytes },
      { request: () => fiscalRetryRequest(value.scenario, value.token, value.submissionId, value.retryKey), bytes: value.retryBytes },
      ...laterReceipts.map((receipt) => ({
        request: () => fiscalRetryRequest(value.scenario, value.token, value.submissionId, receipt.key), bytes: receipt.bytes,
      })),
    ];
    const responses = await Promise.all(Array.from({ length: commands.length * 5 }, (_, index) =>
      value.app.handle(commands[index % commands.length]!.request())));
    for (const [index, response] of responses.entries()) {
      expect(response.status).toBe(201);
      expect(response.headers.get("idempotency-replayed")).toBe("true");
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(await response.text()).toBe(commands[index % commands.length]!.bytes);
    }
    expect(await fiscalReplaySnapshot(deploy, value.scenario.tenantId)).toEqual(before);
  }

  test("original request and retry bytes survive subsequent attempts and terminal outcomes", async () => {
    for (const terminal of ["accepted", "rejected"] as const) {
      const value = terminal === "accepted" && preUpgrade ? preUpgrade : await historyScenario();
      const claim2 = await claimFiscalReplaySubmission(runtime, value.scenario.tenantId, value.submissionId);
      await reconcileFiscalReplaySubmission(runtime, value.scenario.tenantId, value.submissionId, claim2, "known_not_sent");
      const laterKey = key();
      const later = await value.app.handle(fiscalRetryRequest(value.scenario, value.token, value.submissionId, laterKey));
      expect(later.status).toBe(201);
      const laterBytes = await later.text();
      const laterBody = JSON.parse(laterBytes) as FiscalSubmissionHttpBody;
      expect(laterBody.fiscalSubmission.attemptNumber).toBe(3);
      expect(laterBody.fiscalSubmission.attemptId).not.toBe(value.retryBody.fiscalSubmission.attemptId);
      const laterReceipts = [{ key: laterKey, bytes: laterBytes }];
      await assertOriginalReceipts(value, laterReceipts);
      const claim3 = await claimFiscalReplaySubmission(runtime, value.scenario.tenantId, value.submissionId);
      await assertOriginalReceipts(value, laterReceipts);
      await reconcileFiscalReplaySubmission(runtime, value.scenario.tenantId, value.submissionId, claim3, "known_not_sent");
      const finalRetryKey = key();
      const finalRetry = await value.app.handle(fiscalRetryRequest(value.scenario, value.token, value.submissionId, finalRetryKey));
      expect(finalRetry.status).toBe(201);
      const finalRetryBytes = await finalRetry.text();
      const finalRetryBody = JSON.parse(finalRetryBytes) as FiscalSubmissionHttpBody;
      expect(finalRetryBody.fiscalSubmission.attemptNumber).toBe(4);
      expect(finalRetryBody.fiscalSubmission.retryCount).toBe(3);
      laterReceipts.push({ key: finalRetryKey, bytes: finalRetryBytes });
      const claim4 = await claimFiscalReplaySubmission(runtime, value.scenario.tenantId, value.submissionId);
      await reconcileFiscalReplaySubmission(runtime, value.scenario.tenantId, value.submissionId, claim4, terminal);
      await assertOriginalReceipts(value, laterReceipts);
      const [head] = await deploy<{ status: string; attempt_number: number }[]>`
        SELECT status,attempt_number FROM fiscal_submission
        WHERE tenant_id=${value.scenario.tenantId}::uuid AND id=${value.submissionId}::uuid
      `;
      expect(head).toEqual({ status: terminal, attempt_number: 4 });
    }
  }, 60_000);

  test("immediate replay has the exact first body and only the replay header changes", async () => {
    const scenario = await createFiscalSubmissionHttpScenario(deploy, database);
    const app = fiscalSubmissionHttpApp(database, tokens, [scenario.provider]);
    const token = await fiscalToken(tokens, scenario);
    const requestKey = key();
    const original = await app.handle(fiscalRequest(scenario, token, requestKey));
    const bytes = await original.text();
    const replay = await app.handle(fiscalRequest(scenario, token, requestKey));
    expect(original.status).toBe(201);
    expect(original.headers.get("idempotency-replayed")).toBe("false");
    expect(replay.status).toBe(original.status);
    expect(replay.headers.get("idempotency-replayed")).toBe("true");
    expect(await replay.text()).toBe(bytes);
  }, 30_000);

  test("late replay still checks current authorization and semantic identity without writes", async () => {
    const value = await historyScenario();
    const other = await createFiscalSubmissionHttpScenario(deploy, database);
    const otherBefore = await fiscalReplaySnapshot(deploy, other.tenantId);
    const before = await fiscalReplaySnapshot(deploy, value.scenario.tenantId);
    const changed = await value.app.handle(fiscalRequest(value.scenario, value.token, value.requestKey, {
      documentId: other.documentId, providerExtensionId: value.scenario.provider.providerExtensionId,
    }));
    expect(changed.status).toBe(503);
    const foreignToken = await fiscalToken(tokens, other);
    expect((await value.app.handle(fiscalRequest(value.scenario, foreignToken, value.requestKey))).status).toBe(403);
    expect(await fiscalReplaySnapshot(deploy, value.scenario.tenantId)).toEqual(before);
    expect(await fiscalReplaySnapshot(deploy, other.tenantId)).toEqual(otherBefore);
    await deploy`DELETE FROM role_permission WHERE role_id=${value.scenario.roleId}::uuid
      AND permission_code IN (${FISCAL_REQUEST_SCOPE},${FISCAL_RETRY_SCOPE})`;
    expect((await value.app.handle(fiscalRequest(value.scenario, value.token, value.requestKey))).status).toBe(403);
    expect((await value.app.handle(fiscalRetryRequest(value.scenario, value.token, value.submissionId, value.retryKey))).status).toBe(403);
    expect(await fiscalReplaySnapshot(deploy, value.scenario.tenantId)).toEqual(before);
  }, 30_000);

  test("history projection is owner-private and applied78 remains unchanged", async () => {
    const [helper] = await deploy<{ owner: string; security_definer: boolean; config: string[]; runtime_execute: boolean; app_execute: boolean; public_execute: boolean }[]>`
      SELECT pg_get_userbyid(proowner) AS owner,prosecdef AS security_definer,proconfig AS config,
        has_function_privilege('yellow_runtime',oid,'EXECUTE') AS runtime_execute,
        has_function_privilege('app_role',oid,'EXECUTE') AS app_execute,
        has_function_privilege('public',oid,'EXECUTE') AS public_execute
      FROM pg_proc WHERE oid=to_regprocedure('public.india_fiscal_submission_history_receipt(public.fiscal_submission_history,boolean)')
    `;
    expect(helper).toEqual({ owner: "yellow_owner", security_definer: false,
      config: ["search_path=pg_catalog, public, pg_temp"], runtime_execute: false, app_execute: false, public_execute: false });
    const [ledger] = await deploy<{ checksum: string }[]>`
      SELECT btrim(checksum_sha256) AS checksum FROM schema_migration WHERE version=78
    `;
    expect(ledger?.checksum).toBe(canonical78Hash);
  });
});
