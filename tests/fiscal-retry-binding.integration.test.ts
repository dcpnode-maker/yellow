import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";

import { MigrationError, runMigrations } from "../scripts/migrate";
import { Hs256TokenSigner } from "../src/contexts/identity";
import { Database } from "../src/kernel";
import {
  FISCAL_REQUEST_SCOPE,
  FISCAL_RETRY_SCOPE,
  createFiscalSubmissionHttpScenario,
  fiscalRequest,
  fiscalRetryRequest,
  fiscalSubmissionHttpApp,
  fiscalToken,
  type FiscalSubmissionHttpBody,
  type FiscalSubmissionHttpScenario,
} from "./fixtures/order440-fiscal-submission-http";
import {
  claimSignedFiscalSubmission,
  createSignedFiscalReceiptFactory,
  createSignedFiscalScenario,
  readSignedFiscalReceipt,
  reconcileSignedFiscalSubmission,
  type SignedFiscalScenario,
} from "./fixtures/order440-signed-fiscal-receipt";

const migration = new URL("../migrations/0086_fiscal_submission_retry_binding.sql", import.meta.url);
const deployUrl = process.env.YELLOW_ORDER440_Q212_DEPLOY_DATABASE_URL;
const runtimeUrl = process.env.YELLOW_ORDER440_Q212_RUNTIME_DATABASE_URL;
const applyUpgrade = process.env.YELLOW_ORDER440_Q212_APPLY_UPGRADE === "1";
const required = process.env.YELLOW_REQUIRE_ORDER440_Q212_DATABASE === "1";
const READ_SCOPE = "tax-fiscal.submissions:read";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MIGRATION_86_FILENAME = "0086_fiscal_submission_retry_binding.sql";
const MIGRATION_86_SHA256 = "40c55de6a34fb0f0ba354e5e37d210500038018fa649cf9437e29813fa0b915e";
const RETRY_HELPER_SIGNATURE =
  "public.india_fiscal_submission_retry_binding_v1(text,text,text,uuid,integer)";
const RECEIPT_READER_SIGNATURE =
  "public.read_india_fiscal_submission_delivery_receipt(uuid,uuid,uuid,uuid)";

if ((required || applyUpgrade) && (!deployUrl || !runtimeUrl)) {
  throw new Error("Q212 retry binding proof requires explicit deploy and runtime URLs");
}

function target(value: string, role: "yellow_deploy" | "yellow_runtime"): Readonly<{
  host: string; database: string;
}> {
  let parsed: URL;
  try { parsed = new URL(value); } catch { throw new Error("Q212 proof target is invalid"); }
  let database: string;
  try { database = decodeURIComponent(parsed.pathname.slice(1)); } catch { throw new Error("Q212 proof target is invalid"); }
  if (!/^(?:postgres|postgresql):$/.test(parsed.protocol) || !["127.0.0.1", "[::1]"].includes(parsed.hostname)
    || !parsed.password || decodeURIComponent(parsed.username) !== role || parsed.search || parsed.hash
    || !/^yellow_order440_q212_[a-z0-9_]+$/.test(database)) throw new Error("Q212 proof target is invalid");
  return Object.freeze({ host: `${parsed.hostname.toLowerCase()}:${parsed.port || "5432"}`, database });
}

function assertTargets(deploy: string, runtime: string): void {
  const left = target(deploy, "yellow_deploy"), right = target(runtime, "yellow_runtime");
  if (left.host !== right.host || left.database !== right.database) {
    throw new Error("Q212 deploy and runtime targets must identify one disposable database");
  }
}

if (deployUrl || runtimeUrl) {
  if (!deployUrl || !runtimeUrl) throw new Error("Q212 requires both database targets");
  assertTargets(deployUrl, runtimeUrl);
}

