import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";
import { Buffer } from "node:buffer";

import { BusinessDayCloseReadinessService } from "../src/contexts/financials";
import { Database } from "../src/kernel";
import {
  FISCAL_RECEIPT_READ_SCOPE,
  assertSignedFiscalReceiptProofTargets,
  claimSignedFiscalSubmission,
  createSignedFiscalReceiptFactory,
  createSignedFiscalScenario,
  createPre81FiscalHistory, signedFiscalMigrationCopy, signedFiscalTenantSnapshot,
  readSignedFiscalReceipt,
  reconcileSignedFiscalSubmission,
  type SignedFiscalClaim,
  type SignedFiscalScenario,
  type SignedFiscalReceiptFactory,
} from "./fixtures/order440-signed-fiscal-receipt";

const migration = new URL("../migrations/0081_fiscal_signed_delivery_receipts.sql", import.meta.url);
const deployUrl = process.env.YELLOW_ORDER440_SIGNED_DEPLOY_DATABASE_URL;
const runtimeUrl = process.env.YELLOW_ORDER440_SIGNED_RUNTIME_DATABASE_URL;
const upgrade = process.env.YELLOW_ORDER440_SIGNED_APPLY_UPGRADE === "1";
if ((process.env.YELLOW_REQUIRE_ORDER440_SIGNED === "1" || upgrade) && (!deployUrl || !runtimeUrl)) {
  throw new Error("Required Q207 signed receipt proof needs explicit deploy and runtime URLs");
}
if (deployUrl && runtimeUrl) assertSignedFiscalReceiptProofTargets(deployUrl, runtimeUrl);
const databaseDescribe = deployUrl && runtimeUrl ? describe.serial : describe.skip;

function sha256(value: Uint8Array | string): string {
  return new Bun.CryptoHasher("sha256").update(value).digest("hex");
}