describe("Q212 forward-only retry binding source", () => {
  test("replaces only the bounded receipt projection and creates one used private helper", async () => {
    expect(await Bun.file(migration).exists()).toBe(true);
    const source = await Bun.file(migration).text();
    expect(source).toContain("india_fiscal_submission_retry_binding_v1(");
    expect(source).toContain("providerExtensionId");
    expect(source).toContain("providerExtensionVersion");
    expect(source).toContain("'retryBinding'");
    expect(source).toContain("v_common||public.india_fiscal_submission_retry_binding_v1(");
    expect(source).toContain("CREATE OR REPLACE FUNCTION public.read_india_fiscal_submission_delivery_receipt(");
    expect(source).not.toMatch(/CREATE\s+TABLE|ALTER\s+TABLE|CREATE\s+INDEX/iu);
    expect(source).not.toContain("fiscal-provider-options");
    expect(source).not.toContain("tax-fiscal.submissions:request");
    // pg_proc.proconfig preserves the declared ISO,YMD literal. Both migration
    // guards must match the canonical81 setting, not a display-formatted variant.
    expect(source.match(/'DateStyle=ISO,YMD'/gu)).toHaveLength(2);
    expect(source).not.toContain("'DateStyle=ISO, YMD'");
  });

  test("accepts only one loopback disposable database with split exact roles", () => {
    const deploy = "postgres://yellow_deploy:secret@127.0.0.1:55503/yellow_order440_q212_proof";
    const runtime = "postgres://yellow_runtime:secret@127.0.0.1:55503/yellow_order440_q212_proof";
    expect(() => assertTargets(deploy, runtime)).not.toThrow();
    for (const values of [
      [deploy.replace("q212", "q211"), runtime],
      [deploy, runtime.replace("55503", "55504")],
      [deploy, runtime.replace("yellow_runtime", "yellow_deploy")],
      [deploy, runtime.replace("127.0.0.1", "database.example")],
      [deploy, runtime + "?options=private"],
    ]) expect(() => assertTargets(values[0]!, values[1]!)).toThrow();
  });
});

interface Claim {
  readonly claimed: true;
  readonly claimToken: string;
  readonly attemptId: string;
  readonly documentId: string;
  readonly providerKey: string;
  readonly wireSha256: string;
}

interface AcceptedPersistence {
  readonly response_text: string;
  readonly response_sha256: string;
  readonly qr_payload: string;
  readonly authority_ref: string;
  readonly document_content: string;
  readonly document_sha256: string;
}

interface ExactLedgerRow {
  readonly version_bytes: string;
  readonly filename_bytes: string;
  readonly checksum_bytes: string;
  readonly applied_at_bytes: string;
}

interface ReceiptReaderAuthority {
  readonly owner: string;
  readonly language: string;
  readonly volatility: string;
  readonly security_definer: boolean;
  readonly strict: boolean;
  readonly parallel: string;
  readonly leakproof: boolean;
  readonly config: string[];
  readonly result: string;
  readonly acl: string;
  readonly app: boolean;
  readonly runtime: boolean;
  readonly public: boolean;
  readonly definition: string;
}

async function migrationFailure(operation: Promise<unknown>): Promise<MigrationError> {
  try {
    await operation;
  } catch (error) {
    if (error instanceof MigrationError) return error;
    throw error;
  }
  throw new Error("Q212 rollback probe expected migration86 to fail");
}

async function exactLedger(sql: SQL): Promise<readonly ExactLedgerRow[]> {
  return sql<ExactLedgerRow[]>`
    SELECT pg_catalog.encode(pg_catalog.int8send(version),'hex') AS version_bytes,
           pg_catalog.encode(pg_catalog.textsend(filename),'hex') AS filename_bytes,
           pg_catalog.encode(pg_catalog.textsend(checksum_sha256),'hex') AS checksum_bytes,
           pg_catalog.encode(pg_catalog.timestamptz_send(applied_at),'hex') AS applied_at_bytes
      FROM public.schema_migration ORDER BY version`;
}

async function receiptReaderAuthority(sql: SQL): Promise<ReceiptReaderAuthority> {
  const [row] = await sql<ReceiptReaderAuthority[]>`
    SELECT pg_catalog.pg_get_userbyid(function_row.proowner) AS owner,
           language.lanname AS language,function_row.provolatile::text AS volatility,
           function_row.prosecdef AS security_definer,function_row.proisstrict AS strict,
           function_row.proparallel::text AS parallel,function_row.proleakproof AS leakproof,
           function_row.proconfig AS config,pg_catalog.pg_get_function_result(function_row.oid) AS result,
           function_row.proacl::text AS acl,
           pg_catalog.has_function_privilege('app_role',function_row.oid,'EXECUTE') AS app,
           pg_catalog.has_function_privilege('yellow_runtime',function_row.oid,'EXECUTE') AS runtime,
           pg_catalog.has_function_privilege('public',function_row.oid,'EXECUTE') AS public,
           pg_catalog.pg_get_functiondef(function_row.oid) AS definition
      FROM pg_catalog.pg_proc function_row
      JOIN pg_catalog.pg_language language ON language.oid=function_row.prolang
     WHERE function_row.oid=pg_catalog.to_regprocedure(${RECEIPT_READER_SIGNATURE})`;
  if (!row) throw new Error("Q212 receipt reader authority is unavailable");
  return Object.freeze(row);
}

async function installMigrationRollbackProbe(sql: SQL): Promise<void> {
  const [absence] = await sql<{ function_absent: boolean; trigger_absent: boolean }[]>`
    SELECT pg_catalog.to_regprocedure('public.q212_migration_rollback_probe()') IS NULL
             AS function_absent,
           NOT EXISTS (
             SELECT 1 FROM pg_catalog.pg_trigger trigger_row
              WHERE trigger_row.tgrelid='public.schema_migration'::pg_catalog.regclass
                AND trigger_row.tgname='q212_migration_rollback_probe'
                AND NOT trigger_row.tgisinternal
           ) AS trigger_absent`;
  if (!absence?.function_absent || !absence.trigger_absent) {
    throw new Error("Q212 migration rollback probe already exists");
  }
  await sql.begin(async transaction => {
    await transaction.unsafe(`
      CREATE FUNCTION public.q212_migration_rollback_probe() RETURNS trigger
      LANGUAGE plpgsql SECURITY INVOKER
      SET search_path=pg_catalog,public AS $q212_probe$
      DECLARE
        v_helper oid:=pg_catalog.to_regprocedure(
          'public.india_fiscal_submission_retry_binding_v1(text,text,text,uuid,integer)');
        v_reader oid:=pg_catalog.to_regprocedure(
          'public.read_india_fiscal_submission_delivery_receipt(uuid,uuid,uuid,uuid)');
        v_reader_source text;
      BEGIN
        IF NEW.version<>86 THEN RETURN NEW; END IF;
        v_reader_source:=pg_catalog.pg_get_functiondef(v_reader);
        IF NEW.filename IS DISTINCT FROM '${MIGRATION_86_FILENAME}'
           OR pg_catalog.btrim(NEW.checksum_sha256) IS DISTINCT FROM '${MIGRATION_86_SHA256}'
           OR v_helper IS NULL OR v_reader IS NULL
           OR NOT EXISTS (
             SELECT 1 FROM pg_catalog.pg_proc helper
              WHERE helper.oid=v_helper AND helper.proowner='yellow_owner'::pg_catalog.regrole
                AND helper.provolatile='i' AND NOT helper.prosecdef
                AND NOT helper.proisstrict AND helper.proparallel='u'
                AND NOT helper.proleakproof AND NOT helper.proretset
                AND helper.prorettype='pg_catalog.jsonb'::pg_catalog.regtype
           )
           OR NOT EXISTS (
             SELECT 1 FROM pg_catalog.pg_proc reader
              WHERE reader.oid=v_reader AND reader.proowner='yellow_owner'::pg_catalog.regrole
                AND reader.provolatile='s' AND reader.prosecdef
                AND pg_catalog.has_function_privilege('app_role',reader.oid,'EXECUTE')
                AND NOT pg_catalog.has_function_privilege('yellow_runtime',reader.oid,'EXECUTE')
                AND NOT pg_catalog.has_function_privilege('public',reader.oid,'EXECUTE')
           )
           OR pg_catalog.strpos(v_reader_source,
                'public.india_fiscal_submission_retry_binding_v1(')=0 THEN
          RAISE EXCEPTION USING ERRCODE='PZ085',
            MESSAGE='Q212 migration86 rollback probe prerequisites are unavailable';
        END IF;
        RAISE EXCEPTION USING ERRCODE='PZ086',
          MESSAGE='Q212 migration86 ledger insertion reached';
      END
      $q212_probe$
    `);
    await transaction.unsafe(`REVOKE ALL ON FUNCTION public.q212_migration_rollback_probe()
      FROM PUBLIC,app_role,yellow_runtime`);
    await transaction.unsafe(`CREATE TRIGGER q212_migration_rollback_probe
      AFTER INSERT ON public.schema_migration FOR EACH ROW
      EXECUTE FUNCTION public.q212_migration_rollback_probe()`);
  });
}