async function expectSqlState(operation: () => Promise<unknown>, errno: string): Promise<void> {
  let failure: unknown;
  try { await operation(); } catch (error) { failure = error; }
  expect(failure).toBeDefined();
  expect((failure as { errno?: string } | undefined)?.errno).toBe(errno);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe("Q207 signed fiscal receipt migration source", () => {
  test("has one forward migration with no replacement artifact table or source digest", async () => {
    expect(await Bun.file(migration).exists()).toBe(true);
    const source = await Bun.file(migration).text();
    expect(source).toContain("sourceContentJson',v_source");
    expect(source).toContain("read_india_fiscal_submission_delivery_receipt(");
    expect(source).toContain("GRANT SELECT(tenant_id,document_id,status)");
    expect(source).not.toMatch(/CREATE\s+TABLE/iu);
    expect(source).not.toMatch(/ADD\s+COLUMN\s+[^;]*(?:source|content)[^;]*(?:sha|hash)/iu);
    expect(source).not.toContain("sourceSha256");
    expect(source).not.toContain("india_fiscal_submission_history_receipt(");
  });

  test("rejects retained, remote, option-bearing and mixed proof targets", () => {
    const deploy = "postgres://yellow_deploy:synthetic@127.0.0.1:5432/yellow_order440_q207_test";
    const runtime = deploy.replace("yellow_deploy", "yellow_runtime");
    expect(() => assertSignedFiscalReceiptProofTargets(deploy, runtime)).not.toThrow();
    expect(() => assertSignedFiscalReceiptProofTargets(deploy, deploy)).toThrow();
    expect(() => assertSignedFiscalReceiptProofTargets(deploy.replace("q207", "q204"), runtime)).toThrow();
    expect(() => assertSignedFiscalReceiptProofTargets(deploy, runtime + "?options=-crole=app_role")).toThrow();
    expect(() => assertSignedFiscalReceiptProofTargets(
      deploy.replace("127.0.0.1", "db.example"), runtime.replace("127.0.0.1", "db.example"),
    )).toThrow();
    expect(() => assertSignedFiscalReceiptProofTargets(deploy, runtime + "_other")).toThrow();
  });
});

interface DurableSnapshot {
  readonly head: string;
  readonly history: string;
  readonly facts: string;
  readonly events: string;
}

databaseDescribe("Q207 generated-signature fiscal receipt durability (not authenticated transport)", () => {
  let deploy: SQL;
  let runtime: SQL;
  let database: Database;
  let receipts: SignedFiscalReceiptFactory;
  const retained: Awaited<ReturnType<typeof createPre81FiscalHistory>>[] = [];
  const retainedSnapshots: (readonly string[])[] = [];

  async function snapshot(scenario: SignedFiscalScenario): Promise<DurableSnapshot> {
    const [row] = await deploy<DurableSnapshot[]>`
      SELECT (SELECT to_jsonb(s)::text FROM public.fiscal_submission s
               WHERE s.tenant_id=${scenario.tenantId}::uuid AND s.id=${scenario.submissionId}::uuid) AS head,
             (SELECT coalesce(jsonb_agg(to_jsonb(h) ORDER BY transition_seq),'[]'::jsonb)::text FROM public.fiscal_submission_history h
               WHERE tenant_id=${scenario.tenantId}::uuid AND submission_id=${scenario.submissionId}::uuid) AS history,
             (SELECT coalesce(jsonb_agg(to_jsonb(f) ORDER BY to_jsonb(f)::text),'[]'::jsonb)::text FROM public.fact_log f
               WHERE tenant_id=${scenario.tenantId}::uuid AND entity_type='fiscal_submission'
                 AND entity_id=${scenario.submissionId}::uuid) AS facts,
             (SELECT coalesce(jsonb_agg(to_jsonb(o) ORDER BY to_jsonb(o)::text),'[]'::jsonb)::text FROM public.outbox o
               WHERE tenant_id=${scenario.tenantId}::uuid AND aggregate_type='fiscal_submission'
                 AND aggregate_id=${scenario.submissionId}::uuid) AS events`;
    if (!row) throw new Error("Q207 durable snapshot is unavailable");
    return row;
  }

  async function runtimeClaimResult(
    scenario: SignedFiscalScenario,
  ): Promise<{ readonly claimed: boolean; readonly reason?: string }> {
    const [row] = await runtime.begin(async tx => {
      await tx`SELECT set_config('app.tenant_id',${scenario.tenantId},true)`;
      return tx<{ receipt: { claimed: boolean; reason?: string } }[]>`
        SELECT public.claim_india_fiscal_submission(
          ${scenario.tenantId}::uuid,${scenario.submissionId}::uuid,60) AS receipt`;
    });
    if (!row) throw new Error("Q207 claim result is unavailable");
    return row.receipt;
  }

  beforeAll(async () => {
    deploy = new SQL(deployUrl!, { max: 4, prepare: false, connectionTimeout: 5 });
    runtime = new SQL(runtimeUrl!, { max: 4, prepare: false, connectionTimeout: 5 });
    database = Database.connect(runtimeUrl!, { maxConnections: 4, prepare: false });
    const [identity] = await deploy<{ name: string; frontier: number }[]>`
      SELECT current_database()::text AS name,
             (SELECT max(version)::integer FROM public.schema_migration) AS frontier`;
    if (!identity || !/^yellow_order440_q207_[a-z0-9_]+$/u.test(identity.name) || identity.frontier !== (upgrade ? 80 : 81)) {
      throw new Error("Q207 proof needs a fresh isolated canonical81 database");
    }
    const [contents] = await deploy<{ tenants: number; submissions: number }[]>`
      SELECT (SELECT count(*)::integer FROM public.tenant) AS tenants,
             (SELECT count(*)::integer FROM public.fiscal_submission) AS submissions`;
    if (!contents || contents.tenants !== 0 || contents.submissions !== 0) {
      throw new Error("Q207 proof requires an empty isolated target");
    }
    if (upgrade) {
      // A hostile effective column grant must be removed or abort the migration.
      // The owned copy always throws after canonical DDL, so no81 can be consumed here.
      const hostile = await signedFiscalMigrationCopy("hostile_acl");
      let hostileFailure: unknown;
      try {
        await deploy`GRANT SELECT(wire_text) ON fiscal_submission TO PUBLIC`;
        await deploy`GRANT SELECT(response_sha256) ON fiscal_submission_history TO PUBLIC`;
        try { await hostile.run(deployUrl!); } catch (error) { hostileFailure = error; }
      } finally {
        await deploy`REVOKE SELECT(wire_text) ON fiscal_submission FROM PUBLIC`;
        await deploy`REVOKE SELECT(response_sha256) ON fiscal_submission_history FROM PUBLIC`;
      }
      expect(["55000", "P0001"]).toContain((hostileFailure as { errno?: string } | undefined)?.errno!);
      expect((await deploy<{ frontier: number }[]>`SELECT max(version)::integer AS frontier FROM schema_migration`)[0]?.frontier).toBe(80);
      for (const outcome of ["accepted", "rejected", "known_not_sent", "in_flight", "pending"] as const) {
        const history = await createPre81FiscalHistory(deploy, runtime, database, outcome);
        retained.push(history);
        retainedSnapshots.push(await signedFiscalTenantSnapshot(deploy, history.scenario.tenantId));
        for (const response of await history.replay()) {
          expect(response.status).toBe(201); expect(response.bytes).toBe(response.expected);
        }
      }
      const [before] = await deploy<{ body: string }[]>`SELECT jsonb_build_object(
        'ledger',(SELECT jsonb_agg(to_jsonb(m) ORDER BY version) FROM schema_migration m),
        'functions',(SELECT jsonb_agg(pg_get_functiondef(p.oid) ORDER BY p.oid) FROM pg_proc p
          WHERE pronamespace='public'::regnamespace AND proname IN ('claim_india_fiscal_submission',
            'reconcile_india_fiscal_submission','india_fiscal_submission_protect_head')),
        'constraints',(SELECT jsonb_agg(pg_get_constraintdef(c.oid) ORDER BY conname) FROM pg_constraint c
          WHERE conrelid IN ('fiscal_submission'::regclass,'fiscal_submission_history'::regclass)))::text AS body`;
      const failure = await signedFiscalMigrationCopy("rollback");
      await expectSqlState(() => failure.run(deployUrl!), "P0001");
      const [after] = await deploy<{ body: string }[]>`SELECT jsonb_build_object(
        'ledger',(SELECT jsonb_agg(to_jsonb(m) ORDER BY version) FROM schema_migration m),
        'functions',(SELECT jsonb_agg(pg_get_functiondef(p.oid) ORDER BY p.oid) FROM pg_proc p
          WHERE pronamespace='public'::regnamespace AND proname IN ('claim_india_fiscal_submission',
            'reconcile_india_fiscal_submission','india_fiscal_submission_protect_head')),
        'constraints',(SELECT jsonb_agg(pg_get_constraintdef(c.oid) ORDER BY conname) FROM pg_constraint c
          WHERE conrelid IN ('fiscal_submission'::regclass,'fiscal_submission_history'::regclass)))::text AS body`;
      expect(after).toEqual(before);
      const [absent] = await deploy<{ absent: boolean }[]>`SELECT
        to_regprocedure('public.read_india_fiscal_submission_delivery_receipt(uuid,uuid,uuid,uuid)') IS NULL
        AND NOT EXISTS(SELECT 1 FROM permission WHERE code=${FISCAL_RECEIPT_READ_SCOPE}) AS absent`;
      expect(absent?.absent).toBe(true);
      for (const [index, value] of retained.entries()) {
        expect(await signedFiscalTenantSnapshot(deploy, value.scenario.tenantId)).toEqual(retainedSnapshots[index]!);
      }
      const canonical = await signedFiscalMigrationCopy("canonical");
      const applied = await canonical.run(deployUrl!);
      expect(applied.appliedFiles).toEqual(["0081_fiscal_signed_delivery_receipts.sql"]);
      expect(applied.transactionBackendPids).toEqual([applied.backendPid]);
      expect((await canonical.run(deployUrl!)).appliedFiles).toEqual([]);
      const ledgerBefore = await deploy`SELECT * FROM schema_migration ORDER BY version`;
      const drift = await signedFiscalMigrationCopy("drift");
      expect(drift.hash).not.toBe(canonical.hash);
      await expect(drift.run(deployUrl!)).rejects.toThrow(/checksum/iu);
      expect(await deploy`SELECT * FROM schema_migration ORDER BY version`).toEqual(ledgerBefore);
      console.info(`Q207 retained owned copies: rollback=${failure.directory} sha256=${failure.hash}; canonical=${canonical.directory} sha256=${canonical.hash}; drift=${drift.directory} sha256=${drift.hash}`);
      for (const [index, value] of retained.entries()) {
        expect(await signedFiscalTenantSnapshot(deploy, value.scenario.tenantId)).toEqual(retainedSnapshots[index]!);
      }
    }
    const expectedFiles = [
      "0078_fiscal_submission_durability.sql",
      "0079_fiscal_immutable_command_receipts.sql",
      "0080_fiscal_submission_delivery_runtime.sql",
      "0081_fiscal_signed_delivery_receipts.sql",
    ] as const;
    const expectedHashes = await Promise.all(expectedFiles.map(async filename => sha256(
      new Uint8Array(await Bun.file(new URL(`../migrations/${filename}`, import.meta.url)).arrayBuffer()),
    )));
    const ledger = await deploy<{ version: number; filename: string; checksum: string }[]>`
      SELECT version::integer,filename,btrim(checksum_sha256) AS checksum
        FROM public.schema_migration WHERE version BETWEEN 78 AND 81 ORDER BY version`;
    expect(ledger).toEqual(expectedFiles.map((filename, index) => ({
      version: index + 78, filename, checksum: expectedHashes[index]!,
    })));
    receipts = await createSignedFiscalReceiptFactory();
  }, 180_000);

  afterAll(async () => {
    await database?.close();
    await runtime?.close({ timeout: 0 });
    await deploy?.close({ timeout: 0 });
  }, 60_000);

  test("registers an unassigned read capability and narrows application table reads to three head columns", async () => {
    const [catalogue] = await deploy<{
      permission_assignments: number; read_owner: string; security_definer: boolean;
      result: string; config: string[]; app_execute: boolean; runtime_execute: boolean; public_execute: boolean;
    }[]>`
      SELECT (SELECT count(*)::integer FROM public.role_permission
               WHERE permission_code=${FISCAL_RECEIPT_READ_SCOPE}) AS permission_assignments,
             pg_get_userbyid(p.proowner) AS read_owner,p.prosecdef AS security_definer,
             pg_get_function_result(p.oid) AS result,p.proconfig AS config,
             has_function_privilege('app_role',p.oid,'EXECUTE') AS app_execute,
             has_function_privilege('yellow_runtime',p.oid,'EXECUTE') AS runtime_execute,
             has_function_privilege('public',p.oid,'EXECUTE') AS public_execute
        FROM pg_proc p WHERE p.oid=to_regprocedure(
          'public.read_india_fiscal_submission_delivery_receipt(uuid,uuid,uuid,uuid)')`;
    expect(catalogue).toEqual({ permission_assignments: 0, read_owner: "yellow_owner",
      security_definer: true, result: "jsonb",
      config: ["search_path=pg_catalog, public, pg_temp", "TimeZone=UTC", "DateStyle=ISO,YMD"],
      app_execute: true, runtime_execute: false, public_execute: false });
    const columns = await deploy<{ table_name: string; column_name: string }[]>`
      SELECT table_name,column_name FROM information_schema.column_privileges
       WHERE table_schema='public' AND grantee='app_role' AND privilege_type='SELECT'
         AND table_name IN ('fiscal_submission','fiscal_submission_history')
       ORDER BY table_name,column_name`;
    expect(columns).toEqual([
      { table_name: "fiscal_submission", column_name: "document_id" },
      { table_name: "fiscal_submission", column_name: "status" },
      { table_name: "fiscal_submission", column_name: "tenant_id" },
    ]);
    const effective = await deploy<{ table_name: string; column_name: string; role_name: string; allowed: boolean }[]>`
      SELECT c.relname AS table_name,a.attname AS column_name,r.rolname AS role_name,
        has_column_privilege(r.oid,c.oid,a.attnum,'SELECT') AS allowed
      FROM pg_class c JOIN pg_attribute a ON a.attrelid=c.oid
      CROSS JOIN pg_roles r WHERE c.oid IN ('public.fiscal_submission'::regclass,'public.fiscal_submission_history'::regclass)
        AND a.attnum>0 AND NOT a.attisdropped AND r.rolname IN ('app_role','yellow_runtime')
      ORDER BY c.relname,a.attname,r.rolname`;
    expect(effective.length).toBeGreaterThan(60);
    for (const row of effective) expect(row.allowed).toBe(row.role_name === "app_role"
      && row.table_name === "fiscal_submission" && ["tenant_id", "document_id", "status"].includes(row.column_name));
    await expectSqlState(async () => deploy`SELECT public.read_india_fiscal_submission_delivery_receipt(
      ${crypto.randomUUID()}::uuid,${crypto.randomUUID()}::uuid,${crypto.randomUUID()}::uuid,
      ${crypto.randomUUID()}::uuid)`, "42501");
    await expectSqlState(async () => runtime`SELECT public.read_india_fiscal_submission_delivery_receipt(
      ${crypto.randomUUID()}::uuid,${crypto.randomUUID()}::uuid,${crypto.randomUUID()}::uuid,
      ${crypto.randomUUID()}::uuid)`, "42501");
  });

  (upgrade ? test : test.skip)("actually preserves all frontier80 states, claim bindings and original/all retry HTTP bytes through81", async () => {
    expect(retained.map(value => value.outcome)).toEqual(["accepted", "rejected", "known_not_sent", "in_flight", "pending"]);
    for (const [index, value] of retained.entries()) {
      expect(await signedFiscalTenantSnapshot(deploy, value.scenario.tenantId)).toEqual(retainedSnapshots[index]!);
      for (const response of await value.replay()) {
        expect(response.status).toBe(201); expect(response.cache).toBe("no-store");
        expect(response.replayed).toBe("true"); expect(response.bytes).toBe(response.expected);
      }
      if (value.claim && value.result) {
        expect(await reconcileSignedFiscalSubmission(runtime, value.scenario, value.claim, value.result))
          .toMatchObject({ replayed: true });
      }
      expect(await signedFiscalTenantSnapshot(deploy, value.scenario.tenantId)).toEqual(retainedSnapshots[index]!);
      if (value.outcome === "accepted" || value.outcome === "rejected") {
        await deploy`INSERT INTO role_permission(role_id,permission_code)
          VALUES(${value.scenario.roleId}::uuid,${FISCAL_RECEIPT_READ_SCOPE})`;
        expect(await readSignedFiscalReceipt(runtime, value.scenario)).toMatchObject({ kind: "legacy_hash_only",
          authorityRef: value.result!.authorityRef, responseSha256: value.result!.responseSha256 });
        await deploy`UPDATE fiscal_submission SET status=status WHERE id=${value.scenario.submissionId}::uuid`;
        expect(await signedFiscalTenantSnapshot(deploy, value.scenario.tenantId)).toEqual(retainedSnapshots[index]!);
      }
      if (value.outcome === "in_flight") {
        const valid = await receipts.accepted({ ...value.claim!, sourceContentJson: (await deploy<{content: string}[]>`
          SELECT content::text AS content FROM document WHERE id=${value.scenario.documentId}::uuid`)[0]!.content });
        expect(await reconcileSignedFiscalSubmission(runtime, value.scenario, value.claim!, valid))
          .toMatchObject({ status: "accepted", replayed: false });
      }
    }
  }, 60_000);

  test("retains one genuinely bound signed pair atomically and returns only the authorized display model", async () => {
    const scenario = await createSignedFiscalScenario(deploy, runtime, database);
    const pending = await readSignedFiscalReceipt(runtime, scenario) as Record<string, unknown>;
    expect(pending.kind).toBe("pending");
    const claim = await claimSignedFiscalSubmission(runtime, scenario);
    const [source] = await deploy<{ content: string; hash: string }[]>`
      SELECT content::text AS content,sha256 AS hash FROM public.document
       WHERE tenant_id=${scenario.tenantId}::uuid AND id=${scenario.documentId}::uuid`;
    expect(source).toEqual({ content: claim.sourceContentJson, hash: claim.documentSha256 });
    expect(sha256(claim.sourceContentJson)).toBe(claim.documentSha256);
    expect(sha256(claim.wireJson)).toBe(claim.wireSha256);
    expect(claim.sourceContentJson).not.toBe(claim.wireJson);
    const result = await receipts.accepted(claim);
    const responseSha256 = result.responseSha256 as string;
    const authorityRef = result.authorityRef as string;
    const signedQRCode = (result.receipt as Record<string, unknown>).signedQRCode as string;
    const beforeDocument = source!.content;
    const receipt = await reconcileSignedFiscalSubmission(runtime, scenario, claim, result) as Record<string, unknown>;
    expect(receipt).toMatchObject({ status: "accepted", disposition: "none", replayed: false });
    const [head] = await deploy<{ response: unknown; response_sha256: string; qr_payload: string;
      authority_ref: string; status: string }[]>`
      SELECT response,response_sha256,qr_payload,authority_ref,status FROM public.fiscal_submission
       WHERE tenant_id=${scenario.tenantId}::uuid AND id=${scenario.submissionId}::uuid`;
    expect(head).toEqual({ response: result, response_sha256: responseSha256,
      qr_payload: signedQRCode,
      authority_ref: authorityRef, status: "accepted" });
    const display = await readSignedFiscalReceipt(runtime, scenario) as Record<string, unknown>;
    expect(display).toMatchObject({ kind: "accepted_signed_v1", submissionId: scenario.submissionId,
      documentId: scenario.documentId, documentSha256: claim.documentSha256,
      wireSha256: claim.wireSha256, status: "accepted", disposition: "none",
      environment: "sandbox", responseSha256,
      irn: authorityRef,
      signedInvoice: (result.receipt as Record<string, unknown>).signedInvoice,
      signedQRCode: (result.receipt as Record<string, unknown>).signedQRCode });
    expect(JSON.stringify(display)).not.toMatch(/rawResponse|decryptedData|sourceContent|wireJson|claimToken|password|AppKey|SEK/u);
    const history = await deploy<{ response_sha256: string | null; authority_ref: string | null }[]>`
      SELECT response_sha256,authority_ref FROM public.fiscal_submission_history
       WHERE tenant_id=${scenario.tenantId}::uuid AND submission_id=${scenario.submissionId}::uuid
       ORDER BY transition_seq`;
    expect(history.at(-1)).toEqual({ response_sha256: responseSha256, authority_ref: authorityRef });
    const evidence = await deploy<{ payload: unknown }[]>`
      SELECT payload FROM public.fact_log WHERE tenant_id=${scenario.tenantId}::uuid
        AND entity_type='fiscal_submission' AND entity_id=${scenario.submissionId}::uuid
      UNION ALL
      SELECT payload FROM public.outbox WHERE tenant_id=${scenario.tenantId}::uuid
        AND aggregate_type='fiscal_submission' AND aggregate_id=${scenario.submissionId}::uuid`;
    for (const row of evidence) {
      expect(row.payload).not.toHaveProperty("receipt");
      expect(JSON.stringify(row.payload)).not.toContain((result.receipt as Record<string, string>).signedInvoice!);
    }
    expect(await reconcileSignedFiscalSubmission(runtime, scenario, claim, result))
      .toMatchObject({ status: "accepted", replayed: true });
    const conflicting = clone(result); conflicting.responseSha256 = "0".repeat(64);
    await expectSqlState(() => reconcileSignedFiscalSubmission(runtime, scenario, claim, conflicting), "55000");
    await expectSqlState(async () => deploy`UPDATE public.fiscal_submission SET resolved_at=clock_timestamp()
      WHERE tenant_id=${scenario.tenantId}::uuid AND id=${scenario.submissionId}::uuid`, "55000");
    await expectSqlState(async () => deploy`DELETE FROM public.fiscal_submission
      WHERE tenant_id=${scenario.tenantId}::uuid AND id=${scenario.submissionId}::uuid`, "55000");
    const [afterDocument] = await deploy<{ content: string }[]>`SELECT content::text AS content FROM public.document
      WHERE tenant_id=${scenario.tenantId}::uuid AND id=${scenario.documentId}::uuid`;
    expect(afterDocument?.content).toBe(beforeDocument);
  }, 60_000);

  test("rejects unsigned, malformed, noncanonical and oversized terminal evidence with complete rollback", async () => {
    const scenario = await createSignedFiscalScenario(deploy, runtime, database);
    const claim = await claimSignedFiscalSubmission(runtime, scenario);
    const valid = await receipts.accepted(claim);
    const base = { type: "transport_result", tenantId: claim.tenantId, providerKey: claim.providerKey,
      attemptId: claim.attemptId, documentId: claim.documentId, payloadSha256: claim.wireSha256,
      outcome: "accepted", authorityRef: "b1".repeat(32), responseSha256: "1".repeat(64) };
    const invalid: Record<string, unknown>[] = [base];
    const missingToken = clone(valid); delete (missingToken.receipt as Record<string, unknown>).signedQRCode;
    invalid.push(missingToken);
    const extraSecret = clone(valid); (extraSecret.receipt as Record<string, unknown>).AppKey = "forbidden";
    invalid.push(extraSecret);
    const noncanonical = clone(valid); (noncanonical.receipt as Record<string, unknown>).rawResponseBase64 += "\n";
    invalid.push(noncanonical);
    const invalidUtf8 = clone(valid);
    (invalidUtf8.receipt as Record<string, unknown>).rawResponseBase64 = "/w==";
    invalidUtf8.responseSha256 = sha256(new Uint8Array([255]));
    invalid.push(invalidUtf8);
    const oversized = clone(valid);
    (oversized.receipt as Record<string, unknown>).rawResponseBase64 = "A".repeat(8_388_612);
    oversized.responseSha256 = sha256(new Uint8Array(6_291_459));
    invalid.push(oversized);
    const before = await snapshot(scenario);
    for (const candidate of invalid) {
      await expectSqlState(() => reconcileSignedFiscalSubmission(runtime, scenario, claim, candidate), "22023");
      expect(await snapshot(scenario)).toEqual(before);
    }
  }, 120_000);

  test("persists authenticated rejection without an invented IRN and enforces exact error codes", async () => {
    const scenario = await createSignedFiscalScenario(deploy, runtime, database);
    const claim = await claimSignedFiscalSubmission(runtime, scenario);
    const duplicateCodes = receipts.rejected(claim, ["FICTIONAL-E100", "FICTIONAL-E100"]);
    await expectSqlState(() => reconcileSignedFiscalSubmission(runtime, scenario, claim, duplicateCodes), "22023");
    const invented = receipts.rejected(claim) as Record<string, unknown>; invented.authorityRef = "f1".repeat(32);
    await expectSqlState(() => reconcileSignedFiscalSubmission(runtime, scenario, claim, invented), "22023");
    const result = receipts.rejected(claim, ["FICTIONAL-E100", "FICTIONAL-E200"]);
    await reconcileSignedFiscalSubmission(runtime, scenario, claim, result);
    const [head] = await deploy<{ status: string; disposition: string; authority_ref: null; qr_payload: null }[]>`
      SELECT status,disposition,authority_ref,qr_payload FROM public.fiscal_submission
       WHERE tenant_id=${scenario.tenantId}::uuid AND id=${scenario.submissionId}::uuid`;
    expect(head).toEqual({ status: "rejected", disposition: "none", authority_ref: null, qr_payload: null });
    const display = await readSignedFiscalReceipt(runtime, scenario) as Record<string, unknown>;
    expect(display).toMatchObject({ kind: "rejected", status: "rejected", environment: "sandbox",
      responseSha256: result.responseSha256, errorCodes: ["FICTIONAL-E100", "FICTIONAL-E200"] });
    expect(display).not.toHaveProperty("authorityRef");
    expect(JSON.stringify(display)).not.toMatch(/rawResponse|decryptedData/u);
  }, 60_000);

  test("late history, fact and outbox write failures roll back every complete evidence row", async () => {
    const scenario = await createSignedFiscalScenario(deploy, runtime, database);
    const claim = await claimSignedFiscalSubmission(runtime, scenario);
    const result = await receipts.accepted(claim);
    const before = await signedFiscalTenantSnapshot(deploy, scenario.tenantId);
    for (const table of ["fiscal_submission_history", "fact_log", "outbox"] as const) {
      try {
        await deploy.unsafe(`ALTER TABLE public.${table} ADD CONSTRAINT q207_review_late_fault
          CHECK (tenant_id <> '${scenario.tenantId}'::uuid) NOT VALID`);
        await expectSqlState(() => reconcileSignedFiscalSubmission(runtime, scenario, claim, result), "23514");
        expect(await signedFiscalTenantSnapshot(deploy, scenario.tenantId)).toEqual(before);
      } finally {
        await deploy.unsafe(`ALTER TABLE public.${table} DROP CONSTRAINT IF EXISTS q207_review_late_fault`);
      }
    }
    expect(await reconcileSignedFiscalSubmission(runtime, scenario, claim, result)).toMatchObject({ status: "accepted" });
    expect((await deploy<{ count: number }[]>`SELECT count(*)::integer FROM pg_constraint WHERE conname='q207_review_late_fault'`)[0]?.count).toBe(0);
  }, 90_000);

  test("owner-private signed predicate has valid controls and denies every required NULL across all three variants", async () => {
    const scenario = await createSignedFiscalScenario(deploy, runtime, database);
    const claim = await claimSignedFiscalSubmission(runtime, scenario);
    for (const result of [await receipts.accepted(claim), receipts.rejected(claim), receipts.cancelled(claim)]) {
      const receipt = result.receipt as Record<string, unknown>;
      const cancelled = result.outcome === "provider_cancelled", accepted = result.outcome === "accepted";
      const parameters: unknown[] = [JSON.stringify(result), result.responseSha256, receipt.signedQRCode ?? null,
        cancelled ? "error" : result.outcome, "none", cancelled ? "provider_cancelled" : null,
        result.type, result.authorityRef ?? null, claim.tenantId, claim.attemptId, claim.documentId,
        claim.documentSha256, claim.wireSha256, claim.providerKey];
      const required = [0, 1, 3, 4, 6, 8, 9, 10, 11, 12, 13, ...(accepted ? [2, 7] : []), ...(cancelled ? [5] : [])];
      for (const missing of [-1, ...required, -2]) {
        const values = [...parameters];
        if (missing >= 0) values[missing] = null;
        if (missing === -2) values[6] = result.type === "lookup_result" ? "transport_result" : "lookup_result";
        const [row] = await deploy.begin(async tx => {
          await tx.unsafe("SET LOCAL ROLE yellow_owner");
          return tx.unsafe<{ valid: boolean }[]>(`SELECT india_fiscal_submission_signed_result_v1_valid(
            $1::jsonb,$2,$3,$4,$5,$6,$7,$8,$9::uuid,$10::uuid,$11::uuid,$12,$13,$14) AS valid`, values);
        });
        expect(row?.valid).toBe(missing === -1);
      }
    }
  }, 60_000);

  test("SQL byte bounds accept valid max-minus-one/exact payloads and reject max-plus-one, BOM and invalid UTF8", async () => {
    const scenario = await createSignedFiscalScenario(deploy, runtime, database);
    const claim = await claimSignedFiscalSubmission(runtime, scenario);
    const base = await receipts.accepted(claim);
    const before = await signedFiscalTenantSnapshot(deploy, scenario.tenantId);
    const rollback = new Error("Q207 successful boundary reconciliation deliberately rolled back");
    async function probe(candidate: Record<string, unknown>, valid: boolean) {
      if (!valid) {
        await expectSqlState(() => reconcileSignedFiscalSubmission(runtime, scenario, claim, candidate), "22023");
      } else {
        let failure: unknown;
        try {
          await runtime.begin(async tx => {
            await tx`SELECT set_config('app.tenant_id',${scenario.tenantId},true)`;
            const [row] = await tx<{ result: {status: string} }[]>`SELECT reconcile_india_fiscal_submission(
              ${scenario.tenantId}::uuid,${scenario.submissionId}::uuid,${claim.attemptId}::uuid,
              ${claim.claimToken}::uuid,${JSON.stringify(candidate)}::jsonb) AS result`;
            expect(row?.result.status).toBe("accepted");
            throw rollback;
          });
        } catch (error) { failure = error; }
        expect(failure).toBe(rollback);
      }
      expect(await signedFiscalTenantSnapshot(deploy, scenario.tenantId)).toEqual(before);
    }
    for (const [field, maximum] of [["rawResponseBase64", 6 * 1024 * 1024], ["decryptedDataBase64", 4 * 1024 * 1024]] as const) {
      for (const delta of [-1, 0, 1]) {
        const bytes = Buffer.alloc(maximum + delta, 0x61);
        const candidate = clone(base), receipt = candidate.receipt as Record<string, unknown>;
        receipt[field] = bytes.toString("base64");
        if (field === "rawResponseBase64") candidate.responseSha256 = sha256(bytes);
        else receipt.decryptedDataSha256 = sha256(bytes);
        await probe(candidate, delta <= 0);
      }
      for (const bytes of [Buffer.from([0xef, 0xbb, 0xbf, 0x61]), Buffer.from([0xff]), Buffer.from([0xc0, 0xaf]), Buffer.from([0xed, 0xa0, 0x80])]) {
        const candidate = clone(base), receipt = candidate.receipt as Record<string, unknown>;
        receipt[field] = bytes.toString("base64");
        if (field === "rawResponseBase64") candidate.responseSha256 = sha256(bytes);
        else receipt.decryptedDataSha256 = sha256(bytes);
        await probe(candidate, false);
      }
    }
  }, 120_000);

  test("records cancellation as immutable non-due non-retry discrepancy and preserves readiness blocking", async () => {
    const scenario = await createSignedFiscalScenario(deploy, runtime, database);
    const submit = await claimSignedFiscalSubmission(runtime, scenario);
    const pending = { type: "transport_result", tenantId: submit.tenantId, providerKey: submit.providerKey,
      attemptId: submit.attemptId, documentId: submit.documentId, payloadSha256: submit.wireSha256,
      outcome: "pending" };
    await reconcileSignedFiscalSubmission(runtime, scenario, submit, pending);
    await deploy`UPDATE public.fiscal_submission SET claim_expires_at=clock_timestamp()-interval '16 seconds'
      WHERE tenant_id=${scenario.tenantId}::uuid AND id=${scenario.submissionId}::uuid`;
    const lookup = await claimSignedFiscalSubmission(runtime, scenario);
    expect(lookup.action).toBe("lookup");
    const result = receipts.cancelled(lookup);
    await reconcileSignedFiscalSubmission(runtime, scenario, lookup, result);
    const [head] = await deploy<{ status: string; disposition: string; reconciliation_reason: string;
      resolution_source: string; authority_ref: null; qr_payload: null }[]>`
      SELECT status,disposition,reconciliation_reason,resolution_source,authority_ref,qr_payload
        FROM public.fiscal_submission WHERE tenant_id=${scenario.tenantId}::uuid
         AND id=${scenario.submissionId}::uuid`;
    expect(head).toEqual({ status: "error", disposition: "none", reconciliation_reason: "provider_cancelled",
      resolution_source: "lookup_result", authority_ref: null, qr_payload: null });
    expect(await runtimeClaimResult(scenario)).toEqual({ claimed: false, reason: "terminal" });
    const due = await runtime<{ submission_id: string }[]>`
      SELECT submission_id FROM public.runtime_due_india_fiscal_submissions(500,NULL,NULL)`;
    expect(due.some(row => row.submission_id === scenario.submissionId)).toBe(false);
    await expectSqlState(async () => runtime.begin(async tx => {
      await tx`SELECT set_config('app.tenant_id',${scenario.tenantId},true)`;
      await tx.unsafe("SET LOCAL ROLE app_role");
      return tx`SELECT public.retry_india_fiscal_submission(${scenario.tenantId}::uuid,
        ${scenario.submissionId}::uuid,${scenario.actorId}::uuid,${`q207-${crypto.randomUUID()}`},
        ${crypto.randomUUID()}::uuid)`;
    }), "55000");
    const display = await readSignedFiscalReceipt(runtime, scenario) as Record<string, unknown>;
    expect(display).toMatchObject({ kind: "provider_cancelled", status: "error", disposition: "none",
      environment: "sandbox", providerStatus: "CNL", responseSha256: result.responseSha256 });
    const [businessDate] = await deploy<{ business_date: string }[]>`
      SELECT business_date::text FROM public.fiscal_submission
       WHERE tenant_id=${scenario.tenantId}::uuid AND id=${scenario.submissionId}::uuid`;
    const readiness = await new BusinessDayCloseReadinessService({ database }).read({
      tenantId: scenario.tenantId, propertyNode: scenario.propertyNode,
      businessDate: businessDate!.business_date, actorId: scenario.actorId,
    });
    expect(readiness.counts.fiscalInterface).toBeGreaterThanOrEqual(1);
    expect(readiness.reasons).toContainEqual({ code: "fiscal_interface_pending", source: "fiscal", count: readiness.counts.fiscalInterface });
    await expectSqlState(async () => deploy`DELETE FROM public.fiscal_submission
      WHERE tenant_id=${scenario.tenantId}::uuid AND id=${scenario.submissionId}::uuid`, "55000");
  }, 90_000);

  test("returns null across missing, property, actor, tenant and revoked read boundaries", async () => {
    const first = await createSignedFiscalScenario(deploy, runtime, database);
    const second = await createSignedFiscalScenario(deploy, runtime, database);
    expect(await readSignedFiscalReceipt(runtime, { ...first, submissionId: crypto.randomUUID() })).toBeNull();
    expect(await readSignedFiscalReceipt(runtime, { ...first, propertyNode: crypto.randomUUID() })).toBeNull();
    expect(await readSignedFiscalReceipt(runtime, { ...first, actorId: first.unauthorizedActorId })).toBeNull();
    expect(await readSignedFiscalReceipt(runtime, {
      tenantId: second.tenantId, propertyNode: second.propertyNode,
      submissionId: first.submissionId, actorId: second.actorId,
    })).toBeNull();
    await deploy`DELETE FROM public.role_permission WHERE role_id=${first.roleId}::uuid
      AND permission_code=${FISCAL_RECEIPT_READ_SCOPE}`;
    expect(await readSignedFiscalReceipt(runtime, first)).toBeNull();
    await expectSqlState(async () => runtime.begin(async tx => {
      await tx`SELECT set_config('app.tenant_id',${second.tenantId},true)`;
      await tx.unsafe("SET LOCAL ROLE app_role");
      return tx`SELECT public.read_india_fiscal_submission_delivery_receipt(${first.tenantId}::uuid,
        ${first.propertyNode}::uuid,${first.submissionId}::uuid,${first.actorId}::uuid)`;
    }), "42501");
    await expectSqlState(async () => runtime.begin(async tx => {
      await tx`SELECT set_config('app.tenant_id',${first.tenantId},true)`;
      await tx.unsafe("SET LOCAL ROLE app_role");
      return tx`SELECT response FROM public.fiscal_submission WHERE tenant_id=${first.tenantId}::uuid`;
    }), "42501");
    await expectSqlState(async () => runtime.begin(async tx => {
      await tx`SELECT set_config('app.tenant_id',${first.tenantId},true)`;
      await tx.unsafe("SET LOCAL ROLE app_role");
      return tx`SELECT * FROM public.fiscal_submission_history WHERE tenant_id=${first.tenantId}::uuid`;
    }), "42501");
  }, 60_000);

  test("requires a same-tenant role and actual ancestor scope with active actor and tenant", async () => {
    const first = await createSignedFiscalScenario(deploy, runtime, database);
    const foreign = await createSignedFiscalScenario(deploy, runtime, database);
    const actor = crypto.randomUUID();
    await deploy`INSERT INTO app_user(id,tenant_id,email,display_name)
      VALUES(${actor}::uuid,${first.tenantId}::uuid,${`q207-${actor}@example.invalid`},'Q207 scope probe')`;
    await deploy`INSERT INTO user_role(tenant_id,user_id,role_id,scope_node)
      VALUES(${first.tenantId}::uuid,${actor}::uuid,${foreign.roleId}::uuid,${first.propertyNode}::uuid)`;
    const input = { ...first, actorId: actor };
    expect(await readSignedFiscalReceipt(runtime, input)).toBeNull();
    await deploy`UPDATE user_role SET role_id=${first.roleId}::uuid WHERE user_id=${actor}::uuid`;
    expect(await readSignedFiscalReceipt(runtime, input)).toMatchObject({ kind: "pending" });
    // The native issuance fixture starts at a root property, not a prebuilt group.
    // Build an actual ancestor while preserving all existing relative subtree paths.
    const parent = crypto.randomUUID();
    await deploy`UPDATE org_node SET path=('q207_review_parent.'||path::text)::ltree
      WHERE tenant_id=${first.tenantId}::uuid`;
    await deploy`INSERT INTO org_node(id,tenant_id,path,kind,name)
      VALUES(${parent}::uuid,${first.tenantId}::uuid,'q207_review_parent'::ltree,'group','Q207 parent')`;
    const sibling = crypto.randomUUID(), child = crypto.randomUUID();
    await deploy`INSERT INTO org_node(id,tenant_id,path,kind,name,timezone)
      SELECT ${sibling}::uuid,tenant_id,(path::text||'_sibling')::ltree,'property','Q207 sibling',timezone
        FROM org_node WHERE id=${first.propertyNode}::uuid`;
    await deploy`INSERT INTO org_node(id,tenant_id,path,kind,name)
      SELECT ${child}::uuid,tenant_id,(path::text||'.review_outlet')::ltree,'outlet','Q207 child'
        FROM org_node WHERE id=${first.propertyNode}::uuid`;
    for (const scope of [sibling, child]) {
      await deploy`UPDATE user_role SET scope_node=${scope}::uuid WHERE user_id=${actor}::uuid`;
      expect(await readSignedFiscalReceipt(runtime, input)).toBeNull();
    }
    const [ancestor] = await deploy<{ id: string }[]>`SELECT a.id::text FROM org_node a JOIN org_node p
      ON a.tenant_id=p.tenant_id AND a.path @> p.path AND a.id<>p.id
      WHERE p.id=${first.propertyNode}::uuid ORDER BY nlevel(a.path) DESC LIMIT 1`;
    expect(ancestor).toBeDefined();
    await deploy`UPDATE user_role SET scope_node=${ancestor!.id}::uuid WHERE user_id=${actor}::uuid`;
    expect(await readSignedFiscalReceipt(runtime, input)).toMatchObject({ kind: "pending" });
    expect(await readSignedFiscalReceipt(runtime, { ...input, propertyNode: sibling })).toBeNull();
    try {
      await deploy`UPDATE app_user SET status='inactive' WHERE id=${actor}::uuid`;
      expect(await readSignedFiscalReceipt(runtime, input)).toBeNull();
    } finally { await deploy`UPDATE app_user SET status='active' WHERE id=${actor}::uuid`; }
    try {
      await deploy`UPDATE tenant SET status='inactive' WHERE id=${first.tenantId}::uuid`;
      expect(await readSignedFiscalReceipt(runtime, input)).toBeNull();
    } finally { await deploy`UPDATE tenant SET status='active' WHERE id=${first.tenantId}::uuid`; }
    expect(await readSignedFiscalReceipt(runtime, input)).toMatchObject({ kind: "pending" });
  }, 90_000);

  test("refuses fabricated unsigned terminal UPDATE and INSERT after81", async () => {
    const scenario = await createSignedFiscalScenario(deploy, runtime, database);
    const claim = await claimSignedFiscalSubmission(runtime, scenario);
    const legacy = { type: "transport_result", tenantId: claim.tenantId, providerKey: claim.providerKey,
      attemptId: claim.attemptId, documentId: claim.documentId, payloadSha256: claim.wireSha256,
      outcome: "accepted", authorityRef: "c1".repeat(32), responseSha256: sha256("legacy-response") };
    await expectSqlState(() => reconcileSignedFiscalSubmission(runtime, scenario, claim, legacy), "22023");
    const before = await snapshot(scenario);
    await expectSqlState(() => deploy.begin(async tx => {
      await tx.unsafe("SET LOCAL ROLE yellow_owner");
      await tx`UPDATE public.fiscal_submission SET transition_seq=transition_seq+1,status='accepted',
        disposition='none',reconciliation_reason=NULL,resolution_source='transport_result',
        authority_ref=${legacy.authorityRef},response_sha256=${legacy.responseSha256},response=${JSON.stringify(legacy)}::jsonb,
        resolved_at=clock_timestamp()
       WHERE tenant_id=${scenario.tenantId}::uuid AND id=${scenario.submissionId}::uuid`;
    }), "55000");
    expect(await snapshot(scenario)).toEqual(before);
    await expectSqlState(() => deploy.begin(async tx => {
      await tx.unsafe("SET LOCAL ROLE yellow_owner");
      return tx`INSERT INTO fiscal_submission SELECT (jsonb_populate_record(NULL::fiscal_submission,
        to_jsonb(s)||jsonb_build_object('id',${crypto.randomUUID()}::uuid,'status','accepted','disposition','none',
          'reconciliation_reason',NULL,'resolution_source','transport_result','authority_ref',${legacy.authorityRef}::text,
          'response_sha256',${legacy.responseSha256}::text,'response',${JSON.stringify(legacy)}::jsonb,
          'resolved_at',clock_timestamp()))).* FROM fiscal_submission s
        WHERE s.id=${scenario.submissionId}::uuid`;
    }), "55000");
    expect(await snapshot(scenario)).toEqual(before);
  }, 60_000);
});