async function removeMigrationRollbackProbe(sql: SQL): Promise<void> {
  await sql.begin(async transaction => {
    await transaction.unsafe(`DROP TRIGGER IF EXISTS q212_migration_rollback_probe
      ON public.schema_migration`);
    await transaction.unsafe("DROP FUNCTION IF EXISTS public.q212_migration_rollback_probe()");
  });
}

async function knownNotSent(runtime: SQL, scenario: FiscalSubmissionHttpScenario, submissionId: string): Promise<void> {
  const claim = await runtime.begin(async tx => {
    await tx`SELECT set_config('app.tenant_id',${scenario.tenantId},true)`;
    const [row] = await tx<{ receipt: Claim }[]>`
      SELECT public.claim_india_fiscal_submission(${scenario.tenantId}::uuid,${submissionId}::uuid,60) AS receipt`;
    if (!row?.receipt.claimed) throw new Error("Q212 could not claim the synthetic submission");
    return row.receipt;
  });
  await runtime.begin(async tx => {
    await tx`SELECT set_config('app.tenant_id',${scenario.tenantId},true)`;
    await tx`SELECT public.reconcile_india_fiscal_submission(
      ${scenario.tenantId}::uuid,${submissionId}::uuid,${claim.attemptId}::uuid,${claim.claimToken}::uuid,
      ${JSON.stringify({ type: "transport_result", tenantId: scenario.tenantId,
        providerKey: claim.providerKey, attemptId: claim.attemptId, documentId: claim.documentId,
        payloadSha256: claim.wireSha256, outcome: "known_not_sent" })}::jsonb)`;
  });
}

async function tenantSnapshot(sql: SQL, tenantId: string): Promise<readonly string[]> {
  const result: string[] = [];
  for (const table of ["document", "document_series", "journal", "posting_line", "fact_log", "outbox",
    "fiscal_submission", "fiscal_submission_history", "api_idempotency"] as const) {
    const rows = await sql.unsafe<{ body: string }[]>(
      `SELECT to_jsonb(value)::text AS body FROM public.${table} value WHERE tenant_id=$1::uuid ORDER BY to_jsonb(value)::text`,
      [tenantId],
    );
    result.push(...rows.map(row => `${table}:${row.body}`));
  }
  return Object.freeze(result);
}

async function fiscalCounts(sql: SQL, tenantId: string): Promise<Readonly<{ history: number; facts: number; events: number }>> {
  const [row] = await sql<{ history: number; facts: number; events: number }[]>`
    SELECT
      (SELECT count(*)::integer FROM public.fiscal_submission_history WHERE tenant_id=${tenantId}::uuid) AS history,
      (SELECT count(*)::integer FROM public.fact_log WHERE tenant_id=${tenantId}::uuid AND entity_type='fiscal_submission') AS facts,
      (SELECT count(*)::integer FROM public.outbox WHERE tenant_id=${tenantId}::uuid AND aggregate_type='fiscal_submission') AS events`;
  if (!row) throw new Error("Q212 fiscal count is unavailable");
  return Object.freeze(row);
}

function receiptRequest(scenario: FiscalSubmissionHttpScenario, token: string): Request {
  return new Request(`http://yellow.test/api/v1/properties/${scenario.propertyNode}/invoices/${scenario.documentId}/receipt`, {
    headers: { authorization: `Bearer ${token}` },
  });
}

async function acceptedPersistence(sql: SQL, scenario: SignedFiscalScenario): Promise<AcceptedPersistence> {
  const [row] = await sql<AcceptedPersistence[]>`
    SELECT submission.response::text AS response_text,submission.response_sha256,
           submission.qr_payload,submission.authority_ref,
           document.content::text AS document_content,document.sha256 AS document_sha256
      FROM public.fiscal_submission submission
      JOIN public.document document ON document.tenant_id=submission.tenant_id
       AND document.id=submission.document_id
     WHERE submission.tenant_id=${scenario.tenantId}::uuid
       AND submission.id=${scenario.submissionId}::uuid`;
  if (!row) throw new Error("Q212 accepted persistence is unavailable");
  return Object.freeze(row);
}

const databaseDescribe = deployUrl && runtimeUrl ? describe.serial : describe.skip;

databaseDescribe("Q212 signed-session retry binding recovery", () => {
  let deploy: SQL;
  let runtime: SQL;
  let database: Database;
  let tokens: Hs256TokenSigner;
  let scenario: FiscalSubmissionHttpScenario;
  let other: SignedFiscalScenario;
  let submissionId: string;
  let acceptedSnapshotBefore: readonly string[];
  let acceptedPersistenceBefore: AcceptedPersistence;
  let acceptedProjectionBefore: string;

  beforeAll(async () => {
    deploy = new SQL(deployUrl!, { max: 4, prepare: false });
    runtime = new SQL(runtimeUrl!, { max: 3, prepare: false });
    database = Database.connect(runtimeUrl!, { maxConnections: 4, prepare: false });
    tokens = new Hs256TokenSigner("q212-retry-binding-signed-session-secret-value");
    const [identity] = await deploy<{ frontier: number; tenants: number }[]>`
      SELECT (SELECT max(version)::integer FROM public.schema_migration) AS frontier,
             (SELECT count(*)::integer FROM public.tenant) AS tenants`;
    const expected = applyUpgrade ? 85 : 86;
    if (!identity || identity.frontier !== expected || identity.tenants !== 0) {
      throw new Error(`Q212 proof requires an empty exact canonical${expected} target`);
    }

    scenario = await createFiscalSubmissionHttpScenario(deploy, database);
    const setupToken = await fiscalToken(tokens, scenario);
    const setupApp = fiscalSubmissionHttpApp(database, tokens, [scenario.provider]);
    const created = await setupApp.handle(fiscalRequest(scenario, setupToken, `q212-source-${crypto.randomUUID()}`));
    expect(created.status).toBe(201);
    const body = await created.json() as FiscalSubmissionHttpBody;
    submissionId = body.fiscalSubmission.submissionId;
    await knownNotSent(runtime, scenario, submissionId);
    await deploy`INSERT INTO public.role_permission(role_id,permission_code)
      SELECT ${scenario.roleId}::uuid,${READ_SCOPE} WHERE EXISTS(
        SELECT 1 FROM public.permission WHERE code=${READ_SCOPE}) ON CONFLICT DO NOTHING`;
    await deploy`DELETE FROM public.role_permission WHERE role_id=${scenario.roleId}::uuid
      AND permission_code=${FISCAL_REQUEST_SCOPE}`;

    // A separate tenant reaches acceptance only through the genuine generated-RSA
    // signing and pinned binding verifier fixture. It is retained across 85->86 so
    // the projection-only migration must preserve its signed artifacts byte-for-byte.
    const signedReceipts = await createSignedFiscalReceiptFactory();
    other = await createSignedFiscalScenario(deploy, runtime, database);
    const acceptedClaim = await claimSignedFiscalSubmission(runtime, other);
    const acceptedResult = await signedReceipts.accepted(acceptedClaim);
    expect(await reconcileSignedFiscalSubmission(runtime, other, acceptedClaim, acceptedResult))
      .toMatchObject({ status: "accepted", disposition: "none" });
    await deploy`DELETE FROM public.role_permission WHERE role_id=${other.roleId}::uuid
      AND permission_code=${FISCAL_REQUEST_SCOPE}`;
    acceptedSnapshotBefore = await tenantSnapshot(deploy, other.tenantId);
    acceptedPersistenceBefore = await acceptedPersistence(deploy, other);
    acceptedProjectionBefore = JSON.stringify(await readSignedFiscalReceipt(runtime, other));
    expect(JSON.parse(acceptedProjectionBefore)).toMatchObject({ kind: "accepted_signed_v1",
      submissionId: other.submissionId, documentId: other.documentId,
      status: "accepted", disposition: "none" });
    expect(acceptedProjectionBefore).not.toContain("retryBinding");

    if (applyUpgrade) {
      const before = await tenantSnapshot(deploy, scenario.tenantId);
      const ledgerBefore = await exactLedger(deploy);
      const readerBefore = await receiptReaderAuthority(deploy);
      const [helperBefore] = await deploy<{ helper: string | null }[]>`
        SELECT pg_catalog.to_regprocedure(${RETRY_HELPER_SIGNATURE})::text AS helper`;
      expect(helperBefore).toEqual({ helper: null });
      const retryReadToken = await fiscalToken(tokens, scenario, [READ_SCOPE, FISCAL_RETRY_SCOPE]);
      const projectionBeforeResponse = await setupApp.handle(receiptRequest(scenario, retryReadToken));
      expect(projectionBeforeResponse.status).toBe(200);
      const projectionBefore = await projectionBeforeResponse.text();
      let ownsProbe = false;
      try {
        await installMigrationRollbackProbe(deploy);
        ownsProbe = true;
        const [probe] = await deploy<{
          trigger_type: number;
          trigger_enabled: string;
          function_owner: string;
          security_definer: boolean;
          public: boolean;
          app: boolean;
          runtime: boolean;
        }[]>`
          SELECT trigger_row.tgtype::integer AS trigger_type,
                 trigger_row.tgenabled::text AS trigger_enabled,
                 pg_catalog.pg_get_userbyid(function_row.proowner) AS function_owner,
                 function_row.prosecdef AS security_definer,
                 pg_catalog.has_function_privilege('public',function_row.oid,'EXECUTE') AS public,
                 pg_catalog.has_function_privilege('app_role',function_row.oid,'EXECUTE') AS app,
                 pg_catalog.has_function_privilege('yellow_runtime',function_row.oid,'EXECUTE') AS runtime
            FROM pg_catalog.pg_trigger trigger_row
            JOIN pg_catalog.pg_proc function_row ON function_row.oid=trigger_row.tgfoid
           WHERE trigger_row.tgrelid='public.schema_migration'::pg_catalog.regclass
             AND trigger_row.tgname='q212_migration_rollback_probe'
             AND NOT trigger_row.tgisinternal`;
        expect(probe).toEqual({ trigger_type: 5, trigger_enabled: "O",
          function_owner: "yellow_deploy", security_definer: false,
          public: false, app: false, runtime: false });

        const failure = await migrationFailure(runMigrations({
          databaseUrl: deployUrl!, logger: () => undefined,
        }));
        expect(failure).toMatchObject({ errno: "PZ086", rollbackConnectionUsable: true });
        expect(failure.message).toBe("Q212 migration86 ledger insertion reached (SQLSTATE PZ086)");
        expect(await deploy<Array<{ usable: number }>>`SELECT 1::integer AS usable`)
          .toEqual([{ usable: 1 }]);
        expect(await exactLedger(deploy)).toEqual(ledgerBefore);
        expect(await receiptReaderAuthority(deploy)).toEqual(readerBefore);
        expect(await deploy<Array<{ helper: string | null }>>`
          SELECT pg_catalog.to_regprocedure(${RETRY_HELPER_SIGNATURE})::text AS helper`)
          .toEqual([{ helper: null }]);
        expect(await tenantSnapshot(deploy, scenario.tenantId)).toEqual(before);
        expect(await tenantSnapshot(deploy, other.tenantId)).toEqual(acceptedSnapshotBefore);
        expect(await acceptedPersistence(deploy, other)).toEqual(acceptedPersistenceBefore);
        expect(JSON.stringify(await readSignedFiscalReceipt(runtime, other))).toBe(acceptedProjectionBefore);
        const projectionAfterResponse = await setupApp.handle(receiptRequest(scenario, retryReadToken));
        expect(projectionAfterResponse.status).toBe(200);
        expect(await projectionAfterResponse.text()).toBe(projectionBefore);
      } finally {
        if (ownsProbe) await removeMigrationRollbackProbe(deploy);
      }
      expect(await deploy<Array<{ function_absent: boolean; trigger_absent: boolean }>>`
        SELECT pg_catalog.to_regprocedure('public.q212_migration_rollback_probe()') IS NULL
                 AS function_absent,
               NOT EXISTS (
                 SELECT 1 FROM pg_catalog.pg_trigger trigger_row
                  WHERE trigger_row.tgrelid='public.schema_migration'::pg_catalog.regclass
                    AND trigger_row.tgname='q212_migration_rollback_probe'
                    AND NOT trigger_row.tgisinternal
               ) AS trigger_absent`)
        .toEqual([{ function_absent: true, trigger_absent: true }]);
      expect(await exactLedger(deploy)).toEqual(ledgerBefore);
      expect(await receiptReaderAuthority(deploy)).toEqual(readerBefore);

      const applied = await runMigrations({ databaseUrl: deployUrl!, logger: () => undefined });
      expect(applied.appliedFiles).toEqual([MIGRATION_86_FILENAME]);
      expect(applied.transactionBackendPids).toEqual([applied.backendPid]);
      expect(await tenantSnapshot(deploy, scenario.tenantId)).toEqual(before);
      expect(await tenantSnapshot(deploy, other.tenantId)).toEqual(acceptedSnapshotBefore);
    }
    const [frontier] = await deploy<{ frontier: number; migrations: number }[]>`
      SELECT max(version)::integer AS frontier,count(*)::integer AS migrations FROM public.schema_migration`;
    expect(frontier).toEqual({ frontier: 86, migrations: 86 });
    expect(await acceptedPersistence(deploy, other)).toEqual(acceptedPersistenceBefore);
    expect(JSON.stringify(await readSignedFiscalReceipt(runtime, other))).toBe(acceptedProjectionBefore);
  }, 60_000);

  afterAll(async () => {
    await database?.close();
    await runtime?.close({ timeout: 0 });
    await deploy?.close({ timeout: 0 });
  });

  test("keeps the semantic helper private, immutable and exact", async () => {
    const [row] = await deploy<{ owner: string; language: string; volatility: string; security_definer: boolean;
      strict: boolean; parallel: string; leakproof: boolean; config: string[]; result: string;
      app: boolean; runtime: boolean; public: boolean }[]>`
      SELECT pg_get_userbyid(function_row.proowner) AS owner,language.lanname AS language,
             function_row.provolatile::text AS volatility,function_row.prosecdef AS security_definer,
             function_row.proisstrict AS strict,function_row.proparallel::text AS parallel,
             function_row.proleakproof AS leakproof,function_row.proconfig AS config,
             pg_get_function_result(function_row.oid) AS result,
             has_function_privilege('app_role',function_row.oid,'EXECUTE') AS app,
             has_function_privilege('yellow_runtime',function_row.oid,'EXECUTE') AS runtime,
             has_function_privilege('public',function_row.oid,'EXECUTE') AS public
      FROM pg_proc function_row JOIN pg_language language ON language.oid=function_row.prolang
      WHERE function_row.oid=to_regprocedure(
        'public.india_fiscal_submission_retry_binding_v1(text,text,text,uuid,integer)')`;
    expect(row).toEqual({ owner: "yellow_owner", language: "sql", volatility: "i",
      security_definer: false, strict: false, parallel: "u", leakproof: false,
      config: ["search_path=pg_catalog, public"], result: "jsonb",
      app: false, runtime: false, public: false });
  });

  test("recovers the exact original binding for a genuine retry-only session", async () => {
    const token = await fiscalToken(tokens, scenario, [READ_SCOPE, FISCAL_RETRY_SCOPE]);
    const app = fiscalSubmissionHttpApp(database, tokens, [scenario.provider, other.provider]);
    const response = await app.handle(receiptRequest(scenario, token));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ delivery: { kind: "receipt", documentId: scenario.documentId,
      receipt: { kind: "pending", submissionId, status: "error", disposition: "retry",
        providerKey: scenario.provider.providerKey, retryBinding: {
          providerExtensionId: scenario.provider.providerExtensionId,
          providerExtensionVersion: scenario.provider.providerExtensionVersion,
        } } } });
    const grants = await deploy<{ permission_code: string }[]>`
      SELECT permission_code FROM public.role_permission WHERE role_id=${scenario.roleId}::uuid
        AND permission_code LIKE 'tax-fiscal.submissions:%' ORDER BY permission_code`;
    expect(grants.map(row => row.permission_code)).toEqual([READ_SCOPE, FISCAL_RETRY_SCOPE]);
  });

  test("denies valid foreign, unassigned and revoked identities without exposing a binding", async () => {
    const app = fiscalSubmissionHttpApp(database, tokens, [scenario.provider, other.provider]);
    const foreign = await fiscalToken(tokens, other, [READ_SCOPE, FISCAL_RETRY_SCOPE]);
    const own = await app.handle(receiptRequest(other, foreign));
    expect(own.status).toBe(200);
    const ownBytes = await own.text();
    expect(ownBytes).toContain('"kind":"accepted_signed_v1"');
    expect(ownBytes).toContain(`"documentId":"${other.documentId}"`);
    expect(ownBytes).not.toContain("retryBinding");
    expect((await app.handle(receiptRequest(scenario, foreign))).status).toBe(403);
    const unassigned = await fiscalToken(tokens, { tenantId: scenario.tenantId,
      actorId: scenario.unauthorizedActorId }, [READ_SCOPE, FISCAL_RETRY_SCOPE]);
    expect((await app.handle(receiptRequest(scenario, unassigned))).status).toBe(403);
    const token = await fiscalToken(tokens, scenario, [READ_SCOPE, FISCAL_RETRY_SCOPE]);
    await deploy`DELETE FROM public.role_permission WHERE role_id=${scenario.roleId}::uuid AND permission_code=${READ_SCOPE}`;
    expect((await app.handle(receiptRequest(scenario, token))).status).toBe(403);
    await deploy`INSERT INTO public.role_permission(role_id,permission_code) VALUES(${scenario.roleId}::uuid,${READ_SCOPE})`;
  });

  test("replays one committed retry after response loss and a fresh app never offers the binding again", async () => {
    const token = await fiscalToken(tokens, scenario, [READ_SCOPE, FISCAL_RETRY_SCOPE]);
    const key = `q212-retry-${crypto.randomUUID()}`;
    const before = await fiscalCounts(deploy, scenario.tenantId);
    const financialBefore = await tenantSnapshot(deploy, scenario.tenantId);
    const firstApp = fiscalSubmissionHttpApp(database, tokens, [scenario.provider, other.provider]);
    const lostResponse = await firstApp.handle(fiscalRetryRequest(scenario, token, submissionId, key));
    expect(lostResponse.status).toBe(201); // Intentionally do not consume its body.

    const afterFirst = await fiscalCounts(deploy, scenario.tenantId);
    expect(afterFirst).toEqual({ history: before.history + 1, facts: before.facts + 1, events: before.events + 1 });
    const freshApp = fiscalSubmissionHttpApp(database, tokens, [scenario.provider, other.provider]);
    const current = await freshApp.handle(receiptRequest(scenario, token));
    expect(current.status).toBe(200);
    const currentBody = JSON.stringify(await current.json());
    expect(currentBody).toContain('"status":"pending"');
    expect(currentBody).toContain('"disposition":"send"');
    expect(currentBody).not.toContain("retryBinding");

    const replay = await freshApp.handle(fiscalRetryRequest(scenario, token, submissionId, key));
    expect(replay.status).toBe(201);
    expect(replay.headers.get("idempotency-replayed")).toBe("true");
    // D1389 preserves exact successful JSON; replay metadata belongs only to the
    // response header. Consume the previously lost body only AFTER recovery, as
    // an independent byte oracle rather than as input to the recreated app.
    const replayBytes = await replay.text();
    expect(replayBytes).toBe(await lostResponse.text());
    const replayBody = JSON.parse(replayBytes) as FiscalSubmissionHttpBody;
    expect(replayBody.fiscalSubmission).toMatchObject({ submissionId, retryCount: 1,
      attemptNumber: 2, status: "pending", disposition: "send", replayed: false });
    expect(await fiscalCounts(deploy, scenario.tenantId)).toEqual(afterFirst);

    const financialAfter = await tenantSnapshot(deploy, scenario.tenantId);
    const financialTables = (rows: readonly string[]) => rows.filter(row => /^(?:document|document_series|journal|posting_line):/.test(row));
    expect(financialTables(financialAfter)).toEqual(financialTables(financialBefore));
  }, 30_000);
});
